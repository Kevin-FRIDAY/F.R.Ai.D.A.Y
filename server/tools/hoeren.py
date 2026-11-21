"""Fridays Ohr auf dem Mac: Whisper (mlx-whisper, läuft lokal auf dem Apple-Chip).

Bleibt als Hintergrund-Prozess an, damit das Sprachmodell nur einmal geladen wird.
Liest pro Zeile einen Auftrag als JSON von stdin:  {"id": "...", "datei": "/pfad/aufnahme.webm", "modell": "..."}
Schreibt pro Zeile die Antwort als JSON auf stdout: {"id": "...", "text": "...", "sprache": "de"} oder {"id": "...", "error": "..."}
"""
import json
import os
import sys

import imageio_ffmpeg

# Whisper ruft "ffmpeg" über den Namen auf: das mitgelieferte Programm in den PATH legen.
FF = imageio_ffmpeg.get_ffmpeg_exe()
BIN = os.path.join(os.path.expanduser("~"), ".friday-hoeren-bin")
os.makedirs(BIN, exist_ok=True)
LINK = os.path.join(BIN, "ffmpeg")
if os.path.realpath(LINK) != os.path.realpath(FF):
    if os.path.lexists(LINK):
        os.remove(LINK)
    os.symlink(FF, LINK)
os.environ["PATH"] = BIN + os.pathsep + os.environ.get("PATH", "")

import mlx_whisper  # noqa: E402  (erst nach dem PATH)


def sende(**d):
    sys.stdout.write(json.dumps(d, ensure_ascii=False) + "\n")
    sys.stdout.flush()


sende(type="bereit")
for zeile in sys.stdin:
    zeile = zeile.strip()
    if not zeile:
        continue
    try:
        a = json.loads(zeile)
    except ValueError:
        continue
    aid = a.get("id", "")
    try:
        res = mlx_whisper.transcribe(
            a["datei"],
            path_or_hf_repo=a.get("modell") or "mlx-community/whisper-small-mlx",
            language=a.get("sprache") or "de",
            condition_on_previous_text=False,
            initial_prompt=a.get("hinweis") or "Friday, Boss.",
            verbose=None,
        )
        text = (res.get("text") or "").strip()
        # Stille: Whisper erfindet dann gern Sätze. Abschnitte, die wahrscheinlich keine Sprache sind, weglassen.
        segs = res.get("segments") or []
        if segs and all((s.get("no_speech_prob") or 0) > 0.6 for s in segs):
            text = ""
        sende(id=aid, text=text, sprache=res.get("language") or "de")
    except Exception as e:  # noqa: BLE001
        sende(id=aid, error=str(e)[:300])
