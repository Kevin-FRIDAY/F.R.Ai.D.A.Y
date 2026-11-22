// F.R.Ai.D.A.Y Zerlege-Labor (v1.140.0, zuerst nur in Eve): Modelle aus Fridays Teile-Datenbank
// (server/src/teilebank.js) in 3D, detailgetreu und zum Anfassen:
//  • Teil antippen → Wissen dazu (Funktion, Material, Gewicht, wie man es in echt ausbaut)
//  • Teil oder ganze Baugruppe herausnehmen (z. B. Karosserie abheben, dann Motor mit dem Kran heraus)
//  • Teil greifen und verschieben, Explosionsansicht, Röntgen (Hülle durchsichtig)
//  • "Motor an": Kolben, Kurbelwelle, Räder, Lüfter, Turbinen und Zahnräder bewegen sich
//  • "Zerlegen-Show": Friday baut alles Schritt für Schritt auseinander und erklärt es
// In Friday gesperrt, bis Kevin es in Eve freigibt (server/eve-funktionen.json, id "zerlege-labor").
(() => {
  "use strict";
  const THREE = window.THREE;
  const $ = (id) => document.getElementById(id);
  const host = $("werkstatt");
  if (!THREE || !host || !window.Friday) return;
  const { api, escapeHtml } = window.Friday;
  const sag = (t) => { try { window.Friday.say?.(t, { hinweis: false }); } catch { /* egal */ } };
  const FUNKTION = "zerlege-labor";
  const darf = () => !window.FridayEve || window.FridayEve.frei(FUNKTION);

  // ---------- Oberfläche ----------
  const el = document.createElement("section");
  el.id = "zerlegelabor";
  el.className = "zerlegelabor hidden";
  el.setAttribute("aria-label", "Zerlege-Labor");
  el.innerHTML = `
    <canvas class="zl-canvas"></canvas>
    <header class="zl-top">
      <div class="zl-brand">FRIDAY · ZERLEGE-LABOR</div>
      <div class="zl-modelle" role="tablist" aria-label="Modelle"></div>
      <button type="button" class="zl-x" title="Zurück zur Werkstatt">✕</button>
    </header>
    <details class="zl-side" open>
      <summary><span class="zl-sym"></span><b class="zl-name">Lädt …</b></summary>
      <p class="zl-kurz"></p>
      <ul class="zl-daten"></ul>
      <div class="zl-ueber">BAUGRUPPEN <small>tippen = heraus/hinein</small></div>
      <div class="zl-gruppen"></div>
    </details>
    <div class="zl-info hidden" role="dialog" aria-label="Bauteil"></div>
    <div class="zl-caption" aria-live="polite">Tipp ein Teil an. Ziehen dreht, ein Teil festhalten und ziehen verschiebt es.</div>
    <footer class="zl-leiste">
      <div class="zl-reihe">
      <button type="button" data-a="lauf" class="zl-k">▶ Motor an</button>
      <label class="zl-explo" title="Explosionsansicht"><span>💥</span><input type="range" min="0" max="100" value="0" aria-label="Explosionsansicht"></label>
      <button type="button" data-a="roentgen" class="zl-k">🩻 Röntgen</button>
      <button type="button" data-a="show" class="zl-k">🎬 Zerlegen-Show</button>
      <button type="button" data-a="reset" class="zl-k">↺ Alles einbauen</button>
      </div>
      <form class="zl-befehl"><input type="text" placeholder="z. B. Motor raus, zeig nur die Kolben" autocomplete="off" aria-label="Befehl"><button type="submit" class="zl-k">➤</button></form>
    </footer>`;
  host.appendChild(el);
  if (window.innerWidth < 900) el.querySelector(".zl-side").open = false;
  const q = (s) => el.querySelector(s);
  const canvas = q(".zl-canvas");

  const st = document.createElement("style");
  st.textContent = `
.zerlegelabor { position: absolute; inset: 0; z-index: 22; background: radial-gradient(ellipse at 50% 35%, #1a1f27 0%, #0b0e13 60%, #06080b 100%); color: #f3f5f8; overflow: hidden; font-family: var(--font-body, system-ui, -apple-system, sans-serif); --zl: var(--cyan, #ff8a1e); }
.zerlegelabor.hidden { display: none; }
.zl-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
.zl-canvas.greift { cursor: grabbing; }
.zl-top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: calc(10px + env(safe-area-inset-top)) 14px 10px; background: linear-gradient(180deg, rgba(5,7,10,.85), rgba(5,7,10,0)); z-index: 2; }
.zl-brand { font: 700 12px/1 var(--font-head, ui-monospace, monospace); letter-spacing: .2em; color: var(--zl); white-space: nowrap; text-shadow: 0 0 12px color-mix(in srgb, var(--zl) 60%, transparent); }
.zl-modelle { flex: 1; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 2px; }
.zl-modelle::-webkit-scrollbar { display: none; }
.zl-modelle button { flex: none; border-radius: 999px; padding: 7px 12px; font: inherit; font-size: 13px; color: #e9edf2; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); cursor: pointer; white-space: nowrap; }
.zl-modelle button.on { color: #120800; background: linear-gradient(135deg, var(--zl), color-mix(in srgb, var(--zl) 55%, #fff)); border-color: var(--zl); box-shadow: 0 0 16px color-mix(in srgb, var(--zl) 45%, transparent); font-weight: 700; }
.zl-x { flex: none; width: 38px; height: 38px; border-radius: 50%; border: 1px solid rgba(255,255,255,.2); background: rgba(0,0,0,.4); color: #fff; font-size: 16px; cursor: pointer; }
.zl-side { position: absolute; left: 14px; top: 64px; width: 270px; max-height: calc(100% - 160px); overflow-y: auto; padding: 12px 14px; border-radius: 16px; background: rgba(8,11,15,.72); border: 1px solid color-mix(in srgb, var(--zl) 30%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 2; box-shadow: 0 10px 30px rgba(0,0,0,.4); }
.zl-side summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 15px; }
.zl-side summary::-webkit-details-marker { display: none; }
.zl-side summary::after { content: "▾"; margin-left: auto; opacity: .6; }
.zl-side:not([open]) summary::after { content: "▸"; }
.zl-sym { font-size: 20px; }
.zl-kurz { margin: 8px 0; font-size: 13px; line-height: 1.4; opacity: .8; }
.zl-daten { list-style: none; margin: 0 0 10px; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.zl-daten li { padding: 6px 8px; border-radius: 9px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07); }
.zl-daten small { display: block; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; opacity: .6; }
.zl-daten b { font-size: 12.5px; }
.zl-ueber { font: 700 10.5px/1 var(--font-head, monospace); letter-spacing: .16em; color: var(--zl); margin: 4px 0 6px; }
.zl-ueber small { font: 400 10.5px/1 system-ui, sans-serif; letter-spacing: 0; opacity: .6; color: #fff; margin-left: 4px; }
.zl-gruppen { display: flex; flex-direction: column; gap: 5px; }
.zl-gr { display: flex; align-items: center; gap: 6px; }
.zl-gr button { font: inherit; cursor: pointer; }
.zl-gr .zl-g-name { flex: 1; text-align: left; display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 10px; color: #eef1f5; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); font-size: 13.5px; }
.zl-gr .zl-g-name i { font-style: normal; margin-left: auto; font-size: 11px; opacity: .55; }
.zl-gr.raus .zl-g-name { border-color: var(--zl); background: color-mix(in srgb, var(--zl) 16%, transparent); }
.zl-gr.raus .zl-g-name i { opacity: 1; color: var(--zl); }
.zl-gr .zl-g-auge { width: 34px; height: 34px; border-radius: 10px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); color: #fff; font-size: 14px; }
.zl-gr.aus .zl-g-auge { opacity: .4; }
.zl-gr.aus .zl-g-name { opacity: .45; }
.zl-info { position: absolute; right: 14px; top: 64px; width: 330px; max-height: calc(100% - 160px); overflow-y: auto; padding: 14px 16px; border-radius: 16px; background: rgba(8,11,15,.86); border: 1px solid var(--zl); box-shadow: 0 0 26px color-mix(in srgb, var(--zl) 30%, transparent), 0 10px 30px rgba(0,0,0,.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 3; }
.zl-info.hidden { display: none; }
.zl-info .zl-i-kopf { display: flex; align-items: flex-start; gap: 8px; }
.zl-info .zl-i-kopf small { display: block; font: 700 10px/1.2 var(--font-head, monospace); letter-spacing: .14em; color: var(--zl); text-transform: uppercase; margin-bottom: 3px; }
.zl-info .zl-i-kopf b { font-size: 17px; line-height: 1.25; }
.zl-info .zl-i-zu { margin-left: auto; border: 0; background: none; color: #fff; opacity: .7; font-size: 18px; cursor: pointer; }
.zl-info dl { margin: 10px 0; display: grid; grid-template-columns: 84px 1fr; gap: 6px 10px; font-size: 13px; line-height: 1.4; }
.zl-info dt { opacity: .6; }
.zl-info dd { margin: 0; }
.zl-info .zl-i-wissen { font-size: 13px; line-height: 1.4; padding: 8px 10px; border-radius: 10px; background: color-mix(in srgb, var(--zl) 12%, transparent); border-left: 3px solid var(--zl); }
.zl-info .zl-i-knoepfe { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.zl-k { border-radius: 11px; padding: 9px 13px; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; color: var(--zl); background: rgba(0,0,0,.35); border: 1px solid color-mix(in srgb, var(--zl) 70%, transparent); white-space: nowrap; }
.zl-k.haupt, .zl-k.on { color: #120800; background: linear-gradient(135deg, var(--zl), color-mix(in srgb, var(--zl) 55%, #fff)); border-color: var(--zl); box-shadow: 0 0 16px color-mix(in srgb, var(--zl) 40%, transparent); }
.zl-caption { position: absolute; left: 50%; bottom: 84px; transform: translateX(-50%); max-width: min(720px, calc(100% - 32px)); text-align: center; font-size: 14px; line-height: 1.4; padding: 8px 14px; border-radius: 12px; background: rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.08); pointer-events: none; z-index: 2; }
.zl-leiste { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 8px; padding: 12px 14px calc(12px + env(safe-area-inset-bottom)); background: linear-gradient(0deg, rgba(5,7,10,.9), rgba(5,7,10,0)); z-index: 2; overflow-x: auto; scrollbar-width: none; }
.zl-leiste::-webkit-scrollbar { display: none; }
.zl-explo { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 11px; border: 1px solid color-mix(in srgb, var(--zl) 50%, transparent); background: rgba(0,0,0,.35); }
.zl-explo input { width: 120px; accent-color: var(--zl); }
.zl-befehl { flex: 1; min-width: 220px; display: flex; gap: 6px; }
.zl-befehl input { flex: 1; min-width: 0; padding: 9px 12px; border-radius: 11px; border: 1px solid rgba(255,255,255,.16); background: rgba(0,0,0,.45); color: #fff; font: inherit; font-size: 16px; }
.zl-befehl input:focus { outline: none; border-color: var(--zl); }
@media (max-width: 900px) {
  .zl-brand { display: none; }
  .zl-side { top: auto; left: 10px; right: 10px; width: auto; padding: 10px 12px; }
  .zl-side:not([open]) { right: auto; }
  .zl-info { left: 10px; right: 10px; width: auto; top: calc(60px + env(safe-area-inset-top)); max-height: 46%; }
  .zl-caption { font-size: 13px; }
  .zl-leiste .zl-k { padding: 8px 10px; font-size: 13px; }
  .zl-explo input { width: 90px; }
  .zerlegelabor.info-offen .zl-side { display: none; }
}
.zl-reihe { display: flex; align-items: center; gap: 8px; flex: none; }
/* Eves „Ändern“-Knopf wandert nach oben, solange das Labor offen ist (sonst liegt er auf der Leiste) */
html.eve-modus body:has(#zerlegelabor:not(.hidden)) #eve-aendern { bottom: auto; top: calc(66px + env(safe-area-inset-top)); }
@media (max-width: 900px) {
  .zl-leiste { flex-direction: column; align-items: stretch; flex-wrap: nowrap; gap: 8px; overflow: visible; }
  .zl-reihe { overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
  .zl-reihe::-webkit-scrollbar { display: none; }
  .zl-befehl { flex: none; min-width: 0; }
  .zl-side { bottom: calc(118px + env(safe-area-inset-bottom)); max-height: 46%; }
  .zl-caption { bottom: calc(176px + env(safe-area-inset-bottom)); }
  html.eve-modus .zl-info { top: calc(112px + env(safe-area-inset-top)); max-height: 42%; }
  .zl-side[open] ~ .zl-caption { display: none; }
  html.eve-modus body:has(#zerlegelabor:not(.hidden)) #eve-aendern { top: calc(62px + env(safe-area-inset-top)); }
}`;
  document.head.appendChild(st);

  // ---------- Materialien ----------
  const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  let streifenTex = null, carbonTex = null, platineTex = null;
  function canvasTex(w, h, malen, wrap = 1) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    malen(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(wrap, wrap);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  const streifen = () => streifenTex || (streifenTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = "#8a8f95"; g.fillRect(0, 0, w, h); g.fillStyle = "#4a4e53"; for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1.5, h); }, 6));
  const carbon = () => carbonTex || (carbonTex = canvasTex(32, 32, (g) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? "#1b1d21" : "#2b2e33"; g.fillRect(x * 8, y * 8, 8, 8); } }, 10));
  const platine = () => platineTex || (platineTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#13261d"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#2c5a43"; g.lineWidth = 1.2;
    for (let i = 0; i < 70; i++) { const x = (i * 37) % w, y = (i * 61) % h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + ((i % 3) - 1) * 60, y); g.lineTo(x + ((i % 3) - 1) * 60, y + 40); g.stroke(); }
    g.fillStyle = "#c9a24a"; for (let i = 0; i < 40; i++) g.fillRect((i * 53) % w, (i * 29) % h, 3, 3);
    g.fillStyle = "#0b0c0e"; for (let i = 0; i < 9; i++) g.fillRect((i * 83) % (w - 40), (i * 47) % (h - 30), 26, 18);
  }));
  function material(name, farbe) {
    const f = farbe ? lin(farbe) : null;
    switch (name) {
      case "lack": return new THREE.MeshPhysicalMaterial({ color: f || lin("#ff6a14"), metalness: 0.45, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1 });
      case "chrom": return new THREE.MeshStandardMaterial({ color: lin("#e8edf2"), metalness: 1, roughness: 0.1, envMapIntensity: 1.3 });
      case "alu": return new THREE.MeshStandardMaterial({ color: f || lin("#a9aeb3"), metalness: 0.85, roughness: 0.36, envMapIntensity: 1.05 });
      case "stahl": return new THREE.MeshStandardMaterial({ color: f || lin("#7f858c"), metalness: 0.92, roughness: 0.3, envMapIntensity: 1.1 });
      case "guss": return new THREE.MeshStandardMaterial({ color: f || lin("#4b4f55"), metalness: 0.7, roughness: 0.62 });
      case "titan": return new THREE.MeshStandardMaterial({ color: f || lin("#b9bfc6"), metalness: 0.9, roughness: 0.26, envMapIntensity: 1.2 });
      case "gummi": return new THREE.MeshStandardMaterial({ color: lin("#141517"), metalness: 0, roughness: 0.9 });
      case "kunststoff": return new THREE.MeshStandardMaterial({ color: f || lin("#24262a"), metalness: 0, roughness: 0.5 });
      case "glas": return new THREE.MeshPhysicalMaterial({ color: lin("#a9c3d4"), metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
      case "kupfer": return new THREE.MeshStandardMaterial({ color: lin("#c27a3e"), metalness: 1, roughness: 0.32, envMapIntensity: 1.2 });
      case "messing": return new THREE.MeshStandardMaterial({ color: lin("#d2ab52"), metalness: 1, roughness: 0.28, envMapIntensity: 1.2 });
      case "leder": return new THREE.MeshStandardMaterial({ color: f || lin("#1c1d20"), metalness: 0, roughness: 0.62 });
      case "carbon": return new THREE.MeshPhysicalMaterial({ map: carbon(), color: 0xffffff, metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05 });
      case "leuchte": return new THREE.MeshStandardMaterial({ color: f || lin("#ffffff"), emissive: f || lin("#ffffff"), emissiveIntensity: 1.4, roughness: 0.2 });
      case "platine": return new THREE.MeshStandardMaterial({ map: platine(), color: f || 0xffffff, metalness: 0.2, roughness: 0.55 });
      case "akku": return new THREE.MeshStandardMaterial({ color: lin("#2f3a48"), metalness: 0.55, roughness: 0.4 });
      case "glut": return new THREE.MeshStandardMaterial({ color: lin("#3a2a22"), emissive: lin("#ff5a10"), emissiveIntensity: 0.25, metalness: 0.6, roughness: 0.5 });
      default: return new THREE.MeshStandardMaterial({ color: f || lin("#8d939b"), metalness: 0.5, roughness: 0.4 });
    }
  }

  // ---------- Formen → 3D ----------
  const ACHSE = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  // Geometrie, die entlang x gebaut wurde, auf die gewünschte Achse drehen
  function vonX(obj, achse) { if (achse === "y") obj.rotation.z = Math.PI / 2; else if (achse === "z") obj.rotation.y = -Math.PI / 2; return obj; }
  function rundBox(w, h, d, r) {
    r = Math.min(r || 0, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    if (!(r > 0.002)) return new THREE.BoxGeometry(w, h, d);
    const s = new THREE.Shape(), x = -(w / 2 - r), y = -(h / 2 - r), ww = w - 2 * r, hh = h - 2 * r;
    s.moveTo(x, y); s.lineTo(x + ww, y); s.lineTo(x + ww, y + hh); s.lineTo(x, y + hh); s.lineTo(x, y);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 4 });
    g.center();
    return g;
  }
  function zahnradGeo(r, n, dicke) {
    const m = (2 * r) / Math.max(6, n), tief = Math.min(r * 0.25, 1.1 * m), rf = r - tief, s = new THREE.Shape();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, da = (Math.PI * 2) / n;
      const p = [[rf, a], [r, a + da * 0.18], [r, a + da * 0.42], [rf, a + da * 0.6]];
      p.forEach(([rr, w], k) => { const X = Math.cos(w) * rr, Y = Math.sin(w) * rr; if (i === 0 && k === 0) s.moveTo(X, Y); else s.lineTo(X, Y); });
      s.lineTo(Math.cos(a + da) * rf, Math.sin(a + da) * rf);
    }
    const loch = new THREE.Path(); loch.absarc(0, 0, Math.max(0.006, r * 0.22), 0, Math.PI * 2, true); s.holes.push(loch);
    const g = new THREE.ExtrudeGeometry(s, { depth: dicke, bevelEnabled: true, bevelThickness: dicke * 0.08, bevelSize: Math.min(m * 0.12, dicke * 0.08), bevelSegments: 1, curveSegments: 8 });
    g.translate(0, 0, -dicke / 2);
    g.rotateY(Math.PI / 2); // Achse z → x
    return g;
  }
  class Helix extends THREE.Curve {
    constructor(r, h, w) { super(); this.r = r; this.h = h; this.w = w; }
    getPoint(t, ziel = new THREE.Vector3()) { const a = t * this.w * Math.PI * 2; return ziel.set(Math.cos(a) * this.r, (t - 0.5) * this.h, Math.sin(a) * this.r); }
  }
  // Ein Rad mit Reifen (gerundetes Profil), Felge, Speichen, Nabe. Achse z.
  function radObj(p, mats) {
    const g = new THREE.Group(), r = p.r, b = p.breite, moto = p.speichen === 3;
    const rf = r * (moto ? 0.8 : 0.72);
    const prof = [];
    const N = 10;
    for (let i = 0; i <= N; i++) { const a = -Math.PI / 2 + (i / N) * Math.PI; prof.push(new THREE.Vector2(r - (b / 2) * (1 - Math.cos(a)) * (moto ? 0.9 : 0.35), Math.sin(a) * (b / 2))); }
    prof.push(new THREE.Vector2(rf, b / 2 * 0.92), new THREE.Vector2(rf, -b / 2 * 0.92), prof[0].clone());
    const reifen = new THREE.Mesh(new THREE.LatheGeometry(prof.reverse(), 64), mats.gummi);
    reifen.rotation.x = Math.PI / 2; g.add(reifen);
    // Felgenbett
    const bett = new THREE.Mesh(new THREE.CylinderGeometry(rf * 0.99, rf * 0.99, b * 0.9, 48, 1, true), mats.felge);
    bett.rotation.x = Math.PI / 2; g.add(bett);
    const horn = new THREE.Mesh(new THREE.TorusGeometry(rf, Math.max(0.006, r * 0.03), 8, 56), mats.felge);
    horn.position.z = (p.seite || 1) * b * 0.45; g.add(horn);
    const seite = p.seite || 1, zs = seite * b * 0.38;
    const nSp = moto ? 3 : 10;
    for (let k = 0; k < nSp; k++) {
      const a = moto ? (k / 3) * Math.PI * 2 : Math.floor(k / 2) * (Math.PI * 2 / 5) + (k % 2 ? 0.16 : -0.16);
      const sp = new THREE.Mesh(new THREE.BoxGeometry(rf * 0.92, moto ? rf * 0.16 : rf * 0.12, moto ? b * 0.25 : 0.035), mats.felge);
      sp.position.set(Math.cos(a) * rf * 0.5, Math.sin(a) * rf * 0.5, zs); sp.rotation.z = a; g.add(sp);
    }
    const nabe = new THREE.Mesh(new THREE.CylinderGeometry(rf * 0.2, rf * 0.24, moto ? b * 0.7 : 0.06, 24), mats.felge);
    nabe.rotation.x = Math.PI / 2; nabe.position.z = moto ? 0 : zs; g.add(nabe);
    if (!moto) for (let k = 0; k < 5; k++) { // Radschrauben
      const a = (k / 5) * Math.PI * 2 + 0.6, s = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 10), mats.chrom);
      s.rotation.x = Math.PI / 2; s.position.set(Math.cos(a) * rf * 0.13, Math.sin(a) * rf * 0.13, zs + seite * 0.035); g.add(s);
    }
    return g;
  }
  function sitzObj(p, m, akzent) {
    const g = new THREE.Group(), b = p.breite || 0.5;
    const flaeche = new THREE.Mesh(rundBox(0.5, 0.12, b, 0.04), m); flaeche.position.set(0.02, 0.08, 0); g.add(flaeche);
    const lehne = new THREE.Mesh(rundBox(0.13, 0.62, b, 0.05), m); lehne.position.set(-0.22, 0.42, 0); lehne.rotation.z = 0.22; g.add(lehne);
    if (b < 0.8) { const kopf = new THREE.Mesh(rundBox(0.1, 0.17, b * 0.55, 0.04), m); kopf.position.set(-0.32, 0.82, 0); kopf.rotation.z = 0.22; g.add(kopf); }
    if (akzent) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.5, 0.04), akzent); a.position.set(-0.215, 0.42, 0); a.rotation.z = 0.22; g.add(a); }
    const schiene = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, b * 0.7), material("stahl")); schiene.position.y = 0.0; g.add(schiene);
    return g;
  }
  function kurbelwelleObj(p, m) {
    const g = new THREE.Group(), L = p.laenge, r = p.r, n = p.kroepfungen || 4, hub = p.hub || 0.04;
    const welle = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 24), m); welle.rotation.z = Math.PI / 2; g.add(welle);
    const winkel = [0, Math.PI / 2, (3 * Math.PI) / 2, Math.PI];
    for (let k = 0; k < n; k++) {
      const x = L / 2 - (L / (n + 1)) * (k + 1), a = winkel[k % 4];
      const dy = Math.cos(a), dz = Math.sin(a);
      const zapfen = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.05, 20), m);
      zapfen.rotation.z = Math.PI / 2; zapfen.position.set(x, dy * hub, dz * hub); g.add(zapfen);
      for (const sx of [-1, 1]) {
        const wange = new THREE.Mesh(new THREE.BoxGeometry(0.016, hub * 2 + r * 3, r * 2.6), m);
        wange.position.set(x + sx * 0.033, 0, 0); wange.rotation.x = -a; g.add(wange);
        const gewicht = new THREE.Mesh(new THREE.CylinderGeometry(hub * 1.5, hub * 1.5, 0.016, 20, 1, false, 0, Math.PI), m);
        gewicht.rotation.z = Math.PI / 2; gewicht.rotation.x = -a + Math.PI / 2; gewicht.position.set(x + sx * 0.033, 0, 0); g.add(gewicht);
      }
    }
    return vonX(g, p.achse || "x");
  }
  function luefterObj(p, m, extra) {
    const g = new THREE.Group(), r = p.r, nabe = p.nabe || r * 0.25, n = p.schaufeln || 7, tiefe = p.tiefe || r * 0.2;
    const kern = new THREE.Mesh(new THREE.CylinderGeometry(nabe, nabe, tiefe, 32), m); kern.rotation.z = Math.PI / 2; g.add(kern);
    const lang = r - nabe, dick = Math.max(0.0025, r * 0.018), sehne = p.breit ? Math.min(tiefe * 1.2, (2 * Math.PI * r) / n * 1.1) : Math.min(tiefe, (2 * Math.PI * (nabe + lang * 0.6)) / n * 0.75);
    const geo = new THREE.BoxGeometry(sehne, lang, dick);
    if (p.breit) { // Fan-Schaufeln: außen breiter, verdreht
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / lang + 0.5; pos.setX(i, pos.getX(i) * (0.7 + y * 0.6)); const tw = (0.5 - y) * 0.6; const x = pos.getX(i), z = pos.getZ(i); pos.setX(i, x * Math.cos(tw) - z * Math.sin(tw)); pos.setZ(i, x * Math.sin(tw) + z * Math.cos(tw)); }
      geo.computeVertexNormals();
    }
    for (let k = 0; k < n; k++) {
      const piv = new THREE.Group(); piv.rotation.x = (k / n) * Math.PI * 2;
      const s = new THREE.Mesh(geo, m); s.position.y = nabe + lang / 2; s.rotation.y = p.drall ?? 0.5; piv.add(s); g.add(piv);
    }
    return g;
  }
  // Baut ein Bauteil. Rückgabe: Object3D (lokale Achse beachtet), Liste eigener Materialien.
  function baueTeil(p) {
    const mats = [];
    const neu = (name, farbe) => { const m = material(name, farbe); mats.push(m); return m; };
    const m = p.form === "auto" || p.form === "rad" ? null : neu(p.mat, p.farbe);
    if (m && (p.form === "dreh")) m.side = THREE.DoubleSide;
    let obj;
    switch (p.form) {
      case "box": {
        obj = new THREE.Mesh(rundBox(...p.g, p.rund), m);
        if (p.lamellen) { m.map = streifen(); m.needsUpdate = true; }
        if (p.rgb) { const s = new THREE.Mesh(new THREE.BoxGeometry(p.g[0] * 1.02, p.g[1] * 0.92, p.g[2] * 0.12), neu("leuchte", "#38e1ff")); s.position.z = p.g[2] * 0.5; s.userData = {}; obj.add(s); rgbListe.push(s.material); }
        break;
      }
      case "zyl": {
        const r1 = p.r, r2 = p.r2 ?? p.r;
        obj = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, p.h, 40), m);
        if (p.gelocht) { // Bremsscheibe: dunkle Nabe + Reibring
          const topf = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.45, p.r * 0.45, p.h * 1.6, 28), neu("alu", "#2e3136")); obj.add(topf);
        }
        if (p.achse === "x") obj.rotation.z = Math.PI / 2;
        else if (p.achse === "z") obj.rotation.x = Math.PI / 2;
        break;
      }
      case "kugel": obj = new THREE.Mesh(new THREE.SphereGeometry(p.r, 36, 24), m); if (p.skala) obj.scale.set(...p.skala); break;
      case "torus": {
        const tor = new THREE.Mesh(new THREE.TorusGeometry(p.r, p.dicke, 18, 72), m);
        obj = new THREE.Group(); obj.add(tor);
        if (p.speichen) { for (let k = 0; k < p.speichen; k++) { const a = -Math.PI / 2 + (k / p.speichen) * Math.PI * 2 + (p.speichen === 2 ? Math.PI / 2 : 0); const sp = new THREE.Mesh(new THREE.BoxGeometry(p.r, p.dicke * 1.2, p.dicke * 1.2), m); sp.position.set(Math.cos(a) * p.r / 2, Math.sin(a) * p.r / 2, 0); sp.rotation.z = a; obj.add(sp); } const hub = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.28, p.r * 0.28, p.dicke * 3, 24), m); hub.rotation.x = Math.PI / 2; obj.add(hub); }
        if (p.achse === "x") obj.rotation.y = Math.PI / 2; else if (p.achse === "y") obj.rotation.x = Math.PI / 2;
        break;
      }
      case "rohr": {
        const pts = (p.punkte || []).map((a) => new THREE.Vector3(...a));
        if (pts.length < 2) return null;
        const zu = pts[0].distanceTo(pts[pts.length - 1]) < 1e-4;
        if (zu) pts.pop();
        const kurve = new THREE.CatmullRomCurve3(pts, zu, "centripetal");
        obj = new THREE.Mesh(new THREE.TubeGeometry(kurve, Math.max(24, pts.length * 16), (p.d || 0.03) / 2, 12, zu), m);
        break;
      }
      case "dreh": {
        const pr = (p.profil || []).map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
        if (p.zu) pr.push(pr[0].clone());
        const geo = new THREE.LatheGeometry(pr, 96);
        if (p.achse === "x") geo.rotateZ(-Math.PI / 2); else if (p.achse === "z") geo.rotateX(Math.PI / 2);
        obj = new THREE.Mesh(geo, m);
        break;
      }
      case "luefter": {
        obj = vonX(luefterObj(p, m), p.achse || "x");
        if (p.rahmen) { const rm = neu("kunststoff", "#121316"); const rahmen = new THREE.Group(); const w = p.r * 2.2, d = p.tiefe * 1.3, t = p.r * 0.12; for (const [y, z, gw, gh] of [[w / 2, 0, w, t], [-w / 2, 0, w, t], [0, w / 2, t, w], [0, -w / 2, t, w]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(d, gh === t ? t : w, gw === t ? t : w), rm); b.position.set(0, y, z); rahmen.add(b); } rahmen.children[2].scale.set(1, 1, 1); obj.userData.rahmen = true; rahmenListe.push({ rahmen, achse: p.achse || "x" }); obj.__rahmen = vonX(rahmen, p.achse || "x"); }
        if (p.rgb) { const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r * 1.02, p.r * 0.03, 8, 48), neu("leuchte", "#38e1ff")); ring.rotation.y = Math.PI / 2; const rg = vonX(new THREE.Group().add(ring), p.achse || "x"); obj.__ring = rg; rgbListe.push(ring.material); }
        break;
      }
      case "zahnrad": obj = vonX(new THREE.Mesh(zahnradGeo(p.r, p.zaehne || 20, p.dicke || 0.02), m), p.achse === "x" ? "x" : p.achse); if (p.achse === "x") obj.rotation.set(0, 0, 0); break;
      case "feder": obj = new THREE.Mesh(new THREE.TubeGeometry(new Helix(p.r, p.h, p.windungen || 6), (p.windungen || 6) * 24, (p.d || 0.01) / 2, 8, false), m); break;
      case "kurbelwelle": obj = kurbelwelleObj(p, m); break;
      case "sitz": obj = sitzObj(p, m, p.akzent ? neu("leder", p.akzent) : null); break;
      case "rad": {
        const mm = { gummi: neu("gummi"), felge: neu("alu", p.felge || "#3c4047"), chrom: neu("chrom") };
        obj = radObj(p, mm);
        break;
      }
      case "auto": {
        if (!window.FridayStudio?.baueAuto) return null;
        obj = window.FridayStudio.baueAuto(p.spec, p.farbe || "#ff6a14");
        // Räder (Gruppen) und Endrohre baut das Labor selbst als eigene Teile
        for (const c of [...obj.children]) {
          if (c.isGroup) obj.remove(c);
          else if (c.geometry?.type === "CylinderGeometry" && Math.abs((c.geometry.parameters?.radiusTop || 0) - 0.045) < 1e-6) obj.remove(c);
        }
        obj.traverse((o) => { if (o.isMesh) { if (Array.isArray(o.material)) o.material = o.material.map((x) => { const k = x.clone(); mats.push(k); return k; }); else { o.material = o.material.clone(); mats.push(o.material); } } });
        break;
      }
      default: return null;
    }
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return { obj, mats };
  }
  const rgbListe = [], rahmenListe = [];

  // ---------- Szene ----------
  let renderer, scene, camera, root, floor, sun, umgebung, raf = 0, offen = false;
  let yaw = 0.75, pitch = 0.32, dist = 6, zielDist = 6, autoSpin = true;
  const target = new THREE.Vector3(0, 0.5, 0), zielTarget = target.clone();
  function studioUmgebung() {
    if (umgebung) return umgebung;
    const env = new THREE.Scene();
    const raum = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), new THREE.MeshBasicMaterial({ color: 0x23272d, side: THREE.BackSide }));
    raum.position.y = 4; env.add(raum);
    const licht = (w, h, pos, rot, k, farbe = 0xffffff) => { const mm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(farbe).multiplyScalar(k), side: THREE.DoubleSide })); mm.position.set(...pos); mm.rotation.set(...rot); env.add(mm); };
    licht(12, 4, [0, 8.9, 0], [Math.PI / 2, 0, 0], 3.6);
    licht(6, 3, [-9.9, 4, 0], [0, Math.PI / 2, 0], 2.6);
    licht(6, 3, [9.9, 4, 2], [0, -Math.PI / 2, 0], 1.8);
    licht(10, 1.2, [0, 2.5, -9.9], [0, 0, 0], 2.2);
    licht(14, 0.6, [0, 0.5, 9.9], [0, Math.PI, 0], 0.8, 0xffa060);
    const pm = new THREE.PMREMGenerator(renderer);
    umgebung = pm.fromScene(env, 0.035).texture;
    pm.dispose();
    return umgebung;
  }
  function init() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.environment = studioUmgebung();
    camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
    scene.add(new THREE.HemisphereLight(0xdde6f0, 0x1a1410, 0.35));
    sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    const rim = new THREE.DirectionalLight(0xffa860, 0.5); rim.position.set(-6, 3, -5); scene.add(rim);
    floor = new THREE.Group();
    const boden = new THREE.Mesh(new THREE.CircleGeometry(1, 72), new THREE.MeshStandardMaterial({ color: lin("#101318"), metalness: 0, roughness: 0.72, envMapIntensity: 0.25 }));
    boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true; floor.add(boden);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96), new THREE.MeshBasicMaterial({ color: 0xff8a1e, transparent: true, opacity: 0.55 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.001; floor.add(ring); floor.userData.ring = ring;
    const gitter = new THREE.PolarGridHelper(1, 16, 6, 64, 0x3a3f46, 0x23272d); gitter.position.y = 0.0015; gitter.material.transparent = true; gitter.material.opacity = 0.5; floor.add(gitter);
    scene.add(floor);
    root = new THREE.Group(); scene.add(root);
    steuerung();
    window.addEventListener("resize", groesse);
    groesse();
  }
  function groesse() {
    if (!renderer || !offen) return;
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // ---------- Modell aufbauen ----------
  let modell = null, teile = [], gruppen = {}, mitte = new THREE.Vector3(), groesseM = 1, roentgen = false, laeuft = false, theta = 0;
  let explo = 0, exploZiel = 0, auswahl = null, nurDas = null;
  const meshZuTeil = new WeakMap();
  function entsorgen() {
    root.traverse((o) => { if (o.isMesh) { o.geometry?.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose?.()); } });
    root.clear();
    teile = []; gruppen = {}; auswahl = null; nurDas = null; rgbListe.length = 0; rahmenListe.length = 0;
  }
  function aufbauen(m) {
    entsorgen();
    modell = m;
    for (const g of m.gruppen) gruppen[g.id] = { def: g, teile: [], mitte: new THREE.Vector3(), t: 0, ziel: 0, sichtbar: true, pfad: null, laenge: 0 };
    for (const p of m.teile) {
      const b = baueTeil(p);
      if (!b) continue;
      const pivot = new THREE.Group();
      const spin = new THREE.Group();
      pivot.add(spin);
      spin.add(b.obj);
      if (b.obj.__rahmen) pivot.add(b.obj.__rahmen); // Lüfterrahmen dreht nicht mit
      if (b.obj.__ring) pivot.add(b.obj.__ring);
      if (p.pos) pivot.position.fromArray(p.pos);
      if (p.rot) pivot.rotation.set(...p.rot);
      root.add(pivot);
      const gr = gruppen[p.gruppe] || (gruppen[p.gruppe] = { def: { id: p.gruppe, name: p.gruppe, raus: [[0, 0.5, 0]] }, teile: [], mitte: new THREE.Vector3(), t: 0, ziel: 0, sichtbar: true });
      const teil = { def: p, pivot, spin, gr, mats: b.mats, basis: pivot.position.clone(), mitte: new THREE.Vector3(), explo: new THREE.Vector3(), user: new THREE.Vector3(), t: 0, ziel: 0, achse: ACHSE[p.anim?.achse || "x"], sichtbar: true, emissiv: b.mats.map((mm) => (mm.emissive ? mm.emissive.clone() : null)), emInt: b.mats.map((mm) => mm.emissiveIntensity ?? 1) };
      pivot.traverse((o) => { if (o.isMesh) meshZuTeil.set(o, teil); });
      gr.teile.push(teil);
      teile.push(teil);
    }
    // Mitten bestimmen (für Explosion und Kamera)
    root.updateMatrixWorld(true);
    const box = new THREE.Box3(), tb = new THREE.Box3();
    for (const t of teile) { tb.setFromObject(t.pivot); tb.getCenter(t.mitte); box.union(tb); }
    box.getCenter(mitte);
    const sz = box.getSize(new THREE.Vector3());
    groesseM = Math.max(sz.x, sz.y, sz.z) || 1;
    // Modell auf den Boden stellen
    root.position.y = box.min.y < 0 ? -box.min.y + groesseM * 0.02 : 0;
    for (const g of Object.values(gruppen)) {
      if (!g.teile.length) continue;
      const gb = new THREE.Box3(); g.teile.forEach((t) => gb.union(new THREE.Box3().setFromObject(t.pivot))); gb.getCenter(g.mitte);
      const pts = [new THREE.Vector3(), ...(g.def.raus || [[0, groesseM * 0.4, 0]]).map((a) => new THREE.Vector3(...a))];
      g.pfad = pts; g.laenge = pts.slice(1).reduce((s, v, i) => s + v.distanceTo(pts[i]), 0) || 0.001;
    }
    for (const t of teile) {
      const g = t.gr, e = t.def.explo;
      const grWeg = g.mitte.clone().sub(mitte).multiplyScalar(0.45);
      if (Array.isArray(e)) t.explo.fromArray(e).add(grWeg);
      else t.explo.copy(t.mitte).sub(g.mitte).multiplyScalar(0.9).add(grWeg);
    }
    // Boden, Licht und Kamera an die Größe anpassen
    const R = Math.max(sz.x, sz.z) * 1.6 + 0.5;
    floor.scale.setScalar(R);
    const s = Math.max(sz.x, sz.z, sz.y) * 1.2 + 0.5;
    sun.position.set(mitte.x + s * 0.8, s * 1.6 + root.position.y, mitte.z + s * 0.6);
    sun.target.position.set(mitte.x, root.position.y, mitte.z);
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.01, far: s * 5 });
    sun.shadow.camera.updateProjectionMatrix();
    const k = m.kamera || {};
    zielDist = dist = k.dist || groesseM * 1.6;
    zielTarget.fromArray(k.ziel || [mitte.x, mitte.y, mitte.z]); zielTarget.y += root.position.y; target.copy(zielTarget);
    camera.near = Math.max(0.005, groesseM / 400); camera.far = groesseM * 60 + 50; camera.updateProjectionMatrix();
    yaw = 0.75; pitch = 0.3; autoSpin = true;
    explo = exploZiel = 0; q(".zl-explo input").value = 0;
    setzeRoentgen(Boolean(m.roentgen));
    setzeLauf(false);
    panel();
  }

  // ---------- Bewegung ----------
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  function pfadPunkt(g, k, ziel) {
    if (!g.pfad || k <= 0) return ziel.set(0, 0, 0);
    let rest = ease(Math.min(1, k)) * g.laenge;
    for (let i = 1; i < g.pfad.length; i++) {
      const d = g.pfad[i].distanceTo(g.pfad[i - 1]);
      if (rest <= d || i === g.pfad.length - 1) return ziel.copy(g.pfad[i - 1]).lerp(g.pfad[i], d ? Math.min(1, rest / d) : 1);
      rest -= d;
    }
    return ziel.copy(g.pfad[g.pfad.length - 1]);
  }
  let letzte = 0;
  // Auf schmalen Bildschirmen (iPhone hochkant) weiter weg, damit das ganze Modell drauf ist
  const hochkant = () => (camera.aspect < 1 ? 1 / Math.max(0.45, camera.aspect) * 0.85 : 1);
  function schleife(t) {
    raf = requestAnimationFrame(schleife);
    const dt = Math.min(0.05, (t - (letzte || t)) / 1000); letzte = t;
    if (autoSpin) yaw += dt * 0.12;
    dist += (zielDist - dist) * Math.min(1, dt * 6);
    target.lerp(zielTarget, Math.min(1, dt * 5));
    const d = dist * hochkant();
    camera.position.set(target.x + d * Math.cos(pitch) * Math.cos(yaw), target.y + d * Math.sin(pitch), target.z + d * Math.cos(pitch) * Math.sin(yaw));
    camera.lookAt(target);
    if (laeuft) theta += dt * Math.PI * 2 * 1.3;
    explo += (exploZiel - explo) * Math.min(1, dt * 4);
    const gSpeed = dt / 1.6;
    for (const g of Object.values(gruppen)) { if (g.t !== g.ziel) g.t = g.ziel > g.t ? Math.min(g.ziel, g.t + gSpeed * Math.max(1, 2.4 / Math.max(0.6, g.laenge))) : Math.max(g.ziel, g.t - gSpeed * Math.max(1, 2.4 / Math.max(0.6, g.laenge))); }
    for (const p of teile) {
      if (p.t !== p.ziel) p.t = p.ziel > p.t ? Math.min(1, p.t + dt * 1.4) : Math.max(0, p.t - dt * 1.4);
      const a = p.def.anim;
      p.pivot.position.copy(p.basis).addScaledVector(p.explo, explo).add(pfadPunkt(p.gr, p.gr.t, tmp)).add(p.user);
      if (p.t > 0) { tmp2.copy(p.explo); if (tmp2.lengthSq() < 1e-6) tmp2.set(0, 1, 0); tmp2.normalize().multiplyScalar(0.25 * groesseM); tmp2.y += 0.12 * groesseM; p.pivot.position.addScaledVector(tmp2, ease(p.t)); }
      if (a?.art === "hub") p.pivot.position.addScaledVector(tmp.fromArray(a.richtung), a.hub * Math.cos(theta + (a.phase || 0)));
      else if (a?.art === "drehen") p.spin.setRotationFromAxisAngle(p.achse, theta * (a.tempo || 1) + (a.versatz || 0));
    }
    // Brennkammer glüht, RGB-Lüfter wechseln die Farbe
    for (const p of teile) if (p.def.mat === "glut") p.mats[0].emissiveIntensity = (laeuft ? 1.8 + Math.sin(t / 90) * 0.25 : 0.25);
    if (rgbListe.length) { const c = new THREE.Color().setHSL((t / 6000) % 1, 0.9, 0.55); rgbListe.forEach((m) => { m.color.copy(c); m.emissive.copy(c); }); }
    if (auswahl) for (let i = 0; i < auswahl.mats.length; i++) { const mm = auswahl.mats[i]; if (mm.emissive) mm.emissiveIntensity = 0.55 + Math.sin(t / 220) * 0.25; }
    renderer.render(scene, camera);
  }

  // ---------- Bedienen: drehen, zoomen, greifen ----------
  const ray = new THREE.Raycaster(), maus = new THREE.Vector2();
  function treffer(e) {
    const r = canvas.getBoundingClientRect();
    maus.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(maus, camera);
    const ziele = [];
    for (const p of teile) if (p.pivot.visible && !(roentgen && p.gr.def.huelle && p.gr.t < 0.5) && p.def.mat !== "glas") ziele.push(p.pivot);
    const h = ray.intersectObjects(ziele, true).find((x) => meshZuTeil.has(x.object));
    return h ? { teil: meshZuTeil.get(h.object), punkt: h.point } : null;
  }
  function steuerung() {
    const zeiger = new Map();
    let drag = null, pinch = 0;
    canvas.addEventListener("pointerdown", (e) => {
      zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      if (zeiger.size === 2) { const [a, b] = [...zeiger.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; return; }
      const h = treffer(e);
      drag = { x: e.clientX, y: e.clientY, yaw, pitch, teil: h?.teil || null, punkt: h?.punkt || null, bewegt: false };
      if (h) { drag.ebene = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), h.punkt); drag.user = h.teil.user.clone(); }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!zeiger.has(e.pointerId)) return;
      zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (zeiger.size === 2) { const [a, b] = [...zeiger.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) zielDist = Math.max(groesseM * 0.15, Math.min(groesseM * 8, zielDist * (pinch / d))); pinch = d; autoSpin = false; return; }
      if (!drag) return;
      if (!drag.bewegt && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      drag.bewegt = true; autoSpin = false;
      if (drag.teil) { // Teil greifen und verschieben
        canvas.classList.add("greift");
        const r = canvas.getBoundingClientRect();
        maus.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(maus, camera);
        const p = new THREE.Vector3();
        if (ray.ray.intersectPlane(drag.ebene, p)) { drag.teil.user.copy(drag.user).add(p.sub(drag.punkt)); if (auswahl !== drag.teil) waehle(drag.teil, { still: true }); }
        return;
      }
      yaw = drag.yaw - (e.clientX - drag.x) * 0.006;
      pitch = Math.max(-0.2, Math.min(1.45, drag.pitch + (e.clientY - drag.y) * 0.005));
    });
    const ende = (e) => {
      zeiger.delete(e.pointerId);
      canvas.classList.remove("greift");
      if (zeiger.size < 2) pinch = 0;
      if (drag && !drag.bewegt) { if (drag.teil) waehle(drag.teil); else infoZu(); }
      else if (drag?.teil?.user.lengthSq() > 0) caption(`${drag.teil.def.name} verschoben. „↺ Alles einbauen“ setzt es zurück.`);
      drag = null;
    };
    canvas.addEventListener("pointerup", ende);
    canvas.addEventListener("pointercancel", ende);
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); autoSpin = false; zielDist = Math.max(groesseM * 0.15, Math.min(groesseM * 8, zielDist * (e.deltaY > 0 ? 1.12 : 0.89))); }, { passive: false });
    canvas.addEventListener("dblclick", (e) => { const h = treffer(e); if (h) zoomAuf(h.teil); });
  }
  function zoomAuf(teil) {
    const b = new THREE.Box3().setFromObject(teil.pivot), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    zielTarget.copy(c); zielDist = Math.max(groesseM * 0.12, Math.max(s.x, s.y, s.z) * 2.6); autoSpin = false;
  }
  function kameraZurueck() {
    const k = modell?.kamera || {};
    zielDist = k.dist || groesseM * 1.6;
    zielTarget.fromArray(k.ziel || [mitte.x, mitte.y, mitte.z]); zielTarget.y += root.position.y;
  }

  // ---------- Auswahl & Info ----------
  function markiere(teil, an) {
    teil.mats.forEach((m, i) => {
      if (!m.emissive) return;
      if (an) { m.emissive.set(0xff8a1e); m.emissiveIntensity = 0.6; }
      else { m.emissive.copy(teil.emissiv[i] || new THREE.Color(0)); m.emissiveIntensity = teil.emInt[i]; }
    });
  }
  function waehle(teil, { still = false } = {}) {
    if (auswahl && auswahl !== teil) markiere(auswahl, false);
    auswahl = teil; markiere(teil, true);
    const p = teil.def, i = p.info || {}, g = teil.gr.def;
    const zeile = (k, v) => (v ? `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>` : "");
    const box = q(".zl-info");
    box.innerHTML = `
      <div class="zl-i-kopf"><div><small>${escapeHtml(g.symbol || "")} ${escapeHtml(g.name || "")}</small><b>${escapeHtml(p.name)}</b></div><button type="button" class="zl-i-zu" title="Schließen">✕</button></div>
      <dl>${zeile("Aufgabe", i.funktion)}${zeile("Material", i.material)}${zeile("Gewicht", i.gewicht)}${zeile("Ausbau", i.ausbau)}${zeile("Werkzeug", i.werkzeug)}</dl>
      ${i.wissen ? `<div class="zl-i-wissen">💡 ${escapeHtml(i.wissen)}</div>` : ""}
      <div class="zl-i-knoepfe">
        <button type="button" class="zl-k haupt" data-i="teil">${teil.ziel ? "⤵ Wieder einbauen" : "⤴ Herausnehmen"}</button>
        <button type="button" class="zl-k" data-i="gruppe">${teil.gr.ziel ? "⤵" : "⤴"} ${escapeHtml(g.name || "Baugruppe")} ${teil.gr.ziel ? "einbauen" : "raus"}</button>
        <button type="button" class="zl-k" data-i="nur">${nurDas ? "👁 Alles zeigen" : "👁 Nur das zeigen"}</button>
        <button type="button" class="zl-k" data-i="zoom">🔍 Heranzoomen</button>
      </div>`;
    box.classList.remove("hidden");
    el.classList.add("info-offen");
    if (!still) caption(`${p.name}: festhalten und ziehen zum Verschieben.`);
  }
  function infoZu() {
    if (auswahl) markiere(auswahl, false);
    auswahl = null;
    q(".zl-info").classList.add("hidden");
    el.classList.remove("info-offen");
  }
  q(".zl-info").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !auswahl) return;
    if (b.classList.contains("zl-i-zu")) return infoZu();
    const teil = auswahl;
    if (b.dataset.i === "teil") { teil.ziel = teil.ziel ? 0 : 1; if (!teil.ziel) teil.user.set(0, 0, 0); caption(teil.ziel ? `${teil.def.name} herausgenommen.` : `${teil.def.name} wieder eingebaut.`); }
    else if (b.dataset.i === "gruppe") gruppeUmschalten(teil.gr.def.id);
    else if (b.dataset.i === "nur") nurZeigen(nurDas ? null : [teil]);
    else if (b.dataset.i === "zoom") zoomAuf(teil);
    waehle(teil, { still: true });
  });
  function nurZeigen(liste) {
    nurDas = liste && liste.length ? liste : null;
    for (const t of teile) t.pivot.visible = nurDas ? nurDas.includes(t) : t.gr.sichtbar;
    if (nurDas) { zoomAuf(nurDas[0]); if (nurDas.length > 1) { const b = new THREE.Box3(); nurDas.forEach((t) => b.union(new THREE.Box3().setFromObject(t.pivot))); zielTarget.copy(b.getCenter(new THREE.Vector3())); const s = b.getSize(new THREE.Vector3()); zielDist = Math.max(groesseM * 0.15, Math.max(s.x, s.y, s.z) * 2.2); } }
    else kameraZurueck();
    panel();
  }

  // ---------- Baugruppen herausnehmen ----------
  let kette = Promise.resolve();
  const warte = (ms) => new Promise((r) => setTimeout(r, ms));
  function gruppeUmschalten(id, ziel) {
    const g = gruppen[id];
    if (!g) return;
    const raus = ziel ?? (g.ziel ? 0 : 1);
    kette = kette.then(async () => {
      if (raus) {
        // Was zuerst weg muss (z. B. Karosserie vor dem Motor), nimmt Friday automatisch heraus.
        const vorher = (g.def.braucht || []).filter((b) => gruppen[b] && !gruppen[b].ziel);
        for (const b of vorher) { caption(`Zuerst ${gruppen[b].def.name} ${gruppen[b].def.huelle ? "abheben" : "herausnehmen"} …`); gruppen[b].ziel = 1; panel(); await warte(1300); }
        g.ziel = 1;
        caption(`${g.def.symbol || ""} ${g.def.name} ${g.def.huelle ? "abgehoben" : "herausgenommen"}. ${g.def.info || ""}`.trim());
      } else {
        // Wieder einbauen: was davon abhängt, kommt danach – die Hülle zuletzt
        g.ziel = 0;
        g.teile.forEach((t) => { t.ziel = 0; t.user.set(0, 0, 0); });
        caption(`${g.def.name} wieder eingebaut.`);
      }
      panel();
    });
    return kette;
  }
  function setzeRoentgen(an) {
    roentgen = an;
    for (const t of teile) {
      if (!t.gr.def.huelle) continue;
      t.mats.forEach((m) => {
        if (m.userData?.zlOrig === undefined) Object.defineProperty(m, "_zl", { value: { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite }, configurable: true, enumerable: false });
        const o = m._zl || { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite };
        m.transparent = an ? true : o.transparent; m.opacity = an ? Math.min(o.opacity, 0.14) : o.opacity; m.depthWrite = an ? false : o.depthWrite; m.needsUpdate = true;
      });
    }
    q('[data-a="roentgen"]').classList.toggle("on", an);
  }
  function setzeLauf(an) {
    laeuft = an;
    const b = q('[data-a="lauf"]');
    b.classList.toggle("on", an);
    const elektrisch = modell?.id === "gaming-pc" || modell?.id === "elektroauto";
    b.textContent = an ? "⏸ Anhalten" : elektrisch ? "▶ Einschalten" : modell?.id === "schaltgetriebe" ? "▶ Drehen lassen" : "▶ Motor an";
  }
  function alleseinbauen() {
    for (const g of Object.values(gruppen)) { g.ziel = 0; g.sichtbar = true; }
    for (const t of teile) { t.ziel = 0; t.user.set(0, 0, 0); }
    exploZiel = 0; q(".zl-explo input").value = 0;
    nurZeigen(null);
    infoZu();
    caption("Alles wieder eingebaut.");
  }

  // ---------- Seitenleiste ----------
  function panel() {
    if (!modell) return;
    q(".zl-sym").textContent = modell.symbol || "🔧";
    q(".zl-name").textContent = modell.name;
    q(".zl-kurz").textContent = `${modell.kurz} ${teile.length} Teile.`;
    q(".zl-daten").innerHTML = (modell.daten || []).map((d) => `<li><small>${escapeHtml(d.label)}</small><b>${escapeHtml(d.wert)}</b></li>`).join("");
    q(".zl-gruppen").innerHTML = modell.gruppen.filter((g) => gruppen[g.id]?.teile.length).map((g) => {
      const z = gruppen[g.id];
      return `<div class="zl-gr${z.ziel ? " raus" : ""}${z.sichtbar ? "" : " aus"}"><button type="button" class="zl-g-name" data-g="${escapeHtml(g.id)}">${escapeHtml(g.symbol || "")} ${escapeHtml(g.name)}<i>${z.ziel ? "draußen ⤵" : `${z.teile.length} ${z.teile.length === 1 ? "Teil" : "Teile"} ⤴`}</i></button><button type="button" class="zl-g-auge" data-auge="${escapeHtml(g.id)}" title="Ein-/Ausblenden">${z.sichtbar ? "👁" : "🚫"}</button></div>`;
    }).join("");
  }
  q(".zl-gruppen").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.g) gruppeUmschalten(b.dataset.g);
    else if (b.dataset.auge) { const g = gruppen[b.dataset.auge]; g.sichtbar = !g.sichtbar; nurDas = null; for (const t of teile) t.pivot.visible = t.gr.sichtbar; panel(); }
  });

  // ---------- Zerlegen-Show ----------
  let show = 0;
  async function zerlegenShow() {
    const nr = ++show;
    alleseinbauen();
    setzeLauf(true);
    q('[data-a="show"]').classList.add("on");
    const s1 = `Ich zerlege jetzt: ${modell.name}.`;
    caption(s1); sag(s1);
    await warte(2600);
    const reihe = modell.gruppen.filter((g) => gruppen[g.id]?.teile.length && (g.raus || []).some((v) => v.some((x) => Math.abs(x) > 0.01)));
    for (const g of reihe) {
      if (nr !== show) return;
      await gruppeUmschalten(g.id, 1);
      const teil = gruppen[g.id].teile[0];
      const satz = `${g.name}. ${g.info || teil?.def.info?.funktion || ""}`;
      sag(satz);
      await warte(Math.min(6500, 2200 + satz.length * 40));
    }
    if (nr !== show) return;
    exploZiel = 0.6; q(".zl-explo input").value = 60;
    const s2 = "Fertig zerlegt. Tipp ein Teil an, um mehr zu erfahren.";
    caption(s2); sag(s2);
    q('[data-a="show"]').classList.remove("on");
  }

  // ---------- Befehle (Text oder Sprache) ----------
  const norm = (s) => String(s || "").toLowerCase().replace(/ß/g, "ss").replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
  const MODELL_WORTE = [["elektroauto", /elektro|e auto|eauto|tesla|akku auto/], ["motorrad", /motorrad|bike|superbike/], ["triebwerk", /triebwerk|turbofan|jet|duesen|düsen/], ["schaltgetriebe", /schaltgetriebe|gangschaltung|\bgetriebe\b(?!.*(auto|wagen))/], ["gaming-pc", /\bpc\b|computer|rechner|gaming/], ["v8-motor", /\bv ?8\b(?!.*(auto|wagen))|achtzylinder|verbrennungsmotor|motor einzeln|offener motor/], ["sportwagen-v8", /sportwagen|sportauto|\bauto\b|wagen|coupe/]];
  function ziele(text) {
    const t = ` ${norm(text)} `;
    const gr = [], tl = [];
    for (const g of modell.gruppen) {
      if (!gruppen[g.id]?.teile.length) continue;
      const worte = [g.id, ...norm(g.name).split(" ").filter((w) => w.length > 3)];
      if (worte.some((w) => t.includes(` ${w}`))) gr.push(g.id);
    }
    if (!gr.length) {
      for (const p of teile) {
        const n = norm(p.def.name), a = norm(p.def.art).replace(/_/g, " ");
        const stamm = n.split(" ")[0];
        if (t.includes(` ${n} `) || (stamm.length > 3 && t.includes(` ${stamm.replace(/(e|en|n)$/, "")}`)) || t.includes(` ${a} `)) tl.push(p);
      }
    }
    return { gr, tl };
  }
  async function befehl(text) {
    if (!modell) await ladeModell("sportwagen-v8");
    let t = norm(text);
    for (const [id, re] of MODELL_WORTE) if (re.test(t) && id !== modell.id) {
      // "Motor raus aus dem Auto" bleibt beim aktuellen Auto; ein Modellname alleine wechselt.
      if (id === "sportwagen-v8" && modell.id === "elektroauto") break;
      if (id === "v8-motor" && /\b(auto|wagen)\b/.test(t)) continue;
      await ladeModell(id);
      break;
    }
    if (/\b(alles|komplett|ganz)\b.*\b(rein|einbauen|zusammen|zurueck|zurück)\b|zusammenbauen|\breset\b/.test(t)) return alleseinbauen();
    if (/\bshow\b|vorfuehr|vorführ|erklaer alles|erklär alles|schritt fuer schritt|schritt für schritt/.test(t)) return zerlegenShow();
    if (/explosion|explodier/.test(t)) { exploZiel = /\baus\b|zurueck|zurück/.test(t) ? 0 : 1; q(".zl-explo input").value = exploZiel * 100; return caption(exploZiel ? "Explosionsansicht: alle Teile auseinandergezogen." : "Explosionsansicht aus."); }
    if (/roentgen|röntgen|durchsichtig|durchleucht/.test(t)) { setzeRoentgen(!/\baus\b/.test(t)); return caption(roentgen ? "Röntgen an: Die Hülle ist durchsichtig." : "Röntgen aus."); }
    if (/\b(stopp|stop|anhalten|halt|ausschalten|ausmachen|abstellen)\b|motor aus\b/.test(t)) { setzeLauf(false); return caption("Angehalten."); }
    if (/\b(start|starte|starten|anlassen|anmachen|einschalten|laufen|laeuft|läuft|dreh|drehen|an)\b/.test(t) && !/\braus\b/.test(t)) { setzeLauf(true); return caption("Läuft. Schau dir an, wie sich alles bewegt."); }
    const { gr, tl } = ziele(t);
    const rein = /\b(rein|hinein|einbauen|zurueck|zurück|wieder)\b/.test(t);
    const raus = /\b(raus|heraus|ausbauen|rausnehmen|herausnehmen|entfern|abheben|weg|nimm)\b/.test(t);
    if (/\bnur\b/.test(t) && (gr.length || tl.length)) { nurZeigen(gr.length ? gruppen[gr[0]].teile : tl); return caption(`Ich zeige nur: ${gr.length ? gruppen[gr[0]].def.name : tl[0].def.name}${tl.length > 1 ? ` (${tl.length} Stück)` : ""}.`); }
    if (gr.length && (raus || rein)) { for (const id of gr) await gruppeUmschalten(id, rein ? 0 : 1); return; }
    if (tl.length && (raus || rein)) { tl.forEach((p) => { p.ziel = rein ? 0 : 1; }); waehle(tl[0], { still: true }); return caption(`${tl.length > 1 ? `${tl.length} × ${tl[0].def.info ? norm(tl[0].def.name).split(" ")[0] : ""}` : tl[0].def.name} ${rein ? "eingebaut" : "herausgenommen"}.`); }
    if (gr.length) { const g = gruppen[gr[0]]; nurDas = null; waehle(g.teile[0]); zoomAuf(g.teile[0]); return; }
    if (tl.length) { waehle(tl[0]); zoomAuf(tl[0]); return; }
    if (/zerleg|auseinander/.test(t)) { exploZiel = 0.7; q(".zl-explo input").value = 70; return caption(`${modell.name} auseinandergezogen. Tipp ein Teil an oder nimm eine Baugruppe heraus.`); }
    caption("Das habe ich nicht gefunden. Versuch z. B. „Motor raus“, „zeig nur die Kolben“, „Explosion“ oder „Motor an“.");
  }

  // ---------- Leiste ----------
  el.querySelector(".zl-leiste").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-a]");
    if (!b) return;
    const a = b.dataset.a;
    if (a === "lauf") setzeLauf(!laeuft);
    else if (a === "roentgen") setzeRoentgen(!roentgen);
    else if (a === "reset") { show++; q('[data-a="show"]').classList.remove("on"); alleseinbauen(); }
    else if (a === "show") { if (b.classList.contains("on")) { show++; b.classList.remove("on"); caption("Show angehalten."); } else zerlegenShow(); }
  });
  q(".zl-explo input").addEventListener("input", (e) => { exploZiel = Number(e.target.value) / 100; autoSpin = false; });
  q(".zl-befehl").addEventListener("submit", (e) => { e.preventDefault(); const i = q(".zl-befehl input"); const v = i.value.trim(); i.value = ""; if (v) befehl(v); });
  let capT = 0;
  function caption(t) { const c = q(".zl-caption"); c.textContent = t; c.style.opacity = 1; clearTimeout(capT); capT = setTimeout(() => { c.style.opacity = 0.75; }, 6000); }

  // ---------- Modelle laden ----------
  let liste = [], ladeNr = 0;
  const cacheM = {};
  async function ladeListe() {
    if (liste.length) return liste;
    const r = await (await api("/api/zerlegen")).json();
    liste = r.modelle || [];
    q(".zl-modelle").innerHTML = liste.map((m) => `<button type="button" data-m="${escapeHtml(m.id)}" title="${escapeHtml(m.kurz)}">${escapeHtml(m.symbol)} ${escapeHtml(m.name)}</button>`).join("");
    return liste;
  }
  async function ladeModell(id) {
    const nr = ++ladeNr;
    caption("Lädt …");
    try {
      const m = cacheM[id] || (await (await api(`/api/zerlegen/${encodeURIComponent(id)}`)).json()).modell;
      if (!m) throw new Error("leer");
      cacheM[id] = m;
      if (nr !== ladeNr) return;
      show++;
      aufbauen(m);
      el.querySelectorAll(".zl-modelle button").forEach((b) => b.classList.toggle("on", b.dataset.m === id));
      el.querySelector(`.zl-modelle button[data-m="${id}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
      caption(`${m.name}: ${m.teile.length} Teile. Tipp ein Teil an oder wähl eine Baugruppe.`);
      try { localStorage.setItem("friday_zerlegen_modell", id); } catch { /* egal */ }
    } catch { caption("Das Modell konnte ich nicht laden."); }
  }
  q(".zl-modelle").addEventListener("click", (e) => { const b = e.target.closest("button[data-m]"); if (b) ladeModell(b.dataset.m); });

  // ---------- Öffnen / Schließen ----------
  async function oeffnen({ modell: id, befehl: bef } = {}) {
    if (!darf()) { caption("Noch im Test."); return false; }
    if (host.classList.contains("hidden")) $("werkstatt-open")?.click();
    el.classList.remove("hidden");
    host.classList.add("zl-an");
    offen = true;
    init();
    groesse();
    cancelAnimationFrame(raf); letzte = 0;
    raf = requestAnimationFrame(schleife);
    try { await ladeListe(); } catch { caption("Friday ist gerade nicht erreichbar."); return false; }
    let gespeichert = null;
    try { gespeichert = localStorage.getItem("friday_zerlegen_modell"); } catch { /* egal */ }
    const ziel = id || (modell ? modell.id : (liste.some((m) => m.id === gespeichert) ? gespeichert : "sportwagen-v8"));
    if (!modell || modell.id !== ziel) await ladeModell(ziel);
    if (bef) await befehl(bef);
    return true;
  }
  function schliessen() {
    offen = false; show++;
    el.classList.add("hidden");
    host.classList.remove("zl-an");
    cancelAnimationFrame(raf);
    infoZu();
  }
  q(".zl-x").addEventListener("click", schliessen);
  // Schließt jemand die ganze Werkstatt, stoppt auch das Labor.
  new MutationObserver(() => { if (offen && host.classList.contains("hidden")) schliessen(); }).observe(host, { attributes: true, attributeFilter: ["class"] });
  $("werkstatt-zerlegen")?.addEventListener("click", () => oeffnen());
  document.addEventListener("keydown", (e) => { if (offen && e.key === "Escape" && !e.target.closest?.("input")) { e.stopPropagation(); auswahl ? infoZu() : schliessen(); } }, true);

  window.FridayZerlege = {
    open: oeffnen,
    close: schliessen,
    befehl: async (t) => { if (!offen) return oeffnen({ befehl: t }); return befehl(t); },
    /** Gehört dieser Werkstatt-Wunsch ins Labor? ("zerleg den Motor", "Explosionsansicht vom Triebwerk") */
    passt: (t) => darf() && /zerleg|auseinander ?(nehmen|bauen)|explosionsansicht|von innen|innenleben/i.test(String(t || "")),
  };
})();
