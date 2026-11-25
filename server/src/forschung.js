// Fridays Forschungs-Zentrale (v1.187.0, Mark XVI).
//
//  📡 Radar            Technik-, Forschungs- und Wirtschafts-Themen. Jede Nacht zählt Friday, wie viele Nachrichten
//                      (Google News) und neue Studien (arXiv) es pro Thema gab, und merkt sich die neuesten Titel.
//  📈 Trends           Aus diesen Tageswerten und aus den Themen des Weltgeschehens: was steigt über Wochen,
//                      was fällt, was ist neu. Ehrlich: Erst ab 8 gesammelten Tagen gibt es eine Aussage.
//  🔬 Studien-Suche    arXiv (Vorabdrucke, nicht begutachtet) + Crossref (Fachzeitschriften), kostenlos, ohne Schlüssel.
//  🗂 Forschungsdatenbank  Gemerkte Studien mit Notiz + die Dossiers der Tiefen-Recherche, gemeinsam durchsuchbar.
//  ⚖️ Technologie-Vergleich  2–4 Begriffe: Studien im letzten Jahr, Wachstum zum Vorjahr, Nachrichten, Wikipedia-Satz.
//  🚨 Krisen-Frühwarnung  Bündelt Welt-Alarm (GDACS), Unwetter am Wohnort, starke Erdbeben, auffällige Länder und
//                      Wirtschafts-Ausschläge zu einer Stufe. Mitteilung nur als Text und nur, wenn es ernster wird.
//
// Nur öffentliche Quellen. Kein Claude, keine Kosten. Gespeichert in server/data/forschung.json.
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";

const NAME = "forschung";
const UA = { "User-Agent": "Mozilla/5.0 F.R.Ai.D.A.Y (privater Assistent)" };
// Für Tests: Probe-Server statt der echten Quellen.
const ARXIV = () => process.env.FRIDAY_TEST_ARXIV || "https://export.arxiv.org";
const CROSSREF = () => process.env.FRIDAY_TEST_CROSSREF || "https://api.crossref.org";
const NEWS = () => process.env.FRIDAY_TEST_NEWS || "https://news.google.com";
const WIKI = () => process.env.FRIDAY_TEST_WIKI || "https://de.wikipedia.org";

export const STANDARD_THEMEN = [
  { id: "ki", name: "Künstliche Intelligenz", art: "technik", de: "Künstliche Intelligenz", en: "large language models" },
  { id: "robotik", name: "Robotik", art: "technik", de: "Robotik", en: "humanoid robot" },
  { id: "batterie", name: "Batterien", art: "technik", de: "Batterie Forschung", en: "solid-state battery" },
  { id: "quanten", name: "Quantencomputer", art: "forschung", de: "Quantencomputer", en: "quantum computing" },
  { id: "fusion", name: "Kernfusion", art: "forschung", de: "Kernfusion", en: "nuclear fusion" },
  { id: "medizin", name: "Medizin-Durchbrüche", art: "forschung", de: "Medizin Durchbruch Studie", en: "clinical trial breakthrough" },
  { id: "inflation", name: "Inflation", art: "wirtschaft", de: "Inflation Deutschland", en: "" },
  { id: "zinsen", name: "Leitzins", art: "wirtschaft", de: "Leitzins EZB", en: "" },
  { id: "arbeit", name: "Arbeitsmarkt", art: "wirtschaft", de: "Arbeitsmarkt Deutschland", en: "" },
];
const ARTEN = { technik: "⚙️ Technik", forschung: "🔬 Forschung", wirtschaft: "💶 Wirtschaft" };

const lade = () => ({ themen: null, tage: {}, neu: {}, welt: {}, studien: [], vergleiche: [], warnung: null, letzteMeldung: null, radarStand: null, ...store.load(NAME, {}) });
const sichere = (d) => store.save(NAME, d);
const themen = (d = lade()) => d.themen || STANDARD_THEMEN;
const heute = (versatz = 0) => { const d = new Date(Date.now() + versatz * 864e5); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const kurz = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const dekodiere = (s) => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const normTitel = (t) => String(t || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

async function hole(url, ms = 15000) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${new URL(url).host}: ${r.status}`);
  return r;
}

// arXiv bittet um höchstens eine Anfrage alle 3 Sekunden. Alle arXiv-Abrufe laufen darum hintereinander.
let arxivKette = Promise.resolve();
let arxivLetzte = 0;
function arxivHole(url) {
  const p = arxivKette.then(async () => {
    const pause = 3100 - (Date.now() - arxivLetzte);
    if (pause > 0 && !process.env.FRIDAY_TEST_ARXIV) await warte(pause);
    arxivLetzte = Date.now();
    return (await hole(url, 20000)).text();
  });
  arxivKette = p.catch(() => {});
  return p;
}
export function arxivParse(xml) {
  const gesamt = Number(String(xml).match(/<opensearch:totalResults[^>]*>(\d+)</)?.[1] || 0);
  const eintraege = [];
  for (const m of String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const get = (tag) => dekodiere(m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] || "");
    const autoren = [...m[1].matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map((a) => dekodiere(a[1]));
    const id = get("id");
    eintraege.push({ titel: get("title"), zusammenfassung: kurz(get("summary"), 500), datum: get("published").slice(0, 10), autoren: autoren.slice(0, 4), mehrAutoren: autoren.length > 4, link: /^https?:\/\/arxiv\.org\//.test(id) ? id.replace(/^http:/, "https:") : "", quelle: "arXiv", art: "Vorabdruck (noch nicht begutachtet)", stufe: 2 });
  }
  return { gesamt, eintraege };
}
const arxivDatum = (d) => d.toISOString().slice(0, 10).replace(/-/g, "") + "0000";
async function arxivSuche(begriff, { max = 8, seitTagen = null, bisTagen = 0 } = {}) {
  let q = `all:"${begriff.replace(/"/g, "")}"`;
  if (seitTagen) q += ` AND submittedDate:[${arxivDatum(new Date(Date.now() - seitTagen * 864e5))} TO ${arxivDatum(new Date(Date.now() - bisTagen * 864e5))}]`;
  return arxivParse(await arxivHole(`${ARXIV()}/api/query?search_query=${encodeURIComponent(q)}&sortBy=submittedDate&sortOrder=descending&start=0&max_results=${max}`));
}
async function crossrefSuche(begriff, max = 8) {
  const r = await (await hole(`${CROSSREF()}/works?query=${encodeURIComponent(begriff)}&rows=${max}&sort=relevance&filter=type:journal-article&select=DOI,title,author,published,container-title,abstract,type`)).json();
  return (r?.message?.items || []).map((x) => ({
    titel: dekodiere((x.title || [])[0] || ""), zusammenfassung: kurz(dekodiere(x.abstract || ""), 500),
    datum: (x.published?.["date-parts"]?.[0] || []).map((n, i) => (i ? String(n).padStart(2, "0") : String(n))).join("-"),
    autoren: (x.author || []).slice(0, 4).map((a) => [a.given, a.family].filter(Boolean).join(" ")), mehrAutoren: (x.author || []).length > 4,
    zeitschrift: dekodiere((x["container-title"] || [])[0] || ""), link: x.DOI ? `https://doi.org/${x.DOI}` : "", quelle: "Crossref", art: "Fachzeitschrift (begutachtet)", stufe: 3,
  })).filter((x) => x.titel);
}
async function newsListe(begriff, tage = 7) {
  const xml = await (await hole(`${NEWS()}/rss/search?q=${encodeURIComponent(`${begriff} when:${tage}d`)}&hl=de&gl=DE&ceid=DE:de`)).text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const get = (tag) => dekodiere(m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] || "");
    const quelle = get("source"), voll = get("title");
    return { titel: quelle && voll.endsWith(` - ${quelle}`) ? voll.slice(0, -quelle.length - 3) : voll, quelle, link: get("link"), datum: get("pubDate") };
  });
}
async function wikiSatz(begriff) {
  const s = await (await hole(`${WIKI()}/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=1&srsearch=${encodeURIComponent(begriff)}`)).json();
  const t = s?.query?.search?.[0]?.title;
  if (!t) return null;
  const sum = await (await hole(`${WIKI()}/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, "_"))}`)).json();
  return { titel: t, satz: kurz(String(sum?.extract || "").split(/(?<=[.!?])\s/)[0], 260), link: sum?.content_urls?.desktop?.page || "" };
}

// ---------- 🔬 Studien-Suche ----------
const letzteSuchen = new Map();
export async function studienSuchen(begriff) {
  const q = kurz(begriff, 120);
  if (q.length < 2) return { error: "Wonach soll ich suchen?" };
  const c = letzteSuchen.get(q.toLowerCase());
  if (c && Date.now() - c.at < 30 * 6e4) return c.r;
  const quellen = [];
  const versuch = async (name, fn) => { try { const r = await fn(); quellen.push({ name, ok: true, anzahl: r.length }); return r; } catch (err) { quellen.push({ name, ok: false, fehler: kurz(err.message, 120) }); return []; } };
  const [ax, cr] = await Promise.all([versuch("arXiv", async () => (await arxivSuche(q)).eintraege), versuch("Crossref", () => crossrefSuche(q))]);
  const gesehen = new Set();
  const treffer = [...cr, ...ax].filter((x) => { const k = normTitel(x.titel).slice(0, 80); if (!k || gesehen.has(k)) return false; gesehen.add(k); return true; })
    .sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  const r = { begriff: q, treffer, quellen, stand: new Date().toISOString(), hinweis: quellen.find((x) => x.name === "arXiv")?.ok && ax.length < 3 ? "arXiv findet vor allem englische Begriffe. Für mehr Studien englisch suchen (z. B. „nuclear fusion“)." : "" };
  if (quellen.some((x) => x.ok)) letzteSuchen.set(q.toLowerCase(), { at: Date.now(), r });
  if (letzteSuchen.size > 30) letzteSuchen.delete(letzteSuchen.keys().next().value);
  return r;
}

// ---------- 🗂 Forschungsdatenbank ----------
export function merken(studie = {}, { notiz = "", thema = "" } = {}) {
  const titel = kurz(studie.titel, 300);
  if (!titel) return { error: "Ohne Titel kann ich nichts merken." };
  const d = lade();
  if (d.studien.some((s) => normTitel(s.titel) === normTitel(titel))) return { error: "Diese Studie ist schon in der Datenbank." };
  const link = /^https:\/\//.test(String(studie.link || "")) ? String(studie.link).slice(0, 300) : "";
  const s = { id: neueId(), titel, zusammenfassung: kurz(studie.zusammenfassung, 600), datum: kurz(studie.datum, 10), autoren: (studie.autoren || []).slice(0, 4).map((a) => kurz(a, 60)), zeitschrift: kurz(studie.zeitschrift, 120), quelle: kurz(studie.quelle, 20), art: kurz(studie.art, 60), link, notiz: kurz(notiz, 500), thema: kurz(thema, 60), at: new Date().toISOString() };
  d.studien.unshift(s);
  d.studien = d.studien.slice(0, 500);
  sichere(d);
  eintragen({ bereich: "wissen", titel: `Forschungsdatenbank: ${kurz(titel, 80)}`, quelle: "forschung" });
  return { ok: true, studie: s, text: "In der Forschungsdatenbank gemerkt." };
}
export function studieAendern(id, { notiz, thema } = {}) {
  const d = lade();
  const s = d.studien.find((x) => x.id === id);
  if (!s) return { error: "Nicht gefunden." };
  if (notiz !== undefined) s.notiz = kurz(notiz, 500);
  if (thema !== undefined) s.thema = kurz(thema, 60);
  sichere(d);
  return { ok: true, studie: s };
}
export function studieWeg(id) { const d = lade(); const n = d.studien.length; d.studien = d.studien.filter((x) => x.id !== id); sichere(d); return n === d.studien.length ? { error: "Nicht gefunden." } : { ok: true }; }

/** Durchsucht gemerkte Studien UND die Dossiers der Tiefen-Recherche (kein Doppel: die Dossiers bleiben, wo sie sind). */
export async function datenbank(q = "") {
  const d = lade();
  const woerter = normTitel(q).split(" ").filter((w) => w.length > 1);
  const passt = (text) => !woerter.length || woerter.every((w) => normTitel(text).includes(w));
  const studien = d.studien.filter((s) => passt(`${s.titel} ${s.zusammenfassung} ${s.notiz} ${s.thema} ${s.autoren.join(" ")} ${s.zeitschrift}`));
  let dossiers = [];
  try { dossiers = (await import("./weltintelligenz.js")).recherchen().filter((r) => passt(`${r.thema} ${r.zusammenfassung || ""}`)).slice(0, 30).map((r) => ({ id: r.id, thema: r.thema, at: r.erstellt || r.at, meldungen: r.meldungen, qualitaet: r.qualitaet?.text || r.qualitaet || "" })); } catch { /* ohne Dossiers */ }
  const themenListe = [...new Set(d.studien.map((s) => s.thema).filter(Boolean))].sort();
  return { studien, dossiers, gesamt: d.studien.length, themen: themenListe };
}

// ---------- 📡 Radar + 📈 Trends ----------
let radarLaeuft = null;
export function radarLauf() {
  if (radarLaeuft) return radarLaeuft;
  radarLaeuft = (async () => {
    const d = lade();
    const t = heute();
    const tag = d.tage[t] || {};
    const fehler = [];
    for (const th of themen(d)) {
      const x = tag[th.id] || {};
      try { const n = await newsListe(th.de, 7); x.news = n.length; d.neu[th.id] = { ...(d.neu[th.id] || {}), news: n.slice(0, 4) }; } catch (err) { fehler.push(`${th.name} (Nachrichten): ${kurz(err.message, 80)}`); }
      if (th.en) {
        try { const a = await arxivSuche(th.en, { max: 4, seitTagen: 8, bisTagen: 1 }); x.studien = a.gesamt; d.neu[th.id] = { ...(d.neu[th.id] || {}), studien: a.eintraege.slice(0, 4) }; } catch (err) { fehler.push(`${th.name} (arXiv): ${kurz(err.message, 80)}`); }
      }
      if (Object.keys(x).length) tag[th.id] = x;
    }
    if (Object.keys(tag).length) d.tage[t] = tag;
    // Themen des Weltgeschehens mitschreiben (kommt aus der Weltlage, kein zweiter Abruf).
    try {
      const w = await (await import("./weltintelligenz.js")).weltLage({ merken: false });
      if (w.schlagzeilen > 0) d.welt[t] = Object.fromEntries(w.themen.map((x) => [x.wort, x.anzahl]));
    } catch { /* Weltlage optional */ }
    for (const feld of ["tage", "welt"]) { const k = Object.keys(d[feld]).sort(); for (const alt of k.slice(0, Math.max(0, k.length - 120))) delete d[feld][alt]; }
    d.radarStand = { at: new Date().toISOString(), fehler };
    sichere(d);
    eintragen({ bereich: "wissen", titel: "Forschungs-Radar aktualisiert", details: fehler.length ? `${fehler.length} Quellen nicht erreichbar` : `${themen(d).length} Themen`, ok: fehler.length < themen(d).length, quelle: "forschung" });
    return { ok: true, fehler };
  })().finally(() => { radarLaeuft = null; });
  return radarLaeuft;
}

const mittel = (l) => (l.length ? l.reduce((s, v) => s + v, 0) / l.length : 0);
/** Trend aus Tageswerten: letzte 7 gesammelte Tage gegen die bis zu 21 davor. Erst ab 8 Tagen eine Aussage. */
export function trendAus(werte) {
  const w = werte.filter((v) => Number.isFinite(v));
  if (w.length < 8) return { richtung: "sammelt", tage: w.length, text: `sammelt noch (${w.length} von 8 Tagen)` };
  const neu = mittel(w.slice(-7)), alt = mittel(w.slice(-28, -7));
  const prozent = alt ? Math.round(((neu - alt) / alt) * 100) : neu ? 100 : 0;
  const richtung = prozent >= 25 ? "steigt" : prozent <= -25 ? "faellt" : "gleich";
  return { richtung, prozent, neu: Math.round(neu * 10) / 10, alt: Math.round(alt * 10) / 10, tage: w.length, text: richtung === "gleich" ? "etwa gleich" : `${richtung === "steigt" ? "steigt" : "fällt"} um ${Math.abs(prozent)} %` };
}
export function radar() {
  const d = lade();
  const tage = Object.keys(d.tage).sort();
  const liste = themen(d).map((th) => {
    const news = tage.map((t) => d.tage[t][th.id]?.news).filter((v) => v != null);
    const studien = tage.map((t) => d.tage[t][th.id]?.studien).filter((v) => v != null);
    return { ...th, artName: ARTEN[th.art] || th.art, newsHeute: news.at(-1) ?? null, studienWoche: studien.at(-1) ?? null, trendNews: trendAus(news), trendStudien: th.en ? trendAus(studien) : null, verlauf: tage.slice(-28).map((t) => d.tage[t][th.id]?.news ?? null), neu: d.neu[th.id] || {} };
  });
  // Welt-Themen über Wochen: Summe letzte 7 Tage gegen die 7 davor.
  const wt = Object.keys(d.welt).sort();
  const summe = (ts) => { const m = new Map(); for (const t of ts) for (const [w, n] of Object.entries(d.welt[t])) m.set(w, (m.get(w) || 0) + n); return m; };
  const jetzt = summe(wt.slice(-7)), vorher = summe(wt.slice(-14, -7));
  const weltTrends = wt.length < 8 ? [] : [...jetzt.entries()].map(([wort, n]) => ({ wort, jetzt: n, vorher: vorher.get(wort) || 0 }))
    .filter((x) => x.jetzt >= 5 && x.jetzt >= Math.max(3, x.vorher) * 2).sort((a, b) => b.jetzt / Math.max(1, b.vorher) - a.jetzt / Math.max(1, a.vorher)).slice(0, 10)
    .map((x) => ({ ...x, neu: x.vorher === 0 }));
  return { themen: liste, arten: ARTEN, weltTrends, weltTage: wt.length, tage: tage.length, stand: d.radarStand };
}
export function themaSetzen({ name, de, en = "", art = "technik" } = {}) {
  const d = lade();
  const l = themen(d).slice();
  const n = kurz(name, 40);
  if (n.length < 2 || kurz(de || n, 80).length < 2) return { error: "Name fehlt." };
  if (l.length >= 16) return { error: "Höchstens 16 Themen, damit der Radar nachts schnell bleibt." };
  const id = n.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").slice(0, 24) + "-" + Math.random().toString(36).slice(2, 5);
  l.push({ id, name: n, art: ARTEN[art] ? art : "technik", de: kurz(de || n, 80), en: kurz(en, 80) });
  d.themen = l;
  sichere(d);
  return { ok: true, text: `„${n}“ ist im Radar. Werte gibt es ab dem nächsten Lauf.` };
}
export function themaWeg(id) { const d = lade(); d.themen = themen(d).filter((x) => x.id !== id); sichere(d); return { ok: true }; }

// ---------- ⚖️ Technologie-Vergleich ----------
export async function vergleichen(begriffe = []) {
  const l = [...new Set((Array.isArray(begriffe) ? begriffe : String(begriffe).split(/,| und | vs\.? | gegen /i)).map((b) => kurz(b, 60)).filter((b) => b.length >= 2))].slice(0, 4);
  if (l.length < 2) return { error: "Bitte mindestens zwei Begriffe, z. B. „solid-state battery, sodium-ion battery“." };
  const zeilen = [];
  for (const b of l) {
    const z = { begriff: b, fehler: [] };
    try { z.studienJahr = (await arxivSuche(b, { max: 0, seitTagen: 365 })).gesamt; z.studienVorjahr = (await arxivSuche(b, { max: 0, seitTagen: 730, bisTagen: 365 })).gesamt; z.wachstum = z.studienVorjahr ? Math.round(((z.studienJahr - z.studienVorjahr) / z.studienVorjahr) * 100) : null; } catch (err) { z.fehler.push(`arXiv: ${kurz(err.message, 60)}`); }
    try { z.news = (await newsListe(b, 30)).length; } catch (err) { z.fehler.push(`Nachrichten: ${kurz(err.message, 60)}`); }
    try { z.wiki = await wikiSatz(b); } catch (err) { z.fehler.push(`Wikipedia: ${kurz(err.message, 60)}`); }
    zeilen.push(z);
  }
  const bester = (feld) => { const m = zeilen.filter((z) => Number.isFinite(z[feld])).sort((a, b) => b[feld] - a[feld]); return m.length > 1 && m[0][feld] > m[1][feld] ? m[0] : null; };
  const fazit = [];
  const f = bester("studienJahr"); if (f) fazit.push(`Am meisten Forschung: ${f.begriff} (${f.studienJahr} Studien im letzten Jahr).`);
  const w = bester("wachstum"); if (w && w.wachstum > 0) fazit.push(`Wächst am stärksten: ${w.begriff} (+${w.wachstum} % zum Vorjahr).`);
  const n = bester("news"); if (n) fazit.push(`Am meisten in den Nachrichten: ${n.begriff} (${n.news} Meldungen in 30 Tagen).`);
  if (!fazit.length) fazit.push("Kein klarer Unterschied in den Zahlen.");
  const r = { id: neueId(), at: new Date().toISOString(), zeilen, fazit, hinweis: "Studien zählt arXiv (Vorabdrucke, vor allem englische Begriffe). Nachrichten: höchstens 100 pro Begriff. Das misst Aufmerksamkeit, nicht Qualität." };
  const d = lade(); d.vergleiche.unshift(r); d.vergleiche = d.vergleiche.slice(0, 10); sichere(d);
  return r;
}

// ---------- 🚨 Krisen-Frühwarnung ----------
const STUFEN = [{ ab: 0, id: "ruhig", name: "Ruhig", icon: "🟢" }, { ab: 20, id: "aufmerksam", name: "Aufmerksam", icon: "🟡" }, { ab: 45, id: "angespannt", name: "Angespannt", icon: "🟠" }, { ab: 70, id: "kritisch", name: "Kritisch", icon: "🔴" }];
export const stufeFuer = (p) => STUFEN.filter((s) => p >= s.ab).at(-1);
export async function fruehwarnung({ melden = false } = {}) {
  const gruende = [], quellen = [];
  let punkte = 0;
  const add = (p, icon, text, quelle) => { punkte += p; gruende.push({ punkte: p, icon, text, quelle }); };
  const versuch = async (name, fn) => { try { await fn(); quellen.push({ name, ok: true }); } catch (err) { quellen.push({ name, ok: false, fehler: kurz(err.message, 100) }); } };
  await Promise.all([
    versuch("Unwetter am Wohnort (DWD)", async () => {
      const u = await (await import("./unwetter.js")).warnungen();
      const rang = { minor: 0, moderate: 10, severe: 30, extreme: 45 };
      const top = u.warnungen.slice().sort((a, b) => (rang[b.stufe] || 0) - (rang[a.stufe] || 0))[0];
      if (top && rang[top.stufe]) add(rang[top.stufe], "⛈", `${top.stufeName}: ${top.titel} (${u.ort})`, "DWD");
    }),
    versuch("Welt-Alarm (GDACS)", async () => {
      const a = await (await import("./lagezentrum.js")).getAlarm();
      let p = 0;
      for (const e of a.ereignisse || []) { const x = e.stufe === "Red" ? 20 : e.stufe === "Orange" ? 8 : 0; if (x && p < 35) { p += x; add(x, e.stufe === "Red" ? "🔴" : "🟠", `${e.titel} ${e.name || ""} ${e.laender ? `(${e.laender})` : ""}`.trim(), "GDACS"); } }
    }),
    versuch("Erdbeben (USGS)", async () => {
      const q = (await (await import("./lagezentrum.js")).getQuakes()).filter((x) => x.staerke >= 6.5);
      for (const x of q.slice(0, 2)) add(x.staerke >= 7 ? 10 : 5, "🌋", `Erdbeben Stärke ${x.staerke.toFixed(1)}: ${x.ort}`, "USGS");
    }),
    versuch("Auffällige Länder (Nachrichten)", async () => {
      const w = await (await import("./weltintelligenz.js")).weltLage({ merken: false });
      for (const x of (w.auffaellig || []).slice(0, 5)) add(4, "📰", `${x.land}: ${x.heute} Meldungen statt üblich ${x.ueblich}`, "Weltgeschehen");
    }),
  ]);
  // Wirtschafts-Ausschläge aus dem Radar (keine neue Abfrage).
  for (const th of radar().themen.filter((x) => x.art === "wirtschaft" && x.trendNews.richtung === "steigt" && x.trendNews.prozent >= 60)) add(5, "💶", `${th.name}: Nachrichten +${th.trendNews.prozent} % über Wochen`, "Wirtschafts-Radar");
  punkte = Math.min(100, punkte);
  const s = stufeFuer(punkte);
  const r = { at: new Date().toISOString(), punkte, stufe: s.id, stufeName: s.name, icon: s.icon, gruende: gruende.sort((a, b) => b.punkte - a.punkte), quellen };
  const d = lade();
  d.warnung = r;
  // Mitteilung nur als Text und nur, wenn es ernster wird als bei der letzten Mitteilung (ab „Angespannt“).
  let gemeldet = false;
  const rang = (id) => STUFEN.findIndex((x) => x.id === id);
  if (melden && rang(s.id) >= 2 && (!d.letzteMeldung || rang(s.id) > rang(d.letzteMeldung.stufe))) {
    try { gemeldet = await (await import("./notify.js")).notifyAll(`${s.icon} Frühwarnung: ${s.name}`, r.gruende.slice(0, 3).map((g) => `${g.icon} ${g.text}`).join("\n")); } catch { /* egal */ }
    d.letzteMeldung = { at: r.at, stufe: s.id };
  }
  if (rang(s.id) < 2) d.letzteMeldung = null;
  sichere(d);
  return { ...r, gemeldet };
}

// ---------- Übersicht + Sprache ----------
export async function uebersicht() {
  const d = lade();
  return { radar: radar(), warnung: d.warnung, vergleiche: d.vergleiche, datenbank: { gesamt: d.studien.length } };
}
export function satzRadar(r = radar()) {
  const st = r.themen.filter((t) => t.trendNews.richtung === "steigt").map((t) => `${t.name} (+${t.trendNews.prozent} %)`);
  const neu = r.themen.flatMap((t) => (t.neu.studien || []).slice(0, 1).map((s) => `${t.name}: ${s.titel}`)).slice(0, 2);
  if (!r.tage) return "Der Radar hat noch keine Daten. Er läuft jede Nacht um 5:30 Uhr, oder du startest ihn im Cockpit.";
  return [st.length ? `Steigend: ${st.slice(0, 3).join(", ")}.` : r.tage < 8 ? `Trends gibt es ab 8 Tagen, ich habe ${r.tage}.` : "Kein Thema steigt gerade deutlich.", neu.length ? `Neue Studien: ${neu.join(" · ")}.` : ""].filter(Boolean).join(" ");
}

export async function quickCommand(text) {
  const t = String(text || "").replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/i, "").replace(/[?!.]+$/, "").trim();
  const k = t.toLowerCase();
  let m;
  if (/^(öffne|oeffne|zeig|zeige)( mir)? (die |das |den )?(forschung|forschungs-?zentrale|forschungs-?radar|technik-?radar|technologie-?radar|forschungs-?datenbank)$/.test(k)) return { answer: "Hier ist die Forschungs-Zentrale.", actions: ["cockpit:forschung"] };
  if ((m = t.match(/^(?:such|suche|finde?|zeig)\w*(?: mir)? (?:studien|forschung|paper|fachartikel) (?:zu|über|ueber|zum|zur|für) (.{2,100})$/i)) || (m = t.match(/^was sagt die (?:forschung|wissenschaft) (?:zu|über|ueber|zum|zur) (.{2,100})$/i))) {
    const r = await studienSuchen(m[1]);
    if (r.error) return { answer: r.error };
    if (!r.treffer.length) return { answer: r.quellen.every((q) => !q.ok) ? "Die Studien-Quellen sind gerade nicht erreichbar." : `Zu „${r.begriff}“ habe ich keine Studien gefunden. ${r.hinweis}`.trim(), actions: ["cockpit:forschung"] };
    return { answer: `${r.treffer.length} Studien zu „${r.begriff}“. Die neuesten: ${r.treffer.slice(0, 3).map((x) => `${x.titel} (${x.quelle}, ${String(x.datum).slice(0, 4)})`).join(" · ")}. ${r.hinweis}`.trim(), actions: ["cockpit:forschung"] };
  }
  if (/^(was gibt('?s| es) neues in (der )?(technik|forschung|wissenschaft)|(technik|technologie|forschungs|wirtschafts)-?radar|welche (technik-?)?trends gibt es|trends)$/.test(k)) return { answer: satzRadar(), actions: ["cockpit:forschung"] };
  if ((m = t.match(/^(?:technologie-?vergleich|vergleiche? die technologien?) (.{3,200})$/i))) {
    const r = await vergleichen(m[1]);
    return r.error ? { answer: r.error } : { answer: r.fazit.join(" "), actions: ["cockpit:forschung"] };
  }
  if (/^(krisen-?)?früh-?warnung|^gibt es (gerade )?(eine )?krise|^wie (ist|steht) die krisenlage/.test(k)) {
    const r = await fruehwarnung();
    const aus = r.quellen.filter((q) => !q.ok);
    return { answer: `Frühwarnung: ${r.stufeName} (${r.punkte} von 100).${r.gruende.length ? ` ${r.gruende.slice(0, 3).map((g) => g.text).join(". ")}.` : aus.length ? "" : " Nichts Auffälliges."}${aus.length ? ` Achtung: ${aus.length} von ${r.quellen.length} Quellen waren nicht erreichbar (${aus.map((q) => q.name).join(", ")}), das Bild ist also unvollständig.` : ""}`, actions: ["cockpit:forschung"] };
  }
  return null;
}

export function forschungRouten(app, asyncRoute) {
  app.get("/api/forschung", asyncRoute(async (_req, res) => res.json(await uebersicht())));
  app.post("/api/forschung/radar", asyncRoute(async (_req, res) => { const r = await radarLauf(); res.json({ ...r, radar: radar() }); }));
  app.post("/api/forschung/thema", (req, res) => res.json(themaSetzen(req.body || {})));
  app.delete("/api/forschung/thema/:id", (req, res) => res.json(themaWeg(req.params.id)));
  app.post("/api/forschung/suche", asyncRoute(async (req, res) => res.json(await studienSuchen(String(req.body?.begriff || "")))));
  app.get("/api/forschung/datenbank", asyncRoute(async (req, res) => res.json(await datenbank(String(req.query.q || "")))));
  app.post("/api/forschung/merken", (req, res) => res.json(merken(req.body?.studie || {}, req.body || {})));
  app.post("/api/forschung/studie/:id", (req, res) => res.json(studieAendern(req.params.id, req.body || {})));
  app.delete("/api/forschung/studie/:id", (req, res) => res.json(studieWeg(req.params.id)));
  app.post("/api/forschung/vergleich", asyncRoute(async (req, res) => res.json(await vergleichen(req.body?.begriffe || []))));
  app.post("/api/forschung/fruehwarnung", asyncRoute(async (_req, res) => res.json(await fruehwarnung())));
}

export async function forschungStart() {
  try {
    const hz = await import("./herzschlag.js");
    hz.aufgabeRegistrieren("forschungs-radar", { name: "Forschungs-Radar", text: "Zählt nachts Nachrichten und neue Studien (arXiv) zu deinen Technik-, Forschungs- und Wirtschafts-Themen. Kostenlos, ohne KI.", art: "taeglich", zeit: "05:30", standardAn: true, lauf: async () => { const r = await radarLauf(); return { ok: true, text: r.fehler.length ? `${r.fehler.length} Quellen nicht erreichbar` : "aktualisiert" }; } });
    hz.aufgabeRegistrieren("krisen-fruehwarnung", { name: "Krisen-Frühwarnung", text: "Prüft stündlich Unwetter am Wohnort, Welt-Alarm, starke Erdbeben und auffällige Länder. Mitteilung nur als Text und nur, wenn es ernster wird.", art: "intervall", minuten: 60, standardAn: true, lauf: async () => { const r = await fruehwarnung({ melden: true }); return { ok: true, text: `${r.stufeName} (${r.punkte})${r.gemeldet ? ", gemeldet" : ""}` }; } });
  } catch (err) { console.error("Forschung/Herzschlag:", err.message); }
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "forschung", bereich: "Wissen", name: "Forschungs-Zentrale (Studien-Parser, Trends, Frühwarn-Stufen)", lauf: async () => {
      const probe = `<feed><opensearch:totalResults>42</opensearch:totalResults><entry><id>http://arxiv.org/abs/1234.5678v1</id><published>2026-11-20T00:00:00Z</published><title>Fusion &amp; plasma</title><summary>Test</summary><author><name>A. Forscher</name></author></entry></feed>`;
      const p = arxivParse(probe);
      if (p.gesamt !== 42 || p.eintraege[0]?.titel !== "Fusion & plasma" || p.eintraege[0].link !== "https://arxiv.org/abs/1234.5678v1") return { status: "fehler", text: "arXiv-Antworten werden falsch gelesen." };
      const steigt = trendAus([2, 2, 2, 2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5]);
      if (steigt.richtung !== "steigt" || trendAus([1, 2, 3]).richtung !== "sammelt") return { status: "fehler", text: "Trend-Rechnung stimmt nicht." };
      if (stufeFuer(0).id !== "ruhig" || stufeFuer(50).id !== "angespannt" || stufeFuer(90).id !== "kritisch") return { status: "fehler", text: "Frühwarn-Stufen stimmen nicht." };
      const r = radar();
      return { status: "bestanden", text: `Parser, Trend-Rechnung und Stufen geprüft. Radar: ${r.themen.length} Themen, ${r.tage} Tage gesammelt${r.stand?.fehler?.length ? `, letzter Lauf mit ${r.stand.fehler.length} Quellen-Fehlern` : ""}.` };
    } });
  } catch (err) { console.error("Forschung/Funktionstest:", err.message); }
}
