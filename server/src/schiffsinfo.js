// Mehr zum Schiff – nur aus freien, erlaubten Quellen (v1.119.0).
// Kevin wollte "alles, was bei VesselFinder kostenlos ist". VesselFinder verbietet in seinen
// Nutzungsbedingungen das automatische Auslesen und Kopieren (auch der Fotos). Darum holt
// Friday dieselben Infos von freien Quellen:
//  - Ziel-Hafen: UN/LOCODE-Liste der UNECE (ca. 12.000 Häfen mit Koordinaten, server/daten/haefen.json)
//    → Name, Land, Entfernung, ungefähre Restzeit, Linie auf dem Globus
//  - Foto + Kurztext: Wikidata (IMO P458 / MMSI P587) + Wikimedia Commons + deutsche Wikipedia
//    (gibt es nur für bekannte Schiffe wie Kreuzfahrtschiffe, Forschungsschiffe, große Frachter)
//  - Links zum Selbst-Nachschauen bei VesselFinder (Friday liest dort nichts aus)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR } from "./config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const HAEFEN_DATEI = path.resolve(here, "..", "daten", "haefen.json");
const INFO_DATEI = path.join(DATA_DIR, "schiffe-steckbriefe.json");
const INFO_MS = 30 * 24 * 3600 * 1000;
const UA = { "User-Agent": "F.R.Ai.D.A.Y/1.0 (privater Assistent)" };

const LAENDER = new Intl.DisplayNames(["de"], { type: "region" });
const landName = (cc) => { try { return LAENDER.of(cc) || cc; } catch { return cc; } };

// ---------- Häfen ----------
let haefen = null; // { code: Map, name: Map<string, Array> }
function ladeHaefen() {
  if (haefen) return haefen;
  const code = new Map(), name = new Map();
  try {
    for (const [c, n, la, lo] of JSON.parse(fs.readFileSync(HAEFEN_DATEI, "utf8"))) {
      const h = { code: c, name: n, lat: la, lon: lo, land: c.slice(0, 2) };
      code.set(c, h);
      const k = norm(n);
      if (!name.has(k)) name.set(k, []);
      name.get(k).push(h);
    }
  } catch (err) { console.error("Häfen-Liste fehlt:", err.message); }
  haefen = { code, name };
  return haefen;
}
const norm = (s) => String(s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

function km(la1, lo1, la2, lo2) {
  const R = 6371, r = Math.PI / 180;
  const a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// AIS-Ziel ist freier Text: "DEHAM", "DE HAM", "NLRTM>DEHAM", "ROTTERDAM", "HAMBURG PILOT" …
export function findeHafen(zielRoh, lat, lon) {
  const { code, name } = ladeHaefen();
  if (!zielRoh || !code.size) return null;
  let z = String(zielRoh).toUpperCase();
  if (/>|=>|->/.test(z)) z = z.split(/=>|->|>/).pop();
  z = z.trim();
  const kompakt = z.replace(/[\s._-]+/g, "");
  if (/^[A-Z]{2}[A-Z0-9]{3}$/.test(kompakt) && code.has(kompakt)) return code.get(kompakt);
  const nah = (liste) => liste.slice().sort((a, b) => (lat == null ? 0 : km(lat, lon, a.lat, a.lon) - km(lat, lon, b.lat, b.lon)))[0];
  const n = norm(z);
  if (n.length >= 3 && name.has(n)) return nah(name.get(n));
  // "HAMBURG PILOT", "ROTTERDAM ANCH" → erstes Wort / ohne Zusätze
  const ohne = norm(n.replace(/\b(PILOT|PILOTS|ANCH|ANCHORAGE|ANKER|OPL|PORT|ROADS|FOR ORDERS|ORDERS|EAST|WEST|NORTH|SOUTH)\b/g, ""));
  if (ohne.length >= 3 && name.has(ohne)) return nah(name.get(ohne));
  const erstes = n.split(" ")[0];
  if (erstes.length >= 4 && name.has(erstes)) return nah(name.get(erstes));
  return null;
}

export function hafenInfo(ziel, lat, lon, tempoKn) {
  const h = findeHafen(ziel, lat, lon);
  if (!h) return null;
  const weg = lat != null ? Math.round(km(lat, lon, h.lat, h.lon)) : null;
  // Luftlinie – auf See ist der Weg meist etwas länger, darum nur "ungefähr".
  const std = weg != null && tempoKn > 1 ? weg / (tempoKn * 1.852) : null;
  return {
    code: h.code, name: h.name, land: landName(h.land), lat: h.lat, lon: h.lon,
    entfernung_km: weg, restzeit_h: std != null ? Math.round(std * 10) / 10 : null,
  };
}

// Häfen in der Nähe eines Punkts (für "Häfen"-Ebene beim Hineinzoomen)
export function haefenUm(lat, lon, radiusKm = 600, max = 300) {
  const { code } = ladeHaefen();
  const out = [];
  for (const h of code.values()) {
    if (Math.abs(h.lat - lat) > radiusKm / 100) continue;
    const d = km(lat, lon, h.lat, h.lon);
    if (d <= radiusKm) out.push([h.code, h.name, h.lat, h.lon, Math.round(d)]);
  }
  return out.sort((a, b) => a[4] - b[4]).slice(0, max);
}

// ---------- Wikidata (Foto, Kurztext) ----------
let infos = null;
function lies() { try { return JSON.parse(fs.readFileSync(INFO_DATEI, "utf8")); } catch { return {}; } }
function schreib() { try { fs.writeFileSync(INFO_DATEI, JSON.stringify(infos)); } catch { /* egal */ } }

const sparql = (prop, wert) => `SELECT ?s ?sLabel ?sDescription ?img ?art ?baujahr ?werftLabel ?typLabel WHERE {
  ?s wdt:${prop} "${wert}".
  OPTIONAL { ?s wdt:P18 ?img. }
  OPTIONAL { ?s wdt:P571 ?baujahr. }
  OPTIONAL { ?s wdt:P176 ?werft. }
  OPTIONAL { ?s wdt:P31 ?typ. }
  OPTIONAL { ?art schema:about ?s; schema:isPartOf <https://de.wikipedia.org/>. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
} LIMIT 20`;

async function wikidata(imo, mmsi) {
  const abfragen = [];
  if (imo) abfragen.push(["P458", String(imo)]);
  if (mmsi) abfragen.push(["P587", String(mmsi)]);
  for (const [p, w] of abfragen) {
    const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparql(p, w));
    const r = await fetch(url, { headers: { ...UA, Accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`Wikidata ${r.status}`);
    const rows = (await r.json()).results?.bindings || [];
    if (!rows.length) continue;
    const b0 = rows[0];
    const pick = (k) => rows.map((b) => b[k]?.value).find((v) => v && !/^Q\d+$/.test(v)) || "";
    return {
      name: b0.sLabel?.value || "", beschreibung: b0.sDescription?.value || "",
      bild: pick("img") ? pick("img").replace(/^http:/, "https:") + "?width=480" : "",
      artikel: pick("art"), baujahr: pick("baujahr").slice(0, 4), werft: pick("werftLabel"), typ: pick("typLabel"),
      quelle: `https://www.wikidata.org/wiki/${b0.s.value.split("/").pop()}`,
    };
  }
  return null;
}

async function wikipediaKurz(artikel) {
  if (!artikel) return "";
  const titel = decodeURIComponent(artikel.split("/wiki/")[1] || "");
  if (!titel) return "";
  const r = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titel)}`, { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return "";
  const t = (await r.json()).extract || "";
  return t.length > 480 ? t.slice(0, 480).replace(/\s+\S*$/, "") + " …" : t;
}

export async function schiffExtra(schiff) {
  const { mmsi, imo } = schiff;
  infos ??= lies();
  const key = imo ? "i" + imo : "m" + mmsi;
  let w = infos[key];
  if (!w || Date.now() - w.at > INFO_MS) {
    try {
      const wd = await wikidata(imo, mmsi);
      const text = wd ? await wikipediaKurz(wd.artikel).catch(() => "") : "";
      w = { at: Date.now(), daten: wd ? { ...wd, text } : null };
      infos[key] = w;
      const keys = Object.keys(infos);
      if (keys.length > 4000) for (const k of keys.slice(0, keys.length - 4000)) delete infos[k];
      schreib();
    } catch {
      w = w || { at: 0, daten: null, fehler: "Wikidata gerade nicht erreichbar" };
    }
  }
  const nr = imo || mmsi;
  return {
    hafen: hafenInfo(schiff.ziel, schiff.lat, schiff.lon, schiff.tempo_kn),
    wiki: w.daten, wiki_fehler: w.fehler || "",
    links: [
      { name: "VesselFinder", url: `https://www.vesselfinder.com/de/vessels/details/${nr}` },
      ...(imo ? [{ name: "Fotos bei Wikimedia", url: `https://commons.wikimedia.org/w/index.php?search=IMO+${imo}&title=Special:MediaSearch&type=image` }] : []),
    ],
  };
}
