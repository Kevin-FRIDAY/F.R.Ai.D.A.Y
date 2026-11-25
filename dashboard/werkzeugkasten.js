// F.R.Ai.D.A.Y – Werkzeugkasten (v1.162.0)
// Seit v1.165.0 ohne eigenes Fenster im Menü: die 100 Werkzeuge laufen per Sprache und über Claude.
// Hier bleibt nur die Ergebnis-Karte (Formular eines Werkzeugs, Tabelle, Kopieren, Herunterladen, QR-Code, Vorlesen),
// die von selbst aufgeht, wenn es etwas zu sehen gibt. Aktionen:
//   werkzeug_letzter | werkzeug_lauf:<id>:<b64> | werkzeug_offen:<id>:<b64> | werkzeugkasten (Claude)
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  let katalog = null, aktiv = null;

  // v1.165.0: Kein eigenes Werkzeugkasten-Fenster mehr (kein Menüeintrag, keine Kachel-Übersicht).
  // Die Werkzeuge laufen per Sprache und über Claude. Dieses kleine Fenster erscheint nur noch,
  // wenn ein Ergebnis etwas zu sehen hat (QR-Code, Tabelle, Datei) oder ein geheimes Werkzeug läuft.
  const f = H.fenster({
    id: "werkzeugkasten", titel: "🧰 Ergebnis", klasse: "wk-box",
    html: `
      <div id="wk-detail"></div>
      <div id="wk-status" class="hf-status"></div>`,
    onOpen: (o = {}) => start(o),
  });
  const $ = (s) => f.$(s);
  const status = (t = "", fehler = false) => { const s = $("#wk-status"); s.textContent = t; s.classList.toggle("fehler", fehler); };

  async function laden() {
    if (!katalog) katalog = await json("/api/werkzeugkasten");
    return katalog;
  }

  async function start(o = {}) {
    try { await laden(); } catch (err) { status(err.message || String(err), true); return; }
    if (o.id) return zeigeWerkzeug(o.id, { eingabe: o.eingabe, auto: o.auto, ergebnis: o.ergebnis });
    f.zu?.();
  }

  // ---------- Ein Werkzeug ----------
  const heuteIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  function feldHtml(x, wert) {
    const id = `wk-f-${x.k}`, v = wert ?? x.standard ?? "";
    const lab = `<label class="hf-feld${x.typ === "textarea" ? " breit" : ""}" for="${id}"><span>${esc(x.label)}</span>`;
    if (x.typ === "wahl") return `${lab}<select id="${id}" data-k="${esc(x.k)}">${x.optionen.map((o) => `<option${String(o) === String(v) ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
    if (x.typ === "textarea") return `${lab}<textarea id="${id}" data-k="${esc(x.k)}" placeholder="${esc(x.platzhalter || "")}">${esc(v)}</textarea></label>`;
    if (x.typ === "datum") {
      const iso = v === "heute" || v === "" ? (v === "heute" ? heuteIso() : "") : /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : (() => { const m = String(v).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : ""; })();
      return `${lab}<input id="${id}" data-k="${esc(x.k)}" type="date" value="${esc(iso)}"></label>`;
    }
    const typ = x.typ === "passwort" ? "password" : "text", mode = x.typ === "zahl" ? ' inputmode="decimal"' : "";
    return `${lab}<input id="${id}" data-k="${esc(x.k)}" type="${typ}"${mode} value="${esc(v)}" placeholder="${esc(x.platzhalter || "")}" autocomplete="off"${x.typ === "passwort" ? ' autocapitalize="off" spellcheck="false"' : ""}></label>`;
  }
  function zeigeWerkzeug(id, { eingabe = {}, auto = false, ergebnis = null } = {}) {
    const w = katalog.werkzeuge.find((x) => x.id === id);
    if (!w) { $("#wk-detail").innerHTML = ""; status(`Das Werkzeug „${id}“ gibt es nicht.`, true); return; }
    aktiv = w;
    status("");
    const d = $("#wk-detail");
    d.innerHTML = `
      <div class="hf-karte">
        <h3>${w.icon} ${esc(w.titel)}</h3>
        <p class="hf-hinweis" style="margin:0 0 10px">${esc(w.info)}${w.geheim ? " 🔒 Wird nicht gespeichert und nicht vorgelesen." : ""}${w.online ? " 🌐 Fragt einen kostenlosen Dienst im Internet." : ""}</p>
        <form id="wk-form" class="wk-form">${(w.felder || []).map((x) => feldHtml(x, eingabe?.[x.k])).join("")}
          <div class="hf-reihe wk-los"><button type="submit" class="hf-btn haupt" id="wk-start">▶ Ausführen</button></div>
        </form>
      </div>
      <div id="wk-ergebnis"></div>`;
    $("#wk-form").addEventListener("submit", (e) => { e.preventDefault(); ausfuehren(); });
    if (ergebnis) zeigeErgebnis(ergebnis);
    else if (auto || !(w.felder || []).length) ausfuehren();
    else setTimeout(() => { const erstes = f.$("#wk-form [data-k]"); if (erstes && matchMedia("(min-width: 900px)").matches) erstes.focus(); }, 60);
  }
  async function ausfuehren() {
    if (!aktiv) return;
    const eingabe = {};
    f.$$("#wk-form [data-k]").forEach((el) => { eingabe[el.dataset.k] = el.value; });
    const knopf = $("#wk-start");
    knopf.disabled = true; knopf.textContent = "… rechnet";
    try {
      const r = await json(`/api/werkzeugkasten/${encodeURIComponent(aktiv.id)}`, { body: { eingabe } });
      if (!r.ok) { $("#wk-ergebnis").innerHTML = `<div class="hf-karte wk-fehler">⚠️ ${esc(r.error || "Das hat nicht geklappt.")}</div>`; return; }
      zeigeErgebnis(r);
    } catch (err) {
      $("#wk-ergebnis").innerHTML = `<div class="hf-karte wk-fehler">⚠️ ${esc(err.message || String(err))}</div>`;
    } finally { knopf.disabled = false; knopf.textContent = "▶ Ausführen"; }
  }

  // ---------- Ergebnis ----------
  function zeigeErgebnis(r) {
    const teile = [`<p class="wk-satz">${esc(r.text || "")}</p>`];
    if (r.ergebnis != null) teile.push(`<div class="wk-aus"><pre id="wk-text">${esc(r.ergebnis)}</pre><div class="hf-reihe"><button type="button" class="hf-mini" data-kopier>📋 Kopieren</button></div></div>`);
    if (r.farben?.length) teile.push(`<div class="wk-farben">${r.farben.map((c) => `<button type="button" class="wk-farbe" style="--c:${esc(c)}" data-farbe="${esc(c)}" title="Kopieren"><i></i><span>${esc(c)}</span></button>`).join("")}</div>`);
    if (r.qr != null) teile.push(`<div class="wk-qr" id="wk-qr"></div>`);
    if (r.wichtel) teile.push(`<div class="hf-hinweis">Jede Person tippt auf ihren Namen. Danach wieder zudecken und das Gerät weitergeben.</div><div class="wk-wichtel">${r.wichtel.map(([von, an], i) => `<button type="button" class="hf-btn wk-wi" data-i="${i}" data-an="${esc(an)}">🎁 ${esc(von)}</button>`).join("")}</div>`);
    if (r.tabelle) teile.push(`<div class="wk-tab-rahmen"><table class="wk-tab"><thead><tr>${r.tabelle.kopf.map((k) => `<th>${esc(k)}</th>`).join("")}</tr></thead><tbody>${r.tabelle.zeilen.map((z) => `<tr>${z.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    if (r.zeilen?.length) teile.push(r.checkliste ? `<ul class="hf-liste wk-check">${r.zeilen.map((z, i) => `<li class="hf-zeile"><label><input type="checkbox" data-c="${i}"> ${esc(z)}</label></li>`).join("")}</ul>` : `<ul class="wk-zeilen">${r.zeilen.map((z) => `<li>${esc(z)}</li>`).join("")}</ul>`);
    if (r.diff) teile.push(`<pre class="wk-diff">${r.diff.map(([a, z]) => `<span class="d${a === "+" ? "p" : a === "−" ? "m" : "g"}">${a === "=" ? " " : a} ${esc(z)}</span>`).join("\n")}</pre>`);
    if (r.link && /^https:\/\//.test(r.link)) teile.push(`<a class="hf-btn" href="${esc(r.link)}" target="_blank" rel="noopener">🗺 Auf der Karte zeigen</a>`);
    if (r.hinweis) teile.push(`<p class="hf-hinweis">ℹ️ ${esc(r.hinweis)}</p>`);
    if (r.quelle) teile.push(`<p class="hf-hinweis">Quelle: ${esc(r.quelle)}</p>`);
    const knoepfe = [];
    if (r.datei) knoepfe.push(`<button type="button" class="hf-btn" data-datei>⬇ ${esc(r.datei.name)}</button>`);
    if (r.checkliste) knoepfe.push(`<button type="button" class="hf-mini" data-alle-kopier>📋 Liste kopieren</button>`);
    if (!r.geheimesErgebnis && r.text && window.Friday?.say) knoepfe.push(`<button type="button" class="hf-mini" data-sag>🔊 Vorlesen</button>`);
    if (knoepfe.length) teile.push(`<div class="hf-reihe">${knoepfe.join("")}</div>`);
    const el = $("#wk-ergebnis");
    el.innerHTML = `<div class="hf-karte wk-erg"><h3>Ergebnis</h3>${teile.join("")}</div>`;
    if (r.qr != null) qrZeichnen($("#wk-qr"), r.qr);
    el.querySelector("[data-kopier]")?.addEventListener("click", () => kopiere(String(r.ergebnis)));
    el.querySelector("[data-alle-kopier]")?.addEventListener("click", () => kopiere(r.zeilen.map((z) => `☐ ${z}`).join("\n")));
    el.querySelector("[data-sag]")?.addEventListener("click", () => window.Friday.say(r.text));
    el.querySelector("[data-datei]")?.addEventListener("click", () => herunterladen(r.datei));
    el.querySelectorAll("[data-farbe]").forEach((b) => b.addEventListener("click", () => kopiere(b.dataset.farbe)));
    el.querySelectorAll(".wk-wi").forEach((b) => b.addEventListener("click", () => {
      const auf = b.classList.toggle("auf");
      b.textContent = auf ? `🎁 ${b.textContent.replace(/^🎁 /, "").split(" → ")[0]} → ${b.dataset.an}` : `🎁 ${b.textContent.replace(/^🎁 /, "").split(" → ")[0]}`;
    }));
    // Nur den inneren Bereich scrollen (scrollIntoView verschiebt auf dem iPhone sonst das ganze Blatt samt Kopf).
    try {
      let box = el.parentElement;
      while (box && !(box.scrollHeight > box.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
      if (box) {
        const unten = el.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom;
        if (unten > 0) box.scrollBy({ top: Math.min(unten + 12, el.getBoundingClientRect().top - box.getBoundingClientRect().top - 8), behavior: "smooth" });
      }
    } catch { /* egal */ }
  }
  async function kopiere(t) {
    try { await navigator.clipboard.writeText(t); status("In die Zwischenablage kopiert ✓"); }
    catch { status("Kopieren ging nicht – bitte markieren und von Hand kopieren.", true); }
    setTimeout(() => status(""), 2500);
  }
  function herunterladen(d) {
    try {
      const url = URL.createObjectURL(new Blob([d.inhalt], { type: `${d.typ || "text/plain"};charset=utf-8` }));
      const a = Object.assign(document.createElement("a"), { href: url, download: d.name || "datei.txt" });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) { status(err.message, true); }
  }
  function qrZeichnen(ziel, inhalt) {
    const q = window.qrcode;
    if (!q) { ziel.innerHTML = '<div class="hf-leer">Der QR-Baustein fehlt. Bitte die Seite neu laden.</div>'; return; }
    try {
      q.stringToBytes = q.stringToBytesFuncs["UTF-8"];
      const c = q(0, "M");
      c.addData(inhalt, "Byte");
      c.make();
      const url = c.createDataURL(8, 4);
      ziel.innerHTML = `<img src="${url}" alt="QR-Code" width="${c.getModuleCount() * 8 + 32}"><a class="hf-mini" href="${url}" download="qr-code.gif">⬇ Bild speichern</a>`;
    } catch (err) { ziel.innerHTML = `<div class="hf-leer">Zu viel Text für einen QR-Code (${esc(err.message || err)}).</div>`; }
  }

  // ---------- Von außen (Sprache, Claude) ----------
  const ausB64 = (s) => { try { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))))); } catch { return {}; } };
  async function vonAussen(actions = []) {
    const a = (p) => actions.find((x) => typeof x === "string" && x.startsWith(p));
    const lauf = a("werkzeug_lauf:"), offen = a("werkzeug_offen:");
    if (lauf || offen) { const [, id, b] = (lauf || offen).split(":"); f.auf({ id, eingabe: ausB64(b || ""), auto: !!lauf }); return; }
    if (actions.includes("werkzeug_letzter") || actions.includes("werkzeugkasten")) {
      // Claude oder Sprache: nur öffnen, wenn es etwas zu sehen gibt (Liste, QR, Datei) oder ein geheimes Werkzeug wartet.
      try {
        const { letzter } = await json("/api/werkzeugkasten/letzter");
        if (!letzter || Date.now() - letzter.at > 120000) return;
        if (letzter.starten) f.auf({ id: letzter.id, eingabe: letzter.eingabe, auto: true });
        else if (letzter.ergebnis?.zeigen) f.auf({ id: letzter.id, eingabe: letzter.eingabe, ergebnis: letzter.ergebnis });
      } catch { /* egal */ }
    }
  }
  window.FridayWerkzeugkasten = { open: (o) => f.auf(o), vonAussen };

  const style = document.createElement("style");
  style.textContent = `
.wk-box { width: min(1100px, 100%); }
.wk-form { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; align-items: end; }
.wk-form .breit { grid-column: 1 / -1; }
.wk-los { grid-column: 1 / -1; }
.wk-satz { font-size: 17px; line-height: 1.5; margin: 0 0 10px; color: var(--text); }
.wk-aus pre, .wk-diff { white-space: pre-wrap; word-break: break-word; background: rgba(0,0,0,.4); border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 10px; padding: 10px 12px; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; max-height: 360px; overflow: auto; margin: 0 0 8px; }
.wk-diff .dp { color: #45e38b; } .wk-diff .dm { color: #ff6b5a; text-decoration: line-through; } .wk-diff .dg { color: var(--muted); }
.wk-tab-rahmen { overflow-x: auto; margin: 6px 0 10px; }
.wk-tab { width: 100%; border-collapse: collapse; font-size: 13px; }
.wk-tab th { text-align: left; color: var(--u-titel, var(--cyan)); font-weight: 600; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid var(--u-rand, var(--cyan)); }
.wk-tab td { padding: 6px 8px; border-bottom: 1px solid var(--u-rand-soft, var(--line)); vertical-align: top; word-break: break-word; }
.wk-tab tr:last-child td { border-bottom: 0; }
.wk-zeilen { margin: 4px 0 10px; padding-left: 18px; font-size: 14px; line-height: 1.6; }
.wk-check label { display: flex; gap: 8px; align-items: center; cursor: pointer; width: 100%; }
.wk-check input:checked + * , .wk-check label:has(input:checked) { color: var(--muted); text-decoration: line-through; }
.wk-farben { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 10px; }
.wk-farbe { border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.3); color: var(--text); border-radius: 10px; padding: 6px; font: inherit; font-size: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.wk-farbe i { width: 58px; height: 40px; border-radius: 7px; background: var(--c); box-shadow: 0 0 12px var(--c); }
.wk-qr { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin: 4px 0 10px; }
.wk-qr img { background: #fff; border-radius: 12px; padding: 8px; max-width: min(320px, 100%); height: auto; image-rendering: pixelated; box-shadow: 0 0 24px color-mix(in srgb, var(--cyan) 35%, transparent); }
.wk-wichtel { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
.wk-wi.auf { border-color: #45e38b; color: #45e38b; }
.wk-fehler { color: #ffb4a8; }
@media (max-width: 900px) {
  .wk-form { grid-template-columns: 1fr; }
  .wk-satz { font-size: 16px; }
}`;
  document.head.appendChild(style);
})();
