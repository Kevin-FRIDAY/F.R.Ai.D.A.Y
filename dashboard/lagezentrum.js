// F.R.Ai.D.A.Y Lagezentrum: weltweite Karte aus öffentlichen Quellen (Nachrichten + Erdbeben).
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { api, say, escapeHtml } = window.Friday;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const W = 960, H = 500;

  let countries = [];
  let quakes = [];
  let selected = null;
  let mapReady = null;
  let project = null;
  let pollTimer = null;
  let maxCount = 1;
  let viewAnim = null;

  const ALIASES = {
    "england": "826", "uk": "826", "großbritannien": "826", "vereinigtes königreich": "826",
    "amerika": "840", "usa": "840", "vereinigte staaten": "840", "us": "840", "staaten": "840",
    "korea": "410", "südkorea": "410", "nordkorea": "408", "holland": "528",
    "türkei": "792", "türkiye": "792", "russland": "643", "tschechien": "203",
  };

  function findLocal(key) {
    const k = String(key || "").trim().toLowerCase().replace(/[.!?,]+$/, "");
    if (!k) return null;
    let c = countries.find((x) => x.name.toLowerCase() === k);
    if (!c && ALIASES[k]) c = countries.find((x) => x.id === ALIASES[k]);
    if (!c) c = countries.find((x) => k.length >= 3 && x.name.toLowerCase().startsWith(k));
    if (!c) c = countries.find((x) => k.length >= 4 && x.name.toLowerCase().includes(k));
    return c;
  }

  $("lage-btn").addEventListener("click", open);
  $("lage-close").addEventListener("click", close);
  $("lage-refresh").addEventListener("click", () => load(true));
  $("lage-world").addEventListener("click", () => { selected = null; render(); flyToWorld(); $("lage-world").classList.add("hidden"); $("lage-land").textContent = "Land wählen"; $("lage-detail").innerHTML = 'Tippe auf der Karte oder in der Liste auf ein Land.'; });
  $("lage-q").addEventListener("change", () => { const c = findLocal($("lage-q").value); if (c) { $("lage-q").value = c.name; select(c.id); } });
  $("lage-mic").addEventListener("click", listenCountry);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("lage").classList.contains("hidden")) close(); });

  // Land per Stimme sagen (nutzt die Spracherkennung des Browsers).
  function listenCountry() {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { $("lage-q").focus(); return; }
    const rec = new R();
    rec.lang = "de-DE"; rec.interimResults = false; rec.maxAlternatives = 3;
    $("lage-mic").classList.add("listening");
    rec.onresult = (e) => {
      const alts = [...e.results[0]].map((a) => a.transcript);
      let hit = null;
      for (const a of alts) { hit = findLocal(a) || findLocal(a.replace(/^(zeig(e)? mir|geh(e)? (nach|in)|was ist (in|los in))\s+/i, "")); if (hit) break; }
      if (hit) { $("lage-q").value = hit.name; select(hit.id); }
      else $("lage-q").value = alts[0] || "";
    };
    rec.onend = () => $("lage-mic").classList.remove("listening");
    rec.onerror = () => $("lage-mic").classList.remove("listening");
    try { rec.start(); } catch { /* läuft schon */ }
  }

  function open() {
    $("lage").classList.remove("hidden");
    document.body.classList.add("lage-open");
    mapReady ??= drawMap();
    load(false);
    loadQuakes();
  }

  function close() {
    $("lage").classList.add("hidden");
    document.body.classList.remove("lage-open");
    clearTimeout(pollTimer);
    pollTimer = null;
    cancelAnimationFrame(viewAnim);
    $("lage-map")?.setAttribute("viewBox", `0 0 ${W} ${H}`);
    $("lage-world")?.classList.add("hidden");
  }

  // ---------- Weltkarte ----------
  async function drawMap() {
    const svg = $("lage-map");
    try {
      const [geo, topo, world] = await Promise.all([
        import("https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/+esm"),
        import("https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm"),
        fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json").then((r) => r.json()),
      ]);
      const land = topo.feature(world, world.objects.countries);
      const projection = geo.geoNaturalEarth1().fitExtent([[8, 8], [W - 8, H - 8]], { type: "Sphere" });
      const path = geo.geoPath(projection);
      project = (lon, lat) => projection([lon, lat]);

      const defs = el("defs");
      defs.innerHTML = `
        <radialGradient id="lage-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#4fd8ff" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#4fd8ff" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="lage-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#4fd8ff" stop-opacity="0"/>
          <stop offset="85%" stop-color="#4fd8ff" stop-opacity="0"/>
          <stop offset="100%" stop-color="#4fd8ff" stop-opacity="0.35"/>
        </linearGradient>`;
      const sphere = el("path", { d: path({ type: "Sphere" }), class: "lage-sphere" });
      const grat = el("path", { d: path(geo.geoGraticule10()), class: "lage-grat" });
      const g = el("g", { class: "lage-countries" });
      for (const f of land.features) {
        const id = String(f.id).padStart(3, "0");
        g.append(el("path", { d: path(f), class: "land", "data-id": id }));
      }
      const sweep = el("rect", { class: "lage-sweep", x: 0, y: 0, width: 120, height: H, fill: "url(#lage-sweep)" });
      svg.replaceChildren(defs, sphere, grat, g, el("g", { id: "lage-quakes" }), el("g", { id: "lage-markers" }), sweep);
      g.addEventListener("click", (e) => {
        const id = e.target.getAttribute?.("data-id");
        if (id && countries.some((c) => c.id === id)) select(id);
      });
    } catch (err) {
      console.warn("Weltkarte nicht geladen:", err);
      project = (lon, lat) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
      const g = el("g", { class: "lage-grat-fallback" });
      for (let x = 0; x <= W; x += 40) g.append(el("line", { x1: x, y1: 0, x2: x, y2: H }));
      for (let y = 0; y <= H; y += 40) g.append(el("line", { x1: 0, y1: y, x2: W, y2: y }));
      svg.replaceChildren(g, el("g", { id: "lage-quakes" }), el("g", { id: "lage-markers" }));
    }
  }

  function el(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  // ---------- Hin- und Herfliegen auf der Karte ----------
  function currentViewBox() {
    const vb = $("lage-map").getAttribute("viewBox").split(/\s+/).map(Number);
    return { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
  }

  function animateViewBox(to, ms = 900) {
    const svg = $("lage-map");
    const from = currentViewBox();
    const start = performance.now();
    cancelAnimationFrame(viewAnim);
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const step = (now) => {
      const p = Math.min(1, (now - start) / ms);
      const e = ease(p);
      const x = from.x + (to.x - from.x) * e;
      const y = from.y + (to.y - from.y) * e;
      const w = from.w + (to.w - from.w) * e;
      const h = from.h + (to.h - from.h) * e;
      svg.setAttribute("viewBox", `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
      if (p < 1) viewAnim = requestAnimationFrame(step);
    };
    viewAnim = requestAnimationFrame(step);
  }

  function flyToCountry(id) {
    const path = document.querySelector(`#lage-map .land[data-id="${id}"]`);
    let box;
    if (path?.getBBox) {
      try { const b = path.getBBox(); if (b.width > 1 && b.height > 1) box = b; } catch { /* ignore */ }
    }
    if (!box) {
      const c = countries.find((x) => x.id === id);
      const pos = c && project?.(c.lon, c.lat);
      if (!pos) return;
      box = { x: pos[0] - 60, y: pos[1] - 40, width: 120, height: 80 };
    }
    // Rahmen mit etwas Luft, Seitenverhältnis an die Karte angleichen.
    const pad = Math.max(box.width, box.height) * 0.4 + 12;
    let x = box.x - pad, y = box.y - pad, w = box.width + pad * 2, h = box.height + pad * 2;
    const ratio = W / H;
    if (w / h > ratio) h = w / ratio; else w = h * ratio;
    x = box.x + box.width / 2 - w / 2;
    y = box.y + box.height / 2 - h / 2;
    animateViewBox({ x, y, w, h });
    $("lage-world").classList.remove("hidden");
  }

  function flyToWorld() { animateViewBox({ x: 0, y: 0, w: W, h: H }); }

  // ---------- Daten laden ----------
  async function load(force) {
    $("lage").classList.add("scanning");
    try {
      const res = await api("/api/lage" + (force ? "?t=" + Date.now() : ""));
      if (!res.ok) throw new Error((await res.json()).error || "Fehler");
      const data = await res.json();
      countries = data.laender;
      maxCount = Math.max(1, ...countries.map((c) => c.meldungen));
      await mapReady;
      render();
      fillDatalist();
      updateStand(data);
      // Solange der Scanner die Welt durchläuft, alle paar Sekunden nachladen.
      clearTimeout(pollTimer);
      if (data.scannt || data.geladen < data.gesamt) {
        pollTimer = setTimeout(() => load(false), 3000);
      } else {
        $("lage").classList.remove("scanning");
      }
    } catch (err) {
      $("lage-stand").textContent = `Lage nicht verfügbar: ${err.message}`;
      $("lage").classList.remove("scanning");
    }
  }

  function updateStand(data) {
    if (data.scannt || data.geladen < data.gesamt) {
      $("lage-stand").textContent = `Scanne Welt... ${data.geladen}/${data.gesamt} Länder`;
    } else {
      const time = data.stand ? new Date(data.stand).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "jetzt";
      $("lage-stand").textContent = `${data.gesamt} Länder überwacht · Stand ${time}`;
    }
  }

  async function loadQuakes() {
    try {
      quakes = await (await api("/api/lage-beben")).json();
      await mapReady;
      renderQuakes();
    } catch { /* Erdbeben optional */ }
  }

  let datalistDone = false;
  function fillDatalist() {
    if (datalistDone) return;
    const dl = $("lage-countries");
    if (!dl) return;
    dl.replaceChildren(...[...countries].sort((a, b) => a.name.localeCompare(b.name, "de")).map((c) => {
      const o = document.createElement("option"); o.value = c.name; return o;
    }));
    datalistDone = true;
  }

  const ratingClass = (c) => c.bewertung || (c.meldungen ? "aktiv" : "offen");

  function heat(c) {
    // 0..1 Aktivität, für die Einfärbung der Länder ohne Einschätzung.
    return c.meldungen ? Math.min(1, 0.2 + Math.log1p(c.meldungen) / Math.log1p(maxCount) * 0.8) : 0;
  }

  function render() {
    // Länderflächen einfärben: nach Einschätzung, sonst nach Aktivität (Hitze).
    document.querySelectorAll("#lage-map .land").forEach((p) => {
      const c = countries.find((x) => x.id === p.getAttribute("data-id"));
      if (!c) { p.setAttribute("class", "land"); p.style.fillOpacity = ""; return; }
      const cls = `land watched ${c.bewertung || "aktiv"}${selected === c.id ? " selected" : ""}`;
      p.setAttribute("class", cls);
      if (!c.bewertung) p.style.fillOpacity = heat(c).toFixed(2);
      else p.style.fillOpacity = "";
    });

    // Marker nur für die aktivsten Länder, damit die Karte nicht zukleistert.
    const markers = $("lage-markers");
    markers.replaceChildren();
    const hot = [...countries].filter((c) => c.meldungen > 0).sort((a, b) => b.meldungen - a.meldungen).slice(0, 25);
    for (const c of hot) {
      const pos = project?.(c.lon, c.lat);
      if (!pos) continue;
      const r = 3 + (c.meldungen / maxCount) * 8;
      const g = el("g", { class: `marker ${ratingClass(c)}${selected === c.id ? " selected" : ""}`, transform: `translate(${pos[0].toFixed(1)},${pos[1].toFixed(1)})`, tabindex: "0", role: "button", "aria-label": `${c.name}, ${countLabel(c)} Meldungen` });
      g.append(el("circle", { r: (r * 2.2).toFixed(1), class: "pulse" }), el("circle", { r: r.toFixed(1), class: "core" }));
      const title = el("title");
      title.textContent = `${c.name}: ${countLabel(c)} Meldungen`;
      g.append(title);
      g.addEventListener("click", () => select(c.id));
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(c.id); } });
      markers.append(g);
    }

    renderList();
    renderTicker(hot);
  }

  const countLabel = (c) => (c.meldungen >= 100 ? "100+" : String(c.meldungen));

  function renderList() {
    const list = $("lage-list");
    list.replaceChildren();
    for (const c of [...countries].sort((a, b) => b.meldungen - a.meldungen || a.name.localeCompare(b.name, "de")).slice(0, 60)) {
      const li = document.createElement("li");
      li.innerHTML = `<button class="lage-row ${selected === c.id ? "active" : ""}"><i class="dot ${ratingClass(c)}"></i><span>${escapeHtml(c.name)}</span><b>${countLabel(c)}</b></button>`;
      li.firstElementChild.addEventListener("click", () => select(c.id));
      list.append(li);
    }
  }

  function renderTicker(hot) {
    const t = $("lage-ticker");
    if (!t) return;
    const lines = hot.filter((c) => c.top).slice(0, 12).map((c) => `<span class="tick"><b>${escapeHtml(c.name)}</b> ${escapeHtml(c.top)}</span>`);
    t.innerHTML = lines.length ? `<div class="tick-track">${lines.join('<span class="tick-sep">◆</span>')}${lines.join('<span class="tick-sep">◆</span>')}</div>` : "";
  }

  function renderQuakes() {
    const g = $("lage-quakes");
    if (!g) return;
    g.replaceChildren();
    if (!$("lage-quakes-on")?.checked) return;
    for (const q of quakes) {
      const pos = project?.(q.lon, q.lat);
      if (!pos) continue;
      const r = Math.max(2, (q.staerke || 0) * 1.3);
      const node = el("circle", { cx: pos[0].toFixed(1), cy: pos[1].toFixed(1), r: r.toFixed(1), class: "quake" });
      const title = el("title");
      title.textContent = `Erdbeben M${q.staerke} · ${q.ort}`;
      node.append(title);
      g.append(node);
    }
  }

  // ---------- Ein Land ----------
  async function select(id) {
    selected = id;
    render();
    const c = countries.find((x) => x.id === id);
    $("lage-land").textContent = c ? c.name : "Land";
    await mapReady;
    flyToCountry(id);
    const box = $("lage-detail");
    box.className = "";
    box.innerHTML = `<p class="muted">Lade Meldungen...</p>`;
    try {
      const data = await (await api(`/api/lage/${id}`)).json();
      if (data.error) throw new Error(data.error);
      if (selected !== id) return;
      const items = data.meldungen.slice(0, 12).map((n) => {
        const t = new Date(n.date).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        const title = n.link ? `<a href="${escapeHtml(n.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.title)}</a>` : escapeHtml(n.title);
        return `<li>${title}<small>${escapeHtml(n.source)} · ${t}</small></li>`;
      }).join("") || `<li class="muted">Keine Meldungen in den letzten 24 Stunden.</li>`;
      box.innerHTML = `
        <div id="lage-assess" class="lage-assess">
          <button id="lage-assess-btn" class="chip">Friday, schätz die Lage ein</button>
        </div>
        <div id="lage-media" class="lage-media"><p class="muted small-text">Lade Bilder...</p></div>
        <ul class="lage-news">${items}</ul>`;
      $("lage-assess-btn").addEventListener("click", () => assess(id));
      loadMedia(id);
    } catch (err) {
      box.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    }
  }

  // Bilder und öffentliche Kameras/Videos zum Land (alles frei zugänglich).
  async function loadMedia(id) {
    const wrap = $("lage-media");
    if (!wrap) return;
    try {
      const m = await (await api(`/api/lage/${id}/medien`)).json();
      if (selected !== id || !wrap.isConnected) return;
      const fotos = (m.fotos || []).map((f) =>
        `<a href="${escapeHtml(f.seite || f.bild)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(f.titel)}${f.autor ? " · " + escapeHtml(f.autor) : ""}">
           <img loading="lazy" src="${escapeHtml(f.bild)}" alt="${escapeHtml(f.titel)}"></a>`).join("");
      wrap.innerHTML = `
        <div class="lage-cams">
          <a class="chip" href="${escapeHtml(m.kameras)}" target="_blank" rel="noopener noreferrer">📹 Öffentliche Live-Kameras</a>
          <a class="chip" href="${escapeHtml(m.videos)}" target="_blank" rel="noopener noreferrer">▶ Live-Cams (YouTube)</a>
          <a class="chip" href="${escapeHtml(m.nachrichten_videos)}" target="_blank" rel="noopener noreferrer">📺 Nachrichten-Videos</a>
        </div>
        ${fotos ? `<div class="lage-fotos">${fotos}</div><p class="lage-credit">Bilder aus öffentlichen Quellen (Openverse)</p>` : ""}`;
    } catch {
      wrap.innerHTML = "";
    }
  }

  async function assess(id) {
    const box = $("lage-assess");
    box.innerHTML = `<p class="muted">Friday analysiert die Meldungen...</p>`;
    try {
      const res = await api(`/api/lage/${id}/einschaetzung`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      if (selected !== id) return;
      const label = { gut: "GUT", schlecht: "SCHLECHT", gemischt: "GEMISCHT" }[data.bewertung];
      box.innerHTML = `<span class="rating ${data.bewertung}">${label}</span><p>${escapeHtml(data.zusammenfassung)}</p>`;
      const c = countries.find((x) => x.id === id);
      if (c) { c.bewertung = data.bewertung; render(); }
      say(data.zusammenfassung);
    } catch (err) {
      box.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    }
  }

  // Erdbeben-Schalter
  document.addEventListener("change", (e) => {
    if (e.target?.id === "lage-quakes-on") renderQuakes();
  });
})();
