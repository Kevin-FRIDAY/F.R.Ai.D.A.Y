# Zuhause und Leben: Smart Home Intelligence, Umgebung, Lebensmanager (ab v1.182.0, Mark XII)

Ansehen: **Werkzeug-Menü → Gehirn-Cockpit → 🏠 Zuhause** und **🧭 Leben**. Alles läuft ohne Claude und kostet nichts.

## 🏠 Smart Home Intelligence
Voraussetzung: Home Assistant ist eingerichtet (Werkzeug-Menü → Verbindungen → Home Assistant).

- Friday schaut alle 5 Minuten, welche Lichter, Steckdosen und Rollos an oder aus sind.
- Wiederholt sich etwas an mindestens 4 Tagen ungefähr zur selben Zeit, macht Friday einen Vorschlag. Beispiel: „Werktags schaltest du die Kaffeemaschine meist gegen 06:55 ein. Soll ich das automatisch machen?“
- Tippst du **„Ja, automatisch“**, wird daraus eine normale Automation. Du findest sie unter Automationen und kannst sie dort ausschalten.
- Ohne dein „Ja“ schaltet Friday nichts. Schlösser schaltet Friday nie automatisch.
- Hinweise aus Sensoren: zu kalt, zu warm, Luft zu feucht, CO₂ zu hoch, Batterie fast leer, Fenster offen während die Heizung läuft.

Per Sprache: „Friday, was hast du über mein Zuhause gelernt?“

## 🌡 Umgebung
- Raumklima aus deinen Home-Assistant-Sensoren (Temperatur, Luftfeuchte, CO₂, Helligkeit).
- Wetter draußen zum Vergleich, zum Beispiel: „Draußen ist es kühler, jetzt lüften.“
- **🎙 Geräusch messen:** Dein eigenes Gerät hört 3 Sekunden lang nur auf die Lautstärke. Es wird nichts aufgenommen, nur eine Zahl gespeichert. Der Wert ist ungefähr, weil Mikrofone nicht geeicht sind.

Per Sprache: „Friday, wie ist die Umgebung?“

## 🧭 Lebensmanager
Ein Überblick aus allem, was Friday schon weiß: Termine, Aufgaben, Gewohnheiten, Schlaf, Ziele, Geburtstage, Kühlschrank und deine Konten (nur ansehen).

- **Balance (0–100):** Durchschnitt der Bereiche mit Daten. Erst ab 2 Bereichen gibt es eine Zahl.
- **Heute wichtig:** Termine, die erste offene Aufgabe, Geburtstage.
- **Tipps:** zum Beispiel „Serie in Gefahr“, „Du schläfst zu wenig“ oder „Geschenk schon da?“.

Per Sprache: „Friday, wie läuft mein Leben?“

Je mehr du nutzt (Gewohnheiten, „gute Nacht“ und „guten Morgen“, Aufgaben, Ziele), desto genauer wird der Überblick. Friday bewegt nie Geld.
