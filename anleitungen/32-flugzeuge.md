# Flugzeuge weltweit im Weltgeschehen (ab Version 1.115.0)

Friday zeigt jetzt **alle Flugzeuge, die öffentlich ihre Position senden** (ADS-B) – weltweit, rund 10.000 gleichzeitig.
Kein Schlüssel nötig.

## So geht's
- Weltgeschehen → **Ebenen** → **Flugzeuge** an. Weit weg: farbige Punkte. Nah dran: kleine Flugzeuge in Flugrichtung.
- Farben: gelb = Linien- & Frachtflüge, hellblau = Privat & Geschäftsflieger, lila = Hubschrauber, grau = am Boden, rot = Notfall-Code.
- **✈ Filter & Suche**: Arten an/aus, Suche nach Flugnummer (LH400 oder DLH400), Kennung oder Land.
- **Flugzeug antippen** → Steckbrief: Airline, Strecke von → nach (gestrichelt auf dem Globus), Höhe (Meter + Fuß),
  Tempo, Kurs, Steigen/Sinken, Squawk, Wind und Temperatur draußen, Typ (z. B. Boeing 747-8), Kennzeichen, Halter und Foto.
  „Live-Karte“ öffnet das Flugzeug bei adsb.lol.

## Sprachbefehle (ohne Claude-Guthaben)
- „Friday, zeig mir alle Flugzeuge“ · „Friday, wie viele Flugzeuge sind in der Luft?“
- „Friday, zeig mir den Flug LH 400“
- „Friday, zeig mir die Hubschrauber“ · „Friday, zeig mir Flugzeuge mit Notfall“

## Wie aktuell ist das?
- Die Weltkarte kommt vom OpenSky Network. Ohne Konto darf Friday dort nur etwa alle **15 Minuten** abrufen.
  Dazwischen rechnet Friday jedes Flugzeug mit Tempo und Kurs weiter – es sieht live aus, ist aber geschätzt.
- Zoomst du nah heran oder tippst ein Flugzeug an, holt Friday **echte Live-Daten** von adsb.lol (alle 15 Sekunden).

### Schneller mit kostenlosem OpenSky-Konto (optional)
1. Auf opensky-network.org kostenlos registrieren.
2. Im Konto unter „API Client“ einen Client anlegen.
3. In `~/Friday/server/.env` eintragen (nicht in den Chat schreiben!):
   `OPENSKY_CLIENT_ID=...` und `OPENSKY_CLIENT_SECRET=...`
4. Friday neu starten. Dann kommt die Weltkarte alle 2 Minuten frisch.

## Ehrlich gesagt
- Empfangen wird über freiwillige Antennen. Über Ozeanen, Afrika und Teilen Asiens fehlen viele Flugzeuge.
- Militär- und manche Regierungsflüge senden oft nicht oder werden ausgeblendet – die sind nicht öffentlich.
- Strecke und Foto stammen aus der freien Datenbank adsbdb.com und fehlen bei manchen Flügen.
