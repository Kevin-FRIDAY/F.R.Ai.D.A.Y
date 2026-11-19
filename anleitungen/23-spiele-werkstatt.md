# Spiele-Werkstatt (ab v1.101.0)

Friday programmiert dir Spiele – und du schaust live zu.

## So geht's

Sag oder tipp zum Beispiel:

- „Friday, bau mir ein Spiel“
- „Friday, programmier mir ein Snake-Spiel mit Power-ups“
- „Friday, mach mir ein Weltraum-Game, in dem man Meteore abschießt“

Dann öffnet sich die **Spiele-Werkstatt**:

1. Links siehst du live, wie Friday den Code schreibt (Zeilennummern, Farben, blinkender Cursor, Fortschritt).
2. Sobald der Code fertig ist, startet das Spiel rechts **automatisch** und ist sofort spielbar.
3. Knöpfe über dem Spiel: **⟲ Neu** (neu starten), **</> Code** (Code ein-/ausblenden), **⛶ Vollbild**, **⬇** (als HTML-Datei speichern).

Auf dem **iPhone** steuerst du per Wischen, Antippen oder eingeblendeten Knöpfen, am **Mac** mit Pfeiltasten/WASD, Leertaste und Maus.

## Spiele wiederfinden

Jedes Spiel wird gespeichert in `~/Friday-Spiele/<Datum>-<Name>/index.html`.

- „Friday, öffne mein Snake-Spiel“ oder „Lass uns Snake spielen“ → startet es sofort.
- „Friday, zeig meine Spiele“ → Liste aller Spiele.
- Werkzeug-Menü → **Spiele-Werkstatt** → **📚 Meine Spiele**.
- Auch im **Archiv** unter **🎮 Spiele**.

## Spiele ändern

„Friday, mach das Spiel schneller“ oder im Eingabefeld der Werkstatt: `ändere: mehr Gegner und ein Highscore`.
Friday baut dann das zuletzt gebaute bzw. das gerade offene Spiel um. Die alte Fassung bleibt als `index.vorher-….html` im Ordner liegen.

## Ohne Guthaben

Programmieren macht Claude (kostet ein paar Cent je Spiel, siehe ⚡ Energie). Ist das Guthaben leer, nimmt Friday eine ihrer **eingebauten Vorlagen** und sagt das ehrlich dazu („Vorlage (offline)“):

- Neon-Schlange (Snake)
- Ziegel-Brecher (Breakout)
- Neon-Paare (Memory)
- Meteor-Abwehr (Weltraum-Shooter)

Ändern geht nur mit Claude.

## Sicherheit

Die Spiele laufen abgeschottet (Sandbox). Sie kommen nicht an Fridays Anmeldung, deine Daten oder den Mac.
