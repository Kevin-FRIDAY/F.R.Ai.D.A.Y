// Hintergrund-Aufgaben: Erinnerungen verschicken und Morgenbriefing.
import { config, IST_EVE } from "./config.js";
import * as store from "./store.js";
import { notifyAll } from "./notify.js";
import { sendToAgent, isAgentOnline } from "./agent-hub.js";
import { ask } from "./brain.js";
import { checkForUpdate, startUpdate, getUpdateStatus } from "./updater.js";
import { getSettings, idleFor } from "./einstellungen.js";
import { getAlarm, getWorldVideos } from "./lagezentrum.js";
import { warmForecast, marktBusy, MAERKTE } from "./markt.js";
import { getVideoJob } from "./videoteam.js";
import { autoBackup } from "./backup.js";
import { eintragen } from "./logbuch.js";
import { notfallAktiv } from "./kommando.js";

let lastBriefingDay = null;
let latestBriefing = null;

export function getLatestBriefing() {
  return latestBriefing;
}

async function checkReminders() {
  const now = Date.now();
  const reminders = store.getReminders();
  let changed = false;
  for (const r of reminders) {
    if (!r.done && new Date(r.due).getTime() <= now) {
      r.done = true;
      changed = true;
      await notifyAll("Erinnerung", r.text, { art: "erinnerung" });
      eintragen({ bereich: "erinnerung", titel: `Erinnerung ausgelöst: ${r.text}`, details: "Mitteilung an Handy/Telegram geschickt", quelle: "automatisch" });
      if (isAgentOnline()) sendToAgent("notify", { value: `Erinnerung: ${r.text}` });
    }
  }
  if (changed) {
    // Erledigte Erinnerungen nach 7 Tagen aufräumen
    const weekAgo = now - 7 * 24 * 3600 * 1000;
    store.updateReminders(reminders.filter((r) => !r.done || new Date(r.due).getTime() > weekAgo));
  }
}

export async function makeBriefing() {
  const { answer } = await ask({
    channel: "briefing",
    keepHistory: false,
    text:
      "Erstelle mein Morgenbriefing. Hol dir das Wetter, meine offenen Erinnerungen für heute, meine Termine von heute (kalender, falls verbunden), meine fälligen Todoist-Aufgaben (falls verbunden), " +
      "meine Gesundheitsdaten (falls vorhanden) und suche zwei bis drei wichtige Nachrichten von heute. " +
      "Fasse alles in höchstens sechs gesprochenen Sätzen zusammen und beginne mit einem Guten Morgen.",
  });
  latestBriefing = { text: answer, created: new Date().toISOString() };
  return answer;
}

async function checkBriefing() {
  if (!/^\d{2}:\d{2}$/.test(config.briefingTime)) return;
  const nowLocal = new Date().toLocaleString("sv-SE", { timeZone: config.timezone });
  const [day, time] = nowLocal.split(" ");
  if (time.slice(0, 5) !== config.briefingTime || lastBriefingDay === day) return;
  lastBriefingDay = day;
  try {
    const text = await makeBriefing();
    await notifyAll("Guten Morgen, Boss", text);
    eintragen({ bereich: "briefing", titel: "Morgenbriefing verschickt", details: text, quelle: "automatisch" });
  } catch (err) {
    console.error("Briefing fehlgeschlagen:", err.message);
    eintragen({ bereich: "briefing", titel: "Morgenbriefing fehlgeschlagen", details: err.message, quelle: "automatisch", ok: false });
  }
}

// Zweimal am Tag nach Updates schauen und einmal pro neuer Version Bescheid geben.
let notifiedVersion = null;
let warnedToken = false;
const autoTries = new Map(); // Version -> Anzahl automatischer Versuche
async function checkUpdates() {
  if (notfallAktiv()) return; // Notfallmodus: keine Auto-Updates
  const u = await checkForUpdate();
  if (u.needsToken && !warnedToken) {
    // Repo ist privat geworden, aber Friday hat keinen Schlüssel: einmal Bescheid geben.
    warnedToken = true;
    await notifyAll("Updates blockiert", "Ich komme nicht mehr an das Friday-Repo, Boss. Ist es privat? Trag in den Einstellungen → Immer aktuell deinen GitHub-Schlüssel ein.");
  }
  if (!u.needsToken) warnedToken = false;
  if (!u.available) return;
  if (getSettings().autoUpdate) {
    // Nur in ruhigen Momenten: 5 Minuten niemand aktiv, kein Videoschnitt, keine Markt-Rechnung.
    const job = getVideoJob().job;
    const st = getUpdateStatus();
    const laeuftSchon = st?.state === "laeuft" && Date.now() - new Date(st.time).getTime() < 10 * 60 * 1000;
    const tries = autoTries.get(u.latest) || 0;
    if (!laeuftSchon && tries < 2 && idleFor(5 * 60 * 1000) && !marktBusy() && !(job && job.status === "läuft")) {
      autoTries.set(u.latest, tries + 1);
      console.log(`Automatisches Update auf ${u.latest}`);
      const st2 = startUpdate({ auto: true });
      eintragen({ bereich: "update", titel: `Automatisches Update auf ${u.latest} gestartet`, details: st2?.error || "", quelle: "automatisch", ok: !st2?.error });
      return;
    }
    if (tries < 2) return; // später noch einmal versuchen
  }
  if (u.latest === notifiedVersion) return;
  notifiedVersion = u.latest;
  eintragen({ bereich: "update", titel: `Update ${u.latest} verfügbar`, details: "Bescheid gegeben", quelle: "automatisch" });
  await notifyAll("Update verfügbar", `Version ${u.latest} ist da, Boss. Tippe im Dashboard auf den roten Update-Knopf.`);
}

// Im Hintergrund frisch halten, damit beim Öffnen nichts mehr laden muss.
async function vorladen() {
  if (!getSettings().vorladen) return;
  await getAlarm().catch(() => {});
  await getWorldVideos().catch(() => {});
}
let marktIdx = 0;
function marktVorrechnen() {
  if (!getSettings().marktVorrechnen || !idleFor(2 * 60 * 1000)) return;
  const assets = Object.keys(MAERKTE);
  for (let i = 0; i < assets.length; i++) {
    const a = assets[(marktIdx + i) % assets.length];
    if (warmForecast(a, 90 * 60 * 1000)) { marktIdx = (marktIdx + i + 1) % assets.length; return; } // eine Rechnung pro Runde
  }
}

async function checkBackup() {
  try {
    const b = await autoBackup();
    if (b) { console.log("Automatische Sicherung:", b.name); eintragen({ bereich: "sicherung", titel: "Automatische Sicherung erstellt", details: b.name, quelle: "automatisch" }); }
  } catch (err) {
    console.error("Automatische Sicherung fehlgeschlagen:", err.message);
    eintragen({ bereich: "sicherung", titel: "Automatische Sicherung fehlgeschlagen", details: err.message, quelle: "automatisch", ok: false });
  }
}

export function startScheduler() {
  // Eve (Testversion) sichert und aktualisiert nie selbst – das macht nur Friday.
  if (!IST_EVE) {
    setTimeout(() => checkBackup(), 2 * 60 * 1000);
    setInterval(() => checkBackup(), 3600 * 1000);
    setTimeout(() => checkUpdates().catch(() => {}), 60 * 1000);
    setInterval(() => checkUpdates().catch(() => {}), 30 * 60 * 1000);
  }
  setTimeout(() => vorladen(), 90 * 1000);
  setInterval(() => vorladen(), 20 * 60 * 1000);
  setTimeout(() => marktVorrechnen(), 5 * 60 * 1000);
  setInterval(() => marktVorrechnen(), 15 * 60 * 1000);
  setInterval(() => checkReminders().catch((e) => console.error("Erinnerungen:", e.message)), 30 * 1000);
  if (!IST_EVE) setInterval(() => checkBriefing(), 30 * 1000); // Eve: kein eigenes Morgen-Briefing (spart Guthaben)
}
