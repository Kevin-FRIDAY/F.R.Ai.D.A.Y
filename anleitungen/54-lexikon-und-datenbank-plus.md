# Fridays Lexikon + größere Datenbank (v1.159.0)

Friday weiß jetzt viel mehr, **ohne Claude, ohne Guthaben und ohne Internet**.

## Das Lexikon (eingebautes Wissen)

Über **1.500 Einträge in 22 Bereichen**:

| Bereich | Einträge |
|---|---|
| ⚗️ Chemische Elemente (alle 118) | 118 |
| 🗺️ Länder der Welt (Hauptstadt, Währung, Kontinent) | 197 |
| 👤 Berühmte Menschen | 127 |
| 🔤 Abkürzungen | 111 |
| ✨ „Wusstest du?“-Fakten | 105 |
| 💻 Technik, Computer & KI | 99 |
| 💡 Erfindungen | 93 |
| 📜 Geschichte mit Jahreszahlen | 90 |
| 🌍 Erde & Rekorde | 73 |
| 🪐 Weltraum | 64 |
| 🏙️ Deutsche Städte | 64 |
| 🐾 Tiere | 61 |
| 🔬 Natur & Wissenschaft | 59 |
| 💶 Geld & Wirtschaft | 52 |
| 🏠 Alltag & Recht | 52 |
| ❤️ Körper & Gesundheit | 48 |
| 🍳 Kochen & Küche | 39 |
| ⌘ Mac- & iPhone-Tipps | 32 |
| ♈ Sternzeichen & Kalender | 31 |
| ⚽ Sport | 26 |
| 🚨 Notfall & wichtige Nummern | 17 |
| 🇩🇪 Bundesländer | 16 |

### So fragst du

- „Friday, **was ist** ein ETF?“ · „Was ist eine Wärmepumpe?“ · „Erklär mir Photosynthese“
- „**Wer war** Marie Curie?“ · „Wer ist Tony Stark?“
- „**Wer hat** das Telefon **erfunden**?“
- „**Was passierte 1989?**“ · „Wann war der Mauerfall?“
- „**Hauptstadt von** Bayern“ · „Was ist die Hauptstadt von Japan?“
- „Wie viele Einwohner hat Köln?“
- „**Ordnungszahl von** Gold“ · „Welches Element hat das Symbol Fe?“
- „**Was bedeutet** DSGVO?“
- „**Wie hoch** ist die Zugspitze?“ · „Wie schnell ist ein Gepard?“
- „Wie lange muss ich Eier kochen?“
- „Erzähl mir einen Fakt“ (jetzt über 100 verschiedene)
- „**Öffne das Lexikon**“ zeigt alles zum Stöbern.

Friday liest die Antwort nur vor. Weiß sie etwas nicht aus dem Lexikon, fragt sie wie gewohnt Claude.
Ist Claude gerade nicht erreichbar, sucht sie im Lexikon auch nach ungefähr passenden Einträgen.

### Im Dashboard

Werkzeug-Menü → **Wissen** (Fridays Datenbank) → Filter **📖 Lexikon**.
Oben wählst du einen Bereich, die Suche durchsucht alle Einträge, 🔊 liest einen Eintrag vor.
Wenn du in der normalen Datenbank etwas suchst, stehen passende Lexikon-Einträge gleich oben.

### Eigenes Wissen dazuschreiben

Die Inhalte liegen als Textdateien in `~/Friday/server/daten/lexikon/`. Eine Zeile ist ein Eintrag:

```
Titel|Text|Stichwort1,Stichwort2
```

Achtung: Diese Dateien werden bei Updates erneuert. Eigenes Wissen trägst du deshalb besser in der Datenbank
unter **Wissen eintragen** ein, das bleibt immer erhalten.

## Die Datenbank hat jetzt 25 Quellen (vorher 15)

Neu durchsuchbar ist alles, was Friday ohnehin schon speichert:

🛍️ Kaufberater · 🏷️ Produkte (Vision) · 😈 Gegenrede · 🔁 Abläufe · 🛠️ Werkzeug-Einsätze ·
🗂️ Lern-Archiv · 📚 Eigene Dateien (Dokumenten-Wissen) · 🌐 Webseiten · 🎮 Spiele · 📜 Protokolle

Die Speicher-Karte zeigt jetzt zwei Ringe, damit alle Quellen Platz haben, und das Lexikon als eigenen Knoten.
„Wie viel weißt du?“ nennt beides: Datenbank und Lexikon.
