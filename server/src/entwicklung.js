// Entwicklungs-Labor (v1.186.0, Mark XV). Friday entwickelt sich weiter – aber nur in der Sandbox und mit Tests.
//
//  🏭 Skill Factory       Neue Fähigkeit oder neues Modul aus einer Vorlage. Erst Entwurf in der Sandbox, dann laufen
//                         Tests (Kompatibilität, Sicherheits-Prüfung, deine Beispielsätze). Nur wenn ALLE bestehen,
//                         gibt es den Knopf „Aktivieren“ – und den drückst du. Module sind JSON (keine Programme).
//  🔍 Code-Analyse        Friday prüft ihren eigenen Code: Syntax + Importe (Testlabor), Größe, sehr lange Dateien,
//                         leere Fehlerfänger, TODO-Stellen, Exporte, die nirgends benutzt werden → Note + Vorschläge.
//  🐞 Fehler-Werkstatt    Fehler aus dem Logbuch gruppiert. Nachstellbare Fehler (Funktionstest, Agent) werden echt
//                         nachgestellt. Dazu ein Reparaturvorschlag aus festen Regeln (optional lokale KI, kostenlos).
//  📜 Entwicklungsprotokoll Lesbare Versionsgeschichte (aus den Anleitungen) + was die Fabrik gebaut hat.
//  ♻️ Recovery Brain      Datenprüfung: jede Datei in server/data lesbar? Kaputte JSON-Dateien kann Friday aus dem
//                         Änderungs-Protokoll zurückholen (vorher wird die kaputte Datei aufgehoben).
//                         Dazu Stand von Sicherung, Rollback und Notfall-Gehirn.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ROOT } from "./config.js";
import * as store from "./store.js";
import { eintragen, suche as logbuchSuche } from "./logbuch.js";

const REPO = path.resolve(ROOT, "..");
const NAME = "entwicklung";
const lade = () => ({ entwuerfe: [], protokoll: [], analyse: null, recovery: null, ...store.load(NAME, {}) });
const sichere = (d) => { d.entwuerfe = d.entwuerfe.slice(-40); d.protokoll = d.protokoll.slice(-200); store.save(NAME, d); };
const neueId = () => Math.random().toString(36).slice(2, 10);
const kurz = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const jetzt = () => new Date().toISOString();
function protokolliere(d, art, text) { d.protokoll.push({ at: jetzt(), art, text: kurz(text, 300) }); }

// ---------- 🏭 Skill Factory ----------
export const VORLAGEN = [
  { id: "antwort", art: "modul", name: "Feste Antwort", text: "Friday antwortet auf einen Satz immer gleich (z. B. WLAN-Passwort für Gäste, Öffnungszeiten).", felder: { saetze: "wlan für gäste, gäste wlan", antwort: "Das Gäste-WLAN heißt …", beispiele: "wlan für gäste" } },
  { id: "zufall", art: "modul", name: "Zufalls-Antwort", text: "Mehrere Antworten, Friday wählt eine (z. B. Motivation, Witz, Würfel). Mit {zufall:1-6} für Zahlen.", felder: { saetze: "motivier mich, gib mir motivation", antwort: "Du schaffst das!|Ein Schritt nach dem anderen.|Heute ist dein Tag.", beispiele: "motivier mich" } },
  { id: "platzhalter", art: "modul", name: "Satz mit Lücke", text: "Ein * im Satz fängt ein Wort ein, das in der Antwort als {1} wieder auftaucht.", felder: { saetze: "sag * dass ich später komme", antwort: "Okay, ich würde {1} Bescheid geben, dass du später kommst.", beispiele: "sag Anna dass ich später komme" } },
  { id: "weitergabe", art: "modul", name: "Weitergabe an Friday", text: "Ein kurzer Satz wird zu einem ausführlichen Auftrag an Fridays Gehirn (kostet etwas Guthaben).", felder: { saetze: "wochenplan", friday: "Erstelle mir einen Wochenplan aus meinen Terminen und Aufgaben, kurz und vorlesbar.", beispiele: "wochenplan" } },
  { id: "faehigkeit", art: "faehigkeit", name: "Fähigkeit (Anleitung)", text: "Eine Anleitung, die Friday bekommt, wenn bestimmte Wörter fallen (z. B. so vergleichst du Autos).", felder: { ausloeser: "auto, autos, vergleich", anleitung: "Wenn Boss Autos vergleichen will: Nenne Preis, Verbrauch, Platz und Zuverlässigkeit in kurzen Sätzen und gib am Ende eine klare Empfehlung.", beispiele: "vergleich mal zwei autos" } },
];
const liste = (s, trenner = ",") => String(s || "").split(trenner).map((x) => x.trim()).filter(Boolean);
const slug = (n) => String(n || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 38) || "modul";

/** Aus Vorlage + Feldern einen Entwurf bauen (noch nichts aktiv). */
function bauen(vorlageId, f = {}) {
  const v = VORLAGEN.find((x) => x.id === vorlageId);
  if (!v) return { error: "Unbekannte Vorlage." };
  const name = kurz(f.name || v.name, 60);
  if (v.art === "faehigkeit") return { art: "faehigkeit", inhalt: { name, beschreibung: kurz(f.beschreibung, 160), ausloeser: liste(f.ausloeser).map((x) => x.toLowerCase()), text: String(f.anleitung || "").trim() } };
  const befehl = { saetze: liste(f.saetze) };
  if (vorlageId === "weitergabe") befehl.friday = String(f.friday || "").trim();
  else befehl.antwort = vorlageId === "zufall" ? liste(f.antwort, "|") : String(f.antwort || "").trim();
  return { art: "modul", inhalt: { id: slug(f.id || name), name, version: "1.0.0", beschreibung: kurz(f.beschreibung || v.text, 300), autor: "Friday Skill Factory", rechte: vorlageId === "weitergabe" ? ["befehle", "claude"] : ["befehle"], befehle: [befehl] } };
}

/** Alle Sandbox-Tests für einen Entwurf. Echt ausgeführt, ohne Nebenwirkungen. */
export async function testen(entwurf, beispiele = []) {
  const tests = [];
  const add = (name, ok, text) => tests.push({ name, ok: Boolean(ok), text });
  const { pruefeText } = await import("./waechter.js");
  if (entwurf.art === "modul") {
    const M = await import("./modulsystem.js");
    const andere = M.installierte().filter((x) => x.id !== entwurf.inhalt.id);
    const p = M.pruefeModul(entwurf.inhalt, { andere });
    add("Kompatibilität", p.ok, p.ok ? `Passt zu Friday${p.warnungen.length ? ` (${p.warnungen.join(" ")})` : ""}.` : p.fehler.join(" · "));
    const texte = JSON.stringify(entwurf.inhalt.befehle);
    const w = pruefeText(texte);
    add("Sicherheits-Prüfung", !w.verdaechtig, w.verdaechtig ? `Verdächtig: ${w.funde.map((x) => x.art).join(", ")}` : "Keine versteckten Befehle oder Tricks.");
    for (const b of beispiele) {
      const r = M.testeModul(entwurf.inhalt, b);
      add(`Beispiel „${kurz(b, 40)}“`, r.treffer, r.treffer ? `→ ${kurz(r.text, 160)}` : "Kein Satz des Moduls passt. Sätze anpassen.");
    }
    if (!beispiele.length) add("Beispiele", false, "Mindestens einen Beispielsatz zum Testen angeben.");
  } else {
    const i = entwurf.inhalt;
    add("Vollständig", i.name && i.ausloeser.length && i.text.length >= 15 && i.text.length <= 4000, i.ausloeser.length ? (i.text.length >= 15 ? "Name, Auslöser und Anleitung sind da." : "Die Anleitung ist zu kurz (mindestens 15 Zeichen).") : "Mindestens ein Auslöser-Wort.");
    const w = pruefeText(`${i.name}\n${i.text}`);
    add("Sicherheits-Prüfung", !w.verdaechtig, w.verdaechtig ? `Verdächtig: ${w.funde.map((x) => x.art).join(", ")}` : "Keine versteckten Befehle oder Tricks.");
    const F = await import("./faehigkeiten.js");
    const doppelt = F.alle().find((x) => x.name.toLowerCase() === i.name.toLowerCase());
    add("Kein Doppel", !doppelt, doppelt ? `Es gibt schon die Fähigkeit „${doppelt.name}“.` : "Name ist frei.");
    for (const b of beispiele) {
      const f = ` ${String(b).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `;
      const wort = i.ausloeser.find((w2) => f.includes(` ${w2} `) || (w2.length >= 5 && f.includes(` ${w2}`)));
      add(`Beispiel „${kurz(b, 40)}“`, wort, wort ? `Auslöser „${wort}“ greift.` : "Kein Auslöser-Wort kommt vor.");
    }
    if (!beispiele.length) add("Beispiele", false, "Mindestens eine Beispielfrage zum Testen angeben.");
  }
  return { ok: tests.every((t) => t.ok), tests, at: jetzt() };
}

export async function entwerfen({ vorlage, felder = {} } = {}) {
  const e = bauen(vorlage, felder);
  if (e.error) return e;
  const beispiele = liste(felder.beispiele, /[\n;]|,(?=\s*\p{L})/u).slice(0, 8);
  const t = await testen(e, beispiele);
  const d = lade();
  const ent = { id: neueId(), vorlage, art: e.art, name: e.inhalt.name, inhalt: e.inhalt, beispiele, test: t, status: t.ok ? "getestet" : "durchgefallen", at: jetzt() };
  d.entwuerfe.push(ent);
  protokolliere(d, "fabrik", `Entwurf „${ent.name}“ (${e.art}) in der Sandbox: ${t.tests.filter((x) => x.ok).length}/${t.tests.length} Tests bestanden.`);
  sichere(d);
  return { ok: true, entwurf: ent };
}

export async function aktivieren(id) {
  const d = lade();
  const e = d.entwuerfe.find((x) => x.id === id);
  if (!e) return { error: "Entwurf nicht gefunden." };
  // Unmittelbar vorher nochmal testen – nur ein grüner Stand darf aktiv werden.
  const t = await testen(e, e.beispiele);
  e.test = t;
  if (!t.ok) { e.status = "durchgefallen"; sichere(d); return { error: "Nicht alle Tests bestanden. Erst reparieren, dann aktivieren.", entwurf: e }; }
  let r;
  if (e.art === "modul") r = (await import("./modulsystem.js")).installiere(e.inhalt, { quelle: "skill-factory" });
  else r = (await import("./faehigkeiten.js")).speichern({ ...e.inhalt, aktiv: true }, "boss");
  if (r.error) return r;
  e.status = "aktiv"; e.aktiviert = jetzt();
  protokolliere(d, "fabrik", `„${e.name}“ aktiviert (${e.art === "modul" ? "Modul" : "Fähigkeit"}), nach ${t.tests.length} bestandenen Tests.`);
  sichere(d);
  eintragen({ bereich: "system", titel: `Skill Factory: ${e.name} aktiviert`, details: `${t.tests.length} Tests bestanden`, quelle: "dashboard" });
  return { ok: true, entwurf: e };
}
export function entwurfWeg(id) { const d = lade(); d.entwuerfe = d.entwuerfe.filter((x) => x.id !== id); sichere(d); return { ok: true }; }

// ---------- 🔍 Code-Analyse ----------
function dateien(dir, endung = ".js") {
  try { return fs.readdirSync(dir).filter((f) => f.endsWith(endung)).map((f) => path.join(dir, f)); } catch { return []; }
}
export async function codeAnalyse({ syntax = true } = {}) {
  const start = Date.now();
  const server = dateien(path.join(REPO, "server", "src"));
  const dash = dateien(path.join(REPO, "dashboard"));
  const alle = [...server, ...dash];
  const text = new Map(alle.map((f) => [f, (() => { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } })()]));
  const zeilen = (t) => (t.match(/\n/g) || []).length + 1;
  const proDatei = alle.map((f) => {
    const t = text.get(f);
    return { datei: path.relative(REPO, f), zeilen: zeilen(t), kb: Math.round(Buffer.byteLength(t) / 1024), leereCatch: (t.match(/catch\s*(\([^)]*\))?\s*\{\s*\}/g) || []).length, todo: (t.match(/\b(TODO|FIXME|XXX)\b/g) || []).length, lang: t.split("\n").filter((z) => z.length > 400).length };
  });
  // Exporte, die nirgends sonst vorkommen (nur Server – das Dashboard nutzt keine Exporte)
  const serverText = server.map((f) => text.get(f)).join("\n");
  const ungenutzt = [];
  for (const f of server) {
    const t = text.get(f);
    for (const m of t.matchAll(/export (?:async )?(?:function|const|let) ([A-Za-z_$][\w$]*)/g)) {
      const n = m[1];
      const vorkommen = (serverText.match(new RegExp(`\\b${n.replace(/\$/g, "\\$")}\\b`, "g")) || []).length;
      const imEigenen = (t.match(new RegExp(`\\b${n.replace(/\$/g, "\\$")}\\b`, "g")) || []).length;
      // nur 1× im eigenen Text (die Definition) und nirgends anders → wird nie benutzt (auch nicht über M.name)
      if (imEigenen <= 1 && vorkommen <= 1) ungenutzt.push(`${path.basename(f)}: ${n}`);
    }
  }
  let syntaxErgebnis = null;
  if (syntax) {
    // Im eigenen Thread (node --check für ~280 Dateien dauert einige Sekunden – Friday soll dabei weiter antworten).
    const { Worker } = await import("node:worker_threads");
    syntaxErgebnis = await new Promise((ok) => {
      const w = new Worker(new URL("./testlabor-worker.js", import.meta.url), { workerData: { ordner: REPO } });
      const t = setTimeout(() => { w.terminate(); ok({ ok: true, geprueft: 0, fehler: [], warnungen: ["Prüfung abgebrochen (über 3 Minuten)."] }); }, 180000);
      w.once("message", (r) => { clearTimeout(t); ok(r); w.terminate(); });
      w.once("error", (err) => { clearTimeout(t); ok({ ok: true, geprueft: 0, fehler: [], warnungen: [`Prüfung nicht möglich: ${err.message}`] }); });
    });
  }
  const gesamtZeilen = proDatei.reduce((s, x) => s + x.zeilen, 0);
  const gross = proDatei.filter((x) => x.zeilen > 1500).sort((a, b) => b.zeilen - a.zeilen);
  const leer = proDatei.reduce((s, x) => s + x.leereCatch, 0);
  const todo = proDatei.reduce((s, x) => s + x.todo, 0);
  const vorschlaege = [];
  if (syntaxErgebnis && !syntaxErgebnis.ok) vorschlaege.push({ stufe: "problem", text: `Syntax/Import-Fehler: ${syntaxErgebnis.fehler.slice(0, 3).join(" · ")}` });
  for (const g of gross.slice(0, 3)) vorschlaege.push({ stufe: "hinweis", text: `${g.datei} hat ${g.zeilen.toLocaleString("de-DE")} Zeilen. In kleinere Module aufteilen macht Änderungen sicherer.` });
  if (ungenutzt.length) vorschlaege.push({ stufe: "hinweis", text: `${ungenutzt.length} Export(e) werden nirgends benutzt (z. B. ${ungenutzt.slice(0, 3).join(", ")}). Prüfen und ggf. entfernen.` });
  if (leer > 40) vorschlaege.push({ stufe: "hinweis", text: `${leer} leere Fehlerfänger (catch {}). Wo es wichtig ist, sollte ein Fehler ins Logbuch.` });
  if (todo) vorschlaege.push({ stufe: "hinweis", text: `${todo} offene TODO/FIXME-Stellen im Code.` });
  const note = Math.max(0, 100 - (syntaxErgebnis && !syntaxErgebnis.ok ? 40 : 0) - Math.min(20, gross.length * 3) - Math.min(15, Math.floor(ungenutzt.length / 3)) - Math.min(10, Math.floor(leer / 40)) - Math.min(5, todo));
  const a = {
    at: jetzt(), dauer_ms: Date.now() - start, note, dateien: alle.length, zeilen: gesamtZeilen, kb: proDatei.reduce((s, x) => s + x.kb, 0),
    groesste: proDatei.slice().sort((x, y) => y.zeilen - x.zeilen).slice(0, 8), leereCatch: leer, todo, ungenutzt: ungenutzt.slice(0, 40), ungenutztAnzahl: ungenutzt.length,
    syntax: syntaxErgebnis ? { ok: syntaxErgebnis.ok, geprueft: syntaxErgebnis.geprueft, fehler: syntaxErgebnis.fehler.slice(0, 10), warnungen: (syntaxErgebnis.warnungen || []).slice(0, 10) } : null,
    vorschlaege,
  };
  const d = lade(); d.analyse = a; protokolliere(d, "analyse", `Code-Analyse: Note ${note}, ${alle.length} Dateien, ${gesamtZeilen.toLocaleString("de-DE")} Zeilen${syntaxErgebnis ? `, Syntax ${syntaxErgebnis.ok ? "ok" : "FEHLER"}` : ""}.`); sichere(d);
  return a;
}

// ---------- 🐞 Fehler-Werkstatt ----------
export const REPARATUR = [
  { re: /fetch failed|enotfound|econnrefused|econnreset|etimedout|timeout|zeitüberschreitung|nicht erreichbar|abruf gescheitert/i, art: "netz", text: "Eine Quelle im Internet war nicht erreichbar. Internet am Mac prüfen. Bleibt es, ist der Dienst gestört – der Agent pausiert dann von selbst." },
  { re: /\b401\b|\b403\b|schlüssel|key|unauthori[sz]ed|forbidden|token/i, art: "schluessel", text: "Ein Zugang wurde abgelehnt. Im Fenster Verbindungen den Schlüssel neu eintragen." },
  { re: /quota|guthaben|credit|kontingent|rate.?limit|\b429\b/i, art: "guthaben", text: "Guthaben oder Kontingent ist aufgebraucht. Im Energie-Fenster prüfen oder warten." },
  { re: /sicherung|backup/i, art: "sicherung", text: "Die Sicherung hat nicht geklappt. Freien Speicher prüfen und im Reiter Arzt „Sicherung jetzt“ drücken. Bleibt es, den Ordner ~/Friday-Backups prüfen." },
  { re: /enospc|kein platz|speicher voll/i, art: "speicher", text: "Der Speicher ist voll. Im Reiter Arzt „Aufräumen“ nutzen oder alte Videos löschen." },
  { re: /eacces|eperm|permission|rechte/i, art: "rechte", text: "Friday darf eine Datei nicht lesen/schreiben. Im Reiter Sicherheit „Rechte reparieren“ drücken." },
  { re: /json|unexpected token|unexpected end/i, art: "datei", text: "Eine Datei ist beschädigt. Im Cockpit-Reiter Recovery prüfen und die letzte gute Fassung zurückholen." },
  { re: /mac.?agent|agent offline|nicht verbunden|applescript/i, art: "mac", text: "Der Mac-Agent ist nicht verbunden. Friday neu starten oder „Friday starten.command“ öffnen." },
  { re: /ollama/i, art: "ollama", text: "Ollama läuft nicht. Die Ollama-App am Mac öffnen." },
];
export function reparaturVorschlag(text = "") {
  const r = REPARATUR.find((x) => x.re.test(String(text)));
  return r ? { art: r.art, text: r.text } : { art: "unbekannt", text: "Dafür kenne ich keine feste Reparatur. Nachstellen und, wenn es bleibt, die Details an Claude oder Eve geben." };
}
const normFehler = (t) => String(t || "").toLowerCase().replace(/\d+/g, "#").replace(/„[^“]*“/g, "„…“").replace(/\s+/g, " ").slice(0, 80);
export function fehlerGruppen({ tage = 7 } = {}) {
  const seit = Date.now() - tage * 864e5;
  const l = logbuchSuche({ limit: 3000 }).filter((e) => e.ok === false && Date.parse(e.at) > seit && !/^Funktionsprüfung/.test(e.titel || ""));
  const g = new Map();
  for (const e of l) {
    const k = normFehler(e.titel);
    const x = g.get(k) || { schluessel: k, titel: e.titel, details: e.details || "", bereich: e.bereich, quelle: e.quelle || "", anzahl: 0, zuletzt: e.at };
    x.anzahl++; if (e.at > x.zuletzt) { x.zuletzt = e.at; x.details = e.details || x.details; }
    g.set(k, x);
  }
  return [...g.values()].sort((a, b) => b.anzahl - a.anzahl).slice(0, 20).map((x) => ({ ...x, vorschlag: reparaturVorschlag(`${x.titel} ${x.details}`), nachstellbar: nachstellArt(x) }));
}
function nachstellArt(x) {
  if (/^Kontroll-Agent: (.+) nicht bestanden/.test(x.titel) || x.bereich === "agent") return "agent";
  if (/funktionstest|funktionspr/i.test(`${x.quelle} ${x.titel}`)) return "test";
  return null;
}
/** Einen Fehler echt nachstellen (nur ungefährliche Wege: lesender Agent oder ein einzelner Funktionstest). */
export async function nachstellen(schluessel) {
  const x = fehlerGruppen({ tage: 30 }).find((g) => g.schluessel === schluessel);
  if (!x) return { error: "Diesen Fehler finde ich nicht mehr im Logbuch." };
  let ergebnis;
  if (x.nachstellbar === "agent") {
    const name = (x.titel.match(/^Kontroll-Agent: (.+) nicht bestanden/) || [])[1] || "";
    const { AGENTS } = await import("./agents.js");
    const a = AGENTS.find((y) => y.name === name);
    if (!a) return { error: "Welcher Agent das war, kann ich nicht erkennen." };
    const b = await (await import("./agentenleitung.js")).losschicken(a.id, "", { kanal: "labor" });
    const fehler = b.ok === false || b.pruefung?.status === "fehler";
    ergebnis = { wieder: fehler, text: fehler ? `Nachgestellt: Der Fehler tritt wieder auf (${b.pruefung?.gruende?.join("; ") || b.text}).` : "Nachgestellt: Jetzt klappt es wieder. Es war wohl eine kurze Störung." };
  } else if (x.nachstellbar === "test") {
    const ft = await import("./funktionstest.js");
    const r = await ft.pruefen({ wie: "Fehler-Werkstatt" });
    const f = (r.ergebnisse || []).filter((e) => e.status === "fehler");
    ergebnis = { wieder: f.length > 0, text: f.length ? `Nachgestellt: ${f.length} Prüfung(en) schlagen weiter fehl (${f.slice(0, 3).map((e) => e.name).join(", ")}).` : "Nachgestellt: Alle Funktionstests bestehen jetzt." };
  } else return { error: "Diesen Fehler kann Friday nicht gefahrlos nachstellen." };
  const vorschlag = reparaturVorschlag(`${x.titel} ${x.details} ${ergebnis.text}`);
  let ki = null;
  try {
    const kc = await import("./ki-client.js");
    if (ergebnis.wieder && kc.kostenlosBereit()) {
      const r = await kc.fragen("ollama", { max_tokens: 250, system: "Du bist Fridays Fehler-Werkstatt. Gib auf Deutsch in höchstens 3 kurzen Sätzen einen konkreten Reparaturvorschlag für einen Laien. Nichts erfinden.", messages: [{ role: "user", content: `Fehler: ${x.titel}\nDetails: ${x.details}\nNachgestellt: ${ergebnis.text}` }] }, { quelle: "fehler-werkstatt" });
      ki = (r?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim() || null;
    }
  } catch { /* KI ist Zugabe */ }
  const d = lade(); protokolliere(d, "fehler", `Nachgestellt: ${x.titel} → ${ergebnis.wieder ? "tritt wieder auf" : "behoben"}`); sichere(d);
  return { ok: true, ...ergebnis, vorschlag, ki };
}

// ---------- 📜 Entwicklungsprotokoll ----------
export function versionsGeschichte() {
  const dir = path.join(REPO, "anleitungen");
  const out = [];
  for (const f of dateien(dir, ".md")) {
    let kopf = "";
    try { kopf = fs.readFileSync(f, "utf8").split("\n").find((z) => z.startsWith("# ")) || ""; } catch { continue; }
    const v = kopf.match(/v(\d+\.\d+\.\d+)/);
    if (!v) continue;
    out.push({ version: v[1], titel: kopf.replace(/^#\s*(\d+\s*[·.]\s*)?/, "").replace(/\s*\((ab )?v\d+\.\d+\.\d+[^)]*\)/, "").trim(), anleitung: path.basename(f) });
  }
  const zahl = (v) => v.split(".").map(Number).reduce((s, n) => s * 1000 + n, 0);
  return out.sort((a, b) => zahl(b.version) - zahl(a.version));
}

// ---------- ♻️ Recovery Brain ----------
export async function recoveryPruefen() {
  const kaputt = [], geprueft = [];
  const scan = (dir, tiefe = 0) => {
    let e = [];
    try { e = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const x of e) {
      const p = path.join(dir, x.name);
      if (x.isDirectory()) { if (tiefe < 1 && !/^(aenderungen|archiv|logbuch|eve-daten|module|faehigkeiten|backups?)$/.test(x.name)) scan(p, tiefe + 1); continue; }
      if (!x.name.endsWith(".json") || /\.tmp$/.test(x.name)) continue;
      geprueft.push(p);
      try { JSON.parse(fs.readFileSync(p, "utf8")); } catch (err) { kaputt.push({ datei: path.relative(DATA_DIR, p), fehler: kurz(err.message, 120) }); }
    }
  };
  scan(DATA_DIR);
  // Letzte LESBARE Fassung im Änderungs-Protokoll (die neueste kann schon die kaputte sein).
  let ix = { versionen: [] };
  try { ix = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "aenderungen", "index.json"), "utf8")); } catch { /* keins */ }
  for (const k of kaputt) {
    const v = (ix.versionen || []).filter((x) => x.datei && path.basename(x.datei) === path.basename(k.datei) && x.art !== "geloescht").reverse();
    const gut = v.find((x) => { try { JSON.parse(fs.readFileSync(path.join(DATA_DIR, "aenderungen", `${x.id}.txt`), "utf8")); return true; } catch { return false; } });
    k.fassungen = v.length; k.letzte = gut?.id || null; k.letzteZeit = gut?.zeit || null;
  }
  const sicherung = await (async () => { try { const b = (await import("./backup.js")).listBackups()[0]; return b ? { zeit: b.zeit, name: b.name, version: b.version } : null; } catch { return null; } })();
  let rollback = null;
  try { rollback = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "update-rollback.json"), "utf8")); } catch { /* keiner */ }
  const r = { at: jetzt(), geprueft: geprueft.length, kaputt, sicherung, rollback, notfallGehirn: true };
  const d = lade(); d.recovery = r; protokolliere(d, "recovery", `Datenprüfung: ${geprueft.length} Dateien, ${kaputt.length} beschädigt.`); sichere(d);
  return r;
}
/** Kaputte Datei aus der letzten guten Fassung zurückholen. Die kaputte Datei wird vorher als .kaputt-<zeit> aufgehoben. */
export async function wiederherstellen(datei) {
  const r = await recoveryPruefen();
  const k = r.kaputt.find((x) => x.datei === datei);
  if (!k) return { error: "Diese Datei ist nicht (mehr) beschädigt." };
  if (!k.letzte) return { error: "Für diese Datei gibt es keine aufgehobene Fassung. Nutze eine Sicherung (Reiter System → Sicherung)." };
  const voll = path.resolve(DATA_DIR, datei);
  if (!voll.startsWith(DATA_DIR + path.sep) || /(^|\/)(verbindungen|github|alexa|auth)\.json$/i.test(voll)) return { error: "Diese Datei darf nicht zurückgeholt werden." };
  let gut;
  try { gut = fs.readFileSync(path.join(DATA_DIR, "aenderungen", `${k.letzte}.txt`), "utf8"); JSON.parse(gut); } catch { return { error: "Die aufgehobene Fassung ist nicht lesbar. Bitte eine Sicherung zurückholen." }; }
  fs.copyFileSync(voll, `${voll}.kaputt-${Date.now()}`); // kaputte Fassung aufheben, nichts geht verloren
  fs.writeFileSync(`${voll}.tmp`, gut);
  fs.renameSync(`${voll}.tmp`, voll);
  try { JSON.parse(fs.readFileSync(voll, "utf8")); } catch { return { error: "Auch die aufgehobene Fassung ist nicht lesbar. Bitte eine Sicherung zurückholen." }; }
  const d = lade(); protokolliere(d, "recovery", `${datei} aus der letzten guten Fassung zurückgeholt.`); sichere(d);
  eintragen({ bereich: "system", titel: `Recovery: ${datei} wiederhergestellt`, quelle: "dashboard" });
  return { ok: true, text: `${datei} ist wiederhergestellt. Die beschädigte Fassung liegt daneben.` };
}

export function uebersicht() {
  const d = lade();
  return { vorlagen: VORLAGEN, entwuerfe: d.entwuerfe.slice().reverse(), analyse: d.analyse, recovery: d.recovery, protokoll: d.protokoll.slice().reverse().slice(0, 60), versionen: versionsGeschichte().slice(0, 40), fehler: fehlerGruppen() };
}

export async function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/, "").replace(/[?!.]+$/, "").trim();
  if (/^(öffne|oeffne|zeig|zeige)( mir)? (das |dein |die )?(entwicklungs-? ?labor|skill-? ?factory|fähigkeiten-?fabrik|recovery)$/.test(t)) return { answer: /recovery$/.test(t) ? "Hier ist das Recovery Brain." : "Hier ist mein Entwicklungs-Labor.", actions: [/recovery$/.test(t) ? "cockpit:recovery" : "cockpit:labor"] };
  if (/^(prüf|pruef|analysier)\w* (deinen|den) (eigenen )?code$|^code-?analyse$/.test(t)) {
    const a = await codeAnalyse();
    return { answer: `Code-Note ${a.note} von 100. ${a.dateien} Dateien, ${a.zeilen.toLocaleString("de-DE")} Zeilen.${a.syntax ? (a.syntax.ok ? " Syntax und Importe sind fehlerfrei." : ` ${a.syntax.fehler.length} Syntax-Fehler!`) : ""}${a.vorschlaege[0] ? ` Vorschlag: ${a.vorschlaege[0].text}` : ""}`, actions: ["cockpit:labor"] };
  }
  if (/^(sind|ist) (meine |deine )?daten (ok|in ordnung|heil)|^recovery|^daten prüfen$/.test(t)) {
    const r = await recoveryPruefen();
    return { answer: r.kaputt.length ? `${r.kaputt.length} Datei${r.kaputt.length === 1 ? " ist" : "en sind"} beschädigt: ${r.kaputt.slice(0, 3).map((k) => k.datei).join(", ")}. Im Labor kann ich sie zurückholen.` : `Alle ${r.geprueft} Daten-Dateien sind in Ordnung.`, actions: ["cockpit:recovery"] };
  }
  return null;
}

export function entwicklungRouten(app, asyncRoute) {
  app.get("/api/labor", (_req, res) => res.json(uebersicht()));
  app.post("/api/labor/entwurf", asyncRoute(async (req, res) => res.json(await entwerfen(req.body || {}))));
  app.post("/api/labor/entwurf/:id/aktivieren", asyncRoute(async (req, res) => res.json(await aktivieren(req.params.id))));
  app.delete("/api/labor/entwurf/:id", (req, res) => res.json(entwurfWeg(req.params.id)));
  app.post("/api/labor/analyse", asyncRoute(async (_req, res) => res.json(await codeAnalyse())));
  app.post("/api/labor/nachstellen", asyncRoute(async (req, res) => res.json(await nachstellen(req.body?.schluessel))));
  app.post("/api/labor/recovery", asyncRoute(async (_req, res) => res.json(await recoveryPruefen())));
  app.post("/api/labor/wiederherstellen", asyncRoute(async (req, res) => res.json(await wiederherstellen(String(req.body?.datei || "")))));
}

export async function entwicklungStart() {
  try {
    const hz = await import("./herzschlag.js");
    hz.aufgabeRegistrieren("code-analyse", { name: "Code- und Datenprüfung", text: "Prüft nachts Fridays eigenen Code (Syntax, Importe, Qualität) und ob alle Daten-Dateien lesbar sind. Meldet nur, wenn etwas kaputt ist (Text, kein Vorlesen).", art: "taeglich", zeit: "04:15", standardAn: true, lauf: async () => {
      const a = await codeAnalyse();
      const r = await recoveryPruefen();
      const schlecht = (a.syntax && !a.syntax.ok) || r.kaputt.length;
      if (schlecht) await import("./notify.js").then((n) => n.notifyAll("🧪 Friday-Labor", `${a.syntax && !a.syntax.ok ? `Code-Fehler: ${a.syntax.fehler[0]}\n` : ""}${r.kaputt.length ? `Beschädigte Daten: ${r.kaputt.map((k) => k.datei).join(", ")}` : ""}`.trim())).catch(() => {});
      return { ok: !schlecht, text: `Code-Note ${a.note}, ${r.kaputt.length} beschädigte Dateien` };
    } });
  } catch { /* egal */ }
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "labor", bereich: "System", name: "Entwicklungs-Labor (Sandbox-Tests, Daten lesbar)", lauf: async () => {
      // Echte Sandbox-Tests an einem festen Entwurf: ein guter muss bestehen, ein schlechter muss durchfallen.
      const gut = await testen(bauen("antwort", { name: "Labor-Probe", saetze: "labor probe satz", antwort: "Probe ok." }), ["labor probe satz"]);
      const schlecht = await testen(bauen("antwort", { name: "Labor-Probe", saetze: "labor probe satz", antwort: "Probe ok." }), ["ganz anderer satz"]);
      if (!gut.ok || schlecht.ok) return { status: "fehler", text: "Die Sandbox-Tests unterscheiden gut und schlecht nicht richtig." };
      const r = await recoveryPruefen();
      if (r.kaputt.length) return { status: "fehler", text: `${r.kaputt.length} Daten-Datei(en) beschädigt: ${r.kaputt.map((k) => k.datei).join(", ")}` };
      return { status: "bestanden", text: `Sandbox-Tests unterscheiden gut/schlecht, alle ${r.geprueft} Daten-Dateien lesbar.` };
    } });
  } catch { /* egal */ }
}
