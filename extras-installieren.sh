#!/bin/bash
# Installiert Fridays Profi-Werkzeuge in diesen Ordner:
#   .venv   – Python-Umgebung mit Whisper (Transkript), ffmpeg (Schnitt), PyTorch und Kursdaten
#   kronos  – das Prognose-Modell fürs Markt-Radar
# Lädt etwa 2 GB. Kann jederzeit erneut gestartet werden.
set -e
DEST="$(cd "$(dirname "$0")" && pwd)"

# Ein echtes Python finden (das von python.org oder Homebrew; /usr/bin/python3 ist oft nur ein Platzhalter).
PY=""
for p in /Library/Frameworks/Python.framework/Versions/Current/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3; do
  [ -x "$p" ] && { PY="$p"; break; }
done
if [ -z "$PY" ]; then
  echo "Für die Profi-Werkzeuge brauche ich Python 3 (kostenlos). Ich öffne die Download-Seite."
  echo "Installiere es und starte danach: $DEST/extras-installieren.sh"
  open "https://www.python.org/downloads/macos/"
  exit 1
fi
"$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' || { echo "Python ist zu alt (mindestens 3.10 nötig)."; exit 1; }

echo "Lege die Python-Umgebung an …"
[ -x "$DEST/.venv/bin/python" ] || "$PY" -m venv "$DEST/.venv"
VPY="$DEST/.venv/bin/python"
"$VPY" -m pip install -q --upgrade pip

echo "Installiere ffmpeg, PyTorch und Kursdaten (das dauert ein paar Minuten) …"
"$VPY" -m pip install -q imageio-ffmpeg torch numpy pandas einops huggingface_hub safetensors tqdm yfinance certifi

echo "Installiere Whisper (Transkript) …"
if [ "$(uname -m)" = "arm64" ]; then
  "$VPY" -m pip install -q mlx-whisper || echo "Whisper ließ sich nicht installieren – der Videoschnitt läuft dann ohne Transkript nicht."
else
  echo "Whisper (mlx) läuft nur auf Macs mit Apple-Chip – auf diesem Mac fällt der Videoschnitt weg."
fi

if [ ! -d "$DEST/kronos/model" ]; then
  echo "Lade Kronos (Markt-Radar) …"
  TMP="$(mktemp -d)"
  curl -fsSL --max-time 300 "https://codeload.github.com/shiyu-coder/Kronos/tar.gz/refs/heads/master" -o "$TMP/kronos.tgz"
  mkdir -p "$DEST/kronos"
  tar -xzf "$TMP/kronos.tgz" -C "$DEST/kronos" --strip-components 1
  rm -rf "$TMP"
fi

"$VPY" -c "import imageio_ffmpeg, torch" && echo "✓ Profi-Werkzeuge bereit (Videoschnitt und Markt-Radar)"
