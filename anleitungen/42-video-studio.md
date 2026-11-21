# Video-Studio: Videos auf Zuruf, mit eigener Musik (v1.132.0)

Das Schnitt-Team kann jetzt nicht nur deine Clips schneiden, sondern **selbst Videos erstellen**.

## So geht's

Sag oder schreib einfach:

- „Friday, erstell mir ein 20-Sekunden-Video über Mallorca mit Musik.“
- „Mach ein 30-Sekunden-Video zum Thema Bitcoin mit epischer Musik und Sprecher im Querformat.“
- „Erstell ein Video aus meinen Clips mit chilliger Musik über unseren Urlaub.“

Oder: Werkzeug-Menü → **Schnitt-Team** → Reiter **🎬 Video erstellen**, Thema eintippen, Länge, Format, Musik und Bilder antippen, **▶ Video erstellen**.

Nach etwa einer Minute sagt Friday „Fertig, Chef“, das Video läuft in der Vorschau und liegt in `~/Friday-Video/Fertig` (dazu eine .txt mit Bildunterschrift und Hashtags).

## Das Team (6 Agenten)

| Agent | Was er macht |
|---|---|
| Regie | Schreibt das Drehbuch (Szenen, Texte, Sprechertext). Mit Guthaben macht das Claude, ohne Guthaben nimmt Friday Wikipedia oder eine Vorlage. |
| Bildsucher | Holt **gemeinfreie** Fotos (CC0, keine Namensnennung nötig) oder nimmt deine Clips/Fotos aus `~/Friday-Video/Eingang`. |
| Grafik | Neon-Hintergründe, Titel, Übergänge. |
| Komponist | **Komponiert die Musik selbst** (Neon, Episch, Chill, Energie, Fröhlich, Spannend). Keine fremden Lieder, keine Lizenzprobleme. „Meine“ nimmt deine Datei aus `~/Friday-Video/Musik`. |
| Sprecher | Liest den Text mit der Mac-Stimme vor (Schalter „Mit Sprecher“). Die Musik wird dabei leiser. |
| Render | Setzt alles mit ffmpeg zusammen. |

## Gut zu wissen

- Formate: 9:16 (TikTok, Reels, Shorts), 16:9 (YouTube), 1:1 (Instagram). Länge 5 bis 90 Sekunden.
- „▶ probehören“ spielt 9 Sekunden der gewählten Musik.
- Reiter **▶ Fertige Videos** zeigt alle Videos aus dem Ordner Fertig zum Abspielen und Laden.
- Braucht ffmpeg. Das ist dabei, wenn das Schnitt-Team eingerichtet ist (sonst `brew install ffmpeg`).
- Hat eine Szene kein passendes Foto, springt die Neon-Grafik ein. Das Video wird also immer fertig.
