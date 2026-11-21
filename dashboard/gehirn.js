// F.R.Ai.D.A.Y Gehirn (KI-Kern): Reiter "Gehirn" in der System-Zentrale.
// Oben ein gebogener Glas-Bildschirm (neuronale Pfade, Ablauf, Diagramme), darunter das leuchtende Gehirn auf dem Sockel.
// Alle Zahlen sind echt: GET /api/gehirn (Logbuch, Gedächtnis, Archiv, Energie, Auftrag, Mac-Werte). Kostet kein Guthaben.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api;
  const esc = F.escapeHtml || ((s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]));
  const sheet = $("brain");
  const pane = sheet?.querySelector('[data-pane="gehirn"]');
  const canvas = $("gh-canvas");
  if (!sheet || !pane || !canvas || !api) return;

  const UMFANG = 2 * Math.PI * 42;
  const fluessig = () => document.documentElement.classList.contains("perf-fluessig");
  const reduziert = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let daten = null;
  let pollTimer = null;
  let hervor = null; // Zentrum, das gerade hervorgehoben wird (Hover/Tippen)

  const sichtbar = () => !sheet.classList.contains("hidden") && !pane.classList.contains("hidden") && document.visibilityState !== "hidden";
  const zahl = (n) => (n == null ? "–" : Number(n).toLocaleString("de-DE"));
  const rel = (iso) => {
    if (!iso) return "";
    const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return "gerade eben";
    if (s < 3600) return `vor ${Math.round(s / 60)} Min`;
    if (s < 86400) return `vor ${Math.round(s / 3600)} Std`;
    return `vor ${Math.round(s / 86400)} T`;
  };
  const uhr = (iso) => { try { return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

  // ====================================================================
  // 1) Das Gehirn (Canvas): Punktwolke in Gehirnform, Verbindungen, Impulse
  // ====================================================================
  const ctx = canvas.getContext("2d");
  let punkte = [], kanten = [], nachbarn = [], impulse = [];
  let pendel = 0;
  let B = 0, H = 0, dpr = 1, winkel = -0.5, letzteZeit = 0, raf = 0, spawnRest = 0;

  // Zentren: Farbe + Lage im Gehirn (x vorne/hinten, y oben/unten, z links/rechts)
  const ZFARBE = { sprache: "#4cc3ff", logik: "#ff8a1e", kreativ: "#b06bff", erinnerung: "#46e08a", motorik: "#ffd24d" };
  function zentrumAn(x, y, z, kleinhirn) {
    if (kleinhirn) return "motorik";
    if (y < -0.12 && Math.abs(z) > 0.25) return "sprache";          // Schläfenlappen unten seitlich
    if (x > 0.38) return "logik";                                     // Stirnlappen vorne
    if (Math.abs(x) < 0.32 && y > 0.25) return "motorik";             // Bewegungsrinde oben in der Mitte
    if (x < -0.4) return "kreativ";                                   // Hinterhaupt (Sehen, Bilder)
    if (Math.abs(z) < 0.3 && y < 0.15) return "erinnerung";           // innen (Hippocampus)
    return x > 0 ? "logik" : "kreativ";
  }
  const rnd = (() => { let s = 20261120; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();

  function baueGehirn() {
    const n = fluessig() ? 700 : 1500;
    punkte = [];
    let versuche = 0;
    while (punkte.length < n && versuche < n * 40) {
      versuche++;
      const kleinhirn = punkte.length > n * 0.9;
      let x, y, z;
      if (!kleinhirn) {
        // Großhirn: Ellipsoid mit Windungen, unten abgeflacht, Spalt in der Mitte
        const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1);
        const huelle = rnd() < 0.82 ? 1 : Math.cbrt(rnd()) * 0.92;
        const wind = 1 + 0.055 * Math.sin(u * 7 + v * 5) * Math.sin(v * 9);
        x = Math.cos(u) * Math.sin(v) * 1.0 * huelle * wind;
        z = Math.sin(u) * Math.sin(v) * 0.78 * huelle * wind;
        y = Math.cos(v) * 0.7 * huelle * wind;
        if (y < -0.32) y = -0.32 + (y + 0.32) * 0.35;                 // unten flach
        if (x > 0.15 && y < -0.2) y += 0.08;                          // Stirn-Unterseite
        if (Math.abs(z) < 0.05 && y > 0.1 && huelle === 1) continue;  // Längsspalt
        z += Math.sign(z) * 0.03;
      } else {
        // Kleinhirn hinten unten
        const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1);
        const r = rnd() < 0.8 ? 1 : Math.cbrt(rnd());
        x = -0.62 + Math.cos(u) * Math.sin(v) * 0.3 * r;
        y = -0.42 + Math.cos(v) * 0.17 * r;
        z = Math.sin(u) * Math.sin(v) * 0.45 * r;
      }
      punkte.push({ x, y, z, zentrum: zentrumAn(x, y, z, kleinhirn), phase: rnd() * Math.PI * 2, gross: 0.6 + rnd() * 0.9 });
    }
    // Hirnstamm
    for (let i = 0; i < (fluessig() ? 18 : 34); i++) {
      const t = i / 34;
      punkte.push({ x: -0.18 + (rnd() - 0.5) * 0.12, y: -0.36 - t * 0.48, z: (rnd() - 0.5) * 0.14, zentrum: "motorik", phase: rnd() * 6, gross: 0.7 });
    }
    // Verbindungen: jeweils zu den nächsten Nachbarn
    kanten = []; nachbarn = punkte.map(() => []);
    const maxD = fluessig() ? 0.17 : 0.13;
    for (let i = 0; i < punkte.length; i++) {
      const a = punkte[i], nah = [];
      for (let j = 0; j < punkte.length; j++) {
        if (i === j) continue;
        const b = punkte[j], d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        if (d < maxD) nah.push([d, j]);
      }
      nah.sort((p, q) => p[0] - q[0]);
      for (const [, j] of nah.slice(0, 3)) {
        if (j > i || !nachbarn[j].includes(i)) { kanten.push([i, j]); nachbarn[i].push(j); nachbarn[j].push(i); }
      }
    }
  }

  function groesse() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(fluessig() ? 1.5 : 2, window.devicePixelRatio || 1);
    B = Math.max(10, r.width); H = Math.max(10, r.height);
    canvas.width = Math.round(B * dpr); canvas.height = Math.round(H * dpr);
  }
  new ResizeObserver(() => { groesse(); }).observe(canvas);

  // Wie viele Impulse pro Sekunde: echte Aktivität (letzte Stunde) + viel mehr, wenn Friday gerade denkt.
  function impulsRate() {
    if (!daten) return 3;
    const a = daten.aktivitaet?.letzteStunde || 0;
    return (daten.denkt ? 26 : 3) + Math.min(14, a * 0.7);
  }
  function neuerImpuls() {
    if (!kanten.length) return;
    let zentrum = null;
    // Zentren mit viel Arbeit feuern öfter
    if (daten?.zentren?.length && rnd() < 0.75) {
      const summe = daten.zentren.reduce((s, z) => s + z.woche + 1, 0);
      let w = rnd() * summe;
      for (const z of daten.zentren) { w -= z.woche + 1; if (w <= 0) { zentrum = z.id; break; } }
    }
    if (hervor && rnd() < 0.7) zentrum = hervor;
    let start = Math.floor(rnd() * punkte.length);
    if (zentrum) for (let k = 0; k < 30; k++) { const i = Math.floor(rnd() * punkte.length); if (punkte[i].zentrum === zentrum) { start = i; break; } }
    const ziel = nachbarn[start][Math.floor(rnd() * nachbarn[start].length)];
    if (ziel == null) return;
    impulse.push({ von: start, nach: ziel, t: 0, tempo: 1.6 + rnd() * 1.8, sprunge: 3 + Math.floor(rnd() * 5), farbe: ZFARBE[punkte[start].zentrum] });
  }

  function projiziere(p, cosA, sinA, skala, cx, cy) {
    const x = p.x * cosA - p.z * sinA;
    const z = p.x * sinA + p.z * cosA;
    const tiefe = 2.6 / (2.6 + z * 0.9);
    return { sx: cx + x * skala * tiefe, sy: cy - p.y * skala * tiefe, z, tiefe };
  }

  function zeichne(zeit) {
    raf = 0;
    if (!sichtbar()) return;
    const dt = Math.min(0.05, (zeit - (letzteZeit || zeit)) / 1000);
    letzteZeit = zeit;
    // Pendelt um die Seitenansicht, damit man das Gehirn immer erkennt
    if (!reduziert()) { pendel += dt * 0.2; winkel = -0.3 + Math.sin(pendel) * 0.75; }
    const t = zeit / 1000;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, B, H);
    const cx = B / 2, sockelY = H * 0.9, cy = H * 0.42;
    const skala = Math.min(B * 0.4, H * 0.5);

    // --- Sockel: Ringe + Lichtstrahl ---
    ctx.globalCompositeOperation = "lighter";
    const strahl = ctx.createLinearGradient(0, sockelY, 0, cy - skala * 0.2);
    strahl.addColorStop(0, "rgba(255,138,30,0.30)"); strahl.addColorStop(1, "rgba(255,138,30,0)");
    ctx.fillStyle = strahl;
    ctx.beginPath(); ctx.moveTo(cx - skala * 0.32, sockelY); ctx.lineTo(cx - skala * 0.12, cy); ctx.lineTo(cx + skala * 0.12, cy); ctx.lineTo(cx + skala * 0.32, sockelY); ctx.fill();
    for (let r = 0; r < 4; r++) {
      const rx = skala * (0.36 + r * 0.17), ry = rx * 0.17;
      ctx.strokeStyle = `rgba(255,${138 + r * 20},40,${0.55 - r * 0.11})`;
      ctx.lineWidth = r === 0 ? 2.4 : 1.2;
      ctx.setLineDash(r === 1 ? [6, 8] : r === 2 ? [2, 6] : []);
      ctx.lineDashOffset = -t * (r % 2 ? 30 : -18);
      ctx.beginPath(); ctx.ellipse(cx, sockelY, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([]);
    const boden = ctx.createRadialGradient(cx, sockelY, 2, cx, sockelY, skala * 0.5);
    boden.addColorStop(0, "rgba(255,170,80,0.55)"); boden.addColorStop(1, "rgba(255,120,20,0)");
    ctx.fillStyle = boden; ctx.beginPath(); ctx.ellipse(cx, sockelY, skala * 0.5, skala * 0.09, 0, 0, Math.PI * 2); ctx.fill();

    // --- Gehirn ---
    const cosA = Math.cos(winkel), sinA = Math.sin(winkel);
    const pos = punkte.map((p) => projiziere(p, cosA, sinA, skala, cx, cy));
    const denkt = Boolean(daten?.denkt);

    // Verbindungen (nach Zentrum gebündelt, damit es schnell bleibt)
    const gruppen = {};
    for (const [i, j] of kanten) {
      const z = punkte[i].zentrum;
      (gruppen[z] ||= []).push(i, j);
    }
    for (const [z, liste] of Object.entries(gruppen)) {
      const an = hervor ? (hervor === z ? 0.55 : 0.07) : 0.2 + (denkt ? 0.1 : 0);
      ctx.strokeStyle = z === "logik" || !hervor ? `rgba(255,150,60,${an})` : hexA(ZFARBE[z], an);
      if (hervor === z) ctx.strokeStyle = hexA(ZFARBE[z], an);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let k = 0; k < liste.length; k += 2) {
        const a = pos[liste[k]], b = pos[liste[k + 1]];
        ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
      }
      ctx.stroke();
    }

    // Nervenzellen
    for (let i = 0; i < punkte.length; i++) {
      const p = punkte[i], q = pos[i];
      const hinten = q.z > 0.2 ? 0.55 : 1;
      const funkeln = 0.55 + 0.45 * Math.sin(t * 2.2 + p.phase);
      const an = hervor ? (p.zentrum === hervor ? 1 : 0.35) : 1;
      const farbe = (hervor && p.zentrum === hervor) || (!hervor && p.zentrum !== "logik" && p.phase > 4.6) ? ZFARBE[p.zentrum] : "#ff9a3c";
      const r = p.gross * q.tiefe * 1.25;
      const alpha = 0.9 * hinten * an * (0.45 + funkeln * 0.55);
      ctx.globalAlpha = alpha * 0.55;
      const glow = r * (p.phase > 5.4 ? 7 : 4);
      ctx.drawImage(sprite(farbe), q.sx - glow, q.sy - glow, glow * 2, glow * 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = hexA(p.phase > 5.4 ? "#fff3e0" : farbe, alpha);
      ctx.fillRect(q.sx - r / 2, q.sy - r / 2, r, r);
    }

    // Impulse: wandern von Zelle zu Zelle
    spawnRest += dt * impulsRate();
    while (spawnRest > 1) { neuerImpuls(); spawnRest -= 1; }
    const behalten = [];
    for (const im of impulse) {
      im.t += dt * im.tempo;
      if (im.t >= 1) {
        im.sprunge -= 1;
        if (im.sprunge <= 0) continue;
        const weiter = nachbarn[im.nach].filter((k) => k !== im.von);
        if (!weiter.length) continue;
        im.von = im.nach; im.nach = weiter[Math.floor(rnd() * weiter.length)]; im.t = 0;
      }
      const a = pos[im.von], b = pos[im.nach];
      const x = a.sx + (b.sx - a.sx) * im.t, y = a.sy + (b.sy - a.sy) * im.t;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
      g.addColorStop(0, hexA("#ffffff", 0.95)); g.addColorStop(0.25, hexA(im.farbe, 0.85)); g.addColorStop(1, hexA(im.farbe, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = hexA(im.farbe, 0.7); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(x, y); ctx.stroke();
      behalten.push(im);
    }
    impulse = behalten.slice(-260);

    // Kern-Leuchten in der Mitte (pulsiert stärker beim Denken)
    const puls = 0.5 + 0.5 * Math.sin(t * (denkt ? 6 : 1.6));
    const kern = ctx.createRadialGradient(cx, cy, 0, cx, cy, skala * 0.75);
    kern.addColorStop(0, `rgba(255,150,50,${0.12 + puls * (denkt ? 0.16 : 0.06)})`); kern.addColorStop(1, "rgba(255,120,20,0)");
    ctx.fillStyle = kern; ctx.beginPath(); ctx.arc(cx, cy, skala * 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    planen();
  }
  const sprites = {};
  function sprite(farbe) {
    if (sprites[farbe]) return sprites[farbe];
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const g = c.getContext("2d"), r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, hexA(farbe, 0.9)); r.addColorStop(0.3, hexA(farbe, 0.35)); r.addColorStop(1, hexA(farbe, 0));
    g.fillStyle = r; g.fillRect(0, 0, 32, 32);
    return (sprites[farbe] = c);
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }
  let fluessigTakt = 0;
  function planen() {
    if (raf || !sichtbar()) return;
    if (fluessig()) { clearTimeout(fluessigTakt); fluessigTakt = setTimeout(() => { raf = requestAnimationFrame(zeichne); }, 33); return; }
    raf = requestAnimationFrame(zeichne);
  }

  // ====================================================================
  // 2) Glas-Bildschirm: neuronale Pfade (Eingang → Zentren → Ausgang)
  // ====================================================================
  const EINGANG = ["Stimme", "Text", "Kamera", "Telegram"];
  const AUSGANG = ["Antwort", "Mac", "Smart Home", "Gedächtnis"];
  function pfadeBauen(zentren) {
    const svg = $("gh-pfade"); if (!svg) return;
    const Hh = 210;
    const spalte = (n, x, oben = 18) => Array.from({ length: n }, (_, i) => ({ x, y: oben + (i * (Hh - oben - 14)) / Math.max(1, n - 1) }));
    const ein = spalte(EINGANG.length, 56, 26), mit = spalte(zentren.length, 210, 30), aus = spalte(AUSGANG.length, 356, 26);
    let h = "";
    zentren.forEach((z, j) => {
      const st = 0.15 + (z.anteil / 100) * 0.85;
      const an = z.heute > 0 || (daten?.denkt && z.id === "logik") ? " an" : "";
      ein.forEach((e) => { h += `<path class="gh-p${an}" style="--f:${z.farbe};opacity:${st.toFixed(2)}" d="M${e.x + 7} ${e.y} C${e.x + 70} ${e.y}, ${mit[j].x - 80} ${mit[j].y}, ${mit[j].x - 9} ${mit[j].y}"/>`; });
      aus.forEach((a) => { h += `<path class="gh-p${an}" style="--f:${z.farbe};opacity:${st.toFixed(2)}" d="M${mit[j].x + 9} ${mit[j].y} C${mit[j].x + 80} ${mit[j].y}, ${a.x - 70} ${a.y}, ${a.x - 7} ${a.y}"/>`; });
    });
    ein.forEach((e, i) => { h += `<circle class="gh-n" cx="${e.x}" cy="${e.y}" r="6"/><text x="${e.x - 10}" y="${e.y + 3}" text-anchor="end">${EINGANG[i]}</text>`; });
    aus.forEach((a, i) => { h += `<circle class="gh-n" cx="${a.x}" cy="${a.y}" r="6"/><text x="${a.x + 10}" y="${a.y + 3}">${AUSGANG[i]}</text>`; });
    zentren.forEach((z, j) => {
      h += `<g class="gh-zk" data-z="${z.id}"><circle cx="${mit[j].x}" cy="${mit[j].y}" r="9" style="--f:${z.farbe}"/><circle class="gh-zk-in" cx="${mit[j].x}" cy="${mit[j].y}" r="${(2.5 + (z.anteil / 100) * 4.5).toFixed(1)}" style="--f:${z.farbe}"/><text class="gh-zk-t" x="${mit[j].x}" y="${mit[j].y - 13}" text-anchor="middle">${esc(z.name.split(" ")[0])}</text></g>`;
    });
    svg.innerHTML = h;
  }

  // ====================================================================
  // 3) Werte eintragen
  // ====================================================================
  function kachel(id, wert, unter, balken) {
    const el = $(id); if (!el) return;
    el.querySelector("b").textContent = wert;
    el.querySelector("em").textContent = unter || "";
    const s = el.querySelector(".gh-bar s");
    if (s && balken != null) s.style.width = `${Math.max(2, Math.min(100, balken))}%`;
  }
  function zentrenListe(zentren) {
    const zeile = (z) => `<button type="button" class="gh-z" data-z="${z.id}" style="--f:${z.farbe}" title="${esc(z.text)}">
        <span class="gh-z-hirn"><svg viewBox="0 0 24 24"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/></svg></span>
        <span class="gh-z-txt"><b>${esc(z.name)}</b><small>${z.heute ? `Aktiv · heute ${zahl(z.heute)}` : z.woche ? "Bereit" : "Ruht"} · 7 T ${zahl(z.woche)}</small><i class="gh-bar"><s style="width:${Math.max(3, z.anteil)}%"></s></i></span>
      </button>`;
    const l = $("gh-zentren-l"), r = $("gh-zentren-r");
    if (l) l.innerHTML = zentren.slice(0, 2).map(zeile).join("");
    if (r) r.innerHTML = zentren.slice(2).map(zeile).join("");
    pane.querySelectorAll(".gh-z").forEach((b) => {
      b.classList.toggle("aktiv", hervor === b.dataset.z);
      b.addEventListener("mouseenter", () => { hervor = b.dataset.z; markiere(); });
      b.addEventListener("mouseleave", () => { hervor = null; markiere(); });
      b.addEventListener("click", () => { hervor = hervor === b.dataset.z ? null : b.dataset.z; markiere(); });
    });
  }
  function markiere() {
    pane.querySelectorAll(".gh-z").forEach((b) => b.classList.toggle("aktiv", hervor === b.dataset.z));
    pane.querySelectorAll(".gh-zk").forEach((g) => g.classList.toggle("aktiv", hervor === g.dataset.z));
  }
  function balkenStunden(stunden) {
    const svg = $("gh-stunden"); if (!svg) return;
    const max = Math.max(1, ...stunden), jetzt = new Date().getHours();
    svg.innerHTML = stunden.map((v, h) => {
      const hh = v ? Math.max(3, (v / max) * 56) : 1.5;
      return `<rect x="${h * 10 + 1}" y="${(60 - hh).toFixed(1)}" width="8" height="${hh.toFixed(1)}" rx="1.5" class="${h === jetzt ? "jetzt" : v ? "an" : ""}"><title>${h}–${h + 1} Uhr: ${v}</title></rect>`;
    }).join("");
  }
  function linie(verlauf) {
    const svg = $("gh-last"); if (!svg || !verlauf?.length) return;
    const n = Math.max(2, verlauf.length);
    const p = (k) => verlauf.map((v, i) => `${i ? "L" : "M"}${((i / (n - 1)) * 240).toFixed(1)},${(44 - (v[k] / 100) * 40).toFixed(1)}`).join(" ");
    svg.querySelector(".gh-l-cpu").setAttribute("d", p("cpu"));
    svg.querySelector(".gh-l-ram").setAttribute("d", p("ram"));
  }

  let pfadSchluessel = "";
  function malen() {
    const d = daten; if (!d) return;
    $("gh-ver").textContent = d.version || "–";
    const a = d.aktivitaet;
    kachel("gh-k-akt", `${zahl(a.letzteStunde)} / Std`, `heute ${zahl(a.heute)} Einträge`, a.maxStunde ? (a.letzteStunde / Math.max(a.maxStunde, a.letzteStunde, 1)) * 100 : 0);
    kachel("gh-k-wissen", `${zahl(d.wissen.erinnerungen)} gemerkt`, `${zahl(d.wissen.gespraeche)} Gespräche gespeichert`);
    kachel("gh-k-verb", d.verbindung.claude ? "Aktiv" : "Offline", `Claude ${d.verbindung.claude ? "erreichbar" : "ohne Guthaben"} · Mac ${d.verbindung.mac ? "verbunden" : "aus"}`);
    $("gh-k-verb")?.classList.toggle("schlecht", !d.verbindung.claude);
    kachel("gh-k-lern", d.lernen.neuWoche ? `+${d.lernen.neuWoche} diese Woche` : "Online", d.lernen.letzte ? `Zuletzt: „${d.lernen.letzte.text.slice(0, 46)}${d.lernen.letzte.text.length > 46 ? "…" : ""}“` : "Noch nichts gemerkt");
    $("gh-synapsen").textContent = `${zahl(d.wissen.synapsen)} Verknüpfungen`;
    $("gh-heute").textContent = `${zahl(a.heute)} · Ø Antwort ${d.befehle.antwortMs ? `${(d.befehle.antwortMs / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s` : "–"}`;

    // Ablauf
    const stufe = d.phase ? d.phase.stufe : -1;
    const fertig = d.phase && ["fertig", "fehler"].includes(d.phase.schritt);
    pane.querySelectorAll("#gh-flow > div").forEach((el) => {
      const s = Number(el.dataset.stufe);
      el.classList.toggle("an", d.denkt && s === stufe);
      el.classList.toggle("durch", (d.denkt && s < stufe) || (fertig && d.phase.vor_s < 600));
      el.classList.toggle("fehler", d.phase?.schritt === "fehler" && s === 3 && d.phase.vor_s < 600);
    });
    $("gh-phase-text").textContent = d.denkt ? (d.phase?.text || "Friday denkt …") : d.phase && d.phase.vor_s < 600 ? `Zuletzt ${d.phase.schritt === "fehler" ? "mit Fehler" : "erledigt"} · ${rel(new Date(Date.now() - d.phase.vor_s * 1000).toISOString())}` : "Bereit";
    $("gh-denkt")?.classList.toggle("hidden", !d.denkt);
    pane.classList.toggle("denkt", d.denkt);

    // Pfade nur neu bauen, wenn sich etwas ändert (sonst springen die Animationen)
    const key = JSON.stringify(d.zentren.map((z) => [z.anteil, z.heute > 0])) + d.denkt;
    if (key !== pfadSchluessel) { pfadSchluessel = key; pfadeBauen(d.zentren); markiere(); }

    balkenStunden(a.stunden);
    if (d.system) { linie(d.system.verlauf); $("gh-last-text").textContent = `Prozessor ${d.system.cpu}% · Speicher ${d.system.ram}%`; }

    const strom = $("gh-strom");
    if (strom) {
      strom.innerHTML = d.strom.length
        ? d.strom.map((e) => `<li class="${e.ok ? "" : "fehler"}"><span>${esc(e.symbol)}</span><b>${esc(e.titel)}</b><time>${uhr(e.at)}</time></li>`).join("")
        : `<li class="muted">Heute noch nichts passiert.</li>`;
    }

    // Ring KI-Leistung = echte Erfolgsquote heute
    const ring = $("gh-ring");
    if (ring) {
      const p = d.befehle.erfolg;
      const v = ring.querySelector(".gh-r-val");
      v.style.strokeDasharray = `${UMFANG}`;
      v.style.strokeDashoffset = `${UMFANG * (1 - (p ?? 0) / 100)}`;
      ring.querySelector("b").textContent = p == null ? "–" : `${p}%`;
      ring.querySelector("em").textContent = p == null ? "noch keine Aufträge" : `${zahl(d.befehle.heute)} Aufträge · ${zahl(d.befehle.claude)} mit Claude`;
      ring.dataset.stufe = p == null ? "" : p >= 90 ? "ok" : p >= 70 ? "warn" : "bad";
    }
    zentrenListe(d.zentren);

    // Energie = Claude-Guthaben (wie im Energie-Fenster)
    const en = $("gh-energie");
    if (en) {
      const p = d.energie.prozent;
      en.querySelector("b").textContent = p == null ? (d.energie.zustand === "tot" ? "leer" : "nicht eingetragen") : `${p}%`;
      en.querySelector(".gh-bar s").style.width = `${p == null ? (d.energie.zustand === "tot" ? 2 : 100) : Math.max(2, p)}%`;
      en.dataset.zustand = d.energie.zustand;
    }
    $("gh-modell").textContent = `Denk-Tempo: ${d.tempo.name}`;
  }

  async function laden() {
    try {
      const r = await api("/api/gehirn");
      if (r.ok) { daten = await r.json(); malen(); }
    } catch { /* Server kurz weg: alte Werte bleiben stehen */ }
  }

  // ====================================================================
  // 4) Öffnen, Schließen, nur arbeiten, solange sichtbar
  // ====================================================================
  let gebaut = false;
  function zustand() {
    if (sichtbar()) {
      if (!gebaut) { baueGehirn(); gebaut = true; }
      groesse();
      if (!pollTimer) { laden(); pollTimer = setInterval(() => { if (sichtbar()) laden(); }, 3000); }
      planen();
    } else {
      clearInterval(pollTimer); pollTimer = null;
      if (raf) cancelAnimationFrame(raf); raf = 0; clearTimeout(fluessigTakt);
      letzteZeit = 0;
    }
  }
  new MutationObserver(zustand).observe(sheet, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(zustand).observe(pane, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener("visibilitychange", zustand);
  window.addEventListener("friday-sz-reiter", zustand);
  // Leistungsmodus gewechselt → Gehirn passend neu bauen
  let warFluessig = fluessig();
  new MutationObserver(() => {
    if (fluessig() === warFluessig) return;
    warFluessig = fluessig();
    if (gebaut) { baueGehirn(); impulse = []; groesse(); }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  function open() {
    window.FridaySystem?.reiter?.("gehirn");
    $("brain-btn")?.click();
    if (sheet.classList.contains("hidden")) sheet.classList.remove("hidden");
  }
  $("gehirn-open")?.addEventListener("click", open);
  window.FridayGehirn = { open, laden };
  zustand();
})();
