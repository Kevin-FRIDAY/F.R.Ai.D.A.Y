# 74 · Mark XV: Friday entwickelt sich sicher weiter (v1.186.0)

Alles hier läuft auf deinem Mac und kostet nichts. Du findest es im **Gehirn-Cockpit → Reiter 🧪 Entwicklung** und **♻️ Recovery**.
Das Denk-Labor in der Zentrale bleibt, wie es ist („Friday, öffne das Labor“).

## 🏭 Skill Factory
Friday baut neue Befehle und Fähigkeiten aus 5 Vorlagen:
- **Feste Antwort**: ein Satz, immer dieselbe Antwort (z. B. Gäste-WLAN).
- **Zufalls-Antwort**: mehrere Antworten mit | getrennt, oder `{zufall:1-6}` für einen Würfel.
- **Satz mit Lücke**: `sag * dass ich später komme` → in der Antwort steht `{1}` für das eingefangene Wort.
- **Weitergabe an Friday**: ein kurzer Satz wird zu einem langen Auftrag ans Gehirn (kostet etwas Guthaben).
- **Fähigkeit (Anleitung)**: eine Anleitung, die Friday bekommt, wenn bestimmte Wörter fallen.

So geht es:
1. Vorlage wählen, Felder ausfüllen, **Beispiele zum Testen** eintragen.
2. **„In der Sandbox testen“**: Friday prüft echt, ob alles passt (Kompatibilität, Sicherheit, Doppelungen, jedes Beispiel). Dabei wird noch nichts aktiv.
3. Nur wenn alles grün ist, erscheint **„Aktivieren“**. Direkt davor testet Friday noch einmal.

- Sag: **„Friday, öffne das Entwicklungslabor“** oder **„zeig mir die Skill Factory“**.

## 🔬 Code-Analyse
Friday liest ihren eigenen Code: Größe der Dateien, Syntax und Importe aller Server-Dateien, ungenutzte Teile, offene TODOs. Daraus gibt es eine Note von 0 bis 100 und Vorschläge.
Friday ändert dabei nichts am Code. Verbesserungen kommen weiter als getestetes Update.
- Sag: **„Friday, prüf deinen Code“**.
- Jede Nacht um 4:15 Uhr automatisch. Eine Mitteilung (nur Text) gibt es nur, wenn etwas kaputt ist.

## 🐞 Fehler-Werkstatt
Fehler aus dem Logbuch der letzten 7 Tage werden gruppiert und gezählt. Zu jedem gibt es einen festen Reparatur-Tipp.
**„Nachstellen“** probiert den Fehler noch einmal, aber nur auf ungefährlichen Wegen: einen lesenden Agenten neu losschicken oder die Funktionstests laufen lassen.
Wenn Ollama läuft, kommt ein kostenloser KI-Reparatur-Tipp dazu.

## 📜 Entwicklungsprotokoll
Was im Labor passiert (Tests, Aktivierungen, Analysen, Wiederherstellungen) steht mit Zeit im Protokoll. Darunter steht die Versionsgeschichte aus allen Anleitungen.

## ♻️ Recovery Brain
- Prüft, ob alle Daten-Dateien lesbar sind.
- Ist eine beschädigt, holt **„Zurückholen“** die letzte lesbare Fassung aus dem Änderungs-Protokoll. Die kaputte Datei bleibt als Kopie daneben liegen.
- Schlüssel-Dateien (Verbindungen, GitHub, Alexa) holt Friday nie selbst zurück.
- Zeigt die letzte Sicherung, ob ein Update zurückgerollt wurde, und dass das Notfall-Gehirn (Offline-Befehle) bereit ist.
- Sag: **„Friday, sind meine Daten ok?“**

## Ehrlich getestet
- Skill Factory: echtes Modul „Würfel“ gebaut, ein falsches Beispiel fiel durch, nach Korrektur aktiviert, Friday antwortete im Chat „Du hast eine 2 gewürfelt.“
- Code-Analyse: echter Lauf über 278 Dateien, Note 82, Syntax fehlerfrei.
- Recovery: eine Test-Datei absichtlich kaputt gemacht, erkannt und echt zurückgeholt.
- Fehler-Werkstatt: echte Logbuch-Fehler gruppiert. Der Ollama-Tipp wurde nicht geprüft, weil im Test keine KI läuft.
- Funktionstest: „Entwicklungs-Labor (Sandbox-Tests, Daten lesbar)“.
