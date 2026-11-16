// Gemeinsamer Speicher für Fridays Verbindungen (Spotify, ElevenLabs, Home Assistant, Hue, Todoist, Notion, Kalender).
// Alles liegt in data/verbindungen.json auf dem Mac. Diese Datei wird von Updates nie überschrieben
// und landet mit in der Sicherung. Schlüssel werden nie ans Dashboard zurückgeschickt.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config.js";

const FILE = path.join(DATA_DIR, "verbindungen.json");

let cache = null;
function loadAll() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, "utf8")) || {};
  } catch {
    cache = {};
  }
  return cache;
}
function saveAll(d) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
  cache = d;
}

export function get(dienst) {
  return { ...(loadAll()[dienst] || {}) };
}
export function set(dienst, werte) {
  const all = { ...loadAll() };
  all[dienst] = { ...(all[dienst] || {}), ...werte };
  for (const k of Object.keys(all[dienst])) if (all[dienst][k] === undefined) delete all[dienst][k];
  saveAll(all);
  return all[dienst];
}
export function clear(dienst) {
  const all = { ...loadAll() };
  delete all[dienst];
  saveAll(all);
}

// Nur für Tests: Speicher neu einlesen.
export function _reset() {
  cache = null;
}

// Prüft, ob ein eingetippter Schlüssel plausibel aussieht (keine Leerzeichen, sinnvolle Länge).
export function schluesselOk(s, min = 10, max = 400) {
  const t = String(s || "").trim();
  return t.length >= min && t.length <= max && !/\s/.test(t);
}

// fetch mit Zeitlimit, JSON-Antwort und deutschen Fehlern.
// Liefert {ok, status, data} oder {ok:false, status, data, netz:true} bei Netzfehler.
export async function holeJson(url, { method = "GET", headers = {}, body, timeout = 12000, form = false } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body != null ? { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" } : {}),
        ...headers,
      },
      body: body == null ? undefined : form ? new URLSearchParams(body).toString() : typeof body === "string" ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (err) {
    return { ok: false, status: 0, data: {}, netz: true, fehler: err.message };
  }
  const text = await res.text().catch(() => "");
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { text };
    }
  }
  return { ok: res.ok, status: res.status, data };
}

// Namen vergleichen ("Wohnzimmer Decke" ~ "wohnzimmerdecke").
export const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const FUELL = new Set(["bitte", "mal", "doch", "das", "die", "der", "den", "dem", "des", "im", "in", "am", "an", "auf", "vom", "von", "zu", "zum", "zur", "mein", "meine", "meinen", "meiner", "und", "fuer"]);
const worte = (s) => norm(s).split(" ").filter((w) => w && !FUELL.has(w));

// Wie gut passt ein gesprochener Name zu einem Gerät/einer Playlist? 0 … 1
export function passt(wunsch, name) {
  const a = norm(wunsch), b = norm(name);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.replace(/ /g, "") === b.replace(/ /g, "")) return 0.98;
  const wa = worte(wunsch), wb = worte(name);
  if (!wa.length || !wb.length) return 0;
  let treffer = 0;
  for (const w of wb) {
    if (wa.some((x) => x === w || (x.length > 3 && w.length > 3 && (x.startsWith(w) || w.startsWith(x))))) treffer++;
  }
  if (!treffer) {
    // "wohnzimmerlicht" ~ "Wohnzimmer"
    const ka = wa.join(""), kb = wb.join("");
    if (kb.length > 3 && ka.includes(kb)) return 0.7;
    if (ka.length > 3 && kb.includes(ka)) return 0.65;
    return 0;
  }
  return (treffer / wb.length) * 0.75 + (treffer / wa.length) * 0.25;
}

export function bester(wunsch, liste, nameVon = (x) => x.name, schwelle = 0.55) {
  let best = null, score = 0;
  for (const x of liste) {
    const s = passt(wunsch, nameVon(x));
    if (s > score) { best = x; score = s; }
  }
  return score >= schwelle ? best : null;
}

// "A, B und C"
export function aufzaehlen(liste) {
  const l = liste.filter(Boolean);
  if (l.length <= 1) return l[0] || "";
  return `${l.slice(0, -1).join(", ")} und ${l.at(-1)}`;
}
