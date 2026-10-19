# 7. Fridays Stimme

Ohne Einrichtung spricht Friday mit der eingebauten deutschen Stimme deines Geräts. Kostenlos, aber etwas robotisch.

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
