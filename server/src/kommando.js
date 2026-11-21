// Fridays Kommando-Brücke: Autonomie-Regler, Genehmigungsmanager, Notfallmodus und Zugriffsrechte.
// Gespeichert in server/data/kommando.json (wird von Updates nie überschrieben).
//
// Autonomie-Stufen (Standard 2 = wie bisher im Chat):
//   0 Nur Vorschläge  – jede Aktion, die etwas verändert, braucht deine Freigabe; Missionen laufen nur Schritt für Schritt.
//   1 Vorsichtig      – kritische Aktionen brauchen Freigabe; alles Automatische, das etwas verändert, ebenfalls.
//   2 Normal          – im Chat wie gewohnt; nur kritische Aktionen aus Missionen/Automationen brauchen Freigabe.
//   3 Selbstständig   – Friday handelt allein (die festen Grenzen bleiben: kein Geld, nichts heimlich an andere).
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config.js";
import { eintragen } from "./logbuch.js";

const FILE = path.join(DATA_DIR, "kommando.json");

export const STUFEN = [
  { stufe: 0, name: "Nur Vorschläge", text: "Friday fragt vor jeder Aktion, die etwas verändert. Missionen laufen nur Schritt für Schritt auf deinen Klick." },
  { stufe: 1, name: "Vorsichtig", text: "Kritische Aktionen (Anrufe, Mac, Licht, Fernseher, Updates …) brauchen immer deine Freigabe. Automatisches fragt bei jeder Änderung." },
  { stufe: 2, name: "Normal", text: "Im Gespräch handelt Friday wie gewohnt. Nur kritische Aktionen aus Missionen und Automationen brauchen deine Freigabe." },
  { stufe: 3, name: "Selbstständig", text: "Friday arbeitet allein und fragt nicht. Die festen Grenzen bleiben: kein echtes Geld, nichts heimlich an andere Personen." },
];

// Werkzeuge, die nur lesen oder etwas anlegen, das niemandem schadet.
export const NUR_LESEN = new Set([
  "world_news", "list_tasks", "system_check", "check_mail", "air_quality", "currency", "crypto", "holidays", "iss", "lookup",
  "country_info", "get_weather", "list_reminders", "list_protocols", "get_health", "welt_alarm", "markt_radar",
  "dokument_erstellen", "fragebogen_erstellen", "web_search",
  "dokumente_suchen", "apple_kontakte", // v1.134.0 (nur lesen)
]);
// Werkzeuge, die nach außen wirken, Geräte schalten oder Friday selbst verändern.
export const KRITISCH = new Set([
  "anrufe", "mac", "send_push", "sort_mail", "forget", "update", "run_protocol", "smart_home", "alexa", "fernseher", "hue",
  "video_schnitt", "webseite_bauen", "werkstatt",
]);
export const WERKZEUG_TEXT = {
  anrufe: "Anruf oder Nachricht", mac: "Aktion auf dem Mac", send_push: "Mitteilung schicken", sort_mail: "Mails sortieren",
  forget: "Etwas aus dem Gedächtnis löschen", update: "Friday aktualisieren", run_protocol: "Protokoll starten",
  smart_home: "Smart Home schalten", alexa: "Alexa-Routine", fernseher: "Fernseher steuern", hue: "Licht schalten",
  video_schnitt: "Videoschnitt starten", webseite_bauen: "Webseite bauen", werkstatt: "3D-Werkstatt",
  add_task: "Aufgabe anlegen", add_shopping: "Einkaufsliste", remember: "Etwas merken", set_reminder: "Erinnerung stellen",
  spotify: "Musik", kalender: "Kalender", todoist: "Todoist", notion: "Notion", open_app: "App öffnen",
  apple_notizen: "Apple Notizen", apple_musik: "Apple Musik", dauer_waechter: "Dauer-Wächter",
};

// v1.134.0 Freigabe-Glocke (aus OpenJarvis übernommen: "Approval Bell"): Diese Aktionen kann Boss so
// einstellen, dass Friday sie NIE ohne Freigabe macht – egal welche Autonomie-Stufe. Standard: Löschen,
// Mails sortieren und Updates. Anrufe bleiben aus, weil "ruf meine Frau an" schon die Bestätigung ist.
export const FRAGBAR = {
  anrufe: "Anrufe & Nachrichten an andere", forget: "Etwas aus dem Gedächtnis löschen", sort_mail: "Mails sortieren / verschieben",
  update: "Friday aktualisieren", mac: "Aktionen auf dem Mac", send_push: "Mitteilungen schicken", run_protocol: "Protokolle starten",
  smart_home: "Smart Home schalten", hue: "Licht schalten", alexa: "Alexa-Routinen", fernseher: "Fernseher steuern",
  apple_notizen: "Apple Notizen anlegen", apple_musik: "Musik abspielen", dauer_waechter: "Dauer-Wächter anlegen/löschen",
  webseite_bauen: "Webseiten bauen", video_schnitt: "Videoschnitt starten",
};
export const IMMER_FRAGEN_STANDARD = ["forget", "sort_mail", "update"];

// Welche Bereiche (Module) welche Daten lesen dürfen. Friday hält sich daran, wenn sie Kontext sammelt.
export const DATEN = {
  gedaechtnis: "Gedächtnis (was Friday über dich weiß)",
  ziele: "Ziele & Wissensprofil",
  entscheidungen: "Entscheidungsarchiv",
  organizer: "Aufgaben & Einkaufsliste",
  archiv: "Gesprächs-Archiv",
  logbuch: "Logbuch",
};
export const NUTZER = {
  labor: "Denk-Labor",
  berater: "Persönlicher Berater",
  missionen: "Missionen & Warteschlange",
  module: "Eigene Module",
};
const RECHTE_STANDARD = {
  labor: { gedaechtnis: true, ziele: true, entscheidungen: true, organizer: false, archiv: false, logbuch: false },
  berater: { gedaechtnis: true, ziele: true, entscheidungen: true, organizer: true, archiv: false, logbuch: false },
  missionen: { gedaechtnis: true, ziele: true, entscheidungen: false, organizer: true, archiv: false, logbuch: false },
  module: { gedaechtnis: false, ziele: false, entscheidungen: false, organizer: false, archiv: false, logbuch: false },
};

const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function laden() {
  let d = {};
  try { d = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { /* neu */ }
  const rechte = {};
  for (const n of Object.keys(NUTZER)) rechte[n] = { ...RECHTE_STANDARD[n], ...(d.rechte?.[n] || {}) };
  return {
    autonomie: Number.isInteger(d.autonomie) && d.autonomie >= 0 && d.autonomie <= 3 ? d.autonomie : 2,
    notfall: d.notfall && typeof d.notfall === "object" ? d.notfall : null,
    genehmigungen: Array.isArray(d.genehmigungen) ? d.genehmigungen : [],
    // v1.134.0 Freigabe-Glocke: Werkzeuge, bei denen Friday IMMER erst fragt (auch im Gespräch).
    immerFragen: Array.isArray(d.immerFragen) ? d.immerFragen.filter((w) => FRAGBAR[w]) : [...IMMER_FRAGEN_STANDARD],
    rechte,
  };
}
function speichern(d) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, FILE);
}

export function stand() {
  const d = laden();
  aufraeumen(d);
  return {
    autonomie: d.autonomie,
    stufe: STUFEN[d.autonomie],
    stufen: STUFEN,
    notfall: d.notfall,
    offen: d.genehmigungen.filter((g) => g.status === "offen"),
    erledigt: d.genehmigungen.filter((g) => g.status !== "offen").slice(-30).reverse(),
    rechte: d.rechte,
    immerFragen: d.immerFragen,
    fragbar: FRAGBAR,
    daten: DATEN,
    nutzer: NUTZER,
  };
}

export function setzeAutonomie(stufe) {
  const n = Number(stufe);
  if (!Number.isInteger(n) || n < 0 || n > 3) return { error: "Die Stufe muss 0 bis 3 sein." };
  const d = laden();
  d.autonomie = n;
  speichern(d);
  eintragen({ bereich: "system", titel: `Autonomie auf „${STUFEN[n].name}“ gestellt`, quelle: "dashboard" });
  return stand();
}

export function setzeRecht(nutzer, daten, an) {
  if (!NUTZER[nutzer] || !DATEN[daten]) return { error: "Unbekannter Bereich." };
  const d = laden();
  d.rechte[nutzer][daten] = Boolean(an);
  speichern(d);
  eintragen({ bereich: "system", titel: `Zugriff: ${NUTZER[nutzer]} darf ${DATEN[daten]} ${an ? "lesen" : "nicht mehr lesen"}`, quelle: "dashboard" });
  return stand();
}

/** Darf ein Bereich (labor, berater, missionen, module) bestimmte Daten lesen? */
export function darf(nutzer, daten) {
  return Boolean(laden().rechte[nutzer]?.[daten]);
}

/** Glocke: "Immer nachfragen" für ein Werkzeug an- oder ausschalten. */
export function setzeImmerFragen(werkzeug, an) {
  if (!FRAGBAR[werkzeug]) return { error: "Dieses Werkzeug kann man hier nicht einstellen." };
  const d = laden();
  const set = new Set(d.immerFragen);
  if (an) set.add(werkzeug); else set.delete(werkzeug);
  d.immerFragen = [...set];
  speichern(d);
  eintragen({ bereich: "system", titel: `Freigabe-Glocke: ${FRAGBAR[werkzeug]} ${an ? "– fragt jetzt immer" : "– ohne Nachfrage"}`, quelle: "dashboard" });
  return stand();
}

// Wer möchte von neuen Freigaben erfahren? (Glocke, Telegram)
const zuhoerer = new Set();
export function beiNeuerFreigabe(fn) { zuhoerer.add(fn); return () => zuhoerer.delete(fn); }

// ---- Notfallmodus ----
export function notfallAktiv() {
  return Boolean(laden().notfall);
}
export function notfallAn(grund = "Von Hand ausgelöst") {
  const d = laden();
  d.notfall = { seit: new Date().toISOString(), grund: String(grund).slice(0, 200) };
  // Offene Freigaben verfallen: im Notfall soll nichts mehr nachträglich losgehen.
  for (const g of d.genehmigungen) if (g.status === "offen") { g.status = "abgebrochen"; g.entschieden = d.notfall.seit; }
  speichern(d);
  eintragen({ bereich: "system", titel: "🛑 NOTFALLMODUS AN – alles Automatische gestoppt", details: d.notfall.grund, ok: false, quelle: "dashboard" });
  return stand();
}
export function notfallAus() {
  const d = laden();
  if (!d.notfall) return stand();
  d.notfall = null;
  speichern(d);
  eintragen({ bereich: "system", titel: "Notfallmodus beendet – Friday arbeitet wieder normal", quelle: "dashboard" });
  return stand();
}

// ---- Genehmigungsmanager ----
const AUTOMATISCH = new Set(["mission", "automation", "modul"]);

/**
 * Entscheidet, ob ein Werkzeug sofort laufen darf.
 * @returns {{ok:true} | {blockiert:string} | {freigabe:true}}
 */
export function pruefeWerkzeug(name, kanal = "") {
  if (NUR_LESEN.has(name)) return { ok: true };
  const d = laden();
  if (d.notfall) return { blockiert: "Der Notfallmodus ist an. Friday führt gerade keine Aktionen aus. Beende ihn in der Modul-Zentrale → Kontrolle." };
  // Freigabe-Glocke: "Immer nachfragen" gilt auf jeder Stufe außer "Selbstständig".
  if (d.immerFragen.includes(name) && d.autonomie < 3) return { freigabe: true };
  const automatisch = AUTOMATISCH.has(String(kanal));
  const kritisch = KRITISCH.has(name);
  const st = d.autonomie;
  const brauchtFreigabe = st === 0 || (st === 1 && (kritisch || automatisch)) || (st === 2 && automatisch && kritisch);
  return brauchtFreigabe ? { freigabe: true } : { ok: true };
}

export function freigabeAnfordern({ werkzeug, eingabe, kanal, grund }) {
  const d = laden();
  // Dieselbe Aktion nicht doppelt in die Liste.
  const roh = JSON.stringify(eingabe || {}).slice(0, 4000);
  const schon = d.genehmigungen.find((g) => g.status === "offen" && g.werkzeug === werkzeug && JSON.stringify(g.eingabe) === roh);
  if (schon) return schon;
  const g = {
    id: neueId(),
    status: "offen",
    werkzeug,
    titel: WERKZEUG_TEXT[werkzeug] || werkzeug,
    eingabe: JSON.parse(roh),
    kanal: String(kanal || ""),
    grund: String(grund || "").slice(0, 300),
    erstellt: new Date().toISOString(),
  };
  d.genehmigungen.push(g);
  d.genehmigungen = d.genehmigungen.slice(-200);
  speichern(d);
  eintragen({ bereich: "system", titel: `Freigabe angefragt: ${g.titel}`, details: kurzText(g.eingabe), kanal: g.kanal, quelle: "automatisch" });
  for (const fn of zuhoerer) { try { Promise.resolve(fn(g)).catch(() => {}); } catch { /* egal */ } }
  return g;
}

/** Freigabe erteilen oder ablehnen. Beim Erteilen führt `ausfuehren(werkzeug, eingabe)` die Aktion aus. */
export async function entscheide(id, ja, ausfuehren) {
  const d = laden();
  const g = d.genehmigungen.find((x) => x.id === id);
  if (!g) return { error: "Diese Anfrage gibt es nicht mehr." };
  if (g.status !== "offen") return { error: "Diese Anfrage ist schon entschieden." };
  if (ja && d.notfall) return { error: "Im Notfallmodus kann nichts freigegeben werden." };
  g.status = ja ? "erlaubt" : "abgelehnt";
  g.entschieden = new Date().toISOString();
  speichern(d);
  eintragen({ bereich: "system", titel: `${ja ? "✅ Freigegeben" : "✋ Abgelehnt"}: ${g.titel}`, details: kurzText(g.eingabe), quelle: "dashboard" });
  if (!ja) return { ok: true, g };
  let ergebnis;
  try { ergebnis = await ausfuehren(g.werkzeug, g.eingabe); } catch (err) { ergebnis = { error: err.message }; }
  const d2 = laden();
  const g2 = d2.genehmigungen.find((x) => x.id === id);
  if (g2) { g2.ergebnis = kurzText(ergebnis); speichern(d2); }
  return { ok: !ergebnis?.error, g: g2 || g, ergebnis };
}

function aufraeumen(d) {
  const grenze = Date.now() - 24 * 3600 * 1000;
  let geaendert = false;
  for (const g of d.genehmigungen) {
    if (g.status === "offen" && new Date(g.erstellt).getTime() < grenze) { g.status = "verfallen"; geaendert = true; }
  }
  if (geaendert) speichern(d);
}

function kurzText(x) {
  let s;
  try { s = typeof x === "string" ? x : JSON.stringify(x); } catch { s = String(x); }
  return String(s || "").slice(0, 400);
}

// Sprachbefehle ohne Claude: "Notfall", "Notfallmodus aus", "Autonomie auf vorsichtig".
export function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/[.!?,]/g, " ").replace(/\s+/g, " ").trim().replace(/^(hey |hallo )?friday /, "");
  if (/^(notfall|notfallmodus( an| ein)?|not ?aus|alles stopp(en)?|stopp alles|stoppe alles|notbremse)$/.test(t)) {
    notfallAn("Per Sprache ausgelöst");
    return { answer: "Notfallmodus ist an, Boss. Ich habe alle Missionen, Automationen und Auto-Updates gestoppt und führe keine Aktionen mehr aus, bis du ihn beendest.", actions: ["zentrale:kontrolle"] };
  }
  if (/^(notfall(modus)? (aus|beenden|vorbei)|beende den notfall(modus)?|entwarnung)$/.test(t)) {
    notfallAus();
    return { answer: "Entwarnung. Der Notfallmodus ist aus, ich arbeite wieder normal.", actions: ["zentrale:kontrolle"] };
  }
  const m = t.match(/^(stell(e)? )?(die )?autonomie (auf )?(.+?)( stellen)?$/);
  if (m) {
    const w = m[5];
    const stufe = /nur vorschl|null|^0/.test(w) ? 0 : /vorsicht|eins|^1/.test(w) ? 1 : /normal|zwei|^2/.test(w) ? 2 : /selbst|frei|drei|^3/.test(w) ? 3 : null;
    if (stufe == null) return null;
    setzeAutonomie(stufe);
    return { answer: `Autonomie steht jetzt auf ${STUFEN[stufe].name}. ${STUFEN[stufe].text}`, actions: ["zentrale:kontrolle"] };
  }
  if (/^(öffne |zeig( mir)? )?(die )?(modul ?zentrale|mission control|kommando ?zentrale|genehmigungen)( öffnen)?$/.test(t)) {
    return { answer: "Die Modul-Zentrale ist offen.", actions: [/genehmig/.test(t) ? "zentrale:kontrolle" : /mission/.test(t) ? "zentrale:missionen" : "zentrale:start"] };
  }
  return null;
}
