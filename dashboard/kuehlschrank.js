// F.R.Ai.D.A.Y Kühlschrank- & Reste-Regisseur (v1.106.0)
// Kassenbon fotografieren → Friday erkennt die Lebensmittel und schätzt, wann sie ablaufen →
// Rezepte, die zuerst das verwerten, was bald schlecht wird → Fehlendes auf die Einkaufsliste.
// Texterkennung läuft im Browser (Tesseract, kostenlos). Nur „KI liest den Bon“ braucht Guthaben.
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  let daten = { vorrat: [], rezepte: [], statistik: {} };
  let vorschau = [];
  let bonBild = null;
  let tab = "vorrat";

  const w = H.fenster({
    id: "kuehl", titel: "🧊 Kühlschrank &amp; Reste-Regisseur", klasse: "kh-box",
    html: `
      <div class="hf-tabs" role="tablist">
        <button class="hf-tab an" data-tab="vorrat">🧊 Vorrat</button>
        <button class="hf-tab" data-tab="bon">🧾 Kassenbon</button>
        <button class="hf-tab" data-tab="rezepte">🍳 Rezepte</button>
      </div>
      <div id="kh-status" class="hf-status">Sag zum Beispiel: „Friday, was muss weg?“ oder „Was kann ich kochen?“</div>
      <section data-seite="vorrat">
        <form id="kh-neu" class="hf-reihe" autocomplete="off">
          <input id="kh-name" class="hf-input grow" type="text" placeholder="Was ist neu im Kühlschrank? z. B. Milch, Eier" enterkeyhint="done" aria-label="Lebensmittel">
          <input id="kh-datum" class="hf-input" type="date" style="width:auto" aria-label="Ablaufdatum (optional)" title="Ablaufdatum (leer = Friday schätzt)">
          <button class="hf-btn haupt" type="submit">＋ Einräumen</button>
        </form>
        <div id="kh-vorrat" class="hf-liste" style="margin-top:12px"></div>
        <div id="kh-stat" class="hf-hinweis" style="margin-top:10px"></div>
      </section>
      <section data-seite="bon" class="hidden">
        <div class="hf-zwei">
          <div class="hf-karte">
            <h3>1 · Bon fotografieren</h3>
            <label class="hf-btn haupt" style="display:inline-block;text-align:center">📷 Foto vom Kassenbon<input id="kh-foto" type="file" accept="image/*" capture="environment" hidden></label>
            <img id="kh-vor" alt="" style="display:none;max-width:100%;max-height:220px;margin-top:10px;border-radius:10px;border:1px solid var(--u-rand-soft)">
            <div class="hf-balken" style="margin-top:10px"><i id="kh-ocr" style="width:0%"></i></div>
            <div class="hf-reihe" style="margin-top:10px">
              <button id="kh-ki" class="hf-btn ki" type="button" disabled>🤖 KI liest den Bon</button>
            </div>
            <p class="hf-hinweis">Die Texterkennung läuft kostenlos direkt auf deinem Gerät (beim ersten Mal lädt sie kurz). Klappt das schlecht, nimm „KI liest den Bon“ oder tipp den Text ab.</p>
          </div>
          <div class="hf-karte">
            <h3>2 · Erkannter Text</h3>
            <label class="hf-feld"><textarea id="kh-bontext" placeholder="Hier steht der Bon-Text. Du kannst ihn auch selbst einfügen oder korrigieren."></textarea></label>
            <button id="kh-lesen" class="hf-btn" type="button" style="margin-top:8px">🔎 Lebensmittel erkennen</button>
          </div>
        </div>
        <div class="hf-karte" id="kh-vorschau-k" style="display:none">
          <h3>3 · Prüfen &amp; einräumen</h3>
          <div id="kh-vorschau" class="hf-liste"></div>
          <div id="kh-unbekannt" class="hf-hinweis" style="margin-top:8px"></div>
          <button id="kh-uebernehmen" class="hf-btn haupt" type="button" style="margin-top:10px">✓ In den Kühlschrank</button>
        </div>
      </section>
      <section data-seite="rezepte" class="hidden">
        <div id="kh-rezepte" class="hf-raster"></div>
        <p class="hf-hinweis">Friday sortiert die Rezepte danach, was zuerst schlecht wird. Salz, Pfeffer, Öl und Zucker setzt sie als vorhanden voraus.</p>
      </section>`,
    onOpen: (opts) => { laden(); if (opts?.tab) zeigeTab(opts.tab); },
  });
  const $ = (s) => w.$(s);
  const status = (t, f = false) => { const s = $("#kh-status"); s.textContent = t; s.classList.toggle("fehler", f); };

  function zeigeTab(t) {
    tab = t;
    w.$$(".hf-tab").forEach((b) => b.classList.toggle("an", b.dataset.tab === t));
    w.$$("[data-seite]").forEach((s) => s.classList.toggle("hidden", s.dataset.seite !== t));
  }
  w.sheet.querySelector(".hf-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) zeigeTab(b.dataset.tab); });

  const tageText = (t) => (t == null ? "" : t < 0 ? `seit ${-t} ${-t === 1 ? "Tag" : "Tagen"} abgelaufen` : t === 0 ? "läuft heute ab" : t === 1 ? "läuft morgen ab" : t > 300 ? "lange haltbar" : `noch ${t} Tage`);
  const tageKlasse = (t) => (t == null ? "hf-info" : t <= 0 ? "hf-schlecht" : t <= 2 ? "hf-warn" : "hf-gut");

  async function laden() {
    try {
      daten = await json("/api/kuehlschrank");
      zeichne();
    } catch (err) { status(err.message, true); }
  }
  function zeichne() {
    const v = daten.vorrat || [];
    $("#kh-vorrat").innerHTML = v.length ? v.map((x) => `
      <div class="hf-zeile" data-id="${esc(x.id)}">
        <span class="icon">${esc(x.icon || "🍽")}</span>
        <span class="name">${esc(x.name)}${x.menge > 1 ? ` <span class="klein">× ${x.menge}</span>` : ""}<br><span class="klein">${esc(x.kategorie || "")}</span></span>
        <span class="hf-badge ${tageKlasse(x.tage)}">${esc(tageText(x.tage))}</span>
        <input type="date" class="hf-mini kh-d" value="${esc(x.ablauf)}" aria-label="Ablaufdatum ändern" style="width:auto">
        <button class="hf-mini" data-weg="verbraucht" title="Aufgebraucht">✓</button>
        <button class="hf-mini" data-weg="weg" title="Weggeworfen">🗑</button>
      </div>`).join("") : `<div class="hf-leer">Noch leer. Fotografier einen Kassenbon oder trag oben ein, was du gekauft hast.</div>`;
    const s = daten.statistik || {};
    const summe = (s.verbraucht || 0) + (s.weggeworfen || 0);
    $("#kh-stat").textContent = summe ? `Bilanz: ${s.verbraucht || 0} aufgegessen, ${s.weggeworfen || 0} weggeworfen (${Math.round(((s.verbraucht || 0) / summe) * 100)} % gerettet).` : "";
    const r = daten.rezepte || [];
    $("#kh-rezepte").innerHTML = r.length ? r.map((x, i) => `
      <div class="hf-karte">
        <h3>${esc(x.icon)} ${esc(x.name)}</h3>
        <div class="klein hf-hinweis">⏱ ${x.minuten} Min.${x.rettet.length ? ` · <span class="hf-warn">rettet ${esc(x.rettet.join(", "))}</span>` : ""}</div>
        <div class="hf-hinweis" style="margin-top:6px">✓ Da: ${esc(x.genutzt.join(", "))}</div>
        ${x.fehlt.length ? `<div class="hf-hinweis hf-schlecht">✗ Fehlt: ${esc(x.fehlt.join(", "))}</div>` : `<div class="hf-hinweis hf-gut">Alles da!</div>`}
        <details style="margin-top:6px"><summary class="hf-hinweis" style="cursor:pointer">So geht's</summary><ol class="hf-hinweis" style="padding-left:18px;margin:6px 0">${x.schritte.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></details>
        <div class="hf-reihe" style="margin-top:8px">
          ${x.fehlt.length ? `<button class="hf-mini" data-einkauf="${i}">🛒 Fehlendes auf die Liste</button>` : ""}
          <button class="hf-mini" data-sprich="${i}">🔊 Vorlesen</button>
        </div>
      </div>`).join("") : `<div class="hf-leer">Sobald etwas im Kühlschrank ist, schlägt Friday hier Rezepte vor.</div>`;
  }

  // Vorrat bedienen
  $("#kh-neu").addEventListener("submit", async (e) => {
    e.preventDefault();
    const namen = $("#kh-name").value.split(/,| und /).map((s) => s.trim()).filter(Boolean);
    if (!namen.length) return;
    const ablauf = $("#kh-datum").value;
    try {
      const r = await json("/api/kuehlschrank/vorrat", { body: { posten: namen.map((name) => ({ name, ablauf })) } });
      status(`Eingeräumt: ${r.neu.map((x) => x.name).join(", ")}`);
      $("#kh-name").value = ""; $("#kh-datum").value = "";
      laden();
    } catch (err) { status(err.message, true); }
  });
  $("#kh-vorrat").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-weg]");
    if (!b) return;
    const id = b.closest("[data-id]").dataset.id;
    try { await json(`/api/kuehlschrank/vorrat/${encodeURIComponent(id)}?grund=${b.dataset.weg}`, { method: "DELETE" }); laden(); } catch (err) { status(err.message, true); }
  });
  $("#kh-vorrat").addEventListener("change", async (e) => {
    if (!e.target.classList.contains("kh-d")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    try { await json(`/api/kuehlschrank/vorrat/${encodeURIComponent(id)}`, { method: "PATCH", body: { ablauf: e.target.value } }); laden(); } catch (err) { status(err.message, true); }
  });
  $("#kh-rezepte").addEventListener("click", async (e) => {
    const k = e.target.closest("[data-einkauf]");
    const s = e.target.closest("[data-sprich]");
    if (k) {
      const r = daten.rezepte[+k.dataset.einkauf];
      try {
        const d = await json("/api/kuehlschrank/einkaufen", { body: { namen: r.fehlt } });
        k.textContent = d.neu.length ? `✓ ${d.neu.join(", ")} auf der Liste` : "✓ Steht schon drauf";
        k.disabled = true;
      } catch (err) { status(err.message, true); }
    }
    if (s) {
      const r = daten.rezepte[+s.dataset.sprich];
      window.Friday?.say?.(`${r.name}. ${r.schritte.join(" ")}`);
    }
  });

  // ---------- Kassenbon ----------
  let tesseract = null;
  function ladeTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseract) return tesseract;
    tesseract = new Promise((ok, nein) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
      s.onload = () => ok(window.Tesseract);
      s.onerror = () => { tesseract = null; nein(new Error("Die Texterkennung konnte nicht geladen werden (Internet?). Nimm „KI liest den Bon“ oder tipp den Text ein.")); };
      document.head.appendChild(s);
    });
    return tesseract;
  }
  function verkleinern(datei, max = 1600) {
    return new Promise((ok, nein) => {
      const img = new Image();
      img.onload = () => {
        const f = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
        const g = c.getContext("2d");
        g.filter = "grayscale(1) contrast(1.35)";
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        ok(c);
      };
      img.onerror = () => nein(new Error("Das Bild ließ sich nicht öffnen."));
      img.src = URL.createObjectURL(datei);
    });
  }
  $("#kh-foto").addEventListener("change", async (e) => {
    const datei = e.target.files?.[0];
    e.target.value = "";
    if (!datei) return;
    const bar = $("#kh-ocr");
    try {
      const c = await verkleinern(datei);
      bonBild = { mediaType: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] };
      $("#kh-vor").src = c.toDataURL("image/jpeg", 0.7); $("#kh-vor").style.display = "block";
      $("#kh-ki").disabled = false;
      status("Lese den Bon … (beim ersten Mal lädt die Texterkennung, das dauert etwas)");
      bar.style.width = "5%";
      const T = await ladeTesseract();
      const worker = await T.createWorker("deu", 1, { logger: (m) => { if (m.status === "recognizing text") bar.style.width = `${Math.round(10 + m.progress * 90)}%`; } });
      const { data } = await worker.recognize(c);
      await worker.terminate();
      bar.style.width = "100%";
      $("#kh-bontext").value = data.text || "";
      await erkennen();
    } catch (err) { status(err.message, true); bar.style.width = "0%"; }
  });
  $("#kh-ki").addEventListener("click", async () => {
    if (!bonBild) return;
    const b = $("#kh-ki"); b.disabled = true;
    status("Claude liest den Bon …");
    try {
      const d = await json("/api/kuehlschrank/bon-ki", { body: { image: bonBild } });
      $("#kh-bontext").value = d.text || "";
      zeigeVorschau(d);
    } catch (err) { status(err.status === 402 ? "Fridays Guthaben ist leer. Die kostenlose Texterkennung oder Abtippen klappt trotzdem." : err.message, true); }
    finally { b.disabled = false; }
  });
  $("#kh-lesen").addEventListener("click", () => erkennen());
  async function erkennen() {
    const text = $("#kh-bontext").value.trim();
    if (!text) { status("Kein Bon-Text da.", true); return; }
    try { zeigeVorschau(await json("/api/kuehlschrank/bon", { body: { text } })); } catch (err) { status(err.message, true); }
  }
  function zeigeVorschau(d) {
    vorschau = d.posten || [];
    $("#kh-vorschau-k").style.display = "block";
    $("#kh-vorschau").innerHTML = vorschau.length ? vorschau.map((p, i) => `
      <label class="hf-zeile"><input type="checkbox" checked data-i="${i}"><span class="icon">${esc(p.icon)}</span>
      <span class="name">${esc(p.name)}${p.menge > 1 ? ` × ${p.menge}` : ""}<br><span class="klein">Bon: ${esc(p.bon)}</span></span>
      <input type="date" class="hf-mini" value="${esc(p.ablauf)}" data-d="${i}" aria-label="Ablaufdatum" style="width:auto"></label>`).join("") : `<div class="hf-leer">Keine Lebensmittel erkannt. Korrigier den Text oder trag sie im Reiter Vorrat ein.</div>`;
    $("#kh-unbekannt").textContent = d.unbekannt?.length ? `Nicht erkannt (bitte selbst eintragen, falls es Essen ist): ${d.unbekannt.slice(0, 12).join(" · ")}` : "";
    status(vorschau.length ? `${vorschau.length} Lebensmittel erkannt. Daten prüfen und einräumen.` : "Nichts erkannt.");
  }
  $("#kh-uebernehmen").addEventListener("click", async () => {
    const posten = vorschau.map((p, i) => ({ ...p, an: w.$(`[data-i="${i}"]`)?.checked, ablauf: w.$(`[data-d="${i}"]`)?.value || p.ablauf })).filter((p) => p.an);
    if (!posten.length) return;
    try {
      await json("/api/kuehlschrank/vorrat", { body: { posten, quelle: "kassenbon" } });
      status(`${posten.length} Lebensmittel eingeräumt.`);
      $("#kh-vorschau-k").style.display = "none";
      $("#kh-bontext").value = "";
      await laden();
      zeigeTab("vorrat");
    } catch (err) { status(err.message, true); }
  });

  window.FridayKuehl = { open: (opts) => w.auf(opts), offen: w.offen, refresh: () => w.offen() && laden() };
})();
