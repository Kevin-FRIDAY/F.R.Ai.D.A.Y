#!/bin/bash
# Spielt eine Sicherung aus ~/Friday-Backups zurück und startet Friday neu.
# Vorher wird der jetzige Stand selbst noch gesichert ("vor-wiederherstellung"),
# damit nichts verloren geht, falls du die falsche Sicherung erwischst.
#
#   wiederherstellen.sh NAME [--programm]
#
# Ohne --programm: Einstellungen, Schlüssel, Gedächtnis, Aufgaben und eigene Protokolle.
# Mit --programm: zusätzlich die Programmversion aus der Sicherung (Zurück zur alten Version).
set -uo pipefail

# Aus einer Kopie laufen, damit das Zurückkopieren dieses Skript nicht mitten im Lauf überschreibt.
if [ -z "${FRIDAY_DEST:-}" ]; then
  KOPIE="$(mktemp "${TMPDIR:-/tmp}/friday-wiederherstellen.XXXXXX")" && cp "$0" "$KOPIE" || exit 1
  FRIDAY_DEST="$(cd "$(dirname "$0")" && pwd)" exec /bin/bash "$KOPIE" "$@"
fi
DEST="$FRIDAY_DEST"
trap 'case "$0" in *friday-wiederherstellen.*) rm -f "$0";; esac' EXIT
STATUS="$DEST/server/data/wiederherstellung.json"
getval() { grep -E "^$1=" "$DEST/server/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'; }
ROOT="$(getval BACKUP_DIR)"; ROOT="${ROOT:-$HOME/Friday-Backups}"
ROOT="${ROOT/#\~/$HOME}"

NAME=""; PROGRAMM=0
for arg in "$@"; do
  case "$arg" in
    --programm) PROGRAMM=1 ;;
    *) NAME="$arg" ;;
  esac
done

status() { # status ZUSTAND TEXT
  mkdir -p "$DEST/server/data"
  printf '{"state":"%s","message":"%s","time":"%s"}\n' "$1" "$2" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATUS"
  echo "$(date '+%F %T') $2"
}
fail() { status fehler "$1"; exit 1; }

[[ "$NAME" =~ ^20[0-9]{2}-[0-9]{2}-[0-9]{2}_[0-9A-Za-z_.-]+$ ]] || fail "Ungültiger Name der Sicherung."
SRC="$ROOT/$NAME"
[ -f "$SRC/info.json" ] || fail "Sicherung $NAME gibt es nicht."
if [ "$PROGRAMM" = 1 ] && [ ! -f "$SRC/programm/server/src/index.js" ]; then
  fail "In dieser Sicherung ist keine Programmversion enthalten."
fi

NODE="${FRIDAY_NODE:-$(command -v node || true)}"
[ -z "$NODE" ] && [ -x /opt/homebrew/bin/node ] && NODE=/opt/homebrew/bin/node
[ -z "$NODE" ] && [ -x /usr/local/bin/node ] && NODE=/usr/local/bin/node
[ -n "$NODE" ] && export PATH="$(dirname "$NODE"):/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# 1. Jetzigen Stand sichern (mit Programm, falls auch das Programm zurückgesetzt wird)
status laeuft "Sichere den jetzigen Stand..."
if [ "$PROGRAMM" = 1 ]; then
  /bin/bash "$DEST/sicherung.sh" vor-wiederherstellung --programm >/dev/null || fail "Der jetzige Stand ließ sich nicht sichern. Ich habe nichts verändert."
else
  /bin/bash "$DEST/sicherung.sh" vor-wiederherstellung >/dev/null || fail "Der jetzige Stand ließ sich nicht sichern. Ich habe nichts verändert."
fi

# 2. Programm zurücksetzen (optional)
if [ "$PROGRAMM" = 1 ]; then
  status laeuft "Spiele die alte Programmversion ein..."
  rsync -a --delete --exclude node_modules --exclude .env --exclude server/data --exclude server/eigene-protokolle.json --exclude .git \
    --exclude sicherung.sh --exclude wiederherstellen.sh --exclude "Friday sichern.command" --exclude "Friday wiederherstellen.command" \
    "$SRC/programm/" "$DEST/" || fail "Das Programm ließ sich nicht zurückkopieren."
  chmod +x "$DEST"/*.command "$DEST"/*.sh 2>/dev/null
  if [ -n "$NODE" ]; then
    NPM="$(dirname "$NODE")/npm"
    (cd "$DEST/server" && "$NPM" install --omit=dev --no-fund --no-audit --silent) &&
    (cd "$DEST/mac-agent" && "$NPM" install --omit=dev --no-fund --no-audit --silent) \
      || echo "Warnung: Bausteine ließen sich nicht installieren."
  fi
fi

# 3. Daten und Einstellungen zurückspielen
status laeuft "Spiele die Sicherung vom ${NAME:0:10} ein..."
for f in server/.env mac-agent/.env server/eigene-protokolle.json; do
  [ -f "$SRC/$f" ] && cp -p "$SRC/$f" "$DEST/$f"
done
chmod 600 "$DEST/server/.env" "$DEST/mac-agent/.env" 2>/dev/null
if [ -d "$SRC/server/data" ]; then
  rsync -a --delete --exclude update.json --exclude wiederherstellung.json "$SRC/server/data/" "$DEST/server/data/" \
    || fail "Die Daten ließen sich nicht zurückkopieren."
fi

# 4. Neu starten
status fertig "Sicherung vom ${NAME:0:10} ist wiederhergestellt."
if command -v launchctl >/dev/null; then
  launchctl kickstart -k "gui/$(id -u)/com.friday.agent" 2>/dev/null || true
  launchctl kickstart -k "gui/$(id -u)/com.friday.server" 2>/dev/null || true
fi
