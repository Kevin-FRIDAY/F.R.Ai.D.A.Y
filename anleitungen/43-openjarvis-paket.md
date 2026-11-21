# 43. OpenJarvis-Paket: Glocke, Wächter, Dokumente, Apple-Apps, Whisper

Fünf Ideen aus dem Open-Source-Projekt [OpenJarvis](https://github.com/open-jarvis/OpenJarvis) (Stanford, Apache-2.0-Lizenz), für Friday neu gebaut. Es wurde kein Code übernommen, nur die Ideen.

## 1. Freigabe-Glocke 🔔

Riskante Aktionen macht Friday nicht allein. Sie warten in der Glocke, bis du sie freigibst.

- **Wo?** Oben in der HUD-Leiste (die Glocke wackelt, wenn etwas wartet), oder Werkzeug-Menü → Friday → **Freigabe-Glocke**.
- **Per Telegram:** Ist Telegram verbunden, kommt jede neue Freigabe als Nachricht mit zwei Knöpfen: ✅ Freigeben und ✋ Ablehnen.
- **Per Sprache:** „Friday, was wartet auf Freigabe?“, „Friday, gib frei“, „Friday, lehne ab“ (gilt für die neueste offene Aktion).
- **Immer nachfragen:** Im Fenster kannst du einstellen, wobei Friday *immer* fragt, egal wie hoch die Autonomie-Stufe ist. Von Anfang an an: Gedächtnis löschen, Mails sortieren, Friday aktualisieren. Nur „Volle Autonomie“ fragt nie.

## 2. Dauer-Wächter 🔭

Friday beobachtet etwas für dich und meldet sich per Telegram (und ntfy), sobald es passiert. Kostet nichts, läuft ohne Claude.

Sag zum Beispiel:

- „Friday, beobachte Bitcoin unter 80.000 Euro“ (prüft alle 15 Minuten)
- „Friday, sag mir, wenn der Euro über 1,15 Dollar steigt“
- „Friday, beobachte Taiwan in den Nachrichten“ (meldet nur *neue* Schlagzeilen)
- „Friday, beobachte die Webseite https://… nach ‚lieferbar‘“
- „Friday, sag mir, wenn es morgen regnet“ (auch Frost, Hitze, Schnee, Gewitter; einmal am Tag)
- „Friday, was beobachtest du?“ und „Friday, lösch den Wächter für Bitcoin“

Im Fenster (Werkzeug-Menü → Alltag → **Dauer-Wächter**) siehst du alle Wächter mit aktuellem Wert, kannst sie an- und ausschalten, sofort prüfen oder löschen. Ein Preis-Wächter meldet sich nur einmal, wenn die Marke überschritten wird, und erst wieder, wenn der Preis zurück und erneut darüber ging. Im Notfall-Modus pausieren alle Wächter. Webseiten aus dem eigenen Netz (z. B. 192.168…) beobachtet Friday nicht.

## 3. Dokumenten-Wissen 📚

Friday durchsucht deine eigenen Unterlagen und sagt immer dazu, wo es steht (Datei und Seite).

1. Leg Dateien in den Ordner **Friday-Wissen** in deinem Benutzerordner (der Ordner entsteht beim ersten Start), oder lade sie im Fenster hoch (bis 8 MB pro Datei; größere direkt in den Ordner legen).
2. Lesbar: PDF, Word (.docx/.doc), RTF, Text, Markdown, CSV, HTML. Neue Dateien liest Friday alle 10 Minuten von selbst ein.
3. Frag: „Friday, was steht in meinen Dokumenten über die Kündigungsfrist?“ oder „Friday, durchsuche meine Dokumente nach Garantie“.

Die Suche selbst kostet nichts. Die kurze Antwort formuliert Claude (braucht Guthaben); ohne Guthaben liest Friday die beste Fundstelle vor. Im Fenster kannst du das Häkchen „von Claude zusammenfassen“ ausmachen. Gelöschte Dateien landen in **Friday-Wissen/Papierkorb**. Auch Dokumente, die Friday für dich erstellt hat, sind durchsuchbar.

Tipp für PDFs: Friday baut sich beim ersten Mal ein kleines Lese-Programm (dauert etwa eine Minute). Klappt das nicht, hilft `extras-installieren.sh` (installiert zusätzlich pypdf).

## 4. Apple-Apps 🍏

Werkzeug-Menü → Alltag → **Apple-Apps**. Notizen, Kontakte und Musik laufen über den Mac-Agenten, alles bleibt auf deinem Mac. Beim ersten Mal fragt macOS, ob Friday auf Notizen, Kontakte bzw. Musik zugreifen darf: **Erlauben** tippen.

- **Notizen:** „Friday, durchsuche meine Notizen nach Rezept“, „Friday, notiere: Reifen wechseln“, „Friday, was sind meine neuesten Notizen?“
- **Kontakte:** „Friday, wie ist die Nummer von Anna?“, „Friday, wann hat Mama Geburtstag?“, „Friday, wer hat bald Geburtstag?“
- **Musik:** „Friday, spiel die Playlist Workout“, „Friday, spiel Coldplay aus meiner Musik“, „Friday, Zufallswiedergabe an“. Läuft Spotify, beantwortet „was läuft gerade“ weiter Spotify.
- **Gesundheit:** Kacheln mit Wochenschnitt und Trend, Verlauf als Kurve. „Friday, wie habe ich geschlafen?“, „Friday, wie viele Schritte diese Woche?“

### Gesundheitsdaten holen

**Einmalig alles:** iPhone → Health-App → oben aufs Profilbild → **Alle Gesundheitsdaten exportieren** → die Datei **Export.zip** per AirDrop an den Mac schicken und im Fenster unter Gesundheit hochladen. Friday liest Schritte, Schlaf, Ruhepuls, aktive Kalorien, Training, Stehstunden und Gewicht pro Tag (Doppelzählung iPhone + Watch wird vermieden).

**Jeden Tag automatisch:** der Kurzbefehl aus [Anleitung 5](5-gesundheit.md). Neu kannst du im JSON zusätzlich diese Felder schicken (alle optional, Typ Zahl):

| Feld | Bedeutung |
|---|---|
| `activeEnergy` | aktive Kalorien |
| `weight` | Gewicht in kg |
| `exerciseMinutes` | Trainingsminuten |
| `standHours` | Stehstunden |

## 5. Whisper-Spracherkennung 🎙

Whisper versteht dich direkt auf dem Mac (kostenlos, ohne Cloud). Einmal `extras-installieren.sh` im Friday-Ordner starten, falls noch nicht geschehen (installiert mlx-whisper).

Einstellungen → **Spracherkennung (Whisper)**:

- **Automatisch** (Standard): Das Gerät hört zu wie bisher. Whisper springt nur ein, wenn das Gerät selbst keine Spracherkennung hat (z. B. manche iPhone-Apps). Dann: Fridays Kopf antippen und sprechen.
- **Whisper auf dem Mac:** Das Weckwort „Friday“ hört weiter das Gerät. Danach nimmt Friday deinen Befehl auf und lässt ihn von Whisper verstehen: nach „Friday“ allein, nach einem Tipp auf den Kopf und bei Rückfragen. Sagst du „Friday, …“ in einem Satz, versteht ihn das Gerät.
- **Nur Gerät:** wie vor diesem Update.

Friday hört von selbst auf, wenn du nicht mehr sprichst. Ein Tipp auf den Kopf heißt „fertig gesprochen“. Modell **Schnell** braucht etwa eine Sekunde, **Genau** etwas länger (lädt beim ersten Mal 1,6 GB). Mit „Whisper testen“ siehst du sofort, was Friday verstanden hat.
