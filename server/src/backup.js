// Sicherungen: legt Kopien von Einstellungen, Schlüsseln, Gedächtnis und eigenen Protokollen an
// und spielt sie bei Bedarf zurück. Die eigentliche Arbeit machen sicherung.sh und wiederherstellen.sh.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { config, ROOT, DATA_DIR } from "./config.js";

const APP_DIR = path.resolve(ROOT, "..");
const BACKUP_SCRIPT = path.join(APP_DIR, "sicherung.sh");
const RESTORE_SCRIPT = path.join(APP_DIR, "wiederherstellen.sh");
const STATUS_FILE = path.join(DATA_DIR, "wiederherstellung.json");
const NAME_RE = /^20\d{2}-\d{2}-\d{2}_[0-9A-Za-z_.-]+$/;
const DAY = 24 * 3600 * 1000;

export function backupDir() {
  const dir = config.backupDir || path.join(os.homedir(), "Friday-Backups");
  return dir.replace(/^~(?=$|\/)/, os.homedir());
}

function folderSize(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += folderSize(p);
    else if (e.isFile()) total += fs.statSync(p).size;
  }
  return total;
}

export function listBackups() {
  const dir = backupDir();
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((n) => NAME_RE.test(n));
  } catch {
    return [];
  }
  return names
    .sort()
    .reverse()
    .map((name) => {
      let info = {};
      try {
        info = JSON.parse(fs.readFileSync(path.join(dir, name, "info.json"), "utf8"));
      } catch {
        return null;
      }
      let size = 0;
      try { size = folderSize(path.join(dir, name)); } catch { /* egal */ }
      return { name, grund: info.grund || "", version: info.version || "", zeit: info.zeit || "", programm: Boolean(info.programm), groesse: size };
    })
    .filter(Boolean);
}

let running = null;
export function createBackup(grund = "manuell", { programm = false } = {}) {
  if (running) return running;
  if (!fs.existsSync(BACKUP_SCRIPT)) return Promise.reject(new Error("Das Sicherungs-Skript fehlt."));
  const args = [BACKUP_SCRIPT, grund];
  if (programm) args.push("--programm");
  running = new Promise((resolve, reject) => {
    execFile("/bin/bash", args, { cwd: APP_DIR, timeout: 120000 }, (err, stdout, stderr) => {
      running = null;
      if (err) return reject(new Error(String(stderr || err.message).trim().split("\n").pop()));
      const name = String(stdout).trim().split("\n").pop();
      resolve(listBackups().find((b) => b.name === name) || { name });
    });
  });
  return running;
}

export function getRestoreStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8"));
  } catch {
    return null;
  }
}

export function startRestore(name, { programm = false } = {}) {
  if (!NAME_RE.test(String(name))) return { error: "Ungültige Sicherung." };
  const backup = listBackups().find((b) => b.name === name);
  if (!backup) return { error: "Diese Sicherung gibt es nicht." };
  if (programm && !backup.programm) return { error: "In dieser Sicherung ist keine Programmversion." };
  if (!fs.existsSync(RESTORE_SCRIPT)) return { error: "Das Wiederherstellen-Skript fehlt." };
  const current = getRestoreStatus();
  if (current?.state === "laeuft" && Date.now() - new Date(current.time).getTime() < 10 * 60 * 1000) {
    return { error: "Es läuft schon eine Wiederherstellung." };
  }
  const logDir = path.join(os.homedir(), "Library", "Logs", "Friday");
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ state: "laeuft", message: "Wiederherstellung startet...", time: new Date().toISOString() }));
  const log = fs.openSync(path.join(logDir, "wiederherstellung.log"), "a");
  const args = [RESTORE_SCRIPT, name];
  if (programm) args.push("--programm");
  // Eigene Prozessgruppe, damit das Skript den Neustart von Friday überlebt.
  const child = spawn("/bin/bash", args, {
    cwd: APP_DIR,
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, FRIDAY_NODE: process.execPath },
  });
  child.unref();
  fs.closeSync(log);
  return { ok: true, info: "Wiederherstellung läuft. Friday startet gleich neu." };
}

// Einmal am Tag automatisch sichern (wenn die letzte Sicherung älter als 24 Stunden ist).
export async function autoBackup() {
  const latest = listBackups()[0];
  if (latest && Date.now() - new Date(latest.zeit).getTime() < DAY) return null;
  return createBackup("automatisch");
}
