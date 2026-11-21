// F.R.Ai.D.A.Y Dokumenten-Wissen (v1.134.0, Idee aus OpenJarvis "Deep Research mit Quellen")
// Friday durchsucht deine eigenen Unterlagen (PDF, Word, Text, Markdown …) im Ordner ~/Friday-Wissen
// und antwortet mit Quelle und Seite. Die Suche selbst läuft auf dem Mac und kostet nichts;
// nur die zusammengefasste Antwort nutzt Claude (wenn Guthaben da ist).
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  let daten = null;

  const w = H.fenster({
    id: "dokwissen", titel: "📚 Dokumenten-Wissen", klasse: "dk-box",
    html: `
      <div class="hf-tabs" role="tablist">
        <button class="hf-tab an" data-tab="fragen">❓ Fragen</button>
        <button class="hf-tab" data-tab="dokumente">📁 Meine Dokumente</button>
      </div>
      <div id="dk-status" class="hf-status">Frag zum Beispiel: „Wie lange ist die Kündigungsfrist in meinem Mietvertrag?“</div>
      <section data-seite="fragen">
        <form id="dk-frage-f" class="hf-reihe" autocomplete="off">
          <input id="dk-frage" class="hf-input grow" type="search" placeholder="Was möchtest du aus deinen Unterlagen wissen?" enterkeyhint="search" aria-label="Frage">
          <button class="hf-btn haupt" type="submit">🔎 Fragen</button>
        </form>
        <label class="hf-hinweis" style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" id="dk-claude" checked> Antwort von Claude zusammenfassen lassen (sonst nur die Fundstellen, kostenlos)</label>
        <div id="dk-antwort" class="hf-karte hidden" style="margin-top:10px"><h3>Antwort</h3><p id="dk-antwort-text" class="dk-antwort"></p></div>
        <div id="dk-treffer" class="hf-liste" style="margin-top:10px"></div>
      </section>
      <section data-seite="dokumente" class="hidden">
        <div class="hf-reihe">
          <label class="hf-btn haupt">⬆ Dateien hinzufügen<input id="dk-upload" type="file" multiple hidden></label>
          <button id="dk-ordner" class="hf-btn" type="button">📂 Ordner am Mac öffnen</button>
          <button id="dk-scan" class="hf-btn leise" type="button">⟳ Neu einlesen</button>
        </div>
        <p id="dk-info" class="hf-hinweis"></p>
        <div id="dk-liste" class="hf-liste"></div>
      </section>
      <div id="dk-lesen" class="hf-karte hidden"><h3 id="dk-lesen-t"></h3><div id="dk-lesen-text" class="dk-text"></div></div>`,
    onOpen: (opts) => { laden(); zeigeTab(opts?.tab || "fragen"); if (opts?.frage) { $("#dk-frage").value = opts.frage; if (opts.ergebnis) zeigeFertig(opts.frage, opts.ergebnis); else fragen(opts.frage); } },
  });
  const $ = (s) => w.$(s);
  const status = (t, f = false) => { const s = $("#dk-status"); s.textContent = t; s.classList.toggle("fehler", f); };
  const groesse = (b) => (b > 1048576 ? `${(b / 1048576).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const ICON = { pdf: "📕", textutil: "📘", text: "📄", html: "🌐" };

  function zeigeTab(t) {
    w.$$(".hf-tab").forEach((b) => b.classList.toggle("an", b.dataset.tab === t));
    w.$$("[data-seite]").forEach((s) => s.classList.toggle("hidden", s.dataset.seite !== t));
  }
  w.sheet.querySelector(".hf-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) zeigeTab(b.dataset.tab); });

  function zeichne() {
    const d = daten;
    if (!d) return;
    const laeuft = d.status?.laeuft;
    $("#dk-info").innerHTML = `${d.bereit} von ${d.dokumente.length} Dateien gelesen, ${d.stuecke} Abschnitte durchsuchbar.${laeuft ? " <b>Friday liest gerade ein …</b>" : ""} Ordner: <code>${esc(d.ordner)}</code>. Lesbar: ${esc((d.endungen || []).join(" "))}`;
    $("#dk-liste").innerHTML = d.dokumente.length ? d.dokumente.map((x) => `
      <div class="hf-zeile" data-id="${esc(x.id)}">
        <span class="icon">${x.quelle === "friday" ? "🤖" : ICON[x.art] || "📄"}</span>
        <span class="name"><b>${esc(x.name)}</b><br><span class="klein">${x.seiten ? `${x.seiten} Seiten · ` : ""}${x.groesse ? `${groesse(x.groesse)} · ` : ""}${x.quelle === "friday" ? "von Friday erstellt" : esc(x.status === "bereit" ? "durchsuchbar" : x.status || "")}</span></span>
        <button class="hf-mini" data-lesen>Lesen</button>
        ${x.quelle === "friday" ? "" : '<button class="hf-mini" data-oeffnen>Öffnen</button><button class="hf-mini" data-weg title="In den Papierkorb">🗑</button>'}
      </div>`).join("") : '<div class="hf-leer">Noch keine Unterlagen. Füge oben Dateien hinzu oder leg sie am Mac in den Ordner Friday-Wissen.</div>';
  }

  async function laden() {
    try { daten = await json("/api/dokwissen"); zeichne(); if (daten.status?.laeuft) setTimeout(() => w.offen() && laden(), 3000); } catch (err) { status(err.message, true); }
  }

  function trefferZeigen(liste) {
    $("#dk-treffer").innerHTML = liste.length ? liste.map((h, i) => `
      <div class="hf-zeile dk-treffer" data-id="${esc(h.doc)}" data-seite="${h.seite || ""}">
        <span class="icon">${i + 1}</span>
        <span class="name"><b>${esc(h.datei)}${h.seite ? `, Seite ${h.seite}` : ""}</b><p class="hf-zitat">${esc(h.text)}</p></span>
        <button class="hf-mini" data-lesen>Stelle lesen</button>
        ${h.quelle === "friday" ? "" : '<button class="hf-mini" data-oeffnen>Öffnen</button>'}
      </div>`).join("") : "";
  }

  async function fragen(frage) {
    if (!frage || frage.trim().length < 2) return;
    status("Friday sucht in deinen Unterlagen …");
    $("#dk-antwort").classList.add("hidden");
    $("#dk-treffer").innerHTML = "";
    try {
      const r = await json("/api/dokwissen/frage", { body: { frage, claude: $("#dk-claude").checked } });
      $("#dk-antwort-text").textContent = r.antwort;
      $("#dk-antwort").classList.remove("hidden");
      trefferZeigen(r.treffer || []);
      status(r.treffer?.length ? `${r.treffer.length} Fundstelle${r.treffer.length > 1 ? "n" : ""}${r.claude ? ", Antwort von Claude" : ""}.` : "Keine Fundstelle.");
    } catch (err) { status(err.message, true); }
  }
  // Per Sprache gefragt: Antwort ist schon da (nicht nochmal Claude fragen), nur die Fundstellen holen (kostenlos).
  async function zeigeFertig(frage, antwort) {
    $("#dk-antwort-text").textContent = antwort;
    $("#dk-antwort").classList.remove("hidden");
    try { const r = await json(`/api/dokwissen/suche?q=${encodeURIComponent(frage)}&n=6`); trefferZeigen(r.treffer || []); status(r.treffer?.length ? `${r.treffer.length} Fundstellen.` : ""); } catch (err) { status(err.message, true); }
  }
  $("#dk-frage-f").addEventListener("submit", (e) => { e.preventDefault(); fragen($("#dk-frage").value); });

  async function oeffnen(id) {
    try {
      const r = await window.Friday.api(`/api/dokwissen/datei/${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Die Datei lässt sich nicht öffnen.");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) { status(err.message, true); }
  }
  async function lesen(id, seite) {
    try {
      const r = await json(`/api/dokwissen/text/${encodeURIComponent(id)}${seite ? `?seite=${seite}` : ""}`);
      $("#dk-lesen-t").textContent = `${r.name}${seite ? `, Seite ${seite}` : ""}`;
      $("#dk-lesen-text").innerHTML = r.teile.map((t) => `${t.seite && !seite ? `<b class="dk-seite">Seite ${t.seite}</b>` : ""}<p>${esc(t.text)}</p>`).join("") || "<p>Kein Text gefunden.</p>";
      $("#dk-lesen").classList.remove("hidden");
      $("#dk-lesen").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) { status(err.message, true); }
  }
  w.sheet.addEventListener("click", async (e) => {
    const z = e.target.closest("[data-id]");
    if (!z) return;
    const id = z.dataset.id;
    if (e.target.closest("[data-oeffnen]")) oeffnen(id);
    else if (e.target.closest("[data-lesen]")) lesen(id, Number(z.dataset.seite) || null);
    else if (e.target.closest("[data-weg]")) {
      const b = e.target.closest("[data-weg]");
      if (!b.dataset.sicher) { b.dataset.sicher = "1"; b.textContent = "Wirklich?"; setTimeout(() => { if (b.isConnected) { delete b.dataset.sicher; b.textContent = "🗑"; } }, 3000); return; }
      try { daten = await json(`/api/dokwissen/${encodeURIComponent(id)}`, { method: "DELETE" }); zeichne(); status("Liegt jetzt im Papierkorb-Ordner (Friday-Wissen/Papierkorb)."); } catch (err) { status(err.message, true); }
    }
  });

  const alsBase64 = (f) => new Promise((ok, nein) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => nein(new Error("Datei nicht lesbar")); r.readAsDataURL(f); });
  $("#dk-upload").addEventListener("change", async (e) => {
    const dateien = [...e.target.files];
    e.target.value = "";
    let ok = 0;
    for (const f of dateien) {
      if (f.size > 8 * 1024 * 1024) { status(`${f.name} ist größer als 8 MB. Leg große Dateien direkt am Mac in den Ordner Friday-Wissen.`, true); continue; }
      status(`Lade ${f.name} hoch und lese sie ein …`);
      try { daten = await json("/api/dokwissen/upload", { body: { name: f.name, data: await alsBase64(f) } }); ok++; zeichne(); } catch (err) { status(`${f.name}: ${err.message}`, true); }
    }
    if (ok) status(`${ok} Datei${ok > 1 ? "en" : ""} hinzugefügt. Du kannst jetzt danach fragen.`);
  });
  $("#dk-ordner").addEventListener("click", async () => { try { const r = await json("/api/dokwissen/ordner", { body: {} }); status(r.error || "Der Ordner ist am Mac offen."); } catch (err) { status(err.message, true); } });
  $("#dk-scan").addEventListener("click", async () => { status("Lese alles neu ein …"); try { daten = await json("/api/dokwissen/einlesen", { body: { alles: true } }); zeichne(); status("Fertig eingelesen."); } catch (err) { status(err.message, true); } });

  const style = document.createElement("style");
  style.textContent = `
.dk-box { width: min(900px, 100%); }
.dk-antwort { margin: 0; font-size: 15.5px; line-height: 1.55; white-space: pre-wrap; }
.dk-treffer .icon { font-weight: 700; color: var(--cyan); font-size: 15px; }
.dk-text { max-height: 46vh; overflow-y: auto; font-size: 14px; line-height: 1.55; }
.dk-text p { margin: 0 0 10px; white-space: pre-wrap; }
.dk-seite { display: block; color: var(--cyan); font-size: 12px; letter-spacing: .08em; margin-top: 8px; }
#dk-info code { font-size: 11.5px; word-break: break-all; }`;
  document.head.appendChild(style);

  window.FridayDokwissen = { open: (opts) => w.auf(opts), offen: w.offen };
})();
