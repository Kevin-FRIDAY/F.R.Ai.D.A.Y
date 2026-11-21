// F.R.Ai.D.A.Y Klang-Bilder (v1.129.0): zu jedem Stimmungs-Sound eine bewegte Szene.
// Regen über der Stadt, Gewitter mit Blitzen, Kaminfeuer, Meer im Sonnenuntergang, Wald, Schnee, Café, Zug …
// Alles wird live auf einer Leinwand (Canvas) gemalt: kein Download, keine fremden Bilder, läuft auch offline.
// Nutzung: const b = FridayKlangBild.neu(canvas); b.setze("regen"); b.ereignis("blitz"); b.foto(true); b.stop();
(() => {
  "use strict";
  const fluessig = () => document.documentElement.classList.contains("perf-fluessig");
  const reduziert = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const R = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  // ---------- kleine Mal-Helfer ----------
  function verlauf(c, H, stops, y0 = 0, y1 = H) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([p, f]) => g.addColorStop(p, f));
    return g;
  }
  function himmel(c, W, H, stops) { c.fillStyle = verlauf(c, H, stops); c.fillRect(0, 0, W, H); }
  function leuchte(c, x, y, r, farbe, a = 1) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, farbe); g.addColorStop(1, "rgba(0,0,0,0)");
    c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1;
  }
  function vignette(c, W, H, a = 0.55) {
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${a})`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  // Bergkamm aus überlagerten Sinuswellen
  function kamm(seed, n = 4) { const w = []; for (let i = 0; i < n; i++) w.push([R(0.6, 3.2) * (i + 1), R(0, TAU), R(0.3, 1) / (i + 1)]); return w; }
  function kammY(k, x) { let y = 0; for (const [f, p, a] of k) y += Math.sin(x * f + p) * a; return y; }
  function berge(c, W, H, k, basis, hoehe, farbe, versatz = 0) {
    c.fillStyle = farbe; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, basis - hoehe * (0.6 + 0.4 * kammY(k, (x + versatz) / W * 3)));
    c.lineTo(W, H); c.closePath(); c.fill();
  }
  function tanne(c, x, y, h, farbe, schnee) {
    c.fillStyle = farbe; c.beginPath();
    for (let i = 0; i < 3; i++) { const yy = y - h * (0.25 + i * 0.28), b = h * (0.34 - i * 0.08); c.moveTo(x, yy - h * 0.32); c.lineTo(x - b, yy + h * 0.12); c.lineTo(x + b, yy + h * 0.12); }
    c.fill(); c.fillRect(x - h * 0.03, y - h * 0.15, h * 0.06, h * 0.15);
    if (schnee) { c.fillStyle = "rgba(235,245,255,.85)"; for (let i = 0; i < 3; i++) { const yy = y - h * (0.25 + i * 0.28), b = h * (0.34 - i * 0.08); c.beginPath(); c.moveTo(x, yy - h * 0.32); c.lineTo(x - b * 0.45, yy - h * 0.12); c.lineTo(x + b * 0.45, yy - h * 0.12); c.fill(); } }
  }
  function regenTropfen(s, W, H, n, schraeg) {
    s.tropfen = Array.from({ length: n }, () => ({ x: R(-W * 0.2, W * 1.1), y: R(-H, H), l: R(10, 26), v: R(700, 1100), a: R(0.15, 0.45) }));
    s.spritzer = []; s.schraeg = schraeg;
  }
  function malRegen(c, s, W, H, dt, boden) {
    c.lineCap = "round";
    for (const d of s.tropfen) {
      d.y += d.v * dt; d.x += d.v * dt * s.schraeg;
      if (d.y > boden) { if (Math.random() < 0.3) s.spritzer.push({ x: d.x, y: boden + R(0, H - boden), r: 0, a: 0.5 }); d.y = R(-60, -10); d.x = R(-W * 0.2, W * 1.05); }
      c.strokeStyle = `rgba(190,215,255,${d.a})`; c.lineWidth = 1.1;
      c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(d.x - d.l * s.schraeg, d.y - d.l); c.stroke();
    }
    c.lineWidth = 1;
    s.spritzer = s.spritzer.filter((p) => { p.r += 40 * dt; p.a -= 1.4 * dt; if (p.a <= 0) return false; c.strokeStyle = `rgba(200,225,255,${p.a})`; c.beginPath(); c.ellipse(p.x, p.y, p.r, p.r * 0.3, 0, 0, TAU); c.stroke(); return true; });
  }
  function glasTropfen(s, W, H, n) { s.glas = Array.from({ length: n }, () => ({ x: R(0, W), y: R(0, H), r: R(1.5, 5), v: Math.random() < 0.2 ? R(8, 40) : 0 })); }
  function malGlas(c, s, W, H, dt) {
    for (const g of s.glas) {
      g.y += g.v * dt; if (g.y > H + 6) { g.y = -6; g.x = R(0, W); }
      if (g.v && Math.random() < 0.002) g.v = 0; else if (!g.v && Math.random() < 0.0008) g.v = R(15, 50);
      c.fillStyle = "rgba(170,200,240,.16)"; c.beginPath(); c.arc(g.x, g.y, g.r, 0, TAU); c.fill();
      c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.arc(g.x - g.r * 0.3, g.y - g.r * 0.35, g.r * 0.3, 0, TAU); c.fill();
    }
  }
  function stadt(s, W, H) {
    s.haeuser = []; let x = -10;
    while (x < W + 20) { const b = R(28, 70), h = R(H * 0.12, H * 0.42); s.haeuser.push({ x, b, h, f: Array.from({ length: 30 }, () => Math.random() < 0.35) }); x += b + R(2, 8); }
  }
  function malStadt(c, s, W, H, boden, farbe, t) {
    for (const h of s.haeuser) {
      c.fillStyle = farbe; c.fillRect(h.x, boden - h.h, h.b, h.h);
      let i = 0;
      for (let yy = boden - h.h + 8; yy < boden - 8; yy += 14) for (let xx = h.x + 5; xx < h.x + h.b - 6; xx += 11) {
        const an = h.f[i++ % h.f.length] && Math.sin(t * 0.2 + xx * 0.7 + yy) > -0.95;
        if (an) { c.fillStyle = "rgba(255,170,80,.55)"; c.fillRect(xx, yy, 5, 7); }
      }
    }
  }
  function blitzPfad(W, H) {
    const p = [[R(W * 0.15, W * 0.85), 0]]; let [x, y] = p[0];
    while (y < H * 0.62) { x += R(-35, 35); y += R(14, 40); p.push([x, y]); }
    return p;
  }

  // ---------- die Szenen ----------
  // init(s,W,H): einmal; mal(c,s,W,H,t,dt): jedes Bild. wetter: Szene malt im Foto-Modus ihr Wetter über das Foto.
  const SZENEN = {
    regen: {
      titel: "Regen über der Stadt", wetter: true,
      init(s, W, H) { stadt(s, W, H); regenTropfen(s, W, H, fluessig() ? 130 : 260, 0.12); glasTropfen(s, W, H, 45); },
      mal(c, s, W, H, t, dt, foto) {
        const boden = H * 0.8;
        if (!foto) {
          himmel(c, W, H, [[0, "#0a121d"], [0.55, "#1a2838"], [1, "#0c1219"]]);
          leuchte(c, W * 0.7, boden - H * 0.2, W * 0.5, "rgba(255,138,30,.10)");
          malStadt(c, s, W, H, boden, "#070b11", t);
          c.fillStyle = verlauf(c, H, [[0, "rgba(255,150,60,.14)"], [1, "rgba(10,14,20,.9)"]], boden, H); c.fillRect(0, boden, W, H - boden);
          c.fillStyle = "rgba(120,150,190,.06)"; c.fillRect(0, boden - H * 0.18, W, H * 0.18);
        }
        malRegen(c, s, W, H, dt, foto ? H : boden); malGlas(c, s, W, H, dt);
      },
    },
    gewitter: {
      titel: "Gewitter in der Nacht", wetter: true,
      init(s, W, H) { stadt(s, W, H); regenTropfen(s, W, H, fluessig() ? 180 : 340, 0.22); glasTropfen(s, W, H, 30); s.blitz = 0; s.pfad = null; s.naechster = 4; },
      ereignis(s, W, H, art) { if (art === "blitz") { s.blitz = 1; s.pfad = blitzPfad(W, H); s.naechster = 999; } },
      mal(c, s, W, H, t, dt, foto) {
        const boden = H * 0.82;
        s.naechster -= dt; if (s.naechster <= 0) { s.blitz = 1; s.pfad = blitzPfad(W, H); s.naechster = R(6, 14); }
        if (!foto) {
          himmel(c, W, H, [[0, "#05070d"], [0.6, "#121a2a"], [1, "#05070b"]]);
          c.fillStyle = "rgba(60,70,95,.35)"; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse((i * W / 4 + t * 12) % (W * 1.4) - W * 0.2, H * (0.12 + (i % 2) * 0.08), W * 0.28, H * 0.08, 0, 0, TAU); c.fill(); }
          malStadt(c, s, W, H, boden, "#04060a", t);
          c.fillStyle = "#06080c"; c.fillRect(0, boden, W, H - boden);
        }
        if (s.blitz > 0.02 && s.pfad) {
          c.save(); c.shadowColor = "#bcd4ff"; c.shadowBlur = 24; c.strokeStyle = `rgba(235,242,255,${s.blitz})`; c.lineWidth = 2.4;
          c.beginPath(); s.pfad.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.restore();
          c.fillStyle = `rgba(200,215,255,${s.blitz * 0.35})`; c.fillRect(0, 0, W, H);
          s.blitz *= Math.pow(0.02, dt);
        }
        malRegen(c, s, W, H, dt, foto ? H : boden); malGlas(c, s, W, H, dt);
      },
    },
    meer: {
      titel: "Meer im Sonnenuntergang",
      init(s) { s.kaemme = [0, 1, 2, 3, 4, 5].map(() => kamm(0, 3)); },
      mal(c, s, W, H, t) {
        const hor = H * 0.5;
        himmel(c, W, H, [[0, "#140a2a"], [0.35, "#5a1f3c"], [0.5, "#ff7a2a"], [0.5, "#1a2140"], [1, "#05070f"]]);
        leuchte(c, W * 0.5, hor, H * 0.5, "rgba(255,150,60,.55)");
        c.fillStyle = "#ffcf7a"; c.beginPath(); c.arc(W * 0.5, hor, H * 0.09, Math.PI, 0); c.fill();
        for (let i = 0; i < 14; i++) { const y = hor + 6 + i * i * 1.3, w = (W * 0.18) * (1 - i / 16) * (0.7 + 0.3 * Math.sin(t * 2 + i)); c.fillStyle = `rgba(255,190,110,${0.5 - i * 0.03})`; c.fillRect(W * 0.5 - w / 2, y, w, 2); }
        s.kaemme.forEach((k, i) => {
          const y0 = hor + (H - hor) * (0.12 + i * 0.17), amp = 3 + i * 4;
          c.fillStyle = `rgba(${14 + i * 4},${24 + i * 6},${52 + i * 8},.8)`; c.beginPath(); c.moveTo(0, H);
          for (let x = 0; x <= W + 10; x += 10) c.lineTo(x, y0 + Math.sin(x / (60 + i * 25) + t * (0.6 + i * 0.15)) * amp + kammY(k, x / W * 2) * amp * 0.4);
          c.lineTo(W, H); c.fill();
          c.strokeStyle = `rgba(255,200,150,${0.12 + i * 0.03})`; c.lineWidth = 1; c.beginPath();
          for (let x = 0; x <= W + 10; x += 10) { const y = y0 + Math.sin(x / (60 + i * 25) + t * (0.6 + i * 0.15)) * amp + kammY(k, x / W * 2) * amp * 0.4; x ? c.lineTo(x, y) : c.moveTo(x, y); }
          c.stroke();
        });
      },
    },
    wald: {
      titel: "Wald mit Vögeln",
      init(s, W, H) { s.reihen = [0, 1, 2].map((r) => Array.from({ length: 14 + r * 6 }, () => ({ x: R(-20, W + 20), h: R(H * (0.3 + r * 0.12), H * (0.45 + r * 0.15)) })).sort((a, b) => a.x - b.x)); s.staub = Array.from({ length: fluessig() ? 30 : 60 }, () => ({ x: R(0, W), y: R(0, H), p: R(0, TAU) })); s.voegel = []; },
      mal(c, s, W, H, t, dt) {
        himmel(c, W, H, [[0, "#c8e6a0"], [0.25, "#4c8a55"], [0.7, "#0f2a1a"], [1, "#04100a"]]);
        c.save(); c.globalCompositeOperation = "lighter";
        for (let i = 0; i < 5; i++) { const x = W * (0.1 + i * 0.12) + Math.sin(t * 0.2 + i) * 10; c.fillStyle = "rgba(255,240,180,.06)"; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 40, 0); c.lineTo(x + W * 0.35, H); c.lineTo(x + W * 0.22, H); c.fill(); }
        c.restore();
        ["#1f4a2c", "#11301c", "#06180d"].forEach((f, r) => s.reihen[r].forEach((b) => tanne(c, b.x, H * (0.86 + r * 0.06), b.h, f)));
        for (const p of s.staub) { p.y -= 6 * dt; p.x += Math.sin(t + p.p) * 6 * dt; if (p.y < 0) p.y = H; c.fillStyle = `rgba(255,230,150,${0.3 + 0.3 * Math.sin(t * 2 + p.p)})`; c.fillRect(p.x, p.y, 2, 2); }
        if (Math.random() < dt * 0.25) s.voegel.push({ x: -20, y: R(H * 0.1, H * 0.35), v: R(60, 110), p: 0 });
        c.strokeStyle = "#0a1a10"; c.lineWidth = 1.6;
        s.voegel = s.voegel.filter((v) => { v.x += v.v * dt; v.p += dt * 9; const f = Math.sin(v.p) * 5; c.beginPath(); c.moveTo(v.x - 7, v.y - f); c.quadraticCurveTo(v.x - 3, v.y - 2, v.x, v.y); c.quadraticCurveTo(v.x + 3, v.y - 2, v.x + 7, v.y - f); c.stroke(); return v.x < W + 20; });
      },
    },
    kamin: {
      titel: "Knisterndes Kaminfeuer",
      init(s) { s.flammen = []; s.funken = []; },
      mal(c, s, W, H, t, dt) {
        const fx = W / 2, fb = Math.min(W * 0.6, H * 1.05), fh = fb * 0.62, x0 = fx - fb / 2, y0 = H * 0.18, boden = y0 + fh;
        const flacker = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
        himmel(c, W, H, [[0, "#140803"], [1, "#050201"]]);
        leuchte(c, fx, boden - fh * 0.2, W * 0.7, "rgba(255,110,20,.35)", flacker);
        // Steinwand
        c.fillStyle = "#2a150a"; c.fillRect(x0 - fb * 0.12, y0 - fb * 0.1, fb * 1.24, fh + fb * 0.1);
        c.strokeStyle = "rgba(0,0,0,.45)"; c.lineWidth = 2;
        for (let yy = y0 - fb * 0.1, r = 0; yy < boden; yy += 18, r++) { c.beginPath(); c.moveTo(x0 - fb * 0.12, yy); c.lineTo(x0 + fb * 1.12, yy); c.stroke(); for (let xx = x0 - fb * 0.12 + (r % 2) * 20; xx < x0 + fb * 1.12; xx += 40) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + 18); c.stroke(); } }
        c.fillStyle = "#3a1d0c"; c.fillRect(x0 - fb * 0.18, y0 - fb * 0.14, fb * 1.36, fb * 0.06);
        // Öffnung
        c.fillStyle = "#070302"; c.beginPath(); c.moveTo(x0 + fb * 0.1, boden); c.lineTo(x0 + fb * 0.1, y0 + fh * 0.35); c.quadraticCurveTo(fx, y0 + fh * 0.05, x0 + fb * 0.9, y0 + fh * 0.35); c.lineTo(x0 + fb * 0.9, boden); c.fill();
        leuchte(c, fx, boden - fh * 0.15, fb * 0.45, "rgba(255,120,30,.45)", flacker);
        // Flammen
        const n = fluessig() ? 3 : 6;
        for (let i = 0; i < n; i++) s.flammen.push({ x: fx + R(-fb * 0.22, fb * 0.22), y: boden - fh * 0.1, r: R(fb * 0.04, fb * 0.08), v: R(fh * 0.5, fh * 0.9), l: 1 });
        if (Math.random() < dt * 8) s.funken.push({ x: fx + R(-fb * 0.15, fb * 0.15), y: boden - fh * 0.2, vx: R(-20, 20), vy: R(-fh * 0.9, -fh * 0.5), l: 1 });
        c.save(); c.globalCompositeOperation = "lighter";
        s.flammen = s.flammen.filter((f) => {
          f.y -= f.v * dt; f.l -= dt * 1.5; f.x += Math.sin(t * 6 + f.y * 0.05) * 20 * dt; if (f.l <= 0) return false;
          const r = f.r * f.l, g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 2);
          g.addColorStop(0, `rgba(255,${180 + 70 * f.l},${80 * f.l},${0.5 * f.l})`); g.addColorStop(0.5, `rgba(255,${70 + 60 * f.l},10,${0.25 * f.l})`); g.addColorStop(1, "rgba(120,20,0,0)");
          c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, r * 2, 0, TAU); c.fill(); return true;
        });
        s.funken = s.funken.filter((p) => { p.x += p.vx * dt + Math.sin(t * 8 + p.y) * 0.6; p.y += p.vy * dt; p.l -= dt * 0.8; if (p.l <= 0 || p.y < y0) return false; c.fillStyle = `rgba(255,200,120,${p.l})`; c.fillRect(p.x, p.y, 2, 2); return true; });
        c.restore();
        // Holzscheite
        c.fillStyle = "#3b200f"; c.save(); c.translate(fx, boden - fb * 0.03);
        [[-0.12, 0.25], [0.12, -0.25], [0, 0]].forEach(([dx, rot]) => { c.save(); c.translate(dx * fb, 0); c.rotate(rot); c.beginPath(); if (c.roundRect) c.roundRect(-fb * 0.2, -fb * 0.035, fb * 0.4, fb * 0.07, fb * 0.035); else c.rect(-fb * 0.2, -fb * 0.035, fb * 0.4, fb * 0.07); c.fill(); c.fillStyle = `rgba(255,90,20,${0.4 * flacker})`; c.fillRect(-fb * 0.15, -fb * 0.035, fb * 0.3, 3); c.fillStyle = "#3b200f"; c.restore(); });
        c.restore();
        c.fillStyle = "#120904"; c.fillRect(0, boden + fb * 0.01, W, H - boden);
        c.fillStyle = verlauf(c, H, [[0, `rgba(255,110,30,${0.18 * flacker})`], [1, "rgba(0,0,0,0)"]], boden, H); c.fillRect(0, boden, W, H - boden);
      },
    },
    fokus: {
      titel: "Fokus-Raum",
      init() {},
      mal(c, s, W, H, t) {
        himmel(c, W, H, [[0, "#0a0603"], [1, "#030201"]]);
        c.strokeStyle = "rgba(255,138,30,.07)"; c.lineWidth = 1;
        for (let x = (t * 6) % 32; x < W; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
        for (let y = 0; y < H; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
        const cx = W / 2, cy = H / 2;
        leuchte(c, cx, cy, H * 0.6, "rgba(255,138,30,.18)");
        for (let i = 0; i < 5; i++) { const r = ((t * 14 + i * 40) % 200) / 200; c.strokeStyle = `rgba(255,150,50,${0.5 * (1 - r)})`; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, 20 + r * Math.min(W, H) * 0.5, 0, TAU); c.stroke(); }
        c.strokeStyle = "rgba(255,190,120,.8)"; c.lineWidth = 1.5; c.beginPath();
        for (let x = 0; x <= W; x += 4) { const y = cy + Math.sin(x * 0.02 + t) * 6 * Math.sin(t * 0.3) + Math.sin(x * 0.11 - t * 2) * 3 + (Math.random() - 0.5) * 2; x ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
        c.fillStyle = "#ffcf9a"; c.font = `600 ${Math.max(11, H * 0.04)}px ui-monospace, Menlo, monospace`; c.textAlign = "center";
        c.fillText("DEEP WORK · " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }), cx, cy + H * 0.3);
      },
    },
    nacht: {
      titel: "Sommernacht auf der Wiese",
      init(s, W, H) { s.sterne = Array.from({ length: 220 }, () => ({ x: R(0, W), y: R(0, H * 0.7), r: R(0.3, 1.4), p: R(0, TAU) })); s.halme = Array.from({ length: Math.floor(W / 4) }, (_, i) => ({ x: i * 4 + R(-2, 2), h: R(H * 0.06, H * 0.16), p: R(0, TAU) })); s.gluehen = Array.from({ length: 22 }, () => ({ x: R(0, W), y: R(H * 0.6, H * 0.95), p: R(0, TAU) })); s.schnuppe = null; },
      mal(c, s, W, H, t, dt) {
        himmel(c, W, H, [[0, "#02040c"], [0.7, "#0d1a36"], [1, "#071022"]]);
        for (const p of s.sterne) { c.fillStyle = `rgba(230,240,255,${0.4 + 0.5 * Math.abs(Math.sin(t * 0.8 + p.p))})`; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }
        const mx = W * 0.78, my = H * 0.2, mr = H * 0.07;
        leuchte(c, mx, my, mr * 5, "rgba(200,220,255,.22)");
        c.fillStyle = "#f1f4ff"; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
        c.fillStyle = "#0a1428"; c.beginPath(); c.arc(mx + mr * 0.45, my - mr * 0.2, mr * 0.9, 0, TAU); c.fill();
        if (!s.schnuppe && Math.random() < dt * 0.08) s.schnuppe = { x: R(0, W * 0.6), y: R(0, H * 0.3), l: 1 };
        if (s.schnuppe) { const q = s.schnuppe; q.x += 420 * dt; q.y += 160 * dt; q.l -= dt * 1.2; c.strokeStyle = `rgba(255,255,255,${q.l})`; c.lineWidth = 1.5; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - 60, q.y - 23); c.stroke(); if (q.l <= 0) s.schnuppe = null; }
        c.fillStyle = "#050a10"; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 20) c.lineTo(x, H * 0.86 + Math.sin(x * 0.01) * 8); c.lineTo(W, H); c.fill();
        c.strokeStyle = "#050a10"; c.lineWidth = 1.4;
        for (const g of s.halme) { const w = Math.sin(t * 1.2 + g.p) * 4; c.beginPath(); c.moveTo(g.x, H); c.quadraticCurveTo(g.x, H - g.h * 0.6, g.x + w, H * 0.88 - g.h + 10); c.stroke(); }
        for (const g of s.gluehen) { g.x += Math.sin(t * 0.5 + g.p) * 0.3; g.y += Math.cos(t * 0.4 + g.p) * 0.2; leuchte(c, g.x, g.y, 9, "rgba(200,255,120,.9)", Math.max(0, Math.sin(t * 1.3 + g.p))); }
      },
    },
    weltraum: {
      titel: "Tiefer Weltraum",
      init(s, W, H) { s.sterne = Array.from({ length: fluessig() ? 160 : 320 }, () => ({ x: R(0, W), y: R(0, H), z: R(0.2, 1) })); },
      mal(c, s, W, H, t, dt) {
        c.fillStyle = "#020208"; c.fillRect(0, 0, W, H);
        c.save(); c.globalCompositeOperation = "lighter";
        leuchte(c, W * (0.3 + 0.05 * Math.sin(t * 0.05)), H * 0.4, W * 0.4, "rgba(140,60,255,.25)");
        leuchte(c, W * 0.55, H * 0.65, W * 0.35, "rgba(40,120,255,.18)");
        leuchte(c, W * 0.2, H * 0.75, W * 0.25, "rgba(255,110,30,.16)");
        c.restore();
        for (const p of s.sterne) { p.x -= p.z * 8 * dt; if (p.x < 0) p.x = W; c.fillStyle = `rgba(255,255,255,${p.z})`; c.fillRect(p.x, p.y, p.z * 1.6, p.z * 1.6); }
        const px = W * 0.74, py = H * 0.55, pr = Math.min(W, H) * 0.2;
        c.strokeStyle = "rgba(255,200,150,.35)"; c.lineWidth = pr * 0.08; c.beginPath(); c.ellipse(px, py, pr * 1.8, pr * 0.42, -0.35, Math.PI, TAU); c.stroke();
        const g = c.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
        g.addColorStop(0, "#ffb070"); g.addColorStop(0.6, "#9a3d20"); g.addColorStop(1, "#1a0806");
        c.fillStyle = g; c.beginPath(); c.arc(px, py, pr, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(px, py, pr * 1.8, pr * 0.42, -0.35, 0, Math.PI); c.stroke();
      },
    },
    puls: {
      titel: "Energie-Puls",
      init(s) { s.ringe = []; s.letzter = -1; },
      mal(c, s, W, H, t, dt) {
        himmel(c, W, H, [[0, "#12031c"], [0.55, "#2a0830"], [0.55, "#0a0210"], [1, "#000"]]);
        const hor = H * 0.55;
        leuchte(c, W / 2, hor, H * 0.6, "rgba(255,80,160,.25)");
        c.fillStyle = "#ffb040"; c.beginPath(); c.arc(W / 2, hor, H * 0.16, Math.PI, 0); c.fill();
        c.strokeStyle = "rgba(255,90,200,.45)"; c.lineWidth = 1;
        for (let i = 1; i < 14; i++) { const y = hor + Math.pow(i / 14, 2) * (H - hor) + ((t * 40) % 20) * (i / 14); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
        for (let i = -12; i <= 12; i++) { c.beginPath(); c.moveTo(W / 2 + i * 8, hor); c.lineTo(W / 2 + i * W * 0.12, H); c.stroke(); }
        const schlag = Math.floor(t / 0.48);
        if (schlag !== s.letzter) { s.letzter = schlag; s.ringe.push({ r: 0, a: 1 }); }
        const phase = 1 - (t % 0.48) / 0.48;
        s.ringe = s.ringe.filter((r) => { r.r += 260 * dt; r.a -= dt * 1.4; c.strokeStyle = `rgba(255,160,60,${Math.max(0, r.a)})`; c.lineWidth = 2; c.beginPath(); c.arc(W / 2, hor - H * 0.05, r.r, 0, TAU); c.stroke(); return r.a > 0; });
        const n = 24, bw = W / n;
        for (let i = 0; i < n; i++) { const h = (0.2 + 0.8 * Math.abs(Math.sin(i * 1.7 + t * 3))) * phase * H * 0.25 + 4; c.fillStyle = i % 2 ? "rgba(255,138,30,.75)" : "rgba(255,80,180,.7)"; c.fillRect(i * bw + 2, H - h, bw - 4, h); }
      },
    },
    wind: {
      titel: "Wind über den Bergen", wetter: true,
      init(s, W, H) { s.k = [kamm(0, 4), kamm(0, 4), kamm(0, 3)]; s.wolken = Array.from({ length: 6 }, () => ({ x: R(0, W), y: R(H * 0.05, H * 0.35), w: R(W * 0.15, W * 0.35) })); s.streifen = Array.from({ length: 40 }, () => ({ x: R(0, W), y: R(0, H), l: R(30, 120), v: R(250, 500) })); s.halme = Array.from({ length: Math.floor(W / 5) }, (_, i) => ({ x: i * 5, h: R(10, 26), p: R(0, 2) })); },
      mal(c, s, W, H, t, dt, foto) {
        if (!foto) {
          himmel(c, W, H, [[0, "#3a4a66"], [0.5, "#9aa8b8"], [1, "#d8b890"]]);
          for (const w of s.wolken) { w.x += 30 * dt; if (w.x - w.w > W) w.x = -w.w; c.fillStyle = "rgba(230,235,245,.35)"; c.beginPath(); c.ellipse(w.x, w.y, w.w / 2, w.w * 0.12, 0, 0, TAU); c.fill(); }
          berge(c, W, H, s.k[0], H * 0.55, H * 0.25, "#55647a");
          berge(c, W, H, s.k[1], H * 0.7, H * 0.2, "#34404f");
          berge(c, W, H, s.k[2], H * 0.85, H * 0.12, "#1c242c");
          c.strokeStyle = "#2a3a22"; c.lineWidth = 1.5;
          for (const g of s.halme) { const b = (Math.sin(t * 2.2 + g.x * 0.02) + 1) * 6 + 3; c.beginPath(); c.moveTo(g.x, H); c.quadraticCurveTo(g.x + b * 0.4, H - g.h * 0.6, g.x + b, H - g.h); c.stroke(); }
        }
        c.lineWidth = 1.2;
        for (const p of s.streifen) { p.x += p.v * dt; if (p.x - p.l > W) { p.x = -10; p.y = R(0, H); } c.strokeStyle = "rgba(255,255,255,.22)"; c.beginPath(); c.moveTo(p.x, p.y); c.quadraticCurveTo(p.x - p.l / 2, p.y - 6 * Math.sin(t * 3 + p.y), p.x - p.l, p.y); c.stroke(); }
      },
    },
    bach: {
      titel: "Bach im Wald",
      init(s, W, H) { s.baeume = Array.from({ length: 22 }, () => ({ x: R(-20, W + 20), h: R(H * 0.3, H * 0.55) })).sort((a, b) => a.x - b.x); s.steine = Array.from({ length: 9 }, () => ({ x: R(0, W), y: R(H * 0.62, H * 0.95), r: R(10, 26) })); s.linien = Array.from({ length: fluessig() ? 50 : 100 }, () => ({ x: R(0, W), y: R(0, 1), l: R(10, 40), v: R(60, 140) })); },
      mal(c, s, W, H, t, dt) {
        himmel(c, W, H, [[0, "#9fd2a0"], [0.4, "#2f6a40"], [1, "#0b2014"]]);
        s.baeume.forEach((b) => tanne(c, b.x, H * 0.6, b.h, "#123a22"));
        c.fillStyle = "#2c3a20"; c.fillRect(0, H * 0.55, W, H * 0.45);
        const mitte = (x) => H * 0.62 + Math.sin(x / W * 4 + 0.5) * H * 0.06, breit = H * 0.24;
        c.fillStyle = verlauf(c, H, [[0, "#4aa3c8"], [1, "#12425a"]], H * 0.55, H); c.beginPath();
        for (let x = 0; x <= W; x += 10) c.lineTo(x, mitte(x) - breit / 2 + Math.sin(x * 0.03) * 4);
        for (let x = W; x >= 0; x -= 10) c.lineTo(x, mitte(x) + breit / 2 + Math.sin(x * 0.02) * 5);
        c.fill();
        c.lineWidth = 1.4;
        for (const l of s.linien) { l.x += l.v * dt; if (l.x > W + 40) l.x = -40; const y = mitte(l.x) - breit / 2 + l.y * breit; c.strokeStyle = "rgba(220,245,255,.45)"; c.beginPath(); c.moveTo(l.x, y); c.lineTo(l.x + l.l, y + Math.sin(l.x * 0.05 + t) * 2); c.stroke(); }
        for (const st of s.steine) { const y = Math.min(st.y, mitte(st.x) + breit * 0.3); c.fillStyle = "#5a6064"; c.beginPath(); c.ellipse(st.x, y, st.r, st.r * 0.55, 0, 0, TAU); c.fill(); c.strokeStyle = `rgba(255,255,255,${0.35 + 0.25 * Math.sin(t * 4 + st.x)})`; c.beginPath(); c.ellipse(st.x - 3, y + 2, st.r * 1.15, st.r * 0.62, 0, 0.2, Math.PI - 0.2); c.stroke(); }
      },
    },
    schnee: {
      titel: "Winterwald im Schnee", wetter: true,
      init(s, W, H) { s.flocken = Array.from({ length: fluessig() ? 140 : 280 }, () => ({ x: R(0, W), y: R(0, H), r: R(0.8, 3), v: R(20, 60), p: R(0, TAU) })); s.baeume = Array.from({ length: 16 }, () => ({ x: R(-20, W + 20), h: R(H * 0.25, H * 0.5) })).sort((a, b) => a.x - b.x); s.k = kamm(0, 3); },
      mal(c, s, W, H, t, dt, foto) {
        if (!foto) {
          himmel(c, W, H, [[0, "#0a1430"], [0.6, "#2a3d66"], [1, "#4a5f88"]]);
          berge(c, W, H, s.k, H * 0.72, H * 0.12, "#c8d6ec");
          s.baeume.forEach((b, i) => tanne(c, b.x, H * (0.82 + (i % 3) * 0.04), b.h, "#0c2018", true));
          // Hütte mit warmem Licht
          const hx = W * 0.68, hy = H * 0.72, hb = Math.min(W, H) * 0.18;
          c.fillStyle = "#2a1a10"; c.fillRect(hx - hb / 2, hy - hb * 0.55, hb, hb * 0.55);
          c.fillStyle = "#e8f0ff"; c.beginPath(); c.moveTo(hx - hb * 0.62, hy - hb * 0.5); c.lineTo(hx, hy - hb * 0.95); c.lineTo(hx + hb * 0.62, hy - hb * 0.5); c.fill();
          c.fillStyle = "#ffb050"; c.fillRect(hx - hb * 0.3, hy - hb * 0.4, hb * 0.18, hb * 0.16); c.fillRect(hx + hb * 0.1, hy - hb * 0.4, hb * 0.18, hb * 0.16);
          leuchte(c, hx, hy - hb * 0.3, hb * 1.2, "rgba(255,150,60,.25)");
          c.fillStyle = "#dfe8f6"; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 20) c.lineTo(x, H * 0.88 + Math.sin(x * 0.012) * 6); c.lineTo(W, H); c.fill();
        }
        for (const f of s.flocken) { f.y += f.v * dt; f.x += Math.sin(t + f.p) * 18 * dt; if (f.y > H) { f.y = -4; f.x = R(0, W); } c.fillStyle = "rgba(255,255,255,.85)"; c.beginPath(); c.arc(f.x, f.y, f.r, 0, TAU); c.fill(); }
      },
    },
    cafe: {
      titel: "Gemütliches Café",
      init(s, W, H) { s.bokeh = Array.from({ length: 26 }, () => ({ x: R(W * 0.05, W * 0.95), y: R(H * 0.08, H * 0.55), r: R(6, 22), f: Math.random() < 0.6 ? "255,170,80" : "255,220,160", p: R(0, TAU) })); },
      mal(c, s, W, H, t) {
        himmel(c, W, H, [[0, "#2a160a"], [1, "#0e0703"]]);
        c.fillStyle = "#101820"; c.fillRect(W * 0.04, H * 0.06, W * 0.92, H * 0.56);
        c.save(); c.globalCompositeOperation = "lighter";
        for (const b of s.bokeh) leuchte(c, b.x, b.y, b.r * 2, `rgba(${b.f},.55)`, 0.6 + 0.4 * Math.sin(t * 0.7 + b.p));
        c.restore();
        c.strokeStyle = "#3a2414"; c.lineWidth = 8; c.strokeRect(W * 0.04, H * 0.06, W * 0.92, H * 0.56); c.beginPath(); c.moveTo(W / 2, H * 0.06); c.lineTo(W / 2, H * 0.62); c.stroke();
        for (const lx of [0.25, 0.75]) { c.strokeStyle = "#1a0e06"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(W * lx, 0); c.lineTo(W * lx, H * 0.12); c.stroke(); c.fillStyle = "#c27a2c"; c.beginPath(); c.arc(W * lx, H * 0.15, H * 0.04, Math.PI, 0); c.fill(); leuchte(c, W * lx, H * 0.18, H * 0.25, "rgba(255,170,70,.35)"); }
        c.fillStyle = "#4a2a14"; c.fillRect(0, H * 0.7, W, H * 0.3);
        c.fillStyle = "#5c361b"; c.fillRect(0, H * 0.7, W, 6);
        const cx = W * 0.5, cy = H * 0.78, cr = Math.min(W, H) * 0.09;
        c.fillStyle = "#e8e0d6"; c.beginPath(); c.ellipse(cx, cy + cr * 0.95, cr * 1.6, cr * 0.3, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(cx - cr, cy); c.lineTo(cx - cr * 0.8, cy + cr * 0.9); c.lineTo(cx + cr * 0.8, cy + cr * 0.9); c.lineTo(cx + cr, cy); c.fill();
        c.strokeStyle = "#e8e0d6"; c.lineWidth = cr * 0.18; c.beginPath(); c.arc(cx + cr * 1.05, cy + cr * 0.4, cr * 0.32, -1.3, 1.3); c.stroke();
        c.fillStyle = "#3a1e0c"; c.beginPath(); c.ellipse(cx, cy, cr, cr * 0.22, 0, 0, TAU); c.fill();
        c.lineWidth = 2;
        for (let i = 0; i < 3; i++) { c.strokeStyle = `rgba(255,255,255,${0.18 + 0.08 * Math.sin(t + i)})`; c.beginPath(); for (let k = 0; k < 20; k++) { const y = cy - k * cr * 0.12, x = cx + (i - 1) * cr * 0.35 + Math.sin(k * 0.5 - t * 2 + i) * cr * 0.18; k ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
      },
    },
    zug: {
      titel: "Zugfahrt durchs Land",
      init(s, W, H) { s.k = [kamm(0, 3), kamm(0, 3)]; s.weg = 0; s.baeume = Array.from({ length: 10 }, () => ({ x: R(0, W * 2), h: R(H * 0.15, H * 0.3) })); },
      mal(c, s, W, H, t, dt) {
        s.weg += dt;
        const ruck = Math.abs(Math.sin(t * Math.PI / 1.1)) > 0.985 ? 1.5 : 0;
        c.save(); c.translate(0, ruck);
        himmel(c, W, H, [[0, "#6a9fd0"], [0.5, "#f0c890"], [1, "#6a8a4a"]]);
        berge(c, W, H, s.k[0], H * 0.6, H * 0.15, "#7f9ab0", s.weg * 8);
        berge(c, W, H, s.k[1], H * 0.72, H * 0.12, "#4f7a48", s.weg * 40);
        c.fillStyle = "#3f6a32"; c.fillRect(0, H * 0.72, W, H * 0.3);
        for (const b of s.baeume) { const x = ((b.x - s.weg * 260) % (W * 2) + W * 2) % (W * 2) - W * 0.3; tanne(c, x, H * 0.85, b.h, "#1f3a18"); }
        const abst = W * 0.6, off = (s.weg * 520) % abst;
        c.strokeStyle = "#222"; c.lineWidth = 1;
        for (let x = -off; x < W + abst; x += abst) { c.fillStyle = "#2a2a2a"; c.fillRect(x, H * 0.2, 5, H * 0.7); c.beginPath(); c.moveTo(x, H * 0.24); c.quadraticCurveTo(x + abst / 2, H * 0.32, x + abst, H * 0.24); c.stroke(); }
        c.restore();
        // Fensterrahmen
        c.fillStyle = "#1a1d22"; const rb = Math.min(W, H) * 0.06;
        c.fillRect(0, 0, W, rb); c.fillRect(0, H - rb * 1.5, W, rb * 1.5); c.fillRect(0, 0, rb, H); c.fillRect(W - rb, 0, rb, H);
        c.strokeStyle = "rgba(255,255,255,.08)"; c.lineWidth = 2; c.strokeRect(rb, rb, W - 2 * rb, H - 2.5 * rb);
        c.fillStyle = "rgba(255,255,255,.05)"; c.beginPath(); c.moveTo(rb, rb); c.lineTo(W * 0.35, rb); c.lineTo(rb, H * 0.6); c.fill();
      },
    },
    unterwasser: {
      titel: "Unter Wasser",
      init(s, W, H) { s.blasen = Array.from({ length: 50 }, () => ({ x: R(0, W), y: R(0, H), r: R(1.5, 5), v: R(20, 50) })); s.fische = Array.from({ length: 7 }, () => ({ x: R(0, W), y: R(H * 0.2, H * 0.75), v: R(20, 50) * (Math.random() < 0.5 ? -1 : 1), g: R(8, 18) })); s.algen = Array.from({ length: 16 }, () => ({ x: R(0, W), h: R(H * 0.15, H * 0.4), p: R(0, TAU) })); },
      mal(c, s, W, H, t, dt) {
        himmel(c, W, H, [[0, "#1a8fb0"], [0.4, "#064a6a"], [1, "#011420"]]);
        c.save(); c.globalCompositeOperation = "lighter";
        for (let i = 0; i < 6; i++) { const x = W * (i / 6) + Math.sin(t * 0.3 + i) * 30; c.fillStyle = "rgba(170,240,255,.05)"; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 50, 0); c.lineTo(x + 140, H); c.lineTo(x + 60, H); c.fill(); }
        c.restore();
        c.strokeStyle = "rgba(200,250,255,.12)"; c.lineWidth = 2;
        for (let k = 0; k < 3; k++) { c.beginPath(); for (let x = 0; x <= W; x += 12) { const y = 6 + k * 6 + Math.sin(x * 0.04 + t * 1.5 + k) * 3; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
        for (const f of s.fische) {
          f.x += f.v * dt; if (f.x > W + 30) f.x = -30; if (f.x < -30) f.x = W + 30;
          const r = f.v > 0 ? 1 : -1, y = f.y + Math.sin(t + f.x * 0.02) * 4;
          c.fillStyle = "rgba(255,150,60,.85)"; c.beginPath(); c.ellipse(f.x, y, f.g, f.g * 0.45, 0, 0, TAU); c.fill();
          c.beginPath(); c.moveTo(f.x - r * f.g * 0.8, y); c.lineTo(f.x - r * f.g * 1.5, y - f.g * 0.45); c.lineTo(f.x - r * f.g * 1.5, y + f.g * 0.45); c.fill();
        }
        c.fillStyle = "#0a2a24"; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 20) c.lineTo(x, H * 0.93 + Math.sin(x * 0.02) * 6); c.lineTo(W, H); c.fill();
        c.strokeStyle = "#1f6a40"; c.lineWidth = 4; c.lineCap = "round";
        for (const a of s.algen) { const w = Math.sin(t * 0.8 + a.p) * 16; c.beginPath(); c.moveTo(a.x, H); c.bezierCurveTo(a.x + w, H - a.h * 0.3, a.x - w, H - a.h * 0.7, a.x + w * 0.6, H - a.h); c.stroke(); }
        for (const b of s.blasen) { b.y -= b.v * dt; b.x += Math.sin(t * 2 + b.y * 0.05) * 0.4; if (b.y < -5) { b.y = H + 5; b.x = R(0, W); } c.strokeStyle = "rgba(220,250,255,.6)"; c.lineWidth = 1; c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.stroke(); }
      },
    },
    dschungel: {
      titel: "Regenwald",
      init(s, W, H) { s.blaetter = Array.from({ length: fluessig() ? 50 : 90 }, () => ({ x: R(-20, W + 20), y: R(-20, H + 20), l: R(30, 90), w: R(-1.6, 1.6), f: `hsl(${R(110, 150)},${R(40, 65)}%,${R(10, 30)}%)`, p: R(0, TAU) })).sort((a, b) => a.l - b.l); s.tropfen = Array.from({ length: 40 }, () => ({ x: R(0, W), y: R(0, H), v: R(200, 400) })); },
      mal(c, s, W, H, t, dt) {
        himmel(c, W, H, [[0, "#b8e0a0"], [0.5, "#2a6a3a"], [1, "#06180c"]]);
        leuchte(c, W * 0.6, H * 0.2, W * 0.4, "rgba(255,250,200,.3)");
        for (const b of s.blaetter) {
          c.save(); c.translate(b.x, b.y); c.rotate(b.w + Math.sin(t * 0.8 + b.p) * 0.06);
          c.fillStyle = b.f; c.beginPath(); c.ellipse(0, 0, b.l, b.l * 0.32, 0, 0, TAU); c.fill();
          c.strokeStyle = "rgba(255,255,255,.08)"; c.lineWidth = 1; c.beginPath(); c.moveTo(-b.l, 0); c.lineTo(b.l, 0); c.stroke(); c.restore();
        }
        for (let i = 0; i < 3; i++) { c.fillStyle = "rgba(220,240,220,.07)"; c.fillRect(0, H * (0.3 + i * 0.2) + Math.sin(t * 0.2 + i) * 10, W, H * 0.08); }
        c.strokeStyle = "rgba(220,255,230,.4)";
        for (const d of s.tropfen) { d.y += d.v * dt; if (d.y > H) { d.y = -10; d.x = R(0, W); } c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(d.x, d.y - 8); c.stroke(); }
      },
    },
    klangschale: {
      titel: "Klangschale",
      init(s) { s.ringe = []; s.naechster = 0.5; s.punkte = Array.from({ length: 40 }, () => ({ w: R(0, TAU), r: R(0.6, 1.3), v: R(0.05, 0.2) })); },
      ereignis(s, W, H, art) { if (art === "schlag") { s.ringe.push({ r: 0, a: 1 }); s.naechster = 999; } },
      mal(c, s, W, H, t, dt) {
        himmel(c, W, H, [[0, "#140a04"], [1, "#050201"]]);
        const cx = W / 2, cy = H * 0.6, br = Math.min(W, H) * 0.22;
        s.naechster -= dt; if (s.naechster <= 0) { s.ringe.push({ r: 0, a: 1 }); s.naechster = 10; }
        leuchte(c, cx, cy, br * 3, "rgba(255,170,60,.18)");
        s.ringe = s.ringe.filter((r) => { r.r += 60 * dt; r.a -= dt * 0.16; for (let k = 0; k < 3; k++) { c.strokeStyle = `rgba(255,190,100,${Math.max(0, r.a - k * 0.2) * 0.6})`; c.lineWidth = 1.5; c.beginPath(); c.ellipse(cx, cy - br * 0.1, br + r.r + k * 18, (br + r.r + k * 18) * 0.32, 0, 0, TAU); c.stroke(); } return r.a > 0; });
        for (const p of s.punkte) { p.w += p.v * dt; const x = cx + Math.cos(p.w) * br * 1.6 * p.r, y = cy - br * 0.6 + Math.sin(p.w) * br * 0.5 * p.r; c.fillStyle = "rgba(255,210,140,.6)"; c.fillRect(x, y, 2, 2); }
        c.fillStyle = "#4a1a2a"; c.beginPath(); c.ellipse(cx, cy + br * 0.62, br * 1.15, br * 0.3, 0, 0, TAU); c.fill();
        const g = c.createLinearGradient(cx - br, 0, cx + br, 0); g.addColorStop(0, "#6a4010"); g.addColorStop(0.45, "#f0c060"); g.addColorStop(1, "#5a3008");
        c.fillStyle = g; c.beginPath(); c.moveTo(cx - br, cy - br * 0.1); c.quadraticCurveTo(cx - br * 0.9, cy + br * 0.62, cx, cy + br * 0.62); c.quadraticCurveTo(cx + br * 0.9, cy + br * 0.62, cx + br, cy - br * 0.1); c.fill();
        c.fillStyle = "#2a1404"; c.beginPath(); c.ellipse(cx, cy - br * 0.1, br, br * 0.24, 0, 0, TAU); c.fill();
        c.strokeStyle = "#ffd890"; c.lineWidth = 3; c.beginPath(); c.ellipse(cx, cy - br * 0.1, br, br * 0.24, 0, 0, TAU); c.stroke();
      },
    },
    raumschiff: {
      titel: "Brücke des Raumschiffs",
      init(s, W, H) { s.sterne = Array.from({ length: fluessig() ? 120 : 240 }, () => ({ w: R(0, TAU), d: R(0.02, 1), v: R(0.08, 0.25) })); s.lichter = Array.from({ length: 30 }, () => ({ p: R(0, TAU), f: Math.random() < 0.3 ? "#4cc3ff" : "#ff8a1e" })); },
      mal(c, s, W, H, t, dt) {
        c.fillStyle = "#010207"; c.fillRect(0, 0, W, H);
        const cx = W / 2, cy = H * 0.42, M = Math.max(W, H) * 0.8;
        for (const p of s.sterne) { p.d += p.v * dt * (0.4 + p.d); if (p.d > 1) { p.d = 0.02; p.w = R(0, TAU); } const r1 = p.d * M, r2 = Math.max(0, r1 - 8 * p.d * p.d * 30); c.strokeStyle = `rgba(200,225,255,${Math.min(1, 0.25 + p.d * 1.5)})`; c.lineWidth = 0.6 + p.d * 2; c.beginPath(); c.moveTo(cx + Math.cos(p.w) * r2, cy + Math.sin(p.w) * r2); c.lineTo(cx + Math.cos(p.w) * r1, cy + Math.sin(p.w) * r1); c.stroke(); }
        const pg = c.createRadialGradient(cx, H * 1.6, H * 0.6, cx, H * 1.6, H * 1.25); pg.addColorStop(0, "#1a4a8a"); pg.addColorStop(0.92, "#3a8adf"); pg.addColorStop(1, "rgba(80,180,255,0)");
        c.fillStyle = pg; c.beginPath(); c.arc(cx, H * 1.6, H * 1.25, 0, TAU); c.fill();
        // Rahmen der Brücke
        c.fillStyle = "#0b0907"; c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, H); c.lineTo(W * 0.88, H * 0.72); c.lineTo(W * 0.82, H * 0.08); c.lineTo(W * 0.18, H * 0.08); c.lineTo(W * 0.12, H * 0.72); c.lineTo(0, H); c.fill();
        c.fillStyle = "#120d08"; c.beginPath(); c.moveTo(0, H); c.lineTo(W * 0.12, H * 0.72); c.lineTo(W * 0.88, H * 0.72); c.lineTo(W, H); c.fill();
        c.strokeStyle = "rgba(255,138,30,.55)"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(W * 0.12, H * 0.72); c.lineTo(W * 0.18, H * 0.08); c.lineTo(W * 0.82, H * 0.08); c.lineTo(W * 0.88, H * 0.72); c.closePath(); c.stroke();
        s.lichter.forEach((l, i) => { const x = W * 0.16 + (i / s.lichter.length) * W * 0.68, y = H * 0.8 + (i % 3) * H * 0.04; c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + l.p)); c.fillStyle = l.f; c.fillRect(x, y, 6, 3); }); c.globalAlpha = 1;
        c.strokeStyle = "rgba(255,160,60,.6)"; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, Math.min(W, H) * 0.12, t % TAU, t % TAU + 1.4); c.stroke(); c.beginPath(); c.arc(cx, cy, Math.min(W, H) * 0.15, -t * 0.7, -t * 0.7 + 2); c.stroke();
        c.fillStyle = "rgba(255,190,120,.85)"; c.font = `600 ${Math.max(10, H * 0.035)}px ui-monospace, Menlo, monospace`; c.textAlign = "left";
        c.fillText("F.R.Ai.D.A.Y · BRÜCKE", W * 0.15, H * 0.77); c.textAlign = "right"; c.fillText(`KURS ${(t * 3 % 360).toFixed(0).padStart(3, "0")}° · WARP 0.${Math.floor(4 + Math.sin(t * 0.2) * 2)}`, W * 0.85, H * 0.77);
      },
    },
    herz: {
      titel: "Ruhiger Herzschlag",
      init(s) { s.spur = []; },
      mal(c, s, W, H, t, dt) {
        himmel(c, W, H, [[0, "#14030a"], [1, "#040103"]]);
        const ph = t % 1, schlag = Math.max(Math.exp(-Math.pow((ph - 0.02) * 18, 2)), 0.7 * Math.exp(-Math.pow((ph - 0.3) * 18, 2)));
        const cx = W / 2, cy = H * 0.42, sk = Math.min(W, H) * 0.13 * (1 + schlag * 0.12);
        leuchte(c, cx, cy, sk * 4, `rgba(255,60,90,${0.2 + schlag * 0.3})`);
        c.fillStyle = `rgba(255,${70 + schlag * 50},${90 + schlag * 30},.9)`; c.beginPath();
        c.moveTo(cx, cy + sk * 0.9); c.bezierCurveTo(cx - sk * 1.6, cy - sk * 0.1, cx - sk * 0.8, cy - sk * 1.2, cx, cy - sk * 0.4); c.bezierCurveTo(cx + sk * 0.8, cy - sk * 1.2, cx + sk * 1.6, cy - sk * 0.1, cx, cy + sk * 0.9); c.fill();
        // EKG-Linie
        const ekg = (p) => { if (p < 0.02) return 0; if (p < 0.05) return -1; if (p < 0.08) return 0.5; if (p < 0.28) return 0; if (p < 0.31) return -0.6; if (p < 0.34) return 0.3; return 0.03 * Math.sin(p * 20); };
        const y0 = H * 0.8, amp = H * 0.1;
        c.strokeStyle = "rgba(255,150,170,.9)"; c.lineWidth = 2; c.shadowColor = "#ff4060"; c.shadowBlur = 10; c.beginPath();
        for (let x = 0; x <= W; x += 3) { const p = ((t - (W - x) / W * 3) % 1 + 1) % 1; const y = y0 + ekg(p) * amp; x ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke(); c.shadowBlur = 0;
        c.fillStyle = "rgba(255,190,200,.8)"; c.font = `600 ${Math.max(11, H * 0.04)}px ui-monospace, Menlo, monospace`; c.textAlign = "right"; c.fillText("♥ 60 BPM · RUHE", W - 14, H * 0.95);
      },
    },
  };

  // ---------- Leinwand-Steuerung ----------
  function neu(canvas) {
    const c = canvas.getContext("2d");
    let id = null, s = {}, raf = 0, letzt = 0, t0 = performance.now(), W = 0, H = 0, foto = false, laeuft = false;
    function groesse() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(fluessig() ? 1 : 2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (w === W && h === H) return false;
      W = w; H = h; canvas.width = w * dpr; canvas.height = h * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }
    const sichtbar = () => canvas.isConnected && canvas.offsetParent !== null && document.visibilityState !== "hidden";
    function bild(jetzt) {
      raf = 0;
      if (!laeuft) return;
      if (!sichtbar()) { raf = requestAnimationFrame(bild); return; }
      const minAbst = fluessig() ? 1000 / 30 : 0;
      if (jetzt - letzt < minAbst) { raf = requestAnimationFrame(bild); return; }
      const dt = Math.min(0.05, (jetzt - (letzt || jetzt)) / 1000); letzt = jetzt;
      if (groesse() && id) { s = {}; SZENEN[id].init(s, W, H); }
      const t = (jetzt - t0) / 1000;
      c.clearRect(0, 0, W, H);
      if (id) {
        const sz = SZENEN[id];
        if (foto) { if (sz.wetter) sz.mal(c, s, W, H, t, dt, true); vignette(c, W, H, 0.45); }
        else { sz.mal(c, s, W, H, t, dt, false); vignette(c, W, H); }
      }
      if (!reduziert()) raf = requestAnimationFrame(bild);
    }
    function start() { laeuft = true; if (!raf) raf = requestAnimationFrame(bild); }
    return {
      setze(neuId) {
        id = SZENEN[neuId] ? neuId : null; W = 0; H = 0; s = {}; letzt = 0;
        groesse(); if (id) SZENEN[id].init(s, W, H);
        start();
      },
      foto(an) { foto = !!an; start(); },
      ereignis(art) { if (id && SZENEN[id].ereignis) SZENEN[id].ereignis(s, W, H, art); },
      stop() { laeuft = false; if (raf) cancelAnimationFrame(raf); raf = 0; c.clearRect(0, 0, canvas.width, canvas.height); },
      weiter: start,
    };
  }

  window.FridayKlangBild = { neu, titel: (id) => SZENEN[id]?.titel || "", hatWetter: (id) => !!SZENEN[id]?.wetter };
})();
