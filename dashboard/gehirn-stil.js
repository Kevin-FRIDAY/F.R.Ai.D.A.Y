// v1.129.0 – Einheitlicher Stil für das ganze Dashboard, nach Fridays Gehirn (v1.126) und dem Tool-Ökosystem (v1.99).
//
// Was passiert hier?
// • Jedes Fenster (.sheet) bekommt automatisch den Gehirn-Kopf: drehender Kern-Ring mit Symbol,
//   kleine Zeile "F.R.Ai.D.A.Y · BEREICH", großer leuchtender Titel, LIVE-Anzeige mit Uhrzeit.
//   Darunter ein gebogener Glas-Bildschirm-Rand, Neuronen-Netz im Hintergrund und ein leuchtender Sockel unten.
// • Die Farbe kommt aus dem Bereich, genau wie im Tool-Ökosystem: Welt türkis, Erschaffen violett,
//   Friday orange, Alltag blau, System gelb. Rot bleibt für Fehler reserviert.
// • Werkzeug-Fenster (Erschaffen, Modul-Zentrale, Agenten) bekommen die Ökosystem-Variante mit 3D-Symbol.
// • Das Werkzeug-Menü bekommt die farbigen Ökosystem-Gruppen.
// Neue Fenster brauchen nichts zu tun: alles, was als .sheet mit .sheet-top gebaut ist, wird automatisch veredelt.
// Fridays Gehirn (#brain) und das Tool-Ökosystem selbst bleiben, wie sie sind – sie sind die Vorlage.
(() => {
  "use strict";
  if (window.FridayStil) return;

  const FARBE = { zentrale: "#ff8a2a", welt: "#2ee6d0", erschaffen: "#a978ff", friday: "#ff9d3c", alltag: "#4f8dff", system: "#ffc44d" };
  const NAME = { zentrale: "ZENTRALE", welt: "WELT", erschaffen: "ERSCHAFFEN", friday: "KERN", alltag: "ALLTAG", system: "SYSTEM" };
  // Fenster-ID → Bereich (wie im Werkzeug-Menü gruppiert)
  const BEREICH = {
    land: "welt",
    ideen: "erschaffen", gegen: "erschaffen", spiele: "erschaffen",
    zentrale: "zentrale",
    agents: "friday", energie: "friday", archiv: "friday", logbuch: "friday", wissen: "friday", wache: "friday", klang: "friday",
    kalender: "alltag", dateien: "alltag", organizer: "alltag", mail: "alltag", dienste: "alltag", alexa: "alltag", tv: "alltag",
    aktiv: "alltag", kuehl: "alltag", kauf: "alltag", lernen: "alltag", routen: "alltag",
    syscheck: "system", backups: "system", settings: "system",
  };
  // Diese Fenster sind Werkzeug-Werkstätten → Ökosystem-Look
  const OEKO = new Set(["ideen", "gegen", "spiele", "zentrale", "agents"]);
  // Vorlagen selbst nicht anfassen
  const AUSLASSEN = new Set(["brain", "oekosystem"]);

  // 3D-Würfel wie im Ökosystem
  const WUERFEL = `<svg class="gs-3d" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8 54 20 32 32 10 20z" fill="var(--gs-c)" stroke="rgba(255,255,255,.55)" stroke-width=".8" stroke-linejoin="round"/><path d="M32 8 54 20 32 32 10 20z" fill="#fff" opacity=".35"/><path d="M10 20 32 32v24L10 44z" fill="var(--gs-c)" stroke="rgba(255,255,255,.55)" stroke-width=".8" stroke-linejoin="round"/><path d="M32 32 54 20v24L32 56z" fill="var(--gs-c)" stroke="rgba(255,255,255,.55)" stroke-width=".8" stroke-linejoin="round"/><path d="M32 32 54 20v24L32 56z" fill="#000" opacity=".35"/></svg>`;
  // Gehirn-Symbol als Rückfall, wenn der Titel kein eigenes Symbol hat
  const HIRN = `<svg class="gs-hirn" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/><path d="M12 9h2M12 14h3"/></svg>`;

  // ---------- Neuronen-Netz (einmal berechnet, als Hintergrundbild) ----------
  function netzBild(staerke = 1) {
    let s = 7;
    const zufall = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const P = [];
    for (let i = 0; i < 46; i++) P.push([20 + zufall() * 560, 20 + zufall() * 360, 0.6 + zufall() * 1.8]);
    let linien = "";
    for (let i = 0; i < P.length; i++) {
      for (let j = i + 1; j < P.length; j++) {
        const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]);
        if (d < 92) linien += `<path d="M${P[i][0].toFixed(1)} ${P[i][1].toFixed(1)}L${P[j][0].toFixed(1)} ${P[j][1].toFixed(1)}" stroke-opacity="${((0.32 - d / 340) * staerke).toFixed(2)}"/>`;
      }
    }
    const punkte = P.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${p[2].toFixed(1)}"/>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><g stroke="#ff9a3c" stroke-width=".7" fill="none">${linien}</g><g fill="#ffb066" fill-opacity="${(0.45 * staerke).toFixed(2)}">${punkte}</g></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  document.documentElement.style.setProperty("--gs-netz", netzBild());
  document.documentElement.style.setProperty("--gs-netz-leise", netzBild(0.45));

  // ---------- CSS ----------
  const css = `
/* ===== v1.129.0 Gehirn-Stil für alle Fenster (dashboard/gehirn-stil.js) ===== */
.sheet .sheet-box.gs-fenster { --gs-c: #ff9d3c;
  border-color: color-mix(in srgb, var(--cyan) 55%, transparent);
  background:
    linear-gradient(90deg, transparent 20%, color-mix(in srgb, var(--gs-c) 80%, #fff) 50%, transparent 80%) 50% 100% / 64% 2px no-repeat,
    radial-gradient(62% 70px at 50% 100%, color-mix(in srgb, var(--gs-c) 30%, transparent), transparent 100%),
    var(--gs-netz) right -40px top 40px / 460px auto no-repeat,
    linear-gradient(90deg, color-mix(in srgb, var(--gs-c) 7%, transparent), transparent 35%, transparent 70%, rgba(140,100,255,.05)),
    var(--u-glas, rgba(14,8,3,.95));
  box-shadow: 0 0 34px color-mix(in srgb, var(--cyan) 22%, transparent), inset 0 0 40px rgba(255,138,30,.06), inset 0 1px 0 rgba(255,230,200,.28), 0 14px 40px rgba(0,0,0,.5); }
.sheet .sheet-box.gs-oeko {
  border-color: color-mix(in srgb, var(--gs-c) 50%, rgba(255,138,30,.4));
  background:
    linear-gradient(90deg, transparent 20%, color-mix(in srgb, var(--gs-c) 80%, #fff) 50%, transparent 80%) 50% 100% / 64% 2px no-repeat,
    radial-gradient(62% 70px at 50% 100%, color-mix(in srgb, var(--gs-c) 30%, transparent), transparent 100%),
    var(--gs-netz) right -40px top 40px / 460px auto no-repeat,
    linear-gradient(170deg, rgba(40,30,60,.38), rgba(8,8,14,.15) 60%),
    var(--u-glas, rgba(14,8,3,.95));
  box-shadow: 0 0 34px color-mix(in srgb, var(--gs-c) 20%, transparent), inset 0 0 40px color-mix(in srgb, var(--gs-c) 7%, transparent), inset 0 1px 0 rgba(255,255,255,.18), 0 14px 40px rgba(0,0,0,.5); }

/* Kopf = gebogener Glas-Bildschirm, bleibt beim Scrollen oben */
.sheet .gs-fenster > .sheet-top.gs-kopf { position: sticky; top: calc(-1 * var(--gs-pt, 14px)); z-index: 4; display: flex; align-items: center; gap: 14px; flex-wrap: nowrap;
  margin: calc(-1 * var(--gs-pt, 14px)) calc(-1 * var(--gs-px, 16px)) 16px; padding: 14px calc(var(--gs-px, 16px) + 2px) 16px;
  border: 0; border-bottom: 1px solid color-mix(in srgb, var(--gs-c) 60%, transparent);
  border-radius: inherit; border-bottom-left-radius: 50% 16px; border-bottom-right-radius: 50% 16px;
  background:
    linear-gradient(115deg, transparent 22%, rgba(255,240,220,.06) 34%, transparent 46%),
    linear-gradient(90deg, color-mix(in srgb, var(--gs-c) 16%, transparent), transparent 45%),
    linear-gradient(180deg, rgba(255,160,70,.10), rgba(30,16,6,.96) 55%, rgba(14,8,3,.98));
  box-shadow: 0 6px 18px -8px color-mix(in srgb, var(--gs-c) 55%, transparent), inset 0 1px 0 rgba(255,230,200,.3);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.sheet .gs-fenster > .sheet-top.gs-kopf h2::before, .sheet .gs-fenster > .sheet-top.gs-kopf h2::after { display: none; }
.gs-kern { position: relative; flex: 0 0 auto; width: 54px; height: 54px; display: grid; place-items: center; }
.gs-kern > svg.gs-ringe { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.gs-kern .gs-ringe circle { fill: none; stroke: var(--gs-c); }
.gs-kern .gs-r1 { stroke-width: 1.4; stroke-dasharray: 4 6; opacity: .6; transform-origin: 60px 60px; animation: gs-dreh 18s linear infinite; }
.gs-kern .gs-r2 { stroke-width: 3.2; stroke-dasharray: 70 200; stroke-linecap: round; transform-origin: 60px 60px; animation: gs-dreh 6s linear infinite reverse; filter: drop-shadow(0 0 4px var(--gs-c)); }
.gs-kern .gs-r3 { stroke-width: 1; opacity: .35; fill: color-mix(in srgb, var(--gs-c) 10%, transparent) !important; }
.gs-kern .gs-sym { position: relative; font-size: 20px; line-height: 1; filter: drop-shadow(0 0 6px var(--gs-c)); }
.gs-kern .gs-3d { position: relative; width: 28px; height: 28px; filter: drop-shadow(0 0 7px color-mix(in srgb, var(--gs-c) 75%, transparent)); }
.gs-kern .gs-hirn { position: relative; width: 22px; height: 22px; fill: none; stroke: var(--gs-c); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 0 4px var(--gs-c)); }
@keyframes gs-dreh { to { transform: rotate(360deg); } }
.gs-titel { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.gs-titel > .gs-kicker { display: flex; align-items: center; gap: 6px; font: 600 9.5px/1.2 var(--font-ui, var(--font)); letter-spacing: .3em; text-transform: none; color: var(--gs-c); opacity: .95; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gs-titel > .gs-kicker::before { content: ""; width: 6px; height: 6px; transform: rotate(45deg); background: var(--gs-c); box-shadow: 0 0 6px var(--gs-c); flex: 0 0 auto; }
.sheet .gs-fenster .gs-titel h2 { margin: 0; font-family: var(--font-head, var(--font)); font-size: 19px; letter-spacing: .08em; text-transform: uppercase; color: var(--u-titel, #ffe2c4);
  text-shadow: 0 0 calc(14px * var(--glow, 1)) color-mix(in srgb, var(--cyan) 60%, transparent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gs-titel h2 .gs-emo { display: none; }
.gs-live { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font: 600 10.5px/1 var(--font-ui, var(--font)); letter-spacing: .12em;
  border: 1px solid color-mix(in srgb, var(--gs-c) 35%, transparent); background: rgba(10,6,2,.55); color: var(--u-titel, #ffe2c4); white-space: nowrap; }
.gs-live i { width: 7px; height: 7px; border-radius: 50%; background: var(--ok, #46e0a0); box-shadow: 0 0 8px var(--ok, #46e0a0); animation: gs-puls 1.6s ease-in-out infinite; }
.gs-live time { color: var(--muted); letter-spacing: .06em; font-variant-numeric: tabular-nums; }
@keyframes gs-puls { 50% { opacity: .3; } }
.sheet .gs-fenster > .sheet-top.gs-kopf > .gs-zu { flex: 0 0 auto; border-radius: 50%; width: 34px; height: 34px; padding: 0; display: grid; place-items: center;
  border: 1px solid color-mix(in srgb, var(--gs-c) 40%, transparent); background: rgba(10,6,2,.5); }
.sheet .gs-fenster > .sheet-top.gs-kopf > .gs-zu:hover { border-color: var(--gs-c); box-shadow: 0 0 12px color-mix(in srgb, var(--gs-c) 45%, transparent); }

/* Abschnitts-Überschriften wie "NEURONALE PFADE" */
.sheet .gs-fenster h3:not(.set-g-txt h3) { font-family: var(--font-head, var(--font)); font-size: 11.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--u-titel, #ffe2c4);
  padding-bottom: 5px; background: linear-gradient(90deg, color-mix(in srgb, var(--gs-c) 55%, transparent), transparent 70%) left bottom / 100% 1px no-repeat; }
/* Karten im Fenster: Glas-Kachel wie im Gehirn */
.sheet .gs-fenster .set-group, .sheet .gs-fenster .brain-card, .sheet .gs-fenster .hf-karte, .sheet .gs-fenster .agent-card {
  box-shadow: inset 0 1px 0 rgba(255,230,200,.14), inset 0 0 24px color-mix(in srgb, var(--gs-c) 6%, transparent); }
.sheet .gs-fenster .set-group:hover, .sheet .gs-fenster .brain-card:hover, .sheet .gs-fenster .agent-card:hover {
  box-shadow: inset 0 1px 0 rgba(255,230,200,.2), 0 0 16px color-mix(in srgb, var(--gs-c) 22%, transparent); }

@media (max-width: 900px) {
  .sheet .sheet-box.gs-fenster, .sheet .sheet-box.gs-oeko { background-image:
    linear-gradient(90deg, transparent 20%, color-mix(in srgb, var(--gs-c) 80%, #fff) 50%, transparent 80%),
    radial-gradient(62% 70px at 50% 100%, color-mix(in srgb, var(--gs-c) 30%, transparent), transparent 100%),
    var(--gs-netz-leise),
    linear-gradient(90deg, color-mix(in srgb, var(--gs-c) 7%, transparent), transparent 35%),
    var(--u-glas, linear-gradient(rgba(14,8,3,.95), rgba(14,8,3,.95)));
    background-size: 64% 2px, auto, 300px auto, auto, auto; background-position: 50% 100%, 0 0, right -30px top 30px, 0 0, 0 0; }
  .sheet .gs-fenster > .sheet-top.gs-kopf { gap: 10px; padding: 10px calc(var(--gs-px, 16px) + 2px) 12px; border-bottom-left-radius: 50% 10px; border-bottom-right-radius: 50% 10px; }
  .gs-kern { width: 42px; height: 42px; }
  .gs-kern .gs-sym { font-size: 16px; }
  .gs-kern .gs-3d { width: 22px; height: 22px; }
  .sheet .gs-fenster .gs-titel h2 { font-size: 15px; letter-spacing: .05em; }
  .gs-titel > .gs-kicker { font-size: 8.5px; letter-spacing: .22em; }
  .gs-live { padding: 4px 8px; font-size: 9.5px; }
  .gs-live time { display: none; }
}
.gs-schmal .gs-live time { display: none; }
/* Reihenfolge im Kopf: Ring, Titel, Zusatz-Knöpfe, LIVE, Schließen. Bei wenig Platz rutschen Zusatz-Knöpfe in eine zweite Zeile. */
.sheet .gs-fenster > .sheet-top.gs-kopf > * { order: 2; }
.sheet .gs-fenster > .sheet-top.gs-kopf > .gs-kern { order: 0; }
.sheet .gs-fenster > .sheet-top.gs-kopf > .gs-titel { order: 1; }
.sheet .gs-fenster > .sheet-top.gs-kopf > .gs-live { order: 3; }
.sheet .gs-fenster > .sheet-top.gs-kopf > .gs-zu { order: 4; }
.gs-schmal > .sheet-top.gs-kopf > :not(.gs-kern):not(.gs-titel):not(.gs-live):not(.gs-zu) { order: 5; }
.gs-schmal > .sheet-top.gs-kopf { flex-wrap: wrap !important; row-gap: 8px; }
.gs-schmal > .sheet-top.gs-kopf > .gs-titel { flex: 1 1 0; min-width: 40%; }
.zt-box .sheet-top.gs-kopf h2 { min-width: 0; flex: none; }
@media (max-width: 380px) { .gs-live { display: none; } }
html.perf-fluessig .gs-kern .gs-r1, html.perf-fluessig .gs-kern .gs-r2, body.reduce-anim .gs-kern .gs-r1, body.reduce-anim .gs-kern .gs-r2, body.reduce-anim .gs-live i { animation: none; }
html.perf-fluessig .sheet .gs-fenster > .sheet-top.gs-kopf { -webkit-backdrop-filter: none; backdrop-filter: none; }
@media (prefers-reduced-motion: reduce) { .gs-kern .gs-r1, .gs-kern .gs-r2, .gs-live i { animation: none; } }

/* ===== Vollbild-Studios (Markt, Werkstatt, Webseiten, Schnitt, Vision, Kamera, Bildschirm): Gehirn-Kopfleiste ===== */
.gs-studio-kopf { position: relative; padding: 8px 14px 10px !important; border-radius: 16px 16px 50% 50% / 16px 16px 12px 12px;
  border: 1px solid color-mix(in srgb, var(--gs-c) 45%, transparent);
  background: linear-gradient(115deg, transparent 22%, rgba(255,240,220,.05) 34%, transparent 46%), linear-gradient(90deg, color-mix(in srgb, var(--gs-c) 16%, transparent), transparent 50%), linear-gradient(180deg, rgba(255,160,70,.08), rgba(14,8,3,.88));
  box-shadow: 0 6px 20px -8px color-mix(in srgb, var(--gs-c) 60%, transparent), inset 0 1px 0 rgba(255,230,200,.25); }
.gs-studio-kopf > .gs-kern { width: 40px; height: 40px; }
.gs-studio-kopf > .gs-kern .gs-sym { font-size: 15px; }
.gs-studio-kopf > .gs-kern .gs-3d { width: 22px; height: 22px; }
.gs-studio-kopf > .gs-kern .gs-hirn { width: 18px; height: 18px; }

/* ===== Werkzeug-Menü im Ökosystem-Stil: farbige Bereiche, leuchtende Symbol-Kacheln ===== */
.menu-pop.gs-menu .menu-sep { display: flex; align-items: center; gap: 8px; color: var(--c, var(--cyan)); opacity: 1; letter-spacing: .24em; }
.menu-pop.gs-menu .menu-sep::before { content: ""; width: 6px; height: 6px; transform: rotate(45deg); background: var(--c); box-shadow: 0 0 6px var(--c); flex: 0 0 auto; }
.menu-pop.gs-menu .menu-sep::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, color-mix(in srgb, var(--c) 55%, transparent), transparent); }
.menu-pop.gs-menu .menu-row .mi { box-sizing: content-box; padding: 5px; border-radius: 9px; color: var(--c, var(--cyan));
  background: linear-gradient(165deg, color-mix(in srgb, var(--c) 30%, rgba(20,16,30,.6)), color-mix(in srgb, var(--c) 7%, rgba(8,8,12,.85)));
  border: 1px solid color-mix(in srgb, var(--c) 50%, transparent);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 0 10px color-mix(in srgb, var(--c) 25%, transparent);
  filter: drop-shadow(0 0 3px color-mix(in srgb, var(--c) 60%, transparent)); }
.menu-pop.gs-menu .menu-row:hover, .menu-pop.gs-menu .menu-row:focus-visible { background: linear-gradient(90deg, color-mix(in srgb, var(--c) 18%, transparent), transparent 85%); box-shadow: inset 2px 0 0 var(--c); color: var(--u-titel, #ffe2c4); }
.menu-pop.gs-menu .menu-row:hover .mi { border-color: var(--c); box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 0 14px color-mix(in srgb, var(--c) 50%, transparent); }

/* ===== Diagnose in der Seitenleiste (unter "Meine Dienste", über dem Profil) ===== */
.sidebar .side-diag-panel { flex: 1 1 0; min-height: 110px; overflow: hidden; display: flex; flex-direction: column; }
.side-diag-panel .diag { position: static; z-index: auto; flex: 1 1 auto; min-height: 0; max-width: none; max-height: none; opacity: 1; pointer-events: auto; cursor: pointer;
  display: flex; flex-direction: column; gap: 3px; overflow-y: auto; overflow-x: hidden; padding: 0 2px; margin: 0; background: transparent; border: 0; border-radius: 0;
  font: 10.5px/1.35 ui-monospace, Menlo, monospace; color: #ffd9b0; scrollbar-width: thin; }
.side-diag-panel .diag > div { flex: 0 0 auto; padding: 4px 7px; border-radius: 7px; background: rgba(255,138,30,.06); border-left: 2px solid rgba(255,138,30,.45); overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; }
.side-diag-panel .diag > div.d-ok { border-left-color: #46e0a0; } .side-diag-panel .diag > div.d-warn { border-left-color: #ffc24d; } .side-diag-panel .diag > div.d-bad { border-left-color: #ff5d6c; background: rgba(255,93,108,.1); }
.side-diag-panel .diag.gross > div { -webkit-line-clamp: unset; display: block; }
.side-diag-panel .diag b { display: block; color: #ff9a3c; font-weight: 600; font-size: 9.5px; opacity: .85; }
.side-diag-panel .diag-leer { white-space: normal !important; color: var(--muted); background: transparent !important; border-left-color: transparent !important; font-family: var(--font-ui, var(--font)); font-size: 12px; }
body.diag-aus .side-diag-panel { display: none !important; }
@media (max-width: 900px) {
  .sidebar .side-diag-panel { order: 9; flex: 0 0 auto; padding: 12px 12px 10px; min-height: 0; }
  .sidebar .side-diag-panel h2 { display: block; margin: 0 2px 8px; }
  .side-diag-panel .diag { max-height: 190px; font-size: 11px; }
  .side-diag-panel .diag.gross { max-height: 55vh; }
}
`;
  const stil = document.createElement("style");
  stil.id = "gehirn-stil-css";
  stil.textContent = css;
  document.head.append(stil);

  // ---------- Fenster veredeln ----------
  const EMOJI = /^\s*((?:\p{Extended_Pictographic}|[←-⇿⌀-➿■-◿⬀-⯿])️?)\s*/u;
  const ringeSvg = `<svg class="gs-ringe" viewBox="0 0 120 120" aria-hidden="true"><circle class="gs-r1" cx="60" cy="60" r="56"/><circle class="gs-r2" cx="60" cy="60" r="46"/><circle class="gs-r3" cx="60" cy="60" r="36"/></svg>`;

  function bereichVon(sheet) {
    return BEREICH[sheet.id] || "friday";
  }

  function polster(box) {
    try {
      const cs = getComputedStyle(box);
      box.style.setProperty("--gs-pt", cs.paddingTop);
      box.style.setProperty("--gs-px", cs.paddingLeft);
      const w = box.getBoundingClientRect().width;
      if (w) box.classList.toggle("gs-schmal", w < 600);
    } catch { /* egal */ }
  }

  function veredeln(sheet) {
    if (!sheet || !sheet.id || AUSLASSEN.has(sheet.id) || sheet.dataset.gs) return;
    const box = sheet.querySelector(":scope > .sheet-box") || sheet.querySelector(".sheet-box");
    if (!box) return;
    sheet.dataset.gs = "1";
    const bereich = bereichVon(sheet);
    const oeko = OEKO.has(sheet.id);
    box.classList.add("gs-fenster");
    if (oeko) box.classList.add("gs-oeko");
    box.style.setProperty("--gs-c", FARBE[bereich] || FARBE.friday);
    box.dataset.gsBereich = bereich;

    const kopf = box.querySelector(":scope > .sheet-top");
    if (!kopf) return;
    const h2 = kopf.querySelector(":scope > h2") || kopf.querySelector("h2");
    if (!h2) return;

    // Symbol aus dem Titel (z. B. "⚙ Einstellungen") in den Kern-Ring holen
    let symbol = "";
    const erst = h2.firstChild;
    if (erst && erst.nodeType === 3) {
      const m = erst.nodeValue.match(EMOJI);
      if (m) {
        symbol = m[1];
        const rest = erst.nodeValue.slice(m[0].length);
        const emo = document.createElement("span");
        emo.className = "gs-emo";
        emo.textContent = m[0];
        erst.nodeValue = rest;
        h2.insertBefore(emo, erst);
      }
    }
    const kern = document.createElement("div");
    kern.className = "gs-kern";
    kern.setAttribute("aria-hidden", "true");
    kern.innerHTML = ringeSvg + (oeko ? WUERFEL : symbol ? `<span class="gs-sym">${symbol}</span>` : HIRN);

    const titel = document.createElement("div");
    titel.className = "gs-titel";
    const kicker = document.createElement("small");
    kicker.className = "gs-kicker";
    kicker.textContent = `F.R.Ai.D.A.Y · ${NAME[bereich] || "FRIDAY"}`;
    h2.before(titel);
    titel.append(kicker, h2);
    kopf.prepend(kern);

    const live = document.createElement("span");
    live.className = "gs-live";
    live.innerHTML = `<i></i>LIVE <time class="gs-uhr"></time>`;
    const zu = [...kopf.children].reverse().find((el) => el.tagName === "BUTTON" && (/-x$/.test(el.id) || /^\s*✕\s*$/.test(el.textContent || "")));
    if (zu) { zu.classList.add("gs-zu"); zu.before(live); }
    else kopf.append(live);
    kopf.classList.add("gs-kopf");
    polster(box);
    uhr();
  }

  // Vollbild-Studios: nur Kern-Ring + Glas-Kopfleiste, ihr Inhalt bleibt unangetastet
  const STUDIOS = [
    { sel: ".markt-top", b: "welt" },
    { sel: ".werkstatt-top", b: "erschaffen", oeko: true },
    { sel: ".ws-top", b: "erschaffen", oeko: true },
    { sel: ".schnitt-top", b: "erschaffen", oeko: true },
    { sel: ".vision-top", b: "friday" },
    { sel: ".camera-top", b: "friday" },
    { sel: ".sat-top", b: "friday" },
  ];
  function studiosVeredeln() {
    for (const st of STUDIOS) {
      document.querySelectorAll(st.sel).forEach((kopf) => {
        if (kopf.dataset.gs) return;
        kopf.dataset.gs = "1";
        kopf.classList.add("gs-studio-kopf");
        kopf.style.setProperty("--gs-c", FARBE[st.b]);
        const kern = document.createElement("div");
        kern.className = "gs-kern";
        kern.setAttribute("aria-hidden", "true");
        kern.innerHTML = ringeSvg + (st.oeko ? WUERFEL : HIRN);
        kopf.prepend(kern);
      });
    }
  }

  function alleVeredeln() {
    document.querySelectorAll(".sheet").forEach(veredeln);
    studiosVeredeln();
  }

  // ---------- Werkzeug-Menü in Ökosystem-Farben ----------
  function menuFaerben() {
    const pop = document.getElementById("menu-pop");
    if (!pop || pop.dataset.gs) return;
    pop.dataset.gs = "1";
    pop.classList.add("gs-menu");
    let gruppe = "zentrale";
    for (const el of pop.children) {
      if (el.classList.contains("menu-sep")) {
        gruppe = String(el.textContent || "").trim().toLowerCase();
        el.style.setProperty("--c", FARBE[gruppe] || FARBE.friday);
      } else if (el.classList.contains("menu-row")) {
        el.style.setProperty("--c", FARBE[gruppe] || FARBE.friday);
      }
    }
  }

  // ---------- Uhrzeit in der LIVE-Anzeige (nur offene Fenster) ----------
  function uhr() {
    const d = new Date();
    const t = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    document.querySelectorAll(".sheet:not(.hidden) .gs-uhr").forEach((el) => { el.textContent = t; });
  }
  setInterval(uhr, 1000);

  // Beim Öffnen eines Fensters Polster neu messen (Handy/Mac unterscheiden sich)
  function beiOeffnen(sheet) {
    if (!sheet.dataset.gs) veredeln(sheet);
    const box = sheet.querySelector(".gs-fenster");
    if (box) polster(box);
    uhr();
  }

  alleVeredeln();
  menuFaerben();
  try {
    new MutationObserver((liste) => {
      for (const m of liste) {
        if (m.type === "childList") {
          for (const n of m.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (n.classList.contains("sheet")) veredeln(n);
            else if (n.querySelector) n.querySelectorAll(".sheet").forEach(veredeln);
          }
        } else if (m.type === "attributes" && m.target.classList?.contains("sheet") && !m.target.classList.contains("hidden")) {
          beiOeffnen(m.target);
        }
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  } catch { /* egal */ }
  // Manche Fenster entstehen erst später
  setTimeout(() => { alleVeredeln(); menuFaerben(); }, 1500);
  addEventListener("resize", () => document.querySelectorAll(".sheet:not(.hidden) .gs-fenster").forEach(polster));

  window.FridayStil = { veredeln, FARBE, BEREICH };
})();
