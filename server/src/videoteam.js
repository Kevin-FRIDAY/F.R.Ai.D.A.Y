// Fridays Videoschnitt-Team: startet tools/videoteam.py und sammelt, was die Agenten melden.
// Clips kommen aus ~/Friday-Video/Eingang, das fertige 9:16-Video landet in ~/Friday-Video/Fertig.
import { eintragen } from "./logbuch.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { kiClient, ersatzBereit } from "./ki-client.js";
import { config, ROOT } from "./config.js";
import { recordUsage } from "./energie.js";
import { leseAnweisung } from "./regieplan.js";

const BASE = process.env.FRIDAY_VIDEO_DIR || path.join(os.homedir(), "Friday-Video");
export const VIDEO_DIRS = {
  eingang: path.join(BASE, "Eingang"),
  fertig: path.join(BASE, "Fertig"),
  luts: path.join(BASE, "LUTs"),
  musik: path.join(BASE, "Musik"),
};
const PYTHON = path.resolve(ROOT, "..", ".venv", "bin", "python");
const SCRIPT = path.join(ROOT, "tools", "videoteam.py");
const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm)$/i;
export const LOOKS = ["natürlich", "warm", "kühl", "kino", "schwarzweiss", "retro", "neon"];
export const TEAM = [
  ["regie", "Regie", "Plan machen, verteilen, zusammensetzen, prüfen"],
  ["transkript", "Transkript", "Jedes Wort mit Zeitstempel (Whisper, lokal)"],
  ["schnitt", "Schnitt", "Pausen und Ähms raus"],
  ["farbe", "Farbe", "Helligkeit angleichen, Look auflegen"],
  ["untertitel", "Untertitel", "Animierte Untertitel im TikTok-Stil"],
  ["audio", "Audio", "Lautstärke angleichen, Rauschen raus, Musik ducken"],
];

let job = null;

function ensureDirs() {
  for (const d of Object.values(VIDEO_DIRS)) fs.mkdirSync(d, { recursive: true });
}

function listClips() {
  try {
    return fs.readdirSync(VIDEO_DIRS.eingang).filter((f) => VIDEO_EXT.test(f)).sort();
  } catch {
    return [];
  }
}

export function videoTeamReady() {
  return fs.existsSync(PYTHON) && fs.existsSync(SCRIPT);
}

export function getVideoJob() {
  ensureDirs();
  return {
    ready: videoTeamReady(),
    dirs: VIDEO_DIRS,
    clips: listClips(),
    looks: LOOKS,
    team: TEAM.map(([id, name, job]) => ({ id, name, job })),
    job,
  };
}

const short = (s, n = 160) => String(s || "").slice(0, n);

/** Kevins Anweisung („auf 30 Sekunden, nur die besten Stellen, Kino-Look …“) → Vorgaben für das Team. */
export function schnittVorgaben(anweisung = "", look) {
  const p = leseAnweisung(anweisung, { art: "schnitt" });
  const hex = p.farbe?.hex || null;
  return {
    anweisung: String(anweisung || "").slice(0, 900),
    look: p.look || (LOOKS.includes(look) ? look : "natürlich"),
    pausen: p.pausen || "normal",            // hart = jede Pause raus, sanft = Atempausen bleiben
    aehms: p.aehms || "raus",
    maxSekunden: p.maxSekunden || null,
    auswahl: p.auswahl || (p.maxSekunden ? "beste" : null),
    fokus: p.fokus,
    untertitel: p.untertitel !== false,
    musik: p.musik === "aus" ? "aus" : "an",
    titel: p.texte[0] || "",
    abspann: p.cta || p.texte[1] || "",
    farbe: hex,
    verstanden: p.verstanden,
  };
}

export function startVideoJob({ look, anweisung } = {}) {
  ensureDirs();
  if (!videoTeamReady()) return { ok: false, error: "Das Schnitt-Team ist auf diesem Mac nicht installiert (Python-Umgebung fehlt)." };
  if (job && job.status === "läuft") return { ok: false, error: "Das Team schneidet gerade schon ein Video." };
  const clips = listClips();
  if (!clips.length) return { ok: false, error: `Keine Clips gefunden. Leg deine Videos in den Ordner ${VIDEO_DIRS.eingang}.` };
  const vorgaben = schnittVorgaben(anweisung, look);
  const chosenLook = vorgaben.look;
  job = {
    id: Date.now(), status: "läuft", started: new Date().toISOString(), look: chosenLook, clips, vorgaben,
    agents: Object.fromEntries(TEAM.map(([id]) => [id, { status: "wartet", text: "", pct: 0 }])),
    log: [], plan: null, subs: null, levels: null, result: null, error: null,
  };
  const current = job;
  const proc = spawn(PYTHON, [SCRIPT], { cwd: path.dirname(SCRIPT), env: { ...process.env, FRIDAY_VIDEO_DIR: BASE, FRIDAY_LOOK: chosenLook, FRIDAY_VORGABEN: JSON.stringify(vorgaben) } });
  let buf = "";
  proc.stdout.on("data", (chunk) => {
    buf += chunk.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("{")) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      handle(current, msg);
    }
  });
  let errTail = "";
  proc.stderr.on("data", (chunk) => { errTail = (errTail + chunk.toString()).slice(-2000); });
  proc.on("error", (e) => { current.status = "fehler"; current.error = `Das Schnitt-Team ließ sich nicht starten (${e.code || e.message}).`; });
  proc.on("close", async (code) => {
    if (current.status === "läuft") {
      current.status = code === 0 && current.result ? "fertig" : "fehler";
      if (current.status === "fehler" && !current.error) current.error = short(errTail.trim().split("\n").pop() || `Abbruch (Code ${code})`, 300);
    }
    current.ended = new Date().toISOString();
    if (current.status === "fertig") await writeCaption(current).catch(() => {});
    eintragen(current.status === "fertig"
      ? { bereich: "video", titel: `Video fertig geschnitten (${current.clips?.length || 0} Clips, Look ${current.look}${current.vorgaben?.anweisung ? `, Anweisung: ${current.vorgaben.anweisung.slice(0, 60)}` : ""})`, details: current.result?.name || current.result?.file || "", quelle: "automatisch" }
      : { bereich: "video", titel: "Videoschnitt abgebrochen", details: current.error || "", quelle: "automatisch", ok: false });
  });
  return { ok: true, clips: clips.length, look: chosenLook, verstanden: vorgaben.verstanden };
}

function handle(j, msg) {
  if (msg.type === "agent" && j.agents[msg.agent]) {
    const a = j.agents[msg.agent];
    a.status = msg.status;
    a.text = short(msg.text);
    if (msg.pct !== null && msg.pct !== undefined) a.pct = msg.pct;
    j.log.push({ t: Date.now(), agent: msg.agent, text: short(msg.text) });
    if (j.log.length > 80) j.log.shift();
  } else if (msg.type === "plan") j.plan = msg;
  else if (msg.type === "subs") j.subs = msg.blocks.slice(0, 400);
  else if (msg.type === "levels") j.levels = msg.levels;
  else if (msg.type === "auswahl") j.auswahl = { behalten: msg.behalten, von: msg.von, grund: short(msg.grund, 200) };
  else if (msg.type === "done") j.result = { file: msg.file, name: msg.name, dur: msg.dur, transcript: msg.transcript };
  else if (msg.type === "error") { j.status = "fehler"; j.error = short(msg.error, 300); }
}

// Regie (Claude) schreibt zum fertigen Video eine kurze Bildunterschrift mit Hashtags.
async function writeCaption(j) {
  if ((!config.anthropicKey && !ersatzBereit()) || !j.result?.transcript) return;
  try {
    const client = kiClient();
    const res = await client.messages.create({
      model: config.model,
      max_tokens: 300,
      messages: [{ role: "user", content: `Schreib zu diesem Kurzvideo eine knackige TikTok-Bildunterschrift auf Deutsch (höchstens 2 Sätze) und danach 4 passende Hashtags. Nur der Text, keine Erklärung.\n\nGesprochener Text im Video:\n${j.result.transcript}` }],
    });
    recordUsage(res.model || config.model, res.usage, "schnitt");
    const caption = (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    if (caption) {
      j.result.caption = caption;
      fs.writeFileSync(j.result.file.replace(/\.mp4$/, ".txt"), caption + "\n");
    }
  } catch { /* Bildunterschrift ist optional */ }
}

// Ordner im Finder öffnen (auf dem Mac, auf dem Friday läuft).
export function openVideoDir(which) {
  ensureDirs();
  const dir = VIDEO_DIRS[which];
  if (!dir) return { ok: false, error: "Unbekannter Ordner" };
  execFile("open", [dir], () => {});
  return { ok: true, dir };
}
