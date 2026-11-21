// Whisper-Spracherkennung auf dem Mac (v1.134.0, Idee aus OpenJarvis "Speech: faster-whisper").
// Das Dashboard nimmt deinen Befehl auf und schickt die Aufnahme hierher. tools/hoeren.py (mlx-whisper,
// läuft auf dem Apple-Chip) schreibt sie mit. Kostenlos, ohne Cloud – und klappt auch in der iPhone-App,
// wenn Safari dort keine eigene Spracherkennung erlaubt.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline";
import { spawn, execFile } from "node:child_process";
import { ROOT, DATA_DIR } from "./config.js";
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";

const PYTHON = path.resolve(ROOT, "..", ".venv", "bin", "python");
const SKRIPT = path.join(ROOT, "tools", "hoeren.py");
const TMP = path.join(DATA_DIR, "tmp");
export const MODELLE = {
  schnell: { repo: process.env.FRIDAY_WHISPER || "mlx-community/whisper-small-mlx", name: "Schnell (Whisper small)" },
  genau: { repo: "mlx-community/whisper-large-v3-turbo", name: "Genau (Whisper large-v3-turbo)" },
};
// Typische Whisper-Erfindungen bei Stille oder Rauschen
const ERFUNDEN = /^(untertitel (im auftrag|der amara|von)|vielen dank (fürs|für's|für das) (zuschauen|zuhören)|bis zum nächsten mal|tschüss\.?$|copyright|swr \d|zdf|amara\.org|\.+$|♪)/i;

let geprueft = null; // { ok, grund, at }
function einstellung() { return { modell: "schnell", ...store.load("hoeren", {}) }; }
export function setzeModell(m) {
  if (!MODELLE[m]) return { error: "Unbekanntes Modell." };
  store.save("hoeren", { ...einstellung(), modell: m });
  eintragen({ bereich: "system", titel: `Whisper-Modell: ${MODELLE[m].name}`, quelle: "dashboard" });
  return status();
}

/** Ist mlx-whisper installiert? (einmal prüfen, Ergebnis 10 Minuten merken) */
export function pruefeBereit(neu = false) {
  if (!neu && geprueft && Date.now() - geprueft.at < 10 * 60 * 1000) return Promise.resolve(geprueft);
  return new Promise((ok) => {
    if (process.platform !== "darwin" && !process.env.FRIDAY_WHISPER_TEST) { geprueft = { ok: false, grund: "Whisper läuft nur auf dem Mac (Apple-Chip).", at: Date.now() }; return ok(geprueft); }
    if (!fs.existsSync(PYTHON)) { geprueft = { ok: false, grund: "Fridays Profi-Werkzeuge fehlen. Starte im Friday-Ordner „extras-installieren.sh“ (installiert Whisper).", at: Date.now() }; return ok(geprueft); }
    execFile(PYTHON, ["-I", "-c", "import mlx_whisper, imageio_ffmpeg"], { timeout: 60000 }, (err) => {
      geprueft = err ? { ok: false, grund: "Whisper ist noch nicht installiert. Starte im Friday-Ordner „extras-installieren.sh“.", at: Date.now() } : { ok: true, at: Date.now() };
      ok(geprueft);
    });
  });
}

// ---------- Der Hintergrund-Prozess ----------
let proc = null;
let bereit = null; // Promise, das erfüllt ist, wenn das Modell-Skript läuft
const offen = new Map();
let letzteNutzung = 0;
let letzteDauer = null;
let zaehler = 0;

function starte() {
  if (proc && !proc.killed && proc.exitCode == null) return bereit;
  proc = spawn(PYTHON, ["-I", SKRIPT], { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, PYTHONUNBUFFERED: "1" } });
  const p = proc;
  bereit = new Promise((ok, nein) => {
    const t = setTimeout(() => nein(new Error("Whisper startet nicht (Zeitüberschreitung).")), 90000);
    const rl = readline.createInterface({ input: p.stdout });
    rl.on("line", (z) => {
      let d;
      try { d = JSON.parse(z); } catch { return; }
      if (d.type === "bereit") { clearTimeout(t); ok(); return; }
      const w = offen.get(d.id);
      if (!w) return;
      offen.delete(d.id);
      clearTimeout(w.timer);
      if (d.error) w.nein(new Error(d.error)); else w.ok(d);
    });
    let fehler = "";
    p.stderr.on("data", (c) => { fehler = (fehler + String(c)).slice(-600); });
    p.on("exit", (code) => {
      clearTimeout(t);
      if (proc === p) proc = null;
      const e = new Error(`Whisper wurde beendet (${code ?? "?"})${fehler ? `: ${fehler.trim().split("\n").at(-1).slice(0, 200)}` : ""}`);
      nein(e);
      for (const [id, w] of offen) { clearTimeout(w.timer); w.nein(e); offen.delete(id); }
    });
  });
  bereit.catch(() => {});
  return bereit;
}

// Nach 30 Minuten ohne Nutzung den Prozess beenden (gibt den Speicher frei).
setInterval(() => { if (proc && Date.now() - letzteNutzung > 30 * 60 * 1000 && !offen.size) { try { proc.kill(); } catch { /* egal */ } proc = null; } }, 60 * 1000).unref?.();

const ENDUNG = { "audio/webm": ".webm", "audio/ogg": ".ogg", "audio/mp4": ".m4a", "audio/aac": ".aac", "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav", "video/webm": ".webm", "video/mp4": ".m4a" };

/** Schreibt eine Aufnahme mit. buf = Audio (webm/mp4/wav …). */
export async function transkribiere(buf, mime = "audio/webm") {
  const b = await pruefeBereit();
  if (!b.ok) return { error: b.grund };
  if (!buf?.length || buf.length < 800) return { text: "", leer: true };
  fs.mkdirSync(TMP, { recursive: true });
  const datei = path.join(TMP, `hoeren-${Date.now()}-${crypto.randomBytes(3).toString("hex")}${ENDUNG[String(mime).split(";")[0].trim()] || ".webm"}`);
  fs.writeFileSync(datei, buf);
  letzteNutzung = Date.now();
  const start = Date.now();
  try {
    await starte();
    const id = String(++zaehler);
    const modell = MODELLE[einstellung().modell] || MODELLE.schnell;
    const d = await new Promise((ok, nein) => {
      const timer = setTimeout(() => { offen.delete(id); nein(new Error("Whisper hat zu lange gebraucht.")); }, 120000);
      offen.set(id, { ok, nein, timer });
      proc.stdin.write(JSON.stringify({ id, datei, modell: modell.repo, sprache: "de" }) + "\n");
    });
    letzteDauer = Date.now() - start;
    let text = String(d.text || "").replace(/\s+/g, " ").trim();
    if (ERFUNDEN.test(text)) text = "";
    return { text, dauer_ms: letzteDauer, modell: einstellung().modell };
  } catch (err) {
    return { error: err.message };
  } finally {
    fs.rm(datei, { force: true }, () => {});
  }
}

export function status() {
  return {
    bereit: geprueft?.ok ?? null,
    grund: geprueft?.ok ? "" : geprueft?.grund || "",
    modell: einstellung().modell,
    modelle: Object.fromEntries(Object.entries(MODELLE).map(([k, v]) => [k, v.name])),
    geladen: Boolean(proc && proc.exitCode == null),
    letzte_dauer_ms: letzteDauer,
  };
}

export function hoerenRouten(app, asyncRoute) {
  app.get("/api/hoeren", asyncRoute(async (req, res) => { await pruefeBereit(req.query.neu === "1"); res.json(status()); }));
  app.post("/api/hoeren/modell", (req, res) => {
    const r = setzeModell(String(req.body?.modell || ""));
    if (r.error) return res.status(400).json(r);
    res.json(r);
  });
  // Modell schon mal laden (z. B. wenn das Dashboard Whisper eingestellt hat), damit der erste Befehl schnell ist.
  app.post("/api/hoeren/vorwaermen", asyncRoute(async (req, res) => {
    const b = await pruefeBereit();
    if (!b.ok) return res.json(status());
    letzteNutzung = Date.now();
    starte().catch(() => {});
    res.json(status());
  }));
  // Die Aufnahme kommt roh (Content-Type audio/…), nicht als JSON.
  app.post("/api/hoeren", asyncRoute(async (req, res) => {
    const teile = [];
    let n = 0;
    await new Promise((ok, nein) => {
      req.on("data", (c) => { n += c.length; if (n > 25 * 1024 * 1024) { req.destroy(); nein(new Error("Aufnahme zu lang.")); } else teile.push(c); });
      req.on("end", ok);
      req.on("error", nein);
    });
    const r = await transkribiere(Buffer.concat(teile), req.headers["content-type"] || "audio/webm");
    if (r.error) return res.status(503).json(r);
    res.json(r);
  }));
}
