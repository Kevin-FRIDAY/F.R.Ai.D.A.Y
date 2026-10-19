#!/bin/bash
# Hält Friday an (startet beim nächsten Anmelden wieder automatisch).
for label in com.friday.server com.friday.agent; do
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null && echo "✓ $label gestoppt"
done
echo "Friday schläft. Zum Aufwecken: 'Friday starten.command'"
read -r -p "Enter zum Schließen..."
