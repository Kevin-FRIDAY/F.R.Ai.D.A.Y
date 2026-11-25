// Podcasts hören (v1.166.0, Stern-Idee aus der Ideen-Schmiede).
// Suche über das freie Podcast-Verzeichnis von Apple (itunes.apple.com/search, ohne Schlüssel),
// Folgen direkt aus dem RSS-Feed des Podcasts. Abos in data/podcasts.json; alle 3 Stunden schaut Friday
// nach neuen Folgen und meldet sie per Telegram/Push. Abspielen im Dashboard. Ohne Claude.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { IST_EVE } from "./config.js";
import { holen, sauber, datumLang } from "./wunsch-hilfe.js";

const SUCHE = () => String(process.env.PODCAST_SUCHE_API || "https://itunes.apple.com").replace(/\/$/, "");
const DATEI = "podcasts";
const daten = () => ({ abos: [], gehoert: [], ...store.load(DATEI, {}) });
const sichern = (d) => store.save(DATEI, d);
const sicher = (u) => (/^https?:\/\//i.test(String(u || "")) ? String(u) : "");

export async function suchen(q) {
  const term = String(q || "").trim().slice(0, 80);
  if (!term) return [];
  const d = await holen(`${SUCHE()}/search?media=podcast&entity=podcast&country=DE&limit=12&term=${encodeURIComponent(term)}`);
  return (d.results || []).filter((x) => x.feedUrl).map((x) => ({ id: String(x.collectionId), titel: x.collectionName, von: x.artistName || "", feed: sicher(x.feedUrl), bild: sicher(x.artworkUrl600 || x.artworkUrl100), folgen: x.trackCount || 0, genre: x.primaryGenreName || "" }));
}

// ---------- RSS mit Audio-Anhang ----------
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const ent = (s) => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m).replace(/\s+/g, " ").trim();
const feld = (b, n) => { const m = b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i")); return m ? ent(m[1]) : ""; };
export function folgenAus(xml) {
  const s = String(xml || "");
  const kanal = s.split(/<item[\s>]/i)[0];
  const bild = (kanal.match(/<itunes:image[^>]*href="([^"]+)"/i) || [])[1] || feld(kanal.match(/<image>[\s\S]*?<\/image>/i)?.[0] || "", "url");
  const folgen = (s.match(/<item[\s>][\s\S]*?<\/item>/gi) || []).slice(0, 40).map((b) => {
    const enc = b.match(/<enclosure[^>]*url="([^"]+)"/i);
    const t = Date.parse(feld(b, "pubDate"));
    const dauer = feld(b, "itunes:duration");
    return { id: feld(b, "guid") || enc?.[1] || feld(b, "title"), titel: feld(b, "title"), audio: sicher(enc?.[1]?.replace(/&amp;/g, "&")), at: Number.isFinite(t) ? new Date(t).toISOString() : null, dauer: dauerMin(dauer), text: (feld(b, "itunes:summary") || feld(b, "description")).slice(0, 300) };
  }).filter((f) => f.audio);
  return { titel: feld(kanal, "title"), bild: sicher(bild), folgen };
}
function dauerMin(d) {
  if (!d) return null;
  if (/^\d+$/.test(d)) return Math.round(Number(d) / 60);
  const p = d.split(":").map(Number);
  if (p.some((x) => !Number.isFinite(x))) return null;
  return Math.round((p.length === 3 ? p[0] * 60 + p[1] + p[2] / 60 : p[0] + p[1] / 60));
}
const cache = new Map();
export async function folgen(feed, { frisch = false } = {}) {
  const url = sicher(feed);
  if (!url) throw new Error("Feed-Adresse fehlt.");
  const c = cache.get(url);
  if (!frisch && c && Date.now() - c.zeit < 20 * 60 * 1000) return c.daten;
  const daten = folgenAus(await holen(url, { json: false, timeout: 15000 }));
  cache.set(url, { zeit: Date.now(), daten });
  return daten;
}

export const abos = () => daten().abos;
export async function abonnieren(p = {}) {
  const d = daten();
  const feed = sicher(p.feed);
  if (!feed) throw new Error("Feed-Adresse fehlt.");
  if (d.abos.some((a) => a.feed === feed)) return d.abos;
  let letzte = null;
  try { letzte = (await folgen(feed)).folgen[0]?.id || null; } catch { /* trotzdem merken */ }
  d.abos.push({ id: String(p.id || Date.now().toString(36)), titel: String(p.titel || "Podcast").slice(0, 100), von: String(p.von || "").slice(0, 80), feed, bild: sicher(p.bild), letzte });
  sichern(d);
  logbuch.eintragen({ bereich: "podcast", titel: `Podcast abonniert: ${p.titel}` });
  return d.abos;
}
export function abbestellen(id) { const d = daten(); d.abos = d.abos.filter((a) => a.id !== id); sichern(d); return d.abos; }

/** Neueste Folgen aller Abos. */
export async function neueste() {
  const out = [];
  await Promise.all(abos().map(async (a) => {
    try { const f = await folgen(a.feed); out.push(...f.folgen.slice(0, 3).map((x) => ({ ...x, podcast: a.titel, podcastId: a.id, bild: a.bild || f.bild }))); } catch { /* Feed gerade weg */ }
  }));
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20);
}

/** Hintergrund: neue Folgen melden. */
export async function pruefen(melde) {
  if (IST_EVE) return;
  const d = daten();
  let geaendert = false;
  for (const a of d.abos) {
    let f;
    try { f = await folgen(a.feed, { frisch: true }); } catch { continue; }
    const neu = f.folgen[0];
    if (!neu || neu.id === a.letzte) continue;
    const war = a.letzte;
    a.letzte = neu.id;
    geaendert = true;
    if (war) { try { await melde(`🎙 Neue Folge: ${a.titel}`, `${neu.titel}${neu.dauer ? ` · ${neu.dauer} Min.` : ""}`, { art: "podcast" }); } catch { /* egal */ } }
  }
  if (geaendert) sichern(d);
}

const spiel = (f, podcast) => `podcast_spiel:${encodeURIComponent(JSON.stringify({ name: `${podcast}: ${f.titel}`.slice(0, 160), url: f.audio, bild: f.bild || "" }))}`;
export async function quickCommand(text) {
  const { k } = sauber(text);
  if (!/\bpodcasts?\b|\bfolge\b/.test(k)) return null;
  if (/^(öffne |zeig )?(meine |die )?podcasts?( an)?$/.test(k)) return { answer: "Hier sind deine Podcasts.", actions: ["wunsch:podcasts"] };
  const liste = abos();
  const finde = (s) => liste.find((a) => s.includes(a.titel.toLowerCase()) || a.titel.toLowerCase().split(/[\s:–-]+/).filter((w) => w.length > 3).some((w) => s.includes(w)));
  try {
    // "gibt es eine neue Folge von Lage der Nation?"
    if (/\b(neue|neuste|neueste|letzte|aktuelle) folge\b|\bneue folgen\b/.test(k)) {
      const a = finde(k);
      if (a) {
        const f = (await folgen(a.feed)).folgen[0];
        if (!f) return { answer: `Bei ${a.titel} finde ich gerade keine Folge.`, actions: ["wunsch:podcasts"] };
        const abspielen = /\b(spiel|spiele|starte|hör|hören)\b/.test(k);
        return { answer: `Die neueste Folge von ${a.titel} ist ${f.at ? `vom ${datumLang(f.at)}` : "da"}: ${f.titel}.${abspielen ? " Ich spiele sie ab." : " Sag „spiel die neue Folge von …“, dann spiele ich sie ab."}`, actions: ["wunsch:podcasts", ...(abspielen ? [spiel({ ...f, bild: a.bild }, a.titel)] : [])] };
      }
      if (!liste.length) return { answer: "Du hast noch keinen Podcast abonniert. Sag zum Beispiel: „Abonniere den Podcast Lage der Nation.“", actions: ["wunsch:podcasts"] };
      const n = await neueste();
      return { answer: n.length ? `Die neuesten Folgen: ${n.slice(0, 3).map((f) => `${f.podcast}: ${f.titel}`).join("; ")}.` : "Ich finde gerade keine neuen Folgen.", actions: ["wunsch:podcasts"] };
    }
    // "abonniere den Podcast Lage der Nation"
    const abo = k.match(/^(?:abonniere|abonnier|folge|merk dir)\s+(?:den |dem )?podcast\s+(.+)$/);
    if (abo) {
      const t = await suchen(abo[1]);
      if (!t.length) return { answer: `Ich finde keinen Podcast namens ${abo[1]}.`, actions: ["wunsch:podcasts"] };
      await abonnieren(t[0]);
      return { answer: `Abonniert: ${t[0].titel}${t[0].von ? ` von ${t[0].von}` : ""}. Ich sage Bescheid, wenn eine neue Folge kommt.`, actions: ["wunsch:podcasts"] };
    }
    // "spiel den Podcast Lage der Nation"
    const sp = k.match(/^(?:spiel|spiele|starte|hör)\s+(?:mir\s+)?(?:den |die )?(?:podcast|folge von)\s+(.+?)(?:\s+ab|\s+an)?$/);
    if (sp) {
      const a = finde(sp[1]) || (await suchen(sp[1]))[0];
      if (!a) return { answer: `Ich finde keinen Podcast namens ${sp[1]}.`, actions: ["wunsch:podcasts"] };
      const f = (await folgen(a.feed)).folgen[0];
      if (!f) return { answer: `Bei ${a.titel} gibt es gerade keine Folge zum Abspielen.`, actions: ["wunsch:podcasts"] };
      return { answer: `Ich spiele die neueste Folge von ${a.titel}: ${f.titel}.`, actions: ["wunsch:podcasts", spiel({ ...f, bild: a.bild }, a.titel)] };
    }
  } catch (err) {
    return { answer: `Bei den Podcasts hakt es gerade (${err.message}).`, actions: ["wunsch:podcasts"] };
  }
  return null;
}
