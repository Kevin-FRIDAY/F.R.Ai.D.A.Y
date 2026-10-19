// Lagezentrum: weltweite Lage aus öffentlichen Quellen (Nachrichten pro Land + Erdbeben).
// Alle Daten sind frei zugänglich. Keine privaten oder nicht-öffentlichen Informationen.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

const client = new Anthropic({ apiKey: config.anthropicKey });

// Alle Länder (ISO-3166 numerische id passend zur Weltkarte), deutsche Namen, ungefähre Mitte.
export const COUNTRIES = [{"id":"004","name":"Afghanistan","lat":33,"lon":65},{"id":"818","name":"Ägypten","lat":27,"lon":30},{"id":"008","name":"Albanien","lat":41,"lon":20},{"id":"012","name":"Algerien","lat":28,"lon":3},{"id":"020","name":"Andorra","lat":42.5,"lon":1.5},{"id":"024","name":"Angola","lat":-12.5,"lon":18.5},{"id":"028","name":"Antigua und Barbuda","lat":17.1,"lon":-61.8},{"id":"226","name":"Äquatorialguinea","lat":2,"lon":10},{"id":"032","name":"Argentinien","lat":-34,"lon":-64},{"id":"051","name":"Armenien","lat":40,"lon":45},{"id":"031","name":"Aserbaidschan","lat":40.5,"lon":47.5},{"id":"231","name":"Äthiopien","lat":8,"lon":38},{"id":"036","name":"Australien","lat":-27,"lon":133},{"id":"044","name":"Bahamas","lat":24.3,"lon":-76},{"id":"048","name":"Bahrain","lat":26,"lon":50.5},{"id":"050","name":"Bangladesch","lat":24,"lon":90},{"id":"052","name":"Barbados","lat":13.2,"lon":-59.5},{"id":"112","name":"Belarus","lat":53,"lon":28},{"id":"056","name":"Belgien","lat":50.8,"lon":4},{"id":"084","name":"Belize","lat":17.3,"lon":-88.8},{"id":"204","name":"Benin","lat":9.5,"lon":2.3},{"id":"064","name":"Bhutan","lat":27.5,"lon":90.5},{"id":"068","name":"Bolivien","lat":-17,"lon":-65},{"id":"070","name":"Bosnien und Herzegowina","lat":44,"lon":18},{"id":"072","name":"Botswana","lat":-22,"lon":24},{"id":"076","name":"Brasilien","lat":-10,"lon":-55},{"id":"096","name":"Brunei","lat":4.5,"lon":114.7},{"id":"100","name":"Bulgarien","lat":43,"lon":25},{"id":"854","name":"Burkina Faso","lat":13,"lon":-2},{"id":"108","name":"Burundi","lat":-3.5,"lon":30},{"id":"152","name":"Chile","lat":-30,"lon":-71},{"id":"156","name":"China","lat":35,"lon":105},{"id":"188","name":"Costa Rica","lat":10,"lon":-84},{"id":"384","name":"Côte d'Ivoire","lat":8,"lon":-5},{"id":"208","name":"Dänemark","lat":56,"lon":10},{"id":"276","name":"Deutschland","lat":51,"lon":9},{"id":"212","name":"Dominica","lat":15.4,"lon":-61.3},{"id":"214","name":"Dominikanische Republik","lat":19,"lon":-70.7},{"id":"262","name":"Dschibuti","lat":11.5,"lon":43},{"id":"218","name":"Ecuador","lat":-2,"lon":-77.5},{"id":"222","name":"El Salvador","lat":13.8,"lon":-88.9},{"id":"232","name":"Eritrea","lat":15,"lon":39},{"id":"233","name":"Estland","lat":59,"lon":26},{"id":"242","name":"Fidschi","lat":-18,"lon":175},{"id":"246","name":"Finnland","lat":64,"lon":26},{"id":"250","name":"Frankreich","lat":46,"lon":2},{"id":"266","name":"Gabun","lat":-1,"lon":11.8},{"id":"270","name":"Gambia","lat":13.5,"lon":-16.6},{"id":"268","name":"Georgien","lat":42,"lon":43.5},{"id":"288","name":"Ghana","lat":8,"lon":-2},{"id":"308","name":"Grenada","lat":12.1,"lon":-61.7},{"id":"300","name":"Griechenland","lat":39,"lon":22},{"id":"320","name":"Guatemala","lat":15.5,"lon":-90.3},{"id":"324","name":"Guinea","lat":11,"lon":-10},{"id":"624","name":"Guinea-Bissau","lat":12,"lon":-15},{"id":"328","name":"Guyana","lat":5,"lon":-59},{"id":"332","name":"Haiti","lat":19,"lon":-72.4},{"id":"340","name":"Honduras","lat":15,"lon":-86.5},{"id":"344","name":"Hongkong","lat":22.3,"lon":114.2},{"id":"356","name":"Indien","lat":20,"lon":77},{"id":"360","name":"Indonesien","lat":-5,"lon":120},{"id":"368","name":"Irak","lat":33,"lon":44},{"id":"364","name":"Iran","lat":32,"lon":53},{"id":"372","name":"Irland","lat":53,"lon":-8},{"id":"352","name":"Island","lat":65,"lon":-18},{"id":"376","name":"Israel","lat":31.5,"lon":35.1},{"id":"380","name":"Italien","lat":42.8,"lon":12.8},{"id":"388","name":"Jamaika","lat":18.3,"lon":-77.5},{"id":"392","name":"Japan","lat":36,"lon":138},{"id":"887","name":"Jemen","lat":15,"lon":48},{"id":"400","name":"Jordanien","lat":31,"lon":36},{"id":"116","name":"Kambodscha","lat":13,"lon":105},{"id":"120","name":"Kamerun","lat":6,"lon":12},{"id":"124","name":"Kanada","lat":60,"lon":-95},{"id":"132","name":"Kap Verde","lat":16,"lon":-24},{"id":"398","name":"Kasachstan","lat":48,"lon":68},{"id":"634","name":"Katar","lat":25.5,"lon":51.3},{"id":"404","name":"Kenia","lat":1,"lon":38},{"id":"417","name":"Kirgisistan","lat":41,"lon":75},{"id":"296","name":"Kiribati","lat":1.4,"lon":173},{"id":"170","name":"Kolumbien","lat":4,"lon":-72},{"id":"174","name":"Komoren","lat":-12.2,"lon":44.3},{"id":"178","name":"Kongo","lat":-1,"lon":15},{"id":"180","name":"Kongo (Dem. Rep.)","lat":0,"lon":25},{"id":"191","name":"Kroatien","lat":45.2,"lon":15.5},{"id":"192","name":"Kuba","lat":21.5,"lon":-80},{"id":"414","name":"Kuwait","lat":29.5,"lon":45.8},{"id":"418","name":"Laos","lat":18,"lon":105},{"id":"426","name":"Lesotho","lat":-29.5,"lon":28.5},{"id":"428","name":"Lettland","lat":57,"lon":25},{"id":"422","name":"Libanon","lat":33.8,"lon":35.8},{"id":"430","name":"Liberia","lat":6.5,"lon":-9.5},{"id":"434","name":"Libyen","lat":25,"lon":17},{"id":"438","name":"Liechtenstein","lat":47.3,"lon":9.5},{"id":"440","name":"Litauen","lat":56,"lon":24},{"id":"442","name":"Luxemburg","lat":49.8,"lon":6.2},{"id":"450","name":"Madagaskar","lat":-20,"lon":47},{"id":"454","name":"Malawi","lat":-13.5,"lon":34},{"id":"458","name":"Malaysia","lat":2.5,"lon":112.5},{"id":"462","name":"Malediven","lat":3.3,"lon":73},{"id":"466","name":"Mali","lat":17,"lon":-4},{"id":"470","name":"Malta","lat":35.8,"lon":14.6},{"id":"504","name":"Marokko","lat":32,"lon":-5},{"id":"584","name":"Marshallinseln","lat":9,"lon":168},{"id":"478","name":"Mauretanien","lat":20,"lon":-12},{"id":"480","name":"Mauritius","lat":-20.3,"lon":57.5},{"id":"484","name":"Mexiko","lat":23,"lon":-102},{"id":"583","name":"Mikronesien","lat":6.9,"lon":158.3},{"id":"498","name":"Moldawien","lat":47,"lon":29},{"id":"492","name":"Monaco","lat":43.7,"lon":7.4},{"id":"496","name":"Mongolei","lat":46,"lon":105},{"id":"499","name":"Montenegro","lat":42.5,"lon":19.3},{"id":"508","name":"Mosambik","lat":-18.3,"lon":35},{"id":"104","name":"Myanmar","lat":22,"lon":98},{"id":"516","name":"Namibia","lat":-22,"lon":17},{"id":"520","name":"Nauru","lat":-0.5,"lon":166.9},{"id":"524","name":"Nepal","lat":28,"lon":84},{"id":"554","name":"Neuseeland","lat":-41,"lon":174},{"id":"558","name":"Nicaragua","lat":13,"lon":-85},{"id":"528","name":"Niederlande","lat":52.5,"lon":5.8},{"id":"562","name":"Niger","lat":16,"lon":8},{"id":"566","name":"Nigeria","lat":10,"lon":8},{"id":"408","name":"Nordkorea","lat":40,"lon":127},{"id":"807","name":"Nordmazedonien","lat":41.8,"lon":22},{"id":"578","name":"Norwegen","lat":62,"lon":10},{"id":"512","name":"Oman","lat":21,"lon":57},{"id":"040","name":"Österreich","lat":47.3,"lon":13.3},{"id":"626","name":"Osttimor","lat":-8.8,"lon":125.9},{"id":"586","name":"Pakistan","lat":30,"lon":70},{"id":"275","name":"Palästina","lat":31.9,"lon":35.2},{"id":"585","name":"Palau","lat":7.5,"lon":134.5},{"id":"591","name":"Panama","lat":9,"lon":-80},{"id":"598","name":"Papua-Neuguinea","lat":-6,"lon":147},{"id":"600","name":"Paraguay","lat":-23,"lon":-58},{"id":"604","name":"Peru","lat":-10,"lon":-76},{"id":"608","name":"Philippinen","lat":13,"lon":122},{"id":"616","name":"Polen","lat":52,"lon":20},{"id":"620","name":"Portugal","lat":39.5,"lon":-8},{"id":"646","name":"Ruanda","lat":-2,"lon":30},{"id":"642","name":"Rumänien","lat":46,"lon":25},{"id":"643","name":"Russland","lat":60,"lon":100},{"id":"090","name":"Salomonen","lat":-8,"lon":159},{"id":"894","name":"Sambia","lat":-15,"lon":30},{"id":"882","name":"Samoa","lat":-13.6,"lon":-172.3},{"id":"674","name":"San Marino","lat":43.8,"lon":12.4},{"id":"678","name":"São Tomé und Príncipe","lat":1,"lon":7},{"id":"682","name":"Saudi-Arabien","lat":25,"lon":45},{"id":"752","name":"Schweden","lat":62,"lon":15},{"id":"756","name":"Schweiz","lat":47,"lon":8},{"id":"686","name":"Senegal","lat":14,"lon":-14},{"id":"688","name":"Serbien","lat":44,"lon":21},{"id":"690","name":"Seychellen","lat":-4.6,"lon":55.7},{"id":"694","name":"Sierra Leone","lat":8.5,"lon":-11.5},{"id":"716","name":"Simbabwe","lat":-20,"lon":30},{"id":"702","name":"Singapur","lat":1.4,"lon":103.8},{"id":"703","name":"Slowakei","lat":48.7,"lon":19.5},{"id":"705","name":"Slowenien","lat":46.1,"lon":14.8},{"id":"706","name":"Somalia","lat":10,"lon":49},{"id":"724","name":"Spanien","lat":40,"lon":-4},{"id":"144","name":"Sri Lanka","lat":7,"lon":81},{"id":"659","name":"St. Kitts und Nevis","lat":17.3,"lon":-62.8},{"id":"662","name":"St. Lucia","lat":13.9,"lon":-61},{"id":"670","name":"St. Vincent und die Grenadinen","lat":13.3,"lon":-61.2},{"id":"710","name":"Südafrika","lat":-29,"lon":24},{"id":"729","name":"Sudan","lat":15,"lon":30},{"id":"410","name":"Südkorea","lat":37,"lon":127.5},{"id":"728","name":"Südsudan","lat":7,"lon":30},{"id":"740","name":"Suriname","lat":4,"lon":-56},{"id":"748","name":"Swasiland","lat":-26.5,"lon":31.5},{"id":"760","name":"Syrien","lat":35,"lon":38},{"id":"762","name":"Tadschikistan","lat":39,"lon":71},{"id":"158","name":"Taiwan","lat":23.5,"lon":121},{"id":"834","name":"Tansania","lat":-6,"lon":35},{"id":"764","name":"Thailand","lat":15,"lon":100},{"id":"768","name":"Togo","lat":8,"lon":1.2},{"id":"776","name":"Tonga","lat":-20,"lon":-175},{"id":"780","name":"Trinidad und Tobago","lat":11,"lon":-61},{"id":"148","name":"Tschad","lat":15,"lon":19},{"id":"203","name":"Tschechien","lat":49.8,"lon":15.5},{"id":"788","name":"Tunesien","lat":34,"lon":9},{"id":"792","name":"Türkei","lat":39,"lon":35},{"id":"795","name":"Turkmenistan","lat":40,"lon":60},{"id":"798","name":"Tuvalu","lat":-8,"lon":178},{"id":"800","name":"Uganda","lat":1,"lon":32},{"id":"804","name":"Ukraine","lat":49,"lon":32},{"id":"348","name":"Ungarn","lat":47,"lon":20},{"id":"858","name":"Uruguay","lat":-33,"lon":-56},{"id":"860","name":"Usbekistan","lat":41,"lon":64},{"id":"548","name":"Vanuatu","lat":-16,"lon":167},{"id":"336","name":"Vatikanstadt","lat":41.9,"lon":12.4},{"id":"862","name":"Venezuela","lat":8,"lon":-66},{"id":"784","name":"Vereinigte Arabische Emirate","lat":24,"lon":54},{"id":"840","name":"Vereinigte Staaten","lat":38,"lon":-97},{"id":"826","name":"Vereinigtes Königreich","lat":54,"lon":-2},{"id":"704","name":"Vietnam","lat":16.2,"lon":107.8},{"id":"140","name":"Zentralafrikanische Republik","lat":7,"lon":21},{"id":"196","name":"Zypern","lat":35,"lon":33}];

const byKey = new Map();
for (const c of COUNTRIES) {
  byKey.set(c.id, c);
  byKey.set(c.name.toLowerCase(), c);
}
const ALIASES = {
  "england": "826", "uk": "826", "großbritannien": "826", "vereinigtes königreich": "826",
  "amerika": "840", "usa": "840", "vereinigte staaten": "840", "us": "840",
  "korea": "410", "südkorea": "410", "nordkorea": "408", "holland": "528",
  "türkei": "792", "türkiye": "792", "tschechien": "203", "russland": "643",
};

export function findCountry(key) {
  const k = String(key || "").trim().toLowerCase();
  if (byKey.has(k)) return byKey.get(k);
  if (ALIASES[k]) return byKey.get(ALIASES[k]);
  return COUNTRIES.find((c) => k.length >= 3 && c.name.toLowerCase().startsWith(k))
      || COUNTRIES.find((c) => k.length >= 4 && c.name.toLowerCase().includes(k));
}

// --- Nachrichten holen (20 Minuten zwischengespeichert) ---
const CACHE_MS = 20 * 60 * 1000;
const newsCache = new Map(); // id -> { at, items }
const summaryCache = new Map(); // id -> { at, newsAt, bewertung, zusammenfassung }

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

// --- Hintergrund-Scanner: füllt nach und nach die Nachrichtenlage aller Länder ---
let scanning = false;
let lastScanDone = 0;
async function scanWorld() {
  if (scanning) return;
  scanning = true;
  try {
    for (let i = 0; i < COUNTRIES.length; i += 8) {
      const group = COUNTRIES.slice(i, i + 8);
      await Promise.all(group.map((c) => getCountryNews(c).catch(() => null)));
      await new Promise((r) => setTimeout(r, 400));
    }
    lastScanDone = Date.now();
  } finally {
    scanning = false;
  }
}

// Übersicht für die Weltkarte: aus dem Zwischenspeicher, plus Anstoß zum Nachladen.
export function getOverview() {
  const stale = Date.now() - lastScanDone > CACHE_MS;
  if (stale && !scanning) scanWorld();
  const list = COUNTRIES.map((c) => {
    const n = newsCache.get(c.id);
    const s = summaryCache.get(c.id);
    return { ...c, meldungen: n?.items.length ?? 0, top: n?.items[0]?.title ?? "", bewertung: s?.bewertung ?? null, geladen: Boolean(n) };
  });
  const geladen = list.filter((c) => c.geladen).length;
  return { stand: lastScanDone ? new Date(lastScanDone).toISOString() : null, scannt: scanning, geladen, gesamt: COUNTRIES.length, laender: list };
}

// --- Erdbeben (USGS, öffentlich, kein Schlüssel) ---
let quakeCache = null;
export async function getQuakes() {
  if (quakeCache && Date.now() - quakeCache.at < 10 * 60 * 1000) return quakeCache.list;
  const res = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson", { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  const data = await res.json();
  const list = (data.features || [])
    .filter((f) => f.geometry?.coordinates?.length >= 2)
    .map((f) => ({ ort: f.properties.place || "", staerke: f.properties.mag, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], zeit: new Date(f.properties.time).toISOString() }))
    .sort((a, b) => b.staerke - a.staerke)
    .slice(0, 60);
  quakeCache = { at: Date.now(), list };
  return list;
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

  const headlines = news.items.slice(0, 25).map((n, i) => `${i + 1}. ${n.title} (${n.source})`).join("\n");
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

export function friendlyError(err) {
  const msg = String(err?.message || err);
  if (/credit balance/i.test(msg)) return "Dein Claude-Guthaben ist leer. Lade es auf console.anthropic.com auf, dann bekommst du hier Fridays Einschätzung.";
  return "Die Einschätzung hat gerade nicht geklappt.";
}
