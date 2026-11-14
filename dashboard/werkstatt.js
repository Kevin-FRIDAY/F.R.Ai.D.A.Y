// F.R.Ai.D.A.Y Werkstatt: baut einen 3D-Bauplan Schritt für Schritt als Hologramm auf und erklärt ihn.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { api, say, escapeHtml } = window.Friday;
  const box = $("werkstatt");
  if (!box || !window.THREE) return;
  const THREE = window.THREE;

  const COLORS = { cyan: 0x4fd8ff, weiss: 0xf2f6ff, rot: 0xff4d5e, orange: 0xff8a1e, gelb: 0xffd84d, gruen: 0x4dffa6, blau: 0x3d7dff, lila: 0xb57bff, grau: 0x9aa4b2, schwarz: 0x2a2f38, glas: 0x9fe8ff };
  let renderer, scene, camera, root, grid, raf = 0, plan = null, built = [], running = 0, solid = false;
  let yaw = 0.7, pitch = 0.42, dist = 9, target = new THREE.Vector3(0, 0.8, 0), autoSpin = true;

  // ---------- Szene ----------
  function init() {
    if (renderer) return;
    const canvas = $("werkstatt-canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02060b);
    scene.fog = new THREE.Fog(0x02060b, 14, 46);
    camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(6, 10, 4);
    scene.add(sun);
    grid = new THREE.GridHelper(80, 80, 0x4fd8ff, 0x0f5a75);
    grid.material.transparent = true; grid.material.opacity = 0.55;
    scene.add(grid);
    root = new THREE.Group();
    scene.add(root);
    enableOrbit(canvas);
    window.addEventListener("resize", resize);
    resize();
  }

  function resize() {
    if (!renderer) return;
    const c = renderer.domElement, w = c.clientWidth || 800, h = c.clientHeight || 500;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function enableOrbit(el) {
    let drag = null;
    el.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; autoSpin = false; el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      yaw = drag.yaw - (e.clientX - drag.x) * 0.006;
      pitch = Math.max(0.05, Math.min(1.45, drag.pitch + (e.clientY - drag.y) * 0.005));
    });
    el.addEventListener("pointerup", () => { drag = null; });
    el.addEventListener("wheel", (e) => { e.preventDefault(); dist = Math.max(2, Math.min(80, dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (autoSpin) yaw += 0.0025;
    camera.position.set(target.x + dist * Math.cos(pitch) * Math.cos(yaw), target.y + dist * Math.sin(pitch), target.z + dist * Math.cos(pitch) * Math.sin(yaw));
    camera.lookAt(target);
    // Teile fahren beim Erscheinen von unten ein und leuchten kurz auf.
    for (const b of built) {
      const k = Math.min(1, (t - b.born) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      b.obj.scale.copy(b.base).multiplyScalar(0.001 + e * 0.999);
      b.obj.position.y = b.y + (1 - e) * 0.6;
      if (b.edge) b.edge.material.opacity = 0.35 + (1 - k) * 0.65;
    }
    renderer.render(scene, camera);
  }

  // ---------- Teile ----------
  function labelSprite(text, color) {
    const c = document.createElement("canvas");
    const g = c.getContext("2d");
    const font = "600 44px ui-monospace, Menlo, monospace";
    g.font = font;
    const w = Math.ceil(g.measureText(text).width) + 40;
    c.width = w; c.height = 70;
    g.font = font;
    g.fillStyle = "rgba(2,10,20,.72)"; g.fillRect(0, 0, w, 70);
    g.strokeStyle = color; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, 67);
    g.fillStyle = color; g.textBaseline = "middle"; g.fillText(text, 20, 37);
    const tex = new THREE.CanvasTexture(c);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    s.scale.set((w / 70) * 0.28, 0.28, 1);
    s.renderOrder = 10;
    return s;
  }

  function makePart(p) {
    const hex = COLORS[p.farbe] ?? COLORS.cyan;
    const css = `#${hex.toString(16).padStart(6, "0")}`;
    if (p.form === "text") {
      const s = labelSprite(String(p.text || ""), css);
      s.position.fromArray(p.pos || [0, 1, 0]);
      return { obj: s };
    }
    let geo;
    const v = (a, i, d) => (Array.isArray(a) && Number.isFinite(a[i]) ? Math.max(0.005, a[i]) : d);
    if (p.form === "box") geo = new THREE.BoxGeometry(v(p.groesse, 0, 1), v(p.groesse, 1, 1), v(p.groesse, 2, 1));
    else if (p.form === "kugel") geo = new THREE.SphereGeometry(p.radius || 0.5, 20, 14);
    else if (p.form === "zylinder") {
      geo = new THREE.CylinderGeometry(p.radius || 0.3, p.radius || 0.3, p.hoehe || 1, 28);
      if (p.achse === "x") geo.rotateZ(Math.PI / 2);
      if (p.achse === "z") geo.rotateX(Math.PI / 2);
    } else if (p.form === "rohr" && Array.isArray(p.punkte) && p.punkte.length >= 2) {
      const path = new THREE.CurvePath();
      for (let i = 1; i < p.punkte.length; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(...p.punkte[i - 1]), new THREE.Vector3(...p.punkte[i])));
      geo = new THREE.TubeGeometry(path, Math.max(8, p.punkte.length * 6), (p.dicke || 0.05) / 2, 8, false);
    } else return null;

    const group = new THREE.Group();
    const glass = p.farbe === "glas";
    const fill = new THREE.Mesh(geo, solid
      ? new THREE.MeshStandardMaterial({ color: hex, metalness: glass ? 0.1 : 0.35, roughness: glass ? 0.05 : 0.45, transparent: glass, opacity: glass ? 0.45 : 1 })
      : new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: p.form === "rohr" ? 0.85 : glass ? 0.08 : 0.14, depthWrite: false, blending: THREE.AdditiveBlending }));
    group.add(fill);
    let edge = null;
    if (p.form !== "rohr" && p.form !== "kugel") {
      edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 1 }));
      group.add(edge);
    }
    const pos = p.form === "rohr" ? [0, 0, 0] : (p.pos || [0, 0.5, 0]);
    group.position.fromArray(pos);
    if (Array.isArray(p.drehung)) group.rotation.set(...p.drehung.map((d) => (Number(d) || 0) * Math.PI / 180));
    return { obj: group, edge };
  }

  function addParts(teile, t0) {
    teile.forEach((p, i) => {
      const part = makePart(p);
      if (!part) return;
      root.add(part.obj);
      built.push({ ...part, y: part.obj.position.y, base: part.obj.scale.clone(), born: t0 + i * 35, src: p });
    });
  }

  // Kamera an die Größe des Modells anpassen.
  function frameModel() {
    const bb = new THREE.Box3().setFromObject(root);
    if (bb.isEmpty()) return;
    const size = bb.getSize(new THREE.Vector3()), center = bb.getCenter(new THREE.Vector3());
    target.copy(center);
    dist = Math.max(4, Math.max(size.x, size.y, size.z) * 1.9);
  }

  // Gesamtmaße als Maßlinien mit Beschriftung.
  function addDimensions() {
    const bb = new THREE.Box3();
    for (const b of built) if (b.src.form !== "text") bb.expandByObject(b.obj);
    if (bb.isEmpty()) return;
    const fmt = (m) => `${m.toLocaleString("de-DE", { maximumFractionDigits: 2 })} m`;
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const dims = new THREE.Group();
    const line = (a, b, text, at) => {
      dims.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mat));
      const s = labelSprite(text, "#ffffff"); s.position.copy(at); dims.add(s);
    };
    const { min, max } = bb, off = 0.4;
    line(new THREE.Vector3(min.x, 0.02, max.z + off), new THREE.Vector3(max.x, 0.02, max.z + off), fmt(max.x - min.x), new THREE.Vector3((min.x + max.x) / 2, 0.25, max.z + off));
    line(new THREE.Vector3(max.x + off, 0.02, min.z), new THREE.Vector3(max.x + off, 0.02, max.z), fmt(max.z - min.z), new THREE.Vector3(max.x + off, 0.25, (min.z + max.z) / 2));
    line(new THREE.Vector3(max.x + off, 0, min.z - off), new THREE.Vector3(max.x + off, max.y, min.z - off), fmt(max.y), new THREE.Vector3(max.x + off, max.y / 2, min.z - off - 0.3));
    dims.name = "masse";
    root.add(dims);
  }

  // ---------- Ablauf ----------
  function setCaption(text) { $("werkstatt-caption").textContent = text || ""; }
  function setState(text, cls = "") { const s = $("werkstatt-state"); s.textContent = text; s.className = `werkstatt-state ${cls}`; }

  function showFacts(p) {
    $("werkstatt-title").textContent = (p.titel || "Werkstatt").toUpperCase();
    $("werkstatt-facts").innerHTML = (p.kennzahlen || []).map((k) => `<li><small>${escapeHtml(k.label)}</small><b>${escapeHtml(k.wert)}</b></li>`).join("");
  }

  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  async function speak(text) {
    setCaption(text);
    const voiceOn = $("voice-toggle")?.checked;
    if (voiceOn) await say(text); else await pause(Math.min(6000, 1200 + text.length * 45));
  }

  async function play(entry) {
    const run = ++running;
    const p = entry.plan;
    if (!entry.erweiterung || !plan) {
      root.clear(); built = []; plan = { ...p, schritte: [...p.schritte] }; autoSpin = true;
    } else {
      root.getObjectByName("masse")?.removeFromParent();
      plan.schritte.push(...p.schritte);
      if (p.kennzahlen?.length) plan.kennzahlen = p.kennzahlen;
    }
    showFacts(plan);
    setState("BAUT", "busy");
    if (p.einleitung) await speak(p.einleitung);
    for (const [i, s] of p.schritte.entries()) {
      if (run !== running) return;
      $("werkstatt-step").textContent = `ABSCHNITT ${i + 1} / ${p.schritte.length}`;
      addParts(s.teile, performance.now());
      frameModel();
      await speak(s.sagen);
    }
    if (run !== running) return;
    addDimensions();
    frameModel();
    $("werkstatt-step").textContent = `${built.filter((b) => b.src.form !== "text").length} TEILE`;
    setState("FERTIG", "done");
    if (p.fazit) await speak(p.fazit);
  }

  function rebuildMaterials() {
    if (!plan) return;
    const steps = plan.schritte;
    root.clear(); built = [];
    steps.forEach((s) => addParts(s.teile, performance.now() - 2000));
    addDimensions();
  }

  async function request(wunsch) {
    wunsch = String(wunsch || "").trim();
    if (!wunsch) return;
    const erweitern = $("werkstatt-extend").checked && plan;
    setState("PLANT …", "busy");
    setCaption(erweitern ? "Ich ergänze das Modell …" : "Ich entwerfe den Bauplan …");
    try {
      const res = await api("/api/werkstatt", { method: "POST", body: JSON.stringify({ wunsch, basis: erweitern ? { titel: plan.titel, kennzahlen: plan.kennzahlen, schritte: plan.schritte.map((s) => ({ sagen: s.sagen })) } : null }) });
      const r = await res.json();
      if (!r.ok) { setState("FEHLER", "error"); setCaption(r.error || "Das hat nicht geklappt."); return; }
      lastId = r.id;
      play(r);
    } catch { setState("FEHLER", "error"); setCaption("Friday ist gerade nicht erreichbar."); }
  }

  // ---------- Öffnen / Schließen ----------
  let lastId = 0;
  function open() {
    box.classList.remove("hidden");
    init();
    resize();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function close() {
    box.classList.add("hidden");
    cancelAnimationFrame(raf);
    running++; // laufende Ansage beenden
    try { speechSynthesis?.cancel(); } catch { /* egal */ }
  }

  $("werkstatt-open")?.addEventListener("click", open);
  $("werkstatt-x")?.addEventListener("click", close);
  $("werkstatt-form")?.addEventListener("submit", (e) => { e.preventDefault(); const t = $("werkstatt-input"); request(t.value); t.value = ""; });
  $("werkstatt-solid")?.addEventListener("change", (e) => { solid = e.target.checked; rebuildMaterials(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !box.classList.contains("hidden")) close(); });

  // Wenn Friday im Chat etwas gebaut hat: Werkstatt öffnen und abspielen.
  window.FridayWerkstatt = {
    async showLatest() {
      try {
        const r = await (await api("/api/werkstatt/latest")).json();
        if (!r || !r.id || r.id === lastId) return;
        lastId = r.id;
        open();
        play(r);
      } catch { /* egal */ }
    },
    play(entry) { open(); play(entry); },
  };
})();
