# Modul-Zentrale (ab Version 1.97.0)

Alle neuen Module an einem Ort: **Werkzeug-Menü → Modul-Zentrale** (ganz oben) oder sag
„Friday, öffne die Modul-Zentrale“. Auf der Übersicht siehst du alle Module als drehbare
3D-Kugel. Tippe auf einen Namen, um das Modul zu öffnen.

Jedes Modul hat ein Schild:

- **Funktioniert**: läuft sofort, ohne Guthaben.
- **Verbessert**: gab es schon, jetzt besser.
- **Braucht Guthaben**: funktioniert, fragt aber Claude (kostet etwas Guthaben).
- **Gab es schon**: steht woanders in Friday (zum Beispiel 3D-Werkstatt, Haus-Werkstatt, Sicherungen).

## 🛡 Kontrolle

- **Notfall-Stopp**: Der rote Knopf (oder „Friday, Notfall!“) stoppt sofort alle Missionen,
  Automationen, Auto-Updates und Aktionen. „Notfallmodus aus“ beendet ihn wieder.
- **Autonomie-Regler**: Hier legst du fest, wie selbstständig Friday arbeiten darf.
  - 0 Nur Vorschläge: Friday fragt vor jeder Aktion.
  - 1 Vorsichtig: Anrufe, Mac, Licht, Fernseher, Updates … brauchen immer deine Freigabe.
  - 2 Normal (Standard): Im Gespräch ist alles wie bisher. Nur Missionen und Automationen fragen bei kritischen Aktionen.
  - 3 Selbstständig: Friday fragt nicht nach. Die festen Grenzen bleiben trotzdem: kein echtes Geld und nichts heimlich an andere.
  - Per Sprache: „Friday, Autonomie auf vorsichtig“.
- **Genehmigungen**: Wartet etwas auf dich, erscheint oben im Dashboard ein Chip „Freigabe“.
  Mit Erlauben führt Friday die Aktion aus, mit Ablehnen nicht. Nach 24 Stunden verfällt eine Anfrage.
- **KI-Modell-Routing**: Beim Denk-Tempo „Automatisch“ nimmt Friday für kurze Fragen Haiku,
  für normale Sonnet und für schwere Aufgaben Opus. Ist das Guthaben knapp, spart Friday von selbst.
- **Zugriffskontrolle**: In der Tabelle legst du fest, welche Bereiche welche Daten lesen dürfen
  (zum Beispiel ob das Denk-Labor dein Gedächtnis kennen darf).

## 🚀 Missionen (braucht Guthaben)

Gib Friday einen größeren Auftrag, zum Beispiel „Recherchiere die 3 besten E-Bikes bis 2000 €
und mach eine Vergleichstabelle“. Das geht auch per Sprache: „Friday, neue Mission: …“.

- Friday plant die Schritte selbst und arbeitet sie **nach Priorität** ab (hoch, dann mittel, dann niedrig).
  Die Priorität erkennt Friday aus dem Text (zum Beispiel „dringend“ oder „bis morgen“). Du kannst sie auch selbst wählen.
- Jeder Schritt bekommt die Ergebnisse der vorigen Schritte mit (**Wissensübergabe**) und einen passenden Agenten.
- Klappt ein Schritt nicht, versucht Friday einen anderen Weg (**Rückfallstrategie**).
  Klappt das auch nicht, hält sie an und schickt dir eine Mitteilung.
- Läuft ein Schritt länger als 4 Minuten, wird er als „hängt“ markiert (**Fortschrittsüberwachung**).
- Unter „Verlauf / Versionen“ steht jede Änderung mit Uhrzeit. Entscheidungen und Notizen kannst du zur Mission dazuschreiben.

## ⚙ Automationen

Hier baust du Wenn-Dann-Regeln, zum Beispiel „Jeden Werktag um 7:30 Uhr → Friday: Was steht heute an?“.
Als Auslöser gehen eine Uhrzeit, „alle X Minuten“ (mindestens 15) oder der Start von Friday.
Als Aktion gehen ein Auftrag an Friday (braucht Guthaben), eine Mitteilung, ein Protokoll, eine Aufgabe oder eine Mission.

## 🧪 Denk-Labor (braucht Guthaben)

Das Labor hat 21 Denk-Werkzeuge: Hypothesen, Widersprüche, Wissenslücken, mehrere Blickwinkel,
Unsicherheit, Qualität, persönlicher Berater, Was-wäre-wenn, Verhandlung, Meeting-Zusammenfassung,
Gesprächsanalyse, Klausel-Prüfer für Verträge, Skizze zu Projektentwurf (mit Foto), App-Prototyp,
Video-Storyboard, Kreativ-Labor, Forschung (mit echten Studien aus OpenAlex), Studienvergleich,
Experiment-Planer, Technologie-Radar (live von Hacker News) und Datenanalyse.

- Jedes Ergebnis endet mit „Wie sicher ist das?“.
- **Selbstprüfung**: Friday prüft ihr eigenes Ergebnis und verbessert es. Das kostet etwa doppelt so viel.
- Jede Eingabe wird auf versteckte KI-Befehle geprüft (Manipulationserkennung).
- Der Klausel-Prüfer ist keine Rechtsberatung.

## ∑ Rechnen (ohne Guthaben)

- **Formel-Labor**: Hier kannst du mit Variablen, Funktionen und einer Wertetabelle rechnen.
  Per Sprache: „Friday, rechne 2 hoch 10 plus 5“.
- **Prognose**: Füge Zahlen ein (zum Beispiel Umsätze pro Monat). Friday zeigt den Trend, die nächsten Werte
  und ein Unsicherheitsband. Das ist keine Anlageberatung.
- **Was-wäre-wenn / Simulator**: Trag unsichere Werte ein (Min, wahrscheinlich, Max) und bis zu 4 Szenarien.
  Friday rechnet sie 5000-mal durch und zeigt schlecht, typisch und gut.
- **3D-Modell vermessen**: Lade eine STL- oder OBJ-Datei. Friday zeigt Größe, Fläche und Volumen,
  ob das Modell druckbar (dicht) ist und wie viel es ungefähr wiegt.

## 🧭 Persönlich

- **Prioritäten**: Aufgaben, Ziel-Schritte und Erinnerungen, sortiert nach Wichtigkeit.
  Per Sprache: „Friday, was ist am wichtigsten?“.
- **Ziel-Navigator**: Friday macht aus einem großen Ziel konkrete Schritte. Mit Claude wird der Plan besser,
  ohne Guthaben gibt es einen einfachen Standard-Plan. Mit „→ Aufgaben“ kommt der nächste Schritt in deine Aufgaben.
- **Entscheidungsarchiv**: Hier schreibst du auf, was du entschieden hast und warum. Später bewertest du es
  mit Sternen und trägst ein, wie es ausgegangen ist.
- **Gewohnheitsanalyse**: Zeigt, wann und wofür du Friday nutzt und was sich oft wiederholt.
- **Wissensprofil**: Deine Interessen, Fähigkeiten, Lernziele und Werte. Der Berater nutzt sie.

## 🕸 Wissen

- **Wissensgraph**: Verknüpft deine Missionen, Ziele, Entscheidungen, Dokumente, dein Gedächtnis,
  deine Kontakte und deine Module über gemeinsame Begriffe.
- **Zeitachse**: Zeigt alles nach Datum: Missionen, Ziele, Entscheidungen, Dokumente, Updates und Module.

## 📡 Netzwerk

- **Command Network**: Zeigt alle Geräte und Dienste mit ihrem Zustand live: Mac, Fernseher, Alexa,
  Kalender, Spotify, Hue und mehr.
- **Umgebungen**: Speichere deine Dashboard-Einstellungen als „Arbeit“, „Abend“ usw. und wechsle sie mit einem Tipp.

## 🔐 Sicherheit

- **Datenleck-Wächter**: Prüft nur Fridays eigene Dateien. Er findet Schlüssel im Klartext
  (zum Beispiel weil sie mal im Chat standen), zu offene Dateirechte, die .env in Git und ob Tailscale Funnel
  Friday öffentlich macht. Mit dem Knopf „Reparieren“ setzt du die Dateirechte richtig.
- **Testlabor / Update-Sandbox**: Jedes Update wird jetzt vor dem Einspielen geprüft
  (alle Dateien, Syntax und Importe). Fällt es durch, bleibt alles, wie es ist, und der Update-Balken wird rot.
  Hier kannst du auch von Hand die neue Version von GitHub oder deine eigene Installation testen.
  Das Testlabor findet kaputte oder unvollständige Updates, aber keine Denkfehler im Programm.
- **Manipulationserkennung**: Füge einen Text oder eine Datei ein. Friday sucht versteckte KI-Befehle,
  unsichtbare Zeichen, gefälschte Buchstaben (zum Beispiel ein kyrillisches „а“ in „pаypal“) und irreführende Links.

## 🧩 Module (Marktplatz)

Eigene Module sind kleine JSON-Beschreibungen, keine Programme. Ein Modul sagt nur, auf welche Sätze
Friday reagiert und was sie dann antwortet oder tut. Darum kann ein Modul nichts kaputt machen.

- Im **Marktplatz** liegen 4 Beispiele: Würfel & Münze, Motivations-Kick, Schnell-Übersetzer und Pausen-Erinnerung.
- Vor dem Einschalten macht Friday eine **Kompatibilitätsprüfung**. Sie prüft, ob die Friday-Version passt,
  ob die Rechte bekannt sind und ob die Sätze frei sind (sie dürfen keine eingebauten Befehle wie „Notfall“
  oder Sätze anderer Module übernehmen).
- Legst du eine Moduldatei in `server/data/module/`, erkennt Friday sie von selbst und wartet, bis du sie einschaltest.
- Rechte: `befehle` (auf Sätze antworten), `claude` (an Fridays Gehirn weitergeben, kostet Guthaben),
  `mitteilung` (aufs Handy schicken).

Beispiel:

```json
{
  "id": "hallo",
  "name": "Hallo-Modul",
  "version": "1.0.0",
  "braucht_friday": ">=1.97.0",
  "beschreibung": "Begrüßt jemanden",
  "rechte": ["befehle"],
  "befehle": [
    { "saetze": ["sag hallo zu *"], "antwort": "Hallo {1}! Grüße von {name}." }
  ]
}
```

## Wo liegen die Daten?

Alles liegt in `server/data/`: kommando.json, missionen.json, automationen.json, ziele.json, entscheidungen.json,
wissensprofil.json, module/ und module-stand.json. Updates löschen diese Dateien nie, und die Sicherungen sichern sie mit.
