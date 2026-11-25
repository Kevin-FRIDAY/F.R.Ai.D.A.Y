# Öffentliche Daten (ab v1.167.0)

Friday kennt jetzt 19 weitere offene Datenquellen von Ämtern, Bund, EU, NASA und Wikipedia.
Alles ist **kostenlos**, braucht **kein Claude-Guthaben** und **keinen eigenen Schlüssel**.

## So öffnest du es

- Werkzeug-Menü → **Welt** → **Öffentliche Daten**
- oder sag: „Friday, öffne die öffentlichen Daten“

Tippe auf eine Kachel. Friday holt die Daten live, liest auf 🔊 den Satz vor und zeigt die Details.

## Was du fragen kannst

| Quelle | Beispiel |
|---|---|
| 🚨 NINA-Warnungen (Bevölkerungsschutz) | „Gibt es NINA-Warnungen?“, „Gibt es Warnungen für Köln?“ |
| 🌊 Pegel & Hochwasser | „Wie hoch steht der Rhein?“, „Wasserstand der Spree“ |
| 🛣️ Autobahn | „Ist Stau auf der A7?“, „Baustellen auf der A1“ |
| 🥫 Rückrufe | „Gibt es Rückrufe?“, „Rückrufe für Käse“ |
| 🌼 Pollenflug (DWD) | „Wie wird der Pollenflug morgen?“ |
| 🎒 Schulferien | „Wann sind die nächsten Schulferien?“, „Sommerferien in Bayern“ |
| ⚡ Strom | „Wie hoch ist der Strompreis?“, „Woher kommt gerade der Strom?“ |
| 📮 Postleitzahlen | „Welche Postleitzahl hat Potsdam?“ |
| 💼 Jobsuche (Arbeitsagentur) | „Such mir Jobs als Elektriker in Hamburg“ |
| ☢️ Strahlung (BfS) | „Wie hoch ist die Strahlung?“ |
| 🔭 NASA-Bild des Tages | „Zeig mir das NASA-Bild des Tages“ |
| ☄️ Asteroiden | „Welche Asteroiden fliegen heute vorbei?“ |
| 👩‍🚀 Menschen im All | „Wer ist gerade im All?“ |
| 📜 Heute vor … Jahren | „Was geschah heute vor 100 Jahren?“ |
| 🔥 Wikipedia meistgelesen | „Was lesen die Leute gerade auf Wikipedia?“ |
| 🏅 Nobelpreise | „Wer hat den Nobelpreis für Physik 2024 bekommen?“ |
| 📈 Inflation (Eurostat) | „Wie hoch ist die Inflation?“ |
| 👷 Arbeitslosigkeit | „Arbeitslosenquote“ |
| 🏦 EZB-Leitzins | „Wie hoch ist der Leitzins?“ |

Ohne Ortsangabe nimmt Friday deinen eingestellten Ort (Einstellungen → Profil).

## Gut zu wissen

- Der Börsenstrompreis ist **ohne** Steuern, Umlagen und Netzentgelt. Dein Haushaltspreis ist höher, aber die günstigen Stunden sind dieselben.
- Das NASA-Bild geht ohne Schlüssel nur ein paar Mal pro Stunde. Wer mehr will: kostenlosen Schlüssel auf api.nasa.gov holen und in `~/Friday/server/.env` als `NASA_API_KEY=…` eintragen.
- Friday nutzt nur öffentliche Quellen, keine Daten über einzelne Personen.
