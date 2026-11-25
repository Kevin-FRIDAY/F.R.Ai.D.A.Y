# Flugzeuge weltweit im Weltgeschehen (ab Version 1.115.0)

Friday zeigt jetzt **alle Flugzeuge, die öffentlich ihre Position senden** (ADS-B) – weltweit, rund 10.000 gleichzeitig.
Kein Schlüssel nötig.

## So geht's
- Weltgeschehen → **Ebenen** → **Flugzeuge** an. Weit weg: farbige Punkte. Nah dran: kleine Flugzeuge in Flugrichtung.
- Farben: gelb = Linien- & Frachtflüge, hellblau = Privat & Geschäftsflieger, lila = Hubschrauber, grau = am Boden, rot = Notfall-Code, grün = Militär & Staat (neu ab 1.173.0).
- **✈ Filter & Suche**: Arten an/aus, Suche nach Flugnummer (LH400 oder DLH400), Kennung oder Land.
- **Flugzeug antippen** → Steckbrief: Airline, Strecke von → nach (gestrichelt auf dem Globus), Höhe (Meter + Fuß),
  Tempo, Kurs, Steigen/Sinken, Squawk, Wind und Temperatur draußen, Typ (z. B. Boeing 747-8), Kennzeichen, Halter und Foto.
  „Live-Karte“ öffnet das Flugzeug bei adsb.lol.

## Sprachbefehle (ohne Claude-Guthaben)
- „Friday, zeig mir alle Flugzeuge“ · „Friday, wie viele Flugzeuge sind in der Luft?“
- „Friday, zeig mir den Flug LH 400“
- „Friday, zeig mir die Hubschrauber“ · „Friday, zeig mir Flugzeuge mit Notfall“
- Neu ab 1.173.0: „Friday, was fliegt über mir?“ (nächstes Flugzeug über deinem Wohnort aus den Einstellungen)
- Neu ab 1.173.0: „Friday, zeig mir Militärflugzeuge“ · „Friday, gibt es gerade einen Luftnotfall?“

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

## Neu ab Version 1.173.0: mehr adsb.lol
adsb.lol ist ein freies Netz von Hobby-Antennen (ohne Schlüssel, Daten unter der offenen ODbL-Lizenz). Friday nutzt es jetzt viel mehr:
- **Militär & Staat (grün):** jede Minute alle Militär- und Regierungsflugzeuge weltweit, die öffentlich senden.
- **Notfälle live:** jede Minute alle Flugzeuge mit Squawk 7700 (Notfall), 7600 (Funkausfall) oder 7500 (Entführung).
  Taucht einer auf, zeigt Friday oben im Weltgeschehen einen roten Hinweis. Antippen fliegt zum Flugzeug. Der Status-Ring wird gelb.
- **Ersatz-Weltkarte:** Wenn OpenSky nicht antwortet oder das Tageskontingent leer ist, holt Friday die Flugzeuge aus rund
  60 Regionen bei adsb.lol (Europa, Nordamerika, Asien, Nahost, Australien, Südamerika, Afrika). Wer nur adsb.lol will:
  in `~/Friday/server/.env` die Zeile `FLUG_QUELLE=adsblol` eintragen und Friday neu starten.
- **Flugsuche live:** Ist ein Flug nicht auf der Weltkarte, fragt Friday adsb.lol direkt nach dem Rufzeichen.
- **Strecke von → nach:** Kennt adsbdb.com die Strecke nicht, fragt Friday adsb.lol.
- **„Was fliegt über mir?“:** Friday sucht im Umkreis von rund 75 km um deinen Wohnort das nächste Flugzeug.

### Datenschutz
- Flugzeuge, deren Halter um Datenschutz gebeten haben (LADD/PIA-Listen), zeigen kein Kennzeichen, keinen Halter und kein Foto.
- Bei Privat- und Geschäftsfliegern zeigt Friday nie den Halter, denn das sind oft Privatpersonen. Halter nur bei Airlines und Militär/Staat.
- Es geht nur um Flugzeuge, die selbst öffentlich ihre Position senden. Personen werden nicht verfolgt.
