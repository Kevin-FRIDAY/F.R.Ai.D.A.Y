// Live-Schiffe weltweit über aisstream.io (WebSocket, kostenloser Schlüssel in .env AISSTREAM_API_KEY).
// Seit v1.114.0: ALLE Schiffe, die aisstream weltweit empfängt (nicht mehr nur um die Brennpunkte),
// mit Steckbrief (Name, Typ, Flagge, Größe, Tiefgang, Ziel, Ankunft, Status, Spur).
// Ehrlich: aisstream hört über Empfänger an Land mit – auf hoher See fehlen viele Schiffe
// (dafür bräuchte es teures Satelliten-AIS). Kriegsschiffe schalten AIS meist ab.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import WebSocket from "ws";
import { config, DATA_DIR } from "./config.js";
import { schiffExtra, haefenUm } from "./schiffsinfo.js";

const vessels = new Map(); // MMSI -> Datensatz (siehe merke())
let ws = null;
let connected = false;
let retry = 0;
let gestartet = 0;
let nachrichten = 0;
const CACHE = path.join(DATA_DIR, "schiffe-cache.json");
const MAX_ALTER_MS = 90 * 60 * 1000; // Schiffe ohne Meldung seit 90 Min. fallen raus

// ---------- Schiffstypen (AIS-Code) ----------
export const SCHIFF_GRUPPEN = [
  { id: "fracht", name: "Frachter", info: "Container-, Massengut- und Stückgutschiffe." },
  { id: "tanker", name: "Tanker", info: "Öl-, Gas- und Chemikalientanker." },
  { id: "passagier", name: "Passagier & Fähren", info: "Kreuzfahrtschiffe, Fähren, Ausflugsschiffe." },
  { id: "fischerei", name: "Fischerei", info: "Fischkutter und Fabrikschiffe." },
  { id: "hafen", name: "Schlepper & Hafen", info: "Schlepper, Lotsen, Bagger, Versorger." },
  { id: "freizeit", name: "Segel & Sport", info: "Segelboote und Motoryachten." },
  { id: "behoerde", name: "Behörden & Rettung", info: "Seenotrettung, Polizei, Küstenwache, öffentlich sendende Marine." },
  { id: "schnell", name: "Schnellboote", info: "Schnelle Fähren und Hochgeschwindigkeitsfahrzeuge." },
  { id: "sonst", name: "Sonstige / unbekannt", info: "Schiffe ohne Typ-Angabe (kommt meist nach ein paar Minuten)." },
];
const GRUPPE_NR = Object.fromEntries(SCHIFF_GRUPPEN.map((g, i) => [g.id, i]));

function gruppeVon(t) {
  if (t == null || t === 0) return "sonst";
  if (t >= 70 && t <= 79) return "fracht";
  if (t >= 80 && t <= 89) return "tanker";
  if (t >= 60 && t <= 69) return "passagier";
  if (t === 30) return "fischerei";
  if (t === 36 || t === 37) return "freizeit";
  if (t === 35 || t === 51 || t === 55 || t === 58) return "behoerde";
  if (t === 31 || t === 32 || t === 33 || t === 34 || t === 50 || t === 52 || t === 53 || t === 54) return "hafen";
  if (t >= 40 && t <= 49) return "schnell";
  return "sonst";
}
function typText(t) {
  const fest = {
    30: "Fischereifahrzeug", 31: "Schlepper", 32: "Schlepper (großer Schleppverband)", 33: "Bagger / Unterwasserarbeiten",
    34: "Taucherschiff", 35: "Militärschiff", 36: "Segelboot", 37: "Sportboot / Yacht", 50: "Lotsenboot",
    51: "Seenotrettung", 52: "Schlepper", 53: "Hafenversorger", 54: "Ölbekämpfung", 55: "Polizei / Behörde",
    58: "Krankentransport", 59: "Sonderfahrzeug",
  };
  if (t == null || t === 0) return "";
  if (fest[t]) return fest[t];
  if (t >= 70 && t <= 79) return t === 71 || t === 72 ? "Frachter (Gefahrgut)" : "Frachter";
  if (t >= 80 && t <= 89) return t === 81 || t === 82 ? "Tanker (Gefahrgut)" : "Tanker";
  if (t >= 60 && t <= 69) return "Passagierschiff / Fähre";
  if (t >= 40 && t <= 49) return "Schnellboot";
  if (t >= 20 && t <= 29) return "Bodeneffektfahrzeug";
  return "Sonstiges Schiff";
}
// Kompatibel zur alten Liste (Satellitenkarte im Länder-Fenster)
function shipType(t) { const g = gruppeVon(t); return t ? SCHIFF_GRUPPEN[GRUPPE_NR[g]].name : ""; }

const NAV_STATUS = {
  0: "fährt mit Motor", 1: "liegt vor Anker", 2: "manövrierunfähig", 3: "eingeschränkt manövrierfähig",
  4: "durch Tiefgang behindert", 5: "festgemacht", 6: "auf Grund gelaufen", 7: "fischt", 8: "segelt",
  14: "Notsignal (AIS-SART)",
};

// Flagge aus den ersten drei Ziffern der MMSI (Maritime Identification Digits).
const MID = {
  201: "Albanien", 202: "Andorra", 203: "Österreich", 205: "Belgien", 206: "Belarus", 207: "Bulgarien", 209: "Zypern", 210: "Zypern",
  211: "Deutschland", 212: "Zypern", 213: "Georgien", 214: "Moldau", 215: "Malta", 216: "Armenien", 218: "Deutschland", 219: "Dänemark",
  220: "Dänemark", 224: "Spanien", 225: "Spanien", 226: "Frankreich", 227: "Frankreich", 228: "Frankreich", 229: "Malta", 230: "Finnland",
  231: "Färöer", 232: "Großbritannien", 233: "Großbritannien", 234: "Großbritannien", 235: "Großbritannien", 236: "Gibraltar",
  237: "Griechenland", 238: "Kroatien", 239: "Griechenland", 240: "Griechenland", 241: "Griechenland", 242: "Marokko", 243: "Ungarn",
  244: "Niederlande", 245: "Niederlande", 246: "Niederlande", 247: "Italien", 248: "Malta", 249: "Malta", 250: "Irland", 251: "Island",
  252: "Liechtenstein", 253: "Luxemburg", 254: "Monaco", 255: "Portugal (Madeira)", 256: "Malta", 257: "Norwegen", 258: "Norwegen",
  259: "Norwegen", 261: "Polen", 262: "Montenegro", 263: "Portugal", 264: "Rumänien", 265: "Schweden", 266: "Schweden", 267: "Slowakei",
  268: "San Marino", 269: "Schweiz", 270: "Tschechien", 271: "Türkei", 272: "Ukraine", 273: "Russland", 274: "Nordmazedonien",
  275: "Lettland", 276: "Estland", 277: "Litauen", 278: "Slowenien", 279: "Serbien",
  303: "USA (Alaska)", 304: "Antigua und Barbuda", 305: "Antigua und Barbuda", 306: "Curaçao", 307: "Aruba", 308: "Bahamas",
  309: "Bahamas", 310: "Bermuda", 311: "Bahamas", 312: "Belize", 314: "Barbados", 316: "Kanada", 319: "Kaimaninseln",
  321: "Costa Rica", 323: "Kuba", 325: "Jamaika", 327: "Dominikanische Republik", 329: "Guadeloupe", 330: "Grenada", 332: "Guatemala",
  334: "Honduras", 336: "Haiti", 338: "USA", 339: "Jamaika", 341: "St. Kitts und Nevis", 343: "St. Lucia", 345: "Mexiko",
  347: "Martinique", 350: "Nicaragua", 351: "Panama", 352: "Panama", 353: "Panama", 354: "Panama", 355: "Panama", 356: "Panama",
  357: "Panama", 358: "Puerto Rico", 359: "El Salvador", 361: "St. Pierre", 362: "Trinidad und Tobago", 364: "Turks- und Caicosinseln",
  366: "USA", 367: "USA", 368: "USA", 369: "USA", 370: "Panama", 371: "Panama", 372: "Panama", 373: "Panama", 374: "Panama",
  375: "St. Vincent", 376: "St. Vincent", 377: "St. Vincent", 378: "Britische Jungferninseln", 379: "Amerikanische Jungferninseln",
  401: "Afghanistan", 403: "Saudi-Arabien", 405: "Bangladesch", 408: "Bahrain", 410: "Bhutan", 412: "China", 413: "China", 414: "China",
  416: "Taiwan", 417: "Sri Lanka", 419: "Indien", 422: "Iran", 423: "Aserbaidschan", 425: "Irak", 428: "Israel", 431: "Japan",
  432: "Japan", 436: "Kasachstan", 438: "Jordanien", 440: "Südkorea", 441: "Südkorea", 443: "Palästina", 445: "Nordkorea",
  447: "Kuwait", 450: "Libanon", 451: "Kirgisistan", 453: "Macau", 455: "Malediven", 457: "Mongolei", 459: "Nepal", 461: "Oman",
  463: "Pakistan", 466: "Katar", 468: "Syrien", 470: "Vereinigte Arabische Emirate", 471: "Vereinigte Arabische Emirate",
  472: "Tadschikistan", 473: "Jemen", 475: "Jemen", 477: "Hongkong", 478: "Bosnien und Herzegowina",
  501: "Frankreich (Antarktis)", 503: "Australien", 506: "Myanmar", 508: "Brunei", 510: "Mikronesien", 511: "Palau",
  512: "Neuseeland", 514: "Kambodscha", 515: "Kambodscha", 516: "Weihnachtsinsel", 518: "Cookinseln", 520: "Fidschi",
  525: "Indonesien", 529: "Kiribati", 531: "Laos", 533: "Malaysia", 536: "Nördliche Marianen", 538: "Marshallinseln",
  540: "Neukaledonien", 544: "Nauru", 546: "Französisch-Polynesien", 548: "Philippinen", 553: "Papua-Neuguinea", 555: "Pitcairn",
  557: "Salomonen", 559: "Amerikanisch-Samoa", 561: "Samoa", 563: "Singapur", 564: "Singapur", 565: "Singapur", 566: "Singapur",
  567: "Thailand", 570: "Tonga", 572: "Tuvalu", 574: "Vietnam", 576: "Vanuatu", 577: "Vanuatu", 578: "Wallis und Futuna",
  601: "Südafrika", 603: "Angola", 605: "Algerien", 609: "Burundi", 610: "Benin", 611: "Botswana", 613: "Kamerun", 615: "Kongo",
  616: "Komoren", 617: "Kap Verde", 619: "Elfenbeinküste", 620: "Komoren", 621: "Dschibuti", 622: "Ägypten", 624: "Äthiopien",
  625: "Eritrea", 626: "Gabun", 627: "Ghana", 629: "Gambia", 630: "Guinea-Bissau", 631: "Äquatorialguinea", 632: "Guinea",
  634: "Kenia", 636: "Liberia", 637: "Liberia", 642: "Libyen", 644: "Lesotho", 645: "Mauritius", 647: "Madagaskar", 649: "Mali",
  650: "Mosambik", 654: "Mauretanien", 655: "Malawi", 656: "Niger", 657: "Nigeria", 659: "Namibia", 661: "Ruanda", 662: "Sudan",
  663: "Senegal", 664: "Seychellen", 665: "St. Helena", 666: "Somalia", 667: "Sierra Leone", 668: "São Tomé", 669: "Eswatini",
  670: "Tschad", 671: "Togo", 672: "Tunesien", 674: "Tansania", 675: "Uganda", 676: "DR Kongo", 677: "Tansania", 678: "Sambia",
  679: "Simbabwe", 701: "Argentinien", 710: "Brasilien", 720: "Bolivien", 725: "Chile", 730: "Kolumbien", 735: "Ecuador",
  740: "Falklandinseln", 745: "Französisch-Guayana", 750: "Guyana", 755: "Paraguay", 760: "Peru", 765: "Suriname", 770: "Uruguay",
  775: "Venezuela",
};
function flagge(mmsi) {
  const s = String(mmsi);
  if (s.length !== 9) return "";
  if (s.startsWith("111")) return "Such- und Rettungsflugzeug";
  if (s.startsWith("970")) return "Notsender (AIS-SART)";
  if (s.startsWith("99")) return "Seezeichen / Tonne";
  const mid = Number(/^0/.test(s) ? s.slice(1, 4) : s.slice(0, 3));
  return MID[mid] || "";
}

const clean = (s) => String(s || "").replace(/@+/g, "").replace(/\s+/g, " ").trim();

function merke(msg) {
  const meta = msg.MetaData || {};
  const mmsi = Number(meta.MMSI || meta.MMSI_String);
  if (!mmsi) return;
  nachrichten++;
  let v = vessels.get(mmsi);
  const typ = msg.MessageType;
  const m = msg.Message?.[typ] || {};
  if (!v) {
    if (typ !== "PositionReport" && typ !== "StandardClassBPositionReport" && typ !== "ExtendedClassBPositionReport") {
      // Stammdaten ohne Position: trotzdem merken, Position kommt gleich
      if (meta.latitude == null) return;
    }
    v = { mmsi, spur: [] };
    vessels.set(mmsi, v);
  }
  if (meta.ShipName && !v.name) v.name = clean(meta.ShipName);
  if (typ === "PositionReport" || typ === "StandardClassBPositionReport" || typ === "ExtendedClassBPositionReport") {
    const lat = m.Latitude, lon = m.Longitude;
    if (typeof lat !== "number" || typeof lon !== "number" || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
    const jetzt = Date.now();
    // Spur: höchstens alle 3 Minuten einen Punkt, max. 40 Punkte
    const letzte = v.spur[v.spur.length - 1];
    if (!letzte || jetzt - letzte[2] > 180000) { v.spur.push([+lat.toFixed(4), +lon.toFixed(4), jetzt]); if (v.spur.length > 40) v.spur.shift(); }
    v.lat = lat; v.lon = lon;
    v.sog = m.Sog != null && m.Sog < 102.3 ? m.Sog : null;
    v.cog = m.Cog != null && m.Cog < 360 ? m.Cog : null;
    v.hdg = m.TrueHeading != null && m.TrueHeading < 360 ? m.TrueHeading : null;
    if (typ === "PositionReport") { v.nav = m.NavigationalStatus; v.klasse = "A"; } else v.klasse = "B";
    v.at = jetzt;
    if (typ === "ExtendedClassBPositionReport") {
      if (m.Name) v.name = clean(m.Name);
      if (m.Type) v.t = m.Type;
      dim(v, m.Dimension);
    }
  } else if (typ === "ShipStaticData") {
    v.name = clean(m.Name) || v.name;
    if (m.Type) v.t = m.Type;
    v.ruf = clean(m.CallSign) || v.ruf;
    if (m.ImoNumber) v.imo = m.ImoNumber;
    v.ziel = clean(m.Destination);
    if (m.Eta && m.Eta.Month) v.eta = m.Eta;
    if (m.MaximumStaticDraught) v.tiefgang = m.MaximumStaticDraught;
    dim(v, m.Dimension);
    v.statAt = Date.now();
  } else if (typ === "StaticDataReport") {
    if (m.ReportA?.Valid && m.ReportA.Name) v.name = clean(m.ReportA.Name);
    if (m.ReportB?.Valid) {
      if (m.ReportB.ShipType) v.t = m.ReportB.ShipType;
      if (m.ReportB.CallSign) v.ruf = clean(m.ReportB.CallSign);
      dim(v, m.ReportB.Dimension);
    }
    v.statAt = Date.now();
  }
}
function dim(v, d) {
  if (!d) return;
  const l = (d.A || 0) + (d.B || 0), b = (d.C || 0) + (d.D || 0);
  if (l > 0 && l < 500) v.laenge = l;
  if (b > 0 && b < 80) v.breite = b;
}

// ---------- Verbindung ----------
export function startShips() {
  if (!config.aisKey) return; // kein Schlüssel, keine Schiffe
  ladeCache();
  connect();
  setInterval(prune, 60 * 1000);
  setInterval(speichereCache, 5 * 60 * 1000);
}

function connect() {
  try {
    ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
  } catch {
    return scheduleReconnect();
  }
  ws.on("open", () => {
    connected = true; retry = 0; gestartet = Date.now();
    ws.send(JSON.stringify({
      APIKey: config.aisKey,
      BoundingBoxes: [[[-90, -180], [90, 180]]], // die ganze Welt
      FilterMessageTypes: ["PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport", "ShipStaticData", "StaticDataReport"],
    }));
    console.log("AIS (Schiffe) verbunden – weltweit.");
  });
  ws.on("message", (buf) => {
    let msg; try { msg = JSON.parse(buf.toString()); } catch { return; }
    try { merke(msg); } catch { /* eine kaputte Meldung egal */ }
  });
  ws.on("close", () => { connected = false; scheduleReconnect(); });
  ws.on("error", () => { try { ws.close(); } catch { /* egal */ } });
}

function scheduleReconnect() {
  retry = Math.min(retry + 1, 6);
  setTimeout(connect, 2000 * retry);
}

function prune() {
  const grenze = Date.now() - MAX_ALTER_MS;
  for (const [k, v] of vessels) if (!v.at || v.at < grenze) vessels.delete(k);
}

function speichereCache() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify({ at: Date.now(), v: [...vessels.values()].filter((v) => v.at) }));
  } catch { /* nur Zwischenspeicher */ }
}
function ladeCache() {
  try {
    const d = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    if (Date.now() - d.at > MAX_ALTER_MS) return;
    for (const v of d.v || []) if (v.mmsi && v.at) vessels.set(v.mmsi, { spur: [], ...v });
  } catch { /* noch kein Zwischenspeicher */ }
}

// ---------- Abfragen ----------
// Schiffe in einem Bereich (lonMin,latMin,lonMax,latMax), größte zuerst (für die Satellitenkarte im Länder-Fenster).
export function getShips(lonMin, latMin, lonMax, latMax, limit = 80) {
  const out = [];
  for (const v of vessels.values()) {
    if (v.lat == null || v.lat < latMin || v.lat > latMax || v.lon < lonMin || v.lon > lonMax) continue;
    out.push({
      mmsi: v.mmsi, name: v.name || "Unbekannt", lat: v.lat, lon: v.lon,
      tempo_kn: v.sog != null ? Math.round(v.sog * 10) / 10 : null,
      kurs: v.cog != null ? Math.round(v.cog) : null,
      typ: shipType(v.t) || "Schiff", ziel: v.ziel || "", laenge_m: v.laenge || null,
    });
  }
  out.sort((a, b) => (b.laenge_m || 0) - (a.laenge_m || 0));
  return out.slice(0, limit);
}

// Alle Schiffe kompakt für den Globus: [mmsi, lat, lon, tempo_kn, kurs, gruppe, name, laenge]
let alleCache = null;
export function getAlleSchiffe() {
  if (alleCache && Date.now() - alleCache.at < 20000) return alleCache;
  const grenze = Date.now() - MAX_ALTER_MS;
  const liste = [];
  for (const v of vessels.values()) {
    if (v.lat == null || !v.at || v.at < grenze) continue;
    const kurs = v.cog ?? v.hdg;
    liste.push([v.mmsi, +v.lat.toFixed(4), +v.lon.toFixed(4), v.sog != null ? Math.round(v.sog * 10) / 10 : null,
      kurs != null ? Math.round(kurs) : null, GRUPPE_NR[gruppeVon(v.t)], v.name || "", v.laenge || 0]);
  }
  const json = JSON.stringify({ stand: new Date().toISOString(), aktiv: Boolean(config.aisKey), verbunden: connected, gruppen: SCHIFF_GRUPPEN, schiffe: liste });
  alleCache = { at: Date.now(), json, gz: zlib.gzipSync(json, { level: 6 }), anzahl: liste.length };
  return alleCache;
}

function etaText(e) {
  if (!e || !e.Month || !e.Day || e.Month > 12 || e.Day > 31) return "";
  const h = e.Hour < 24 ? String(e.Hour).padStart(2, "0") : "--", min = e.Minute < 60 ? String(e.Minute).padStart(2, "0") : "--";
  return `${String(e.Day).padStart(2, "0")}.${String(e.Month).padStart(2, "0")}. ${h}:${min} Uhr (UTC)`;
}

export function getSchiff(mmsiRoh) {
  const mmsi = Number(mmsiRoh);
  const v = vessels.get(mmsi);
  if (!v) return null;
  const g = gruppeVon(v.t);
  return {
    mmsi, name: v.name || "Unbekannt", lat: v.lat, lon: v.lon,
    tempo_kn: v.sog != null ? Math.round(v.sog * 10) / 10 : null, tempo_kmh: v.sog != null ? Math.round(v.sog * 1.852 * 10) / 10 : null,
    kurs: v.cog != null ? Math.round(v.cog) : null, bug: v.hdg ?? null,
    status: v.nav != null ? NAV_STATUS[v.nav] || "" : "",
    gruppe: g, gruppe_name: SCHIFF_GRUPPEN[GRUPPE_NR[g]].name, typ: typText(v.t) || "noch unbekannt",
    flagge: flagge(mmsi), imo: v.imo || null, rufzeichen: v.ruf || "",
    laenge_m: v.laenge || null, breite_m: v.breite || null, tiefgang_m: v.tiefgang || null,
    ziel: v.ziel || "", ankunft: etaText(v.eta), klasse: v.klasse === "A" ? "A (Berufsschifffahrt)" : v.klasse === "B" ? "B (kleinere Schiffe)" : "",
    letzte_meldung: v.at ? new Date(v.at).toISOString() : null,
    spur: (v.spur || []).map(([la, lo]) => [la, lo]),
    mehr: v.imo ? `https://www.vesselfinder.com/vessels/details/${v.imo}` : `https://www.vesselfinder.com/vessels/details/${mmsi}`,
  };
}

// Suche (Name, MMSI, IMO, Rufzeichen, Ziel) – für Sprache
export function sucheSchiff(q) {
  const t = String(q || "").trim().toUpperCase();
  if (!t) return null;
  const nr = /^\d{7,9}$/.test(t) ? Number(t) : 0;
  let best = null;
  for (const v of vessels.values()) {
    if (v.lat == null) continue;
    if (nr && (v.mmsi === nr || v.imo === nr)) return v;
    const n = v.name || "";
    if (n === t) return v;
    if (!best && n.startsWith(t)) best = v;
  }
  if (best) return best;
  for (const v of vessels.values()) if (v.lat != null && (v.name || "").includes(t)) return v;
  return null;
}

export function shipsZahlen() {
  const z = {};
  for (const v of vessels.values()) if (v.lat != null) { const g = gruppeVon(v.t); z[g] = (z[g] || 0) + 1; }
  return { anzahl: Object.values(z).reduce((a, b) => a + b, 0), gruppen: SCHIFF_GRUPPEN.map((g) => ({ ...g, anzahl: z[g.id] || 0 })) };
}

export function shipsStatus() {
  return { aktiv: Boolean(config.aisKey), verbunden: connected, schiffe: vessels.size, seit: gestartet ? new Date(gestartet).toISOString() : null, nachrichten };
}

export function schiffeRouten(app, asyncRoute) {
  app.get("/api/schiffe", asyncRoute(async (req, res) => {
    const k = getAlleSchiffe();
    res.set("Cache-Control", "no-store");
    res.set("Vary", "Accept-Encoding");
    if (/\bgzip\b/.test(req.headers["accept-encoding"] || "")) res.set("Content-Encoding", "gzip").type("application/json").send(k.gz);
    else res.type("application/json").send(k.json);
  }));
  app.get("/api/schiffe/:mmsi", asyncRoute(async (req, res) => {
    const s = getSchiff(req.params.mmsi);
    if (!s) return res.status(404).json({ error: "Dieses Schiff meldet sich gerade nicht." });
    res.json(s);
  }));
  // Mehr zum Schiff aus freien Quellen: Ziel-Hafen, Foto + Text (Wikidata/Wikipedia), Links
  app.get("/api/schiffe/:mmsi/extra", asyncRoute(async (req, res) => {
    const s = getSchiff(req.params.mmsi);
    if (!s) return res.status(404).json({ error: "Dieses Schiff meldet sich gerade nicht." });
    res.json(await schiffExtra(s));
  }));
  // Häfen in der Nähe (UN/LOCODE), für die Häfen-Ebene beim Hineinzoomen
  app.get("/api/haefen", asyncRoute(async (req, res) => {
    const lat = Number(req.query.lat), lon = Number(req.query.lon), r = Math.min(3000, Math.max(50, Number(req.query.r) || 800));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: "lat/lon fehlen" });
    res.set("Cache-Control", "private, max-age=86400");
    res.json({ haefen: haefenUm(lat, lon, r, 400) });
  }));
}

// ---------- Sprachbefehle ohne Claude ----------
// "zeig mir alle Schiffe", "wie viele Schiffe sind unterwegs", "zeig mir die Tanker",
// "zeig mir das Schiff Queen Mary 2", "wo ist das Schiff Ever Given"
const SCHIFF_WORTE = [
  [/\btanker\b/, "tanker"], [/\b(frachter|containerschiff|frachtschiff)/, "fracht"],
  [/\b(kreuzfahrt|fähre|faehre|passagierschiff)/, "passagier"], [/\b(fischer|fischkutter|fischerboot)/, "fischerei"],
  [/\b(schlepper|lotsen)/, "hafen"], [/\b(segelboot|segler|yacht|jacht|sportboot)/, "freizeit"],
  [/\b(seenotrett|küstenwache|kuestenwache|polizeiboot|marine|kriegsschiff)/, "behoerde"],
];
export function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/[?!.]+$/, "").trim();
  if (!t || !/(schiff|tanker|frachter|fähre|faehre|yacht|jacht|segelboot|fischkutter|kreuzfahrt|schlepper)/.test(t)) return null;
  const zeig = /\b(zeig|zeige|zeigen|öffne|oeffne|finde|such|suche|wo ist|wo sind)\b/.test(t);
  if (!config.aisKey && (zeig || /wie ?viele/.test(t))) {
    return { answer: "Für Live-Schiffe brauche ich einen kostenlosen Schlüssel von aisstream.io. Trag ihn als AISSTREAM_API_KEY in die .env ein.", actions: ["weltgeschehen"] };
  }
  if (/\bwie ?viele\b/.test(t) && /schiff/.test(t)) {
    const z = shipsZahlen();
    const top = z.gruppen.filter((g) => g.anzahl && g.id !== "sonst").sort((a, b) => b.anzahl - a.anzahl).slice(0, 3);
    return {
      answer: `Ich empfange gerade ${z.anzahl.toLocaleString("de-DE")} Schiffe weltweit${top.length ? ", vor allem " + top.map((g) => `${g.name} (${g.anzahl.toLocaleString("de-DE")})`).join(", ") : ""}. Auf hoher See fehlen viele, weil dort kein öffentlicher Empfänger mithört.`,
      actions: ["weltgeschehen", "schiffe"],
    };
  }
  if (!zeig) return null;
  const m = t.match(/\b(?:das |dem |den )?schiff(?:es)?\s+(?:namens\s+)?(.{2,40})$/);
  if (m && !/^(an|im|in|auf|zeig|alle|weltweit|von)\b/.test(m[1])) {
    const v = sucheSchiff(m[1]);
    if (!v) return { answer: `Ein Schiff namens ${m[1]} empfange ich gerade nicht. Vielleicht ist es außer Reichweite der Empfänger.`, actions: ["weltgeschehen", "schiffe"] };
    const d = getSchiff(v.mmsi);
    const art = d.typ !== "noch unbekannt" ? `ein ${d.typ}` : "ein Schiff";
    const fahrt = d.tempo_kn != null && d.tempo_kn > 0.5 ? ` Sie fährt mit ${Math.round(d.tempo_kmh)} Kilometern pro Stunde${d.ziel ? " Richtung " + d.ziel : ""}.` : d.status ? ` Sie ${d.status}.` : "";
    return { answer: `Hier ist die ${d.name}, ${art}${d.flagge ? " unter der Flagge von " + d.flagge : ""}.${fahrt}`, actions: ["weltgeschehen", `schiff:${v.mmsi}`] };
  }
  for (const [re, gid] of SCHIFF_WORTE) {
    if (!re.test(t)) continue;
    const z = shipsZahlen();
    const g = z.gruppen.find((x) => x.id === gid);
    return { answer: `Ich zeige dir ${g.name}: gerade ${g.anzahl.toLocaleString("de-DE")} empfangen. ${g.info}`, actions: ["weltgeschehen", `schiffgruppe:${gid}`] };
  }
  if (/schiff/.test(t)) {
    const z = shipsZahlen();
    return { answer: `Hier sind alle ${z.anzahl.toLocaleString("de-DE")} Schiffe, die ich gerade weltweit empfange. Tipp eins an für den Steckbrief.`, actions: ["weltgeschehen", "schiffe"] };
  }
  return null;
}
