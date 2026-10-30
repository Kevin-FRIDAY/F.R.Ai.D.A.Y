#!/bin/bash
# Holt eine Sicherung zurück. Funktioniert auch, wenn Friday selbst nicht mehr startet.
DEST="$HOME/Friday"
gold() { printf "\033[33m%s\033[0m\n" "$1"; }
if [ ! -f "$DEST/wiederherstellen.sh" ]; then
  echo "In $DEST fehlt das Wiederherstellen-Skript."
  read -r -p "Enter zum Schließen..."; exit 1
fi
getval() { grep -E "^$1=" "$DEST/server/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'; }
ROOT="$(getval BACKUP_DIR)"; ROOT="${ROOT:-$HOME/Friday-Backups}"; ROOT="${ROOT/#\~/$HOME}"

LISTE=()
while IFS= read -r d; do LISTE+=("$(basename "$d")"); done < <(ls -1d "$ROOT"/20??-??-??_* 2>/dev/null | sort -r)
if [ ${#LISTE[@]} -eq 0 ]; then
  echo "In $ROOT liegen noch keine Sicherungen."
  read -r -p "Enter zum Schließen..."; exit 1
fi

clear
gold "  F.R.Ai.D.A.Y · Sicherung zurückholen"
echo
for i in "${!LISTE[@]}"; do
  n="${LISTE[$i]}"
  info="$(cat "$ROOT/$n/info.json" 2>/dev/null)"
  ver="$(printf '%s' "$info" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)"
  prog=""; printf '%s' "$info" | grep -q '"programm":true' && prog=" + Programm"
  printf "  %2d)  %s  %s  %-22s  v%s%s\n" "$((i + 1))" "${n:0:10}" "$(echo "${n:11:8}" | tr - :)" "${n:20}" "${ver:-?}" "$prog"
done
echo
read -r -p "Welche Nummer? (Enter = abbrechen): " NR
[[ "$NR" =~ ^[0-9]+$ ]] && [ "$NR" -ge 1 ] && [ "$NR" -le ${#LISTE[@]} ] || { echo "Abgebrochen."; exit 0; }
NAME="${LISTE[$((NR - 1))]}"

ARGS=("$NAME")
if [ -d "$ROOT/$NAME/programm" ]; then
  read -r -p "Auch die Programmversion von damals zurückholen? (j/N): " P
  [[ "$P" =~ ^[jJyY] ]] && ARGS+=(--programm)
fi
read -r -p "Sicherung vom ${NAME:0:10} jetzt einspielen? Der jetzige Stand wird vorher gesichert. (j/N): " OK
[[ "$OK" =~ ^[jJyY] ]] || { echo "Abgebrochen."; exit 0; }
/bin/bash "$DEST/wiederherstellen.sh" "${ARGS[@]}"
echo
read -r -p "Enter zum Schließen..."
