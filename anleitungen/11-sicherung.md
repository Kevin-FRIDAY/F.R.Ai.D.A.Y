# 11. Sicherung (Backup)

Friday sichert sich selbst. Falls mal etwas schiefgeht (kaputtes Update, Datei aus Versehen gelöscht, falsche Einstellung), holst du mit einem Klick den alten Stand zurück.

## Was gesichert wird

| Was | Datei |
|---|---|
| Einstellungen und alle Schlüssel | `server/.env`, `mac-agent/.env` |
| Gedächtnis, Aufgaben, Einkaufsliste, Erinnerungen, Verlauf | `server/data/` |
| Deine eigenen Protokolle | `server/eigene-protokolle.json` |
| Das Programm selbst (nur bei Sicherungen vor Updates und von Hand) | `programm/` |

Alles landet im Ordner **`~/Friday-Backups`** auf deinem Mac, jede Sicherung in einem eigenen Ordner mit Datum und Uhrzeit. Nichts davon geht zu GitHub.

## Wann Friday sichert

- **Jeden Tag automatisch** (wenn die letzte Sicherung älter als 24 Stunden ist).
- **Vor jedem Update**, inklusive der alten Programmversion. So kommst du immer auf die Version davor zurück.
- **Von Hand**, wann du willst.

Friday behält die letzten 30 Sicherungen (etwa ein Monat). Die Programmkopie steckt nur in den neuesten drei, damit der Ordner klein bleibt.

## Im Dashboard

- Rechts im Panel **Sicherung** siehst du, wann zuletzt gesichert wurde. Grünes Schild = alles gut, rotes Schild = länger als eine Woche keine Sicherung.
- **Jetzt sichern** macht sofort eine Sicherung.
- **Verwalten** (oder oben in der Leiste auf "Sicherung" tippen) zeigt alle Sicherungen. Bei jeder steht **Zurückholen**.

Beim Zurückholen fragt Friday, ob auch die alte Programmversion zurück soll. Bevor sie etwas überschreibt, sichert sie den jetzigen Stand noch einmal ("Vor dem Zurückholen"). Danach startet sie neu und das Dashboard lädt sich von selbst.

## Wenn Friday gar nicht mehr startet

Im Ordner `~/Friday` per Doppelklick:

- **Friday wiederherstellen.command**: zeigt alle Sicherungen mit Nummer. Nummer eintippen, Enter, bestätigen. Fertig.
- **Friday sichern.command**: macht sofort eine Sicherung (mit Programm).

Was dabei passiert ist, steht in `~/Library/Logs/Friday/wiederherstellung.log`.

## Noch sicherer: Kopie außerhalb des Macs

`~/Friday-Backups` liegt auf dem Mac. Geht der Mac kaputt, ist auch die Sicherung weg. Zwei einfache Wege:

1. **Time Machine** einschalten (Systemeinstellungen > Allgemein > Time Machine). Die sichert `~/Friday-Backups` automatisch mit.
2. Oder den Sicherungsordner in die iCloud legen. Dazu in `server/.env` eintragen:

   ```
   BACKUP_DIR=~/Library/Mobile Documents/com~apple~CloudDocs/Friday-Backups
   ```

   Danach Friday neu starten. Achtung: Dann liegen auch deine Schlüssel in deiner iCloud. Schütze deinen Apple-Account mit Zwei-Faktor-Anmeldung.

Wie viele Sicherungen Friday behält, stellst du mit `BACKUP_KEEP=30` in `server/.env` ein.
