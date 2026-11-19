// Fridays Logbuch: hält ALLES fest, was Friday tut – mit Zeitstempel.
// Befehle (was du gesagt hast + Antwort), Anrufe/Nachrichten, Häuser aus der Werkstatt, Aufgaben,
// Fernseher, Alexa, Claude-Werkzeuge, Updates, Sicherungen, Erinnerungen, Start/Neustart ...
// Gespeichert in server/data/logbuch/JJJJ-MM.jsonl (eine Zeile pro Eintrag). server/data wird von
// Updates nie überschrieben. Nicht verwechseln mit "Protokollen" (Automations-Abläufe).
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, config } from "./config.js";

const DIR = path.join(DATA_DIR, "logbuch");
const STAND = path.join(DATA_DIR, "logbuch-stand.json");

// Bereiche mit Symbol und Namen (das Dashboard nutzt dieselbe Liste über /api/logbuch).
export const BEREICHE = {
  befehl: ["🗣", "Befehle"],
  anruf: ["📞", "Anrufe & Nachrichten"],
  haus: ["🏠", "Haus-Werkstatt"],
  werkstatt: ["🧊", "Werkstatt (3D)"],
  aufgabe: ["✅", "Aufgaben"],
  einkauf: ["🛒", "Einkauf"],
  erinnerung: ["⏰", "Erinnerungen"],
  kalender: ["📅", "Kalender"],
  gedaechtnis: ["🧠", "Gedächtnis"],
  tv: ["📺", "Fernseher"],
  alexa: ["🔵", "Alexa"],
  smarthome: ["💡", "Licht & Smart Home"],
  musik: ["🎵", "Musik"],
  mac: ["💻", "Mac"],
  route: ["🧭", "Routen & Verbindungen"],
  welt: ["🌍", "Weltgeschehen"],
  suche: ["🔎", "Suchen & Wissen"],
  markt: ["📈", "Markt-Radar"],
  webseite: ["🌐", "Webseiten"],
  spiel: ["🎮", "Spiele"],
  video: ["🎬", "Videoschnitt"],
  dokument: ["📄", "Dokumente"],
  archiv: ["🗂", "Archiv & Fotos"],
  mail: ["✉️", "Mails"],
  mitteilung: ["🔔", "Mitteilungen"],
  briefing: ["📰", "Briefing"],
  energie: ["⚡", "Energie"],
  update: ["⬇", "Updates"],
  sicherung: ["🛡", "Sicherungen"],
  verbindung: ["🔗", "Verbindungen"],
  system: ["⚙", "System"],
  sonstiges: ["•", "Sonstiges"],
};

// Welcher Bereich passt zu einem Claude-Werkzeug oder einer Schnellbefehl-Aktion?
const ZU_BEREICH = {
  anrufe: "anruf", werkstatt: "werkstatt", haus: "haus",
  add_task: "aufgabe", list_tasks: "aufgabe", todoist: "aufgabe",
  add_shopping: "einkauf",
  set_reminder: "erinnerung", list_reminders: "erinnerung", kalender: "kalender",
  remember: "gedaechtnis", forget: "gedaechtnis",
  fernseher: "tv", alexa: "alexa",
  hue: "smarthome", smart_home: "smarthome", homeassistant: "smarthome", run_protocol: "smarthome", list_protocols: "smarthome",
  spotify: "musik",
  mac: "mac", open_app: "mac",
  routen: "route", route_planen: "route",
  world_news: "welt", welt_alarm: "welt", weltgeschehen: "welt", land_info: "welt", country_info: "welt", vollbild: "system", vollbild_aus: "system",
  lookup: "suche", web_search: "suche", get_weather: "suche", air_quality: "suche", currency: "suche", crypto: "suche", holidays: "suche", iss: "suche", rechnen: "suche", notion: "suche", get_health: "suche",
  markt_radar: "markt",
  webseite_bauen: "webseite",
  spiel_bauen: "spiel", spiel: "spiel", spiele: "spiel",
  video_schnitt: "video",
  dokument_erstellen: "dokument", fragebogen_erstellen: "dokument",
  archiv: "archiv",
  check_mail: "mail", sort_mail: "mail",
  send_push: "mitteilung",
  briefing: "briefing",
  update: "update", system_check: "system", stimme: "system",
  logbuch: "system",
};
export function bereichFuer(name) {
  const n = String(name || "").split(":")[0];
  return ZU_BEREICH[n] || (BEREICHE[n] ? n : "sonstiges");
}

// Tag in Kevins Zeitzone (z. B. "2026-11-18"), nicht UTC.
export function tagVon(datum = new Date()) {
  try {
    return new Date(datum).toLocaleString("sv-SE", { timeZone: config.timezone }).slice(0, 10);
  } catch {
    return new Date(datum).toISOString().slice(0, 10);
  }
}

const kurz = (s, n) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

let zaehler = 0;
/**
 * Einen Eintrag ins Logbuch schreiben. Darf Friday nie aufhalten oder abstürzen lassen.
 * @param {{bereich?:string, titel:string, details?:string, quelle?:string, kanal?:string, ok?:boolean, claude?:boolean, dauer_ms?:number, aktionen?:string[]}} e
 */
export function eintragen(e = {}) {
  try {
    if (!e || !e.titel) return null;
    const jetzt = new Date();
    const tag = tagVon(jetzt);
    zaehler = (zaehler + 1) % 1296;
    const eintrag = {
      id: `${jetzt.getTime().toString(36)}${zaehler.toString(36).padStart(2, "0")}`,
      at: jetzt.toISOString(),
      tag,
      bereich: BEREICHE[e.bereich] ? e.bereich : "sonstiges",
      titel: kurz(e.titel, 200),
      ...(e.details ? { details: kurz(e.details, 900) } : {}),
      ...(e.quelle ? { quelle: String(e.quelle).slice(0, 20) } : {}),
      ...(e.kanal ? { kanal: String(e.kanal).slice(0, 20) } : {}),
      ok: e.ok !== false,
      ...(e.claude ? { claude: true } : {}),
      ...(Number.isFinite(e.dauer_ms) ? { dauer_ms: Math.round(e.dauer_ms) } : {}),
      ...(Array.isArray(e.aktionen) && e.aktionen.length ? { aktionen: e.aktionen.filter((a) => typeof a === "string").slice(0, 8).map((a) => a.slice(0, 40)) } : {}),
    };
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(path.join(DIR, `${tag.slice(0, 7)}.jsonl`), JSON.stringify(eintrag) + "\n");
    cache.delete(tag.slice(0, 7));
    return eintrag;
  } catch {
    return null;
  }
}

// ---------- Lesen ----------
const cache = new Map(); // "2026-11" -> { mtime, liste }
function leseMonat(monat) {
  if (!/^\d{4}-\d{2}$/.test(monat)) return [];
  const datei = path.join(DIR, `${monat}.jsonl`);
  let mtime = 0;
  try { mtime = fs.statSync(datei).mtimeMs; } catch { return []; }
  const c = cache.get(monat);
  if (c && c.mtime === mtime) return c.liste;
  let text = "";
  try { text = fs.readFileSync(datei, "utf8"); } catch { return []; }
  const liste = [];
  for (const zeile of text.split("\n")) {
    if (!zeile.trim()) continue;
    try { liste.push(JSON.parse(zeile)); } catch { /* kaputte Zeile überspringen */ }
  }
  cache.set(monat, { mtime, liste });
  return liste;
}

export function monate() {
  try {
    return fs.readdirSync(DIR).map((f) => f.match(/^(\d{4}-\d{2})\.jsonl$/)?.[1]).filter(Boolean).sort();
  } catch {
    return [];
  }
}

const passt = (e, { bereich, q, fehler }) => {
  if (bereich && e.bereich !== bereich) return false;
  if (fehler && e.ok !== false) return false;
  if (q) {
    const text = `${e.titel} ${e.details || ""} ${e.kanal || ""} ${(e.aktionen || []).join(" ")}`.toLowerCase();
    if (!q.split(/\s+/).every((w) => text.includes(w))) return false;
  }
  return true;
};

/** Einträge eines Tages (neueste zuerst), optional gefiltert. */
export function tag({ tag: t, bereich = "", q = "", fehler = false, limit = 1000 } = {}) {
  const tagStr = /^\d{4}-\d{2}-\d{2}$/.test(String(t || "")) ? t : tagVon();
  const alle = leseMonat(tagStr.slice(0, 7)).filter((e) => e.tag === tagStr);
  const filter = { bereich: BEREICHE[bereich] ? bereich : "", q: String(q || "").toLowerCase().trim().slice(0, 100), fehler: Boolean(fehler) };
  const zahlen = {};
  for (const e of alle) zahlen[e.bereich] = (zahlen[e.bereich] || 0) + 1;
  const treffer = alle.filter((e) => passt(e, filter)).reverse();
  return {
    tag: tagStr,
    heute: tagVon(),
    gesamt: alle.length,
    befehle: alle.filter((e) => e.bereich === "befehl").length,
    fehler: alle.filter((e) => e.ok === false).length,
    claude: alle.filter((e) => e.claude).length,
    zahlen,
    eintraege: treffer.slice(0, Math.max(1, Math.min(5000, Number(limit) || 1000))),
    bereiche: BEREICHE,
  };
}

/** Tage mit Einträgen (für die Tages-Leiste), neueste zuerst. */
export function tage({ anzahl = 60 } = {}) {
  const out = new Map();
  for (const m of monate().slice(-3)) {
    for (const e of leseMonat(m)) {
      const t = out.get(e.tag) || { tag: e.tag, anzahl: 0, fehler: 0 };
      t.anzahl += 1;
      if (e.ok === false) t.fehler += 1;
      out.set(e.tag, t);
    }
  }
  return [...out.values()].sort((a, b) => (a.tag < b.tag ? 1 : -1)).slice(0, Math.max(1, Math.min(400, anzahl)));
}

/** Suche über alle Tage (neueste zuerst). */
export function suche({ q = "", bereich = "", limit = 300 } = {}) {
  const filter = { bereich: BEREICHE[bereich] ? bereich : "", q: String(q || "").toLowerCase().trim().slice(0, 100) };
  const out = [];
  for (const m of monate().reverse()) {
    const liste = leseMonat(m);
    for (let i = liste.length - 1; i >= 0; i--) {
      if (passt(liste[i], filter)) out.push(liste[i]);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// CSV für Excel/Numbers (Semikolon, deutsch).
export function alsCsv(eintraege) {
  const zelle = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const kopf = ["Datum", "Uhrzeit", "Bereich", "Was", "Details", "Kanal", "Claude", "Ergebnis"];
  const zeilen = eintraege.map((e) => {
    const d = new Date(e.at);
    const datum = d.toLocaleDateString("de-DE", { timeZone: config.timezone });
    const zeit = d.toLocaleTimeString("de-DE", { timeZone: config.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return [datum, zeit, BEREICHE[e.bereich]?.[1] || e.bereich, e.titel, e.details || "", e.kanal || e.quelle || "", e.claude ? "ja" : "", e.ok === false ? "Fehler" : "ok"].map(zelle).join(";");
  });
  return "﻿" + [kopf.map(zelle).join(";"), ...zeilen].join("\r\n");
}

// ---------- Start: Neustart und installierte Updates festhalten ----------
export function beimStart(version, updateStatus) {
  try {
    let stand = {};
    try { stand = JSON.parse(fs.readFileSync(STAND, "utf8")); } catch { /* erster Start */ }
    if (stand.version && stand.version !== version) {
      eintragen({ bereich: "update", titel: `Update installiert: ${stand.version} → ${version}`, details: updateStatus?.auto ? "Automatisches Update" : "Update", quelle: "system" });
    } else if (updateStatus?.state === "fehler" && updateStatus.time && updateStatus.time !== stand.updateFehler) {
      eintragen({ bereich: "update", titel: "Update fehlgeschlagen", details: updateStatus.message || "", quelle: "system", ok: false });
      stand.updateFehler = updateStatus.time;
    }
    eintragen({ bereich: "system", titel: `Friday gestartet (Version ${version})`, quelle: "system" });
    fs.writeFileSync(STAND, JSON.stringify({ ...stand, version, gestartet: new Date().toISOString() }, null, 2));
  } catch { /* egal */ }
}

// ---------- Sprachbefehl: "öffne das Logbuch", "was hast du heute gemacht?" ----------
const ZAHLWORT = ["keine", "eine", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
const zahl = (n) => (n <= 12 ? ZAHLWORT[n] : String(n));
const gross = (w) => w.charAt(0).toUpperCase() + w.slice(1);

export function zusammenfassung(tagStr, wann = "heute") {
  const d = tag({ tag: tagStr });
  if (!d.gesamt) return `${wann === "heute" ? "Heute" : "Gestern"} steht noch nichts im Logbuch, Boss.`;
  const teile = Object.entries(d.zahlen)
    .filter(([b]) => b !== "befehl" && b !== "system")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([b, n]) => `${BEREICHE[b]?.[1] || b}: ${n === 1 ? "eins" : zahl(n)}`);
  let s = `${wann === "heute" ? "Heute" : "Gestern"} stehen ${zahl(d.gesamt)} Einträge im Logbuch`;
  if (d.befehle) s += `, davon ${zahl(d.befehle)} ${d.befehle === 1 ? "Befehl" : "Befehle"} von dir`;
  s += ".";
  if (teile.length) s += ` Dazu: ${teile.join(", ")}.`;
  if (d.fehler) s += ` ${d.fehler === 1 ? "Eine Sache hat" : `${gross(zahl(d.fehler))} Sachen haben`} nicht geklappt.`;
  return s;
}

export function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/[„“”"'!?.,:;]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^(?:hey |hallo |hi |ok |okay )?(?:friday|freitag|fraiday)(?: |$)/, "").trim()
    .replace(/^(?:bitte |kannst du (?:mir )?(?:bitte )?|könntest du (?:mir )?(?:bitte )?)/, "").trim();
  if (!t || t.length > 90) return null;
  const NAME = "(?:logbuch|log ?buch|tätigkeits ?protokoll|taetigkeits ?protokoll|aktivitäts ?protokoll|aktivitaets ?protokoll|friday ?protokoll|verlauf deiner aktionen)";
  const oeffnen = new RegExp(`^(?:bitte )?(?:öffne|oeffne|zeig|zeige|mach)(?: mir)?(?: mal)? (?:das |dein |mein |fridays |ins )?${NAME}(?: auf| bitte)?$`).test(t)
    || new RegExp(`^(?:das |dein |fridays )?${NAME}(?: zeigen| öffnen| oeffnen| auf ?machen)?$`).test(t)
    || /^(?:zeig|zeige)(?: mir)?(?: mal)? (?:dein|das) protokoll(?: von heute)?$/.test(t);
  const gestern = /\bgestern\b/.test(t);
  const frage = /^was (?:hast du|habt ihr|hat friday) (?:heute|gestern)(?: alles)? (?:gemacht|getan|erledigt)(?: friday)?$/.test(t)
    || /^was (?:ist|war) (?:heute|gestern) (?:alles )?(?:passiert|los)(?: bei dir)?$/.test(t);
  if (!oeffnen && !frage) return null;
  const tagStr = gestern ? tagVon(Date.now() - 86400000) : tagVon();
  if (frage) return { answer: zusammenfassung(tagStr, gestern ? "gestern" : "heute"), actions: [`logbuch:${tagStr}`] };
  const n = tag({ tag: tagStr }).gesamt;
  return { answer: n ? `Hier ist mein Logbuch, Boss. Heute ${n === 1 ? "ein Eintrag" : `${zahl(n)} Einträge`}.` : "Hier ist mein Logbuch, Boss. Heute steht noch nichts drin.", actions: [`logbuch:${tagStr}`] };
}
