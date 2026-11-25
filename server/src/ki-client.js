// Fridays Draht zum Denken (v1.142.0): sieht aus wie der Anthropic-Client (messages.create / .stream,
// auch beta.*), fragt zuerst Claude und springt bei Ausfall auf das Ersatz-Gehirn OpenRouter um.
// Einspringen bei: Guthaben leer, Schlüssel fehlt/abgelehnt, Überlastung (429/529), Störung (5xx), kein Netz.
// Nicht bei normalen Anfrage-Fehlern (400), die würden auch bei OpenRouter scheitern.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { isCreditError, markEmpty, getEnergie, recordUsage } from "./energie.js";
import { eintragen as logbuchEintrag } from "./logbuch.js";
import * as OR from "./openrouter.js";
import * as OL from "./ollama.js";
import * as SW from "./ki-schwarm.js";
import { stand as deckelStand } from "./kostendeckel.js";

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
// v1.178.0: Meldet Claude ein Nutzungslimit (429/529), 2 Minuten lang gleich den nächsten Dienst nehmen.
const LIMIT_PAUSE_MS = 2 * 60 * 1000;
let limitSeit = 0;
/** Ist der Kosten-Deckel erreicht? Dann nur noch kostenlose Gehirne (Ollama). */
const nurKostenlos = () => { try { return deckelStand().stufe === "gesperrt"; } catch { return false; } };
/** Gibt es außer Claude noch ein Gehirn, das einspringen kann? */
const onlineErsatzDa = () => OR.ersatzBereit() || SW.kette().length > 0;

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
  if (limitSeit && Date.now() - limitSeit < LIMIT_PAUSE_MS) return "Claude-Nutzungslimit (kurze Pause)";
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

// v1.160.0/v1.161.0: Ollama (lokal oder Cloud).
//   · immer   → nur Ollama
//   · sparen  → Ollama zuerst, bei Fehler Claude/OpenRouter (spart Guthaben)
//   · notfall → Ollama als letzte Stufe, wenn Claude und OpenRouter ausfallen
async function mitErsatz(versuch, params) {
  if (OL.immer()) { OL.eingesprungen("Modus: nur Ollama"); return ollamaLive(params); }
  // v1.178.0 Kostenkontrolle: Kosten-Deckel erreicht → nur noch das kostenlose Gehirn (Ollama), falls eingerichtet.
  if (nurKostenlos() && OL.bereit() && OL.passtZu(params)) { OL.eingesprungen("Kosten-Deckel erreicht"); return ollamaLive(params); }
  let ollamaVersucht = false;
  if (OL.sparen() && OL.passtZu(params)) {
    ollamaVersucht = true;
    try {
      const r = await ollamaLive(params);
      OL.eingesprungen("Spar-Modus");
      return r;
    } catch (err) {
      console.error("Spar-Modus: Ollama klappt nicht, Claude übernimmt:", String(err?.message || err).slice(0, 160));
    }
  }
  try {
    return await mitErsatzOnline(versuch, params);
  } catch (err) {
    if (ollamaVersucht || !OL.bereit() || (err?.status && !istAusfall(err)) || err?.ersatzNichtMoeglich) throw err;
    console.error("Claude/OpenRouter fallen aus, Ollama springt ein:", String(err?.message || err).slice(0, 160));
    OL.eingesprungen(ersatzGrund(err));
    try { return await ollamaLive(params); } catch (olFehler) {
      console.error("Ollama:", olFehler.message);
      throw err;
    }
  }
}

// Kette (v1.178.0): Claude → eingeschaltete Schwarm-Dienste (ChatGPT, Gemini, DeepSeek, Grok, in Kevins Reihenfolge)
// → OpenRouter. Jede Stufe wird live gemeldet (Gehirn-Cockpit). Stufen mit Pause oder erreichtem Tageslimit fallen weg.
async function mitErsatzOnline(versuch, params) {
  const ueberspringen = onlineErsatzDa() ? claudeUeberspringen() : "";
  let claudeFehler = null;
  let grund = ueberspringen;
  if (!ueberspringen) {
    const ende = SW.beginne("claude", params?.model || config.model, "chat");
    try {
      const c = claudeClient();
      if (!c) throw Object.assign(new Error("Kein Claude-Schlüssel (ANTHROPIC_API_KEY fehlt)."), { status: 401 });
      const r = await versuch(c);
      leerSeit = 0;
      limitSeit = 0;
      ende(true);
      return r;
    } catch (err) {
      ende(false, err?.message || err);
      if (isCreditError(err)) { markEmpty(); leerSeit = Date.now(); }
      if (Number(err?.status) === 429 || Number(err?.status) === 529) limitSeit = Date.now();
      if (!onlineErsatzDa() || !istAusfall(err) || err?.ersatzNichtMoeglich) throw err;
      console.error("Claude fällt aus, Ersatz springt ein:", String(err?.message || err).slice(0, 160));
      claudeFehler = err;
      grund = ersatzGrund(err);
    }
  }
  const fehler = [];
  for (const id of SW.kette()) {
    try {
      const r = await SW.erstelle(id, params, { quelle: "ersatz" });
      schwarmEingesprungen(id, grund);
      return r;
    } catch (err) {
      fehler.push(err.message);
      console.error(`Schwarm-Ersatz ${id}:`, String(err.message).slice(0, 160));
      if (err?.status === 400) break; // Anfrage passt nicht – würde bei den anderen auch scheitern
    }
  }
  if (OR.ersatzBereit()) {
    OR.eingesprungen(grund);
    const ende = SW.beginne("openrouter", OR.modellFuer(params?.model), "ersatz");
    try {
      const r = await OR.erstelle(params);
      ende(true);
      return r;
    } catch (orFehler) {
      ende(false, orFehler.message);
      console.error("Ersatz-Gehirn:", orFehler.message);
      fehler.push(orFehler.message);
    }
  }
  // Den ursprünglichen Claude-Fehler weitergeben (z. B. "credit balance"), damit Friday ehrlich sagt, was los ist.
  if (claudeFehler) { try { claudeFehler.message = `${claudeFehler.message} | Ersatz: ${fehler.join(" | ")}`; } catch { /* nur lesbar */ } throw claudeFehler; }
  throw new Error(fehler.join(" | ") || "Kein Gehirn erreichbar.");
}

async function ollamaLive(params) {
  const ende = SW.beginne("ollama", OL.einstellungen().modell, "chat");
  try {
    const r = await OL.erstelle(params);
    ende(true);
    return r;
  } catch (err) {
    ende(false, err.message);
    throw err;
  }
}

let schwarmGeloggt = 0;
function schwarmEingesprungen(id, grund) {
  if (Date.now() - schwarmGeloggt < 10 * 60 * 1000) return;
  schwarmGeloggt = Date.now();
  try { logbuchEintrag({ bereich: "system", titel: `${SW.ANBIETER[id].name} ist für Claude eingesprungen`, details: String(grund || "").slice(0, 300), quelle: "schwarm" }); } catch { /* egal */ }
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
        if (/^(openrouter|ollama|openai|gemini|deepseek|grok)\//.test(String(msg.model || ""))) {
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
export const denkenMoeglich = () => OL.bereit() || onlineErsatzDa() || (Boolean(config.anthropicKey) && getEnergie().zustand !== "tot");
export const ersatzBereit = () => onlineErsatzDa() || OL.bereit();
/** Gibt es ein kostenloses Gehirn (Ollama), das auch bei erreichtem Kosten-Deckel denken darf? */
export const kostenlosBereit = () => OL.bereit();

// ---------- v1.178.0: ein bestimmtes Gehirn direkt fragen (Schwarm-Frage, Performance-Labor, Funktionstest) ----------
export const GEHIRNE = ["claude", ...SW.IDS, "openrouter", "ollama"];
export const GEHIRN_NAMEN = { claude: "Claude (Anthropic)", openrouter: "OpenRouter", ollama: "Ollama (lokal)", ...Object.fromEntries(SW.IDS.map((id) => [id, SW.ANBIETER[id].name])) };

/** Ist dieses Gehirn gerade benutzbar? "" = ja, sonst der Grund. */
export function gehirnGrund(id) {
  if (id === "claude") {
    if (!config.anthropicKey) return "kein Schlüssel";
    if (getEnergie().zustand === "tot") return "Guthaben leer";
    if (nurKostenlos()) return "Kosten-Deckel erreicht";
    if (limitSeit && Date.now() - limitSeit < LIMIT_PAUSE_MS) return "Nutzungslimit (kurze Pause)";
    return "";
  }
  if (id === "openrouter") return !OR.eingerichtet() ? "kein Schlüssel" : !OR.ersatzBereit() ? "nicht freigegeben" : nurKostenlos() ? "Kosten-Deckel erreicht" : "";
  if (id === "ollama") return OL.bereit() ? "" : "nicht eingerichtet (Modus aus)";
  if (SW.ANBIETER[id]) return SW.sperrGrund(id);
  return "unbekannt";
}
export const bereiteGehirne = () => GEHIRNE.filter((id) => !gehirnGrund(id));

/** Eine Anfrage (Anthropic-Format, ohne Werkzeuge) an genau ein Gehirn – ohne Ersatz-Kette. */
export async function fragen(id, params, { quelle = "labor" } = {}) {
  const grund = gehirnGrund(id);
  if (grund) throw new Error(`${GEHIRN_NAMEN[id] || id}: ${grund}`);
  if (SW.ANBIETER[id]) return SW.erstelle(id, params, { quelle, timeout: 90000 });
  if (id === "ollama") return ollamaLive(params);
  if (id === "openrouter") {
    const ende = SW.beginne("openrouter", OR.modellFuer(params?.model), quelle);
    try { const r = await OR.erstelle(params, { timeout: 90000 }); ende(true); return r; } catch (err) { ende(false, err.message); throw err; }
  }
  const ende = SW.beginne("claude", params.model || "claude-haiku-5-5", quelle);
  try {
    const r = await claudeClient().messages.create({ model: "claude-haiku-5-5", ...params });
    recordUsage(r.model, r.usage, quelle);
    ende(true);
    return r;
  } catch (err) {
    ende(false, err.message);
    if (isCreditError(err)) markEmpty();
    throw err;
  }
}
