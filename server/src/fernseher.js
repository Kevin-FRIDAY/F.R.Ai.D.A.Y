// Fridays Fernbedienung für Samsung-Smart-TVs (Tizen, etwa ab 2016).
// Alles läuft direkt im Heim-WLAN, ohne Cloud und ohne Home Assistant:
//  - Suchen:      SSDP-Rundruf, sonst Scan des eigenen Netzes (Port 8001)
//  - Koppeln:     beim ersten Mal fragt der Fernseher "Zulassen?" – danach merkt sich Friday den Schlüssel
//  - Befehle:     Tasten (Lautstärke, Sender, Pfeile …) über die Fernbedienungs-Schnittstelle (wss, Port 8002)
//  - Apps:        Netflix, YouTube & Co. per App-ID starten
//  - Einschalten: aus dem Standby per Wake-on-LAN (braucht "Über Mobilgerät einschalten" am TV)
// Gespeichert wird in data/fernseher.json (gehört dir, Updates fassen den Ordner nicht an).
import dgram from "node:dgram";
import os from "node:os";
import WebSocket from "ws";
import * as store from "./store.js";
import { IST_EVE } from "./config.js";

// Ports lassen sich nur für Tests verstellen (echter Fernseher: 8001/8002).
const HTTP_PORT = Number(process.env.TV_HTTP_PORT || 8001);
const WSS_PORT = Number(process.env.TV_WSS_PORT || 8002);
const APP_NAME = Buffer.from("Friday").toString("base64");

// --- Gespeicherter Fernseher ---
const FILE = "fernseher";
export function getTv() {
  return store.load(FILE, null);
}
function saveTv(patch) {
  const tv = { ...(getTv() || {}), ...patch };
  store.save(FILE, tv);
  return tv;
}
export function tvConfigured() {
  return Boolean(getTv()?.ip);
}
export function tvPaired() {
  const tv = getTv();
  return Boolean(tv?.ip && tv.gekoppelt);
}

// --- Tasten & Apps ---
// Freundliche Namen -> Samsung-Tastencodes.
export const KEYS = {
  power: "KEY_POWER", lauter: "KEY_VOLUP", leiser: "KEY_VOLDOWN", stumm: "KEY_MUTE",
  sender_hoch: "KEY_CHUP", sender_runter: "KEY_CHDOWN", sender_vorher: "KEY_PRECH",
  hoch: "KEY_UP", runter: "KEY_DOWN", links: "KEY_LEFT", rechts: "KEY_RIGHT", ok: "KEY_ENTER",
  zurueck: "KEY_RETURN", home: "KEY_HOME", menue: "KEY_MENU", info: "KEY_INFO", guide: "KEY_GUIDE", exit: "KEY_EXIT",
  quelle: "KEY_SOURCE", hdmi: "KEY_HDMI", hdmi1: "KEY_HDMI1", hdmi2: "KEY_HDMI2", hdmi3: "KEY_HDMI3", hdmi4: "KEY_HDMI4", tv: "KEY_TV",
  play: "KEY_PLAY", pause: "KEY_PAUSE", stop: "KEY_STOP", vor: "KEY_FF", zurueckspulen: "KEY_REWIND",
};
for (let i = 0; i <= 9; i++) KEYS[String(i)] = `KEY_${i}`;

// Bekannte App-IDs (mehrere pro App, weil Samsung sie je nach Baujahr ändert).
export const APPS = {
  netflix: { name: "Netflix", ids: ["3201907018807", "11101200001"] },
  youtube: { name: "YouTube", ids: ["111299001912"] },
  prime: { name: "Prime Video", ids: ["3201910019365", "3201512006785"] },
  disney: { name: "Disney+", ids: ["3201901017640"] },
  spotify: { name: "Spotify", ids: ["3201606009684"] },
  appletv: { name: "Apple TV", ids: ["3201807016597"] },
  plex: { name: "Plex", ids: ["3201512006963"] },
  browser: { name: "Internet", ids: ["org.tizen.browser", "3201907018784"] },
};
const APP_ALIASES = {
  netflix: "netflix", youtube: "youtube", "you tube": "youtube",
  prime: "prime", "prime video": "prime", "amazon prime": "prime", "amazon": "prime", "amazon prime video": "prime",
  disney: "disney", "disney+": "disney", "disney plus": "disney",
  spotify: "spotify", "apple tv": "appletv", "apple tv+": "appletv", appletv: "appletv", plex: "plex",
  browser: "browser", internet: "browser",
};
export function findApp(name) {
  const k = String(name || "").toLowerCase().replace(/[^a-z0-9+ ]/g, " ").replace(/\s+/g, " ").trim();
  return APPS[APP_ALIASES[k]] || null;
}

// --- Netz-Helfer ---
async function httpJson(url, opts = {}) {
  const res = await fetch(url, { method: opts.method || "GET", signal: AbortSignal.timeout(opts.timeout || 2500) });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* kein JSON */ }
  return { status: res.status, ok: res.ok, body };
}

// Fragt den Fernseher nach Name/Modell/MAC/Zustand. null = nicht erreichbar.
export async function tvInfo(ip, timeout = 2500) {
  try {
    const r = await httpJson(`http://${ip}:${HTTP_PORT}/api/v2/`, { timeout });
    const d = r.body?.device;
    if (!d) return null;
    return {
      ip,
      name: String(d.name || r.body?.name || "Samsung TV").replace(/^\[TV\]\s*/, ""),
      modell: d.modelName || d.model || "",
      mac: d.wifiMac || "",
      // Neuere Geräte melden "on" oder "standby", ältere gar nichts (dann gilt: an).
      zustand: d.PowerState || "on",
      tokenNoetig: String(d.TokenAuthSupport) === "true",
    };
  } catch {
    return null;
  }
}

// Eigene IPv4-Netze (für Scan und Wake-on-LAN-Rundruf).
function localNets() {
  const nets = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) {
      if (n.family !== "IPv4" || n.internal) continue;
      const [a, b, c] = n.address.split(".").map(Number);
      if (a === 169 && b === 254) continue; // keine Selbst-Adresse
      if (a === 100 && b >= 64 && b <= 127) continue; // Tailscale
      nets.push({ address: n.address, prefix: `${a}.${b}.${c}`, broadcast: `${a}.${b}.${c}.255` });
    }
  }
  return nets;
}

// SSDP: Samsung-Fernseher melden sich auf diese Suchanfrage.
function ssdpSearch(ms = 2500) {
  return new Promise((resolve) => {
    const found = new Set();
    let sock;
    try { sock = dgram.createSocket({ type: "udp4", reuseAddr: true }); } catch { return resolve([]); }
    const done = () => { try { sock.close(); } catch { /* egal */ } resolve([...found]); };
    sock.on("error", done);
    sock.on("message", (msg, rinfo) => {
      const t = msg.toString();
      if (/samsung/i.test(t)) found.add(rinfo.address);
    });
    sock.bind(() => {
      const q = Buffer.from(
        "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\n" +
        "ST: urn:samsung.com:device:RemoteControlReceiver:1\r\n\r\n",
      );
      for (let i = 0; i < 2; i++) sock.send(q, 1900, "239.255.255.250", () => {});
    });
    setTimeout(done, ms);
  });
}

// Sucht Samsung-Fernseher im WLAN. Gibt eine Liste mit Name/IP zurück.
export async function discover() {
  const ips = new Set(await ssdpSearch());
  // Kein SSDP-Treffer: das eigene Netz kurz abklopfen (254 Adressen, parallel).
  if (!ips.size) {
    for (const net of localNets().slice(0, 2)) {
      const cand = [];
      for (let i = 1; i < 255; i++) { const ip = `${net.prefix}.${i}`; if (ip !== net.address) cand.push(ip); }
      for (let i = 0; i < cand.length; i += 64) {
        const hits = await Promise.all(cand.slice(i, i + 64).map((ip) => tvInfo(ip, 900)));
        hits.filter(Boolean).forEach((h) => ips.add(h.ip));
      }
    }
  }
  const list = (await Promise.all([...ips].map((ip) => tvInfo(ip)))).filter(Boolean);
  return list;
}

// --- Verbindung zur Fernbedienungs-Schnittstelle ---
// Eine Verbindung bleibt kurz offen, damit mehrere Tasten hintereinander schnell gehen.
let conn = null; // { ws, ip, ready: Promise, timer }
const IDLE_MS = 45000;

function closeConn() {
  if (!conn) return;
  clearTimeout(conn.timer);
  try { conn.ws.close(); } catch { /* egal */ }
  conn = null;
}

function openSocket(ip, { secure = true, token, waitMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const proto = secure ? "wss" : "ws";
    const port = secure ? WSS_PORT : HTTP_PORT;
    const url = `${proto}://${ip}:${port}/api/v2/channels/samsung.remote.control?name=${APP_NAME}${token ? `&token=${encodeURIComponent(token)}` : ""}`;
    // Samsung nutzt ein selbst ausgestelltes Zertifikat – im eigenen WLAN ist das normal.
    const ws = new WebSocket(url, { rejectUnauthorized: false, handshakeTimeout: 4000 });
    let settled = false;
    const finish = (err, val) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) { try { ws.terminate(); } catch { /* egal */ } reject(err); } else resolve(val);
    };
    const timer = setTimeout(() => finish(Object.assign(new Error("Zeitüberschreitung"), { code: "TIMEOUT" })), waitMs);
    ws.on("message", (raw) => {
      let m;
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.event === "ms.channel.connect") finish(null, { ws, token: m.data?.token || null });
      else if (m.event === "ms.channel.unauthorized") finish(Object.assign(new Error("Nicht erlaubt"), { code: "DENIED" }));
      else if (m.event === "ms.channel.timeOut") finish(Object.assign(new Error("Keine Antwort am Fernseher"), { code: "TIMEOUT" }));
    });
    ws.on("error", (err) => finish(err));
    ws.on("close", () => finish(Object.assign(new Error("Verbindung geschlossen"), { code: "CLOSED" })));
  });
}

async function connect({ waitMs } = {}) {
  if (IST_EVE) throw Object.assign(new Error("Eve-Testmodus"), { code: "EVE" });
  const tv = getTv();
  if (!tv?.ip) throw Object.assign(new Error("Noch kein Fernseher eingerichtet."), { code: "NOTV" });
  if (conn && conn.ip === tv.ip && conn.ws.readyState === WebSocket.OPEN) {
    clearTimeout(conn.timer);
    conn.timer = setTimeout(closeConn, IDLE_MS);
    return conn.ws;
  }
  closeConn();
  let r;
  if (tv.alt) {
    r = await openSocket(tv.ip, { secure: false, waitMs });
  } else {
    try {
      r = await openSocket(tv.ip, { secure: true, token: tv.token, waitMs });
    } catch (err) {
      // Ältere Geräte (2016/2017) haben nur die unverschlüsselte Schnittstelle ohne Schlüssel.
      if (err.code !== "ECONNREFUSED") throw err;
      r = await openSocket(tv.ip, { secure: false, waitMs });
      saveTv({ alt: true });
    }
  }
  if (r.token && r.token !== tv.token) saveTv({ token: r.token });
  if (!tv.gekoppelt) saveTv({ gekoppelt: new Date().toISOString() });
  const ws = r.ws;
  ws.on("close", () => { if (conn?.ws === ws) conn = null; });
  ws.on("error", () => {});
  conn = { ws, ip: tv.ip, timer: setTimeout(closeConn, IDLE_MS) };
  return ws;
}

function sendKeyRaw(ws, code) {
  ws.send(JSON.stringify({
    method: "ms.remote.control",
    params: { Cmd: "Click", DataOfCmd: code, Option: "false", TypeOfRemote: "SendRemoteKey" },
  }));
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Freundliche Fehlermeldung zum Vorlesen.
function friendly(err) {
  if (err.code === "EVE") return "Eve-Testmodus: Der Fernseher wurde NICHT gesteuert. Das macht nur Friday.";
  if (err.code === "NOTV") return "Ich kenne noch keinen Fernseher. Öffne im Werkzeug-Menü die Fernbedienung und such ihn einmal.";
  if (err.code === "DENIED") return "Der Fernseher hat Friday abgelehnt. Drück beim nächsten Versuch am Fernseher auf Zulassen.";
  if (err.code === "TIMEOUT") return "Der Fernseher hat nicht geantwortet. Wenn eine Frage auf dem Bildschirm steht, drück Zulassen.";
  if (err.code === "CLOSED" || /ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|socket hang up|fetch failed/i.test(`${err.code} ${err.message}`))
    return "Der Fernseher ist nicht erreichbar. Ist er an und im selben WLAN wie der Mac?";
  return `Fernseher-Fehler: ${err.message}`;
}

// --- Öffentliche Befehle ---
// Koppeln: baut die erste Verbindung auf und wartet bis zu 30 Sekunden auf "Zulassen" am TV.
export async function pair(ip) {
  const target = String(ip || getTv()?.ip || "").trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(target)) return { ok: false, error: "Bitte eine gültige IP-Adresse eintragen, z. B. 192.168.178.40." };
  const info = await tvInfo(target, 3000);
  if (!info) return { ok: false, error: "Unter dieser Adresse antwortet kein Samsung-Fernseher. Ist er an und im selben WLAN?" };
  const old = getTv();
  const sameTv = old?.ip === target;
  saveTv({ ip: target, name: info.name, modell: info.modell, mac: info.mac || old?.mac || "", token: sameTv ? old.token : null, alt: sameTv ? old.alt : false, gekoppelt: sameTv ? old.gekoppelt : null });
  closeConn();
  try {
    await connect({ waitMs: 30000 });
    return { ok: true, fernseher: publicTv(), text: `Verbunden mit ${info.name}.` };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export function forget() {
  closeConn();
  store.save(FILE, null);
  return { ok: true };
}

export async function sendKeys(names, { repeat = 1 } = {}) {
  const codes = [];
  const n = Math.max(1, Math.min(Number(repeat) || 1, 30));
  for (const name of [].concat(names)) {
    const code = KEYS[String(name).toLowerCase()] || (/^KEY_[A-Z0-9_]+$/.test(name) ? name : null);
    if (!code) return { ok: false, error: `Unbekannte Taste "${name}".` };
    for (let i = 0; i < n; i++) codes.push(code);
  }
  try {
    const ws = await connect();
    for (let i = 0; i < codes.length; i++) {
      sendKeyRaw(ws, codes[i]);
      if (i < codes.length - 1) await pause(codes.length > 6 ? 120 : 250);
    }
    return { ok: true, tasten: codes.length };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

// Wake-on-LAN: "Magisches Paket" an die MAC-Adresse des Fernsehers.
function wakeOnLan(mac) {
  const hex = String(mac || "").replace(/[^0-9a-f]/gi, "");
  if (hex.length !== 12) return Promise.resolve(false);
  const macBuf = Buffer.from(hex, "hex");
  const pkt = Buffer.alloc(6 + 16 * 6, 0xff);
  for (let i = 0; i < 16; i++) macBuf.copy(pkt, 6 + i * 6);
  const targets = ["255.255.255.255", ...localNets().map((n) => n.broadcast)];
  return new Promise((resolve) => {
    const sock = dgram.createSocket("udp4");
    sock.on("error", () => { try { sock.close(); } catch { /* egal */ } resolve(false); });
    sock.bind(() => {
      sock.setBroadcast(true);
      let left = targets.length * 2 * 3;
      const sent = () => { if (--left <= 0) { sock.close(); resolve(true); } };
      for (let round = 0; round < 3; round++) for (const t of targets) for (const port of [9, 7]) sock.send(pkt, port, t, sent);
    });
  });
}

export async function powerOn() {
  if (IST_EVE) return { ok: false, error: friendly({ code: "EVE" }) };
  const tv = getTv();
  if (!tv?.ip) return { ok: false, error: friendly({ code: "NOTV" }) };
  const info = await tvInfo(tv.ip, 1500);
  if (info && info.zustand === "on") return { ok: true, text: "Der Fernseher ist schon an." };
  if (info && info.zustand === "standby") {
    // Netzwerk-Standby: die Power-Taste weckt ihn.
    const r = await sendKeys("power");
    if (r.ok) return { ok: true, text: "Fernseher wird eingeschaltet." };
  }
  if (!tv.mac) return { ok: false, error: "Ich kenne die MAC-Adresse des Fernsehers noch nicht. Schalte ihn einmal von Hand ein und tipp in der Fernbedienung auf Suchen." };
  closeConn();
  const sent = await wakeOnLan(tv.mac);
  if (!sent) return { ok: false, error: "Das Weck-Signal ließ sich nicht senden." };
  // Bis zu 12 Sekunden warten, ob er aufwacht.
  for (let i = 0; i < 8; i++) {
    await pause(1500);
    const s = await tvInfo(tv.ip, 1200);
    if (s && s.zustand !== "standby") return { ok: true, text: "Fernseher ist an." };
  }
  return { ok: true, text: "Weck-Signal gesendet. Falls er aus bleibt: am Fernseher unter Einstellungen, Allgemein, Netzwerk, Experten-Einstellungen 'Über Mobilgerät einschalten' aktivieren." };
}

export async function powerOff() {
  const tv = getTv();
  if (!tv?.ip) return { ok: false, error: friendly({ code: "NOTV" }) };
  const info = await tvInfo(tv.ip, 1500);
  if (!info || info.zustand === "standby") return { ok: true, text: "Der Fernseher ist schon aus." };
  const r = await sendKeys("power");
  if (r.ok) closeConn();
  return r.ok ? { ok: true, text: "Fernseher ist aus." } : r;
}

// Einen Sender per Nummer wählen (z. B. 1 = Das Erste).
export async function channel(num) {
  const digits = String(num ?? "").replace(/\D/g, "").slice(0, 4);
  if (!digits) return { ok: false, error: "Welche Sendernummer?" };
  const r = await sendKeys([...digits.split(""), "ok"]);
  return r.ok ? { ok: true, text: `Sender ${digits}.` } : r;
}

// Installierte Apps vom Fernseher holen (nicht jedes Modell antwortet).
async function installedApps() {
  try {
    const ws = await connect();
    return await new Promise((resolve) => {
      const onMsg = (raw) => {
        let m;
        try { m = JSON.parse(raw.toString()); } catch { return; }
        if (m.event === "ed.installedApp.get") { cleanup(); resolve(m.data?.data || []); }
      };
      const cleanup = () => { clearTimeout(t); ws.off("message", onMsg); };
      const t = setTimeout(() => { cleanup(); resolve([]); }, 2500);
      ws.on("message", onMsg);
      ws.send(JSON.stringify({ method: "ms.channel.emit", params: { event: "ed.installedApp.get", to: "host" } }));
    });
  } catch {
    return [];
  }
}

export async function openApp(name) {
  if (IST_EVE) return { ok: false, error: friendly({ code: "EVE" }) };
  const tv = getTv();
  if (!tv?.ip) return { ok: false, error: friendly({ code: "NOTV" }) };
  const known = findApp(name);
  let ids = known ? [...known.ids] : [];
  let label = known?.name || String(name || "").trim();
  if (!label) return { ok: false, error: "Welche App soll ich öffnen?" };
  // Ist der Fernseher aus? Dann erst einschalten und kurz hochfahren lassen.
  const info = await tvInfo(tv.ip, 1500);
  if (!info || info.zustand === "standby") {
    const on = await powerOn();
    if (!on.ok) return on;
    await pause(4000);
  }
  // Unbekannte App (oder um die passende ID zu finden): in der App-Liste des Fernsehers nachsehen.
  const list = await installedApps();
  const hit = list.find((a) => known ? ids.includes(String(a.appId)) : String(a.name || "").toLowerCase().includes(label.toLowerCase()));
  if (hit) { ids = [String(hit.appId), ...ids.filter((i) => i !== String(hit.appId))]; label = known?.name || hit.name; }
  if (!ids.length) return { ok: false, error: `Die App "${label}" finde ich auf dem Fernseher nicht.` };
  // 1. Weg: über die REST-Schnittstelle (meldet zurück, ob es die App gibt).
  for (const id of ids) {
    try {
      const r = await httpJson(`http://${tv.ip}:${HTTP_PORT}/api/v2/applications/${encodeURIComponent(id)}`, { method: "POST", timeout: 3000 });
      if (r.ok) return { ok: true, text: `${label} startet.` };
    } catch { /* nächster Weg */ }
  }
  // 2. Weg: über die Fernbedienungs-Verbindung.
  try {
    const ws = await connect();
    ws.send(JSON.stringify({
      method: "ms.channel.emit",
      params: { event: "ed.apps.launch", to: "host", data: { appId: ids[0], action_type: /^\d+$/.test(ids[0]) ? "DEEP_LINK" : "NATIVE_LAUNCH" } },
    }));
    return { ok: true, text: `${label} startet.` };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export function publicTv() {
  const tv = getTv();
  if (!tv?.ip) return null;
  return { ip: tv.ip, name: tv.name, modell: tv.modell, mac: Boolean(tv.mac), gekoppelt: Boolean(tv.gekoppelt), seit: tv.gekoppelt || null };
}

export async function status() {
  const tv = publicTv();
  if (!tv) return { eingerichtet: false };
  const info = await tvInfo(tv.ip, 1500);
  // Neue MAC-Adresse gleich merken (wichtig fürs Einschalten).
  if (info?.mac && info.mac !== getTv()?.mac) saveTv({ mac: info.mac });
  return { eingerichtet: true, ...publicTv(), erreichbar: Boolean(info), zustand: info ? info.zustand : "aus" };
}

// Ein Befehl für alles (Claude-Werkzeug, Sprache, Dashboard).
//   action: an | aus | lauter | leiser | stumm | sender_hoch | sender_runter | sender | app | taste | status
export async function command({ action, value, anzahl } = {}) {
  switch (action) {
    case "an": return powerOn();
    case "aus": return powerOff();
    case "lauter": case "leiser": {
      const n = Math.max(1, Math.min(Number(anzahl) || 3, 20));
      const r = await sendKeys(action, { repeat: n });
      return r.ok ? { ok: true, text: action === "lauter" ? "Lauter." : "Leiser." } : r;
    }
    case "stumm": { const r = await sendKeys("stumm"); return r.ok ? { ok: true, text: "Ton umgeschaltet." } : r; }
    case "sender_hoch": case "sender_runter": {
      const r = await sendKeys(action, { repeat: Math.max(1, Math.min(Number(anzahl) || 1, 20)) });
      return r.ok ? { ok: true, text: "Sender gewechselt." } : r;
    }
    case "sender": return channel(value);
    case "app": return openApp(value);
    case "taste": { const r = await sendKeys(String(value || ""), { repeat: anzahl }); return r.ok ? { ok: true, text: "Erledigt." } : r; }
    case "status": return { ok: true, ...(await status()) };
    default: return { ok: false, error: `Unbekannte Fernseher-Aktion "${action}".` };
  }
}

// --- Schnellbefehle ohne Claude (funktionieren auch, wenn das Guthaben leer ist) ---
// Gibt null zurück, wenn der Satz nicht klar den Fernseher meint.
const NUM_WORDS = { zwei: 2, drei: 3, vier: 4, "fünf": 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, "zwölf": 12, zwanzig: 20 };

export function parseTvCommand(text) {
  if (!tvConfigured()) return null;
  let t = ` ${String(text || "").toLowerCase().replace(/[.,!?;:"']/g, " ").replace(/\s+/g, " ").trim()} `;
  t = t.replace(/^ (hey |hallo |ok )?(friday|freitag) /, " ");
  // Ganze Wörter prüfen (Leerzeichen als Grenze, klappt auch mit Umlauten).
  const has = (...words) => words.some((w) => t.includes(` ${w} `));
  const tvWord = has("fernseher", "fernsehen", "tv", "glotze", "flimmerkiste");
  const appMatch = Object.keys(APP_ALIASES).sort((a, b) => b.length - a.length).find((a) => t.includes(` ${a} `));
  const zahl = () => {
    const m = t.match(/ (?:um )?(\d{1,2}) /);
    if (m) return Number(m[1]);
    const w = Object.keys(NUM_WORDS).find((k) => has(k));
    return w ? NUM_WORDS[w] : null;
  };

  // App starten: "mach Netflix an", "starte YouTube auf dem Fernseher", "Netflix auf dem TV".
  // "Öffne Netflix" ohne Fernseher-Wort bleibt beim Mac.
  if (appMatch && (tvWord || (has("mach", "mache", "schalt", "schalte") && t.endsWith(" an ")))) return { action: "app", value: appMatch };

  if (!tvWord) return null;
  if (has("stumm", "mute") || t.includes(" ton aus ") || t.includes(" ton an ")) return { action: "stumm" };
  if (has("lauter")) return { action: "lauter", anzahl: zahl() || 3 };
  if (has("leiser")) return { action: "leiser", anzahl: zahl() || 3 };
  const ch = t.match(/ (?:sender|kanal|programm)(?: nummer)? (\d{1,4}) /);
  if (ch) return { action: "sender", value: ch[1] };
  if (/ (nächster|naechster|nächste|naechste|nächsten|naechsten) (sender|kanal|programm) | (sender|kanal|programm) (hoch|weiter|vor) /.test(t)) return { action: "sender_hoch" };
  if (/ (vorheriger|vorherige|vorherigen|letzter|letzte|letzten) (sender|kanal|programm) | (sender|kanal|programm) (runter|zurück|zurueck) /.test(t)) return { action: "sender_runter" };
  const hdmi = t.match(/ hdmi ?([1-4]) /);
  if (hdmi) return { action: "taste", value: `hdmi${hdmi[1]}` };
  if (has("pause", "pausieren", "anhalten")) return { action: "taste", value: "pause" };
  if (has("play", "abspielen", "fortsetzen")) return { action: "taste", value: "play" };
  if (has("quelle", "eingang")) return { action: "taste", value: "quelle" };
  if (has("startseite", "home")) return { action: "taste", value: "home" };
  if (has("aus", "ausschalten", "ausmachen", "abschalten")) return { action: "aus" };
  if (has("an", "ein", "einschalten", "anmachen", "anschalten")) return { action: "an" };
  if (has("status")) return { action: "status" };
  return null;
}

// Für Friday: führt einen erkannten Schnellbefehl aus und liefert den Satz zum Vorlesen.
export async function quickCommand(text) {
  const cmd = parseTvCommand(text);
  if (!cmd) return null;
  const r = await command(cmd);
  if (cmd.action === "status") return r.erreichbar ? `${r.name} ist ${r.zustand === "standby" ? "aus" : "an"}.` : "Der Fernseher ist aus oder nicht erreichbar.";
  return r.ok ? r.text || "Erledigt, Boss." : r.error;
}
