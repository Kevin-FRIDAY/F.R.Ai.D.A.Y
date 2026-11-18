// Beschreibungen der Verbindungs-Werkzeuge für Claude. Bewusst ohne Importe (tools.js lädt sie sehr früh).
export const toolDefinitions = [
  {
    name: "anrufe",
    description:
      "Nachrichten und Anrufe an Kontakte, die der Nutzer selbst hinterlegt hat (seine Frau, er selbst, weitere). Aktionen: nachricht (an = 'frau', 'ich' oder Name; text = was ankommen soll, " +
      "in der Ich-Form des Nutzers, z. B. 'Ich will heute Lasagne essen.'), anruf (wie nachricht; je nach Einstellung echter Anruf, bei dem Friday den Text spricht, oder Nachricht + FaceTime), kontakte (wer hinterlegt ist). " +
      "Nur nutzen, wenn der Nutzer es ausdrücklich will ('ruf meine Frau an', 'schreib meiner Frau'). Fehlt der Inhalt, frag kurz nach, bevor du sendest.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["nachricht", "anruf", "kontakte"] },
        an: { type: "string" },
        text: { type: "string" },
      },
      required: ["action"],
    },
  },
  {
    name: "kalender",
    description:
      "Apple Kalender und Apple Erinnerungen auf dem Mac (iCloud). Aktionen: termine (value = Tage ab heute, 0 = heute, 1 = morgen; tage = Anzahl Tage, Standard 1), " +
      "neu (value = Titel, tag = JJJJ-MM-TT, uhrzeit = HH:MM, dauer = Minuten, ganztag, ort), erinnerungen (offene Apple-Erinnerungen), " +
      "erinnerung_neu (value = Text, optional tag/uhrzeit), erinnerung_erledigt (value = Text). Für 'Was steht an?', freie Zeiten und neue Termine.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["termine", "neu", "erinnerungen", "erinnerung_neu", "erinnerung_erledigt"] },
        value: { type: "string" },
        tage: { type: "number" },
        tag: { type: "string" },
        uhrzeit: { type: "string" },
        dauer: { type: "number" },
        ganztag: { type: "boolean" },
        ort: { type: "string" },
      },
      required: ["action"],
    },
  },
  {
    name: "spotify",
    description:
      "Steuert Spotify. Aktionen: spielen (value = Suchbegriff, art = auto|titel|playlist|kuenstler|album), pause, weiter, naechster, vorheriger, " +
      "lauter, leiser, lautstaerke (value = 0-100), zufall_an, zufall_aus, jetzt (was läuft gerade), playlists, geraete. Für Stimmungen ('entspannte Musik') art=playlist mit passendem Suchbegriff.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["spielen", "pause", "weiter", "naechster", "vorheriger", "lauter", "leiser", "lautstaerke", "zufall_an", "zufall_aus", "jetzt", "playlists", "geraete"] },
        value: { type: "string" },
        art: { type: "string", enum: ["auto", "titel", "playlist", "kuenstler", "album"] },
      },
      required: ["action"],
    },
  },
  {
    name: "hue",
    description:
      "Philips-Hue-Lampen. Aktionen: an, aus, helligkeit (wert = Prozent), heller, dunkler, farbe (wert = rot, orange, gelb, grün, blau, lila, pink, weiß, warmweiß ...), " +
      "neon (Neon-Orange), szene (value = Szenenname), raeume. wo = Raum oder Lampe (leer = alle).",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["an", "aus", "helligkeit", "heller", "dunkler", "farbe", "neon", "szene", "raeume"] },
        wo: { type: "string" },
        value: { type: "string" },
        wert: { type: "string" },
      },
      required: ["action"],
    },
  },
  {
    name: "todoist",
    description: "Todoist-Aufgaben. Aktionen: heute (heute fällig + überfällig), liste (alle offenen), neu (value = Aufgabe, wann = Fälligkeit in Worten wie 'morgen 10 Uhr'), erledigt (value = Aufgabe).",
    input_schema: {
      type: "object",
      properties: { action: { type: "string", enum: ["heute", "liste", "neu", "erledigt"] }, value: { type: "string" }, wann: { type: "string" } },
      required: ["action"],
    },
  },
  {
    name: "notion",
    description: "Notion. Aktionen: notiz (value = Text, wird auf die Notizen-Seite geschrieben), letzte (letzte Notizen), suchen (value = Suchbegriff in freigegebenen Seiten).",
    input_schema: {
      type: "object",
      properties: { action: { type: "string", enum: ["notiz", "letzte", "suchen"] }, value: { type: "string" } },
      required: ["action"],
    },
  },
];

// smart_home (Home Assistant) bleibt unter seinem alten Namen, damit Protokolle weiter funktionieren.
export const smartHomeTool = {
  name: "smart_home",
  description:
    "Steuert Geräte über Home Assistant. Aktionen: liste, an, aus, umschalten (value = Gerätename oder entity_id wie light.wohnzimmer), " +
    "helligkeit (value = Licht, wert = Prozent), temperatur (value = Heizung/Raum, wert = Grad), wert (value = Raum/Sensor, liest Temperatur).",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["liste", "an", "aus", "umschalten", "helligkeit", "temperatur", "wert", "list", "turn_on", "turn_off", "toggle"] },
      value: { type: "string" },
      entity_id: { type: "string" },
      wert: { type: "number" },
    },
    required: ["action"],
  },
};

