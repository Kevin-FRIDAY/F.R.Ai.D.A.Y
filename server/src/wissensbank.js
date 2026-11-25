// Fridays Lexikon (v1.156.0): eingebautes Wissen OHNE Claude und OHNE Internet.
// Seit v1.165.0 rund 7.900 Einträge in über 35 Bereichen (vorher 1.600): alle 118 chemischen Elemente, Weltraum,
// Bundesländer, deutsche Städte, Städte der Welt, 197 Länder mit Hauptstadt und Währung, Geschichte mit Jahreszahlen,
// berühmte Menschen, Erfindungen, Technik & KI, Geld, Natur, Erde, Tiere, Pflanzen, Körper & Gesundheit, Essen,
// Notfall, Kochen, Mac-/iPhone-Tipps, Abkürzungen, Fremdwörter, Sprichwörter, Englisch-Wörter, Berufe, Politik,
// Musik, Kunst & Kultur, Religion & Mythologie, Firmen & Marken, Autos, Mathe, Sport, Kalender & Feiertage,
// Alltag & Recht und über 350 „Wusstest du?“-Fakten.
//
// Die Inhalte liegen als einfache Textdateien in server/daten/lexikon/*.txt (eine Zeile = ein Eintrag,
// Felder mit | getrennt). Neue Einträge: einfach eine Zeile in die passende Datei schreiben, Friday lädt sie beim Start.
// Sprachbefehle: „Was ist ein ETF?“, „Wer war Marie Curie?“, „Wer hat das Telefon erfunden?“, „Was passierte 1989?“,
// „Ordnungszahl von Gold“, „Hauptstadt von Bayern“, „Was bedeutet DSGVO?“, „Wie hoch ist die Zugspitze?“, „öffne das Lexikon“,
// „Was heißt Schmetterling auf Englisch?“, „Was bedeutet empathisch?“, „Wie viele Einwohner hat Paris?“, „In welchem Land liegt Porto?“.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COUNTRIES } from "./lagezentrum.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const LEXIKON_DIR = process.env.FRIDAY_LEXIKON_DIR || path.resolve(here, "..", "daten", "lexikon");

/** Text für den Vergleich: klein, Umlaute aufgelöst, nur Buchstaben/Ziffern/Leerzeichen. */
export function norm(s) {
  return String(s ?? "").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9+ ]+/g, " ").replace(/\s+/g, " ").trim();
}
const gross = (s) => String(s || "").replace(/^\s*./, (c) => c.toUpperCase());
const punkt = (s) => { const t = String(s || "").trim(); return !t ? "" : /[.!?)]$/.test(t) ? t : t + "."; };
const aliasListe = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

const GRUPPE_PLURAL = { Nichtmetall: "Nichtmetallen", Edelgas: "Edelgasen", Alkalimetall: "Alkalimetallen", Erdalkalimetall: "Erdalkalimetallen", Halbmetall: "Halbmetallen", Halogen: "Halogenen", Übergangsmetall: "Übergangsmetallen", Metall: "Metallen", Lanthanoid: "Lanthanoiden", Actinoid: "Actinoiden" };

// Deutsche Namen für Hauptstädte, die in den Länderdaten englisch stehen.
const HAUPTSTADT_DE = {
  Cairo: "Kairo", Rome: "Rom", Moscow: "Moskau", Warsaw: "Warschau", Prague: "Prag", Vienna: "Wien", Copenhagen: "Kopenhagen",
  Brussels: "Brüssel", "City of Brussels": "Brüssel", Lisbon: "Lissabon", Athens: "Athen", Bucharest: "Bukarest", Belgrade: "Belgrad", Kyiv: "Kiew", Kiev: "Kiew",
  Beijing: "Peking", Tokyo: "Tokio", "New Delhi": "Neu-Delhi", "Mexico City": "Mexiko-Stadt", "Washington, D.C.": "Washington", "Washington D.C.": "Washington",
  Nicosia: "Nikosia", Luxembourg: "Luxemburg", Algiers: "Algier", Tripoli: "Tripolis", Damascus: "Damaskus", Baghdad: "Bagdad", Tehran: "Teheran",
  Riyadh: "Riad", Havana: "Havanna", Pyongyang: "Pjöngjang", Singapore: "Singapur", Tbilisi: "Tiflis", Yerevan: "Eriwan", "Chișinău": "Chișinău",
  "Vatican City": "Vatikanstadt", "Addis Ababa": "Addis Abeba", Khartoum: "Khartum", Mogadishu: "Mogadischu", Kuwait: "Kuwait-Stadt", "Kuwait City": "Kuwait-Stadt",
  "Guatemala City": "Guatemala-Stadt", "Panama City": "Panama-Stadt", "Ho Chi Minh City": "Ho-Chi-Minh-Stadt", Jerusalem: "Jerusalem", Bern: "Bern",
  Reykjavik: "Reykjavík", Valletta: "Valletta", Sofia: "Sofia", Bratislava: "Bratislava", Vilnius: "Vilnius", "Tunis": "Tunis", Beirut: "Beirut",
  "Abu Dhabi": "Abu Dhabi", Doha: "Doha", Muscat: "Maskat", "Sana'a": "Sanaa", Amman: "Amman", Ankara: "Ankara", Kathmandu: "Kathmandu",
  "Phnom Penh": "Phnom Penh", "Port Louis": "Port Louis", "Santo Domingo": "Santo Domingo", Bogotá: "Bogotá", Brasília: "Brasília",
};
const WAEHRUNG_DE = {
  EUR: "Euro", USD: "US-Dollar", GBP: "Pfund Sterling", CHF: "Schweizer Franken", JPY: "Yen", CNY: "Renminbi Yuan", RUB: "Rubel", INR: "Indische Rupie",
  TRY: "Türkische Lira", PLN: "Złoty", SEK: "Schwedische Krone", NOK: "Norwegische Krone", DKK: "Dänische Krone", CZK: "Tschechische Krone", HUF: "Forint",
  CAD: "Kanadischer Dollar", AUD: "Australischer Dollar", NZD: "Neuseeland-Dollar", BRL: "Real", MXN: "Mexikanischer Peso", ARS: "Argentinischer Peso",
  KRW: "Won", EGP: "Ägyptisches Pfund", ZAR: "Rand", UAH: "Hrywnja", RON: "Leu", BGN: "Lew", RSD: "Serbischer Dinar", ISK: "Isländische Krone",
  ILS: "Schekel", SAR: "Saudi-Riyal", AED: "Dirham", THB: "Baht", VND: "Dong", IDR: "Rupiah", PHP: "Philippinischer Peso", MYR: "Ringgit", SGD: "Singapur-Dollar",
  HKD: "Hongkong-Dollar", PKR: "Pakistanische Rupie", NGN: "Naira", KES: "Kenia-Schilling", MAD: "Marokkanischer Dirham", CLP: "Chilenischer Peso",
  COP: "Kolumbianischer Peso", PEN: "Sol", IRR: "Iranischer Rial", IQD: "Irakischer Dinar", QAR: "Katar-Riyal", KWD: "Kuwait-Dinar", BDT: "Taka",
};
const REGION_DE = { Africa: "Afrika", Americas: "Amerika", Asia: "Asien", Europe: "Europa", Oceania: "Ozeanien", Antarctic: "Antarktis" };

// ---------- Laden ----------
let STAND = null;

function leseDatei(datei) {
  const roh = fs.readFileSync(datei, "utf8").split(/\r?\n/);
  const kopf = (roh[0] || "").replace(/^#\s*/, "").split("|");
  const kat = { id: (kopf[0] || path.basename(datei, ".txt")).trim(), name: (kopf[1] || "").trim(), icon: (kopf[2] || "•").trim() };
  const zeilen = roh.slice(1).filter((z) => z.trim() && !z.startsWith("#")).map((z) => z.split("|").map((x) => x.trim()));
  return { kat, zeilen };
}

function eintragAus(kat, z, i) {
  const id = `${kat}-${i}`;
  switch (kat) {
    case "elemente": {
      const [nr, sym, name, masse, gruppe, zusatz] = z;
      const m = String(masse || "");
      const masseText = m.startsWith("[") ? `Es ist radioaktiv, sein langlebigstes Isotop hat die Massenzahl ${m.replace(/[[\]]/g, "")}.` : `Die Atommasse beträgt rund ${m} u.`;
      return {
        id, kat, titel: name, nr: Number(nr), symbol: sym, gruppe, zusatz: punkt(zusatz),
        text: `${name}, chemisches Zeichen ${sym}, ist das Element mit der Ordnungszahl ${nr}. ${masseText} Es gehört zu den ${GRUPPE_PLURAL[gruppe] || gruppe}. ${punkt(zusatz)}`.trim(),
        info: `${sym} · Nr. ${nr}`, aliase: [`element ${nr}`, `${name} element`, `chemisches element ${name}`],
      };
    }
    case "bundeslaender": {
      const [name, haupt, einw, flaeche, zusatz, aliase] = z;
      const stadtstaat = norm(name) === norm(haupt);
      const satz = stadtstaat
        ? `${name} ist Stadt und Bundesland zugleich, mit rund ${einw} Einwohnern auf ${flaeche} Quadratkilometern.`
        : `${name} ist ein deutsches Bundesland mit der Hauptstadt ${haupt}, rund ${einw} Einwohnern und ${flaeche} Quadratkilometern Fläche.`;
      return { id, kat, titel: name, hauptstadt: haupt, einwohner: einw, zusatz: punkt(zusatz), text: `${satz} ${punkt(zusatz)}`.trim(), info: `Hauptstadt ${haupt}`, aliase: aliasListe(aliase) };
    }
    case "staedte": {
      const [name, land, einw, zusatz, aliase] = z;
      const klein = /^\d{2}\.\d{3}$/.test(einw) && parseInt(einw, 10) < 100;
      const wo = norm(land) === norm(name) ? "und zugleich ein eigenes Bundesland" : `in ${land}`;
      return { id, kat, titel: name, bundesland: land, einwohner: einw, zusatz: punkt(zusatz), text: `${name} ist eine ${klein ? "Stadt" : "Großstadt"} ${wo} mit rund ${einw} Einwohnern. ${punkt(zusatz)}`.trim(), info: land, aliase: aliasListe(aliase) };
    }
    case "personen": {
      const [name, leben, was, aliase] = z;
      const l = String(leben || "").replace(/–/g, " bis ");
      return { id, kat, titel: name, text: `${name}, ${l}: ${punkt(gross(was))}`, info: leben, aliase: aliasListe(aliase) };
    }
    case "geschichte": {
      const [jahr, titel, text, aliase] = z;
      const j = Number(jahr);
      return { id, kat, titel, jahr: j, text: punkt(text), info: j < 0 ? `${-j} v. Chr.` : String(j), aliase: aliasListe(aliase) };
    }
    case "erfindungen": {
      const [titel, wer, jahr, zusatz, aliase] = z;
      const wann = /jahrhundert/i.test(jahr) ? `im ${jahr}` : /^\d{4}er$/.test(jahr) ? `in den ${jahr}-Jahren` : jahr;
      return { id, kat, titel, erfinder: wer, wann: jahr, text: `${titel}: erfunden ${wann} von ${wer}. ${punkt(zusatz)}`.trim(), info: `${jahr} · ${wer}`, aliase: aliasListe(aliase) };
    }
    case "abkuerzungen": {
      const [kurz, lang, aliase] = z;
      return { id, kat, titel: kurz, text: `${kurz} steht für ${punkt(lang)}`, info: "Abkürzung", aliase: aliasListe(aliase) };
    }
    case "weltstaedte": {
      const [name, staat, einw, zusatz, aliase] = z;
      const nameOhne = String(name || "").replace(/\s*\(.*\)\s*$/, "");
      if (!nameOhne || !staat) return null;
      return { id, kat, titel: name, staat, einwohner: einw, zusatz: punkt(zusatz), text: `${nameOhne} ist eine Stadt in ${staat} mit rund ${einw} Einwohnern. ${punkt(zusatz)}`.trim(), info: staat, aliase: aliasListe(aliase) };
    }
    case "fremdwoerter": {
      const [wort, bedeutung, aliase] = z;
      if (!wort || !bedeutung) return null;
      return { id, kat, titel: wort, text: `${wort} bedeutet: ${punkt(bedeutung)}`, info: "Fremdwort", aliase: aliasListe(aliase) };
    }
    case "sprichwoerter": {
      const [spruch, bedeutung, aliase] = z;
      if (!spruch || !bedeutung) return null;
      return { id, kat, titel: spruch, text: `„${spruch}“ bedeutet: ${punkt(bedeutung)}`, info: "Redewendung", aliase: aliasListe(aliase) };
    }
    case "englisch": {
      const [de, en, aliase] = z;
      if (!de || !en) return null;
      const wort = de.replace(/\s*\(.*\)\s*$/, "");
      const freund = /falscher freund/i.test(de);
      // englisches Hauptwort für die Rückrichtung: "flat (britisch) oder apartment" → "flat"
      const enWort = freund ? "" : en.replace(/^to /, "").split(/ \(| oder |,|\?/)[0].trim();
      const a = [`${wort} auf englisch`, `${wort} englisch`, `englisch ${wort}`, `englisches wort fuer ${wort}`];
      if (enWort && enWort.length > 1) a.push(`${enWort} auf deutsch`, `${enWort} deutsch`);
      return {
        id, kat, titel: de, nurAlias: true,
        text: freund ? punkt(en) : `„${wort}“ heißt auf Englisch: ${punkt(en)}`,
        info: freund ? "Falscher Freund" : en.split(/,|\?/)[0], aliase: [...a, ...aliasListe(aliase)],
      };
    }
    case "fakten":
      return { id, kat, titel: z.join("|").slice(0, 70), text: punkt(z.join("|")), fakt: true, aliase: [] };
    default: {
      const [titel, text, aliase] = z;
      if (!titel || !text) return null;
      return { id, kat, titel, text: punkt(text), aliase: aliasListe(aliase) };
    }
  }
}

function laenderEintraege() {
  const out = [];
  for (const c of COUNTRIES || []) {
    if (!c?.name) continue;
    const haupt = HAUPTSTADT_DE[c.cap] || c.cap || "";
    const w = c.cur ? WAEHRUNG_DE[c.cur] || c.cur : "";
    const region = REGION_DE[c.region] || c.region || "";
    const teile = [`${c.flag ? c.flag + " " : ""}${c.name} liegt in ${region || "der Welt"}.`];
    if (haupt) teile.push(`Die Hauptstadt ist ${haupt}.`);
    if (w) teile.push(`Bezahlt wird mit ${w}.`);
    out.push({ id: `land-${c.id}`, kat: "laender", titel: c.name, hauptstadt: haupt, land: c, text: teile.join(" "), info: haupt ? `Hauptstadt ${haupt}` : region, aliase: [c.en].filter(Boolean) });
  }
  return out;
}

export function laden(neu = false) {
  if (STAND && !neu) return STAND;
  const kategorien = [];
  const eintraege = [];
  let dateien = [];
  try { dateien = fs.readdirSync(LEXIKON_DIR).filter((f) => f.endsWith(".txt")).sort(); } catch { /* kein Ordner */ }
  for (const f of dateien) {
    try {
      const { kat, zeilen } = leseDatei(path.join(LEXIKON_DIR, f));
      let n = 0;
      zeilen.forEach((z, i) => { const e = eintragAus(kat.id, z, i); if (e) { eintraege.push(e); n++; } });
      kategorien.push({ ...kat, n });
    } catch (err) { console.error(`Lexikon ${f}:`, err.message); }
  }
  try {
    const l = laenderEintraege();
    eintraege.push(...l);
    kategorien.push({ id: "laender", name: "Länder der Welt", icon: "🗺️", n: l.length });
  } catch { /* Länderliste optional */ }
  // Suchindex: normierte Titel und Aliase → Einträge
  const index = new Map();
  const add = (k, e) => { const n = norm(k); if (!n) return; if (!index.has(n)) index.set(n, []); if (!index.get(n).includes(e)) index.get(n).push(e); };
  for (const e of eintraege) {
    if (e.fakt) continue;
    if (!e.nurAlias) { // Englisch-Wörter nur über "X auf Englisch" finden, sonst wäre "Kopf" eine Vokabel
      add(e.titel, e);
      add(e.titel.replace(/\s*\(.*\)\s*$/, ""), e); // "Titan (Mond)" → "titan"
    }
    for (const a of e.aliase || []) add(a, e);
    if (e.kat === "personen") { const teile = e.titel.split(" "); if (teile.length > 1) add(teile[teile.length - 1], e); }
    e._such = norm(`${e.titel} ${(e.aliase || []).join(" ")} ${e.info || ""} ${e.text}`);
  }
  for (const e of eintraege) if (e.fakt) e._such = norm(e.text);
  const katMap = Object.fromEntries(kategorien.map((k) => [k.id, k]));
  STAND = { kategorien, katMap, eintraege, index, fakten: eintraege.filter((e) => e.fakt).map((e) => e.text), geladen: new Date().toISOString() };
  return STAND;
}

// ---------- Nachschlagen ----------
// Reihenfolge, wenn ein Wort in mehreren Bereichen vorkommt (z. B. "Berlin": Stadt vor Bundesland).
const VORRANG = ["technik", "geld", "natur", "weltraum", "koerper", "notfall", "erde", "tiere", "pflanzen", "staedte", "bundeslaender", "personen", "erfindungen", "geschichte", "kochen", "ernaehrung", "mac", "alltag", "berufe", "politik", "sport", "musik", "kultur", "glaube", "marken", "autos", "mathe", "sternzeichen", "elemente", "abkuerzungen", "laender", "weltstaedte", "fremdwoerter", "sprichwoerter", "englisch"];
const rang = (k) => { const i = VORRANG.indexOf(k); return i < 0 ? 99 : i; };
const ARTIKEL = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|mein|meine|unser|unsere) /;

/** Genauer Treffer über Titel/Alias (auch ohne Artikel). kat = bevorzugte Kategorie(n). */
export function finde(begriff, { kat = null } = {}) {
  const s = laden();
  let k = norm(begriff).replace(/^(eigentlich|genau|so) /, "");
  const kandidaten = [k, k.replace(ARTIKEL, ""), k.replace(ARTIKEL, "").replace(/ (eigentlich|genau|nochmal)$/, ""), k.replace(/^(die abkuerzung|das wort|der begriff|das element|der planet|das tier|die stadt|das land|das bundesland) /, "")];
  // Mehrzahl → Einzahl (grob)
  for (const c of [...kandidaten]) { if (c.endsWith("en")) kandidaten.push(c.slice(0, -2), c.slice(0, -1)); else if (c.endsWith("e") || c.endsWith("n") || c.endsWith("s")) kandidaten.push(c.slice(0, -1)); }
  const katListe = kat ? [].concat(kat) : null;
  for (const c of kandidaten) {
    const l = s.index.get(c);
    if (!l?.length) continue;
    const sortiert = [...l].sort((a, b) => {
      const pa = katListe ? (katListe.includes(a.kat) ? 0 : 1) : 0, pb = katListe ? (katListe.includes(b.kat) ? 0 : 1) : 0;
      return pa - pb || rang(a.kat) - rang(b.kat);
    });
    return sortiert[0];
  }
  return null;
}

/** Volltextsuche über alle Einträge (für Datenbank-Suche und Notfall). */
export function suche(q, { kat = "", limit = 60, offset = 0 } = {}) {
  const s = laden();
  const n = norm(q);
  let liste = kat ? s.eintraege.filter((e) => e.kat === kat) : s.eintraege;
  if (!n) return { treffer: liste.length, eintraege: liste.slice(offset, offset + limit) };
  const woerter = n.split(" ").filter((w) => w.length > 1);
  const bewertet = [];
  for (const e of liste) {
    const t = norm(e.titel);
    let p = 0;
    if (t === n || (e.aliase || []).some((a) => norm(a) === n)) p += 100;
    else if (t.startsWith(n)) p += 60;
    else if (t.includes(n)) p += 40;
    let alle = true;
    for (const w of woerter) {
      if (t.includes(w)) p += 8;
      else if (e._such.includes(w)) p += 3;
      else alle = false;
    }
    if (!alle && p < 40) continue;
    if (p > 0) bewertet.push({ e, p });
  }
  bewertet.sort((a, b) => b.p - a.p || rang(a.e.kat) - rang(b.e.kat));
  return { treffer: bewertet.length, eintraege: bewertet.slice(offset, offset + limit).map((x) => x.e) };
}

export function zufallsFakt() {
  const f = laden().fakten;
  return f.length ? f[Math.floor(Math.random() * f.length)] : "";
}

export function statistik() {
  const s = laden();
  return { gesamt: s.eintraege.length, kategorien: s.kategorien.map(({ id, name, icon, n }) => ({ id, name, icon, n })), geladen: s.geladen };
}

/** Für die Anzeige: nur die Felder, die das Dashboard braucht. */
export const fuerAnzeige = (e) => ({ id: e.id, kat: e.kat, titel: e.titel, text: e.text, info: e.info || "", icon: laden().katMap[e.kat]?.icon || "📚", bereich: laden().katMap[e.kat]?.name || e.kat });

// ---------- Sprachbefehle (ohne Claude) ----------
function vorbereiten(text) {
  return norm(String(text || "").replace(/^\s*(hey |hallo |ok |okay )?(friday|freitag|fraiday)[\s,.:!]*/i, ""))
    .replace(/^(sag mal|sag mir|weisst du|weisst du eigentlich|kannst du mir sagen|kannst du mir erklaeren|erklaer mir mal|bitte) /, "")
    .replace(/ (bitte|mal|eigentlich|denn|nochmal|genau)$/, "")
    .trim();
}

// Antworten werden nur vorgelesen (kein Fenster), „öffne das Lexikon“ zeigt alles.
const antwort = (e, extra = "") => ({ answer: `${extra}${e.text}`, actions: [], eintrag: fuerAnzeige(e) });

/**
 * Beantwortet Wissensfragen aus dem Lexikon. Gibt { answer, actions } oder null zurück.
 * locker = true (Notfall, Claude nicht erreichbar): auch ungefähre Treffer aus der Volltextsuche.
 */
export function quickCommand(text, { locker = false } = {}) {
  const t = vorbereiten(text);
  if (!t || t.length > 140) return null;
  let m;

  if (/^(oeffne|zeig|zeige|starte)( mir)? (das |dein |mein )?(lexikon|nachschlagewerk|eingebaute wissen|eingebautes wissen)$/.test(t)) {
    const st = statistik();
    return { answer: `Hier ist mein Lexikon mit ${st.gesamt.toLocaleString("de-DE")} Einträgen in ${st.kategorien.length} Bereichen. Das weiß ich alles ohne Internet.`, actions: ["lexikon"] };
  }
  if (/^(was steht in deinem lexikon|wie viel weisst du ohne internet|wie gross ist dein lexikon|was weisst du alles)$/.test(t)) {
    const st = statistik();
    const top = st.kategorien.slice().sort((a, b) => b.n - a.n).slice(0, 4).map((k) => `${k.n} ${k.name}`).join(", ");
    return { answer: `In meinem Lexikon stehen ${st.gesamt.toLocaleString("de-DE")} Einträge in ${st.kategorien.length} Bereichen, zum Beispiel ${top}. Alles ohne Claude und ohne Internet.`, actions: ["lexikon"] };
  }

  // Englisch: "was heißt Hund auf Englisch", "Schmetterling auf Englisch", "was bedeutet dog auf Deutsch"
  m = t.match(/^(?:was (?:heisst|bedeutet|ist)|wie (?:sagt|nennt) man|wie heisst|uebersetze|uebersetz mir) (?:das wort |das |der |die |den |ein |eine )?(.{1,40}?) (?:auf|in|ins) (englisch|deutsch)$/)
    || t.match(/^(?:das wort )?(.{1,40}?) auf (englisch|deutsch)$/) || t.match(/^was ist (?:das )?englische wort fuer (.{1,40})()$/);
  if (m) {
    const ziel = m[2] || "englisch";
    const e = finde(`${m[1]} auf ${ziel}`, { kat: "englisch" });
    if (e && e.kat === "englisch") {
      if (ziel === "deutsch" && !/falscher freund/i.test(e.titel)) return { ...antwort(e), answer: `„${m[1]}“ heißt auf Deutsch: ${e.titel.replace(/\s*\(.*$/, "")}.` };
      return antwort(e);
    }
  }

  // In welchem Land / Bundesland liegt eine Stadt?
  m = t.match(/^(?:in welchem (?:land|staat|bundesland)|wo) (?:liegt|ist) (?:die stadt )?(.{2,40})$/);
  if (m) {
    const e = finde(m[1], { kat: ["staedte", "weltstaedte"] });
    if (e?.kat === "weltstaedte") return { ...antwort(e), answer: `${e.titel.replace(/\s*\(.*$/, "")} liegt in ${e.staat}. ${e.zusatz || ""}`.trim() };
    if (e?.kat === "staedte") return { ...antwort(e), answer: `${e.titel} liegt in ${e.bundesland}. ${e.zusatz || ""}`.trim() };
  }

  // Sprichwörter & Fremdwörter mit Vorwort: "was bedeutet das Sprichwort ...", "was bedeutet das Fremdwort ..."
  m = t.match(/^(?:was (?:bedeutet|heisst|meint man mit)|erklaer(?:e)? mir) (?:das sprichwort|die redewendung|der spruch|die redensart|der ausdruck) (.{3,90})$/);
  if (m) { const e = finde(m[1], { kat: "sprichwoerter" }); if (e) return antwort(e); }
  m = t.match(/^(?:was (?:bedeutet|heisst)) (?:das fremdwort|das wort|der begriff) (.{2,40})$/);
  if (m) { const e = finde(m[1], { kat: ["fremdwoerter", "englisch"] }) || finde(m[1]); if (e) return antwort(e); }

  // Chemische Elemente
  m = t.match(/^(?:was ist |wie (?:ist|lautet|heisst) )?(?:die |das |der )?(ordnungszahl|atomnummer|atommasse|chemische zeichen|chemisches zeichen|chemische symbol|chemisches symbol|elementsymbol|symbol|zeichen) (?:von|fuer|vom) (.{2,30})$/);
  if (m) {
    const e = finde(m[2], { kat: "elemente" });
    if (e && e.kat === "elemente") {
      if (/ordnungszahl|atomnummer/.test(m[1])) return { ...antwort(e), answer: `${e.titel} hat die Ordnungszahl ${e.nr}, das chemische Zeichen ist ${e.symbol}. ${e.zusatz}`.trim() };
      if (/masse/.test(m[1])) return antwort(e);
      return { ...antwort(e), answer: `Das chemische Zeichen für ${e.titel} ist ${e.symbol}, Ordnungszahl ${e.nr}. ${e.zusatz}`.trim() };
    }
  }
  m = t.match(/^(?:welches element (?:hat|ist) (?:das (?:chemische )?(?:symbol|zeichen)|die ordnungszahl) |(?:was ist |welches ist )?(?:das )?element (?:nummer |nr )?)([a-z]{1,3}|\d{1,3})$/);
  if (m) {
    const s = laden();
    const q = m[1];
    const e = /^\d+$/.test(q) ? s.eintraege.find((x) => x.kat === "elemente" && x.nr === Number(q)) : s.eintraege.find((x) => x.kat === "elemente" && x.symbol.toLowerCase() === q);
    if (e) return antwort(e);
  }

  // Hauptstadt: zuerst Bundesland, dann Land
  m = t.match(/^(?:was ist |wie heisst |welche stadt ist |nenn mir )?(?:die )?hauptstadt (?:von |vom |der |des )?(.{2,40})$/) || t.match(/^(?:was|welche stadt) ist (?:die )?hauptstadt (?:von |vom |der |des )?(.{2,40})$/);
  if (m) {
    const e = finde(m[1], { kat: ["bundeslaender", "laender"] });
    if (e && (e.kat === "bundeslaender" || e.kat === "laender") && e.hauptstadt) {
      const satz = e.kat === "bundeslaender" && norm(e.hauptstadt) === norm(e.titel) ? `${e.titel} ist selbst Stadt und Bundesland. ` : `Die Hauptstadt von ${e.titel} ist ${e.hauptstadt}. `;
      return { ...antwort(e), answer: `${satz}${e.kat === "bundeslaender" ? e.zusatz : ""}`.trim() };
    }
  }

  // Einwohner
  m = t.match(/^wie ?viele? (?:einwohner|menschen|leute) (?:hat|leben in|wohnen in) (.{2,40})$/);
  if (m) {
    const e = finde(m[1], { kat: ["staedte", "bundeslaender", "weltstaedte"] });
    const ort = e?.bundesland || e?.staat;
    if (e && e.einwohner) return { ...antwort(e), answer: `${e.titel.replace(/\s*\(.*$/, "")} hat rund ${e.einwohner} Einwohner${ort && norm(ort) !== norm(e.titel) ? ` und liegt in ${ort}` : ""}. ${e.zusatz || ""}`.trim() };
  }

  // Erfindungen
  m = t.match(/^(?:wer hat|wer hat eigentlich) (?:den |die |das |eine |einen |ein )?(.{2,40}) erfunden$/) || t.match(/^wer erfand (?:den |die |das )?(.{2,40})$/) || t.match(/^(?:wann|wo) (?:wurde|wurden) (?:der |die |das |eine |einen |ein )?(.{2,40}) erfunden$/) || t.match(/^(?:wer ist der erfinder|wer war der erfinder) (?:von |des |der )?(.{2,40})$/);
  if (m) {
    const e = finde(m[1], { kat: "erfindungen" });
    if (e && e.kat === "erfindungen") return antwort(e);
  }

  // Geschichte: "was passierte 1989", "was war 1492"
  m = t.match(/^(?:was (?:passierte|geschah|war|ist passiert|war los)|was ist) (?:im jahr |im jahre |anno )?(\d{1,4})( vor christus| v chr)?$/);
  if (m) {
    const j = Number(m[1]) * (m[2] ? -1 : 1);
    const l = laden().eintraege.filter((e) => e.kat === "geschichte" && e.jahr === j);
    if (l.length) return { answer: l.map((e) => e.text).join(" "), actions: [] };
    if (Number(m[1]) > 99) return null;
  }
  m = t.match(/^wann (?:war|ist|begann|endete|fiel|kam|gab es|passierte|wurde|wurden|starb|lebte|fand) (?:der |die |das |den )?(.{3,50}?)(?: statt| gebaut| gegruendet| eingefuehrt| entdeckt| geboren| erfunden)?$/);
  if (m) {
    const e = finde(m[1], { kat: ["geschichte", "personen", "erfindungen"] });
    if (e && !["abkuerzungen", "englisch", "fremdwoerter"].includes(e.kat)) return antwort(e);
  }

  // Küche: "wie lange muss ich Eier kochen", "wie koche ich Reis"
  m = t.match(/^(?:wie lange (?:muss|soll|sollte|kann) (?:ich|man) |wie lange )(?:ein |eine |die |den |das )?(.{2,30}?) (kochen|backen|braten|garen|ziehen lassen)$/) || t.match(/^wie (?:koche|backe|brate|mache) (?:ich|man) (?:ein |eine |einen |die |den |das )?(.{2,30})$/);
  if (m) {
    const e = finde(`${m[1]} ${m[2] || "kochen"}`, { kat: "kochen" }) || finde(m[1], { kat: "kochen" });
    if (e && e.kat === "kochen") return antwort(e);
  }

  // Wer war / wer ist
  m = t.match(/^(?:wer (?:war|ist|waren|sind)|was weisst du ueber|erzaehl mir (?:etwas |was |mehr )?(?:ueber|von)|kennst du) (.{2,50})$/);
  if (m) {
    const e = finde(m[1], { kat: "personen" });
    if (e) return antwort(e);
  }

  // Abkürzungen
  m = t.match(/^(?:was|wofuer) (?:bedeutet|heisst|steht) (?:die abkuerzung )?(.{1,25}?)(?: fuer| ausgeschrieben)?$/) || t.match(/^(?:wofuer|fuer was) steht (.{1,25})$/);
  if (m) {
    const e = finde(m[1], { kat: "abkuerzungen" }) || finde(m[1]);
    if (e) return antwort(e);
  }

  // Wie hoch/lang/groß/... ist X
  m = t.match(/^wie (?:hoch|lang|gross|tief|alt|schwer|weit|schnell|heiss|kalt|breit|weit weg|weit entfernt) (?:ist|sind|war|wird|kann) (?:der |die |das |ein |eine )?(.{2,50}?)(?: entfernt| weg| werden| laufen| fliegen| schwimmen)?$/);
  if (m) {
    const e = finde(m[1]);
    if (e && !["abkuerzungen"].includes(e.kat)) return antwort(e);
  }

  // Was ist / Was sind / Was bedeutet / Erklär mir
  m = t.match(/^(?:was (?:ist|sind|war|waren|bedeutet|heisst|meint man mit|versteht man unter)|erklaer(?:e)? mir|erklaer(?:e)?|was ist eigentlich|was genau ist|definiere|definition von|was ist mit) (?:was )?(.{1,90}?)(?: ist| sind| bedeutet)?$/);
  if (m) {
    const e = finde(m[1]);
    if (e) return antwort(e);
  }

  // Sternzeichen zu einem Datum? → nur Sternzeichen-Namen
  m = t.match(/^(?:welches sternzeichen ist|was fuer ein sternzeichen ist) (.{2,30})$/);
  if (m) { const e = finde(m[1], { kat: "sternzeichen" }); if (e && e.kat === "sternzeichen") return antwort(e); }

  // Nur das Stichwort ("Zugspitze?", "ETF") – nur genaue Titel, keine Aliase mit einem Buchstaben
  if (/^[a-z0-9+ ]{3,40}$/.test(t) && t.split(" ").length <= 4) {
    const e = finde(t);
    const k = t.replace(ARTIKEL, "");
    if (e && (norm(e.titel.replace(/\s*\(.*$/, "")) === k || (k.length >= 4 && e.kat !== "abkuerzungen" && e.kat !== "erfindungen"))) return antwort(e);
  }

  if (locker) {
    const kern = t.replace(/^(was|wer|wie|wann|wo|warum|wieso|weshalb|welche[rsn]?|erklaer(e)?|erzaehl(e)?)( (ist|sind|war|hat|haben|mir|viel|viele|lange|hoch|gross|bedeutet|heisst))*( (der|die|das|ein|eine|einen|den))? /, "");
    const r = suche(kern, { limit: 1 });
    if (r.eintraege[0] && kern.length >= 3) return antwort(r.eintraege[0], "Aus meinem Lexikon: ");
  }
  return null;
}
