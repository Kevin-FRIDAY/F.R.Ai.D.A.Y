// F.R.Ai.D.A.Y Werkstatt: baut einen 3D-Bauplan Schritt für Schritt als Hologramm auf und erklärt ihn.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { api, say, escapeHtml } = window.Friday;
  const box = $("werkstatt");
  if (!box || !window.THREE) return;
  const THREE = window.THREE;

  const COLORS = { cyan: 0x4fd8ff, weiss: 0xf2f6ff, rot: 0xff4d5e, orange: 0xff8a1e, gelb: 0xffd84d, gruen: 0x4dffa6, blau: 0x3d7dff, lila: 0xb57bff, grau: 0x9aa4b2, schwarz: 0x2a2f38, glas: 0x9fe8ff, braun: 0xc08850, hellorange: 0xffc078 };
  // Hausmodus: wie durchsichtig die Ebenen im Hologramm sind (viele Wände sollen nicht alles überstrahlen).
  const ALPHA = { struktur: 0.05, raeume: 0.1 };
  const EDGE = { struktur: 0.22, raeume: 0.18, moebel: 0.5 };
  let renderer, scene, camera, root, grid, raf = 0, plan = null, built = [], running = 0;
  let solid = (() => { try { return localStorage.getItem("friday_werkstatt_massiv") === "1"; } catch { return false; } })();
  let yaw = 0.7, pitch = 0.42, dist = 9, target = new THREE.Vector3(0, 0.8, 0), autoSpin = true;

  // ---------- Szene ----------
  function init() {
    if (renderer) return;
    const canvas = $("werkstatt-canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02060b);
    scene.fog = new THREE.Fog(0x02060b, 14, 46);
    camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(6, 10, 4);
    scene.add(sun);
    grid = new THREE.GridHelper(80, 80, 0x4fd8ff, 0x0f5a75);
    grid.material.transparent = true; grid.material.opacity = 0.55;
    scene.add(grid);
    root = new THREE.Group();
    scene.add(root);
    enableOrbit(canvas);
    window.addEventListener("resize", resize);
    resize();
  }

  function resize() {
    if (!renderer) return;
    const c = renderer.domElement, w = c.clientWidth || 800, h = c.clientHeight || 500;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function enableOrbit(el) {
    let drag = null;
    el.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; autoSpin = false; el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      yaw = drag.yaw - (e.clientX - drag.x) * 0.006;
      pitch = Math.max(0.05, Math.min(1.45, drag.pitch + (e.clientY - drag.y) * 0.005));
    });
    el.addEventListener("pointerup", () => { drag = null; });
    el.addEventListener("wheel", (e) => { e.preventDefault(); dist = Math.max(2, Math.min(80, dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (autoSpin) yaw += 0.0025;
    // Nebel mit dem Abstand mitziehen, sonst verschwinden große Modelle (Häuser) im Dunst.
    scene.fog.near = Math.max(14, dist * 0.9); scene.fog.far = Math.max(46, dist * 3);
    camera.position.set(target.x + dist * Math.cos(pitch) * Math.cos(yaw), target.y + dist * Math.sin(pitch), target.z + dist * Math.cos(pitch) * Math.sin(yaw));
    camera.lookAt(target);
    // Teile fahren beim Erscheinen von unten ein und leuchten kurz auf.
    for (const b of built) {
      const k = Math.min(1, (t - b.born) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      b.obj.scale.copy(b.base).multiplyScalar(0.001 + e * 0.999);
      b.obj.position.y = b.y + (1 - e) * 0.6;
      if (b.edge) b.edge.material.opacity = b.edgeBase + (1 - k) * (1 - b.edgeBase);
    }
    renderer.render(scene, camera);
  }

  // ---------- Teile ----------
  function labelSprite(text, color) {
    const c = document.createElement("canvas");
    const g = c.getContext("2d");
    const font = "600 44px ui-monospace, Menlo, monospace";
    g.font = font;
    const w = Math.ceil(g.measureText(text).width) + 40;
    c.width = w; c.height = 70;
    g.font = font;
    g.fillStyle = "rgba(2,10,20,.72)"; g.fillRect(0, 0, w, 70);
    g.strokeStyle = color; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, 67);
    g.fillStyle = color; g.textBaseline = "middle"; g.fillText(text, 20, 37);
    const tex = new THREE.CanvasTexture(c);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    s.scale.set((w / 70) * 0.28, 0.28, 1);
    s.renderOrder = 10;
    return s;
  }

  function makePart(p) {
    const hex = COLORS[p.farbe] ?? COLORS.cyan;
    const css = `#${hex.toString(16).padStart(6, "0")}`;
    if (p.form === "text") {
      const s = labelSprite(String(p.text || ""), css);
      s.position.fromArray(p.pos || [0, 1, 0]);
      if (p.ebene && haus) { // Haus: Schilder mit der Hausgröße wachsen lassen
        const k = Math.max(1, Math.min(2.4, Math.max(haus.masse.breite, haus.masse.tiefe) / 11));
        s.scale.multiplyScalar(p.nurEtage ? Math.max(0.7, k * 0.7) : k);
      }
      return { obj: s };
    }
    let geo;
    const v = (a, i, d) => (Array.isArray(a) && Number.isFinite(a[i]) ? Math.max(0.005, a[i]) : d);
    if (p.form === "box") geo = new THREE.BoxGeometry(v(p.groesse, 0, 1), v(p.groesse, 1, 1), v(p.groesse, 2, 1));
    else if (p.form === "kugel") geo = new THREE.SphereGeometry(p.radius || 0.5, 20, 14);
    else if (p.form === "zylinder") {
      geo = new THREE.CylinderGeometry(p.radius || 0.3, p.radius || 0.3, p.hoehe || 1, 28);
      if (p.achse === "x") geo.rotateZ(Math.PI / 2);
      if (p.achse === "z") geo.rotateX(Math.PI / 2);
    } else if (p.form === "rohr" && Array.isArray(p.punkte) && p.punkte.length >= 2) {
      const path = new THREE.CurvePath();
      for (let i = 1; i < p.punkte.length; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(...p.punkte[i - 1]), new THREE.Vector3(...p.punkte[i])));
      geo = new THREE.TubeGeometry(path, Math.max(8, p.punkte.length * 6), (p.dicke || 0.05) / 2, 8, false);
    } else return null;

    const group = new THREE.Group();
    const glass = p.farbe === "glas";
    const fill = new THREE.Mesh(geo, solid
      ? new THREE.MeshStandardMaterial({ color: hex, metalness: glass ? 0.1 : 0.35, roughness: glass ? 0.05 : 0.45, transparent: glass, opacity: glass ? 0.45 : 1 })
      : new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: p.form === "rohr" || p.form === "kugel" ? 0.85 : glass ? 0.08 : (ALPHA[p.ebene] ?? 0.14), depthWrite: false, blending: THREE.AdditiveBlending }));
    group.add(fill);
    let edge = null;
    if (p.form !== "rohr" && p.form !== "kugel") {
      edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 1 }));
      edge.userData.base = EDGE[p.ebene] ?? 0.35;
      group.add(edge);
    }
    const pos = p.form === "rohr" ? [0, 0, 0] : (p.pos || [0, 0.5, 0]);
    group.position.fromArray(pos);
    if (Array.isArray(p.drehung)) group.rotation.set(...p.drehung.map((d) => (Number(d) || 0) * Math.PI / 180));
    return { obj: group, edge, edgeBase: edge ? edge.userData.base : 0.35 };
  }

  function addParts(teile, t0) {
    const gap = Math.min(35, 4000 / Math.max(1, teile.length)); // große Bauabschnitte schneller einblenden
    teile.forEach((p, i) => {
      const part = makePart(p);
      if (!part) return;
      root.add(part.obj);
      built.push({ edgeBase: 0.35, ...part, y: part.obj.position.y, base: part.obj.scale.clone(), born: t0 + i * gap, src: p });
    });
    applyHaus();
  }

  // Kamera an die Größe des Modells anpassen.
  function frameModel() {
    const bb = new THREE.Box3();
    for (const b of built) if (b.obj.visible && b.src.form !== "text") bb.expandByObject(b.obj);
    if (bb.isEmpty()) return;
    const size = bb.getSize(new THREE.Vector3()), center = bb.getCenter(new THREE.Vector3());
    target.copy(center);
    dist = Math.max(4, Math.max(size.x, size.y, size.z) * 1.9);
  }

  // Gesamtmaße als Maßlinien mit Beschriftung.
  function addDimensions() {
    const bb = new THREE.Box3();
    // Beim Haus zählen nur Rohbau-Teile (nicht Wärmepumpe im Garten oder Kanal-Anschluss).
    for (const b of built) if (b.src.form !== "text" && (!b.src.ebene || b.src.ebene === "struktur")) bb.expandByObject(b.obj);
    if (bb.isEmpty()) return;
    const fmt = (m) => `${m.toLocaleString("de-DE", { maximumFractionDigits: 2 })} m`;
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const dims = new THREE.Group();
    const line = (a, b, text, at) => {
      dims.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mat));
      const s = labelSprite(text, "#ffffff"); s.position.copy(at); dims.add(s);
    };
    const { min, max } = bb, off = 0.4;
    line(new THREE.Vector3(min.x, 0.02, max.z + off), new THREE.Vector3(max.x, 0.02, max.z + off), fmt(max.x - min.x), new THREE.Vector3((min.x + max.x) / 2, 0.25, max.z + off));
    line(new THREE.Vector3(max.x + off, 0.02, min.z), new THREE.Vector3(max.x + off, 0.02, max.z), fmt(max.z - min.z), new THREE.Vector3(max.x + off, 0.25, (min.z + max.z) / 2));
    line(new THREE.Vector3(max.x + off, 0, min.z - off), new THREE.Vector3(max.x + off, max.y, min.z - off), fmt(max.y), new THREE.Vector3(max.x + off, max.y / 2, min.z - off - 0.3));
    dims.name = "masse";
    root.add(dims);
  }

  // ---------- Ablauf ----------
  function setCaption(text) { $("werkstatt-caption").textContent = text || ""; }
  function setState(text, cls = "") { const s = $("werkstatt-state"); s.textContent = text; s.className = `werkstatt-state ${cls}`; }

  function showFacts(p) {
    $("werkstatt-title").textContent = (p.titel || "Werkstatt").toUpperCase();
    $("werkstatt-facts").innerHTML = (p.kennzahlen || []).map((k) => `<li><small>${escapeHtml(k.label)}</small><b>${escapeHtml(k.wert)}</b></li>`).join("");
  }

  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  async function speak(text) {
    setCaption(text);
    const voiceOn = $("voice-toggle")?.checked;
    if (voiceOn) await say(text); else await pause(Math.min(6000, 1200 + text.length * 45));
  }

  async function play(entry) {
    const run = ++running;
    const p = entry.plan;
    if (!entry.erweiterung || !plan) {
      root.clear(); built = []; plan = { ...p, schritte: [...p.schritte] }; autoSpin = true;
      setupHaus(p.haus || null);
    } else {
      root.getObjectByName("masse")?.removeFromParent();
      plan.schritte.push(...p.schritte);
      if (p.kennzahlen?.length) plan.kennzahlen = p.kennzahlen;
    }
    showFacts(plan);
    setState("BAUT", "busy");
    if (p.einleitung) await speak(p.einleitung);
    for (const [i, s] of p.schritte.entries()) {
      if (run !== running) return;
      $("werkstatt-step").textContent = `ABSCHNITT ${i + 1} / ${p.schritte.length}`;
      addParts(s.teile, performance.now());
      frameModel();
      await speak(s.sagen);
    }
    if (run !== running) return;
    addDimensions();
    frameModel();
    $("werkstatt-step").textContent = `${built.filter((b) => b.src.form !== "text").length} TEILE`;
    setState("FERTIG", "done");
    if (p.fazit) await speak(p.fazit);
  }

  function rebuildMaterials() {
    if (!plan) return;
    const steps = plan.schritte;
    root.clear(); built = [];
    steps.forEach((s) => addParts(s.teile, performance.now() - 2000));
    addDimensions();
    applyHaus();
  }

  async function request(wunsch, { neu = false } = {}) {
    wunsch = String(wunsch || "").trim();
    if (!wunsch) return;
    const erweitern = !neu && $("werkstatt-extend").checked && plan;
    setState("PLANT …", "busy");
    setCaption(erweitern ? "Ich ergänze das Modell …" : "Ich entwerfe den Bauplan …");
    try {
      const res = await api("/api/werkstatt", { method: "POST", body: JSON.stringify({ wunsch, basis: erweitern ? { titel: plan.titel, kennzahlen: plan.kennzahlen, schritte: plan.schritte.map((s) => ({ sagen: s.sagen })) } : null }) });
      const r = await res.json();
      if (!r.ok) { setState("FEHLER", "error"); setCaption(r.error || "Das hat nicht geklappt."); return; }
      lastId = r.id;
      play(r);
    } catch { setState("FEHLER", "error"); setCaption("Friday ist gerade nicht erreichbar."); }
  }

  // ---------- Öffnen / Schließen ----------
  let lastId = 0;
  function open() {
    box.classList.remove("hidden");
    const sw = $("werkstatt-solid"); if (sw) sw.checked = solid;
    init();
    resize();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function close() {
    box.classList.add("hidden");
    cancelAnimationFrame(raf);
    running++; // laufende Ansage beenden
    try { speechSynthesis?.cancel(); } catch { /* egal */ }
  }

  $("werkstatt-open")?.addEventListener("click", open);
  $("werkstatt-x")?.addEventListener("click", close);
  $("werkstatt-form")?.addEventListener("submit", (e) => { e.preventDefault(); const t = $("werkstatt-input"); request(t.value); t.value = ""; });
  $("werkstatt-solid")?.addEventListener("change", (e) => { solid = e.target.checked; rebuildMaterials(); });
  $("werkstatt-beispiel")?.addEventListener("click", () => request("Mehrfamilienhaus mit 4 Etagen und 8 Wohnungen", { neu: true }));

  // ---------- Hausmodus: Etagen, Ebenen, Schnitt, Grundriss ----------
  let haus = null, etageSel = "alle", ebeneOn = {}, schnittOn = false;
  const clip = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const COLOR_CSS = (name) => `#${(COLORS[name] ?? COLORS.cyan).toString(16).padStart(6, "0")}`;
  const etagenLabel = (nr) => (nr === "alle" ? "Alle" : nr === haus?.dach ? "Dach" : haus?.etagen.find((e) => e.nr === nr)?.kurz || String(nr));

  function setupHaus(h) {
    haus = h;
    const panel = $("werkstatt-haus");
    $("werkstatt-plan")?.classList.add("hidden");
    $("wh-plan")?.classList.remove("on");
    if (!h) { panel?.classList.add("hidden"); box.classList.remove("ist-haus"); schnittOn = false; return; }
    etageSel = "alle"; schnittOn = false;
    ebeneOn = Object.fromEntries(h.ebenen.map((e) => [e.id, true]));
    if (window.innerWidth < 700) panel.open = false;
    box.classList.add("ist-haus");
    $("wh-schnitt").checked = false; $("wh-schnitt-pos").disabled = true; $("wh-schnitt-pos").value = 50;
    $("wh-ebenen").innerHTML = h.ebenen.map((e) => `<label style="color:${COLOR_CSS(e.farbe)}"><input type="checkbox" data-ebene="${escapeHtml(e.id)}" checked><i></i><span style="color:#fff">${escapeHtml(e.name)}</span></label>`).join("");
    const nrs = ["alle", ...h.etagen.map((e) => e.nr), h.dach];
    $("wh-etagen").innerHTML = nrs.map((nr) => `<button type="button" data-etage="${nr}">${escapeHtml(etagenLabel(nr))}</button>`).join("");
    markEtage();
    panel.classList.remove("hidden");
  }
  function markEtage() {
    $("wh-etagen")?.querySelectorAll("button").forEach((b) => b.classList.toggle("on", String(etageSel) === b.dataset.etage));
  }

  // Sichtbarkeit je Teil: Ebene an/aus, gewählte Etage, Raum-Beschriftungen nur in der Einzel-Etage.
  function applyHaus() {
    if (!root) return;
    const planes = schnittOn ? [clip] : null;
    for (const b of built) {
      const s = b.src;
      let vis = true;
      if (haus) {
        if (s.ebene && ebeneOn[s.ebene] === false) vis = false;
        if (etageSel === "alle") { if (s.nurEtage) vis = false; }
        else if (s.etage !== undefined && s.etage !== etageSel) vis = false;
      }
      b.obj.visible = vis;
      b.obj.traverse((o) => { if (o.material && o.material.clippingPlanes !== planes) { o.material.clippingPlanes = planes; o.material.needsUpdate = true; } });
    }
    const masse = root.getObjectByName("masse");
    if (masse) masse.visible = !haus || etageSel === "alle";
  }

  function updateClip() {
    if (!haus) return;
    const t = Number($("wh-schnitt-pos").value) / 100;
    const T = haus.masse.tiefe;
    // Alles vor der Schnittebene (Straßenseite) wird ausgeblendet.
    clip.constant = -(-T / 2 - 0.5 + t * (T + 1));
  }

  function focusEtage() {
    if (!haus) return;
    if (etageSel === "alle") { frameModel(); return; }
    const e = haus.etagen.find((x) => x.nr === etageSel);
    const y = e ? e.y : haus.dach * 3;
    target.set(0, y + 1, 0);
    dist = Math.max(8, Math.max(haus.masse.breite, haus.masse.tiefe) * 1.25);
  }

  const fl = (v) => Number(v).toLocaleString("de-DE", { maximumFractionDigits: 1 });
  function zeigeGrundriss() {
    if (!haus) return;
    const nr = etageSel === "alle" || etageSel === haus.dach ? 0 : etageSel;
    const e = haus.etagen.find((x) => x.nr === nr) || haus.etagen[0];
    const B = haus.masse.breite, T = haus.masse.tiefe, pad = 0.8;
    const FILL = { wohnen: "#123d52", essen: "#123d52", schlafen: "#2a2350", kind: "#203a2a", kueche: "#3b2a12", bad: "#0f3a4a", wc: "#0f3a4a", flur: "#1a2430", garderobe: "#1a2430", abstell: "#1d1d26", treppenhaus: "#262626", keller: "#1d1d26", technik: "#3b2412" };
    // Blick von oben: Straßenseite (vorne) unten.
    const Y = (z) => T / 2 - z;
    let svg = `<svg viewBox="${-B / 2 - pad} ${-pad} ${B + 2 * pad} ${T + 2 * pad + 0.6}" preserveAspectRatio="xMidYMid meet">`;
    svg += `<rect x="${-B / 2}" y="0" width="${B}" height="${T}" fill="none" stroke="#4fd8ff" stroke-width=".3"/>`;
    for (const r of e.raeume) {
      const [x0, z0, x1, z1] = r.rect, w = x1 - x0, d = z1 - z0;
      const fs = Math.min(Math.max(B * 0.017, 0.3), w / 6.5, d / 3);
      svg += `<rect class="raum" x="${x0}" y="${Y(z1)}" width="${w}" height="${d}" fill="${FILL[r.typ] || "#16202a"}"/>`;
      svg += `<text x="${x0 + w / 2}" y="${Y(z1) + d / 2 - fs * 0.6}" font-size="${fs}">${escapeHtml(r.name)}</text>`;
      svg += `<text x="${x0 + w / 2}" y="${Y(z1) + d / 2 + fs * 0.7}" font-size="${fs * 0.9}" fill="#8fc7de">${fl(r.flaeche)} m²</text>`;
    }
    for (const w of e.wohnungen) {
      const [x0, z0, x1, z1] = w.rect;
      svg += `<rect x="${x0}" y="${Y(z1)}" width="${x1 - x0}" height="${z1 - z0}" fill="none" stroke="#ff8a1e" stroke-width=".12" stroke-dasharray=".4 .25"/>`;
    }
    for (const [sx, sz] of e.schaechte || []) svg += `<circle cx="${sx}" cy="${Y(sz)}" r=".22" fill="#3d7dff" stroke="#fff" stroke-width=".05"><title>Installationsschacht</title></circle>`;
    svg += `<text x="0" y="${T + pad * 0.6}" font-size="${Math.min(0.42, B * 0.016)}" fill="#8fc7de">▼ Straßenseite · ${String(B).replace(".", ",")} × ${String(T).replace(".", ",")} m · blauer Punkt = Installationsschacht</text></svg>`;
    $("wp-svg").innerHTML = svg;
    $("wp-titel").textContent = `GRUNDRISS · ${e.name.toUpperCase()}`;
    const list = e.wohnungen.length ? e.wohnungen.map((w) => `<li><b>${escapeHtml(w.name)}</b><br>${w.zimmer} Zimmer · ${fl(w.flaeche)} m²</li>`) : e.raeume.map((r) => `<li><b>${escapeHtml(r.name)}</b><br>${fl(r.flaeche)} m²</li>`);
    $("wp-liste").innerHTML = list.join("");
    $("werkstatt-plan").classList.remove("hidden");
    $("wh-plan").classList.add("on");
  }

  $("wh-etagen")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-etage]");
    if (!b) return;
    etageSel = b.dataset.etage === "alle" ? "alle" : Number(b.dataset.etage);
    markEtage(); applyHaus(); focusEtage();
    if (!$("werkstatt-plan").classList.contains("hidden")) zeigeGrundriss();
  });
  $("wh-ebenen")?.addEventListener("change", (e) => {
    const id = e.target?.dataset?.ebene;
    if (!id) return;
    ebeneOn[id] = e.target.checked; applyHaus();
  });
  $("wh-schnitt")?.addEventListener("change", (e) => {
    schnittOn = e.target.checked; $("wh-schnitt-pos").disabled = !schnittOn; updateClip(); applyHaus();
    if (schnittOn) { autoSpin = false; yaw = -Math.PI / 2 + 0.55; pitch = 0.35; } // von vorn auf die Schnittfläche schauen
  });
  $("wh-schnitt-pos")?.addEventListener("input", updateClip);
  $("wh-oben")?.addEventListener("click", () => { autoSpin = false; pitch = 1.45; yaw = -Math.PI / 2; focusEtage(); });
  $("wh-3d")?.addEventListener("click", () => { autoSpin = false; pitch = 0.42; yaw = 0.7; focusEtage(); });
  $("wh-plan")?.addEventListener("click", () => { if ($("werkstatt-plan").classList.contains("hidden")) zeigeGrundriss(); else { $("werkstatt-plan").classList.add("hidden"); $("wh-plan").classList.remove("on"); } });
  $("wp-x")?.addEventListener("click", () => { $("werkstatt-plan").classList.add("hidden"); $("wh-plan").classList.remove("on"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !box.classList.contains("hidden")) close(); });

  // Wenn Friday im Chat etwas gebaut hat: Werkstatt öffnen und abspielen.
  window.FridayWerkstatt = {
    async showLatest() {
      try {
        const r = await (await api("/api/werkstatt/latest")).json();
        if (!r || !r.id || r.id === lastId) return;
        lastId = r.id;
        open();
        play(r);
      } catch { /* egal */ }
    },
    play(entry) { open(); play(entry); },
  };
})();
