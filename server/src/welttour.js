// "Friday, zeig mir, was in der Welt passiert" (ab v1.116.0)
// Friday reist über den Globus zu den Weltmächten (USA, China, Russland, Deutschland/EU, Indien, Großbritannien),
// fliegt jedes Land an, zeigt dort Videos + Bilder und liest die Top-Nachrichten vor. Ganz ohne Claude-Guthaben.
// Steuerung: Knöpfe "Weiter" / "Zurück" / "Stopp" oder per Sprache ("weiter", "zurück", "stopp").
import { COUNTRIES, getCountryNews } from "./lagezentrum.js";
import { schlagzeilen, sprechName } from "./weltgespraech.js";

// Reihenfolge der Reise. "rolle" wird vorgelesen, damit klar ist, warum das Land dabei ist.
const STATIONEN = [
  { id: "840", rolle: "Weltmacht Nummer eins" },
  { id: "156", rolle: "die aufstrebende Supermacht" },
  { id: "643", rolle: "die Atommacht im Osten" },
  { id: "276", rolle: "für Europa und die EU" },
  { id: "356", rolle: "das bevölkerungsreichste Land der Welt" },
  { id: "826", rolle: "Atommacht und ständiges Mitglied im UN-Sicherheitsrat" },
];
const PRO_LAND = 3;
const AKTIV_MS = 15 * 60 * 1000;
const aktiv = new Map(); // Kanal -> bis wann die Reise läuft (damit "weiter"/"stopp" hier landen)

const gross1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export async function getWelttour() {
  const laender = STATIONEN.map((s) => ({ ...s, c: COUNTRIES.find((x) => x.id === s.id) })).filter((s) => s.c);
  const roh = await Promise.all(laender.map(async ({ c }) => {
    try { return { items: (await getCountryNews(c)).items || [], fehler: false }; } catch { return { items: [], fehler: true }; }
  }));
  // Dieselbe Meldung (z. B. ein Gipfel mit USA + China) nur einmal vorlesen: beim ersten Land.
  const schon = new Set();
  const schl = (t) => t.toLowerCase().replace(/[^a-zäöüß0-9 ]/g, "").split(" ").filter((w) => w.length > 3).slice(0, 5).join(" ");
  const stationen = laender.map(({ c, rolle }, k) => {
    const { items, fehler } = roh[k];
    const top = schlagzeilen(items, 12).filter((t) => !schon.has(schl(t))).slice(0, PRO_LAND);
    for (const t of top) schon.add(schl(t));
    const link = (titel) => items.find((n) => String(n.title || "").startsWith(titel.slice(0, 30)))?.link || "";
    const name = gross1(sprechName(c));
    const text = top.length
      ? `${name}, ${rolle}. ${top.join(". ")}.`
      : `${name}. ${fehler ? "Die Nachrichten von dort kann ich gerade nicht abrufen." : "Aus den letzten 24 Stunden gibt es keine großen Meldungen."}`;
    return { id: c.id, name: c.name, flag: c.flag || "", rolle, lon: c.lon, lat: c.lat, schlagzeilen: top.map((t) => ({ titel: t, link: link(t) })), text };
  });
  return { stand: new Date().toISOString(), stationen };
}

const START = /^(?:(?:zeig|zeige|sag|erzähl|erzaehl)(?: mir| uns)?(?: mal)?(?: bitte)? ?)?(?:was (?:gerade |heute |aktuell )?(?:in|auf) der welt (?:so )?(?:passiert|los ist|geschieht)|was (?:passiert|ist los|geschieht) (?:gerade |heute )?(?:in|auf) der welt|was (?:ist|geht) (?:gerade |heute |so )?(?:in|auf) der welt (?:so )?los)$/;
const START2 = /^(?:(?:zeig|zeige|starte|mach|lies|lese)(?: mir| uns)?(?: mal)?(?: bitte)? )?(?:die |eine )?(?:welt ?tour|weltreise|welt ?runde|weltnachrichten|nachrichten (?:der|aller) weltmächte|nachrichten aus aller welt|top ?nachrichten der welt)(?: vor| an| starten| bitte)?$/;
const WEITER = /^(?:weiter|nächstes?|naechstes?|nächstes land|naechstes land|das nächste|überspring(?:en)?|ueberspring(?:en)?|skip)(?: bitte| land)?$/;
const ZURUECK = /^(?:zurück|zurueck|vorheriges?(?: land)?|nochmal|noch ?mal)(?: bitte)?$/;
const STOPP = /^(?:stopp?|halt|genug|aufhören|aufhoeren|ende|beenden|abbrechen|schluss|danke|das reicht|das war's|das wars)(?: bitte| danke| friday| boss)*$/;

function vorbereiten(text) {
  return String(text || "").toLowerCase()
    .replace(/[„“”"'!?¿¡;.,:]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^(hey |hallo |hi |ok |okay )?(friday|freitag|fraiday)( |$)/, "").trim()
    .replace(/^(bitte |kannst du (mir |uns )?(bitte )?)/, "").trim();
}

export function welttourEnde(channel = "web") { aktiv.delete(channel); }

export function quickCommand(text, channel = "web") {
  const t = vorbereiten(text);
  if (!t || t.length > 90) return null;
  const bis = aktiv.get(channel);
  if (bis && Date.now() < bis) {
    if (WEITER.test(t)) return { answer: "", actions: ["welttour_weiter"] };
    if (ZURUECK.test(t)) return { answer: "", actions: ["welttour_zurueck"] };
    if (STOPP.test(t)) { aktiv.delete(channel); return { answer: "Alles klar, Boss. Die Welt-Runde ist beendet.", actions: ["welttour_stopp"] }; }
  } else if (bis) aktiv.delete(channel);
  if (START.test(t) || START2.test(t)) {
    aktiv.set(channel, Date.now() + AKTIV_MS);
    return { answer: "", actions: ["weltgeschehen", "welttour"] };
  }
  return null;
}

export function welttourRouten(app, asyncRoute) {
  app.get("/api/welttour", asyncRoute(async (req, res) => {
    aktiv.set("web", Date.now() + AKTIV_MS);
    res.json(await getWelttour());
  }));
  app.post("/api/welttour/ende", (req, res) => { welttourEnde("web"); res.json({ ok: true }); });
}
