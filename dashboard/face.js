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
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  const group = new THREE.Group();
  scene.add(group);
  const rings = new THREE.Group();
  let ringMats = [];
  const col = themeColor();

  // ---- Maße im Kopfmodell (zentrierte Modell-Einheiten, Kopf ca. 8 hoch) ----
  const MOUTH = { y: 0.06, z: 2.2, halfW: 0.62 };      // Mundspalte (zwischen den Lippen)
  const EYES = [[-0.56, 1.72, 1.98], [0.56, 1.72, 1.98]];

  // ---- Hologramm-Shader ----
  const uniforms = {
    uColor: { value: col.clone() },
    uTime: { value: 0 },
    uOpen: { value: 0 },
    uTalk: { value: 0 },
    uMouth: { value: new THREE.Vector3(0, MOUTH.y, MOUTH.halfW) },
  };
  const vert = `
    attribute vec3 rest;
    varying vec3 vN; varying vec3 vV; varying vec3 vRest; varying float vY;
    void main() {
      vRest = rest;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vV = -mv.xyz;
      vN = normalize(normalMatrix * normal);
      vY = position.y;
      gl_Position = projectionMatrix * mv;
    }`;
  const frag = `
    uniform vec3 uColor; uniform float uTime; uniform float uOpen; uniform float uTalk; uniform vec3 uMouth;
    varying vec3 vN; varying vec3 vV; varying vec3 vRest; varying float vY;
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
      // Innerer Mund: dunkel, wenn die Lippen offen sind
      float mx = vRest.x / uMouth.z;
      float my = (vRest.y - uMouth.y) / 0.13;
      float e = mx * mx + my * my;
      float front = smoothstep(1.7, 2.05, vRest.z);
      float m = (1.0 - smoothstep(0.55, 1.0, e)) * front * smoothstep(0.02, 0.18, uOpen);
      vec3 inner = uColor * 0.05 + uColor * 0.25 * smoothstep(0.3, 0.9, e);
      c = mix(c, inner, m * 0.92);
      // Sprechen: Hologramm leuchtet etwas stärker
      c *= 1.0 + uTalk * 0.25;
      gl_FragColor = vec4(c, 1.0);
    }`;

  let solidMat = null, wireMat = null, ready = false;
  let headGeo = null, basePos = null, lastOpen = -1, lastWide = -9;
  const eyeSprites = [];
  let particles = null, partMat = null;

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
  loader.load("vendor/head.glb", (gltf) => {
    let geo = null;
    gltf.scene.traverse((o) => { if (o.isMesh && o.geometry && !geo) geo = o.geometry; });
    if (!geo) { fallback2d(); return; }
    geo = geo.clone();
    geo.center();
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const s = 2.1 / (geo.boundingSphere.radius || 1);

    headGeo = geo;
    basePos = geo.attributes.position.array.slice();
    geo.setAttribute("rest", new THREE.BufferAttribute(basePos.slice(), 3));

    // Beleuchtete Hologramm-Oberfläche
    try {
      solidMat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag });
      solidMat.polygonOffset = true; solidMat.polygonOffsetFactor = 1; solidMat.polygonOffsetUnits = 1;
    } catch { solidMat = new THREE.MeshBasicMaterial({ color: 0x140a04 }); }
    const solid = new THREE.Mesh(geo, solidMat);

    // Feines Netz darüber (Hologramm-Struktur)
    wireMat = new THREE.MeshBasicMaterial({ color: col.clone(), wireframe: true, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
    const wire = new THREE.Mesh(geo, wireMat);

    const inner = new THREE.Group();
    inner.add(solid); inner.add(wire);

    // Leuchtende Augen (blinzeln)
    const tex = glowTexture();
    for (const [x, y, z] of EYES) {
      const m = new THREE.SpriteMaterial({ map: tex, color: col.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0.85 });
      const sp = new THREE.Sprite(m);
      sp.position.set(x, y, z + 0.08);
      sp.scale.set(0.34, 0.2, 1);
      inner.add(sp); eyeSprites.push(sp);
    }

    inner.scale.setScalar(s);
    group.add(inner);
    group.rotation.y = -0.18;

    // Schwebende Licht-Partikel um den Kopf
    try {
      const N = 260, p = new Float32Array(N * 3), sp = new Float32Array(N);
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

    ready = true;
  }, undefined, () => { fallback2d(); });

  resize();
  if (window.ResizeObserver) { try { new ResizeObserver(resize).observe(host); } catch {} }
  window.addEventListener("resize", resize);
  setInterval(() => {
    const c = themeColor();
    uniforms.uColor.value.copy(c);
    if (wireMat) wireMat.color.copy(c);
    if (partMat) partMat.color.copy(c);
    eyeSprites.forEach((s) => s.material.color.copy(c));
    ringMats.forEach((m) => m.color.copy(c));
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

  // Blinzeln
  let nextBlink = performance.now() + 2500, blinkStart = -1;

  function animate(now) {
    const dt = Math.min(60, now - (animate.last || now)); animate.last = now;
    const t = now / 1000;
    uniforms.uTime.value = t;
    if (ready) {
      if (optHead && !optReduce) {
        group.rotation.y = -0.18 + Math.sin(t * 0.4) * 0.11 + Math.sin(t * 0.15) * 0.04;
        group.rotation.x = Math.sin(t * 0.3) * 0.05 - 0.02 + open * 0.035;
        group.position.y = Math.sin(t * 0.6) * 0.03;
      } else { group.rotation.y = -0.18; group.rotation.x = -0.02; group.position.y = 0; }

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
      eyeSprites.forEach((s) => { s.scale.set(0.34, 0.2 * Math.max(0.06, lid), 1); s.material.opacity = pulse; });

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
