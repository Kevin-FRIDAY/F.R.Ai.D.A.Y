# F.R.Ai.D.A.Y

Ein JARVIS/F.R.I.D.A.Y-artiges HUD-Dashboard mit:

- einem **Neuronalen Gehirn** – einem echten Backend (Node.js/Express +
  SQLite), das beliebige Dateneinträge und eigene Funktionen dauerhaft
  speichert;
- einer **Kommandozentrale mit rotierendem 3D-Weltlage-Globus**: per Text
  oder Sprachbefehl ("USA", "zeig mir Deutschland", …) recherchiert der
  Server die echte Top-Meldung des Landes bei einer direkten, seriösen
  Nachrichtenquelle (kein Google-News-Redirect), zeigt Bild/Video aus dem
  Originalartikel (falls vorhanden) und liest die Meldung im Browser laut vor.

## Starten

```bash
npm install
npm start
```

Danach das Dashboard unter `http://localhost:3000` öffnen. Der Server
liefert das Frontend aus und stellt die Gehirn-API bereit:

- `GET/POST /api/memory`, `PUT/DELETE /api/memory/:id` – freie Notizen/Fakten
- `GET/POST /api/functions`, `PUT/DELETE /api/functions/:id` – eigene
  JS-Funktionen (im Browser über den "AUSFÜHREN"-Button testbar)
- `GET /api/health` – Statusabfrage für das Gehirn-Panel
- `GET /api/news?country=<Name>` – echte Top-Meldung für ein Land (Text,
  Quelle, Bild/Video falls vorhanden), erkennt deutsche/englische
  Landesnamen im Freitext
- `GET /api/news/countries` – Liste der unterstützten Länder (für den Globus)

Die Daten liegen in `server/data/brain.db` (SQLite, wird beim ersten
Start automatisch angelegt und ist nicht Teil des Repos). Nachrichten
werden serverseitig 10 Minuten gecacht, um die (kostenlosen, öffentlichen)
Quellen zu schonen; ist eine Quelle kurzzeitig nicht erreichbar, wird die
letzte bekannte echte Meldung mit Hinweis angezeigt statt eines Fehlers.

## Live-Deployment auf einem eigenen Server

`scripts/deploy.sh` richtet den Server auf einem Debian/Ubuntu-Rechner
vollautomatisch ein: Node.js, den Dienst als systemd-Service unter einem
eigenen, unprivilegierten Systembenutzer, Nginx als Reverse-Proxy und ein
Let's-Encrypt-Zertifikat für die konfigurierte Domain.

Per SSH auf dem Server ausführen (nicht aus dieser Sandbox heraus, da
ausgehendes SSH von dort blockiert ist):

```bash
ssh <user>@<server>
git clone https://github.com/Kevin-FRIDAY/F.R.Ai.D.A.Y.git /tmp/fraiday-src
cd /tmp/fraiday-src
sudo FRAIDAY_DOMAIN=fraiday-ai.duckdns.org bash scripts/deploy.sh
```

Umgebungsvariablen (optional):

- `FRAIDAY_DOMAIN` – Domain für Nginx/Zertifikat (Standard: `fraiday-ai.duckdns.org`)
- `FRAIDAY_PORT` – interner Port des Node-Prozesses (Standard: `3000`)
- `FRAIDAY_BRANCH` – zu deployender Branch (Standard: dieser Feature-Branch)

Erneutes Ausführen des Skripts holt den neuesten Stand und startet den
Dienst neu (Update-Deployment). Danach:

- Status: `systemctl status fraiday`
- Logs: `journalctl -u fraiday -f`