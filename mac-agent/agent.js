// F.R.Ai.D.A.Y Mac-Agent: Fridays "Hände" auf dem Mac.
// Führt nur die fest eingebauten Aktionen aus, niemals beliebige Befehle.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import WebSocket from "ws";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(here, ".env");
const fileEnv = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, "utf8")) : {};
const env = (name, fallback) => (fileEnv[name] ?? process.env[name] ?? "").trim() || fallback;

const SERVER_URL = env("SERVER_URL", "ws://127.0.0.1:3000/agent");
const AGENT_TOKEN = env("AGENT_TOKEN", "");
const MUSIC_APP = env("MUSIC_APP", "Music");
const SAY_VOICE = env("SAY_VOICE", "Anna");

if (!AGENT_TOKEN) {
  console.error("AGENT_TOKEN fehlt in mac-agent/.env");
  process.exit(1);
}

function run(cmd, args, timeout = 15000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve(stdout.trim());
    });
  });
}

// AppleScript mit Argumenten: Texte werden als argv übergeben, nie in den Code eingesetzt.
function osa(script, ...args) {
  return run("osascript", ["-e", `on run argv\n${script}\nend run`, ...args.map(String)]);
}

const clampVolume = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

const actions = {
  async open_app({ value }) {
    await run("open", ["-a", value]);
    return `${value} geöffnet`;
  },
  async quit_app({ value }) {
    await osa('tell application (item 1 of argv) to quit', value);
    return `${value} beendet`;
  },
  async open_url({ value }) {
    if (!/^https?:\/\//i.test(value)) throw new Error("Nur http- und https-Links erlaubt");
    await run("open", [value]);
    return "Link geöffnet";
  },
  async volume_set({ value }) {
    await osa("set volume output volume (item 1 of argv as integer)", clampVolume(value));
    return `Lautstärke ${clampVolume(value)} %`;
  },
  async volume_up() {
    await osa("set volume output volume ((output volume of (get volume settings)) + 10)");
    return "Lauter";
  },
  async volume_down() {
    await osa("set volume output volume ((output volume of (get volume settings)) - 10)");
    return "Leiser";
  },
  async mute() {
    await osa("set volume output muted (not (output muted of (get volume settings)))");
    return "Ton umgeschaltet";
  },
  async music_play_pause() {
    await osa("tell application (item 1 of argv) to playpause", MUSIC_APP);
    return "Musik umgeschaltet";
  },
  async music_next() {
    await osa("tell application (item 1 of argv) to next track", MUSIC_APP);
    return "Nächster Titel";
  },
  async music_previous() {
    await osa("tell application (item 1 of argv) to previous track", MUSIC_APP);
    return "Vorheriger Titel";
  },
  async say({ value }) {
    await run("say", ["-v", SAY_VOICE, String(value).slice(0, 1000)], 60000);
    return "Gesagt";
  },
  async notify({ value }) {
    await osa('display notification (item 1 of argv) with title "F.R.Ai.D.A.Y"', String(value).slice(0, 300));
    return "Mitteilung gezeigt";
  },
  async lock_screen() {
    await osa('tell application "System Events" to keystroke "q" using {control down, command down}');
    return "Mac gesperrt";
  },
  async sleep_display() {
    await run("pmset", ["displaysleepnow"]);
    return "Bildschirm aus";
  },
  async battery() {
    return await run("pmset", ["-g", "batt"]);
  },
  async dark_mode_toggle() {
    await osa('tell application "System Events" to tell appearance preferences to set dark mode to not dark mode');
    return "Design umgeschaltet";
  },
  async find_file({ value }) {
    const out = await run("mdfind", ["-name", String(value)], 25000);
    const files = out.split("\n").filter(Boolean).slice(0, 10);
    return files.length ? files.join("\n") : "Nichts gefunden";
  },
  async screenshot_look() {
    const file = path.join(os.tmpdir(), `friday-${Date.now()}.jpg`);
    try {
      await run("screencapture", ["-x", "-t", "jpg", file]);
      await run("sips", ["-Z", "1600", file]);
      return { image: fs.readFileSync(file).toString("base64") };
    } finally {
      fs.rmSync(file, { force: true });
    }
  },
};

let retryDelay = 2000;

function connect() {
  const ws = new WebSocket(SERVER_URL, { headers: { "x-agent-token": AGENT_TOKEN } });

  ws.on("open", () => {
    retryDelay = 2000;
    console.log(`Verbunden mit ${SERVER_URL}`);
    ws.send(JSON.stringify({ type: "hello", name: os.hostname() }));
  });

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type !== "command") return;
    const handler = Object.hasOwn(actions, msg.action) ? actions[msg.action] : null;
    let reply;
    if (!handler) reply = { ok: false, error: "Unbekannte Aktion" };
    else {
      try {
        const result = await handler({ value: String(msg.params?.value ?? "") });
        reply = typeof result === "object" ? { ok: true, ...result } : { ok: true, result };
      } catch (err) {
        reply = { ok: false, error: err.message };
      }
    }
    console.log(`${msg.action}: ${reply.ok ? "ok" : reply.error}`);
    ws.send(JSON.stringify({ type: "result", id: msg.id, ...reply }));
  });

  ws.on("close", () => {
    console.log(`Getrennt. Neuer Versuch in ${retryDelay / 1000} s`);
    setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60000);
  });

  ws.on("error", (err) => console.error("Verbindungsfehler:", err.message));
}

connect();
