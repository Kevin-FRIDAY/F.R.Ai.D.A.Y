# F.R.Ai.D.A.Y

Ein JARVIS/F.R.I.D.A.Y-artiges HUD-Dashboard mit einem eingebauten
**Neuronalen Gehirn** – einem echten Backend (Node.js/Express + SQLite),
das beliebige Dateneinträge und eigene Funktionen dauerhaft speichert.

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

Die Daten liegen in `server/data/brain.db` (SQLite, wird beim ersten
Start automatisch angelegt und ist nicht Teil des Repos).