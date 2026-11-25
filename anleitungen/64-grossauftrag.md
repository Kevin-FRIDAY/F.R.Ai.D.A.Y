# Großauftrag: Friday erledigt mehrere Teile selbst (ab v1.176.0)

Schreib einen Auftrag mit mehreren Teilen in die **Aufgaben** (Organizer) oder sag ihn Friday, zum Beispiel:

> Mach mir ein Drehbuch für einen Kurzfilm, dreh den Film, bau dazu eine Webseite für die Premiere und ein passendes Auto zum Film.

Friday erkennt die Teile und arbeitet sie **der Reihe nach** ab:

1. **📜 Drehbuch** – als Dokument (Figuren, Szenen, Dialoge). Mit Claude frei geschrieben, ohne Guthaben aus Fridays Drehbuch-Vorlagen (7 Genres).
2. **🎬 Film** – das Schnitt-Team macht einen 16:9-Trailer mit eigener Musik und Sprecher (Mac-Stimme). Bilder: freie Fotos oder – wenn du „mit meinen Clips“ schreibst – deine Dateien aus `Friday-Video/Eingang`.
3. **🏎️ Filmauto** – das Auto-Studio in der Werkstatt baut ein Auto, das zum Film passt (z. B. Krimi → Mercedes-AMG GT 63 S in Schwarz).
4. **🌐 Premieren-Webseite** – eigene Seite ohne Preis, mit Standbildern aus dem Film, Trailer, Figuren, Filmauto und Anmelde-Formular. Liegt in `Friday-Webseiten`; der Film liegt als `film.mp4` daneben.

Den Fortschritt siehst du im Fenster **Großauftrag** (Werkzeug-Menü → Großauftrag, oder auf das ⚙-Schild bei der Aufgabe tippen). Am Ende gibt es eine **ehrliche Bilanz**: was fertig ist, was nicht, und wo die Grenzen sind. Mit „Fehlendes nachholen“ versucht Friday fehlgeschlagene Teile noch einmal.

Tipps: „über …“ gibt das Thema vor, „mit dem Titel …“ den Filmtitel, „Premiere am 12.12.“ das Datum.

## Grenzen (ehrlich)
- Der Film wird nicht mit Kamera gedreht, sondern aus Fotos/Clips, Titeln, Musik und Sprecher geschnitten.
- Echte KI-Filmszenen brauchen einen Bezahldienst. Günstigster guter Vorschlag (Stand Herbst 2026): Google Veo 3.1 Lite über die Gemini-API, etwa 0,05 $ pro Sekunde (ca. 3 $ für 1 Minute). Ist noch nicht eingebaut.
- Fridays eigene Autos sehen stilisiert aus; fotorealistisch nur mit echtem 3D-Modell (Sketchfab-Schlüssel).
- Die Webseite ist nicht automatisch im Internet.
- Teile, die keiner Werkstatt zugeordnet werden können, macht Friday nicht – sie stehen in der Bilanz.
