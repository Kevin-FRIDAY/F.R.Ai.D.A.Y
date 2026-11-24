// Fridays Offline-Gehirn: versteht häufige Befehle selbst – ohne Claude und ohne Guthaben.
// Stufe 1 ("sicher") läuft immer zuerst: schnell und kostenlos (Uhrzeit, Wetter, Timer, Listen, Kurse ...).
// Stufe 2 ("notfall") springt nur ein, wenn Claude nicht erreichbar ist (Guthaben leer, Netzfehler).
import { config } from "./config.js";
import * as store from "./store.js";
import { getWeather, runTool, getProtocols } from "./tools.js";
import { getCrypto, getExchange, getHolidays, getISS, getWiki } from "./extras.js";
import { findCountry, getCountryNews, getOverview } from "./lagezentrum.js";
import { isAgentOnline, sendToAgent } from "./agent-hub.js";
import { getEnergie } from "./energie.js";
import { ersatzBereit } from "./ki-client.js";
import { extraAnswer, EXTRA_HILFE } from "./offline-extra.js";
import { plusAnswer, plusNotfall, naechsteFeiertageOffline } from "./offline-plus.js";
import { lagebildAnswer } from "./lagebild.js";
import { lageplusAnswer } from "./lageplus.js";

// JavaScript kennt bei \b nur englische Buchstaben. U() macht daraus echte Wortgrenzen (auch für ä, ö, ü, ß).
const WB = "(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))";
const uCache = new Map();
function U(re) {
  const key = re.source + "/" + re.flags;
  if (!uCache.has(key)) uCache.set(key, new RegExp(re.source.replaceAll("\\b", WB), re.flags.includes("u") ? re.flags : re.flags + "u"));
  return uCache.get(key);
}

const name = () => config.userName || "Boss";
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const zahl = (v, stellen = 0) => Number(v).toLocaleString("de-DE", { maximumFractionDigits: stellen, minimumFractionDigits: 0 });
const grad = (v) => `${Math.round(v)} Grad`;

// Text vereinfachen: klein, ohne Satzzeichen, ohne "Friday," am Anfang.
// Morgens (4–11 Uhr) „Guten Morgen“, mittags/nachmittags (11–18 Uhr) „Guten Tag“, abends und nachts „Guten Abend“.
export function tagesGruss(h = teile().h) {
  return h >= 4 && h < 11 ? "Guten Morgen" : h >= 11 && h < 18 ? "Guten Tag" : "Guten Abend";
}

export function normalize(text, { gross = false } = {}) {
  let t = String(text || "")
    .replace(/[„“”"'!?¿¡;]/g, " ")
    .replace(/(\D)[.,:](\D|$)/g, "$1 $2")
    .replace(/[.,:]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!gross) t = t.toLowerCase();
  t = t.replace(/^(hey |hallo |hi |ok |okay |sag mal )?(friday|freitag|fraiday)( |$)/i, "").trim();
  t = t.replace(/^(bitte |kannst du (mir )?(bitte )?|könntest du (mir )?(bitte )?|sag mir (bitte )?|zeig mir (bitte )?)/i, "").trim();
  return t;
}

// --- Zahlen als Wort ---
const ZAHLWORTE = {
  null: 0, ein: 1, eine: 1, einen: 1, einer: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
  elf: 11, zwölf: 12, zwoelf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, fuenfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19,
  zwanzig: 20, dreißig: 30, dreissig: 30, vierzig: 40, fünfzig: 50, fuenfzig: 50, sechzig: 60, neunzig: 90, hundert: 100,
};
function wortZahl(w) {
  if (w == null) return null;
  const s = String(w).replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  return Object.hasOwn(ZAHLWORTE, s) ? ZAHLWORTE[s] : null;
}

// --- Zeit in der Zeitzone von Friday ---
function teile(ms = Date.now()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}
// Ortszeit (in config.timezone) -> echte Zeit
function ortszeit(y, m, d, h, mi) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const p = teile(guess);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - guess;
  return new Date(guess - offset);
}
function uhrzeitText(date) {
  return date.toLocaleTimeString("de-DE", { timeZone: config.timezone, hour: "numeric", minute: "2-digit" }) + " Uhr";
}
function tagText(date) {
  const heute = teile();
  const p = teile(date.getTime());
  const diff = Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(heute.y, heute.m - 1, heute.d)) / 86400000);
  if (diff === 0) return "heute";
  if (diff === 1) return "morgen";
  if (diff === 2) return "übermorgen";
  return date.toLocaleDateString("de-DE", { timeZone: config.timezone, weekday: "long", day: "numeric", month: "long" });
}

// "in 20 Minuten", "in einer halben Stunde", "um 18 Uhr", "morgen um 7:30", "morgen früh"
export function parseZeit(t) {
  const now = Date.now();
  let m = t.match(U(/\bin (\d+(?:[.,]\d+)?|[a-zäöüß]+) (sekunden?|minuten?|min|stunden?|std|tagen?)\b/));
  if (m) {
    const n = wortZahl(m[1]);
    if (n != null && n > 0) {
      const einheit = m[2].startsWith("sek") ? 1000 : m[2].startsWith("min") ? 60000 : m[2].startsWith("st") ? 3600000 : 86400000;
      return { date: new Date(now + n * einheit), match: m[0] };
    }
  }
  m = t.match(U(/\bin (einer|1) (halben|viertel) ?stunde\b|\bin einer viertelstunde\b|\bin einer dreiviertelstunde\b/));
  if (m) {
    const min = /dreiviertel/.test(m[0]) ? 45 : /viertel/.test(m[0]) ? 15 : 30;
    return { date: new Date(now + min * 60000), match: m[0] };
  }
  m = t.match(U(/\bin (einer|1) stunde\b/));
  if (m) return { date: new Date(now + 3600000), match: m[0] };

  const heute = teile();
  let tagPlus = 0;
  if (U(/\bübermorgen\b|\buebermorgen\b/).test(t)) tagPlus = 2;
  else if (U(/\bmorgen\b/).test(t)) tagPlus = 1;
  m = t.match(U(/\bum (\d{1,2})(?:[:.](\d{2}))?(?: uhr)?(?: (\d{1,2}))?\b/)) || t.match(U(/\bum ([a-zäöüß]+) uhr\b/));
  let h = null, mi = 0, matchText = m?.[0];
  if (m) {
    h = wortZahl(m[1]);
    mi = m[2] ? Number(m[2]) : (m[3] && /uhr/.test(m[0]) ? Number(m[3]) : 0);
  } else if (U(/\bmorgen früh\b|\bmorgen frueh\b/).test(t)) {
    h = 8; matchText = "morgen früh";
  } else if (U(/\bheute abend\b/).test(t)) {
    h = 19; matchText = "heute abend";
  }
  if (h == null || h > 23 || mi > 59) return null;
  if (U(/\babends?\b|\bnachmittags?\b/).test(t) && h < 12) h += 12;
  const base = new Date(Date.UTC(heute.y, heute.m - 1, heute.d + tagPlus));
  let date = ortszeit(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), h, mi);
  if (tagPlus === 0 && date.getTime() <= now) date = new Date(date.getTime() + 86400000);
  return { date, match: matchText };
}

// --- Rechnen (ohne eval) ---
export function rechne(ausdruck) {
  let s = ` ${ausdruck} `
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/ geteilt durch | durch | geteilt /g, " / ")
    .replace(/ mal | x | multipliziert mit /g, " * ")
    .replace(/ plus | und /g, " + ")
    .replace(/ minus | weniger /g, " - ")
    .replace(/ hoch /g, " ^ ")
    .replace(/ (?:die )?wurzel (?:aus |von )?/g, " √ ")
    .replace(/ prozent von /g, " %von ");
  s = s.replace(/[a-zäöüß]+/g, (w) => (w === "von" ? w : wortZahl(w) != null ? String(wortZahl(w)) : w)).trim();
  if (!/^[\d\s.+\-*/^()√%von]+$/.test(s) || !/\d/.test(s)) return null;
  const tokens = s.match(/\d+(?:\.\d+)?|%von|[+\-*/^()√]/g);
  if (!tokens) return null;
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  function prim() {
    const t = next();
    if (t === "(") { const v = add(); if (next() !== ")") throw new Error("Klammer"); return v; }
    if (t === "-") return -prim();
    if (t === "√") return Math.sqrt(prim());
    if (t != null && /^\d/.test(t)) return Number(t);
    throw new Error("Ausdruck");
  }
  function pow() { const b = prim(); if (peek() === "^") { next(); return b ** pow(); } return b; }
  function mul() {
    let v = pow();
    while (["*", "/", "%von"].includes(peek())) {
      const op = next(); const r = pow();
      v = op === "*" ? v * r : op === "/" ? v / r : (v / 100) * r;
    }
    return v;
  }
  function add() {
    let v = mul();
    while (peek() === "+" || peek() === "-") { const op = next(); const r = mul(); v = op === "+" ? v + r : v - r; }
    return v;
  }
  try {
    const v = add();
    if (i !== tokens.length || !Number.isFinite(v)) return null;
    return Math.round(v * 1e6) / 1e6;
  } catch { return null; }
}

// --- Bausteine für Antworten ---
function wetterSatz(w, welcherTag = 0) {
  if (w.error) return `Das Wetter für diesen Ort habe ich nicht gefunden.`;
  if (welcherTag === 0) {
    const j = w.jetzt;
    const heute = w.tage?.[0];
    let s = `In ${w.ort} sind es gerade ${grad(j.temperatur)}, ${j.wetter}.`;
    if (Math.abs(j.gefuehlt - j.temperatur) >= 3) s += ` Gefühlt ${grad(j.gefuehlt)}.`;
    if (heute) s += ` Heute bis ${grad(heute.max)}${heute.regen_prozent >= 40 ? `, Regenrisiko ${heute.regen_prozent} Prozent – nimm lieber einen Schirm mit` : ""}.`;
    if (w.stand_vor_minuten) s += ` Das ist der Stand von vor ${w.stand_vor_minuten} Minuten, der Wetterdienst ist gerade nicht erreichbar.`;
    return s;
  }
  const d = w.tage?.[welcherTag];
  if (!d) return "Für diesen Tag habe ich noch keine Vorhersage.";
  const tag = welcherTag === 1 ? "Morgen" : "Übermorgen";
  return `${tag} in ${w.ort}: ${d.wetter}, ${grad(d.min)} bis ${grad(d.max)}${d.regen_prozent >= 30 ? `, Regenrisiko ${d.regen_prozent} Prozent` : ""}.`;
}

const WAEHRUNG = {
  euro: "EUR", euros: "EUR", eur: "EUR", dollar: "USD", usd: "USD", "us-dollar": "USD", pfund: "GBP", gbp: "GBP",
  franken: "CHF", chf: "CHF", yen: "JPY", jpy: "JPY", yuan: "CNY", lira: "TRY", zloty: "PLN", rupien: "INR", rupie: "INR",
  "kanadische dollar": "CAD", "australische dollar": "AUD", kronen: "SEK", forint: "HUF",
};
const WAEHRUNG_NAME = { EUR: "Euro", USD: "Dollar", GBP: "Pfund", CHF: "Franken", JPY: "Yen", CNY: "Yuan", TRY: "Lira", PLN: "Zloty", INR: "Rupien", CAD: "kanadische Dollar", AUD: "australische Dollar", SEK: "Kronen", HUF: "Forint" };
const KRYPTO = { bitcoin: "bitcoin", btc: "bitcoin", ethereum: "ethereum", ether: "ethereum", eth: "ethereum", solana: "solana", dogecoin: "dogecoin", doge: "dogecoin", xrp: "ripple", ripple: "ripple", cardano: "cardano", litecoin: "litecoin", polkadot: "polkadot", bnb: "binancecoin" };
const KRYPTO_NAME = { bitcoin: "Bitcoin", ethereum: "Ethereum", solana: "Solana", dogecoin: "Dogecoin", ripple: "XRP", cardano: "Cardano", litecoin: "Litecoin", polkadot: "Polkadot", binancecoin: "BNB" };

// Bekannte Ziele für "öffne ...": Websites (über tools.js open_app) und Mac-Programme.
const WEB_ZIELE = ["youtube", "netflix", "amazon", "prime video", "amazon prime", "disney", "disney+", "disney plus", "spotify", "apple music", "youtube music", "twitch", "tiktok", "instagram", "whatsapp", "telegram", "gmail", "google", "google maps", "maps", "x", "twitter", "facebook", "reddit", "chatgpt", "ebay", "paypal", "dazn", "wetter", "news", "osiris", "osiris ai", "osiris karte", "live karte", "weltkarte", "lagekarte"];
const MAC_APPS = {
  safari: "Safari", mail: "Mail", kalender: "Calendar", notizen: "Notes", fotos: "Photos", musik: "Music", nachrichten: "Messages",
  karten: "Maps", rechner: "Calculator", taschenrechner: "Calculator", finder: "Finder", terminal: "Terminal", facetime: "FaceTime",
  einstellungen: "System Settings", systemeinstellungen: "System Settings", chrome: "Google Chrome", "google chrome": "Google Chrome",
  erinnerungen: "Reminders", kontakte: "Contacts", "app store": "App Store", podcasts: "Podcasts", vorschau: "Preview", textedit: "TextEdit",
  pages: "Pages", numbers: "Numbers", keynote: "Keynote", xcode: "Xcode", "visual studio code": "Visual Studio Code", vscode: "Visual Studio Code",
  blender: "Blender", discord: "Discord", zoom: "zoom.us", slack: "Slack", firefox: "Firefox", "tv app": "TV", "apple tv": "TV",
};

const WITZE = [
  "Warum können Geister so schlecht lügen? Weil man durch sie hindurchsieht.",
  "Was macht ein Pirat am Computer? Er drückt die Enter-Taste.",
  "Treffen sich zwei Magneten. Sagt der eine: Was soll ich heute bloß anziehen?",
  "Warum hat der Roboter Urlaub gebraucht? Er hatte zu viele Bugs im Kopf.",
  "Wie nennt man einen Bumerang, der nicht zurückkommt? Stock.",
  "Was sagt ein großer Stift zu einem kleinen Stift? Wachs-mal-Stift.",
  "Ich wollte einen Witz über UDP erzählen. Aber ich weiß nicht, ob er ankommt.",
  "Mein Akku und ich haben etwas gemeinsam: Ab zwanzig Prozent werden wir beide nervös.",
  "Warum gehen Ameisen nicht in die Kirche? Weil sie Insekten sind.",
  "Was ist grün und klopft an die Tür? Ein Klopfsalat.",
  "Was ist ein Keks unter einem Baum? Ein schattiges Plätzchen.",
  "Tony Stark baut seine Anzüge in einer Höhle. Ich habe nur einen Mac. Ich finde, ich schlage mich gut.",
];

function hilfeText() {
  return `Auch ohne Guthaben kann ich dir sagen, wie spät es ist, wie das Wetter wird und welcher Feiertag kommt. ` +
    `Ich stelle Timer und Erinnerungen, führe deine Aufgaben- und Einkaufsliste, merke mir Dinge, rechne, ` +
    `nenne Bitcoin- und Wechselkurse, schlage Begriffe bei Wikipedia nach und lese dir die Schlagzeilen zu jedem Land vor. ` +
    `Und ich steuere Mac, Fernseher und Alexa. Sobald sie verbunden sind, auch Kalender, Spotify, Hue-Lampen, Home Assistant, Todoist und Notion. ` + EXTRA_HILFE +
    ` Sag auch: Systemstatus, Wie viel Guthaben hast du, Starte Snake, Zeig mir Japan oder Wie lange brauche ich nach Hamburg.`;
}

// Mini-Briefing ohne Claude: Wetter, Termine, Aufgaben, eine Schlagzeile.
export async function offlineBriefing() {
  const p = teile();
  const gruss = tagesGruss(p.h);
  const teil = [`${gruss}, ${name()}.`];
  const wochentag = new Date().toLocaleDateString("de-DE", { timeZone: config.timezone, weekday: "long", day: "numeric", month: "long" });
  teil.push(`Heute ist ${wochentag}.`);
  try { teil.push(wetterSatz(await getWeather(config.city), 0)); } catch { /* ohne Wetter */ }
  // Kalender und Todoist (wenn verbunden). Dynamisch geladen, damit sich die Module nicht im Kreis laden.
  try {
    const { heuteSatz } = await import("./kalender.js");
    const k = await heuteSatz(0);
    if (k) teil.push(k);
  } catch { /* ohne Kalender */ }
  try {
    const td = await (await import("./todoist.js")).heuteSatz();
    if (td) teil.push(td);
  } catch { /* ohne Todoist */ }
  const ende = Date.now() + 24 * 3600 * 1000;
  const termine = store.getReminders()
    .filter((r) => !r.done && !/^Timer:/.test(r.text) && new Date(r.due).getTime() < ende)
    .sort((a, b) => new Date(a.due) - new Date(b.due));
  if (termine.length) teil.push(`Erinnerungen: ${termine.slice(0, 3).map((r) => `${r.text} um ${uhrzeitText(new Date(r.due))}`).join(", ")}.`);
  const offen = store.getTasks().filter((t) => !t.done);
  if (offen.length) teil.push(offen.length === 1 ? `Eine Aufgabe ist offen: ${offen[0].text}.` : `${offen.length} Aufgaben sind offen, zuerst: ${offen[0].text}.`);
  try {
    const de = findCountry("deutschland");
    const news = de ? await getCountryNews(de) : null;
    if (news?.items?.[0]) teil.push(`Top-Meldung: ${news.items[0].title}.`);
  } catch { /* ohne Nachrichten */ }
  return teil.join(" ");
}

function listeVorlesen(liste, leer, titel, titelEins = titel) {
  const offen = liste.filter((x) => !x.done);
  if (!offen.length) return leer;
  if (offen.length === 1) return `${titelEins} ${offen[0].text}.`;
  const namen = offen.slice(0, 8).map((x) => x.text);
  const rest = offen.length > 8 ? ` und ${offen.length - 8} weitere` : "";
  return `${titel} ${namen.length === 1 ? namen[0] : `${namen.slice(0, -1).join(", ")} und ${namen.at(-1)}`}${rest}.`;
}

function macNichtDa() {
  return `Der Mac ist gerade nicht verbunden, ${name()}.`;
}

/**
 * Versucht, einen Befehl ohne Claude zu beantworten.
 * @param {string} text
 * @param {{notfall?: boolean}} opts - notfall: auch unsichere Treffer (Claude ist nicht erreichbar)
 * @returns {Promise<{answer: string, actions: string[]} | null>}
 */
// Ohne Internet sollen Wetter, Kurse & Co. ehrlich sagen, was los ist, statt still zu scheitern.
function istNetzFehler(err) {
  const m = `${err?.name || ""} ${err?.message || ""} ${err?.cause?.code || ""}`;
  return /fetch failed|timeout|timed out|abort|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|ETIMEDOUT|network/i.test(m);
}
export async function offlineAnswer(text, opts = {}) {
  try {
    return await offlineAnswerIntern(text, opts);
  } catch (err) {
    if (!istNetzFehler(err)) throw err;
    console.error("Offline-Gehirn (kein Netz):", err.message);
    return { answer: `Dafür brauche ich Internet, ${name()}, und das ist gerade nicht erreichbar. Uhrzeit, Timer, Listen und Rechnen gehen trotzdem.`, actions: ["offline", "netzfehler"] };
  }
}

async function offlineAnswerIntern(text, { notfall = false } = {}) {
  const t = normalize(text);
  const tGross = normalize(text, { gross: true });
  // Ein Stück aus t in der Original-Schreibweise zurückholen ("die wäsche" -> "die Wäsche").
  const orig = (stueck) => {
    const i = t.indexOf(stueck);
    return i >= 0 && tGross.length === t.length ? tGross.slice(i, i + stueck.length) : stueck;
  };
  const gross1 = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  if (notfall && /briefing|lagebericht/.test(t)) return { answer: await offlineBriefing(), actions: ["offline", "briefing"] };
  if (!t || t.length > 220) return notfall ? { answer: notfallText(), actions: ["offline"] } : null;
  const ok = (answer, ...actions) => ({ answer, actions: ["offline", ...actions] });
  const has = (re) => U(re).test(t);
  // Zusammengesetzte Wünsche ("Wetter in Rom und was ist dort los") versteht Claude besser.
  if (!notfall && has(/\b(und|dann|danach|außerdem|ausserdem)\b.*\b(was|wie|wo|wann|warum|öffne|oeffne|erinnere|schreib|such|erklär|erklaer)\b/)) return null;

  // --- Smalltalk ---
  if (/^(hallo|hi|hey|servus|moin|na|yo|guten tag|grüß dich|gruess dich)( du)?$/.test(t)) return ok(pick([`${tagesGruss()}, ${name()}. Was kann ich für dich tun?`, `${tagesGruss()}, ${name()}. Ich bin bereit.`, `${tagesGruss()}, ${name()}. Zur Stelle.`]));
  if (/^(danke|danke schön|dankeschön|vielen dank|danke dir|merci|top|super|perfekt|cool)( friday)?$/.test(t)) return ok(pick(["Gern geschehen, Boss.", "Immer doch.", "Dafür bin ich da."]));
  if (/^(wie geht('s| es) dir|wie gehts|alles klar bei dir|alles gut bei dir)$/.test(t)) return ok(`Alle Systeme laufen, ${name()}. ${isAgentOnline() ? "Der Mac ist verbunden." : "Nur der Mac ist gerade nicht verbunden."} Und dir?`);
  if (/^(wer bist du|was bist du|stell dich vor)$/.test(t)) return ok(`Ich bin F.R.Ai.D.A.Y, deine persönliche KI, ${name()}. Ich passe auf deine Termine, die Welt und deinen Mac auf.`);
  if (/^(was kannst du( alles)?( ohne guthaben)?|hilfe|help|befehle|was geht offline)$/.test(t)) return ok(hilfeText());
  if (has(U(/\b(erzähl|erzaehl|sag|kennst du)( mir)? (einen|nen|noch einen) witz\b|^witz$/))) return ok(pick(WITZE));
  if (has(U(/\b(wirf|werfe|wirft) (eine )?münze\b|\bkopf oder zahl\b/))) return ok(pick(["Kopf.", "Zahl."]) + " Die Münze hat entschieden.");
  if (has(U(/\b(würfel|wuerfel|würfle|wuerfle)\b/)) && t.length < 30) return ok(`Eine ${["Eins", "Zwei", "Drei", "Vier", "Fünf", "Sechs"][Math.floor(Math.random() * 6)]}.`);
  if (/^(gute nacht)$/.test(t)) return ok(`Gute Nacht, ${name()}. Ich halte die Stellung.`);

  // --- Mehr Befehle ohne Claude (Weltzeit, Einheiten, Tage bis, Mond, Sonne, Zitate ...) ---
  const extra = await extraAnswer(t, ok).catch(() => null);
  if (extra) return extra;
  const plus = plusAnswer(t);
  if (plus) return plus;
  // Lagebild: Weltraumwetter, Raketenstarts, Internet-Störungen, Konfliktherde, Luft weltweit.
  const lb = await lagebildAnswer(t).catch(() => null);
  if (lb) return lb.zeigen ? ok(lb.text, "weltgeschehen") : ok(lb.text);
  // Lage-Plus: Reisewarnungen, Stabilität, Notfall-Flugzeuge, Meerengen, Hurrikane, Ausbrüche, Strahlung, Brennpunkte.
  const lp = await lageplusAnswer(t).catch(() => null);
  if (lp) return lp.zeigen ? ok(lp.text, "weltgeschehen") : ok(lp.text);

  // --- Uhrzeit und Datum ---
  if (has(/\bwie spät\b|\bwie spaet\b|\bwie viel uhr\b|\bwieviel uhr\b|^uhrzeit$|\bwelche uhrzeit\b|\bdie uhrzeit\b/) && !has(/\b(in|auf|im)\b/)) {
    return ok(`Es ist ${uhrzeitText(new Date())}.`);
  }
  if (has(U(/\bwelche[rn]? tag\b|\bwelches datum\b|\bder wievielte\b|\bden wievielten\b|^datum$|\bdatum heute\b|\bwelcher wochentag\b|\bwas für ein tag ist heute\b|\bwas ist heute für ein tag\b/))) {
    const d = new Date().toLocaleDateString("de-DE", { timeZone: config.timezone, weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return ok(`Heute ist ${d}.`);
  }

  // --- Timer und Erinnerungen ---
  if (has(U(/\b(timer|wecker|stoppuhr|countdown)\b/)) && !has(U(/\b(lösch|loesch|stopp|stop|abbrech|aus)\w*\b/))) {
    const m = t.match(U(/(\d+(?:[.,]\d+)?|[a-zäöüß]+) ?(sekunden?|sek|minuten?|min|stunden?|std)\b/));
    const halb = has(U(/\bhalbe stunde\b/)) ? 30 : has(U(/\bviertelstunde\b|\bviertel stunde\b/)) ? 15 : null;
    let ms = null, label = "";
    if (halb) { ms = halb * 60000; label = halb === 30 ? "eine halbe Stunde" : "eine Viertelstunde"; }
    else if (m && wortZahl(m[1]) != null) {
      const n = wortZahl(m[1]);
      const e = m[2].startsWith("s") && !m[2].startsWith("st") ? ["Sekunde", "Sekunden", 1000] : m[2].startsWith("m") ? ["Minute", "Minuten", 60000] : ["Stunde", "Stunden", 3600000];
      ms = n * e[2]; label = `${zahl(n, 1)} ${n === 1 ? e[0] : e[1]}`;
    }
    if (ms && ms > 0 && ms <= 7 * 86400000) {
      const due = new Date(Date.now() + ms);
      store.addReminder(`Timer: ${label} sind um`, due.toISOString());
      return ok(`Timer läuft: ${label}. Ich melde mich um ${uhrzeitText(due)}.`, "set_reminder");
    }
    if (has(U(/\b(timer|wecker)\b/)) && !m) return ok("Wie lange soll der Timer laufen? Sag zum Beispiel: Timer zehn Minuten.");
  }
  if (has(U(/^(erinnere|erinner) (mich|uns)\b|^erinnerung\b/)) && !has(U(/\b(welche|meine|zeig|liste|alle)\b/))) {
    const z = parseZeit(t);
    if (!z) return ok("Wann soll ich dich erinnern? Sag zum Beispiel: Erinnere mich in 20 Minuten an die Wäsche.");
    let was = t.replace(z.match, " ")
      .replace(/^(erinnere|erinner) (mich|uns)|^erinnerung/, "")
      .replace(U(/\b(bitte|nochmal|noch mal|heute|morgen|übermorgen|uebermorgen)\b/g), " ")
      .replace(/\s+/g, " ").trim()
      .replace(U(/^(daran|dran|an|zu|wegen|für|fuer)\b ?/), "")
      .replace(U(/^(an|zu)\b ?/), "")
      .trim();
    was = was ? gross1(orig(was)) : "Erinnerung";
    store.addReminder(was, z.date.toISOString());
    return ok(`Mach ich. Ich erinnere dich ${tagText(z.date)} um ${uhrzeitText(z.date)}: ${was}.`, "set_reminder");
  }
  if (has(U(/\b(welche|meine|zeig|lies|alle|habe ich|hab ich)\b.*\b(erinnerungen|termine)\b|^(erinnerungen|termine)$/))) {
    const offen = store.getReminders().filter((r) => !r.done).sort((a, b) => new Date(a.due) - new Date(b.due));
    if (!offen.length) return ok("Du hast keine offenen Erinnerungen.");
    const liste = offen.slice(0, 5).map((r) => `${gross1(tagText(new Date(r.due)))} um ${uhrzeitText(new Date(r.due))}: ${r.text}`).join(". ");
    return ok(`${offen.length === 1 ? "Eine Erinnerung" : `${offen.length} Erinnerungen`}. ${liste}.`);
  }

  // --- Einkaufsliste ---
  if (has(/einkaufsliste|einkaufszettel/)) {
    if (has(U(/\b(was steht|lies|zeig|was ist|was brauche|was muss)\b|^einkaufsliste$|^(meine|die) einkaufsliste$/))) {
      return ok(listeVorlesen(store.getShopping(), "Die Einkaufsliste ist leer.", "Auf der Einkaufsliste stehen", "Auf der Einkaufsliste steht"));
    }
    let was = t.replace(U(/\b(setz|setze|schreib|schreibe|pack|packe|füg|füge|fueg|fuege|trag|trage)\b/g), " ")
      .replace(U(/\b(auf|zur|zu|in) (die|der|meine|meiner|unsere) (einkaufsliste|einkaufszettel)\b|\b(einkaufsliste|einkaufszettel)\b/g), " ")
      .replace(U(/\b(bitte|noch|hinzu|ein|dazu|mal)\b/g), " ").replace(/\s+/g, " ").trim()
      .replace(/^(und|:)\s*/, "");
    if (!was) return ok("Was soll auf die Einkaufsliste?");
    const teileListe = was.split(/,| und /).map((x) => gross1(orig(x.trim()))).filter(Boolean).slice(0, 10);
    for (const x of teileListe) store.addShopping(x);
    return ok(`Steht drauf: ${teileListe.join(", ")}.`, "add_shopping");
  }

  // --- Aufgaben ---
  if (has(/^((was sind|welche sind|zeig|lies|nenn)( mir)? (meine|die) (offenen )?aufgaben( heute)?|welche aufgaben (stehen an|sind offen|gibt es)|was steht (auf|in) (meiner|der|meinen|den) (aufgaben|to ?do|todo)( ?liste)?|(lies|zeig)( mir)? (meine|die) (aufgaben|to ?dos?|todos?)( ?liste)?|(meine|offene|die) (aufgaben|to ?dos?|todos?)( ?liste)?|welche aufgaben (habe|hab) ich( noch)?( offen)?|aufgaben( ?liste)?|to ?dos?|todo ?liste|was muss ich (heute )?(noch )?(machen|erledigen|tun))$/)) {
    return ok(listeVorlesen(store.getTasks(), "Du hast keine offenen Aufgaben. Stark.", "Offen sind", "Offen ist nur:"));
  }
  const auf = t.match(/^(?:neue aufgabe|aufgabe|notiere aufgabe|to ?do)[: ]+(.+)$/) || t.match(/^(?:setz|setze|schreib|schreibe|trag|trage|füg|füge|fueg|fuege) (.+?) (?:auf|in|zu) (?:meine|die) (?:aufgaben|to ?do)(?: ?liste)?(?: hinzu)?$/);
  if (auf) {
    const was = gross1(orig(auf[1].trim()));
    store.addTask(was);
    return ok(`Aufgabe notiert: ${was}.`, "add_task");
  }

  // --- Gedächtnis ---
  const merk = t.match(/^(?:merk dir|merke dir|speicher(?:e)?|notier(?:e)? dir)(?: bitte)?,? (?:dass |das )?(.{3,})$/);
  if (merk) {
    let fakt = orig(merk[1].trim());
    // Nebensatz in Hauptsatz drehen: "ich Pizza mag" -> "ich mag Pizza", "mein Auto rot ist" -> "mein Auto ist rot"
    const w = fakt.split(" ");
    const pos = /^(ich|wir|du|er|sie|es)$/i.test(w[0]) ? 1 : /^(mein|meine|meiner|der|die|das|unser|unsere)$/i.test(w[0]) ? 2 : 0;
    if (pos && w.length > pos + 1 && U(/\bdass? /i).test(merk[0] + " ")) fakt = [...w.slice(0, pos), w.at(-1), ...w.slice(pos, -1)].join(" ");
    store.addMemory(`${name()} sagt: ${fakt}`);
    return ok(pick(["Gespeichert.", "Hab ich mir gemerkt.", "Ist notiert, Boss."]), "remember");
  }
  if (has(/^was weißt du (alles )?über mich$|^was weisst du (alles )?über mich$/)) {
    const mem = store.getMemories();
    if (!mem.length) return ok("Noch nicht viel. Sag einfach: Merk dir, dass ...");
    const zitat = (x) => x.replace(`${name()} sagt: `, "").replace(/[.]$/, "");
    return ok(`Du hast mir zum Beispiel gesagt: ${mem.slice(-5).map((m) => gross1(zitat(m.text))).join(". ")}.`);
  }

  // --- Wetter und Luft ---
  if (has(/\b(wetter|regnet es|wird es regnen|regenschirm|schirm mitnehmen|wie warm|wie kalt|temperatur|grad draußen|grad draussen)\b/) && t.length < 90 && !has(/\b(wochenende|nächste woche|naechste woche|soll ich|lohnt|urlaub|reise)\b/)) {
    const ortM = t.match(U(/\b(?:in|für|fuer|von) (?:der |die |dem |den )?([a-zäöüß][a-zäöüß\- ]{1,30}?)(?: heute| morgen| übermorgen| jetzt| gerade| aus| los| und|$)/));
    const ort = ortM && !/^(heute|morgen|übermorgen|draußen|der|die|das|wohnung|hier)$/.test(ortM[1]) ? ortM[1] : config.city;
    const tag = has(U(/\bübermorgen\b|\buebermorgen\b/)) ? 2 : has(U(/\bmorgen\b/)) ? 1 : 0;
    const w = await getWeather(ort);
    if (!w.error && tag === 0 && has(/\b(schirm|regenschirm|regnet es|wird es regnen)\b/)) {
      const p = w.tage?.[0]?.regen_prozent ?? 0;
      return ok(`${p >= 40 ? "Ja, nimm lieber einen Schirm mit." : p >= 20 ? "Eher nicht, aber ganz sicher ist es nicht." : "Nein, heute bleibt es wohl trocken."} Regenrisiko ${p} Prozent, gerade ${grad(w.jetzt.temperatur)} und ${w.jetzt.wetter}.`, "get_weather");
    }
    return ok(wetterSatz(w, tag), "get_weather");
  }
  if (has(U(/\bluftqualität\b|\bluftqualitaet\b|\bfeinstaub\b|\bwie ist die luft\b/))) {
    const ortM = t.match(U(/\b(?:in|für) ([a-zäöüß\- ]{2,30})$/));
    const r = await runTool("air_quality", { city: ortM ? ortM[1] : config.city });
    if (r.error) return ok("Die Luftqualität konnte ich gerade nicht abrufen.");
    return ok(`Die Luft in ${r.ort} ist ${r.bewertung}${r.luftqualitaet_index != null ? `, Index ${r.luftqualitaet_index}` : ""}.`, "air_quality");
  }

  // --- Krypto ---
  const kWort = Object.keys(KRYPTO).find((k) => U(new RegExp(`\\b${k}\\b`)).test(t));
  if (kWort && (has(U(/\b(kurs|preis|steht|stehts|wert|kostet|wie viel|wieviel)\b/)) || t === kWort)) {
    const vs = has(U(/\bdollar\b|\busd\b/)) ? "usd" : "eur";
    const r = await getCrypto(KRYPTO[kWort], vs);
    if (r.error) return ok("Den Kurs konnte ich gerade nicht abrufen.");
    const trend = r.veraenderung_24h_prozent >= 0 ? `plus ${zahl(r.veraenderung_24h_prozent, 1)}` : `minus ${zahl(Math.abs(r.veraenderung_24h_prozent), 1)}`;
    return ok(`${KRYPTO_NAME[r.coin] || r.coin} steht bei ${zahl(r.preis, r.preis < 10 ? 3 : 0)} ${vs === "usd" ? "Dollar" : "Euro"}, ${trend} Prozent in 24 Stunden.`, "crypto");
  }

  // --- Währung: "100 euro in dollar", "wie viel sind 50 dollar in euro", "wie steht der dollar" ---
  const wKeys = Object.keys(WAEHRUNG).sort((a, b) => b.length - a.length).join("|");
  const wm = t.match(U(new RegExp(`(\\d+(?:[.,]\\d+)?|[a-zäöüß]+) (${wKeys}) (?:in|zu|nach|auf) (${wKeys})\\b`)));
  if (wm && wortZahl(wm[1]) != null) {
    const r = await getExchange(wortZahl(wm[1]), WAEHRUNG[wm[2]], WAEHRUNG[wm[3]]);
    if (r.error) return ok("Den Wechselkurs konnte ich gerade nicht abrufen.");
    return ok(`${zahl(r.betrag, 2)} ${WAEHRUNG_NAME[r.von] || r.von} sind ${zahl(r.ergebnis, 2)} ${WAEHRUNG_NAME[r.nach] || r.nach}.`, "currency");
  }
  const ws = t.match(U(new RegExp(`\\bwie steht (?:der|das|die) (${wKeys})\\b|\\b(${wKeys})[- ]?kurs\\b`)));
  if (ws) {
    const code = WAEHRUNG[ws[1] || ws[2]];
    const [von, nach] = code === "EUR" ? ["EUR", "USD"] : [code, "EUR"];
    const r = await getExchange(1, von, nach);
    if (r.error) return ok("Den Wechselkurs konnte ich gerade nicht abrufen.");
    return ok(`Ein ${WAEHRUNG_NAME[von]} kostet gerade ${zahl(r.kurs, 4)} ${WAEHRUNG_NAME[nach]}.`, "currency");
  }

  // --- Feiertage, ISS ---
  if (has(U(/\b(nächste[rn]?|naechste[rn]?|wann ist der nächste|kommender?) feiertag\b|^feiertage?$/))) {
    // Ohne Internet rechnet Friday die bundesweiten Feiertage selbst aus.
    const r = await getHolidays("DE").catch(() => ({ error: true }));
    const liste = !r.error && r.naechste_feiertage?.length ? r.naechste_feiertage : naechsteFeiertageOffline();
    const f = liste[0];
    const d = new Date(`${f.datum}T12:00:00Z`);
    return ok(`Der nächste Feiertag ist ${f.name}, am ${d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}.`, "holidays");
  }
  if (has(U(/\b(wo ist|wo fliegt|position)\b.*\b(iss|raumstation)\b|^iss$/))) {
    const r = await getISS();
    return ok(`Die ISS fliegt gerade in ${zahl(r.hoehe_km)} Kilometern Höhe mit ${zahl(r.geschwindigkeit_kmh)} Kilometern pro Stunde über der ${r.ueber}, bei ${zahl(Math.abs(r.breitengrad), 1)} Grad ${r.breitengrad >= 0 ? "Nord" : "Süd"} und ${zahl(Math.abs(r.laengengrad), 1)} Grad ${r.laengengrad >= 0 ? "Ost" : "West"}.`, "iss");
  }

  // --- Rechnen ---
  const rm = t.match(/^(?:was ist|was sind|wie ?viel ist|wie ?viel sind|rechne|berechne|was ergibt)\s+(.+?)(?:\s+(?:ist|sind|gleich))?$/);
  if (rm) {
    const v = rechne(rm[1]);
    if (v != null) return ok(`Das sind ${zahl(v, 4)}.`, "rechnen");
  }

  // --- Welt-Nachrichten (mit Guthaben fasst Claude sie schöner zusammen) ---
  const claudeAus = notfall || (getEnergie().zustand === "tot" && !ersatzBereit());
  const land = t.match(/^(?:was ist|was passiert|was geht|was gibt('s| es) neues)\s+(?:gerade |heute |aktuell )?(?:in|im|auf)\s+(?:der |den |dem |die )?([a-zäöüß\- ]{3,40}?)(?:\s+(?:los|gerade|so|passiert|neues|aktuell))*$/)
    || t.match(/^(?:nachrichten|news|schlagzeilen|neuigkeiten|lage)\s+(?:aus|in|für|zu|von)\s+(?:der |den |dem |die )?([a-zäöüß\- ]{3,40})$/);
  if (land && claudeAus) {
    const key = land[land.length - 1].trim();
    if (/^(der welt|welt|world)$/.test(key)) return weltlage(ok);
    const c = findCountry(key);
    if (c) {
      try {
        const news = await getCountryNews(c);
        const top = news.items.slice(0, 3).map((n) => n.title);
        if (!top.length) return ok(`Aus ${c.name} gibt es gerade keine neuen Meldungen.`);
        return ok(`Aktuell zu ${c.name}: ${top.join(". ")}.`, "world_news");
      } catch {
        return ok(`Die Nachrichten aus ${c.name} konnte ich gerade nicht laden.`);
      }
    }
  }
  if (has(/^(was ist|was passiert|was geht) (gerade |heute )?(in der welt|auf der welt|in der welt so) ?(los|passiert)?$|^weltlage$|^(nachrichten|news|schlagzeilen)( heute)?$/) && claudeAus) return weltlage(ok);

  // --- Mail ---
  if (has(U(/\b(neue|ungelesene|habe ich|hab ich)\b.*\b(mails?|e-mails?|emails?|nachrichten im postfach)\b|^(postfach|mails?|e-mails?)$/))) {
    const r = await runTool("check_mail", {});
    if (r.error) return ok(r.error);
    const first = r.result.split("\n")[0];
    return ok(first.replace(/\.$/, "") + ".", "check_mail");
  }

  // --- Mac steuern ---
  if (has(/^(mach |mache |dreh |drehe )?(den |die )?(ton |musik |mac )?(lauter|leiser)( bitte)?$|^(mac |ton )?stumm( schalten)?$/)) {
    if (!isAgentOnline()) return ok(macNichtDa());
    const action = has(/lauter/) ? "volume_up" : has(/leiser/) ? "volume_down" : "mute";
    await sendToAgent(action, { value: "" });
    return ok(pick(["Erledigt.", "Gemacht.", "Okay."]), `mac:${action}`);
  }
  const vol = t.match(/^(?:stell |setz )?(?:die )?lautstärke (?:auf )?(\d{1,3})(?: prozent)?$/);
  if (vol) {
    if (!isAgentOnline()) return ok(macNichtDa());
    const v = Math.min(100, Number(vol[1]));
    await sendToAgent("volume_set", { value: String(v) });
    return ok(`Lautstärke auf ${v} Prozent.`, "mac:volume_set");
  }
  if (has(/^(musik |song |lied )?(pause|pausieren|stopp|stop|weiter|play|abspielen|fortsetzen)$|^(spiel|spiele|mach) (die )?musik( an| ab| weiter)?$|^musik (an|aus|pause)$/)) {
    if (!isAgentOnline()) return ok(macNichtDa());
    await sendToAgent("music_play_pause", { value: "" });
    return ok("Okay.", "mac:music_play_pause");
  }
  if (has(/^(nächster|naechster|nächstes|naechstes) (song|titel|lied|track)$|^(song|titel|lied) (weiter|überspringen)$|^skip$/)) {
    if (!isAgentOnline()) return ok(macNichtDa());
    await sendToAgent("music_next", { value: "" });
    return ok("Nächster Titel.", "mac:music_next");
  }
  if (has(/^(vorheriger|letzter|vorheriges) (song|titel|lied|track)$/)) {
    if (!isAgentOnline()) return ok(macNichtDa());
    await sendToAgent("music_previous", { value: "" });
    return ok("Ein Titel zurück.", "mac:music_previous");
  }
  if (has(/^(sperr|sperre) (den )?(mac|bildschirm|computer)$|^(mac|bildschirm) sperren$/)) {
    if (!isAgentOnline()) return ok(macNichtDa());
    await sendToAgent("lock_screen", { value: "" });
    return ok("Mac ist gesperrt.", "mac:lock_screen");
  }
  if (has(U(/\b(akku|batterie)\b.*\b(mac|stand|wie viel|wieviel|voll)\b|^(mac )?(akku|akkustand|batterie)$/))) {
    if (!isAgentOnline()) return ok(macNichtDa());
    const r = await sendToAgent("battery", { value: "" });
    return ok(r?.ok && r.result ? `Mac-Akku: ${String(r.result).slice(0, 120)}.` : "Den Akku konnte ich nicht abfragen.", "mac:battery");
  }
  const oeffne = t.match(/^(?:öffne|oeffne|öffnen|starte|start|zeig mir|mach|geh auf|gehe auf)\s+(?:mal\s+)?(?:die |das |den )?(?:app |seite |programm )?(.{1,30}?)(?:\s+(?:auf|an|bitte|app|auf dem mac))*$/);
  if (oeffne) {
    const ziel = oeffne[1].trim();
    if (WEB_ZIELE.includes(ziel) || Object.hasOwn(MAC_APPS, ziel)) {
      if (!isAgentOnline()) return ok(macNichtDa());
      const r = WEB_ZIELE.includes(ziel)
        ? await runTool("open_app", { name: ziel })
        : await sendToAgent("open_app", { value: MAC_APPS[ziel] });
      if (r && r.ok === false) return ok(r.error || "Das konnte ich nicht öffnen.");
      const schoen = ziel.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      return ok(pick([`${schoen} ist offen.`, `Öffne ${schoen}.`]), "open_app");
    }
  }

  // --- Protokolle: "starte Protokoll Feierabend", "Protokoll Hausparty" ---
  const prot = t.match(/^(?:starte |aktiviere |führe |fuehre )?(?:das )?(.+?)[- ]?protokoll(?: aus| starten| aktivieren)?$/) || t.match(/^(?:starte |aktiviere )?protokoll (.+?)(?: starten| aktivieren)?$/);
  if (prot) {
    const key = prot[1].trim();
    const all = getProtocols();
    const found = Object.keys(all).find((k) => k.toLowerCase() === key);
    if (found) {
      const r = await runTool("run_protocol", { name: found });
      if (r?.error) return ok(r.error);
      return ok(`Protokoll ${gross1(found)} läuft.`, "run_protocol");
    }
  }

  // --- Ab hier nur, wenn Claude nicht erreichbar ist ---
  if (!notfall) return null;

  if (has(/briefing|lagebericht|guten morgen/)) return ok(await offlineBriefing(), "briefing");
  const pn = plusNotfall(t);
  if (pn) return pn;
  if (/^(was gibt('s| es)|gibt('s| es) was) (neues|neue nachrichten)( heute| in der welt)?$|^was ist (heute |gerade )?(los|passiert)$/.test(t)) return weltlage(ok);
  const wiki = t.match(/^(?:wer|was) (?:ist|war|sind|waren) (?:eigentlich )?(?:der |die |das |ein |eine )?(.{2,60}?)$/)
    || t.match(/^(?:erzähl|erzaehl|sag) (?:mir )?(?:etwas|was|mehr) (?:über|ueber|zu) (?:der |die |das |den )?(.{2,60})$/)
    || t.match(/^(?:schlag|schlage) (.{2,60}?) nach$|^(?:wikipedia|lexikon) (.{2,60})$|^was weißt du über (?:der |die |das |den )?(.{2,60})$/);
  if (wiki) {
    const begriff = (wiki[1] || wiki[2] || wiki[3] || "").trim();
    if (begriff && begriff !== "mich") {
      const r = await getWiki(begriff).catch(() => ({ error: true }));
      if (!r.error) {
        const saetze = r.zusammenfassung.match(/[^.!?]+[.!?]+/g) || [r.zusammenfassung];
        return ok(saetze.slice(0, 2).map((x) => x.trim()).join(" "), "lookup");
      }
    }
  }
  return { answer: notfallText(), actions: ["offline"] };
}

async function weltlage(ok) {
  const list = getOverview().laender.filter((c) => c.top).sort((a, b) => b.meldungen - a.meldungen).slice(0, 3);
  if (!list.length) return ok("Das Lagezentrum sammelt gerade noch die Meldungen. Frag mich gleich nochmal.");
  return ok(`Die meisten Meldungen gibt es gerade aus ${list.map((c) => c.name).join(", ")}. ${list.map((c) => `${c.name}: ${c.top}`).join(". ")}.`, "world_news");
}

export function notfallText() {
  return `Mein großes Gehirn ist gerade offline, ${name()}, weil das Claude-Guthaben fehlt oder keine Verbindung besteht. ` +
    `Einfache Befehle gehen trotzdem: frag mich nach Uhrzeit, Wetter, Kursen oder Nachrichten, stell einen Timer oder sag: Was kannst du?`;
}
