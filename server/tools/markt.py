#!/usr/bin/env python3
"""Fridays Markt-Radar: viele mögliche Kursverläufe mit Kronos (lokal).

Aufruf: markt.py <gold|bitcoin|ethereum> [pfade] [stunden]
Gibt eine JSON-Zeile aus: letzte Kerzen, alle Verläufe, Auswertung.
Das ist eine Wahrscheinlichkeits-Spielerei, kein Wissen über morgen.
"""
import json
import os
import ssl
import sys
import time
import urllib.request

import numpy as np
import pandas as pd

KRONOS = os.environ.get("FRIDAY_KRONOS_DIR") or os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "kronos")
sys.path.insert(0, KRONOS)

ASSETS = {
    "bitcoin": {"name": "Bitcoin", "binance": "BTCUSDT", "yf": "BTC-USD"},
    "ethereum": {"name": "Ethereum", "binance": "ETHUSDT", "yf": "ETH-USD"},
    "gold": {"name": "Gold", "binance": None, "yf": "GC=F"},
}
LOOKBACK = 400


def binance(symbol):
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval=1h&limit={LOOKBACK}"
    try:
        import certifi  # diese Python-Installation hat keine eigenen Stammzertifikate
        ctx = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        ctx = ssl.create_default_context()
    with urllib.request.urlopen(url, timeout=20, context=ctx) as r:
        rows = json.load(r)
    df = pd.DataFrame(rows, columns=["t", "open", "high", "low", "close", "volume", "ct", "amount", "n", "tb", "tq", "x"])
    df["timestamps"] = pd.to_datetime(df["t"], unit="ms", utc=True).dt.tz_localize(None)
    for c in ("open", "high", "low", "close", "volume", "amount"):
        df[c] = df[c].astype(float)
    return df[["timestamps", "open", "high", "low", "close", "volume", "amount"]]


def yahoo(symbol):
    import yfinance as yf

    raw = yf.download(symbol, period="60d", interval="1h", progress=False, auto_adjust=False)
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)
    raw = raw.dropna().tail(LOOKBACK)
    idx = pd.to_datetime(raw.index)
    idx = idx.tz_convert("UTC").tz_localize(None) if idx.tz is not None else idx
    df = pd.DataFrame({
        "timestamps": idx, "open": raw["Open"].astype(float).values, "high": raw["High"].astype(float).values,
        "low": raw["Low"].astype(float).values, "close": raw["Close"].astype(float).values,
        "volume": raw["Volume"].astype(float).values,
    })
    df["amount"] = df["volume"] * df[["open", "high", "low", "close"]].mean(axis=1)
    return df.reset_index(drop=True)


def load(asset):
    a = ASSETS[asset]
    if a["binance"]:
        try:
            return binance(a["binance"]), "Binance"
        except Exception:  # noqa: BLE001 – auf Yahoo ausweichen
            pass
    return yahoo(a["yf"]), "Yahoo Finance"


def main():
    asset = (sys.argv[1] if len(sys.argv) > 1 else "bitcoin").lower()
    paths_n = int(sys.argv[2]) if len(sys.argv) > 2 else 100
    horizon = int(sys.argv[3]) if len(sys.argv) > 3 else 24
    if asset not in ASSETS:
        raise ValueError(f"Unbekannter Markt: {asset}")
    t0 = time.time()
    df, source = load(asset)
    if len(df) < 100:
        raise RuntimeError("Zu wenige Kursdaten bekommen.")

    import torch
    from model import Kronos, KronosPredictor, KronosTokenizer

    torch.manual_seed(int(time.time()))
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    tokenizer = KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base")
    model = Kronos.from_pretrained("NeoQuasar/Kronos-small")
    predictor = KronosPredictor(model, tokenizer, device=device, max_context=512)

    step = df["timestamps"].diff().median()
    future = pd.Series([df["timestamps"].iloc[-1] + step * (i + 1) for i in range(horizon)])
    x_df = df[["open", "high", "low", "close", "volume", "amount"]]
    # Kronos mittelt mehrere Proben intern; für einzelne Verläufe je Verlauf eine eigene Probe.
    paths = []
    chunk = 20
    while len(paths) < paths_n:
        n = min(chunk, paths_n - len(paths))
        preds = predictor.predict_batch([x_df] * n, [df["timestamps"]] * n, [future] * n, pred_len=horizon,
                                        T=1.0, top_p=0.9, sample_count=1, verbose=False)
        paths += [p["close"].astype(float).tolist() for p in preds]

    last = float(df["close"].iloc[-1])
    ends = np.array([p[-1] for p in paths])
    up = int((ends > last).sum())
    tail = df.tail(120)
    out = {
        "asset": asset, "name": ASSETS[asset]["name"], "quelle": source, "geraet": device,
        "jetzt": last, "zeit_jetzt": df["timestamps"].iloc[-1].isoformat() + "Z",
        "stunden": horizon, "anzahl": len(paths), "hoeher": up,
        "median": float(np.median(ends)), "p5": float(np.percentile(ends, 5)), "p95": float(np.percentile(ends, 95)),
        "kerzen": [[r.timestamps.isoformat() + "Z", round(r.open, 4), round(r.high, 4), round(r.low, 4), round(r.close, 4)] for r in tail.itertuples()],
        "verlaeufe": [[round(v, 4) for v in p] for p in paths],
        "zukunft": [t.isoformat() + "Z" for t in future],
        "sekunden": round(time.time() - t0, 1),
    }
    print(json.dumps(out), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 – Fehler an Friday melden
        print(json.dumps({"error": str(exc)[:400]}), flush=True)
        sys.exit(1)
