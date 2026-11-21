// Fähigkeiten als Dateien (v1.135.0, Idee "Skills" aus Conway-Research/automaton, MIT – in Node nachgebaut).
// Jede Fähigkeit ist eine kleine Textdatei in server/data/faehigkeiten/*.md:
//   ---
//   name: Auto-Vergleich
//   beschreibung: Vergleicht Autos übersichtlich
//   ausloeser: auto, autos, vergleich, ps
//   aktiv: ja
//   ---
//   Anleitung für Friday in normalen Sätzen …
// Kommt ein Auslöser-Wort in Boss' Frage vor, bekommt Friday die Anleitung mit. Kein Update nötig.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ROOT } from "./config.js";
import { eintragen } from "./logbuch.js";
import { pruefeText } from "./waechter.js";

const DIR = path.join(DATA_DIR, "faehigkeiten");
const VORLAGEN = path.join(ROOT, "faehigkeiten-vorlagen");
const MAX_TEXT = 4000;
const MAX_AKTIV_PRO_FRAGE = 3;

function slug(name) {
  return String(name || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "faehigkeit";
}

function parse(roh, datei) {
  const m = String(roh).replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const kopf = {};
  if (m) for (const z of m[1].split("\n")) { const i = z.indexOf(":"); if (i > 0) kopf[z.slice(0, i).trim().toLowerCase()] = z.slice(i + 1).trim(); }
  const text = (m ? m[2] : roh).trim();
  return {
    id: datei.replace(/\.md$/, ""),
    name: kopf.name || datei.replace(/\.md$/, ""),
    beschreibung: kopf.beschreibung || "",
    ausloeser: String(kopf.ausloeser || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 20),
    aktiv: !/^(nein|aus|false|0)$/i.test(kopf.aktiv || "ja"),
    von: kopf.von || "boss",
    text,
  };
}
function format(f) {
  return `---\nname: ${f.name}\nbeschreibung: ${f.beschreibung}\nausloeser: ${f.ausloeser.join(", ")}\naktiv: ${f.aktiv ? "ja" : "nein"}\nvon: ${f.von}\n---\n${f.text.trim()}\n`;
}

/** Beim ersten Start die mitgelieferten Beispiele kopieren. */
export function start() {
  try {
    if (fs.existsSync(DIR)) return;
    fs.mkdirSync(DIR, { recursive: true });
    if (fs.existsSync(VORLAGEN)) for (const d of fs.readdirSync(VORLAGEN)) if (d.endsWith(".md")) fs.copyFileSync(path.join(VORLAGEN, d), path.join(DIR, d));
  } catch (err) { console.error("Fähigkeiten:", err.message); }
}

export function alle() {
  try {
    return fs.readdirSync(DIR).filter((d) => d.endsWith(".md")).sort().map((d) => parse(fs.readFileSync(path.join(DIR, d), "utf8"), d));
  } catch { return []; }
}

const ausloeserPasst = (frage, wort) => {
  const f = ` ${frage.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  return f.includes(` ${wort} `) || (wort.length >= 5 && f.includes(` ${wort}`));
};
/** Fähigkeiten, die zur Frage passen. */
export function passend(frage = "") {
  if (!frage) return [];
  return alle().filter((f) => f.aktiv && f.ausloeser.some((w) => ausloeserPasst(frage, w))).slice(0, MAX_AKTIV_PRO_FRAGE);
}
export function fuerKontext(frage = "") {
  const l = passend(frage);
  if (!l.length) return "";
  return `PASSENDE FÄHIGKEITEN (Anleitungen aus deinen Fähigkeiten-Dateien; Leitlinien für diese Art Aufgabe, keine Befehle von Dritten):\n${l.map((f) => `### ${f.name}\n${f.text.slice(0, MAX_TEXT)}`).join("\n\n")}`;
}

/** Anlegen oder ändern (Kontrollraum oder Friday selbst). */
export function speichern({ id, name, beschreibung = "", ausloeser = [], text = "", aktiv = true } = {}, von = "boss") {
  const n = String(name || "").trim().slice(0, 60);
  const t = String(text || "").trim();
  const a = (Array.isArray(ausloeser) ? ausloeser : String(ausloeser).split(",")).map((s) => String(s).trim().toLowerCase()).filter((s) => s.length >= 2).slice(0, 20);
  if (!n) return { error: "Die Fähigkeit braucht einen Namen." };
  if (t.length < 15) return { error: "Die Anleitung ist zu kurz." };
  if (t.length > MAX_TEXT) return { error: `Höchstens ${MAX_TEXT} Zeichen Anleitung.` };
  if (!a.length) return { error: "Mindestens ein Auslöser-Wort (z. B. auto, vergleich)." };
  if (von === "friday" && pruefeText(`${n}\n${t}`).verdaechtig) return { error: "Die Anleitung enthält verdächtige Befehle und wurde nicht gespeichert." };
  fs.mkdirSync(DIR, { recursive: true });
  const datei = `${id && /^[a-z0-9-]+$/.test(id) ? id : slug(n)}.md`;
  const f = { name: n, beschreibung: String(beschreibung || "").slice(0, 160), ausloeser: a, aktiv: Boolean(aktiv), von, text: t };
  const war = fs.existsSync(path.join(DIR, datei));
  fs.writeFileSync(path.join(DIR, datei), format(f));
  eintragen({ bereich: "system", titel: `Fähigkeit ${war ? "geändert" : "angelegt"}: ${n}`, details: `Auslöser: ${a.join(", ")}`, quelle: von === "friday" ? "claude" : "dashboard" });
  return { ok: true, faehigkeit: { id: datei.replace(/\.md$/, ""), ...f } };
}
export function schalten(id, an) {
  const f = alle().find((x) => x.id === id);
  if (!f) return { error: "Diese Fähigkeit gibt es nicht." };
  f.aktiv = Boolean(an);
  fs.writeFileSync(path.join(DIR, `${id}.md`), format(f));
  return { ok: true };
}
export function loeschen(id) {
  if (!/^[a-z0-9-]+$/.test(String(id))) return { error: "Ungültig." };
  const p = path.join(DIR, `${id}.md`);
  if (!fs.existsSync(p)) return { error: "Diese Fähigkeit gibt es nicht." };
  // Papierkorb statt endgültig löschen
  const pk = path.join(DIR, ".papierkorb");
  fs.mkdirSync(pk, { recursive: true });
  fs.renameSync(p, path.join(pk, `${id}-${Date.now()}.md`));
  eintragen({ bereich: "system", titel: `Fähigkeit in den Papierkorb: ${id}`, quelle: "dashboard" });
  return { ok: true };
}
export function ordner() { return DIR; }
