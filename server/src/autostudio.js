// v1.136.0 Auto-Studio: Fridays eigene Auto-Datenbank für die Werkstatt.
// Kevin wollte Autos wie auf den KI-Bildern aus TikTok: Seitenansicht im hellen Studio mit Spiegelboden,
// echte Markenfarben und dazu die Daten (Motor, PS, 0–100, Spitze) – gern als ganze Modellreihe.
// Alles ohne Claude: die Daten stehen hier, das Dashboard (dashboard/autostudio.js) baut die Autos selbst.
// Werte: Herstellerangaben (gerundet, je nach Ausstattung/Modelljahr leicht anders). Logos werden NICHT
// nachgebaut – nur Schriftzug in Markenfarben.

// Karosserie-Arten, die dashboard/autostudio.js kennt:
// coupe, limousine, sportback, kombi, schraeg, suv, suvcoupe, gelaende, elfer
const M = (id, name, motor, ps, null100, spitze, karosserie, masse, farbe, extra = {}) => ({ id, name, motor, ps, null100, spitze, karosserie, ...masse, farbe, ...extra });
const mm = (laenge, hoehe, radstand, rad = 0.36, breite = 1.9) => ({ laenge, hoehe, radstand, rad, breite });

export const MARKEN = [
  {
    id: "bmw-m", marke: "BMW", reihe: "M", titel: "BMW M",
    // Die drei M-Farben als Streifen (keine Nachbildung des Logos).
    akzent: ["#1c69d4", "#3b2a8f", "#e4202c"], bremse: "#1f56d6", schrift: "#111318",
    begriffe: ["bmw m", "m modelle", "m-modelle", "m reihe", "m-reihe", "bmw m gmbh", "m power"],
    modelle: [
      M("bmw-m2", "M2", "3.0 l Reihensechser TwinPower Turbo", 480, 4.0, "250 km/h (285 mit M Driver's Package)", "coupe", mm(4.58, 1.40, 2.75, 0.355, 1.89), "#14161b", { muster: /\bm ?2\b/ }),
      M("bmw-m3-touring", "M3 Touring", "3.0 l Reihensechser TwinPower Turbo", 530, 3.6, "250 km/h (280 mit M Driver's Package)", "kombi", mm(4.81, 1.44, 2.86, 0.36, 1.90), "#14161b", { zusatz: "Competition M xDrive", muster: /\bm ?3\b.*touring|touring.*\bm ?3\b/ }),
      M("bmw-m3", "M3 Limousine", "3.0 l Reihensechser TwinPower Turbo", 530, 3.5, "250 km/h (290 mit M Driver's Package)", "limousine", mm(4.80, 1.43, 2.86, 0.36, 1.90), "#14161b", { zusatz: "Competition M xDrive", muster: /\bm ?3\b/, inReihe: false }),
      M("bmw-m4", "M4", "3.0 l Reihensechser TwinPower Turbo", 530, 3.5, "250 km/h (290 mit M Driver's Package)", "coupe", mm(4.80, 1.39, 2.86, 0.36, 1.89), "#14161b", { zusatz: "Competition Coupé M xDrive", muster: /\bm ?4\b/ }),
      M("bmw-m5", "M5", "4.4 l V8 TwinPower Turbo, Plug-in-Hybrid", 727, 3.5, "250 km/h (305 mit M Driver's Package)", "limousine", mm(5.10, 1.51, 3.01, 0.37, 1.97), "#14161b", { muster: /\bm ?5\b/ }),
      M("bmw-m8", "M8", "4.4 l V8 TwinPower Turbo", 625, 3.2, "250 km/h (305 mit M Driver's Package)", "coupe", mm(4.87, 1.36, 2.83, 0.36, 1.91), "#14161b", { zusatz: "Competition Coupé", muster: /\bm ?8\b/ }),
      M("bmw-x5m", "X5 M", "4.4 l V8 TwinPower Turbo, Mildhybrid", 625, 3.8, "250 km/h (290 mit M Driver's Package)", "suv", mm(4.94, 1.75, 2.97, 0.40, 2.02), "#14161b", { zusatz: "Competition", muster: /\bx ?5 ?m\b/ }),
    ],
  },
  {
    id: "amg", marke: "Mercedes-AMG", reihe: "AMG", titel: "Mercedes-AMG",
    akzent: ["#d40f2a"], bremse: "#d40f2a", schrift: "#111318",
    begriffe: ["amg", "mercedes amg", "mercedes-amg", "amg modelle"],
    modelle: [
      M("amg-a45s", "A 45 S", "2.0 l Vierzylinder Turbo", 421, 3.9, "270 km/h", "schraeg", mm(4.45, 1.41, 2.73, 0.35, 1.85), "#8d939b", { zusatz: "4MATIC+", muster: /\ba ?45\b/ }),
      M("amg-c63s", "C 63 S", "2.0 l Vierzylinder Turbo, Plug-in-Hybrid", 680, 3.4, "280 km/h (mit Paket)", "limousine", mm(4.83, 1.45, 2.87, 0.36, 1.90), "#8e0f1d", { zusatz: "E PERFORMANCE", muster: /\bc ?63\b/ }),
      M("amg-gt63s", "GT 63 S", "4.0 l V8 Biturbo", 639, 3.2, "315 km/h", "sportback", mm(5.05, 1.45, 2.95, 0.37, 1.95), "#14161b", { zusatz: "4-Türer Coupé", bremse: "#d8a21c", muster: /\bgt ?63 ?s\b|4-?t[üu]rer/ }),
      M("amg-gt63", "GT 63 Coupé", "4.0 l V8 Biturbo", 585, 3.2, "315 km/h", "coupe", mm(4.73, 1.35, 2.70, 0.36, 1.98), "#e8b21a", { zusatz: "4MATIC+", inReihe: false, muster: /\bamg gt\b|\bgt ?63\b/ }),
      M("amg-gle63s", "GLE 63 S", "4.0 l V8 Biturbo, Mildhybrid", 612, 3.8, "280 km/h (mit Paket)", "suv", mm(4.96, 1.77, 2.99, 0.40, 2.01), "#16264f", { zusatz: "4MATIC+", muster: /\bgle ?63\b/ }),
      M("amg-g63", "G 63", "4.0 l V8 Biturbo, Mildhybrid", 585, 4.4, "220 km/h (240 mit Paket)", "gelaende", mm(4.87, 1.97, 2.89, 0.41, 1.98), "#14161b", { muster: /\bg ?63\b|\bg ?klasse\b/ }),
    ],
  },
  {
    id: "vw-r", marke: "Volkswagen", reihe: "R", titel: "Volkswagen R",
    akzent: ["#1d5be0"], bremse: "#1d5be0", schrift: "#0e1a33",
    begriffe: ["vw r", "volkswagen r", "r modelle", "r-modelle", "vw r modelle"],
    modelle: [
      M("vw-golf-r", "Golf R", "2.0 l TSI 4MOTION", 333, 4.6, "250 km/h (270 mit R-Performance)", "schraeg", mm(4.29, 1.46, 2.63, 0.345, 1.79), "#e9ecef", { muster: /\bgolf ?r\b(?!.*variant)/ }),
      M("vw-golf-r-variant", "Golf R Variant", "2.0 l TSI 4MOTION", 333, 4.8, "250 km/h (270 mit R-Performance)", "kombi", mm(4.65, 1.46, 2.67, 0.345, 1.79), "#14161b", { muster: /golf ?r ?variant|golf variant r/ }),
      M("vw-t-roc-r", "T-Roc R", "2.0 l TSI 4MOTION", 300, 4.9, "250 km/h", "suv", mm(4.24, 1.57, 2.59, 0.36, 1.82), "#8d939b", { muster: /t-? ?roc ?r\b/ }),
      M("vw-tiguan-r", "Tiguan R", "2.0 l TSI 4MOTION", 320, 4.9, "250 km/h", "suv", mm(4.52, 1.66, 2.68, 0.37, 1.86), "#1d2a44", { muster: /tiguan ?r\b/ }),
      M("vw-arteon-r", "Arteon R Shooting Brake", "2.0 l TSI 4MOTION", 320, 4.9, "250 km/h", "kombi", mm(4.87, 1.46, 2.84, 0.36, 1.87), "#1d3f8c", { muster: /arteon ?r\b/ }),
      M("vw-touareg-r", "Touareg R", "3.0 l V6 TSI, Plug-in-Hybrid", 462, 5.1, "250 km/h", "suv", mm(4.88, 1.70, 2.90, 0.40, 1.98), "#3a3f46", { zusatz: "eHybrid", muster: /touareg ?r\b/ }),
    ],
  },
  {
    id: "audi-rs", marke: "Audi", reihe: "RS", titel: "Audi RS",
    akzent: ["#bb0a30"], bremse: "#c8102e", schrift: "#111318",
    begriffe: ["audi rs", "rs modelle", "rs-modelle", "audi sport", "rs reihe", "rs-reihe"],
    modelle: [
      M("audi-rs3", "RS 3", "2.5 l TFSI Fünfzylinder", 400, 3.8, "250 km/h (290 optional)", "limousine", mm(4.54, 1.41, 2.63, 0.35, 1.85), "#14161b", { zusatz: "Limousine", muster: /\brs ?3\b/ }),
      M("audi-rs4", "RS 4 Avant", "2.9 l TFSI V6 Biturbo", 450, 4.1, "250 km/h (290 optional)", "kombi", mm(4.78, 1.42, 2.83, 0.36, 1.87), "#14161b", { muster: /\brs ?4\b/ }),
      M("audi-rs5", "RS 5 Coupé", "2.9 l TFSI V6 Biturbo", 450, 3.9, "250 km/h (280 optional)", "coupe", mm(4.72, 1.37, 2.77, 0.36, 1.86), "#14161b", { muster: /\brs ?5\b/ }),
      M("audi-rs6", "RS 6 Avant", "4.0 l TFSI V8 Biturbo", 630, 3.4, "250 km/h (305 optional)", "kombi", mm(4.99, 1.46, 2.93, 0.37, 1.95), "#14161b", { zusatz: "performance", muster: /\brs ?6\b/ }),
      M("audi-rs7", "RS 7 Sportback", "4.0 l TFSI V8 Biturbo", 630, 3.4, "250 km/h (305 optional)", "sportback", mm(5.01, 1.42, 2.93, 0.37, 1.95), "#14161b", { zusatz: "performance", muster: /\brs ?7\b/ }),
      M("audi-rsq8", "RS Q8", "4.0 l TFSI V8 Biturbo", 640, 3.6, "250 km/h (305 optional)", "suvcoupe", mm(5.01, 1.69, 3.00, 0.40, 2.00), "#14161b", { zusatz: "performance", muster: /\brs ?q ?8\b/ }),
      M("audi-rs-etron-gt", "RS e-tron GT", "Elektro, zwei Motoren", 925, 2.5, "250 km/h", "sportback", mm(4.99, 1.40, 2.90, 0.37, 1.96), "#5d6670", { zusatz: "performance (mit Boost)", muster: /e-? ?tron ?gt/ }),
    ],
  },
  {
    id: "porsche", marke: "Porsche", reihe: "", titel: "Porsche",
    akzent: ["#d5001c", "#b39b5a"], bremse: "#e8c21a", schrift: "#111318",
    begriffe: ["porsche", "porsche modelle", "911er", "elfer"],
    modelle: [
      M("porsche-911-carrera", "911 Carrera", "3.0 l Sechszylinder-Boxer Biturbo", 394, 4.1, "294 km/h", "elfer", mm(4.54, 1.30, 2.45, 0.355, 1.85), "#c9ccd1", { bremse: "#1b1d22", muster: /911 ?carrera\b(?! ?gts)|\b911\b(?!.*(gt3|turbo|gts))/ }),
      M("porsche-911-gts", "911 Carrera GTS", "3.6 l Sechszylinder-Boxer, T-Hybrid", 541, 3.0, "312 km/h", "elfer", mm(4.55, 1.30, 2.45, 0.355, 1.85), "#1d4fa8", { muster: /911.*gts|carrera gts/ }),
      M("porsche-911-gt3", "911 GT3", "4.0 l Sechszylinder-Boxer (Sauger)", 510, 3.4, "311 km/h", "elfer", mm(4.57, 1.28, 2.46, 0.355, 1.85), "#e6e8eb", { fluegel: true, muster: /\bgt ?3\b/ }),
      M("porsche-911-turbo-s", "911 Turbo S", "3.7 l Sechszylinder-Boxer Biturbo", 650, 2.7, "330 km/h", "elfer", mm(4.54, 1.30, 2.45, 0.36, 1.90), "#14161b", { muster: /911 ?turbo|turbo ?s\b/ }),
      M("porsche-taycan-turbo-s", "Taycan Turbo S", "Elektro, zwei Motoren", 952, 2.4, "260 km/h", "sportback", mm(4.96, 1.38, 2.90, 0.37, 1.97), "#2a4d3a", { zusatz: "mit Launch Control", muster: /taycan/ }),
      M("porsche-cayenne-turbo", "Cayenne Turbo E-Hybrid", "4.0 l V8 Biturbo, Plug-in-Hybrid", 739, 3.7, "295 km/h", "suv", mm(4.93, 1.70, 2.90, 0.40, 1.98), "#8d939b", { muster: /cayenne/ }),
    ],
  },
];

const norm = (t) => String(t || "").toLowerCase().replace(/[-_]/g, " ").replace(/ß/g, "ss").replace(/\s+/g, " ").trim();
const zahlDe = (n) => String(n).replace(".", ",");

// Für das Dashboard: ohne RegExp (lassen sich nicht als JSON schicken).
function oeffentlich(marke, modell) {
  const { muster, ...m } = modell;
  return { ...m, bremse: m.bremse || marke.bremse };
}
function markeOeffentlich(marke, nurReihe = true) {
  const { begriffe, modelle, ...rest } = marke;
  return { ...rest, modelle: modelle.filter((m) => !nurReihe || m.inReihe !== false).map((m) => oeffentlich(marke, m)) };
}
export function alleMarken() {
  return MARKEN.map((m) => markeOeffentlich(m, false));
}

const REIHE_WORT = /modell ?reihe|modelle\b|reihe\b|vergleich|vergleiche|alle\b|übersicht|uebersicht|lineup|line up|familie|palette|aufstellung|nebeneinander/;

// Welche Marke ist gemeint? "bmw m" schlägt "bmw", "audi rs" schlägt "audi".
function findeMarke(t) {
  let best = null, len = 0;
  for (const m of MARKEN) {
    for (const b of [m.titel.toLowerCase(), ...m.begriffe]) {
      const re = new RegExp(`(^|[^a-z0-9])${norm(b).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`);
      if (re.test(t) && b.length > len) { best = m; len = b.length; }
    }
  }
  return best;
}

/**
 * Erkennt Autos aus Fridays Datenbank.
 * → { art: "reihe", marke } für "zeig mir die BMW M Modelle", "AMG Vergleich", "Audi RS"
 * → { art: "modell", marke, modell } für "bau mir einen M4", "RS 6 in Rot"
 */
export function findeAuto(text) {
  const t = norm(text);
  if (!t) return null;
  const marke = findeMarke(t);
  // Einzelnes Modell (auch ohne Markennamen: "bau mir einen RS6")
  const kandidaten = marke ? [marke] : MARKEN;
  for (const mk of kandidaten) {
    for (const mo of mk.modelle) {
      if (mo.muster && mo.muster.test(t)) {
        // "BMW M3" allein: die Touring-Regel greift nur mit "touring"; sonst Limousine.
        if (REIHE_WORT.test(t) && !/\b(bau|zeig|zeige)\b.*\b(einen|ein|eine|den|die|das)\b/.test(t)) return { art: "reihe", marke: mk, start: mo.id };
        // Mehrdeutige Kürzel ("m2", "g63") nur mit Markenbezug oder Bau-Befehl werten.
        const kurz = /^[a-z] ?\d{1,2}$/.test(mo.name.toLowerCase());
        if (kurz && !marke && t.replace(/ /g, "") !== mo.name.toLowerCase().replace(/ /g, "") && !/\b(bmw|mercedes|amg|auto|wagen|bau|baue|zeig|zeige)\b/.test(t)) continue;
        return { art: "modell", marke: mk, modell: mo };
      }
    }
  }
  const einzeln = /\b(einen|ein|eine|einem)\b/.test(t) && !REIHE_WORT.test(t); // "bau mir einen Porsche" = ein Auto, keine Reihe
  if (marke && !einzeln && (REIHE_WORT.test(t) || t.replace(/\b(friday|hey|bitte|zeig|zeige|mir|mal|die|der|das|den|von|baue?|bauen|werkstatt|im|in|studio|auto|autos)\b/g, "").trim() === norm(marke.titel) || marke.begriffe.some((b) => t.endsWith(norm(b))))) {
    return { art: "reihe", marke };
  }
  return null;
}

// Nur echte Bau-/Zeig-Befehle für die Sprachsteuerung ("Friday, zeig mir die AMG-Modelle").
export function istStudioBefehl(text) {
  const t = norm(text);
  if (!/\b(bau|baue|bauen|zeig|zeige|zeigen|vergleich|vergleiche|stell|stelle|werkstatt|studio|modelle|modellreihe)\b/.test(t)) return null;
  return findeAuto(t);
}

const psSatz = (m) => `${m.ps} PS, null auf hundert in ${zahlDe(m.null100)} Sekunden`;

/** Werkstatt-Plan für das Auto-Studio (ohne Claude). */
export function studioPlan(treffer, farbe = null) {
  const mk = treffer.marke;
  if (treffer.art === "reihe") {
    const reihe = markeOeffentlich(mk);
    const staerkster = [...reihe.modelle].sort((a, b) => b.ps - a.ps)[0];
    const schnellster = [...reihe.modelle].sort((a, b) => a.null100 - b.null100)[0];
    return {
      titel: `${mk.titel} · Modellreihe`,
      einleitung: `Sehr gern, Chef. Die ${mk.titel}-Familie im Studio: ${reihe.modelle.length} Modelle nebeneinander.`,
      steckbrief: { typ: `${mk.marke} · Modellreihe`, baujahr: "aktuell", preis: "–", kurz: `${reihe.modelle.map((m) => m.name).join(", ")}` },
      kennzahlen: [
        { label: "Stärkster", wert: `${staerkster.name} · ${staerkster.ps} PS` },
        { label: "Schnellster 0–100", wert: `${schnellster.name} · ${zahlDe(schnellster.null100)} s` },
      ],
      fazit: `Am stärksten ist der ${staerkster.name} mit ${staerkster.ps} PS, am schnellsten auf hundert der ${schnellster.name} mit ${zahlDe(schnellster.null100)} Sekunden.`,
      schritte: [],
      studio: { art: "reihe", marke: reihe, start: treffer.start || null, farbe },
    };
  }
  const mo = oeffentlich(mk, treffer.modell);
  const name = `${mk.marke === "Mercedes-AMG" ? "Mercedes-AMG" : mk.marke} ${mo.name}`;
  return {
    titel: `${name}${mo.zusatz ? ` ${mo.zusatz}` : ""}`,
    einleitung: `Sehr gern, Chef. Der ${name} im Studio.`,
    steckbrief: { typ: `${mk.marke} · ${mk.titel}`, baujahr: "aktuell", preis: "–", kurz: mo.motor },
    kennzahlen: [
      { label: "Motor", wert: mo.motor },
      { label: "Leistung", wert: `${mo.ps} PS` },
      { label: "0–100 km/h", wert: `${zahlDe(mo.null100)} s` },
      { label: "Spitze", wert: mo.spitze },
      { label: "Länge", wert: `${zahlDe(mo.laenge)} m` },
    ],
    fazit: `${psSatz(mo)}, Spitze ${mo.spitze.replace(/ \(.*\)/, "")}.`,
    schritte: [],
    studio: { art: "modell", marke: markeOeffentlich(mk, false), modell: mo.id, farbe },
  };
}
