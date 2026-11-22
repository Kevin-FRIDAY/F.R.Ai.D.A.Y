// Live-Sport (v1.145.0, zuerst nur in Eve): "Friday, zeig mir das Live-Spiel", "Wie steht es bei Bayern?",
// "Bundesliga live", "Analysiere das Spiel Deutschland gegen Frankreich".
// Spielstände, Ereignisse (Tore, Karten, Körbe …), Statistik und Live-Ticker kommen aus FREIEN, öffentlichen
// Quellen (ESPN-Spielstand-Schnittstelle ohne Schlüssel, TheSportsDB für Handball, Volleyball, Darts …).
// Friday analysiert den bisherigen Verlauf (Claude, falls Guthaben da ist, sonst eigene Regeln).
// Das Live-BILD gibt es nur beim Rechteinhaber: Friday sagt ehrlich, wo das Spiel legal läuft
// (ARD/ZDF kostenlos, sonst Bezahldienst-App) – keine illegalen Streams.
import { config, IST_EVE } from "./config.js";
import { istFrei } from "./eve.js";
import { denke } from "./denker.js";
import { youtubeSuche } from "./appzentrale.js";

export const FUNKTION_ID = "live-sport";
export const frei = () => IST_EVE || istFrei(FUNKTION_ID);
const boss = () => config.userName || "Boss";
const GESPERRT = "Live-Sport ist noch im Test. Probier es in Eve aus und gib es dort frei.";

// Für Tests lassen sich die Quellen umbiegen (z. B. auf einen lokalen Probe-Server).
const ESPN = (process.env.SPORT_ESPN_BASIS || "https://site.api.espn.com").replace(/\/$/, "");
const TSDB = (process.env.SPORT_TSDB_BASIS || "https://www.thesportsdb.com").replace(/\/$/, "");

// ---------- Wo läuft es legal (Deutschland, Stand Ende 2026 – Rechte ändern sich) ----------
const SENDER = {
  ard: { name: "ARD / Sportschau", url: "https://www.sportschau.de/live-und-ergebnisse", gratis: true },
  zdf: { name: "ZDF Sport", url: "https://www.zdf.de/sport", gratis: true },
  magenta: { name: "MagentaTV", url: "https://www.telekom.de/magenta-tv" },
  sky: { name: "Sky / WOW", url: "https://www.sky.de/sport" },
  dazn: { name: "DAZN", url: "https://www.dazn.com/de-DE" },
  prime: { name: "Prime Video", url: "https://www.amazon.de/primevideo" },
  rtl: { name: "RTL+", url: "https://plus.rtl.de/sport" },
  sport1: { name: "Sport1", url: "https://www.sport1.de/tv", gratis: true },
  eurosport: { name: "Eurosport / discovery+", url: "https://www.eurosport.de" },
  f1tv: { name: "F1 TV (offiziell)", url: "https://f1tv.formula1.com" },
  nba: { name: "NBA League Pass (offiziell)", url: "https://www.nba.com/watch/league-pass-stream" },
  nfl: { name: "NFL+ / Game Pass bei DAZN", url: "https://www.dazn.com/de-DE/competition/Competition:wy3kluvb4efae1of0d8146c1" },
  nhl: { name: "NHL (offizielle App)", url: "https://www.nhl.com/info/nhl-tv" },
  mlb: { name: "MLB.TV (offiziell)", url: "https://www.mlb.com/live-stream-games" },
  ufc: { name: "UFC Fight Pass (offiziell)", url: "https://ufcfightpass.com" },
  pga: { name: "PGA Tour (offiziell)", url: "https://www.pgatour.com/watch" },
  dyn: { name: "Dyn (Handball, Volleyball …)", url: "https://www.dyn.sport" },
  twitch: { name: "Offizielle Turnier-Streams (Twitch/YouTube)", url: "https://www.twitch.tv/directory/category/esports", gratis: true },
};

// ---------- Alle Sportarten & Ligen ----------
// pfad = ESPN "sport/liga"; tsdb = Sportart bei TheSportsDB (nur Ergebnisse & Termine, kein Ticker)
export const SPORTARTEN = [
  { id: "fussball", name: "Fußball", symbol: "⚽" },
  { id: "football", name: "American Football", symbol: "🏈" },
  { id: "basketball", name: "Basketball", symbol: "🏀" },
  { id: "eishockey", name: "Eishockey", symbol: "🏒" },
  { id: "baseball", name: "Baseball", symbol: "⚾" },
  { id: "tennis", name: "Tennis", symbol: "🎾" },
  { id: "motorsport", name: "Motorsport", symbol: "🏎️" },
  { id: "golf", name: "Golf", symbol: "⛳" },
  { id: "kampfsport", name: "Kampfsport", symbol: "🥊" },
  { id: "rugby", name: "Rugby", symbol: "🏉" },
  { id: "handball", name: "Handball", symbol: "🤾" },
  { id: "volleyball", name: "Volleyball", symbol: "🏐" },
  { id: "darts", name: "Darts", symbol: "🎯" },
  { id: "radsport", name: "Radsport", symbol: "🚴" },
  { id: "esport", name: "E-Sport", symbol: "🎮" },
];

export const LIGEN = [
  // Fußball
  { id: "fifa.world", sport: "fussball", name: "Fußball-WM", pfad: "soccer/fifa.world", wo: ["magenta", "ard", "zdf"], worte: ["wm", "weltmeisterschaft", "fussball wm", "fußball wm", "world cup"] },
  { id: "uefa.euro", sport: "fussball", name: "Fußball-EM", pfad: "soccer/uefa.euro", wo: ["ard", "zdf", "magenta"], worte: ["em", "europameisterschaft", "euro"] },
  { id: "ger.1", sport: "fussball", name: "Bundesliga", pfad: "soccer/ger.1", wo: ["sky", "dazn"], hinweis: "Kostenlose Zusammenfassungen in der ARD-Sportschau.", worte: ["bundesliga", "1 bundesliga", "erste liga"] },
  { id: "ger.2", sport: "fussball", name: "2. Bundesliga", pfad: "soccer/ger.2", wo: ["sky"], worte: ["2 bundesliga", "zweite bundesliga", "zweite liga", "2 liga"] },
  { id: "ger.dfb_pokal", sport: "fussball", name: "DFB-Pokal", pfad: "soccer/ger.dfb_pokal", wo: ["sky", "ard", "zdf"], worte: ["dfb pokal", "pokal"] },
  { id: "uefa.champions", sport: "fussball", name: "Champions League", pfad: "soccer/uefa.champions", wo: ["dazn", "prime"], worte: ["champions league", "championsleague", "cl", "königsklasse", "koenigsklasse"] },
  { id: "uefa.europa", sport: "fussball", name: "Europa League", pfad: "soccer/uefa.europa", wo: ["rtl"], worte: ["europa league", "europaleague"] },
  { id: "uefa.europa.conf", sport: "fussball", name: "Conference League", pfad: "soccer/uefa.europa.conf", wo: ["rtl"], worte: ["conference league"] },
  { id: "uefa.nations", sport: "fussball", name: "Nations League", pfad: "soccer/uefa.nations", wo: ["ard", "zdf", "rtl"], worte: ["nations league"] },
  { id: "fifa.worldq.uefa", sport: "fussball", name: "WM-Qualifikation", pfad: "soccer/fifa.worldq.uefa", wo: ["rtl", "ard", "zdf"], worte: ["wm quali", "wm qualifikation", "qualifikation"] },
  { id: "fifa.friendly", sport: "fussball", name: "Länderspiele", pfad: "soccer/fifa.friendly", wo: ["ard", "zdf", "rtl"], worte: ["länderspiel", "laenderspiel", "freundschaftsspiel", "nationalmannschaft"] },
  { id: "fifa.wwc", sport: "fussball", name: "Frauen-WM", pfad: "soccer/fifa.wwc", wo: ["ard", "zdf"], worte: ["frauen wm", "frauen weltmeisterschaft"] },
  { id: "eng.1", sport: "fussball", name: "Premier League", pfad: "soccer/eng.1", wo: ["sky"], worte: ["premier league", "england liga"] },
  { id: "esp.1", sport: "fussball", name: "LaLiga", pfad: "soccer/esp.1", wo: ["dazn"], worte: ["la liga", "laliga", "spanische liga"] },
  { id: "ita.1", sport: "fussball", name: "Serie A", pfad: "soccer/ita.1", wo: ["dazn"], worte: ["serie a", "italienische liga"] },
  { id: "fra.1", sport: "fussball", name: "Ligue 1", pfad: "soccer/fra.1", wo: ["dazn"], worte: ["ligue 1", "französische liga", "franzoesische liga"] },
  { id: "ned.1", sport: "fussball", name: "Eredivisie", pfad: "soccer/ned.1", wo: ["dazn"], worte: ["eredivisie"] },
  { id: "tur.1", sport: "fussball", name: "Süper Lig", pfad: "soccer/tur.1", wo: ["dazn"], worte: ["süper lig", "super lig", "türkische liga"] },
  { id: "usa.1", sport: "fussball", name: "MLS", pfad: "soccer/usa.1", wo: [], worte: ["mls"] },
  // US-Sport
  { id: "nfl", sport: "football", name: "NFL", pfad: "football/nfl", wo: ["rtl", "nfl"], worte: ["nfl", "super bowl", "superbowl", "american football", "football"] },
  { id: "college-football", sport: "football", name: "College Football", pfad: "football/college-football", wo: [], worte: ["college football"] },
  { id: "nba", sport: "basketball", name: "NBA", pfad: "basketball/nba", wo: ["nba", "prime"], worte: ["nba", "basketball"] },
  { id: "wnba", sport: "basketball", name: "WNBA", pfad: "basketball/wnba", wo: ["nba"], worte: ["wnba"] },
  { id: "nhl", sport: "eishockey", name: "NHL", pfad: "hockey/nhl", wo: ["sky", "nhl"], worte: ["nhl", "eishockey"] },
  { id: "mlb", sport: "baseball", name: "MLB", pfad: "baseball/mlb", wo: ["mlb"], worte: ["mlb", "baseball"] },
  // Einzelsport
  { id: "atp", sport: "tennis", name: "Tennis ATP", pfad: "tennis/atp", wo: ["sky", "eurosport"], worte: ["tennis", "atp"] },
  { id: "wta", sport: "tennis", name: "Tennis WTA", pfad: "tennis/wta", wo: ["eurosport", "prime"], worte: ["wta", "damen tennis"] },
  { id: "f1", sport: "motorsport", name: "Formel 1", pfad: "racing/f1", art: "rennen", wo: ["sky", "f1tv"], worte: ["formel 1", "formel eins", "f1", "grand prix", "rennen"] },
  { id: "pga", sport: "golf", name: "Golf PGA Tour", pfad: "golf/pga", art: "rennen", wo: ["sky", "pga"], worte: ["golf", "pga"] },
  { id: "ufc", sport: "kampfsport", name: "UFC", pfad: "mma/ufc", wo: ["ufc", "dazn"], worte: ["ufc", "mma", "kampfsport"] },
  { id: "six-nations", sport: "rugby", name: "Six Nations", pfad: "rugby/180659", wo: ["sport1"], worte: ["rugby", "six nations"] },
  // Weitere Sportarten: Ergebnisse & Termine (TheSportsDB, kein Live-Ticker)
  { id: "handball", sport: "handball", name: "Handball", tsdb: "Handball", wo: ["dyn", "ard", "zdf"], worte: ["handball"] },
  { id: "volleyball", sport: "volleyball", name: "Volleyball", tsdb: "Volleyball", wo: ["dyn"], worte: ["volleyball"] },
  { id: "darts", sport: "darts", name: "Darts", tsdb: "Darts", wo: ["sport1", "dazn"], worte: ["darts", "dart"] },
  { id: "radsport", sport: "radsport", name: "Radsport", tsdb: "Cycling", art: "rennen", wo: ["eurosport", "ard"], worte: ["radsport", "radrennen", "tour de france"] },
  { id: "esport", sport: "esport", name: "E-Sport", tsdb: "Esports", wo: ["twitch"], worte: ["esport", "e sport", "e-sport"] },
];
const LIGA = new Map(LIGEN.map((l) => [l.id, l]));
// Diese Ligen durchsucht Friday, wenn kein Wettbewerb genannt wurde (Reihenfolge = Wichtigkeit).
const HAUPT = ["fifa.world", "uefa.euro", "ger.1", "uefa.champions", "ger.dfb_pokal", "uefa.nations", "fifa.worldq.uefa", "fifa.friendly", "ger.2", "uefa.europa", "uefa.europa.conf", "eng.1", "esp.1", "ita.1", "fra.1", "nfl", "nba", "nhl", "mlb", "f1", "atp", "wta"];

// ---------- Holen mit Zwischenspeicher ----------
const cache = new Map(); // url -> { at, ttl, data }
async function holen(url, ttl = 30000) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.data;
  const r = await fetch(url, { headers: { "User-Agent": "Friday-Assistent/1.0", Accept: "application/json" }, signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`Quelle antwortet mit ${r.status}`);
  const data = await r.json();
  cache.set(url, { at: Date.now(), ttl, data });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return data;
}

// ---------- Hilfen ----------
export const flach = (s) => String(s || "").toLowerCase()
  .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const datumTag = (versatz = 0) => {
  const d = new Date(Date.now() + versatz * 86400000);
  const s = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); // JJJJ-MM-TT
  return s;
};
const uhrzeit = (iso) => { try { return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }); } catch { return ""; } };
const tagText = (iso) => {
  try {
    const t = new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    if (t === datumTag(0)) return "heute";
    if (t === datumTag(1)) return "morgen";
    if (t === datumTag(-1)) return "gestern";
    return new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
  } catch { return ""; }
};
const zahl = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };

// Deutsche Namen → wie sie in den Quellen stehen (für "wie steht es bei Deutschland?")
const ALIAS = {
  deutschland: ["germany"], frankreich: ["france"], spanien: ["spain"], italien: ["italy"], england: ["england"],
  niederlande: ["netherlands"], holland: ["netherlands"], osterreich: ["austria"], schweiz: ["switzerland"], belgien: ["belgium"],
  kroatien: ["croatia"], danemark: ["denmark"], polen: ["poland"], turkei: ["turkiye", "turkey"], tschechien: ["czechia", "czech republic"],
  schottland: ["scotland"], ungarn: ["hungary"], serbien: ["serbia"], ukraine: ["ukraine"], schweden: ["sweden"], norwegen: ["norway"],
  brasilien: ["brazil"], argentinien: ["argentina"], mexiko: ["mexico"], kanada: ["canada"], usa: ["united states", "usa"], amerika: ["united states"],
  japan: ["japan"], sudkorea: ["south korea", "korea republic"], marokko: ["morocco"], agypten: ["egypt"], senegal: ["senegal"], portugal: ["portugal"],
  bayern: ["bayern munich", "bayern"], munchen: ["bayern munich", "munich"], dortmund: ["dortmund"], bvb: ["dortmund"], leverkusen: ["leverkusen"],
  koln: ["koln", "cologne"], gladbach: ["monchengladbach"], monchengladbach: ["monchengladbach"], frankfurt: ["frankfurt"], stuttgart: ["stuttgart"],
  bremen: ["bremen"], werder: ["bremen"], wolfsburg: ["wolfsburg"], freiburg: ["freiburg"], leipzig: ["leipzig"], union: ["union berlin"],
  hertha: ["hertha"], hoffenheim: ["hoffenheim"], mainz: ["mainz"], augsburg: ["augsburg"], heidenheim: ["heidenheim"], bochum: ["bochum"],
  hamburg: ["hamburg"], hsv: ["hamburg"], schalke: ["schalke"], pauli: ["st pauli"], nurnberg: ["nurnberg", "nuremberg"], dusseldorf: ["dusseldorf"],
  furth: ["furth"], hannover: ["hannover"], kaiserslautern: ["kaiserslautern"], karlsruhe: ["karlsruhe"], paderborn: ["paderborn"],
  real: ["real madrid"], barca: ["barcelona"], barcelona: ["barcelona"], madrid: ["madrid"], juve: ["juventus"], mailand: ["milan"], inter: ["internazionale", "inter"],
  paris: ["paris saint germain"], psg: ["paris saint germain"], liverpool: ["liverpool"], arsenal: ["arsenal"], chelsea: ["chelsea"], manchester: ["manchester"],
};
const STOPP = new Set(["live", "spiel", "spiele", "zeig", "zeige", "mir", "das", "die", "der", "den", "dem", "von", "gegen", "und", "steht", "wie", "bei", "beim", "heute", "gerade", "jetzt", "analyse", "analysiere", "ergebnis", "stand", "fussball", "friday", "bitte", "mal", "was", "wer", "fuhrt", "gewinnt", "club", "city", "united", "sport", "verein", "borussia", "eintracht", "real", "inter", "team", "tennis", "rennen", "match", "partie"]);

function teamSchluessel(t) {
  const roh = [t.name, t.quelleName, t.kurzname, t.ort].filter(Boolean).map(flach);
  const worte = new Set();
  for (const r of roh) for (const w of r.split(" ")) if (w.length >= 4 && !STOPP.has(w)) worte.add(w);
  if (t.kurz && t.kurz.length >= 2) worte.add(flach(t.kurz));
  return { voll: roh, worte };
}

/** Wie gut passt der gesagte Text zu einer Mannschaft? 0 = gar nicht */
function passt(textFlach, team) {
  if (!team?.name) return 0;
  const { voll, worte } = teamSchluessel(team);
  let p = 0;
  const textWorte = new Set(textFlach.split(" "));
  for (const v of voll) if (v.length >= 4 && textFlach.includes(v)) p += 3;
  for (const w of worte) if (textWorte.has(w)) p += w.length >= 4 ? 2 : 1;
  for (const [de, ziele] of Object.entries(ALIAS)) {
    if (!textWorte.has(de)) continue;
    if (ziele.some((z) => voll.some((v) => v.includes(z)))) p += 3;
  }
  return p;
}

// ---------- Spiele normalisieren (ESPN) ----------
const STATUS_DE = [
  [/^halftime$|^ht$/i, "Halbzeit"], [/^ft$|^full ?time$/i, "Abpfiff"], [/^final$/i, "Endstand"], [/^final\/ot$/i, "Endstand n. V."],
  [/^aet$/i, "Ende n. V."], [/^ft-pens$|penalties/i, "Ende n. E."], [/postponed/i, "Verlegt"], [/canceled|cancelled/i, "Abgesagt"],
  [/delayed/i, "Verzögert"], [/end of (\d)(?:st|nd|rd|th) quarter/i, "Ende $1. Viertel"], [/end of (\d)(?:st|nd|rd|th) period/i, "Ende $1. Drittel"],
  [/^(\d)(?:st|nd|rd|th) quarter$/i, "$1. Viertel"], [/^(\d)(?:st|nd|rd|th) period$/i, "$1. Drittel"], [/^overtime$|^ot$/i, "Verlängerung"],
  [/^in progress$/i, "läuft"], [/^1h$/i, "1. Halbzeit"], [/^2h$/i, "2. Halbzeit"], [/^first half$/i, "1. Halbzeit"], [/^second half$/i, "2. Halbzeit"], [/^extra time$/i, "Verlängerung"],
];
function statusDeutsch(s) {
  let t = String(s || "").trim();
  for (const [re, de] of STATUS_DE) if (re.test(t)) return t.replace(re, de);
  t = t.replace(/(\d)(?:st|nd|rd|th) Quarter/i, "$1. Viertel").replace(/(\d)(?:st|nd|rd|th) Period/i, "$1. Drittel").replace(/(\d)(?:st|nd|rd|th) Half/i, "$1. Halbzeit")
    .replace(/(Top|Bot|Bottom|Mid|End) (\d+)(?:st|nd|rd|th)/i, (m, a, n) => `${/top/i.test(a) ? "Anfang" : /mid/i.test(a) ? "Mitte" : "Ende"} ${n}. Inning`)
    .replace(/\bLap (\d+)/i, "Runde $1").replace(/\bRound (\d+)/i, "Runde $1").replace(/ - /g, " · ");
  return t.replace(/\bQ(\d)\b/, "$1. Viertel").replace(/\bP(\d)\b/, "$1. Drittel").replace(/\bOT\b/, "Verl.").replace(/\bHalf\b/i, "Halbzeit");
}
const scoreText = (c) => {
  const s = c?.score;
  if (s == null) return "";
  if (typeof s === "object") return String(s.displayValue ?? s.value ?? "");
  return String(s);
};
// Anzeige-Namen auf Deutsch (die Quellen liefern Englisch)
const NAME_DE = {
  "Bayern Munich": "Bayern München", "FC Cologne": "1. FC Köln", "Cologne": "Köln", "Germany": "Deutschland", "France": "Frankreich", "Spain": "Spanien",
  "Italy": "Italien", "Netherlands": "Niederlande", "Austria": "Österreich", "Switzerland": "Schweiz", "Belgium": "Belgien", "Croatia": "Kroatien",
  "Denmark": "Dänemark", "Poland": "Polen", "Türkiye": "Türkei", "Turkey": "Türkei", "Czechia": "Tschechien", "Scotland": "Schottland", "Hungary": "Ungarn",
  "Serbia": "Serbien", "Sweden": "Schweden", "Norway": "Norwegen", "Brazil": "Brasilien", "Argentina": "Argentinien", "Mexico": "Mexiko", "Canada": "Kanada",
  "United States": "USA", "South Korea": "Südkorea", "Morocco": "Marokko", "Egypt": "Ägypten", "Inter Milan": "Inter Mailand", "AC Milan": "AC Mailand",
};
const deName = (n) => NAME_DE[n] || n;
function teamAus(c) {
  const t = c?.team || {};
  const a = c?.athlete || (c?.athletes || [])[0]?.athlete || (c?.athletes || [])[0] || {};
  const name = t.displayName || a.displayName || c?.displayName || t.name || "";
  return {
    id: String(t.id || a.id || c?.id || ""),
    name: deName(name),
    quelleName: name,
    kurzname: deName(t.shortDisplayName || a.shortName || ""),
    kurz: t.abbreviation || (a.shortName || name).slice(0, 3).toUpperCase(),
    ort: t.location || "",
    logo: t.logo || t.logos?.[0]?.href || a.flag?.href || a.headshot?.href || "",
    farbe: t.color ? `#${String(t.color).replace(/^#/, "")}` : "",
    punkte: scoreText(c),
    saetze: (c?.linescores || []).map((l) => l.displayValue ?? l.value).filter((v) => v != null && v !== "").map(String),
    sieger: Boolean(c?.winner),
  };
}
const ART_DE = (t) => {
  const s = String(t || "").toLowerCase();
  if (/own goal/.test(s)) return { typ: "tor", text: "Eigentor" };
  if (/penalty.*(goal|scored)|goal.*penalty/.test(s)) return { typ: "tor", text: "Tor (Elfmeter)" };
  if (/missed penalty|penalty.*(missed|saved)/.test(s)) return { typ: "chance", text: "Elfmeter verschossen" };
  if (/goal/.test(s)) return { typ: "tor", text: "Tor" };
  if (/red card|second yellow/.test(s)) return { typ: "rot", text: "Rote Karte" };
  if (/yellow card/.test(s)) return { typ: "gelb", text: "Gelbe Karte" };
  if (/substitution/.test(s)) return { typ: "wechsel", text: "Wechsel" };
  if (/var/.test(s)) return { typ: "var", text: "Videobeweis" };
  if (/touchdown/.test(s)) return { typ: "tor", text: "Touchdown" };
  if (/field goal/.test(s)) return { typ: "tor", text: "Field Goal" };
  if (/safety/.test(s)) return { typ: "tor", text: "Safety" };
  if (/home run/.test(s)) return { typ: "tor", text: "Home Run" };
  if (/kickoff|kick off|start/.test(s)) return { typ: "info", text: "Anpfiff" };
  if (/halftime|half time/.test(s)) return { typ: "info", text: "Halbzeit" };
  if (/end|full time/.test(s)) return { typ: "info", text: "Abpfiff" };
  return { typ: "info", text: t || "Ereignis" };
};
const minuteZahl = (m) => { const x = String(m || "").match(/(\d+)(?:'\s*\+\s*(\d+))?/); return x ? Number(x[1]) + (x[2] ? Number(x[2]) / 10 : 0) : null; };

function ereignisAusDetail(d, heimId) {
  const art = d.redCard ? { typ: "rot", text: "Rote Karte" } : d.yellowCard ? { typ: "gelb", text: "Gelbe Karte" } : d.ownGoal ? { typ: "tor", text: "Eigentor" } : d.penaltyKick && d.scoringPlay ? { typ: "tor", text: "Tor (Elfmeter)" } : d.scoringPlay ? { typ: "tor", text: "Tor" } : ART_DE(d.type?.text);
  const team = String(d.team?.id || "");
  return {
    typ: art.typ, art: art.text,
    minute: d.clock?.displayValue || "",
    seite: team ? (team === heimId ? "heim" : "gast") : "",
    spieler: (d.athletesInvolved || []).map((a) => a.displayName || a.shortName).filter(Boolean).join(", "),
    text: "",
  };
}

function normSpiel(ev, comp, liga) {
  const st = comp?.status || ev?.status || {};
  const typ = st.type || {};
  const zustand = typ.state === "in" ? "live" : typ.state === "post" ? "ende" : "vorher";
  const comps = comp?.competitors || [];
  const start = comp?.date || ev?.date || "";
  const basis = {
    id: String(ev?.groupings ? comp?.id || ev?.id || "" : ev?.id || comp?.id || ""),
    eventId: String(ev?.id || ""),
    liga: liga.id, ligaName: liga.name, sport: liga.sport,
    symbol: SPORTARTEN.find((s) => s.id === liga.sport)?.symbol || "🏅",
    titel: ev?.name || "",
    runde: comp?.type?.abbreviation || comp?.round?.displayName || ev?.season?.slug || "",
    zustand,
    statusText: zustand === "vorher" ? `${tagText(start) === "heute" ? "" : `${tagText(start)}, `}${uhrzeit(start)} Uhr` : statusDeutsch(typ.shortDetail || typ.detail || typ.description),
    uhr: st.displayClock || "",
    periode: st.period || 0,
    start,
    ort: [comp?.venue?.fullName, comp?.venue?.address?.city].filter(Boolean).join(", "),
    tvUsa: [...new Set([...(comp?.broadcasts || []).flatMap((b) => b.names || []), ...(comp?.geoBroadcasts || []).map((g) => g.media?.shortName).filter(Boolean)])].slice(0, 4),
    meldung: comp?.headlines?.[0]?.description || comp?.headlines?.[0]?.shortLinkText || "",
    lage: comp?.situation?.downDistanceText || comp?.situation?.lastPlay?.text || "",
  };
  if (comps.length === 2 && liga.art !== "rennen") {
    const h = comps.find((c) => c.homeAway === "home") || comps[0];
    const g = comps.find((c) => c !== h) || comps[1];
    const heim = teamAus(h), gast = teamAus(g);
    const ereignisse = (comp?.details || []).map((d) => ereignisAusDetail(d, heim.id)).filter((e) => e.typ !== "info");
    return { ...basis, art: "duell", heim, gast, ereignisse };
  }
  const feld = comps.map((c) => ({ ...teamAus(c), pos: Number(c.order || c.status?.position?.id || 0) || null }))
    .sort((a, b) => (a.pos ?? 999) - (b.pos ?? 999)).slice(0, 12);
  return { ...basis, art: "feld", titel: comp?.type?.text ? `${ev?.name || liga.name} · ${comp.type.text}` : basis.titel || liga.name, feld, ereignisse: [] };
}

async function espnSpiele(liga, tag) {
  const dates = tag ? `?dates=${tag.replace(/-/g, "")}` : "";
  const d = await holen(`${ESPN}/apis/site/v2/sports/${liga.pfad}/scoreboard${dates}`, 30000);
  const liste = [];
  for (const ev of d.events || []) {
    if (Array.isArray(ev.groupings) && ev.groupings.length) {
      // Tennis: ein Turnier mit vielen Matches
      for (const g of ev.groupings) for (const c of g.competitions || []) {
        const s = normSpiel(ev, c, liga);
        s.titel = `${ev.name || liga.name}${g.grouping?.displayName ? ` · ${g.grouping.displayName}` : ""}`;
        liste.push(s);
      }
    } else if (liga.art === "rennen") {
      const comps = ev.competitions || [];
      // Rennwochenende: die laufende oder letzte Sitzung zeigen
      const c = comps.find((x) => x.status?.type?.state === "in") || [...comps].reverse().find((x) => x.status?.type?.state === "post") || comps[0];
      if (c) liste.push(normSpiel(ev, c, liga));
    } else {
      const c = (ev.competitions || [])[0];
      if (c) liste.push(normSpiel(ev, c, liga));
    }
  }
  return liste;
}

async function tsdbSpiele(liga, tag) {
  const d = await holen(`${TSDB}/api/v1/json/3/eventsday.php?d=${tag || datumTag(0)}&s=${encodeURIComponent(liga.tsdb)}`, 120000);
  return (d.events || []).slice(0, 40).map((e) => {
    const fertig = /finished|^ft$|^aet$|^pen|ended|final/i.test(e.strStatus || "");
    const hatStand = e.intHomeScore != null && e.intHomeScore !== "";
    const laeuft = !fertig && hatStand && !/^ns$|not started/i.test(e.strStatus || "");
    const start = e.strTimestamp ? `${e.strTimestamp}${/z|[+-]\d\d:?\d\d$/i.test(e.strTimestamp) ? "" : "Z"}` : e.dateEvent || "";
    const zustand = laeuft ? "live" : fertig || (hatStand && !e.strStatus) ? "ende" : "vorher";
    const team = (n, logo, p) => ({ id: flach(n), name: n || "", kurzname: n || "", kurz: String(n || "").slice(0, 3).toUpperCase(), ort: "", logo: logo || "", farbe: "", punkte: p == null ? "" : String(p), saetze: [], sieger: false });
    return {
      id: `tsdb-${e.idEvent}`, eventId: String(e.idEvent), liga: liga.id, ligaName: e.strLeague || liga.name, sport: liga.sport,
      symbol: SPORTARTEN.find((s) => s.id === liga.sport)?.symbol || "🏅", titel: e.strEvent || "", runde: e.intRound ? `Runde ${e.intRound}` : "",
      zustand, statusText: zustand === "vorher" ? `${uhrzeit(start)} Uhr` : zustand === "ende" ? "Endstand" : statusDeutsch(e.strStatus || "läuft"),
      uhr: e.strProgress || "", periode: 0, start, ort: e.strVenue || "", tvUsa: [], meldung: "", lage: "",
      art: e.strAwayTeam ? "duell" : "feld",
      heim: team(e.strHomeTeam, e.strHomeTeamBadge, e.intHomeScore), gast: team(e.strAwayTeam, e.strAwayTeamBadge, e.intAwayScore),
      feld: e.strAwayTeam ? undefined : [team(e.strEvent, e.strThumb, "")],
      ereignisse: [], nurErgebnis: true,
    };
  });
}

/** Spiele einer Liga (tag = "JJJJ-MM-TT" oder leer = aktuell). */
export async function spieleDerLiga(ligaId, tag = "") {
  const liga = LIGA.get(ligaId);
  if (!liga) throw new Error("Diese Liga kenne ich nicht.");
  return liga.tsdb ? tsdbSpiele(liga, tag) : espnSpiele(liga, tag);
}

const RANG = { live: 0, vorher: 1, ende: 2 };
/** Mehrere Ligen auf einmal (fehlende Quellen werden still übersprungen). */
async function spieleVieler(ids, tag = "") {
  const r = await Promise.all(ids.map((id) => spieleDerLiga(id, tag).catch(() => [])));
  return r.flat();
}

/** Alles, was gerade läuft (Haupt-Ligen + weitere Sportarten). */
export async function liveJetzt() {
  const alle = await spieleVieler([...HAUPT, "handball", "volleyball", "darts"]);
  return alle.filter((s) => s.zustand === "live");
}

// ---------- Ein Spiel im Detail ----------
const STAT_DE = {
  possessionPct: "Ballbesitz %", totalShots: "Schüsse", shotsOnTarget: "Schüsse aufs Tor", wonCorners: "Ecken", foulsCommitted: "Fouls",
  yellowCards: "Gelbe Karten", redCards: "Rote Karten", offsides: "Abseits", saves: "Paraden", accuratePasses: "Angekommene Pässe", passPct: "Passquote",
  totalPasses: "Pässe", effectiveTackles: "Gewonnene Zweikämpfe", totalTackles: "Zweikämpfe",
  fieldGoalPct: "Wurfquote %", threePointFieldGoalPct: "Dreier-Quote %", freeThrowPct: "Freiwurf-Quote %", totalRebounds: "Rebounds", rebounds: "Rebounds",
  assists: "Assists", turnovers: "Ballverluste", steals: "Steals", blocks: "Blocks", fastBreakPoints: "Fastbreak-Punkte", pointsInPaint: "Punkte in der Zone",
  totalYards: "Raumgewinn (Yards)", netPassingYards: "Pass-Yards", rushingYards: "Lauf-Yards", firstDowns: "First Downs", possessionTime: "Ballbesitzzeit",
  thirdDownEff: "3rd-Down-Quote", interceptions: "Interceptions", sacksYardsLost: "Sacks",
  shotsTotal: "Schüsse", shots: "Schüsse", hits: "Checks", blockedShots: "Geblockte Schüsse", powerPlayGoals: "Überzahl-Tore", faceoffsWon: "Bullys gewonnen", penaltyMinutes: "Strafminuten",
  runs: "Runs", errors: "Fehler", homeRuns: "Home Runs", strikeouts: "Strikeouts",
};
const WICHTIG = ["possessionPct", "totalShots", "shotsOnTarget", "wonCorners", "foulsCommitted", "yellowCards", "redCards", "offsides", "saves", "passPct",
  "fieldGoalPct", "threePointFieldGoalPct", "totalRebounds", "rebounds", "assists", "turnovers", "steals", "totalYards", "netPassingYards", "rushingYards", "firstDowns", "possessionTime",
  "shotsTotal", "shots", "hits", "powerPlayGoals", "faceoffsWon", "penaltyMinutes", "runs", "errors", "homeRuns"];

function statistikAus(sum, heimId) {
  const teams = sum?.boxscore?.teams || [];
  if (teams.length < 2) return [];
  const h = teams.find((t) => String(t.team?.id) === heimId) || teams.find((t) => t.homeAway === "home") || teams[1];
  const g = teams.find((t) => t !== h);
  const m = (t) => new Map((t?.statistics || []).map((s) => [s.name, s]));
  const hm = m(h), gm = m(g);
  const aus = [];
  for (const name of WICHTIG) {
    const a = hm.get(name), b = gm.get(name);
    if (!a || !b) continue;
    if (aus.some((x) => x.label === (STAT_DE[name] || a.label))) continue;
    aus.push({ name, label: STAT_DE[name] || a.label || name, heim: String(a.displayValue ?? ""), gast: String(b.displayValue ?? "") });
    if (aus.length >= 10) break;
  }
  return aus;
}

function ereignisseAus(sum, heim, gast) {
  const heimId = heim.id;
  const seiteVon = (t) => {
    const id = String(t?.id || "");
    if (id) return id === heimId ? "heim" : "gast";
    const n = flach(t?.displayName || "");
    if (!n) return "";
    return n === flach(heim.name) ? "heim" : n === flach(gast.name) ? "gast" : "";
  };
  if (Array.isArray(sum?.keyEvents) && sum.keyEvents.length) {
    return sum.keyEvents.map((k) => {
      const a = k.scoringPlay ? (/own goal/i.test(k.type?.text || "") ? { typ: "tor", text: "Eigentor" } : /penalty/i.test(k.type?.text || "") ? { typ: "tor", text: "Tor (Elfmeter)" } : { typ: "tor", text: "Tor" }) : ART_DE(k.type?.text);
      return { typ: a.typ, art: a.text, minute: k.clock?.displayValue || "", seite: seiteVon(k.team), spieler: (k.participants || []).map((p) => p.athlete?.displayName).filter(Boolean).join(", "), text: String(k.text || "").slice(0, 220) };
    }).filter((e) => !(e.typ === "info" && !e.text));
  }
  const plays = Array.isArray(sum?.scoringPlays) && sum.scoringPlays.length ? sum.scoringPlays : (sum?.plays || []).filter((p) => p.scoringPlay);
  return plays.slice(-25).map((p) => {
    const a = ART_DE(p.type?.text || p.scoringType?.displayName || "Punkte");
    return {
      typ: a.typ === "info" ? "tor" : a.typ, art: a.typ === "info" ? (p.type?.text || "Punkte") : a.text,
      minute: [p.period?.number ? `${p.period.number}.` : "", p.clock?.displayValue || ""].filter(Boolean).join(" · "),
      seite: seiteVon(p.team), spieler: "", text: String(p.text || "").slice(0, 220),
      stand: p.homeScore != null && p.awayScore != null ? `${p.homeScore}:${p.awayScore}` : "",
      heimP: zahl(p.homeScore), gastP: zahl(p.awayScore),
    };
  });
}

function verlaufAus(spiel, ereignisse) {
  // Punkte-Verlauf: aus Zwischenständen (US-Sport) oder aus den Toren mit Minute (Fußball)
  const mitStand = ereignisse.filter((e) => e.heimP != null && e.gastP != null);
  if (mitStand.length >= 2) return mitStand.map((e, i) => ({ x: i + 1, heim: e.heimP, gast: e.gastP, label: e.minute }));
  const tore = ereignisse.filter((e) => e.typ === "tor" && e.seite);
  if (!tore.length) return [];
  let h = 0, g = 0;
  const pkt = [{ x: 0, heim: 0, gast: 0, label: "0'" }];
  for (const t of tore) {
    const eigen = /eigentor/i.test(t.art);
    const fuerHeim = eigen ? t.seite === "gast" : t.seite === "heim";
    // Bei ESPN zählt "team" beim Eigentor schon für die begünstigte Mannschaft: Endstand prüfen wir unten.
    if (fuerHeim) h++; else g++;
    pkt.push({ x: minuteZahl(t.minute) ?? pkt.length * 10, heim: h, gast: g, label: t.minute });
  }
  // Passt die Rechnung nicht zum echten Stand (Eigentor-Zählweise), ohne Eigentor-Tausch neu rechnen
  if (String(h) !== spiel.heim?.punkte || String(g) !== spiel.gast?.punkte) {
    h = 0; g = 0;
    pkt.length = 1;
    for (const t of tore) { if (t.seite === "heim") h++; else g++; pkt.push({ x: minuteZahl(t.minute) ?? pkt.length * 10, heim: h, gast: g, label: t.minute }); }
  }
  return pkt;
}

function kommentarAus(sum) {
  const c = Array.isArray(sum?.commentary) ? sum.commentary : [];
  if (c.length) return c.slice(-10).reverse().map((k) => ({ zeit: k.time?.displayValue || "", text: String(k.text || "").slice(0, 260) })).filter((k) => k.text);
  const p = Array.isArray(sum?.plays) ? sum.plays : [];
  return p.slice(-10).reverse().map((k) => ({ zeit: [k.period?.number ? `${k.period.number}.` : "", k.clock?.displayValue || ""].filter(Boolean).join(" · "), text: String(k.text || "").slice(0, 260) })).filter((k) => k.text);
}

function woSchauen(liga) {
  const l = LIGA.get(liga) || {};
  const sender = (l.wo || []).map((k) => SENDER[k]).filter(Boolean);
  return { sender, hinweis: l.hinweis || "", stand: "Stand Ende 2026, Übertragungsrechte ändern sich." };
}

function suchbegriff(s) {
  if (s.art === "duell") return `${s.heim.name} ${s.gast.name} ${s.ligaName} Highlights`;
  return `${s.titel || s.ligaName} Highlights`;
}

const detailCache = new Map(); // key -> { at, data }
/** Ein Spiel komplett: Stand, Ereignisse, Statistik, Ticker, Verlauf, wo es legal läuft. */
export async function spielDetail(ligaId, id) {
  const liga = LIGA.get(ligaId);
  if (!liga) throw new Error("Diese Liga kenne ich nicht.");
  const key = `${ligaId}/${id}`;
  const hit = detailCache.get(key);
  if (hit && Date.now() - hit.at < (hit.data.zustand === "live" ? 20000 : 120000)) return hit.data;
  let spiel = null;
  // Erst in den heutigen/aktuellen Spielen suchen (geht schnell, liegt meist schon im Speicher)
  for (const tag of ["", datumTag(-1), datumTag(1)]) {
    const liste = await spieleDerLiga(ligaId, tag).catch(() => []);
    spiel = liste.find((s) => s.id === String(id) || s.eventId === String(id));
    if (spiel) break;
  }
  let sum = null;
  if (!liga.tsdb && !liga.art && !String(id).startsWith("tsdb-")) {
    const ev = spiel?.eventId || id;
    sum = await holen(`${ESPN}/apis/site/v2/sports/${liga.pfad}/summary?event=${encodeURIComponent(ev)}`, spiel?.zustand === "live" ? 20000 : 120000).catch(() => null);
    if (!spiel && sum?.header?.competitions?.[0]) spiel = normSpiel({ id: sum.header.id, name: sum.header.name }, sum.header.competitions[0], liga);
    else if (spiel && sum?.header?.competitions?.[0]) {
      // Der Kopf der Detailseite ist oft frischer als die Übersicht
      const frisch = normSpiel({ id: sum.header.id, name: spiel.titel }, sum.header.competitions[0], liga);
      if (frisch.art === "duell" && frisch.heim.punkte !== "") spiel = { ...spiel, heim: { ...spiel.heim, punkte: frisch.heim.punkte }, gast: { ...spiel.gast, punkte: frisch.gast.punkte }, zustand: frisch.zustand, statusText: frisch.statusText || spiel.statusText, uhr: frisch.uhr || spiel.uhr };
    }
  }
  if (!spiel) throw new Error("Das Spiel habe ich nicht gefunden.");
  let ereignisse = spiel.ereignisse || [];
  let statistik = [], kommentar = [], verlauf = [];
  if (sum && spiel.art === "duell") {
    const aus = ereignisseAus(sum, spiel.heim, spiel.gast);
    if (aus.length) ereignisse = aus;
    statistik = statistikAus(sum, spiel.heim.id);
    kommentar = kommentarAus(sum);
    verlauf = verlaufAus(spiel, ereignisse);
  } else if (spiel.art === "duell") verlauf = verlaufAus(spiel, ereignisse);
  const videos = (sum?.videos || []).slice(0, 4).map((v) => ({ titel: v.headline || v.title || "", bild: v.thumbnail || "", url: v.links?.web?.href || v.links?.source?.href || "" })).filter((v) => v.url);
  const data = {
    ...spiel, ereignisse: ereignisse.slice(-40), statistik, kommentar, verlauf,
    wo: woSchauen(ligaId), suche: suchbegriff(spiel), videosQuelle: videos,
    quelle: liga.tsdb ? "TheSportsDB (frei)" : "ESPN-Spielstände (frei)",
  };
  data.regelAnalyse = regelAnalyse(data);
  detailCache.set(key, { at: Date.now(), data });
  if (detailCache.size > 100) detailCache.delete(detailCache.keys().next().value);
  return data;
}

// ---------- Analyse ----------
const sprechStand = (a, b) => `${a} zu ${b}`;
const nameKurz = (t) => t?.kurzname || t?.name || "";

/** Friday analysiert ohne Claude: Stand, Tore, Karten, wer das Spiel macht, Momentum. */
export function regelAnalyse(s) {
  if (s.art !== "duell") {
    const f = s.feld || [];
    if (!f.length) return `${s.titel || s.ligaName}: Noch keine Ergebnisse.`;
    const top = f.slice(0, 3).map((t, i) => `${i + 1}. ${t.name}${t.punkte ? ` (${t.punkte})` : ""}`).join(", ");
    return s.zustand === "vorher" ? `${s.titel || s.ligaName} startet ${s.statusText}.` : `${s.titel || s.ligaName}${s.zustand === "live" ? " läuft gerade" : " ist vorbei"}. Vorne: ${top}.`;
  }
  const H = nameKurz(s.heim), G = nameKurz(s.gast);
  if (s.zustand === "vorher") return `${s.heim.name} gegen ${s.gast.name} beginnt ${s.statusText}${s.ort ? ` in ${s.ort.split(",")[0]}` : ""}.`;
  const h = zahl(s.heim.punkte), g = zahl(s.gast.punkte);
  const saetze = [];
  const zeit = s.zustand === "live" ? (s.statusText ? ` (${s.statusText})` : "") : "";
  if (s.heim.saetze?.length && s.sport === "tennis") {
    const satz = s.heim.saetze.map((x, i) => `${x}:${s.gast.saetze[i] ?? "-"}`).join(", ");
    saetze.push(`${s.heim.name} gegen ${s.gast.name}, Sätze ${satz}${zeit}.`);
  } else if (h == null || g == null) {
    saetze.push(`${s.heim.name} gegen ${s.gast.name}${zeit}.`);
  } else if (h === g) {
    saetze.push(`${s.zustand === "ende" ? "Endstand" : "Es steht"} ${sprechStand(h, g)} zwischen ${s.heim.name} und ${s.gast.name}${zeit}.`);
  } else {
    const vorn = h > g ? s.heim : s.gast, hinten = h > g ? s.gast : s.heim;
    const [a, b] = h > g ? [h, g] : [g, h];
    saetze.push(s.zustand === "ende" ? `${vorn.name} hat ${sprechStand(a, b)} gegen ${hinten.name} gewonnen.` : `${vorn.name} führt ${sprechStand(a, b)} gegen ${hinten.name}${zeit}.`);
    const diff = a - b;
    if (s.sport === "basketball" && s.zustand === "live") saetze.push(diff >= 15 ? "Ein deutlicher Vorsprung." : diff <= 5 ? "Das ist noch völlig offen." : "");
  }
  const tore = (s.ereignisse || []).filter((e) => e.typ === "tor" && s.sport === "fussball");
  if (tore.length) {
    const liste = tore.slice(-6).map((t) => `${t.spieler || (t.seite === "heim" ? H : G)}${t.minute ? ` (${t.minute.replace(/'$/, ".")})` : ""}${/elfmeter/i.test(t.art) ? " per Elfmeter" : /eigentor/i.test(t.art) ? ", Eigentor" : ""}`);
    saetze.push(`Tore: ${liste.join(", ")}.`);
  }
  const rot = (s.ereignisse || []).filter((e) => e.typ === "rot");
  if (rot.length) saetze.push(rot.map((r) => `Rot für ${r.spieler || (r.seite === "heim" ? H : G)}${r.minute ? ` in der ${r.minute.replace(/'$/, ".")} Minute` : ""}`).join(", ") + ".");
  // Wer macht das Spiel?
  const st = new Map((s.statistik || []).map((x) => [x.name, x]));
  const bes = st.get("possessionPct"), aufs = st.get("shotsOnTarget"), sch = st.get("totalShots") || st.get("shotsTotal") || st.get("shots");
  const bH = zahl(bes?.heim), bG = zahl(bes?.gast), aH = zahl(aufs?.heim), aG = zahl(aufs?.gast);
  if (bH != null && bG != null && Math.abs(bH - bG) >= 10) {
    const mehr = bH > bG ? H : G;
    saetze.push(`${mehr} hat mehr vom Spiel: ${Math.round(Math.max(bH, bG))} Prozent Ballbesitz${aH != null && aG != null ? `, ${aH > aG ? aH : aG} zu ${aH > aG ? aG : aH} Schüsse aufs Tor${(aH > aG) === (bH > bG) ? "" : " – aber gefährlicher ist der Gegner"}` : ""}.`);
  } else if (aH != null && aG != null && aH !== aG) {
    saetze.push(`${aH > aG ? H : G} ist gefährlicher: ${Math.max(aH, aG)} zu ${Math.min(aH, aG)} Schüsse aufs Tor.`);
  } else if (sch && zahl(sch.heim) != null) {
    saetze.push(`Schüsse ${sch.heim} zu ${sch.gast}.`);
  }
  if (h != null && g != null && h !== g && aH != null && aG != null) {
    const fuehrtHeim = h > g;
    if ((fuehrtHeim && aH < aG) || (!fuehrtHeim && aG < aH)) saetze.push(`${fuehrtHeim ? H : G} führt, obwohl ${fuehrtHeim ? G : H} mehr aufs Tor schießt: sehr effizient.`);
  }
  const wq = st.get("fieldGoalPct");
  if (wq && s.sport === "basketball") saetze.push(`Wurfquote ${wq.heim} zu ${wq.gast} Prozent.`);
  const yds = st.get("totalYards");
  if (yds && s.sport === "football") saetze.push(`Raumgewinn ${yds.heim} zu ${yds.gast} Yards.`);
  const letzt = tore[tore.length - 1];
  if (letzt && s.zustand === "live" && tore.length >= 2) saetze.push(`Das letzte Tor fiel ${letzt.minute ? `in der ${letzt.minute.replace(/'$/, ".")} Minute ` : ""}für ${letzt.seite === "heim" ? H : G}.`);
  if (s.lage && s.zustand === "live") saetze.push(`Gerade: ${s.lage}.`);
  return saetze.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

const analyseCache = new Map(); // key -> { at, text }
const SYSTEM = `Du bist Friday, eine Sport-Analystin. Du bekommst die echten Live-Daten eines Spiels (Stand, Ereignisse, Statistik, Ticker).
Schreib auf Deutsch eine kurze, lebendige Analyse zum Vorlesen: 3 bis 5 Sätze, ohne Aufzählungszeichen, ohne Markdown, ohne Emojis.
Was ist bisher passiert, wer macht das Spiel, was fällt auf (Effizienz, Karten, Wende, Momentum), und ein vorsichtiger Ausblick, falls es noch läuft.
Erfinde nichts, was nicht in den Daten steht. Wenn Daten fehlen, sag nur, was du sicher weißt.`;

/** Analyse mit Claude (max. ~12 s), sonst die eigene Regel-Analyse. */
export async function analyse(ligaId, id, { maxMs = 12000 } = {}) {
  const d = await spielDetail(ligaId, id);
  const fallback = { text: d.regelAnalyse, quelle: "regeln" };
  if (d.zustand === "vorher") return fallback;
  const key = `${ligaId}/${id}/${d.heim?.punkte}-${d.gast?.punkte}/${d.statusText}/${(d.ereignisse || []).length}`;
  const hit = analyseCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60000) return { text: hit.text, quelle: "claude" };
  const daten = {
    wettbewerb: d.ligaName, titel: d.titel, status: d.statusText, zustand: d.zustand,
    heim: d.art === "duell" ? { name: d.heim.name, punkte: d.heim.punkte, saetze: d.heim.saetze } : undefined,
    gast: d.art === "duell" ? { name: d.gast.name, punkte: d.gast.punkte, saetze: d.gast.saetze } : undefined,
    feld: d.art === "feld" ? d.feld.slice(0, 8).map((f) => ({ pos: f.pos, name: f.name, wert: f.punkte })) : undefined,
    ereignisse: (d.ereignisse || []).slice(-20).map((e) => ({ min: e.minute, art: e.art, team: e.seite === "heim" ? d.heim?.name : e.seite === "gast" ? d.gast?.name : "", spieler: e.spieler, text: e.text, stand: e.stand })),
    statistik: (d.statistik || []).map((x) => ({ [x.label]: `${x.heim} : ${x.gast}` })),
    ticker: (d.kommentar || []).slice(0, 8).map((k) => `${k.zeit} ${k.text}`),
    meldung: d.meldung, gerade: d.lage,
  };
  const r = await Promise.race([
    denke({ system: SYSTEM, text: JSON.stringify(daten), stufe: "leicht", maxTokens: 700, quelle: "sport" }).catch(() => null),
    new Promise((res) => setTimeout(() => res(null), maxMs)),
  ]);
  if (!r?.ok || !r.text) return { ...fallback, hinweis: r?.leer ? "Guthaben leer: Analyse mit eigenen Regeln." : "" };
  const text = r.text.replace(/[*#_`]/g, "").replace(/\s+/g, " ").trim().slice(0, 900);
  analyseCache.set(key, { at: Date.now(), text });
  if (analyseCache.size > 80) analyseCache.delete(analyseCache.keys().next().value);
  return { text, quelle: "claude" };
}

export async function highlights(q) {
  const r = await youtubeSuche(String(q || "").slice(0, 100)).catch(() => ({ videos: [] }));
  return { videos: (r.videos || []).slice(0, 6), ohneSchluessel: Boolean(r.ohneSchluessel), hinweis: "Offizielle Zusammenfassungen von YouTube. Ganze Live-Spiele gibt es nur beim Rechteinhaber." };
}

// ---------- Sprachbefehl ----------
function vorbereiten(text) {
  let t = flach(text);
  t = t.replace(/^(hey |hallo |hi |ok |okay )?(friday|freitag|fraiday|eve)( |$)/, "").trim();
  return t;
}
const STARK = /\b(live ?spiel|livespiel|live ?sport|sport live|live ?ticker|liveticker|spielstand|zwischenstand|sportergebnisse|sport ergebnisse|ergebnisse im sport|was lauft (gerade )?im sport|welche spiele laufen|lauft gerade ein spiel|analysier\w* (mir )?(das |dieses |den |die )?(spiel|match|rennen|partie|verlauf)|spiel ?analyse|spielanalyse|wer fuhrt gerade|wer gewinnt gerade)\b/;
const VERB = /\b(zeig|zeige|live|lauft|laufen|steht|stand|ergebnis|ergebnisse|spiel|spiele|ticker|analys\w*|wer|offne|oeffne|heute|gerade|jetzt|wie)\b/;
const FRAGE_STAND = /\b(wie steht(s| es)?|steht es|wie ist der stand|wie stehts|wer fuhrt|wer gewinnt|wie lauft es|wie gehts? (bei|im spiel))\b/;

function ligenAusText(t) {
  const treffer = [];
  for (const l of LIGEN) {
    for (const w of l.worte || []) {
      const f = flach(w);
      if (new RegExp(`(^| )${f.replace(/ /g, " ")}( |$)`).test(t)) { treffer.push({ l, len: f.length }); break; }
    }
  }
  // Längster Treffer zuerst ("2 bundesliga" vor "bundesliga", "frauen wm" vor "wm")
  treffer.sort((a, b) => b.len - a.len);
  const ids = [...new Set(treffer.map((x) => x.l.id))];
  if (ids.includes("ger.2")) return ids.filter((i) => i !== "ger.1");
  if (ids.includes("fifa.wwc")) return ids.filter((i) => i !== "fifa.world");
  if (ids.includes("wta")) return ids.filter((i) => i !== "atp");
  return ids;
}
const SPORTWORT = { fussball: ["fussball", "fussballspiel", "kicken"], basketball: ["basketball"], eishockey: ["eishockey"], tennis: ["tennis"], football: ["football"], handball: ["handball"], motorsport: ["motorsport", "formel"] };

/** Wählt das passende Spiel: genannte Mannschaft > läuft gerade > kommt als Nächstes > zuletzt. */
function waehle(liste, t) {
  const bewertet = liste.map((s) => {
    const p = s.art === "duell" ? passt(t, s.heim) + passt(t, s.gast) + (passt(t, s.heim) && passt(t, s.gast) ? 4 : 0) : (s.feld || []).reduce((m, f) => Math.max(m, passt(t, f)), 0);
    return { s, p };
  });
  const mit = bewertet.filter((x) => x.p > 0).sort((a, b) => b.p - a.p || RANG[a.s.zustand] - RANG[b.s.zustand]);
  if (mit.length) return { spiel: mit[0].s, team: true };
  const live = liste.find((s) => s.zustand === "live");
  if (live) return { spiel: live, team: false };
  const jetzt = Date.now();
  const naechstes = liste.filter((s) => s.zustand === "vorher").sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  const letztes = liste.filter((s) => s.zustand === "ende").sort((a, b) => Date.parse(b.start) - Date.parse(a.start))[0];
  if (naechstes && Date.parse(naechstes.start) - jetzt < 3 * 3600000) return { spiel: naechstes, team: false };
  return { spiel: letztes || naechstes || null, team: false };
}

function woSatz(ligaId) {
  const w = woSchauen(ligaId);
  if (!w.sender.length) return "";
  const gratis = w.sender.filter((s) => s.gratis).map((s) => s.name.split(" /")[0]);
  const bezahlt = w.sender.filter((s) => !s.gratis).map((s) => s.name.split(" (")[0]);
  if (gratis.length && bezahlt.length) return `Live sehen kannst du es legal bei ${bezahlt.join(" oder ")}; ${gratis.join(" und ")} zeigen ausgewählte Spiele kostenlos.`;
  if (gratis.length) return `Live läuft es kostenlos bei ${gratis.join(" oder ")}.`;
  return `Das Live-Bild gibt es legal nur bei ${bezahlt.join(" oder ")}, die App kann ich dir öffnen.`;
}

export async function quickCommand(text) {
  const t = vorbereiten(text);
  if (!t || t.length > 160) return null;
  const ligen = ligenAusText(t);
  const sportwort = Object.entries(SPORTWORT).find(([, w]) => w.some((x) => new RegExp(`(^| )${x}( |$)`).test(t)))?.[0];
  const stark = STARK.test(t);
  const ueberblick = /\b(offne|oeffne|zeig|zeige)( mir)?( den| das| die)? (live ?sport|sport ?zentrale|sport ?fenster|sport ?ergebnisse|sportergebnisse|alle spiele|sport)( an| auf)?$/.test(t) || /^(live ?sport|sport ?zentrale|sportergebnisse)$/.test(t) || /\bwas lauft (gerade |heute )?im sport\b|\bwelche spiele laufen\b/.test(t);
  const mitLiga = (ligen.length || sportwort) && VERB.test(t);
  const frage = FRAGE_STAND.test(t) || (/ gegen /.test(t) && VERB.test(t));
  if (!stark && !mitLiga && !ueberblick && !frage) return null;
  // Länder-Info "zeig mir ... Ergebnisse"? nur wenn wirklich nach Sport gefragt wird
  if (!frei()) {
    if (stark || mitLiga || ueberblick) return { answer: `${GESPERRT.replace(".", `, ${boss()}.`)}`, actions: [] };
    return null;
  }

  if (ueberblick && !ligen.length) {
    const live = await liveJetzt().catch(() => []);
    const n = live.length;
    const bsp = live.slice(0, 3).map((s) => s.art === "duell" ? `${nameKurz(s.heim)} gegen ${nameKurz(s.gast)} ${s.heim.punkte}:${s.gast.punkte}` : s.titel).join(", ");
    return { answer: n ? `Gerade laufen ${n} Spiele, ${boss()}. Zum Beispiel ${bsp}. Tipp eins an, dann analysiere ich es.` : `Gerade läuft in den großen Ligen nichts live, ${boss()}. Ich zeige dir die Ergebnisse und was als Nächstes kommt.`, actions: ["sport"] };
  }

  const suchIds = ligen.length ? ligen : sportwort ? LIGEN.filter((l) => l.sport === sportwort).map((l) => l.id).filter((id) => HAUPT.includes(id) || LIGA.get(id).tsdb) : HAUPT;
  const liste = await spieleVieler(suchIds);
  const { spiel, team } = waehle(liste, t);
  // "Wie steht es um das Wetter?" o. Ä.: ohne Sport-Wort und ohne bekannte Mannschaft nicht zuständig
  if (frage && !stark && !mitLiga && !team) return null;
  if (!spiel) {
    const name = ligen.length ? LIGA.get(ligen[0]).name : sportwort ? SPORTARTEN.find((s) => s.id === sportwort)?.name : "den großen Ligen";
    return { answer: `In ${name} finde ich gerade kein Spiel, ${boss()}. Ich öffne dir die Sport-Übersicht.`, actions: ligen.length ? ["sport", `sport_liga:${ligen[0]}`] : ["sport"] };
  }
  const aktionen = ["sport", `sport_spiel:${spiel.liga}:${spiel.id}`];
  if (spiel.zustand === "vorher") {
    const was = spiel.art === "duell" ? `${spiel.heim.name} gegen ${spiel.gast.name}` : spiel.titel;
    return { answer: `${was} beginnt ${spiel.statusText}. ${woSatz(spiel.liga)} Ich habe dir das Spiel geöffnet und melde mich mit der Analyse, sobald es läuft.`.replace(/\s+/g, " ").trim(), actions: aktionen };
  }
  const a = await analyse(spiel.liga, spiel.id).catch(() => null);
  const kern = a?.text || regelAnalyse(spiel);
  const kopf = spiel.zustand === "live" && !team && !ligen.length ? `Live gerade: ${spiel.ligaName}. ` : "";
  const wo = spiel.zustand === "live" ? ` ${woSatz(spiel.liga)}` : "";
  return { answer: `${kopf}${kern}${wo}`.replace(/\s+/g, " ").trim(), actions: aktionen };
}

// ---------- Schnittstelle ----------
export function sportRouten(app, asyncRoute) {
  const gesperrt = (res) => { if (frei()) return false; res.status(423).json({ error: GESPERRT }); return true; };
  app.get("/api/sport", (req, res) => {
    if (gesperrt(res)) return;
    res.json({ sportarten: SPORTARTEN, ligen: LIGEN.map(({ id, sport, name, tsdb }) => ({ id, sport, name, nurErgebnis: Boolean(tsdb) })), eve: IST_EVE });
  });
  app.get("/api/sport/live", asyncRoute(async (req, res) => {
    if (gesperrt(res)) return;
    const spiele = await liveJetzt();
    res.json({ spiele, zeit: new Date().toISOString() });
  }));
  app.get("/api/sport/liga/:id", asyncRoute(async (req, res) => {
    if (gesperrt(res)) return;
    const tag = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.tag || "")) ? String(req.query.tag) : "";
    try {
      const spiele = await spieleDerLiga(String(req.params.id), tag);
      spiele.sort((a, b) => RANG[a.zustand] - RANG[b.zustand] || Date.parse(a.start) - Date.parse(b.start));
      res.json({ spiele, liga: LIGA.get(String(req.params.id))?.name || "", wo: woSchauen(String(req.params.id)) });
    } catch (err) { res.status(502).json({ error: `Die Spielstände sind gerade nicht erreichbar (${err.message}).` }); }
  }));
  app.get("/api/sport/spiel/:liga/:id", asyncRoute(async (req, res) => {
    if (gesperrt(res)) return;
    try { res.json(await spielDetail(String(req.params.liga), String(req.params.id))); }
    catch (err) { res.status(404).json({ error: err.message }); }
  }));
  app.get("/api/sport/spiel/:liga/:id/analyse", asyncRoute(async (req, res) => {
    if (gesperrt(res)) return;
    try { res.json(await analyse(String(req.params.liga), String(req.params.id))); }
    catch (err) { res.status(404).json({ error: err.message }); }
  }));
  app.get("/api/sport/highlights", asyncRoute(async (req, res) => {
    if (gesperrt(res)) return;
    res.json(await highlights(req.query.q));
  }));
}
