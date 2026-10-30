#!/bin/bash
# Erstellt eine Sicherung von allem, was nur auf diesem Mac liegt:
# Einstellungen + Schlüssel (server/.env, mac-agent/.env), Gedächtnis, Aufgaben,
# Erinnerungen (server/data) und eigene Protokolle.
# Mit --programm wird zusätzlich das ganze Programm gesichert (für ein Zurück zur alten Version).
#
#   sicherung.sh [GRUND] [--programm]
#
# Die Sicherungen liegen in ~/Friday-Backups (änderbar mit BACKUP_DIR in server/.env).
# Die letzte Zeile der Ausgabe ist der Name der neuen Sicherung.
set -uo pipefail

DEST="$(cd "$(dirname "$0")" && pwd)"
getval() { grep -E "^$1=" "$DEST/server/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'; }

ROOT="$(getval BACKUP_DIR)"; ROOT="${ROOT:-$HOME/Friday-Backups}"
ROOT="${ROOT/#\~/$HOME}"
KEEP="$(getval BACKUP_KEEP)"; [[ "$KEEP" =~ ^[0-9]+$ ]] && [ "$KEEP" -ge 3 ] || KEEP=30
KEEP_PROGRAMM=3

GRUND="manuell"; PROGRAMM=0
for arg in "$@"; do
  case "$arg" in
    --programm) PROGRAMM=1 ;;
    *) GRUND="$arg" ;;
  esac
done
GRUND="$(printf '%s' "$GRUND" | tr -c 'A-Za-z0-9.-' '-' | cut -c1-40)"

VERSION="$(head -1 "$DEST/VERSION" 2>/dev/null | tr -cd '0-9.')"
NAME="$(date '+%Y-%m-%d_%H-%M-%S')_$GRUND"
[ -e "$ROOT/$NAME" ] && NAME="${NAME}-$$"
TARGET="$ROOT/$NAME"
WORK="$ROOT/.neu-$NAME"

mkdir -p "$ROOT" && chmod 700 "$ROOT" || { echo "Sicherungsordner $ROOT lässt sich nicht anlegen." >&2; exit 1; }
rm -rf "$WORK" && mkdir -p "$WORK/server" "$WORK/mac-agent" || exit 1

copy_if() { [ -e "$DEST/$1" ] && cp -p "$DEST/$1" "$WORK/$1"; return 0; }
copy_if server/.env
copy_if mac-agent/.env
copy_if server/eigene-protokolle.json
copy_if VERSION
if [ -d "$DEST/server/data" ]; then
  rsync -a --exclude '*.tmp' "$DEST/server/data/" "$WORK/server/data/" || { rm -rf "$WORK"; echo "Daten ließen sich nicht kopieren." >&2; exit 1; }
fi
if [ "$PROGRAMM" = 1 ]; then
  rsync -a --exclude node_modules --exclude .env --exclude server/data --exclude .git "$DEST/" "$WORK/programm/" \
    || { rm -rf "$WORK"; echo "Programm ließ sich nicht kopieren." >&2; exit 1; }
fi

printf '{"name":"%s","grund":"%s","version":"%s","zeit":"%s","programm":%s}\n' \
  "$NAME" "$GRUND" "$VERSION" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$([ "$PROGRAMM" = 1 ] && echo true || echo false)" > "$WORK/info.json"
chmod -R go-rwx "$WORK"
mv "$WORK" "$TARGET" || exit 1

# Aufräumen: nur die neuesten $KEEP Sicherungen behalten, Programmkopien nur in den neuesten $KEEP_PROGRAMM.
cd "$ROOT" || exit 0
ls -1d 20??-??-??_* 2>/dev/null | sort -r | tail -n +"$((KEEP + 1))" | while read -r old; do rm -rf "$ROOT/$old"; done
ls -1d 20??-??-??_*/programm 2>/dev/null | sort -r | tail -n +"$((KEEP_PROGRAMM + 1))" | while read -r old; do
  rm -rf "$ROOT/$old"
  sed -i '' 's/"programm":true/"programm":false/' "$ROOT/$(dirname "$old")/info.json" 2>/dev/null \
    || sed -i 's/"programm":true/"programm":false/' "$ROOT/$(dirname "$old")/info.json"
done
find "$ROOT" -maxdepth 1 -name ".neu-*" -mtime +0 -exec rm -rf {} + 2>/dev/null

echo "Sicherung erstellt: $TARGET"
echo "$NAME"
