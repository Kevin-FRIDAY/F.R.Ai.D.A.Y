// Einfacher Speicher in JSON-Dateien im Ordner data/.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config.js";

fs.mkdirSync(DATA_DIR, { recursive: true });

function file(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function load(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(name), "utf8"));
  } catch {
    return structuredClone(fallback);
  }
}

export function save(name, value) {
  const target = file(name);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, target);
}

// --- Gedächtnis ---
export function getMemories() {
  return load("memory", []);
}

export function addMemory(text) {
  const memories = getMemories();
  const entry = { id: Date.now().toString(36), text: text.slice(0, 500), created: new Date().toISOString() };
  memories.push(entry);
  save("memory", memories.slice(-300));
  return entry;
}

export function forgetMemory(query) {
  const q = query.toLowerCase();
  const memories = getMemories();
  const kept = memories.filter((m) => m.id !== query && !m.text.toLowerCase().includes(q));
  save("memory", kept);
  return memories.length - kept.length;
}

// --- Erinnerungen ---
export function getReminders() {
  return load("reminders", []);
}

export function addReminder(text, dueIso) {
  const reminders = getReminders();
  const entry = { id: Date.now().toString(36), text: text.slice(0, 300), due: dueIso, done: false };
  reminders.push(entry);
  save("reminders", reminders);
  return entry;
}

export function updateReminders(reminders) {
  save("reminders", reminders);
}

// --- Gesprächsverlauf (pro Kanal: web, telegram, siri) ---
const MAX_TURNS = 20;

export function getHistory(channel) {
  return load(`history-${channel}`, []);
}

export function saveHistory(channel, messages) {
  // Nur ganze Frage/Antwort-Paare behalten, damit der Verlauf gültig bleibt.
  let trimmed = messages;
  while (trimmed.length > MAX_TURNS * 2) trimmed = trimmed.slice(2);
  save(`history-${channel}`, trimmed);
}

export function clearHistory(channel) {
  save(`history-${channel}`, []);
}

// --- Gesundheitsdaten (vom iPhone-Kurzbefehl) ---
export function getHealth() {
  return load("health", null);
}

export function saveHealth(data) {
  save("health", { ...data, received: new Date().toISOString() });
}
