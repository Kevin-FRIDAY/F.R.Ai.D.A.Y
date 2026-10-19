# 6. Push-Nachrichten, Morgenbriefing und Telegram

Alle Einstellungen in `~/Friday/server/.env`, danach **Friday starten.command** öffnen.

## Push aufs iPhone (für Erinnerungen und Briefing)

1. App **ntfy** aus dem App Store laden.
2. In ntfy auf **+** und ein Thema abonnieren, das niemand erraten kann, z. B. `friday-kevin-k39fz2`.
3. In der `.env`: `NTFY_TOPIC=friday-kevin-k39fz2`
4. Neu starten und testen: "Friday, schick mir eine Push-Nachricht."

Wichtig: Wer den Themennamen kennt, kann deine Pushs mitlesen. Also lang und zufällig wählen.

## Morgenbriefing

In der `.env`: `BRIEFING_TIME=07:00` (leer lassen = aus). Friday schickt dir dann jeden Morgen Wetter, Erinnerungen, Gesundheit und Nachrichten als Push und per Telegram. Im Dashboard bekommst du es jederzeit über **Briefing**.

## Telegram

1. In Telegram **@BotFather** anschreiben, `/newbot` senden, Namen wählen (z. B. "Friday Kevin"). Du bekommst einen Token.
2. In der `.env`: `TELEGRAM_BOT_TOKEN=dein-token`, neu starten.
3. Deinem neuen Bot `/id` schreiben. Er antwortet mit deiner Chat-ID.
4. In der `.env`: `TELEGRAM_CHAT_ID=deine-id`, neu starten.

Ab jetzt antwortet Friday in Telegram, aber nur dir. Du kannst auch Fotos schicken ("Was ist das für eine Pflanze?"). `/neu` startet ein neues Gespräch.
