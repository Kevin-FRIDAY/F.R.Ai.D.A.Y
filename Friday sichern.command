#!/bin/bash
# Sichert sofort Einstellungen, Schlüssel, Gedächtnis und eigene Protokolle nach ~/Friday-Backups.
# Friday macht das auch von selbst: einmal am Tag und vor jedem Update.
DEST="$HOME/Friday"
if [ ! -f "$DEST/sicherung.sh" ]; then
  echo "Friday ist noch nicht installiert (oder zu alt). Bitte zuerst aktualisieren."
  read -r -p "Enter zum Schließen..."; exit 1
fi
/bin/bash "$DEST/sicherung.sh" manuell --programm | head -1
echo
read -r -p "Enter zum Schließen..."
