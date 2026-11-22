// F.R.Ai.D.A.Y Server - startet alles.
import http from "node:http";
import express from "express";
import { config, checkConfig, DASHBOARD_DIR, IST_EVE } from "./config.js";
import { requireAuth, requireShortcutOrAuth, verifyToken, verifyPassword, createToken, loginAllowed, recordFailure, clearFailures } from "./auth.js";
import { ask } from "./brain.js";
import { attachAgentHub, isAgentOnline, getAgentInfo, sendToAgent } from "./agent-hub.js";
import { mailConfigured, getMailOverview, sortMail } from "./mail.js";
import { runSystemCheck } from "./syscheck.js";
import { systemLive } from "./systemlive.js";
import { gehirnStand } from "./gehirn.js";
import { getWeather, getProtocols, runTool } from "./tools.js";
import { agentsWithStatus } from "./agents.js";
import { getVideoJob, startVideoJob, openVideoDir } from "./videoteam.js";
import { getStudio, starteStudio, listeVideos, zeigeImFinder, posterPfad } from "./videostudio.js";
import { komponiere, STIMMUNG_IDS } from "./musik.js";
import { getForecast, getDepot, paperTrade, resetDepot } from "./markt.js";
import { planBuild, getLatestBuild, getBuildJob } from "./werkstatt.js";
import { status as modelleStatus, modellDatei, sketchfabVerbinden, sketchfabTrennen, startmodelleLaden } from "./modelle.js";
import { getEnergie, aufladen, einnahme } from "./energie.js";
import { getSettings, setSettings, markActive, getUiSettings, setUiSettings } from "./einstellungen.js";
import { listSites, buildSite, getSiteHtml, markSold, openSiteDir, startLive, getLiveJob, getLiveAktuell, liveFrei } from "./webseiten.js";
import { listeSpiele, spielHtml, starteSpiel, jobStand, aktuellerJob, spielWegwerfen, claudeBereit, vorlagenListe, plusFrei } from "./spiele.js";
import { startScheduler, makeBriefing, getLatestBriefing } from "./scheduler.js";
import { helferRouten, helferStart } from "./helfer.js";
import { wacheRouten, wacheStart } from "./wache.js";
import { kernRouten, kernStart } from "./kern.js";
import { startShips, getShips, shipsStatus, schiffeRouten } from "./ships.js";
import { getISS } from "./extras.js";
import * as alexa from "./alexa.js";
import * as fernseher from "./fernseher.js";
import { DIENSTE, alleStatus } from "./dienste.js";
import { callback as spotifyCallback } from "./spotify.js";
import { hueSprechenAn, sprechen as hueSprechen } from "./hue.js";
import { haBereit } from "./homeassistant.js";
import { startTelegram } from "./telegram.js";
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import * as datenbank from "./datenbank.js";
const { alleEintraege } = datenbank;
import { alleDokumente, dokument, antwortenSpeichern } from "./dokumente.js";
import { auftragStand } from "./auftrag.js";
import { COUNTRIES, findCountry, getOverview, getQuakes, getEonet, getSatellites, getInfra, getMedia, getNewsImages, getCountryInfo, getCountryNews, REGIONS, ROUTES, HOTSPOTS, getRegionNews, getPlanes, startAutoScan, getSummary, friendlyError, getWorldVideos, getAlarm } from "./lagezentrum.js";
import { getLandInfo, findeLand } from "./laenderinfo.js";
import { plane, getOrte, setzeOrt, holeErgebnis, letzteRouteId } from "./routen.js";

// Standort vom Gerät (nur wenn im Routen-Fenster erlaubt): { lat, lon }
function gueltigerStandort(s) {
  const lat = Number(s?.lat), lon = Number(s?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : undefined;
}
import { localVersion, checkForUpdate, startUpdate, getUpdateStatus, updateProgress, runningVersion, githubTokenStatus, setGithubToken, forgetGithubToken } from "./updater.js";
import { archivUebersicht, speichereFoto, einsortieren, dateiPfad, fotoWegwerfen, oeffneOrdner, archivStart } from "./archiv.js";
import { zentraleRouten, zentraleStart } from "./zentrale.js";
import { verlaufSpeichern } from "./apple.js";
import { jarvisRouten, jarvisStart } from "./jarvis-paket.js";
import { lagebildRouten } from "./lagebild.js";
import { lageplusRouten, reisewarnungFuer, stabilitaetFuer } from "./lageplus.js";
import { satellitenRouten } from "./satelliten.js";
import { flugzeugeRouten } from "./flugzeuge.js";
import { welttourRouten } from "./welttour.js";
import { osirisStatus } from "./osiris.js";
import { eveRouten } from "./eve.js";
import { appsRouten } from "./appzentrale.js";
import { zerlegeRouten } from "./teilebank.js";
import { sportRouten } from "./sport.js";
import { profilRouten } from "./profil.js";
import { marktplusRouten, marktWacheStart } from "./marktplus.js";
import { eveWeiterleitung, eveStarten } from "./eve-prozess.js";
import { eveSchutzAn } from "./eve-schutz.js";
import * as produkt from "./produkt.js";
import { listBackups, createBackup, startRestore, getRestoreStatus, backupDir } from "./backup.js";

const missing = checkConfig();
if (missing.length) {
  console.error("Friday kann nicht starten. In der .env fehlt:\n - " + missing.join("\n - "));
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", "loopback");
// Eve (Testversion): im Eve-Modus gehen alle /api-Anfragen an den eigenen Eve-Prozess (eigene Daten).
if (IST_EVE) eveSchutzAn();
app.use(eveWeiterleitung);
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
  // v1.134.0: Verlauf für das Gesundheits-Fenster (ein Eintrag pro Tag, mehr Werte möglich)
  verlaufSpeichern({ schritte: num(b.steps), schlaf_stunden: num(b.sleepHours), ruhepuls: num(b.restingHeartRate), aktive_kalorien: num(b.activeEnergy), gewicht: num(b.weight), training_min: num(b.exerciseMinutes), stehstunden: num(b.standHours) });
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
// Archiv-Dateien (Fotos, Videos, Webseiten) für <img>/<video>: Anmeldung per Kopfzeile, Cookie oder ?t=
app.get(/^\/api\/archiv\/datei\/(foto|video|webseite|spiel)\/(.+)$/, (req, res) => {
  const kopf = (req.headers.authorization || "").replace(/^Bearer /, "");
  const cookie = (req.headers.cookie || "").match(/(?:^|;\s*)friday_session=([^;]+)/)?.[1];
  if (![kopf, cookie && decodeURIComponent(cookie), String(req.query.t || "")].some((t) => t && verifyToken(t))) return res.status(401).json({ error: "Nicht angemeldet" });
  let rel; try { rel = decodeURIComponent(req.params[1]); } catch { return res.status(400).end(); }
  const p = dateiPfad(req.params[0], rel);
  if (!p) return res.status(404).json({ error: "Nicht gefunden" });
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Webseiten laufen abgeschottet, damit sie nicht an Fridays Anmeldung kommen.
  if (req.params[0] === "webseite" || req.params[0] === "spiel") res.setHeader("Content-Security-Policy", "sandbox allow-scripts allow-forms allow-popups allow-modals");
  res.type(p.mime);
  res.sendFile(p.voll, { dotfiles: "deny" });
});

// Vorschaubilder fertiger Studio-Videos für <img>/<video poster>: Anmeldung per Kopfzeile, Cookie oder ?t=
app.get("/api/studio/poster/:name", (req, res) => {
  const kopf = (req.headers.authorization || "").replace(/^Bearer /, "");
  const cookie = (req.headers.cookie || "").match(/(?:^|;\s*)friday_session=([^;]+)/)?.[1];
  if (![kopf, cookie && decodeURIComponent(cookie), String(req.query.t || "")].some((t) => t && verifyToken(t))) return res.status(401).json({ error: "Nicht angemeldet" });
  const f = posterPfad(req.params.name);
  if (!f) return res.status(404).end();
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.type("image/jpeg").sendFile(f);
});

app.use("/api", requireAuth);
// Aktivität merken (für automatische Updates nur in ruhigen Momenten).
app.use("/api", (req, res, next) => { if (req.method !== "GET") markActive(); next(); });

// Logbuch: Knöpfe im Dashboard, die nicht schon an anderer Stelle festgehalten werden.
// Nur Pfad und wenige harmlose Felder – nie Schlüssel oder Passwörter.
const nr = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString("de-DE") : "");
const DASHBOARD_LOG = [
  ["POST", /^\/update$/, "update", () => "Update gestartet (von Hand)"],
  ["POST", /^\/backups$/, "sicherung", () => "Sicherung erstellt (von Hand)"],
  ["POST", /^\/backups\/([^/]+)\/restore$/, "sicherung", (q, m) => `Sicherung zurückgeholt: ${decodeURIComponent(m[1])}${q.body?.programm ? " (mit Programm)" : ""}`],
  ["POST", /^\/webseite\/live$/, "webseite", (q) => `Webseite live gebaut: ${String(q.body?.auftrag || "").slice(0, 120)}`],
  ["POST", /^\/webseite$/, "webseite", (q) => `Webseite gebaut: ${String(q.body?.auftrag || "").slice(0, 120)}`],
  ["POST", /^\/webseite\/([^/]+)\/verkauft$/, "energie", (q) => `Webseite verkauft für ${nr(q.body?.betrag)} €`],
  ["POST", /^\/energie\/aufgeladen$/, "energie", (q) => `Guthaben aufgeladen: ${nr(q.body?.betrag)} $`],
  ["POST", /^\/energie\/einnahme$/, "energie", (q) => `Einnahme eingetragen: ${nr(q.body?.betrag)} € ${String(q.body?.wofuer || "").slice(0, 60)}`],
  ["POST", /^\/papierdepot\/freigeben$/, "markt", (q) => `Spielgeld-Handel: ${String(q.body?.richtung || "")} ${String(q.body?.asset || "")}`],
  ["POST", /^\/papierdepot\/zuruecksetzen$/, "markt", () => "Spielgeld-Depot zurückgesetzt"],
  ["POST", /^\/markt\/([^/]+)\/neu$/, "markt", (q, m) => `Prognose neu berechnet: ${m[1]}`],
  ["POST", /^\/marktplus\/wache\/markt$/, "markt", (q) => `Markt-Wache: ${String(q.body?.name || q.body?.symbol || "").slice(0, 60)} eingestellt`],
  ["POST", /^\/marktplus\/wache\/entfernen$/, "markt", () => "Markt-Wache: Markt entfernt"],
  ["POST", /^\/video-job$/, "video", (q) => `Videoschnitt gestartet${q.body?.look ? ` (Look ${String(q.body.look).slice(0, 20)})` : ""}`],
  ["POST", /^\/dienste\/([^/]+)\/vergessen$/, "verbindung", (q, m) => `Verbindung getrennt: ${m[1]}`],
  ["POST", /^\/dienste\/([^/]+)\/befehl$/, null, (q, m) => `${m[1]}: ${String(q.body?.action || "")} ${String(q.body?.value ?? "").slice(0, 60)}`],
  ["POST", /^\/fernseher\/koppeln$/, "tv", () => "Fernseher gekoppelt"],
  ["POST", /^\/fernseher\/vergessen$/, "tv", () => "Fernseher vergessen"],
  ["POST", /^\/alexa\/schluessel$/, "verbindung", () => "Alexa-Schlüssel gespeichert"],
  ["POST", /^\/alexa\/vergessen$/, "verbindung", () => "Alexa getrennt"],
  ["POST", /^\/update\/schluessel$/, "verbindung", () => "GitHub-Schlüssel gespeichert"],
  ["POST", /^\/update\/schluessel\/vergessen$/, "verbindung", () => "GitHub-Schlüssel entfernt"],
  ["POST", /^\/einstellungen$/, "system", (q) => `Einstellungen geändert: ${Object.keys(q.body || {}).slice(0, 6).join(", ")}`],
  ["POST", /^\/archiv\/wegwerfen$/, "archiv", () => "Foto in den Papierkorb gelegt"],
  ["POST", /^\/archiv\/einsortieren$/, "archiv", () => "Fotos aus Downloads einsortiert"],
  ["POST", /^\/history\/clear$/, "system", () => "Neues Gespräch begonnen"],
  ["POST", /^\/lage\/([^/]+)\/einschaetzung$/, "welt", (q, m) => `Lage-Einschätzung: ${decodeURIComponent(m[1])}`],
  ["DELETE", /^\/reminders\/([^/]+)$/, "erinnerung", () => "Erinnerung gelöscht"],
];
const DIENST_BEREICH = { openrouter: "system", anrufe: "anruf", kalender: "kalender", spotify: "musik", hue: "smarthome", homeassistant: "smarthome", todoist: "aufgabe", notion: "suche", stimme: "system" };
app.use("/api", (req, res, next) => {
  if (req.method === "GET") return next();
  for (const [methode, muster, bereich, titel] of DASHBOARD_LOG) {
    if (req.method !== methode) continue;
    const m = req.path.match(muster);
    if (!m) continue;
    res.on("finish", () => {
      try {
        const ok = res.statusCode < 400;
        logbuch.eintragen({ bereich: bereich || DIENST_BEREICH[m[1]] || "verbindung", titel: titel(req, m), quelle: "dashboard", ok, ...(ok ? {} : { details: `Fehler ${res.statusCode}` }) });
      } catch { /* egal */ }
    });
    break;
  }
  next();
});

app.get("/api/shortcut-token", (req, res) => res.json({ token: config.shortcutToken }));

const validImage = (img) =>
  img && typeof img.data === "string" && /^image\/(jpeg|png|webp|gif)$/.test(img.mediaType) ? img : undefined;

app.post("/api/chat", asyncRoute(async (req, res) => {
  const { text = "", image, mode, targetLang, standort } = req.body || {};
  if (!text.trim() && !validImage(image)) return res.status(400).json({ error: "Keine Nachricht" });
  const result = await ask({
    text: String(text).slice(0, 4000),
    image: validImage(image),
    mode: mode === "translate" ? "translate" : "normal",
    targetLang: typeof targetLang === "string" ? targetLang.slice(0, 40) : undefined,
    channel: "web",
    standort: gueltigerStandort(standort),
  });
  res.json(result);
}));

// v1.123.0: ElevenLabs ist entfernt. Friday spricht nur noch mit der Apple-Stimme des Geräts.
app.post("/api/tts", (req, res) => res.status(410).json({ error: "ElevenLabs ist entfernt, Friday nutzt die Gerätestimme." }));

app.get("/api/osiris", async (req, res) => { res.json(await osirisStatus()); });

app.get("/api/status", (req, res) => {
  res.json({
    eve: IST_EVE,
    name: config.userName,
    agent: { online: isAgentOnline(), ...getAgentInfo() },
    voice: false,
    voiceHinweis: null,
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

// Live-Werte für die System-Zentrale (Prozessor, Speicher, Platte, Fridays Verbrauch)
app.get("/api/system/live", (req, res) => res.json(systemLive()));
// Fridays Gehirn (KI-Kern): echte Zahlen aus Logbuch, Gedächtnis, Archiv, Energie und Auftrag.
app.get("/api/gehirn", (req, res) => res.json(gehirnStand({ agentOnline: isAgentOnline(), version: runningVersion() })));

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

// Mac und iPhone fragen alle paar Sekunden: ein Ergebnis für alle, höchstens alle 6 s neu messen.
let systemCache = null, systemZeit = 0, systemLaeuft = null;
app.get("/api/system", asyncRoute(async (req, res) => {
  if (!isAgentOnline()) return res.json({ online: false });
  if (systemCache && Date.now() - systemZeit < 6000) return res.json(systemCache);
  if (!systemLaeuft) {
    systemLaeuft = sendToAgent("system_info", {}, 12000)
      .then((r) => {
        if (!r || r.ok === false) return { online: false };
        const { ok, ...info } = r;
        systemCache = { online: true, ...info };
        systemZeit = Date.now();
        return systemCache;
      })
      .catch(() => ({ online: false }))
      .finally(() => { systemLaeuft = null; });
  }
  res.json(await systemLaeuft);
}));
app.get("/api/weather", asyncRoute(async (req, res) => res.json(await getWeather())));
// --- Organizer: Aufgaben + Einkaufsliste ---
app.get("/api/activity", (req, res) => res.json(store.getActivity()));

// ---------- Friday-Datenbank (Fenster "Wissen"): alles, was gesprochen und gemacht wurde ----------
store.archivStarten();
// Dokumente und Fragebögen, die Friday erstellt hat.
app.get("/api/dokumente", (req, res) => res.json(alleDokumente().slice().reverse().map(({ inhalt, fragen, ...d }) => ({ ...d, fragen: fragen?.length, beantwortet: fragen?.filter((f) => f.antwort.trim()).length }))));
app.get("/api/dokumente/:id", (req, res) => { const d = dokument(req.params.id); return d ? res.json(d) : res.status(404).json({ error: "Nicht gefunden" }); });
app.post("/api/dokumente/:id/antworten", (req, res) => {
  const r = antwortenSpeichern(req.params.id, Array.isArray(req.body?.antworten) ? req.body.antworten : [], Boolean(req.body?.fertig));
  return r.error ? res.status(404).json(r) : res.json(r);
});
// Wie weit Friday mit dem aktuellen Auftrag ist (Arbeits-Balken).
app.get("/api/auftrag/fortschritt", (req, res) => res.json(auftragStand(String(req.query.kanal || "web")) || {}));

app.get("/api/wissen/datenbank", (req, res) => {
  const alle = alleEintraege();
  const typ = String(req.query.typ || "");
  const q = String(req.query.q || "").trim().toLowerCase();
  const vor = String(req.query.vor || "");
  const limit = Math.min(300, Math.max(10, Number(req.query.limit) || 120));
  const stats = { gesamt: alle.length, seit: alle.length ? alle[alle.length - 1].at : null };
  for (const e of alle) stats[e.typ] = (stats[e.typ] || 0) + 1;
  let liste = alle;
  if (typ) liste = liste.filter((e) => e.typ === typ);
  if (q) liste = datenbank.filtern(liste, { q });
  const treffer = liste.length;
  if (vor) liste = liste.filter((e) => e.at < vor);
  res.json({ stats, treffer, eintraege: liste.slice(0, limit), mehr: liste.length > limit });
});
app.get("/api/wissen/export", (req, res) => {
  const tag = new Date().toISOString().slice(0, 10);
  if (req.query.format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="friday-datenbank-${tag}.csv"`);
    return res.send(datenbank.alsCsv(datenbank.filtern(alleEintraege(), { typ: String(req.query.typ || ""), q: String(req.query.q || "") })));
  }
  res.setHeader("Content-Disposition", `attachment; filename="friday-datenbank-${tag}.json"`);
  res.json({ exportiert: new Date().toISOString(), eintraege: alleEintraege() });
});
// v1.130.0: Übersicht im Gehirn-Stil (Speicher-Karte, 30 Tage, Themen, Rückblick) + eigene Notizen.
app.get("/api/wissen/uebersicht", (req, res) => res.json(datenbank.uebersicht()));
app.post("/api/wissen/notiz", (req, res) => { try { res.json(datenbank.notizSpeichern(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); } });
app.delete("/api/wissen/notiz/:id", (req, res) => res.json({ ok: datenbank.notizLoeschen(req.params.id) }));
app.get("/api/systemcheck", asyncRoute(async (req, res) => res.json(await runSystemCheck())));
app.get("/api/mail", asyncRoute(async (req, res) => res.json(await getMailOverview(req.query.force === "1"))));
app.post("/api/mail/sort", asyncRoute(async (req, res) => res.json(await sortMail())));
app.get("/api/tasks", (req, res) => res.json(store.getTasks()));
app.post("/api/tasks", (req, res) => { const t = store.addTask(String(req.body?.text || "")); store.logActivity("aufgabe", `Aufgabe erstellt: ${t?.text || ""}`, { logbuch: false }); res.json(t); });
app.patch("/api/tasks/:id", (req, res) => { const t = store.toggleTask(req.params.id) || {}; if (t.done) store.logActivity("aufgabe", `Aufgabe erledigt: ${t.text || ""}`, { logbuch: false }); res.json(t); });
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
  store.logActivity("gedaechtnis", `Gemerkt: ${text}`, { logbuch: false });
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
lagebildRouten(app, asyncRoute);
lageplusRouten(app, asyncRoute);
satellitenRouten(app, asyncRoute);
schiffeRouten(app, asyncRoute);
flugzeugeRouten(app, asyncRoute);
welttourRouten(app, asyncRoute);
app.get("/api/lage-alarm", asyncRoute(async (req, res) => res.json(await getAlarm())));
// Fernseher (Samsung-TV im WLAN)
app.get("/api/fernseher", asyncRoute(async (req, res) => res.json(await fernseher.status())));
app.post("/api/fernseher/suchen", asyncRoute(async (req, res) => res.json({ gefunden: await fernseher.discover() })));
app.post("/api/fernseher/koppeln", asyncRoute(async (req, res) => { const r = await fernseher.pair(req.body?.ip); res.status(r.ok ? 200 : 400).json(r); }));
app.post("/api/fernseher/vergessen", (req, res) => res.json(fernseher.forget()));
app.post("/api/fernseher/befehl", asyncRoute(async (req, res) => {
  const { action, value, anzahl } = req.body || {};
  const r = await fernseher.command({ action: String(action || ""), value: value == null ? undefined : String(value).slice(0, 60), anzahl });
  if (action !== "status") {
    const was = `Fernseher: ${action}${value ? " " + value : ""}`;
    if (r.ok) store.logActivity("mac", was, { bereich: "tv", quelle: "dashboard" });
    else logbuch.eintragen({ bereich: "tv", titel: was, details: r.error, quelle: "dashboard", ok: false });
  }
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
  if (action !== "liste") {
    const was = action === "ansage" ? `Alexa: Ansage „${String(value || "").slice(0, 80)}“` : `Alexa: ${r.routine || value || action}`;
    if (r.ok) store.logActivity("mac", was, { bereich: "alexa", quelle: "dashboard" });
    else logbuch.eintragen({ bereich: "alexa", titel: was, details: r.error, quelle: "dashboard", ok: false });
  }
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
// Video-Studio: Videos auf Zuruf (Drehbuch, freie Fotos/eigene Clips, eigene Musik, Sprecher)
app.get("/api/studio", (req, res) => res.json(getStudio()));
app.post("/api/studio", (req, res) => {
  const b = req.body || {};
  const r = starteStudio({ thema: b.thema, sekunden: b.sekunden, format: b.format, musik: b.musik, bilder: b.bilder, sprecher: b.sprecher === true, stil: b.stil });
  res.status(r.ok ? 200 : 400).json(r);
});
app.get("/api/studio/videos", (req, res) => res.json({ videos: listeVideos() }));
app.get("/api/studio/hoerprobe/:stimmung", (req, res) => {
  if (!STIMMUNG_IDS.includes(req.params.stimmung)) return res.status(404).json({ error: "Unbekannte Stimmung" });
  const m = komponiere({ stimmung: req.params.stimmung, sekunden: 9, seed: 7 });
  res.type("audio/wav").setHeader("Cache-Control", "private, max-age=3600");
  res.send(m.wav);
});
app.post("/api/studio/finder", (req, res) => res.json(zeigeImFinder(req.body?.name)));
app.get("/api/markt/:asset", (req, res) => res.json(getForecast(req.params.asset)));
app.post("/api/markt/:asset/neu", (req, res) => res.json(getForecast(req.params.asset, { force: true })));
app.get("/api/papierdepot", (req, res) => res.json(getDepot()));
app.post("/api/werkstatt", asyncRoute(async (req, res) => {
  const r = await planBuild(req.body?.wunsch, req.body?.basis || null);
  res.status(r.ok ? 200 : 400).json(r);
}));
app.get("/api/werkstatt/latest", (req, res) => res.json(getLatestBuild() || {}));
app.get("/api/werkstatt/job/:id", (req, res) => { const j = getBuildJob(req.params.id); if (!j) return res.status(404).json({ error: "Unbekannter Bau." }); res.json(j); });
// v1.125.0: Modell-Bibliothek (echte 3D-Modelle in ~/Friday-Modelle, optional frisch von Sketchfab).
app.get("/api/modelle", (req, res) => res.json(modelleStatus()));
app.post("/api/modelle/sketchfab", asyncRoute(async (req, res) => { const r = await sketchfabVerbinden(req.body?.token); res.status(r.ok ? 200 : 400).json(r); }));
app.delete("/api/modelle/sketchfab", (req, res) => res.json(sketchfabTrennen()));
app.get("/api/modelle/datei/:id", (req, res) => {
  const f = modellDatei(req.params.id);
  if (!f) return res.status(404).json({ error: "Modell nicht gefunden." });
  res.set("Cache-Control", "private, max-age=86400");
  res.type("model/gltf-binary").sendFile(f);
});
setTimeout(() => startmodelleLaden().catch(() => {}), 20000); // Startmodell still im Hintergrund holen
app.get("/api/energie", (req, res) => res.json(getEnergie()));
app.get("/api/einstellungen", (req, res) => res.json(getSettings()));
app.post("/api/einstellungen", (req, res) => res.json(setSettings(req.body || {})));
// Dashboard-Einstellungen für alle Geräte (Mac + iPhone gleich), dauerhaft in data/oberflaeche.json
app.get("/api/einstellungen/oberflaeche", (req, res) => res.json(getUiSettings()));
app.post("/api/einstellungen/oberflaeche", (req, res) => {
  try { res.json(setUiSettings(req.body || {})); } catch (e) { console.error("oberflaeche:", e.message); res.status(500).json({ error: "Konnte nicht speichern." }); }
});
// Friday Vision: Produkt-Scan (Strichcode → Open Food Facts + Open Prices, sonst Foto-Erkennung)
app.get("/api/produkt/code/:code", asyncRoute(async (req, res) => res.json(await produkt.perCode(req.params.code))));
app.post("/api/produkt/bild", asyncRoute(async (req, res) => res.json(await produkt.perBild(req.body?.image))));
app.get("/api/produkt/verlauf", (req, res) => res.json({ verlauf: produkt.verlauf() }));
// Archiv: alles von Friday nach Jahr → Monat
app.get("/api/archiv", (req, res) => res.json(archivUebersicht()));
app.post("/api/archiv/foto", (req, res) => {
  try { const r = speichereFoto({ bild: req.body?.bild, quelle: String(req.body?.quelle || "vision"), zeit: req.body?.zeit }); if (r.ok) store.logActivity("archiv", `Foto im Archiv gespeichert: ${r.datei}`); res.status(r.ok ? 200 : 400).json(r); }
  catch (e) { console.error("Archiv:", e.message); res.status(500).json({ ok: false, error: "Foto konnte nicht gespeichert werden." }); }
});
app.post("/api/archiv/einsortieren", asyncRoute(async (req, res) => res.json(await einsortieren())));
app.post("/api/archiv/wegwerfen", (req, res) => { const r = fotoWegwerfen(req.body?.datei); res.status(r.ok ? 200 : 400).json(r); });
app.post("/api/archiv/ordner", (req, res) => res.json(oeffneOrdner(req.body?.jahr, req.body?.monat)));
app.get("/api/webseiten", (req, res) => res.json(listSites()));
// Spiele-Werkstatt: bauen (Code kommt live), Stand abfragen, spielen, wegwerfen.
app.get("/api/spiele", (req, res) => res.json({ spiele: listeSpiele(), claude: claudeBereit(), vorlagen: vorlagenListe(), plus: plusFrei(), aktuell: aktuellerJob() }));
app.post("/api/spiel", (req, res) => res.json(starteSpiel(req.body?.auftrag, { basis: req.body?.basis || null, vorlage: req.body?.vorlage || null, kanal: "web" })));
app.get("/api/spiel/job/:id", (req, res) => { const j = jobStand(req.params.id, req.query.ab); if (!j) return res.status(404).json({ error: "Auftrag nicht gefunden" }); res.json(j); });
app.get("/api/spiel/:id/html", (req, res) => { const html = spielHtml(req.params.id); if (html == null) return res.status(404).json({ error: "Nicht gefunden" }); res.json({ html }); });
app.post("/api/spiel/:id/weg", (req, res) => { const r = spielWegwerfen(req.params.id); res.status(r.ok ? 200 : 404).json(r); });
// Live-Bau mit Countdown (v1.145.0): zuerst nur in Eve, in Friday nach Freigabe.
const liveGesperrt = (res) => { if (liveFrei()) return false; res.status(423).json({ ok: false, gesperrt: true, error: "Der Live-Bau ist noch im Test. Probier ihn in Eve aus und gib ihn dort frei." }); return true; };
app.post("/api/webseite/live", (req, res) => { if (liveGesperrt(res)) return; const r = startLive(req.body?.auftrag, req.body?.basis || null); res.status(r.ok ? 200 : 400).json(r); });
app.get("/api/webseite/live/aktuell", (req, res) => { if (liveGesperrt(res)) return; res.json({ job: getLiveAktuell() }); });
app.get("/api/webseite/live/:id", (req, res) => { if (liveGesperrt(res)) return; const j = getLiveJob(req.params.id, req.query.ab); if (!j) return res.status(404).json({ error: "Unbekannter Bau." }); res.json(j); });
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
// Routen & Verbindungen: Auto, Fahrrad, zu Fuß, Bahn & Bus (alles kostenlos, ohne Claude)
app.get("/api/routen/orte", (req, res) => res.json(getOrte()));
app.post("/api/routen/orte", asyncRoute(async (req, res) => {
  const { art, text } = req.body || {};
  try { res.json({ ok: true, ort: await setzeOrt(art, text), orte: getOrte() }); } catch (err) { res.status(400).json({ error: err.message }); }
}));
app.get("/api/routen/ergebnis/:id", (req, res) => {
  const e = req.params.id === "neuestes" ? holeErgebnis(letzteRouteId()) : holeErgebnis(req.params.id);
  if (!e) return res.status(404).json({ error: "Diese Route ist nicht mehr da. Bitte neu berechnen." });
  res.json(e);
});
app.post("/api/routen/planen", asyncRoute(async (req, res) => {
  const b = req.body || {};
  const zeit = b.zeit && !Number.isNaN(new Date(b.zeit).getTime()) ? new Date(b.zeit) : null;
  try {
    res.json(await plane({
      nach: String(b.nach || "").slice(0, 160), von: b.von ? String(b.von).slice(0, 160) : "",
      standort: gueltigerStandort(b.standort), zeit, ankunft: Boolean(b.ankunft),
      modus: ["auto", "rad", "fuss", "oepnv"].includes(b.modus) ? b.modus : "",
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

// Länder-Fenster ("zeig mir USA"): Steckbrief, Wikipedia, Fotos, Schlagzeilen in einem Rutsch
app.get("/api/land/:id", asyncRoute(async (req, res) => {
  const country = findCountry(req.params.id) || findeLand(req.params.id);
  if (!country) return res.status(404).json({ error: "Land nicht gefunden" });
  // Reisewarnung (Auswärtiges Amt) + Fridays Stabilitäts-Wert gleich mitliefern (höchstens 4 s warten).
  const kurz = (p) => Promise.race([p.catch(() => null), new Promise((r) => setTimeout(() => r(null), 4000))]);
  const [info, reise, stabil] = await Promise.all([getLandInfo(country), kurz(reisewarnungFuer(country)), kurz(stabilitaetFuer(country))]);
  res.json({ ...info, reisewarnung: reise, stabilitaet: stabil });
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
// Fridays Logbuch: alles, was Friday getan hat, nach Tag.
app.get("/api/logbuch", (req, res) => res.json(logbuch.tag({ tag: String(req.query.tag || ""), bereich: String(req.query.bereich || ""), q: String(req.query.q || ""), fehler: req.query.fehler === "1", limit: Number(req.query.limit) || 1000 })));
app.get("/api/logbuch/tage", (req, res) => res.json(logbuch.tage({ anzahl: Number(req.query.anzahl) || 60 })));
app.get("/api/logbuch/suche", (req, res) => res.json({ eintraege: logbuch.suche({ q: String(req.query.q || ""), bereich: String(req.query.bereich || ""), limit: Math.min(1000, Number(req.query.limit) || 300) }), bereiche: logbuch.BEREICHE }));
app.get("/api/logbuch/export", (req, res) => {
  const t = String(req.query.tag || "");
  const liste = t === "alle" ? logbuch.suche({ limit: 100000 }) : logbuch.tag({ tag: t, limit: 5000 }).eintraege;
  const name = t === "alle" ? "friday-logbuch-alles" : `friday-logbuch-${logbuch.tag({ tag: t, limit: 1 }).tag}`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name}.csv"`);
  res.send(logbuch.alsCsv(liste));
});

app.post("/api/protocols/:name/run", asyncRoute(async (req, res) => res.json(await runTool("run_protocol", { name: req.params.name }))));

// Modul-Zentrale: Kontrolle, Missionen, Automationen, Labor, Rechnen, Sicherheit, Module, Netzwerk.
zentraleRouten(app, asyncRoute);

// Helfer-Paket: Kühlschrank, Kaufberater, Advocatus Diaboli, Ideen-Schmiede (v1.106.0).
helferRouten(app, asyncRoute);
// Eve – Testversion von Friday (v1.137.0): Schloss für neue Funktionen + Wünsche an Claude.
eveRouten(app, asyncRoute);
appsRouten(app, asyncRoute);
zerlegeRouten(app);
sportRouten(app, asyncRoute);
profilRouten(app);
marktplusRouten(app, asyncRoute);
wacheRouten(app, asyncRoute);
// Kontrollraum (v1.135.0): Regelwerk, Schleifen-Schutz, Gedächtnis, Herzschlag, Kosten-Deckel, Seele, Fähigkeiten, Änderungen.
kernRouten(app, asyncRoute);
// OpenJarvis-Paket (v1.134.0): Freigabe-Glocke, Dauer-Wächter, Dokumenten-Wissen, Apple-Apps, Whisper.
jarvisRouten(app, asyncRoute);

// --- Dashboard ---
app.use(express.static(DASHBOARD_DIR, { index: "index.html" }));

const server = http.createServer(app);
attachAgentHub(server);
server.listen(config.port, config.host, () => {
  console.log(`F.R.Ai.D.A.Y ist online: http://${config.host}:${config.port}`);
});
logbuch.beimStart(runningVersion(), getUpdateStatus());
startScheduler();
helferStart();
wacheStart();
marktWacheStart(); // Markt-Radar Plus: läuft in Eve, in Friday erst nach Freigabe
kernStart();
zentraleStart(ask);
jarvisStart();
if (!IST_EVE) {
  startTelegram(); // der Telegram-Bot gehört Friday
  startShips(); // aisstream erlaubt nur eine Verbindung
  eveStarten(); // Eve im Hintergrund mitstarten
}
startAutoScan();
archivStart();
