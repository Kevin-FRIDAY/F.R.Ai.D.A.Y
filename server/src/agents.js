// Fridays Agenten-Team: eine "Armee" spezialisierter Agenten.
// Jeder Agent deckt ein Gebiet ab, hat Beispiel-Aufgaben und einen Status
// (aktiv / braucht Mac / braucht Einrichtung), der aus der .env berechnet wird.
import { config } from "./config.js";
import { isAgentOnline } from "./agent-hub.js";
import { videoTeamReady } from "./videoteam.js";
import { marktReady } from "./markt.js";
import { alexaConfigured } from "./alexa.js";
import { tvPaired } from "./fernseher.js";
import { kalenderBereit } from "./kalender.js";
import { spotifyVerbunden } from "./spotify.js";
import { haBereit } from "./homeassistant.js";
import { hueBereit } from "./hue.js";
import { todoistBereit } from "./todoist.js";
import { notionBereit } from "./notion.js";
import { laufendeAuftraege, werkzeugName } from "./auftrag.js";
import { letzte as letzteLogbuch, BEREICHE, tagVon } from "./logbuch.js";
import { EINSAETZE, einsatzLaeuft, letzterBericht, einsetzen, teamEinsatz, TEAM } from "./agenten-einsatz.js";

// need beschreibt, was ein Agent braucht:
//  {type:"frei"}                      -> immer einsatzbereit (kostenlose Quelle)
//  {type:"key", key, label}           -> aktiv, sobald der Schlüssel in der .env steht
//  {type:"mac"}                       -> braucht den verbundenen Mac
//  {type:"setup", label}              -> Anbindung noch nicht eingebaut (Schlüssel/Login nötig)
export const AGENTS = [
  // --- Organisation ---
  { id: "mail", name: "Mail-Agent", emoji: "📧", cat: "Organisation", purpose: "Liest und fasst E-Mails zusammen, schreibt Entwürfe.", examples: ["Lies mir meine neuen Mails vor", "Fass die letzte Mail zusammen"], need: { type: "key", key: "icloudMail", label: "iCloud-Mail" } },
  { id: "dateien", name: "Datei-Agent", emoji: "📁", cat: "Organisation", purpose: "Findet und verwaltet Dateien und Dokumente.", examples: ["Such die Rechnung von gestern", "Öffne mein Konzept"], need: { type: "setup", label: "Google Drive" } },
  { id: "kalender", name: "Kalender-Agent", emoji: "📅", cat: "Organisation", purpose: "Apple Kalender und Erinnerungen: Termine, freie Zeiten, neue Einträge.", examples: ["Was steht morgen an?", "Wann bin ich morgen frei?", "Trag Zahnarzt am Freitag um 10 ein"], need: { type: "check", ok: () => kalenderBereit(), label: "verbundenen Mac (Apple Kalender)" } },
  { id: "aufgaben", name: "Aufgaben-Agent", emoji: "✅", cat: "Organisation", purpose: "Aufgaben in Todoist: eintragen, vorlesen, abhaken.", examples: ["Füg Steuererklärung bis Freitag zu Todoist hinzu", "Was steht heute in Todoist?"], need: { type: "check", ok: () => todoistBereit(), label: "Todoist (Werkzeug-Menü → Verbindungen)" } },
  { id: "wissen", name: "Wissens-Agent", emoji: "🧠", cat: "Organisation", purpose: "Notizen und Wissen in Notion.", examples: ["Notiz: Idee für das neue HUD", "Such in Notion nach Projekt X", "Lies meine letzten Notizen"], need: { type: "check", ok: () => notionBereit(), label: "Notion (Werkzeug-Menü → Verbindungen)" } },

  // --- Stimme & Medien ---
  { id: "stimme", name: "Stimm-Agent", emoji: "🗣️", cat: "Stimme & Medien", purpose: "Friday spricht mit der Apple-Stimme deines Geräts (Einstellungen → Stimme).", examples: ["Lies mir das vor", "Sprich langsamer"], need: { type: "frei" } },
  { id: "musik", name: "Musik-Agent", emoji: "🎵", cat: "Stimme & Medien", purpose: "Spotify: Playlists, Songs, Künstler, Pause, Lautstärke.", examples: ["Spiel meine Playlist Workout", "Spiel Musik von Adele", "Was läuft gerade?"], need: { type: "check", ok: () => spotifyVerbunden(), label: "Spotify (Werkzeug-Menü → Verbindungen)" } },

  // --- Lagezentrum ---
  { id: "lage", name: "Lage-Agent", emoji: "🌍", cat: "Lagezentrum", purpose: "Weltlage und aktuelle Nachrichten im Weltgeschehen.", examples: ["Was ist auf der Welt los?", "Welt-Alarm", "Was ist in der Ukraine los?"], need: { type: "frei" } },
  { id: "wetter", name: "Wetter-Agent", emoji: "⛅", cat: "Lagezentrum", purpose: "Wetter und Unwetterwarnungen.", examples: ["Wie wird das Wetter morgen?", "Brauche ich einen Schirm?"], need: { type: "frei" } },
  { id: "karten", name: "Karten-Agent", emoji: "🗺️", cat: "Lagezentrum", purpose: "Orte, Routen und Karten: Auto, Rad, zu Fuß und Bahn/Bus (OpenStreetMap).", examples: ["Wie weit ist es nach München?", "Route nach Hamburg mit dem Rad"], need: { type: "frei" } },
  { id: "krypto", name: "Krypto-Agent", emoji: "🪙", cat: "Lagezentrum", purpose: "Krypto-Kurse und Charts – nur Daten, kein Handel.", examples: ["Was kostet Bitcoin?", "Wie steht Ethereum heute?"], need: { type: "frei" } },
  { id: "markt", name: "Markt-Radar", emoji: "📈", cat: "Lagezentrum", purpose: "100 mögliche Kursverläufe mit Kronos, Papierdepot mit Spielgeld – keine echten Orders.", examples: ["Friday, wie sieht Gold aus?", "Wie läuft mein Papierdepot?"], need: { type: "check", ok: () => marktReady(), label: "Kronos" } },
  { id: "erdbeben", name: "Erdbeben-Wächter", emoji: "🌋", cat: "Lagezentrum", purpose: "Prüft die Erdbeben der letzten 24 Stunden weltweit und in deiner Nähe (USGS).", examples: ["Schick den Erdbeben-Agenten los", "Gab es Erdbeben in der Nähe?"], need: { type: "frei" } },
  { id: "weltraum", name: "Weltraum-Agent", emoji: "🚀", cat: "Lagezentrum", purpose: "Nächste Raketenstarts, Sonnenstürme und Polarlicht-Chancen.", examples: ["Schick den Weltraum-Agenten los", "Wann startet die nächste Rakete?"], need: { type: "frei" } },
  { id: "weltdaten", name: "Welt-Daten-Agent", emoji: "🛰️", cat: "Lagezentrum", purpose: "Flüge, Schiffe, ISS, Webcams und Ereignisse.", examples: ["Wo ist die ISS gerade?", "Welche Flüge sind über mir?"], need: { type: "frei" } },

  // --- Recherche (v1.165.0) ---
  { id: "recherche", name: "Recherche-Agent", emoji: "🔎", cat: "Recherche", purpose: "Recherchiert ein Thema in der Wikipedia und legt ein Dossier unter Dokumente ab.", examples: ["Recherchiere Kernfusion", "Mach mir ein Dossier über Mars"], need: { type: "frei" } },
  { id: "nachrichten", name: "Nachrichten-Agent", emoji: "📰", cat: "Recherche", purpose: "Holt die wichtigsten Meldungen der Tagesschau und liest sie vor.", examples: ["Schick den Nachrichten-Agenten los", "Was sind die Top-Meldungen?"], need: { type: "frei" } },
  { id: "uebersetzer", name: "Übersetzer", emoji: "🈯", cat: "Recherche", purpose: "Übersetzt Sätze in über 15 Sprachen (MyMemory).", examples: ["Englisch: Wo ist der Bahnhof?", "Türkisch: Guten Appetit"], need: { type: "frei" } },

  // --- Alltag & Umwelt (v1.165.0) ---
  { id: "strom", name: "Strompreis-Agent", emoji: "⚡", cat: "Alltag & Umwelt", purpose: "Findet die günstigsten Strom-Stunden an der Börse – fürs Waschen, Trocknen oder Auto-Laden.", examples: ["Schick den Strompreis-Agenten los", "Wann ist Strom heute billig?"], need: { type: "frei" } },
  { id: "pollen", name: "Pollen-Agent", emoji: "🌾", cat: "Alltag & Umwelt", purpose: "Pollenflug für dein Bundesland vom Deutschen Wetterdienst.", examples: ["Schick den Pollen-Agenten los", "Wie ist der Pollenflug?"], need: { type: "frei" } },
  { id: "pegel", name: "Pegel-Agent", emoji: "🌊", cat: "Alltag & Umwelt", purpose: "Wasserstände der Flüsse in deiner Nähe (Pegelonline).", examples: ["Schick den Pegel-Agenten los", "Wie hoch steht der Rhein in Köln?"], need: { type: "frei" } },
  { id: "verkehr", name: "Verkehrs-Agent", emoji: "🚗", cat: "Alltag & Umwelt", purpose: "Staus, Sperrungen und Baustellen auf jeder Autobahn (Autobahn GmbH).", examples: ["Ist Stau auf der A7?", "Verkehrs-Agent A100"], need: { type: "frei" } },
  { id: "feiertage", name: "Ferien-Agent", emoji: "🏖️", cat: "Alltag & Umwelt", purpose: "Nächste Feiertage und Schulferien in deinem Bundesland.", examples: ["Schick den Ferien-Agenten los", "Wann sind die nächsten Ferien?"], need: { type: "frei" } },
  { id: "koch", name: "Koch-Agent", emoji: "👨‍🍳", cat: "Alltag & Umwelt", purpose: "Schlägt Rezepte vor, die verwerten, was im Kühlschrank bald abläuft.", examples: ["Schick den Koch-Agenten los", "Was koche ich heute?"], need: { type: "frei" } },

  // --- Kreativ ---
  { id: "video", name: "Video-Team", emoji: "🎬", cat: "Kreativ", purpose: "Schneidet Clips lokal zu einem 9:16-Video: Regie, Transkript, Schnitt, Farbe, Untertitel, Audio.", examples: ["Friday, schneide das Video", "Schneide das Video im Kino-Look"], need: { type: "check", ok: () => videoTeamReady(), label: "Python-Umgebung" } },
  { id: "webseiten", name: "Webseiten-Agent", emoji: "🌐", cat: "Kreativ", purpose: "Baut verkaufsfertige Webseiten mit Angebot und Preisvorschlag – du verkaufst sie.", examples: ["Bau eine Webseite für einen Friseur in Berlin", "Mach die Farben der letzten Seite wärmer"], need: { type: "key", key: "anthropicKey", label: "Claude-Schlüssel" } },
  { id: "design", name: "Design-Agent", emoji: "🎨", cat: "Kreativ", purpose: "Skizzen, Grundrisse und Oberflächen-Design (HUD).", examples: ["Entwirf ein neues HUD", "Skizzier den Grundriss"], need: { type: "setup", label: "Figma" } },
  { id: "dreid", name: "3D-Werkstatt", emoji: "🧊", cat: "Kreativ", purpose: "Entwirft 3D-Hologramme Schritt für Schritt: Autos, Häuser, Geräte – mit echten Maßen.", examples: ["Bau mir einen Porsche Taycan", "Ein Wohnhaus mit 12 Etagen"], need: { type: "key", key: "anthropicKey", label: "Claude-Schlüssel" } },

  // --- Entwicklung & Steuerung ---
  { id: "code", name: "Code-Agent", emoji: "💻", cat: "Entwicklung & Steuerung", purpose: "Sichert und erweitert Fridays Code (GitHub).", examples: ["Gibt es ein Update?", "Was wurde zuletzt geändert?"], need: { type: "frei" } },
  { id: "smarthome", name: "SmartHome-Agent", emoji: "🏠", cat: "Entwicklung & Steuerung", purpose: "Licht, Steckdosen, Heizung, Rollos und Sensoren über Home Assistant.", examples: ["Schalte die Kaffeemaschine an", "Heizung im Bad auf 22 Grad", "Wie warm ist es im Wohnzimmer?"], need: { type: "check", ok: () => haBereit(), label: "Home Assistant (Werkzeug-Menü → Verbindungen)" } },
  { id: "licht", name: "Licht-Agent", emoji: "💡", cat: "Entwicklung & Steuerung", purpose: "Philips-Hue-Lampen – und Neon-Orange, wenn Friday spricht.", examples: ["Licht im Wohnzimmer an", "Licht auf 30 Prozent", "Neon-Modus"], need: { type: "check", ok: () => hueBereit(), label: "Philips Hue (Werkzeug-Menü → Verbindungen)" } },
  { id: "fernseher", name: "Fernseher-Agent", emoji: "📺", cat: "Entwicklung & Steuerung", purpose: "Steuert deinen Samsung-Fernseher im WLAN: an/aus, Lautstärke, Sender, Apps wie Netflix und YouTube.", examples: ["Friday, mach Netflix an", "Fernseher leiser", "Fernseher aus"], need: { type: "check", ok: () => tvPaired(), label: "Fernseher koppeln (Werkzeug-Menü → Fernbedienung)" } },
  { id: "alexa", name: "Alexa-Agent", emoji: "🔵", cat: "Entwicklung & Steuerung", purpose: "Startet deine Alexa-Routinen und lässt Alexa etwas ansagen – damit steuert Friday alles, was an Alexa hängt.", examples: ["Friday, Alexa Licht an", "Alexa, sag Essen ist fertig", "Alexa Gute Nacht"], need: { type: "check", ok: () => alexaConfigured(), label: "Voice-Monkey-Schlüssel (Werkzeug-Menü → Alexa)" } },
  { id: "mac", name: "Mac-Agent", emoji: "🖥️", cat: "Entwicklung & Steuerung", purpose: "Steuert deinen Mac (Apps öffnen, suchen, Screenshot).", examples: ["Öffne YouTube", "Mach einen Screenshot"], need: { type: "mac" } },
  { id: "system", name: "System-Agent", emoji: "🛡️", cat: "Entwicklung & Steuerung", purpose: "System-Check, Sicherungen und Updates.", examples: ["Mach einen System-Check", "Sicher dich jetzt"], need: { type: "frei" } },
];

export const CATEGORIES = ["Organisation", "Stimme & Medien", "Lagezentrum", "Recherche", "Alltag & Umwelt", "Kreativ", "Entwicklung & Steuerung"];

// Woran man erkennt, dass ein Agent gerade arbeitet oder zuletzt gearbeitet hat:
// b = Logbuch-Bereiche, w = Claude-Werkzeuge / Schnellbefehl-Aktionen (Teil vor ":").
const ARBEIT = {
  mail: { b: ["mail"], w: ["check_mail", "sort_mail", "mail"] },
  dateien: { b: ["archiv", "dokument"], w: ["dokumente_suchen", "dokwissen", "archiv", "dokument_erstellen", "fragebogen_erstellen"] },
  kalender: { b: ["kalender", "erinnerung"], w: ["kalender", "set_reminder", "list_reminders"] },
  aufgaben: { b: ["aufgabe", "einkauf"], w: ["add_task", "list_tasks", "todoist", "add_shopping"] },
  wissen: { b: ["gedaechtnis"], w: ["remember", "forget", "notion", "lookup"] },
  stimme: { b: [], w: ["stimme"] },
  musik: { b: ["musik", "klang"], w: ["spotify", "apple_musik", "klang"] },
  lage: { b: ["welt", "briefing"], w: ["world_news", "welt_alarm", "weltgeschehen", "land_info", "country_info", "briefing"] },
  wetter: { b: [], w: ["get_weather", "air_quality"] },
  karten: { b: ["route"], w: ["routen", "route_planen"] },
  krypto: { b: [], w: ["crypto", "currency"] },
  markt: { b: ["markt"], w: ["markt_radar", "markt_plus"] },
  weltdaten: { b: [], w: ["iss", "flugzeuge", "schiffe"] },
  video: { b: ["video"], w: ["video_schnitt", "video_erstellen"] },
  webseiten: { b: ["webseite"], w: ["webseite_bauen"] },
  design: { b: [], w: [] },
  dreid: { b: ["werkstatt", "haus"], w: ["werkstatt", "haus"] },
  code: { b: ["update"], w: ["update"] },
  smarthome: { b: [], w: ["smart_home", "homeassistant", "run_protocol", "list_protocols"] },
  licht: { b: [], w: ["hue"] },
  fernseher: { b: ["tv"], w: ["fernseher"] },
  alexa: { b: ["alexa"], w: ["alexa"] },
  mac: { b: ["mac"], w: ["mac", "open_app"] },
  system: { b: ["system", "sicherung"], w: ["system_check", "logbuch", "glocke"] },
};
const wzName = (a) => String(a || "").split(":")[0];
function passtZu(agentId, eintrag) {
  const r = ARBEIT[agentId];
  if ((eintrag.aktionen || []).includes(`agent_${agentId}`)) return true;
  if (!r) return false;
  if (r.b.includes(eintrag.bereich)) return true;
  return (eintrag.aktionen || []).some((a) => r.w.includes(wzName(a)));
}

// Was jeder Agent gerade tut (live aus laufenden Aufträgen) und zuletzt getan hat (aus dem Logbuch).
function taetigkeiten(ids) {
  const out = Object.fromEntries(ids.map((id) => [id, { arbeitet: false, jetzt: "", zuletzt: null, heute: 0 }]));
  let laufend = [];
  try { laufend = laufendeAuftraege(); } catch { /* egal */ }
  for (const a of laufend) {
    for (const w of a.werkzeuge || []) {
      for (const id of ids) {
        if (ARBEIT[id]?.w.includes(wzName(w)) && !out[id].arbeitet) {
          out[id].arbeitet = true;
          out[id].jetzt = `${werkzeugName(wzName(w)).replace(/^./, (c) => c.toUpperCase())} …`;
        }
      }
    }
  }
  // Direkt losgeschickte Agenten (Einsatz-Knopf, Sprachbefehl, Team-Lagebericht)
  for (const [id, e] of einsatzLaeuft()) {
    if (out[id]) { out[id].arbeitet = true; out[id].jetzt = e.text; }
  }
  let eintraege = [];
  try { eintraege = letzteLogbuch({ anzahlMonate: 2, limit: 4000 }); } catch { /* kein Logbuch */ }
  const heuteTag = tagVon();
  for (const e of eintraege) {
    for (const id of ids) {
      if (!passtZu(id, e)) continue;
      const t = out[id];
      if (!t.zuletzt) t.zuletzt = { titel: e.titel, at: e.at, ok: e.ok !== false, bereich: BEREICHE[e.bereich]?.[1] || "" };
      if (e.tag === heuteTag) t.heute += 1;
    }
  }
  return { out, laufend };
}

// Kann der Agent direkt losgeschickt werden? Mit letztem Bericht.
function einsatzInfo(id) {
  const e = EINSAETZE[id];
  if (!e) return {};
  const b = letzterBericht(id);
  return { einsatz: { knopf: e.knopf, eingabe: e.eingabe || null, pflicht: Boolean(e.pflicht) }, bericht: b ? { titel: b.titel, text: b.text, punkte: b.punkte, quelle: b.quelle, link: b.link, at: b.at, ok: b.ok } : null };
}

// Status eines Agenten anhand von .env + Mac-Verbindung.
function statusOf(agent, macOnline) {
  const n = agent.need;
  if (n.type === "frei") return { status: "aktiv", hint: "Einsatzbereit" };
  if (n.type === "key") return config[n.key] ? { status: "aktiv", hint: "Einsatzbereit" } : { status: "setup", hint: `Braucht ${n.label}` };
  if (n.type === "check") return n.ok() ? { status: "aktiv", hint: "Einsatzbereit" } : { status: "setup", hint: `Braucht ${n.label}` };
  if (n.type === "mac") return macOnline ? { status: "aktiv", hint: "Mac verbunden" } : { status: "mac", hint: "Braucht verbundenen Mac" };
  return { status: "setup", hint: `Braucht ${n.label}` };
}

export function agentsWithStatus() {
  const macOnline = isAgentOnline();
  let { out: tun, laufend } = taetigkeiten(AGENTS.map((a) => a.id));
  const list = AGENTS.map((a) => ({ id: a.id, name: a.name, emoji: a.emoji, cat: a.cat, purpose: a.purpose, examples: a.examples, ...statusOf(a, macOnline), ...tun[a.id], ...einsatzInfo(a.id) }));
  const aktiv = list.filter((a) => a.status === "aktiv").length;
  const arbeiten = list.filter((a) => a.arbeitet).length;
  laufend = laufend.filter((a) => !String(a.kanal || "").startsWith("agent:"));
  const chefin = laufend.length
    ? { arbeitet: true, jetzt: laufend[0].text || "Friday arbeitet an einem Auftrag …", prozent: laufend[0].prozent || 0, kanal: laufend[0].kanal }
    : { arbeitet: false, jetzt: arbeiten ? `Leitet ${arbeiten} Agenten` : "Leitet das Team – wartet auf deinen Auftrag", prozent: 0 };
  return { categories: CATEGORIES, agents: list, gesamt: list.length, aktiv, arbeiten, chefin };
}

// Kurzer Überblick fürs Gehirn (damit Friday ihr Team kennt).
export function agentsBrief() {
  const { agents, gesamt, aktiv } = agentsWithStatus();
  const byCat = CATEGORIES.map((c) => {
    const names = agents.filter((a) => a.cat === c).map((a) => `${a.name}${a.status === "aktiv" ? "" : " (noch nicht aktiv)"}`).join(", ");
    return `${c}: ${names}`;
  }).join("\n");
  return `Dein Team hat ${gesamt} Agenten (${aktiv} aktiv):\n${byCat}`;
}

// Einen Agenten (oder mit "team" den Team-Lagebericht) losschicken – für Dashboard, Werkzeug und Sprachbefehl.
export async function agentLosschicken(id, eingabe = "", kanal = "dashboard") {
  const namen = Object.fromEntries(AGENTS.map((a) => [a.id, a.name]));
  if (id === "team") return teamEinsatz({ namen, kanal });
  const a = AGENTS.find((x) => x.id === id);
  if (!a || !EINSAETZE[id]) return { agent: id, ok: false, titel: "Kein Einsatz", text: a ? `${a.name} arbeitet nur auf Zuruf über Friday, nicht per Einsatz-Knopf.` : `Den Agenten „${id}“ gibt es nicht.`, punkte: [] };
  if (EINSAETZE[id].pflicht && !String(eingabe || "").trim()) return { agent: id, ok: false, titel: a.name, text: `${a.name} braucht noch eine Angabe: ${EINSAETZE[id].eingabe?.label || "Eingabe"}.`, punkte: [] };
  return einsetzen(id, eingabe, { name: a.name, kanal });
}
export const TEAM_IDS = TEAM;
