# Lage-Plus: neun neue Ebenen im Weltgeschehen (v1.126.0)

Angeregt von Lagekarten wie Argos Atlas, aber als eigene Friday-Version. Alles kommt aus freien, öffentlichen Quellen, du brauchst keinen Schlüssel und kein Konto.

## Wo finde ich das?

Weltgeschehen öffnen → Knopf **Ebenen**. Neu sind:

- **Krisen & Warnungen:** Brennpunkte, Reisewarnungen (AA), Stabilitäts-Wert, WHO-Ausbrüche, Hurrikan-Kegel, Strahlung
- **Verkehr:** Flugzeuge in Not, Meerengen-Verkehr
- **Infrastruktur:** Atomkraftwerke, Große Häfen

Tippe auf einen Punkt, dann öffnet sich eine Karte mit den Einzelheiten. In der **📡 Lagebild-Leiste** gibt es dazu sechs neue Kacheln. Ein Tipp auf eine Kachel fliegt dich direkt hin.

Im **Länder-Fenster** ("Friday, zeig mir Ägypten") stehen jetzt auch die Reisewarnung und der Stabilitäts-Wert.

## Die neun Ebenen

| Ebene | Was sie zeigt | Quelle |
|---|---|---|
| 🔥 Brennpunkte | Länder, in denen gerade mindestens zwei verschiedene Dinge passieren (z. B. Konflikt + Internet-Ausfall + Erdbeben). Die Zahl im Kreis sagt, wie viele. | Friday wertet alle Ebenen zusammen aus |
| ✈ Flugzeuge in Not | Flugzeuge, die gerade Code 7700 (Notfall) oder 7600 (Funkausfall) senden. Meist ist es nur Vorsicht. | adsb.lol (öffentliches ADS-B) |
| ⚓ Meerengen-Verkehr | Schiffe pro Tag durch Hormus, Suez, Panama, Malakka, Bab el-Mandeb, Bosporus und mehr. Gelb/rot = deutlich weniger als im Monat davor. | IMF PortWatch |
| 🛂 Reisewarnungen | Rot = Reisewarnung, orange = Teil-Reisewarnung, gelb = Sicherheitshinweis. | Auswärtiges Amt (OpenData) |
| 🌀 Hurrikan-Kegel | Aktive Stürme im Atlantik und Ostpazifik mit Vorhersage-Kegel (wohin das Zentrum in 5 Tagen ziehen kann). | US-Hurrikan-Zentrum NHC |
| 🦠 WHO-Ausbrüche | Offizielle Ausbruchs-Meldungen der Weltgesundheitsorganisation der letzten 4 Monate. | WHO |
| ☢ Atomkraftwerke / ⚓ Häfen | Alle Atomkraftwerke weltweit und die 150 größten Häfen. | WRI Power Plant Database, IMF PortWatch |
| ☢ Strahlung | Messwerte freier Geigerzähler. Normal sind 0,05 bis 0,3 µSv/h. | Safecast |
| 📊 Stabilitäts-Wert | Zahl von 0 (sehr instabil) bis 100 (sehr stabil) je Land. | Weltbank + aktuelle Lage, Friday-Berechnung |

Die Atomkraftwerke, Häfen und Flughäfen lädt Friday beim ersten Start einmal herunter (ca. 15 MB, dauert eine Minute) und merkt sie sich in `server/data`.

## Sprachbefehle (ohne Guthaben)

- "Friday, kann ich nach Ägypten reisen?" / "Gibt es eine Reisewarnung für die Ukraine?"
- "Wie stabil ist Deutschland?" / "Welche Länder sind am instabilsten?"
- "Gibt es Flugzeuge in Not?"
- "Wie viele Schiffe fahren durch die Straße von Hormus?" / "Wie läuft der Suezkanal?"
- "Gibt es gerade einen Hurrikan?"
- "Gibt es Krankheits-Ausbrüche?"
- "Wie ist die Strahlung?"
- "Wo sind die Brennpunkte?"

## Was Friday bewusst nicht zeigt

Einzelne Menschen verfolgen (Privatjets, Yachten von Reichen), gezielt Schiffe jagen, die ihren Sender ausgeschaltet haben, und fremde Kameras aufzeichnen. Der Stabilitäts-Wert ist eine grobe Einschätzung und keine offizielle Bewertung. Vor einer Reise immer die Seite des Auswärtigen Amts lesen.
