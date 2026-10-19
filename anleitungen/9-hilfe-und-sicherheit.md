# 9. Hilfe und Sicherheit

## Wenn etwas nicht geht

| Problem | Lösung |
|---|---|
| Dashboard lädt nicht | **Friday starten.command** öffnen. Danach in `~/Library/Logs/Friday/com.friday.server.log` nachsehen, was drinsteht. |
| "Friday kann nicht starten. In der .env fehlt ..." | Den genannten Wert eintragen oder Installer nochmal laufen lassen. |
| Antworten kommen nicht | Claude-API-Schlüssel prüfen und ob im Anthropic-Konto Guthaben ist. |
| Mac "getrennt" | Log `com.friday.agent.log` ansehen. Meist hilft **Friday starten.command**. |
| Musik/Sperren/Bildschirm geht nicht | Mac-Rechte erteilen ([Installation](1-installation.md#mac-rechte)). |
| iPhone erreicht Friday nicht | Tailscale auf dem iPhone an? Mac wach? |
| Mikrofon geht im iPhone-Browser nicht | Friday über die `https://...ts.net`-Adresse öffnen, nicht über `http://`. |
| Update-Knopf bleibt grau | Liegt Friday schon auf GitHub? Siehe [Updates](10-updates.md). |
| Update ging schief | Log `~/Library/Logs/Friday/update.log` ansehen. Die alte Version liegt in `~/Friday-Sicherung`. |
| Passwort vergessen | Terminal: `cd ~/Friday/server && npm run passwort`, dann neu starten. |

Du kannst mir die Logdatei auch in den Chat schicken. Vorher kurz durchschauen, dass kein Schlüssel drinsteht (Friday schreibt keine Schlüssel ins Log).

## So ist Friday geschützt

- **Nur auf deinem Mac erreichbar.** Friday hört nur auf `127.0.0.1`. Von außen geht es nur über dein privates Tailscale-Netz.
- **Passwort.** Ohne Passwort kein Zugriff. Nach 5 falschen Versuchen ist 15 Minuten Pause.
- **Kurzbefehl-Schlüssel** darf nur Fragen stellen und Gesundheitsdaten senden.
- **Mac-Agent** führt nur fest eingebaute Aktionen aus, keine beliebigen Befehle.
- **Telegram** antwortet nur deiner Chat-ID.
- **Schlüssel** stehen nur in `server/.env` auf deinem Mac (nur für deinen Benutzer lesbar).

## Was du selbst tun solltest

- `server/.env` nie teilen und nie auf GitHub hochladen.
- Im Anthropic-Konto ein Monatslimit setzen.
- Wenn ein Schlüssel doch mal irgendwo gelandet ist: beim Anbieter löschen, neuen erstellen, in die `.env` eintragen, neu starten.
