// F.R.Ai.D.A.Y Lagezentrum: Weltkarte mit Nachrichten pro Land und Fridays Einschätzung.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { api, say, escapeHtml } = window.Friday;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const W = 960, H = 500;

  let countries = [];
  let selected = null;
  let mapReady = null;
  let project = null;

  // ---------- Öffnen / Schließen ----------
  $("lage-btn").addEventListener("click", open);
  $("lage-close").addEventListener("click", close);
  $("lage-refresh").addEventListener("click", load);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("lage").classList.contains("hidden")) close(); });

  function open() {
    $("lage").classList.remove("hidden");
    document.body.classList.add("lage-open");
    mapReady ??= drawMap();
    load();
  }

  function close() {
    $("lage").classList.add("hidden");
    document.body.classList.remove("lage-open");
  }

  // ---------- Weltkarte (Ländergrenzen von jsDelivr, sonst nur Raster) ----------
  async function drawMap() {
    const svg = $("lage-map");
    let d3;
    try {
      const [geo, topo, world] = await Promise.all([
        import("https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/+esm"),
        import("https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm"),
        fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json").then((r) => r.json()),
      ]);
      d3 = geo;
      const land = topo.feature(world, world.objects.countries);
      const projection = geo.geoNaturalEarth1().fitExtent([[10, 10], [W - 10, H - 10]], { type: "Sphere" });
      const path = geo.geoPath(projection);
      project = (lon, lat) => projection([lon, lat]);

      const sphere = el("path", { d: path({ type: "Sphere" }), class: "lage-sphere" });
      const grat = el("path", { d: path(geo.geoGraticule10()), class: "lage-grat" });
      const g = el("g", { class: "lage-countries" });
      for (const f of land.features) {
        const id = String(f.id).padStart(3, "0");
        g.append(el("path", { d: path(f), class: "land", "data-id": id }));
      }
      svg.replaceChildren(sphere, grat, g, el("g", { id: "lage-markers" }));
      g.addEventListener("click", (e) => {
        const id = e.target.getAttribute?.("data-id");
        if (id && countries.some((c) => c.id === id)) select(id);
      });
    } catch (err) {
      // Ohne Internet zur Karten-Quelle: einfache Projektion auf Raster.
      console.warn("Weltkarte nicht geladen:", err);
      project = (lon, lat) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
      const g = el("g", { class: "lage-grat-fallback" });
      for (let x = 0; x <= W; x += 40) g.append(el("line", { x1: x, y1: 0, x2: x, y2: H }));
      for (let y = 0; y <= H; y += 40) g.append(el("line", { x1: 0, y1: y, x2: W, y2: y }));
      svg.replaceChildren(g, el("g", { id: "lage-markers" }));
    }
    return d3;
  }

  function el(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  // ---------- Daten ----------
  async function load() {
    $("lage-stand").textContent = "Scanne Nachrichtenlage...";
    $("lage").classList.add("scanning");
    try {
      const res = await api("/api/lage");
      if (!res.ok) throw new Error((await res.json()).error || "Fehler");
      countries = await res.json();
      await mapReady;
      render();
      const time = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      $("lage-stand").textContent = `${countries.length} Länder überwacht · Stand ${time}`;
    } catch (err) {
      $("lage-stand").textContent = `Lage nicht verfügbar: ${err.message}`;
    } finally {
      $("lage").classList.remove("scanning");
    }
  }

  const ratingClass = (c) => c.bewertung || "offen";
  const count = (c) => (c.meldungen >= 100 ? "100+" : String(c.meldungen));

  function render() {
    const max = Math.max(1, ...countries.map((c) => c.meldungen));

    // Länderflächen einfärben
    document.querySelectorAll("#lage-map .land").forEach((p) => {
      const c = countries.find((x) => x.id === p.getAttribute("data-id"));
      p.setAttribute("class", c ? `land watched ${ratingClass(c)}${selected === c.id ? " selected" : ""}` : "land");
    });

    // Marker: je mehr Meldungen, desto größer
    const markers = $("lage-markers");
    markers.replaceChildren();
    for (const c of countries) {
      const pos = project?.(c.lon, c.lat);
      if (!pos) continue;
      const r = 3 + (c.meldungen / max) * 9;
      const g = el("g", { class: `marker ${ratingClass(c)}${selected === c.id ? " selected" : ""}`, transform: `translate(${pos[0].toFixed(1)},${pos[1].toFixed(1)})`, tabindex: "0", role: "button", "aria-label": `${c.name}, ${count(c)} Meldungen` });
      g.append(el("circle", { r: (r * 2.2).toFixed(1), class: "pulse" }), el("circle", { r: r.toFixed(1), class: "core" }));
      const title = el("title");
      title.textContent = `${c.name}: ${count(c)} Meldungen`;
      g.append(title);
      g.addEventListener("click", () => select(c.id));
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(c.id); } });
      markers.append(g);
    }

    // Liste nach Anzahl Meldungen
    const list = $("lage-list");
    list.replaceChildren();
    for (const c of [...countries].sort((a, b) => b.meldungen - a.meldungen)) {
      const li = document.createElement("li");
      li.innerHTML = `<button class="lage-row ${selected === c.id ? "active" : ""}"><i class="dot ${ratingClass(c)}"></i><span>${escapeHtml(c.name)}</span><b>${count(c)}</b></button>`;
      li.firstElementChild.addEventListener("click", () => select(c.id));
      list.append(li);
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
      const items = data.meldungen.slice(0, 10).map((n) => {
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
})();
