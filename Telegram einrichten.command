#!/bin/zsh
# Telegram-Bot für Friday einrichten (Schlüssel bleibt nur auf diesem Mac).
ENV="$HOME/Friday/server/.env"
clear
echo "=== Friday: Telegram einrichten ==="
echo
echo "1) In Telegram @BotFather öffnen, /mybots → deinen Bot → API Token"
echo "   (oder /newbot für einen neuen Bot). Den Token kopieren."
echo
printf "2) Token hier einfügen (wird nicht angezeigt) und Enter: "
read -rs TOKEN; echo
TOKEN=$(print -r -- "$TOKEN" | tr -d ' "\r\n')
ME=$(curl -s -m 10 "https://api.telegram.org/bot$TOKEN/getMe")
if ! print -r -- "$ME" | grep -q '"ok":true'; then
  echo; echo "❌ Telegram kennt diesen Token nicht. Bitte nochmal genau kopieren."
  read -k1 "?Taste drücken zum Schließen…"; exit 1
fi
BOT=$(print -r -- "$ME" | sed -E 's/.*"username":"([^"]+)".*/\1/')
echo "✅ Token passt: Bot @$BOT"
echo
# Server kurz anhalten, damit er die Nachricht nicht wegschnappt
launchctl bootout gui/$UID/com.friday.server 2>/dev/null
curl -s -m 10 "https://api.telegram.org/bot$TOKEN/deleteWebhook" >/dev/null
echo "3) Schreib jetzt in Telegram an @$BOT die Nachricht:  /start"
echo "   Ich warte bis zu 2 Minuten …"
CHAT=""
for i in {1..40}; do
  UPD=$(curl -s -m 10 "https://api.telegram.org/bot$TOKEN/getUpdates")
  CHAT=$(print -r -- "$UPD" | grep -o '"chat":{"id":-\{0,1\}[0-9]*' | tail -1 | grep -o -- '-\{0,1\}[0-9]*$')
  [ -n "$CHAT" ] && break
  sleep 3
done
if [ -z "$CHAT" ]; then
  echo "❌ Keine Nachricht angekommen. Friday wird wieder gestartet."
  launchctl bootstrap gui/$UID "$HOME/Library/LaunchAgents/com.friday.server.plist"
  read -k1 "?Taste drücken zum Schließen…"; exit 1
fi
echo "✅ Deine Chat-ID gefunden."
cp "$ENV" "$ENV.vor-telegram"
TOKEN="$TOKEN" CHAT="$CHAT" /usr/bin/python3 - "$ENV" <<'PY'
import os, sys, re
p = sys.argv[1]
s = open(p).read()
for k, v in (("TELEGRAM_BOT_TOKEN", os.environ["TOKEN"]), ("TELEGRAM_CHAT_ID", os.environ["CHAT"])):
    if re.search(rf"^{k}=", s, re.M):
        s = re.sub(rf"^{k}=.*$", f"{k}={v}", s, flags=re.M)
    else:
        s += f"\n{k}={v}\n"
open(p, "w").write(s)
PY
# alte Nachrichten als gelesen markieren
LAST=$(print -r -- "$UPD" | grep -o '"update_id":[0-9]*' | tail -1 | grep -o '[0-9]*$')
[ -n "$LAST" ] && curl -s -m 10 "https://api.telegram.org/bot$TOKEN/getUpdates?offset=$((LAST+1))" >/dev/null
launchctl bootstrap gui/$UID "$HOME/Library/LaunchAgents/com.friday.server.plist"
curl -s -m 10 "https://api.telegram.org/bot$TOKEN/sendMessage" --data-urlencode "chat_id=$CHAT" --data-urlencode "text=Friday ist per Telegram verbunden, Boss. ✅" >/dev/null
echo
echo "🎉 Fertig! Du solltest gleich eine Testnachricht von Friday in Telegram sehen."
read -k1 "?Taste drücken zum Schließen…"
