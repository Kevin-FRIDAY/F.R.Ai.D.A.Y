# 5. Gesundheit: Schlaf und Schritte für Friday

Apple lässt nur Apps auf dem iPhone direkt an Health-Daten. Darum schickt ein Kurzbefehl einmal am Morgen eine kleine Zusammenfassung an Friday. Nur das, was du einstellst, und nur an deinen eigenen Mac.

## Kurzbefehl "Friday Gesundheit"

Kurzbefehle-App > **+** > Name **Friday Gesundheit**:

1. **Health-Proben suchen** — Typ: **Schritte**, Filter "Startdatum ist in den letzten 1 Tagen".
2. **Statistik berechnen** (bzw. "Summe berechnen") für die gefundenen Schritte.
3. **Health-Proben suchen** — Typ: **Schlafanalyse**, in den letzten 1 Tagen.
4. **Statistik berechnen** — Summe der Dauer in **Stunden**.
5. **Health-Proben suchen** — Typ: **Ruhepuls**, Neueste, Limit 1.
6. **Inhalte von URL abrufen**
   - URL: `https://DEINE-ADRESSE/api/health`
   - Methode **POST**, Header `Authorization` = `Bearer DEIN-KURZBEFEHL-SCHLÜSSEL`
   - Hauptteil **JSON** mit drei Feldern (Typ Zahl):
     - `steps` = Ergebnis aus Schritt 2
     - `sleepHours` = Ergebnis aus Schritt 4
     - `restingHeartRate` = Wert aus Schritt 5

Die Namen der Health-Aktionen heißen je nach iOS-Version leicht anders. Wichtig sind nur die drei Zahlen am Ende.

## Automatisch jeden Morgen

Kurzbefehle > **Automation** > **+** > **Tageszeit** > z. B. 6:50 Uhr, täglich > **Sofort ausführen** > Kurzbefehl **Friday Gesundheit**.

Stell die Zeit ein paar Minuten vor dein Morgenbriefing (Standard 7:00, siehe [Briefing](6-telegram-push-briefing.md)). Dann sagt Friday z. B. "Du hast sieben Stunden geschlafen, Boss."

Fragen kannst du jederzeit: "Wie habe ich geschlafen?"
