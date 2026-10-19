#!/bin/bash
# Entfernt den Autostart. Der Ordner ~/Friday (mit Gedächtnis und Einstellungen) bleibt, bis du ihn selbst löschst.
read -r -p "Friday wirklich deinstallieren? (ja/nein): " A
[ "$A" != "ja" ] && exit 0
for label in com.friday.server com.friday.agent; do
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  rm -f "$HOME/Library/LaunchAgents/$label.plist"
done
command -v tailscale >/dev/null && tailscale serve reset 2>/dev/null
echo "✓ Autostart entfernt. Der Ordner ~/Friday ist noch da und kann von dir in den Papierkorb gelegt werden."
read -r -p "Enter zum Schließen..."
