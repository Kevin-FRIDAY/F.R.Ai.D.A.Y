// Fritz!Box-Status (v1.160.0, Wunsch aus der Ideen-Schmiede).
// "Friday, ist das Internet langsam?" – Verbindung, Geschwindigkeit der Leitung, aktueller Durchsatz,
// Online-Zeit, Gäste-WLAN (Name + Passwort zum Weitergeben) und Gäste-WLAN an/aus.
// Technik: TR-064 bzw. UPnP der Fritz!Box im eigenen Netz (http://fritz.box:49000). Die Leitungswerte
// gehen ohne Anmeldung; Gäste-WLAN und Box-Infos brauchen einen Fritz!Box-Benutzer mit Passwort
// (Fritz!Box → System → FRITZ!Box-Benutzer). Zugang liegt in data/verbindungen.json ("fritzbox").
import crypto from "node:crypto";
import * as verb from "./verbindungen.js";
import * as logbuch from "./logbuch.js";
import { U } from "./datum.js";
import { sauber } from "./wunsch-hilfe.js";

const cfg = () => ({ url: process.env.FRITZBOX_URL || "http://fritz.box:49000", benutzer: "", passwort: "", ...verb.get("fritzbox") });
export const mitZugang = () => Boolean(cfg().passwort);
export function einrichten({ url, benutzer = "", passwort = "" } = {}) {
  const u = String(url || "").trim().replace(/\/+$/, "") || "http://fritz.box:49000";
  if (!/^https?:\/\/[\w.\-[\]:]+$/.test(u)) throw new Error("Adresse bitte wie http://fritz.box:49000 angeben.");
  verb.set("fritzbox", { url: u, benutzer: String(benutzer).slice(0, 60), passwort: passwort ? String(passwort).slice(0, 120) : cfg().passwort || undefined });
  return { url: u, mitZugang: mitZugang() };
}

// ---------- SOAP ----------
const wert = (xml, tag) => { const m = String(xml).match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return m ? m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'") : ""; };
const umschlag = (service, aktion, args = {}) => `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:${aktion} xmlns:u="${service}">${Object.entries(args).map(([k, v]) => `<${k}>${String(v).replace(/[<&>]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;" }[c]))}</${k}>`).join("")}</u:${aktion}></s:Body></s:Envelope>`;

function digestKopf(www, { benutzer, passwort, methode, pfad }) {
  const p = Object.fromEntries([...www.matchAll(/(\w+)="?([^",]+)"?/g)].map((m) => [m[1], m[2]]));
  const nc = "00000001", cnonce = crypto.randomBytes(8).toString("hex");
  const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
  const ha1 = md5(`${benutzer}:${p.realm}:${passwort}`);
  const ha2 = md5(`${methode}:${pfad}`);
  const antwort = p.qop ? md5(`${ha1}:${p.nonce}:${nc}:${cnonce}:auth:${ha2}`) : md5(`${ha1}:${p.nonce}:${ha2}`);
  return `Digest username="${benutzer}", realm="${p.realm}", nonce="${p.nonce}", uri="${pfad}", response="${antwort}"${p.qop ? `, qop=auth, nc=${nc}, cnonce="${cnonce}"` : ""}${p.opaque ? `, opaque="${p.opaque}"` : ""}, algorithm=MD5`;
}

export async function soap(pfad, service, aktion, args = {}, { anmelden = false } = {}) {
  const c = cfg();
  const body = umschlag(service, aktion, args);
  const kopf = { "Content-Type": 'text/xml; charset="utf-8"', SOAPAction: `${service}#${aktion}` };
  const senden = (extra = {}) => fetch(`${c.url}${pfad}`, { method: "POST", headers: { ...kopf, ...extra }, body, signal: AbortSignal.timeout(6000) });
  let r;
  try { r = await senden(); } catch (err) { throw Object.assign(new Error(`Die Fritz!Box ist nicht erreichbar (${err.name === "TimeoutError" ? "Zeitüberschreitung" : err.message}).`), { status: 0 }); }
  if (r.status === 401 && (anmelden || mitZugang())) {
    if (!c.passwort) throw Object.assign(new Error("Dafür braucht Friday einen Fritz!Box-Benutzer mit Passwort."), { status: 401 });
    const www = r.headers.get("www-authenticate") || "";
    r = await senden({ Authorization: digestKopf(www, { benutzer: c.benutzer, passwort: c.passwort, methode: "POST", pfad }) });
    if (r.status === 401) throw Object.assign(new Error("Die Fritz!Box lehnt Benutzer oder Passwort ab."), { status: 401 });
  }
  const text = await r.text();
  if (!r.ok) throw Object.assign(new Error(`Fritz!Box-Fehler ${r.status}${wert(text, "errorDescription") ? `: ${wert(text, "errorDescription")}` : ""}`), { status: r.status });
  return text;
}

const IGD_WAN = ["/igdupnp/control/WANCommonIFC1", "urn:schemas-upnp-org:service:WANCommonInterfaceConfig:1"];
const IGD_IP = ["/igdupnp/control/WANIPConn1", "urn:schemas-upnp-org:service:WANIPConnection:1"];
const TR_INFO = ["/upnp/control/deviceinfo", "urn:dslforum-org:service:DeviceInfo:1"];
const TR_GAST = ["/upnp/control/wlanconfig3", "urn:dslforum-org:service:WLANConfiguration:3"];

const mbit = (bit) => Math.round((Number(bit) || 0) / 1e5) / 10;

/** Alles, was ohne/mit Anmeldung geht, auf einen Blick. */
export async function status() {
  const [link, addon, ip] = await Promise.all([
    soap(...IGD_WAN, "GetCommonLinkProperties"),
    soap(...IGD_WAN, "GetAddonInfos").catch(() => ""),
    soap(...IGD_IP, "GetStatusInfo").catch(() => ""),
  ]);
  const d = {
    verbunden: wert(link, "NewPhysicalLinkStatus") === "Up" && (!ip || wert(ip, "NewConnectionStatus") === "Connected"),
    leitung: wert(link, "NewWANAccessType") || "",
    downMax: mbit(wert(link, "NewLayer1DownstreamMaxBitRate")),
    upMax: mbit(wert(link, "NewLayer1UpstreamMaxBitRate")),
    downJetzt: addon ? Math.round(Number(wert(addon, "NewByteReceiveRate")) * 8 / 1e5) / 10 : null,
    upJetzt: addon ? Math.round(Number(wert(addon, "NewByteSendRate")) * 8 / 1e5) / 10 : null,
    onlineSeit: ip ? Number(wert(ip, "NewUptime")) || 0 : null,
    letzterFehler: ip ? wert(ip, "NewLastConnectionError") : "",
    mitZugang: mitZugang(),
    stand: new Date().toISOString(),
  };
  if (mitZugang()) {
    try {
      const info = await soap(...TR_INFO, "GetInfo", {}, { anmelden: true });
      d.box = { modell: wert(info, "NewModelName"), version: wert(info, "NewSoftwareVersion"), laufzeit: Number(wert(info, "NewUpTime")) || 0 };
    } catch (err) { d.boxFehler = err.message; }
  }
  return d;
}

export async function gast() {
  const info = await soap(...TR_GAST, "GetInfo", {}, { anmelden: true });
  const keys = await soap(...TR_GAST, "GetSecurityKeys", {}, { anmelden: true });
  const ssid = wert(info, "NewSSID"), pw = wert(keys, "NewKeyPassphrase");
  return { an: wert(info, "NewEnable") === "1", ssid, passwort: pw, wifi: `WIFI:T:WPA;S:${ssid.replace(/([\;,:"])/g, "\\$1")};P:${pw.replace(/([\;,:"])/g, "\\$1")};;` };
}
export async function gastSchalten(an) {
  await soap(...TR_GAST, "SetEnable", { NewEnable: an ? 1 : 0 }, { anmelden: true });
  logbuch.eintragen({ bereich: "netz", titel: `Gäste-WLAN ${an ? "eingeschaltet" : "ausgeschaltet"}` });
  return gast();
}

const dauer = (s) => { const h = Math.floor(s / 3600); return h >= 48 ? `${Math.floor(h / 24)} Tagen` : h >= 1 ? `${h} Stunden` : `${Math.max(1, Math.round(s / 60))} Minuten`; };
export function satz(d) {
  if (!d.verbunden) return `Achtung, die Fritz!Box ist gerade nicht mit dem Internet verbunden${d.letzterFehler && d.letzterFehler !== "ERROR_NONE" ? ` (${d.letzterFehler})` : ""}.`;
  const last = d.downJetzt != null && d.downMax ? Math.round((d.downJetzt / d.downMax) * 100) : null;
  return `Das Internet läuft. Deine Leitung schafft ${d.downMax} Megabit runter und ${d.upMax} hoch.${d.downJetzt != null ? ` Gerade laufen ${d.downJetzt} Megabit rein${last != null && last > 80 ? ", die Leitung ist also fast voll – deshalb kann es langsam sein" : ""}.` : ""}${d.onlineSeit ? ` Online seit ${dauer(d.onlineSeit)}.` : ""}`;
}

const NETZ = U(/\b(ist das|ist mein|wie schnell ist das|wie ist das|läuft das|laeuft das|geht das|stimmt was mit dem|warum ist das) (internet|wlan|wifi|netz)( langsam| schnell| down| weg| kaputt)?\b|\bfritz ?box\b|\binternet ?(status|geschwindigkeit|speed)\b/);
const GAST = U(/\b(gäste|gaeste|gast)-? ?(wlan|wifi|zugang|netz)\b/);
export async function quickCommand(text) {
  const { k } = sauber(text);
  if (GAST.test(k)) {
    try {
      if (/\b(an|ein|einschalten|aktivieren)$/.test(k)) { const g = await gastSchalten(true); return { answer: `Gäste-WLAN ist an. Name: ${g.ssid}. Das Passwort steht im Fenster.`, actions: ["wunsch:fritzbox"] }; }
      if (/\b(aus|ausschalten|deaktivieren)$/.test(k)) { await gastSchalten(false); return { answer: "Gäste-WLAN ist aus.", actions: ["wunsch:fritzbox"] }; }
      const g = await gast();
      return { answer: `Das Gäste-WLAN heißt ${g.ssid} und ist ${g.an ? "an" : "aus"}. Name und Passwort zeige ich dir im Fenster.`, actions: ["wunsch:fritzbox"] };
    } catch (err) { return { answer: err.message, actions: ["wunsch:fritzbox"] }; }
  }
  if (!NETZ.test(k)) return null;
  try { return { answer: satz(await status()), actions: ["wunsch:fritzbox"] }; } catch (err) { return { answer: `${err.message} Prüf, ob der Mac im WLAN der Fritz!Box ist und unter Heimnetz → Netzwerk → Netzwerkeinstellungen „Statusinformationen über UPnP übertragen“ an ist.`, actions: ["wunsch:fritzbox"] }; }
}
