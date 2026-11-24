// F.R.Ai.D.A.Y – Fridays Datenbank im Stil von Fridays Gehirn (v1.130.0)
// Oben ein gebogener Glas-Bildschirm wie beim KI-Kern: links der Datenkern (echte Zahlen) und „Wissen eintragen“,
// in der Mitte die Speicher-Karte (jede Quelle ein leuchtender Knoten, Größe = Anzahl, antippen = filtern),
// rechts Aktivität der letzten 30 Tage, häufige Themen (antippen = suchen) und der Rückblick.
// Darunter Suche, Filter und Liste (app.js). Alle Zahlen kommen aus /api/wissen/uebersicht – nichts ist ausgedacht.
(() => {
  "use strict";
  const F = window.Friday || {};
  const api = F.api;
  if (!api) return;
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const $ = (id) => document.getElementById(id);
  const zahl = (n) => Number(n || 0).toLocaleString("de-DE");
  const mb = (b) => (b >= 1048576 ? `${(b / 1048576).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const datum = (s) => (s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–");

  const style = document.createElement("style");
  style.textContent = `
.db-box { width: min(1180px, 100%); }
.db-top { gap: 14px; align-items: center; }
.db-unter { font: 500 12.5px ui-monospace, Menlo, monospace; color: var(--cyan); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-screen { perspective: 1500px; padding: 2px 2px 4px; margin-bottom: 10px; }
.db-screen-in { position: relative; display: grid; grid-template-columns: minmax(200px, .95fr) minmax(280px, 1.35fr) minmax(220px, 1fr); gap: 14px; padding: 14px 16px 16px;
  border-radius: 26px 26px 18px 18px / 30px 30px 18px 18px; border: 1px solid var(--u-rand, rgba(255,138,30,.55));
  background: radial-gradient(ellipse at 50% 0%, rgba(255,138,30,.12), transparent 60%), linear-gradient(180deg, rgba(28,16,6,.9), rgba(10,7,4,.92));
  box-shadow: 0 0 0 1px rgba(255,138,30,.08), 0 0 40px rgba(255,138,30,.14), inset 0 0 50px rgba(255,138,30,.06); transform: rotateX(4deg); transform-origin: 50% 100%; }
.db-screen-in::before { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0 1px, transparent 1px 3px); }
.db-col { min-width: 0; display: flex; flex-direction: column; gap: 7px; }
.db-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font: 700 11.5px var(--font-head, var(--font)); letter-spacing: .2em; color: #fff; text-shadow: 0 0 10px color-mix(in srgb, var(--cyan) 70%, transparent); margin-top: 2px; }
.db-klein { font: 500 10.5px var(--font-ui, var(--font)); letter-spacing: .02em; color: var(--muted); text-shadow: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-kacheln { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.db-k { display: flex; flex-direction: column; gap: 1px; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--u-rand-soft, rgba(255,138,30,.3)); background: var(--u-karte, rgba(255,138,30,.06)); min-width: 0; }
.db-k small { font-size: 10px; letter-spacing: .08em; color: var(--muted); text-transform: uppercase; }
.db-k b { font: 700 19px var(--font-ui, var(--font)); color: var(--cyan); text-shadow: 0 0 10px color-mix(in srgb, var(--cyan) 60%, transparent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-k em { font-style: normal; font-size: 10.5px; color: var(--text); opacity: .7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-k.breit { grid-column: 1 / -1; }
.db-k .gh-bar { margin-top: 4px; }
.db-notiz { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.db-notiz input { width: 100%; padding: 8px 11px; border-radius: 10px; border: 1px solid var(--u-rand-soft, rgba(255,138,30,.3)); background: rgba(0,0,0,.35); color: inherit; font: inherit; font-size: 13px; min-width: 0; }
.db-notiz input:focus { outline: none; border-color: var(--cyan); box-shadow: 0 0 10px color-mix(in srgb, var(--cyan) 40%, transparent); }
.db-notiz-reihe { display: flex; gap: 6px; }
.db-notiz-reihe input { flex: 1; }
.db-notiz.ok input:first-of-type { border-color: #38e08c; box-shadow: 0 0 10px rgba(56,224,140,.4); }
.db-karte { width: 100%; height: auto; display: block; overflow: visible; }
.db-karte .ln { fill: none; stroke: var(--f); stroke-width: .9; stroke-opacity: .35; }
.db-karte .ln.an { stroke-opacity: .9; stroke-width: 1.3; stroke-dasharray: 3 8; animation: db-fluss 1.5s linear infinite; filter: drop-shadow(0 0 2px var(--f)); }
@keyframes db-fluss { to { stroke-dashoffset: -22; } }
.db-karte .kn { cursor: pointer; }
.db-karte .kn circle.au { fill: rgba(10,6,3,.92); stroke: var(--f); stroke-width: 1.6; filter: drop-shadow(0 0 5px var(--f)); transition: stroke-width .2s; }
.db-karte .kn circle.in { fill: var(--f); opacity: .85; }
.db-karte .kn.leer { opacity: .32; }
.db-karte .kn.wahl circle.au, .db-karte .kn:hover circle.au, .db-karte .kn:focus circle.au { stroke-width: 3.2; }
.db-karte .kn:focus { outline: none; }
.db-karte text { fill: #fff; font: 600 9.5px var(--font-ui, system-ui); paint-order: stroke; stroke: rgba(12,7,3,.95); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; }
.db-karte text.n { fill: var(--f); font-size: 9px; }
.db-karte .kern circle { fill: rgba(20,10,4,.95); stroke: var(--cyan); stroke-width: 2; filter: drop-shadow(0 0 12px var(--cyan)); }
.db-karte .kern .r2 { fill: none; stroke: rgba(255,138,30,.35); stroke-dasharray: 2 5; animation: db-dreh 30s linear infinite; transform-origin: 200px 150px; }
@keyframes db-dreh { to { transform: rotate(360deg); } }
.db-karte .kern text { font-size: 20px; font-family: var(--font-head, var(--font)); fill: #fff; }
.db-karte .kern text.u { font-size: 6.5px; letter-spacing: .14em; fill: var(--muted); stroke-width: 0; }
.db-tage { display: flex; align-items: flex-end; gap: 2px; height: 64px; padding: 4px 2px 0; border-bottom: 1px solid rgba(255,138,30,.25); }
.db-tage i { flex: 1; min-height: 2px; border-radius: 2px 2px 0 0; background: linear-gradient(180deg, #ffb066, rgba(255,138,30,.35)); box-shadow: 0 0 6px rgba(255,138,30,.4); }
.db-tage i.heute { background: linear-gradient(180deg, #fff, var(--cyan)); }
.db-tage i.null { background: rgba(255,138,30,.15); box-shadow: none; }
.db-achse { display: flex; justify-content: space-between; font-size: 9.5px; color: var(--muted); }
.db-themen { display: flex; flex-wrap: wrap; gap: 5px; }
.db-themen button { padding: 3px 9px; border-radius: 999px; border: 1px solid var(--u-rand-soft, rgba(255,138,30,.3)); background: rgba(255,138,30,.07); color: var(--text); font: 500 11.5px var(--font-ui, var(--font)); cursor: pointer; }
.db-themen button b { color: var(--cyan); font-weight: 600; margin-left: 3px; }
.db-themen button:hover { border-color: var(--cyan); box-shadow: 0 0 10px color-mix(in srgb, var(--cyan) 35%, transparent); }
.db-rueck { display: flex; flex-direction: column; gap: 4px; }
.db-rueck div { padding: 5px 8px; border-radius: 8px; background: rgba(255,138,30,.06); font-size: 11.5px; line-height: 1.35; }
.db-rueck div b { color: var(--cyan); font-weight: 600; }
.db-rueck div span { color: var(--muted); }
.db-treffer { margin: 2px 2px 6px; min-height: 0; }
.db-box .wissen-filter button { white-space: nowrap; }
.db-box .wissen-filter button small { opacity: .65; margin-left: 4px; font-size: 10.5px; }
.db-weg { margin-left: 6px; border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 0 2px; }
.db-weg:hover { color: var(--bad, #ff5d6c); }
.db-quelle { opacity: .7; }
@media (max-width: 900px) {
  .db-screen-in { grid-template-columns: 1fr; transform: none; border-radius: 18px; padding: 12px; }
  .db-mitte { order: -1; }
  .db-top { flex-wrap: wrap; }
}/* v1.147.0 (Eve-Test „datenbank-gespeichert“): grüner Haken nach dem Speichern */
.db-ok { display: none; align-items: center; gap: 8px; margin-top: 2px; padding: 7px 10px; border-radius: 10px; border: 1px solid rgba(56,224,140,.55); background: rgba(56,224,140,.1); color: #c9ffe3; font-size: 13px; }
.db-ok.an { display: flex; animation: dbOkRein .35s ease-out; }
.db-ok .db-ok-kreis { flex: none; width: 22px; height: 22px; border-radius: 50%; background: #38e08c; color: #04210f; display: grid; place-items: center; font-weight: 800; font-size: 14px; box-shadow: 0 0 12px rgba(56,224,140,.8); }
.db-ok b { color: #fff; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@keyframes dbOkRein { from { opacity: 0; transform: translateY(-4px) scale(.97); } to { opacity: 1; transform: none; } }
.db-zuletzt { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.db-zuletzt:empty { display: none; }
.db-zuletzt .db-z-h { font-size: 10.5px; letter-spacing: .12em; opacity: .7; }
.db-zuletzt .db-z { display: flex; align-items: center; gap: 7px; font-size: 12.5px; min-width: 0; }
.db-zuletzt .db-z i { flex: none; width: 16px; height: 16px; border-radius: 50%; background: #38e08c; color: #04210f; font-style: normal; font-weight: 800; font-size: 11px; display: grid; place-items: center; box-shadow: 0 0 8px rgba(56,224,140,.6); }
.db-zuletzt .db-z span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-zuletzt .db-z small { flex: none; opacity: .6; margin-left: auto; }
/* v1.156.0: Fridays Lexikon – eingebautes Wissen ohne Internet */
.db-lx-kats { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 10px; }
.db-lx-kats button { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--u-rand-soft, rgba(255,138,30,.3)); background: rgba(255,138,30,.07); color: var(--text); font: 500 12px var(--font-ui, var(--font)); cursor: pointer; }
.db-lx-kats button small { color: var(--cyan); font-weight: 600; }
.db-lx-kats button.active, .db-lx-kats button:hover { border-color: var(--cyan); box-shadow: 0 0 10px color-mix(in srgb, var(--cyan) 35%, transparent); background: rgba(255,138,30,.16); }
.db-lx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 9px; }
.db-lx { position: relative; padding: 10px 12px 11px; border-radius: 14px; border: 1px solid var(--u-rand-soft, rgba(255,138,30,.3)); background: linear-gradient(180deg, rgba(255,138,30,.08), rgba(0,0,0,.25)); min-width: 0; }
.db-lx h4 { margin: 0 0 4px; display: flex; align-items: baseline; gap: 7px; font: 650 14px var(--font-ui, var(--font)); color: #fff; }
.db-lx h4 span { font-size: 15px; }
.db-lx h4 small { margin-left: auto; font: 500 10.5px var(--font-ui, var(--font)); color: var(--cyan); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.db-lx p { margin: 0 0 14px; font: 400 13px/1.5 var(--font-ui, system-ui, -apple-system, sans-serif); color: var(--text); opacity: .92; }
.db-lx h4 b { font-weight: inherit; min-width: 0; }
.db-lx mark, .db-lx-box mark { background: rgba(255,170,60,.32); color: #fff; border-radius: 3px; padding: 0 1px; }
.db-lx-box a { color: var(--cyan); }
.db-lx .db-lx-b { display: block; margin-top: 6px; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.db-lx-vor { position: absolute; bottom: 6px; right: 8px; border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 13px; padding: 2px 4px; }
.db-lx-vor:hover { color: var(--cyan); }
.db-lx-mehr { margin: 10px auto 2px; display: block; }
.db-lx-box { margin: 0 2px 10px; padding: 10px 12px; border-radius: 14px; border: 1px solid rgba(255,226,138,.45); background: rgba(255,226,138,.06); }
.db-lx-box:empty { display: none; }
.db-lx-box .db-h { margin: 0 0 7px; }
.db-lx-box .db-lx-grid { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
.db-lx-leer { padding: 10px 2px; }
@media (max-width: 900px) { .db-lx-grid { grid-template-columns: 1fr; } }
`;
  document.head.appendChild(style);

  let stand = null;

  function karte(u) {
    const svg = $("db-karte");
    if (!svg) return;
    // v1.156.0: Lexikon als eigener Knoten; bei vielen Quellen zwei Ringe, Größe logarithmisch (sonst wären kleine Quellen unsichtbar).
    const quellen = { ...(u.lexikon?.gesamt ? { lexikon: u.lexikonQuelle || { name: "Lexikon", farbe: "#ffe28a" } } : {}), ...u.quellen };
    const anzahl = (t) => (t === "lexikon" ? u.lexikon?.gesamt || 0 : u.typen[t] || 0);
    const typen = Object.keys(quellen);
    const max = Math.max(1, ...typen.map(anzahl));
    const zweiRinge = typen.length > 16;
    const aktiv = window.FridayWissen?.aktiverTyp || "";
    let linien = "", knoten = "";
    typen.forEach((t, i) => {
      const q = quellen[t], n = anzahl(t);
      const w = -Math.PI / 2 + (i / typen.length) * Math.PI * 2;
      const ring = zweiRinge && i % 2 ? 0.66 : 1;
      const x = 200 + Math.cos(w) * 168 * ring, y = 150 + Math.sin(w) * 122 * ring;
      const r = n ? 6 + (Math.log(1 + n) / Math.log(1 + max)) * (zweiRinge ? 9 : 12) : 5;
      const cx = 200 + (x - 200) * 0.5, cy = 150 + (y - 150) * 0.5 + (i % 2 ? 14 : -14);
      linien += `<path class="ln${n ? " an" : ""}" style="--f:${q.farbe};animation-delay:-${(i * 0.17).toFixed(2)}s" d="M200 150 Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}"/>`;
      const unten = y > 150;
      knoten += `<g class="kn${n ? "" : " leer"}${aktiv === t ? " wahl" : ""}" style="--f:${q.farbe}" data-typ="${t}" tabindex="0" role="button" aria-label="${esc(q.name)}: ${n}">
        <circle class="au" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/><circle class="in" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 0.38).toFixed(1)}"/>
        <text x="${x.toFixed(1)}" y="${(unten ? y + r + 11 : y - r - 12).toFixed(1)}" text-anchor="middle">${esc(q.name)}</text>
        <text class="n" x="${x.toFixed(1)}" y="${(unten ? y + r + 21 : y - r - 3).toFixed(1)}" text-anchor="middle">${zahl(n)}</text></g>`;
    });
    svg.innerHTML = `${linien}<g class="kern"><circle class="r2" cx="200" cy="150" r="44"/><circle cx="200" cy="150" r="33"/>
      <text x="200" y="154" text-anchor="middle">${zahl(u.gesamt)}</text><text class="u" x="200" y="168" text-anchor="middle">EINTRÄGE</text></g>${knoten}`;
  }

  function filterKnoepfe(u) {
    const box = $("wissen-filter");
    if (!box) return;
    const aktiv = window.FridayWissen?.aktiverTyp || "";
    const typen = Object.keys(u.quellen).filter((t) => u.typen[t] > 0 || t === aktiv);
    box.innerHTML = `<button type="button" data-typ=""${aktiv ? "" : ' class="active"'}>Alles<small>${zahl(u.gesamt)}</small></button>`
      + (u.lexikon?.gesamt ? `<button type="button" data-typ="lexikon"${aktiv === "lexikon" ? ' class="active"' : ""}>📖 Lexikon<small>${zahl(u.lexikon.gesamt)}</small></button>` : "")
      + typen.map((t) => `<button type="button" data-typ="${t}"${aktiv === t ? ' class="active"' : ""}>${u.quellen[t].icon} ${esc(u.quellen[t].name)}<small>${zahl(u.typen[t])}</small></button>`).join("");
  }

  async function kern() {
    let u;
    try { u = await (await api("/api/wissen/uebersicht")).json(); } catch { $("db-unter").textContent = "Datenbank nicht erreichbar."; return; }
    stand = u;
    const gemerkt = (u.typen.gedaechtnis || 0) + (u.typen.notiz || 0);
    const anzQ = Object.keys(u.quellen).length;
    // Untertitel in den Gehirn-Kopf (gehirn-stil.js) unter den Titel setzen
    const unter = $("db-unter"), titel = unter?.parentElement?.querySelector(".gs-titel");
    if (unter && titel && unter.parentElement !== titel) titel.append(unter);
    $("db-unter").textContent = `${u.quellenAktiv} von ${anzQ} Quellen aktiv · Lexikon ${zahl(u.lexikon?.gesamt)} · ${mb(u.speicher.bytes)} · ${zahl(u.speicher.dateien)} Dateien`;
    $("db-seit").textContent = `seit ${datum(u.seit)}`;
    const k = (titel, wert, unter, klasse = "") => `<div class="db-k ${klasse}"><small>${titel}</small><b>${wert}</b><em>${unter}</em></div>`;
    const anteil = u.gesamt ? Math.round(((u.typen.gespraech || 0) / u.gesamt) * 100) : 0;
    $("wissen-stats").innerHTML = k("Einträge", zahl(u.gesamt), "insgesamt gespeichert")
      + k("Heute neu", `+${zahl(u.heute)}`, `${zahl(u.woche)} in 7 Tagen`)
      + k("Gemerkt", zahl(gemerkt), `${zahl(u.typen.notiz || 0)} eigene Notizen`)
      + k("Gespräche", zahl(u.typen.gespraech || 0), Object.entries(u.kanaele).map(([kn, n]) => `${({ web: "Dashboard", telegram: "Telegram", siri: "Siri" })[kn] || esc(kn)} ${n}`).join(" · ") || "noch keine")
      + k("Lexikon", zahl(u.lexikon?.gesamt), `${zahl(u.lexikon?.kategorien?.length)} Bereiche, offline`)
      + k("Wissen gesamt", zahl(u.wissenGesamt ?? u.gesamt), "Datenbank + Lexikon")
      + `<div class="db-k breit"><small>Speicher</small><b>${mb(u.speicher.bytes)}</b><em>${anteil} % Gespräche · Rest Wissen, Listen, Pläne</em><span class="gh-bar"><s style="width:${Math.max(3, Math.min(100, anteil))}%"></s></span></div>`;
    $("db-quellen").textContent = `${u.quellenAktiv}/${anzQ} aktiv + Lexikon · antippen = filtern`;
    karte(u);
    filterKnoepfe(u);
    const max = Math.max(1, ...u.tage.map((t) => t.n));
    $("db-tage").innerHTML = u.tage.map((t, i) => `<i class="${t.n ? "" : "null"}${i === u.tage.length - 1 ? " heute" : ""}" style="height:${Math.max(3, Math.round((t.n / max) * 100))}%" title="${datum(t.tag)}: ${t.n}"></i>`).join("");
    $("db-tag-von").textContent = datum(u.tage[0]?.tag).slice(0, 6);
    $("db-woche").textContent = `${zahl(u.woche)} diese Woche`;
    $("db-themen").innerHTML = u.themen.length ? u.themen.slice(0, 14).map((t) => `<button type="button" data-q="${esc(t.wort)}">${esc(t.wort)}<b>${t.n}</b></button>`).join("") : '<span class="muted">Noch zu wenig Gespräche. Je mehr du mit Friday redest, desto mehr Themen erscheinen hier.</span>';
    $("db-rueck").innerHTML = u.rueckblick.length ? u.rueckblick.map((r) => `<div><b>${esc(r.name)}</b> <span>(${datum(r.tag)}, ${r.anzahl})</span><br>${r.beispiel.map((b) => esc(b.text)).join(" · ")}</div>`).join("") : '<span class="muted">Noch kein Rückblick: Hier erscheint, was vor einer Woche, einem Monat und einem Jahr los war.</span>';
  }

  $("db-karte")?.addEventListener("click", (e) => {
    const g = e.target.closest("[data-typ]"); if (!g) return;
    const t = g.dataset.typ;
    window.FridayWissen?.typ(window.FridayWissen.aktiverTyp === t ? "" : t);
  });
  $("db-karte")?.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.closest("[data-typ]")) { e.preventDefault(); e.target.closest("[data-typ]").dispatchEvent(new MouseEvent("click", { bubbles: true })); } });
  $("db-themen")?.addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) window.FridayWissen?.suche(b.dataset.q); });
  $("db-notiz")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = $("db-notiz-text").value.trim();
    if (!text) { $("db-notiz-text").focus(); return; }
    try {
      const r = await api("/api/wissen/notiz", { method: "POST", body: JSON.stringify({ text, tags: $("db-notiz-tags").value }) });
      if (!r.ok) throw new Error();
      $("db-notiz-text").value = ""; $("db-notiz-tags").value = "";
      const f = $("db-notiz"); f.classList.add("ok"); setTimeout(() => f.classList.remove("ok"), 1200);
      if (hakenFrei()) { let n = {}; try { n = await r.json(); } catch { /* egal */ } zeigeHaken(n.titel || text); zuletzt(); }
      window.FridayWissen?.neu();
    } catch { $("db-notiz-text").placeholder = "Speichern ging nicht – nochmal versuchen."; }
  });

  // ---------- v1.147.0 (Eve-Test): grüner Haken + „Zuletzt gespeichert“ ----------
  const hakenFrei = () => { try { return !window.FridayEve?.frei || window.FridayEve.frei("datenbank-gespeichert"); } catch { return true; } };
  const form = $("db-notiz");
  let okEl = null, zEl = null, okTimer = null;
  if (form) {
    okEl = document.createElement("div"); okEl.id = "db-notiz-ok"; okEl.className = "db-ok"; okEl.setAttribute("role", "status"); okEl.setAttribute("aria-live", "polite");
    zEl = document.createElement("div"); zEl.id = "db-zuletzt"; zEl.className = "db-zuletzt";
    form.append(okEl, zEl);
    // Erst wenn wieder getippt wird, verschwindet der Haken (nach 20 s spätestens).
    $("db-notiz-text")?.addEventListener("input", () => { if ($("db-notiz-text").value) okEl.classList.remove("an"); });
  }
  // Passwörter nicht offen auf dem Bildschirm stehen lassen: "WLAN-Passwort: abc123" → "WLAN-Passwort: ••••••"
  const verdeckt = (t) => /(passw|kennw|\bpin\b|zugangscode|schlüssel|schluessel)/i.test(t)
    ? String(t).replace(/((?:passwort|kennwort|pin|code|schlüssel|schluessel)[^:=]{0,30}?(?:[:=]|\bist\b|\blautet\b)\s*)(\S.*)$/i, (_, a, b) => a + "•".repeat(Math.min(10, Math.max(6, b.length))))
    : t;
  function zeigeHaken(titel) {
    if (!okEl) return;
    okEl.innerHTML = `<span class="db-ok-kreis" aria-hidden="true">✓</span><span>Gespeichert: <b>${esc(verdeckt(String(titel)).slice(0, 80))}</b></span>`;
    okEl.classList.remove("an"); void okEl.offsetWidth; okEl.classList.add("an");
    clearTimeout(okTimer); okTimer = setTimeout(() => okEl.classList.remove("an"), 20000);
  }
  async function zuletzt() {
    if (!zEl || !hakenFrei()) { if (zEl) zEl.innerHTML = ""; return; }
    try {
      const d = await (await api("/api/wissen/datenbank?typ=notiz&limit=10")).json();
      const l = (d.eintraege || d.liste || d.items || []).filter((e) => e.typ === "notiz").sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 3);
      zEl.innerHTML = l.length ? `<div class="db-z-h">ZULETZT GESPEICHERT</div>` + l.map((e) => `<div class="db-z"><i aria-hidden="true">✓</i><span>${esc(verdeckt(e.text))}</span><small>${datum(e.at)}</small></div>`).join("") : "";
    } catch { /* egal */ }
  }
  // Beim Öffnen der Datenbank die letzten Einträge zeigen.
  const wissenSheet = $("wissen");
  if (wissenSheet) new MutationObserver(() => { if (!wissenSheet.classList.contains("hidden")) zuletzt(); }).observe(wissenSheet, { attributes: true, attributeFilter: ["class"] });

  // ---------- v1.156.0: Lexikon-Ansicht ----------
  let lxKat = "", lxOffset = 0, lxStat = null;
  const lxMark = (t, q) => {
    const h = esc(t || "");
    if (!q) return h;
    const r = esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return h.replace(new RegExp(r, "gi"), (m) => `<mark>${m}</mark>`);
  };
  const lxKarte = (e, q) => `<article class="db-lx" data-lx="${esc(e.id)}"><h4><span aria-hidden="true">${esc(e.icon)}</span><b>${lxMark(e.titel, q)}</b>${e.info ? `<small>${esc(e.info)}</small>` : ""}</h4>`
    + `<p>${lxMark(e.text, q)}</p><span class="db-lx-b">${esc(e.bereich)}</span>`
    + `<button class="db-lx-vor" type="button" data-sag="${esc(e.text)}" title="Vorlesen" aria-label="Vorlesen">🔊</button></article>`;
  const sagen = (txt) => { try { if (window.Friday?.say) window.Friday.say(txt); else if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(txt); u.lang = "de-DE"; speechSynthesis.cancel(); speechSynthesis.speak(u); } } catch { /* egal */ } };

  /** Lexikon in die Liste zeichnen (von app.js aufgerufen, wenn der Filter „Lexikon“ aktiv ist). */
  async function lexikon(liste, q = "", weiter = false) {
    if (!liste) return;
    if (!weiter) { lxOffset = 0; liste.innerHTML = '<span class="muted">Lade Lexikon …</span>'; kern(); }
    let d;
    try { d = await (await api("/api/wissen/lexikon?" + new URLSearchParams({ q, kat: lxKat, limit: "60", offset: String(lxOffset) }))).json(); }
    catch { liste.innerHTML = '<span class="muted">Lexikon nicht erreichbar.</span>'; return; }
    lxStat = d;
    const tr = $("wissen-treffer");
    const katName = d.kategorien.find((k) => k.id === lxKat)?.name;
    if (tr) tr.textContent = `${zahl(d.treffer)} ${d.treffer === 1 ? "Eintrag" : "Einträge"} im Lexikon${katName ? ` · ${katName}` : ""}${q ? ` zu „${q}“` : ""} · eingebaut, ohne Internet und ohne Claude`;
    const kats = `<div class="db-lx-kats" role="tablist"><button type="button" data-lxkat=""${lxKat ? "" : ' class="active"'}>Alle Bereiche<small>${zahl(d.gesamt)}</small></button>`
      + d.kategorien.map((k) => `<button type="button" data-lxkat="${esc(k.id)}"${lxKat === k.id ? ' class="active"' : ""}>${esc(k.icon)} ${esc(k.name)}<small>${zahl(k.n)}</small></button>`).join("") + "</div>";
    const karten = d.eintraege.map((e) => lxKarte(e, q)).join("");
    const mehr = d.mehr ? '<button class="chip db-lx-mehr" type="button" data-lxmehr="1">Mehr anzeigen</button>' : "";
    if (!weiter) liste.innerHTML = kats + (karten ? `<div class="db-lx-grid">${karten}</div>` : `<div class="muted db-lx-leer">Dazu steht nichts im Lexikon${q ? ` zu „${esc(q)}“` : ""}. Frag mich einfach, dann denke ich mit Claude nach.</div>`) + mehr;
    else { liste.querySelector(".db-lx-mehr")?.remove(); liste.querySelector(".db-lx-grid")?.insertAdjacentHTML("beforeend", karten); if (mehr) liste.insertAdjacentHTML("beforeend", mehr); }
    const box = $("db-lx-box"); if (box) box.innerHTML = "";
  }
  /** Bei normaler Suche: bis zu 4 passende Lexikon-Einträge über der Liste. */
  async function lexikonTreffer(q) {
    let box = $("db-lx-box");
    const liste = $("wissen-liste");
    if (!box && liste) { box = document.createElement("div"); box.id = "db-lx-box"; box.className = "db-lx-box"; liste.parentElement.insertBefore(box, liste); }
    if (!box) return;
    const such = String(q || "").trim();
    if (such.length < 2) { box.innerHTML = ""; return; }
    try {
      const d = await (await api("/api/wissen/lexikon?" + new URLSearchParams({ q: such, limit: "4" }))).json();
      if (such !== String(window.FridayWissen?.suchtext ?? such)) return;
      box.innerHTML = d.eintraege.length ? `<div class="db-h">📖 AUS DEM LEXIKON <span class="db-klein">${zahl(d.treffer)} Treffer · <a href="#" data-lxalle="1">alle zeigen</a></span></div><div class="db-lx-grid">${d.eintraege.map((e) => lxKarte(e, such)).join("")}</div>` : "";
    } catch { box.innerHTML = ""; }
  }
  document.addEventListener("click", (e) => {
    const k = e.target.closest("[data-lxkat]");
    if (k) { lxKat = k.dataset.lxkat; window.FridayWissen?.typ("lexikon"); return; }
    if (e.target.closest("[data-lxmehr]")) { lxOffset += 60; lexikon($("wissen-liste"), window.FridayWissen?.suchtext || "", true); return; }
    const v = e.target.closest(".db-lx-vor");
    if (v) { sagen(v.dataset.sag); return; }
    const alle = e.target.closest("[data-lxalle]");
    if (alle) { e.preventDefault(); lxKat = ""; window.FridayWissen?.typ("lexikon"); }
  });

  window.FridayDatenbank = { kern, lexikon, lexikonTreffer, get stand() { return stand; }, get lexikonStand() { return lxStat; } };
})();
