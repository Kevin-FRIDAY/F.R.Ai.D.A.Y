// Persönliche Assistenz: Entscheidungsarchiv, Ziel-Navigator, Gewohnheitsanalyse, Prioritäten-Erkennung,
// persönliches Wissensprofil und der persönliche Berater.
// Gespeichert in server/data/entscheidungen.json, ziele.json, wissensprofil.json.
import { config } from "./config.js";
import * as store from "./store.js";
import { eintragen, suche as logbuchSuche } from "./logbuch.js";
import { darf } from "./kommando.js";
import { planeSchritte, erkennePrioritaet } from "./missionen.js";
import { denke } from "./denker.js";

const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const jetzt = () => new Date().toISOString();
const kurz = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// ---- Entscheidungsarchiv ----
export function entscheidungen() { return store.load("entscheidungen", []).slice().reverse(); }
export function entscheidungSpeichern(e = {}) {
  const l = store.load("entscheidungen", []);
  const alt = e.id && l.find((x) => x.id === e.id);
  const neu = {
    id: alt?.id || neueId(),
    frage: kurz(e.frage, 300),
    entscheidung: kurz(e.entscheidung, 600),
    gruende: kurz(e.gruende, 1500),
    alternativen: kurz(e.alternativen, 800),
    bereich: kurz(e.bereich, 40),
    datum: alt?.datum || jetzt(),
    pruefen_am: /^\d{4}-\d{2}-\d{2}$/.test(e.pruefen_am || "") ? e.pruefen_am : alt?.pruefen_am || "",
    ergebnis: kurz(e.ergebnis ?? alt?.ergebnis, 1500),
    bewertung: [1, 2, 3, 4, 5].includes(Number(e.bewertung)) ? Number(e.bewertung) : alt?.bewertung || null,
  };
  if (!neu.frage || !neu.entscheidung) return { error: "Frage und Entscheidung bitte ausfüllen." };
  store.save("entscheidungen", alt ? l.map((x) => (x.id === neu.id ? neu : x)) : [...l, neu].slice(-500));
  eintragen({ bereich: "gedaechtnis", titel: `Entscheidung ${alt ? "aktualisiert" : "festgehalten"}: ${neu.entscheidung}`, details: neu.frage, quelle: "dashboard" });
  return { ok: true, entscheidung: neu };
}
export function entscheidungLoeschen(id) {
  store.save("entscheidungen", store.load("entscheidungen", []).filter((x) => x.id !== id));
  return { ok: true };
}
/** Was lief bei früheren Entscheidungen gut? (Durchschnitt nach Bereich) */
export function entscheidungsBilanz() {
  const l = store.load("entscheidungen", []);
  const bewertet = l.filter((e) => e.bewertung);
  const nachBereich = {};
  for (const e of bewertet) { const b = e.bereich || "Allgemein"; (nachBereich[b] ||= []).push(e.bewertung); }
  const faellig = l.filter((e) => e.pruefen_am && !e.ergebnis && e.pruefen_am <= new Date().toISOString().slice(0, 10));
  return {
    gesamt: l.length,
    bewertet: bewertet.length,
    schnitt: bewertet.length ? Math.round((bewertet.reduce((a, e) => a + e.bewertung, 0) / bewertet.length) * 10) / 10 : null,
    bereiche: Object.entries(nachBereich).map(([b, w]) => ({ bereich: b, anzahl: w.length, schnitt: Math.round((w.reduce((a, x) => a + x, 0) / w.length) * 10) / 10 })),
    faellig: faellig.map((e) => ({ id: e.id, frage: e.frage, pruefen_am: e.pruefen_am })),
  };
}

// ---- Ziel-Navigator ----
export function ziele() { return store.load("ziele", []).slice().reverse(); }
export async function zielAnlegen({ titel, frist, warum }) {
  const t = kurz(titel, 200);
  if (!t) return { error: "Wie heißt dein Ziel?" };
  const kontext = darf("berater", "ziele") ? profilText() : "";
  const plan = await planeSchritte(`${t}${frist ? ` (bis ${frist})` : ""}${warum ? `. Warum: ${warum}` : ""}`, { art: "ziel", kontext });
  const z = { id: neueId(), titel: t, frist: kurz(frist, 40), warum: kurz(warum, 400), schritte: plan.schritte.map((s) => ({ id: neueId(), text: s.text, frist: s.frist || "", erledigt: false })), hinweis: plan.hinweis || "", mitClaude: plan.mitClaude, erstellt: jetzt() };
  store.save("ziele", [...store.load("ziele", []), z].slice(-100));
  eintragen({ bereich: "aufgabe", titel: `Ziel angelegt: ${t}`, details: z.schritte.map((s, i) => `${i + 1}. ${s.text}`).join(" · "), quelle: "dashboard" });
  return { ok: true, ziel: z };
}
export function zielAendern(id, patch = {}) {
  const l = store.load("ziele", []);
  const z = l.find((x) => x.id === id);
  if (!z) return { error: "Ziel nicht gefunden." };
  if (patch.schritt) {
    const s = z.schritte.find((x) => x.id === patch.schritt);
    if (s) { s.erledigt = !s.erledigt; s.am = s.erledigt ? jetzt() : null; }
  }
  if (typeof patch.neuerSchritt === "string" && patch.neuerSchritt.trim()) z.schritte.push({ id: neueId(), text: kurz(patch.neuerSchritt, 300), erledigt: false });
  if (patch.loeschenSchritt) z.schritte = z.schritte.filter((x) => x.id !== patch.loeschenSchritt);
  if (patch.loeschen) { store.save("ziele", l.filter((x) => x.id !== id)); return { ok: true }; }
  if (patch.inAufgaben) {
    const s = z.schritte.find((x) => !x.erledigt);
    if (s) { store.addTask(`${s.text} (Ziel: ${z.titel})`); eintragen({ bereich: "aufgabe", titel: `Nächster Ziel-Schritt in Aufgaben: ${s.text}`, quelle: "dashboard" }); }
  }
  store.save("ziele", l);
  return { ok: true, ziel: z };
}
export function fortschritt(z) {
  return z.schritte.length ? Math.round((z.schritte.filter((s) => s.erledigt).length / z.schritte.length) * 100) : 0;
}

// ---- Persönliches Wissensprofil ----
const PROFIL_FELDER = ["interessen", "faehigkeiten", "lernziele", "werte"];
export function profil() {
  const p = store.load("wissensprofil", {});
  const out = {};
  for (const f of PROFIL_FELDER) out[f] = Array.isArray(p[f]) ? p[f] : [];
  return out;
}
export function profilSpeichern(patch = {}) {
  const p = profil();
  for (const f of PROFIL_FELDER) {
    if (Array.isArray(patch[f])) p[f] = [...new Set(patch[f].map((x) => kurz(x, 80)).filter(Boolean))].slice(0, 40);
  }
  store.save("wissensprofil", p);
  return p;
}
function profilText() {
  const p = profil();
  const teile = [];
  if (p.interessen.length) teile.push(`Interessen: ${p.interessen.join(", ")}`);
  if (p.faehigkeiten.length) teile.push(`Fähigkeiten: ${p.faehigkeiten.join(", ")}`);
  if (p.lernziele.length) teile.push(`Lernziele: ${p.lernziele.join(", ")}`);
  if (p.werte.length) teile.push(`Wichtig ist ihm: ${p.werte.join(", ")}`);
  return teile.join("\n");
}

// ---- Gewohnheitsanalyse (ohne Claude, aus Archiv + Logbuch) ----
const FUELL = new Set(["friday", "hey", "bitte", "mal", "mir", "mich", "den", "die", "das", "der", "ein", "eine", "und", "zu", "auf", "was", "wie", "ist", "ich", "du", "kannst", "mach", "zeig", "sag"]);
export function gewohnheiten({ tage = 30 } = {}) {
  const seit = Date.now() - tage * 86400000;
  const fragen = store.leseArchiv().filter((e) => e.typ === "gespraech" && new Date(e.at).getTime() >= seit);
  const stunden = Array(24).fill(0), wochentage = Array(7).fill(0), kanaele = {}, themen = {}, befehle = {};
  for (const e of fragen) {
    const d = new Date(new Date(e.at).toLocaleString("en-US", { timeZone: config.timezone }));
    stunden[d.getHours()]++; wochentage[d.getDay()]++;
    kanaele[e.kanal || "web"] = (kanaele[e.kanal || "web"] || 0) + 1;
    const woerter = String(e.frage || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !FUELL.has(w));
    for (const w of new Set(woerter)) themen[w] = (themen[w] || 0) + 1;
    const kern = woerter.slice(0, 3).join(" ");
    if (kern) befehle[kern] = (befehle[kern] || 0) + 1;
  }
  let bereiche = {};
  try { for (const e of logbuchSuche({ limit: 5000 })) if (new Date(e.at).getTime() >= seit) bereiche[e.bereich] = (bereiche[e.bereich] || 0) + 1; } catch { bereiche = {}; }
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ name: k, anzahl: v }));
  const spitze = stunden.indexOf(Math.max(...stunden));
  const tagNamen = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const wiederkehrend = top(befehle, 10).filter((b) => b.anzahl >= 3);
  const erkenntnisse = [];
  if (fragen.length) {
    erkenntnisse.push(`Du sprichst am meisten um ${spitze} Uhr mit Friday.`);
    erkenntnisse.push(`Dein aktivster Tag ist der ${tagNamen[wochentage.indexOf(Math.max(...wochentage))]}.`);
    for (const w of wiederkehrend.slice(0, 3)) erkenntnisse.push(`„${w.name}“ kam ${w.anzahl}-mal vor – das könnte eine Automation werden.`);
  }
  return { tage, anzahl: fragen.length, stunden, wochentage, kanaele: top(kanaele, 6), themen: top(themen, 15), wiederkehrend, bereiche: top(bereiche, 10), erkenntnisse };
}

// ---- Prioritäten-Erkennung über alle offenen Aufgaben ----
// Aufwand grob aus dem Text schätzen (1 klein, 2 mittel, 3 groß) – für "schnelle Erfolge zuerst".
export function aufwandSchaetzen(text = "") {
  const t = String(text).toLowerCase();
  if (/\b(anruf|anrufen|ruf .* an|kurz|schnell|bezahlen|überweisen|ueberweisen|bestellen|abschicken|antworten|zurückrufen|termin machen|kaufen)\b/.test(t)) return 1;
  if (/\b(planen|erstellen|bauen|renovieren|umziehen|lernen|schreiben|aufräumen|aufraeumen|entwickeln|steuererklärung|steuererklaerung|projekt|organisieren)\b/.test(t)) return 3;
  return 2;
}
const AUFWAND_TEXT = { 1: "klein", 2: "mittel", 3: "groß" };

/**
 * Prioritäten über alle offenen Dinge, mit Punktzahl 0–100 (v1.185.0):
 * Wichtigkeit (bis 50) + Frist (bis 35) + kleiner Aufwand (bis 10) + liegt lange (5).
 */
export function prioritaeten() {
  const tag = 86400000;
  const aufgaben = store.getTasks().filter((t) => !t.done).map((t) => ({ quelle: "Aufgabe", text: t.text, id: t.id, alt: t.at ? (Date.now() - Number(t.at)) / tag : 0 }));
  const zielSchritte = store.load("ziele", []).flatMap((z) => z.schritte.filter((s) => !s.erledigt).slice(0, 1).map((s) => ({ quelle: `Ziel: ${z.titel}`, text: s.text, faellig: /^\d{4}-\d{2}-\d{2}$/.test(z.frist || "") ? `${z.frist}T18:00:00` : null })));
  const erinnerungen = store.getReminders().filter((r) => !r.done).map((r) => ({ quelle: "Erinnerung", text: r.text, faellig: r.due }));
  const projekt = store.load("projekte", []).filter((p) => p.status !== "fertig").flatMap((p) => (p.aufgaben || []).filter((a) => !a.erledigt).map((a) => ({ quelle: `Projekt: ${p.name}`, text: a.text, faellig: a.frist ? `${a.frist}T18:00:00` : null, wichtig: a.wichtig, aufwand: a.aufwand })));
  const alleOffen = [...aufgaben, ...zielSchritte, ...erinnerungen, ...projekt].map((x) => {
    let p = erkennePrioritaet(x.text);
    if (x.wichtig === 3) p = { prio: 1, grund: "als sehr wichtig markiert" };
    let fristPunkte = 0, fristGrund = "";
    if (x.faellig) {
      const std = (new Date(x.faellig) - Date.now()) / 3600000;
      if (std < 24) { p = { prio: 1, grund: "fällig in weniger als 24 Stunden" }; fristPunkte = 35; }
      else if (std < 72) { fristPunkte = 25; fristGrund = "fällig in 3 Tagen"; }
      else if (std < 168) { fristPunkte = 15; fristGrund = "fällig diese Woche"; }
      else fristPunkte = 5;
    }
    const aufwand = [1, 2, 3].includes(x.aufwand) ? x.aufwand : aufwandSchaetzen(x.text);
    const punkte = Math.min(100, ({ 1: 50, 2: 30, 3: 10 })[p.prio] + fristPunkte + (4 - aufwand) * 3 + (x.alt > 14 ? 5 : 0) + (p.prio === 1 ? 6 : 0));
    const gruende = [p.grund, fristGrund, `Aufwand ${AUFWAND_TEXT[aufwand]}`, x.alt > 14 ? "liegt seit über 2 Wochen" : ""].filter(Boolean);
    const { alt, wichtig, ...rest } = x;
    return { ...rest, ...p, aufwand, punkte, gruende };
  });
  return alleOffen.sort((a, b) => b.punkte - a.punkte || a.prio - b.prio);
}

// ---- Persönlicher Berater (mit Claude) ----
export async function berate(frage) {
  const f = kurz(frage, 2000);
  if (!f) return { error: "Wobei soll ich dich beraten?" };
  const teile = [];
  if (darf("berater", "ziele")) {
    const zl = store.load("ziele", []).map((z) => `- ${z.titel} (${fortschritt(z)} % geschafft${z.frist ? `, Frist ${z.frist}` : ""})`).join("\n");
    if (zl) teile.push(`Ziele:\n${zl}`);
    const pt = profilText();
    if (pt) teile.push(pt);
  }
  if (darf("berater", "gedaechtnis")) {
    const m = store.getMemories().slice(-25).map((x) => `- ${x.text}`).join("\n");
    if (m) teile.push(`Was Friday über ihn weiß:\n${m}`);
  }
  if (darf("berater", "entscheidungen")) {
    const e = store.load("entscheidungen", []).slice(-10).map((x) => `- ${x.frage} → ${x.entscheidung}${x.bewertung ? ` (rückblickend ${x.bewertung}/5)` : ""}`).join("\n");
    if (e) teile.push(`Frühere Entscheidungen:\n${e}`);
  }
  if (darf("berater", "organizer")) {
    const p = prioritaeten().slice(0, 8).map((x) => `- [${x.prio === 1 ? "hoch" : x.prio === 2 ? "mittel" : "niedrig"}] ${x.text}`).join("\n");
    if (p) teile.push(`Offene Aufgaben:\n${p}`);
  }
  const system = `Du bist Fridays persönlicher Berater für ${config.userName}. Gib ehrliche, konkrete Empfehlungen auf Grundlage seiner Ziele und Werte. Schreib auf Deutsch, einfach und direkt. Aufbau: 1) Empfehlung in einem Satz, 2) drei Gründe, 3) der nächste konkrete Schritt für heute, 4) "Sicherheit:" hoch/mittel/niedrig und was du nicht weißt. Bei Gesundheit, Recht oder Geld: sag, wann ein Fachmensch gefragt werden sollte.`;
  const r = await denke({ system, text: `${teile.length ? `${teile.join("\n\n")}\n\n` : "(Keine persönlichen Daten freigegeben.)\n\n"}Frage: ${f}`, stufe: "mittel", maxTokens: 2500, quelle: "berater" });
  if (!r.ok) return { error: r.error, leer: r.leer };
  eintragen({ bereich: "suche", titel: `Berater: ${kurz(f, 120)}`, details: r.text, claude: true, quelle: "claude" });
  return { ok: true, text: r.text, model: r.model, genutzt: teile.length };
}
