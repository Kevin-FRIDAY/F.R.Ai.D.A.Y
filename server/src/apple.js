// Mehr Apple-Apps (v1.134.0, Idee aus OpenJarvis "Apple Connectors"):
//   Notizen  – suchen, vorlesen, neue Notiz anlegen
//   Kontakte – Telefonnummer, Mail, Geburtstag nachschlagen, nächste Geburtstage
//   Musik    – Playlist oder Lied aus deiner Mediathek spielen, "was läuft gerade?", Zufall an/aus
//   Health   – Verlauf von Schritten, Schlaf, Puls, Gewicht … (Kurzbefehl vom iPhone oder Health-Export)
// Notizen, Kontakte und Musik laufen über den Mac-Agenten (AppleScript, kostenlos). Beim ersten Mal fragt macOS,
// ob Friday auf die App zugreifen darf: "OK" klicken.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { config, DATA_DIR } from "./config.js";
import { isAgentOnline, sendToAgent } from "./agent-hub.js";
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";

const boss = () => config.userName || "Boss";
const agent = (action, value, timeout = 60000) => sendToAgent(action, { value: JSON.stringify(value || {}) }, timeout);

function macFehler(r, app) {
  const e = String(r?.error || "");
  if (/nicht verbunden/.test(e)) return `Der Mac ist gerade nicht verbunden, ${boss()}. ${app} läuft über den Mac.`;
  if (/Unbekannte Aktion/.test(e)) return "Der Mac-Agent ist noch auf einem alten Stand. Starte Friday einmal neu, dann klappt es.";
  if (/-1743|not allowed|nicht erlaubt|Not authorized/i.test(e)) return `macOS erlaubt Friday den Zugriff auf ${app} noch nicht. Öffne Systemeinstellungen → Datenschutz & Sicherheit → Automation und erlaube node den Zugriff auf ${app}.`;
  if (/rechtzeitig/.test(e)) return `${app} hat zu lange gebraucht. Versuch es gleich nochmal.`;
  return `Das hat am Mac nicht geklappt: ${e || "unbekannter Fehler"}.`;
}
const basisHeute = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const abHeute = (s) => new Date(basisHeute() + Number(s) * 1000);
const datumText = (d) => d.toLocaleDateString("de-DE", { timeZone: config.timezone, day: "numeric", month: "long", year: "numeric" });

// ---------- Notizen ----------
export async function notizenListe(anzahl = 30) {
  const r = await agent("notizen_liste", { anzahl });
  if (!r.ok) return { error: macFehler(r, "Notizen") };
  return { notizen: (r.notizen || []).map((n) => ({ name: n.name, id: n.id, geaendert: abHeute(n.s).toISOString() })), gesamt: r.gesamt };
}
export async function notizenSuchen(text) {
  const r = await agent("notizen_suchen", { text });
  if (!r.ok) return { error: macFehler(r, "Notizen") };
  return { notizen: (r.notizen || []).map((n) => ({ name: n.name, id: n.id, geaendert: abHeute(n.s).toISOString(), text: n.text })) };
}
export async function notizLesen(id) {
  const r = await agent("notiz_lesen", { id });
  if (!r.ok) return { error: macFehler(r, "Notizen") };
  return { name: r.name, text: r.text };
}
export async function notizNeu({ titel, text, ordner }) {
  const r = await agent("notiz_neu", { titel, text, ordner });
  if (!r.ok) return { error: macFehler(r, "Notizen") };
  eintragen({ bereich: "apple", titel: `Notiz angelegt: ${String(titel || text || "").slice(0, 80)}`, details: `Ordner ${r.ordner}` });
  return { ok: true, ordner: r.ordner };
}

// ---------- Kontakte ----------
const gbDatum = (gb) => { const m = String(gb || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
export async function kontakteSuchen(name) {
  const r = await agent("kontakte_suchen", { name });
  if (!r.ok) return { error: macFehler(r, "Kontakte") };
  return { kontakte: (r.kontakte || []).map((k) => ({ ...k, telefon: k.telefon.map((t) => t.replace(/_\$!<(.+?)>!\$_/, "$1")) })) };
}
export async function geburtstage(tage = 60) {
  const r = await agent("kontakte_geburtstage", {});
  if (!r.ok) return { error: macFehler(r, "Kontakte") };
  const heute = new Date(basisHeute());
  const liste = [];
  for (const k of r.geburtstage || []) {
    const g = gbDatum(k.geburtstag);
    if (!g) continue;
    let naechster = new Date(heute.getFullYear(), g.m - 1, g.d);
    if (naechster < heute) naechster = new Date(heute.getFullYear() + 1, g.m - 1, g.d);
    const inTagen = Math.round((naechster - heute) / 86400000);
    if (inTagen > tage) continue;
    // Jahr 1604 = "Jahr unbekannt" bei Apple
    const alter = g.y > 1900 ? naechster.getFullYear() - g.y : null;
    liste.push({ name: k.name, datum: naechster.toISOString().slice(0, 10), in_tagen: inTagen, wird: alter });
  }
  return { geburtstage: liste.sort((a, b) => a.in_tagen - b.in_tagen) };
}

// ---------- Musik ----------
export async function musikStatus() {
  const r = await agent("musik_status", {}, 20000);
  if (!r.ok) return { error: macFehler(r, "Musik") };
  return { zustand: r.zustand, titel: r.titel, kuenstler: r.kuenstler, album: r.album, zufall: r.zufall };
}
export async function musikPlaylists() {
  const r = await agent("musik_playlists", {});
  if (!r.ok) return { error: macFehler(r, "Musik") };
  return { playlists: r.playlists || [] };
}
export async function musikPlaylist(name) {
  const r = await agent("musik_playlist", { name });
  if (!r.ok) return { error: /Keine Playlist/.test(r.error || "") ? `Eine Playlist „${name}“ finde ich in deiner Musik-App nicht.` : macFehler(r, "Musik") };
  eintragen({ bereich: "musik", titel: `Playlist gestartet: ${r.playlist}` });
  return { ok: true, playlist: r.playlist };
}
export async function musikSuchen(text) {
  const r = await agent("musik_suchen", { text });
  if (!r.ok) return { error: /Nichts in deiner Musik/.test(r.error || "") ? `„${text}“ finde ich nicht in deiner Mediathek.` : macFehler(r, "Musik") };
  eintragen({ bereich: "musik", titel: `Musik gestartet: ${text}`, details: r.titel?.[0] ? `${r.titel[0].name} – ${r.titel[0].kuenstler}` : "" });
  return { ok: true, titel: r.titel || [] };
}
export async function musikZufall(an) {
  const r = await agent("musik_zufall", { an });
  if (!r.ok) return { error: macFehler(r, "Musik") };
  return { zufall: r.zufall };
}

// ---------- Health: Verlauf ----------
// Ein Eintrag pro Tag: { tag, schritte, schlaf_stunden, ruhepuls, aktive_kalorien, gewicht, training_min, stehstunden, quelle }
const VERLAUF = "gesundheit-verlauf";
export const WERTE = {
  schritte: { name: "Schritte", einheit: "", ziel: 8000, summe: true },
  schlaf_stunden: { name: "Schlaf", einheit: "h", ziel: 7 },
  ruhepuls: { name: "Ruhepuls", einheit: "bpm" },
  aktive_kalorien: { name: "Aktive Kalorien", einheit: "kcal", summe: true },
  training_min: { name: "Training", einheit: "min", ziel: 30, summe: true },
  stehstunden: { name: "Stehstunden", einheit: "h", ziel: 12 },
  gewicht: { name: "Gewicht", einheit: "kg" },
};
const tagHeute = () => new Date().toLocaleString("sv-SE", { timeZone: config.timezone }).slice(0, 10);
export function verlauf(tage = 60) {
  const v = store.load(VERLAUF, []);
  return v.sort((a, b) => (a.tag < b.tag ? -1 : 1)).slice(-tage);
}
/** Vom Kurzbefehl (POST /api/health) oder aus dem Export. Felder ohne Zahl bleiben unverändert. */
export function verlaufSpeichern(eintrag, tag = tagHeute(), quelle = "kurzbefehl") {
  const v = store.load(VERLAUF, []);
  let e = v.find((x) => x.tag === tag);
  if (!e) { e = { tag }; v.push(e); }
  for (const k of Object.keys(WERTE)) {
    const n = Number(eintrag[k]);
    if (eintrag[k] != null && eintrag[k] !== "" && Number.isFinite(n)) e[k] = Math.round(n * 10) / 10;
  }
  e.quelle = quelle;
  e.empfangen = new Date().toISOString();
  store.save(VERLAUF, v.sort((a, b) => (a.tag < b.tag ? -1 : 1)).slice(-800));
  return e;
}
export function gesundheitUebersicht() {
  const v = verlauf(400);
  const letzte7 = v.slice(-7), vorher7 = v.slice(-14, -7);
  const schnitt = (l, k) => { const z = l.map((x) => x[k]).filter((n) => Number.isFinite(n)); return z.length ? Math.round((z.reduce((a, b) => a + b, 0) / z.length) * 10) / 10 : null; };
  const trends = {};
  for (const k of Object.keys(WERTE)) trends[k] = { woche: schnitt(letzte7, k), vorwoche: schnitt(vorher7, k), letzter: [...v].reverse().find((x) => Number.isFinite(x[k]))?.[k] ?? null };
  return { verlauf: v.slice(-90), trends, werte: WERTE, letzter_tag: v.at(-1)?.tag || null, import: store.load("gesundheit-import", null) };
}
/** Kurzer gesprochener Satz zur Gesundheit (für Briefing und Fragen). */
export function gesundheitSatz(frage = "") {
  const u = gesundheitUebersicht();
  if (!u.letzter_tag) return null;
  const t = u.trends;
  const f = String(frage).toLowerCase();
  const z = (n) => Math.round(n).toLocaleString("de-DE");
  const h = (n) => `${String(Math.round(n * 10) / 10).replace(".", ",")} Stunden`;
  if (/schlaf|geschlafen|müde/.test(f) && t.schlaf_stunden.letzter != null) return `Du hast zuletzt ${h(t.schlaf_stunden.letzter)} geschlafen${t.schlaf_stunden.woche != null ? `, im Schnitt der letzten Woche ${h(t.schlaf_stunden.woche)}` : ""}.`;
  if (/schritt|gelaufen|bewegt/.test(f) && t.schritte.letzter != null) return `Zuletzt waren es ${z(t.schritte.letzter)} Schritte${t.schritte.woche != null ? `, diese Woche im Schnitt ${z(t.schritte.woche)} am Tag` : ""}${t.schritte.vorwoche ? (t.schritte.woche > t.schritte.vorwoche ? ", mehr als in der Woche davor" : ", weniger als in der Woche davor") : ""}.`;
  if (/puls|herz/.test(f) && t.ruhepuls.letzter != null) return `Dein Ruhepuls liegt bei ${z(t.ruhepuls.letzter)} Schlägen pro Minute${t.ruhepuls.woche != null ? `, im Wochenschnitt ${z(t.ruhepuls.woche)}` : ""}.`;
  if (/gewicht|wiege|kilo/.test(f) && t.gewicht.letzter != null) return `Zuletzt hast du ${String(t.gewicht.letzter).replace(".", ",")} Kilo gewogen.`;
  const teile = [];
  if (t.schritte.letzter != null) teile.push(`${z(t.schritte.letzter)} Schritte`);
  if (t.schlaf_stunden.letzter != null) teile.push(`${h(t.schlaf_stunden.letzter)} Schlaf`);
  if (t.ruhepuls.letzter != null) teile.push(`Ruhepuls ${z(t.ruhepuls.letzter)}`);
  return teile.length ? `Deine letzten Werte: ${teile.join(", ")}.` : null;
}

// ---------- Health-Export vom iPhone einlesen (Health-App → Profilbild → Alle Gesundheitsdaten exportieren) ----------
const TYPEN = {
  HKQuantityTypeIdentifierStepCount: ["schritte", "summe"],
  HKQuantityTypeIdentifierActiveEnergyBurned: ["aktive_kalorien", "summe"],
  HKQuantityTypeIdentifierAppleExerciseTime: ["training_min", "summe"],
  HKQuantityTypeIdentifierRestingHeartRate: ["ruhepuls", "schnitt"],
  HKQuantityTypeIdentifierBodyMass: ["gewicht", "letzter"],
  HKCategoryTypeIdentifierAppleStandHour: ["stehstunden", "stehen"],
  HKCategoryTypeIdentifierSleepAnalysis: ["schlaf_stunden", "schlaf"],
};
let importLaeuft = null;
export function importStand() { return importLaeuft || store.load("gesundheit-import", null); }

/** Liest export.zip oder export.xml (Datei auf dem Mac) und füllt den Verlauf der letzten 365 Tage. */
export async function exportEinlesen(datei) {
  if (importLaeuft?.laeuft) return { error: "Ein Import läuft schon." };
  importLaeuft = { laeuft: true, start: new Date().toISOString(), zeilen: 0 };
  const grenze = new Date(Date.now() - 366 * 86400000).toISOString().slice(0, 10);
  // pro Tag, pro Wert, pro Quelle (iPhone und Watch zählen Schritte doppelt – wir nehmen die größere Quelle)
  const tage = new Map();
  const add = (tag, feld, quelle, wert, art) => {
    if (tag < grenze) return;
    let t = tage.get(tag); if (!t) { t = {}; tage.set(tag, t); }
    let f = t[feld]; if (!f) { f = {}; t[feld] = f; }
    let q = f[quelle]; if (!q) { q = { s: 0, n: 0, letzter: null, zeit: "" }; f[quelle] = q; }
    if (art === "letzter") { q.letzter = wert; q.s = wert; q.n = 1; return; }
    q.s += wert; q.n += 1;
  };
  const attr = (z, n) => { const m = z.match(new RegExp(`\\s${n}="([^"]*)"`)); return m ? m[1] : ""; };
  try {
    const istZip = /\.zip$/i.test(datei) || fs.readFileSync(datei, { encoding: null, flag: "r" }).subarray(0, 2).toString() === "PK";
    const proc = istZip ? spawn("unzip", ["-p", datei, "apple_health_export/export.xml"]) : null;
    const quelle = proc ? proc.stdout : fs.createReadStream(datei);
    let fehlerText = "";
    proc?.stderr.on("data", (d) => { fehlerText += String(d).slice(0, 300); });
    const rl = readline.createInterface({ input: quelle, crlfDelay: Infinity });
    for await (const z of rl) {
      importLaeuft.zeilen++;
      if (!z.includes("<Record ")) continue;
      const typ = attr(z, "type");
      const ziel = TYPEN[typ];
      if (!ziel) continue;
      const [feld, art] = ziel;
      const start = attr(z, "startDate"), ende = attr(z, "endDate");
      const src = attr(z, "sourceName") || "?";
      if (art === "schlaf") {
        const v = attr(z, "value");
        if (!/Asleep/.test(v)) continue; // nur echter Schlaf, nicht "im Bett"
        const ms = new Date(ende.replace(" ", "T").replace(/ ([+-]\d{2})(\d{2})$/, "$1:$2")) - new Date(start.replace(" ", "T").replace(/ ([+-]\d{2})(\d{2})$/, "$1:$2"));
        if (ms > 0 && ms < 16 * 3600000) add(ende.slice(0, 10), feld, src, ms / 3600000, "summe");
        continue;
      }
      if (art === "stehen") { if (/Stood/.test(attr(z, "value"))) add(start.slice(0, 10), feld, src, 1, "summe"); continue; }
      const wert = Number(attr(z, "value"));
      if (!Number.isFinite(wert)) continue;
      let w = wert;
      if (feld === "gewicht" && /lb/i.test(attr(z, "unit"))) w = wert * 0.4536;
      if (feld === "aktive_kalorien" && /kJ/i.test(attr(z, "unit"))) w = wert / 4.184;
      add(start.slice(0, 10), feld, src, w, art === "letzter" ? "letzter" : art);
    }
    if (proc) {
      const code = await new Promise((ok) => (proc.exitCode != null ? ok(proc.exitCode) : proc.on("close", ok)));
      if (code && !tage.size) throw new Error(fehlerText.includes("filename not matched") ? "In der ZIP-Datei fehlt export.xml. Ist das der Export aus der Health-App?" : `Die ZIP-Datei ließ sich nicht öffnen (${fehlerText.trim().slice(0, 120) || code})`);
    }
    let n = 0;
    for (const [tag, felder] of [...tage.entries()].sort()) {
      const e = {};
      for (const [feld, quellen] of Object.entries(felder)) {
        const qs = Object.values(quellen);
        const art = Object.values(TYPEN).find(([f]) => f === feld)?.[1];
        if (art === "schnitt") { const s = qs.reduce((a, q) => a + q.s, 0), c = qs.reduce((a, q) => a + q.n, 0); e[feld] = c ? s / c : null; }
        else if (art === "letzter") e[feld] = qs.at(-1).letzter;
        else e[feld] = Math.max(...qs.map((q) => q.s)); // größte Quelle (keine Doppelzählung)
      }
      verlaufSpeichern(e, tag, "export");
      n++;
    }
    const fertig = { laeuft: false, fertig: new Date().toISOString(), tage: n, zeilen: importLaeuft.zeilen };
    store.save("gesundheit-import", fertig);
    importLaeuft = fertig;
    eintragen({ bereich: "apple", titel: `Health-Export eingelesen: ${n} Tage`, quelle: "dashboard" });
    return { ok: true, tage: n };
  } catch (err) {
    importLaeuft = { laeuft: false, fehler: err.message };
    return { error: err.message };
  } finally {
    try { if (datei.startsWith(os.tmpdir()) || datei.startsWith(path.join(DATA_DIR, "tmp"))) fs.rmSync(datei, { force: true }); } catch { /* egal */ }
  }
}

// ---------- Sprache (ohne Claude) ----------
const norm = (t) => String(t || "").replace(/\s+/g, " ").trim().replace(/^(hey |hallo |ok |okay )?friday[, ]+/i, "");
export async function quickCommand(text) {
  const roh = norm(text).replace(/[?!.]+$/, "");
  const t = roh.toLowerCase();
  const rohAb = (teil) => { const i = t.lastIndexOf(teil); return i >= 0 ? roh.slice(i, i + teil.length) : teil; };
  if (/^((öffne|zeig)( mir)? )?(die )?apple[- ]?(apps|zentrale)( öffnen)?$/.test(t)) return { answer: "Hier sind deine Apple-Apps: Notizen, Kontakte, Musik und Gesundheit.", actions: ["apple"] };

  // Notizen
  let m = t.match(/^(?:such(?:e)?|durchsuche|finde)(?: mir)? (?:in )?(?:meine[n]?|den) notizen(?: nach| zu| über)? (.{2,80})$/) || t.match(/^(?:hab ich|habe ich) (?:eine )?notiz(?:en)? (?:zu|über|mit|von) (.{2,80})$/);
  if (m) {
    const q = rohAb(m[1]);
    const r = await notizenSuchen(q);
    if (r.error) return { answer: r.error, actions: ["apple:notizen"] };
    if (!r.notizen.length) return { answer: `In deinen Notizen finde ich nichts zu „${q}“.`, actions: [`apple:notizen:${encodeURIComponent(q)}`] };
    const erste = r.notizen[0];
    const vorschau = String(erste.text || "").split("\n").slice(1).join(" ").replace(/\s+/g, " ").trim().slice(0, 220);
    return { answer: `${r.notizen.length === 1 ? "Eine Notiz passt" : `${r.notizen.length} Notizen passen`}. Die erste heißt „${erste.name}“${vorschau ? `: ${vorschau}` : "."}`, actions: [`apple:notizen:${encodeURIComponent(q)}`] };
  }
  m = t.match(/^(?:neue notiz|notiz anlegen|leg(?:e)? (?:eine )?(?:neue )?notiz an|mach(?:e)? (?:mir )?(?:eine )?notiz|schreib(?:e)? (?:mir )?(?:eine|in die|in meine) notiz(?:en)?)[:,]? (.{2,2000})$/);
  if (m) {
    const inhalt = roh.slice(roh.length - m[1].length).replace(/^(dass|das) /i, "").trim();
    const [titel, ...rest] = inhalt.split(/(?<=[.:])\s+/);
    const r = await notizNeu({ titel: titel.replace(/[.:]$/, "").slice(0, 80), text: rest.length ? rest.join(" ") : inhalt });
    if (r.error) return { answer: r.error, actions: ["apple:notizen"] };
    return { answer: `Notiert, Boss. Die Notiz liegt in deiner Notizen-App im Ordner ${r.ordner}.`, actions: ["apple:notizen"] };
  }
  if (/^(zeig|lies)( mir)? (meine )?(letzten|neuesten) notizen( vor)?$/.test(t)) {
    const r = await notizenListe(8);
    if (r.error) return { answer: r.error, actions: ["apple:notizen"] };
    return { answer: r.notizen.length ? `Deine neuesten Notizen: ${r.notizen.slice(0, 5).map((n) => n.name).join(", ")}.` : "Deine Notizen-App ist leer.", actions: ["apple:notizen"] };
  }

  // Kontakte
  m = t.match(/^(?:wie|was) (?:ist|lautet) (?:die )?(nummer|telefonnummer|handynummer|mail|e-mail|email|mailadresse|adresse) (?:von|vom) (.{2,60})$/) || t.match(/^(?:wann hat) (.{2,60}) geburtstag$/);
  if (m) {
    const geb = !m[2];
    const name = rohAb(geb ? m[1] : m[2]).replace(/^(der |die |dem |den )/i, "");
    const r = await kontakteSuchen(name);
    if (r.error) return { answer: r.error, actions: ["apple:kontakte"] };
    const k = r.kontakte[0];
    if (!k) return { answer: `„${name}“ finde ich nicht in deinen Kontakten.`, actions: [`apple:kontakte:${encodeURIComponent(name)}`] };
    let ans;
    if (geb) {
      const g = gbDatum(k.geburtstag);
      ans = g ? `${k.name} hat am ${new Date(2000, g.m - 1, g.d).toLocaleDateString("de-DE", { day: "numeric", month: "long" })} Geburtstag${g.y > 1900 ? `, geboren ${g.y}` : ""}.` : `Bei ${k.name} ist kein Geburtstag eingetragen.`;
    } else if (/mail/.test(m[1])) ans = k.email.length ? `Die Mail-Adresse von ${k.name} ist ${k.email[0]}.` : `Bei ${k.name} ist keine Mail-Adresse eingetragen.`;
    else ans = k.telefon.length ? `${k.name}: ${k.telefon.slice(0, 2).join(", ")}.` : `Bei ${k.name} ist keine Nummer eingetragen.`;
    return { answer: ans, actions: [`apple:kontakte:${encodeURIComponent(name)}`] };
  }
  if (/^(wer hat (bald|demnächst|als nächstes|diese woche|diesen monat) geburtstag|(zeig|nenn)( mir)? (die )?(nächsten )?geburtstage|welche geburtstage (stehen an|kommen))$/.test(t)) {
    const tage = /woche/.test(t) ? 7 : 31;
    const r = await geburtstage(tage);
    if (r.error) return { answer: r.error, actions: ["apple:kontakte"] };
    if (!r.geburtstage.length) return { answer: `In den nächsten ${tage === 7 ? "sieben Tagen" : "vier Wochen"} hat niemand aus deinen Kontakten Geburtstag.`, actions: ["apple:kontakte"] };
    const wann = (g) => (g.in_tagen === 0 ? "heute" : g.in_tagen === 1 ? "morgen" : `in ${g.in_tagen} Tagen`);
    return { answer: `Die nächsten Geburtstage: ${r.geburtstage.slice(0, 5).map((g) => `${g.name} ${wann(g)}${g.wird ? ` (wird ${g.wird})` : ""}`).join(", ")}.`, actions: ["apple:kontakte"] };
  }

  // Musik (Apple Music-App; Spotify hat eigene Befehle)
  if (!/spotify/.test(t)) {
    if (/^(was (läuft|spielt|hör ich|höre ich) (da )?(gerade|grad)?|welches lied (ist das|läuft( gerade)?))$/.test(t)) {
      const r = await musikStatus();
      if (r.error) return null; // vielleicht Spotify – dann entscheidet der Rest
      if (r.zustand === "stopped" || !r.titel) return null; // vielleicht läuft Spotify

      return { answer: `Gerade ${r.zustand === "paused" ? "pausiert" : "läuft"} ${r.titel} von ${r.kuenstler}.`, actions: ["apple:musik"] };
    }
    m = t.match(/^(?:spiel(?:e)?|starte|mach)(?: mir)?(?: die| meine)? playlist (.{2,80}?)(?: an| ab)?$/);
    if (m) {
      const name = rohAb(m[1]);
      const r = await musikPlaylist(name);
      return { answer: r.error || `Die Playlist ${r.playlist} läuft.`, actions: ["apple:musik"] };
    }
    m = t.match(/^(?:spiel(?:e)?|play)(?: mir)? (.{2,80}?)(?: aus meiner (?:musik|mediathek)| in (?:apple )?music| auf dem mac)$/);
    if (m) {
      const q = rohAb(m[1]).replace(/^(das lied |den song |etwas von |was von |musik von )/i, "");
      const r = await musikSuchen(q);
      return { answer: r.error || `Läuft: ${r.titel[0]?.name}${r.titel[0]?.kuenstler ? ` von ${r.titel[0].kuenstler}` : ""}.`, actions: ["apple:musik"] };
    }
    if (/^(zufallswiedergabe|shuffle|zufall) (an|ein|aus)$/.test(t) || /^(mische|misch) (die musik|alles)$/.test(t)) {
      const an = !/aus$/.test(t);
      const r = await musikZufall(an);
      return { answer: r.error || `Zufallswiedergabe ist ${r.zufall ? "an" : "aus"}.`, actions: ["apple:musik"] };
    }
  }

  // Gesundheit
  if (/^(wie (habe|hab) ich (heute nacht |letzte nacht )?geschlafen|wie viele schritte (habe|hab|bin) ich( heute| gestern| diese woche)?( gemacht| gelaufen| gegangen)?|wie ist mein (ruhe)?puls|wie viel wiege ich|wie geht es meiner gesundheit|zeig( mir)? meine gesundheit(sdaten)?|öffne (die )?gesundheit)$/.test(t)) {
    const satz = gesundheitSatz(t);
    if (!satz) return { answer: "Ich habe noch keine Gesundheitsdaten vom iPhone. Richte den Kurzbefehl ein oder lade im Fenster Apple-Apps den Health-Export hoch.", actions: ["apple:gesundheit"] };
    return { answer: satz, actions: ["apple:gesundheit"] };
  }
  return null;
}

// ---------- Claude-Werkzeuge ----------
export const toolDefinitions = [
  {
    name: "apple_notizen",
    description: "Apple Notizen auf dem Mac: aktion=suchen (text), lesen (id aus einer Suche), liste (neueste), neu (titel, text, optional ordner). Für 'such in meinen Notizen nach …', 'schreib mir eine Notiz …'.",
    input_schema: { type: "object", properties: { aktion: { type: "string", enum: ["suchen", "lesen", "liste", "neu"] }, text: { type: "string" }, id: { type: "string" }, titel: { type: "string" }, ordner: { type: "string" } }, required: ["aktion"] },
  },
  {
    name: "apple_kontakte",
    description: "Apple Kontakte auf dem Mac (nur lesen): aktion=suchen (name) liefert Telefon, Mail, Geburtstag, Firma; aktion=geburtstage (tage) die nächsten Geburtstage.",
    input_schema: { type: "object", properties: { aktion: { type: "string", enum: ["suchen", "geburtstage"] }, name: { type: "string" }, tage: { type: "number" } }, required: ["aktion"] },
  },
  {
    name: "apple_musik",
    description: "Apple Music-App auf dem Mac: aktion=status (was läuft), playlists, playlist (name spielen), suchen (text: Lied/Künstler/Album aus der Mediathek spielen), zufall (an true/false). Für Spotify nimm das spotify-Werkzeug, für Pause/Weiter das mac-Werkzeug.",
    input_schema: { type: "object", properties: { aktion: { type: "string", enum: ["status", "playlists", "playlist", "suchen", "zufall"] }, name: { type: "string" }, text: { type: "string" }, an: { type: "boolean" } }, required: ["aktion"] },
  },
];
export const TOOL_NAMEN = new Set(toolDefinitions.map((t) => t.name));

export async function runTool(name, input = {}) {
  if (!isAgentOnline()) return { error: "Der Mac ist gerade nicht verbunden." };
  if (name === "apple_notizen") {
    if (input.aktion === "suchen") return notizenSuchen(String(input.text || ""));
    if (input.aktion === "lesen") return notizLesen(String(input.id || ""));
    if (input.aktion === "neu") return notizNeu(input);
    return notizenListe(20);
  }
  if (name === "apple_kontakte") {
    if (input.aktion === "geburtstage") return geburtstage(Number(input.tage) || 30);
    return kontakteSuchen(String(input.name || ""));
  }
  if (name === "apple_musik") {
    if (input.aktion === "playlists") return musikPlaylists();
    if (input.aktion === "playlist") return musikPlaylist(String(input.name || ""));
    if (input.aktion === "suchen") return musikSuchen(String(input.text || input.name || ""));
    if (input.aktion === "zufall") return musikZufall(input.an !== false);
    return musikStatus();
  }
  return { error: "Unbekanntes Werkzeug" };
}

export function appleRouten(app, asyncRoute) {
  const mac = (res) => { if (!isAgentOnline()) { res.status(503).json({ error: `Der Mac ist gerade nicht verbunden, ${boss()}.` }); return false; } return true; };
  const antwort = (res, r) => (r?.error ? res.status(400).json(r) : res.json(r));
  app.get("/api/apple", (req, res) => res.json({ mac: isAgentOnline(), gesundheit: gesundheitUebersicht() }));
  app.get("/api/apple/notizen", asyncRoute(async (req, res) => { if (!mac(res)) return; antwort(res, req.query.q ? await notizenSuchen(String(req.query.q).slice(0, 100)) : await notizenListe(Math.min(100, Number(req.query.n) || 40))); }));
  app.get("/api/apple/notiz", asyncRoute(async (req, res) => { if (!mac(res)) return; antwort(res, await notizLesen(String(req.query.id || ""))); }));
  app.post("/api/apple/notiz", asyncRoute(async (req, res) => { if (!mac(res)) return; antwort(res, await notizNeu({ titel: String(req.body?.titel || ""), text: String(req.body?.text || ""), ordner: String(req.body?.ordner || "") })); }));
  app.get("/api/apple/kontakte", asyncRoute(async (req, res) => { if (!mac(res)) return; antwort(res, await kontakteSuchen(String(req.query.q || "").slice(0, 80))); }));
  app.get("/api/apple/geburtstage", asyncRoute(async (req, res) => { if (!mac(res)) return; antwort(res, await geburtstage(Math.min(366, Number(req.query.tage) || 60))); }));
  app.get("/api/apple/musik", asyncRoute(async (req, res) => {
    if (!mac(res)) return;
    const [s, p] = await Promise.all([musikStatus(), musikPlaylists()]);
    res.json({ status: s.error ? null : s, playlists: p.playlists || [], fehler: s.error || p.error || null });
  }));
  app.post("/api/apple/musik", asyncRoute(async (req, res) => {
    if (!mac(res)) return;
    const b = req.body || {};
    if (b.aktion === "playlist") return antwort(res, await musikPlaylist(String(b.name || "")));
    if (b.aktion === "suchen") return antwort(res, await musikSuchen(String(b.text || "")));
    if (b.aktion === "zufall") return antwort(res, await musikZufall(b.an !== false));
    if (["music_play_pause", "music_next", "music_previous"].includes(b.aktion)) return antwort(res, await sendToAgent(b.aktion, {}));
    res.status(400).json({ error: "Unbekannte Aktion" });
  }));
  app.get("/api/apple/gesundheit", (req, res) => res.json(gesundheitUebersicht()));
  app.post("/api/apple/gesundheit", (req, res) => {
    const tag = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.tag || "")) ? req.body.tag : tagHeute();
    verlaufSpeichern(req.body || {}, tag, "dashboard");
    res.json(gesundheitUebersicht());
  });
  // Health-Export: die Datei kommt roh (nicht als JSON), weil sie groß sein kann (export.zip oft 50–500 MB).
  app.get("/api/apple/gesundheit/import", (req, res) => res.json(importStand() || {}));
  app.post("/api/apple/gesundheit/import", asyncRoute(async (req, res) => {
    if (importLaeuft?.laeuft) return res.status(409).json({ error: "Ein Import läuft schon." });
    const tmpDir = path.join(DATA_DIR, "tmp");
    fs.mkdirSync(tmpDir, { recursive: true });
    const name = String(req.query.name || "export.zip");
    const datei = path.join(tmpDir, `health-${Date.now()}${/\.xml$/i.test(name) ? ".xml" : ".zip"}`);
    let groesse = 0;
    const MAX = 2 * 1024 * 1024 * 1024;
    await new Promise((ok, nein) => {
      const out = fs.createWriteStream(datei);
      req.on("data", (c) => { groesse += c.length; if (groesse > MAX) { req.destroy(); nein(new Error("Die Datei ist größer als 2 GB.")); } });
      req.pipe(out);
      out.on("finish", ok);
      out.on("error", nein);
      req.on("error", nein);
    });
    if (groesse < 100) { fs.rmSync(datei, { force: true }); return res.status(400).json({ error: "Die Datei ist leer." }); }
    // Im Hintergrund einlesen, das Dashboard fragt den Stand ab.
    exportEinlesen(datei).catch(() => {});
    res.json({ ok: true, groesse });
  }));
}
