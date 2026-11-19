# Routen & Verbindungen (ab v1.103.0)

Friday rechnet aus, wie lange du wohin brauchst – mit **Auto, Fahrrad, zu Fuß** und mit **Bahn & Bus** (mit Abfahrtszeit, Gleis, Umstiegen und Verspätung). Das klappt **ohne Claude-Guthaben** und ohne Schlüssel.

## So geht's

Sag oder tipp zum Beispiel:

- „Friday, wie lange brauche ich nach Hamburg?“
- „Friday, wann fährt der nächste Zug nach Köln?“
- „Friday, wie komme ich mit dem Bus zum Hauptbahnhof?“
- „Friday, wie lange brauche ich mit dem Fahrrad zum Alexanderplatz?“
- „Friday, wie komme ich morgen um 8 zur Arbeit?“
- „Friday, Route von Berlin nach Leipzig“
- „Friday, wie lange brauche ich nach München, wenn ich um 17 Uhr ankommen will?“

Friday liest die Antwort vor und öffnet das Fenster **Routen & Verbindungen**:

- Oben vier Kacheln: Auto, Bahn & Bus, Fahrrad, zu Fuß – mit Fahrzeit, Kilometern und Ankunftszeit. Antippen wechselt die Ansicht.
- Links die Karte mit der Strecke (Bahn & Bus mit jeder Linie in Farbe, Fußwege gepunktet).
- Rechts die Verbindungen. Eine Verbindung antippen zeigt jeden Schritt: Abfahrt, Gleis, Linie, Umstieg, Ankunft.
- **Spätere Verbindungen** holt die nächsten Züge und Busse.
- **Apple Karten / Google Maps** öffnet die gleiche Route dort – für Navigation mit Live-Stau.

Ohne Sprache: Werkzeug-Menü → **Alltag** → **Routen & Verbindungen**.

## Von wo rechnet Friday?

1. Im Fenster unten **⚙ Meine Orte & Standort** einmal deine **Zuhause**-Adresse (und gern die **Arbeit**) eintragen und speichern. Dann klappen auch „nach Hause“ und „zur Arbeit“.
2. Unterwegs mit dem iPhone: Haken bei **Standort dieses Geräts als Start nehmen** setzen und den Standort erlauben. Dann rechnet Friday ab dort, wo du gerade bist – auch per Sprache.
3. Der 📍-Knopf neben dem Startfeld nimmt einmalig deinen aktuellen Standort.

Ohne Adresse rechnet Friday ab deiner Heimatstadt (Einstellungen → Profil).

## Gut zu wissen

- Auto-Zeiten sind **ohne Stau**. Für Live-Verkehr: Apple Karten oder Google Maps.
- Bahn & Bus kommen von **Transitous** (freie Fahrplandaten aus ganz Deutschland, Echtzeit und Verspätungen, wo die Verkehrsbetriebe sie liefern). Ein Ticket kann Friday nicht kaufen.
- Adressen findet Friday über OpenStreetMap, die Strecken über die freien OSRM-Server.
- Fahrrad wird bis ca. 300 km, zu Fuß bis ca. 40 km berechnet.
- Deine Orte liegen nur auf deinem Mac in `server/data/routen.json`.
