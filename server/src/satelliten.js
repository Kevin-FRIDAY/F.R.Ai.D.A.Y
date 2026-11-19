// Satelliten-Katalog: ALLE öffentlich gelisteten aktiven Satelliten (ca. 16.000).
// Quellen (frei, ohne Schlüssel):
//   CelesTrak GP-Daten (Bahnelemente, Gruppe "active" + Unter-Gruppen zum Einsortieren)
//   CelesTrak SATCAT (Betreiber-Land, Startdatum, Startplatz, Größe, Apogäum/Perigäum)
//   Wikidata + Wikipedia (Masse, Mission, Betreiber, Hersteller, Rakete, Bild) – erst beim Antippen
// Die Positionen rechnet das Dashboard selbst (SGP4 im Hintergrund-Thread), der Server liefert nur Daten.
// Ehrlich: Geheime Militärsatelliten veröffentlicht niemand – sie fehlen in jedem öffentlichen Katalog.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DATA_DIR } from "./config.js";

const UA = { "User-Agent": "F.R.Ai.D.A.Y/1.0 (privater Assistent)" };
const CT = "https://celestrak.org";
const DATEI = path.join(DATA_DIR, "satelliten-katalog.json");
const SATCAT_DATEI = path.join(DATA_DIR, "satelliten-satcat.json");
const INFO_DATEI = path.join(DATA_DIR, "satelliten-steckbriefe.json");
// CelesTrak bittet, dieselben Daten höchstens alle 2 Stunden zu holen -> wir nehmen 6 Stunden.
const FRISCH_MS = 6 * 3600 * 1000;
const SATCAT_MS = 7 * 24 * 3600 * 1000;

export const GRUPPEN = [
  { id: "station", name: "Raumstationen", info: "Bemannte Raumstationen und ihre Module (ISS, Tiangong)." },
  { id: "starlink", name: "Starlink", info: "Internet-Satelliten von SpaceX – die größte Flotte im All." },
  { id: "oneweb", name: "OneWeb", info: "Internet-Satelliten von Eutelsat OneWeb." },
  { id: "komm", name: "Kommunikation", info: "Fernsehen, Telefon, Internet und Funk (z. B. Iridium, Intelsat, SES, Kuiper)." },
  { id: "navi", name: "Navigation", info: "Satelliten für Ortung: GPS (USA), Galileo (EU), GLONASS (Russland), BeiDou (China)." },
  { id: "wetter", name: "Wetter", info: "Wettersatelliten (z. B. NOAA, Meteosat, GOES, MetOp, Fengyun)." },
  { id: "erde", name: "Erdbeobachtung", info: "Satelliten, die die Erde fotografieren und vermessen (z. B. Sentinel, Landsat)." },
  { id: "wissen", name: "Wissenschaft", info: "Forschungs-Satelliten und Weltraum-Teleskope (z. B. Hubble)." },
  { id: "amateur", name: "Amateurfunk", info: "Kleine Satelliten von Funkamateuren, Schulen und Unis." },
  { id: "militaer", name: "Militär (öffentlich)", info: "Nur offiziell gelistete Militärsatelliten. Geheime fehlen in allen öffentlichen Katalogen." },
  { id: "sonst", name: "Sonstige", info: "Alles andere: Technik-Tests, Firmen-Satelliten, Kleinstsatelliten." },
];

// CelesTrak-Untergruppen -> Friday-Gruppe (Reihenfolge = Vorrang)
const UNTERGRUPPEN = [
  ["stations", "station"], ["gnss", "navi"], ["weather", "wetter"], ["military", "militaer"],
  ["science", "wissen"], ["resource", "erde"], ["amateur", "amateur"], ["geo", "komm"],
];
const KOMM_NAMEN = /^(IRIDIUM|GLOBALSTAR|ORBCOMM|INTELSAT|SES[- ]|EUTELSAT|KUIPER|TELESAT|O3B|INMARSAT|VIASAT|ECHOSTAR|SIRIUS|ASTRA|HISPASAT|TURKSAT|YAHSAT|THURAYA|SKYNET|LUCH|EXPRESS|GONETS|SPACEBEE|LYNK|BLUEBIRD|QIANFAN|GUOWANG|G60|HULIANWANG|TIANTONG|ZHONGXING|CHINASAT|APSTAR|ASIASAT|JCSAT|ARABSAT|NILESAT|AMAZONAS|GALAXY|DIRECTV|TDRS|MUOS)/;
const NAVI_NAMEN = /^(GPS|NAVSTAR|GALILEO|GSAT0|COSMOS 2[4-5]\d\d|GLONASS|BEIDOU|QZS|IRNSS|NVS)/;
const STATION_NAMEN = /^(ISS|CSS|TIANHE|WENTIAN|MENGTIAN)\b/;

function gruppeFuer(norad, name, sets) {
  if (STATION_NAMEN.test(name) || sets.station.has(norad)) return "station";
  if (name.startsWith("STARLINK")) return "starlink";
  if (name.startsWith("ONEWEB")) return "oneweb";
  for (const [, g] of UNTERGRUPPEN) if (g !== "station" && sets[g]?.has(norad)) return g;
  if (NAVI_NAMEN.test(name)) return "navi";
  if (KOMM_NAMEN.test(name)) return "komm";
  return "sonst";
}

async function holeText(url, ms = 60000) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`CelesTrak ${r.status}`);
  const t = await r.text();
  // CelesTrak antwortet bei zu vielen Abrufen mit einem Hinweistext statt Daten.
  if (/^\s*(Data has not updated|GP data has not)/i.test(t)) throw new Error("CelesTrak: noch keine neuen Daten");
  return t;
}

function parseTle(text) {
  const zeilen = text.split(/\r?\n/).filter((l) => l.trim().length);
  const out = [];
  for (let i = 0; i + 2 < zeilen.length; i += 3) {
    const name = (zeilen[i] || "").trim(), l1 = zeilen[i + 1] || "", l2 = zeilen[i + 2] || "";
    if (!l1.startsWith("1 ") || !l2.startsWith("2 ")) continue;
    out.push({ norad: Number(l1.slice(2, 7)), name, l1: l1.trimEnd(), l2: l2.trimEnd() });
  }
  return out;
}

// Einfache CSV mit Anführungszeichen (SATCAT-Namen enthalten Kommas).
export function parseCsv(text) {
  const rows = [];
  let row = [], feld = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { feld += '"'; i++; } else q = false; }
      else feld += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(feld); feld = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(feld); feld = "";
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
    } else feld += ch;
  }
  if (feld || row.length) { row.push(feld); rows.push(row); }
  const kopf = rows.shift() || [];
  return rows.map((r) => Object.fromEntries(kopf.map((k, i) => [k, r[i] ?? ""])));
}

function lies(datei) { try { return JSON.parse(fs.readFileSync(datei, "utf8")); } catch { return null; } }
function schreib(datei, daten) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(datei, JSON.stringify(daten)); } catch { /* nur Zwischenspeicher */ }
}

// ---------- Katalog (Bahndaten aller aktiven Satelliten) ----------
let katalog = null;      // { stand, sats: [[norad, name, gruppe, l1, l2]], gz }
let laedt = null;

async function baueKatalog() {
  const tle = parseTle(await holeText(`${CT}/NORAD/elements/gp.php?GROUP=active&FORMAT=tle`));
  if (tle.length < 1000) throw new Error("CelesTrak lieferte zu wenige Satelliten");
  const sets = {};
  for (const [cg, g] of UNTERGRUPPEN) {
    sets[g] ??= new Set();
    try {
      const csv = parseCsv(await holeText(`${CT}/NORAD/elements/gp.php?GROUP=${cg}&FORMAT=csv`, 30000));
      for (const r of csv) sets[g].add(Number(r.NORAD_CAT_ID));
    } catch { /* Gruppe fehlt -> Einsortieren nach Namen */ }
  }
  sets.station ??= new Set();
  const sats = tle.map((s) => [s.norad, s.name, gruppeFuer(s.norad, s.name, sets), s.l1, s.l2]);
  return { stand: new Date().toISOString(), sats };
}

function mitGzip(k) {
  const json = JSON.stringify({ stand: k.stand, anzahl: k.sats.length, gruppen: GRUPPEN, sats: k.sats });
  return { ...k, json, gz: zlib.gzipSync(json, { level: 6 }) };
}

export async function getKatalog() {
  if (!katalog) { const f = lies(DATEI); if (f?.sats?.length) katalog = mitGzip(f); }
  const alt = !katalog || Date.now() - Date.parse(katalog.stand) > FRISCH_MS;
  if (alt && !laedt) {
    laedt = baueKatalog()
      .then((k) => { schreib(DATEI, k); katalog = mitGzip(k); })
      .catch((err) => { if (!katalog) throw err; console.warn("Satelliten-Katalog bleibt alt:", err.message); })
      .finally(() => { laedt = null; });
  }
  if (!katalog) await laedt; // beim allerersten Mal warten
  if (!katalog) throw new Error("Satelliten-Daten nicht erreichbar");
  return katalog;
}

// ---------- SATCAT (Steckbrief-Grunddaten) ----------
let satcat = null; // { stand, n: { norad: [cospar, typ, status, owner, start, ort, periode, neigung, apo, peri, rcs] } }
let satcatLaedt = null, satcatFehler = 0;
async function getSatcat() {
  if (!satcat) satcat = lies(SATCAT_DATEI);
  const alt = !satcat || Date.now() - Date.parse(satcat.stand) > SATCAT_MS;
  // Nach einem Fehler 30 Minuten Pause, damit das Antippen nicht jedes Mal lange wartet.
  if (alt && !satcatLaedt && Date.now() - satcatFehler > 30 * 60 * 1000) {
    satcatLaedt = (async () => {
      const rows = parseCsv(await holeText(`${CT}/pub/satcat.csv`, 90000));
      const n = {};
      for (const r of rows) {
        if (r.DECAY_DATE) continue; // schon verglüht
        if (r.OBJECT_TYPE !== "PAY") continue; // nur echte Satelliten, kein Schrott
        n[r.NORAD_CAT_ID] = [r.OBJECT_ID, r.OBJECT_TYPE, r.OPS_STATUS_CODE, r.OWNER, r.LAUNCH_DATE, r.LAUNCH_SITE, r.PERIOD, r.INCLINATION, r.APOGEE, r.PERIGEE, r.RCS];
      }
      satcat = { stand: new Date().toISOString(), n };
      schreib(SATCAT_DATEI, satcat);
    })().catch((err) => { satcatFehler = Date.now(); console.warn("SATCAT nicht geladen:", err.message); }).finally(() => { satcatLaedt = null; });
  }
  if (!satcat && satcatLaedt) await satcatLaedt;
  return satcat;
}

const BESITZER = {
  US: "USA", PRC: "China", CIS: "Russland / ehem. Sowjetunion", ESA: "Europäische Weltraumorganisation (ESA)",
  JPN: "Japan", IND: "Indien", FR: "Frankreich", GER: "Deutschland", UK: "Großbritannien", CA: "Kanada",
  ITSO: "Intelsat", SES: "SES (Luxemburg)", EUME: "EUMETSAT (Europa)", EUTE: "Eutelsat (Europa)",
  ORB: "Orbcomm (USA)", GLOB: "Globalstar (USA)", IRID: "Iridium (USA)", ISS: "Internationale Raumstation (mehrere Länder)",
  SKOR: "Südkorea", NKOR: "Nordkorea", ISRA: "Israel", BRAZ: "Brasilien", AUS: "Australien", ARGN: "Argentinien",
  IRAN: "Iran", TURK: "Türkei", UAE: "Vereinigte Arabische Emirate", SAUD: "Saudi-Arabien", SPN: "Spanien",
  IT: "Italien", LUXE: "Luxemburg", NETH: "Niederlande", FIN: "Finnland", NOR: "Norwegen", SWED: "Schweden",
  DEN: "Dänemark", POL: "Polen", SWTZ: "Schweiz", AUT: "Österreich", BEL: "Belgien", CZE: "Tschechien",
  MEX: "Mexiko", INDO: "Indonesien", MALA: "Malaysia", THAI: "Thailand", TWN: "Taiwan", SING: "Singapur",
  EGYP: "Ägypten", NIG: "Nigeria", SAFR: "Südafrika", PAKI: "Pakistan", KAZ: "Kasachstan", UKR: "Ukraine",
  AB: "Arabsat (Arabische Liga)", AC: "AsiaSat (China/Hongkong)", NATO: "NATO", RASC: "RascomStar (Afrika)",
  CHBZ: "China/Brasilien", FRIT: "Frankreich/Italien", ESRO: "ESRO (Europa)", EUTM: "Eutelsat (Europa)",
  NZ: "Neuseeland", VTNM: "Vietnam", PHIL: "Philippinen", QAT: "Katar", CHLE: "Chile", PER: "Peru",
  COL: "Kolumbien", BGD: "Bangladesch", LTU: "Litauen", EST: "Estland", GREC: "Griechenland", POR: "Portugal",
};
const STARTPLATZ = {
  AFETR: "Cape Canaveral, Florida (USA)", AFWTR: "Vandenberg, Kalifornien (USA)", TYMSC: "Baikonur (Kasachstan)",
  PKMTR: "Plessezk (Russland)", VOSTO: "Wostotschny (Russland)", KYMSC: "Kapustin Jar (Russland)",
  JSC: "Jiuquan (China)", TSC: "Taiyuan (China)", XSC: "Xichang (China)", WSC: "Wenchang (China)",
  FRGUI: "Kourou (Französisch-Guayana)", SRILR: "Sriharikota (Indien)", TNSTA: "Tanegashima (Japan)",
  KSCUT: "Uchinoura (Japan)", RLLB: "Mahia, Rocket Lab (Neuseeland)", WLPIS: "Wallops Island (USA)",
  KODAK: "Kodiak, Alaska (USA)", SEAL: "Sea Launch (Pazifik)", YAVNE: "Palmachim (Israel)",
  SEMLS: "Semnan (Iran)", NSC: "Naro (Südkorea)", OREN: "Jasny (Russland)", ERAS: "Flugzeug-Start (Ostküste USA)",
  WRAS: "Flugzeug-Start (Westküste USA)", SVOBO: "Swobodny (Russland)", KWAJ: "Kwajalein (Marshallinseln)",
  SADOL: "U-Boot-Start (Barentssee)", YSLA: "Gelbes Meer (China, schwimmende Plattform)", SMTS: "Shahrud (Iran)",
};
const STATUS = { "+": "in Betrieb", "-": "außer Betrieb", P: "teilweise in Betrieb", B: "Reserve", S: "Ersatz", X: "verlängerte Mission", D: "verglüht", "?": "unbekannt" };

// ---------- Wikidata + Wikipedia (beim Antippen) ----------
let infos = null; // norad -> { at, daten }
const INFO_MS = 30 * 24 * 3600 * 1000;

function sparql(norad) {
  return `SELECT ?s ?sLabel ?sDescription ?mass ?opLabel ?mfLabel ?lvLabel ?img ?art ?start WHERE {
  ?s wdt:P377 "${norad}".
  OPTIONAL { ?s wdt:P2067 ?mass. }
  OPTIONAL { ?s wdt:P137 ?op. }
  OPTIONAL { ?s wdt:P176 ?mf. }
  OPTIONAL { ?s wdt:P375 ?lv. }
  OPTIONAL { ?s wdt:P18 ?img. }
  OPTIONAL { ?s wdt:P619 ?start. }
  OPTIONAL { ?art schema:about ?s; schema:isPartOf <https://de.wikipedia.org/>. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
} LIMIT 60`;
}

async function wikidata(norad) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparql(norad));
  const r = await fetch(url, { headers: { ...UA, Accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`Wikidata ${r.status}`);
  const rows = (await r.json()).results?.bindings || [];
  const ents = new Map();
  for (const b of rows) {
    const id = b.s.value;
    const e = ents.get(id) || { name: "", beschreibung: "", masse: null, betreiber: new Set(), hersteller: new Set(), rakete: new Set(), bild: "", artikel: "", start: "" };
    e.name ||= b.sLabel?.value || "";
    e.beschreibung ||= b.sDescription?.value || "";
    if (b.mass) e.masse = Math.max(e.masse || 0, Number(b.mass.value) || 0) || null;
    if (b.opLabel && !/^Q\d+$/.test(b.opLabel.value)) e.betreiber.add(b.opLabel.value);
    if (b.mfLabel && !/^Q\d+$/.test(b.mfLabel.value)) e.hersteller.add(b.mfLabel.value);
    if (b.lvLabel && !/^Q\d+$/.test(b.lvLabel.value)) e.rakete.add(b.lvLabel.value);
    e.bild ||= b.img?.value || "";
    e.artikel ||= b.art?.value || "";
    e.start ||= b.start?.value || "";
    ents.set(id, e);
  }
  if (!ents.size) return null;
  // Mehrere Treffer (z. B. ISS + Modul Sarja): der mit Wikipedia-Artikel und den meisten Angaben gewinnt.
  const punkte = (e) => (e.artikel ? 4 : 0) + (e.masse ? 2 : 0) + e.betreiber.size + (e.bild ? 1 : 0) + (e.masse || 0) / 1e7;
  const best = [...ents.values()].sort((a, b) => punkte(b) - punkte(a))[0];
  return {
    name: best.name, beschreibung: best.beschreibung, masse_kg: best.masse,
    betreiber: [...best.betreiber].slice(0, 6), hersteller: [...best.hersteller].slice(0, 3), rakete: [...best.rakete].slice(0, 2),
    bild: best.bild ? best.bild.replace(/^http:/, "https:") + "?width=360" : "",
    artikel: best.artikel, start: best.start ? best.start.slice(0, 10) : "",
  };
}

async function wikipediaKurz(artikel) {
  if (!artikel) return "";
  const titel = decodeURIComponent(artikel.split("/wiki/")[1] || "");
  if (!titel) return "";
  const r = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titel)}`, { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return "";
  const t = (await r.json()).extract || "";
  return t.length > 520 ? t.slice(0, 520).replace(/\s+\S*$/, "") + " …" : t;
}

export async function getSteckbrief(noradRoh) {
  const norad = Number(noradRoh);
  if (!Number.isInteger(norad) || norad <= 0 || norad > 999999) throw new Error("Ungültige Satelliten-Nummer");
  const k = await getKatalog().catch(() => null);
  const eintrag = k?.sats.find((s) => s[0] === norad);
  const sc = await getSatcat().catch(() => null);
  const z = sc?.n?.[String(norad)];
  const basis = {
    norad,
    name: eintrag?.[1] || "",
    gruppe: eintrag?.[2] || "sonst",
    cospar: z?.[0] || "",
    status: z ? STATUS[z[2]] || z[2] || "" : "",
    land: z ? BESITZER[z[3]] || z[3] : "",
    start: z?.[4] || "",
    startplatz: z ? STARTPLATZ[z[5]] || z[5] : "",
    umlauf_min: z?.[6] ? Number(z[6]) : null,
    neigung: z?.[7] ? Number(z[7]) : null,
    apogaeum_km: z?.[8] ? Number(z[8]) : null,
    perigaeum_km: z?.[9] ? Number(z[9]) : null,
    groesse: z?.[10] ? (Number(z[10]) < 0.1 ? "klein (unter 0,1 m² Radarfläche)" : Number(z[10]) < 1 ? "mittel (0,1–1 m² Radarfläche)" : "groß (über 1 m² Radarfläche)") : "",
  };
  infos ??= lies(INFO_DATEI) || {};
  let wiki = infos[norad];
  if (!wiki || Date.now() - wiki.at > INFO_MS) {
    try {
      const wd = await wikidata(norad);
      const kurz = wd ? await wikipediaKurz(wd.artikel).catch(() => "") : "";
      wiki = { at: Date.now(), daten: wd ? { ...wd, text: kurz } : null };
      infos[norad] = wiki;
      const keys = Object.keys(infos);
      if (keys.length > 3000) for (const key of keys.slice(0, keys.length - 3000)) delete infos[key];
      schreib(INFO_DATEI, infos);
    } catch (err) {
      wiki = wiki || { at: 0, daten: null, fehler: "Wikidata gerade nicht erreichbar" };
    }
  }
  const gruppe = GRUPPEN.find((g) => g.id === basis.gruppe);
  return { ...basis, gruppe_name: gruppe?.name || "", gruppe_info: gruppe?.info || "", wiki: wiki.daten, wiki_fehler: wiki.fehler || "" };
}

export function satellitenRouten(app, asyncRoute) {
  app.get("/api/satelliten", asyncRoute(async (req, res) => {
    const k = await getKatalog();
    res.set("Cache-Control", "private, max-age=600");
    res.set("Vary", "Accept-Encoding");
    if (/\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
      res.set("Content-Encoding", "gzip").type("application/json").send(k.gz);
    } else res.type("application/json").send(k.json);
  }));
  app.get("/api/satelliten/:norad", asyncRoute(async (req, res) => res.json(await getSteckbrief(req.params.norad))));
}

// Für Sprache/Offline: kurze Zahlen ohne Claude.
export async function satellitenZahlen() {
  const k = await getKatalog();
  const z = {};
  for (const s of k.sats) z[s[2]] = (z[s[2]] || 0) + 1;
  return { anzahl: k.sats.length, gruppen: GRUPPEN.map((g) => ({ ...g, anzahl: z[g.id] || 0 })), stand: k.stand };
}

// ---------- Sprachbefehle ohne Claude ----------
// "zeig mir alle Satelliten", "wie viele Satelliten gibt es", "zeig mir die ISS / Hubble / Starlink",
// "zeig mir den Satelliten Sentinel-2A". "Wo ist die ISS?" beantwortet weiterhin offline.js (Live-Position).
const SAT_ALIAS = [
  [/\b(iss|internationale raumstation)\b/, "ISS (ZARYA)", "die ISS"],
  [/\b(tiangong|chinesische raumstation|css)\b/, "CSS (TIANHE)", "die chinesische Raumstation Tiangong"],
  [/\bhubble\b/, "HST", "das Hubble-Weltraumteleskop"],
];
const GRUPPEN_WORT = [
  [/\bstarlink\b/, "starlink"], [/\boneweb\b/, "oneweb"], [/\b(gps|navigations?satellit|galileo|glonass|beidou)/, "navi"],
  [/\bwettersatellit/, "wetter"], [/\bmilit(ä|ae)r/, "militaer"], [/\berdbeobachtung/, "erde"],
  [/\b(raumstation(en)?)\b/, "station"], [/\bamateurfunk/, "amateur"], [/\b(wissenschaft|teleskop)/, "wissen"],
  [/\bkommunikation|fernsehsatellit/, "komm"],
];
function bahnKurz(l2) {
  const n = Number(l2.slice(52, 63));
  const e = Number("0." + l2.slice(26, 33).trim());
  const a = Math.cbrt(398600.4418 / Math.pow((2 * Math.PI * n) / 86400, 2));
  const hoehe = a - 6378.137;
  return { hoehe: Math.round(hoehe), tempo: Math.round(Math.sqrt(398600.4418 / a) * 3600), rundeMin: 1440 / n, e };
}
const z = (v) => Number(v).toLocaleString("de-DE");

export async function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/[?!.]+$/, "").trim();
  if (!t) return null;
  const zeig = /\b(zeig|zeige|zeigen|öffne|oeffne|finde|such|suche)\b/.test(t);
  const satWort = /satellit/.test(t);
  // Anzahl
  if (satWort && /\bwie ?viele\b/.test(t)) {
    const zahlen = await satellitenZahlen();
    const top = zahlen.gruppen.filter((g) => g.anzahl).sort((a, b) => b.anzahl - a.anzahl).slice(0, 3);
    return {
      answer: `Gerade sind ${z(zahlen.anzahl)} aktive Satelliten öffentlich gelistet. Die meisten sind ${top.map((g) => `${g.name} mit ${z(g.anzahl)}`).join(", ")}. Geheime Militärsatelliten stehen in keinem öffentlichen Katalog. Ich zeige sie dir auf dem Globus.`,
      actions: ["weltgeschehen", "satelliten"],
    };
  }
  if (!zeig && !/\bwo ist\b/.test(t)) return null;
  // Bekannte Namen
  for (const [re, name, sprech] of SAT_ALIAS) {
    if (!re.test(t)) continue;
    if (/\bwo ist\b/.test(t) && !satWort && name === "ISS (ZARYA)") return null; // offline.js hat die Live-Antwort
    const k = await getKatalog();
    const s = k.sats.find((x) => x[1] === name) || k.sats.find((x) => x[1].startsWith(name));
    if (!s) return { answer: `${sprech} finde ich gerade nicht in den Bahndaten.`, actions: ["weltgeschehen", "satelliten"] };
    const b = bahnKurz(s[4]);
    return {
      answer: `Hier ist ${sprech}. Sie fliegt in rund ${z(b.hoehe)} Kilometern Höhe mit etwa ${z(Math.round(b.tempo / 100) * 100)} Kilometern pro Stunde und schafft eine Erdumrundung in ${Math.round(b.rundeMin)} Minuten.`.replace("Hier ist das Hubble-Weltraumteleskop. Sie", "Hier ist das Hubble-Weltraumteleskop. Es"),
      actions: ["weltgeschehen", `satellit:${s[0]}`],
    };
  }
  // Ganze Gruppe ("zeig mir Starlink", "zeig mir die GPS-Satelliten")
  for (const [re, gid] of GRUPPEN_WORT) {
    if (!re.test(t) || (!satWort && !["starlink", "oneweb", "station"].includes(gid))) continue;
    const zahlen = await satellitenZahlen();
    const g = zahlen.gruppen.find((x) => x.id === gid);
    return { answer: `Ich zeige dir ${g.name}: ${z(g.anzahl)} Satelliten. ${g.info}`, actions: ["weltgeschehen", `satgruppe:${gid}`] };
  }
  // Satellit mit Namen ("zeig mir den Satelliten Sentinel-2A")
  const m = t.match(/satellit(?:en)?\s+(.{2,40})$/);
  if (m && !/^(an|im|auf|zeig|alle)\b/.test(m[1])) {
    const q = m[1].replace(/^(namens|mit dem namen|nummer)\s+/, "").trim().toUpperCase();
    const k = await getKatalog();
    const nr = /^\d+$/.test(q) ? Number(q) : 0;
    const s = k.sats.find((x) => x[0] === nr) || k.sats.find((x) => x[1] === q) || k.sats.find((x) => x[1].startsWith(q)) || k.sats.find((x) => x[1].includes(q));
    if (!s) return { answer: `Einen Satelliten namens ${m[1]} finde ich nicht in den öffentlichen Daten.`, actions: ["weltgeschehen", "satelliten"] };
    const b = bahnKurz(s[4]);
    return { answer: `${s[1]} fliegt in rund ${z(b.hoehe)} Kilometern Höhe. Ich zeige ihn dir mit Steckbrief.`, actions: ["weltgeschehen", `satellit:${s[0]}`] };
  }
  // Alle Satelliten
  if (satWort) {
    const zahlen = await satellitenZahlen();
    return { answer: `Hier sind alle ${z(zahlen.anzahl)} öffentlich gelisteten Satelliten. Tipp einen an, dann zeige ich dir seinen Steckbrief.`, actions: ["weltgeschehen", "satelliten"] };
  }
  return null;
}
