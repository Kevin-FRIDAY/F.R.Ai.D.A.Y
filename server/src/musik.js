// Fridays Komponist: erzeugt Musik komplett selbst (Synthesizer in JavaScript, keine Samples, keine Lizenzen).
// komponiere({ stimmung, sekunden, datei }) schreibt eine Stereo-WAV-Datei (44,1 kHz, 16 Bit).
// Stimmungen: neon (Synthwave), episch, chill, energie, froehlich, spannend.
import fs from "node:fs";

const SR = 44100;

// Noten: Halbtöne relativ zu A (A4 = 440 Hz). Akkorde als Halbtöne über dem Grundton der Tonart.
const hz = (halbton) => 440 * Math.pow(2, halbton / 12);

export const STIMMUNGEN = {
  neon: { name: "Neon (Synthwave)", bpm: 100, grund: -12, akkorde: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], schlag: "gated", arp: "achtel", bass: "achtel" },
  episch: { name: "Episch", bpm: 84, grund: -12, akkorde: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], schlag: "trommel", arp: "viertel", bass: "lang" },
  chill: { name: "Chill", bpm: 82, grund: -16, akkorde: [[0, 4, 7, 11], [-1, 2, 7, 10], [-3, 0, 5, 9], [-5, -1, 4, 7]], schlag: "locker", arp: "piano", bass: "lang" },
  energie: { name: "Energie", bpm: 124, grund: -12, akkorde: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], schlag: "club", arp: "sechzehntel", bass: "offbeat" },
  froehlich: { name: "Fröhlich", bpm: 112, grund: -9, akkorde: [[0, 4, 7], [7, 11, 14], [-3, 0, 4], [5, 9, 12]], schlag: "pop", arp: "achtel", bass: "achtel" },
  spannend: { name: "Spannend", bpm: 96, grund: -12, akkorde: [[0, 3, 7], [0, 3, 7], [1, 5, 8], [0, 3, 6]], schlag: "tick", arp: "puls", bass: "puls" },
};
export const STIMMUNG_IDS = Object.keys(STIMMUNGEN);
const TONART = { "-12": "a-Moll", "-16": "F-Dur", "-9": "C-Dur" };

/** Passt eine Beschreibung ("ruhig", "action", "traurig" …) zu einer Stimmung? */
export function stimmungAus(text = "") {
  const t = String(text || "").toLowerCase();
  if (/epi(sch|c)|kino|film|helden|gewaltig|orchest|trailer|dramat/.test(t)) return "episch";
  if (/chill|ruhig|entspann|lo-?fi|sanft|soft|gemütlich|gemuetlich|lounge|traurig|romant/.test(t)) return "chill";
  if (/energ|action|schnell|power|party|dance|techno|edm|sport|motivation|club|workout/.test(t)) return "energie";
  if (/fröhlich|froehlich|lustig|happy|gute laune|sommer|bunt|kinder|spaß|spass|pop/.test(t)) return "froehlich";
  if (/spannend|spannung|krimi|thriller|myster|dunkel|düster|duester|horror|nachrichten|news/.test(t)) return "spannend";
  if (/neon|synth|retro|80er|cyber|zukunft|futur|tech|ki\b|ai\b|friday|iron/.test(t)) return "neon";
  return null;
}

// Kleiner, wiederholbarer Zufall (damit dasselbe Video gleich klingt).
function zufall(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

/**
 * Komponiert ein Stück und schreibt es als WAV.
 * @returns {{ stimmung:string, name:string, bpm:number, tonart:string, takte:number, sekunden:number }}
 */
export function komponiere({ stimmung = "neon", sekunden = 20, datei, seed = Date.now() } = {}) {
  const st = STIMMUNGEN[stimmung] || STIMMUNGEN.neon;
  const id = STIMMUNGEN[stimmung] ? stimmung : "neon";
  const T = Math.max(3, Math.min(180, Number(sekunden) || 20));
  const n = Math.ceil(T * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const hallL = new Float32Array(n), hallR = new Float32Array(n); // Effekt-Weg (Echo/Hall)
  const rnd = zufall(seed);
  const beat = 60 / st.bpm;
  const takt = beat * 4;
  const takte = Math.ceil(T / takt);

  const leg = (buf, i, v) => { if (i >= 0 && i < n) buf[i] += v; };
  function note(start, dauer, f, art, vol, pan = 0, hall = 0.25) {
    const s0 = Math.floor(start * SR);
    if (s0 >= n) return;
    const lang = art === "pad" ? dauer + 0.8 : art === "bass" ? dauer + 0.08 : dauer + 0.5;
    const len = Math.min(n - s0, Math.floor(lang * SR));
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    let lp = 0, lp2 = 0, ph1 = rnd(), ph2 = rnd(), ph3 = rnd();
    const d1 = f * 1.004, d2 = f * 0.996;
    for (let k = 0; k < len; k++) {
      const t = k / SR;
      let v = 0, env = 1;
      if (art === "pad") {
        ph1 = (ph1 + f / SR) % 1; ph2 = (ph2 + d1 / SR) % 1; ph3 = (ph3 + d2 / SR) % 1;
        const roh = (ph1 * 2 - 1) + (ph2 * 2 - 1) + (ph3 * 2 - 1);
        const cut = 0.09 + 0.035 * Math.sin(t * 1.3 + start);
        lp += cut * (roh - lp); lp2 += cut * (lp - lp2);
        v = lp2 / 3;
        env = Math.min(1, t / 0.45) * (t > dauer ? Math.exp(-(t - dauer) * 4) : 1);
      } else if (art === "bass") {
        ph1 = (ph1 + f / SR) % 1; ph2 = (ph2 + f / 2 / SR) % 1;
        const roh = (ph1 * 2 - 1) * 0.6 + Math.sin(ph2 * 2 * Math.PI) * 0.8;
        lp += 0.06 * (roh - lp);
        v = lp;
        env = Math.min(1, t / 0.008) * (t > dauer ? Math.exp(-(t - dauer) * 40) : 0.75 + 0.25 * Math.exp(-t * 6));
      } else if (art === "pluck") {
        ph1 = (ph1 + f / SR) % 1; ph2 = (ph2 + d1 / SR) % 1;
        const roh = (ph1 < 0.5 ? 1 : -1) * 0.5 + (ph2 * 2 - 1) * 0.5;
        const cut = 0.04 + 0.35 * Math.exp(-t * 18);
        lp += cut * (roh - lp);
        v = lp;
        env = Math.min(1, t / 0.003) * Math.exp(-t * 7);
      } else if (art === "piano") {
        ph1 = (ph1 + f / SR) % 1;
        v = Math.sin(ph1 * 2 * Math.PI) + 0.25 * Math.sin(ph1 * 4 * Math.PI) * Math.exp(-t * 6) + 0.08 * Math.sin(ph1 * 6 * Math.PI) * Math.exp(-t * 10);
        env = Math.min(1, t / 0.004) * Math.exp(-t * 2.6);
      }
      const x = v * env * vol;
      leg(L, s0 + k, x * gl); leg(R, s0 + k, x * gr);
      if (hall) { leg(hallL, s0 + k, x * gl * hall); leg(hallR, s0 + k, x * gr * hall); }
    }
  }
  function trommel(start, art, vol = 1) {
    const s0 = Math.floor(start * SR);
    if (s0 >= n) return;
    const lang = { kick: 0.45, snare: 0.32, hat: 0.06, clap: 0.25, tom: 0.6, tick: 0.03, gated: 0.28 }[art] || 0.2;
    const len = Math.min(n - s0, Math.floor(lang * SR));
    let ph = 0, hp = 0, prev = 0, bp = 0;
    for (let k = 0; k < len; k++) {
      const t = k / SR;
      let v = 0;
      if (art === "kick" || art === "tom") {
        const f0 = art === "kick" ? 46 + 110 * Math.exp(-t * 32) : 70 + 60 * Math.exp(-t * 14);
        ph += f0 / SR;
        v = Math.sin(ph * 2 * Math.PI) * Math.exp(-t * (art === "kick" ? 7 : 4.5)) * (art === "kick" ? 1.15 : 0.9);
        if (art === "kick" && t < 0.004) v += (rnd() * 2 - 1) * 0.35;
      } else {
        const noise = rnd() * 2 - 1;
        hp = 0.92 * (hp + noise - prev); prev = noise;
        if (art === "hat" || art === "tick") v = hp * Math.exp(-t * (art === "tick" ? 120 : 60)) * 0.45;
        else if (art === "snare" || art === "gated") {
          ph += 185 / SR;
          bp += 0.35 * (hp - bp);
          const decay = art === "gated" ? (t < 0.2 ? 1 : Math.exp(-(t - 0.2) * 60)) : Math.exp(-t * 16);
          v = (bp * 0.8 + Math.sin(ph * 2 * Math.PI) * 0.35 * Math.exp(-t * 25)) * decay * 0.75;
        } else if (art === "clap") {
          const burst = [0, 0.011, 0.022].some((b) => t >= b && t < b + 0.008) ? 1 : 0;
          v = hp * (burst + Math.exp(-t * 18) * 0.7) * 0.6;
        }
      }
      const x = v * vol;
      leg(L, s0 + k, x); leg(R, s0 + k, x);
      if (art === "snare" || art === "clap" || art === "gated") { leg(hallL, s0 + k, x * 0.35); leg(hallR, s0 + k, x * 0.35); }
    }
  }

  // ---------- Arrangement ----------
  const g = st.grund;
  for (let b = 0; b < takte; b++) {
    const t0 = b * takt;
    const akk = st.akkorde[b % st.akkorde.length];
    const intro = b === 0 && takte > 2;
    const letzter = b === takte - 1;
    // Fläche (Pad): ganzer Takt
    akk.forEach((h, i) => note(t0, takt, hz(g + h + 12), "pad", 0.16, (i - 1) * 0.5, 0.5));
    // Bass
    const bt = hz(g + akk[0] - 12);
    if (!intro) {
      if (st.bass === "lang") { note(t0, takt * 0.5, bt, "bass", 0.5); note(t0 + takt * 0.5, takt * 0.5, bt, "bass", 0.42); }
      else if (st.bass === "offbeat") for (let i = 0; i < 4; i++) note(t0 + i * beat + beat / 2, beat * 0.42, bt, "bass", 0.55);
      else if (st.bass === "puls") for (let i = 0; i < 8; i++) note(t0 + i * beat / 2, beat * 0.3, bt, "bass", i % 2 ? 0.38 : 0.5);
      else for (let i = 0; i < 8; i++) note(t0 + i * beat / 2, beat * 0.4, i % 4 === 3 ? bt * 2 : bt, "bass", 0.45);
    }
    // Melodie / Arpeggio
    const ton = (i) => hz(g + akk[i % akk.length] + 12 * (1 + Math.floor(i / akk.length) % 2) + 12);
    if (st.arp === "sechzehntel" && !intro) for (let i = 0; i < 16; i++) note(t0 + i * beat / 4, beat / 4, ton(i), "pluck", 0.14, i % 2 ? 0.4 : -0.4, 0.35);
    else if (st.arp === "achtel") for (let i = 0; i < 8; i++) note(t0 + i * beat / 2, beat / 2, ton([0, 1, 2, 3, 2, 1, 0, 2][i]), "pluck", intro ? 0.08 : 0.13, i % 2 ? 0.45 : -0.45, 0.4);
    else if (st.arp === "viertel") for (let i = 0; i < 4; i++) note(t0 + i * beat, beat, ton([0, 2, 1, 3][i]), "pluck", 0.12, i % 2 ? 0.3 : -0.3, 0.55);
    else if (st.arp === "piano") { [0, 1.5, 2.5].forEach((p, i) => akk.forEach((h, j) => note(t0 + p * beat + j * 0.012, beat * 1.2, hz(g + h + 12), "piano", 0.09 - i * 0.015, (j - 1.5) * 0.3, 0.45))); }
    else if (st.arp === "puls") for (let i = 0; i < 8; i++) note(t0 + i * beat / 2, beat / 4, hz(g + akk[0] + 24 + (i === 7 ? 1 : 0)), "pluck", 0.1, i % 2 ? 0.5 : -0.5, 0.45);
    // Schlagzeug
    if (intro) { if (st.schlag !== "locker") for (let i = 0; i < 4; i++) trommel(t0 + takt - beat / 4 * (4 - i), "snare", 0.15 + i * 0.12); continue; }
    if (letzter) { trommel(t0, "kick", 1); trommel(t0, st.schlag === "trommel" ? "tom" : "clap", 0.6); continue; }
    for (let i = 0; i < 4; i++) {
      const tt = t0 + i * beat;
      if (st.schlag === "club") { trommel(tt, "kick"); trommel(tt + beat / 2, "hat", 1.1); if (i % 2) trommel(tt, "clap", 0.8); trommel(tt + beat / 4, "hat", 0.4); trommel(tt + beat * 0.75, "hat", 0.4); }
      else if (st.schlag === "gated") { if (i % 2 === 0) trommel(tt, "kick"); else trommel(tt, "gated", 0.9); trommel(tt, "hat", 0.5); trommel(tt + beat / 2, "hat", 0.7); }
      else if (st.schlag === "trommel") { if (i === 0 || i === 2) trommel(tt, "kick", 0.9); if (i === 3) { trommel(tt, "tom", 0.8); trommel(tt + beat / 2, "tom", 0.6); } if (i === 2) trommel(tt, "snare", 0.5); }
      else if (st.schlag === "locker") { if (i === 0) trommel(tt, "kick", 0.7); if (i === 2) trommel(tt + beat / 2, "kick", 0.5); if (i % 2) trommel(tt, "snare", 0.35); trommel(tt + beat * 0.58, "hat", 0.45); }
      else if (st.schlag === "pop") { if (i % 2 === 0) trommel(tt, "kick", 0.9); else trommel(tt, "clap", 0.8); trommel(tt, "hat", 0.5); trommel(tt + beat / 2, "hat", 0.6); }
      else if (st.schlag === "tick") { if (i === 0) trommel(tt, "kick", 0.9); if (i === 2) trommel(tt + beat / 2, "kick", 0.6); for (let q = 0; q < 4; q++) trommel(tt + q * beat / 4, "tick", q === 0 ? 1 : 0.6); }
    }
  }

  // ---------- Echo/Hall (Ping-Pong auf dem Effekt-Weg) ----------
  const d1 = Math.floor(beat * 0.75 * SR), d2 = Math.floor(beat * 0.5 * SR);
  for (let i = 0; i < n; i++) {
    const a = i >= d1 ? hallR[i - d1] * 0.42 : 0;
    const b = i >= d2 ? hallL[i - d2] * 0.38 : 0;
    hallL[i] += a; hallR[i] += b;
  }
  // ---------- Mastering: Mischen, weich begrenzen, Ein- und Ausblenden ----------
  let spitze = 0;
  for (let i = 0; i < n; i++) {
    L[i] += hallL[i] * 0.55; R[i] += hallR[i] * 0.55;
    spitze = Math.max(spitze, Math.abs(L[i]), Math.abs(R[i]));
  }
  const pegel = spitze > 0 ? 1.25 / spitze : 1;
  const ausAb = Math.max(0, T - 1.6);
  const buf = Buffer.alloc(44 + n * 4);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const fade = Math.min(1, t / 0.15) * (t > ausAb ? Math.max(0, 1 - (t - ausAb) / 1.6) : 1);
    const l = Math.tanh(L[i] * pegel) * 0.89 * fade, r = Math.tanh(R[i] * pegel) * 0.89 * fade;
    buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  }
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  if (datei) fs.writeFileSync(datei, buf);
  const info = { stimmung: id, name: st.name, bpm: st.bpm, tonart: TONART[String(g)] || "a-Moll", takte, sekunden: T };
  return datei ? info : { ...info, wav: buf };
}
