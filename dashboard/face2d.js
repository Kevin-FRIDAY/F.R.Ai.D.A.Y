// F.R.Ai.D.A.Y – realistischer 3D-Hologramm-Kopf (Canvas-Wireframe, dreht sich leicht).
// Parametrischer Kopf aus Querschnitten: Stirn, Brauen, Augenhöhlen, Nase, Lippen,
// Kinn, Hals, Schultern. Längs- und Breitenlinien bilden ein echtes 3D-Netz.
(() => {
  "use strict";
  const host = document.getElementById("face-host");
  if (!host) return;
  host.innerHTML = '<canvas id="ff-canvas" aria-hidden="true"></canvas>';
  const canvas = document.getElementById("ff-canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.style.width = "100%";
  canvas.style.height = "100%";

  // ---- Akzentfarbe aus dem Theme lesen ----
  let COL = { r: 255, g: 138, b: 30 };
  function readColor() {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--cyan").trim();
      let m = v.match(/#([0-9a-f]{6})/i);
      if (m) { const n = parseInt(m[1], 16); COL = { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; return; }
      m = v.match(/rgba?\(([^)]+)\)/i);
      if (m) { const p = m[1].split(",").map(Number); COL = { r: p[0], g: p[1], b: p[2] }; }
    } catch { /* egal */ }
  }
  readColor();
  setInterval(readColor, 1500);
  const col = (a) => `rgba(${COL.r},${COL.g},${COL.b},${a})`;

  // ---- Kopf-Profil: Querschnitte von oben (Scheitel) nach unten (Schultern) ----
  // y: Höhe (oben +), rx: halbe Breite, rz: halbe Tiefe, cz: Tiefen-Versatz (Gesicht nach vorn)
  const PROFILE = [
    { y:  1.16, rx: 0.20, rz: 0.28, cz: -0.02 }, // Scheitel (schmal, hoch)
    { y:  1.06, rx: 0.38, rz: 0.46, cz: -0.02 },
    { y:  0.94, rx: 0.52, rz: 0.60, cz: -0.01 }, // Oberkopf
    { y:  0.80, rx: 0.62, rz: 0.68, cz: 0.02 },
    { y:  0.66, rx: 0.68, rz: 0.72, cz: 0.04 }, // Stirn
    { y:  0.53, rx: 0.71, rz: 0.74, cz: 0.06 }, // Brauen
    { y:  0.41, rx: 0.72, rz: 0.74, cz: 0.07 }, // Augen
    { y:  0.29, rx: 0.71, rz: 0.73, cz: 0.08 }, // Wangenknochen
    { y:  0.17, rx: 0.63, rz: 0.70, cz: 0.09 }, // Nasenbasis
    { y:  0.04, rx: 0.56, rz: 0.66, cz: 0.09 }, // Mund
    { y: -0.10, rx: 0.50, rz: 0.60, cz: 0.07 }, // Kiefer
    { y: -0.24, rx: 0.41, rz: 0.52, cz: 0.06 }, // Kinn
    { y: -0.36, rx: 0.31, rz: 0.42, cz: 0.02 }, // Unterkinn
    { y: -0.48, rx: 0.26, rz: 0.30, cz: -0.01 }, // Hals oben
    { y: -0.66, rx: 0.27, rz: 0.29, cz: -0.02 }, // Hals
    { y: -0.82, rx: 0.30, rz: 0.31, cz: -0.02 }, // Halsansatz
    { y: -0.92, rx: 0.46, rz: 0.40, cz: -0.02 }, // Schulteransatz
    { y: -1.02, rx: 0.72, rz: 0.46, cz: -0.02 }, // Schultern
    { y: -1.10, rx: 0.95, rz: 0.48, cz: -0.02 }, // Schultern außen
  ];

  const ROWS = PROFILE.length;
  const COLS = 36;
  const bump = (y, c, w) => { const t = (y - c) / w; return t > -1 && t < 1 ? (1 - t * t) : 0; };

  // Netz-Punkte bauen (mit Gesichts-Verformungen vorn)
  const verts = [];
  for (let r = 0; r < ROWS; r++) {
    const P = PROFILE[r];
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const th = -Math.PI + (2 * Math.PI * c) / COLS; // 0 = vorne (Gesicht)
      const front = Math.max(0, Math.cos(th)); // 1 vorn, 0 hinten
      let x = P.rx * Math.sin(th);
      let z = P.cz + P.rz * Math.cos(th);
      // Nase
      const nose = bump(P.y, 0.19, 0.16) * Math.exp(-((th / 0.33) ** 2));
      z += 0.17 * nose;
      // Brauenwulst
      z += 0.05 * bump(P.y, 0.52, 0.09) * Math.exp(-((th / 0.8) ** 2));
      // Lippen
      z += 0.05 * bump(P.y, 0.04, 0.07) * Math.exp(-((th / 0.5) ** 2));
      // Kinn vor
      z += 0.07 * bump(P.y, -0.22, 0.12) * Math.exp(-((th / 0.6) ** 2));
      // Augenhöhlen (leicht zurück)
      const eyeTh = 0.42;
      const socket = bump(P.y, 0.41, 0.06) * (Math.exp(-(((th - eyeTh) / 0.2) ** 2)) + Math.exp(-(((th + eyeTh) / 0.2) ** 2)));
      z -= 0.05 * socket;
      row.push({ x, y: P.y, z });
    }
    verts.push(row);
  }

  // Merkmal-Anker im Modellraum (projiziert pro Frame -> Augen/Mund zeichnen)
  const anchor = (x, y) => {
    // Tiefe an der Vorderseite dieser Höhe grob interpolieren
    let best = PROFILE[0];
    for (const p of PROFILE) if (Math.abs(p.y - y) < Math.abs(best.y - y)) best = p;
    return { x, y, z: best.cz + best.rz + 0.02 };
  };
  const eyeLA = anchor(-0.27, 0.41), eyeRA = anchor(0.27, 0.41);
  const mouthA = anchor(0, 0.02);
  const noseTop = anchor(0, 0.40), noseTip = anchor(0, 0.15);

  // ---- Projektion ----
  const FOCAL = 3.4;
  function project(p, yaw, pitch, S, cx, cy) {
    const cy1 = Math.cos(yaw), sy = Math.sin(yaw);
    let x = p.x * cy1 + p.z * sy;
    let z1 = -p.x * sy + p.z * cy1;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    let y = p.y * cp - z1 * sp;
    let z = p.y * sp + z1 * cp;
    const f = FOCAL / (FOCAL - z);
    return { sx: cx + x * f * S, sy: cy - y * f * S, z, f };
  }

  // ---- Zustand / Animation ----
  let W = 0, H = 0, S = 0, CX = 0, CY = 0, dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = host.getBoundingClientRect();
    W = Math.max(60, rect.width); H = Math.max(60, rect.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.min(W, H) * 0.30;
    CX = W / 2; CY = H * 0.46;
  }
  resize();
  if (window.ResizeObserver) { try { new ResizeObserver(resize).observe(host); } catch {} }
  window.addEventListener("resize", resize);

  let t0 = performance.now();
  let blinkV = 0, nextBlink = 900;         // 0 offen, 1 zu
  let mouthOpen = 0, mouthTarget = 0;       // 0..1
  let gazeX = 0, gazeY = 0, gazeTX = 0, gazeTY = 0, nextGaze = 1400;
  let talkMode = null;                      // null | 'rand' | 'amp'
  let randPhase = 0;

  // Augen als Teil des Kopfes zeichnen (projiziert, mit Perspektive gestaucht)
  function drawEye(a, yaw, pitch, side) {
    const pc = project({ x: a.x, y: a.y, z: a.z }, yaw, pitch, S, CX, CY);
    if (pc.z < -0.4) return; // Rückseite
    const squish = Math.max(0.15, Math.cos(yaw + side * 0.25)); // Drehung
    const w = 0.15 * S * pc.f * squish;
    const h = 0.072 * S * pc.f;
    const open = 1 - blinkV;
    ctx.save();
    ctx.translate(pc.sx, pc.sy);
    // Lidspalte (Mandelform) + Oberlidfalte
    ctx.strokeStyle = col(0.95); ctx.lineWidth = 1.5; ctx.shadowColor = col(0.9); ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.quadraticCurveTo(0, -h * open, w, 0);
    ctx.quadraticCurveTo(0, h * open * 0.75, -w, 0);
    ctx.stroke();
    // Oberlidfalte
    ctx.strokeStyle = col(0.4); ctx.lineWidth = 1; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(-w * 0.85, -h * 0.5 * open - 2); ctx.quadraticCurveTo(0, -h * open - 3, w * 0.85, -h * 0.5 * open - 2); ctx.stroke();
    if (open > 0.3) {
      // Iris + Pupille, Blick meist nach vorn (nur leichte Drift)
      const gx = gazeX * w * 0.22, gy = gazeY * h * 0.35;
      const ir = h * 0.82 * open;
      ctx.shadowColor = col(0.9);
      ctx.beginPath(); ctx.fillStyle = col(0.2); ctx.shadowBlur = 4;
      ctx.arc(gx, gy, ir, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.strokeStyle = col(0.7); ctx.lineWidth = 1; ctx.shadowBlur = 0;
      ctx.arc(gx, gy, ir, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.fillStyle = col(1); ctx.shadowBlur = 8; ctx.shadowColor = col(1);
      ctx.arc(gx, gy, ir * 0.42, 0, Math.PI * 2); ctx.fill();
      // Glanzpunkt
      ctx.beginPath(); ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.shadowBlur = 0;
      ctx.arc(gx - ir * 0.32, gy - ir * 0.32, ir * 0.18, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBrow(a, yaw, pitch, side) {
    const p1 = project({ x: a.x - 0.13 * side, y: a.y + 0.11, z: a.z - 0.02 }, yaw, pitch, S, CX, CY);
    const p2 = project({ x: a.x + 0.11 * side, y: a.y + 0.13, z: a.z }, yaw, pitch, S, CX, CY);
    const pm = project({ x: a.x, y: a.y + 0.145, z: a.z }, yaw, pitch, S, CX, CY);
    ctx.strokeStyle = col(0.85); ctx.lineWidth = 2; ctx.shadowColor = col(0.9); ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.moveTo(p1.sx, p1.sy); ctx.quadraticCurveTo(pm.sx, pm.sy - 2, p2.sx, p2.sy); ctx.stroke();
  }

  function drawNose(yaw, pitch) {
    const top = project({ x: 0, y: noseTop.y, z: noseTop.z - 0.02 }, yaw, pitch, S, CX, CY);
    const brk = project({ x: 0, y: 0.26, z: noseTip.z - 0.02 }, yaw, pitch, S, CX, CY);
    const tip = project({ x: 0, y: noseTip.y + 0.02, z: noseTip.z + 0.02 }, yaw, pitch, S, CX, CY);
    const lN = project({ x: -0.09, y: noseTip.y, z: noseTip.z - 0.03 }, yaw, pitch, S, CX, CY);
    const rN = project({ x: 0.09, y: noseTip.y, z: noseTip.z - 0.03 }, yaw, pitch, S, CX, CY);
    ctx.strokeStyle = col(0.8); ctx.lineWidth = 1.6; ctx.shadowColor = col(0.8); ctx.shadowBlur = 4;
    // Nasenrücken
    ctx.beginPath(); ctx.moveTo(top.sx, top.sy); ctx.quadraticCurveTo(brk.sx, brk.sy, tip.sx, tip.sy); ctx.stroke();
    // Nasenflügel
    ctx.beginPath(); ctx.moveTo(lN.sx, lN.sy); ctx.quadraticCurveTo(tip.sx, tip.sy + 2, rN.sx, rN.sy); ctx.stroke();
  }

  function drawMouth(yaw, pitch) {
    const o = mouthOpen;
    const w = 0.19, dz = mouthA.z;
    const L = project({ x: -w, y: 0.02, z: dz }, yaw, pitch, S, CX, CY);
    const R = project({ x: w, y: 0.02, z: dz }, yaw, pitch, S, CX, CY);
    const topM = project({ x: 0, y: 0.055, z: dz + 0.02 }, yaw, pitch, S, CX, CY);
    const botM = project({ x: 0, y: 0.02 - (0.02 + o * 0.12), z: dz }, yaw, pitch, S, CX, CY);
    const upM = project({ x: 0, y: 0.03 - o * 0.03, z: dz + 0.01 }, yaw, pitch, S, CX, CY);
    ctx.strokeStyle = col(0.95); ctx.lineWidth = 2; ctx.shadowColor = col(0.9); ctx.shadowBlur = 6;
    // Oberlippe (Amorbogen)
    ctx.beginPath(); ctx.moveTo(L.sx, L.sy);
    ctx.quadraticCurveTo((L.sx + topM.sx) / 2, topM.sy - 2, topM.sx, topM.sy);
    ctx.quadraticCurveTo((R.sx + topM.sx) / 2, topM.sy - 2, R.sx, R.sy); ctx.stroke();
    // Unterlippe
    ctx.beginPath(); ctx.moveTo(L.sx, L.sy);
    ctx.quadraticCurveTo(botM.sx, botM.sy, R.sx, R.sy); ctx.stroke();
    // Mundöffnung
    if (o > 0.04) {
      ctx.beginPath(); ctx.fillStyle = col(0.22);
      ctx.moveTo(L.sx, L.sy);
      ctx.quadraticCurveTo(upM.sx, upM.sy, R.sx, R.sy);
      ctx.quadraticCurveTo(botM.sx, botM.sy, L.sx, L.sy);
      ctx.fill();
    }
  }

  function render(now) {
    const dt = Math.min(50, now - t0); t0 = now;
    const tsec = now / 1000;
    // Fester, leicht gedrehter Blick nach vorn wie im Mockup, nur sanftes Atmen
    const yaw = -0.22 + Math.sin(tsec * 0.45) * 0.055 + Math.sin(tsec * 0.17) * 0.02;
    const pitch = -0.05 + Math.sin(tsec * 0.3) * 0.045;

    // Blinzeln
    nextBlink -= dt;
    if (nextBlink <= 0 && blinkV === 0) { blinkV = 0.001; }
    if (blinkV > 0) {
      blinkV += (blinkV < 0.5 ? dt / 70 : -dt / 90);
      if (blinkV >= 1) blinkV = 0.999;
      if (blinkV < 0) { blinkV = 0; nextBlink = 2600 + Math.random() * 4200; }
    }
    // Blick driften
    nextGaze -= dt;
    if (nextGaze <= 0) { gazeTX = (Math.random() - 0.5) * 1.6; gazeTY = (Math.random() - 0.5) * 1.2; nextGaze = 1600 + Math.random() * 2600; }
    gazeX += (gazeTX - gazeX) * Math.min(1, dt / 160);
    gazeY += (gazeTY - gazeY) * Math.min(1, dt / 160);
    // Mund
    if (talkMode === "rand") { randPhase += dt / 1000 * 11; mouthTarget = (Math.sin(randPhase) * 0.5 + 0.5) * (0.5 + Math.random() * 0.5); }
    else if (talkMode !== "amp") mouthTarget = 0;
    mouthOpen += (mouthTarget - mouthOpen) * Math.min(1, dt / 70);

    ctx.clearRect(0, 0, W, H);

    // Aura hinter dem Kopf
    const g = ctx.createRadialGradient(CX, CY, 4, CX, CY, S * 2.0);
    g.addColorStop(0, col(0.10)); g.addColorStop(0.5, col(0.03)); g.addColorStop(1, col(0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // Projizierte Punkte
    const P = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) row.push(project(verts[r][c], yaw, pitch, S, CX, CY));
      P.push(row);
    }
    // Tiefen-Helligkeit: vorn hell (Rim-Glow), hinten blass
    const depthA = (z) => Math.max(0.04, Math.min(0.95, Math.pow((z + 1.0) / 1.9, 1.5) * 0.95));
    // Schultern/Büste nach unten ausblenden (löst sich auf wie im Mockup)
    const rowFade = (r) => r <= 14 ? 1 : Math.max(0.08, 1 - (r - 14) / 4.2);

    ctx.lineWidth = 1; ctx.shadowColor = col(0.85); ctx.shadowBlur = 3;
    // Breitenlinien (Ringe)
    for (let r = 0; r < ROWS; r++) {
      const fade = rowFade(r);
      for (let c = 0; c < COLS; c++) {
        const a = P[r][c], b = P[r][(c + 1) % COLS];
        const za = (a.z + b.z) / 2;
        ctx.strokeStyle = col(depthA(za) * 0.8 * fade);
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      }
    }
    // Längslinien
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS - 1; r++) {
        const a = P[r][c], b = P[r + 1][c];
        const za = (a.z + b.z) / 2;
        const fade = (rowFade(r) + rowFade(r + 1)) / 2;
        ctx.strokeStyle = col(depthA(za) * 0.74 * fade);
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      }
    }

    // Gesichtsmerkmale vorn
    const facing = Math.cos(yaw) > -0.2;
    if (facing) {
      drawBrow(eyeLA, yaw, pitch, 1);
      drawBrow(eyeRA, yaw, pitch, -1);
      drawEye(eyeLA, yaw, pitch, -1);
      drawEye(eyeRA, yaw, pitch, 1);
      drawNose(yaw, pitch);
      drawMouth(yaw, pitch);
    }
    ctx.shadowBlur = 0;
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // ---- API ----
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
        mouthTarget = Math.min(1, (sum / 38 / 255) * 1.8);
        ampRaf = requestAnimationFrame(step);
      };
      stopAmp(); step();
      return true;
    } catch { return false; }
  }
  window.FridayFace = {
    talk(on) { stopAmp(); talkMode = on ? "rand" : null; if (!on) mouthTarget = 0; },
    talkWithAudio(audioEl) { if (!amplitude(audioEl)) { talkMode = "rand"; } },
    stop() { stopAmp(); talkMode = null; mouthTarget = 0; },
  };
})();
