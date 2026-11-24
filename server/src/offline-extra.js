// Fridays Offline-Gehirn, Teil 2: noch mehr Befehle ohne Claude und ohne Guthaben.
// Weltzeit, Einheiten, Trinkgeld, Tage bis ..., Kalenderwoche, Wochentag, Mondphase, Sonne,
// Zufallszahl, Entscheidungshilfe, Zitate, Fakten, Atemübung, Mac-Zustand, Buchstabieren.
import { config } from "./config.js";
import { systemLive } from "./systemlive.js";
import { isAgentOnline } from "./agent-hub.js";
import { zufallsFakt as lexikonFakt } from "./wissensbank.js";

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const zahl = (v, stellen = 0) => Number(v).toLocaleString("de-DE", { maximumFractionDigits: stellen, minimumFractionDigits: 0 });
const euro = (v) => Number(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nr = (s) => (s == null ? null : Number(String(s).replace(",", ".")));
const gross1 = (x) => x.charAt(0).toUpperCase() + x.slice(1);
const ZAHLWORT = { ein: 1, eine: 1, einen: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, zwanzig: 20, fünfzig: 50, hundert: 100, tausend: 1000 };
const wert = (s) => (s == null ? null : /^\d/.test(s) ? nr(s) : ZAHLWORT[s] ?? null);

// Datumsteile in Fridays Zeitzone
function heuteTeile(tz = config.timezone, ms = Date.now()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}
const tagNr = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / 864e5);
const datumText = (y, m, d, opts = { weekday: "long", day: "numeric", month: "long" }) => new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("de-DE", { ...opts, timeZone: "UTC" });

// ---------- 1. Weltzeit ----------
const ZONEN = {
  "new york": "America/New_York", "newyork": "America/New_York", "usa": "America/New_York", "amerika": "America/New_York", "washington": "America/New_York", "miami": "America/New_York",
  "los angeles": "America/Los_Angeles", "kalifornien": "America/Los_Angeles", "san francisco": "America/Los_Angeles", "las vegas": "America/Los_Angeles",
  "chicago": "America/Chicago", "texas": "America/Chicago", "toronto": "America/Toronto", "kanada": "America/Toronto", "mexiko": "America/Mexico_City",
  "rio": "America/Sao_Paulo", "brasilien": "America/Sao_Paulo", "são paulo": "America/Sao_Paulo", "sao paulo": "America/Sao_Paulo", "buenos aires": "America/Argentina/Buenos_Aires", "argentinien": "America/Argentina/Buenos_Aires",
  "london": "Europe/London", "england": "Europe/London", "großbritannien": "Europe/London", "irland": "Europe/Dublin", "portugal": "Europe/Lisbon", "lissabon": "Europe/Lisbon",
  "paris": "Europe/Paris", "frankreich": "Europe/Paris", "rom": "Europe/Rome", "italien": "Europe/Rome", "madrid": "Europe/Madrid", "spanien": "Europe/Madrid", "mallorca": "Europe/Madrid",
  "wien": "Europe/Vienna", "österreich": "Europe/Vienna", "zürich": "Europe/Zurich", "schweiz": "Europe/Zurich", "kroatien": "Europe/Zagreb", "polen": "Europe/Warsaw",
  "athen": "Europe/Athens", "griechenland": "Europe/Athens", "istanbul": "Europe/Istanbul", "türkei": "Europe/Istanbul", "antalya": "Europe/Istanbul",
  "moskau": "Europe/Moscow", "russland": "Europe/Moscow", "kiew": "Europe/Kyiv", "ukraine": "Europe/Kyiv", "kairo": "Africa/Cairo", "ägypten": "Africa/Cairo",
  "kapstadt": "Africa/Johannesburg", "südafrika": "Africa/Johannesburg", "dubai": "Asia/Dubai", "emirate": "Asia/Dubai", "israel": "Asia/Jerusalem",
  "indien": "Asia/Kolkata", "mumbai": "Asia/Kolkata", "delhi": "Asia/Kolkata", "bangkok": "Asia/Bangkok", "thailand": "Asia/Bangkok", "bali": "Asia/Makassar",
  "singapur": "Asia/Singapore", "hongkong": "Asia/Hong_Kong", "peking": "Asia/Shanghai", "china": "Asia/Shanghai", "shanghai": "Asia/Shanghai",
  "tokio": "Asia/Tokyo", "tokyo": "Asia/Tokyo", "japan": "Asia/Tokyo", "seoul": "Asia/Seoul", "korea": "Asia/Seoul",
  "sydney": "Australia/Sydney", "australien": "Australia/Sydney", "melbourne": "Australia/Melbourne", "neuseeland": "Pacific/Auckland", "hawaii": "Pacific/Honolulu",
  "berlin": "Europe/Berlin", "deutschland": "Europe/Berlin", "hier": null,
};
function zonenVersatz(tz) {
  const a = heuteTeile(tz), b = heuteTeile(config.timezone);
  return Math.round(((tagNr(a.y, a.m, a.d) - tagNr(b.y, b.m, b.d)) * 1440 + (a.h - b.h) * 60 + (a.mi - b.mi)) / 30) / 2;
}
function weltzeit(ort) {
  const key = ort.replace(/^(der |die |den |dem )/, "").trim();
  if (!Object.hasOwn(ZONEN, key)) return null;
  const tz = ZONEN[key] || config.timezone;
  const zeit = new Date().toLocaleTimeString("de-DE", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const diff = zonenVersatz(tz);
  const hinweis = diff === 0 ? "genauso wie hier" : `${zahl(Math.abs(diff), 1)} ${Math.abs(diff) === 1 ? "Stunde" : "Stunden"} ${diff > 0 ? "später" : "früher"} als hier`;
  const tagA = heuteTeile(tz), tagB = heuteTeile(config.timezone);
  const tag = tagA.d !== tagB.d ? (tagNr(tagA.y, tagA.m, tagA.d) > tagNr(tagB.y, tagB.m, tagB.d) ? ", dort ist schon morgen" : ", dort ist noch gestern") : "";
  return `In ${key.split(" ").map(gross1).join(" ")} ist es jetzt ${zeit} Uhr, ${hinweis}${tag}.`;
}

// ---------- 2. Einheiten ----------
const EINHEITEN = {
  // Länge (Basis Meter)
  km: ["l", 1000, "Kilometer"], kilometer: ["l", 1000, "Kilometer"], meilen: ["l", 1609.344, "Meilen"], meile: ["l", 1609.344, "Meilen"],
  m: ["l", 1, "Meter"], meter: ["l", 1, "Meter"], fuß: ["l", 0.3048, "Fuß"], fuss: ["l", 0.3048, "Fuß"], feet: ["l", 0.3048, "Fuß"],
  cm: ["l", 0.01, "Zentimeter"], zentimeter: ["l", 0.01, "Zentimeter"], zoll: ["l", 0.0254, "Zoll"], inch: ["l", 0.0254, "Zoll"], mm: ["l", 0.001, "Millimeter"], millimeter: ["l", 0.001, "Millimeter"],
  yard: ["l", 0.9144, "Yard"], seemeilen: ["l", 1852, "Seemeilen"], seemeile: ["l", 1852, "Seemeilen"],
  // Gewicht (Basis Gramm)
  kg: ["g", 1000, "Kilogramm"], kilo: ["g", 1000, "Kilogramm"], kilogramm: ["g", 1000, "Kilogramm"], g: ["g", 1, "Gramm"], gramm: ["g", 1, "Gramm"],
  pfund: ["g", 453.59237, "Pfund (englisch)"], lbs: ["g", 453.59237, "Pfund (englisch)"], unzen: ["g", 28.349523, "Unzen"], unze: ["g", 28.349523, "Unzen"], tonnen: ["g", 1e6, "Tonnen"], tonne: ["g", 1e6, "Tonnen"],
  // Volumen (Basis Liter)
  liter: ["v", 1, "Liter"], l: ["v", 1, "Liter"], ml: ["v", 0.001, "Milliliter"], milliliter: ["v", 0.001, "Milliliter"], gallonen: ["v", 3.785411784, "Gallonen (US)"], gallone: ["v", 3.785411784, "Gallonen (US)"], tassen: ["v", 0.25, "Tassen"],
  // Geschwindigkeit (Basis km/h)
  "km/h": ["s", 1, "Kilometer pro Stunde"], kmh: ["s", 1, "Kilometer pro Stunde"], stundenkilometer: ["s", 1, "Kilometer pro Stunde"], mph: ["s", 1.609344, "Meilen pro Stunde"], knoten: ["s", 1.852, "Knoten"], "m/s": ["s", 3.6, "Meter pro Sekunde"],
  // Daten (Basis MB)
  gb: ["d", 1024, "Gigabyte"], gigabyte: ["d", 1024, "Gigabyte"], mb: ["d", 1, "Megabyte"], megabyte: ["d", 1, "Megabyte"], tb: ["d", 1048576, "Terabyte"], terabyte: ["d", 1048576, "Terabyte"],
};
const TEMP = { celsius: "c", "grad celsius": "c", "°c": "c", grad: "c", fahrenheit: "f", "grad fahrenheit": "f", "°f": "f", kelvin: "k" };
function umrechnen(t) {
  const alle = [...Object.keys(TEMP), ...Object.keys(EINHEITEN)].sort((a, b) => b.length - a.length).map((k) => k.replace(/\//g, "\\/")).join("|");
  const m = t.match(new RegExp(`(-?\\d+(?:[.,]\\d+)?|ein|eine|einen|zwei|drei|vier|fünf|zehn|hundert) ?(${alle}) (?:in|zu|nach|sind wie viel|sind wieviel) (${alle})(?: um)?$`, "u"));
  if (!m) return null;
  const n = wert(m[1]);
  if (n == null) return null;
  const [von, nach] = [m[2], m[3]];
  if (TEMP[von] && TEMP[nach]) {
    const a = TEMP[von], b = TEMP[nach];
    if (a === b) return null;
    const c = a === "c" ? n : a === "f" ? (n - 32) * 5 / 9 : n - 273.15;
    const out = b === "c" ? c : b === "f" ? c * 9 / 5 + 32 : c + 273.15;
    const nm = { c: "Grad Celsius", f: "Grad Fahrenheit", k: "Kelvin" };
    return `${zahl(n, 2)} ${nm[a]} sind ${zahl(out, 1)} ${nm[b]}.`;
  }
  const A = EINHEITEN[von], B = EINHEITEN[nach];
  if (!A || !B || A[0] !== B[0] || A === B) return null;
  const out = (n * A[1]) / B[1];
  return `${zahl(n, 3)} ${A[2]} sind ${zahl(out, out < 10 ? 3 : out < 1000 ? 2 : 0)} ${B[2]}.`;
}

// ---------- 3. Tage bis ... ----------
function ostern(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mon = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  return [mon, tag];
}
function nterSonntag(y, mon, n) {
  const erster = new Date(Date.UTC(y, mon - 1, 1)).getUTCDay();
  return [mon, 1 + ((7 - erster) % 7) + (n - 1) * 7];
}
const MONATE = { januar: 1, jänner: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };
const ANLAESSE = {
  weihnachten: () => [12, 24], heiligabend: () => [12, 24], silvester: () => [12, 31], neujahr: () => [1, 1], halloween: () => [10, 31],
  valentinstag: () => [2, 14], nikolaus: () => [12, 6], ostern: (y) => ostern(y), "tag der deutschen einheit": () => [10, 3],
  muttertag: (y) => nterSonntag(y, 5, 2), sommeranfang: () => [6, 21], winteranfang: () => [12, 21], frühlingsanfang: () => [3, 20], herbstanfang: () => [9, 22],
};
// "24.12.", "3.5.2027", "3. mai", "dem 3 mai 2027"
function datumLesen(s, heute) {
  let m = s.match(/(\d{1,2})\.\s?(\d{1,2})\.?(?:\s?(\d{2,4}))?/);
  let d, mon, y;
  if (m) { d = +m[1]; mon = +m[2]; y = m[3] ? +m[3] : null; }
  else {
    m = s.match(new RegExp(`(\\d{1,2})\\.? (${Object.keys(MONATE).join("|")})(?: (\\d{4}))?`, "u"));
    if (!m) return null;
    d = +m[1]; mon = MONATE[m[2]]; y = m[3] ? +m[3] : null;
  }
  if (y != null && y < 100) y += 2000;
  if (mon < 1 || mon > 12 || d < 1 || d > 31) return null;
  return { d, mon, y };
}
function tageBis(ziel) {
  const h = heuteTeile();
  const heute = tagNr(h.y, h.m, h.d);
  ziel = ziel.replace(/^(zum |zur |zu |an |am |dem |den |der |die |das )+/, "").replace(/\s+(noch|sind es|ist es|dauert es)$/g, "").trim();
  let name = null, y = h.y, mon, d;
  if (/^(zum )?wochenende$/.test(ziel) || ziel === "samstag") {
    const wt = new Date(Date.UTC(h.y, h.m - 1, h.d)).getUTCDay();
    const n = (6 - wt + 7) % 7;
    return n === 0 ? "Heute ist Samstag, das Wochenende ist schon da." : wt === 0 ? "Heute ist Sonntag, du bist mitten im Wochenende." : `Noch ${n} ${n === 1 ? "Tag" : "Tage"} bis zum Wochenende.`;
  }
  if (/^(meinem |mein )?geburtstag$/.test(ziel)) return null; // weiß Friday nicht sicher
  const anl = Object.keys(ANLAESSE).find((k) => ziel === k);
  if (anl) {
    name = gross1(anl);
    [mon, d] = ANLAESSE[anl](y);
    if (tagNr(y, mon, d) < heute) { y += 1; [mon, d] = ANLAESSE[anl](y); }
  } else {
    const p = datumLesen(ziel, h);
    if (!p) return null;
    ({ d, mon } = p);
    y = p.y ?? h.y;
    if (p.y == null && tagNr(y, mon, d) < heute) y += 1;
    name = datumText(y, mon, d, { day: "numeric", month: "long", year: "numeric" });
  }
  const n = tagNr(y, mon, d) - heute;
  const wann = datumText(y, mon, d);
  if (n === 0) return `${name} ist heute!`;
  if (n === 1) return `${name} ist schon morgen, am ${wann}.`;
  if (n < 0) return `Der ${name} ist schon ${-n} Tage her.`;
  const wochen = n >= 14 ? `, also etwa ${zahl(n / 7, 0)} Wochen` : "";
  return `Bis ${name} sind es noch ${zahl(n)} Tage${wochen}. Das ist ein ${wann}.`;
}

// ---------- 4. Kalenderwoche / Wochentag ----------
function kalenderwoche(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wt = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - wt);
  const jahrStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil(((dt - jahrStart) / 864e5 + 1) / 7);
}

// ---------- 5. Mond ----------
const SYNODISCH = 29.530588853;
const NEUMOND_2000 = Date.UTC(2000, 0, 6, 18, 14);
function mondphase(ms = Date.now()) {
  const alter = ((((ms - NEUMOND_2000) / 864e5) % SYNODISCH) + SYNODISCH) % SYNODISCH;
  const phasen = [[1.85, "Neumond"], [5.54, "zunehmende Sichel"], [9.23, "zunehmender Halbmond"], [12.92, "zunehmender Mond"], [16.61, "Vollmond"], [20.3, "abnehmender Mond"], [23.99, "abnehmender Halbmond"], [27.68, "abnehmende Sichel"], [30, "Neumond"]];
  const name = phasen.find(([g]) => alter < g)[1];
  const hell = Math.round(((1 - Math.cos((2 * Math.PI * alter) / SYNODISCH)) / 2) * 100);
  const bisVoll = (SYNODISCH / 2 - alter + SYNODISCH) % SYNODISCH;
  const bisNeu = SYNODISCH - alter;
  return { name, hell, bisVoll, bisNeu };
}
const tageText = (x) => { const n = Math.round(x); return n === 0 ? "heute" : n === 1 ? "morgen" : `in ${n} Tagen`; };

// ---------- 6. Sonne (Open-Meteo, kostenlos) ----------
async function sonne() {
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=${encodeURIComponent(config.city)}`, { signal: AbortSignal.timeout(9000) }).then((r) => r.json());
  const p = geo.results?.[0];
  if (!p) return null;
  const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&daily=sunrise,sunset,daylight_duration&forecast_days=2&timezone=auto`, { signal: AbortSignal.timeout(9000) }).then((r) => r.json());
  const hm = (iso) => iso.slice(11, 16).replace(/^0/, "");
  return { ort: p.name, auf: hm(w.daily.sunrise[0]), unter: hm(w.daily.sunset[0]), aufMorgen: hm(w.daily.sunrise[1]), dauer: w.daily.daylight_duration[0] / 3600 };
}

// ---------- 7. Zitate, Fakten, Buchstaben ----------
const ZITATE = [
  "Der beste Weg, die Zukunft vorherzusagen, ist, sie zu erschaffen. Peter Drucker.",
  "Es ist nicht wenig Zeit, die wir haben, sondern viel Zeit, die wir nicht nutzen. Seneca.",
  "Wer immer tut, was er schon kann, bleibt immer das, was er schon ist. Henry Ford.",
  "Erfolg ist nicht endgültig, Misserfolg ist nicht fatal. Was zählt, ist der Mut weiterzumachen. Winston Churchill.",
  "Mach es einfach. Und wenn es nicht klappt, mach es anders. Tony Stark würde es genauso sehen.",
  "Disziplin ist die Brücke zwischen Zielen und Erfolg. Jim Rohn.",
  "Auch der längste Weg beginnt mit dem ersten Schritt. Laozi.",
  "Die Zukunft hängt davon ab, was du heute tust. Mahatma Gandhi.",
  "Fang an, wo du bist. Nutze, was du hast. Tu, was du kannst. Arthur Ashe.",
  "Kleine Schritte jeden Tag schlagen große Pläne, die nie anfangen.",
  "Wenn du es träumen kannst, kannst du es auch machen. Walt Disney.",
  "Motivation bringt dich in Gang. Gewohnheit bringt dich weiter. Jim Ryun.",
];
const FAKTEN = [
  "Ein Tag auf der Venus dauert länger als ein Jahr auf der Venus.",
  "Honig wird nie schlecht. In ägyptischen Gräbern hat man über 3000 Jahre alten, noch essbaren Honig gefunden.",
  "Oktopusse haben drei Herzen und blaues Blut.",
  "Die Internationale Raumstation umrundet die Erde etwa alle 90 Minuten, also rund 16 Mal am Tag.",
  "Bananen sind botanisch gesehen Beeren, Erdbeeren dagegen nicht.",
  "Ein Blitz ist etwa fünfmal heißer als die Oberfläche der Sonne.",
  "Das menschliche Gehirn verbraucht rund 20 Prozent der Energie des ganzen Körpers.",
  "Licht braucht von der Sonne zur Erde etwa 8 Minuten und 20 Sekunden.",
  "Kühe haben beste Freundinnen und sind gestresst, wenn man sie trennt.",
  "Auf der Erde gibt es mehr Bäume als Sterne in der Milchstraße, etwa drei Billionen.",
  "Der Eiffelturm ist im Sommer bis zu 15 Zentimeter höher, weil sich das Eisen in der Hitze ausdehnt.",
  "Haie gab es schon vor den Bäumen. Sie schwimmen seit über 400 Millionen Jahren durch die Meere.",
  "Ein Mensch blinzelt etwa 15 bis 20 Mal pro Minute.",
  "Der erste Computer-Bug war eine echte Motte, die 1947 in einem Rechner gefunden wurde.",
];
const BUCHSTABEN = {
  a: "Anton", b: "Berta", c: "Cäsar", d: "Dora", e: "Emil", f: "Friedrich", g: "Gustav", h: "Heinrich", i: "Ida", j: "Julius", k: "Kaufmann", l: "Ludwig", m: "Martha",
  n: "Nordpol", o: "Otto", p: "Paula", q: "Quelle", r: "Richard", s: "Samuel", t: "Theodor", u: "Ulrich", v: "Viktor", w: "Wilhelm", x: "Xanthippe", y: "Ypsilon", z: "Zacharias",
  ä: "Ärger", ö: "Ökonom", ü: "Übermut", ß: "Eszett", 0: "Null", 1: "Eins", 2: "Zwo", 3: "Drei", 4: "Vier", 5: "Fünf", 6: "Sechs", 7: "Sieben", 8: "Acht", 9: "Neun",
};

// ---------- Hauptfunktion ----------
// t = schon vereinfachter Text (klein, ohne "Friday,"). Gibt eine Antwort zurück oder null.
export async function extraAnswer(t, ok) {
  // Weltzeit: "wie spät ist es in tokio", "uhrzeit in new york"
  let m = t.match(/^(?:wie spät|wie spaet|wie viel uhr|wieviel uhr)(?: ist es)?(?: gerade| jetzt)? (?:in|auf) (.{2,30})$|^(?:uhrzeit|zeit) in (.{2,30})$/u);
  if (m) { const a = weltzeit(m[1] || m[2]); if (a) return ok(a, "weltzeit"); }

  // Einheiten: "10 km in meilen", "wie viel sind 30 grad celsius in fahrenheit"
  const ut = t.replace(/^(?:wie ?viel sind|wie ?viel ist|was sind|was ist|rechne|rechne um|umrechnen)\s+/u, "").replace(/\s+(?:umrechnen|um)$/u, "");
  const u = umrechnen(ut);
  if (u) return ok(u, "umrechnen");

  // Trinkgeld: "trinkgeld für 45 euro", "wie viel trinkgeld bei 38,50"
  m = t.match(/trinkgeld (?:für|fuer|bei|auf|von) (\d+(?:[.,]\d+)?)/u);
  if (m) {
    const b = nr(m[1]);
    const zehn = b * 0.1, fuenfzehn = b * 0.15;
    const rund = Math.ceil((b + zehn) / (b > 50 ? 5 : 1)) * (b > 50 ? 5 : 1);
    return ok(`Bei ${euro(b)} Euro sind zehn Prozent ${euro(zehn)} Euro und fünfzehn Prozent ${euro(fuenfzehn)} Euro. Einfach aufgerundet auf ${zahl(rund)} Euro passt gut.`, "trinkgeld");
  }

  // Tage bis: "wie viele tage bis weihnachten", "wann ist ostern", "wie lange noch bis zum 24.12."
  m = t.match(/^(?:wie ?viele tage|wie lange|wieviele tage|wie viele wochen)(?: (?:sind es|ist es|dauert es|noch))* bis (.{3,40})$/u) || t.match(/^(?:wann ist|wann sind|wann ist dieses jahr|wann ist nächstes jahr) (weihnachten|heiligabend|silvester|neujahr|halloween|valentinstag|nikolaus|ostern|muttertag|sommeranfang|winteranfang|frühlingsanfang|herbstanfang|tag der deutschen einheit)$/u);
  if (m) { const a = tageBis(m[1]); if (a) return ok(a, "tage_bis"); }

  // Kalenderwoche
  if (/\b(kalenderwoche|welche kw|kw heute|welche woche haben wir)\b/u.test(t)) {
    const h = heuteTeile();
    return ok(`Wir haben Kalenderwoche ${kalenderwoche(h.y, h.m, h.d)}.`, "kalenderwoche");
  }

  // Wochentag eines Datums: "welcher wochentag ist der 3.5.2027", "was für ein tag ist der 24.12."
  m = t.match(/^(?:welcher (?:wochen)?tag|was für ein tag|was fuer ein tag|welchen tag haben wir) (?:ist|war|wird|haben wir) (?:der |am |den )?(.{3,30})$/u);
  if (m && !/^heute$/.test(m[1])) {
    const p = datumLesen(m[1], heuteTeile());
    if (p) {
      const y = p.y ?? heuteTeile().y;
      return ok(`Der ${datumText(y, p.mon, p.d, { day: "numeric", month: "long", year: "numeric" })} ist ein ${datumText(y, p.mon, p.d, { weekday: "long" })}, in Kalenderwoche ${kalenderwoche(y, p.mon, p.d)}.`, "wochentag");
    }
  }

  // Mondphase
  if (/\b(mondphase|vollmond|neumond|welcher mond|wie steht der mond|mond heute)\b/u.test(t)) {
    const mo = mondphase();
    const voll = mo.name === "Vollmond" ? "Heute ist Vollmond." : `Nächster Vollmond ${tageText(mo.bisVoll)}.`;
    return ok(`Gerade ist ${mo.name}, der Mond ist zu ${mo.hell} Prozent beleuchtet. ${voll} Neumond ${tageText(mo.bisNeu)}.`, "mond");
  }

  // Sonnenauf- und -untergang
  if (/\b(sonnenaufgang|sonnenuntergang|sonne (auf|unter)|wann wird es (dunkel|hell)|wie lange ist es (heute )?hell|tageslicht)\b/u.test(t)) {
    const s = await sonne().catch(() => null);
    if (!s) return ok("Die Sonnenzeiten konnte ich gerade nicht abrufen.");
    const h = Math.floor(s.dauer), mi = Math.round((s.dauer - h) * 60);
    if (/untergang|unter|dunkel/.test(t)) return ok(`In ${s.ort} geht die Sonne heute um ${s.unter} Uhr unter. Aufgegangen ist sie um ${s.auf} Uhr.`, "sonne");
    if (/hell ist|tageslicht/.test(t)) return ok(`Heute gibt es in ${s.ort} ${h} Stunden und ${mi} Minuten Tageslicht, von ${s.auf} bis ${s.unter} Uhr.`, "sonne");
    return ok(`In ${s.ort} geht die Sonne heute um ${s.auf} Uhr auf und um ${s.unter} Uhr unter. Morgen geht sie um ${s.aufMorgen} Uhr auf.`, "sonne");
  }

  // Zufallszahl: "zufallszahl zwischen 1 und 50", "nenn mir eine zahl von 1 bis 10"
  m = t.match(/(?:zufallszahl|zufällige zahl|zufaellige zahl|zahl)(?: zwischen| von) (-?\d+) (?:und|bis) (-?\d+)/u);
  if (m || /^(zufallszahl|zufällige zahl|nenn mir eine zahl)$/u.test(t)) {
    let a = m ? +m[1] : 1, b = m ? +m[2] : 100;
    if (a > b) [a, b] = [b, a];
    if (b - a <= 1e9) return ok(`Deine Zahl: ${zahl(a + Math.floor(Math.random() * (b - a + 1)))}.`, "zufall");
  }

  // Entscheidungshilfe: "soll ich pizza oder sushi essen"
  m = t.match(/^(?:soll ich|sollen wir|lieber) (.{2,40}?) oder (.{2,40}?)\??$/u);
  if (m && !/^(nicht|lieber nicht|nein)$/.test(m[2])) {
    const wahl = pick([m[1], m[2]]).replace(/^(heute |jetzt )/, "");
    return ok(pick([`Ich würde sagen: ${wahl}.`, `Mein Gefühl sagt: ${wahl}.`, `Ganz klar ${wahl}. Aber die letzte Entscheidung liegt bei dir.`]), "entscheidung");
  }

  // Zitate und Motivation
  if (/\b(motivier mich|motiviere mich|zitat des tages|ein zitat|spruch des tages|inspirier mich|inspiriere mich|ich brauche motivation)\b/u.test(t)) return ok(pick(ZITATE), "zitat");

  // Fakten
  if (/^(?:(?:erzähl|erzaehl|sag|nenn)(?: mir)? (?:einen |ein |noch einen )?(?:fakt|fun fact|interessanten fakt)|fun fact|fakt des tages|überrasch mich|ueberrasch mich|wusstest du(?: schon)?|erzähl mir was interessantes|erzaehl mir was interessantes)$/u.test(t)) { const lf = lexikonFakt(); return ok(lf && Math.random() < 0.9 ? lf : pick(FAKTEN), "fakt"); }

  // Atemübung
  if (/\b(atemübung|atemuebung|atem übung|beruhige mich|ich bin gestresst|ich bin nervös|hilf mir (zu )?entspannen|entspannungsübung)\b/u.test(t)) {
    return ok("Okay, machen wir zusammen eine kurze Atemübung. Setz dich bequem hin. Atme vier Sekunden durch die Nase ein. Halte die Luft vier Sekunden an. " +
      "Atme vier Sekunden langsam durch den Mund aus. Und warte vier Sekunden. Wiederhole das vier Mal. Du machst das gut.", "atem");
  }

  // Zustand des Macs: "wie geht es dem mac", "wie voll ist die festplatte", "wie viel speicher ist frei"
  if (/^(?:wie geht(?:'s| es|s) dem (?:mac|server|system|rechner)|wie ausgelastet ist (?:der|mein) (?:mac|rechner|server)|(?:mac|cpu|prozessor)[- ]?auslastung|wie voll ist (?:die|meine) festplatte|wie ?viel (?:speicher|speicherplatz|platz) (?:ist|habe ich|hab ich) (?:noch )?(?:frei|übrig)|mac[- ]?status|zustand des macs)$/u.test(t)) {
    const s = systemLive();
    const teile = [`Der Prozessor ist zu ${s.cpu.prozent} Prozent ausgelastet, der Arbeitsspeicher zu ${s.ram.prozent} Prozent.`];
    if (s.platte) teile.push(`Auf der Festplatte sind noch ${zahl(s.platte.freiGB, 0)} Gigabyte frei.`);
    const std = Math.floor(s.friday.laufzeit / 3600);
    teile.push(`Ich laufe seit ${std >= 1 ? `${std} ${std === 1 ? "Stunde" : "Stunden"}` : (() => { const mi = Math.max(1, Math.round(s.friday.laufzeit / 60)); return `${mi} ${mi === 1 ? "Minute" : "Minuten"}`; })()} ohne Pause.`);
    if (!isAgentOnline()) teile.push("Der Mac-Agent ist gerade nicht verbunden.");
    const warn = s.cpu.prozent > 85 || s.ram.prozent > 92 || (s.platte && s.platte.prozent > 92);
    teile.unshift(warn ? "Achtung, der Mac ist gerade ziemlich gefordert." : "Alles im grünen Bereich.");
    return ok(teile.join(" "), "systemstatus");
  }

  // Buchstabieren: "buchstabiere friday"
  m = t.match(/^(?:buchstabiere|buchstabier|wie buchstabiert man) (.{1,30})$/u);
  if (m) {
    const w = m[1].replace(/\s+/g, "");
    const teile = [...w].map((c) => BUCHSTABEN[c] || c.toUpperCase()).join(", ");
    return ok(`${gross1(w)} buchstabiert: ${teile}.`, "buchstabieren");
  }

  return null;
}

// Für den Hilfe-Text
export const EXTRA_HILFE = "Außerdem kenne ich die Uhrzeit in anderen Ländern, rechne Einheiten und Trinkgeld um, zähle die Tage bis Weihnachten oder zu jedem Datum, " +
  "nenne Kalenderwoche, Mondphase und Sonnenuntergang, würfle Zahlen, helfe bei Entscheidungen, motiviere dich, erzähle Fakten, mache eine Atemübung mit dir und sage dir, wie es dem Mac geht.";
