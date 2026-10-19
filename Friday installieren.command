#!/bin/bash
# ============================================================
#  F.R.Ai.D.A.Y Installer für den Mac
#  Doppelklick genügt. Beim ersten Mal: Rechtsklick > Öffnen.
# ============================================================
set -e

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Friday"
LOGS="$HOME/Library/Logs/Friday"
AGENTS="$HOME/Library/LaunchAgents"

cyan() { printf "\033[36m%s\033[0m\n" "$1"; }
gold() { printf "\033[33m%s\033[0m\n" "$1"; }
fail() { printf "\033[31m%s\033[0m\n" "$1"; echo; read -r -p "Enter zum Schließen..."; exit 1; }

clear
cyan "  ███████ ██████  ██ ██████   █████  ██    ██"
cyan "  ██      ██   ██ ██ ██   ██ ██   ██  ██  ██ "
cyan "  █████   ██████  ██ ██   ██ ███████   ████  "
cyan "  ██      ██   ██ ██ ██   ██ ██   ██    ██   "
cyan "  ██      ██   ██ ██ ██████  ██   ██    ██   "
echo
gold "  Willkommen, Boss. Ich richte mich jetzt auf deinem Mac ein."
echo

# --- 1. Node.js prüfen ---
NODE="$(command -v node || true)"
[ -z "$NODE" ] && [ -x /opt/homebrew/bin/node ] && NODE=/opt/homebrew/bin/node
[ -z "$NODE" ] && [ -x /usr/local/bin/node ] && NODE=/usr/local/bin/node
if [ -z "$NODE" ]; then
  gold "Ich brauche Node.js (kostenlos). Ich öffne die Download-Seite."
  echo "Lade die LTS-Version herunter, installiere sie und starte diesen Installer danach nochmal."
  open "https://nodejs.org/de/download"
  fail "Node.js fehlt noch."
fi
NODE_MAJOR="$("$NODE" -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -lt 20 ] && fail "Node.js ist zu alt (Version $NODE_MAJOR). Bitte Version 20 oder neuer von nodejs.org installieren."
NPM="$(dirname "$NODE")/npm"
echo "✓ Node.js $("$NODE" -v) gefunden"

# --- 2. Dateien nach ~/Friday kopieren (Einstellungen bleiben erhalten) ---
mkdir -p "$DEST" "$LOGS" "$AGENTS"
if [ "$SRC" != "$DEST" ]; then
  rsync -a --exclude node_modules --exclude '.env' --exclude 'server/data' --exclude 'server/eigene-protokolle.json' "$SRC/" "$DEST/"
fi
mkdir -p "$DEST/server/data"
# Deine eigenen Protokolle: diese Datei fasst kein Update an.
[ -f "$DEST/server/eigene-protokolle.json" ] || echo "{}" > "$DEST/server/eigene-protokolle.json"
chmod +x "$DEST"/*.command "$DEST/update.sh"
echo "✓ Dateien liegen in $DEST"

# --- 3. Pakete installieren ---
echo "Installiere Bausteine (dauert einen Moment)..."
(cd "$DEST/server" && "$NPM" install --omit=dev --no-fund --no-audit --silent) || fail "Installation der Server-Bausteine fehlgeschlagen."
(cd "$DEST/mac-agent" && "$NPM" install --omit=dev --no-fund --no-audit --silent) || fail "Installation des Mac-Agenten fehlgeschlagen."
echo "✓ Bausteine installiert"

# --- 4. Einstellungen ---
ENV="$DEST/server/.env"
setval() { # setval SCHLÜSSEL WERT  (WERT darf keine Zeilenumbrüche haben)
  local key="$1" val="$2"
  "$NODE" -e '
    const fs=require("fs"); const [f,k,v]=process.argv.slice(1);
    let s=fs.readFileSync(f,"utf8"); const re=new RegExp("^"+k+"=.*$","m");
    s=re.test(s)?s.replace(re,()=>k+"="+v):s+"\n"+k+"="+v+"\n"; fs.writeFileSync(f,s,{mode:0o600});
  ' "$ENV" "$key" "$val"
}
getval() { grep -E "^$1=" "$ENV" 2>/dev/null | head -1 | cut -d= -f2-; }

if [ ! -f "$ENV" ]; then
  cp "$DEST/server/.env.example" "$ENV"
  chmod 600 "$ENV"
fi
[ -z "$(getval SESSION_SECRET)" ] && setval SESSION_SECRET "$(openssl rand -hex 32)"
[ -z "$(getval AGENT_TOKEN)" ] && setval AGENT_TOKEN "$(openssl rand -hex 32)"
[ -z "$(getval SHORTCUT_TOKEN)" ] && setval SHORTCUT_TOKEN "$(openssl rand -hex 32)"

if [ -z "$(getval ANTHROPIC_API_KEY)" ]; then
  echo
  gold "Jetzt brauche ich deinen Claude-API-Schlüssel."
  echo "Den bekommst du auf https://console.anthropic.com unter 'API Keys'."
  echo "Er wird nur hier auf deinem Mac gespeichert. (Beim Einfügen siehst du nichts, das ist normal.)"
  read -r -s -p "API-Schlüssel: " KEY; echo
  [ -z "$KEY" ] && fail "Ohne Schlüssel kann ich nicht denken, Boss."
  setval ANTHROPIC_API_KEY "$KEY"
  unset KEY
fi

if [ "$(getval USER_NAME)" = "Kevin" ] || [ -z "$(getval USER_NAME)" ]; then
  read -r -p "Wie soll ich dich nennen? [Kevin]: " NAME
  setval USER_NAME "${NAME:-Kevin}"
  read -r -p "In welcher Stadt wohnst du (für Wetter)? [Berlin]: " CITY
  setval CITY "${CITY:-Berlin}"
fi

if [ -z "$(getval PASSWORD_HASH)" ]; then
  echo
  gold "Lege jetzt dein Friday-Passwort fest. Damit meldest du dich auf iPhone und Mac an."
  (cd "$DEST/server" && "$NODE" src/set-password.js) || fail "Passwort wurde nicht gesetzt."
fi

AGENT_ENV="$DEST/mac-agent/.env"
[ -f "$AGENT_ENV" ] || cp "$DEST/mac-agent/.env.example" "$AGENT_ENV"
PORT="$(getval PORT)"; PORT="${PORT:-3000}"
"$NODE" -e '
  const fs=require("fs"); const [f,t,p]=process.argv.slice(1);
  let s=fs.readFileSync(f,"utf8");
  s=s.replace(/^AGENT_TOKEN=.*$/m,()=>"AGENT_TOKEN="+t).replace(/^SERVER_URL=.*$/m,()=>"SERVER_URL=ws://127.0.0.1:"+p+"/agent");
  fs.writeFileSync(f,s,{mode:0o600});
' "$AGENT_ENV" "$(getval AGENT_TOKEN)" "$PORT"
echo "✓ Einstellungen gespeichert"

# --- 5. Autostart einrichten (startet Friday automatisch nach dem Anmelden) ---
write_plist() { # write_plist LABEL ORDNER SKRIPT
  cat > "$AGENTS/$1.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$1</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string><string>-i</string>
    <string>$NODE</string><string>$3</string>
  </array>
  <key>WorkingDirectory</key><string>$2</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>AbandonProcessGroup</key><true/>
  <key>StandardOutPath</key><string>$LOGS/$1.log</string>
  <key>StandardErrorPath</key><string>$LOGS/$1.log</string>
</dict>
</plist>
PLIST
}
write_plist com.friday.server "$DEST/server" "src/index.js"
write_plist com.friday.agent "$DEST/mac-agent" "agent.js"

for label in com.friday.server com.friday.agent; do
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$AGENTS/$label.plist"
done
echo "✓ Friday startet ab jetzt automatisch mit deinem Mac"

# --- 6. Prüfen ---
echo "Warte, bis ich wach bin..."
for i in $(seq 1 20); do
  if curl -s -o /dev/null "http://127.0.0.1:$PORT/"; then OK=1; break; fi
  sleep 1
done
[ -z "$OK" ] && fail "Ich bin nicht hochgefahren. Schau in $LOGS/com.friday.server.log"
echo "✓ Friday ist online"

# --- 7. Tailscale (für iPhone, Watch und unterwegs) ---
TS=""
command -v tailscale >/dev/null && TS="$(command -v tailscale)"
[ -z "$TS" ] && [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ] && TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale
echo
if [ -n "$TS" ]; then
  if "$TS" serve --bg "$PORT" >/dev/null 2>&1; then
    URL="$("$TS" serve status 2>/dev/null | grep -Eo 'https://[^ ]+' | head -1)"
    gold "Von iPhone und unterwegs erreichst du mich unter:"
    cyan "  ${URL:-(siehe 'tailscale serve status')}"
  else
    gold "Tailscale gefunden, aber 'serve' hat nicht geklappt. Siehe anleitungen/2-tailscale.md"
  fi
else
  gold "Tipp: Installiere Tailscale (kostenlos), damit dein iPhone mich überall erreicht."
  echo "Anleitung: $DEST/anleitungen/2-tailscale.md"
fi

echo
gold "Fertig, Boss. Ich öffne jetzt mein Dashboard."
open "http://127.0.0.1:$PORT/"
echo
read -r -p "Enter zum Schließen..."
