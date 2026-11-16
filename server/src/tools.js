// Fridays Werkzeuge: alles, was sie außer Reden noch kann.
import fs from "node:fs";
import path from "node:path";
import { config, ROOT } from "./config.js";
import * as store from "./store.js";
import { mailConfigured, getMailOverview, sortMail } from "./mail.js";
import { runSystemCheck } from "./syscheck.js";
import { sendToAgent, isAgentOnline } from "./agent-hub.js";
import { sendPush } from "./notify.js";
import { checkForUpdate, startUpdate } from "./updater.js";
import { COUNTRIES, findCountry, getCountryNews, getOverview, getCountryInfo } from "./lagezentrum.js";
import { getVideoJob, startVideoJob, openVideoDir, LOOKS } from "./videoteam.js";
import { getForecast, getDepot, MAERKTE } from "./markt.js";
import { planBuild, getLatestBuild } from "./werkstatt.js";
import { getAlarm } from "./lagezentrum.js";
import { buildSite, listSites } from "./webseiten.js";
import { command as tvCommand } from "./fernseher.js";
import { command as alexaCommand } from "./alexa.js";
import { getAirQuality, getExchange, getCrypto, getHolidays, getISS, getWiki } from "./extras.js";

// Osiris Live-Lagekarte: selbst gehostet auf dem Mac (Port 3100). Der Mac-Agent öffnet lokal.
const OSIRIS_URL = "http://localhost:3100/?layers=flights,private,jets,military,maritime,transit,satellites,cctv,cctv_previews,live_news,earthquakes,fires,weather,infrastructure,global_incidents,alert_pins,day_night,cables,sdk_sea,sdk_air,sdk_naval,live_clouds,wind,rain,wind_controls,rain_controls,wind_particles,terrain_3d,terrain_elevation,malware,cyber_attacks,gdelt_events";

const MAC_ACTIONS = [
  "open_app", "quit_app", "open_url", "volume_set", "volume_up", "volume_down", "mute",
  "music_play_pause", "music_next", "music_previous", "say", "notify", "lock_screen",
  "sleep_display", "battery", "screenshot_look", "find_file", "dark_mode_toggle",
];

export const toolDefinitions = [
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
      properties: { fact: { type: "string", description: "Die Info in einem kurzen Satz" } },
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
    name: "smart_home",
    description: "Steuert Smart-Home-Geräte über Home Assistant. action=list zeigt Geräte; turn_on/turn_off/toggle brauchen entity_id (z. B. light.wohnzimmer).",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "turn_on", "turn_off", "toggle"] },
        entity_id: { type: "string" },
      },
      required: ["action"],
    },
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
    description: "Liest die zuletzt vom iPhone übermittelten Gesundheitsdaten (Schritte, Schlaf, Puls).",
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
    name: "webseite_bauen",
    description: "Webseiten-Werkstatt: baut aus einem Kundenauftrag eine komplette, verkaufsfertige Webseite (eine HTML-Datei) mit Angebotstext und Preisvorschlag, gespeichert in ~/Friday-Webseiten. aendern_id überarbeitet ein bestehendes Projekt. Dauert 1–2 Minuten; das Dashboard zeigt die Seite danach. Verkaufen und kassieren tut der Nutzer selbst.",
    input_schema: {
      type: "object",
      properties: { auftrag: { type: "string" }, aendern_id: { type: "string", description: "optional: id eines bestehenden Projekts" } },
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
    description: "Fridays 3D-Werkstatt: entwirft aus einem Wunsch (z. B. 'ein Porsche Taycan', 'ein Wohnhaus mit 12 Etagen', 'eine Gartenhütte') ein 3D-Hologramm, das im Dashboard Schritt für Schritt aufgebaut und erklärt wird. erweitern=true ergänzt das zuletzt gebaute Modell (z. B. 'mach eine Fußbodenheizung rein'). Die Werkstatt spricht die Schritte selbst; antworte danach nur mit einem kurzen Satz wie 'Sehr gern, Chef.'",
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
  {
    name: "send_push",
    description: "Schickt dem Nutzer eine Push-Nachricht aufs Handy.",
    input_schema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  },
];

// --- Wetter (Open-Meteo, kostenlos, kein Schlüssel nötig) ---
const WEATHER_CODES = {
  0: "klar", 1: "überwiegend klar", 2: "teilweise bewölkt", 3: "bedeckt", 45: "Nebel", 48: "Reifnebel",
  51: "leichter Niesel", 53: "Niesel", 55: "starker Niesel", 61: "leichter Regen", 63: "Regen", 65: "starker Regen",
  71: "leichter Schnee", 73: "Schnee", 75: "starker Schnee", 80: "Regenschauer", 81: "Regenschauer", 82: "heftige Schauer",
  95: "Gewitter", 96: "Gewitter mit Hagel", 99: "Gewitter mit Hagel",
};

export async function getWeather(city = config.city) {
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=${encodeURIComponent(city)}`).then((r) => r.json());
  const place = geo.results?.[0];
  if (!place) return { error: `Ort "${city}" nicht gefunden` };
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=3&timezone=auto`;
  const w = await fetch(url).then((r) => r.json());
  return {
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
      wetter: WEATHER_CODES[w.daily.weather_code[i]] ?? "unbekannt",
      max: w.daily.temperature_2m_max[i],
      min: w.daily.temperature_2m_min[i],
      regen_prozent: w.daily.precipitation_probability_max[i],
    })),
  };
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

// --- Home Assistant ---
async function homeAssistant(action, entityId) {
  if (!config.haUrl || !config.haToken) return { error: "Home Assistant ist nicht eingerichtet." };
  const headers = { Authorization: `Bearer ${config.haToken}`, "Content-Type": "application/json" };
  if (action === "list") {
    const states = await fetch(`${config.haUrl}/api/states`, { headers }).then((r) => r.json());
    return states
      .filter((s) => /^(light|switch|scene|cover|climate|fan|media_player)\./.test(s.entity_id))
      .slice(0, 80)
      .map((s) => ({ id: s.entity_id, name: s.attributes.friendly_name, status: s.state }));
  }
  if (!/^[a-z_]+\.[a-z0-9_]+$/.test(entityId || "")) return { error: "Ungültige entity_id" };
  const domain = entityId.startsWith("scene.") ? "scene" : "homeassistant";
  const service = entityId.startsWith("scene.") ? "turn_on" : action;
  const res = await fetch(`${config.haUrl}/api/services/${domain}/${service}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ entity_id: entityId }),
  });
  return res.ok ? { ok: true } : { error: `Home Assistant antwortet mit ${res.status}` };
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
  werkstatt: ["mac", (i) => `Werkstatt: ${i.wunsch || ""}`],
  webseite_bauen: ["mac", (i) => `Webseite: ${i.auftrag || ""}`],
  world_news: ["suche", (i) => `Nachrichten geprüft: ${i.country || i.topic || "Welt"}`],
  lookup: ["suche", (i) => `Nachgeschlagen: ${i.query || ""}`],
  country_info: ["suche", (i) => `Länder-Info: ${i.country || ""}`],
  air_quality: ["suche", (i) => `Luftqualität: ${i.city || ""}`],
  alexa: ["mac", (i) => `Alexa: ${i.action === "ansage" ? "Ansage" : i.action || ""}${i.action === "routine" && i.value ? " " + i.value : ""}`],
  fernseher: ["mac", (i) => `Fernseher: ${i.action || ""}${i.value ? " " + i.value : ""}`],
};

export async function runTool(name, input = {}) {
  if (ACTLOG[name]) { try { store.logActivity(ACTLOG[name][0], ACTLOG[name][1](input)); } catch { /* egal */ } }
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
      const r = await buildSite(input.auftrag, input.aendern_id || null);
      if (!r.ok) return { error: r.error };
      return { gebaut: r.titel, id: r.id, preisvorschlag_eur: r.preis_eur, projekte_gesamt: listSites().length, hinweis: "Das Dashboard zeigt die Seite gleich. Sag kurz, was du gebaut hast, und den Preisvorschlag." };
    }
    case "welt_alarm": {
      const d = await getAlarm();
      return { ereignisse: d.ereignisse.map((e) => ({ was: e.titel, name: e.name, laender: e.laender, stufe: e.stufe, wert: `${Math.round(e.wert * 10) / 10} ${e.einheit}`, menschen: e.menschen })), hinweis: "Das Lagezentrum zeigt und spricht das Briefing gerade selbst. Antworte nur kurz." };
    }
    case "werkstatt": {
      const basis = input.erweitern ? getLatestBuild()?.plan : null;
      const r = await planBuild(input.wunsch, basis);
      if (!r.ok) return { error: r.error };
      return { gebaut: r.plan.titel, schritte: r.plan.schritte.length, hinweis: "Die Werkstatt zeigt und erklärt das Modell gerade selbst. Antworte nur kurz." };
    }
    case "markt_radar": {
      if (input.action === "depot") return getDepot();
      const r = getForecast(input.asset || "gold");
      if (!r.data) return { status: r.status, hinweis: r.status === "fehler" ? r.error : "Kronos rechnet gerade (1–2 Minuten). Das Ergebnis erscheint im Markt-Radar." };
      const d = r.data;
      return { markt: d.name, status: r.status, kurs_jetzt: d.jetzt, stunden: d.stunden, verlaeufe_hoeher: `${d.hoeher} von ${d.anzahl}`, median: d.median, spanne: [d.p5, d.p95], modell_signal: r.signal, warnung: "Prognose, keine Gewissheit. Im Backtest lag das Modell oft daneben und neigte stark nach oben." };
    }
    case "video_schnitt": {
      if (input.action === "start") return startVideoJob({ look: input.look });
      if (input.action === "open_eingang") return openVideoDir("eingang");
      if (input.action === "open_fertig") return openVideoDir("fertig");
      const v = getVideoJob();
      if (!v.job) return { status: "frei", clips_im_eingang: v.clips.length, ordner: v.dirs.eingang };
      return { status: v.job.status, agenten: Object.fromEntries(Object.entries(v.job.agents).map(([k, a]) => [k, `${a.status}: ${a.text}`])), ergebnis: v.job.result?.name, fehler: v.job.error };
    }
    case "get_weather":
      return getWeather(input.city || config.city);
    case "remember":
      return store.addMemory(String(input.fact || ""));
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
    case "smart_home":
      return homeAssistant(input.action, input.entity_id);
    case "fernseher": {
      const r = await tvCommand(input);
      return r.ok ? r : { error: r.error };
    }
    case "alexa": {
      const r = await alexaCommand(input);
      return r.ok ? r : { error: r.error };
    }
    case "get_health":
      return store.getHealth() ?? { info: "Noch keine Gesundheitsdaten vom iPhone empfangen." };
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
      const url = APP_URLS[key];
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
    case "country_info": {
      const country = findCountry(input.country);
      if (!country) return { error: `Land "${input.country}" nicht gefunden.` };
      return getCountryInfo(country);
    }
    default:
      return { error: `Unbekanntes Werkzeug ${name}` };
  }
}
