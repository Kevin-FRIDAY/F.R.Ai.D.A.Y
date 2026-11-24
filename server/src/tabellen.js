// Excel-Tabellen, die Friday wirklich erstellt (v1.161.0).
// "Friday, bau mir eine Excel-Tabelle für meine Ausgaben" → echte .xlsx-Datei in
//   ~/Friday-Archiv/Tabellen/<Jahr>/<MM-Monat>/<Titel>.xlsx
// Sie steht außerdem bei den Dokumenten (Vorschau + Herunterladen im Dashboard) und geht am Mac gleich auf.
// Ohne Claude (Guthaben leer, lokales Gehirn ohne Werkzeuge) baut Friday eine passende Vorlage selbst.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { baueXlsx } from "./xlsx.js";
import * as store from "./store.js";

const ARCHIV = () => process.env.FRIDAY_ARCHIV_DIR || path.join(os.homedir(), "Friday-Archiv");
export const TABELLEN_DIR = () => path.join(ARCHIV(), "Tabellen");
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const zwei = (n) => String(n).padStart(2, "0");
const MAX_ZEILEN = 5000, MAX_SPALTEN = 50, MAX_BLAETTER = 10;

const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const dateiName = (t) => String(t || "Tabelle").normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Tabelle";

function zellwert(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "object") return JSON.stringify(v).slice(0, 2000);
  return String(v).slice(0, 5000);
}

// Claude schickt Zeilen mal als Listen, mal als Objekte ({Datum: …, Betrag: …}). Beides geht.
export function blattAus(b = {}, i = 0) {
  let spalten = Array.isArray(b.spalten) ? b.spalten.map((s) => String(s ?? "").slice(0, 200)) : [];
  const roh = Array.isArray(b.zeilen) ? b.zeilen.slice(0, MAX_ZEILEN) : [];
  if (!spalten.length && roh.length && roh[0] && typeof roh[0] === "object" && !Array.isArray(roh[0])) spalten = Object.keys(roh[0]);
  const zeilen = roh.map((z) => {
    if (Array.isArray(z)) return z.slice(0, MAX_SPALTEN).map(zellwert);
    if (z && typeof z === "object") return spalten.map((s) => zellwert(z[s]));
    return [zellwert(z)];
  });
  return { name: String(b.name || b.titel || `Tabelle ${i + 1}`).slice(0, 31), spalten: spalten.slice(0, MAX_SPALTEN), zeilen };
}

function freierPfad(dir, basis) {
  let name = `${basis}.xlsx`;
  for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `${basis} (${i}).xlsx`;
  return path.join(dir, name);
}

/** Am Mac in Excel/Numbers öffnen (nur, wenn Friday auf dem Mac läuft). */
export function amMacOeffnen(voll) {
  if (process.platform !== "darwin" || process.env.FRIDAY_NICHT_OEFFNEN === "1") return false;
  try { execFile("open", [voll], { timeout: 10000 }, () => {}); return true; } catch { return false; }
}

/**
 * Erstellt die Tabelle als echte Datei.
 * @param {{titel:string, blaetter?:object[], spalten?:string[], zeilen?:any[][], oeffnen?:boolean, quelle?:string}} p
 */
export function tabelleErstellen(p = {}) {
  const titel = String(p.titel || "Tabelle").trim().slice(0, 120) || "Tabelle";
  let blaetter = Array.isArray(p.blaetter) && p.blaetter.length ? p.blaetter : [{ name: titel, spalten: p.spalten, zeilen: p.zeilen }];
  blaetter = blaetter.slice(0, MAX_BLAETTER).map(blattAus);
  const zellen = blaetter.reduce((s, b) => s + b.spalten.length + b.zeilen.reduce((x, z) => x + z.length, 0), 0);
  if (!zellen) return { error: "Die Tabelle ist leer. Gib Spalten und Zeilen mit." };
  const jetzt = new Date();
  const rel = path.join(String(jetzt.getFullYear()), `${zwei(jetzt.getMonth() + 1)}-${MONATE[jetzt.getMonth()]}`);
  const dir = path.join(TABELLEN_DIR(), rel);
  let voll;
  try {
    fs.mkdirSync(dir, { recursive: true });
    voll = freierPfad(dir, dateiName(titel));
    fs.writeFileSync(voll, baueXlsx(blaetter, { titel }));
  } catch (err) {
    return { error: `Die Datei konnte ich nicht speichern: ${err.message}` };
  }
  // Prüfen, dass die Datei wirklich da ist (ehrliche Rückmeldung statt "erledigt").
  const groesse = fs.statSync(voll).size;
  if (groesse < 200) return { error: "Die Datei ist kaputt geworden." };
  const d = {
    id: neueId(),
    art: "tabelle",
    titel,
    datei: path.relative(TABELLEN_DIR(), voll),
    // Vorschau im Dashboard: höchstens 200 Zeilen pro Blatt
    blaetter: blaetter.map((b) => ({ name: b.name, spalten: b.spalten, zeilen: b.zeilen.slice(0, 200), anzahl: b.zeilen.length })),
    inhalt: blaetter.map((b) => `${b.name}: ${b.spalten.join(" | ")} (${b.zeilen.length} Zeilen)`).join("\n"),
    erstellt: jetzt.toISOString(),
    ...(p.quelle ? { quelle: p.quelle } : {}),
  };
  const liste = store.load("dokumente", []);
  store.save("dokumente", [...liste, d].slice(-200));
  store.logActivity("dokument", `Excel-Tabelle erstellt: ${titel}`);
  const geoeffnet = p.oeffnen === false ? false : amMacOeffnen(voll);
  return { ok: true, id: d.id, titel, datei: voll, groesse, blaetter: blaetter.map((b) => ({ name: b.name, spalten: b.spalten.length, zeilen: b.zeilen.length })), geoeffnet };
}

/** Pfad einer Tabelle (nur innerhalb des Tabellen-Ordners). */
export function tabellenPfad(id) {
  const d = store.load("dokumente", []).find((x) => x.id === id && x.art === "tabelle");
  if (!d?.datei) return null;
  const basis = path.resolve(TABELLEN_DIR());
  const voll = path.resolve(basis, d.datei);
  if (!voll.startsWith(basis + path.sep) || !fs.existsSync(voll)) return null;
  return { voll, name: path.basename(voll), titel: d.titel };
}

// ---------- Vorlagen ohne Claude ----------
const monat = () => MONATE[new Date().getMonth()];
const tag = (n) => { const d = new Date(); d.setDate(n); return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}`; };
const WOCHE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

const VORLAGEN = [
  { re: /ausgabe|haushalt|budget|finanz|kosten|geld|einnahme/, bau: () => ({
    titel: `Haushaltsbuch ${monat()}`,
    blaetter: [
      { name: "Buchungen", spalten: ["Datum", "Was", "Kategorie", "Einnahme", "Ausgabe"], zeilen: [
        [tag(1), "Gehalt", "Einkommen", "", ""], [tag(1), "Miete", "Wohnen", "", ""], [tag(3), "Einkauf", "Lebensmittel", "", ""],
        [tag(5), "Tanken", "Auto", "", ""], [tag(10), "Handy", "Verträge", "", ""],
        ...Array.from({ length: 15 }, () => ["", "", "", "", ""]),
        ["", "SUMME", "", "=SUM(D2:D21)", "=SUM(E2:E21)"], ["", "ÜBRIG", "", "=D22-E22", ""],
      ] },
      { name: "Kategorien", spalten: ["Kategorie", "Ausgaben"], zeilen: ["Wohnen", "Lebensmittel", "Auto", "Verträge", "Freizeit", "Sonstiges"].map((k) => [k, `=SUMIF(Buchungen!C2:C21,"${k}",Buchungen!E2:E21)`]) },
    ] }) },
  { re: /einkauf|shopping|besorg/, bau: () => ({ titel: "Einkaufsliste", spalten: ["Erledigt", "Was", "Menge", "Laden", "Preis"], zeilen: [...Array.from({ length: 20 }, () => ["", "", "", "", ""]), ["", "SUMME", "", "", "=SUM(E2:E21)"]] }) },
  { re: /training|sport|fitness|gym/, bau: () => ({ titel: "Trainingsplan", spalten: ["Tag", "Übung", "Sätze", "Wiederholungen", "Gewicht (kg)", "Notiz"], zeilen: WOCHE.map((t) => [t, "", "", "", "", ""]) }) },
  { re: /wochenplan|stundenplan|termin|plan fuer die woche|plan für die woche/, bau: () => ({ titel: "Wochenplan", spalten: ["Uhrzeit", ...WOCHE], zeilen: Array.from({ length: 14 }, (_, i) => [`${zwei(7 + i)}:00`, "", "", "", "", "", "", ""]) }) },
  { re: /arbeitszeit|stunden|zeiterfassung/, bau: () => ({ titel: `Arbeitszeiten ${monat()}`, spalten: ["Datum", "Beginn", "Ende", "Pause (Min)", "Stunden"], zeilen: [...Array.from({ length: 22 }, (_, i) => [tag(i + 1), "", "", "", `=IF(C${i + 2}="","",(C${i + 2}-B${i + 2})*24-D${i + 2}/60)`]), ["", "", "", "SUMME", "=SUM(E2:E23)"]] }) },
  { re: /kontakt|adress|telefon/, bau: () => ({ titel: "Kontakte", spalten: ["Name", "Telefon", "E-Mail", "Adresse", "Geburtstag", "Notiz"], zeilen: Array.from({ length: 20 }, () => ["", "", "", "", "", ""]) }) },
  { re: /aufgabe|to.?do|projekt/, bau: () => ({ titel: "Aufgaben", spalten: ["Aufgabe", "Wer", "Bis wann", "Priorität", "Status"], zeilen: Array.from({ length: 20 }, () => ["", "", "", "", "offen"]) }) },
];

/** Eine sinnvolle Vorlage zum Wunsch, ganz ohne Claude. */
export function vorlageFuer(text = "") {
  const t = String(text).toLowerCase();
  const v = VORLAGEN.find((x) => x.re.test(t));
  if (v) return v.bau();
  // "Tabelle mit Name, Alter und Wohnort" → genau diese Spalten
  const m = t.match(/(?:mit|spalten?:?)\s+(?:den spalten\s+)?([\wäöüß ,/-]+?(?:,| und )[\wäöüß ,/-]+)$/i);
  const spalten = m ? m[1].split(/,| und /).map((s) => s.trim()).filter((s) => s && s.length < 40).slice(0, 12) : [];
  const titelRoh = t.match(/(?:tabelle|liste|excel)\s+(?:für|fuer|über|ueber|zu|zum|zur)\s+(?:meine[nrs]?\s+|die\s+|den\s+|das\s+)?([\wäöüß -]{3,40})/i)?.[1];
  const titel = titelRoh ? titelRoh.trim().replace(/^\p{L}/u, (c) => c.toUpperCase()) : "Neue Tabelle";
  const sp = spalten.length ? spalten.map((s) => s.replace(/^\p{L}/u, (c) => c.toUpperCase())) : ["Nr.", "Was", "Wann", "Betrag", "Notiz"];
  return { titel, spalten: sp, zeilen: Array.from({ length: 20 }, (_, i) => sp.map((_, j) => (j === 0 && sp[0] === "Nr." ? i + 1 : ""))) };
}

export const istTabellenWunsch = (t) => /\b(excel|xlsx|tabelle|spreadsheet|kalkulationstabelle|numbers-tabelle)\b/i.test(String(t || ""));

// Werkzeug-Beschreibung für Claude
export const WERKZEUG = {
  name: "tabelle_erstellen",
  description: "Erstellt eine ECHTE Excel-Datei (.xlsx) für Boss, speichert sie im Archiv (~/Friday-Archiv/Tabellen), zeigt sie im Dashboard mit Download-Knopf und öffnet sie am Mac. Benutze es IMMER, wenn Boss eine Excel-Tabelle, Tabelle, Kalkulation, Liste zum Ausfüllen oder Übersicht mit Spalten will. Fülle sie mit echten, sinnvollen Inhalten (Beispielzeilen oder recherchierte Daten). Zahlen als Zahlen (z. B. 12.5 oder \"12,50 €\"). Formeln beginnen mit = und sind englische Excel-Formeln mit Komma (=SUM(C2:C10), =AVERAGE(...), =IF(...)). Mehrere Blätter mit blaetter.",
  input_schema: {
    type: "object",
    properties: {
      titel: { type: "string", description: "Titel und Dateiname, z. B. 'Haushaltsbuch November'" },
      spalten: { type: "array", items: { type: "string" }, description: "Spaltenüberschriften (bei nur einem Blatt)" },
      zeilen: { type: "array", items: { type: "array", items: {} }, description: "Zeilen als Listen von Werten (bei nur einem Blatt)" },
      blaetter: {
        type: "array",
        description: "Optional: mehrere Blätter",
        items: { type: "object", properties: { name: { type: "string" }, spalten: { type: "array", items: { type: "string" } }, zeilen: { type: "array", items: { type: "array", items: {} } } }, required: ["name", "spalten", "zeilen"] },
      },
    },
    required: ["titel"],
  },
};
