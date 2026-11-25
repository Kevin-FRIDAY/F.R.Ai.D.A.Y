// Gehirn-Cockpit, Reiter "💾 Gedächtnis" (Gedächtnis-Monitor, Mark XII Punkt 35) und "🕸 Wissensnetz"
// (Neural Brain 2.0 + Wissensgraph, Punkte 1 und 20) – v1.179.0.
// Zeigt die drei Gedächtnis-Ebenen (Kurzzeit · Langzeit · Projekte), was neu dazugekommen ist und was
// Friday von selbst ins Langzeitgedächtnis übernommen hat. Das Wissensnetz zeigt, wie alles zusammenhängt.
(() => {
  "use strict";
  const C = window.FridayCockpit;
  const H = window.FridayHelfer;
  if (!C || !H) return;
  const { esc, json } = H;
  const zeit = (iso) => { if (!iso) return ""; try { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  const EBENE = { kurz: ["⏱", "Kurzzeit", "hf-info"], lang: ["🗄", "Langzeit", "hf-gut"], projekt: ["📁", "Projekt", "hf-warn"] };

  // ---------- 💾 Gedächtnis-Monitor ----------
  async function monitor(el) {
    const m = await json("/api/gedaechtnis/monitor");
    const z = m.zaehl;
    el.innerHTML = `
      <div class="ck-gd-kacheln">
        <div class="ck-kachel"><b>${z.kurz}</b><span>⏱ Kurzzeit</span><small>gilt ein paar Tage</small></div>
        <div class="ck-kachel"><b>${z.lang}</b><span>🗄 Langzeit</span><small>dauerhaft</small></div>
        <div class="ck-kachel"><b>${z.projekte}</b><span>📁 Projekte</span><small>${z.projekt} Notizen</small></div>
        <div class="ck-kachel"><b>${z.ablaeufe}</b><span>🧭 Abläufe</span><small>gelernte Wege</small></div>
      </div>
      <div class="hf-karte"><h3>Schnell merken</h3>
        <div class="hf-reihe"><input class="hf-input grow" id="ck-gd-kurz" placeholder="Nur für ein paar Tage, z. B. Heute arbeite ich im Homeoffice" maxlength="300"><button class="hf-btn" id="ck-gd-kurz-ok">⏱ Kurz merken</button></div>
        <div class="hf-reihe" style="margin-top:8px"><input class="hf-input grow" id="ck-gd-proj" placeholder="Neues Projekt, z. B. Garage" maxlength="60"><button class="hf-btn" id="ck-gd-proj-ok">📁 Projekt anlegen</button></div>
      </div>
      <div class="hf-karte"><h3>Projekte ${m.aktiv ? `<small class="hf-gut">· aktiv: ${esc(m.aktiv)}</small>` : ""}</h3>
        ${m.projekte.length ? m.projekte.map((p) => `
          <details class="ck-gd-projekt"${p.aktiv ? " open" : ""}><summary><b>${esc(p.name)}</b> ${p.aktiv ? '<span class="hf-badge hf-gut">aktiv</span>' : ""}${p.status === "fertig" ? '<span class="hf-badge hf-info">fertig</span>' : ""} <span class="klein">${p.notizen.length} Notiz${p.notizen.length === 1 ? "" : "en"}</span></summary>
            <ul class="hf-liste">${p.notizen.map((n) => `<li class="hf-zeile"><span class="name">${esc(n.text)}</span><span class="klein">${zeit(n.zeit)}</span><button class="hf-btn leise" data-nweg="${esc(p.id)}|${esc(n.id)}" title="Notiz löschen">✕</button></li>`).join("") || '<li class="hf-hinweis">Noch keine Notizen.</li>'}</ul>
            <div class="hf-reihe"><input class="hf-input grow" data-pin="${esc(p.id)}" placeholder="Notiz zum Projekt" maxlength="500"><button class="hf-btn" data-pnotiz="${esc(p.id)}">＋</button>
              ${p.aktiv ? `<button class="hf-btn leise" data-pset="${esc(p.id)}" data-w='{"aktiv":false}'>Pausieren</button>` : `<button class="hf-btn leise" data-pset="${esc(p.id)}" data-w='{"aktiv":true,"status":"offen"}'>Aktiv setzen</button>`}
              ${p.status !== "fertig" ? `<button class="hf-btn leise" data-pset="${esc(p.id)}" data-w='{"status":"fertig","aktiv":false}'>✓ Fertig</button>` : ""}
              <button class="hf-btn leise" data-pset="${esc(p.id)}" data-w='{"weg":true}' title="Projekt löschen">🗑</button></div>
          </details>`).join("") : '<p class="hf-hinweis">Noch keine Projekte. Sag zum Beispiel: „Friday, neues Projekt Garage“ und danach „merk dir für Projekt Garage: Tor ist 2,40 m breit“.</p>'}
      </div>
      ${m.befoerdert.length ? `<div class="hf-karte"><h3>Von selbst ins Langzeitgedächtnis übernommen</h3><ul class="hf-liste">${m.befoerdert.map((b) => `<li class="hf-zeile"><span class="name">✦ ${esc(b.text)}</span><span class="klein">${zeit(b.zeit)}</span></li>`).join("")}</ul><p class="hf-hinweis">Fragst du an 3 verschiedenen Tagen nach demselben Thema, merkt Friday sich das dauerhaft.</p></div>` : ""}
      <div class="hf-karte"><h3>Neu im Gedächtnis</h3>
        ${m.neu.length ? `<ul class="hf-liste">${m.neu.slice(0, 40).map((x) => { const e = EBENE[x.ebene] || ["•", x.ebene, ""]; return `<li class="hf-zeile"><span class="hf-badge ${e[2]}">${e[0]} ${e[1]}</span><span class="name">${esc(x.text)}${x.bis ? ` <span class="klein">· bis ${zeit(x.bis)}</span>` : ""}${x.befoerdert ? ' <span class="klein hf-gut">· übernommen</span>' : ""}</span><span class="klein">${zeit(x.zeit)}</span>${x.ebene === "kurz" && !x.befoerdert ? `<button class="hf-btn leise" data-hoch="${esc(x.id)}" title="Dauerhaft merken">→ 🗄</button><button class="hf-btn leise" data-kweg="${esc(x.id)}" title="Vergessen">✕</button>` : ""}</li>`; }).join("")}</ul>` : '<p class="hf-hinweis">Noch nichts gemerkt.</p>'}
      </div>
      <p class="hf-hinweis">Sprachbefehle: „merk dir für heute: …“ (Kurzzeit), „merk dir: …“ (Langzeit), „merk dir für Projekt X: …“, „ich arbeite an Projekt X“, „was weißt du über Projekt X?“, „Projekt X ist fertig“, „was hast du zuletzt gemerkt?“.</p>`;
    const neu = () => monitor(el);
    el.querySelector("#ck-gd-kurz-ok").addEventListener("click", async () => { const t = el.querySelector("#ck-gd-kurz").value.trim(); if (!t) return; await json("/api/gedaechtnis/kurz", { body: { text: t } }); neu(); });
    el.querySelector("#ck-gd-proj-ok").addEventListener("click", async () => { const t = el.querySelector("#ck-gd-proj").value.trim(); if (!t) return; await json("/api/gedaechtnis/projekte", { body: { name: t } }); neu(); });
    el.querySelectorAll("[data-pnotiz]").forEach((b) => b.addEventListener("click", async () => { const i = el.querySelector(`[data-pin="${b.dataset.pnotiz}"]`); if (!i.value.trim()) return; await json(`/api/gedaechtnis/projekte/${encodeURIComponent(b.dataset.pnotiz)}/notiz`, { body: { text: i.value.trim() } }); neu(); }));
    el.querySelectorAll("[data-pset]").forEach((b) => b.addEventListener("click", async () => { await json(`/api/gedaechtnis/projekte/${encodeURIComponent(b.dataset.pset)}`, { body: JSON.parse(b.dataset.w) }); neu(); }));
    el.querySelectorAll("[data-nweg]").forEach((b) => b.addEventListener("click", async () => { const [p, n] = b.dataset.nweg.split("|"); await json(`/api/gedaechtnis/projekte/${encodeURIComponent(p)}`, { body: { notizWeg: n } }); neu(); }));
    el.querySelectorAll("[data-hoch]").forEach((b) => b.addEventListener("click", async () => { await json(`/api/gedaechtnis/befoerdern/${encodeURIComponent(b.dataset.hoch)}`, { body: {} }); neu(); }));
    el.querySelectorAll("[data-kweg]").forEach((b) => b.addEventListener("click", async () => { await json(`/api/gedaechtnis/kurz/${encodeURIComponent(b.dataset.kweg)}`, { method: "DELETE" }); neu(); }));
  }

  // ---------- 🕸 Wissensnetz ----------
  const FARBE = { fakt: "#ff8a1f", projekt: "#ffd166", thema: "#7fd8ff", mission: "#ff5fa2", ziel: "#a0ff7a", entscheidung: "#c39bff", dokument: "#e6e6e6", person: "#ffb4a2", interesse: "#7affd4" };
  async function wissensnetz(el, neuBauen = false) {
    const g = await json(`/api/neuronen${neuBauen ? "?neu=1" : ""}`);
    const s = g.stand;
    el.innerHTML = `
      <div class="ck-gd-kacheln">
        <div class="ck-kachel"><b>${s.knoten}</b><span>Wissens-Knoten</span><small>${Object.entries(s.je_art).map(([a, n]) => `${g.arten[a]?.[0] || "•"}${n}`).join(" ")}</small></div>
        <div class="ck-kachel"><b>${s.begriffe}</b><span>Begriffe (Neuronen)</span><small>Wortstämme</small></div>
        <div class="ck-kachel"><b>${s.synapsen}</b><span>Synapsen</span><small>aus ${s.fragen_gelernt} Fragen gelernt</small></div>
        <div class="ck-kachel"><b>${g.kanten.length}</b><span>Verbindungen</span><small>gebaut ${zeit(s.gebaut)}</small></div>
      </div>
      <div class="hf-karte"><h3>Fragen ans Netz</h3>
        <div class="hf-reihe"><input class="hf-input grow" id="ck-wn-q" placeholder="Woran denkst du bei …? (z. B. Garage)"><button class="hf-btn" id="ck-wn-q-ok">⚡ Aktivieren</button></div>
        <div class="hf-reihe" style="margin-top:8px"><input class="hf-input grow" id="ck-wn-a" placeholder="Begriff A"><span>↔</span><input class="hf-input grow" id="ck-wn-b" placeholder="Begriff B"><button class="hf-btn" id="ck-wn-z-ok">Wie hängt das zusammen?</button></div>
        <div id="ck-wn-erg" class="ck-wn-erg"></div>
      </div>
      ${g.knoten.length ? `<canvas id="ck-wn-cv" class="ck-wn-cv"></canvas><div class="ck-wn-legende">${Object.entries(g.arten).map(([a, [e, n]]) => `<span><i style="background:${FARBE[a] || "#fff"}"></i>${e} ${n}</span>`).join("")}</div>` : '<div class="hf-karte"><p class="hf-hinweis">Das Netz ist noch leer. Es wächst mit allem, was Friday sich merkt: Fakten, Projekte, Missionen, Ziele, Dokumente, Geburtstage und deinen Fragen.</p></div>'}
      ${g.synapsen.length ? `<div class="hf-karte"><h3>Stärkste Synapsen</h3><p class="klein">Begriffe, die du oft zusammen benutzt:</p><div class="hf-reihe">${g.synapsen.slice(0, 18).map((x) => `<span class="hf-badge hf-info">${esc(x.a)} ↔ ${esc(x.b)} · ${x.staerke}</span>`).join("")}</div></div>` : ""}
      <div class="hf-reihe"><button class="hf-btn leise" id="ck-wn-neu">↻ Netz neu aufbauen</button><span class="hf-hinweis">Sprachbefehle: „zeig mir das Wissensnetz“, „wie hängt Garage mit Auto zusammen?“, „woran denkst du bei Urlaub?“</span></div>`;
    const erg = el.querySelector("#ck-wn-erg");
    const markiere = new Set();
    el.querySelector("#ck-wn-q-ok").addEventListener("click", async () => {
      const q = el.querySelector("#ck-wn-q").value.trim(); if (!q) return;
      const a = await json(`/api/neuronen/aktiviere?q=${encodeURIComponent(q)}`);
      markiere.clear(); a.treffer.forEach((t) => markiere.add(t.id));
      erg.innerHTML = a.treffer.length ? `<ul class="hf-liste">${a.treffer.map((t) => `<li class="hf-zeile"><span class="hf-badge">${g.arten[t.art]?.[0] || "•"} ${esc(g.arten[t.art]?.[1] || t.art)}</span><span class="name">${esc(t.name)}</span><span class="klein">⚡ ${String(t.aktivierung).replace(".", ",")}</span></li>`).join("")}</ul>${a.bruecken.length ? `<p class="klein">Mitgedacht über: ${a.bruecken.map((b) => esc(b.begriff)).join(", ")}</p>` : ""}` : `<p class="hf-hinweis">Dazu feuert noch nichts im Netz.</p>`;
      zeichne();
    });
    el.querySelector("#ck-wn-z-ok").addEventListener("click", async () => {
      const a = el.querySelector("#ck-wn-a").value.trim(); const b = el.querySelector("#ck-wn-b").value.trim(); if (!a || !b) return;
      const z = await json(`/api/neuronen/zusammenhang?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
      erg.innerHTML = `<p class="${z.gefunden ? "hf-gut" : "hf-hinweis"}">${esc(z.text)}</p>${z.pfad ? `<div class="hf-reihe">${z.pfad.map((p) => `<span class="hf-badge">${esc(p)}</span>`).join("<span>→</span>")}</div>` : ""}`;
    });
    el.querySelector("#ck-wn-neu").addEventListener("click", () => wissensnetz(el, true));
    let zeichne = () => {};
    if (g.knoten.length) zeichne = graph(el.querySelector("#ck-wn-cv"), g, markiere);
  }

  function graph(cv, g, markiere) {
    const ctx = cv.getContext("2d");
    const b = cv.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(280, b.width), Hh = Math.max(240, b.height);
    cv.width = W * dpr; cv.height = Hh * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = g.knoten.map((n, i) => ({ ...n, x: W / 2 + Math.cos(i * 2.4) * W * 0.35 * ((i % 7) / 7 + 0.2), y: Hh / 2 + Math.sin(i * 2.4) * Hh * 0.35 * ((i % 5) / 5 + 0.2), vx: 0, vy: 0 }));
    const idx = new Map(k.map((n, i) => [n.id, i]));
    const kanten = g.kanten.map((e) => [idx.get(e.von), idx.get(e.nach), e.gewicht]).filter((e) => e[0] != null && e[1] != null);
    const grad = new Array(k.length).fill(0); for (const [a, c] of kanten) { grad[a]++; grad[c]++; }
    // Fruchterman-Reingold: gleichmäßig verteilt, mit Rand für die Namen.
    const RX = 70, RY = 26;
    const K = Math.sqrt(((W - 2 * RX) * (Hh - 2 * RY)) / Math.max(1, k.length)) * 0.75;
    let temp = W / 8;
    for (let it = 0; it < 220; it++) {
      for (const n of k) { n.vx = 0; n.vy = 0; }
      for (let a = 0; a < k.length; a++) for (let c = a + 1; c < k.length; c++) {
        let dx = k[a].x - k[c].x, dy = k[a].y - k[c].y; const d = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const f = (K * K) / d; dx /= d; dy /= d;
        k[a].vx += dx * f; k[a].vy += dy * f; k[c].vx -= dx * f; k[c].vy -= dy * f;
      }
      for (const [a, c, w] of kanten) {
        let dx = k[c].x - k[a].x, dy = k[c].y - k[a].y; const d = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const f = ((d * d) / K) * Math.min(2, 0.6 + w * 0.2); dx /= d; dy /= d;
        k[a].vx += dx * f; k[a].vy += dy * f; k[c].vx -= dx * f; k[c].vy -= dy * f;
      }
      for (const n of k) {
        // Schwerkraft zur Mitte: hält auch Inseln ohne Verbindung im Bild
        n.vx += (W / 2 - n.x) * 0.35; n.vy += (Hh / 2 - n.y) * 0.35;
        const v = Math.sqrt(n.vx * n.vx + n.vy * n.vy) || 1;
        n.x += (n.vx / v) * Math.min(v, temp); n.y += (n.vy / v) * Math.min(v, temp);
      }
      temp = Math.max(0.5, temp * 0.97);
    }
    // Ins Bild einpassen (mit Rand für die Namen)
    const xs = k.map((n) => n.x), ys = k.map((n) => n.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (const n of k) {
      n.x = x1 - x0 < 1 ? W / 2 : RX + ((n.x - x0) / (x1 - x0)) * (W - 2 * RX);
      n.y = y1 - y0 < 1 ? Hh / 2 : RY + 8 + ((n.y - y0) / (y1 - y0)) * (Hh - 2 * RY - 16);
    }
    let phase = 0; let laeuft = true;
    function male() {
      if (!cv.isConnected) { laeuft = false; return; }
      ctx.clearRect(0, 0, W, Hh);
      phase += 0.02;
      for (const [a, c, w] of kanten) {
        const hell = markiere.size && (markiere.has(k[a].id) || markiere.has(k[c].id));
        ctx.strokeStyle = hell ? "#ffd166" : FARBE[k[a].art] || "#ff8a1f";
        ctx.globalAlpha = hell ? 0.85 : Math.min(0.55, 0.12 + w * 0.1);
        ctx.lineWidth = hell ? 1.6 : 1;
        ctx.beginPath(); ctx.moveTo(k[a].x, k[a].y); ctx.lineTo(k[c].x, k[c].y); ctx.stroke();
        // Impuls wandert über die Synapse
        const t = (phase * (0.5 + (w % 1)) + a * 0.13) % 1;
        ctx.globalAlpha = hell ? 1 : 0.6; ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(k[a].x + (k[c].x - k[a].x) * t, k[a].y + (k[c].y - k[a].y) * t, hell ? 2 : 1.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.textAlign = "center"; ctx.font = "11px system-ui";
      k.forEach((n, i) => {
        const hell = markiere.has(n.id);
        const r = 3 + Math.min(5, grad[i] * 0.6) + (hell ? 3 + Math.sin(phase * 4) * 1.5 : 0);
        ctx.shadowColor = FARBE[n.art] || "#ff8a1f"; ctx.shadowBlur = hell ? 18 : 8;
        ctx.fillStyle = FARBE[n.art] || "#ff8a1f"; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        if (hell || grad[i] >= 2 || k.length <= 25) { ctx.fillStyle = hell ? "#fff" : "rgba(255,255,255,.8)"; ctx.fillText(n.name.length > 24 ? `${n.name.slice(0, 23)}…` : n.name, n.x, n.y - r - 4); }
      });
      if (laeuft) requestAnimationFrame(male);
    }
    requestAnimationFrame(male);
    return () => {};
  }

  const css = document.createElement("style");
  css.textContent = `
.ck-gd-kacheln { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
.ck-gd-projekt { border-top: 1px solid var(--u-rand-soft, var(--line)); padding: 6px 0; }
.ck-gd-projekt summary { cursor: pointer; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ck-wn-cv { width: 100%; height: 380px; display: block; border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 14px; background: radial-gradient(circle at 50% 45%, rgba(255,140,30,.10), rgba(0,0,0,.35) 70%); margin: 10px 0 6px; }
.ck-wn-legende { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--muted); margin-bottom: 10px; }
.ck-wn-legende i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
.ck-wn-erg { margin-top: 8px; }
@media (max-width: 900px) { .ck-gd-kacheln { grid-template-columns: repeat(2, 1fr); } .ck-wn-cv { height: 300px; } }`;
  document.head.appendChild(css);

  C.gedaechtnisSeite = (el) => monitor(el);
  C.reiter("wissensnetz", "🕸 Wissensnetz", (el) => wissensnetz(el));
})();
