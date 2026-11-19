# Satelliten im Weltgeschehen (ab Version 1.113.0)

Friday zeigt auf dem Globus **alle öffentlich gelisteten, aktiven Satelliten** – rund 16.000 Stück, live.

## So geht's
- Weltgeschehen öffnen → unten links **Ebenen** → Gruppe *Weltraum* → **Satelliten** an.
- **🛰 Filter & Suche**: Gruppen an/aus (Starlink, OneWeb, Kommunikation, Navigation, Wetter,
  Erdbeobachtung, Wissenschaft, Raumstationen, Amateurfunk, Militär (öffentlich), Sonstige)
  und Suche nach Name oder Nummer (z. B. *ISS*, *Hubble*, *Sentinel-2A*, *25544*).
- **Satellit antippen** → Steckbrief: Position, Höhe, Tempo, Umlaufbahn (Art, Höhe, Dauer einer Runde,
  Neigung), Land/Betreiber, Start (Datum, Startplatz, Rakete), Masse, Hersteller, Mission, Bild,
  Wikipedia-Link. Die Umlaufbahn wird als Linie gezeigt. **Folgen** dreht den Globus mit.

## Sprachbefehle (ohne Claude-Guthaben)
- „Friday, zeig mir alle Satelliten“
- „Friday, wie viele Satelliten gibt es?“
- „Friday, zeig mir die ISS“ / „… Hubble“ / „… Tiangong“
- „Friday, zeig mir Starlink“ / „… die GPS-Satelliten“ / „… die Wettersatelliten“
- „Friday, zeig mir den Satelliten Sentinel-2A“

## Woher die Daten kommen
- Bahndaten: CelesTrak (frei, alle 6 Stunden neu).
- Steckbrief: CelesTrak-Katalog (SATCAT) und Wikidata/Wikipedia. Nicht jeder Satellit hat dort
  Masse oder Mission – dann steht „nicht öffentlich angegeben“.

## Ehrlich gesagt
Geheime Militärsatelliten veröffentlicht niemand. Sie fehlen in jedem öffentlichen Katalog und
darum auch hier. Weltraumschrott und ausgebrannte Raketenstufen sind ausgeblendet.

## Leistung
Die Bahnen rechnet ein Hintergrund-Thread. Im Leistungsmodus *Flüssig* rechnet Friday seltener
(alle 5 statt 2,5 Sekunden) – das iPhone bleibt flüssig.
