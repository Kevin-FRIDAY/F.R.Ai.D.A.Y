// Rechenlabor – alles ohne Claude, sofort und kostenlos:
// - Formel-Labor: sicherer Rechner mit Funktionen, Variablen und Wertetabelle (kein eval).
// - Prognose: Trend aus einer Zahlenreihe (lineare Regression + gleitender Durchschnitt) mit Unsicherheitsband.
// - Was-wäre-wenn / System-Simulator: Monte-Carlo-Simulation eines Modells mit unsicheren Werten,
//   Vergleich mehrerer Szenarien (P10 / Median / P90).
// - 3D-Modell-Analyse: STL- und OBJ-Dateien vermessen (Größe, Fläche, Volumen, dicht?).

// ===== Formel-Parser =====
const FUNKTIONEN = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, wurzel: Math.sqrt, abs: Math.abs, betrag: Math.abs, ln: Math.log, log: Math.log10, log2: Math.log2, exp: Math.exp,
  round: Math.round, runden: Math.round, floor: Math.floor, abrunden: Math.floor, ceil: Math.ceil, aufrunden: Math.ceil,
  min: Math.min, max: Math.max, hypot: Math.hypot,
  sind: (x) => Math.sin((x * Math.PI) / 180), cosd: (x) => Math.cos((x * Math.PI) / 180), tand: (x) => Math.tan((x * Math.PI) / 180),
  fak: (n) => { if (n < 0 || n > 170 || !Number.isInteger(n)) return NaN; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
  mittel: (...a) => a.reduce((s, x) => s + x, 0) / a.length, summe: (...a) => a.reduce((s, x) => s + x, 0),
};
const KONSTANTEN = { pi: Math.PI, e: Math.E, phi: (1 + Math.sqrt(5)) / 2, c: 299792458, g: 9.80665 };

function tokenisiere(s) {
  const t = [];
  const re = /\s*(\d+(?:[.,]\d+)?(?:e[+-]?\d+)?|[A-Za-zäöüÄÖÜß_][A-Za-z0-9äöüÄÖÜß_]*|\*\*|[-+*/^%(),;!])/gy;
  let m, pos = 0;
  const q = s.trim();
  re.lastIndex = 0;
  while (pos < q.length) {
    re.lastIndex = pos;
    m = re.exec(q);
    if (!m) throw new Error(`Unbekanntes Zeichen bei „${q.slice(pos, pos + 8)}“`);
    t.push(m[1] === "**" ? "^" : m[1]);
    pos = re.lastIndex;
    while (q[pos] === " ") pos++;
  }
  return t;
}

/** Rechnet einen Ausdruck aus. variablen: {x: 3, …} */
export function rechne(ausdruck, variablen = {}) {
  const s = String(ausdruck || "").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/²/g, "^2").replace(/³/g, "^3");
  if (s.length > 500) throw new Error("Formel ist zu lang.");
  const tok = tokenisiere(s);
  let i = 0;
  const sieh = () => tok[i];
  const nimm = (x) => { if (x && tok[i] !== x) throw new Error(`„${x}“ erwartet`); return tok[i++]; };
  const zahl = (x) => /^\d/.test(x);
  function ausdr() { let v = term(); while (sieh() === "+" || sieh() === "-") { const op = nimm(); const r = term(); v = op === "+" ? v + r : v - r; } return v; }
  function term() { let v = unaer(); while (["*", "/", "%"].includes(sieh()) || (sieh() && (sieh() === "(" || /^[A-Za-zäöü]/i.test(sieh()) || zahl(sieh())))) {
    const op = ["*", "/", "%"].includes(sieh()) ? nimm() : "*"; // 2x oder 2(3) = Malnehmen
    const r = unaer(); v = op === "*" ? v * r : op === "/" ? v / r : v % r; } return v; }
  function unaer() { if (sieh() === "-") { nimm(); return -unaer(); } if (sieh() === "+") { nimm(); return unaer(); } return potenz(); }
  function potenz() { let b = fakult(); if (sieh() === "^") { nimm(); const e = unaer(); b = b ** e; } return b; }
  function fakult() { let v = basis(); while (sieh() === "!") { nimm(); v = FUNKTIONEN.fak(v); } return v; }
  function basis() {
    const x = nimm();
    if (x === undefined) throw new Error("Die Formel ist unvollständig.");
    if (zahl(x)) { let v = Number(x.replace(",", ".")); if (sieh() === "%" && (tok[i + 1] === undefined || [")", "+", "-", ";", ","].includes(tok[i + 1]))) { nimm(); v /= 100; } return v; }
    if (x === "(") { const v = ausdr(); nimm(")"); return v; }
    const n = x.toLowerCase();
    if (FUNKTIONEN[n] && sieh() === "(") {
      nimm("(");
      const args = [];
      if (sieh() !== ")") { args.push(ausdr()); while (sieh() === ";" || sieh() === ",") { nimm(); args.push(ausdr()); } }
      nimm(")");
      return FUNKTIONEN[n](...args);
    }
    if (Object.hasOwn(variablen, x)) return Number(variablen[x]);
    if (Object.hasOwn(variablen, n)) return Number(variablen[n]);
    if (Object.hasOwn(KONSTANTEN, n)) return KONSTANTEN[n];
    throw new Error(`Unbekannt: „${x}“`);
  }
  const v = ausdr();
  if (i < tok.length) throw new Error(`Unerwartet: „${tok[i]}“`);
  return v;
}

const schoen = (v) => (Number.isFinite(v) ? Number(Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-6 && v !== 0) ? v.toExponential(6) : Math.round(v * 1e10) / 1e10) : v);

/**
 * Formel-Labor: mehrere Zeilen, Zuweisungen ("a = 5"), letzte Zeile = Ergebnis.
 * Mit tabelle {variable, von, bis, schritte} entsteht eine Wertetabelle der letzten Formel.
 */
export function formelLabor({ formel = "", tabelle = null } = {}) {
  const zeilen = String(formel).split(/\n/).map((z) => z.trim()).filter((z) => z && !z.startsWith("#"));
  if (!zeilen.length) return { error: "Gib eine Formel ein, z. B. 2^10 oder sqrt(2) * pi." };
  const vars = {};
  const schritte = [];
  let letzte = "";
  try {
    for (const z of zeilen.slice(0, 40)) {
      const m = z.match(/^([A-Za-zäöüß_][\wäöüß]*)\s*=\s*(.+)$/i);
      if (m && !FUNKTIONEN[m[1].toLowerCase()]) {
        vars[m[1]] = rechne(m[2], vars);
        schritte.push({ zeile: z, wert: schoen(vars[m[1]]) });
        letzte = m[2];
      } else {
        const v = rechne(z, vars);
        schritte.push({ zeile: z, wert: schoen(v) });
        letzte = z;
      }
    }
  } catch (err) {
    return { error: err.message, schritte };
  }
  const out = { ergebnis: schritte[schritte.length - 1].wert, schritte, variablen: Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, schoen(v)])) };
  if (tabelle?.variable) {
    const von = Number(tabelle.von), bis = Number(tabelle.bis), n = Math.min(200, Math.max(2, Number(tabelle.schritte) || 20));
    if (Number.isFinite(von) && Number.isFinite(bis)) {
      out.tabelle = [];
      for (let k = 0; k <= n; k++) {
        const x = von + ((bis - von) * k) / n;
        let y;
        try { y = rechne(letzte, { ...vars, [tabelle.variable]: x }); } catch { y = NaN; }
        out.tabelle.push({ x: schoen(x), y: schoen(y) });
      }
    }
  }
  return out;
}

// ===== Prognose =====
/** Liest Zahlen aus Text: "12, 15, 14" oder eine Tabelle (letzte Zahlen-Spalte zählt). */
export function leseReihe(text) {
  const zeilen = String(text || "").trim().split(/\n/).filter((z) => z.trim());
  let werte = [], namen = [];
  if (zeilen.length > 1 && zeilen.some((z) => /[;\t]|,\s*\S/.test(z))) {
    for (const z of zeilen) {
      const teile = z.split(/[;\t]|,(?=\s*[-\d])|,\s+/).map((x) => x.trim());
      const zahlen = teile.map((x) => Number(x.replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."))).filter(Number.isFinite);
      if (!zahlen.length) continue;
      werte.push(zahlen[zahlen.length - 1]);
      namen.push(teile[0] && !Number.isFinite(Number(teile[0].replace(",", "."))) ? teile[0] : String(werte.length));
    }
  } else {
    werte = (String(text).match(/-?\d+(?:[.,]\d+)?/g) || []).map((x) => Number(x.replace(",", ".")));
    namen = werte.map((_, i) => String(i + 1));
  }
  return { werte, namen };
}

export function prognose({ daten = "", schritte = 5 } = {}) {
  const { werte, namen } = leseReihe(daten);
  if (werte.length < 3) return { error: "Ich brauche mindestens 3 Zahlen (z. B. Umsätze der letzten Monate)." };
  const n = werte.length;
  const xs = werte.map((_, i) => i);
  const mx = (n - 1) / 2, my = werte.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (i - mx) * (werte[i] - my); sxx += (i - mx) ** 2; }
  const steigung = sxy / sxx, achse = my - steigung * mx;
  const geschaetzt = xs.map((x) => achse + steigung * x);
  const ssRes = werte.reduce((a, y, i) => a + (y - geschaetzt[i]) ** 2, 0);
  const ssTot = werte.reduce((a, y) => a + (y - my) ** 2, 0);
  const r2 = ssTot ? 1 - ssRes / ssTot : 1;
  const sigma = Math.sqrt(ssRes / Math.max(1, n - 2));
  const k = Math.min(60, Math.max(1, Number(schritte) || 5));
  const fenster = Math.min(3, n);
  const gleitend = werte.slice(-fenster).reduce((a, b) => a + b, 0) / fenster;
  const zukunft = [];
  for (let j = 1; j <= k; j++) {
    const x = n - 1 + j;
    const y = achse + steigung * x;
    const band = 1.96 * sigma * Math.sqrt(1 + 1 / n + (x - mx) ** 2 / sxx);
    zukunft.push({ schritt: j, wert: schoen(y), unten: schoen(y - band), oben: schoen(y + band) });
  }
  const wachstum = werte[0] ? ((werte[n - 1] - werte[0]) / Math.abs(werte[0])) * 100 : null;
  const sicherheit = n < 6 ? "niedrig" : r2 > 0.8 ? "hoch" : r2 > 0.5 ? "mittel" : "niedrig";
  return {
    werte, namen, zukunft,
    trend: { steigung: schoen(steigung), richtung: Math.abs(steigung) < sigma / Math.max(1, n) ? "seitwärts" : steigung > 0 ? "steigend" : "fallend", r2: schoen(r2) },
    gleitender_durchschnitt: schoen(gleitend),
    wachstum_prozent: wachstum == null ? null : schoen(wachstum),
    sicherheit,
    hinweis: `Lineare Trend-Fortschreibung aus ${n} Werten. Bestimmtheit R² = ${schoen(r2)} (1 = Trend erklärt alles). Das Band zeigt, wo der Wert mit etwa 95 % liegen sollte – wenn sich nichts Grundlegendes ändert. Keine Anlageberatung.`,
  };
}

// ===== Monte-Carlo (Was-wäre-wenn / System-Simulator) =====
function dreieck(min, wahr, max) {
  if (max <= min) return min;
  const u = Math.random();
  const f = (wahr - min) / (max - min);
  return u < f ? min + Math.sqrt(u * (max - min) * (wahr - min)) : max - Math.sqrt((1 - u) * (max - min) * (max - wahr));
}
const quantil = (sortiert, q) => sortiert[Math.min(sortiert.length - 1, Math.max(0, Math.floor(q * (sortiert.length - 1))))];

/**
 * Simuliert ein Modell. variablen: [{name, min, wahrscheinlich, max}] (fester Wert: min = max).
 * szenarien: [{name, formel, aenderungen: {var: wert}}] – jede Formel wird mit denselben Zufallswerten gerechnet.
 * schwelle: optional, Wahrscheinlichkeit, dass das Ergebnis darüber liegt.
 */
export function simuliere({ variablen = [], szenarien = [], laeufe = 5000, schwelle = null } = {}) {
  const vs = variablen.filter((v) => v && /^[A-Za-zäöüß_][\wäöüß]*$/i.test(String(v.name || ""))).slice(0, 20).map((v) => {
    const min = Number(v.min), max = Number(v.max ?? v.min), wahr = Number(v.wahrscheinlich ?? (min + max) / 2);
    return { name: v.name, min: Math.min(min, max), max: Math.max(min, max), wahr: Math.min(Math.max(wahr, Math.min(min, max)), Math.max(min, max)) };
  });
  if (vs.some((v) => !Number.isFinite(v.min) || !Number.isFinite(v.max))) return { error: "Jede Größe braucht Zahlen bei Min und Max." };
  const sz = szenarien.filter((s) => String(s?.formel || "").trim()).slice(0, 4);
  if (!sz.length) return { error: "Gib mindestens eine Formel für ein Szenario ein, z. B. preis * menge - kosten." };
  const n = Math.min(20000, Math.max(200, Number(laeufe) || 5000));
  const ergebnisse = sz.map(() => []);
  for (let k = 0; k < n; k++) {
    const basis = Object.fromEntries(vs.map((v) => [v.name, dreieck(v.min, v.wahr, v.max)]));
    sz.forEach((s, j) => {
      const werte = { ...basis, ...Object.fromEntries(Object.entries(s.aenderungen || {}).map(([a, b]) => [a, Number(b)]).filter(([, b]) => Number.isFinite(b))) };
      let y;
      try { y = rechne(s.formel, werte); } catch (err) { throw new Error(`Szenario „${s.name || j + 1}“: ${err.message}`); }
      if (Number.isFinite(y)) ergebnisse[j].push(y);
    });
  }
  const auswertung = sz.map((s, j) => {
    const a = ergebnisse[j].sort((x, y) => x - y);
    if (!a.length) return { name: s.name || `Szenario ${j + 1}`, error: "Keine gültigen Ergebnisse." };
    const mittel = a.reduce((x, y) => x + y, 0) / a.length;
    const lo = a[0], hi = a[a.length - 1], fächer = 24, breite = (hi - lo) / fächer || 1;
    const histogramm = Array(fächer).fill(0);
    for (const y of a) histogramm[Math.min(fächer - 1, Math.floor((y - lo) / breite))]++;
    return {
      name: s.name || `Szenario ${j + 1}`, formel: s.formel,
      p10: schoen(quantil(a, 0.1)), median: schoen(quantil(a, 0.5)), p90: schoen(quantil(a, 0.9)), mittel: schoen(mittel), min: schoen(lo), max: schoen(hi),
      ...(schwelle != null && Number.isFinite(Number(schwelle)) ? { ueber_schwelle: schoen((a.filter((y) => y > Number(schwelle)).length / a.length) * 100) } : {}),
      histogramm, von: schoen(lo), bis: schoen(hi),
    };
  });
  const gueltig = auswertung.filter((x) => !x.error);
  const bestes = gueltig.slice().sort((a, b) => b.median - a.median)[0];
  return { laeufe: n, auswertung, bestes: bestes?.name || null, hinweis: "Jede Größe wird zufällig zwischen Min und Max gezogen (am häufigsten beim wahrscheinlichen Wert). P10 = in 9 von 10 Fällen besser als das, P90 = nur in 1 von 10 Fällen besser. Das Ergebnis ist nur so gut wie das Modell und die Annahmen." };
}

// ===== 3D-Modell-Analyse (STL / OBJ) =====
function dreieckeAusStl(buf) {
  const istText = buf.slice(0, 5).toString("ascii").toLowerCase() === "solid" && /facet/i.test(buf.slice(0, 1000).toString("ascii"));
  const tri = [];
  if (istText) {
    const v = [...buf.toString("ascii").matchAll(/vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
    for (let i = 0; i + 2 < v.length; i += 3) tri.push([v[i], v[i + 1], v[i + 2]]);
  } else {
    if (buf.length < 84) throw new Error("Die STL-Datei ist zu kurz.");
    const n = buf.readUInt32LE(80);
    if (84 + n * 50 > buf.length) throw new Error("Die STL-Datei ist unvollständig.");
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;
      const p = (k) => [buf.readFloatLE(o + k * 12), buf.readFloatLE(o + k * 12 + 4), buf.readFloatLE(o + k * 12 + 8)];
      tri.push([p(0), p(1), p(2)]);
    }
  }
  return tri;
}
function dreieckeAusObj(text) {
  const v = [], tri = [];
  for (const z of text.split(/\n/)) {
    const t = z.trim().split(/\s+/);
    if (t[0] === "v") v.push([Number(t[1]), Number(t[2]), Number(t[3])]);
    else if (t[0] === "f") {
      const idx = t.slice(1).map((x) => { const k = parseInt(x.split("/")[0], 10); return k < 0 ? v.length + k : k - 1; });
      for (let i = 1; i + 1 < idx.length; i++) if (v[idx[0]] && v[idx[i]] && v[idx[i + 1]]) tri.push([v[idx[0]], v[idx[i]], v[idx[i + 1]]]);
    }
  }
  return tri;
}

/** Vermisst ein 3D-Modell. daten = base64 der Datei, name = Dateiname. */
export function analysiereModell({ daten, name = "" }) {
  let buf;
  try { buf = Buffer.from(String(daten || ""), "base64"); } catch { return { error: "Datei konnte nicht gelesen werden." }; }
  if (!buf.length) return { error: "Leere Datei." };
  if (buf.length > 40 * 1024 * 1024) return { error: "Die Datei ist zu groß (höchstens 40 MB)." };
  const obj = /\.obj$/i.test(name) || /^\s*(#|v |o |mtllib)/m.test(buf.slice(0, 200).toString("utf8"));
  let tri;
  try { tri = obj ? dreieckeAusObj(buf.toString("utf8")) : dreieckeAusStl(buf); } catch (err) { return { error: err.message }; }
  if (!tri.length) return { error: "Keine Dreiecke gefunden. Ist das eine STL- oder OBJ-Datei?" };
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let flaeche = 0, volumen = 0, entartet = 0;
  const kanten = new Map();
  const schl = (p) => p.map((x) => Math.round(x * 1e4)).join(",");
  for (const [a, b, c] of tri) {
    for (const p of [a, b, c]) for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const kr = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const f = Math.hypot(...kr) / 2;
    if (f < 1e-12) entartet++;
    flaeche += f;
    volumen += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    const ka = schl(a), kb = schl(b), kc = schl(c);
    for (const [p, q] of [[ka, kb], [kb, kc], [kc, ka]]) { const k = p < q ? `${p}|${q}` : `${q}|${p}`; kanten.set(k, (kanten.get(k) || 0) + 1); }
  }
  let offen = 0, ueber = 0;
  for (const z of kanten.values()) { if (z === 1) offen++; else if (z > 2) ueber++; }
  const masse = max.map((x, k) => x - min[k]);
  const dicht = offen === 0 && ueber === 0;
  const tipps = [];
  if (!dicht) tipps.push(`Das Modell ist nicht dicht (${offen} offene Kanten${ueber ? `, ${ueber} mehrfach genutzte` : ""}) – für den 3D-Druck vorher reparieren (z. B. in Blender „3D Print Toolbox“ oder Meshmixer).`);
  if (entartet) tipps.push(`${entartet} Dreiecke haben keine Fläche (können weg).`);
  if (Math.max(...masse) > 1000) tipps.push("Sehr groß – vermutlich sind die Einheiten Millimeter und das Modell ist über 1 m groß, oder die Einheiten stimmen nicht.");
  if (Math.max(...masse) < 1) tipps.push("Sehr klein – vielleicht sind die Einheiten Meter statt Millimeter (dann × 1000).");
  return {
    format: obj ? "OBJ" : "STL", dreiecke: tri.length,
    masse: masse.map(schoen), min: min.map(schoen), max: max.map(schoen),
    flaeche: schoen(flaeche), volumen: schoen(Math.abs(volumen)),
    dicht, offene_kanten: offen,
    druck_gramm_pla: dicht ? schoen((Math.abs(volumen) / 1000) * 1.24) : null,
    tipps,
    hinweis: "Einheiten wie in der Datei (bei 3D-Druck meist Millimeter). Gewicht geschätzt für PLA bei 100 % Füllung, wenn die Maße in mm sind.",
  };
}
