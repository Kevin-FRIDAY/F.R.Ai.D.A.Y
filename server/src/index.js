// F.R.Ai.D.A.Y Server - startet alles.
import http from "node:http";
import express from "express";
import { config, checkConfig, DASHBOARD_DIR } from "./config.js";
import { requireAuth, requireShortcutOrAuth, verifyPassword, createToken, loginAllowed, recordFailure, clearFailures } from "./auth.js";
import { ask } from "./brain.js";
import { attachAgentHub, isAgentOnline, getAgentInfo, sendToAgent } from "./agent-hub.js";
import { getWeather, getProtocols, runTool } from "./tools.js";
import { startScheduler, makeBriefing, getLatestBriefing } from "./scheduler.js";
import { startShips, getShips, shipsStatus } from "./ships.js";
import { getISS } from "./extras.js";
import { startTelegram } from "./telegram.js";
import * as store from "./store.js";
import { COUNTRIES, findCountry, getOverview, getQuakes, getMedia, getNewsImages, getCountryInfo, getCountryNews, REGIONS, ROUTES, HOTSPOTS, getRegionNews, getPlanes, startAutoScan, getSummary, friendlyError } from "./lagezentrum.js";
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
    schiffe: shipsStatus(),
    briefing: getLatestBriefing(),
    uptime: Math.round(process.uptime()),
    version: localVersion(),
  });
});

// --- Updates ---
app.get("/api/update", asyncRoute(async (req, res) => res.json({ ...(await checkForUpdate()), status: getUpdateStatus() })));
app.post("/api/update", (req, res) => res.json(startUpdate()));

app.get("/api/system", asyncRoute(async (req, res) => {
  if (!isAgentOnline()) return res.json({ online: false });
  const r = await sendToAgent("system_info", {}, 12000);
  if (!r || r.ok === false) return res.json({ online: false });
  const { ok, ...info } = r;
  res.json({ online: true, ...info });
}));
app.get("/api/weather", asyncRoute(async (req, res) => res.json(await getWeather())));
app.get("/api/reminders", (req, res) => res.json(store.getReminders().filter((r) => !r.done)));
app.get("/api/memory", (req, res) => res.json(store.getMemories()));
app.delete("/api/memory/:id", (req, res) => res.json({ geloescht: store.forgetMemory(req.params.id) }));
app.post("/api/history/clear", (req, res) => {
  store.clearHistory("web");
  res.json({ ok: true });
});

// --- Lagezentrum ---
app.get("/api/lage", (req, res) => res.json(getOverview()));
app.get("/api/lage-brennpunkte", (req, res) => res.json({ regionen: REGIONS, routen: ROUTES, hotspots: HOTSPOTS }));
app.get("/api/lage-region/:id", asyncRoute(async (req, res) => {
  const region = REGIONS.find((r) => r.id === req.params.id);
  if (!region) return res.status(404).json({ error: "Region nicht gefunden" });
  res.json({ ...region, meldungen: await getRegionNews(region) });
}));
app.get("/api/lage-schiffe", asyncRoute(async (req, res) => {
  const st = shipsStatus();
  if (!st.aktiv) return res.json({ aktiv: false, schiffe: [] });
  let box;
  if (req.query.region) {
    const r = REGIONS.find((x) => x.id === req.query.region);
    if (!r) return res.status(404).json({ error: "Region nicht gefunden" });
    const d = 7; box = [r.lon - d, r.lat - d, r.lon + d, r.lat + d];
  } else if (req.query.near) {
    const [lon, lat] = String(req.query.near).split(",").map(Number);
    if (Number.isNaN(lon) || Number.isNaN(lat)) return res.status(400).json({ error: "near ungültig" });
    const d = 8; box = [lon - d, lat - d, lon + d, lat + d];
  } else {
    return res.status(400).json({ error: "region oder near nötig" });
  }
  res.json({ aktiv: true, verbunden: st.verbunden, schiffe: getShips(box[0], box[1], box[2], box[3]) });
}));
app.get("/api/lage-flug", asyncRoute(async (req, res) => {
  let lat, lon, dist = 180;
  if (req.query.region) {
    const r = REGIONS.find((x) => x.id === req.query.region);
    if (!r) return res.status(404).json({ error: "Region nicht gefunden" });
    lat = r.lat; lon = r.lon; dist = 230;
  } else if (req.query.near) {
    [lon, lat] = String(req.query.near).split(",").map(Number);
    if (Number.isNaN(lon) || Number.isNaN(lat)) return res.status(400).json({ error: "near ungültig" });
  } else return res.status(400).json({ error: "region oder near nötig" });
  res.json({ flugzeuge: await getPlanes(lat, lon, dist) });
}));
app.get("/api/lage-iss", asyncRoute(async (req, res) => {
  const i = await getISS();
  res.json({ lat: i.breitengrad, lon: i.laengengrad, hoehe_km: i.hoehe_km, tempo_kmh: i.geschwindigkeit_kmh, ueber: i.ueber });
}));
app.get("/api/lage-beben", asyncRoute(async (req, res) => res.json(await getQuakes())));
app.get("/api/lage/:id", asyncRoute(async (req, res) => {
  const country = findCountry(req.params.id);
  if (!country) return res.status(404).json({ error: "Land nicht gefunden" });
  const news = await getCountryNews(country);
  res.json({ ...country, stand: new Date(news.at).toISOString(), meldungen: news.items });
}));
app.get("/api/lage/:id/medien", asyncRoute(async (req, res) => {
  const country = findCountry(req.params.id);
  if (!country) return res.status(404).json({ error: "Land nicht gefunden" });
  res.json(await getMedia(country));
}));
app.get("/api/lage/:id/info", asyncRoute(async (req, res) => {
  const country = findCountry(req.params.id);
  if (!country) return res.status(404).json({ error: "Land nicht gefunden" });
  res.json(await getCountryInfo(country));
}));
app.get("/api/lage/:id/nachrichten-bilder", asyncRoute(async (req, res) => {
  const country = findCountry(req.params.id);
  if (!country) return res.status(404).json({ error: "Land nicht gefunden" });
  res.json(await getNewsImages(country));
}));
app.post("/api/lage/:id/einschaetzung", asyncRoute(async (req, res) => {
  const country = findCountry(req.params.id);
  if (!country) return res.status(404).json({ error: "Land nicht gefunden" });
  try {
    res.json(await getSummary(country));
  } catch (err) {
    console.error("Lagezentrum:", err.message);
    res.status(502).json({ error: friendlyError(err) });
  }
}));

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
startShips();
startAutoScan();
