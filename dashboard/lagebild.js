// F.R.Ai.D.A.Y Lagebild: zusätzliche Ebenen im Weltgeschehen (eigene Friday-Umsetzung, nur freie Quellen).
// Konflikt-Meldungen, Internet-Störungen, Wind/Temperatur/Regen, Luftqualität, Polarlicht,
// Raketenstarts, Seekabel, dazu Regenradar/Wolken/Nachtlichter in der Detailkarte und die
// Lagebild-Leiste mit allem auf einen Blick.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api || ((u) => fetch(u));
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const G = () => window.FridayGlobus;
  const lageOffen = () => !$("lage")?.classList.contains("hidden");

  // Ebenen: Schalter-ID, Gruppe im Globus, Lader. Zustand wird pro Ebene gemerkt.
  const EBENEN = {
    konflikt: { an: true, url: "/api/lagebild/konflikte", alle: 10 * 60 * 1000 },
    netz: { an: true, url: "/api/lagebild/internet", alle: 15 * 60 * 1000 },
    wind: { an: false, url: "/api/lagebild/wetter", alle: 60 * 60 * 1000 },
    temp: { an: false, url: "/api/lagebild/wetter", alle: 60 * 60 * 1000 },
    regen: { an: false, url: "/api/lagebild/wetter", alle: 60 * 60 * 1000 },
    luft: { an: false, url: "/api/lagebild/luft", alle: 60 * 60 * 1000 },
    raketen: { an: true, url: "/api/lagebild/raketen", alle: 60 * 60 * 1000 },
    polar: { an: false, url: "/api/lagebild/polarlicht", alle: 15 * 60 * 1000 },
    kabel: { an: false, url: "/api/lagebild/seekabel", alle: 24 * 3600 * 1000 },
    radar: { an: false, detail: true }, wolken: { an: false, detail: true }, lichter: { an: false, detail: true },
  };
  const daten = {}; // url -> { at, d }
  const box = (k) => $("lage-lb-" + k + "-on");
  const istAn = (k) => !!box(k)?.checked;

  // Gemerkte Schalter laden (friday_lb_* wird automatisch mit dem Mac abgeglichen).
  for (const k of Object.keys(EBENEN)) {
    const b = box(k); if (!b) continue;
    try { const v = localStorage.getItem("friday_lb_" + k); b.checked = v == null ? EBENEN[k].an : v === "1"; } catch { b.checked = EBENEN[k].an; }
  }

  async function hole(url, frisch) {
    const c = daten[url];
    const alle = Object.values(EBENEN).find((e) => e.url === url)?.alle || 10 * 60 * 1000;
    if (c && !frisch && Date.now() - c.at < alle) return c.d;
    const d = await (await api(url)).json();
    if (d && !d.error) daten[url] = { at: Date.now(), d };
    return d;
  }

  // ---------- Gruppen im Globus ----------
  const GRUPPEN = ["kabel", "polar", "temp", "regen", "wind", "luft", "netz", "konflikt", "raketen"];
  function gruppe(k) {
    let g = $("lage-lb-g-" + k);
    if (g) return g;
    const svg = $("lage-map"); const glob = G();
    if (!svg || !glob) return null;
    g = glob.el("g", { id: "lage-lb-g-" + k, class: "lb-g lb-" + k });
    // Flächen-Ebenen unter die Marker, Punkt-Ebenen darüber.
    const vor = ["kabel", "polar", "temp", "regen"].includes(k) ? $("lage-routes") : $("lage-markers");
    svg.insertBefore(g, vor || null);
    return g;
  }

  const punkt = (k, lon, lat, attrs, kinder = []) => {
    const n = G().el("g", { class: "lb-p lb-p-" + k, ...attrs });
    n.dataset.lon = lon; n.dataset.lat = lat;
    for (const c of kinder) n.append(c);
    return n;
  };

  // Farben
  const tempFarbe = (t) => t == null ? "#888" : t <= -20 ? "#7d5cff" : t <= -5 ? "#4f8cff" : t <= 5 ? "#46c8ff" : t <= 15 ? "#5fe0a0" : t <= 25 ? "#ffd04d" : t <= 33 ? "#ff8a1e" : "#ff3b3b";
  const windFarbe = (v) => v == null ? "#aaa" : v < 15 ? "#9fe8ff" : v < 30 ? "#5fe0a0" : v < 50 ? "#ffd04d" : v < 75 ? "#ff8a1e" : "#ff3b3b";
  const luftFarbe = (a) => a == null ? "#888" : a <= 20 ? "#3ddc84" : a <= 40 ? "#a5e05a" : a <= 60 ? "#ffd04d" : a <= 80 ? "#ff8a1e" : a <= 100 ? "#ff3b3b" : "#b03cff";

  async function zeichne(k, frisch = false) {
    const g = gruppe(k);
    if (!g) return;
    if (!istAn(k)) { g.replaceChildren(); zaehler(k, ""); return; }
    const e = EBENEN[k];
    let d;
    try { d = await hole(e.url, frisch); } catch { zaehler(k, " !"); return; }
    if (!istAn(k) || !d) return;
    const el = G().el;
    const kinder = [];
    if (k === "konflikt") {
      for (const c of d.laender || []) {
        const r = Math.min(16, 5 + c.meldungen * 0.9);
        const n = punkt(k, c.lon, c.lat, { class: "lb-p lb-p-konflikt " + c.art, role: "button" }, [
          el("circle", { r: r * 1.9, class: "lb-puls" }), el("circle", { r, class: "lb-kern" }),
          el("path", { d: "M-4,-4L4,4M4,-4L-4,4", class: "lb-x" }),
        ]);
        n.__info = { typ: "konflikt", ...c };
        kinder.push(n);
      }
      zaehler(k, d.laender?.length ? ` ${d.laender.length}` : "");
    } else if (k === "netz") {
      const aktiv = (d.stoerungen || []).filter((s) => s.aktiv);
      for (const s of d.stoerungen || []) {
        if (!s.aktiv && s.stufe !== "behoben") continue;
        const n = punkt(k, s.lon, s.lat, { class: "lb-p lb-p-netz " + (s.aktiv ? s.stufe : "behoben"), role: "button" }, [
          el("circle", { r: s.aktiv ? 13 : 7, class: "lb-ring" }),
          el("path", { d: "M-6,-1.5a8.5,8.5 0 0 1 12,0M-3.6,1.6a5,5 0 0 1 7.2,0", class: "lb-wlan" }), el("circle", { r: 1.6, cy: 4.2, class: "lb-wlan-p" }),
        ]);
        n.__info = { typ: "netz", ...s };
        kinder.push(n);
      }
      zaehler(k, aktiv.length ? ` ${aktiv.length}` : " 0");
    } else if (k === "wind") {
      for (const p of d.punkte || []) {
        if (p.wind == null || p.richtung == null) continue;
        const len = Math.min(22, 7 + p.wind * 0.25);
        const n = punkt(k, p.lon, p.lat, { class: "lb-p lb-p-wind", "data-rot": (p.richtung + 180) % 360 }, [
          el("path", { d: `M0,${len / 2}L0,${-len / 2}M-3.5,${-len / 2 + 5}L0,${-len / 2}L3.5,${-len / 2 + 5}`, stroke: windFarbe(p.wind) }),
        ]);
        n.__info = { typ: "wetter", ...p };
        kinder.push(n);
      }
    } else if (k === "temp") {
      for (const p of d.punkte || []) {
        if (p.temp == null) continue;
        const n = punkt(k, p.lon, p.lat, { class: "lb-p lb-p-temp" }, [el("circle", { r: 9, fill: tempFarbe(p.temp) })]);
        n.__info = { typ: "wetter", ...p };
        kinder.push(n);
      }
    } else if (k === "regen") {
      for (const p of d.punkte || []) {
        if (!(p.regen > 0.05) && !(p.wolken >= 85)) continue;
        const r = p.regen > 0.05 ? Math.min(14, 4 + p.regen * 3) : 6;
        const n = punkt(k, p.lon, p.lat, { class: "lb-p lb-p-regen" + (p.regen > 0.05 ? " nass" : " wolke") }, [el("circle", { r })]);
        n.__info = { typ: "wetter", ...p };
        kinder.push(n);
      }
    } else if (k === "luft") {
      let schlecht = 0;
      for (const s of d.staedte || []) {
        if (s.aqi == null) continue;
        if (s.aqi > 60) schlecht++;
        const n = punkt(k, s.lon, s.lat, { class: "lb-p lb-p-luft", role: "button" }, [el("rect", { x: -5, y: -5, width: 10, height: 10, rx: 2.5, fill: luftFarbe(s.aqi) })]);
        n.__info = { typ: "luft", ...s };
        kinder.push(n);
      }
      zaehler(k, schlecht ? ` ${schlecht}` : "");
    } else if (k === "raketen") {
      const jetzt = Date.now();
      const orte = new Map();
      for (const s of d.starts || []) { const key = s.lat.toFixed(1) + "," + s.lon.toFixed(1); if (!orte.has(key)) orte.set(key, []); orte.get(key).push(s); }
      for (const liste of orte.values()) {
        const s = liste[0];
        const bald = new Date(s.zeit).getTime() - jetzt < 24 * 3600 * 1000;
        const n = punkt(k, s.lon, s.lat, { class: "lb-p lb-p-raketen" + (bald ? " bald" : ""), role: "button" }, [
          el("circle", { r: 11, class: "lb-ring" }), el("path", { d: "M0,-8C3,-5 3,1 2.4,4L-2.4,4C-3,1 -3,-5 0,-8ZM-2.4,4L-4.6,7L-1,5.2M2.4,4L4.6,7L1,5.2", class: "lb-rakete" }),
        ]);
        n.__info = { typ: "raketen", starts: liste };
        kinder.push(n);
      }
      zaehler(k, d.starts?.length ? ` ${d.starts.length}` : "");
    } else if (k === "polar") {
      // Jeder zweite Punkt reicht für das Leuchtband (schont das iPhone).
      for (const [lon, lat, v] of (d.punkte || []).filter((p) => p[0] % 6 === 0)) {
        const n = punkt(k, lon, lat, { class: "lb-p lb-p-polar" }, [el("circle", { r: 8, opacity: Math.min(0.5, 0.06 + v / 80) })]);
        kinder.push(n);
      }
    } else if (k === "kabel") {
      const pfad = el("path", { class: "lb-kabel-pfad", "pointer-events": "none" });
      pfad.__geo = { type: "MultiLineString", coordinates: d.linien || [] };
      kinder.push(pfad);
    }
    g.replaceChildren(...kinder);
    platziere();
  }

  function zaehler(k, txt) {
    const i = box(k)?.parentElement?.querySelector("i[id^='cnt-']");
    if (i) i.textContent = txt;
  }

  // Bei jedem Neuzeichnen des Globus: Punkte an ihre Stelle setzen (nur Vorderseite).
  function platziere() {
    const glob = G(); const proj = glob?.projektion();
    if (!proj) return;
    const s = proj.scale() / (glob.basis() || 1);
    const zoom = Math.min(1.6, Math.max(0.75, Math.sqrt(s)));
    for (const k of GRUPPEN) {
      const g = $("lage-lb-g-" + k);
      if (!g || !g.firstChild) continue;
      if (k === "kabel") { const p = g.firstChild; p.setAttribute("d", glob.pfad()(p.__geo) || ""); continue; }
      for (const n of g.children) {
        const lon = +n.dataset.lon, lat = +n.dataset.lat;
        if (!glob.visible(lon, lat)) { n.style.display = "none"; continue; }
        n.style.display = "";
        const p = proj([lon, lat]);
        const rot = n.dataset.rot ? ` rotate(${n.dataset.rot})` : "";
        const sk = k === "polar" ? Math.max(1, Math.min(2.2, s * 0.9)) : k === "temp" || k === "regen" || k === "wind" ? Math.max(0.8, Math.min(2.5, s * 0.75)) : zoom;
        n.setAttribute("transform", `translate(${p[0].toFixed(1)},${p[1].toFixed(1)})${rot} scale(${sk.toFixed(2)})`);
      }
    }
  }

  // ---------- Info-Karten beim Antippen ----------
  const zeitFmt = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
  const countdown = (iso) => {
    const ms = new Date(iso).getTime() - Date.now();
    if (!Number.isFinite(ms)) return "";
    if (ms < 0) return ms > -3 * 3600e3 ? "gerade gestartet" : "vorbei";
    const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
    return h >= 48 ? `in ${Math.round(h / 24)} Tagen` : `T− ${h} h ${String(m).padStart(2, "0")} min`;
  };
  const sichererLink = (u) => /^https:\/\//.test(u || "") ? encodeURI(u) : "";

  function karte(html) {
    $("lage-markercard")?.remove(); $("lage-shipcard")?.remove();
    let c = $("lage-lbcard");
    if (!c) { c = document.createElement("div"); c.id = "lage-lbcard"; c.className = "lage-shipcard lb-card"; $("lage")?.append(c); }
    c.innerHTML = `<button class="ship-x" title="Schließen">✕</button>${html}`;
    c.querySelector(".ship-x").addEventListener("click", () => c.remove());
    c.querySelector("[data-land]")?.addEventListener("click", (e) => { c.remove(); G()?.landWaehlen(e.currentTarget.dataset.land); });
    return c;
  }
  function zeigeInfo(i) {
    if (i.typ === "konflikt") {
      karte(`<div class="mc-type">${i.art === "kampf" ? "⚔ Konflikt-Meldungen" : "✊ Proteste / Unruhen"}</div>
        <div class="mc-title">${esc(i.flag)} ${esc(i.land)}</div>
        <div class="mc-rows"><span>Meldungen</span><b>${i.meldungen} heute (${i.anteil}% der Schlagzeilen)</b></div>
        <ul class="lb-news">${(i.schlagzeilen || []).map((s) => `<li>${sichererLink(s.link) ? `<a href="${sichererLink(s.link)}" target="_blank" rel="noopener">${esc(s.titel)}</a>` : esc(s.titel)}<small>${esc(s.quelle || "")}</small></li>`).join("")}</ul>
        <p class="lb-hinweis">Aus öffentlichen Schlagzeilen gezählt, keine bestätigte Lagemeldung.</p>
        <button class="chip" data-land="${esc(i.id)}">Land öffnen</button>`);
    } else if (i.typ === "netz") {
      karte(`<div class="mc-type">📶 Internet-Störung · ${i.aktiv ? (i.stufe === "stark" ? "stark" : "leicht") : "behoben"}</div>
        <div class="mc-title">${esc(i.flag)} ${esc(i.land)}</div>
        <div class="mc-rows">
          ${i.einbruch_prozent ? `<span>Einbruch</span><b>bis −${i.einbruch_prozent}%</b>` : ""}
          ${i.quellen?.length ? `<span>Gemessen über</span><b>${esc(i.quellen.join(", "))}</b>` : ""}
          ${i.seit ? `<span>Seit</span><b>${zeitFmt(i.seit)}</b>` : ""}
        </div>
        <p class="lb-hinweis">Quelle: IODA (Georgia Tech). Ursache kann Stromausfall, Abschaltung oder Technik sein.</p>
        <button class="chip" data-land="${esc(i.id)}">Land öffnen</button>`);
    } else if (i.typ === "wetter") {
      const land = G()?.land(i.lon, i.lat) || "";
      karte(`<div class="mc-type">☁ Wetter jetzt</div>
        <div class="mc-title">${i.lat}°, ${i.lon}°${land ? " · nahe " + esc(land) : ""}</div>
        <div class="mc-rows">
          <span>Temperatur</span><b>${i.temp ?? "–"} °C</b>
          <span>Wind</span><b>${i.wind ?? "–"} km/h aus ${i.richtung ?? "–"}°</b>
          <span>Regen</span><b>${i.regen ?? 0} mm</b>
          <span>Wolken</span><b>${i.wolken ?? "–"} %</b>
        </div><p class="lb-hinweis">Open-Meteo, Raster alle 15°.</p>`);
    } else if (i.typ === "luft") {
      karte(`<div class="mc-type">🌫 Luftqualität</div>
        <div class="mc-title">${esc(i.name)}</div>
        <div class="mc-rows"><span>Index (EU)</span><b style="color:${luftFarbe(i.aqi)}">${i.aqi} · ${esc(i.text)}</b>
        ${i.pm25 != null ? `<span>Feinstaub PM2,5</span><b>${i.pm25} µg/m³</b>` : ""}</div>
        <p class="lb-hinweis">Copernicus CAMS über Open-Meteo.</p>`);
    } else if (i.typ === "raketen") {
      const s0 = i.starts[0];
      karte(`<div class="mc-type">🚀 Raketenstart · ${esc(s0.ort)}</div>
        ${i.starts.slice(0, 3).map((s) => `<div class="lb-start">
          <div class="mc-title">${esc(s.name)}</div>
          <div class="mc-rows"><span>Start</span><b>${zeitFmt(s.zeit)} · <em class="lb-cd" data-zeit="${esc(s.zeit)}">${countdown(s.zeit)}</em></b>
          <span>Anbieter</span><b>${esc(s.anbieter)}</b>${s.umlaufbahn ? `<span>Ziel</span><b>${esc(s.umlaufbahn)}</b>` : ""}<span>Status</span><b>${esc(s.status_text || s.status)}</b></div>
          ${s.mission ? `<p class="lb-mission">${esc(s.mission)}</p>` : ""}
          ${sichererLink(s.video) ? `<a class="chip" href="${sichererLink(s.video)}" target="_blank" rel="noopener">▶ Live-Übertragung</a>` : ""}
        </div>`).join("")}`);
    }
  }
  $("lage-map")?.addEventListener("click", (e) => {
    const n = e.target.closest?.(".lb-p");
    if (n?.__info) { e.stopPropagation(); zeigeInfo(n.__info); }
  }, true);

  // ---------- Detailkarte (Leaflet): Regenradar, Wolken, Nachtlichter ----------
  let dmap = null; const dLayer = {};
  const gestern = () => new Date(Date.now() - 30 * 3600 * 1000).toISOString().slice(0, 10);
  async function detailEbenen() {
    const L = window.L;
    if (!dmap || !L) return;
    for (const k of ["radar", "wolken", "lichter"]) {
      if (!istAn(k)) { if (dLayer[k]) { dmap.removeLayer(dLayer[k]); dLayer[k] = null; } continue; }
      if (dLayer[k]) continue;
      if (k === "radar") {
        try {
          const r = await (await api("/api/lagebild/radar")).json();
          if (!r.pfad || !istAn(k) || dLayer[k]) continue;
          dLayer[k] = L.tileLayer(`${r.host}${r.pfad}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0.75, maxNativeZoom: 7, maxZoom: 19, zIndex: 30, attribution: "Regen © RainViewer" }).addTo(dmap);
        } catch { /* Radar optional */ }
      } else if (k === "wolken") {
        dLayer[k] = L.tileLayer(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA21_CorrectedReflectance_TrueColor/default/${gestern()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`, { opacity: 0.7, maxNativeZoom: 9, maxZoom: 19, zIndex: 20, attribution: "Wolken © NASA GIBS" }).addTo(dmap);
      } else if (k === "lichter") {
        dLayer[k] = L.tileLayer("https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png", { opacity: 0.85, maxNativeZoom: 8, maxZoom: 19, zIndex: 25, attribution: "Nachtlichter © NASA" }).addTo(dmap);
      }
    }
  }

  // ---------- Lagebild-Leiste: alles auf einen Blick ----------
  let lbTimer = null, cdTimer = null, lbDaten = null;
  const leisteAn = () => { try { return localStorage.getItem("friday_lb_leiste") !== "0"; } catch { return true; } };
  function kachel(id, ico, titel, wert, sub, stufe = "") {
    return `<button type="button" class="lb-k ${stufe}" data-k="${id}"><i>${ico}</i><span class="lb-t">${titel}</span><b>${wert}</b>${sub ? `<small>${sub}</small>` : ""}</button>`;
  }
  async function leiste(frisch) {
    const el = $("lage-lb");
    if (!el) return;
    el.classList.toggle("hidden", !leisteAn());
    $("lage-lb-btn")?.classList.toggle("active", leisteAn());
    if (!leisteAn()) return;
    if (!el.innerHTML) el.innerHTML = `<div class="lb-head">📡 LAGEBILD <em>wird geladen…</em></div>`;
    try {
      const u = lbDaten && !frisch && Date.now() - lbDaten.at < 5 * 60 * 1000 ? lbDaten.d : await (await api("/api/lagebild")).json();
      lbDaten = { at: Date.now(), d: u };
      let [beben, ereig] = await Promise.all([
        api("/api/lage-beben").then((r) => r.json()).catch(() => []),
        api("/api/lage-ereignisse").then((r) => r.json()).catch(() => ({})),
      ]);
      const starke = (Array.isArray(beben) ? beben : []).filter((q) => q.staerke >= 5);
      if (!ereig || typeof ereig !== "object") ereig = {};
      const w = u.weltraum;
      const kp = w?.kp;
      const n = u.naechster_start;
      el.innerHTML = `<div class="lb-head">📡 LAGEBILD <em>live · ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</em><button type="button" class="lb-zu" title="Leiste ausblenden">–</button></div>
        <div class="lb-grid">
          ${kachel("konflikt", "⚔", "Konflikt-Länder", u.konflikt_laender ?? "–", u.konflikt_top?.map((k) => k.flag || k.land).join(" ") || "", u.konflikt_laender > 8 ? "rot" : u.konflikt_laender > 3 ? "gelb" : "")}
          ${kachel("netz", "📶", "Internet-Störungen", u.internet_aktiv ?? "–", u.internet_top?.map((k) => k.flag || k.land).join(" ") || (u.internet_aktiv === 0 ? "alles normal" : ""), u.internet_aktiv > 3 ? "rot" : u.internet_aktiv > 0 ? "gelb" : "gruen")}
          ${kachel("beben", "💥", "Beben ab M5 (24 h)", starke.length, starke[0] ? `stärkstes M${starke[0].staerke.toFixed(1)}` : "", starke.some((q) => q.staerke >= 6.5) ? "rot" : starke.length ? "gelb" : "gruen")}
          ${kachel("feuer", "🔥", "Feuer / Unwetter", `${(ereig.feuer || []).length} / ${(ereig.stuerme || []).length + (ereig.fluten || []).length}`, "NASA EONET")}
          ${kachel("weltraum", "☀", "Weltraumwetter", kp != null ? `Kp ${kp.toFixed(1)}` : "–", w ? `${w.kp_text}${w.sonnenwind_kms ? ` · ${Math.round(w.sonnenwind_kms)} km/s` : ""}` : "", kp >= 5 ? "rot" : kp >= 4 ? "gelb" : "gruen")}
          ${kachel("raketen", "🚀", "Nächster Start", n ? `<span class="lb-cd" data-zeit="${esc(n.zeit)}">${countdown(n.zeit)}</span>` : "–", n ? esc(n.name.split("|")[0].trim()) : "")}
          ${kachel("luft", "🌫", "Schlechte Luft", u.luft_schlecht ?? "–", u.luft_top?.map((s) => s.name).join(", ") || "", u.luft_schlecht > 5 ? "rot" : u.luft_schlecht ? "gelb" : "gruen")}
        </div>`;
      el.querySelector(".lb-zu")?.addEventListener("click", () => setLeiste(false));
      el.querySelectorAll(".lb-k").forEach((b) => b.addEventListener("click", () => kachelKlick(b.dataset.k, u)));
      // Lage-Plus (lageplus.js) hängt hier seine Kacheln an.
      window.dispatchEvent(new CustomEvent("friday-lb-leiste", { detail: { grid: el.querySelector(".lb-grid") } }));
    } catch {
      el.innerHTML = `<div class="lb-head">📡 LAGEBILD <em>gerade nicht erreichbar</em><button type="button" class="lb-zu" title="Leiste ausblenden">–</button></div>`;
      el.querySelector(".lb-zu")?.addEventListener("click", () => setLeiste(false));
    }
  }
  function setLeiste(an) {
    try { localStorage.setItem("friday_lb_leiste", an ? "1" : "0"); } catch { /* egal */ }
    leiste(false);
  }
  function schalteEin(k) {
    const b = box(k);
    if (b && !b.checked) { b.checked = true; b.dispatchEvent(new Event("change", { bubbles: true })); }
  }
  async function kachelKlick(k, u) {
    if (k === "konflikt") { schalteEin("konflikt"); const d = await hole(EBENEN.konflikt.url).catch(() => null); const t = d?.laender?.[0]; if (t) { G()?.zu(t.lon, t.lat, 2.2); zeigeInfo({ typ: "konflikt", ...t }); } }
    else if (k === "netz") { schalteEin("netz"); const t = u.internet_top?.[0]; if (t) { G()?.zu(t.lon, t.lat, 2.2); zeigeInfo({ typ: "netz", ...t }); } }
    else if (k === "raketen") { schalteEin("raketen"); const n = u.naechster_start; if (n) { G()?.zu(n.lon, n.lat, 2.2); const d = await hole(EBENEN.raketen.url).catch(() => null); zeigeInfo({ typ: "raketen", starts: (d?.starts || [n]).filter((s) => s.ort === n.ort) }); } }
    else if (k === "weltraum") { schalteEin("polar"); const w = u.weltraum; G()?.zu(10, 62, 1.4); karte(`<div class="mc-type">☀ Weltraumwetter</div><div class="mc-title">Kp ${w?.kp != null ? w.kp.toFixed(1) : "–"} · ${esc(w?.kp_text || "")}</div>
      <div class="mc-rows"><span>Sonnenwind</span><b>${w?.sonnenwind_kms ? Math.round(w.sonnenwind_kms) + " km/s" : "–"}</b><span>Funk (R)</span><b>${w?.skalen?.funk ?? "–"}</b><span>Strahlung (S)</span><b>${w?.skalen?.strahlung ?? "–"}</b><span>Magnetsturm (G)</span><b>${w?.skalen?.geomagnetisch ?? "–"}</b></div>
      <div class="lb-spark">${(w?.kp_verlauf || []).map((v) => `<i style="height:${Math.max(6, v / 9 * 100)}%" class="${v >= 5 ? "rot" : v >= 4 ? "gelb" : ""}"></i>`).join("")}</div>
      <p class="lb-hinweis">Kp 0–9: ab 5 Magnetsturm, dann Polarlichter bis Mitteleuropa möglich. Grün auf dem Globus = Polarlicht-Vorhersage. Quelle NOAA.</p>`); }
    else if (k === "luft") { schalteEin("luft"); const t = u.luft_top?.[0]; const d = await hole(EBENEN.luft.url).catch(() => null); const s = d?.staedte?.find((x) => x.name === t?.name); if (s) { G()?.zu(s.lon, s.lat, 2.2); zeigeInfo({ typ: "luft", ...s }); } }
    else if (k === "beben") { const b = $("lage-quakes-on"); if (b && !b.checked) { b.checked = true; b.dispatchEvent(new Event("change", { bubbles: true })); } }
    else if (k === "feuer") { for (const id of ["lage-fires-on", "lage-storms-on"]) { const b = $(id); if (b && !b.checked) { b.checked = true; b.dispatchEvent(new Event("change", { bubbles: true })); } } }
  }

  // ---------- Schalter, Öffnen/Schließen ----------
  document.addEventListener("change", (e) => {
    const m = e.target?.id?.match(/^lage-lb-([a-z]+)-on$/);
    if (!m || !EBENEN[m[1]]) return;
    try { localStorage.setItem("friday_lb_" + m[1], e.target.checked ? "1" : "0"); } catch { /* egal */ }
    if (EBENEN[m[1]].detail) detailEbenen(); else zeichne(m[1]);
  });
  $("lage-lb-btn")?.addEventListener("click", () => setLeiste(!leisteAn()));

  let erstesMal = true;
  window.addEventListener("friday-lage", async (e) => {
    clearInterval(lbTimer); clearInterval(cdTimer); lbTimer = cdTimer = null;
    if (!e.detail?.offen) return;
    const glob = G();
    if (!glob) return;
    await glob.bereit();
    if (!lageOffen()) return;
    if (erstesMal) {
      erstesMal = false;
      glob.onRedraw(platziere);
      api("/api/lagebild/grenzen").then((r) => r.json()).then((l) => {
        const ul = $("lage-lb-grenzen");
        if (ul && Array.isArray(l)) ul.innerHTML = l.map((x) => `<li><b>${esc(x.was)}</b> – ${esc(x.warum)}</li>`).join("");
      }).catch(() => { /* bleibt Kurzfassung */ });
    }
    for (const k of GRUPPEN) zeichne(k);
    leiste(false);
    lbTimer = setInterval(() => { if (!lageOffen()) return; leiste(true); for (const k of ["konflikt", "netz", "raketen"]) zeichne(k); }, 10 * 60 * 1000);
    cdTimer = setInterval(() => document.querySelectorAll(".lb-cd").forEach((n) => { n.textContent = countdown(n.dataset.zeit); }), 30 * 1000);
  });

  window.FridayLagebild = {
    detailKarte: (m) => { dmap = m; detailEbenen(); },
    neu: () => { for (const k of GRUPPEN) zeichne(k, true); leiste(true); },
  };
})();
