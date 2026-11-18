// F.R.Ai.D.A.Y Tool-Ökosystem (v1.99.0)
// Alle Werkzeuge auf einen Blick: links die Werkzeug-Kacheln (echt aus dem Werkzeug-Menü),
// leuchtende Kabel zum Kern in der Mitte (Live-Status + Logbuch), rechts das Agenten-Team als Pipelines.
// Jede Kachel öffnet das echte Werkzeug, jeder Agent-Knoten das Agenten-Team. Nichts wird vorgetäuscht:
// Zahlen kommen aus /api/status, /api/agents und /api/logbuch.
// Öffnen: Werkzeug-Menü → Tool-Ökosystem, oder „Friday, zeig mir alle Werkzeuge“.
(() => {
  "use strict";
  const F = window.Friday || {};
  const api = F.api;
  if (!api) return;
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const $ = (id) => document.getElementById(id);

  // Akzentfarben: harmonisch zum Neon-Orange, Rot bleibt für Gefahren/Fehler reserviert.
  const FARBE = { zentrale: "#ff8a2a", welt: "#2ee6d0", erschaffen: "#a978ff", friday: "#ff9d3c", alltag: "#4f8dff", system: "#ffc44d" };
  const GRUPPE_FARBE = (name) => FARBE[String(name || "").toLowerCase()] || "#ff8a2a";
  const AGENT_FARBE = { "Organisation": "#a978ff", "Stimme & Medien": "#4f8dff", "Lagezentrum": "#2ee6d0", "Kreativ": "#ffc44d", "Entwicklung & Steuerung": "#ff8a2a" };

  // ---------- 3D-Symbole (SVG, gleiche Formensprache wie die Vorlage) ----------
  const kante = 'stroke="rgba(255,255,255,.55)" stroke-width=".8" stroke-linejoin="round"';
  const FORMEN = [
    // Würfel
    `<path d="M32 8 54 20 32 32 10 20z" fill="var(--c)" ${kante}/><path d="M32 8 54 20 32 32 10 20z" fill="#fff" opacity=".35"/>
     <path d="M10 20 32 32v24L10 44z" fill="var(--c)" ${kante}/><path d="M32 32 54 20v24L32 56z" fill="var(--c)" ${kante}/><path d="M32 32 54 20v24L32 56z" fill="#000" opacity=".35"/>`,
    // Kugel
    `<circle cx="32" cy="32" r="20" fill="var(--c)" ${kante}/><circle cx="32" cy="32" r="20" fill="#000" opacity=".18"/>
     <path d="M14 36a20 20 0 0 0 36 4a24 24 0 0 1-36-4z" fill="#000" opacity=".3"/><ellipse cx="25" cy="23" rx="8" ry="5" fill="#fff" opacity=".45"/>
     <ellipse cx="32" cy="32" rx="20" ry="7" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".8"/>`,
    // Schichten
    `<path d="M32 30 54 41 32 52 10 41z" fill="var(--c)" opacity=".55" ${kante}/><path d="M32 21 54 32 32 43 10 32z" fill="var(--c)" opacity=".8" ${kante}/>
     <path d="M32 12 54 23 32 34 10 23z" fill="var(--c)" ${kante}/><path d="M32 12 54 23 32 34 10 23z" fill="#fff" opacity=".3"/>`,
    // Kristall
    `<path d="M32 6 50 30 32 58 14 30z" fill="var(--c)" ${kante}/><path d="M32 6 50 30H32z" fill="#fff" opacity=".35"/><path d="M14 30h18v28z" fill="#000" opacity=".2"/><path d="M32 30h18L32 58z" fill="#000" opacity=".38"/>`,
    // Würfel-Gruppe
    `<g transform="translate(-9 6) scale(.62)"><path d="M32 8 54 20 32 32 10 20z" fill="var(--c)" ${kante}/><path d="M32 8 54 20 32 32 10 20z" fill="#fff" opacity=".35"/><path d="M10 20 32 32v24L10 44z" fill="var(--c)" ${kante}/><path d="M32 32 54 20v24L32 56z" fill="var(--c)" ${kante}/><path d="M32 32 54 20v24L32 56z" fill="#000" opacity=".35"/></g>
     <g transform="translate(21 18) scale(.62)"><path d="M32 8 54 20 32 32 10 20z" fill="var(--c)" ${kante}/><path d="M32 8 54 20 32 32 10 20z" fill="#fff" opacity=".35"/><path d="M10 20 32 32v24L10 44z" fill="var(--c)" ${kante}/><path d="M32 32 54 20v24L32 56z" fill="var(--c)" ${kante}/><path d="M32 32 54 20v24L32 56z" fill="#000" opacity=".35"/></g>
     <g transform="translate(12 -4) scale(.62)"><path d="M32 8 54 20 32 32 10 20z" fill="var(--c)" ${kante}/><path d="M32 8 54 20 32 32 10 20z" fill="#fff" opacity=".35"/><path d="M10 20 32 32v24L10 44z" fill="var(--c)" ${kante}/><path d="M32 32 54 20v24L32 56z" fill="var(--c)" ${kante}/><path d="M32 32 54 20v24L32 56z" fill="#000" opacity=".35"/></g>`,
    // Molekül
    `<path d="M32 32 16 18M32 32 50 20M32 32 20 50M32 32 48 46" stroke="var(--c)" stroke-width="2.4" opacity=".8"/>
     <circle cx="32" cy="32" r="8" fill="var(--c)" ${kante}/><circle cx="29.5" cy="29.5" r="3" fill="#fff" opacity=".5"/>
     <circle cx="16" cy="18" r="5" fill="var(--c)" ${kante}/><circle cx="50" cy="20" r="4.5" fill="var(--c)" ${kante}/><circle cx="20" cy="50" r="4.5" fill="var(--c)" ${kante}/><circle cx="48" cy="46" r="5" fill="var(--c)" ${kante}/>`,
    // Ring / Scheibe
    `<ellipse cx="32" cy="38" rx="22" ry="10" fill="var(--c)" ${kante}/><ellipse cx="32" cy="38" rx="22" ry="10" fill="#000" opacity=".35"/>
     <path d="M10 32v6c0 5.5 9.8 10 22 10s22-4.5 22-10v-6" fill="var(--c)" opacity=".7"/>
     <ellipse cx="32" cy="32" rx="22" ry="10" fill="var(--c)" ${kante}/><ellipse cx="32" cy="32" rx="22" ry="10" fill="#fff" opacity=".28"/><ellipse cx="32" cy="31" rx="8" ry="3.5" fill="#000" opacity=".35"/>`,
  ];
  const form = (i, farbe, klasse = "") => `<svg class="oe-3d ${klasse}" viewBox="0 0 64 64" style="--c:${farbe}" aria-hidden="true">${FORMEN[i % FORMEN.length]}</svg>`;

  // ---------- Fenster ----------
  const sheet = document.createElement("section");
  sheet.id = "oekosystem";
  sheet.className = "sheet hidden";
  sheet.setAttribute("aria-label", "Fridays Tool-Ökosystem");
  sheet.innerHTML = `<div class="panel sheet-box oe-box" lang="de">
      <header class="sheet-top"><h2>Tool-Ökosystem</h2><span id="oe-zahl" class="oe-zahl"></span><button id="oe-x" class="ghost small" aria-label="Schließen">✕</button></header>
      <div class="oe-stage" id="oe-stage">
        <svg class="oe-kabel" id="oe-kabel" aria-hidden="true"></svg>
        <section class="oe-links" aria-label="Werkzeuge">
          <div class="oe-kopf"><span class="oe-pille">WERKZEUGE</span><span class="oe-suche"><input id="oe-q" type="search" placeholder="Werkzeug suchen …" autocomplete="off"></span></div>
          <div id="oe-gruppen" class="oe-gruppen"></div>
        </section>
        <section class="oe-mitte" aria-label="Fridays Kern">
          <div class="oe-sockel oe-sockel-oben" aria-hidden="true"></div>
          <div class="oe-kern" id="oe-kern">
            <div class="oe-kern-leiste"><i></i><i></i><i></i><span>friday://kern</span><b id="oe-version"></b></div>
            <div class="oe-kern-inhalt">
              <ul class="oe-kern-nav" id="oe-kern-nav"></ul>
              <ol class="oe-feed" id="oe-feed"><li class="muted">Lade …</li></ol>
              <div class="oe-werte" id="oe-werte"></div>
            </div>
            <div class="oe-kern-fuss"><span id="oe-fokus">Tippe ein Werkzeug an.</span><svg id="oe-spark" class="oe-spark" viewBox="0 0 240 40" preserveAspectRatio="none" aria-label="Aktivität heute nach Stunden"></svg></div>
          </div>
          <div class="oe-sockel oe-sockel-unten" aria-hidden="true"></div>
        </section>
        <section class="oe-rechts" aria-label="Agenten-Team">
          <div class="oe-kopf"><span class="oe-pille">AGENTEN-PIPELINES</span><span id="oe-agenten-zahl" class="oe-zahl"></span></div>
          <div id="oe-pipes" class="oe-pipes"><p class="muted">Lade …</p></div>
        </section>
      </div>
      <p class="muted oe-fuss">Alles echt: Kacheln öffnen die Werkzeuge aus dem Werkzeug-Menü, der Kern zeigt Fridays Live-Status und die letzten Einträge aus dem Logbuch, rechts steht dein Agenten-Team mit echtem Status (leuchtend = aktiv, blass = braucht noch Einrichtung oder den Mac). Rot heißt Fehler.</p>
    </div>`;
  ($("app") || document.body).appendChild(sheet);
  const trigger = document.createElement("button");
  trigger.id = "oekosystem-open"; trigger.className = "hidden"; trigger.setAttribute("aria-hidden", "true"); trigger.tabIndex = -1;
  document.body.appendChild(trigger);

  const style = document.createElement("style");
  style.textContent = `
.oe-box { width: min(1480px, 100%); max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; }
.oe-box > * { flex-shrink: 0; }
.oe-box .sheet-top { gap: 10px; }
.oe-box .sheet-top h2 { flex: 1; }
.oe-zahl { font-size: 12px; color: var(--muted); letter-spacing: .06em; }
.oe-stage { position: relative; flex: 1 1 auto; min-height: 0; overflow: auto; display: grid; grid-template-columns: minmax(360px, 1.3fr) minmax(330px, 1fr) minmax(330px, 1.05fr); gap: clamp(26px, 3.2vw, 60px); align-items: start; padding: 6px 4px 10px;
  background: radial-gradient(ellipse at 50% 45%, rgba(255,138,42,.07), transparent 60%); border-radius: 14px; }
.oe-kabel { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; z-index: 0; }
.oe-kabel path { fill: none; stroke-width: 1.6; stroke-linecap: round; opacity: .55; transition: opacity .2s, stroke-width .2s; }
.oe-kabel path.fluss { stroke-width: 2.2; stroke-dasharray: 4 22; opacity: .95; animation: oe-fluss 1.6s linear infinite; }
.oe-kabel path.an { opacity: 1; stroke-width: 2.4; }
.oe-kabel path.fluss.an { animation-duration: .7s; }
@keyframes oe-fluss { to { stroke-dashoffset: -26; } }
.oe-links, .oe-mitte, .oe-rechts { position: relative; z-index: 1; min-width: 0; }
.oe-links { background: linear-gradient(170deg, rgba(40,30,60,.35), rgba(8,8,14,.55)); border: 1px solid rgba(169,120,255,.22); border-radius: 16px; padding: 10px 12px 12px; box-shadow: inset 0 0 30px rgba(120,90,255,.06); }
.oe-kopf { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.oe-pille { font: 600 10px/1 var(--font-head); letter-spacing: .2em; color: var(--muted); padding: 6px 10px; border: 1px solid rgba(255,255,255,.1); border-radius: 999px; background: rgba(255,255,255,.03); }
.oe-suche { flex: 1; }
.oe-suche input { width: 100%; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); color: inherit; font: inherit; font-size: 13px; }
.oe-gruppen { display: flex; flex-direction: column; gap: 6px; }
.oe-gruppe { position: relative; padding-right: 22px; }
.oe-gruppe h4 { margin: 0 0 4px; font: 600 10px/1 var(--font-head); letter-spacing: .22em; text-transform: uppercase; color: var(--c); opacity: .9; }
.oe-port { position: absolute; right: -2px; top: 50%; width: 18px; height: 18px; margin-top: -9px; border-radius: 50%; display: grid; place-items: center; font: 700 13px/1 system-ui; color: #0b0b10;
  background: var(--c); box-shadow: 0 0 10px var(--c), 0 0 2px #fff inset; }
.oe-kacheln { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 6px; }
.oe-kachel { --c: #ff8a2a; position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 5px 4px; min-height: 64px; border-radius: 12px; cursor: pointer; color: inherit; font: inherit; text-align: center;
  background: linear-gradient(165deg, color-mix(in srgb, var(--c) 30%, rgba(20,16,30,.6)), color-mix(in srgb, var(--c) 7%, rgba(8,8,12,.85)));
  border: 1px solid color-mix(in srgb, var(--c) 50%, transparent); box-shadow: inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 18px color-mix(in srgb, var(--c) 20%, transparent);
  transition: transform .15s, box-shadow .15s, border-color .15s; }
.oe-box .oe-kachel:hover, .oe-box .oe-kachel:focus-visible { background: linear-gradient(165deg, color-mix(in srgb, var(--c) 38%, rgba(20,16,30,.6)), color-mix(in srgb, var(--c) 10%, rgba(8,8,12,.85))); color: inherit; transform: translateY(-2px); border-color: var(--c); box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 0 16px color-mix(in srgb, var(--c) 45%, transparent), inset 0 0 22px color-mix(in srgb, var(--c) 30%, transparent); outline: none; }
.oe-kachel .oe-3d { width: 30px; height: 30px; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--c) 70%, transparent)); }
.oe-kachel .oe-name { font-size: 10.5px; line-height: 1.15; font-weight: 600; color: #f3eee8; max-width: 100%; overflow-wrap: anywhere; hyphens: auto; }
.oe-kachel .mi { position: absolute; right: 6px; top: 6px; width: 13px; height: 13px; color: var(--c); opacity: .85; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.oe-kachel.weg { display: none; }
.oe-mitte { display: flex; flex-direction: column; justify-content: center; gap: 0; position: sticky; top: 0; align-self: center; }
.oe-sockel { height: 54px; margin: 0 14%; background:
  linear-gradient(90deg, transparent 49.6%, rgba(255,138,42,.35) 50%, transparent 50.4%) center/100% 100% no-repeat;
  position: relative; }
.oe-sockel::before { content: ""; position: absolute; left: 50%; width: 58%; aspect-ratio: 2 / 1; transform: translateX(-50%); border: 1px solid rgba(255,138,42,.32);
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); background: linear-gradient(180deg, rgba(255,138,42,.10), rgba(255,138,42,.02)); }
.oe-sockel-oben::before { bottom: 0; } .oe-sockel-unten::before { top: 0; }
.oe-kern { border-radius: 14px; border: 1px solid rgba(255,138,42,.45); background: linear-gradient(180deg, rgba(22,16,10,.92), rgba(10,8,6,.95));
  box-shadow: 0 0 0 1px rgba(255,138,42,.08), 0 0 40px rgba(255,138,42,.16), inset 0 0 40px rgba(255,138,42,.05); overflow: hidden; }
.oe-kern-leiste { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-bottom: 1px solid rgba(255,138,42,.18); font: 600 11px/1 ui-monospace, Menlo, monospace; color: var(--muted); }
.oe-kern-leiste i { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,138,42,.5); }
.oe-kern-leiste i:nth-child(2) { opacity: .6; } .oe-kern-leiste i:nth-child(3) { opacity: .35; }
.oe-kern-leiste span { margin-left: 6px; flex: 1; } .oe-kern-leiste b { color: var(--cyan); font-weight: 600; }
.oe-kern-inhalt { display: grid; grid-template-columns: 104px 1fr 88px; min-height: 230px; }
.oe-kern-nav { list-style: none; margin: 0; padding: 8px 0 8px 8px; border-right: 1px solid rgba(255,255,255,.06); font: 11px/1.9 ui-monospace, Menlo, monospace; color: var(--muted); }
.oe-kern-nav li { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.oe-kern-nav li::before { content: ""; width: 6px; height: 6px; border-radius: 2px; background: var(--c); box-shadow: 0 0 6px var(--c); }
.oe-kern-nav b { color: #f3eee8; font-weight: 600; margin-left: auto; padding-right: 8px; }
.oe-feed { list-style: none; margin: 0; padding: 8px 10px; font: 11px/1.65 ui-monospace, Menlo, monospace; overflow: hidden; max-height: 260px; counter-reset: z; }
.oe-feed li { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #e8dfd4; counter-increment: z; }
.oe-feed li::before { content: counter(z); display: inline-block; width: 18px; color: rgba(255,255,255,.22); }
.oe-feed .t { color: rgba(255,255,255,.4); } .oe-feed .k { color: var(--cyan); } .oe-feed .fehler, .oe-feed .fehler .k { color: #ff4d4d; }
.oe-feed li.neu { animation: oe-neu 1.2s ease-out; }
@keyframes oe-neu { from { background: rgba(255,138,42,.25); } to { background: transparent; } }
.oe-werte { border-left: 1px solid rgba(255,255,255,.06); padding: 8px 10px; display: flex; flex-direction: column; gap: 8px; }
.oe-wert { font: 10px/1.2 ui-monospace, Menlo, monospace; color: var(--muted); }
.oe-wert b { display: block; font: 600 14px/1.25 var(--font-head); color: #f3eee8; }
.oe-wert.gut b { color: #5fe3a1; } .oe-wert.aus b { color: var(--muted); } .oe-wert.rot b { color: #ff4d4d; }
.oe-kern-fuss { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-top: 1px solid rgba(255,255,255,.06); font-size: 12px; color: var(--muted); }
.oe-kern-fuss span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oe-spark { width: 44%; height: 34px; flex-shrink: 0; }
.oe-pipes { display: flex; flex-direction: column; gap: 12px; }
.oe-pipe { --c: #ff8a2a; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 14px; cursor: pointer; color: inherit; font: inherit; text-align: left; width: 100%;
  background: linear-gradient(90deg, color-mix(in srgb, var(--c) 10%, rgba(10,10,16,.75)), rgba(10,10,16,.55)); border: 1px solid color-mix(in srgb, var(--c) 28%, transparent); transition: border-color .15s, box-shadow .15s; }
.oe-box .oe-pipe:hover, .oe-box .oe-pipe:focus-visible { background: linear-gradient(90deg, color-mix(in srgb, var(--c) 16%, rgba(10,10,16,.75)), rgba(10,10,16,.55)); color: inherit; border-color: var(--c); box-shadow: 0 0 14px color-mix(in srgb, var(--c) 30%, transparent); outline: none; }
.oe-pipe-ic { flex-shrink: 0; width: 54px; height: 54px; border-radius: 12px; display: grid; place-items: center; background: linear-gradient(160deg, color-mix(in srgb, var(--c) 40%, #120e18), color-mix(in srgb, var(--c) 10%, #0a0a10));
  border: 1px solid color-mix(in srgb, var(--c) 70%, transparent); box-shadow: 0 0 14px color-mix(in srgb, var(--c) 35%, transparent), inset 0 1px 0 rgba(255,255,255,.18); }
.oe-pipe-ic .oe-3d { width: 34px; height: 34px; }
.oe-pipe-mitte { flex: 1; min-width: 0; }
.oe-pipe-titel { font: 600 10px/1 var(--font-head); letter-spacing: .16em; text-transform: uppercase; color: var(--c); margin-bottom: 7px; }
.oe-pipe-kette { position: relative; display: flex; align-items: center; gap: 8px; overflow: hidden; padding: 2px 0; }
.oe-pipe-kette::before { content: ""; position: absolute; left: 0; right: 0; top: 50%; border-top: 1px dashed color-mix(in srgb, var(--c) 55%, transparent); }
.oe-pipe-kette::after { content: ""; position: absolute; left: 0; top: 50%; width: 100%; height: 2px; margin-top: -1px; pointer-events: none;
  background: linear-gradient(90deg, transparent 0, transparent 40%, var(--c) 48%, #fff 50%, var(--c) 52%, transparent 60%, transparent 100%); opacity: .85;
  animation: oe-puls 2.8s linear infinite; will-change: transform; }
@keyframes oe-puls { from { transform: translateX(-60%); } to { transform: translateX(60%); } }
.oe-knoten { position: relative; z-index: 1; flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-size: 14px; line-height: 1;
  background: #0d0b12; border: 1px solid color-mix(in srgb, var(--c) 75%, transparent); box-shadow: 0 0 8px color-mix(in srgb, var(--c) 40%, transparent); }
.oe-knoten.aus { filter: grayscale(1); opacity: .42; box-shadow: none; border-color: rgba(255,255,255,.18); }
.oe-ziel { flex-shrink: 0; position: relative; width: 56px; height: 56px; display: grid; place-items: center; text-align: center; font: 600 13px/1 var(--font-head); color: #f3eee8; }
.oe-ziel small { display: block; font: 8px/1.2 ui-monospace, Menlo, monospace; color: var(--muted); margin-top: 2px; }
.oe-ziel::before, .oe-ziel::after { content: ""; position: absolute; inset: 4px; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--c) 70%, transparent); box-shadow: 0 0 12px color-mix(in srgb, var(--c) 35%, transparent); }
.oe-ziel::after { inset: -2px; border-style: dashed; opacity: .55; box-shadow: none; animation: oe-dreh 14s linear infinite; }
@keyframes oe-dreh { to { transform: rotate(360deg); } }
.oe-fuss { margin: 10px 2px 0; font-size: 12px; }
html.perf-fluessig .oe-kachel .oe-3d { filter: none; }
html.perf-fluessig .oe-kabel path.fluss { animation-duration: 2.4s; }
@media (prefers-reduced-motion: reduce) { .oe-kabel path.fluss, .oe-pipe-kette::after, .oe-ziel::after, .oe-feed li.neu { animation: none !important; } }
@media (max-width: 1100px) {
  .oe-stage { grid-template-columns: 1fr; gap: 0; overflow: visible; background: none; flex: none; }
  .oe-mitte { position: relative; align-self: stretch; }
  .oe-box { overflow-y: auto; }
  .oe-kabel { display: none; }
  .oe-mitte { order: -1; }
  .oe-sockel { display: none; }
  .oe-links, .oe-rechts { margin-top: 26px; }
  .oe-links::before, .oe-rechts::before { content: ""; position: absolute; left: 50%; top: -26px; height: 26px; border-left: 2px dashed rgba(255,138,42,.55); }
  .oe-kern-inhalt { grid-template-columns: 1fr; min-height: 0; }
  .oe-kern-nav { display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 8px 12px; border-right: 0; border-bottom: 1px solid rgba(255,255,255,.06); }
  .oe-kern-nav b { margin-left: 4px; padding: 0; }
  .oe-feed { max-height: 140px; }
  .oe-werte { border-left: 0; border-top: 1px solid rgba(255,255,255,.06); display: grid; grid-template-columns: repeat(3, 1fr); }
  .oe-gruppe { padding-right: 0; }
  .oe-port { display: none; }
  .oe-kacheln { grid-template-columns: repeat(auto-fill, minmax(74px, 1fr)); gap: 7px; }
  .oe-kachel { min-height: 84px; }
  .oe-kachel .oe-3d { width: 34px; height: 34px; }
  .oe-kachel:hover { transform: none; }
  .oe-pipe-kette { overflow-x: auto; scrollbar-width: none; }
  .oe-pipe-kette::-webkit-scrollbar { display: none; }
  .oe-pipe-ic { width: 46px; height: 46px; } .oe-ziel { width: 48px; height: 48px; }
  .oe-spark { width: 38%; }
}`;
  document.head.appendChild(style);

  // ---------- Werkzeuge echt aus dem Werkzeug-Menü lesen ----------
  function werkzeugeLesen() {
    const pop = $("menu-pop");
    const gruppen = [];
    let akt = { name: "Zentrale", werkzeuge: [] };
    gruppen.push(akt);
    if (!pop) return gruppen;
    for (const el of pop.children) {
      if (el.classList.contains("menu-sep")) { akt = { name: el.textContent.trim(), werkzeuge: [] }; gruppen.push(akt); continue; }
      if (!el.classList.contains("menu-row") || el.dataset.target === "oekosystem-open") continue;
      const svg = el.querySelector("svg");
      const name = el.textContent.trim();
      if (!name) continue;
      akt.werkzeuge.push({ name, svg: svg ? svg.outerHTML : "", target: el.dataset.target || "", osiris: el.hasAttribute("data-osiris"), href: el.getAttribute("href") || "", row: el });
    }
    return gruppen.filter((g) => g.werkzeuge.length);
  }

  let gruppen = [], agenten = null, status = null, logbuch = null, timer = null, letzteIds = new Set(), formZaehler = 0;

  function zeichneWerkzeuge() {
    gruppen = werkzeugeLesen();
    formZaehler = 0;
    const gesamt = gruppen.reduce((n, g) => n + g.werkzeuge.length, 0);
    $("oe-zahl").textContent = `${gesamt} Werkzeuge · ${gruppen.length} Bereiche`;
    $("oe-gruppen").innerHTML = gruppen.map((g, gi) => {
      const c = GRUPPE_FARBE(g.name);
      return `<div class="oe-gruppe" data-g="${gi}" style="--c:${c}"><h4>${esc(g.name)}</h4>
        <div class="oe-kacheln">${g.werkzeuge.map((w, wi) => `<button type="button" class="oe-kachel" data-g="${gi}" data-w="${wi}" style="--c:${c}" title="${esc(w.name)} öffnen">
          ${w.svg ? w.svg.replace("<svg", '<svg aria-hidden="true"') : ""}${form(formZaehler++, c)}<span class="oe-name">${esc(w.name.replace(/\s*\(.*\)$/, ""))}</span></button>`).join("")}</div>
        <span class="oe-port" aria-hidden="true">+</span></div>`;
    }).join("");
    $("oe-kern-nav").innerHTML = gruppen.map((g) => `<li style="--c:${GRUPPE_FARBE(g.name)}">${esc(g.name)}<b>${g.werkzeuge.length}</b></li>`).join("");
  }

  function zeichneAgenten() {
    const box = $("oe-pipes");
    if (!agenten) { box.innerHTML = `<p class="muted">Agenten-Team nicht erreichbar.</p>`; return; }
    $("oe-agenten-zahl").textContent = `${agenten.aktiv}/${agenten.gesamt} aktiv`;
    const formen = [3, 4, 1, 5, 2];
    box.innerHTML = (agenten.categories || []).map((cat, i) => {
      const liste = agenten.agents.filter((a) => a.cat === cat);
      const aktiv = liste.filter((a) => a.status === "aktiv").length;
      const c = AGENT_FARBE[cat] || "#ff8a2a";
      return `<button type="button" class="oe-pipe" data-cat="${esc(cat)}" style="--c:${c}" title="Agenten-Team öffnen">
        <span class="oe-pipe-ic">${form(formen[i % formen.length], c)}</span>
        <span class="oe-pipe-mitte"><span class="oe-pipe-titel">${esc(cat)}</span>
          <span class="oe-pipe-kette">${liste.map((a) => `<span class="oe-knoten${a.status === "aktiv" ? "" : " aus"}" title="${esc(a.name)} – ${esc(a.hint || a.status)}">${esc(a.emoji || "•")}</span>`).join("")}</span></span>
        <span class="oe-ziel">${aktiv}/${liste.length}<small>aktiv</small></span></button>`;
    }).join("");
  }

  function zeichneKern() {
    const s = status || {};
    $("oe-version").textContent = s.version ? `v${s.version}` : "";
    const w = (label, wert, art) => `<div class="oe-wert ${art || ""}">${esc(label)}<b>${esc(wert)}</b></div>`;
    const fehler = logbuch?.fehler || 0;
    $("oe-werte").innerHTML = [
      w("Mac-Agent", s.agent?.online ? "verbunden" : "offline", s.agent?.online ? "gut" : "aus"),
      w("Stimme", s.voice ? "ElevenLabs" : "Gerät", s.voice ? "gut" : "aus"),
      w("Agenten", agenten ? `${agenten.aktiv}/${agenten.gesamt}` : "–"),
      w("Heute", logbuch ? `${logbuch.gesamt} Aktionen` : "–"),
      w("Fehler heute", String(fehler), fehler ? "rot" : "gut"),
      w("Telegram", s.telegram ? "an" : "aus", s.telegram ? "gut" : "aus"),
    ].join("");
    const feed = $("oe-feed");
    const eintraege = (logbuch?.eintraege || []).slice(0, 12);
    if (!logbuch) feed.innerHTML = `<li class="fehler">Logbuch nicht erreichbar.</li>`;
    else if (!eintraege.length) feed.innerHTML = `<li class="muted">Heute noch keine Einträge.</li>`;
    else {
      const neu = new Set(eintraege.map((e) => e.id));
      feed.innerHTML = eintraege.map((e) => {
        const t = new Date(e.at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const ist = letzteIds.size && !letzteIds.has(e.id) ? " neu" : "";
        return `<li class="${e.ok === false ? "fehler" : ""}${ist}" title="${esc(e.titel)}"><span class="t">${t}</span> <span class="k">${esc(e.bereich)}</span> ${esc(e.titel)}</li>`;
      }).join("");
      letzteIds = neu;
    }
    // Aktivität pro Stunde (heute) als feine Linie
    const stunden = new Array(24).fill(0);
    for (const e of logbuch?.eintraege || []) stunden[new Date(e.at).getHours()]++;
    const max = Math.max(1, ...stunden);
    const pts = stunden.map((n, i) => `${(i / 23 * 240).toFixed(1)},${(36 - n / max * 32).toFixed(1)}`).join(" ");
    $("oe-spark").innerHTML = `<polyline points="0,36 ${pts} 240,36" fill="rgba(255,138,42,.12)" stroke="none"/><polyline points="${pts}" fill="none" stroke="var(--cyan)" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`;
  }

  // ---------- Kabel (nur breite Ansicht) ----------
  let rafKabel = 0;
  function kabelPlanen() { cancelAnimationFrame(rafKabel); rafKabel = requestAnimationFrame(zeichneKabel); }
  function zeichneKabel() {
    const svg = $("oe-kabel"), stage = $("oe-stage"), kern = $("oe-kern");
    if (!svg || !offen() || getComputedStyle(svg).display === "none") return;
    const sb = stage.getBoundingClientRect();
    const ox = stage.scrollLeft - sb.left, oy = stage.scrollTop - sb.top;
    svg.setAttribute("width", stage.scrollWidth); svg.setAttribute("height", stage.scrollHeight);
    svg.style.width = `${stage.scrollWidth}px`; svg.style.height = `${stage.scrollHeight}px`;
    const kb = kern.getBoundingClientRect();
    let html = "";
    const ports = [...stage.querySelectorAll(".oe-port")];
    ports.forEach((p, i) => {
      const r = p.getBoundingClientRect();
      const x1 = r.right + ox, y1 = r.top + r.height / 2 + oy;
      const x2 = kb.left + ox, y2 = kb.top + oy + kb.height * (0.2 + 0.6 * (ports.length > 1 ? i / (ports.length - 1) : 0.5));
      const mx = (x1 + x2) / 2;
      const c = p.parentElement.style.getPropertyValue("--c");
      const d = `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
      html += `<path d="${d}" stroke="${c}" data-g="${p.parentElement.dataset.g}"/><path class="fluss" d="${d}" stroke="${c}" data-g="${p.parentElement.dataset.g}"/>`;
    });
    const pipes = [...stage.querySelectorAll(".oe-pipe-ic")];
    pipes.forEach((p, i) => {
      const r = p.getBoundingClientRect();
      const x1 = kb.right + ox, y1 = kb.top + oy + kb.height * (0.2 + 0.6 * (pipes.length > 1 ? i / (pipes.length - 1) : 0.5));
      const x2 = r.left + ox, y2 = r.top + r.height / 2 + oy;
      const mx = (x1 + x2) / 2;
      const c = p.parentElement.style.getPropertyValue("--c");
      const d = `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
      html += `<path d="${d}" stroke="${c}"/><path class="fluss" d="${d}" stroke="${c}" style="animation-direction:reverse"/>`;
    });
    svg.innerHTML = html;
  }

  // ---------- Daten ----------
  async function json(url) { try { const r = await api(url); return r.ok ? await r.json() : null; } catch { return null; } }
  async function laden() {
    const [a, s, l] = await Promise.all([json("/api/agents"), json("/api/status"), json("/api/logbuch?limit=400")]);
    agenten = a; status = s; logbuch = l;
    if (!offen()) return;
    zeichneAgenten(); zeichneKern(); kabelPlanen();
  }

  // ---------- Bedienung ----------
  function werkzeugOeffnen(w) {
    schliessen();
    if (w.href) { try { window.open(w.href, "_blank", "noopener"); } catch { location.href = w.href; } return; }
    // Genau wie ein Klick im Werkzeug-Menü – so öffnet sich immer das echte Werkzeug.
    w.row?.click();
  }
  $("oe-gruppen").addEventListener("click", (e) => {
    const k = e.target.closest(".oe-kachel"); if (!k) return;
    const w = gruppen[k.dataset.g]?.werkzeuge[k.dataset.w];
    if (w) werkzeugOeffnen(w);
  });
  const fokus = (k) => {
    $("oe-kabel").querySelectorAll("path").forEach((p) => p.classList.toggle("an", !!k && p.dataset.g === k.dataset.g));
    const w = k && gruppen[k.dataset.g]?.werkzeuge[k.dataset.w];
    $("oe-fokus").textContent = w ? `→ ${w.name} öffnen` : "Tippe ein Werkzeug an.";
  };
  $("oe-gruppen").addEventListener("pointerover", (e) => fokus(e.target.closest(".oe-kachel")));
  $("oe-gruppen").addEventListener("focusin", (e) => fokus(e.target.closest(".oe-kachel")));
  $("oe-gruppen").addEventListener("pointerleave", () => fokus(null));
  $("oe-pipes").addEventListener("click", (e) => { if (!e.target.closest(".oe-pipe")) return; schliessen(); $("agents-open")?.click(); });
  $("oe-q").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    sheet.querySelectorAll(".oe-kachel").forEach((k) => k.classList.toggle("weg", !!q && !k.textContent.toLowerCase().includes(q)));
    sheet.querySelectorAll(".oe-gruppe").forEach((g) => { g.style.display = g.querySelector(".oe-kachel:not(.weg)") ? "" : "none"; });
    kabelPlanen();
  });
  $("oe-x").addEventListener("click", () => schliessen());
  sheet.addEventListener("click", (e) => { if (e.target === sheet) schliessen(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && offen()) schliessen(); });
  trigger.addEventListener("click", () => oeffnen());

  const ro = "ResizeObserver" in window ? new ResizeObserver(() => kabelPlanen()) : null;
  $("oe-stage").addEventListener("scroll", kabelPlanen, { passive: true });

  function offen() { return !sheet.classList.contains("hidden"); }
  function oeffnen() {
    sheet.classList.remove("hidden");
    $("menu-pop")?.classList.add("hidden");
    zeichneWerkzeuge(); zeichneAgenten(); zeichneKern(); kabelPlanen();
    ro?.observe($("oe-stage"));
    laden();
    clearInterval(timer);
    timer = setInterval(() => { if (offen() && !document.hidden) laden(); }, 10000);
  }
  function schliessen() { sheet.classList.add("hidden"); clearInterval(timer); timer = null; ro?.disconnect(); $("oe-kabel").innerHTML = ""; letzteIds = new Set(); }
  window.addEventListener("resize", kabelPlanen);

  window.FridayOekosystem = { open: oeffnen, close: schliessen, offen };
})();
