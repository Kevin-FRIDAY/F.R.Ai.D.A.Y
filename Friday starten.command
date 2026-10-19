#!/bin/bash
# Startet Friday (Server und Mac-Agent) neu, z. B. nach Änderungen an der .env.
AGENTS="$HOME/Library/LaunchAgents"
for label in com.friday.server com.friday.agent; do
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  if [ -f "$AGENTS/$label.plist" ]; then
    launchctl bootstrap "gui/$(id -u)" "$AGENTS/$label.plist" && echo "✓ $label gestartet"
  else
    echo "Friday ist noch nicht installiert. Bitte zuerst 'Friday installieren.command' öffnen."
    read -r -p "Enter zum Schließen..."; exit 1
  fi
done
sleep 2
PORT="$(grep -E '^PORT=' "$HOME/Friday/server/.env" 2>/dev/null | cut -d= -f2)"
open "http://127.0.0.1:${PORT:-3000}/"
