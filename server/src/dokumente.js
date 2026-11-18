// Dokumente und Fragebögen, die Friday für Boss erstellt (data/dokumente.json).
// Fragebögen kann Boss im Dashboard ausfüllen; die Antworten landen in Fridays Gedächtnis.
import * as store from "./store.js";

const MAX = 200;
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export function alleDokumente() {
  return store.load("dokumente", []);
}
export function dokument(id) {
  return alleDokumente().find((d) => d.id === id) || null;
}
function speichern(liste) {
  store.save("dokumente", liste.slice(-MAX));
}

export function dokumentErstellen({ titel, inhalt }) {
  const d = { id: neueId(), art: "dokument", titel: String(titel || "Dokument").slice(0, 120), inhalt: String(inhalt || "").slice(0, 60000), erstellt: new Date().toISOString() };
  if (!d.inhalt.trim()) return { error: "Der Inhalt fehlt." };
  speichern([...alleDokumente(), d]);
  store.logActivity("dokument", `Dokument erstellt: ${d.titel}`);
  return d;
}

export function fragebogenErstellen({ titel, fragen }) {
  const liste = (Array.isArray(fragen) ? fragen : String(fragen || "").split("\n"))
    .map((f) => String(typeof f === "object" && f ? f.frage || f.text || "" : f).replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 60);
  if (liste.length < 1) return { error: "Keine Fragen übergeben." };
  const d = { id: neueId(), art: "fragebogen", titel: String(titel || "Fragebogen").slice(0, 120), fragen: liste.map((frage) => ({ frage: frage.slice(0, 300), antwort: "" })), erstellt: new Date().toISOString(), fertig: false };
  speichern([...alleDokumente(), d]);
  store.logActivity("dokument", `Fragebogen erstellt: ${d.titel} (${liste.length} Fragen)`);
  return d;
}

// Antworten speichern (auch zwischendurch). Mit fertig=true kommen sie ins Gedächtnis.
export function antwortenSpeichern(id, antworten = [], fertig = false) {
  const liste = alleDokumente();
  const d = liste.find((x) => x.id === id && x.art === "fragebogen");
  if (!d) return { error: "Fragebogen nicht gefunden." };
  d.fragen.forEach((f, i) => { if (typeof antworten[i] === "string") f.antwort = antworten[i].slice(0, 1000); });
  d.geaendert = new Date().toISOString();
  let gemerkt = 0;
  if (fertig && !d.fertig) {
    d.fertig = true;
    for (const f of d.fragen) {
      if (!f.antwort.trim()) continue;
      store.addMemory(`Fragebogen „${d.titel}“: ${f.frage} → ${f.antwort.trim()}`);
      gemerkt++;
    }
    store.logActivity("gedaechtnis", `Fragebogen ausgefüllt: ${d.titel} (${gemerkt} Antworten gemerkt)`);
  }
  speichern(liste);
  return { ok: true, gemerkt, fertig: d.fertig };
}
