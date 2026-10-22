// F.R.Ai.D.A.Y – animiertes holografisches Gesicht (Augen, Kopf, Lippen).
(() => {
  "use strict";
  const host = document.getElementById("face-host");
  if (!host) return;
  const NS = "http://www.w3.org/2000/svg";

  host.innerHTML = `
  <svg id="ff-svg" viewBox="0 0 200 230" aria-hidden="true">
    <defs>
      <radialGradient id="ff-glow" cx="50%" cy="45%" r="60%">
        <stop offset="0%" stop-color="var(--cyan)" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="var(--cyan)" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="100" cy="112" rx="78" ry="92" fill="url(#ff-glow)"/>
    <g id="ff-head" class="ff-line">
      <!-- Kopf-Kontur -->
      <path d="M100 26 C56 26 42 64 42 104 C42 150 64 196 100 206 C136 196 158 150 158 104 C158 64 144 26 100 26 Z"/>
      <!-- Wireframe-Konturlinien -->
      <path class="ff-faint" d="M100 26 L100 206"/>
      <path class="ff-faint" d="M46 84 C72 96 128 96 154 84"/>
      <path class="ff-faint" d="M44 120 C72 134 128 134 156 120"/>
      <path class="ff-faint" d="M52 158 C74 172 126 172 148 158"/>
      <path class="ff-faint" d="M70 30 C66 120 66 150 84 196"/>
      <path class="ff-faint" d="M130 30 C134 120 134 150 116 196"/>
      <!-- Brauen -->
      <path d="M58 86 C70 80 84 80 92 84"/>
      <path d="M142 86 C130 80 116 80 108 84"/>
      <!-- Nase -->
      <path class="ff-faint" d="M100 100 L100 132 C94 138 106 138 100 132"/>
      <!-- Augen -->
      <g id="ff-eyeL">
        <path class="ff-eyerim" d="M60 100 C68 92 86 92 92 100 C86 108 68 108 60 100 Z"/>
        <circle id="ff-pupilL" cx="76" cy="100" r="5.2" class="ff-pupil"/>
        <rect id="ff-lidL" x="58" y="88" width="36" height="13" rx="4" class="ff-lid"/>
      </g>
      <g id="ff-eyeR">
        <path class="ff-eyerim" d="M108 100 C114 92 132 92 140 100 C132 108 114 108 108 100 Z"/>
        <circle id="ff-pupilR" cx="124" cy="100" r="5.2" class="ff-pupil"/>
        <rect id="ff-lidR" x="106" y="88" width="36" height="13" rx="4" class="ff-lid"/>
      </g>
      <!-- Mund -->
      <g id="ff-mouthG">
        <path id="ff-lips" class="ff-lips" d="M74 164 C88 170 112 170 126 164"/>
        <ellipse id="ff-mouth" cx="100" cy="166" rx="18" ry="1.5" class="ff-open"/>
      </g>
    </g>
  </svg>`;

  const $ = (id) => document.getElementById(id);
  const head = $("ff-head"), mouth = $("ff-mouth"), lips = $("ff-lips");
  const lidL = $("ff-lidL"), lidR = $("ff-lidR"), pL = $("ff-pupilL"), pR = $("ff-pupilR");

  // ---- Blinzeln ----
  function blink() {
    [lidL, lidR].forEach((l) => l.classList.add("shut"));
    setTimeout(() => [lidL, lidR].forEach((l) => l.classList.remove("shut")), 150);
    setTimeout(blink, 2600 + Math.random() * 4200);
  }
  setTimeout(blink, 1500);

  // ---- Augen/Pupillen driften ----
  function glance() {
    const dx = (Math.random() - 0.5) * 7, dy = (Math.random() - 0.5) * 4;
    pL.setAttribute("transform", `translate(${dx},${dy})`);
    pR.setAttribute("transform", `translate(${dx},${dy})`);
    setTimeout(glance, 1800 + Math.random() * 2600);
  }
  setTimeout(glance, 1200);

  // ---- Mund: sprechen ----
  let talkRaf = null, analyser = null, audioCtx = null, dataArr = null, srcNode = null;
  function setMouth(open) {
    const ry = Math.max(1.3, Math.min(13, open));
    mouth.setAttribute("ry", ry.toFixed(1));
    // Lippen leicht mitformen
    const d = ry > 4 ? `M74 162 C88 ${168 + ry * 0.5} 112 ${168 + ry * 0.5} 126 162` : "M74 164 C88 170 112 170 126 164";
    lips.setAttribute("d", d);
  }
  function stopTalk() {
    cancelAnimationFrame(talkRaf); talkRaf = null;
    host.classList.remove("talking");
    let o = mouth.getAttribute("ry") * 1;
    const close = () => { o *= 0.7; setMouth(o); if (o > 1.6) requestAnimationFrame(close); else setMouth(1.3); };
    close();
  }
  // Zufällige Lippenbewegung (für Gerätestimme ohne Audiostrom)
  function randomTalk() {
    host.classList.add("talking");
    let t = 0;
    const step = () => {
      t += 0.35;
      const v = (Math.sin(t) * 0.5 + 0.5) * (0.6 + Math.random() * 0.4);
      setMouth(2 + v * 11);
      talkRaf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(talkRaf); step();
  }
  // Lippen per echter Lautstärke (ElevenLabs-Audio)
  function amplitudeTalk(audioEl) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (!srcNode || srcNode.mediaElement !== audioEl) {
        srcNode = audioCtx.createMediaElementSource(audioEl);
        analyser = audioCtx.createAnalyser(); analyser.fftSize = 256;
        srcNode.connect(analyser); analyser.connect(audioCtx.destination);
        dataArr = new Uint8Array(analyser.frequencyBinCount);
      }
      audioCtx.resume?.();
      host.classList.add("talking");
      const step = () => {
        analyser.getByteFrequencyData(dataArr);
        let sum = 0; for (let i = 2; i < 40; i++) sum += dataArr[i];
        const level = sum / 38 / 255; // 0..1
        setMouth(2 + level * 16);
        talkRaf = requestAnimationFrame(step);
      };
      cancelAnimationFrame(talkRaf); step();
      return true;
    } catch { return false; }
  }

  window.FridayFace = {
    talk(on) { if (on) randomTalk(); else stopTalk(); },
    talkWithAudio(audioEl) { if (!amplitudeTalk(audioEl)) randomTalk(); },
    stop() { stopTalk(); },
  };
})();
