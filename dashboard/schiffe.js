// F.R.Ai.D.A.Y Weltgeschehen: ALLE Schiffe, die Friday weltweit live empfängt (AIS über aisstream.io).
// Gezeichnet auf einer Leinwand über dem Globus. Antippen -> Steckbrief (Typ, Flagge, Größe, Tempo, Kurs,
// Ziel, Ankunft, Status, Spur der letzten Stunde). Filter nach Schiffstyp + Suche.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api || ((p, o) => fetch(p, o));
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const G = () => window.FridayGlobus;

  const FARBEN = {
    fracht: "#46e0a0", tanker: "#ff5d6c", passagier: "#4fd8ff", fischerei: "#e8d66a", hafen: "#ffb347",
    freizeit: "#c792ea", behoerde: "#ffffff", schnell: "#6fb6ff", sonst: "#9aa4ad",
  };

  let gruppen = [], schiffe = [], aktiv = new Set(), stand = "", info = { aktiv: true, verbunden: false };
  let gewaehlt = 0;           // MMSI des angetippten Schiffs
  let detail = null;          // Steckbrief vom Server
  let extra = null;           // Ziel-Hafen, Foto, Text (freie Quellen, v1.121.0)
  let treffer = null;         // Set von MMSI aus der Suche
  let ladeTimer = null, karteTimer = null, laedt = false;
  let L = null;               // Leinwand
  let sx = null, sy = null, sicht = null;
  let ux = null, uy = null, uz = null;
  function vektoren() {
    const n = schiffe.length, R = Math.PI / 180;
    ux = new Float32Array(n); uy = new Float32Array(n); uz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const la = schiffe[i][1] * R, lo = schiffe[i][2] * R, c = Math.cos(la);
      ux[i] = c * Math.cos(lo); uy[i] = c * Math.sin(lo); uz[i] = Math.sin(la);
    }
  }

  const an = () => Boolean($("lage-ships-on")?.checked);
  const offen = () => !$("lage")?.classList.contains("hidden");
  // v1.118.0: Friday im Hintergrund (html.friday-ruhe) rechnet genauso sparsam wie der flüssige Modus
  const fluessig = () => { const c = document.documentElement.classList; return c.contains("perf-fluessig") || c.contains("friday-ruhe"); };
  const zahl = (v, st = 0) => Number(v).toLocaleString("de-DE", { maximumFractionDigits: st, minimumFractionDigits: st });

  function ladeFilter() { try { const r = localStorage.getItem("friday_schiff_gruppen"); return r ? new Set(JSON.parse(r)) : null; } catch { return null; } }
  function speichereFilter() { try { localStorage.setItem("friday_schiff_gruppen", JSON.stringify([...aktiv])); } catch { /* egal */ } }

  // ---------- Daten ----------
  async function laden() {
    if (laedt) return;
    laedt = true;
    try {
      const r = await api("/api/schiffe");
      if (!r.ok) throw new Error("Server");
      const d = await r.json();
      info = { aktiv: d.aktiv, verbunden: d.verbunden };
      const erstesMal = !gruppen.length;
      gruppen = d.gruppen || [];
      stand = d.stand;
      schiffe = d.schiffe || [];
      vektoren();
      if (erstesMal) {
        const f = ladeFilter();
        aktiv = f ? new Set([...f].filter((g) => gruppen.some((x) => x.id === g))) : new Set(gruppen.map((g) => g.id));
      }
      baueFilter();
      zeichneBald();
    } catch { /* nächster Versuch beim nächsten Takt */ }
    finally { laedt = false; }
  }
  function takt() {
    clearTimeout(ladeTimer);
    if (!an() || !offen()) return;
    if (!document.hidden) laden();
    ladeTimer = setTimeout(takt, fluessig() ? 90000 : 45000);
  }
  async function starten() {
    if (!an() || !offen()) return;
    await G()?.bereit?.();
    if (!L) {
      L = window.FridayLeinwand.erstelle("lage-shipcanvas", 2);
      if (!L) return;
      L.onResize = zeichneBald;
      G().onRedraw(zeichneBald);
      window.FridayLeinwand.registriere({ kandidat: tippen });
    }
    takt();
  }
  function stoppen() {
    clearTimeout(ladeTimer);
    if (L) L.ctx.clearRect(0, 0, L.canvas.width, L.canvas.height);
    karteZu();
    const c = $("cnt-ships"); if (c) c.textContent = "";
  }

  // ---------- Zeichnen ----------
  let raf = 0, zuletzt = 0, spaeter = 0;
  function zeichneBald() {
    if (raf || spaeter) return;
    // Handy / Leistungsmodus „Flüssig“: höchstens ~10 Bilder pro Sekunde für die Schiffe
    const warte = fluessig() ? 100 - (performance.now() - zuletzt) : 0;
    if (warte > 0) { spaeter = setTimeout(() => { spaeter = 0; zeichneBald(); }, warte); return; }
    raf = requestAnimationFrame(() => { raf = 0; zuletzt = performance.now(); zeichne(); });
  }
  function zeichne() {
    if (!L) return;
    const { ctx, canvas, dpr } = L;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!an() || !offen() || !schiffe.length) return;
    const p = L.projektor();
    if (!p) return;
    const n = schiffe.length;
    if (!sx || sx.length < n) { sx = new Float32Array(n + 2000); sy = new Float32Array(n + 2000); sicht = new Uint8Array(n + 2000); }
    const aktivNr = gruppen.map((g) => aktiv.has(g.id));
    const out = [0, 0];
    const nah = p.zoom >= 3;            // nah dran: Dreiecke mit Kurs
    const d = (nah ? 2.2 : 1.5) * dpr * (fluessig() ? 0.9 : 1);
    const nachGruppe = gruppen.map(() => []);
    let gezeigt = 0;
    for (let i = 0; i < n; i++) {
      sicht[i] = 0;
      const s = schiffe[i];
      if (!aktivNr[s[5]] && s[0] !== gewaehlt && !(treffer && treffer.has(s[0]))) continue;
      if (!p.vek(ux[i], uy[i], uz[i], out)) continue;
      sx[i] = out[0]; sy[i] = out[1]; sicht[i] = 1;
      nachGruppe[s[5]].push(i);
      gezeigt++;
    }
    for (let gi = 0; gi < gruppen.length; gi++) {
      const liste = nachGruppe[gi];
      if (!liste.length) continue;
      ctx.fillStyle = FARBEN[gruppen[gi].id] || "#ccc";
      ctx.globalAlpha = 0.9;
      if (!nah) { for (const i of liste) ctx.fillRect(sx[i] - d / 2, sy[i] - d / 2, d, d); continue; }
      ctx.beginPath();
      for (const i of liste) {
        const s = schiffe[i];
        const gr = d * (s[7] > 200 ? 1.8 : s[7] > 100 ? 1.4 : 1);
        if (s[4] == null || !(s[3] > 0.5)) { ctx.rect(sx[i] - gr / 2, sy[i] - gr / 2, gr, gr); continue; }
        const a = (s[4] - 90) * Math.PI / 180, c = Math.cos(a), si = Math.sin(a);
        // Dreieck in Fahrtrichtung (Kurs 0° = Norden = oben)
        ctx.moveTo(sx[i] + c * gr * 1.6, sy[i] + si * gr * 1.6);
        ctx.lineTo(sx[i] - c * gr - si * gr * 0.8, sy[i] - si * gr + c * gr * 0.8);
        ctx.lineTo(sx[i] - c * gr + si * gr * 0.8, sy[i] - si * gr - c * gr * 0.8);
        ctx.closePath();
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (treffer && treffer.size && treffer.size <= 300) {
      ctx.strokeStyle = "rgba(255,170,60,.95)"; ctx.lineWidth = 1.2 * dpr;
      for (let i = 0; i < n; i++) if (sicht[i] && treffer.has(schiffe[i][0])) { ctx.beginPath(); ctx.arc(sx[i], sy[i], 5 * dpr, 0, 7); ctx.stroke(); }
    }
    if (gewaehlt) {
      const i = schiffe.findIndex((s) => s[0] === gewaehlt);
      const farbe = FARBEN[gruppen[schiffe[i]?.[5]]?.id] || "#fff";
      // Spur der letzten Stunde
      if (detail?.spur?.length > 1) {
        ctx.strokeStyle = farbe; ctx.lineWidth = 1.4 * dpr; ctx.globalAlpha = 0.8; ctx.setLineDash([4 * dpr, 3 * dpr]);
        ctx.beginPath(); let auf = false;
        for (const [la, lo] of detail.spur) { if (p(la, lo, out)) { if (auf) ctx.lineTo(out[0], out[1]); else { ctx.moveTo(out[0], out[1]); auf = true; } } else auf = false; }
        if (i >= 0 && sicht[i] && auf) ctx.lineTo(sx[i], sy[i]);
        ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      // Weg zum Ziel-Hafen (Luftlinie, gestrichelt) + Hafen-Anker (v1.121.0)
      const h = extra?.mmsi === gewaehlt ? extra.hafen : null;
      if (h && detail) {
        const R = Math.PI / 180, v = (la, lo) => [Math.cos(la * R) * Math.cos(lo * R), Math.cos(la * R) * Math.sin(lo * R), Math.sin(la * R)];
        const a = v(detail.lat, detail.lon), b = v(h.lat, h.lon);
        const om = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
        ctx.strokeStyle = "#ffd04d"; ctx.lineWidth = 1.3 * dpr; ctx.globalAlpha = 0.85; ctx.setLineDash([2 * dpr, 4 * dpr]);
        ctx.beginPath(); let auf = false;
        const n = Math.max(2, Math.ceil(om / (2 * R)));
        for (let k = 0; k <= n; k++) {
          const t = k / n, s1 = om ? Math.sin((1 - t) * om) / Math.sin(om) : 1 - t, s2 = om ? Math.sin(t * om) / Math.sin(om) : t;
          const x = s1 * a[0] + s2 * b[0], y = s1 * a[1] + s2 * b[1], z = s1 * a[2] + s2 * b[2];
          if (p(Math.asin(z) / R, Math.atan2(y, x) / R, out)) { if (auf) ctx.lineTo(out[0], out[1]); else { ctx.moveTo(out[0], out[1]); auf = true; } } else auf = false;
        }
        ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        if (p(h.lat, h.lon, out)) {
          ctx.font = `${13 * dpr}px system-ui, sans-serif`; ctx.fillStyle = "#ffd04d"; ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 4 * dpr;
          ctx.fillText("⚓ " + h.name, out[0] - 6 * dpr, out[1] + 5 * dpr); ctx.shadowBlur = 0;
        }
      }
      if (i >= 0 && sicht[i]) {
        ctx.strokeStyle = farbe; ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath(); ctx.arc(sx[i], sy[i], 8 * dpr, 0, 7); ctx.stroke();
        ctx.font = `${11 * dpr}px system-ui, sans-serif`; ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 4 * dpr;
        ctx.fillText(schiffe[i][6] || String(gewaehlt), sx[i] + 10 * dpr, sy[i] - 8 * dpr); ctx.shadowBlur = 0;
      }
    }
    const cnt = $("cnt-ships");
    if (cnt) cnt.textContent = gezeigt ? ` ${zahl(gezeigt)}` : "";
  }

  // ---------- Antippen + Steckbrief ----------
  function tippen(cx, cy, radiusCss) {
    if (!sx || !L || !an() || !schiffe.length) return null;
    const r = L.canvas.getBoundingClientRect();
    const px = (cx - r.left) * L.dpr, py = (cy - r.top) * L.dpr, radius = radiusCss * L.dpr;
    let best = -1, bd = radius * radius;
    for (let i = 0; i < schiffe.length; i++) {
      if (!sicht[i]) continue;
      const dd = (sx[i] - px) ** 2 + (sy[i] - py) ** 2;
      if (dd < bd) { bd = dd; best = i; }
    }
    if (best < 0) return null;
    const mmsi = schiffe[best][0];
    return { d2: bd / (L.dpr * L.dpr), nimm: () => waehle(mmsi, false) };
  }

  async function waehle(mmsi, fliegen = true) {
    gewaehlt = mmsi; detail = null; extra = null;
    $("lage-satcard")?.remove(); $("lage-markercard")?.remove(); $("lage-shipcard")?.remove();
    const s = schiffe.find((x) => x[0] === mmsi);
    if (fliegen && s) { const g = G(), pr = g?.projektion?.(); if (pr) g.zu(s[2], s[1], Math.max(4, pr.scale() / g.basis())); }
    zeigeKarte(s);
    zeichneBald();
    await ladeDetail();
    ladeExtra(mmsi);
    clearInterval(karteTimer);
    karteTimer = setInterval(() => { if (!$("lage-planecard-schiff")) { clearInterval(karteTimer); return; } ladeDetail(); }, 30000);
  }

  async function ladeDetail() {
    const mmsi = gewaehlt;
    try {
      const r = await api(`/api/schiffe/${mmsi}`);
      const d = await r.json();
      if (mmsi !== gewaehlt) return;
      if (!r.ok) { fuelleKarte(null, d.error); return; }
      detail = d;
      fuelleKarte(d);
      zeichneBald();
    } catch { if (mmsi === gewaehlt) fuelleKarte(null, "Gerade nicht erreichbar."); }
  }

  // Mehr zum Schiff aus freien Quellen: Ziel-Hafen (UN/LOCODE), Foto + Text (Wikidata/Wikipedia)
  async function ladeExtra(mmsi) {
    try {
      const r = await api(`/api/schiffe/${mmsi}/extra`);
      if (!r.ok || mmsi !== gewaehlt) return;
      extra = { mmsi, ...(await r.json()) };
      zeigeExtra();
      zeichneBald();
    } catch { /* ohne Extras */ }
  }
  function zeigeExtra() {
    const card = $("lage-planecard-schiff");
    if (!card || !extra || extra.mmsi !== gewaehlt) return;
    card.querySelector(".sc-extra")?.remove();
    const div = document.createElement("div");
    div.className = "sc-extra";
    const h = extra.hafen, w = extra.wiki;
    const std = h?.restzeit_h;
    const rest = std == null ? "" : std < 1 ? "unter 1 Stunde" : std < 48 ? `ca. ${Math.round(std)} Std.` : `ca. ${Math.round(std / 24)} Tage`;
    let html = "";
    if (h) html += `<div class="sc-abschnitt">Ziel-Hafen</div><div class="mc-rows"><span>Hafen</span><b>⚓ ${esc(h.name)} <small>(${esc(h.code)})</small></b><span>Land</span><b>${esc(h.land)}</b>${h.entfernung_km != null ? `<span>Entfernung</span><b>${zahl(h.entfernung_km)} km Luftlinie</b>` : ""}${rest ? `<span>Noch unterwegs</span><b>${rest} <small>(bei jetzigem Tempo)</small></b>` : ""}</div>`;
    if (w) {
      html += `<div class="sc-abschnitt">Über das Schiff</div>`;
      if (w.bild) html += `<a class="sc-foto" href="${esc(w.quelle)}" target="_blank" rel="noopener noreferrer"><img src="${esc(w.bild)}" alt="${esc(w.name)}" loading="lazy" onerror="this.parentNode.remove()"><small>Foto: Wikimedia Commons</small></a>`;
      html += `<div class="mc-rows">${[["Baujahr", w.baujahr], ["Werft", w.werft], ["Art", w.typ]].filter(([, v]) => v).map(([k, v]) => `<span>${k}</span><b>${esc(v)}</b>`).join("")}</div>`;
      if (w.text) html += `<p class="sc-text">${esc(w.text)}</p>`;
    }
    if (extra.links?.length) html += `<div class="sc-links">${extra.links.map((l) => `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.name)} ↗</a>`).join("")}</div>`;
    div.innerHTML = html;
    card.querySelector(".sc-inhalt")?.append(div);
    card.querySelector(".sc-hafen")?.classList.toggle("hidden", !h);
  }

  function zeigeKarte(s) {
    let card = $("lage-planecard-schiff");
    if (!card) {
      card = document.createElement("div");
      card.id = "lage-planecard-schiff"; card.className = "lage-satcard";
      $("lage")?.append(card);
    }
    const g = gruppen[s?.[5]];
    card.innerHTML = `<button class="ship-x" title="Schließen" data-a="zu">✕</button>
      <div class="sc-kopf"><i class="sc-dot" style="--f:${FARBEN[g?.id] || "#ccc"}"></i>
      <div><div class="mc-type">🚢 Schiff · ${esc(g?.name || "")} · <span class="mc-dot">● live</span></div>
      <div class="mc-title">${esc(s?.[6] || "Schiff " + gewaehlt)}</div></div></div>
      <div class="sc-inhalt"><div class="mc-rows"><span>MMSI</span><b>${gewaehlt}</b><span>Angaben</span><b>werden geladen …</b></div></div>
      <div class="sc-knoepfe"><button type="button" class="chip" data-a="hin">◎ Hinfliegen</button><button type="button" class="chip sc-hafen hidden" data-a="hafen">⚓ Ziel-Hafen</button></div>`;
    card.onclick = (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "zu") karteZu();
      else if (a === "hafen" && extra?.hafen) { const gg = G(), pr = gg?.projektion?.(); if (pr) gg.zu(extra.hafen.lon, extra.hafen.lat, Math.max(4, pr.scale() / gg.basis())); }
      else if (a === "hin" && detail) { const gg = G(), pr = gg?.projektion?.(); if (pr) gg.zu(detail.lon, detail.lat, Math.max(4, pr.scale() / gg.basis())); }
    };
  }

  function fuelleKarte(d, fehler) {
    const card = $("lage-planecard-schiff");
    if (!card) return;
    const box = card.querySelector(".sc-inhalt");
    if (!d) { box.innerHTML = `<div class="mc-rows"><span>MMSI</span><b>${gewaehlt}</b><span>Hinweis</span><b>${esc(fehler || "keine Daten")}</b></div>`; return; }
    const ueber = G()?.landAn?.(d.lon, d.lat);
    const naechstes = G()?.land?.(d.lon, d.lat) || "";
    const ort = ueber ? ueber : `Meer${naechstes ? " (nächstes Land: " + naechstes + ")" : ""}`;
    const alt = d.letzte_meldung ? Math.round((Date.now() - Date.parse(d.letzte_meldung)) / 60000) : null;
    const reihen = (liste) => liste.filter(([, v]) => v != null && v !== "").map(([k, v, html]) => `<span>${esc(k)}</span><b>${html ? v : esc(v)}</b>`).join("");
    box.innerHTML = `<div class="sc-abschnitt">Jetzt gerade</div><div class="mc-rows">${reihen([
      ["Position", `${Math.abs(d.lat).toFixed(3)}° ${d.lat >= 0 ? "N" : "S"}, ${Math.abs(d.lon).toFixed(3)}° ${d.lon >= 0 ? "O" : "W"}`],
      ["Wo", ort],
      ["Status", d.status],
      ["Tempo", d.tempo_kn != null ? `${zahl(d.tempo_kn, 1)} Knoten <small>(${zahl(d.tempo_kmh, 1)} km/h)</small>` : null, true],
      ["Kurs", d.kurs != null ? `${d.kurs}° ${himmel(d.kurs)}` : null],
      ["Letzte Meldung", alt != null ? (alt < 1 ? "gerade eben" : `vor ${alt} Min.`) : null],
    ])}</div>
    <div class="sc-abschnitt">Reise</div><div class="mc-rows">${reihen([
      ["Ziel", d.ziel || "nicht angegeben"], ["Ankunft geplant", d.ankunft],
    ])}</div>
    <div class="sc-abschnitt">Steckbrief</div><div class="mc-rows">${reihen([
      ["Typ", d.typ], ["Flagge", d.flagge], ["Länge", d.laenge_m ? `${d.laenge_m} m` : null], ["Breite", d.breite_m ? `${d.breite_m} m` : null],
      ["Tiefgang", d.tiefgang_m ? `${zahl(d.tiefgang_m, 1)} m` : null], ["IMO-Nr.", d.imo], ["MMSI", d.mmsi], ["Rufzeichen", d.rufzeichen], ["AIS-Klasse", d.klasse],
    ])}</div>`;
    zeigeExtra();
  }
  const himmel = (k) => ["(Nord)", "(Nordost)", "(Ost)", "(Südost)", "(Süd)", "(Südwest)", "(West)", "(Nordwest)"][Math.round(k / 45) % 8];

  function karteZu() {
    $("lage-planecard-schiff")?.remove();
    clearInterval(karteTimer);
    gewaehlt = 0; detail = null; extra = null;
    zeichneBald();
  }

  // ---------- Filter & Suche ----------
  function panel() {
    let p = $("ship-panel");
    if (p) return p;
    p = document.createElement("div");
    p.id = "ship-panel"; p.className = "sat-panel hidden";
    p.innerHTML = `<button class="ship-x" title="Schließen" data-a="zu">✕</button>
      <h3>🚢 Schiffe weltweit</h3>
      <p class="sat-status" id="ship-status">–</p>
      <input id="ship-suche" class="sat-sucheingabe" type="search" autocomplete="off" placeholder="Suchen: Schiffsname oder MMSI">
      <div id="ship-treffer" class="sat-treffer"></div>
      <div class="sat-gruppen-kopf"><span>Schiffstypen</span><button type="button" class="chip" data-a="alle">Alle</button><button type="button" class="chip" data-a="keine">Keine</button></div>
      <div id="ship-gruppen" class="sat-gruppen"></div>
      <p class="sat-ehrlich">Gezeigt werden alle Schiffe, deren AIS-Signal öffentliche Empfänger gerade auffangen (über aisstream.io). Auf hoher See fehlen viele, weil dort kein Empfänger an Land mithört. Kriegsschiffe und manche Fischer schalten AIS ab – die sieht niemand öffentlich.</p>`;
    $("lage")?.append(p);
    p.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "zu") p.classList.add("hidden");
      else if (a === "alle") { aktiv = new Set(gruppen.map((g) => g.id)); speichereFilter(); baueFilter(); zeichneBald(); }
      else if (a === "keine") { aktiv = new Set(); speichereFilter(); baueFilter(); zeichneBald(); }
      const gb = e.target.closest("[data-g]");
      if (gb) { const id = gb.dataset.g; if (aktiv.has(id)) aktiv.delete(id); else aktiv.add(id); speichereFilter(); baueFilter(); zeichneBald(); }
      const tr = e.target.closest("[data-m]");
      if (tr) { waehle(Number(tr.dataset.m)); if (matchMedia("(max-width: 900px)").matches) p.classList.add("hidden"); }
    });
    let t = null;
    const inp = p.querySelector("#ship-suche");
    inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => suche(inp.value), 200); });
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") p.querySelector("[data-m]")?.click(); if (e.key === "Escape") { inp.value = ""; suche(""); } });
    baueFilter();
    return p;
  }
  function baueFilter() {
    const box = $("ship-gruppen");
    if (!box) return;
    const z = {};
    for (const s of schiffe) z[s[5]] = (z[s[5]] || 0) + 1;
    box.innerHTML = gruppen.map((g, i) => `<button type="button" class="sat-g${aktiv.has(g.id) ? " on" : ""}" data-g="${g.id}" title="${esc(g.info)}">
      <i style="--f:${FARBEN[g.id] || "#ccc"}"></i><span>${esc(g.name)}</span><b>${zahl(z[i] || 0)}</b></button>`).join("");
    const st = $("ship-status");
    if (!st) return;
    if (!info.aktiv) st.textContent = "Schiffe brauchen einen kostenlosen aisstream.io-Schlüssel (AISSTREAM_API_KEY in der .env).";
    else if (!schiffe.length) st.textContent = info.verbunden ? "Verbunden – die ersten Schiffe kommen gleich an …" : "Verbinde mit aisstream.io …";
    else st.textContent = `${zahl(schiffe.length)} Schiffe gerade empfangen · Stand ${new Date(stand).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · antippen für Steckbrief`;
  }
  function suche(q) {
    const box = $("ship-treffer");
    q = String(q || "").trim().toUpperCase();
    if (!q) { treffer = null; if (box) box.innerHTML = ""; zeichneBald(); return; }
    const nr = /^\d{6,9}$/.test(q) ? Number(q) : 0;
    const liste = schiffe.filter((s) => (nr && s[0] === nr) || (s[6] && s[6].includes(q)));
    liste.sort((a, b) => (b[6].startsWith(q) - a[6].startsWith(q)) || (b[7] - a[7]));
    treffer = new Set(liste.slice(0, 2000).map((s) => s[0]));
    if (box) {
      box.innerHTML = liste.length
        ? `<small>${zahl(liste.length)} Treffer</small>` + liste.slice(0, 8).map((s) => `<button type="button" class="sat-hit" data-m="${s[0]}"><i style="--f:${FARBEN[gruppen[s[5]]?.id]}"></i>${esc(s[6] || "ohne Namen")}<small>${s[7] ? s[7] + " m" : s[0]}</small></button>`).join("")
        : "<small>Kein Schiff gefunden.</small>";
    }
    zeichneBald();
  }
  function legendeKnopf() {
    const lab = $("lage-ships-on")?.closest("label");
    if (!lab || $("ship-filter-btn")) return;
    const span = lab.querySelector("span");
    if (span && !$("cnt-ships")) { const i = document.createElement("i"); i.id = "cnt-ships"; i.className = "cnt-ebene"; span.append(i); }
    const b = document.createElement("button");
    b.type = "button"; b.id = "ship-filter-btn"; b.className = "chip sat-filter-btn"; b.textContent = "🚢 Filter & Suche";
    b.addEventListener("click", (e) => { e.preventDefault(); oeffnePanel(); });
    lab.after(b);
  }
  function oeffnePanel() {
    const p = panel();
    $("sat-panel")?.classList.add("hidden"); $("plane-panel")?.classList.add("hidden");
    p.classList.remove("hidden");
    if (!an()) { $("lage-ships-on").checked = true; $("lage-ships-on").dispatchEvent(new Event("change", { bubbles: true })); }
    starten();
  }

  // ---------- Verdrahtung ----------
  legendeKnopf();
  window.addEventListener("friday-lage", (e) => { if (e.detail?.offen) { legendeKnopf(); starten(); } else { clearTimeout(ladeTimer); $("ship-panel")?.classList.add("hidden"); } });
  document.addEventListener("change", (e) => { if (e.target?.id === "lage-ships-on") { if (e.target.checked) starten(); else stoppen(); } });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && an() && offen()) takt(); });

  window.FridaySchiffe = {
    oeffne: oeffnePanel,
    async zeigeNr(mmsi) {
      if (!offen()) $("lage-btn")?.click();
      if (!an()) $("lage-ships-on").checked = true;
      await starten(); await laden();
      waehle(mmsi);
    },
    async gruppe(id) {
      if (!offen()) $("lage-btn")?.click();
      if (!an()) $("lage-ships-on").checked = true;
      await starten(); await laden();
      if (gruppen.some((g) => g.id === id)) { aktiv = new Set([id]); speichereFilter(); }
      oeffnePanel(); baueFilter(); zeichneBald();
    },
  };
})();
