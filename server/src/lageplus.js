// Lage-Plus (v1.126.0): neun weitere Ebenen fürs Weltgeschehen, angeregt von OSINT-Karten wie Argos Atlas.
// Eigene Friday-Umsetzung, nur freie, öffentliche Quellen ohne Schlüssel:
//   adsb.lol (Flugzeuge mit Notfall-Code), IMF PortWatch (Meerengen + Häfen), Auswärtiges Amt OpenData
//   (Reisewarnungen), NOAA NHC (Hurrikane + Vorhersage-Kegel), WHO Disease Outbreak News (Ausbrüche),
//   WRI Global Power Plant Database (Atomkraftwerke), OurAirports (große Flughäfen), Safecast (Strahlung),
//   Weltbank WGI (politische Stabilität). Dazu zwei eigene Auswertungen: Brennpunkt-Melder und Stabilitäts-Wert.
// Bewusst NICHT dabei: einzelne Personen, Privatjets oder Yachten verfolgen, Schiffe mit abgeschaltetem Sender jagen.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config.js";
import { COUNTRIES, findCountry, getQuakes, getEonet, getAlarm, resetInfraCache } from "./lagezentrum.js";
import { getKonflikte, getInternet } from "./lagebild.js";
import { findeLand } from "./laenderinfo.js";

const UA = { "User-Agent": "F.R.Ai.D.A.Y/1.0 (privater Assistent)" };
const cache = new Map();
async function cached(key, ms, fn) {
  const c = cache.get(key);
  if (c && Date.now() - c.at < ms) return c.data;
  try {
    const data = await fn();
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    if (c) return c.data; // lieber alte Daten als keine
    throw err;
  }
}
async function hol(url, ms = 20000, art = "json") {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return art === "text" ? r.text() : r.json();
}
const byCca2 = new Map(COUNTRIES.filter((c) => c.cca2).map((c) => [c.cca2.toUpperCase(), c]));
const kurz = (c) => c ? { id: c.id, land: c.name, flag: c.flag || "", lat: c.lat, lon: c.lon } : null;

// Nächstes Land zu einer Koordinate (grob über den Landesmittelpunkt, für Brennpunkte reicht das).
function naechstesLand(lon, lat, maxGrad = 9) {
  let best = null, bestD = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const c of COUNTRIES) {
    const d = Math.hypot((c.lon - lon) * k, c.lat - lat);
    if (d < bestD) { bestD = d; best = c; }
  }
  return bestD <= maxGrad ? best : null;
}
// Land aus einem englischen Ortstext ("45 km SW of Hualien, Taiwan").
const vereinheitlichen = (s) => String(s || "").replace(/democratic republic of (the )?congo/gi, "DR Congo").replace(/\bUSA\b|United States of America/g, "United States");
function landAusText(txt) {
  const t = vereinheitlichen(txt).toLowerCase();
  if (!t) return null;
  const hits = COUNTRIES.filter((c) => c.en && new RegExp(`\\b${c.en.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t));
  return hits.sort((a, b) => b.en.length - a.en.length)[0] || null;
}

// ---------- 1. Flugzeuge mit Notfall-Code (adsb.lol, öffentliches ADS-B) ----------
const SQUAWK = { "7700": "Notfall", "7600": "Funkausfall" };
export function getNotflug() {
  return cached("notflug", 60 * 1000, async () => {
    const listen = await Promise.all(Object.keys(SQUAWK).map((s) => hol(`https://api.adsb.lol/v2/sqk/${s}`, 12000).then((d) => d.ac || []).catch(() => null)));
    if (listen.every((l) => l === null)) throw new Error("adsb.lol nicht erreichbar");
    const flugzeuge = [];
    const seen = new Set();
    for (const a of listen.flat().filter(Boolean)) {
      if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon) || seen.has(a.hex)) continue;
      seen.add(a.hex);
      const sq = String(a.squawk || "");
      const land = naechstesLand(a.lon, a.lat, 6);
      flugzeuge.push({
        hex: a.hex, rufzeichen: String(a.flight || "").trim(), kennung: a.r || "", typ: a.desc || a.t || "",
        squawk: sq, art: SQUAWK[sq] || "Notfall", lat: a.lat, lon: a.lon,
        hoehe_m: Number.isFinite(a.alt_baro) ? Math.round(a.alt_baro * 0.3048) : a.alt_baro === "ground" ? 0 : null,
        tempo_kmh: Number.isFinite(a.gs) ? Math.round(a.gs * 1.852) : null, kurs: Number.isFinite(a.track) ? Math.round(a.track) : null,
        nahe: land ? land.name : "",
      });
    }
    return { flugzeuge, stand: new Date().toISOString(), quelle: "adsb.lol (öffentliches ADS-B, ODbL)", hinweis: "Code 7700 = Notfall, 7600 = Funkausfall. Oft harmlos (Übung, technische Vorsicht), selten echte Gefahr." };
  });
}

// ---------- 2. Meerengen-Verkehr (IMF PortWatch, Satelliten-AIS ausgewertet) ----------
const PW = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services";
const ENGE_DE = {
  "Suez Canal": "Suezkanal", "Panama Canal": "Panamakanal", "Bosporus Strait": "Bosporus", "Bab el-Mandeb Strait": "Bab el-Mandeb (Rotes Meer)",
  "Malacca Strait": "Straße von Malakka", "Strait of Hormuz": "Straße von Hormus", "Cape of Good Hope": "Kap der Guten Hoffnung",
  "Gibraltar Strait": "Straße von Gibraltar", "Dover Strait": "Straße von Dover", "Oresund Strait": "Öresund", "Taiwan Strait": "Taiwanstraße",
  "Korea Strait": "Koreastraße", "Tsugaru Strait": "Tsugaru-Straße", "Luzon Strait": "Luzonstraße", "Lombok Strait": "Lombokstraße",
  "Sunda Strait": "Sundastraße", "Makassar Strait": "Makassarstraße", "Torres Strait": "Torresstraße", "Bering Strait": "Beringstraße",
  "Magellan Strait": "Magellanstraße", "Kerch Strait": "Straße von Kertsch", "Mona Passage": "Mona-Passage", "Yucatan Channel": "Yucatán-Straße",
  "Windward Passage": "Windward-Passage", "Ombai Strait": "Ombai-Straße", "Balabac Strait": "Balabac-Straße", "Mindoro Strait": "Mindoro-Straße",
  "Bohai Strait": "Bohai-Straße",
};
const tag = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
export function getMeerengen() {
  return cached("meerengen", 3 * 3600 * 1000, async () => {
    const orte = await cached("meerengen-orte", 7 * 86400 * 1000, async () => {
      const d = await hol(`${PW}/PortWatch_chokepoints_database/FeatureServer/0/query?where=1%3D1&outFields=portid,portname,lat,lon&f=json`);
      return (d.features || []).map((f) => f.attributes);
    });
    const zeilen = [];
    // Bis zu 2000 Zeilen je Abfrage: 45 Tage × ~28 Meerengen passen in eine Abfrage, sicherheitshalber blättern.
    for (let off = 0; off < 6000; off += 2000) {
      const d = await hol(`${PW}/Daily_Chokepoints_Data/FeatureServer/0/query?where=${encodeURIComponent(`date >= DATE '${tag(46)}'`)}&outFields=date,portid,n_total,n_tanker,n_container,n_cargo&orderByFields=date%20ASC&resultOffset=${off}&resultRecordCount=2000&f=json`, 25000);
      zeilen.push(...(d.features || []).map((f) => f.attributes));
      if (!d.exceededTransferLimit) break;
    }
    const proOrt = new Map();
    for (const z of zeilen) { if (!proOrt.has(z.portid)) proOrt.set(z.portid, []); proOrt.get(z.portid).push(z); }
    const schnitt = (l) => l.length ? l.reduce((s, z) => s + (z.n_total || 0), 0) / l.length : null;
    const engen = [];
    for (const o of orte) {
      const l = (proOrt.get(o.portid) || []).sort((a, b) => String(a.date).localeCompare(String(b.date)));
      if (!l.length || !Number.isFinite(o.lat)) continue;
      const letzte = l.at(-1);
      const woche = schnitt(l.slice(-7));
      const vorher = schnitt(l.slice(-37, -7));
      const trend = woche != null && vorher ? Math.round((woche / vorher - 1) * 100) : null;
      engen.push({
        id: o.portid, name: ENGE_DE[o.portname] || o.portname, name_en: o.portname, lat: o.lat, lon: o.lon,
        datum: letzte.date, heute: letzte.n_total, tanker: letzte.n_tanker, container: letzte.n_container,
        schnitt7: woche != null ? Math.round(woche) : null, schnitt30: vorher != null ? Math.round(vorher) : null, trend_prozent: trend,
        verlauf: l.slice(-30).map((z) => z.n_total || 0),
        stufe: trend == null ? "normal" : trend <= -25 ? "stark" : trend <= -10 ? "weniger" : trend >= 15 ? "mehr" : "normal",
      });
    }
    engen.sort((a, b) => (b.schnitt7 || 0) - (a.schnitt7 || 0));
    return { engen, stand: new Date().toISOString(), quelle: "IMF PortWatch (Satelliten-AIS, täglich, einige Tage Verzug)" };
  });
}

// ---------- 3. Reisewarnungen (Auswärtiges Amt, OpenData) ----------
export function getReisewarnungen() {
  return cached("reise", 6 * 3600 * 1000, async () => {
    const d = await hol("https://www.auswaertiges-amt.de/opendata/travelwarning", 20000);
    const laender = [];
    for (const [nr, v] of Object.entries(d.response || {})) {
      if (!v || typeof v !== "object" || !v.countryCode) continue;
      const c = byCca2.get(String(v.countryCode).toUpperCase());
      if (!c) continue;
      const stufe = v.warning ? "warnung" : v.partialWarning ? "teilwarnung" : v.situationWarning ? "hinweis" : v.situationPartWarning ? "teilhinweis" : "keine";
      laender.push({
        ...kurz(c), nr, stufe,
        text: { warnung: "Reisewarnung", teilwarnung: "Teil-Reisewarnung", hinweis: "Sicherheitshinweis", teilhinweis: "Teil-Sicherheitshinweis", keine: "keine Warnung" }[stufe],
        stand: v.lastModified ? new Date(v.lastModified * 1000).toISOString() : null,
      });
    }
    const rang = { warnung: 4, teilwarnung: 3, hinweis: 2, teilhinweis: 1, keine: 0 };
    laender.sort((a, b) => rang[b.stufe] - rang[a.stufe] || a.land.localeCompare(b.land, "de"));
    return {
      laender, warnungen: laender.filter((l) => l.stufe === "warnung").length, teilwarnungen: laender.filter((l) => l.stufe === "teilwarnung").length,
      link: "https://www.auswaertiges-amt.de/de/ReiseUndSicherheit/10.2.8Reisewarnungen", stand: new Date().toISOString(), quelle: "Auswärtiges Amt (OpenData)",
    };
  });
}
export async function reisewarnungFuer(country) {
  const d = await getReisewarnungen().catch(() => null);
  return d?.laender.find((l) => l.id === country.id) || null;
}

// ---------- 4. Hurrikane mit Vorhersage-Kegel (NOAA National Hurricane Center) ----------
const NHC_MAP = "https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer";
const KLASSE = { HU: "Hurrikan", MH: "starker Hurrikan", TS: "Tropensturm", TD: "Tropisches Tief", STS: "Subtropischer Sturm", STD: "Subtropisches Tief", PTC: "möglicher Tropensturm", PC: "Post-Tropisch" };
const runde = (ring) => ring.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
export function getHurrikane() {
  return cached("hurrikane", 20 * 60 * 1000, async () => {
    const d = await hol("https://www.nhc.noaa.gov/CurrentStorms.json", 15000);
    const aktiv = d.activeStorms || [];
    let ebenen = [];
    if (aktiv.length) ebenen = (await hol(`${NHC_MAP}?f=json`, 15000).catch(() => ({ layers: [] }))).layers || [];
    const stuerme = await Promise.all(aktiv.map(async (s) => {
      const bin = s.binNumber || "";
      const sturm = {
        id: s.id, name: s.name, klasse: KLASSE[s.classification] || s.classification || "Sturm",
        lat: Number(s.latitudeNumeric), lon: Number(s.longitudeNumeric),
        wind_kmh: Number.isFinite(+s.intensity) ? Math.round(+s.intensity * 1.852) : null, druck_hpa: Number(s.pressure) || null,
        richtung: s.movementDir ?? null, tempo_kmh: Number.isFinite(+s.movementSpeed) ? Math.round(+s.movementSpeed * 1.609) : null,
        stand: s.lastUpdate || null, link: s.publicAdvisory?.url || "https://www.nhc.noaa.gov/", kegel: [], spur: [],
      };
      const kegel = ebenen.find((l) => l.name === `${bin} Forecast Cone`);
      const spur = ebenen.find((l) => l.name === `${bin} Forecast Track`);
      try {
        if (kegel) {
          const g = await hol(`${NHC_MAP}/${kegel.id}/query?where=1%3D1&outSR=4326&f=geojson`, 15000);
          for (const f of g.features || []) {
            const geo = f.geometry;
            const polys = geo?.type === "Polygon" ? [geo.coordinates] : geo?.type === "MultiPolygon" ? geo.coordinates : [];
            for (const p of polys) sturm.kegel.push(p.map(runde));
          }
        }
        if (spur) {
          const g = await hol(`${NHC_MAP}/${spur.id}/query?where=1%3D1&outSR=4326&f=geojson`, 15000);
          for (const f of g.features || []) {
            const geo = f.geometry;
            if (geo?.type === "LineString") sturm.spur.push(...runde(geo.coordinates));
            if (geo?.type === "MultiLineString") for (const l of geo.coordinates) sturm.spur.push(...runde(l));
          }
        }
      } catch { /* Kegel ist optional, der Sturm selbst reicht */ }
      return sturm;
    }));
    return { stuerme: stuerme.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon)), stand: new Date().toISOString(), quelle: "NOAA National Hurricane Center (Atlantik + Ostpazifik)" };
  });
}

// ---------- 5. Krankheits-Ausbrüche (WHO Disease Outbreak News) ----------
const KRANKHEIT_DE = [
  [/ebola/i, "Ebola"], [/marburg/i, "Marburg-Fieber"], [/cholera/i, "Cholera"], [/mpox|monkeypox/i, "Mpox (Affenpocken)"],
  [/avian influenza|bird flu|h5n1|h5n|h7n9|h9n2/i, "Vogelgrippe"], [/influenza/i, "Grippe (neuer Typ)"], [/mers|middle east respiratory/i, "MERS"],
  [/dengue/i, "Dengue-Fieber"], [/chikungunya/i, "Chikungunya"], [/yellow fever/i, "Gelbfieber"], [/measles/i, "Masern"], [/polio/i, "Kinderlähmung (Polio)"],
  [/nipah/i, "Nipah-Virus"], [/lassa/i, "Lassa-Fieber"], [/plague/i, "Pest"], [/anthrax/i, "Milzbrand"], [/diphtheria/i, "Diphtherie"],
  [/meningitis|meningococcal/i, "Meningitis"], [/zika/i, "Zika-Virus"], [/oropouche/i, "Oropouche-Fieber"], [/rift valley/i, "Rifttalfieber"],
  [/crimean|cchf/i, "Krim-Kongo-Fieber"], [/hepatitis/i, "Hepatitis"], [/covid|sars-cov/i, "Covid-19"], [/west nile/i, "West-Nil-Fieber"],
];
export function getAusbrueche() {
  return cached("ausbrueche", 3 * 3600 * 1000, async () => {
    const d = await hol("https://www.who.int/api/news/diseaseoutbreaknews?$top=40&$orderby=PublicationDate%20desc&$select=Title,PublicationDate,UrlName,DonId", 20000);
    const grenze = Date.now() - 120 * 86400000;
    const meldungen = [];
    for (const m of d.value || []) {
      const zeit = Date.parse(m.PublicationDate);
      if (!Number.isFinite(zeit) || zeit < grenze) continue;
      const titel = String(m.Title || "");
      const teile = titel.split(/\s[-–—]\s|,\s(?=[A-Z])/);
      const ortText = vereinheitlichen(teile.length > 1 ? teile.slice(1).join(", ") : titel);
      const laender = COUNTRIES.filter((c) => c.en && new RegExp(`\\b${c.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(ortText));
      // "Democratic Republic of the Congo" enthält auch "Congo": längere Namen schlagen kürzere.
      const sauber = laender.filter((c) => !laender.some((o) => o !== c && o.en.length > c.en.length && o.en.toLowerCase().includes(c.en.toLowerCase())));
      const krankheit = KRANKHEIT_DE.find(([re]) => re.test(teile[0]))?.[1] || teile[0].trim();
      meldungen.push({
        titel, krankheit, zeit: new Date(zeit).toISOString(), link: `https://www.who.int/emergencies/disease-outbreak-news/item/${encodeURIComponent(m.UrlName || m.DonId || "")}`,
        laender: sauber.map(kurz), weltweit: !sauber.length && /global|multi-country|worldwide/i.test(titel),
      });
    }
    return { meldungen, stand: new Date().toISOString(), quelle: "Weltgesundheitsorganisation WHO (Disease Outbreak News)", hinweis: "Offizielle WHO-Meldungen der letzten 4 Monate. Eine Meldung heißt nicht, dass Reisen gefährlich ist." };
  });
}

// ---------- 6. Infrastruktur: Atomkraftwerke, große Häfen, Flughäfen + Kraftwerke ----------
const INFRA = (n) => path.join(DATA_DIR, n);
function schreibe(n, d) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(INFRA(n), JSON.stringify(d)); }
function lies(n) { try { return JSON.parse(fs.readFileSync(INFRA(n), "utf8")); } catch { return null; } }
function alt(n, tage) { try { return Date.now() - fs.statSync(INFRA(n)).mtimeMs > tage * 86400000; } catch { return true; } }
// Einfacher CSV-Leser (Felder mit Anführungszeichen und Kommas).
function csv(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(f); f = ""; }
    else if (ch === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (ch !== "\r") f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const kopf = rows.shift() || [];
  return rows.map((r) => Object.fromEntries(kopf.map((k, i) => [k, r[i]])));
}
const BRENNSTOFF = { Nuclear: "Atom", Coal: "Kohle", Gas: "Gas", Hydro: "Wasser", Oil: "Öl", Wind: "Wind", Solar: "Solar", Biomass: "Biomasse", Geothermal: "Geothermie", Waste: "Müll", Storage: "Speicher", Other: "Sonstige" };
let infraLaeuft = null;
// Lädt fehlende Infrastruktur-Dateien einmal herunter (beim Start und wöchentlich). Friday läuft auch ohne.
export function bereiteInfraVor() {
  if (infraLaeuft) return infraLaeuft;
  infraLaeuft = (async () => {
    if (alt("infra-atom.json", 30) || !lies("powerplants.json")) {
      try {
        const rows = csv(await hol("https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv", 60000, "text"));
        const atom = rows.filter((r) => r.primary_fuel === "Nuclear").map((r) => ({ n: r.name, lat: +(+r.latitude).toFixed(3), lon: +(+r.longitude).toFixed(3), mw: Math.round(+r.capacity_mw), land: r.country_long, seit: r.commissioning_year ? Math.round(+r.commissioning_year) : null })).filter((r) => Number.isFinite(r.lat));
        schreibe("infra-atom.json", atom);
        if (!lies("powerplants.json")) {
          const gross = rows.filter((r) => +r.capacity_mw >= 1500).map((r) => ({ n: r.name, lat: +(+r.latitude).toFixed(3), lon: +(+r.longitude).toFixed(3), f: BRENNSTOFF[r.primary_fuel] || r.primary_fuel, mw: Math.round(+r.capacity_mw) })).sort((a, b) => b.mw - a.mw);
          schreibe("powerplants.json", gross);
        }
      } catch (err) { console.error("Lage-Plus Kraftwerke:", err.message); }
    }
    if (!lies("airports.json")) {
      try {
        const rows = csv(await hol("https://davidmegginson.github.io/ourairports-data/airports.csv", 60000, "text"));
        schreibe("airports.json", rows.filter((r) => r.type === "large_airport" && r.scheduled_service === "yes").map((r) => ({ n: r.name, lat: +(+r.latitude_deg).toFixed(3), lon: +(+r.longitude_deg).toFixed(3), iata: r.iata_code || "" })));
      } catch (err) { console.error("Lage-Plus Flughäfen:", err.message); }
    }
    if (alt("infra-haefen.json", 30)) {
      try {
        const d = await hol(`${PW}/PortWatch_ports_database/FeatureServer/0/query?where=1%3D1&outFields=portname,country,lat,lon,vessel_count_total,vessel_count_tanker,vessel_count_container&orderByFields=vessel_count_total%20DESC&resultRecordCount=250&f=json`, 30000);
        schreibe("infra-haefen.json", (d.features || []).map((f) => f.attributes).filter((a) => Number.isFinite(a.lat)).map((a) => ({ n: a.portname, land: a.country, lat: +a.lat.toFixed(3), lon: +a.lon.toFixed(3), schiffe: a.vessel_count_total, tanker: a.vessel_count_tanker, container: a.vessel_count_container })));
      } catch (err) { console.error("Lage-Plus Häfen:", err.message); }
    }
    resetInfraCache();
  })().finally(() => { setTimeout(() => { infraLaeuft = null; }, 7 * 86400000).unref?.(); });
  return infraLaeuft;
}
export async function getInfraPlus(typ) {
  const datei = { atom: "infra-atom.json", haefen: "infra-haefen.json" }[typ];
  if (!datei) return [];
  let d = lies(datei);
  if (!d) { await bereiteInfraVor().catch(() => null); d = lies(datei); }
  return d || [];
}

// ---------- 7. Strahlung (Safecast, freies Bürger-Messnetz) ----------
// Letzter Messwert jedes festen Safecast-Geräts. Geiger-Zähler in cpm → µSv/h je Röhrentyp.
const ROEHRE = { lnd_7318u: 334, lnd_7318c: 334, lnd_7317: 334, lnd_712u: 108, lnd_712c: 108, lnd_7128ec: 108, lnd_78017w: 334 };
export function getStrahlung() {
  return cached("strahlung", 60 * 60 * 1000, async () => {
    const d = await hol("https://tt.safecast.org/devices", 30000);
    const grenze = Date.now() - 72 * 3600 * 1000;
    const punkte = [];
    for (const g of Array.isArray(d) ? d : []) {
      const zeit = Date.parse(g.when_captured || "");
      if (!Number.isFinite(zeit) || zeit < grenze || !Number.isFinite(g.loc_lat) || !Number.isFinite(g.loc_lon)) continue;
      const k = Object.keys(ROEHRE).find((x) => Number.isFinite(g[x]) && g[x] > 0);
      if (!k) continue;
      const usv = Math.round((g[k] / ROEHRE[k]) * 1000) / 1000;
      if (usv > 100) continue; // offensichtlicher Messfehler
      punkte.push({ lat: +g.loc_lat.toFixed(3), lon: +g.loc_lon.toFixed(3), usv, ort: g.loc_name || "", land: g.loc_country || "", zeit: new Date(zeit).toISOString(), stufe: usv >= 1 ? "hoch" : usv >= 0.3 ? "erhoeht" : "normal" });
    }
    punkte.sort((a, b) => b.usv - a.usv);
    return { punkte: punkte.slice(0, 800), messungen: punkte.length, stand: new Date().toISOString(), quelle: "Safecast (Bürger-Messnetz, CC0)", hinweis: "Normal sind 0,05 bis 0,3 µSv/h. In Japan stehen viele Geräte bei Fukushima, dort sind leicht erhöhte Werte bekannt. Einzelne Geräte können falsch messen." };
  });
}

// ---------- 9. Stabilitäts-Wert je Land (Weltbank + aktuelle Lage, eigene Berechnung) ----------
const STUFE = (w) => w >= 70 ? "stabil" : w >= 50 ? "eher stabil" : w >= 30 ? "angespannt" : w >= 15 ? "instabil" : "sehr instabil";
function weltbank() {
  return cached("wgi", 7 * 86400 * 1000, async () => {
    const d = await hol("https://api.worldbank.org/v2/country/all/indicator/GOV_WGI_PV.EST?source=3&format=json&mrv=1&per_page=400", 30000);
    const m = new Map();
    for (const r of d?.[1] || []) if (r.value != null && r.country?.id) m.set(String(r.country.id).toUpperCase(), { wert: r.value, jahr: r.date });
    if (!m.size) throw new Error("Weltbank: keine Werte");
    return m;
  });
}
export async function getStabilitaet() {
  return cached("stabil", 30 * 60 * 1000, async () => {
    const [wgi, reise, netz] = await Promise.all([weltbank(), getReisewarnungen().catch(() => null), getInternet().catch(() => null)]);
    const kon = new Map(getKonflikte().laender.map((k) => [k.id, k]));
    const rw = new Map((reise?.laender || []).map((r) => [r.id, r]));
    const nz = new Map((netz?.stoerungen || []).filter((s) => s.aktiv).map((s) => [s.id, s]));
    const laender = [];
    for (const c of COUNTRIES) {
      const w = wgi.get(String(c.cca2 || "").toUpperCase());
      if (!w) continue;
      // Weltbank-Skala reicht praktisch von −2,5 (Syrien, Jemen) bis +1,6 (Island, Liechtenstein).
      const basis = Math.max(0, Math.min(100, ((w.wert + 2.5) / 4.1) * 100));
      const gruende = [];
      let abzug = 0;
      const k = kon.get(c.id);
      if (k) { const a = Math.min(15, 3 + k.meldungen); abzug += a; gruende.push(`${k.meldungen} Konflikt-Meldungen heute (−${a})`); }
      const r = rw.get(c.id);
      if (r?.stufe === "warnung") { abzug += 10; gruende.push("Reisewarnung (−10)"); }
      else if (r?.stufe === "teilwarnung") { abzug += 5; gruende.push("Teil-Reisewarnung (−5)"); }
      const n = nz.get(c.id);
      if (n) { const a = n.stufe === "stark" ? 6 : 3; abzug += a; gruende.push(`Internet-Störung (−${a})`); }
      const wert = Math.round(Math.max(0, Math.min(100, basis - abzug)));
      laender.push({ ...kurz(c), wert, stufe: STUFE(wert), basis: Math.round(basis), weltbank_jahr: w.jahr, gruende });
    }
    laender.sort((a, b) => a.wert - b.wert);
    return { laender, stand: new Date().toISOString(), quelle: "Friday-Berechnung: Weltbank (Politische Stabilität, WGI) + Konflikt-Meldungen, Reisewarnungen, Internet-Störungen", hinweis: "0 = sehr instabil, 100 = sehr stabil. Grobe Einschätzung, keine offizielle Bewertung." };
  });
}
export async function stabilitaetFuer(country) {
  const d = await getStabilitaet().catch(() => null);
  return d?.laender.find((l) => l.id === country.id) || null;
}

// ---------- 8. Brennpunkt-Melder: mehrere Ereignisse gleichzeitig in einem Land ----------
export async function getBrennpunkte() {
  return cached("brenn", 10 * 60 * 1000, async () => {
    const safe = (p) => Promise.race([p.catch(() => null), new Promise((r) => setTimeout(() => r(null), 8000))]);
    const [beben, eonet, alarm, netz, reise, aus, nf, hu] = await Promise.all([safe(getQuakes()), safe(getEonet()), safe(getAlarm()), safe(getInternet()), safe(getReisewarnungen()), safe(getAusbrueche()), safe(getNotflug()), safe(getHurrikane())]);
    const sig = new Map(); // id -> { land, signale: Map(art -> text) }
    const add = (c, art, text) => {
      if (!c) return;
      if (!sig.has(c.id)) sig.set(c.id, { c, signale: new Map() });
      const s = sig.get(c.id).signale;
      if (!s.has(art)) s.set(art, text);
    };
    for (const k of getKonflikte().laender) if (k.meldungen >= 3) add(findCountry(k.id), "konflikt", `${k.meldungen} Konflikt-Meldungen`);
    for (const s of netz?.stoerungen || []) if (s.aktiv) add(findCountry(s.id), "internet", `Internet-Störung (${s.stufe})`);
    for (const q of beben || []) if (q.staerke >= 5.5) add(landAusText(q.ort) || naechstesLand(q.lon, q.lat, 6), "beben", `Erdbeben M${q.staerke.toFixed(1)}`);
    for (const e of alarm?.ereignisse || []) {
      const c = landAusText(e.laender) || naechstesLand(e.lon, e.lat, 6);
      add(c, "katastrophe", `${e.titel || e.typ} (${e.stufe === "Red" ? "rot" : "orange"})`);
    }
    for (const f of (eonet?.stuerme || []).concat(eonet?.fluten || [])) add(naechstesLand(f.lon, f.lat, 4), "unwetter", f.titel || "Unwetter");
    for (const s of hu?.stuerme || []) add(naechstesLand(s.lon, s.lat, 5), "unwetter", `${s.klasse} ${s.name}`);
    for (const m of aus?.meldungen || []) if (Date.now() - Date.parse(m.zeit) < 30 * 86400000) for (const l of m.laender) add(findCountry(l.id), "ausbruch", `WHO: ${m.krankheit}`);
    for (const a of nf?.flugzeuge || []) if (a.squawk === "7700" && a.nahe) add(findCountry(a.nahe), "notflug", `Flugzeug im Notfall (${a.rufzeichen || a.kennung || a.hex})`);
    const rw = new Map((reise?.laender || []).map((r) => [r.id, r]));
    const punkte = [];
    for (const { c, signale } of sig.values()) {
      const r = rw.get(c.id);
      // Reisewarnung zählt nur als Verstärker, nicht als eigenes neues Ereignis.
      const n = signale.size;
      if (n < 2) continue;
      punkte.push({
        ...kurz(c), anzahl: n, stufe: n >= 4 ? "hoch" : n >= 3 ? "erhoeht" : "beobachten",
        signale: [...signale.entries()].map(([art, text]) => ({ art, text })), reisewarnung: r && r.stufe !== "keine" ? r.text : null,
      });
    }
    punkte.sort((a, b) => b.anzahl - a.anzahl || (b.reisewarnung ? 1 : 0) - (a.reisewarnung ? 1 : 0));
    return { punkte: punkte.slice(0, 25), stand: new Date().toISOString(), quelle: "Friday-Auswertung aller Lagebild-Ebenen", hinweis: "Ein Brennpunkt heißt: mindestens zwei verschiedene Ereignisse gleichzeitig im selben Land." };
  });
}

// ---------- Übersicht für die Lagebild-Leiste ----------
export async function getPlusUebersicht() {
  const safe = (p) => p.catch(() => null);
  const [nf, me, rw, hu, aus, br] = await Promise.all([safe(getNotflug()), safe(getMeerengen()), safe(getReisewarnungen()), safe(getHurrikane()), safe(getAusbrueche()), safe(getBrennpunkte())]);
  const auffaellig = (me?.engen || []).filter((e) => e.stufe === "stark" || e.stufe === "weniger");
  return {
    notflug: nf ? nf.flugzeuge.length : null, notflug_top: nf?.flugzeuge?.[0] || null,
    meerengen_auffaellig: me ? auffaellig.length : null, meerengen_top: auffaellig.sort((a, b) => a.trend_prozent - b.trend_prozent)[0] || me?.engen?.find((e) => /Hormuz/.test(e.name_en)) || null,
    reisewarnungen: rw ? rw.warnungen : null, teilwarnungen: rw ? rw.teilwarnungen : null,
    hurrikane: hu ? hu.stuerme.length : null, hurrikan_top: hu?.stuerme?.[0] || null,
    ausbrueche: aus ? aus.meldungen.filter((m) => Date.now() - Date.parse(m.zeit) < 30 * 86400000).length : null, ausbruch_top: aus?.meldungen?.[0] || null,
    brennpunkte: br ? br.punkte.length : null, brennpunkt_top: br?.punkte?.[0] || null,
    stand: new Date().toISOString(),
  };
}

export function lageplusRouten(app, asyncRoute) {
  app.get("/api/lageplus", asyncRoute(async (req, res) => res.json(await getPlusUebersicht())));
  app.get("/api/lageplus/notflug", asyncRoute(async (req, res) => res.json(await getNotflug())));
  app.get("/api/lageplus/meerengen", asyncRoute(async (req, res) => res.json(await getMeerengen())));
  app.get("/api/lageplus/reise", asyncRoute(async (req, res) => res.json(await getReisewarnungen())));
  app.get("/api/lageplus/hurrikane", asyncRoute(async (req, res) => res.json(await getHurrikane())));
  app.get("/api/lageplus/ausbrueche", asyncRoute(async (req, res) => res.json(await getAusbrueche())));
  app.get("/api/lageplus/strahlung", asyncRoute(async (req, res) => res.json(await getStrahlung())));
  app.get("/api/lageplus/brennpunkte", asyncRoute(async (req, res) => res.json(await getBrennpunkte())));
  app.get("/api/lageplus/stabilitaet", asyncRoute(async (req, res) => res.json(await getStabilitaet())));
  app.get("/api/lageplus/infra", asyncRoute(async (req, res) => res.json(await getInfraPlus(String(req.query.typ || "")))));
  // Infrastruktur-Dateien im Hintergrund vorbereiten (nach dem Start, damit der Server schnell bereit ist).
  setTimeout(() => bereiteInfraVor().catch(() => null), 40 * 1000).unref?.();
}

// ---------- Sprachbefehle ohne Claude ----------
const aufz = (l) => l.length <= 1 ? l.join("") : l.slice(0, -1).join(", ") + " und " + l.at(-1);
const zahl = (n) => Number(n).toLocaleString("de-DE");
function landIn(t, muster) {
  const m = t.match(muster);
  if (!m) return null;
  const roh = m[1].replace(/[?.!]+$/, "").replace(/\b(reisen|fliegen|fahren|gerade|aktuell|heute|jetzt|bitte|sicher|eine?)\b/g, "").trim();
  return roh ? findeLand(roh) || findCountry(roh) : null;
}
export async function lageplusAnswer(t) {
  t = String(t || "").toLowerCase().replace(/[?!.]+$/, "").trim();
  // Reisewarnung für ein Land
  if (/reisewarnung|sicherheitshinweis|kann ich (nach|in die|in den|in) .{2,40} (reisen|fliegen|fahren)|ist (es )?(in )?.{2,30} sicher (zu reisen|für touristen|fuer touristen)|ist .{2,30} sicher/.test(t)) {
    const c = landIn(t, /(?:nach|in die|in den|in|für|fuer|von|ist)\s+(?:das |die |den |der )?(.{2,40}?)(?:\s+(?:reisen|fliegen|fahren|sicher|eine reisewarnung|reisewarnung))?$/) || landIn(t, /(?:nach|für|fuer|in)\s+(.{2,40})$/);
    if (!c) {
      if (!/reisewarnung/.test(t)) return null;
      const d = await getReisewarnungen();
      const w = d.laender.filter((l) => l.stufe === "warnung");
      return { text: `Das Auswärtige Amt warnt gerade vor Reisen in ${w.length} Länder, zum Beispiel ${aufz(w.slice(0, 6).map((l) => l.land))}. Für ${d.teilwarnungen} weitere Länder gilt eine Teil-Reisewarnung.`, zeigen: true };
    }
    const r = await reisewarnungFuer(c);
    if (!r) return { text: `Zu ${c.name} habe ich keine Angaben vom Auswärtigen Amt gefunden, Boss.` };
    const s = await stabilitaetFuer(c).catch(() => null);
    const satz = {
      warnung: `Achtung: Für ${c.name} gibt es eine Reisewarnung vom Auswärtigen Amt. Von Reisen wird abgeraten.`,
      teilwarnung: `Für Teile von ${c.name} gibt es eine Reisewarnung. Bestimmte Regionen solltest du meiden, der Rest ist bereisbar.`,
      hinweis: `Für ${c.name} gibt es keine Reisewarnung, aber einen besonderen Sicherheitshinweis. Lies ihn vor der Reise.`,
      teilhinweis: `Für ${c.name} gibt es keine Reisewarnung, nur für einzelne Gegenden einen Sicherheitshinweis.`,
      keine: `Für ${c.name} gibt es keine Reisewarnung vom Auswärtigen Amt.`,
    }[r.stufe];
    return { text: `${satz}${s ? ` Fridays Stabilitäts-Wert: ${s.wert} von 100, ${s.stufe}.` : ""}`, zeigen: true };
  }
  if (/(wie )?stabil (ist|sind)|stabilitäts?(-| )?wert|stabilitaets?(-| )?wert|instabilste|unsicherste länder|unsicherste laender/.test(t)) {
    const c = landIn(t, /(?:stabil (?:ist|sind)|wert (?:von|für|fuer))\s+(?:das |die |den |der )?(.{2,40})$/);
    const d = await getStabilitaet();
    if (c) {
      const s = d.laender.find((l) => l.id === c.id);
      if (!s) return { text: `Für ${c.name} habe ich keinen Stabilitäts-Wert, Boss.` };
      return { text: `${c.name} hat einen Stabilitäts-Wert von ${s.wert} von 100, also ${s.stufe}.${s.gruende.length ? ` Abzug gab es für ${aufz(s.gruende.map((g) => g.replace(/\s*\(−\d+\)/, "")))}.` : ""}`, zeigen: true };
    }
    return { text: `Am instabilsten gerade: ${aufz(d.laender.slice(0, 5).map((l) => `${l.land} (${l.wert})`))}. Das berechne ich aus Weltbank-Daten und der aktuellen Lage.`, zeigen: true };
  }
  if (/(flugzeug|flieger|flug)e?.{0,20}(not|notfall|notruf|7700|in not|mayday)|notfall.?flug|squawk|luftnotlage/.test(t)) {
    const d = await getNotflug();
    if (!d.flugzeuge.length) return { text: "Gerade sendet kein Flugzeug einen Notfall-Code, Boss. Der Himmel ist ruhig.", zeigen: true };
    const a = d.flugzeuge[0];
    return { text: `${d.flugzeuge.length === 1 ? "Ein Flugzeug sendet" : `${d.flugzeuge.length} Flugzeuge senden`} gerade einen Notfall-Code. ${a.rufzeichen || a.kennung || "Eines"}${a.typ ? `, eine ${a.typ}` : ""}, meldet ${a.art}${a.nahe ? ` nahe ${a.nahe}` : ""}${a.hoehe_m ? ` in ${zahl(a.hoehe_m)} Metern Höhe` : ""}. Das ist oft nur Vorsicht.`, zeigen: true };
  }
  if (/meerenge|hormus|hormuz|suez|panamakanal|panama.?kanal|bosporus|malakka|bab.?el|rotes meer.{0,20}schiff|schiffe? (durch|im|in der)/.test(t)) {
    const d = await getMeerengen();
    const wahl = d.engen.find((e) => (/hormus|hormuz/.test(t) && /Hormuz/.test(e.name_en)) || (/suez/.test(t) && /Suez/.test(e.name_en)) || (/panama/.test(t) && /Panama/.test(e.name_en)) || (/bosporus/.test(t) && /Bosporus/.test(e.name_en)) || (/malakka/.test(t) && /Malacca/.test(e.name_en)) || (/bab|rotes meer/.test(t) && /Bab/.test(e.name_en)) || (/gibraltar/.test(t) && /Gibraltar/.test(e.name_en)));
    const satz = (e) => `${e.name}: ${e.heute} Schiffe am ${new Date(e.datum).toLocaleDateString("de-DE", { day: "numeric", month: "long" })}, im Wochenschnitt ${e.schnitt7}${e.trend_prozent != null ? `, das sind ${Math.abs(e.trend_prozent)} Prozent ${e.trend_prozent < 0 ? "weniger" : "mehr"} als im Monat davor` : ""}.`;
    if (wahl) return { text: satz(wahl), zeigen: true };
    const auff = d.engen.filter((e) => e.trend_prozent != null && e.trend_prozent <= -10).sort((a, b) => a.trend_prozent - b.trend_prozent);
    return { text: auff.length ? `Auffällig weniger Verkehr gerade in ${aufz(auff.slice(0, 3).map((e) => `${e.name} (${e.trend_prozent} %)`))}.` : `Der Schiffsverkehr in den großen Meerengen läuft normal. ${satz(d.engen.find((e) => /Hormuz/.test(e.name_en)) || d.engen[0])}`, zeigen: true };
  }
  if (/hurrikan|hurricane|wirbelsturm|tropensturm|zyklon|taifun/.test(t)) {
    const d = await getHurrikane();
    if (!d.stuerme.length) return { text: "Das Hurrikan-Zentrum der USA meldet gerade keinen aktiven Sturm im Atlantik oder Ostpazifik, Boss. Stürme in Asien zeigt der Welt-Alarm.", zeigen: true };
    return { text: `Aktiv gerade: ${aufz(d.stuerme.map((s) => `${s.klasse} ${s.name}${s.wind_kmh ? ` mit ${s.wind_kmh} km/h Wind` : ""}`))}. Den Vorhersage-Kegel zeige ich dir auf dem Globus.`, zeigen: true };
  }
  if (/ausbr(ü|ue)che|ausbruch.{0,15}(krankheit|seuche|virus)|epidemie|seuche|pandemie|krankheits?.?ausbr|who.?meldung/.test(t)) {
    const d = await getAusbrueche();
    const m = d.meldungen.slice(0, 4);
    if (!m.length) return { text: "Die WHO hat in letzter Zeit keine neuen Ausbrüche gemeldet, Boss.", zeigen: true };
    return { text: `Die letzten WHO-Meldungen: ${aufz(m.map((x) => `${x.krankheit}${x.laender.length ? ` in ${aufz(x.laender.slice(0, 2).map((l) => l.land))}` : ""}`))}.`, zeigen: true };
  }
  if (/strahlung|radioaktiv|geigerz(ä|ae)hler|mikrosievert/.test(t)) {
    const d = await getStrahlung();
    const hoch = d.punkte.filter((p) => p.stufe !== "normal");
    return { text: hoch.length ? `Von ${zahl(d.messungen)} Messgeräten zeigen ${hoch.length} erhöhte Werte, der höchste Wert ${hoch[0].usv.toLocaleString("de-DE")} Mikrosievert pro Stunde${hoch[0].ort ? ` bei ${hoch[0].ort}` : ""}. Viele Geräte stehen bei Fukushima, einzelne messen auch mal falsch.` : `Die Strahlung ist überall normal, Boss. ${zahl(d.messungen)} Messgeräte melden Werte im üblichen Bereich.`, zeigen: true };
  }
  if (/brennpunkt|wo brennt('s| es)|hotspots?\b|wo ist (gerade )?am meisten los/.test(t)) {
    const d = await getBrennpunkte();
    if (!d.punkte.length) return { text: "Gerade gibt es keinen Brennpunkt mit mehreren Ereignissen gleichzeitig, Boss.", zeigen: true };
    const p = d.punkte[0];
    return { text: `${d.punkte.length} Brennpunkte gerade. Am meisten los in ${p.land}: ${aufz(p.signale.map((s) => s.text))}.${d.punkte[1] ? ` Danach ${aufz(d.punkte.slice(1, 3).map((x) => x.land))}.` : ""}`, zeigen: true };
  }
  return null;
}
