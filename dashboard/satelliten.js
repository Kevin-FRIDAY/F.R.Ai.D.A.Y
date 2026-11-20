// F.R.Ai.D.A.Y Weltgeschehen: ALLE öffentlich gelisteten aktiven Satelliten (ca. 16.000) live auf dem Globus.
// Bahndaten: CelesTrak (über den Friday-Server). Positionen rechnet ein Hintergrund-Thread (sat-worker.js),
// gezeichnet wird auf einer Leinwand über dem Globus – so bleibt auch das iPhone flüssig.
// Antippen -> Steckbrief (Bahn, Höhe, Tempo, Masse, Mission, Betreiber, Start …) und die Umlaufbahn als Linie.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api || ((p, o) => fetch(p, o));
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const G = () => window.FridayGlobus;
  const W = 960, H = 500, RAD = Math.PI / 180;

  const FARBEN = {
    station: "#ffffff", starlink: "#6fb6ff", oneweb: "#a48bff", komm: "#ffb347", navi: "#46e0a0",
    wetter: "#4fd8ff", erde: "#c3e88d", wissen: "#ff7ad9", amateur: "#e8d66a", militaer: "#ff5d6c", sonst: "#a9b2ba",
  };
  const GROESSE = { station: 4.2, starlink: 1.3, oneweb: 1.6 }; // Punktgröße in CSS-Pixeln, sonst 2

  // ---------- Zustand ----------
  let gruppen = [];          // [{id, name, info}]
  let sats = [];             // [{norad, name, gruppe, l1, l2}]
  let gIndex = null;         // Uint8Array: Gruppen-Nummer je Satellit
  let pos = null;            // Float32Array: lat, lon, alt, tempo je Satellit
  let posZeit = 0;
  let stand = "";
  let worker = null, workerBereit = false, rechnet = false;
  let tickTimer = null, ladeVersprechen = null;
  let aktiv = new Set();     // sichtbare Gruppen
  let gewaehlt = -1;         // Index des angetippten Satelliten
  let bahn = null;           // [[lat, lon, alt]]
  let folgen = false;
  let treffer = null;        // Set von Indizes aus der Suche (hervorgehoben)
  let fehler = "";
  // Bildschirm-Positionen vom letzten Zeichnen (für das Antippen)
  let sx = null, sy = null, sichtbar = null;
  // Einheits-Vektoren + Abstand je Satellit (einmal pro Positions-Update, nicht pro Bild)
  let ux = null, uy = null, uz = null, ur = null;
  function vorbereiten() {
    const n = sats.length;
    if (!ux || ux.length !== n) { ux = new Float32Array(n); uy = new Float32Array(n); uz = new Float32Array(n); ur = new Float32Array(n); }
    for (let i = 0; i < n; i++) {
      const lat = pos[i * 4];
      if (lat !== lat) { ur[i] = 0; continue; }
      const la = lat * RAD, lo = pos[i * 4 + 1] * RAD, cla = Math.cos(la);
      ux[i] = cla * Math.cos(lo); uy[i] = cla * Math.sin(lo); uz[i] = Math.sin(la);
      ur[i] = radiusFaktor(pos[i * 4 + 2]);
    }
  }

  // ---------- Einstellungen ----------
  function ladeFilter() {
    try {
      const roh = localStorage.getItem("friday_sat_gruppen");
      if (roh) return new Set(JSON.parse(roh));
    } catch { /* Standard */ }
    return null;
  }
  function speichereFilter() {
    try { localStorage.setItem("friday_sat_gruppen", JSON.stringify([...aktiv])); } catch { /* egal */ }
  }
  const an = () => Boolean($("lage-sats-on")?.checked);
  const offen = () => !$("lage")?.classList.contains("hidden");
  // v1.118.0: Friday im Hintergrund (html.friday-ruhe) rechnet genauso sparsam wie der flüssige Modus
  const fluessig = () => { const c = document.documentElement.classList; return c.contains("perf-fluessig") || c.contains("friday-ruhe"); };

  // ---------- Leinwand über dem Globus ----------
  let canvas = null, ctx = null, dpr = 1;
  function leinwand() {
    if (canvas) return canvas;
    const svg = $("lage-map");
    if (!svg) return null;
    canvas = document.createElement("canvas");
    canvas.id = "lage-satcanvas";
    canvas.className = "lage-satcanvas";
    canvas.setAttribute("aria-hidden", "true");
    svg.after(canvas);
    ctx = canvas.getContext("2d");
    const passe = () => {
      dpr = Math.min(window.devicePixelRatio || 1, fluessig() ? 1.5 : 2);
      canvas.style.left = svg.offsetLeft + "px";
      canvas.style.top = svg.offsetTop + "px";
      canvas.style.width = svg.clientWidth + "px";
      canvas.style.height = svg.clientHeight + "px";
      canvas.width = Math.max(1, Math.round(svg.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(svg.clientHeight * dpr));
      zeichneBald();
    };
    if (window.ResizeObserver) new ResizeObserver(passe).observe(svg);
    window.addEventListener("resize", passe);
    passe();
    return canvas;
  }

  // viewBox (960×500, "meet") -> Leinwand-Pixel
  function abbildung() {
    const w = canvas.width, h = canvas.height;
    const s = Math.min(w / W, h / H);
    return { s, ox: (w - W * s) / 2, oy: (h - H * s) / 2 };
  }

  // Höhe über der Erde -> Abstand vom Globus (verdichtet, damit auch GPS/GEO sichtbar bleiben)
  const radiusFaktor = (alt) => 1 + 0.035 * Math.log2(1 + Math.max(0, alt) / 400);

  // ---------- Zeichnen ----------
  let zeichnenRaf = 0;
  function zeichneBald() {
    if (zeichnenRaf) return;
    zeichnenRaf = requestAnimationFrame(() => { zeichnenRaf = 0; zeichne(); });
  }

  function zeichne() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const proj = G()?.projektion?.();
    if (!an() || !offen() || !pos || !ur || !proj) return;
    const [l0, p0] = proj.rotate();
    const k = proj.scale(), [tx, ty] = proj.translate();
    const { s, ox, oy } = abbildung();
    const cL = Math.cos(l0 * RAD), sL = Math.sin(l0 * RAD), cP = Math.cos(p0 * RAD), sP = Math.sin(p0 * RAD);
    const n = sats.length;
    if (!sx || sx.length !== n) { sx = new Float32Array(n); sy = new Float32Array(n); sichtbar = new Uint8Array(n); }
    const nachGruppe = gruppen.map(() => []);
    const aktivNr = gruppen.map((g) => aktiv.has(g.id));
    let gezeigt = 0;
    for (let i = 0; i < n; i++) {
      sichtbar[i] = 0;
      const gi = gIndex[i];
      if (!aktivNr[gi] && i !== gewaehlt && !(treffer && treffer.has(i))) continue;
      const rf = ur[i];
      if (!rf) continue; // keine Position
      const x0 = ux[i], y0 = uy[i], z0 = uz[i];
      // Drehung wie d3.geoOrthographic().rotate([l0, p0, 0])
      const x = x0 * cL - y0 * sL, y = x0 * sL + y0 * cL;
      const X = x * cP - z0 * sP, Y = y, Z = z0 * cP + x * sP;
      // hinter der Erde und von ihr verdeckt -> unsichtbar
      if (X <= 0 && (Y * Y + Z * Z) * rf * rf < 1.0) continue;
      const px = ox + (tx + k * rf * Y) * s, py = oy + (ty - k * rf * Z) * s;
      if (px < -4 || py < -4 || px > canvas.width + 4 || py > canvas.height + 4) continue;
      sx[i] = px; sy[i] = py; sichtbar[i] = X > 0 ? 2 : 1;
      nachGruppe[gi].push(i);
      gezeigt++;
    }
    // Punkte je Gruppe (eine Farbe pro Durchgang = schnell)
    for (let gi = 0; gi < gruppen.length; gi++) {
      const liste = nachGruppe[gi];
      if (!liste.length) continue;
      const id = gruppen[gi].id;
      const d = (GROESSE[id] || 2) * dpr * (fluessig() ? 0.9 : 1);
      ctx.fillStyle = FARBEN[id] || "#ccc";
      ctx.globalAlpha = id === "starlink" ? 0.75 : 0.95;
      for (const i of liste) {
        const a = sichtbar[i] === 1 ? 0.45 : 1; // hinter dem Rand: blasser
        if (a !== 1) { ctx.globalAlpha *= a; ctx.fillRect(sx[i] - d / 2, sy[i] - d / 2, d, d); ctx.globalAlpha /= a; }
        else ctx.fillRect(sx[i] - d / 2, sy[i] - d / 2, d, d);
      }
    }
    ctx.globalAlpha = 1;
    // Suchtreffer: Ringe
    if (treffer && treffer.size && treffer.size <= 400) {
      ctx.strokeStyle = "rgba(255,170,60,.95)"; ctx.lineWidth = 1.2 * dpr;
      for (const i of treffer) if (sichtbar[i]) { ctx.beginPath(); ctx.arc(sx[i], sy[i], 5 * dpr, 0, 7); ctx.stroke(); }
    }
    // Umlaufbahn + gewählter Satellit
    if (gewaehlt >= 0) {
      const farbe = FARBEN[sats[gewaehlt].gruppe] || "#fff";
      if (bahn?.length) zeichneBahn(bahn, farbe, { cL, sL, cP, sP, k, tx, ty, s, ox, oy });
      if (sichtbar[gewaehlt]) {
        const x = sx[gewaehlt], y = sy[gewaehlt];
        ctx.fillStyle = farbe; ctx.beginPath(); ctx.arc(x, y, 3.2 * dpr, 0, 7); ctx.fill();
        ctx.strokeStyle = farbe; ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath(); ctx.arc(x, y, 8 * dpr, 0, 7); ctx.stroke();
        ctx.font = `${11 * dpr}px system-ui, sans-serif`; ctx.fillStyle = "#fff";
        ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 4 * dpr;
        ctx.fillText(sats[gewaehlt].name, x + 10 * dpr, y - 8 * dpr);
        ctx.shadowBlur = 0;
      }
    }
    const cnt = $("cnt-sats");
    if (cnt) cnt.textContent = gezeigt ? ` ${gezeigt.toLocaleString("de-DE")}` : "";
  }

  function zeichneBahn(pts, farbe, m) {
    ctx.strokeStyle = farbe; ctx.lineWidth = 1.4 * dpr; ctx.globalAlpha = 0.85;
    ctx.setLineDash([]);
    ctx.beginPath();
    let offenPfad = false;
    for (const [lat, lon, alt] of pts) {
      const la = lat * RAD, lo = lon * RAD, cla = Math.cos(la);
      const x0 = cla * Math.cos(lo), y0 = cla * Math.sin(lo), z0 = Math.sin(la);
      const x = x0 * m.cL - y0 * m.sL, y = x0 * m.sL + y0 * m.cL;
      const X = x * m.cP - z0 * m.sP, Y = y, Z = z0 * m.cP + x * m.sP;
      const rf = radiusFaktor(alt);
      if (X <= 0 && (Y * Y + Z * Z) * rf * rf < 1.0) { offenPfad = false; continue; }
      const px = m.ox + (m.tx + m.k * rf * Y) * m.s, py = m.oy + (m.ty - m.k * rf * Z) * m.s;
      if (offenPfad) ctx.lineTo(px, py); else { ctx.moveTo(px, py); offenPfad = true; }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---------- Daten ----------
  function laden() {
    if (ladeVersprechen) return ladeVersprechen;
    ladeVersprechen = (async () => {
      setzeStatus("Lade alle Satelliten …");
      const r = await api("/api/satelliten");
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Satelliten nicht erreichbar");
      const d = await r.json();
      gruppen = d.gruppen || [];
      stand = d.stand || "";
      sats = (d.sats || []).map(([norad, name, gruppe, l1, l2]) => ({ norad, name, gruppe, l1, l2, such: String(name).toLowerCase() }));
      const nr = new Map(gruppen.map((g, i) => [g.id, i]));
      gIndex = new Uint8Array(sats.length);
      sats.forEach((x, i) => { gIndex[i] = nr.get(x.gruppe) ?? nr.get("sonst") ?? 0; });
      const gespeichert = ladeFilter();
      aktiv = gespeichert ? new Set([...gespeichert].filter((g) => nr.has(g))) : new Set(gruppen.map((g) => g.id));
      await starteWorker();
      fehler = "";
      baueFilter();
    })().catch((err) => {
      fehler = err.message || String(err);
      setzeStatus("Satelliten gerade nicht erreichbar: " + fehler);
      ladeVersprechen = null;
      throw err;
    });
    return ladeVersprechen;
  }

  function starteWorker() {
    return new Promise((resolve, reject) => {
      try { worker?.terminate(); } catch { /* egal */ }
      worker = new Worker("/sat-worker.js");
      workerBereit = false;
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.typ === "geladen") { workerBereit = true; resolve(); }
        else if (m.typ === "pos") {
          rechnet = false;
          pos = m.pos; posZeit = m.zeit;
          vorbereiten();
          if (folgen && gewaehlt >= 0) folgeJetzt();
          zeichneBald();
          aktualisiereKarte();
        } else if (m.typ === "bahn" && m.i === gewaehlt) { bahn = m.pts; zeichneBald(); }
      };
      worker.onerror = (e) => { reject(new Error(e.message || "Rechen-Thread fehlgeschlagen")); };
      worker.postMessage({ typ: "laden", tle: sats.map((x) => [x.l1, x.l2]) });
    });
  }

  function tick() {
    clearTimeout(tickTimer);
    if (!an() || !offen()) return;
    if (workerBereit && !rechnet && !document.hidden) { rechnet = true; worker.postMessage({ typ: "rechne", zeit: Date.now() }); }
    tickTimer = setTimeout(tick, fluessig() ? 5000 : 2500);
  }

  async function starten() {
    if (!an() || !offen()) return;
    leinwand();
    try { await G()?.bereit?.(); await laden(); } catch { return; }
    if (!an() || !offen()) return;
    tick();
  }
  function stoppen(leeren) {
    clearTimeout(tickTimer); tickTimer = null;
    if (leeren) { ctx?.clearRect(0, 0, canvas.width, canvas.height); karteZu(); const c = $("cnt-sats"); if (c) c.textContent = ""; }
  }

  // ---------- Antippen ----------
  // Antippen: über FridayLeinwand, damit Satelliten, Schiffe und Flugzeuge sich nicht in die Quere kommen.
  let tippBereit = false;
  function antippenEinrichten() {
    if (tippBereit || !window.FridayLeinwand || !$("lage-map")) return;
    tippBereit = true;
    window.FridayLeinwand.registriere({ kandidat: (cx, cy, radiusCss) => {
      if (!an() || !pos || !sx || !canvas) return null;
      const r = canvas.getBoundingClientRect();
      const px = (cx - r.left) * dpr, py = (cy - r.top) * dpr;
      const radius = radiusCss * dpr;
      let best = -1, bd = radius * radius;
      for (let i = 0; i < sx.length; i++) {
        if (!sichtbar[i]) continue;
        const d = (sx[i] - px) ** 2 + (sy[i] - py) ** 2;
        // Vorderseite und Raumstationen leicht bevorzugen
        const w = d * (sichtbar[i] === 2 ? 1 : 1.6) * (sats[i].gruppe === "station" ? 0.5 : 1);
        if (w < bd) { bd = w; best = i; }
      }
      if (best < 0) return null;
      // Satelliten leicht benachteiligt, damit Schiffe/Flugzeuge darunter auch antippbar sind
      return { d2: (bd / (dpr * dpr)) * 1.3, nimm: () => waehle(best, { fliegen: false }) };
    } });
  }

  function waehle(i, { fliegen = true } = {}) {
    if (i < 0 || i >= sats.length) return;
    gewaehlt = i;
    bahn = null;
    if (!aktiv.has(sats[i].gruppe)) { /* bleibt trotzdem sichtbar (Sonderfall gewählt) */ }
    worker?.postMessage({ typ: "bahn", i, zeit: Date.now() });
    zeigeKarte();
    if (fliegen) fliegeHin();
    zeichneBald();
  }

  function fliegeHin() {
    if (gewaehlt < 0 || !pos) return;
    const lat = pos[gewaehlt * 4], lon = pos[gewaehlt * 4 + 1];
    if (lat !== lat) return;
    const g = G(), p = g?.projektion?.();
    if (!p) return;
    const faktor = Math.max(1.25, Math.min(3, p.scale() / g.basis()));
    g.zu(lon, lat, faktor);
  }
  function folgeJetzt() {
    const g = G(), p = g?.projektion?.();
    if (!p || gewaehlt < 0) return;
    const lat = pos[gewaehlt * 4], lon = pos[gewaehlt * 4 + 1];
    if (lat !== lat) return;
    p.rotate([-lon, -Math.max(-85, Math.min(85, lat)), 0]);
    g.neu();
  }

  // ---------- Steckbrief-Karte ----------
  const MU = 398600.4418, RE = 6378.137;
  function bahnWerte(x) {
    const n = Number(x.l2.slice(52, 63));            // Umläufe pro Tag
    const e = Number("0." + x.l2.slice(26, 33).trim());
    const inc = Number(x.l2.slice(8, 16));
    const T = 1440 / n;                               // Minuten
    const a = Math.cbrt(MU / Math.pow((2 * Math.PI * n) / 86400, 2));
    const apo = a * (1 + e) - RE, peri = a * (1 - e) - RE;
    let typ = "niedrige Umlaufbahn (LEO)";
    if (e > 0.25) typ = "stark elliptische Bahn (HEO)";
    else if (Math.abs(T - 1436) < 40 && inc < 20) typ = "geostationär (GEO) – steht fast still über einem Ort";
    else if (Math.abs(T - 1436) < 40) typ = "geosynchron (GSO)";
    else if (apo > 2000) typ = "mittlere Umlaufbahn (MEO)";
    const jahr = Number(x.l1.slice(18, 20)), tag = Number(x.l1.slice(20, 32));
    const epoche = new Date(Date.UTC(jahr < 57 ? 2000 + jahr : 1900 + jahr, 0, 1) + (tag - 1) * 86400000);
    return { n, e, inc, T, apo, peri, typ, epoche };
  }
  const zahl = (v, st = 0) => Number(v).toLocaleString("de-DE", { maximumFractionDigits: st, minimumFractionDigits: st });
  const fmtKoord = (lat, lon) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "O" : "W"}`;
  const datum = (d) => { const t = new Date(d); return isNaN(t) ? d : t.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }); };
  function alterText(d) {
    const t = new Date(d); if (isNaN(t)) return "";
    const j = (Date.now() - t) / (365.25 * 86400000);
    return j < 1 ? `vor ${Math.max(1, Math.round(j * 12))} Monaten` : `vor ${zahl(j, j < 10 ? 1 : 0)} Jahren`;
  }

  let karteNorad = 0;
  function zeigeKarte() {
    const x = sats[gewaehlt];
    if (!x) return;
    $("lage-markercard")?.remove();
    let card = $("lage-satcard");
    if (!card) {
      card = document.createElement("div");
      card.id = "lage-satcard"; card.className = "lage-satcard";
      $("lage")?.append(card);
    }
    karteNorad = x.norad;
    const b = bahnWerte(x);
    const gName = gruppen.find((g) => g.id === x.gruppe)?.name || "";
    card.innerHTML = `<button class="ship-x" title="Schließen" data-a="zu">✕</button>
      <div class="sc-kopf">
        <i class="sc-dot" style="--f:${FARBEN[x.gruppe] || "#ccc"}"></i>
        <div><div class="mc-type">🛰️ Satellit · ${esc(gName)} · <span class="mc-dot">● live</span></div>
        <div class="mc-title">${esc(x.name)}</div></div>
      </div>
      <div class="sc-bild hidden"></div>
      <div class="sc-abschnitt">Jetzt gerade</div>
      <div class="mc-rows sc-live"></div>
      <div class="sc-abschnitt">Umlaufbahn</div>
      <div class="mc-rows">
        <span>Art</span><b>${esc(b.typ)}</b>
        <span>Höhe</span><b>${zahl(Math.max(0, b.peri))} – ${zahl(b.apo)} km</b>
        <span>Eine Runde</span><b>${b.T < 120 ? zahl(b.T, 1) + " Min." : zahl(b.T / 60, 1) + " Std."}</b>
        <span>Runden pro Tag</span><b>${zahl(b.n, 2)}</b>
        <span>Neigung</span><b>${zahl(b.inc, 1)}°${b.inc > 80 && b.inc < 100 ? " (über die Pole)" : ""}</b>
        <span>Bahndaten vom</span><b>${b.epoche.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</b>
      </div>
      <div class="sc-abschnitt">Steckbrief</div>
      <div class="mc-rows sc-steck"><span>NORAD-Nr.</span><b>${x.norad}</b><span>Angaben</span><b class="sc-laedt">werden geladen …</b></div>
      <p class="sc-text hidden"></p>
      <div class="sc-knoepfe">
        <button type="button" class="chip" data-a="hin">◎ Hinfliegen</button>
        <button type="button" class="chip${folgen ? " on" : ""}" data-a="folgen">${folgen ? "■ Nicht mehr folgen" : "➜ Folgen"}</button>
        <a class="chip sc-wiki hidden" target="_blank" rel="noopener noreferrer">Wikipedia ↗</a>
      </div>`;
    card.onclick = (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "zu") karteZu();
      else if (a === "hin") fliegeHin();
      else if (a === "folgen") { folgen = !folgen; e.target.textContent = folgen ? "■ Nicht mehr folgen" : "➜ Folgen"; e.target.classList.toggle("on", folgen); if (folgen) { fliegeHin(); } }
    };
    aktualisiereKarte();
    ladeSteckbrief(x.norad, card);
  }

  function aktualisiereKarte() {
    const card = $("lage-satcard");
    if (!card || gewaehlt < 0 || !pos) return;
    const live = card.querySelector(".sc-live");
    if (!live) return;
    const lat = pos[gewaehlt * 4], lon = pos[gewaehlt * 4 + 1], alt = pos[gewaehlt * 4 + 2], v = pos[gewaehlt * 4 + 3];
    if (lat !== lat) { live.innerHTML = "<span>Position</span><b>nicht berechenbar (Bahndaten zu alt)</b>"; return; }
    const genau = G()?.landAn?.(lon, lat);
    const ueber = genau || G()?.land?.(lon, lat) || "";
    live.innerHTML = `<span>Position</span><b>${fmtKoord(lat, lon)}</b>
      <span>Über</span><b>${esc(ueberText(lat, lon, ueber, genau))}</b>
      <span>Höhe</span><b>${zahl(alt)} km</b>
      <span>Tempo</span><b>${zahl(v)} km/h <small>(${zahl(v / 3600, 2)} km/s)</small></b>`;
  }
  // Über Land (genau) oder über dem Meer (mit nächstem Land als Hinweis)?
  function ueberText(lat, lon, land, genau) {
    if (genau) return genau;
    if (lat < -62) return "Antarktis";
    if (lat > 70) return "Arktis";
    if (genau === "") return land ? `Meer (nächstes Land: ${land})` : "Meer";
    return land ? `nahe ${land}` : "–";
  }

  async function ladeSteckbrief(norad, card) {
    let d = null;
    try {
      const r = await api(`/api/satelliten/${norad}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Fehler");
      d = await r.json();
    } catch (err) {
      if (karteNorad === norad) card.querySelector(".sc-laedt").textContent = "gerade nicht erreichbar";
      return;
    }
    if (karteNorad !== norad || !document.body.contains(card)) return;
    const w = d.wiki || {};
    const zeilen = [["NORAD-Nr.", String(d.norad)]];
    if (d.cospar) zeilen.push(["COSPAR-ID", d.cospar]);
    if (w.name && w.name.toUpperCase() !== String(d.name).toUpperCase() && !/^Q\d+$/.test(w.name)) zeilen.push(["Bekannt als", w.name]);
    if (d.land) zeilen.push(["Land / Besitzer", d.land]);
    if (w.betreiber?.length) zeilen.push(["Betreiber", w.betreiber.join(", ")]);
    if (d.status) zeilen.push(["Status", d.status]);
    const start = d.start || w.start;
    if (start) zeilen.push(["Start", `${esc(datum(start))} <small>(${esc(alterText(start))})</small>`, true]);
    if (d.startplatz) zeilen.push(["Startplatz", d.startplatz]);
    if (w.rakete?.length) zeilen.push(["Rakete", w.rakete.join(", ")]);
    if (w.masse_kg) zeilen.push(["Masse", w.masse_kg >= 10000 ? `${zahl(w.masse_kg / 1000, 1)} Tonnen` : `${zahl(w.masse_kg)} kg`]);
    if (d.groesse) zeilen.push(["Größe", d.groesse]);
    if (w.hersteller?.length) zeilen.push(["Hersteller", w.hersteller.join(", ")]);
    if (!w.masse_kg) zeilen.push(["Masse", "nicht öffentlich angegeben"]);
    card.querySelector(".sc-steck").innerHTML = zeilen.map(([k, v, html]) => `<span>${esc(k)}</span><b>${html ? v : esc(v)}</b>`).join("");
    const text = card.querySelector(".sc-text");
    const mission = w.text || (w.beschreibung ? w.beschreibung.charAt(0).toUpperCase() + w.beschreibung.slice(1) + "." : "") || d.gruppe_info || "";
    if (mission) { text.innerHTML = `<b>Mission:</b> ${esc(mission)}`; text.classList.remove("hidden"); }
    if (w.artikel) { const a = card.querySelector(".sc-wiki"); a.href = w.artikel; a.classList.remove("hidden"); }
    if (w.bild) {
      const box = card.querySelector(".sc-bild");
      box.innerHTML = `<img src="${esc(w.bild)}" alt="${esc(d.name)}" loading="lazy">`;
      box.querySelector("img").onerror = () => box.remove();
      box.classList.remove("hidden");
    }
  }

  function karteZu() {
    $("lage-satcard")?.remove();
    gewaehlt = -1; bahn = null; folgen = false; karteNorad = 0;
    zeichneBald();
  }

  // ---------- Filter & Suche ----------
  function setzeStatus(t) { const s = $("sat-status"); if (s) s.textContent = t; }

  function panel() {
    let p = $("sat-panel");
    if (p) return p;
    p = document.createElement("div");
    p.id = "sat-panel"; p.className = "sat-panel hidden";
    p.innerHTML = `<button class="ship-x" title="Schließen" data-a="zu">✕</button>
      <h3>🛰️ Satelliten im All</h3>
      <p class="sat-status" id="sat-status">–</p>
      <input id="sat-suche" type="search" autocomplete="off" placeholder="Suchen: Name oder Nummer, z. B. ISS, Hubble, 25544">
      <div id="sat-treffer" class="sat-treffer"></div>
      <div class="sat-gruppen-kopf"><span>Gruppen</span><button type="button" class="chip" data-a="alle">Alle</button><button type="button" class="chip" data-a="keine">Keine</button></div>
      <div id="sat-gruppen" class="sat-gruppen"></div>
      <p class="sat-ehrlich">Gezeigt werden alle öffentlich gelisteten, aktiven Satelliten (Bahndaten: CelesTrak, Steckbriefe: CelesTrak-Katalog und Wikidata). Geheime Militärsatelliten veröffentlicht niemand – die fehlen in jedem öffentlichen Katalog. Weltraumschrott und ausgebrannte Raketenstufen sind ausgeblendet.</p>`;
    $("lage")?.append(p);
    p.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "zu") p.classList.add("hidden");
      else if (a === "alle") { aktiv = new Set(gruppen.map((g) => g.id)); speichereFilter(); baueFilter(); zeichneBald(); }
      else if (a === "keine") { aktiv = new Set(); speichereFilter(); baueFilter(); zeichneBald(); }
      const gb = e.target.closest("[data-g]");
      if (gb) {
        const id = gb.dataset.g;
        if (aktiv.has(id)) aktiv.delete(id); else aktiv.add(id);
        speichereFilter(); baueFilter(); zeichneBald();
      }
      const tr = e.target.closest("[data-i]");
      if (tr) { waehle(Number(tr.dataset.i)); if (matchMedia("(max-width: 900px)").matches) p.classList.add("hidden"); }
    });
    let suchTimer = null;
    p.querySelector("#sat-suche").addEventListener("input", (e) => { clearTimeout(suchTimer); suchTimer = setTimeout(() => suche(e.target.value), 180); });
    p.querySelector("#sat-suche").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { const first = p.querySelector("[data-i]"); if (first) first.click(); }
      e.stopPropagation(); // Esc soll nicht das ganze Weltgeschehen schließen
      if (e.key === "Escape") { e.target.value = ""; suche(""); }
    });
    baueFilter();
    return p;
  }

  function baueFilter() {
    const box = $("sat-gruppen");
    if (!box) return;
    const z = {};
    for (const x of sats) z[x.gruppe] = (z[x.gruppe] || 0) + 1;
    box.innerHTML = gruppen.map((g) => `<button type="button" class="sat-g${aktiv.has(g.id) ? " on" : ""}" data-g="${g.id}" title="${esc(g.info)}">
      <i style="--f:${FARBEN[g.id] || "#ccc"}"></i><span>${esc(g.name)}</span><b>${zahl(z[g.id] || 0)}</b></button>`).join("");
    if (sats.length) {
      const t = stand ? new Date(stand).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
      setzeStatus(`${zahl(sats.length)} aktive Satelliten bekannt${t ? " · Bahndaten von " + t : ""} · antippen für Steckbrief`);
    } else if (fehler) setzeStatus("Satelliten gerade nicht erreichbar: " + fehler);
  }

  function suche(q) {
    const box = $("sat-treffer");
    q = String(q || "").trim().toLowerCase();
    if (!q) { treffer = null; if (box) box.innerHTML = ""; zeichneBald(); return; }
    const nr = /^\d{1,6}$/.test(q) ? Number(q) : 0;
    const alias = { "iss": "iss (zarya)", "raumstation": "iss (zarya)", "hubble": "hst", "tiangong": "css (tianhe)", "chinesische raumstation": "css (tianhe)" }[q];
    const liste = [];
    for (let i = 0; i < sats.length; i++) {
      const x = sats[i];
      if ((nr && x.norad === nr) || x.such.includes(q) || (alias && x.such.startsWith(alias))) liste.push(i);
    }
    // Beste zuerst: exakter Anfang, Raumstationen, kurze Namen
    liste.sort((a, b) => {
      const A = sats[a], B = sats[b];
      const s = (x) => (alias && x.such.startsWith(alias) ? -3 : 0) + (x.norad === nr ? -3 : 0) + (x.such.startsWith(q) ? -1 : 0) + (x.gruppe === "station" ? -1 : 0);
      return s(A) - s(B) || A.name.length - B.name.length;
    });
    treffer = new Set(liste.slice(0, 2000));
    if (box) {
      box.innerHTML = liste.length
        ? `<small>${zahl(liste.length)} Treffer${liste.length > 8 ? " (alle auf dem Globus markiert)" : ""}</small>` +
          liste.slice(0, 8).map((i) => `<button type="button" class="sat-hit" data-i="${i}"><i style="--f:${FARBEN[sats[i].gruppe]}"></i>${esc(sats[i].name)}<small>${sats[i].norad}</small></button>`).join("")
        : "<small>Kein Satellit gefunden.</small>";
    }
    zeichneBald();
  }

  // Knopf in der Ebenen-Legende (Weltraum) + Zähler
  function legendeKnopf() {
    const lab = $("lage-sats-on")?.closest("label");
    if (!lab || $("sat-filter-btn")) return;
    const span = lab.querySelector("span");
    if (span && !$("cnt-sats")) { const i = document.createElement("i"); i.id = "cnt-sats"; span.append(i); }
    const b = document.createElement("button");
    b.type = "button"; b.id = "sat-filter-btn"; b.className = "chip sat-filter-btn";
    b.textContent = "🛰 Filter & Suche";
    b.addEventListener("click", (e) => { e.preventDefault(); oeffnePanel(); });
    lab.after(b);
  }
  function oeffnePanel() {
    const p = panel();
    p.classList.remove("hidden");
    if (!an()) { $("lage-sats-on").checked = true; $("lage-sats-on").dispatchEvent(new Event("change", { bubbles: true })); }
    starten();
    if (!matchMedia("(pointer: coarse)").matches) setTimeout(() => $("sat-suche")?.focus(), 50);
  }

  // ---------- Verdrahtung ----------
  legendeKnopf();
  antippenEinrichten();
  window.addEventListener("friday-lage", (e) => {
    if (e.detail?.offen) { antippenEinrichten(); legendeKnopf(); G()?.bereit?.().then(() => { if (!window.__satHook) { window.__satHook = true; G().onRedraw(zeichneBald); } starten(); }); }
    else { stoppen(false); $("sat-panel")?.classList.add("hidden"); }
  });
  document.addEventListener("change", (e) => {
    if (e.target?.id !== "lage-sats-on") return;
    if (e.target.checked) starten(); else stoppen(true);
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && an() && offen()) tick(); });

  // Für Sprache / andere Module: Friday zeigt einen Satelliten oder eine Gruppe.
  window.FridaySatelliten = {
    async zeige(name) {
      if (!offen()) $("lage-btn")?.click();
      if (!an()) { $("lage-sats-on").checked = true; }
      await starten();
      const p = panel(); p.classList.remove("hidden");
      $("sat-suche").value = name || "";
      suche(name || "");
      const first = p.querySelector("[data-i]");
      if (first) first.click();
      return Boolean(first);
    },
    oeffne: oeffnePanel,
    async zeigeNr(norad) {
      if (!offen()) $("lage-btn")?.click();
      if (!an()) $("lage-sats-on").checked = true;
      await starten();
      const i = sats.findIndex((x) => x.norad === norad);
      if (i < 0) return false;
      // auf die erste Position warten, damit Friday hinfliegen kann
      for (let k = 0; k < 20 && !pos; k++) await new Promise((r) => setTimeout(r, 150));
      waehle(i);
      return true;
    },
    async gruppe(id) {
      if (!offen()) $("lage-btn")?.click();
      if (!an()) $("lage-sats-on").checked = true;
      await starten();
      if (!gruppen.some((g) => g.id === id)) return false;
      aktiv = new Set([id]); speichereFilter();
      oeffnePanel(); baueFilter(); zeichneBald();
      return true;
    },
    anzahl: () => sats.length,
  };
})();
