# Fridays Logbuch (ab 1.96.0)

Friday schreibt jetzt **alles** mit, was sie tut – mit Datum und Uhrzeit:

- **Befehle:** was du gesagt oder getippt hast (Dashboard, iPhone, Telegram, Siri) und was Friday geantwortet hat, ob mit oder ohne Claude, und wie lange es gedauert hat
- **Anrufe & Nachrichten:** an wen, was, auf welchem Weg (iMessage, FaceTime, Twilio) – und ob es geklappt hat
- **Haus-Werkstatt & 3D-Werkstatt:** welches Haus oder Modell gebaut wurde, mit Eckdaten
- **Aufgaben & Einkauf:** erstellt, erledigt, gelöscht
- **Erinnerungen:** gesetzt und ausgelöst
- **Fernseher, Alexa, Licht, Musik, Mac**
- **Claude-Werkzeuge:** jedes Werkzeug, das Friday benutzt hat (Wetter, Suche, Dokumente …)
- **System:** Start/Neustart, Updates (auch automatische), Sicherungen, Videoschnitt, Energie, Verbindungen

Was **nicht** geklappt hat, ist rot markiert.

## Öffnen

- Werkzeug-Menü → **Logbuch (alles, was Friday tut)**
- Per Sprache: **„Friday, öffne das Logbuch“** oder **„Zeig mir das Tätigkeitsprotokoll“**
- Kurz zusammengefasst vorlesen lassen: **„Was hast du heute gemacht?“** oder **„Was hast du gestern gemacht?“**

## Bedienen

- **‹ ›** blättert Tag für Tag, ein Tipp aufs Datum öffnet den Kalender, **Heute** springt zurück
- Die kleinen Balken zeigen die letzten Tage – antippen springt zum Tag
- **Filter** nach Bereich (Anrufe, Haus, Aufgaben …), **Suche** nach Wörtern
- Kachel **⚠ Fehler** zeigt nur, was schiefging
- Eintrag antippen zeigt alle Details
- **⬇ CSV** speichert den Tag als Tabelle (öffnet sich in Numbers oder Excel)
- Solange „Heute“ offen ist, kommen neue Einträge von selbst dazu (Live)

## Wo liegt das?

Auf deinem Mac in `~/Friday/server/data/logbuch/` – eine Datei pro Monat (z. B. `2026-11.jsonl`).
Updates fassen diesen Ordner nie an, und die Sicherungen nehmen ihn mit.

> Nicht verwechseln: **Protokolle** sind in Friday deine Automations-Abläufe („starte Protokoll Feierabend“).
> Das **Logbuch** ist das Tagebuch, was Friday getan hat.
