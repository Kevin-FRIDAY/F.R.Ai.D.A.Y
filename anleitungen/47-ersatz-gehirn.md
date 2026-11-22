# Ersatz-Gehirn über OpenRouter (v1.142.0)

Ist dein Claude-Guthaben leer oder Claude gerade gestört, denkt Friday über **OpenRouter** weiter.
Du merkst kaum einen Unterschied: Friday kann weiter alle Werkzeuge benutzen (Mac, Listen, Lagezentrum, Werkstatt, Spiele …).
Nur die **Websuche** gibt es ausschließlich bei Claude.

## Einrichten (einmalig, 3 Minuten)

1. Auf **openrouter.ai** anmelden.
2. Oben rechts **Credits** → etwas Guthaben aufladen (z. B. 5–10 $).
3. **Keys** → **Create Key** → Namen „Friday“ → Schlüssel kopieren (beginnt mit `sk-or-v1-…`).
4. In Friday: Werkzeug-Menü → **Verbindungen** → **🧠 Ersatz-Gehirn (OpenRouter)** → Schlüssel einfügen → **Verbinden**.

Den Schlüssel bitte **nie in einen Chat** schreiben, nur hier in Friday. Er bleibt auf deinem Mac (server/data/openrouter.json).
Friday und Eve teilen sich denselben Schlüssel, du trägst ihn also nur einmal ein.

## Erst in Eve testen

Neue Funktionen laufen zuerst in Eve. So testest du:

1. Oben auf **EVE** umschalten.
2. Verbindungen → Ersatz-Gehirn → **Test in Eve** auf „Test: Eve denkt immer mit OpenRouter“ stellen.
3. Eine Frage stellen, z. B. „Erklär mir, wie ein Elektroauto funktioniert“. Die Antwort kommt jetzt von OpenRouter.
4. **🎙 Probe-Frage** und **💳 Guthaben ansehen** zeigen, ob alles läuft.
5. Passt alles: Eve-Werkbank → **🔒 Tests** → „Ersatz-Gehirn über OpenRouter“ → **In Friday freigeben**.

Ab dann springt es auch in Friday ein.

## Wann springt es ein?

- Claude-Guthaben leer
- Claude-Schlüssel fehlt oder wird abgelehnt
- Claude überlastet oder gestört
- kein Weg zu Claude (Netz)

Solange Claude normal antwortet, wird OpenRouter **nicht** benutzt und kostet nichts.
Nach „Guthaben leer“ fragt Friday Claude 10 Minuten lang nicht erneut. Sobald du im ⚡ Energie-Fenster neu aufgeladen hast, nimmt sie sofort wieder Claude.

## Modelle

- **Hauptmodell**: für normale Fragen (Standard: das neueste Claude Sonnet bei OpenRouter)
- **Schnelles Modell**: für das Denk-Tempo „Blitz“ (Standard: das neueste Claude Haiku)

Du kannst auch andere Modelle wählen (z. B. GPT oder Gemini). Die Liste zeigt nur Modelle, die Werkzeuge können, mit Preis je Million Wörter-Bausteine (rein/raus).

## Kosten

OpenRouter rechnet von deinem OpenRouter-Guthaben ab, nicht vom Claude-Guthaben. Die Kosten erscheinen im ⚡ Energie-Fenster mit dem Zusatz „Ersatz“ und zählen beim Kosten-Deckel mit.
Im Logbuch steht, wann das Ersatz-Gehirn eingesprungen ist.
