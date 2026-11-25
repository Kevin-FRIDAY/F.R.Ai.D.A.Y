# 72 · Mark XIII: Friday denkt mit (v1.184.0)

Alles hier läuft auf deinem Mac und kostet nichts. Du findest es im **Gehirn-Cockpit → Reiter 🧠 Denken**.

## 🧭 Lage erkennen
Friday weiß, in welcher Lage du gerade bist: Wochentag, Tageszeit, Modus (Morgenroutine, Arbeitszeit, Feierabend, Nacht, Wochenende, Im Termin), nächster Termin, laufende Mission, Gästemodus und welches Gerät du zuletzt benutzt hast.
Diese Lage bekommt Friday als eine Zeile mit und antwortet passender, zum Beispiel im Termin kurz.
- Sag: **„Friday, in welcher Lage bin ich?“**
- Termine sieht Friday nur, wenn der Mac-Kalender verbunden ist. Im Gästemodus bekommt sie keine Termine.

## 🔮 Was du wohl gleich fragst
Aus deinen früheren Fragen rechnet Friday aus, was du um diese Uhrzeit an so einem Tag meistens fragst und was oft direkt danach kommt.
Die Trefferquote ist ehrlich nachgerechnet: Friday sagt die letzten 40 echten Fragen voraus, jeweils nur mit dem, was sie davor wusste.
- Sag: **„Friday, was will ich wohl als Nächstes?“**
- Vorschläge erscheinen nur im Cockpit, nicht auf der Startseite und nicht vorgelesen.

## 🧬 Selbstlernen
- **Antwortqualität:** Jede Antwort wird kurz geprüft (leer, „weiß ich nicht“, Fehler, sehr lang, gleich nochmal gefragt).
- **Lob und Kritik:** Sag **„das war gut“** oder **„das stimmt nicht“** (auch „schlechte Antwort“). Im Cockpit gibt es 👍/👎-Knöpfe.
  Hinweis: „Das war falsch“ bedeutet weiterhin *rückgängig machen*.
- **Fehlergedächtnis:** Falsche Antworten merkt sich Friday. Kommt eine ähnliche Frage, bekommt sie einen Warnhinweis und prüft genauer.
- **Antwortwege:** Friday zählt für Schnellbefehl, Offline-Gehirn und Claude, wie oft es 👍 und 👎 gab. Fragst du gleich nochmal dasselbe, zählt das als 👎.

## 🕳️ Wissenslücken
Fragen, die Friday nicht beantworten konnte, landen als Wissenslücke im Cockpit.
Nachts um 3:30 Uhr recherchiert sie bis zu 3 davon selbst, kostenlos über Wikipedia, Nachrichten und deine Feeds. Wenn Ollama läuft, fasst die lokale KI das zusammen.
Das Ergebnis nutzt Friday bei der nächsten ähnlichen Frage.
- Sag: **„Friday, welche Wissenslücken hast du?“**
- Ausschalten: Cockpit → System → Hintergrund-Aufgaben → „Wissenslücken nachrecherchieren“.

## ⚖️ Entscheidungs-Matrix
Trag Möglichkeiten und Kriterien ein. Jedes Kriterium bekommt ein Gewicht von 1 (unwichtig) bis 5 (sehr wichtig), jede Möglichkeit eine Note von 1 bis 10.
Friday rechnet eine Punktzahl von 0 bis 100 aus und prüft, ob das Ergebnis **robust** ist. Robust heißt: Der Sieger bleibt, auch wenn du ein Gewicht änderst.
Mit **„Als Entscheidung festhalten“** landet sie im Entscheidungsarchiv (Persönlich → Entscheidungen).

## 📈 Entscheidungslernen
Bewertest du Entscheidungen später mit 1 bis 5 Sternen, zeigt Friday zwei Dinge: Wie gut es lief, wenn du der Matrix gefolgt bist, und in welchen Bereichen du gut entscheidest.

## 🔭 Zukunftssimulator
Friday rechnet 2000 mögliche Verläufe durch (Monte-Carlo-Rechnung):
- **Sparen/Anlegen:** monatlicher Betrag, Jahre, Rendite und Schwankung → schlechter Fall, Mitte, guter Fall. Das ist eine Rechnung und keine Anlageberatung.
- **Ziel:** Aus deinem echten Fortschritt bei einem Ziel errechnet Friday, wann du es schaffst und wie wahrscheinlich das bis zur Frist ist.
- **Gewohnheit:** Aus deiner echten Quote dieser Woche errechnet Friday, wie wahrscheinlich eine lange Serie ist.
- Sag: **„Friday, was wäre, wenn ich 200 Euro im Monat 20 Jahre spare?“** oder **„Schaffe ich mein Ziel?“**

## 🗣️ Agenten-Diskussion
Chancen-Agentin, Risiko-Agent und Praxis-Agent diskutieren deine Frage in 2 Runden. Danach fasst Friday zusammen: wo alle einig sind, wo Streit bleibt, und ihre Empfehlung.
- Kostenlos mit **Ollama** (Gehirn-Cockpit → KI-Modelle).
- Bezahlte KI nur, wenn du das Häkchen setzt. Dann gilt dein Kosten-Deckel.
- Ohne KI sagt Friday ehrlich, dass es nicht geht.

## Ehrlich getestet
- Lage, Vorhersage, Selbstlernen, Wissenslücken (mit Test-Wikipedia), Matrix und Simulator wurden mit echten Anfragen am Test-Server geprüft.
- Die Agenten-Diskussion wurde nur mit einer **nachgebauten Ollama** geprüft, weil im Test keine echte KI läuft. Bei dir läuft sie, sobald Ollama eingerichtet ist.
- Funktionstests: „Kontext-Erkennung und Befehls-Vorhersage“, „Selbstlernen“, „Entscheidungs-Matrix und Zukunftssimulator“.
