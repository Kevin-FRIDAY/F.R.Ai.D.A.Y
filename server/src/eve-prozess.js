// Eve als eigener Prozess (v1.138.0).
// Friday startet Eve im Hintergrund: gleicher Code, aber eigener Datenordner (server/data/eve-daten)
// und eigene Ordner im Benutzerordner (~/Friday-Eve/…). So verändert nichts, was du in Eve machst,
// Fridays Termine, Listen, Gedächtnis oder Einstellungen.
// Das Dashboard schickt im Eve-Modus ein Merkzeichen (Cookie friday_eve=1) mit, Friday reicht die
// Anfrage dann an Eve weiter. Darum bleibt die Adresse gleich (auch übers iPhone/Tailscale).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { config, ROOT, FRIDAY_DATA_DIR, IST_EVE } from "./config.js";
import { eintragen } from "./logbuch.js";
import { isAgentOnline, getAgentInfo, sendToAgent, EVE_LESEN } from "./agent-hub.js";

export const EVE_DATEN = path.join(FRIDAY_DATA_DIR, "eve-daten");
const EVE_HOME = path.join(os.homedir(), "Friday-Eve");
export const evePort = () => Number(process.env.FRIDAY_EVE_PORT_FEST || 0) || config.port + 1000;
const LOG = () => path.join(EVE_DATEN, "eve-server.log");

let kind = null;
let zustand = { laeuft: false, seit: null, fehler: "", neustarts: 0, kopiert: null };
let neustartZeiten = [];
let gestoppt = false;

/** Fridays Daten einmal nach Eve kopieren (ohne Eve selbst und ohne Eves Wunschliste). */
export function eveDatenAnlegen({ neu = false } = {}) {
  if (neu) fs.rmSync(EVE_DATEN, { recursive: true, force: true });
  if (fs.existsSync(path.join(EVE_DATEN, ".eve-kopie"))) return false;
  fs.mkdirSync(EVE_DATEN, { recursive: true });
  for (const name of fs.readdirSync(FRIDAY_DATA_DIR)) {
    if (name === "eve-daten" || name === "eve.json") continue;
    fs.cpSync(path.join(FRIDAY_DATA_DIR, name), path.join(EVE_DATEN, name), { recursive: true, force: true, errorOnExist: false });
  }
  const jetzt = new Date().toISOString();
  fs.writeFileSync(path.join(EVE_DATEN, ".eve-kopie"), jetzt);
  zustand.kopiert = jetzt;
  return true;
}

function kopiertAm() {
  try { return fs.readFileSync(path.join(EVE_DATEN, ".eve-kopie"), "utf8").trim(); } catch { return null; }
}

export function eveStarten() {
  if (IST_EVE || kind || process.env.FRIDAY_OHNE_EVE === "1") return;
  gestoppt = false;
  try { eveDatenAnlegen(); } catch (e) { zustand.fehler = `Eve-Daten konnten nicht angelegt werden: ${e.message}`; console.error(zustand.fehler); return; }
  for (const d of ["Archiv", "Downloads", "Spiele", "Webseiten", "Video"]) { try { fs.mkdirSync(path.join(EVE_HOME, d), { recursive: true }); } catch { /* egal */ } }
  let out = "ignore";
  try { out = fs.openSync(LOG(), "w"); } catch { /* ohne Protokoll */ }
  kind = spawn(process.execPath, [path.join(ROOT, "src", "index.js")], {
    cwd: ROOT,
    stdio: ["ignore", out, out, "ipc"],
    env: {
      ...process.env,
      FRIDAY_EVE: "1",
      FRIDAY_EVE_PORT: String(evePort()),
      FRIDAY_DATA_DIR: EVE_DATEN,
      FRIDAY_ARCHIV_DIR: path.join(EVE_HOME, "Archiv"),
      FRIDAY_DOWNLOADS_DIR: path.join(EVE_HOME, "Downloads"),
      FRIDAY_SPIELE_DIR: path.join(EVE_HOME, "Spiele"),
      FRIDAY_WEB_DIR: path.join(EVE_HOME, "Webseiten"),
      FRIDAY_VIDEO_DIR: path.join(EVE_HOME, "Video"),
      FRIDAY_OHNE_TESTLABOR: "1",
    },
  });
  zustand = { ...zustand, laeuft: true, seit: new Date().toISOString(), fehler: "", kopiert: kopiertAm() };
  // v1.139.0: Eve darf über Friday am Mac LESEN (Kalender, Fotos, Kurzbefehle-Liste …), nie etwas auslösen.
  const meldeMac = () => { try { kind?.connected && kind.send({ typ: "agent_status", online: isAgentOnline(), info: getAgentInfo() }); } catch { /* Eve startet noch */ } };
  const macTakt = setInterval(meldeMac, 3000);
  setTimeout(meldeMac, 1500);
  kind.on("message", async (m) => {
    if (m?.typ !== "agent_lesen" || typeof m.id !== "string") return;
    const antwort = EVE_LESEN.has(m.action)
      ? await sendToAgent(m.action, m.params || {}, Math.min(130000, Math.max(1000, Number(m.timeoutMs) || 20000)))
      : { ok: false, error: "In Eve nicht erlaubt." };
    try { kind?.connected && kind.send({ typ: "agent_antwort", id: m.id, antwort }); } catch { /* Eve weg */ }
  });
  kind.on("exit", () => clearInterval(macTakt));
  kind.on("exit", (code) => {
    kind = null;
    zustand.laeuft = false;
    if (gestoppt) return;
    zustand.fehler = `Eve wurde beendet (Code ${code}). Protokoll: server/data/eve-daten/eve-server.log`;
    const jetzt = Date.now();
    neustartZeiten = neustartZeiten.filter((t) => jetzt - t < 10 * 60 * 1000);
    if (neustartZeiten.length >= 5) { zustand.fehler += " – zu viele Abstürze, Eve bleibt aus bis zum nächsten Friday-Neustart."; console.error(zustand.fehler); return; }
    neustartZeiten.push(jetzt);
    zustand.neustarts += 1;
    setTimeout(eveStarten, 5000);
  });
}

export function eveStoppen() {
  gestoppt = true;
  if (!kind) return Promise.resolve();
  return new Promise((ok) => {
    const k = kind;
    const t = setTimeout(() => { try { k.kill("SIGKILL"); } catch { /* egal */ } ok(); }, 4000);
    k.once("exit", () => { clearTimeout(t); ok(); });
    try { k.kill("SIGTERM"); } catch { clearTimeout(t); ok(); }
  });
}

/** Eve auf den heutigen Friday-Stand zurücksetzen (Eves Testdaten werden gelöscht). */
export async function eveZuruecksetzen() {
  await eveStoppen();
  eveDatenAnlegen({ neu: true });
  eintragen({ bereich: "system", quelle: "eve", titel: "Eve auf Friday-Stand zurückgesetzt" });
  eveStarten();
  return eveZustand();
}

export function eveZustand() {
  return { ...zustand, laeuft: Boolean(kind), port: evePort(), kopiert: kopiertAm() };
}

// In Eve: beenden, sobald Friday weg ist (kein verwaister Prozess, der den Port blockiert).
if (IST_EVE && process.send) {
  process.on("disconnect", () => process.exit(0));
}
// In Friday: Eve mit beenden.
if (!IST_EVE) {
  const aus = () => { try { kind?.kill("SIGTERM"); } catch { /* egal */ } };
  process.on("exit", aus);
  for (const sig of ["SIGTERM", "SIGINT"]) process.once(sig, () => { aus(); process.exit(0); });
}

// ---------- Weiterleitung im Dashboard ----------
const istEveAnfrage = (req) => req.headers["x-friday-eve"] === "1" || /(?:^|;\s*)friday_eve=1(?:;|$)/.test(String(req.headers.cookie || ""));
// Diese Wege bleiben immer bei Friday: Eves Werkbank (Wünsche, Freigaben, Schloss) gehört Friday.
const BLEIBT_BEI_FRIDAY = /^\/api\/eve(\/|$)/;

/** Express-Middleware: Anfragen aus dem Eve-Modus an den Eve-Prozess durchreichen. */
export function eveWeiterleitung(req, res, next) {
  if (IST_EVE || !req.path.startsWith("/api/") || BLEIBT_BEI_FRIDAY.test(req.path) || !istEveAnfrage(req)) return next();
  if (!kind) {
    return res.status(503).json({ error: zustand.fehler || "Eve startet gerade. Versuch es in ein paar Sekunden nochmal.", eve: true });
  }
  const headers = { ...req.headers, host: `127.0.0.1:${evePort()}` };
  const p = http.request({ host: "127.0.0.1", port: evePort(), method: req.method, path: req.originalUrl, headers }, (r) => {
    res.writeHead(r.statusCode || 502, { ...r.headers, "x-friday-eve": "1" });
    r.pipe(res);
  });
  p.on("error", () => { if (!res.headersSent) res.status(503).json({ error: "Eve antwortet gerade nicht. Sie startet neu, versuch es gleich nochmal.", eve: true }); else res.end(); });
  req.on("aborted", () => p.destroy());
  req.pipe(p);
}
