# Friday ruft an und schreibt (ab 1.93.0)

Sag einfach:

- „Friday, ruf meine Frau an und sag ihr, dass ich heute Pizza essen will.“
- „Friday, ruf meine Frau an.“ → Friday fragt: „Was soll ich ihr sagen?“ → „Lasagne mit Salat.“
- „Schreib meiner Frau, dass ich später komme.“
- „Sag meiner Frau Bescheid, dass ich um 18 Uhr da bin.“
- „Schick Mama eine Nachricht, dass ich am Sonntag komme.“
- „Ruf mich an und sag mir, dass ich den Müll rausbringen muss.“ (nur mit Twilio ein echter Anruf)

Friday macht aus „dass ich heute Pizza essen will“ automatisch „Ich will heute Pizza essen.“
Mit „vergiss es“ oder „nichts“ brichst du ab.

## Einmal einrichten (2 Minuten)

1. Dashboard → Werkzeug-Menü → **Verbindungen** → **📞 Anrufe & Nachrichten**.
2. Name und Handynummer deiner Frau eintragen, darunter deine eigene Nummer.
   Weitere Leute so: `Mama = 0170 111222, Papa = 0170 333444`.
3. **Speichern** tippen, dann **📨 Testnachricht an mich**.
4. Beim ersten Mal fragt der Mac, ob Friday die App „Nachrichten“ steuern darf: **OK** klicken.
   (Falls verpasst: Systemeinstellungen → Datenschutz & Sicherheit → Automation → node → Nachrichten an.)

Friday schreibt und ruft **nur** Leute an, die dort stehen.

## Die drei Wege für „Ruf … an“

| Einstellung | Was passiert | Kosten |
|---|---|---|
| Nachricht schicken | iMessage (sonst SMS übers iPhone) von deiner Apple-ID | kostenlos |
| Nachricht + FaceTime-Anruf am Mac | Nachricht, und der Mac startet einen FaceTime-Audio-Anruf. Am Mac auf „Anrufen“ tippen, dann sprichst du selbst | kostenlos |
| Echter Anruf, Friday spricht | Das Telefon deiner Frau klingelt, Friday sagt: „Hallo Anna, hier ist Friday … Kevin lässt dir ausrichten: …“ und wiederholt die Nachricht | Twilio, ein paar Euro im Monat |

Nachrichten laufen über die Nachrichten-App am Mac. Der Mac muss also an sein und Friday muss laufen.

## Echte Anrufe mit Twilio (optional)

1. Konto auf twilio.com anlegen und Guthaben aufladen (ab ca. 20 $).
2. Eine Telefonnummer kaufen (Phone Numbers → Buy a number). Für Deutschland verlangt Twilio oft Ausweis-Daten; eine US-Nummer geht schneller und kann trotzdem nach Deutschland anrufen.
3. Voice → Settings → **Geo Permissions**: Deutschland erlauben.
4. In der Twilio-Konsole oben **Account SID** und **Auth Token** kopieren.
5. In Friday → Verbindungen → Anrufe: SID, Token und deine Twilio-Nummer eintragen, Speichern.
6. „„Ruf … an“ bedeutet“ auf **Echter Anruf** stellen und **📞 Testanruf an mich** tippen.

Mit einem kostenlosen Testkonto darf Twilio nur Nummern anrufen, die du dort unter „Verified Caller IDs“ bestätigt hast, und spielt vorher einen Hinweis ab.
Ein Anruf nach Deutschland aufs Handy kostet je nach Tarif einige Cent pro Minute.
