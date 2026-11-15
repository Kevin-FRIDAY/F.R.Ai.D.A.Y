// F.R.Ai.D.A.Y Markt-Radar: Kerzen, Fächer aus 100 möglichen Verläufen, Spanne, Papierdepot.
// Prognose, keine Gewissheit. Gehandelt wird nur mit Spielgeld und nur nach Klick auf "Freigeben".
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { api, say, escapeHtml } = window.Friday;
  const box = $("markt");
  if (!box) return;

  let asset = (() => { try { return localStorage.getItem("friday_markt_default") || "gold"; } catch { return "gold"; } })(), timer = null, spokenAt = {}, current = null;
  const fmt = (v) => (v >= 1000 ? Math.round(v).toLocaleString("de-DE") : v.toLocaleString("de-DE", { maximumFractionDigits: 2 }));
  const money = (v) => `${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

  // ---------- Chart ----------
  function draw(d) {
    const cv = $("markt-chart");
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d");
    g.scale(dpr, dpr);
    g.clearRect(0, 0, W, H);
    if (!d) return;
    const k = d.kerzen, n = k.length, f = d.stunden, paths = d.verlaeufe;
    const right = 92, left = 8, top = 14, bottom = 22;
    const steps = n + f;
    const xs = (i) => left + (i + 0.5) * ((W - left - right) / steps);
    let lo = Infinity, hi = -Infinity;
    k.forEach(([, , h, l]) => { lo = Math.min(lo, l); hi = Math.max(hi, h); });
    paths.forEach((p) => p.forEach((v) => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
    const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    const ys = (v) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom);

    // Raster
    g.strokeStyle = "rgba(255,255,255,.06)"; g.lineWidth = 1;
    g.font = "10px ui-monospace, Menlo, monospace"; g.fillStyle = "rgba(255,255,255,.4)";
    for (let i = 0; i <= 4; i++) {
      const v = lo + ((hi - lo) * i) / 4, y = ys(v);
      g.beginPath(); g.moveTo(left, y); g.lineTo(W - right, y); g.stroke();
      g.fillText(fmt(v), W - right + 6, y + 3);
    }
    // Kerzen
    const cw = Math.max(1, ((W - left - right) / steps) * 0.6);
    k.forEach(([, o, h, l, c], i) => {
      const x = xs(i), up = c >= o;
      g.strokeStyle = g.fillStyle = up ? "#4dffa6" : "#ff5d6c";
      g.beginPath(); g.moveTo(x, ys(h)); g.lineTo(x, ys(l)); g.stroke();
      g.fillRect(x - cw / 2, Math.min(ys(o), ys(c)), cw, Math.max(1, Math.abs(ys(o) - ys(c))));
    });
    // Spanne (5.–95. Perzentil je Schritt)
    const x0 = xs(n - 1), y0 = ys(d.jetzt);
    const pct = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };
    const band = [];
    for (let j = 0; j < f; j++) { const col = paths.map((p) => p[j]); band.push([pct(col, 0.05), pct(col, 0.5), pct(col, 0.95)]); }
    g.fillStyle = "rgba(255,138,30,.12)";
    g.beginPath(); g.moveTo(x0, y0);
    band.forEach(([, , p95], j) => g.lineTo(xs(n + j), ys(p95)));
    for (let j = f - 1; j >= 0; j--) g.lineTo(xs(n + j), ys(band[j][0]));
    g.closePath(); g.fill();
    // Fächer: 100 dünne leuchtende Linien
    g.save();
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = "rgba(255,138,30,.16)"; g.lineWidth = 1;
    paths.forEach((p) => { g.beginPath(); g.moveTo(x0, y0); p.forEach((v, j) => g.lineTo(xs(n + j), ys(v))); g.stroke(); });
    g.restore();
    // Median
    g.strokeStyle = "#ffcc4d"; g.lineWidth = 2; g.setLineDash([5, 4]);
    g.beginPath(); g.moveTo(x0, y0); band.forEach(([, med], j) => g.lineTo(xs(n + j), ys(med))); g.stroke();
    g.setLineDash([]);
    // "Jetzt"-Punkt
    const glow = g.createRadialGradient(x0, y0, 0, x0, y0, 16);
    glow.addColorStop(0, "rgba(255,255,255,.95)"); glow.addColorStop(0.3, "rgba(255,138,30,.6)"); glow.addColorStop(1, "rgba(255,138,30,0)");
    g.fillStyle = glow; g.beginPath(); g.arc(x0, y0, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,.5)"; g.fillText("JETZT", x0 - 14, H - 6);
    // Zielwerte rechts
    const label = (v, text, color) => { const y = ys(v); g.fillStyle = color; g.fillRect(W - right + 2, y - 8, right - 4, 16); g.fillStyle = "#120a02"; g.fillText(`${text} ${fmt(v)}`, W - right + 5, y + 3); };
    label(d.p95, "95%", "rgba(255,138,30,.75)");
    label(d.median, "MED", "#ffcc4d");
    label(d.p5, "5%", "rgba(255,138,30,.75)");
  }

  // ---------- Anzeige ----------
  function show(r) {
    const d = r.data;
    current = r;
    const st = $("markt-status");
    if (r.status === "rechnet" || r.status === "wartet") {
      st.textContent = r.status === "rechnet" ? "Kronos rechnet 100 Verläufe … (1–2 Minuten)" : "Wartet auf freie Rechenzeit …";
      st.className = "markt-status busy";
    } else if (r.status === "fehler") { st.textContent = `Fehler: ${r.error || "unbekannt"}`; st.className = "markt-status error"; }
    else {
      const stand = d ? new Date(r.at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
      st.textContent = !d ? "" : r.aktualisiert ? `Stand ${stand} · rechne gerade im Hintergrund neu …` : `Stand ${stand} · Daten: ${d.quelle} · gerechnet in ${Math.round(d.sekunden)} s`;
      st.className = r.aktualisiert ? "markt-status busy" : "markt-status";
    }
    draw(d);
    if (!d) { $("markt-stats").innerHTML = ""; $("markt-signal").innerHTML = ""; return; }
    const share = Math.round((d.hoeher / d.anzahl) * 100);
    $("markt-stats").innerHTML = `
      <div><small>KURS JETZT</small><b>${fmt(d.jetzt)}</b></div>
      <div><small>VERLÄUFE HÖHER</small><b>${d.hoeher} / ${d.anzahl}</b><i style="width:${share}%"></i></div>
      <div><small>MEDIAN IN ${d.stunden} STD.</small><b>${fmt(d.median)}</b><em>${((d.median / d.jetzt - 1) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1, signDisplay: "always" })} %</em></div>
      <div><small>SPANNE 5–95 %</small><b>${fmt(d.p5)} – ${fmt(d.p95)}</b></div>`;
    const sig = r.signal;
    $("markt-signal").innerHTML = sig === "abwarten"
      ? `<span>Modell-Signal: <b>ABWARTEN</b></span>`
      : `<span>Modell-Signal: <b>${sig.toUpperCase()}</b> (Spielgeld)</span><button class="chip primary" data-trade="${sig}">Freigeben</button>`;
    // Ergebnis einmal pro neuer Rechnung ansagen.
    if (r.status === "fertig" && !r.aktualisiert && spokenAt[d.asset] !== r.at && !box.classList.contains("hidden") && (localStorage.getItem("friday_markt_speak") !== "0")) {
      spokenAt[d.asset] = r.at;
      say(`${d.name}: ${d.hoeher} von ${d.anzahl} Verläufen enden höher, Spanne ${fmt(d.p5)} bis ${fmt(d.p95)}. Prognose, keine Gewissheit.`);
    }
  }

  async function loadDepot() {
    try {
      const d = await (await api("/api/papierdepot")).json();
      const t = d.trefferquote;
      $("markt-depot").innerHTML = `
        <div class="md-sum"><div><small>GESAMT</small><b>${money(d.gesamt)}</b></div><div><small>ERGEBNIS</small><b class="${d.ergebnis >= 0 ? "pos" : "neg"}">${d.ergebnis >= 0 ? "+" : ""}${money(d.ergebnis)}</b></div><div><small>SPIELGELD FREI</small><b>${money(d.cash)}</b></div></div>
        <div class="md-hit"><small>TREFFERQUOTE DER PROGNOSEN</small><b>${t.bewertet ? `${t.treffer} von ${t.bewertet} (${Math.round((t.treffer / t.bewertet) * 100)} %)` : "noch keine bewertet"}</b><span>${t.offen} offen · bewertet wird nach 24 Std.</span></div>
        ${d.positionen.length ? `<ul class="md-list">${d.positionen.map((p) => `<li>${escapeHtml(p.name)} · ${p.menge.toLocaleString("de-DE", { maximumFractionDigits: 6 })} ${p.wert ? `· ${money(p.wert)}` : ""} <button class="chip" data-trade="verkaufen" data-asset="${escapeHtml(p.asset)}">Verkaufen</button></li>`).join("")}</ul>` : ""}
        <ul class="md-trades">${d.trades.map((tr) => `<li>${new Date(tr.zeit).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · ${tr.richtung === "kaufen" ? "Kauf" : "Verkauf"} ${escapeHtml(tr.asset)} zu ${fmt(tr.preis)} · ${money(tr.betrag)}</li>`).join("") || "<li class='muted'>Noch keine Spielgeld-Trades.</li>"}</ul>`;
    } catch { $("markt-depot").textContent = "Papierdepot nicht erreichbar."; }
  }

  async function load(force) {
    clearTimeout(timer);
    try {
      const r = await (await api(`/api/markt/${asset}${force ? "/neu" : ""}`, force ? { method: "POST" } : {})).json();
      show(r);
      if (r.status === "rechnet" || r.status === "wartet" || r.aktualisiert) timer = setTimeout(() => load(false), 5000);
      loadDepot();
    } catch { $("markt-status").textContent = "Markt-Radar nicht erreichbar."; }
  }

  function pick(a) {
    asset = a;
    box.querySelectorAll("[data-asset-tab]").forEach((b) => b.classList.toggle("on", b.dataset.assetTab === a));
    draw(null); $("markt-stats").innerHTML = ""; $("markt-signal").innerHTML = "";
    load(false);
  }

  box.addEventListener("click", async (e) => {
    const tab = e.target.closest("[data-asset-tab]");
    if (tab) return pick(tab.dataset.assetTab);
    const tr = e.target.closest("[data-trade]");
    if (tr) {
      const a = tr.dataset.asset || asset;
      const res = await api("/api/papierdepot/freigeben", { method: "POST", body: JSON.stringify({ asset: a, richtung: tr.dataset.trade }) });
      const r = await res.json();
      $("markt-msg").textContent = r.ok ? `Freigegeben: ${tr.dataset.trade === "kaufen" ? "Kauf" : "Verkauf"} mit Spielgeld gebucht.` : r.error;
      loadDepot();
    }
  });
  $("markt-neu")?.addEventListener("click", () => load(true));
  $("markt-reset")?.addEventListener("click", async () => {
    if (!confirm("Papierdepot auf 10.000 $ Spielgeld zurücksetzen? Die Trefferquote bleibt erhalten.")) return;
    await api("/api/papierdepot/zuruecksetzen", { method: "POST" });
    loadDepot();
  });
  $("markt-open")?.addEventListener("click", () => {
    box.classList.remove("hidden");
    try { asset = localStorage.getItem("friday_markt_default") || asset; } catch { /* egal */ } // Standard aus den Einstellungen
    pick(asset);
  });
  $("markt-x")?.addEventListener("click", () => { box.classList.add("hidden"); clearTimeout(timer); });
  window.addEventListener("resize", () => { if (!box.classList.contains("hidden") && current) draw(current.data); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !box.classList.contains("hidden")) { box.classList.add("hidden"); clearTimeout(timer); } });
})();
