// Gedächtnis in Schubladen (v1.135.0, Idee aus Conway-Research/automaton, MIT – in Node nachgebaut).
//   📌 Fakten     – was Friday über Boss weiß (die bisherige Gedächtnis-Liste, jetzt mit Schubladen)
//   🧭 Abläufe    – wie man etwas macht, Schritt für Schritt, mit "hat geklappt"-Zähler
//   🕘 Ereignisse – was Friday zuletzt getan hat (Werkzeuge, Ergebnis)
// Vor jeder Antwort holt sich Friday nur das, was zur Frage passt (spart Guthaben, wenn das Gedächtnis wächst).
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";

export const SCHUBLADEN = {
  person: ["👤", "Menschen"],
  vorliebe: ["❤️", "Vorlieben"],
  ort: ["📍", "Orte"],
  termin: ["📅", "Termine & Daten"],
  technik: ["💻", "Technik & Geräte"],
  arbeit: ["💼", "Arbeit & Projekte"],
  sonstiges: ["📌", "Sonstiges"],
};
const RATEN = [
  ["person", /\b(frau|mann|sohn|tochter|kind|kinder|mutter|vater|mama|papa|bruder|schwester|freund\w*|oma|opa|heißt|heisst|name|kollege|chef|carla)\b/i],
  ["termin", /\b(geburtstag|jahrestag|termin|am \d|\d{1,2}\.\d{1,2}\.|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i],
  ["vorliebe", /\b(mag|liebt?|lieblings\w*|hasst?|bevorzug\w*|trinkt|isst|gern|lieber|allergi\w*|vegan|vegetar\w*)\b/i],
  ["ort", /\b(wohn\w*|adresse|stadt|straße|strasse|arbeitet in|urlaub in|zuhause|zu hause)\b/i],
  ["technik", /\b(mac|iphone|ipad|auto|tv|fernseher|router|wlan|computer|laptop|app|konsole|ps5|xbox)\b/i],
  ["arbeit", /\b(arbeit|job|firma|projekt|kunde|beruf|schicht|büro|buero)\b/i],
];
export function rateSchublade(text = "") {
  for (const [k, re] of RATEN) if (re.test(text)) return k;
  return "sonstiges";
}

const STOP = new Set("der die das und oder aber ein eine einen einem einer ist sind war bin bist hat habe hast mit von zu zum zur im in am an auf aus für fuer was wie wer wo wann warum mir mich mein meine dein deine ich du er sie es wir ihr den dem des nicht noch auch schon mal bitte friday boss kannst kann soll sollst mach mache zeig zeige sag sage gib".split(" "));
function woerter(t = "") {
  return [...new Set(String(t).toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];
}
function passt(text, frageWoerter) {
  if (!frageWoerter.length) return 0;
  const t = String(text).toLowerCase();
  let p = 0;
  for (const w of frageWoerter) if (t.includes(w.slice(0, Math.max(4, w.length - 2)))) p++;
  return p;
}

// ---------- Fakten (bisherige Gedächtnis-Liste) ----------
export function fakten() {
  return store.getMemories().map((m) => ({ ...m, schublade: m.schublade || rateSchublade(m.text) }));
}
export function faktMerken(text, schublade) {
  const e = store.addMemory(String(text || "").trim());
  const k = SCHUBLADEN[schublade] ? schublade : rateSchublade(e.text);
  const liste = store.getMemories();
  const m = liste.find((x) => x.id === e.id);
  if (m) { m.schublade = k; store.save("memory", liste); }
  return { ...e, schublade: k };
}
export function faktVerschieben(id, schublade) {
  if (!SCHUBLADEN[schublade]) return { error: "Unbekannte Schublade." };
  const liste = store.getMemories();
  const m = liste.find((x) => x.id === id);
  if (!m) return { error: "Eintrag nicht gefunden." };
  m.schublade = schublade;
  store.save("memory", liste);
  return { ok: true };
}
export function faktLoeschen(id) {
  const liste = store.getMemories();
  const m = liste.find((x) => x.id === id);
  if (!m) return { error: "Eintrag nicht gefunden." };
  store.save("memory", liste.filter((x) => x.id !== id));
  eintragen({ bereich: "gedaechtnis", titel: `Vergessen: ${m.text}`, quelle: "dashboard" });
  return { ok: true };
}

// ---------- Abläufe ----------
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export function ablaeufe() { return store.load("ablaeufe", []); }
export function ablaufSpeichern({ name, schritte, ausloeser } = {}) {
  const n = String(name || "").trim().slice(0, 80);
  const s = (Array.isArray(schritte) ? schritte : String(schritte || "").split(/\n+/)).map((x) => String(x).replace(/^\s*[-*\d.)]+\s*/, "").trim()).filter(Boolean).slice(0, 25).map((x) => x.slice(0, 300));
  if (!n || !s.length) return { error: "Ein Ablauf braucht einen Namen und mindestens einen Schritt." };
  const liste = ablaeufe();
  let a = liste.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (a) { a.schritte = s; a.geaendert = new Date().toISOString(); }
  else { a = { id: neueId(), name: n, schritte: s, erfolg: 0, fehlschlag: 0, erstellt: new Date().toISOString() }; liste.push(a); }
  if (ausloeser) a.ausloeser = String(ausloeser).slice(0, 200);
  store.save("ablaeufe", liste.slice(-150));
  eintragen({ bereich: "gedaechtnis", titel: `Ablauf gespeichert: ${n}`, details: s.join(" → ").slice(0, 300) });
  return { ok: true, ablauf: a };
}
export function ablaufBewerten(nameOderId, geklappt) {
  const liste = ablaeufe();
  const q = String(nameOderId || "").toLowerCase();
  const a = liste.find((x) => x.id === nameOderId || x.name.toLowerCase() === q) || liste.find((x) => x.name.toLowerCase().includes(q));
  if (!a) return { error: "Diesen Ablauf kenne ich nicht." };
  if (geklappt) a.erfolg++; else a.fehlschlag++;
  a.zuletzt = new Date().toISOString();
  store.save("ablaeufe", liste);
  return { ok: true, ablauf: a };
}
export function ablaufLoeschen(id) {
  const liste = ablaeufe();
  if (!liste.some((x) => x.id === id)) return { error: "Ablauf nicht gefunden." };
  store.save("ablaeufe", liste.filter((x) => x.id !== id));
  return { ok: true };
}
export function ablaufFinden(frage) {
  const w = woerter(frage);
  return ablaeufe().map((a) => ({ a, p: passt(`${a.name} ${a.ausloeser || ""} ${a.schritte.join(" ")}`, w) + passt(a.name, w) }))
    .filter((x) => x.p >= 2).sort((x, y) => y.p - x.p || (y.a.erfolg - y.a.fehlschlag) - (x.a.erfolg - x.a.fehlschlag)).slice(0, 3).map((x) => x.a);
}

// ---------- Ereignisse ----------
export function ereignisse() { return store.load("ereignisse", []); }
export function ereignis({ werkzeug, kurz, ok = true, kanal = "" } = {}) {
  try {
    const liste = ereignisse();
    liste.push({ zeit: new Date().toISOString(), werkzeug: String(werkzeug || "").slice(0, 40), kurz: String(kurz || "").slice(0, 200), ok: ok !== false, kanal: String(kanal || "").slice(0, 20) });
    store.save("ereignisse", liste.slice(-400));
  } catch { /* egal */ }
}

// ---------- Vor jeder Antwort: das Passende holen ----------
const MAX_FAKTEN = 60;
/** Text-Block für Fridays Kontext. */
export function kontext(frage = "") {
  const w = woerter(frage);
  const alle = fakten();
  let gewaehlt = alle;
  if (alle.length > MAX_FAKTEN) {
    const neueste = new Set(alle.slice(-15).map((m) => m.id));
    gewaehlt = alle.map((m, i) => ({ m, p: passt(m.text, w) * 10 + (neueste.has(m.id) ? 5 : 0) + i / alle.length }))
      .sort((a, b) => b.p - a.p).slice(0, MAX_FAKTEN).map((x) => x.m);
  }
  const nachSchublade = {};
  for (const m of gewaehlt) (nachSchublade[m.schublade] ||= []).push(m.text);
  let text = Object.entries(nachSchublade).map(([k, l]) => `${SCHUBLADEN[k]?.[1] || k}:\n${l.map((t) => `- ${t}`).join("\n")}`).join("\n") || "(noch nichts)";
  if (alle.length > gewaehlt.length) text += `\n(${alle.length - gewaehlt.length} weitere Einträge passen gerade nicht zur Frage.)`;
  const ab = ablaufFinden(frage);
  const abText = ab.length ? ab.map((a) => `- ${a.name} (${a.erfolg}× geklappt, ${a.fehlschlag}× nicht): ${a.schritte.map((s, i) => `${i + 1}. ${s}`).join(" ")}`).join("\n") : "";
  const ev = ereignisse();
  const evPassend = w.length ? ev.filter((e) => passt(`${e.werkzeug} ${e.kurz}`, w) >= 2).slice(-4) : [];
  const evText = evPassend.map((e) => `- ${new Date(e.zeit).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}: ${e.kurz || e.werkzeug}${e.ok ? "" : " (ging schief)"}`).join("\n");
  return { fakten: text, ablaeufe: abText, ereignisse: evText };
}

// ---------- Pflege (Herzschlag, nachts) ----------
export function pflege() {
  const liste = store.getMemories();
  const gesehen = new Set();
  const sauber = liste.filter((m) => { const k = m.text.trim().toLowerCase(); if (gesehen.has(k)) return false; gesehen.add(k); return true; });
  let neu = 0;
  for (const m of sauber) if (!m.schublade) { m.schublade = rateSchublade(m.text); neu++; }
  if (sauber.length !== liste.length || neu) store.save("memory", sauber);
  return { doppelt: liste.length - sauber.length, einsortiert: neu };
}

export function uebersicht() {
  const f = fakten();
  const zaehl = {};
  for (const m of f) zaehl[m.schublade] = (zaehl[m.schublade] || 0) + 1;
  return { schubladen: SCHUBLADEN, zaehl, fakten: f.slice().reverse(), ablaeufe: ablaeufe().slice().reverse(), ereignisse: ereignisse().slice(-60).reverse() };
}
