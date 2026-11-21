# Kamera-Wache (ab v1.127.0)

Friday passt mit deinen **eigenen** Kameras auf dein Zuhause auf und sagt dir, was passiert.

## Was Friday erkennt

| | Funktion | So geht's |
|---|---|---|
| 🚶 | Bewegung | Unterschied zwischen zwei Bildern, Empfindlichkeit in den Einstellungen |
| 🧍 | Personen | „Person erkannt“ – **nie, wer es ist** (keine Gesichtserkennung) |
| 🐕 | Hunde & Katzen | auch Vögel |
| 🔍 | Gegenstände | rund 80 Arten (Laptop, Fahrrad, Rucksack, Sofa …). Bewachte Gegenstände: Friday meldet, wenn einer verschwindet |
| 🔥 | Feuerschein & Rauch | nur soweit im Bild sichtbar – **ein Hinweis, kein Rauchmelder-Ersatz** |
| 🚪 | Tür | Im Live-Bild „Tür-Linie ziehen“ und eine Linie quer über die Tür malen. Geht jemand darüber, meldet Friday es (rein/raus) |
| 🏠 | Mehrere Räume | jedes Gerät oder jede IP-Kamera ist ein Raum |
| 📸 | Ereignisprotokoll | mit Foto, Uhrzeit und Raum. Fotos liegen in `~/Friday-Archiv/Kamera-Wache/` und werden nach 7 Tagen gelöscht (einstellbar) |
| 🚨 | Alarm | wenn die Wache **scharf** ist: Telegram (mit Foto) und ntfy. Feuer/Rauch meldet Friday immer |

Die Erkennung läuft im Browser auf dem Gerät (wie Friday Vision). Dafür geht kein Bild ins Internet.
Nur „Schau genau hin“ schickt ein einzelnes Standbild an Claude (braucht Guthaben).

## Was du brauchst

1. **Zum Ausprobieren:** nichts. Werkzeug-Menü → **Kamera-Wache (Zuhause)** → Raum eintragen → **▶ Kamera starten**. Die Mac-Kamera passt auf.
2. **Mehr Räume, kostenlos:** ein **altes iPhone oder iPad** pro Raum. Darauf Friday öffnen (Tailscale-Adresse), Kamera-Wache → Raum eintragen → Rückkamera → starten. Ans Ladekabel hängen und hinstellen. Tipp: Adresse `…/?wache=1&raum=Flur&cam=hinten` als Lesezeichen – dann startet die Kamera von allein.
3. **Feste Kameras:** WLAN-Kameras mit **RTSP** oder **JPEG-Schnappschuss** (ca. 25–60 €), z. B. Reolink, TP-Link Tapo C200/C210 (in der Tapo-App unter „Erweitert → Kamerakonto“ RTSP anschalten), Amcrest, Foscam.
   - Adresse Tapo: `rtsp://benutzer:passwort@192.168.1.50:554/stream2`
   - Adresse Reolink: `rtsp://admin:passwort@192.168.1.60:554/h264Preview_01_sub` oder Schnappschuss `http://192.168.1.60/cgi-bin/api.cgi?cmd=Snap&channel=0&user=admin&password=…`
   - Für rtsp braucht der Mac **ffmpeg** (hat er schon, wenn das Schnitt-Team installiert ist).
   - Dann im Wache-Fenster „IP-Kamera hinzufügen“ und auf dem Mac **„IP-Kameras auf diesem Gerät auswerten“** anschalten.
   - **Nicht** geeignet: reine Cloud-Kameras ohne RTSP (Ring, Blink, viele Eufy).
4. **Damit es nachts läuft:** Mac am Strom, Ruhezustand verhindern (Systemeinstellungen → Energie), Friday offen lassen. Das Wache-Fenster darf zu sein – unten links zeigt eine kleine Anzeige, dass die Wache läuft.

## Sprachbefehle (ohne Claude)

- „Friday, Wache an“ / „Ich gehe weg“ / „Pass auf die Wohnung auf“ → scharf
- „Wache aus“ / „Ich bin wieder da“ → aus
- „Was passiert zu Hause?“ / „Was ist im Wohnzimmer los?“
- „Ist jemand im Flur?“ · „Wo ist die Katze?“
- „Was ist heute passiert?“ → Tagesbericht
- „Schau genau hin“ → Claude beschreibt das aktuelle Bild (ohne Personen zu identifizieren)
- In Telegram: „Foto vom Wohnzimmer“ oder `/kamera` → aktuelles Bild

## Grenzen (bewusst)

- Nur eigene Kameras in eigenen Räumen. Keine fremden oder öffentlichen Kameras.
- Keine Gesichtserkennung, kein Erkennen, **wer** jemand ist.
- Mitbewohner und Gäste informieren. Kameras nicht auf Nachbars Grundstück oder öffentliche Wege richten.
