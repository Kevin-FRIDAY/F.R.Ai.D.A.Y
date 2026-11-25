// Was ist heute am Himmel? (v1.166.0, Stern-Idee aus der Ideen-Schmiede)
// Alles wird direkt auf dem Mac berechnet, ohne Claude und ohne Schlüssel:
// Mondphase, Sonnenauf-/untergang, sichtbare Planeten (Keplerbahnen nach JPL-Näherung, gut auf ~1°),
// Sternschnuppen-Nächte (feste Tabelle der großen Ströme) und ISS-Überflüge (Bahndaten von CelesTrak,
// gerechnet mit satellite.js aus dashboard/vendor). Nur die ISS-Bahndaten kommen aus dem Internet.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { holen, ortZuKoordinaten, sauber, uhrzeit, datumLang } from "./wunsch-hilfe.js";
import { U } from "./datum.js";
import * as store from "./store.js";

const RAD = Math.PI / 180;
const HIER = path.dirname(fileURLToPath(import.meta.url));
const SAT_JS = path.join(HIER, "..", "..", "dashboard", "vendor", "satellite.min.js");
let satellite = null;
function sat() {
  if (satellite) return satellite;
  if (!fs.existsSync(SAT_JS)) throw new Error("satellite.js fehlt");
  satellite = createRequire(import.meta.url)(SAT_JS);
  return satellite;
}

// ---------- Zeit ----------
const jd = (ms) => ms / 864e5 + 2440587.5;
const T = (ms) => (jd(ms) - 2451545.0) / 36525; // Jahrhunderte seit J2000
const norm360 = (x) => ((x % 360) + 360) % 360;

// ---------- Sonne (nach SunCalc / Astronomical Algorithms, vereinfacht) ----------
function sonnenPos(ms) {
  const d = jd(ms) - 2451545.0;
  const M = norm360(357.5291 + 0.98560028 * d) * RAD;
  const C = (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * RAD;
  const L = M + C + 102.9372 * RAD + Math.PI; // ekliptikale Länge
  const e = 23.4397 * RAD;
  return { ra: Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L)), dec: Math.asin(Math.sin(e) * Math.sin(L)), lon: L };
}
const sternzeit = (ms, lonDeg) => (280.16 + 360.9856235 * (jd(ms) - 2451545.0)) * RAD + lonDeg * RAD;
function hoehe(ra, dec, ms, lat, lon) {
  const H = sternzeit(ms, lon) - ra;
  const phi = lat * RAD;
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD;
}
function azimut(ra, dec, ms, lat, lon) {
  const H = sternzeit(ms, lon) - ra;
  const phi = lat * RAD;
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / RAD + 180;
  return norm360(az);
}
export const sonnenHoehe = (ms, lat, lon) => { const s = sonnenPos(ms); return hoehe(s.ra, s.dec, ms, lat, lon); };

/** Sonnenauf- und -untergang (und Ende der Dämmerung) für den Tag, in dem "ms" liegt, per Suche in 2-Minuten-Schritten. */
export function sonnenZeiten(ms, lat, lon) {
  const tag = mitternacht(ms);
  const out = { aufgang: null, untergang: null, dunkel: null, hell: null };
  let vorher = sonnenHoehe(tag, lat, lon);
  for (let t = tag + 120000; t <= tag + 864e5; t += 120000) {
    const h = sonnenHoehe(t, lat, lon);
    if (vorher < -0.833 && h >= -0.833 && !out.aufgang) out.aufgang = t;
    if (vorher >= -0.833 && h < -0.833 && !out.untergang) out.untergang = t;
    if (vorher >= -12 && h < -12 && !out.dunkel) out.dunkel = t;
    if (vorher < -12 && h >= -12 && !out.hell) out.hell = t;
    vorher = h;
  }
  return out;
}
/** Mitternacht (lokale Zeitzone) des Tages von ms, als UTC-Millisekunden. */
function mitternacht(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: config.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return ms - ((Number(p.hour) * 60 + Number(p.minute)) * 60 + Number(p.second)) * 1000 - (ms % 1000);
}

// ---------- Mond ----------
const SYNODISCH = 29.530588853;
const NEUMOND_2000 = Date.UTC(2000, 0, 6, 18, 14);
export function mond(ms = Date.now()) {
  const alter = ((((ms - NEUMOND_2000) / 864e5) % SYNODISCH) + SYNODISCH) % SYNODISCH;
  const beleuchtet = Math.round(((1 - Math.cos((2 * Math.PI * alter) / SYNODISCH)) / 2) * 100);
  const namen = [
    [1.0, "Neumond", "🌑"], [6.4, "zunehmende Sichel", "🌒"], [8.4, "erstes Viertel", "🌓"], [13.8, "zunehmender Mond", "🌔"],
    [15.8, "Vollmond", "🌕"], [21.1, "abnehmender Mond", "🌖"], [23.1, "letztes Viertel", "🌗"], [28.5, "abnehmende Sichel", "🌘"], [99, "Neumond", "🌑"],
  ];
  const [, name, zeichen] = namen.find(([g]) => alter < g);
  const bis = (ziel) => ms + ((((ziel - alter) % SYNODISCH) + SYNODISCH) % SYNODISCH || SYNODISCH) * 864e5;
  return { alter: Math.round(alter * 10) / 10, beleuchtet, name, zeichen, vollmond: new Date(bis(SYNODISCH / 2)).toISOString(), neumond: new Date(bis(0)).toISOString() };
}

// ---------- Planeten (JPL "Approximate Positions of the Planets", Tabelle 1, 1800–2050) ----------
// [a, e, I, L, varpi, Omega] und ihre Änderung pro Jahrhundert
const BAHN = {
  merkur: [[0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418]],
  erde: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
  mars: [[1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
};
const PLANET_NAMEN = { merkur: "Merkur", venus: "Venus", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn" };
const PLANET_ZEICHEN = { merkur: "☿", venus: "♀", mars: "♂", jupiter: "♃", saturn: "♄" };
function helio(name, ms) {
  const [b, r] = BAHN[name];
  const t = T(ms);
  const [a, e, I, L, w, O] = b.map((x, i) => x + r[i] * t);
  const M = norm360(L - w) * RAD;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xs = a * (Math.cos(E) - e), ys = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const om = (w - O) * RAD, Or = O * RAD, Ir = I * RAD;
  return {
    x: (Math.cos(om) * Math.cos(Or) - Math.sin(om) * Math.sin(Or) * Math.cos(Ir)) * xs + (-Math.sin(om) * Math.cos(Or) - Math.cos(om) * Math.sin(Or) * Math.cos(Ir)) * ys,
    y: (Math.cos(om) * Math.sin(Or) + Math.sin(om) * Math.cos(Or) * Math.cos(Ir)) * xs + (-Math.sin(om) * Math.sin(Or) + Math.cos(om) * Math.cos(Or) * Math.cos(Ir)) * ys,
    z: Math.sin(om) * Math.sin(Ir) * xs + Math.cos(om) * Math.sin(Ir) * ys,
  };
}
function planetRaDec(name, ms) {
  const p = helio(name, ms), er = helio("erde", ms);
  const x = p.x - er.x, y = p.y - er.y, z = p.z - er.z;
  const eps = 23.43928 * RAD;
  const xe = x, ye = y * Math.cos(eps) - z * Math.sin(eps), ze = y * Math.sin(eps) + z * Math.cos(eps);
  const s = { x: -er.x, y: -er.y }; // Richtung Sonne von der Erde
  const elong = Math.acos((x * s.x + y * s.y) / (Math.hypot(x, y, z) * Math.hypot(s.x, s.y))) / RAD;
  return { ra: Math.atan2(ye, xe), dec: Math.atan2(ze, Math.hypot(xe, ye)), elong, abstand: Math.hypot(x, y, z) };
}
const RICHTUNG = ["Norden", "Nordosten", "Osten", "Südosten", "Süden", "Südwesten", "Westen", "Nordwesten"];
const richtung = (az) => RICHTUNG[Math.round(az / 45) % 8];

/** Welche Planeten sind heute Abend / morgen früh gut zu sehen? */
export function planeten(ms, lat, lon) {
  const z = sonnenZeiten(ms, lat, lon);
  const abend = (z.untergang || ms) + 75 * 60000;
  const morgen = (sonnenZeiten(ms + 864e5, lat, lon).aufgang || ms + 864e5) - 75 * 60000;
  return Object.keys(PLANET_NAMEN).map((id) => {
    const best = [["abends", abend], ["morgens", morgen]].map(([wann, t]) => {
      const p = planetRaDec(id, t);
      return { wann, zeit: t, hoehe: Math.round(hoehe(p.ra, p.dec, t, lat, lon)), richtung: richtung(azimut(p.ra, p.dec, t, lat, lon)), elong: Math.round(p.elong) };
    }).sort((a, b) => b.hoehe - a.hoehe)[0];
    const sichtbar = best.hoehe >= 8 && best.elong >= (id === "merkur" ? 15 : 12);
    return { id, name: PLANET_NAMEN[id], zeichen: PLANET_ZEICHEN[id], sichtbar, ...best, zeit: new Date(best.zeit).toISOString() };
  });
}

// ---------- Sternschnuppen ----------
// [Name, Monat, Tag (Maximum), Sternschnuppen pro Stunde (ZHR, ideal), Tipp]
const STROEME = [
  ["Quadrantiden", 1, 3, 110, "nach Mitternacht Richtung Nordosten"],
  ["Lyriden", 4, 22, 18, "nach Mitternacht hoch im Osten"],
  ["Eta-Aquariiden", 5, 6, 50, "kurz vor der Dämmerung, tief im Osten"],
  ["Perseiden", 8, 12, 100, "ab 23 Uhr, am besten nach Mitternacht, Richtung Nordosten"],
  ["Draconiden", 10, 8, 10, "am Abend, hoch im Norden"],
  ["Orioniden", 10, 21, 20, "nach Mitternacht Richtung Südosten"],
  ["Leoniden", 11, 17, 15, "nach Mitternacht Richtung Osten"],
  ["Geminiden", 12, 14, 150, "schon ab 21 Uhr, fast die ganze Nacht"],
  ["Ursiden", 12, 22, 10, "die ganze Nacht im Norden"],
];
export function sternschnuppen(ms = Date.now(), tage = 45) {
  const jahr = new Date(ms).getUTCFullYear();
  const out = [];
  for (const j of [jahr, jahr + 1]) for (const [name, m, d, zhr, tipp] of STROEME) {
    const t = Date.UTC(j, m - 1, d, 22);
    const inTagen = Math.round((t - ms) / 864e5);
    if (inTagen < -1 || inTagen > tage) continue;
    const mo = mond(t);
    out.push({ name, datum: new Date(t).toISOString(), inTagen, proStunde: zhr, tipp, mondStoert: mo.beleuchtet > 60, mond: mo.beleuchtet });
  }
  return out.sort((a, b) => a.inTagen - b.inTagen);
}

// ---------- ISS-Überflüge ----------
const CT = String(process.env.CELESTRAK_URL || "https://celestrak.org").replace(/\/$/, "");
async function issTle() {
  const c = store.load("himmel-iss", {});
  if (c.l1 && Date.now() - (c.zeit || 0) < 12 * 3600 * 1000) return c;
  try {
    const t = await holen(`${CT}/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle`, { json: false });
    const z = String(t).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const l1 = z.find((s) => s.startsWith("1 ")), l2 = z.find((s) => s.startsWith("2 "));
    if (!l1 || !l2) throw new Error("keine Bahndaten");
    const neu = { l1, l2, zeit: Date.now() };
    store.save("himmel-iss", neu);
    return neu;
  } catch (err) {
    if (c.l1) return c; // alte Bahndaten sind ein paar Tage brauchbar
    throw err;
  }
}
/** Sichtbare ISS-Überflüge der nächsten Tage (ISS von der Sonne beleuchtet, Himmel dunkel, höher als 10°). */
export async function issUeberfluege(lat, lon, { tage = 3, ab = Date.now() } = {}) {
  const s = sat();
  const { l1, l2 } = await issTle();
  const rec = s.twoline2satrec(l1, l2);
  const beob = { latitude: lat * RAD, longitude: lon * RAD, height: 0.05 };
  const out = [];
  let lauf = null;
  for (let t = ab; t < ab + tage * 864e5; t += 20000) {
    const d = new Date(t);
    const pv = s.propagate(rec, d);
    if (!pv.position) continue;
    const gmst = s.gstime(d);
    const look = s.ecfToLookAngles(beob, s.eciToEcf(pv.position, gmst));
    const el = look.elevation / RAD;
    if (el > 10) {
      if (!lauf) lauf = { start: t, max: el, maxZeit: t, azStart: look.azimuth / RAD, sichtbar: false };
      if (el > lauf.max) { lauf.max = el; lauf.maxZeit = t; }
      lauf.ende = t; lauf.azEnde = look.azimuth / RAD;
      if (!lauf.sichtbar && sonnenHoehe(t, lat, lon) < -6 && beleuchtet(pv.position, t)) lauf.sichtbar = true;
    } else if (lauf) {
      out.push({ start: new Date(lauf.start).toISOString(), hoechster: new Date(lauf.maxZeit).toISOString(), ende: new Date(lauf.ende).toISOString(), maxHoehe: Math.round(lauf.max), von: richtung(lauf.azStart), nach: richtung(lauf.azEnde), minuten: Math.max(1, Math.round((lauf.ende - lauf.start) / 60000)), sichtbar: lauf.sichtbar });
      lauf = null;
    }
  }
  return out;
}
// Steht die ISS im Erdschatten? (zylindrischer Schatten, reicht für Überflüge)
function beleuchtet(pos, ms) {
  const sp = sonnenPos(ms);
  const eps = 23.4397 * RAD;
  const sx = Math.cos(sp.lon), sy = Math.sin(sp.lon) * Math.cos(eps), sz = Math.sin(sp.lon) * Math.sin(eps);
  const proj = pos.x * sx + pos.y * sy + pos.z * sz;
  if (proj > 0) return true;
  const quer = Math.sqrt(Math.max(0, pos.x * pos.x + pos.y * pos.y + pos.z * pos.z - proj * proj));
  return quer > 6371;
}

// ---------- Zusammen ----------
export async function heute({ ort = "" } = {}) {
  let o, ortHinweis = "";
  try { o = await ortZuKoordinaten(ort || config.city); }
  catch (err) { o = { name: "Deutschland (Mitte)", lat: 51.16, lon: 10.45 }; ortHinweis = `Ort nicht gefunden (${err.message}), gerechnet für die Mitte Deutschlands.`; }
  const jetzt = Date.now();
  const z = sonnenZeiten(jetzt, o.lat, o.lon);
  let iss = [], issFehler = "";
  try { iss = (await issUeberfluege(o.lat, o.lon)).filter((p) => p.sichtbar).slice(0, 6); } catch (err) { issFehler = `ISS-Bahndaten gerade nicht erreichbar (${err.message})`; }
  const iso = (t) => (t ? new Date(t).toISOString() : null);
  return {
    ort: o.name, lat: o.lat, lon: o.lon, stand: new Date(jetzt).toISOString(),
    sonne: { aufgang: iso(z.aufgang), untergang: iso(z.untergang), dunkel: iso(z.dunkel) },
    mond: mond(jetzt),
    planeten: planeten(jetzt, o.lat, o.lon),
    sternschnuppen: sternschnuppen(jetzt),
    iss, issFehler, ortHinweis,
  };
}

export function satz(d) {
  const teile = [];
  teile.push(`Der Mond ist heute ${d.mond.name}, zu ${d.mond.beleuchtet} Prozent beleuchtet.`);
  if (d.sonne.untergang) teile.push(`Die Sonne geht um ${uhrzeit(d.sonne.untergang)} Uhr unter${d.sonne.dunkel ? `, richtig dunkel ist es ab ${uhrzeit(d.sonne.dunkel)} Uhr` : ""}.`);
  const sicht = d.planeten.filter((p) => p.sichtbar);
  if (sicht.length) teile.push(`Gut zu sehen: ${sicht.map((p) => `${p.name} ${p.wann} im ${p.richtung}`).join(", ")}.`);
  else teile.push("Planeten stehen heute ungünstig.");
  const iss = d.iss[0];
  if (iss) teile.push(`Die ISS fliegt ${datumLang(iss.start) === datumLang(new Date().toISOString()) ? "heute" : `am ${datumLang(iss.start)}`} um ${uhrzeit(iss.start)} Uhr von ${iss.von} nach ${iss.nach} über dich, bis zu ${iss.maxHoehe} Grad hoch.`);
  const sch = d.sternschnuppen.find((s) => s.inTagen <= 14);
  if (sch) teile.push(`${sch.inTagen <= 0 ? "Gerade" : `In ${sch.inTagen} Tagen`} sind die ${sch.name}, bis zu ${sch.proStunde} Sternschnuppen pro Stunde${sch.mondStoert ? ", leider stört der helle Mond" : ""}.`);
  return teile.join(" ");
}

const FRAGE = U(/\b(was ist (heute |gerade |heute abend )?am himmel|was (kann|sieht) man (heute )?am himmel|sternenhimmel|himmel heute|welche planeten|planeten (heute|sichtbar|sehen)|wann (fliegt|kommt) die iss|iss (überflug|ueberflug|sehen)|mondphase|welcher mond|ist (heute )?vollmond|wann ist (der nächste |der naechste )?(vollmond|neumond)|sternschnuppen?)\b/);
export async function quickCommand(text) {
  const { k } = sauber(text);
  if (!FRAGE.test(k)) return null;
  // "wo ist die ISS" bleibt beim Live-Globus (offline.js), hier geht es um Überflüge.
  try {
    const d = await heute();
    let answer;
    if (/vollmond|neumond|mondphase|welcher mond/.test(k)) answer = `${d.mond.zeichen} Heute ist ${d.mond.name}, ${d.mond.beleuchtet} Prozent beleuchtet. Nächster Vollmond: ${datumLang(d.mond.vollmond)}. Nächster Neumond: ${datumLang(d.mond.neumond)}.`;
    else if (/\biss\b/.test(k)) answer = d.iss.length ? `Die nächsten sichtbaren ISS-Überflüge: ${d.iss.slice(0, 3).map((p) => `${datumLang(p.start)} um ${uhrzeit(p.start)} Uhr, ${p.minuten} Minuten, von ${p.von} nach ${p.nach}`).join("; ")}.` : (d.issFehler || "In den nächsten drei Tagen fliegt die ISS nicht sichtbar über dich.");
    else if (/sternschnupp/.test(k)) answer = d.sternschnuppen.length ? d.sternschnuppen.slice(0, 2).map((s) => `${s.name}: ${datumLang(s.datum)}, bis zu ${s.proStunde} pro Stunde, ${s.tipp}${s.mondStoert ? " (der Mond ist dann hell)" : ""}.`).join(" ") : "In den nächsten Wochen gibt es keinen großen Sternschnuppen-Strom.";
    else if (/planet/.test(k)) { const s = d.planeten.filter((p) => p.sichtbar); answer = s.length ? `Heute gut zu sehen: ${s.map((p) => `${p.name} ${p.wann}, ${p.hoehe} Grad hoch im ${p.richtung}`).join(", ")}.` : "Heute steht kein Planet günstig."; }
    else answer = satz(d);
    return { answer, actions: ["wunsch:himmel"] };
  } catch (err) {
    return { answer: `Den Himmel kann ich gerade nicht berechnen (${err.message}).`, actions: ["wunsch:himmel"] };
  }
}
