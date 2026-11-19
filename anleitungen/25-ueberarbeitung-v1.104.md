# Gesamt-Überarbeitung (v1.104.0)

Friday wurde einmal komplett durchgecheckt: echte Fehler aus deinem Protokoll auf dem Mac behoben, das Offline-Gehirn erweitert und die Fenster aufgeräumt. Du musst nichts tun, das Update kommt von selbst.

## Behobene Fehler

- **„Claude nicht erreichbar: Invalid signature in thinking block“**: Bei längeren Aufträgen mit Werkzeugen ist Friday manchmal mitten drin ausgestiegen. Grund: Der Hintergrund-Text (Uhrzeit, Gedächtnis) hat sich zwischen zwei Denk-Schritten geändert. Jetzt bleibt er pro Auftrag gleich, und falls es trotzdem passiert, fragt Friday automatisch noch einmal.
- **Wetter-Absturz** („Cannot read properties of undefined“): Wenn der Wetterdienst Unsinn liefert, stürzt nichts mehr ab. Das Wetter wird 10 Minuten gemerkt (schneller) und bei Netzausfall bis zu 6 Stunden lang der letzte Stand genommen. Friday sagt dann dazu, wie alt er ist.
- **Telegram-Dauerschleife**: Mit kaputtem Bot-Schlüssel hat Friday alle 5 Sekunden einen Fehler ins Protokoll geschrieben (über 360 Mal). Jetzt merkt Friday einen falschen Schlüssel sofort und meldet ihn im System-Check. Bei Netzproblemen wartet Friday immer länger (bis 2 Minuten) statt zu hämmern.
- **„Ruf meine Frau an an und sag ihr …“**: Doppelte Wörter aus der Spracherkennung bringen Friday nicht mehr durcheinander.
- **„Hast du sie angerufen?“** wurde bisher als Nachricht an deine Frau verschickt, wenn Friday gerade gefragt hatte „Was soll ich ihr sagen?“. Jetzt antwortet Friday stattdessen.
- **„Ruf meine Frau an“** begann mit „Und ich starte …“. Jetzt ein sauberer Satz.
- **Mac-Fehlermeldungen**: Statt eines langen AppleScript-Textes sagt Friday jetzt, was los ist (z. B. „Zeitüberschreitung, fragt der Mac nach einer Erlaubnis?“ oder „Bildschirm gesperrt bzw. keine Erlaubnis für Bildschirmaufnahme“).
- **Mac-Protokoll**: Die Routine-Abfrage alle paar Sekunden steht nicht mehr tausendfach im Protokoll.

## Fenster-Ordnung

- Es ist immer nur **ein großes Fenster** offen. Öffnest du ein neues über das Werkzeug-Menü oder per Sprache, gehen die anderen zu. Vorher lagen z. B. Postfach, Fernbedienung, Alexa und Verbindungen übereinander.
- **Esc** schließt immer das oberste Fenster, bei allen Fenstern.

## Neu ohne Guthaben (Offline-Gehirn)

- „Friday, **was sind meine Aufgaben?**“
- „Friday, **Systemstatus**“ / „**Welche Version hast du?**“
- „Friday, **wie viel Guthaben hast du noch?**“
- „Friday, **wie heißt du?**“ / „**Wer hat dich gebaut?**“
- „Friday, **wann ist der nächste Feiertag?**“ klappt jetzt auch ohne Internet (Friday rechnet die bundesweiten Feiertage selbst aus).
- „Friday, **starte Snake**“, „**spiel Memory**“, „**lass uns Breakout spielen**“, „**starte Meteor**“: Die eingebauten Spiele starten sofort.
- „Friday, **was gibt es Neues?**“ liest auch ohne Guthaben die Schlagzeilen vor.
- „**Mach das Licht an**“ ohne eingerichtetes Smart Home: Friday sagt, was du einrichten musst.
- Ohne Internet sagt Friday bei Wetter, Kursen & Co. ehrlich: „Dafür brauche ich Internet.“

## Spiele-Werkstatt

- Stürzt ein Spiel beim Start ab (z. B. schwarzes Bild), zeigt Friday den Fehler an. Mit Guthaben einfach sagen: „Mach das Spiel fehlerfrei“.
