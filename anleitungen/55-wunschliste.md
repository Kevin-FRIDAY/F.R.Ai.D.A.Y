# Meine Wunschliste (v1.160.0)

Die 11 Ideen, die du in der **Ideen-Schmiede → Friday ausbauen** mit ⭐ „Auf die Wunschliste“ markiert hast, sind eingebaut.
Öffnen: **Werkzeug-Menü → Friday → ⭐ Meine Wunschliste**. Oben die 11 Kacheln, darunter der jeweilige Bereich.
Im Ideen-Tresor stehen die 11 Wünsche danach auf „✅ Erledigt“, im Bauplan als „✓ schon da“.

Alles läuft **ohne Claude-Guthaben**. Nur die zwei Knöpfe mit „braucht Guthaben“ fragen Claude.

| Wunsch | Sag zum Beispiel | Was du einrichten musst |
|---|---|---|
| ⛈ Unwetter-Warnungen (DWD) | „Friday, gibt es eine Unwetterwarnung?“ | nichts. Friday prüft alle 15 Min. und meldet neue Warnungen per Telegram. |
| 📰 Eigene Nachrichten (RSS) | „Was gibt's Neues bei Heise?“, „Lies mir meine Nachrichten vor“ | Quellen im Fenster antippen oder eigene Feed-Adresse eintragen. |
| 📦 Paket-Verfolgung | „Verfolge Paket 0034…“, „Wo ist mein Paket?“ | Für DHL-Live-Status: kostenloser Schlüssel von developer.dhl.com („Shipment Tracking – Unified“). Andere Dienste: Link. |
| 🎞 Eigene Mediathek | „Spiel Iron Man“, „Habe ich Avatar in meiner Mediathek?“ | Jellyfin (kostenlos) oder Plex auf dem Mac, Adresse + Schlüssel eintragen. Läuft die Jellyfin-App am Fernseher, startet der Film dort. |
| 🧠 Lokales KI-Gehirn | „Friday, denk lokal“ / „Friday, denk wieder normal“ | Ollama-App von ollama.com, dann im Terminal `ollama pull llama3.2:3b`, im Fenster „Einspringen“ anhaken. |
| 📶 Fritz!Box | „Ist das Internet langsam?“, „Wie ist das Gäste-WLAN?“, „Gäste-WLAN an/aus“ | Leitungswerte gehen sofort. Für Gäste-WLAN: Fritz!Box-Benutzer mit Passwort eintragen. |
| 🎂 Geburtstage | „Mama hat am 3. März Geburtstag“, „Wann hat Mama Geburtstag?“, „Was soll ich Mama schenken?“ | nichts. Erinnerung 7 Tage vorher (mit Geschenk-Ideen) und am Tag. |
| 📱 iPhone-Widget | – | App „Scriptable“, im Fenster „Skript kopieren“, in Scriptable einfügen, Widget auf den Home-Bildschirm. |
| 👪 Familien-Pinnwand | „Schreib an die Pinnwand: …“, „Setz Windeln auf Carlas Liste“, „Erinner Carla morgen um 8 an den Arzt“ | Profile im Fenster anlegen (z. B. Carla). |
| 🌙 Abend-Rückblick | „Wie war mein Tag?“, „Rückblick aus/an“ | nichts. Kommt jeden Abend um 21 Uhr per Telegram (Uhrzeit einstellbar). |
| 🧬 Friday lernt dich kennen | „Was weißt du über meine Gewohnheiten?“ | nichts. Friday wertet einmal pro Woche eure Gespräche aus (bleibt auf dem Mac). |

## Gut zu wissen

- Schlüssel und Passwörter (DHL, Jellyfin/Plex, Fritz!Box) liegen nur auf dem Mac in `server/data/verbindungen.json` und werden nie ans Dashboard geschickt. Bitte nie im Chat posten.
- Eve meldet nichts nach außen (keine Telegram-Nachrichten für Unwetter, Pakete, Geburtstage, Rückblick).
- Das lokale Gehirn ist kleiner als Claude: gut für einfache Fragen, nicht für große Aufgaben.
