// Fridays Werkzeuge: alles, was sie außer Reden noch kann.
import fs from "node:fs";
import path from "node:path";
import { config, ROOT } from "./config.js";
import * as store from "./store.js";
import { sendToAgent, isAgentOnline } from "./agent-hub.js";
import { sendPush } from "./notify.js";
import { checkForUpdate, startUpdate } from "./updater.js";
import { COUNTRIES, findCountry, getCountryNews, getOverview } from "./lagezentrum.js";

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
export async function runTool(name, input = {}) {
  switch (name) {
    case "world_news": {
      if (!input.country) {
        const list = await getOverview();
        return list.sort((a, b) => b.meldungen - a.meldungen).slice(0, 8).map((c) => ({ land: c.name, meldungen: c.meldungen, top: c.top }));
      }
      const country = findCountry(input.country);
      if (!country) return { error: `Das Land ist nicht im Lagezentrum. Verfügbar: ${COUNTRIES.map((c) => c.name).join(", ")}. Nutze sonst die Websuche.` };
      const news = await getCountryNews(country);
      return { land: country.name, schlagzeilen: news.items.slice(0, 12).map((n) => `${n.title} (${n.source})`) };
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
    case "get_health":
      return store.getHealth() ?? { info: "Noch keine Gesundheitsdaten vom iPhone empfangen." };
    case "update":
      return input.action === "install" ? startUpdate() : checkForUpdate();
    case "send_push":
      return { gesendet: await sendPush("F.R.Ai.D.A.Y", String(input.message || "")) };
    default:
      return { error: `Unbekanntes Werkzeug ${name}` };
  }
}
