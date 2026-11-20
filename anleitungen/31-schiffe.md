# Schiffe weltweit im Weltgeschehen (ab Version 1.114.0)

Friday zeigt jetzt **alle Schiffe, die öffentliche AIS-Empfänger gerade auffangen** – weltweit, live.
Dafür braucht es den kostenlosen Schlüssel von aisstream.io (`AISSTREAM_API_KEY` in `~/Friday/server/.env`).

## So geht's
- Weltgeschehen → **Ebenen** → **Schiffe** an. Weit weg: farbige Punkte. Nah dran: kleine Pfeile in Fahrtrichtung.
- **🚢 Filter & Suche**: Frachter, Tanker, Passagier & Fähren, Fischerei, Schlepper & Hafen, Segel & Sport,
  Behörden & Rettung, Schnellboote, Sonstige. Suche nach Schiffsname oder MMSI.
- **Schiff antippen** → Steckbrief: Position, Tempo (Knoten + km/h), Kurs, Status (fährt, ankert, festgemacht …),
  Ziel, geplante Ankunft, Typ, Flagge, Länge, Breite, Tiefgang, IMO, Rufzeichen und die Spur der letzten Stunde.
  Ab 1.121.0 außerdem: **Ziel-Hafen** (Name, Land, Entfernung, ungefähre Restzeit, gelbe Linie auf dem Globus),
  **Foto und Kurztext** (bei bekannten Schiffen, aus Wikipedia/Wikimedia) und ein Link zur Schiffsseite bei VesselFinder.

## Sprachbefehle (ohne Claude-Guthaben)
- „Friday, zeig mir alle Schiffe“ · „Friday, wie viele Schiffe sind unterwegs?“
- „Friday, zeig mir die Tanker“ / „… die Fähren“ / „… die Segelboote“
- „Friday, zeig mir das Schiff Queen Mary 2“

## Ehrlich gesagt
- Empfangen wird über Antennen an Land. Auf hoher See fehlen viele Schiffe (das gäbe es nur mit teurem Satelliten-AIS).
- Den Schiffstyp sendet ein Schiff nur alle paar Minuten. Direkt nach dem Start steht darum bei vielen noch „unbekannt“.
- Kriegsschiffe und manche Fischer schalten AIS ab – die sieht niemand öffentlich.
