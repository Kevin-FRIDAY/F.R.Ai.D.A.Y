// Carlas Lernecke: Friday recherchiert und denkt mit (v1.140.0, zuerst nur in Eve).
// 1) Fragt Carla „Was sind Verben?“, schaut Friday auf ihren Karten, in ihrer Themen-Vorbereitung und
//    bei Wikipedia nach und erklärt es einfach, mit Beispielen. Mit Guthaben formuliert Claude die Erklärung
//    aus diesem Stoff, ohne Guthaben liest Friday die wichtigsten Sätze von Wikipedia vor.
// 2) Themen-Vorbereitung: Zu jedem Lernthema (z. B. „Farben“) sammelt Friday vorab, was es dazu gibt
//    (Hauptartikel, Abschnitte, verwandte Themen, wichtige Begriffe), damit sie vorbereitet ist und helfen kann.
//    Kostenlos (Wikipedia). Läuft automatisch, sobald ein neuer Stapel gespeichert wird.
// In Friday ist beides gesperrt, bis Kevin es in Eve freigibt (server/eve-funktionen.json).
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { IST_EVE } from "./config.js";
import { istFrei } from "./eve.js";
import { denke } from "./denker.js";
import { alleStapel, stichworte, norm } from "./lernen.js";
import * as wissen from "./lernwissen.js";

export const FUNKTION_RECHERCHE = "lernecke-recherche";
export const FUNKTION_KARTEN = "lernecke-eigene-karten";
export const rechercheFrei = () => IST_EVE || istFrei(FUNKTION_RECHERCHE);

const DATEI = "lernen-vorbereitung";
const MAX_THEMEN = 40;
const FRISCH_MS = 7 * 24 * 3600 * 1000;
const kurz = (s, n) => String(s ?? "").slice(0, n);
const sauber = (s) => String(s || "").replace(/\s+/g, " ").trim();
const laden = () => { const d = store.load(DATEI, { themen: [] }); return { themen: Array.isArray(d.themen) ? d.themen : [] }; };
const speichern = (d) => store.save(DATEI, d);
const slug = (t) => norm(t).replace(/\s+/g, "-").slice(0, 60) || "thema";

// ---------- Was will Carla wissen? ----------
const FRAGE_ANFANG = [
  /^(?:hey |hallo |ok )?(?:friday|freitag)[ ,.]*/i,
  /^(?:sag|erklär|erklaer|erkläre|erklaere)\s+(?:mir\s+)?(?:bitte\s+)?(?:mal\s+)?(?:noch\s+mal\s+)?(?:was\s+)?/i,
  /^(?:kannst du mir|könntest du mir|koenntest du mir)\s+(?:bitte\s+)?(?:mal\s+)?(?:sagen|erklären|erklaeren)\s*,?\s*(?:was\s+)?/i,
  /^(?:ich\s+(?:weiß|weiss)\s+nicht|ich\s+verstehe\s+nicht)\s*,?\s*(?:was\s+)?/i,
  /^was\s+(?:genau\s+)?(?:versteht man unter|bedeutet|heißt|heisst|meint man mit|ist denn|sind denn|ist eigentlich|sind eigentlich|ist ein|ist eine|sind|ist|war|waren)\s+/i,
  /^wer\s+(?:war|ist|waren|sind)\s+/i,
  /^(?:wie|warum|wieso|weshalb|wozu|wo|wann)\s+/i,
  /^(?:mehr\s+)?(?:infos?|informationen|alles)\s+(?:über|ueber|zu|zum|zur)\s+/i,
  /^(?:was\s+(?:gibt\s+es|weißt\s+du|weisst\s+du)\s+(?:über|ueber|zu|alles\s+über|alles\s+ueber))\s+/i,
];
/** Aus „Was sind Verben?“ wird „Verben“. */
export function themaAusFrage(text) {
  let t = sauber(text).replace(/[?!.。]+$/g, "");
  for (let runde = 0; runde < 3; runde++) for (const re of FRAGE_ANFANG) t = t.replace(re, "");
  t = t.replace(/^(?:der|die|das|ein|eine|einen|dem|den)\s+/i, "")
    .replace(/^(?:wort|begriff|fremdwort)\s+/i, "")
    .replace(/^(?:viele|viel|groß|gross|alt|lang|hoch|weit)\s+/i, "")
    .replace(/\s+(?:gibt es|es gibt|funktioniert das|funktioniert|macht man das|geht das)$/i, "")
    .replace(/\s+(?:eigentlich|genau|nochmal|noch mal|bitte|denn|überhaupt|ueberhaupt|so)$/i, "")
    .replace(/\s+(?:ist|sind|bedeutet|heißt|heisst)$/i, "")
    .trim();
  return kurz(t, 80);
}
/** Klingt das wie eine Wissensfrage (und nicht wie „frag mich ab“)? */
export function istWissensfrage(text) {
  const t = sauber(text).toLowerCase();
  if (!t || /\b(frag mich|abfragen|abfrage|scann|lernplan|archiv)\b/.test(t)) return false;
  return /^(?:(?:hey |ok )?(?:friday|freitag)[ ,.]*)?(?:was (?:ist|sind|war|waren|bedeutet|heißt|heisst|versteht|meint|gibt es)|wer (?:war|ist|waren|sind)|wie |warum |wieso |weshalb |wozu |erklär|erklaer|sag mir was|kannst du mir (?:sagen|erklären|erklaeren)|ich (?:weiß|weiss|verstehe) nicht)/.test(t)
    || /\?\s*$/.test(t);
}

// ---------- Was steht auf Carlas Karten? ----------
function kartenTreffer(thema, { stapel } = {}) {
  const sw = stichworte(thema).map((x) => x.s).filter((s) => s.length >= 3);
  if (!sw.length) return [];
  const treffer = [];
  for (const s of alleStapel()) {
    for (const k of s.karten || []) {
      const fr = stichworte(k.frage).map((x) => x.s), an = stichworte(k.antwort).map((x) => x.s);
      const passt = (liste) => sw.filter((w) => liste.some((x) => x === w || (w.length >= 5 && (x.startsWith(w) || w.startsWith(x))))).length;
      const punkte = passt(fr) * 3 + passt(an) + (stapel && s.id === stapel ? 1 : 0);
      if (punkte >= Math.max(2, sw.length)) treffer.push({ punkte, stapel: s.id, stapelTitel: s.titel, id: k.id, frage: k.frage, antwort: kurz(k.antwort, 600) });
    }
  }
  const gesehen = new Set();
  return treffer.sort((a, b) => b.punkte - a.punkte)
    .filter((k) => { const key = norm(`${k.frage}|${k.antwort}`); if (gesehen.has(key)) return false; gesehen.add(key); return true; })
    .slice(0, 4).map(({ punkte, ...k }) => k);
}

// ---------- Themen-Vorbereitung ----------
const ALLGEMEIN = /^(lernkarten vom|neuer stapel|karten|stapel|test|übung|uebung|arbeitsblatt)/i;
/** Worum geht es in einem Stapel? Fach oder Titel, sonst die häufigsten Wörter auf den Karten. */
export function themaVonStapel(s) {
  if (!s) return "";
  const titel = sauber(s.titel).replace(/^arbeitsblatt:\s*/i, "");
  if (titel && !ALLGEMEIN.test(titel)) return kurz(titel, 80);
  if (sauber(s.fach)) return kurz(sauber(s.fach), 80);
  const zahl = new Map();
  for (const k of s.karten || []) for (const { w, s: st } of stichworte(k.frage)) { if (w.length < 4) continue; const z = zahl.get(st) || { w, n: 0 }; z.n++; zahl.set(st, z); }
  const top = [...zahl.values()].sort((a, b) => b.n - a.n)[0];
  return top ? top.w.charAt(0).toUpperCase() + top.w.slice(1) : "";
}
const zusammen = (w) => ({ titel: w.titel, zusammenfassung: w.zusammenfassung, link: w.link, bild: w.bild || "" });
/** Wichtige Begriffe aus dem gesammelten Stoff (fett gedruckte Wikipedia-Abschnitte + häufige Hauptwörter). */
function begriffeAus(haupt, verwandt) {
  const zahl = new Map();
  const text = [haupt.einleitung, ...(haupt.abschnitte || []).map((a) => `${a.titel} ${a.text}`), ...verwandt.map((v) => v.zusammenfassung)].join(" ");
  for (const m of text.match(/\b[A-ZÄÖÜ][a-zäöüß]{4,}(?:-[A-ZÄÖÜ]?[a-zäöüß]+)?\b/g) || []) {
    const k = m.toLowerCase();
    if (/^(diese|dieser|dieses|jahr|jahre|jahren|beispiel|beispiele|teil|form|formen|art|arten|zeit|seite|weise|bezeichnung|begriff|sprache|wikipedia)$/.test(k)) continue;
    zahl.set(k, { w: m, n: (zahl.get(k)?.n || 0) + 1 });
  }
  const titel = norm(haupt.titel);
  return [...zahl.values()].filter((x) => norm(x.w) !== titel && x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 14).map((x) => x.w);
}
const laufend = new Map();
/**
 * Friday bereitet sich auf ein Lernthema vor: Hauptartikel, Abschnitte, verwandte Themen und Begriffe.
 * thema = frei eingegeben, stapel = Stapel-ID (Thema wird daraus erkannt). auto = nur wenn noch nichts Frisches da ist.
 */
export async function vorbereiten({ thema, stapel, auto = false } = {}) {
  const s = stapel ? alleStapel().find((x) => x.id === stapel) : null;
  const was = kurz(sauber(thema) || themaVonStapel(s), 80);
  if (!was) { const e = new Error("Sag mir, welches Thema du gerade lernst, z. B. „Farben“ oder „Verben“."); e.status = 400; throw e; }
  const id = slug(was);
  const alt = laden().themen.find((t) => t.id === id);
  if (auto && alt && Date.now() - Date.parse(alt.at) < FRISCH_MS) return { ...alt, schonDa: true };
  if (laufend.has(id)) return laufend.get(id);
  const arbeit = (async () => {
    const haupt = await wissen.webSuchen({ q: was });
    // Verwandte Themen: weitere Treffer der Suche + häufige Begriffe auf Carlas Karten.
    const kandidaten = [...(haupt.weitere || []).map((x) => x.titel)];
    for (const k of (s?.karten || []).slice(0, 30)) { const f = themaAusFrage(k.frage); if (f && f.length <= 40 && !kandidaten.includes(f)) kandidaten.push(f); }
    const verwandt = [];
    for (const titel of kandidaten.slice(0, 8)) {
      if (verwandt.length >= 5) break;
      try {
        const v = titel === haupt.titel ? null : await wissen.webSuchen({ q: titel });
        if (v && v.titel !== haupt.titel && !verwandt.some((x) => x.titel === v.titel)) verwandt.push(zusammen(v));
      } catch { /* nicht gefunden: egal */ }
    }
    const fakten = wissen.saetze(haupt.einleitung).slice(0, 6).concat((haupt.abschnitte || []).map((a) => `${a.titel}: ${wissen.saetze(a.text)[0] || ""}`)).filter((x) => x.length > 12).slice(0, 14);
    const eintrag = {
      id, thema: was, stapel: s?.id || alt?.stapel || null, stapelTitel: s?.titel || alt?.stapelTitel || null,
      at: new Date().toISOString(),
      haupt: { ...zusammen(haupt), einleitung: kurz(haupt.einleitung, 3000), abschnitte: haupt.abschnitte || [] },
      verwandt, fakten, begriffe: begriffeAus(haupt, verwandt), quelle: haupt.quelle,
    };
    const d = laden();
    d.themen = [eintrag, ...d.themen.filter((t) => t.id !== id)].slice(0, MAX_THEMEN);
    speichern(d);
    logbuch.eintragen({ bereich: "lernen", titel: `Lernecke: auf das Thema „${was}“ vorbereitet (${fakten.length} Fakten, ${verwandt.length} verwandte Themen)` });
    return eintrag;
  })();
  laufend.set(id, arbeit);
  try { return await arbeit; } finally { laufend.delete(id); }
}
export const vorbereitungen = () => laden().themen.map(({ haupt, ...t }) => ({ ...t, titel: haupt?.titel, bild: haupt?.bild, link: haupt?.link, zusammenfassung: haupt?.zusammenfassung, einleitung: haupt?.einleitung || "", abschnitte: haupt?.abschnitte || [] }));
export function vorbereitungLoeschen(id) {
  const d = laden();
  const vorher = d.themen.length;
  d.themen = d.themen.filter((t) => t.id !== id);
  speichern(d);
  return d.themen.length < vorher;
}
/** Passt eine Vorbereitung zur Frage? (Thema oder Begriff kommt in der Frage vor.) */
function vorbereitungZu(thema, stapel) {
  const n = norm(thema), sw = stichworte(thema).map((x) => x.s);
  const themen = laden().themen;
  return themen.find((t) => norm(t.thema) === n || norm(t.haupt?.titel) === n)
    || themen.find((t) => sw.some((w) => w.length >= 4 && (norm(t.thema).includes(w) || norm(t.haupt?.titel).includes(w))))
    || themen.find((t) => stichworte(t.thema).some(({ s }) => s.length >= 4 && n.includes(s)))
    || (stapel ? themen.find((t) => t.stapel === stapel) : null) || null;
}

// ---------- Carla fragt etwas ----------
const ERKLAER_SYSTEM = `Du bist Friday und hilfst Carla beim Lernen. Sie hat eine Frage gestellt. Erkläre auf Deutsch, einfach und freundlich, so dass man es sich gut merken kann:
- zuerst in 1–2 Sätzen, was es ist,
- dann 2–3 kurze Beispiele aus dem Alltag (bei Wörtern/Grammatik: Beispielwörter und ein Beispielsatz),
- zum Schluss eine kleine Eselsbrücke oder ein Merksatz.
Höchstens 8 kurze Sätze. Kein Markdown, keine Aufzählungszeichen, der Text wird vorgelesen.
Halte dich an den mitgegebenen Stoff (Carlas Karten haben Vorrang, dann die Recherche). Erfinde keine Fakten. Wenn ihre Karten etwas dazu sagen, erwähne das („Auf deiner Karte steht …“).`;
/**
 * Carla fragt z. B. „Was sind Verben?“. Friday recherchiert (Karten → Vorbereitung → Wikipedia)
 * und erklärt es einfach. Mit Guthaben formuliert Claude, sonst die wichtigsten Sätze von Wikipedia.
 */
export async function frage({ text, stapel, karte } = {}) {
  const roh = kurz(sauber(text), 400);
  if (!roh) { const e = new Error("Was möchtest du wissen?"); e.status = 400; throw e; }
  const thema = themaAusFrage(roh) || roh;
  const karten = kartenTreffer(thema, { stapel });
  const kontextKarte = karte && stapel ? alleStapel().find((s) => s.id === stapel)?.karten.find((k) => k.id === karte) : null;
  const vorb = vorbereitungZu(thema, stapel);
  let web = null, webFehler = "";
  try { web = await wissen.webSuchen({ q: thema }); } catch (err) { webFehler = err.message; }
  // Nimmt Wikipedia etwas ganz anderes, hilft die Vorbereitung weiter.
  const stoff = [
    kontextKarte ? `Die Karte, die Carla gerade ansieht:\n${kontextKarte.frage}: ${String(kontextKarte.antwort || "").replace(/\n/g, "; ")}` : "",
    karten.length ? `Carlas eigene Lernkarten dazu:\n${karten.map((k) => `- ${k.frage}: ${String(k.antwort).replace(/\n/g, "; ")}`).join("\n")}` : "",
    vorb ? `Friday hat sich auf das Thema „${vorb.thema}“ vorbereitet:\n${(vorb.fakten || []).slice(0, 10).join("\n")}` : "",
    web ? `Wikipedia „${web.titel}“:\n${kurz(web.einleitung, 2500)}\n${(web.abschnitte || []).slice(0, 5).map((a) => `${a.titel}: ${a.text}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  if (!stoff) {
    const e = new Error(webFehler || `Zu „${thema}“ habe ich leider nichts gefunden. Sag es bitte etwas anders.`);
    e.status = 404; throw e;
  }
  let antwort = "", quelle = "", model = null, kiHinweis = "";
  const r = await denke({ stufe: "leicht", quelle: "lernen", maxTokens: 900, system: ERKLAER_SYSTEM, text: `Carlas Frage: ${roh}\n\nStoff:\n${stoff}` });
  if (r.ok && r.text) { antwort = r.text.replace(/[*#_`]/g, "").trim(); quelle = "ki"; model = r.model; }
  else {
    kiHinweis = r.leer ? "Ohne Guthaben: Ich lese dir das Wichtigste aus Wikipedia vor." : "";
    const teile = [];
    if (web) teile.push(...wissen.saetze(web.zusammenfassung || web.einleitung).slice(0, 3));
    else if (vorb) teile.push(...(vorb.fakten || []).slice(0, 3));
    if (karten[0]) teile.push(`Auf deiner Karte „${karten[0].frage}“ steht: ${String(karten[0].antwort).split("\n").slice(0, 3).join(", ")}.`);
    antwort = teile.join(" ");
    quelle = web ? "wikipedia" : vorb ? "vorbereitung" : "karten";
  }
  logbuch.eintragen({ bereich: "lernen", titel: `Lernecke: Carla fragte „${kurz(roh, 80)}“ – nachgeschaut (${quelle === "ki" ? "mit KI" : quelle})` });
  return {
    frage: roh, thema, antwort: kurz(antwort, 2500), quelle, model, kiHinweis,
    karten,
    wissen: web ? { titel: web.titel, link: web.link, bild: web.bild, zusammenfassung: web.zusammenfassung, quelle: web.quelle } : null,
    vorbereitung: vorb ? { id: vorb.id, thema: vorb.thema } : null,
  };
}

// ---------- Routen ----------
export function rechercheRouten(app, asyncRoute) {
  const gesperrt = (res) => { if (rechercheFrei()) return false; res.status(423).json({ error: "„Friday recherchiert“ ist noch im Test. Probier es in Eve aus und gib es dort frei." }); return true; };
  const fehler = (res, err, code = 502) => res.status(err.status || code).json({ error: err.message || String(err) });
  app.post("/api/lernen/frage", asyncRoute(async (req, res) => {
    if (gesperrt(res)) return;
    const b = req.body || {};
    try { res.json(await frage({ text: b.text, stapel: typeof b.stapel === "string" ? b.stapel : null, karte: typeof b.karte === "string" ? b.karte : null })); } catch (err) { fehler(res, err); }
  }));
  app.get("/api/lernen/vorbereitung", (req, res) => { if (gesperrt(res)) return; res.json({ themen: vorbereitungen() }); });
  app.post("/api/lernen/vorbereitung", asyncRoute(async (req, res) => {
    if (gesperrt(res)) return;
    const b = req.body || {};
    try { res.json(await vorbereiten({ thema: b.thema, stapel: typeof b.stapel === "string" ? b.stapel : null, auto: b.auto === true })); } catch (err) { fehler(res, err); }
  }));
  app.delete("/api/lernen/vorbereitung/:id", (req, res) => { if (gesperrt(res)) return; res.json({ ok: vorbereitungLoeschen(String(req.params.id)) }); });
}
