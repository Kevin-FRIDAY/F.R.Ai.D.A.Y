// Gemeinsame Kleinigkeiten für die Wunschliste (v1.160.0): Ort → Koordinaten, Datum/Uhrzeit in Kevins Zeitzone,
// JSON holen mit Zeitlimit. Bewusst klein gehalten, damit jedes Wunsch-Modul für sich lesbar bleibt.
import { config } from "./config.js";

export const UA = "F.R.Ai.D.A.Y-Assistent/1.160 (privater Sprachassistent)";

/** fetch mit Zeitlimit; wirft bei HTTP-Fehler mit .status. */
export async function holen(url, { json = true, timeout = 12000, headers = {}, ...opt } = {}) {
  let r;
  try {
    r = await fetch(url, { ...opt, headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(timeout) });
  } catch (err) {
    throw Object.assign(new Error(err.name === "TimeoutError" ? "Zeitüberschreitung" : `nicht erreichbar (${err.message})`), { status: 0 });
  }
  if (!r.ok) {
    let text = "";
    try { text = (await r.text()).slice(0, 200); } catch { /* egal */ }
    throw Object.assign(new Error(`Fehler ${r.status}${text ? `: ${text}` : ""}`), { status: r.status });
  }
  return json ? r.json() : r.text();
}

const ortCache = new Map();
/** "Berlin" → { name, lat, lon } über Open-Meteo (kostenlos, ohne Schlüssel). */
export async function ortZuKoordinaten(ort = config.city) {
  const k = String(ort || "").trim().toLowerCase();
  if (!k) throw new Error("Kein Ort eingestellt.");
  const koord = k.match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (koord) return { name: "deinem Ort", lat: Number(koord[1]), lon: Number(koord[2]) };
  if (ortCache.has(k)) return ortCache.get(k);
  const geo = await holen(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=${encodeURIComponent(ort)}`);
  const p = geo.results?.[0];
  if (!p) throw new Error(`Ort „${ort}“ nicht gefunden.`);
  const e = { name: p.name, lat: p.latitude, lon: p.longitude };
  ortCache.set(k, e);
  return e;
}

/** Heutiges Datum (YYYY-MM-DD) in Fridays Zeitzone, optional + Tage. */
export function tagStr(plusTage = 0, basis = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(basis + plusTage * 864e5));
}
/** Stunde (0–23) und Minute jetzt in Fridays Zeitzone. */
export function uhrJetzt(ms = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: config.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { h: Number(p.hour), m: Number(p.minute) };
}
export const datumLang = (iso) => {
  try { return new Date(iso).toLocaleDateString("de-DE", { timeZone: config.timezone, weekday: "long", day: "numeric", month: "long" }); } catch { return String(iso); }
};
export const uhrzeit = (iso) => {
  try { return new Date(iso).toLocaleTimeString("de-DE", { timeZone: config.timezone, hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
};
export const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/** Sprachtext vorbereiten: "Hey Friday, …" weg, klein, ohne Satzzeichen am Ende. */
export function sauber(text) {
  const t = String(text || "").replace(/^(hey |hallo |ok |okay )?(friday|freitag)[ ,.!:]*/i, "").trim().replace(/[?!.]+$/, "");
  return { t, k: t.toLowerCase() };
}
