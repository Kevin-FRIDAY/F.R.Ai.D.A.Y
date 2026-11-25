// Flugzeuge weltweit für das Weltgeschehen (ab v1.115.0).
// Quellen (frei):
//   OpenSky Network /states/all – ALLE Flugzeuge weltweit (ca. 10.000–14.000). Ohne Konto ca. 100 Abrufe/Tag
//     -> Friday holt ohne Konto alle 15 Min., mit kostenlosem OpenSky-API-Client (OPENSKY_CLIENT_ID/SECRET) alle 2 Min.
//     Dazwischen rechnet das Dashboard die Flugzeuge mit Tempo + Kurs weiter (wirkt live).
//   adsb.lol – genaue Live-Daten im Umkreis (250 sm), wenn man nah heranzoomt oder ein Flugzeug antippt.
//   adsbdb.com – Steckbrief: Typ, Hersteller, Kennzeichen, Halter, Foto, Strecke (von/nach), Airline.
// Ab v1.173.0 noch mehr adsb.lol (frei, ohne Schlüssel, Daten unter ODbL-Lizenz):
//   - Live-Schicht alle 60 Sek.: Militärflüge weltweit (/v2/mil) + alle Notfall-Codes 7700/7600/7500 (/v2/sqk)
//   - Ersatz-Weltkarte, wenn OpenSky ausfällt oder das Tageskontingent leer ist: ~45 Regionen à 250 sm (/v2/point)
//   - Flugsuche live über Rufzeichen (/v2/callsign), Strecke (von → nach) über /api/0/routeset als Ersatz für adsbdb
//   - „Was fliegt über mir?“ – nächstes Flugzeug über dem Wohnort (/v2/closest)
// Datenschutz: Flugzeuge mit Sperrwunsch (LADD/PIA) zeigen weder Kennzeichen noch Halter. Halter nur bei Airlines/Militär,
// nie bei Privatfliegern (das wären oft Privatpersonen).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DATA_DIR, config } from "./config.js";

const UA = { "User-Agent": "F.R.Ai.D.A.Y/1.0 (privater Assistent)" };
const CACHE = path.join(DATA_DIR, "flugzeuge-cache.json");
const INFO_DATEI = path.join(DATA_DIR, "flugzeuge-steckbriefe.json");
const env = (k) => (process.env[k] || "").trim();

export const FLUG_GRUPPEN = [
  { id: "linie", name: "Linien- & Frachtflüge", info: "Flüge von Fluggesellschaften (Rufzeichen wie DLH400 = Lufthansa 400)." },
  { id: "privat", name: "Privat & Geschäftsflieger", info: "Kleinflugzeuge, Privatjets, Segelflieger und alles ohne Airline-Rufzeichen." },
  { id: "heli", name: "Hubschrauber", info: "Hubschrauber, die ihren Typ senden." },
  { id: "boden", name: "Am Boden", info: "Flugzeuge, die gerade am Flughafen rollen oder stehen." },
  { id: "notfall", name: "Notfall-Code", info: "Squawk 7700 (Notfall), 7600 (Funkausfall) oder 7500 (Entführung)." },
  { id: "militaer", name: "Militär & Staat", info: "Militär- und Regierungsflugzeuge, die öffentlich ihr ADS-B-Signal senden (Quelle: adsb.lol). Viele senden nicht." },
];
const GNR = Object.fromEntries(FLUG_GRUPPEN.map((g, i) => [g.id, i]));

const NOTFALL_CODES = ["7700", "7600", "7500"];
function gruppe(cs, kategorie, amBoden, squawk, militaer = false) {
  if (NOTFALL_CODES.includes(squawk)) return "notfall";
  if (amBoden) return "boden";
  if (militaer) return "militaer";
  if (kategorie === 8 || kategorie === "A7") return "heli";
  if (/^[A-Z]{3}\d/.test(cs || "")) return "linie";
  return "privat";
}

const LAENDER = {
  "United States": "USA", Germany: "Deutschland", "United Kingdom": "Großbritannien", France: "Frankreich", Spain: "Spanien",
  Italy: "Italien", Netherlands: "Niederlande", "Kingdom of the Netherlands": "Niederlande", Switzerland: "Schweiz", Austria: "Österreich",
  Ireland: "Irland", Turkey: "Türkei", "Türkiye": "Türkei", "United Arab Emirates": "Vereinigte Arabische Emirate", Qatar: "Katar",
  China: "China", Japan: "Japan", "Republic of Korea": "Südkorea", India: "Indien", Canada: "Kanada", Mexico: "Mexiko",
  Brazil: "Brasilien", Australia: "Australien", "Russian Federation": "Russland", Poland: "Polen", Denmark: "Dänemark",
  Sweden: "Schweden", Norway: "Norwegen", Finland: "Finnland", Belgium: "Belgien", Portugal: "Portugal", Greece: "Griechenland",
  Luxembourg: "Luxemburg", Malta: "Malta", Iceland: "Island", Czechia: "Tschechien", "Czech Republic": "Tschechien", Hungary: "Ungarn",
  Romania: "Rumänien", Saudi: "Saudi-Arabien", "Saudi Arabia": "Saudi-Arabien", Singapore: "Singapur", Thailand: "Thailand",
  Indonesia: "Indonesien", Malaysia: "Malaysia", Philippines: "Philippinen", "Viet Nam": "Vietnam", Taiwan: "Taiwan",
  "New Zealand": "Neuseeland", "South Africa": "Südafrika", Egypt: "Ägypten", Israel: "Israel", Argentina: "Argentinien",
  Chile: "Chile", Colombia: "Kolumbien", Ukraine: "Ukraine", Kazakhstan: "Kasachstan", Morocco: "Marokko",
};
const land = (n) => LAENDER[n] || n || "";

// ---------- Weltweiter Schnappschuss (OpenSky) ----------
let schnapp = null;     // { at, quelle, liste: [[hex, lat, lon, hoehe_m, tempo_kmh, kurs, gruppe, rufzeichen, land, steig_ms, zeit_s]] }
let paket = null;       // { at, json, gz }
let laedt = null;
let naechsterAbruf = 0;
let token = null;       // { wert, bis }
let letzterFehler = "";

const mitKonto = () => Boolean(env("OPENSKY_CLIENT_ID") && env("OPENSKY_CLIENT_SECRET"));
const takt = () => (mitKonto() ? 2 * 60 * 1000 : 15 * 60 * 1000);

async function openskyToken() {
  if (!mitKonto()) return null;
  if (token && Date.now() < token.bis) return token.wert;
  const r = await fetch("https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token", {
    method: "POST", headers: { ...UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: env("OPENSKY_CLIENT_ID"), client_secret: env("OPENSKY_CLIENT_SECRET") }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`OpenSky-Anmeldung ${r.status}`);
  const d = await r.json();
  token = { wert: d.access_token, bis: Date.now() + Math.max(60, (d.expires_in || 1800) - 60) * 1000 };
  return token.wert;
}

async function holeOpenSky() {
  const t = await openskyToken().catch((e) => { letzterFehler = e.message; return null; });
  const r = await fetch("https://opensky-network.org/api/states/all?extended=1", {
    headers: { ...UA, ...(t ? { Authorization: `Bearer ${t}` } : {}) }, signal: AbortSignal.timeout(45000),
  });
  if (r.status === 429) {
    const warte = Number(r.headers.get("x-rate-limit-retry-after-seconds")) || 3600;
    naechsterAbruf = Date.now() + Math.min(warte, 6 * 3600) * 1000;
    throw new Error("OpenSky: Tageskontingent aufgebraucht");
  }
  if (!r.ok) throw new Error(`OpenSky ${r.status}`);
  const d = await r.json();
  const zeit = d.time || Math.floor(Date.now() / 1000);
  const liste = [];
  for (const s of d.states || []) {
    const lon = s[5], lat = s[6];
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const cs = String(s[1] || "").trim();
    const boden = Boolean(s[8]);
    const hoehe = s[13] ?? s[7];
    liste.push([s[0], +lat.toFixed(4), +lon.toFixed(4), hoehe != null ? Math.round(hoehe) : null,
      s[9] != null ? Math.round(s[9] * 3.6) : null, s[10] != null ? Math.round(s[10]) : null,
      GNR[gruppe(cs, s[17], boden, s[14])], cs, land(s[2]), s[11] != null ? Math.round(s[11] * 10) / 10 : null, s[3] || s[4] || zeit]);
  }
  return { at: Date.now(), zeit, quelle: "OpenSky Network", liste };
}

// Schnappschuss + Live-Schicht (adsb.lol: Militär + Notfälle) zu einer Liste zusammenführen
function gesamtListe() {
  const basis = schnapp?.liste || [];
  if (!live.liste.length) return basis;
  const neu = new Map(live.liste.map((f) => [f[0], f]));
  const out = basis.map((f) => { const n = neu.get(f[0]); if (!n) return f; neu.delete(f[0]); if (!n[8]) n[8] = f[8]; return n; });
  for (const f of neu.values()) out.push(f);
  return out;
}
function packe() {
  const liste = gesamtListe();
  const json = JSON.stringify({
    stand: schnapp ? new Date(schnapp.zeit * 1000).toISOString() : null, quelle: schnapp?.quelle || "",
    naechster: new Date(Math.max(naechsterAbruf, (schnapp?.at || 0) + takt())).toISOString(),
    mit_konto: mitKonto(), fehler: letzterFehler, gruppen: FLUG_GRUPPEN, flugzeuge: liste,
    live: { stand: live.at ? new Date(live.at).toISOString() : null, militaer: live.mil, notfaelle: live.notfaelle, fehler: live.fehler },
    lizenz: "Flugdaten: OpenSky Network, adsb.lol (ODbL)",
  });
  paket = { at: Date.now(), json, gz: zlib.gzipSync(json, { level: 6 }) };
}

export async function getAlleFlugzeuge() {
  if (!schnapp) {
    try { const c = JSON.parse(fs.readFileSync(CACHE, "utf8")); if (Date.now() - c.at < 60 * 60 * 1000) { schnapp = c; naechsterAbruf = c.at + takt(); } } catch { /* noch keiner */ }
  }
  const faellig = !schnapp || Date.now() >= Math.max(naechsterAbruf, schnapp.at + takt());
  if (faellig && !laedt) {
    laedt = holeWeltkarte()
      .then((s) => {
        schnapp = s; letzterFehler = ""; naechsterAbruf = Date.now() + takt();
        try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(s)); } catch { /* egal */ }
      })
      .catch((e) => { letzterFehler = e.message; if (Date.now() >= naechsterAbruf) naechsterAbruf = Date.now() + 5 * 60 * 1000; })
      .finally(() => { laedt = null; paket = null; });
  }
  liveSchicht(); // im Hintergrund, höchstens alle 60 Sek.
  if (!schnapp && laedt) await laedt;
  if (!paket) packe();
  return paket;
}

// Weltkarte: zuerst OpenSky, bei Ausfall die adsb.lol-Regionen. FLUG_QUELLE=adsblol erzwingt adsb.lol.
async function holeWeltkarte() {
  if (env("FLUG_QUELLE").toLowerCase() === "adsblol") return holeAdsbRegionen();
  try { return await holeOpenSky(); } catch (e) {
    const grund = e.message;
    try {
      const s = await holeAdsbRegionen();
      letzterFehler = "";
      s.hinweis = `OpenSky: ${grund}`;
      return s;
    } catch { throw new Error(grund); }
  }
}

// ---------- adsb.lol: gemeinsame Helfer ----------
const ADSB = "https://api.adsb.lol";
async function adsbJson(pfad, ms = 12000, opt = {}) {
  const r = await fetch(ADSB + pfad, { ...opt, headers: { ...UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(ms) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`adsb.lol ${r.status}`);
  return r.json();
}
const gesperrt = (a) => Boolean((a.dbFlags || 0) & 12); // 4 = PIA, 8 = LADD (Halter will nicht angezeigt werden)
const istMil = (a) => Boolean((a.dbFlags || 0) & 1);
const gueltig = (a) => typeof a?.lat === "number" && typeof a?.lon === "number" && /^~?[0-9a-f]{6}$/.test(String(a.hex || ""));

// ---------- Ersatz-Weltkarte aus adsb.lol-Regionen ----------
// Mittelpunkte (lat, lon) – je 250 Seemeilen Umkreis, deckt die Gebiete mit dem meisten Luftverkehr ab.
export const ADSB_REGIONEN = [
  // Europa
  [52, 0], [48.5, 2.5], [51, 9], [53, 14], [47.5, 11], [45.5, 8.5], [41.5, 13], [40, -3.5], [38, -8.5], [57, 12], [60, 22],
  [50, 20], [46, 22], [44, 28], [38, 23], [41, 29], [55, -4], [64, 16], [37, 34],
  // Nordamerika
  [41, -74], [38.5, -81], [33.5, -84.5], [28, -81.5], [42, -88], [32.5, -97], [39.5, -105], [34, -118], [37.5, -122],
  [47.5, -122], [45, -93], [30, -90], [44, -79], [49.5, -97], [19.5, -99],
  // Asien, Nahost, Ozeanien
  [25, 55], [32, 35], [24.5, 46.5], [28.5, 77], [19, 73], [13, 77.5], [1.3, 103.8], [13.8, 100.5], [22.3, 114], [31, 121.5],
  [39.9, 116.4], [23, 113], [35.5, 139.5], [37.5, 127], [25, 121.5], [14.5, 121], [-6.2, 106.8], [-33.9, 151.2], [-37.8, 145],
  // Südamerika, Afrika
  [-23.5, -46.6], [-34.6, -58.4], [4.7, -74], [-12, -77], [-26, 28], [30, 31], [6.5, 3.4], [-1.3, 36.8],
];
let regionStand = { at: 0, ok: 0 };
function ausAdsbZeile(a, jetztS) {
  const r = ausAdsb(a);
  if (jetztS) r[10] = jetztS - Math.round(a.seen_pos || a.seen || 0);
  return r;
}
async function holeAdsbRegionen() {
  const map = new Map();
  let ok = 0, fehler = 0;
  // je 3 Regionen gleichzeitig, kurze Pause dazwischen – freundlich zum freien Dienst
  for (let i = 0; i < ADSB_REGIONEN.length; i += 3) {
    const teil = await Promise.allSettled(ADSB_REGIONEN.slice(i, i + 3).map(([la, lo]) => adsbJson(`/v2/point/${la}/${lo}/250`, 15000)));
    for (const x of teil) {
      if (x.status === "rejected") { fehler++; continue; }
      const jetzt = Math.floor((x.value?.now || Date.now()) / 1000);
      for (const a of x.value?.ac || []) if (gueltig(a)) map.set(a.hex, ausAdsbZeile(a, jetzt));
      ok++;
    }
    if (fehler >= 6 && ok === 0) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!ok) throw new Error("adsb.lol nicht erreichbar");
  regionStand = { at: Date.now(), ok };
  return { at: Date.now(), zeit: Math.floor(Date.now() / 1000), quelle: `adsb.lol (${ok} Regionen)`, liste: [...map.values()] };
}

// ---------- Live-Schicht: Militär + Notfälle weltweit (adsb.lol, alle 60 Sek.) ----------
const live = { at: 0, liste: [], mil: 0, notfaelle: [], fehler: "", laedt: null, naechster: 0 };
function liveSchicht() {
  if (live.laedt || Date.now() < live.naechster) return live.laedt;
  live.naechster = Date.now() + 60 * 1000;
  live.laedt = (async () => {
    const [mil, ...sq] = await Promise.allSettled([adsbJson("/v2/mil", 15000), ...NOTFALL_CODES.map((c) => adsbJson(`/v2/sqk/${c}`, 10000))]);
    if (mil.status === "rejected" && sq.every((x) => x.status === "rejected")) { live.fehler = "adsb.lol nicht erreichbar"; live.naechster = Date.now() + 3 * 60 * 1000; return; }
    const map = new Map();
    let milZahl = 0;
    const jetzt = Math.floor(Date.now() / 1000);
    if (mil.status === "fulfilled") for (const a of mil.value?.ac || []) if (gueltig(a)) { map.set(a.hex, ausAdsbZeile(a, jetzt)); milZahl++; }
    const notfaelle = [];
    for (const x of sq) if (x.status === "fulfilled") for (const a of x.value?.ac || []) {
      if (!gueltig(a) || !NOTFALL_CODES.includes(a.squawk)) continue;
      map.set(a.hex, ausAdsbZeile(a, jetzt));
      notfaelle.push({ hex: a.hex, rufzeichen: String(a.flight || "").trim(), squawk: a.squawk, lat: +a.lat.toFixed(3), lon: +a.lon.toFixed(3), typ: a.t || "", seit: neuNotfall(a.hex) });
    }
    live.at = Date.now(); live.liste = [...map.values()]; live.mil = milZahl; live.notfaelle = notfaelle; live.fehler = "";
    paket = null;
  })().catch((e) => { live.fehler = e.message; }).finally(() => { live.laedt = null; });
  return live.laedt;
}
const notfallSeit = new Map();
function neuNotfall(hex) {
  if (!notfallSeit.has(hex)) notfallSeit.set(hex, new Date().toISOString());
  if (notfallSeit.size > 300) notfallSeit.delete(notfallSeit.keys().next().value);
  return notfallSeit.get(hex);
}
export function getNotfaelle() { return live.notfaelle; }

// ---------- Genaue Live-Daten im Umkreis (adsb.lol) ----------
const nahCache = new Map();
function ausAdsb(a) {
  const cs = String(a.flight || "").trim();
  const boden = a.alt_baro === "ground";
  const hoeheFt = boden ? 0 : (a.alt_geom ?? a.alt_baro);
  const kat = a.category || "";
  return [a.hex, +a.lat.toFixed(4), +a.lon.toFixed(4), typeof hoeheFt === "number" ? Math.round(hoeheFt * 0.3048) : null,
    a.gs != null ? Math.round(a.gs * 1.852) : null, a.track != null ? Math.round(a.track) : a.true_heading != null ? Math.round(a.true_heading) : null,
    GNR[gruppe(cs, kat, boden, a.squawk, istMil(a))], cs, "", a.baro_rate != null ? Math.round(a.baro_rate * 0.00508 * 10) / 10 : null, Math.floor(Date.now() / 1000) - Math.round(a.seen_pos || a.seen || 0)];
}
export async function getFlugzeugeNah(lat, lon) {
  const la = Math.round(lat * 2) / 2, lo = Math.round(lon * 2) / 2;
  const key = `${la},${lo}`;
  const c = nahCache.get(key);
  if (c && Date.now() - c.at < 12000) return c.liste;
  const d = await adsbJson(`/v2/point/${la}/${lo}/250`, 12000);
  const liste = (d?.ac || []).filter(gueltig).map(ausAdsb);
  nahCache.set(key, { at: Date.now(), liste });
  if (nahCache.size > 60) nahCache.delete(nahCache.keys().next().value);
  return liste;
}

// ---------- Steckbrief ----------
let infos = null;
function infoLies() { if (!infos) { try { infos = JSON.parse(fs.readFileSync(INFO_DATEI, "utf8")); } catch { infos = {}; } } return infos; }
function infoSchreib() {
  const k = Object.keys(infos);
  if (k.length > 4000) for (const x of k.slice(0, k.length - 4000)) delete infos[x];
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(INFO_DATEI, JSON.stringify(infos)); } catch { /* egal */ }
}
async function getJson(url, ms = 10000) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.json();
}
async function flugzeugInfo(hex) {
  const db = infoLies();
  const c = db["a:" + hex];
  if (c && Date.now() - c.at < 30 * 24 * 3600 * 1000) return c.d;
  const j = await getJson(`https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(hex)}`).catch(() => undefined);
  if (j === undefined) return c?.d || null; // Fehler: alte Daten behalten
  const a = j?.response?.aircraft || null;
  const d = a ? {
    typ: [a.manufacturer, a.type].filter(Boolean).join(" "), typ_code: a.icao_type || "", kennzeichen: a.registration || "",
    halter: a.registered_owner || "", halter_land: land(a.registered_owner_country_name) || "", foto: a.url_photo_thumbnail || a.url_photo || "",
    foto_gross: a.url_photo || "",
  } : null;
  db["a:" + hex] = { at: Date.now(), d };
  infoSchreib();
  return d;
}
// Ersatz-Strecke über adsb.lol (/api/0/routeset), wenn adsbdb nichts weiß
const LAND_ISO = { DE: "Deutschland", US: "USA", GB: "Großbritannien", FR: "Frankreich", ES: "Spanien", IT: "Italien", NL: "Niederlande", CH: "Schweiz",
  AT: "Österreich", TR: "Türkei", AE: "Vereinigte Arabische Emirate", QA: "Katar", CN: "China", JP: "Japan", IN: "Indien", CA: "Kanada", PL: "Polen",
  DK: "Dänemark", SE: "Schweden", NO: "Norwegen", FI: "Finnland", BE: "Belgien", PT: "Portugal", GR: "Griechenland", IE: "Irland", SG: "Singapur" };
async function streckeAdsb(cs, lat, lon) {
  if (!cs) return null;
  const d = await adsbJson("/api/0/routeset", 10000, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planes: [{ callsign: cs, lat: lat ?? 0, lng: lon ?? 0 }] }),
  });
  const f = Array.isArray(d) ? d[0] : null;
  const ap = f?._airports;
  if (!Array.isArray(ap) || ap.length < 2 || f.plausible === false) return null;
  const ort = (o) => ({ name: o.name || "", stadt: o.location || "", land: LAND_ISO[o.countryiso2] || o.countryiso2 || "", iata: o.iata || "", icao: o.icao || "", lat: o.lat, lon: o.lon });
  return { airline: "", airline_land: "", flugnummer: f.number || cs, von: ort(ap[0]), nach: ort(ap[ap.length - 1]), quelle: "adsb.lol" };
}
async function streckeInfo(cs, lat, lon) {
  if (!cs) return null;
  const db = infoLies();
  const c = db["c:" + cs];
  if (c && Date.now() - c.at < 3 * 24 * 3600 * 1000) return c.d;
  const j = await getJson(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`).catch(() => undefined);
  if (j === undefined) return c?.d || null;
  const f = j?.response?.flightroute || null;
  const ort = (o) => (o ? { name: o.name || "", stadt: o.municipality || "", land: land(o.country_name), iata: o.iata_code || "", icao: o.icao_code || "", lat: o.latitude, lon: o.longitude } : null);
  let d = f ? { airline: f.airline?.name || "", airline_land: land(f.airline?.country), flugnummer: f.callsign_iata || f.callsign || cs, von: ort(f.origin), nach: ort(f.destination) } : null;
  if (!d) d = await streckeAdsb(cs, lat, lon).catch(() => null);
  db["c:" + cs] = { at: Date.now(), d };
  infoSchreib();
  return d;
}

export async function getFlugzeug(hexRoh) {
  const hex = String(hexRoh || "").toLowerCase();
  if (!/^~?[0-9a-f]{6}$/.test(hex)) throw new Error("Ungültige Flugzeug-Kennung");
  // Live: adsb.lol (genau), sonst letzter Schnappschuss
  let liveZeile = null, details = null;
  try {
    const d = await adsbJson(`/v2/hex/${hex}`, 8000);
    const a = d?.ac?.[0];
    if (a && typeof a.lat === "number") {
      liveZeile = ausAdsb(a);
      details = {
        gesperrt: gesperrt(a), militaer: istMil(a),
        squawk: a.squawk || "", kategorie: a.category || "", steigrate_m_min: a.baro_rate != null ? Math.round(a.baro_rate * 0.3048) : null,
        wind: a.ws != null ? `${Math.round(a.ws * 1.852)} km/h aus ${Math.round(a.wd)}°` : "", aussentemp: a.oat != null ? `${a.oat} °C` : "",
        kennzeichen: a.r || "", typ_code: a.t || "", typ: a.desc || "",
      };
    }
  } catch { /* nur Schnappschuss */ }
  if (!liveZeile) liveZeile = live.liste.find((x) => x[0] === hex) || schnapp?.liste.find((x) => x[0] === hex) || null;
  if (!liveZeile) return null;
  const [, lat, lon, hoehe, tempo, kurs, gi, cs, herkunft, steig, zeit] = liveZeile;
  const [info, strecke] = await Promise.all([flugzeugInfo(hex).catch(() => null), streckeInfo(cs, lat, lon).catch(() => null)]);
  const g = FLUG_GRUPPEN[gi] || FLUG_GRUPPEN[1];
  // Datenschutz: Halter nur bei Airlines und Militär/Staat, nie bei Privatfliegern; bei Sperrwunsch (LADD/PIA) auch kein Kennzeichen
  const sperre = Boolean(details?.gesperrt) || hex.startsWith("~");
  const halterOk = !sperre && (g.id === "linie" || g.id === "militaer" || (g.id === "boden" && /^[A-Z]{3}\d/.test(cs || "")));
  return {
    hex, rufzeichen: cs, lat, lon, hoehe_m: hoehe, hoehe_ft: hoehe != null ? Math.round(hoehe / 0.3048) : null, tempo_kmh: tempo, kurs, steig_ms: steig,
    zeit: zeit ? new Date(zeit * 1000).toISOString() : null, gruppe: g.id, gruppe_name: g.name, herkunft: herkunft || info?.halter_land || "",
    typ: info?.typ || details?.typ || details?.typ_code || "", typ_code: info?.typ_code || details?.typ_code || "",
    kennzeichen: sperre ? "" : info?.kennzeichen || details?.kennzeichen || "", halter: halterOk ? info?.halter || "" : "",
    foto: sperre ? "" : info?.foto || "", foto_gross: sperre ? "" : info?.foto_gross || "",
    privat_hinweis: sperre ? "Der Halter hat um Datenschutz gebeten (LADD/PIA) – Kennzeichen und Halter bleiben verborgen." : "",
    squawk: details?.squawk || "", wind: details?.wind || "", aussentemp: details?.aussentemp || "",
    strecke, quelle_live: details ? "adsb.lol (live)" : (schnapp?.quelle?.startsWith("adsb.lol") ? "adsb.lol (Regionen)" : "OpenSky (Schnappschuss)"),
    lizenz: "Daten: adsb.lol (ODbL), adsbdb.com",
    mehr: `https://globe.adsb.lol/?icao=${hex}`,
  };
}

// Suche nach Rufzeichen / Flugnummer (für Sprache)
const IATA_ICAO = {
  LH: "DLH", EW: "EWG", FR: "RYR", U2: "EZY", BA: "BAW", AF: "AFR", KL: "KLM", UA: "UAL", AA: "AAL", DL: "DAL", EK: "UAE",
  QR: "QTR", TK: "THY", LX: "SWR", OS: "AUA", SK: "SAS", IB: "IBE", AZ: "ITY", DE: "CFG", X3: "TUI", W6: "WZZ", VY: "VLG",
  EY: "ETD", SQ: "SIA", CX: "CPA", NH: "ANA", JL: "JAL", AC: "ACA", QF: "QFA", LO: "LOT", AY: "FIN", TP: "TAP", SN: "BEL",
  EI: "EIN", WN: "SWA", B6: "JBU", AS: "ASA", CA: "CCA", MU: "CES", CZ: "CSN", KE: "KAL", OZ: "AAR", ET: "ETH", SV: "SVA",
  MS: "MSR", PC: "PGT", "4Y": "OCN", HV: "TRA", VS: "VIR", DY: "NOZ", D8: "NSZ", A3: "AEE", JU: "ASL", OK: "CSA", RO: "ROT",
};
function suchVarianten(q) {
  const t = String(q || "").toUpperCase().replace(/\s+/g, "");
  const m = t.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);
  const v = [t];
  if (m && IATA_ICAO[m[1]]) v.push(IATA_ICAO[m[1]] + m[2]);
  return v.filter(Boolean);
}
export function sucheFlug(q) {
  const varianten = suchVarianten(q);
  const liste = gesamtListe();
  if (!varianten.length || !liste.length) return null;
  for (const v of varianten) { const f = liste.find((x) => x[7] === v); if (f) return f; }
  return liste.find((x) => x[0] === varianten[0].toLowerCase()) || null;
}
// Wenn der Flug nicht im Schnappschuss ist: live bei adsb.lol nach Rufzeichen fragen
export async function sucheFlugLive(q) {
  const f = sucheFlug(q);
  if (f) return f;
  for (const v of suchVarianten(q)) {
    if (!/^[A-Z0-9]{3,8}$/.test(v)) continue;
    const d = await adsbJson(`/v2/callsign/${v}`, 8000).catch(() => null);
    const a = (d?.ac || []).find(gueltig);
    if (a) return ausAdsb(a);
  }
  return null;
}

// ---------- „Was fliegt über mir?“ (adsb.lol /v2/closest) ----------
let heimat = null;
async function heimatOrt() {
  const stadt = config.city || "Berlin";
  if (heimat && heimat.stadt === stadt) return heimat;
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=${encodeURIComponent(stadt)}`, { headers: UA, signal: AbortSignal.timeout(9000) });
  const p = (await r.json())?.results?.[0];
  if (!p) throw new Error("Wohnort nicht gefunden");
  heimat = { stadt, name: p.name, lat: p.latitude, lon: p.longitude };
  return heimat;
}
const entfernungKm = (a, b, c, d) => {
  const R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
export async function ueberMir(radiusSm = 40) {
  const h = await heimatOrt();
  const d = await adsbJson(`/v2/point/${h.lat.toFixed(3)}/${h.lon.toFixed(3)}/${radiusSm}`, 10000);
  const liste = (d?.ac || []).filter((a) => gueltig(a) && a.alt_baro !== "ground")
    .map((a) => ({ a, km: entfernungKm(h.lat, h.lon, a.lat, a.lon) })).sort((x, y) => x.km - y.km);
  return { ort: h, anzahl: liste.length, liste: liste.slice(0, 10).map(({ a, km }) => ({ zeile: ausAdsb(a), km: Math.round(km * 10) / 10, typ: a.desc || a.t || "" })) };
}

export function flugZahlen() {
  const z = {};
  const liste = gesamtListe();
  for (const f of liste) z[f[6]] = (z[f[6]] || 0) + 1;
  return { anzahl: liste.length, gruppen: FLUG_GRUPPEN.map((g, i) => ({ ...g, anzahl: z[i] || 0 })), stand: schnapp ? new Date(schnapp.zeit * 1000) : null };
}

export function flugzeugeRouten(app, asyncRoute) {
  app.get("/api/flugzeuge", asyncRoute(async (req, res) => {
    const p = await getAlleFlugzeuge();
    res.set("Cache-Control", "no-store"); res.set("Vary", "Accept-Encoding");
    if (/\bgzip\b/.test(req.headers["accept-encoding"] || "")) res.set("Content-Encoding", "gzip").type("application/json").send(p.gz);
    else res.type("application/json").send(p.json);
  }));
  app.get("/api/flugzeuge/nah", asyncRoute(async (req, res) => {
    const lat = Number(req.query.lat), lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: "lat/lon fehlen" });
    res.json({ flugzeuge: await getFlugzeugeNah(lat, lon).catch(() => []) });
  }));
  app.get("/api/flugzeuge/notfaelle", asyncRoute(async (_req, res) => {
    await liveSchicht();
    res.json({ stand: live.at ? new Date(live.at).toISOString() : null, notfaelle: live.notfaelle, militaer: live.mil, fehler: live.fehler });
  }));
  app.get("/api/flugzeuge/ueber-mir", asyncRoute(async (req, res) => {
    const r = Math.min(100, Math.max(5, Number(req.query.radius) || 40));
    try { res.json(await ueberMir(r)); } catch (e) { res.status(503).json({ error: e.message }); }
  }));
  app.get("/api/flugzeuge/suche/:q", asyncRoute(async (req, res) => {
    const f = await sucheFlugLive(String(req.params.q).slice(0, 12));
    if (!f) return res.status(404).json({ error: "Diesen Flug finde ich gerade nicht in der Luft." });
    res.json({ flugzeug: f });
  }));
  app.get("/api/flugzeuge/:hex", asyncRoute(async (req, res) => {
    const f = await getFlugzeug(req.params.hex);
    if (!f) return res.status(404).json({ error: "Dieses Flugzeug sendet gerade nicht." });
    res.json(f);
  }));
}

// ---------- Sprachbefehle ohne Claude ----------
export async function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/[?!.]+$/, "").trim();
  if (!t) return null;
  // „Was fliegt (da gerade) über mir?“ – nächstes Flugzeug über dem Wohnort
  if (/(fliegt|flieger|flugzeug|jet|maschine).*(über mir|über uns|über dem haus|über unserem haus|hier oben|bei mir|in meiner nähe|in der nähe)/.test(t)
    || /^(was|wer) fliegt da\b/.test(t)) {
    const r = await ueberMir(40).catch(() => null);
    if (!r) return { answer: "Ich kann gerade nicht nachsehen, was über dir fliegt. adsb.lol ist nicht erreichbar.", actions: [] };
    if (!r.anzahl) return { answer: `Über ${r.ort.name} fliegt gerade kein Flugzeug, das öffentlich sendet.`, actions: [] };
    const n = r.liste[0], f = n.zeile;
    const s = await streckeInfo(f[7], f[1], f[2]).catch(() => null);
    const wer = s?.airline ? `${s.airline} ${s.flugnummer || f[7]}` : f[7] ? `Flug ${f[7]}` : "ein Flugzeug ohne Rufzeichen";
    const wohin = s?.von && s?.nach ? `, von ${s.von.stadt || s.von.name} nach ${s.nach.stadt || s.nach.name}` : "";
    const typ = n.typ ? `, Typ ${n.typ.toLowerCase().replace(/(^|[\s-])([a-zäöü])/g, (x, v, c) => v + c.toUpperCase())}` : "";
    const mehr = r.anzahl > 1 ? ` Insgesamt sind ${r.anzahl} Flugzeuge in der Nähe.` : "";

    return { answer: `Am nächsten ist ${wer}${typ}${wohin}. ${n.km.toLocaleString("de-DE")} Kilometer entfernt, in ${(f[3] || 0).toLocaleString("de-DE")} Metern Höhe.${mehr}`, actions: ["weltgeschehen", `flugzeug:${f[0]}`] };
  }
  if (!/(flugzeug|flieger|flug\b|flug |flüge|fluege|hubschrauber|helikopter|luftverkehr|in der luft|militärjet|kampfjet|squawk|luftnotfall)/.test(t)) return null;
  const zeig = /\b(zeig|zeige|zeigen|öffne|oeffne|finde|such|suche|wo ist|wo sind|verfolge|gibt es|gibts)\b/.test(t);
  const wieviele = /\bwie ?viele\b/.test(t);
  if (!zeig && !wieviele) return null;
  await getAlleFlugzeuge().catch(() => null);
  await liveSchicht()?.catch?.(() => null);
  const z = flugZahlen();
  const zahlG = (id) => z.gruppen[GNR[id]]?.anzahl || 0;
  if (/militär|militaer|kampfjet|militärjet|luftwaffe|armee|regierung/.test(t)) {
    return { answer: zahlG("militaer") ? `Gerade ${zahlG("militaer") === 1 ? "sendet ein Militär- oder Staatsflugzeug" : `senden ${zahlG("militaer").toLocaleString("de-DE")} Militär- und Staatsflugzeuge`} öffentlich die Position. Viele andere senden nicht, die sieht niemand.` : "Gerade finde ich keine Militärflugzeuge, die öffentlich senden.", actions: ["weltgeschehen", "fluggruppe:militaer"] };
  }
  if (/notfall|notfälle|squawk|luftnotfall|7700/.test(t)) {
    const nf = live.notfaelle;
    if (!nf.length) return { answer: "Gerade meldet kein Flugzeug weltweit einen Notfall-Code. Alles ruhig am Himmel.", actions: ["weltgeschehen", "fluggruppe:notfall"] };
    const art = { 7700: "Notfall", 7600: "Funkausfall", 7500: "Entführungs-Code" };
    const teile = nf.slice(0, 3).map((x) => `${x.rufzeichen || x.hex.toUpperCase()} mit ${art[x.squawk]}`);
    return { answer: nf.length === 1 ? `Gerade meldet ein Flugzeug einen Notfall-Code: ${teile[0]}. Ich zeige es dir.` : `Gerade melden ${nf.length} Flugzeuge einen Notfall-Code: ${teile.join(", ")}. Ich zeige sie dir.`, actions: ["weltgeschehen", nf.length === 1 ? `flugzeug:${nf[0].hex}` : "fluggruppe:notfall"] };
  }
  if (wieviele) {
    const luft = z.anzahl - zahlG("boden");
    return { answer: z.anzahl ? `Gerade sind weltweit rund ${luft.toLocaleString("de-DE")} Flugzeuge in der Luft, die öffentlich ihre Position senden. Ich zeige sie dir auf dem Globus.` : "Die Flugdaten kann ich gerade nicht laden.", actions: ["weltgeschehen", "flugzeuge"] };
  }
  const m = t.match(/\bflug(?:nummer)?\s+([a-z0-9]{2,3}\s?\d{1,4}[a-z]?)\b/);
  if (m) {
    const f = await sucheFlugLive(m[1]).catch(() => null);
    if (!f) return { answer: `Den Flug ${m[1].toUpperCase()} finde ich gerade nicht in der Luft.`, actions: ["weltgeschehen", "flugzeuge"] };
    const s = await streckeInfo(f[7], f[1], f[2]).catch(() => null);
    const strecke = s?.von && s?.nach ? ` unterwegs von ${s.von.stadt || s.von.name} nach ${s.nach.stadt || s.nach.name}` : "";
    return { answer: `Hier ist Flug ${s?.flugnummer || f[7]}${s?.airline ? " von " + s.airline : ""}${strecke ? "," + strecke : ""}. Er fliegt in ${(f[3] || 0).toLocaleString("de-DE")} Metern Höhe mit ${(f[4] || 0).toLocaleString("de-DE")} Kilometern pro Stunde.`, actions: ["weltgeschehen", `flugzeug:${f[0]}`] };
  }
  if (/hubschrauber|helikopter/.test(t)) return { answer: `Ich zeige dir die Hubschrauber, die ihren Typ senden: ${zahlG("heli")}.`, actions: ["weltgeschehen", "fluggruppe:heli"] };
  return { answer: z.anzahl ? `Hier sind alle ${z.anzahl.toLocaleString("de-DE")} Flugzeuge, die gerade öffentlich ihre Position senden. Tipp eins an für den Steckbrief.` : "Die Flugdaten kann ich gerade nicht laden.", actions: ["weltgeschehen", "flugzeuge"] };
}
