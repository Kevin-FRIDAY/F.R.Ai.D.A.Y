# Agenten losschicken & das echte 3D-Büro (v1.168.0)

## Was ist neu?
- **11 neue Agenten**, die wirklich arbeiten: Sie holen echte, öffentliche Daten (ohne Schlüssel, ohne Kosten) und liefern einen fertigen Bericht, den Friday vorliest.
- **Echtes 3D-Büro**: animierte 3D-Roboter an richtigen Schreibtischen, Licht und weiche Schatten, glänzender Boden mit Spiegelungen, Neon-Glühen (auf dem Mac) und Fridays Kopf als Hologramm in der Mitte.
- Zwei neue Abteilungen: **Recherche** und **Alltag & Umwelt**.

## Die neuen Agenten
| Agent | Was er tut | Quelle |
|---|---|---|
| ⚡ Strompreis-Agent | findet die günstigsten 3 Stunden an der Strombörse (Waschen, Trocknen, Auto laden) | aWATTar / EPEX |
| 🌾 Pollen-Agent | Pollenflug für dein Bundesland, heute und morgen | Deutscher Wetterdienst |
| 🌊 Pegel-Agent | Wasserstände der Flüsse in deiner Nähe | Pegelonline (WSV) |
| 🚗 Verkehrs-Agent | Staus, Sperrungen, Baustellen auf einer Autobahn | Autobahn GmbH |
| 🏖️ Ferien-Agent | nächste Feiertage und Schulferien im Bundesland | OpenHolidays |
| 📰 Nachrichten-Agent | Top-Meldungen | tagesschau.de |
| 🔎 Recherche-Agent | Dossier zu einem Thema, landet unter Dokumente | Wikipedia |
| 🈯 Übersetzer | übersetzt Sätze in über 15 Sprachen | MyMemory |
| 👨‍🍳 Koch-Agent | Rezept aus dem, was im Kühlschrank bald abläuft | Fridays Kühlschrank |
| 🌋 Erdbeben-Wächter | Beben der letzten 24 h, weltweit und in deiner Nähe | USGS |
| 🚀 Weltraum-Agent | nächste Raketenstarts, Sonnensturm, Polarlicht-Chance | The Space Devs, NOAA |

Auch Wetter-, Krypto-, Lage-, Welt-Daten- und System-Agent haben jetzt einen Einsatz-Knopf. Der Karten-Agent ist ohne Mapbox einsatzbereit (Routen über OpenStreetMap).

## So schickst du einen Agenten los
1. Werkzeug-Menü → **Agenten-Team** → Ansicht **🏢 Büro**.
2. Agenten antippen → Knopf **🚀** (z. B. „Günstige Stunden finden“). Bei Recherche, Übersetzer, Pegel und Verkehr gibst du vorher kurz etwas ein.
3. Der Roboter fängt sichtbar an zu arbeiten (nickt, Daten fliegen zu Friday). Danach zeigt er Daumen hoch, der Bericht steht in der Karte und Friday liest ihn vor.
4. **Friday in der Mitte antippen → 🚀 Team-Lagebericht**: Wetter, Strompreis, Pollen, Ferien und Nachrichten gleichzeitig.

Per Sprache: „Friday, schick den Pollen-Agenten los“, „Verkehrs-Agent A7“, „Team-Lagebericht“, „schick das ganze Team los“.
Claude kann die Agenten auch selbst einsetzen (z. B. „Recherchiere Kernfusion“).

Jeder Einsatz steht im **Logbuch** (Bereich 🤖 Agenten-Team).

## Grafik und Tempo
- **Mac**: volle Qualität mit Nachleuchten (Bloom) und scharfen Schatten.
- **iPhone**: Schatten und Spiegelungen, aber ohne Nachleuchten; 30 Bilder pro Sekunde.
- **Flüssig-Modus** (Einstellungen → Leistung): ohne Schatten, am sparsamsten.
Die Zusatz-Grafik lädt erst, wenn du das Büro öffnest – die Startseite bleibt so schnell wie vorher.

## Grenzen
Nur öffentliche Quellen. Kein Agent bewegt Geld, kauft etwas oder beobachtet Personen.
Roboter-Modell: „RobotExpressive“ von Quaternius, gemeinfrei (CC0).
