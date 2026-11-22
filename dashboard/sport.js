// F.R.Ai.D.A.Y Live-Sport (v1.150.0, zuerst nur in Eve):
// Alle Sportarten aus freien Quellen – Live-Spiele, Ligen, ein Spiel im Detail mit Fridays Analyse,
// Spielverlauf, Ereignissen, Statistik, Live-Ticker, legalen Sendern und offiziellen Highlights.
// Friday sagt Tore an, solange das Fenster offen ist (abschaltbar).
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  const F = () => window.Friday || {};
  let katalog = null;
  let ansicht = { art: "live" }; // { art:"live" } | { art:"liga", liga, tag } | { art:"spiel", liga, id }
  let sportWahl = "";
  let detail = null;
  let ladeNr = 0;
  let takt = 0;
  const letzteStaende = new Map();

  const w = H.fenster({
    id: "sport", titel: "🏟️ Live-Sport", klasse: "ls-box",
    html: `
      <div class="ls-kopf">
        <div class="hf-tabs" id="ls-sportarten" role="tablist"></div>
        <label class="ls-ansage"><input type="checkbox" id="ls-ansage"> 🔔 Tore ansagen</label>
      </div>
      <div class="hf-tabs ls-ligen hidden" id="ls-ligen"></div>
      <div id="ls-status" class="hf-status"></div>
      <div id="ls-inhalt" class="ls-inhalt"></div>`,
    onOpen: (o) => oeffne(o || {}),
  });
  const $ = (s) => w.$(s);
  const status = (t, f = false) => { const s = $("#ls-status"); s.textContent = t || ""; s.classList.toggle("fehler", f); };
  const ansageAn = () => { try { return localStorage.getItem("friday_sport_ansage") !== "0"; } catch { return true; } };
  $("#ls-ansage").checked = ansageAn();
  $("#ls-ansage").addEventListener("change", (e) => { try { localStorage.setItem("friday_sport_ansage", e.target.checked ? "1" : "0"); } catch { /* egal */ } });

  async function oeffne(o) {
    if (!katalog) {
      try { katalog = await json("/api/sport"); } catch (err) {
        status(err.status === 423 ? `🔒 ${err.message}` : err.message, true);
        $("#ls-inhalt").innerHTML = "";
        return;
      }
    }
    if (o.liga && o.id) ansicht = { art: "spiel", liga: o.liga, id: o.id };
    else if (o.liga) { ansicht = { art: "liga", liga: o.liga, tag: "" }; sportWahl = katalog.ligen.find((l) => l.id === o.liga)?.sport || ""; }
    else if (!o.behalten) ansicht = { art: "live" };
    kopf();
    laden();
    starteTakt();
  }

  function kopf() {
    const mitLigen = new Set(katalog.ligen.map((l) => l.sport));
    const chips = [{ id: "", name: "🔴 Live jetzt" }, ...katalog.sportarten.filter((s) => mitLigen.has(s.id)).map((s) => ({ id: s.id, name: `${s.symbol} ${s.name}` }))];
    $("#ls-sportarten").innerHTML = chips.map((c) => `<button class="hf-tab${(c.id === sportWahl && ansicht.art !== "spiel") || (!c.id && !sportWahl && ansicht.art === "live") ? " an" : ""}" data-sport="${esc(c.id)}">${esc(c.name)}</button>`).join("");
    const ligen = sportWahl ? katalog.ligen.filter((l) => l.sport === sportWahl) : [];
    $("#ls-ligen").classList.toggle("hidden", !ligen.length || ansicht.art === "spiel");
    $("#ls-ligen").innerHTML = ligen.map((l) => `<button class="hf-tab${ansicht.liga === l.id ? " an" : ""}" data-liga="${esc(l.id)}">${esc(l.name)}${l.nurErgebnis ? " ·  Ergebnisse" : ""}</button>`).join("");
  }

  $("#ls-sportarten").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sport]");
    if (!b) return;
    sportWahl = b.dataset.sport;
    if (!sportWahl) ansicht = { art: "live" };
    else ansicht = { art: "liga", liga: katalog.ligen.find((l) => l.sport === sportWahl)?.id, tag: "" };
    kopf(); laden();
  });
  $("#ls-ligen").addEventListener("click", (e) => {
    const b = e.target.closest("[data-liga]");
    if (!b) return;
    ansicht = { art: "liga", liga: b.dataset.liga, tag: ansicht.tag || "" };
    kopf(); laden();
  });

  // ---------- Laden ----------
  async function laden({ still = false } = {}) {
    const nr = ++ladeNr;
    if (!still) status("Lade Spielstände …");
    try {
      if (ansicht.art === "spiel") {
        const d = await json(`/api/sport/spiel/${encodeURIComponent(ansicht.liga)}/${encodeURIComponent(ansicht.id)}`);
        if (nr !== ladeNr) return;
        const neu = !detail || detail.id !== d.id;
        pruefeTor(d);
        detail = d;
        zeigeSpiel(d, { neu });
        status("");
        if (neu) ladeAnalyse(d);
      } else if (ansicht.art === "liga") {
        const tag = ansicht.tag ? `?tag=${ansicht.tag}` : "";
        const d = await json(`/api/sport/liga/${encodeURIComponent(ansicht.liga)}${tag}`);
        if (nr !== ladeNr) return;
        d.spiele.forEach(pruefeTor);
        zeigeListe(d.spiele, { titel: d.liga, tagWahl: true, wo: d.wo });
        status(d.spiele.length ? "" : "An diesem Tag gibt es hier keine Spiele.");
      } else {
        const d = await json("/api/sport/live");
        if (nr !== ladeNr) return;
        d.spiele.forEach(pruefeTor);
        zeigeListe(d.spiele, { titel: "Gerade live" });
        status(d.spiele.length ? `${d.spiele.length} Spiele laufen gerade · aktualisiert ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : "Gerade läuft in den großen Ligen nichts live. Wähle oben eine Sportart für Ergebnisse und die nächsten Spiele.");
      }
    } catch (err) {
      if (nr !== ladeNr) return;
      status(err.status === 423 ? `🔒 ${err.message}` : `Die Spielstände sind gerade nicht erreichbar (${err.message}).`, true);
    }
  }

  function starteTakt() {
    clearInterval(takt);
    takt = setInterval(() => {
      if (!w.offen()) { clearInterval(takt); return; }
      if (document.hidden) return;
      if (ansicht.art === "spiel" && detail?.zustand !== "live") return;
      laden({ still: true });
    }, 20000);
  }

  // ---------- Tore ansagen ----------
  const ANSAGE = new Set(["fussball", "eishockey", "handball", "rugby", "football"]);
  function pruefeTor(s) {
    if (s.art !== "duell") return;
    const key = `${s.liga}/${s.id}`;
    const stand = `${s.heim.punkte}:${s.gast.punkte}`;
    const alt = letzteStaende.get(key);
    letzteStaende.set(key, stand);
    if (!alt || alt === stand || s.zustand !== "live") return;
    const [ah, ag] = alt.split(":").map(Number), h = Number(s.heim.punkte), g = Number(s.gast.punkte);
    if (!(h > ah || g > ag)) return;
    const fuer = h > ah ? s.heim : s.gast;
    const karte = w.sheet.querySelector(`[data-spiel="${CSS.escape(key)}"], .ls-anzeige[data-key="${CSS.escape(key)}"]`);
    karte?.classList.remove("ls-tor"); void karte?.offsetWidth; karte?.classList.add("ls-tor");
    if (!ansageAn() || !ANSAGE.has(s.sport)) return;
    const wort = s.sport === "fussball" || s.sport === "eishockey" || s.sport === "handball" ? "Tor" : "Punkte";
    F().say?.(`${wort} für ${fuer.kurzname || fuer.name}! Es steht jetzt ${h} zu ${g}.`);
  }

  // ---------- Liste ----------
  const logo = (t, gross = false) => t.logo
    ? `<img class="ls-logo${gross ? " gross" : ""}" src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ls-logo ersatz${gross ? " gross" : ""}',textContent:'${esc((t.kurz || "?").slice(0, 3))}'}))">`
    : `<span class="ls-logo ersatz${gross ? " gross" : ""}">${esc((t.kurz || "?").slice(0, 3))}</span>`;
  const pill = (s) => s.zustand === "live"
    ? `<span class="ls-pill live"><i></i>LIVE${s.statusText ? ` · ${esc(s.statusText)}` : ""}</span>`
    : s.zustand === "ende" ? `<span class="ls-pill ende">${esc(s.statusText || "Ende")}</span>` : `<span class="ls-pill vorher">${esc(s.statusText)}</span>`;

  function karte(s) {
    const key = `${s.liga}/${s.id}`;
    if (s.art === "duell") {
      const ph = s.heim.saetze?.length && s.sport === "tennis" ? s.heim.saetze.join(" ") : s.heim.punkte;
      const pg = s.gast.saetze?.length && s.sport === "tennis" ? s.gast.saetze.join(" ") : s.gast.punkte;
      return `<button class="ls-karte ${s.zustand}" data-spiel="${esc(key)}">
        <span class="ls-k-top"><span class="ls-liga">${esc(s.symbol)} ${esc(s.ligaName)}</span>${pill(s)}</span>
        <span class="ls-k-team${s.heim.sieger ? " sieg" : ""}">${logo(s.heim)}<b>${esc(s.heim.name)}</b><em>${esc(s.zustand === "vorher" ? "" : ph)}</em></span>
        <span class="ls-k-team${s.gast.sieger ? " sieg" : ""}">${logo(s.gast)}<b>${esc(s.gast.name)}</b><em>${esc(s.zustand === "vorher" ? "" : pg)}</em></span>
        ${s.titel && s.sport === "tennis" ? `<small class="ls-k-sub">${esc(s.titel)}</small>` : ""}
      </button>`;
    }
    const top = (s.feld || []).slice(0, 3).map((f, i) => `<span class="ls-k-feld"><i>${f.pos || i + 1}</i>${esc(f.name)}<em>${esc(f.punkte || "")}</em></span>`).join("");
    return `<button class="ls-karte ${s.zustand}" data-spiel="${esc(key)}">
      <span class="ls-k-top"><span class="ls-liga">${esc(s.symbol)} ${esc(s.ligaName)}</span>${pill(s)}</span>
      <b class="ls-k-titel">${esc(s.titel || s.ligaName)}</b>${top}
    </button>`;
  }

  function zeigeListe(spiele, { titel, tagWahl, wo } = {}) {
    detail = null;
    const tag = (n) => { const d = new Date(Date.now() + n * 86400000); return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); };
    const tage = tagWahl ? `<div class="hf-tabs ls-tage">${[["Gestern", -1], ["Heute", 0], ["Morgen", 1]].map(([n, v]) => {
      const wert = v === 0 ? "" : tag(v);
      return `<button class="hf-tab${(ansicht.tag || "") === wert ? " an" : ""}" data-tag="${wert}">${n}</button>`;
    }).join("")}</div>` : "";
    const woHtml = wo?.sender?.length ? `<div class="ls-wo-mini">📺 Live legal: ${wo.sender.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}${s.gratis ? " (kostenlos)" : ""}</a>`).join(" · ")}</div>` : "";
    $("#ls-inhalt").innerHTML = `${tage}${woHtml}<div class="ls-raster">${spiele.map(karte).join("")}</div>`;
  }

  $("#ls-inhalt").addEventListener("click", (e) => {
    const k = e.target.closest("[data-spiel]");
    if (k) { const [liga, ...rest] = k.dataset.spiel.split("/"); ansicht = { art: "spiel", liga, id: rest.join("/"), zurueck: { ...ansicht } }; kopf(); laden(); return; }
    const t = e.target.closest("[data-tag]");
    if (t && ansicht.art === "liga") { ansicht.tag = t.dataset.tag; laden(); return; }
    if (e.target.closest("#ls-zurueck")) { ansicht = ansicht.zurueck || (detail ? { art: "liga", liga: detail.liga, tag: "" } : { art: "live" }); if (ansicht.art === "liga") sportWahl = katalog.ligen.find((l) => l.id === ansicht.liga)?.sport || sportWahl; kopf(); laden(); return; }
    if (e.target.closest("#ls-vorlesen")) { const t2 = $("#ls-analyse-text")?.textContent; if (t2) F().say?.(t2); return; }
    if (e.target.closest("#ls-neu-analyse") && detail) { ladeAnalyse(detail, { laut: true }); return; }
    if (e.target.closest("#ls-hl-laden") && detail) { ladeHighlights(detail); return; }
    const v = e.target.closest("[data-video]");
    if (v) { spieleVideo(v.dataset.video); }
  });

  // ---------- Ein Spiel ----------
  function zeigeSpiel(d, { neu } = {}) {
    const key = `${d.liga}/${d.id}`;
    const alteAnalyse = !neu ? $("#ls-analyse")?.outerHTML : "";
    const alteHl = !neu ? $("#ls-hl")?.outerHTML : "";
    let anzeige;
    if (d.art === "duell") {
      const tennis = d.sport === "tennis" && d.heim.saetze?.length;
      anzeige = `<div class="ls-anzeige ${d.zustand}" data-key="${esc(key)}">
        <div class="ls-a-team">${logo(d.heim, true)}<b>${esc(d.heim.name)}</b></div>
        <div class="ls-a-mitte">
          ${pill(d)}
          <div class="ls-a-stand">${d.zustand === "vorher" ? "– : –" : tennis ? d.heim.saetze.map((x, i) => `<span>${esc(x)}<small>:</small>${esc(d.gast.saetze[i] ?? "–")}</span>`).join("") : `${esc(d.heim.punkte)}<small>:</small>${esc(d.gast.punkte)}`}</div>
          <small class="ls-a-info">${esc([d.ligaName, d.runde, d.ort].filter(Boolean).join(" · "))}</small>
        </div>
        <div class="ls-a-team">${logo(d.gast, true)}<b>${esc(d.gast.name)}</b></div>
      </div>`;
    } else {
      anzeige = `<div class="ls-anzeige feld ${d.zustand}" data-key="${esc(key)}">
        <div class="ls-a-mitte">${pill(d)}<div class="ls-a-titel">${esc(d.titel || d.ligaName)}</div><small class="ls-a-info">${esc([d.ligaName, d.ort].filter(Boolean).join(" · "))}</small></div>
      </div>
      <div class="hf-karte"><h3>🏁 Rangliste</h3><ol class="ls-rang">${(d.feld || []).map((f, i) => `<li><i>${f.pos || i + 1}</i>${logo(f)}<b>${esc(f.name)}</b><em>${esc(f.punkte || "")}</em></li>`).join("")}</ol></div>`;
    }
    const analyseKarte = alteAnalyse || `<div class="hf-karte ls-analyse" id="ls-analyse">
        <h3>🧠 Fridays Analyse <span class="ls-quelle" id="ls-analyse-quelle"></span></h3>
        <p id="ls-analyse-text">${esc(d.regelAnalyse || "")}</p>
        <div class="hf-reihe"><button class="hf-btn leise" id="ls-vorlesen">🔊 Vorlesen</button>${d.zustand !== "vorher" ? '<button class="hf-btn leise" id="ls-neu-analyse">↻ Neu analysieren</button>' : ""}</div>
      </div>`;
    const verlauf = d.verlauf?.length >= 2 ? `<div class="hf-karte"><h3>📈 Spielverlauf</h3>${verlaufSvg(d)}</div>` : "";
    const ereig = (d.ereignisse || []).length ? `<div class="hf-karte"><h3>⏱ Ereignisse</h3><ol class="ls-zeitleiste">${[...d.ereignisse].reverse().map((e) => `
        <li class="${esc(e.seite || "mitte")} ${esc(e.typ)}"><span class="ls-z-min">${esc(e.minute || "")}</span><span class="ls-z-ico">${ICON[e.typ] || "•"}</span>
        <span class="ls-z-text"><b>${esc(e.art)}${e.stand ? ` · ${esc(e.stand)}` : ""}</b>${e.spieler ? ` ${esc(e.spieler)}` : ""}${e.text && !e.spieler ? `<small>${esc(e.text)}</small>` : ""}</span></li>`).join("")}</ol></div>` : "";
    const stat = (d.statistik || []).length ? `<div class="hf-karte"><h3>📊 Statistik</h3><div class="ls-stats">${d.statistik.map(statZeile).join("")}</div></div>` : "";
    const ticker = (d.kommentar || []).length ? `<div class="hf-karte"><h3>📰 Live-Ticker</h3><ul class="ls-ticker">${d.kommentar.map((k) => `<li><span>${esc(k.zeit)}</span>${esc(k.text)}</li>`).join("")}</ul></div>` : "";
    const nurErg = d.nurErgebnis ? '<p class="hf-hinweis">Für diese Sportart gibt es frei nur Ergebnisse und Termine, keinen Live-Ticker.</p>' : "";
    const wo = `<div class="hf-karte ls-wo"><h3>📺 Live sehen – legal</h3>
        ${d.wo?.sender?.length ? `<div class="ls-sender">${d.wo.sender.map((s) => `<a class="hf-btn${s.gratis ? " haupt" : ""}" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}${s.gratis ? " · kostenlos" : ""}</a>`).join("")}</div>` : '<p class="hf-hinweis">Für diesen Wettbewerb kenne ich keinen deutschen Sender. Schau in der offiziellen App des Veranstalters.</p>'}
        ${d.wo?.hinweis ? `<p class="hf-hinweis">${esc(d.wo.hinweis)}</p>` : ""}
        ${d.tvUsa?.length ? `<p class="hf-hinweis">In den USA: ${esc(d.tvUsa.join(", "))}</p>` : ""}
        <p class="hf-hinweis">Das Live-Bild selbst darf nur der Rechteinhaber zeigen, darum öffne ich dir dessen App oder Seite. ${esc(d.wo?.stand || "")}</p>
      </div>`;
    const hl = alteHl || `<div class="hf-karte" id="ls-hl"><h3>🎬 Highlights</h3><div id="ls-hl-liste"><button class="hf-btn" id="ls-hl-laden">Offizielle Highlights suchen</button></div><div id="ls-player"></div></div>`;
    $("#ls-inhalt").innerHTML = `<button class="hf-mini" id="ls-zurueck">‹ Alle Spiele</button>${anzeige}${nurErg}
      <div class="ls-spalten"><div class="ls-sp">${analyseKarte}${verlauf}${stat}</div><div class="ls-sp">${ereig}${ticker}</div></div>${wo}${hl}
      <p class="hf-hinweis ls-quelle-fuss">Daten: ${esc(d.quelle || "")} · aktualisiert sich alle 20 Sekunden, solange das Spiel läuft.</p>`;
  }
  const ICON = { tor: "⚽", gelb: "🟨", rot: "🟥", wechsel: "🔁", var: "📺", chance: "❌", info: "•" };

  function statZeile(s) {
    const a = parseFloat(String(s.heim).replace(",", ".")), b = parseFloat(String(s.gast).replace(",", "."));
    const sum = (Number.isFinite(a) ? a : 0) + (Number.isFinite(b) ? b : 0);
    const pa = sum > 0 ? Math.round((a / sum) * 100) : 50;
    return `<div class="ls-stat"><span class="w h">${esc(s.heim)}</span><span class="l">${esc(s.label)}</span><span class="w g">${esc(s.gast)}</span>
      <div class="ls-stat-bar"><i class="h" style="width:${pa}%"></i><i class="g" style="width:${100 - pa}%"></i></div></div>`;
  }

  function verlaufSvg(d) {
    const p = d.verlauf;
    const W = 520, Hh = 150, pad = 26;
    const maxX = Math.max(...p.map((x) => x.x), d.sport === "fussball" ? (d.zustand === "ende" ? 90 : Math.max(parseInt(d.uhr, 10) || 0, 45)) : 1, 1);
    const maxY = Math.max(...p.map((x) => Math.max(x.heim, x.gast)), 1);
    const X = (v) => pad + (v / maxX) * (W - pad * 2);
    const Y = (v) => Hh - pad - (v / maxY) * (Hh - pad * 2);
    const treppe = (k) => p.map((q, i) => (i === 0 ? `M${X(q.x)},${Y(q[k])}` : `H${X(q.x)}V${Y(q[k])}`)).join("") + `H${W - pad}`;
    const punkte = (k, cls) => p.slice(1).filter((q, i) => q[k] !== p[i][k]).map((q) => `<circle class="${cls}" cx="${X(q.x)}" cy="${Y(q[k])}" r="3.5"><title>${esc(q.label || "")} ${q.heim}:${q.gast}</title></circle>`).join("");
    return `<svg class="ls-verlauf" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Spielverlauf">
      <line x1="${pad}" y1="${Hh - pad}" x2="${W - pad}" y2="${Hh - pad}" class="achse"/>
      <path d="${treppe("heim")}" class="lh"/><path d="${treppe("gast")}" class="lg"/>${punkte("heim", "ph")}${punkte("gast", "pg")}
      <text x="${pad}" y="14" class="th">● ${esc(d.heim.kurzname || d.heim.name)}</text><text x="${W - pad}" y="14" text-anchor="end" class="tg">● ${esc(d.gast.kurzname || d.gast.name)}</text>
    </svg>`;
  }

  async function ladeAnalyse(d, { laut = false } = {}) {
    if (d.zustand === "vorher") { $("#ls-analyse-quelle").textContent = "Vorschau"; return; }
    const q = $("#ls-analyse-quelle");
    if (q) q.textContent = "Friday denkt …";
    try {
      const a = await json(`/api/sport/spiel/${encodeURIComponent(d.liga)}/${encodeURIComponent(d.id)}/analyse`);
      if (!detail || detail.id !== d.id) return;
      $("#ls-analyse-text").textContent = a.text;
      $("#ls-analyse-quelle").textContent = a.quelle === "claude" ? "· KI-Analyse" : `· eigene Auswertung${a.hinweis ? ` (${a.hinweis})` : ""}`;
      if (laut) F().say?.(a.text);
    } catch { if (q) q.textContent = "· eigene Auswertung"; }
  }

  async function ladeHighlights(d) {
    const box = $("#ls-hl-liste");
    box.innerHTML = '<span class="hf-status">Suche Highlights …</span>';
    try {
      const r = await json(`/api/sport/highlights?q=${encodeURIComponent(d.suche)}`);
      const eigene = (d.videosQuelle || []).map((v) => `<a class="ls-video" href="${esc(v.url)}" target="_blank" rel="noopener"><img src="${esc(v.bild)}" alt="" loading="lazy"><span>${esc(v.titel)}</span></a>`).join("");
      const yt = (r.videos || []).map((v) => `<button class="ls-video" data-video="${esc(v.id)}"><img src="${esc(v.bild)}" alt="" loading="lazy"><span>${esc(v.titel)}${v.kanal ? `<small>${esc(v.kanal)}</small>` : ""}</span></button>`).join("");
      box.innerHTML = (eigene || yt) ? `<div class="ls-videos">${eigene}${yt}</div><p class="hf-hinweis">${esc(r.hinweis || "")}</p>` : '<p class="hf-hinweis">Noch keine Highlights gefunden. Meist gibt es sie kurz nach dem Spiel.</p>';
    } catch (err) { box.innerHTML = `<p class="hf-status fehler">${esc(err.message)}</p>`; }
  }
  function spieleVideo(id) {
    if (!/^[\w-]{11}$/.test(id)) return;
    $("#ls-player").innerHTML = `<div class="ls-player"><iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1" title="Highlights" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
    $("#ls-player").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const style = document.createElement("style");
  style.textContent = `
.ls-box { width: min(1120px, 100%); }
.ls-kopf { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
.ls-ansage { font-size: 12.5px; color: var(--muted); display: flex; gap: 6px; align-items: center; cursor: pointer; white-space: nowrap; }
.ls-ligen .hf-tab { font-size: 12px; padding: 5px 11px; }
.ls-inhalt { display: flex; flex-direction: column; gap: 14px; }
#ls-zurueck { align-self: flex-start; }
.ls-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.ls-karte { text-align: left; font: inherit; color: var(--text); cursor: pointer; display: flex; flex-direction: column; gap: 7px; padding: 12px 13px; border-radius: 14px; border: 1px solid var(--u-rand-soft, var(--line)); background: var(--u-karte, rgba(0,0,0,.3)); transition: transform .15s, box-shadow .15s, border-color .15s; }
.ls-karte:hover { transform: translateY(-2px); border-color: var(--cyan); box-shadow: var(--u-glow); }
.ls-karte.live { border-color: color-mix(in srgb, #ff3b3b 55%, transparent); box-shadow: 0 0 18px rgba(255,59,59,.16); }
.ls-k-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; font-size: 11.5px; color: var(--muted); }
.ls-liga { min-width: 40px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ls-k-team { display: flex; align-items: center; gap: 9px; font-size: 14px; }
.ls-k-team b { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ls-k-team em { font-style: normal; font-weight: 800; font-size: 19px; color: var(--u-titel, var(--text)); font-variant-numeric: tabular-nums; }
.ls-k-team.sieg b, .ls-k-team.sieg em { color: var(--cyan); text-shadow: 0 0 10px color-mix(in srgb, var(--cyan) 50%, transparent); }
.ls-k-sub, .ls-k-titel { font-size: 12px; color: var(--muted); }
.ls-k-titel { font-size: 14px; color: var(--text); }
.ls-k-feld { display: flex; gap: 8px; font-size: 13px; } .ls-k-feld i { font-style: normal; color: var(--cyan); width: 16px; } .ls-k-feld em { margin-left: auto; font-style: normal; color: var(--muted); }
.ls-logo { width: 26px; height: 26px; object-fit: contain; flex: none; filter: drop-shadow(0 0 4px rgba(0,0,0,.6)); }
.ls-logo.gross { width: 74px; height: 74px; }
.ls-logo.ersatz { display: inline-grid; place-items: center; border-radius: 50%; border: 1px solid var(--u-rand-soft, var(--line)); font-size: 9.5px; font-weight: 800; color: var(--muted); background: rgba(0,0,0,.3); }
.ls-logo.ersatz.gross { font-size: 20px; }
.ls-pill { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 3px 9px; font-size: 11px; font-weight: 700; letter-spacing: .04em; white-space: nowrap; border: 1px solid currentColor; }
.ls-pill.live { color: #ff5a4a; background: rgba(255,59,59,.1); }
.ls-pill.live i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; animation: ls-puls 1.2s infinite; }
.ls-pill.ende { color: var(--muted); } .ls-pill.vorher { color: var(--gold, #ffb066); }
@keyframes ls-puls { 50% { opacity: .25; } }
.ls-tage { margin-bottom: -4px; }
.ls-wo-mini { font-size: 12.5px; color: var(--muted); } .ls-wo-mini a { color: var(--u-titel, var(--cyan)); }
.ls-anzeige { position: relative; display: grid; grid-template-columns: 1fr auto 1fr; gap: 14px; align-items: center; padding: 22px 18px; border-radius: 20px; border: 1px solid var(--u-rand, var(--cyan)); background: radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--cyan) 20%, transparent), transparent 70%), var(--u-glas, rgba(0,0,0,.5)); box-shadow: var(--u-glow), var(--u-schein, none); overflow: hidden; }
.ls-anzeige::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px 4px); pointer-events: none; }
.ls-anzeige.feld { grid-template-columns: 1fr; text-align: center; }
.ls-a-team { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; font-size: 16px; min-width: 0; }
.ls-a-team b { font-weight: 700; }
.ls-a-mitte { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.ls-a-stand { font-size: clamp(42px, 8vw, 72px); font-weight: 800; line-height: 1; color: var(--u-titel, #fff); text-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 70%, transparent), 0 0 42px color-mix(in srgb, var(--cyan) 35%, transparent); font-variant-numeric: tabular-nums; display: flex; gap: 14px; }
.ls-a-stand small { opacity: .55; margin: 0 4px; }
.ls-a-stand span { font-size: .6em; }
.ls-a-titel { font-size: 22px; font-weight: 700; }
.ls-a-info { color: var(--muted); font-size: 12px; text-align: center; }
.ls-tor { animation: ls-tor 1.6s ease-out 2; }
@keyframes ls-tor { 0% { box-shadow: 0 0 0 0 rgba(255,138,30,.9); } 40% { box-shadow: 0 0 60px 12px rgba(255,138,30,.65); } 100% { box-shadow: var(--u-glow); } }
.ls-spalten { display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px; align-items: start; }
.ls-sp { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.ls-analyse p { margin: 0 0 10px; line-height: 1.55; font-size: 14.5px; }
.ls-quelle { font-size: 10.5px; color: var(--muted); letter-spacing: .04em; text-transform: none; font-weight: 400; }
.ls-verlauf { width: 100%; height: auto; }
.ls-verlauf .achse { stroke: var(--u-rand-soft, var(--line)); }
.ls-verlauf path { fill: none; stroke-width: 2.6; }
.ls-verlauf .lh { stroke: var(--cyan); filter: drop-shadow(0 0 4px var(--cyan)); } .ls-verlauf .lg { stroke: #6fd6ff; filter: drop-shadow(0 0 4px #6fd6ff); }
.ls-verlauf .ph { fill: var(--cyan); } .ls-verlauf .pg { fill: #6fd6ff; }
.ls-verlauf text { font-size: 11px; } .ls-verlauf .th { fill: var(--cyan); } .ls-verlauf .tg { fill: #6fd6ff; }
.ls-zeitleiste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 360px; overflow-y: auto; }
.ls-zeitleiste li { display: grid; grid-template-columns: 52px 24px 1fr; gap: 8px; align-items: start; font-size: 13px; padding: 6px 8px; border-radius: 10px; background: rgba(0,0,0,.22); border-left: 3px solid transparent; }
.ls-zeitleiste li.heim { border-left-color: var(--cyan); } .ls-zeitleiste li.gast { border-left-color: #6fd6ff; }
.ls-zeitleiste li.tor { background: color-mix(in srgb, var(--cyan) 12%, rgba(0,0,0,.25)); }
.ls-z-min { color: var(--muted); font-variant-numeric: tabular-nums; } .ls-z-text small { display: block; color: var(--muted); margin-top: 2px; }
.ls-stats { display: flex; flex-direction: column; gap: 9px; }
.ls-stat { display: grid; grid-template-columns: 56px 1fr 56px; gap: 4px 8px; align-items: center; font-size: 13px; }
.ls-stat .l { text-align: center; color: var(--muted); font-size: 12px; } .ls-stat .w { font-weight: 700; font-variant-numeric: tabular-nums; } .ls-stat .g { text-align: right; }
.ls-stat-bar { grid-column: 1 / -1; display: flex; gap: 3px; height: 6px; }
.ls-stat-bar i { display: block; border-radius: 99px; } .ls-stat-bar .h { background: var(--cyan); box-shadow: 0 0 8px var(--cyan); } .ls-stat-bar .g { background: #6fd6ff; box-shadow: 0 0 8px #6fd6ff; }
.ls-ticker { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; max-height: 320px; overflow-y: auto; font-size: 13px; line-height: 1.45; }
.ls-ticker span { display: inline-block; min-width: 44px; color: var(--cyan); font-weight: 700; margin-right: 6px; }
.ls-rang { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.ls-rang li { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 10px; background: rgba(0,0,0,.22); font-size: 14px; }
.ls-rang i { font-style: normal; width: 22px; color: var(--cyan); font-weight: 800; } .ls-rang b { flex: 1; font-weight: 600; } .ls-rang em { font-style: normal; color: var(--muted); font-variant-numeric: tabular-nums; }
.ls-sender { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; } .ls-sender a { text-decoration: none; }
.ls-videos { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
.ls-video { font: inherit; color: var(--text); text-align: left; text-decoration: none; cursor: pointer; border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 12px; overflow: hidden; background: rgba(0,0,0,.3); padding: 0; display: flex; flex-direction: column; }
.ls-video img { width: 100%; aspect-ratio: 16/9; object-fit: cover; } .ls-video span { padding: 7px 9px; font-size: 12px; line-height: 1.35; } .ls-video small { display: block; color: var(--muted); }
.ls-player { margin-top: 10px; aspect-ratio: 16/9; border-radius: 14px; overflow: hidden; border: 1px solid var(--u-rand, var(--cyan)); } .ls-player iframe { width: 100%; height: 100%; border: 0; }
.ls-quelle-fuss { text-align: center; }
@media (max-width: 760px) {
  .ls-spalten { grid-template-columns: 1fr; }
  .ls-anzeige { padding: 16px 10px; gap: 8px; }
  .ls-logo.gross { width: 48px; height: 48px; }
  .ls-a-team { font-size: 12.5px; overflow-wrap: anywhere; }
  .ls-a-info { max-width: 130px; }
  .ls-anzeige { grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); }
  .ls-raster { grid-template-columns: 1fr; }
  .ls-kopf .hf-tabs { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  .ls-ligen { flex-wrap: nowrap !important; overflow-x: auto; scrollbar-width: none; }
  .ls-ligen .hf-tab, .ls-kopf .hf-tab { flex: none; }
}`;
  document.head.appendChild(style);

  window.FridaySport = {
    open: (o = {}) => w.auf(o),
    offen: () => w.offen(),
  };
})();
