// F.R.Ai.D.A.Y Stimmungs-Sound (v1.106.0, erweitert in v1.131.0, Klang-Plus v1.145.0)
// 19 Klänge (Regen, Gewitter, Meer, Wald, Bach, Schnee, Wind, Kamin, Café, Zug, Unterwasser, Dschungel, Klangschale,
// Herzschlag, Raumschiff-Brücke, Fokus, Sommernacht, Weltraum, Energie-Puls) – alles live im Browser erzeugt
// (Web Audio, keine Downloads, kein Guthaben). Zu jedem Klang eine bewegte Szene (klangbild.js) oder auf Wunsch
// ein echtes, frei lizenziertes Foto (Openverse). Bei Regen/Gewitter/Schnee: wo auf der Welt es gerade so ist.
// Automatik: Friday passt den Klang an das an, was du GERADE IN FRIDAY machst (welches Fenster offen ist,
// was du Friday sagst oder tippst). Friday liest nichts außerhalb von Friday mit. Während Friday spricht, wird es leiser.
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc } = H;
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* egal */ } },
  };
  const R = (a, b) => a + Math.random() * (b - a);
  const GRUPPEN = { alle: "◈ Alle", wetter: "🌦 Wetter", natur: "🌿 Natur", wasser: "💧 Wasser", gemuetlich: "🔥 Gemütlich", ruhe: "◎ Fokus & Ruhe", scifi: "✦ Sci-Fi" };
  const KLAENGE = {
    regen: { icon: "🌧", name: "Regen", text: "Lesen, Schreiben, Nachdenken", g: "wetter", f: "#5aa8ff" },
    gewitter: { icon: "⛈", name: "Gewitter", text: "Drinnen, gemütlich, Drama", g: "wetter", f: "#9fb4ff" },
    wind: { icon: "🌬", name: "Bergwind", text: "Weite, Freiheit, Klarheit", g: "wetter", f: "#b8c6d6" },
    schnee: { icon: "❄", name: "Winterwald", text: "Stille, Winter, Abschalten", g: "wetter", f: "#dbe8ff" },
    wald: { icon: "🌲", name: "Wald & Vögel", text: "Ruhe, Stress abbauen", g: "natur", f: "#46e08a" },
    dschungel: { icon: "🦜", name: "Regenwald", text: "Abenteuer, Kreativität", g: "natur", f: "#3fd06a" },
    nacht: { icon: "🌙", name: "Sommernacht", text: "Abend, Einschlafen", g: "natur", f: "#8fa8ff" },
    meer: { icon: "🌊", name: "Meer", text: "Reise, Fernweh, Entspannen", g: "wasser", f: "#3fc4ff" },
    bach: { icon: "🏞", name: "Bach im Wald", text: "Frische, Lernen, Lesen", g: "wasser", f: "#6fd8ff" },
    unterwasser: { icon: "🐠", name: "Unterwasser", text: "Abtauchen, Abschalten", g: "wasser", f: "#2fb8c8" },
    kamin: { icon: "🔥", name: "Kaminfeuer", text: "Kochen, gemütlich", g: "gemuetlich", f: "#ff8a1e" },
    cafe: { icon: "☕", name: "Café", text: "Schreiben, Planen, Ideen", g: "gemuetlich", f: "#d9a066" },
    zug: { icon: "🚆", name: "Zugfahrt", text: "Nachdenken, Tagträumen", g: "gemuetlich", f: "#f0c890" },
    fokus: { icon: "🎯", name: "Fokus-Rauschen", text: "Code, Arbeit, Lernen", g: "ruhe", f: "#ffb050" },
    klangschale: { icon: "🔔", name: "Klangschale", text: "Meditation, Atmen, Yoga", g: "ruhe", f: "#ffd24d" },
    herz: { icon: "❤", name: "Herzschlag", text: "Beruhigen, Einschlafen", g: "ruhe", f: "#ff5a7a" },
    weltraum: { icon: "🪐", name: "Weltraum", text: "Weltgeschehen, Sci-Fi", g: "scifi", f: "#b06bff" },
    raumschiff: { icon: "🚀", name: "Raumschiff", text: "Brücke, Jarvis-Modus, Großes planen", g: "scifi", f: "#4cc3ff" },
    puls: { icon: "⚡", name: "Energie-Puls", text: "Spiele, Sport, Motivation", g: "scifi", f: "#ff4fb0" },
  };
  const WO_TEXT = { regen: "regnet", gewitter: "gewittert", schnee: "schneit" };
  // Welches Fenster passt zu welchem Klang?
  const FENSTER_KLANG = { spiele: "puls", lage: "weltraum", zentrale: "raumschiff", brain: "raumschiff", oekosystem: "raumschiff", routen: "zug", kuehl: "kamin", gegen: "regen", dok: "regen", ideen: "cafe", werkstatt: "fokus", webseiten: "fokus", kauf: "fokus", markt: "fokus", logbuch: "regen", archiv: "regen" };
  // Worte in dem, was du zu Friday sagst/tippst
  const WORT_KLANG = [
    ["fokus", /\b(code|programm|programmier|bug|server|javascript|python|lernen|prüfung|pruefung|hausaufgabe|konzentr|arbeit|projekt|excel|präsentation|praesentation)/i],
    ["schnee", /\b(schnee|ski|winterurlaub|schlitten)/i],
    ["zug", /\b(zug|bahn|pendeln|zugfahrt)/i],
    ["meer", /\b(reise|urlaub|flug|strand|meer|insel|hotel|nach (mallorca|italien|spanien|kroatien|griechenland)|ferien)/i],
    ["regen", /\b(buch|lesen|roman|artikel|schreib|text|brief|gedicht|geschichte|entwurf|studie)/i],
    ["cafe", /\b(kaffee|café|cafe|idee|brainstorm|planen)/i],
    ["kamin", /\b(koch|rezept|backen|essen|abendessen|kühlschrank|kuehlschrank|winter|weihnacht|gemütlich|gemuetlich)/i],
    ["herz", /\b(angst|nervös|nervoes|panik|aufgeregt)/i],
    ["nacht", /\b(schlafen|müde|muede|gute nacht|einschlafen|abend)/i],
    ["klangschale", /\b(meditat|atmen|yoga|achtsam)/i],
    ["wald", /\b(stress|gestresst|entspann|wütend|wuetend|genervt|ruhe)/i],
    ["gewitter", /\b(gewitter|sturm|unwetter)/i],
    ["puls", /\b(sport|training|workout|laufen|joggen|party|motivation|spiel)/i],
    ["raumschiff", /\b(jarvis|iron ?man|raumschiff|stark industries)/i],
    ["weltraum", /\b(weltall|weltraum|planet|mars|nasa|iss|sterne|krieg|weltlage|nachrichten)/i],
  ];

  // ---------- Klangerzeugung ----------
  let generation = 0, wechselt = false;
  let ctx = null, haupt = null, master = null, analyse = null, aktiv = null, knoten = [], timer = [], laut = Number(ls.get("friday_klang_laut") || 0.5);
  const auto = () => ls.get("friday_klang_auto") === "1";
  function rauschen(art) {
    const len = ctx.sampleRate * 4, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let l = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (art === "braun") { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; }
      else if (art === "rosa") { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 1.4; }
      else d[i] = w;
    }
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; return s;
  }
  function filter(type, f, q = 0.7) { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function kette(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); knoten.push(...n); return n[n.length - 1]; }
  function lfo(param, f, tiefe, basis) { const o = ctx.createOscillator(); o.frequency.value = f; const g = gain(tiefe); o.connect(g); g.connect(param); param.value = basis; o.start(); knoten.push(o, g); }
  function zufall(fn, min, max) { const t = () => { fn(); timer.push(setTimeout(t, min + Math.random() * (max - min))); }; timer.push(setTimeout(t, min)); }
  function spaeter(fn, ms) { timer.push(setTimeout(fn, ms)); }
  function takt(fn, ms) { fn(); timer.push({ iv: setInterval(fn, ms) }); }
  function ton(f, dauer, typ = "sine", vol = 0.1, ziel = master, fEnde = null) {
    const o = ctx.createOscillator(), g = gain(0), t = ctx.currentTime;
    o.type = typ; o.frequency.setValueAtTime(f, t);
    if (fEnde) o.frequency.exponentialRampToValueAtTime(fEnde, t + dauer);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dauer / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    o.connect(g); g.connect(ziel); o.start(t); o.stop(t + dauer + 0.05);
  }
  function knack(vol = 0.15, f = 1500 + Math.random() * 2500) {
    const s = rauschen("weiss"), g = gain(0), fi = filter("bandpass", f, 2), t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.05);
    s.connect(fi); fi.connect(g); g.connect(master); s.start(t); s.stop(t + 0.12);
  }
  function donner(nah) {
    const s = rauschen("braun"), fi = filter("lowpass", 140 + Math.random() * 140), g = gain(0), t = ctx.currentTime, d = R(3.5, 6);
    g.gain.linearRampToValueAtTime(nah ? 1.1 : 0.7, t + (nah ? 0.05 : 0.4)); g.gain.exponentialRampToValueAtTime(0.35, t + d * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fi); fi.connect(g); g.connect(master); s.start(t); s.stop(t + d + 0.1);
    if (nah) { const k = rauschen("weiss"), kf = filter("highpass", 1200), kg = gain(0.35); kg.gain.setValueAtTime(0.35, t); kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); k.connect(kf); kf.connect(kg); kg.connect(master); k.start(t); k.stop(t + 0.4); }
  }
  // Szene passend zum Klang anstoßen (Blitz, Schlag der Klangschale)
  const szene = (art) => { bildKlein?.ereignis(art); bildGross?.ereignis(art); };
  function regenSchicht(st = 1) { const s = rauschen("rosa"); kette(s, filter("highpass", 500), filter("lowpass", 7000), gain(0.55 * st), master); s.start(); const b = rauschen("braun"); kette(b, filter("lowpass", 300), gain(0.25 * st), master); b.start(); zufall(() => knack(0.05), 60, 260); }
  const BAU = {
    regen() { regenSchicht(); },
    gewitter() {
      regenSchicht(1.25);
      zufall(() => { const nah = Math.random() < 0.35; szene("blitz"); spaeter(() => donner(nah), nah ? 120 : R(900, 2600)); }, 5000, 15000);
    },
    meer() { const s = rauschen("braun"); const g = gain(0.5); kette(s, filter("lowpass", 900), g, master); lfo(g.gain, 0.09, 0.35, 0.45); s.start(); const r = rauschen("rosa"); const g2 = gain(0.1); kette(r, filter("highpass", 1500), g2, master); lfo(g2.gain, 0.09, 0.08, 0.1); r.start(); },
    wald() { const s = rauschen("rosa"); const g = gain(0.18); kette(s, filter("lowpass", 700), g, master); lfo(g.gain, 0.05, 0.08, 0.18); s.start(); zufall(() => { const f = 2400 + Math.random() * 2000; const n = 2 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) spaeter(() => ton(f * (0.9 + Math.random() * 0.25), 0.09 + Math.random() * 0.08, "sine", 0.05, master, f * 1.3), i * 120); }, 1200, 4500); },
    kamin() { const s = rauschen("braun"); kette(s, filter("lowpass", 500), gain(0.55), master); s.start(); zufall(() => knack(0.12 + Math.random() * 0.2), 40, 400); },
    fokus() { const s = rauschen("braun"); kette(s, filter("lowpass", 420), gain(0.8), master); s.start(); },
    nacht() { const s = rauschen("braun"); kette(s, filter("lowpass", 250), gain(0.3), master); s.start(); zufall(() => { for (let i = 0; i < 3; i++) spaeter(() => ton(4300 + Math.random() * 200, 0.04, "sine", 0.025), i * 60); }, 500, 1400); },
    weltraum() { [55, 82.4, 110.3, 164.8].forEach((f, i) => { const o = ctx.createOscillator(); o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 12; const fi = filter("lowpass", 600); const g = gain(0.07); kette(o, fi, g, master); lfo(fi.frequency, 0.03 + i * 0.01, 250, 600); o.start(); }); const s = rauschen("rosa"); kette(s, filter("bandpass", 900, 0.5), gain(0.03), master); s.start(); },
    puls() { let n = 0; const akk = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 294]]; takt(() => { const t = ctx.currentTime; const o = ctx.createOscillator(), g = gain(0); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); g.gain.linearRampToValueAtTime(0.35, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3); if (n % 2) knack(0.05); if (n % 8 === 0) akk[(n / 8) % 4].forEach((f) => ton(f, 2.2, "triangle", 0.025)); n++; }, 480); },
    wind() {
      const s = rauschen("rosa"), bp = filter("bandpass", 600, 0.8), g = gain(0.5); kette(s, bp, g, master); lfo(bp.frequency, 0.07, 300, 650); lfo(g.gain, 0.11, 0.25, 0.45); s.start();
      const r = rauschen("weiss"), bp2 = filter("bandpass", 1400, 14), g2 = gain(0.06); kette(r, bp2, g2, master); lfo(bp2.frequency, 0.05, 450, 1400); lfo(g2.gain, 0.13, 0.05, 0.06); r.start();
    },
    bach() {
      const s = rauschen("rosa"), g = gain(0.32); kette(s, filter("highpass", 900), filter("lowpass", 6000), g, master); lfo(g.gain, 0.3, 0.05, 0.32); s.start();
      const b = rauschen("braun"); kette(b, filter("lowpass", 400), gain(0.15), master); b.start();
      zufall(() => { const f = R(500, 1300); ton(f, R(0.04, 0.09), "sine", 0.03, master, f * R(1.3, 1.8)); }, 40, 180);
    },
    schnee() {
      const s = rauschen("braun"), g = gain(0.35); kette(s, filter("lowpass", 500), g, master); lfo(g.gain, 0.06, 0.15, 0.3); s.start();
      const r = rauschen("rosa"); kette(r, filter("bandpass", 2500, 0.7), gain(0.03), master); r.start();
      zufall(() => ton(R(1800, 2600), 2.5, "sine", 0.012), 4000, 11000);
    },
    cafe() {
      const b = rauschen("braun"); kette(b, filter("lowpass", 300), gain(0.2), master); b.start();
      [350, 750, 1300].forEach((f) => { const s = rauschen("rosa"), g = gain(0.06); kette(s, filter("bandpass", f, 1.5), g, master); s.start(); zufall(() => g.gain.setTargetAtTime(R(0.02, f > 1000 ? 0.06 : 0.13), ctx.currentTime, 0.12), 150, 500); });
      zufall(() => { const f = R(2600, 4200); ton(f, 0.35, "triangle", 0.025); if (Math.random() < 0.4) spaeter(() => ton(f * 1.07, 0.3, "triangle", 0.018), 90); }, 1500, 5000);
    },
    zug() {
      const s = rauschen("braun"); kette(s, filter("lowpass", 220), gain(0.6), master); s.start();
      const r = rauschen("rosa"); kette(r, filter("bandpass", 800), gain(0.06), master); r.start();
      takt(() => { ton(90, 0.12, "triangle", 0.22, master, 45); knack(0.05, 600); spaeter(() => { ton(85, 0.12, "triangle", 0.2, master, 42); knack(0.04, 500); }, 130); }, 1100);
    },
    unterwasser() {
      const s = rauschen("braun"), g = gain(0.6); kette(s, filter("lowpass", 160), g, master); lfo(g.gain, 0.05, 0.2, 0.6); s.start();
      zufall(() => { const n = 1 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) spaeter(() => { const f = R(250, 700); ton(f, 0.08, "sine", 0.05, master, f * 2.2); }, i * R(60, 140)); }, 600, 2500);
      zufall(() => ton(R(180, 260), 3, "sine", 0.03, master, R(120, 200)), 9000, 20000);
    },
    dschungel() {
      const s = rauschen("rosa"); kette(s, filter("highpass", 1200), gain(0.18), master); s.start();
      const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = 4200; const ig = gain(0.012); kette(o, filter("bandpass", 4200, 8), ig, master); lfo(ig.gain, 28, 0.012, 0.012); o.start();
      zufall(() => { const f = R(900, 1800); ton(f, 0.25, "sine", 0.04, master, f * R(1.5, 2.2)); spaeter(() => ton(f * 1.8, 0.2, "sine", 0.03, master, f), 250); }, 1500, 4500);
      zufall(() => { for (let i = 0; i < 3; i++) spaeter(() => ton(R(180, 240), 0.07, "triangle", 0.05), i * 110); }, 2500, 7000);
    },
    klangschale() {
      [110, 110.4].forEach((f) => { const o = ctx.createOscillator(); o.frequency.value = f; kette(o, gain(0.025), master); o.start(); });
      const schlag = () => { szene("schlag"); const b = R(205, 235); [[1, 0.12, 9], [2.71, 0.06, 6], [5.12, 0.03, 4], [8.4, 0.014, 2.5]].forEach(([p, a, d]) => { ton(b * p, d, "sine", a); ton(b * p * 1.004, d, "sine", a * 0.6); }); };
      takt(schlag, 11000);
    },
    raumschiff() {
      [[55, 0.1], [110, 0.035]].forEach(([f, v]) => { const o = ctx.createOscillator(); o.frequency.value = f; kette(o, gain(v), master); o.start(); });
      const s = rauschen("braun"); kette(s, filter("lowpass", 350), gain(0.3), master); s.start();
      const r = rauschen("rosa"), bp = filter("bandpass", 500, 2); kette(r, bp, gain(0.05), master); lfo(bp.frequency, 0.02, 300, 500); r.start();
      zufall(() => { const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) spaeter(() => ton(R(900, 2200), 0.06, "square", 0.012), i * 90); }, 2500, 7000);
    },
    herz() {
      const s = rauschen("braun"); kette(s, filter("lowpass", 300), gain(0.25), master); s.start();
      takt(() => { ton(70, 0.18, "sine", 0.45, master, 40); spaeter(() => ton(85, 0.16, "sine", 0.32, master, 50), 280); }, 1000);
    },
  };
  // ---------- Klang-Plus (v1.145.0, zuerst nur in Eve) ----------
  // Problem vorher: 8 Klänge lagen fast nur im Tiefbass (unter 300 Hz). Handy-, iPad- und MacBook-Lautsprecher spielen
  // das kaum ab – es kam scheinbar „kein Ton“. Jetzt hat jeder Klang hörbare Mitten/Höhen und alle sind gleich laut.
  const plusFrei = () => !window.FridayEve || window.FridayEve.frei("klang-plus");
  // Lautstärke-Ausgleich je Klang (gemessen im Browser: alle landen bei ca. -30 dB im hörbaren Bereich ab 300 Hz)
  const PEGEL = { regen: 0.85, gewitter: 0.75, wind: 1.2, schnee: 2.7, wald: 2.4, dschungel: 2.1, nacht: 3, meer: 1.7, bach: 1.5, unterwasser: 3.1, kamin: 2.1, cafe: 2.7, zug: 2.9, fokus: 1.7, klangschale: 2.9, herz: 2.8, weltraum: 2.5, raumschiff: 3.1, puls: 2.6 };
  // Mitten-Schicht: leises, gefiltertes Rauschen, damit kleine Lautsprecher etwas zum Spielen haben
  function mitte(f, v, q = 0.8, art = "rosa") { const s = rauschen(art); const g = gain(v); kette(s, filter("bandpass", f, q), g, master); s.start(); return g; }
  function zirpen(f, vol) { // Grille: schnelle Pulse
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) spaeter(() => ton(f * R(0.99, 1.01), 0.035, "sine", vol), i * 55);
  }
  function blubb(vol = 0.09) { const f = R(350, 900); ton(f, R(0.06, 0.12), "sine", vol, master, f * R(2, 3)); }
  const BAU_NEU = {
    schnee() {
      const s = rauschen("braun"), g = gain(0.3); kette(s, filter("lowpass", 500), g, master); lfo(g.gain, 0.06, 0.12, 0.3); s.start();
      const w = mitte(700, 0.12, 0.9); lfo(w.gain, 0.08, 0.06, 0.12);
      mitte(3000, 0.04, 0.8);
      zufall(() => ton(R(1800, 2800), 2.5, "sine", 0.03), 1500, 7000); // Glitzern
    },
    wald() {
      const s = rauschen("rosa"); const g = gain(0.14); kette(s, filter("lowpass", 900), g, master); lfo(g.gain, 0.05, 0.06, 0.14); s.start();
      const laub = mitte(1800, 0.06, 0.7); lfo(laub.gain, 0.12, 0.04, 0.06);
      const vogel = () => { const f = 2400 + Math.random() * 2000; const n = 2 + Math.floor(Math.random() * 5); for (let i = 0; i < n; i++) spaeter(() => ton(f * (0.9 + Math.random() * 0.25), 0.09 + Math.random() * 0.08, "sine", 0.09, master, f * 1.3), i * 120); };
      vogel(); zufall(vogel, 900, 3500);
      zufall(() => { const f = R(1100, 1500); ton(f, 0.35, "sine", 0.05, master, f * 0.8); spaeter(() => ton(f * 0.8, 0.45, "sine", 0.05, master, f * 0.7), 420); }, 6000, 14000); // Kuckuck/Taube
    },
    nacht() {
      const s = rauschen("braun"); kette(s, filter("lowpass", 300), gain(0.2), master); s.start();
      const luft = mitte(900, 0.07, 0.6); lfo(luft.gain, 0.07, 0.04, 0.07);
      zirpen(4400, 0.1); zufall(() => zirpen(R(4200, 4700), R(0.07, 0.11)), 300, 900);
      zufall(() => zirpen(R(3600, 3900), 0.05), 700, 2000); // zweite Grille weiter weg
      zufall(() => { ton(420, 0.5, "sine", 0.07, master, 380); spaeter(() => ton(400, 0.8, "sine", 0.06, master, 360), 600); }, 12000, 26000); // Eule
    },
    meer() {
      const s = rauschen("braun"); const g = gain(0.45); kette(s, filter("lowpass", 900), g, master); lfo(g.gain, 0.09, 0.3, 0.4); s.start();
      const r = rauschen("rosa"); const g2 = gain(0.16); kette(r, filter("highpass", 900), filter("lowpass", 6000), g2, master); lfo(g2.gain, 0.09, 0.13, 0.15); r.start();
      zufall(() => { const f = R(1800, 2600); ton(f, 0.25, "sine", 0.025, master, f * 0.8); }, 7000, 16000); // Möwe in der Ferne
    },
    unterwasser() {
      const s = rauschen("braun"), g = gain(0.45); kette(s, filter("lowpass", 220), g, master); lfo(g.gain, 0.05, 0.15, 0.45); s.start();
      const dumpf = mitte(450, 0.16, 1.2); lfo(dumpf.gain, 0.07, 0.07, 0.16);
      zufall(() => { const n = 2 + Math.floor(Math.random() * 6); for (let i = 0; i < n; i++) spaeter(() => blubb(0.1), i * R(50, 130)); }, 400, 1800);
      zufall(() => { const f = R(320, 520); ton(f, 3.5, "sine", 0.06, master, f * R(1.3, 1.7)); spaeter(() => ton(f * 1.5, 2.5, "sine", 0.04, master, f), 2600); }, 8000, 18000); // Walgesang
    },
    kamin() {
      const s = rauschen("braun"); kette(s, filter("lowpass", 500), gain(0.45), master); s.start();
      const fauch = mitte(1100, 0.07, 0.7); lfo(fauch.gain, 0.3, 0.04, 0.07);
      zufall(() => knack(0.2 + Math.random() * 0.3), 30, 300);
      zufall(() => { for (let i = 0; i < 4; i++) spaeter(() => knack(0.25, R(2000, 5000)), i * R(20, 60)); }, 2000, 6000); // Funkenregen
    },
    cafe() {
      const b = rauschen("braun"); kette(b, filter("lowpass", 300), gain(0.18), master); b.start();
      [350, 750, 1300, 2200].forEach((f) => { const s = rauschen("rosa"), g = gain(0.08); kette(s, filter("bandpass", f, 1.5), g, master); s.start(); zufall(() => g.gain.setTargetAtTime(R(0.03, f > 1000 ? 0.09 : 0.16), ctx.currentTime, 0.12), 150, 500); });
      zufall(() => { const f = R(2600, 4200); ton(f, 0.35, "triangle", 0.05); if (Math.random() < 0.5) spaeter(() => ton(f * 1.07, 0.3, "triangle", 0.035), 90); }, 900, 3500); // Tassen
      zufall(() => { for (let i = 0; i < 3; i++) spaeter(() => knack(0.08, R(800, 1600)), i * 80); }, 4000, 9000); // Löffel/Schritte
    },
    zug() {
      const s = rauschen("braun"); kette(s, filter("lowpass", 260), gain(0.4), master); s.start();
      const fahrt = mitte(650, 0.14, 0.7); lfo(fahrt.gain, 0.2, 0.04, 0.14);
      mitte(2400, 0.03, 1);
      takt(() => {
        const klack = (v) => { ton(180, 0.08, "triangle", v, master, 90); knack(v * 0.9, R(900, 1600)); knack(v * 0.5, R(2500, 3500)); };
        klack(0.18); spaeter(() => klack(0.16), 130);
      }, 1100);
      zufall(() => { ton(392, 1.6, "sawtooth", 0.02); ton(494, 1.6, "sawtooth", 0.016); }, 25000, 50000); // Signal in der Ferne
    },
    fokus() {
      const s = rauschen("braun"); kette(s, filter("lowpass", 900), gain(0.55), master); s.start();
      mitte(800, 0.06, 0.5);
    },
    klangschale() {
      [220, 220.6, 440.5].forEach((f, i) => { const o = ctx.createOscillator(); o.frequency.value = f; const g = gain(i === 2 ? 0.008 : 0.016); kette(o, g, master); lfo(g.gain, 0.08 + i * 0.03, 0.006, i === 2 ? 0.008 : 0.016); o.start(); });
      const schlag = () => { szene("schlag"); const b = R(205, 235); [[1, 0.16, 10], [2.71, 0.11, 7], [5.12, 0.06, 5], [8.4, 0.03, 3]].forEach(([p, a, d]) => { ton(b * p, d, "sine", a); ton(b * p * 1.004, d, "sine", a * 0.6); }); };
      takt(schlag, 9000);
    },
    herz() {
      const s = rauschen("braun"); kette(s, filter("lowpass", 400), gain(0.2), master); s.start();
      const rausch = mitte(500, 0.05, 0.6); lfo(rausch.gain, 1, 0.03, 0.05); // Blutrauschen im Takt
      const schlag = (f, v) => { ton(f, 0.18, "sine", v, master, f * 0.55); ton(f * 2.2, 0.08, "triangle", v * 0.35, master, f); const r = rauschen("rosa"), fi = filter("bandpass", 380, 1.4), g = gain(0), t = ctx.currentTime; g.gain.linearRampToValueAtTime(v * 0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); r.connect(fi); fi.connect(g); g.connect(master); r.start(t); r.stop(t + 0.15); };
      takt(() => { schlag(95, 0.5); spaeter(() => schlag(110, 0.35), 280); }, 1000);
    },
    weltraum() {
      [110, 164.8, 220.5, 330, 440.2].forEach((f, i) => { const o = ctx.createOscillator(); o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 14; const fi = filter("lowpass", 1200); const g = gain(i < 2 ? 0.05 : 0.03); kette(o, fi, g, master); lfo(fi.frequency, 0.03 + i * 0.01, 600, 1200); lfo(g.gain, 0.04 + i * 0.013, 0.015, i < 2 ? 0.05 : 0.03); o.start(); });
      const s = rauschen("rosa"); const sg = gain(0.05); kette(s, filter("bandpass", 1400, 0.6), sg, master); lfo(sg.gain, 0.05, 0.03, 0.05); s.start();
      zufall(() => { const f = R(1200, 2400); ton(f, 3, "sine", 0.025, master, f * R(0.97, 1.03)); }, 2000, 6000); // Sternen-Funkeln
    },
    raumschiff() {
      [[55, 0.06], [110, 0.04], [220, 0.025], [330, 0.012]].forEach(([f, v]) => { const o = ctx.createOscillator(); o.type = f > 100 ? "triangle" : "sine"; o.frequency.value = f; kette(o, gain(v), master); o.start(); });
      const s = rauschen("braun"); kette(s, filter("lowpass", 350), gain(0.22), master); s.start();
      const r = rauschen("rosa"), bp = filter("bandpass", 700, 1.2), lg = gain(0.1); kette(r, bp, lg, master); lfo(bp.frequency, 0.02, 300, 700); r.start(); // Lüftung
      zufall(() => { const n = 1 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) spaeter(() => ton(R(900, 2200), 0.07, "square", 0.025), i * 90); }, 1800, 5000); // Computer
      zufall(() => { ton(660, 0.18, "sine", 0.05); spaeter(() => ton(880, 0.25, "sine", 0.05), 180); }, 15000, 30000); // Durchsage-Gong
    },
    puls() {
      let n = 0; const akk = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 294]];
      takt(() => {
        const t = ctx.currentTime;
        const o = ctx.createOscillator(), g = gain(0); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.18); g.gain.linearRampToValueAtTime(0.4, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3);
        knack(0.12, R(3000, 4000)); // Klick vom Kick, auf kleinen Lautsprechern hörbar
        spaeter(() => { const h = rauschen("weiss"), hf = filter("highpass", 7000), hg = gain(0), tt = ctx.currentTime; hg.gain.linearRampToValueAtTime(0.06, tt + 0.003); hg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.06); h.connect(hf); hf.connect(hg); hg.connect(master); h.start(tt); h.stop(tt + 0.08); }, 240); // Hi-Hat
        const bass = akk[Math.floor(n / 8) % 4][0]; ton(bass / 2 * 2, 0.22, "sawtooth", 0.03); // Bass eine Oktave höher, damit er auf dem Handy klingt
        if (n % 2) ton(akk[Math.floor(n / 8) % 4][(n >> 1) % 3] * 2, 0.15, "triangle", 0.03); // Arpeggio
        if (n % 8 === 0) akk[Math.floor(n / 8) % 4].forEach((f) => ton(f, 2.2, "triangle", 0.035));
        n++;
      }, 480);
    },
  };
  function stoppeKlang() {
    for (const t of timer) t?.iv ? clearInterval(t.iv) : clearTimeout(t);
    timer = [];
    for (const n of knoten) { try { n.stop?.(); } catch { /* egal */ } try { n.disconnect(); } catch { /* egal */ } }
    knoten = [];
  }
  function spiele(id, { leise = false } = {}) {
    if (!KLAENGE[id]) return;
    try {
      if (!ctx) {
        // iPhone: Ton auch bei Stummschalter (sonst bleibt Web Audio auf iOS still, wenn der Schalter auf lautlos steht)
        if (plusFrei()) { try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* älteres iOS */ } }
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        haupt = ctx.createGain(); haupt.gain.value = 0;
        // Kompressor fängt Spitzen ab (Donner, Kamin-Knacken), damit nichts übersteuert
        const komp = ctx.createDynamicsCompressor(); komp.threshold.value = -14; komp.knee.value = 10; komp.ratio.value = 4; komp.attack.value = 0.004; komp.release.value = 0.25;
        analyse = ctx.createAnalyser(); analyse.fftSize = 256; analyse.smoothingTimeConstant = 0.8;
        haupt.connect(komp); komp.connect(ctx.destination); komp.connect(analyse);
        master = ctx.createGain(); master.connect(haupt);
      }
      ctx.resume?.();
    } catch { return; }
    if (aktiv === id) return;
    const g = ++generation;
    const wechsel = () => { if (g !== generation) return; wechselt = false; stoppeKlang(); aktiv = id; const plus = plusFrei(); master = ctx.createGain(); master.gain.value = plus ? (PEGEL[id] || 1) : 1; master.connect(haupt); knoten.push(master); ((plus && BAU_NEU[id]) || BAU[id])(); haupt.gain.cancelScheduledValues(ctx.currentTime); haupt.gain.setTargetAtTime(zielLaut(), ctx.currentTime, leise ? 1 : 0.4); zeichne(); };
    if (aktiv || knoten.length) { wechselt = true; haupt.gain.cancelScheduledValues(ctx.currentTime); haupt.gain.setTargetAtTime(0, ctx.currentTime, 0.2); setTimeout(wechsel, 850); } else wechsel();
    ls.set("friday_klang_letzter", id);
    // Die Szene wechselt sofort mit
    zeigeSzene(id);
  }
  function aus() {
    schlafEnde = 0;
    if (!ctx || !aktiv) { aktiv = null; zeichne(); zeigeSzene(null); return; }
    const g = ++generation;
    wechselt = false;
    haupt.gain.cancelScheduledValues(ctx.currentTime);
    haupt.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    setTimeout(() => { if (g === generation) stoppeKlang(); }, 1300);
    aktiv = null; zeichne(); zeigeSzene(null);
  }
  // Leiser, während Friday spricht
  const sprichtGerade = () => document.getElementById("reactor")?.classList.contains("speaking");
  const zielLaut = () => laut * 0.6 * (sprichtGerade() ? 0.25 : 1);
  setInterval(() => { if (ctx && aktiv && !wechselt) haupt.gain.setTargetAtTime(zielLaut(), ctx.currentTime, 0.25); }, 300);

  // ---------- Schlaf-Timer ----------
  let schlafEnde = 0;
  setInterval(() => {
    if (!schlafEnde) return;
    if (Date.now() >= schlafEnde) { aus(); w.$("#kr-grund").textContent = "Schlaf-Timer abgelaufen. Gute Nacht."; return; }
    kopfZeile();
  }, 5000);

  // ---------- Automatik (nur was in Friday passiert) ----------
  let autoWahl = null, autoZeit = 0;
  function automatisch(id, grund) {
    if (!auto() || !id || !KLAENGE[id]) return;
    if (Date.now() - autoZeit < 20000 && autoWahl === id) return;
    autoWahl = id; autoZeit = Date.now();
    w && (w.$("#kr-grund").textContent = `Automatik: ${KLAENGE[id].name} – ${grund}`);
    spiele(id, { leise: true });
  }
  window.addEventListener("friday-eingabe", (e) => {
    const t = String(e.detail?.text || "");
    const treffer = WORT_KLANG.find(([, re]) => re.test(t));
    if (treffer) automatisch(treffer[0], `passt zu „${t.slice(0, 40)}“`);
  });
  new MutationObserver((liste) => {
    for (const m of liste) {
      const el = m.target;
      if (!el.id || !FENSTER_KLANG[el.id] || el.classList.contains("hidden")) continue;
      if (String(m.oldValue || "").includes("hidden")) automatisch(FENSTER_KLANG[el.id], `Fenster „${el.getAttribute("aria-label") || el.id}“ ist offen`);
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  // iPhone/Safari: Ton darf erst nach einem Tipp starten
  document.addEventListener("pointerdown", () => { try { ctx?.resume?.(); } catch { /* egal */ } }, true);

  // ---------- Fenster (Stil wie Fridays Gehirn) ----------
  let gruppe = ls.get("friday_klang_gruppe") || "alle";
  if (!GRUPPEN[gruppe]) gruppe = "alle";
  const w = H.fenster({
    id: "klang", titel: "🎧 Stimmungs-Sound", klasse: "kr-box",
    html: `
      <nav class="sz-tabs kr-tabs" role="tablist">${Object.entries(GRUPPEN).map(([id, n]) => `<button type="button" data-gr="${id}" role="tab">${n}</button>`).join("")}</nav>
      <div class="kr-buehne">
        <div class="kr-glas" id="kr-glas">
          <img class="kr-foto" id="kr-foto" alt="" referrerpolicy="no-referrer" decoding="async">
          <video class="kr-video" id="kr-video" muted playsinline preload="auto" aria-hidden="true"></video>
          <canvas class="kr-canvas" id="kr-canvas" aria-hidden="true"></canvas>
          <canvas class="kr-spektrum" id="kr-spektrum" aria-hidden="true"></canvas>
          <div class="kr-oben">
            <div class="kr-szene"><small>SZENE</small><b id="kr-szene-titel">Bereit</b></div>
            <div class="kr-knoepfe">
              <div class="kr-umschalter" role="group" aria-label="Ansicht">
                <button type="button" data-ansicht="anim">✨ Animation</button><button type="button" data-ansicht="foto">📷 Echtes Foto</button><button type="button" data-ansicht="video" class="kr-video-knopf">🎬 Video</button>
              </div>
              <button type="button" class="kr-rund" id="kr-naechstes" title="Anderes Bild" hidden>↻</button>
              <button type="button" class="kr-rund" id="kr-gross-btn" title="Szene groß zeigen">⛶</button>
            </div>
          </div>
          <div class="kr-leer" id="kr-leer"><span>🎧</span>Wähle unten einen Klang – Friday zeigt dir das passende Bild dazu.</div>
          <div class="kr-unten">
            <div class="kr-wo" id="kr-wo" hidden></div>
            <a class="kr-credit" id="kr-credit" target="_blank" rel="noopener" hidden></a>
          </div>
        </div>
      </div>
      <div class="kr-raster" id="kr-liste"></div>
      <div class="kr-steuer">
        <div class="gh-kachel kr-st"><div><small>LAUTSTÄRKE</small><div class="hf-reihe"><span>🔈</span><input id="kr-laut" type="range" min="0" max="1" step="0.05" class="grow" aria-label="Lautstärke"><span>🔊</span></div></div></div>
        <div class="gh-kachel kr-st"><div><small>AUTOMATIK</small><label class="switch"><input type="checkbox" id="kr-auto"><span>passt den Klang an, was du gerade in Friday machst</span></label></div></div>
        <div class="gh-kachel kr-st"><div><small>SCHLAF-TIMER</small><div class="kr-timer" id="kr-timer"><button type="button" data-min="0">Aus</button><button type="button" data-min="15">15 Min</button><button type="button" data-min="30">30</button><button type="button" data-min="60">60</button></div></div></div>
        <button id="kr-aus" class="hf-btn leise kr-stopp" type="button">⏹ Stille</button>
      </div>
      <div id="kr-grund" class="hf-hinweis"></div>
      <p class="hf-hinweis">Alle Klänge und Szenen entstehen live auf deinem Gerät – kein Download, kein Guthaben. Echte Fotos (Openverse) und Videos (Wikimedia Commons) sind frei lizenziert und laufen stumm, Wetter von Open-Meteo. Sag: „Friday, spiel Gewitter“, „Kaminfeuer“, „Wo regnet es gerade?“, „Stimmungs-Sound automatisch“ oder „Sound aus“.</p>`,
    onOpen: () => { zeichne(); zeigeSzene(aktiv); },
  });

  // Kopfzeile im Stil der System-Zentrale (Ring, Titel, Pillen)
  const kopf = w.sheet.querySelector(".sheet-top");
  const xBtn = w.$("#klang-x");
  kopf.className = "sz-head kr-head";
  kopf.innerHTML = `
    <div class="sz-core" aria-hidden="true">
      <svg viewBox="0 0 120 120"><circle class="sz-c1" cx="60" cy="60" r="54"/><circle class="sz-c2" cx="60" cy="60" r="44"/><circle class="sz-c3" cx="60" cy="60" r="34"/></svg>
      <b id="kr-kern">🎧</b>
    </div>
    <div class="sz-title">
      <small>F.R.Ai.D.A.Y · KLANGRAUM</small>
      <h2>Stimmungs-Sound</h2>
      <p id="kr-summary" class="sz-summary">Stille</p>
    </div>
    <div class="sz-meta">
      <span class="sz-pill" id="kr-pill-live"><i class="sz-live"></i><span>STILL</span></span>
      <span class="sz-pill">${Object.keys(KLAENGE).length} KLÄNGE</span>
    </div>`;
  xBtn.classList.add("sz-x");
  kopf.appendChild(xBtn);

  function kopfZeile() {
    const k = aktiv && KLAENGE[aktiv];
    w.$("#kr-kern").textContent = k ? k.icon : "🎧";
    const teile = [k ? `Läuft: ${k.name}` : "Stille", auto() ? "Automatik an" : ""];
    if (schlafEnde) teile.push(`schläft in ${Math.max(1, Math.round((schlafEnde - Date.now()) / 60000))} Min ein`);
    w.$("#kr-summary").textContent = teile.filter(Boolean).join(" · ");
    const pill = w.$("#kr-pill-live");
    pill.classList.toggle("an", !!k); pill.querySelector("span").textContent = k ? "LIVE" : "STILL";
    w.sheet.style.setProperty("--kr-f", k ? k.f : "var(--cyan)");
  }

  // ---------- Szene + Fotos ----------
  const FB = window.FridayKlangBild;
  const bildKlein = FB ? FB.neu(w.$("#kr-canvas")) : null;
  let bildGross = null;
  // Videos (v1.140.0) sind zuerst nur in Eve – in Friday liegen sie hinter dem Schloss, bis Boss sie freigibt.
  const videoFrei = () => !window.FridayEve || window.FridayEve.frei("klang-video");
  let ansicht = ["foto", "video"].includes(ls.get("friday_klang_ansicht")) ? ls.get("friday_klang_ansicht") : "anim";
  const ans = () => (ansicht === "video" && !videoFrei() ? "anim" : ansicht);
  const echt = () => ans() !== "anim"; // Foto oder Video: die gemalte Szene legt nur noch Effekte darüber
  let fotoListe = [], fotoNr = 0, fotoOrt = "", fotoFuer = "";
  let videoListe = [], videoNr = 0, videoFuer = "", videoQuelle = 0;
  let woDaten = null, woFuer = "";
  let szeneId = null;

  function zeigeSzene(id) {
    szeneId = id;
    w.$("#kr-leer").hidden = !!id;
    w.$("#kr-szene-titel").textContent = id ? (FB?.titel(id) || KLAENGE[id].name) : "Bereit";
    if (!id) { bildKlein?.stop(); bildGross?.stop(); setzeFoto(null); setzeVideo(null); w.$("#kr-wo").hidden = true; kopfZeile(); return; }
    if (w.offen()) { bildKlein?.setze(id); bildKlein?.foto(echt()); } else bildKlein?.stop();
    if (grossOffen()) { bildGross.setze(id); bildGross.foto(echt()); }
    if (fotoFuer !== id) { fotoOrt = ""; fotoListe = []; fotoFuer = ""; }
    if (videoFuer !== id) { videoListe = []; videoFuer = ""; }
    if (ans() === "foto") ladeFoto(id); else setzeFoto(null);
    if (ans() === "video") ladeVideo(id); else setzeVideo(null);
    ladeWo(id);
    kopfZeile();
  }
  function umschalter() {
    w.$$("[data-ansicht]").forEach((b) => b.classList.toggle("an", b.dataset.ansicht === ans()));
    w.$("#kr-naechstes").hidden = ans() === "anim";
    w.$("#kr-naechstes").title = ans() === "video" ? "Anderes Video" : "Anderes Foto";
  }
  function setzeFoto(f) {
    const img = w.$("#kr-foto"), cr = w.$("#kr-credit"), gImg = document.getElementById("kr-gross-foto");
    if (!f) { img.removeAttribute("src"); img.classList.remove("an"); cr.hidden = true; if (gImg) { gImg.removeAttribute("src"); gImg.classList.remove("an"); } return; }
    img.classList.remove("an");
    img.onload = () => img.classList.add("an");
    img.onerror = () => { if (fotoNr < fotoListe.length - 1) { fotoNr++; setzeFoto(fotoListe[fotoNr]); } else { setzeFoto(null); grund("Kein Foto erreichbar – ich zeige die Animation."); } };
    img.src = f.bild;
    if (gImg) { gImg.onload = () => gImg.classList.add("an"); gImg.src = f.bild; }
    cr.hidden = false; cr.href = f.seite || f.bild;
    cr.textContent = `📷 ${f.titel ? `„${f.titel.slice(0, 40)}“` : "Foto"}${f.autor ? ` von ${f.autor.slice(0, 30)}` : ""} · ${f.lizenz || "frei"} · Openverse`;
  }
  const grund = (t) => { w.$("#kr-grund").textContent = t; };
  async function ladeFoto(id) {
    if (!id) return;
    if (fotoFuer === id && fotoListe.length) { setzeFoto(fotoListe[fotoNr % fotoListe.length]); return; }
    fotoFuer = id; fotoNr = 0;
    try {
      const d = await H.json(`/api/klang/foto?art=${encodeURIComponent(id)}${fotoOrt ? `&ort=${encodeURIComponent(fotoOrt)}` : ""}`);
      if (szeneId !== id || ans() !== "foto") return;
      fotoListe = d.fotos || [];
      if (!fotoListe.length) { setzeFoto(null); grund("Gerade kein passendes Foto gefunden – ich zeige die Animation."); return; }
      setzeFoto(fotoListe[0]);
    } catch { if (szeneId === id) { fotoFuer = ""; setzeFoto(null); grund("Fotos gerade nicht erreichbar – ich zeige die Animation."); } }
  }
  // ---------- Videos (Wikimedia Commons, stumm, laufen als Schleife durch die Auswahl) ----------
  const kannWebm = (() => { try { return !!document.createElement("video").canPlayType('video/webm; codecs="vp9"'); } catch { return false; } })();
  function quellen(v, gross) {
    const q = (v.quellen || []).filter((x) => x.type !== "video/webm" || kannWebm);
    return q.map((x) => (gross && x.hd ? x.hd : x.src));
  }
  function spieleIn(el, v, gross, beiFehler) {
    if (!el) return;
    const liste = quellen(v, gross);
    let i = gross ? 0 : videoQuelle;
    const weiter = () => { i++; if (i < liste.length) { el.src = liste[i]; el.play?.().catch(() => {}); } else beiFehler?.(); };
    el.classList.remove("an");
    el.onloadeddata = () => { el.classList.add("an"); if (!gross) videoQuelle = i; };
    el.onerror = weiter;
    el.onended = () => naechstesVideo();
    el.loop = videoListe.length < 2;
    if (v.poster) el.poster = v.poster;
    if (!liste.length) return beiFehler?.();
    el.muted = true; el.src = liste[i] || liste[0]; el.play?.().catch(() => {});
  }
  function setzeVideo(v) {
    const el = w.$("#kr-video"), cr = w.$("#kr-credit"), gEl = document.getElementById("kr-gross-video");
    const leeren = (x) => { if (!x) return; x.pause?.(); x.removeAttribute("src"); x.removeAttribute("poster"); x.classList.remove("an"); try { x.load(); } catch { /* egal */ } };
    if (!v) { leeren(el); leeren(gEl); if (ans() !== "foto") cr.hidden = true; return; }
    videoQuelle = 0;
    const fehler = () => { if (videoNr < videoListe.length - 1) { videoNr++; setzeVideo(videoListe[videoNr]); } else { setzeVideo(null); grund("Kein Video erreichbar – ich zeige die Animation."); } };
    if (w.offen()) spieleIn(el, v, false, fehler); else leeren(el);
    if (grossOffen()) spieleIn(gEl, v, true);
    cr.hidden = false; cr.href = v.seite || "#";
    cr.textContent = `🎬 ${v.titel ? `„${v.titel.slice(0, 40)}“` : "Video"}${v.autor ? ` von ${v.autor.slice(0, 30)}` : ""} · ${v.lizenz || "frei"} · Wikimedia Commons`;
  }
  function naechstesVideo() {
    if (!videoListe.length) return ladeVideo(szeneId);
    videoNr = (videoNr + 1) % videoListe.length;
    setzeVideo(videoListe[videoNr]);
  }
  async function ladeVideo(id) {
    if (!id) return;
    if (videoFuer === id && videoListe.length) { setzeVideo(videoListe[videoNr % videoListe.length]); return; }
    videoFuer = id; videoNr = 0;
    grund("Lade ein passendes Video …");
    try {
      const d = await H.json(`/api/klang/video?art=${encodeURIComponent(id)}`);
      if (szeneId !== id || ans() !== "video") return;
      videoListe = d.videos || [];
      if (!videoListe.length) { setzeVideo(null); grund("Gerade kein passendes Video gefunden – ich zeige die Animation."); return; }
      grund(videoListe.length > 1 ? `${videoListe.length} Videos zu ${KLAENGE[id].name} – sie laufen nacheinander, ↻ springt weiter.` : "");
      setzeVideo(videoListe[0]);
    } catch { if (szeneId === id) { videoFuer = ""; setzeVideo(null); grund("Videos gerade nicht erreichbar – ich zeige die Animation."); } }
  }
  // Fenster zu = Video anhalten (spart Akku und Datenvolumen), Fenster auf = weiter
  new MutationObserver(() => {
    const el = w.$("#kr-video");
    if (!w.offen()) { el.pause?.(); return; }
    if (ans() === "video" && el.getAttribute("src") && el.paused) el.play?.().catch(() => {});
  }).observe(w.sheet, { attributes: true, attributeFilter: ["class"] });

  async function ladeWo(id) {
    const box = w.$("#kr-wo");
    if (!WO_TEXT[id]) { box.hidden = true; return; }
    if (woFuer === id && woDaten && Date.now() - woDaten.at < 10 * 60 * 1000) { zeigeWo(id); return; }
    woFuer = id;
    box.hidden = false; box.innerHTML = `<span class="kr-wo-titel">📍 Suche, wo es gerade ${WO_TEXT[id]} …</span>`;
    try {
      const d = await H.json(`/api/klang/wo?art=${id}`);
      woDaten = { ...d, at: Date.now() };
      if (szeneId === id) zeigeWo(id);
    } catch { woFuer = ""; if (szeneId === id) box.innerHTML = `<span class="kr-wo-titel">📍 Wetterdaten gerade nicht erreichbar.</span>`; }
  }
  function zeigeWo(id) {
    const box = w.$("#kr-wo"), d = woDaten;
    if (!d || !WO_TEXT[id]) { box.hidden = true; return; }
    box.hidden = false;
    if (!d.orte.length) { box.innerHTML = `<span class="kr-wo-titel">📍 Gerade ${WO_TEXT[id]} es in keiner der ${d.geprueft} Städte, die ich beobachte.</span>`; return; }
    const titel = d.ersatz ? `📍 Gerade kein Gewitter – aber starker Regen in ${d.orte.length} Städten` : `📍 Gerade ${WO_TEXT[id]} es in ${d.orte.length} von ${d.geprueft} Städten`;
    box.innerHTML = `<span class="kr-wo-titel">${titel}</span><div class="kr-chips">${d.orte.map((o) => `<button type="button" class="kr-chip${fotoOrt === o.name ? " an" : ""}" data-ort="${esc(o.name)}" title="${esc(o.text)}">${o.flagge} ${esc(o.name)} <em>${o.temp == null ? "" : `${Math.round(o.temp)}°`} · ${esc(o.text)}</em></button>`).join("")}</div>`;
  }
  function zeigeOrt(ort) {
    fotoOrt = ort; fotoFuer = ""; fotoListe = [];
    ansicht = "foto"; ls.set("friday_klang_ansicht", "foto"); umschalter();
    bildKlein?.foto(true); bildGross?.foto(true); setzeVideo(null);
    if (szeneId) { ladeFoto(szeneId); zeigeWo(szeneId); }
    grund(`Echtes Foto aus ${ort} (sofern frei lizenziert vorhanden). Die Tropfen sind live.`);
  }
  w.$("#kr-wo").addEventListener("click", (e) => { const b = e.target.closest("[data-ort]"); if (b) zeigeOrt(b.dataset.ort); });
  w.sheet.querySelector(".kr-umschalter").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ansicht]"); if (!b) return;
    ansicht = b.dataset.ansicht; ls.set("friday_klang_ansicht", ansicht); umschalter();
    bildKlein?.foto(echt()); bildGross?.foto(echt());
    grund("");
    if (ans() === "foto") ladeFoto(szeneId); else setzeFoto(null);
    if (ans() === "video") ladeVideo(szeneId); else setzeVideo(null);
  });
  w.$("#kr-naechstes").addEventListener("click", () => {
    if (ans() === "video") return naechstesVideo();
    if (!fotoListe.length) return ladeFoto(szeneId); fotoNr = (fotoNr + 1) % fotoListe.length; setzeFoto(fotoListe[fotoNr]);
  });

  // Große Szene (Vollbild, z. B. Kaminfeuer auf dem Fernseher)
  const grossOffen = () => !!document.getElementById("kr-gross") && !document.getElementById("kr-gross").hidden;
  function grossAuf() {
    if (!szeneId) return;
    let el = document.getElementById("kr-gross");
    if (!el) {
      el = document.createElement("div"); el.id = "kr-gross"; el.className = "kr-gross";
      el.innerHTML = `<img id="kr-gross-foto" class="kr-foto" alt="" referrerpolicy="no-referrer"><video id="kr-gross-video" class="kr-video" muted playsinline preload="auto" aria-hidden="true"></video><canvas id="kr-gross-canvas"></canvas><div class="kr-gross-titel"><small>F.R.Ai.D.A.Y · KLANGRAUM</small><b></b></div><button type="button" class="kr-rund kr-gross-x" aria-label="Schließen">✕</button>`;
      document.body.appendChild(el);
      bildGross = FB?.neu(el.querySelector("canvas"));
      const zu = () => { el.hidden = true; bildGross?.stop(); const gv = el.querySelector("video"); gv.pause?.(); gv.removeAttribute("src"); gv.classList.remove("an"); };
      el.querySelector(".kr-gross-x").addEventListener("click", zu);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.hidden) { e.stopPropagation(); zu(); } }, true);
    }
    el.hidden = false;
    el.querySelector("b").textContent = `${KLAENGE[szeneId].icon} ${FB?.titel(szeneId) || KLAENGE[szeneId].name}`;
    bildGross?.setze(szeneId); bildGross?.foto(echt());
    const v = ans() === "video" && videoListe[videoNr % (videoListe.length || 1)];
    if (v) spieleIn(el.querySelector("video"), v, true);
    const f = ans() === "foto" && fotoListe[fotoNr % (fotoListe.length || 1)];
    const gImg = el.querySelector("img"); if (f) { gImg.onload = () => gImg.classList.add("an"); gImg.src = f.bild; } else { gImg.removeAttribute("src"); gImg.classList.remove("an"); }
    el.requestFullscreen?.().catch?.(() => {});
  }
  w.$("#kr-gross-btn").addEventListener("click", grossAuf);
  // Vollbild per Esc verlassen = große Szene schließen
  document.addEventListener("fullscreenchange", () => { const el = document.getElementById("kr-gross"); if (el && !document.fullscreenElement && !el.hidden) { el.querySelector(".kr-gross-x").click(); } });

  // ---------- Live-Spektrum (Klang-Plus) ----------
  // Zeigt, was wirklich aus dem Lautsprecher kommt: Balken unten in der Bühne, Ring im Kopf und Kachel atmen mit.
  const spek = w.$("#kr-spektrum"), spekCtx = spek.getContext?.("2d");
  let spekDaten = null, spekLauf = false;
  function spektrum() {
    const plus = plusFrei();
    w.sheet.classList.toggle("kr-plus", plus);
    if (!plus || !w.offen() || !analyse || !aktiv || document.hidden) { spekLauf = false; w.sheet.style.setProperty("--pegel", "0"); spekCtx?.clearRect(0, 0, spek.width, spek.height); return; }
    spekLauf = true;
    spekDaten = spekDaten || new Uint8Array(analyse.frequencyBinCount);
    analyse.getByteFrequencyData(spekDaten);
    const dpr = Math.min(2, window.devicePixelRatio || 1), bw = spek.clientWidth, bh = spek.clientHeight;
    if (spek.width !== Math.round(bw * dpr) || spek.height !== Math.round(bh * dpr)) { spek.width = Math.round(bw * dpr); spek.height = Math.round(bh * dpr); }
    const c = spekCtx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, bw, bh);
    const farbe = KLAENGE[aktiv].f, n = 48, nutz = Math.floor(spekDaten.length * 0.7);
    let summe = 0;
    const grad = c.createLinearGradient(0, bh, 0, 0); grad.addColorStop(0, farbe); grad.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = grad; c.shadowColor = farbe; c.shadowBlur = 10;
    const breite = bw / n;
    for (let i = 0; i < n; i++) {
      // logarithmisch verteilt, damit Höhen und Tiefen gleich viel Platz bekommen
      const a = Math.floor(Math.pow(i / n, 1.6) * nutz), b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / n, 1.6) * nutz));
      let v = 0; for (let k = a; k < b; k++) v = Math.max(v, spekDaten[k]);
      v /= 255; summe += v;
      const h = Math.max(2, v * bh * 0.95), x = i * breite;
      c.globalAlpha = 0.35 + v * 0.65;
      c.fillRect(x + breite * 0.18, bh - h, breite * 0.64, h);
    }
    c.globalAlpha = 1;
    w.sheet.style.setProperty("--pegel", (summe / n).toFixed(3));
    requestAnimationFrame(spektrum);
  }
  const spekStart = () => { if (!spekLauf) requestAnimationFrame(spektrum); };
  setInterval(spekStart, 1000); // startet von selbst, sobald ein Klang läuft und das Fenster offen ist

  // ---------- Kacheln ----------
  function zeichne() {
    const l = w.$("#kr-liste");
    if (!l) return;
    w.$$("[data-gr]").forEach((b) => b.classList.toggle("active", b.dataset.gr === gruppe));
    l.innerHTML = Object.entries(KLAENGE).filter(([, k]) => gruppe === "alle" || k.g === gruppe).map(([id, k]) => `
      <button type="button" class="kr-karte${aktiv === id ? " an" : ""}" data-k="${id}" style="--f:${k.f}" aria-pressed="${aktiv === id}">
        <span class="kr-ico">${k.icon}</span>
        <span class="kr-tx"><b>${esc(k.name)}</b><em>${esc(k.text)}</em></span>
        <span class="kr-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span class="kr-pegel" aria-hidden="true"></span>
      </button>`).join("");
    w.$("#kr-auto").checked = auto();
    w.$("#kr-laut").value = laut;
    w.$$("#kr-timer [data-min]").forEach((b) => b.classList.toggle("an", schlafEnde ? b.dataset.min !== "0" && Math.abs((schlafEnde - Date.now()) / 60000 - Number(b.dataset.min)) < Number(b.dataset.min) : b.dataset.min === "0"));
    document.body.classList.toggle("klang-an", !!aktiv);
    umschalter(); kopfZeile();
  }
  w.$("#kr-liste").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (!b) return; if (aktiv === b.dataset.k) aus(); else spiele(b.dataset.k); });
  w.sheet.querySelector(".kr-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-gr]"); if (!b) return; gruppe = b.dataset.gr; ls.set("friday_klang_gruppe", gruppe); zeichne(); });
  w.$("#kr-auto").addEventListener("change", (e) => { ls.set("friday_klang_auto", e.target.checked ? "1" : "0"); grund(e.target.checked ? "Automatik an. Öffne ein Fenster oder frag Friday etwas." : ""); kopfZeile(); });
  w.$("#kr-laut").addEventListener("input", (e) => { laut = Number(e.target.value); ls.set("friday_klang_laut", String(laut)); });
  w.$("#kr-aus").addEventListener("click", () => aus());
  w.$("#kr-timer").addEventListener("click", (e) => {
    const b = e.target.closest("[data-min]"); if (!b) return;
    const m = Number(b.dataset.min);
    schlafEnde = m ? Date.now() + m * 60000 : 0;
    grund(m ? `Schlaf-Timer: In ${m} Minuten blende ich den Klang aus.` : "Schlaf-Timer aus.");
    w.$$("#kr-timer [data-min]").forEach((x) => x.classList.toggle("an", x === b));
    kopfZeile();
  });

  const st = document.createElement("style");
  st.textContent = `
.kr-box { width: min(1060px, 100%); --kr-f: var(--cyan); }
.kr-box .hf-inhalt { gap: 12px; }
.kr-head { margin: -4px -4px 0; padding: 4px 4px 12px; border-bottom: 1px solid var(--u-rand-soft, var(--line)); background: none; position: static; }
.kr-head .sz-core b { font-size: 26px; text-shadow: 0 0 14px var(--kr-f); }
.kr-head .sz-core circle { stroke: var(--kr-f); transition: stroke .6s; }
#kr-pill-live .sz-live { background: var(--muted); box-shadow: none; animation: none; }
#kr-pill-live.an .sz-live { background: var(--ok); box-shadow: 0 0 8px var(--ok); animation: sz-puls 1.6s ease-in-out infinite; }
.kr-tabs { padding: 0 !important; }
.kr-buehne { perspective: 1500px; padding: 2px 4px 0; }
.kr-glas { position: relative; height: clamp(220px, 38vh, 380px); overflow: hidden; transform: rotateX(5deg); transform-origin: 50% 100%;
  border-radius: 46% 46% 22px 22px / 30px 30px 22px 22px; border: 1px solid color-mix(in srgb, var(--kr-f) 55%, rgba(255,150,60,.55));
  background: radial-gradient(ellipse 70% 60% at 50% 80%, rgba(255,120,20,.14), transparent 70%), #070402;
  box-shadow: 0 0 32px color-mix(in srgb, var(--kr-f) 30%, transparent), inset 0 0 40px rgba(255,138,30,.10), inset 0 1px 0 rgba(255,230,200,.35); transition: border-color .6s, box-shadow .6s; }
.kr-glas::after { content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: inherit; background: linear-gradient(115deg, transparent 20%, rgba(255,240,220,.07) 32%, transparent 44%); }
.kr-canvas, .kr-foto, .kr-video, .kr-gross canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.kr-video { object-fit: cover; opacity: 0; transition: opacity 1.2s; background: transparent; pointer-events: none; }
.kr-video.an { opacity: 1; }
.kr-rund[hidden] { display: none; }
.kr-umschalter .kr-video-knopf > .eve-marke { position: static; display: inline-block; margin-left: 5px; vertical-align: middle; font-size: 8px; padding: 2px 4px; }
.kr-umschalter .kr-video-knopf.eve-schloss { opacity: .55; }
.kr-umschalter .kr-video-knopf.eve-schloss > .eve-marke { font-size: 11px; padding: 0; }
.kr-foto { object-fit: cover; opacity: 0; transition: opacity .9s; animation: kr-zoom 40s ease-in-out infinite alternate; }
.kr-foto.an { opacity: 1; }
@keyframes kr-zoom { from { transform: scale(1.02); } to { transform: scale(1.12) translate(-1.5%, -1%); } }
.kr-oben { position: absolute; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; padding: 16px 22px 0; z-index: 2; }
.kr-szene small { display: block; font-size: 10px; letter-spacing: .28em; color: rgba(255,220,190,.75); }
.kr-szene b { font: 700 18px var(--font-head, var(--font)); letter-spacing: .1em; text-transform: uppercase; color: #fff; text-shadow: 0 0 14px var(--kr-f), 0 2px 8px #000; }
.kr-knoepfe { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.kr-umschalter { display: inline-flex; border: 1px solid rgba(255,170,90,.5); border-radius: 999px; overflow: hidden; background: rgba(10,5,2,.6); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.kr-umschalter button { border: 0; background: none; color: rgba(255,230,210,.75); font: inherit; font-size: 12px; padding: 6px 11px; cursor: pointer; }
.kr-umschalter button.an { background: linear-gradient(135deg, var(--cyan), color-mix(in srgb, var(--cyan) 70%, #ff4d00)); color: #140800; font-weight: 700; }
.kr-rund { width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,170,90,.5); background: rgba(10,5,2,.6); color: #ffe2c8; font: inherit; font-size: 15px; cursor: pointer; display: grid; place-items: center; }
.kr-rund:hover, .kr-umschalter button:hover { box-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 50%, transparent); }
.kr-leer { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 8px; color: var(--muted); font-size: 14px; padding: 0 20px; z-index: 1; }
.kr-leer span { font-size: 44px; filter: drop-shadow(0 0 14px var(--cyan)); animation: sz-puls 2.4s ease-in-out infinite; }
.kr-leer[hidden] { display: none; }
.kr-unten { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 16px 12px; z-index: 2; display: flex; flex-direction: column; gap: 6px; }
.kr-wo { background: rgba(8,4,2,.62); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); border: 1px solid rgba(255,160,80,.35); border-radius: 14px; padding: 8px 10px; }
.kr-wo-titel { display: block; font-size: 12px; letter-spacing: .06em; color: #ffd9b8; margin-bottom: 6px; }
.kr-chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.kr-chips::-webkit-scrollbar { display: none; }
.kr-chip { flex: 0 0 auto; border: 1px solid rgba(140,190,255,.45); background: rgba(40,70,120,.28); color: #eaf3ff; border-radius: 999px; padding: 5px 10px; font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; }
.kr-chip em { font-style: normal; opacity: .7; margin-left: 4px; }
.kr-chip:hover, .kr-chip.an { border-color: var(--cyan); background: color-mix(in srgb, var(--cyan) 22%, transparent); box-shadow: 0 0 10px color-mix(in srgb, var(--cyan) 40%, transparent); }
.kr-credit { align-self: flex-end; font-size: 10.5px; color: rgba(255,235,220,.8); background: rgba(0,0,0,.5); padding: 3px 8px; border-radius: 8px; text-decoration: none; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kr-credit[hidden], .kr-wo[hidden] { display: none; }
.kr-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.kr-karte { position: relative; display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 12px; border: 1px solid var(--u-rand-soft, var(--line)); background: var(--u-karte, rgba(255,138,30,.05)); color: var(--text); font: inherit; text-align: left; cursor: pointer; overflow: hidden; transition: border-color .2s, box-shadow .2s, transform .15s; }
.kr-karte::before { content: ""; position: absolute; left: 0; top: 10%; bottom: 10%; width: 3px; border-radius: 3px; background: var(--f); box-shadow: 0 0 10px var(--f); opacity: .55; }
.kr-karte:hover { border-color: var(--f); transform: translateY(-1px); }
.kr-ico { flex: none; width: 38px; height: 38px; display: grid; place-items: center; border-radius: 11px; font-size: 20px; border: 1px solid color-mix(in srgb, var(--f) 45%, transparent); background: color-mix(in srgb, var(--f) 12%, transparent); }
.kr-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.kr-tx b { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kr-tx em { font-style: normal; font-size: 11.5px; line-height: 1.3; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.kr-eq { display: none; gap: 2px; align-items: flex-end; height: 16px; }
.kr-eq i { width: 3px; background: var(--f); border-radius: 2px; box-shadow: 0 0 6px var(--f); animation: kr-eq 0.9s ease-in-out infinite; }
.kr-eq i:nth-child(2) { animation-delay: -.3s; } .kr-eq i:nth-child(3) { animation-delay: -.6s; } .kr-eq i:nth-child(4) { animation-delay: -.15s; }
@keyframes kr-eq { 0%,100% { height: 4px; } 50% { height: 16px; } }
.kr-karte.an { border-color: var(--f); box-shadow: 0 0 18px color-mix(in srgb, var(--f) 40%, transparent), inset 0 0 22px color-mix(in srgb, var(--f) 14%, transparent); }
.kr-karte.an::before { opacity: 1; }
.kr-karte.an .kr-eq { display: flex; }
.kr-steuer { display: grid; grid-template-columns: 1.3fr 1.3fr 1fr auto; gap: 8px; align-items: stretch; }
.kr-st small { display: block; font-size: 10.5px; letter-spacing: .14em; color: var(--muted); margin-bottom: 4px; }
.kr-st .switch span { font-size: 12.5px; }
.kr-timer { display: flex; gap: 4px; flex-wrap: wrap; }
.kr-timer button { border: 1px solid var(--u-rand-soft, var(--line)); background: transparent; color: var(--muted); border-radius: 8px; padding: 5px 8px; font: inherit; font-size: 12px; cursor: pointer; }
.kr-timer button.an { color: var(--text); border-color: var(--cyan); background: color-mix(in srgb, var(--cyan) 16%, transparent); }
.kr-stopp { align-self: stretch; }
.kr-gross { position: fixed; inset: 0; z-index: 90; background: #000; }
.kr-gross[hidden] { display: none; }
.kr-gross-titel { position: absolute; left: 28px; top: calc(22px + env(safe-area-inset-top)); z-index: 2; }
.kr-gross-titel small { display: block; font-size: 11px; letter-spacing: .3em; color: rgba(255,220,190,.7); }
.kr-gross-titel b { font: 700 24px var(--font-head, var(--font)); letter-spacing: .1em; text-transform: uppercase; color: #fff; text-shadow: 0 0 16px var(--cyan), 0 2px 10px #000; }
.kr-gross-x { position: absolute; right: 22px; top: calc(20px + env(safe-area-inset-top)); z-index: 2; width: 40px; height: 40px; }
@media (max-width: 900px) {
  .kr-head { grid-template-columns: auto 1fr auto !important; }
  .kr-head .sz-meta { display: none; }
  .kr-glas { height: 250px; transform: none; border-radius: 18px; }
  .kr-oben { padding: 12px 12px 0; flex-direction: column; }
  .kr-knoepfe { justify-content: flex-start; }
  .kr-szene b { font-size: 15px; }
  .kr-raster { grid-template-columns: 1fr 1fr; }
  .kr-karte { padding: 8px; gap: 8px; }
  .kr-ico { width: 32px; height: 32px; font-size: 17px; }
  .kr-tx b { font-size: 13px; }
  .kr-steuer { grid-template-columns: 1fr; }
}
html.perf-fluessig .kr-foto { animation: none; }
@media (prefers-reduced-motion: reduce) { .kr-foto, .kr-eq i { animation: none; } }
/* ---- Klang-Plus (v1.145.0, nur in Eve bis zur Freigabe) ---- */
.kr-spektrum { position: absolute; left: 0; right: 0; bottom: 0; height: 34%; width: 100%; z-index: 1; pointer-events: none; display: none; opacity: .85; mix-blend-mode: screen; }
.kr-plus .kr-spektrum { display: block; }
.kr-plus .kr-head .sz-core svg { transform: scale(calc(1 + var(--pegel, 0) * .35)); transition: transform .12s; filter: drop-shadow(0 0 calc(4px + var(--pegel, 0) * 26px) var(--kr-f)); }
.kr-plus .kr-glas { box-shadow: 0 0 calc(24px + var(--pegel, 0) * 60px) color-mix(in srgb, var(--kr-f) 38%, transparent), inset 0 0 40px rgba(255,138,30,.10), inset 0 1px 0 rgba(255,230,200,.35); }
.kr-plus .kr-raster { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.kr-plus .kr-karte { padding: 12px; border-radius: 16px; gap: 12px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--f) 16%, rgba(12,7,3,.9)), rgba(12,7,3,.75) 65%);
  border-color: color-mix(in srgb, var(--f) 30%, transparent); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.kr-plus .kr-karte::before { display: none; }
.kr-plus .kr-karte::after { content: ""; position: absolute; inset: -40% -10% auto auto; width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--f) 35%, transparent), transparent 70%); opacity: .35; transition: opacity .3s; pointer-events: none; }
.kr-plus .kr-karte:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.35), 0 0 16px color-mix(in srgb, var(--f) 30%, transparent); }
.kr-plus .kr-karte:hover::after { opacity: .7; }
.kr-plus .kr-ico { width: 46px; height: 46px; border-radius: 50%; font-size: 23px; position: relative; z-index: 1;
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--f) 45%, transparent), color-mix(in srgb, var(--f) 10%, transparent) 70%);
  border: 1px solid color-mix(in srgb, var(--f) 70%, transparent); box-shadow: 0 0 14px color-mix(in srgb, var(--f) 35%, transparent), inset 0 0 10px color-mix(in srgb, var(--f) 30%, transparent); }
.kr-plus .kr-tx { position: relative; z-index: 1; }
.kr-plus .kr-tx b { font-size: 14.5px; letter-spacing: .02em; }
.kr-pegel { display: none; }
.kr-plus .kr-karte.an .kr-eq { display: none; }
.kr-plus .kr-karte.an .kr-pegel { display: block; position: absolute; left: 12px; right: 12px; bottom: 6px; height: 3px; border-radius: 3px; z-index: 1; background: rgba(255,255,255,.08); overflow: hidden; }
.kr-plus .kr-karte.an .kr-pegel::after { content: ""; position: absolute; inset: 0; transform-origin: left; transform: scaleX(calc(.08 + var(--pegel, 0) * 2.2)); background: linear-gradient(90deg, var(--f), #fff); box-shadow: 0 0 10px var(--f); transition: transform .1s; }
.kr-plus .kr-karte.an { box-shadow: 0 0 26px color-mix(in srgb, var(--f) 45%, transparent), inset 0 0 26px color-mix(in srgb, var(--f) 16%, transparent); border-color: var(--f); }
.kr-plus .kr-karte.an .kr-ico { animation: kr-atmen 2.8s ease-in-out infinite; }
@keyframes kr-atmen { 0%,100% { box-shadow: 0 0 12px color-mix(in srgb, var(--f) 40%, transparent); } 50% { box-shadow: 0 0 26px var(--f); } }
@media (max-width: 900px) { .kr-plus .kr-raster { grid-template-columns: 1fr 1fr; } .kr-plus .kr-ico { width: 36px; height: 36px; font-size: 18px; } .kr-plus .kr-karte { padding: 10px; } }
html.perf-fluessig .kr-plus .kr-karte { -webkit-backdrop-filter: none; backdrop-filter: none; }
@media (prefers-reduced-motion: reduce) { .kr-plus .kr-karte.an .kr-ico { animation: none; } }`;
  document.head.appendChild(st);
  zeichne();

  window.FridayKlang = {
    open: () => w.auf(),
    offen: w.offen,
    spiele,
    aus,
    auto: (an = true) => { ls.set("friday_klang_auto", an ? "1" : "0"); zeichne(); },
    aktiv: () => aktiv,
    // "Kaminfeuer mit Video": Ansicht umschalten (Video nur, wenn frei – in Friday erst nach Freigabe in Eve)
    ansicht: (neu) => {
      if (!["anim", "foto", "video"].includes(neu)) return;
      w.auf();
      if (neu === "video" && !videoFrei()) { grund("🔒 Videos zum Stimmungs-Sound sind noch im Test. Probier sie in Eve aus und gib sie dort frei."); return; }
      w.sheet.querySelector(`.kr-umschalter [data-ansicht="${neu}"]`)?.click();
    },
    // "Wo regnet es gerade?": Fenster auf, Klang an, Foto aus der ersten passenden Stadt
    wo: async (art = "regen") => {
      if (!WO_TEXT[art]) art = "regen";
      w.auf(); spiele(art);
      gruppe = "alle"; zeichne();
      try {
        const d = await H.json(`/api/klang/wo?art=${art}`);
        woDaten = { ...d, at: Date.now() }; woFuer = art;
        if (d.orte?.[0]) zeigeOrt(d.orte[0].name); else zeigeWo(art);
      } catch { /* Fenster zeigt den Hinweis */ }
    },
  };
})();
