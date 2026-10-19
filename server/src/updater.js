// Updates: vergleicht die eigene Version mit der auf GitHub und startet das Update-Skript.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { config, ROOT, DATA_DIR } from "./config.js";

const APP_DIR = path.resolve(ROOT, "..");
const SCRIPT = path.join(APP_DIR, "update.sh");
const STATUS_FILE = path.join(DATA_DIR, "update.json");

export function localVersion() {
  try {
    return fs.readFileSync(path.join(APP_DIR, "VERSION"), "utf8").trim();
  } catch {
    return "0.0.0";
  }
}

// Ist Version a neuer als b? (z. B. "1.2.0" gegen "1.1.9")
function isNewer(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

const validRepo = () => /^[\w.-]+\/[\w.-]+$/.test(config.updateRepo) && /^[\w./-]+$/.test(config.updateBranch);

export async function checkForUpdate() {
  const installed = localVersion();
  if (!validRepo()) return { installed, error: "UPDATE_REPO oder UPDATE_BRANCH in der .env ist ungültig." };
  const url = `https://raw.githubusercontent.com/${config.updateRepo}/${config.updateBranch}/VERSION`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch {
    return { installed, error: "GitHub ist gerade nicht erreichbar." };
  }
  if (res.status === 404) return { installed, error: "Auf GitHub liegt noch keine Friday-Version." };
  if (!res.ok) return { installed, error: `GitHub antwortet mit Fehler ${res.status}.` };
  const latest = (await res.text()).trim().split("\n")[0].replace(/[^0-9.]/g, "");
  if (!latest) return { installed, error: "Die Versionsdatei auf GitHub ist leer." };
  return { installed, latest, available: isNewer(latest, installed) };
}

export function getUpdateStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8"));
  } catch {
    return null;
  }
}

export function startUpdate() {
  const current = getUpdateStatus();
  if (current?.state === "laeuft" && Date.now() - new Date(current.time).getTime() < 10 * 60 * 1000) {
    return { error: "Es läuft schon ein Update." };
  }
  if (!fs.existsSync(SCRIPT)) return { error: "Das Update-Skript fehlt." };
  const logDir = path.join(os.homedir(), "Library", "Logs", "Friday");
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ state: "laeuft", message: "Update startet...", time: new Date().toISOString() }));
  const log = fs.openSync(path.join(logDir, "update.log"), "a");
  // Eigene Prozessgruppe, damit das Skript den Neustart von Friday überlebt.
  const child = spawn("/bin/bash", [SCRIPT], {
    cwd: APP_DIR,
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, FRIDAY_NODE: process.execPath },
  });
  child.unref();
  fs.closeSync(log);
  return { ok: true, info: "Update läuft. Friday startet gleich neu." };
}
