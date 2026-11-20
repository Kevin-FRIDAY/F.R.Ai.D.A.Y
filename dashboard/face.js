// F.R.Ai.D.A.Y – realistischer 3D-Kopf als Neon-Hologramm (Three.js + 3D-Kopfmodell).
// v1.80: geschlossene, beleuchtete Oberfläche (Hologramm-Shader mit Randlicht, Scanlinien,
// Abtast-Strahl), feines Netz darüber, leuchtende Augen mit Blinzeln, schwebende Partikel –
// und ein echter Mund: Lippen und Kiefer öffnen sich synchron zur Stimme (ElevenLabs: echte
// Lautstärke, Gerätestimme: Silben-Rhythmus anhand der gesprochenen Wörter).
// Fällt auf den gezeichneten Canvas-Kopf (face2d.js) zurück, falls WebGL/Modell nicht geht.
(() => {
  "use strict";
  const host = document.getElementById("face-host");
  if (!host) return;

  function fallback2d() {
    if (window.__ff2dLoaded) return;
    window.__ff2dLoaded = true;
    try { host.innerHTML = ""; } catch {}
    const s = document.createElement("script");
    s.src = "face2d.js";
    document.body.appendChild(s);
  }

  const hasWebGL = (() => {
    try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); }
    catch { return false; }
  })();
  if (!window.THREE || !window.THREE.GLTFLoader || !hasWebGL) { fallback2d(); return; }

  const THREE = window.THREE;
  // Leistungsmodus (leistung.js): auf dem Handy 30 Bilder/s, ohne Kantenglättung, weniger Partikel
  const LEISTUNG = window.FridayLeistung || { fps: 60, maxDpr: 2, partikel: 1, verdeckt: false };

  // Kopf-Stil: "holo" (Standard), "detail" (Detail-Hologramm), "partikel" (Lichtpunkt-Wolke), "kern" (abstrakter KI-Kern)
  // v1.100: "neuronen" = dunkel-türkiser Glanz-Kopf mit Sternen-Funkeln, leuchtendem Neuronen-Netz
  // im Kopf, das oben in Partikel ausfranst, vor einem Sternenhimmel (nach Kevins Vorlagebild).
  const STILE = ["neuronen", "holo", "detail", "partikel", "kern", "kristall", "facetten", "visier", "linien"];
  const MODUS = { holo: 0, detail: 1, partikel: 0, kern: 0, kristall: 2, facetten: 3, visier: 4, linien: 5, neuronen: 6 };
  const FLACH = ["kristall", "facetten"]; // Stile mit sichtbaren Dreiecks-Facetten
  const STANDARD_STIL = "neuronen";
  // Einmalig auf den neuen Kopf umstellen (Kevin hatte bisher "Kristall" gewählt). Danach gilt
  // wieder seine eigene Wahl. Merker erst "0", dann "1": so wird er mit dem Mac abgeglichen
  // (einstellungen-sync speichert nur Änderungen) und andere Geräte stellen nicht erneut um.
  try {
    if (!localStorage.getItem("friday_kopf_neuronen")) {
      localStorage.setItem("friday_kopf_neuronen", "0");
      localStorage.setItem("friday_kopf_neuronen", "1");
      if (localStorage.getItem("friday_kopfstil")) localStorage.setItem("friday_kopfstil", "neuronen");
    }
  } catch {}
  const STIL = (() => {
    try {
      const q = new URLSearchParams(location.search).get("kopf");
      const v = q || localStorage.getItem("friday_kopfstil") || STANDARD_STIL;
      return STILE.includes(v) ? v : STANDARD_STIL;
    } catch { return STANDARD_STIL; }
  })();
  const BASE_RY = STIL === "linien" ? -0.62 : STIL === "neuronen" ? -0.06 : -0.18; // Neon-Linien: Halbprofil, Neuronen: von vorne

  // Akzentfarbe aus dem Theme (Neon-Orange)
  function themeColor() {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--cyan").trim();
      let m = v.match(/#([0-9a-f]{6})/i);
      if (m) return new THREE.Color(parseInt(m[1], 16));
      m = v.match(/rgba?\(([^)]+)\)/i);
      if (m) { const p = m[1].split(",").map(Number); return new THREE.Color(p[0] / 255, p[1] / 255, p[2] / 255); }
    } catch {}
    return new THREE.Color(0xff8a1e);
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: LEISTUNG.kantenglaettung !== false, alpha: true });
  } catch { fallback2d(); return; }
  renderer.setClearColor(0x000000, 0);
  host.innerHTML = "";
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  host.appendChild(renderer.domElement);

  function resize() {
    const r = host.getBoundingClientRect();
    const w = Math.max(60, r.width), h = Math.max(60, r.height);
    renderer.setPixelRatio(Math.min(LEISTUNG.maxDpr, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (neuro) neuro.uni.uPx.value = pxScale();
  }
  // Punktgröße passend zur Bildschirmauflösung (Sterne/Synapsen sehen überall gleich aus)
  function pxScale() {
    const r = host.getBoundingClientRect();
    return renderer.getPixelRatio() * Math.max(60, r.height) / 700;
  }

  const group = new THREE.Group();
  scene.add(group);
  const rings = new THREE.Group();
  let ringMats = [];
  const col = themeColor();

  // ---- Maße im Kopfmodell (zentrierte Modell-Einheiten, Kopf ca. 8 hoch) ----
  const MOUTH = { y: 0.06, z: 2.2, halfW: 0.62 };      // Mundspalte (zwischen den Lippen)
  const EYES = [[-0.56, 1.72, 1.98], [0.56, 1.72, 1.98]];
  // Neuronen-Stil: schmale, glimmende Lidspalte wie im Vorlagebild
  const EYE_W = STIL === "neuronen" ? 0.42 : 0.34, EYE_H = STIL === "neuronen" ? 0.11 : 0.2;

  // ---- Hologramm-Shader ----
  const uniforms = {
    uColor: { value: col.clone() },
    uTime: { value: 0 },
    uOpen: { value: 0 },
    uDetail: { value: STIL === "detail" ? 1 : 0 },
    uMode: { value: 0 },
    uTalk: { value: 0 },
    uMouth: { value: new THREE.Vector3(0, MOUTH.y, MOUTH.halfW) },
  };
  const vert = `
    attribute vec3 rest; attribute vec3 bary;
    varying vec3 vN; varying vec3 vV; varying vec3 vRest; varying float vY; varying vec3 vBary;
    void main() {
      vRest = rest; vBary = bary;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vV = -mv.xyz;
      vN = normalize(normalMatrix * normal);
      vY = position.y;
      gl_Position = projectionMatrix * mv;
    }`;
  const frag = `
    uniform vec3 uColor; uniform float uTime; uniform float uOpen; uniform float uTalk; uniform float uDetail; uniform float uMode; uniform vec3 uMouth;
    varying vec3 vN; varying vec3 vV; varying vec3 vRest; varying float vY; varying vec3 vBary;
    void main() {
      vec3 n = normalize(vN); vec3 v = normalize(vV);
      if (!gl_FrontFacing) n = -n;
      float fres = pow(1.0 - clamp(abs(dot(n, v)), 0.0, 1.0), 2.4);
      // Schlüssellicht oben links vorne + weiches Fülllicht
      float key = max(dot(n, normalize(vec3(-0.45, 0.55, 0.75))), 0.0);
      float fill = max(dot(n, normalize(vec3(0.6, -0.1, 0.8))), 0.0);
      float spec = pow(max(dot(reflect(-normalize(vec3(-0.45, 0.55, 0.75)), n), v), 0.0), 18.0);
      vec3 c = uColor * (0.035 + 0.6 * key * key + 0.16 * fill + 1.1 * fres) + vec3(1.0, 0.85, 0.65) * spec * 0.22;
      // feine Scanlinien + wandernder Abtast-Strahl
      float scan = 0.88 + 0.12 * sin(vY * 70.0 - uTime * 3.0);
      float band = smoothstep(0.35, 0.0, abs(fract(uTime * 0.12) * 11.0 - 5.5 - vY)) * 0.55;
      c = c * scan + uColor * band * (0.25 + fres);
      // Detail-Hologramm: Höhenlinien wie ein 3D-Scan, feine Querlinien, Hautstruktur, mehr Glanz
      if (uDetail > 0.5) {
        float topo = abs(fract(vRest.z * 7.0) - 0.5);
        float tl = smoothstep(0.07, 0.0, topo) * smoothstep(0.3, 1.5, vRest.z);
        float hl = smoothstep(0.035, 0.0, abs(fract(vRest.y * 6.0) - 0.5));
        c = c * 0.82 + uColor * (tl * 0.75 + hl * 0.2) * (0.45 + key);
        c *= 0.94 + 0.06 * sin(vRest.x * 55.0 + vRest.z * 20.0) * sin(vRest.y * 55.0);
      }
      float alpha = 1.0;
      float edge = smoothstep(0.022, 0.0, min(vBary.x, min(vBary.y, vBary.z)));
      if (uMode > 1.5 && uMode < 2.5) {
        // Kristall: durchscheinendes Glas, funkelnde Facetten, helle Kanten
        float tw = 0.5 + 0.5 * sin(dot(n, vec3(31.0, 17.0, 23.0)) * 3.0 + uTime * 2.5);
        float glint = pow(max(dot(reflect(-normalize(vec3(-0.45, 0.55, 0.75)), n), v), 0.0), 60.0);
        c = uColor * (0.03 + 0.3 * key * key + 1.5 * fres) + mix(uColor, vec3(1.0, 0.92, 0.8), 0.5) * glint * (0.25 + 0.5 * tw) + uColor * edge * 0.35 * (0.4 + key);
        alpha = clamp(0.25 + fres * 0.9 + glint * 0.5 + edge * 0.3, 0.0, 1.0);
      } else if (uMode > 2.5 && uMode < 3.5) {
        // Facetten: dunkle Panzer-Flächen mit leuchtenden Kanten
        c = uColor * (0.03 + 0.42 * key * key + 0.1 * fill) + vec3(1.0, 0.85, 0.65) * spec * 0.12;
        c = c * 1.25 + uColor * edge * (0.45 + 0.25 * key) * (0.85 + 0.15 * sin(uTime * 2.0 + vRest.y * 3.0));
      } else if (uMode > 3.5 && uMode < 4.5) {
        // Visier: leuchtendes Glasband über den Augen + Panel-Fugen
        float fz = smoothstep(1.2, 1.7, vRest.z);
        float vis = smoothstep(1.32, 1.42, vRest.y) * (1.0 - smoothstep(2.02, 2.12, vRest.y)) * (1.0 - smoothstep(1.35, 1.5, abs(vRest.x))) * fz;
        float vscan = 0.75 + 0.25 * sin(vRest.y * 140.0 - uTime * 6.0);
        c = mix(c * 0.75, uColor * (1.3 + 0.6 * fres) * vscan + vec3(1.0, 0.9, 0.7) * spec * 0.5, vis);
        float groove = smoothstep(0.03, 0.0, abs(abs(vRest.x) - 1.05)) * step(2.1, vRest.y)
          + smoothstep(0.03, 0.0, abs(vRest.y - 2.75)) + smoothstep(0.025, 0.0, abs(vRest.x)) * step(2.75, vRest.y)
          + smoothstep(0.03, 0.0, abs(vRest.y - 1.3)) * (1.0 - fz) * step(0.0, vRest.z);
        c = mix(c, uColor * 0.03, clamp(groove, 0.0, 1.0) * 0.8) + uColor * clamp(groove, 0.0, 1.0) * 0.25 * key;
      } else if (uMode > 5.5) {
        // Neuronen: dunkel-türkise, glänzende Haut mit Sternen-Funkeln, orange Randlicht.
        // Oben am Schädel wird sie durchsichtig, damit das Neuronen-Netz durchleuchtet.
        vec3 teal = vec3(0.018, 0.1, 0.12);
        vec3 L = normalize(vec3(-0.35, 0.6, 0.75));
        float k2 = max(dot(n, L), 0.0);
        float gl = pow(max(dot(reflect(-L, n), v), 0.0), 26.0);
        float gl2 = pow(max(dot(reflect(-normalize(vec3(0.5, 0.1, 0.85)), n), v), 0.0), 40.0);
        c = teal * (0.18 + 1.25 * k2 * k2 + 0.3 * fill) + vec3(0.5, 0.85, 0.92) * (gl * 0.42 + gl2 * 0.06) + uColor * fres * fres * 1.1;
        // Sternen-Funkeln in der Haut
        vec3 q = vRest * 20.0; vec3 cell = floor(q);
        float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        vec3 off = vec3(fract(h * 17.3), fract(h * 31.7), fract(h * 53.1)) * 0.6 + 0.2;
        float d = length(fract(q) - off);
        float tw = 0.55 + 0.45 * sin(uTime * (1.5 + h * 3.0) + h * 40.0);
        float star = step(0.84, h) * smoothstep(0.2 * (0.5 + fract(h * 91.0)), 0.0, d) * tw;
        c += mix(vec3(0.85, 0.95, 1.0), uColor, step(0.95, h)) * star * 1.3;
        // Lippen und Lidspalten glimmen orange
        float lip = (1.0 - smoothstep(0.0, 0.32, abs(vRest.y - uMouth.y))) * (1.0 - smoothstep(0.4, 0.75, abs(vRest.x))) * smoothstep(1.85, 2.1, vRest.z);
        c += uColor * lip * 0.22 * (0.6 + k2);
        float skull = smoothstep(1.9, 2.9, vRest.y) + smoothstep(0.2, -0.9, vRest.z) * smoothstep(0.5, 1.5, vRest.y);
        alpha = clamp(0.84 - 0.6 * clamp(skull, 0.0, 1.0) + fres * 0.3 + star * 0.4, 0.0, 1.0);
        // Hals und Schultern lösen sich nach unten ins Dunkel auf
        float hals = smoothstep(-3.1, -1.2, vRest.y);
        c *= hals; alpha *= hals;
      } else if (uMode > 4.5) {
        // Neon-Linien: nur leuchtende Schnittlinien, Rest bleibt durchsichtig
        float sl = smoothstep(0.09, 0.0, abs(fract(vRest.y * 7.0 - uTime * 0.15) - 0.5) - 0.0);
        float lit = sl * (0.5 + key) + fres * 0.55;
        if (lit < 0.06) discard;
        c = uColor * lit * 1.4;
        alpha = clamp(lit * 1.2, 0.0, 1.0);
      }
      // Innerer Mund: dunkel, wenn die Lippen offen sind
      float mx = vRest.x / uMouth.z;
      float my = (vRest.y - uMouth.y) / 0.13;
      float e = mx * mx + my * my;
      float front = smoothstep(1.7, 2.05, vRest.z);
      float m = (1.0 - smoothstep(0.55, 1.0, e)) * front * smoothstep(0.02, 0.18, uOpen);
      vec3 inner = uColor * 0.05 + uColor * 0.25 * smoothstep(0.3, 0.9, e);
      c = mix(c, inner, m * 0.92);
      alpha = max(alpha, m * 0.92);
      // Sprechen: Hologramm leuchtet etwas stärker
      c *= 1.0 + uTalk * 0.25;
      gl_FragColor = vec4(c, alpha);
    }`;

  let solidMat = null, wireMat = null, ready = false;
  let headGeo = null, basePos = null, lastOpen = -1, lastWide = -9;
  const eyeSprites = [];
  let particles = null, partMat = null;
  const irisRings = [];
  let wolke = null, kern = null, neuro = null;

  // ---- Stil "partikel": Kopf aus zehntausenden Lichtpunkten ----
  function baueWolke(geo, inner) {
    const idx = geo.index ? geo.index.array : null;
    const pos = geo.attributes.position.array;
    const triCount = idx ? idx.length / 3 : pos.length / 9;
    const v = (t, k) => (idx ? idx[t * 3 + k] : t * 3 + k);
    const areas = new Float32Array(triCount); let total = 0;
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    for (let t = 0; t < triCount; t++) {
      A.fromArray(pos, v(t, 0) * 3); B.fromArray(pos, v(t, 1) * 3); C.fromArray(pos, v(t, 2) * 3);
      const a = B.sub(A).cross(C.sub(A)).length() / 2; areas[t] = a; total += a;
    }
    const N = 80000, refs = new Uint32Array(N * 3), bary = new Float32Array(N * 3), cols = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      let r = Math.random() * total, t = 0;
      while (t < triCount - 1 && r > areas[t]) { r -= areas[t]; t++; }
      let u = Math.random(), w = Math.random(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
      refs[i * 3] = v(t, 0); refs[i * 3 + 1] = v(t, 1); refs[i * 3 + 2] = v(t, 2);
      bary[i * 3] = 1 - u - w; bary[i * 3 + 1] = u; bary[i * 3 + 2] = w;
      // Helligkeit aus Licht + Randlicht, damit Gesichtszüge sichtbar bleiben
      const nr = geo.attributes.normal.array;
      let nx = 0, ny = 0, nz = 0;
      for (let k = 0; k < 3; k++) { const q = v(t, k) * 3, f = bary[i * 3 + k]; nx += nr[q] * f; ny += nr[q + 1] * f; nz += nr[q + 2] * f; }
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const lit = Math.max(0, -0.45 * nx + 0.55 * ny + 0.7 * nz);
      const rim = Math.pow(1 - Math.abs(nz), 2.5);
      const b = (0.12 + 1.1 * lit * lit + 0.7 * rim) * (0.7 + Math.random() * 0.5) * (Math.random() < 0.05 ? 1.8 : 1); cols[i * 3] = b; cols[i * 3 + 1] = b; cols[i * 3 + 2] = b;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    pg.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    const pm = new THREE.PointsMaterial({ color: col.clone(), size: 0.026, vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(pg, pm);
    pts.scale.setScalar(1 / 1); // gleiche Einheiten wie der Kopf
    inner.add(pts);
    wolke = { pg, refs, bary, mat: pm, N };
    updateWolke();
  }
  function updateWolke() {
    if (!wolke || !headGeo) return;
    const src = headGeo.attributes.position.array, out = wolke.pg.attributes.position.array;
    const { refs, bary, N } = wolke;
    for (let i = 0; i < N; i++) {
      const a = refs[i * 3] * 3, b = refs[i * 3 + 1] * 3, c = refs[i * 3 + 2] * 3;
      const u = bary[i * 3], v = bary[i * 3 + 1], w = bary[i * 3 + 2];
      out[i * 3] = src[a] * u + src[b] * v + src[c] * w;
      out[i * 3 + 1] = src[a + 1] * u + src[b + 1] * v + src[c + 1] * w;
      out[i * 3 + 2] = src[a + 2] * u + src[b + 2] * v + src[c + 2] * w;
    }
    wolke.pg.attributes.position.needsUpdate = true;
  }


  // ---- Stil "neuronen": leuchtendes Netz im Kopf, Ausfransen, Sternenhimmel ----
  function baueNeuronen(geo, inner) {
    const F = LEISTUNG.partikel || 1;
    const idx = geo.index ? geo.index.array : null;
    const pos = geo.attributes.position.array, nor = geo.attributes.normal.array;
    const triCount = idx ? idx.length / 3 : pos.length / 9;
    const vi = (t, k) => (idx ? idx[t * 3 + k] : t * 3 + k);
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    // Nur Dreiecke am Schädel (oberhalb der Augenbrauen + Hinterkopf) als Quelle
    const tris = [], areas = []; let total = 0;
    for (let t = 0; t < triCount; t++) {
      A.fromArray(pos, vi(t, 0) * 3); B.fromArray(pos, vi(t, 1) * 3); C.fromArray(pos, vi(t, 2) * 3);
      const cy = (A.y + B.y + C.y) / 3, cz = (A.z + B.z + C.z) / 3;
      if (cy < 1.05 || (cy < 2.0 && cz > 1.2)) continue;
      const a = B.clone().sub(A).cross(C.clone().sub(A)).length() / 2;
      tris.push(t); areas.push(a); total += a;
    }
    if (!tris.length) return;
    const pick = (out, nOut) => {
      let r = Math.random() * total, i = 0;
      while (i < tris.length - 1 && r > areas[i]) { r -= areas[i]; i++; }
      const t = tris[i];
      let u = Math.random(), w = Math.random(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
      const b0 = 1 - u - w;
      for (let k = 0; k < 3; k++) {
        const a0 = vi(t, 0) * 3 + k, a1 = vi(t, 1) * 3 + k, a2 = vi(t, 2) * 3 + k;
        out[k] = pos[a0] * b0 + pos[a1] * u + pos[a2] * w;
        if (nOut) nOut[k] = nor[a0] * b0 + nor[a1] * u + nor[a2] * w;
      }
    };
    const mitte = new THREE.Vector3(0, Math.max(1.6, (bb.max.y + 1.2) / 2), (bb.min.z + bb.max.z) / 2 - 0.2);
    const uni = { uColor: { value: col.clone() }, uTime: { value: 0 }, uTalk: { value: 0 }, uPx: { value: pxScale() } };
    const p = [0, 0, 0], nn = [0, 0, 0];

    // Knoten: Schädel-Oberfläche Richtung Mitte geschoben (Netz liegt IM Kopf)
    const NK = Math.round(1300 * F);
    const kn = new Float32Array(NK * 3), kGr = new Float32Array(NK), kPh = new Float32Array(NK);
    for (let i = 0; i < NK; i++) {
      pick(p);
      const f = Math.random() < 0.55 ? 0.86 + Math.random() * 0.12 : 0.45 + Math.random() * 0.42;
      kn[i * 3] = mitte.x + (p[0] - mitte.x) * f;
      kn[i * 3 + 1] = mitte.y + (p[1] - mitte.y) * f;
      kn[i * 3 + 2] = mitte.z + (p[2] - mitte.z) * f;
      const hub = Math.random() < 0.06;
      kGr[i] = hub ? 3 + Math.random() * 4 : 0.6 + Math.random() * 1.2;
      kPh[i] = Math.random() * 6.283;
    }
    // Verbindungen: jeder Knoten zu seinen 3 nächsten Nachbarn (Nervenbahnen)
    const lin = [], lT = [], lPh = [];
    const maxD2 = 0.75 * 0.75;
    for (let i = 0; i < NK; i++) {
      const best = [[1e9, -1], [1e9, -1], [1e9, -1]];
      const x = kn[i * 3], y = kn[i * 3 + 1], z = kn[i * 3 + 2];
      for (let j = 0; j < NK; j++) {
        if (j === i) continue;
        const dx = kn[j * 3] - x, dy = kn[j * 3 + 1] - y, dz = kn[j * 3 + 2] - z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < best[2][0] && d2 < maxD2) { best[2] = [d2, j]; best.sort((a, b) => a[0] - b[0]); }
      }
      const ph = Math.random();
      for (const [, j] of best) {
        if (j < 0 || j < i && Math.random() < 0.5) continue;
        lin.push(x, y, z, kn[j * 3], kn[j * 3 + 1], kn[j * 3 + 2]);
        lT.push(0, 1); lPh.push(ph + Math.random() * 0.3, 0); lPh[lPh.length - 1] = lPh[lPh.length - 2];
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lin), 3));
    lg.setAttribute("aT", new THREE.BufferAttribute(new Float32Array(lT), 1));
    lg.setAttribute("aPh", new THREE.BufferAttribute(new Float32Array(lPh), 1));
    const lm = new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: `attribute float aT; attribute float aPh; varying float vT; varying float vPh; void main(){ vT = aT; vPh = aPh; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      // Impulse wandern die Bahnen entlang, beim Sprechen schneller und heller
      fragmentShader: `uniform vec3 uColor; uniform float uTime; uniform float uTalk; varying float vT; varying float vPh;
        void main(){ float s = fract(uTime * (0.22 + uTalk * 0.35) + vPh * 7.0); float imp = smoothstep(0.14, 0.0, abs(s - vT));
          float b = 0.45 + imp * (1.1 + uTalk) + uTalk * 0.15;
          gl_FragColor = vec4(mix(uColor * vec3(1.0, 0.62, 0.4), vec3(1.0, 0.8, 0.45), imp * 0.7) * max(1.0, b), clamp(b, 0.0, 1.0)); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    const lines = new THREE.LineSegments(lg, lm); lines.renderOrder = 0;
    inner.add(lines);

    // Leuchtende Knoten (Synapsen), große Knoten flackern
    const kg = new THREE.BufferGeometry();
    kg.setAttribute("position", new THREE.BufferAttribute(kn, 3));
    kg.setAttribute("aGr", new THREE.BufferAttribute(kGr, 1));
    kg.setAttribute("aPh", new THREE.BufferAttribute(kPh, 1));
    const punktFrag = `uniform vec3 uColor; varying float vB; varying vec3 vC;
      void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); float a = smoothstep(0.5, 0.0, d); a = a * a;
        gl_FragColor = vec4(vC, clamp(a * vB, 0.0, 1.0)); }`;
    const km = new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: `attribute float aGr; attribute float aPh; uniform float uTime; uniform float uTalk; uniform float uPx; uniform vec3 uColor; varying float vB; varying vec3 vC;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float fl = 0.65 + 0.35 * sin(uTime * (1.2 + aPh * 0.5) + aPh * 9.0);
          vB = (0.55 + 0.45 * fl) * (1.0 + uTalk * 0.7);
          vC = mix(uColor * vec3(1.0, 0.7, 0.45), vec3(1.0, 0.78, 0.5), smoothstep(3.0, 6.5, aGr) * 0.45);
          gl_PointSize = aGr * (16.0 + uTalk * 7.0) * uPx / -mv.z;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: punktFrag,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    const knoten = new THREE.Points(kg, km); knoten.renderOrder = 0;
    inner.add(knoten);

    // Ausfransen: Lichtfasern lösen sich oben und an den Seiten vom Schädel und treiben weg
    const NF = Math.round(2600 * F);
    const fs = new Float32Array(NF * 3), fd = new Float32Array(NF * 3), fp = new Float32Array(NF);
    let n = 0, tries = 0;
    while (n < NF && tries++ < NF * 20) {
      pick(p, nn);
      if (p[1] < 1.9 && Math.abs(p[0]) < 1.1) continue; // nicht vor der Stirn/dem Gesicht
      const l = Math.hypot(nn[0], nn[1], nn[2]) || 1;
      let dx = nn[0] / l * 1.3, dy = nn[1] / l + 0.6, dz = nn[2] / l * 0.4 - 0.15;
      const dl = Math.hypot(dx, dy, dz) || 1;
      const len = 1.2 + Math.random() * Math.random() * 3.5;
      fs.set(p, n * 3);
      fd[n * 3] = dx / dl * len; fd[n * 3 + 1] = dy / dl * len; fd[n * 3 + 2] = dz / dl * len;
      fp[n] = Math.random(); n++;
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.BufferAttribute(fs.subarray(0, n * 3), 3));
    fg.setAttribute("aDir", new THREE.BufferAttribute(fd.subarray(0, n * 3), 3));
    fg.setAttribute("aPh", new THREE.BufferAttribute(fp.subarray(0, n), 1));
    const fm = new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: `attribute vec3 aDir; attribute float aPh; uniform float uTime; uniform float uTalk; uniform float uPx; uniform vec3 uColor; varying float vB; varying vec3 vC;
        void main(){ float life = fract(uTime * 0.07 * (0.6 + aPh) + aPh * 13.0);
          vec3 pp = position + aDir * life + vec3(sin(uTime * 0.7 + aPh * 20.0), 0.0, cos(uTime * 0.5 + aPh * 30.0)) * 0.08 * life;
          vec4 mv = modelViewMatrix * vec4(pp, 1.0);
          vB = smoothstep(0.0, 0.08, life) * (1.0 - life) * (1.5 + uTalk * 0.6);
          vC = mix(uColor, vec3(1.0, 0.8, 0.5), step(0.92, aPh));
          gl_PointSize = (9.0 + 12.0 * step(0.88, fract(aPh * 7.0))) * uPx / -mv.z;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: punktFrag,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    const fransen = new THREE.Points(fg, fm); fransen.renderOrder = 2;
    inner.add(fransen);

    // Sternenhimmel hinter dem Kopf: weiße Sterne + orange Glutpunkte, funkeln leise
    const NS = Math.round(1100 * F);
    const sp = new Float32Array(NS * 3), sg = new Float32Array(NS), sph = new Float32Array(NS);
    for (let i = 0; i < NS; i++) {
      sp[i * 3] = (Math.random() - 0.5) * 9; sp[i * 3 + 1] = (Math.random() - 0.5) * 6.5; sp[i * 3 + 2] = -2.5 - Math.random() * 3;
      sg[i] = Math.random() < 0.13 ? -(1.2 + Math.random() * 2.2) : 0.6 + Math.random() * Math.random() * 2.4; // negativ = orange
      sph[i] = Math.random() * 6.283;
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    sgeo.setAttribute("aGr", new THREE.BufferAttribute(sg, 1));
    sgeo.setAttribute("aPh", new THREE.BufferAttribute(sph, 1));
    const sm = new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: `attribute float aGr; attribute float aPh; uniform float uTime; uniform float uPx; uniform vec3 uColor; varying float vB; varying vec3 vC;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vec4 cp = projectionMatrix * mv;
          vec2 ndc = cp.xy / cp.w; float rand = 1.0 - smoothstep(0.7, 1.0, max(abs(ndc.x), abs(ndc.y)));
          float g = abs(aGr); vB = (0.55 + 0.45 * sin(uTime * (0.8 + fract(aPh) * 2.0) + aPh * 5.0)) * rand * (aGr < 0.0 ? 0.9 : 0.75);
          vC = aGr < 0.0 ? uColor : vec3(0.92, 0.95, 1.0);
          gl_PointSize = g * 22.0 * uPx / -mv.z; gl_Position = cp; }`,
      fragmentShader: punktFrag,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sterne = new THREE.Points(sgeo, sm); sterne.renderOrder = -2;
    scene.add(sterne);

    // Weicher Glutschein hinter dem Schädel
    const schein = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: col.clone(), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    schein.position.set(0, mitte.y + 0.6, mitte.z - 1.2); schein.scale.set(8.5, 6.5, 1); schein.renderOrder = -1;
    inner.add(schein);

    neuro = { uni, lines, knoten, fransen, sterne, schein };
  }

  // ---- Stil "detail": leuchtende Aura-Hülle um den Kopf ----
  function baueDetail(geo, inner) {
    const aura = new THREE.ShaderMaterial({
      uniforms: { uColor: uniforms.uColor, uTalk: uniforms.uTalk },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position + normal * 0.06, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uTalk; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0); gl_FragColor = vec4(uColor * f * (0.9 + uTalk), f); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
    });
    inner.add(new THREE.Mesh(geo, aura));
  }

  // ---- Stil "kern": abstrakter KI-Kern (ohne Gesicht), pulsiert beim Sprechen ----
  function baueKern() {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 3), new THREE.MeshBasicMaterial({ color: col.clone(), wireframe: true, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    const innerS = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), new THREE.MeshBasicMaterial({ color: col.clone(), wireframe: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: col.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(2.2, 2.2, 1);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
    core.scale.set(0.7, 0.7, 1);
    g.add(glow, shell, innerS, core);
    // Kreis-Equalizer: 72 Balken, die mit der Stimme ausschlagen
    const bars = [];
    const bm = new THREE.MeshBasicMaterial({ color: col.clone(), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const bg = new THREE.PlaneGeometry(0.035, 1); bg.translate(0, 0.5, 0);
    for (let i = 0; i < 72; i++) {
      const b = new THREE.Mesh(bg, bm); const a = (i / 72) * Math.PI * 2;
      b.position.set(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0); b.rotation.z = a - Math.PI / 2; b.scale.y = 0.06;
      g.add(b); bars.push({ m: b, ph: Math.random() * 6.28 });
    }
    group.add(g);
    kern = { g, shell, innerS, glow, core, bars, mats: [shell.material, innerS.material, glow.material, bm] };
  }

  function glowTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,220,170,0.85)");
    grd.addColorStop(0.6, "rgba(255,140,40,0.25)");
    grd.addColorStop(1, "rgba(255,120,20,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // Mund öffnen: Unterlippe + Kinn/Kiefer nach unten (leicht nach hinten), Oberlippe etwas hoch,
  // Mundwinkel enger ("o") oder breiter ("i") je nach Klang.
  function deformMouth(open, wide) {
    if (!headGeo || !basePos) return;
    const pos = headGeo.attributes.position.array;
    const D = 0.3 * open;
    for (let i = 0; i < pos.length; i += 3) {
      const bx = basePos[i], by = basePos[i + 1], bz = basePos[i + 2];
      let x = bx, y = by, z = bz;
      if (open > 0.001 && by < 1.0 && by > -2.2 && bz > 0.6) {
        const ax = Math.abs(bx);
        const front = sstep(0.6, 1.6, bz);
        const lipLat = 1 - sstep(MOUTH.halfW * 0.55, MOUTH.halfW * 1.35, ax);
        const jawLat = 1 - sstep(1.0, 1.9, ax);
        if (by < MOUTH.y) {
          // unterhalb der Mundspalte: Unterlippe, Kinn, Kiefer
          const below = MOUTH.y - by;
          const lat = lipLat + (jawLat - lipLat) * sstep(0.0, 0.45, below);
          const neck = 1 - sstep(1.0, 1.9, below); // unten am Hals ausblenden
          const w = lat * neck * front;
          y -= D * w;
          z -= D * 0.35 * w * sstep(0.2, 0.9, below);
        } else if (by < MOUTH.y + 0.5) {
          // Oberlippe hebt sich leicht
          const above = by - MOUTH.y;
          const w = lipLat * (1 - sstep(0.05, 0.5, above)) * front;
          y += D * 0.28 * w;
        }
        // Mundwinkel: Rundung/Breite
        const lipZone = (1 - sstep(0.1, 0.55, Math.abs(by - MOUTH.y))) * (1 - sstep(MOUTH.halfW * 0.7, MOUTH.halfW * 1.5, ax)) * front;
        x += bx * lipZone * (wide * 0.14 - open * 0.08);
      }
      pos[i] = x; pos[i + 1] = y; pos[i + 2] = z;
    }
    headGeo.attributes.position.needsUpdate = true;
  }

  const loader = new THREE.GLTFLoader();
  if (STIL === "kern") { baueKern(); setTimeout(baueRinge, 0); ready = true; }
  else loader.load("vendor/head.glb", (gltf) => {
    let geo = null;
    gltf.scene.traverse((o) => { if (o.isMesh && o.geometry && !geo) geo = o.geometry; });
    if (!geo) { fallback2d(); return; }
    geo = geo.clone();
    geo.center();
    if (FLACH.includes(STIL)) {
      // Jedes Dreieck eigene Ecken -> flache Facetten + Kanten-Koordinaten
      geo = geo.toNonIndexed();
      const n = geo.attributes.position.count, b = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) b[i * 3 + (i % 3)] = 1;
      geo.setAttribute("bary", new THREE.BufferAttribute(b, 3));
    }
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const s = 2.1 / (geo.boundingSphere.radius || 1);

    headGeo = geo;
    basePos = geo.attributes.position.array.slice();
    geo.setAttribute("rest", new THREE.BufferAttribute(basePos.slice(), 3));

    // Beleuchtete Hologramm-Oberfläche
    try {
      uniforms.uMode.value = MODUS[STIL] || 0;
      const durchsichtig = STIL === "kristall" || STIL === "linien" || STIL === "neuronen";
      solidMat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: durchsichtig, depthWrite: !durchsichtig, side: THREE.FrontSide });
      solidMat.polygonOffset = true; solidMat.polygonOffsetFactor = 1; solidMat.polygonOffsetUnits = 1;
    } catch { solidMat = new THREE.MeshBasicMaterial({ color: 0x140a04 }); }
    if (STIL === "partikel") {
      // Nur Tiefe schreiben: verdeckt die Rückseite, ohne selbst sichtbar zu sein
      solidMat = new THREE.MeshBasicMaterial({ colorWrite: false });
      solidMat.polygonOffset = true; solidMat.polygonOffsetFactor = 2; solidMat.polygonOffsetUnits = 2;
    }
    const solid = new THREE.Mesh(geo, solidMat);

    // Feines Netz darüber (Hologramm-Struktur)
    wireMat = new THREE.MeshBasicMaterial({ color: col.clone(), wireframe: true, transparent: true, opacity: STIL === "detail" ? 0.05 : 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
    const wire = new THREE.Mesh(geo, wireMat);

    const inner = new THREE.Group();
    inner.add(solid);
    if (!["partikel", "kristall", "facetten", "linien", "neuronen"].includes(STIL)) inner.add(wire);
    if (STIL === "kristall" || STIL === "linien" || STIL === "neuronen") {
      // Tiefen-Vorlauf: nur die vorderste Oberfläche leuchtet, innere Flächen (Mundhöhle) bleiben verborgen
      const tiefe = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      const pre = new THREE.Mesh(geo, tiefe); pre.renderOrder = -1;
      inner.add(pre); solid.renderOrder = 1;
    }
    if (STIL === "partikel") baueWolke(geo, inner);
    if (STIL === "detail") baueDetail(geo, inner);
    if (STIL === "neuronen") baueNeuronen(geo, inner);

    // Leuchtende Augen (blinzeln)
    const tex = glowTexture();
    for (const [x, y, z] of EYES) {
      const m = new THREE.SpriteMaterial({ map: tex, color: col.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0.85 });
      const sp = new THREE.Sprite(m);
      sp.position.set(x, y, z + 0.08);
      sp.scale.set(EYE_W, EYE_H, 1);
      sp.renderOrder = 3;
      inner.add(sp); eyeSprites.push(sp);
      if (STIL === "detail") {
        // Iris-Ringe, die sich langsam drehen
        const rm = new THREE.MeshBasicMaterial({ color: col.clone(), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.1, 24, 1, 0, Math.PI * 1.6), rm);
        ring.position.set(x, y, z + 0.1);
        inner.add(ring); irisRings.push(ring);
      }
    }

    inner.scale.setScalar(s);
    group.add(inner);
    group.rotation.y = BASE_RY;

    // Schwebende Licht-Partikel um den Kopf (Neuronen-Stil hat stattdessen Sterne + Ausfransen)
    if (STIL !== "neuronen") try {
      const N = Math.max(60, Math.round(260 * LEISTUNG.partikel)), p = new Float32Array(N * 3), sp = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2, r = 1.25 + Math.random() * 1.35;
        p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = (Math.random() - 0.5) * 3.6; p[i * 3 + 2] = Math.sin(a) * r * 0.7;
        sp[i] = 0.1 + Math.random() * 0.35;
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute("position", new THREE.BufferAttribute(p, 3));
      pg.userData.speed = sp;
      partMat = new THREE.PointsMaterial({ color: col.clone(), size: 0.035, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
      particles = new THREE.Points(pg, partMat);
      scene.add(particles);
    } catch { /* Partikel optional */ }

    if (STIL !== "neuronen") baueRinge();
    ready = true;
  }, undefined, () => { fallback2d(); });

  function baueRinge() {
    // Futuristische HUD-Orbitringe um den Kopf
    try {
      ringMats = [];
      const mkRing = (rad, tube, rx, ry, rz) => {
        const g = new THREE.TorusGeometry(rad, tube, 8, 90);
        const m = new THREE.MeshBasicMaterial({ color: col.clone(), transparent: true, opacity: 0.32 });
        const r = new THREE.Mesh(g, m); r.rotation.set(rx, ry, rz);
        ringMats.push(m); rings.add(r);
      };
      mkRing(2.35, 0.012, Math.PI / 2.1, 0, 0.3);
      mkRing(2.65, 0.008, Math.PI / 2.6, 0.6, -0.2);
      mkRing(2.9, 0.006, Math.PI / 1.9, -0.4, 0.5);
      scene.add(rings);
    } catch { /* Ringe optional */ }
  }

  resize();
  if (window.ResizeObserver) { try { new ResizeObserver(resize).observe(host); } catch {} }
  window.addEventListener("resize", resize);
  window.addEventListener("friday-leistung", resize);

  // Nicht zeichnen, wenn der Kopf gar nicht zu sehen ist (weggescrollt, Fenster darüber, App im Hintergrund)
  let imBild = true;
  if (window.IntersectionObserver) {
    try { new IntersectionObserver((e) => { imBild = e[e.length - 1].isIntersecting; }).observe(host); } catch {}
  }
  const pausiert = () => document.hidden || !imBild || LEISTUNG.verdeckt;
  setInterval(() => {
    const c = themeColor();
    uniforms.uColor.value.copy(c);
    if (wireMat) wireMat.color.copy(c);
    if (partMat) partMat.color.copy(c);
    eyeSprites.forEach((s) => s.material.color.copy(c));
    ringMats.forEach((m) => m.color.copy(c));
    irisRings.forEach((r) => r.material.color.copy(c));
    if (wolke) wolke.mat.color.copy(c);
    if (kern) kern.mats.forEach((m) => m.color.copy(c));
    if (neuro) { neuro.uni.uColor.value.copy(c); neuro.schein.material.color.copy(c); }
  }, 1500);

  // ---- Einstellungen (localStorage) ----
  const flag = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : v === "1"; } catch { return def; } };
  let optMouth = flag("friday_mouth", true), optHead = flag("friday_headmove", true), optReduce = flag("friday_reduce", false);
  function readOpts() { optMouth = flag("friday_mouth", true); optHead = flag("friday_headmove", true); optReduce = flag("friday_reduce", false); }
  window.addEventListener("friday-settings", readOpts);

  // ---- Sprech-Steuerung ----
  // talkMode: null (still) | "amp" (echte Lautstärke aus dem Audio) | "speech" (Silben-Rhythmus für die Gerätestimme)
  let talkMode = null, open = 0, openTarget = 0, wide = 0, wideTarget = 0, talkGlow = 0;
  let debugOpen = null;
  // Silben-Generator: öffnet/schließt den Mund in natürlichem Takt (ca. 5–6 Silben pro Sekunde),
  // mit Pausen zwischen Sätzen. Wortgrenzen der Gerätestimme setzen den Takt neu.
  const syl = { start: 0, dur: 0, peak: 0, wide: 0, pauseUntil: 0 };
  function nextSyllable(now) {
    syl.start = now;
    syl.dur = 120 + Math.random() * 110;
    syl.peak = Math.random() < 0.12 ? 0.15 : 0.4 + Math.random() * 0.6;
    syl.wide = Math.random() * 1.6 - 0.6;
  }
  function speechTarget(now) {
    if (now < syl.pauseUntil) { wideTarget = 0; return 0; }
    if (now - syl.start > syl.dur) nextSyllable(now);
    const ph = (now - syl.start) / syl.dur;
    wideTarget = syl.wide;
    return syl.peak * Math.sin(Math.PI * Math.min(1, ph));
  }

  // Spricht, hört oder denkt Friday gerade? Dann zeichnet der Kopf mit voller Bildrate.
  const reaktor = document.getElementById("reactor");
  const kopfAktiv = () => Boolean(talkMode) || open > 0.01 || (reaktor ? /\b(listening|speaking|thinking)\b/.test(reaktor.className) : false);

  // Blinzeln
  let nextBlink = performance.now() + 2500, blinkStart = -1;

  function animate(now) {
    if (pausiert()) {
      // im Ruhezustand nur 3× pro Sekunde nachsehen, ob der Kopf wieder sichtbar ist
      animate.last = 0;
      setTimeout(() => requestAnimationFrame(animate), 300);
      return;
    }
    // Bilder-Bremse: im flüssigen Modus 30 statt 60 Bilder pro Sekunde
    // v1.118.0: im Ruhezustand 30, im Hintergrund 12 Bilder/s – beim Sprechen/Zuhören volle Rate
    const minAbstand = 1000 / (LEISTUNG.kopfFps ? LEISTUNG.kopfFps(kopfAktiv()) : LEISTUNG.fps) - 3;
    if (animate.last && now - animate.last < minAbstand) { requestAnimationFrame(animate); return; }
    const dt = Math.min(60, now - (animate.last || now)); animate.last = now;
    const t = now / 1000;
    uniforms.uTime.value = t;
    if (ready) {
      if (optHead && !optReduce) {
        group.rotation.y = BASE_RY + Math.sin(t * 0.4) * 0.11 + Math.sin(t * 0.15) * 0.04;
        group.rotation.x = Math.sin(t * 0.3) * 0.05 - 0.02 + open * 0.035;
        group.position.y = Math.sin(t * 0.6) * 0.03;
      } else { group.rotation.y = BASE_RY; group.rotation.x = -0.02; group.position.y = 0; }

      if (talkMode === "speech") openTarget = speechTarget(now);
      else if (talkMode !== "amp") { openTarget = 0; wideTarget = 0; }
      if (debugOpen !== null) { openTarget = debugOpen; }
      // schnell auf, etwas langsamer zu – wirkt wie echte Lippen
      const k = openTarget > open ? Math.min(1, dt / 35) : Math.min(1, dt / 70);
      open += (openTarget - open) * k;
      wide += (wideTarget - wide) * Math.min(1, dt / 90);
      talkGlow += ((talkMode ? 1 : 0) - talkGlow) * Math.min(1, dt / 300);

      const mouthOpen = optMouth ? open : 0;
      uniforms.uOpen.value = mouthOpen;
      uniforms.uTalk.value = talkGlow * (0.4 + open * 0.6);
      if (Math.abs(mouthOpen - lastOpen) > 0.006 || Math.abs(wide - lastWide) > 0.02) {
        deformMouth(mouthOpen, optMouth ? wide : 0); lastOpen = mouthOpen; lastWide = wide;
        if (wolke) updateWolke();
      }
      if (wireMat) wireMat.opacity = 0.08 + talkGlow * 0.06;

      // Augen: sanftes Pulsieren + Blinzeln alle paar Sekunden
      if (now > nextBlink && blinkStart < 0) blinkStart = now;
      let lid = 1;
      if (blinkStart >= 0) {
        const b = (now - blinkStart) / 160;
        lid = b < 1 ? Math.abs(1 - 2 * b) : 1;
        if (b >= 1) { blinkStart = -1; nextBlink = now + 2500 + Math.random() * 4000; }
      }
      const pulse = 0.55 + Math.sin(t * 2.2) * 0.08 + talkGlow * 0.15;
      eyeSprites.forEach((s) => { s.scale.set(EYE_W, EYE_H * Math.max(0.06, lid), 1); s.material.opacity = pulse; });
      irisRings.forEach((r, i) => { r.rotation.z += dt * 0.002 * (i ? -1 : 1); r.scale.y = Math.max(0.06, lid); });
      if (neuro) {
        neuro.uni.uTime.value = optReduce ? 0 : t;
        neuro.uni.uTalk.value = talkGlow * (0.5 + open * 0.8);
      }
      if (wolke) wolke.mat.size = 0.026 * (0.95 + Math.sin(t * 3) * 0.05 + talkGlow * 0.15);
      if (kern) {
        kern.shell.rotation.y += dt * 0.0004; kern.shell.rotation.x += dt * 0.00015;
        kern.innerS.rotation.y -= dt * 0.0009; kern.innerS.rotation.z += dt * 0.0003;
        const puls = 1 + open * 0.18 + Math.sin(t * 1.6) * 0.02;
        kern.innerS.scale.setScalar(puls); kern.core.scale.setScalar(0.7 + open * 0.6);
        kern.glow.material.opacity = 0.55 + open * 0.45;
        kern.bars.forEach((b, i) => {
          const wave = 0.5 + 0.5 * Math.sin(t * 9 + b.ph + i * 0.35);
          b.m.scale.y = 0.06 + (talkMode ? open * (0.25 + wave * 0.55) : 0.02 + 0.03 * Math.sin(t * 1.5 + i * 0.2) ** 2);
        });
      }

      // Partikel steigen langsam auf
      if (particles && !optReduce) {
        const p = particles.geometry.attributes.position.array, sp = particles.geometry.userData.speed;
        for (let i = 0; i < sp.length; i++) {
          p[i * 3 + 1] += sp[i] * dt * 0.0006 * (1 + talkGlow);
          if (p[i * 3 + 1] > 1.9) p[i * 3 + 1] = -1.9;
        }
        particles.geometry.attributes.position.needsUpdate = true;
        particles.rotation.y += dt * 0.00008;
      }

      if (rings.children.length) {
        const spd = optHead ? 1 : 0.15;
        rings.children[0].rotation.z += dt * 0.00035 * spd;
        rings.children[1].rotation.y += dt * 0.00045 * spd;
        rings.children[2].rotation.x += dt * 0.0003 * spd;
        const op = 0.3 + talkGlow * 0.15 + open * 0.25;
        ringMats.forEach((m) => { m.opacity = op; });
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // ---- Lautstärke aus dem Audio (ElevenLabs/Server-Stimme) ----
  let audioCtx = null, analyser = null, timeArr = null, freqArr = null, srcNode = null, ampRaf = null;
  function stopAmp() { if (ampRaf) cancelAnimationFrame(ampRaf); ampRaf = null; }
  function amplitude(audioEl) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (!srcNode || srcNode.mediaElement !== audioEl) {
        srcNode = audioCtx.createMediaElementSource(audioEl);
        analyser = audioCtx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.35;
        srcNode.connect(analyser); analyser.connect(audioCtx.destination);
        timeArr = new Uint8Array(analyser.fftSize);
        freqArr = new Uint8Array(analyser.frequencyBinCount);
      }
      audioCtx.resume?.();
      talkMode = "amp";
      const binHz = audioCtx.sampleRate / analyser.fftSize;
      const step = () => {
        analyser.getByteTimeDomainData(timeArr);
        let sum = 0;
        for (let i = 0; i < timeArr.length; i++) { const v = (timeArr[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / timeArr.length);
        openTarget = Math.min(0.85, Math.max(0, (rms - 0.015) * 4.5));
        // Klangfarbe: viel Höhen = breiter Mund ("i/e"), viel Tiefen = runder Mund ("o/u")
        analyser.getByteFrequencyData(freqArr);
        let lo = 0, hi = 0;
        for (let i = 0; i < freqArr.length; i++) {
          const hz = i * binHz;
          if (hz > 150 && hz < 900) lo += freqArr[i]; else if (hz >= 1800 && hz < 5000) hi += freqArr[i];
        }
        wideTarget = lo + hi > 0 ? Math.max(-0.6, Math.min(1, (hi / (lo + hi)) * 3 - 0.6)) : 0;
        ampRaf = requestAnimationFrame(step);
      };
      stopAmp(); step();
      return true;
    } catch { return false; }
  }

  // ---- API ----
  window.FridayFace = {
    stil: STIL, standardStil: STANDARD_STIL,
    // Gerätestimme: Silben-Rhythmus starten/stoppen
    talk(on) { stopAmp(); talkMode = on ? "speech" : null; if (on) nextSyllable(performance.now()); else openTarget = 0; },
    // Server-Stimme (ElevenLabs): Mund folgt der echten Lautstärke
    talkWithAudio(audioEl) { if (!amplitude(audioEl)) { talkMode = "speech"; nextSyllable(performance.now()); } },
    // Wortgrenze der Gerätestimme: neuen Silben-Takt beginnen, nach Satzzeichen kurz pausieren
    boundary(charIndex, text) {
      if (talkMode !== "speech") talkMode = "speech";
      const now = performance.now();
      const before = String(text || "").slice(Math.max(0, (charIndex || 0) - 3), charIndex || 0);
      if (/[.!?]\s*$/.test(before)) syl.pauseUntil = now + 220;
      else if (/[,;:–-]\s*$/.test(before)) syl.pauseUntil = now + 120;
      else syl.pauseUntil = now + 40;
      syl.start = syl.pauseUntil; syl.dur = 0;
    },
    stop() { stopAmp(); talkMode = null; openTarget = 0; wideTarget = 0; },
    // Zum Testen: Mund fest auf einen Wert (0–1) stellen, null = normal
    _state() { return { talkMode, open: Math.round(open * 100) / 100, wide: Math.round(wide * 100) / 100 }; },
    _debugOpen(v) { debugOpen = v === null || v === undefined ? null : Number(v); },
  };
})();
