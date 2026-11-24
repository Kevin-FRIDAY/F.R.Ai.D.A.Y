# Weckruf: Friday ruft dich an, wenn es wichtig ist (v1.161.0)

Friday lässt dein iPhone **klingeln wie bei einem Anruf**, wenn
- ein **Alarm** kommt (Kamera-Wache, Feuer, Gefahr), auch nachts,
- ein **wichtiger Termin** bald anfängt (Standard: 15 Minuten vorher),
- eine **Aufgabe fertig** ist (Missionen, lange Aufträge, oder wenn du sagst „… und ruf mich an, wenn du fertig bist“),
- eine **Mission dich braucht**,
- eine **Erinnerung** oder **Unwetter-Warnung** wichtig ist,
- **Friday selbst** etwas Dringendes findet.

Alles andere kommt wie bisher als normale Nachricht (ntfy/Telegram).

## Welcher Weg ist der beste?

| Weg | Kosten | Klingelt auch bei Lautlos? | Friday weiß, ob du es gesehen hast? | Aufwand |
|---|---|---|---|---|
| **Pushover-Notfall** (empfohlen) | einmalig ca. 5 $ (30 Tage gratis testen) | Ja („Kritische Hinweise“) | Ja, du tippst „Bestätigen“ | 5 Minuten |
| ntfy „dringend“ | kostenlos (hast du schon) | Nein | Nein | nichts |
| Twilio (echter Anruf, Friday spricht) | Telefonnummer ca. 1–3 $ im Monat + ein paar Cent pro Minute | Ja, ist ein echter Anruf | Nur ob abgenommen | 20 Minuten, deutsche Nummer braucht Adressnachweis |
| Alexa-Ansage | kostenlos mit Voice Monkey | nur zu Hause | Nein | schon eingerichtet? |
| Telegram-Anruf | geht nicht: Bots dürfen nicht anrufen | – | – | – |
| FaceTime vom Mac an dein eigenes iPhone | geht nicht: gleiche Apple-ID ruft sich nicht selbst an | – | – | – |

**Empfehlung:** Pushover. Es klingelt jede Minute neu, bis du auf „Bestätigen“ tippst, und geht durch Lautlos und Fokus.
Wer zusätzlich Twilio hat, stellt „Nicht bestätigt? Dann echt anrufen nach 5 Minuten“ ein. Dann ruft Friday wirklich an,
falls du das Klingeln verpasst.

## Einrichten (Pushover)

1. Im App Store **Pushover Notifications** laden, öffnen, Konto anlegen.
2. In der App: Einstellungen → **Kritische Hinweise erlauben** (damit es bei Lautlos klingelt).
3. Am Mac auf **pushover.net** anmelden. Oben steht dein **User Key** (30 Zeichen). Kopieren.
4. Unten auf **„Create an Application/API Token“**: Name „Friday“, Haken setzen, erstellen. Den **API Token** kopieren.
5. In Friday: Werkzeug-Menü → **Verbindungen** → **🔔 Weckruf**. Beide Schlüssel eintragen, **Speichern**.
6. **„🔔 Test: iPhone klingeln lassen“** tippen. Dein iPhone klingelt. Auf Bestätigen tippen.

## Regeln einstellen

Im selben Fenster wählst du für jede Art:
- **Nur Nachricht**: wie bisher
- **Klingeln, wenn wichtig**: nur bei Wörtern wie „wichtig“, „dringend“, „!“ oder (bei Terminen) Arzt, Flug, Amt, Bewerbung, Kita …
  Eigene Stichwörter (z. B. „Chef, Kunde“) trägst du oben ein.
- **Klingeln (wie ein Anruf)**: immer laut
- **Echter Anruf (Twilio)**: Friday ruft an und spricht die Meldung

Dazu: **Nachtruhe** (dann nur Alarm), **Vorlauf** für Termine, ob es auch klingeln soll, **wenn du gerade am Dashboard bist**,
und ob **Alexa** es zu Hause ansagen soll. Friday klingelt höchstens 4 Mal pro Stunde und nie zweimal für dasselbe.

## Sprachbefehle (ohne Claude)

- „Friday, teste den Weckruf“
- „Bitte nicht stören für 2 Stunden“ / „Weckrufe aus“ (Alarme kommen trotzdem)
- „Weckrufe wieder an“
- „Wann rufst du mich an?“
- „Bau mir eine Excel-Tabelle für meine Ausgaben **und ruf mich an, wenn du fertig bist**“

Termine liest Friday aus Apple Kalender (Mac muss verbunden sein).
