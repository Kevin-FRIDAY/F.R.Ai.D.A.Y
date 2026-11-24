// Eigene Nachrichtenquellen (v1.160.0, Wunsch aus der Ideen-Schmiede).
// Lieblings-Seiten als RSS/Atom-Feed eintragen, Friday liest die Schlagzeilen vor:
// "Friday, was gibt's Neues bei Heise?" oder "Friday, lies mir meine Nachrichten vor".
// Kostenlos, ohne Schlüssel. Feeds liegen in data/feeds.json.
import * as store from "./store.js";
import { U } from "./datum.js";
import { holen, neueId, sauber } from "./wunsch-hilfe.js";

const DATEI = "feeds";
export const VORSCHLAEGE = [
  { name: "Tagesschau", url: "https://www.tagesschau.de/index~rss2.xml", thema: "Nachrichten" },
  { name: "Heise", url: "https://www.heise.de/rss/heise-atom.xml", thema: "Technik" },
  { name: "Kicker", url: "https://newsfeed.kicker.de/news/aktuell", thema: "Sport" },
  { name: "Spiegel", url: "https://www.spiegel.de/schlagzeilen/index.rss", thema: "Nachrichten" },
  { name: "t3n", url: "https://t3n.de/rss.xml", thema: "Digitales" },
  { name: "Golem", url: "https://rss.golem.de/rss.php?feed=RSS2.0", thema: "Technik" },
  { name: "Chip", url: "https://www.chip.de/rss/rss_topnews.xml", thema: "Technik" },
  { name: "Sportschau", url: "https://www.sportschau.de/index~rss2.xml", thema: "Sport" },
];

export function liste() {
  const d = store.load(DATEI, null);
  if (d?.feeds) return d.feeds;
  return VORSCHLAEGE.slice(0, 3).map((v) => ({ id: v.name.toLowerCase(), ...v }));
}
function speichern(feeds) { store.save(DATEI, { feeds: feeds.slice(0, 40) }); }

export function dazu({ name, url, thema = "" } = {}) {
  const u = String(url || "").trim();
  if (!/^https?:\/\/[^\s]+$/i.test(u)) throw new Error("Bitte eine Feed-Adresse mit https:// eintragen.");
  const n = String(name || "").trim().slice(0, 40) || new URL(u).hostname.replace(/^www\./, "");
  const feeds = liste().filter((f) => f.url !== u && f.name.toLowerCase() !== n.toLowerCase());
  const e = { id: neueId(), name: n, url: u, thema: String(thema).slice(0, 30) };
  feeds.push(e);
  speichern(feeds);
  return e;
}
export function weg(id) { speichern(liste().filter((f) => f.id !== id)); return true; }

// ---------- RSS/Atom lesen (ohne Bibliothek) ----------
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function entschluesseln(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ").trim();
}
const feld = (block, name) => { const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i")); return m ? entschluesseln(m[1]) : ""; };
export function parse(xml) {
  const s = String(xml || "");
  const bloecke = s.match(/<item[\s>][\s\S]*?<\/item>/gi) || s.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return bloecke.map((b) => {
    let link = feld(b, "link");
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); link = m ? m[1] : ""; }
    const datum = feld(b, "pubDate") || feld(b, "updated") || feld(b, "published") || feld(b, "dc:date");
    const t = Date.parse(datum);
    return { titel: feld(b, "title"), link, text: (feld(b, "description") || feld(b, "summary") || feld(b, "content")).slice(0, 280), at: Number.isFinite(t) ? new Date(t).toISOString() : null };
  }).filter((x) => x.titel);
}

const cache = new Map();
export async function lesen(feed) {
  const alt = cache.get(feed.url);
  if (alt && Date.now() - alt.zeit < 10 * 60 * 1000) return alt.daten;
  const xml = await holen(feed.url, { json: false, timeout: 10000, headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5" } });
  const daten = { ...feed, artikel: parse(xml).slice(0, 15), stand: new Date().toISOString() };
  cache.set(feed.url, { zeit: Date.now(), daten });
  return daten;
}
export async function alle() {
  const ergebnisse = await Promise.all(liste().map((f) => lesen(f).catch((err) => ({ ...f, artikel: [], fehler: err.message }))));
  return ergebnisse;
}

export function vorlesen(f, anzahl = 3) {
  if (f.fehler) return `${f.name} antwortet gerade nicht.`;
  if (!f.artikel.length) return `Bei ${f.name} steht gerade nichts Neues.`;
  return `Neu bei ${f.name}: ${f.artikel.slice(0, anzahl).map((a) => a.titel.replace(/[.!?]+$/, "")).join(". ")}.`;
}

const NEU_BEI = U(/\b(?:was gibt(?:'| e)?s|was gibt es) (?:neues|neu) (?:bei|auf|von|im|in der) (.+)$/);
const MEINE = U(/\b(lies|les|sag) (mir )?(meine|die) (nachrichten|schlagzeilen|feeds|news)( vor)?\b|\bmeine (nachrichten|feeds|schlagzeilen)\b/);
export async function quickCommand(text) {
  const { k } = sauber(text);
  const m = k.match(NEU_BEI);
  if (m) {
    const name = m[1].trim();
    const f = liste().find((x) => name.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(name));
    if (!f) return null; // unbekannte Quelle: normale Nachrichten-Suche übernimmt
    try { return { answer: vorlesen(await lesen(f)), actions: [`wunsch:feeds`] }; } catch (err) { return { answer: `${f.name} antwortet gerade nicht (${err.message}).`, actions: ["wunsch:feeds"] }; }
  }
  if (MEINE.test(k)) {
    const alleF = await alle();
    const saetze = alleF.slice(0, 4).map((f) => vorlesen(f, 2));
    return { answer: saetze.join(" "), actions: ["wunsch:feeds"] };
  }
  return null;
}
