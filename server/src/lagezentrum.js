// Lagezentrum: aktuelle Nachrichten pro Land (Google News, kostenlos) und Fridays Einschätzung.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

const client = new Anthropic({ apiKey: config.anthropicKey });

// id = ISO-3166 numerisch (so heißen die Länder in der Weltkarte), lat/lon = ungefähre Mitte.
export const COUNTRIES = [
  { id: "276", name: "Deutschland", lat: 51.2, lon: 10.4 },
  { id: "250", name: "Frankreich", lat: 46.6, lon: 2.4 },
  { id: "826", name: "Großbritannien", lat: 54.0, lon: -2.5 },
  { id: "380", name: "Italien", lat: 42.8, lon: 12.6 },
  { id: "724", name: "Spanien", lat: 40.2, lon: -3.7 },
  { id: "616", name: "Polen", lat: 52.1, lon: 19.4 },
  { id: "040", name: "Österreich", lat: 47.6, lon: 14.1 },
  { id: "756", name: "Schweiz", lat: 46.8, lon: 8.2 },
  { id: "528", name: "Niederlande", lat: 52.2, lon: 5.5 },
  { id: "191", name: "Kroatien", lat: 45.1, lon: 15.2 },
  { id: "300", name: "Griechenland", lat: 39.1, lon: 22.0 },
  { id: "752", name: "Schweden", lat: 62.0, lon: 15.0 },
  { id: "804", name: "Ukraine", lat: 49.0, lon: 31.4 },
  { id: "643", name: "Russland", lat: 61.5, lon: 99.0 },
  { id: "792", name: "Türkei", lat: 39.0, lon: 35.2 },
  { id: "376", name: "Israel", lat: 31.4, lon: 35.0 },
  { id: "364", name: "Iran", lat: 32.4, lon: 53.7 },
  { id: "682", name: "Saudi-Arabien", lat: 23.9, lon: 45.1 },
  { id: "818", name: "Ägypten", lat: 26.8, lon: 30.8 },
  { id: "566", name: "Nigeria", lat: 9.1, lon: 8.7 },
  { id: "710", name: "Südafrika", lat: -30.6, lon: 22.9 },
  { id: "404", name: "Kenia", lat: 0.0, lon: 37.9 },
  { id: "840", name: "USA", lat: 39.8, lon: -98.6 },
  { id: "124", name: "Kanada", lat: 56.1, lon: -106.3 },
  { id: "484", name: "Mexiko", lat: 23.6, lon: -102.6 },
  { id: "076", name: "Brasilien", lat: -10.3, lon: -53.1 },
  { id: "032", name: "Argentinien", lat: -38.4, lon: -63.6 },
  { id: "862", name: "Venezuela", lat: 6.4, lon: -66.6 },
  { id: "156", name: "China", lat: 35.9, lon: 104.2 },
  { id: "356", name: "Indien", lat: 21.0, lon: 78.9 },
  { id: "392", name: "Japan", lat: 36.2, lon: 138.3 },
  { id: "410", name: "Südkorea", lat: 36.5, lon: 127.9 },
  { id: "408", name: "Nordkorea", lat: 40.3, lon: 127.5 },
  { id: "158", name: "Taiwan", lat: 23.7, lon: 121.0 },
  { id: "586", name: "Pakistan", lat: 30.4, lon: 69.3 },
  { id: "360", name: "Indonesien", lat: -2.5, lon: 118.0 },
  { id: "036", name: "Australien", lat: -25.3, lon: 133.8 },
];

const byKey = new Map();
for (const c of COUNTRIES) {
  byKey.set(c.id, c);
  byKey.set(c.name.toLowerCase(), c);
}
const ALIASES = { "england": "826", "uk": "826", "vereinigtes königreich": "826", "amerika": "840", "vereinigte staaten": "840", "korea": "410", "holland": "528", "türkiye": "792" };

export function findCountry(key) {
  const k = String(key || "").trim().toLowerCase();
  return byKey.get(k) || byKey.get(ALIASES[k]) || COUNTRIES.find((c) => c.name.toLowerCase().startsWith(k) && k.length >= 3);
}

// --- Nachrichten holen (15 Minuten zwischengespeichert) ---
const CACHE_MS = 15 * 60 * 1000;
const newsCache = new Map(); // id -> { at, items }
const summaryCache = new Map(); // id -> { at, newsAt, ...einschätzung }

const decode = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .trim();

function parseRss(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const get = (tag) => decode(m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] || "");
    const full = get("title");
    const source = get("source");
    const title = source && full.endsWith(` - ${source}`) ? full.slice(0, -source.length - 3) : full;
    const link = get("link");
    items.push({ title, source, link: /^https:\/\//.test(link) ? link : "", date: new Date(get("pubDate")).toISOString() });
  }
  return items;
}

export async function getCountryNews(country) {
  const cached = newsCache.get(country.id);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(country.name)}+when:1d&hl=de&gl=DE&ceid=DE:de`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 F.R.Ai.D.A.Y" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Google News antwortet mit ${res.status}`);
  const items = parseRss(await res.text());
  const entry = { at: Date.now(), items };
  newsCache.set(country.id, entry);
  return entry;
}

// Übersicht für die Weltkarte: Anzahl Meldungen der letzten 24 Stunden pro Land.
let overviewRunning = null;
export async function getOverview() {
  overviewRunning ??= (async () => {
    const out = [];
    // In kleinen Gruppen abfragen, damit Google nicht bremst.
    for (let i = 0; i < COUNTRIES.length; i += 6) {
      const group = COUNTRIES.slice(i, i + 6);
      const results = await Promise.all(group.map((c) => getCountryNews(c).catch(() => null)));
      group.forEach((c, j) => {
        const s = summaryCache.get(c.id);
        out.push({
          ...c,
          meldungen: results[j]?.items.length ?? 0,
          top: results[j]?.items[0]?.title ?? "",
          bewertung: s?.bewertung ?? null,
        });
      });
    }
    return out;
  })().finally(() => { overviewRunning = null; });
  return overviewRunning;
}

// --- Fridays Einschätzung ---
const RATING_TOOL = {
  name: "lagebericht",
  description: "Gibt die Einschätzung der Lage in einem Land zurück.",
  input_schema: {
    type: "object",
    properties: {
      bewertung: { type: "string", enum: ["gut", "schlecht", "gemischt"], description: "Grundstimmung der Nachrichtenlage" },
      zusammenfassung: { type: "string", description: "Zwei bis vier Sätze auf Deutsch, nur gestützt auf die Meldungen." },
    },
    required: ["bewertung", "zusammenfassung"],
  },
};

export async function getSummary(country) {
  const news = await getCountryNews(country);
  const cached = summaryCache.get(country.id);
  if (cached && cached.newsAt === news.at) return cached;
  if (!news.items.length) return { bewertung: "gemischt", zusammenfassung: `Zu ${country.name} gibt es in den letzten 24 Stunden keine Meldungen.` };

  const headlines = news.items.map((n, i) => `${i + 1}. ${n.title} (${n.source})`).join("\n");
  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1500,
    tool_choice: { type: "tool", name: "lagebericht" },
    tools: [RATING_TOOL],
    system: "Du bist F.R.Ai.D.A.Y und erstellst kurze Lageberichte. Stütze dich ausschließlich auf die gelieferten Schlagzeilen, erfinde nichts dazu. Sachlich, ohne Markdown.",
    messages: [{ role: "user", content: `Schlagzeilen der letzten 24 Stunden zu ${country.name}:\n${headlines}\n\nWie ist die Lage?` }],
  });
  const tool = response.content.find((b) => b.type === "tool_use");
  if (!tool) throw new Error("Keine Einschätzung erhalten");
  const result = {
    bewertung: ["gut", "schlecht", "gemischt"].includes(tool.input.bewertung) ? tool.input.bewertung : "gemischt",
    zusammenfassung: String(tool.input.zusammenfassung || "").slice(0, 1500),
  };
  summaryCache.set(country.id, { ...result, at: Date.now(), newsAt: news.at });
  return result;
}

// Verständliche Fehlermeldung, z. B. wenn das Claude-Guthaben leer ist.
export function friendlyError(err) {
  const msg = String(err?.message || err);
  if (/credit balance/i.test(msg)) return "Dein Claude-Guthaben ist leer. Lade es auf console.anthropic.com auf, dann bekommst du hier Fridays Einschätzung.";
  return "Die Einschätzung hat gerade nicht geklappt.";
}
