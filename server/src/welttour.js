// "Friday, zeig mir, was in der Welt passiert" (ab v1.116.0)
// Friday reist über den Globus zu den Weltmächten (USA, China, Russland, Deutschland/EU, Indien, Großbritannien),
// fliegt jedes Land an, zeigt dort Videos + Bilder und liest die Top-Nachrichten vor. Ganz ohne Claude-Guthaben.
// Steuerung: Knöpfe "Weiter" / "Zurück" / "Stopp" oder per Sprache ("weiter", "zurück", "stopp").
import { COUNTRIES, getCountryNews } from "./lagezentrum.js";
import { schlagzeilen, sprechName } from "./weltgespraech.js";

// Reihenfolge der Reise. "rolle" wird vorgelesen, damit klar ist, warum das Land dabei ist.
const STATIONEN = [
  { id: "840", rolle: "Weltmacht Nummer eins", sprich: "der Weltmacht Nummer eins" },
  { id: "156", rolle: "die aufstrebende Supermacht", sprich: "der aufstrebenden Supermacht" },
  { id: "643", rolle: "die Atommacht im Osten", sprich: "der Atommacht im Osten" },
  { id: "276", rolle: "für Europa und die EU", sprich: "stellvertretend für Europa und die EU" },
  { id: "356", rolle: "das bevölkerungsreichste Land der Welt", sprich: "dem bevölkerungsreichsten Land der Welt" },
  { id: "826", rolle: "Atommacht und ständiges Mitglied im UN-Sicherheitsrat", sprich: "der Atommacht mit ständigem Sitz im UN-Sicherheitsrat" },
];
// v1.122.0: Friday erzählt wie früher, wo sie gerade ist: "Ich bin jetzt in den USA, …".
const IN_LAND = { "die USA": "in den USA", "die Emirate": "in den Emiraten", "die Niederlande": "in den Niederlanden", "der Kongo": "im Kongo" };
const inLand = (name) => IN_LAND[name] || (/^die /.test(name) ? `in der ${name.slice(4)}` : `in ${name}`);
const PRO_LAND = 3;
const AKTIV_MS = 15 * 60 * 1000;
const aktiv = new Map(); // Kanal -> bis wann die Reise läuft (damit "weiter"/"stopp" hier landen)


export async function getWelttour() {
  const laender = STATIONEN.map((s) => ({ ...s, c: COUNTRIES.find((x) => x.id === s.id) })).filter((s) => s.c);
  const roh = await Promise.all(laender.map(async ({ c }) => {
    try { return { items: (await getCountryNews(c)).items || [], fehler: false }; } catch { return { items: [], fehler: true }; }
  }));
  // Dieselbe Meldung (z. B. ein Gipfel mit USA + China) nur einmal vorlesen: beim ersten Land.
  const schon = new Set();
  const schl = (t) => t.toLowerCase().replace(/[^a-zäöüß0-9 ]/g, "").split(" ").filter((w) => w.length > 3).slice(0, 5).join(" ");
  const stationen = laender.map(({ c, rolle, sprich }, k) => {
    const { items, fehler } = roh[k];
    const top = schlagzeilen(items, 12).filter((t) => !schon.has(schl(t))).slice(0, PRO_LAND);
    for (const t of top) schon.add(schl(t));
    const link = (titel) => items.find((n) => String(n.title || "").startsWith(titel.slice(0, 30)))?.link || "";
    const ort = `Ich bin jetzt ${inLand(sprechName(c))}, ${sprich || rolle}.`;
    const text = top.length
      ? `${ort} ${top.length === 1 ? "Die wichtigste Meldung von dort" : `Die ${top.length === 2 ? "zwei" : "drei"} wichtigsten Meldungen von dort`}: ${top.join(". ")}.`
      : `${ort} ${fehler ? "Die Nachrichten von dort kann ich gerade nicht abrufen." : "Aus den letzten 24 Stunden gibt es keine großen Meldungen."}`;
    return { id: c.id, name: c.name, flag: c.flag || "", rolle, lon: c.lon, lat: c.lat, schlagzeilen: top.map((t) => ({ titel: t, link: link(t) })), text };
  });
  return { stand: new Date().toISOString(), stationen };
}

// Erkennt viele Formen: "was passiert in der Welt (heute/gerade/so)", "zeig mir, was in der Welt gerade passiert",
// "was gibt's Neues in der Welt", "Nachrichten aus der Welt", "Welt-Runde" …
const ZEIT = "(?:gerade |heute |aktuell |so |denn |eigentlich |momentan |jetzt )*";
const IN_WELT = "(?:in|auf) der (?:ganzen )?welt";
const START = new RegExp("^(?:(?:zeig|zeige|sag|erzähl|erzaehl|erzähle|erzaehle)(?: mir| uns)?(?: mal)?(?: bitte)? ?)?(?:"
  + `was ${ZEIT}${IN_WELT} ${ZEIT}(?:passiert|los ist|geschieht|abgeht|vor sich geht)`
  + `|was (?:passiert|ist los|geschieht|geht ab|ist passiert) ${ZEIT}${IN_WELT}`
  + `|was (?:ist|geht) ${ZEIT}${IN_WELT} ${ZEIT}los`
  + `|was gibt(?: es|s) ${ZEIT}neues ${ZEIT}${IN_WELT}`
  + `|was ist ${ZEIT}${IN_WELT} ${ZEIT}(?:passiert|geschehen)`
  + ")(?: (?:gerade|heute|aktuell|so|jetzt|momentan))?(?: bitte)?$");
const START2 = /^(?:(?:zeig|zeige|starte|mach|lies|lese)(?: mir| uns)?(?: mal)?(?: bitte)? )?(?:die |eine )?(?:welt ?tour|weltreise|welt ?runde|weltnachrichten|nachrichten (?:der|aller) weltmächte|nachrichten (?:aus|der|in) (?:aller |der )?welt|top ?nachrichten (?:der|aus der) welt|welt ?news)(?: vor| an| starten| bitte)?$/;
// v1.191.2: Kevin sagt meist "Zeig mir das aktuelle Weltgeschehen" und erwartet die Welt-Runde (Länder anfliegen + vorlesen).
// "aktuell/heute/neueste" + Weltgeschehen/Weltlage/Lage der Welt startet die Runde. "Zeig mir das Weltgeschehen" ohne Zusatz
// bleibt das Gespräch "Welches Land?" (weltgespraech.js).
const START3 = /^(?:(?:zeig|zeige|sag|erzähl|erzaehl|erzähle|erzaehle|gib|lies|lese|was ist|wie ist)(?: mir| uns)?(?: mal)?(?: bitte)? )?(?:das |die |den )?(?:(?:aktuelle|aktuellen|heutige|heutigen|neueste|neuesten|momentane|jetzige)s? (?:welt ?ge(?:sch|s)ehen|welt ?lage|lage (?:in |auf |der )(?:der )?welt|welt ?nachrichten|nachrichten (?:aus |der |in )(?:der )?welt)|welt ?lage|(?:welt ?ge(?:sch|s)ehen|weltlage) (?:von |für |fuer )?(?:heute|gerade|aktuell|jetzt|im moment))(?: vor| an| bitte)?$/;
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
  if (START.test(t) || START2.test(t) || START3.test(t)) {
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
