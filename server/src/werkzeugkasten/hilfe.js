// Gemeinsame Bausteine für den Werkzeugkasten: Zahlen, Geld, Datum, Abrufe.
import { config } from "../config.js";

/** Deutsche Zahl lesen: "1.234,56" → 1234.56, "12,5" → 12.5, "3" → 3. Gibt null zurück, wenn es keine Zahl ist. */
export function nr(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/\s|€|%|eur(o)?$/gi, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "");
  s = s.replace(",", ".");
  if (!/^-?\d*\.?\d+(e-?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Pflichtzahl: wirft einen verständlichen Fehler, wenn sie fehlt. */
export function zahl(e, k, label = k, { min = -Infinity, max = Infinity, standard } = {}) {
  let n = nr(e?.[k]);
  if (n == null && standard !== undefined) n = standard;
  if (n == null) throw new Error(`Bitte gib ${label} als Zahl an.`);
  if (n < min || n > max) throw new Error(`${label} muss zwischen ${min} und ${max} liegen.`);
  return n;
}

export const text = (e, k, label = k, { pflicht = true, max = 20000 } = {}) => {
  const s = String(e?.[k] ?? "").trim();
  if (pflicht && !s) throw new Error(`Bitte gib ${label} ein.`);
  if (s.length > max) throw new Error(`${label} ist zu lang (höchstens ${max} Zeichen).`);
  return s;
};

/** Zahl hübsch auf Deutsch: 1234.5 → "1.234,5" */
export function de(n, stellen = 2) {
  if (n == null || !Number.isFinite(n)) return "–";
  return n.toLocaleString("de-DE", { maximumFractionDigits: stellen, minimumFractionDigits: 0 });
}
/** Geld: 1234.5 → "1.234,50 €" */
export function eur(n) {
  if (n == null || !Number.isFinite(n)) return "–";
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

// ---------- Datum (immer als reiner Kalendertag, ohne Zeitzonen-Ärger) ----------
const MONATE = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
export const MONATSNAMEN = MONATE.map((m) => m[0].toUpperCase() + m.slice(1));
export const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/** Heute in Fridays Zeitzone als {y,m,d}. */
export function heute() {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const [y, m, d] = f.format(new Date()).split("-").map(Number);
  return { y, m, d };
}
/** Jetzt in Fridays Zeitzone als {h, mi}. */
export function jetztUhr() {
  const f = new Intl.DateTimeFormat("de-DE", { timeZone: config.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const [h, mi] = f.format(new Date()).split(":").map(Number);
  return { h, mi };
}
/** Tag als Zahl (Tage seit 1970) – damit lässt sich einfach rechnen. */
export const tagNr = ({ y, m, d }) => Math.round(Date.UTC(y, m - 1, d) / 86400000);
export const ausTagNr = (n) => { const dt = new Date(n * 86400000); return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }; };
export const wochentag = (t) => new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay();
export const isoTag = (t) => `${t.y}-${String(t.m).padStart(2, "0")}-${String(t.d).padStart(2, "0")}`;
export const datumText = (t, { mitTag = true } = {}) => `${mitTag ? WOCHENTAGE[wochentag(t)] + ", " : ""}${t.d}. ${MONATSNAMEN[t.m - 1]} ${t.y}`;

/** "24.12.2026", "24.12.", "2026-12-24", "3. mai 2027", "heute", "morgen" → {y,m,d} oder null */
export function datum(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return null;
  const h = heute();
  if (s === "heute") return h;
  if (s === "morgen") return ausTagNr(tagNr(h) + 1);
  if (s === "gestern") return ausTagNr(tagNr(h) - 1);
  if (s === "übermorgen") return ausTagNr(tagNr(h) + 2);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  let t = null;
  if (m) t = { y: +m[1], m: +m[2], d: +m[3] };
  m = !t && s.match(/^(\d{1,2})\.\s?(\d{1,2})\.?\s?(\d{2,4})?$/);
  if (m) t = { y: m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : h.y, m: +m[2], d: +m[1] };
  m = !t && s.match(/^(\d{1,2})\.? ([a-zäöü]+)\.?(?: (\d{4}))?$/);
  if (m) {
    const mi = MONATE.findIndex((x) => x.startsWith(m[2].slice(0, 3).replace("mae", "mär")));
    if (mi >= 0) t = { y: m[3] ? +m[3] : h.y, m: mi + 1, d: +m[1] };
  }
  if (!t) return null;
  const probe = ausTagNr(tagNr(t));
  if (probe.y !== t.y || probe.m !== t.m || probe.d !== t.d) return null;
  return t;
}
export function pflichtDatum(e, k, label = k) {
  const t = datum(e?.[k]);
  if (!t) throw new Error(`Bitte gib ${label} als Datum an, z. B. 24.12.2026.`);
  return t;
}

/** "7:30", "7.30", "7 uhr 30", "730" → Minuten seit Mitternacht oder null */
export function uhrzeit(v) {
  const s = String(v ?? "").trim().toLowerCase().replace(/\s*uhr\s*/, ":").replace(/:$/, "");
  let m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?$/) || s.match(/^(\d{1,2}):\s?(\d{1,2})$/);
  if (!m && /^\d{3,4}$/.test(s)) m = [s, s.slice(0, -2), s.slice(-2)];
  if (!m) return null;
  const h = +m[1], mi = +(m[2] || 0);
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}
export const uhrText = (min) => { const x = ((Math.round(min) % 1440) + 1440) % 1440; return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")} Uhr`; };
export const dauerText = (min) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (!h) return `${m} Minuten`;
  return `${h} ${h === 1 ? "Stunde" : "Stunden"}${m ? ` und ${m} ${m === 1 ? "Minute" : "Minuten"}` : ""}`;
};

/** Liste aus Text: Zeilen oder Kommas */
export const liste = (s) => String(s ?? "").split(/\n|,|;/).map((x) => x.trim()).filter(Boolean);

// ---------- Internet (kostenlose Dienste ohne Schlüssel) ----------
export async function holeJson(url, { timeout = 9000, ...opts } = {}) {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { "User-Agent": "Friday-Werkzeugkasten/1.0", ...(opts.headers || {}) }, ...opts });
  if (!r.ok) throw new Error(`Der Dienst antwortet mit Fehler ${r.status}.`);
  return r.json();
}

const ortCache = new Map();
/** Ort → {name, lat, lon, land}. Ohne Ort: Fridays Stadt. Über Open-Meteo (kostenlos). */
export async function ort(name) {
  const q = String(name || config.city || "Berlin").trim();
  const k = q.toLowerCase();
  if (ortCache.has(k)) return ortCache.get(k);
  const d = await holeJson(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=${encodeURIComponent(q)}`);
  const p = d?.results?.[0];
  if (!p) throw new Error(`Den Ort „${q}“ habe ich nicht gefunden.`);
  const o = { name: p.name, lat: p.latitude, lon: p.longitude, land: p.country || "" };
  ortCache.set(k, o);
  return o;
}

export const pick = (a) => a[Math.floor(Math.random() * a.length)];
