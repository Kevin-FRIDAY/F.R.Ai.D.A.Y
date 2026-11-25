// Gehirn-Cockpit, Reiter "🌌 Omniverse" (v1.191.0, Mark XVII):
// 3D-Gesamtansicht. "Systeme": Friday-Kern → Bereiche → jede Funktionsprüfung (grün bestanden, rot Fehler, grau übersprungen).
// "Wissen" (Neural Brain 3D): dasselbe Wissensnetz wie im Reiter 🕸, nur räumlich. Eigene kleine 3D-Zeichnung auf Canvas,
// ohne Zusatz-Bibliothek. Drehen mit Finger/Maus, pausiert hinter anderen Fenstern, im Flüssig-Modus langsamer.
(() => {
  "use strict";
  const C = window.FridayCockpit;
  const H = window.FridayHelfer;
  if (!C || !H) return;
  const { esc, json } = H;
  const FARBE = { fakt: "#ff8a1f", projekt: "#ffd166", thema: "#7fd8ff", mission: "#ff5fa2", ziel: "#a0ff7a", entscheidung: "#c39bff", dokument: "#e6e6e6", person: "#ffb4a2", interesse: "#7affd4" };
  const STATUS = { bestanden: "#3ecf6e", fehler: "#ff4d4d", uebersprungen: "#8a8f98" };
  let ansicht = "systeme";

  /** Punkte gleichmäßig auf einer Kugel (Fibonacci). */
  function kugel(n, r) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
      const rr = Math.sqrt(1 - y * y), th = i * 2.39996;
      out.push([Math.cos(th) * rr * r, y * r, Math.sin(th) * rr * r]);
    }
    return out;
  }

  /** Kleine 3D-Szene: knoten [{x,y,z,farbe,groesse,name,zeigeName}], kanten [[a,b]]. Gibt eine Stopp-Funktion zurück. */
  function szene(cv, knoten, kanten, info) {
    const ctx = cv.getContext("2d");
    const b = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(280, b.width), Hh = Math.max(260, b.height);
    cv.width = W * dpr; cv.height = Hh * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ruhig = document.documentElement.classList.contains("perf-fluessig") || matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rx = -0.35, ry = 0, auto = ruhig ? 0.0015 : 0.004, zoom = 1, zieh = null, gewaehlt = -1, laeuft = true, letzte = 0;
    const proj = new Array(knoten.length);
    function rechne() {
      const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
      const f = Math.min(W, Hh) * 1.35 * zoom;
      for (let i = 0; i < knoten.length; i++) {
        const k = knoten[i];
        const x1 = k.x * cy - k.z * sy, z1 = k.x * sy + k.z * cy;
        const y2 = k.y * cx - z1 * sx, z2 = k.y * sx + z1 * cx;
        const s = f / (f + z2 * f * 0.9 + f * 1.6);
        proj[i] = { x: W / 2 + x1 * f * s, y: Hh / 2 + y2 * f * s, s, z: z2 };
      }
    }
    function male(t) {
      if (!laeuft || !cv.isConnected) { laeuft = false; return; }
      requestAnimationFrame(male);
      if (document.hidden || (ruhig && t - letzte < 66)) return;
      letzte = t;
      if (!zieh) ry += auto;
      rechne();
      ctx.clearRect(0, 0, W, Hh);
      for (const [a, c] of kanten) {
        const p = proj[a], q = proj[c];
        const tiefe = Math.max(0.08, Math.min(0.55, (p.s + q.s) * 0.45 - 0.05));
        ctx.strokeStyle = `rgba(255,150,60,${tiefe})`;
        ctx.lineWidth = 0.6 + (p.s + q.s) * 0.4;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      const reihe = knoten.map((_, i) => i).sort((i, j) => proj[j].z - proj[i].z);
      ctx.font = "11px system-ui, sans-serif";
      for (const i of reihe) {
        const k = knoten[i], p = proj[i];
        const r = Math.max(1.5, k.groesse * p.s * 1.6);
        ctx.globalAlpha = Math.max(0.35, Math.min(1, p.s * 1.4));
        ctx.shadowColor = k.farbe; ctx.shadowBlur = ruhig ? 0 : r * 2;
        ctx.fillStyle = k.farbe;
        ctx.beginPath(); ctx.arc(p.x, p.y, i === gewaehlt ? r + 3 : r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        if (k.zeigeName || i === gewaehlt) {
          ctx.fillStyle = "rgba(255,255,255,.92)";
          const n = k.name.length > 28 ? `${k.name.slice(0, 27)}…` : k.name;
          ctx.fillText(n, Math.min(W - ctx.measureText(n).width - 4, p.x + r + 4), p.y + 4);
        }
      }
      ctx.globalAlpha = 1;
    }
    const pos = (e) => { const r = cv.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return [p.clientX - r.left, p.clientY - r.top]; };
    const runter = (e) => { zieh = { p: pos(e), rx, ry, weg: 0 }; };
    const bewege = (e) => {
      if (!zieh) return;
      const [x, y] = pos(e);
      zieh.weg = Math.abs(x - zieh.p[0]) + Math.abs(y - zieh.p[1]);
      ry = zieh.ry + (x - zieh.p[0]) * 0.01;
      rx = Math.max(-1.4, Math.min(1.4, zieh.rx + (y - zieh.p[1]) * 0.01));
      if (e.cancelable && zieh.weg > 4) e.preventDefault();
    };
    const hoch = (e) => {
      if (zieh && zieh.weg < 5) {
        const [x, y] = zieh.p;
        let best = -1, bd = 400;
        proj.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (p && d < bd) { bd = d; best = i; } });
        gewaehlt = best;
        info(best >= 0 ? knoten[best] : null);
      }
      zieh = null;
    };
    cv.addEventListener("mousedown", runter); window.addEventListener("mousemove", bewege); window.addEventListener("mouseup", hoch);
    cv.addEventListener("touchstart", runter, { passive: true }); cv.addEventListener("touchmove", bewege, { passive: false }); cv.addEventListener("touchend", hoch);
    cv.addEventListener("wheel", (e) => { e.preventDefault(); zoom = Math.max(0.5, Math.min(2.5, zoom * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
    requestAnimationFrame(male);
    return () => { laeuft = false; window.removeEventListener("mousemove", bewege); window.removeEventListener("mouseup", hoch); };
  }

  function systemeAus(t) {
    const erg = t.letzte?.ergebnisse || [];
    const bereiche = [...new Set(erg.map((e) => e.bereich || "Sonstiges"))];
    const knoten = [{ x: 0, y: 0, z: 0, farbe: "#ff8a1f", groesse: 9, name: "Friday-Kern", zeigeName: true, text: `${t.letzte?.bestanden || 0} bestanden, ${t.letzte?.fehler || 0} Fehler, ${t.letzte?.uebersprungen || 0} übersprungen` }];
    const kanten = [];
    const bp = kugel(bereiche.length, 0.42);
    bereiche.forEach((name, bi) => {
      const eig = erg.filter((e) => (e.bereich || "Sonstiges") === name);
      const fehler = eig.filter((e) => e.status === "fehler").length;
      const bIdx = knoten.length;
      knoten.push({ x: bp[bi][0], y: bp[bi][1], z: bp[bi][2], farbe: fehler ? "#ff4d4d" : "#ffb347", groesse: 5.5, name, zeigeName: true, text: `${eig.length} Prüfungen${fehler ? `, ${fehler} mit Fehler` : ", alle ohne Fehler"}` });
      kanten.push([0, bIdx]);
      const tp = kugel(eig.length, 0.13);
      eig.forEach((e, ti) => {
        knoten.push({ x: bp[bi][0] * 1.75 + tp[ti][0], y: bp[bi][1] * 1.75 + tp[ti][1], z: bp[bi][2] * 1.75 + tp[ti][2], farbe: STATUS[e.status] || "#8a8f98", groesse: 3, name: e.name, zeigeName: e.status === "fehler", text: `${e.status === "bestanden" ? "✅ bestanden" : e.status === "fehler" ? "❌ Fehler" : "⏭ übersprungen"}: ${e.text || ""}` });
        kanten.push([bIdx, knoten.length - 1]);
      });
    });
    return { knoten, kanten };
  }

  function wissenAus(g) {
    const arten = Object.keys(g.arten);
    const zentren = kugel(arten.length, 0.62);
    const knoten = [], idx = new Map();
    const grad = {};
    for (const e of g.kanten) { grad[e.von] = (grad[e.von] || 0) + 1; grad[e.nach] = (grad[e.nach] || 0) + 1; }
    arten.forEach((a, ai) => {
      const eig = g.knoten.filter((k) => k.art === a);
      const p = kugel(eig.length, 0.14 + Math.min(0.22, eig.length * 0.012));
      eig.forEach((k, i) => {
        idx.set(k.id, knoten.length);
        knoten.push({ x: zentren[ai][0] + p[i][0], y: zentren[ai][1] + p[i][1], z: zentren[ai][2] + p[i][2], farbe: FARBE[a] || "#fff", groesse: 2.5 + Math.min(4, (grad[k.id] || 0) * 0.6), name: k.name, zeigeName: (grad[k.id] || 0) >= 3, text: `${g.arten[a][0]} ${g.arten[a][1]} · ${grad[k.id] || 0} Verbindungen` });
      });
    });
    const kanten = g.kanten.map((e) => [idx.get(e.von), idx.get(e.nach)]).filter(([a, c]) => a != null && c != null);
    // Nur die 8 am besten verbundenen Knoten tragen dauerhaft ihren Namen, sonst wird es unlesbar.
    const top = new Set(g.knoten.slice().sort((a, b) => (grad[b.id] || 0) - (grad[a.id] || 0)).slice(0, 8).filter((k) => grad[k.id]).map((k) => idx.get(k.id)));
    knoten.forEach((k, i) => { k.zeigeName = top.has(i); });
    return { knoten, kanten };
  }

  let stopp = null;
  async function omniverse(el) {
    if (stopp) { stopp(); stopp = null; }
    const istSys = ansicht === "systeme";
    const [t, g] = await Promise.all([istSys ? json("/api/cockpit/tests") : null, istSys ? null : json("/api/neuronen")]);
    const daten = istSys ? systemeAus(t) : wissenAus(g);
    const leer = istSys ? !t.letzte : !g.knoten.length;
    el.innerHTML = `
      <div class="hf-reihe ck-om-umschalter" role="tablist">
        <button class="hf-btn ${istSys ? "haupt" : "leise"}" data-ansicht="systeme" role="tab" aria-selected="${istSys}">🛰 Systeme</button>
        <button class="hf-btn ${istSys ? "leise" : "haupt"}" data-ansicht="wissen" role="tab" aria-selected="${!istSys}">🧠 Neural Brain 3D</button>
        ${istSys ? '<button class="hf-btn leise" id="ck-om-test">Alle Systeme jetzt prüfen</button>' : ""}
      </div>
      ${leer ? `<div class="hf-karte"><p class="hf-hinweis">${istSys ? "Noch keine Prüfung gelaufen. Tipp auf „Alle Systeme jetzt prüfen“." : "Das Wissensnetz ist noch leer. Es wächst mit allem, was Friday sich merkt."}</p></div>` : `
        <div class="ck-om-buehne"><canvas id="ck-om-cv" class="ck-om-cv" aria-label="${istSys ? "3D-Ansicht aller Friday-Systeme" : "3D-Ansicht des Wissensnetzes"}"></canvas>
          <div class="ck-om-info" id="ck-om-info">${istSys ? `<b>Friday-Kern</b><br>${esc(daten.knoten[0].text)}` : `<b>${g.stand.knoten} Wissens-Knoten</b><br>${g.kanten.length} Verbindungen`}<br><span class="klein">Tippen zeigt Details · Ziehen dreht${matchMedia("(pointer: fine)").matches ? " · Mausrad zoomt" : ""}</span></div></div>
        <div class="ck-om-legende">${istSys ? '<span><i style="background:#3ecf6e"></i>bestanden</span><span><i style="background:#ff4d4d"></i>Fehler</span><span><i style="background:#8a8f98"></i>übersprungen</span><span><i style="background:#ffb347"></i>Bereich</span>' : Object.entries(g.arten).map(([a, [e, n]]) => `<span><i style="background:${FARBE[a] || "#fff"}"></i>${e} ${esc(n)}</span>`).join("")}</div>`}
      <p class="hf-hinweis">${istSys ? "Jeder Punkt ist eine echte Funktionsprüfung. Simulationen zählen nicht als bestanden." : "Dasselbe Wissen wie im Reiter 🕸 Wissensnetz, hier räumlich. Gruppen nach Art, große Punkte sind gut verbunden."} Sag: „Friday, zeig mir das Omniverse“.</p>`;
    el.querySelectorAll("[data-ansicht]").forEach((x) => x.addEventListener("click", () => { ansicht = x.dataset.ansicht; omniverse(el); }));
    el.querySelector("#ck-om-test")?.addEventListener("click", async (e) => {
      e.target.disabled = true; e.target.textContent = "Prüfe …";
      try { await json("/api/cockpit/tests", { body: {} }); } catch { /* Anzeige zeigt alten Stand */ }
      omniverse(el);
    });
    const cv = el.querySelector("#ck-om-cv");
    if (cv) {
      const infoEl = el.querySelector("#ck-om-info");
      stopp = szene(cv, daten.knoten, daten.kanten, (k) => { if (k) infoEl.innerHTML = `<b>${esc(k.name)}</b><br>${esc(k.text || "")}`; });
    }
  }

  const css = document.createElement("style");
  css.textContent = `
.ck-om-umschalter { margin-bottom: 8px; }
.ck-om-buehne { position: relative; border-radius: 14px; overflow: hidden; background: radial-gradient(ellipse at center, rgba(255,138,31,.10), rgba(0,0,0,.35) 70%); border: 1px solid rgba(255,138,31,.25); }
.ck-om-cv { display: block; width: 100%; height: min(62vh, 560px); cursor: grab; touch-action: pan-y; }
.ck-om-cv:active { cursor: grabbing; }
.ck-om-info { position: absolute; left: 10px; bottom: 10px; max-width: min(360px, calc(100% - 20px)); padding: 8px 10px; border-radius: 10px; background: rgba(0,0,0,.55); backdrop-filter: blur(6px); font-size: 13px; overflow-wrap: anywhere; pointer-events: none; }
html.perf-fluessig .ck-om-info { backdrop-filter: none; background: rgba(0,0,0,.8); }
.ck-om-legende { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0; font-size: 12px; }
.ck-om-legende i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
@media (max-width: 900px) { .ck-om-cv { height: 52vh; } }`;
  document.head.appendChild(css);

  C.reiter("omniverse", "🌌 Omniverse", (el) => omniverse(el));
})();
