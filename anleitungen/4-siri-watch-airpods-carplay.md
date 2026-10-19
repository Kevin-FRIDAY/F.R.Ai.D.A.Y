# 4. "Hey Siri, Friday": iPhone, Apple Watch, AirPods, CarPlay

Ein einziger Kurzbefehl macht Friday überall verfügbar, auch bei gesperrtem iPhone.

## Was du brauchst

- Deine Friday-Adresse ([Tailscale](2-tailscale.md)), z. B. `https://kevins-macbook.tail1234.ts.net`
- Deinen **Kurzbefehl-Schlüssel**: Im Dashboard unter Aktionen auf **Kurzbefehl-Schlüssel** tippen und kopieren. Er darf nur Fragen stellen und Gesundheitsdaten senden, sonst nichts.

## Kurzbefehl bauen (einmalig, ca. 5 Minuten)

App **Kurzbefehle** öffnen > **+** > oben den Namen auf **Friday** ändern. Dann diese drei Aktionen hinzufügen:

1. **Text diktieren**
   - Sprache: Deutsch
   - Zuhören beenden: Nach Pause
2. **Inhalte von URL abrufen**
   - URL: `https://DEINE-ADRESSE/api/siri`
   - Auf den Pfeil tippen und einstellen:
     - Methode: **POST**
     - Header hinzufügen: Schlüssel `Authorization`, Wert `Bearer DEIN-KURZBEFEHL-SCHLÜSSEL` (mit Leerzeichen nach Bearer)
     - Hauptteil der Anfrage: **JSON**, Feld hinzufügen: Typ **Text**, Schlüssel `text`, Wert: die Variable **Diktierter Text**
3. **Text sprechen**
   - Text: die Variable **Inhalte der URL**
   - Optional: Stimme auf eine deutsche Siri-Stimme stellen

Fertig. Jetzt testen: "Hey Siri, Friday", dann deine Frage.

## Überall nutzen

| Wo | Wie |
|---|---|
| iPhone gesperrt | "Hey Siri, Friday" |
| Action-Button (iPhone 15 Pro und neuer) | Einstellungen > Action-Button > Kurzbefehl > Friday |
| Apple Watch | Im Kurzbefehl unten auf (i) > **Auf Apple Watch anzeigen**. Dann "Hey Siri, Friday" an der Uhr oder als Komplikation aufs Zifferblatt. |
| AirPods | "Hey Siri, Friday" sagen, Friday antwortet ins Ohr. |
| CarPlay | "Hey Siri, Friday". Friday antwortet über die Autolautsprecher. |
| Mac | Der Kurzbefehl synchronisiert sich auch auf den Mac. |

Hinweise:
- Auf der Watch braucht der Kurzbefehl Internet über das iPhone in der Nähe oder WLAN. Mit dem iPhone in der Nähe läuft er über dessen Tailscale-Verbindung. Das habe ich nicht selbst ausprobiert; falls es an der Uhr nicht klappt, sag Bescheid.
- Für ein Gespräch über mehrere Fragen merkt sich Friday den Siri-Verlauf, du kannst also nachfragen ("Und morgen?").
