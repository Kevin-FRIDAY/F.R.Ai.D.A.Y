// Herzschlag-Planer (v1.135.0, Idee "Heartbeat-Daemon" aus Conway-Research/automaton, MIT – in Node nachgebaut).
// Ein Takt (jede Minute) startet Fridays feste Hintergrund-Aufgaben nach Zeitplan.
// - keine Überschneidung: eine Aufgabe läuft nie doppelt, der nächste Takt wartet, bis der vorige fertig ist
// - jede Ausführung wird mit Ergebnis und Dauer festgehalten
// - Friday meldet sich nur, wenn sich wirklich etwas tut (z. B. Kosten-Deckel erreicht)
// Alles hier ist kostenlos (kein Claude). Eigene "Wenn … dann …"-Regeln bleiben in den Automationen (Modul-Zentrale).
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";
import { notifyAll } from "./notify.js";
import * as aenderungen from "./aenderungen.js";
import * as kostendeckel from "./kostendeckel.js";
import * as gedaechtnis from "./gedaechtnis.js";
import * as seele from "./seele.js";
import * as regelwerk from "./regelwerk.js";
import { WERKZEUG_TEXT } from "./kommando.js";
import { IST_EVE } from "./config.js";

const NAME = "herzschlag";
const TAKT_MS = 60_000;

// art: "intervall" (alle N Minuten) oder "taeglich" (HH:MM)
const AUFGABEN = {
  aenderungen: { name: "Änderungen sichern", text: "Hebt neue Fassungen von Einstellungen, Seele, Fähigkeiten und Gedächtnis auf.", art: "intervall", minuten: 5, lauf: async () => {
    const n = aenderungen.sichern("Herzschlag");
    return { text: n ? `${n} neue Fassung${n === 1 ? "" : "en"} aufgehoben` : "nichts geändert" };
  } },
  kosten: { name: "Kosten prüfen", text: "Schaut auf den Kosten-Deckel und schickt eine Mitteilung, wenn Friday sparen muss oder gesperrt ist.", art: "intervall", minuten: 15, lauf: async (zustand) => {
    const s = kostendeckel.stand();
    const vorher = zustand.kosten_stufe || "normal";
    zustand.kosten_stufe = s.stufe;
    if (s.stufe !== vorher && s.stufe !== "normal") {
      await notifyAll("Friday: Kosten-Deckel", s.stufe === "gesperrt" ? `Grenze erreicht. ${s.grund} Bis dahin nur Offline-Befehle.` : `Fast an der Grenze (${s.grund}). Friday spart jetzt.`, { art: "system", wichtig: s.stufe === "gesperrt" }).catch(() => {});
      return { text: `Stufe ${s.stufe} – Mitteilung geschickt`, gemeldet: true };
    }
    return { text: `Stufe ${s.stufe}, heute ${s.heute.toFixed(2)} $` };
  } },
  gedaechtnis: { name: "Gedächtnis aufräumen", text: "Entfernt doppelte Einträge und sortiert neue Fakten in Schubladen.", art: "taeglich", zeit: "03:30", lauf: async () => {
    const r = gedaechtnis.pflege();
    return { text: `${r.doppelt} doppelt entfernt, ${r.einsortiert} einsortiert` };
  } },
  seele: { name: "Seele spiegeln", text: "Schreibt unter „Was ich oft tue“, welche Werkzeuge Friday zuletzt am meisten benutzt hat.", art: "taeglich", zeit: "04:00", lauf: async () => {
    const r = seele.spiegeln(gedaechtnis.ereignisse().slice(-300), WERKZEUG_TEXT);
    return { text: r.geaendert ? "Seele aktualisiert" : "nichts Neues" };
  } },
  regeln: { name: "Regel-Bericht", text: "Zählt abends, wie oft das Regelwerk heute etwas gestoppt hat, und schreibt es ins Logbuch.", art: "taeglich", zeit: "21:00", lauf: async () => {
    const u = regelwerk.uebersicht();
    if (u.heute.gestoppt) eintragen({ bereich: "system", titel: `Regelwerk heute: ${u.heute.gestoppt} Aktion${u.heute.gestoppt === 1 ? "" : "en"} gestoppt`, details: `${u.heute.geprueft} Aktionen geprüft` });
    return { text: `${u.heute.geprueft} geprüft, ${u.heute.gestoppt} gestoppt` };
  } },
};

function laden() {
  const d = store.load(NAME, {});
  return { plan: d.plan || {}, letzte: d.letzte || {}, verlauf: d.verlauf || [], zustand: d.zustand || {} };
}
function speichern(d) {
  d.verlauf = d.verlauf.slice(-150);
  store.save(NAME, d);
}
function planVon(d, id) {
  const a = AUFGABEN[id];
  const p = d.plan[id] || {};
  return { an: p.an !== undefined ? p.an !== false : a.standardAn !== false, art: a.art, minuten: p.minuten || a.minuten, zeit: p.zeit || a.zeit };
}
function lokal(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}

function faellig(d, id, jetzt) {
  const p = planVon(d, id);
  if (!p.an) return false;
  const letzte = d.letzte[id]?.zeit ? new Date(d.letzte[id].zeit).getTime() : 0;
  if (p.art === "intervall") return jetzt - letzte >= p.minuten * 60_000 - 5000;
  const l = lokal(new Date(jetzt));
  const heute = l.slice(0, 10), uhr = l.slice(11, 16);
  return uhr >= p.zeit && (!letzte || lokal(new Date(letzte)).slice(0, 10) !== heute);
}

const laufend = new Set();
async function ausfuehren(id, wie = "takt") {
  if (laufend.has(id)) return { error: "Läuft gerade schon." };
  laufend.add(id);
  const start = Date.now();
  let erg;
  const d = laden();
  try {
    erg = await AUFGABEN[id].lauf(d.zustand);
    erg.ok = true;
  } catch (err) {
    erg = { ok: false, text: err.message };
    eintragen({ bereich: "system", titel: `Herzschlag-Aufgabe fehlgeschlagen: ${AUFGABEN[id].name}`, details: err.message, ok: false });
  } finally {
    laufend.delete(id);
  }
  const d2 = laden();
  d2.zustand = { ...d2.zustand, ...d.zustand };
  const eintrag = { zeit: new Date().toISOString(), id, wie, ok: erg.ok, text: String(erg.text || "").slice(0, 200), dauer_ms: Date.now() - start };
  d2.letzte[id] = eintrag;
  d2.verlauf.push(eintrag);
  speichern(d2);
  return eintrag;
}

let timer = null;
let schlaege = 0;
async function takt() {
  try {
    const d = laden();
    const jetzt = Date.now();
    schlaege++;
    for (const id of Object.keys(AUFGABEN)) if (faellig(d, id, jetzt)) await ausfuehren(id);
  } catch (err) {
    console.error("Herzschlag:", err.message);
  } finally {
    timer = setTimeout(takt, TAKT_MS); // setTimeout statt setInterval: nie zwei Takte gleichzeitig
    timer.unref?.();
  }
}

/**
 * v1.178.0 (Mark XII): weitere Module hängen ihre Hintergrund-Aufgaben hier ein, statt eigene Zeitgeber zu bauen
 * (keine Doppelmodule). def = { name, text, art: "intervall"|"taeglich", minuten?, zeit?, standardAn?, lauf: async (zustand) => ({ text }) }
 */
export function aufgabeRegistrieren(id, def) {
  if (!id || !def || typeof def.lauf !== "function" || AUFGABEN[id]) return false;
  AUFGABEN[id] = { art: "intervall", minuten: 60, ...def };
  return true;
}

export function herzschlagStart() {
  if (timer || IST_EVE) return; // Eve hat keinen eigenen Herzschlag (kostet sonst doppelt)
  aenderungen.sichern("Start"); // erste Aufnahme
  timer = setTimeout(takt, 20_000);
  timer.unref?.();
}

export function uebersicht() {
  const d = laden();
  return {
    takt_sekunden: TAKT_MS / 1000,
    schlaege,
    aufgaben: Object.entries(AUFGABEN).map(([id, a]) => ({ id, name: a.name, text: a.text, ...planVon(d, id), letzte: d.letzte[id] || null, laeuft: laufend.has(id) })),
    verlauf: d.verlauf.slice(-40).reverse(),
  };
}

export function einstellen(id, { an, minuten, zeit } = {}) {
  if (!AUFGABEN[id]) return { error: "Diese Aufgabe gibt es nicht." };
  const d = laden();
  const p = { ...(d.plan[id] || {}) };
  if (an !== undefined) p.an = Boolean(an);
  if (minuten !== undefined) {
    const m = Number(minuten);
    if (!(m >= 1 && m <= 1440)) return { error: "Minuten: 1 bis 1440." };
    p.minuten = Math.round(m);
  }
  if (zeit !== undefined) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(zeit))) return { error: "Uhrzeit bitte als HH:MM." };
    p.zeit = String(zeit);
  }
  d.plan[id] = p;
  speichern(d);
  return uebersicht();
}

export async function jetzt(id) {
  if (!AUFGABEN[id]) return { error: "Diese Aufgabe gibt es nicht." };
  await ausfuehren(id, "von Hand");
  return uebersicht();
}
