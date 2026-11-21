// F.R.Ai.D.A.Y Werkstatt: baut einen 3D-Bauplan Schritt für Schritt als Hologramm auf und erklärt ihn.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { api, say, escapeHtml } = window.Friday;
  const box = $("werkstatt");
  if (!box || !window.THREE) return;
  const THREE = window.THREE;

  const COLORS = { cyan: 0x4fd8ff, weiss: 0xf2f6ff, rot: 0xff4d5e, orange: 0xff8a1e, gelb: 0xffd84d, gruen: 0x4dffa6, blau: 0x3d7dff, lila: 0xb57bff, grau: 0x9aa4b2, schwarz: 0x2a2f38, glas: 0x9fe8ff, chrom: 0xd8e2ee, braun: 0xc08850, hellorange: 0xffc078 };
  // Hausmodus: wie durchsichtig die Ebenen im Hologramm sind (viele Wände sollen nicht alles überstrahlen).
  const ALPHA = { struktur: 0.05, raeume: 0.1 };
  const EDGE = { struktur: 0.22, raeume: 0.18, moebel: 0.5 };
  let ambient, sun, boden, umgebung = null, modellObj = null, modellId = "";
  let renderer, scene, camera, root, grid, raf = 0, plan = null, built = [], running = 0;
  let solid = (() => { try { return localStorage.getItem("friday_werkstatt_massiv") === "1"; } catch { return false; } })();
  let zoomMax = 80, yaw = 0.7, pitch = 0.42, dist = 9, target = new THREE.Vector3(0, 0.8, 0), autoSpin = true;

  // ---------- Szene ----------
  function init() {
    if (renderer) return;
    const canvas = $("werkstatt-canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02060b);
    scene.fog = new THREE.Fog(0x02060b, 14, 46);
    camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
    ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(6, 10, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    // v1.125.0: weicher Schatten unter dem Modell (nur "Massiv").
    boden = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.45 }));
    boden.rotation.x = -Math.PI / 2; boden.position.y = 0.002; boden.receiveShadow = true; boden.scale.setScalar(200);
    scene.add(boden);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    grid = new THREE.GridHelper(80, 80, 0x4fd8ff, 0x0f5a75);
    grid.material.transparent = true; grid.material.opacity = 0.55;
    scene.add(grid);
    root = new THREE.Group();
    scene.add(root);
    enableOrbit(canvas);
    stil();
    window.addEventListener("resize", resize);
    resize();
  }

  // ---------- v1.125.0: echte Optik ("Massiv") ----------
  // Studio-Umgebung für Spiegelungen auf Lack, Chrom und Glas (selbst gerechnet, keine Datei nötig).
  function studioUmgebung() {
    if (umgebung) return umgebung;
    const env = new THREE.Scene();
    const raum = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), new THREE.MeshBasicMaterial({ color: 0x2b3038, side: THREE.BackSide }));
    raum.position.y = 4;
    env.add(raum);
    const licht = (w, h, pos, rot, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(...pos); m.rotation.set(...rot); env.add(m);
    };
    licht(12, 4, [0, 8.9, 0], [Math.PI / 2, 0, 0], 4); // Deckenfeld
    licht(6, 3, [-9.9, 4, 0], [0, Math.PI / 2, 0], 3); // Softbox links
    licht(6, 3, [9.9, 4, 2], [0, -Math.PI / 2, 0], 2.2); // Softbox rechts
    licht(10, 1.2, [0, 2.5, -9.9], [0, 0, 0], 2.5); // Lichtstreifen hinten
    licht(20, 1, [0, 0.4, 9.9], [0, Math.PI, 0], 0.9); // Bodenlicht vorne
    const pm = new THREE.PMREMGenerator(renderer);
    umgebung = pm.fromScene(env, 0.035).texture;
    pm.dispose();
    return umgebung;
  }
  function stil() {
    if (!renderer) return;
    renderer.shadowMap.enabled = solid;
    renderer.outputEncoding = solid ? THREE.sRGBEncoding : THREE.LinearEncoding;
    renderer.toneMapping = solid ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.05;
    scene.environment = solid ? studioUmgebung() : null;
    ambient.intensity = solid ? 0.25 : 0.55;
    sun.intensity = solid ? 1.6 : 0.9;
    boden.visible = solid;
    grid.material.opacity = solid ? 0.3 : 0.55;
    grid.material.needsUpdate = true;
  }
  const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  // Echte Materialien: Lack mit Klarlack, Chrom, getöntes Glas, Gummi.
  function echtesMaterial(name, hex) {
    if (name === "glas") return new THREE.MeshPhysicalMaterial({ color: lin(0x6f8798), metalness: 0, roughness: 0.04, transparent: true, opacity: 0.38, envMapIntensity: 1.6, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
    if (name === "chrom") return new THREE.MeshStandardMaterial({ color: lin(0xe8edf2), metalness: 1, roughness: 0.12, envMapIntensity: 1.3 });
    if (name === "schwarz") return new THREE.MeshStandardMaterial({ color: lin(0x17191d), metalness: 0, roughness: 0.82 });
    if (name === "grau") return new THREE.MeshStandardMaterial({ color: lin(0x8d939b), metalness: 0.55, roughness: 0.38 });
    if (name === "braun") return new THREE.MeshStandardMaterial({ color: lin(0x8a5a32), metalness: 0, roughness: 0.6 });
    // Lackfarben: metallic mit Klarlack-Schicht
    return new THREE.MeshPhysicalMaterial({ color: lin(hex), metalness: 0.45, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1 });
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
    el.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) >= 6) autoSpin = false;
      yaw = drag.yaw - (e.clientX - drag.x) * 0.006;
      pitch = Math.max(0.05, Math.min(1.45, drag.pitch + (e.clientY - drag.y) * 0.005));
    });
    el.addEventListener("pointerup", (e) => {
      // Kurz tippen ohne Ziehen = Bauteil-Details zeigen; Ziehen dreht die Ansicht.
      if (drag && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) antippen(e);
      drag = null;
    });
    el.addEventListener("wheel", (e) => { e.preventDefault(); dist = Math.max(2, Math.min(zoomMax, dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (autoSpin) yaw += 0.0025;
    // Nebel mit dem Abstand mitziehen, sonst verschwinden große Modelle (Häuser) im Dunst.
    scene.fog.near = Math.max(14, dist * 0.9); scene.fog.far = Math.max(46, dist * 3);
    camera.position.set(target.x + dist * Math.cos(pitch) * Math.cos(yaw), target.y + dist * Math.sin(pitch), target.z + dist * Math.cos(pitch) * Math.sin(yaw));
    camera.lookAt(target);
    // Teile fahren beim Erscheinen von unten ein und leuchten kurz auf.
    for (const b of built) {
      const k = Math.max(0, Math.min(1, (t - b.born) / 700)); // noch nicht "geborene" Teile bleiben winzig (sonst riesig/negativ skaliert)
      const e = 1 - Math.pow(1 - k, 3);
      b.obj.scale.copy(b.base).multiplyScalar(0.001 + e * 0.999);
      b.obj.position.y = b.y + (1 - e) * 0.6;
      if (b.edge) b.edge.material.opacity = b.edgeBase + (1 - k) * (1 - b.edgeBase);
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
      if (p.ebene && haus) { // Haus: Schilder mit der Hausgröße wachsen lassen
        const k = Math.max(1, Math.min(2.4, Math.max(haus.masse.breite, haus.masse.tiefe) / 11));
        s.scale.multiplyScalar(p.nurEtage ? Math.max(0.7, k * 0.7) : k);
      }
      return { obj: s };
    }
    let geo;
    const v = (a, i, d) => (Array.isArray(a) && Number.isFinite(a[i]) ? Math.max(0.005, a[i]) : d);
    let usePos = true;
    if (p.form === "profil") {
      geo = profilGeo(p);
      if (!geo) return null;
      usePos = false;
    } else if (p.form === "flaeche") {
      geo = flaecheGeo(p);
      if (!geo) return null;
    } else if (p.form === "box") geo = new THREE.BoxGeometry(v(p.groesse, 0, 1), v(p.groesse, 1, 1), v(p.groesse, 2, 1));
    else if (p.form === "kugel") geo = new THREE.SphereGeometry(p.radius || 0.5, 20, 14);
    else if (p.form === "zylinder") {
      const r1 = Math.max(0.002, Number(p.radius) || 0.3), r2 = Number.isFinite(p.radius2) ? Math.max(0, p.radius2) : r1;
      geo = new THREE.CylinderGeometry(r2, r1, p.hoehe || 1, 36);
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
      ? echtesMaterial(p.farbe, hex)
      : new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: p.form === "rohr" || p.form === "kugel" ? 0.85 : glass ? 0.08 : (ALPHA[p.ebene] ?? 0.14), depthWrite: false, blending: THREE.AdditiveBlending }));
    group.add(fill);
    if (solid) { fill.castShadow = p.farbe !== "glas"; fill.receiveShadow = true; }
    let edge = null;
    if (p.form !== "rohr" && p.form !== "kugel" && !(solid && !haus)) { // Massiv: keine Drahtkanten, sieht echter aus
      // Schwarze Teile im Hologramm sonst unsichtbar: Kanten in hellem Graphit.
      const kante = !solid && p.farbe === "schwarz" ? 0x8c97a8 : hex;
      edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo, p.form === "profil" || p.form === "flaeche" ? 32 : 25), new THREE.LineBasicMaterial({ color: kante, transparent: true, opacity: 1 }));
      edge.userData.base = EDGE[p.ebene] ?? 0.35;
      group.add(edge);
    }
    const pos = p.form === "rohr" ? [0, 0, 0] : !usePos ? [0, 0, Array.isArray(p.pos) && Number.isFinite(p.pos[2]) ? p.pos[2] : 0] : (p.pos || [0, 0.5, 0]);
    group.position.fromArray(pos);
    if (Array.isArray(p.drehung)) group.rotation.set(...p.drehung.map((d) => (Number(d) || 0) * Math.PI / 180));
    if (Array.isArray(p.skala) && p.skala.length === 3 && p.skala.every((k) => Number.isFinite(k) && k > 0)) group.scale.set(...p.skala.map((k) => Math.min(20, k)));
    return { obj: group, edge, edgeBase: edge ? edge.userData.base : 0.35 };
  }

  // Seitenansicht als Umriss, in der Breite (z) ausgezogen, mit leicht gerundeten Kanten.
  // Ecken eines Umrisses weich runden (Chaikin), damit Karosserien nicht wie Klötze aussehen.
  function glaetten(pts, runden = 2) {
    let a = pts;
    for (let r = 0; r < runden; r++) {
      const b = [];
      for (let i = 0; i < a.length; i++) {
        const [x0, y0] = a[i], [x1, y1] = a[(i + 1) % a.length];
        b.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
      }
      a = b;
    }
    return a;
  }
  function profilGeo(p) {
    let pts = (p.punkte2d || []).filter((q) => Array.isArray(q) && Number.isFinite(q[0]) && Number.isFinite(q[1]));
    if (pts.length < 3) return null;
    if (p.glatt !== false && pts.length >= 5 && !p.ebene) pts = glaetten(pts, pts.length > 40 ? 1 : 2);
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const breite = Math.max(0.02, Number(p.breite) || 1);
    const r = Math.max(0, Math.min(0.12, Number(p.rundung) || 0, breite / 4));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, breite - 2 * r), bevelEnabled: r > 0, bevelThickness: r, bevelSize: r * 0.8, bevelSegments: solid ? 6 : 3, curveSegments: 6 });
    geo.computeVertexNormals();
    geo.translate(0, 0, -(breite - 2 * r) / 2);
    return geo;
  }

  // Draufsicht als Umriss (Flügel, Schiffsrumpf, Deck): Punkte [x, z], nach oben (y) um "dicke" ausgezogen.
  function flaecheGeo(p) {
    const pts = (p.punkte2d || []).filter((q) => Array.isArray(q) && Number.isFinite(q[0]) && Number.isFinite(q[1]));
    if (pts.length < 3) return null;
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const d = Math.max(0.01, Number(p.dicke) || 0.1);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 4 });
    geo.translate(0, 0, -d / 2);
    geo.rotateX(-Math.PI / 2); // Umriss liegt flach, Dicke zeigt nach oben
    return geo;
  }

  function addParts(teile, t0, status = "") {
    const gap = Math.min(18, 1500 / Math.max(1, teile.length)); // große Bauabschnitte schneller einblenden
    teile.forEach((p, i) => {
      const part = makePart(p);
      if (!part) return;
      root.add(part.obj);
      built.push({ edgeBase: 0.35, ...part, y: part.obj.position.y, base: part.obj.scale.clone(), born: t0 + i * gap, src: p, status });
    });
    applyHaus();
  }

  // Kamera an die Größe des Modells anpassen.
  function frameModel() {
    const bb = new THREE.Box3();
    for (const b of built) if (b.obj.visible && b.src.form !== "text") bb.expandByObject(b.obj);
    if (bb.isEmpty()) return;
    const size = bb.getSize(new THREE.Vector3()), center = bb.getCenter(new THREE.Vector3());
    target.copy(center);
    dist = Math.max(4, Math.max(size.x, size.y, size.z) * 1.9);
    if (camera.aspect < 1) dist *= Math.min(2, 1.15 / camera.aspect); // Hochformat (Handy): weiter weg, damit alles reinpasst
    // Große Modelle (Schiffe mit 300 m): Sichtweite der Kamera mitziehen, sonst bleibt das Bild leer.
    zoomMax = Math.max(80, dist * 3);
    // Schattenkamera passend zum Modell
    const r = Math.max(size.x, size.y, size.z) * 0.8 + 0.5;
    sun.position.set(center.x + r * 0.8, center.y + r * 1.6, center.z + r * 0.6);
    sun.target.position.copy(center);
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.1, far: r * 5 });
    sun.shadow.camera.updateProjectionMatrix();
    grid.scale.setScalar(Math.max(1, Math.max(size.x, size.z) / 40)); // Raster wächst mit großen Modellen (Schiffe)
    const weit = Math.max(200, dist * 4 + Math.max(size.x, size.y, size.z));
    if (camera.far !== weit) { camera.far = weit; camera.near = Math.max(0.05, dist / 400); camera.updateProjectionMatrix(); }
  }

  // Gesamtmaße als Maßlinien mit Beschriftung.
  function addDimensions() {
    const bb = new THREE.Box3();
    // Beim Haus zählen nur Rohbau-Teile (nicht Wärmepumpe im Garten oder Kanal-Anschluss).
    for (const b of built) if (b.src.form !== "text" && (!b.src.ebene || b.src.ebene === "struktur")) bb.expandByObject(b.obj);
    if (bb.isEmpty()) return;
    const fmt = (m) => `${m.toLocaleString("de-DE", { maximumFractionDigits: 2 })} m`;
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const dims = new THREE.Group();
    const line = (a, b, text, at) => {
      dims.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mat));
      const s = labelSprite(text, "#ffffff"); s.scale.multiplyScalar(0.7); s.position.copy(at); dims.add(s);
    };
    const { min, max } = bb, off = 0.4;
    line(new THREE.Vector3(min.x, 0.02, max.z + off), new THREE.Vector3(max.x, 0.02, max.z + off), fmt(max.x - min.x), new THREE.Vector3((min.x + max.x) / 2, 0.25, max.z + off));
    line(new THREE.Vector3(max.x + off, 0.02, min.z), new THREE.Vector3(max.x + off, 0.02, max.z), fmt(max.z - min.z), new THREE.Vector3(max.x + off, 0.25, (min.z + max.z) / 2));
    line(new THREE.Vector3(max.x + off, 0, min.z - off), new THREE.Vector3(max.x + off, max.y, min.z - off), fmt(max.y), new THREE.Vector3(max.x + off, max.y / 2, min.z - off - 0.3));
    dims.name = "masse";
    root.add(dims);
  }

  // ---------- v1.125.0: echte 3D-Modelle (GLB aus Fridays Modell-Bibliothek) ----------
  const modellCache = new Map();
  async function ladeModell(m) {
    if (modellCache.has(m.id)) return modellCache.get(m.id).clone(true);
    if (!THREE.GLTFLoader) throw new Error("GLTF-Lader fehlt");
    const res = await api(`/api/modelle/datei/${encodeURIComponent(m.id)}`);
    if (!res.ok) throw new Error("Modell-Datei fehlt");
    const buf = await res.arrayBuffer();
    const gltf = await new Promise((ok, fail) => new THREE.GLTFLoader().parse(buf, "", ok, fail));
    const obj = gltf.scene || gltf.scenes?.[0];
    if (!obj) throw new Error("Leeres Modell");
    // Größe: auf die echte Länge bringen (falls bekannt), auf den Boden stellen, mittig ausrichten.
    obj.updateMatrixWorld(true);
    let bb = new THREE.Box3().setFromObject(obj);
    const size = bb.getSize(new THREE.Vector3());
    const lang = Math.max(size.x, size.z), hoch = size.y;
    let ziel = Number(m.laenge) || 0;
    let k = 1;
    if (ziel > 0) k = ziel / Math.max(lang, hoch > lang * 2 ? hoch : 0, 1e-6);
    else if (lang < 0.3 || lang > 500) k = 5 / Math.max(lang, 1e-6); // unbekannte Einheit: ca. 5 m
    const wrap = new THREE.Group();
    obj.scale.multiplyScalar(k);
    wrap.add(obj);
    wrap.updateMatrixWorld(true);
    bb = new THREE.Box3().setFromObject(wrap);
    const c = bb.getCenter(new THREE.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= bb.min.y;
    let dreiecke = 0;
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      // Glas: three.js r128 kann echte Transmission nicht sauber (Scheiben werden weiß) → getöntes, durchsichtiges Glas.
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
        if (mat && mat.transmission > 0) {
          mat.transmission = 0; mat.transparent = true; mat.opacity = Math.min(mat.opacity ?? 1, 0.32);
          mat.color?.setRGB(0.05, 0.07, 0.09); mat.roughness = 0.03; mat.metalness = 0.2; mat.depthWrite = false; mat.needsUpdate = true;
          o.castShadow = false;
        }
      }
      const g = o.geometry;
      dreiecke += g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3;
    });
    wrap.userData.dreiecke = dreiecke;
    modellCache.set(m.id, wrap);
    return wrap.clone(true);
  }
  // Hologramm oder echte Materialien auf das geladene Modell legen.
  const holoMat = new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending });
  const holoKante = new THREE.LineBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.35 });
  function modellStil(wrap) {
    const kanten = (wrap.userData.dreiecke || 0) < 250000;
    // Achtung: nichts in userData legen – clone() kopiert userData per JSON und macht Materialien kaputt.
    const meshes = [];
    wrap.traverse((o) => { if (o.isMesh && !o.isLineSegments) meshes.push(o); });
    for (const o of meshes) {
      if (!o._orig) Object.defineProperty(o, "_orig", { value: o.material, writable: true });
      o.material = solid ? o._orig : holoMat;
      if (!solid && kanten && !o._kante) {
        Object.defineProperty(o, "_kante", { value: new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 35), holoKante), writable: true });
        o.add(o._kante);
      }
      if (o._kante) o._kante.visible = !solid;
    }
  }
  async function zeigeModell(m, t0) {
    try {
      setCaption("Lade echtes 3D-Modell …");
      const wrap = await ladeModell(m);
      modellStil(wrap);
      modellObj = wrap; modellId = m.id;
      root.add(wrap);
      built.push({ obj: wrap, edge: null, edgeBase: 0, y: 0, base: wrap.scale.clone(), born: performance.now(), src: { form: "modell", name: m.name }, status: "Echtes 3D-Modell" });
      frameModel();
      return true;
    } catch (err) {
      console.warn("Werkstatt-Modell:", err);
      setCaption("Das echte Modell ließ sich nicht laden.");
      return false;
    }
  }

  // ---------- Ablauf ----------
  function setCaption(text) { $("werkstatt-caption").textContent = text || ""; }
  function setState(text, cls = "") { const s = $("werkstatt-state"); s.textContent = text; s.className = `werkstatt-state ${cls}`; }

  // Infokarte: Steckbrief (Typ, Baujahr, Preis) + Eckdaten. Keine Schilder mehr im Modell.
  function showFacts(p) {
    $("werkstatt-title").textContent = (p.titel || "Werkstatt").toUpperCase();
    const sb = p.steckbrief;
    let html = "";
    if (sb && (sb.typ || sb.baujahr || sb.preis)) {
      html += `<li class="ws-steck">${sb.typ ? `<small>${escapeHtml(sb.typ)}</small>` : ""}${sb.kurz ? `<p>${escapeHtml(sb.kurz)}</p>` : ""}`
        + `<div class="ws-steck-row"><span><small>Baujahr</small><b>${escapeHtml(sb.baujahr || "–")}</b></span><span><small>Preis</small><b>${escapeHtml(sb.preis || "–")}</b></span></div></li>`;
    }
    html += (p.kennzahlen || []).map((k) => `<li><small>${escapeHtml(k.label)}</small><b>${escapeHtml(k.wert)}</b></li>`).join("");
    const m = p.modell;
    if (m) html += `<li class="ws-quelle"><small>3D-Modell</small><b>${escapeHtml(m.name || "")}</b>${m.autor ? `<span>von ${escapeHtml(m.autor)}</span>` : ""}${m.lizenz ? `<span>${escapeHtml(m.lizenz)}${m.quelle ? ` · ${escapeHtml(m.quelle)}` : ""}</span>` : ""}${/^https:\/\//.test(m.link || "") ? `<a href="${escapeHtml(m.link)}" target="_blank" rel="noopener">Quelle ansehen</a>` : ""}</li>`;
    $("werkstatt-facts").innerHTML = html;
  }

  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  // v1.122.0: Friday erzählt wieder, was sie baut ("Das ist der Motor …"). Die Sätze stehen in einer
  // Warteschlange und werden nacheinander vorgelesen; der Bau wartet nie auf die Stimme.
  // "Friday, stopp" (oder ein neuer Befehl) leert die Schlange.
  let sprichtGerade = false, schlange = [];
  function ansage(text) {
    text = String(text || "").trim();
    if (!text || !$("voice-toggle")?.checked) return;
    schlange.push(text);
    if (!sprichtGerade) naechste();
  }
  function naechste() {
    const text = schlange.shift();
    if (!text || box.classList.contains("hidden")) { schlange = []; sprichtGerade = false; return; }
    sprichtGerade = true;
    Promise.resolve(say(text)).catch(() => {}).finally(() => {
      sprichtGerade = false;
      if (window.Friday?.unterbrochen?.()) { schlange = []; return; }
      naechste();
    });
  }
  window.addEventListener("friday-stopp", () => { schlange = []; });

  async function play(entry) {
    const run = ++running;
    let job = entry;
    const neu = !entry.erweiterung || !plan;
    if (neu) {
      root.clear(); built = []; autoSpin = true;
      plan = { titel: "", kennzahlen: [], schritte: [] };
      setupHaus(entry.plan?.haus || null);
    } else {
      root.getObjectByName("masse")?.removeFromParent();
    }
    infoAus();
    schlange = [];
    // v1.134.0: Autos aus Fridays Datenbank → helles Auto-Studio (Seitenansicht, Spiegelboden, Daten).
    if (entry.plan?.studio && window.FridayStudio) {
      plan = { titel: entry.plan.titel, kennzahlen: entry.plan.kennzahlen || [], steckbrief: entry.plan.steckbrief, schritte: [] };
      showFacts(plan);
      setState("STUDIO", "done");
      $("werkstatt-step").textContent = "AUTO-STUDIO";
      setCaption("Auto-Studio: Farbe, Ansicht und Modellreihe unten wählen.");
      if (window.FridayStudio.zeige(entry.plan.studio)) {
        ansage(entry.plan.einleitung);
        ansage(entry.plan.fazit);
        // Echtes 3D-Modell: sofort (Bibliothek) oder sobald Sketchfab fertig ist (höchstens 90 s warten).
        let st = entry.plan.studio;
        const t0 = Date.now();
        while (st.wartet && run === running && Date.now() - t0 < 90000) {
          await pause(1500);
          try { st = (await (await api(`/api/werkstatt/job/${entry.id}`)).json()).plan?.studio || {}; } catch { /* weiter warten */ }
        }
        if (run === running && st.datei) window.FridayStudio.echt(st.datei);
        return;
      }
    }
    let gezeigt = 0, angesagt = false, fehlversuche = 0, planNr = entry.planNr || 1, geladenId = "";
    if (neu) { modellObj = null; modellId = ""; plan.modell = null; }
    const t0 = Date.now();
    setState("PLANT …", "busy");
    setCaption(entry.erweiterung ? "Ergänze das Modell …" : "Entwurf läuft …");
    while (run === running) {
      // Plan wurde auf dem Server neu gesetzt (z. B. Vorlage statt leerem Entwurf): von vorn aufbauen.
      if ((job.planNr || 1) !== planNr) {
        planNr = job.planNr || 1;
        if (neu) { root.clear(); built = []; plan.schritte = []; if (modellObj && job.plan?.modell?.id === modellId) { root.add(modellObj); built.push({ obj: modellObj, edge: null, edgeBase: 0, y: 0, base: modellObj.scale.clone(), born: 0, src: { form: "modell", name: job.plan.modell.name }, status: "Echtes 3D-Modell" }); } else { modellObj = null; geladenId = ""; } }
        gezeigt = 0;
      }
      const p = job.plan || {};
      if (p.titel && neu) plan.titel = p.titel;
      if (p.steckbrief) plan.steckbrief = p.steckbrief;
      if (p.kennzahlen?.length) plan.kennzahlen = p.kennzahlen;
      if (p.titel || p.kennzahlen?.length) showFacts(plan);
      if (p.einleitung) plan.einleitung = p.einleitung;
      if (p.modell) plan.modell = p.modell;
      if (p.modell && p.modell.id !== geladenId && neu) {
        geladenId = p.modell.id;
        if (p.modell.laenge || job.status === "fertig") {
          // mit echter Länge laden (kommt mit dem Steckbrief) – bis dahin kurz warten
          setState("LÄDT MODELL", "busy");
          await zeigeModell(p.modell, t0);
          if (run !== running) return;
        } else geladenId = "";
      }
      if (job.phase && !gezeigt && !geladenId) setCaption(job.phase);
      if (p.fazit) plan.fazit = p.fazit;
      // Erst die Einleitung ("Sehr gern, Chef. Ein Audi A4 …"), sonst wenigstens der Titel.
      if (!angesagt && (plan.einleitung || (plan.titel && (job.status !== "plant" || job.ohneClaude)))) {
        angesagt = true;
        ansage(plan.einleitung || `${entry.erweiterung ? "Ich ergänze" : "Ich baue"} ${plan.titel}.`);
      }
      const schritte = p.schritte || [];
      while (gezeigt < schritte.length && run === running) {
        const s = schritte[gezeigt++];
        if (!s?.teile?.length) continue;
        plan.schritte.push(s);
        setState("BAUT", "busy");
        $("werkstatt-step").textContent = `ABSCHNITT ${gezeigt}${job.status === "fertig" ? ` / ${schritte.length}` : ""}`;
        setCaption(s.status || `Abschnitt ${gezeigt}`);
        addParts(s.teile, performance.now(), s.status);
        frameModel();
        ansage(s.sagen || s.status);
        await pause(job.status === "fertig" ? 600 : 200);
      }
      if (run !== running) return;
      if (job.status === "fertig" || job.ohneClaude) break;
      if (job.status === "fehler") { setState("FEHLER", "error"); setCaption(job.error || "Das hat nicht geklappt."); return; }
      if (Date.now() - t0 > 240000) { setState("FEHLER", "error"); setCaption("Der Bau dauert zu lange. Versuch es noch einmal."); return; }
      if (!gezeigt && !geladenId) setCaption(`${job.phase || (entry.erweiterung ? "Ergänze …" : "Entwurf läuft …")} ${Math.round((Date.now() - t0) / 1000)} s`);
      await pause(500);
      if (run !== running) return;
      try {
        const res = await api(`/api/werkstatt/job/${entry.id}`);
        if (res.status === 404) { setState("FEHLER", "error"); setCaption("Friday wurde neu gestartet. Bitte noch einmal bauen."); return; }
        job = await res.json();
        fehlversuche = 0;
      } catch {
        if (++fehlversuche > 12) { setState("FEHLER", "error"); setCaption("Friday ist gerade nicht erreichbar."); return; }
      }
    }
    if (run !== running) return;
    if (haus) addDimensions(); // Fahrzeuge & Co.: echte Maße stehen in der Infokarte, keine Extra-Schilder
    frameModel();
    setTimeout(() => { if (run === running) frameModel(); }, 900); // nach dem Einblenden der letzten Teile nachjustieren
    $("werkstatt-step").textContent = modellObj ? `ECHTES 3D-MODELL · ${Math.max(1, Math.round((Date.now() - t0) / 1000))} S` : `${built.filter((b) => b.src.form !== "text").length} TEILE · ${Math.max(1, Math.round((Date.now() - t0) / 1000))} S`;
    setState("FERTIG", "done");
    setCaption(haus ? "Fertig. Etagen und Leitungen rechts umschalten." : job.hinweis ? `${job.hinweis} Teil antippen für Details.` : "Fertig. Teil antippen für Details.");
    ansage(plan.fazit || "So, Chef. Fertig.");
  }

  function rebuildMaterials() {
    if (!plan) return;
    root.clear(); built = [];
    if (modellObj) { modellStil(modellObj); root.add(modellObj); built.push({ obj: modellObj, edge: null, edgeBase: 0, y: 0, base: modellObj.scale.clone(), born: 0, src: { form: "modell", name: plan.modell?.name || "3D-Modell" }, status: "Echtes 3D-Modell" }); }
    plan.schritte.forEach((s) => addParts(s.teile, performance.now() - 2000, s.status));
    if (haus) addDimensions();
    applyHaus();
    infoAus();
  }

  async function request(wunsch, { neu = false } = {}) {
    wunsch = String(wunsch || "").trim();
    if (!wunsch) return;
    const erweitern = !neu && $("werkstatt-extend").checked && plan;
    running++;
    setState("PLANT …", "busy");
    setCaption(erweitern ? "Ergänze das Modell …" : "Entwurf läuft …");
    try {
      const res = await api("/api/werkstatt", { method: "POST", body: JSON.stringify({ wunsch, basis: erweitern ? { titel: plan.titel, kennzahlen: plan.kennzahlen, schritte: plan.schritte.map((s) => ({ status: s.status || s.sagen || "" })) } : null }) });
      const r = await res.json();
      if (!r.ok) { setState("FEHLER", "error"); setCaption(r.error || "Das hat nicht geklappt."); return; }
      lastId = r.id;
      play(r);
    } catch { setState("FEHLER", "error"); setCaption("Friday ist gerade nicht erreichbar."); }
  }

  // ---------- Antippen: Details zu einem Teil ----------
  const ray = new THREE.Raycaster();
  let auswahl = null;
  function infoAus() {
    if (auswahl?.edge) { auswahl.edge.material.color.setHex(auswahl.farbe); }
    auswahl = null;
    $("werkstatt-info")?.classList.add("hidden");
  }
  function antippen(e) {
    if (!renderer || !built.length) return;
    const r = renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(m, camera);
    const ziele = built.filter((b) => b.obj.visible && b.src.form !== "text");
    const hits = ray.intersectObjects(ziele.map((b) => b.obj), true);
    infoAus();
    if (!hits.length) return;
    let o = hits[0].object;
    const b = ziele.find((x) => { let k = o; while (k) { if (k === x.obj) return true; k = k.parent; } return false; });
    if (!b) return;
    if (b.edge) { auswahl = { edge: b.edge, farbe: b.edge.material.color.getHex() }; b.edge.material.color.setHex(0xffffff); b.edge.material.opacity = 1; }
    else auswahl = null;
    const el = $("werkstatt-info");
    if (!el) return;
    el.innerHTML = `<small>${escapeHtml(b.status || "Bauteil")}</small><b>${escapeHtml(b.src.name || formName(b.src))}</b>${masse(b.src)}`;
    el.classList.remove("hidden");
  }
  const formName = (p) => ({ box: "Bauteil", zylinder: "Rundteil", kugel: "Kugel", rohr: "Leitung", profil: "Hülle", flaeche: "Fläche" }[p.form] || "Bauteil");
  function masse(p) {
    const f = (n) => Number(n).toLocaleString("de-DE", { maximumFractionDigits: 2 });
    if (p.form === "box" && Array.isArray(p.groesse)) return `<span>${p.groesse.map(f).join(" × ")} m</span>`;
    if (p.form === "zylinder" && p.radius) return `<span>Ø ${f(p.radius * 2)} m</span>`;
    if (p.form === "flaeche" && Array.isArray(p.punkte2d)) { const xs = p.punkte2d.map((q) => q[0]), zs = p.punkte2d.map((q) => q[1]); return `<span>${f(Math.max(...xs) - Math.min(...xs))} × ${f(Math.max(...zs) - Math.min(...zs))} m</span>`; }
    if (p.form === "profil" && Array.isArray(p.punkte2d)) { const xs = p.punkte2d.map((q) => q[0]), ys = p.punkte2d.map((q) => q[1]); return `<span>${f(Math.max(...xs) - Math.min(...xs))} × ${f(p.breite || 0)} × ${f(Math.max(...ys) - Math.min(...ys))} m</span>`; }
    return "";
  }

  // ---------- Öffnen / Schließen ----------
  let lastId = 0;
  function open() {
    box.classList.remove("hidden");
    const sw = $("werkstatt-solid"); if (sw) sw.checked = solid;
    init();
    stil();
    resize();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function close() {
    box.classList.add("hidden");
    infoAus();
    cancelAnimationFrame(raf);
    running++; // laufende Ansage beenden
    try { speechSynthesis?.cancel(); } catch { /* egal */ }
  }

  $("werkstatt-open")?.addEventListener("click", open);
  $("werkstatt-x")?.addEventListener("click", close);
  $("werkstatt-form")?.addEventListener("submit", (e) => { e.preventDefault(); const t = $("werkstatt-input"); request(t.value); t.value = ""; });
  $("werkstatt-solid")?.addEventListener("change", (e) => { solid = e.target.checked; try { localStorage.setItem("friday_werkstatt_massiv", solid ? "1" : "0"); } catch { /* egal */ } stil(); rebuildMaterials(); });
  // v1.124.0: Vorlagen-Knopf – Haus, Autos, Flugzeuge, Schiffe … sofort und ohne Claude-Guthaben.
  const VORLAGEN = [
    ["🏠", "Haus", "Mehrfamilienhaus mit 4 Etagen und 8 Wohnungen"], ["🏡", "Einfamilienhaus", "bau mir ein Einfamilienhaus"],
    ["🏎️", "Sportwagen", "bau mir einen Sportwagen"], ["🚗", "Auto", "bau mir ein Auto"], ["🚙", "SUV", "bau mir einen SUV"], ["🔋", "E-Auto", "bau mir ein Elektroauto"],
    ["🚛", "LKW", "bau mir einen LKW"], ["🚌", "Bus", "bau mir einen Bus"], ["🏍️", "Motorrad", "bau mir ein Motorrad"], ["🚄", "Zug", "bau mir einen Zug"],
    ["✈️", "Flugzeug", "bau mir ein Flugzeug"], ["🛩️", "Kampfjet", "bau mir einen Kampfjet"], ["🚁", "Helikopter", "bau mir einen Helikopter"], ["🚀", "Rakete", "bau mir eine Rakete"],
    ["🚢", "Containerschiff", "bau mir ein Containerschiff"], ["🛳️", "Kreuzfahrtschiff", "bau mir ein Kreuzfahrtschiff"], ["🛥️", "Motorboot", "bau mir ein Motorboot"], ["⛵", "Segelboot", "bau mir ein Segelboot"], ["🌊", "U-Boot", "bau mir ein U-Boot"],
  ];
  // v1.134.0: Auto-Studio – Modellreihen wie auf den TikTok-Bildern (Daten in server/src/autostudio.js).
  VORLAGEN.unshift(["🏁", "BMW M", "BMW M Modellreihe"], ["🏁", "Mercedes-AMG", "Mercedes-AMG Modellreihe"], ["🏁", "Audi RS", "Audi RS Modellreihe"], ["🏁", "VW R", "Volkswagen R Modellreihe"], ["🏁", "Porsche", "Porsche Modellreihe"]);
  const vorlagenBox = $("werkstatt-vorlagen");
  if (vorlagenBox) {
    vorlagenBox.innerHTML = VORLAGEN.map(([ico, name, wunsch], i) => `<button type="button" data-i="${i}" title="${escapeHtml(wunsch)}"${ico === "🏁" ? ' class="ws-studio"' : ""}>${ico} ${escapeHtml(name)}</button>`).join("");
    vorlagenBox.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]");
      if (!b) return;
      vorlagenBox.classList.add("hidden");
      request(VORLAGEN[Number(b.dataset.i)][2], { neu: true });
    });
  }
  // v1.125.0: Echte Modelle – Sketchfab-Schlüssel direkt im Vorlagen-Fenster eintragen.
  async function echtZeile() {
    if (!vorlagenBox) return;
    let st = {};
    try { st = await (await api("/api/modelle")).json(); } catch { /* egal */ }
    vorlagenBox.querySelector(".ws-echt")?.remove();
    const d = document.createElement("div");
    d.className = "ws-echt";
    const anzahl = (st.modelle || []).length;
    d.innerHTML = st.sketchfab
      ? `<span>✅ <b>Echte Modelle an</b> (Sketchfab${st.konto ? ` · ${escapeHtml(st.konto)}` : ""}) · ${anzahl} in deiner Bibliothek. Sag einfach, was du sehen willst, z. B. „Lamborghini Huracán“.</span><button type="button" class="ghost small" data-sf="aus">Trennen</button>`
      : `<span>🔑 <b>Echte 3D-Modelle:</b> kostenlosen Sketchfab-Schlüssel einfügen (<a href="https://sketchfab.com/settings/password" target="_blank" rel="noopener">sketchfab.com → Einstellungen → Password &amp; API</a>).${anzahl ? ` ${anzahl} Modell${anzahl > 1 ? "e" : ""} schon da.` : ""}</span><input type="password" autocomplete="off" placeholder="API-Schlüssel"><button type="button" class="werkstatt-go" data-sf="an">Verbinden</button>`;
    vorlagenBox.prepend(d);
    d.addEventListener("click", async (e) => {
      const b = e.target.closest("button[data-sf]");
      if (!b) return;
      e.stopPropagation();
      b.disabled = true;
      try {
        const r = b.dataset.sf === "an"
          ? await (await api("/api/modelle/sketchfab", { method: "POST", body: JSON.stringify({ token: d.querySelector("input")?.value || "" }) })).json()
          : await (await api("/api/modelle/sketchfab", { method: "DELETE" })).json();
        if (r.ok === false) { setCaption(r.error || "Das hat nicht geklappt."); b.disabled = false; return; }
        setCaption(b.dataset.sf === "an" ? "Sketchfab verbunden. Ab jetzt baue ich mit echten Modellen, Chef." : "Sketchfab getrennt.");
        echtZeile();
      } catch { setCaption("Friday ist gerade nicht erreichbar."); b.disabled = false; }
    });
  }
  $("werkstatt-beispiel")?.addEventListener("click", () => {
    if (!vorlagenBox) return request("Mehrfamilienhaus mit 4 Etagen und 8 Wohnungen", { neu: true });
    vorlagenBox.classList.toggle("hidden");
    if (!vorlagenBox.classList.contains("hidden")) echtZeile();
  });

  // ---------- Hausmodus: Etagen, Ebenen, Schnitt, Grundriss ----------
  let haus = null, etageSel = "alle", ebeneOn = {}, schnittOn = false;
  const clip = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const COLOR_CSS = (name) => `#${(COLORS[name] ?? COLORS.cyan).toString(16).padStart(6, "0")}`;
  const etagenLabel = (nr) => (nr === "alle" ? "Alle" : nr === haus?.dach ? "Dach" : haus?.etagen.find((e) => e.nr === nr)?.kurz || String(nr));

  function setupHaus(h) {
    haus = h;
    const panel = $("werkstatt-haus");
    $("werkstatt-plan")?.classList.add("hidden");
    $("wh-plan")?.classList.remove("on");
    if (!h) { panel?.classList.add("hidden"); box.classList.remove("ist-haus"); schnittOn = false; return; }
    etageSel = "alle"; schnittOn = false;
    ebeneOn = Object.fromEntries(h.ebenen.map((e) => [e.id, true]));
    if (window.innerWidth < 700) panel.open = false;
    box.classList.add("ist-haus");
    $("wh-schnitt").checked = false; $("wh-schnitt-pos").disabled = true; $("wh-schnitt-pos").value = 50;
    $("wh-ebenen").innerHTML = h.ebenen.map((e) => `<label style="color:${COLOR_CSS(e.farbe)}"><input type="checkbox" data-ebene="${escapeHtml(e.id)}" checked><i></i><span style="color:#fff">${escapeHtml(e.name)}</span></label>`).join("");
    const nrs = ["alle", ...h.etagen.map((e) => e.nr), h.dach];
    $("wh-etagen").innerHTML = nrs.map((nr) => `<button type="button" data-etage="${nr}">${escapeHtml(etagenLabel(nr))}</button>`).join("");
    markEtage();
    zeigeKosten(h.kosten);
    panel.classList.remove("hidden");
  }
  // Grobe Kostenschätzung (kommt fertig vom Server).
  function zeigeKosten(k) {
    const el = $("wh-kosten");
    if (!el) return;
    if (!k) { el.classList.add("hidden"); return; }
    const euro = (v) => `${Number(v).toLocaleString("de-DE")} €`;
    const kurz = (v) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 2 })} Mio. €` : `${Math.round(v / 1000).toLocaleString("de-DE")} Tsd. €`);
    $("wh-kosten-summe").textContent = `ca. ${kurz(k.summe)}`;
    $("wh-kosten-liste").innerHTML = k.posten.map((p) => `<li><span>${escapeHtml(p.bereich)}</span><b>${euro(p.betrag)}</b></li>`).join("")
      + `<li class="summe"><span>Gesamt (ca. ${k.proM2.toLocaleString("de-DE")} €/m²)</span><b>${euro(k.summe)}</b></li>`
      + `<li><span>Spanne</span><b>${kurz(k.spanne[0])} – ${kurz(k.spanne[1])}</b></li>`;
    $("wh-kosten-hinweis").textContent = `⚠︎ ${k.hinweis}`;
    el.classList.remove("hidden");
  }
  function markEtage() {
    $("wh-etagen")?.querySelectorAll("button").forEach((b) => b.classList.toggle("on", String(etageSel) === b.dataset.etage));
  }

  // Sichtbarkeit je Teil: Ebene an/aus, gewählte Etage, Raum-Beschriftungen nur in der Einzel-Etage.
  function applyHaus() {
    if (!root) return;
    const planes = schnittOn ? [clip] : null;
    for (const b of built) {
      const s = b.src;
      let vis = true;
      if (haus) {
        if (s.ebene && ebeneOn[s.ebene] === false) vis = false;
        if (etageSel === "alle") { if (s.nurEtage) vis = false; }
        else if (s.etage !== undefined && s.etage !== etageSel) vis = false;
      }
      b.obj.visible = vis;
      b.obj.traverse((o) => { if (o.material && o.material.clippingPlanes !== planes) { o.material.clippingPlanes = planes; o.material.needsUpdate = true; } });
    }
    const masse = root.getObjectByName("masse");
    if (masse) masse.visible = !haus || etageSel === "alle";
  }

  function updateClip() {
    if (!haus) return;
    const t = Number($("wh-schnitt-pos").value) / 100;
    const T = haus.masse.tiefe;
    // Alles vor der Schnittebene (Straßenseite) wird ausgeblendet.
    clip.constant = -(-T / 2 - 0.5 + t * (T + 1));
  }

  function focusEtage() {
    if (!haus) return;
    if (etageSel === "alle") { frameModel(); return; }
    const e = haus.etagen.find((x) => x.nr === etageSel);
    const y = e ? e.y : haus.dach * 3;
    target.set(0, y + 1, 0);
    dist = Math.max(8, Math.max(haus.masse.breite, haus.masse.tiefe) * 1.25);
  }

  const fl = (v) => Number(v).toLocaleString("de-DE", { maximumFractionDigits: 1 });
  function zeigeGrundriss() {
    if (!haus) return;
    const nr = etageSel === "alle" || etageSel === haus.dach ? 0 : etageSel;
    const e = haus.etagen.find((x) => x.nr === nr) || haus.etagen[0];
    const B = haus.masse.breite, T = haus.masse.tiefe, pad = 0.8;
    const FILL = { wohnen: "#123d52", essen: "#123d52", schlafen: "#2a2350", kind: "#203a2a", kueche: "#3b2a12", bad: "#0f3a4a", wc: "#0f3a4a", flur: "#1a2430", garderobe: "#1a2430", abstell: "#1d1d26", treppenhaus: "#262626", keller: "#1d1d26", technik: "#3b2412" };
    // Blick von oben: Straßenseite (vorne) unten.
    const Y = (z) => T / 2 - z;
    let svg = `<svg viewBox="${-B / 2 - pad} ${-pad} ${B + 2 * pad} ${T + 2 * pad + 0.6}" preserveAspectRatio="xMidYMid meet">`;
    svg += `<rect x="${-B / 2}" y="0" width="${B}" height="${T}" fill="none" stroke="#4fd8ff" stroke-width=".3"/>`;
    for (const r of e.raeume) {
      const [x0, z0, x1, z1] = r.rect, w = x1 - x0, d = z1 - z0;
      const fs = Math.min(Math.max(B * 0.017, 0.3), w / 6.5, d / 3);
      svg += `<rect class="raum" x="${x0}" y="${Y(z1)}" width="${w}" height="${d}" fill="${FILL[r.typ] || "#16202a"}"/>`;
      svg += `<text x="${x0 + w / 2}" y="${Y(z1) + d / 2 - fs * 0.6}" font-size="${fs}">${escapeHtml(r.name)}</text>`;
      svg += `<text x="${x0 + w / 2}" y="${Y(z1) + d / 2 + fs * 0.7}" font-size="${fs * 0.9}" fill="#8fc7de">${fl(r.flaeche)} m²</text>`;
    }
    for (const w of e.wohnungen) {
      const [x0, z0, x1, z1] = w.rect;
      svg += `<rect x="${x0}" y="${Y(z1)}" width="${x1 - x0}" height="${z1 - z0}" fill="none" stroke="#ff8a1e" stroke-width=".12" stroke-dasharray=".4 .25"/>`;
    }
    for (const [sx, sz] of e.schaechte || []) svg += `<circle cx="${sx}" cy="${Y(sz)}" r=".22" fill="#3d7dff" stroke="#fff" stroke-width=".05"><title>Installationsschacht</title></circle>`;
    svg += `<text x="0" y="${T + pad * 0.6}" font-size="${Math.min(0.42, B * 0.016)}" fill="#8fc7de">▼ Straßenseite · ${String(B).replace(".", ",")} × ${String(T).replace(".", ",")} m · blauer Punkt = Installationsschacht</text></svg>`;
    $("wp-svg").innerHTML = svg;
    $("wp-titel").textContent = `GRUNDRISS · ${e.name.toUpperCase()}`;
    const list = e.wohnungen.length ? e.wohnungen.map((w) => `<li><b>${escapeHtml(w.name)}</b><br>${w.zimmer} Zimmer · ${fl(w.flaeche)} m²</li>`) : e.raeume.map((r) => `<li><b>${escapeHtml(r.name)}</b><br>${fl(r.flaeche)} m²</li>`);
    $("wp-liste").innerHTML = list.join("");
    $("werkstatt-plan").classList.remove("hidden");
    $("wh-plan").classList.add("on");
  }

  $("wh-etagen")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-etage]");
    if (!b) return;
    etageSel = b.dataset.etage === "alle" ? "alle" : Number(b.dataset.etage);
    markEtage(); applyHaus(); focusEtage();
    if (!$("werkstatt-plan").classList.contains("hidden")) zeigeGrundriss();
  });
  $("wh-ebenen")?.addEventListener("change", (e) => {
    const id = e.target?.dataset?.ebene;
    if (!id) return;
    ebeneOn[id] = e.target.checked; applyHaus();
  });
  $("wh-schnitt")?.addEventListener("change", (e) => {
    schnittOn = e.target.checked; $("wh-schnitt-pos").disabled = !schnittOn; updateClip(); applyHaus();
    if (schnittOn) { autoSpin = false; yaw = -Math.PI / 2 + 0.55; pitch = 0.35; } // von vorn auf die Schnittfläche schauen
  });
  $("wh-schnitt-pos")?.addEventListener("input", updateClip);
  $("wh-oben")?.addEventListener("click", () => { autoSpin = false; pitch = 1.45; yaw = -Math.PI / 2; focusEtage(); });
  $("wh-3d")?.addEventListener("click", () => { autoSpin = false; pitch = 0.42; yaw = 0.7; focusEtage(); });
  $("wh-plan")?.addEventListener("click", () => { if ($("werkstatt-plan").classList.contains("hidden")) zeigeGrundriss(); else { $("werkstatt-plan").classList.add("hidden"); $("wh-plan").classList.remove("on"); } });
  $("wp-x")?.addEventListener("click", () => { $("werkstatt-plan").classList.add("hidden"); $("wh-plan").classList.remove("on"); });
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
