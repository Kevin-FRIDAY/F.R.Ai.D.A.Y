# 7. Fridays Stimme

Ohne Einrichtung spricht Friday mit der eingebauten deutschen Stimme deines Geräts. Kostenlos, aber etwas robotisch.

## Mehr Apple-Stimmen (kostenlos)

Unter Einstellungen → Stimme → **Gerätestimme** zeigt Friday alle Stimmen deines Geräts, sortiert nach Sprache. ★ = Premium, ☆ = Erweitert (klingen am natürlichsten). Beim Auswählen hörst du die Stimme sofort, "▶ Probehören" spielt sie noch mal ab. Die Wahl gilt pro Gerät (Mac und iPhone getrennt).

Neue Stimmen laden:

- **Mac:** Systemeinstellungen → Bedienungshilfen → Gesprochene Inhalte → bei "Systemstimme" auf ⓘ bzw. "Stimmen verwalten …" → Deutsch → z. B. *Anna (Premium)*, *Helena*, *Petra*, *Markus*, *Yannick* mit ⬇ laden.
- **iPhone:** Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Deutsch → Stimme antippen → "Premium" oder "Erweitert" laden.

Danach Friday neu laden (oder "↻ Liste neu laden"). Siri-Stimmen gibt Apple für Webseiten nicht frei. "Retro" (Eddy, Flo, Grandpa …) und "Spaß" (Bubbles, Zarvox …) sind Apples Spielerei-Stimmen.

## Echte Friday-Stimme mit ElevenLabs

1. Konto auf [elevenlabs.io](https://elevenlabs.io) anlegen. Es gibt einen kleinen kostenlosen Monatsvorrat, für viel Nutzung ein Abo.
2. In der **Voice Library** eine weibliche Stimme suchen, die dir gefällt. Für den Film-Vibe nach "Irish female" suchen. Mit "Add to my voices" hinzufügen.
3. Bei der Stimme die **Voice ID** kopieren.
4. Unter Profil > **API Keys** einen Schlüssel erstellen.
5. In `~/Friday/server/.env`:
   ```
   ELEVENLABS_API_KEY=dein-schlüssel
   ELEVENLABS_VOICE_ID=die-voice-id
   ```
6. **Friday starten.command** öffnen. Im Dashboard steht bei Stimme jetzt "ElevenLabs".

Die Stimme spricht Deutsch mit Akzent der gewählten Stimme. Bitte keine Stimme echter Personen klonen ohne deren Erlaubnis.

## Mac-Stimme für "laut sagen"

Wenn Friday etwas direkt am Mac sagt (z. B. in Protokollen), nutzt sie die macOS-Stimme aus `mac-agent/.env` (`SAY_VOICE=Anna`). Weitere Stimmen: Systemeinstellungen > Bedienungshilfen > Gesprochene Inhalte > Systemstimme > Stimmen verwalten.

## Friday hört nur auf "Friday" (ab v1.118.1)

Friday reagiert nur, wenn du sie mit **"Friday"** ansprichst. Unterhältst du dich mit jemand anderem, bleibt sie still.

- "Friday" zählt überall im Satz ("Friday, wie spät ist es?" oder "Wie spät ist es, Friday?"). "Black Friday" zählt nicht.
- Das deutsche Wort **"Freitag"** zählt nur ganz am Anfang ("Freitag, mach das Licht an"). "Am Freitag fahren wir zu Oma" weckt sie nicht.
- Sagst du nur "Friday", hört sie genau einen Satz lang zu.
- Stellt Friday dir selbst eine Frage ("Welches Land?"), hört sie für die Antwort einmal ohne "Friday" zu.
- **Gesprächsmodus** (Einstellungen → Assistent) ist jetzt standardmäßig **aus**. Eingeschaltet hört Friday nach jeder Antwort weiter zu, ohne "Friday" – dann redet sie aber auch dazwischen, wenn du mit anderen sprichst.

## Friday redet nicht von allein (ab v1.121.1)

- **Unterbrechen** geht nur mit „Friday“ („Friday, stopp“ oder „Friday, wie spät ist es?“). Reden andere dazwischen, spricht Friday einfach weiter.
- Friday fängt **nicht von sich aus** an zu reden. Timer und Erinnerungen piepen und zeigen ein Fenster, Energie-Warnungen und „Video fertig“ erscheinen still als gelber Hinweis am Ring um ihren Kopf.
- Willst du, dass sie solche Meldungen wieder vorliest: Einstellungen → Assistent → „Friday darf von sich aus sprechen“.

## iPhone: Geräusche unterbrechen Friday nicht mehr (ab v1.121.3)

Auf dem iPhone hat iOS Fridays Stimme abgeschnitten, sobald ein Geräusch (z. B. die S-Bahn) das Mikrofon kurz umgeschaltet hat. Jetzt merkt Friday das und spricht ab dem unterbrochenen Satz weiter. Aufhören tut sie nur, wenn du „Friday“ (z. B. „Friday, stopp“) sagst oder auf ihren Kopf tippst.

## iPhone: „Nicht verstanden“ und Friday reagiert nicht mehr (behoben in v1.121.5)

Auf dem iPhone darf nur ein Mikrofon gleichzeitig laufen. Nach „Friday“ startete Friday das Zuhören, bevor das „Friday“-Ohr ganz aus war. Safari meldete dann einen Fehler, unten stand „Nicht verstanden“ und Friday hörte gar nicht mehr zu. Jetzt wartet sie kurz, versucht es still neu und räumt hängendes Zuhören selbst auf. Steht unten „Mikrofon erlauben“ oder „Mikrofon belegt“, einmal auf Fridays Kopf tippen.

## Sprachsteuerung neu (v1.122.0)

Friday hat jetzt **ein einziges Mikrofon**, das die ganze Zeit läuft. Es wird nie mehr umgeschaltet,
darum klappt es auf dem iPhone (Safari / Home-Bildschirm-App) genauso wie am Mac.

So läuft es ab:

1. **Warten** – Friday hört zu, reagiert aber **nur**, wenn „Friday“ im Satz vorkommt.
   Gespräche nebenbei (z. B. mit deiner Frau), Fernseher oder S-Bahn werden ignoriert.
2. **Befehl** – „Friday, zeig mir das Wetter“ geht sofort los. Sagst du nur „Friday“, wartet sie
   8 Sekunden auf den nächsten Satz (dann ohne „Friday“).
3. **Denken** – „Friday, stopp“ bricht ab, die Antwort wird dann nicht vorgelesen.
   Ein neuer „Friday …“-Befehl wird direkt danach erledigt.
4. **Sprechen** – Friday redet, bis sie fertig ist. Nebengeräusche stören sie nicht.
   **„Friday, stopp“** (auch „Friday, ruhe“, „Friday, das reicht“) macht sie sofort still.
   „Friday, …“ mit einem neuen Befehl unterbricht sie und erledigt den neuen Befehl.

Von sich aus redet Friday nicht los (Timer & Co. erscheinen still am Status-Ring).
Antworten auf deine Fragen liest sie immer laut vor.

Friday erzählt wieder, was sie tut:
- **Werkstatt** („Friday, bau mir einen Audi A4“): Einleitung, dann zu jedem Bauabschnitt
  „Das ist der Motor …“, „Hier sitzen die Räder …“, zum Schluss ein Fazit.
- **Suchen** („Friday, such mir was zu Sushi for You“): „Das ist Sushi for You …“ mit den wichtigsten Infos.
- **Welt-Runde** („Friday, was passiert in der Welt?“): „Ich bin jetzt in den USA …“ und liest die Nachrichten vor.
