// Flugzeuge weltweit für das Weltgeschehen (ab v1.115.0).
// Quellen (frei):
//   OpenSky Network /states/all – ALLE Flugzeuge weltweit (ca. 10.000–14.000). Ohne Konto ca. 100 Abrufe/Tag
//     -> Friday holt ohne Konto alle 15 Min., mit kostenlosem OpenSky-API-Client (OPENSKY_CLIENT_ID/SECRET) alle 2 Min.
//     Dazwischen rechnet das Dashboard die Flugzeuge mit Tempo + Kurs weiter (wirkt live).
//   adsb.lol – genaue Live-Daten im Umkreis (250 sm), wenn man nah heranzoomt oder ein Flugzeug antippt.
//   adsbdb.com – Steckbrief: Typ, Hersteller, Kennzeichen, Halter, Foto, Strecke (von/nach), Airline.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DATA_DIR } from "./config.js";

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
];
const GNR = Object.fromEntries(FLUG_GRUPPEN.map((g, i) => [g.id, i]));

function gruppe(cs, kategorie, amBoden, squawk) {
  if (squawk === "7700" || squawk === "7600" || squawk === "7500") return "notfall";
  if (amBoden) return "boden";
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

function packe() {
  const json = JSON.stringify({
    stand: schnapp ? new Date(schnapp.zeit * 1000).toISOString() : null, quelle: schnapp?.quelle || "",
    naechster: new Date(Math.max(naechsterAbruf, (schnapp?.at || 0) + takt())).toISOString(),
    mit_konto: mitKonto(), fehler: letzterFehler, gruppen: FLUG_GRUPPEN, flugzeuge: schnapp?.liste || [],
  });
  paket = { at: Date.now(), json, gz: zlib.gzipSync(json, { level: 6 }) };
}

export async function getAlleFlugzeuge() {
  if (!schnapp) {
    try { const c = JSON.parse(fs.readFileSync(CACHE, "utf8")); if (Date.now() - c.at < 60 * 60 * 1000) { schnapp = c; naechsterAbruf = c.at + takt(); } } catch { /* noch keiner */ }
  }
  const faellig = !schnapp || Date.now() >= Math.max(naechsterAbruf, schnapp.at + takt());
  if (faellig && !laedt) {
    laedt = holeOpenSky()
      .then((s) => {
        schnapp = s; letzterFehler = ""; naechsterAbruf = Date.now() + takt();
        try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(s)); } catch { /* egal */ }
      })
      .catch((e) => { letzterFehler = e.message; if (Date.now() >= naechsterAbruf) naechsterAbruf = Date.now() + 5 * 60 * 1000; })
      .finally(() => { laedt = null; paket = null; });
  }
  if (!schnapp && laedt) await laedt;
  if (!paket) packe();
  return paket;
}

// ---------- Genaue Live-Daten im Umkreis (adsb.lol) ----------
const nahCache = new Map();
function ausAdsb(a) {
  const cs = String(a.flight || "").trim();
  const boden = a.alt_baro === "ground";
  const hoeheFt = boden ? 0 : (a.alt_geom ?? a.alt_baro);
  const kat = a.category || "";
  return [a.hex, +a.lat.toFixed(4), +a.lon.toFixed(4), typeof hoeheFt === "number" ? Math.round(hoeheFt * 0.3048) : null,
    a.gs != null ? Math.round(a.gs * 1.852) : null, a.track != null ? Math.round(a.track) : a.true_heading != null ? Math.round(a.true_heading) : null,
    GNR[gruppe(cs, kat, boden, a.squawk)], cs, "", a.baro_rate != null ? Math.round(a.baro_rate * 0.00508 * 10) / 10 : null, Math.floor(Date.now() / 1000) - Math.round(a.seen_pos || a.seen || 0)];
}
export async function getFlugzeugeNah(lat, lon) {
  const la = Math.round(lat * 2) / 2, lo = Math.round(lon * 2) / 2;
  const key = `${la},${lo}`;
  const c = nahCache.get(key);
  if (c && Date.now() - c.at < 12000) return c.liste;
  const r = await fetch(`https://api.adsb.lol/v2/lat/${la}/lon/${lo}/dist/250`, { headers: UA, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`adsb.lol ${r.status}`);
  const d = await r.json();
  const liste = (d.ac || []).filter((a) => typeof a.lat === "number" && typeof a.lon === "number").map(ausAdsb);
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
async function streckeInfo(cs) {
  if (!cs) return null;
  const db = infoLies();
  const c = db["c:" + cs];
  if (c && Date.now() - c.at < 3 * 24 * 3600 * 1000) return c.d;
  const j = await getJson(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`).catch(() => undefined);
  if (j === undefined) return c?.d || null;
  const f = j?.response?.flightroute || null;
  const ort = (o) => (o ? { name: o.name || "", stadt: o.municipality || "", land: land(o.country_name), iata: o.iata_code || "", icao: o.icao_code || "", lat: o.latitude, lon: o.longitude } : null);
  const d = f ? { airline: f.airline?.name || "", airline_land: land(f.airline?.country), flugnummer: f.callsign_iata || f.callsign || cs, von: ort(f.origin), nach: ort(f.destination) } : null;
  db["c:" + cs] = { at: Date.now(), d };
  infoSchreib();
  return d;
}

export async function getFlugzeug(hexRoh) {
  const hex = String(hexRoh || "").toLowerCase();
  if (!/^~?[0-9a-f]{6}$/.test(hex)) throw new Error("Ungültige Flugzeug-Kennung");
  // Live: adsb.lol (genau), sonst letzter Schnappschuss
  let live = null, details = null;
  try {
    const d = await getJson(`https://api.adsb.lol/v2/hex/${hex}`, 8000);
    const a = d?.ac?.[0];
    if (a && typeof a.lat === "number") {
      live = ausAdsb(a);
      details = {
        squawk: a.squawk || "", kategorie: a.category || "", steigrate_m_min: a.baro_rate != null ? Math.round(a.baro_rate * 0.3048) : null,
        wind: a.ws != null ? `${Math.round(a.ws * 1.852)} km/h aus ${Math.round(a.wd)}°` : "", aussentemp: a.oat != null ? `${a.oat} °C` : "",
        kennzeichen: a.r || "", typ_code: a.t || "", typ: a.desc || "",
      };
    }
  } catch { /* nur Schnappschuss */ }
  if (!live) live = schnapp?.liste.find((x) => x[0] === hex) || null;
  if (!live) return null;
  const [, lat, lon, hoehe, tempo, kurs, gi, cs, herkunft, steig, zeit] = live;
  const [info, strecke] = await Promise.all([flugzeugInfo(hex).catch(() => null), streckeInfo(cs).catch(() => null)]);
  const g = FLUG_GRUPPEN[gi] || FLUG_GRUPPEN[1];
  return {
    hex, rufzeichen: cs, lat, lon, hoehe_m: hoehe, hoehe_ft: hoehe != null ? Math.round(hoehe / 0.3048) : null, tempo_kmh: tempo, kurs, steig_ms: steig,
    zeit: zeit ? new Date(zeit * 1000).toISOString() : null, gruppe: g.id, gruppe_name: g.name, herkunft: herkunft || info?.halter_land || "",
    typ: info?.typ || details?.typ || details?.typ_code || "", typ_code: info?.typ_code || details?.typ_code || "",
    kennzeichen: info?.kennzeichen || details?.kennzeichen || "", halter: info?.halter || "", foto: info?.foto || "", foto_gross: info?.foto_gross || "",
    squawk: details?.squawk || "", wind: details?.wind || "", aussentemp: details?.aussentemp || "",
    strecke, quelle_live: details ? "adsb.lol (live)" : "OpenSky (Schnappschuss)",
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
export function sucheFlug(q) {
  let t = String(q || "").toUpperCase().replace(/\s+/g, "");
  if (!t || !schnapp) return null;
  const m = t.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);
  const varianten = [t];
  if (m && IATA_ICAO[m[1]]) varianten.push(IATA_ICAO[m[1]] + m[2]);
  for (const v of varianten) { const f = schnapp.liste.find((x) => x[7] === v); if (f) return f; }
  return schnapp.liste.find((x) => x[0] === t.toLowerCase()) || null;
}

export function flugZahlen() {
  const z = {};
  for (const f of schnapp?.liste || []) z[f[6]] = (z[f[6]] || 0) + 1;
  return { anzahl: schnapp?.liste.length || 0, gruppen: FLUG_GRUPPEN.map((g, i) => ({ ...g, anzahl: z[i] || 0 })), stand: schnapp ? new Date(schnapp.zeit * 1000) : null };
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
  app.get("/api/flugzeuge/:hex", asyncRoute(async (req, res) => {
    const f = await getFlugzeug(req.params.hex);
    if (!f) return res.status(404).json({ error: "Dieses Flugzeug sendet gerade nicht." });
    res.json(f);
  }));
}

// ---------- Sprachbefehle ohne Claude ----------
export async function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/[?!.]+$/, "").trim();
  if (!t || !/(flugzeug|flieger|flug\b|flug |flüge|fluege|hubschrauber|helikopter|luftverkehr|in der luft)/.test(t)) return null;
  const zeig = /\b(zeig|zeige|zeigen|öffne|oeffne|finde|such|suche|wo ist|wo sind|verfolge)\b/.test(t);
  const wieviele = /\bwie ?viele\b/.test(t);
  if (!zeig && !wieviele) return null;
  await getAlleFlugzeuge().catch(() => null);
  const z = flugZahlen();
  if (wieviele) {
    const luft = z.anzahl - (z.gruppen.find((g) => g.id === "boden")?.anzahl || 0);
    return { answer: z.anzahl ? `Gerade sind weltweit rund ${luft.toLocaleString("de-DE")} Flugzeuge in der Luft, die öffentlich ihre Position senden. Ich zeige sie dir auf dem Globus.` : "Die Flugdaten kann ich gerade nicht laden.", actions: ["weltgeschehen", "flugzeuge"] };
  }
  const m = t.match(/\bflug(?:nummer)?\s+([a-z0-9]{2,3}\s?\d{1,4}[a-z]?)\b/);
  if (m) {
    const f = sucheFlug(m[1]);
    if (!f) return { answer: `Den Flug ${m[1].toUpperCase()} finde ich gerade nicht in der Luft.`, actions: ["weltgeschehen", "flugzeuge"] };
    const s = await streckeInfo(f[7]).catch(() => null);
    const strecke = s?.von && s?.nach ? ` unterwegs von ${s.von.stadt || s.von.name} nach ${s.nach.stadt || s.nach.name}` : "";
    return { answer: `Hier ist Flug ${s?.flugnummer || f[7]}${s?.airline ? " von " + s.airline : ""}${strecke ? "," + strecke : ""}. Er fliegt in ${(f[3] || 0).toLocaleString("de-DE")} Metern Höhe mit ${(f[4] || 0).toLocaleString("de-DE")} Kilometern pro Stunde.`, actions: ["weltgeschehen", `flugzeug:${f[0]}`] };
  }
  if (/hubschrauber|helikopter/.test(t)) return { answer: `Ich zeige dir die Hubschrauber, die ihren Typ senden: ${z.gruppen[GNR.heli].anzahl}.`, actions: ["weltgeschehen", "fluggruppe:heli"] };
  if (/notfall|notfälle/.test(t)) return { answer: `Gerade senden ${z.gruppen[GNR.notfall].anzahl} Flugzeuge einen Notfall-Code.`, actions: ["weltgeschehen", "fluggruppe:notfall"] };
  return { answer: z.anzahl ? `Hier sind alle ${z.anzahl.toLocaleString("de-DE")} Flugzeuge, die gerade öffentlich ihre Position senden. Tipp eins an für den Steckbrief.` : "Die Flugdaten kann ich gerade nicht laden.", actions: ["weltgeschehen", "flugzeuge"] };
}
