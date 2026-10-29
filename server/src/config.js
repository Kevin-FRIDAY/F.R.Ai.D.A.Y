import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");
export const DATA_DIR = path.join(ROOT, "data");
export const DASHBOARD_DIR = path.resolve(ROOT, "..", "dashboard");

// Werte aus der .env haben Vorrang vor Umgebungsvariablen des Systems.
const envFile = path.join(ROOT, ".env");
const fileEnv = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, "utf8")) : {};

const env = (name, fallback = "") => (fileEnv[name] ?? process.env[name] ?? "").trim() || fallback;

export const config = {
  port: Number(env("PORT", "3000")),
  // 127.0.0.1 = nur dieser Computer. Von außen kommt man über Tailscale rein.
  host: env("HOST", "127.0.0.1"),
  anthropicKey: env("ANTHROPIC_API_KEY"),
  passwordHash: env("PASSWORD_HASH"),
  sessionSecret: env("SESSION_SECRET"),
  agentToken: env("AGENT_TOKEN"),
  // Eigener Schlüssel für Siri-Kurzbefehle (darf nur /api/siri und /api/health).
  shortcutToken: env("SHORTCUT_TOKEN"),
  userName: env("USER_NAME", "Boss"),
  city: env("CITY", "Berlin"),
  timezone: env("TIMEZONE", "Europe/Berlin"),
  model: env("CLAUDE_MODEL", "claude-opus-5-5"),
  effort: env("CLAUDE_EFFORT", "low"),
  elevenKey: env("ELEVENLABS_API_KEY"),
  elevenVoice: env("ELEVENLABS_VOICE_ID"),
  ntfyTopic: env("NTFY_TOPIC"),
  ntfyServer: env("NTFY_SERVER", "https://ntfy.sh"),
  briefingTime: env("BRIEFING_TIME"),
  telegramToken: env("TELEGRAM_BOT_TOKEN"),
  telegramChatId: env("TELEGRAM_CHAT_ID"),
  haUrl: env("HOME_ASSISTANT_URL").replace(/\/$/, ""),
  haToken: env("HOME_ASSISTANT_TOKEN"),
  // Woher Updates kommen (GitHub-Repo "Besitzer/Name" und Zweig).
  updateRepo: env("UPDATE_REPO", "Kevin-FRIDAY/F.R.Ai.D.A.Y"),
  updateBranch: env("UPDATE_BRANCH", "main"),
  // Kostenloser Schlüssel von aisstream.io für die Live-Schiffsverfolgung (optional).
  aisKey: env("AISSTREAM_API_KEY"),
  googleKey: env("GOOGLE_API_KEY"),
  windyKey: env("WINDY_API_KEY"),
  icloudMail: env("ICLOUD_EMAIL"),
  icloudPass: env("ICLOUD_APP_PASSWORD"),
};

export function checkConfig() {
  const missing = [];
  if (!config.anthropicKey) missing.push("ANTHROPIC_API_KEY");
  if (!config.passwordHash) missing.push("PASSWORD_HASH (npm run passwort)");
  if (!config.sessionSecret || config.sessionSecret.length < 32) missing.push("SESSION_SECRET (mind. 32 Zeichen)");
  if (!config.agentToken || config.agentToken.length < 32) missing.push("AGENT_TOKEN (mind. 32 Zeichen)");
  if (!config.shortcutToken || config.shortcutToken.length < 32) missing.push("SHORTCUT_TOKEN (mind. 32 Zeichen)");
  return missing;
}
