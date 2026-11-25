// Drucken per Sprache (v1.166.0, Stern-Idee aus der Ideen-Schmiede).
// "Friday, druck die Einkaufsliste" → Friday baut eine saubere Textseite und schickt sie mit `lp`
// an den Drucker, der am Mac eingerichtet ist (CUPS, ohne Zusatzprogramm). Ohne Claude.
// Druckbar: Einkaufsliste, Aufgaben, Packliste (aus dem Fenster), ein von Friday erstelltes Dokument, freier Text.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { sauber, datumLang, uhrzeit } from "./wunsch-hilfe.js";
import { U } from "./datum.js";

const DATEI = "drucken";
const run = (cmd, args, timeout = 20000) => new Promise((ok, nein) => execFile(cmd, args, { timeout }, (err, out, stderr) => (err ? nein(new Error(String(stderr || err.message).trim().split("\n")[0].slice(0, 200))) : ok(String(out)))));

export const einstellungen = () => ({ drucker: "", ...(store.load(DATEI, {}).einstellungen || {}) });
export function einstellen(e = {}) {
  const d = store.load(DATEI, {});
  d.einstellungen = { drucker: String(e.drucker ?? einstellungen().drucker).replace(/[^\w.@:-]/g, "").slice(0, 120) };
  store.save(DATEI, d);
  return d.einstellungen;
}

/** Drucker am Mac (lpstat). */
export async function drucker() {
  let liste = [], standard = "";
  try {
    const out = await run("lpstat", ["-p", "-d"]);
    for (const z of out.split("\n")) {
      const p = z.match(/^(?:printer|Drucker)\s+(\S+)\s+(.*)$/i);
      if (p) liste.push({ name: p[1], bereit: !/disabled|deaktiviert/i.test(p[2]), info: p[2].slice(0, 80) });
      const s = z.match(/(?:system default destination|Standard-Ziel des Systems|Standardziel)\s*:\s*(\S+)/i);
      if (s) standard = s[1];
    }
  } catch (err) {
    return { liste: [], standard: "", fehler: /ENOENT/.test(err.message) ? "Auf diesem Gerät gibt es keinen Druckdienst (lpstat fehlt)." : err.message.includes("No destinations") || /keine Ziele/i.test(err.message) ? "" : err.message };
  }
  return { liste, standard, gewaehlt: einstellungen().drucker };
}

const kopf = (titel) => `${titel}\n${"=".repeat(Math.min(60, titel.length))}\nGedruckt von Friday · ${datumLang(new Date().toISOString())}, ${uhrzeit(new Date().toISOString())} Uhr\n\n`;
/** Was soll gedruckt werden? → { titel, text } */
export function inhalt({ was = "einkauf", text = "", titel = "", id = "", zeilen } = {}) {
  if (was === "einkauf") {
    const l = store.getShopping().filter((x) => !x.done);
    if (!l.length) throw new Error("Die Einkaufsliste ist leer.");
    return { titel: "Einkaufsliste", text: kopf("Einkaufsliste") + l.map((x) => `[ ]  ${x.text}`).join("\n") };
  }
  if (was === "aufgaben") {
    const l = store.getTasks().filter((x) => !x.done);
    if (!l.length) throw new Error("Es gibt keine offenen Aufgaben.");
    return { titel: "Aufgaben", text: kopf("Meine Aufgaben") + l.map((x) => `[ ]  ${x.text}`).join("\n") };
  }
  if (was === "liste") {
    const z = (Array.isArray(zeilen) ? zeilen : String(text).split("\n")).map((s) => String(s).trim()).filter(Boolean).slice(0, 200);
    if (!z.length) throw new Error("Die Liste ist leer.");
    const t = String(titel || "Liste").slice(0, 80);
    return { titel: t, text: kopf(t) + z.map((s) => `[ ]  ${s}`).join("\n") };
  }
  if (was === "dokument") {
    const d = (store.load("dokumente", []) || []).find((x) => x.id === id);
    if (!d) throw new Error("Dokument nicht gefunden.");
    const t = String(d.titel || "Dokument");
    return { titel: t, text: kopf(t) + String(d.inhalt || (d.fragen || []).map((f, i) => `${i + 1}. ${f.frage || f}\n\n`).join("")) };
  }
  const t = String(titel || "Notiz").slice(0, 80);
  if (!String(text).trim()) throw new Error("Es gibt nichts zu drucken.");
  return { titel: t, text: kopf(t) + String(text).slice(0, 20000) };
}

/** Drucken mit lp (Text, 11 Punkt, mit Rand). */
export async function drucke(auftrag = {}) {
  const { titel, text } = inhalt(auftrag);
  const datei = path.join(os.tmpdir(), `friday-druck-${Date.now().toString(36)}.txt`);
  fs.writeFileSync(datei, text, "utf8");
  const ziel = auftrag.drucker || einstellungen().drucker;
  const args = ["-t", `Friday: ${titel}`, "-o", "cpi=12", "-o", "lpi=7", "-o", "page-left=54", "-o", "page-top=54", ...(ziel ? ["-d", ziel] : []), datei];
  try {
    const out = await run("lp", args);
    const job = (out.match(/request id is (\S+)|Auftrags-ID ist (\S+)/i) || [])[1] || "";
    logbuch.eintragen({ bereich: "drucken", titel: `Gedruckt: ${titel}`, details: ziel || "Standard-Drucker" });
    return { ok: true, titel, job, drucker: ziel || "Standard-Drucker" };
  } catch (err) {
    if (/ENOENT/.test(err.message)) throw new Error("Drucken klappt nur auf dem Mac, hier gibt es keinen Druckdienst.");
    if (/no default destination|kein Standardziel|No such file|does not exist|existiert nicht/i.test(err.message)) throw new Error("Am Mac ist kein Drucker eingerichtet. Systemeinstellungen → Drucker & Scanner → Drucker hinzufügen.");
    throw err;
  } finally {
    setTimeout(() => fs.rm(datei, { force: true }, () => {}), 60000);
  }
}

const FRAGE = U(/^(?:bitte )?(?:druck|drucke|druckst du|kannst du)(?: mir)?(?: bitte)? (.+?)(?: aus)?(?: drucken)?$/);
export async function quickCommand(text) {
  const { t, k } = sauber(text);
  if (!/\b(druck|drucke|drucken|ausdrucken)\b/.test(k)) return null;
  if (/\b(drucker|druckerpatrone|blutdruck|luftdruck|eindruck|ausdruck von)\b/.test(k) && !/^(druck|drucke)\b/.test(k)) return null;
  let auftrag = null;
  if (/einkauf/.test(k)) auftrag = { was: "einkauf" };
  else if (/aufgabe|to-?do/.test(k)) auftrag = { was: "aufgaben" };
  else {
    const frei = t.match(/^(?:bitte )?(?:druck|drucke)(?: mir)?(?: bitte)?(?: aus)?\s*[:,]\s*(.{3,})$/i);
    if (frei) auftrag = { was: "text", titel: "Notiz", text: frei[1] };
    else if (FRAGE.test(k) && /\b(dokument|brief|fragebogen)\b/.test(k)) {
      const docs = store.load("dokumente", []) || [];
      const d = docs[docs.length - 1];
      if (d) auftrag = { was: "dokument", id: d.id };
    }
  }
  if (!auftrag) return /^(druck|drucke)\b/.test(k) ? { answer: "Was soll ich drucken? Zum Beispiel: „Druck die Einkaufsliste“, „Druck meine Aufgaben“ oder „Drucke: …“ mit deinem Text.", actions: ["wunsch:drucken"] } : null;
  try {
    const r = await drucke(auftrag);
    return { answer: `Ich drucke ${r.titel === "Notiz" ? "deine Notiz" : `die ${r.titel}`} auf ${r.drucker}.`, actions: ["wunsch:drucken"] };
  } catch (err) {
    return { answer: `Das Drucken hat nicht geklappt: ${err.message}`, actions: ["wunsch:drucken"] };
  }
}
