# Status-Ring um Fridays Kopf (ab v1.105.0)

Der Kreis um Fridays Kopf auf der Startseite zeigt dir mit einer Farbe, wie es ihr gerade geht.

| Farbe | Bedeutung |
|---|---|
| **Grün** | Friday spricht gerade. Hat immer Vorrang. |
| **Rot** | Etwas funktioniert nicht. |
| **Gelb** | Es gibt eine neue Info oder einen Hinweis. |
| **Keine Farbe** | Alles okay, der Ring sieht aus wie immer. |

Wenn der Ring rot oder gelb ist, steht unten im Kreis ein kleines Schild mit dem Grund.
Tippst du auf das Schild, öffnet Friday die passende Stelle (zum Beispiel das Update oder die Sicherungen).
Gelbe Hinweise kannst du mit **✕** ausblenden. Sie kommen erst wieder, wenn sich etwas ändert (zum Beispiel eine noch neuere Version).

## Wann wird der Ring rot?
- Der Friday-Server ist nicht erreichbar.
- Das Gerät hat kein Internet.
- Das Claude-Guthaben ist leer (Notstrom).
- Ein Update ist fehlgeschlagen.
- Ein Auftrag ist gerade wegen einer Verbindungsstörung gescheitert (bleibt 2 Minuten rot).

## Wann wird der Ring gelb?
- Ein Update ist verfügbar.
- Der Mac-Agent ist getrennt (Mac-Befehle gehen dann nicht).
- Sparmodus, weil das Guthaben knapp wird.
- Die letzte Sicherung ist älter als eine Woche (oder es gibt noch keine).
- Die ElevenLabs-Stimme pausiert (Friday spricht mit der Gerätestimme).

Gibt es Rot und Gelb gleichzeitig, zeigt der Ring Rot. Sobald Friday spricht, wird er grün und danach wieder rot, gelb oder farblos.

Beim Zuhören und Nachdenken bleibt der Ring in Fridays Orange, damit Gelb immer "Hinweis" bedeutet.
