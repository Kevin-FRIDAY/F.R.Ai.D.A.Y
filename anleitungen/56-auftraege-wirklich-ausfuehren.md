# Friday führt Aufträge wirklich aus (v1.161.0)

## Was war das Problem?
Manchmal hat Friday „Mache ich, Boss“ gesagt und dann nichts getan. Der Grund: Die KI hat nur mit Text
geantwortet, ohne ein Werkzeug zu benutzen. Nach der Antwort passiert aber nichts mehr. Für Excel-Tabellen
gab es außerdem gar kein Werkzeug.

## Was ist jetzt anders?
**Auftrags-Kern:** Friday erkennt, ob du ihr einen Auftrag gibst (Tabelle, Nachricht, Dokument, Erinnerung,
Eintrag in eine Liste). Danach prüft sie, ob das passende Werkzeug wirklich geklappt hat.

- Nur angekündigt? Friday hakt bei sich selbst nach (bis zu zweimal) und erledigt es dann.
- Fehler? Friday sagt ehrlich, was nicht geklappt hat, und was du tun kannst.
- Ein „Erledigt“ ohne echte Aktion kommt nie mehr bei dir an.
- Der Arbeits-Balken oben wird rot, wenn ein Auftrag nicht geklappt hat.

## Excel-Tabellen
Sag zum Beispiel:
- „Friday, bau mir eine Excel-Tabelle für meine Ausgaben“
- „Erstelle eine Tabelle mit Name, Telefon und Geburtstag“
- „Mach mir einen Trainingsplan als Excel“

Friday erstellt eine **echte .xlsx-Datei** (Excel, Numbers, LibreOffice):
- gespeichert in `~/Friday-Archiv/Tabellen/<Jahr>/<Monat>/`
- geht am Mac sofort auf
- im Dashboard mit Vorschau, Knopf **⬇ Excel herunterladen** (auch am iPhone) und **💻 Am Mac öffnen**
- Kopfzeile orange, fest beim Scrollen, Filter, Summen-Formeln

Ohne Claude (Guthaben leer, Kosten-Deckel, lokales Gehirn) baut Friday eine passende Vorlage selbst
(Haushaltsbuch, Einkaufsliste, Trainingsplan, Wochenplan, Arbeitszeiten, Kontakte, Aufgaben).

## Nachrichten an deine Frau
Friday versteht jetzt mehr Sätze, zum Beispiel:
- „Schreib meiner Frau, dass ich später komme“
- „Kannst du meiner Frau schreiben, dass ich Pizza mitbringe?“
- „Meiner Frau eine Nachricht schicken: Ich bin gleich da“

„Schreib mir einen Brief an den Vermieter“ wird nicht mehr aus Versehen als Nachricht an dich selbst verstanden.

**Wichtig:** Damit die Nachricht wirklich rausgeht, braucht Friday
1. die Nummer deiner Frau: Werkzeug-Menü → Verbindungen → Anrufe & Nachrichten,
2. den verbundenen Mac (Nachrichten-App mit deinem iMessage),
3. einmal die macOS-Erlaubnis: Systemeinstellungen → Datenschutz & Sicherheit → Automation → „Nachrichten“ an.

Fehlt etwas davon, sagt Friday genau das, statt so zu tun, als wäre es verschickt.
