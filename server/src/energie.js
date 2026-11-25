// Fridays Energie: rechnet mit, was jede Claude-Anfrage kostet, und zieht es vom Guthaben ab.
// Wird es knapp, spart Friday (günstigeres Modell, kürzer). Ist es leer, laufen nur die kostenlosen Teile.
// Einnahmen trägt der Nutzer selbst ein: Geld bewegt Friday nie.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config.js";
import { buche as deckelBuchen, sparen as deckelSparen } from "./kostendeckel.js";

const FILE = path.join(DATA_DIR, "energie.json");
// US-Dollar je 1 Mio. Tokens (Eingabe, Ausgabe, Cache schreiben, Cache lesen). Schätzwerte für die Anzeige.
const PREISE = {
  "claude-opus-5-5": [4, 20, 5, 0.2],
  "claude-sonnet-5-5": [2, 10, 2.5, 0.1],
  "claude-haiku-5-5": [0.1, 0.5, 0.125, 0.01],
  "claude-opus-5": [5, 25, 6.25, 0.5],
  "claude-opus-4-8": [5, 25, 6.25, 0.5],
};
const WEBSUCHE_USD = 0.01; // je Suche
export const SPAR_MODELL = "claude-haiku-5-5";
const SPAR_GRENZE_USD = 2;
const SPAR_GRENZE_PROZENT = 20;

function load() {
  try {
    return { guthaben: null, verbrauch: 0, verbrauch_gesamt: 0, einnahmen: [], leer: false, kosten: [], ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return { guthaben: null, verbrauch: 0, verbrauch_gesamt: 0, einnahmen: [], leer: false, kosten: [] };
  }
}
function save(d) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}

export function costOf(model, usage = {}) {
  const key = Object.keys(PREISE).find((k) => String(model || "").startsWith(k)) || "claude-opus-5-5";
  const [pin, pout, pcw, pcr] = PREISE[key];
  const usd = ((usage.input_tokens || 0) * pin + (usage.output_tokens || 0) * pout
    + (usage.cache_creation_input_tokens || 0) * pcw + (usage.cache_read_input_tokens || 0) * pcr) / 1e6
    + (usage.server_tool_use?.web_search_requests || 0) * WEBSUCHE_USD;
  return Math.max(0, usd);
}

// Nach jeder erfolgreichen Anfrage aufrufen.
export function recordUsage(model, usage, quelle = "chat") {
  // Ollama (v1.161.0): lokal kostenlos, Cloud per Abo – zählt nie gegen das Claude-Guthaben
  // und darf "Guthaben leer" nicht zurücksetzen.
  if (String(model || "").startsWith("ollama/")) {
    try {
      const d = load();
      d.kosten.push({ zeit: new Date().toISOString(), quelle: `${quelle} · Ollama`, modell: model, usd: 0 });
      if (d.kosten.length > 40) d.kosten.shift();
      save(d);
    } catch { /* Anzeige ist nicht lebenswichtig */ }
    return;
  }
  // Multi-KI-Schwarm (v1.178.0): ChatGPT, Gemini, DeepSeek, Grok. Kosten und Kosten-Deckel bucht ki-schwarm.js
  // schon beim Antworten (auch wenn recordUsage gar nicht aufgerufen wird) – hier nur fürs Energie-Fenster notieren.
  if (/^(openai|gemini|deepseek|grok)\//.test(String(model || ""))) {
    try {
      const d = load();
      d.kosten.push({ zeit: new Date().toISOString(), quelle: `${quelle} · ${String(model).split("/")[0]}`, modell: model, usd: Math.round((Number(usage?.cost_usd) || 0) * 10000) / 10000 });
      if (d.kosten.length > 40) d.kosten.shift();
      save(d);
    } catch { /* Anzeige ist nicht lebenswichtig */ }
    return;
  }
  // Ersatz-Gehirn (OpenRouter, v1.142.0): zählt nicht gegen das Claude-Guthaben und weckt es nicht auf,
  // läuft aber in den Kosten-Deckel (echtes Geld bei OpenRouter).
  if (String(model || "").startsWith("openrouter/")) {
    try {
      const usd = Number(usage?.cost_usd) || 0;
      const d = load();
      d.kosten.push({ zeit: new Date().toISOString(), quelle: `${quelle} · Ersatz`, modell: model, usd: Math.round(usd * 10000) / 10000 });
      if (d.kosten.length > 40) d.kosten.shift();
      save(d);
      deckelBuchen(usd, quelle);
    } catch { /* Anzeige ist nicht lebenswichtig */ }
    return;
  }
  try {
    const usd = costOf(model, usage);
    const d = load();
    d.verbrauch += usd;
    d.verbrauch_gesamt += usd;
    d.leer = false; // eine Antwort kam durch: Guthaben ist da
    d.kosten.push({ zeit: new Date().toISOString(), quelle, modell: model, usd: Math.round(usd * 10000) / 10000 });
    if (d.kosten.length > 40) d.kosten.shift();
    save(d);
    deckelBuchen(usd, quelle); // Kosten-Deckel pro Stunde/Tag (v1.135.0)
  } catch { /* Anzeige ist nicht lebenswichtig */ }
}

export function isCreditError(err) {
  return /credit balance/i.test(String(err?.message || err));
}
export function markEmpty() {
  const d = load();
  d.leer = true;
  save(d);
}

export function aufladen(betrag) {
  const b = Number(betrag);
  if (!Number.isFinite(b) || b <= 0 || b > 10000) return { ok: false, error: "Bitte einen Betrag in Dollar eingeben, z. B. 10." };
  const d = load();
  d.guthaben = Math.round(b * 100) / 100;
  d.verbrauch = 0;
  d.leer = false;
  d.aufgeladen_am = new Date().toISOString();
  save(d);
  return { ok: true, energie: getEnergie() };
}

export function einnahme(betrag, wofuer) {
  const b = Number(betrag);
  if (!Number.isFinite(b) || b <= 0 || b > 100000) return { ok: false, error: "Bitte einen Betrag eingeben." };
  const d = load();
  d.einnahmen.push({ zeit: new Date().toISOString(), betrag: Math.round(b * 100) / 100, wofuer: String(wofuer || "").slice(0, 120) });
  save(d);
  return { ok: true, energie: getEnergie() };
}

export function getEnergie() {
  const d = load();
  const rest = d.guthaben == null ? null : Math.max(0, d.guthaben - d.verbrauch);
  const prozent = d.guthaben ? Math.round((rest / d.guthaben) * 100) : null;
  const einnahmen = d.einnahmen.reduce((s, e) => s + e.betrag, 0);
  let zustand = "voll";
  if (d.leer || (rest != null && rest <= 0)) zustand = "tot";
  else if (rest != null && (rest < SPAR_GRENZE_USD || prozent < SPAR_GRENZE_PROZENT)) zustand = "spar";
  return {
    zustand, guthaben: d.guthaben, rest, prozent, verbrauch: d.verbrauch, verbrauch_gesamt: d.verbrauch_gesamt,
    einnahmen, bilanz: einnahmen - d.verbrauch_gesamt, aufgeladen_am: d.aufgeladen_am || null,
    letzte: d.kosten.slice(-8).reverse(), einnahmen_liste: d.einnahmen.slice(-10).reverse(),
  };
}

// Welches Modell das Gehirn gerade nehmen soll.
export function brainModel(standard) {
  // knapp oder leer: sparen. Kosten-Deckel fast erreicht (≥ 80 %): ebenfalls sparen.
  return getEnergie().zustand === "voll" && !deckelSparen() ? standard : SPAR_MODELL;
}
