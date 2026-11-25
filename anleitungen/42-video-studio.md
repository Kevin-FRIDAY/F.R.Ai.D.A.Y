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

## Neu in v1.171.0: Friday setzt um, was du schreibst

Was du ins Feld schreibst, ist eine **Anweisung an das Team**, kein Text fürs Video. Friday liest daraus die Vorgaben und zeigt sofort darunter: **„So setze ich es um“**.

Beispiel (Video erstellen):

> Stell unser Café vor, schnelle Schnitte, warme Farben. Zeig zuerst den Kaffee, dann den Kuchen und das Team. Am Ende: Komm vorbei!

Daraus wird: Thema „Unser Café“, Vorstellungs-Video (ohne Preise), Szenen in genau dieser Reihenfolge, viele kurze Szenen mit kurzen Übergängen und stärkerem Zoom, warmer Farb-Look und „Komm vorbei“ als letzte Szene.

Was Friday versteht:

| Du schreibst | Das passiert |
|---|---|
| schnelle Schnitte, dynamisch, TikTok-Tempo | viele kurze Szenen, kurze Übergänge, stärkerer Zoom |
| ruhig, langsam, entspannt | wenige lange Szenen, weiche Blenden |
| harte Schnitte / weiche Übergänge | Übergänge ohne bzw. mit Blende |
| warm, kühl, Kino-Look, Schwarz-Weiß, Retro, Neon, edel | Farb-Look über das ganze Video |
| ohne Text / wenig Text | keine bzw. nur kurze Einblendungen |
| Text in „Anführungszeichen“ oder `Text: …` | steht genau so im Video |
| Am Ende: … / Link in Bio / Komm vorbei | Aufruf als letzte Szene |
| zeig zuerst …, dann …, am Ende … | Szenen in dieser Reihenfolge |
| in Orange, rote Schrift | Akzentfarbe |
| mit Sprecher, 30 Sekunden, Querformat, epische Musik | wie die Knöpfe, der Text gewinnt |

**Clips schneiden** hat jetzt auch ein Feld „Was soll das Team machen?“:

| Du schreibst | Das passiert |
|---|---|
| auf 30 Sekunden kürzen | nur die stärksten Stellen, höchstens 30 s |
| nur die Stellen über mein Auto | nur Abschnitte, in denen „Auto“ gesagt wird |
| schnelle Schnitte / ruhig | Pausen ganz raus bzw. kurze Atempausen bleiben |
| Ähms drin lassen | Füllwörter werden nicht geschnitten |
| ohne Untertitel / ohne Musik | genau das |
| Titel: „Mein Tag“, Am Ende: Folg mir | Titel am Anfang, Abspann am Ende |
| Kino-Look, Retro, Schwarz-Weiß | Look für alle Clips |

Das klappt auch ohne Claude-Guthaben. Mit Guthaben bekommt die Regie deine Anweisung zusätzlich im Wortlaut und schreibt das Drehbuch danach.
