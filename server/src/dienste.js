// Fridays Verbindungen an einem Ort: Kalender, Spotify, Home Assistant, Hue, Todoist, Notion.
// - Sprachbefehle ohne Claude (laufen auch ohne Guthaben)
// - Werkzeuge für Claude
// - Daten für das Fenster "Verbindungen"
import * as kalender from "./kalender.js";
import * as spotify from "./spotify.js";
import * as homeassistant from "./homeassistant.js";
import * as hue from "./hue.js";
import * as todoist from "./todoist.js";
import * as notion from "./notion.js";
import * as anrufe from "./anrufe.js";
import * as openrouter from "./openrouter.js";
import { normalize } from "./offline.js";
import { U, findeTag } from "./datum.js";

export const DIENSTE = { openrouter, anrufe, kalender, spotify, homeassistant, hue, todoist, notion };
export const REIHENFOLGE = ["openrouter", "anrufe", "kalender", "spotify", "homeassistant", "hue", "todoist", "notion"];

export async function alleStatus() {
  const liste = await Promise.all(
    REIHENFOLGE.map(async (id) => {
      try {
        return await DIENSTE[id].status();
      } catch (err) {
        return { ...DIENSTE[id].info, eingerichtet: false, text: `Fehler: ${err.message}`, felder: [], auswahl: [], aktionen: [] };
      }
    }),
  );
  return { dienste: liste, verbunden: liste.filter((x) => x.eingerichtet).length, gesamt: liste.length };
}

// "Was steht heute an?" – Kalender + Todoist zusammen
async function tagesUeberblick(t) {
  if (!U(/^(was steht|was liegt|was ist|was hab ich|was habe ich)( denn)?( für)? ?(heute|morgen)? ?(an|vor|so an)( heute| morgen)?$|^(mein tag|mein tag heute|wie sieht mein tag aus|tagesplan|was gibt('s| es) heute)$/).test(t)) return null;
  const tag = findeTag(t);
  const plus = tag ? tag.plus : 0;
  const teile = [];
  const k = await kalender.heuteSatz(plus).catch(() => null);
  if (k) teile.push(k);
  if (plus === 0) {
    const td = await todoist.heuteSatz().catch(() => null);
    if (td) teile.push(td);
  }
  return teile.length ? teile.join(" ") : null;
}

/**
 * Sprachbefehle ohne Claude.
 * @returns {Promise<{answer:string, actions:string[]} | null>}
 */
export async function quickCommand(text) {
  const t = normalize(text);
  if (!t || t.length > 220) return null;
  const roh = normalize(text, { gross: true });
  const versuche = [
    ["kalender", () => tagesUeberblick(t)],
    ["kalender", () => kalender.quick(t, roh)],
    ["hue", () => hue.quick(t)],
    ["smarthome", () => homeassistant.quick(t)],
    ["spotify", () => spotify.quick(t)],
    ["todoist", () => todoist.quick(t)],
    ["notion", () => notion.quick(t, roh)],
  ];
  for (const [name, fn] of versuche) {
    try {
      const a = await fn();
      if (a) return { answer: a, actions: [name] };
    } catch (err) {
      console.error(`Schnellbefehl ${name}:`, err.message);
    }
  }
  return null;
}

// ---------- Werkzeuge für Claude (Beschreibungen in dienste-werkzeuge.js) ----------
export { toolDefinitions, smartHomeTool } from "./dienste-werkzeuge.js";

const TOOL_MODULE = { anrufe, kalender, spotify, hue, todoist, notion, smart_home: homeassistant };
export const istDienstTool = (name) => Object.hasOwn(TOOL_MODULE, name);
export async function runDienstTool(name, input = {}) {
  const r = await TOOL_MODULE[name].command(input);
  return r.ok ? r : { error: r.error };
}

// Für Fridays Gehirn: welche Verbindungen gerade laufen.
export function dienstKurzinfo() {
  const an = [];
  if (kalender.kalenderBereit()) an.push("Apple Kalender & Erinnerungen (kalender)");
  if (spotify.spotifyVerbunden()) an.push("Spotify (spotify)");
  if (hue.hueBereit()) an.push("Philips Hue (hue)");
  if (homeassistant.haBereit()) an.push("Home Assistant (smart_home)");
  if (todoist.todoistBereit()) an.push("Todoist (todoist)");
  if (notion.notionBereit()) an.push("Notion (notion)");
  if (anrufe.anrufeBereit()) an.push(anrufe.kurzinfo());
  return an.length ? `Verbundene Dienste: ${an.join(", ")}.` : "Noch keine Dienste wie Kalender, Spotify oder Smart Home verbunden.";
}

