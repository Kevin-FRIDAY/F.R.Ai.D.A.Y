// Fridays Sprachverständnis (v1.166.0): versteht Gespräche statt nur einzelner Sätze.
// - Mehrere Befehle in einem Satz ("stell einen Timer auf 5 Minuten und sag mir das Wetter")
// - Folgefragen ("Wetter in Berlin?" → "und morgen?" / "und in Hamburg?")
// - Antworten auf Rückfragen ("Erinnere mich an den Müll" → "Wann?" → "in 10 Minuten")
// - Korrekturen ("nein, ich meinte 20 Minuten") – nimmt das Falsche zurück und macht es richtig
// - "Was hast du gesagt?", "mach das rückgängig", "merk dir das", "worüber haben wir geredet?"
// Alles ohne Claude. Umgeschriebene Sätze werden nur benutzt, wenn ein Schnellbefehl sie wirklich versteht;
// sonst bekommt Claude den Originalsatz mit dem Gesprächsverlauf.
import * as store from "./store.js";
import { config } from "./config.js";

const FRISCH_MS = 10 * 60 * 1000; // so lange gilt ein Gespräch als "gerade eben"
const zustand = new Map(); // kanal → { frage, antwort, actions, claude, zeit, offen, angelegt }

const klein = (s) => String(s || "").toLowerCase();
const woerter = (s) => String(s || "").trim().split(/\s+/).filter(Boolean);
const ohneSatzzeichen = (s) => String(s || "").replace(/[?!.。]+\s*$/g, "").replace(/^[\s,;:]+|[\s,;:]+$/g, "").trim();
const frisch = (z) => z && Date.now() - z.zeit < FRISCH_MS;

/** Füllwörter aus der Spracherkennung entfernen ("ähm", "äh"), den Rest unverändert lassen. */
export function bereinigen(text) {
  return String(text || "")
    .replace(/(^|[\s,])(ähm+|äh+m?|öhm+|ehm+|hmm+|aehm)(?=[\s,.!?]|$)[,]?/gi, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*,\s*/, "")
    .trim();
}

// Weckwort vorne weg ("Friday, …"); mit fuellwoerter auch "also", "dann", "bitte" (nicht "und" – das braucht die Folgefrage).
function kopfWeg(t, { fuellwoerter = false } = {}) {
  let s = String(t || "").replace(/^\s*(hey |hallo |ok |okay )?(friday|freitag|fraiday)[,!.]?\s+/i, "");
  if (fuellwoerter) s = s.replace(/^\s*(also |dann |noch |bitte |ach ja,? )+/i, "");
  return s.trim();
}

// ---------------------------------------------------------------------------------------------
// Gedächtnis fürs Gespräch
// ---------------------------------------------------------------------------------------------

/** Merkt sich die letzte Frage/Antwort eines Kanals (für Folgefragen, Wiederholen, Rückgängig). */
export function merke(kanal, { frage, antwort, actions = [], claude = false, angelegt = null }) {
  const alt = zustand.get(kanal) || {};
  const acts = (actions || []).filter((a) => typeof a === "string");
  // Offene Rückfrage nur bei einfachen Offline-Fragen ("Wann soll ich dich erinnern?"). Eigene Gesprächs-Abläufe
  // (Anrufe, Weltgeschehen) merken sich ihre Rückfragen selbst.
  const offen = !claude && acts.length === 1 && acts[0] === "offline" && /\?/.test(String(antwort || "")) && /^(wann|wie lange|wie viel|wieviel|was soll|welche|wohin|woran|an was|wen)\b/i.test(String(antwort || "").trim())
    ? { frage }
    : null;
  zustand.set(kanal, {
    frage, antwort, actions: acts, claude, zeit: Date.now(), offen,
    // Hat dieser Befehl etwas angelegt (Erinnerung, Einkauf …)? Dann ist "und morgen?" keine Folgefrage dazu.
    hatAngelegt: Boolean(angelegt && hatEtwas(angelegt)),
    angelegt: angelegt && hatEtwas(angelegt) ? { ...angelegt, zeit: Date.now() } : alt.angelegt && Date.now() - alt.angelegt.zeit < FRISCH_MS ? alt.angelegt : null,
  });
}
export const letzter = (kanal) => zustand.get(kanal) || null;
export function vergiss(kanal) { zustand.delete(kanal); }

// ---------------------------------------------------------------------------------------------
// Was hat Friday gerade angelegt? (für "mach das rückgängig" und Korrekturen)
// ---------------------------------------------------------------------------------------------
const LISTEN = {
  reminders: { name: "Erinnerung", get: () => store.getReminders() },
  tasks: { name: "Aufgabe", get: () => store.getTasks() },
  shopping: { name: "Einkauf", get: () => store.getShopping() },
  memory: { name: "Notiz im Gedächtnis", get: () => store.getMemories() },
};
const schluessel = (e) => `${e?.id}|${e?.text}`;
function hatEtwas(a) { return Object.keys(LISTEN).some((k) => a[k]?.length); }

export function schnappschuss() {
  const s = {};
  for (const [k, l] of Object.entries(LISTEN)) {
    try { s[k] = new Set((l.get() || []).map(schluessel)); } catch { s[k] = new Set(); }
  }
  return s;
}
export function neuSeit(vorher) {
  const neu = {};
  for (const [k, l] of Object.entries(LISTEN)) {
    try { neu[k] = (l.get() || []).filter((e) => !vorher[k]?.has(schluessel(e))).map((e) => ({ id: e.id, text: e.text })); } catch { neu[k] = []; }
  }
  return neu;
}

function zuruecknehmen(angelegt) {
  const weg = [];
  for (const [k, l] of Object.entries(LISTEN)) {
    const liste = angelegt?.[k] || [];
    if (!liste.length) continue;
    const ids = new Set(liste.map(schluessel));
    const alt = l.get() || [];
    const rest = alt.filter((e) => !ids.has(schluessel(e)));
    if (rest.length === alt.length) continue;
    store.save(k, rest);
    for (const e of liste) weg.push({ art: l.name, text: e.text });
  }
  return weg;
}

function wegText(weg) {
  const t = weg.slice(0, 3).map((w) => `${w.art} „${String(w.text).replace(/^\S+ sagt: /, "").slice(0, 60)}“`);
  return weg.length > 3 ? `${t.join(", ")} und ${weg.length - 3} weitere` : t.join(" und ");
}

// ---------------------------------------------------------------------------------------------
// Befehle, die sich aufs Gespräch beziehen (sofort, ohne Claude)
// ---------------------------------------------------------------------------------------------
const WIEDERHOLEN = /^(was hast du (gerade |eben |grad )?gesagt|wie bitte|was war das|wiederhol(e)?( das| es)?( nochmal| noch mal)?( bitte)?|sag (das |es )?(nochmal|noch mal|noch einmal)( bitte)?|nochmal bitte|noch mal bitte|kannst du das (bitte )?wiederholen|ich hab(e)? (dich |das )?nicht verstanden|hab ich nicht verstanden)$/;
const RUECKGAENGIG = /^(mach (das|es) (bitte )?(wieder )?rückgängig|rückgängig( machen)?|nimm (das|es) (bitte )?(wieder )?zurück|lösch (das|es) (bitte )?wieder|das war (falsch|ein fehler)|vergiss das wieder|streich das( wieder)?|undo)$/;
const MERK_DAS = /^(merk dir das|merke dir das|speicher das|speichere das|merk dir (die|deine) antwort|notier dir das)( bitte)?( mal)?$/;
const VERLAUF = /^(worüber|über was) (haben wir|hatten wir) (gerade |eben |vorhin |heute )?(gesprochen|geredet)|^was (habe|hab) ich (dich )?(gerade |eben |vorhin |zuletzt )?gefragt$/;

/** Gesprächsbefehle: Wiederholen, Rückgängig, "merk dir das", "worüber haben wir geredet". */
export function gespraechsBefehl(text, kanal) {
  const t = ohneSatzzeichen(klein(kopfWeg(text, { fuellwoerter: true })));
  if (!t || t.length > 80) return null;
  const z = zustand.get(kanal);
  const verlauf = store.getHistory(kanal);
  const letzteAntwort = z?.antwort || [...verlauf].reverse().find((m) => m.role === "assistant" && typeof m.content === "string")?.content || "";

  if (WIEDERHOLEN.test(t)) {
    if (!letzteAntwort) return { answer: "Ich habe dir noch nichts gesagt, Boss. Frag mich einfach etwas.", actions: ["verstehen"] };
    return { answer: letzteAntwort, actions: ["verstehen", "wiederholen"] };
  }

  if (RUECKGAENGIG.test(t)) {
    const a = z?.angelegt;
    if (!a || Date.now() - a.zeit > FRISCH_MS || !hatEtwas(a)) {
      return { answer: "Da gibt es gerade nichts, was ich zurücknehmen kann. Rückgängig geht für Erinnerungen, Timer, Aufgaben, die Einkaufsliste und Notizen, bis zehn Minuten danach.", actions: ["verstehen"] };
    }
    const weg = zuruecknehmen(a);
    if (z) z.angelegt = null;
    if (!weg.length) return { answer: "Das ist schon weg, Boss.", actions: ["verstehen"] };
    return { answer: `Zurückgenommen: ${wegText(weg)}.`, actions: ["verstehen", "rueckgaengig"] };
  }

  if (MERK_DAS.test(t)) {
    if (!letzteAntwort || letzteAntwort.length < 8) return { answer: "Was soll ich mir merken? Sag zum Beispiel: Merk dir, dass ich Pizza mag.", actions: ["verstehen"] };
    const vorher = schnappschuss();
    store.addMemory(`Friday hat ${config.userName} gesagt: ${letzteAntwort.slice(0, 450)}`);
    if (z) z.angelegt = { ...neuSeit(vorher), zeit: Date.now() };
    return { answer: "Hab ich mir gemerkt, Boss.", actions: ["verstehen", "remember"] };
  }

  if (VERLAUF.test(t)) {
    const fragen = verlauf.filter((m) => m.role === "user" && typeof m.content === "string").map((m) => ohneSatzzeichen(kopfWeg(m.content)).slice(0, 70)).slice(-3);
    if (!fragen.length) return { answer: "Wir haben heute noch nicht gesprochen, Boss.", actions: ["verstehen"] };
    if (/gefragt$/.test(t)) return { answer: `Du hast mich zuletzt gefragt: ${fragen.at(-1)}`, actions: ["verstehen"] };
    return { answer: `Zuletzt ging es um: ${fragen.join(", dann ")}.`, actions: ["verstehen"] };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Folgefragen, Rückfragen und Korrekturen → vollständiger Satz
// ---------------------------------------------------------------------------------------------
const ZEITWORT = /^(heute|morgen|übermorgen|uebermorgen|gestern|heute abend|heute nacht|morgen früh|morgen frueh|morgen abend|am wochenende|nächste woche|naechste woche|diese woche|am (montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)|(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag))$/i;
const ZEIT_IM_SATZ = /\s*\b(heute abend|heute nacht|morgen früh|morgen frueh|morgen abend|heute|morgen|übermorgen|uebermorgen|gestern|am wochenende|nächste woche|naechste woche|diese woche|am (montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag))\b/gi;
const PRAEP = "in|im|für|fuer|bei|nach|von|vom|aus|über|ueber|zu|zum|zur|mit|gegen";
const RECHEN_OP = /^(plus|minus|mal|durch|geteilt durch|hoch|mehr|weniger|\+|-|\*|\/|x)\s+(.+)$/i;
const OBJEKT_FRAGE = /^(was kostet|was kosten|wie steht|wie viel kostet|wieviel kostet|kurs von|preis von|wer ist|wer war|was ist|was sind|was bedeutet|erklär mir|erklaer mir|erzähl mir (was |etwas )?(über|von)|zeig mir|wie alt ist|wie hoch ist|wie groß ist|wie gross ist|wie lang ist|hauptstadt von|wie viele einwohner hat|wieviele einwohner hat)\s+(.+)$/i;
const ZAHL_EINHEIT = /(\d+(?:[.,]\d+)?)\s*(minuten?|min|stunden?|std|sekunden?|sek|tage?n?|uhr|euro|€|grad|prozent|%|km|kilometer)\b/i;

function folgeTeil(text) {
  // "und morgen?", "und in Hamburg?", "was ist mit Ethereum?", "und wie sieht's in Paris aus?"
  const t = ohneSatzzeichen(String(text || "").trim());
  let m = t.match(/^und\s+(?:was ist )?(?:mit\s+)?(.{1,40})$/i) || t.match(/^(?:was ist|wie ist es|wie sieht('?s| es)) mit\s+(.{1,40}?)(?:\s+aus)?$/i);
  if (m) return ohneSatzzeichen(m[m.length - 1]);
  m = t.match(/^und\s+wie\s+sieht('?s| es)\s+(.{1,40}?)\s+aus$/i);
  if (m) return ohneSatzzeichen(m[2]);
  return null;
}

function korrekturTeil(text) {
  const t = ohneSatzzeichen(String(text || "").trim());
  const m = t.match(/^(?:nein|nee|ne|falsch|quatsch)[,!.]?\s+(?:ich (?:meinte|meine|wollte)\s+|eigentlich\s+|lieber\s+|sondern\s+)?(.{1,80})$/i) || t.match(/^(?:ich meinte|ich meine|ich wollte sagen|eigentlich|lieber)\s+(.{1,80})$/i);
  return m ? ohneSatzzeichen(m[1]) : null;
}

/** Baut aus einem Satzstück und der letzten Frage einen ganzen Satz. Gibt null zurück, wenn es nicht sicher passt. */
export function ergaenze(stueck, frage) {
  const s = ohneSatzzeichen(stueck);
  const f = ohneSatzzeichen(frage);
  if (!s || !f) return null;
  const sl = klein(s);

  // Zeit: "und morgen?" → Zeitwörter der alten Frage ersetzen
  if (ZEITWORT.test(sl)) return `${f.replace(ZEIT_IM_SATZ, "").replace(/\s{2,}/g, " ").trim()} ${s}`;

  // Rechnen: "und durch 3?" → mit dem letzten Ergebnis weiterrechnen (Ergebnis kommt vom Aufrufer)
  if (RECHEN_OP.test(sl)) return null;

  // Zahl mit Einheit: "nein, 20 Minuten" → "10 Minuten" in der alten Frage ersetzen
  const ze = s.match(ZAHL_EINHEIT);
  if (ze && woerter(s).length <= 4) {
    const einheit = klein(ze[2]).slice(0, 3);
    const re = new RegExp(`(\\d+(?:[.,]\\d+)?|ein(?:e|en)?|zwei|drei|vier|fünf|zehn|zwanzig|dreißig|halbe?)\\s*(${ze[2].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${einheit}\\w*)`, "i");
    if (re.test(f)) return f.replace(re, `${ze[1]} ${ze[2]}`);
  }

  // Mit Präposition: "und in Hamburg?" → das Ende der alten Frage ersetzen (oder anhängen)
  const pm = s.match(new RegExp(`^(${PRAEP})\\s+(.+)$`, "i"));
  const tail = new RegExp(`\\s+(${PRAEP})\\s+[^]+$`, "i");
  if (pm) {
    // Zeitwörter ("morgen") bleiben erhalten: erst herausnehmen, Ort ersetzen, wieder anhängen.
    const zeiten = (f.match(ZEIT_IM_SATZ) || []).map((x) => x.trim());
    const kern = f.replace(ZEIT_IM_SATZ, "").replace(/\s{2,}/g, " ").trim();
    const neu = tail.test(kern) ? kern.replace(tail, ` ${pm[1]} ${pm[2]}`) : `${kern} ${pm[1]} ${pm[2]}`;
    return [neu, ...zeiten].join(" ");
  }

  if (woerter(s).length > 4) return null;
  // Objekt-Frage: "was kostet Bitcoin" → "und Ethereum?"
  const om = f.match(OBJEKT_FRAGE);
  if (om) return `${om[1]} ${s}`;
  // Ort/Sache mit Präposition in der alten Frage: "wie spät ist es in Tokio" → "und New York?"
  const tm = f.match(new RegExp(`^(.*\\s(?:${PRAEP}))\\s+[^]+$`, "i"));
  if (tm) return `${tm[1]} ${s}`;
  // Sonst anhängen ("Wie ist das Wetter" → "und Hamburg?" → "Wie ist das Wetter in Hamburg")
  if (/^[A-ZÄÖÜ]/.test(s) || /^(wetter|wie spät|uhrzeit|wie warm|wie kalt|regnet)/i.test(f)) return `${f} in ${s}`;
  return null;
}

function letzteZahl(antwort) {
  const m = String(antwort || "").match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?/g);
  if (!m) return null;
  return m.at(-1).replace(/\.(?=\d{3}\b)/g, "");
}

/**
 * Macht aus Folgefrage, Rückfrage-Antwort oder Korrektur einen vollständigen Satz.
 * @returns {{text:string, art:"folge"|"rueckfrage"|"korrektur"}|null}
 */
export function umschreiben(text, kanal) {
  const z = zustand.get(kanal);
  if (!frisch(z) || !z.frage) return null;
  const roh = kopfWeg(text);
  const n = woerter(roh).length;
  if (!n || n > 12) return null;

  // Antwort auf eine offene Rückfrage ("Wann soll ich dich erinnern?" → "in 10 Minuten")
  if (z.offen && n <= 6 && !BEFEHL_START.test(klein(roh))) {
    const offen = z.offen;
    z.offen = null; // eine Rückfrage wird nur einmal beantwortet
    if (/^(danke|nein|nee|egal|vergiss es|abbrechen|abbruch|stopp|stop|lass (es|das)( sein)?|nichts|schon gut|doch nicht)\b/i.test(roh)) return null;
    return { text: `${ohneSatzzeichen(offen.frage)} ${ohneSatzzeichen(roh)}`, art: "rueckfrage" };
  }

  // Korrektur ("nein, ich meinte 20 Minuten") → alte Frage verbessern
  const k = korrekturTeil(roh);
  if (k) {
    if (woerter(k).length >= 3 && BEFEHL_START.test(klein(k))) return { text: k, art: "korrektur" };
    const neu = ergaenze(k, z.frage);
    if (neu && klein(neu) !== klein(z.frage)) return { text: neu, art: "korrektur" };
    return null;
  }

  // Folgefrage ("und morgen?", "und in Hamburg?", "und durch 3?") – nur nach Fragen, nicht nach "setz Butter auf die Liste".
  const f = folgeTeil(roh);
  if (f && !z.hatAngelegt && !/^(tschüss|tschuess|danke|gute nacht|so|gut|ok|okay|jetzt|dann|weiter|nun|sonst|warum|wieso|weshalb|wie|was|wer|du|ich|wir|alles|nichts|fertig|los)( |$)/i.test(f)) {
    const rm = klein(f).match(RECHEN_OP);
    if (rm && z.actions.includes("rechnen")) {
      const zahl = letzteZahl(z.antwort);
      if (zahl != null) return { text: `was ist ${zahl} ${f}`, art: "folge" };
    }
    const neu = ergaenze(f, z.frage);
    if (neu && klein(neu) !== klein(z.frage)) return { text: neu, art: "folge" };
  }
  return null;
}

/** Kurzes Satzstück, das allein keinen Sinn ergibt ("und morgen?") – nicht im Lexikon raten. */
export function istSatzstueck(text) {
  const roh = ohneSatzzeichen(kopfWeg(text));
  return Boolean(folgeTeil(roh) || korrekturTeil(roh) || /^(in|um|am|ab|bis|für|fuer|nach)\s+(\d+|einer|einem|zwei|drei|fünf|zehn|zwanzig|halb)\b/i.test(roh) || ZAHL_EINHEIT.test(roh) && woerter(roh).length <= 3);
}

// ---------------------------------------------------------------------------------------------
// Mehrere Befehle in einem Satz
// ---------------------------------------------------------------------------------------------
const BEFEHL_START = /^(mach|mache|schalt|schalte|stell|stelle|start|starte|spiel|spiele|öffne|oeffne|zeig|zeige|sag mir|nenn mir|erinner|erinnere|setz|setze|schreib(?!e? (ihr|ihm|ihnen)\b)|schreibe(?! (ihr|ihm|ihnen)\b)|füg|füge|fueg|fuege|notier|notiere|dimm|dimme|lösch|lösche|loesch|loesche|such|suche|wie|was|wann|wo|wer|welche[rsnm]?|gib|lies|pausier|pausiere|stopp|stoppe|stop|leg|lege|trag|trage|merk|merke|prüf|prüfe|pruef|pruefe|berechne|rechne|übersetz|übersetze|uebersetze|weck|wecke|plane|timer|wecker|licht|check|hol|bring|ruf mich|lauter|leiser|navigier|navigiere|bau|baue|erstell|erstelle|beobachte|verfolge|erzähl|erzähle|erzaehl|erzaehle|nenn|nenne|finde?|lern|lerne|aktivier|aktiviere|deaktivier|deaktiviere|schließ|schließe|schliess|schliesse|beende|dreh|drehe|speicher|speichere|würfel|würfle|wirf|kannst du|könntest du|koenntest du|hast du|gibt es|gibt's|ist es|wird es|regnet es|brauche ich|brauch ich)\b/i;
const VERWEIS = /^(\S+)\s+(es|ihn|ihm|ihr|sie|daraus|davon|damit|dazu|dort|darauf|darüber|darueber|da)\b/i;
const VERWEIS_DAS = /^(\S+)\s+(das|die|den|dem)\s*(an|aus|auf|zu|fertig|lauter|leiser|rückgängig|größer|kleiner|schöner|besser|nochmal|weg|wieder|bitte|mal)?$/i;
const NICHT_TEILEN = /\b(sag|sage|richte|schreib|schreibe|schick|schicke)\s+(ihr|ihm|ihnen)\b|^\s*alexa\b|\bruf\b.{0,40}\ban\b.{0,10}\bund\b|\bwenn du fertig bist\b|\bsobald\b|\bfalls\b|\bwenn\b/i;
const OBJEKTSATZ_ENDE = /\b(mir|dir|uns|bitte|mal|doch|ob|nicht|wissen|sagen|erklären|erklaeren|zeigen)$/i;

/** Teilt "mach X und sag mir Y" in einzelne Befehle. Gibt null zurück, wenn es nur ein Befehl ist. */
export function zerlegen(text) {
  const roh = kopfWeg(text, { fuellwoerter: true });
  if (!roh || roh.length > 240 || NICHT_TEILEN.test(roh)) return null;
  // Zuerst an klaren Trennern (", und dann", "danach", ";"), dann an "und" und Kommas.
  const TRENN = /(\s*(?:,?\s+und dann\s+|,?\s+und danach\s+|,?\s+danach\s+|,?\s+anschließend\s+|,?\s+anschliessend\s+|,\s*dann\s+|;\s*|,?\s+und\s+|,\s+))/i;
  const roh2 = roh.split(TRENN);
  if (roh2.length < 3) return null;
  const teile = [];
  for (let i = 0; i < roh2.length; i += 2) {
    const s = roh2[i];
    const trenner = i ? roh2[i - 1] : "";
    const st = ohneSatzzeichen(s.replace(/^(bitte|noch|auch|außerdem|ausserdem)\s+/i, ""));
    if (!st) continue;
    const istStart = BEFEHL_START.test(st) && woerter(st).length >= 2 && !VERWEIS.test(st) && !VERWEIS_DAS.test(st);
    if (teile.length && istStart && !OBJEKTSATZ_ENDE.test(teile.at(-1))) teile.push(st);
    else if (teile.length) teile[teile.length - 1] = `${teile.at(-1)}${trenner}${s.trim()}`;
    else teile.push(st);
  }
  if (teile.length < 2 || teile.length > 4) return null;
  if (!teile.every((x) => BEFEHL_START.test(x) && woerter(x).length >= 2)) return null;
  return teile;
}

/** Fügt die Antworten mehrerer Befehle zu einer gesprochenen Antwort zusammen. */
export function verbinde(antworten) {
  const a = antworten.map((x) => String(x || "").trim()).filter(Boolean);
  return a.map((x) => (/[.!?…]$/.test(x) ? x : `${x}.`)).join(" ");
}

/** Für Korrekturen: nimmt zurück, was beim letzten (falschen) Befehl angelegt wurde. */
export function zuruecknehmenAlt(angelegt) {
  if (!angelegt || Date.now() - angelegt.zeit > FRISCH_MS || !hatEtwas(angelegt)) return null;
  const weg = zuruecknehmen(angelegt);
  return weg.length ? weg : null;
}

export const _test = { folgeTeil, korrekturTeil, letzteZahl, BEFEHL_START };
