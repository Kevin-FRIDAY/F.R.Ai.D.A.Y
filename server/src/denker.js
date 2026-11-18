// Fridays Denker: ein Claude-Aufruf für Labor, Missionen und Ziel-Navigator.
// KI-Modell-Routing: wählt je nach Aufgabe das passende Modell (Haiku für Einfaches, Sonnet als
// Standard, Opus für Schweres) und spart automatisch, wenn das Guthaben knapp ist (Energie-System).
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { brainModel, SPAR_MODELL, recordUsage, isCreditError, markEmpty, getEnergie } from "./energie.js";
import { getSettings } from "./einstellungen.js";

const client = new Anthropic({ apiKey: config.anthropicKey });

export const MODELLE = {
  leicht: { model: "claude-haiku-5-5", name: "Haiku 5.5 (schnell & günstig)", effort: "low" },
  mittel: { model: "claude-sonnet-5-5", name: "Sonnet 5.5 (klug & schnell)", effort: "low" },
  schwer: { model: null, name: "Opus (gründlich)", effort: "medium" }, // null = CLAUDE_MODEL aus der .env
};
const SCHWER = /\b(vertrag|klausel|studie|studien|forschung|strategie|architektur|programmier|code|beweis|rechtlich|juristisch|medizin|vergleich(e)? .{0,40} (methoden|studien)|analysiere (genau|gründlich|ausführlich))\b/i;

/** Für das Gespräch (Denk-Tempo "Automatisch"): welches Tempo passt zu dieser Frage? */
export function tempoFuerFrage(text = "") {
  const t = String(text || "").trim();
  if (SCHWER.test(t) || t.length > 600) return "gruendlich";
  if (t.length < 70 && !/\b(warum|wieso|erklär|erklaer|plan|schreib|erstelle|vergleich|analys|recherch|such)/i.test(t)) return "blitz";
  return "schnell";
}

/**
 * Welches Modell passt? stufe: "leicht" | "mittel" | "schwer" | "auto".
 * Bei "auto" entscheidet Länge und Art der Aufgabe. Das Denk-Tempo "blitz" deckelt auf Haiku.
 */
export function waehleModell(stufe = "auto", text = "") {
  let s = stufe;
  if (s === "auto" || !MODELLE[s]) {
    const t = String(text || "");
    s = SCHWER.test(t) || t.length > 6000 ? "schwer" : t.length < 160 && !/\n/.test(t) ? "leicht" : "mittel";
  }
  if (getSettings().tempo === "blitz" && s !== "leicht") s = "leicht";
  const wunsch = MODELLE[s].model || config.model;
  const model = brainModel(wunsch);
  const gespart = model === SPAR_MODELL && wunsch !== SPAR_MODELL;
  return { stufe: s, model, gespart, effort: gespart ? "low" : MODELLE[s].effort, grund: gespart ? "Sparmodus (Guthaben knapp)" : stufe === "auto" ? `automatisch gewählt: ${s}` : `fest: ${s}` };
}

const WEB_SEARCH = { type: "web_search_20260209", name: "web_search", max_uses: 4 };

/**
 * Fragt Claude ohne Werkzeuge (optional mit Websuche).
 * @returns {Promise<{ok:boolean, text?:string, model?:string, routing?:object, error?:string, leer?:boolean}>}
 */
export async function denke({ system, text, image, stufe = "auto", websuche = false, maxTokens = 6000, quelle = "labor" }) {
  if (getEnergie().zustand === "leer") return { ok: false, leer: true, error: "Fridays Guthaben ist leer. Lade es auf console.anthropic.com auf und trag den Betrag im Energie-Fenster ein." };
  const routing = waehleModell(stufe, text);
  const content = [];
  if (image?.data) content.push({ type: "image", source: { type: "base64", media_type: image.mediaType || "image/jpeg", data: image.data } });
  content.push({ type: "text", text: String(text || "").slice(0, 60000) });
  const messages = [{ role: "user", content }];
  try {
    for (let runde = 0; runde < 4; runde++) {
      const params = {
        model: routing.model,
        max_tokens: routing.gespart ? Math.min(maxTokens, 3000) : maxTokens,
        output_config: { effort: routing.effort },
        system: String(system || ""),
        messages,
      };
      if (websuche && !routing.gespart) params.tools = [WEB_SEARCH];
      const r = await client.messages.create(params);
      recordUsage(r.model || routing.model, r.usage, quelle);
      if (r.stop_reason === "refusal") return { ok: false, error: "Dabei kann Friday nicht helfen." };
      if (r.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: r.content }); continue; }
      const antwort = r.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      return { ok: true, text: antwort, model: r.model || routing.model, routing };
    }
    return { ok: false, error: "Die Suche hat zu lange gedauert." };
  } catch (err) {
    if (isCreditError(err)) { markEmpty(); return { ok: false, leer: true, error: "Fridays Guthaben ist leer." }; }
    console.error("Denker:", err.message);
    return { ok: false, error: "Claude ist gerade nicht erreichbar." };
  }
}

/** Holt JSON aus einer Claude-Antwort (auch wenn drumherum Text steht). */
export function jsonAus(text) {
  const s = String(text || "");
  const roh = s.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] || s.slice(Math.min(...["{", "["].map((c) => (s.indexOf(c) < 0 ? Infinity : s.indexOf(c)))));
  try { return JSON.parse(roh); } catch { /* weiter */ }
  const ende = Math.max(roh.lastIndexOf("}"), roh.lastIndexOf("]"));
  try { return JSON.parse(roh.slice(0, ende + 1)); } catch { return null; }
}
