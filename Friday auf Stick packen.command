#!/bin/bash
# ============================================================
#  F.R.Ai.D.A.Y auf einen Stick packen
#  Legt einen Ordner "Friday" an (auf dem Stick oder dem Schreibtisch),
#  mit dem du Friday auf einem neuen Benutzer oder Mac einrichtest:
#  dort einfach "Friday installieren.command" im Ordner doppelklicken.
# ============================================================

SRC="$HOME/Friday"
cyan() { printf "\033[36m%s\033[0m\n" "$1"; }
gold() { printf "\033[33m%s\033[0m\n" "$1"; }
fail() { printf "\033[31m%s\033[0m\n" "$1"; echo; read -r -p "Enter zum Schließen..."; exit 1; }

clear
cyan "  F.R.Ai.D.A.Y · Umzug vorbereiten"
echo
[ -d "$SRC/server" ] || fail "Friday ist auf diesem Benutzer nicht installiert ($SRC)."

# --- 1. Ziel wählen: angeschlossene Sticks oder der Schreibtisch ---
VOLS=()
for v in /Volumes/*; do
  [ -d "$v" ] && [ -w "$v" ] || continue
  [ "$(cd "$v" && pwd -P)" = "/" ] && continue   # die eigene Festplatte überspringen
  VOLS+=("$v")
done
echo "Wohin soll das Friday-Paket?"
i=1
for v in "${VOLS[@]}"; do
  echo "  $i) $(basename "$v")  ($(df -h "$v" | awk 'NR==2{print $4}') frei)"
  i=$((i + 1))
done
echo "  $i) Schreibtisch (danach selbst auf den Stick ziehen)"
read -r -p "Nummer [$i]: " N
N="${N:-$i}"
if [ "$N" -ge 1 ] 2>/dev/null && [ "$N" -lt "$i" ]; then TARGET="${VOLS[$((N - 1))]}"; else TARGET="$HOME/Desktop"; fi
OUT="$TARGET/Friday"
if [ -e "$OUT" ]; then
  read -r -p "Dort liegt schon ein Friday-Ordner. Ersetzen? (j/n) [n]: " A
  [ "$A" = "j" ] || fail "Abgebrochen, nichts verändert."
  rm -rf "$OUT"
fi
mkdir -p "$OUT/umzug" || fail "Ich kann in $TARGET nicht schreiben."

# --- 2. Programm (ohne Dinge, die auf dem neuen Benutzer frisch installiert werden) ---
echo "Kopiere Friday …"
# -rlt statt -a: Sticks (exFAT/FAT) können keine Mac-Rechte speichern.
rsync -rlt --exclude node_modules --exclude .venv --exclude kronos --exclude __pycache__ --exclude .git \
  --exclude '.env' --exclude 'server/data' --exclude 'server/eigene-protokolle.json' --exclude umzug \
  "$SRC/" "$OUT/" || fail "Kopieren hat nicht geklappt."
echo "✓ Programm"

# --- 3. Gedächtnis, Einstellungen, Energie, Depot ---
mkdir -p "$OUT/umzug/server-data"
rsync -rlt --exclude '*.tmp' "$SRC/server/data/" "$OUT/umzug/server-data/" || fail "Daten ließen sich nicht kopieren."
[ -f "$SRC/server/eigene-protokolle.json" ] && cp "$SRC/server/eigene-protokolle.json" "$OUT/umzug/"
echo "✓ Gedächtnis und Einstellungen"

# --- 4. Schlüssel und Passwort (optional) ---
KEYS=0
echo
gold "Schlüssel und Passwort mitnehmen?"
echo "Dann musst du auf dem neuen Benutzer nichts neu eingeben. Achtung: Wer den Stick hat, hat dann auch deine Schlüssel."
read -r -p "Mitnehmen? (j/n) [j]: " K
if [ "${K:-j}" = "j" ] && [ -f "$SRC/server/.env" ]; then
  cp "$SRC/server/.env" "$OUT/umzug/server.env" && KEYS=1
  echo "✓ Schlüssel"
fi

# --- 5. Eigene Inhalte ---
for d in Friday-Webseiten Friday-Video Friday-Archiv; do
  if [ -d "$HOME/$d" ] && [ -n "$(ls -A "$HOME/$d" 2>/dev/null)" ]; then
    SIZE="$(du -sh "$HOME/$d" | cut -f1)"
    read -r -p "$d ($SIZE) mitnehmen? (j/n) [j]: " A
    [ "${A:-j}" = "j" ] && rsync -rlt "$HOME/$d/" "$OUT/umzug/$d/" && echo "✓ $d"
  fi
done

# --- 6. Für die Entwicklung: Claudes Gedächtnis zu Friday und git-Name ---
for MEMDIR in "$HOME"/.claude/projects/*/memory; do
  [ -f "$MEMDIR/MEMORY.md" ] && grep -qi "friday" "$MEMDIR/MEMORY.md" || continue
  mkdir -p "$OUT/umzug/claude-gedaechtnis"
  rsync -rlt "$MEMDIR/" "$OUT/umzug/claude-gedaechtnis/"
done
[ -d "$OUT/umzug/claude-gedaechtnis" ] && echo "✓ Claudes Gedächtnis zu Friday"
GIT_NAME="$(git config --global user.name 2>/dev/null)"; GIT_MAIL="$(git config --global user.email 2>/dev/null)"
printf 'GIT_NAME=%q\nGIT_MAIL=%q\n' "$GIT_NAME" "$GIT_MAIL" > "$OUT/umzug/git-identitaet"

# --- 7. Anleitung ---
cat > "$OUT/LIES MICH - Umzug.txt" <<'TXT'
F.R.Ai.D.A.Y auf einem neuen Benutzer oder Mac einrichten
=========================================================

1. Diesen Ordner "Friday" vom Stick auf den neuen Benutzer kopieren (z. B. auf den Schreibtisch).
2. Im Ordner "Friday installieren.command" doppelklicken
   (beim ersten Mal: Rechtsklick > Öffnen).
3. Der Installer übernimmt automatisch dein Gedächtnis, deine Einstellungen,
   deine Schlüssel (falls mitgenommen) und deine Webseiten/Videos.
4. Er fragt, ob er die Profi-Werkzeuge (Videoschnitt, Markt-Radar, ca. 2 GB) installieren soll.
5. Danach "Entwickler einrichten.command" doppelklicken: Es richtet git, die GitHub-Anmeldung,
   Fridays Code (Friday-Repo), Claude Code und Claudes Gedächtnis zu Friday ein.
6. Die Claude-App öffnen, mit deinem Claude-Konto anmelden und beim Projekt den Mac-Zugriff
   (Remote Control) für den neuen Benutzer einschalten. Dann kann Claude dort weiterbauen.

Gut zu wissen:
- Node.js muss auf dem Mac installiert sein (nodejs.org), für die Profi-Werkzeuge auch Python 3 (python.org).
- Läuft Friday gleichzeitig noch beim alten Benutzer, nimmt der neue automatisch einen anderen Port.
- Tailscale (Zugriff vom iPhone) muss auf einem neuen Mac neu eingerichtet werden.
- Osiris (die Live-Karte) gehört nicht zu diesem Paket.
- Liegen deine Schlüssel auf dem Stick: Ordner nach dem Umzug löschen oder den Stick gut aufbewahren.
TXT
chmod +x "$OUT"/*.command "$OUT"/*.sh 2>/dev/null

SIZE="$(du -sh "$OUT" | cut -f1)"
echo
gold "Fertig. Das Paket liegt in: $OUT ($SIZE)"
[ "$KEYS" = 1 ] && gold "Darin liegen deine Schlüssel – nach dem Umzug löschen oder den Stick sicher aufbewahren."
open "$OUT"
echo
read -r -p "Enter zum Schließen..."
