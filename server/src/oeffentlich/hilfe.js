// Gemeinsame Hilfen für „Öffentliche Daten“ (v1.165.0): Ort in Deutschland auflösen (OpenPLZ → Kreis-Schlüssel,
// Bundesland), Zahlen/Datum auf Deutsch, kleiner Zwischenspeicher. Alle Quellen sind kostenlos und öffentlich.
import { config } from "../config.js";
import { holen, ortZuKoordinaten } from "../wunsch-hilfe.js";

export { holen, ortZuKoordinaten };

/** Kleiner Zwischenspeicher: gleiche Frage innerhalb von `ms` → keine neue Abfrage. */
const speicher = new Map();
export async function gemerkt(schluessel, ms, fn) {
  const e = speicher.get(schluessel);
  if (e && Date.now() - e.zeit < ms) return e.wert;
  const wert = await fn();
  speicher.set(schluessel, { zeit: Date.now(), wert });
  if (speicher.size > 300) speicher.delete(speicher.keys().next().value);
  return wert;
}

export const de = (n, stellen = 0) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen }) : "–");
export const datum = (v, mitJahr = true) => {
  try { return new Date(v).toLocaleDateString("de-DE", { timeZone: config.timezone, day: "numeric", month: "long", ...(mitJahr ? { year: "numeric" } : {}) }); } catch { return String(v || ""); }
};
export const datumKurz = (v) => {
  try { return new Date(v).toLocaleDateString("de-DE", { timeZone: config.timezone, day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return String(v || ""); }
};
export const zeit = (v) => {
  try { return new Date(v).toLocaleString("de-DE", { timeZone: config.timezone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return String(v || ""); }
};
/** Heute in Fridays Zeitzone als { j, m, t, iso }. */
export function heute(plusTage = 0) {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + plusTage * 864e5));
  const [j, m, t] = iso.split("-");
  return { j, m, t, iso };
}
export const ersterGross = (s) => String(s || "").replace(/^\p{L}/u, (c) => c.toUpperCase());
export const kuerzen = (s, n = 220) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, "")} …` : t; };
/** Ort aus der Eingabe, sonst Fridays eingestellter Ort. */
export const ortOder = (q) => String(q || "").trim() || config.city;

/** Luftlinie in km. */
export function km(a, b) {
  const r = (x) => (x * Math.PI) / 180;
  const d = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(d));
}

// Bundesländer: Schlüssel (erste zwei Ziffern des Gemeindeschlüssels) → Kürzel/Name.
export const LAENDER = {
  "01": ["SH", "Schleswig-Holstein"], "02": ["HH", "Hamburg"], "03": ["NI", "Niedersachsen"], "04": ["HB", "Bremen"],
  "05": ["NW", "Nordrhein-Westfalen"], "06": ["HE", "Hessen"], "07": ["RP", "Rheinland-Pfalz"], "08": ["BW", "Baden-Württemberg"],
  "09": ["BY", "Bayern"], "10": ["SL", "Saarland"], "11": ["BE", "Berlin"], "12": ["BB", "Brandenburg"],
  "13": ["MV", "Mecklenburg-Vorpommern"], "14": ["SN", "Sachsen"], "15": ["ST", "Sachsen-Anhalt"], "16": ["TH", "Thüringen"],
};
const norm = (s) => String(s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z]/g, "");
/** "Bayern" / "BY" / "nrw" → Schlüssel "09" (oder null). */
export function landSchluessel(text) {
  const n = norm(text);
  if (!n) return null;
  if (n === "nrw") return "05";
  for (const [k, [kurz, name]] of Object.entries(LAENDER)) if (n === kurz.toLowerCase() || n === norm(name)) return k;
  return null;
}

/**
 * Deutschen Ort oder PLZ auflösen (OpenPLZ API, openplzapi.org, ohne Schlüssel).
 * → { name, plz, gemeinde, kreis, kreisName, land, landName, ars } – ars = 12-stelliger Regionalschlüssel auf Kreisebene (für NINA).
 */
export async function deOrt(eingabe) {
  const q = ortOder(eingabe).replace(/^(in|für|fuer|bei)\s+/i, "").trim();
  return gemerkt(`plz:${q.toLowerCase()}`, 7 * 864e5, async () => {
    const plz = q.match(/^\d{5}$/);
    const url = plz
      ? `https://openplzapi.org/de/Localities?postalCode=${q}&page=1&pageSize=10`
      : `https://openplzapi.org/de/Localities?name=${encodeURIComponent(q)}&page=1&pageSize=20`;
    const liste = await holen(url, { headers: { Accept: "application/json" } });
    if (!Array.isArray(liste) || !liste.length) throw new Error(`„${q}“ habe ich in Deutschland nicht gefunden.`);
    // Exakter Name zuerst, sonst der erste Treffer.
    const p = liste.find((x) => norm(x.name) === norm(q)) || liste[0];
    const gemeinde = String(p.municipality?.key || "");
    const kreis = String(p.district?.key || gemeinde.slice(0, 5));
    const land = String(p.federalState?.key || gemeinde.slice(0, 2)).padStart(2, "0");
    const plzListe = [...new Set(liste.filter((x) => norm(x.name) === norm(p.name)).map((x) => x.postalCode))].sort();
    return {
      name: p.name, plz: p.postalCode, plzListe, gemeinde, gemeindeName: p.municipality?.name || p.name,
      kreis, kreisName: p.district?.name || "", land, landName: p.federalState?.name || LAENDER[land]?.[1] || "",
      landKurz: LAENDER[land]?.[0] || "", ars: `${kreis.slice(0, 5)}0000000`,
    };
  });
}
