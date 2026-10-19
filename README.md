# F.R.Ai.D.A.Y

Deine persönliche KI im Iron-Man-Stil. Läuft auf deinem Mac, du benutzt sie auf Mac, iPhone, Apple Watch, mit AirPods, im Auto und per Telegram.

## In 3 Schritten startklar

1. **Node.js installieren:** Auf [nodejs.org](https://nodejs.org/de/download) die LTS-Version laden und installieren.
2. **Claude-API-Schlüssel holen:** Auf [console.anthropic.com](https://console.anthropic.com) unter "API Keys" einen Schlüssel erstellen. Den gibst du gleich nur im Installer ein, nirgendwo sonst.
3. **Doppelklick auf `Friday installieren.command`.** Beim ersten Mal: Rechtsklick, dann "Öffnen" (macOS fragt einmal nach). Der Installer fragt nach Schlüssel, Namen, Stadt und Passwort, richtet den Autostart ein und öffnet das Dashboard.

Danach startet Friday jedes Mal automatisch, wenn du dich am Mac anmeldest.

## Was Friday kann

| Bereich | Was | Anleitung |
|---|---|---|
| Reden | Sprechen über den Arc-Reactor, "Friday" als Weckwort, Vorlesen | [Mac und iPhone](anleitungen/3-iphone-und-mac-app.md) |
| Gedächtnis | Merkt sich, was du ihr erzählst ("Merk dir ...") | eingebaut |
| Wissen | Websuche, Nachrichten, Wetter | eingebaut |
| Erinnerungen | "Erinner mich in 20 Minuten an ..." mit Push aufs Handy | [Push & Briefing](anleitungen/6-telegram-push-briefing.md) |
| Mac steuern | Apps, Musik, Lautstärke, Dateien suchen, sperren, Dark Mode | [Mac-Rechte](anleitungen/1-installation.md#mac-rechte) |
| Friday sieht | Fotos erkennen, auf deinen Mac-Bildschirm schauen | eingebaut |
| Protokolle | "Starte Protokoll Feierabend" | [Protokolle & Smart Home](anleitungen/8-protokolle-smart-home.md) |
| Übersetzer | Live-Übersetzen per Schalter im Dashboard | eingebaut |
| Siri, Watch, AirPods, CarPlay | "Hey Siri, Friday" | [Siri & Co.](anleitungen/4-siri-watch-airpods-carplay.md) |
| Gesundheit | Schlaf und Schritte im Morgenbriefing | [Gesundheit](anleitungen/5-gesundheit.md) |
| Telegram | Friday per Nachricht oder Foto | [Telegram](anleitungen/6-telegram-push-briefing.md) |
| Stimme | Echte Friday-Stimme über ElevenLabs | [Stimme](anleitungen/7-stimme.md) |
| Smart Home | Licht und Geräte über Home Assistant | [Smart Home](anleitungen/8-protokolle-smart-home.md) |
| Updates | Roter Knopf = neue Version, grüner Knopf = aktuell | [Updates](anleitungen/10-updates.md) |

## Ordner

```
Friday/
├── Friday installieren.command   ← hier starten
├── Friday starten.command        ← Neustart nach Änderungen
├── Friday stoppen.command
├── Friday aktualisieren.command  ← neue Version holen (wie der Update-Knopf)
├── Friday deinstallieren.command
├── server/       Fridays Gehirn (Einstellungen in server/.env, eigene Protokolle in server/eigene-protokolle.json)
├── dashboard/    Die App für Mac und iPhone
├── mac-agent/    Fridays Hände auf dem Mac
└── anleitungen/  Schritt-für-Schritt-Hilfen
```

## Wichtig

- Die Datei `server/.env` enthält deine Schlüssel. Nie in einen Chat, eine Mail oder auf GitHub.
- Friday ist nur erreichbar, wenn dein Mac an ist und nicht schläft. Siehe [Installation](anleitungen/1-installation.md#mac-wach-halten).
- Kosten: Jede Frage an Friday kostet ein paar Bruchteile eines Cents bis wenige Cent an Claude-API-Gebühren. Im Anthropic-Konto kannst du ein monatliches Limit setzen.
- Probleme? [Hilfe & Sicherheit](anleitungen/9-hilfe-und-sicherheit.md)
