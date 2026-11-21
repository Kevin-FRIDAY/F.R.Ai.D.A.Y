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
}`;
  document.head.appendChild(style);

  let stand = null;

  function karte(u) {
    const svg = $("db-karte");
    if (!svg) return;
    const typen = Object.keys(u.quellen);
    const max = Math.max(1, ...typen.map((t) => u.typen[t] || 0));
    const aktiv = window.FridayWissen?.aktiverTyp || "";
    let linien = "", knoten = "";
    typen.forEach((t, i) => {
      const q = u.quellen[t], n = u.typen[t] || 0;
      const w = -Math.PI / 2 + (i / typen.length) * Math.PI * 2;
      const x = 200 + Math.cos(w) * 165, y = 150 + Math.sin(w) * 118;
      const r = n ? 7 + Math.sqrt(n / max) * 11 : 6;
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
    $("db-unter").textContent = `${u.quellenAktiv} von ${anzQ} Quellen aktiv · ${mb(u.speicher.bytes)} · ${zahl(u.speicher.dateien)} Dateien`;
    $("db-seit").textContent = `seit ${datum(u.seit)}`;
    const k = (titel, wert, unter, klasse = "") => `<div class="db-k ${klasse}"><small>${titel}</small><b>${wert}</b><em>${unter}</em></div>`;
    const anteil = u.gesamt ? Math.round(((u.typen.gespraech || 0) / u.gesamt) * 100) : 0;
    $("wissen-stats").innerHTML = k("Einträge", zahl(u.gesamt), "insgesamt gespeichert")
      + k("Heute neu", `+${zahl(u.heute)}`, `${zahl(u.woche)} in 7 Tagen`)
      + k("Gemerkt", zahl(gemerkt), `${zahl(u.typen.notiz || 0)} eigene Notizen`)
      + k("Gespräche", zahl(u.typen.gespraech || 0), Object.entries(u.kanaele).map(([kn, n]) => `${({ web: "Dashboard", telegram: "Telegram", siri: "Siri" })[kn] || esc(kn)} ${n}`).join(" · ") || "noch keine")
      + `<div class="db-k breit"><small>Speicher</small><b>${mb(u.speicher.bytes)}</b><em>${anteil} % Gespräche · Rest Wissen, Listen, Pläne</em><span class="gh-bar"><s style="width:${Math.max(3, Math.min(100, anteil))}%"></s></span></div>`;
    $("db-quellen").textContent = `${u.quellenAktiv}/${anzQ} aktiv · antippen = filtern`;
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
      window.FridayWissen?.neu();
    } catch { $("db-notiz-text").placeholder = "Speichern ging nicht – nochmal versuchen."; }
  });

  window.FridayDatenbank = { kern, get stand() { return stand; } };
})();
