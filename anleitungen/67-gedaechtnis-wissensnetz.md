# Gedächtnis-Ebenen & Wissensnetz (ab v1.179.0, Mark XII)

Friday merkt sich jetzt Dinge auf **drei Ebenen** und verknüpft alles in einem **Wissensnetz** (Neural Brain 2.0).
Ansehen: **Werkzeug-Menü → Gehirn-Cockpit → 💾 Gedächtnis** und **🕸 Wissensnetz**.
Alles läuft ohne Claude und kostet kein Guthaben.

## Die drei Ebenen
| Ebene | Wofür | So sagst du es |
|---|---|---|
| ⏱ Kurzzeit | Gilt nur ein paar Tage (Standard 2 Tage, „für heute“ 1 Tag) | „Friday, merk dir für heute: ich arbeite im Homeoffice“ |
| 🗄 Langzeit | Bleibt dauerhaft | „Friday, merk dir: Carla mag Sushi“ |
| 📁 Projekte | Notizen zu einem Projekt | „Friday, neues Projekt Garage“, dann „merk dir für Projekt Garage: Tor ist 2,40 m breit“ |

Weitere Befehle: „ich arbeite an Projekt Garage“ (macht es aktiv), „welche Projekte habe ich?“, „was weißt du über Projekt Garage?“, „Projekt Garage ist fertig“, „was hast du zuletzt gemerkt?“.

Vor jeder Antwort bekommt Friday das aktive Projekt, die Kurzzeit-Notizen und die Themen der letzten 2 Tage mit.

## Erinnerungsintelligenz
Friday achtet auf die Themen deiner Fragen (z. B. „Carport“, „Mallorca“). Sie landen erst im Kurzzeitgedächtnis.
Fragst du **an 3 verschiedenen Tagen** nach demselben Thema, übernimmt Friday es von selbst ins Langzeitgedächtnis („Boss interessiert sich für Carport“).
Im Gedächtnis-Monitor siehst du, was übernommen wurde, und kannst Kurzzeit-Einträge mit **→ 🗄** von Hand dauerhaft machen oder mit **✕** vergessen.
Alltagsbefehle wie Wetter, Timer oder Musik zählen nicht als Thema. Im Gäste-Modus merkt sich Friday nichts.

## Wissensnetz (Neural Brain 2.0)
- **Knoten**: Langzeit-Fakten, Projekte, Kurzzeit-Themen, Missionen, Ziele, Entscheidungen, Dokumente, Geburtstage (Menschen), Interessen.
- **Neuronen**: die wichtigen Wörter darin.
- **Synapsen**: Wörter, die du in deinen Fragen oft zusammen benutzt, werden verbunden. Je öfter, desto stärker.
- **Aktivierung**: Eine Frage „feuert“ ihre Wörter, die Aktivierung fließt über die Synapsen weiter. Was dabei stark leuchtet, bekommt Friday als „verwandtes Wissen“ dazu, auch wenn es nicht wörtlich in der Frage steht. Was schon im Kontext steht, wird nicht doppelt geschickt (spart Guthaben).

Sprachbefehle: „zeig mir das Wissensnetz“, „wie hängt Garage mit Carport zusammen?“, „woran denkst du bei Urlaub?“.
Im Reiter kannst du dasselbe eintippen. Die passenden Knoten leuchten dann im Netz auf.

Das Netz baut sich höchstens alle 2 Minuten neu auf. Der Knopf **↻ Netz neu aufbauen** macht es sofort.

## Funktionsprüfung
Zwei neue echte Prüfungen im Reiter ✅ Tests:
- **Kurzzeit, Langzeit und Projekte getrennt**: Kontext enthält alle Ebenen, Themen werden richtig erkannt.
- **Wissensnetz baut sich und findet Wissen wieder**: Das Netz wird gebaut, und dein zuletzt gemerkter Fakt muss über seine eigenen Wörter wiedergefunden werden.
