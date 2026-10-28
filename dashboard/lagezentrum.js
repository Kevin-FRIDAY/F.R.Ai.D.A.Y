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
  let routeGeo = [];
  let regions = [];
  let brennReady = false;
  let issTrail = [];
  let issTimer = null;
  let eventsTimer = null;

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
  $("lage-refresh")?.addEventListener("click", () => load(true));
  $("lage-world").addEventListener("click", () => { selected = null; showSide(false); render(); flyToWorld(); $("lage-world").classList.add("hidden"); $("lage-land").textContent = "Land wählen"; $("lage-detail").innerHTML = 'Tippe auf der Karte oder in der Liste auf ein Land.'; });
  const findRegion = (key) => { const k = String(key || "").trim().toLowerCase(); return regions.find((r) => r.id !== "welt" && (r.name.toLowerCase() === k || (k.length >= 4 && r.name.toLowerCase().includes(k)))); };
  $("lage-q").addEventListener("change", () => {
    const v = $("lage-q").value;
    const reg = findRegion(v);
    if (reg) { $("lage-q").value = reg.name; selectRegion(reg.id); return; }
    const c = findLocal(v); if (c) { $("lage-q").value = c.name; select(c.id); }
  });
  $("lage-mic")?.addEventListener("click", listenCountry);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("lage").classList.contains("hidden")) close(); });

  // Land per Stimme sagen (nutzt die Spracherkennung des Browsers).
  function listenCountry() {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { $("lage-q").focus(); return; }
    const rec = new R();
    rec.lang = "de-DE"; rec.interimResults = false; rec.maxAlternatives = 3;
    $("lage-mic")?.classList.add("listening");
    rec.onresult = (e) => {
      const alts = [...e.results[0]].map((a) => a.transcript);
      let hit = null;
      let reg = null;
      for (const a of alts) { reg = findRegion(a) || findRegion(a.replace(/^(zeig(e)? mir|geh(e)? (nach|in)|was ist (in|los in))\s+/i, "")); if (reg) break; }
      if (reg) { $("lage-q").value = reg.name; selectRegion(reg.id); $("lage-mic")?.classList.remove("listening"); return; }
      for (const a of alts) { hit = findLocal(a) || findLocal(a.replace(/^(zeig(e)? mir|geh(e)? (nach|in)|was ist (in|los in))\s+/i, "")); if (hit) break; }
      if (hit) { $("lage-q").value = hit.name; select(hit.id); }
      else $("lage-q").value = alts[0] || "";
    };
    rec.onend = () => $("lage-mic")?.classList.remove("listening");
    rec.onerror = () => $("lage-mic")?.classList.remove("listening");
    try { rec.start(); } catch { /* läuft schon */ }
  }

  const showSide = (on) => document.querySelector(".lage-body")?.classList.toggle("open", on);

  function open() {
    $("lage").classList.remove("hidden");
    document.body.classList.add("lage-open");
    mapReady ??= drawMap();
    mapReady.then(() => { if (!selected && projection) startSpin(); });
    load(false);
    loadQuakes();
    loadEvents();
    clearInterval(eventsTimer);
    eventsTimer = setInterval(loadEvents, 5 * 60 * 1000);
    loadSats();
    loadInfra("flughaefen", "lage-airports", "airport", "lage-air-on");
    loadInfra("kraftwerke", "lage-powerplants", "plant", "lage-kw-on");
    loadBrennpunkte();
    startISS();
  }

  function close() {
    showSide(false);
    $("lage").classList.add("hidden");
    document.body.classList.remove("lage-open");
    clearTimeout(pollTimer);
    pollTimer = null;
    spinning = false;
    cancelAnimationFrame(viewAnim);
    cancelAnimationFrame(autoRaf);
    clearTimeout(issTimer); issTimer = null;
    clearInterval(eventsTimer); eventsTimer = null;
    clearTimeout(satTimer); satTimer = null;
    $("lage-world")?.classList.add("hidden");
  }

  // ---------- ISS: schwebt live über der Erde ----------
  async function startISS() {
    await mapReady;
    if (!projection) return;
    const g = $("lage-iss");
    if (g && !g.firstElementChild) {
      const node = el("g", { class: "iss", role: "button", tabindex: "0" });
      // kleines Satelliten-Symbol: Körper + zwei Solarflügel
      node.append(
        el("line", { x1: -17, y1: 0, x2: 17, y2: 0, class: "iss-bar" }),
        el("rect", { x: -17, y: -5, width: 11, height: 10, class: "iss-panel" }),
        el("rect", { x: 6, y: -5, width: 11, height: 10, class: "iss-panel" }),
        el("circle", { r: 4.5, class: "iss-body" }),
        el("circle", { r: 16, class: "iss-glow" }),
      );
      const t = el("title"); t.textContent = "Internationale Raumstation ISS"; node.append(t);
      node.addEventListener("click", showISSCard);
      g.append(node);
    }
    const tg = $("lage-isstrail");
    if (tg && !tg.firstElementChild) tg.append(el("path", { class: "iss-trail" }));
    tickISS();
  }

  async function tickISS() {
    try {
      const i = await (await api("/api/lage-iss")).json();
      if ($("lage").classList.contains("hidden")) return;
      if (Number.isFinite(i.lat)) {
        issLast = i;
        const node = $("lage-iss")?.firstElementChild;
        if (node) { node.dataset.lon = i.lon; node.dataset.lat = i.lat; }
        issTrail.push([i.lon, i.lat]);
        if (issTrail.length > 25) issTrail.shift();
        placeISS();
      }
    } catch { /* ISS optional */ }
    clearTimeout(issTimer);
    issTimer = setTimeout(tickISS, 4000);
  }

  let issLast = null;
  function showISSCard() {
    if (!issLast) return;
    let card = $("lage-shipcard");
    if (!card) { card = document.createElement("div"); card.id = "lage-shipcard"; card.className = "lage-shipcard"; $("lage").append(card); }
    card.innerHTML = `<button class="ship-x" aria-label="Schließen">✕</button>
      <h3>🛰 Raumstation ISS</h3>
      <div class="ship-rows">
        <span>Position</span><b>${issLast.lat.toFixed(1)}°, ${issLast.lon.toFixed(1)}°</b>
        <span>Höhe</span><b>${issLast.hoehe_km} km</b>
        <span>Tempo</span><b>${Number(issLast.tempo_kmh).toLocaleString("de-DE")} km/h</b>
        <span>Über</span><b>${escapeHtml(issLast.ueber || "")}</b>
      </div>`;
    card.querySelector(".ship-x").addEventListener("click", () => card.remove());
  }

  // ---------- Globus (runde Erde) ----------
  let d3geo = null, geoPath = null, projection = null, landFeatures = [];
  let sphereNode = null, gratNode = null, landGroup = null, graticuleObj = null;
  let baseScale = 1, autoRaf = null, lastFrame = 0, spinning = true;
  const CX = W / 2, CY = H / 2;

  function visible(lon, lat) {
    if (!d3geo || !projection) return true;
    const r = projection.rotate();
    const center = [-r[0], -r[1]];
    return d3geo.geoDistance(center, [lon, lat]) < Math.PI / 2 - 0.02;
  }

  async function drawMap() {
    const svg = $("lage-map");
    try {
      const [geo, topo, world] = await Promise.all([
        import("https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/+esm"),
        import("https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm"),
        fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json").then((r) => r.json()),
      ]);
      d3geo = geo;
      landFeatures = topo.feature(world, world.objects.countries).features;
      projection = geo.geoOrthographic().fitExtent([[6, 6], [W - 6, H - 6]], { type: "Sphere" }).rotate([-10, -25, 0]).clipAngle(90);
      baseScale = projection.scale();
      geoPath = geo.geoPath(projection);
      project = (lon, lat) => projection([lon, lat]);

      const defs = el("defs");
      defs.innerHTML = `
        <radialGradient id="lage-ocean" cx="38%" cy="35%" r="75%">
          <stop offset="0%" stop-color="#241403"/>
          <stop offset="60%" stop-color="#120a02"/>
          <stop offset="100%" stop-color="#040302"/>
        </radialGradient>
        <radialGradient id="lage-atmo" cx="50%" cy="50%" r="50%">
          <stop offset="78%" stop-color="#ff8a1e" stop-opacity="0"/>
          <stop offset="95%" stop-color="#ff8a1e" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="#ff8a1e" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="lage-shade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000" stop-opacity="0"/>
          <stop offset="70%" stop-color="#000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.45"/>
        </radialGradient>`;
      const atmo = el("circle", { class: "lage-atmo", cx: CX, cy: CY, r: baseScale + 10, fill: "url(#lage-atmo)" });
      sphereNode = el("path", { class: "lage-ocean", d: geoPath({ type: "Sphere" }) });
      graticuleObj = geo.geoGraticule10();
      gratNode = el("path", { class: "lage-grat", d: geoPath(graticuleObj) });
      landGroup = el("g", { class: "lage-countries" });
      for (const f of landFeatures) {
        const id = String(f.id).padStart(3, "0");
        landGroup.append(el("path", { d: geoPath(f) || "", class: "land", "data-id": id }));
      }
      const shade = el("circle", { class: "lage-shade", cx: CX, cy: CY, r: baseScale, fill: "url(#lage-shade)", "pointer-events": "none" });
      svg.replaceChildren(defs, atmo, sphereNode, gratNode, landGroup, el("g", { id: "lage-night" }), el("g", { id: "lage-routes" }), el("g", { id: "lage-hotspots" }), el("g", { id: "lage-quakes" }), el("g", { id: "lage-airports" }), el("g", { id: "lage-powerplants" }), el("g", { id: "lage-fires" }), el("g", { id: "lage-volcanoes" }), el("g", { id: "lage-storms" }), el("g", { id: "lage-weitere" }), el("g", { id: "lage-ships" }), el("g", { id: "lage-planes" }), el("g", { id: "lage-sats" }), el("g", { id: "lage-markers" }), el("g", { id: "lage-isstrail" }), el("g", { id: "lage-iss" }), shade);
      landGroup.addEventListener("click", (e) => {
        if (dragMoved) return; // echter Ziehvorgang, kein Klick
        const id = e.target.getAttribute?.("data-id");
        if (id && countries.some((c) => c.id === id)) select(id);
      });
      // Mit der Maus/Finger drehen.
      enableDrag(svg);
      startSpin();
    } catch (err) {
      console.warn("Globus nicht geladen:", err);
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

  // Zeichnet Kugel, Gitter, Länder und setzt Marker/Erdbeben neu (für die aktuelle Drehung/Zoom).
  function redrawGlobe() {
    if (!geoPath) return;
    sphereNode.setAttribute("d", geoPath({ type: "Sphere" }));
    gratNode.setAttribute("d", geoPath(graticuleObj));
    const paths = landGroup.children;
    for (let i = 0; i < landFeatures.length; i++) paths[i].setAttribute("d", geoPath(landFeatures[i]) || "");
    const atmo = document.querySelector(".lage-atmo");
    const shade = document.querySelector(".lage-shade");
    const s = projection.scale();
    if (atmo) atmo.setAttribute("r", s + 10);
    if (shade) shade.setAttribute("r", s);
    // Rote Routen (nur Vorderseite sichtbar durch clipAngle).
    const rg = $("lage-routes");
    if (rg) for (const path of rg.children) { const geo = routeGeo[path.dataset.i]; if (geo) path.setAttribute("d", geoPath(geo) || ""); }
    drawNight();
    placePoints();
    placeSats();
    placeISS();
  }

  // ISS schwebt leicht über der Oberfläche (nach außen versetzt), Bahn als Spur.
  function placeISS() {
    const g = $("lage-iss");
    const node = g && g.firstElementChild;
    if (node) {
      const lon = +node.dataset.lon, lat = +node.dataset.lat;
      if (Number.isFinite(lon) && visible(lon, lat)) {
        node.style.display = "";
        const p = projection([lon, lat]);
        const dx = p[0] - CX, dy = p[1] - CY, d = Math.hypot(dx, dy) || 1;
        const off = projection.scale() * 0.055; // etwas über der Kugel
        node.setAttribute("transform", `translate(${(p[0] + dx / d * off).toFixed(1)},${(p[1] + dy / d * off).toFixed(1)})`);
      } else node.style.display = "none";
    }
    const tg = $("lage-isstrail");
    if (tg && tg.firstElementChild && d3geo) {
      tg.firstElementChild.setAttribute("d", geoPath({ type: "LineString", coordinates: issTrail }) || "");
    }
  }

  function placePoints() {
    for (const node of document.querySelectorAll("#lage-markers .marker, #lage-hotspots .hotspot, #lage-quakes .quake, #lage-fires .fire, #lage-volcanoes .volcano, #lage-storms .storm, #lage-weitere .eevent, #lage-airports .airport, #lage-powerplants .plant, #lage-ships .ship, #lage-planes .plane")) {
      const lon = +node.dataset.lon, lat = +node.dataset.lat;
      if (!visible(lon, lat)) { node.style.display = "none"; continue; }
      node.style.display = "";
      const p = projection([lon, lat]);
      if (node.tagName === "circle") { node.setAttribute("cx", p[0].toFixed(1)); node.setAttribute("cy", p[1].toFixed(1)); }
      else if (node.classList.contains("ship") || node.classList.contains("plane")) node.setAttribute("transform", `translate(${p[0].toFixed(1)},${p[1].toFixed(1)}) rotate(${node.dataset.cog || 0})`);
      else node.setAttribute("transform", `translate(${p[0].toFixed(1)},${p[1].toFixed(1)})`);
    }
  }

  // ---------- Drehen ----------
  function startSpin() {
    spinning = true;
    cancelAnimationFrame(autoRaf);
    lastFrame = performance.now();
    const tick = (now) => {
      const dt = now - lastFrame;
      if (spinning && !selected && dt >= 30) { // ~30 fps, schont ältere Geräte
        lastFrame = now;
        const r = projection.rotate();
        projection.rotate([r[0] + Math.min(100, dt) * 0.004, r[1], r[2]]); // langsame Erddrehung
        redrawGlobe();
      }
      autoRaf = requestAnimationFrame(tick);
    };
    autoRaf = requestAnimationFrame(tick);
  }

  function animateGlobe(toRotate, toScale, ms = 1000, done) {
    const fromR = projection.rotate(), fromS = projection.scale();
    const start = performance.now();
    cancelAnimationFrame(viewAnim);
    spinning = false;
    const short = (a, b) => { let d = (b - a) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return a + d; };
    const tgt = [short(fromR[0], toRotate[0]), toRotate[1], 0];
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const step = (now) => {
      const p = Math.min(1, (now - start) / ms), e = ease(p);
      projection.rotate([fromR[0] + (tgt[0] - fromR[0]) * e, fromR[1] + (tgt[1] - fromR[1]) * e, 0]);
      projection.scale(fromS + (toScale - fromS) * e);
      redrawGlobe();
      if (p < 1) viewAnim = requestAnimationFrame(step); else if (done) done();
    };
    viewAnim = requestAnimationFrame(step);
  }

  function flyToCountry(id) {
    const c = countries.find((x) => x.id === id);
    if (!c || !projection) return;
    $("lage-world").classList.remove("hidden");
    animateGlobe([-c.lon, -c.lat, 0], baseScale * 2.1, 1000);
  }

  function flyToWorld() {
    if (!projection) return;
    animateGlobe([-10, -25, 0], baseScale, 900, startSpin);
  }

  // Mit Maus oder Finger drehen.
  let dragMoved = false;
  function enableDrag(svg) {
    let drag = null;
    const toUser = (e) => { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
    svg.addEventListener("pointerdown", (e) => { drag = { ...toUser(e), r: projection.rotate(), moved: false }; spinning = false; });
    svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const p = toUser(e);
      if (Math.hypot(p.x - drag.x, p.y - drag.y) > 4) drag.moved = true; // erst ab echter Bewegung drehen
      if (!drag.moved) return;
      const k = 0.3 * (baseScale / projection.scale());
      projection.rotate([drag.r[0] + (p.x - drag.x) * k, Math.max(-85, Math.min(85, drag.r[1] - (p.y - drag.y) * k)), 0]);
      redrawGlobe();
    });
    const end = () => {
      dragMoved = Boolean(drag && drag.moved);
      if (dragMoved) setTimeout(() => { dragMoved = false; }, 0); // Klick nach echtem Ziehen unterdrücken
      if (drag && !selected && !document.querySelector(".lage-region-tab.active")) spinning = true;
      drag = null;
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointerleave", end);
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
      fillDatalist();
      updateStand(data);
      // Solange der Scanner die Welt durchläuft, alle paar Sekunden nachladen,
      // danach laufend im Hintergrund frisch halten (immer aktuell).
      clearTimeout(pollTimer);
      if (data.scannt || data.geladen < data.gesamt) {
        pollTimer = setTimeout(() => load(false), 3000);
      } else {
        $("lage").classList.remove("scanning");
        pollTimer = setTimeout(() => load(false), 90 * 1000);
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
      $("lage-stand").textContent = `● Live · ${data.gesamt} Länder · Stand ${time}`;
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
      g.dataset.lon = c.lon; g.dataset.lat = c.lat;
      if (!visible(c.lon, c.lat)) g.style.display = "none";
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
    if (!list) return;
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
      node.dataset.lon = q.lon; node.dataset.lat = q.lat;
      node.dataset.titel = `Erdbeben M${q.staerke} · ${q.ort}`; node.dataset.mag = q.staerke;
      if (!visible(q.lon, q.lat)) node.style.display = "none";
      const title = el("title");
      title.textContent = node.dataset.titel;
      node.append(title);
      g.append(node);
    }
  }

  // ---------- Tag/Nacht-Grenze (Terminator) ----------
  function subsolar() {
    const now = new Date();
    const start = Date.UTC(now.getUTCFullYear(), 0, 0);
    const day = (now.getTime() - start) / 86400000;
    const decl = 23.44 * Math.sin((2 * Math.PI * (day - 81)) / 365.25); // Sonnen-Deklination grob
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const lon = -15 * (utcH - 12);
    return [lon, decl];
  }
  function drawNight() {
    const g = $("lage-night");
    if (!g || !d3geo || !geoPath) return;
    if (!$("lage-night-on")?.checked) { g.replaceChildren(); return; }
    const [slon, slat] = subsolar();
    const circle = d3geo.geoCircle().center([slon + 180, -slat]).radius(90)();
    let p = g.firstElementChild;
    if (!p) { p = el("path", { class: "lage-night" }); g.append(p); }
    p.setAttribute("d", geoPath(circle) || "");
  }

  // ---------- Naturereignisse (NASA EONET): Feuer, Vulkane, Unwetter, Fluten ----------
  let events = { feuer: [], vulkane: [], stuerme: [], fluten: [] };
  async function loadEvents() {
    try {
      events = await (await api("/api/lage-ereignisse")).json();
      await mapReady;
      renderEvents();
    } catch { /* Ereignisse optional */ }
  }
  function renderEventGroup(gid, cls, list, toggleId) {
    const g = $(gid);
    if (!g) return;
    g.replaceChildren();
    if (!$(toggleId)?.checked) return 0;
    let n = 0;
    for (const ev of list || []) {
      const pos = project?.(ev.lon, ev.lat);
      if (!pos) continue;
      const node = el("circle", { cx: pos[0].toFixed(1), cy: pos[1].toFixed(1), r: cls === "fire" ? 2.6 : 3.6, class: cls });
      node.dataset.lon = ev.lon; node.dataset.lat = ev.lat;
      node.dataset.titel = ev.titel || ""; node.dataset.link = ev.link || ""; node.dataset.zeit = ev.zeit || "";
      if (!visible(ev.lon, ev.lat)) node.style.display = "none";
      const t = el("title"); t.textContent = ev.titel || ""; node.append(t);
      g.append(node); n++;
    }
    return n;
  }
  const setCount = (id, n) => { const e = $(id); if (e) e.textContent = n ? ` (${n})` : ""; };
  function renderEvents() {
    renderEventGroup("lage-fires", "fire", events.feuer, "lage-fires-on");
    renderEventGroup("lage-volcanoes", "volcano", events.vulkane, "lage-volc-on");
    renderEventGroup("lage-storms", "storm", [...(events.stuerme || []), ...(events.fluten || [])], "lage-storms-on");
    renderEventGroup("lage-weitere", "eevent", [...(events.erdrutsch || []), ...(events.staub || []), ...(events.duerre || []), ...(events.eis || [])], "lage-weitere-on");
    setCount("cnt-fires", (events.feuer || []).length);
    setCount("cnt-volc", (events.vulkane || []).length);
    setCount("cnt-storms", (events.stuerme || []).length + (events.fluten || []).length);
    setCount("cnt-weitere", (events.erdrutsch || []).length + (events.staub || []).length + (events.duerre || []).length + (events.eis || []).length);
  }

  // ---------- Infrastruktur: große Flughäfen + Kraftwerke ----------
  let infra = { flughaefen: null, kraftwerke: null };
  async function loadInfra(typ, gid, cls, toggleId) {
    if (!$(toggleId)?.checked) { $(gid)?.replaceChildren(); return; }
    try {
      if (!infra[typ]) infra[typ] = await (await api("/api/lage-infra?typ=" + typ)).json();
      await mapReady;
      renderInfra(typ, gid, cls, toggleId);
    } catch { /* optional */ }
  }
  function renderInfra(typ, gid, cls, toggleId) {
    const g = $(gid);
    if (!g) return;
    g.replaceChildren();
    if (!$(toggleId)?.checked || !infra[typ]) return;
    for (const o of infra[typ]) {
      const pos = project?.(o.lon, o.lat);
      if (!pos) continue;
      const node = el("circle", { cx: pos[0].toFixed(1), cy: pos[1].toFixed(1), r: 1.7, class: cls });
      node.dataset.lon = o.lon; node.dataset.lat = o.lat;
      node.dataset.titel = typ === "flughaefen" ? `✈ ${o.n}${o.iata ? " (" + o.iata + ")" : ""}` : `⚡ ${o.n} · ${o.mw} MW · ${o.f}`;
      if (!visible(o.lon, o.lat)) node.style.display = "none";
      const t = el("title"); t.textContent = node.dataset.titel; node.append(t);
      g.append(node);
    }
  }

  // ---------- Satelliten (Celestrak-Bahndaten, Positionen mit satellite.js) ----------
  let satlib = null, satrecs = [], satTimer = null;
  async function loadSats() {
    if (!$("lage-sats-on")?.checked) return;
    try {
      satlib = satlib || await import("https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/+esm");
      if (!satrecs.length) {
        const list = await (await api("/api/lage-satelliten")).json();
        satrecs = (list || []).map((s) => { try { return { name: s.name, rec: satlib.twoline2satrec(s.l1, s.l2) }; } catch { return null; } }).filter(Boolean);
      }
      await mapReady;
      tickSats();
    } catch { /* Satelliten optional */ }
  }
  function tickSats() {
    if (!satlib || !$("lage-sats-on")?.checked || !projection) return;
    const g = $("lage-sats");
    if (!g) return;
    if (g.childElementCount !== satrecs.length) {
      g.replaceChildren();
      for (const s of satrecs) {
        const node = el("circle", { r: 1.5, class: "sat" });
        const t = el("title"); t.textContent = s.name; node.append(t);
        g.append(node);
      }
    }
    const now = new Date();
    const gmst = satlib.gstime(now);
    const nodes = g.children;
    satrecs.forEach((s, i) => {
      try {
        const pv = satlib.propagate(s.rec, now);
        if (!pv?.position) return;
        const gd = satlib.eciToGeodetic(pv.position, gmst);
        nodes[i].dataset.lon = satlib.degreesLong(gd.longitude);
        nodes[i].dataset.lat = satlib.degreesLat(gd.latitude);
        nodes[i].dataset.alt = Math.round(gd.height);
        nodes[i].dataset.titel = satrecs[i].name;
        const v = pv.velocity;
        if (v) nodes[i].dataset.spd = Math.round(Math.hypot(v.x, v.y, v.z) * 3600);
      } catch { /* ein Satellit egal */ }
    });
    placeSats();
    clearTimeout(satTimer);
    satTimer = setTimeout(tickSats, 5000);
  }
  function placeSats() {
    const g = $("lage-sats");
    if (!g || !projection) return;
    const off = projection.scale() * 0.02;
    for (const node of g.children) {
      const lon = +node.dataset.lon, lat = +node.dataset.lat;
      if (!Number.isFinite(lon) || !visible(lon, lat)) { node.style.display = "none"; continue; }
      node.style.display = "";
      const p = projection([lon, lat]);
      const dx = p[0] - CX, dy = p[1] - CY, d = Math.hypot(dx, dy) || 1;
      node.setAttribute("cx", (p[0] + dx / d * off).toFixed(1));
      node.setAttribute("cy", (p[1] + dy / d * off).toFixed(1));
    }
  }

  // ---------- Brennpunkte: Reiter, rote Routen, Krisenpunkte ----------
  async function loadBrennpunkte() {
    if (brennReady) return;
    try {
      const b = await (await api("/api/lage-brennpunkte")).json();
      regions = b.regionen || [];
      await mapReady;
      // Reiter oben
      const bar = $("lage-regions");
      if (bar) {
        bar.replaceChildren(...regions.map((r) => {
          const btn = document.createElement("button");
          btn.className = "lage-region-tab"; btn.textContent = r.name; btn.dataset.id = r.id;
          btn.addEventListener("click", () => selectRegion(r.id));
          return btn;
        }));
      }
      // Rote Routen auf dem Globus
      const rg = $("lage-routes");
      routeGeo = [];
      if (rg && projection) {
        rg.replaceChildren();
        (b.routen || []).forEach((r, i) => {
          routeGeo.push({ type: "LineString", coordinates: r.punkte });
          rg.append(el("path", { class: `route route-${r.art || "gefahr"}`, "data-i": i, d: geoPath(routeGeo[i]) || "" }));
        });
      }
      // Krisenpunkte (pulsierend, rot)
      const hg = $("lage-hotspots");
      if (hg && projection) {
        hg.replaceChildren();
        for (const h of b.hotspots || []) {
          const pos = projection([h.lon, h.lat]);
          const g2 = el("g", { class: "hotspot", transform: `translate(${pos[0].toFixed(1)},${pos[1].toFixed(1)})` });
          g2.dataset.lon = h.lon; g2.dataset.lat = h.lat;
          if (!visible(h.lon, h.lat)) g2.style.display = "none";
          g2.append(el("circle", { r: 14, class: "pulse" }), el("circle", { r: 4, class: "core" }));
          const t = el("title"); t.textContent = `Brennpunkt: ${h.name}`; g2.append(t);
          hg.append(g2);
        }
      }
      brennReady = true;
      redrawGlobe();
    } catch { /* Brennpunkte optional */ }
  }

  async function selectRegion(id) {
    const r = regions.find((x) => x.id === id);
    if (!r) return;
    document.querySelectorAll(".lage-region-tab").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
    selected = null;
    document.querySelectorAll("#lage-map .land.selected, #lage-markers .selected").forEach((n) => n.classList.remove("selected"));
    if (id === "welt") { showSide(false); $("lage-land").textContent = "Land wählen"; $("lage-detail").innerHTML = "Tippe auf der Karte, in der Liste oder oben auf einen Brennpunkt."; $("lage-world").classList.add("hidden"); flyToWorld(); return; }
    $("lage-world").classList.remove("hidden");
    await mapReady;
    animateGlobe([-r.lon, -r.lat, 0], baseScale * (r.zoom || 3), 1000);
    showSide(true);
    loadShipsFor({ region: id });
    loadPlanesFor({ region: id });
    $("lage-land").textContent = r.name;
    const box = $("lage-detail"); box.className = "";
    box.innerHTML = `<p class="muted">Lade Lage in ${escapeHtml(r.name)}...</p>`;
    try {
      const data = await (await api(`/api/lage-region/${id}`)).json();
      const items = (data.meldungen || []).slice(0, 12).map((n) => {
        const t = new Date(n.date).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        const title = n.link ? `<a href="${escapeHtml(n.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.title)}</a>` : escapeHtml(n.title);
        return `<li>${title}<small>${escapeHtml(n.source)} · ${t}</small></li>`;
      }).join("") || `<li class="muted">Keine Meldungen.</li>`;
      box.innerHTML = `${satBlock(r.lon, r.lat, r.name)}<ul class="lage-news">${items}</ul>`;
      box.querySelector(".lage-satview")?.addEventListener("click", () => openSat(r.lon, r.lat, 6, r.name));
    } catch (err) {
      box.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    }
  }

  // ---------- Satellitenansicht (Esri, öffentlich, kein Schlüssel) ----------
  let leafletReady = null, satMap = null;
  async function openSat(lon, lat, zoom, title) {
    $("sat-title").textContent = `Satellit: ${title}`;
    $("sat").classList.remove("hidden");
    leafletReady ??= (async () => {
      if (!document.getElementById("leaflet-css")) {
        const l = document.createElement("link"); l.id = "leaflet-css"; l.rel = "stylesheet";
        l.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"; document.head.append(l);
      }
      await import("https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet-src.esm.js").then((m) => { window.L = m; });
    })();
    try {
      await leafletReady;
      const L = window.L;
      if (!satMap) {
        satMap = L.map("sat-map", { attributionControl: false, zoomControl: true });
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18 }).addTo(satMap);
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18, opacity: 0.7 }).addTo(satMap);
      }
      satMap.setView([lat, lon], zoom);
      setTimeout(() => satMap.invalidateSize(), 60);
      addSatShips(lon, lat);
    } catch {
      $("sat-map").innerHTML = '<p class="error" style="padding:16px">Satellitenkarte konnte nicht geladen werden.</p>';
    }
  }
  $("sat-x").addEventListener("click", () => $("sat").classList.add("hidden"));

  // Satellitenbild direkt im Panel (automatisch), klick öffnet die große Karte.
  function satBlock(lon, lat, name) {
    const dLon = 9, dLat = 6;
    const bbox = `${(lon - dLon).toFixed(2)},${(lat - dLat).toFixed(2)},${(lon + dLon).toFixed(2)},${(lat + dLat).toFixed(2)}`;
    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=560,300&format=jpg&f=image`;
    return `<div class="lage-satview" title="Satellitenkarte öffnen">
      <img loading="lazy" src="${encodeURI(url)}" alt="Satellit ${escapeHtml(name)}" onerror="this.closest('.lage-satview').remove()">
      <span class="sat-label">🛰 Satellit · tippen für groß</span>
    </div>`;
  }

  // Schiffe auf der Satellitenkarte (mit Detail-Popup).
  let satShipLayer = null;
  async function addSatShips(lon, lat) {
    const L = window.L;
    if (!L || !satMap) return;
    if (satShipLayer) { satMap.removeLayer(satShipLayer); satShipLayer = null; }
    try {
      const data = await (await api(`/api/lage-schiffe?near=${encodeURIComponent(lon + "," + lat)}`)).json();
      if (!data.aktiv || !data.schiffe?.length) return;
      satShipLayer = L.layerGroup().addTo(satMap);
      for (const s of data.schiffe) {
        if (s.lat == null) continue;
        const m = L.circleMarker([s.lat, s.lon], { radius: 5, color: "#ff8a1e", weight: 1, fillColor: "#ff8a1e", fillOpacity: 0.8 });
        m.bindPopup(`<b>🚢 ${escapeHtml(s.name)}</b><br>${escapeHtml(s.typ)}${s.tempo_kn != null ? " · " + s.tempo_kn + " kn" : ""}${s.kurs != null ? " · Kurs " + s.kurs + "°" : ""}${s.laenge_m ? "<br>Länge " + s.laenge_m + " m" : ""}${s.ziel ? "<br>Ziel: " + escapeHtml(s.ziel) : ""}`);
        satShipLayer.addLayer(m);
      }
    } catch { /* Schiffe optional */ }
  }

  // ---------- Schiffe (AIS, braucht Gratis-Schlüssel) ----------
  let shipAktiv = true;
  async function loadShipsFor(params) {
    const g = $("lage-ships");
    if (g) g.replaceChildren();
    if (!$("lage-ships-on")?.checked) return;
    const q = params.region ? `region=${params.region}` : `near=${encodeURIComponent(params.near)}`;
    try {
      const data = await (await api(`/api/lage-schiffe?${q}`)).json();
      shipAktiv = data.aktiv;
      if (!data.aktiv || !Array.isArray(data.schiffe)) return;
      renderShips(data.schiffe);
    } catch { /* Schiffe optional */ }
  }

  function renderShips(list) {
    const g = $("lage-ships");
    if (!g || !projection) return;
    g.replaceChildren();
    for (const s of list.slice(0, 60)) {
      if (s.lat == null) continue;
      const node = el("g", { class: "ship", role: "button", tabindex: "0" });
      node.dataset.lon = s.lon; node.dataset.lat = s.lat; node.dataset.cog = s.kurs || 0;
      if (!visible(s.lon, s.lat)) node.style.display = "none";
      else { const p = projection([s.lon, s.lat]); node.setAttribute("transform", `translate(${p[0].toFixed(1)},${p[1].toFixed(1)}) rotate(${s.kurs || 0})`); }
      node.append(el("path", { d: "M0,-5 L3.2,5 L-3.2,5 Z", class: "ship-tri" }));
      const t = el("title"); t.textContent = `${s.name} · ${s.typ}${s.tempo_kn != null ? " · " + s.tempo_kn + " kn" : ""}`; node.append(t);
      node.addEventListener("click", () => showShipCard(s));
      node.addEventListener("keydown", (e) => { if (e.key === "Enter") showShipCard(s); });
      g.append(node);
    }
  }

  function showShipCard(s) {
    let card = $("lage-shipcard");
    if (!card) {
      card = document.createElement("div"); card.id = "lage-shipcard"; card.className = "lage-shipcard";
      $("lage").append(card);
    }
    card.innerHTML = `<button class="ship-x" aria-label="Schließen">✕</button>
      <h3>🚢 ${escapeHtml(s.name)}</h3>
      <div class="ship-rows">
        <span>Typ</span><b>${escapeHtml(s.typ)}</b>
        ${s.tempo_kn != null ? `<span>Tempo</span><b>${s.tempo_kn} kn</b>` : ""}
        ${s.kurs != null ? `<span>Kurs</span><b>${s.kurs}°</b>` : ""}
        ${s.laenge_m ? `<span>Länge</span><b>${s.laenge_m} m</b>` : ""}
        ${s.ziel ? `<span>Ziel</span><b>${escapeHtml(s.ziel)}</b>` : ""}
      </div>`;
    card.querySelector(".ship-x").addEventListener("click", () => card.remove());
    card.classList.remove("hidden");
  }

  // ---------- Flugzeuge (adsb.lol) ----------
  let planeParams = null;
  async function loadPlanesFor(params) {
    planeParams = params;
    const g = $("lage-planes");
    if (g) g.replaceChildren();
    if (!$("lage-planes-on")?.checked) return;
    const q = params.region ? `region=${params.region}` : `near=${encodeURIComponent(params.near)}`;
    try {
      const data = await (await api(`/api/lage-flug?${q}`)).json();
      if (Array.isArray(data.flugzeuge)) renderPlanes(data.flugzeuge);
    } catch { /* optional */ }
  }
  function renderPlanes(list) {
    const g = $("lage-planes");
    if (!g || !projection) return;
    g.replaceChildren();
    for (const f of list.slice(0, 80)) {
      if (f.lat == null) continue;
      const node = el("g", { class: "plane", role: "button", tabindex: "0" });
      node.dataset.lon = f.lon; node.dataset.lat = f.lat; node.dataset.cog = f.kurs || 0;
      if (!visible(f.lon, f.lat)) node.style.display = "none";
      else { const p = projection([f.lon, f.lat]); node.setAttribute("transform", `translate(${p[0].toFixed(1)},${p[1].toFixed(1)}) rotate(${f.kurs || 0})`); }
      node.append(el("path", { d: "M0,-5 L1.5,-1 L5,1.5 L1.5,2 L1,4.5 L2.5,5.5 L0,5 L-2.5,5.5 L-1,4.5 L-1.5,2 L-5,1.5 L-1.5,-1 Z", class: "plane-glyph" }));
      const t = el("title"); t.textContent = `${f.flug} · ${f.typ}${f.hoehe_ft ? " · " + f.hoehe_ft + " ft" : ""}`; node.append(t);
      node.addEventListener("click", () => showPlaneCard(f));
      g.append(node);
    }
  }
  function showPlaneCard(f) {
    let card = $("lage-shipcard");
    if (!card) { card = document.createElement("div"); card.id = "lage-shipcard"; card.className = "lage-shipcard"; $("lage").append(card); }
    card.innerHTML = `<button class="ship-x" aria-label="Schließen">✕</button>
      <h3>✈ ${escapeHtml(f.flug)}</h3>
      <div class="ship-rows">
        ${f.typ ? `<span>Typ</span><b>${escapeHtml(f.typ)}</b>` : ""}
        ${f.hoehe_ft != null ? `<span>Höhe</span><b>${Number(f.hoehe_ft).toLocaleString("de-DE")} ft</b>` : ""}
        ${f.tempo_kn != null ? `<span>Tempo</span><b>${f.tempo_kn} kn</b>` : ""}
        ${f.kurs != null ? `<span>Kurs</span><b>${f.kurs}°</b>` : ""}
      </div>`;
    card.querySelector(".ship-x").addEventListener("click", () => card.remove());
  }

  document.addEventListener("change", (e) => {
    if (e.target?.id === "lage-ships-on") {
      if (!e.target.checked) { $("lage-ships")?.replaceChildren(); $("lage-shipcard")?.remove(); }
      else if (selected) loadShipsFor({ near: (() => { const c = countries.find((x) => x.id === selected); return c ? `${c.lon},${c.lat}` : ""; })() });
    }
    if (e.target?.id === "lage-planes-on") {
      if (!e.target.checked) $("lage-planes")?.replaceChildren();
      else if (planeParams) loadPlanesFor(planeParams);
    }
    if (["lage-fires-on", "lage-volc-on", "lage-storms-on", "lage-weitere-on"].includes(e.target?.id)) renderEvents();
    if (e.target?.id === "lage-night-on") drawNight();
    if (e.target?.id === "lage-sats-on") {
      if (!e.target.checked) { clearTimeout(satTimer); satTimer = null; $("lage-sats")?.replaceChildren(); }
      else loadSats();
    }
    if (e.target?.id === "lage-air-on") loadInfra("flughaefen", "lage-airports", "airport", "lage-air-on");
    if (e.target?.id === "lage-kw-on") loadInfra("kraftwerke", "lage-powerplants", "plant", "lage-kw-on");
  });

  // Info-Karte beim Antippen eines Markers: Was, Wo (Ort + Koordinaten), Live-Daten
  const MARKER_KINDS = [
    ["sat", "🛰️ Satellit"], ["fire", "🔥 Feuer / Brand"], ["volcano", "🌋 Vulkan"],
    ["storm", "🌪️ Unwetter"], ["eevent", "🌊 Naturereignis"], ["quake", "💥 Erdbeben"],
    ["airport", "✈️ Flughafen"], ["plant", "⚡ Kraftwerk"],
  ];
  const kindOf = (node) => MARKER_KINDS.find(([c]) => node.classList.contains(c)) || ["", "Objekt"];
  const fmtCoord = (lat, lon) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "O" : "W"}`;
  function nearestCountry(lon, lat) {
    let best = null, bd = Infinity;
    for (const c of countries) { const d = (c.lat - lat) ** 2 + (c.lon - lon) ** 2; if (d < bd) { bd = d; best = c; } }
    return best ? best.name : "";
  }
  async function reverseGeo(lat, lon) {
    try {
      const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=de`);
      const d = await r.json();
      const parts = [d.city || d.locality, d.principalSubdivision, d.countryName].filter(Boolean);
      return [...new Set(parts)].join(", ");
    } catch { return ""; }
  }
  let markerCardTimer = null;
  $("lage-map")?.addEventListener("click", (e) => {
    if (dragMoved) return;
    const n = e.target.closest(".sat, .fire, .volcano, .storm, .eevent, .quake, .airport, .plant");
    if (n) showMarkerCard(n);
  });
  function fillLive(card, node) {
    const lat = +node.dataset.lat, lon = +node.dataset.lon;
    const live = card.querySelector(".mc-live");
    if (!live) return;
    let html = `<span>Koordinaten</span><b>${fmtCoord(lat, lon)}</b>`;
    if (node.classList.contains("sat")) {
      if (node.dataset.alt) html += `<span>Höhe</span><b>${Number(node.dataset.alt).toLocaleString("de-DE")} km</b>`;
      if (node.dataset.spd) html += `<span>Tempo</span><b>${Number(node.dataset.spd).toLocaleString("de-DE")} km/h</b>`;
    }
    if (node.dataset.mag) html += `<span>Stärke</span><b>M ${node.dataset.mag}</b>`;
    if (node.dataset.zeit) { const d = new Date(node.dataset.zeit); if (!isNaN(d)) html += `<span>Stand</span><b>${d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</b>`; }
    live.innerHTML = html;
  }
  function showMarkerCard(node) {
    clearInterval(markerCardTimer); markerCardTimer = null;
    $("lage-markercard")?.remove();
    const [, label] = kindOf(node);
    const titel = node.dataset.titel || node.querySelector("title")?.textContent || label;
    const link = node.dataset.link || "";
    const lat = +node.dataset.lat, lon = +node.dataset.lon;
    const isSat = node.classList.contains("sat");
    const card = document.createElement("div");
    card.id = "lage-markercard"; card.className = "lage-shipcard";
    card.innerHTML = `<button class="ship-x" title="Schließen">✕</button>
      <div class="mc-type">${label}${isSat ? ' · <span class="mc-dot">● live</span>' : ""}</div>
      <div class="mc-title">${escapeHtml(titel)}</div>
      <div class="mc-rows"><span>Ort</span><b class="mc-ort">${escapeHtml(nearestCountry(lon, lat) || "wird ermittelt…")}</b></div>
      <div class="mc-rows mc-live"></div>
      ${link ? `<a class="chip" href="${encodeURI(link)}" target="_blank" rel="noopener">Mehr dazu</a>` : ""}`;
    $("lage")?.append(card);
    fillLive(card, node);
    card.querySelector(".ship-x").addEventListener("click", () => { clearInterval(markerCardTimer); markerCardTimer = null; card.remove(); });
    // Genauen Ort (Stadt/Land) live nachladen
    reverseGeo(lat, lon).then((ort) => { const b = card.querySelector(".mc-ort"); if (b && ort) b.textContent = ort; });
    // Satelliten: Position/Höhe/Tempo laufend aktualisieren
    if (isSat) markerCardTimer = setInterval(() => { if (!document.body.contains(card)) { clearInterval(markerCardTimer); return; } fillLive(card, node); }, 2000);
  }

  // ---------- Ein Land ----------
  async function select(id) {
    selected = id;
    showSide(true);
    document.querySelectorAll(".lage-region-tab.active").forEach((b) => b.classList.remove("active"));
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
        <div id="lage-info" class="lage-info"></div>
        <div id="lage-assess" class="lage-assess">
          <button id="lage-assess-btn" class="chip">Friday, schätz die Lage ein</button>
        </div>
        ${c ? satBlock(c.lon, c.lat, c.name) : ""}
        <div id="lage-video" class="lage-video-wrap"></div>
        <div id="lage-media" class="lage-media"><div class="lage-fotos lage-skeleton"><span></span><span></span><span></span></div></div>
        <ul class="lage-news">${items}</ul>`;
      $("lage-assess-btn").addEventListener("click", () => assess(id));
      box.querySelector(".lage-satview")?.addEventListener("click", () => { if (c) openSat(c.lon, c.lat, 6, c.name); });
      loadInfo(id);
      loadMedia(id);
      loadShipsFor({ near: `${c?.lon},${c?.lat}` });
      loadPlanesFor({ near: `${c?.lon},${c?.lat}` });
    } catch (err) {
      box.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    }
  }

  // Echte Bilder aus aktuellen Nachrichten (GDELT).
  async function loadNewsImages(id) {
    const wrap = $("lage-newsimg");
    if (!wrap) return;
    try {
      const imgs = await (await api(`/api/lage/${id}/nachrichten-bilder`)).json();
      if (selected !== id || !wrap.isConnected) return;
      wrap.classList.remove("lage-skeleton");
      if (!Array.isArray(imgs) || !imgs.length) { wrap.remove(); return; }
      wrap.innerHTML = imgs.slice(0, 9).map((f) =>
        `<a href="${escapeHtml(f.seite || f.bild)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(f.titel)}${f.quelle ? " · " + escapeHtml(f.quelle) : ""}">
           <img loading="lazy" src="${escapeHtml(f.bild)}" alt="${escapeHtml(f.titel)}" onerror="this.closest('a').remove()"></a>`).join("");
    } catch {
      wrap.remove();
    }
  }

  // Steckbrief zum Land (Flagge, Hauptstadt, Einwohner, Währung, Luft) – alles kostenlos.
  async function loadInfo(id) {
    const wrap = $("lage-info");
    if (!wrap) return;
    try {
      const i = await (await api(`/api/lage/${id}/info`)).json();
      if (selected !== id || !wrap.isConnected || i.error) return;
      // Flagge neben den Ländernamen in die Überschrift.
      const h = $("lage-land");
      if (h && i.flagge && !h.querySelector(".lage-flag")) h.insertAdjacentHTML("afterbegin", `<span class="lage-flag">${escapeHtml(i.flagge)}</span> `);
      // Eine schlichte Zeile statt Kästchen.
      const teile = [];
      if (i.hauptstadt) teile.push(escapeHtml(i.hauptstadt));
      if (i.einwohner) teile.push(`${(i.einwohner / 1e6).toFixed(1).replace(".", ",")} Mio.`);
      if (i.waehrung) teile.push(escapeHtml(i.waehrung));
      if (i.luft && i.luft.luftqualitaet_index != null) teile.push(`Luft ${escapeHtml(i.luft.bewertung)}`);
      wrap.textContent = teile.join("  ·  ");
    } catch { wrap.textContent = ""; }
  }

  // Öffentliche Kameras/Videos als Links + Fotos als Rückfall, falls keine Nachrichtenbilder.
  async function loadMedia(id) {
    const wrap = $("lage-media");
    if (!wrap) return;
    try {
      const m = await (await api(`/api/lage/${id}/medien`)).json();
      if (selected !== id || !wrap.isConnected) return;
      // Mehrere aktuelle Videos als anklickbare Vorschau (öffnen das echte Video).
      const vids = (m.videos && m.videos.length ? m.videos : (m.video ? [m.video] : []));
      const vbox = $("lage-video");
      if (vbox) {
        // Echte Live-Kamera (Windy) automatisch, darunter aktuelle Videos (erstes spielt automatisch).
        let html = "";
        if (m.webcam && m.webcam.embed) {
          html += `<div class="lage-player livecam">
            <iframe src="${escapeHtml(m.webcam.embed)}" title="Live-Kamera" allow="autoplay; fullscreen" loading="lazy"></iframe>
            <span class="vlabel">📹 Live-Kamera · ${escapeHtml(m.webcam.titel || "")}</span></div>`;
        }
        if (vids.length) {
          const first = vids[0], rest = vids.slice(1);
          html += `<div class="lage-player">
              <iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(first)}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1" title="Video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>
            </div>
            ${rest.length ? `<div class="lage-videos">${rest.map((vid) =>
              `<a class="lage-video" href="https://www.youtube.com/watch?v=${encodeURIComponent(vid)}" target="_blank" rel="noopener noreferrer" title="Video ansehen">
                 <img loading="lazy" src="https://img.youtube.com/vi/${encodeURIComponent(vid)}/hqdefault.jpg" alt="Video" onerror="this.closest('a').remove()">
                 <span class="play">▶</span></a>`).join("")}</div>` : ""}`;
        }
        vbox.innerHTML = html;
      }
      wrap.innerHTML = `
        <div class="lage-cams">
          <a class="chip" href="${escapeHtml(m.nachrichten_videos)}" target="_blank" rel="noopener noreferrer">📺 Mehr Videos</a>
        </div>
        <div id="lage-images" class="lage-fotos lage-skeleton"><span></span><span></span><span></span></div>`;
      loadImages(id, m.fotos || []);
    } catch {
      wrap.innerHTML = "";
    }
  }

  // Aktuelle Bilder: zuerst Nachrichtenbilder (GDELT), sonst allgemeine Fotos (Openverse).
  function imgHtml(list, news) {
    return list.map((f) => {
      const bild = news ? f.bild : (f.bild);
      const seite = f.seite || f.bild;
      const titel = f.titel || "";
      return `<a href="${escapeHtml(seite)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(titel)}">
        <img loading="lazy" src="${escapeHtml(bild)}" alt="${escapeHtml(titel)}" onerror="this.closest('a').remove()"></a>`;
    }).join("");
  }
  async function loadImages(id, fallback) {
    const wrap = $("lage-images");
    if (!wrap) return;
    let news = [];
    try { news = await (await api(`/api/lage/${id}/nachrichten-bilder`)).json(); } catch { /* optional */ }
    if (selected !== id || !wrap.isConnected) return;
    wrap.classList.remove("lage-skeleton");
    const list = Array.isArray(news) && news.length ? news.slice(0, 9) : fallback.slice(0, 9);
    if (!list.length) { wrap.remove(); return; }
    wrap.innerHTML = imgHtml(list, Array.isArray(news) && news.length);
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
      // Nur vorlesen: Text nur zeigen, wenn Vorlesen aus ist.
      const voiceOn = $("voice-toggle")?.checked;
      box.innerHTML = `<span class="rating ${data.bewertung}">${label}</span>${voiceOn ? '<span class="speaking-note">🔊 Friday spricht</span>' : `<p>${escapeHtml(data.zusammenfassung)}</p>`}`;
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
