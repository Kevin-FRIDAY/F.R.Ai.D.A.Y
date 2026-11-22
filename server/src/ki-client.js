// Fridays Draht zum Denken (v1.142.0): sieht aus wie der Anthropic-Client (messages.create / .stream,
// auch beta.*), fragt zuerst Claude und springt bei Ausfall auf das Ersatz-Gehirn OpenRouter um.
// Einspringen bei: Guthaben leer, Schlüssel fehlt/abgelehnt, Überlastung (429/529), Störung (5xx), kein Netz.
// Nicht bei normalen Anfrage-Fehlern (400), die würden auch bei OpenRouter scheitern.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { isCreditError, markEmpty, getEnergie } from "./energie.js";
import * as OR from "./openrouter.js";

let claude = null;
function claudeClient() {
  if (!config.anthropicKey) return null;
  if (!claude) claude = new Anthropic({ apiKey: config.anthropicKey });
  return claude;
}

// Nach "Guthaben leer" fragt Friday Claude 10 Minuten lang gar nicht erst (spart Wartezeit),
// außer das Guthaben wurde inzwischen wieder aufgeladen (Energie nicht mehr "tot").
const PAUSE_MS = 10 * 60 * 1000;
let leerSeit = 0;

/** Soll dieser Fehler das Ersatz-Gehirn wecken? */
export function istAusfall(err) {
  if (isCreditError(err)) return true;
  const s = Number(err?.status);
  if (!s) return true; // keine Antwort: Netz weg, Zeitüberschreitung
  return s === 401 || s === 403 || s === 402 || s === 408 || s === 429 || s >= 500;
}

function claudeUeberspringen() {
  if (OR.testImmer()) return "Testmodus in Eve";
  if (!claudeClient()) return "kein Claude-Schlüssel";
  if (leerSeit && Date.now() - leerSeit < PAUSE_MS && getEnergie().zustand === "tot") return "Claude-Guthaben leer";
  return "";
}

function ersatzGrund(err) {
  if (isCreditError(err)) return "Claude-Guthaben leer";
  const s = Number(err?.status);
  if (s === 401 || s === 403) return "Claude-Schlüssel abgelehnt";
  if (s === 429 || s === 529) return "Claude überlastet";
  if (s >= 500) return `Claude-Störung (${s})`;
  return `Claude nicht erreichbar (${String(err?.message || err).slice(0, 80)})`;
}

async function mitErsatz(versuch, params) {
  const ueberspringen = OR.ersatzBereit() ? claudeUeberspringen() : "";
  let claudeFehler = null;
  if (!ueberspringen) {
    try {
      const c = claudeClient();
      if (!c) throw Object.assign(new Error("Kein Claude-Schlüssel (ANTHROPIC_API_KEY fehlt)."), { status: 401 });
      const r = await versuch(c);
      leerSeit = 0;
      return r;
    } catch (err) {
      if (isCreditError(err)) { markEmpty(); leerSeit = Date.now(); }
      if (!OR.ersatzBereit() || !istAusfall(err) || err?.ersatzNichtMoeglich) throw err;
      console.error("Claude fällt aus, Ersatz-Gehirn springt ein:", String(err?.message || err).slice(0, 160));
      OR.eingesprungen(ersatzGrund(err));
      claudeFehler = err;
    }
  } else {
    OR.eingesprungen(ueberspringen);
  }
  try {
    return await OR.erstelle(params);
  } catch (orFehler) {
    console.error("Ersatz-Gehirn:", orFehler.message);
    // Den ursprünglichen Claude-Fehler weitergeben (z. B. "credit balance"), damit Friday ehrlich sagt, was los ist.
    if (claudeFehler) { try { claudeFehler.message = `${claudeFehler.message} | Ersatz-Gehirn: ${orFehler.message}`; } catch { /* nur lesbar */ } throw claudeFehler; }
    throw orFehler;
  }
}

/** Wie client.messages.stream(): .on("text"|"inputJson", …) und .finalMessage(). */
function streamMitErsatz(params, beta) {
  const hoerer = [];
  let gestartet = false;
  let fertig = null;
  const strom = {
    on(ereignis, fn) { hoerer.push([ereignis, fn]); return strom; },
    finalMessage() {
      if (fertig) return fertig;
      fertig = mitErsatz(async (c) => {
        const s = beta ? c.beta.messages.stream(params) : c.messages.stream(params);
        for (const [e, fn] of hoerer) s.on(e, (...a) => { gestartet = true; fn(...a); });
        try {
          return await s.finalMessage();
        } catch (err) {
          // Ist schon Text angekommen, nicht doppelt bauen: Fehler normal weitergeben.
          if (gestartet) err.ersatzNichtMoeglich = true;
          throw err;
        }
      }, params).then((msg) => {
        if (String(msg.model || "").startsWith("openrouter/")) {
          // Ersatz kam am Stück: den Zuhörern einmal alles geben.
          const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
          for (const [e, fn] of hoerer) {
            try {
              if (e === "text" && text) fn(text, text);
              if (e === "inputJson") for (const b of msg.content) if (b.type === "tool_use") fn(JSON.stringify(b.input), b.input);
            } catch { /* Zuhörer-Fehler nicht weiterreichen */ }
          }
        }
        return msg;
      });
      return fertig;
    },
  };
  return strom;
}

/** Ersatz für `new Anthropic({ apiKey })` in Fridays Modulen. */
export function kiClient() {
  const messages = {
    create: (params) => mitErsatz((c) => c.messages.create(params), params),
    stream: (params) => streamMitErsatz(params, false),
  };
  const beta = {
    messages: {
      create: (params) => mitErsatz((c) => c.beta.messages.create(params), params),
      stream: (params) => streamMitErsatz(params, true),
    },
  };
  return { messages, beta };
}

/** Kann Friday gerade denken (Claude mit Guthaben oder Ersatz-Gehirn)? */
export const denkenMoeglich = () => OR.ersatzBereit() || (Boolean(config.anthropicKey) && getEnergie().zustand !== "tot");
export const ersatzBereit = () => OR.ersatzBereit();
