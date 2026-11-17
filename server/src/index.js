// F.R.Ai.D.A.Y Server - startet alles.
import http from "node:http";
import express from "express";
import { config, checkConfig, DASHBOARD_DIR } from "./config.js";
import { requireAuth, requireShortcutOrAuth, verifyPassword, createToken, loginAllowed, recordFailure, clearFailures } from "./auth.js";
import { ask } from "./brain.js";
import { attachAgentHub, isAgentOnline, getAgentInfo, sendToAgent } from "./agent-hub.js";
import { mailConfigured, getMailOverview, sortMail } from "./mail.js";
import { runSystemCheck } from "./syscheck.js";
import { getWeather, getProtocols, runTool } from "./tools.js";
import { agentsWithStatus } from "./agents.js";
import { getVideoJob, startVideoJob, openVideoDir } from "./videoteam.js";
import { getForecast, getDepot, paperTrade, resetDepot } from "./markt.js";
import { planBuild, getLatestBuild } from "./werkstatt.js";
import { getEnergie, aufladen, einnahme } from "./energie.js";
import { getSettings, setSettings, markActive, getUiSettings, setUiSettings } from "./einstellungen.js";
import { listSites, buildSite, getSiteHtml, markSold, openSiteDir } from "./webseiten.js";
import { startScheduler, makeBriefing, getLatestBriefing } from "./scheduler.js";
import { startShips, getShips, shipsStatus } from "./ships.js";
import { getISS } from "./extras.js";
import * as alexa from "./alexa.js";
import * as fernseher from "./fernseher.js";
import { DIENSTE, alleStatus } from "./dienste.js";
import { sprich, stimmeAktiv } from "./stimme.js";
import { callback as spotifyCallback } from "./spotify.js";
import { hueSprechenAn, sprechen as hueSprechen } from "./hue.js";
import { haBereit } from "./homeassistant.js";
import { startTelegram } from "./telegram.js";
import * as store from "./store.js";
import { COUNTRIES, findCountry, getOverview, getQuakes, getEonet, getSatellites, getInfra, getMedia, getNewsImages, getCountryInfo, getCountryNews, REGIONS, ROUTES, HOTSPOTS, getRegionNews, getPlanes, startAutoScan, getSummary, friendlyError, getWorldVideos, getAlarm } from "./lagezentrum.js";
import { getLandInfo, findeLand } from "./laenderinfo.js";
import { localVersion, checkForUpdate, startUpdate, getUpdateStatus, updateProgress, runningVersion, githubTokenStatus, setGithubToken, forgetGithubToken } from "./updater.js";
import { listBackups, createBackup, startRestore, getRestoreStatus, backupDir } from "./backup.js";

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
  // Nur die Herkunft (z. B. https://…ts.net) an fremde Seiten, nie Pfad oder Parameter.
  // YouTube verlangt diese Angabe für eingebettete Videos (sonst "Video kann nicht eingebettet werden").
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
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

// Spotify schickt den Browser nach der Anmeldung hierher zurück. Öffentlich, aber nur mit dem einmaligen "state" gültig.
app.get("/api/spotify/callback", asyncRoute(async (req, res) => {
  const q = req.query || {};
  const r = await spotifyCallback({ code: typeof q.code === "string" ? q.code : "", state: typeof q.state === "string" ? q.state : "", error: typeof q.error === "string" ? q.error : "" });
  const titel = r.ok ? "Spotify ist verbunden" : "Das hat nicht geklappt";
  const text = r.ok ? "Du kannst dieses Fenster schließen. Sag einfach: „Friday, spiel meine Lieblingssongs.“" : r.error;
  const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  res.status(r.ok ? 200 : 400).type("html").send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titel)}</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#050505;color:#f5e9dc;font-family:-apple-system,system-ui,sans-serif">
<div style="max-width:420px;padding:28px;border:1px solid rgba(255,138,30,.45);border-radius:18px;background:rgba(255,138,30,.06);box-shadow:0 0 40px rgba(255,138,30,.18);text-align:center">
<div style="font-size:42px">${r.ok ? "🎵" : "⚠️"}</div><h1 style="color:#ff8a1e;font-size:20px;letter-spacing:.08em">${esc(titel)}</h1><p style="line-height:1.5">${esc(text)}</p>
<p><a href="/" style="color:#ff8a1e">Zurück zu Friday</a></p></div></body>`);
}));

// Alles ab hier braucht eine Anmeldung.
app.use("/api", requireAuth);
// Aktivität merken (für automatische Updates nur in ruhigen Momenten).
app.use("/api", (req, res, next) => { if (req.method !== "GET") markActive(); next(); });

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

// Fridays Stimme über ElevenLabs (wenn eingerichtet). Bei Fehler 404/503 nimmt das Dashboard die Gerätestimme.
app.post("/api/tts", asyncRoute(async (req, res) => {
  if (!stimmeAktiv()) return res.status(404).json({ error: "Keine ElevenLabs-Stimme eingerichtet" });
  const r = await sprich(String(req.body?.text || ""));
  if (!r.ok) return res.status(503).json({ error: r.error });
  res.type("audio/mpeg").send(r.audio);
}));

app.get("/api/status", (req, res) => {
  res.json({
    name: config.userName,
    agent: { online: isAgentOnline(), ...getAgentInfo() },
    voice: stimmeAktiv(),
    hueSprechen: hueSprechenAn(),
    telegram: Boolean(config.telegramToken),
    push: Boolean(config.ntfyTopic),
    smartHome: haBereit(),
    schiffe: shipsStatus(),
    briefing: getLatestBriefing(),
    uptime: Math.round(process.uptime()),
    version: runningVersion(),
    update: (() => { const st = getUpdateStatus(); return st ? { state: st.state, time: st.time, auto: Boolean(st.auto), ziel: st.ziel || null } : null; })(),
    sicherung: (() => { const all = listBackups(); return { letzte: all[0]?.zeit || null, anzahl: all.length }; })(),
  });
});

// --- Updates ---
app.get("/api/update", asyncRoute(async (req, res) => res.json({ ...(await checkForUpdate()), status: getUpdateStatus(), githubSchluessel: githubTokenStatus() })));
// GitHub-Schlüssel für ein privates Repo. Wird nie zurückgegeben, nur ob einer da ist.
app.post("/api/update/schluessel", asyncRoute(async (req, res) => { const r = await setGithubToken(req.body?.token); res.status(r.ok ? 200 : 400).json(r); }));
app.post("/api/update/schluessel/vergessen", (req, res) => res.json(forgetGithubToken()));
app.get("/api/update/fortschritt", (req, res) => res.json(updateProgress()));
app.post("/api/update", (req, res) => res.json(startUpdate()));

// --- Sicherungen ---
app.get("/api/backups", (req, res) => res.json({ ordner: backupDir(), sicherungen: listBackups(), status: getRestoreStatus() }));
app.post("/api/backups", asyncRoute(async (req, res) => {
  try {
    const b = await createBackup("manuell", { programm: true });
    res.json({ ok: true, sicherung: b });
  } catch (err) {
    res.status(500).json({ error: err.message || "Sicherung hat nicht geklappt." });
  }
}));
app.post("/api/backups/:name/restore", (req, res) => res.json(startRestore(req.params.name, { programm: req.body?.programm === true })));

app.get("/api/system", asyncRoute(async (req, res) => {
  if (!isAgentOnline()) return res.json({ online: false });
  const r = await sendToAgent("system_info", {}, 12000);
  if (!r || r.ok === false) return res.json({ online: false });
  const { ok, ...info } = r;
  res.json({ online: true, ...info });
}));
app.get("/api/weather", asyncRoute(async (req, res) => res.json(await getWeather())));
// --- Organizer: Aufgaben + Einkaufsliste ---
app.get("/api/activity", (req, res) => res.json(store.getActivity()));
app.get("/api/systemcheck", asyncRoute(async (req, res) => res.json(await runSystemCheck())));
app.get("/api/mail", asyncRoute(async (req, res) => res.json(await getMailOverview(req.query.force === "1"))));
app.post("/api/mail/sort", asyncRoute(async (req, res) => res.json(await sortMail())));
app.get("/api/tasks", (req, res) => res.json(store.getTasks()));
app.post("/api/tasks", (req, res) => { const t = store.addTask(String(req.body?.text || "")); store.logActivity("aufgabe", `Aufgabe erstellt: ${t?.text || ""}`); res.json(t); });
app.patch("/api/tasks/:id", (req, res) => { const t = store.toggleTask(req.params.id) || {}; if (t.done) store.logActivity("aufgabe", `Aufgabe erledigt: ${t.text || ""}`); res.json(t); });
app.delete("/api/tasks/:id", (req, res) => res.json({ ok: store.deleteTask(req.params.id) }));
app.get("/api/shopping", (req, res) => res.json(store.getShopping()));
app.post("/api/shopping", (req, res) => res.json(store.addShopping(String(req.body?.text || ""))));
app.patch("/api/shopping/:id", (req, res) => res.json(store.toggleShopping(req.params.id) || {}));
app.delete("/api/shopping/:id", (req, res) => res.json({ ok: store.deleteShopping(req.params.id) }));
app.get("/api/reminders", (req, res) => res.json(store.getReminders().filter((r) => !r.done)));
app.post("/api/reminders", (req, res) => {
  const text = String(req.body?.text || "").slice(0, 300);
  const due = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  res.json(store.addReminder(text, due));
});
app.delete("/api/reminders/:id", (req, res) => {
  const list = store.getReminders().filter((r) => r.id !== req.params.id);
  store.updateReminders(list); res.json({ ok: true });
});
app.get("/api/find", asyncRoute(async (req, res) => {
  if (!isAgentOnline()) return res.json({ online: false, dateien: [] });
  const r = await sendToAgent("find_file", { value: String(req.query.q || "") }, 25000);
  const text = r && r.result ? String(r.result) : "";
  res.json({ online: true, dateien: text && text !== "Nichts gefunden" ? text.split("\n").filter(Boolean).slice(0, 15) : [] });
}));
app.get("/api/memory", (req, res) => res.json(store.getMemories()));
app.post("/api/memory", (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Kein Text" });
  const m = store.addMemory(text);
  store.logActivity("gedaechtnis", `Gemerkt: ${text}`);
  return res.json(m);
});
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
app.get("/api/lage-ereignisse", asyncRoute(async (req, res) => res.json(await getEonet())));
app.get("/api/lage-satelliten", asyncRoute(async (req, res) => res.json(await getSatellites())));
app.get("/api/lage-infra", asyncRoute(async (req, res) => res.json(getInfra(String(req.query.typ || "")))));
app.get("/api/lage-videos", asyncRoute(async (req, res) => res.json(await getWorldVideos())));
app.get("/api/lage-alarm", asyncRoute(async (req, res) => res.json(await getAlarm())));
// Fernseher (Samsung-TV im WLAN)
app.get("/api/fernseher", asyncRoute(async (req, res) => res.json(await fernseher.status())));
app.post("/api/fernseher/suchen", asyncRoute(async (req, res) => res.json({ gefunden: await fernseher.discover() })));
app.post("/api/fernseher/koppeln", asyncRoute(async (req, res) => { const r = await fernseher.pair(req.body?.ip); res.status(r.ok ? 200 : 400).json(r); }));
app.post("/api/fernseher/vergessen", (req, res) => res.json(fernseher.forget()));
app.post("/api/fernseher/befehl", asyncRoute(async (req, res) => {
  const { action, value, anzahl } = req.body || {};
  const r = await fernseher.command({ action: String(action || ""), value: value == null ? undefined : String(value).slice(0, 60), anzahl });
  if (r.ok && action !== "status") store.logActivity("mac", `Fernseher: ${action}${value ? " " + value : ""}`);
  res.status(r.ok ? 200 : 400).json(r);
}));
// Alexa (über Voice Monkey)
app.get("/api/alexa", asyncRoute(async (req, res) => res.json(await alexa.status())));
app.post("/api/alexa/schluessel", asyncRoute(async (req, res) => { const r = await alexa.setToken(req.body?.token); res.status(r.ok ? 200 : 400).json(r); }));
app.post("/api/alexa/aktualisieren", asyncRoute(async (req, res) => { const r = await alexa.refreshDevices(); res.status(r.ok ? 200 : 400).json(r.ok ? await alexa.status() : r); }));
app.post("/api/alexa/standard", (req, res) => { const r = alexa.setStandard(String(req.body?.id || "")); res.status(r.ok ? 200 : 400).json(r); });
app.post("/api/alexa/vergessen", (req, res) => res.json(alexa.forget()));
app.post("/api/alexa/befehl", asyncRoute(async (req, res) => {
  const { action, value, lautsprecher } = req.body || {};
  const r = await alexa.command({ action: String(action || ""), value: value == null ? undefined : String(value).slice(0, 900), lautsprecher: lautsprecher ? String(lautsprecher).slice(0, 60) : undefined });
  if (r.ok && action !== "liste") store.logActivity("mac", action === "ansage" ? "Alexa: Ansage" : `Alexa: ${r.routine || action}`);
  res.status(r.ok ? 200 : 400).json(r);
}));
// Verbindungen (Kalender, Stimme, Spotify, Home Assistant, Hue, Todoist, Notion)
const dienstVon = (req) => (Object.hasOwn(DIENSTE, req.params.id) ? DIENSTE[req.params.id] : null);
const nurText = (body, max = 1000) => Object.fromEntries(Object.entries(body || {}).filter(([, v]) => ["string", "number", "boolean"].includes(typeof v)).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, max) : v]));
app.get("/api/dienste", asyncRoute(async (req, res) => res.json(await alleStatus())));
app.post("/api/dienste/hue/sprechen", asyncRoute(async (req, res) => res.json(await hueSprechen(Boolean(req.body?.an)))));
app.post("/api/dienste/:id/einrichten", asyncRoute(async (req, res) => {
  const m = dienstVon(req);
  if (!m) return res.status(404).json({ ok: false, error: "Unbekannter Dienst" });
  const r = await m.einrichten(nurText(req.body));
  if (r.ok) store.logActivity("system", `Verbunden: ${m.info.name}`);
  res.status(r.ok ? 200 : 400).json(r);
}));
app.post("/api/dienste/:id/einstellen", asyncRoute(async (req, res) => {
  const m = dienstVon(req);
  if (!m) return res.status(404).json({ ok: false, error: "Unbekannter Dienst" });
  const r = await m.einstellen(nurText(req.body, 200));
  res.status(r.ok ? 200 : 400).json(r);
}));
app.post("/api/dienste/:id/vergessen", asyncRoute(async (req, res) => {
  const m = dienstVon(req);
  if (!m) return res.status(404).json({ ok: false, error: "Unbekannter Dienst" });
  res.json(m.vergessen());
}));
app.post("/api/dienste/:id/befehl", asyncRoute(async (req, res) => {
  const m = dienstVon(req);
  if (!m) return res.status(404).json({ ok: false, error: "Unbekannter Dienst" });
  const r = await m.command(nurText(req.body));
  res.status(r.ok ? 200 : 400).json(r);
}));
app.get("/api/agents", (req, res) => res.json(agentsWithStatus()));
app.get("/api/video-job", (req, res) => res.json(getVideoJob()));
app.post("/api/video-job", (req, res) => { const r = startVideoJob({ look: req.body?.look }); res.status(r.ok ? 200 : 400).json(r); });
app.post("/api/video-open", (req, res) => res.json(openVideoDir(String(req.body?.which || ""))));
app.get("/api/markt/:asset", (req, res) => res.json(getForecast(req.params.asset)));
app.post("/api/markt/:asset/neu", (req, res) => res.json(getForecast(req.params.asset, { force: true })));
app.get("/api/papierdepot", (req, res) => res.json(getDepot()));
app.post("/api/werkstatt", asyncRoute(async (req, res) => {
  const r = await planBuild(req.body?.wunsch, req.body?.basis || null);
  res.status(r.ok ? 200 : 400).json(r);
}));
app.get("/api/werkstatt/latest", (req, res) => res.json(getLatestBuild() || {}));
app.get("/api/energie", (req, res) => res.json(getEnergie()));
app.get("/api/einstellungen", (req, res) => res.json(getSettings()));
app.post("/api/einstellungen", (req, res) => res.json(setSettings(req.body || {})));
// Dashboard-Einstellungen für alle Geräte (Mac + iPhone gleich), dauerhaft in data/oberflaeche.json
app.get("/api/einstellungen/oberflaeche", (req, res) => res.json(getUiSettings()));
app.post("/api/einstellungen/oberflaeche", (req, res) => {
  try { res.json(setUiSettings(req.body || {})); } catch (e) { console.error("oberflaeche:", e.message); res.status(500).json({ error: "Konnte nicht speichern." }); }
});
app.get("/api/webseiten", (req, res) => res.json(listSites()));
app.post("/api/webseite", asyncRoute(async (req, res) => { const r = await buildSite(req.body?.auftrag, req.body?.basis || null); res.status(r.ok ? 200 : 400).json(r); }));
app.get("/api/webseite/:id/html", (req, res) => { const html = getSiteHtml(req.params.id); if (html == null) return res.status(404).json({ error: "Nicht gefunden" }); res.json({ html }); });
app.post("/api/webseite/:id/verkauft", asyncRoute(async (req, res) => { const r = await markSold(req.params.id, req.body?.betrag); res.status(r.ok ? 200 : 400).json(r); }));
app.post("/api/webseite/:id/ordner", (req, res) => res.json(openSiteDir(req.params.id)));
app.post("/api/energie/aufgeladen", (req, res) => { const r = aufladen(req.body?.betrag); res.status(r.ok ? 200 : 400).json(r); });
app.post("/api/energie/einnahme", (req, res) => { const r = einnahme(req.body?.betrag, req.body?.wofuer); res.status(r.ok ? 200 : 400).json(r); });
app.post("/api/papierdepot/freigeben", (req, res) => { const r = paperTrade(String(req.body?.asset || ""), String(req.body?.richtung || "")); res.status(r.ok ? 200 : 400).json(r); });
app.post("/api/papierdepot/zuruecksetzen", (req, res) => res.json(resetDepot()));

// Fridays Kern (Orb auf dem Zweitgerät, /core.html): das Dashboard meldet den Zustand,
// der Kern wartet per Long-Poll auf Änderungen.
let coreState = { mode: "", seq: 0 };
const coreWaiters = new Set();
app.post("/api/core-state", (req, res) => {
  const mode = String(req.body?.mode || "").slice(0, 20);
  if (mode !== coreState.mode) {
    coreState = { mode, seq: coreState.seq + 1 };
    for (const wake of [...coreWaiters]) wake();
  }
  res.json({ ok: true });
});
app.get("/api/core-state", (req, res) => {
  if (Number(req.query.since) !== coreState.seq) return res.json(coreState);
  const done = () => { clearTimeout(timer); coreWaiters.delete(done); if (!res.headersSent) res.json(coreState); };
  const timer = setTimeout(done, 25000);
  coreWaiters.add(done);
  req.on("close", () => { clearTimeout(timer); coreWaiters.delete(done); });
});
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
// Länder-Fenster ("zeig mir USA"): Steckbrief, Wikipedia, Fotos, Schlagzeilen in einem Rutsch
app.get("/api/land/:id", asyncRoute(async (req, res) => {
  const country = findCountry(req.params.id) || findeLand(req.params.id);
  if (!country) return res.status(404).json({ error: "Land nicht gefunden" });
  res.json(await getLandInfo(country));
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
