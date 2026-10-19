// Lagezentrum: weltweite Lage aus öffentlichen Quellen (Nachrichten pro Land + Erdbeben).
// Alle Daten sind frei zugänglich. Keine privaten oder nicht-öffentlichen Informationen.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

const client = new Anthropic({ apiKey: config.anthropicKey });

// Alle Länder (ISO-3166 numerische id passend zur Weltkarte), deutsche Namen, ungefähre Mitte.
export const COUNTRIES = [{"id":"004","name":"Afghanistan","en":"Afghanistan","lat":33,"lon":65},{"id":"818","name":"Ägypten","en":"Egypt","lat":27,"lon":30},{"id":"008","name":"Albanien","en":"Albania","lat":41,"lon":20},{"id":"012","name":"Algerien","en":"Algeria","lat":28,"lon":3},{"id":"020","name":"Andorra","en":"Andorra","lat":42.5,"lon":1.5},{"id":"024","name":"Angola","en":"Angola","lat":-12.5,"lon":18.5},{"id":"028","name":"Antigua und Barbuda","en":"Antigua and Barbuda","lat":17.1,"lon":-61.8},{"id":"226","name":"Äquatorialguinea","en":"Equatorial Guinea","lat":2,"lon":10},{"id":"032","name":"Argentinien","en":"Argentina","lat":-34,"lon":-64},{"id":"051","name":"Armenien","en":"Armenia","lat":40,"lon":45},{"id":"031","name":"Aserbaidschan","en":"Azerbaijan","lat":40.5,"lon":47.5},{"id":"231","name":"Äthiopien","en":"Ethiopia","lat":8,"lon":38},{"id":"036","name":"Australien","en":"Australia","lat":-27,"lon":133},{"id":"044","name":"Bahamas","en":"Bahamas","lat":24.3,"lon":-76},{"id":"048","name":"Bahrain","en":"Bahrain","lat":26,"lon":50.5},{"id":"050","name":"Bangladesch","en":"Bangladesh","lat":24,"lon":90},{"id":"052","name":"Barbados","en":"Barbados","lat":13.2,"lon":-59.5},{"id":"112","name":"Belarus","en":"Belarus","lat":53,"lon":28},{"id":"056","name":"Belgien","en":"Belgium","lat":50.8,"lon":4},{"id":"084","name":"Belize","en":"Belize","lat":17.3,"lon":-88.8},{"id":"204","name":"Benin","en":"Benin","lat":9.5,"lon":2.3},{"id":"064","name":"Bhutan","en":"Bhutan","lat":27.5,"lon":90.5},{"id":"068","name":"Bolivien","en":"Bolivia","lat":-17,"lon":-65},{"id":"070","name":"Bosnien und Herzegowina","en":"Bosnia and Herzegovina","lat":44,"lon":18},{"id":"072","name":"Botswana","en":"Botswana","lat":-22,"lon":24},{"id":"076","name":"Brasilien","en":"Brazil","lat":-10,"lon":-55},{"id":"096","name":"Brunei","en":"Brunei","lat":4.5,"lon":114.7},{"id":"100","name":"Bulgarien","en":"Bulgaria","lat":43,"lon":25},{"id":"854","name":"Burkina Faso","en":"Burkina Faso","lat":13,"lon":-2},{"id":"108","name":"Burundi","en":"Burundi","lat":-3.5,"lon":30},{"id":"152","name":"Chile","en":"Chile","lat":-30,"lon":-71},{"id":"156","name":"China","en":"China","lat":35,"lon":105},{"id":"188","name":"Costa Rica","en":"Costa Rica","lat":10,"lon":-84},{"id":"384","name":"Côte d'Ivoire","en":"Ivory Coast","lat":8,"lon":-5},{"id":"208","name":"Dänemark","en":"Denmark","lat":56,"lon":10},{"id":"276","name":"Deutschland","en":"Germany","lat":51,"lon":9},{"id":"212","name":"Dominica","en":"Dominica","lat":15.4,"lon":-61.3},{"id":"214","name":"Dominikanische Republik","en":"Dominican Republic","lat":19,"lon":-70.7},{"id":"262","name":"Dschibuti","en":"Djibouti","lat":11.5,"lon":43},{"id":"218","name":"Ecuador","en":"Ecuador","lat":-2,"lon":-77.5},{"id":"222","name":"El Salvador","en":"El Salvador","lat":13.8,"lon":-88.9},{"id":"232","name":"Eritrea","en":"Eritrea","lat":15,"lon":39},{"id":"233","name":"Estland","en":"Estonia","lat":59,"lon":26},{"id":"242","name":"Fidschi","en":"Fiji","lat":-18,"lon":175},{"id":"246","name":"Finnland","en":"Finland","lat":64,"lon":26},{"id":"250","name":"Frankreich","en":"France","lat":46,"lon":2},{"id":"266","name":"Gabun","en":"Gabon","lat":-1,"lon":11.8},{"id":"270","name":"Gambia","en":"Gambia","lat":13.5,"lon":-16.6},{"id":"268","name":"Georgien","en":"Georgia","lat":42,"lon":43.5},{"id":"288","name":"Ghana","en":"Ghana","lat":8,"lon":-2},{"id":"308","name":"Grenada","en":"Grenada","lat":12.1,"lon":-61.7},{"id":"300","name":"Griechenland","en":"Greece","lat":39,"lon":22},{"id":"320","name":"Guatemala","en":"Guatemala","lat":15.5,"lon":-90.3},{"id":"324","name":"Guinea","en":"Guinea","lat":11,"lon":-10},{"id":"624","name":"Guinea-Bissau","en":"Guinea-Bissau","lat":12,"lon":-15},{"id":"328","name":"Guyana","en":"Guyana","lat":5,"lon":-59},{"id":"332","name":"Haiti","en":"Haiti","lat":19,"lon":-72.4},{"id":"340","name":"Honduras","en":"Honduras","lat":15,"lon":-86.5},{"id":"344","name":"Hongkong","en":"Hong Kong","lat":22.3,"lon":114.2},{"id":"356","name":"Indien","en":"India","lat":20,"lon":77},{"id":"360","name":"Indonesien","en":"Indonesia","lat":-5,"lon":120},{"id":"368","name":"Irak","en":"Iraq","lat":33,"lon":44},{"id":"364","name":"Iran","en":"Iran","lat":32,"lon":53},{"id":"372","name":"Irland","en":"Ireland","lat":53,"lon":-8},{"id":"352","name":"Island","en":"Iceland","lat":65,"lon":-18},{"id":"376","name":"Israel","en":"Israel","lat":31.5,"lon":35.1},{"id":"380","name":"Italien","en":"Italy","lat":42.8,"lon":12.8},{"id":"388","name":"Jamaika","en":"Jamaica","lat":18.3,"lon":-77.5},{"id":"392","name":"Japan","en":"Japan","lat":36,"lon":138},{"id":"887","name":"Jemen","en":"Yemen","lat":15,"lon":48},{"id":"400","name":"Jordanien","en":"Jordan","lat":31,"lon":36},{"id":"116","name":"Kambodscha","en":"Cambodia","lat":13,"lon":105},{"id":"120","name":"Kamerun","en":"Cameroon","lat":6,"lon":12},{"id":"124","name":"Kanada","en":"Canada","lat":60,"lon":-95},{"id":"132","name":"Kap Verde","en":"Cape Verde","lat":16,"lon":-24},{"id":"398","name":"Kasachstan","en":"Kazakhstan","lat":48,"lon":68},{"id":"634","name":"Katar","en":"Qatar","lat":25.5,"lon":51.3},{"id":"404","name":"Kenia","en":"Kenya","lat":1,"lon":38},{"id":"417","name":"Kirgisistan","en":"Kyrgyzstan","lat":41,"lon":75},{"id":"296","name":"Kiribati","en":"Kiribati","lat":1.4,"lon":173},{"id":"170","name":"Kolumbien","en":"Colombia","lat":4,"lon":-72},{"id":"174","name":"Komoren","en":"Comoros","lat":-12.2,"lon":44.3},{"id":"178","name":"Kongo","en":"Republic of the Congo","lat":-1,"lon":15},{"id":"180","name":"Kongo (Dem. Rep.)","en":"DR Congo","lat":0,"lon":25},{"id":"191","name":"Kroatien","en":"Croatia","lat":45.2,"lon":15.5},{"id":"192","name":"Kuba","en":"Cuba","lat":21.5,"lon":-80},{"id":"414","name":"Kuwait","en":"Kuwait","lat":29.5,"lon":45.8},{"id":"418","name":"Laos","en":"Laos","lat":18,"lon":105},{"id":"426","name":"Lesotho","en":"Lesotho","lat":-29.5,"lon":28.5},{"id":"428","name":"Lettland","en":"Latvia","lat":57,"lon":25},{"id":"422","name":"Libanon","en":"Lebanon","lat":33.8,"lon":35.8},{"id":"430","name":"Liberia","en":"Liberia","lat":6.5,"lon":-9.5},{"id":"434","name":"Libyen","en":"Libya","lat":25,"lon":17},{"id":"438","name":"Liechtenstein","en":"Liechtenstein","lat":47.3,"lon":9.5},{"id":"440","name":"Litauen","en":"Lithuania","lat":56,"lon":24},{"id":"442","name":"Luxemburg","en":"Luxembourg","lat":49.8,"lon":6.2},{"id":"450","name":"Madagaskar","en":"Madagascar","lat":-20,"lon":47},{"id":"454","name":"Malawi","en":"Malawi","lat":-13.5,"lon":34},{"id":"458","name":"Malaysia","en":"Malaysia","lat":2.5,"lon":112.5},{"id":"462","name":"Malediven","en":"Maldives","lat":3.3,"lon":73},{"id":"466","name":"Mali","en":"Mali","lat":17,"lon":-4},{"id":"470","name":"Malta","en":"Malta","lat":35.8,"lon":14.6},{"id":"504","name":"Marokko","en":"Morocco","lat":32,"lon":-5},{"id":"584","name":"Marshallinseln","en":"Marshall Islands","lat":9,"lon":168},{"id":"478","name":"Mauretanien","en":"Mauritania","lat":20,"lon":-12},{"id":"480","name":"Mauritius","en":"Mauritius","lat":-20.3,"lon":57.5},{"id":"484","name":"Mexiko","en":"Mexico","lat":23,"lon":-102},{"id":"583","name":"Mikronesien","en":"Micronesia","lat":6.9,"lon":158.3},{"id":"498","name":"Moldawien","en":"Moldova","lat":47,"lon":29},{"id":"492","name":"Monaco","en":"Monaco","lat":43.7,"lon":7.4},{"id":"496","name":"Mongolei","en":"Mongolia","lat":46,"lon":105},{"id":"499","name":"Montenegro","en":"Montenegro","lat":42.5,"lon":19.3},{"id":"508","name":"Mosambik","en":"Mozambique","lat":-18.3,"lon":35},{"id":"104","name":"Myanmar","en":"Myanmar","lat":22,"lon":98},{"id":"516","name":"Namibia","en":"Namibia","lat":-22,"lon":17},{"id":"520","name":"Nauru","en":"Nauru","lat":-0.5,"lon":166.9},{"id":"524","name":"Nepal","en":"Nepal","lat":28,"lon":84},{"id":"554","name":"Neuseeland","en":"New Zealand","lat":-41,"lon":174},{"id":"558","name":"Nicaragua","en":"Nicaragua","lat":13,"lon":-85},{"id":"528","name":"Niederlande","en":"Netherlands","lat":52.5,"lon":5.8},{"id":"562","name":"Niger","en":"Niger","lat":16,"lon":8},{"id":"566","name":"Nigeria","en":"Nigeria","lat":10,"lon":8},{"id":"408","name":"Nordkorea","en":"North Korea","lat":40,"lon":127},{"id":"807","name":"Nordmazedonien","en":"North Macedonia","lat":41.8,"lon":22},{"id":"578","name":"Norwegen","en":"Norway","lat":62,"lon":10},{"id":"512","name":"Oman","en":"Oman","lat":21,"lon":57},{"id":"040","name":"Österreich","en":"Austria","lat":47.3,"lon":13.3},{"id":"626","name":"Osttimor","en":"Timor-Leste","lat":-8.8,"lon":125.9},{"id":"586","name":"Pakistan","en":"Pakistan","lat":30,"lon":70},{"id":"275","name":"Palästina","en":"Palestine","lat":31.9,"lon":35.2},{"id":"585","name":"Palau","en":"Palau","lat":7.5,"lon":134.5},{"id":"591","name":"Panama","en":"Panama","lat":9,"lon":-80},{"id":"598","name":"Papua-Neuguinea","en":"Papua New Guinea","lat":-6,"lon":147},{"id":"600","name":"Paraguay","en":"Paraguay","lat":-23,"lon":-58},{"id":"604","name":"Peru","en":"Peru","lat":-10,"lon":-76},{"id":"608","name":"Philippinen","en":"Philippines","lat":13,"lon":122},{"id":"616","name":"Polen","en":"Poland","lat":52,"lon":20},{"id":"620","name":"Portugal","en":"Portugal","lat":39.5,"lon":-8},{"id":"646","name":"Ruanda","en":"Rwanda","lat":-2,"lon":30},{"id":"642","name":"Rumänien","en":"Romania","lat":46,"lon":25},{"id":"643","name":"Russland","en":"Russia","lat":60,"lon":100},{"id":"090","name":"Salomonen","en":"Solomon Islands","lat":-8,"lon":159},{"id":"894","name":"Sambia","en":"Zambia","lat":-15,"lon":30},{"id":"882","name":"Samoa","en":"Samoa","lat":-13.6,"lon":-172.3},{"id":"674","name":"San Marino","en":"San Marino","lat":43.8,"lon":12.4},{"id":"678","name":"São Tomé und Príncipe","en":"São Tomé and Príncipe","lat":1,"lon":7},{"id":"682","name":"Saudi-Arabien","en":"Saudi Arabia","lat":25,"lon":45},{"id":"752","name":"Schweden","en":"Sweden","lat":62,"lon":15},{"id":"756","name":"Schweiz","en":"Switzerland","lat":47,"lon":8},{"id":"686","name":"Senegal","en":"Senegal","lat":14,"lon":-14},{"id":"688","name":"Serbien","en":"Serbia","lat":44,"lon":21},{"id":"690","name":"Seychellen","en":"Seychelles","lat":-4.6,"lon":55.7},{"id":"694","name":"Sierra Leone","en":"Sierra Leone","lat":8.5,"lon":-11.5},{"id":"716","name":"Simbabwe","en":"Zimbabwe","lat":-20,"lon":30},{"id":"702","name":"Singapur","en":"Singapore","lat":1.4,"lon":103.8},{"id":"703","name":"Slowakei","en":"Slovakia","lat":48.7,"lon":19.5},{"id":"705","name":"Slowenien","en":"Slovenia","lat":46.1,"lon":14.8},{"id":"706","name":"Somalia","en":"Somalia","lat":10,"lon":49},{"id":"724","name":"Spanien","en":"Spain","lat":40,"lon":-4},{"id":"144","name":"Sri Lanka","en":"Sri Lanka","lat":7,"lon":81},{"id":"659","name":"St. Kitts und Nevis","en":"Saint Kitts and Nevis","lat":17.3,"lon":-62.8},{"id":"662","name":"St. Lucia","en":"Saint Lucia","lat":13.9,"lon":-61},{"id":"670","name":"St. Vincent und die Grenadinen","en":"Saint Vincent and the Grenadines","lat":13.3,"lon":-61.2},{"id":"710","name":"Südafrika","en":"South Africa","lat":-29,"lon":24},{"id":"729","name":"Sudan","en":"Sudan","lat":15,"lon":30},{"id":"410","name":"Südkorea","en":"South Korea","lat":37,"lon":127.5},{"id":"728","name":"Südsudan","en":"South Sudan","lat":7,"lon":30},{"id":"740","name":"Suriname","en":"Suriname","lat":4,"lon":-56},{"id":"748","name":"Swasiland","en":"Eswatini","lat":-26.5,"lon":31.5},{"id":"760","name":"Syrien","en":"Syria","lat":35,"lon":38},{"id":"762","name":"Tadschikistan","en":"Tajikistan","lat":39,"lon":71},{"id":"158","name":"Taiwan","en":"Taiwan","lat":23.5,"lon":121},{"id":"834","name":"Tansania","en":"Tanzania","lat":-6,"lon":35},{"id":"764","name":"Thailand","en":"Thailand","lat":15,"lon":100},{"id":"768","name":"Togo","en":"Togo","lat":8,"lon":1.2},{"id":"776","name":"Tonga","en":"Tonga","lat":-20,"lon":-175},{"id":"780","name":"Trinidad und Tobago","en":"Trinidad and Tobago","lat":11,"lon":-61},{"id":"148","name":"Tschad","en":"Chad","lat":15,"lon":19},{"id":"203","name":"Tschechien","en":"Czechia","lat":49.8,"lon":15.5},{"id":"788","name":"Tunesien","en":"Tunisia","lat":34,"lon":9},{"id":"792","name":"Türkei","en":"Türkiye","lat":39,"lon":35},{"id":"795","name":"Turkmenistan","en":"Turkmenistan","lat":40,"lon":60},{"id":"798","name":"Tuvalu","en":"Tuvalu","lat":-8,"lon":178},{"id":"800","name":"Uganda","en":"Uganda","lat":1,"lon":32},{"id":"804","name":"Ukraine","en":"Ukraine","lat":49,"lon":32},{"id":"348","name":"Ungarn","en":"Hungary","lat":47,"lon":20},{"id":"858","name":"Uruguay","en":"Uruguay","lat":-33,"lon":-56},{"id":"860","name":"Usbekistan","en":"Uzbekistan","lat":41,"lon":64},{"id":"548","name":"Vanuatu","en":"Vanuatu","lat":-16,"lon":167},{"id":"336","name":"Vatikanstadt","en":"Vatican City","lat":41.9,"lon":12.4},{"id":"862","name":"Venezuela","en":"Venezuela","lat":8,"lon":-66},{"id":"784","name":"Vereinigte Arabische Emirate","en":"United Arab Emirates","lat":24,"lon":54},{"id":"840","name":"Vereinigte Staaten","en":"United States","lat":38,"lon":-97},{"id":"826","name":"Vereinigtes Königreich","en":"United Kingdom","lat":54,"lon":-2},{"id":"704","name":"Vietnam","en":"Vietnam","lat":16.2,"lon":107.8},{"id":"140","name":"Zentralafrikanische Republik","en":"Central African Republic","lat":7,"lon":21},{"id":"196","name":"Zypern","en":"Cyprus","lat":35,"lon":33}];

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

// --- Echte Nachrichtenbilder (GDELT, öffentlich, kein Schlüssel) ---
// GDELT erlaubt nur ca. eine Anfrage alle 5 Sekunden -> globale Warteschlange + Zwischenspeicher.
const newsImgCache = new Map(); // id -> { at, bilder }
let gdeltQueue = Promise.resolve();
let lastGdelt = 0;

function queueGdelt(fn) {
  const run = gdeltQueue.then(async () => {
    const wait = 5200 - (Date.now() - lastGdelt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastGdelt = Date.now();
    return fn();
  });
  gdeltQueue = run.catch(() => {});
  return run;
}

export async function getNewsImages(country) {
  const cached = newsImgCache.get(country.id);
  if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.bilder;
  const bilder = await queueGdelt(async () => {
    const q = encodeURIComponent(country.name);
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&format=json&maxrecords=18&sort=datedesc`;
    const res = await fetch(url, { headers: { "User-Agent": "F.R.Ai.D.A.Y/1.0" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`GDELT ${res.status}`);
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { return []; }
    return (data.articles || [])
      .filter((a) => a.socialimage)
      .map((a) => ({ bild: a.socialimage, titel: a.title || "", quelle: a.domain || "", seite: a.url || "", zeit: a.seendate || "" }))
      .slice(0, 12);
  }).catch(() => []);
  newsImgCache.set(country.id, { at: Date.now(), bilder });
  return bilder;
}

// --- Bilder und öffentliche Kameras pro Land (alles frei zugänglich) ---
const mediaCache = new Map(); // id -> { at, fotos }

async function fetchFotos(country) {
  try {
    const q = encodeURIComponent((country.en || country.name) + " landmark city");
    const res = await fetch(`https://api.openverse.org/v1/images/?q=${q}&page_size=9&mature=false&license_type=all`, {
      headers: { "User-Agent": "F.R.Ai.D.A.Y/1.0" }, signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r) => ({
      bild: r.thumbnail || r.url,
      quelle: r.source || r.provider || "",
      autor: r.creator || "",
      seite: r.foreign_landing_url || r.url || "",
      titel: r.title || country.name,
    })).filter((f) => f.bild).slice(0, 9);
  } catch { return []; }
}

export async function getMedia(country) {
  const cached = mediaCache.get(country.id);
  // Bilder und Video parallel holen, damit es schnell geht.
  const [fotos, videoId] = await Promise.all([
    cached && Date.now() - cached.at < 6 * 60 * 60 * 1000 ? cached.fotos : fetchFotos(country),
    getVideoId(country),
  ]);
  mediaCache.set(country.id, { at: Date.now(), fotos });
  return withLinks(country, fotos, videoId);
}

// Erstes passendes (Live-)Video von YouTube suchen – serverseitig, ohne Schlüssel.
const videoCache = new Map();
async function getVideoId(country) {
  const cached = videoCache.get(country.id);
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.id;
  let id = null;
  try {
    const q = encodeURIComponent((country.en || country.name) + " news live");
    // sp=EgJAAQ%3D%3D = Filter "Live"
    const url = `https://www.youtube.com/results?search_query=${q}&sp=EgJAAQ%253D%253D`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/537.36 Chrome/120 Safari/537.36", "Accept-Language": "de,en" }, signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const html = await res.text();
      id = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/)?.[1] || null;
    }
  } catch { /* Video optional */ }
  videoCache.set(country.id, { at: Date.now(), id });
  return id;
}

function withLinks(country, fotos, videoId) {
  const { lat, lon, name } = country;
  return {
    fotos,
    video: videoId || null,
    // Öffentliche Live-Kameras und Videos: Links auf frei zugängliche Dienste.
    kameras: `https://www.windy.com/-Webcams/webcams?${lat},${lon},6`,
    videos: `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " live cam")}`,
    nachrichten_videos: `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " nachrichten heute")}`,
  };
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
