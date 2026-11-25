# 77 · Mark XVII: Steuerzentrale für dein Zuhause (v1.189.0)

Alles läuft ohne Claude und kostet nichts. Du findest es im **Gehirn-Cockpit → Reiter 🎛 Steuerung**.
Für Räume, Strom und Gerätefehler braucht Friday **Home Assistant** (Werkzeug-Menü → Verbindungen). Fernseher, Alexa und Hue gehen auch ohne.

## 🎛 Universal Control
- Alle Geräte aus Home Assistant, sortiert nach Räumen. Den Raum erkennt Friday am Namen, z. B. „Schlafzimmer Licht“.
- Lichter und Steckdosen schaltest du mit einem Schalter. Bei Heizungen gibt es − und ＋ in halben Grad.
- Dazu kommen Fernseher (An, Aus, Lauter, Leiser, Stumm), Hue-Räume und Alexa-Routinen, wenn sie eingerichtet sind.
- **Schlösser zeigt Friday nur an und schaltet sie nie.**

## 🎬 Eigene Szenen
- Stell Licht und Geräte so ein, wie du es magst. Gib einen Namen ein und tipp auf **„Jetzigen Zustand speichern“**. Bei einem Raum gilt die Szene nur für diesen Raum.
- Starten geht mit **Start** oder per Sprache.
- Friday schlägt Szenen vor, wenn du an mindestens 3 Tagen dieselben Geräte innerhalb von 10 Minuten zusammen einschaltest.
- Sag: **„Friday, speicher das als Szene Filmabend“** und später **„Friday, Szene Filmabend“**.
- Szenen aus Home Assistant und Hue funktionieren weiter wie bisher.

## ⚡ Strom
- Zeigt, wie viel Watt gerade gebraucht werden, die größten Verbraucher, den Verbrauch heute in kWh und Euro und die Grundlast (Standby) mit den Kosten im Jahr.
- Gibt es einen Hauszähler, nimmt Friday ihn als Gesamtwert und zählt die einzelnen Geräte nicht doppelt.
- Den Strompreis stellst du selbst ein (Standard 35 Cent/kWh).
- Ohne Strom-Sensoren steht dort, was fehlt, zum Beispiel eine Mess-Steckdose (ab ca. 15 €) oder ein Lesekopf am Zähler.
- Sag: **„Friday, wie viel Strom verbrauche ich?“**

## 🛋 Raum-Profile
- Pro Raum siehst du Temperatur, Luftfeuchte, CO₂ und wie viele Lichter an sind.
- Für jeden Raum stellst du eine Wunschtemperatur ein. Ist es 1,5 Grad kälter, schlägt Friday vor, die Heizung höher zu stellen. Bei hoher Feuchte oder viel CO₂ rät Friday zum Lüften.

## ⚠️ Gerätefehler
- Geräte, die nicht erreichbar sind, und schwache Batterien stehen oben.
- Ist ein Gerät länger als eine Stunde weg, kommt eine Mitteilung, nur als Text.
- Sag: **„Friday, gibt es Gerätefehler?“**

## Ehrlich getestet
- **Mit einem nachgebauten Home Assistant geprüft:** Schalten, Heizung, Szenen speichern, starten und löschen, Strom, Raum-Profile, Gerätefehler und Sprachbefehle. Das ist eine Simulation. An deinem echten Home Assistant ist es noch nicht geprüft.
- **Funktionstest „Zuhause“:** prüft die Rechnungen echt. Mit Home Assistant liest er außerdem deine echten Geräte, ohne Home Assistant wird er übersprungen.
- Fernseher, Hue und Alexa nutzen die bestehenden Bausteine. In diesem Paket wurden sie nicht neu getestet.
