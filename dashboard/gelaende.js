// F.R.Ai.D.A.Y Weltgeschehen: 3D-Gelände in der Detailkarte (v1.121.0) – NUR am Mac/PC.
// Berge und Täler echt in 3D: Satellitenbild (Esri) auf Höhendaten (AWS Terrain Tiles, frei, ohne Schlüssel),
// gezeichnet mit MapLibre GL (wird erst beim ersten Einschalten geladen).
// Auf dem iPhone/Handy bleibt es aus (Knopf und Schalter ausgeblendet), damit Friday flüssig läuft.
// Die 3D-Karte wird beim Schließen wieder komplett abgebaut (gibt Grafikspeicher frei).
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const G = () => window.FridayGlobus;
  const KEY = "friday_3d_gelaende";
  const ML = "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/";

  const handy = () => { try { return !!window.FridayLeistung?.istHandy?.(); } catch { return false; } };
  document.documentElement.classList.toggle("ist-handy", handy());

  const schalter = () => $("lage-3d-on");
  const gewuenscht = () => !handy() && !!schalter()?.checked;
  try { const s = schalter(); if (s) s.checked = localStorage.getItem(KEY) === "1"; } catch { /* egal */ }

  let laden = null, karte = null, aktiv = false;

  function webgl() {
    try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
  }

  function ladeMapLibre() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    laden ??= new Promise((ok, fehler) => {
      if (!$("maplibre-css")) {
        const l = document.createElement("link"); l.id = "maplibre-css"; l.rel = "stylesheet"; l.href = ML + "maplibre-gl.css"; document.head.append(l);
      }
      const s = document.createElement("script");
      s.src = ML + "maplibre-gl.js"; s.async = true;
      s.onload = () => (window.maplibregl ? ok(window.maplibregl) : fehler(new Error("MapLibre fehlt")));
      s.onerror = () => { laden = null; fehler(new Error("MapLibre nicht ladbar")); };
      document.head.append(s);
    });
    return laden;
  }

  const STIL = {
    version: 8,
    sources: {
      sat: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 19, attribution: "© Esri" },
      orte: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 19 },
      hoehe: { type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 14, encoding: "terrarium", attribution: "Höhen: Mapzen / AWS Terrain Tiles" },
      schatten: { type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 14, encoding: "terrarium" },
    },
    layers: [
      { id: "hg", type: "background", paint: { "background-color": "#050403" } },
      { id: "sat", type: "raster", source: "sat" },
      { id: "relief", type: "hillshade", source: "schatten", paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#000", "hillshade-highlight-color": "#ffd9b0" } },
      { id: "orte", type: "raster", source: "orte", paint: { "raster-opacity": 0.85 } },
    ],
    terrain: { source: "hoehe", exaggeration: 1.6 },
    sky: { "sky-color": "#0b1a2e", "horizon-color": "#ff8a1e", "fog-color": "#0a0603", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.4, "fog-ground-blend": 0.5 },
  };

  function knopf(an) {
    $("lage-dm-3d")?.classList.toggle("active", an);
    const b = $("lage-dm-3d"); if (b) b.textContent = an ? "⛰ 3D an" : "⛰ 3D";
  }
  function hinweis(text) {
    let h = document.querySelector(".lage-dm-3dhint");
    if (!h) { h = document.createElement("div"); h.className = "lage-dm-3dhint"; $("lage-dm-3dmap")?.append(h); }
    h.textContent = text;
  }

  async function einschalten() {
    if (handy() || aktiv) return;
    const box = $("lage-dm-3dmap");
    const leaflet = G()?.detailKarte?.();
    if (!box || !leaflet) return;
    if (!webgl()) { hinweis("Dieser Browser kann kein 3D (WebGL)."); return; }
    aktiv = true; knopf(true);
    box.classList.remove("hidden");
    $("lage-detailmap")?.classList.add("drei-an");
    try {
      const maplibregl = await ladeMapLibre();
      if (!aktiv) return;
      const c = leaflet.getCenter();
      karte?.remove();
      karte = new maplibregl.Map({
        container: box, style: STIL, center: [c.lng, c.lat], zoom: Math.max(1, leaflet.getZoom() - 0.6),
        pitch: 62, bearing: -18, maxPitch: 80, attributionControl: { compact: true }, antialias: false, fadeDuration: 0,
        maxTileCacheSize: 120,
      });
      karte.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
      karte.on("load", () => {
        const umriss = G()?.detailUmriss?.();
        if (umriss) {
          karte.addSource("umriss", { type: "geojson", data: umriss });
          karte.addLayer({ id: "umriss", type: "line", source: "umriss", paint: { "line-color": "#ff8a1e", "line-width": 2.5, "line-opacity": 0.95 } });
        }
        // langsam einschwenken – Wow-Effekt, danach Ruhe (keine Dauer-Animation)
        karte.easeTo({ bearing: 12, duration: 6000, easing: (t) => t * (2 - t) });
      });
      hinweis("Ziehen = verschieben · Rechtsklick/Strg + Ziehen = kippen und drehen");
    } catch {
      hinweis("3D-Karte gerade nicht ladbar – Internet prüfen.");
      aktiv = false; knopf(false);
    }
  }

  function ausschalten() {
    aktiv = false; knopf(false);
    $("lage-detailmap")?.classList.remove("drei-an");
    const leaflet = G()?.detailKarte?.();
    if (karte && leaflet) { try { const c = karte.getCenter(); leaflet.setView([c.lat, c.lng], leaflet.getZoom(), { animate: false }); } catch { /* egal */ } }
    try { karte?.remove(); } catch { /* egal */ }
    karte = null;
    const box = $("lage-dm-3dmap");
    if (box) { box.classList.add("hidden"); box.replaceChildren(); }
  }

  $("lage-dm-3d")?.addEventListener("click", () => (aktiv ? ausschalten() : einschalten()));
  schalter()?.addEventListener("change", () => {
    try { localStorage.setItem(KEY, schalter().checked ? "1" : "0"); } catch { /* egal */ }
    const dm = $("lage-detailmap");
    if (gewuenscht() && dm && !dm.classList.contains("hidden")) einschalten();
    else if (!schalter().checked) ausschalten();
  });

  // Detailkarte geht auf (Land gewählt) → bei eingeschaltetem 3D-Gelände direkt in 3D; geht zu → abbauen.
  const dm = $("lage-detailmap");
  if (dm) new MutationObserver(() => {
    const offen = !dm.classList.contains("hidden");
    if (!offen) { if (aktiv || karte) ausschalten(); return; }
    if (gewuenscht() && !aktiv) setTimeout(() => { if (!dm.classList.contains("hidden")) einschalten(); }, 400);
  }).observe(dm, { attributes: true, attributeFilter: ["class"] });

  window.FridayGelaende = { an: einschalten, aus: ausschalten, aktiv: () => aktiv };
})();
