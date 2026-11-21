# Fridays Datenbank + „Friday ausbauen“ (v1.130.0)

## Fridays Datenbank

Öffnen: Werkzeug-Menü → **Wissen**, oder sag **„Friday, öffne die Datenbank“**.

Oben siehst du einen gebogenen Glas-Bildschirm wie bei Fridays Gehirn:

- **Datenkern** (links): Einträge insgesamt, heute neu, gemerkt, Gespräche (nach Kanal), Speichergröße.
- **Wissen eintragen**: Schreib eine Notiz hinein (z. B. „WLAN-Passwort steht hinten am Router“) und tippe auf Speichern. Notizen kannst du in der Liste mit ✕ wieder löschen.
- **Speicher-Karte** (Mitte): Jede Quelle ist ein leuchtender Knoten. Je größer, desto mehr Einträge. Antippen = nur diese Quelle zeigen, nochmal antippen = wieder alles.
- **Aktivität 30 Tage**, **Häufige Themen** (antippen = danach suchen) und **Rückblick** (was war vor einer Woche, einem Monat, einem Jahr).

### Neue Quellen in der Datenbank

Zu Gesprächen, Aktionen, Gemerktem, Aufgaben, Erinnerungen, Einkauf und Dokumenten kommen jetzt dazu:
eigene **Notizen**, der **Ideen-Tresor**, **Entscheidungen**, **Ziele**, **Missionen**, **Meine Geräte**, der **Vorrat** aus dem Kühlschrank und die **Lernstapel**.

### Export

- **⬇ JSON**: alles als Datei (zum Sichern).
- **⬇ Tabelle**: die aktuelle Auswahl (Filter + Suche) als CSV-Datei für Excel oder Numbers.

### Sprachbefehle (ohne Guthaben)

- „Friday, öffne die Datenbank“
- „Friday, durchsuche die Datenbank nach Router“
- „Friday, notiere in die Datenbank: Der Schlüssel liegt bei Oma“
- „Friday, wie groß ist deine Datenbank?“
- „Friday, was war vor einer Woche?“

## Ideen-Schmiede: Friday ausbauen

Öffnen: Werkzeug-Menü → **Ideen-Schmiede** → Reiter **🤖 Friday ausbauen**, oder sag
**„Friday, was kann man bei dir noch einbauen?“**

- **Links: Einbinden** – Dienste und Geräte, die Friday anbinden kann (Unwetter-Warnungen, Pollenflug, Spritpreise, Paket-Verfolgung, Müllkalender, Fußball, lokale KI …). Meist kostenlos.
- **Rechts: Bauen** – neue Funktionen (Sprach-Tagebuch, Gewohnheiten mit Serien, Geburtstage, Haushaltsbuch, Reise-Planer, Abend-Rückblick, iPhone-Widget …).
- **Mitte: Bauplan-Kern** – tipp eine Kachel an und du siehst Nutzen, Aufwand (1–3 Striche), Kosten, was man braucht und den Sprachbefehl.
  - **⭐ Auf die Wunschliste**: landet im Ideen-Tresor mit 🤖-Zeichen.
  - **📋 Bau-Auftrag kopieren**: fertiger Text, den du einfach in den Chat mit Claude einfügst – dann wird es gebaut.
- **Aus deinem Alltag**: Friday schaut in die eigene Datenbank. *Passt zu dir* zeigt Vorschläge zu Themen, nach denen du oft fragst. *Das konnte Friday noch nicht* zeigt Fragen, bei denen Friday passen musste – mit ⭐ merkst du sie als Wunsch.
- **🤖 Neue Vorschläge mit KI** (braucht Guthaben): Claude schlägt 5 weitere Ideen vor, passend zu dem, was es in Friday schon gibt.

Was schon eingebaut ist, wird automatisch als „✓ schon da“ markiert.
Beim Würfeln gibt es jetzt auch den Bereich **🤖 Für Friday**.

Wichtig: Friday baut sich nicht selbst um. Die Vorschläge sind ein Plan – gebaut wird über einen Pull Request.
