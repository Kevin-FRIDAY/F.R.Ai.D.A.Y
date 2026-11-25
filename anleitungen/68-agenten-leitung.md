# Agenten-Leitung: Kontroll-Agent, Unternehmensleitung, Ausbildung, 24/7 (ab v1.180.0, Mark XII)

Ansehen: **Werkzeug-Menü → Gehirn-Cockpit → 🤖 Agenten** und **🎯 Missionen**.
Alles läuft ohne Claude und kostet kein Guthaben.

## 🛡 Kontroll-Agent: echte Ergebnis-Tests
Jeder Bericht eines Agenten wird geprüft, bevor er als Erfolg zählt:
- Der Abruf muss geklappt haben. Keine Verbindung bedeutet immer „nicht bestanden“, nie „ok“.
- Der Bericht darf nicht leer sein und keine Platzhalter wie „undefined“ enthalten.
- Der Inhalt muss passen. Beim Wetter muss eine Temperatur in °C drinstehen, bei Krypto ein Euro-Kurs, beim Pegel ein Wert in cm, bei Nachrichten mindestens 2 Meldungen.
- Eigene Agenten haben zusätzlich ihre eigenen Regeln („muss enthalten“).

Fällt ein Bericht durch, sagt Friday das dazu. Es steht dann auch im Logbuch.

## 🏢 Unternehmensleitung
Die Unternehmensleitung führt für jeden Agenten Kennzahlen:
- wie viele Einsätze er hatte,
- wie viel Prozent davon die Prüfung bestanden haben,
- wie schnell er im Schnitt war,
- was seine letzte Prüfung ergeben hat.

Daraus zeigt sie den besten Agenten, das Sorgenkind und Tipps an.

Scheitert ein Agent **3-mal hintereinander**, wird er **automatisch pausiert**. Das erste Mal für 1 Stunde, bei Wiederholung länger, höchstens 24 Stunden. Du bekommst dann eine Warnung.

- Pause aufheben: im Cockpit mit dem Knopf „Pause aufheben“ oder per Sprache „Friday, Wetter soll wieder arbeiten“.
- Überblick per Sprache: „Friday, wie läuft dein Agenten-Team?“

## 🎓 Agenten-Ausbildung (eigene Agenten)
Im Reiter 🤖 Agenten unter „Agenten-Ausbildung“:
1. Gib einen Namen ein, zum Beispiel „Rhein-Wächter“.
2. Wähle einen Grund-Agenten, zum Beispiel Wasserstände.
3. Trag eine feste Eingabe ein, zum Beispiel „Köln“.
4. Lege Prüfregeln fest, zum Beispiel „muss enthalten: Rhein“.
5. Starte den **🧪 Probelauf**. Erst wenn der Kontroll-Agent ihn abnimmt, ist der Agent **einsatzbereit**.

Danach schickst du ihn per Sprache los: „Friday, schick den Rhein-Wächter los“.

## 🔁 24/7-Missionszentrale (Daueraufträge)
Agenten arbeiten auch nach Zeitplan, zum Beispiel:
- „Friday, schick den Pollen-Agenten jeden Tag um 6:30 Uhr los“
- „Friday, schick den System-Agenten jede Stunde los“
- „… alle 30 Minuten los“ (das kürzeste Intervall ist 15 Minuten)

Im Reiter 🎯 Missionen siehst du alle Daueraufträge, kannst neue anlegen und sie an- oder ausschalten. Gemeldet wird standardmäßig nur bei Fehlern, auf Wunsch immer oder nie. Die Daueraufträge laufen über die bestehende Automatisierungszentrale und stoppen im Notfallmodus.

## 🗺 Lokale Aufgabenplanung (ohne Claude)
„Friday, plane lokal: Radtour am Wochenende, vorher Wetter und Pollen prüfen“

Friday zerlegt den Auftrag selbst in Agenten-Schritte. In diesem Beispiel heißt das: Wetter prüfen, dann Pollen prüfen, dann alles zusammenfassen. Der Auftrag läuft danach als Mission.

Jeder Schritt wird vom Kontroll-Agenten geprüft. Klappt ein Schritt nicht, versucht Friday es einmal erneut und meldet sich dann ehrlich.

Auch wenn Claude bei einer normalen Mission nicht erreichbar ist (kein Guthaben), nimmt Friday jetzt zuerst diese lokale Planung statt eines leeren Standard-Plans.

Im Reiter 🎯 Missionen kannst du so einen Plan auch eintippen und mit „Als Mission starten“ losschicken.
