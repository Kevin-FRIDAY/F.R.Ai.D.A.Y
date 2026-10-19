// F.R.Ai.D.A.Y Server - startet alles.
import http from "node:http";
import express from "express";
import { config, checkConfig, DASHBOARD_DIR } from "./config.js";
import { requireAuth, requireShortcutOrAuth, verifyPassword, createToken, loginAllowed, recordFailure, clearFailures } from "./auth.js";
import { ask } from "./brain.js";
import { attachAgentHub, isAgentOnline, getAgentInfo } from "./agent-hub.js";
import { getWeather, getProtocols, runTool } from "./tools.js";
import { startScheduler, makeBriefing, getLatestBriefing } from "./scheduler.js";
import { startTelegram } from "./telegram.js";
import * as store from "./store.js";
import { localVersion, checkForUpdate, startUpdate, getUpdateStatus } from "./updater.js";

const missing = checkConfig();
if (missing.length) {
  console.error("Friday kann nicht starten. In der .env fehlt:\n - " + missing.join("\n - "));
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", "loopback");
app.use(express.json({ limit: "12mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  next();
});

const asyncRoute = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error(`${req.method} ${req.path}:`, err.message);
    res.status(500).json({ error: "Da ist etwas schiefgelaufen." });
  });

// --- Anmeldung ---
app.post("/api/login", (req, res) => {
  const ip = req.ip;
  if (!loginAllowed(ip)) return res.status(429).json({ error: "Zu viele Versuche. Warte 15 Minuten." });
  if (!verifyPassword(req.body?.password, config.passwordHash)) {
    recordFailure(ip);
    return res.status(401).json({ error: "Falsches Passwort" });
  }
  clearFailures(ip);
  res.json({ token: createToken(), name: config.userName });
});

// Für Siri-Kurzbefehle, Apple Watch und CarPlay: antwortet mit reinem Text.
app.post("/api/siri", requireShortcutOrAuth, asyncRoute(async (req, res) => {
  const text = String(req.body?.text || "").slice(0, 4000);
  if (!text.trim()) return res.type("text/plain").send("Ich habe dich nicht verstanden, Boss.");
  const { answer } = await ask({ text, channel: "siri" });
  res.type("text/plain").send(answer);
}));

app.post("/api/health", requireShortcutOrAuth, (req, res) => {
  const b = req.body || {};
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
  store.saveHealth({ schritte: num(b.steps), schlaf_stunden: num(b.sleepHours), ruhepuls: num(b.restingHeartRate), aktive_kalorien: num(b.activeEnergy) });
  res.json({ ok: true });
});

// Alles ab hier braucht eine Anmeldung.
app.use("/api", requireAuth);

app.get("/api/shortcut-token", (req, res) => res.json({ token: config.shortcutToken }));

const validImage = (img) =>
  img && typeof img.data === "string" && /^image\/(jpeg|png|webp|gif)$/.test(img.mediaType) ? img : undefined;

app.post("/api/chat", asyncRoute(async (req, res) => {
  const { text = "", image, mode, targetLang } = req.body || {};
  if (!text.trim() && !validImage(image)) return res.status(400).json({ error: "Keine Nachricht" });
  const result = await ask({
    text: String(text).slice(0, 4000),
    image: validImage(image),
    mode: mode === "translate" ? "translate" : "normal",
    targetLang: typeof targetLang === "string" ? targetLang.slice(0, 40) : undefined,
    channel: "web",
  });
  res.json(result);
}));

// Fridays Stimme über ElevenLabs (wenn eingerichtet).
app.post("/api/tts", asyncRoute(async (req, res) => {
  if (!config.elevenKey || !config.elevenVoice) return res.status(404).json({ error: "Keine ElevenLabs-Stimme eingerichtet" });
  const text = String(req.body?.text || "").slice(0, 1500);
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.elevenVoice)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": config.elevenKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  });
  if (!r.ok) return res.status(502).json({ error: `ElevenLabs: ${r.status}` });
  res.type("audio/mpeg").send(Buffer.from(await r.arrayBuffer()));
}));

app.get("/api/status", (req, res) => {
  res.json({
    name: config.userName,
    agent: { online: isAgentOnline(), ...getAgentInfo() },
    voice: Boolean(config.elevenKey && config.elevenVoice),
    telegram: Boolean(config.telegramToken),
    push: Boolean(config.ntfyTopic),
    smartHome: Boolean(config.haUrl),
    briefing: getLatestBriefing(),
    uptime: Math.round(process.uptime()),
    version: localVersion(),
  });
});

// --- Updates ---
app.get("/api/update", asyncRoute(async (req, res) => res.json({ ...(await checkForUpdate()), status: getUpdateStatus() })));
app.post("/api/update", (req, res) => res.json(startUpdate()));

app.get("/api/weather", asyncRoute(async (req, res) => res.json(await getWeather())));
app.get("/api/reminders", (req, res) => res.json(store.getReminders().filter((r) => !r.done)));
app.get("/api/memory", (req, res) => res.json(store.getMemories()));
app.delete("/api/memory/:id", (req, res) => res.json({ geloescht: store.forgetMemory(req.params.id) }));
app.post("/api/history/clear", (req, res) => {
  store.clearHistory("web");
  res.json({ ok: true });
});

app.post("/api/briefing", asyncRoute(async (req, res) => res.json({ text: await makeBriefing() })));
app.get("/api/protocols", (req, res) => res.json(getProtocols()));
app.post("/api/protocols/:name/run", asyncRoute(async (req, res) => res.json(await runTool("run_protocol", { name: req.params.name }))));

// --- Dashboard ---
app.use(express.static(DASHBOARD_DIR, { index: "index.html" }));

const server = http.createServer(app);
attachAgentHub(server);
server.listen(config.port, config.host, () => {
  console.log(`F.R.Ai.D.A.Y ist online: http://${config.host}:${config.port}`);
});
startScheduler();
startTelegram();
