# Samsung-Fernseher mit Friday steuern

Friday steuert Samsung-Smart-TVs (etwa ab Baujahr 2016) direkt über dein WLAN. Kein Home Assistant, keine Cloud, kein Konto nötig.

## Einmal einrichten (2 Minuten)

1. Fernseher einschalten. Er muss im **selben WLAN** sein wie dein Mac.
2. In Friday oben auf das Werkzeug-Menü tippen → **Fernbedienung (TV)**.
3. **Fernseher suchen** tippen und deinen Fernseher antippen.
   Findet Friday ihn nicht, trag die IP-Adresse von Hand ein
   (am Fernseher: Einstellungen → Allgemein → Netzwerk → Netzwerkstatus → IP-Einstellungen).
4. Auf dem Fernseher erscheint eine Frage, ob „Friday“ zugreifen darf → mit der normalen Fernbedienung **Zulassen** drücken.
   Das musst du nur einmal machen.

## Einschalten aus dem Standby

Damit Friday den Fernseher auch **einschalten** kann:

Am Fernseher: **Einstellungen → Allgemein → Netzwerk → Experteneinstellungen → „Über Mobilgerät einschalten“** auf **An**.
(Bei manchen Modellen heißt es „Einschalten mit Mobilgerät“ oder „Wake on LAN“.)

## Was Friday kann

| Sag … | Friday macht … |
|---|---|
| „Friday, mach Netflix an“ | Fernseher an (falls aus) und Netflix starten |
| „Starte YouTube auf dem Fernseher“ | YouTube auf dem TV |
| „Fernseher aus“ / „Fernseher an“ | aus- bzw. einschalten |
| „Fernseher lauter“ / „Fernseher um fünf leiser“ | Lautstärke |
| „Fernseher stumm“ | Ton aus/an |
| „Fernseher Sender 3“ / „nächster Sender am Fernseher“ | Sender wechseln |
| „Fernseher auf HDMI 2“ | Eingang wechseln |

Diese Befehle funktionieren **auch ohne Claude-Guthaben**, weil Friday sie selbst erkennt.
Achtung: „Öffne YouTube“ öffnet YouTube weiterhin auf dem **Mac**. Für den Fernseher sag „mach … an“ oder „auf dem Fernseher“.

Apps mit fester Taste: Netflix, YouTube, Prime Video, Disney+, Spotify, Apple TV. Andere Apps findet Friday über die App-Liste des Fernsehers (klappt nicht bei jedem Modell).

## Wenn etwas nicht klappt

- **„Der Fernseher ist nicht erreichbar“**: Ist er an? Gleiches WLAN wie der Mac? IP geändert? → In der Fernbedienung „Anderen Fernseher einrichten“ und neu suchen. Tipp: im Router dem Fernseher eine feste IP geben.
- **„Der Fernseher hat Friday abgelehnt“**: Am Fernseher unter Einstellungen → Allgemein → Externe Geräteverwaltung → Gerätverbindungs-Manager → Geräteliste „Friday“ auf Zulassen stellen.
- **Einschalten geht nicht**: „Über Mobilgerät einschalten“ (siehe oben) ist aus, oder der Fernseher hängt per Kabel statt WLAN – dann einmal von Hand einschalten und in der Fernbedienung neu suchen, damit Friday die richtige Adresse kennt.
