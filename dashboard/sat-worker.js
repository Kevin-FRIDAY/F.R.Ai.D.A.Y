// Hintergrund-Thread: rechnet die Positionen aller Satelliten (SGP4), damit der Globus flüssig bleibt.
/* global satellite */
importScripts("/vendor/satellite.min.js");

let recs = [];      // satrec je Satellit (null = kaputte Bahndaten)
let n = 0;

self.onmessage = (e) => {
  const m = e.data || {};
  if (m.typ === "laden") {
    recs = m.tle.map(([l1, l2]) => { try { return satellite.twoline2satrec(l1, l2); } catch { return null; } });
    n = recs.length;
    self.postMessage({ typ: "geladen", n });
  } else if (m.typ === "rechne") {
    const t = new Date(m.zeit || Date.now());
    const gmst = satellite.gstime(t);
    // je Satellit: Breite, Länge (Grad), Höhe (km), Tempo (km/h); NaN = keine Position
    const out = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const r = recs[i];
      let ok = false;
      if (r) {
        try {
          const pv = satellite.propagate(r, t);
          if (pv && pv.position && !r.error) {
            const gd = satellite.eciToGeodetic(pv.position, gmst);
            const v = pv.velocity;
            out[i * 4] = gd.latitude * 57.29577951308232;
            out[i * 4 + 1] = gd.longitude * 57.29577951308232;
            out[i * 4 + 2] = gd.height;
            out[i * 4 + 3] = v ? Math.hypot(v.x, v.y, v.z) * 3600 : 0;
            ok = Number.isFinite(out[i * 4]) && Number.isFinite(out[i * 4 + 2]);
          }
        } catch { /* Bahn zerfallen */ }
      }
      if (!ok) out[i * 4] = NaN;
    }
    self.postMessage({ typ: "pos", zeit: t.getTime(), pos: out }, [out.buffer]);
  } else if (m.typ === "bahn") {
    // Eine volle Runde der Bahn (Boden-Spur + Höhe) für den angetippten Satelliten.
    const r = recs[m.i];
    if (!r) return;
    const minuten = Math.min(1440, (2 * Math.PI) / r.no); // r.no = rad/min
    const schritte = 180;
    const pts = [];
    const t0 = m.zeit || Date.now();
    for (let k = 0; k <= schritte; k++) {
      const t = new Date(t0 + (k / schritte) * minuten * 60000);
      try {
        const pv = satellite.propagate(r, t);
        if (!pv || !pv.position) continue;
        const gd = satellite.eciToGeodetic(pv.position, satellite.gstime(t));
        pts.push([gd.latitude * 57.29577951308232, gd.longitude * 57.29577951308232, gd.height]);
      } catch { /* egal */ }
    }
    self.postMessage({ typ: "bahn", i: m.i, pts });
  }
};
