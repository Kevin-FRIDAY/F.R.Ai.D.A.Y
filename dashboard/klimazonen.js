// F.R.Ai.D.A.Y Weltgeschehen: Klimazonen als Ebene (v1.119.0).
// Köppen-Geiger-Klimakarte der Uni Wien (Kottek et al. 2006 / Rubel et al. 2017, Zeitraum 1986–2010),
// 0,5°-Raster, liegt fertig in vendor/klimazonen.json (kein Internet nötig).
// Gezeichnet werden 13 Hauptzonen als Flächen auf dem Globus; Antippen zeigt die genaue Zone (30 Klassen).
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const G = () => window.FridayGlobus;
  const KEY = "friday_klima";

  // Hauptzonen (gezeichnet) – Farben nach der üblichen Köppen-Karte
  const ZONEN = {
    Af: ["#1f3cff", "Tropischer Regenwald"], Am: ["#2f7dff", "Tropisches Monsunklima"], Aw: ["#58aef5", "Tropische Savanne"],
    BW: ["#ff3a3a", "Wüste"], BS: ["#f2a93b", "Steppe"],
    Cs: ["#f2e33b", "Mittelmeerklima (trockener Sommer)"], Cw: ["#8de38a", "Subtropisch (trockener Winter)"], Cf: ["#7bd34a", "Gemäßigt, immer feucht"],
    Ds: ["#d35bd3", "Kontinental (trockener Sommer)"], Dw: ["#9aa2ff", "Kontinental (trockener Winter)"], Df: ["#33d6d6", "Kontinental, immer feucht"],
    ET: ["#b9c2c8", "Tundra"], EF: ["#eef3f7", "Ewiges Eis"],
  };
  // Alle 30 Klassen mit Erklärung (für das Antippen)
  const KLASSEN = {
    Af: "Tropischer Regenwald – heiß und das ganze Jahr nass.",
    Am: "Tropisches Monsunklima – heiß, kurze Trockenzeit, sonst sehr viel Regen.",
    As: "Tropische Savanne mit trockenem Sommer.",
    Aw: "Tropische Savanne – heiß, lange Trockenzeit im Winter.",
    BWh: "Heiße Wüste – kaum Regen, sehr heiß.", BWk: "Kalte Wüste – kaum Regen, kalte Winter.",
    BSh: "Heiße Steppe – wenig Regen, heiß.", BSk: "Kalte Steppe – wenig Regen, kalte Winter.",
    Csa: "Mittelmeerklima – heißer, trockener Sommer, milder Winter.", Csb: "Mittelmeerklima – warmer, trockener Sommer.", Csc: "Kühles Mittelmeerklima mit trockenem Sommer.",
    Cwa: "Subtropisch – heißer Sommer, trockener Winter.", Cwb: "Hochland-Subtropen – warmer Sommer, trockener Winter.", Cwc: "Kühles Hochlandklima mit trockenem Winter.",
    Cfa: "Feucht-subtropisch – heißer Sommer, immer Niederschlag.", Cfb: "Gemäßigtes Seeklima – warmer Sommer, milder Winter, immer feucht (z. B. Deutschland).", Cfc: "Kühles Seeklima – kurzer, kühler Sommer.",
    Dsa: "Kontinental – heißer, trockener Sommer.", Dsb: "Kontinental – warmer, trockener Sommer.", Dsc: "Kontinental – kühler, trockener Sommer.", Dsd: "Kontinental – trockener Sommer, extrem kalter Winter.",
    Dwa: "Kontinental – heißer Sommer, trockener, kalter Winter.", Dwb: "Kontinental – warmer Sommer, trockener, kalter Winter.", Dwc: "Kontinental – kühler Sommer, trockener, kalter Winter.", Dwd: "Kontinental – trockener, extrem kalter Winter.",
    Dfa: "Kontinental – heißer Sommer, immer feucht.", Dfb: "Kontinental – warmer Sommer, immer feucht.", Dfc: "Boreal (Taiga) – kurzer, kühler Sommer, langer kalter Winter.", Dfd: "Boreal – extrem kalter Winter.",
    ET: "Tundra – sehr kalt, wärmster Monat unter 10 °C.", EF: "Ewiges Eis – alle Monate unter 0 °C.",
  };
  const zoneVon = (k) => !k ? "" : k[0] === "A" ? (k === "Af" || k === "Am" ? k : "Aw") : k[0] === "E" ? k : k.slice(0, 2);

  let daten = null, laden = null, gruppe = null, pfade = {}, raster = null;
  // Nah dran: feinere Karte (0,5° statt 1°), wird erst beim ersten Hineinzoomen geladen
  let fein = null, feinLaden = null, modus = "grob";
  function feinHolen() {
    feinLaden ??= fetch("vendor/klimazonen-fein.json").then((r) => r.json()).then((d) => { fein = d; zeichne(); }).catch(() => { feinLaden = null; });
    return feinLaden;
  }
  const box = () => $("lage-klima-on");
  const an = () => !!box()?.checked;

  // Gemerkt (friday_klima wird mit Mac/iPhone abgeglichen – darum beim Öffnen nochmal lesen)
  const gemerkt = () => { try { const b = box(); if (b) b.checked = localStorage.getItem(KEY) === "1"; } catch { /* egal */ } };
  gemerkt();

  function holen() {
    laden ??= fetch("vendor/klimazonen.json").then((r) => { if (!r.ok) throw new Error("Klimadaten fehlen"); return r.json(); })
      .then((d) => { daten = d; return d; })
      .catch((err) => { laden = null; throw err; });
    return laden;
  }

  // Raster (RLE je Zeile) erst beim ersten Antippen entpacken
  function rasterHolen() {
    if (raster || !daten) return raster;
    const { spalten, zeilen, zeilenRle } = daten.raster;
    raster = new Uint8Array(spalten * zeilen).fill(255);
    for (let r = 0; r < zeilen; r++) {
      let c = 0;
      for (const [, n, ch] of zeilenRle[r].matchAll(/(\d*)([A-Z.])/g)) {
        const anz = n ? Number(n) : 1;
        if (ch !== ".") raster.fill(ch.charCodeAt(0) - 65, r * spalten + c, r * spalten + c + anz);
        c += anz;
      }
    }
    return raster;
  }
  function klasseAn(lon, lat) {
    const ra = rasterHolen();
    if (!ra) return "";
    const { spalten, zeilen, schritt, klassen } = daten.raster;
    const r0 = Math.floor((90 - lat) / schritt), c0 = Math.floor((((lon + 180) % 360) + 360) % 360 / schritt);
    // Genau am Punkt, sonst nächste Landzelle in der Nähe (Küsten)
    for (let d = 0; d <= 2; d++) for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
      const r = r0 + dr, c = (c0 + dc + spalten) % spalten;
      if (r < 0 || r >= zeilen) continue;
      const v = ra[r * spalten + c];
      if (v !== 255) return klassen[v];
    }
    return "";
  }

  function gruppeHolen() {
    if (gruppe?.isConnected) return gruppe;
    const svg = $("lage-map"), g = G();
    if (!svg || !g?.pfad?.()) return null;
    gruppe = g.el("g", { id: "lage-klima" });
    // über die Länder, unter Seen/Flüsse/Grenzen – Grenzen bleiben sichtbar
    svg.insertBefore(gruppe, svg.querySelector(".lage-lakes") || svg.querySelector(".lage-coast") || null);
    pfade = {}; modus = "grob";
    for (const f of daten.flaechen.features) {
      const k = f.properties.k;
      const p = g.el("path", { fill: ZONEN[k]?.[0] || "#888", "data-k": k });
      pfade[k] = { p, f };
      gruppe.append(p);
    }
    return gruppe;
  }

  function zeichne() {
    if (!an() || !daten) { if (gruppe) gruppe.style.display = "none"; return; }
    const gg = gruppeHolen();
    const pfad = G()?.pfad?.();
    if (!gg || !pfad) return;
    gg.style.display = "";
    const g = G(), nah = g.projektion().scale() > g.basis() * 2.5;
    if (nah && !fein) feinHolen();
    const soll = nah && fein ? "fein" : "grob";
    if (soll !== modus) {
      modus = soll;
      const quelle = (soll === "fein" ? fein : daten).flaechen.features;
      for (const f of quelle) if (pfade[f.properties.k]) pfade[f.properties.k].f = f;
    }
    gg.classList.toggle("nah", nah);
    for (const { p, f } of Object.values(pfade)) p.setAttribute("d", pfad(f) || "");
  }

  function legende() {
    const k = $("klima-keys");
    if (!k) return;
    k.classList.toggle("an", an());
    if (!k.childElementCount) k.innerHTML = Object.entries(ZONEN).map(([id, [f, n]]) => `<span><i style="--k:${f}"></i>${n}</span>`).join("")
      + `<span style="grid-column:1/-1;opacity:.75">Quelle: Köppen-Geiger-Karte, Uni Wien (1986–2010). Antippen zeigt die genaue Zone.</span>`;
  }

  async function schalten(wert, merken = true) {
    const b = box();
    if (b && wert != null) b.checked = wert;
    if (merken) { try { localStorage.setItem(KEY, an() ? "1" : "0"); } catch { /* egal */ } }
    legende();
    if (!an()) { zeichne(); $("klima-card")?.remove(); return; }
    try { await holen(); await G()?.bereit?.(); zeichne(); }
    catch { const c = $("cnt-klima"); if (c) c.textContent = " !"; }
  }

  // Antippen auf dem Globus → Klimazone an diesem Punkt
  function karte(lon, lat) {
    const k = klasseAn(lon, lat);
    $("klima-card")?.remove();
    if (!k) return;
    const c = document.createElement("div");
    c.id = "klima-card"; c.className = "klima-card";
    const z = ZONEN[zoneVon(k)];
    c.innerHTML = `<i style="--k:${z?.[0] || "#888"}"></i><div><b>${k}</b> · ${z?.[1] || ""}<p>${KLASSEN[k] || ""}</p></div><button type="button" aria-label="Schließen">✕</button>`;
    c.querySelector("button").onclick = () => c.remove();
    document.querySelector(".lage-map-wrap")?.append(c);
    clearTimeout(karte.t); karte.t = setTimeout(() => c.remove(), 9000);
  }

  let start = null;
  function tippenAn() {
    const svg = $("lage-map");
    if (!svg || svg.__klima) return;
    svg.__klima = true;
    svg.addEventListener("pointerdown", (e) => { start = [e.clientX, e.clientY]; });
    svg.addEventListener("click", (e) => {
      if (!an() || !daten || !start || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6) return;
      const pr = G()?.projektion?.(), m = svg.getScreenCTM?.();
      if (!pr || !m) return;
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      const ll = pr.invert?.([pt.x, pt.y]);
      if (!ll || !Number.isFinite(ll[0])) return;
      // nur Vorderseite der Kugel
      const r = pr.rotate(), R = Math.PI / 180;
      const cosD = Math.sin(-r[1] * R) * Math.sin(ll[1] * R) + Math.cos(-r[1] * R) * Math.cos(ll[1] * R) * Math.cos((ll[0] + r[0]) * R);
      if (cosD < 0) return;
      karte(ll[0], ll[1]);
    });
  }

  box()?.addEventListener("change", () => schalten(null));
  window.addEventListener("friday-lage", (e) => {
    if (!e.detail?.offen) { $("klima-card")?.remove(); return; }
    gemerkt(); legende();
    G()?.bereit?.().then(() => { tippenAn(); schalten(null, false); });
  });
  // An die Neuzeichnung des Globus hängen (Drehen, Zoomen)
  const haken = () => { const g = G(); if (g?.onRedraw) g.onRedraw(zeichne); else setTimeout(haken, 300); };
  haken();
  legende();

  window.FridayKlima = {
    an: () => { if (window.FridayLage && !window.FridayLage.offen?.()) window.FridayLage.open?.({ stumm: true }); return schalten(true); },
    aus: () => schalten(false),
    klasseAn: async (lon, lat) => { await holen(); return klasseAn(lon, lat); },
  };
})();
