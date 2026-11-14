// Fridays Agenten-Team: eine "Armee" spezialisierter Agenten.
// Jeder Agent deckt ein Gebiet ab, hat Beispiel-Aufgaben und einen Status
// (aktiv / braucht Mac / braucht Einrichtung), der aus der .env berechnet wird.
import { config } from "./config.js";
import { isAgentOnline } from "./agent-hub.js";
import { videoTeamReady } from "./videoteam.js";
import { marktReady } from "./markt.js";

// need beschreibt, was ein Agent braucht:
//  {type:"frei"}                      -> immer einsatzbereit (kostenlose Quelle)
//  {type:"key", key, label}           -> aktiv, sobald der Schlüssel in der .env steht
//  {type:"mac"}                       -> braucht den verbundenen Mac
//  {type:"setup", label}              -> Anbindung noch nicht eingebaut (Schlüssel/Login nötig)
export const AGENTS = [
  // --- Organisation ---
  { id: "mail", name: "Mail-Agent", emoji: "📧", cat: "Organisation", purpose: "Liest und fasst E-Mails zusammen, schreibt Entwürfe.", examples: ["Lies mir meine neuen Mails vor", "Fass die letzte Mail zusammen"], need: { type: "key", key: "icloudMail", label: "iCloud-Mail" } },
  { id: "dateien", name: "Datei-Agent", emoji: "📁", cat: "Organisation", purpose: "Findet und verwaltet Dateien und Dokumente.", examples: ["Such die Rechnung von gestern", "Öffne mein Konzept"], need: { type: "setup", label: "Google Drive" } },
  { id: "kalender", name: "Kalender-Agent", emoji: "📅", cat: "Organisation", purpose: "Termine, Erinnerungen und freie Zeiten.", examples: ["Wann bin ich morgen frei?", "Trag Zahnarzt am Freitag ein"], need: { type: "setup", label: "Google Kalender" } },
  { id: "aufgaben", name: "Aufgaben-Agent", emoji: "✅", cat: "Organisation", purpose: "Aufgaben und Einkaufslisten.", examples: ["Setz Milch auf die Einkaufsliste", "Was steht heute an?"], need: { type: "setup", label: "Todoist" } },
  { id: "wissen", name: "Wissens-Agent", emoji: "🧠", cat: "Organisation", purpose: "Notizen, Projekte und Wissen – Fridays Gedächtnis.", examples: ["Merk dir das Projekt-Passwort", "Was weißt du über Projekt X?"], need: { type: "setup", label: "Notion" } },

  // --- Stimme & Medien ---
  { id: "stimme", name: "Stimm-Agent", emoji: "🗣️", cat: "Stimme & Medien", purpose: "Gibt Friday ihre Stimme (ElevenLabs).", examples: ["Lies das vor", "Sprich natürlicher"], need: { type: "key", key: "elevenKey", label: "ElevenLabs" } },
  { id: "musik", name: "Musik-Agent", emoji: "🎵", cat: "Stimme & Medien", purpose: "Musik, Playlists, 'was läuft gerade'.", examples: ["Spiel entspannte Musik", "Was läuft gerade?"], need: { type: "setup", label: "Spotify" } },

  // --- Lagezentrum ---
  { id: "lage", name: "Lage-Agent", emoji: "🌍", cat: "Lagezentrum", purpose: "Weltlage und aktuelle Nachrichten im Weltgeschehen.", examples: ["Was ist in der Ukraine los?", "Zeig die Weltlage"], need: { type: "frei" } },
  { id: "wetter", name: "Wetter-Agent", emoji: "⛅", cat: "Lagezentrum", purpose: "Wetter und Unwetterwarnungen.", examples: ["Wie wird das Wetter morgen?", "Brauche ich einen Schirm?"], need: { type: "frei" } },
  { id: "karten", name: "Karten-Agent", emoji: "🗺️", cat: "Lagezentrum", purpose: "Orte, Routen und Karten.", examples: ["Wie weit ist es nach München?", "Zeig mir die Route"], need: { type: "setup", label: "Mapbox" } },
  { id: "krypto", name: "Krypto-Agent", emoji: "🪙", cat: "Lagezentrum", purpose: "Krypto-Kurse und Charts – nur Daten, kein Handel.", examples: ["Was kostet Bitcoin?", "Wie steht Ethereum heute?"], need: { type: "frei" } },
  { id: "markt", name: "Markt-Radar", emoji: "📈", cat: "Lagezentrum", purpose: "100 mögliche Kursverläufe mit Kronos, Papierdepot mit Spielgeld – keine echten Orders.", examples: ["Friday, wie sieht Gold aus?", "Wie läuft mein Papierdepot?"], need: { type: "check", ok: () => marktReady(), label: "Kronos" } },
  { id: "weltdaten", name: "Welt-Daten-Agent", emoji: "🛰️", cat: "Lagezentrum", purpose: "Flüge, Schiffe, ISS, Webcams und Ereignisse.", examples: ["Wo ist die ISS gerade?", "Welche Flüge sind über mir?"], need: { type: "frei" } },

  // --- Kreativ ---
  { id: "video", name: "Video-Team", emoji: "🎬", cat: "Kreativ", purpose: "Schneidet Clips lokal zu einem 9:16-Video: Regie, Transkript, Schnitt, Farbe, Untertitel, Audio.", examples: ["Friday, schneide das Video", "Schneide das Video im Kino-Look"], need: { type: "check", ok: () => videoTeamReady(), label: "Python-Umgebung" } },
  { id: "webseiten", name: "Webseiten-Agent", emoji: "🌐", cat: "Kreativ", purpose: "Baut verkaufsfertige Webseiten mit Angebot und Preisvorschlag – du verkaufst sie.", examples: ["Bau eine Webseite für einen Friseur in Berlin", "Mach die Farben der letzten Seite wärmer"], need: { type: "key", key: "anthropicKey", label: "Claude-Schlüssel" } },
  { id: "design", name: "Design-Agent", emoji: "🎨", cat: "Kreativ", purpose: "Skizzen, Grundrisse und Oberflächen-Design (HUD).", examples: ["Entwirf ein neues HUD", "Skizzier den Grundriss"], need: { type: "setup", label: "Figma" } },
  { id: "dreid", name: "3D-Agent", emoji: "🧊", cat: "Kreativ", purpose: "3D-Modelle lokal in Blender (per Python).", examples: ["Bau ein 3D-Modell von einem Würfel", "Rendere die Szene"], need: { type: "mac" } },

  // --- Entwicklung & Steuerung ---
  { id: "code", name: "Code-Agent", emoji: "💻", cat: "Entwicklung & Steuerung", purpose: "Sichert und erweitert Fridays Code (GitHub).", examples: ["Gibt es ein Update?", "Was wurde zuletzt geändert?"], need: { type: "frei" } },
  { id: "smarthome", name: "SmartHome-Agent", emoji: "🏠", cat: "Entwicklung & Steuerung", purpose: "Licht und Geräte über Home Assistant.", examples: ["Mach das Licht an", "Schalt alles aus"], need: { type: "key", key: "haToken", label: "Home Assistant" } },
  { id: "mac", name: "Mac-Agent", emoji: "🖥️", cat: "Entwicklung & Steuerung", purpose: "Steuert deinen Mac (Apps öffnen, suchen, Screenshot).", examples: ["Öffne YouTube", "Mach einen Screenshot"], need: { type: "mac" } },
  { id: "system", name: "System-Agent", emoji: "🛡️", cat: "Entwicklung & Steuerung", purpose: "System-Check, Sicherungen und Updates.", examples: ["Mach einen System-Check", "Sicher dich jetzt"], need: { type: "frei" } },
];

export const CATEGORIES = ["Organisation", "Stimme & Medien", "Lagezentrum", "Kreativ", "Entwicklung & Steuerung"];

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
  const list = AGENTS.map((a) => ({ id: a.id, name: a.name, emoji: a.emoji, cat: a.cat, purpose: a.purpose, examples: a.examples, ...statusOf(a, macOnline) }));
  const aktiv = list.filter((a) => a.status === "aktiv").length;
  return { categories: CATEGORIES, agents: list, gesamt: list.length, aktiv };
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
