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

  $("lage-btn").addEventListener("click", open);
  $("lage-close").addEventListener("click", close);
  $("lage-refresh").addEventListener("click", () => load(true));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("lage").classList.contains("hidden")) close(); });

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
        <ul class="lage-news">${items}</ul>`;
      $("lage-assess-btn").addEventListener("click", () => assess(id));
    } catch (err) {
      box.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
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
