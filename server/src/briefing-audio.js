// Briefing zum Mitnehmen (v1.169.0, Stern-Idee aus der Ideen-Schmiede).
// Jeden Morgen spricht Friday das Briefing als Audio-Datei (.m4a) ein, mit der Mac-Stimme (`say`, kostenlos),
// und legt sie in iCloud Drive → Friday → Briefings. Auf dem iPhone: Dateien-App → iCloud Drive → Friday.
// Text: das heutige Morgenbriefing, falls Claude es schon geschrieben hat, sonst das kostenlose Kurz-Briefing.
// Zusätzlich im Archiv (~/Friday-Archiv/Briefings) und zum Anhören/Herunterladen im Dashboard. Die letzten 14 Tage bleiben.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { IST_EVE } from "./config.js";
import { tagStr, uhrJetzt, sauber } from "./wunsch-hilfe.js";

const DATEI = "briefing-audio";
const ARCHIV = path.join(os.homedir(), "Friday-Archiv", "Briefings");
const ICLOUD = path.join(os.homedir(), "Library", "Mobile Documents", "com~apple~CloudDocs");
const ICLOUD_ZIEL = path.join(ICLOUD, "Friday", "Briefings");
const run = (cmd, args, timeout = 120000) => new Promise((ok, nein) => execFile(cmd, args, { timeout, maxBuffer: 8 * 1024 * 1024 }, (err, out, stderr) => (err ? nein(new Error(String(stderr || err.message).trim().split("\n")[0].slice(0, 200))) : ok(String(out)))));

export const einstellungen = () => ({ an: true, uhrzeit: "06:30", stimme: "Anna", ...(store.load(DATEI, {}).einstellungen || {}) });
export function einstellen(e = {}) {
  const d = store.load(DATEI, {});
  const alt = einstellungen();
  d.einstellungen = { an: e.an ?? alt.an, uhrzeit: /^\d{2}:\d{2}$/.test(e.uhrzeit || "") ? e.uhrzeit : alt.uhrzeit, stimme: e.stimme !== undefined ? String(e.stimme).replace(/[^\p{L}\p{N} ()._-]/gu, "").slice(0, 40) || "Anna" : alt.stimme };
  store.save(DATEI, d);
  return d.einstellungen;
}

/** Deutsche Stimmen am Mac (say -v ?). */
export async function stimmen() {
  try {
    const out = await run("say", ["-v", "?"], 15000);
    // z. B. "Anna (Deutsch (Deutschland)) de_DE    # Hallo! Ich heiße Anna." oder älter "Anna   de_DE  # …"
    return [...new Set(out.split("\n").map((z) => z.match(/^(.+?)\s+de_[A-Z]{2}\s/)).filter(Boolean).map((m) => m[1].trim()))];
  } catch { return []; }
}

async function briefingText() {
  try {
    const { getLatestBriefing } = await import("./scheduler.js");
    const b = getLatestBriefing();
    if (b?.text && tagStr(0, Date.parse(b.created)) === tagStr()) return { text: b.text, quelle: "Morgenbriefing" };
  } catch { /* weiter */ }
  const { offlineBriefing } = await import("./offline.js");
  return { text: await offlineBriefing(), quelle: "Kurz-Briefing" };
}
const ohneZeichen = (t) => String(t || "").replace(/[*_#`>|]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s+/g, " ").trim();

/** Audio-Datei für heute erzeugen. */
export async function erstellen() {
  if (process.platform !== "darwin") throw new Error("Die Audio-Datei kann nur der Mac einsprechen (Programm „say“).");
  const { text, quelle } = await briefingText();
  const tag = tagStr();
  fs.mkdirSync(ARCHIV, { recursive: true });
  const tmp = path.join(os.tmpdir(), `friday-briefing-${Date.now().toString(36)}`);
  fs.writeFileSync(`${tmp}.txt`, ohneZeichen(text), "utf8");
  const ziel = path.join(ARCHIV, `Briefing-${tag}.m4a`);
  const e = einstellungen();
  try {
    try { await run("say", ["-v", e.stimme, "-f", `${tmp}.txt`, "-o", `${tmp}.aiff`]); }
    catch { await run("say", ["-f", `${tmp}.txt`, "-o", `${tmp}.aiff`]); } // Stimme fehlt: Standardstimme
    await run("afconvert", ["-f", "m4af", "-d", "aac", "-b", "64000", `${tmp}.aiff`, ziel]);
  } finally {
    fs.rm(`${tmp}.txt`, { force: true }, () => {});
    fs.rm(`${tmp}.aiff`, { force: true }, () => {});
  }
  let icloud = false;
  if (fs.existsSync(ICLOUD)) {
    try { fs.mkdirSync(ICLOUD_ZIEL, { recursive: true }); fs.copyFileSync(ziel, path.join(ICLOUD_ZIEL, path.basename(ziel))); icloud = true; } catch { /* ohne iCloud */ }
  }
  aufraeumen();
  const d = store.load(DATEI, {});
  d.zuletzt = { tag, quelle, icloud, at: new Date().toISOString(), datei: path.basename(ziel), text: ohneZeichen(text).slice(0, 2000) };
  store.save(DATEI, d);
  logbuch.eintragen({ bereich: "briefing", titel: `Briefing als Audio gespeichert${icloud ? " (iCloud Drive)" : ""}`, details: quelle });
  return d.zuletzt;
}
function aufraeumen() {
  const grenze = tagStr(-14);
  for (const dir of [ARCHIV, ICLOUD_ZIEL]) {
    try { for (const f of fs.readdirSync(dir)) { const m = f.match(/^Briefing-(\d{4}-\d{2}-\d{2})\.m4a$/); if (m && m[1] < grenze) fs.rmSync(path.join(dir, f), { force: true }); } } catch { /* Ordner fehlt */ }
  }
}

export function liste() {
  try {
    return fs.readdirSync(ARCHIV).filter((f) => /^Briefing-\d{4}-\d{2}-\d{2}\.m4a$/.test(f)).sort().reverse().map((f) => ({ datei: f, tag: f.slice(9, 19), kb: Math.round(fs.statSync(path.join(ARCHIV, f)).size / 1024) }));
  } catch { return []; }
}
/** Pfad einer Datei (nur aus dem Briefing-Ordner). */
export function pfad(datei) {
  if (!/^Briefing-\d{4}-\d{2}-\d{2}\.m4a$/.test(String(datei || ""))) return null;
  const p = path.join(ARCHIV, datei);
  return fs.existsSync(p) ? p : null;
}
export function stand() { return { einstellungen: einstellungen(), zuletzt: store.load(DATEI, {}).zuletzt || null, dateien: liste(), icloud: fs.existsSync(ICLOUD), mac: process.platform === "darwin" }; }

/** Hintergrund: einmal am Tag zur eingestellten Uhrzeit. */
let laeuft = false;
export async function pruefen() {
  if (IST_EVE || laeuft || process.platform !== "darwin") return;
  const e = einstellungen();
  if (!e.an) return;
  const d = store.load(DATEI, {});
  if (d.zuletzt?.tag === tagStr()) return;
  const { h, m } = uhrJetzt();
  const [zh, zm] = e.uhrzeit.split(":").map(Number);
  if (h * 60 + m < zh * 60 + zm || h >= 12) return;
  laeuft = true;
  try { await erstellen(); } catch (err) { console.error("Briefing-Audio:", err.message); } finally { laeuft = false; }
}

export async function quickCommand(text) {
  const { k } = sauber(text);
  if (!/\bbriefing\b/.test(k) || !/\b(audio|datei|aufs (iphone|handy)|zum mitnehmen|mitnehmen|aufnehmen|einsprechen|als mp3|als m4a)\b/.test(k)) return null;
  try {
    const z = await erstellen();
    return { answer: `Fertig. Das Briefing liegt als Audio-Datei ${z.icloud ? "in iCloud Drive im Ordner Friday, Briefings. Auf dem iPhone findest du es in der Dateien-App" : "im Friday-Archiv unter Briefings"}.`, actions: ["wunsch:briefingaudio"] };
  } catch (err) {
    return { answer: `Das Audio-Briefing hat nicht geklappt: ${err.message}`, actions: ["wunsch:briefingaudio"] };
  }
}
