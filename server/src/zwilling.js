// Digitaler Zwilling, Netzwerk- und Mac-Sicherheit, Datenschutz-Kontrolle (v1.188.0, Mark XVI).
//
//  💻 Mac-Zwilling        Abbild des Rechners, auf dem Friday läuft: System, Speicher, Akku, Programme (Prozesse),
//                         installierte Apps, Fridays eigene Ordner. Täglich ein Schnappschuss: neue/entfernte Apps,
//                         Speicher-Trend („Platte voll in X Tagen“), Kompatibilität für Friday-Funktionen.
//  🛡 Mac-Sicherheit      FileVault, Firewall, Systemschutz (SIP), Gatekeeper, automatische Updates – nur LESEN.
//                         Dazu Software-Prüfung von Fridays Bausteinen (npm audit) und Node-Version.
//  📶 Eigenes Netzwerk    Geräte im EIGENEN WLAN aus der ARP-Tabelle des Mac (kein Scan fremder Netze, keine Ports).
//                         Neue, unbekannte Geräte meldet Friday als Text. Dazu neue Anmelde-Geräte bei Friday.
//  🔏 Datenschutz         Was Friday wo speichert, wie viel und seit wann, wohin Daten gehen können.
//                         Alte Einträge per Knopf in den Papierkorb (~/Friday-Archiv/Papierkorb), nicht endgültig.
//
// Alles lokal, ohne KI, ohne Kosten. Friday ändert an den Mac-Einstellungen nichts. Gespeichert in data/zwilling.json.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import * as store from "./store.js";
import { config, DATA_DIR } from "./config.js";
import { eintragen } from "./logbuch.js";

const NAME = "zwilling";
const MAC = process.platform === "darwin";
const lade = () => ({ verlauf: [], apps: null, appAenderungen: [], geraete: {}, netzBasis: false, audit: null, anmeldeGeraete: {}, ...store.load(NAME, {}) });
const sichere = (d) => store.save(NAME, d);
const heute = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const gb = (b) => Math.round((b / 1024 ** 3) * 10) / 10;
const kurz = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

/** Ein Programm nur LESEND ausführen. Gibt stdout zurück oder null (fehlt, Fehler, Zeitüberschreitung). */
export function befehl(cmd, args = [], ms = 8000) {
  return new Promise((resolve) => {
    try {
      execFile(cmd, args, { timeout: ms, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, LC_ALL: "C" } }, (err, out) => resolve(out ? String(out) : err ? null : ""));
    } catch { resolve(null); }
  });
}
const vorhanden = async (prog) => {
  for (const dir of [...String(process.env.PATH || "").split(":"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"]) {
    if (!dir) continue;
    try { fs.accessSync(path.join(dir, prog), fs.constants.X_OK); return path.join(dir, prog); } catch { /* weiter */ }
  }
  return null;
};

// ---------- Parser (auch im Funktionstest geprüft) ----------
export function dfParse(text) {
  const z = String(text || "").trim().split("\n").filter(Boolean).at(-1)?.split(/\s+/) || [];
  const [, gesamt, belegt, frei] = z.map(Number);
  if (!Number.isFinite(gesamt) || !gesamt) return null;
  return { gesamtGB: gb(gesamt * 1024), belegtGB: gb(belegt * 1024), freiGB: gb(frei * 1024), prozent: Math.round((belegt / (belegt + frei)) * 100) };
}
export function psParse(text) {
  return String(text || "").split("\n").map((z) => z.trim().match(/^(\d+)\s+([\d.,]+)\s+(\d+)\s+(.+)$/)).filter(Boolean)
    .map((m) => ({ pid: Number(m[1]), cpu: Number(m[2].replace(",", ".")), ramMB: Math.round(Number(m[3]) / 1024), name: path.basename(m[4].trim()).slice(0, 60) }));
}
export function arpParse(text) {
  const out = [];
  for (const z of String(text || "").split("\n")) {
    // macOS: "? (192.168.178.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]"  ·  Linux /proc/net/arp: "192.168.1.1 0x1 0x2 aa:bb:.. * eth0"
    const m = z.match(/\((\d+\.\d+\.\d+\.\d+)\) at ([0-9a-f:]{11,17}) on (\S+)/i) || z.match(/^(\d+\.\d+\.\d+\.\d+)\s+\S+\s+0x[2-9a-f]\s+([0-9a-f:]{17})\s+\S+\s+(\S+)/i);
    if (!m) continue;
    const mac = m[2].toLowerCase().split(":").map((x) => x.padStart(2, "0")).join(":");
    if (mac === "ff:ff:ff:ff:ff:ff" || mac === "00:00:00:00:00:00" || /^01:00:5e|^33:33/.test(mac)) continue;
    const ip = m[1];
    if (/^(224|239|255)\./.test(ip) || ip.endsWith(".255")) continue;
    out.push({ ip, mac, schnittstelle: m[3], zufall: /^.[26ae]/.test(mac) });
  }
  return [...new Map(out.map((x) => [x.mac, x])).values()];
}
export function akkuParse(text) {
  const m = String(text || "").match(/(\d+)%;\s*([a-zA-Z ]+);/);
  return m ? { prozent: Number(m[1]), zustand: /discharging/i.test(m[2]) ? "entlädt" : /charged/i.test(m[2]) ? "voll" : /charging/i.test(m[2]) ? "lädt" : m[2].trim(), netzteil: /AC Power/.test(text) } : null;
}
/** Lineare Steigung (pro Tag) und Tage bis zur Grenze. */
export function vollIn(verlauf, grenzeGB = 5) {
  const p = verlauf.filter((v) => Number.isFinite(v.freiGB)).slice(-30);
  if (p.length < 5) return { tage: null, text: `Trend ab 5 Tagen (${p.length} gesammelt)` };
  const x = p.map((v) => Date.parse(v.datum) / 864e5), y = p.map((v) => v.freiGB);
  const mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length;
  let z = 0, q = 0;
  x.forEach((v, i) => { z += (v - mx) * (y[i] - my); q += (v - mx) ** 2; });
  const steigung = q ? z / q : 0;
  if (steigung >= -0.05) return { tage: null, steigung, text: "Der freie Speicher bleibt stabil." };
  const tage = Math.max(0, Math.round((y.at(-1) - grenzeGB) / -steigung));
  return { tage, steigung, text: `Pro Tag ${Math.abs(steigung).toFixed(1)} GB weniger frei. Bei dem Tempo ist in etwa ${tage} Tagen kaum noch Platz (unter ${grenzeGB} GB).` };
}

// ---------- 💻 Mac-Zwilling ----------
function appsLesen() {
  const namen = new Set();
  for (const dir of ["/Applications", path.join(os.homedir(), "Applications"), "/Applications/Utilities"]) {
    try { for (const n of fs.readdirSync(dir)) if (n.endsWith(".app")) namen.add(n.slice(0, -4)); } catch { /* fehlt */ }
  }
  return [...namen].sort((a, b) => a.localeCompare(b, "de"));
}
const FRIDAY_ORDNER = ["Friday", "Friday-Backups", "Friday-Archiv", "Friday-Video", "Friday-Webseiten"];
async function ordnerGroessen() {
  const out = [];
  for (const n of FRIDAY_ORDNER) {
    const p = path.join(os.homedir(), n);
    if (!fs.existsSync(p)) continue;
    const r = await befehl("du", ["-sk", p], 30000);
    const kb = Number(String(r || "").split(/\s+/)[0]);
    out.push({ name: `~/${n}`, gb: Number.isFinite(kb) ? gb(kb * 1024) : null });
  }
  return out;
}
async function kompatibilitaet() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const mac = MAC ? (await befehl("sw_vers", ["-productVersion"]))?.trim() : null;
  const [ffmpeg, python, ollama, git] = await Promise.all(["ffmpeg", "python3", "ollama", "git"].map(vorhanden));
  let agent = false;
  try { agent = (await import("./agent-hub.js")).isAgentOnline(); } catch { /* egal */ }
  return [
    { was: "Node.js für Friday", ok: nodeMajor >= 20, wert: `v${process.versions.node}`, rat: "Node 20 oder neuer installieren (nodejs.org)." },
    { was: "macOS", ok: MAC ? Number(String(mac).split(".")[0]) >= 13 : null, wert: mac || `${os.type()} (kein Mac)`, rat: "macOS 13 oder neuer empfohlen (Systemeinstellungen → Softwareupdate)." },
    { was: "Mac-Agent (Kalender, Apps, Kurzbefehle)", ok: MAC ? agent : null, wert: agent ? "verbunden" : "nicht verbunden", rat: "„Friday starten.command“ öffnen." },
    { was: "ffmpeg (Schnitt-Team, Trailer)", ok: Boolean(ffmpeg), wert: ffmpeg ? "da" : "fehlt", rat: "Mit „extras-installieren.sh“ nachinstallieren." },
    { was: "Python 3 (Whisper, Kronos)", ok: Boolean(python), wert: python ? "da" : "fehlt", rat: "Mit „extras-installieren.sh“ nachinstallieren." },
    { was: "Ollama (lokale, kostenlose KI)", ok: Boolean(ollama), wert: ollama ? "da" : "fehlt", rat: "Ollama-App von ollama.com laden (kostenlos)." },
    { was: "git (Entwickler-Werkzeuge)", ok: git ? true : null, wert: git ? "da" : "fehlt (nur für Entwickler nötig)", rat: "" },
  ];
}

let letzterZustand = null;
export async function macZustand({ frisch = false } = {}) {
  if (!frisch && letzterZustand && Date.now() - letzterZustand.at < 60_000) return letzterZustand.r;
  const [df, ps, batt, ordner, kompat, version] = await Promise.all([
    befehl("df", ["-kP", "/"]), befehl("ps", ["-axo", "pid=,pcpu=,rss=,comm="]), MAC ? befehl("pmset", ["-g", "batt"]) : null,
    ordnerGroessen(), kompatibilitaet(), MAC ? befehl("sw_vers", ["-productVersion"]) : null,
  ]);
  const prozesse = psParse(ps);
  const zusammen = new Map();
  for (const p of prozesse) { const x = zusammen.get(p.name) || { name: p.name, cpu: 0, ramMB: 0, anzahl: 0 }; x.cpu += p.cpu; x.ramMB += p.ramMB; x.anzahl++; zusammen.set(p.name, x); }
  const progs = [...zusammen.values()].map((x) => ({ ...x, cpu: Math.round(x.cpu * 10) / 10 }));
  const d = lade();
  const r = {
    at: new Date().toISOString(), mac: MAC,
    system: { name: os.hostname(), os: MAC ? `macOS ${String(version || "").trim()}` : `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model || "", kerne: os.cpus().length, last: Math.round(os.loadavg()[0] * 100) / 100, ramGB: gb(os.totalmem()), ramFreiGB: gb(os.freemem()), laufzeitStd: Math.round(os.uptime() / 360) / 10 },
    speicher: dfParse(df), akku: akkuParse(batt),
    cpuFresser: progs.slice().sort((a, b) => b.cpu - a.cpu).slice(0, 8), ramFresser: progs.slice().sort((a, b) => b.ramMB - a.ramMB).slice(0, 8), prozesse: prozesse.length,
    apps: MAC ? d.apps?.liste?.length ?? appsLesen().length : null, appAenderungen: d.appAenderungen.slice(-15).reverse(),
    ordner, kompatibilitaet: kompat, trend: vollIn(d.verlauf), verlauf: d.verlauf.slice(-30),
  };
  letzterZustand = { at: Date.now(), r };
  return r;
}

/** Täglicher Schnappschuss: Speicher-Verlauf und App-Änderungen. */
export async function schnappschuss() {
  const z = await macZustand({ frisch: true });
  const d = lade();
  const t = heute();
  if (z.speicher) { d.verlauf = d.verlauf.filter((v) => v.datum !== t); d.verlauf.push({ datum: t, freiGB: z.speicher.freiGB, belegtProzent: z.speicher.prozent }); d.verlauf = d.verlauf.slice(-90); }
  const meldungen = [];
  if (MAC) {
    const jetzt = appsLesen();
    if (d.apps?.liste) {
      const alt = new Set(d.apps.liste), neu = new Set(jetzt);
      const dazu = jetzt.filter((a) => !alt.has(a)), weg = d.apps.liste.filter((a) => !neu.has(a));
      for (const a of dazu) d.appAenderungen.push({ datum: t, app: a, art: "neu" });
      for (const a of weg) d.appAenderungen.push({ datum: t, app: a, art: "entfernt" });
      if (dazu.length || weg.length) meldungen.push(`Apps: ${[...dazu.map((a) => `+ ${a}`), ...weg.map((a) => `− ${a}`)].slice(0, 6).join(", ")}`);
      d.appAenderungen = d.appAenderungen.slice(-100);
    }
    d.apps = { at: new Date().toISOString(), liste: jetzt };
  }
  sichere(d);
  const trend = vollIn(d.verlauf);
  if (z.speicher && (z.speicher.freiGB < 10 || (trend.tage != null && trend.tage < 14))) meldungen.push(`Speicher: noch ${z.speicher.freiGB} GB frei. ${trend.tage != null ? trend.text : ""}`.trim());
  return { ok: true, meldungen };
}

// ---------- 🛡 Mac-Sicherheit ----------
export async function macSicherheit() {
  if (!MAC) return { mac: false, pruefungen: [], hinweis: "Diese Prüfungen gehen nur auf dem Mac. Hier läuft Friday auf einem anderen System." };
  const [fv, fw, sip, gk, upd] = await Promise.all([
    befehl("fdesetup", ["status"]), befehl("/usr/libexec/ApplicationFirewall/socketfilterfw", ["--getglobalstate"]), befehl("csrutil", ["status"]), befehl("spctl", ["--status"]),
    befehl("defaults", ["read", "/Library/Preferences/com.apple.SoftwareUpdate", "AutomaticCheckEnabled"]),
  ]);
  const p = (id, name, text, gut, schlecht, rat) => ({ id, name, ok: text == null ? null : gut.test(text) ? true : schlecht.test(text) ? false : null, wert: kurz(text, 80) || "nicht lesbar", rat });
  return { mac: true, pruefungen: [
    p("filevault", "FileVault (Festplatte verschlüsselt)", fv, /On\b/i, /Off\b/i, "Systemeinstellungen → Datenschutz & Sicherheit → FileVault einschalten. Schützt alles, falls der Mac gestohlen wird."),
    p("firewall", "Firewall", fw, /enabled|State = [12]/i, /disabled|State = 0/i, "Systemeinstellungen → Netzwerk → Firewall einschalten. Friday bleibt erreichbar, wenn du „Zulassen“ wählst."),
    p("sip", "Systemschutz (SIP)", sip, /enabled/i, /disabled/i, "Der Systemschutz ist aus. Das macht man nur für Spezial-Software. Im Zweifel einen Apple-Laden fragen."),
    p("gatekeeper", "Gatekeeper (nur geprüfte Apps)", gk, /enabled/i, /disabled/i, "Im Terminal „sudo spctl --master-enable“ oder in Datenschutz & Sicherheit wieder auf „App Store & bekannte Entwickler“ stellen."),
    p("updates", "Automatisch nach Updates suchen", upd, /^\s*1/, /^\s*0/, "Systemeinstellungen → Allgemein → Softwareupdate → Automatische Updates einschalten."),
  ] };
}

/** Fridays eigene Bausteine auf bekannte Lücken prüfen (npm audit, braucht Internet). Nur lesen, nichts wird geändert. */
export async function softwarePruefen() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const serverDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const npm = [path.join(path.dirname(process.execPath), "npm"), "npm"].find((p) => p === "npm" || fs.existsSync(p));
  const out = await befehl(npm, ["audit", "--omit=dev", "--json", "--prefix", serverDir], 90000);
  let audit = null;
  try { const j = JSON.parse(out || ""); const v = j.metadata?.vulnerabilities; if (v) audit = { kritisch: v.critical || 0, hoch: v.high || 0, mittel: v.moderate || 0, niedrig: v.low || 0, pakete: Object.keys(j.vulnerabilities || {}).slice(0, 10) }; } catch { /* kein Ergebnis */ }
  const r = { at: new Date().toISOString(), node: { version: process.versions.node, ok: nodeMajor >= 20, text: nodeMajor >= 20 ? "Node bekommt noch Sicherheits-Updates." : "Diese Node-Version bekommt keine Sicherheits-Updates mehr. Bitte Node 20 oder neuer installieren." }, audit, fehler: audit ? null : "npm audit hat nicht geantwortet (braucht Internet)." };
  const d = lade(); d.audit = r; sichere(d);
  return r;
}

// ---------- 📶 Eigenes Netzwerk ----------
export async function netzwerk({ melden = false } = {}) {
  const roh = MAC ? await befehl("arp", ["-an"]) : await fs.promises.readFile("/proc/net/arp", "utf8").catch(() => null);
  const d = lade();
  if (roh == null) return { ok: false, error: "Die Geräteliste des Netzwerks ist hier nicht lesbar.", geraete: Object.values(d.geraete) };
  const liste = arpParse(roh);
  const jetzt = new Date().toISOString();
  const neu = [];
  for (const g of liste) {
    const alt = d.geraete[g.mac];
    if (alt) { alt.ip = g.ip; alt.zuletzt = jetzt; alt.zufall = g.zufall; continue; }
    d.geraete[g.mac] = { mac: g.mac, ip: g.ip, name: "", bekannt: !d.netzBasis, erstGesehen: jetzt, zuletzt: jetzt, zufall: g.zufall };
    if (d.netzBasis) neu.push(d.geraete[g.mac]);
  }
  const ersterLauf = !d.netzBasis;
  d.netzBasis = true;
  // Geräte, die 60 Tage nicht mehr da waren und nie benannt wurden, vergessen.
  for (const [mac, g] of Object.entries(d.geraete)) if (!g.name && Date.now() - Date.parse(g.zuletzt) > 60 * 864e5) delete d.geraete[mac];
  sichere(d);
  if (neu.length) eintragen({ bereich: "sicherheit", titel: `Netzwerk: ${neu.length} neues Gerät${neu.length === 1 ? "" : "e"}`, details: neu.map((g) => g.ip).join(", "), quelle: "zwilling" });
  if (melden && neu.length) {
    try { await (await import("./notify.js")).notifyAll("📶 Neues Gerät im WLAN", `${neu.map((g) => `${g.ip}${g.zufall ? " (Handy mit privater Adresse?)" : ""}`).join(", ")}\nIm Cockpit → Zwilling als bekannt markieren oder benennen.`); } catch { /* egal */ }
  }
  const sichtbar = new Set(liste.map((g) => g.mac));
  return { ok: true, ersterLauf, neu: neu.length, geraete: Object.values(d.geraete).map((g) => ({ ...g, jetztDa: sichtbar.has(g.mac) })).sort((a, b) => Number(a.bekannt) - Number(b.bekannt) || Number(b.jetztDa) - Number(a.jetztDa) || a.ip.localeCompare(b.ip, "de", { numeric: true })) };
}
export function geraetSetzen(mac, { name, bekannt } = {}) {
  const d = lade();
  const g = d.geraete[String(mac || "").toLowerCase()];
  if (!g) return { error: "Gerät nicht gefunden." };
  if (name !== undefined) g.name = kurz(name, 40);
  if (bekannt !== undefined) g.bekannt = Boolean(bekannt);
  sichere(d);
  return { ok: true };
}

/** Neue Anmelde-Geräte bei Friday (aus dem Zugriffs-Protokoll der Sicherheits-Zentrale) und Anmeldungen mitten in der Nacht. */
export async function anmeldeAuffaelligkeiten() {
  let prot = [];
  try { prot = store.load("sicherheit", { protokoll: [] }).protokoll || []; } catch { /* leer */ }
  const d = lade();
  const out = [];
  for (const e of prot.filter((x) => x.art === "ok")) {
    const g = e.geraet || "unbekannt";
    if (!d.anmeldeGeraete[g]) { d.anmeldeGeraete[g] = e.zeit; if (Object.keys(d.anmeldeGeraete).length > 1 && Date.now() - Date.parse(e.zeit) < 7 * 864e5) out.push({ art: "neues-geraet", text: `Neues Gerät hat sich angemeldet: ${g}`, zeit: e.zeit }); }
    const h = new Date(e.zeit).getHours();
    if (h >= 1 && h < 5 && Date.now() - Date.parse(e.zeit) < 7 * 864e5) out.push({ art: "nacht", text: `Anmeldung um ${new Date(e.zeit).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr (${g})`, zeit: e.zeit });
  }
  sichere(d);
  return out.slice(-10).reverse();
}

// ---------- 🔏 Datenschutz-Kontrolle ----------
const KATEGORIEN = [
  { id: "archiv", name: "Fragen und Antworten (Fridays Datenbank)", muster: /^archiv$|^history-.*\.json$|^activity\.json$/, loeschbar: "monate", ordner: "archiv" },
  { id: "logbuch", name: "Logbuch: was Friday getan hat", muster: /^logbuch$|^logbuch-stand\.json$/, loeschbar: "monate", ordner: "logbuch" },
  { id: "gedaechtnis", name: "Gedächtnis: was Friday über dich weiß", muster: /^(memory|kurzzeit|vorlieben|profil|gewohnheiten|ziele|entscheidungen|seele)\.json$/, wo: "Cockpit → Gedächtnis (einzelne Einträge löschen)" },
  { id: "sicherheit", name: "Anmelde-Protokoll (letzte 300)", muster: /^sicherheit\.json$/, wo: "läuft von selbst über" },
  { id: "aenderungen", name: "Änderungs-Protokoll (frühere Fassungen)", muster: /^aenderungen$/, wo: "Cockpit → System" },
  { id: "dokumente", name: "Dokumente und Dokumenten-Wissen", muster: /^dok/, wo: "Fenster Dokumente" },
  { id: "verbindungen", name: "Schlüssel für Dienste (verschlüsselt)", muster: /^(verbindungen|github|alexa|tresor)\.json$/, wo: "Fenster Verbindungen" },
];
function groesse(p) {
  let bytes = 0, dateien = 0, aeltest = null;
  const geh = (x, tiefe) => {
    let st; try { st = fs.statSync(x); } catch { return; }
    if (st.isDirectory()) { if (tiefe > 3) return; let l = []; try { l = fs.readdirSync(x); } catch { return; } for (const n of l) geh(path.join(x, n), tiefe + 1); return; }
    bytes += st.size; dateien++; if (!aeltest || st.mtimeMs < aeltest) aeltest = st.mtimeMs;
  };
  geh(p, 0);
  return { bytes, dateien, aeltest };
}
async function fotoDir() { try { return path.join((await import("./archiv.js")).ARCHIV_DIR, "Fotos"); } catch { return path.join(os.homedir(), "Friday-Archiv", "Fotos"); } }
export async function datenschutz() {
  let eintraege = [];
  try { eintraege = fs.readdirSync(DATA_DIR); } catch { /* leer */ }
  const benutzt = new Set();
  const kat = KATEGORIEN.map((k) => {
    const g = { bytes: 0, dateien: 0, aeltest: null };
    for (const n of eintraege.filter((e) => k.muster.test(e))) { benutzt.add(n); const x = groesse(path.join(DATA_DIR, n)); g.bytes += x.bytes; g.dateien += x.dateien; if (x.aeltest && (!g.aeltest || x.aeltest < g.aeltest)) g.aeltest = x.aeltest; }
    return { id: k.id, name: k.name, mb: Math.round((g.bytes / 1024 ** 2) * 100) / 100, dateien: g.dateien, seit: g.aeltest ? new Date(g.aeltest).toISOString() : null, loeschbar: Boolean(k.loeschbar), wo: k.wo || "" };
  });
  const fd = await fotoDir();
  const f = groesse(fd);
  kat.push({ id: "fotos", name: "Fotos von Fridays Auge (Kamera)", mb: Math.round((f.bytes / 1024 ** 2) * 100) / 100, dateien: f.dateien, seit: f.aeltest ? new Date(f.aeltest).toISOString() : null, loeschbar: true, wo: "~/Friday-Archiv/Fotos" });
  const rest = { bytes: 0, dateien: 0 };
  for (const n of eintraege.filter((e) => !benutzt.has(e))) { const x = groesse(path.join(DATA_DIR, n)); rest.bytes += x.bytes; rest.dateien += x.dateien; }
  kat.push({ id: "sonstiges", name: "Einstellungen und Arbeitsdaten der Module", mb: Math.round((rest.bytes / 1024 ** 2) * 100) / 100, dateien: rest.dateien, seit: null, loeschbar: false, wo: "nötig, damit Friday funktioniert" });
  // Wohin Daten gehen KÖNNEN – nur wenn du die Funktion benutzt.
  const nach = [
    { dienst: "Anthropic (Claude)", aktiv: Boolean(config.anthropicKey), was: "Deine Frage und kurzer Zusammenhang, wenn Friday Claude zum Denken braucht. Offline-Befehle und Schnellbefehle bleiben am Mac." },
    { dienst: "Telegram", aktiv: Boolean(config.telegramToken), was: "Mitteilungen und Antworten im Telegram-Chat." },
  ];
  try {
    const ds = await Promise.race([(await import("./dienste.js")).alleStatus(), new Promise((r) => setTimeout(() => r(null), 3000))]);
    for (const x of ds?.dienste || []) if (x.eingerichtet) nach.push({ dienst: x.name, aktiv: true, was: "Nur, was du über diesen Dienst auslöst (z. B. Stimme, Musik, Licht)." });
  } catch { /* egal */ }
  try { const o = await import("./ollama.js"); if (o.bereit()) { const e = o.einstellungen(); nach.push({ dienst: e.art === "lokal" ? "Ollama (lokal)" : "Ollama Cloud", aktiv: true, was: e.art === "lokal" ? "Bleibt auf deinem Mac." : "Fragen gehen an Ollama Cloud, wenn Friday sie dort denken lässt." }); } } catch { /* egal */ }
  return { kategorien: kat, nach, papierkorb: path.join(path.dirname(fd), "Papierkorb"), hinweis: "Alles liegt auf deinem Mac. Kopien davon stecken in den Sicherungen (~/Friday-Backups)." };
}

/** Alte Einträge einer Kategorie in den Papierkorb verschieben (nicht endgültig). Ganze Monate bzw. Fotos älter als X Tage. */
export async function aufraeumen(id, { aelterAlsTage = 365 } = {}) {
  const tage = Math.max(30, Math.min(3650, Number(aelterAlsTage) || 365));
  const grenze = Date.now() - tage * 864e5;
  const fd = await fotoDir();
  const korb = path.join(path.dirname(fd), "Papierkorb", `Datenschutz-${heute()}-${id}`);
  const k = KATEGORIEN.find((x) => x.id === id);
  const kandidaten = [];
  if (k?.loeschbar === "monate") {
    const dir = path.join(DATA_DIR, k.ordner);
    let l = []; try { l = fs.readdirSync(dir); } catch { /* leer */ }
    for (const n of l) {
      const m = n.match(/^(\d{4})-(\d{2})\.jsonl$/);
      if (m && Date.UTC(Number(m[1]), Number(m[2]), 1) < grenze) kandidaten.push(path.join(dir, n)); // ganzer Monat liegt vor der Grenze
    }
  } else if (id === "fotos") {
    const geh = (x, tiefe) => { let l = []; try { l = fs.readdirSync(x, { withFileTypes: true }); } catch { return; } for (const e of l) { const p = path.join(x, e.name); if (e.isDirectory() && tiefe < 3) geh(p, tiefe + 1); else if (e.isFile()) { try { if (fs.statSync(p).mtimeMs < grenze) kandidaten.push(p); } catch { /* weg */ } } } };
    geh(fd, 0);
  } else return { error: "Diese Daten lassen sich hier nicht aufräumen." };
  if (!kandidaten.length) return { ok: true, verschoben: 0, text: `Nichts älter als ${tage} Tage.` };
  fs.mkdirSync(korb, { recursive: true });
  let n = 0;
  for (const p of kandidaten) {
    const ziel = path.join(korb, path.relative(id === "fotos" ? fd : DATA_DIR, p));
    try { fs.mkdirSync(path.dirname(ziel), { recursive: true }); fs.renameSync(p, ziel); n++; } catch {
      try { fs.copyFileSync(p, ziel); fs.unlinkSync(p); n++; } catch { /* übersprungen */ }
    }
  }
  eintragen({ bereich: "sicherheit", titel: `Datenschutz: ${n} alte Dateien (${id}) in den Papierkorb`, details: korb, quelle: "dashboard" });
  return { ok: true, verschoben: n, korb, text: `${n} Datei${n === 1 ? "" : "en"} älter als ${tage} Tage ${n === 1 ? "liegt" : "liegen"} jetzt im Papierkorb (${korb.replace(os.homedir(), "~")}). Von dort kannst du sie zurücklegen oder endgültig löschen.` };
}

// ---------- Übersicht + Sprache ----------
export async function uebersicht() {
  const [zustand, sicherheit, netz, anmeldung] = await Promise.all([macZustand(), macSicherheit(), netzwerk(), anmeldeAuffaelligkeiten()]);
  return { zustand, sicherheit, netz, anmeldung, audit: lade().audit };
}
export async function quickCommand(text) {
  const k = String(text || "").toLowerCase().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/, "").replace(/[?!.]+$/, "").trim();
  if (/^(öffne|oeffne|zeig|zeige)( mir)? (den |das |die )?(mac-?zwilling|digitalen zwilling|zwilling|datenschutz(-?kontrolle)?)$/.test(k)) return { answer: /datenschutz/.test(k) ? "Hier ist die Datenschutz-Kontrolle." : "Hier ist dein Mac-Zwilling.", actions: [/datenschutz/.test(k) ? "cockpit:datenschutz" : "cockpit:zwilling"] };
  if (/^(wie viel|wieviel) (speicher|platz) (ist )?(noch )?frei|^wann ist (meine |die )?(platte|festplatte|speicher) voll/.test(k)) {
    const z = await macZustand();
    return { answer: z.speicher ? `Noch ${z.speicher.freiGB} GB von ${z.speicher.gesamtGB} GB frei (${z.speicher.prozent} % belegt). ${z.trend.text}` : "Den Speicher kann ich gerade nicht lesen.", actions: ["cockpit:zwilling"] };
  }
  if (/^(welche|was für) (programme|apps|prozesse) (fressen|brauchen|ziehen) (am meisten )?(leistung|strom|speicher|ram|cpu)/.test(k)) {
    const z = await macZustand({ frisch: true });
    return { answer: `Am meisten Rechenleistung: ${z.cpuFresser.slice(0, 3).map((p) => `${p.name} (${p.cpu} %)`).join(", ")}. Am meisten Arbeitsspeicher: ${z.ramFresser.slice(0, 3).map((p) => `${p.name} (${Math.round(p.ramMB)} MB)`).join(", ")}.`, actions: ["cockpit:zwilling"] };
  }
  if (/^(ist|wie sicher ist) (mein |der )?mac( sicher)?$|^mac-?sicherheit/.test(k)) {
    const s = await macSicherheit();
    if (!s.mac) return { answer: s.hinweis, actions: ["cockpit:zwilling"] };
    const schlecht = s.pruefungen.filter((p) => p.ok === false);
    return { answer: schlecht.length ? `${schlecht.length} Punkt${schlecht.length === 1 ? "" : "e"} sollte${schlecht.length === 1 ? "" : "n"} an: ${schlecht.map((p) => p.name).join(", ")}. Wie, steht im Cockpit.` : `Alles gut: ${s.pruefungen.filter((p) => p.ok).map((p) => p.name.split(" (")[0]).join(", ")} sind an.`, actions: ["cockpit:zwilling"] };
  }
  if (/^(welche|wer ist|was für) geräte (sind )?(in |im )?(meinem |mein )?(wlan|netz|netzwerk)/.test(k)) {
    const n = await netzwerk();
    if (!n.ok) return { answer: n.error, actions: [] };
    const da = n.geraete.filter((g) => g.jetztDa), fremd = da.filter((g) => !g.bekannt);
    return { answer: `${da.length} ${da.length === 1 ? "Gerät ist" : "Geräte sind"} gerade im Netz${fremd.length ? `, davon ${fremd.length} unbekannt` : ""}.`, actions: ["cockpit:zwilling"] };
  }
  return null;
}

export function zwillingRouten(app, asyncRoute) {
  app.get("/api/zwilling", asyncRoute(async (_req, res) => res.json(await uebersicht())));
  app.post("/api/zwilling/schnappschuss", asyncRoute(async (_req, res) => res.json(await schnappschuss())));
  app.post("/api/zwilling/software", asyncRoute(async (_req, res) => res.json(await softwarePruefen())));
  app.post("/api/zwilling/geraet", (req, res) => res.json(geraetSetzen(req.body?.mac, req.body || {})));
  app.get("/api/datenschutz", asyncRoute(async (_req, res) => res.json(await datenschutz())));
  app.post("/api/datenschutz/aufraeumen", asyncRoute(async (req, res) => res.json(await aufraeumen(String(req.body?.id || ""), req.body || {}))));
}

export async function zwillingStart() {
  try {
    const hz = await import("./herzschlag.js");
    hz.aufgabeRegistrieren("mac-zwilling", { name: "Mac-Zwilling", text: "Täglicher Schnappschuss: Speicher-Verlauf, neue oder entfernte Apps. Mitteilung (nur Text), wenn der Speicher knapp wird.", art: "taeglich", zeit: "06:10", standardAn: true, lauf: async () => {
      const r = await schnappschuss();
      if (r.meldungen.some((m) => m.startsWith("Speicher"))) await import("./notify.js").then((n) => n.notifyAll("💾 Speicher wird knapp", r.meldungen.filter((m) => m.startsWith("Speicher")).join("\n"))).catch(() => {});
      return { ok: true, text: r.meldungen.join(" · ") || "keine Änderungen" };
    } });
    hz.aufgabeRegistrieren("netz-waechter", { name: "Netzwerk-Wächter (eigenes WLAN)", text: "Schaut alle 30 Minuten in die Geräteliste des eigenen Netzes. Ein neues, unbekanntes Gerät meldet Friday als Text. Kein Scan fremder Netze.", art: "intervall", minuten: 30, standardAn: true, lauf: async () => { const r = await netzwerk({ melden: true }); return { ok: r.ok !== false, text: r.ok ? `${r.geraete.filter((g) => g.jetztDa).length} Geräte da${r.neu ? `, ${r.neu} neu` : ""}` : r.error }; } });
    hz.aufgabeRegistrieren("software-pruefung", { name: "Software-Sicherheitsprüfung", text: "Prüft wöchentlich Fridays Bausteine auf bekannte Lücken (npm audit). Nur lesen.", art: "intervall", minuten: 7 * 24 * 60, standardAn: true, lauf: async () => { const r = await softwarePruefen(); return { ok: Boolean(r.audit), text: r.audit ? `${r.audit.kritisch} kritisch, ${r.audit.hoch} hoch` : r.fehler }; } });
  } catch (err) { console.error("Zwilling/Herzschlag:", err.message); }
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "zwilling", bereich: "System", name: "Mac-Zwilling und Netz (Speicher, Programme, Geräteliste)", lauf: async () => {
      const z = await macZustand({ frisch: true });
      if (!z.speicher) return { status: "fehler", text: "Der Speicher-Stand ist nicht lesbar (df)." };
      if (!z.cpuFresser.length) return { status: "fehler", text: "Die Programm-Liste ist nicht lesbar (ps)." };
      const a = arpParse("? (192.168.178.1) at 3c:a6:2f:1:2:3 on en0 ifscope [ethernet]\n? (224.0.0.251) at 1:0:5e:0:0:fb on en0 ifscope permanent [ethernet]\n? (192.168.178.255) at ff:ff:ff:ff:ff:ff on en0 ifscope [ethernet]");
      if (a.length !== 1 || a[0].mac !== "3c:a6:2f:01:02:03") return { status: "fehler", text: "Die Geräteliste wird falsch gelesen." };
      const t = vollIn([0, 1, 2, 3, 4, 5].map((i) => ({ datum: `2026-01-0${i + 1}`, freiGB: 50 - i * 2 })));
      if (t.tage !== 18) return { status: "fehler", text: `Speicher-Trend falsch (${t.tage}).` };
      const n = await netzwerk();
      return { status: "bestanden", text: `Echt gelesen: ${z.speicher.freiGB} GB frei, ${z.prozesse} Programme, ${n.ok ? `${n.geraete.filter((g) => g.jetztDa).length} Geräte im Netz` : "Geräteliste hier nicht lesbar"}.${z.mac ? "" : " Mac-Prüfungen (Akku, Apps, FileVault …) nur am Mac."}` };
    } });
  } catch (err) { console.error("Zwilling/Funktionstest:", err.message); }
}
