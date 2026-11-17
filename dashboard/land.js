// F.R.Ai.D.A.Y Länder-Fenster: öffnet sich bei "Friday, zeig mir USA" / "Erzähl mir was über Japan".
// Flagge, Mini-Globus mit dem Land, Steckbrief-Kacheln, Fotos, Wikipedia-Kurztext, Schlagzeilen.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api, esc = F.escapeHtml || ((s) => String(s));
  let aktuell = null, globusLauf = 0;

  function close() {
    $("land")?.classList.add("hidden");
    globusLauf++;
  }
  $("land-x")?.addEventListener("click", close);
  $("land")?.addEventListener("click", (e) => { if (e.target.id === "land") close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("land")?.classList.contains("hidden")) close(); });

  const kachel = (icon, label, wert) => wert
    ? `<div class="land-tile"><span class="land-tile-i">${icon}</span><span class="land-tile-l">${esc(label)}</span><b>${esc(wert)}</b></div>` : "";

  function render(d) {
    aktuell = d;
    const fl = $("land-flag");
    fl.textContent = d.flagge || "";
    if (d.flaggeBild) {
      const img = new Image();
      img.alt = "";
      img.onload = () => { fl.textContent = ""; fl.append(img); };
      img.src = d.flaggeBild;
    }
    $("land-name").textContent = d.name;
    $("land-sub").textContent = [d.region, d.hauptstadt && `Hauptstadt ${d.hauptstadt}`].filter(Boolean).join(" · ");
    $("land-tiles").innerHTML =
      kachel("🏛️", "Hauptstadt", d.hauptstadt) +
      kachel("👥", "Einwohner", d.einwohnerText ? `ca. ${d.einwohnerText}` : "") +
      kachel("💰", "Währung", d.waehrung) +
      kachel("🌍", "Region", d.region) +
      kachel("🍃", "Luft", d.luft);

    const fotos = (d.fotos || []).filter((f) => f.bild);
    const hero = fotos.length ? fotos : (d.wiki?.bild ? [{ bild: d.wiki.bild, titel: d.name }] : []);
    $("land-fotos").innerHTML = hero.slice(0, 6).map((f, i) =>
      `<a class="land-foto${i === 0 ? " big" : ""}" href="${esc(f.seite || f.bild)}" target="_blank" rel="noopener"><img src="${esc(f.bild)}" alt="${esc(f.titel || d.name)}" loading="lazy" onerror="this.parentElement.remove()"></a>`).join("");
    $("land-fotos").classList.toggle("hidden", !hero.length);

    $("land-text").innerHTML = d.wiki?.text
      ? `<p>${esc(d.wiki.text)}</p>${d.wiki.link ? `<a href="${esc(d.wiki.link)}" target="_blank" rel="noopener" class="land-more">Mehr bei Wikipedia ↗</a>` : ""}`
      : '<p class="muted">Kein Wikipedia-Text erreichbar.</p>';

    const m = d.meldungen || [];
    $("land-news").innerHTML = m.length
      ? `<h3>AKTUELLE SCHLAGZEILEN</h3>` + m.slice(0, 3).map((n) => `<a class="land-news-row" href="${esc(n.link || "#")}" target="_blank" rel="noopener"><span>${esc(n.titel)}</span><small>${esc(n.quelle || "")}</small></a>`).join("")
      : "";
    globus(d);
  }

  async function open(id) {
    if (!api || !id) return;
    $("land")?.classList.remove("hidden");
    $("land-box")?.classList.add("loading");
    $("land-name").textContent = "Lade …";
    try {
      const r = await api(`/api/land/${encodeURIComponent(id)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Fehler");
      render(d);
    } catch (err) {
      $("land-name").textContent = "Land";
      $("land-text").innerHTML = `<p class="muted">Die Länder-Infos konnte ich gerade nicht laden (${esc(err.message)}).</p>`;
    } finally {
      $("land-box")?.classList.remove("loading");
    }
  }

  // ---- Mini-Globus: dreht sich zum Land, Land leuchtet Neon-Orange ----
  let geoLibs = null;
  function ladeGeo() {
    geoLibs ??= Promise.all([
      import("https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/+esm"),
      import("https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm"),
      fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json").then((r) => r.json()),
    ]).then(([geo, topo, world]) => ({ geo, land: topo.feature(world, world.objects.countries).features }))
      .catch((e) => { geoLibs = null; throw e; });
    return geoLibs;
  }
  async function globus(d) {
    const cv = $("land-globe");
    if (!cv) return;
    const lauf = ++globusLauf;
    let libs;
    try { libs = await ladeGeo(); } catch { cv.classList.add("hidden"); return; }
    cv.classList.remove("hidden");
    if (lauf !== globusLauf) return;
    const { geo, land } = libs;
    const ziel = land.find((f) => String(f.id) === String(d.id));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = cv.clientWidth || 220;
    cv.width = S * dpr; cv.height = S * dpr;
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--cyan").trim() || "#ff8a1e";
    const proj = geo.geoOrthographic().scale(S / 2 - 6).translate([S / 2, S / 2]).clipAngle(90);
    const path = geo.geoPath(proj, ctx);
    const grat = geo.geoGraticule10();
    const start = proj.rotate(), endRot = [-d.lon, -d.lat * 0.8, 0];
    const vonRot = [-(d.lon) + 120, 0, 0];
    const t0 = performance.now();
    const draw = (now) => {
      if (lauf !== globusLauf || $("land").classList.contains("hidden")) return;
      const k = Math.min(1, (now - t0) / 1600), e = 1 - Math.pow(1 - k, 3);
      const wackel = k >= 1 ? Math.sin((now - t0) / 1800) * 6 : 0;
      proj.rotate([vonRot[0] + (endRot[0] - vonRot[0]) * e + wackel, vonRot[1] + (endRot[1] - vonRot[1]) * e, 0]);
      ctx.clearRect(0, 0, S, S);
      ctx.beginPath(); path({ type: "Sphere" });
      const g = ctx.createRadialGradient(S * 0.4, S * 0.35, S * 0.05, S / 2, S / 2, S / 2);
      g.addColorStop(0, "rgba(60,30,8,.95)"); g.addColorStop(1, "rgba(8,4,2,.95)");
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = accent; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); path(grat); ctx.strokeStyle = "rgba(255,140,30,.10)"; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.beginPath(); land.forEach((f) => path(f));
      ctx.fillStyle = "rgba(255,140,30,.13)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,140,30,.35)"; ctx.lineWidth = 0.5; ctx.stroke();
      if (ziel) {
        ctx.save();
        ctx.beginPath(); path(ziel);
        ctx.shadowColor = accent; ctx.shadowBlur = 14 + Math.sin(now / 400) * 5;
        ctx.fillStyle = accent; ctx.globalAlpha = 0.85; ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = "#ffd9a8"; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
      } else {
        const p = proj([d.lon, d.lat]);
        if (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill(); }
      }
      requestAnimationFrame(draw);
    };
    void start;
    requestAnimationFrame(draw);
  }

  $("land-lage")?.addEventListener("click", () => {
    if (!aktuell) return;
    const id = aktuell.id;
    close();
    window.FridayLage?.showCountry(id);
  });
  $("land-sprich")?.addEventListener("click", () => {
    if (!aktuell) return;
    const d = aktuell;
    const teile = [`${d.name}.`];
    if (d.wiki?.text) teile.push(d.wiki.text);
    F.say?.(teile.join(" ").slice(0, 900));
  });

  window.FridayLand = { open, close };
})();
