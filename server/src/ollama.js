// Lokales KI-Gehirn mit Ollama (v1.160.0, Wunsch aus der Ideen-Schmiede).
// Ein kleines KI-Modell läuft direkt auf dem Mac (ollama.com, kostenlos, ca. 2–5 GB). Friday nimmt es,
// wenn Claude UND das Ersatz-Gehirn (OpenRouter) nicht können – Guthaben leer, kein Internet – oder immer,
// wenn du sagst "Friday, denk lokal" (zurück mit "Friday, denk wieder normal").
// Technik: Ollama spricht das OpenAI-Format (/v1/chat/completions); die Übersetzung von/zu Fridays
// Anthropic-Format kommt aus openrouter.js. Einstellungen in data/ollama.json.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { zuOpenAI, zuAnthropic } from "./openrouter.js";

const DATEI = "ollama";
export const EMPFOHLEN = [
  { name: "llama3.2:3b", groesse: "2 GB", text: "schnell, gut für einfache Fragen (Standard)" },
  { name: "qwen2.5:7b", groesse: "4,7 GB", text: "klüger, kann Werkzeuge, braucht 16 GB RAM" },
  { name: "gemma3:4b", groesse: "3,3 GB", text: "gutes Deutsch, sieht auch Bilder" },
];
export const einstellungen = () => ({ an: false, immer: false, url: process.env.OLLAMA_URL || "http://127.0.0.1:11434", modell: "llama3.2:3b", ...store.load(DATEI, {}) });
export function einstellen(e = {}) {
  const alt = einstellungen();
  const neu = {
    an: e.an ?? alt.an,
    immer: e.immer ?? alt.immer,
    url: e.url !== undefined ? String(e.url).trim().replace(/\/+$/, "") || alt.url : alt.url,
    modell: e.modell ? String(e.modell).trim().slice(0, 80) : alt.modell,
  };
  if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\]|[\w.-]+\.local|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(neu.url)) throw new Error("Ollama muss im eigenen Netz laufen (z. B. http://127.0.0.1:11434).");
  if (neu.immer) neu.an = true;
  store.save(DATEI, { ...store.load(DATEI, {}), ...neu });
  return neu;
}
/** Darf Friday lokal denken? */
export const bereit = () => einstellungen().an === true;
/** Immer lokal ("denk lokal")? */
export const immer = () => bereit() && einstellungen().immer === true;

/** Läuft Ollama und welche Modelle sind geladen? */
export async function status() {
  const e = einstellungen();
  try {
    const r = await fetch(`${e.url}/api/tags`, { signal: AbortSignal.timeout(2500) });
    const d = await r.json();
    const modelle = (d.models || []).map((m) => ({ name: m.name, groesse: m.size ? `${(m.size / 1e9).toFixed(1)} GB` : "" }));
    return { ...e, laeuft: true, modelle, modellDa: modelle.some((m) => m.name === e.modell || m.name === `${e.modell}:latest`), stats: store.load(DATEI, {}).stats || null, empfohlen: EMPFOHLEN };
  } catch {
    return { ...e, laeuft: false, modelle: [], modellDa: false, stats: store.load(DATEI, {}).stats || null, empfohlen: EMPFOHLEN };
  }
}

function statsDazu(x) {
  const d = store.load(DATEI, {});
  d.stats = { anzahl: 0, ...(d.stats || {}), ...x };
  store.save(DATEI, d);
}

/** Eine Anfrage im Anthropic-Format lokal beantworten. Wirft bei Fehlern. */
export async function erstelle(params) {
  const e = einstellungen();
  const body = zuOpenAI({ ...params, model: e.modell });
  body.max_tokens = Math.min(body.max_tokens || 2000, 4000);
  // Bilder kann nicht jedes kleine Modell: dann nur Text schicken.
  const ohneBilder = (b) => ({ ...b, messages: b.messages.map((m) => Array.isArray(m.content) ? { ...m, content: m.content.filter((t) => t.type === "text").map((t) => t.text).join("\n") || "(Bild)" } : m) });
  const senden = async (b) => {
    const r = await fetch(`${e.url}/v1/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...b, stream: false }), signal: AbortSignal.timeout(180000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw Object.assign(new Error(`Ollama: ${d.error?.message || d.error || `Fehler ${r.status}`}`), { status: r.status });
    return d;
  };
  let d;
  try {
    d = await senden(body);
  } catch (err) {
    if (err.status === 0 || !err.status) throw new Error(`Ollama läuft nicht auf dem Mac (${e.url}). Starte die Ollama-App.`);
    if (/not found|pull/i.test(err.message)) throw new Error(`Das Modell ${e.modell} ist nicht geladen. Im Terminal: ollama pull ${e.modell}`);
    // Kleines Modell kann keine Werkzeuge/Bilder → einfacher nochmal
    const { tools, tool_choice, ...rest } = body;
    d = await senden(ohneBilder(rest));
  }
  const antwort = zuAnthropic(d, e.modell);
  antwort.model = `ollama/${e.modell}`;
  const s = store.load(DATEI, {}).stats || {};
  statsDazu({ anzahl: (s.anzahl || 0) + 1, zuletzt: new Date().toISOString(), letzter_fehler: "" });
  return antwort;
}

let zuletztGeloggt = 0;
export function eingesprungen(grund = "") {
  if (Date.now() - zuletztGeloggt < 10 * 60 * 1000) return;
  zuletztGeloggt = Date.now();
  logbuch.eintragen({ bereich: "system", titel: "Lokales KI-Gehirn (Ollama) denkt", details: grund });
}

export function quickCommand(text) {
  const k = String(text || "").toLowerCase().replace(/^(hey |ok )?(friday|freitag)[ ,.!]*/, "").trim().replace(/[.!?]+$/, "");
  if (/^(denk|denke) (jetzt )?(lokal|offline|auf dem mac|mit ollama)$/.test(k)) {
    try { einstellen({ an: true, immer: true }); } catch (err) { return { answer: err.message, actions: [] }; }
    return { answer: `Okay, ich denke jetzt lokal auf dem Mac mit ${einstellungen().modell}. Das ist kostenlos, aber einfacher. Zurück mit: Friday, denk wieder normal.`, actions: ["wunsch:ollama"] };
  }
  if (/^(denk|denke) (wieder )?(normal|mit claude|online)$/.test(k)) {
    if (bereit()) einstellen({ immer: false });
    return { answer: "Okay, ich denke wieder mit Claude. Das lokale Gehirn springt nur noch ein, wenn Claude nicht kann.", actions: [] };
  }
  return null;
}
