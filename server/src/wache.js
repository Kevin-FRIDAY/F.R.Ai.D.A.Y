// Kamera-Wache (v1.126.0): Friday passt mit Kevins EIGENEN Kameras auf das Zuhause auf.
//
// So funktioniert es:
// - Die Erkennung (Bewegung, Personen, Hunde/Katzen, Gegenstände, Feuerschein/Rauch, Tür-Linie)
//   läuft im Browser auf dem Gerät mit der Kamera (Mac, altes iPhone/iPad) – lokal, ohne Claude.
// - IP-Kameras im eigenen WLAN holt der Mac als Standbild (http-Schnappschuss oder rtsp über ffmpeg),
//   ausgewertet werden sie im Wache-Fenster auf dem Mac.
// - Hier auf dem Server: Kameras + Einstellungen (data/wache.json), Live-Stand im Speicher,
//   Ereignisprotokoll (data/wache/JJJJ-MM.jsonl), Fotos der Ereignisse in ~/Friday-Archiv/Kamera-Wache/<Tag>/,
//   Alarm über Telegram/ntfy, Sprachbefehle ohne Claude. Nur "Schau genau hin" fragt Claude nach einer Beschreibung.
//
// Grenzen (mit Kevin abgesprochen): nur eigene Kameras, "Person erkannt" ja – aber keine Gesichtserkennung
// und kein Erkennen, WER jemand ist. Keine fremden oder öffentlichen Kameras.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { DATA_DIR, config } from "./config.js";
import { notifyAll, sendTelegramPhoto } from "./notify.js";
import * as logbuch from "./logbuch.js";
import { U, teile } from "./datum.js";

const DATEI = path.join(DATA_DIR, "wache.json");
const LOG_DIR = path.join(DATA_DIR, "wache");
export const BILD_DIR = process.env.FRIDAY_WACHE_DIR || path.join(process.env.FRIDAY_ARCHIV_DIR || path.join(os.homedir(), "Friday-Archiv"), "Kamera-Wache");
const ONLINE_MS = 30 * 1000; // so lange gilt eine Kamera nach dem letzten Lebenszeichen als "an"
const OFFLINE_ALARM_MS = 3 * 60 * 1000;
const MAX_BILD = 3 * 1024 * 1024;

export const TYPEN = {
  bewegung: { icon: "🚶", name: "Bewegung" },
  person: { icon: "🧍", name: "Person" },
  tier: { icon: "🐕", name: "Tier" },
  objekt: { icon: "🔍", name: "Gegenstand" },
  gefahr: { icon: "🔥", name: "Rauch/Feuer" },
  tuer: { icon: "🚪", name: "Tür" },
  offline: { icon: "📵", name: "Kamera aus" },
  system: { icon: "🛡", name: "Wache" },
};

const STANDARD = {
  scharf: false,
  erkennen: { bewegung: true, personen: true, tiere: true, objekte: true, gefahr: true, tuer: true },
  // Wann Friday Alarm schlägt, solange die Wache scharf ist.
  alarmBei: { bewegung: false, person: true, tier: false, objekt: true, tuer: true, gefahr: true, offline: true },
  gefahrImmer: true, // Feuer/Rauch meldet Friday auch, wenn die Wache nicht scharf ist
  telegramFoto: true,
  ton: false, // Warnton am Kamera-Gerät, wenn Alarm ausgelöst wird
  pauseMin: 2, // gleicher Alarm von derselben Kamera frühestens nach … Minuten wieder
  aufbewahrenTage: 7,
  empfindlichkeit: 50, // Bewegung: 0 = träge, 100 = sehr empfindlich
  bewachen: [], // Gegenstände, bei deren Verschwinden Friday Bescheid sagt (z. B. "laptop", "bicycle")
  kameras: [],
};

// ---------- Speichern ----------
let daten = null;
function laden() {
  if (daten) return daten;
  let roh = {};
  try { roh = JSON.parse(fs.readFileSync(DATEI, "utf8")); } catch { /* neu */ }
  daten = {
    ...STANDARD, ...roh,
    erkennen: { ...STANDARD.erkennen, ...(roh.erkennen || {}) },
    alarmBei: { ...STANDARD.alarmBei, ...(roh.alarmBei || {}) },
    kameras: Array.isArray(roh.kameras) ? roh.kameras : [],
    bewachen: Array.isArray(roh.bewachen) ? roh.bewachen : [],
  };
  return daten;
}
function speichern() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DATEI}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(daten, null, 2));
    fs.renameSync(tmp, DATEI);
  } catch (err) { console.error("Kamera-Wache speichern:", err.message); }
}

const kurz = (s, n = 200) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const neueId = () => crypto.randomBytes(5).toString("hex");
const name = (s) => kurz(s, 40).replace(/[<>]/g, "") || "Kamera";
const zwei = (n) => String(n).padStart(2, "0");
function tagStr(ms = Date.now()) { const p = teile(ms); return `${p.y}-${zwei(p.m)}-${zwei(p.d)}`; }
function uhr(ms) { const p = teile(ms); return `${zwei(p.h)}:${zwei(p.mi)}`; }

/** Passwort in einer Kamera-Adresse verstecken (für die Anzeige). */
export function maskiere(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "•••";
    return u.toString();
  } catch { return ""; }
}
function gueltigeUrl(url) {
  try {
    const u = new URL(String(url || "").trim());
    return ["http:", "https:", "rtsp:", "rtsps:"].includes(u.protocol) ? u.toString() : null;
  } catch { return null; }
}
function linie(l) {
  if (!l) return null;
  const n = (v) => Math.min(1, Math.max(0, Number(v)));
  const r = { x1: n(l.x1), y1: n(l.y1), x2: n(l.x2), y2: n(l.y2) };
  if (Object.values(r).some((v) => !Number.isFinite(v))) return null;
  if (Math.hypot(r.x2 - r.x1, r.y2 - r.y1) < 0.05) return null;
  return r;
}

// ---------- Live-Stand (nur im Speicher, nie auf der Platte) ----------
const live = new Map(); // kameraId -> { at, objekte, bewegung, gefahr, bild(Buffer), bildAt, auswerter }

function kameraFuer(id) { return laden().kameras.find((k) => k.id === id); }

export function uebersicht({ mitEreignissen = 30 } = {}) {
  const d = laden();
  const jetzt = Date.now();
  const kameras = d.kameras.map((k) => {
    const l = live.get(k.id);
    const online = Boolean(l && jetzt - l.at < ONLINE_MS);
    return {
      id: k.id, name: k.name, typ: k.typ, linie: k.linie || null, seit: k.seit,
      ...(k.typ === "ip" ? { url: maskiere(k.url) } : {}),
      online,
      zuletzt: l?.at || k.zuletzt || null,
      objekte: online ? l.objekte : {},
      bewegung: online ? l.bewegung : 0,
      gefahr: online ? l.gefahr || null : null,
      hatBild: Boolean(l?.bild && jetzt - (l.bildAt || 0) < 5 * 60 * 1000) || k.typ === "ip",
    };
  });
  const heute = ereignisse({ tag: tagStr(), limit: 5000 });
  const zaehler = {};
  for (const e of heute) zaehler[e.typ] = (zaehler[e.typ] || 0) + 1;
  return {
    scharf: d.scharf,
    scharfSeit: d.scharfSeit || null,
    einstellungen: einstellungenAus(d),
    kameras,
    heute: { anzahl: heute.length, typen: zaehler, alarme: heute.filter((e) => e.alarm).length },
    ereignisse: mitEreignissen ? ereignisse({ limit: mitEreignissen }) : [],
    typen: TYPEN,
    ffmpeg: Boolean(ffmpegPfad()),
  };
}
function einstellungenAus(d) {
  const { erkennen, alarmBei, gefahrImmer, telegramFoto, ton, pauseMin, aufbewahrenTage, empfindlichkeit, bewachen } = d;
  return { erkennen, alarmBei, gefahrImmer, telegramFoto, ton, pauseMin, aufbewahrenTage, empfindlichkeit, bewachen, telegram: Boolean(config.telegramToken && config.telegramChatId), ntfy: Boolean(config.ntfyTopic) };
}

export function setzeEinstellungen(neu = {}) {
  const d = laden();
  const bool = (o, vorher) => Object.fromEntries(Object.keys(vorher).map((k) => [k, o && k in o ? Boolean(o[k]) : vorher[k]]));
  if (neu.erkennen) d.erkennen = bool(neu.erkennen, d.erkennen);
  if (neu.alarmBei) d.alarmBei = bool(neu.alarmBei, d.alarmBei);
  if ("gefahrImmer" in neu) d.gefahrImmer = Boolean(neu.gefahrImmer);
  if ("telegramFoto" in neu) d.telegramFoto = Boolean(neu.telegramFoto);
  if ("ton" in neu) d.ton = Boolean(neu.ton);
  const zahl = (v, min, max, alt) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : alt);
  if ("pauseMin" in neu) d.pauseMin = zahl(neu.pauseMin, 0, 60, d.pauseMin);
  if ("aufbewahrenTage" in neu) d.aufbewahrenTage = zahl(neu.aufbewahrenTage, 1, 90, d.aufbewahrenTage);
  if ("empfindlichkeit" in neu) d.empfindlichkeit = zahl(neu.empfindlichkeit, 0, 100, d.empfindlichkeit);
  if (Array.isArray(neu.bewachen)) d.bewachen = [...new Set(neu.bewachen.map((x) => kurz(x, 30).toLowerCase()).filter(Boolean))].slice(0, 12);
  speichern();
  return einstellungenAus(d);
}

export function scharfSchalten(an, quelle = "dashboard") {
  const d = laden();
  const vorher = d.scharf;
  d.scharf = Boolean(an);
  d.scharfSeit = d.scharf ? (vorher ? d.scharfSeit : Date.now()) : null;
  speichern();
  if (vorher !== d.scharf) {
    schreibe({ kamera: null, raum: "", typ: "system", text: d.scharf ? "Wache scharf geschaltet" : "Wache ausgeschaltet", quelle });
    logbuch.eintragen({ bereich: "wache", titel: d.scharf ? "Kamera-Wache scharf geschaltet" : "Kamera-Wache ausgeschaltet", quelle });
  }
  return { scharf: d.scharf };
}

// ---------- Kameras ----------
/** Ein Gerät (Mac, altes iPhone) meldet sich als Kamera an oder benennt sich um. */
export function station({ id, name: n }) {
  const d = laden();
  let k = id && d.kameras.find((x) => x.id === id && x.typ === "geraet");
  if (!k) {
    k = { id: `g-${neueId()}`, typ: "geraet", name: name(n || "Kamera"), seit: Date.now() };
    d.kameras.push(k);
  } else if (n) k.name = name(n);
  speichern();
  return { id: k.id, name: k.name, linie: k.linie || null };
}

export function kameraSpeichern(neu = {}) {
  const d = laden();
  let k = neu.id && d.kameras.find((x) => x.id === neu.id);
  if (!k) {
    if (d.kameras.length >= 16) throw Object.assign(new Error("Mehr als 16 Kameras schafft Friday nicht."), { status: 400 });
    const url = gueltigeUrl(neu.url);
    if (!url) throw Object.assign(new Error("Die Adresse muss mit http://, https:// oder rtsp:// anfangen."), { status: 400 });
    k = { id: `ip-${neueId()}`, typ: "ip", name: name(neu.name), url, seit: Date.now() };
    d.kameras.push(k);
  } else {
    if (neu.name) k.name = name(neu.name);
    // Beim Bearbeiten bleibt die alte Adresse, wenn das Feld noch das versteckte Passwort zeigt.
    if (k.typ === "ip" && neu.url && neu.url !== maskiere(k.url)) {
      const url = gueltigeUrl(neu.url);
      if (!url) throw Object.assign(new Error("Die Adresse muss mit http://, https:// oder rtsp:// anfangen."), { status: 400 });
      k.url = url;
    }
  }
  if ("linie" in neu) k.linie = linie(neu.linie);
  speichern();
  return { id: k.id };
}

export function kameraLoeschen(id) {
  const d = laden();
  const vorher = d.kameras.length;
  d.kameras = d.kameras.filter((k) => k.id !== id);
  live.delete(id);
  speichern();
  return { ok: d.kameras.length < vorher };
}

// ---------- Lebenszeichen der Kameras ----------
const objektListe = (o) => Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {})
  .filter(([k, v]) => /^[a-z ]{2,24}$/.test(k) && Number(v) > 0).slice(0, 30).map(([k, v]) => [k, Math.min(50, Math.round(Number(v)))]));

function bildAus(dataUrl) {
  const m = String(dataUrl || "").match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[1], "base64");
  return buf.length > 0 && buf.length <= MAX_BILD && buf[0] === 0xff && buf[1] === 0xd8 ? buf : null;
}

/** Stand von einer Kamera (alle paar Sekunden). Antwortet mit dem, was die Kamera wissen muss. */
export function status({ id, objekte, bewegung, gefahr, bild, auswerter }) {
  const k = kameraFuer(id);
  if (!k) return { unbekannt: true };
  const alt = live.get(id);
  // Zwei Fenster werten dieselbe IP-Kamera aus? Nur das erste zählt.
  if (k.typ === "ip" && alt?.auswerter && auswerter && alt.auswerter !== auswerter && Date.now() - alt.at < 15000) {
    return { schonVergeben: true, ...antwortFuerKamera(k) };
  }
  const b = bildAus(bild);
  live.set(id, {
    at: Date.now(),
    objekte: objektListe(objekte),
    bewegung: Math.min(100, Math.max(0, Math.round(Number(bewegung) || 0))),
    gefahr: gefahr ? kurz(gefahr, 60) : null,
    bild: b || alt?.bild || null,
    bildAt: b ? Date.now() : alt?.bildAt || 0,
    auswerter: auswerter ? kurz(auswerter, 20) : alt?.auswerter,
    offlineGemeldet: false,
  });
  k.zuletzt = Date.now();
  return antwortFuerKamera(k);
}
function antwortFuerKamera(k) {
  const d = laden();
  return { scharf: d.scharf, name: k.name, linie: k.linie || null, einstellungen: einstellungenAus(d) };
}

// ---------- Ereignisse ----------
const letzteAlarme = new Map(); // `${kamera}:${typ}` -> ms
const letzteEreignisse = new Map();

function monatsDatei(tag) { return path.join(LOG_DIR, `${tag.slice(0, 7)}.jsonl`); }

function schreibe(e) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const at = Date.now();
    const eintrag = { id: `${at.toString(36)}${crypto.randomBytes(2).toString("hex")}`, at, tag: tagStr(at), ...e };
    fs.appendFileSync(monatsDatei(eintrag.tag), JSON.stringify(eintrag) + "\n");
    cache.clear();
    return eintrag;
  } catch (err) {
    console.error("Kamera-Wache Ereignis:", err.message);
    return null;
  }
}

/** Eine Kamera meldet ein Ereignis (mit Foto). */
export async function ereignis({ id, typ, text, bild, details }) {
  const k = kameraFuer(id);
  if (!k) throw Object.assign(new Error("Unbekannte Kamera"), { status: 404 });
  if (!TYPEN[typ] || typ === "system" || typ === "offline") throw Object.assign(new Error("Unbekannte Art"), { status: 400 });
  const d = laden();
  // Schutz vor Dauerfeuer: dieselbe Art von derselben Kamera höchstens alle 20 Sekunden.
  const schluessel = `${id}:${typ}`;
  const jetzt = Date.now();
  if (jetzt - (letzteEreignisse.get(schluessel) || 0) < 20000) return { ok: true, uebersprungen: true };
  letzteEreignisse.set(schluessel, jetzt);

  const buf = bildAus(bild);
  let datei = null;
  if (buf) {
    try {
      const tag = tagStr(jetzt);
      fs.mkdirSync(path.join(BILD_DIR, tag), { recursive: true });
      const p = teile(jetzt);
      datei = `${tag}/${zwei(p.h)}-${zwei(p.mi)}-${zwei(p.s)}_${typ}_${crypto.randomBytes(2).toString("hex")}.jpg`;
      fs.writeFileSync(path.join(BILD_DIR, datei), buf);
    } catch (err) { console.error("Kamera-Wache Foto:", err.message); datei = null; }
  }
  const satz = kurz(text, 160) || `${TYPEN[typ].name} erkannt`;
  const sollAlarm = (typ === "gefahr" && d.gefahrImmer) || (d.scharf && d.alarmBei[typ]);
  let alarm = false;
  if (sollAlarm && jetzt - (letzteAlarme.get(schluessel) || 0) >= d.pauseMin * 60000) {
    letzteAlarme.set(schluessel, jetzt);
    alarm = true;
  }
  const e = schreibe({ kamera: id, raum: k.name, typ, text: satz, ...(datei ? { bild: datei } : {}), ...(details ? { details: kurz(details, 300) } : {}), ...(alarm ? { alarm: true } : {}) });
  logbuch.eintragen({ bereich: "wache", titel: `${TYPEN[typ].icon} ${k.name}: ${satz}`, ok: typ !== "gefahr", quelle: "kamera" });
  if (alarm) schlageAlarm({ raum: k.name, typ, satz, buf, mitFoto: d.telegramFoto }).catch(() => {});
  return { ok: true, ereignis: e, alarm };
}

async function schlageAlarm({ raum, typ, satz, buf, mitFoto }) {
  const titel = typ === "gefahr" ? "🔥 FRIDAY WARNUNG" : "🚨 FRIDAY KAMERA-WACHE";
  const text = `${TYPEN[typ]?.icon || "•"} ${raum}: ${satz} (${uhr(Date.now())} Uhr)`;
  let gesendet = false;
  if (mitFoto && buf) gesendet = await sendTelegramPhoto(buf, `${titel}\n${text}`);
  if (!gesendet) await notifyAll(titel, text);
  else await notifyAll(titel, text, { ohneTelegram: true });
}

const cache = new Map();
function leseMonat(monat) {
  if (cache.has(monat)) return cache.get(monat);
  let liste = [];
  try {
    liste = fs.readFileSync(path.join(LOG_DIR, `${monat}.jsonl`), "utf8").split("\n").filter(Boolean)
      .map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean);
  } catch { /* leer */ }
  cache.set(monat, liste);
  return liste;
}
const geloescht = () => { try { return new Set(JSON.parse(fs.readFileSync(path.join(LOG_DIR, "geloescht.json"), "utf8"))); } catch { return new Set(); } };

/** Ereignisse, neueste zuerst. */
export function ereignisse({ tag = "", typ = "", kamera = "", limit = 100 } = {}) {
  let monate = [];
  try { monate = fs.readdirSync(LOG_DIR).filter((f) => /^\d{4}-\d{2}\.jsonl$/.test(f)).map((f) => f.slice(0, 7)).sort().reverse(); } catch { return []; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(tag)) monate = monate.filter((m) => m === tag.slice(0, 7));
  const weg = geloescht();
  const raus = [];
  for (const m of monate) {
    const liste = leseMonat(m);
    for (let i = liste.length - 1; i >= 0 && raus.length < limit; i--) {
      const e = liste[i];
      if (weg.has(e.id) || (tag && e.tag !== tag) || (typ && e.typ !== typ) || (kamera && e.kamera !== kamera)) continue;
      raus.push(e);
    }
    if (raus.length >= limit) break;
  }
  return raus;
}

export function ereignisLoeschen(id) {
  const weg = geloescht();
  const e = ereignisse({ limit: 100000 }).find((x) => x.id === id);
  if (!e) return { ok: false };
  weg.add(id);
  fs.writeFileSync(path.join(LOG_DIR, "geloescht.json"), JSON.stringify([...weg].slice(-20000)));
  if (e.bild) { try { fs.unlinkSync(path.join(BILD_DIR, e.bild)); } catch { /* schon weg */ } }
  cache.clear();
  return { ok: true };
}

/** Pfad eines Ereignis-Fotos, nur innerhalb des Wache-Ordners. */
export function bildPfad(rel) {
  if (!/^\d{4}-\d{2}-\d{2}\/[\w-]+\.jpg$/.test(String(rel || ""))) return null;
  const voll = path.join(BILD_DIR, rel);
  return voll.startsWith(BILD_DIR + path.sep) && fs.existsSync(voll) ? voll : null;
}

// ---------- Live-Bild (Geräte-Kamera aus dem Speicher, IP-Kamera frisch geholt) ----------
let ffmpegCache;
function ffmpegPfad() {
  if (ffmpegCache !== undefined) return ffmpegCache;
  const kandidaten = [process.env.FFMPEG_PATH, "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg",
    path.join(os.homedir(), "Friday", ".venv", "bin", "ffmpeg")].filter(Boolean);
  ffmpegCache = kandidaten.find((p) => { try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; } }) || null;
  return ffmpegCache;
}

function rtspBild(url) {
  const ff = ffmpegPfad();
  if (!ff) return Promise.reject(new Error("Für rtsp-Kameras braucht der Mac ffmpeg (Extras installieren)."));
  return new Promise((resolve, reject) => {
    const p = spawn(ff, ["-hide_banner", "-loglevel", "error", "-rtsp_transport", "tcp", "-i", url, "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", "-q:v", "5", "-f", "image2", "-vcodec", "mjpeg", "pipe:1"], { stdio: ["ignore", "pipe", "pipe"] });
    const teile_ = [];
    let groesse = 0;
    const uhrwerk = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("Die Kamera antwortet nicht (Zeitüberschreitung).")); }, 10000);
    p.stdout.on("data", (c) => { groesse += c.length; if (groesse > MAX_BILD) p.kill("SIGKILL"); else teile_.push(c); });
    p.on("error", (err) => { clearTimeout(uhrwerk); reject(err); });
    p.on("close", () => {
      clearTimeout(uhrwerk);
      const buf = Buffer.concat(teile_);
      buf.length > 100 && buf[0] === 0xff ? resolve(buf) : reject(new Error("Kein Bild von der Kamera. Stimmen Adresse, Benutzer und Passwort?"));
    });
  });
}

async function httpBild(url) {
  const u = new URL(url);
  const headers = { "User-Agent": "F.R.Ai.D.A.Y-Kamera-Wache" };
  if (u.username || u.password) {
    headers.Authorization = "Basic " + Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString("base64");
    u.username = ""; u.password = "";
  }
  const r = await fetch(u, { headers, signal: AbortSignal.timeout(6000), redirect: "manual" });
  if (r.status === 401) throw new Error("Die Kamera will Benutzer und Passwort (http://benutzer:passwort@…).");
  if (!r.ok) throw new Error(`Die Kamera antwortet mit Fehler ${r.status}.`);
  const typ = r.headers.get("content-type") || "";
  if (/multipart\/x-mixed-replace/i.test(typ)) return await ersterMjpegFrame(r);
  if (!/image\/(jpeg|jpg)/i.test(typ)) throw new Error("Unter dieser Adresse liegt kein JPEG-Bild. Nimm die Schnappschuss-Adresse der Kamera.");
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_BILD) throw new Error("Das Bild ist zu groß.");
  return buf;
}
// MJPEG-Strom: nur das erste Bild herausschneiden.
async function ersterMjpegFrame(r) {
  const reader = r.body.getReader();
  let puffer = Buffer.alloc(0);
  try {
    while (puffer.length < MAX_BILD) {
      const { value, done } = await reader.read();
      if (done) break;
      puffer = Buffer.concat([puffer, Buffer.from(value)]);
      const start = puffer.indexOf(Buffer.from([0xff, 0xd8]));
      const ende = start >= 0 ? puffer.indexOf(Buffer.from([0xff, 0xd9]), start + 2) : -1;
      if (ende > start) return puffer.subarray(start, ende + 2);
    }
  } finally { reader.cancel().catch(() => {}); }
  throw new Error("Aus dem Video-Strom kam kein Bild.");
}

const ipCache = new Map(); // id -> { at, buf } (kurz, damit zwei Fenster die Kamera nicht doppelt fragen)
export async function liveBild(id) {
  const k = kameraFuer(id);
  if (!k) return null;
  if (k.typ !== "ip") return live.get(id)?.bild || null;
  const c = ipCache.get(id);
  if (c && Date.now() - c.at < 700) return c.buf;
  const buf = /^rtsps?:/.test(k.url) ? await rtspBild(k.url) : await httpBild(k.url);
  ipCache.set(id, { at: Date.now(), buf });
  return buf;
}

export async function kameraTesten(id) {
  try {
    const buf = await liveBild(id);
    return buf ? { ok: true, groesse: buf.length } : { ok: false, error: "Noch kein Bild." };
  } catch (err) { return { ok: false, error: err.message }; }
}

// ---------- "Was passiert gerade?" ----------
const DE = {
  person: ["Person", "Personen"], dog: ["Hund", "Hunde"], cat: ["Katze", "Katzen"], bird: ["Vogel", "Vögel"],
  "cell phone": ["Handy", "Handys"], laptop: ["Laptop", "Laptops"], tv: ["Fernseher", "Fernseher"], chair: ["Stuhl", "Stühle"],
  couch: ["Sofa", "Sofas"], bed: ["Bett", "Betten"], cup: ["Tasse", "Tassen"], bottle: ["Flasche", "Flaschen"],
  book: ["Buch", "Bücher"], backpack: ["Rucksack", "Rucksäcke"], handbag: ["Handtasche", "Handtaschen"], suitcase: ["Koffer", "Koffer"],
  bicycle: ["Fahrrad", "Fahrräder"], car: ["Auto", "Autos"], motorcycle: ["Motorrad", "Motorräder"], "potted plant": ["Pflanze", "Pflanzen"],
  "dining table": ["Tisch", "Tische"], clock: ["Uhr", "Uhren"], keyboard: ["Tastatur", "Tastaturen"], remote: ["Fernbedienung", "Fernbedienungen"],
  umbrella: ["Regenschirm", "Regenschirme"], "teddy bear": ["Teddy", "Teddys"], "wine glass": ["Glas", "Gläser"], bowl: ["Schüssel", "Schüsseln"],
};
export const deName = (k, n = 1) => (DE[k] ? DE[k][n === 1 ? 0 : 1] : k);
const zahlWort = (n) => (["kein", "eine", "zwei", "drei", "vier", "fünf"][n] || String(n));
function zaehle(k, n) {
  const w = deName(k, n);
  if (n === 1) return `${["Hund", "Vogel", "Laptop", "Fernseher", "Stuhl", "Rucksack", "Koffer", "Teddy", "Tisch"].includes(w) ? "ein" : ["Sofa", "Bett", "Buch", "Handy", "Fahrrad", "Auto", "Motorrad", "Glas"].includes(w) ? "ein" : "eine"} ${w}`;
  return `${zahlWort(n)} ${w}`;
}
function liste(teile_) { return teile_.length <= 1 ? teile_.join("") : `${teile_.slice(0, -1).join(", ")} und ${teile_.at(-1)}`; }

function raumSatz(k) {
  const o = k.objekte || {};
  const lebewesen = ["person", "dog", "cat", "bird"].filter((x) => o[x]).map((x) => zaehle(x, o[x]));
  const dinge = Object.keys(o).filter((x) => !["person", "dog", "cat", "bird"].includes(x)).slice(0, 4).map((x) => zaehle(x, o[x]));
  let s;
  if (k.gefahr) s = `${k.name}: Achtung, ${k.gefahr}!`;
  else if (lebewesen.length) s = `${k.name}: Ich sehe ${liste(lebewesen)}${k.bewegung > 5 ? ", da bewegt sich etwas" : ""}.`;
  else if (k.bewegung > 5) s = `${k.name}: Da bewegt sich etwas, aber ich erkenne niemanden.`;
  else s = `${k.name}: Alles ruhig.`;
  if (dinge.length && !k.gefahr) s += ` Außerdem ${liste(dinge)}.`;
  return s;
}

function findeRaum(t, kameras) {
  return kameras.find((k) => {
    const n = k.name.toLowerCase();
    return n.length >= 3 && (t.includes(n) || n.split(/[\s-]+/).some((w) => w.length >= 4 && U(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)).test(t)));
  });
}

export function wasPassiert({ raum } = {}) {
  const u = uebersicht({ mitEreignissen: 0 });
  let kameras = u.kameras;
  if (raum) kameras = kameras.filter((k) => k.id === raum.id);
  const an = kameras.filter((k) => k.online);
  if (!u.kameras.length) return "Ich habe noch keine Kamera. Öffne die Kamera-Wache und tippe auf „Dieses Gerät als Kamera“ oder füge eine IP-Kamera hinzu.";
  if (!an.length) return raum ? `Die Kamera ${raum.name} ist gerade aus. Öffne dort die Kamera-Wache, dann schaue ich nach.` : "Gerade ist keine Kamera an. Öffne auf dem Gerät mit der Kamera die Kamera-Wache.";
  const saetze = an.map(raumSatz);
  const aus = kameras.filter((k) => !k.online).map((k) => k.name);
  if (aus.length && !raum) saetze.push(`Aus: ${liste(aus)}.`);
  const letztes = ereignisse({ limit: 1, ...(raum ? { kamera: raum.id } : {}) }).find((e) => e.typ !== "system");
  if (letztes && Date.now() - letztes.at < 6 * 3600 * 1000) saetze.push(`Zuletzt um ${uhr(letztes.at)}: ${letztes.text}${raum ? "" : ` (${letztes.raum})`}.`);
  if (!raum) saetze.push(u.scharf ? "Die Wache ist scharf." : "Die Wache ist nicht scharf.");
  return saetze.join(" ");
}

export function tagesBericht(tag = tagStr()) {
  const liste_ = ereignisse({ tag, limit: 5000 }).filter((e) => e.typ !== "system");
  const heute = tag === tagStr();
  if (!liste_.length) return heute ? "Heute ist zu Hause nichts Besonderes passiert." : "An dem Tag war alles ruhig.";
  const z = {};
  for (const e of liste_) z[e.typ] = (z[e.typ] || 0) + 1;
  const teile_ = Object.entries(z).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n}× ${TYPEN[t]?.name || t}`);
  const alarme = liste_.filter((e) => e.alarm).length;
  const letzte = liste_[0];
  return `${heute ? "Heute" : "An dem Tag"} habe ich ${liste_.length === 1 ? "ein Ereignis" : `${liste_.length} Ereignisse`} gespeichert: ${liste(teile_)}.${alarme ? ` ${alarme === 1 ? "Ein Alarm ging raus." : `${alarme} Alarme gingen raus.`}` : ""} Zuletzt um ${uhr(letzte.at)}: ${letzte.text} (${letzte.raum}).`;
}

/** "Schau genau hin": Claude beschreibt das aktuelle Bild – ohne Personen zu identifizieren. */
export async function beschreiben({ raumId } = {}) {
  const { denke } = await import("./denker.js");
  const u = uebersicht({ mitEreignissen: 0 });
  const k = (raumId && u.kameras.find((x) => x.id === raumId)) || u.kameras.filter((x) => x.online).sort((a, b) => (b.objekte.person || 0) + b.bewegung / 50 - ((a.objekte.person || 0) + a.bewegung / 50))[0];
  if (!k) return { ok: false, text: "Gerade ist keine Kamera an." };
  let buf = null;
  try { buf = await liveBild(k.id); } catch { /* unten */ }
  if (!buf) return { ok: false, text: `Von der Kamera ${k.name} habe ich gerade kein Bild.` };
  const r = await denke({
    system: "Du bist F.R.Ai.D.A.Y, die Hausassistentin. Du siehst ein Standbild einer privaten Kamera aus dem eigenen Zuhause deines Besitzers. Beschreibe auf Deutsch in höchstens drei kurzen Sätzen, was gerade passiert: Personen (nur allgemein, z. B. 'eine Person sitzt am Tisch'), Tiere, auffällige Gegenstände, offene Türen, Rauch oder Feuer. Erkenne oder errate NIE, wer eine Person ist, und beschreibe keine Gesichter. Wenn nichts los ist, sag das. Klinge ruhig und natürlich, keine Aufzählung.",
    text: `Raum: ${k.name}. Was passiert hier gerade?`,
    image: { mediaType: "image/jpeg", data: buf.toString("base64") },
    stufe: "schnell", maxTokens: 600, quelle: "wache",
  });
  if (!r.ok) return { ok: false, text: r.leer ? "Für eine genaue Beschreibung brauche ich Guthaben. Ohne Claude: " + wasPassiert({ raum: k }) : r.error };
  logbuch.eintragen({ bereich: "wache", titel: `Kamera ${k.name} beschrieben`, claude: true });
  return { ok: true, text: r.text, kamera: k.id };
}

// ---------- Sprachbefehle ohne Claude ----------
const HAUS = /\b(zu ?hause|daheim|in der wohnung|in meiner wohnung|im haus|bei mir|auf den kameras|in den räumen|in den raeumen)\b/;
export async function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/, "").replace(/[!?.]+$/g, "").trim();
  if (!t) return null;
  const d = laden();
  const kameraWort = U(/\b(kamera-?wache|hauswache|wache|überwachung|ueberwachung|alarmanlage|sicherheitskameras?|überwachungskameras?|kameras)\b/).test(t);
  // Fenster öffnen
  if (U(/^(öffne|oeffne|zeig|zeige|starte)( mir)?( die| meine)? (kamera-?wache|hauswache|wache|überwachung|ueberwachung|sicherheitskameras|überwachungskameras|kameras)( an)?$/).test(t)) {
    return { answer: d.kameras.length ? "Die Kamera-Wache ist offen." : "Hier ist die Kamera-Wache. Tippe auf „Dieses Gerät als Kamera“, dann passe ich auf.", actions: ["wache"] };
  }
  // Scharf schalten
  if ((kameraWort && U(/\b(an|ein|einschalten|scharf|aktivieren|aktiviere|starten)\b/).test(t) && !U(/\b(aus|ab|ausschalten|deaktivieren|unscharf|beenden)\b/).test(t) && !/\bwas\b/.test(t))
    || U(/^(pass|passe) (gut )?(auf )?(das haus|die wohnung|mein zuhause|zuhause|zu hause|die bude)( auf)?$|^ich (gehe|geh|bin) (jetzt )?(weg|los|aus dem haus)$/).test(t)) {
    scharfSchalten(true, "sprache");
    const an = uebersicht({ mitEreignissen: 0 }).kameras.filter((k) => k.online);
    return { answer: an.length ? `Wache ist scharf. Ich passe mit ${an.length === 1 ? `der Kamera ${an[0].name}` : `${an.length} Kameras`} auf und melde mich bei Auffälligkeiten.` : "Wache ist scharf. Achtung: Gerade ist keine Kamera an. Öffne die Kamera-Wache auf dem Gerät mit der Kamera.", actions: ["wache_status"] };
  }
  // Ausschalten
  if ((kameraWort && U(/\b(aus|ab|ausschalten|deaktivieren|deaktiviere|unscharf|beenden|stopp)\b/).test(t) && !/\bwas\b/.test(t))
    || U(/^ich bin (wieder )?(da|zu ?hause|zurück|zurueck|daheim)$/).test(t)) {
    if (!d.scharf && !kameraWort) return null;
    scharfSchalten(false, "sprache");
    return { answer: U(/^ich bin/).test(t) ? "Willkommen zurück, Boss. Die Wache ist aus." : "Die Wache ist aus. Die Kameras zeigen weiter live, aber ich schlage keinen Alarm mehr.", actions: ["wache_status"] };
  }
  const u = uebersicht({ mitEreignissen: 0 });
  const raum = findeRaum(t, u.kameras);
  const hausGemeint = U(HAUS).test(t) || raum || kameraWort;
  // Tagesbericht
  if ((U(/^(was ist|was war|gab es was|gab es etwas|ist was|ist etwas)\b.*\b(heute|gestern)\b.*\b(passiert|los|gewesen|vorgefallen)$/).test(t) || U(/\bereignisse\b|was hat die (kamera|wache) (gesehen|bemerkt|gemeldet)/).test(t)) && (hausGemeint || /ereignisse|wache|kamera/.test(t)) && !/\b(welt|nachrichten)\b/.test(t)) {
    const gestern = /\bgestern\b/.test(t);
    return { answer: tagesBericht(gestern ? tagStr(Date.now() - 86400000) : tagStr()), actions: ["wache:ereignisse"] };
  }
  // Genau hinschauen (Claude)
  if (U(/\b(schau|guck|sieh) (mal )?(genau|genauer|richtig) (hin|nach)|beschreib\w* (mir )?(genau |mal )?(was|wie es)/).test(t) && (hausGemeint || u.kameras.some((k) => k.online))) {
    const r = await beschreiben({ raumId: raum?.id });
    return { answer: r.text, actions: r.kamera ? [`wache:${r.kamera}`] : ["wache"] };
  }
  // Ist jemand da? Wo ist die Katze?
  const tier = t.match(U(/\bwo (ist|sind) (der|die|das|mein|meine|unser|unsere)? ?(hund|hunde|katze|katzen|kater)\b/));
  if (tier && u.kameras.length) {
    const key = /hund/.test(tier[3]) ? "dog" : "cat";
    const wo = u.kameras.filter((k) => k.online && k.objekte[key]);
    return { answer: wo.length ? `${key === "dog" ? "Der Hund" : "Die Katze"} ist gerade hier: ${liste(wo.map((k) => k.name))}.` : `Auf keiner Kamera sehe ich gerade ${key === "dog" ? "einen Hund" : "eine Katze"}.`, actions: wo.length ? [`wache:${wo[0].id}`] : ["wache"] };
  }
  if (U(/^(ist|sind) (gerade |jetzt )?(jemand|wer|leute|personen)( gerade| jetzt)? (da|zu ?hause|daheim|in der wohnung|im \S+|in der \S+)$/).test(t) && (hausGemeint || u.kameras.length)) {
    const an = (raum ? [u.kameras.find((k) => k.id === raum.id)] : u.kameras).filter((k) => k?.online);
    if (!an.length) return { answer: "Gerade ist keine Kamera an, darum kann ich es nicht sagen.", actions: ["wache"] };
    const mit = an.filter((k) => k.objekte.person);
    return { answer: mit.length ? `Ja. ${liste(mit.map((k) => `${k.name}: ${zaehle("person", k.objekte.person)}`))}. Wer das ist, erkenne ich bewusst nicht.` : `Ich sehe gerade niemanden${raum ? ` im Raum ${raum.name}` : ""}.`, actions: [`wache:${(mit[0] || an[0]).id}`] };
  }
  // Was passiert gerade?
  const wasFrage = U(/^(was|wie) (passiert|ist los|ist da los|geht|geht vor|tut sich|läuft|laeuft|sieht es aus|siehst du)( da| hier)?( gerade| jetzt| grad)?/).test(t);
  const raumFrage = raum && U(/^(was|wie)\b/).test(t) && U(/\b(los|passiert|vor|aus|tut sich|siehst du)$/).test(t);
  if ((wasFrage || raumFrage) && !/\b(welt|nachrichten|börse|boerse|markt)\b/.test(t)) {
    const nurFrage = U(/^(was|wie) (passiert|ist los|ist hier los|geht|geht hier vor|tut sich|läuft|laeuft)( hier)?( gerade| jetzt| grad)?$/).test(t);
    if (raumFrage || hausGemeint || (nurFrage && u.kameras.some((k) => k.online))) {
      return { answer: wasPassiert({ raum }), actions: raum ? [`wache:${raum.id}`] : ["wache_status"] };
    }
  }
  // "Zeig mir das Wohnzimmer" (nur wenn es eine Kamera mit dem Namen gibt)
  if (raum && U(/^(zeig|zeige|öffne|oeffne)( mir)?( die kamera| die kamera im| die kamera in der| das| den| die)? /).test(t)) {
    return { answer: wasPassiert({ raum }), actions: [`wache:${raum.id}`] };
  }
  return null;
}

/** Telegram: "Foto vom Wohnzimmer", "/kamera", "zeig mir die Kameras" → aktuelles Bild statt Text. */
export async function telegramFoto(text) {
  const t = String(text || "").toLowerCase().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/, "").replace(/[!?.]+$/g, "").trim();
  if (!t) return null;
  const u = uebersicht({ mitEreignissen: 0 });
  if (!u.kameras.length) return null;
  const raum = findeRaum(t, u.kameras);
  const fotoWort = U(/^\/(kamera|wache|foto)\b|\b(foto|bild|livebild|schnappschuss)\b/).test(t) && (raum || U(/\b(kamera|kameras|zu ?hause|daheim|wohnung|wache)\b/).test(t) || /^\//.test(t));
  if (!fotoWort) return null;
  const k = raum || u.kameras.filter((x) => x.online).sort((a, b) => (b.objekte.person || 0) + b.bewegung - (a.objekte.person || 0) - a.bewegung)[0];
  if (!k) return { text: "Gerade ist keine Kamera an." };
  try {
    const buf = await liveBild(k.id);
    if (buf) return { buf, caption: `📷 ${k.name} · ${uhr(Date.now())} Uhr\n${raumSatz(k)}` };
  } catch { /* unten */ }
  return { text: `Von der Kamera ${k.name} habe ich gerade kein Bild.` };
}

// ---------- Hintergrund: Kamera aus? Alte Fotos weg ----------
function pruefeOffline() {
  const d = laden();
  if (!d.scharf) return;
  for (const k of d.kameras) {
    const l = live.get(k.id);
    if (!l || l.offlineGemeldet) continue;
    if (Date.now() - l.at > OFFLINE_ALARM_MS) {
      l.offlineGemeldet = true;
      const satz = "Die Kamera sendet nichts mehr (Strom, WLAN oder Fenster zu?)";
      schreibe({ kamera: k.id, raum: k.name, typ: "offline", text: satz, ...(d.alarmBei.offline ? { alarm: true } : {}) });
      logbuch.eintragen({ bereich: "wache", titel: `📵 ${k.name}: Kamera aus`, ok: false });
      if (d.alarmBei.offline) schlageAlarm({ raum: k.name, typ: "offline", satz }).catch(() => {});
    }
  }
}

export function aufraeumen() {
  const tage = laden().aufbewahrenTage || 7;
  const grenze = tagStr(Date.now() - tage * 86400000);
  try {
    for (const ordner of fs.readdirSync(BILD_DIR)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(ordner) && ordner < grenze) fs.rmSync(path.join(BILD_DIR, ordner), { recursive: true, force: true });
    }
  } catch { /* Ordner gibt es noch nicht */ }
}

export function wacheStart() {
  setInterval(pruefeOffline, 30 * 1000).unref?.();
  setTimeout(aufraeumen, 90 * 1000).unref?.();
  setInterval(aufraeumen, 6 * 3600 * 1000).unref?.();
}

// ---------- Routen ----------
export function wacheRouten(app, asyncRoute) {
  const fehler = (res, err) => res.status(err.status || 500).json({ error: err.message || "Fehler" });
  app.get("/api/wache", (req, res) => res.json(uebersicht({ mitEreignissen: 40 })));
  app.post("/api/wache/scharf", (req, res) => res.json(scharfSchalten(Boolean(req.body?.an))));
  app.post("/api/wache/einstellungen", (req, res) => res.json(setzeEinstellungen(req.body || {})));
  app.post("/api/wache/station", (req, res) => res.json(station({ id: String(req.body?.id || ""), name: req.body?.name })));
  app.post("/api/wache/kamera", (req, res) => { try { res.json(kameraSpeichern(req.body || {})); } catch (err) { fehler(res, err); } });
  app.delete("/api/wache/kamera/:id", (req, res) => res.json(kameraLoeschen(req.params.id)));
  app.post("/api/wache/kamera/:id/test", asyncRoute(async (req, res) => res.json(await kameraTesten(req.params.id))));
  app.post("/api/wache/status", (req, res) => res.json(status({ ...(req.body || {}), id: String(req.body?.id || "") })));
  app.post("/api/wache/ereignis", asyncRoute(async (req, res) => { try { res.json(await ereignis({ ...(req.body || {}), id: String(req.body?.id || "") })); } catch (err) { fehler(res, err); } }));
  app.get("/api/wache/ereignisse", (req, res) => {
    const q = req.query || {};
    const s = (v) => (typeof v === "string" ? v : "");
    res.json({ ereignisse: ereignisse({ tag: s(q.tag), typ: s(q.typ), kamera: s(q.kamera), limit: Math.min(500, Number(q.limit) || 100) }), bericht: tagesBericht(/^\d{4}-\d{2}-\d{2}$/.test(s(q.tag)) ? s(q.tag) : tagStr()) });
  });
  app.delete("/api/wache/ereignis/:id", (req, res) => res.json(ereignisLoeschen(req.params.id)));
  app.get(/^\/api\/wache\/bild\/(\d{4}-\d{2}-\d{2}\/[\w-]+\.jpg)$/, (req, res) => {
    const p = bildPfad(req.params[0]);
    if (!p) return res.status(404).json({ error: "Nicht gefunden" });
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.type("image/jpeg").sendFile(p);
  });
  app.get("/api/wache/live/:id", asyncRoute(async (req, res) => {
    try {
      const buf = await liveBild(req.params.id);
      if (!buf) return res.status(204).end(); // noch kein Bild (kein Fehler)
      res.setHeader("Cache-Control", "no-store");
      res.type("image/jpeg").send(buf);
    } catch (err) { res.status(502).json({ error: err.message }); }
  }));
  app.get("/api/wache/jetzt", (req, res) => res.json({ text: wasPassiert(), bericht: tagesBericht() }));
  app.post("/api/wache/beschreiben", asyncRoute(async (req, res) => res.json(await beschreiben({ raumId: String(req.body?.id || "") }))));
}

// Für Tests
export function _zuruecksetzen() { daten = null; live.clear(); letzteAlarme.clear(); letzteEreignisse.clear(); cache.clear(); }
