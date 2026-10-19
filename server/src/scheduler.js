// Hintergrund-Aufgaben: Erinnerungen verschicken und Morgenbriefing.
import { config } from "./config.js";
import * as store from "./store.js";
import { notifyAll } from "./notify.js";
import { sendToAgent, isAgentOnline } from "./agent-hub.js";
import { ask } from "./brain.js";
import { checkForUpdate } from "./updater.js";

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
      await notifyAll("Erinnerung", r.text);
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
      "Erstelle mein Morgenbriefing. Hol dir das Wetter, meine offenen Erinnerungen für heute, " +
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
  } catch (err) {
    console.error("Briefing fehlgeschlagen:", err.message);
  }
}

// Zweimal am Tag nach Updates schauen und einmal pro neuer Version Bescheid geben.
let notifiedVersion = null;
async function checkUpdates() {
  const u = await checkForUpdate();
  if (!u.available || u.latest === notifiedVersion) return;
  notifiedVersion = u.latest;
  await notifyAll("Update verfügbar", `Version ${u.latest} ist da, Boss. Tippe im Dashboard auf den roten Update-Knopf.`);
}

export function startScheduler() {
  setTimeout(() => checkUpdates().catch(() => {}), 60 * 1000);
  setInterval(() => checkUpdates().catch(() => {}), 12 * 3600 * 1000);
  setInterval(() => checkReminders().catch((e) => console.error("Erinnerungen:", e.message)), 30 * 1000);
  setInterval(() => checkBriefing(), 30 * 1000);
}
