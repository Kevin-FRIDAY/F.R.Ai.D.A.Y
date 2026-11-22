// Ersatz-Gehirn über OpenRouter (v1.142.0, zuerst nur in Eve).
// Ist Kevins Claude-Guthaben leer oder Claude gerade nicht erreichbar (Schlüssel falsch, Überlastung,
// Störung, kein Netz zu Anthropic), denkt Friday über OpenRouter weiter – mit denselben Werkzeugen.
// Der Schlüssel liegt nur auf dem Mac in server/data/openrouter.json (Friday und Eve teilen ihn)
// und wird nie ans Dashboard zurückgeschickt.
//
// Technik: Friday spricht intern das Anthropic-Format (messages, tool_use, tool_result).
// Hier wird das in das OpenAI-Format von OpenRouter übersetzt und die Antwort zurück.
import fs from "node:fs";
import path from "node:path";
import { FRIDAY_DATA_DIR, DATA_DIR, IST_EVE } from "./config.js";
import { istFrei } from "./eve.js";
import { eintragen } from "./logbuch.js";
import { getEnergie } from "./energie.js";
import { getSettings } from "./einstellungen.js";

export const FUNKTION_ID = "openrouter-ersatz";
const API = () => String(process.env.OPENROUTER_API || "https://openrouter.ai/api/v1").replace(/\/$/, "");
const FILE = path.join(FRIDAY_DATA_DIR, "openrouter.json"); // gemeinsam für Friday und Eve
const STATS = path.join(DATA_DIR, "openrouter-stats.json"); // pro Prozess
// Falls OpenRouter die Modell-Liste nicht liefert: bewährte Claude-Modelle.
export const STANDARD_MODELL = "anthropic/claude-sonnet-4.5";
export const STANDARD_SCHNELL = "anthropic/claude-haiku-4.5";

// ---------- Speicher ----------
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
  try { return { anzahl: 0, usd: 0, ...JSON.parse(fs.readFileSync(STATS, "utf8")) }; } catch { return { anzahl: 0, usd: 0 }; }
}
function statsDazu(x) {
  try {
    const s = { ...stats(), ...x };
    fs.mkdirSync(path.dirname(STATS), { recursive: true });
    fs.writeFileSync(STATS, JSON.stringify(s, null, 2));
  } catch { /* nur Anzeige */ }
}

const schluessel = () => String(lade().key || process.env.OPENROUTER_API_KEY || "").trim();
/** Ist ein Schlüssel eingetragen (egal ob freigegeben)? */
export const eingerichtet = () => Boolean(schluessel());
/** Darf diese Friday (bzw. Eve) das Ersatz-Gehirn gerade benutzen? */
export function ersatzBereit() {
  if (!eingerichtet() || lade().aus === true) return false;
  return IST_EVE || istFrei(FUNKTION_ID);
}
/** Nur in Eve: Testmodus – Claude überspringen und immer OpenRouter nehmen. */
export const testImmer = () => IST_EVE && lade().test === true && ersatzBereit();

/** Welches OpenRouter-Modell passt zum gewünschten Claude-Modell? */
// Ist das Claude-Guthaben leer, wählt Friday von selbst Haiku (Sparmodus). Das gilt nicht für OpenRouter:
// dann das Hauptmodell, außer Kevin hat ausdrücklich Denk-Tempo "Blitz" eingestellt.
export function modellFuer(claudeModell = "") {
  const d = lade();
  const schnell = d.schnell || d.modell || STANDARD_SCHNELL;
  const haupt = d.modell || STANDARD_MODELL;
  if (!/haiku/i.test(String(claudeModell))) return haupt;
  let gespart = false;
  try { gespart = getEnergie().zustand !== "voll" && getSettings().tempo !== "blitz"; } catch { /* egal */ }
  return gespart ? haupt : schnell;
}

// ---------- Übersetzen: Anthropic → OpenAI ----------
const textVon = (inhalt) => {
  if (typeof inhalt === "string") return inhalt;
  if (!Array.isArray(inhalt)) return inhalt == null ? "" : JSON.stringify(inhalt);
  return inhalt.filter((b) => b && b.type === "text").map((b) => b.text).join("\n");
};
const bildVon = (b) => {
  const s = b?.source || {};
  if (s.type === "base64" && s.data) return { type: "image_url", image_url: { url: `data:${s.media_type || "image/jpeg"};base64,${s.data}` } };
  if (s.type === "url" && s.url) return { type: "image_url", image_url: { url: s.url } };
  return null;
};
const dokumentVon = (b) => {
  const s = b?.source || {};
  if (s.type === "base64" && s.data) return { type: "file", file: { filename: b.title || "dokument.pdf", file_data: `data:${s.media_type || "application/pdf"};base64,${s.data}` } };
  if (s.type === "text" && s.data) return { type: "text", text: String(s.data) };
  return null;
};

function teileVon(bloecke) {
  const teile = [];
  for (const b of bloecke) {
    if (!b) continue;
    if (b.type === "text" && b.text) teile.push({ type: "text", text: b.text });
    else if (b.type === "image") { const x = bildVon(b); if (x) teile.push(x); }
    else if (b.type === "document") { const x = dokumentVon(b); if (x) teile.push(x); }
  }
  return teile;
}

export function zuOpenAI(params = {}) {
  const out = [];
  const sys = typeof params.system === "string" ? params.system : textVon(params.system || []);
  if (sys.trim()) out.push({ role: "system", content: sys });
  for (const m of params.messages || []) {
    const inhalt = typeof m.content === "string" ? [{ type: "text", text: m.content }] : Array.isArray(m.content) ? m.content : [];
    if (m.role === "assistant") {
      const text = inhalt.filter((b) => b?.type === "text").map((b) => b.text).join("");
      const calls = inhalt.filter((b) => b?.type === "tool_use").map((b) => ({
        id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
      }));
      if (!text && !calls.length) continue; // nur Denk-Blöcke oder Websuche: weglassen
      out.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
      continue;
    }
    // Nutzer: erst alle Werkzeug-Ergebnisse (müssen direkt nach dem Aufruf kommen), dann der Rest.
    const bilderAusErgebnissen = [];
    for (const b of inhalt) {
      if (b?.type !== "tool_result") continue;
      const roh = Array.isArray(b.content) ? b.content : [{ type: "text", text: textVon(b.content) }];
      let text = textVon(roh);
      for (const x of roh) if (x?.type === "image") { const bild = bildVon(x); if (bild) bilderAusErgebnissen.push(bild); }
      if (b.is_error && !/^fehler/i.test(text)) text = `Fehler: ${text}`;
      out.push({ role: "tool", tool_call_id: b.tool_use_id, content: text || "(leer)" });
    }
    const rest = teileVon(inhalt.filter((b) => b?.type !== "tool_result"));
    const alle = [...bilderAusErgebnissen, ...rest];
    if (!alle.length) continue;
    const nurText = alle.every((t) => t.type === "text");
    out.push({ role: "user", content: nurText ? alle.map((t) => t.text).join("\n") : alle });
  }
  const body = { model: params.model, messages: out, max_tokens: Math.min(Number(params.max_tokens) || 4000, 32000) };
  if (typeof params.temperature === "number") body.temperature = params.temperature;
  const tools = (params.tools || []).filter((t) => t && t.name && t.input_schema && (!t.type || t.type === "custom"));
  if (tools.length) {
    body.tools = tools.map((t) => ({ type: "function", function: { name: t.name, description: String(t.description || "").slice(0, 4000), parameters: t.input_schema } }));
    const tc = params.tool_choice;
    if (tc?.type === "tool" && tc.name) body.tool_choice = { type: "function", function: { name: tc.name } };
    else if (tc?.type === "any") body.tool_choice = "required";
    else if (tc?.type === "none") body.tool_choice = "none";
  }
  return body;
}

// ---------- Übersetzen: OpenAI → Anthropic ----------
let zaehler = 0;
export function zuAnthropic(data = {}, modell = "") {
  const wahl = data.choices?.[0] || {};
  const msg = wahl.message || {};
  const content = [];
  const text = typeof msg.content === "string" ? msg.content : textVon(msg.content || []);
  if (text) content.push({ type: "text", text });
  for (const c of msg.tool_calls || []) {
    let input = {};
    try { input = c.function?.arguments ? JSON.parse(c.function.arguments) : {}; } catch { input = {}; }
    if (!input || typeof input !== "object" || Array.isArray(input)) input = {};
    content.push({ type: "tool_use", id: c.id || `or_${Date.now().toString(36)}_${zaehler++}`, name: c.function?.name || "", input });
  }
  const fr = wahl.finish_reason || wahl.native_finish_reason;
  const hatTool = content.some((b) => b.type === "tool_use");
  const stop_reason = hatTool ? "tool_use" : fr === "length" ? "max_tokens" : fr === "content_filter" ? "refusal" : "end_turn";
  const u = data.usage || {};
  return {
    id: data.id || `or_${Date.now().toString(36)}`,
    type: "message",
    role: "assistant",
    model: `openrouter/${data.model || modell}`,
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0, ...(typeof u.cost === "number" ? { cost_usd: u.cost } : {}) },
  };
}

// ---------- Aufruf ----------
function kopf(key) {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Friday", "HTTP-Referer": "https://github.com/kevin-friday/f.r.ai.d.a.y" };
}

/** Fehlertext von OpenRouter auf Deutsch. */
function fehlerText(status, roh) {
  const m = String(roh?.error?.message || roh?.message || "").slice(0, 200);
  if (status === 401) return "OpenRouter lehnt den Schlüssel ab. Erstell auf openrouter.ai unter Keys einen neuen und trag ihn in Verbindungen ein.";
  if (status === 402) return "Dein OpenRouter-Guthaben ist leer. Lade es auf openrouter.ai unter Credits auf.";
  if (status === 429) return "OpenRouter bremst gerade (zu viele Anfragen). Gleich nochmal versuchen.";
  if (status === 404 || /model/i.test(m) && status === 400) return `OpenRouter kennt das Modell nicht oder es kann keine Werkzeuge. Wähl in Verbindungen → OpenRouter ein anderes. (${m})`;
  return `OpenRouter meldet Fehler ${status}${m ? `: ${m}` : ""}.`;
}

/** Eine Anfrage im Anthropic-Format über OpenRouter beantworten. Wirft bei Fehlern. */
export async function erstelle(params, { key = schluessel(), timeout = 300000 } = {}) {
  if (!key) throw new Error("Kein OpenRouter-Schlüssel eingetragen.");
  const modell = params.model && params.model.includes("/") ? params.model : modellFuer(params.model);
  const body = zuOpenAI({ ...params, model: modell });
  let r;
  try {
    r = await fetch(`${API()}/chat/completions`, { method: "POST", headers: kopf(key), body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  } catch (err) {
    const e = new Error(`OpenRouter ist nicht erreichbar (${err.name === "TimeoutError" ? "Zeitüberschreitung" : err.message}).`);
    statsDazu({ letzter_fehler: e.message, fehler_am: new Date().toISOString() });
    throw e;
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) {
    const e = new Error(fehlerText(r.ok ? Number(data.error?.code) || 500 : r.status, data));
    e.status = r.status;
    statsDazu({ letzter_fehler: e.message, fehler_am: new Date().toISOString() });
    throw e;
  }
  const antwort = zuAnthropic(data, modell);
  const s = stats();
  statsDazu({ anzahl: s.anzahl + 1, usd: Math.round((s.usd + (antwort.usage.cost_usd || 0)) * 10000) / 10000, zuletzt: new Date().toISOString(), modell: antwort.model.replace(/^openrouter\//, ""), letzter_fehler: "" });
  return antwort;
}

// Einmal pro 10 Minuten ins Logbuch, damit man sieht, dass das Ersatz-Gehirn gedacht hat.
let zuletztGeloggt = 0;
export function eingesprungen(grund = "") {
  if (Date.now() - zuletztGeloggt < 10 * 60 * 1000) return;
  zuletztGeloggt = Date.now();
  try { eintragen({ bereich: "system", titel: "Ersatz-Gehirn OpenRouter ist eingesprungen", details: String(grund).slice(0, 300), quelle: "friday", ok: true }); } catch { /* egal */ }
}

// ---------- Modelle und Konto ----------
let modellCache = { at: 0, liste: [] };
async function modelle() {
  if (Date.now() - modellCache.at < 6 * 3600 * 1000 && modellCache.liste.length) return modellCache.liste;
  try {
    const r = await fetch(`${API()}/models`, { signal: AbortSignal.timeout(12000) });
    const d = await r.json();
    const liste = (d.data || []).filter((m) => (m.supported_parameters || []).includes("tools")).map((m) => ({
      id: m.id, name: m.name || m.id, created: m.created || 0,
      preis: Number(m.pricing?.prompt || 0) * 1e6, preisAus: Number(m.pricing?.completion || 0) * 1e6,
    }));
    if (liste.length) modellCache = { at: Date.now(), liste };
  } catch { /* offline: Standardliste */ }
  return modellCache.liste;
}
const neuestes = (liste, muster) => liste.filter((m) => muster.test(m.id) && !/:/.test(m.id)).sort((a, b) => b.created - a.created)[0]?.id;

async function konto(key) {
  try {
    const r = await fetch(`${API()}/key`, { headers: kopf(key), signal: AbortSignal.timeout(12000) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) return { ok: false, error: fehlerText(401, d) };
    if (!r.ok) return { ok: false, error: fehlerText(r.status, d) };
    return { ok: true, ...d.data };
  } catch {
    return { ok: false, netz: true, error: "OpenRouter ist gerade nicht erreichbar. Hat der Mac Internet?" };
  }
}

// ---------- Fenster "Verbindungen" ----------
export const info = { id: "openrouter", name: "Ersatz-Gehirn (OpenRouter)", emoji: "🧠", kurz: "Springt ein, wenn dein Claude-Guthaben leer ist oder Claude ausfällt." };

const geld = (x) => (typeof x === "number" ? `${x.toFixed(2).replace(".", ",")} $` : "?");
const zeit = (iso) => { try { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } };

export async function status() {
  const d = lade();
  const ein = eingerichtet();
  if (!ein) {
    return {
      ...info, eingerichtet: false,
      text: "Nicht eingerichtet. So geht's: auf openrouter.ai anmelden → Keys → Create Key, Guthaben unter Credits aufladen, dann den Schlüssel hier eintragen.",
      hinweis: IST_EVE || istFrei(FUNKTION_ID) ? "" : "Noch im Test: Friday benutzt das Ersatz-Gehirn erst, wenn du es in Eve ausprobiert und unter Eve-Tests freigegeben hast. Den Schlüssel kannst du schon eintragen.",
      felder: [{ name: "key", label: "OpenRouter-Schlüssel", typ: "password", platzhalter: "sk-or-v1-…" }],
      auswahl: [], aktionen: [],
    };
  }
  const s = stats();
  const frei = IST_EVE || istFrei(FUNKTION_ID);
  const liste = await modelle();
  const optionen = (aktuell) => {
    const top = liste.filter((m) => /^(anthropic|openai|google|deepseek|mistralai|x-ai|meta-llama|qwen)\//.test(m.id) && !/:/.test(m.id))
      .sort((a, b) => (a.id.startsWith("anthropic/") === b.id.startsWith("anthropic/") ? b.created - a.created : a.id.startsWith("anthropic/") ? -1 : 1))
      .slice(0, 30)
      .map((m) => ({ wert: m.id, text: `${m.name} · ${m.preis.toFixed(2)}/${m.preisAus.toFixed(2)} $ je Mio.` }));
    if (!top.some((o) => o.wert === aktuell)) top.unshift({ wert: aktuell, text: aktuell });
    return top;
  };
  const modell = d.modell || STANDARD_MODELL;
  const schnell = d.schnell || STANDARD_SCHNELL;
  const teile = [
    d.aus ? "Ausgeschaltet" : frei ? "Bereit als Ersatz" : "Schlüssel gespeichert · in Friday noch gesperrt (erst in Eve testen und freigeben)",
    s.anzahl ? `${s.anzahl}× eingesprungen, zuletzt ${zeit(s.zuletzt)}${s.usd ? `, rund ${geld(s.usd)} verbraucht` : ""}` : "noch nie gebraucht",
  ];
  if (s.letzter_fehler) teile.push(`Letzter Fehler: ${s.letzter_fehler}`);
  const auswahl = [
    { name: "modell", label: "Hauptmodell (für normale Fragen)", wert: modell, optionen: optionen(modell) },
    { name: "schnell", label: "Schnelles Modell (Blitz- und Sparmodus)", wert: schnell, optionen: optionen(schnell) },
    { name: "aus", label: "Ersatz-Gehirn", wert: d.aus ? "aus" : "an", optionen: [{ wert: "an", text: "An – springt ein, wenn Claude ausfällt" }, { wert: "aus", text: "Aus" }] },
  ];
  if (IST_EVE) auswahl.push({ name: "test", label: "Test in Eve", wert: d.test ? "immer" : "normal", optionen: [{ wert: "normal", text: "Normal (nur wenn Claude ausfällt)" }, { wert: "immer", text: "Test: Eve denkt immer mit OpenRouter" }] });
  return {
    ...info, eingerichtet: true,
    text: teile.join(" · "),
    hinweis: "Die Websuche gibt es nur bei Claude. Über OpenRouter denkt Friday ohne Websuche, alle anderen Werkzeuge laufen.",
    felder: [], auswahl,
    aktionen: [{ action: "probe", text: "🎙 Probe-Frage" }, { action: "konto", text: "💳 Guthaben ansehen" }],
  };
}

export async function einrichten({ key } = {}) {
  const k = String(key || "").trim();
  if (!/^sk-or-[\w-]{20,200}$/.test(k)) return { ok: false, error: "Ein OpenRouter-Schlüssel beginnt mit sk-or- und ist lang. Kopier ihn bitte komplett von openrouter.ai → Keys." };
  const c = await konto(k);
  if (!c.ok) return c;
  const liste = await modelle();
  const d = lade();
  speichere({
    ...d, key: k,
    modell: d.modell || neuestes(liste, /^anthropic\/claude-sonnet/) || STANDARD_MODELL,
    schnell: d.schnell || neuestes(liste, /^anthropic\/claude-haiku/) || STANDARD_SCHNELL,
    eingetragen_am: new Date().toISOString(),
  });
  const frei = IST_EVE || istFrei(FUNKTION_ID);
  return { ok: true, text: frei ? "OpenRouter ist verbunden. Wenn mein Claude-Guthaben leer ist, denke ich damit weiter." : "Schlüssel gespeichert. Probier das Ersatz-Gehirn in Eve aus und gib es dort frei, dann nutze ich es auch hier." };
}

export async function einstellen({ name, wert } = {}) {
  const d = lade();
  const w = String(wert || "").slice(0, 120);
  if (name === "modell" || name === "schnell") {
    if (!/^[\w.-]+\/[\w.:-]+$/.test(w)) return { ok: false, error: "Unbekanntes Modell." };
    speichere({ ...d, [name]: w });
    return { ok: true, text: "Modell gespeichert." };
  }
  if (name === "aus") { speichere({ ...d, aus: w === "aus" ? true : undefined }); return { ok: true, text: w === "aus" ? "Ersatz-Gehirn ist aus." : "Ersatz-Gehirn ist an." }; }
  if (name === "test" && IST_EVE) { speichere({ ...d, test: w === "immer" ? true : undefined }); return { ok: true, text: w === "immer" ? "Eve denkt jetzt immer mit OpenRouter. Stell einfach eine Frage." : "Eve nimmt wieder zuerst Claude." }; }
  return { ok: false, error: "Unbekannte Einstellung." };
}

export function vergessen() {
  const d = lade();
  delete d.key;
  speichere(d);
  return { ok: true };
}

export async function command({ action } = {}) {
  if (!eingerichtet()) return { ok: false, error: "Trag zuerst deinen OpenRouter-Schlüssel ein." };
  if (action === "konto") {
    const c = await konto(schluessel());
    if (!c.ok) return c;
    const rest = typeof c.limit_remaining === "number" ? `Übrig bis zu deinem Limit: ${geld(c.limit_remaining)}. ` : "";
    return { ok: true, text: `OpenRouter: bisher ${geld(c.usage)} verbraucht. ${rest}${c.is_free_tier ? "Du bist noch im Gratis-Tarif, lade unter Credits etwas auf, sonst gehen nur wenige Anfragen." : ""}`.trim() };
  }
  if (action === "probe") {
    try {
      const r = await erstelle({ model: modellFuer(""), max_tokens: 200, system: "Du bist F.R.Ai.D.A.Y, die KI von Kevin. Antworte auf Deutsch in einem kurzen gesprochenen Satz.", messages: [{ role: "user", content: "Sag kurz Hallo und dass dein Ersatz-Gehirn läuft." }] }, { timeout: 45000 });
      const t = r.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      return { ok: true, sprechen: true, text: `${t || "Ich bin da."} (${r.model.replace(/^openrouter\//, "")})` };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
  return { ok: false, error: "Unbekannter Befehl." };
}
