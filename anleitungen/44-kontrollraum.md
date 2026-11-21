# Kontrollraum: Regeln, Gedächtnis, Herzschlag, Kosten, Seele (v1.135.0)

Acht Bausteine aus dem Open-Source-Projekt **Automaton** (Conway Research, MIT-Lizenz), für Friday nachgebaut.
Du findest alles an einem Ort: Werkzeug-Menü → **Kontrollraum (Regeln, Seele, Kosten)**.

Oder sag: „Friday, öffne den Kontrollraum“, „Zeig mir deine Seele“, „Zeig mir deine Regeln“,
„Zeig mir deine Fähigkeiten“, „Zeig mir die Änderungen“ oder „Was hast du heute ausgegeben?“.
Diese Befehle laufen ohne Claude (kosten nichts).

## Die acht Bausteine

| Reiter | Was er macht |
|---|---|
| 🛡 **Regeln** | Bevor Friday ein Werkzeug benutzt, prüft ein Regelwerk: erlaubt oder verboten? Fest an: kein echtes Geld, keine geheimen Dateien (.env, Schlüssel), nichts zerstören. Abschaltbar: Manipulation erkennen, Tempo-Grenze (z. B. höchstens 10 Anrufe pro Stunde), höchstens 6 gefährliche Aktionen pro Frage, Eingaben prüfen. Jede Entscheidung steht in der Liste. |
| 🔁 **Schleifen-Schutz** (im Reiter Regeln) | Macht Friday dreimal genau dasselbe, bekommt sie einen Hinweis. Beim vierten Mal hört sie auf. Nach fünf Runden nur Nachschauen antwortet sie mit dem, was sie hat. Spart Guthaben. |
| 🧠 **Gedächtnis** | Fakten liegen jetzt in Schubladen (Menschen, Vorlieben, Orte, Termine, Technik, Arbeit). Dazu **Abläufe** („Filmabend: Licht dimmen, TV an, Netflix“) mit Zähler, wie oft sie geklappt haben, und **Ereignisse** (was Friday zuletzt getan hat). Vor jeder Antwort holt Friday nur das Passende. |
| 💓 **Herzschlag** | Jede Minute ein Takt. Feste, kostenlose Hintergrund-Aufgaben: Änderungen sichern (alle 5 Min.), Kosten prüfen (alle 15 Min.), Gedächtnis aufräumen (3:30 Uhr), Seele spiegeln (4:00 Uhr), Regel-Bericht (21:00 Uhr). Ein- und ausschalten, Zeiten ändern, „▶ jetzt“. Eigene „Wenn … dann …“-Regeln baust du weiter in der Modul-Zentrale → Automationen. |
| 💰 **Kosten-Deckel** | Feste Grenze pro Stunde (Standard 1 $) und pro Tag (Standard 3 $). Ab 80 % spart Friday (günstiges Modell). Ist die Grenze erreicht, laufen bis zur nächsten Stunde bzw. zum nächsten Tag nur Offline-Befehle, und du bekommst eine Mitteilung. Gezählt werden alle Claude-Kosten (geschätzt). |
| ✨ **Seele** | Eine Textdatei mit Fridays Auftrag, Werten, Art und Strategie. Friday liest sie vor jeder Antwort. Du darfst alles ändern. Friday selbst ergänzt nur „Was ich gelernt habe“, der Herzschlag füllt „Was ich oft tue“. Frühere Fassungen kannst du zurückholen. Die **festen Grenzen** (kein Geld, keine Überwachung, nichts ohne Bestätigung verschicken, eigenen Code nicht ändern) stehen im Programm und gelten immer. |
| 🧩 **Fähigkeiten** | Kleine Anleitungen als Datei (`server/data/faehigkeiten/*.md`). Kommt ein Auslöser-Wort in deiner Frage vor, liest Friday die Anleitung mit. Mitgeliefert: Auto-Vergleich, Reise planen. Neue legst du im Reiter an, oder du sagst: „Friday, lerne, wie man …“. Mit „Welche greift?“ testest du eine Frage. |
| 🕘 **Änderungen** | Friday hebt jede Fassung von Einstellungen, Oberfläche, Seele, Fähigkeiten, Automationen, Herzschlag-Plan, Gedächtnis und eigenen Protokollen auf. 👁 zeigt den Inhalt, ↺ holt die Fassung zurück (der jetzige Stand wird vorher gesichert). Schlüssel und Passwörter werden nie kopiert. |

## Was bewusst NICHT übernommen wurde

Automaton ist eine KI, die sich mit eigenem Krypto-Geld am Leben hält. Das passt nicht zu Friday:

- **Krypto-Wallet, USDC, Bezahlen:** Friday bewegt kein echtes Geld und hat kein eigenes Konto.
- **Sich selbst finanzieren:** Friday verdient und kassiert nichts selbst.
- **Sich selbst kopieren** (Kinder-Agenten in der Cloud): nein.
- **Fremde Cloud (Conway Cloud):** Friday läuft auf deinem Mac.
- **Eigenen Code umschreiben:** zu riskant, weil Updates automatisch installiert werden.

## Gut zu wissen

- Das Regelwerk entscheidet nur „erlaubt oder verboten“. **Nachfragen** vor einer Aktion macht weiterhin die Freigabe-Glocke (Modul-Zentrale → Kontrolle).
- Der Kosten-Deckel ist eine Bremse für Fridays Verbrauch. Dein echtes Guthaben siehst du auf console.anthropic.com.
- Alle Daten liegen in `server/data/` und sind in der Sicherung dabei. Updates fassen sie nie an.
