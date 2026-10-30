#!/bin/bash
# Holt die neueste Friday-Version von GitHub und installiert sie.
# Deine Einstellungen (server/.env), dein Gedächtnis (server/data) und
# deine eigenen Protokolle (server/eigene-protokolle.json) bleiben erhalten.
set -uo pipefail

DEST="$(cd "$(dirname "$0")" && pwd)"
STATUS="$DEST/server/data/update.json"
BACKUP="$HOME/Friday-Sicherung"
KEEP=(--exclude node_modules --exclude .env --exclude server/data --exclude server/eigene-protokolle.json --exclude .git)
mkdir -p "$DEST/server/data"

status() { # status ZUSTAND TEXT
  printf '{"state":"%s","message":"%s","time":"%s"}\n' "$1" "$2" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATUS"
  echo "$(date '+%F %T') $2"
}
fail() { status fehler "$1"; exit 1; }
getval() { grep -E "^$1=" "$DEST/server/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'; }

REPO="$(getval UPDATE_REPO)"; REPO="${REPO:-Kevin-FRIDAY/F.R.Ai.D.A.Y}"
BRANCH="$(getval UPDATE_BRANCH)"; BRANCH="${BRANCH:-main}"
[[ "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail "UPDATE_REPO in der .env ist ungültig."
[[ "$BRANCH" =~ ^[A-Za-z0-9_./-]+$ ]] || fail "UPDATE_BRANCH in der .env ist ungültig."

NODE="${FRIDAY_NODE:-$(command -v node || true)}"
[ -z "$NODE" ] && [ -x /opt/homebrew/bin/node ] && NODE=/opt/homebrew/bin/node
[ -z "$NODE" ] && [ -x /usr/local/bin/node ] && NODE=/usr/local/bin/node
[ -n "$NODE" ] && [ -x "$NODE" ] || fail "Node.js nicht gefunden."
export PATH="$(dirname "$NODE"):/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
NPM="$(dirname "$NODE")/npm"

install_packages() {
  (cd "$DEST/server" && "$NPM" install --omit=dev --no-fund --no-audit --silent) &&
  (cd "$DEST/mac-agent" && "$NPM" install --omit=dev --no-fund --no-audit --silent)
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1. Neue Version laden und prüfen
status laeuft "Lade die neue Version von GitHub..."
curl -fsSL --max-time 180 "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" -o "$TMP/friday.tar.gz" \
  || fail "Download von GitHub hat nicht geklappt."
mkdir "$TMP/neu"
tar -xzf "$TMP/friday.tar.gz" -C "$TMP/neu" --strip-components 1 || fail "Der Download ist beschädigt."
NEW="$TMP/neu"
[ -f "$NEW/VERSION" ] && [ -f "$NEW/server/src/index.js" ] && [ -f "$NEW/mac-agent/agent.js" ] \
  || fail "Auf GitHub liegt kein vollständiges Friday."
VERSION="$(head -1 "$NEW/VERSION" | tr -cd '0-9.')"

# 2. Alte Version sichern (für den Notfall)
status laeuft "Sichere die alte Version..."
# Versionierte Sicherung in ~/Friday-Backups (Daten, Schlüssel und Programm), lässt sich später zurückholen.
if [ -f "$DEST/sicherung.sh" ]; then
  /bin/bash "$DEST/sicherung.sh" "vor-update-$(head -1 "$DEST/VERSION" 2>/dev/null | tr -cd '0-9.')" --programm >/dev/null \
    || fail "Sicherung vor dem Update hat nicht geklappt. Ich habe nichts verändert."
fi
rm -rf "$BACKUP" && mkdir -p "$BACKUP" && chmod 700 "$BACKUP"
rsync -a --exclude node_modules "$DEST/" "$BACKUP/" || fail "Sicherung hat nicht geklappt."

# 3. Neue Version einspielen
status laeuft "Installiere Version $VERSION..."
rsync -a "${KEEP[@]}" "$NEW/" "$DEST/" || fail "Kopieren hat nicht geklappt."
chmod +x "$DEST"/*.command "$DEST"/*.sh 2>/dev/null
if ! install_packages; then
  # Zurück zur alten Version, damit Friday weiterläuft
  rsync -a --delete "${KEEP[@]}" "$BACKUP/" "$DEST/"
  install_packages
  fail "Bausteine ließen sich nicht installieren. Die alte Version ist wiederhergestellt."
fi

# 4. Neu starten
status fertig "Version $VERSION ist installiert."
if command -v launchctl >/dev/null; then
  launchctl kickstart -k "gui/$(id -u)/com.friday.agent" 2>/dev/null || true
  launchctl kickstart -k "gui/$(id -u)/com.friday.server" 2>/dev/null || true
fi
