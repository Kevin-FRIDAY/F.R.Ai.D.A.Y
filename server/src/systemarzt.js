// System-Arzt, Performance-Labor und Selbstoptimierung (v1.183.0, Mark XII Punkte 17, 21 und 5).
//
//  🩺 System-Arzt       Untersucht Friday wie ein Arzt: Funktionstests, Fehler im Logbuch, Hintergrund-Aufgaben,
//                       Speicher, Arbeitsspeicher, Reaktionszeit, Sicherungen, Updates. Ergebnis: Befund mit
//                       Diagnosen (gut / Hinweis / Problem) und Behandlungen, die man per Klick startet.
//  ⚡ Performance-Labor  Misst echt mit: wie lange jede Anfrage ans Dashboard dauert (langsamste zuerst),
//                       wie flüssig Friday reagiert (Event-Loop-Verzögerung), Arbeitsspeicher. Stündlicher Verlauf.
//  🔧 Selbstoptimierung Leitet aus den Messwerten Vorschläge ab. Umsetzen nur per Klick und jederzeit rückgängig
//                       (z. B. eine ständig scheiternde Hintergrund-Aufgabe pausieren, bei hohen Kosten schneller denken).
// Ohne Claude, ohne Kosten. Gespeichert in server/data/systemarzt.json.
import fs from "node:fs";
import { monitorEventLoopDelay } from "node:perf_hooks";
import * as store from "./store.js";
import { DATA_DIR } from "./config.js";
import { eintragen } from "./logbuch.js";

const NAME = "systemarzt";
const leer = () => ({ verlauf: [], angewendet: [], befund: null });
const lade = () => ({ ...leer(), ...store.load(NAME, leer()) });
const sichere = (d) => { d.verlauf = d.verlauf.slice(-24 * 14); d.angewendet = d.angewendet.slice(-50); store.save(NAME, d); };

// ---------- ⚡ Performance-Labor: echte Messung jeder Anfrage ----------
const routen = new Map(); // "GET /api/x" → { n, summe, max, langsam }
let schleife = null;
try { schleife = monitorEventLoopDelay({ resolution: 20 }); schleife.enable(); } catch { /* ältere Node */ }

/** Express-Middleware: misst die Dauer jeder /api-Anfrage. */
export function messer(req, res, next) {
  if (!req.path.startsWith("/api/")) return next();
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    // Route-Muster statt echter Pfad (sonst wird jede ID eine eigene Zeile)
    const muster = req.route?.path ? `${req.baseUrl || ""}${req.route.path}` : req.path.replace(/\/[0-9a-z_-]{12,}(?=\/|$)/gi, "/:id");
    const k = `${req.method} ${muster}`;
    const r = routen.get(k) || { n: 0, summe: 0, max: 0, langsam: 0 };
    r.n++; r.summe += ms; r.max = Math.max(r.max, ms); if (ms > 1000) r.langsam++;
    routen.set(k, r);
    if (routen.size > 400) routen.delete(routen.keys().next().value);
  });
  next();
}

export function leistung() {
  const mem = process.memoryUsage();
  const loop = schleife ? { mittel: Math.round(schleife.mean / 1e6), p95: Math.round(schleife.percentile(95) / 1e6), max: Math.round(schleife.max / 1e6) } : null;
  const liste = [...routen.entries()].map(([k, r]) => ({ route: k, anfragen: r.n, schnitt: Math.round(r.summe / r.n), max: Math.round(r.max), langsam: r.langsam }));
  return {
    seit: Math.round(process.uptime()),
    ramMB: Math.round(mem.rss / 1048576), heapMB: Math.round(mem.heapUsed / 1048576),
    schleife: loop,
    anfragen: liste.reduce((s, r) => s + r.anfragen, 0),
    langsamste: liste.sort((a, b) => b.schnitt - a.schnitt).slice(0, 12),
    haeufigste: liste.slice().sort((a, b) => b.anfragen - a.anfragen).slice(0, 6),
  };
}

/** Stündlicher Messpunkt für den Verlauf. */
export function messpunkt() {
  const l = leistung();
  const d = lade();
  d.verlauf.push({ zeit: new Date().toISOString(), ramMB: l.ramMB, heapMB: l.heapMB, loopP95: l.schleife?.p95 ?? null, anfragen: l.anfragen, schnitt: l.langsamste.length ? Math.round(l.langsamste.reduce((s, r) => s + r.schnitt * r.anfragen, 0) / Math.max(1, l.anfragen)) : 0 });
  sichere(d);
  schleife?.reset();
  return { ok: true, text: `RAM ${l.ramMB} MB, Reaktion p95 ${l.schleife?.p95 ?? "?"} ms` };
}

// ---------- 🩺 System-Arzt ----------
const diag = (stufe, bereich, text, behandlung = null) => ({ stufe, bereich, text, behandlung });

function ordnerGroesse(dir, tiefe = 0) {
  let s = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (tiefe < 4) s += ordnerGroesse(p, tiefe + 1); } else s += fs.statSync(p).size;
    }
  } catch { /* egal */ }
  return s;
}

export async function untersuchen() {
  const befunde = [];
  // Funktionstests
  const FT = await import("./funktionstest.js");
  const ft = FT.stand().letzte;
  if (!ft) befunde.push(diag("hinweis", "Funktionstests", "Noch kein Funktionstest gelaufen.", { id: "tests", name: "Funktionstest starten" }));
  else {
    const fehler = ft.ergebnisse.filter((e) => e.status === "fehler");
    const alt = Date.now() - Date.parse(ft.zeit) > 2 * 864e5;
    if (fehler.length) befunde.push(diag("problem", "Funktionstests", `${fehler.length} Prüfung(en) fehlgeschlagen: ${fehler.slice(0, 4).map((f) => f.name).join(", ")}.`, { id: "tests", name: "Erneut testen" }));
    else befunde.push(diag("gut", "Funktionstests", `${ft.bestanden} Prüfungen bestanden${alt ? ", aber älter als 2 Tage" : ""}.`, alt ? { id: "tests", name: "Erneut testen" } : null));
  }
  // Logbuch-Fehler heute
  const LB = await import("./logbuch.js");
  const heute = LB.tag({ fehler: true, limit: 200 });
  // Zusammenfassungen der Funktionstests zählen nicht doppelt (stehen schon oben unter Funktionstests).
  heute.eintraege = (heute.eintraege || []).filter((e) => !/^(✅ |✗ )?Funktionsprüfung/.test(String(e.titel || "")));
  const fehlerHeute = heute.eintraege.length;
  befunde.push(fehlerHeute > 20 ? diag("problem", "Logbuch", `${fehlerHeute} Fehler heute im Logbuch. Häufigste: ${haeufigste(heute.eintraege)}.`) : fehlerHeute ? diag("hinweis", "Logbuch", `${fehlerHeute} Fehler heute im Logbuch. Häufigste: ${haeufigste(heute.eintraege)}.`) : diag("gut", "Logbuch", "Heute keine Fehler im Logbuch."));
  // Hintergrund-Aufgaben
  const HZ = await import("./herzschlag.js");
  const kaputt = HZ.uebersicht().aufgaben.filter((a) => a.an && a.letzte && a.letzte.ok === false);
  befunde.push(kaputt.length ? diag("hinweis", "Hintergrund-Aufgaben", `Zuletzt gescheitert: ${kaputt.map((a) => `${a.name} (${String(a.letzte.text || "").slice(0, 60)})`).join("; ")}.`) : diag("gut", "Hintergrund-Aufgaben", "Alle eingeschalteten Aufgaben liefen zuletzt fehlerfrei."));
  // Rechner
  const SL = await import("./systemlive.js");
  const s = SL.systemLive();
  if (s.platte?.freiGB != null) befunde.push(s.platte.freiGB < 5 ? diag("problem", "Speicherplatz", `Nur noch ${s.platte.freiGB} GB frei.`) : s.platte.freiGB < 20 ? diag("hinweis", "Speicherplatz", `${s.platte.freiGB} GB frei – langsam knapp.`) : diag("gut", "Speicherplatz", `${s.platte.freiGB} GB frei.`));
  if (s.ram?.prozent != null) befunde.push(s.ram.prozent > 92 ? diag("hinweis", "Arbeitsspeicher", `Der Rechner nutzt ${s.ram.prozent} % des Arbeitsspeichers.`) : diag("gut", "Arbeitsspeicher", `Rechner ${s.ram.prozent} %, Friday selbst ${s.friday?.ramMB} MB.`));
  // Reaktion
  const l = leistung();
  if (l.schleife) befunde.push(l.schleife.p95 > 250 ? diag("problem", "Reaktionszeit", `Friday hakt: 95 % der Zeit bis ${l.schleife.p95} ms Verzögerung.`) : l.schleife.p95 > 80 ? diag("hinweis", "Reaktionszeit", `Leichte Verzögerung (${l.schleife.p95} ms).`) : diag("gut", "Reaktionszeit", `Flüssig (${l.schleife.p95} ms).`));
  const lahm = l.langsamste.filter((r) => r.schnitt > 3000 && r.anfragen >= 3);
  if (lahm.length) befunde.push(diag("hinweis", "Langsame Anfragen", lahm.slice(0, 3).map((r) => `${r.route}: ${(r.schnitt / 1000).toFixed(1)} s`).join(", ")));
  // Datenordner
  const datenMB = Math.round(ordnerGroesse(DATA_DIR) / 1048576);
  befunde.push(datenMB > 2000 ? diag("hinweis", "Datenordner", `Fridays Daten sind ${datenMB} MB groß.`) : diag("gut", "Datenordner", `${datenMB} MB Daten.`));
  // Sicherung
  const B = await import("./backup.js");
  const neueste = B.listBackups()[0];
  const alter = neueste?.zeit ? (Date.now() - Date.parse(neueste.zeit)) / 864e5 : null;
  befunde.push(!neueste ? diag("problem", "Sicherung", "Es gibt noch keine Sicherung.", { id: "sicherung", name: "Jetzt sichern" }) : alter > 3 ? diag("hinweis", "Sicherung", `Letzte Sicherung vor ${Math.floor(alter)} Tagen.`, { id: "sicherung", name: "Jetzt sichern" }) : diag("gut", "Sicherung", `Letzte Sicherung ${new Date(neueste.zeit).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.`));
  // Update
  try {
    const rb = JSON.parse(fs.readFileSync(`${DATA_DIR}/update-rollback.json`, "utf8"));
    if (Date.now() - Date.parse(rb.zeit) < 7 * 864e5) befunde.push(diag("hinweis", "Update", `Version ${rb.ziel} startete nicht, Friday ist automatisch auf ${rb.von} zurückgegangen (${new Date(rb.zeit).toLocaleDateString("de-DE")}).`));
  } catch { /* kein Rollback */ }
  try {
    const u = JSON.parse(fs.readFileSync(`${DATA_DIR}/update.json`, "utf8"));
    if (u.state === "fehler" && Date.now() - Date.parse(u.time) < 3 * 864e5) befunde.push(diag("hinweis", "Update", `Letztes Update: ${u.message}`));
  } catch { /* egal */ }

  const gewicht = { gut: 0, hinweis: 1, problem: 3 };
  const note = Math.max(0, 100 - befunde.filter((b) => b.stufe === "problem").length * 15 - befunde.filter((b) => b.stufe === "hinweis").length * 5);
  const befund = { zeit: new Date().toISOString(), note, zustand: note >= 85 ? "gesund" : note >= 60 ? "leicht angeschlagen" : "pflegebedürftig", befunde: befunde.sort((a, b) => gewicht[b.stufe] - gewicht[a.stufe]) };
  const d = lade(); d.befund = befund; sichere(d);
  return befund;
}
function haeufigste(eintraege = []) {
  const z = new Map();
  for (const e of eintraege) { const k = String(e.titel || "").replace(/\d+/g, "#").slice(0, 50); z.set(k, (z.get(k) || 0) + 1); }
  return [...z.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, n]) => `${k} (${n}×)`).join(", ") || "–";
}

export async function behandeln(id) {
  if (id === "tests") { const FT = await import("./funktionstest.js"); const r = await FT.pruefen({ wie: "System-Arzt" }); return r.error ? { error: r.error } : { ok: true, text: `Funktionstest: ${r.bestanden} bestanden, ${r.fehler} Fehler, ${r.uebersprungen} übersprungen.` }; }
  if (id === "sicherung") {
    const B = await import("./backup.js");
    try { await B.createBackup("system-arzt"); return { ok: true, text: "Sicherung angelegt." }; } catch (err) { return { error: `Sicherung ging nicht: ${err.message}` }; }
  }
  return { error: "Unbekannte Behandlung." };
}

// ---------- 🔧 Selbstoptimierung ----------
export async function vorschlaege() {
  const l = [];
  const d = lade();
  const HZ = await import("./herzschlag.js");
  for (const a of HZ.uebersicht().aufgaben) {
    if (a.an && a.letzte && a.letzte.ok === false && !/kosten|aenderungen|sicherung|backup/.test(a.id)) l.push({ id: `pause:${a.id}`, art: "aufgabe", text: `Die Hintergrund-Aufgabe „${a.name}“ scheitert gerade (${String(a.letzte.text || "").slice(0, 60)}). Pausieren spart Rechenzeit, bis die Ursache behoben ist.`, knopf: "Pausieren" });
  }
  const K = await import("./kostendeckel.js");
  const k = K.stand();
  const E = await import("./einstellungen.js");
  const tempo = E.getSettings()?.tempo || "schnell";
  if (k.an && (k.prozent?.tag ?? 0) >= 60 && tempo !== "blitz") l.push({ id: "tempo:blitz", art: "kosten", text: `Heute sind schon ${k.prozent.tag} % des Kostenlimits verbraucht. Das schnellste Denk-Tempo (Haiku) kostet deutlich weniger.`, knopf: "Auf Blitz stellen" });
  const lst = leistung();
  if (lst.schleife && lst.schleife.p95 > 150) l.push({ id: "info:loop", art: "info", text: `Friday reagiert verzögert (${lst.schleife.p95} ms). Häufigste Anfragen: ${lst.haeufigste.slice(0, 3).map((r) => r.route).join(", ")}. Weniger offene Dashboard-Fenster helfen.` });
  const verlauf = d.verlauf.slice(-48);
  if (verlauf.length >= 12) {
    const anfang = verlauf.slice(0, 6).reduce((s, v) => s + v.ramMB, 0) / 6, ende = verlauf.slice(-6).reduce((s, v) => s + v.ramMB, 0) / 6;
    if (ende > anfang * 1.6 && ende > 400) l.push({ id: "info:ram", art: "info", text: `Fridays Arbeitsspeicher wächst (von ${Math.round(anfang)} auf ${Math.round(ende)} MB). Ein Neustart von Friday räumt auf.` });
  }
  return { vorschlaege: l, angewendet: d.angewendet.slice().reverse() };
}

export async function anwenden(id) {
  const d = lade();
  if (id.startsWith("pause:")) {
    const HZ = await import("./herzschlag.js");
    const a = HZ.uebersicht().aufgaben.find((x) => x.id === id.slice(6));
    if (!a) return { error: "Aufgabe nicht gefunden." };
    HZ.einstellen(a.id, { an: false });
    d.angewendet.push({ id, zeit: new Date().toISOString(), text: `„${a.name}“ pausiert`, rueckgaengig: { art: "aufgabe", aufgabe: a.id } });
  } else if (id === "tempo:blitz") {
    const E = await import("./einstellungen.js");
    const vorher = E.getSettings()?.tempo || "schnell";
    E.setSettings({ tempo: "blitz" });
    d.angewendet.push({ id, zeit: new Date().toISOString(), text: `Denk-Tempo von „${vorher}“ auf „blitz“`, rueckgaengig: { art: "tempo", tempo: vorher } });
  } else return { error: "Dieser Vorschlag lässt sich nicht automatisch umsetzen." };
  sichere(d);
  eintragen({ bereich: "system", titel: `Selbstoptimierung: ${d.angewendet.at(-1).text}`, quelle: "dashboard" });
  return { ok: true, text: `Umgesetzt: ${d.angewendet.at(-1).text}. Rückgängig im Cockpit unter System-Arzt.` };
}

export async function rueckgaengig(index) {
  const d = lade();
  const i = d.angewendet.length - 1 - Number(index);
  const e = d.angewendet[i];
  if (!e || e.zurueck) return { error: "Nichts rückgängig zu machen." };
  if (e.rueckgaengig.art === "aufgabe") (await import("./herzschlag.js")).einstellen(e.rueckgaengig.aufgabe, { an: true });
  if (e.rueckgaengig.art === "tempo") (await import("./einstellungen.js")).setSettings({ tempo: e.rueckgaengig.tempo });
  e.zurueck = new Date().toISOString();
  sichere(d);
  return { ok: true, text: `Rückgängig: ${e.text}.` };
}

export function satz(b) {
  const probleme = b.befunde.filter((x) => x.stufe === "problem");
  const hinweise = b.befunde.filter((x) => x.stufe === "hinweis");
  return `System-Arzt: Friday ist ${b.zustand} (${b.note} von 100). ${probleme.length ? `Probleme: ${probleme.map((p) => p.text).slice(0, 2).join(" ")}` : "Keine ernsten Probleme."}${hinweise.length ? ` ${hinweise.length} Hinweis${hinweise.length === 1 ? "" : "e"} im Cockpit.` : ""}`;
}

export async function quickCommand(text) {
  const t = String(text || "").toLowerCase();
  if (!/system.?arzt|untersuch dich|wie geht('?s| es) dir (technisch|gesundheitlich)|bist du gesund|diagnose|performance.?labor|wie schnell bist du/.test(t)) return null;
  return { answer: satz(await untersuchen()), actions: ["cockpit:arzt"] };
}

export function arztRouten(app, asyncRoute) {
  app.get("/api/systemarzt", asyncRoute(async (_req, res) => { const d = lade(); res.json({ befund: d.befund, leistung: leistung(), verlauf: d.verlauf.slice(-48), ...(await vorschlaege()) }); }));
  app.post("/api/systemarzt/untersuchen", asyncRoute(async (_req, res) => res.json(await untersuchen())));
  app.post("/api/systemarzt/behandeln", asyncRoute(async (req, res) => { const r = await behandeln(String(req.body?.id || "")); res.status(r.error ? 400 : 200).json(r); }));
  app.post("/api/systemarzt/optimieren", asyncRoute(async (req, res) => {
    const r = req.body?.rueckgaengig != null ? await rueckgaengig(req.body.rueckgaengig) : await anwenden(String(req.body?.id || ""));
    res.status(r.error ? 400 : 200).json(r);
  }));
}

export async function arztStart() {
  try {
    const hz = await import("./herzschlag.js");
    hz.aufgabeRegistrieren("performance-labor", { name: "Performance-Labor", text: "Merkt sich jede Stunde Arbeitsspeicher und Reaktionszeit.", art: "intervall", minuten: 60, standardAn: true, lauf: async () => messpunkt() });
    hz.aufgabeRegistrieren("system-arzt", { name: "System-Arzt", text: "Untersucht Friday jeden Morgen und meldet sich bei ernsten Problemen.", art: "taeglich", zeit: "07:15", standardAn: true, lauf: async () => {
      const b = await untersuchen();
      const probleme = b.befunde.filter((x) => x.stufe === "problem");
      if (probleme.length) await import("./notify.js").then((n) => n.notifyAll("🩺 System-Arzt", satz(b))).catch(() => {});
      return { ok: true, text: `${b.zustand} (${b.note}/100)` };
    } });
  } catch { /* egal */ }
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "systemarzt", bereich: "System", name: "System-Arzt und Performance-Messung", lauf: async () => {
      const l = leistung();
      if (!l.anfragen) return { status: "uebersprungen", text: "Seit dem Start gab es noch keine Anfrage zum Messen." };
      const b = await untersuchen();
      return b.befunde.length >= 5 ? { status: "bestanden", text: `${l.anfragen} Anfragen gemessen, Befund: ${b.zustand} (${b.note}/100).` } : { status: "fehler", text: "Der Befund ist unvollständig." };
    } });
  } catch { /* egal */ }
}
