// Gedächtnis in Schubladen (v1.135.0, Idee aus Conway-Research/automaton, MIT – in Node nachgebaut).
//   📌 Fakten     – was Friday über Boss weiß (die bisherige Gedächtnis-Liste, jetzt mit Schubladen)
//   🧭 Abläufe    – wie man etwas macht, Schritt für Schritt, mit "hat geklappt"-Zähler
//   🕘 Ereignisse – was Friday zuletzt getan hat (Werkzeuge, Ergebnis)
// Vor jeder Antwort holt sich Friday nur das, was zur Frage passt (spart Guthaben, wenn das Gedächtnis wächst).
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";
import { sende } from "./ereignisbus.js";

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
export function faktMerken(text, schublade, { quelle = "" } = {}) {
  const e = store.addMemory(String(text || "").trim());
  const k = SCHUBLADEN[schublade] ? schublade : rateSchublade(e.text);
  const liste = store.getMemories();
  const m = liste.find((x) => x.id === e.id);
  if (m) { m.schublade = k; m.ebene = "lang"; if (quelle) m.quelle = quelle; store.save("memory", liste); }
  sende("gedaechtnis", { ebene: "lang", titel: `Langzeit: ${e.text}` });
  return { ...e, schublade: k, ebene: "lang" };
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
  return { ...kontextBasis(frage), kurzzeit: kurzKontext(), projekt: projektKontext(frage) };
}
function kontextBasis(frage = "") {
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
  kurzAufraeumen();
  const liste = store.getMemories();
  const gesehen = new Set();
  const sauber = liste.filter((m) => { const k = m.text.trim().toLowerCase(); if (gesehen.has(k)) return false; gesehen.add(k); return true; });
  let neu = 0;
  for (const m of sauber) if (!m.schublade) { m.schublade = rateSchublade(m.text); neu++; }
  if (sauber.length !== liste.length || neu) store.save("memory", sauber);
  return { doppelt: liste.length - sauber.length, einsortiert: neu };
}

export function uebersicht() {
  kurzAufraeumen();
  const f = fakten();
  const zaehl = {};
  for (const m of f) zaehl[m.schublade] = (zaehl[m.schublade] || 0) + 1;
  return { schubladen: SCHUBLADEN, zaehl, fakten: f.slice().reverse(), ablaeufe: ablaeufe().slice().reverse(), ereignisse: ereignisse().slice(-60).reverse(), kurzzeit: kurzzeit().slice().reverse(), projekte: projekte() };
}


// =====================================================================================
// v1.179.0 (Mark XII Punkte 3, 23, 35): Gedächtnis in drei Ebenen
//   ⏱ Kurzzeit  – Themen der letzten Tage und kurze Notizen ("merk dir für heute …"). Verfällt nach 7 Tagen.
//   🗄 Langzeit  – die bisherigen Fakten (alles, was Boss ausdrücklich merken lässt).
//   📁 Projekte  – Notizen zu einem Projekt ("merk dir für Projekt Garage: …"), mit aktivem Projekt.
// Erinnerungsintelligenz: Ein Thema, nach dem Boss an 3 verschiedenen Tagen fragt, wandert von selbst
// ins Langzeitgedächtnis ("Boss interessiert sich für …"). Vor jeder Antwort holt Friday Kurzzeit,
// das aktive Projekt und jedes in der Frage genannte Projekt dazu.
// =====================================================================================
export const EBENEN = { kurz: ["⏱", "Kurzzeit"], lang: ["🗄", "Langzeit"], projekt: ["📁", "Projekte"] };
const KURZ_TAGE = 7;
const BEFOERDERN_TAGE = 3;
const tagHeute = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

export function kurzzeit() { return store.load("kurzzeit", []); }
function kurzSpeichern(l) { store.save("kurzzeit", l.slice(-250)); }
export function kurzAufraeumen() {
  const grenze = Date.now() - KURZ_TAGE * 86400000;
  const l = kurzzeit();
  const rest = l.filter((k) => new Date(k.bis || k.zuletzt || k.erstellt).getTime() > (k.bis ? Date.now() : grenze));
  if (rest.length !== l.length) kurzSpeichern(rest);
  return l.length - rest.length;
}

// Themen aus einer Frage: großgeschriebene Wörter (im Deutschen meist Hauptwörter/Namen), ohne Füllwörter.
const THEMA_STOP = new Set("Friday Boss Bitte Danke Hallo Hey Was Wie Wer Wo Wann Warum Wieso Welche Welcher Welches Kannst Kann Mach Mache Zeig Zeige Sag Sage Gib Öffne Starte Erzähl Erklär Erkläre Ist Sind Hast Habe Wird Werden Gibt Und Oder Aber Der Die Das Ein Eine Mein Meine Dein Deine Ich Du Er Sie Es Wir Ihr Heute Morgen Gestern Jetzt Noch Mal Nein Okay Ok Uhr Minuten Stunden Tag Tage Woche Euro Prozent Frage Antwort Liste Info Infos Bild Foto Projekt Projekte Gedächtnis Wissensnetz Notiz Notizen Meter Thema Themen Cockpit Wetter Nachrichten Uhrzeit Timer Wecker Musik Licht Lampe Erinnerung Erinnerungen Einkaufsliste Aufgaben Lagezentrum Weltgeschehen Kalender Termin Termine Spotify Netflix YouTube Alexa Fernseher Briefing Status System Einstellungen Update".split(" "));
export function themenAus(text = "") {
  const roh = String(text).replace(/[„“"'’]/g, " ");
  const funde = new Set();
  for (const m of roh.matchAll(/\b([A-ZÄÖÜ][\p{L}\d-]{2,}(?:\s+[A-ZÄÖÜ][\p{L}\d-]{2,})?)/gu)) {
    const teile = m[1].trim().split(/\s+/);
    while (teile.length && THEMA_STOP.has(teile[0])) teile.shift();
    const w = teile.join(" ");
    if (w.length >= 4 && !THEMA_STOP.has(teile.at(-1))) funde.add(w);
  }
  return [...funde].slice(0, 5);
}

/** Nach jeder Frage (nicht im Gäste-Modus): Themen ins Kurzzeitgedächtnis, oft Gefragtes befördern. */
export function mitDenken(frage = "") {
  try {
    const themen = themenAus(frage);
    if (!themen.length) return [];
    const l = kurzzeit();
    const heute = tagHeute();
    const jetzt = new Date().toISOString();
    const befoerdert = [];
    for (const t of themen) {
      let k = l.find((x) => x.art === "thema" && x.text.toLowerCase() === t.toLowerCase());
      if (!k) { k = { id: neueId(), art: "thema", text: t, erstellt: jetzt, tage: [], treffer: 0 }; l.push(k); sende("gedaechtnis", { ebene: "kurz", titel: `Kurzzeit: Thema „${t}“` }); }
      k.zuletzt = jetzt;
      k.treffer = (k.treffer || 0) + 1;
      if (!k.tage.includes(heute)) k.tage = [...k.tage, heute].slice(-14);
      if (!k.befoerdert && k.tage.length >= BEFOERDERN_TAGE) {
        k.befoerdert = jetzt;
        const satz = `Boss interessiert sich für ${t} (an ${k.tage.length} Tagen danach gefragt).`;
        if (!fakten().some((f) => f.text.toLowerCase().includes(`für ${t.toLowerCase()}`))) {
          faktMerken(satz, undefined, { quelle: "erinnerungsintelligenz" });
          befoerdert.push(t);
          eintragen({ bereich: "gedaechtnis", titel: `Erinnerungsintelligenz: „${t}“ ins Langzeitgedächtnis übernommen`, details: `An ${k.tage.length} verschiedenen Tagen gefragt.`, quelle: "friday" });
        }
      }
    }
    kurzSpeichern(l);
    return befoerdert;
  } catch {
    return [];
  }
}

export function kurzMerken(text, { stunden = 48 } = {}) {
  const t = String(text || "").trim().slice(0, 300);
  if (!t) return { error: "Was soll ich mir merken?" };
  const l = kurzzeit();
  const gleich = l.find((x) => x.art === "notiz" && x.text.toLowerCase() === t.toLowerCase());
  if (gleich) { gleich.bis = new Date(Date.now() + stunden * 3600000).toISOString(); kurzSpeichern(l); return gleich; }
  const e = { id: neueId(), art: "notiz", text: t, erstellt: new Date().toISOString(), bis: new Date(Date.now() + stunden * 3600000).toISOString() };
  l.push(e);
  kurzSpeichern(l);
  eintragen({ bereich: "gedaechtnis", titel: `Kurzzeit gemerkt: ${t}`, quelle: "friday" });
  sende("gedaechtnis", { ebene: "kurz", titel: `Kurzzeit: ${t}` });
  return e;
}
export function kurzWeg(id) { kurzSpeichern(kurzzeit().filter((k) => k.id !== id)); return { ok: true }; }
/** Von Hand ins Langzeitgedächtnis übernehmen (Knopf im Gedächtnis-Monitor). */
export function befoerdern(id) {
  const l = kurzzeit();
  const k = l.find((x) => x.id === id);
  if (!k) return { error: "Eintrag nicht gefunden." };
  const satz = k.art === "thema" ? `Boss interessiert sich für ${k.text}.` : k.text;
  const schon = fakten().find((f) => f.text.trim().toLowerCase() === satz.trim().toLowerCase());
  const f = schon || faktMerken(satz, undefined, { quelle: "gedaechtnis-monitor" });
  k.befoerdert = new Date().toISOString();
  kurzSpeichern(l);
  return f;
}
function kurzKontext() {
  const l = kurzzeit();
  const seit = Date.now() - 48 * 3600000;
  const notizen = l.filter((k) => k.art === "notiz" && new Date(k.bis).getTime() > Date.now()).map((k) => `- ${k.text}`);
  const themen = l.filter((k) => k.art === "thema" && new Date(k.zuletzt).getTime() > seit).sort((a, b) => b.zuletzt.localeCompare(a.zuletzt)).slice(0, 8).map((k) => k.text);
  const teile = [];
  if (notizen.length) teile.push(`Kurz gemerkt (gilt nur ein paar Tage):\n${notizen.join("\n")}`);
  if (themen.length) teile.push(`Worüber Boss in den letzten 2 Tagen gesprochen hat: ${themen.join(", ")}`);
  return teile.join("\n");
}

// ---------- Projektgedächtnis ----------
export function projekte() { return store.load("projekte", []); }
function projekteSpeichern(l) { store.save("projekte", l); }
const projektNorm = (n) => String(n || "").toLowerCase().replace(/^(das|die|der|mein|meinem|meinen|unser)\s+/, "").replace(/^projekt\s+/, "").trim();
export function projektFinden(name) {
  const n = projektNorm(name);
  if (!n) return null;
  return projekte().find((p) => projektNorm(p.name) === n) || projekte().find((p) => projektNorm(p.name).startsWith(n) || n.startsWith(projektNorm(p.name))) || null;
}
export function projektAnlegen(name, { aktiv = true } = {}) {
  const n = String(name || "").trim().replace(/^projekt\s+/i, "").slice(0, 60);
  if (n.length < 2) return { error: "Wie soll das Projekt heißen?" };
  const l = projekte();
  let p = l.find((x) => projektNorm(x.name) === projektNorm(n));
  if (!p) { p = { id: neueId(), name: n.charAt(0).toUpperCase() + n.slice(1), erstellt: new Date().toISOString(), notizen: [], status: "offen" }; l.push(p); eintragen({ bereich: "gedaechtnis", titel: `Projekt angelegt: ${p.name}`, quelle: "friday" }); }
  if (aktiv) for (const x of l) x.aktiv = x.id === p.id;
  projekteSpeichern(l);
  return p;
}
export function projektNotiz(name, text) {
  const t = String(text || "").trim().slice(0, 500);
  if (!t) return { error: "Was soll ich mir zu dem Projekt merken?" };
  const p0 = projektFinden(name) || projektAnlegen(name, { aktiv: false });
  if (p0.error) return p0;
  const l = projekte();
  const p = l.find((x) => x.id === p0.id);
  p.notizen.push({ id: neueId(), text: t, zeit: new Date().toISOString() });
  p.geaendert = new Date().toISOString();
  projekteSpeichern(l);
  eintragen({ bereich: "gedaechtnis", titel: `Projekt ${p.name}: ${t}`, quelle: "friday" });
  sende("gedaechtnis", { ebene: "projekt", titel: `Projekt ${p.name}: ${t}` });
  return p;
}
export function projektSetzen(id, patch = {}) {
  const l = projekte();
  const p = l.find((x) => x.id === id);
  if (!p) return { error: "Projekt nicht gefunden." };
  if (patch.aktiv !== undefined) for (const x of l) x.aktiv = patch.aktiv ? x.id === id : x.id === id ? false : x.aktiv;
  if (patch.status) p.status = patch.status === "fertig" ? "fertig" : "offen";
  if (patch.weg) { projekteSpeichern(l.filter((x) => x.id !== id)); return { ok: true }; }
  if (patch.notizWeg) p.notizen = p.notizen.filter((n) => n.id !== patch.notizWeg);
  projekteSpeichern(l);
  return p;
}
export const aktivesProjekt = () => projekte().find((p) => p.aktiv && p.status !== "fertig") || null;
function projektKontext(frage = "") {
  const f = String(frage).toLowerCase();
  const genannt = projekte().filter((p) => f.includes(projektNorm(p.name)));
  const a = aktivesProjekt();
  const liste = [...new Set([...(a ? [a] : []), ...genannt])];
  return liste.map((p) => `Projekt „${p.name}“${p.aktiv ? " (aktiv – Boss arbeitet gerade daran)" : ""}${p.status === "fertig" ? " (abgeschlossen)" : ""}:\n${p.notizen.slice(-15).map((n) => `- ${n.text}`).join("\n") || "- (noch keine Notizen)"}`).join("\n");
}

// ---------- Gedächtnis-Monitor (Cockpit) ----------
export function monitor() {
  kurzAufraeumen();
  const neu = [];
  for (const f of fakten()) neu.push({ id: f.id, ebene: "lang", text: f.text, zeit: f.created || null, schublade: f.schublade, quelle: f.quelle || "" });
  for (const k of kurzzeit()) neu.push({ id: k.id, ebene: "kurz", text: k.art === "thema" ? `Thema: ${k.text} (${k.tage?.length || 1} Tag${(k.tage?.length || 1) === 1 ? "" : "e"})` : k.text, zeit: k.art === "thema" ? k.zuletzt : k.erstellt, bis: k.bis || null, befoerdert: k.befoerdert || null });
  for (const p of projekte()) for (const n of p.notizen) neu.push({ ebene: "projekt", text: `${p.name}: ${n.text}`, zeit: n.zeit });
  neu.sort((a, b) => String(b.zeit || "").localeCompare(String(a.zeit || "")));
  const l = kurzzeit();
  return {
    ebenen: EBENEN,
    zaehl: { kurz: l.length, lang: fakten().length, projekt: projekte().reduce((s, p) => s + p.notizen.length, 0), projekte: projekte().length, ablaeufe: ablaeufe().length },
    neu: neu.slice(0, 80),
    befoerdert: l.filter((k) => k.befoerdert).map((k) => ({ text: k.text, zeit: k.befoerdert })).slice(-10).reverse(),
    projekte: projekte().map((p) => ({ ...p, notizen: p.notizen.slice().reverse() })),
    aktiv: aktivesProjekt()?.name || null,
  };
}

// ---------- Sprachbefehle (ohne Claude) ----------
export function quickCommand(text) {
  const t = String(text || "").trim().replace(/^(hey |hallo |ok )?friday[ ,.]*/i, "").replace(/[!?.]+$/g, "").trim();
  const k = t.toLowerCase();
  let m;
  if ((m = t.match(/^merk (?:dir|dir mal) (?:für|fuer|zum|zu(?:m)?|beim) (?:das |dem |mein(?:em)? )?projekt ([\p{L}\d -]{2,40}?)\s*[:,]\s*(.{3,})$/iu))) {
    const p = projektNotiz(m[1], m[2]);
    return p.error ? { answer: p.error, actions: [] } : { answer: `Notiert im Projekt ${p.name}. ${p.notizen.length === 1 ? "Das ist die erste Notiz." : `Das sind jetzt ${p.notizen.length} Notizen.`}`, actions: ["cockpit:gedaechtnis"] };
  }
  if ((m = t.match(/^merk (?:dir|dir mal) (?:für heute|fuer heute|kurz|bis morgen|für die nächsten tage)\s*[:,]?\s*(.{3,})$/iu))) {
    const e = kurzMerken(m[1], { stunden: /heute/i.test(t) ? 24 : 48 });
    return e.error ? { answer: e.error, actions: [] } : { answer: `Gemerkt, aber nur kurz: bis ${new Date(e.bis).toLocaleString("de-DE", { weekday: "long", hour: "2-digit", minute: "2-digit" })}.`, actions: ["cockpit:gedaechtnis"] };
  }
  if ((m = t.match(/^(?:neues projekt|leg(?:e)? (?:ein )?(?:neues )?projekt an|starte (?:ein )?(?:neues )?projekt|ich arbeite (?:jetzt )?an (?:dem |meinem )?projekt|aktives projekt(?: ist)?)[: ]+([\p{L}\d -]{2,40})$/iu))) {
    const p = projektAnlegen(m[1]);
    return p.error ? { answer: p.error, actions: [] } : { answer: `Projekt ${p.name} ist jetzt aktiv. Alles, was du mir dazu sagst, merke ich mir im Projektgedächtnis.`, actions: ["cockpit:gedaechtnis"] };
  }
  if (/^(welche|was für) projekte (gibt es|habe ich|hast du)|^(zeig|zeige)( mir)? (meine |alle )?projekte$/.test(k)) {
    const l = projekte();
    return { answer: l.length ? `Du hast ${l.length} Projekt${l.length === 1 ? "" : "e"}: ${l.map((p) => `${p.name}${p.aktiv ? " (aktiv)" : ""}${p.status === "fertig" ? " (fertig)" : ""}`).join(", ")}.` : "Noch keine Projekte. Sag zum Beispiel: Neues Projekt Garage.", actions: ["cockpit:gedaechtnis"] };
  }
  if ((m = t.match(/^(?:was weißt du über|was weisst du ueber|was weißt du zu|zeig(?:e)?(?: mir)?) (?:das |mein )?projekt ([\p{L}\d -]{2,40})$/iu))) {
    const p = projektFinden(m[1]);
    if (!p) return { answer: `Ein Projekt ${m[1]} kenne ich nicht.`, actions: [] };
    return { answer: p.notizen.length ? `Zum Projekt ${p.name} weiß ich: ${p.notizen.slice(-6).map((n) => n.text).join(". ")}.` : `Zum Projekt ${p.name} habe ich noch keine Notizen.`, actions: ["cockpit:gedaechtnis"] };
  }
  if ((m = t.match(/^projekt ([\p{L}\d -]{2,40}?) (?:ist )?(?:fertig|abgeschlossen|erledigt)$/iu))) {
    const p = projektFinden(m[1]);
    if (!p) return { answer: `Ein Projekt ${m[1]} kenne ich nicht.`, actions: [] };
    projektSetzen(p.id, { status: "fertig", aktiv: false });
    return { answer: `Glückwunsch! Projekt ${p.name} ist abgeschlossen. Die Notizen bleiben im Gedächtnis.`, actions: ["cockpit:gedaechtnis"] };
  }
  if (/^(was hast du (dir )?(zuletzt|neu|heute) gemerkt|gedächtnis-?monitor|zeig( mir)? (dein |das )?gedächtnis)$/.test(k)) {
    const mo = monitor();
    return { answer: `Im Gedächtnis: ${mo.zaehl.lang} Langzeit-Fakten, ${mo.zaehl.kurz} Kurzzeit-Einträge und ${mo.zaehl.projekt} Projekt-Notizen. Zuletzt: ${mo.neu.slice(0, 3).map((x) => x.text).join("; ") || "noch nichts"}.`, actions: ["cockpit:gedaechtnis"] };
  }
  return null;
}
