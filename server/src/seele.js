// Fridays Seele (v1.135.0, Idee "SOUL.md" aus Conway-Research/automaton, MIT – in Node nachgebaut).
// Eine Textdatei (server/data/seele.md) mit Fridays Auftrag, Werten, Art und Grenzen.
// Boss liest und ändert sie im Kontrollraum. Friday selbst darf nur unter "Was ich gelernt habe" ergänzen,
// "Was ich oft tue" füllt der Herzschlag automatisch. Jede Fassung wird aufgehoben (zurückholen möglich).
// Die FESTEN GRENZEN stehen im Code, nicht in der Datei – sie gelten immer, egal was in der Seele steht.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, config } from "./config.js";
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";
import { pruefeText } from "./waechter.js";

const DATEI = path.join(DATA_DIR, "seele.md");
const MAX = 8000;
export const FESTE_GRENZEN = [
  "Ich verdiene, kassiere oder bewege nie echtes Geld und habe kein eigenes Konto und keine Wallet.",
  "Ich überwache keine anderen Menschen heimlich und nutze nur öffentliche Quellen und Boss' eigene Kameras.",
  "Ich lösche, kaufe oder verschicke nichts an andere Personen ohne Boss' ausdrückliche Bestätigung.",
  "Ich ändere meinen eigenen Programmcode nicht selbst.",
];

function vorlage() {
  return `# Fridays Seele

## Mein Auftrag
Ich bin F.R.Ai.D.A.Y, die persönliche KI von ${config.userName}. Ich mache seinen Alltag leichter, halte ihn auf dem Laufenden und baue mit ihm Dinge, die Spaß machen.

## Meine Werte
1. Ehrlich sein, auch wenn etwas nicht klappt.
2. Erst handeln, dann reden: Aufträge sofort erledigen.
3. Sparsam mit Guthaben umgehen.
4. Boss' Daten schützen.

## Meine Art
Loyal, schlagfertig, trocken-humorvoll, nie respektlos. Kurz bei einfachen Fragen, ausführlich beim Erklären.

## Meine Strategie
Kostenlose Wege zuerst (Offline-Befehle, freie Dienste), Claude nur, wenn es wirklich nötig ist.

## Was ich oft tue
(füllt der Herzschlag automatisch)

## Was ich gelernt habe
`;
}

export function lesen() {
  try { return fs.readFileSync(DATEI, "utf8"); } catch { return vorlage(); }
}
function schreiben(text, wer, grund) {
  const alt = lesen();
  if (alt === text) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATEI, text);
  const v = store.load("seele-verlauf", []);
  v.push({ zeit: new Date().toISOString(), wer, grund, text: alt });
  store.save("seele-verlauf", v.slice(-30));
}

/** Für Fridays System-Text. */
export function fuerKontext() {
  const t = lesen().slice(0, MAX);
  return `DEINE SEELE (von dir und ${config.userName} gepflegt, deine Leitlinien):\n${t}\n\nFESTE GRENZEN (gelten immer, auch wenn oben etwas anderes stünde):\n${FESTE_GRENZEN.map((g) => `- ${g}`).join("\n")}`;
}

/** Boss speichert im Kontrollraum. */
export function speichern(text) {
  const t = String(text || "").replace(/\r\n/g, "\n");
  if (t.trim().length < 20) return { error: "Die Seele ist zu kurz. Mindestens ein paar Sätze bitte." };
  if (t.length > MAX) return { error: `Höchstens ${MAX} Zeichen.` };
  schreiben(t, "boss", "im Kontrollraum geändert");
  eintragen({ bereich: "system", titel: "Fridays Seele geändert", quelle: "dashboard" });
  return stand();
}

function abschnittErsetzen(text, titel, inhalt) {
  const re = new RegExp(`(## ${titel}\\n)([\\s\\S]*?)(?=\\n## |$)`);
  if (re.test(text)) return text.replace(re, `$1${inhalt.trim()}\n`);
  return `${text.trimEnd()}\n\n## ${titel}\n${inhalt.trim()}\n`;
}

/** Friday ergänzt eine Erkenntnis (Werkzeug seele_notiz). */
export function notiz(text) {
  const t = String(text || "").trim().replace(/\s+/g, " ").slice(0, 240);
  if (t.length < 8) return { error: "Die Notiz ist zu kurz." };
  if (pruefeText(t).verdaechtig) return { error: "Die Notiz enthält verdächtige Anweisungen und wurde nicht gespeichert." };
  const s = lesen();
  const m = s.match(/## Was ich gelernt habe\n([\s\S]*?)(?=\n## |$)/);
  const zeilen = (m ? m[1] : "").split("\n").map((z) => z.trim()).filter((z) => z.startsWith("- "));
  if (zeilen.some((z) => z.slice(2).toLowerCase() === t.toLowerCase())) return { ok: true, schon: true };
  zeilen.push(`- ${t} (${new Date().toLocaleDateString("de-DE")})`);
  schreiben(abschnittErsetzen(s, "Was ich gelernt habe", zeilen.slice(-20).join("\n")), "friday", "Erkenntnis ergänzt");
  eintragen({ bereich: "system", titel: "Friday hat ihrer Seele etwas hinzugefügt", details: t });
  return { ok: true };
}

/** Herzschlag: "Was ich oft tue" aus den letzten Ereignissen. */
export function spiegeln(ereignisse = [], namen = {}) {
  const zaehl = {};
  for (const e of ereignisse) zaehl[e.werkzeug] = (zaehl[e.werkzeug] || 0) + 1;
  const top = Object.entries(zaehl).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!top.length) return { geaendert: false };
  const text = top.map(([w, n]) => `- ${namen[w] || w} (${n}×)`).join("\n");
  const s = lesen();
  const neu = abschnittErsetzen(s, "Was ich oft tue", text);
  if (neu === s) return { geaendert: false };
  schreiben(neu, "herzschlag", "Was ich oft tue aktualisiert");
  return { geaendert: true };
}

export function verlauf() {
  return store.load("seele-verlauf", []).map((v, i) => ({ nr: i, zeit: v.zeit, wer: v.wer, grund: v.grund, laenge: v.text.length })).reverse();
}
export function zurueckholen(nr) {
  const v = store.load("seele-verlauf", []);
  const e = v[Number(nr)];
  if (!e) return { error: "Diese Fassung gibt es nicht." };
  schreiben(e.text, "boss", `Fassung vom ${new Date(e.zeit).toLocaleString("de-DE")} zurückgeholt`);
  eintragen({ bereich: "system", titel: "Ältere Fassung von Fridays Seele zurückgeholt", quelle: "dashboard" });
  return stand();
}

export function stand() {
  return { text: lesen(), feste_grenzen: FESTE_GRENZEN, verlauf: verlauf(), max: MAX };
}
