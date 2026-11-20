// F.R.Ai.D.A.Y Weltgeschehen: ALLE Flugzeuge, die öffentlich ihre Position senden (ADS-B).
// Weltweit über OpenSky (alle paar Minuten), dazwischen rechnet Friday jedes Flugzeug mit Tempo + Kurs weiter.
// Nah herangezoomt kommen genaue Live-Daten aus adsb.lol dazu. Antippen -> Steckbrief
// (Airline, Strecke von → nach, Typ, Kennzeichen, Halter, Foto, Höhe, Tempo, Steigen/Sinken, Squawk).
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api || ((p, o) => fetch(p, o));
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const G = () => window.FridayGlobus;
  const RAD = Math.PI / 180;

  const FARBEN = { linie: "#ffd34d", privat: "#7fe7ff", heli: "#c792ea", boden: "#8a939b", notfall: "#ff3b4f" };

  // Zeile: [hex, lat, lon, hoehe_m, tempo_kmh, kurs, gruppe, rufzeichen, land, steig_ms, zeit_s]
  let gruppen = [], flieger = [], aktiv = new Set(), info = {};
  let gewaehlt = "", detail = null, treffer = null;
  let ladeTimer = null, nahTimer = null, rechenTimer = null, karteTimer = null, laedt = false;
  let L = null;
  let sx = null, sy = null, sicht = null, ux = null, uy = null, uz = null;

  const an = () => Boolean($("lage-planes-on")?.checked);
  const offen = () => !$("lage")?.classList.contains("hidden");
  // v1.118.0: Friday im Hintergrund (html.friday-ruhe) rechnet genauso sparsam wie der flüssige Modus
  const fluessig = () => { const c = document.documentElement.classList; return c.contains("perf-fluessig") || c.contains("friday-ruhe"); };
  const zahl = (v, st = 0) => Number(v).toLocaleString("de-DE", { maximumFractionDigits: st, minimumFractionDigits: st });

  function ladeFilter() { try { const r = localStorage.getItem("friday_flug_gruppen"); return r ? new Set(JSON.parse(r)) : null; } catch { return null; } }
  function speichereFilter() { try { localStorage.setItem("friday_flug_gruppen", JSON.stringify([...aktiv])); } catch { /* egal */ } }

  // ---------- Weiterrechnen (Koppelnavigation) ----------
  // Jedes Flugzeug fliegt mit seinem Tempo + Kurs weiter, höchstens 20 Minuten über die letzte Meldung hinaus.
  function vektoren() {
    const n = flieger.length, jetzt = Date.now() / 1000;
    if (!ux || ux.length < n) { ux = new Float32Array(n + 500); uy = new Float32Array(n + 500); uz = new Float32Array(n + 500); }
    for (let i = 0; i < n; i++) {
      const f = flieger[i];
      let la = f[1] * RAD, lo = f[2] * RAD;
      const dt = Math.min(1200, Math.max(0, jetzt - (f[10] || jetzt)));
      if (f[4] > 30 && f[5] != null && dt > 1 && gruppen[f[6]]?.id !== "boden") {
        const d = (f[4] / 3.6) * dt / 6371000, b = f[5] * RAD;
        const sla = Math.sin(la), cla = Math.cos(la), sd = Math.sin(d), cd = Math.cos(d);
        const la2 = Math.asin(sla * cd + cla * sd * Math.cos(b));
        lo = lo + Math.atan2(Math.sin(b) * sd * cla, cd - sla * Math.sin(la2));
        la = la2;
      }
      const c = Math.cos(la);
      ux[i] = c * Math.cos(lo); uy[i] = c * Math.sin(lo); uz[i] = Math.sin(la);
    }
  }
  function posVon(i) { return [Math.asin(uz[i]) / RAD, Math.atan2(uy[i], ux[i]) / RAD]; }

  // ---------- Daten ----------
  async function laden() {
    if (laedt) return;
    laedt = true;
    try {
      const r = await api("/api/flugzeuge");
      if (!r.ok) throw new Error("Server");
      const d = await r.json();
      info = { stand: d.stand, naechster: d.naechster, mit_konto: d.mit_konto, fehler: d.fehler, quelle: d.quelle };
      const erstesMal = !gruppen.length;
      gruppen = d.gruppen || [];
      // genaue Nah-Daten (adsb.lol) behalten, wenn sie neuer sind als der Schnappschuss
      const nah = new Map(flieger.filter((f) => f.nah).map((f) => [f[0], f]));
      flieger = (d.flugzeuge || []).map((f) => { const n = nah.get(f[0]); if (n && n[10] > f[10]) { nah.delete(f[0]); return n; } return f; });
      for (const f of nah.values()) if (Date.now() / 1000 - f[10] < 300) flieger.push(f);
      if (erstesMal) {
        const fi = ladeFilter();
        aktiv = fi ? new Set([...fi].filter((g) => gruppen.some((x) => x.id === g))) : new Set(gruppen.map((g) => g.id));
      }
      vektoren();
      baueFilter();
      zeichneBald();
    } catch { /* nächster Versuch beim nächsten Takt */ }
    finally { laedt = false; }
  }
  function takt() {
    clearTimeout(ladeTimer);
    if (!an() || !offen()) return;
    if (!document.hidden) laden();
    ladeTimer = setTimeout(takt, 60000);
  }
  // Nah herangezoomt: genaue Live-Daten für die Mitte der Ansicht
  async function nahTakt() {
    clearTimeout(nahTimer);
    if (!an() || !offen()) return;
    const pr = G()?.projektion?.();
    if (pr && !document.hidden && pr.scale() / G().basis() >= 3) {
      const [l0, p0] = pr.rotate();
      try {
        const r = await api(`/api/flugzeuge/nah?lat=${(-p0).toFixed(2)}&lon=${(-l0).toFixed(2)}`);
        const d = await r.json();
        if (Array.isArray(d.flugzeuge) && d.flugzeuge.length) {
          const idx = new Map(flieger.map((f, i) => [f[0], i]));
          for (const f of d.flugzeuge) {
            f.nah = true;
            const i = idx.get(f[0]);
            if (i == null) flieger.push(f);
            else { if (!f[8]) f[8] = flieger[i][8]; flieger[i] = f; }
          }
          vektoren(); zeichneBald();
        }
      } catch { /* egal */ }
    }
    nahTimer = setTimeout(nahTakt, 15000);
  }
  function rechenTakt() {
    clearTimeout(rechenTimer);
    if (!an() || !offen()) return;
    if (!document.hidden && flieger.length) { vektoren(); zeichneBald(); }
    rechenTimer = setTimeout(rechenTakt, fluessig() ? 6000 : 3000);
  }
  async function starten() {
    if (!an() || !offen()) return;
    await G()?.bereit?.();
    if (!L) {
      L = window.FridayLeinwand.erstelle("lage-planecanvas", 3);
      if (!L) return;
      L.onResize = zeichneBald;
      G().onRedraw(zeichneBald);
      window.FridayLeinwand.registriere({ kandidat: tippen });
    }
    takt(); rechenTakt();
    clearTimeout(nahTimer); nahTimer = setTimeout(nahTakt, 3000);
  }
  function halt() { clearTimeout(ladeTimer); clearTimeout(nahTimer); clearTimeout(rechenTimer); }
  function stoppen() {
    halt();
    if (L) L.ctx.clearRect(0, 0, L.canvas.width, L.canvas.height);
    karteZu();
    const c = $("cnt-planes"); if (c) c.textContent = "";
  }

  // ---------- Zeichnen ----------
  let raf = 0, zuletzt = 0, spaeter = 0;
  function zeichneBald() {
    if (raf || spaeter) return;
    const warte = fluessig() ? 100 - (performance.now() - zuletzt) : 0;
    if (warte > 0) { spaeter = setTimeout(() => { spaeter = 0; zeichneBald(); }, warte); return; }
    raf = requestAnimationFrame(() => { raf = 0; zuletzt = performance.now(); zeichne(); });
  }
  function bogen(ctx, p, a, b, out) {
    // Großkreis von a nach b (je [lat, lon]) als Linie
    const v = (x) => { const la = x[0] * RAD, lo = x[1] * RAD, c = Math.cos(la); return [c * Math.cos(lo), c * Math.sin(lo), Math.sin(la)]; };
    const A = v(a), B = v(b);
    const w = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
    const schritte = Math.max(2, Math.ceil(w / (2 * RAD)));
    let auf = false;
    ctx.beginPath();
    for (let k = 0; k <= schritte; k++) {
      const t = k / schritte, s = Math.sin(w) || 1;
      const fa = w ? Math.sin((1 - t) * w) / s : 1 - t, fb = w ? Math.sin(t * w) / s : t;
      const x = fa * A[0] + fb * B[0], y = fa * A[1] + fb * B[1], z = fa * A[2] + fb * B[2];
      if (p.vek(x, y, z, out)) { if (auf) ctx.lineTo(out[0], out[1]); else { ctx.moveTo(out[0], out[1]); auf = true; } } else auf = false;
    }
    ctx.stroke();
  }
  function zeichne() {
    if (!L) return;
    const { ctx, canvas, dpr } = L;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!an() || !offen() || !flieger.length) return;
    const p = L.projektor();
    if (!p) return;
    const n = flieger.length;
    if (!sx || sx.length < n) { sx = new Float32Array(n + 2000); sy = new Float32Array(n + 2000); sicht = new Uint8Array(n + 2000); }
    const aktivNr = gruppen.map((g) => aktiv.has(g.id));
    const out = [0, 0];
    const nah = p.zoom >= 3;
    const d = (nah ? 3.2 : 1.6) * dpr * (fluessig() ? 0.9 : 1);
    const nachGruppe = gruppen.map(() => []);
    let gezeigt = 0;
    for (let i = 0; i < n; i++) {
      sicht[i] = 0;
      const f = flieger[i];
      if (!aktivNr[f[6]] && f[0] !== gewaehlt && !(treffer && treffer.has(f[0]))) continue;
      if (!p.vek(ux[i], uy[i], uz[i], out)) continue;
      sx[i] = out[0]; sy[i] = out[1]; sicht[i] = 1;
      (nachGruppe[f[6]] || nachGruppe[1]).push(i);
      gezeigt++;
    }
    // Ausgewählt: Strecke von → nach
    if (gewaehlt && detail?.strecke?.von?.lat != null && detail.strecke.nach?.lat != null) {
      const s = detail.strecke;
      ctx.strokeStyle = "rgba(255,211,77,.55)"; ctx.lineWidth = 1.3 * dpr; ctx.setLineDash([5 * dpr, 4 * dpr]);
      bogen(ctx, p, [s.von.lat, s.von.lon], [s.nach.lat, s.nach.lon], out);
      ctx.setLineDash([]);
      for (const o of [s.von, s.nach]) if (p(o.lat, o.lon, out)) {
        ctx.fillStyle = "#ffd34d"; ctx.beginPath(); ctx.arc(out[0], out[1], 3 * dpr, 0, 7); ctx.fill();
        ctx.font = `${10 * dpr}px system-ui, sans-serif`; ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 4 * dpr;
        ctx.fillText(o.iata || o.icao || "", out[0] + 5 * dpr, out[1] + 4 * dpr); ctx.shadowBlur = 0;
      }
    }
    for (let gi = 0; gi < gruppen.length; gi++) {
      const liste = nachGruppe[gi];
      if (!liste.length) continue;
      ctx.fillStyle = FARBEN[gruppen[gi].id] || "#ccc";
      ctx.globalAlpha = gruppen[gi].id === "boden" ? 0.6 : 0.92;
      if (!nah) { for (const i of liste) ctx.fillRect(sx[i] - d / 2, sy[i] - d / 2, d, d); continue; }
      ctx.beginPath();
      for (const i of liste) {
        const f = flieger[i];
        if (f[5] == null) { ctx.rect(sx[i] - d / 2, sy[i] - d / 2, d, d); continue; }
        // Flugzeug-Pfeil mit Flügeln in Flugrichtung (Kurs 0° = Norden = oben)
        const a = f[5] * RAD, c = Math.cos(a), s = Math.sin(a);
        const P = (vx, vy) => [sx[i] + (vx * c - vy * s) * d, sy[i] + (vx * s + vy * c) * d];
        const pkt = [[0, -1.6], [0.25, -0.4], [1.4, 0.3], [1.4, 0.6], [0.25, 0.3], [0.2, 1.1], [0.6, 1.5], [-0.6, 1.5], [-0.2, 1.1], [-0.25, 0.3], [-1.4, 0.6], [-1.4, 0.3], [-0.25, -0.4]];
        const [x0, y0] = P(...pkt[0]); ctx.moveTo(x0, y0);
        for (let k = 1; k < pkt.length; k++) { const [x, y] = P(...pkt[k]); ctx.lineTo(x, y); }
        ctx.closePath();
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (treffer && treffer.size && treffer.size <= 300) {
      ctx.strokeStyle = "rgba(255,170,60,.95)"; ctx.lineWidth = 1.2 * dpr;
      for (let i = 0; i < n; i++) if (sicht[i] && treffer.has(flieger[i][0])) { ctx.beginPath(); ctx.arc(sx[i], sy[i], 6 * dpr, 0, 7); ctx.stroke(); }
    }
    if (gewaehlt) {
      const i = flieger.findIndex((f) => f[0] === gewaehlt);
      if (i >= 0 && sicht[i]) {
        ctx.strokeStyle = FARBEN[gruppen[flieger[i][6]]?.id] || "#fff"; ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath(); ctx.arc(sx[i], sy[i], 9 * dpr, 0, 7); ctx.stroke();
        ctx.font = `${11 * dpr}px system-ui, sans-serif`; ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 4 * dpr;
        ctx.fillText(flieger[i][7] || gewaehlt.toUpperCase(), sx[i] + 11 * dpr, sy[i] - 9 * dpr); ctx.shadowBlur = 0;
      }
    }
    const cnt = $("cnt-planes");
    if (cnt) cnt.textContent = gezeigt ? ` ${zahl(gezeigt)}` : "";
  }

  // ---------- Antippen + Steckbrief ----------
  function tippen(cx, cy, radiusCss) {
    if (!sx || !L || !an() || !flieger.length) return null;
    const r = L.canvas.getBoundingClientRect();
    const px = (cx - r.left) * L.dpr, py = (cy - r.top) * L.dpr, radius = radiusCss * L.dpr;
    let best = -1, bd = radius * radius;
    for (let i = 0; i < flieger.length; i++) {
      if (!sicht[i]) continue;
      const dd = (sx[i] - px) ** 2 + (sy[i] - py) ** 2;
      if (dd < bd) { bd = dd; best = i; }
    }
    if (best < 0) return null;
    const hex = flieger[best][0];
    return { d2: bd / (L.dpr * L.dpr), nimm: () => waehle(hex, false) };
  }

  function fliegeHin(lat, lon) { const g = G(), pr = g?.projektion?.(); if (pr) g.zu(lon, lat, Math.max(4, pr.scale() / g.basis())); }

  async function waehle(hex, fliegen = true) {
    gewaehlt = hex; detail = null;
    for (const id of ["lage-satcard", "lage-markercard", "lage-shipcard", "lage-planecard-schiff"]) $(id)?.remove();
    const i = flieger.findIndex((x) => x[0] === hex);
    if (fliegen && i >= 0) { const [la, lo] = posVon(i); fliegeHin(la, lo); }
    zeigeKarte(i >= 0 ? flieger[i] : null);
    zeichneBald();
    await ladeDetail();
    clearInterval(karteTimer);
    karteTimer = setInterval(() => { if (!$("lage-planecard-flug")) { clearInterval(karteTimer); return; } ladeDetail(); }, 20000);
  }

  async function ladeDetail() {
    const hex = gewaehlt;
    try {
      const r = await api(`/api/flugzeuge/${hex}`);
      const d = await r.json();
      if (hex !== gewaehlt) return;
      if (!r.ok) { fuelleKarte(null, d.error); return; }
      detail = d;
      // Position aus der genauen Abfrage übernehmen
      const i = flieger.findIndex((x) => x[0] === hex);
      const neu = [hex, d.lat, d.lon, d.hoehe_m, d.tempo_kmh, d.kurs, Math.max(0, gruppen.findIndex((g) => g.id === d.gruppe)), d.rufzeichen, d.herkunft, d.steig_ms, d.zeit ? Date.parse(d.zeit) / 1000 : Date.now() / 1000];
      neu.nah = true;
      if (i >= 0) flieger[i] = neu; else flieger.push(neu);
      vektoren();
      fuelleKarte(d);
      zeichneBald();
    } catch { if (hex === gewaehlt) fuelleKarte(null, "Gerade nicht erreichbar."); }
  }

  function zeigeKarte(f) {
    let card = $("lage-planecard-flug");
    if (!card) {
      card = document.createElement("div");
      card.id = "lage-planecard-flug"; card.className = "lage-satcard";
      $("lage")?.append(card);
    }
    const g = gruppen[f?.[6]];
    card.innerHTML = `<button class="ship-x" title="Schließen" data-a="zu">✕</button>
      <div class="sc-kopf"><i class="sc-dot" style="--f:${FARBEN[g?.id] || "#ccc"}"></i>
      <div><div class="mc-type">✈ Flugzeug · ${esc(g?.name || "")} · <span class="mc-dot">● live</span></div>
      <div class="mc-title">${esc(f?.[7] || gewaehlt.toUpperCase())}</div><div class="fl-strecke"></div></div></div>
      <div class="sc-inhalt"><div class="mc-rows"><span>Kennung</span><b>${esc(gewaehlt.toUpperCase())}</b><span>Angaben</span><b>werden geladen …</b></div></div>
      <div class="sc-knoepfe"><button type="button" class="chip" data-a="hin">◎ Hinfliegen</button><a class="chip sc-mehr hidden" target="_blank" rel="noopener noreferrer">Live-Karte ↗</a></div>`;
    card.onclick = (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "zu") karteZu();
      else if (a === "hin") { const i = flieger.findIndex((x) => x[0] === gewaehlt); if (i >= 0) { const [la, lo] = posVon(i); fliegeHin(la, lo); } }
    };
  }

  const sicher = (u) => (/^https:\/\//i.test(String(u || "")) ? String(u) : "");
  const ortName = (o) => (o ? `${o.iata ? o.iata + " " : ""}${o.stadt || o.name}` : "");
  function fuelleKarte(d, fehler) {
    const card = $("lage-planecard-flug");
    if (!card) return;
    const box = card.querySelector(".sc-inhalt");
    if (!d) { box.innerHTML = `<div class="mc-rows"><span>Kennung</span><b>${esc(gewaehlt.toUpperCase())}</b><span>Hinweis</span><b>${esc(fehler || "keine Daten")}</b></div>`; return; }
    const s = d.strecke;
    const kopf = card.querySelector(".fl-strecke");
    if (kopf) kopf.innerHTML = s?.von && s?.nach ? `${esc(ortName(s.von))} <b>→</b> ${esc(ortName(s.nach))}` : "";
    const ueber = G()?.landAn?.(d.lon, d.lat);
    const naechstes = G()?.land?.(d.lon, d.lat) || "";
    const ort = ueber || `Meer${naechstes ? " (nächstes Land: " + naechstes + ")" : ""}`;
    const alt = d.zeit ? Math.round((Date.now() - Date.parse(d.zeit)) / 1000) : null;
    const steig = d.steig_ms == null ? null : Math.abs(d.steig_ms) < 0.5 ? "hält die Höhe" : d.steig_ms > 0 ? `steigt ${zahl(d.steig_ms * 60)} m/Min.` : `sinkt ${zahl(-d.steig_ms * 60)} m/Min.`;
    const notfall = { 7700: "7700 – NOTFALL", 7600: "7600 – Funkausfall", 7500: "7500 – Entführung" }[d.squawk];
    const reihen = (liste) => liste.filter(([, v]) => v != null && v !== "").map(([k, v, html]) => `<span>${esc(k)}</span><b>${html ? v : esc(v)}</b>`).join("");
    box.innerHTML = `${sicher(d.foto) ? `<a class="fl-foto" href="${esc(sicher(d.foto_gross) || sicher(d.foto))}" target="_blank" rel="noopener noreferrer"><img src="${esc(sicher(d.foto))}" alt="Foto des Flugzeugs" loading="lazy" referrerpolicy="no-referrer"></a>` : ""}
    <div class="sc-abschnitt">Jetzt gerade</div><div class="mc-rows">${reihen([
      ["Wo", ort],
      ["Höhe", d.gruppe === "boden" ? "am Boden" : d.hoehe_m != null ? `${zahl(d.hoehe_m)} m <small>(${zahl(d.hoehe_ft)} ft)</small>` : null, true],
      ["Tempo", d.tempo_kmh != null ? `${zahl(d.tempo_kmh)} km/h <small>(${zahl(d.tempo_kmh / 1.852)} Knoten)</small>` : null, true],
      ["Kurs", d.kurs != null ? `${d.kurs}° ${himmel(d.kurs)}` : null],
      ["Steigen/Sinken", steig],
      ["Squawk", notfall ? `<span class="fl-notfall">${notfall}</span>` : d.squawk, Boolean(notfall)],
      ["Wind draußen", d.wind], ["Außentemperatur", d.aussentemp],
      ["Letzte Meldung", alt != null ? (alt < 60 ? `vor ${Math.max(1, alt)} Sek.` : `vor ${Math.round(alt / 60)} Min.`) : null],
      ["Datenquelle", d.quelle_live],
    ])}</div>
    ${s ? `<div class="sc-abschnitt">Flug</div><div class="mc-rows">${reihen([
      ["Airline", s.airline ? `${s.airline}${s.airline_land ? " · " + s.airline_land : ""}` : null],
      ["Flugnummer", s.flugnummer],
      ["Von", s.von ? `${ortName(s.von)}${s.von.land ? ", " + s.von.land : ""}` : null],
      ["Nach", s.nach ? `${ortName(s.nach)}${s.nach.land ? ", " + s.nach.land : ""}` : null],
    ])}</div>` : ""}
    <div class="sc-abschnitt">Steckbrief</div><div class="mc-rows">${reihen([
      ["Typ", d.typ || d.typ_code || "nicht öffentlich angegeben"], ["Typ-Code", d.typ && d.typ_code ? d.typ_code : null],
      ["Kennzeichen", d.kennzeichen], ["Halter", d.halter], ["Land", d.herkunft], ["Rufzeichen", d.rufzeichen], ["ICAO-Kennung", d.hex.toUpperCase()],
    ])}</div>`;
    const a = card.querySelector(".sc-mehr");
    if (a && d.mehr) { a.href = d.mehr; a.classList.remove("hidden"); }
  }
  const himmel = (k) => ["(Nord)", "(Nordost)", "(Ost)", "(Südost)", "(Süd)", "(Südwest)", "(West)", "(Nordwest)"][Math.round(k / 45) % 8];

  function karteZu() {
    $("lage-planecard-flug")?.remove();
    clearInterval(karteTimer);
    gewaehlt = ""; detail = null;
    zeichneBald();
  }

  // ---------- Filter & Suche ----------
  function panel() {
    let p = $("plane-panel");
    if (p) return p;
    p = document.createElement("div");
    p.id = "plane-panel"; p.className = "sat-panel hidden";
    p.innerHTML = `<button class="ship-x" title="Schließen" data-a="zu">✕</button>
      <h3>✈ Flugzeuge weltweit</h3>
      <p class="sat-status" id="plane-status">–</p>
      <input id="plane-suche" class="sat-sucheingabe" type="search" autocomplete="off" placeholder="Suchen: Flugnummer (LH400, DLH400) oder Land">
      <div id="plane-treffer" class="sat-treffer"></div>
      <div class="sat-gruppen-kopf"><span>Arten</span><button type="button" class="chip" data-a="alle">Alle</button><button type="button" class="chip" data-a="keine">Keine</button></div>
      <div id="plane-gruppen" class="sat-gruppen"></div>
      <p class="sat-ehrlich">Gezeigt werden alle Flugzeuge, deren ADS-B-Signal freiwillige Empfänger auffangen (OpenSky Network, adsb.lol). Zwischen den Abrufen rechnet Friday jedes Flugzeug mit Tempo und Kurs weiter. Über Ozeanen und in manchen Ländern fehlen viele. Militär- und manche Regierungsflüge senden oft nicht oder werden ausgeblendet – die sind nicht öffentlich.</p>`;
    $("lage")?.append(p);
    p.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "zu") p.classList.add("hidden");
      else if (a === "alle") { aktiv = new Set(gruppen.map((g) => g.id)); speichereFilter(); baueFilter(); zeichneBald(); }
      else if (a === "keine") { aktiv = new Set(); speichereFilter(); baueFilter(); zeichneBald(); }
      const gb = e.target.closest("[data-g]");
      if (gb) { const id = gb.dataset.g; if (aktiv.has(id)) aktiv.delete(id); else aktiv.add(id); speichereFilter(); baueFilter(); zeichneBald(); }
      const tr = e.target.closest("[data-h]");
      if (tr) { waehle(tr.dataset.h); if (matchMedia("(max-width: 900px)").matches) p.classList.add("hidden"); }
    });
    let t = null;
    const inp = p.querySelector("#plane-suche");
    inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => suche(inp.value), 200); });
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") p.querySelector("[data-h]")?.click(); if (e.key === "Escape") { inp.value = ""; suche(""); } });
    baueFilter();
    return p;
  }
  const uhr = (iso) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  function baueFilter() {
    const box = $("plane-gruppen");
    if (!box) return;
    const z = {};
    for (const f of flieger) z[f[6]] = (z[f[6]] || 0) + 1;
    box.innerHTML = gruppen.map((g, i) => `<button type="button" class="sat-g${aktiv.has(g.id) ? " on" : ""}" data-g="${g.id}" title="${esc(g.info)}">
      <i style="--f:${FARBEN[g.id] || "#ccc"}"></i><span>${esc(g.name)}</span><b>${zahl(z[i] || 0)}</b></button>`).join("");
    const st = $("plane-status");
    if (!st) return;
    if (!flieger.length) st.textContent = info.fehler ? `Flugdaten gerade nicht verfügbar (${info.fehler}).` : "Flugdaten werden geladen …";
    else st.textContent = `${zahl(flieger.length)} Flugzeuge · Stand ${info.stand ? uhr(info.stand) : "–"}${info.naechster ? " · neu ab " + uhr(info.naechster) : ""} · dazwischen live weitergerechnet`
      + (info.mit_konto ? "" : " · Tipp: mit kostenlosem OpenSky-Konto alle 2 Min. frisch (Anleitung 32-flugzeuge.md)");
  }
  const IATA = { LH: "DLH", EW: "EWG", FR: "RYR", U2: "EZY", BA: "BAW", AF: "AFR", KL: "KLM", UA: "UAL", AA: "AAL", DL: "DAL", EK: "UAE", QR: "QTR", TK: "THY", LX: "SWR", OS: "AUA", DE: "CFG", X3: "TUI", W6: "WZZ", EY: "ETD", SQ: "SIA" };
  function suche(q) {
    const box = $("plane-treffer");
    q = String(q || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!q) { treffer = null; if (box) box.innerHTML = ""; zeichneBald(); return; }
    const m = q.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);
    const alt = m && IATA[m[1]] ? IATA[m[1]] + m[2] : "";
    const hex = /^[0-9A-F]{6}$/.test(q) ? q.toLowerCase() : "";
    const liste = flieger.filter((f) => f[0] === hex || (f[7] && (f[7].includes(q) || (alt && f[7].startsWith(alt)))) || (q.length >= 4 && f[8] && f[8].toUpperCase().startsWith(q)));
    liste.sort((a, b) => ((b[7] || "").startsWith(alt || q) - (a[7] || "").startsWith(alt || q)) || ((b[3] || 0) - (a[3] || 0)));
    treffer = new Set(liste.slice(0, 3000).map((f) => f[0]));
    if (box) {
      box.innerHTML = liste.length
        ? `<small>${zahl(liste.length)} Treffer</small>` + liste.slice(0, 8).map((f) => `<button type="button" class="sat-hit" data-h="${esc(f[0])}"><i style="--f:${FARBEN[gruppen[f[6]]?.id]}"></i>${esc(f[7] || f[0].toUpperCase())}<small>${f[8] ? esc(f[8]) + " · " : ""}${f[3] != null ? zahl(f[3]) + " m" : ""}</small></button>`).join("")
        : "<small>Kein Flugzeug gefunden.</small>";
    }
    zeichneBald();
  }
  function legendeKnopf() {
    const lab = $("lage-planes-on")?.closest("label");
    if (!lab || $("plane-filter-btn")) return;
    const span = lab.querySelector("span");
    if (span && !$("cnt-planes")) { const i = document.createElement("i"); i.id = "cnt-planes"; i.className = "cnt-ebene"; span.append(i); }
    const b = document.createElement("button");
    b.type = "button"; b.id = "plane-filter-btn"; b.className = "chip sat-filter-btn"; b.textContent = "✈ Filter & Suche";
    b.addEventListener("click", (e) => { e.preventDefault(); oeffnePanel(); });
    lab.after(b);
  }
  function oeffnePanel() {
    const p = panel();
    $("sat-panel")?.classList.add("hidden"); $("ship-panel")?.classList.add("hidden");
    p.classList.remove("hidden");
    if (!an()) { $("lage-planes-on").checked = true; $("lage-planes-on").dispatchEvent(new Event("change", { bubbles: true })); }
    starten();
  }
  async function bereitMachen() {
    if (!offen()) $("lage-btn")?.click();
    if (!an()) $("lage-planes-on").checked = true;
    await starten(); await laden();
  }

  // ---------- Verdrahtung ----------
  legendeKnopf();
  $("lage-planes")?.replaceChildren(); // alte SVG-Flugzeuge (bis v1.114) nicht mehr nötig
  window.addEventListener("friday-lage", (e) => { if (e.detail?.offen) { legendeKnopf(); starten(); } else { halt(); $("plane-panel")?.classList.add("hidden"); } });
  document.addEventListener("change", (e) => { if (e.target?.id === "lage-planes-on") { if (e.target.checked) starten(); else stoppen(); } });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && an() && offen()) { takt(); rechenTakt(); } });

  window.FridayFlugzeuge = {
    oeffne: oeffnePanel,
    async zeigeNr(hex) { await bereitMachen(); waehle(String(hex).toLowerCase()); },
    async gruppe(id) {
      await bereitMachen();
      if (gruppen.some((g) => g.id === id)) { aktiv = new Set([id]); speichereFilter(); }
      oeffnePanel(); baueFilter(); zeichneBald();
    },
  };
})();
