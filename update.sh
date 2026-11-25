#!/bin/bash
# Holt die neueste Friday-Version von GitHub und installiert sie.
# Deine Einstellungen (server/.env), dein Gedächtnis (server/data) und
# deine eigenen Protokolle (server/eigene-protokolle.json) bleiben erhalten.
set -uo pipefail

DEST="$(cd "$(dirname "$0")" && pwd)"
STATUS="$DEST/server/data/update.json"
BACKUP="$HOME/Friday-Sicherung"
KEEP=(--exclude node_modules --exclude .env --exclude server/data --exclude server/eigene-protokolle.json --exclude .git --exclude .venv --exclude kronos)
mkdir -p "$DEST/server/data"

# Fortschritt für den Ladebalken im Dashboard: Schritt (laden, sichern, installieren, neustart) und Prozent.
SCHRITT=start; PROZENT=3; ZIEL=""; VON="$(head -1 "$DEST/VERSION" 2>/dev/null | tr -cd '0-9.')"; START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
AUTO="${FRIDAY_UPDATE_AUTO:-0}"; [ "$AUTO" = 1 ] && AUTO=true || AUTO=false
status() { # status ZUSTAND TEXT [SCHRITT PROZENT]
  [ -n "${3:-}" ] && SCHRITT="$3"
  [ -n "${4:-}" ] && PROZENT="$4"
  printf '{"state":"%s","message":"%s","step":"%s","percent":%s,"von":"%s","ziel":"%s","auto":%s,"started":"%s","time":"%s"}\n' \
    "$1" "$2" "$SCHRITT" "$PROZENT" "$VON" "$ZIEL" "$AUTO" "$START" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATUS.tmp" && mv -f "$STATUS.tmp" "$STATUS"
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

# GitHub-Schlüssel (nur für ein privates Repo): von Friday übergeben, aus dem Dashboard
# (server/data/github.json) oder aus der .env (FRIDAY_GITHUB_TOKEN). Ohne Schlüssel wie bisher.
TOKEN="${FRIDAY_GITHUB_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f "$DEST/server/data/github.json" ]; then
  TOKEN="$("$NODE" -e 'try{process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).token||""))}catch{}' "$DEST/server/data/github.json" 2>/dev/null)"
fi
[ -z "$TOKEN" ] && TOKEN="$(getval FRIDAY_GITHUB_TOKEN)"
TOKEN="$(printf '%s' "$TOKEN" | tr -cd 'A-Za-z0-9_')"
GH_API="${FRIDAY_GITHUB_API:-https://api.github.com}"
GH_CODELOAD="${FRIDAY_GITHUB_CODELOAD:-https://codeload.github.com}"

# 1. Neue Version laden und prüfen
status laeuft "Lade die neue Version von GitHub..." laden 8
if [ -n "$TOKEN" ]; then
  # Schlüssel steht in einer Datei, nicht in der Befehlszeile (sonst wäre er in der Prozessliste sichtbar).
  ( umask 077; printf 'Authorization: Bearer %s\n' "$TOKEN" > "$TMP/auth.txt" )
  HTTP="$(curl -sSL --max-time 180 -H @"$TMP/auth.txt" -H "Accept: application/vnd.github+json" -H "User-Agent: Friday-Updater" \
    -w '%{http_code}' "$GH_API/repos/$REPO/tarball/$BRANCH" -o "$TMP/friday.tar.gz")" || HTTP=000
  rm -f "$TMP/auth.txt"
  case "$HTTP" in
    200) ;;
    401) fail "Der GitHub-Schlüssel stimmt nicht oder ist abgelaufen. Trag in den Einstellungen einen neuen ein." ;;
    403|404) fail "Der GitHub-Schlüssel darf das Friday-Repo nicht lesen (Contents: Read-only nötig)." ;;
    *) fail "Download von GitHub hat nicht geklappt." ;;
  esac
else
  curl -fsSL --max-time 180 "$GH_CODELOAD/$REPO/tar.gz/refs/heads/$BRANCH" -o "$TMP/friday.tar.gz" \
    || fail "Download von GitHub hat nicht geklappt. Ist das Repo privat? Dann trag in den Einstellungen deinen GitHub-Schlüssel ein."
fi
mkdir "$TMP/neu"
status laeuft "Prüfe den Download..." laden 22
tar -xzf "$TMP/friday.tar.gz" -C "$TMP/neu" --strip-components 1 || fail "Der Download ist beschädigt."
NEW="$TMP/neu"
[ -f "$NEW/VERSION" ] && [ -f "$NEW/server/src/index.js" ] && [ -f "$NEW/mac-agent/agent.js" ] \
  || fail "Auf GitHub liegt kein vollständiges Friday."
VERSION="$(head -1 "$NEW/VERSION" | tr -cd '0-9.')"
ZIEL="$VERSION"

# 1b. Testlabor (Update-Sandbox): die neue Version prüfen, BEVOR irgendetwas verändert wird.
# Benutzt das Prüfprogramm der installierten Version (nicht das aus dem Download).
if [ -f "$DEST/server/src/testlabor.js" ] && [ "${FRIDAY_OHNE_TESTLABOR:-0}" != 1 ]; then
  status laeuft "Teste die neue Version im Testlabor..." laden 25
  if ! "$NODE" "$DEST/server/src/testlabor.js" "$NEW" > "$TMP/testlabor.txt" 2>&1; then
    GRUND="$(head -1 "$TMP/testlabor.txt" | tr -d '"\\' | cut -c1-180)"
    mkdir -p "$DEST/server/data" && cp "$TMP/testlabor.txt" "$DEST/server/data/testlabor-letztes.txt" 2>/dev/null
    fail "$GRUND. Ich habe nichts verändert."
  fi
  cp "$TMP/testlabor.txt" "$DEST/server/data/testlabor-letztes.txt" 2>/dev/null
fi

# 2. Alte Version sichern (für den Notfall)
status laeuft "Sichere die alte Version..." sichern 28
# Versionierte Sicherung in ~/Friday-Backups (Daten, Schlüssel und Programm), lässt sich später zurückholen.
if [ -f "$DEST/sicherung.sh" ]; then
  /bin/bash "$DEST/sicherung.sh" "vor-update-$(head -1 "$DEST/VERSION" 2>/dev/null | tr -cd '0-9.')" --programm >/dev/null \
    || fail "Sicherung vor dem Update hat nicht geklappt. Ich habe nichts verändert."
fi
status laeuft "Lege die Notfall-Kopie an..." sichern 45
rm -rf "$BACKUP" && mkdir -p "$BACKUP" && chmod 700 "$BACKUP"
rsync -a --exclude node_modules --exclude .venv --exclude kronos "$DEST/" "$BACKUP/" || fail "Sicherung hat nicht geklappt."

# 3. Neue Version einspielen
status laeuft "Installiere Version $VERSION..." installieren 55
rsync -a "${KEEP[@]}" "$NEW/" "$DEST/" || fail "Kopieren hat nicht geklappt."
chmod +x "$DEST"/*.command "$DEST"/*.sh 2>/dev/null
status laeuft "Installiere die Bausteine..." installieren 68
if ! install_packages; then
  # Zurück zur alten Version, damit Friday weiterläuft
  rsync -a --delete "${KEEP[@]}" "$BACKUP/" "$DEST/"
  install_packages
  fail "Bausteine ließen sich nicht installieren. Die alte Version ist wiederhergestellt."
fi

# 4. Neu starten
neustart() {
  if command -v launchctl >/dev/null; then
    launchctl kickstart -k "gui/$(id -u)/com.friday.agent" 2>/dev/null || true
    launchctl kickstart -k "gui/$(id -u)/com.friday.server" 2>/dev/null || true
    return 0
  fi
  return 1
}
# Gesundheits-Check (v1.183.0): Antwortet Friday nach dem Neustart innerhalb von 90 Sekunden?
gesund() {
  local port; port="$(getval PORT)"; port="${port:-3000}"
  for _ in $(seq 1 45); do
    sleep 2
    [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$port/" 2>/dev/null)" = 200 ] && return 0
  done
  return 1
}
status fertig "Version $VERSION ist installiert. Friday startet neu..." neustart 90
if neustart && [ "${FRIDAY_OHNE_GESUNDHEITSCHECK:-0}" != 1 ]; then
  if ! gesund; then
    # Rollback: Die neue Version startet nicht → alte Version zurück, damit Friday weiterläuft.
    echo "$(date '+%F %T') Version $VERSION startet nicht. Rollback auf $VON."
    rsync -a --delete "${KEEP[@]}" "$BACKUP/" "$DEST/"
    install_packages
    printf '{"zeit":"%s","von":"%s","ziel":"%s","grund":"Friday hat nach dem Update nicht geantwortet (Gesundheits-Check)."}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$VON" "$VERSION" > "$DEST/server/data/update-rollback.json"
    neustart
    if gesund; then fail "Version $VERSION startete nicht. Die alte Version $VON ist wiederhergestellt und läuft."; fi
    fail "Version $VERSION startete nicht, und die alte Version antwortet auch nicht. Bitte Friday wiederherstellen.command starten."
  fi
  status fertig "Version $VERSION ist installiert und läuft." neustart 100
fi
