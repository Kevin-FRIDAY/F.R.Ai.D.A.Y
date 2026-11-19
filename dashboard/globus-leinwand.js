// Gemeinsame Leinwand über dem Weltgeschehen-Globus (für Schiffe, Flugzeuge …).
// Rechnet die Globus-Drehung selbst (wie d3.geoOrthographic) – schnell genug für zehntausende Punkte.
(() => {
  "use strict";
  const W = 960, H = 500, RAD = Math.PI / 180;

  function erstelle(id, z = 2) {
    const svg = document.getElementById("lage-map");
    if (!svg) return null;
    let canvas = document.getElementById(id);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = id; canvas.className = "lage-satcanvas"; canvas.style.zIndex = z;
      canvas.setAttribute("aria-hidden", "true");
      svg.after(canvas);
    }
    const ctx = canvas.getContext("2d");
    const l = { canvas, ctx, dpr: 1, onResize: null };
    const passe = () => {
      const fl = document.documentElement.classList.contains("perf-fluessig");
      l.dpr = Math.min(window.devicePixelRatio || 1, fl ? 1.5 : 2);
      canvas.style.left = svg.offsetLeft + "px"; canvas.style.top = svg.offsetTop + "px";
      canvas.style.width = svg.clientWidth + "px"; canvas.style.height = svg.clientHeight + "px";
      canvas.width = Math.max(1, Math.round(svg.clientWidth * l.dpr));
      canvas.height = Math.max(1, Math.round(svg.clientHeight * l.dpr));
      l.onResize?.();
    };
    if (window.ResizeObserver) new ResizeObserver(passe).observe(svg);
    window.addEventListener("resize", passe);
    passe();
    // Projektor für den aktuellen Globus-Zustand: (lat, lon, rf=1) -> sichtbar? setzt out[0], out[1]
    l.projektor = () => {
      const proj = window.FridayGlobus?.projektion?.();
      if (!proj) return null;
      const [l0, p0] = proj.rotate();
      const k = proj.scale(), [tx, ty] = proj.translate();
      const s = Math.min(canvas.width / W, canvas.height / H), ox = (canvas.width - W * s) / 2, oy = (canvas.height - H * s) / 2;
      const cL = Math.cos(l0 * RAD), sL = Math.sin(l0 * RAD), cP = Math.cos(p0 * RAD), sP = Math.sin(p0 * RAD);
      const f = (lat, lon, out, rf = 1) => {
        const la = lat * RAD, lo = lon * RAD, cla = Math.cos(la);
        const x0 = cla * Math.cos(lo), y0 = cla * Math.sin(lo), z0 = Math.sin(la);
        const x = x0 * cL - y0 * sL, y = x0 * sL + y0 * cL;
        const X = x * cP - z0 * sP, Z = z0 * cP + x * sP;
        if (X <= 0 && (y * y + Z * Z) * rf * rf < 1) return false;
        out[0] = ox + (tx + k * rf * y) * s; out[1] = oy + (ty - k * rf * Z) * s;
        return out[0] > -6 && out[1] > -6 && out[0] < canvas.width + 6 && out[1] < canvas.height + 6;
      };
      f.zoom = k / (window.FridayGlobus.basis?.() || k);
      // Schnellweg für viele Punkte mit vorab berechneten Einheits-Vektoren (x0, y0, z0)
      f.vek = (x0, y0, z0, out) => {
        const x = x0 * cL - y0 * sL, y = x0 * sL + y0 * cL;
        const X = x * cP - z0 * sP;
        if (X <= 0) return false;
        const Z = z0 * cP + x * sP;
        out[0] = ox + (tx + k * y) * s; out[1] = oy + (ty - k * Z) * s;
        return out[0] > -6 && out[1] > -6 && out[0] < canvas.width + 6 && out[1] < canvas.height + 6;
      };
      return f;
    };
    return l;
  }

  // Antippen auf dem Globus: alle Ebenen (Satelliten, Schiffe, Flugzeuge) melden ihren nächsten Treffer,
  // der nächste gewinnt. Jede Ebene: { kandidat(clientX, clientY, radiusCssPx) -> { d2, nimm() } | null }
  const ebenen = [];
  let eingerichtet = false;
  function registriere(ebene) {
    ebenen.push(ebene);
    if (eingerichtet) return;
    const svg = document.getElementById("lage-map");
    if (!svg) return;
    eingerichtet = true;
    let druck = null;
    svg.addEventListener("pointerdown", (e) => { druck = { x: e.clientX, y: e.clientY }; }, true);
    svg.addEventListener("click", (e) => {
      if (druck && Math.hypot(e.clientX - druck.x, e.clientY - druck.y) > 6) return; // war Ziehen
      if (e.target.closest?.(".quake, .fire, .volcano, .storm, .eevent, .city, .airport, .plant, .iss, .lb-punkt")) return;
      const fein = !(e.pointerType === "touch" || matchMedia("(pointer: coarse)").matches);
      let best = null;
      for (const eb of ebenen) {
        let k = null;
        try { k = eb.kandidat(e.clientX, e.clientY, fein ? 10 : 18); } catch { k = null; }
        if (k && (!best || k.d2 < best.d2)) best = k;
      }
      if (!best) return;
      e.stopPropagation(); e.preventDefault();
      best.nimm();
    }, true);
  }

  window.FridayLeinwand = { erstelle, registriere };
})();
