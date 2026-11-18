// Fridays Server-Einstellungen (gelten für alle Geräte): Auto-Update und Vorladen im Hintergrund.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, config } from "./config.js";

const FILE = path.join(DATA_DIR, "einstellungen.json");
const DEFAULTS = {
  autoUpdate: true,       // neue Versionen von GitHub selbst installieren, wenn gerade nichts los ist
  vorladen: true,         // Welt-Alarm, Welt-Videos usw. im Hintergrund frisch halten
  marktVorrechnen: true,  // Kronos-Prognosen im Hintergrund nachrechnen (braucht Rechenleistung)
  tempo: "schnell",       // Denk-Tempo: blitz (Haiku) | schnell (Sonnet) | gruendlich (Opus) | auto (je nach Frage)
  anrede: "",             // Wie Friday dich nennt (leer = USER_NAME aus .env)
  stadt: "",              // Stadt für Wetter und Briefing (leer = CITY aus .env)
};
// Werte aus der .env merken, damit "leer" wieder darauf zurückfällt.
const ENV_WERTE = { anrede: config.userName, stadt: config.city };
const TEXT_OK = /^[\p{L}\p{N} .'\-]{0,40}$/u;
// "ja", "ok" usw. sind keine Namen (landen z. B. per Sprache aus Versehen im Profil) → ignorieren.
const KEIN_NAME = /^(ja|nein|ok|okay|jo|jep|jup|klar|gut|hallo|hi|test|name|boss)$/i;
const nameOk = (v) => Boolean(v) && !KEIN_NAME.test(String(v).trim());
function textAnwenden(s) {
  config.userName = (nameOk(s.anrede) && s.anrede) || (nameOk(ENV_WERTE.anrede) && ENV_WERTE.anrede) || "Boss";
  config.city = s.stadt || ENV_WERTE.stadt;
}
export const TEMPI = ["blitz", "schnell", "gruendlich", "auto"];

export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

// Beim Start: gespeicherte Anrede/Stadt übernehmen.
textAnwenden(getSettings());

export function setSettings(patch = {}) {
  const s = getSettings();
  for (const k of Object.keys(DEFAULTS)) if (typeof patch[k] === "boolean" && typeof DEFAULTS[k] === "boolean") s[k] = patch[k];
  if (TEMPI.includes(patch.tempo)) s.tempo = patch.tempo;
  for (const k of ["anrede", "stadt"]) {
    if (typeof patch[k] === "string") {
      const v = patch[k].replace(/\s+/g, " ").trim();
      if (TEXT_OK.test(v) && (k !== "anrede" || !v || nameOk(v))) s[k] = v;
    }
  }
  textAnwenden(s);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2));
  return s;
}

// Wann zuletzt jemand mit Friday gearbeitet hat (für Updates nur in ruhigen Momenten).
let lastActive = 0;
export function markActive() {
  lastActive = Date.now();
}
export function idleFor(ms) {
  return Date.now() - lastActive > ms;
}

// ---------------------------------------------------------------------------
// Dashboard-Einstellungen (Textgröße, Globus-Stil, Glow, Kopf-Stil, Farbe ...)
// Liegen in data/oberflaeche.json: von Updates nie überschrieben, aber in jeder
// Sicherung dabei. Mac und iPhone lesen dieselbe Datei, darum sind die
// Einstellungen auf allen Geräten gleich.
// ---------------------------------------------------------------------------
const UI_FILE = path.join(DATA_DIR, "oberflaeche.json");
const UI_KEY = /^friday_[a-z0-9_]{1,48}$/;
// Bleiben nur auf dem Gerät: Anmeldung, Gerätestimme, Tageszähler, Weckwort usw.
const NUR_GERAET = /^friday_(token|voice|alarm_last|focus_.*|boot|wake|theme_mockup|sync_.*)$/;
const MAX_KEYS = 200;
const MAX_LEN = 300;

export const syncKeyErlaubt = (k) => typeof k === "string" && UI_KEY.test(k) && !NUR_GERAET.test(k);

export function getUiSettings() {
  try {
    const d = JSON.parse(fs.readFileSync(UI_FILE, "utf8"));
    const werte = {};
    for (const [k, v] of Object.entries(d?.werte || {})) if (syncKeyErlaubt(k) && typeof v === "string") werte[k] = v;
    return { werte, geaendert: typeof d?.geaendert === "string" ? d.geaendert : null };
  } catch {
    return { werte: {}, geaendert: null };
  }
}

// patch = { set: { schlüssel: "wert" }, remove: ["schlüssel"] }
export function setUiSettings(patch = {}) {
  const cur = getUiSettings();
  const werte = { ...cur.werte };
  let geaendert = false;
  const set = patch && typeof patch.set === "object" && !Array.isArray(patch.set) ? patch.set : {};
  for (const [k, v] of Object.entries(set)) {
    if (!syncKeyErlaubt(k) || (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean")) continue;
    const s = String(v).slice(0, MAX_LEN);
    if (werte[k] === s) continue;
    if (!(k in werte) && Object.keys(werte).length >= MAX_KEYS) continue;
    werte[k] = s;
    geaendert = true;
  }
  for (const k of Array.isArray(patch?.remove) ? patch.remove : []) {
    if (syncKeyErlaubt(k) && k in werte) { delete werte[k]; geaendert = true; }
  }
  if (!geaendert) return cur;
  const neu = { werte, geaendert: new Date().toISOString() };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${UI_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(neu, null, 2));
  fs.renameSync(tmp, UI_FILE); // erst fertig schreiben, dann tauschen: nie eine halbe Datei
  return neu;
}
