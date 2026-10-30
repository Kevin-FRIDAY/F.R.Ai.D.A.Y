# 10. Updates

Friday kann sich selbst aktualisieren. Deine Einstellungen, dein Passwort, ihr Gedächtnis, deine Erinnerungen und deine eigenen Protokolle bleiben dabei immer erhalten.

## Der Update-Knopf

Im Dashboard unter **Aktionen** sitzt der Update-Knopf:

| Farbe | Bedeutung |
|---|---|
| 🔴 Rot, pulsiert: "Update auf 1.2.0" | Eine neue Version ist da. Antippen, bestätigen, fertig. |
| 🟢 Grün: "Aktuell · 1.1.0" | Friday ist auf dem neuesten Stand. |
| ⚪ Grau: "Updates prüfen" | Friday konnte nicht nachsehen (kein Internet, oder auf GitHub liegt noch nichts). |

Nach dem Antippen lädt Friday die neue Version, sichert die alte, installiert die neue und startet neu. Das Dashboard lädt sich danach von selbst neu.

Friday schaut außerdem zweimal am Tag selbst nach und schickt dir eine Push- oder Telegram-Nachricht, wenn es etwas Neues gibt. Du kannst sie auch einfach fragen: **"Friday, gibt es ein Update?"**

Ohne Dashboard geht es mit Doppelklick auf **Friday aktualisieren.command** im Ordner `~/Friday`.

## Woher die Updates kommen

Friday holt neue Versionen aus deinem GitHub-Repo **Kevin-FRIDAY/F.R.Ai.D.A.Y** (Zweig `main`). Dort muss der Inhalt des Friday-Pakets liegen, also die Ordner `server`, `dashboard`, `mac-agent`, `anleitungen` und die Datei `VERSION` direkt auf der obersten Ebene.

### Einmalig: Friday auf GitHub hochladen

1. Die Datei **friday-paket.zip** entpacken (nicht den Ordner `~/Friday` nehmen, darin liegen deine Schlüssel).
2. Auf github.com dein Repo **F.R.Ai.D.A.Y** öffnen.
3. **Add file** > **Upload files** und den *Inhalt* des entpackten Ordners `friday-paket` ins Fenster ziehen.
4. Unten **Commit changes** drücken.

Danach wird der Knopf grün.

### Neue Version

Wenn ich Friday verbessere, bekommst du ein neues Paket mit höherer Nummer in `VERSION`. Das lädst du wie oben auf GitHub hoch. Kurz danach wird der Knopf rot.

## Sicherheit

- In `friday-paket.zip` sind keine Schlüssel. Die `server/.env` bleibt nur auf deinem Mac.
- Wer in dein GitHub-Repo schreiben darf, bestimmt, was Friday beim nächsten Update installiert. Schütze dein GitHub-Konto deshalb mit Zwei-Faktor-Anmeldung.
- Ein anderes Repo stellst du in `server/.env` mit `UPDATE_REPO=Besitzer/Name` und `UPDATE_BRANCH=main` ein.

## Wenn ein Update schiefgeht

- Lassen sich die Bausteine nicht installieren, stellt Friday die alte Version automatisch wieder her.
- Vor jedem Update legt Friday eine Sicherung in `~/Friday-Backups` an, mit Daten, Schlüsseln und der alten Programmversion. Zurückholen geht im Dashboard unter **Sicherungen** oder mit **Friday wiederherstellen.command**. Siehe [Sicherung](11-sicherung.md).
- Die komplette alte Version liegt zusätzlich in `~/Friday-Sicherung`.
- Was beim Update passiert ist, steht in `~/Library/Logs/Friday/update.log`.
