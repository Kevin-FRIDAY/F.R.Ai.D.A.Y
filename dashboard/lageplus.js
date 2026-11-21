// F.R.Ai.D.A.Y Lage-Plus (v1.128.0): neun weitere Ebenen im Weltgeschehen, nur freie, öffentliche Quellen.
// Notfall-Flugzeuge, Meerengen-Verkehr, Reisewarnungen, Hurrikan-Kegel, WHO-Ausbrüche, Atomkraftwerke + Häfen,
// Strahlung, Brennpunkt-Melder, Stabilitäts-Wert. Dazu Kacheln in der Lagebild-Leiste.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api || ((u) => fetch(u));
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const G = () => window.FridayGlobus;
  const lageOffen = () => !$("lage")?.classList.contains("hidden");

  const EBENEN = {
    brenn: { an: true, url: "/api/lageplus/brennpunkte", alle: 10 * 60e3 },
    notflug: { an: true, url: "/api/lageplus/notflug", alle: 60e3 },
    enge: { an: true, url: "/api/lageplus/meerengen", alle: 3 * 3600e3 },
    hurrikan: { an: true, url: "/api/lageplus/hurrikane", alle: 20 * 60e3 },
    ausbruch: { an: true, url: "/api/lageplus/ausbrueche", alle: 3 * 3600e3 },
    reise: { an: false, url: "/api/lageplus/reise", alle: 6 * 3600e3 },
    stabil: { an: false, url: "/api/lageplus/stabilitaet", alle: 30 * 60e3 },
    strahlung: { an: false, url: "/api/lageplus/strahlung", alle: 3600e3 },
    atom: { an: false, url: "/api/lageplus/infra?typ=atom", alle: 24 * 3600e3 },
    hafen: { an: false, url: "/api/lageplus/infra?typ=haefen", alle: 24 * 3600e3 },
  };
  // Flächen zuerst (unten), Punkte darüber, Brennpunkte ganz oben.
  const REIHE = ["hurrikan", "stabil", "reise", "strahlung", "atom", "hafen", "enge", "ausbruch", "notflug", "brenn"];
  const box = (k) => $("lage-lp-" + k + "-on");
  const istAn = (k) => !!box(k)?.checked;
  for (const k of Object.keys(EBENEN)) {
    const b = box(k); if (!b) continue;
    try { const v = localStorage.getItem("friday_lp_" + k); b.checked = v == null ? EBENEN[k].an : v === "1"; } catch { b.checked = EBENEN[k].an; }
  }

  const daten = {};
  async function hole(k, frisch) {
    const e = EBENEN[k], c = daten[k];
    if (c && !frisch && Date.now() - c.at < e.alle) return c.d;
    const d = await (await api(e.url)).json();
    if (d && !d.error) daten[k] = { at: Date.now(), d };
    return d;
  }

  function gruppe(k) {
    let g = $("lage-lp-g-" + k);
    if (g) return g;
    const svg = $("lage-map"); const glob = G();
    if (!svg || !glob) return null;
    g = glob.el("g", { id: "lage-lp-g-" + k, class: "lp-g lp-" + k });
    const vor = ["hurrikan", "stabil", "reise"].includes(k) ? $("lage-routes") : $("lage-markers");
    svg.insertBefore(g, vor?.parentNode === svg ? vor : null);
    return g;
  }
  const punkt = (k, lon, lat, cls, kinder, info) => {
    const n = G().el("g", { class: "lp-p lp-p-" + k + (cls ? " " + cls : ""), role: info ? "button" : "img" });
    n.dataset.lon = lon; n.dataset.lat = lat;
    for (const c of kinder) n.append(c);
    if (info) n.__info = info;
    return n;
  };
  function zaehler(k, txt) { const i = $("cnt-lp-" + k); if (i) i.textContent = txt; }

  const stabilFarbe = (w) => w >= 70 ? "#3ddc84" : w >= 50 ? "#a5e05a" : w >= 30 ? "#ffd04d" : w >= 15 ? "#ff8a1e" : "#ff3b3b";
  const reiseFarbe = { warnung: "#ff3b3b", teilwarnung: "#ff8a1e", hinweis: "#ffd04d", teilhinweis: "#e8e07a" };
  const strahlFarbe = (u) => u >= 1 ? "#ff3b3b" : u >= 0.3 ? "#ffd04d" : u >= 0.15 ? "#a5e05a" : "#3ddc84";

  async function zeichne(k, frisch = false) {
    const g = gruppe(k);
    if (!g) return;
    if (!istAn(k)) { g.replaceChildren(); zaehler(k, ""); return; }
    let d;
    try { d = await hole(k, frisch); } catch { zaehler(k, " !"); return; }
    if (!istAn(k) || !d || d.error) { if (d?.error) zaehler(k, " !"); return; }
    const el = G().el;
    const kinder = [];
    if (k === "brenn") {
      for (const p of d.punkte || []) {
        kinder.push(punkt(k, p.lon, p.lat, p.stufe, [el("circle", { r: 22, class: "lp-welle" }), el("circle", { r: 15, class: "lp-ring" }), el("text", { class: "lp-zahl", y: 4 })], { typ: "brenn", ...p }));
        kinder.at(-1).querySelector("text").textContent = p.anzahl;
      }
      zaehler(k, d.punkte?.length ? ` ${d.punkte.length}` : " 0");
    } else if (k === "notflug") {
      for (const a of d.flugzeuge || []) {
        const n = punkt(k, a.lon, a.lat, a.squawk === "7700" ? "not" : "funk", [
          el("circle", { r: 14, class: "lp-puls" }),
          el("path", { d: "M0,-9L1.6,-3L8,1L8,3L1.6,1L1.2,6L3.5,8L3.5,9.2L0,8.4L-3.5,9.2L-3.5,8L-1.2,6L-1.6,1L-8,3L-8,1L-1.6,-3Z", class: "lp-flieger" }),
        ], { typ: "notflug", ...a });
        n.dataset.rot = a.kurs || 0;
        kinder.push(n);
      }
      zaehler(k, ` ${(d.flugzeuge || []).length}`);
    } else if (k === "enge") {
      let auff = 0;
      for (const e of d.engen || []) {
        if (e.stufe === "stark" || e.stufe === "weniger") auff++;
        const n = punkt(k, e.lon, e.lat, e.stufe, [el("rect", { x: -6, y: -6, width: 12, height: 12, transform: "rotate(45)", class: "lp-raute" })], { typ: "enge", ...e });
        const t = el("text", { class: "lp-label", x: 10, y: 4 }); t.textContent = e.schnitt7 ?? "";
        n.append(t);
        kinder.push(n);
      }
      zaehler(k, auff ? ` ${auff}` : "");
    } else if (k === "hurrikan") {
      for (const s of d.stuerme || []) {
        if (s.kegel?.length) { const p = el("path", { class: "lp-kegel", "pointer-events": "none" }); p.__geo = { type: "MultiPolygon", coordinates: s.kegel }; kinder.push(p); }
        if (s.spur?.length > 1) { const p = el("path", { class: "lp-spur", "pointer-events": "none" }); p.__geo = { type: "LineString", coordinates: s.spur }; kinder.push(p); }
        kinder.push(punkt(k, s.lon, s.lat, "", [el("circle", { r: 12, class: "lp-auge" }), el("path", { d: "M0,-9C6,-9 9,-4 6,0M0,9C-6,9 -9,4 -6,0", class: "lp-wirbel" })], { typ: "hurrikan", ...s }));
      }
      zaehler(k, ` ${(d.stuerme || []).length}`);
    } else if (k === "ausbruch") {
      const proLand = new Map();
      for (const m of d.meldungen || []) for (const l of m.laender || []) { if (!proLand.has(l.id)) proLand.set(l.id, { ...l, meldungen: [] }); proLand.get(l.id).meldungen.push(m); }
      for (const l of proLand.values()) {
        const frisch = Date.now() - Date.parse(l.meldungen[0].zeit) < 30 * 86400e3;
        kinder.push(punkt(k, l.lon, l.lat, frisch ? "frisch" : "", [el("circle", { r: 9, class: "lp-kern" }), el("path", { d: "M0,-4.5V4.5M-4.5,0H4.5", class: "lp-kreuz" })], { typ: "ausbruch", ...l }));
      }
      zaehler(k, proLand.size ? ` ${proLand.size}` : "");
    } else if (k === "reise") {
      let n = 0;
      for (const l of d.laender || []) {
        if (!reiseFarbe[l.stufe]) continue;
        n += l.stufe === "warnung";
        kinder.push(punkt(k, l.lon, l.lat, l.stufe, [el("path", { d: "M0,-8L8,6H-8Z", fill: reiseFarbe[l.stufe], class: "lp-dreieck" }), el("path", { d: "M0,-3V1.5M0,3.2V3.6", class: "lp-ausruf" })], { typ: "reise", ...l }));
      }
      zaehler(k, ` ${n}`);
    } else if (k === "stabil") {
      for (const l of d.laender || []) kinder.push(punkt(k, l.lon, l.lat, "", [el("circle", { r: 7, fill: stabilFarbe(l.wert), class: "lp-stabil" })], { typ: "stabil", ...l }));
    } else if (k === "strahlung") {
      let hoch = 0;
      for (const p of d.punkte || []) {
        if (p.stufe !== "normal") hoch++;
        kinder.push(punkt(k, p.lon, p.lat, p.stufe, [el("circle", { r: p.stufe === "normal" ? 3.2 : 5, fill: strahlFarbe(p.usv) })], { typ: "strahlung", ...p }));
      }
      zaehler(k, hoch ? ` ${hoch}` : "");
    } else if (k === "atom") {
      for (const a of Array.isArray(d) ? d : []) kinder.push(punkt(k, a.lon, a.lat, "", [el("circle", { r: 5.5, class: "lp-atom-bg" }), el("path", { d: "M0,0L-2.6,-4.5A5.2,5.2 0 0 1 2.6,-4.5ZM0,0L5.2,0A5.2,5.2 0 0 1 2.6,4.5ZM0,0L-2.6,4.5A5.2,5.2 0 0 1 -5.2,0Z", class: "lp-atom" })], { typ: "atom", ...a }));
      zaehler(k, Array.isArray(d) && d.length ? ` ${d.length}` : "");
    } else if (k === "hafen") {
      for (const h of Array.isArray(d) ? d.slice(0, 150) : []) kinder.push(punkt(k, h.lon, h.lat, "", [el("path", { d: "M0,-5V4M-3,-2.5H3M-4,1.5A4,4 0 0 0 4,1.5", class: "lp-anker" }), el("circle", { r: 1.3, cy: -5.6, class: "lp-anker-o" })], { typ: "hafen", ...h }));
    }
    g.replaceChildren(...kinder);
    platziere();
  }

  function platziere() {
    const glob = G(); const proj = glob?.projektion();
    if (!proj) return;
    const s = proj.scale() / (glob.basis() || 1);
    const zoom = Math.min(1.6, Math.max(0.75, Math.sqrt(s)));
    for (const k of REIHE) {
      const g = $("lage-lp-g-" + k);
      if (!g || !g.firstChild) continue;
      for (const n of g.children) {
        if (n.__geo) { n.setAttribute("d", glob.pfad()(n.__geo) || ""); continue; }
        const lon = +n.dataset.lon, lat = +n.dataset.lat;
        if (!glob.visible(lon, lat)) { n.style.display = "none"; continue; }
        n.style.display = "";
        const p = proj([lon, lat]);
        const rot = n.dataset.rot ? ` rotate(${n.dataset.rot})` : "";
        const sk = k === "strahlung" || k === "stabil" ? Math.max(0.8, Math.min(2, s * 0.7)) : k === "atom" || k === "hafen" ? Math.max(0.6, Math.min(1.5, s * 0.5)) : zoom;
        n.setAttribute("transform", `translate(${p[0].toFixed(1)},${p[1].toFixed(1)})${rot} scale(${sk.toFixed(2)})`);
      }
    }
  }

  // ---------- Info-Karten ----------
  const datum = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }); };
  const link = (u) => /^https:\/\//.test(u || "") ? encodeURI(u) : "";
  const zahl = (n) => n == null ? "–" : Number(n).toLocaleString("de-DE");
  const SIGNAL = { konflikt: "⚔", internet: "📶", beben: "💥", katastrophe: "🚨", unwetter: "🌀", ausbruch: "🦠", notflug: "✈" };
  function karte(html) {
    // Gleiche Karte wie das Lagebild (#lage-lbcard), damit immer nur eine offen ist und alles gleich aussieht.
    $("lage-markercard")?.remove(); $("lage-shipcard")?.remove();
    let c = $("lage-lbcard");
    if (!c) { c = document.createElement("div"); c.id = "lage-lbcard"; $("lage")?.append(c); }
    c.className = "lage-shipcard lb-card lp-card";
    c.innerHTML = `<button class="ship-x" title="Schließen">✕</button>${html}`;
    c.querySelector(".ship-x").addEventListener("click", () => c.remove());
    c.querySelector("[data-land]")?.addEventListener("click", (e) => { c.remove(); G()?.landWaehlen(e.currentTarget.dataset.land); });
    return c;
  }
  const landKnopf = (id) => id ? `<button class="chip" data-land="${esc(id)}">Land öffnen</button>` : "";
  function spark(werte) {
    if (!werte?.length) return "";
    const max = Math.max(...werte, 1);
    return `<div class="lb-spark lp-spark">${werte.map((v) => `<i style="height:${Math.max(4, (v / max) * 100)}%"></i>`).join("")}</div>`;
  }
  function zeigeInfo(i) {
    if (i.typ === "brenn") {
      karte(`<div class="mc-type">🔥 BRENNPUNKT · ${i.anzahl} EREIGNISSE</div>
        <div class="mc-title">${esc(i.flag)} ${esc(i.land)}</div>
        <ul class="lp-liste">${i.signale.map((s) => `<li><i>${SIGNAL[s.art] || "•"}</i>${esc(s.text)}</li>`).join("")}${i.reisewarnung ? `<li><i>🛂</i>${esc(i.reisewarnung)} (Auswärtiges Amt)</li>` : ""}</ul>
        <p class="lb-hinweis">Friday zählt verschiedene Ereignisse im selben Land zusammen. Ab zwei gleichzeitig wird es ein Brennpunkt.</p>${landKnopf(i.id)}`);
    } else if (i.typ === "notflug") {
      karte(`<div class="mc-type">✈ ${esc(i.art)} · Code ${esc(i.squawk)}</div>
        <div class="mc-title">${esc(i.rufzeichen || i.kennung || i.hex)}</div>
        <div class="mc-rows">${i.kennung ? `<span>Kennzeichen</span><b>${esc(i.kennung)}</b>` : ""}${i.modell ? `<span>Flugzeug</span><b>${esc(i.modell)}</b>` : ""}
          <span>Höhe</span><b>${i.hoehe_m != null ? zahl(i.hoehe_m) + " m" : "–"}</b><span>Tempo</span><b>${i.tempo_kmh != null ? zahl(i.tempo_kmh) + " km/h" : "–"}</b>
          ${i.nahe ? `<span>Nahe</span><b>${esc(i.nahe)}</b>` : ""}</div>
        <p class="lb-hinweis">Öffentliches ADS-B von adsb.lol. 7700 heißt Notfall, 7600 Funkausfall. Meist ist es Vorsicht, nicht Gefahr.</p>`);
    } else if (i.typ === "enge") {
      const t = i.trend_prozent;
      karte(`<div class="mc-type">⚓ Meerenge · Schiffe pro Tag</div>
        <div class="mc-title">${esc(i.name)}</div>
        <div class="mc-rows"><span>Am ${datum(i.datum)}</span><b>${zahl(i.heute)} Schiffe</b>
          <span>Wochenschnitt</span><b>${zahl(i.schnitt7)} pro Tag</b>
          <span>Monat davor</span><b>${zahl(i.schnitt30)} pro Tag</b>
          <span>Trend</span><b class="${t <= -10 ? "lp-rot" : t >= 15 ? "lp-gruen" : ""}">${t == null ? "–" : (t > 0 ? "+" : "") + t + " %"}</b>
          <span>Tanker / Container</span><b>${zahl(i.tanker)} / ${zahl(i.container)}</b></div>
        ${spark(i.verlauf)}
        <p class="lb-hinweis">Durchfahrten der letzten 30 Tage. IMF PortWatch wertet Satelliten-AIS aus, die Zahlen kommen mit ein paar Tagen Verzug.</p>`);
    } else if (i.typ === "hurrikan") {
      karte(`<div class="mc-type">🌀 ${esc(i.klasse)}</div>
        <div class="mc-title">${esc(i.name)}</div>
        <div class="mc-rows"><span>Wind</span><b>${i.wind_kmh != null ? zahl(i.wind_kmh) + " km/h" : "–"}</b><span>Luftdruck</span><b>${i.druck_hpa ? zahl(i.druck_hpa) + " hPa" : "–"}</b>
          <span>Zieht</span><b>${i.richtung != null ? esc(i.richtung) + "°" : "–"}${i.tempo_kmh ? ` mit ${i.tempo_kmh} km/h` : ""}</b></div>
        <p class="lb-hinweis">Die helle Fläche ist der Vorhersage-Kegel des US-Hurrikan-Zentrums: Dort zieht das Zentrum in den nächsten 5 Tagen wahrscheinlich durch.</p>
        ${link(i.link) ? `<a class="chip" href="${link(i.link)}" target="_blank" rel="noopener">NHC-Meldung ↗</a>` : ""}`);
    } else if (i.typ === "ausbruch") {
      karte(`<div class="mc-type">🦠 WHO-Meldungen</div>
        <div class="mc-title">${esc(i.flag)} ${esc(i.land)}</div>
        <ul class="lb-news">${i.meldungen.slice(0, 4).map((m) => `<li>${link(m.link) ? `<a href="${link(m.link)}" target="_blank" rel="noopener">${esc(m.krankheit)}</a>` : esc(m.krankheit)}<small>${datum(m.zeit)} · ${esc(m.titel)}</small></li>`).join("")}</ul>
        <p class="lb-hinweis">Offizielle Ausbruchs-Meldungen der WHO. Das heißt nicht automatisch, dass Reisen gefährlich ist.</p>${landKnopf(i.id)}`);
    } else if (i.typ === "reise") {
      karte(`<div class="mc-type">🛂 Auswärtiges Amt</div>
        <div class="mc-title">${esc(i.flag)} ${esc(i.land)}</div>
        <div class="mc-rows"><span>Stufe</span><b style="color:${reiseFarbe[i.stufe] || "inherit"}">${esc(i.text)}</b>${i.stand ? `<span>Stand</span><b>${datum(i.stand)}</b>` : ""}</div>
        <p class="lb-hinweis">Reisewarnung = von Reisen wird abgeraten. Teil-Warnung = nur bestimmte Regionen. Vor jeder Reise die Seite des Auswärtigen Amts lesen.</p>
        <a class="chip" href="https://www.auswaertiges-amt.de/de/ReiseUndSicherheit/reise-und-sicherheitshinweise" target="_blank" rel="noopener">Auswärtiges Amt ↗</a> ${landKnopf(i.id)}`);
    } else if (i.typ === "stabil") {
      karte(`<div class="mc-type">📊 Stabilitäts-Wert</div>
        <div class="mc-title">${esc(i.flag)} ${esc(i.land)}</div>
        <div class="lp-wert"><b style="color:${stabilFarbe(i.wert)}">${i.wert}</b><span>von 100 · ${esc(i.stufe)}</span></div>
        <div class="lp-balken"><i style="width:${i.wert}%;background:${stabilFarbe(i.wert)}"></i></div>
        <div class="mc-rows"><span>Grundwert (Weltbank ${esc(i.weltbank_jahr)})</span><b>${i.basis}</b>${(i.gruende || []).map((g) => `<span>Abzug</span><b>${esc(g)}</b>`).join("")}</div>
        <p class="lb-hinweis">Friday-Berechnung: politische Stabilität der Weltbank plus aktuelle Konflikt-Meldungen, Reisewarnung und Internet-Störungen. Grobe Einschätzung.</p>${landKnopf(i.id)}`);
    } else if (i.typ === "strahlung") {
      karte(`<div class="mc-type">☢ Strahlung · Safecast</div>
        <div class="mc-title">${esc(i.ort || "Messgerät")}${i.land ? ` · ${esc(i.land)}` : ""}</div>
        <div class="mc-rows"><span>Messwert</span><b style="color:${strahlFarbe(i.usv)}">${i.usv.toLocaleString("de-DE")} µSv/h</b><span>Gemessen</span><b>${new Date(i.zeit).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</b></div>
        <p class="lb-hinweis">Normal sind 0,05 bis 0,3 µSv/h. Ein Flug in 10 km Höhe bringt etwa 3 µSv/h. Freie Bürger-Messgeräte, einzelne können falsch messen.</p>`);
    } else if (i.typ === "atom") {
      karte(`<div class="mc-type">☢ Atomkraftwerk</div><div class="mc-title">${esc(i.n)}</div>
        <div class="mc-rows"><span>Land</span><b>${esc(i.land || "")}</b><span>Leistung</span><b>${zahl(i.mw)} MW</b>${i.seit ? `<span>In Betrieb seit</span><b>${i.seit}</b>` : ""}</div>
        <p class="lb-hinweis">Global Power Plant Database (WRI). Manche Anlagen sind inzwischen abgeschaltet.</p>`);
    } else if (i.typ === "hafen") {
      karte(`<div class="mc-type">⚓ Großer Hafen</div><div class="mc-title">${esc(i.n)}</div>
        <div class="mc-rows"><span>Land</span><b>${esc(i.land || "")}</b><span>Schiffe pro Jahr</span><b>${zahl(i.schiffe)}</b><span>davon Tanker</span><b>${zahl(i.tanker)}</b><span>Container</span><b>${zahl(i.container)}</b></div>
        <p class="lb-hinweis">IMF PortWatch, Anläufe pro Jahr aus Satelliten-AIS.</p>`);
    }
  }
  $("lage-map")?.addEventListener("click", (e) => {
    const n = e.target.closest?.(".lp-p");
    if (n?.__info) { e.stopPropagation(); zeigeInfo(n.__info); }
  }, true);

  // ---------- Kacheln in der Lagebild-Leiste ----------
  let ueb = null;
  async function uebersicht(frisch) {
    if (ueb && !frisch && Date.now() - ueb.at < 5 * 60e3) return ueb.d;
    const d = await (await api("/api/lageplus")).json();
    ueb = { at: Date.now(), d };
    return d;
  }
  function kachel(id, ico, titel, wert, sub, stufe = "") {
    return `<button type="button" class="lb-k lp-k ${stufe}" data-lp="${id}"><i>${ico}</i><span class="lb-t">${titel}</span><b>${wert}</b>${sub ? `<small>${sub}</small>` : ""}</button>`;
  }
  async function kacheln(grid) {
    if (!grid) return;
    let u;
    try { u = await uebersicht(false); } catch { return; }
    if (!grid.isConnected) return;
    grid.querySelectorAll(".lp-k").forEach((n) => n.remove());
    const b = u.brennpunkt_top, m = u.meerengen_top, a = u.ausbruch_top, h = u.hurrikan_top, f = u.notflug_top;
    grid.insertAdjacentHTML("beforeend",
      kachel("brenn", "🔥", "Brennpunkte", u.brennpunkte ?? "–", b ? `${esc(b.flag || "")} ${esc(b.land)}` : "", u.brennpunkte > 3 ? "rot" : u.brennpunkte ? "gelb" : "gruen") +
      kachel("notflug", "✈", "Flugzeuge in Not", u.notflug ?? "–", f ? esc(f.rufzeichen || f.kennung || f.art) : (u.notflug === 0 ? "Himmel ruhig" : ""), u.notflug ? "rot" : "gruen") +
      kachel("enge", "⚓", "Meerengen auffällig", u.meerengen_auffaellig ?? "–", m ? `${esc(m.name.split(" (")[0])} ${m.trend_prozent != null ? (m.trend_prozent > 0 ? "+" : "") + m.trend_prozent + " %" : ""}` : "", u.meerengen_auffaellig > 2 ? "rot" : u.meerengen_auffaellig ? "gelb" : "gruen") +
      kachel("reise", "🛂", "Reisewarnungen", u.reisewarnungen ?? "–", u.teilwarnungen != null ? `+ ${u.teilwarnungen} Teil-Warnungen` : "", "") +
      kachel("hurrikan", "🌀", "Hurrikane", u.hurrikane ?? "–", h ? `${esc(h.klasse)} ${esc(h.name)}` : (u.hurrikane === 0 ? "keiner aktiv" : ""), u.hurrikane ? "rot" : "gruen") +
      kachel("ausbruch", "🦠", "WHO-Meldungen (30 T.)", u.ausbrueche ?? "–", a ? esc(a.krankheit) : "", u.ausbrueche > 3 ? "gelb" : ""));
    grid.querySelectorAll(".lp-k").forEach((n) => n.addEventListener("click", () => kachelKlick(n.dataset.lp)));
  }
  function schalteEin(k) {
    const b = box(k);
    if (b && !b.checked) { b.checked = true; b.dispatchEvent(new Event("change", { bubbles: true })); }
  }
  async function kachelKlick(k) {
    schalteEin(k);
    const d = await hole(k).catch(() => null);
    if (!d) return;
    const hin = (o, f = 2.2) => { if (o && Number.isFinite(o.lon)) G()?.zu(o.lon, o.lat, f); };
    if (k === "brenn" && d.punkte?.[0]) { hin(d.punkte[0]); zeigeInfo({ typ: "brenn", ...d.punkte[0] }); }
    else if (k === "notflug" && d.flugzeuge?.[0]) { hin(d.flugzeuge[0], 2.6); zeigeInfo({ typ: "notflug", ...d.flugzeuge[0] }); }
    else if (k === "enge") { const e = [...(d.engen || [])].filter((x) => x.trend_prozent != null).sort((a, b) => a.trend_prozent - b.trend_prozent)[0]; if (e) { hin(e, 2.6); zeigeInfo({ typ: "enge", ...e }); } }
    else if (k === "hurrikan" && d.stuerme?.[0]) { hin(d.stuerme[0], 2); zeigeInfo({ typ: "hurrikan", ...d.stuerme[0] }); }
    else if (k === "ausbruch") { const m = d.meldungen?.find((x) => x.laender?.length); if (m) { const l = m.laender[0]; hin(l); zeigeInfo({ typ: "ausbruch", ...l, meldungen: d.meldungen.filter((x) => x.laender.some((y) => y.id === l.id)) }); } }
    else if (k === "reise") hin({ lon: 30, lat: 20 }, 1.2);
  }
  window.addEventListener("friday-lb-leiste", (e) => kacheln(e.detail?.grid));

  // ---------- Schalter, Öffnen ----------
  document.addEventListener("change", (e) => {
    const m = e.target?.id?.match(/^lage-lp-([a-z]+)-on$/);
    if (!m || !EBENEN[m[1]]) return;
    try { localStorage.setItem("friday_lp_" + m[1], e.target.checked ? "1" : "0"); } catch { /* egal */ }
    zeichne(m[1]);
  });
  let timer = null, flugTimer = null, erstesMal = true;
  window.addEventListener("friday-lage", async (e) => {
    clearInterval(timer); clearInterval(flugTimer); timer = flugTimer = null;
    if (!e.detail?.offen) return;
    const glob = G();
    if (!glob) return;
    await glob.bereit();
    if (!lageOffen()) return;
    if (erstesMal) { erstesMal = false; glob.onRedraw(platziere); }
    for (const k of REIHE) zeichne(k);
    timer = setInterval(() => { if (lageOffen()) for (const k of ["brenn", "hurrikan", "stabil"]) zeichne(k, true); }, 10 * 60e3);
    flugTimer = setInterval(() => { if (lageOffen() && istAn("notflug")) zeichne("notflug", true); }, 90e3);
  });

  window.FridayLagePlus = { neu: () => { for (const k of REIHE) zeichne(k, true); }, zeige: (k) => kachelKlick(k) };
})();
