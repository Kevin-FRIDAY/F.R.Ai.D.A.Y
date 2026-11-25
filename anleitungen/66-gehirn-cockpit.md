# Gehirn-Cockpit & Multi-KI-Schwarm (ab v1.178.0, Mark XII)

Öffnen: **Werkzeug-Menü → Gehirn-Cockpit** oder „**Friday, öffne das Cockpit**“.

Oben stehen immer die wichtigsten Zahlen: wie viele KIs bereit sind, welche Agenten arbeiten, offene Missionen, Fehler & Warnungen, wie viele Funktionen laufen, Prozessor/RAM und offene Freigaben. Unten läuft der **LIVE-Strom**: alles, was Friday gerade tut, in Echtzeit.

## Die Reiter
| Reiter | Was du siehst |
|---|---|
| ◎ Übersicht | Wer gerade denkt, Reihenfolge bei Ausfall, Kosten heute, das Wichtigste, neu Gemerktes |
| 🧠 KI-Modelle | Alle KIs mit Status (grün = bereit), Modell, Anfragen, Tempo, letzter Fehler, Kosten. Schlüssel eintragen, Tageslimit, Reihenfolge |
| 🤖 Agenten | Welcher Agent gerade arbeitet und woran |
| 🎯 Missionen | Laufende und abgeschlossene Aufträge mit Fortschritt |
| 💾 Gedächtnis | Gedächtnis-Monitor: Kurzzeit, Langzeit, Projekte, von selbst Übernommenes (siehe 67-gedaechtnis-wissensnetz.md) |
| 🕸 Wissensnetz | Neural Brain 2.0: wie dein Wissen zusammenhängt, Aktivierung, „wie hängt X mit Y zusammen“ |
| ⚠ Warnungen | Fehler & Warnungen aus Logbuch, Tests, KI-Pausen, Kosten, Guthaben, Notfall, Festplatte. Mit ✓ als gesehen markieren |
| 📊 System | Prozessor, Arbeitsspeicher, Festplatte, Netzwerk (live), Tailscale, Mac-Agent |
| 🔐 Freigaben | Wartende wichtige Aktionen freigeben/ablehnen, Autonomie-Stufe, „Immer nachfragen bei …“ |
| ✅ Tests | Automatische Funktionsprüfung mit Ergebnis pro Funktion |

## Andere KIs: ChatGPT, Gemini, DeepSeek, Grok
Friday kann diese KIs **nur mit deinen eigenen Schlüsseln** benutzen. Ohne Schlüssel bleiben sie einfach aus, es kostet nichts.

1. Cockpit → **KI-Modelle** → bei der gewünschten KI den Schlüssel einfügen → **Prüfen & speichern**.
   Friday fragt den Dienst echt, ob der Schlüssel stimmt, und sucht das passende (günstige) Modell aus.
2. Der Schlüssel wird **verschlüsselt** auf dem Mac gespeichert (Tresor, AES-256). Bitte nie im Chat posten.
3. Jede KI hat ein **Tageslimit** (Standard 0,50 $). Ist es erreicht, nimmt Friday sie für den Rest des Tages nicht mehr. Zusätzlich gilt der gemeinsame **Kosten-Deckel** (Kontrollraum).

Wo es Schlüssel gibt: ChatGPT platform.openai.com/api-keys · Gemini aistudio.google.com/apikey · DeepSeek platform.deepseek.com/api_keys · Grok console.x.ai

## Automatischer KI-Wechsel
Fällt Claude aus (Guthaben leer, Nutzungslimit, Störung, kein Netz), probiert Friday der Reihe nach:
**Claude → deine eingeschalteten KIs (Reihenfolge mit ▲▼ änderbar) → OpenRouter → Ollama.**
Meldet ein Dienst ein Nutzungslimit, macht er von selbst Pause (Limit: 10 Min., Guthaben leer: 6 Std., Schlüssel falsch: bis du einen neuen einträgst). Ist der Kosten-Deckel erreicht und Ollama eingerichtet, denkt Friday kostenlos mit Ollama weiter.

## Schwarm-Frage
„**Friday, frag den Schwarm: …**“ oder im Cockpit unter KI-Modelle. Friday stellt dieselbe Frage an bis zu 3 KIs (lokal zuerst, dann die günstigsten), vergleicht die Antworten (Einigkeit in %) und fasst sie zusammen. Braucht mindestens 2 bereite KIs.

## Performance-Labor
Cockpit → KI-Modelle → **Vergleichen**. 5 Prüffragen mit nachprüfbarer Antwort (Rechnen, Wissen, Buchstaben zählen, JSON, Anweisung befolgen). Ergebnis: Rangliste nach Treffern, dann Tempo, mit Kosten. Echte Anfragen, kostet wenige Zehntel Cent.

## Funktionsprüfung
Cockpit → Tests → **Jetzt prüfen** oder „**Friday, prüfe alle Funktionen**“. Läuft außerdem jeden Tag automatisch (03:45 bzw. beim ersten Start danach).
- ✓ bestanden: die echte Funktion lief und das Ergebnis stimmt
- ✗ Fehler: lief, aber falsch – steht dann auch unter Warnungen
- – nicht prüfbar: z. B. kein Schlüssel oder kein Mac. Zählt **nie** als bestanden.
Bezahlte KI-Dienste werden nur geprüft, wenn du das Häkchen setzt.

## Sprachbefehle
- „Friday, öffne das Cockpit“
- „Welche KIs sind gerade aktiv?“
- „Frag den Schwarm: Wie funktioniert eine Wärmepumpe?“
- „Zeig mir die Warnungen“
- „Prüfe alle Funktionen“

## Technik (für Neugierige)
Neuer **Ereignis-Bus**: Jedes Modul meldet, was passiert (Logbuch, KI-Start/-Ende, Tests …), und jedes Modul kann zuhören. Das Cockpit hört live mit.
