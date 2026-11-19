// Noch mehr Offline-Antworten (v1.104.0): Version & Status, Guthaben, Name, Feiertage ohne Internet,
// Licht ohne Smart Home, Spiele direkt starten. Alles ohne Claude und ohne Guthaben.
import { config } from "./config.js";
import { isAgentOnline } from "./agent-hub.js";
import { getEnergie } from "./energie.js";
import { runningVersion } from "./updater.js";
import { hueBereit } from "./hue.js";
import { haBereit } from "./homeassistant.js";
import { alexaConfigured } from "./alexa.js";

const name = () => config.userName || "Boss";
const euro = (usd) => `${Number(usd).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dollar`;

function laufzeitText(sek) {
  const s = Math.max(0, Math.round(sek));
  const t = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (t) return `${t} ${t === 1 ? "Tag" : "Tagen"} und ${h} ${h === 1 ? "Stunde" : "Stunden"}`;
  if (h) return `${h} ${h === 1 ? "Stunde" : "Stunden"} und ${m} ${m === 1 ? "Minute" : "Minuten"}`;
  const mm = Math.max(1, m);
  return `${mm} ${mm === 1 ? "Minute" : "Minuten"}`;
}

export function energieSatz() {
  const e = getEnergie();
  if (e.zustand === "tot") return `Mein Claude-Guthaben ist leer, ${name()}. Lade es auf console.anthropic.com auf und trag den Betrag im Energie-Fenster ein. Meine Offline-Befehle laufen trotzdem.`;
  if (e.guthaben == null) return `Wie viel Guthaben genau noch da ist, weiß ich nicht, weil im Energie-Fenster noch kein Betrag steht. Bisher habe ich etwa ${euro(e.verbrauch || 0)} verbraucht. Tipp oben auf ⚡ Energie und trag ein, wie viel du aufgeladen hast.`;
  const teil = `Ich habe noch etwa ${euro(e.rest)}, das sind ${e.prozent} Prozent.`;
  return e.zustand === "spar" ? `${teil} Ich bin im Sparmodus und denke mit dem günstigen Modell.` : `${teil} Alles im grünen Bereich.`;
}

export function statusSatz() {
  const e = getEnergie();
  const teile = [
    `Ich laufe mit Version ${runningVersion()}, seit ${laufzeitText(process.uptime())}.`,
    isAgentOnline() ? "Der Mac ist verbunden." : "Der Mac ist gerade nicht verbunden.",
    e.zustand === "tot" ? "Mein Claude-Guthaben ist leer, ich arbeite offline." : e.zustand === "spar" ? "Ich bin im Sparmodus." : "Mein Gehirn ist bereit.",
  ];
  return teile.join(" ");
}

// --- Deutsche Feiertage, selbst berechnet (bundesweit), falls der Feiertags-Dienst nicht erreichbar ist ---
function ostersonntag(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, monat - 1, tag);
}
export function feiertageOffline(y) {
  const o = ostersonntag(y), tag = 86400000;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  return [
    { datum: `${y}-01-01`, name: "Neujahr" },
    { datum: iso(o - 2 * tag), name: "Karfreitag" },
    { datum: iso(o + tag), name: "Ostermontag" },
    { datum: `${y}-05-01`, name: "Tag der Arbeit" },
    { datum: iso(o + 39 * tag), name: "Christi Himmelfahrt" },
    { datum: iso(o + 50 * tag), name: "Pfingstmontag" },
    { datum: `${y}-10-03`, name: "Tag der Deutschen Einheit" },
    { datum: `${y}-12-25`, name: "1. Weihnachtstag" },
    { datum: `${y}-12-26`, name: "2. Weihnachtstag" },
  ].sort((a, b) => a.datum.localeCompare(b.datum));
}
export function naechsteFeiertageOffline(heuteIso = new Date().toISOString().slice(0, 10)) {
  const y = Number(heuteIso.slice(0, 4));
  return [...feiertageOffline(y), ...feiertageOffline(y + 1)].filter((f) => f.datum >= heuteIso).slice(0, 6);
}

/**
 * Antworten, die immer ohne Claude gehen.
 * @param {string} t normalisierter Text
 * @returns {null | {answer:string, actions:string[]}}
 */
export function plusAnswer(t) {
  const ok = (answer, ...actions) => ({ answer, actions: ["offline", ...actions] });
  if (/^(wie heißt du|wie heisst du|wie ist dein name|was ist dein name|wofür steht (friday|dein name))$/.test(t)) {
    return ok("Ich heiße F.R.Ai.D.A.Y, kurz Friday. Deine persönliche KI im Iron-Man-Stil.");
  }
  if (/^(wer hat dich (gebaut|programmiert|erschaffen|gemacht|entwickelt)|wer ist dein (chef|boss|erfinder|schöpfer|schoepfer))$/.test(t)) {
    return ok(`${name()} hat mich erschaffen, mit Hilfe von Claude. Mein Gehirn ist Claude von Anthropic, der Rest läuft auf deinem Mac.`);
  }
  if (/^(welche version (hast|bist|läufst|laeufst) du|welche version|deine version|versionsnummer|was ist deine version|auf welchem stand bist du)( gerade)?$/.test(t)) {
    return ok(`Ich laufe mit Version ${runningVersion()}. Neue Versionen installiere ich von selbst, sobald sie fertig sind.`, "version");
  }
  if (/^(systemstatus|system ?status|status|statusbericht|wie ist (der|dein) status|wie läuft es|wie laeuft es|läuft alles|laeuft alles|alles in ordnung|bist du online|bist du da)$/.test(t)) {
    return ok(statusSatz(), "status");
  }
  if (/\b(guthaben|energie|wie viel geld hast du|kontostand)\b/.test(t) && /\b(wie viel|wieviel|noch|stand|hast du|wie ist|zeig)\b/.test(t) && t.length < 70) {
    return ok(energieSatz(), "energie");
  }
  return null;
}

/**
 * Antworten, wenn Claude nicht erreichbar ist (Notfall).
 * @returns {null | {answer:string, actions:string[]}}
 */
export function plusNotfall(t) {
  const ok = (answer, ...actions) => ({ answer, actions: ["offline", ...actions] });
  if (/\b(licht|lampe|lampen|beleuchtung)\b/.test(t) && /\b(an|aus|ein|heller|dunkler|dimm\w*|schalt\w*)\b/.test(t)) {
    if (!hueBereit() && !haBereit() && !alexaConfigured()) {
      return ok("Für Licht brauche ich Philips Hue, Home Assistant oder Alexa. Richte eins davon im Werkzeug-Menü unter Verbindungen ein, dann klappt es auch ohne Guthaben.", "dienste");
    }
    return ok("Diese Lampe habe ich nicht gefunden. Sag zum Beispiel: Licht im Wohnzimmer an.");
  }
  if (/^(übersetz|uebersetz)\w*\b/.test(t)) {
    return ok("Übersetzen kann ich nur mit meinem großen Gehirn, und dafür fehlt gerade das Claude-Guthaben.");
  }
  return null;
}
