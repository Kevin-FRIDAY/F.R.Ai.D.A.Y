// OpenJarvis-Paket (v1.134.0): Ideen aus dem Open-Source-Projekt OpenJarvis (Stanford, Apache-2.0-Lizenz,
// https://github.com/open-jarvis/OpenJarvis), für Friday in Node neu gebaut – kein Code übernommen.
//   Freigabe-Glocke   – riskante Aktionen erst nach deinem OK (Dashboard oder Telegram-Knopf)
//   Dauer-Wächter     – beobachtet Preise, Länder, Themen, Webseiten, Wetter und meldet sich per Telegram
//   Dokumenten-Wissen – durchsucht deine eigenen PDFs und Dateien, mit Quelle
//   Apple-Apps        – Notizen, Kontakte, Musik, Health-Verlauf
//   Whisper           – Spracherkennung direkt auf dem Mac
import * as freigaben from "./freigaben.js";
import * as waechter from "./dauerwaechter.js";
import * as dokwissen from "./dokwissen.js";
import * as apple from "./apple.js";
import { hoerenRouten, pruefeBereit } from "./hoeren.js";

export function jarvisRouten(app, asyncRoute) {
  freigaben.freigabenRouten(app, asyncRoute);
  waechter.waechterRouten(app, asyncRoute);
  dokwissen.dokwissenRouten(app, asyncRoute);
  apple.appleRouten(app, asyncRoute);
  hoerenRouten(app, asyncRoute);
}

export function jarvisStart() {
  freigaben.freigabenStart();
  waechter.waechterStart();
  dokwissen.dokwissenStart();
  setTimeout(() => pruefeBereit().catch(() => {}), 30 * 1000).unref?.();
}

/** Sprachbefehle ohne Claude. Reihenfolge: Glocke, Wächter, Dokumente, Apple. */
export async function quickCommand(text) {
  for (const fn of [freigaben.quickCommand, waechter.quickCommand, dokwissen.quickCommand, apple.quickCommand]) {
    try {
      const r = await fn(text);
      if (r) return r;
    } catch (err) {
      console.error("OpenJarvis-Paket:", err.message);
    }
  }
  return null;
}

export const toolDefinitions = [waechter.toolDefinition, dokwissen.toolDefinition, ...apple.toolDefinitions];
const NAMEN = new Set(toolDefinitions.map((t) => t.name));
export const istJarvisTool = (name) => NAMEN.has(name);
export async function runJarvisTool(name, input = {}) {
  if (name === "dauer_waechter") return waechter.runTool(input);
  if (name === "dokumente_suchen") return dokwissen.runTool(input);
  if (apple.TOOL_NAMEN.has(name)) return apple.runTool(name, input);
  return { error: "Unbekanntes Werkzeug" };
}
