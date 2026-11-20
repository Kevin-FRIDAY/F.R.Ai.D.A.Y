# Carlas Lernecke (ab Version 1.108.0)

Ein eigener Lernbereich nur für Carla. Friday scannt Lernkarten, speichert sie und fragt sie ab.

## So öffnet Carla die Lernecke

- Werkzeug-Menü → **Alltag** → **Carlas Lernecke**
- oder per Stimme: „Friday, Lernmodus“, „Friday, öffne die Lernecke“, „Carla will lernen“, „Friday, frag mich ab“
- oder direkt mit dem Link: `https://<deine-friday-adresse>/?lernen`
- Auf Carlas eigenem Handy: in der Lernecke unten den Haken „Auf diesem Gerät immer direkt mit der Lernecke starten“ setzen.
  Dann geht Friday dort immer gleich in die Lernecke (gilt nur für dieses Gerät).

## Carla oder Kevin?

Friday kann im Browser Stimmen nicht zuverlässig auseinanderhalten (die Spracherkennung liefert nur den Text,
nicht die Stimme). Darum merkt sich **jedes Gerät, wem es gehört**:

- Beim ersten Öffnen auf einem Gerät fragt die Lernecke: „Ich bin Carla“ oder „Ich bin Kevin“ (Haken „merken“).
- **Kevin-Testmodus**: keine Begrüßung, Abfrage-Ergebnisse zählen nicht für Carlas Fortschritt. Gescannte und
  bearbeitete Karten werden aber gespeichert (so kann Kevin Karten für Carla vorbereiten).
- Ändern: auf der Startseite der Lernecke „Dieses Gerät gehört: …“ oder oben „Als Carla starten“.
- Per Stimme: „Friday, Lernmodus testen“ startet immer den Testmodus.

Beim allerersten Mal (als Carla) stellt Friday sich vor:
„Hi Carla, ich bin Friday, die künstliche Assistentin von Kevin. Er hat mich gebeten, dir beim Lernen zu helfen. Was wollen wir machen: Soll ich dich abfragen, oder soll ich dir generell beim Lernen helfen?“
Ab dem zweiten Mal: „Hi Carla, freut mich, dass du da bist. Wie kann ich dir beim Lernen helfen?“
Carla kann dann einfach „abfragen“, „lernen“ oder „scannen“ sagen.

## Karten scannen

1. Reiter **📷 Scannen**.
2. **Blatt / Zettel / Buchseite**: ein Foto, Friday macht daraus mehrere Karten.
   Am besten so aufgeschrieben: Überschrift, darunter die Punkte. Karten mit einer Leerzeile trennen.
   Auch „Begriff: Erklärung“ pro Zeile oder „Frage: … / Antwort: …“ klappt.
3. **Karteikarte (vorne + hinten)**: erst die Vorderseite fotografieren, dann die Rückseite, dann „Karte übernehmen“.
4. Karten kurz prüfen (man kann alles korrigieren), Stapel wählen oder neu benennen, **Speichern**.

**Am Mac (nur Frontkamera):** „🎥 Live-Kamera (Mac)“ → Karte vor die Kamera halten → „📸 Aufnehmen“.
In der Vorschau ist die Schrift spiegelverkehrt (wie bei FaceTime), das ist normal. Friday erkennt Spiegelschrift
auch selbst und dreht sie um. Falls doch Buchstabensalat kommt: „⇋ Spiegelverkehrt? Andersrum lesen“.

Die Texterkennung ist kostenlos: Am Mac liest Apples Schrifterkennung (kann auch Handschrift).
Beim allerersten Scan richtet der Mac sie einmal ein, das dauert ca. 40 Sekunden.
Bei sehr krakeliger Schrift: „🤖 KI liest die Schrift“ (braucht Guthaben).

## Abfragen

Reiter **🎯 Abfragen** → Stapel wählen → **Los geht's**.
Friday liest die Überschrift vor und hört zu. Danach sagt sie, ob es richtig war, was gefehlt hat
oder ob die Reihenfolge nicht stimmte (bei nummerierten Punkten).

Carla kann sagen: „weiß ich nicht“, „nochmal“, „Tipp“, „später“, „Stopp“. Bei langen Antworten am Ende „fertig“.
Hat Friday sich verhört: **Doch richtig ✓**. Unsicher? **🤖 KI prüft nochmal** (braucht Guthaben).

Wiederholung: Jede Karte liegt in einem von 5 Fächern. Richtig → ein Fach weiter (kommt erst nach 1, 3, 7, 14 Tagen wieder).
Falsch → zurück ins erste Fach, kommt in derselben Runde nach ein paar Karten nochmal und morgen wieder.

## Lernhilfe

Karten durchblättern und umdrehen, vorlesen lassen, Eselsbrücke (Anfangsbuchstaben), Lückentext,
nur eine Karte abfragen. „🤖 Erklär's mir“ erklärt eine Karte oder beantwortet eine Frage dazu (braucht Guthaben).

## Lernplan

Stapel wählen, Prüfungsdatum und Minuten pro Tag eintragen → Friday verteilt die Karten auf die Tage,
wiederholt nach 1, 3 und 7 Tagen und lässt die letzten Tage nur zum Wiederholen. Auf der Startseite steht dann „Heute dran“.

## Fortschritt (ab Version 1.109.0)

Auf der Startseite der Lernecke steht **Dein Fortschritt**: Für jedes Thema (jeden Kartenstapel) gibt es drei grüne Ringe
mit Prozent in der Mitte. Ein neues Thema bekommt automatisch eigene Ringe.

- **Geübt**: So viele Karten hat Carla schon mindestens einmal beantwortet.
- **Gemerkt**: So oft lag sie beim Abfragen richtig (fast richtig zählt halb).
- **Auswendig**: Diese Karten sitzen, sie waren mehrmals hintereinander richtig (Fach 4 und 5).

Die Ringe stehen auch auf jedem Stapel unter „Meine Karten“ und am Ende jeder Abfrage.
Antippen eines Themas springt direkt zum Abfragen. Im Kevin-Testmodus ändern sich die Ringe nicht.

**Lob (ab Version 1.112.0):** Wird ein Ring nach einer Abfrage voll (100 %), lobt Friday Carla laut und mit einer kleinen
Feier (grüner Ring, Konfetti): „Hast du richtig gut gemacht. Ich bin stolz auf dich!“ Das passiert einmal pro Ring und Thema.
Kommen neue Karten dazu und der Ring ist wieder unter 100 %, lobt sie beim nächsten Vollwerden erneut.
„Gemerkt“ zählt erst als voll, wenn auch alle Karten geübt sind. Im Kevin-Testmodus gibt es kein Lob.

## Archiv (ab Version 1.109.0)

Reiter **📚 Archiv** (oder Kachel „Mein Archiv“, oder „Friday, zeig meine Lernunterlagen“, oder Link `/?lernen=archiv`).
Hier liegt alles dauerhaft:

- **Jedes gescannte Foto** landet automatisch hier, mit dem erkannten Text. Auch wenn keine Karten daraus wurden
  und auch, wenn der Kartenstapel später gelöscht wird.
- **📷 Foto ablegen**: Blatt fotografieren, Friday liest die Schrift und legt es ab (ohne Karten zu machen).
- **📎 Datei ablegen**: PDF, Word, PowerPoint, Excel, Pages, Keynote, Bilder, Text, Sprachaufnahmen (bis 8 MB pro Datei).
- **📝 Notiz**: eigene Mitschrift tippen.
- Ordner nach **Fach** (Feld „Fach für neue Unterlagen“ oder beim Öffnen ändern), **Suche** auch im erkannten Text,
  **☆ Favoriten** stehen oben.
- Öffnen zeigt Fotos, PDFs und Ton direkt an, alles andere über **⬇ Herunterladen**.
- **🃏 Karten daraus machen** macht aus dem Text einer Unterlage neue Lernkarten.
- **🗑 Papierkorb**: Gelöschtes kann zurückgeholt werden. Erst „Endgültig löschen“ entfernt es.
- Unten: **Meine Karteikarten zum Mitnehmen**, jeder Stapel als Textdatei zum Ausdrucken.

Hinweis: In PDFs und Word-Dateien sucht Friday nur im Titel, nicht im Inhalt.

## Foto-Check: erst prüfen, dann speichern (ab Version 1.118.0)

Sobald Carla ein Foto macht (im Reiter „Scannen“ oder im Archiv), liest Friday die Schrift sofort.
Ist die Schrift spiegelverkehrt (z. B. Frontkamera am Mac), dreht Friday das Bild automatisch richtig herum.
Dann zeigt Friday das Foto und den gelesenen Text und fragt laut: **„Ist das richtig?“**

- **Ja, richtig – speichern** (oder einfach „Ja“ sagen): Foto und Text kommen ins Archiv. Bei einem Blatt
  werden auch gleich die Karten gespeichert (in den gewählten oder einen neuen Stapel).
- **Andersrum spiegeln** (oder „spiegeln“ sagen): Friday liest das Bild nochmal andersherum.
- **Nein, verwerfen** (oder „Nein“ sagen): Nichts wird gespeichert, einfach nochmal fotografieren.

Den Text kann Carla im Fenster vorher noch verbessern. Unbestätigte Fotos räumt Friday nach einem Tag selbst weg.

## Üben: Aufgaben, Tabellen, eigene Karten (ab Version 1.118.0)

Reiter **🧩 Üben**:

- **Aufgaben erstellen**: Friday macht aus den Karten eines Stapels Übungen – Multiple Choice, Lückentext,
  Wahr oder falsch, Zuordnen und Reihenfolge. Kostenlos, ohne Guthaben. Am Ende gibt es die Auswertung.
  Das Arbeitsblatt (mit Lösungen) kann ins Archiv oder heruntergeladen werden.
- **Als Tabelle**: Der Stapel als Tabelle. Einfach in ein Feld tippen, um es zu ändern, „Neue Zeile“ = neue Karte,
  🗑 = Karte löschen, dann „Änderungen speichern“. Herunterladen als Excel-Tabelle (CSV) oder ins Archiv.
- **Eigene Karte**: Vorder- und Rückseite selbst schreiben.
- **KI-Aufgaben** (braucht Guthaben): Claude denkt sich abwechslungsreiche Aufgaben, eine Tabelle und Karten aus.

Sprachbefehl: „Friday, Lernecke Aufgaben“ oder „Friday, Lernecke üben“.

## Wissen aus dem Internet (ab Version 1.118.0)

Reiter **🌐 Wissen**: Thema eintippen oder per 🎤 sagen. Friday schaut bei Wikipedia nach (kostenlos) und liest
das Wichtigste vor. Daraus kann Carla mit einem Tipp **Karten**, eine **Tabelle** oder **Aufgaben** machen oder alles
mit Quellenangabe **ins Archiv** legen. In der Lernhilfe gibt es dazu den Knopf „🌐 Mehr dazu im Internet“.

Sprachbefehl: „Friday, such in der Lernecke im Internet nach Photosynthese“.

## Wo liegen Carlas Daten?

Getrennt von Kevins Sachen: `server/data/lernen.json` (Karten, Fortschritt), `server/data/lernen-bilder/` (Fotos),
`server/data/lernen-archiv.json` und `server/data/lernen-unterlagen/` (Archiv).
Beides ist in der Sicherung dabei und wird von Updates nicht angefasst.
