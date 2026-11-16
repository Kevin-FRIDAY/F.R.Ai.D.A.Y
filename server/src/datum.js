// Datum und Uhrzeit auf Deutsch verstehen ("morgen um halb acht", "am Freitag", "am 24.11.") – ohne Claude.
// Alle Zeiten gelten in Fridays Zeitzone (config.timezone).
import { config } from "./config.js";

// JavaScript kennt bei \b nur englische Buchstaben. U() macht daraus echte Wortgrenzen (auch für ä, ö, ü, ß).
const WB = "(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))";
const uCache = new Map();
export function U(re) {
  const key = re.source + "/" + re.flags;
  if (!uCache.has(key)) uCache.set(key, new RegExp(re.source.replaceAll("\\b", WB), re.flags.includes("u") ? re.flags : re.flags + "u"));
  return uCache.get(key);
}

export function teile(ms = Date.now()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const wt = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second, wt };
}

// Ortszeit -> echter Zeitpunkt
export function ortszeit(y, m, d, h = 0, mi = 0) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const p = teile(guess);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - guess;
  return new Date(guess - offset);
}

// Kalendertag "heute + n" als {y,m,d}
export function tagPlus(n, basis = teile()) {
  const x = new Date(Date.UTC(basis.y, basis.m - 1, basis.d + n));
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
}

// Sekunden ab heute 0:00 Uhr (Wanduhr) -> echte Zeit
export function abHeute(sek, basis = teile()) {
  const w = new Date(Date.UTC(basis.y, basis.m - 1, basis.d) + sek * 1000);
  return ortszeit(w.getUTCFullYear(), w.getUTCMonth() + 1, w.getUTCDate(), w.getUTCHours(), w.getUTCMinutes());
}

// Wie viele Tage liegt das Datum von heute entfernt?
export function tageBis(date) {
  const h = teile(), p = teile(date.getTime());
  return Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(h.y, h.m - 1, h.d)) / 86400000);
}

export function uhrText(date) {
  const p = teile(date.getTime());
  return p.mi ? `${p.h}:${String(p.mi).padStart(2, "0")} Uhr` : `${p.h} Uhr`;
}

export function tagText(date) {
  const diff = tageBis(date);
  if (diff === 0) return "heute";
  if (diff === 1) return "morgen";
  if (diff === 2) return "übermorgen";
  if (diff === -1) return "gestern";
  if (diff > 0 && diff < 7) return `am ${date.toLocaleDateString("de-DE", { timeZone: config.timezone, weekday: "long" })}`;
  return `am ${date.toLocaleDateString("de-DE", { timeZone: config.timezone, weekday: "long", day: "numeric", month: "long" })}`;
}

const WOCHENTAGE = { sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonnabend: 6 };
const MONATE = { januar: 1, jan: 1, jänner: 1, februar: 2, feb: 2, märz: 3, maerz: 3, mär: 3, april: 4, apr: 4, mai: 5, juni: 6, jun: 6, juli: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, november: 11, nov: 11, dezember: 12, dez: 12 };
const ZAHLEN = { eins: 1, ein: 1, eine: 1, einem: 1, einen: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19, zwanzig: 20 };
const zahl = (w) => (/^\d+$/.test(w) ? Number(w) : ZAHLEN[w] ?? null);

/**
 * Findet einen Tag im Text.
 * @returns {{tag:{y,m,d}, plus:number, match:string} | null}
 */
export function findeTag(t) {
  const h = teile();
  let m;
  if ((m = t.match(U(/\b(übermorgen|uebermorgen)\b/)))) return { tag: tagPlus(2, h), plus: 2, match: m[0] };
  if ((m = t.match(U(/\b(heute|heut)( abend| früh| frueh| morgen| mittag| nachmittag)?\b/)))) return { tag: tagPlus(0, h), plus: 0, match: m[1] };
  if ((m = t.match(U(/\bmorgen\b/)))) return { tag: tagPlus(1, h), plus: 1, match: m[0] };
  if ((m = t.match(U(/\bin (\d+|[a-zäöü]+) tag(en)?\b/))) && zahl(m[1]) != null) {
    const n = zahl(m[1]);
    return { tag: tagPlus(n, h), plus: n, match: m[0] };
  }
  if ((m = t.match(U(/\b(?:am |an |diesen |kommenden |nächsten |naechsten )?(sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend)\b/)))) {
    const ziel = WOCHENTAGE[m[1]];
    let n = (ziel - h.wt + 7) % 7;
    if (n === 0 && /nächsten|naechsten|kommenden/.test(m[0])) n = 7;
    return { tag: tagPlus(n, h), plus: n, match: m[0] };
  }
  // "am 24.11." / "am 24.11.2026" / "24.11"
  if ((m = t.match(U(/\b(?:am |den )?(\d{1,2})\.\s?(\d{1,2})\.?(?:\s?(\d{2,4}))?(?!\d)/)))) {
    const d = +m[1], mo = +m[2];
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      let y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : h.y;
      if (!m[3] && Date.UTC(y, mo - 1, d) < Date.UTC(h.y, h.m - 1, h.d)) y++;
      return { tag: { y, m: mo, d }, plus: Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(h.y, h.m - 1, h.d)) / 86400000), match: m[0] };
    }
  }
  // "am 24. November"
  if ((m = t.match(U(/\b(?:am |den )?(\d{1,2})\.? (januar|jänner|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember|jan|feb|mär|apr|jun|jul|aug|sep|sept|okt|nov|dez)\b(?: (\d{4}))?/)))) {
    const d = +m[1], mo = MONATE[m[2]];
    let y = m[3] ? +m[3] : h.y;
    if (!m[3] && Date.UTC(y, mo - 1, d) < Date.UTC(h.y, h.m - 1, h.d)) y++;
    return { tag: { y, m: mo, d }, plus: Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(h.y, h.m - 1, h.d)) / 86400000), match: m[0] };
  }
  return null;
}

/**
 * Findet eine Uhrzeit im Text: "um 10", "um 10:30", "um 10 uhr 30", "um halb acht", "um viertel nach 3", "von 10 bis 12".
 * @returns {{h, mi, dauer?:number, match:string} | null}
 */
export function findeUhrzeit(t) {
  let m;
  const abends = U(/\b(abends?|nachmittags?|heute abend)\b/).test(t);
  const pm = (h) => (abends && h < 12 ? h + 12 : h);
  if ((m = t.match(U(/\bvon (\d{1,2})(?:[:.](\d{2}))?(?: uhr)? bis (\d{1,2})(?:[:.](\d{2}))?(?: uhr)?\b/)))) {
    const h1 = pm(+m[1]), mi1 = +(m[2] || 0), h2 = pm(+m[3]), mi2 = +(m[4] || 0);
    if (h1 < 24 && h2 < 24 && mi1 < 60 && mi2 < 60) {
      const dauer = (h2 * 60 + mi2) - (h1 * 60 + mi1);
      return { h: h1, mi: mi1, dauer: dauer > 0 ? dauer : 60, match: m[0] };
    }
  }
  if ((m = t.match(U(/\bum (halb|viertel nach|viertel vor|dreiviertel) (\d{1,2}|[a-zäöü]+)(?: uhr)?\b/)))) {
    const n = zahl(m[2]);
    if (n != null && n <= 24) {
      const art = m[1];
      let h = art === "viertel nach" ? n : n - 1, mi = art === "halb" ? 30 : art === "viertel nach" ? 15 : 45;
      if (h < 0) h = 23;
      return { h: pm(h), mi, match: m[0] };
    }
  }
  if ((m = t.match(U(/\bum (\d{1,2})(?:[:.](\d{2})| uhr (\d{1,2}))?(?: uhr)?\b/)))) {
    const h = +m[1], mi = +(m[2] || m[3] || 0);
    if (h < 24 && mi < 60) return { h: pm(h), mi, match: m[0] };
  }
  if ((m = t.match(U(/\bum ([a-zäöü]+)(?: uhr)?\b/))) && zahl(m[1]) != null && zahl(m[1]) <= 24) {
    return { h: pm(zahl(m[1]) % 24), mi: 0, match: m[0] };
  }
  if ((m = t.match(U(/\b(\d{1,2}):(\d{2})(?: uhr)?\b/)))) {
    const h = +m[1], mi = +m[2];
    if (h < 24 && mi < 60) return { h, mi, match: m[0] };
  }
  if ((m = t.match(U(/\b(\d{1,2}) uhr\b/))) && +m[1] < 24) return { h: pm(+m[1]), mi: 0, match: m[0] };
  return null;
}
