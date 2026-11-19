// Routen & Verbindungen (v1.103.0): "Friday, wie lange brauche ich nach Hamburg?"
// Rechnet Fahrzeit mit Auto, Fahrrad und zu Fuß und sucht Bahn- und Bus-Verbindungen mit Abfahrtszeiten.
// Läuft komplett OHNE Claude und ohne Schlüssel, klappt also auch bei leerem Guthaben:
// - Adressen finden: Photon (komoot) und Nominatim (OpenStreetMap)
// - Auto/Fahrrad/zu Fuß: OSRM-Server von FOSSGIS (routing.openstreetmap.de), Ersatz: router.project-osrm.org
// - Bahn & Bus: Transitous (api.transitous.org, freie Fahrplandaten inkl. Deutschland/DELFI, mit Echtzeit wo vorhanden)
import { config } from "./config.js";
import * as store from "./store.js";
import { findeTag, findeUhrzeit, ortszeit, teile, U } from "./datum.js";

const UA = "F.R.Ai.D.A.Y-Assistent/1.103 (privater Sprachassistent)";

async function holeJson(url, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de" }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// ---------- Gespeicherte Orte (Zuhause, Arbeit) ----------
const ORTE_DATEI = "routen";
export function getOrte() {
  const d = store.load(ORTE_DATEI, {});
  return { heim: d.heim || null, arbeit: d.arbeit || null };
}
export async function setzeOrt(art, text) {
  if (!["heim", "arbeit"].includes(art)) throw new Error("Unbekannter Ort");
  const d = store.load(ORTE_DATEI, {});
  const roh = String(text || "").trim().slice(0, 160);
  if (!roh) { d[art] = null; store.save(ORTE_DATEI, d); return null; }
  const o = await finde(roh);
  if (!o) throw new Error(`„${roh}“ habe ich auf der Karte nicht gefunden.`);
  d[art] = { text: roh, name: o.name, label: o.label, lat: o.lat, lon: o.lon };
  store.save(ORTE_DATEI, d);
  return d[art];
}

// ---------- Adressen finden ----------
const geoCache = new Map();
function photonLabel(p) {
  const strasse = [p.street, p.housenumber].filter(Boolean).join(" ");
  const ort = [p.postcode, p.city || p.town || p.village || p.county].filter(Boolean).join(" ");
  const teile_ = [p.name && p.name !== p.street ? p.name : "", strasse, ort, p.countrycode && p.countrycode !== "DE" ? p.country : ""];
  return [...new Set(teile_.filter(Boolean))].join(", ");
}

/** Text → { name, label, lat, lon }. bias = {lat, lon} bevorzugt Treffer in der Nähe (z. B. "Bahnhof"). */
export async function finde(text, bias = null) {
  const q = String(text || "").trim();
  if (!q) return null;
  const koord = q.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (koord) return { name: "Standort", label: `${(+koord[1]).toFixed(4)}, ${(+koord[2]).toFixed(4)}`, lat: +koord[1], lon: +koord[2] };
  const key = `${q.toLowerCase()}|${bias ? `${bias.lat.toFixed(2)},${bias.lon.toFixed(2)}` : ""}`;
  const hit = geoCache.get(key);
  if (hit && Date.now() - hit.at < 24 * 3600 * 1000) return hit.ort;
  let ort = null;
  try {
    const b = bias ? `&lat=${bias.lat}&lon=${bias.lon}&location_bias_scale=0.4` : "";
    const j = await holeJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=de${b}`, 8000);
    const f = j.features?.[0];
    if (f) {
      const p = f.properties || {};
      ort = { name: p.name || p.street || q, label: photonLabel(p) || q, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
    }
  } catch { /* Ersatz unten */ }
  if (!ort) {
    try {
      const v = bias ? `&viewbox=${bias.lon - 0.6},${bias.lat + 0.4},${bias.lon + 0.6},${bias.lat - 0.4}` : "";
      const j = await holeJson(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&accept-language=de${v}`, 8000);
      const n = j[0];
      if (n) ort = { name: n.name || q, label: String(n.display_name || q).split(", ").slice(0, 4).join(", "), lat: +n.lat, lon: +n.lon };
    } catch { /* nichts gefunden */ }
  }
  if (ort) geoCache.set(key, { at: Date.now(), ort });
  return ort;
}

// ---------- Hilfen ----------
export function luftlinie(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Google-Polyline mit wählbarer Genauigkeit (Transitous: 6 Stellen) → [[lat, lon], …]
export function polylineDecode(str, precision = 6) {
  const f = 10 ** precision, out = [];
  let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && i < str.length);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d; else lon += d;
    }
    out.push([lat / f, lon / f]);
  }
  return out;
}

// Linie ausdünnen, damit das Dashboard nicht tausende Punkte bekommt
function duenn(punkte, max = 400) {
  if (punkte.length <= max) return punkte.map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)]);
  const step = punkte.length / max, out = [];
  for (let i = 0; i < max; i++) out.push(punkte[Math.floor(i * step)]);
  out.push(punkte[punkte.length - 1]);
  return out.map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)]);
}

export function dauerText(sek) {
  const min = Math.max(1, Math.round(sek / 60));
  if (min < 60) return `${min} ${min === 1 ? "Minute" : "Minuten"}`;
  const h = Math.floor(min / 60), m = min % 60;
  const hs = h === 1 ? "1 Stunde" : `${h} Stunden`;
  if (h >= 10) return m >= 30 ? `${h + 1} Stunden` : hs;
  return m ? `${hs} ${m}` : hs;
}
export function kmText(m) {
  if (m < 1000) return `${Math.round(m / 10) * 10} Meter`;
  const km = m / 1000;
  return `${km < 10 ? km.toLocaleString("de-DE", { maximumFractionDigits: 1 }) : Math.round(km).toLocaleString("de-DE")} Kilometer`;
}
const uhr = (iso) => {
  const p = teile(new Date(iso).getTime());
  return `${p.h}:${String(p.mi).padStart(2, "0")}`;
};

// ---------- Straße: Auto, Fahrrad, zu Fuß ----------
const PROFILE = {
  auto: ["https://routing.openstreetmap.de/routed-car/route/v1/driving", "https://router.project-osrm.org/route/v1/driving"],
  rad: ["https://routing.openstreetmap.de/routed-bike/route/v1/driving"],
  fuss: ["https://routing.openstreetmap.de/routed-foot/route/v1/driving"],
};
async function strasse(art, von, nach) {
  for (const basis of PROFILE[art]) {
    try {
      const j = await holeJson(`${basis}/${von.lon},${von.lat};${nach.lon},${nach.lat}?overview=simplified&geometries=geojson&alternatives=false`, 14000);
      const r = j.routes?.[0];
      if (j.code === "Ok" && r) {
        return { art, dauer: Math.round(r.duration), distanz: Math.round(r.distance), linie: duenn((r.geometry?.coordinates || []).map(([lo, la]) => [la, lo])) };
      }
    } catch { /* nächster Server */ }
  }
  return { art, fehler: "nicht erreichbar" };
}

// ---------- Bahn & Bus (Transitous) ----------
const MODUS = {
  WALK: ["zu Fuß", "🚶"], BIKE: ["Fahrrad", "🚲"], CAR: ["Auto", "🚗"],
  BUS: ["Bus", "🚌"], COACH: ["Fernbus", "🚌"], TRAM: ["Tram", "🚋"], SUBWAY: ["U-Bahn", "🚇"],
  SUBURBAN: ["S-Bahn", "🚆"], REGIONAL_RAIL: ["Regionalbahn", "🚆"], REGIONAL_FAST_RAIL: ["Regionalexpress", "🚆"],
  RAIL: ["Zug", "🚆"], LONG_DISTANCE: ["Fernzug", "🚄"], HIGHSPEED_RAIL: ["ICE", "🚄"], NIGHT_RAIL: ["Nachtzug", "🚆"],
  FERRY: ["Fähre", "⛴️"], AIRPLANE: ["Flug", "✈️"], ODM: ["Rufbus", "🚐"], FUNICULAR: ["Bergbahn", "🚠"], AERIAL_LIFT: ["Seilbahn", "🚠"],
  OTHER: ["Verkehrsmittel", "🚏"], TRANSIT: ["ÖPNV", "🚏"],
};
const verspaetung = (ist, plan) => (ist && plan ? Math.round((new Date(ist) - new Date(plan)) / 60000) : 0);
const haltName = (s) => (s === "START" ? "Start" : s === "END" ? "Ziel" : s);

function abschnitt(l) {
  const [modusName, icon] = MODUS[l.mode] || MODUS.OTHER;
  const fuss = l.mode === "WALK";
  let punkte = [];
  try { if (l.legGeometry?.points) punkte = duenn(polylineDecode(l.legGeometry.points, l.legGeometry.precision ?? 6), 150); } catch { /* ohne Linie */ }
  return {
    modus: l.mode, modusName, icon, fuss,
    linie: fuss ? "" : (l.displayName || l.tripShortName || l.routeShortName || modusName),
    richtung: l.headsign || "",
    betreiber: l.agencyName || "",
    farbe: /^[0-9a-f]{6}$/i.test(l.routeColor || "") && !/^0{6}$/.test(l.routeColor) ? `#${l.routeColor}` : "",
    von: haltName(l.from?.name), nach: haltName(l.to?.name),
    ab: l.startTime, an: l.endTime,
    abPlan: l.scheduledStartTime, anPlan: l.scheduledEndTime,
    verspaetungAb: verspaetung(l.startTime, l.scheduledStartTime),
    verspaetungAn: verspaetung(l.endTime, l.scheduledEndTime),
    gleisAb: l.from?.track || "", gleisAn: l.to?.track || "",
    echtzeit: Boolean(l.realTime),
    ausfall: Boolean(l.cancelled),
    reservierung: l.reservation === "COMPULSORY",
    dauer: l.duration, distanz: l.distance ? Math.round(l.distance) : null,
    halte: (l.intermediateStops || []).length,
    punkte,
  };
}

async function oepnv(von, nach, zeit, ankunft = false) {
  const p = new URLSearchParams({ fromPlace: `${von.lat},${von.lon}`, toPlace: `${nach.lat},${nach.lon}`, numItineraries: "5" });
  if (zeit) p.set("time", new Date(zeit).toISOString());
  if (ankunft) p.set("arriveBy", "true");
  try {
    const j = await holeJson(`https://api.transitous.org/api/v5/plan?${p}`, 20000);
    const its = (j.itineraries || []).map((it) => {
      const legs = (it.legs || []).map(abschnitt);
      const fahrt = legs.filter((l) => !l.fuss);
      const erste = fahrt[0];
      return {
        ab: it.startTime, an: it.endTime, dauer: it.duration, umstiege: it.transfers ?? Math.max(0, fahrt.length - 1),
        erste: erste ? { linie: erste.linie, modusName: erste.modusName, von: erste.von, ab: erste.ab, gleis: erste.gleisAb, verspaetung: erste.verspaetungAb } : null,
        ausfall: legs.some((l) => l.ausfall),
        nurFuss: fahrt.length === 0,
        abschnitte: legs,
      };
    }).filter((it) => !it.nurFuss);
    return { art: "oepnv", verbindungen: its, quelle: "Transitous" };
  } catch (err) {
    return { art: "oepnv", verbindungen: [], fehler: err.name === "AbortError" ? "Zeitüberschreitung" : "nicht erreichbar" };
  }
}

// ---------- Planen ----------
const ergebnisse = new Map(); // id -> Ergebnis (für das Fenster)
let zaehler = 0;
export const holeErgebnis = (id) => ergebnisse.get(String(id)) || null;
export const letzteRouteId = () => [...ergebnisse.keys()].pop() || "";

async function startOrt({ vonText, standort }) {
  const orte = getOrte();
  if (vonText) {
    const t = vonText.toLowerCase();
    if (/^(zu ?hause|daheim|home|heim)$/.test(t) && orte.heim) return { ...orte.heim, art: "heim", name: "Zuhause" };
    if (/^(der |meiner )?arbeit$/.test(t) && orte.arbeit) return { ...orte.arbeit, art: "arbeit", name: "Arbeit" };
    if (/^(hier|meinem standort|mein standort|standort)$/.test(t) && standort) return { name: "Dein Standort", label: "Aktueller Standort", lat: standort.lat, lon: standort.lon, art: "standort" };
    const o = await finde(vonText, standort || orte.heim);
    if (o) return { ...o, art: "adresse" };
    throw new Error(`Den Startort „${vonText}“ habe ich nicht gefunden.`);
  }
  if (standort && Number.isFinite(standort.lat) && Number.isFinite(standort.lon)) {
    return { name: "Dein Standort", label: "Aktueller Standort", lat: standort.lat, lon: standort.lon, art: "standort" };
  }
  if (orte.heim) return { ...orte.heim, art: "heim", name: "Zuhause" };
  const stadt = await finde(config.city);
  if (stadt) return { ...stadt, art: "stadt", name: config.city, hinweis: "Startort ist deine Heimatstadt. Trag im Routen-Fenster deine Adresse ein, dann rechne ich genau ab Haustür." };
  throw new Error("Ich weiß nicht, wo du losfährst. Trag im Routen-Fenster deine Adresse ein.");
}

async function zielOrt(nachText, start) {
  const orte = getOrte();
  const t = nachText.toLowerCase();
  if (/^(hause|zu ?hause|daheim|heim)$/.test(t)) {
    if (orte.heim) return { ...orte.heim, art: "heim", name: "Zuhause" };
    throw new Error("Deine Heimadresse kenne ich noch nicht. Trag sie im Routen-Fenster ein.");
  }
  if (/^(der |meiner |die )?arbeit$/.test(t)) {
    if (orte.arbeit) return { ...orte.arbeit, art: "arbeit", name: "Arbeit" };
    throw new Error("Deine Arbeitsadresse kenne ich noch nicht. Trag sie im Routen-Fenster unter Orte ein.");
  }
  const o = await finde(nachText, start);
  if (!o) throw new Error(`„${nachText}“ habe ich auf der Karte nicht gefunden.`);
  return { ...o, art: "adresse" };
}

/**
 * Plant alles auf einmal.
 * @param {{nach:string, von?:string, standort?:{lat,lon}, zeit?:string|Date, ankunft?:boolean, modus?:string}} w
 */
export async function plane(w) {
  if (!w?.nach) throw new Error("Wohin soll es gehen?");
  const von = await startOrt({ vonText: w.von, standort: w.standort });
  const nach = await zielOrt(w.nach, von);
  const luft = luftlinie(von, nach);
  if (luft < 30) throw new Error("Start und Ziel sind fast derselbe Ort.");
  const zeit = w.zeit ? new Date(w.zeit) : null;
  const jobs = [
    strasse("auto", von, nach),
    luft <= 300000 ? strasse("rad", von, nach) : Promise.resolve({ art: "rad", zuWeit: true }),
    luft <= 40000 ? strasse("fuss", von, nach) : Promise.resolve({ art: "fuss", zuWeit: true }),
    luft >= 400 ? oepnv(von, nach, zeit, w.ankunft) : Promise.resolve({ art: "oepnv", verbindungen: [], zuNah: true }),
  ];
  const [auto, rad, fuss, bahn] = await Promise.all(jobs);
  const id = String(++zaehler);
  const e = {
    id, erstellt: new Date().toISOString(),
    von: { name: von.name, label: von.label, lat: von.lat, lon: von.lon, art: von.art },
    nach: { name: nach.name, label: nach.label, lat: nach.lat, lon: nach.lon, art: nach.art },
    hinweis: von.hinweis || "",
    zeit: zeit ? zeit.toISOString() : null, ankunft: Boolean(w.ankunft),
    modus: w.modus || "",
    luftlinie: Math.round(luft),
    auto, rad, fuss, oepnv: bahn,
  };
  e.sprechText = sprechText(e);
  ergebnisse.set(id, e);
  if (ergebnisse.size > 30) ergebnisse.delete(ergebnisse.keys().next().value);
  return e;
}

// ---------- Vorlesen ----------
// Haltestellen so, wie man sie spricht: "S+U Alexanderplatz Bhf (Berlin)" → "Alexanderplatz Bahnhof"
export function haltSprech(n) {
  return String(n || "").replace(/\s*\([^)]*\)/g, "").replace(/^(S\+U|S|U)\s+(?=\S)/, "")
    .replace(/\bHbf\b/g, "Hauptbahnhof").replace(/\bBhf\b/g, "Bahnhof").replace(/\bStr\b\.?/g, "Straße").trim();
}
function inMinuten(iso) {
  const min = Math.round((new Date(iso) - Date.now()) / 60000);
  if (min <= 0) return " – jetzt gleich";
  if (min === 1) return ", in einer Minute";
  return min < 60 ? `, in ${min} Minuten` : "";
}

function verbindungSatz(v, mitAlternative) {
  const fahrt = v.abschnitte.filter((a) => !a.fuss);
  const linien = [...new Set(fahrt.map((a) => a.linie))].slice(0, 3);
  const umst = v.umstiege === 0 ? "ohne Umsteigen" : v.umstiege === 1 ? "einmal umsteigen" : `${v.umstiege}-mal umsteigen`;
  const erste = v.erste;
  const hinweg = v.abschnitte[0]?.fuss ? v.abschnitte[0] : null;
  let s = "";
  if (hinweg && hinweg.dauer >= 180) s += `Losgehen um ${uhr(v.ab)} Uhr${inMinuten(v.ab)}. `;
  s += `Abfahrt um ${uhr(erste?.ab || v.ab)} Uhr${hinweg && hinweg.dauer >= 180 ? "" : inMinuten(erste?.ab || v.ab)}`;
  if (erste?.von && erste.von !== "Start") s += ` ab ${haltSprech(erste.von)}`;
  const gleis = String(erste?.gleis || "").replace(/\s*\([^)]*\)/g, "").trim();
  if (gleis) s += `, ${/^\d/.test(gleis) ? "Gleis " : ""}${gleis}`;
  s += ` mit ${linien.join(", dann ")}. Ankunft ${uhr(v.an)} Uhr, ${umst}, Dauer ${dauerText(v.dauer)}.`;
  if (erste?.verspaetung >= 3) s += ` Achtung, ${erste.verspaetung} Minuten Verspätung.`;
  if (v.ausfall) s += " Achtung, ein Teil fällt aus.";
  if (mitAlternative) s += ` Danach geht's um ${uhr(mitAlternative.erste?.ab || mitAlternative.ab)} Uhr.`;
  return s;
}

export function sprechText(e) {
  const ziel = e.nach.art === "heim" ? "Nach Hause" : `Nach ${haltSprech(e.nach.name)}`;
  const teile_ = [];
  const s = (r) => r && !r.fehler && !r.zuWeit && r.dauer;
  const vs = (e.oepnv.verbindungen || []).filter((v) => !v.ausfall);
  const v0 = vs[0] || e.oepnv.verbindungen?.[0];
  const m = e.modus;
  if (m === "oepnv") {
    if (v0) teile_.push(`${ziel} mit Bahn und Bus: ${verbindungSatz(v0, vs[1])}`);
    else teile_.push(`${ziel} habe ich gerade keine Bahn- oder Busverbindung gefunden.`);
    if (s(e.auto)) teile_.push(`Mit dem Auto wären es etwa ${dauerText(e.auto.dauer)}.`);
  } else if (m === "rad" || m === "fuss") {
    const r = e[m], wie = m === "rad" ? "mit dem Fahrrad" : "zu Fuß";
    if (s(r)) teile_.push(`${ziel} brauchst du ${wie} etwa ${dauerText(r.dauer)}, das sind ${kmText(r.distanz)}.`);
    else if (r?.zuWeit) teile_.push(`${ziel} ist es ${wie} zu weit, Luftlinie ${kmText(e.luftlinie)}.`);
    else teile_.push(`Die Strecke ${wie} konnte ich gerade nicht berechnen.`);
    if (s(e.auto)) teile_.push(`Mit dem Auto etwa ${dauerText(e.auto.dauer)}.`);
  } else {
    if (s(e.auto)) teile_.push(`${ziel} brauchst du mit dem Auto etwa ${dauerText(e.auto.dauer)} für ${kmText(e.auto.distanz)}.`);
    else teile_.push(`${ziel} sind es Luftlinie ${kmText(e.luftlinie)}.`);
    if (v0) teile_.push(`Mit Bahn und Bus: ${verbindungSatz(v0)}`);
    if (s(e.rad) && e.rad.dauer < 3 * 3600) teile_.push(`Mit dem Fahrrad ${dauerText(e.rad.dauer)}.`);
    if (s(e.fuss) && e.fuss.dauer < 90 * 60) teile_.push(`Zu Fuß ${dauerText(e.fuss.dauer)}.`);
  }
  if (e.hinweis) teile_.push("Ich rechne ab deiner Heimatstadt, die genaue Adresse kannst du im Routen-Fenster eintragen.");
  return teile_.join(" ").replace(/\s+/g, " ").trim();
}

// ---------- Sprache verstehen ----------
function vorbereiten(text) {
  let t = String(text || "").toLowerCase()
    .replace(/[„“”"!?¿¡;]/g, " ")
    .replace(/(\D)[.,:](\D|$)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  t = t.replace(/^(hey |hallo |hi |ok |okay )?(friday|freitag|fraiday)( |$)/, "").trim();
  t = t.replace(/^(bitte |sag mal |sag mir |kannst du (mir )?(bitte )?(sagen |ausrechnen |berechnen |zeigen )?|zeig mir |rechne (mir )?(mal )?(aus )?)/, "").trim();
  return t;
}

const MODUS_WORT = [
  ["oepnv", /\b(mit )?(den |der |dem |die )?(öffis|oeffis|öffentlichen( verkehrsmitteln)?|oeffentlichen|öpnv|oepnv|bahn|zug|s-bahn|s bahn|u-bahn|u bahn|ubahn|sbahn|bus|tram|straßenbahn|strassenbahn|regionalbahn|ice|fernbus|nahverkehr)\b/],
  ["rad", /\b(mit )?(dem |meinem )?(fahrrad|rad|bike|e-bike|ebike)\b|\bradeln\b|\bradfahren\b/],
  ["fuss", /\b(zu fuß|zu fuss|zufuß|laufen|gehen|spazieren|fußweg|fussweg)\b/],
  ["auto", /\b(mit )?(dem |meinem )?(auto|wagen|pkw|karre)\b|\bfahren mit dem auto\b/],
];

/** Erkennt einen Routen-Wunsch. → { nach, von?, modus?, zeit?, ankunft? } oder null */
export function erkenneRoute(text) {
  const t0 = vorbereiten(text);
  if (!t0 || t0.length > 140) return null;
  const AUSLOESER = U(/^(wie lange (brauche|brauch|bräuchte|braucht|fahre|fahr|dauert|geht)|wie lang (brauche|brauch|dauert)|wie komme ich|wie komm ich|wie kommen wir|wie weit ist es|wie weit ist|wie weit (bis|nach|zu|zum|zur)|wie viele kilometer|wieviele kilometer|wie viel kilometer|wann (fährt|faehrt|geht|kommt) (der|die|das|mein|meine)? ?(nächste|naechste)?|nächste (verbindung|bahn|zug|bus|s-bahn|u-bahn)|naechste (verbindung|bahn|zug|bus)|(eine |die |den )?(route|weg|strecke|verbindung|verbindungen|zugverbindung|zugverbindungen|busverbindung|bahnverbindung|fahrzeit|fahrtzeit|anfahrt|fahrplan)( berechnen| planen)? (nach|zu|zum|zur|bis|von|ins|in die|in den|an)|(berechne|plane|plan|such|suche|finde|zeig)( mir)? (die |eine |den )?(route|weg|verbindung|verbindungen|strecke|zugverbindung|fahrzeit)|navigier(e)?( mich)? (nach|zu|zum|zur)|bring mich (nach|zu|zum|zur))/);
  if (!AUSLOESER.test(t0)) return null;

  let t = t0;
  let modus = "";
  for (const [m, re] of MODUS_WORT) if (U(re).test(t)) { modus = m; break; }

  // Zeit: "morgen um 8", "um 17 uhr", "heute abend"; "ankunft um 9" / "bis 9 uhr da sein" = ankommen
  let zeit = null, ankunft = false;
  const tag = findeTag(t), u = findeUhrzeit(t);
  if (u || tag) {
    const tg = tag?.tag || (() => { const h = teile(); return { y: h.y, m: h.m, d: h.d }; })();
    const h = u ? u.h : 8, mi = u ? u.mi : 0;
    let z = ortszeit(tg.y, tg.m, tg.d, h, mi);
    if (!tag && u && z.getTime() < Date.now() - 5 * 60000) z = new Date(z.getTime() + 86400000); // "um 7" ist schon vorbei → morgen
    if (tag?.plus > 0 || u) zeit = z;
    ankunft = U(/\b(ankunft|ankommen|da sein|dort sein|ankomme|spätestens|spaetestens)\b/).test(t);
    if (u) t = t.replace(u.match, " ");
    if (tag) t = t.replace(tag.match, " ");
  }

  // Füllwörter und Verkehrsmittel aus dem Satz nehmen
  const putzen = (s) => {
    let x = " " + s + " ";
    for (const [, re] of MODUS_WORT) x = x.replace(new RegExp(U(re).source, "gu"), " ");
    x = x.replace(U(/\b(am besten|am schnellsten|eigentlich|ungefähr|ungefaehr|ca|etwa|denn|noch|mal|bitte|jetzt|gerade|sofort|heute|von hier( aus)?|von zu ?hause( aus)?|aus|da sein|dort sein|ankommen|ankunft|spätestens|spaetestens|abends|morgens|früh|frueh|fahren|gehen|kommen|laufen|brauche|brauch|bräuchte|dauert|es|ich|wir|man|lange|mit|hin|dahin|dorthin|hin und zurück|in etwa)\b/g), " ");
    return x.replace(/\s+/g, " ").trim();
  };

  // Verkehrsmittel und Nebensätze ("wenn ich … ankommen will") vor dem Zerlegen entfernen,
  // sonst wird aus "zu Fuß zum Alexanderplatz" das Ziel "Fuß zum Alexanderplatz".
  for (const [, re] of MODUS_WORT) t = t.replace(new RegExp(U(re).source, "gu"), " ");
  t = t.replace(U(/\b(wenn|damit|weil|sodass|so dass|und dann|und zwar)\b.*$/), " ").replace(/\s+/g, " ").trim();

  // "von A nach B"
  let von = "", nach = "";
  const vn = t.match(U(/\bvon (.+?) (?:nach|zu|zum|zur|bis|ins|in die|in den|an den|an die) (.+)$/));
  const nv = t.match(U(/\b(?:nach|zu|zum|zur|bis|ins|in die|in den) (.+?) von (.+)$/));
  if (vn) { von = vn[1]; nach = vn[2]; } else if (nv) { nach = nv[1]; von = nv[2]; } else {
    const m = t.match(U(/\b(?:nach|zum|zur|zu|bis zum|bis zur|bis nach|bis|ins|in die|in den|an den|an die|an das)\s+(.+)$/));
    if (m) nach = m[1];
  }
  // Artikel vorne, "hause" bleibt
  nach = putzen(nach).replace(U(/^(dem|der|den|die|das|nach|zu)\s+/), "").replace(U(/\s+(nach|zu|zum|zur|an|hin)$/), "").trim();
  von = putzen(von).replace(U(/^(dem|der|den|die|das)\s+/), "").trim();
  if (/^(meiner |der )?arbeit$/.test(nach)) nach = "arbeit";
  if (!nach || nach.length < 2 || nach.length > 80) return null;
  if (U(/^(der timer|weihnachten|ostern|silvester|zum wochenende|wochenende|feierabend|zum urlaub)$/).test(nach)) return null;
  return { nach, ...(von ? { von } : {}), ...(modus ? { modus } : {}), ...(zeit ? { zeit: zeit.toISOString() } : {}), ...(ankunft ? { ankunft } : {}) };
}

const OEFFNEN = U(/^(öffne|oeffne|zeig|zeige|starte|start)( mir)?( das| den| die)? (routen|routenplaner|routen-werkzeug|routenwerkzeug|routen werkzeug|navigation|navi|verbindungen|fahrplan|fahrplanauskunft)( fenster| werkzeug)?$/);

/** Schnellbefehl für brain.js */
export async function quickCommand(text, opts = {}) {
  const t = vorbereiten(text);
  if (OEFFNEN.test(t)) return { answer: "Routen und Verbindungen sind offen. Wohin soll's gehen?", actions: ["routen"] };
  const w = erkenneRoute(text);
  if (!w) return null;
  try {
    const e = await plane({ ...w, standort: opts.standort });
    return { answer: e.sprechText, actions: ["routen", `route:${e.id}`] };
  } catch (err) {
    return { answer: err.message, actions: ["routen", `route_ziel:${encodeURIComponent(w.nach)}`] };
  }
}

// Für Claude (Werkzeug "route_planen")
export async function routeFuerClaude(input = {}) {
  const e = await plane({ nach: input.nach, von: input.von, modus: input.modus, zeit: input.zeit, ankunft: input.ankunft });
  const kurz = (r) => (r?.dauer ? { dauer: dauerText(r.dauer), strecke: kmText(r.distanz) } : r?.zuWeit ? "zu weit" : "nicht verfügbar");
  return {
    von: e.von.label, nach: e.nach.label,
    auto: kurz(e.auto), fahrrad: kurz(e.rad), zu_fuss: kurz(e.fuss),
    bahn_und_bus: (e.oepnv.verbindungen || []).slice(0, 3).map((v) => ({
      ab: uhr(v.ab), an: uhr(v.an), dauer: dauerText(v.dauer), umstiege: v.umstiege,
      linien: v.abschnitte.filter((a) => !a.fuss).map((a) => `${a.linie}${a.richtung ? ` → ${a.richtung}` : ""} (${a.von} ${uhr(a.ab)}${a.gleisAb ? `, Gleis ${a.gleisAb}` : ""})`),
    })),
    hinweis: "Das Dashboard zeigt die Route jetzt im Fenster Routen & Verbindungen.",
    _route_id: e.id,
  };
}
