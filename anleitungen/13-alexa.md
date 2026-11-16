# 13. Alexa mit Friday steuern

Friday kann **Alexa-Routinen starten** (zum Beispiel „Licht an“ oder „Gute Nacht“) und **Alexa etwas laut sagen lassen**. Damit steuert Friday alles, was schon an deiner Alexa hängt: Lampen, Steckdosen, Rollläden, Heizung.

Amazon lässt fremde Programme nicht direkt an Alexa. Darum geht es über den Dienst **Voice Monkey**. Für den Anfang reicht das kostenlose Konto.

Einmal einrichten dauert etwa 15 Minuten.

## Schritt 1: Voice-Monkey-Konto

1. Öffne am Mac **https://app.voicemonkey.io** und melde dich mit deinem **Amazon-Konto** an (dasselbe wie in der Alexa-App).
2. Fertig, das Konto ist angelegt.

## Schritt 2: Skill in der Alexa-App aktivieren

1. Öffne auf dem iPhone die **Alexa-App**.
2. Tippe auf **Mehr → Skills und Spiele**, suche nach **Voice Monkey**.
3. Tippe auf **Zur Verwendung aktivieren** und melde dich dort mit demselben Amazon-Konto an.

## Schritt 3: Routinen-Auslöser anlegen

Für jede Sache, die Friday starten soll, legst du in Voice Monkey einen „Routine Trigger“ an.

1. Auf **app.voicemonkey.io** links auf **Routine Triggers** (oder „Devices → Routine Triggers“) gehen.
2. **Neu anlegen** und einen Namen geben, und zwar genau so, wie du es sagen willst. Zum Beispiel: `Licht an`, `Licht aus`, `Gute Nacht`, `Kaffeemaschine an`.
3. In der **Alexa-App** auf **Mehr → Routinen → +** tippen:
   - **Wenn das passiert:** Smart Home → wähle das Gerät mit dem Namen aus Schritt 2 (z. B. „Licht an“).
   - **Aktion hinzufügen:** was passieren soll, zum Beispiel Wohnzimmerlampe einschalten.
   - Speichern.

Tipp: Lege für „an“ und „aus“ immer zwei getrennte Auslöser an. Friday verwechselt „an“ und „aus“ nie.

## Schritt 4: Lautsprecher für Ansagen

1. Auf **app.voicemonkey.io** zu **Speakers** gehen.
2. Deine Echo-Geräte hinzufügen und ihnen kurze Namen geben, z. B. `Wohnzimmer`, `Küche`.

## Schritt 5: Schlüssel in Friday eintragen

1. Auf **app.voicemonkey.io/tokens** einen **neuen Schlüssel (Token)** anlegen und kopieren. Es muss ein **v3**-Schlüssel sein.
2. In Friday: **Werkzeug-Menü → Alexa**, Schlüssel einfügen, **Verbinden** tippen.
3. Friday zeigt jetzt alle Routinen als Knöpfe und deine Echos zum Ansagen.

Hast du später neue Routinen angelegt, tipp im Alexa-Fenster auf **Aktualisieren**. Friday merkt es aber auch von selbst, wenn du eine neue Routine per Sprache aufrufst.

Der Schlüssel liegt nur auf deinem Mac (in `~/Friday/server/data/alexa.json`) und wird mitgesichert. Schick ihn niemandem und schreib ihn nicht in einen Chat.

## So benutzt du es

| Du sagst | Was passiert |
|---|---|
| „Friday, Alexa Licht an“ | Routine „Licht an“ startet |
| „Alexa Gute Nacht“ | Routine „Gute Nacht“ startet |
| „Alexa, sag Essen ist fertig“ | Dein Standard-Echo sagt „Essen ist fertig“ |
| „Lass Alexa im Wohnzimmer Hallo sagen“ | Nur das Echo „Wohnzimmer“ spricht |
| „Sag über Alexa überall: Feierabend!“ | Alle Echos sprechen |
| „Alexa Routinen“ | Friday sagt dir, welche Routinen es gibt |

Diese Befehle laufen **ohne Claude**, also auch, wenn dein Guthaben leer ist. Wichtig ist nur, dass „Alexa“ am Anfang steht.

Wenn Guthaben da ist, versteht Friday auch freiere Sätze, z. B. „Mach im Wohnzimmer das Licht über Alexa aus“.

## Wenn etwas nicht klappt

- **„Schlüssel stimmt nicht“**: Nimm einen neuen v3-Schlüssel von app.voicemonkey.io/tokens. Alte v2-Schlüssel gehen nicht mehr.
- **„Alexa hat nicht reagiert“**: Ist der Voice-Monkey-Skill in der Alexa-App aktiviert? Gibt es zur Routine auch wirklich eine Alexa-Routine (Schritt 3)?
- **„Ich finde keine Alexa-Routine“**: Friday sagt dir die Namen, die es kennt. Sag einen davon, oder benenne den Auslöser in Voice Monkey um.
- **„Monatslimit aufgebraucht“**: Das kostenlose Konto hat ein Monatslimit. Es setzt sich jeden Monat zurück.
- Der **System-Check** zeigt unter „Alexa (Voice Monkey)“, ob alles verbunden ist.
