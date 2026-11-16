// Alexa-Brücke: Friday löst Alexa-Routinen aus und lässt Alexa etwas ansagen.
// Läuft über Voice Monkey (voicemonkey.io, API v3). Amazon erlaubt keinen direkten Zugriff im WLAN,
// Voice Monkey ist der offizielle Umweg über einen Alexa-Skill.
//  - "Routine-Auslöser" (Voice Monkey) = ein Schalter, mit dem eine Alexa-Routine startet (z. B. "Licht an").
//  - "Lautsprecher" (Voice Monkey) = ein Echo, auf dem Alexa einen Satz sagt.
// Der Schlüssel (Token) steht in data/alexa.json (im Dashboard eingetragen) oder in der .env als VOICEMONKEY_TOKEN.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, config } from "./config.js";

const FILE = path.join(DATA_DIR, "alexa.json");
const envToken = () => String(config.voicemonkeyToken || "").trim();
// Nur für Tests änderbar (z. B. auf einen Probe-Server).
const API = () => String(process.env.VOICEMONKEY_API || "https://api-v3.voicemonkey.io").replace(/\/$/, "");

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}
function save(d) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}

function token() {
  return String(load().token || envToken() || "").trim();
}
export function alexaConfigured() {
  return Boolean(token());
}

// ---------- Fehler auf Deutsch ----------
const ERRORS = {
  UNAUTHORIZED: "Der Voice-Monkey-Schlüssel fehlt. Trag ihn im Alexa-Fenster ein.",
  INVALID_TOKEN: "Der Voice-Monkey-Schlüssel stimmt nicht. Nimm einen neuen von app.voicemonkey.io/tokens (v3).",
  DEVICE_NOT_FOUND: "Diesen Alexa-Auslöser kennt Voice Monkey nicht. Tipp im Alexa-Fenster auf Aktualisieren.",
  MISSING_DEVICE: "Es fehlt, welche Routine oder welcher Lautsprecher gemeint ist.",
  TOO_MANY_DEVICES: "Höchstens 10 Lautsprecher gleichzeitig.",
  THROTTLED: "Voice Monkey bremst gerade. Versuch es in einer Minute nochmal.",
  MONTHLY_QUOTA_EXCEEDED: "Das kostenlose Monatslimit bei Voice Monkey ist aufgebraucht.",
  ALEXA_TRIGGER_FAILED: "Alexa hat nicht reagiert. Ist der Voice-Monkey-Skill in der Alexa-App aktiviert?",
};

async function call(endpoint, body = {}) {
  const tok = token();
  if (!tok) return { ok: false, error: "Alexa ist noch nicht eingerichtet. Trag im Werkzeug-Menü → Alexa deinen Voice-Monkey-Schlüssel ein." };
  let res, data;
  try {
    res = await fetch(`${API()}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ token: tok, ...body }),
      signal: AbortSignal.timeout(12000),
    });
    data = await res.json().catch(() => ({}));
  } catch (err) {
    return { ok: false, error: "Voice Monkey ist gerade nicht erreichbar. Ist der Mac online?", detail: err.message };
  }
  if (!res.ok || data.success === false) {
    const code = String(data.error || `HTTP_${res.status}`);
    return { ok: false, error: ERRORS[code] || `Voice Monkey meldet einen Fehler (${code}).`, code };
  }
  return { ok: true, data: data.data };
}

// ---------- Geräte (Routinen + Lautsprecher) ----------
let lastRefresh = 0;
export async function refreshDevices() {
  const r = await call("devices");
  if (!r.ok) return r;
  const list = Array.isArray(r.data) ? r.data : [];
  const geraete = list
    .filter((d) => d && d.id)
    .map((d) => ({ id: String(d.id), name: String(d.name || d.id), art: d.capability === "speakers" ? "lautsprecher" : "routine" }));
  const d = load();
  d.geraete = geraete;
  d.aktualisiert = new Date().toISOString();
  if (d.standard && !geraete.some((g) => g.id === d.standard)) delete d.standard;
  save(d);
  lastRefresh = Date.now();
  return { ok: true, geraete };
}

const devices = () => load().geraete || [];
const routines = () => devices().filter((g) => g.art === "routine");
const speakers = () => devices().filter((g) => g.art === "lautsprecher");

export async function status() {
  const d = load();
  const eingerichtet = alexaConfigured();
  return {
    eingerichtet,
    schluesselQuelle: d.token ? "dashboard" : envToken() ? "env" : null,
    routinen: routines(),
    lautsprecher: speakers(),
    standard: d.standard || speakers()[0]?.id || null,
    aktualisiert: d.aktualisiert || null,
  };
}

export async function setToken(tok) {
  const t = String(tok || "").trim();
  if (t.length < 10 || t.length > 300 || /\s/.test(t)) return { ok: false, error: "Das sieht nicht wie ein Voice-Monkey-Schlüssel aus." };
  const d = load();
  const before = d.token;
  d.token = t;
  save(d);
  const r = await refreshDevices();
  if (!r.ok) {
    // Falscher Schlüssel: alten wieder herstellen, damit nichts kaputtgeht.
    const back = load();
    if (before) back.token = before; else delete back.token;
    save(back);
    return r;
  }
  return { ok: true, ...(await status()) };
}

export function forget() {
  save({});
  return { ok: true };
}

export function setStandard(id) {
  const d = load();
  if (!speakers().some((s) => s.id === id)) return { ok: false, error: "Diesen Lautsprecher kenne ich nicht." };
  d.standard = id;
  save(d);
  return { ok: true };
}

// ---------- Namen vergleichen ----------
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const FUELL = new Set(["bitte", "mal", "doch", "mach", "mache", "machen", "schalte", "schalt", "schalten", "das", "die", "der", "den", "dem", "starte", "start", "routine", "kannst", "du", "jetzt", "alexa", "fuer", "mich", "und"]);
const AN = new Set(["an", "ein", "einschalten", "anmachen", "anschalten", "on"]);
const AUS = new Set(["aus", "ausschalten", "ausmachen", "abschalten", "off"]);
const words = (s) => norm(s).split(" ").filter((w) => w && !FUELL.has(w));

function score(wish, name) {
  const a = norm(wish), b = norm(name);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const wa = words(wish), wb = words(name);
  if (!wa.length || !wb.length) return 0;
  // "an" und "aus" dürfen sich nie verwechseln.
  const onA = wa.some((w) => AN.has(w)), offA = wa.some((w) => AUS.has(w));
  const onB = wb.some((w) => AN.has(w)), offB = wb.some((w) => AUS.has(w));
  if ((onA && offB) || (offA && onB)) return 0;
  const sa = new Set(wa.map((w) => (AN.has(w) ? "#an" : AUS.has(w) ? "#aus" : w)));
  const sb = new Set(wb.map((w) => (AN.has(w) ? "#an" : AUS.has(w) ? "#aus" : w)));
  let hit = 0;
  for (const w of sb) if (sa.has(w) || [...sa].some((x) => x.length > 3 && w.length > 3 && (x.startsWith(w) || w.startsWith(x)))) hit++;
  if (!hit) return 0;
  return (hit / sb.size) * 0.8 + (hit / sa.size) * 0.2;
}

export function findRoutine(wish) {
  let best = null, bestScore = 0;
  for (const r of routines()) {
    const s = score(wish, r.name);
    if (s > bestScore) { best = r; bestScore = s; }
  }
  return bestScore >= 0.6 ? best : null;
}

function findSpeakers(where) {
  const w = norm(where);
  if (!w) return [];
  if (/^(ueberall|alle|allen|ganzen haus|im ganzen haus|haus)$/.test(w)) return speakers().slice(0, 10);
  let best = null, bestScore = 0;
  for (const s of speakers()) {
    const sc = score(w, s.name);
    if (sc > bestScore) { best = s; bestScore = sc; }
  }
  return bestScore >= 0.5 ? [best] : [];
}

// ---------- Aktionen ----------
export async function trigger(wish) {
  if (!alexaConfigured()) return call("trigger");
  let r = findRoutine(wish);
  if (!r && Date.now() - lastRefresh > 60_000) {
    await refreshDevices();
    r = findRoutine(wish);
  }
  if (!r) {
    const namen = routines().map((x) => x.name);
    return {
      ok: false,
      error: namen.length
        ? `Ich finde keine Alexa-Routine für „${wish}“. Deine Routinen: ${namen.slice(0, 8).join(", ")}.`
        : "Bei Voice Monkey sind noch keine Routine-Auslöser angelegt. Die Anleitung Alexa zeigt, wie.",
    };
  }
  const res = await call("trigger", { device: r.id });
  return res.ok ? { ok: true, routine: r.name, text: `Erledigt, Alexa startet „${r.name}“.` } : res;
}

export async function announce(speech, where) {
  const text = String(speech || "").trim().slice(0, 900);
  if (!text) return { ok: false, error: "Was soll Alexa sagen?" };
  if (!alexaConfigured()) return call("announce");
  if (!speakers().length && Date.now() - lastRefresh > 60_000) await refreshDevices();
  let ziel = where ? findSpeakers(where) : [];
  if (!ziel.length) {
    const st = await status();
    const s = speakers().find((x) => x.id === st.standard);
    if (s) ziel = [s];
  }
  if (!ziel.length) return { ok: false, error: "Bei Voice Monkey ist noch kein Lautsprecher angelegt. Die Anleitung Alexa zeigt, wie." };
  const res = await call("announce", { device: ziel.map((s) => s.id).join(","), speech: text, language: "de-DE" });
  const wo = ziel.length > 1 ? "auf allen Echos" : `auf ${ziel[0].name}`;
  return res.ok ? { ok: true, lautsprecher: ziel.map((s) => s.name), text: `Alexa sagt es ${wo}.` } : res;
}

// Einheitlicher Einstieg für Claude-Werkzeug und Dashboard.
export async function command({ action, value, lautsprecher } = {}) {
  switch (String(action || "")) {
    case "routine":
      return trigger(value);
    case "ansage":
      return announce(value, lautsprecher);
    case "liste": {
      if (alexaConfigured()) await refreshDevices();
      const st = await status();
      if (!st.eingerichtet) return { ok: false, error: "Alexa ist noch nicht eingerichtet." };
      return { ok: true, routinen: st.routinen.map((r) => r.name), lautsprecher: st.lautsprecher.map((s) => s.name) };
    }
    default:
      return { ok: false, error: "Unbekannte Alexa-Aktion." };
  }
}

// ---------- Sprachbefehle ohne Claude ----------
// Greift nur, wenn "Alexa" am Anfang steht oder klar an Alexa gerichtet ist:
//   "Friday, Alexa Licht an"            -> Routine "Licht an"
//   "Alexa, sag Abendessen ist fertig"  -> Ansage auf dem Standard-Echo
//   "Lass Alexa im Wohnzimmer sagen: Hallo" / "Sag über Alexa Hallo"
//   "Alexa, was kannst du?" / "Alexa Routinen"  -> Liste
export function parseAlexaCommand(text) {
  let t = String(text || "").trim().replace(/\s+/g, " ");
  t = t.replace(/^(hey |hallo |ok |okay )?(friday|freitag)[\s,.:!]*/i, "");
  let m;

  // Ansagen: Originaltext behalten, damit Alexa ihn genau so vorliest.
  if ((m = t.match(/^lass alexa\s+(.+)$/i))) {
    const rest = m[1].replace(/[.!]+$/, "").replace(/\s+(sagen|ansagen|durchsagen|verkünden)$/i, "").replace(/^(sagen|ansagen|durchsagen)[\s:,]+/i, "");
    return { action: "ansage", ...splitWhere(rest) };
  }
  if ((m = t.match(/^(?:sag|sage|mach eine durchsage|durchsage)\s+(?:über|ueber|mit|per)\s+alexa[\s:,]+(.+)$/i))) {
    return { action: "ansage", ...splitWhere(m[1]) };
  }

  if (!(m = t.match(/^alexa\b[\s,.:!]*(.*)$/i))) return null;
  let rest = m[1].trim().replace(/[.!?]+$/, "");
  if (!rest) return { action: "liste" };
  if ((m = rest.match(/^(?:sag mal|sag|sage|ansage|durchsage|verkünde|verkuende)\b[\s:,]*(.+)$/i))) {
    return { action: "ansage", ...splitWhere(m[1]) };
  }
  if (/^(routinen|liste|was kannst du|welche routinen( hast du| gibt es)?|zeig (mir )?(deine |die )?routinen)$/i.test(rest)) return { action: "liste" };
  rest = rest.replace(/^(bitte|starte?|routine)\s+/i, "");
  return { action: "routine", value: rest };
}

// "im Wohnzimmer Essen ist fertig" -> Lautsprecher "Wohnzimmer" + Satz. Nur wenn es den Lautsprecher wirklich gibt.
function splitWhere(rest) {
  const r = String(rest || "").trim();
  const all = r.match(/^(überall|ueberall|im ganzen haus|auf allen echos|auf allen)[\s:,]+(.+)$/i);
  if (all) return { lautsprecher: "überall", value: all[2] };
  const p = r.match(/^(im|in der|in|auf dem|auf der|auf)\s+(.+)$/i);
  if (p) {
    // Mit Doppelpunkt ist es eindeutig: "im Wohnzimmer: Hallo".
    const c = p[2].match(/^([^:]{1,40}):\s*(.+)$/);
    if (c && findSpeakers(c[1]).length) return { lautsprecher: c[1].trim(), value: c[2] };
    const ws = p[2].split(" ");
    for (const n of [1, 2, 3]) {
      if (ws.length <= n) continue;
      const where = ws.slice(0, n).join(" ").replace(/[:,]$/, "");
      if (findSpeakers(where).length) return { lautsprecher: where, value: ws.slice(n).join(" ").replace(/^[:,\s]+/, "") };
    }
  }
  return { lautsprecher: null, value: r.replace(/^[:,\s]+/, "") };
}

// Für Friday: führt einen erkannten Alexa-Befehl aus und liefert den Satz zum Vorlesen.
export async function quickCommand(text) {
  const cmd = parseAlexaCommand(text);
  if (!cmd) return null;
  const r = await command(cmd);
  if (!r.ok) return r.error;
  if (cmd.action === "liste") {
    const rs = r.routinen.length ? `Routinen: ${r.routinen.slice(0, 10).join(", ")}.` : "Noch keine Routinen.";
    const ls = r.lautsprecher.length ? ` Lautsprecher: ${r.lautsprecher.join(", ")}.` : "";
    return `Alexa kann bei mir: ${rs}${ls}`;
  }
  return r.text || "Erledigt.";
}
