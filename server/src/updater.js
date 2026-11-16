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

// Die Version, mit der dieser Server gestartet ist. Die VERSION-Datei wechselt schon mitten im
// Update; erst nach dem Neustart läuft die neue Version wirklich.
const BOOT_VERSION = localVersion();
export const runningVersion = () => BOOT_VERSION;

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

// ---------- GitHub-Schlüssel (für ein privates Repo) ----------
// Steht in data/github.json (im Dashboard eingetragen) oder in der .env als FRIDAY_GITHUB_TOKEN.
// Ohne Schlüssel lädt Friday wie bisher aus dem öffentlichen Repo.
const TOKEN_FILE = path.join(DATA_DIR, "github.json");
// Nur für Tests änderbar (z. B. auf einen Probe-Server).
const API = () => String(process.env.FRIDAY_GITHUB_API || "https://api.github.com").replace(/\/$/, "");
const RAW = () => String(process.env.FRIDAY_GITHUB_RAW || "https://raw.githubusercontent.com").replace(/\/$/, "");

function savedToken() {
  try {
    return String(JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")).token || "").trim();
  } catch {
    return "";
  }
}
export function githubToken() {
  return savedToken() || String(config.githubToken || "").trim();
}
const validToken = (t) => /^[A-Za-z0-9_]{20,255}$/.test(t);

export function githubTokenStatus() {
  const saved = savedToken();
  return { set: Boolean(githubToken()), source: saved ? "dashboard" : config.githubToken ? "env" : null };
}

// Schlüssel speichern: erst bei GitHub prüfen, ob er das Repo lesen darf.
export async function setGithubToken(raw) {
  const tok = String(raw || "").trim();
  if (!validToken(tok)) return { ok: false, error: "Das sieht nicht wie ein GitHub-Schlüssel aus. Er beginnt mit github_pat_ oder ghp_." };
  if (!validRepo()) return { ok: false, error: "UPDATE_REPO oder UPDATE_BRANCH in der .env ist ungültig." };
  const r = await fetchVersion(tok);
  if (r.error) return { ok: false, error: r.error };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token: tok, saved: new Date().toISOString() }, null, 2), { mode: 0o600 });
  try { fs.chmodSync(TOKEN_FILE, 0o600); } catch { /* egal */ }
  return { ok: true, latest: r.latest, ...githubTokenStatus() };
}

export function forgetGithubToken() {
  try { fs.unlinkSync(TOKEN_FILE); } catch { /* war schon weg */ }
  return { ok: true, ...githubTokenStatus() };
}

// Holt die VERSION-Datei von GitHub. Mit Schlüssel über die GitHub-API (klappt auch bei privatem Repo).
async function fetchVersion(tok) {
  const repo = config.updateRepo;
  const branch = config.updateBranch;
  const url = tok
    ? `${API()}/repos/${repo}/contents/VERSION?ref=${encodeURIComponent(branch)}`
    : `${RAW()}/${repo}/${branch}/VERSION`;
  const headers = tok
    ? { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github.raw", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Friday-Updater" }
    : {};
  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch {
    return { error: "GitHub ist gerade nicht erreichbar." };
  }
  if (tok && res.status === 401) return { error: "Der GitHub-Schlüssel stimmt nicht oder ist abgelaufen. Erstelle auf github.com einen neuen und trag ihn in den Einstellungen ein." };
  if (tok && (res.status === 403 || res.status === 404)) return { error: "Der GitHub-Schlüssel darf das Friday-Repo nicht lesen. Beim Erstellen das Repo auswählen und \"Contents: Read-only\" erlauben." };
  if (res.status === 404) return { error: "Kein Zugriff auf das Friday-Repo. Ist es privat? Dann trag in den Einstellungen → Immer aktuell deinen GitHub-Schlüssel ein.", needsToken: true };
  if (!res.ok) return { error: `GitHub antwortet mit Fehler ${res.status}.` };
  const latest = (await res.text()).trim().split("\n")[0].replace(/[^0-9.]/g, "");
  if (!latest) return { error: "Die Versionsdatei auf GitHub ist leer." };
  return { latest };
}

export async function checkForUpdate() {
  const installed = localVersion();
  if (!validRepo()) return { installed, error: "UPDATE_REPO oder UPDATE_BRANCH in der .env ist ungültig." };
  const r = await fetchVersion(githubToken());
  if (r.error) return { installed, error: r.error, needsToken: r.needsToken || undefined };
  return { installed, latest: r.latest, available: isNewer(r.latest, installed) };
}

export function getUpdateStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8"));
  } catch {
    return null;
  }
}

// Kurzfassung für den Ladebalken im Dashboard (ohne GitHub-Abfrage, darf oft abgefragt werden).
export function updateProgress() {
  const st = getUpdateStatus();
  if (!st) return { installed: BOOT_VERSION, status: null };
  const alter = Date.now() - new Date(st.time).getTime();
  // Ein "läuft", das seit 10 Minuten nichts mehr gemeldet hat, ist hängen geblieben.
  const status = st.state === "laeuft" && alter > 10 * 60 * 1000 ? { ...st, state: "fehler", message: "Das Update hängt. Schau in ~/Library/Logs/Friday/update.log nach." } : st;
  return { installed: BOOT_VERSION, status, alterSek: Math.round(alter / 1000) };
}

export function startUpdate({ auto = false } = {}) {
  const current = getUpdateStatus();
  if (current?.state === "laeuft" && Date.now() - new Date(current.time).getTime() < 10 * 60 * 1000) {
    return { error: "Es läuft schon ein Update." };
  }
  if (!fs.existsSync(SCRIPT)) return { error: "Das Update-Skript fehlt." };
  const logDir = path.join(os.homedir(), "Library", "Logs", "Friday");
  fs.mkdirSync(logDir, { recursive: true });
  const jetzt = new Date().toISOString();
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ state: "laeuft", message: "Update startet...", step: "start", percent: 3, von: localVersion(), auto: Boolean(auto), started: jetzt, time: jetzt }));
  const log = fs.openSync(path.join(logDir, "update.log"), "a");
  // Eigene Prozessgruppe, damit das Skript den Neustart von Friday überlebt.
  const child = spawn("/bin/bash", [SCRIPT], {
    cwd: APP_DIR,
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, FRIDAY_NODE: process.execPath, FRIDAY_GITHUB_TOKEN: githubToken(), FRIDAY_UPDATE_AUTO: auto ? "1" : "0" },
  });
  child.unref();
  fs.closeSync(log);
  return { ok: true, info: "Update läuft. Friday startet gleich neu." };
}
