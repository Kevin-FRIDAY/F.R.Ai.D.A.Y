// Fridays Server-Einstellungen (gelten für alle Geräte): Auto-Update und Vorladen im Hintergrund.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config.js";

const FILE = path.join(DATA_DIR, "einstellungen.json");
const DEFAULTS = {
  autoUpdate: true,       // neue Versionen von GitHub selbst installieren, wenn gerade nichts los ist
  vorladen: true,         // Welt-Alarm, Welt-Videos usw. im Hintergrund frisch halten
  marktVorrechnen: true,  // Kronos-Prognosen im Hintergrund nachrechnen (braucht Rechenleistung)
};

export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setSettings(patch = {}) {
  const s = getSettings();
  for (const k of Object.keys(DEFAULTS)) if (typeof patch[k] === "boolean") s[k] = patch[k];
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
