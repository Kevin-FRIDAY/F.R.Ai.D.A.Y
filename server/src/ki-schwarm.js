// Multi-KI-Schwarm (v1.178.0, Mark XII Punkte 2, 21, 22, 28, 32).
//
// Friday kann außer Claude, OpenRouter und Ollama jetzt auch ChatGPT (OpenAI), Gemini (Google),
// DeepSeek und Grok (xAI) fragen – aber NUR mit Kevins eigenen Schlüsseln, und jeder Dienst hat ein
// eigenes Tageslimit in Dollar. Ohne Schlüssel bleibt ein Dienst einfach aus (kein Fehler, keine Kosten).
//
//  · Ersatz-Kette (Punkt 22): fällt Claude aus (Guthaben leer, Nutzungslimit 429, Störung, kein Netz),
//    probiert ki-client.js die eingeschalteten Schwarm-Dienste der Reihe nach, dann OpenRouter, dann Ollama.
//    Ein Dienst, der ein Nutzungslimit meldet, macht automatisch Pause (429: 10 Min., Guthaben leer: 6 Std.,
//    Schlüssel abgelehnt: bis ein neuer eingetragen ist) und wird solange übersprungen.
//  · Kostenkontrolle (Punkt 28): jede Antwort wird mit den Token-Preisen des Modells bewertet, auf das
//    Tageslimit des Dienstes UND auf Fridays gemeinsamen Kosten-Deckel gebucht. Limit erreicht → Dienst aus.
//  · Live-Anzeige (Punkt 32): welche KI gerade denkt, wie lange, wie oft, wie schnell, letzter Fehler.
//  · Schwarm-Frage (Punkt 2): dieselbe Frage an mehrere KIs, dann Übereinstimmung prüfen und zusammenführen.
//  · Performance-Labor (Punkt 21): feste Prüffragen mit nachprüfbaren Antworten, misst Tempo, Qualität, Kosten.
//
// Alle vier Dienste sprechen das OpenAI-Format (chat/completions). Die Übersetzung Anthropic ⇄ OpenAI
// kommt aus openrouter.js (keine zweite Kopie). Schlüssel liegen verschlüsselt im Tresor (tresor.js).
import fs from "node:fs";
import path from "node:path";
import { FRIDAY_DATA_DIR, DATA_DIR } from "./config.js";
import { zuOpenAI, zuAnthropic } from "./openrouter.js";
import { verschluessele, entschluessele } from "./tresor.js";
import { buche as deckelBuchen, stand as deckelStand } from "./kostendeckel.js";
import { eintragen } from "./logbuch.js";
import { sende } from "./ereignisbus.js";

// ---------- Die Dienste ----------
// modelle: Reihenfolge der Wunsch-Modelle (Muster), wenn Friday beim Einrichten die Modell-Liste des Dienstes liest.
export const ANBIETER = {
  openai: {
    name: "ChatGPT (OpenAI)", emoji: "🟢", url: "https://api.openai.com/v1", standard: "gpt-5-mini",
    modelle: [/^gpt-5(\.\d+)?-mini$/, /^gpt-5(\.\d+)?$/, /^gpt-4\.1-mini$/, /^gpt-4o-mini$/],
    seite: "https://platform.openai.com/api-keys", env: "OPENAI_API_KEY",
  },
  gemini: {
    name: "Gemini (Google)", emoji: "🔷", url: "https://generativelanguage.googleapis.com/v1beta/openai", standard: "gemini-2.5-flash",
    modelle: [/^gemini-[\d.]+-flash$/, /^gemini-[\d.]+-flash-lite$/, /^gemini-[\d.]+-pro$/],
    seite: "https://aistudio.google.com/apikey", env: "GEMINI_API_KEY",
  },
  deepseek: {
    name: "DeepSeek", emoji: "🐋", url: "https://api.deepseek.com", standard: "deepseek-chat",
    modelle: [/^deepseek-chat$/], seite: "https://platform.deepseek.com/api_keys", env: "DEEPSEEK_API_KEY", maxTokens: 8000,
  },
  grok: {
    name: "Grok (xAI)", emoji: "⚡", url: "https://api.x.ai/v1", standard: "grok-4-fast",
    modelle: [/^grok-[\d.]+-fast(-non-reasoning)?$/, /^grok-[\d.]+-fast/, /^grok-[\d.]+-mini$/, /^grok-[\d.]+$/],
    seite: "https://console.x.ai", env: "XAI_API_KEY",
  },
};
export const IDS = Object.keys(ANBIETER);

// US-Dollar je 1 Mio. Tokens [Eingabe, Ausgabe]. Schätzwerte (Stand Herbst 2026), im Cockpit änderbar.
// Unbekanntes Modell → bewusst teuer gerechnet, damit das Tageslimit eher zu früh als zu spät greift.
const PREISE = [
  [/gpt-5(\.\d+)?-nano/, [0.05, 0.4]], [/gpt-5(\.\d+)?-mini/, [0.25, 2]], [/gpt-4\.1-mini/, [0.4, 1.6]], [/gpt-4o-mini/, [0.15, 0.6]], [/^gpt-5/, [1.25, 10]],
  [/gemini.*flash-lite/, [0.1, 0.4]], [/gemini.*flash/, [0.3, 2.5]], [/gemini.*pro/, [1.25, 10]],
  [/deepseek/, [0.28, 0.42]],
  [/grok.*fast/, [0.2, 0.5]], [/grok.*mini/, [0.3, 0.5]], [/^grok/, [3, 15]],
];
const VORSICHTS_PREIS = [5, 20];
export function preisFuer(modell = "", eigen = null) {
  if (Array.isArray(eigen) && eigen.length === 2 && eigen.every((x) => Number.isFinite(Number(x)) && Number(x) >= 0)) return eigen.map(Number);
  return PREISE.find(([m]) => m.test(String(modell)))?.[1] || VORSICHTS_PREIS;
}
export const kostenVon = (modell, usage = {}, eigen = null) => {
  const [pin, pout] = preisFuer(modell, eigen);
  return Math.max(0, ((usage.input_tokens || 0) * pin + (usage.output_tokens || 0) * pout) / 1e6);
};

// ---------- Speicher ----------
const FILE = path.join(FRIDAY_DATA_DIR, "ki-schwarm.json"); // Schlüssel: gemeinsam für Friday und Eve
const STATS = path.join(DATA_DIR, "ki-schwarm-stats.json"); // Zähler: pro Prozess
const STANDARD_LIMIT = 0.5; // $ pro Tag und Dienst

function lade() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")) || {}; } catch { return {}; }
}
function speichere(d) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}
function stats() {
  try { const s = JSON.parse(fs.readFileSync(STATS, "utf8")); return { tage: {}, je: {}, pausen: {}, labor: [], ...s }; } catch { return { tage: {}, je: {}, pausen: {}, labor: [] }; }
}
function statsSpeichern(s) {
  try {
    s.tage = Object.fromEntries(Object.entries(s.tage).sort().slice(-35));
    s.labor = (s.labor || []).slice(-30);
    fs.mkdirSync(path.dirname(STATS), { recursive: true });
    fs.writeFileSync(STATS, JSON.stringify(s, null, 2));
  } catch { /* nur Anzeige */ }
}
const heute = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const r4 = (x) => Math.round(x * 10000) / 10000;

function eintrag(id) {
  const d = lade();
  const e = d.anbieter?.[id] || {};
  return { an: e.an !== false, ersatz: e.ersatz !== false, limit_tag: Number.isFinite(Number(e.limit_tag)) ? Number(e.limit_tag) : STANDARD_LIMIT, modell: e.modell || "", preis: e.preis || null, key: e.key || "" };
}
function schluessel(id) {
  const e = eintrag(id);
  return (entschluessele(e.key) || process.env[ANBIETER[id]?.env] || "").trim();
}
const basisUrl = (id) => String(process.env[`KI_SCHWARM_URL_${id.toUpperCase()}`] || ANBIETER[id].url).replace(/\/+$/, "");
export const modellVon = (id) => eintrag(id).modell || ANBIETER[id]?.standard || "";

export const eingerichtet = (id) => Boolean(ANBIETER[id] && schluessel(id));
export function heuteKosten(id) { return stats().tage[heute()]?.[id] || 0; }

/** Warum ist ein Dienst gerade nicht einsatzbereit? "" = bereit. */
export function sperrGrund(id) {
  if (!ANBIETER[id]) return "unbekannter Dienst";
  if (!eingerichtet(id)) return "kein Schlüssel";
  const e = eintrag(id);
  if (!e.an) return "ausgeschaltet";
  const p = stats().pausen[id];
  if (p && p.bis && new Date(p.bis).getTime() > Date.now()) return `Pause: ${p.grund}`;
  if (e.limit_tag > 0 && heuteKosten(id) >= e.limit_tag) return `Tageslimit ${e.limit_tag.toFixed(2)} $ erreicht`;
  if (deckelStand().stufe === "gesperrt") return "Kosten-Deckel erreicht";
  return "";
}
export const bereit = (id) => !sperrGrund(id);

/** Reihenfolge für die Ersatz-Kette (nur bereite Dienste mit "als Ersatz" an). */
export function kette() {
  const d = lade();
  const reihe = [...new Set([...(d.reihenfolge || []), ...IDS])].filter((id) => ANBIETER[id]);
  return reihe.filter((id) => eintrag(id).ersatz && bereit(id));
}

// ---------- Live: wer denkt gerade? ----------
const aktiv = new Map(); // nr -> { anbieter, modell, quelle, seit }
let nr = 0;
/** Für ki-client.js: Beginn einer KI-Anfrage melden. Gibt ende(ok, fehlerText?) zurück. */
export function beginne(anbieter, modell = "", quelle = "") {
  const n = ++nr;
  const seit = Date.now();
  aktiv.set(n, { anbieter, modell, quelle, seit });
  sende("ki", { art: "start", anbieter, modell, quelle });
  return (ok = true, fehler = "") => {
    aktiv.delete(n);
    const ms = Date.now() - seit;
    const s = stats();
    const j = s.je[anbieter] || { anfragen: 0, fehler: 0, ms_summe: 0 };
    j.anfragen++;
    if (!ok) { j.fehler++; j.letzter_fehler = String(fehler).slice(0, 200); j.fehler_am = new Date().toISOString(); }
    else j.ms_summe += ms;
    j.letzte = new Date().toISOString();
    j.letzte_ms = ms;
    j.modell = modell || j.modell;
    s.je[anbieter] = j;
    statsSpeichern(s);
    sende("ki", { art: ok ? "fertig" : "fehler", anbieter, modell, ms, ...(ok ? {} : { fehler: String(fehler).slice(0, 160) }) }, { wichtig: !ok });
  };
}
export function liveListe() {
  return [...aktiv.values()].map((a) => ({ ...a, laeuft_ms: Date.now() - a.seit, seit: new Date(a.seit).toISOString() }));
}

// ---------- Pausen bei Nutzungslimits ----------
function pause(id, grund, minuten) {
  const s = stats();
  s.pausen[id] = { bis: new Date(Date.now() + minuten * 60000).toISOString(), grund };
  statsSpeichern(s);
  eintragen({ bereich: "system", titel: `${ANBIETER[id]?.name || id} macht Pause: ${grund}`, details: `Friday nimmt solange den nächsten Dienst in der Kette (${minuten >= 60 ? `${Math.round(minuten / 60)} Std.` : `${minuten} Min.`}).`, ok: false });
}
function pauseAufheben(id) {
  const s = stats();
  if (s.pausen[id]) { delete s.pausen[id]; statsSpeichern(s); }
}

function fehlerAuswerten(id, status, roh, retryAfter) {
  const m = String(roh?.error?.message || roh?.message || (Array.isArray(roh) ? roh[0]?.error?.message : "") || "").slice(0, 200);
  const name = ANBIETER[id].name;
  if (status === 401 || status === 403) { pause(id, "Schlüssel abgelehnt", 24 * 60); return `${name} lehnt den Schlüssel ab. Trag im Gehirn-Cockpit unter KI-Modelle einen neuen ein.`; }
  if (status === 402 || /insufficient_quota|billing|credit|balance|quota/i.test(m) && status !== 429) { pause(id, "Guthaben leer", 6 * 60); return `Dein Guthaben bei ${name} ist leer.`; }
  if (status === 429) {
    const min = Math.min(120, Math.max(1, Math.ceil((Number(retryAfter) || 600) / 60)));
    pause(id, /quota/i.test(m) ? "Kontingent aufgebraucht" : "Nutzungslimit", /quota/i.test(m) ? 6 * 60 : min);
    return `${name} meldet ein Nutzungslimit (429).`;
  }
  if (status >= 500) { pause(id, `Störung ${status}`, 3); return `${name} hat gerade eine Störung (${status}).`; }
  return `${name} meldet Fehler ${status}${m ? `: ${m}` : ""}.`;
}

// ---------- Aufruf ----------
/** Anfrage im Anthropic-Format an einen Schwarm-Dienst. Wirft bei Fehlern (mit .status). */
export async function erstelle(id, params, { timeout = 180000, quelle = "chat", key = schluessel(id) } = {}) {
  const a = ANBIETER[id];
  if (!a) throw new Error(`Unbekannter KI-Dienst: ${id}`);
  if (!key) throw Object.assign(new Error(`Für ${a.name} ist kein Schlüssel eingetragen.`), { status: 401 });
  const e = eintrag(id);
  if (e.limit_tag > 0 && heuteKosten(id) >= e.limit_tag) throw Object.assign(new Error(`${a.name}: Tageslimit von ${e.limit_tag.toFixed(2)} $ erreicht.`), { status: 429, limit: true });
  const modell = modellVon(id);
  const body = zuOpenAI({ ...params, model: modell });
  if (a.maxTokens) body.max_tokens = Math.min(body.max_tokens, a.maxTokens);
  if (id === "openai") {
    // Neuere OpenAI-Modelle wollen max_completion_tokens und keine eigene Temperatur.
    body.max_completion_tokens = body.max_tokens;
    delete body.max_tokens;
    delete body.temperature;
  }
  const ende = beginne(id, modell, quelle);
  let r;
  try {
    r = await fetch(`${basisUrl(id)}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (err) {
    const msg = `${a.name} ist nicht erreichbar (${err.name === "TimeoutError" ? "Zeitüberschreitung" : err.message}).`;
    ende(false, msg);
    throw new Error(msg);
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) {
    const status = r.ok ? Number(data.error?.code) || 500 : r.status;
    const msg = fehlerAuswerten(id, status, data, r.headers.get("retry-after"));
    ende(false, msg);
    throw Object.assign(new Error(msg), { status });
  }
  const antwort = zuAnthropic(data, modell);
  antwort.model = `${id}/${String(data.model || modell).replace(/^models\//, "")}`;
  const usd = kostenVon(modell, antwort.usage, e.preis);
  antwort.usage.cost_usd = r4(usd);
  // Kosten buchen: Tageslimit des Dienstes + gemeinsamer Kosten-Deckel.
  const s = stats();
  const t = heute();
  s.tage[t] = { ...(s.tage[t] || {}), [id]: r4((s.tage[t]?.[id] || 0) + usd) };
  const j = s.je[id] || { anfragen: 0, fehler: 0, ms_summe: 0 };
  j.usd_gesamt = r4((j.usd_gesamt || 0) + usd);
  j.tokens_ein = (j.tokens_ein || 0) + (antwort.usage.input_tokens || 0);
  j.tokens_aus = (j.tokens_aus || 0) + (antwort.usage.output_tokens || 0);
  s.je[id] = j;
  statsSpeichern(s);
  deckelBuchen(usd, `${quelle} · ${a.name}`);
  pauseAufheben(id);
  ende(true);
  return antwort;
}

// ---------- Einrichten (Cockpit) ----------
async function modellListe(id, key) {
  try {
    const r = await fetch(`${basisUrl(id)}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(12000) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) return { ok: false, abgelehnt: true };
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, ids: (d.data || d.models || []).map((m) => String(m.id || m.name || "").replace(/^models\//, "")).filter(Boolean) };
  } catch (err) {
    return { ok: false, netz: true, fehler: err.message };
  }
}
function bestesModell(id, ids = []) {
  for (const muster of ANBIETER[id].modelle) {
    const treffer = ids.filter((m) => muster.test(m)).sort().reverse();
    if (treffer.length) return treffer[0];
  }
  return "";
}

/** Schlüssel prüfen (echte Anfrage an den Dienst) und verschlüsselt speichern. */
export async function einrichten(id, { key } = {}) {
  const a = ANBIETER[id];
  if (!a) return { ok: false, error: "Unbekannter Dienst." };
  const k = String(key || "").trim();
  if (k.length < 12 || k.length > 400 || /\s/.test(k)) return { ok: false, error: "Das sieht nicht wie ein Schlüssel aus." };
  const liste = await modellListe(id, k);
  if (liste.abgelehnt) return { ok: false, error: `${a.name} lehnt den Schlüssel ab. Kopier ihn bitte noch einmal von ${a.seite}.` };
  if (liste.netz) return { ok: false, error: `${a.name} ist gerade nicht erreichbar. Hat der Mac Internet?` };
  const modell = liste.ok ? bestesModell(id, liste.ids) : "";
  const d = lade();
  d.anbieter = d.anbieter || {};
  d.anbieter[id] = { ...(d.anbieter[id] || {}), key: verschluessele(k), ...(modell ? { modell } : {}), eingetragen: new Date().toISOString() };
  speichere(d);
  pauseAufheben(id);
  eintragen({ bereich: "verbindung", titel: `${a.name} eingerichtet`, details: `Modell: ${modell || modellVon(id)}. Tageslimit: ${eintrag(id).limit_tag.toFixed(2)} $.`, quelle: "dashboard" });
  return { ok: true, modell: modell || modellVon(id), modelle: liste.ok ? liste.ids.slice(0, 80) : [] };
}

export function einstellen(id, { an, ersatz, limit_tag, modell, preis } = {}) {
  if (!ANBIETER[id]) return { ok: false, error: "Unbekannter Dienst." };
  const d = lade();
  d.anbieter = d.anbieter || {};
  const e = { ...(d.anbieter[id] || {}) };
  if (an !== undefined) e.an = Boolean(an);
  if (ersatz !== undefined) e.ersatz = Boolean(ersatz);
  if (limit_tag !== undefined) {
    const n = Number(limit_tag);
    if (!(n >= 0 && n <= 100)) return { ok: false, error: "Tageslimit: 0 bis 100 $ (0 = kein eigenes Limit, der Kosten-Deckel gilt trotzdem)." };
    e.limit_tag = Math.round(n * 100) / 100;
  }
  if (modell !== undefined) {
    const m = String(modell).trim();
    if (m && !/^[\w.:/-]{2,80}$/.test(m)) return { ok: false, error: "Modellname enthält ungültige Zeichen." };
    e.modell = m;
  }
  if (preis !== undefined) e.preis = Array.isArray(preis) && preis.length === 2 ? preis.map(Number) : null;
  d.anbieter[id] = e;
  speichere(d);
  return { ok: true, dienst: dienstStand(id) };
}

export function reihenfolgeSetzen(liste = []) {
  const reihe = (Array.isArray(liste) ? liste : []).filter((id) => ANBIETER[id]);
  const d = lade();
  d.reihenfolge = [...new Set([...reihe, ...IDS])];
  speichere(d);
  return { ok: true, reihenfolge: d.reihenfolge };
}

export function vergessen(id) {
  const d = lade();
  if (d.anbieter?.[id]) { delete d.anbieter[id].key; speichere(d); }
  eintragen({ bereich: "verbindung", titel: `${ANBIETER[id]?.name || id}: Schlüssel gelöscht`, quelle: "dashboard" });
  return { ok: true };
}

function dienstStand(id) {
  const a = ANBIETER[id];
  const e = eintrag(id);
  const s = stats();
  const j = s.je[id] || {};
  const p = s.pausen[id];
  const modell = modellVon(id);
  return {
    id, name: a.name, emoji: a.emoji, seite: a.seite,
    eingerichtet: eingerichtet(id), an: e.an, ersatz: e.ersatz, bereit: bereit(id), grund: sperrGrund(id),
    modell, preis: preisFuer(modell, e.preis), preis_eigen: Boolean(e.preis),
    limit_tag: e.limit_tag, heute_usd: r4(heuteKosten(id)),
    anfragen: j.anfragen || 0, fehler: j.fehler || 0, schnitt_ms: j.anfragen - (j.fehler || 0) > 0 ? Math.round((j.ms_summe || 0) / (j.anfragen - (j.fehler || 0))) : null,
    usd_gesamt: j.usd_gesamt || 0, letzte: j.letzte || null, letzter_fehler: j.letzter_fehler || "", fehler_am: j.fehler_am || null,
    pause: p && new Date(p.bis).getTime() > Date.now() ? p : null,
  };
}

/** Andere Gehirne (Claude, OpenRouter, Ollama) melden ihre Zahlen über beginne() mit – hier nur lesen. */
export function fremdStand(id) {
  const j = stats().je[id] || {};
  return { anfragen: j.anfragen || 0, fehler: j.fehler || 0, schnitt_ms: j.anfragen - (j.fehler || 0) > 0 ? Math.round((j.ms_summe || 0) / (j.anfragen - (j.fehler || 0))) : null, letzte: j.letzte || null, letzter_fehler: j.letzter_fehler || "", fehler_am: j.fehler_am || null, modell: j.modell || "" };
}

export function uebersicht() {
  const d = lade();
  const reihe = [...new Set([...(d.reihenfolge || []), ...IDS])].filter((id) => ANBIETER[id]);
  return { dienste: reihe.map(dienstStand), reihenfolge: reihe, kette: kette(), live: liveListe(), tage: Object.entries(stats().tage).slice(-14).map(([tag, je]) => ({ tag, ...je })) };
}

// ---------- Schwarm-Frage ----------
const woerter = (t) => new Set(String(t || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 3));
export function aehnlichkeit(a, b) {
  const x = woerter(a), y = woerter(b);
  if (!x.size || !y.size) return 0;
  let gleich = 0;
  for (const w of x) if (y.has(w)) gleich++;
  return gleich / (x.size + y.size - gleich);
}
/** Welche Antwort stimmt am meisten mit den anderen überein? (Mittelwert der Wort-Übereinstimmung) */
export function konsens(antworten) {
  const gute = antworten.filter((a) => a.ok && a.text);
  if (!gute.length) return { beste: null, einigkeit: 0 };
  if (gute.length === 1) return { beste: gute[0], einigkeit: null };
  let beste = null, bestWert = -1, summe = 0, paare = 0;
  for (const a of gute) {
    let s = 0;
    for (const b of gute) if (a !== b) { const w = aehnlichkeit(a.text, b.text); s += w; summe += w; paare++; }
    const mittel = s / (gute.length - 1);
    a.uebereinstimmung = Math.round(mittel * 100);
    if (mittel > bestWert) { bestWert = mittel; beste = a; }
  }
  return { beste, einigkeit: Math.round((summe / paare) * 100) };
}

/**
 * Dieselbe Frage an mehrere KIs. fragen(anbieterId, params) kommt aus ki-client.js (dort sind auch Claude,
 * OpenRouter und Ollama erreichbar). Höchstens 4 Dienste, kurze Antworten, ohne Werkzeuge → wenig Kosten.
 */
export async function schwarmFrage(frage, { dienste, fragen, richter, maxTokens = 500 } = {}) {
  const liste = (dienste || []).slice(0, 4);
  if (!liste.length) return { ok: false, error: "Kein KI-Dienst bereit. Trag im Gehirn-Cockpit unter KI-Modelle einen Schlüssel ein oder richte Ollama ein." };
  const params = { max_tokens: maxTokens, system: "Antworte auf Deutsch, sachlich und knapp (höchstens 6 Sätze). Wenn du etwas nicht sicher weißt, sag das.", messages: [{ role: "user", content: String(frage).slice(0, 4000) }] };
  const antworten = await Promise.all(liste.map(async (id) => {
    const t0 = Date.now();
    try {
      const r = await fragen(id, params);
      const text = (r.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      return { id, ok: Boolean(text), text, ms: Date.now() - t0, usd: r.usage?.cost_usd ?? null, modell: r.model || "" };
    } catch (err) {
      return { id, ok: false, fehler: String(err.message || err).slice(0, 200), ms: Date.now() - t0 };
    }
  }));
  const k = konsens(antworten);
  let zusammen = k.beste?.text || "";
  let zusammenVon = k.beste ? `Antwort von ${k.beste.id} (stimmt am meisten mit den anderen überein)` : "";
  const gute = antworten.filter((a) => a.ok);
  if (richter && gute.length >= 2) {
    try {
      const r = await fragen(richter, {
        max_tokens: 700,
        system: "Du bist Friday. Führe die Antworten mehrerer KIs zu EINER Antwort zusammen. Nenne zuerst die Antwort, dann in einem Satz, wo sich die KIs einig sind und wo sie sich widersprechen. Erfinde nichts dazu. Deutsch, höchstens 8 Sätze.",
        messages: [{ role: "user", content: `Frage: ${frage}\n\n${gute.map((a, i) => `KI ${i + 1} (${a.id}):\n${a.text}`).join("\n\n")}` }],
      });
      const t = (r.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      if (t) { zusammen = t; zusammenVon = `zusammengeführt von ${richter}`; }
    } catch { /* dann bleibt die Konsens-Antwort */ }
  }
  eintragen({ bereich: "suche", titel: `Schwarm-Frage an ${liste.length} KIs: ${String(frage).slice(0, 80)}`, details: `${gute.length} Antworten, Einigkeit ${k.einigkeit ?? "–"} %`, ok: gute.length > 0, quelle: "schwarm" });
  return { ok: gute.length > 0, frage, antworten, einigkeit: k.einigkeit, antwort: zusammen, von: zusammenVon };
}

// ---------- Performance-Labor ----------
// Jede Prüffrage hat eine Antwort, die Friday selbst nachprüfen kann (kein Bauchgefühl, keine Simulation).
export const PRUEFFRAGEN = [
  { id: "rechnen", text: "Was ist 17 mal 23? Antworte nur mit der Zahl.", pruefe: (t) => /(^|\D)391(\D|$)/.test(t) },
  { id: "wissen", text: "Wie heißt die Hauptstadt von Australien? Antworte nur mit dem Namen.", pruefe: (t) => /canberra/i.test(t) && !/sydney/i.test(t) },
  { id: "zaehlen", text: "Wie oft kommt der Buchstabe r im Wort Erdbeere vor? Antworte nur mit der Zahl.", pruefe: (t) => /(^|\D)2(\D|$)/.test(t) || /\bzwei\b/i.test(t) },
  { id: "format", text: 'Gib genau dieses JSON zurück und sonst nichts: {"ok": true, "zahl": 7}', pruefe: (t) => { try { const j = JSON.parse(t.replace(/^```(json)?|```$/g, "").trim()); return j.ok === true && j.zahl === 7; } catch { return false; } } },
  { id: "anweisung", text: "Antworte nur mit dem Wort Ja. Keine Satzzeichen, nichts anderes.", pruefe: (t) => /^ja\.?$/i.test(t.trim()) },
];

/** Ein Durchlauf: jede Prüffrage an jeden gewählten Dienst. fragen() wie bei schwarmFrage. */
export async function laborLauf({ dienste = [], fragen } = {}) {
  const ergebnisse = [];
  for (const id of dienste.slice(0, 8)) {
    const einzel = [];
    for (const f of PRUEFFRAGEN) {
      const t0 = Date.now();
      try {
        const r = await fragen(id, { max_tokens: 60, messages: [{ role: "user", content: f.text }] });
        const text = (r.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
        einzel.push({ frage: f.id, ok: f.pruefe(text), antwort: text.slice(0, 120), ms: Date.now() - t0, usd: r.usage?.cost_usd ?? 0 });
      } catch (err) {
        einzel.push({ frage: f.id, ok: false, fehler: String(err.message || err).slice(0, 120), ms: Date.now() - t0, usd: 0 });
      }
    }
    const richtig = einzel.filter((e) => e.ok).length;
    const zeiten = einzel.filter((e) => !e.fehler).map((e) => e.ms);
    ergebnisse.push({
      id, richtig, von: PRUEFFRAGEN.length, qualitaet: Math.round((richtig / PRUEFFRAGEN.length) * 100),
      schnitt_ms: zeiten.length ? Math.round(zeiten.reduce((a, b) => a + b, 0) / zeiten.length) : null,
      usd: r4(einzel.reduce((s, e) => s + (Number(e.usd) || 0), 0)), einzel,
    });
  }
  // Rangliste: erst Qualität, dann Tempo
  ergebnisse.sort((a, b) => b.qualitaet - a.qualitaet || (a.schnitt_ms ?? 1e9) - (b.schnitt_ms ?? 1e9));
  const lauf = { zeit: new Date().toISOString(), ergebnisse };
  const s = stats();
  s.labor = [...(s.labor || []), lauf];
  statsSpeichern(s);
  eintragen({ bereich: "system", titel: `Performance-Labor: ${ergebnisse.length} KI${ergebnisse.length === 1 ? "" : "s"} verglichen`, details: ergebnisse.map((e) => `${e.id}: ${e.qualitaet} %, ${e.schnitt_ms ?? "–"} ms`).join(" · "), quelle: "labor" });
  return lauf;
}
export const laborVerlauf = () => (stats().labor || []).slice().reverse();
