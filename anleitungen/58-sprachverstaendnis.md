# Friday versteht ganze Gespräche (v1.166.0)

Friday versteht jetzt nicht nur einzelne Sätze, sondern auch, wie man normal mit jemandem redet.
Das meiste davon läuft **ohne Claude-Guthaben** und ist darum sofort da.

## Mehrere Befehle in einem Satz
„Friday, stell einen Timer auf 5 Minuten und sag mir, wie spät es ist.“
„Mach das Licht an, stell einen Wecker auf 7 Uhr und spiel Musik.“

Friday erledigt jeden Teil der Reihe nach. Früher ging der zweite Befehl verloren.
Was Friday nicht allein schafft (zum Beispiel „schreib mir ein Gedicht“), gibt sie gesammelt an Claude.

## Nachfragen
- „Wie spät ist es in Tokio?“ → „Und in New York?“ → „Und Sydney?“
- „Wie ist das Wetter in Berlin?“ → „Und morgen?“ → „Und in Hamburg?“
- „Was ist 15 mal 7?“ → „Und durch 3?“
- „Was kostet Bitcoin?“ → „Und Ethereum?“

## Antworten auf Rückfragen
„Erinnere mich an den Müll.“ → Friday: „Wann soll ich dich erinnern?“ → „In 10 Minuten.“
„Stell einen Timer.“ → „Wie lange?“ → „5 Minuten.“

## Verbessern und Zurücknehmen
- „Nein, ich meinte 20 Minuten.“ → Friday nimmt die falsche Erinnerung weg und stellt die richtige.
- „Mach das rückgängig.“ → nimmt zurück, was Friday gerade angelegt hat (Erinnerung, Timer, Aufgabe,
  Einkaufsliste, Notiz), bis zehn Minuten danach.

## Gespräch
- „Was hast du gesagt?“ / „Wie bitte?“ / „Nochmal bitte.“ → Friday wiederholt ihre letzte Antwort.
- „Merk dir das.“ → Friday speichert ihre letzte Antwort im Gedächtnis.
- „Worüber haben wir gesprochen?“ / „Was habe ich dich gefragt?“

## Was sich sonst verbessert hat
- „Setz Milch, Eier und Brot auf die Einkaufsliste“ ergibt jetzt drei Einträge (vorher „Milch Eier“ und „Brot“).
- Füllwörter aus der Spracherkennung („ähm“, „äh“) werden überhört.
- Ohne Guthaben rät Friday bei Satzstücken wie „und morgen?“ nicht mehr irgendetwas aus dem Lexikon.
- Claude hat klare Regeln bekommen: alle Aufträge eines Satzes erledigen, Folgefragen auf die letzte Frage beziehen,
  und nur bei wirklich riskanten, unklaren Aufträgen (falsche Person, Löschen, Geld) einmal kurz nachfragen.
