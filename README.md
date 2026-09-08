# F.R.Ai.D.A.Y

Ein JARVIS/F.R.I.D.A.Y-artiges HUD-Dashboard mit:

- einem **Neuronalen Gehirn** – einem echten Backend (Node.js/Express +
  SQLite), das beliebige Dateneinträge und eigene Funktionen dauerhaft
  speichert;
- einer **Kommandozentrale mit rotierendem 3D-Weltlage-Globus**: per Text
  oder Sprachbefehl ("USA", "zeig mir Deutschland", …) recherchiert der
  Server die echte Top-Meldung des Landes bei einer direkten, seriösen
  Nachrichtenquelle (kein Google-News-Redirect), übersetzt sie ins Deutsche
  (Original bleibt sichtbar), zeigt Bild/Video aus dem Originalartikel
  (falls vorhanden) und liest die Meldung auf Deutsch vor;
- **Dauerzuhören mit Weckwort**: Mikrofon einmal aktivieren, danach hört
  F.R.Ai.D.A.Y permanent mit, reagiert aber nur auf Sätze, die "Friday"
  enthalten (z.B. "Friday, zeig mir Japan");
- **Integrationen** (eigenes Panel "INTEGRATIONEN"): Gmail lesen/senden/
  sortieren, Google-Kalender-Termine anlegen/verschieben/löschen,
  Google-Kontakte synchronisieren (Klick auf einen Kontakt trägt die
  E-Mail-Adresse direkt ins Sendeformular ein), Spotify-Wiedergabe
  steuern + durchsuchen, YouTube durchsuchen und im Dashboard abspielen.
  Jede Anbindung braucht eigene Zugangsdaten, siehe unten.

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
  deutsche Übersetzung, Quelle, Bild/Video falls vorhanden), erkennt
  deutsche/englische Landesnamen im Freitext
- `GET /api/news/countries` – Liste der unterstützten Länder (für den Globus)

Die Daten liegen in `server/data/brain.db` (SQLite, wird beim ersten
Start automatisch angelegt und ist nicht Teil des Repos). Nachrichten
werden serverseitig 10 Minuten gecacht, um die (kostenlosen, öffentlichen)
Quellen zu schonen; ist eine Quelle kurzzeitig nicht erreichbar, wird die
letzte bekannte echte Meldung mit Hinweis angezeigt statt eines Fehlers.

## Integrationen einrichten (Google, Spotify, YouTube)

Jede Anbindung braucht eine eigene App-Registrierung beim jeweiligen
Anbieter — das ist an deinen persönlichen Account gebunden, das kann
niemand für dich erledigen. Ohne diese Schritte zeigt das
"INTEGRATIONEN"-Panel einfach "NICHT KONFIGURIERT" an, alles andere im
Dashboard funktioniert trotzdem normal weiter.

1. `cp .env.example .env` im Projektordner.
2. Die gewünschten Werte unten eintragen (nicht alle sind Pflicht — nur
   konfigurierte Integrationen werden aktiv).
3. Server neu starten (`npm start` bzw. bei Live-Deployment `sudo
   systemctl restart fraiday`).

### Google (Gmail, Kalender, Kontakte)

1. [console.cloud.google.com](https://console.cloud.google.com) → neues
   Projekt anlegen (oder ein bestehendes wählen).
2. **APIs & Dienste → Bibliothek**: aktivieren für "Gmail API",
   "Google Calendar API", "People API".
3. **APIs & Dienste → OAuth-Zustimmungsbildschirm**: Typ "Extern" wählen,
   Pflichtfelder ausfüllen, unter "Testnutzer" deine eigene
   Google-Adresse hinzufügen (im Testmodus reicht das, keine
   Google-Prüfung nötig für den persönlichen Gebrauch).
4. **APIs & Dienste → Anmeldedaten → Anmeldedaten erstellen → OAuth-
   Client-ID**, Typ "Webanwendung". Als "Autorisierte Weiterleitungs-
   URI" genau eintragen: `https://DEINE-DOMAIN/auth/google/callback`
   (bzw. `http://localhost:3000/auth/google/callback` für lokale Tests).
5. Client-ID und Client-Secret in die `.env` eintragen
   (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) sowie `BASE_URL` auf
   deine echte Domain setzen.
6. Im Dashboard unter "INTEGRATIONEN" auf "VERBINDEN" bei Google klicken
   und den Google-Login/Zustimmungsdialog durchlaufen.

### Spotify

1. [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
   → "Create app".
2. Als Redirect URI eintragen: `https://DEINE-DOMAIN/auth/spotify/callback`
   (bzw. `http://localhost:3000/auth/spotify/callback` lokal).
3. Client-ID und Client-Secret in die `.env` eintragen
   (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`).
4. Wiedergabesteuerung funktioniert nur, wenn Spotify gerade auf einem
   deiner Geräte aktiv geöffnet ist (Spotify Connect).

### YouTube

1. Im selben Google-Cloud-Projekt wie oben: **APIs & Dienste →
   Bibliothek** → "YouTube Data API v3" aktivieren.
2. **APIs & Dienste → Anmeldedaten → Anmeldedaten erstellen → API-
   Schlüssel**.
3. Den Schlüssel als `YOUTUBE_API_KEY` in die `.env` eintragen.

Die Zugangs-Tokens (nach dem Verbinden) liegen ebenfalls in
`server/data/brain.db` und werden bei Bedarf automatisch erneuert.
"TRENNEN" im Dashboard löscht sie wieder.

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