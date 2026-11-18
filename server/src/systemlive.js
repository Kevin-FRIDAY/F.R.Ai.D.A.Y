// Live-Werte für die System-Zentrale: Prozessor, Arbeitsspeicher, Speicherplatz, Fridays eigener Verbrauch.
// Alles lokal vom Mac gelesen (Node "os"/"fs"), kostet nichts und braucht kein Internet.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config.js";

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const rund = (v, s = 1) => Math.round(v * 10 ** s) / 10 ** s;

// CPU-Auslastung = Unterschied zwischen zwei Messungen der Prozessor-Zeiten.
function cpuZeiten() {
  let idle = 0, total = 0;
  for (const c of os.cpus()) {
    for (const [k, v] of Object.entries(c.times)) { total += v; if (k === "idle") idle += v; }
  }
  return { idle, total };
}
let letzte = cpuZeiten();
let letzteProzent = 0;
const verlauf = []; // { t, cpu, ram } – die letzten 60 Messungen (alle ~5 s)

function messen() {
  const jetzt = cpuZeiten();
  const dT = jetzt.total - letzte.total;
  const dI = jetzt.idle - letzte.idle;
  if (dT > 0) letzteProzent = Math.max(0, Math.min(100, Math.round((1 - dI / dT) * 100)));
  letzte = jetzt;
  const ram = Math.round((1 - os.freemem() / os.totalmem()) * 100);
  verlauf.push({ t: Date.now(), cpu: letzteProzent, ram });
  while (verlauf.length > 60) verlauf.shift();
}
messen();
setInterval(messen, 5000).unref();

function speicherplatz() {
  try {
    const s = fs.statfsSync(os.homedir());
    const gesamt = s.blocks * s.bsize;
    const frei = s.bavail * s.bsize;
    return { gesamtGB: rund(gesamt / GB), freiGB: rund(frei / GB), prozent: Math.round((1 - frei / gesamt) * 100) };
  } catch {
    return null;
  }
}

// Größe von Fridays Datenordner (Gedächtnis, Archiv, Einstellungen). Höchstens 2 Ebenen tief, damit es schnell bleibt.
function ordnerGroesse(dir, tiefe = 0) {
  let summe = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isFile()) summe += fs.statSync(p).size;
      else if (e.isDirectory() && tiefe < 2) summe += ordnerGroesse(p, tiefe + 1);
    }
  } catch { /* fehlt */ }
  return summe;
}
let datenCache = { t: 0, mb: 0 };
function datenMB() {
  if (Date.now() - datenCache.t > 60000) datenCache = { t: Date.now(), mb: rund(ordnerGroesse(DATA_DIR) / MB) };
  return datenCache.mb;
}

export function systemLive() {
  const mem = process.memoryUsage();
  const ramGesamt = os.totalmem(), ramFrei = os.freemem();
  const plattform = { darwin: "macOS", linux: "Linux", win32: "Windows" }[process.platform] || process.platform;
  return {
    zeit: Date.now(),
    cpu: {
      prozent: letzteProzent,
      kerne: os.cpus().length,
      modell: (os.cpus()[0]?.model || "").replace(/\s+/g, " ").trim(),
      last: os.loadavg().map((v) => rund(v, 2)),
    },
    ram: { gesamtGB: rund(ramGesamt / GB), belegtGB: rund((ramGesamt - ramFrei) / GB), prozent: Math.round((1 - ramFrei / ramGesamt) * 100) },
    platte: speicherplatz(),
    friday: { ramMB: Math.round(mem.rss / MB), heapMB: Math.round(mem.heapUsed / MB), laufzeit: Math.round(process.uptime()), node: process.version, datenMB: datenMB() },
    rechner: { plattform, version: os.release(), laufzeit: Math.round(os.uptime()), arch: process.arch },
    verlauf: verlauf.map((v) => ({ cpu: v.cpu, ram: v.ram })),
  };
}
