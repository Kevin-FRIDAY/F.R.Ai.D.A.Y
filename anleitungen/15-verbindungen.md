# Verbindungen: Kalender, Stimme, Spotify, Smart Home, Todoist, Notion

Alles richtest du an einer Stelle ein: **Werkzeug-Menü → Verbindungen** (oder **Einstellungen → Verbindungen → Öffnen**).
Tipp auf einen Dienst, trag den Schlüssel ein, fertig. Schlüssel bleiben auf deinem Mac (`server/data/verbindungen.json`),
werden nie angezeigt und von Updates nie überschrieben. **Schreib Schlüssel nie in einen Chat.**

Alle Befehle unten laufen **ohne Claude-Guthaben**.

---

## 📅 Apple Kalender & Erinnerungen (kostenlos, kein Schlüssel)

Läuft über deinen Mac. Termine vom iPhone kommen über iCloud automatisch mit.

1. Verbindungen → Apple Kalender → **Zugriff testen**.
2. Auf dem Mac erscheint zweimal die Frage, ob „node“ Kalender bzw. Erinnerungen steuern darf → **OK**.
   Falls du aus Versehen „Nicht erlauben“ geklickt hast: Systemeinstellungen → Datenschutz & Sicherheit → Automation → node → Kalender und Erinnerungen anhaken.
3. Optional: wähle, in welchen Kalender neue Termine kommen.

Sag zum Beispiel:
- „Friday, was steht heute an?“ (Termine **und** fällige Todoist-Aufgaben)
- „Was steht morgen an?“, „Welche Termine habe ich diese Woche?“, „Was ist mein nächster Termin?“
- „Wann bin ich morgen frei?“
- „Trag Zahnarzt am Freitag um 10 Uhr ein“, „Neuer Termin: Friseur übermorgen um halb drei“
- „Zeig meine Apple Erinnerungen“, „Setz Brot auf meine Erinnerungen“, „Hake Milch in den Erinnerungen ab“

Gut zu wissen: Wiederkehrende Termine (jede Woche, jedes Jahr) werden mitgezählt; einzeln gelöschte Wiederholungen kann Friday aber nicht erkennen.

---

## 🗣️ ElevenLabs-Stimme (Gratis-Kontingent)

1. Konto auf **elevenlabs.io** anlegen (kostenlos, ca. 10.000 Zeichen im Monat).
2. Unten links auf dein Profil → **API Keys** → neuen Schlüssel erstellen.
   Bei den Rechten: **Text to Speech → Zugriff**, **Voices → Lesen**, **User → Lesen** (am einfachsten: alle Rechte an lassen).
   Den Schlüssel sofort kopieren – ElevenLabs zeigt ihn nur einmal.
3. Verbindungen → ElevenLabs → Schlüssel einfügen → **Verbinden**.
4. Stimme auswählen, **▶ Probe hören**.

> Den Schlüssel nur in Friday eintragen, nie in einen Chat oder eine Nachricht schreiben.

**Rote Fehlermeldung?**
- „Dem Schlüssel fehlen Rechte“ → neuen Schlüssel mit den Rechten oben erstellen.
- „ElevenLabs kennt diesen Schlüssel nicht“ → Schlüssel wurde gelöscht oder nicht ganz kopiert. Neu erstellen und komplett einfügen.
- „Gratis-Konto vorübergehend gesperrt“ → ElevenLabs blockt Gratis-Konten bei VPN/ungewöhnlicher Nutzung. VPN aus, später nochmal.

„Tempo: Schnell“ spart Zeichen und antwortet schneller, „Beste Qualität“ klingt noch etwas natürlicher.
Ist das Monatskontingent aufgebraucht, spricht Friday automatisch mit der Gerätestimme weiter.

Sag: „Wie viele Zeichen habe ich noch?“, „Wechsel die Stimme zu Lily“.

---

## 🎵 Spotify (Steuern braucht Spotify Premium)

1. Auf **developer.spotify.com** einloggen → **Dashboard → Create app**.
   - Name: Friday, Beschreibung: egal
   - **Redirect URI:** genau die Adresse, die dir das Verbindungen-Fenster anzeigt (normal `http://127.0.0.1:3000/api/spotify/callback`)
   - Haken bei „Web API“, speichern.
2. Die **Client ID** (32 Zeichen) kopieren → Verbindungen → Spotify → einfügen → **Verbinden**.
3. **Bei Spotify anmelden** → zustimmen. Das bitte **am Mac** machen (die Adresse 127.0.0.1 gibt es nur dort).

Sag: „Spiel meine Playlist Workout“, „Spiel Musik von Adele“, „Spiel Bohemian Rhapsody von Queen“,
„Spiel entspannte Musik“, „Spiel meine Lieblingssongs“, „Was läuft gerade?“, „Pause“, „Weiter“, „Nächstes Lied“,
„Musik lauter“, „Spotify Lautstärke 30“, „Shuffle an“.
Läuft Spotify gerade nirgends, öffnet Friday die Spotify-App auf dem Mac.

---

## 🏠 Home Assistant

1. In Home Assistant unten links auf dein **Profil → Sicherheit → Langlebige Zugangs-Token → Token erstellen**, Name „Friday“, kopieren.
2. Verbindungen → Home Assistant → Adresse (z. B. `http://homeassistant.local:8123`) und Token → **Verbinden**.

Sag: „Schalte die Kaffeemaschine an“, „Mach das Licht im Wohnzimmer aus“, „Heizung im Bad auf 22 Grad“,
„Wie warm ist es im Wohnzimmer?“, „Rollo Schlafzimmer runter“, „Szene Filmabend“.
Friday findet die Geräte über ihre Namen in Home Assistant. Schlösser schaltet Friday aus Sicherheitsgründen nicht per Sprache.

---

## 💡 Philips Hue

1. Verbindungen → Philips Hue → IP leer lassen (Friday sucht selbst).
2. Den **großen runden Knopf auf der Hue Bridge** drücken, dann gleich auf **Koppeln** (30 Sekunden Zeit).
3. Bei „Neon-Orange, wenn Friday spricht“ einen Raum wählen – dann leuchtet er beim Sprechen orange und geht danach zurück.

Sag: „Licht an“, „Licht im Wohnzimmer aus“, „Küche Licht an“, „Licht auf 30 Prozent“, „Licht dunkler“,
„Licht blau“, „Mach das Licht im Wohnzimmer rot“, „Neon-Modus“, „Szene Entspannen“.
Hast du Hue **und** Home Assistant, kümmert sich Hue um die Lampen und Home Assistant um alles andere.

---

## ✅ Todoist

1. todoist.com → **Einstellungen → Integrationen → Entwickler → API-Token kopieren**.
2. Verbindungen → Todoist → einfügen → **Verbinden**.
3. Optional: „Neue Aufgabe … speichern in: Todoist“ – dann landen auch „Neue Aufgabe: …“ und „Was muss ich heute machen?“ in Todoist.

Sag: „Was steht heute in Todoist?“, „Füg Steuererklärung bis Freitag zu Todoist hinzu“, „Todoist: Reifen wechseln“, „Hake Müll in Todoist ab“.

---

## 🧠 Notion

1. **notion.so/profile/integrations → Neue Integration** (Typ: intern), Name „Friday“ → **Internal Integration Secret** kopieren.
2. In Notion eine Seite für Notizen anlegen (z. B. „Friday Notizen“) → oben rechts **… → Verbindungen → Friday** hinzufügen.
   Alle Seiten, die Friday durchsuchen soll, genauso teilen.
3. Verbindungen → Notion → Secret einfügen → **Verbinden** → Notizen-Seite auswählen.

Sag: „Notiz: Idee für das neue HUD“, „Schreib Milch kaufen in Notion“, „Lies meine letzten Notizen“, „Such in Notion nach Projekt Jarvis“.

---

## Wenn etwas nicht klappt

- **System-Check** (Werkzeug-Menü) zeigt für jede Verbindung, ob sie läuft.
- **Trennen** im Verbindungen-Fenster löscht den Schlüssel; danach neu eintragen.
- Kalender, Erinnerungen und „Spotify-App öffnen“ brauchen den verbundenen Mac.
