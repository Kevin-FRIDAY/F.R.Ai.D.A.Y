// F.R.Ai.D.A.Y Spiele-Werkstatt (v1.101.0)
// "Friday, bau mir ein Spiel …": Ein Fenster zeigt live, wie Friday den Code schreibt (Editor mit
// Zeilennummern und Farben), danach startet das Spiel automatisch – abgeschottet im iframe, auch auf dem iPhone.
// Alle Spiele liegen in ~/Friday-Spiele und sind über "Meine Spiele" oder "öffne mein …-Spiel" wieder spielbar.
(() => {
  "use strict";
  const F = window.Friday || {};
  const api = F.api;
  if (!api) return;
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const $ = (id) => document.getElementById(id);
  const sag = (t) => { try { F.say?.(t); } catch { /* egal */ } };

  // ---------- Aussehen ----------
  const css = document.createElement("style");
  css.textContent = `
  #spiele .sp-box { width: min(1280px, 100%); max-height: none; height: min(92vh, 980px); display: flex; flex-direction: column; padding: 14px 16px 16px; overflow: hidden; }
  #spiele .sheet-top { gap: 10px; margin-bottom: 10px; }
  #spiele .sheet-top h2 { flex: 0 0 auto; }
  .sp-status { margin-right: auto; font: 600 11px/1 var(--font-mono, ui-monospace, Menlo, monospace); letter-spacing: .14em; text-transform: uppercase; padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(255,138,30,.45); color: #ffc58f; background: rgba(255,138,30,.08); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 52vw; }
  .sp-status.schreibt { animation: sp-puls 1.1s ease-in-out infinite; }
  .sp-status.vorlage { border-color: rgba(46,230,208,.55); color: #8ff3e6; background: rgba(46,230,208,.08); }
  .sp-status.fehler { border-color: rgba(255,70,70,.6); color: #ff9a9a; background: rgba(255,60,60,.08); }
  @keyframes sp-puls { 50% { box-shadow: 0 0 16px rgba(255,138,30,.55); } }
  .sp-leiste { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
  .sp-leiste form { flex: 1 1 320px; display: flex; gap: 8px; min-width: 0; }
  .sp-leiste input { flex: 1; min-width: 0; padding: 10px 14px; border-radius: 12px; border: 1px solid rgba(255,138,30,.4); background: rgba(0,0,0,.35); color: inherit; font-size: 15px; }
  .sp-leiste input:focus { outline: none; border-color: #ff8a1e; box-shadow: 0 0 0 3px rgba(255,138,30,.18); }
  .sp-hinweis { font-size: 13px; color: #8ff3e6; margin: -4px 0 8px; min-height: 0; }
  .sp-hinweis:empty { display: none; }
  .sp-hinweis.fehler { color: #ff9a9a; }
  .sp-buehne { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 12px; transition: grid-template-columns .5s ease; }
  .sp-buehne.spielt { grid-template-columns: minmax(0, .55fr) minmax(0, 1.45fr); }
  .sp-buehne.spielt.ohne-code { grid-template-columns: 0fr minmax(0, 1fr); gap: 0; }
  .sp-buehne.ohne-code .sp-editor { opacity: 0; pointer-events: none; }
  .sp-editor, .sp-spiel { min-height: 0; display: flex; flex-direction: column; border-radius: 14px; border: 1px solid rgba(255,138,30,.35); background: rgba(6,4,2,.82); box-shadow: inset 0 0 30px rgba(255,138,30,.05), 0 0 20px rgba(255,138,30,.08); overflow: hidden; }
  .sp-tabs { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-bottom: 1px solid rgba(255,138,30,.22); font: 12px var(--font-mono, ui-monospace, Menlo, monospace); color: #d9b48f; background: rgba(255,138,30,.05); }
  .sp-tabs i { width: 9px; height: 9px; border-radius: 50%; background: rgba(255,138,30,.35); display: inline-block; }
  .sp-tabs i:nth-child(2) { background: rgba(255,196,77,.4); } .sp-tabs i:nth-child(3) { background: rgba(46,230,208,.4); }
  .sp-tabs b { margin-left: 6px; color: #ffd8b0; font-weight: 600; padding: 3px 9px; border-radius: 6px; background: rgba(255,138,30,.12); border: 1px solid rgba(255,138,30,.3); }
  .sp-tabs span { margin-left: auto; opacity: .75; white-space: nowrap; }
  .sp-code { flex: 1; min-height: 0; overflow: auto; margin: 0; padding: 10px 0 30px; font: 12.5px/1.55 var(--font-mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace); color: #f3dcc4; counter-reset: zeile; tab-size: 2; -webkit-overflow-scrolling: touch; }
  .sp-code .z { display: block; padding: 0 14px 0 58px; position: relative; white-space: pre-wrap; word-break: break-word; min-height: 1.55em; }
  .sp-code .z::before { counter-increment: zeile; content: counter(zeile); position: absolute; left: 0; width: 44px; text-align: right; color: rgba(255,138,30,.38); }
  .sp-code .z.neu { animation: sp-neu .6s ease-out; }
  @keyframes sp-neu { from { background: rgba(255,138,30,.16); } to { background: transparent; } }
  .sp-code .k { color: #ff9d3c; } .sp-code .t { color: #2ee6d0; } .sp-code .s { color: #ffd479; } .sp-code .c { color: #7d6a58; font-style: italic; } .sp-code .n { color: #c49bff; } .sp-code .a { color: #ffb98a; }
  .sp-cursor { display: inline-block; width: 8px; height: 1.15em; vertical-align: text-bottom; background: #ff8a1e; box-shadow: 0 0 10px #ff8a1e; animation: sp-blink .9s steps(1) infinite; margin-left: 1px; }
  @keyframes sp-blink { 50% { opacity: 0; } }
  .sp-fuss { display: flex; gap: 14px; padding: 6px 12px; border-top: 1px solid rgba(255,138,30,.22); font: 11px var(--font-mono, ui-monospace, Menlo, monospace); color: #c9a888; letter-spacing: .06em; }
  .sp-fuss .sp-balken { flex: 1; height: 4px; align-self: center; border-radius: 4px; background: rgba(255,138,30,.15); overflow: hidden; }
  .sp-fuss .sp-balken i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #ff8a1e, #ffc44d); box-shadow: 0 0 8px #ff8a1e; transition: width .3s; }
  .sp-spiel { position: relative; }
  .sp-spiel-kopf { display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 12px; border-bottom: 1px solid rgba(255,138,30,.22); background: rgba(255,138,30,.05); flex-wrap: wrap; }
  .sp-spiel-kopf b { margin-right: auto; font-size: 13px; letter-spacing: .08em; color: #ffd8b0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%; }
  .sp-spiel-kopf .chip { padding: 6px 10px; font-size: 12px; }
  .sp-rahmen { flex: 1; min-height: 0; position: relative; background: #000; }
  .sp-rahmen iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #000; }
  .sp-warten { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; padding: 20px; color: #d9b48f; font-size: 14px; background: radial-gradient(circle at 50% 45%, rgba(255,138,30,.1), transparent 60%); }
  .sp-warten .sp-ring { flex: 0 0 auto; width: 86px; height: 86px; border-radius: 50%; border: 2px solid rgba(255,138,30,.2); border-top-color: #ff8a1e; box-shadow: 0 0 22px rgba(255,138,30,.3); animation: sp-dreh 1.1s linear infinite; }
  .sp-warten.boot .sp-ring { border-top-color: #2ee6d0; animation-duration: .45s; }
  .sp-warten.aus { display: none; }
  @keyframes sp-dreh { to { transform: rotate(360deg); } }
  .sp-spiel.voll { position: fixed; inset: 0; z-index: 2000; border-radius: 0; border: 0; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); background: #000; }
  .sp-sammlung { position: absolute; inset: 0; z-index: 5; background: rgba(6,4,2,.97); overflow: auto; padding: 14px; border-radius: 14px; }
  .sp-sammlung.hidden { display: none; }
  .sp-sammlung h3 { margin: 4px 0 10px; display: flex; align-items: center; gap: 10px; }
  .sp-sammlung h3 button { margin-left: auto; }
  .sp-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
  .sp-karte { text-align: left; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,138,30,.32); background: rgba(255,138,30,.06); color: inherit; display: flex; flex-direction: column; gap: 6px; cursor: pointer; font: inherit; }
  .sp-karte:hover, .sp-karte:focus-visible { border-color: #ff8a1e; box-shadow: 0 0 16px rgba(255,138,30,.28); outline: none; }
  .sp-karte b { font-size: 15px; color: #ffd8b0; }
  .sp-karte small { color: #b99a7c; font-size: 12px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .sp-karte .sp-tags { display: flex; gap: 6px; align-items: center; font-size: 11px; }
  .sp-karte .sp-tag { padding: 2px 7px; border-radius: 999px; border: 1px solid rgba(255,138,30,.4); color: #ffc58f; }
  .sp-karte .sp-tag.v { border-color: rgba(46,230,208,.5); color: #8ff3e6; }
  .sp-karte .sp-weg { margin-left: auto; background: none; border: 0; color: #9c7f63; font-size: 14px; cursor: pointer; padding: 2px 4px; }
  .sp-karte .sp-weg:hover { color: #ff8a8a; }
  .sp-vorlagen { margin-top: 16px; }
  .sp-vorlagen p { font-size: 12px; color: #a98d72; margin: 0 0 8px; }
  .sp-leer { color: #a98d72; font-size: 14px; padding: 10px 2px; }
  /* Spiele-Datenbank · Grafik-Plus (v1.144.0, zuerst nur in Eve) */
  .sp-plus-bereich { margin-top: 18px; position: relative; }
  .sp-plus-bereich h3 { color: #ffd8b0; }
  .sp-plus-bereich h3 em { font-style: normal; font-size: 11px; letter-spacing: .14em; padding: 3px 8px; border-radius: 999px; border: 1px solid rgba(46,230,208,.55); color: #8ff3e6; }
  .sp-filter { display: flex; gap: 6px; flex-wrap: wrap; margin: 0 0 10px; }
  .sp-filter button { padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(255,138,30,.35); background: rgba(255,138,30,.06); color: #e6c7a6; font: 600 12px inherit; cursor: pointer; }
  .sp-filter button.an { border-color: #ff8a1e; color: #fff; background: rgba(255,138,30,.22); box-shadow: 0 0 12px rgba(255,138,30,.3); }
  .sp-plus-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
  .sp-pkarte { position: relative; overflow: hidden; text-align: left; padding: 0; border-radius: 16px; border: 1px solid rgba(255,138,30,.4); background: #0b0710; color: inherit; cursor: pointer; font: inherit; display: flex; flex-direction: column; transition: transform .2s, box-shadow .2s; }
  .sp-pkarte:hover, .sp-pkarte:focus-visible { transform: translateY(-2px); border-color: #ff8a1e; box-shadow: 0 0 24px rgba(255,138,30,.35); outline: none; }
  .sp-pkarte .sp-bild { height: 92px; display: flex; align-items: center; justify-content: center; font-size: 44px; position: relative; background: radial-gradient(circle at 50% 120%, var(--f1, #ff8a1e) 0%, transparent 62%), linear-gradient(160deg, #1c0b2c, #07040c); filter: saturate(1.2); }
  .sp-pkarte .sp-bild::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(0,0,0,.14) 0 1px, transparent 1px 3px); pointer-events: none; }
  .sp-pkarte .sp-bild span { filter: drop-shadow(0 0 14px var(--f1, #ff8a1e)); }
  .sp-pkarte .sp-text { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 5px; }
  .sp-pkarte b { font-size: 15px; color: #ffd8b0; letter-spacing: .04em; }
  .sp-pkarte small { color: #b99a7c; font-size: 12px; line-height: 1.4; }
  .sp-pkarte .sp-tags { display: flex; gap: 6px; font-size: 11px; align-items: center; }
  .sp-pkarte .sp-tag { padding: 2px 7px; border-radius: 999px; border: 1px solid rgba(46,230,208,.5); color: #8ff3e6; }
  .sp-pkarte.gesperrt { opacity: .6; }
  .sp-pkarte.gesperrt .sp-bild::before { content: "🔒"; position: absolute; top: 8px; right: 10px; font-size: 16px; z-index: 1; }
  @media (max-width: 900px) {
    #spiele.sheet { padding: 0; align-items: stretch; }
    #spiele .sp-box { height: 100%; height: 100dvh; width: 100%; border-radius: 0; padding: calc(10px + env(safe-area-inset-top)) 10px calc(10px + env(safe-area-inset-bottom)); }
    .sp-buehne, .sp-buehne.spielt { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) minmax(0, .9fr); }
    .sp-buehne.spielt { grid-template-rows: 0fr minmax(0, 1fr); gap: 0; }
    .sp-buehne.spielt.mit-code { grid-template-rows: minmax(0, .8fr) minmax(0, 1fr); gap: 10px; }
    .sp-buehne.spielt:not(.mit-code) .sp-editor { opacity: 0; pointer-events: none; border: 0; }
    .sp-buehne.spielt.ohne-code { grid-template-columns: 1fr; }
    .sp-code { font-size: 11.5px; }
    .sp-code .z { padding-left: 44px; }
    .sp-code .z::before { width: 34px; }
    .sp-spiel-kopf b { max-width: 100%; flex-basis: 100%; }
    .sp-leiste input { font-size: 16px; }
    .sp-status { max-width: 46vw; }
  }`;
  document.head.appendChild(css);

  // ---------- Fenster ----------
  const sheet = document.createElement("section");
  sheet.id = "spiele";
  sheet.className = "sheet hidden";
  sheet.setAttribute("aria-label", "Spiele-Werkstatt");
  sheet.innerHTML = `<div class="panel sheet-box sp-box" lang="de">
      <header class="sheet-top"><h2>🎮 Spiele-Werkstatt</h2><span id="sp-status" class="sp-status">Bereit</span><button id="sp-x" class="ghost small" aria-label="Schließen">✕</button></header>
      <div class="sp-leiste">
        <form id="sp-form" autocomplete="off"><input id="sp-auftrag" placeholder="Was soll ich bauen? z. B. „ein Weltraum-Spiel mit Power-ups“" enterkeyhint="go"><button id="sp-go" class="chip primary" type="submit">▶ Bauen</button></form>
        <button id="sp-sammlung-knopf" class="chip" type="button">📚 Meine Spiele</button>
      </div>
      <p id="sp-hinweis" class="sp-hinweis"></p>
      <div id="sp-buehne" class="sp-buehne">
        <section class="sp-editor" aria-label="Code">
          <div class="sp-tabs"><i></i><i></i><i></i><b id="sp-datei">index.html</b><span id="sp-wer">Friday programmiert</span></div>
          <pre id="sp-code" class="sp-code" aria-live="off"></pre>
          <div class="sp-fuss"><span id="sp-zeilen">0 Zeilen</span><span id="sp-zeichen">0 Zeichen</span><span class="sp-balken"><i id="sp-balken"></i></span><span id="sp-zeit">0 s</span></div>
        </section>
        <section class="sp-spiel" id="sp-spiel" aria-label="Spiel">
          <div class="sp-spiel-kopf">
            <b id="sp-titel">Spiel</b>
            <button id="sp-neustart" class="chip" type="button" title="Neu starten">⟲ Neu</button>
            <button id="sp-code-knopf" class="chip" type="button" title="Code ein- oder ausblenden">&lt;/&gt; Code</button>
            <button id="sp-voll" class="chip" type="button" title="Vollbild">⛶ Vollbild</button>
            <button id="sp-dl" class="chip" type="button" title="Als HTML-Datei speichern">⬇</button>
          </div>
          <div class="sp-rahmen" id="sp-rahmen">
            <div id="sp-warten" class="sp-warten"><div class="sp-ring"></div><div id="sp-warten-text">Sag „Friday, bau mir ein Spiel“ oder tipp oben deine Idee ein.</div></div>
          </div>
        </section>
        <div id="sp-sammlung" class="sp-sammlung hidden" aria-label="Meine Spiele">
          <h3>📚 MEINE SPIELE <span id="sp-anzahl" class="muted"></span><button id="sp-sammlung-x" class="chip" type="button">Zurück</button></h3>
          <div id="sp-raster" class="sp-raster"></div>
          <div id="sp-plus" class="sp-plus-bereich" hidden><h3>✦ SPIELE-DATENBANK <em>GRAFIK-PLUS</em></h3><div id="sp-filter" class="sp-filter"></div><div id="sp-plus-raster" class="sp-plus-raster"></div></div>
          <div class="sp-vorlagen"><h3>EINGEBAUTE VORLAGEN</h3><p>Funktionieren immer, auch ohne Claude-Guthaben.</p><div id="sp-vorlagen" class="sp-raster"></div></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(sheet);
  const trigger = document.createElement("button");
  trigger.id = "spiele-open"; trigger.className = "hidden"; trigger.setAttribute("aria-hidden", "true"); trigger.tabIndex = -1;
  document.body.appendChild(trigger);

  // ---------- Zustand ----------
  let jobId = null, empfangen = "", gezeigt = 0, fertigeZeilen = 0, pollTimer = null, rafId = 0, gesamtGeschaetzt = 14000;
  let aktuellesHtml = "", aktuellesSpiel = null, jobInfo = null, codeAn = false, sammlung = { spiele: [], vorlagen: [], claude: true };

  const status = (text, art = "") => { const s = $("sp-status"); s.textContent = text; s.className = `sp-status ${art}`; };
  const hinweis = (text, fehler) => { const h = $("sp-hinweis"); h.textContent = text || ""; h.classList.toggle("fehler", Boolean(fehler)); };

  // ---------- Farben im Code (Zeile für Zeile, damit das Live-Schreiben flüssig bleibt) ----------
  const KW = /^(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|this|true|false|null|undefined|typeof|of|in|async|await|try|catch|finally|throw|default)$/;
  const TOKEN = /(\/\/.*$|<!--.*?(?:-->|$)|\/\*.*?(?:\*\/|$))|(<\/?[a-zA-Z][\w-]*|\/?>|<!doctype[^>]*>)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*=\s*["'{])|([A-Za-z_$][\w$]*)/gi;
  function faerbe(zeile) {
    let out = "", last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(zeile))) {
      if (m.index > last) out += esc(zeile.slice(last, m.index));
      const [voll, kom, tag, str, zahl, attr, wort] = m;
      if (kom) out += `<span class="c">${esc(kom)}</span>`;
      else if (tag) out += `<span class="t">${esc(tag)}</span>`;
      else if (str) out += `<span class="s">${esc(str)}</span>`;
      else if (zahl) out += `<span class="n">${zahl}</span>`;
      else if (attr) out += `<span class="a">${esc(attr)}</span>`;
      else if (wort) out += KW.test(wort) ? `<span class="k">${wort}</span>` : esc(wort);
      else out += esc(voll);
      last = m.index + voll.length;
      if (!voll.length) TOKEN.lastIndex++;
    }
    return out + esc(zeile.slice(last));
  }

  function codeLeeren() {
    $("sp-code").innerHTML = '<span class="z" id="sp-live"></span>';
    empfangen = ""; gezeigt = 0; fertigeZeilen = 0;
    zaehler();
  }
  // Zeigt den Code bis "bis" Zeichen: fertige Zeilen werden einmal angehängt, die letzte Zeile lebt.
  function zeigeBis(bis) {
    const code = $("sp-code");
    const text = empfangen.slice(0, bis);
    const zeilen = text.split("\n");
    const live = $("sp-live");
    const nachScroll = code.scrollTop + code.clientHeight >= code.scrollHeight - 60;
    if (zeilen.length - 1 > fertigeZeilen) {
      const frag = document.createDocumentFragment();
      for (let i = fertigeZeilen; i < zeilen.length - 1; i++) {
        const z = document.createElement("span");
        z.className = "z neu"; z.innerHTML = faerbe(zeilen[i]);
        frag.appendChild(z);
      }
      code.insertBefore(frag, live);
      fertigeZeilen = zeilen.length - 1;
      // Nicht unendlich viele Animationen behalten
      code.querySelectorAll(".z.neu").forEach((z, i, alle) => { if (i < alle.length - 12) z.classList.remove("neu"); });
    }
    live.innerHTML = `${faerbe(zeilen[zeilen.length - 1])}<span class="sp-cursor"></span>`;
    gezeigt = bis;
    if (nachScroll) code.scrollTop = code.scrollHeight;
    zaehler();
  }
  function zaehler() {
    const z = empfangen.slice(0, gezeigt);
    $("sp-zeilen").textContent = `${z ? z.split("\n").length : 0} Zeilen`;
    $("sp-zeichen").textContent = `${z.length.toLocaleString("de-DE")} Zeichen`;
    const fertig = jobInfo?.status === "fertig" && gezeigt >= empfangen.length;
    $("sp-balken").style.width = `${fertig ? 100 : Math.min(96, Math.round((gezeigt / gesamtGeschaetzt) * 100))}%`;
  }
  // Schreibmaschine: holt den Rückstand weich auf (je größer, desto schneller).
  function tippen() {
    cancelAnimationFrame(rafId);
    const schritt = () => {
      const rest = empfangen.length - gezeigt;
      if (rest > 0) zeigeBis(gezeigt + Math.max(6, Math.ceil(rest / 7)));
      if (rest > 0 || jobInfo?.status === "schreibt") rafId = requestAnimationFrame(schritt);
      else if (jobInfo?.status === "fertig") fertig();
    };
    rafId = requestAnimationFrame(schritt);
  }

  // ---------- Bauen ----------
  async function bauen(auftrag, opt = {}) {
    auftrag = String(auftrag || "").trim();
    if (!auftrag && !opt.vorlage) { hinweis("Beschreib kurz, was für ein Spiel du willst.", true); $("sp-auftrag").focus(); return; }
    try {
      const r = await (await api("/api/spiel", { method: "POST", body: JSON.stringify({ auftrag, basis: opt.basis || null, vorlage: opt.vorlage || null }) })).json();
      if (!r.ok) { hinweis(r.error || "Das hat nicht geklappt.", true); return; }
      verfolge(r.jobId);
    } catch { hinweis("Friday ist gerade nicht erreichbar.", true); }
  }

  // Einen laufenden Auftrag live mitverfolgen.
  function verfolge(id) {
    oeffnen();
    if (jobId === id && pollTimer) return;
    stopPoll();
    jobId = id; jobInfo = { status: "schreibt" };
    codeLeeren();
    $("sp-buehne").classList.remove("spielt", "ohne-code", "mit-code");
    $("sp-sammlung").classList.add("hidden");
    spielLeeren("Friday schreibt den Code … Sobald er fertig ist, startet das Spiel hier.");
    $("sp-titel").textContent = "Wird programmiert …";
    $("sp-datei").textContent = "index.html";
    status("● Schreibt Code", "schreibt");
    hinweis("");
    poll();
  }
  async function poll() {
    if (!jobId) return;
    const meinJob = jobId;
    try {
      const r = await api(`/api/spiel/job/${encodeURIComponent(meinJob)}?ab=${empfangen.length}`);
      if (meinJob !== jobId) return;
      if (r.status === 404) { status("Auftrag weg", "fehler"); hinweis("Der Auftrag ist nicht mehr da (Friday wurde neu gestartet?). Starte ihn einfach nochmal.", true); return; }
      const j = await r.json();
      jobInfo = j;
      if (j.ab === empfangen.length) empfangen += j.stueck;
      else if (j.ab < empfangen.length) { codeLeeren(); empfangen = ""; } // Code neu begonnen (z. B. auf Vorlage umgeschaltet)
      const vorlage = j.quelle === "vorlage";
      $("sp-wer").textContent = vorlage ? "Vorlage (offline)" : `Claude · ${String(j.modell || "").replace("claude-", "")}`;
      if (vorlage) { gesamtGeschaetzt = Math.max(j.laenge, 7000); status("◆ Vorlage (offline)", "vorlage"); if (j.hinweis) hinweis(j.hinweis); }
      else { gesamtGeschaetzt = Math.max(gesamtGeschaetzt, j.laenge * 1.15, 14000); }
      $("sp-zeit").textContent = `${j.sekunden} s`;
      tippen();
      if (j.status === "fehler") { stopPoll(); status("Fehler", "fehler"); hinweis(j.error || "Das Spiel hat nicht geklappt.", true); spielLeeren(j.error || "Hat nicht geklappt."); sag(`Das hat nicht geklappt, Boss. ${j.error || ""}`); return; }
      if (j.status === "fertig") { stopPoll(); return; }
    } catch { /* kurz warten, gleich nochmal */ }
    pollTimer = setTimeout(poll, 350);
  }
  function stopPoll() { clearTimeout(pollTimer); pollTimer = null; }

  async function fertig() {
    const j = jobInfo;
    if (!j?.spielId || aktuellesSpiel?.id === j.spielId && aktuellesSpiel.jobId === j.id) return;
    zeigeBis(empfangen.length);
    $("sp-live").querySelector(".sp-cursor")?.remove();
    $("sp-datei").textContent = `${j.titel || "spiel"}.html`;
    const vorlage = j.quelle === "vorlage";
    status(vorlage ? "◆ Vorlage gestartet" : "✓ Fertig · startet", vorlage ? "vorlage" : "");
    aktuellesSpiel = { id: j.spielId, titel: j.titel, jobId: j.id };
    // Kurze Start-Sequenz, dann läuft das Spiel.
    const w = $("sp-warten"); w.classList.add("boot"); $("sp-warten-text").textContent = "Code fertig · Spiel wird gestartet …";
    // Die gespeicherte, gesäuberte Fassung starten (ohne Markdown-Reste).
    let html = empfangen;
    try { const r = await api(`/api/spiel/${encodeURIComponent(j.spielId)}/html`); if (r.ok) html = (await r.json()).html || html; } catch { /* gestreamte Fassung nehmen */ }
    if (html !== empfangen) { const oben = $("sp-code").scrollTop; codeLeeren(); empfangen = html; zeigeBis(html.length); $("sp-live").querySelector(".sp-cursor")?.remove(); $("sp-code").scrollTop = oben; }
    await new Promise((r) => setTimeout(r, 600));
    starteHtml(html, j.titel);
    status(vorlage ? "◆ Vorlage · läuft" : "▶ Läuft", vorlage ? "vorlage" : "");
    sag(vorlage ? `${j.titel} läuft, Boss. Das ist eine eingebaute Vorlage.` : `Fertig, Boss. ${j.titel} läuft. Viel Spaß!`);
    window.FridayEnergie?.refresh?.();
    window.FridayLogbuch?.refresh?.();
  }

  // ---------- Spielen ----------
  function spielLeeren(text) {
    $("sp-rahmen").querySelector("iframe")?.remove();
    const w = $("sp-warten"); w.classList.remove("aus", "boot"); $("sp-warten-text").textContent = text;
  }
  function starteHtml(html, titel) {
    aktuellesHtml = html;
    $("sp-titel").textContent = titel || "Spiel";
    $("sp-rahmen").querySelector("iframe")?.remove();
    const f = document.createElement("iframe");
    // Abgeschottet: kein Zugriff auf Friday, Anmeldung oder Server. Nur Skripte und Zeiger-Sperre.
    f.setAttribute("sandbox", "allow-scripts allow-pointer-lock");
    f.setAttribute("allow", "autoplay; gamepad; fullscreen");
    f.setAttribute("title", titel || "Spiel");
    // Fehler-Melder: Stürzt das Spiel ab (z. B. schwarzes Bild), sagt Friday, was los ist, statt still zu bleiben.
    const melder = "<script>(function(){var n=0;function m(t){if(n++<3)try{parent.postMessage({fridaySpielFehler:String(t).slice(0,200)},'*')}catch(e){}}" +
      "window.addEventListener('error',function(e){m(e.message||'Unbekannter Fehler')});window.addEventListener('unhandledrejection',function(e){m(e.reason&&e.reason.message||e.reason)})})();<\/script>";
    f.srcdoc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (k) => k + melder) : melder + html;
    spielFrame = f;
    f.addEventListener("load", () => { try { f.focus(); f.contentWindow?.focus(); } catch { /* egal */ } });
    $("sp-rahmen").appendChild(f);
    $("sp-warten").classList.add("aus");
    const b = $("sp-buehne");
    b.classList.add("spielt");
    b.classList.toggle("ohne-code", !codeAn && innerWidth > 900);
    b.classList.toggle("mit-code", codeAn);
  }
  let spielFrame = null;
  window.addEventListener("message", (e) => {
    if (!spielFrame || e.source !== spielFrame.contentWindow || !e.data?.fridaySpielFehler) return;
    hinweis(`Das Spiel meldet einen Fehler: ${e.data.fridaySpielFehler}. Mit Guthaben sag einfach: Mach das Spiel fehlerfrei.`, true);
    status("⚠ Fehler im Spiel", "fehler");
  });
  async function spielOeffnen(id) {
    oeffnen();
    stopPoll(); jobId = null; jobInfo = { status: "fertig" };
    $("sp-sammlung").classList.add("hidden");
    hinweis("");
    status("Lade …");
    try {
      const r = await api(`/api/spiel/${encodeURIComponent(id)}/html`);
      if (!r.ok) throw new Error("weg");
      const { html } = await r.json();
      const s = sammlung.spiele.find((x) => x.id === id) || (await ladeSammlung(), sammlung.spiele.find((x) => x.id === id)) || { titel: "Spiel" };
      aktuellesSpiel = { id, titel: s.titel };
      codeLeeren(); empfangen = html; zeigeBis(html.length); $("sp-live").querySelector(".sp-cursor")?.remove();
      $("sp-wer").textContent = s.quelle === "vorlage" ? "Vorlage (offline)" : "Von Claude programmiert";
      $("sp-datei").textContent = `${s.titel}.html`;
      $("sp-zeit").textContent = new Date(s.erstellt || Date.now()).toLocaleDateString("de-DE");
      starteHtml(html, s.titel);
      status(s.quelle === "vorlage" ? "◆ Vorlage · läuft" : "▶ Läuft", s.quelle === "vorlage" ? "vorlage" : "");
    } catch { status("Nicht gefunden", "fehler"); hinweis("Dieses Spiel gibt es nicht mehr.", true); }
  }

  // ---------- Meine Spiele ----------
  async function ladeSammlung() {
    try { sammlung = await (await api("/api/spiele")).json(); } catch { /* alte Liste behalten */ }
    return sammlung;
  }
  async function zeigeSammlung() {
    oeffnen();
    $("sp-sammlung").classList.remove("hidden");
    $("sp-raster").innerHTML = '<p class="sp-leer">Lade …</p>';
    await ladeSammlung();
    const liste = sammlung.spiele || [];
    $("sp-anzahl").textContent = liste.length ? `· ${liste.length}` : "";
    $("sp-raster").innerHTML = liste.map((s) => `<div class="sp-karte" role="button" tabindex="0" data-id="${esc(s.id)}">
        <b>${esc(s.titel)}</b><small>${esc(s.auftrag || "")}</small>
        <span class="sp-tags"><span class="sp-tag${s.quelle === "vorlage" ? " v" : ""}">${s.quelle === "vorlage" ? "Vorlage" : "Claude"}</span><span>${new Date(s.erstellt).toLocaleDateString("de-DE")}</span>${s.mal ? `<span>· ${s.mal}× gespielt</span>` : ""}<button class="sp-weg" data-weg="${esc(s.id)}" title="In den Papierkorb" aria-label="${esc(s.titel)} in den Papierkorb">🗑</button></span>
      </div>`).join("") || '<p class="sp-leer">Noch keine Spiele. Sag „Friday, bau mir ein Spiel“ oder tipp oben eine Idee ein.</p>';
    zeigePlus();
    $("sp-vorlagen").innerHTML = (sammlung.vorlagen || []).filter((v) => !v.plus).map((v) => `<div class="sp-karte" role="button" tabindex="0" data-vorlage="${esc(v.id)}"><b>${esc(v.titel)}</b><span class="sp-tags"><span class="sp-tag v">Vorlage</span><span>einspielen</span></span></div>`).join("");
  }
  // Spiele-Datenbank: neue Grafik-Plus-Spiele mit Kategorien (in Friday gesperrt, bis Boss sie in Eve freigibt)
  const FARBEN = { Rennen: "#ff8a1e", Geschick: "#2ee6d0", Denken: "#b57bff", Abenteuer: "#3aa8ff", Strategie: "#ffc44d" };
  let filter = "Alle";
  function zeigePlus() {
    const plus = (sammlung.vorlagen || []).filter((v) => v.plus);
    $("sp-plus").hidden = !plus.length;
    if (!plus.length) return;
    const kats = ["Alle", ...new Set(plus.map((v) => v.kategorie))];
    if (!kats.includes(filter)) filter = "Alle";
    $("sp-filter").innerHTML = kats.map((k) => `<button type="button" data-filter="${esc(k)}" class="${k === filter ? "an" : ""}">${esc(k)}</button>`).join("");
    $("sp-plus-raster").innerHTML = plus.filter((v) => filter === "Alle" || v.kategorie === filter).map((v) => `<div class="sp-pkarte${v.gesperrt ? " gesperrt" : ""}" role="button" tabindex="0" data-plus="${esc(v.id)}" style="--f1:${FARBEN[v.kategorie] || "#ff8a1e"}">
        <div class="sp-bild"><span>${esc(v.symbol || "✦")}</span></div>
        <div class="sp-text"><b>${esc(v.titel)}</b><small>${esc(v.beschreibung || "")}</small>
        <span class="sp-tags"><span class="sp-tag">${esc(v.kategorie || "")}</span><span>${v.gesperrt ? "nur in Eve" : "ohne Guthaben spielbar"}</span></span></div>
      </div>`).join("");
    try { window.FridayEve?.refresh?.(); } catch { /* egal */ }
  }
  sheet.addEventListener("click", async (e) => {
    const f = e.target.closest("[data-filter]");
    if (f) { filter = f.dataset.filter; zeigePlus(); return; }
    const pk = e.target.closest("[data-plus]");
    if (pk) {
      const v = (sammlung.vorlagen || []).find((x) => x.id === pk.dataset.plus);
      if (v?.gesperrt) { hinweis(`🔒 ${v.titel} ist noch im Test. Probier es in Eve aus und gib es dort frei.`, true); return; }
      const da = (sammlung.spiele || []).find((x) => x.quelle === "vorlage" && x.vorlage === pk.dataset.plus);
      if (da) spielOeffnen(da.id); else bauen("", { vorlage: pk.dataset.plus });
      return;
    }
    const weg = e.target.closest("[data-weg]");
    if (weg) {
      e.stopPropagation();
      if (weg.dataset.sicher !== "1") { weg.dataset.sicher = "1"; weg.textContent = "Sicher?"; setTimeout(() => { weg.dataset.sicher = ""; weg.textContent = "🗑"; }, 3000); return; }
      try { await api(`/api/spiel/${encodeURIComponent(weg.dataset.weg)}/weg`, { method: "POST" }); } catch { /* egal */ }
      zeigeSammlung();
      return;
    }
    const k = e.target.closest(".sp-karte");
    if (k?.dataset.id) spielOeffnen(k.dataset.id);
    else if (k?.dataset.vorlage) bauen("", { vorlage: k.dataset.vorlage });
  });
  sheet.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && (e.target.classList?.contains("sp-karte") || e.target.classList?.contains("sp-pkarte"))) { e.preventDefault(); e.target.click(); } });

  // ---------- Knöpfe ----------
  $("sp-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("sp-auftrag").value;
    // Läuft gerade ein Claude-Spiel, kann man es direkt ändern lassen: "ändere: …"
    const m = text.match(/^\s*(?:ändere?|aendere?|änder)\s*:?\s*(.+)$/i);
    if (m && aktuellesSpiel?.id) bauen(m[1], { basis: aktuellesSpiel.id });
    else bauen(text);
    $("sp-auftrag").value = "";
  });
  $("sp-neustart").addEventListener("click", () => { if (aktuellesHtml) starteHtml(aktuellesHtml, $("sp-titel").textContent); });
  $("sp-code-knopf").addEventListener("click", () => {
    codeAn = !codeAn;
    const b = $("sp-buehne");
    if (!b.classList.contains("spielt")) return;
    b.classList.toggle("ohne-code", !codeAn && innerWidth > 900);
    b.classList.toggle("mit-code", codeAn);
  });
  function vollbild() {
    const box = $("sp-spiel");
    if (document.fullscreenElement || document.webkitFullscreenElement || box.classList.contains("voll")) {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.();
      box.classList.remove("voll");
      $("sp-voll").textContent = "⛶ Vollbild";
      return;
    }
    // Echtes Vollbild, wo es geht; auf dem iPhone füllt das Spiel einfach den ganzen Bildschirm.
    const req = box.requestFullscreen || box.webkitRequestFullscreen;
    box.classList.add("voll");
    $("sp-voll").textContent = "✕ Vollbild aus";
    if (req) { try { const p = req.call(box); p?.catch?.(() => {}); } catch { /* CSS-Vollbild reicht */ } }
    setTimeout(() => { try { box.querySelector("iframe")?.contentWindow?.focus(); } catch { /* egal */ } }, 200);
  }
  $("sp-voll").addEventListener("click", vollbild);
  const vollAus = () => { if (!document.fullscreenElement && !document.webkitFullscreenElement && $("sp-spiel").classList.contains("voll") && innerWidth > 900) { $("sp-spiel").classList.remove("voll"); $("sp-voll").textContent = "⛶ Vollbild"; } };
  document.addEventListener("fullscreenchange", vollAus);
  document.addEventListener("webkitfullscreenchange", vollAus);
  $("sp-dl").addEventListener("click", () => {
    if (!aktuellesHtml) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([aktuellesHtml], { type: "text/html" }));
    a.download = `${String($("sp-titel").textContent || "spiel").replace(/[^\wäöüÄÖÜß -]/g, "").trim() || "spiel"}.html`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
  $("sp-sammlung-knopf").addEventListener("click", () => ($("sp-sammlung").classList.contains("hidden") ? zeigeSammlung() : $("sp-sammlung").classList.add("hidden")));
  $("sp-sammlung-x").addEventListener("click", () => $("sp-sammlung").classList.add("hidden"));
  $("sp-x").addEventListener("click", () => schliessen());
  sheet.addEventListener("click", (e) => { if (e.target === sheet) schliessen(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !offen()) return;
    if ($("sp-spiel").classList.contains("voll")) { vollbild(); return; }
    schliessen();
  });
  trigger.addEventListener("click", () => { oeffnen(); if (!aktuellesHtml && !jobId) zeigeSammlung(); });

  function offen() { return !sheet.classList.contains("hidden"); }
  function oeffnen() { sheet.classList.remove("hidden"); $("menu-pop")?.classList.add("hidden"); }
  function schliessen() {
    sheet.classList.add("hidden");
    $("sp-spiel").classList.remove("voll");
    // Spiel anhalten (Ton, Rechenzeit); der Bau läuft auf dem Server weiter und ist beim nächsten Öffnen fertig.
    $("sp-rahmen").querySelector("iframe")?.remove();
    if (aktuellesHtml) { $("sp-warten").classList.remove("aus", "boot"); $("sp-warten-text").textContent = "Pausiert. Tippe auf ⟲ Neu, um weiterzuspielen."; }
  }

  // Beim Öffnen des Dashboards: läuft gerade ein Bau (z. B. per Telegram gestartet)? Dann nichts aufdrängen.
  window.FridaySpiele = {
    open: () => { oeffnen(); if (!aktuellesHtml && !jobId) zeigeSammlung(); },
    sammlung: zeigeSammlung,
    verfolge,
    spiel: spielOeffnen,
    // Claude hat spiel_bauen benutzt: den neuesten Auftrag zeigen.
    async neuester() { const s = await ladeSammlung(); if (s.aktuell?.id) verfolge(s.aktuell.id); else zeigeSammlung(); },
    close: schliessen,
    offen,
  };
})();
