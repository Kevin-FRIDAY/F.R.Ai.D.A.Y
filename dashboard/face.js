// F.R.Ai.D.A.Y – echter 3D-Kopf als oranges Hologramm (Three.js + 3D-Kopfmodell).
// Rendert ein reales Kopfmodell als Drahtgitter wie im Mockup. Fällt auf den
// gezeichneten Canvas-Kopf (face2d.js) zurück, falls WebGL/Modell nicht geht.
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

  // WebGL + Three.js vorhanden?
  const hasWebGL = (() => {
    try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); }
    catch { return false; }
  })();
  if (!window.THREE || !window.THREE.GLTFLoader || !hasWebGL) { fallback2d(); return; }

  const THREE = window.THREE;

  // Akzentfarbe aus dem Theme
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

  let wireMat, solidMat, ready = false;
  let headGeo = null, basePos = null, jaw = null, lastJaw = -1;
  const col = themeColor();

  // Öffnet den Mund, indem der Kiefer-Bereich um die Gelenkachse nach unten rotiert.
  function deformJaw(a) {
    if (!headGeo || !basePos || !jaw) return;
    const pos = headGeo.attributes.position.array;
    const angle = a * 0.55; // max ~0.55 rad Kieferöffnung
    const ca = Math.cos(angle), sa = Math.sin(angle);
    for (let i = 0; i < pos.length; i += 3) {
      const bx = basePos[i], by = basePos[i + 1], bz = basePos[i + 2];
      if (by < jaw.pivotY && bz > jaw.frontZ) {
        let w = (jaw.pivotY - by) / jaw.band; if (w > 1) w = 1;
        const aa = angle * w, c = Math.cos(aa), s2 = Math.sin(aa);
        const dy = by - jaw.pivotY, dz = bz - jaw.pivotZ;
        pos[i + 1] = jaw.pivotY + dy * c - dz * s2;
        pos[i + 2] = jaw.pivotZ + dy * s2 + dz * c;
        pos[i] = bx;
      } else { pos[i] = bx; pos[i + 1] = by; pos[i + 2] = bz; }
    }
    headGeo.attributes.position.needsUpdate = true;
    void ca; void sa;
  }

  const loader = new THREE.GLTFLoader();
  loader.load("vendor/head.glb", (gltf) => {
    let geo = null;
    gltf.scene.traverse((o) => { if (o.isMesh && o.geometry && !geo) geo = o.geometry; });
    if (!geo) { fallback2d(); return; }
    geo = geo.clone();
    geo.computeVertexNormals();
    geo.center();
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const s = 2.1 / (geo.boundingSphere.radius || 1);

    // Für Mundbewegung: Ausgangspositionen + Kiefer-Bereich merken
    headGeo = geo;
    basePos = geo.attributes.position.array.slice();
    const bb = geo.boundingBox;
    const hY = bb.max.y - bb.min.y, hZ = bb.max.z - bb.min.z;
    jaw = {
      pivotY: bb.min.y + hY * 0.46,   // Kiefergelenk-Höhe
      pivotZ: bb.min.z,               // Drehachse hinten
      frontZ: bb.min.z + hZ * 0.42,   // nur vordere Hälfte (Kinn/Mund)
      band: hY * 0.34,                // weiche Übergangszone
    };

    // Dunkler Füllkörper verdeckt die Rückseite -> nur vorderes Netz leuchtet
    solidMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x0a0603) });
    solidMat.polygonOffset = true; solidMat.polygonOffsetFactor = 1; solidMat.polygonOffsetUnits = 1;
    const solid = new THREE.Mesh(geo, solidMat);

    // Orange Drahtgitter
    wireMat = new THREE.MeshBasicMaterial({ color: col.clone(), wireframe: true, transparent: true, opacity: 0.6 });
    const wire = new THREE.Mesh(geo, wireMat);

    const inner = new THREE.Group();
    inner.add(solid); inner.add(wire);
    inner.scale.setScalar(s);
    // Modell blickt nach vorn, leicht gedreht wie im Mockup
    group.add(inner);
    group.rotation.y = -0.18;
    ready = true;
  }, undefined, () => { fallback2d(); });

  resize();
  if (window.ResizeObserver) { try { new ResizeObserver(resize).observe(host); } catch {} }
  window.addEventListener("resize", resize);
  setInterval(() => { if (wireMat) { const c = themeColor(); wireMat.color.copy(c); } }, 1500);

  // ---- Animation + Sprech-Puls ----
  let talkMode = null, amp = 0, ampTarget = 0, randPhase = 0, t0 = performance.now();
  function animate(now) {
    const dt = Math.min(60, now - t0); t0 = now;
    const t = now / 1000;
    if (ready) {
      // sanftes Wiegen/Atmen, Blick nach vorn
      group.rotation.y = -0.18 + Math.sin(t * 0.4) * 0.11 + Math.sin(t * 0.15) * 0.04;
      group.rotation.x = Math.sin(t * 0.3) * 0.05 - 0.02;
      group.position.y = Math.sin(t * 0.6) * 0.03;
      // Sprechen -> Netz pulsiert heller
      if (talkMode === "rand") { randPhase += dt / 1000 * 10; ampTarget = (Math.sin(randPhase) * 0.5 + 0.5); }
      else if (talkMode !== "amp") ampTarget = 0;
      amp += (ampTarget - amp) * Math.min(1, dt / 90);
      if (wireMat) wireMat.opacity = 0.6 + amp * 0.3;
      // Mund bewegen (Kiefer öffnen) passend zur Lautstärke
      if (Math.abs(amp - lastJaw) > 0.008) { deformJaw(amp); lastJaw = amp; }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // ---- API (wie bisher) ----
  let audioCtx = null, analyser = null, dataArr = null, srcNode = null, ampRaf = null;
  function stopAmp() { if (ampRaf) cancelAnimationFrame(ampRaf); ampRaf = null; }
  function amplitude(audioEl) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (!srcNode || srcNode.mediaElement !== audioEl) {
        srcNode = audioCtx.createMediaElementSource(audioEl);
        analyser = audioCtx.createAnalyser(); analyser.fftSize = 256;
        srcNode.connect(analyser); analyser.connect(audioCtx.destination);
        dataArr = new Uint8Array(analyser.frequencyBinCount);
      }
      audioCtx.resume?.();
      talkMode = "amp";
      const step = () => {
        analyser.getByteFrequencyData(dataArr);
        let sum = 0; for (let i = 2; i < 40; i++) sum += dataArr[i];
        ampTarget = Math.min(1, (sum / 38 / 255) * 1.8);
        ampRaf = requestAnimationFrame(step);
      };
      stopAmp(); step();
      return true;
    } catch { return false; }
  }
  window.FridayFace = {
    talk(on) { stopAmp(); talkMode = on ? "rand" : null; if (!on) ampTarget = 0; },
    talkWithAudio(audioEl) { if (!amplitude(audioEl)) { talkMode = "rand"; } },
    stop() { stopAmp(); talkMode = null; ampTarget = 0; },
  };
})();
