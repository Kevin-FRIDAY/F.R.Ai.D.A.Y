#!/usr/bin/env python3
"""Fridays Videoschnitt-Team.

Nimmt alle Clips aus ~/Friday-Video/Eingang und macht daraus ein 9:16-Video in
~/Friday-Video/Fertig. Jeder Agent meldet seinen Stand als JSON-Zeile auf stdout:
  Transkript  – mlx-whisper (lokal) schreibt jedes Wort mit Zeitstempel mit
  Audio       – misst die Lautstärke je Clip (läuft parallel zum Transkript)
  Farbe       – misst die Helligkeit je Clip (läuft parallel zum Transkript)
  Schnitt     – schneidet Pausen und Ähms anhand des Transkripts raus
  Untertitel  – baut animierte Untertitel (.ass) im TikTok-Stil
  Regie       – setzt alles mit ffmpeg zusammen und prüft das Ergebnis
"""
import glob
import json
import os
import re
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
BASE = os.environ.get("FRIDAY_VIDEO_DIR") or os.path.join(os.path.expanduser("~"), "Friday-Video")
IN, OUT, WORK, LUTS, MUSIK = (os.path.join(BASE, d) for d in ("Eingang", "Fertig", ".arbeit", "LUTs", "Musik"))
MODEL = os.environ.get("FRIDAY_WHISPER", "mlx-community/whisper-small-mlx")
LOOK = os.environ.get("FRIDAY_LOOK", "natürlich")
# Kevins Anweisung, von Friday schon in Vorgaben übersetzt (server/src/regieplan.js)
try:
    V = json.loads(os.environ.get("FRIDAY_VORGABEN") or "{}")
except ValueError:
    V = {}
PAUSEN = V.get("pausen") or "normal"            # hart | normal | sanft
AEHMS_RAUS = V.get("aehms", "raus") != "drin"
MAX_SEK = float(V["maxSekunden"]) if V.get("maxSekunden") else None
FOKUS = [w.lower() for w in (V.get("fokus") or []) if w]
UNTERTITEL = V.get("untertitel", True) is not False
MUSIK_AN = V.get("musik", "an") != "aus"
TITEL = (V.get("titel") or "").strip()
ABSPANN = (V.get("abspann") or "").strip()
FARBE = V.get("farbe")  # "#rrggbb" oder None
HL = "&H0000FFFF&"
FONTS = "/System/Library/Fonts/Supplemental"
VIDEO_EXT = (".mp4", ".mov", ".m4v", ".mkv", ".webm")
FILLER = {"äh", "ähm", "öhm", "ehm", "hm", "hmm", "mhm", "uh", "um", "uhm", "äää", "ähh", "ääh", "öh"}
LOOKS = {
    "natürlich": "eq=contrast=1.05:saturation=1.08",
    "warm": "eq=contrast=1.06:saturation=1.12,colorbalance=rs=0.05:bs=-0.05:rm=0.03:bm=-0.03",
    "kühl": "colorbalance=rs=-0.04:bs=0.05,eq=contrast=1.05:saturation=1.02",
    "kino": "eq=contrast=1.12:saturation=0.92,colorbalance=bs=0.06:rs=-0.02:rh=0.05:bh=-0.04",
    "schwarzweiss": "hue=s=0,eq=contrast=1.12:brightness=0.01",
    "retro": "curves=preset=vintage,eq=saturation=0.9,vignette=PI/4",
    "neon": "eq=contrast=1.1:saturation=1.3,colorbalance=rs=0.04:bs=0.06:gm=-0.02",
}

_lock = threading.Lock()


def emit(**kw):
    with _lock:
        print(json.dumps(kw, ensure_ascii=False), flush=True)


def agent(name, status, text="", pct=None):
    emit(type="agent", agent=name, status=status, text=text, pct=pct)


def ff(args, **kw):
    return subprocess.run([FF, "-hide_banner", "-nostdin", *args], capture_output=True, text=True, **kw)


def esc(path):
    """Pfad für einen ffmpeg-Filter maskieren."""
    return path.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def clean(word):
    return re.sub(r"[{}\\]", "", word).strip()


def is_filler(word):
    return AEHMS_RAUS and re.sub(r"[^\wäöüß]", "", word.lower()) in FILLER


def ass_farbe(hexfarbe, standard="&H0000FFFF&"):
    m = re.match(r"^#?([0-9a-fA-F]{6})$", hexfarbe or "")
    if not m:
        return standard
    r, g, b = m[1][0:2], m[1][2:4], m[1][4:6]
    return f"&H00{b}{g}{r}&".upper()


# ---------- Regie: Plan ----------
def find_clips():
    files = sorted(f for f in glob.glob(os.path.join(IN, "*")) if f.lower().endswith(VIDEO_EXT))
    clips = []
    for path in files:
        err = ff(["-i", path]).stderr
        m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err)
        dur = int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 0.0
        if dur > 0.3:
            clips.append({"path": path, "name": os.path.basename(path), "dur": dur, "audio": "Audio:" in err})
    return clips


# ---------- Transkript ----------
def transcribe(clips):
    agent("transkript", "läuft", "Lade Sprachmodell (beim ersten Mal ein Download) …", 0)
    import mlx_whisper

    for i, c in enumerate(clips):
        c["words"] = []
        agent("transkript", "läuft", f"Clip {i + 1}/{len(clips)}: {c['name']}", int(i / len(clips) * 100))
        if not c["audio"]:
            continue
        wav = os.path.join(WORK, f"{i}.wav")
        ff(["-y", "-i", c["path"], "-vn", "-ac", "1", "-ar", "16000", wav])
        res = mlx_whisper.transcribe(wav, path_or_hf_repo=MODEL, language="de", word_timestamps=True, verbose=None)
        for seg in res.get("segments", []):
            for w in seg.get("words", []):
                text = clean(w.get("word", ""))
                if text:
                    c["words"].append({"w": text, "s": float(w["start"]), "e": float(w["end"])})
        with open(os.path.join(WORK, f"{i}.txt"), "w", encoding="utf-8") as f:
            f.write(res.get("text", "").strip())
    n = sum(len(c["words"]) for c in clips)
    agent("transkript", "fertig", f"{n} Wörter mitgeschrieben", 100)


# ---------- Audio (Messung) ----------
def analyse_audio(clips):
    agent("audio", "läuft", "Messe Lautstärke je Clip …", 0)
    for i, c in enumerate(clips):
        c["gain"], c["lufs"] = 0.0, None
        if c["audio"]:
            err = ff(["-i", c["path"], "-vn", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"]).stderr
            m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", err, re.S)
            try:
                lufs = float(json.loads(m[0])["input_i"]) if m else None
            except (ValueError, KeyError):
                lufs = None
            if lufs is not None and lufs > -70:
                c["lufs"] = lufs
                c["gain"] = max(-12.0, min(12.0, -16.0 - lufs))
        agent("audio", "läuft", f"Clip {i + 1}: {c['gain']:+.1f} dB angleichen", int((i + 1) / len(clips) * 100))
    emit(type="levels", levels=[c["lufs"] for c in clips])
    agent("audio", "bereit", "Pegel gemessen · Rauschfilter und Lautheit kommen beim Zusammensetzen", 100)


# ---------- Farbe (Messung) ----------
def lut_file():
    luts = sorted(glob.glob(os.path.join(LUTS, "*.cube")))
    return luts[0] if luts else None


def analyse_color(clips):
    agent("farbe", "läuft", "Messe Helligkeit je Clip …", 0)
    for i, c in enumerate(clips):
        err = ff(["-i", c["path"], "-an", "-vf", "fps=1,scale=160:-2,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-f", "null", "-"]).stderr
        vals = [float(x) for x in re.findall(r"YAVG=([\d.]+)", err)]
        y = sum(vals) / len(vals) if vals else 110.0
        c["bright"] = max(-0.12, min(0.12, (110.0 - y) / 255.0 * 0.8))
        agent("farbe", "läuft", f"Clip {i + 1}: Helligkeit {c['bright']:+.2f}", int((i + 1) / len(clips) * 100))
    lut = lut_file()
    agent("farbe", "bereit", f"LUT „{os.path.basename(lut)}“ für alle Clips" if lut else f"Look „{LOOK}“ für alle Clips", 100)


# ---------- Schnitt ----------
def plan_cuts(clips):
    agent("schnitt", "läuft", "Suche Pausen und Ähms …" if AEHMS_RAUS else "Ähms bleiben drin (so gewünscht) · suche nur lange Pausen …", 0)
    luecke, vor, nach = {"hart": (0.3, 0.08, 0.12), "sanft": (1.2, 0.3, 0.4)}.get(PAUSEN, (0.6, 0.15, 0.2))
    if not AEHMS_RAUS and PAUSEN != "hart":
        luecke = max(luecke, 1.5)
    fillers, cut_away = 0, 0.0
    for c in clips:
        segs, start, end = [], None, None
        for w in c["words"]:
            if is_filler(w["w"]):
                fillers += 1
                if start is not None:
                    segs.append((start, w["s"]))
                start = None
                continue
            if start is not None and w["s"] - end > luecke:
                segs.append((start, min(c["dur"], end + nach)))
                start = None
            if start is None:
                start = max(0.0, w["s"] - vor)
            end = w["e"]
        if start is not None:
            segs.append((start, min(c["dur"], end + nach + 0.05)))
        segs = [(a, b) for a, b in segs if b - a > 0.25]
        c["segs"] = segs or [(0.0, c["dur"])]  # ohne Sprache: Clip ganz behalten
        cut_away += c["dur"] - sum(b - a for a, b in c["segs"])
    total = sum(b - a for c in clips for a, b in c["segs"])
    emit(type="plan", clips=[{"name": c["name"], "segs": [[round(a, 2), round(b, 2)] for a, b in c["segs"]]} for c in clips], total=round(total, 2))
    tempo = {"hart": " · enger Schnitt", "sanft": " · Atempausen bleiben"}.get(PAUSEN, "")
    agent("schnitt", "läuft" if (FOKUS or MAX_SEK) else "fertig", f"{fillers} Ähms und {cut_away:.0f} s Pausen raus{tempo} · neue Länge {total:.0f} s", 100)
    return total


def seg_text(c, a, b):
    return " ".join(w["w"] for w in c["words"] if w["s"] >= a - 0.01 and w["s"] < b)


def stamm(w):
    w = re.sub(r"[^\wäöüß]", "", w.lower())
    return w[:5] if len(w) > 5 else w


def auswahl(clips, total):
    """Kevins Vorgaben: nur Stellen zu bestimmten Themen und/oder höchstens X Sekunden (die stärksten Stellen)."""
    if not FOKUS and not MAX_SEK:
        return total
    teile = []
    for ci, c in enumerate(clips):
        for si, (a, b) in enumerate(c["segs"]):
            text = seg_text(c, a, b)
            woerter = [stamm(x) for x in text.split()]
            treffer = sum(1 for f in FOKUS if any(x.startswith(stamm(f)) for x in woerter if x))
            dauer = b - a
            # Stärke: viel gesagt pro Sekunde, Ausrufe/Fragen, Fokus-Treffer, Einstieg bekommt Bonus
            score = (len(woerter) / max(dauer, 0.5)) + 1.5 * text.count("!") + 0.7 * text.count("?") + 4 * treffer + (1.0 if ci == 0 and si == 0 else 0)
            if not c["words"]:
                score = 1.0  # Clip ohne Sprache: neutral
            teile.append({"ci": ci, "si": si, "a": a, "b": b, "dur": dauer, "score": score, "treffer": treffer})
    gruende = []
    if FOKUS:
        passend = [t for t in teile if t["treffer"]]
        if passend:
            gruende.append(f"{len(passend)} von {len(teile)} Stellen passen zu „{', '.join(FOKUS)}“")
            teile = passend
        else:
            gruende.append(f"Keine Stelle erwähnt „{', '.join(FOKUS)}“ · behalte alles")
    if MAX_SEK and sum(t["dur"] for t in teile) > MAX_SEK:
        rest, gewaehlt = MAX_SEK, []
        for t in sorted(teile, key=lambda t: -t["score"]):
            if rest <= 0.4:
                break
            if t["dur"] > rest:
                t = dict(t, b=t["a"] + rest, dur=rest)
            gewaehlt.append(t)
            rest -= t["dur"]
        gruende.append((f"die {len(gewaehlt)} stärksten Stellen" if len(gewaehlt) != 1 else "die stärkste Stelle") + f" für höchstens {MAX_SEK:.0f} s")
        teile = gewaehlt
    teile.sort(key=lambda t: (t["ci"], t["a"]))
    von = sum(len(c["segs"]) for c in clips)
    for ci, c in enumerate(clips):
        c["segs"] = [(t["a"], t["b"]) for t in teile if t["ci"] == ci]
    neu = sum(b - a for c in clips for a, b in c["segs"])
    emit(type="auswahl", behalten=len(teile), von=von, grund=" · ".join(gruende))
    emit(type="plan", clips=[{"name": c["name"], "segs": [[round(a, 2), round(b, 2)] for a, b in c["segs"]]} for c in clips], total=round(neu, 2))
    agent("schnitt", "fertig", f"Deine Vorgabe umgesetzt: {' · '.join(gruende)} · neue Länge {neu:.0f} s", 100)
    return neu


# ---------- Untertitel ----------
def ass_time(t):
    t = max(0.0, t)
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def build_subs(clips, path, total=0.0):
    global HL
    HL = ass_farbe(FARBE)
    agent("untertitel", "läuft", "Baue Untertitel …" if UNTERTITEL else "Ohne Untertitel (so gewünscht)", 0)
    timed, off = [], 0.0
    for c in clips:
        for a, b in c["segs"]:
            for w in c["words"]:
                if not is_filler(w["w"]) and w["s"] >= a - 0.01 and w["s"] < b:
                    timed.append((off + w["s"] - a, off + min(b, w["e"]) - a, w["w"].upper()))
            off += b - a
    groups, cur = [], []
    for w in timed:
        if cur and (len(cur) == 3 or w[0] - cur[-1][1] > 0.4):
            groups.append(cur)
            cur = []
        cur.append(w)
    if cur:
        groups.append(cur)
    lines = []
    for gi, g in enumerate(groups):
        next_start = groups[gi + 1][0][0] if gi + 1 < len(groups) else None
        for k, w in enumerate(g):
            start = g[0][0] if k == 0 else w[0]
            end = g[k + 1][0] if k + 1 < len(g) else g[-1][1] + 0.15
            if next_start is not None:
                end = min(end, next_start)  # Blöcke dürfen sich nicht überlappen
            text = " ".join(("{\\c" + HL + "\\fscx112\\fscy112}" + x[2] + "{\\r}") if j == k else x[2] for j, x in enumerate(g))
            lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(max(end, start + 0.05))},Friday,,0,0,0,,{text}")
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Friday,Arial Black,78,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,1,0,1,6,2,2,60,60,420,1
Style: Titel,Arial Black,104,&H00FFFFFF,&H00FFFFFF,&H00000000,&H78000000,-1,0,0,0,100,100,2,0,1,7,3,8,70,70,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    if not UNTERTITEL:
        lines, groups = [], []
    t_ass = lambda x: re.sub(r"[{}\\]", "", x)
    if TITEL:  # Text in Anführungszeichen / nach „Titel:“ – steht genau so im Video
        lines.append(f"Dialogue: 2,{ass_time(0.1)},{ass_time(min(2.8, max(1.0, total - 0.2)))},Titel,,0,0,0,,{{\\fad(250,300)\\3c{HL}\\blur1}}{t_ass(TITEL)}")
    if ABSPANN and total > 4:
        lines.append(f"Dialogue: 2,{ass_time(total - 2.6)},{ass_time(total)},Titel,,0,0,0,,{{\\fad(300,200)\\3c{HL}\\blur1}}{t_ass(ABSPANN)}")
    with open(path, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(lines) + "\n")
    emit(type="subs", blocks=[[round(g[0][0], 2), round(g[-1][1], 2)] for g in groups])
    extra = (" · Titel „" + TITEL + "“" if TITEL else "") + (" · Abspann „" + ABSPANN + "“" if ABSPANN else "")
    farbe = "in deiner Farbe" if FARBE else "gelb"
    agent("untertitel", "fertig" if UNTERTITEL else "übersprungen", (f"{len(groups)} Untertitel-Blöcke, aktuelles Wort {farbe}" if UNTERTITEL else "Keine Untertitel") + extra, 100)


# ---------- Regie: zusammensetzen ----------
def render(clips, ass, out, total):
    agent("regie", "läuft", "Setze alles zusammen …", 0)
    lut = lut_file()
    look = f"lut3d=file='{esc(lut)}'" if lut else LOOKS.get(LOOK, LOOKS["natürlich"])
    inputs, parts, labels, n = [], [], [], 0
    for c in clips:
        inputs += ["-i", c["path"]]
    for i, c in enumerate(clips):
        for a, b in c["segs"]:
            parts.append(f"[{i}:v]trim={a:.3f}:{b:.3f},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,"
                         f"crop=1080:1920,setsar=1,fps=30,eq=brightness={c['bright']:.3f},{look},format=yuv420p[v{n}]")
            if c["audio"]:
                parts.append(f"[{i}:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume={c['gain']:.1f}dB[a{n}]")
            else:
                parts.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{b - a:.3f}[a{n}]")
            labels.append(f"[v{n}][a{n}]")
            n += 1
    parts.append(f"{''.join(labels)}concat=n={n}:v=1:a=1[vc][ac]")
    parts.append(f"[vc]subtitles=filename='{esc(ass)}':fontsdir='{esc(FONTS)}'[vout]")
    voice = "[ac]afftdn=nf=-25,highpass=f=80"
    music = [] if not MUSIK_AN else sorted(f for f in glob.glob(os.path.join(MUSIK, "*")) if f.lower().endswith((".mp3", ".m4a", ".wav", ".aac")))
    if music:
        inputs += ["-stream_loop", "-1", "-i", music[0]]
        parts.append(f"{voice},asplit=2[voice][key]")
        parts.append(f"[{len(clips)}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.35[mus]")
        parts.append("[mus][key]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck]")
        parts.append("[voice][duck]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]")
    else:
        parts.append(f"{voice},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]")
    agent("audio", "läuft", "Rauschfilter + Lautheit" + ("" if MUSIK_AN else " · ohne Musik (so gewünscht)") + (f" · Musik „{os.path.basename(music[0])}“ unter der Sprache leiser" if music else ""), None)
    cmd = [FF, "-hide_banner", "-nostdin", "-y", *inputs, "-filter_complex", ";".join(parts), "-map", "[vout]", "-map", "[aout]",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
           "-progress", "pipe:1", "-nostats", out]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    err_tail = []
    threading.Thread(target=lambda: err_tail.extend(proc.stderr.read().splitlines()[-8:]), daemon=True).start()
    last = 0
    for line in proc.stdout:
        if line.startswith("out_time_us=") and total > 0:
            try:
                pct = min(99, int(int(line.split("=")[1]) / 1e6 / total * 100))
            except ValueError:
                continue
            if pct >= last + 3:
                last = pct
                agent("regie", "läuft", f"Rendere 9:16-Video … {pct} %", pct)
    proc.wait()
    time.sleep(0.2)
    if proc.returncode != 0:
        raise RuntimeError("ffmpeg: " + " | ".join(err_tail[-3:]))
    agent("audio", "fertig", "Ton angeglichen, Rauschen gefiltert", 100)
    agent("farbe", "fertig", "Look auf alle Clips gelegt", 100)


def main():
    for d in (IN, OUT, WORK, LUTS, MUSIK):
        os.makedirs(d, exist_ok=True)
    # Whisper ruft "ffmpeg" über den Namen auf: das mitgelieferte Programm in den PATH legen.
    bindir = os.path.join(WORK, "bin")
    os.makedirs(bindir, exist_ok=True)
    link = os.path.join(bindir, "ffmpeg")
    if os.path.realpath(link) != os.path.realpath(FF):
        if os.path.lexists(link):
            os.remove(link)
        os.symlink(FF, link)
    os.environ["PATH"] = bindir + os.pathsep + os.environ.get("PATH", "")
    agent("regie", "läuft", "Plane: lese Clips …", 0)
    clips = find_clips()
    if not clips:
        emit(type="error", error=f"Keine Videos im Ordner {IN}")
        return 2
    agent("regie", "läuft", f"{len(clips)} Clips · verteile an Transkript, Audio und Farbe", 5)
    # Transkript (GPU) läuft parallel zu den Messungen für Audio und Farbe (CPU).
    with ThreadPoolExecutor(max_workers=3) as pool:
        jobs = [pool.submit(transcribe, clips), pool.submit(analyse_audio, clips), pool.submit(analyse_color, clips)]
        for j in jobs:
            j.result()
    if V.get("verstanden"):
        agent("regie", "läuft", "Deine Anweisung: " + " · ".join(V["verstanden"])[:180], 8)
    total = plan_cuts(clips)
    total = auswahl(clips, total)
    if total <= 0.2:
        raise RuntimeError("Nach deinen Vorgaben bleibt nichts vom Video übrig.")
    ass = os.path.join(WORK, "untertitel.ass")
    build_subs(clips, ass, total)
    out = os.path.join(OUT, time.strftime("Friday-Schnitt_%Y-%m-%d_%H-%M.mp4"))
    render(clips, ass, out, total)
    err = ff(["-i", out]).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err)
    dur = int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 0.0
    if not os.path.exists(out) or dur <= 0:
        raise RuntimeError("Das fertige Video ist leer.")
    transcript = " ".join(" ".join(w["w"] for w in c["words"]) for c in clips).strip()
    agent("regie", "fertig", f"Fertig: {os.path.basename(out)} ({dur:.0f} s)", 100)
    emit(type="done", file=out, name=os.path.basename(out), dur=round(dur, 1), transcript=transcript[:4000])
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001 – Fehler an Friday melden
        emit(type="error", error=str(exc)[:500])
        sys.exit(1)
