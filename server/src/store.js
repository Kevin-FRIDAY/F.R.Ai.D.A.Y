// Einfacher Speicher in JSON-Dateien im Ordner data/.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, config } from "./config.js";
import * as logbuch from "./logbuch.js";

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

// --- Aktivität / Tagesbericht ---
export function getActivity() {
  return load("activity", []);
}
// Alles, was hier landet, kommt auch ins Logbuch (außer opts.logbuch === false).
const CAT_ZU_BEREICH = { system: "verbindung", suche: "suche", chat: "befehl" };
export function logActivity(cat, label, opts = {}) {
  try {
    const list = getActivity();
    list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), cat, label: String(label || "").slice(0, 120), at: new Date().toISOString() });
    save("activity", list.slice(-5000));
  } catch { /* egal */ }
  if (opts.logbuch !== false) {
    logbuch.eintragen({ bereich: opts.bereich || CAT_ZU_BEREICH[cat] || logbuch.bereichFuer(cat), titel: String(label || cat), details: opts.details, quelle: opts.quelle, ok: opts.ok });
  }
}

// --- Friday-Datenbank: jedes Gespräch dauerhaft, eine Datei pro Monat (data/archiv/2026-11.jsonl) ---
const ARCHIV_DIR = path.join(DATA_DIR, "archiv");
export function archiviere(eintrag) {
  try {
    const at = new Date().toISOString();
    fs.mkdirSync(ARCHIV_DIR, { recursive: true });
    fs.appendFileSync(path.join(ARCHIV_DIR, `${at.slice(0, 7)}.jsonl`), JSON.stringify({ at, ...eintrag }) + "\n");
  } catch { /* Archiv darf Friday nie aufhalten */ }
}
export function leseArchiv() {
  let dateien = [];
  try { dateien = fs.readdirSync(ARCHIV_DIR).filter((f) => f.endsWith(".jsonl")).sort(); } catch { return []; }
  const out = [];
  for (const f of dateien) {
    let text = "";
    try { text = fs.readFileSync(path.join(ARCHIV_DIR, f), "utf8"); } catch { continue; }
    for (const zeile of text.split("\n")) {
      if (!zeile.trim()) continue;
      try { out.push(JSON.parse(zeile)); } catch { /* kaputte Zeile überspringen */ }
    }
  }
  return out;
}
// Einmalig: bisherige Gesprächsverläufe (history-*.json) ins Archiv übernehmen.
export function archivStarten() {
  try {
    if (fs.existsSync(ARCHIV_DIR)) return;
    fs.mkdirSync(ARCHIV_DIR, { recursive: true });
    const zeilen = [];
    for (const f of fs.readdirSync(DATA_DIR)) {
      const m = f.match(/^history-(.+)\.json$/);
      if (!m) continue;
      const at = fs.statSync(path.join(DATA_DIR, f)).mtime.toISOString();
      const msgs = load(`history-${m[1]}`, []);
      const text = (c) => (typeof c === "string" ? c : Array.isArray(c) ? c.map((b) => b?.text || "").join(" ") : "").trim();
      for (let i = 0; i + 1 < msgs.length; i += 2) {
        if (msgs[i].role !== "user" || msgs[i + 1].role !== "assistant") continue;
        zeilen.push(JSON.stringify({ at, typ: "gespraech", kanal: m[1], frage: text(msgs[i].content).slice(0, 2000), antwort: text(msgs[i + 1].content).slice(0, 4000), uebernommen: true }));
      }
    }
    if (zeilen.length) fs.writeFileSync(path.join(ARCHIV_DIR, "0000-uebernommen.jsonl"), zeilen.join("\n") + "\n");
  } catch { /* egal */ }
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
  logbuch.eintragen({ bereich: "gedaechtnis", titel: `Gemerkt: ${entry.text}` });
  return entry;
}

export function forgetMemory(query) {
  const q = query.toLowerCase();
  const memories = getMemories();
  const kept = memories.filter((m) => m.id !== query && !m.text.toLowerCase().includes(q));
  save("memory", kept);
  const weg = memories.length - kept.length;
  if (weg) logbuch.eintragen({ bereich: "gedaechtnis", titel: `Vergessen: ${weg === 1 ? memories.find((m) => !kept.includes(m))?.text || query : `${weg} Einträge (${query})`}` });
  return weg;
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
  let wann = dueIso;
  try { wann = new Date(dueIso).toLocaleString("de-DE", { timeZone: config.timezone, dateStyle: "short", timeStyle: "short" }); } catch { /* egal */ }
  logbuch.eintragen({ bereich: "erinnerung", titel: `Erinnerung gesetzt: ${entry.text}`, details: `Fällig: ${wann}` });
  return entry;
}

export function updateReminders(reminders) {
  save("reminders", reminders);
}

// --- Aufgaben ---
export function getTasks() { return load("tasks", []); }
export function addTask(text) {
  const tasks = getTasks();
  const entry = { id: Date.now().toString(36), text: String(text).slice(0, 300), done: false, at: Date.now() };
  tasks.push(entry); save("tasks", tasks);
  logbuch.eintragen({ bereich: "aufgabe", titel: `Aufgabe erstellt: ${entry.text}` });
  return entry;
}
export function toggleTask(id) {
  const tasks = getTasks(); const t = tasks.find((x) => x.id === id);
  if (t) {
    t.done = !t.done; save("tasks", tasks);
    logbuch.eintragen({ bereich: "aufgabe", titel: t.done ? `Aufgabe erledigt: ${t.text}` : `Aufgabe wieder offen: ${t.text}` });
  }
  return t;
}
export function deleteTask(id) {
  const alt = getTasks(); const t = alt.find((x) => x.id === id);
  save("tasks", alt.filter((x) => x.id !== id));
  if (t) logbuch.eintragen({ bereich: "aufgabe", titel: `Aufgabe gelöscht: ${t.text}` });
  return true;
}

// --- Einkaufsliste ---
export function getShopping() { return load("shopping", []); }
export function addShopping(text) {
  const list = getShopping();
  const entry = { id: Date.now().toString(36), text: String(text).slice(0, 120), done: false };
  list.push(entry); save("shopping", list);
  logbuch.eintragen({ bereich: "einkauf", titel: `Auf die Einkaufsliste: ${entry.text}` });
  return entry;
}
export function toggleShopping(id) {
  const list = getShopping(); const i = list.find((x) => x.id === id);
  if (i) {
    i.done = !i.done; save("shopping", list);
    logbuch.eintragen({ bereich: "einkauf", titel: i.done ? `Eingekauft: ${i.text}` : `Wieder auf der Liste: ${i.text}` });
  }
  return i;
}
export function deleteShopping(id) {
  const alt = getShopping(); const i = alt.find((x) => x.id === id);
  save("shopping", alt.filter((x) => x.id !== id));
  if (i) logbuch.eintragen({ bereich: "einkauf", titel: `Von der Einkaufsliste gelöscht: ${i.text}` });
  return true;
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
