// F.R.Ai.D.A.Y Markt-Radar Plus (v1.145.0, zuerst nur in Eve)
// Im Markt-Radar der Reiter "🌐 ALLE MÄRKTE": Indizes, Aktien, Rohstoffe, Krypto, Devisen + Suche nach fast allem,
// Zeitstrahl bis 1 Jahr zurück, Analyse (ohne Claude), Prognose auf Wunsch und die Markt-Wache im Hintergrund.
// Prognose, keine Gewissheit. Keine Anlageberatung. Friday kauft und verkauft nie etwas.
(() => {
  "use strict";
  const F = window.Friday || {};
  const api = F.api;
  const box = document.getElementById("markt");
  if (!api || !box) return;
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const sprechenAn = () => { try { return localStorage.getItem("friday_markt_speak") !== "0"; } catch { return true; } };
  const sag = (t) => { if (t && sprechenAn()) { try { F.say?.(t); } catch { /* egal */ } } };
  const fmt = (v) => (v == null || !Number.isFinite(v) ? "–" : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("de-DE") : v.toLocaleString("de-DE", { maximumFractionDigits: Math.abs(v) < 10 ? 4 : 2 }));
  const pz = (v) => (v == null || !Number.isFinite(v) ? "–" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`);
  const klasse = (v) => (v == null ? "" : v >= 0 ? "pos" : "neg");
  const datum = (t, mitZeit) => new Date(t).toLocaleString("de-DE", mitZeit ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", year: "2-digit" });
  async function json(pfad, body) {
    const r = await api(pfad, body !== undefined ? { method: "POST", body: JSON.stringify(body) } : {});
    let d = {};
    try { d = await r.json(); } catch { /* leer */ }
    if (!r.ok) throw new Error(d.error || `Fehler ${r.status}`);
    return d;
  }

  // ---------- Aussehen ----------
  const css = document.createElement("style");
  css.textContent = `
  .markt-tabs .mr-plus-tab { position: relative; border-color: rgba(46,230,208,.5); color: #8ff3e6; }
  .markt-tabs .mr-plus-tab.on { color: #031210; background: linear-gradient(135deg, #2ee6d0, #ff8a1e); border-color: transparent; }
  .mr-plus-tab .mp-zahl { margin-left: 6px; padding: 1px 6px; border-radius: 999px; background: #ff5d6c; color: #fff; font-size: 10px; }
  #markt.mp-an .markt-grid, #markt.mp-an #markt-neu { display: none; }
  .mp { display: none; }
  #markt.mp-an .mp { display: grid; grid-template-columns: 270px minmax(0, 1fr) 310px; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 1250px) { #markt.mp-an .mp { grid-template-columns: 250px minmax(0, 1fr); } .mp-wache { grid-column: 1 / -1; } }
  @media (max-width: 900px) { #markt.mp-an .mp { grid-template-columns: 1fr; } .mp-liste { order: 2; } .mp-haupt { order: 1; } .mp-wache { order: 3; } }
  .mp .markt-panel { background: linear-gradient(160deg, rgba(255,138,30,.06), rgba(255,255,255,.015)); backdrop-filter: blur(6px); }
  .mp-suche { width: 100%; box-sizing: border-box; font: 14px ui-monospace, Menlo, monospace; padding: 9px 12px; border-radius: 10px; border: 1px solid rgba(255,138,30,.45); background: rgba(0,0,0,.35); color: var(--text); }
  .mp-gruppen { display: flex; flex-wrap: wrap; gap: 5px; }
  .mp-gruppen button, .mp-zeit button { font: 600 10px ui-monospace, Menlo, monospace; letter-spacing: .1em; padding: 6px 9px; border-radius: 14px; border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; }
  .mp-gruppen button.on, .mp-zeit button.on { color: #120a02; background: #ff8a1e; border-color: #ff8a1e; box-shadow: 0 0 12px rgba(255,138,30,.5); }
  .mp-maerkte { display: flex; flex-direction: column; gap: 4px; overflow: auto; max-height: 62vh; padding-right: 2px; }
  .mp-zeile { display: grid; grid-template-columns: 1fr 56px auto; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 9px; border: 1px solid transparent; background: rgba(255,255,255,.025); cursor: pointer; text-align: left; color: var(--text); font: 12px ui-monospace, Menlo, monospace; }
  .mp-zeile:hover, .mp-zeile.on { border-color: rgba(255,138,30,.6); background: rgba(255,138,30,.09); }
  .mp-zeile b { display: block; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mp-zeile small { color: var(--muted); font-size: 10px; }
  .mp-zeile .r { text-align: right; white-space: nowrap; }
  .mp-zeile svg { width: 56px; height: 20px; }
  .mp .pos { color: #4dffa6; } .mp .neg { color: #ff5d6c; }
  .mp-kopf { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .mp-kopf h2 { margin: 0; font: 600 20px ui-monospace, Menlo, monospace; letter-spacing: .06em; color: #ffd8b0; text-shadow: 0 0 12px rgba(255,138,30,.6); }
  .mp-kopf small { color: var(--muted); font: 11px ui-monospace, Menlo, monospace; }
  .mp-kurs { text-align: right; } .mp-kurs b { font: 700 24px ui-monospace, Menlo, monospace; color: #fff; } .mp-kurs em { display: block; font: 600 13px ui-monospace, Menlo, monospace; font-style: normal; }
  .mp-zeit { display: flex; gap: 5px; flex-wrap: wrap; }
  .mp-chart-wrap { position: relative; }
  .mp-chart { width: 100%; height: 340px; display: block; touch-action: pan-y; }
  @media (max-width: 700px) { .mp-chart { height: 250px; } }
  .mp-tip { position: absolute; pointer-events: none; padding: 5px 8px; border-radius: 8px; background: rgba(10,6,2,.92); border: 1px solid rgba(255,138,30,.6); font: 11px ui-monospace, Menlo, monospace; color: #fff; white-space: nowrap; transform: translate(-50%, -120%); display: none; }
  .mp-strahl { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: center; font: 11px ui-monospace, Menlo, monospace; color: var(--muted); }
  .mp-strahl input { width: 100%; accent-color: #ff8a1e; }
  .mp-strahl-info { grid-column: 1 / -1; color: #ffd8b0; min-height: 15px; }
  .mp-aktionen { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .mp-aktionen select { font: 12px ui-monospace, Menlo, monospace; padding: 6px 8px; border-radius: 10px; background: rgba(0,0,0,.4); color: var(--text); border: 1px solid var(--line); }
  .mp-kacheln { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 8px; }
  .mp-kacheln div { position: relative; border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; overflow: hidden; background: rgba(255,255,255,.02); }
  .mp-kacheln small { display: block; font: 10px ui-monospace, Menlo, monospace; letter-spacing: .1em; color: var(--muted); }
  .mp-kacheln b { font: 600 15px ui-monospace, Menlo, monospace; }
  .mp-kacheln i { position: absolute; left: 0; bottom: 0; height: 3px; background: linear-gradient(90deg, #ff5d6c, #ffcc4d, #4dffa6); }
  .mp-kacheln .mp-marke { position: absolute; bottom: -1px; width: 3px; height: 7px; background: #fff; box-shadow: 0 0 6px #fff; }
  .mp-text { margin: 8px 0 0; font: 13px/1.5 system-ui, sans-serif; color: var(--text); }
  .mp-prog { border: 1px dashed rgba(46,230,208,.5); border-radius: 10px; padding: 10px 12px; background: rgba(46,230,208,.05); }
  .mp-prog b.groß { font: 700 18px ui-monospace, Menlo, monospace; color: #8ff3e6; }
  .mp-ehrlich { display: flex; gap: 10px; align-items: center; margin-top: 8px; font: 11px ui-monospace, Menlo, monospace; color: #ffcc4d; }
  .mp-ehrlich .balken { flex: 1; height: 8px; border-radius: 4px; background: rgba(255,255,255,.08); position: relative; overflow: hidden; }
  .mp-ehrlich .balken span { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #ff8a1e, #2ee6d0); }
  .mp-ehrlich .balken em { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 2px; background: #fff; }
  .mp-wache h3 { display: flex; align-items: center; justify-content: space-between; }
  .mp-wreihe { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font: 11px ui-monospace, Menlo, monospace; color: var(--muted); }
  .mp-wreihe select { font: 11px ui-monospace, Menlo, monospace; padding: 4px 6px; border-radius: 8px; background: rgba(0,0,0,.4); color: var(--text); border: 1px solid var(--line); }
  .mp-puls { width: 9px; height: 9px; border-radius: 50%; background: #4dffa6; box-shadow: 0 0 10px #4dffa6; animation: mp-puls 1.6s ease-in-out infinite; display: inline-block; }
  .mp-puls.aus { background: #666; box-shadow: none; animation: none; }
  @keyframes mp-puls { 50% { opacity: .35; transform: scale(.75); } }
  .mp-wliste, .mp-hinweise { display: flex; flex-direction: column; gap: 5px; overflow: auto; max-height: 34vh; }
  .mp-w { border: 1px solid var(--line); border-radius: 9px; padding: 7px 9px; font: 11px ui-monospace, Menlo, monospace; background: rgba(255,255,255,.02); }
  .mp-w .k { display: flex; justify-content: space-between; gap: 6px; }
  .mp-w .k b { cursor: pointer; color: #ffd8b0; }
  .mp-w .f { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-top: 6px; }
  .mp-w .f label { display: flex; flex-direction: column; gap: 2px; color: var(--muted); font-size: 9px; letter-spacing: .08em; }
  .mp-w .f input { width: 100%; box-sizing: border-box; font: 12px ui-monospace, Menlo, monospace; padding: 5px 6px; border-radius: 7px; border: 1px solid var(--line); background: rgba(0,0,0,.4); color: var(--text); }
  .mp-w .x { width: auto; height: auto; min-width: 0; min-height: 0; padding: 0 4px; box-shadow: none; background: none; border: 0; color: var(--muted); cursor: pointer; font-size: 13px; }
  .mp-w .fehler { color: #ff5d6c; font-size: 10px; margin-top: 4px; }
  .mp-h { border-left: 3px solid #ff8a1e; padding: 5px 8px; font: 12px/1.4 system-ui, sans-serif; background: rgba(255,138,30,.06); border-radius: 0 8px 8px 0; }
  .mp-h.neu { border-left-color: #2ee6d0; background: rgba(46,230,208,.09); }
  .mp-h small { display: block; color: var(--muted); font: 10px ui-monospace, Menlo, monospace; }
  .mp-leer { color: var(--muted); font: 11px ui-monospace, Menlo, monospace; padding: 6px 2px; }
  .mp-status { font: 11px ui-monospace, Menlo, monospace; color: var(--muted); min-height: 14px; }
  .mp-status.busy { color: #ffcc4d; animation: call-think 1.4s ease-in-out infinite; }
  .mp-status.error { color: #ff5d6c; }
  `;
  document.head.appendChild(css);

  // ---------- Gerüst ----------
  const tabs = box.querySelector(".markt-tabs");
  const tab = document.createElement("button");
  tab.className = "mr-plus-tab";
  tab.type = "button";
  tab.innerHTML = `🌐 ALLE MÄRKTE<span class="mp-zahl" hidden></span>`;
  tabs?.appendChild(tab);
  const wurzel = document.createElement("div");
  wurzel.className = "mp";
  wurzel.id = "mp";
  wurzel.innerHTML = `
    <aside class="markt-panel mp-liste">
      <input id="mp-suche" class="mp-suche" type="search" placeholder="Suchen: Aktie, ETF, Währung …" autocomplete="off" enterkeyhint="search">
      <div class="mp-gruppen" id="mp-gruppen"></div>
      <div class="mp-maerkte" id="mp-maerkte"><div class="mp-leer">Lade …</div></div>
    </aside>
    <div class="markt-panel mp-haupt">
      <div class="mp-kopf"><div><h2 id="mp-name">–</h2><small id="mp-info"></small></div><div class="mp-kurs"><b id="mp-kurs">–</b><em id="mp-chg"></em></div></div>
      <div class="mp-zeit" id="mp-zeit"></div>
      <div id="mp-status" class="mp-status"></div>
      <div class="mp-chart-wrap"><canvas id="mp-chart" class="mp-chart"></canvas><div id="mp-tip" class="mp-tip"></div></div>
      <div class="mp-strahl"><span>⏪ ZEITSTRAHL</span><input id="mp-strahl" type="range" min="0" max="365" value="0" aria-label="Zeitstrahl bis ein Jahr zurück"><div id="mp-strahl-info" class="mp-strahl-info">Zieh den Regler nach links, um bis zu 1 Jahr zurückzuschauen.</div></div>
      <div class="mp-aktionen">
        <button class="chip primary" data-mp="analyse">📊 Analysieren</button>
        <select id="mp-tage" aria-label="Prognose-Zeitraum"><option value="5">1 Woche</option><option value="20" selected>1 Monat</option><option value="60">3 Monate</option><option value="120">6 Monate</option></select>
        <button class="chip" data-mp="prognose">🔮 Prognose</button>
        <button class="chip" data-mp="fragen">🧠 Friday fragen</button>
        <button class="chip" data-mp="wache" id="mp-wache-knopf">👁 Bewachen</button>
      </div>
      <div id="mp-analyse"></div>
      <div id="mp-prognose"></div>
    </div>
    <aside class="markt-panel mp-wache" id="mp-wache">
      <h3><span><span id="mp-puls" class="mp-puls"></span> MARKT-WACHE</span><button class="chip" data-mp="pruefen">Jetzt prüfen</button></h3>
      <div class="mp-wreihe">
        <label class="switch"><input type="checkbox" id="mp-w-an"><span>Wache an</span></label>
        <label>alle <select id="mp-w-takt"><option value="5">5</option><option value="10">10</option><option value="15">15</option><option value="30">30</option><option value="60">60</option></select> Min.</label>
        <label class="switch"><input type="checkbox" id="mp-w-melden"><span>aufs Handy melden</span></label>
      </div>
      <div id="mp-w-stand" class="mp-status"></div>
      <div class="mp-wliste" id="mp-wliste"></div>
      <h3>HINWEISE <button class="chip" data-mp="gelesen">Alle gelesen</button></h3>
      <div class="mp-hinweise" id="mp-hinweise"></div>
    </aside>`;
  box.querySelector(".markt-grid")?.after(wurzel);
  const $ = (s) => wurzel.querySelector(s);

  let katalog = null, gruppe = "indizes", symbol = "^GDAXI", zeitraum = "1J", daten = null, wache = null, strahlTage = 0, prognoseTage = 0;
  let gesehen = null, listeDa = false; // Hinweis-IDs, die schon gemeldet wurden
  const zeichneGruppen = () => {
    $("#mp-gruppen").innerHTML = Object.entries(katalog?.gruppen || {}).map(([k, t]) => `<button data-gruppe="${k}" class="${k === gruppe ? "on" : ""}">${esc(t).toUpperCase()}</button>`).join("");
    $("#mp-zeit").innerHTML = Object.entries(katalog?.zeitraeume || {}).map(([k, t]) => `<button data-zeit="${k}" class="${k === zeitraum ? "on" : ""}" title="${esc(t)}">${k}</button>`).join("");
  };
  const spark = (werte, v) => {
    if (!werte?.length) return "<svg></svg>";
    const lo = Math.min(...werte), hi = Math.max(...werte), d = hi - lo || 1;
    const pts = werte.map((w, i) => `${((i / (werte.length - 1)) * 56).toFixed(1)},${(18 - ((w - lo) / d) * 16).toFixed(1)}`).join(" ");
    return `<svg viewBox="0 0 56 20"><polyline fill="none" stroke="${v == null || v >= 0 ? "#4dffa6" : "#ff5d6c"}" stroke-width="1.4" points="${pts}"/></svg>`;
  };
  function zeileHtml(m) {
    return `<button class="mp-zeile ${m.symbol === symbol ? "on" : ""}" data-symbol="${esc(m.symbol)}" data-name="${esc(m.name)}"><span><b>${esc(m.name)}</b><small>${esc(m.art || m.symbol)}${m.boerse ? ` · ${esc(m.boerse)}` : ""}</small></span>${m.spark ? spark(m.spark, m.veraenderung) : "<span></span>"}<span class="r">${m.jetzt != null ? `${fmt(m.jetzt)}<br><small class="${klasse(m.veraenderung)}">${pz(m.veraenderung)}</small>` : m.spark ? "<small>–</small>" : ""}</span></button>`;
  }

  async function ladeGruppe(g) {
    gruppe = g;
    zeichneGruppen();
    const ziel = $("#mp-maerkte");
    const vorab = (katalog?.maerkte || []).filter((m) => m.gruppe === g);
    ziel.innerHTML = vorab.map((m) => zeileHtml({ ...m, spark: [] })).join("") || `<div class="mp-leer">Nichts gefunden.</div>`;
    try {
      const r = await json(`/api/marktplus/uebersicht/${g}`);
      if (gruppe !== g) return;
      ziel.innerHTML = r.maerkte.map(zeileHtml).join("");
    } catch (e) { if (gruppe === g) ziel.insertAdjacentHTML("afterbegin", `<div class="mp-leer">${esc(e.message)}</div>`); }
  }

  let suchTimer = null;
  $("#mp-suche").addEventListener("input", (e) => {
    clearTimeout(suchTimer);
    const q = e.target.value.trim();
    if (!q) return ladeGruppe(gruppe);
    suchTimer = setTimeout(async () => {
      $("#mp-maerkte").innerHTML = `<div class="mp-leer">Suche „${esc(q)}“ …</div>`;
      try {
        const r = await json(`/api/marktplus/suche?q=${encodeURIComponent(q)}`);
        $("#mp-maerkte").innerHTML = r.treffer.map((t) => zeileHtml(t)).join("") || `<div class="mp-leer">Keine Treffer für „${esc(q)}“.</div>`;
      } catch (err) { $("#mp-maerkte").innerHTML = `<div class="mp-leer">${esc(err.message)}</div>`; }
    }, 350);
  });
  $("#mp-suche").addEventListener("keydown", (e) => e.stopPropagation()); // Taste F = Vollbild usw. nicht auslösen

  // ---------- Markt laden ----------
  async function lade(sym = symbol, { prognose = prognoseTage } = {}) {
    symbol = sym;
    prognoseTage = prognose;
    wurzel.querySelectorAll(".mp-zeile").forEach((z) => z.classList.toggle("on", z.dataset.symbol === sym));
    const st = $("#mp-status");
    st.textContent = prognose ? "Rechne Prognose …" : "Lade Kurse …"; st.className = "mp-status busy";
    try {
      const r = await json(`/api/marktplus/markt?symbol=${encodeURIComponent(sym)}&zeitraum=${zeitraum}${prognose ? `&prognose=${prognose}` : ""}`);
      if (symbol !== sym) return null;
      daten = r;
      st.textContent = `Daten: ${r.quelle}${r.verlauf?.veraltet ? " (älterer Stand, Quelle gerade nicht erreichbar)" : ""}${r.verlauf?.nurTage ? " · nur Tageskurse" : ""}`;
      st.className = "mp-status";
      zeige();
      return r;
    } catch (e) { st.textContent = e.message; st.className = "mp-status error"; return null; }
  }

  function zeige() {
    const r = daten;
    if (!r) return;
    $("#mp-name").textContent = r.name;
    $("#mp-info").textContent = `${r.symbol}${r.boerse ? ` · ${r.boerse}` : ""}${r.waehrung ? ` · ${r.waehrung}` : ""}`;
    $("#mp-kurs").textContent = fmt(r.jetzt);
    const chg = r.verlauf?.veraenderung;
    $("#mp-chg").className = klasse(chg);
    $("#mp-chg").textContent = `${pz(chg)} · ${katalog?.zeitraeume?.[zeitraum] || zeitraum}`;
    $("#mp-wache-knopf").textContent = r.beobachtet ? "👁 Wird bewacht ✓" : "👁 Bewachen";
    const tageMax = r.jahr?.punkte?.length ? Math.round((r.jahr.punkte.at(-1)[0] - r.jahr.punkte[0][0]) / 864e5) : 0;
    $("#mp-strahl").max = String(Math.max(1, tageMax));
    $("#mp-strahl").value = String(Math.max(1, tageMax) - strahlTage);
    zeichneAnalyse();
    zeichnePrognose();
    zeichneChart();
    strahlInfo();
  }

  function zeichneAnalyse() {
    const a = daten?.analyse, ziel = $("#mp-analyse");
    if (!a) { ziel.innerHTML = daten ? `<div class="mp-leer">Für eine Analyse fehlen noch Tageskurse.</div>` : ""; return; }
    const v = a.veraenderung;
    const kachel = (t, w, k = "") => `<div><small>${t}</small><b class="${k}">${w}</b></div>`;
    ziel.innerHTML = `<div class="mp-kacheln">
      ${kachel("HEUTE", pz(v["1T"]), klasse(v["1T"]))}${kachel("1 WOCHE", pz(v["1W"]), klasse(v["1W"]))}${kachel("1 MONAT", pz(v["1M"]), klasse(v["1M"]))}${kachel("3 MONATE", pz(v["3M"]), klasse(v["3M"]))}${kachel("1 JAHR", pz(v["1J"]), klasse(v["1J"]))}
      ${kachel("TREND", { aufwärts: "▲ AUFWÄRTS", abwärts: "▼ ABWÄRTS", seitwärts: "◆ SEITWÄRTS" }[a.trend], a.trend === "aufwärts" ? "pos" : a.trend === "abwärts" ? "neg" : "")}
      ${kachel("RSI 14", a.rsi == null ? "–" : Math.round(a.rsi), a.rsi >= 70 ? "neg" : a.rsi <= 30 ? "pos" : "")}
      ${kachel("SCHWANKUNG", a.schwankung == null ? "–" : `${Math.round(a.schwankung)} % · ${a.schwankungStufe}`)}
      ${kachel("MAX. RÜCKGANG", pz(a.maxRueckgang), "neg")}
      <div><small>52-WOCHEN ${fmt(a.tief52)} – ${fmt(a.hoch52)}</small><b>${Math.round(a.lage52)} %</b><i style="width:100%"></i><span class="mp-marke" style="left:calc(${Math.max(0, Math.min(100, a.lage52))}% - 1px)"></span></div>
    </div><p class="mp-text">${esc(a.text)}</p>`;
  }

  function zeichnePrognose() {
    const p = daten?.prognose, ziel = $("#mp-prognose");
    if (!p) { ziel.innerHTML = ""; return; }
    if (!p.ok) { ziel.innerHTML = `<div class="mp-leer">${esc(p.error)}</div>`; return; }
    const rb = p.rueckblick;
    ziel.innerHTML = `<div class="mp-prog">
      <div class="mp-kacheln">
        <div><small>VERLÄUFE HÖHER</small><b class="groß">${p.anteil} %</b><i style="width:${p.anteil}%;background:#2ee6d0"></i></div>
        <div><small>MITTE IN ${p.tage} TAGEN</small><b>${fmt(p.median)}</b></div>
        <div><small>SPANNE 90 %</small><b>${fmt(p.p5)} – ${fmt(p.p95)}</b></div>
        <div><small>BILD</small><b>${esc(p.sicht.split(" (")[0])}</b></div>
      </div>
      <p class="mp-text">${esc(p.text)}</p>
      ${rb.quote == null ? "" : `<div class="mp-ehrlich"><span>EHRLICHKEITS-CHECK: lag ${rb.quote} % richtig (${rb.faelle} Fälle)</span><span class="balken"><span style="width:${rb.quote}%"></span><em title="Münzwurf 50 %"></em></span><span>Münzwurf 50 %</span></div>`}
    </div>`;
  }

  // ---------- Chart ----------
  let geom = null;
  function zeichneChart() {
    const cv = $("#mp-chart");
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d");
    g.scale(dpr, dpr);
    g.clearRect(0, 0, W, H);
    const v = daten?.verlauf;
    if (!v?.punkte?.length) return;
    const pts = v.punkte.map((p) => [p[0], p[4]]);
    const p = daten.prognose?.ok && ["3M", "6M", "1J"].includes(zeitraum) ? daten.prognose : null;
    const right = 70, left = 6, top = 12, bottom = 22;
    const t0 = pts[0][0], t1 = pts.at(-1)[0];
    const schritt = pts.length > 1 ? (t1 - t0) / (pts.length - 1) : 864e5;
    const tEnde = p ? t1 + p.tage * (daten.gruppe === "krypto" ? 864e5 : 864e5 * 1.4) : t1;
    let lo = Infinity, hi = -Infinity;
    pts.forEach(([, c]) => { lo = Math.min(lo, c); hi = Math.max(hi, c); });
    if (p) p.band.forEach((b) => { lo = Math.min(lo, b[0]); hi = Math.max(hi, b[4]); });
    const pad = (hi - lo) * 0.08 || hi * 0.01 || 1; lo -= pad; hi += pad;
    const xs = (t) => left + ((t - t0) / (tEnde - t0 || 1)) * (W - left - right);
    const ys = (c) => top + (1 - (c - lo) / (hi - lo)) * (H - top - bottom);
    geom = { pts, xs, ys, t0, tEnde, W, H, left, right };
    // Raster + Achsen
    g.font = "10px ui-monospace, Menlo, monospace";
    g.strokeStyle = "rgba(255,255,255,.06)"; g.fillStyle = "rgba(255,255,255,.45)"; g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const c = lo + ((hi - lo) * i) / 4, y = ys(c); g.beginPath(); g.moveTo(left, y); g.lineTo(W - right, y); g.stroke(); g.fillText(fmt(c), W - right + 6, y + 3); }
    const intraday = ["1T", "1W"].includes(zeitraum);
    for (let i = 0; i <= 4; i++) { const t = t0 + ((t1 - t0) * i) / 4; const x = xs(t); g.fillText(intraday ? datum(t, true).slice(zeitraum === "1T" ? 7 : 0) : datum(t), Math.min(W - right - 50, Math.max(left, x - 22)), H - 6); }
    // Fläche + Linie
    const auf = pts.at(-1)[1] >= pts[0][1];
    const farbe = auf ? "77,255,166" : "255,93,108";
    const grad = g.createLinearGradient(0, top, 0, H - bottom);
    grad.addColorStop(0, `rgba(${farbe},.28)`); grad.addColorStop(1, `rgba(${farbe},0)`);
    g.beginPath(); pts.forEach(([t, c], i) => (i ? g.lineTo(xs(t), ys(c)) : g.moveTo(xs(t), ys(c))));
    g.lineTo(xs(t1), H - bottom); g.lineTo(xs(t0), H - bottom); g.closePath(); g.fillStyle = grad; g.fill();
    g.save(); g.shadowColor = `rgba(${farbe},.8)`; g.shadowBlur = 8;
    g.strokeStyle = `rgb(${farbe})`; g.lineWidth = 1.8;
    g.beginPath(); pts.forEach(([t, c], i) => (i ? g.lineTo(xs(t), ys(c)) : g.moveTo(xs(t), ys(c)))); g.stroke(); g.restore();
    // 50-Tage-Schnitt (aus dem Jahresverlauf)
    const jahr = daten.jahr?.punkte;
    if (jahr && !intraday && jahr.length > 50) {
      g.strokeStyle = "rgba(255,204,77,.7)"; g.lineWidth = 1.2; g.setLineDash([4, 4]); g.beginPath();
      let start = false;
      for (let i = 49; i < jahr.length; i++) {
        if (jahr[i][0] < t0) continue;
        let s = 0; for (let k = i - 49; k <= i; k++) s += jahr[k][1];
        const x = xs(jahr[i][0]), y = ys(s / 50);
        if (!start) { g.moveTo(x, y); start = true; } else g.lineTo(x, y);
      }
      g.stroke(); g.setLineDash([]);
      g.fillStyle = "rgba(255,204,77,.8)"; g.fillText("— 50-TAGE-SCHNITT", left + 4, top + 10);
    }
    // Prognose-Fächer
    if (p) {
      const tx = (j) => t1 + ((j + 1) / p.tage) * (tEnde - t1);
      const x0 = xs(t1), y0 = ys(daten.verlauf.jetzt);
      const flaeche = (a, b, f) => { g.fillStyle = f; g.beginPath(); g.moveTo(x0, y0); p.band.forEach((q, j) => g.lineTo(xs(tx(j)), ys(q[b]))); for (let j = p.band.length - 1; j >= 0; j--) g.lineTo(xs(tx(j)), ys(p.band[j][a])); g.closePath(); g.fill(); };
      flaeche(0, 4, "rgba(46,230,208,.10)"); flaeche(1, 3, "rgba(46,230,208,.18)");
      g.save(); g.globalCompositeOperation = "lighter"; g.strokeStyle = "rgba(46,230,208,.10)"; g.lineWidth = 1;
      (p.beispiele || []).forEach((b) => { g.beginPath(); g.moveTo(x0, y0); b.forEach((c, j) => g.lineTo(xs(tx(j)), ys(c))); g.stroke(); });
      g.restore();
      g.strokeStyle = "#8ff3e6"; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(x0, y0); p.band.forEach((q, j) => g.lineTo(xs(tx(j)), ys(q[2]))); g.stroke(); g.setLineDash([]);
      g.fillStyle = "rgba(143,243,230,.85)"; g.fillText("PROGNOSE (UNSICHER)", Math.min(W - right - 130, x0 + 6), top + 10);
      g.strokeStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.moveTo(x0, top); g.lineTo(x0, H - bottom); g.stroke();
    }
    // Zeitstrahl-Marke
    if (strahlTage > 0 && jahr) {
      const t = jahr.at(-1)[0] - strahlTage * 864e5;
      if (t >= t0) {
        const x = xs(t);
        g.strokeStyle = "rgba(255,138,30,.9)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, top); g.lineTo(x, H - bottom); g.stroke();
        const pkt = naechster(jahr, t);
        if (pkt) { const y = ys(pkt[1]); g.fillStyle = "#ff8a1e"; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
      }
    }
    // Jetzt-Punkt
    const xj = xs(t1), yj = ys(pts.at(-1)[1]);
    const glow = g.createRadialGradient(xj, yj, 0, xj, yj, 14);
    glow.addColorStop(0, "rgba(255,255,255,.95)"); glow.addColorStop(0.35, `rgba(${farbe},.6)`); glow.addColorStop(1, `rgba(${farbe},0)`);
    g.fillStyle = glow; g.beginPath(); g.arc(xj, yj, 14, 0, Math.PI * 2); g.fill();
    void schritt;
  }
  const naechster = (arr, t) => { let best = null; for (const p of arr) { if (!best || Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p; } return best; };

  // Fadenkreuz mit Wert und Datum
  const cv = $("#mp-chart"), tip = $("#mp-tip");
  cv.addEventListener("pointermove", (e) => {
    if (!geom) return;
    const rect = cv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = geom.t0 + ((x - geom.left) / (geom.W - geom.left - geom.right)) * (geom.tEnde - geom.t0);
    const pkt = naechster(geom.pts, t);
    if (!pkt) return;
    const seit = ((daten.verlauf.jetzt / pkt[1]) - 1) * 100;
    tip.style.display = "block";
    tip.style.left = `${geom.xs(pkt[0])}px`; tip.style.top = `${geom.ys(pkt[1])}px`;
    tip.innerHTML = `${datum(pkt[0], ["1T", "1W", "1M"].includes(zeitraum))} · <b>${fmt(pkt[1])}</b> · seitdem <span class="${klasse(seit)}">${pz(seit)}</span>`;
  });
  cv.addEventListener("pointerleave", () => { tip.style.display = "none"; });

  // ---------- Zeitstrahl ----------
  function strahlInfo() {
    const info = $("#mp-strahl-info"), jahr = daten?.jahr?.punkte;
    if (!jahr?.length) { info.textContent = "Für den Zeitstrahl fehlen Tageskurse."; return; }
    if (!strahlTage) { info.textContent = "Zieh den Regler nach links, um bis zu 1 Jahr zurückzuschauen."; return; }
    const pkt = naechster(jahr, jahr.at(-1)[0] - strahlTage * 864e5);
    const seit = (daten.jetzt / pkt[1] - 1) * 100;
    info.innerHTML = `Vor ${strahlTage} Tagen (${datum(pkt[0])}): <b>${fmt(pkt[1])}</b> · seitdem <span class="${klasse(seit)}">${pz(seit)}</span>`;
  }
  $("#mp-strahl").addEventListener("input", async (e) => {
    strahlTage = Number(e.target.max) - Number(e.target.value);
    const noetig = strahlTage > 183 ? "1J" : strahlTage > 92 ? (["1J"].includes(zeitraum) ? zeitraum : "6M") : strahlTage > 31 ? (["6M", "1J"].includes(zeitraum) ? zeitraum : "3M") : zeitraum;
    if (strahlTage > 0 && noetig !== zeitraum && !["1T", "1W", "1M"].includes(noetig)) { zeitraum = noetig; zeichneGruppen(); strahlInfo(); await lade(symbol); return; }
    zeichneChart(); strahlInfo();
  });

  // ---------- Markt-Wache ----------
  function zeichneWache() {
    const s = wache;
    if (!s) return;
    $("#mp-w-an").checked = s.an; $("#mp-w-melden").checked = s.melden; $("#mp-w-takt").value = String(s.intervall_min);
    $("#mp-puls").classList.toggle("aus", !s.an);
    $("#mp-w-stand").textContent = s.fehler ? s.fehler : s.laeuft ? "Prüft gerade …" : s.zuletzt ? `Zuletzt geprüft ${datum(s.zuletzt, true)} · ${s.liste.filter((w) => w.an).length} Märkte` : "Noch nicht geprüft.";
    $("#mp-w-stand").className = `mp-status${s.fehler ? " error" : ""}`;
    $("#mp-wliste").innerHTML = s.liste.map((w) => `<div class="mp-w" data-wid="${esc(w.id)}" data-wsym="${esc(w.symbol)}">
      <div class="k"><b data-wopen="${esc(w.symbol)}">${esc(w.name)}</b><span>${w.letzterKurs != null ? `${fmt(w.letzterKurs)} <span class="${klasse(w.letzteVeraenderung)}">${pz(w.letzteVeraenderung)}</span>` : ""}</span><button class="x" data-wweg="${esc(w.id)}" title="Nicht mehr bewachen">✕</button></div>
      <div class="f"><label>BEWEGUNG %<input inputmode="decimal" data-wfeld="bewegung" value="${w.bewegung ?? ""}"></label><label>ÜBER<input inputmode="decimal" data-wfeld="ueber" value="${w.ueber ?? ""}" placeholder="–"></label><label>UNTER<input inputmode="decimal" data-wfeld="unter" value="${w.unter ?? ""}" placeholder="–"></label></div>
    </div>`).join("") || `<div class="mp-leer">Noch nichts bewacht. Wähle einen Markt und tippe „👁 Bewachen“.</div>`;
    $("#mp-hinweise").innerHTML = s.hinweise.map((h) => `<div class="mp-h ${h.gelesen ? "" : "neu"}"><small>${datum(h.zeit, true)} · ${esc(h.name)}</small>${esc(h.text)}</div>`).join("") || `<div class="mp-leer">Noch keine Hinweise. Die Wache meldet starke Bewegungen, deine Preis-Marken und neue Jahreshochs/-tiefs.</div>`;
    const zahl = tab.querySelector(".mp-zahl");
    zahl.hidden = !s.neu; zahl.textContent = s.neu || "";
  }
  async function ladeWache({ melden = false } = {}) {
    try {
      wache = await json("/api/marktplus/wache");
      const neu = wache.hinweise.filter((h) => !h.gelesen);
      if (gesehen && melden) {
        const frisch = neu.filter((h) => !gesehen.has(h.id));
        if (frisch.length) F.sagVonSelbst?.(`Markt-Wache: ${frisch.slice(0, 2).map((h) => h.text).join(" ")}`, { quelle: "markt", stufe: "warn" });
      }
      gesehen = new Set(wache.hinweise.map((h) => h.id));
      zeichneWache();
    } catch { /* gesperrt oder Server weg */ }
  }
  wurzel.addEventListener("change", async (e) => {
    const f = e.target.closest("[data-wfeld]");
    try {
      if (f) {
        const w = f.closest(".mp-w");
        wache = await json("/api/marktplus/wache/markt", { symbol: w.dataset.wsym, [f.dataset.wfeld]: f.value.trim() === "" ? null : f.value.trim() });
        zeichneWache(); return;
      }
      if (["mp-w-an", "mp-w-melden", "mp-w-takt"].includes(e.target.id)) {
        wache = await json("/api/marktplus/wache", { an: $("#mp-w-an").checked, melden: $("#mp-w-melden").checked, intervall_min: Number($("#mp-w-takt").value) });
        zeichneWache();
      }
    } catch (err) { $("#mp-w-stand").textContent = err.message; }
  });
  wurzel.addEventListener("keydown", (e) => { if (e.target.matches("input, select")) e.stopPropagation(); });

  // ---------- Knöpfe ----------
  wurzel.addEventListener("click", async (e) => {
    const zeile = e.target.closest(".mp-zeile");
    if (zeile) { strahlTage = 0; prognoseTage = 0; lade(zeile.dataset.symbol, { prognose: 0 }); if (innerWidth < 900) $(".mp-haupt").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const gr = e.target.closest("[data-gruppe]");
    if (gr) { $("#mp-suche").value = ""; return ladeGruppe(gr.dataset.gruppe); }
    const zt = e.target.closest("[data-zeit]");
    if (zt) { zeitraum = zt.dataset.zeit; strahlTage = 0; zeichneGruppen(); return lade(symbol); }
    const wo = e.target.closest("[data-wopen]");
    if (wo) return lade(wo.dataset.wopen, { prognose: 0 });
    const weg = e.target.closest("[data-wweg]");
    if (weg) { wache = await json("/api/marktplus/wache/entfernen", { id: weg.dataset.wweg }).catch(() => wache); zeichneWache(); if (daten) { daten.beobachtet = wache.liste.some((w) => w.symbol === daten.symbol); zeige(); } return; }
    const b = e.target.closest("[data-mp]");
    if (!b) return;
    const was = b.dataset.mp;
    if (was === "analyse") { const r = daten?.symbol === symbol ? daten : await lade(symbol); if (r?.analyse) sag(`${r.analyse.text} Keine Anlageberatung.`); }
    else if (was === "prognose") {
      if (["1T", "1W", "1M"].includes(zeitraum)) { zeitraum = "6M"; zeichneGruppen(); }
      const r = await lade(symbol, { prognose: Number($("#mp-tage").value) || 20 });
      if (r?.prognose?.ok) sag(r.prognose.text); else if (r?.prognose?.error) sag(r.prognose.error);
    } else if (was === "fragen") {
      if (!daten) return;
      F.send?.(`Analysiere ${daten.name} (Kürzel ${daten.symbol}) mit dem Markt-Radar Plus und erkläre mir einfach, was gerade los ist und was die Prognose sagt.`);
    } else if (was === "wache") {
      if (!daten) return;
      try {
        wache = daten.beobachtet ? await json("/api/marktplus/wache/entfernen", { id: daten.symbol }) : await json("/api/marktplus/wache/markt", { symbol: daten.symbol, name: daten.name });
        daten.beobachtet = wache.liste.some((w) => w.symbol === daten.symbol);
        zeichneWache(); zeige();
        if (daten.beobachtet) sag(`Mach ich. Die Markt-Wache passt jetzt auf ${daten.name} auf.`);
      } catch (err) { $("#mp-w-stand").textContent = err.message; }
    } else if (was === "pruefen") {
      $("#mp-w-stand").textContent = "Prüft gerade …"; $("#mp-w-stand").className = "mp-status busy";
      try { wache = await json("/api/marktplus/wache/pruefen", {}); zeichneWache(); gesehen = new Set(wache.hinweise.map((h) => h.id)); if (wache.neueHinweise?.length) sag(`Markt-Wache: ${wache.neueHinweise.slice(0, 2).map((h) => h.text).join(" ")}`); }
      catch (err) { $("#mp-w-stand").textContent = err.message; }
    } else if (was === "gelesen") { wache = await json("/api/marktplus/wache/gelesen", {}).catch(() => wache); zeichneWache(); }
  });

  // ---------- Ein- und Ausblenden ----------
  async function plusAn() {
    box.classList.add("mp-an");
    box.querySelectorAll("[data-asset-tab]").forEach((x) => x.classList.remove("on"));
    tab.classList.add("on");
    if (!katalog) {
      try { katalog = await json("/api/marktplus/katalog"); } catch (e) { $("#mp-status").textContent = e.message; return; }
    }
    if (!listeDa) { listeDa = true; zeichneGruppen(); ladeGruppe(gruppe); }
    ladeWache();
    if (!daten || daten.symbol !== symbol) lade(symbol); else requestAnimationFrame(zeichneChart);
  }
  function plusAus() { box.classList.remove("mp-an"); tab.classList.remove("on"); }
  tab.addEventListener("click", () => plusAn()); // in Friday fängt das Eve-Schloss den Klick vorher ab
  tabs?.addEventListener("click", (e) => { if (e.target.closest("[data-asset-tab]")) plusAus(); });
  window.addEventListener("resize", () => { if (box.classList.contains("mp-an") && !box.classList.contains("hidden")) zeichneChart(); });

  /** Für Sprachbefehle: "SYMBOL", "SYMBOL|prognose", "wache" oder "" (nur öffnen). */
  async function open(arg = "") {
    box.classList.remove("hidden");
    const [sym, extra] = String(arg || "").split("|");
    if (sym && sym !== "wache") { symbol = sym; strahlTage = 0; }
    await plusAn();
    if (sym && sym !== "wache") {
      if (extra === "prognose") { if (["1T", "1W", "1M"].includes(zeitraum)) { zeitraum = "6M"; zeichneGruppen(); } await lade(symbol, { prognose: 20 }); }
      else await lade(symbol, { prognose: 0 });
    }
    if (sym === "wache") $("#mp-wache").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  window.FridayMarktPlus = { open, refresh: () => ladeWache({ melden: true }) };

  // Hinweise der Markt-Wache im Hintergrund abholen (nur wenn offen für dieses Gerät: Eve oder freigegeben).
  (async () => {
    try { const k = await json("/api/marktplus/katalog"); katalog = katalog || k; if (!k.frei) return; } catch { return; }
    await ladeWache();
    setInterval(() => { if (!document.hidden) ladeWache({ melden: true }); }, 3 * 60e3);
  })();
})();
