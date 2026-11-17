// Länder-Info: "Friday, zeig mir USA" / "Erzähl mir was über Japan" öffnet ein Fenster mit
// Flagge, Fotos, Steckbrief, Karte, Wikipedia-Kurztext und Schlagzeilen – Friday liest das
// Wichtigste vor. Läuft komplett OHNE Claude (nur freie Quellen), klappt also auch bei leerem Guthaben.
import { COUNTRIES, findCountry, getCountryInfo, getCountryNews, fetchFotos } from "./lagezentrum.js";
import { getWiki } from "./extras.js";

// Zusätzliche Namen, die man so sagt
const EXTRA = {
  "vereinigte staaten von amerika": "840", "die staaten": "840", "states": "840", "u s a": "840",
  "schottland": "826", "wales": "826", "britannien": "826", "great britain": "826",
  "emirate": "784", "vae": "784", "arabische emirate": "784",
  "niederlande": "528", "tschechei": "203", "weißrussland": "112", "weissrussland": "112",
  "elfenbeinküste": "384", "burma": "104", "persien": "364",
  "suedkorea": "410", "nordkorea": "408", "tuerkei": "792", "oesterreich": "040", "österreich": "040",
};

const REGION_DE = { Africa: "Afrika", Americas: "Amerika", Asia: "Asien", Europe: "Europa", Oceania: "Ozeanien", Antarctic: "Antarktis" };

function vorbereiten(text) {
  let t = String(text || "").toLowerCase()
    .replace(/[„“”"'!?¿¡;.,:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  t = t.replace(/^(hey |hallo |hi |ok |okay )?(friday|freitag|fraiday)( |$)/, "").trim();
  t = t.replace(/^(bitte |kannst du (mir |uns )?(bitte )?|könntest du (mir |uns )?(bitte )?|koenntest du (mir )?(bitte )?)/, "").trim();
  t = t.replace(/ (bitte|mal|an|auf)$/, "").trim();
  return t;
}

const ART = "(?:der |die |das |den |dem )?";
const MUSTER = [
  // "zeig mir USA", "zeig mir mal das Land Japan", "zeig mir Infos zu Frankreich"
  new RegExp(`^(?:zeig|zeige|zeigst)(?: du)?(?: mir| uns)?(?: mal)?(?: bitte)? (?:infos? (?:zu|über|ueber|von) |informationen (?:zu|über|ueber|von) |(?:den )?steckbrief (?:von|zu|für) |das land |den staat )?${ART}(.{2,40}?)(?: zeigen| an)?$`),
  // "erzähl mir was über die USA", "sag mir etwas über Japan"
  new RegExp(`^(?:erzähl|erzähle|erzaehl|erzaehle|sag)(?: mir| uns)?(?: mal)?(?: bitte)?(?: etwas| was| mehr| alles| ein bisschen| ein wenig| bisschen)? (?:über|ueber|von|zu) (?:das land |den staat )?${ART}(.{2,40})$`),
  // "was weißt du über Kanada"
  new RegExp(`^was (?:weißt|weisst|weist) du (?:über|ueber|von) ${ART}(.{2,40})$`),
  // "Infos zu Brasilien", "Steckbrief Italien", "Länderinfo Spanien"
  new RegExp(`^(?:infos?|informationen|steckbrief|länderinfo|laenderinfo|land|länder info) (?:zu |über |ueber |von |für |fuer )?${ART}(.{2,40})$`),
  // "öffne Länderinfo Mexiko", "öffne das Land Indien"
  new RegExp(`^(?:öffne|oeffne)(?: mir)? (?:das |die |den )?(?:land|länderinfo|laenderinfo|länder info|steckbrief|länderfenster)(?:fenster)? (?:zu |von |für |fuer |über |ueber )?${ART}(.{2,40})$`),
];

// Nur sichere Treffer: genauer Name, englischer Name, bekannte Abkürzung – kein Raten.
export function findeLand(name) {
  const roh = String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
  const kandidaten = [roh, roh.replace(/s$/, ""), roh.replace(/^(die|das|den|der) /, "")];
  for (const k of kandidaten) {
    if (k.length < 2) continue;
    if (EXTRA[k]) return findCountry(EXTRA[k]);
    const en = COUNTRIES.find((c) => c.en.toLowerCase() === k);
    if (en) return en;
    const c = findCountry(k);
    if (!c) continue;
    const n = c.name.toLowerCase();
    if (n === k) return c;
    if (!n.includes(k)) return c; // über Abkürzung gefunden (USA, UK, Holland …)
    if (k.length >= 5 && n.startsWith(k) && n.length - k.length <= 4) return c; // "Deutschl…"
  }
  return null;
}

export function erkenneLandWunsch(text) {
  const t = vorbereiten(text);
  if (!t || t.length > 80) return null;
  for (const re of MUSTER) {
    const m = t.match(re);
    if (m) {
      const c = findeLand(m[1]);
      if (c) return c;
    }
  }
  return null;
}

// --- Daten für das Fenster ---
const cache = new Map(); // id -> { at, data }
const sauber = (s) => String(s || "")
  .replace(/\s*\[[^\]]*\]/g, "")
  .replace(/\s*\([^()]*\)/g, "")
  .replace(/\s*\([^()]*\)/g, "")
  .replace(/\s+([,.])/g, "$1")
  .replace(/\s+/g, " ")
  .trim();

async function wikiZu(country) {
  for (const titel of [country.name, `${country.name} (Staat)`]) {
    const r = await getWiki(titel).catch(() => ({ error: true }));
    if (!r.error && r.zusammenfassung) return r;
  }
  return null;
}

function waehrungName(code) {
  try { return new Intl.DisplayNames(["de"], { type: "currency" }).of(code) || code; } catch { return code; }
}

export function einwohnerText(n) {
  if (!n) return "";
  if (n >= 1e9) return `${(n / 1e9).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Milliarden`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("de-DE", { maximumFractionDigits: n >= 1e7 ? 0 : 1 })} Millionen`;
  if (n >= 1e4) return `${Math.round(n / 1000).toLocaleString("de-DE")} Tausend`;
  return n.toLocaleString("de-DE");
}

export async function getLandInfo(country) {
  const hit = cache.get(country.id);
  if (hit && Date.now() - hit.at < 6 * 60 * 60 * 1000) return hit.data;
  const [info, wiki, fotos, news] = await Promise.all([
    getCountryInfo(country).catch(() => ({})),
    wikiZu(country),
    fetchFotos(country).catch(() => []),
    getCountryNews(country).catch(() => ({ items: [] })),
  ]);
  const text = sauber(wiki?.zusammenfassung || "");
  const data = {
    id: country.id,
    name: country.name,
    flagge: country.flag || "",
    flaggeBild: country.cca2 ? `https://flagcdn.com/w320/${country.cca2.toLowerCase()}.png` : "",
    hauptstadt: country.cap || "",
    region: REGION_DE[country.region] || country.region || "",
    waehrung: country.cur ? `${waehrungName(country.cur)} (${country.cur})` : "",
    einwohner: info.einwohner || null,
    einwohnerText: einwohnerText(info.einwohner),
    luft: info.luft?.bewertung || "",
    lat: country.lat, lon: country.lon,
    wiki: wiki ? { titel: wiki.titel, text, bild: wiki.bild || "", link: wiki.link || "" } : null,
    fotos: (fotos || []).slice(0, 6),
    meldungen: (news.items || []).slice(0, 4).map((n) => ({ titel: n.title, quelle: n.source, link: n.link })),
  };
  cache.set(country.id, { at: Date.now(), data });
  return data;
}

// Gesprochener Text: kurz und natürlich
export function sprechText(d) {
  const teile = [];
  const fakten = [];
  if (d.hauptstadt) fakten.push(`Hauptstadt ist ${d.hauptstadt}`);
  if (d.einwohnerText) fakten.push(`rund ${d.einwohnerText} Menschen leben dort`);
  if (d.waehrung) fakten.push(`bezahlt wird mit ${d.waehrung.replace(/\s*\([A-Z]{3}\)$/, "")}`);
  teile.push(`${d.name} auf einen Blick.`);
  if (fakten.length) teile.push(fakten.join(", ").replace(/^./, (x) => x.toUpperCase()) + ".");
  if (d.wiki?.text) {
    const saetze = d.wiki.text.match(/[^.!?]+(?:[.!?]+|$)/g) || [];
    // Erster Satz ist meist die Definition, der zweite die spannende Info
    teile.push(saetze.slice(0, 2).map((s) => s.trim()).join(" "));
  }
  return teile.join(" ").replace(/\s+/g, " ").trim().slice(0, 700);
}

// Schnellbefehl für brain.js
export async function quickCommand(text) {
  const country = erkenneLandWunsch(text);
  if (!country) return null;
  try {
    const d = await getLandInfo(country);
    return { answer: sprechText(d), actions: ["land_info", `land:${country.id}`] };
  } catch {
    return { answer: `${country.name}: Die Details konnte ich gerade nicht laden.`, actions: ["land_info", `land:${country.id}`] };
  }
}
