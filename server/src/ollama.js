// Ollama als Gehirn (v1.160.0 lokal, v1.161.0 vollwertig: lokal ODER Ollama Cloud, Spar-Modus).
//
// Zwei Wege:
//   · lokal  – Ollama-App auf dem Mac (ollama.com), kostenlos, ohne Internet, aber langsamer und einfacher.
//   · cloud  – Ollama Cloud (https://ollama.com) mit eigenem API-Schlüssel: große Modelle, schnell,
//              Werkzeuge klappen gut. Der Schlüssel wird nur im Dashboard eingetragen, liegt in data/ollama.json
//              und wird nie ans Dashboard zurückgeschickt.
//
// Vier Modi (data/ollama.json → modus):
//   · aus     – Friday benutzt Ollama nie.
//   · notfall – nur wenn Claude UND OpenRouter nicht können (Guthaben leer, kein Internet).
//   · sparen  – Ollama zuerst (spart Claude-Guthaben). Klappt es nicht, übernimmt Claude bzw. OpenRouter.
//   · immer   – nur Ollama ("Friday, denk lokal").
//
// Technik: native Ollama-Schnittstelle /api/chat (lokal und Cloud gleich). Nur dort lässt sich die
// Kontext-Größe (num_ctx) setzen – Fridays Werkzeug-Liste ist groß, mit dem Ollama-Standard (4096) würde
// sie abgeschnitten. Friday spricht intern das Anthropic-Format; die Übersetzung steht unten.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { zuOpenAI } from "./openrouter.js";

const DATEI = "ollama";
export const CLOUD_URL = String(process.env.OLLAMA_CLOUD_URL || "https://ollama.com").replace(/\/+$/, "");
export const MODI = ["aus", "notfall", "sparen", "immer"];

// Empfehlungen (Stand November 2026). Lokal: passend für ein MacBook Air (Apple-Chip, 8–16 GB RAM).
export const EMPFOHLEN = {
  lokal: [
    { name: "qwen3.5:4b", groesse: "ca. 3 GB", text: "Empfehlung fürs MacBook Air: gutes Deutsch, kann Werkzeuge und Bilder, läuft schon mit 8 GB RAM" },
    { name: "qwen3.5:9b", groesse: "ca. 6 GB", text: "klüger, braucht 16 GB RAM, etwa halb so schnell" },
    { name: "gemma4:e4b", groesse: "ca. 4 GB", text: "Alternative von Google, sehr gutes Deutsch, Werkzeuge + Bilder" },
    { name: "llama3.2:3b", groesse: "2 GB", text: "alt: schnell, aber schwaches Deutsch und unsichere Werkzeug-Aufrufe" },
  ],
  cloud: [
    { name: "gpt-oss:120b", groesse: "Cloud", text: "Empfehlung: schnell, zuverlässige Werkzeug-Aufrufe, gutes Deutsch" },
    { name: "deepseek-v4-flash", groesse: "Cloud", text: "sehr schnell und sparsam, gut für Alltagsfragen" },
    { name: "glm-5.2", groesse: "Cloud", text: "eines der klügsten offenen Modelle, etwas langsamer" },
    { name: "kimi-k2.6", groesse: "Cloud", text: "stark bei langen Aufgaben, sieht auch Bilder" },
  ],
};
const STANDARD = { lokal: "qwen3.5:4b", cloud: "gpt-oss:120b" };

const roh = () => store.load(DATEI, {}) || {};

/** Alte Einstellungen (v1.160.0: an/immer) in den neuen Modus übersetzen. */
function modusVon(d) {
  if (MODI.includes(d.modus)) return d.modus;
  if (d.immer) return "immer";
  if (d.an) return "notfall";
  return "aus";
}

const schluessel = () => String(roh().key || process.env.OLLAMA_API_KEY || "").trim();

/** Die gültigen Einstellungen (ohne Schlüssel). */
export function einstellungen() {
  const d = roh();
  const art = d.art === "cloud" ? "cloud" : "lokal";
  const modelle = { lokal: d.modellLokal || (art === "lokal" && d.modell) || STANDARD.lokal, cloud: d.modellCloud || STANDARD.cloud };
  const modus = modusVon(d);
  return {
    modus,
    an: modus !== "aus",
    immer: modus === "immer",
    art,
    url: art === "cloud" ? CLOUD_URL : (d.url || process.env.OLLAMA_URL || "http://127.0.0.1:11434"),
    lokalUrl: d.url || process.env.OLLAMA_URL || "http://127.0.0.1:11434",
    modell: modelle[art],
    modellLokal: modelle.lokal,
    modellCloud: modelle.cloud,
    kontext: Math.max(8192, Math.min(131072, Number(d.kontext) || 24576)),
    schluesselDa: Boolean(schluessel()),
  };
}

const LOKAL_URL = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\]|[\w.-]+\.local|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|100\.\d+\.\d+\.\d+)(:\d+)?$/;

export function einstellen(e = {}) {
  const alt = roh();
  const jetzt = einstellungen();
  const neu = { ...alt };
  // Alte Schalter (v1.160.0) weiter verstehen
  let modus = e.modus;
  if (!modus && (e.an !== undefined || e.immer !== undefined)) modus = (e.immer ?? jetzt.immer) ? "immer" : (e.an ?? jetzt.an) ? (jetzt.modus === "sparen" ? "sparen" : "notfall") : "aus";
  if (modus !== undefined) {
    if (!MODI.includes(modus)) throw new Error("Unbekannter Modus.");
    neu.modus = modus;
  }
  if (e.art !== undefined) neu.art = e.art === "cloud" ? "cloud" : "lokal";
  if (e.url !== undefined) {
    const u = String(e.url).trim().replace(/\/+$/, "");
    if (u) {
      if (!LOKAL_URL.test(u)) throw new Error("Die lokale Adresse muss im eigenen Netz liegen (z. B. http://127.0.0.1:11434). Für Ollama Cloud „Cloud“ wählen.");
      neu.url = u;
    }
  }
  const modellText = (m) => String(m).trim().slice(0, 80);
  if (e.modellLokal) neu.modellLokal = modellText(e.modellLokal);
  if (e.modellCloud) neu.modellCloud = modellText(e.modellCloud);
  if (e.modell) { if ((neu.art || jetzt.art) === "cloud") neu.modellCloud = modellText(e.modell); else neu.modellLokal = modellText(e.modell); }
  if (e.kontext !== undefined) neu.kontext = Math.max(8192, Math.min(131072, Number(e.kontext) || 24576));
  if (e.key !== undefined) {
    const k = String(e.key).trim();
    if (k === "-") delete neu.key; // Schlüssel löschen
    else if (k) {
      if (k.length < 20 || /\s/.test(k)) throw new Error("Das sieht nicht wie ein Ollama-Schlüssel aus. Kopier ihn auf ollama.com → Settings → Keys noch einmal.");
      neu.key = k;
    }
  }
  delete neu.an; delete neu.immer; delete neu.modell;
  if ((neu.art === "cloud") && !(neu.key || process.env.OLLAMA_API_KEY) && neu.modus && neu.modus !== "aus") {
    throw new Error("Für Ollama Cloud fehlt noch der Schlüssel (ollama.com → Settings → Keys).");
  }
  store.save(DATEI, neu);
  return einstellungen();
}

/** Darf Friday Ollama überhaupt benutzen (Notfall, Sparen oder Immer)? */
export const bereit = () => einstellungen().modus !== "aus" && (einstellungen().art === "lokal" || Boolean(schluessel()));
/** Nur Ollama ("denk lokal")? */
export const immer = () => bereit() && einstellungen().modus === "immer";
/** Ollama zuerst, Claude als Rückfall? */
export const sparen = () => bereit() && einstellungen().modus === "sparen";

/**
 * Passt diese Anfrage zu Ollama im Spar-Modus? PDFs/Dokumente und erzwungene Werkzeug-Wahl
 * bleiben bei Claude, weil Ollama sie nicht zuverlässig kann.
 */
export function passtZu(params = {}) {
  if (params?.tool_choice?.type === "tool" || params?.tool_choice?.type === "any") return false;
  for (const m of params.messages || []) {
    if (Array.isArray(m.content) && m.content.some((b) => b?.type === "document")) return false;
  }
  return true;
}

function kopf() {
  const h = { "Content-Type": "application/json" };
  if (einstellungen().art === "cloud") h.Authorization = `Bearer ${schluessel()}`;
  return h;
}

/** Läuft Ollama und welche Modelle gibt es? */
export async function status() {
  const e = einstellungen();
  const basis = { ...e, stats: roh().stats || null, empfohlen: EMPFOHLEN[e.art], empfohlenAlle: EMPFOHLEN };
  if (e.art === "cloud" && !e.schluesselDa) return { ...basis, laeuft: false, hinweis: "Noch kein Schlüssel eingetragen.", modelle: [], modellDa: false };
  try {
    const r = await fetch(`${e.url}/api/tags`, { headers: kopf(), signal: AbortSignal.timeout(e.art === "cloud" ? 8000 : 2500) });
    if (r.status === 401 || r.status === 403) return { ...basis, laeuft: false, hinweis: "Ollama Cloud lehnt den Schlüssel ab.", modelle: [], modellDa: false };
    const d = await r.json();
    const modelle = (d.models || []).map((m) => ({ name: m.name || m.model, groesse: m.size ? `${(m.size / 1e9).toFixed(1)} GB` : "" }));
    const da = (n) => modelle.some((m) => m.name === n || m.name === `${n}:latest` || `${m.name}:latest` === n);
    return { ...basis, laeuft: true, modelle, modellDa: da(e.modell) };
  } catch {
    return { ...basis, laeuft: false, hinweis: e.art === "cloud" ? "ollama.com ist gerade nicht erreichbar." : "Die Ollama-App läuft nicht.", modelle: [], modellDa: false };
  }
}

function statsDazu(x) {
  const d = roh();
  d.stats = { anzahl: 0, ...(d.stats || {}), ...x };
  store.save(DATEI, d);
}

// ---------- Übersetzen: Anthropic → Ollama (/api/chat) ----------
// Erst ins OpenAI-Format (gemeinsamer Code mit OpenRouter), dann die kleinen Ollama-Unterschiede:
// Bilder als base64-Liste, Werkzeug-Argumente als Objekt, Werkzeug-Ergebnisse mit tool_name.
export function zuOllama(params, modell, { kontext, cloud } = {}) {
  const oa = zuOpenAI({ ...params, model: modell });
  const namen = {};
  const messages = [];
  for (const m of oa.messages) {
    if (m.role === "assistant") {
      const calls = (m.tool_calls || []).map((c) => {
        namen[c.id] = c.function.name;
        let args = {};
        try { args = JSON.parse(c.function.arguments || "{}"); } catch { args = {}; }
        return { function: { name: c.function.name, arguments: args } };
      });
      messages.push({ role: "assistant", content: m.content || "", ...(calls.length ? { tool_calls: calls } : {}) });
    } else if (m.role === "tool") {
      messages.push({ role: "tool", content: m.content, ...(namen[m.tool_call_id] ? { tool_name: namen[m.tool_call_id] } : {}) });
    } else if (Array.isArray(m.content)) {
      const text = m.content.filter((t) => t.type === "text").map((t) => t.text).join("\n");
      const images = m.content.filter((t) => t.type === "image_url" && /^data:/.test(t.image_url?.url || "")).map((t) => t.image_url.url.replace(/^data:[^,]*,/, ""));
      messages.push({ role: m.role, content: text || (images.length ? "Was siehst du?" : ""), ...(images.length ? { images } : {}) });
    } else {
      messages.push({ role: m.role, content: String(m.content ?? "") });
    }
  }
  const body = { model: modell, messages, stream: false, keep_alive: "30m", options: { num_predict: Math.min(Number(params.max_tokens) || 2000, 8000) } };
  if (!cloud) body.options.num_ctx = kontext || 24576;
  if (typeof params.temperature === "number") body.options.temperature = params.temperature;
  if (oa.tools?.length) body.tools = oa.tools;
  // Schnell antworten: langes "Nachdenken" aus (gpt-oss kennt nur low/medium/high).
  body.think = /gpt-oss/i.test(modell) ? "low" : false;
  return body;
}

// ---------- Übersetzen: Ollama → Anthropic ----------
let zaehler = 0;
export function zuAnthropicVonOllama(d = {}, modell = "") {
  const msg = d.message || {};
  const content = [];
  const text = String(msg.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (text) content.push({ type: "text", text });
  for (const c of msg.tool_calls || []) {
    let input = c.function?.arguments;
    if (typeof input === "string") { try { input = JSON.parse(input); } catch { input = {}; } }
    if (!input || typeof input !== "object" || Array.isArray(input)) input = {};
    content.push({ type: "tool_use", id: c.id || `ol_${Date.now().toString(36)}_${zaehler++}`, name: c.function?.name || "", input });
  }
  const hatTool = content.some((b) => b.type === "tool_use");
  return {
    id: `ol_${Date.now().toString(36)}_${zaehler++}`,
    type: "message",
    role: "assistant",
    model: `ollama/${d.model || modell}`,
    content,
    stop_reason: hatTool ? "tool_use" : d.done_reason === "length" ? "max_tokens" : "end_turn",
    stop_sequence: null,
    usage: { input_tokens: d.prompt_eval_count || 0, output_tokens: d.eval_count || 0 },
  };
}

function fehlerText(e, status, meldung) {
  const m = String(meldung || "").slice(0, 200);
  if (e.art === "cloud") {
    if (status === 401 || status === 403) return "Ollama Cloud lehnt den Schlüssel ab. Erstell auf ollama.com → Settings → Keys einen neuen und trag ihn im Dashboard ein.";
    if (status === 429) return "Ollama Cloud: Nutzungsgrenze erreicht (zu viele Anfragen oder Kontingent aufgebraucht). Später nochmal oder Abo prüfen auf ollama.com/settings/usage.";
    if (status === 404 || /not found/i.test(m)) return `Ollama Cloud kennt das Modell ${e.modell} nicht. Wähl ein anderes.`;
    return `Ollama Cloud meldet Fehler ${status}${m ? `: ${m}` : ""}.`;
  }
  if (status === 404 || /not found|pull/i.test(m)) return `Das Modell ${e.modell} ist nicht geladen. Im Terminal: ollama pull ${e.modell}`;
  return `Ollama meldet Fehler ${status}${m ? `: ${m}` : ""}.`;
}

/** Eine Anfrage im Anthropic-Format mit Ollama beantworten. Wirft bei Fehlern. */
export async function erstelle(params, { timeout } = {}) {
  const e = einstellungen();
  const cloud = e.art === "cloud";
  if (cloud && !schluessel()) throw Object.assign(new Error("Für Ollama Cloud ist kein Schlüssel eingetragen."), { status: 401 });
  let body = zuOllama(params, e.modell, { kontext: e.kontext, cloud });
  const senden = async (b) => {
    let r;
    try {
      r = await fetch(`${e.url}/api/chat`, { method: "POST", headers: kopf(), body: JSON.stringify(b), signal: AbortSignal.timeout(timeout || (cloud ? 120000 : 240000)) });
    } catch (err) {
      throw Object.assign(new Error(cloud ? `Ollama Cloud ist nicht erreichbar (${err.name === "TimeoutError" ? "Zeitüberschreitung" : err.message}).` : `Ollama läuft nicht auf dem Mac (${e.url}). Starte die Ollama-App.`), { netz: true });
    }
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw Object.assign(new Error(fehlerText(e, r.status, d.error?.message || d.error)), { status: r.status, roh: String(d.error?.message || d.error || "") });
    return d;
  };
  let d;
  try {
    try {
      d = await senden(body);
    } catch (err) {
      // Manche Modelle kennen den Denk-Schalter nicht → ohne ihn nochmal
      if (err.status === 400 && /think/i.test(err.roh || "")) { delete body.think; d = await senden(body); } else throw err;
    }
  } catch (err) {
    if (err.netz || err.status === 401 || err.status === 403 || err.status === 429 || err.status === 404 || /not found/i.test(err.roh || "")) {
      statsDazu({ letzter_fehler: err.message, fehler_am: new Date().toISOString() });
      throw err;
    }
    // Modell kann keine Werkzeuge oder Bilder: einfacher nochmal (nur Text).
    if (!/tools|image|vision/i.test(err.roh || "") && err.status !== 400) throw err;
    const { tools, ...rest } = body;
    body = { ...rest, messages: rest.messages.map(({ images, ...m }) => m) };
    d = await senden(body);
  }
  const antwort = zuAnthropicVonOllama(d, e.modell);
  if (!antwort.content.length) throw Object.assign(new Error("Ollama hat eine leere Antwort geliefert."), { status: 502 });
  const s = roh().stats || {};
  statsDazu({ anzahl: (s.anzahl || 0) + 1, zuletzt: new Date().toISOString(), letzter_fehler: "", art: e.art });
  return antwort;
}

let zuletztGeloggt = 0;
export function eingesprungen(grund = "") {
  if (Date.now() - zuletztGeloggt < 10 * 60 * 1000) return;
  zuletztGeloggt = Date.now();
  const e = einstellungen();
  logbuch.eintragen({ bereich: "system", titel: `Ollama denkt (${e.art === "cloud" ? "Cloud" : "auf dem Mac"}, ${e.modell})`, details: grund });
}

export function quickCommand(text) {
  const k = String(text || "").toLowerCase().replace(/^(hey |ok )?(friday|freitag)[ ,.!]*/, "").trim().replace(/[.!?]+$/, "");
  const sag = (answer) => ({ answer, actions: ["wunsch:ollama"] });
  if (/^(denk|denke) (jetzt )?(lokal|offline|auf dem mac|mit ollama)$/.test(k)) {
    try { einstellen({ modus: "immer", ...(/lokal|offline|mac/.test(k) ? { art: "lokal" } : {}) }); } catch (err) { return { answer: err.message, actions: [] }; }
    const e = einstellungen();
    return sag(`Okay, ich denke jetzt nur noch mit Ollama (${e.art === "cloud" ? "Cloud" : "auf dem Mac"}, ${e.modell}). Zurück mit: Friday, denk wieder normal.`);
  }
  if (/^(denk|denke) (jetzt )?(sparsam|günstig|guenstig)$|^(spar|sparen) (guthaben|geld)$|^(spar-?modus|sparmodus) (an|ein)$/.test(k)) {
    try { einstellen({ modus: "sparen" }); } catch (err) { return { answer: err.message, actions: [] }; }
    return sag(`Okay, Spar-Modus an: Ich frage zuerst Ollama (${einstellungen().modell}). Nur wenn das nicht klappt, nehme ich Claude.`);
  }
  if (/^(denk|denke) (wieder )?(normal|mit claude|online)$/.test(k)) {
    if (einstellungen().modus === "immer" || einstellungen().modus === "sparen") einstellen({ modus: "notfall" });
    return { answer: "Okay, ich denke wieder mit Claude. Ollama springt nur noch ein, wenn Claude nicht kann.", actions: [] };
  }
  return null;
}
