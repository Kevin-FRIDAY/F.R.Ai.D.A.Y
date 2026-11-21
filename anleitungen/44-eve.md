# 44 · Eve – die Testversion von Friday (v1.137.0, eigene Daten ab v1.138.0)

Eve ist dieselbe Friday, nur im **Test-Modus**. Alles Neue kommt zuerst zu Eve. Erst wenn es dir gefällt, gibst du es für Friday frei.

## Umschalten
Oben im Dashboard steht der Knopf **FRIDAY ⇄ EVE**. Ein Tipp wechselt.
- **Friday** (dein gewohntes Aussehen) = fertige Version.
- **Eve** (eisblau, Abzeichen „EVE · TESTVERSION“) = Testversion.
- Der Umschalter gilt nur für das Gerät, auf dem du tippst. So kann das iPhone auf Eve stehen und der Mac auf Friday.

## Draht zu Claude (Chatfenster)
In Eve wird aus dem **Schnellzugriff** die **Eve-Werkbank** mit dem Chatfenster „Draht zu Claude“.
1. Schreib rein, was neu oder anders werden soll, und tippe ➤. Eve sammelt es.
2. Tippe **🚀 An Claude schicken**. Alle gesammelten Wünsche gehen als ein Auftrag (GitHub-Issue mit dem Etikett `eve-wunsch`) an dein Friday-Repo.
3. Sag im Claude-Projekt „FRIDAY AI AKTUELL“: **„Hol meine Eve-Wünsche“**. Claude liest den Auftrag und baut es.

Ehrlich gesagt: Ein Fenster in der App kann nicht von selbst mit Claude sprechen. Der Auftrag liegt sicher im Repo, bis Claude ihn abholt.

### Ohne GitHub-Schlüssel: Kopieren
Tippe **📋 Kopieren**. Der Text liegt in der Zwischenablage. Öffne Claude, füge ihn im Projekt ein, fertig.

### GitHub-Schlüssel fürs direkte Schicken
Der Schlüssel aus „Einstellungen → Immer aktuell“ wird benutzt. Er braucht zusätzlich das Recht **Issues: Read and write**:
github.com → Settings → Developer settings → Fine-grained tokens → deinen Friday-Schlüssel öffnen → Repository permissions → **Issues → Read and write** → Update.
Hast du noch keinen Schlüssel: neuen fine-grained Schlüssel nur für das Friday-Repo anlegen mit **Contents: Read-only** und **Issues: Read and write**, dann in Friday unter Einstellungen → Immer aktuell eintragen.

## ✎ Ändern unter jedem Bereich
Öffnest du in Eve einen Bereich (z. B. **Weltgeschehen**), erscheint unten der Knopf **✎ Ändern: Weltgeschehen**.
Tippen, Wunsch reinschreiben, **＋ Sammeln**. Der Bereich wird automatisch dazugeschrieben. Mit **🚀 Alles an Claude** geht alles direkt raus.

## Das Schloss
Neue Funktionen stehen in `server/eve-funktionen.json`.
- In **Eve** sind sie offen und tragen das Abzeichen **TEST**.
- In **Friday** sind sie grau mit 🔒. Ein Tipp sagt nur: „Noch im Test“.
- Gefällt dir etwas: in Eve auf **🔒 Tests** → **✓ In Friday freigeben**. Ab dann ist es auch in Friday offen. Zurücknehmen geht mit „Wieder sperren“.

Deine Freigaben und Wünsche liegen in `server/data/eve.json` und bleiben bei Updates erhalten.

## Eve hat eigene Daten (ab v1.138.0)
Eve läuft als eigener kleiner Server neben Friday (Friday startet ihn automatisch mit).
- Beim ersten Start kopiert Friday ihre Daten nach `server/data/eve-daten`. Ab dann sind es zwei getrennte Welten:
  Termine, Aufgaben, Einkaufsliste, Gedächtnis, Einstellungen, Logbuch … in Eve ändern **nichts** in Friday.
- Fotos, Spiele, Webseiten und Videos von Eve landen in `~/Friday-Eve/…`, nicht in Fridays Ordnern.
- Die Adresse bleibt gleich (auch auf dem iPhone über Tailscale). Der Umschalter sagt Friday, ob deine Anfragen an Eve gehen.
- Auch die Dashboard-Einstellungen (Farbe, Glow, Kopf-Stil …) sind pro Seite getrennt.

### Was Eve nur zum Schein macht
Alles, was in der echten Welt etwas auslöst, macht Eve **nicht**: Alexa, Fernseher, Licht (Hue), Home Assistant, Spotify,
Todoist, Notion, Apple-Kalender und -Erinnerungen, Anrufe und Nachrichten, Mails sortieren, Telegram und Push.
Eve antwortet dann „nur simuliert“ und schreibt ins Logbuch, was Friday an dieser Stelle getan hätte.
Außerdem macht nur Friday: Updates, Sicherungen, Wiederherstellen, Morgen-Briefing, Automationen und Herzschlag
(sonst liefe alles doppelt und kostet doppeltes Guthaben). Der Mac-Agent ist nur mit Friday verbunden.

### Eve zurücksetzen
🔒 Tests → **↺ Eve auf Friday-Stand zurücksetzen**. Eves Testdaten werden gelöscht, Eve ist wieder eine frische Kopie von Friday.
