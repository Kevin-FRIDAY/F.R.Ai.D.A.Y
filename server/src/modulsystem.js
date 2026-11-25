// Dynamisches Modulsystem + Modul-Marktplatz + Kompatibilitätsprüfung.
//
// Eigene Module sind kleine JSON-Dateien (keine Programme – sie können also nichts kaputt machen):
//   { "id": "wuerfel", "name": "Würfel", "version": "1.0.0", "braucht_friday": ">=1.97.0",
//     "beschreibung": "…", "rechte": ["befehle"],
//     "befehle": [ { "saetze": ["würfel", "wirf einen würfel"], "antwort": ["Eine {zufall:1-6}!"] },
//                  { "saetze": ["übersetze *"], "friday": "Übersetze ins Englische: {1}" } ] }
// Friday erkennt neue Dateien in server/data/module/ von selbst, prüft sie (Kompatibilität) und
// schaltet sie erst ein, wenn du zustimmst. Rechte: befehle (auf Sätze antworten),
// claude (Sätze an Fridays Gehirn weitergeben – kostet Guthaben), mitteilung (Mitteilung schicken).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { DATA_DIR, ROOT, config } from "./config.js";
import { eintragen } from "./logbuch.js";
import { localVersion, githubToken } from "./updater.js";
import { pruefeOrdner } from "./testlabor.js";
import { notifyAll } from "./notify.js";

const DIR = path.join(DATA_DIR, "module");
const STAND = path.join(DATA_DIR, "module-stand.json");
const KATALOG_DIR = path.join(ROOT, "module-katalog");
export const RECHTE = { befehle: "Auf Sprachbefehle antworten", claude: "Sätze an Fridays Gehirn weitergeben (kostet Guthaben)", mitteilung: "Mitteilungen aufs Handy schicken" };
// Sätze, die eingebaute Funktionen brauchen – Module dürfen sie nicht übernehmen.
const GESCHUETZT = /^(notfall|alexa|autonomie|mission|notfallmodus|stopp alles|alles stopp|was kannst du|wie spät|uhrzeit|hilfe|update|öffne|zeig mir)\b/;

// ---- Versionen ----
const teile = (v) => String(v || "0").split(".").map((x) => parseInt(x, 10) || 0);
function vergleiche(a, b) { const x = teile(a), y = teile(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; }
/** Erfüllt Version v die Bedingung (">=1.97.0", "<2.0.0", "1.97.x", ">=1.90.0 <2.0.0")? */
export function passtVersion(v, bedingung = "") {
  const b = String(bedingung || "").trim();
  if (!b || b === "*") return true;
  return b.split(/\s+/).every((teil) => {
    const m = teil.match(/^(>=|<=|>|<|=|\^|~)?(\d+(?:\.(?:\d+|x))?(?:\.(?:\d+|x))?)$/);
    if (!m) return false;
    const op = m[1] || "=", ziel = m[2];
    if (ziel.includes("x")) { const p = ziel.split(".").filter((s) => s !== "x"); return teile(v).slice(0, p.length).join(".") === p.map(Number).join("."); }
    const c = vergleiche(v, ziel);
    if (op === ">=") return c >= 0; if (op === "<=") return c <= 0; if (op === ">") return c > 0; if (op === "<") return c < 0;
    if (op === "^") return c >= 0 && teile(v)[0] === teile(ziel)[0];
    if (op === "~") return c >= 0 && teile(v)[0] === teile(ziel)[0] && teile(v)[1] === teile(ziel)[1];
    return c === 0;
  });
}

const norm = (s) => String(s || "").toLowerCase().replace(/[.!?,;:]/g, " ").replace(/\s+/g, " ").trim().replace(/^(hey |hallo )?friday /, "");

// ---- Kompatibilitätsprüfung ----
/** Prüft ein Modul gegen das laufende System. @returns {{ok:boolean, fehler:string[], warnungen:string[]}} */
export function pruefeModul(m, { andere = [] } = {}) {
  const fehler = [], warnungen = [];
  if (!m || typeof m !== "object" || Array.isArray(m)) return { ok: false, fehler: ["Das ist kein gültiges Modul (JSON-Objekt erwartet)."], warnungen };
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(String(m.id || ""))) fehler.push("„id“ fehlt oder ist ungültig (nur a–z, 0–9 und -, 2–40 Zeichen).");
  if (!String(m.name || "").trim()) fehler.push("„name“ fehlt.");
  if (!/^\d+\.\d+\.\d+$/.test(String(m.version || ""))) fehler.push("„version“ muss wie 1.0.0 aussehen.");
  if (m.braucht_friday && !passtVersion(localVersion(), m.braucht_friday)) fehler.push(`Braucht Friday ${m.braucht_friday}, installiert ist ${localVersion()}.`);
  if (m.braucht_friday && !/^[\s\d.x<>=^~*]+$/.test(String(m.braucht_friday))) fehler.push("„braucht_friday“ ist unlesbar.");
  const rechte = Array.isArray(m.rechte) ? m.rechte : [];
  for (const r of rechte) if (!RECHTE[r]) fehler.push(`Unbekanntes Recht „${r}“.`);
  const befehle = Array.isArray(m.befehle) ? m.befehle : [];
  if (!befehle.length) warnungen.push("Das Modul hat keine Befehle.");
  if (befehle.length > 50) fehler.push("Höchstens 50 Befehle pro Modul.");
  if (befehle.length && !rechte.includes("befehle")) fehler.push("Für Befehle braucht das Modul das Recht „befehle“.");
  const fremde = new Map();
  for (const a of andere) if (a.id !== m.id) for (const b of a.befehle || []) for (const s of b.saetze || []) fremde.set(norm(s), a.name);
  befehle.forEach((b, i) => {
    const saetze = Array.isArray(b?.saetze) ? b.saetze : [];
    if (!saetze.length) fehler.push(`Befehl ${i + 1}: „saetze“ fehlt.`);
    for (const s of saetze) {
      const n = norm(s);
      if (n.length < 2 || n.length > 120) fehler.push(`Befehl ${i + 1}: Satz „${String(s).slice(0, 30)}“ ist zu kurz oder zu lang.`);
      if (GESCHUETZT.test(n)) fehler.push(`Befehl ${i + 1}: „${s}“ gehört zu Fridays eingebauten Befehlen.`);
      if (fremde.has(n)) fehler.push(`Befehl ${i + 1}: „${s}“ benutzt schon das Modul „${fremde.get(n)}“.`);
      if ((n.match(/\*/g) || []).length > 3) fehler.push(`Befehl ${i + 1}: höchstens 3 Platzhalter (*).`);
    }
    if (!b?.antwort && !b?.friday) fehler.push(`Befehl ${i + 1}: braucht „antwort“ oder „friday“.`);
    if (b?.friday && !rechte.includes("claude")) fehler.push(`Befehl ${i + 1}: Weitergabe an Friday braucht das Recht „claude“.`);
    if (b?.mitteilung && !rechte.includes("mitteilung")) fehler.push(`Befehl ${i + 1}: Mitteilungen brauchen das Recht „mitteilung“.`);
    const texte = [].concat(b?.antwort || [], b?.friday || [], b?.mitteilung || []).map(String);
    if (texte.some((t) => t.length > 2000)) fehler.push(`Befehl ${i + 1}: Text zu lang.`);
  });
  if (rechte.includes("claude")) warnungen.push("Dieses Modul darf Sätze an Fridays Gehirn weitergeben – das kostet Guthaben.");
  return { ok: fehler.length === 0, fehler, warnungen };
}

// ---- Installierte Module ----
function stand() { try { return JSON.parse(fs.readFileSync(STAND, "utf8")); } catch { return {}; } }
function standSpeichern(s) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(STAND, JSON.stringify(s, null, 2)); }

function lesenOrdner(dir) {
  let dateien = [];
  try { dateien = fs.readdirSync(dir).filter((f) => f.endsWith(".json")); } catch { return []; }
  return dateien.map((f) => {
    try { return { datei: f, modul: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) }; } catch (err) { return { datei: f, modul: null, kaputt: err.message }; }
  });
}

let cache = null;
/** Alle installierten Module mit Prüfergebnis. Neue Dateien im Ordner werden dabei erkannt. */
export function installierte() {
  const st = stand();
  const roh = lesenOrdner(DIR);
  const module = roh.filter((r) => r.modul).map((r) => r.modul);
  const liste = roh.map((r) => {
    if (!r.modul) return { datei: r.datei, id: r.datei, name: r.datei, ok: false, an: false, pruefung: { ok: false, fehler: [`JSON kaputt: ${r.kaputt}`], warnungen: [] } };
    const pruefung = pruefeModul(r.modul, { andere: module });
    const s = st[r.modul.id] || {};
    const neuErkannt = !s.gesehen;
    return { ...r.modul, datei: r.datei, pruefung, an: Boolean(s.an) && pruefung.ok, neu: neuErkannt, installiert: s.installiert || null };
  });
  // Neue Dateien merken (aber nicht einschalten – das entscheidest du).
  let g = false;
  for (const m of liste) if (m.neu && m.id) { st[m.id] = { ...(st[m.id] || {}), gesehen: new Date().toISOString() }; g = true; eintragen({ bereich: "system", titel: `Neues Modul erkannt: ${m.name}`, details: m.pruefung.ok ? "Passt – wartet auf Einschalten" : m.pruefung.fehler.join(" · "), quelle: "automatisch" }); }
  if (g) standSpeichern(st);
  cache = liste;
  return liste;
}

export function katalog() {
  const inst = new Map((cache || installierte()).map((m) => [m.id, m]));
  return lesenOrdner(KATALOG_DIR).filter((r) => r.modul).map((r) => ({ ...r.modul, pruefung: pruefeModul(r.modul, { andere: [...inst.values()] }), installiert: inst.has(r.modul.id), installierteVersion: inst.get(r.modul.id)?.version || null }));
}

export function installiere(roh, { quelle = "eingefügt" } = {}) {
  let m = roh;
  if (typeof roh === "string") { try { m = JSON.parse(roh); } catch (err) { return { error: `Das ist kein gültiges JSON: ${err.message}` }; } }
  const andere = installierte().filter((x) => x.id !== m?.id);
  const pruefung = pruefeModul(m, { andere });
  if (!pruefung.ok) return { error: "Das Modul passt nicht zu Friday.", pruefung };
  const sauber = { id: m.id, name: String(m.name).slice(0, 60), version: m.version, beschreibung: String(m.beschreibung || "").slice(0, 400), autor: String(m.autor || "").slice(0, 60), braucht_friday: m.braucht_friday || "", rechte: m.rechte || [], befehle: m.befehle || [] };
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, `${m.id}.json`), JSON.stringify(sauber, null, 2));
  const st = stand();
  st[m.id] = { ...(st[m.id] || {}), gesehen: new Date().toISOString(), installiert: new Date().toISOString(), an: true, quelle };
  standSpeichern(st);
  eintragen({ bereich: "system", titel: `Modul installiert: ${sauber.name} ${sauber.version}`, details: `Rechte: ${sauber.rechte.join(", ") || "keine"}`, quelle: "dashboard" });
  cache = null;
  return { ok: true, modul: sauber, pruefung };
}

export function ausKatalog(id) {
  const k = lesenOrdner(KATALOG_DIR).find((r) => r.modul?.id === id);
  if (!k) return { error: "Nicht im Katalog." };
  return installiere(k.modul, { quelle: "katalog" });
}

export function schalte(id, an) {
  const m = installierte().find((x) => x.id === id);
  if (!m) return { error: "Modul nicht gefunden." };
  if (an && !m.pruefung.ok) return { error: "Das Modul hat die Kompatibilitätsprüfung nicht bestanden.", pruefung: m.pruefung };
  const st = stand();
  st[id] = { ...(st[id] || {}), an: Boolean(an) };
  standSpeichern(st);
  eintragen({ bereich: "system", titel: `Modul ${an ? "eingeschaltet" : "ausgeschaltet"}: ${m.name}`, quelle: "dashboard" });
  cache = null;
  return { ok: true };
}

export function entferne(id) {
  const m = installierte().find((x) => x.id === id);
  if (!m) return { error: "Modul nicht gefunden." };
  try { fs.unlinkSync(path.join(DIR, m.datei)); } catch (err) { return { error: err.message }; }
  const st = stand(); delete st[id]; standSpeichern(st);
  eintragen({ bereich: "system", titel: `Modul entfernt: ${m.name}`, quelle: "dashboard" });
  cache = null;
  return { ok: true };
}

// ---- Befehle der Module ausführen ----
function passt(satz, text) {
  const muster = norm(satz).split("*").map((t) => t.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`^${muster.join("\\s*(.+?)\\s*")}$`);
  return text.match(re);
}
function fuelle(vorlage, treffer) {
  const jetzt = new Date();
  return String(vorlage)
    .replace(/\{(\d)\}/g, (_, n) => treffer[Number(n)] || "")
    .replace(/\{zufall:(-?\d+)-(-?\d+)\}/g, (_, a, b) => String(Math.floor(Number(a) + Math.random() * (Number(b) - Number(a) + 1))))
    .replace(/\{zeit\}/g, jetzt.toLocaleTimeString("de-DE", { timeZone: config.timezone, hour: "2-digit", minute: "2-digit" }))
    .replace(/\{datum\}/g, jetzt.toLocaleDateString("de-DE", { timeZone: config.timezone, weekday: "long", day: "numeric", month: "long" }))
    .replace(/\{name\}/g, config.userName);
}
const zufaellig = (x) => (Array.isArray(x) ? x[Math.floor(Math.random() * x.length)] : x);

/**
 * Sandbox-Test (v1.186.0): Welche Antwort gäbe ein (noch nicht installiertes) Modul auf einen Satz?
 * Ohne Nebenwirkungen: Mitteilungen werden nicht geschickt, Weitergaben an Friday nur beschrieben.
 */
export function testeModul(m, satz) {
  const t = norm(satz);
  for (const b of m?.befehle || []) for (const s of b.saetze || []) {
    const tr = passt(s, t);
    if (!tr) continue;
    if (b.friday) return { treffer: true, art: "friday", text: `Würde an Friday weitergeben: „${fuelle(zufaellig(b.friday), tr)}“` };
    return { treffer: true, art: "antwort", text: fuelle(zufaellig(b.antwort || "Erledigt."), tr), mitteilung: b.mitteilung ? fuelle(zufaellig(b.mitteilung), tr) : null };
  }
  return { treffer: false, text: "" };
}

/** Sprachbefehl eines eingeschalteten Moduls? @returns {Promise<{answer:string, actions:string[]}|null>} */
export async function modulBefehl(text, ask) {
  const t = norm(text);
  if (!t || t.length > 300) return null;
  const liste = (cache || installierte()).filter((m) => m.an);
  for (const m of liste) {
    for (const b of m.befehle || []) {
      for (const s of b.saetze || []) {
        const tr = passt(s, t);
        if (!tr) continue;
        if (b.mitteilung) notifyAll(m.name, fuelle(zufaellig(b.mitteilung), tr)).catch(() => {});
        if (b.friday && ask) {
          const r = await ask({ text: fuelle(zufaellig(b.friday), tr), channel: "modul", keepHistory: false });
          return { answer: r.answer, actions: [`modul:${m.id}`, ...(r.actions || [])] };
        }
        return { answer: fuelle(zufaellig(b.antwort || "Erledigt."), tr), actions: [`modul:${m.id}`] };
      }
    }
  }
  return null;
}

// ---- Update-Sandbox: neue Version herunterladen und prüfen, ohne sie zu installieren ----
let letzterTest = null;
export function letzterUpdateTest() {
  if (letzterTest) return letzterTest;
  try { return { aus_update: true, text: fs.readFileSync(path.join(DATA_DIR, "testlabor-letztes.txt"), "utf8").split("\n")[0] }; } catch { return null; }
}
export async function updateTesten() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "friday-test-"));
  const start = Date.now();
  try {
    const tok = githubToken();
    const url = tok ? `https://api.github.com/repos/${config.updateRepo}/tarball/${encodeURIComponent(config.updateBranch)}` : `https://codeload.github.com/${config.updateRepo}/tar.gz/refs/heads/${config.updateBranch}`;
    const r = await fetch(url, { headers: tok ? { Authorization: `Bearer ${tok}`, "User-Agent": "Friday-Testlabor" } : { "User-Agent": "Friday-Testlabor" }, signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error(`GitHub antwortet mit ${r.status}`);
    const datei = path.join(tmp, "friday.tar.gz");
    fs.writeFileSync(datei, Buffer.from(await r.arrayBuffer()));
    fs.mkdirSync(path.join(tmp, "neu"));
    await new Promise((res, rej) => spawn("tar", ["-xzf", datei, "-C", path.join(tmp, "neu"), "--strip-components", "1"]).on("close", (c) => (c === 0 ? res() : rej(new Error("Download ist beschädigt")))).on("error", rej));
    const ergebnis = pruefeOrdner(path.join(tmp, "neu"));
    const inst = localVersion();
    const neuer = vergleiche(ergebnis.version, inst) > 0;
    // Passen die eigenen Module auch zur neuen Version?
    const modulWarnungen = !neuer ? [] : installierte().filter((m) => m.braucht_friday && !passtVersion(ergebnis.version, m.braucht_friday)).map((m) => `Modul „${m.name}“ passt nicht zu ${ergebnis.version} (braucht ${m.braucht_friday}).`);
    letzterTest = { ...ergebnis, warnungen: [...ergebnis.warnungen, ...modulWarnungen], installiert: inst, neuer, zeit: new Date().toISOString(), gesamt_ms: Date.now() - start };
    eintragen({ bereich: "update", titel: `Testlabor: Version ${ergebnis.version} ${ergebnis.ok ? "bestanden" : "durchgefallen"}`, details: ergebnis.ok ? `${ergebnis.geprueft} Dateien geprüft` : ergebnis.fehler.join(" · "), ok: ergebnis.ok, quelle: "dashboard" });
    return letzterTest;
  } catch (err) {
    return { ok: false, fehler: [`Test ging nicht: ${err.message}`], warnungen: [] };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Selbsttest der installierten Version (virtuelle Testumgebung für die eigene Installation). */
export function selbstTest() {
  return pruefeOrdner(path.resolve(ROOT, ".."));
}
