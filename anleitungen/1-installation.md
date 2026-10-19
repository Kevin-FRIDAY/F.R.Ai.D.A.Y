# 1. Installation auf dem Mac

## Vorher

- Node.js (LTS) von [nodejs.org](https://nodejs.org/de/download) installieren.
- Claude-API-Schlüssel auf [console.anthropic.com](https://console.anthropic.com) erstellen. Tipp: Dort unter "Limits" ein Monatslimit setzen, dann gibt es keine Überraschungen.

## Installieren

1. Den Ordner `friday-paket` irgendwohin legen (z. B. Downloads).
2. Rechtsklick auf **Friday installieren.command**, dann **Öffnen**, dann nochmal **Öffnen** bestätigen.
3. Der Installer:
   - kopiert alles nach `~/Friday` (dein Benutzerordner),
   - installiert die Bausteine,
   - fragt nach API-Schlüssel, Namen, Stadt und einem Passwort (mind. 10 Zeichen),
   - richtet den Autostart ein und öffnet das Dashboard unter `http://127.0.0.1:3000`.
4. Im Dashboard mit deinem Passwort anmelden. Fertig.

Wenn macOS meldet, dass die Datei "von einem nicht verifizierten Entwickler" stammt: Systemeinstellungen > Datenschutz & Sicherheit > ganz unten "Trotzdem öffnen".

## Mac-Rechte

Beim ersten Mal, wenn Friday etwas am Mac macht, fragt macOS nach Erlaubnis. Immer **Erlauben** klicken:

| Was Friday macht | Welches Recht | Wo |
|---|---|---|
| Musik steuern, Mitteilungen | Automation für "Music"/"Spotify"/"System Events" | erscheint als Abfrage |
| Mac sperren | Bedienungshilfen für "node" | Systemeinstellungen > Datenschutz & Sicherheit > Bedienungshilfen |
| Bildschirm ansehen | Bildschirmaufnahme für "node" | Systemeinstellungen > Datenschutz & Sicherheit > Bildschirm- & Systemaudioaufnahme |

Nach dem Erlauben einmal **Friday starten.command** öffnen.

## Mac wach halten

Friday hält den Mac automatisch wach, solange er am Strom ist und der Deckel offen ist. Für ein MacBook mit zugeklapptem Deckel brauchst du einen externen Bildschirm. Zusätzlich empfohlen:

- Systemeinstellungen > Energie (bzw. Batterie > Optionen): **"Automatischen Ruhezustand verhindern, wenn das Display ausgeschaltet ist"** einschalten.

## Einstellungen ändern

Alle Einstellungen stehen in `~/Friday/server/.env` (mit TextEdit öffnen, im Finder mit Cmd+Shift+Punkt versteckte Dateien zeigen). Nach jeder Änderung **Friday starten.command** öffnen.

- Neues Passwort: Terminal öffnen, `cd ~/Friday/server && npm run passwort`, dann neu starten.
- Anderes Claude-Modell: `CLAUDE_MODEL=` ändern. Schneller und günstiger antwortet z. B. `claude-sonnet-5-5` oder `claude-haiku-5-5`.

## Update

Neues Paket herunterladen und wieder **Friday installieren.command** öffnen. Einstellungen, Passwort und Gedächtnis bleiben erhalten.
