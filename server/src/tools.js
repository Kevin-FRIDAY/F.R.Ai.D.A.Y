// Fridays Werkzeuge: alles, was sie außer Reden noch kann.
import * as logbuch from "./logbuch.js";
import { pruefeWerkzeug, freigabeAnfordern } from "./kommando.js";
import fs from "node:fs";
import { dokumentErstellen, fragebogenErstellen } from "./dokumente.js";
import { tabelleErstellen, WERKZEUG as TABELLE_WERKZEUG } from "./tabellen.js";
import path from "node:path";
import { config, ROOT, IST_EVE } from "./config.js";
import { EVE_SIMULIERT, simuliereWerkzeug } from "./eve-schutz.js";
import * as store from "./store.js";
import { mailConfigured, getMailOverview, sortMail } from "./mail.js";
import { runSystemCheck } from "./syscheck.js";
import { sendToAgent, isAgentOnline } from "./agent-hub.js";
import { sendPush } from "./notify.js";
import { checkForUpdate, startUpdate } from "./updater.js";
import { COUNTRIES, findCountry, getCountryNews, getOverview, getCountryInfo } from "./lagezentrum.js";
import { getVideoJob, startVideoJob, openVideoDir, LOOKS } from "./videoteam.js";
import { starteStudio, getStudio, FORMATE as STUDIO_FORMATE, BILDQUELLEN } from "./videostudio.js";
import { STIMMUNG_IDS } from "./musik.js";
import { getForecast, getDepot, MAERKTE } from "./markt.js";
import { WERKZEUG as MARKT_PLUS, werkzeug as marktPlus } from "./marktplus.js";
import { planBuild, getLatestBuild } from "./werkstatt.js";
import { getAlarm } from "./lagezentrum.js";
import { buildSite, listSites, startLive, liveFrei, baueVorlage } from "./webseiten.js";
import { starteSpiel, listeSpiele } from "./spiele.js";
import { command as tvCommand } from "./fernseher.js";
import { command as alexaCommand } from "./alexa.js";
import { toolDefinitions as dienstTools, smartHomeTool } from "./dienste-werkzeuge.js";
// Kontrollraum (v1.135.0, Bausteine aus Conway-Research/automaton, MIT): Regelwerk, Gedächtnis, Seele, Fähigkeiten.
import { kernTools, istKernTool, runKernTool } from "./kern.js";
import { pruefe as regelwerkPruefe } from "./regelwerk.js";
import { faktMerken, SCHUBLADEN, ereignis as gedaechtnisEreignis } from "./gedaechtnis.js";
import { istDienstTool, runDienstTool } from "./dienste.js";
import { command as haCommand } from "./homeassistant.js";
import { routeFuerClaude } from "./routen.js";
import { getAirQuality, getExchange, getCrypto, getHolidays, getISS, getWiki } from "./extras.js";
import { toolDefinitions as jarvisTools, istJarvisTool, runJarvisTool } from "./jarvis-paket.js";
import { toolDefinitions as kontenTools, istKontenTool, runKontenTool } from "./konten.js";
import { gesundheitUebersicht } from "./apple.js";

// Osiris Live-Lagekarte: lokal auf dem Mac (Port 3100), sonst automatisch osirisai.live.
import { osirisUrl } from "./osiris.js";
const OSIRIS_URL = "osiris:"; // Platzhalter, wird beim Öffnen durch die passende Adresse ersetzt

const MAC_ACTIONS = [
  "open_app", "quit_app", "open_url", "volume_set", "volume_up", "volume_down", "mute",
  "music_play_pause", "music_next", "music_previous", "say", "notify", "lock_screen",
  "sleep_display", "battery", "screenshot_look", "find_file", "dark_mode_toggle",
];

export const toolDefinitions = [
  {
    name: "spiel_bauen",
    description: "Programmiert ein spielbares Browser-Spiel für Boss (Spiele-Werkstatt). Das Dashboard zeigt live, wie der Code entsteht, und startet das Spiel danach automatisch; es wird gespeichert und ist später wieder spielbar. Benutze es immer, wenn Boss ein Spiel will – schreib den Code nie selbst in die Antwort oder in ein Dokument. Mit basis_id änderst du ein vorhandenes Spiel.",
    input_schema: { type: "object", properties: { auftrag: { type: "string", description: "Was für ein Spiel, möglichst genau in Boss' Worten (Spielidee, Steuerung, Besonderheiten)" }, basis_id: { type: "string", description: "Optional: id eines vorhandenen Spiels, das geändert werden soll" } }, required: ["auftrag"] },
  },
  {
    name: "dokument_erstellen",
    description: "Speichert einen fertigen Text für Boss als Dokument im Dashboard (Liste, Plan, Brief, Rezept, Zusammenfassung, Ideen …). Benutze es immer, wenn Boss dich bittet, etwas zu erstellen, zu schreiben oder auszuarbeiten, das länger als drei Sätze ist. Schreib den vollständigen Inhalt direkt hinein.",
    input_schema: { type: "object", properties: { titel: { type: "string" }, inhalt: { type: "string", description: "Der komplette, fertige Text (Zeilenumbrüche erlaubt)" } }, required: ["titel", "inhalt"] },
  },
  TABELLE_WERKZEUG, // v1.161.0: echte Excel-Dateien
  {
    name: "fragebogen_erstellen",
    description: "Erstellt einen Fragebogen, den Boss im Dashboard Frage für Frage ausfüllen kann (z. B. 'Mach einen Fragebogen mit 30 Fragen, um mich kennenzulernen'). Die Antworten landen danach automatisch in deinem Gedächtnis. Schreib alle Fragen vollständig aus, genau so viele wie gewünscht.",
    input_schema: { type: "object", properties: { titel: { type: "string" }, fragen: { type: "array", items: { type: "string" }, description: "Die einzelnen Fragen, ausformuliert" } }, required: ["titel", "fragen"] },
  },
  {
    name: "world_news",
    description: "Lagezentrum: aktuelle Schlagzeilen der letzten 24 Stunden zu einem Land (z. B. 'Was ist in Frankreich los?'). Ohne Land: Übersicht, wo gerade am meisten berichtet wird.",
    input_schema: {
      type: "object",
      properties: { country: { type: "string", description: "Land auf Deutsch, z. B. Frankreich" } },
    },
  },
  {
    name: "add_task",
    description: "Fügt eine Aufgabe zur To-do-Liste hinzu. Z. B. 'Schreib auf: Steuer machen'.",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "list_tasks",
    description: "Zeigt die offenen Aufgaben.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "system_check",
    description: "Prüft alle Dienste (Internet, Osiris, Lagezentrum-Quellen, Mac, Mail usw.) und sagt, was läuft. Bei 'System Check' / 'System Status'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "check_mail",
    description: "Zeigt eine Übersicht der iCloud-Mails (ungelesen, letzte Absender/Betreffe).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "sort_mail",
    description: "Sortiert den Posteingang: verschiebt Newsletter/Werbung in den Ordner Newsletter. Z. B. 'Sortier meine Mails'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_shopping",
    description: "Setzt etwas auf die Einkaufsliste. Z. B. 'Setz Milch auf die Einkaufsliste'.",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "open_app",
    description: "Öffnet eine App oder Website auf dem Mac, z. B. 'öffne YouTube', 'öffne Netflix', 'öffne Spotify'. Für bekannte Dienste wird die Website geöffnet, sonst die Mac-App mit dem Namen.",
    input_schema: { type: "object", properties: { name: { type: "string", description: "App- oder Dienstname, z. B. YouTube" } }, required: ["name"] },
  },
  {
    name: "air_quality",
    description: "Aktuelle Luftqualität (Feinstaub, Ozon) für einen Ort. Ohne Ort die Heimatstadt.",
    input_schema: { type: "object", properties: { city: { type: "string" } } },
  },
  {
    name: "currency",
    description: "Rechnet Geldbeträge in andere Währungen um (Tageskurs der EZB). Z. B. 100 Euro in Dollar.",
    input_schema: { type: "object", properties: { amount: { type: "number" }, from: { type: "string", description: "Währungscode wie EUR" }, to: { type: "string", description: "Währungscode wie USD" } }, required: ["from", "to"] },
  },
  {
    name: "crypto",
    description: "Aktueller Preis einer Kryptowährung (z. B. Bitcoin, Ethereum) in Euro.",
    input_schema: { type: "object", properties: { coin: { type: "string" }, currency: { type: "string", description: "z. B. eur oder usd" } }, required: ["coin"] },
  },
  {
    name: "holidays",
    description: "Nächste gesetzliche Feiertage in einem Land (Standard Deutschland).",
    input_schema: { type: "object", properties: { country: { type: "string", description: "Ländercode wie DE, AT, CH" }, year: { type: "number" } } },
  },
  {
    name: "iss",
    description: "Wo sich die Internationale Raumstation ISS gerade über der Erde befindet.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "lookup",
    description: "Schlägt einen Begriff, eine Person oder einen Ort kurz bei Wikipedia nach (deutsche Zusammenfassung). Für Faktenfragen günstiger als die Websuche.",
    input_schema: { type: "object", properties: { term: { type: "string" } }, required: ["term"] },
  },
  {
    name: "route_planen",
    description: "Routen & Verbindungen: rechnet aus, wie lange man mit Auto, Fahrrad und zu Fuß wohin braucht, und sucht Bahn- und Busverbindungen mit Abfahrtszeiten, Gleis und Umstiegen. Ohne 'von' startet die Route zu Hause (im Routen-Fenster hinterlegt). Kostenlos, nimm es für jede Frage nach Weg, Fahrzeit, Entfernung oder Zug/Bus. Das Dashboard zeigt danach die Karte.",
    input_schema: {
      type: "object",
      properties: {
        nach: { type: "string", description: "Ziel: Stadt, Adresse, Haltestelle oder Ort, z. B. 'Hamburg Hbf' oder 'Hauptstraße 5, Köln'. 'zuhause' und 'arbeit' gehen auch." },
        von: { type: "string", description: "Optionaler Startort, sonst Zuhause" },
        modus: { type: "string", enum: ["auto", "rad", "fuss", "oepnv"], description: "Welches Verkehrsmittel im Vordergrund steht (optional)" },
        zeit: { type: "string", description: "Optionale Abfahrtszeit als ISO-Zeit (Ortszeit), z. B. 2026-11-20T08:00" },
        ankunft: { type: "boolean", description: "true = 'zeit' ist die gewünschte Ankunftszeit" },
      },
      required: ["nach"],
    },
  },
  {
    name: "country_info",
    description: "Steckbrief zu einem Land: Hauptstadt, Einwohner, Währung, Region, Luftqualität.",
    input_schema: { type: "object", properties: { country: { type: "string" } }, required: ["country"] },
  },
  {
    name: "get_weather",
    description: "Aktuelles Wetter und Vorhersage für die nächsten 3 Tage. Ohne Ort wird die Heimatstadt genommen.",
    input_schema: {
      type: "object",
      properties: { city: { type: "string", description: "Stadt, z. B. Hamburg" } },
    },
  },
  {
    name: "remember",
    description: "Speichert eine dauerhafte Info über den Nutzer (Vorlieben, Termine, Namen, Fakten). Nutze das, wenn er etwas Merkenswertes erzählt oder 'merk dir' sagt.",
    input_schema: {
      type: "object",
      properties: {
        fact: { type: "string", description: "Die Info in einem kurzen Satz" },
        schublade: { type: "string", enum: Object.keys(SCHUBLADEN), description: "Optional: person, vorliebe, ort, termin, technik, arbeit oder sonstiges" },
      },
      required: ["fact"],
    },
  },
  {
    name: "forget",
    description: "Löscht gespeicherte Infos, die den Suchbegriff enthalten.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "set_reminder",
    description: "Legt eine Erinnerung an. Friday schickt zur Zeit eine Push-Nachricht aufs Handy.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Woran erinnert werden soll" },
        when: { type: "string", description: "Zeitpunkt als lokale Zeit im Format YYYY-MM-DDTHH:MM" },
      },
      required: ["text", "when"],
    },
  },
  {
    name: "list_reminders",
    description: "Zeigt alle offenen Erinnerungen.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "mac",
    description:
      "Steuert den Mac des Nutzers. Aktionen: open_app/quit_app (value=App-Name), open_url (value=URL), " +
      "volume_set (value=0-100), volume_up, volume_down, mute, music_play_pause, music_next, music_previous, " +
      "say (value=Text laut sagen), notify (value=Text als Mitteilung), lock_screen, sleep_display, battery, " +
      "screenshot_look (Friday sieht den Bildschirm), find_file (value=Dateiname), dark_mode_toggle.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: MAC_ACTIONS },
        value: { type: "string" },
      },
      required: ["action"],
    },
  },
  {
    name: "run_protocol",
    description: "Startet ein gespeichertes Protokoll (eine Abfolge von Aktionen), z. B. 'feierabend' oder 'hausparty'.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "list_protocols",
    description: "Listet alle verfügbaren Protokolle.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "fernseher",
    description:
      "Steuert den Samsung-Fernseher im WLAN. Aktionen: an, aus, lauter/leiser (anzahl = Stufen, Standard 3), stumm, " +
      "sender_hoch/sender_runter, sender (value = Sendernummer), app (value = App-Name wie Netflix, YouTube, Prime Video, Disney+), " +
      "taste (value = home, zurueck, ok, hoch, runter, links, rechts, play, pause, quelle, hdmi1-4, info), status. " +
      "Nutze es bei 'Fernseher', 'TV' oder wenn etwas auf dem Fernseher laufen soll ('mach Netflix an').",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["an", "aus", "lauter", "leiser", "stumm", "sender_hoch", "sender_runter", "sender", "app", "taste", "status"] },
        value: { type: "string" },
        anzahl: { type: "number" },
      },
      required: ["action"],
    },
  },
  {
    name: "alexa",
    description:
      "Steuert Alexa über Voice Monkey. Aktionen: routine (value = Name der Alexa-Routine, z. B. 'Licht an', 'Gute Nacht'), " +
      "ansage (value = Satz, den Alexa laut sagt; lautsprecher = optional Echo-Name wie 'Wohnzimmer' oder 'überall'), " +
      "liste (zeigt alle Routinen und Lautsprecher). Nutze es, wenn Alexa, ein Echo oder Geräte genannt werden, die an Alexa hängen.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["routine", "ansage", "liste"] },
        value: { type: "string" },
        lautsprecher: { type: "string" },
      },
      required: ["action"],
    },
  },
  {
    name: "get_health",
    description: "Liest die Gesundheitsdaten vom iPhone (Schritte, Schlaf, Ruhepuls, Kalorien, Training, Gewicht): die letzten Werte, Wochenschnitt und den Verlauf der letzten Tage.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "update",
    description: "Fridays eigene Software-Updates. action=check prüft, ob auf GitHub eine neuere Version liegt. action=install installiert sie und startet Friday neu; nur nutzen, wenn der Nutzer das ausdrücklich will.",
    input_schema: {
      type: "object",
      properties: { action: { type: "string", enum: ["check", "install"] } },
      required: ["action"],
    },
  },
  {
    name: "video_schnitt",
    description: "Fridays Videoschnitt-Team (Regie, Transkript, Schnitt, Farbe, Untertitel, Audio) auf dem Mac. action=start schneidet alle Clips aus dem Ordner ~/Friday-Video/Eingang zu einem 9:16-Video mit Untertiteln (dauert ein paar Minuten, das Ergebnis meldet das Dashboard). action=status zeigt den Stand. action=open_eingang / open_fertig öffnet den Ordner im Finder. look: natürlich, warm, kühl oder kino.",
    input_schema: {
      type: "object",
      properties: { action: { type: "string", enum: ["start", "status", "open_eingang", "open_fertig"] }, look: { type: "string", enum: LOOKS } },
      required: ["action"],
    },
  },
  {
    name: "video_erstellen",
    description: "Fridays Video-Studio: erstellt auf Zuruf ein komplettes Kurzvideo (z. B. 'mach mir ein 20-Sekunden-Video über Mallorca mit Musik'). Regie schreibt das Drehbuch, Bildsucher holt gemeinfreie Fotos (oder nimmt die Clips/Fotos aus ~/Friday-Video/Eingang), Komponist komponiert eigene lizenzfreie Musik, optional spricht ein Sprecher (Mac-Stimme). Ergebnis als MP4 in ~/Friday-Video/Fertig, das Dashboard zeigt den Fortschritt live. Dauert ca. 1 Minute. Für das Schneiden vorhandener Clips mit Untertiteln nimm video_schnitt.",
    input_schema: {
      type: "object",
      properties: {
        thema: { type: "string", description: "Worum geht es im Video" },
        sekunden: { type: "integer", minimum: 5, maximum: 90 },
        format: { type: "string", enum: Object.keys(STUDIO_FORMATE), description: "hoch = 9:16 (TikTok/Reels), quer = 16:9 (YouTube), quadrat = 1:1" },
        musik: { type: "string", enum: ["auto", "aus", "eigene", ...STIMMUNG_IDS], description: "auto = passend zum Thema, eigene = Datei aus ~/Friday-Video/Musik" },
        bilder: { type: "string", enum: Object.keys(BILDQUELLEN), description: "auto = freie Fotos, grafik = nur Neon-Grafik, eigene = Clips/Fotos aus dem Ordner Eingang" },
        sprecher: { type: "boolean" },
        stil: { type: "string", description: "optional: Stil- oder Inhaltswunsch" },
      },
      required: ["thema"],
    },
  },
  {
    name: "webseite_bauen",
    description: "Webseiten-Werkstatt: baut aus einem Kundenauftrag eine komplette, verkaufsfertige Webseite (eine HTML-Datei) mit Angebotstext und Preisvorschlag, gespeichert in ~/Friday-Webseiten. aendern_id überarbeitet ein bestehendes Projekt. Je nach Größe 30 Sekunden bis 2 Minuten; das Dashboard zeigt den Bau (in Eve live mit Countdown). Nenn im auftrag auch einen Zeitwunsch des Nutzers wörtlich (z. B. 'in 30 Minuten'). Verkaufen und kassieren tut der Nutzer selbst.",
    input_schema: {
      type: "object",
      properties: {
        auftrag: { type: "string" },
        aendern_id: { type: "string", description: "optional: id eines bestehenden Projekts" },
        stil: { type: "string", enum: ["neon", "elegant", "hell", "natur", "kraft", "verspielt"], description: "optional: Design-Stil, nur wenn der Nutzer einen nennt (neon=dunkel futuristisch, elegant=schwarz-gold, hell=clean modern, natur=warm grün, kraft=anthrazit-gelb, verspielt=bunt pastell)" },
        sofort: { type: "boolean", description: "true, wenn der Nutzer ausdrücklich eine Sofort-Vorlage/ohne Claude/kostenlos will" },
      },
      required: ["auftrag"],
    },
  },
  {
    name: "welt_alarm",
    description: "Welt-Alarm: holt die 3 größten aktuellen Katastrophen weltweit (Wirbelstürme, Erdbeben, Fluten, Vulkane) von GDACS und startet im Lagezentrum ein Briefing mit Zoom, Zahlen und Ansage. Nutzen bei 'Was ist auf der Welt los?', 'Gibt es Katastrophen?', 'Welt-Alarm'. Das Dashboard spricht das Briefing selbst; antworte danach nur kurz.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "werkstatt",
    description: "Fridays 3D-Werkstatt: entwirft aus einem Wunsch (z. B. 'ein Porsche Taycan', 'ein Wohnhaus mit 12 Etagen', 'eine Gartenhütte') ein 3D-Hologramm. Für Sportwagen, Auto, SUV, LKW, Bus, Motorrad, Zug, Flugzeug, Kampfjet, Helikopter, Containerschiff, Kreuzfahrtschiff, Motorboot, Segelboot, U-Boot und Rakete hat sie eigene Vorlagen (ein bestimmtes Modell wie 'Lamborghini Huracán' entwirft Claude, notfalls nimmt sie die Vorlage mit den echten Maßen). Wohnhäuser ('Mehrfamilienhaus mit 4 Etagen', 'Einfamilienhaus') entwirft sie selbst ohne Claude: Wohnungen, Grundrisse mit m², Möbel und Leitungen (Kaltwasser, Warmwasser, Abwasser, Heizung, Strom) als schematischer Entwurf, das im Dashboard Schritt für Schritt aufgebaut und erklärt wird. erweitern=true ergänzt das zuletzt gebaute Modell (z. B. 'mach eine Fußbodenheizung rein'). Die Werkstatt erklärt jedes Bauteil selbst laut; antworte danach nur mit einem kurzen Satz wie 'Sehr gern, Chef.'",
    input_schema: {
      type: "object",
      properties: { wunsch: { type: "string" }, erweitern: { type: "boolean" } },
      required: ["wunsch"],
    },
  },
  {
    name: "markt_radar",
    description: "Markt-Radar: Kronos rechnet lokal 100 mögliche Kursverläufe für die nächsten 24 Stunden (Gold, Bitcoin, Ethereum). action=prognose liefert Anteil steigender Verläufe, Median und Spanne (5.–95. Perzentil); eine neue Rechnung dauert 1–2 Minuten. action=depot zeigt das Papierdepot mit Spielgeld und die Trefferquote. Sag immer dazu, dass es eine Prognose ist und keine Gewissheit, und dass das Modell in Tests stark nach oben geneigt hat. Keine Anlageberatung. Handeln kann nur der Nutzer selbst per Klick auf Freigeben im Markt-Radar, und nur mit Spielgeld.",
    input_schema: {
      type: "object",
      properties: { action: { type: "string", enum: ["prognose", "depot"] }, asset: { type: "string", enum: Object.keys(MAERKTE) } },
      required: ["action"],
    },
  },
  MARKT_PLUS,
  {
    name: "send_push",
    description: "Schickt dem Nutzer eine Push-Nachricht aufs Handy.",
    input_schema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  },
  smartHomeTool,
  ...dienstTools,
  ...kernTools,
  ...kontenTools, // v1.162.0: Meine Konten (nur lesen)
  ...jarvisTools, // v1.134.0: Dauer-Wächter, Dokumenten-Wissen, Apple Notizen/Kontakte/Musik
];

// --- Wetter (Open-Meteo, kostenlos, kein Schlüssel nötig) ---
const WEATHER_CODES = {
  0: "klar", 1: "überwiegend klar", 2: "teilweise bewölkt", 3: "bedeckt", 45: "Nebel", 48: "Reifnebel",
  51: "leichter Niesel", 53: "Niesel", 55: "starker Niesel", 61: "leichter Regen", 63: "Regen", 65: "starker Regen",
  71: "leichter Schnee", 73: "Schnee", 75: "starker Schnee", 80: "Regenschauer", 81: "Regenschauer", 82: "heftige Schauer",
  95: "Gewitter", 96: "Gewitter mit Hagel", 99: "Gewitter mit Hagel",
};

// Wetter wird 10 Minuten zwischengespeichert (schneller, schont die Dienste). Fällt das Netz aus,
// nimmt Friday bis zu 6 Stunden den letzten bekannten Stand und sagt dazu, wie alt er ist.
const wetterCache = new Map(); // ort -> { zeit, daten }
const ortCache = new Map(); // ort -> { name, latitude, longitude }
const WETTER_FRISCH = 10 * 60 * 1000;
const WETTER_NOTFALL = 6 * 3600 * 1000;

async function holeJson(url, versuche = 2) {
  let letzter;
  for (let i = 0; i < versuche; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error(`Wetterdienst antwortet mit ${r.status}`);
      return await r.json();
    } catch (err) {
      letzter = err;
      if (i + 1 < versuche) await new Promise((ok) => setTimeout(ok, 600));
    }
  }
  throw letzter;
}

export async function getWeather(city = config.city) {
  const schluessel = String(city || "").trim().toLowerCase();
  const alt = wetterCache.get(schluessel);
  if (alt && Date.now() - alt.zeit < WETTER_FRISCH) return alt.daten;
  try {
    let place = ortCache.get(schluessel);
    if (!place) {
      const geo = await holeJson(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=${encodeURIComponent(city)}`);
      place = geo.results?.[0];
      if (!place) return { error: `Ort "${city}" nicht gefunden` };
      ortCache.set(schluessel, { name: place.name, latitude: place.latitude, longitude: place.longitude });
    }
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=3&timezone=auto`;
    const w = await holeJson(url);
    if (!w?.current || !Array.isArray(w?.daily?.time)) throw new Error(w?.reason || "Wetterdienst lieferte keine Daten");
    const daten = {
      ort: place.name,
      jetzt: {
        temperatur: w.current.temperature_2m,
        gefuehlt: w.current.apparent_temperature,
        wetter: WEATHER_CODES[w.current.weather_code] ?? "unbekannt",
        wind_kmh: w.current.wind_speed_10m,
        luftfeuchte: w.current.relative_humidity_2m,
      },
      tage: w.daily.time.map((day, i) => ({
        tag: day,
        wetter: WEATHER_CODES[w.daily.weather_code?.[i]] ?? "unbekannt",
        max: w.daily.temperature_2m_max?.[i],
        min: w.daily.temperature_2m_min?.[i],
        regen_prozent: w.daily.precipitation_probability_max?.[i],
      })),
    };
    wetterCache.set(schluessel, { zeit: Date.now(), daten });
    return daten;
  } catch (err) {
    if (alt && Date.now() - alt.zeit < WETTER_NOTFALL) {
      const min = Math.round((Date.now() - alt.zeit) / 60000);
      return { ...alt.daten, stand_vor_minuten: min, hinweis: `Letzter bekannter Stand von vor ${min} Minuten (Wetterdienst gerade nicht erreichbar).` };
    }
    throw err;
  }
}

// --- Protokolle ---
// protocols.json bringt Friday mit (wird bei Updates erneuert).
// eigene-protokolle.json gehört dir: Updates fassen sie nie an, gleiche Namen überschreiben die mitgelieferten.
const PROTOCOL_FILE = path.join(ROOT, "protocols.json");
const OWN_PROTOCOL_FILE = path.join(ROOT, "eigene-protokolle.json");

function readProtocols(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") console.error(`${path.basename(file)} ist fehlerhaft:`, err.message);
    return {};
  }
}

export function getProtocols() {
  return { ...readProtocols(PROTOCOL_FILE), ...readProtocols(OWN_PROTOCOL_FILE) };
}

async function runProtocol(name) {
  const protocols = getProtocols();
  const key = Object.keys(protocols).find((k) => k.toLowerCase() === String(name).toLowerCase().trim());
  if (!key) return { error: `Protokoll "${name}" gibt es nicht. Verfügbar: ${Object.keys(protocols).join(", ")}` };
  const results = [];
  for (const step of protocols[key].steps || []) {
    if (step.mac) results.push({ mac: step.mac.action, ...(await sendToAgent(step.mac.action, { value: step.mac.value })) });
    else if (step.home) results.push({ home: step.home.entity_id, ...(await homeAssistant(step.home.action, step.home.entity_id)) });
    else if (step.push) results.push({ push: await sendPush("F.R.Ai.D.A.Y", step.push) });
    else if (step.wait) await new Promise((r) => setTimeout(r, Math.min(Number(step.wait) || 0, 10) * 1000));
  }
  return { protokoll: key, beschreibung: protocols[key].description, schritte: results };
}

// --- Home Assistant (für Protokolle; die eigentliche Anbindung steckt in homeassistant.js) ---
async function homeAssistant(action, entityId) {
  const r = await haCommand({ action, value: entityId });
  return r.ok ? { ok: true, ...(r.text ? { text: r.text } : {}) } : { error: r.error };
}

// --- Ausführen ---
// Gibt entweder Text/JSON zurück oder (bei screenshot_look) Inhalt mit Bild.
const ACTLOG = {
  add_task: ["aufgabe", (i) => `Aufgabe erstellt: ${i.text || ""}`],
  add_shopping: ["einkauf", (i) => `Einkauf notiert: ${i.item || i.text || ""}`],
  set_reminder: ["erinnerung", (i) => `Erinnerung gesetzt: ${i.text || ""}`],
  remember: ["gedaechtnis", (i) => `Gemerkt: ${i.text || ""}`],
  open_app: ["mac", (i) => `Geöffnet: ${i.name || ""}`],
  mac: ["mac", (i) => `Mac gesteuert: ${i.action || ""}`],
  run_protocol: ["mac", (i) => `Protokoll ausgeführt: ${i.name || ""}`],
  send_push: ["mitteilung", () => "Mitteilung gesendet"],
  video_schnitt: ["mac", (i) => `Videoschnitt: ${i.action || ""}`],
  video_erstellen: ["mac", (i) => `Video-Studio: ${i.thema || ""} (${i.sekunden || 20} s)`],
  werkstatt: ["mac", (i) => `Werkstatt: ${i.wunsch || ""}`],
  webseite_bauen: ["mac", (i) => `Webseite: ${i.auftrag || ""}`],
  world_news: ["suche", (i) => `Nachrichten geprüft: ${i.country || i.topic || "Welt"}`],
  lookup: ["suche", (i) => `Nachgeschlagen: ${i.query || ""}`],
  country_info: ["suche", (i) => `Länder-Info: ${i.country || ""}`],
  air_quality: ["suche", (i) => `Luftqualität: ${i.city || ""}`],
  alexa: ["mac", (i) => `Alexa: ${i.action === "ansage" ? "Ansage" : i.action || ""}${i.action === "routine" && i.value ? " " + i.value : ""}`],
  fernseher: ["mac", (i) => `Fernseher: ${i.action || ""}${i.value ? " " + i.value : ""}`],
  kalender: ["erinnerung", (i) => `Kalender: ${i.action || ""}${i.value && i.action !== "termine" ? " " + i.value : ""}`],
  spotify: ["mac", (i) => `Spotify: ${i.action || ""}${i.value ? " " + i.value : ""}`],
  hue: ["mac", (i) => `Licht: ${i.action || ""}${i.wo ? " " + i.wo : ""}`],
  smart_home: ["mac", (i) => `Zuhause: ${i.action || ""}${i.value || i.entity_id ? " " + (i.value || i.entity_id) : ""}`],
  todoist: ["aufgabe", (i) => `Todoist: ${i.action || ""}${i.value ? " " + i.value : ""}`],
  notion: ["gedaechtnis", (i) => `Notion: ${i.action || ""}`],
};

// Weitere Werkzeuge mit lesbarem Namen fürs Logbuch.
const LOGTITEL = {
  tabelle_erstellen: (i) => `Excel-Tabelle erstellt: ${i.titel || ""}`,
  ablauf_speichern: (i) => `Ablauf gemerkt: ${i.name || ""}`,
  ablauf_bewerten: (i) => `Ablauf ${i.geklappt ? "hat geklappt" : "ging schief"}: ${i.name || ""}`,
  seele_notiz: (i) => `Seele ergänzt: ${String(i.text || "").slice(0, 80)}`,
  faehigkeit_erstellen: (i) => `Fähigkeit angelegt: ${i.name || ""}`,
  get_weather: (i) => `Wetter abgefragt${i.city ? `: ${i.city}` : ""}`,
  list_tasks: () => "Aufgaben angesehen",
  list_reminders: () => "Erinnerungen angesehen",
  list_protocols: () => "Protokolle angesehen",
  forget: (i) => `Vergessen: ${i.query || ""}`,
  get_health: () => "Gesundheitsdaten angesehen",
  check_mail: () => "Mails geprüft",
  sort_mail: () => "Mails sortiert",
  currency: (i) => `Währung umgerechnet${i.from ? `: ${i.amount || ""} ${i.from} → ${i.to || ""}` : ""}`,
  crypto: (i) => `Krypto-Kurs: ${i.coin || i.coins || ""}`,
  holidays: () => "Feiertage nachgesehen",
  iss: () => "ISS-Position abgefragt",
  route_planen: (i) => `Route geplant: ${i.von ? `${i.von} → ` : ""}${i.nach || ""}`,
  welt_alarm: () => "Welt-Alarm abgefragt",
  markt_radar: (i) => `Markt-Radar: ${i.action || ""} ${i.asset || ""}`,
  markt_plus: (i) => `Markt-Radar Plus: ${i.action || ""} ${i.name || i.symbol || ""}`,
  dokument_erstellen: (i) => `Dokument erstellt: ${i.titel || ""}`,
  fragebogen_erstellen: (i) => `Fragebogen erstellt: ${i.titel || ""}`,
  system_check: () => "System-Check gemacht",
  dokumente_suchen: (i) => `Dokumente durchsucht: ${i.frage || ""}`,
  dauer_waechter: (i) => `Dauer-Wächter: ${i.aktion || ""} ${i.art || ""} ${i.suche || i.coin || i.url || i.stichwort || ""}`,
  apple_notizen: (i) => `Notizen: ${i.aktion || ""} ${i.text || i.titel || ""}`,
  apple_kontakte: (i) => `Kontakte: ${i.aktion || ""} ${i.name || ""}`,
  apple_musik: (i) => `Musik: ${i.aktion || ""} ${i.name || i.text || ""}`,
  update: (i) => `Update: ${i.action || "prüfen"}`,
};
// Diese Bereiche schreiben ihr Logbuch selbst (mit genauerem Ergebnis).
const LOGBUCH_SELBST = new Set(["spiel_bauen", "anrufe", "werkstatt", "add_task", "add_shopping", "set_reminder", "remember", "forget"]);

/**
 * Führt ein Werkzeug aus und hält es im Logbuch fest.
 * @param {{quelle?:string, kanal?:string}} [wer] - z. B. { quelle: "claude", kanal: "telegram" }
 */
export async function runTool(name, input = {}, wer = {}) {
  if (ACTLOG[name]) { try { store.logActivity(ACTLOG[name][0], ACTLOG[name][1](input), { logbuch: false }); } catch { /* egal */ } }
  const start = Date.now();
  // Regelwerk (v1.135.0): feste Regeln vor jedem Werkzeug – verboten heißt sofort Schluss (vor der Freigabe-Glocke).
  if (wer.quelle === "claude" || ["mission", "automation", "modul"].includes(wer.kanal)) {
    const r = regelwerkPruefe(name, input, wer);
    if (!r.erlaubt) {
      gedaechtnisEreignis({ werkzeug: name, kurz: `Gestoppt vom Regelwerk: ${r.grund}`, ok: false, kanal: wer.kanal });
      return { error: `Vom Regelwerk gestoppt: ${r.grund}`, regelwerk: r.regel };
    }
  }
  // Autonomie-Regler + Notfallmodus: Claude und Automatisches dürfen nicht alles sofort.
  if (wer.quelle === "claude" || ["mission", "automation", "modul"].includes(wer.kanal)) {
    const p = pruefeWerkzeug(name, wer.kanal);
    if (p.blockiert) { logWerkzeug(name, input, wer, { error: p.blockiert }, 0); return { error: p.blockiert }; }
    if (p.freigabe) {
      const g = freigabeAnfordern({ werkzeug: name, eingabe: input, kanal: wer.kanal, grund: wer.grund });
      return { wartet_auf_freigabe: true, info: `Diese Aktion (${g.titel}) braucht erst die Freigabe von Boss. Sie liegt in der Freigabe-Glocke oben im Dashboard (und als Knopf in Telegram). Sag Boss kurz, dass er sie dort freigeben kann oder einfach „gib frei“ sagt. Behaupte nicht, sie sei schon erledigt.` };
    }
  }
  // Eve (Testversion): Geräte, Konten und Nachrichten werden nur simuliert.
  if (IST_EVE && EVE_SIMULIERT.has(name)) {
    const sim = simuliereWerkzeug(name, input);
    logWerkzeug(name, input, wer, sim, 0);
    return sim;
  }
  let result;
  try {
    result = await runToolIntern(name, input, wer);
  } catch (err) {
    logWerkzeug(name, input, wer, { error: err.message }, Date.now() - start);
    throw err;
  }
  logWerkzeug(name, input, wer, result, Date.now() - start);
  // Gedächtnis-Schublade "Ereignisse": was Friday zuletzt getan hat.
  if (!NUR_ANZEIGE.has(name)) {
    const fehler = result && typeof result === "object" && !Array.isArray(result) && result.error;
    gedaechtnisEreignis({ werkzeug: name, kurz: `${ACTLOG[name] ? ACTLOG[name][1](input || {}) : LOGTITEL[name] ? LOGTITEL[name](input || {}) : name}${fehler ? ` – ${String(result.error).slice(0, 80)}` : ""}`, ok: !fehler, kanal: wer.kanal });
  }
  return result;
}
// Reine Abfragen, die als Ereignis nichts bringen
const NUR_ANZEIGE = new Set(["konten", "get_weather", "list_tasks", "list_reminders", "list_protocols", "iss", "air_quality", "currency", "crypto", "holidays"]);

function logWerkzeug(name, input, wer, result, dauer) {
  if (LOGBUCH_SELBST.has(name)) return;
  try {
    const titel = ACTLOG[name] ? ACTLOG[name][1](input || {}) : LOGTITEL[name] ? LOGTITEL[name](input || {}) : `Werkzeug: ${name}`;
    const fehler = result && typeof result === "object" && !Array.isArray(result) && result.error ? String(result.error) : "";
    let details = fehler;
    if (!details && result && typeof result === "object" && !Array.isArray(result.content)) {
      const text = result.text || result.info || result.hinweis || result.gebaut || "";
      if (typeof text === "string") details = text;
    }
    logbuch.eintragen({ bereich: logbuch.bereichFuer(name === "mac" ? "mac" : name), titel: titel.trim() || name, details, quelle: wer.quelle || "", kanal: wer.kanal || "", claude: wer.quelle === "claude", ok: !fehler, dauer_ms: dauer });
  } catch { /* egal */ }
}

async function runToolIntern(name, input = {}, wer = {}) {
  if (istDienstTool(name)) return runDienstTool(name, input);
  if (istKernTool(name)) return runKernTool(name, input);
  if (istJarvisTool(name)) return runJarvisTool(name, input, wer);
  if (istKontenTool(name)) return runKontenTool(name, input);
  switch (name) {
    case "world_news": {
      if (!input.country) {
        const list = getOverview().laender;
        return list.sort((a, b) => b.meldungen - a.meldungen).slice(0, 8).map((c) => ({ land: c.name, meldungen: c.meldungen, top: c.top }));
      }
      const country = findCountry(input.country);
      if (!country) return { error: `Das Land ist nicht im Lagezentrum. Verfügbar: ${COUNTRIES.map((c) => c.name).join(", ")}. Nutze sonst die Websuche.` };
      const news = await getCountryNews(country);
      return { land: country.name, schlagzeilen: news.items.slice(0, 12).map((n) => `${n.title} (${n.source})`) };
    }
    case "webseite_bauen": {
      if (input.sofort && !input.aendern_id) {
        const v = await baueVorlage(input.auftrag, { stil: input.stil });
        return { gebaut: v.titel, id: v.id, preisvorschlag_eur: v.preis_eur, qualitaet: v.qualitaet?.punkte, hinweis: "Sofort-Vorlage fertig, im Dashboard zu sehen. Sag kurz, was du gebaut hast, und den Preisvorschlag." };
      }
      if (liveFrei()) {
        const l = startLive(input.auftrag, input.aendern_id || null, { stil: input.stil });
        if (!l.ok) return { error: l.error };
        return { baut: l.job.titel || l.job.auftrag, countdown_sekunden: l.job.schaetzung_s, hinweis: `Die Webseiten-Werkstatt zeigt jetzt live, wie die Seite programmiert wird, mit Countdown und sagt am Ende selbst Bescheid. Antworte NUR mit genau diesem Satz, ohne etwas dazu: ${l.job.spruch}` };
      }
      const r = await buildSite(input.auftrag, input.aendern_id || null, { stil: input.stil });
      if (!r.ok) return { error: r.error };
      return { gebaut: r.titel, id: r.id, preisvorschlag_eur: r.preis_eur, projekte_gesamt: listSites().length, ...(r.hinweis ? { achtung: r.hinweis } : {}), hinweis: "Das Dashboard zeigt die Seite gleich. Sag kurz, was du gebaut hast, und den Preisvorschlag." };
    }
    case "welt_alarm": {
      const d = await getAlarm();
      return { ereignisse: d.ereignisse.map((e) => ({ was: e.titel, name: e.name, laender: e.laender, stufe: e.stufe, wert: `${Math.round(e.wert * 10) / 10} ${e.einheit}`, menschen: e.menschen })), hinweis: "Das Lagezentrum zeigt und spricht das Briefing gerade selbst. Antworte nur kurz." };
    }
    case "werkstatt": {
      const basis = input.erweitern ? getLatestBuild()?.plan : null;
      const r = await planBuild(input.wunsch, basis);
      if (!r.ok) return { error: r.error };
      return { baut: r.plan.titel || r.wunsch, hinweis: "Die Werkstatt baut das Modell jetzt live und erzählt selbst jedes Bauteil. Antworte nur mit einem ganz kurzen Satz wie 'Läuft, Chef.' (wird nicht vorgelesen) – keine Details, keine Zahlen." };
    }
    case "markt_radar": {
      if (input.action === "depot") return getDepot();
      const r = getForecast(input.asset || "gold");
      if (!r.data) return { status: r.status, hinweis: r.status === "fehler" ? r.error : "Kronos rechnet gerade (1–2 Minuten). Das Ergebnis erscheint im Markt-Radar." };
      const d = r.data;
      return { markt: d.name, status: r.status, kurs_jetzt: d.jetzt, stunden: d.stunden, verlaeufe_hoeher: `${d.hoeher} von ${d.anzahl}`, median: d.median, spanne: [d.p5, d.p95], modell_signal: r.signal, warnung: "Prognose, keine Gewissheit. Im Backtest lag das Modell oft daneben und neigte stark nach oben." };
    }
    case "markt_plus": return marktPlus(input);
    case "video_schnitt": {
      if (input.action === "start") return startVideoJob({ look: input.look });
      if (input.action === "open_eingang") return openVideoDir("eingang");
      if (input.action === "open_fertig") return openVideoDir("fertig");
      const v = getVideoJob();
      if (!v.job) return { status: "frei", clips_im_eingang: v.clips.length, ordner: v.dirs.eingang };
      return { status: v.job.status, agenten: Object.fromEntries(Object.entries(v.job.agents).map(([k, a]) => [k, `${a.status}: ${a.text}`])), ergebnis: v.job.result?.name, fehler: v.job.error };
    }
    case "video_erstellen": {
      const r = starteStudio(input, { quelle: wer.kanal || "claude" });
      if (!r.ok) return { fehler: r.error, laeuft: r.laeuftSchon ? getStudio().job?.auftrag?.thema : undefined };
      return { gestartet: true, auftrag: r.auftrag, hinweis: "Das Dashboard zeigt das Studio live; Friday meldet sich, wenn das Video fertig ist. Sag nur kurz, dass das Team loslegt." };
    }
    case "spiel_bauen": {
      const r = starteSpiel(input.auftrag, { basis: input.basis_id, kanal: wer.kanal || "web" });
      return { gestartet: true, quelle: r.quelle === "claude" ? "Claude programmiert" : "eingebaute Vorlage (kein Guthaben)", vorhandene_spiele: listeSpiele().slice(0, 8).map((s) => ({ id: s.id, titel: s.titel })), hinweis: "Das Dashboard zeigt jetzt live, wie du programmierst, und startet das Spiel automatisch. Sag nur kurz, dass du loslegst. Schreib keinen Code in die Antwort." };
    }
    case "dokument_erstellen": {
      const d = dokumentErstellen(input);
      if (d.error) return d;
      return { gespeichert: d.titel, id: d.id, hinweis: "Das Dashboard zeigt das Dokument gleich. Sag nur kurz, was drinsteht, lies es nicht komplett vor." };
    }
    case "tabelle_erstellen": {
      const t = tabelleErstellen({ ...input, quelle: wer.quelle || "" });
      if (t.error) return t;
      return { ok: true, gespeichert: t.titel, id: t.id, blaetter: t.blaetter, datei: t.datei, am_mac_geoeffnet: t.geoeffnet, hinweis: `Die Excel-Datei ist gespeichert${t.geoeffnet ? " und am Mac geöffnet" : ""}; das Dashboard zeigt sie mit Download-Knopf. Sag in ein, zwei Sätzen, was drinsteht. Lies die Tabelle nicht vor.` };
    }
    case "fragebogen_erstellen": {
      const d = fragebogenErstellen(input);
      if (d.error) return d;
      return { erstellt: d.titel, fragen: d.fragen.length, id: d.id, hinweis: "Das Dashboard öffnet den Fragebogen gleich zum Ausfüllen. Sag kurz, dass er bereitliegt; lies die Fragen nicht vor." };
    }
    case "get_weather":
      return getWeather(input.city || config.city);
    case "remember":
      return faktMerken(String(input.fact || ""), input.schublade);
    case "forget":
      return { geloescht: store.forgetMemory(String(input.query || "")) };
    case "set_reminder": {
      const due = new Date(`${input.when}`);
      if (Number.isNaN(due.getTime())) return { error: "Zeitpunkt nicht verstanden" };
      return store.addReminder(String(input.text || ""), due.toISOString());
    }
    case "list_reminders":
      return store.getReminders().filter((r) => !r.done);
    case "mac": {
      if (!MAC_ACTIONS.includes(input.action)) return { error: "Unbekannte Mac-Aktion" };
      if (!isAgentOnline()) return { error: "Der Mac ist gerade nicht verbunden." };
      const result = await sendToAgent(input.action, { value: input.value ?? "" }, input.action === "find_file" ? 30000 : 20000);
      if (input.action === "screenshot_look" && result.ok && result.image) {
        return {
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: result.image } },
            { type: "text", text: "Das ist der aktuelle Bildschirm des Macs." },
          ],
        };
      }
      return result;
    }
    case "run_protocol":
      return runProtocol(input.name);
    case "list_protocols":
      return Object.fromEntries(Object.entries(getProtocols()).map(([k, v]) => [k, v.description]));
    case "fernseher": {
      const r = await tvCommand(input);
      return r.ok ? r : { error: r.error };
    }
    case "alexa": {
      const r = await alexaCommand(input);
      return r.ok ? r : { error: r.error };
    }
    case "get_health": {
      const g = gesundheitUebersicht();
      if (!g.letzter_tag) return store.getHealth() ?? { info: "Noch keine Gesundheitsdaten vom iPhone empfangen." };
      return { letzte_werte: store.getHealth(), wochenschnitt: Object.fromEntries(Object.entries(g.trends).map(([k, v]) => [k, { diese_woche: v.woche, vorwoche: v.vorwoche, letzter: v.letzter }])), letzte_tage: g.verlauf.slice(-10) };
    }
    case "update":
      return input.action === "install" ? startUpdate() : checkForUpdate();
    case "send_push":
      return { gesendet: await sendPush("F.R.Ai.D.A.Y", String(input.message || "")) };
    case "add_task":
      return store.addTask(String(input.text || ""));
    case "system_check": {
      const r = await runSystemCheck();
      const liste = r.checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.label}${c.detail ? " – " + c.detail : ""}`).join("\n");
      return { result: `System-Check: ${r.ok}/${r.gesamt} Dienste laufen.\n${liste}` };
    }
    case "check_mail": {
      if (!mailConfigured()) return { error: "iCloud-Mail ist noch nicht verbunden." };
      const o = await getMailOverview();
      if (!o.ok) return { error: o.fehler || "Mail nicht erreichbar." };
      const liste = o.nachrichten.slice(0, 8).map((n) => `${n.gelesen ? "" : "• "}${n.von}: ${n.betreff}`).join("\n");
      return { result: `${o.ungelesen} ungelesen von ${o.gesamt}.\n${liste}` };
    }
    case "sort_mail": {
      if (!mailConfigured()) return { error: "iCloud-Mail ist noch nicht verbunden." };
      const r = await sortMail();
      if (!r.ok) return { error: r.fehler || "Sortieren fehlgeschlagen." };
      return { result: r.verschoben ? `${r.verschoben} Newsletter in den Ordner Newsletter sortiert.` : "Keine Newsletter zum Sortieren gefunden." };
    }
    case "list_tasks":
      return store.getTasks().filter((t) => !t.done);
    case "add_shopping":
      return store.addShopping(String(input.text || ""));
    case "open_app": {
      if (!isAgentOnline()) return { error: "Der Mac ist gerade nicht verbunden." };
      const APP_URLS = {
        youtube: "https://www.youtube.com", netflix: "https://www.netflix.com", amazon: "https://www.amazon.de",
        "prime video": "https://www.primevideo.com", "amazon prime": "https://www.primevideo.com",
        "disney": "https://www.disneyplus.com", "disney+": "https://www.disneyplus.com", "disney plus": "https://www.disneyplus.com",
        spotify: "https://open.spotify.com", "apple music": "https://music.apple.com", "youtube music": "https://music.youtube.com",
        twitch: "https://www.twitch.tv", tiktok: "https://www.tiktok.com", instagram: "https://www.instagram.com",
        whatsapp: "https://web.whatsapp.com", telegram: "https://web.telegram.org", gmail: "https://mail.google.com",
        google: "https://www.google.com", "google maps": "https://maps.google.com", maps: "https://maps.google.com",
        x: "https://x.com", twitter: "https://x.com", facebook: "https://www.facebook.com", reddit: "https://www.reddit.com",
        chatgpt: "https://chatgpt.com", ebay: "https://www.ebay.de", paypal: "https://www.paypal.com", dazn: "https://www.dazn.com",
        wetter: "https://www.wetter.com", news: "https://news.google.com",
        osiris: OSIRIS_URL, "osiris ai": OSIRIS_URL, "osiris karte": OSIRIS_URL,
        "live karte": OSIRIS_URL, "weltkarte": OSIRIS_URL, "lagekarte": OSIRIS_URL,
        lagezentrum: OSIRIS_URL, "lage zentrum": OSIRIS_URL,
      };
      const key = String(input.name || "").trim().toLowerCase();
      let url = APP_URLS[key];
      if (url === OSIRIS_URL) url = await osirisUrl();
      if (url) return sendToAgent("open_url", { value: url });
      // Unbekannt: als Mac-App mit diesem Namen öffnen.
      return sendToAgent("open_app", { value: String(input.name || "").trim() });
    }
    case "air_quality": {
      const city = input.city || config.city;
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=${encodeURIComponent(city)}`).then((r) => r.json());
      const place = geo.results?.[0];
      if (!place) return { error: `Ort "${city}" nicht gefunden` };
      return { ort: place.name, ...(await getAirQuality(place.latitude, place.longitude)) };
    }
    case "currency":
      return getExchange(input.amount ?? 1, input.from, input.to);
    case "crypto":
      return getCrypto(input.coin, input.currency || "eur");
    case "holidays":
      return getHolidays(input.country || "DE", input.year);
    case "iss":
      return getISS();
    case "lookup":
      return getWiki(input.term || "");
    case "route_planen":
      return routeFuerClaude(input);
    case "country_info": {
      const country = findCountry(input.country);
      if (!country) return { error: `Land "${input.country}" nicht gefunden.` };
      return getCountryInfo(country);
    }
    default:
      return { error: `Unbekanntes Werkzeug ${name}` };
  }
}
