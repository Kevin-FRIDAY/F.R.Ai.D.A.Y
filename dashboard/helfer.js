// F.R.Ai.D.A.Y Helfer-Paket (v1.106.0) – gemeinsame Bausteine für
// Kühlschrank, Kaufberater, Advocatus Diaboli, Stimmungs-Sound und Ideen-Schmiede.
// Stil: Schwarz + Neon-Orange-Glas wie der Rest (Variablen --u-* aus style.css).
(() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /** Baut ein Fenster (Sheet) + unsichtbaren Auslöser "<id>-open" für das Werkzeug-Menü. */
  function fenster({ id, titel, klasse = "", html = "", onOpen }) {
    const sheet = document.createElement("section");
    sheet.id = id;
    sheet.className = "sheet hidden";
    sheet.setAttribute("aria-label", titel.replace(/<[^>]+>/g, ""));
    sheet.innerHTML = `<div class="panel sheet-box hf-box ${klasse}" lang="de">
      <header class="sheet-top"><h2>${titel}</h2><button id="${id}-x" class="ghost small" aria-label="Schließen">✕</button></header>
      <div class="hf-inhalt">${html}</div></div>`;
    (document.getElementById("app") || document.body).appendChild(sheet);
    const trigger = document.createElement("button");
    trigger.id = `${id}-open`; trigger.className = "hidden"; trigger.setAttribute("aria-hidden", "true"); trigger.tabIndex = -1;
    document.body.appendChild(trigger);
    const zu = () => sheet.classList.add("hidden");
    const auf = (...a) => { sheet.classList.remove("hidden"); onOpen?.(...a); };
    sheet.querySelector(`#${id}-x`).addEventListener("click", zu);
    sheet.addEventListener("click", (e) => { if (e.target === sheet) zu(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.classList.contains("hidden")) zu(); });
    trigger.addEventListener("click", () => auf());
    return { sheet, auf, zu, offen: () => !sheet.classList.contains("hidden"), $: (sel) => sheet.querySelector(sel), $$: (sel) => [...sheet.querySelectorAll(sel)] };
  }

  async function json(pfad, opts = {}) {
    const api = window.Friday?.api;
    if (!api) throw new Error("Nicht angemeldet");
    const r = await api(pfad, opts.body !== undefined ? { method: opts.method || "POST", body: JSON.stringify(opts.body) } : { method: opts.method || "GET" });
    let d = {};
    try { d = await r.json(); } catch { /* leer */ }
    if (!r.ok) {
      const e = new Error(d.error || `Fehler ${r.status}`);
      e.status = r.status;
      throw e;
    }
    return d;
  }

  // Lesezeichen ("Browser-Plugin"): schickt Seitentitel + markierten Text an Friday.
  function lesezeichen(param) {
    const o = location.origin;
    return `javascript:(()=>{const s=String(getSelection()).slice(0,5000);window.open('${o}/?${param}='+encodeURIComponent(document.title.slice(0,150))+'&text='+encodeURIComponent(s)+'&url='+encodeURIComponent(location.href),'_blank')})()`;
  }
  // Beim Start: ?kauf=… oder ?gegen=… aus dem Lesezeichen abholen (einmal, dann aus der Adresse entfernen).
  const start = new URLSearchParams(location.search);
  const startWerte = {};
  for (const k of ["kauf", "gegen", "idee"]) if (start.has(k)) startWerte[k] = { titel: start.get(k) || "", text: start.get("text") || "", url: start.get("url") || "" };
  if (Object.keys(startWerte).length) { try { history.replaceState(null, "", location.pathname); } catch { /* egal */ } }
  function vonLesezeichen(k, fn) {
    if (!startWerte[k]) return;
    const w = startWerte[k];
    delete startWerte[k];
    // warten, bis angemeldet (Friday.api da ist)
    let n = 0;
    const t = setInterval(() => { if (window.Friday?.api || ++n > 40) { clearInterval(t); if (window.Friday?.api) fn(w); } }, 250);
  }

  const style = document.createElement("style");
  style.textContent = `
.hf-box { width: min(1040px, 100%); max-height: 92vh; display: flex; flex-direction: column; }
.hf-inhalt { overflow-y: auto; display: flex; flex-direction: column; gap: 14px; min-height: 0; padding-right: 2px; }
.hf-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.hf-tab { border: 1px solid var(--u-rand-soft, var(--line)); background: transparent; color: var(--muted); border-radius: 999px; padding: 7px 13px; font: inherit; font-size: 13px; cursor: pointer; }
.hf-tab.an { color: var(--text); border-color: var(--cyan); background: color-mix(in srgb, var(--cyan) 14%, transparent); box-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 30%, transparent); }
.hf-karte { border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 14px; padding: 12px 14px; background: linear-gradient(180deg, rgba(255,140,30,.06), rgba(255,140,30,.015)); }
.hf-karte h3 { margin: 0 0 8px !important; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--u-titel, var(--cyan)); }
.hf-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.hf-zwei { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.hf-feld { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--muted); }
.hf-feld input, .hf-feld textarea, .hf-feld select, .hf-input { width: 100%; box-sizing: border-box; background: rgba(0,0,0,.35); color: var(--text); border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 10px; padding: 9px 11px; font: inherit; font-size: 15px; }
.hf-feld textarea { min-height: 110px; resize: vertical; line-height: 1.45; }
.hf-feld input:focus, .hf-feld textarea:focus, .hf-input:focus { outline: 0; border-color: var(--cyan); box-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 30%, transparent); }
.hf-reihe { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.hf-reihe .grow { flex: 1; min-width: 160px; }
.hf-btn { border: 1px solid var(--u-rand, var(--cyan)); background: color-mix(in srgb, var(--cyan) 12%, transparent); color: var(--text); border-radius: 10px; padding: 9px 14px; font: inherit; font-size: 14px; cursor: pointer; }
.hf-btn:hover { background: color-mix(in srgb, var(--cyan) 22%, transparent); box-shadow: 0 0 14px color-mix(in srgb, var(--cyan) 35%, transparent); }
.hf-btn.haupt { background: linear-gradient(135deg, var(--cyan), color-mix(in srgb, var(--cyan) 60%, #ffcf7a)); color: #140900; border-color: transparent; font-weight: 700; }
.hf-btn.leise { border-color: var(--u-rand-soft, var(--line)); background: transparent; color: var(--muted); }
.hf-btn.ki::after { content: " · braucht Guthaben"; font-size: 11px; opacity: .7; }
.hf-btn:disabled { opacity: .5; cursor: wait; }
.hf-status { font-size: 13px; color: var(--muted); min-height: 18px; }
.hf-status.fehler { color: #ff6b5a; }
.hf-liste { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.hf-zeile { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.25); font-size: 14px; }
.hf-zeile .icon { font-size: 20px; width: 26px; text-align: center; flex: none; }
.hf-zeile .name { flex: 1; min-width: 0; }
.hf-zeile .klein { font-size: 12px; color: var(--muted); }
.hf-mini { border: 1px solid var(--u-rand-soft, var(--line)); background: transparent; color: var(--muted); border-radius: 8px; padding: 5px 8px; font: inherit; font-size: 12px; cursor: pointer; flex: none; }
.hf-mini:hover { color: var(--text); border-color: var(--cyan); }
.hf-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .04em; border: 1px solid currentColor; white-space: nowrap; }
.hf-gut { color: #45e38b; } .hf-warn { color: #ffc44d; } .hf-schlecht { color: #ff5a4a; } .hf-info { color: var(--muted); }
.hf-ampel { display: flex; align-items: center; gap: 14px; }
.hf-ampel .licht { width: 54px; height: 54px; border-radius: 50%; flex: none; box-shadow: 0 0 26px currentColor, inset 0 0 14px rgba(255,255,255,.35); background: currentColor; }
.hf-ampel b { font-size: 18px; }
.hf-balken { height: 8px; border-radius: 99px; background: rgba(255,255,255,.08); overflow: hidden; }
.hf-balken > i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--cyan), #ffcf7a); box-shadow: 0 0 10px var(--cyan); }
.hf-zitat { font-size: 12.5px; color: var(--muted); border-left: 2px solid var(--u-rand-soft, var(--line)); padding-left: 8px; margin: 4px 0 0; font-style: italic; }
.hf-hinweis { font-size: 12px; color: var(--muted); line-height: 1.45; }
.hf-lz { font-size: 12px; border: 1px dashed var(--u-rand-soft, var(--line)); border-radius: 10px; padding: 8px 10px; color: var(--muted); }
.hf-lz a { color: var(--cyan); font-weight: 700; text-decoration: none; border: 1px solid var(--cyan); border-radius: 8px; padding: 3px 8px; display: inline-block; margin: 4px 4px 0 0; }
.hf-leer { text-align: center; color: var(--muted); padding: 18px; font-size: 14px; }
@media (max-width: 900px) {
  .hf-box { display: block; max-height: calc(100dvh - 18px - var(--m-safe-t, 0px)); overflow-y: auto; }
  .hf-inhalt { overflow: visible; }
  .hf-zeile { flex-wrap: wrap; row-gap: 6px; }
  .hf-zeile .name { flex: 1 1 calc(100% - 46px); }
  .hf-zeile input[type="date"] { width: 124px !important; min-height: 34px; font-size: 13px; padding: 4px 6px; }
  .hf-zeile .hf-badge { font-size: 10px; padding: 2px 6px; }
  .hf-zeile .hf-mini { padding: 6px 9px; }
  .hf-reihe .grow { min-width: 100%; }
  .hf-zwei { grid-template-columns: 1fr; }
  .hf-raster { grid-template-columns: 1fr; }
  .hf-feld input, .hf-feld textarea, .hf-feld select, .hf-input { font-size: 16px; }
  .hf-ampel .licht { width: 42px; height: 42px; }
}`;
  document.head.appendChild(style);

  window.FridayHelfer = { fenster, json, esc, lesezeichen, vonLesezeichen };
})();
