// F.R.Ai.D.A.Y Ideen-Schmiede (v1.106.0)
// Würfeln (Alltag, Kreativität, Nischen-Business, Technik), eigene Idee ehrlich prüfen, im Ideen-Tresor
// aufheben und Schritt für Schritt vorantreiben. Ohne Claude; „Mit KI ausarbeiten“ braucht Guthaben.
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  let wurf = null, check = null, tresor = [], bereich = "";
  const STATUS = { idee: "💭 Idee", test: "🧪 Test", umsetzung: "🚀 Umsetzung", erledigt: "✅ Erledigt", verworfen: "🗄 Verworfen" };

  const w = H.fenster({
    id: "ideen", titel: "💡 Ideen-Schmiede",
    html: `
      <div class="hf-zwei">
        <div class="hf-karte">
          <h3>🎲 Ideen würfeln</h3>
          <div class="hf-tabs" id="id-bereich">
            <button class="hf-tab an" data-b="">Alles</button><button class="hf-tab" data-b="alltag">🏡 Alltag</button><button class="hf-tab" data-b="kreativ">🎨 Kreativität</button><button class="hf-tab" data-b="nische">💼 Nischen-Business</button><button class="hf-tab" data-b="technik">🛠 Technik</button>
          </div>
          <div id="id-wurf" style="margin-top:10px"><div class="hf-leer">Tipp auf Würfeln.</div></div>
          <div class="hf-reihe" style="margin-top:8px"><button id="id-wuerfeln" class="hf-btn haupt" type="button">🎲 Würfeln</button><button id="id-wurf-merken" class="hf-btn" type="button" disabled>⭐ In den Tresor</button></div>
        </div>
        <div class="hf-karte">
          <h3>🔍 Meine Idee prüfen</h3>
          <label class="hf-feld"><textarea id="id-text" placeholder="Beschreib deine Idee: Was ist das Problem, für wen, und wie verdienst du Geld?"></textarea></label>
          <div class="hf-reihe" style="margin-top:8px"><button id="id-pruefen" class="hf-btn haupt" type="button">Schnell-Check</button><button id="id-ki" class="hf-btn ki" type="button">🤖 Mit KI ausarbeiten</button><button id="id-merken" class="hf-btn" type="button">⭐ Speichern</button></div>
          <div id="id-check"></div>
        </div>
      </div>
      <div id="id-status" class="hf-status">Sag auch: „Friday, gib mir eine Start-up-Idee“ oder „Merk dir die Idee: …“</div>
      <div class="hf-karte"><h3>🔐 Ideen-Tresor</h3><div id="id-tresor" class="hf-liste"></div></div>`,
    onOpen: (opts) => { laden(); if (opts?.wurf) { wurf = opts.wurf; zeigeWurf(); } },
  });
  const $ = (s) => w.$(s);
  const status = (t, f = false) => { const s = $("#id-status"); s.textContent = t; s.classList.toggle("fehler", f); };

  async function laden() {
    try {
      tresor = (await json("/api/ideen")).tresor || [];
      $("#id-tresor").innerHTML = tresor.length ? tresor.map((i) => `
        <div class="hf-zeile" data-id="${esc(i.id)}" style="align-items:flex-start"><span class="name"><b>${esc(i.titel)}</b>${i.check ? ` <span class="hf-badge ${i.check.punkte >= 4 ? "hf-gut" : i.check.punkte >= 2 ? "hf-warn" : "hf-schlecht"}">${i.check.punkte}/${i.check.max}</span>` : ""}<br><span class="klein">${esc(i.text.slice(0, 220))}</span></span>
        <select class="hf-mini" data-status aria-label="Stand">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${i.status === k ? " selected" : ""}>${v}</option>`).join("")}</select>
        <button class="hf-mini" data-del title="Löschen">✕</button></div>`).join("") : `<div class="hf-leer">Noch leer. Würfel eine Idee oder speichere deine eigene.</div>`;
    } catch (err) { status(err.message, true); }
  }
  $("#id-bereich").addEventListener("click", (e) => {
    const b = e.target.closest("[data-b]"); if (!b) return;
    bereich = b.dataset.b;
    w.$$("#id-bereich .hf-tab").forEach((x) => x.classList.toggle("an", x === b));
  });
  function zeigeWurf() {
    $("#id-wurf").innerHTML = `<b style="font-size:17px">${esc(wurf.titel)}</b><p class="hf-hinweis" style="margin:6px 0">${esc(wurf.pitch)}</p>
      <p class="hf-hinweis" style="margin:0">👣 Erster Schritt: ${esc(wurf.schritt)}<br>💶 Startkosten: ${esc(wurf.kosten)}</p>`;
    $("#id-wurf-merken").disabled = false;
  }
  $("#id-wuerfeln").addEventListener("click", async () => {
    try { wurf = await json(`/api/ideen/wuerfeln?bereich=${encodeURIComponent(bereich)}`); zeigeWurf(); } catch (err) { status(err.message, true); }
  });
  $("#id-wurf-merken").addEventListener("click", async () => {
    if (!wurf) return;
    try { await json("/api/ideen", { body: { titel: wurf.titel, text: `${wurf.pitch}\nErster Schritt: ${wurf.schritt}`, bereich: wurf.bereich } }); status("Im Tresor."); laden(); } catch (err) { status(err.message, true); }
  });
  $("#id-pruefen").addEventListener("click", async () => {
    try {
      check = await json("/api/ideen/pruefen", { body: { text: $("#id-text").value } });
      $("#id-check").innerHTML = `<p style="margin:10px 0 6px"><b>${check.punkte} von ${check.max}</b> – ${esc(check.urteil)}</p>
        <ul class="hf-liste">${check.ergebnis.map((c) => `<li class="hf-zeile"><span class="icon ${c.ok ? "hf-gut" : "hf-schlecht"}">${c.ok ? "✓" : "✗"}</span><span class="name">${esc(c.titel)}${c.ok ? "" : `<br><span class="klein">${esc(c.tipp)}</span>`}</span></li>`).join("")}</ul>
        ${check.risiken.length ? `<p class="hf-hinweis" style="margin-top:8px"><b>⚠ Achtung:</b> ${check.risiken.map(esc).join(" ")}</p>` : ""}
        <p class="hf-hinweis"><b>👣 Nächste Schritte:</b> ${check.schritte.map((s, i) => `${i + 1}. ${esc(s)}`).join(" ")}</p>`;
      status("");
    } catch (err) { status(err.message, true); }
  });
  $("#id-merken").addEventListener("click", async () => {
    const text = $("#id-text").value.trim();
    if (text.length < 6) { status("Erst die Idee beschreiben.", true); return; }
    try { await json("/api/ideen", { body: { titel: text.split(/[.!?\n]/)[0].slice(0, 80), text, check } }); status("Im Tresor gespeichert."); laden(); } catch (err) { status(err.message, true); }
  });
  $("#id-ki").addEventListener("click", async () => {
    const text = $("#id-text").value.trim();
    if (text.length < 6) { status("Erst die Idee beschreiben.", true); return; }
    const b = $("#id-ki"); b.disabled = true; status("Claude arbeitet die Idee aus …");
    try {
      const k = await json("/api/ideen/ausarbeiten", { body: { titel: text.split(/[.!?\n]/)[0], text } });
      const zeile = (t, v) => (v ? `<li><b>${t}:</b> ${esc(Array.isArray(v) ? v.join(" · ") : v)}</li>` : "");
      $("#id-check").innerHTML = k.frei ? `<p class="hf-hinweis" style="white-space:pre-wrap">${esc(k.frei)}</p>` : `<ul class="hf-hinweis" style="padding-left:18px;margin:10px 0">${zeile("Problem", k.problem)}${zeile("Zielgruppe", k.zielgruppe)}${zeile("Lösung", k.loesung)}${zeile("Preis", k.preis)}${zeile("Erste Kunden", k.erste_kunden)}${zeile("Test in 7 Tagen", k.test_in_7_tagen)}${zeile("Kosten", k.kosten)}${zeile("Risiken", k.risiken)}${zeile("Namensideen", k.namen)}${zeile("Ehrliche Meinung", k.ehrliche_meinung)}</ul>`;
      status("");
    } catch (err) { status(err.status === 402 ? "Fridays Guthaben ist leer – Ausarbeiten braucht Claude. Der Schnell-Check läuft ohne." : err.message, true); }
    finally { b.disabled = false; }
  });
  $("#id-tresor").addEventListener("click", async (e) => {
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    try { await json(`/api/ideen/${encodeURIComponent(id)}`, { method: "DELETE" }); laden(); } catch (err) { status(err.message, true); }
  });
  $("#id-tresor").addEventListener("change", async (e) => {
    if (!e.target.matches("[data-status]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    const i = tresor.find((x) => x.id === id);
    try { await json("/api/ideen", { body: { ...i, status: e.target.value } }); } catch (err) { status(err.message, true); }
  });

  window.FridayIdeen = { open: (opts) => w.auf(opts), offen: w.offen };
})();
