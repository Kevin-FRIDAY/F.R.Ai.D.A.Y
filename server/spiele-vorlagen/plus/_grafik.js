/* Friday Grafik-Plus (FG) – gemeinsamer Motor für hochwertige Spiele der Spiele-Werkstatt.
   Wird beim Speichern direkt in jede Spiel-Datei eingebaut (die Datei bleibt eigenständig, ohne Netz).
   Bietet: scharfes Canvas (Retina), flüssige Schleife mit dt, Start-/Ende-Bildschirm mit Rekord,
   Leucht-Effekte, Partikel, Schockwellen, Schwebetexte, Bildschirm-Wackeln, Blitz, Vignette,
   Hintergründe (Sterne, Tiefsee, Raster), Töne per Web Audio, Tastatur, Zeiger und Touch-Joystick. */
(function () {
  "use strict";
  const C = { neon: "#ff8a1e", cyan: "#2ee6d0", gold: "#ffc44d", rot: "#ff4b4b", lila: "#b57bff", gruen: "#7dff8a", weiss: "#fff3e6", tief: "#04030a" };
  const FG = { C, W: 0, H: 0, dpr: 1, zeit: 0, zustand: "start", sparen: false, ctx: null, kamera: { x: 0, y: 0 } };
  let opt = null, feld = null, ctx = null, hudEl = null, overlay = null, stickEl = null, letzt = 0, hudText = "";
  let funken = [], ringe = [], texte = [], wackeln = 0, blitz = null, vignette = null, scan = null, bg = null;
  const tasten = new Set(), einmal = new Set();
  const zeiger = { x: 0, y: 0, unten: false, neu: false, los: false, id: null };
  const stick = { an: false, x: 0, y: 0, ox: 0, oy: 0, id: null };
  let langsam = 0;

  // ---------- Kleine Helfer ----------
  FG.zufall = (a, b) => a + Math.random() * (b - a);
  FG.ganz = (a, b) => Math.floor(FG.zufall(a, b + 1));
  FG.wahl = (l) => l[Math.floor(Math.random() * l.length)];
  FG.klemmen = (v, a, b) => Math.max(a, Math.min(b, v));
  FG.misch = (a, b, t) => a + (b - a) * t;
  FG.abstand = (a, b, c, d) => Math.hypot(c - a, d - b);
  FG.weich = (t) => 1 - Math.pow(1 - FG.klemmen(t, 0, 1), 3);
  FG.rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  FG.rund = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  FG.verlauf = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(Array.isArray(s) ? s[0] : i / (stops.length - 1), Array.isArray(s) ? s[1] : s)); return g; };

  // ---------- Leuchten (vorgerenderte Licht-Punkte, schnell auch auf dem iPhone) ----------
  const glowCache = new Map();
  function glowSprite(farbe) {
    if (glowCache.has(farbe)) return glowCache.get(farbe);
    const s = document.createElement("canvas"); s.width = s.height = 128;
    const g = s.getContext("2d"), v = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    v.addColorStop(0, FG.rgba(farbe, 1)); v.addColorStop(0.18, FG.rgba(farbe, 0.55)); v.addColorStop(0.5, FG.rgba(farbe, 0.14)); v.addColorStop(1, FG.rgba(farbe, 0));
    g.fillStyle = v; g.fillRect(0, 0, 128, 128);
    glowCache.set(farbe, s); return s;
  }
  /** Weicher Lichtfleck (additiv). */
  FG.leuchten = (x, y, r, farbe = C.neon, alpha = 1, c = ctx) => {
    if (r <= 0 || alpha <= 0) return;
    const alt = c.globalCompositeOperation; c.globalCompositeOperation = "lighter"; c.globalAlpha = Math.min(1, alpha);
    c.drawImage(glowSprite(farbe), x - r, y - r, r * 2, r * 2);
    c.globalAlpha = 1; c.globalCompositeOperation = alt;
  };
  /** Zeichnet etwas mit Neon-Schein (shadowBlur, im Sparmodus schwächer). */
  FG.glow = (farbe, staerke, fn, c = ctx) => { c.save(); c.shadowColor = farbe; c.shadowBlur = FG.sparen ? staerke * 0.4 : staerke; fn(c); c.restore(); };

  // ---------- Effekte ----------
  FG.funken = (x, y, o = {}) => {
    const n = Math.round((o.n || 18) * (FG.sparen ? 0.5 : 1));
    for (let i = 0; i < n && funken.length < 700; i++) {
      const w = o.winkel != null ? o.winkel + FG.zufall(-(o.streu || 0.6), o.streu || 0.6) : Math.random() * Math.PI * 2;
      const v = FG.zufall(0.3, 1) * (o.tempo || 220), leben = FG.zufall(0.5, 1) * (o.leben || 0.8);
      funken.push({ x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, t: leben, max: leben, g: FG.zufall(0.6, 1.2) * (o.groesse || 3), farbe: o.farbe || FG.wahl([C.neon, C.gold, C.weiss]), schwer: o.schwerkraft || 0, reib: o.reibung ?? 0.9, linie: o.linie !== false });
    }
  };
  FG.ring = (x, y, farbe = C.cyan, max = 90, dauer = 0.5) => ringe.push({ x, y, farbe, max, t: 0, dauer });
  FG.text = (x, y, text, farbe = C.gold, groesse = 20) => texte.push({ x, y, text: String(text), farbe, groesse, t: 0 });
  FG.wackeln = (s = 8) => { wackeln = Math.max(wackeln, s); };
  FG.blitz = (farbe = "#ffffff", staerke = 0.35) => { blitz = { farbe, a: staerke }; };
  FG.explosion = (x, y, farbe = C.neon, gross = 1) => {
    FG.funken(x, y, { n: 26 * gross, farbe, tempo: 320 * gross, leben: 0.9 });
    FG.funken(x, y, { n: 10 * gross, farbe: C.weiss, tempo: 140 * gross, leben: 0.5, groesse: 2 });
    FG.ring(x, y, farbe, 70 * gross, 0.45); FG.wackeln(7 * gross);
  };

  // ---------- Töne (Web Audio, startet erst nach der ersten Berührung) ----------
  let ac = null, stumm = false, rausch = null;
  try { stumm = localStorage.getItem("fg-stumm") === "1"; } catch (e) { /* egal */ }
  function audio() {
    if (ac || stumm) return ac;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
    return ac;
  }
  function piep(f0, f1, dauer, typ = "sine", laut = 0.18, verz = 0) {
    const a = audio(); if (!a || stumm) return;
    const t = a.currentTime + verz, o = a.createOscillator(), g = a.createGain();
    o.type = typ; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dauer);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(laut, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dauer + 0.02);
  }
  function knall(dauer = 0.4, laut = 0.3) {
    const a = audio(); if (!a || stumm) return;
    if (!rausch) { rausch = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = rausch.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(), t = a.currentTime;
    s.buffer = rausch; f.type = "lowpass"; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(120, t + dauer);
    g.gain.setValueAtTime(laut, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + dauer);
  }
  FG.ton = (art) => {
    if (stumm) return;
    switch (art) {
      case "klick": piep(660, 880, 0.06, "square", 0.06); break;
      case "punkt": piep(880, 1320, 0.12, "triangle", 0.12); break;
      case "power": piep(440, 1760, 0.35, "sawtooth", 0.08); piep(660, 1980, 0.3, "triangle", 0.08, 0.05); break;
      case "sprung": piep(300, 620, 0.16, "square", 0.07); break;
      case "schuss": piep(1200, 300, 0.09, "square", 0.05); break;
      case "treffer": piep(220, 80, 0.22, "sawtooth", 0.14); knall(0.2, 0.15); break;
      case "boom": knall(0.6, 0.35); piep(120, 40, 0.5, "sine", 0.25); break;
      case "level": [523, 659, 784, 1046].forEach((f, i) => piep(f, f * 1.01, 0.16, "triangle", 0.1, i * 0.09)); break;
      case "aus": [392, 330, 262, 196].forEach((f, i) => piep(f, f * 0.98, 0.22, "triangle", 0.12, i * 0.14)); break;
      default: piep(500, 700, 0.08);
    }
  };

  // ---------- Eingabe ----------
  FG.taste = (...namen) => namen.some((n) => tasten.has(n));
  FG.einmal = (...namen) => namen.some((n) => einmal.has(n));
  FG.zeiger = zeiger;
  /** Richtung aus Pfeiltasten/WASD und Touch-Joystick: {x,y} jeweils -1..1. */
  FG.richtung = () => {
    let x = 0, y = 0;
    if (FG.taste("arrowleft", "a")) x -= 1; if (FG.taste("arrowright", "d")) x += 1;
    if (FG.taste("arrowup", "w")) y -= 1; if (FG.taste("arrowdown", "s")) y += 1;
    if (stick.an) { x += stick.x; y += stick.y; }
    const l = Math.hypot(x, y); return l > 1 ? { x: x / l, y: y / l } : { x, y };
  };

  // ---------- Hintergründe ----------
  function baueHintergrund(art) {
    bg = { art, schichten: [], blasen: [] };
    if (art === "sterne" || art === "nebel") {
      for (let s = 0; s < 3; s++) bg.schichten.push(Array.from({ length: [70, 45, 22][s] }, () => ({ x: Math.random(), y: Math.random(), g: [0.8, 1.4, 2.2][s], tw: Math.random() * 6 })));
      bg.nebel = Array.from({ length: 4 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: FG.zufall(0.35, 0.6), f: [C.lila, C.neon, C.cyan, C.lila][i], p: Math.random() * 6 }));
    }
    if (art === "tiefsee") bg.blasen = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), r: FG.zufall(1, 4), v: FG.zufall(0.02, 0.07) }));
  }
  function zeichneHintergrund(dt) {
    const W = FG.W, H = FG.H, t = FG.zeit;
    if (!bg || bg.art === false || bg.art === "keiner") return;
    if (bg.art === "sterne" || bg.art === "nebel") {
      ctx.fillStyle = FG.verlauf(ctx, 0, 0, 0, H, ["#05030d", "#0a0516", "#030208"]); ctx.fillRect(0, 0, W, H);
      const zieh = opt.sternTempo ? opt.sternTempo() : 18;
      for (const n of bg.nebel) FG.leuchten((n.x * W + Math.sin(t * 0.05 + n.p) * 40), (n.y * H + Math.cos(t * 0.04 + n.p) * 30), n.r * Math.max(W, H), n.f, 0.16);
      bg.schichten.forEach((schicht, s) => {
        for (const p of schicht) {
          p.y += (zieh * (s + 1) * 0.5 * dt) / H; if (p.y > 1) { p.y -= 1; p.x = Math.random(); }
          const a = 0.45 + 0.4 * Math.sin(t * 2 + p.tw);
          ctx.fillStyle = `rgba(255,236,214,${a})`; ctx.fillRect(p.x * W, p.y * H, p.g, p.g);
          if (s === 2 && !FG.sparen) FG.leuchten(p.x * W + 1, p.y * H + 1, 6, C.weiss, a * 0.4);
        }
      });
    } else if (bg.art === "tiefsee") {
      ctx.fillStyle = FG.verlauf(ctx, 0, 0, 0, H, ["#06283a", "#03131f", "#01060b"]); ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 5; i++) {
        const x = ((i + 0.5) / 5) * W + Math.sin(t * 0.3 + i) * 40;
        ctx.fillStyle = FG.verlauf(ctx, 0, 0, 0, H * 0.8, ["rgba(120,230,255,.10)", "rgba(120,230,255,0)"]);
        ctx.beginPath(); ctx.moveTo(x - 30, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 140, H * 0.8); ctx.lineTo(x - 60, H * 0.8); ctx.fill();
      }
      ctx.restore();
      for (const b of bg.blasen) {
        b.y -= b.v * dt; if (b.y < -0.02) { b.y = 1.02; b.x = Math.random(); }
        ctx.strokeStyle = "rgba(160,240,255,.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x * W + Math.sin(t + b.r) * 6, b.y * H, b.r, 0, 7); ctx.stroke();
      }
    } else if (bg.art === "raster") {
      ctx.fillStyle = FG.verlauf(ctx, 0, 0, 0, H, ["#080510", "#05030a"]); ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,138,30,.07)"; ctx.lineWidth = 1; const g = 40, o = (t * 10) % g;
      ctx.beginPath(); for (let x = -g; x < W + g; x += g) { ctx.moveTo(x + o, 0); ctx.lineTo(x + o, H); } for (let y = 0; y < H; y += g) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke();
    }
  }

  // ---------- Nachbearbeitung: Vignette + feine Scanlines ----------
  function bauePost() {
    vignette = document.createElement("canvas"); vignette.width = 256; vignette.height = 256;
    const v = vignette.getContext("2d"), g = v.createRadialGradient(128, 128, 60, 128, 128, 182);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.6)"); v.fillStyle = g; v.fillRect(0, 0, 256, 256);
    const s = document.createElement("canvas"); s.width = 4; s.height = 4; const sc = s.getContext("2d");
    sc.fillStyle = "rgba(0,0,0,.09)"; sc.fillRect(0, 0, 4, 1); scan = ctx.createPattern(s, "repeat");
  }

  // ---------- Partikel & Co. aktualisieren und zeichnen ----------
  function effekte(dt) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const f of funken) {
      f.t -= dt; const k = Math.pow(f.reib, dt * 60);
      f.vx *= k; f.vy = f.vy * k + f.schwer * dt; f.x += f.vx * dt; f.y += f.vy * dt;
      const a = Math.max(0, f.t / f.max);
      if (f.linie) { ctx.strokeStyle = FG.rgba(f.farbe, a); ctx.lineWidth = f.g * a + 0.5; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 0.03, f.y - f.vy * 0.03); ctx.stroke(); }
      else { ctx.fillStyle = FG.rgba(f.farbe, a); ctx.beginPath(); ctx.arc(f.x, f.y, f.g * a + 0.5, 0, 7); ctx.fill(); }
      if (!FG.sparen && f.g > 2.4) FG.leuchten(f.x, f.y, f.g * 4, f.farbe, a * 0.5);
    }
    funken = funken.filter((f) => f.t > 0);
    for (const r of ringe) {
      r.t += dt; const p = r.t / r.dauer, rad = FG.weich(p) * r.max;
      ctx.strokeStyle = FG.rgba(r.farbe, (1 - p) * 0.9); ctx.lineWidth = 3 * (1 - p) + 1; ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, 7); ctx.stroke();
    }
    ringe = ringe.filter((r) => r.t < r.dauer);
    ctx.restore();
    for (const t of texte) {
      t.t += dt; const a = 1 - t.t / 1.1;
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.font = `800 ${t.groesse}px system-ui, sans-serif`; ctx.textAlign = "center";
      ctx.shadowColor = t.farbe; ctx.shadowBlur = 12; ctx.fillStyle = t.farbe; ctx.fillText(t.text, t.x, t.y - FG.weich(t.t) * 40); ctx.restore();
    }
    texte = texte.filter((t) => t.t < 1.1);
  }

  // ---------- Oberfläche (Start, Ende, Punkte) ----------
  const CSS = `
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{margin:0;height:100%;background:#04030a;color:#ffe7cc;font-family:system-ui,-apple-system,"SF Pro Display",sans-serif;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
  #fg-feld{position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none}
  #fg-hud{position:fixed;top:max(10px,env(safe-area-inset-top));left:0;right:0;display:flex;justify-content:center;gap:10px;pointer-events:none;flex-wrap:wrap;padding:0 54px}
  #fg-hud span{padding:6px 12px;border-radius:12px;background:rgba(10,6,4,.45);border:1px solid rgba(255,138,30,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#d9b48f;box-shadow:0 0 18px rgba(255,138,30,.12)}
  #fg-hud b{display:inline-block;margin-left:6px;color:#fff;font-size:16px;letter-spacing:.04em;text-shadow:0 0 10px #ff8a1e,0 0 2px #ff8a1e;font-variant-numeric:tabular-nums}
  #fg-ton{position:fixed;top:max(10px,env(safe-area-inset-top));right:10px;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,138,30,.4);background:rgba(10,6,4,.5);color:#ffd8b0;font-size:15px;z-index:5}
  #fg-over{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(circle at 50% 40%,rgba(30,14,4,.55),rgba(0,0,0,.82));z-index:4;transition:opacity .35s}
  #fg-over.weg{opacity:0;pointer-events:none}
  .fg-karte{max-width:440px;width:100%;text-align:center;padding:28px 24px 24px;border-radius:22px;border:1px solid rgba(255,138,30,.45);background:linear-gradient(160deg,rgba(40,20,6,.72),rgba(8,5,3,.82));box-shadow:0 0 50px rgba(255,138,30,.18),inset 0 0 30px rgba(255,138,30,.06);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:fg-rein .5s cubic-bezier(.2,.9,.3,1.2)}
  @keyframes fg-rein{from{transform:translateY(20px) scale(.94);opacity:0}}
  .fg-karte .fg-sym{font-size:44px;filter:drop-shadow(0 0 14px rgba(255,138,30,.7))}
  .fg-karte h1{margin:6px 0 4px;font-size:clamp(26px,7vw,38px);letter-spacing:.16em;font-weight:900;background:linear-gradient(180deg,#fff3e0,#ffb15c 55%,#ff8a1e);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 12px rgba(255,138,30,.55))}
  .fg-karte .fg-unter{margin:0 0 14px;color:#2ee6d0;font-size:12px;letter-spacing:.3em;text-transform:uppercase;text-shadow:0 0 10px rgba(46,230,208,.6)}
  .fg-karte p{margin:0 0 8px;line-height:1.5;color:#e9cfb3;font-size:15px}
  .fg-karte .fg-zahl{font-size:46px;font-weight:900;color:#fff;text-shadow:0 0 18px #ff8a1e;margin:4px 0}
  .fg-karte .fg-rek{color:#ffc44d;font-size:13px;letter-spacing:.12em;text-transform:uppercase}
  .fg-karte .fg-neu{color:#2ee6d0;font-weight:800;letter-spacing:.2em;animation:fg-puls 1s infinite}
  @keyframes fg-puls{50%{opacity:.4}}
  .fg-karte button{margin-top:16px;padding:14px 36px;border-radius:999px;border:1px solid #ff8a1e;background:linear-gradient(180deg,rgba(255,160,70,.45),rgba(255,138,30,.18));color:#fff;font-size:17px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;box-shadow:0 0 24px rgba(255,138,30,.45);cursor:pointer}
  .fg-karte button:active{transform:scale(.96)}
  .fg-karte kbd{font:inherit;font-size:12px;padding:1px 6px;border-radius:5px;border:1px solid rgba(255,138,30,.4);color:#ffd8b0}
  #fg-stick{position:fixed;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:2px solid rgba(46,230,208,.45);background:radial-gradient(circle,rgba(46,230,208,.12),rgba(46,230,208,.02));pointer-events:none;display:none;z-index:3}
  #fg-stick i{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#bff,#2ee6d0);box-shadow:0 0 20px #2ee6d0}`;

  function karte(html) { overlay.innerHTML = `<div class="fg-karte">${html}</div>`; overlay.classList.remove("weg"); const b = overlay.querySelector("button"); if (b) b.addEventListener("click", (e) => { e.stopPropagation(); los(); }); }
  function startKarte() {
    const rek = rekord();
    karte(`<div class="fg-sym">${opt.symbol || "✦"}</div><h1>${opt.titel}</h1><div class="fg-unter">${opt.untertitel || "Friday Spiele-Werkstatt"}</div><p>${opt.anleitung || ""}</p>${rek ? `<div class="fg-rek">Rekord ${rek}</div>` : ""}<button type="button">▶ Start</button>`);
  }
  function rekord(neu) {
    const k = "fg-rekord-" + (opt.id || opt.titel);
    try { if (neu != null) localStorage.setItem(k, String(neu)); return Number(localStorage.getItem(k) || 0); } catch (e) { return FG._rek || 0; }
  }
  FG.hud = (werte) => {
    const s = Object.entries(werte).map(([k, v]) => `<span>${k}<b>${v}</b></span>`).join("");
    if (s !== hudText) { hudText = s; hudEl.innerHTML = s; }
  };
  /** Spiel vorbei: zeigt Punkte, Rekord und "Nochmal". */
  FG.ende = (punkte, text) => {
    if (FG.zustand === "ende") return;
    FG.zustand = "ende"; FG.ton("aus");
    const alt = rekord(), neu = punkte > alt;
    if (neu) { rekord(punkte); FG._rek = punkte; }
    setTimeout(() => karte(`<div class="fg-sym">${opt.symbol || "✦"}</div><h1>${opt.endeTitel || "VORBEI"}</h1><p>${text || ""}</p><div class="fg-zahl">${punkte}</div>${neu ? '<div class="fg-neu">★ NEUER REKORD ★</div>' : `<div class="fg-rek">Rekord ${Math.max(alt, punkte)}</div>`}<button type="button">⟲ Nochmal</button>`), 650);
  };
  function los() {
    audio(); try { ac && ac.resume && ac.resume(); } catch (e) { /* egal */ }
    funken = []; ringe = []; texte = []; wackeln = 0; blitz = null; FG.kamera.x = FG.kamera.y = 0;
    overlay.classList.add("weg"); FG.zustand = "spiel"; FG.ton("level");
    opt.init && opt.init(); opt.los && opt.los();
  }

  // ---------- Größe ----------
  function groesse() {
    FG.dpr = Math.min(FG.sparen ? 1.5 : 2, window.devicePixelRatio || 1);
    FG.W = window.innerWidth; FG.H = window.innerHeight;
    feld.width = Math.round(FG.W * FG.dpr); feld.height = Math.round(FG.H * FG.dpr);
    ctx.setTransform(FG.dpr, 0, 0, FG.dpr, 0, 0);
    opt.groesse && opt.groesse(FG.W, FG.H);
  }

  // ---------- Hauptschleife ----------
  function schleife(t) {
    requestAnimationFrame(schleife);
    let dt = (t - (letzt || t)) / 1000; letzt = t;
    if (dt > 0.1) dt = 0.1; // nach Pause nicht springen
    // Leistung beobachten: unter ~40 fps → Sparmodus (weniger Partikel, schwächerer Schein)
    if (dt > 1 / 40) langsam += dt; else langsam = Math.max(0, langsam - dt * 0.5);
    if (!FG.sparen && langsam > 2) { FG.sparen = true; groesse(); }
    FG.zeit += dt;
    const sp = FG.zustand === "spiel";
    ctx.setTransform(FG.dpr, 0, 0, FG.dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    zeichneHintergrund(dt);
    ctx.save();
    if (wackeln > 0.2) { ctx.translate(FG.zufall(-wackeln, wackeln), FG.zufall(-wackeln, wackeln)); wackeln *= Math.pow(0.02, dt); } else wackeln = 0;
    if (sp && opt.update) opt.update(dt);
    if (opt.zeichne) opt.zeichne(ctx, dt);
    ctx.translate(-FG.kamera.x, -FG.kamera.y); // Effekte liegen in Spielwelt-Koordinaten
    effekte(dt);
    ctx.restore();
    if (blitz) { ctx.fillStyle = FG.rgba(blitz.farbe, blitz.a); ctx.fillRect(0, 0, FG.W, FG.H); blitz.a -= dt * 1.6; if (blitz.a <= 0) blitz = null; }
    if (opt.vignette !== false) ctx.drawImage(vignette, 0, 0, FG.W, FG.H);
    if (!FG.sparen && opt.scanlines !== false) { ctx.fillStyle = scan; ctx.fillRect(0, 0, FG.W, FG.H); }
    zeiger.neu = false; zeiger.los = false; einmal.clear();
  }

  /** Startet ein Spiel. opt: {id,titel,untertitel,symbol,anleitung,hintergrund,stick,init,update,zeichne,groesse,tippen,sternTempo} */
  FG.spiel = (o) => {
    opt = o; FG.pruefen = o.pruefen || null;
    document.head.insertAdjacentHTML("beforeend", `<style>${CSS}</style>`);
    document.body.insertAdjacentHTML("beforeend", `<canvas id="fg-feld"></canvas><div id="fg-hud"></div><button id="fg-ton" type="button" aria-label="Ton an/aus">${stumm ? "🔇" : "🔊"}</button><div id="fg-stick"><i></i></div><div id="fg-over"></div>`);
    feld = document.getElementById("fg-feld"); ctx = feld.getContext("2d"); FG.ctx = ctx;
    hudEl = document.getElementById("fg-hud"); overlay = document.getElementById("fg-over"); stickEl = document.getElementById("fg-stick");
    document.getElementById("fg-ton").addEventListener("click", (e) => {
      e.stopPropagation(); stumm = !stumm; e.currentTarget.textContent = stumm ? "🔇" : "🔊";
      try { localStorage.setItem("fg-stumm", stumm ? "1" : "0"); } catch (err) { /* egal */ }
      if (!stumm) { audio(); FG.ton("klick"); }
    });
    bauePost(); baueHintergrund(o.hintergrund ?? "sterne");
    window.addEventListener("resize", groesse); groesse();

    const pos = (e) => { zeiger.x = e.clientX; zeiger.y = e.clientY; };
    feld.addEventListener("pointerdown", (e) => {
      audio(); pos(e); zeiger.unten = true; zeiger.neu = true; zeiger.id = e.pointerId;
      if (o.stick && e.pointerType !== "mouse" && FG.zustand === "spiel") { Object.assign(stick, { an: true, ox: e.clientX, oy: e.clientY, x: 0, y: 0, id: e.pointerId }); stickEl.style.display = "block"; stickEl.style.left = e.clientX + "px"; stickEl.style.top = e.clientY + "px"; }
      if (FG.zustand === "spiel" && o.tippen) o.tippen(zeiger.x, zeiger.y, e);
    });
    feld.addEventListener("pointermove", (e) => {
      pos(e);
      if (stick.an && e.pointerId === stick.id) {
        const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, l = Math.hypot(dx, dy), m = Math.min(l, 48);
        stick.x = l ? (dx / l) * (m / 48) : 0; stick.y = l ? (dy / l) * (m / 48) : 0;
        stickEl.firstChild.style.transform = `translate(${stick.x * 40}px,${stick.y * 40}px)`;
      }
      if (o.ziehen && zeiger.unten) o.ziehen(zeiger.x, zeiger.y, e);
    });
    const hoch = (e) => {
      if (e.pointerId === stick.id) { stick.an = false; stick.x = stick.y = 0; stickEl.style.display = "none"; stickEl.firstChild.style.transform = ""; }
      zeiger.unten = false; zeiger.los = true; if (o.loslassen) o.loslassen(e.clientX, e.clientY, e);
    };
    feld.addEventListener("pointerup", hoch); feld.addEventListener("pointercancel", hoch);
    document.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k.startsWith("arrow") || k === " ") e.preventDefault();
      if (!tasten.has(k)) einmal.add(k);
      tasten.add(k); audio();
      if ((k === " " || k === "enter") && FG.zustand !== "spiel" && !overlay.classList.contains("weg")) { los(); return; }
      if (FG.zustand === "spiel" && o.taste) o.taste(k, e);
    });
    document.addEventListener("keyup", (e) => tasten.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => tasten.clear());
    document.addEventListener("visibilitychange", () => { letzt = 0; });

    o.init && o.init();
    startKarte();
    requestAnimationFrame(schleife);
  };
  window.FG = FG;
})();
