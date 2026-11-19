// F.R.Ai.D.A.Y Stimmungs-Sound (v1.106.0)
// Regen, Meer, Wald, Kaminfeuer, Fokus-Rauschen, Nacht, Weltraum und Energie-Puls – alles live im Browser
// erzeugt (Web Audio, keine Downloads, kein Guthaben).
// Automatik: Friday passt den Klang an das an, was du GERADE IN FRIDAY machst (welches Fenster offen ist,
// was du Friday sagst oder tippst – z. B. Code → Fokus, Reise → Meer, Lesen/Schreiben → Regen, Kochen → Kamin).
// Friday liest nichts außerhalb von Friday mit. Während Friday spricht, wird der Klang leiser.
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc } = H;
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* egal */ } },
  };
  const KLAENGE = {
    regen: { icon: "🌧", name: "Regen", text: "Lesen, Schreiben, Nachdenken" },
    meer: { icon: "🌊", name: "Meer", text: "Reise, Fernweh, Entspannen" },
    wald: { icon: "🌲", name: "Wald & Vögel", text: "Ruhe, Stress abbauen" },
    kamin: { icon: "🔥", name: "Kaminfeuer", text: "Kochen, gemütlich" },
    fokus: { icon: "🎯", name: "Fokus-Rauschen", text: "Code, Arbeit, Lernen" },
    nacht: { icon: "🌙", name: "Sommernacht", text: "Abend, Einschlafen" },
    weltraum: { icon: "🪐", name: "Weltraum", text: "Weltgeschehen, Sci-Fi" },
    puls: { icon: "⚡", name: "Energie-Puls", text: "Spiele, Sport, Motivation" },
  };
  // Welches Fenster passt zu welchem Klang?
  const FENSTER_KLANG = { spiele: "puls", lage: "weltraum", zentrale: "weltraum", oekosystem: "weltraum", routen: "meer", kuehl: "kamin", gegen: "regen", dok: "regen", ideen: "fokus", werkstatt: "fokus", webseiten: "fokus", kauf: "fokus", markt: "fokus", logbuch: "regen", archiv: "regen" };
  // Worte in dem, was du zu Friday sagst/tippst
  const WORT_KLANG = [
    ["fokus", /\b(code|programm|programmier|bug|server|javascript|python|lernen|prüfung|pruefung|hausaufgabe|konzentr|arbeit|projekt|excel|präsentation|praesentation)/i],
    ["meer", /\b(reise|urlaub|flug|strand|meer|insel|hotel|route|nach (mallorca|italien|spanien|kroatien|griechenland)|ferien)/i],
    ["regen", /\b(buch|lesen|roman|artikel|schreib|text|brief|gedicht|geschichte|entwurf|studie)/i],
    ["kamin", /\b(koch|rezept|backen|essen|abendessen|kühlschrank|kuehlschrank|winter|weihnacht|gemütlich|gemuetlich)/i],
    ["nacht", /\b(schlafen|müde|muede|gute nacht|einschlafen|abend)/i],
    ["wald", /\b(stress|gestresst|entspann|wütend|wuetend|genervt|ruhe|meditat|atmen)/i],
    ["puls", /\b(sport|training|workout|laufen|joggen|party|motivation|spiel)/i],
    ["weltraum", /\b(weltall|weltraum|planet|mars|nasa|iss|sterne|krieg|weltlage|nachrichten)/i],
  ];

  // ---------- Klangerzeugung ----------
  let generation = 0, wechselt = false;
  let ctx = null, master = null, aktiv = null, knoten = [], timer = [], laut = Number(ls.get("friday_klang_laut") || 0.5);
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
  function ton(f, dauer, typ = "sine", vol = 0.1, ziel = master, fEnde = null) {
    const o = ctx.createOscillator(), g = gain(0), t = ctx.currentTime;
    o.type = typ; o.frequency.setValueAtTime(f, t);
    if (fEnde) o.frequency.exponentialRampToValueAtTime(fEnde, t + dauer);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dauer / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    o.connect(g); g.connect(ziel); o.start(t); o.stop(t + dauer + 0.05);
  }
  function knack(vol = 0.15) {
    const s = rauschen("weiss"), g = gain(0), f = filter("bandpass", 1500 + Math.random() * 2500, 2), t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.05);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.12);
  }
  const BAU = {
    regen() { const s = rauschen("rosa"); kette(s, filter("highpass", 500), filter("lowpass", 7000), gain(0.55), master); s.start(); const b = rauschen("braun"); kette(b, filter("lowpass", 300), gain(0.25), master); b.start(); zufall(() => knack(0.05), 60, 260); },
    meer() { const s = rauschen("braun"); const g = gain(0.5); kette(s, filter("lowpass", 900), g, master); lfo(g.gain, 0.09, 0.35, 0.45); s.start(); const r = rauschen("rosa"); const g2 = gain(0.1); kette(r, filter("highpass", 1500), g2, master); lfo(g2.gain, 0.09, 0.08, 0.1); r.start(); },
    wald() { const s = rauschen("rosa"); const g = gain(0.18); kette(s, filter("lowpass", 700), g, master); lfo(g.gain, 0.05, 0.08, 0.18); s.start(); zufall(() => { const f = 2400 + Math.random() * 2000; const n = 2 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) setTimeout(() => ton(f * (0.9 + Math.random() * 0.25), 0.09 + Math.random() * 0.08, "sine", 0.05, master, f * 1.3), i * 120); }, 1200, 4500); },
    kamin() { const s = rauschen("braun"); kette(s, filter("lowpass", 500), gain(0.55), master); s.start(); zufall(() => knack(0.12 + Math.random() * 0.2), 40, 400); },
    fokus() { const s = rauschen("braun"); kette(s, filter("lowpass", 420), gain(0.8), master); s.start(); },
    nacht() { const s = rauschen("braun"); kette(s, filter("lowpass", 250), gain(0.3), master); s.start(); zufall(() => { for (let i = 0; i < 3; i++) setTimeout(() => ton(4300 + Math.random() * 200, 0.04, "sine", 0.025), i * 60); }, 500, 1400); },
    weltraum() { [55, 82.4, 110.3, 164.8].forEach((f, i) => { const o = ctx.createOscillator(); o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 12; const fi = filter("lowpass", 600); const g = gain(0.07); kette(o, fi, g, master); lfo(fi.frequency, 0.03 + i * 0.01, 250, 600); o.start(); }); const s = rauschen("rosa"); kette(s, filter("bandpass", 900, 0.5), gain(0.03), master); s.start(); },
    puls() { let n = 0; const akk = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 294]]; const schritt = () => { const t = ctx.currentTime; const o = ctx.createOscillator(), g = gain(0); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); g.gain.linearRampToValueAtTime(0.35, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3); if (n % 2) knack(0.05); if (n % 8 === 0) akk[(n / 8) % 4].forEach((f) => ton(f, 2.2, "triangle", 0.025)); n++; }; schritt(); const id = setInterval(schritt, 480); timer.push({ iv: id }); },
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
      if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination); }
      ctx.resume?.();
    } catch { return; }
    if (aktiv === id) return;
    const g = ++generation;
    const wechsel = () => { if (g !== generation) return; wechselt = false; stoppeKlang(); aktiv = id; BAU[id](); master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(zielLaut(), ctx.currentTime, leise ? 1 : 0.4); zeichne(); };
    if (aktiv || knoten.length) { wechselt = true; master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, 0.2); setTimeout(wechsel, 850); } else wechsel();
    ls.set("friday_klang_letzter", id);
  }
  function aus() {
    if (!ctx || !aktiv) { aktiv = null; zeichne(); return; }
    const g = ++generation;
    wechselt = false;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    setTimeout(() => { if (g === generation) stoppeKlang(); }, 1300);
    aktiv = null; zeichne();
  }
  // Leiser, während Friday spricht
  const sprichtGerade = () => document.getElementById("reactor")?.classList.contains("speaking");
  const zielLaut = () => laut * 0.6 * (sprichtGerade() ? 0.25 : 1);
  setInterval(() => { if (ctx && aktiv && !wechselt) master.gain.setTargetAtTime(zielLaut(), ctx.currentTime, 0.25); }, 300);

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

  // ---------- Fenster ----------
  const w = H.fenster({
    id: "klang", titel: "🎧 Stimmungs-Sound",
    html: `
      <div class="hf-raster" id="kr-liste" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))"></div>
      <div class="hf-karte">
        <div class="hf-reihe"><label class="switch" style="flex:1"><input type="checkbox" id="kr-auto"><span><b>Automatik</b> – passt den Klang an, was du gerade in Friday machst (Fenster, Fragen). Nichts außerhalb von Friday wird mitgelesen.</span></label></div>
        <div class="hf-reihe" style="margin-top:10px"><span class="hf-hinweis">🔈</span><input id="kr-laut" type="range" min="0" max="1" step="0.05" class="grow" aria-label="Lautstärke"><span class="hf-hinweis">🔊</span><button id="kr-aus" class="hf-btn leise" type="button">⏹ Aus</button></div>
        <div id="kr-grund" class="hf-hinweis" style="margin-top:8px"></div>
      </div>
      <p class="hf-hinweis">Alle Klänge entstehen live auf deinem Gerät – kein Download, kein Guthaben. Während Friday spricht, wird es automatisch leiser. Sag: „Friday, spiel Regen“, „Fokus-Sound“, „Stimmungs-Sound automatisch“ oder „Sound aus“.</p>`,
    onOpen: () => zeichne(),
  });
  function zeichne() {
    const l = w.$("#kr-liste");
    if (!l) return;
    l.innerHTML = Object.entries(KLAENGE).map(([id, k]) => `<button type="button" class="hf-karte hf-klang${aktiv === id ? " an" : ""}" data-k="${id}" style="cursor:pointer;text-align:left;color:var(--text);font:inherit"><span style="font-size:26px">${k.icon}</span><br><b>${esc(k.name)}</b><br><span class="hf-hinweis">${esc(k.text)}</span></button>`).join("");
    w.$("#kr-auto").checked = auto();
    w.$("#kr-laut").value = laut;
    document.body.classList.toggle("klang-an", !!aktiv);
  }
  w.$("#kr-liste").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (!b) return; if (aktiv === b.dataset.k) aus(); else spiele(b.dataset.k); });
  w.$("#kr-auto").addEventListener("change", (e) => { ls.set("friday_klang_auto", e.target.checked ? "1" : "0"); w.$("#kr-grund").textContent = e.target.checked ? "Automatik an. Öffne ein Fenster oder frag Friday etwas." : ""; });
  w.$("#kr-laut").addEventListener("input", (e) => { laut = Number(e.target.value); ls.set("friday_klang_laut", String(laut)); });
  w.$("#kr-aus").addEventListener("click", () => aus());
  const st = document.createElement("style");
  st.textContent = `.hf-klang.an { border-color: var(--cyan) !important; box-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 45%, transparent), inset 0 0 20px color-mix(in srgb, var(--cyan) 14%, transparent); animation: kr-puls 2.4s ease-in-out infinite; }
@keyframes kr-puls { 50% { box-shadow: 0 0 28px color-mix(in srgb, var(--cyan) 65%, transparent), inset 0 0 26px color-mix(in srgb, var(--cyan) 22%, transparent); } }`;
  document.head.appendChild(st);
  zeichne();

  window.FridayKlang = {
    open: () => w.auf(),
    offen: w.offen,
    spiele,
    aus,
    auto: (an = true) => { ls.set("friday_klang_auto", an ? "1" : "0"); zeichne(); },
    aktiv: () => aktiv,
  };
})();
