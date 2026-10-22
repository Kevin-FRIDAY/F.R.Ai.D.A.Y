// F.R.Ai.D.A.Y – detaillierter, menschlicher Hologramm-Kopf (Augen, Kopf, Lippen).
// Feiner Wireframe-Kopf mit Hals/Schultern, orangefarbenes Netz wie im Mockup.
(() => {
  "use strict";
  const host = document.getElementById("face-host");
  if (!host) return;

  host.innerHTML = `
  <svg id="ff-svg" viewBox="0 0 280 340" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
    <defs>
      <radialGradient id="ff-aura" cx="50%" cy="42%" r="58%">
        <stop offset="0%" stop-color="var(--cyan)" stop-opacity="0.26"/>
        <stop offset="55%" stop-color="var(--cyan)" stop-opacity="0.06"/>
        <stop offset="100%" stop-color="var(--cyan)" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="ff-skin" cx="48%" cy="40%" r="62%">
        <stop offset="0%" stop-color="var(--cyan)" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="var(--cyan)" stop-opacity="0.02"/>
      </radialGradient>
    </defs>

    <ellipse cx="140" cy="150" rx="118" ry="140" fill="url(#ff-aura)"/>

    <g id="ff-head" class="ff-line">
      <!-- Schultern / Büste -->
      <path class="ff-mesh" d="M44 322 C58 286 96 266 140 266 C184 266 222 286 236 322"/>
      <path class="ff-faint" d="M70 318 C92 292 116 282 140 282 C164 282 188 292 210 318"/>
      <!-- Hals -->
      <path class="ff-strong" d="M116 236 C116 252 112 262 108 272"/>
      <path class="ff-strong" d="M164 236 C164 252 168 262 172 272"/>
      <path class="ff-faint" d="M120 250 Q140 262 160 250"/>
      <!-- Schlüsselbein -->
      <path class="ff-faint" d="M100 282 Q140 272 180 282"/>

      <!-- Kopf-Silhouette (Stirn, Schläfen, Wangen, Kiefer, Kinn) -->
      <path class="ff-strong" d="M140 32
        C106 32 86 56 82 92
        C80 110 80 124 85 142
        C90 164 99 186 114 206
        C123 218 132 228 140 232
        C148 228 157 218 166 206
        C181 186 190 164 195 142
        C200 124 200 110 198 92
        C194 56 174 32 140 32 Z"/>
      <!-- Hülle als leichte Fläche -->
      <path d="M140 34 C108 34 88 58 84 92 C82 110 82 124 87 142 C92 164 101 186 116 206 C125 218 133 227 140 231 C147 227 155 218 164 206 C179 186 188 164 193 142 C198 124 198 110 196 92 C192 58 172 34 140 34 Z" fill="url(#ff-skin)" stroke="none"/>

      <!-- Haar / Scheitel -->
      <path class="ff-strong" d="M82 94 C86 50 108 32 140 30 C172 32 194 50 198 94"/>
      <path class="ff-faint" d="M96 70 C110 48 126 42 140 42 C154 42 170 48 184 70"/>
      <path class="ff-faint" d="M112 50 C124 44 156 44 168 50"/>
      <path class="ff-faint" d="M140 30 L140 60"/>

      <!-- Ohren -->
      <path class="ff-strong" d="M83 120 C72 122 70 140 80 150 C85 154 88 150 88 144"/>
      <path class="ff-strong" d="M197 120 C208 122 210 140 200 150 C195 154 192 150 192 144"/>

      <!-- Wangen-/Kiefer-Konturen (Volumen) -->
      <path class="ff-mesh" d="M96 128 C100 160 110 190 128 212"/>
      <path class="ff-mesh" d="M184 128 C180 160 170 190 152 212"/>
      <path class="ff-faint" d="M110 150 C116 170 122 186 132 200"/>
      <path class="ff-faint" d="M170 150 C164 170 158 186 148 200"/>

      <!-- Netz: senkrechte Längslinien (3D-Wölbung) -->
      <path class="ff-faint" d="M140 36 C140 110 140 170 140 230"/>
      <path class="ff-faint" d="M122 40 C114 110 118 176 130 224"/>
      <path class="ff-faint" d="M158 40 C166 110 162 176 150 224"/>
      <!-- Netz: waagerechte Breitenlinien -->
      <path class="ff-faint" d="M88 92 Q140 84 192 92"/>
      <path class="ff-faint" d="M90 110 Q140 118 190 110"/>
      <path class="ff-faint" d="M96 150 Q140 158 184 150"/>
      <path class="ff-faint" d="M104 184 Q140 192 176 184"/>

      <!-- Brauen -->
      <path class="ff-strong" d="M102 108 C112 101 126 101 134 107"/>
      <path class="ff-strong" d="M178 108 C168 101 154 101 146 107"/>

      <!-- Augen -->
      <g id="ff-eyeL">
        <path class="ff-eyerim" d="M100 123 C110 113 128 113 136 123 C128 133 110 133 100 123 Z"/>
        <circle id="ff-irisL" class="ff-iris" cx="118" cy="123" r="8"/>
        <circle id="ff-pupilL" class="ff-pupil" cx="118" cy="123" r="3.4"/>
        <circle class="ff-catch" cx="115" cy="120" r="1.4"/>
        <rect id="ff-lidL" class="ff-lid" x="99" y="111" width="38" height="14" rx="5"/>
        <path class="ff-faint" d="M100 126 C110 133 128 133 136 126"/>
      </g>
      <g id="ff-eyeR">
        <path class="ff-eyerim" d="M144 123 C152 113 170 113 180 123 C170 133 152 133 144 123 Z"/>
        <circle id="ff-irisR" class="ff-iris" cx="162" cy="123" r="8"/>
        <circle id="ff-pupilR" class="ff-pupil" cx="162" cy="123" r="3.4"/>
        <circle class="ff-catch" cx="159" cy="120" r="1.4"/>
        <rect id="ff-lidR" class="ff-lid" x="143" y="111" width="38" height="14" rx="5"/>
        <path class="ff-faint" d="M144 126 C152 133 170 133 180 126"/>
      </g>

      <!-- Nase -->
      <path class="ff-strong" d="M140 118 C138 134 136 150 133 162"/>
      <path class="ff-faint" d="M140 120 C142 136 144 150 147 162"/>
      <path class="ff-strong" d="M126 166 C131 173 140 175 140 168 C140 175 149 173 154 166"/>
      <path class="ff-faint" d="M131 163 Q140 160 149 163"/>

      <!-- Mund -->
      <g id="ff-mouthG">
        <path id="ff-lips" class="ff-lips" d="M118 190 Q129 184 140 187 Q151 184 162 190 Q151 195 140 195 Q129 195 118 190 Z"/>
        <ellipse id="ff-mouth" class="ff-open" cx="140" cy="191" rx="18" ry="1.4"/>
        <path id="ff-lowerlip" class="ff-faint" d="M122 194 Q140 206 158 194"/>
        <path class="ff-faint" d="M140 176 L140 184"/>
      </g>

      <!-- Kinn / Kiefer -->
      <path class="ff-faint" d="M116 214 Q140 226 164 214"/>
      <path class="ff-mesh" d="M108 196 C120 214 160 214 172 196"/>
    </g>
  </svg>`;

  const $ = (id) => document.getElementById(id);
  const mouth = $("ff-mouth"), lips = $("ff-lips"), lower = $("ff-lowerlip");
  const lidL = $("ff-lidL"), lidR = $("ff-lidR");
  const pL = $("ff-pupilL"), pR = $("ff-pupilR"), iL = $("ff-irisL"), iR = $("ff-irisR");

  // ---- Blinzeln ----
  function blink() {
    [lidL, lidR].forEach((l) => l && l.classList.add("shut"));
    setTimeout(() => [lidL, lidR].forEach((l) => l && l.classList.remove("shut")), 140);
    setTimeout(blink, 2800 + Math.random() * 4200);
  }
  setTimeout(blink, 1800);

  // ---- Augen/Pupillen driften ----
  function glance() {
    const dx = (Math.random() - 0.5) * 8, dy = (Math.random() - 0.5) * 4;
    const t = `translate(${dx},${dy})`;
    [pL, pR, iL, iR].forEach((e) => e && e.setAttribute("transform", t));
    setTimeout(glance, 2000 + Math.random() * 2800);
  }
  setTimeout(glance, 1400);

  // ---- Mund: sprechen ----
  let talkRaf = null, analyser = null, audioCtx = null, dataArr = null, srcNode = null;
  function setMouth(open) {
    const ry = Math.max(1.3, Math.min(15, open));
    mouth.setAttribute("ry", ry.toFixed(1));
    const spread = ry > 4 ? ry * 0.5 : 0;
    lips.setAttribute("d", `M118 ${188 - spread * 0.3} Q129 ${184 - spread * 0.4} 140 ${187 - spread * 0.3} Q151 ${184 - spread * 0.4} 162 ${188 - spread * 0.3} Q151 ${195 + spread * 0.5} 140 ${195 + spread * 0.6} Q129 ${195 + spread * 0.5} 118 ${188 - spread * 0.3} Z`);
    if (lower) lower.setAttribute("d", `M122 194 Q140 ${206 + spread} 158 194`);
  }
  function stopTalk() {
    cancelAnimationFrame(talkRaf); talkRaf = null;
    host.classList.remove("talking");
    let o = mouth.getAttribute("ry") * 1;
    const close = () => { o *= 0.7; setMouth(o); if (o > 1.6) requestAnimationFrame(close); else setMouth(1.3); };
    close();
  }
  function randomTalk() {
    host.classList.add("talking");
    let t = 0;
    const step = () => {
      t += 0.35;
      const v = (Math.sin(t) * 0.5 + 0.5) * (0.6 + Math.random() * 0.4);
      setMouth(2 + v * 12);
      talkRaf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(talkRaf); step();
  }
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
        const level = sum / 38 / 255;
        setMouth(2 + level * 18);
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
