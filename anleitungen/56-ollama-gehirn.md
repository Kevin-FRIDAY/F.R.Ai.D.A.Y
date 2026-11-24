# Ollama als Gehirn (v1.161.0)

Ollama ist ein **zweites Gehirn** für Friday, neben Claude und dem Ersatz-Gehirn OpenRouter.
Öffnen: **Werkzeug-Menü → Friday → ⭐ Meine Wunschliste → 🧠 Ollama-Gehirn**.

## Zwei Wege

| | 💻 Auf dem Mac | ☁️ Ollama Cloud |
|---|---|---|
| Kosten | kostenlos (nur Strom) | Gratis-Stufe mit Grenzen, sonst Abo (siehe ollama.com/pricing) |
| Internet | nicht nötig | nötig |
| Tempo auf dem MacBook Air | langsam: erste Antwort oft 20–60 s, weil Fridays Werkzeug-Liste groß ist | schnell, ähnlich wie Claude |
| Werkzeuge (Mail schreiben, Tabelle bauen …) | klappt, aber kleine Modelle vergessen öfter Schritte | klappt gut |
| Einrichten | Ollama-App + `ollama pull qwen3.5:4b` | Schlüssel auf ollama.com → Settings → Keys |

## Vier Modi

- **Aus** – Friday nimmt Ollama nie.
- **Notfall** – nur wenn Claude **und** OpenRouter nicht können (Guthaben leer, kein Internet).
- **Sparen** – Ollama zuerst, Claude nur wenn es nicht klappt. Spart Claude-Guthaben. PDFs bleiben bei Claude.
- **Immer** – nur Ollama, nie Claude.

Sprachbefehle: „Friday, denk sparsam“ (Sparen), „Friday, denk lokal“ (Immer, auf dem Mac),
„Friday, denk mit Ollama“ (Immer, Mac oder Cloud wie eingestellt), „Friday, denk wieder normal“ (zurück auf Notfall).

## Welches Modell?

**Auf dem Mac (MacBook Air):**
- `qwen3.5:4b` – Empfehlung. Gutes Deutsch, kann Werkzeuge und Bilder, läuft schon mit 8 GB RAM.
- `qwen3.5:9b` – klüger, braucht 16 GB RAM, etwa halb so schnell.
- `gemma4:e4b` – Alternative von Google, sehr gutes Deutsch.
- `llama3.2:3b` (alter Standard) – schwaches Deutsch, unsichere Werkzeug-Aufrufe. Besser wechseln.

**In der Cloud:**
- `gpt-oss:120b` – Empfehlung. Schnell, zuverlässige Werkzeug-Aufrufe.
- `deepseek-v4-flash` – sehr schnell und sparsam.
- `glm-5.2` – eines der klügsten offenen Modelle.
- `kimi-k2.6` – stark bei langen Aufgaben, sieht Bilder.

Nach dem Eintragen des Schlüssels zeigt die Liste alle Modelle, die dein Konto gerade hat.

## Einrichten

**Mac:** ollama.com → Mac-App laden, öffnen. Im Terminal `ollama pull qwen3.5:4b`. Im Fenster „Auf dem Mac“, Modus wählen, Speichern, Probe-Frage.

**Cloud:** ollama.com → anmelden → Settings → **Keys** → neuen Schlüssel erstellen. Im Fenster „Ollama Cloud“, Schlüssel einfügen,
Modus wählen, Speichern, Probe-Frage. Den Schlüssel **nie** in einen Chat schreiben. Er liegt nur auf dem Mac in `server/data/ollama.json`.

## Gut zu wissen

- Ollama-Antworten zählen **nicht** gegen das Claude-Guthaben im ⚡ Energie-Fenster.
- Websuche gibt es nur mit Claude.
- Die Probe-Frage zeigt, wie viele Sekunden Ollama gebraucht hat.
- Im Logbuch steht, wann Ollama gedacht hat.
