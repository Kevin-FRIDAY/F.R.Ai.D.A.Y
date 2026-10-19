#!/bin/bash
# Holt die neueste Friday-Version von GitHub. Einstellungen, Gedächtnis und eigene Protokolle bleiben.
# Das Gleiche macht der Update-Knopf im Dashboard.
DEST="$HOME/Friday"
if [ ! -f "$DEST/update.sh" ]; then
  echo "Friday ist noch nicht installiert. Bitte zuerst 'Friday installieren.command' öffnen."
  read -r -p "Enter zum Schließen..."; exit 1
fi
/bin/bash "$DEST/update.sh"
echo
read -r -p "Enter zum Schließen..."
