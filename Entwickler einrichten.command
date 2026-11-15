#!/bin/bash
# ============================================================
#  Entwickler-Werkzeuge für Friday auf einem neuen Benutzer:
#  git, GitHub-Anmeldung, Fridays Code (Friday-Repo), Claude Code
#  und Claudes Gedächtnis zu Friday.
#  Erst "Friday installieren.command" ausführen, dann dieses hier.
# ============================================================

SRC="$(cd "$(dirname "$0")" && pwd)"
UMZUG="$SRC/umzug"
REPO_URL="https://github.com/Kevin-FRIDAY/F.R.Ai.D.A.Y.git"
REPO_DIR="$HOME/Friday-Repo"
WORK="$HOME/TEST AI "   # Arbeitsordner für Claude Code (gleicher Name wie beim alten Benutzer)
BIN="$HOME/.local/bin"

cyan() { printf "\033[36m%s\033[0m\n" "$1"; }
gold() { printf "\033[33m%s\033[0m\n" "$1"; }
fail() { printf "\033[31m%s\033[0m\n" "$1"; echo; read -r -p "Enter zum Schließen..."; exit 1; }
add_line() { grep -qsF "$1" "$HOME/.zprofile" || echo "$1" >> "$HOME/.zprofile"; }

clear
cyan "  F.R.Ai.D.A.Y · Entwickler-Werkzeuge einrichten"
echo
mkdir -p "$BIN"
add_line 'export PATH="$HOME/.local/bin:$PATH"'
export PATH="$BIN:$PATH"

# --- 1. git ---
if ! /usr/bin/xcode-select -p >/dev/null 2>&1; then
  gold "Für git brauche ich Apples Entwickler-Werkzeuge. Es öffnet sich gleich ein Fenster: dort auf 'Installieren' klicken."
  xcode-select --install 2>/dev/null
  fail "Wenn die Installation fertig ist, starte dieses Programm nochmal."
fi
if ! git --version >/dev/null 2>&1; then
  # Ist die Xcode-Lizenz nicht bestätigt, git der Command Line Tools nehmen.
  if [ -d /Library/Developer/CommandLineTools ] && DEVELOPER_DIR=/Library/Developer/CommandLineTools git --version >/dev/null 2>&1; then
    add_line 'export DEVELOPER_DIR=/Library/Developer/CommandLineTools'
    export DEVELOPER_DIR=/Library/Developer/CommandLineTools
  else
    fail "git funktioniert nicht. Öffne das Terminal und gib 'xcode-select --install' ein, danach nochmal starten."
  fi
fi
echo "✓ $(git --version)"
if [ -f "$UMZUG/git-identitaet" ]; then
  # shellcheck disable=SC1091
  . "$UMZUG/git-identitaet"
  [ -n "$GIT_NAME" ] && git config --global user.name "$GIT_NAME"
  [ -n "$GIT_MAIL" ] && git config --global user.email "$GIT_MAIL"
fi

# --- 2. Fridays Code von GitHub ---
if [ -d "$REPO_DIR/.git" ]; then
  echo "✓ Friday-Repo ist schon da ($REPO_DIR)"
else
  git clone -q "$REPO_URL" "$REPO_DIR" || fail "Fridays Code ließ sich nicht von GitHub laden."
  echo "✓ Fridays Code liegt in $REPO_DIR"
fi

# --- 3. GitHub-Anmeldung (damit Claude Updates hochladen kann) ---
if ! command -v gh >/dev/null 2>&1; then
  echo "Lade die GitHub-Anmeldung (gh) …"
  ARCH="$( [ "$(uname -m)" = arm64 ] && echo arm64 || echo amd64 )"
  URL="$(curl -fsSL --max-time 20 https://api.github.com/repos/cli/cli/releases/latest | /usr/bin/python3 -c "import json,sys; print(next(a['browser_download_url'] for a in json.load(sys.stdin)['assets'] if a['name'].endswith('_macOS_$ARCH.zip')))" 2>/dev/null)"
  if [ -n "$URL" ]; then
    TMP="$(mktemp -d)"
    curl -fsSL --max-time 120 "$URL" -o "$TMP/gh.zip" && unzip -q "$TMP/gh.zip" -d "$TMP" && cp "$TMP"/gh_*/bin/gh "$BIN/gh" && chmod +x "$BIN/gh"
    rm -rf "$TMP"
  fi
fi
if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    echo "✓ Bei GitHub angemeldet"
  else
    gold "Melde dich jetzt bei GitHub an (als Kevin-FRIDAY). Es öffnet sich der Browser, dort den angezeigten Code eingeben."
    gh auth login --hostname github.com --git-protocol https --web && gh auth setup-git && echo "✓ Bei GitHub angemeldet"
  fi
else
  gold "Die GitHub-Anmeldung konnte ich nicht laden. Beim ersten Hochladen fragt git dann selbst nach deinem Login."
fi

# --- 4. Claude Code ---
if command -v claude >/dev/null 2>&1; then
  echo "✓ Claude Code ist da ($(claude --version 2>/dev/null | head -1))"
else
  echo "Installiere Claude Code (offizielles Installationsprogramm von claude.ai) …"
  curl -fsSL https://claude.ai/install.sh | bash || gold "Claude Code ließ sich nicht installieren. Später nochmal: curl -fsSL https://claude.ai/install.sh | bash"
fi

# --- 5. Arbeitsordner und Claudes Gedächtnis zu Friday ---
mkdir -p "$WORK"
if [ -d "$UMZUG/claude-gedaechtnis" ]; then
  KEY="$(printf '%s' "$WORK" | sed 's/[^A-Za-z0-9]/-/g')"   # so benennt Claude Code seine Projektordner
  MEM="$HOME/.claude/projects/$KEY/memory"
  mkdir -p "$MEM"
  rsync -a --ignore-existing "$UMZUG/claude-gedaechtnis/" "$MEM/" && echo "✓ Claudes Gedächtnis zu Friday übernommen"
fi

echo
gold "Fertig. Noch zwei Dinge, die nur du machen kannst:"
echo "  1. Die Claude-App öffnen und dich mit deinem Claude-Konto anmelden."
echo "     Dein Projekt mit allen Threads liegt in deinem Konto und ist sofort wieder da."
echo "  2. In der Claude-App bei diesem Projekt den Mac-Zugriff (Remote Control) für diesen Benutzer"
echo "     einschalten und als Ordner \"$WORK\" wählen. Dann arbeite ich hier weiter."
echo "     Für Claude Code im Terminal: in den Ordner wechseln, 'claude' tippen und anmelden."
echo
read -r -p "Enter zum Schließen..."
