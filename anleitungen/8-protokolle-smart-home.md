# 8. Protokolle und Smart Home

## Protokolle

Ein Protokoll ist eine Abfolge von Aktionen, die Friday auf ein Wort hin startet. Vier sind schon dabei: **feierabend**, **hausparty**, **arbeit**, **gute nacht**.

Starten: "Friday, Protokoll Feierabend" oder im Dashboard auf den Knopf tippen.

### Eigene Protokolle

Deine eigenen Protokolle kommen in die Datei `~/Friday/server/eigene-protokolle.json`. Die gehört nur dir: Updates fassen sie nie an. Öffne sie mit TextEdit. Am Anfang steht dort nur `{}`. Beispiel mit einem Protokoll:

```json
{
  "filmabend": {
    "description": "Licht aus, Netflix auf, leise",
    "steps": [
      { "home": { "action": "turn_off", "entity_id": "light.wohnzimmer" } },
      { "mac": { "action": "open_url", "value": "https://www.netflix.com" } },
      { "mac": { "action": "volume_set", "value": "35" } },
      { "push": "Viel Spaß beim Film, Boss." }
    ]
  }
}
```

Heißt ein eigenes Protokoll genauso wie ein mitgeliefertes (z. B. `arbeit`), gilt deins. Die mitgelieferten stehen in `protocols.json`; die wird bei Updates erneuert, also dort nichts ändern.

Mögliche Schritte:

| Schritt | Beispiel |
|---|---|
| Mac | `{ "mac": { "action": "open_app", "value": "Spotify" } }` |
| Smart Home | `{ "home": { "action": "turn_on", "entity_id": "light.flur" } }` |
| Push | `{ "push": "Text" }` |
| Warten | `{ "wait": 3 }` (Sekunden, max. 10) |

Mac-Aktionen: `open_app`, `quit_app`, `open_url`, `volume_set`, `volume_up`, `volume_down`, `mute`, `music_play_pause`, `music_next`, `music_previous`, `say`, `notify`, `lock_screen`, `sleep_display`, `dark_mode_toggle`.

Achte auf Kommas zwischen den Einträgen. Nach dem Speichern wirkt die Änderung sofort. Ist die Datei fehlerhaft, steht das im Log `com.friday.server.log`.

## Smart Home über Home Assistant

Friday steuert alles, was in [Home Assistant](https://www.home-assistant.io) eingebunden ist (Hue, IKEA, Shelly, Steckdosen, HomeKit-Geräte über die HomeKit-Bridge u. v. m.).

1. Home Assistant läuft bei dir zu Hause (z. B. auf einem Raspberry Pi oder als App).
2. In Home Assistant: Profil > Sicherheit > **Langlebiges Zugriffstoken** erstellen.
3. In `~/Friday/server/.env`:
   ```
   HOME_ASSISTANT_URL=http://homeassistant.local:8123
   HOME_ASSISTANT_TOKEN=dein-token
   ```
4. **Friday starten.command** öffnen. Test: "Friday, welche Geräte kannst du steuern?" und dann "Mach das Licht im Wohnzimmer an."

Ohne Home Assistant kannst du Apple-HomeKit-Geräte über "Hey Siri" steuern; Friday selbst kommt an HomeKit nicht direkt heran.
