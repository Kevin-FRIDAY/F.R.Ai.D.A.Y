// Fridays Haus-Generator: entwirft ein Wohnhaus (Mehrfamilien- oder Einfamilienhaus) komplett selbst –
// ohne Claude und ohne Guthaben. Liefert einen Werkstatt-Bauplan (schritte mit teilen) plus "haus"-Daten
// für Grundrisse, Etagen und Leitungsebenen (Kaltwasser, Warmwasser, Abwasser, Heizung, Strom).
//
// WICHTIG: Das ist ein schematischer Entwurf zum Anschauen – kein genehmigungsfähiger Bauplan,
// keine Statik und keine TGA-Planung (Technische Gebäudeausrüstung).

const GH = 3.0; // Geschosshöhe (Fußboden bis Fußboden)
const DECKE = 0.25; // Deckenstärke
const LICHT = GH - DECKE; // lichte Raumhöhe 2,75 m
const AW = 0.3; // Außenwand
const IW = 0.12; // Innenwand
const MAX_ETAGEN = 8;
const MAX_WHG_PRO_ETAGE = 4;

export const HINWEIS = "Schematischer Entwurf zum Anschauen – kein genehmigungsfähiger Bauplan, keine Statik und keine Haustechnik-Planung (TGA). Für einen echten Bau brauchst du Architekt, Statiker und Fachplaner.";

export const EBENEN = [
  { id: "struktur", name: "Rohbau", farbe: "cyan" },
  { id: "raeume", name: "Räume", farbe: "weiss" },
  { id: "moebel", name: "Möbel", farbe: "grau" },
  { id: "kaltwasser", name: "Kaltwasser", farbe: "blau" },
  { id: "warmwasser", name: "Warmwasser", farbe: "rot" },
  { id: "abwasser", name: "Abwasser", farbe: "braun" },
  { id: "heizung", name: "Heizung", farbe: "orange" },
  { id: "strom", name: "Strom", farbe: "gelb" },
];

// ---------- Wunsch verstehen ----------
const ZAHLWORTE = { ein: 1, eine: 1, einem: 1, einer: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12, sechzehn: 16, zwanzig: 20 };
const ZAHL = "(\\d{1,2}|" + Object.keys(ZAHLWORTE).join("|") + ")";
const zahlVon = (s) => (/^\d+$/.test(s) ? Number(s) : ZAHLWORTE[s] || 0);

function norm(text) {
  return String(text || "").toLowerCase().replace(/^\s*(hey |hallo |ok |okay )?friday[,.!:]?\s*/, "").replace(/[!?.,;:"„“]/g, " ").replace(/\s+/g, " ").trim();
}

// Ist das ein Wunsch nach einem Wohnhaus? ("Krankenhaus", "Baumhaus" usw. zählen nicht.)
export function isHausWunsch(text) {
  const t = norm(text);
  return /(mehrfamilienhaus|einfamilienhaus|wohnhaus|mietshaus|wohngebäude|wohngebaeude|wohnblock|stadthaus|\bmfh\b|\befh\b|\bhaus\b|\bwohnungen\b)/.test(t);
}

// Sprachbefehl "Friday, bau mir ein Mehrfamilienhaus" (ohne Claude).
export function isHausBefehl(text) {
  const t = norm(text);
  if (t.length > 200) return false;
  return /^(bitte |kannst du( mir)? |könntest du( mir)? |koenntest du( mir)? )?(bau|baue|entwirf|entwerfe|plan|plane|zeichne|konstruier|konstruiere|mach|erstell|erstelle)\b/.test(t) && isHausWunsch(t);
}

export function parseHaus(text) {
  const t = norm(text);
  const efh = /(einfamilienhaus|\befh\b|bungalow|eigenheim)/.test(t) || (/\bhaus\b/.test(t) && !/(mehrfamilien|wohnungen|mietshaus|wohnblock|\bmfh\b)/.test(t) && !new RegExp(ZAHL + " ?(etagen|stockwerke|geschosse|obergeschosse)").test(t));
  const notes = [];
  if (efh) return { typ: "efh", etagen: 2, whgProEtage: 1, keller: !/ohne keller/.test(t), notes };

  let etagen = 0, proEtage = 0, gesamt = 0;
  const mE = t.match(new RegExp(ZAHL + " ?(etagen|etage|stockwerke|stockwerk|geschosse|geschoss|stöcke|stoecke|ebenen)"));
  if (mE) etagen = zahlVon(mE[1]);
  const mOG = t.match(new RegExp(ZAHL + " ?(obergeschosse|obergeschoss|og)\\b"));
  if (!etagen && mOG) etagen = zahlVon(mOG[1]) + 1;
  const mP = t.match(new RegExp(ZAHL + " ?(wohnungen|wohnung|whg|einheiten)( (pro|je) (etage|stockwerk|geschoss|stock))"));
  if (mP) proEtage = zahlVon(mP[1]);
  else {
    const mW = t.match(new RegExp(ZAHL + " ?(wohnungen|wohneinheiten|einheiten|parteien|whg)"));
    if (mW) gesamt = zahlVon(mW[1]);
  }
  if (gesamt && !proEtage) {
    if (!etagen) etagen = Math.min(MAX_ETAGEN, Math.max(1, Math.ceil(gesamt / 2)));
    proEtage = Math.ceil(gesamt / etagen);
  }
  if (!etagen) etagen = 4;
  if (!proEtage) proEtage = 2;
  if (etagen > MAX_ETAGEN) { notes.push(`Ich begrenze auf ${MAX_ETAGEN} Etagen, damit das Hologramm flüssig bleibt.`); etagen = MAX_ETAGEN; }
  if (proEtage > MAX_WHG_PRO_ETAGE) { notes.push(`Mehr als ${MAX_WHG_PRO_ETAGE} Wohnungen pro Etage passen nicht sinnvoll, ich nehme ${MAX_WHG_PRO_ETAGE}.`); proEtage = MAX_WHG_PRO_ETAGE; }
  return { typ: "mfh", etagen: Math.max(1, etagen), whgProEtage: Math.max(1, proEtage), keller: !/ohne keller/.test(t), notes };
}

// ---------- kleine Helfer ----------
const r1 = (v) => Math.round(v * 100) / 100;
const fmt = (v, d = 1) => Number(v).toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const ZAHLTEXT = ["keine", "eine", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
const zt = (n) => ZAHLTEXT[n] || String(n);
const etagenName = (i) => (i < 0 ? "Keller" : i === 0 ? "Erdgeschoss" : `${i}. Obergeschoss`);
const etagenKurz = (i) => (i < 0 ? "KG" : i === 0 ? "EG" : `${i}. OG`);
const nass = new Set(["bad", "wc", "kueche"]);

function box(pos, groesse, farbe, ebene, etage, extra = {}) {
  return { form: "box", pos: pos.map(r1), groesse: groesse.map((g) => r1(Math.max(0.01, g))), farbe, ebene, etage, ...extra };
}
function rohr(punkte, dicke, farbe, ebene, etage) {
  return { form: "rohr", punkte: punkte.map((p) => p.map(r1)), dicke, farbe, ebene, etage };
}
function text(pos, t, farbe, ebene, etage, extra = {}) {
  return { form: "text", pos: pos.map(r1), text: t, farbe, ebene, etage, ...extra };
}
function zyl(pos, radius, hoehe, farbe, ebene, etage) {
  return { form: "zylinder", pos: pos.map(r1), radius, hoehe, achse: "y", farbe, ebene, etage };
}
const len = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2]), 0);

// Rampe (Treppenlauf) als gekippte Platte von a nach b ([x, y, z]); Lauf entweder entlang x oder z.
function lauf(a, b, breite, ebene, etage) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const center = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  if (Math.abs(dz) >= Math.abs(dx)) {
    const L = Math.hypot(dz, dy);
    const deg = (Math.atan2(dy, Math.abs(dz)) * 180) / Math.PI;
    // +Drehung um x senkt das +z-Ende.
    return box(center, [breite, 0.18, L], "cyan", ebene, etage, { drehung: [dz > 0 ? -deg : deg, 0, 0] });
  }
  const L = Math.hypot(dx, dy);
  const deg = (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI;
  // +Drehung um z hebt das +x-Ende.
  return box(center, [L, 0.18, breite], "cyan", ebene, etage, { drehung: [0, 0, dx > 0 ? deg : -deg] });
}

// ---------- Grundriss-Vorlagen (lokal: x von außen 0 → Treppenhausseite W, z von vorn 0 → hinten D) ----------
const MFH_WHG = {
  W: 10, D: 11, schacht: [6.2, 6.85],
  raeume: [
    { name: "Wohnen/Essen", typ: "wohnen", r: [0, 0, 6, 5] },
    { name: "Schlafen", typ: "schlafen", r: [6, 0, 10, 5] },
    { name: "Abstellraum", typ: "abstell", r: [0, 5, 2.4, 6.6] },
    { name: "Flur", typ: "flur", r: [2.4, 5, 10, 6.6] },
    { name: "Kinderzimmer", typ: "kind", r: [0, 6.6, 3.6, 11] },
    { name: "Bad", typ: "bad", r: [3.6, 6.6, 6.2, 11] },
    { name: "Küche", typ: "kueche", r: [6.2, 6.6, 10, 11] },
  ],
};
const MFH_KERN = 5; // Breite Treppenhaus

const EFH = {
  W: 10, D: 9, schacht: [4.4, 5.3], stromSteig: [0.3, 8.6],
  etagen: [
    [
      { name: "Wohnen", typ: "wohnen", r: [0, 0, 6.4, 5] },
      { name: "Essen", typ: "essen", r: [6.4, 0, 10, 5] },
      { name: "Hauswirtschaft", typ: "abstell", r: [0, 5, 2.6, 9] },
      { name: "Gäste-WC", typ: "wc", r: [2.6, 5, 4.4, 7.2] },
      { name: "Abstellraum", typ: "abstell", r: [2.6, 7.2, 4.4, 9] },
      { name: "Küche", typ: "kueche", r: [4.4, 5, 7.4, 7.4] },
      { name: "Garderobe", typ: "garderobe", r: [7.4, 5, 10, 7.4] },
      { name: "Flur & Treppe", typ: "flur", r: [4.4, 7.4, 10, 9] },
    ],
    [
      { name: "Eltern", typ: "schlafen", r: [0, 0, 5.4, 4.6] },
      { name: "Kind 1", typ: "kind", r: [5.4, 0, 10, 4.6] },
      { name: "Kind 2", typ: "kind", r: [0, 4.6, 4.4, 9] },
      { name: "Bad", typ: "bad", r: [4.4, 4.6, 7.4, 7.4] },
      { name: "Ankleide", typ: "abstell", r: [7.4, 4.6, 10, 7.4] },
      { name: "Flur", typ: "flur", r: [4.4, 7.4, 10, 9] },
    ],
  ],
};

// ---------- Gebäude-Aufteilung ----------
// Liefert Wohnungs-Slots (Position + Spiegelung) und Treppenhäuser in Weltkoordinaten (Mitte x=0, z=0).
function layout(p) {
  if (p.typ === "efh") {
    const B = EFH.W, T = EFH.D;
    return { B, T, slots: [{ x0: -B / 2, mirror: false, kern: null }], kerne: [] };
  }
  const { W, D } = MFH_WHG;
  const n = p.whgProEtage;
  const module = [];
  for (let i = 0; i < n; i += 2) module.push(Math.min(2, n - i));
  const B = module.reduce((s, k) => s + MFH_KERN + k * W, 0);
  const T = D;
  let x = -B / 2;
  const slots = [], kerne = [];
  for (const k of module) {
    const kern = { x0: x + W, x1: x + W + MFH_KERN };
    slots.push({ x0: x, mirror: false, kern });
    x += W;
    kerne.push(kern);
    x += MFH_KERN;
    if (k === 2) { slots.push({ x0: x, mirror: true, kern }); x += W; }
  }
  return { B, T, slots, kerne };
}

// Lokal → Welt für einen Wohnungs-Slot.
function trafo(slot, W, T) {
  const tx = (xl) => (slot.mirror ? slot.x0 + W - xl : slot.x0 + xl);
  const tz = (zl) => -T / 2 + zl;
  return {
    pt: (xl, zl) => [tx(xl), tz(zl)],
    rect: ([a, b, c, d]) => { const xa = tx(a), xb = tx(c); return [Math.min(xa, xb), tz(b), Math.max(xa, xb), tz(d)]; },
  };
}

// ---------- Ausbau pro Raum ----------
function nearestEdge(r, s) {
  const [x0, z0, x1, z1] = r;
  const c = [
    { e: "x0", d: Math.abs(s[0] - x0) }, { e: "x1", d: Math.abs(s[0] - x1) },
    { e: "z0", d: Math.abs(s[1] - z0) }, { e: "z1", d: Math.abs(s[1] - z1) },
  ];
  return c.sort((a, b) => a.d - b.d)[0].e;
}
// Punkt an einer Raumwand: t = Position entlang der Wand, tiefe = Abstand von der Wand nach innen.
function anWand(r, e, t, tiefe) {
  const [x0, z0, x1, z1] = r;
  if (e === "x0") return [x0 + tiefe, t];
  if (e === "x1") return [x1 - tiefe, t];
  if (e === "z0") return [t, z0 + tiefe];
  return [t, z1 - tiefe];
}
const entlangX = (e) => e === "z0" || e === "z1";

// Gegenstand an einer Wand: Breite entlang der Wand, Tiefe von der Wand weg.
function wandBox(r, e, t, breite, tiefe, hoehe, y0, farbe, ebene, etage, yMitte = null) {
  const [x, z] = anWand(r, e, t, tiefe / 2 + 0.07);
  const g = entlangX(e) ? [breite, hoehe, tiefe] : [tiefe, hoehe, breite];
  return box([x, yMitte ?? y0 + hoehe / 2, z], g, farbe, ebene, etage);
}

function moebel(raum, y0, etage, schacht) {
  const [x0, z0, x1, z1] = raum.r, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const M = (pos, g) => box([pos[0], y0 + g[1] / 2, pos[1]], g, "grau", "moebel", etage);
  const out = [];
  const lang = w >= d; // längere Seite
  switch (raum.typ) {
    case "wohnen":
      out.push(M([x0 + w * 0.32, z1 - 0.65], lang ? [2.4, 0.8, 0.95] : [0.95, 0.8, 2.4])); // Sofa
      out.push(M([x0 + w * 0.32, z1 - 1.9], [1.1, 0.4, 0.6])); // Couchtisch
      out.push(M([x0 + w * 0.32, z0 + 0.35], [1.8, 0.5, 0.4])); // TV-Board
      if (raum.name.includes("Essen")) out.push(M([x0 + w * 0.78, cz], [0.9, 0.75, 1.6])); // Esstisch
      break;
    case "essen":
      out.push(M([cx, cz], [1.8, 0.75, 0.9]));
      out.push(M([cx, cz - 0.75], [1.6, 0.45, 0.4]), M([cx, cz + 0.75], [1.6, 0.45, 0.4])); // Bänke
      break;
    case "schlafen":
      out.push(M([x0 + 0.38, cz], [0.6, 2.2, Math.min(2.4, d - 1)])); // Schrank
      out.push(M([x0 + 0.7 + (w - 0.7) / 2, z1 - 1.15], [1.8, 0.5, 2.0])); // Doppelbett
      break;
    case "kind":
      out.push(M([x0 + 0.55, z0 + 1.15], [0.9, 0.45, 2.0])); // Bett
      out.push(M([x1 - 0.42, cz + 0.4], [0.7, 0.75, 1.4])); // Schreibtisch
      out.push(M([cx, z1 - 0.25], [Math.min(1.6, w - 1.4), 1.9, 0.35])); // Regal
      break;
    case "flur":
      out.push(M(lang ? [cx, z0 + 0.25] : [x0 + 0.25, cz], lang ? [1.2, 1.8, 0.35] : [0.35, 1.8, 1.2])); // Garderobe
      break;
    case "garderobe":
      out.push(M([cx, z0 + 0.25], [Math.min(2, w - 0.4), 2.0, 0.4]));
      break;
    case "abstell":
      out.push(M(lang ? [cx, z1 - 0.25] : [x1 - 0.25, cz], lang ? [Math.min(2, w - 0.3), 1.9, 0.4] : [0.4, 1.9, Math.min(2, d - 0.3)])); // Regal
      break;
    default:
      break;
  }
  return out;
}

// Sanitär- und Küchen-Anschlüsse an der Wand, die dem Schacht am nächsten ist.
function anschluesse(raum, schacht) {
  const e = nearestEdge(raum.r, schacht);
  const [x0, z0, x1, z1] = raum.r;
  const a = entlangX(e) ? x0 : z0, b = entlangX(e) ? x1 : z1;
  const s = entlangX(e) ? schacht[0] : schacht[1];
  const nah = s - a < b - s ? a : b, fern = nah === a ? b : a, dir = fern > nah ? 1 : -1;
  const clamp = (v) => Math.max(a + 0.45, Math.min(b - 0.45, v));
  const L = b - a;
  const list = [];
  if (raum.typ === "kueche") {
    list.push({ was: "spuele", t: clamp(nah + dir * 1.0), kw: true, ww: true, aw: true, h: 0.9 });
    list.push({ was: "zeile", t: nah + dir * Math.min(L, 3.2) / 2 + dir * 0.1, breite: Math.min(L - 0.3, 3.2) });
    list.push({ was: "kuehl", t: fern - dir * 0.4 });
  } else if (raum.typ === "bad") {
    list.push({ was: "wc", t: clamp(nah + dir * 0.6), kw: true, aw: true, h: 0.5 });
    list.push({ was: "wt", t: clamp(nah + dir * 1.6), kw: true, ww: true, aw: true, h: 0.85 });
    if (L >= 3.6) list.push({ was: "wanne", t: fern - dir * 0.9, kw: true, ww: true, aw: true, h: 0.6 });
    else list.push({ was: "dusche", t: fern - dir * 0.5, kw: true, ww: true, aw: true, h: 1.1 });
  } else if (raum.typ === "wc") {
    list.push({ was: "wc", t: clamp(nah + dir * 0.5), kw: true, aw: true, h: 0.5 });
    list.push({ was: "wt", t: clamp(nah + dir * 1.3), kw: true, ww: true, aw: true, h: 0.85 });
  }
  return { e, list };
}

function objektTeil(raum, e, o, y0, etage) {
  const R = raum.r;
  switch (o.was) {
    case "zeile": return [wandBox(R, e, o.t, o.breite, 0.6, 0.9, y0, "weiss", "moebel", etage), wandBox(R, e, o.t, o.breite, 0.35, 0.7, y0, "weiss", "moebel", etage, y0 + 1.85)];
    case "kuehl": return [wandBox(R, e, o.t, 0.6, 0.62, 1.85, y0, "weiss", "moebel", etage)];
    case "spuele": return [];
    case "wc": return [wandBox(R, e, o.t, 0.4, 0.6, 0.42, y0, "weiss", "moebel", etage)];
    case "wt": return [wandBox(R, e, o.t, 0.6, 0.45, 0.15, y0, "weiss", "moebel", etage, y0 + 0.82)];
    case "wanne": return [wandBox(R, e, o.t, 1.7, 0.75, 0.55, y0, "weiss", "moebel", etage)];
    case "dusche": return [wandBox(R, e, o.t, 0.9, 0.9, 0.05, y0, "glas", "moebel", etage)];
    default: return [];
  }
}

// Fußbodenheizung: Schlange im Raum, beginnt am Heizkreisverteiler.
function fbhSchlange(raum, start, y) {
  const [x0, z0, x1, z1] = raum.r, inset = 0.3, abstand = 0.5;
  const w = x1 - x0, d = z1 - z0;
  if (w < 1 || d < 1) return null;
  const pts = [];
  if (w >= d) {
    const n = Math.max(1, Math.floor((d - 2 * inset) / abstand));
    for (let k = 0; k <= n; k++) {
      const z = z0 + inset + k * ((d - 2 * inset) / n);
      const a = [x0 + inset, y, z], b = [x1 - inset, y, z];
      pts.push(...(k % 2 ? [b, a] : [a, b]));
    }
  } else {
    const n = Math.max(1, Math.floor((w - 2 * inset) / abstand));
    for (let k = 0; k <= n; k++) {
      const x = x0 + inset + k * ((w - 2 * inset) / n);
      const a = [x, y, z0 + inset], b = [x, y, z1 - inset];
      pts.push(...(k % 2 ? [b, a] : [a, b]));
    }
  }
  // Anbindung vom Heizkreisverteiler: erst entlang x, dann entlang z (keine Schrägen quer durch den Raum).
  const f = pts[0];
  return [[start[0], y, start[1]], [f[0], y, start[1]], ...pts];
}

// ---------- Haupt-Generator ----------
export function buildHouse(p) {
  const { B, T, slots, kerne } = layout(p);
  const E = p.etagen;
  const efh = p.typ === "efh";
  const W = efh ? EFH.W : MFH_WHG.W;
  const tiefKeller = p.keller ? -GH : 0;
  const teileKeller = [], teileDach = [], etagenTeile = Array.from({ length: E }, () => []);
  const L = { kaltwasser: [], warmwasser: [], abwasser: [], heizung: [], strom: [] };
  const laenge = { kaltwasser: 0, warmwasser: 0, abwasser: 0, heizung: 0, strom: 0 };
  const add = (ebene, teil) => { L[ebene].push(teil); if (teil.form === "rohr") laenge[ebene] += len(teil.punkte); };
  const hausEtagen = [];
  let whgNr = 0, stromkreise = 0;

  // Schacht-Punkte (Welt) je Wohnungs-Slot.
  const schachtVon = slots.map((slot) => { const tf = trafo(slot, W, T); return tf.pt(...(efh ? EFH.schacht : MFH_WHG.schacht)); });
  // Strom-Steigleitung je Slot (MFH: im Elektroschacht des Treppenhauses, EFH: Ecke Hauswirtschaft).
  const stromVon = slots.map((slot) => (efh ? trafo(slot, W, T).pt(...EFH.stromSteig) : [slot.kern.x0 + 4.1, -T / 2 + 10.1]));
  const OFF = { kaltwasser: [-0.1, 0], warmwasser: [-0.03, 0], hvl: [0.04, 0], hrl: [0.11, 0], abwasser: [0, 0.2] };
  const riserPt = (s, k) => [s[0] + OFF[k][0], s[1] + OFF[k][1]];

  // ---- Wände aus Räumen erzeugen ----
  function waende(rects, y0, etage) {
    const out = [];
    const yM = y0 + LICHT / 2;
    // Außenwände
    out.push(box([0, yM, -T / 2 + AW / 2], [B, LICHT, AW], "cyan", "struktur", etage));
    out.push(box([0, yM, T / 2 - AW / 2], [B, LICHT, AW], "cyan", "struktur", etage));
    out.push(box([-B / 2 + AW / 2, yM, 0], [AW, LICHT, T - 2 * AW], "cyan", "struktur", etage));
    out.push(box([B / 2 - AW / 2, yM, 0], [AW, LICHT, T - 2 * AW], "cyan", "struktur", etage));
    const innen = (v, lim) => Math.abs(v - lim) > 0.05;
    for (const [x0, z0, x1, z1] of rects) {
      if (innen(x1, B / 2)) out.push(box([x1, yM, (z0 + z1) / 2], [IW, LICHT, z1 - z0], "cyan", "struktur", etage));
      if (innen(z1, T / 2)) out.push(box([(x0 + x1) / 2, yM, z1], [x1 - x0, LICHT, IW], "cyan", "struktur", etage));
    }
    return out;
  }
  // Fenster in den Außenwänden je Raum.
  function fenster(raum, y0, etage) {
    const [x0, z0, x1, z1] = raum.r, out = [];
    if (raum.typ === "abstell" || raum.typ === "garderobe") return out;
    const yF = y0 + 0.9 + 0.7;
    const fw = (l) => Math.min(raum.typ === "wohnen" ? 3.6 : 1.8, l * 0.6);
    if (Math.abs(z0 + T / 2) < 0.05) out.push(box([(x0 + x1) / 2, yF, -T / 2 + 0.02], [fw(x1 - x0), 1.4, 0.06], "glas", "struktur", etage));
    if (Math.abs(z1 - T / 2) < 0.05) out.push(box([(x0 + x1) / 2, yF, T / 2 - 0.02], [fw(x1 - x0), 1.4, 0.06], "glas", "struktur", etage));
    if (Math.abs(x0 + B / 2) < 0.05) out.push(box([-B / 2 + 0.02, yF, (z0 + z1) / 2], [0.06, 1.4, fw(z1 - z0)], "glas", "struktur", etage));
    if (Math.abs(x1 - B / 2) < 0.05) out.push(box([B / 2 - 0.02, yF, (z0 + z1) / 2], [0.06, 1.4, fw(z1 - z0)], "glas", "struktur", etage));
    return out;
  }
  const flaeche = (r) => r1(Math.max(0, (r[2] - r[0] - IW) * (r[3] - r[1] - IW)));

  // ---- Keller ----
  if (p.keller) {
    const y0 = -GH;
    teileKeller.push(box([0, y0 - 0.15, 0], [B + 0.6, 0.3, T + 0.6], "cyan", "struktur", -1)); // Bodenplatte
    const kRaeume = [];
    slots.forEach((slot, i) => {
      if (efh) {
        kRaeume.push({ name: "Technik", typ: "technik", r: [-B / 2, -T / 2, -B / 2 + 4, T / 2] });
        kRaeume.push({ name: "Kellerraum", typ: "keller", r: [-B / 2 + 4, -T / 2, B / 2, T / 2] });
      } else {
        kRaeume.push({ name: `Mieterkeller ${i + 1}`, typ: "keller", r: [slot.x0, -T / 2, slot.x0 + W, T / 2] });
      }
    });
    kerne.forEach((k, i) => kRaeume.push({ name: i === 0 ? "Technik & Hausanschluss" : "Treppenhaus", typ: i === 0 ? "technik" : "treppenhaus", r: [k.x0, -T / 2, k.x1, T / 2] }));
    teileKeller.push(...waende(kRaeume.map((r) => r.r), y0, -1));
    for (const raum of kRaeume) {
      const [x0, z0, x1, z1] = raum.r;
      teileKeller.push(box([(x0 + x1) / 2, y0 + 0.01, (z0 + z1) / 2], [x1 - x0 - 0.15, 0.02, z1 - z0 - 0.15], raum.typ === "technik" ? "orange" : "weiss", "raeume", -1));
      teileKeller.push(text([(x0 + x1) / 2, y0 + 1.3, (z0 + z1) / 2], `${raum.name} · ${fmt(flaeche(raum.r))} m²`, "weiss", "raeume", -1, { nurEtage: true }));
    }
    teileKeller.push(text([0, y0 + 2.2, -T / 2 - 0.6], "Keller · Stahlbeton WU", "cyan", "struktur", -1));
    hausEtagen.push({ nr: -1, name: "Keller", kurz: "KG", y: y0, raeume: kRaeume.map((r) => ({ name: r.name, typ: r.typ, flaeche: flaeche(r.r), rect: r.r.map(r1) })), wohnungen: [], schaechte: schachtVon.map((s) => s.map(r1)) });
  }

  // ---- Geschosse ----
  for (let i = 0; i < E; i++) {
    const y0 = i * GH;
    const out = etagenTeile[i];
    out.push(box([0, y0 - DECKE / 2, 0], [B, DECKE, T], "cyan", "struktur", i)); // Decke/Boden
    const alleRects = [], etagenRaeume = [], wohnungen = [];

    // Treppenhäuser (MFH)
    for (const k of kerne) {
      const kr = [k.x0, -T / 2, k.x1, T / 2];
      alleRects.push(kr);
      const zl = (v) => -T / 2 + v;
      out.push(lauf([k.x0 + 1.3, y0, zl(4.4)], [k.x0 + 1.3, y0 + GH / 2, zl(1.4)], 2.0, "struktur", i));
      out.push(lauf([k.x0 + 3.5, y0 + GH / 2, zl(1.4)], [k.x0 + 3.5, y0 + GH, zl(4.4)], 2.0, "struktur", i));
      out.push(box([(k.x0 + k.x1) / 2, y0 + GH / 2 - 0.1, zl(0.85)], [MFH_KERN - 0.4, 0.2, 1.1], "cyan", "struktur", i)); // Zwischenpodest
      out.push(box([k.x0 + 1.4, y0 + LICHT / 2, zl(8.4)], [1.8, LICHT, 1.9], "glas", "struktur", i)); // Aufzug
      out.push(box([k.x0 + 4.1, y0 + LICHT / 2, zl(10.1)], [0.8, LICHT, 0.8], "gelb", "struktur", i)); // Elektroschacht
      out.push(box([(k.x0 + k.x1) / 2, y0 + 1.6, -T / 2 + 0.02], [1.6, 2.2, 0.06], "glas", "struktur", i)); // Treppenhausfenster
      out.push(box([(k.x0 + k.x1) / 2, y0 + 0.01, 0], [MFH_KERN - 0.15, 0.02, T - 0.15], "grau", "raeume", i));
      out.push(text([(k.x0 + k.x1) / 2, y0 + 2.2, zl(6)], "Treppenhaus + Aufzug", "weiss", "raeume", i, { nurEtage: true }));
      etagenRaeume.push({ name: "Treppenhaus", typ: "treppenhaus", flaeche: flaeche(kr), rect: kr.map(r1) });
    }

    slots.forEach((slot, si) => {
      const tf = trafo(slot, W, T);
      const vorlage = efh ? EFH.etagen[i] || EFH.etagen[EFH.etagen.length - 1] : MFH_WHG.raeume;
      const raeume = vorlage.map((v) => ({ ...v, r: tf.rect(v.r) }));
      const schacht = schachtVon[si];
      let whgName = null;
      if (!efh) { whgNr += 1; whgName = `Whg ${i + 1}.${si + 1}`; }
      let whgFlaeche = 0;
      for (const raum of raeume) {
        alleRects.push(raum.r);
        const [x0, z0, x1, z1] = raum.r, f = flaeche(raum.r);
        whgFlaeche += f;
        out.push(box([(x0 + x1) / 2, y0 + 0.01, (z0 + z1) / 2], [x1 - x0 - 0.15, 0.02, z1 - z0 - 0.15], nass.has(raum.typ) ? "glas" : "weiss", "raeume", i));
        out.push(text([(x0 + x1) / 2, y0 + 1.2, (z0 + z1) / 2], `${raum.name} ${fmt(f)} m²`, "weiss", "raeume", i, { nurEtage: true }));
        out.push(...fenster(raum, y0, i));
        out.push(...moebel(raum, y0, i, schacht));
        etagenRaeume.push({ name: raum.name, typ: raum.typ, flaeche: f, rect: raum.r.map(r1), whg: whgName || (efh ? "Haus" : null) });

        // Sanitär-Gegenstände + Wasser/Abwasser
        if (nass.has(raum.typ)) {
          const { e, list } = anschluesse(raum, schacht);
          for (const o of list) {
            out.push(...objektTeil(raum, e, o, y0, i));
            if (!o.kw && !o.ww && !o.aw) continue;
            const [fx, fz] = anWand(raum.r, e, o.t, 0.12);
            if (o.kw) { const s = riserPt(schacht, "kaltwasser"); add("kaltwasser", rohr([[s[0], y0 + 0.3, s[1]], [fx, y0 + 0.3, s[1]], [fx, y0 + 0.3, fz], [fx, y0 + o.h, fz]], 0.04, "blau", "kaltwasser", i)); }
            if (o.ww) { const s = riserPt(schacht, "warmwasser"); add("warmwasser", rohr([[s[0], y0 + 0.38, s[1] + 0.05], [fx + 0.06, y0 + 0.38, s[1] + 0.05], [fx + 0.06, y0 + 0.38, fz], [fx + 0.06, y0 + o.h, fz]], 0.04, "rot", "warmwasser", i)); }
            if (o.aw) { const s = riserPt(schacht, "abwasser"); add("abwasser", rohr([[fx - 0.06, y0 + 0.3, fz], [fx - 0.06, y0 + 0.16, fz], [fx - 0.06, y0 + 0.12, s[1]], [s[0], y0 + 0.08, s[1]]], o.was === "wc" ? 0.1 : 0.06, "braun", "abwasser", i)); }
          }
        }
      }
      if (efh && i === 0) whgName = "Haus";

      // Heizkreisverteiler im Flur (nah am Schacht) + Fußbodenheizung je Raum
      const flur = raeume.find((r) => r.typ === "flur") || raeume[0];
      const eF = nearestEdge(flur.r, schacht);
      const [hx, hz] = anWand(flur.r, eF, Math.max(entlangX(eF) ? flur.r[0] + 0.5 : flur.r[1] + 0.5, Math.min(entlangX(eF) ? flur.r[2] - 0.5 : flur.r[3] - 0.5, entlangX(eF) ? schacht[0] : schacht[1])), 0.1);
      add("heizung", wandBoxPlain([hx, y0 + 0.55, hz], eF, [0.8, 0.7, 0.12], "orange", i));
      const sV = riserPt(schacht, "hvl"), sR = riserPt(schacht, "hrl");
      add("heizung", rohr([[sV[0], y0 + 0.5, sV[1]], [hx, y0 + 0.5, sV[1]], [hx, y0 + 0.5, hz]], 0.04, "orange", "heizung", i));
      add("heizung", rohr([[sR[0], y0 + 0.44, sR[1]], [hx + 0.08, y0 + 0.44, sR[1]], [hx + 0.08, y0 + 0.44, hz]], 0.04, "hellorange", "heizung", i));
      for (const raum of raeume) {
        if (raum.typ === "abstell" && flaeche(raum.r) < 6) continue;
        const pts = fbhSchlange(raum, [hx, hz], y0 + 0.07);
        if (pts) add("heizung", rohr(pts, 0.025, "orange", "heizung", i));
      }

      // Strom: Steigleitung → Unterverteilung im Flur → Deckenauslass je Raum
      const sp = stromVon[si];
      const eU = entlangX(eF) ? eF : eF; // gleiche Wand wie der Verteiler
      const tU = entlangX(eU) ? (flur.r[0] + flur.r[2]) / 2 + 0.6 : (flur.r[1] + flur.r[3]) / 2 + 0.6;
      const [ux, uz] = anWand(flur.r, eU, tU, 0.1);
      add("strom", wandBoxPlain([ux, y0 + 1.6, uz], eU, [0.5, 0.7, 0.12], "gelb", i));
      add("strom", rohr([[sp[0], y0 + 2.6, sp[1]], [sp[0], y0 + 2.6, uz], [ux, y0 + 2.6, uz], [ux, y0 + 1.95, uz]], 0.03, "gelb", "strom", i));
      for (const raum of raeume) {
        const cx = (raum.r[0] + raum.r[2]) / 2, cz = (raum.r[1] + raum.r[3]) / 2;
        add("strom", rohr([[ux, y0 + 2.62, uz], [ux, y0 + 2.62, cz], [cx, y0 + 2.62, cz], [cx, y0 + 2.45, cz]], 0.02, "gelb", "strom", i));
        add("strom", { form: "kugel", pos: [cx, y0 + 2.42, cz].map(r1), radius: 0.06, farbe: "gelb", ebene: "strom", etage: i });
        stromkreise += 1;
      }

      if (whgName && !efh) {
        const zimmer = raeume.filter((r) => ["wohnen", "schlafen", "kind"].includes(r.typ)).length;
        const ux0 = slot.x0, ux1 = slot.x0 + W;
        out.push(text([(ux0 + ux1) / 2, y0 + 2.1, -T / 2 - 0.4], `${whgName} · ${zimmer} Zi · ${fmt(whgFlaeche)} m²`, "cyan", "raeume", i));
        wohnungen.push({ name: whgName, zimmer, flaeche: r1(whgFlaeche), rect: [ux0, -T / 2, ux1, T / 2].map(r1) });
      }
    });

    out.unshift(...waende(alleRects, y0, i));
    hausEtagen.push({ nr: i, name: etagenName(i), kurz: etagenKurz(i), y: y0, raeume: etagenRaeume, wohnungen, schaechte: schachtVon.map((s) => s.map(r1)) });
  }
  if (efh) {
    // Einfamilienhaus: gerade Treppe im Flur vom EG ins OG.
    etagenTeile[0].push(lauf([EFH.W / 2 - 0.4, 0, -T / 2 + 8.2], [-EFH.W / 2 + 4.8, GH, -T / 2 + 8.2], 1.0, "struktur", 0));
    const eg = hausEtagen.find((e) => e.nr === 0), og = hausEtagen.find((e) => e.nr === 1);
    const fl = (e) => (e ? e.raeume.reduce((s, r) => s + r.flaeche, 0) : 0);
    const wf = fl(eg) + fl(og);
    const zimmer = [eg, og].flatMap((e) => (e ? e.raeume : [])).filter((r) => ["wohnen", "schlafen", "kind", "essen"].includes(r.typ)).length;
    if (eg) eg.wohnungen.push({ name: "Einfamilienhaus", zimmer, flaeche: r1(wf), rect: [-B / 2, -T / 2, B / 2, T / 2] });
    etagenTeile[0].push(text([0, 2.1, -T / 2 - 0.4], `Einfamilienhaus · ${zimmer} Zimmer · ${fmt(wf)} m²`, "cyan", "raeume", 0));
  }

  // ---- Dach ----
  const yD = E * GH;
  let pvKwp = 0;
  if (efh) {
    const s = T / 2 + 0.5, neig = 35, tan = Math.tan((neig * Math.PI) / 180);
    const Ls = s / Math.cos((neig * Math.PI) / 180);
    teileDach.push(box([0, yD - DECKE / 2, 0], [B, DECKE, T], "cyan", "struktur", E));
    teileDach.push(box([0, yD + (s / 2) * tan, -s / 2], [B + 0.8, 0.25, Ls], "cyan", "struktur", E, { drehung: [-neig, 0, 0] }));
    teileDach.push(box([0, yD + (s / 2) * tan, s / 2], [B + 0.8, 0.25, Ls], "cyan", "struktur", E, { drehung: [neig, 0, 0] }));
    teileDach.push(box([0, yD + (s / 2) * tan + 0.16, -s / 2 - 0.05], [B - 1.5, 0.05, Ls - 1.2], "blau", "struktur", E, { drehung: [-neig, 0, 0] }));
    pvKwp = ((B - 1.5) * (Ls - 1.2)) * 0.21;
    teileDach.push(text([0, yD + s * tan + 0.8, 0], `Satteldach 35° · PV ca. ${fmt(pvKwp, 1)} kWp`, "cyan", "struktur", E));
  } else {
    teileDach.push(box([0, yD - DECKE / 2 + 0.05, 0], [B + 0.3, 0.35, T + 0.3], "cyan", "struktur", E));
    teileDach.push(box([0, yD + 0.4, -T / 2], [B + 0.3, 0.6, 0.2], "cyan", "struktur", E), box([0, yD + 0.4, T / 2], [B + 0.3, 0.6, 0.2], "cyan", "struktur", E));
    teileDach.push(box([-B / 2, yD + 0.4, 0], [0.2, 0.6, T], "cyan", "struktur", E), box([B / 2, yD + 0.4, 0], [0.2, 0.6, T], "cyan", "struktur", E));
    const reihen = Math.max(1, Math.floor((T - 2) / 2.2));
    for (let k = 0; k < reihen; k++) {
      const z = -T / 2 + 1.4 + k * 2.2;
      teileDach.push(box([0, yD + 0.55, z], [B - 2, 0.05, 1.7], "blau", "struktur", E, { drehung: [-15, 0, 0] }));
    }
    pvKwp = reihen * (B - 2) * 1.7 * 0.21;
    for (const k of kerne) teileDach.push(box([(k.x0 + k.x1) / 2, yD + 1.4, -T / 2 + 8.4], [2.4, 2.6, 2.4], "cyan", "struktur", E)); // Aufzugsüberfahrt
    teileDach.push(text([0, yD + 2.2, -T / 2], `Flachdach mit PV ca. ${fmt(pvKwp, 0)} kWp`, "cyan", "struktur", E));
  }

  // ---- Haustechnik im Keller (oder Hauswirtschaftsraum ohne Keller) ----
  const yT = p.keller ? -GH : 0; // Fußboden Technik
  const tech = efh
    ? { puffer: [-B / 2 + 0.8, -T / 2 + 1.0], ww: [-B / 2 + 2.0, -T / 2 + 1.0], zaehler: [-B / 2 + 0.25, T / 2 - 1.2], ha: [-B / 2 + 0.25, T / 2 - 2.4], wp: [-B / 2 - 1.6, 0] }
    : (() => { const k = kerne[0]; return { puffer: [k.x0 + 1.0, -T / 2 + 1.0], ww: [k.x0 + 2.2, -T / 2 + 1.0], zaehler: [k.x0 + 3.0, T / 2 - 0.3], ha: [k.x0 + 1.0, T / 2 - 0.3], wp: [k.x0 + 2.5, T / 2 + 2.2] }; })();
  if (!p.keller && efh) { tech.puffer = [-B / 2 + 0.6, T / 2 - 1.0]; tech.ww = [-B / 2 + 1.6, T / 2 - 1.0]; tech.zaehler = [-B / 2 + 0.25, -T / 2 + 5.6]; tech.ha = [-B / 2 + 0.25, -T / 2 + 6.4]; }
  const wohnflaeche = hausEtagen.filter((e) => e.nr >= 0).reduce((s, e) => s + e.raeume.filter((r) => r.typ !== "treppenhaus").reduce((a, r) => a + r.flaeche, 0), 0);
  const heizlast = Math.max(6, Math.round((wohnflaeche * 35) / 1000)); // ca. 35 W/m² (Neubau-Effizienzhaus, grobe Schätzung)
  const anzahlWhg = efh ? 1 : whgNr;
  const speicherL = efh ? 300 : Math.round((200 + anzahlWhg * 60) / 100) * 100;
  const pufferL = Math.max(200, Math.round((heizlast * 25) / 100) * 100);
  const yS = p.keller ? -0.35 : GH * E; // Sammelleitungen: unter der Kellerdecke (ohne Keller: hier vereinfacht ebenfalls unten)
  const yColl = p.keller ? { kaltwasser: -0.35, warmwasser: -0.45, hvl: -0.55, hrl: -0.65 } : { kaltwasser: 0.2, warmwasser: 0.25, hvl: 0.3, hrl: 0.35 };
  const sz = schachtVon[0][1];
  const xs = (k) => schachtVon.map((s) => riserPt(s, k)[0]);
  const sammel = (k, x0, farbe, ebene, d) => {
    const all = [...xs(k), x0];
    add(ebene, rohr([[Math.min(...all), yColl[k], sz + OFF[k][1]], [Math.max(...all), yColl[k], sz + OFF[k][1]]], d, farbe, ebene, -1));
  };
  // Steigleitungen pro Etage (Keller → oberstes Geschoss)
  const steig = (k, farbe, ebene, d, von = yColl[k], bis = (E - 1) * GH + 0.6) => {
    for (const s of schachtVon) {
      const [x, z] = riserPt(s, k);
      if (p.keller) add(ebene, rohr([[x, von, z], [x, 0, z]], d, farbe, ebene, -1));
      for (let i = 0; i < E; i++) add(ebene, rohr([[x, i === 0 && !p.keller ? von : i * GH, z], [x, Math.min(bis, (i + 1) * GH), z]], d, farbe, ebene, i));
    }
  };
  const tl = { kaltwasser: [], warmwasser: [], abwasser: [], heizung: [], strom: [] }; // Beschriftungen

  // Kaltwasser
  add("kaltwasser", box([tech.ha[0], yT + 1.0, tech.ha[1]], [0.25, 0.5, 0.4], "blau", "kaltwasser", -1));
  add("kaltwasser", rohr([[tech.ha[0], yT + 0.6, efh ? tech.ha[1] : T / 2 + 3], [tech.ha[0], yT + 0.6, tech.ha[1]], [tech.ha[0], yColl.kaltwasser, tech.ha[1]], [tech.ha[0], yColl.kaltwasser, sz]], 0.06, "blau", "kaltwasser", -1));
  if (efh) add("kaltwasser", rohr([[-B / 2 - 3, yT + 0.6, tech.ha[1]], [tech.ha[0], yT + 0.6, tech.ha[1]]], 0.06, "blau", "kaltwasser", -1));
  sammel("kaltwasser", tech.ha[0], "blau", "kaltwasser", 0.06);
  add("kaltwasser", rohr([[tech.ha[0], yColl.kaltwasser, sz], [tech.ww[0], yColl.kaltwasser, sz], [tech.ww[0], yColl.kaltwasser, tech.ww[1]], [tech.ww[0], yT + 0.2, tech.ww[1]]], 0.05, "blau", "kaltwasser", -1));
  steig("kaltwasser", "blau", "kaltwasser", 0.05);
  tl.kaltwasser.push(text([tech.ha[0], yT + 1.6, tech.ha[1]], "Hausanschluss Wasser + Zähler", "blau", "kaltwasser", -1));
  tl.kaltwasser.push(text([schachtVon[0][0] - 0.6, (E - 1) * GH + 1.6, sz], "Steigleitung Kaltwasser", "blau", "kaltwasser", E - 1));

  // Warmwasser
  add("warmwasser", zyl([tech.ww[0], yT + 1.0, tech.ww[1]], 0.38, 1.9, "rot", "warmwasser", -1));
  add("warmwasser", rohr([[tech.ww[0], yT + 1.95, tech.ww[1]], [tech.ww[0], yColl.warmwasser, tech.ww[1]], [tech.ww[0], yColl.warmwasser, sz + OFF.warmwasser[1]]], 0.05, "rot", "warmwasser", -1));
  sammel("warmwasser", tech.ww[0], "rot", "warmwasser", 0.05);
  steig("warmwasser", "rot", "warmwasser", 0.05);
  tl.warmwasser.push(text([tech.ww[0], yT + 2.4, tech.ww[1]], `Warmwasserspeicher ${speicherL} l`, "rot", "warmwasser", -1));
  tl.warmwasser.push(text([schachtVon[0][0] + 0.6, (E - 1) * GH + 2.0, sz], "Warmwasser + Zirkulation", "rot", "warmwasser", E - 1));

  // Heizung (Luft-Wärmepumpe → Pufferspeicher → Steigleitungen → Fußbodenheizung)
  add("heizung", box([tech.wp[0], 0.75, tech.wp[1]], [1.3, 1.5, 0.7], "orange", "heizung", efh ? 0 : -1));
  add("heizung", zyl([tech.puffer[0], yT + 1.0, tech.puffer[1]], 0.42, 1.9, "orange", "heizung", -1));
  const wpRohr = (dy, farbe) => rohr([[tech.wp[0], 0.3 + dy, tech.wp[1]], [tech.wp[0], yColl.hvl - dy, tech.wp[1]], [tech.wp[0], yColl.hvl - dy, tech.puffer[1]], [tech.puffer[0], yColl.hvl - dy, tech.puffer[1]], [tech.puffer[0], yT + 1.9, tech.puffer[1]]], 0.05, farbe, "heizung", -1);
  add("heizung", wpRohr(0, "orange"));
  add("heizung", wpRohr(0.1, "hellorange"));
  add("heizung", rohr([[tech.puffer[0] + 0.1, yT + 1.9, tech.puffer[1]], [tech.puffer[0] + 0.1, yColl.hvl, tech.puffer[1]], [tech.puffer[0] + 0.1, yColl.hvl, sz + OFF.hvl[1]]], 0.05, "orange", "heizung", -1));
  add("heizung", rohr([[tech.puffer[0] - 0.1, yT + 1.9, tech.puffer[1]], [tech.puffer[0] - 0.1, yColl.hrl, tech.puffer[1]], [tech.puffer[0] - 0.1, yColl.hrl, sz + OFF.hrl[1]]], 0.05, "hellorange", "heizung", -1));
  sammel("hvl", tech.puffer[0], "orange", "heizung", 0.05);
  sammel("hrl", tech.puffer[0], "hellorange", "heizung", 0.05);
  steig("hvl", "orange", "heizung", 0.05);
  steig("hrl", "hellorange", "heizung", 0.05);
  tl.heizung.push(text([tech.wp[0], 2.0, tech.wp[1]], `Luft-Wärmepumpe ca. ${heizlast} kW`, "orange", "heizung", efh ? 0 : -1));
  tl.heizung.push(text([tech.puffer[0], yT + 2.4, tech.puffer[1] + 0.6], `Pufferspeicher ${pufferL} l`, "orange", "heizung", -1));
  tl.heizung.push(text([0, 0.6, -T / 2 - 0.8], "Fußbodenheizung 35 °C Vorlauf", "orange", "heizung", 0));

  // Abwasser (Fallleitungen → Grundleitung → Kanal), über Dach entlüftet
  const yG = (p.keller ? -GH : 0) + 0.12;
  for (const s of schachtVon) {
    const [x, z] = riserPt(s, "abwasser");
    if (p.keller) add("abwasser", rohr([[x, yG, z], [x, 0, z]], 0.11, "braun", "abwasser", -1));
    for (let i = 0; i < E; i++) add("abwasser", rohr([[x, i === 0 && !p.keller ? yG : i * GH, z], [x, (i + 1) * GH + (i === E - 1 ? (efh ? 2.6 : 0.8) : 0), z]], 0.11, "braun", "abwasser", i));
  }
  const awX = xs("abwasser");
  const awZ = sz + OFF.abwasser[1];
  add("abwasser", rohr([[Math.min(...awX), yG, awZ], [Math.max(...awX), yG, awZ]], 0.15, "braun", "abwasser", -1));
  add("abwasser", rohr([[awX[0], yG, awZ], [awX[0], yG - 0.05, T / 2 + 3.5]], 0.15, "braun", "abwasser", -1));
  tl.abwasser.push(text([awX[0], yG + 0.5, T / 2 + 3.5], "Grundleitung DN 150 → Kanal", "braun", "abwasser", -1));
  tl.abwasser.push(text([awX[0], E * GH + (efh ? 3.2 : 1.4), awZ], "Entlüftung über Dach", "braun", "abwasser", E));

  // Strom (Netzanschluss → Zählerschrank → Steigleitungen → Unterverteilungen)
  add("strom", box([tech.zaehler[0], yT + 1.1, tech.zaehler[1]], efh ? [0.25, 1.6, 0.8] : [1.1, 1.6, 0.25], "gelb", "strom", -1));
  add("strom", rohr([[tech.zaehler[0], yT + 0.4, efh ? tech.zaehler[1] : T / 2 + 3], [tech.zaehler[0], yT + 0.4, tech.zaehler[1]]], 0.05, "gelb", "strom", -1));
  if (efh) add("strom", rohr([[-B / 2 - 3, yT + 0.4, tech.zaehler[1]], [tech.zaehler[0], yT + 0.4, tech.zaehler[1]]], 0.05, "gelb", "strom", -1));
  const stromRiser = [...new Map(stromVon.map((s) => [s.join(","), s])).values()];
  for (const s of stromRiser) {
    add("strom", rohr([[tech.zaehler[0], yT + 1.9, tech.zaehler[1]], [tech.zaehler[0], (p.keller ? -0.25 : 0.25), tech.zaehler[1]], [s[0], (p.keller ? -0.25 : 0.25), tech.zaehler[1]], [s[0], (p.keller ? -0.25 : 0.25), s[1]]], 0.04, "gelb", "strom", -1));
    for (let i = 0; i < E; i++) add("strom", rohr([[s[0], i === 0 ? (p.keller ? -0.25 : 0.25) : i * GH, s[1]], [s[0], i * GH + 2.6, s[1]], [s[0], (i + 1) * GH, s[1]]], 0.04, "gelb", "strom", i));
  }
  tl.strom.push(text([tech.zaehler[0], yT + 2.3, tech.zaehler[1]], `Zählerschrank · ${anzahlWhg + (efh ? 0 : 1)} Zähler`, "gelb", "strom", -1));
  tl.strom.push(text([0, E * GH + 1.0, T / 2 + 0.4], `PV ${fmt(pvKwp, 1)} kWp → Wechselrichter`, "gelb", "strom", E));

  // ---- Kennzahlen ----
  const H = E * GH + (efh ? (T / 2 + 0.5) * Math.tan((35 * Math.PI) / 180) : 0.7);
  const bgf = B * T * E;
  const kosten = schaetzeKosten({ efh, B, T, E, keller: p.keller, wohnflaeche, heizlast, pvKwp, laenge, anzahlWhg, kerne: kerne.length, etagen: hausEtagen });
  const kennzahlen = [
    { label: efh ? "Haustyp" : "Wohnungen", wert: efh ? "Einfamilienhaus" : `${anzahlWhg} (${p.whgProEtage} pro Etage)` },
    { label: "Wohnfläche", wert: `ca. ${fmt(wohnflaeche, 0)} m²` },
    { label: "Geschosse", wert: `${E}${p.keller ? " + Keller" : ""}` },
    { label: "Maße", wert: `${fmt(B)} × ${fmt(T)} × ${fmt(H)} m` },
    { label: "Heizlast (Schätzung)", wert: `ca. ${heizlast} kW` },
    { label: "Wasserleitungen", wert: `ca. ${fmt(laenge.kaltwasser + laenge.warmwasser, 0)} m` },
    { label: "Fußbodenheizung", wert: `ca. ${fmt(laenge.heizung, 0)} m Rohr` },
    { label: "Photovoltaik", wert: `ca. ${fmt(pvKwp, 1)} kWp` },
    { label: "Baukosten (grob)", wert: `ca. ${euroKurz(kosten.summe)}` },
  ];

  // ---- Bauabschnitte mit Ansage ----
  const titel = efh ? "Einfamilienhaus" : `Mehrfamilienhaus · ${anzahlWhg} Wohnungen`;
  const schritte = [];
  const n0 = p.notes.length ? ` ${p.notes.join(" ")}` : "";
  if (p.keller) schritte.push({ sagen: `Zuerst Bodenplatte und Keller aus wasserdichtem Beton. ${efh ? "Dort sitzt die Haustechnik." : `${zt(slots.length)} Mieterkeller und ein Technikraum für Wasser, Heizung und Strom.`}`, teile: teileKeller });
  for (let i = 0; i < E; i++) {
    const et = hausEtagen.find((e) => e.nr === i);
    let sagen;
    if (efh) sagen = i === 0 ? `Erdgeschoss: Wohnen, Essen, Küche, Gäste-WC und Hauswirtschaft, zusammen ${fmt(et.raeume.reduce((s, r) => s + r.flaeche, 0), 0)} Quadratmeter.` : `Obergeschoss: Eltern, zwei Kinderzimmer und ein Bad, ${fmt(et.raeume.reduce((s, r) => s + r.flaeche, 0), 0)} Quadratmeter.`;
    else if (i === 0) sagen = `${etagenName(i)}: ${zt(p.whgProEtage)} ${p.whgProEtage === 1 ? "Wohnung" : "Wohnungen"} mit je ${et.wohnungen[0]?.zimmer || 3} Zimmern, Küche und Bad, je rund ${fmt(et.wohnungen[0]?.flaeche || 0, 0)} Quadratmeter. Dazu ${kerne.length === 1 ? "ein Treppenhaus" : `${zt(kerne.length)} Treppenhäuser`} mit Aufzug.`;
    else if (i === E - 1 && E > 2) sagen = `${etagenName(i)}, das oberste Geschoss, gleiche Aufteilung.`;
    else sagen = E > 4 ? `${etagenName(i)}.` : `${etagenName(i)}, gleiche Aufteilung.`;
    schritte.push({ sagen, teile: etagenTeile[i] });
  }
  schritte.push({ sagen: efh ? `Satteldach mit 35 Grad und Solarmodulen nach Süden, rund ${fmt(pvKwp, 0)} Kilowatt Peak.` : `Flachdach mit Attika und Photovoltaik, rund ${fmt(pvKwp, 0)} Kilowatt Peak.`, teile: teileDach });
  schritte.push({ sagen: `Jetzt die Wasserleitungen: Kaltwasser in Blau, Warmwasser in Rot. Vom Hausanschluss ${p.keller ? "im Keller" : ""} über den Speicher mit ${speicherL} Litern in die Steigleitungen und zu Küche und Bad.`, teile: [...L.kaltwasser, ...L.warmwasser, ...tl.kaltwasser, ...tl.warmwasser] });
  schritte.push({ sagen: "Abwasser in Braun: Fallleitungen im Schacht, unten die Grundleitung zum Kanal, oben über Dach entlüftet.", teile: [...L.abwasser, ...tl.abwasser] });
  schritte.push({ sagen: `Heizung in Orange: Luft-Wärmepumpe mit etwa ${heizlast} Kilowatt, Pufferspeicher, dann Fußbodenheizung in jedem Raum. Rund ${fmt(laenge.heizung, 0)} Meter Heizrohr.`, teile: [...L.heizung, ...tl.heizung] });
  schritte.push({ sagen: `Strom in Gelb: Zählerschrank mit ${anzahlWhg + (efh ? 0 : 1)} ${anzahlWhg + (efh ? 0 : 1) === 1 ? "Zähler" : "Zählern"}, Steigleitungen und eine Unterverteilung pro ${efh ? "Etage" : "Wohnung"}, ${stromkreise} Deckenauslässe.`, teile: [...L.strom, ...tl.strom] });

  const plan = {
    titel,
    einleitung: efh ? `Sehr gern, Chef. Ein Einfamilienhaus mit rund ${fmt(wohnflaeche, 0)} Quadratmetern.${n0}` : `Sehr gern, Chef. Ein Mehrfamilienhaus mit ${zt(anzahlWhg)} Wohnungen auf ${zt(E)} Etagen.${n0}`,
    kennzahlen,
    schritte: schritte.filter((s) => s.teile.length),
    fazit: `Grob geschätzt kostet das Haus rund ${euroSprache(kosten.summe)}, ohne Grundstück, das sind etwa ${fmt(Math.round(kosten.proM2 / 50) * 50, 0)} Euro pro Quadratmeter Wohnfläche. ` + "Fertig, Chef. Unten kannst du Etagen, Leitungen und den Schnitt umschalten. Wichtig: Das ist ein schematischer Entwurf, kein genehmigungsfähiger Bauplan. Für einen echten Bau brauchst du Architekt, Statiker und Haustechnik-Planer.",
    haus: {
      typ: p.typ,
      etagen: hausEtagen.sort((a, b) => a.nr - b.nr),
      dach: E,
      ebenen: EBENEN,
      masse: { breite: r1(B), tiefe: r1(T), hoehe: r1(H) },
      leitungen_m: Object.fromEntries(Object.entries(laenge).map(([k, v]) => [k, Math.round(v)])),
      hinweis: HINWEIS,
      kosten,
    },
  };
  return plan;
}

// Box an einer Wand (Wandrichtung e), Maße [breite entlang Wand, höhe, tiefe].
function wandBoxPlain(pos, e, [breite, hoehe, tiefe], farbe, etage) {
  const g = entlangX(e) ? [breite, hoehe, tiefe] : [tiefe, hoehe, breite];
  return box(pos, g, farbe, farbe === "gelb" ? "strom" : "heizung", etage);
}

export function planHouse(wunsch) {
  return buildHouse(parseHaus(wunsch));
}

// ---------- Grobe Kostenschätzung (Deutschland, Neubau, Stand 2026) ----------
// Typische Durchschnittswerte je Einheit, angelehnt an übliche Baukosten-Kennwerte.
// Keine Angebote: echte Preise schwanken je nach Region, Ausstattung und Firma stark.
const PREISE = {
  bodenplatte: 450, // € je m² Grundfläche (Baugrube, Fundament, Bodenplatte)
  keller: 1100, // € je m² Kellerfläche (WU-Beton, Wände, Decke)
  rohbau: 900, // € je m² Geschossfläche (Wände, Decken, Treppen)
  flachdach: 320, // € je m² Dachfläche (Abdichtung, Dämmung, Attika)
  steildach: 360, // € je m² Dachfläche (Dachstuhl, Ziegel, Dämmung)
  fassade: 290, // € je m² Außenwand (Dämmung, Putz) – Fenster extra
  fenster: 750, // € je m² Fensterfläche (3-fach verglast)
  ausbau: 650, // € je m² Wohnfläche (Estrich, Putz, Böden, Türen, Fliesen, Maler)
  bad: 16000, // € je Bad (Wanne/Dusche, WC, Waschtisch, Fliesen, Installation)
  wc: 5000, // € je Gäste-WC
  kueche: 2000, // € je Küchenanschluss (ohne Küchenmöbel)
  leitung: 60, // € je Meter Wasser- und Abwasserleitung
  hausanschluss: 9000, // € Hausanschluss Wasser/Abwasser
  waermepumpe: 1700, // € je kW Wärmepumpe inkl. Einbau
  fbh: 60, // € je m² Fußbodenheizung
  heizzentrale: 6000, // € Pufferspeicher, Warmwasserspeicher, Verteiler
  elektro: 110, // € je m² Wohnfläche (Leitungen, Dosen, Unterverteilungen)
  zaehler: 600, // € je Zählerplatz
  zaehlerschrank: 3500,
  pv: 1400, // € je kWp Photovoltaik
  aufzug: 70000, // € je Aufzug
  haltestelle: 8000, // € je Haltestelle
  nebenkosten: 0.18, // Architekt, Statik, Fachplaner, Genehmigung, Gutachten (Anteil)
};

function schaetzeKosten({ efh, B, T, E, keller, wohnflaeche, heizlast, pvKwp, laenge, anzahlWhg, kerne, etagen }) {
  const grund = B * T;
  const raeume = etagen.filter((e) => e.nr >= 0).flatMap((e) => e.raeume);
  const n = (typ) => raeume.filter((r) => r.typ === typ).length;
  const fensterFl = raeume.filter((r) => !["abstell", "garderobe", "treppenhaus"].includes(r.typ)).length * 2.2 + (efh ? 0 : kerne * E * 3.5);
  const fassadeFl = Math.max(0, 2 * (B + T) * E * GH - fensterFl);
  const dachFl = efh ? 2 * (B + 0.8) * ((T / 2 + 0.5) / Math.cos((35 * Math.PI) / 180)) : grund;
  const P = PREISE;
  const posten = [
    { bereich: "Baugrube & Bodenplatte", betrag: grund * P.bodenplatte },
    ...(keller ? [{ bereich: "Keller", betrag: grund * P.keller }] : []),
    { bereich: "Rohbau (Wände, Decken, Treppen)", betrag: grund * E * P.rohbau },
    { bereich: efh ? "Dach (Satteldach)" : "Dach (Flachdach)", betrag: dachFl * (efh ? P.steildach : P.flachdach) },
    { bereich: "Fassade & Fenster", betrag: fassadeFl * P.fassade + fensterFl * P.fenster },
    { bereich: "Innenausbau", betrag: wohnflaeche * P.ausbau },
    { bereich: "Wasser & Abwasser (Sanitär)", betrag: n("bad") * P.bad + n("wc") * P.wc + n("kueche") * P.kueche + (laenge.kaltwasser + laenge.warmwasser + laenge.abwasser) * P.leitung + P.hausanschluss },
    { bereich: "Heizung (Wärmepumpe + Fußbodenheizung)", betrag: heizlast * P.waermepumpe + wohnflaeche * P.fbh + P.heizzentrale },
    { bereich: "Strom", betrag: wohnflaeche * P.elektro + P.zaehlerschrank + (anzahlWhg + (efh ? 0 : 1)) * P.zaehler },
    { bereich: "Photovoltaik", betrag: pvKwp * P.pv },
    ...(!efh && kerne ? [{ bereich: kerne > 1 ? `Aufzüge (${kerne})` : "Aufzug", betrag: kerne * (P.aufzug + (E + (keller ? 1 : 0)) * P.haltestelle) }] : []),
  ];
  const bau = posten.reduce((s, x) => s + x.betrag, 0);
  posten.push({ bereich: "Planung & Genehmigung (ca. 18 %)", betrag: bau * P.nebenkosten });
  const summe = bau * (1 + P.nebenkosten);
  const rund = (v) => Math.round(v / 1000) * 1000;
  return {
    posten: posten.map((x) => ({ bereich: x.bereich, betrag: rund(x.betrag) })),
    summe: rund(summe),
    spanne: [rund(summe * 0.8), rund(summe * 1.25)],
    proM2: Math.round(summe / Math.max(1, wohnflaeche)),
    hinweis: "Grobe Schätzung mit deutschen Durchschnittswerten (Neubau, mittlere Ausstattung, Stand 2026). Ohne Grundstück, Erschließung, Außenanlagen, Küchenmöbel und Finanzierung. Ersetzt kein Angebot – echte Preise können deutlich abweichen.",
  };
}

function euroKurz(v) {
  return v >= 1e6 ? `${fmt(v / 1e6, 2)} Mio. €` : `${fmt(Math.round(v / 1000), 0)} Tsd. €`;
}
function euroSprache(v) {
  if (v >= 1e6) return `${fmt(Math.round(v / 1e5) / 10, 1)} Millionen Euro`;
  return `${fmt(Math.round(v / 10000) * 10, 0)} tausend Euro`;
}
