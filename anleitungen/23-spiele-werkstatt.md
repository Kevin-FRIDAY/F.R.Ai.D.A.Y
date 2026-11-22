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

## Neu in v1.144.0: Spiele-Datenbank mit Grafik-Plus (zuerst nur in Eve)

Unter **📚 Meine Spiele** gibt es jetzt die **Spiele-Datenbank** mit Kategorien (Rennen, Geschick, Denken, Abenteuer, Strategie) und sechs neuen, eigenen Spielen in deutlich hochwertigerer Grafik. Alle laufen ohne Claude-Guthaben, auf dem iPhone und am Mac:

| Spiel | Art | Steuerung |
|---|---|---|
| 🏁 Neon-Drift | 3D-Rennen bei Sonnenuntergang | ← → oder linke/rechte Bildschirmhälfte |
| 🪐 Orbit-Sprung | Von Planet zu Planet springen | Antippen / Leertaste |
| 💎 Kristall-Fall | Kristalle tauschen, Dreier-Reihen | Wischen oder Pfeile + Leertaste |
| 🔦 Tiefsee-Licht | Mit dem Scheinwerfer durch die Tiefsee | Finger ziehen / Pfeile / Maus halten |
| 🏃 Licht-Läufer | Lauf über die Dächer der Neon-Stadt | Antippen / Leertaste (2× = Doppelsprung) |
| 🗼 Turm-Wächter | Türme bauen, Drohnen-Wellen abwehren | Feld antippen, Knöpfe unten |

Per Sprache: „Friday, starte Neon-Drift“, „lass uns Turm-Wächter spielen“, „öffne die Spiele-Datenbank“.

**Grafik-Motor:** Alle neuen Spiele benutzen einen gemeinsamen Grafik-Motor (Leucht-Effekte, Partikel, Schockwellen, Bildschirm-Wackeln, Töne, Touch-Joystick, Rekorde). Wenn Claude in Eve ein neues Spiel programmiert, benutzt er denselben Motor, dadurch sehen auch selbst gewünschte Spiele viel besser aus. Wird das iPhone zu langsam, schaltet der Motor von selbst in einen Sparmodus.

**Freigabe:** In Friday sind die neuen Spiele mit 🔒 gesperrt. Probier sie in Eve aus und gib „Spiele-Werkstatt Plus“ im Fenster **Eve-Tests** frei, dann gibt es sie auch in Friday.
