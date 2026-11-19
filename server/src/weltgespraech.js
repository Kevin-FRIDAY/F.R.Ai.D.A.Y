// Weltgeschehen per Sprache, wie ein Gespräch:
//   "Friday, zeig mir das Weltgeschehen" → Globus geht auf, Friday fragt: "Welches Land willst du sehen?"
//   "USA"                                → Globus fliegt hin, Friday schätzt die Lage ein und liest die
//                                          wichtigsten Nachrichten vor, dann: "Noch ein Land, Boss?"
//   "Nein danke"                         → "Alles klar, Boss."
// Direkt geht auch: "Wie ist die Lage in der Türkei?" oder "Weltgeschehen Japan".
// Öffnen, Land finden und Nachrichten laufen ohne Claude (sofort). Nur die Einschätzung braucht Claude;
// fehlt das Guthaben, liest Friday trotzdem die Nachrichten vor.
import { getCountryNews, getSummary } from "./lagezentrum.js";
import { findeLand } from "./laenderinfo.js";

const WARTEZEIT_MS = 2 * 60 * 1000; // so lange wartet Friday nach "Welches Land?" auf die Antwort
const EINSCHAETZUNG_MAX_MS = 15000; // länger soll niemand auf die Einschätzung warten

const wartet = new Map(); // Kanal -> Zeitpunkt, bis zu dem eine Land-Antwort erwartet wird

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// So spricht man die Länder aus (statt "Vereinigte Staaten").
const SPRECHNAME = { "840": "die USA", "826": "Großbritannien", "784": "die Emirate", "180": "der Kongo", "528": "die Niederlande" };
export const sprechName = (c) => SPRECHNAME[c.id] || c.name;
const gross1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function vorbereiten(text) {
  let t = String(text || "").toLowerCase()
    .replace(/[„“”"'!?¿¡;.,:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  t = t.replace(/^(hey |hallo |hi |ok |okay )?(friday|freitag|fraiday)( |$)/, "").trim();
  t = t.replace(/^(bitte |kannst du (mir |uns )?(bitte )?|könntest du (mir |uns )?(bitte )?|koenntest du (mir )?(bitte )?)/, "").trim();
  // Spracherkennung schreibt "Weltgeschehen" gern auseinander oder verhört sich ("Welt gesehen").
  t = t.replace(/\bwelt ?ge(sch|s)ehen\b/g, "weltgeschehen").replace(/\bwelt ?karte\b/g, "weltkarte");
  return t;
}

const WELT = "(?:das |den |die )?(?:weltgeschehen|weltkarte|globus)";
// "zeig mir das Weltgeschehen", "öffne den Globus", "Weltgeschehen", "Weltgeschehen öffnen"
const OEFFNEN = new RegExp(`^(?:(?:zeig|zeige|öffne|oeffne|starte|mach|bring)(?: mir| uns)?(?: mal)?(?: bitte)? )?${WELT}(?: an| auf| öffnen| oeffnen| zeigen| starten| bitte)?$`);
// "zeig mir das Weltgeschehen in Japan", "Weltgeschehen USA"
const OEFFNEN_MIT_LAND = new RegExp(`^(?:(?:zeig|zeige|öffne|oeffne)(?: mir| uns)?(?: mal)? )?${WELT} (?:in |für |fuer |von |zu )?(?:der |den |dem |die )?(.{2,40})$`);
// "wie ist die Lage in der Türkei", "Lage in Japan", "Lagebericht USA", "was ist in Frankreich los"
const LAGE = [
  /^(?:wie ist |wie sieht )?(?:die )?lage (?:in |im |für |fuer |zu )(?:der |den |dem |die )?(.{2,40}?)(?: aus)?$/,
  /^(?:zeig|zeige|gib)(?: mir)?(?: mal)? (?:die )?lage (?:in |im |für |fuer |von |zu )?(?:der |den |dem |die )?(.{2,40})$/,
  /^lagebericht (?:für |fuer |zu |über |ueber |von )?(?:der |den |dem |die )?(.{2,40})$/,
];
const NEIN = /^(nein|nee|ne|nö|noe|nichts|keins|kein land|danke|nein danke|das wars|das war's|das reicht|fertig|stopp?|abbrechen|schließen|schliessen|schluss|ende|später|spaeter)( danke| boss| friday)*$/;

// Was der Nutzer nach "Welches Land?" sagt: "USA", "die Türkei", "zeig mir Japan", "nach Brasilien"
function landAusAntwort(t) {
  const kurz = t
    .replace(/^(?:ja |gerne |ok |okay |äh |ähm |also )+/, "")
    .replace(/^(?:zeig|zeige|geh|gehe|flieg|fliege|bring)(?: mich| mir| uns)?(?: mal)?(?: bitte)? /, "")
    .replace(/^(?:nach|in|zu|zur|zum|auf|über|ueber) /, "")
    .replace(/^(?:das land |den staat )/, "")
    .replace(/^(?:der |den |dem |die |das )/, "")
    .replace(/ (?:bitte|mal|an|zeigen|ansehen|anschauen)$/, "")
    .trim();
  if (!kurz || kurz.split(" ").length > 4) return null;
  return findeLand(kurz);
}

// Schlagzeilen kürzen und doppelte Themen weglassen.
export function schlagzeilen(items, anzahl) {
  const gesehen = new Set();
  const out = [];
  for (const n of items) {
    let t = String(n.title || "").replace(/\s+[|–—-]\s+[^|–—-]{2,40}$/, "").replace(/\s+/g, " ").trim();
    if (t.length < 15) continue;
    if (t.length > 160) t = t.slice(0, 157).replace(/\s+\S*$/, "") + " …";
    const schluessel = t.toLowerCase().split(" ").slice(0, 4).join(" ");
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    out.push(t.replace(/[.!?…]*$/, ""));
    if (out.length >= anzahl) break;
  }
  return out;
}

const STIMMUNG = { gut: "eher ruhig", schlecht: "angespannt", gemischt: "gemischt" };

export async function lageBriefing(country) {
  const name = sprechName(country);
  let items = [], nachrichtenFehler = false;
  try { items = (await getCountryNews(country)).items || []; } catch { nachrichtenFehler = true; }

  // Einschätzung von Claude (falls Guthaben da), aber nie länger als ein paar Sekunden warten.
  let einsch = null, ohneGuthaben = false;
  if (items.length) {
    try {
      einsch = await Promise.race([
        getSummary(country),
        new Promise((_, rej) => setTimeout(() => rej(new Error("zu langsam")), EINSCHAETZUNG_MAX_MS)),
      ]);
    } catch (err) {
      ohneGuthaben = /credit balance/i.test(String(err?.message || err));
    }
  }

  const teile = [`${gross1(name)}.`];
  if (einsch?.zusammenfassung) {
    teile.push(`Meine Einschätzung: Die Lage ist ${STIMMUNG[einsch.bewertung] || "gemischt"}. ${einsch.zusammenfassung}`);
  } else if (ohneGuthaben) {
    teile.push("Für meine Einschätzung fehlt mir gerade das Guthaben, aber hier sind die Nachrichten.");
  }
  const top = schlagzeilen(items, 4);
  if (top.length) teile.push(`Die wichtigsten Nachrichten: ${top.join(". ")}.`);
  else if (nachrichtenFehler) teile.push("Die Nachrichten kann ich gerade nicht abrufen. Versuch es gleich nochmal.");
  else teile.push("Aus den letzten 24 Stunden habe ich keine Meldungen gefunden.");
  teile.push(pick(["Noch ein Land, Boss?", "Willst du noch ein Land sehen?", "Soll ich mir noch ein Land ansehen?"]));

  const actions = ["weltgeschehen", `lage_land:${country.id}`, "zuhoeren"];
  if (einsch?.bewertung) actions.push(`lage_bewertung:${einsch.bewertung}`);
  return { answer: teile.join(" "), actions };
}

export async function quickCommand(text, channel = "web") {
  const t = vorbereiten(text);
  if (!t || t.length > 90) return null;

  // 1. Friday hat gerade "Welches Land?" gefragt.
  const bis = wartet.get(channel);
  if (bis && Date.now() < bis) {
    if (NEIN.test(t)) {
      wartet.delete(channel);
      return { answer: pick(["Alles klar, Boss.", "Gut, Boss. Der Globus bleibt offen.", "In Ordnung, Boss."]), actions: ["weltgeschehen"] };
    }
    const c = landAusAntwort(t);
    if (c) {
      wartet.set(channel, Date.now() + WARTEZEIT_MS);
      return lageBriefing(c);
    }
    wartet.delete(channel); // etwas ganz anderes gesagt: normal weiter
  } else if (bis) {
    wartet.delete(channel);
  }

  // 2. "Zeig mir das Weltgeschehen" → nachfragen.
  if (OEFFNEN.test(t)) {
    wartet.set(channel, Date.now() + WARTEZEIT_MS);
    return {
      answer: pick(["Gerne, Boss. Welches Land willst du sehen?", "Sehr gern, Boss. Welches Land soll ich mir ansehen?", "Das Weltgeschehen ist offen, Boss. Welches Land?"]),
      actions: ["weltgeschehen", "zuhoeren"],
    };
  }

  // 3. Gleich mit Land: "Weltgeschehen Japan", "Wie ist die Lage in der Türkei?"
  const m = t.match(OEFFNEN_MIT_LAND) || LAGE.map((re) => t.match(re)).find(Boolean);
  if (m) {
    const c = findeLand(m[1].replace(/ (?:los|aus|an)$/, "").trim());
    if (c) {
      wartet.set(channel, Date.now() + WARTEZEIT_MS);
      return lageBriefing(c);
    }
  }
  return null;
}

// "Vollbild", "mach Vollbild", "Vollbild aus": das Dashboard schaltet um (im Browser, nicht auf dem iPhone).
export function vollbildQuick(text) {
  const t = vorbereiten(text);
  if (/^(?:(?:mach|schalte|schalt|geh|gehe|wechsel|wechsle)(?: mal)?(?: in den| auf| in)? )?(?:den )?(?:vollbild|vollbildmodus|vollbild modus|ganzer bildschirm)(?: an| ein| ein ?schalten| aktivieren| bitte)?$/.test(t)) {
    return { answer: "Vollbild, Boss.", actions: ["vollbild"] };
  }
  if (/^(?:(?:mach|schalte|schalt|beende|verlasse)(?: mal)? )?(?:den )?(?:vollbild|vollbildmodus|vollbild modus)(?: aus| beenden| verlassen| zu)$|^(?:kein|raus aus dem) vollbild$/.test(t)) {
    return { answer: "Vollbild aus, Boss.", actions: ["vollbild_aus"] };
  }
  return null;
}
