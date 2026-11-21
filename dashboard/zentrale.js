// F.R.Ai.D.A.Y Modul-Zentrale: alle Module an einem Ort.
// Reiter: Start (3D-Modul-Orbit), Kontrolle, Missionen, Automationen, Labor, Rechnen, Persönlich,
// Wissen (Zeitachse + Wissensgraph), Netzwerk (Geräte + Umgebungen), Sicherheit, Module (Marktplatz).
// Öffnen: Werkzeug-Menü → Modul-Zentrale, oder „Friday, öffne die Modul-Zentrale“.
(() => {
  "use strict";
  const F = window.Friday || {};
  const api = F.api;
  if (!api) return;
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const $ = (id) => document.getElementById(id);
  const j = async (pfad, opt = {}) => {
    const r = await api(pfad, opt.body !== undefined ? { method: opt.method || "POST", body: JSON.stringify(opt.body) } : opt.method ? { method: opt.method } : {});
    let d = {};
    try { d = await r.json(); } catch { d = { error: "Keine Antwort vom Server." }; }
    return d;
  };
  const post = (p, body = {}) => j(p, { body });
  const zahl = (v) => (typeof v === "number" ? v.toLocaleString("de-DE", { maximumFractionDigits: 4 }) : esc(v));
  const zeit = (iso) => (iso ? new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–");
  const md = (t) => esc(t)
    .replace(/^### (.+)$/gm, "<h5>$1</h5>").replace(/^## (.+)$/gm, "<h4>$1</h4>").replace(/^# (.+)$/gm, "<h4>$1</h4>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^\s*[-•*] (.+)$/gm, "<li>$1</li>").replace(/^\s*\d+[.)] (.+)$/gm, "<li class=\"nr\">$1</li>")
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, "<ul>$1</ul>").replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>");
  const toast = (text, fehler = false) => {
    const t = document.createElement("div");
    t.className = `zt-toast${fehler ? " fehler" : ""}`;
    t.textContent = text;
    sheet.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  };

  const TABS = [
    ["start", "◎ Übersicht"], ["kontrolle", "🛡 Kontrolle"], ["missionen", "🚀 Missionen"], ["automationen", "⚙ Automationen"],
    ["labor", "🧪 Denk-Labor"], ["rechnen", "∑ Rechnen"], ["persoenlich", "🧭 Persönlich"], ["wissen", "🕸 Wissen"],
    ["netzwerk", "📡 Netzwerk"], ["sicherheit", "🔐 Sicherheit"], ["module", "🧩 Module"],
  ];
  const STATUS = { echt: ["Funktioniert", "ok"], verbessert: ["Verbessert", "ok"], vorhanden: ["Gab es schon", "alt"], braucht: ["Braucht Guthaben", "gut"], geruest: ["Vorbereitet", "ger"] };

  const sheet = document.createElement("section");
  sheet.id = "zentrale";
  sheet.className = "sheet hidden";
  sheet.setAttribute("aria-label", "Modul-Zentrale");
  sheet.innerHTML = `<div class="panel sheet-box zt-box">
      <header class="sheet-top"><h2>◆ Modul-Zentrale</h2><span id="zt-kopf" class="zt-kopf"></span><button id="zt-x" class="ghost small" aria-label="Schließen">✕</button></header>
      <nav id="zt-tabs" class="zt-tabs" role="tablist">${TABS.map(([id, n]) => `<button type="button" role="tab" data-tab="${id}">${n}</button>`).join("")}</nav>
      <div id="zt-inhalt" class="zt-inhalt"></div>
    </div>`;
  document.getElementById("app")?.appendChild(sheet) || document.body.appendChild(sheet);
  const trigger = document.createElement("button");
  trigger.id = "zentrale-open"; trigger.className = "hidden"; trigger.setAttribute("aria-hidden", "true"); trigger.tabIndex = -1;
  document.body.appendChild(trigger);

  let tab = "start", timer = null, orbitStop = null;
  const inhalt = () => $("zt-inhalt");

  async function kopf() {
    const d = await j("/api/zentrale").catch(() => null);
    if (!d || d.error) return null;
    const k = d.kontrolle;
    $("zt-kopf").innerHTML = `${k.notfall ? '<span class="zt-pill rot">🛑 NOTFALL</span>' : ""}<span class="zt-pill">Autonomie: ${esc(k.stufe.name)}</span>${k.offen ? `<button type="button" class="zt-pill gelb" data-go="kontrolle">${k.offen} Freigabe${k.offen > 1 ? "n" : ""} offen</button>` : ""}${d.missionen.aktiv ? `<span class="zt-pill">${d.missionen.aktiv} Mission${d.missionen.aktiv > 1 ? "en" : ""} aktiv</span>` : ""}`;
    return d;
  }

  // ================= Übersicht + 3D-Orbit =================
  async function zeigeStart() {
    const d = await kopf();
    if (!d) { inhalt().innerHTML = `<p class="error">Die Zentrale ist nicht erreichbar.</p>`; return; }
    const gruppen = {};
    for (const m of d.module) (gruppen[m.gruppe] ||= []).push(m);
    const zaehl = (s) => d.module.filter((m) => m.status === s).length;
    inhalt().innerHTML = `
      <div class="zt-start">
        <div class="zt-orbit-wrap"><canvas id="zt-orbit" aria-label="3D-Modul-Orbit: ziehen zum Drehen, tippen zum Öffnen"></canvas><p class="muted zt-mini">Ziehen zum Drehen · Tippen öffnet das Modul</p></div>
        <div class="zt-zahlen">
          <div><b>${d.module.length}</b><span>Module</span></div>
          <div><b>${zaehl("echt") + zaehl("verbessert")}</b><span>funktionieren sofort</span></div>
          <div><b>${zaehl("braucht")}</b><span>brauchen Guthaben</span></div>
          <div><b>${zaehl("vorhanden")}</b><span>gab es schon</span></div>
          <div><b>${d.eigene.filter((m) => m.an).length}</b><span>eigene Module an</span></div>
        </div>
      </div>
      <div class="zt-legende">${Object.entries(STATUS).filter(([s]) => s !== "geruest").map(([, [n, c]]) => `<span class="zt-st ${c}">${n}</span>`).join("")}</div>
      ${Object.entries(gruppen).map(([g, liste]) => `<h3>${esc(g)}</h3><div class="zt-karten">${liste.map((m) => `<button type="button" class="zt-karte" data-go="${esc(m.tab)}"><b>${esc(m.name)}</b><span class="zt-st ${STATUS[m.status][1]}">${STATUS[m.status][0]}</span><small>${esc(m.text)}</small></button>`).join("")}</div>`).join("")}`;
    orbit(d.module);
  }

  function orbit(module) {
    const cv = $("zt-orbit");
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const farbe = getComputedStyle(document.documentElement).getPropertyValue("--cyan").trim() || "#ff8a1f";
    const n = module.length;
    const punkte = module.map((m, i) => {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), phi = i * Math.PI * (3 - Math.sqrt(5));
      return { m, x: Math.cos(phi) * r, y, z: Math.sin(phi) * r };
    });
    let rx = 0.3, ry = 0, drag = null, auto = true, w = 0, h = 0, proj = [];
    const groesse = () => { const b = cv.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); w = b.width; h = b.height; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    groesse();
    const statusFarbe = (s) => (s === "braucht" ? "#ffd166" : s === "vorhanden" ? "#9aa4b2" : farbe);
    let lauf = true;
    const male = () => {
      if (!lauf) return;
      if (auto && !drag) ry += 0.0035;
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.38, cx = w / 2, cy = h / 2;
      // Ringe
      ctx.strokeStyle = farbe; ctx.globalAlpha = 0.18; ctx.lineWidth = 1;
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(cx, cy, R * (0.4 + k * 0.22), R * (0.4 + k * 0.22) * 0.32, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(cx, cy, R * 0.16, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = farbe; ctx.font = "600 12px system-ui"; ctx.textAlign = "center"; ctx.fillText("FRIDAY", cx, cy + 4);
      const cX = Math.cos(rx), sX = Math.sin(rx), cY = Math.cos(ry), sY = Math.sin(ry);
      proj = punkte.map((p) => {
        const x1 = p.x * cY + p.z * sY, z1 = -p.x * sY + p.z * cY;
        const y2 = p.y * cX - z1 * sX, z2 = p.y * sX + z1 * cX;
        const s = 1 / (1.9 - z2 * 0.6);
        return { p, X: cx + x1 * R * s * 1.4, Y: cy + y2 * R * s * 1.4, z: z2, s };
      }).sort((a, b) => a.z - b.z);
      for (const q of proj) {
        const a = 0.25 + (q.z + 1) * 0.375;
        ctx.globalAlpha = a;
        ctx.fillStyle = statusFarbe(q.p.m.status);
        ctx.beginPath(); ctx.arc(q.X, q.Y, 2.5 + q.s * 3, 0, Math.PI * 2); ctx.fill();
        if (q.z > (w < 500 ? 0.62 : 0.4)) { ctx.font = `${Math.round(8 + q.s * 5)}px system-ui`; ctx.fillStyle = "#fff"; ctx.globalAlpha = a * 0.95; ctx.fillText(q.p.m.name.length > 22 ? `${q.p.m.name.slice(0, 21)}…` : q.p.m.name, q.X, q.Y - 8 - q.s * 2); }
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(male);
    };
    requestAnimationFrame(male);
    cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, rx, ry, weg: 0 }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.weg = Math.hypot(dx, dy); ry = drag.ry + dx * 0.008; rx = Math.max(-1.2, Math.min(1.2, drag.rx + dy * 0.008)); });
    cv.addEventListener("pointerup", (e) => {
      const kurz = drag && drag.weg < 6; drag = null; auto = false; setTimeout(() => { auto = true; }, 4000);
      if (!kurz) return;
      const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      const treffer = proj.filter((q) => q.z > -0.2).map((q) => ({ q, d: Math.hypot(q.X - x, q.Y - y) })).sort((a, c) => a.d - c.d)[0];
      if (treffer && treffer.d < 26) geheZu(treffer.q.p.m.tab);
    });
    window.addEventListener("resize", groesse);
    orbitStop = () => { lauf = false; window.removeEventListener("resize", groesse); };
  }

  function geheZu(ziel) {
    if (ziel === "logbuch") { schliessen(); window.FridayLogbuch?.open(); return; }
    if (ziel === "werkstatt") { schliessen(); $("werkstatt-open")?.click(); return; }
    if (ziel === "sicherung") { schliessen(); $("backups-btn")?.click(); return; }
    zeige(ziel);
  }

  // ================= Kontrolle =================
  async function zeigeKontrolle() {
    const [k, z] = await Promise.all([j("/api/zentrale/kontrolle"), j("/api/zentrale")]);
    await kopf();
    const tempo = z.tempo;
    inhalt().innerHTML = `
      <section class="zt-notfall ${k.notfall ? "an" : ""}">
        <div><h4>${k.notfall ? "🛑 Notfallmodus ist AN" : "Notfallmodus"}</h4><p class="muted">${k.notfall ? `Seit ${zeit(k.notfall.seit)} · ${esc(k.notfall.grund)}. Missionen, Automationen, Auto-Updates und Aktionen sind gestoppt.` : "Ein Knopf stoppt alles Automatische sofort: Missionen, Automationen, Auto-Updates und alle Aktionen von Friday. Auch per Sprache: „Friday, Notfall!“"}</p></div>
        <button type="button" id="zt-notfall" class="zt-gross ${k.notfall ? "" : "rot"}">${k.notfall ? "Notfall beenden" : "🛑 NOTFALL-STOPP"}</button>
      </section>
      <h3>Autonomie-Regler</h3>
      <div class="zt-regler">${k.stufen.map((s) => `<button type="button" data-stufe="${s.stufe}" class="${s.stufe === k.autonomie ? "on" : ""}"><b>${s.stufe} · ${esc(s.name)}</b><small>${esc(s.text)}</small></button>`).join("")}</div>
      <h3>Genehmigungen ${k.offen.length ? `<span class="zt-pill gelb">${k.offen.length} offen</span>` : ""}</h3>
      <div class="zt-liste">${k.offen.length ? k.offen.map((g) => `<div class="zt-zeile frei"><div><b>${esc(g.titel)}</b><small>${esc(g.kanal === "mission" ? "aus einer Mission" : g.kanal === "automation" ? "aus einer Automation" : "aus dem Gespräch")} · ${zeit(g.erstellt)}${g.grund ? ` · ${esc(g.grund)}` : ""}</small><code>${esc(JSON.stringify(g.eingabe))}</code></div><div class="zt-knoepfe"><button type="button" class="chip primary" data-frei="${g.id}" data-ja="1">✓ Erlauben</button><button type="button" class="chip" data-frei="${g.id}" data-ja="0">✕ Ablehnen</button></div></div>`).join("") : '<p class="muted">Nichts wartet auf dich.</p>'}</div>
      ${k.erledigt.length ? `<details class="zt-details"><summary>Zuletzt entschieden (${k.erledigt.length})</summary>${k.erledigt.map((g) => `<div class="zt-zeile klein"><span class="zt-st ${g.status === "erlaubt" ? "ok" : "alt"}">${esc(g.status)}</span> ${esc(g.titel)} <small>${zeit(g.entschieden || g.erstellt)}</small>${g.ergebnis ? `<small class="muted">${esc(g.ergebnis.slice(0, 140))}</small>` : ""}</div>`).join("")}</details>` : ""}
      <h3>KI-Modell-Routing</h3>
      <div class="zt-route">
        <label>Denk-Tempo im Gespräch <select id="zt-tempo">
          <option value="auto">🎯 Automatisch (je nach Frage)</option><option value="blitz">⚡ Blitz (Haiku)</option><option value="schnell">🚀 Schnell (Sonnet)</option><option value="gruendlich">🧠 Gründlich (Opus)</option>
        </select></label>
        <p class="muted">Im Labor wählt jedes Werkzeug selbst: ${Object.entries(z.routing).map(([s, r]) => `<b>${s}</b> → ${esc(r.name)}${r.aktuell !== (r.model || r.aktuell) ? " (Sparmodus)" : ""}`).join(" · ")}. Bei knappem Guthaben spart Friday automatisch mit Haiku.</p>
      </div>
      <h3>Zugriffskontrolle – wer darf welche Daten lesen?</h3>
      <div class="zt-tabelle-wrap"><table class="zt-tabelle"><thead><tr><th></th>${Object.values(k.daten).map((d) => `<th>${esc(d.split(" (")[0])}</th>`).join("")}</tr></thead>
        <tbody>${Object.entries(k.nutzer).map(([n, name]) => `<tr><th>${esc(name)}</th>${Object.keys(k.daten).map((d) => `<td><label class="zt-schalter"><input type="checkbox" data-recht="${n}|${d}" ${k.rechte[n][d] ? "checked" : ""}><i></i></label></td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="muted zt-mini">Friday gibt einem Bereich nur die Daten mit, die hier erlaubt sind. Eigene Module sehen standardmäßig gar nichts.</p>`;
    $("zt-tempo").value = tempo;
    $("zt-tempo").addEventListener("change", async (e) => { await post("/api/einstellungen", { tempo: e.target.value }); if ($("srv-tempo")) $("srv-tempo").value = e.target.value; toast("Denk-Tempo gespeichert"); });
    $("zt-notfall").addEventListener("click", async () => { await post("/api/zentrale/notfall", { an: !k.notfall }); toast(k.notfall ? "Notfallmodus beendet" : "NOTFALL-STOPP: alles Automatische steht"); zeigeKontrolle(); });
    inhalt().querySelectorAll("[data-stufe]").forEach((b) => b.addEventListener("click", async () => { await post("/api/zentrale/autonomie", { stufe: Number(b.dataset.stufe) }); zeigeKontrolle(); }));
    inhalt().querySelectorAll("[data-frei]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      const r = await post(`/api/zentrale/freigabe/${b.dataset.frei}`, { ja: b.dataset.ja === "1" });
      toast(r.error ? r.error : b.dataset.ja === "1" ? (r.ergebnis?.error ? `Freigegeben, aber: ${r.ergebnis.error}` : "Freigegeben und ausgeführt") : "Abgelehnt", Boolean(r.error || r.ergebnis?.error));
      zeigeKontrolle();
    }));
    inhalt().querySelectorAll("[data-recht]").forEach((c) => c.addEventListener("change", async () => { const [nutzer, daten] = c.dataset.recht.split("|"); await post("/api/zentrale/recht", { nutzer, daten, an: c.checked }); }));
  }

  // ================= Missionen =================
  const MST = { geplant: "geplant", wartet: "in der Warteschlange", laeuft: "läuft", pausiert: "pausiert", fertig: "fertig", fehler: "braucht dich", gestoppt: "gestoppt" };
  const SST = { offen: "○", laeuft: "✱", fertig: "✓", fehler: "✕", uebersprungen: "↷", haengt: "⏳", wartet_freigabe: "✋" };
  let offeneMission = null;
  async function zeigeMissionen() {
    const d = await j("/api/zentrale/missionen");
    await kopf();
    const reihe = new Map(d.warteschlange.map((id, i) => [id, i + 1]));
    inhalt().innerHTML = `
      ${d.notfall ? '<p class="error">Notfallmodus ist an – Missionen sind angehalten.</p>' : ""}
      ${d.autonomie === 0 ? '<p class="muted">Autonomie „Nur Vorschläge“: Friday macht jeden Schritt erst, wenn du auf „Nächster Schritt“ tippst.</p>' : ""}
      <form id="zt-m-neu" class="zt-neu">
        <textarea id="zt-m-ziel" rows="2" placeholder="Neue Mission, z. B. „Recherchiere die 3 besten E-Bikes bis 2000 € und mach mir eine Vergleichstabelle“"></textarea>
        <div class="zt-reihe"><select id="zt-m-prio"><option value="">Priorität: automatisch erkennen</option><option value="1">hoch</option><option value="2">mittel</option><option value="3">niedrig</option></select>
        <button class="chip primary" type="submit">🚀 Mission starten</button><span id="zt-m-hint" class="muted zt-mini"></span></div>
      </form>
      <div class="zt-liste">${d.missionen.length ? d.missionen.map((m) => {
        const fertig = m.schritte.filter((s) => s.status === "fertig" || s.status === "uebersprungen").length;
        const offen = offeneMission === m.id;
        return `<div class="zt-mission ${m.status}" data-mid="${m.id}">
          <button type="button" class="zt-m-kopf" data-auf="${m.id}">
            <span class="zt-prio p${m.prioritaet}">${esc(d.prio[m.prioritaet])}</span><b>${esc(m.titel)}</b>
            <span class="zt-st ${m.status === "fertig" ? "ok" : m.status === "fehler" ? "rot" : m.status === "laeuft" ? "gut" : "alt"}">${MST[m.status] || m.status}${reihe.has(m.id) && m.status === "wartet" ? ` · Platz ${reihe.get(m.id)}` : ""}${d.aktiv === m.id ? " · arbeitet …" : ""}</span>
            <span class="zt-balken"><i style="width:${m.schritte.length ? Math.round((fertig / m.schritte.length) * 100) : 0}%"></i></span>
          </button>
          ${m.problem ? `<p class="zt-problem">⚠ ${esc(m.problem)}</p>` : ""}${m.stockt && m.status === "wartet" ? '<p class="zt-problem">⏳ Diese Mission wartet seit über einem Tag.</p>' : ""}
          ${offen ? `<div class="zt-m-detail">
            <ol class="zt-schritte">${m.schritte.map((s) => `<li class="${s.status}"><span class="zt-sym">${SST[s.status] || "○"}</span><div><b>${esc(s.text)}</b>${s.agent ? `<small>Agent: ${esc((d.agenten.find((a) => a.id === s.agent) || {}).name || s.agent)}</small>` : ""}${s.versuche > 1 ? "<small>Rückfallstrategie genutzt</small>" : ""}${s.ergebnis ? `<div class="zt-erg">${md(s.ergebnis)}</div>` : ""}</div></li>`).join("")}</ol>
            <div class="zt-knoepfe">
              ${["wartet", "laeuft"].includes(m.status) ? `<button type="button" class="chip" data-ma="pause">⏸ Pause</button>` : ""}
              ${["geplant", "pausiert", "fehler", "gestoppt"].includes(m.status) ? `<button type="button" class="chip primary" data-ma="weiter">▶ Weiter</button>` : ""}
              ${m.status !== "fertig" ? `<button type="button" class="chip" data-ma="schritt">⏭ Nächster Schritt</button><button type="button" class="chip" data-ma="ueberspringen">↷ Schritt überspringen</button><button type="button" class="chip" data-ma="stopp">■ Stopp</button>` : ""}
              <button type="button" class="chip" data-ma="neu">↺ Von vorn</button>
              <select data-mprio><option value="1" ${m.prioritaet === 1 ? "selected" : ""}>hoch</option><option value="2" ${m.prioritaet === 2 ? "selected" : ""}>mittel</option><option value="3" ${m.prioritaet === 3 ? "selected" : ""}>niedrig</option></select>
              <button type="button" class="chip" data-ma="loeschen">🗑</button>
            </div>
            <div class="zt-reihe"><input data-mnotiz placeholder="Entscheidung oder Notiz festhalten …"><button type="button" class="chip" data-mentsch>⚖ Als Entscheidung</button><button type="button" class="chip" data-mnotizb>📝 Als Notiz</button></div>
            ${(m.entscheidungen || []).length ? `<p class="muted zt-mini">Entscheidungen: ${(m.entscheidungen || []).map((e) => `${zeit(e.at)} ${esc(e.text)}`).join(" · ")}</p>` : ""}
            <details class="zt-details"><summary>Verlauf / Versionen (${(m.versionen || []).length})</summary>${(m.versionen || []).slice().reverse().map((v) => `<div class="zt-zeile klein"><small>${zeit(v.at)}</small> ${esc(v.was)}</div>`).join("")}${(m.notizen || []).map((n) => `<div class="zt-zeile klein"><small>${zeit(n.at)}</small> 📝 ${esc(n.text)}</div>`).join("")}</details>
          </div>` : ""}
        </div>`;
      }).join("") : '<p class="muted">Noch keine Missionen. Gib Friday oben einen größeren Auftrag – sie plant die Schritte selbst und arbeitet sie nacheinander ab (braucht Guthaben). Per Sprache: „Friday, neue Mission: …“</p>'}</div>`;
    let prTimer = null;
    $("zt-m-ziel").addEventListener("input", (e) => { clearTimeout(prTimer); prTimer = setTimeout(async () => { if (e.target.value.trim().length < 6) { $("zt-m-hint").textContent = ""; return; } const p = await post("/api/zentrale/prioritaet", { text: e.target.value }); $("zt-m-hint").textContent = `Erkannt: ${["", "hoch", "mittel", "niedrig"][p.prio]} (${p.grund})`; }, 400); });
    $("zt-m-neu").addEventListener("submit", async (e) => {
      e.preventDefault();
      const ziel = $("zt-m-ziel").value.trim(); if (!ziel) return;
      const b = e.target.querySelector("button"); b.disabled = true; b.textContent = "Friday plant …";
      const r = await post("/api/zentrale/missionen", { ziel, prioritaet: Number($("zt-m-prio").value) || undefined });
      if (r.error) toast(r.error, true); else { offeneMission = r.mission.id; toast(`Mission mit ${r.mission.schritte.length} Schritten angelegt`); }
      zeigeMissionen();
    });
    inhalt().querySelectorAll("[data-auf]").forEach((b) => b.addEventListener("click", () => { offeneMission = offeneMission === b.dataset.auf ? null : b.dataset.auf; zeigeMissionen(); }));
    inhalt().querySelectorAll(".zt-mission").forEach((el) => {
      const id = el.dataset.mid;
      el.querySelectorAll("[data-ma]").forEach((b) => b.addEventListener("click", async () => {
        if (b.dataset.ma === "loeschen" && !window.confirm("Mission wirklich löschen?")) return;
        b.disabled = true;
        if (b.dataset.ma === "schritt") b.textContent = "Friday arbeitet …";
        const r = await post(`/api/zentrale/missionen/${id}/${b.dataset.ma}`, {});
        if (r.error) toast(r.error, true);
        zeigeMissionen();
      }));
      el.querySelector("[data-mprio]")?.addEventListener("change", async (e) => { await post(`/api/zentrale/missionen/${id}`, { prioritaet: Number(e.target.value) }); zeigeMissionen(); });
      const feld = el.querySelector("[data-mnotiz]");
      el.querySelector("[data-mentsch]")?.addEventListener("click", async () => { if (!feld.value.trim()) return; await post(`/api/zentrale/missionen/${id}`, { entscheidung: feld.value }); zeigeMissionen(); });
      el.querySelector("[data-mnotizb]")?.addEventListener("click", async () => { if (!feld.value.trim()) return; await post(`/api/zentrale/missionen/${id}`, { notiz: feld.value }); zeigeMissionen(); });
    });
  }

  // ================= Automationen =================
  const TAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  async function zeigeAutomationen() {
    const d = await j("/api/zentrale/automationen");
    inhalt().innerHTML = `
      ${d.notfall ? '<p class="error">Notfallmodus ist an – Automationen laufen nicht.</p>' : ""}
      <form id="zt-a-neu" class="zt-neu zt-wenn">
        <div class="zt-reihe"><b>WENN</b><select id="zt-a-art">${Object.entries(d.ausloeser).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select>
          <input id="zt-a-zeit" type="time" value="07:30"><input id="zt-a-min" type="number" min="15" value="60" class="hidden" title="Minuten"></div>
        <div class="zt-reihe zt-tage" id="zt-a-tage">${[1, 2, 3, 4, 5, 6, 0].map((t) => `<label><input type="checkbox" value="${t}" checked>${TAGE[t]}</label>`).join("")}</div>
        <div class="zt-reihe"><b>DANN</b><select id="zt-a-aktion">${Object.entries(d.aktionen).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select>
          <input id="zt-a-text" placeholder="z. B. „Wie wird das Wetter heute und was steht an?“"></div>
        <div class="zt-reihe"><input id="zt-a-name" placeholder="Name (optional)"><button class="chip primary" type="submit">＋ Regel speichern</button></div>
        <p class="muted zt-mini">„Friday einen Auftrag geben“ nutzt Claude (Guthaben). Kritische Aktionen aus Automationen warten je nach Autonomie-Stufe auf deine Freigabe.</p>
      </form>
      <div class="zt-liste">${d.regeln.length ? d.regeln.map((r) => `<div class="zt-zeile"><label class="zt-schalter"><input type="checkbox" data-aan="${r.id}" ${r.an ? "checked" : ""}><i></i></label>
        <div><b>${esc(r.name)}</b><small>${esc(beschreibe(r, d))}</small>${r.zuletzt ? `<small class="${r.ok === false ? "error" : "muted"}">Zuletzt ${zeit(r.zuletzt)}: ${esc((r.ergebnis || "").slice(0, 160))}</small>` : ""}</div>
        <div class="zt-knoepfe"><button type="button" class="chip" data-ajetzt="${r.id}">▶ Jetzt</button><button type="button" class="chip" data-aweg="${r.id}">🗑</button></div></div>`).join("") : '<p class="muted">Noch keine Regeln. Beispiel: „Jeden Werktag um 7:30 → Friday: Was steht heute an?“</p>'}</div>`;
    const art = $("zt-a-art");
    const sync = () => { $("zt-a-zeit").classList.toggle("hidden", art.value !== "taeglich"); $("zt-a-tage").classList.toggle("hidden", art.value !== "taeglich"); $("zt-a-min").classList.toggle("hidden", art.value !== "intervall"); $("zt-a-text").placeholder = $("zt-a-aktion").value === "protokoll" ? "Name des Protokolls" : "Text"; };
    art.addEventListener("change", sync); $("zt-a-aktion").addEventListener("change", sync); sync();
    $("zt-a-neu").addEventListener("submit", async (e) => {
      e.preventDefault();
      const a = $("zt-a-aktion").value, text = $("zt-a-text").value.trim();
      const r = await post("/api/zentrale/automationen", {
        name: $("zt-a-name").value,
        ausloeser: { art: art.value, zeit: $("zt-a-zeit").value, minuten: Number($("zt-a-min").value), tage: [...$("zt-a-tage").querySelectorAll("input:checked")].map((x) => Number(x.value)) },
        aktion: a === "protokoll" ? { art: a, name: text } : { art: a, text },
      });
      if (r.error) toast(r.error, true); else { toast("Regel gespeichert"); zeigeAutomationen(); }
    });
    inhalt().querySelectorAll("[data-aan]").forEach((c) => c.addEventListener("change", () => post(`/api/zentrale/automationen/${c.dataset.aan}/an`, { an: c.checked })));
    inhalt().querySelectorAll("[data-ajetzt]").forEach((b) => b.addEventListener("click", async () => { b.disabled = true; b.textContent = "läuft …"; const r = await post(`/api/zentrale/automationen/${b.dataset.ajetzt}/jetzt`, {}); toast(r.error || r.ergebnis || "Erledigt", !r.ok); zeigeAutomationen(); }));
    inhalt().querySelectorAll("[data-aweg]").forEach((b) => b.addEventListener("click", async () => { await j(`/api/zentrale/automationen/${b.dataset.aweg}`, { method: "DELETE" }); zeigeAutomationen(); }));
  }
  function beschreibe(r, d) {
    const a = r.ausloeser, x = r.aktion;
    const wann = a.art === "taeglich" ? `${a.tage.length === 7 ? "Täglich" : a.tage.map((t) => TAGE[t]).join(", ")} um ${a.zeit}` : a.art === "intervall" ? `Alle ${a.minuten} Minuten` : "Wenn Friday startet";
    return `${wann} → ${d.aktionen[x.art]}: ${x.name || x.text}`;
  }

  // ================= Denk-Labor =================
  let laborDaten = null, laborWahl = "hypothesen", laborBild = null;
  async function zeigeLabor() {
    laborDaten ||= await j("/api/zentrale/labor");
    const v = laborDaten.vorlagen;
    const akt = v.find((x) => x.id === laborWahl) || v[0];
    inhalt().innerHTML = `
      <div class="zt-labor">
        <div class="zt-werkzeuge">${Object.entries(laborDaten.gruppen).map(([g, n]) => `<h5>${esc(n)}</h5>${v.filter((x) => x.gruppe === g).map((x) => `<button type="button" data-lv="${x.id}" class="${x.id === akt.id ? "on" : ""}">${x.emoji} ${esc(x.name)}</button>`).join("")}`).join("")}</div>
        <div class="zt-arbeit">
          <h4>${akt.emoji} ${esc(akt.name)}</h4><p class="muted">${esc(akt.text)}</p>
          ${akt.bild ? `<label class="zt-datei"><input type="file" id="zt-l-bild" accept="image/*"><span id="zt-l-bildname">📷 Bild wählen (Skizze, Screenshot, Foto)</span></label>` : ""}
          <textarea id="zt-l-text" rows="7" placeholder="${esc(akt.platz)}"></textarea>
          <div class="zt-reihe">
            <label class="zt-check"><input type="checkbox" id="zt-l-pruef"> Selbstprüfung (Qualitätsoptimierung, ≈ doppelte Kosten)</label>
            <label class="zt-check"><input type="checkbox" id="zt-l-doc"> Als Dokument speichern</label>
            <select id="zt-l-modell" title="KI-Modell"><option value="auto">Modell: automatisch</option><option value="leicht">Haiku (schnell)</option><option value="mittel">Sonnet</option><option value="schwer">Opus (gründlich)</option></select>
            <button type="button" id="zt-l-los" class="chip primary">▶ Denken lassen</button>
          </div>
          <div id="zt-l-erg" class="zt-ergebnis"></div>
        </div>
      </div>`;
    inhalt().querySelectorAll("[data-lv]").forEach((b) => b.addEventListener("click", () => { laborWahl = b.dataset.lv; laborBild = null; zeigeLabor(); }));
    $("zt-l-bild")?.addEventListener("change", async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      laborBild = await bildKlein(f);
      $("zt-l-bildname").textContent = `📷 ${f.name}`;
    });
    $("zt-l-los").addEventListener("click", async () => {
      const b = $("zt-l-los"); b.disabled = true; b.textContent = "Friday denkt …";
      $("zt-l-erg").innerHTML = '<p class="muted zt-denkt">Friday denkt nach …</p>';
      const r = await post("/api/zentrale/labor", { vorlage: akt.id, text: $("zt-l-text").value, image: laborBild, selbstpruefung: $("zt-l-pruef").checked, speichern: $("zt-l-doc").checked, modell: $("zt-l-modell").value });
      b.disabled = false; b.textContent = "▶ Denken lassen";
      if (r.error) { $("zt-l-erg").innerHTML = `<p class="error">${esc(r.error)}</p>${r.leer ? '<p class="muted">Das Denk-Labor braucht Claude-Guthaben. Offline gehen: Rechnen, Persönlich, Wissen, Sicherheit.</p>' : ""}`; return; }
      $("zt-l-erg").innerHTML = `
        ${r.warnung ? `<div class="zt-warn">⚠ Manipulationsverdacht in der Eingabe: ${r.warnung.funde.map((f) => esc(f.art)).join(" · ")}. Friday hat die Stellen nur als Material behandelt.</div>` : ""}
        <div class="zt-md">${md(r.text)}</div>
        ${r.pruefung ? `<details class="zt-details"><summary>Selbstprüfung – was Friday verbessert hat</summary><div class="zt-md">${md(r.pruefung)}</div></details>` : ""}
        ${r.quellen?.length ? `<details class="zt-details"><summary>Quellen (${r.quellen.length})</summary>${r.quellen.map((q) => `<div class="zt-zeile klein">${/^https?:\/\//.test(q.link || "") ? `<a href="${esc(q.link)}" target="_blank" rel="noopener">${esc(q.titel)}</a>` : esc(q.titel)}</div>`).join("")}</details>` : ""}
        ${r.aufgaben?.length ? `<button type="button" class="chip primary" id="zt-l-aufg">＋ ${r.aufgaben.length} Aufgaben übernehmen</button>` : ""}
        <p class="muted zt-mini">Modell: ${esc(r.model || "")}${r.routing ? ` (${esc(r.routing.grund)})` : ""}${r.dokumentId ? " · als Dokument gespeichert" : ""}</p>`;
      $("zt-l-aufg")?.addEventListener("click", async (e) => { await post("/api/zentrale/labor/aufgaben", { aufgaben: r.aufgaben }); e.target.disabled = true; e.target.textContent = "✓ In deinen Aufgaben"; });
    });
  }
  function bildKlein(datei) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 1568 / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res({ data: c.toDataURL("image/jpeg", 0.85).split(",")[1], mediaType: "image/jpeg" });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => res(null);
      img.src = URL.createObjectURL(datei);
    });
  }

  // ================= Rechnen =================
  let rechenTab = "formel";
  function zeigeRechnen() {
    const T = { formel: "∑ Formel-Labor", prognose: "📈 Prognose", sim: "🔀 Was-wäre-wenn / Simulator", d3: "🧊 3D-Modell vermessen" };
    inhalt().innerHTML = `<div class="zt-unter">${Object.entries(T).map(([k, v]) => `<button type="button" data-rt="${k}" class="${k === rechenTab ? "on" : ""}">${v}</button>`).join("")}</div><div id="zt-r"></div><p class="muted zt-mini">Alles hier rechnet Friday selbst – ohne Claude, kostenlos und sofort.</p>`;
    inhalt().querySelectorAll("[data-rt]").forEach((b) => b.addEventListener("click", () => { rechenTab = b.dataset.rt; zeigeRechnen(); }));
    ({ formel: rFormel, prognose: rPrognose, sim: rSim, d3: r3d })[rechenTab]();
  }
  function rFormel() {
    $("zt-r").innerHTML = `
      <textarea id="zt-f" rows="5" spellcheck="false" placeholder="z. B.\nradius = 4\nflaeche = pi * radius^2\nflaeche * 2">radius = 4\nflaeche = pi * radius^2\nflaeche * 2</textarea>
      <div class="zt-reihe"><span class="muted zt-mini">Wertetabelle für</span><input id="zt-f-var" placeholder="Variable (z. B. radius)" size="10"><input id="zt-f-von" type="number" value="0" step="any" size="5"><span>bis</span><input id="zt-f-bis" type="number" value="10" step="any" size="5"><button type="button" class="chip primary" id="zt-f-los">= Rechnen</button></div>
      <p class="muted zt-mini">Funktionen: sqrt, sin/cos/tan (Bogenmaß), sind/cosd/tand (Grad), ln, log, exp, abs, round, min, max, fak, mittel, summe · Konstanten: pi, e, g, c · 5! · 2^8 · 19% · 2x = 2*x</p>
      <div id="zt-f-erg"></div>`;
    const los = async () => {
      const v = $("zt-f-var").value.trim();
      const r = await post("/api/zentrale/rechnen/formel", { formel: $("zt-f").value, tabelle: v ? { variable: v, von: $("zt-f-von").value, bis: $("zt-f-bis").value, schritte: 20 } : null });
      if (r.error) { $("zt-f-erg").innerHTML = `<p class="error">${esc(r.error)}</p>`; return; }
      $("zt-f-erg").innerHTML = `<div class="zt-gross-zahl">= ${zahl(r.ergebnis)}</div>${r.schritte.length > 1 ? `<div class="zt-liste">${r.schritte.map((s) => `<div class="zt-zeile klein"><code>${esc(s.zeile)}</code> <b>${zahl(s.wert)}</b></div>`).join("")}</div>` : ""}${r.tabelle ? linienSvg(r.tabelle.map((p) => p.x), r.tabelle.map((p) => p.y)) : ""}`;
    };
    $("zt-f-los").addEventListener("click", los);
    $("zt-f").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) los(); });
    los();
  }
  function rPrognose() {
    $("zt-r").innerHTML = `
      <textarea id="zt-p" rows="6" placeholder="Eine Zahl pro Zeile oder Tabelle (Name;Wert), z. B. aus Excel kopiert">Jan;120\nFeb;135\nMär;128\nApr;150\nMai;162\nJun;171</textarea>
      <div class="zt-reihe"><span>Vorausschau:</span><input id="zt-p-n" type="number" min="1" max="60" value="4"><span>Schritte</span><button type="button" class="chip primary" id="zt-p-los">📈 Prognose</button></div><div id="zt-p-erg"></div>`;
    $("zt-p-los").addEventListener("click", async () => {
      const r = await post("/api/zentrale/rechnen/prognose", { daten: $("zt-p").value, schritte: Number($("zt-p-n").value) });
      if (r.error) { $("zt-p-erg").innerHTML = `<p class="error">${esc(r.error)}</p>`; return; }
      const xs = [...r.werte.map((_, i) => i + 1), ...r.zukunft.map((z) => r.werte.length + z.schritt)];
      $("zt-p-erg").innerHTML = `
        <div class="zt-kacheln"><div><span>Trend</span><b>${esc(r.trend.richtung)}</b></div><div><span>pro Schritt</span><b>${zahl(r.trend.steigung)}</b></div><div><span>Sicherheit</span><b>${esc(r.sicherheit)}</b></div><div><span>R²</span><b>${zahl(r.trend.r2)}</b></div>${r.wachstum_prozent != null ? `<div><span>Wachstum bisher</span><b>${zahl(r.wachstum_prozent)} %</b></div>` : ""}</div>
        ${linienSvg(xs, [...r.werte, ...r.zukunft.map((z) => z.wert)], { ab: r.werte.length, unten: [...r.werte, ...r.zukunft.map((z) => z.unten)], oben: [...r.werte, ...r.zukunft.map((z) => z.oben)] })}
        <div class="zt-liste">${r.zukunft.map((z) => `<div class="zt-zeile klein">+${z.schritt}: <b>${zahl(z.wert)}</b> <small class="muted">(zwischen ${zahl(z.unten)} und ${zahl(z.oben)})</small></div>`).join("")}</div>
        <p class="muted zt-mini">${esc(r.hinweis)}</p>`;
    });
    $("zt-p-los").click();
  }
  function rSim() {
    $("zt-r").innerHTML = `
      <p class="muted">Beschreibe dein System mit unsicheren Größen (Min / wahrscheinlich / Max) und vergleiche bis zu 4 Szenarien. Friday rechnet es 5000-mal mit Zufallswerten durch.</p>
      <table class="zt-tabelle zt-vars"><thead><tr><th>Größe</th><th>Min</th><th>wahrscheinlich</th><th>Max</th><th></th></tr></thead><tbody id="zt-s-vars"></tbody></table>
      <button type="button" class="chip" id="zt-s-plus">＋ Größe</button>
      <div id="zt-s-sz"></div>
      <div class="zt-reihe"><button type="button" class="chip" id="zt-s-szplus">＋ Szenario</button><span>Schwelle (optional):</span><input id="zt-s-schwelle" type="number" step="any" placeholder="z. B. 0"><button type="button" class="chip primary" id="zt-s-los">🔀 Simulieren</button></div>
      <div id="zt-s-erg"></div>`;
    const vars = [["preis", 8, 10, 12], ["menge", 50, 100, 180], ["kosten", 600, 700, 900]];
    const sz = [["Jetzt", "preis * menge - kosten"], ["Preis +20 %", "preis * 1.2 * menge * 0.85 - kosten"]];
    const zeileVar = (v) => `<tr><td><input value="${esc(v[0])}" size="9"></td><td><input type="number" step="any" value="${v[1]}"></td><td><input type="number" step="any" value="${v[2]}"></td><td><input type="number" step="any" value="${v[3]}"></td><td><button type="button" class="ghost small" data-weg>✕</button></td></tr>`;
    const zeileSz = (s) => `<div class="zt-reihe zt-sz"><input value="${esc(s[0])}" placeholder="Name" size="12"><input value="${esc(s[1])}" placeholder="Formel" class="zt-breit"><button type="button" class="ghost small" data-weg>✕</button></div>`;
    $("zt-s-vars").innerHTML = vars.map(zeileVar).join(""); $("zt-s-sz").innerHTML = sz.map(zeileSz).join("");
    $("zt-r").addEventListener("click", (e) => { if (e.target.matches("[data-weg]")) e.target.closest("tr, .zt-sz").remove(); });
    $("zt-s-plus").addEventListener("click", () => $("zt-s-vars").insertAdjacentHTML("beforeend", zeileVar(["x", 0, 1, 2])));
    $("zt-s-szplus").addEventListener("click", () => $("zt-s-sz").insertAdjacentHTML("beforeend", zeileSz([`Szenario ${$("zt-s-sz").children.length + 1}`, ""])));
    $("zt-s-los").addEventListener("click", async () => {
      const variablen = [...$("zt-s-vars").querySelectorAll("tr")].map((tr) => { const i = tr.querySelectorAll("input"); return { name: i[0].value.trim(), min: i[1].value, wahrscheinlich: i[2].value, max: i[3].value }; });
      const szenarien = [...$("zt-s-sz").querySelectorAll(".zt-sz")].map((d) => { const i = d.querySelectorAll("input"); return { name: i[0].value, formel: i[1].value }; });
      const sw = $("zt-s-schwelle").value;
      const r = await post("/api/zentrale/rechnen/simulation", { variablen, szenarien, schwelle: sw === "" ? null : Number(sw) });
      if (r.error) { $("zt-s-erg").innerHTML = `<p class="error">${esc(r.error)}</p>`; return; }
      $("zt-s-erg").innerHTML = `<div class="zt-sz-erg">${r.auswertung.map((a) => a.error ? `<div class="zt-sim"><b>${esc(a.name)}</b><p class="error">${esc(a.error)}</p></div>` : `<div class="zt-sim ${a.name === r.bestes ? "bestes" : ""}"><b>${esc(a.name)}${a.name === r.bestes ? " 🏆" : ""}</b>
        <div class="zt-histo">${a.histogramm.map((h) => `<i style="height:${Math.max(2, Math.round((h / Math.max(...a.histogramm)) * 100))}%"></i>`).join("")}</div>
        <div class="zt-kacheln klein"><div><span>schlecht (P10)</span><b>${zahl(a.p10)}</b></div><div><span>typisch</span><b>${zahl(a.median)}</b></div><div><span>gut (P90)</span><b>${zahl(a.p90)}</b></div>${a.ueber_schwelle != null ? `<div><span>über Schwelle</span><b>${zahl(a.ueber_schwelle)} %</b></div>` : ""}</div></div>`).join("")}</div><p class="muted zt-mini">${esc(r.hinweis)}</p>`;
    });
  }
  function r3d() {
    $("zt-r").innerHTML = `<label class="zt-datei"><input type="file" id="zt-3d" accept=".stl,.obj"><span>🧊 STL- oder OBJ-Datei wählen</span></label><div id="zt-3d-erg"></div>`;
    $("zt-3d").addEventListener("change", async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      if (f.size > 40 * 1024 * 1024) { $("zt-3d-erg").innerHTML = '<p class="error">Höchstens 40 MB.</p>'; return; }
      $("zt-3d-erg").innerHTML = '<p class="muted">Vermesse …</p>';
      const buf = new Uint8Array(await f.arrayBuffer());
      let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      const r = await post("/api/zentrale/rechnen/modell3d", { daten: btoa(s), name: f.name });
      if (r.error) { $("zt-3d-erg").innerHTML = `<p class="error">${esc(r.error)}</p>`; return; }
      $("zt-3d-erg").innerHTML = `<div class="zt-kacheln"><div><span>Format</span><b>${esc(r.format)}</b></div><div><span>Dreiecke</span><b>${zahl(r.dreiecke)}</b></div><div><span>Größe (B×T×H)</span><b>${r.masse.map(zahl).join(" × ")}</b></div><div><span>Oberfläche</span><b>${zahl(r.flaeche)}</b></div><div><span>Volumen</span><b>${zahl(r.volumen)}</b></div><div><span>Dicht (druckbar)</span><b>${r.dicht ? "✓ ja" : "✕ nein"}</b></div>${r.druck_gramm_pla != null ? `<div><span>PLA (100 %)</span><b>≈ ${zahl(r.druck_gramm_pla)} g</b></div>` : ""}</div>${r.tipps.map((t) => `<p class="zt-problem">⚠ ${esc(t)}</p>`).join("")}<p class="muted zt-mini">${esc(r.hinweis)}</p>`;
    });
  }
  function linienSvg(xs, ys, { ab = null, unten = null, oben = null } = {}) {
    const W = 600, H = 200, P = 28;
    const alle = [...ys, ...(unten || []), ...(oben || [])].filter(Number.isFinite);
    if (!alle.length) return "";
    const minY = Math.min(...alle), maxY = Math.max(...alle), minX = Math.min(...xs), maxX = Math.max(...xs);
    const X = (x) => P + ((x - minX) / (maxX - minX || 1)) * (W - 2 * P), Y = (y) => H - P - ((y - minY) / (maxY - minY || 1)) * (H - 2 * P);
    const pfad = (arr, von = 0, bis = arr.length) => arr.slice(von, bis).map((y, i) => (Number.isFinite(y) ? `${i ? "L" : "M"}${X(xs[von + i]).toFixed(1)},${Y(y).toFixed(1)}` : "")).join("");
    const band = unten && oben && ab != null ? `<path d="${pfad(oben, ab - 1)}L${xs.slice(ab - 1).map((_, i, a) => `${X(xs[xs.length - 1 - i]).toFixed(1)},${Y(unten[unten.length - 1 - i]).toFixed(1)}`).join("L")}Z" class="zt-band"/>` : "";
    return `<svg class="zt-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${band}<path d="${pfad(ys, 0, ab ?? ys.length)}" class="zt-linie"/>${ab != null ? `<path d="${pfad(ys, ab - 1)}" class="zt-linie zukunft"/>` : ""}<text x="4" y="14">${zahl(maxY)}</text><text x="4" y="${H - 6}">${zahl(minY)}</text></svg>`;
  }

  // ================= Persönlich =================
  async function zeigePersoenlich() {
    const [d, g] = await Promise.all([j("/api/zentrale/persoenlich"), j("/api/zentrale/gewohnheiten?tage=30")]);
    const pnamen = ["", "hoch", "mittel", "niedrig"];
    inhalt().innerHTML = `
      <h3>Prioritäten – was ist jetzt wichtig?</h3>
      <div class="zt-liste">${d.prioritaeten.length ? d.prioritaeten.slice(0, 12).map((p) => `<div class="zt-zeile klein"><span class="zt-prio p${p.prio}">${pnamen[p.prio]}</span> ${esc(p.text)} <small class="muted">${esc(p.quelle)} · ${esc(p.grund)}</small></div>`).join("") : '<p class="muted">Keine offenen Aufgaben, Ziel-Schritte oder Erinnerungen.</p>'}</div>
      <h3>Ziel-Navigator</h3>
      <form id="zt-z-neu" class="zt-reihe"><input id="zt-z-titel" placeholder="Langfristiges Ziel, z. B. „Fit für einen 10-km-Lauf“" class="zt-breit"><input id="zt-z-frist" placeholder="bis wann?" size="10"><button class="chip primary" type="submit">🧭 In Schritte zerlegen</button></form>
      <div class="zt-liste">${d.ziele.map((z) => `<div class="zt-ziel"><div class="zt-reihe"><b>${esc(z.titel)}</b>${z.frist ? `<small class="muted">bis ${esc(z.frist)}</small>` : ""}<span class="zt-balken"><i style="width:${z.fortschritt}%"></i></span><small>${z.fortschritt} %</small><button type="button" class="chip" data-zauf="${z.id}" title="Nächsten Schritt in Aufgaben">→ Aufgaben</button><button type="button" class="ghost small" data-zweg="${z.id}">✕</button></div>
        ${z.hinweis ? `<p class="muted zt-mini">${esc(z.hinweis)}${z.mitClaude ? "" : " (einfacher Plan ohne Claude)"}</p>` : ""}
        <ol class="zt-schritte">${z.schritte.map((s) => `<li class="${s.erledigt ? "fertig" : "offen"}"><label class="zt-check"><input type="checkbox" data-zs="${z.id}|${s.id}" ${s.erledigt ? "checked" : ""}> ${esc(s.text)}</label>${s.frist ? `<small class="muted">${esc(s.frist)}</small>` : ""}</li>`).join("")}</ol></div>`).join("")}</div>
      <h3>Entscheidungsarchiv ${d.bilanz.schnitt ? `<small class="muted">· rückblickend Ø ${d.bilanz.schnitt}/5</small>` : ""}</h3>
      ${d.bilanz.faellig.length ? `<p class="zt-problem">⏰ ${d.bilanz.faellig.length} Entscheidung(en) solltest du jetzt rückblickend bewerten.</p>` : ""}
      <form id="zt-e-neu" class="zt-neu"><div class="zt-reihe"><input id="zt-e-frage" placeholder="Worum ging es?" class="zt-breit"><input id="zt-e-bereich" placeholder="Bereich (z. B. Geld)" size="12"></div>
        <div class="zt-reihe"><input id="zt-e-ent" placeholder="Was hast du entschieden?" class="zt-breit"><label>prüfen am <input id="zt-e-pruef" type="date"></label></div>
        <textarea id="zt-e-gruende" rows="2" placeholder="Warum? Welche Alternativen gab es?"></textarea><button class="chip primary" type="submit">⚖ Festhalten</button></form>
      <div class="zt-liste">${d.entscheidungen.slice(0, 30).map((e) => `<div class="zt-zeile"><div><b>${esc(e.entscheidung)}</b><small>${esc(e.frage)} · ${zeit(e.datum)}${e.bereich ? ` · ${esc(e.bereich)}` : ""}</small>${e.gruende ? `<small class="muted">${esc(e.gruende)}</small>` : ""}${e.ergebnis ? `<small>Ergebnis: ${esc(e.ergebnis)}</small>` : ""}</div>
        <div class="zt-knoepfe"><span class="zt-sterne" data-eid="${e.id}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-stern="${n}" class="${e.bewertung >= n ? "on" : ""}" title="${n}/5">★</button>`).join("")}</span><button type="button" class="chip" data-eerg="${e.id}">Ergebnis</button><button type="button" class="ghost small" data-eweg="${e.id}">✕</button></div></div>`).join("")}</div>
      <h3>Gewohnheitsanalyse <small class="muted">(letzte 30 Tage, ${g.anzahl} Gespräche)</small></h3>
      ${g.anzahl ? `<div class="zt-stunden">${g.stunden.map((n, h) => `<i style="height:${Math.max(3, Math.round((n / Math.max(1, ...g.stunden)) * 100))}%" title="${h} Uhr: ${n}"></i>`).join("")}</div><div class="zt-achse"><span>0</span><span>6</span><span>12</span><span>18</span><span>23 Uhr</span></div>
        ${g.erkenntnisse.map((t) => `<p>• ${esc(t)}</p>`).join("")}
        <p class="muted zt-mini">Häufige Themen: ${g.themen.slice(0, 10).map((t) => `${esc(t.name)} (${t.anzahl})`).join(", ")}</p>
        ${g.wiederkehrend.length ? `<p class="muted zt-mini">Tipp: Wiederkehrendes kannst du unter ⚙ Automationen automatisch laufen lassen.</p>` : ""}` : '<p class="muted">Noch zu wenig Gespräche für eine Auswertung.</p>'}
      <h3>Persönliches Wissensprofil</h3>
      <div class="zt-profil">${[["interessen", "Interessen"], ["faehigkeiten", "Fähigkeiten"], ["lernziele", "Lernziele"], ["werte", "Was mir wichtig ist"]].map(([k, n]) => `<label><span>${n}</span><input data-profil="${k}" value="${esc(d.profil[k].join(", "))}" placeholder="durch Komma trennen"></label>`).join("")}<button type="button" class="chip primary" id="zt-pr-sp">Profil speichern</button></div>`;
    $("zt-z-neu").addEventListener("submit", async (e) => {
      e.preventDefault(); const t = $("zt-z-titel").value.trim(); if (!t) return;
      const b = e.target.querySelector("button"); b.disabled = true; b.textContent = "Friday plant …";
      const r = await post("/api/zentrale/ziele", { titel: t, frist: $("zt-z-frist").value });
      if (r.error) toast(r.error, true); zeigePersoenlich();
    });
    inhalt().querySelectorAll("[data-zs]").forEach((c) => c.addEventListener("change", async () => { const [id, s] = c.dataset.zs.split("|"); await post(`/api/zentrale/ziele/${id}`, { schritt: s }); zeigePersoenlich(); }));
    inhalt().querySelectorAll("[data-zauf]").forEach((b) => b.addEventListener("click", async () => { await post(`/api/zentrale/ziele/${b.dataset.zauf}`, { inAufgaben: true }); toast("Nächster Schritt steht in deinen Aufgaben"); }));
    inhalt().querySelectorAll("[data-zweg]").forEach((b) => b.addEventListener("click", async () => { if (!window.confirm("Ziel löschen?")) return; await post(`/api/zentrale/ziele/${b.dataset.zweg}`, { loeschen: true }); zeigePersoenlich(); }));
    $("zt-e-neu").addEventListener("submit", async (e) => {
      e.preventDefault();
      const r = await post("/api/zentrale/entscheidungen", { frage: $("zt-e-frage").value, entscheidung: $("zt-e-ent").value, gruende: $("zt-e-gruende").value, bereich: $("zt-e-bereich").value, pruefen_am: $("zt-e-pruef").value });
      if (r.error) toast(r.error, true); else zeigePersoenlich();
    });
    const eintraege = new Map(d.entscheidungen.map((e) => [e.id, e]));
    inhalt().querySelectorAll(".zt-sterne").forEach((s) => s.addEventListener("click", async (e) => { const n = e.target.dataset.stern; if (!n) return; await post("/api/zentrale/entscheidungen", { ...eintraege.get(s.dataset.eid), bewertung: Number(n) }); zeigePersoenlich(); }));
    inhalt().querySelectorAll("[data-eerg]").forEach((b) => b.addEventListener("click", async () => { const e = eintraege.get(b.dataset.eerg); const t = window.prompt("Wie ist es ausgegangen?", e.ergebnis || ""); if (t == null) return; await post("/api/zentrale/entscheidungen", { ...e, ergebnis: t }); zeigePersoenlich(); }));
    inhalt().querySelectorAll("[data-eweg]").forEach((b) => b.addEventListener("click", async () => { if (!window.confirm("Entscheidung löschen?")) return; await j(`/api/zentrale/entscheidungen/${b.dataset.eweg}`, { method: "DELETE" }); zeigePersoenlich(); }));
    $("zt-pr-sp").addEventListener("click", async () => {
      const p = {}; inhalt().querySelectorAll("[data-profil]").forEach((i) => { p[i.dataset.profil] = i.value.split(",").map((x) => x.trim()).filter(Boolean); });
      await post("/api/zentrale/profil", p); toast("Profil gespeichert");
    });
  }

  // ================= Wissen: Zeitachse + Wissensgraph =================
  const ART = { mission: ["🚀", "Mission"], ziel: ["🧭", "Ziel"], entscheidung: ["⚖", "Entscheidung"], dokument: ["📄", "Dokument"], update: ["⬇", "Update"], modul: ["🧩", "Modul"], wissen: ["🧠", "Wissen"], person: ["👤", "Person"], interesse: ["✦", "Interesse"] };
  async function zeigeWissen() {
    const [z, g] = await Promise.all([j("/api/zentrale/zeitachse?tage=180"), j("/api/zentrale/wissensgraph")]);
    const max = Math.max(1, ...z.aktivitaet.map((a) => a.anzahl));
    inhalt().innerHTML = `
      <h3>Persönlicher Wissensgraph <small class="muted">${g.knoten.length} Knoten · ${g.kanten.length} Verbindungen</small></h3>
      ${g.knoten.length ? `<canvas id="zt-graph" class="zt-graph"></canvas><div class="zt-legende">${Object.entries(ART).map(([k, [e, n]]) => `<span>${e} ${n}</span>`).join("")}</div>${g.themen.length ? `<p class="muted zt-mini">Verbindende Themen: ${g.themen.slice(0, 12).map((t) => esc(t.begriff)).join(", ")}</p>` : ""}` : '<p class="muted">Noch leer. Lege Missionen, Ziele, Entscheidungen oder Dokumente an – Friday verknüpft sie hier automatisch über gemeinsame Begriffe.</p>'}
      <h3>Digitale Zeitachse <small class="muted">(letzte 180 Tage)</small></h3>
      ${z.aktivitaet.length ? `<div class="zt-stunden zt-akt">${z.aktivitaet.slice().reverse().map((a) => `<i style="height:${Math.max(3, Math.round((a.anzahl / max) * 100))}%" title="${esc(a.tag)}: ${a.anzahl} Einträge"></i>`).join("")}</div><p class="muted zt-mini">Aktivität pro Tag (aus dem Logbuch)</p>` : ""}
      <ol class="zt-zeitachse">${z.ereignisse.length ? z.ereignisse.map((e) => `<li class="${e.art}"><span class="zt-sym">${(ART[e.art] || ["•"])[0]}</span><div><small>${zeit(e.at)}</small><b>${esc(e.titel)}</b>${e.details ? `<small class="muted">${esc(e.details)}</small>` : ""}</div></li>`).join("") : '<li class="muted">Noch keine Ereignisse.</li>'}</ol>`;
    if (g.knoten.length) graph(g);
  }
  function graph(g) {
    const cv = $("zt-graph"); const ctx = cv.getContext("2d");
    const b = cv.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = b.width, H = b.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const farbe = getComputedStyle(document.documentElement).getPropertyValue("--cyan").trim() || "#ff8a1f";
    const k = g.knoten.map((n, i) => ({ ...n, x: W / 2 + Math.cos(i * 2.4) * W * 0.3 * Math.random(), y: H / 2 + Math.sin(i * 2.4) * H * 0.3 * Math.random(), vx: 0, vy: 0 }));
    const idx = new Map(k.map((n, i) => [n.id, i]));
    const kanten = g.kanten.map((e) => [idx.get(e.von), idx.get(e.nach), e.gewicht]).filter((e) => e[0] != null && e[1] != null);
    for (let it = 0; it < 260; it++) {
      for (let a = 0; a < k.length; a++) for (let c = a + 1; c < k.length; c++) {
        const dx = k[a].x - k[c].x, dy = k[a].y - k[c].y, d2 = dx * dx + dy * dy + 0.01, f = 900 / d2;
        k[a].vx += dx * f; k[a].vy += dy * f; k[c].vx -= dx * f; k[c].vy -= dy * f;
      }
      for (const [a, c, w] of kanten) { const dx = k[c].x - k[a].x, dy = k[c].y - k[a].y, f = 0.004 * Math.min(3, w); k[a].vx += dx * f; k[a].vy += dy * f; k[c].vx -= dx * f; k[c].vy -= dy * f; }
      for (const n of k) { n.vx += (W / 2 - n.x) * 0.002; n.vy += (H / 2 - n.y) * 0.002; n.x = Math.max(20, Math.min(W - 20, n.x + Math.max(-8, Math.min(8, n.vx)))); n.y = Math.max(14, Math.min(H - 14, n.y + Math.max(-8, Math.min(8, n.vy)))); n.vx *= 0.6; n.vy *= 0.6; }
    }
    ctx.strokeStyle = farbe; ctx.lineWidth = 1;
    for (const [a, c, w] of kanten) { ctx.globalAlpha = Math.min(0.7, 0.15 + w * 0.12); ctx.beginPath(); ctx.moveTo(k[a].x, k[a].y); ctx.lineTo(k[c].x, k[c].y); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.textAlign = "center"; ctx.font = "11px system-ui";
    for (const n of k) {
      ctx.fillStyle = farbe; ctx.beginPath(); ctx.arc(n.x, n.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(`${(ART[n.art] || ["•"])[0]} ${n.name.length > 26 ? `${n.name.slice(0, 25)}…` : n.name}`, n.x, n.y - 8);
    }
  }

  // ================= Netzwerk: Geräte + Umgebungen =================
  const NUR_GERAET = /^friday_(token|voice|wake|alarm_last|focus_|boot|theme_mockup|sync_|umgebungen|leistung)/;
  const umgebungen = () => { try { return JSON.parse(localStorage.getItem("friday_umgebungen") || "{}") || {}; } catch { return {}; } };
  async function zeigeNetzwerk() {
    const d = await j("/api/zentrale/netzwerk");
    const u = umgebungen();
    let aktiv = ""; try { aktiv = localStorage.getItem("friday_umgebung_aktiv") || ""; } catch { /* egal */ }
    inhalt().innerHTML = `
      <h3>FRIDAY Command Network <small class="muted">${d.online} von ${d.gesamt} online</small></h3>
      <div class="zt-netz">
        <svg viewBox="0 0 400 260" class="zt-netz-svg" aria-hidden="true">${d.knoten.slice(1).map((n, i, a) => { const w = (i / a.length) * Math.PI * 2 - Math.PI / 2; const x = 200 + Math.cos(w) * 150, y = 130 + Math.sin(w) * 96; const name = n.name.length > 14 ? `${n.name.slice(0, 13)}…` : n.name; return `<line x1="200" y1="130" x2="${x}" y2="${y}" class="${n.zustand}"/><circle cx="${x}" cy="${y}" r="8" class="${n.zustand}"/><text x="${x}" y="${y + (y > 130 ? 20 : -13)}">${esc(n.emoji)} ${esc(name)}</text>`; }).join("")}<circle cx="200" cy="130" r="22" class="kern ${d.knoten[0].zustand}"/><text x="200" y="134" class="kern">FRIDAY</text></svg>
        <div class="zt-liste">${d.knoten.map((n) => `<div class="zt-zeile klein"><span class="zt-dot ${n.zustand}"></span><b>${esc(n.emoji)} ${esc(n.name)}</b><small class="muted">${esc(n.text)}</small></div>`).join("")}</div>
      </div>
      <p class="muted zt-mini">Digitales Modell: Friday fragt alle Geräte und Dienste live ab. Einrichten: Werkzeug-Menü → Verbindungen, Fernbedienung, Alexa.</p>
      <h3>Umgebungen</h3>
      <p class="muted">Speichere deine aktuellen Dashboard-Einstellungen (Farbe, Kopf-Stil, Glow, Karten, Textgröße …) als Umgebung, z. B. „Arbeit“ oder „Abend“, und wechsle mit einem Tipp. Gilt auf Mac und iPhone.</p>
      <div class="zt-reihe"><input id="zt-u-name" placeholder="Name, z. B. Arbeit" size="14"><button type="button" class="chip primary" id="zt-u-sp">＋ Aktuelle Einstellungen speichern</button></div>
      <div class="zt-karten">${Object.keys(u).length ? Object.entries(u).map(([n, w]) => `<div class="zt-karte ${n === aktiv ? "on" : ""}"><b>${esc(n)}</b><small>${Object.keys(w).length} Einstellungen${n === aktiv ? " · aktiv" : ""}</small><div class="zt-knoepfe"><button type="button" class="chip primary" data-uan="${esc(n)}">Wechseln</button><button type="button" class="ghost small" data-uweg="${esc(n)}">✕</button></div></div>`).join("") : '<p class="muted">Noch keine Umgebung gespeichert.</p>'}</div>`;
    $("zt-u-sp").addEventListener("click", () => {
      const name = $("zt-u-name").value.trim().slice(0, 30); if (!name) return;
      const werte = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("friday_") && !NUR_GERAET.test(k) && k !== "friday_umgebung_aktiv") werte[k] = localStorage.getItem(k); }
      const alle = umgebungen(); alle[name] = werte;
      try { localStorage.setItem("friday_umgebungen", JSON.stringify(alle)); localStorage.setItem("friday_umgebung_aktiv", name); } catch { /* egal */ }
      toast(`Umgebung „${name}“ gespeichert`); zeigeNetzwerk();
    });
    inhalt().querySelectorAll("[data-uan]").forEach((b) => b.addEventListener("click", () => {
      const w = umgebungen()[b.dataset.uan]; if (!w) return;
      try { for (const [k, v] of Object.entries(w)) localStorage.setItem(k, v); localStorage.setItem("friday_umgebung_aktiv", b.dataset.uan); } catch { /* egal */ }
      toast(`Wechsle zu „${b.dataset.uan}“ …`);
      setTimeout(() => location.reload(), 900); // nach dem Sync zum Server neu laden
    }));
    inhalt().querySelectorAll("[data-uweg]").forEach((b) => b.addEventListener("click", () => { const a = umgebungen(); delete a[b.dataset.uweg]; try { localStorage.setItem("friday_umgebungen", JSON.stringify(a)); } catch { /* egal */ } zeigeNetzwerk(); }));
  }

  // ================= Sicherheit =================
  async function zeigeSicherheit() {
    const letzt = await j("/api/zentrale/sicherheit/updatetest");
    inhalt().innerHTML = `
      <h3>Datenleck-Wächter</h3>
      <p class="muted">Prüft nur Fridays eigene Dateien auf diesem Mac: Schlüssel im Klartext (Logbuch, Archiv, Dokumente, Dashboard), Dateirechte, Git und ob Friday öffentlich im Internet hängt.</p>
      <button type="button" class="chip primary" id="zt-dl">🔍 Jetzt prüfen</button><div id="zt-dl-erg"></div>
      <h3>Testlabor & Update-Sandbox</h3>
      <p class="muted">Jedes Update wird vor dem Einspielen im Testlabor geprüft (alle Dateien, Syntax, Importe). Fällt es durch, bleibt deine Version unverändert. Hier kannst du das auch von Hand machen.</p>
      <div class="zt-reihe"><button type="button" class="chip primary" id="zt-ut">🧪 Neue Version von GitHub testen</button><button type="button" class="chip" id="zt-st">🔧 Eigene Installation testen</button></div>
      <div id="zt-ut-erg">${letzt?.version || letzt?.text ? testErg(letzt) : ""}</div>
      <h3>Manipulationserkennung</h3>
      <p class="muted">Füge einen Text, eine Mail oder ein Dokument ein. Friday sucht nach versteckten KI-Befehlen, unsichtbaren Zeichen, gefälschten Buchstaben und Links. (Das Denk-Labor prüft jede Eingabe automatisch.)</p>
      <label class="zt-datei"><input type="file" id="zt-mp-datei" accept=".txt,.html,.htm,.md,.csv,.json,.eml"><span>📄 Textdatei laden (optional)</span></label>
      <textarea id="zt-mp" rows="5" placeholder="Text hier einfügen …"></textarea><button type="button" class="chip primary" id="zt-mp-los">🔎 Prüfen</button><div id="zt-mp-erg"></div>`;
    $("zt-dl").addEventListener("click", async () => {
      $("zt-dl-erg").innerHTML = '<p class="muted">Prüfe …</p>';
      const r = await post("/api/zentrale/sicherheit/datenleck", {});
      $("zt-dl-erg").innerHTML = `<p class="${r.stufe === "ok" ? "" : "zt-problem"}">${r.stufe === "ok" ? "✓ Alles sauber" : `⚠ ${r.funde.length} Hinweis(e)`} · ${r.geprueft} Dateien geprüft</p>
        ${r.funde.map((f) => `<div class="zt-zeile"><span class="zt-st ${f.stufe === "hoch" ? "rot" : f.stufe === "mittel" ? "gut" : "alt"}">${esc(f.stufe)}</span><div><b>${esc(f.was)}</b><small>${esc(f.wo)}${f.beispiel ? ` · ${esc(f.beispiel)}` : ""}</small><small class="muted">${esc(f.tipp)}</small></div>${f.reparieren ? `<button type="button" class="chip" data-rep="${f.reparieren}">🔧 Reparieren</button>` : ""}</div>`).join("")}
        ${r.hinweise.map((h) => `<p class="muted zt-mini">✓ ${esc(h)}</p>`).join("")}`;
      $("zt-dl-erg").querySelectorAll("[data-rep]").forEach((b) => b.addEventListener("click", async () => { const x = await post("/api/zentrale/sicherheit/reparieren", { was: b.dataset.rep }); toast(x.error || x.info, Boolean(x.error)); $("zt-dl").click(); }));
    });
    $("zt-ut").addEventListener("click", async (e) => { e.target.disabled = true; $("zt-ut-erg").innerHTML = '<p class="muted">Lade die neue Version in die Sandbox und prüfe …</p>'; const r = await post("/api/zentrale/sicherheit/updatetest", {}); e.target.disabled = false; $("zt-ut-erg").innerHTML = testErg(r); });
    $("zt-st").addEventListener("click", async (e) => { e.target.disabled = true; $("zt-ut-erg").innerHTML = '<p class="muted">Prüfe die installierte Version …</p>'; const r = await post("/api/zentrale/sicherheit/selbsttest", {}); e.target.disabled = false; $("zt-ut-erg").innerHTML = testErg({ ...r, selbst: true }); });
    $("zt-mp-datei").addEventListener("change", async (e) => { const f = e.target.files?.[0]; if (f) $("zt-mp").value = (await f.text()).slice(0, 200000); });
    $("zt-mp-los").addEventListener("click", async () => {
      const r = await post("/api/zentrale/sicherheit/text", { text: $("zt-mp").value });
      $("zt-mp-erg").innerHTML = r.verdaechtig ? `<p class="zt-problem">${r.stufe === "gefahr" ? "🚨 Gefährlich" : "⚠ Auffällig"} – ${r.funde.length} Fund(e)</p>${r.funde.map((f) => `<div class="zt-zeile klein"><b>${esc(f.art)}</b>${f.stelle ? `<code>${esc(f.stelle)}</code>` : ""}</div>`).join("")}` : '<p>✓ Nichts Verdächtiges gefunden.</p>';
    });
  }
  function testErg(r) {
    if (r.text && !r.version) return `<p class="muted">Letztes Update: ${esc(r.text)}</p>`;
    return `<div class="zt-test ${r.ok ? "ok" : "rot"}"><b>${r.ok ? "✓ Bestanden" : "✕ Durchgefallen"}</b> · ${r.selbst ? "installierte" : "GitHub-"}Version ${esc(r.version || "?")}${r.installiert ? ` (installiert: ${esc(r.installiert)}${r.neuer ? ", das wäre ein Update" : ", kein neueres Update"})` : ""} · ${r.geprueft || 0} Dateien in ${((r.dauer_ms || 0) / 1000).toFixed(1).replace(".", ",")} s
      ${(r.fehler || []).map((f) => `<small class="error">✕ ${esc(f)}</small>`).join("")}${(r.warnungen || []).map((w) => `<small class="muted">⚠ ${esc(w)}</small>`).join("")}</div>`;
  }

  // ================= Module / Marktplatz =================
  async function zeigeModule() {
    const d = await j("/api/zentrale/module");
    const rechte = (m) => (m.rechte || []).map((r) => `<span class="zt-pill" title="${esc(d.rechte[r] || r)}">${esc(r)}</span>`).join("");
    inhalt().innerHTML = `
      <h3>Installierte Module</h3>
      <div class="zt-liste">${d.installiert.length ? d.installiert.map((m) => `<div class="zt-zeile"><label class="zt-schalter"><input type="checkbox" data-man="${esc(m.id)}" ${m.an ? "checked" : ""} ${m.pruefung.ok ? "" : "disabled"}><i></i></label>
        <div><b>${esc(m.name)} <small class="muted">${esc(m.version || "")}</small></b>${m.neu ? '<span class="zt-pill gelb">neu erkannt</span>' : ""}<small>${esc(m.beschreibung || "")}</small><small>${rechte(m)} · ${(m.befehle || []).length} Befehle${m.befehle?.[0]?.saetze?.[0] ? ` · z. B. „${esc(m.befehle[0].saetze[0])}“` : ""}</small>
        ${m.pruefung.ok ? "" : `<small class="error">Passt nicht: ${m.pruefung.fehler.map(esc).join(" · ")}</small>`}${m.pruefung.warnungen.map((w) => `<small class="muted">⚠ ${esc(w)}</small>`).join("")}</div>
        <button type="button" class="ghost small" data-mweg="${esc(m.id)}">🗑</button></div>`).join("") : '<p class="muted">Noch keine eigenen Module. Unten aus dem Marktplatz installieren oder ein eigenes einfügen.</p>'}</div>
      <h3>Marktplatz</h3>
      <div class="zt-karten">${d.katalog.map((m) => `<div class="zt-karte"><b>${esc(m.name)}</b><small>${esc(m.beschreibung)}</small><small>${rechte(m)}</small>${m.installiert ? `<span class="zt-st ok">installiert ${esc(m.installierteVersion || "")}</span>` : m.pruefung.ok ? `<button type="button" class="chip primary" data-kat="${esc(m.id)}">⬇ Installieren</button>` : `<small class="error">${esc(m.pruefung.fehler[0])}</small>`}</div>`).join("")}</div>
      <h3>Eigenes Modul einfügen</h3>
      <p class="muted">Ein Modul ist eine JSON-Beschreibung (keine Programme): Sätze, auf die Friday reagiert, und was sie dann tut. Friday prüft es vorher (Kompatibilitätsprüfung). Dateien in <code>server/data/module/</code> erkennt sie auch von selbst.</p>
      <textarea id="zt-mod" rows="9" spellcheck="false">{
  "id": "mein-modul",
  "name": "Mein Modul",
  "version": "1.0.0",
  "braucht_friday": ">=1.97.0",
  "beschreibung": "Was es macht",
  "rechte": ["befehle"],
  "befehle": [
    { "saetze": ["sag hallo zu *"], "antwort": "Hallo {1}! Grüße von {name}." }
  ]
}</textarea>
      <div class="zt-reihe"><button type="button" class="chip" id="zt-mod-pr">✓ Prüfen</button><button type="button" class="chip primary" id="zt-mod-inst">⬇ Installieren</button></div><div id="zt-mod-erg"></div>
      <p class="muted zt-mini">Platzhalter: * im Satz → {1} {2} in der Antwort · {name} {zeit} {datum} {zufall:1-6}. Antwort als Liste = zufällige Auswahl. Rechte: ${Object.entries(d.rechte).map(([k, v]) => `<b>${esc(k)}</b> (${esc(v)})`).join(", ")}.</p>`;
    inhalt().querySelectorAll("[data-man]").forEach((c) => c.addEventListener("change", async () => { const r = await post(`/api/zentrale/module/${c.dataset.man}/an`, { an: c.checked }); if (r.error) toast(r.error, true); zeigeModule(); }));
    inhalt().querySelectorAll("[data-mweg]").forEach((b) => b.addEventListener("click", async () => { if (!window.confirm("Modul entfernen?")) return; await j(`/api/zentrale/module/${b.dataset.mweg}`, { method: "DELETE" }); zeigeModule(); }));
    inhalt().querySelectorAll("[data-kat]").forEach((b) => b.addEventListener("click", async () => { const r = await post("/api/zentrale/module", { katalog: b.dataset.kat }); toast(r.error || `„${r.modul.name}“ installiert und eingeschaltet`, Boolean(r.error)); zeigeModule(); }));
    const zeigePruefung = (r) => { $("zt-mod-erg").innerHTML = `${r.ok ? '<p>✓ Passt zu Friday.</p>' : ""}${(r.fehler || r.pruefung?.fehler || []).map((f) => `<small class="error">✕ ${esc(f)}</small>`).join("")}${(r.warnungen || r.pruefung?.warnungen || []).map((w) => `<small class="muted">⚠ ${esc(w)}</small>`).join("")}`; };
    $("zt-mod-pr").addEventListener("click", async () => zeigePruefung(await post("/api/zentrale/module/pruefen", { modul: $("zt-mod").value })));
    $("zt-mod-inst").addEventListener("click", async () => { const r = await post("/api/zentrale/module", { modul: $("zt-mod").value }); if (r.error) { zeigePruefung({ ...r.pruefung, fehler: [r.error, ...(r.pruefung?.fehler || [])] }); return; } toast(`„${r.modul.name}“ installiert`); zeigeModule(); });
  }

  // ================= Rahmen =================
  const ANSICHT = { start: zeigeStart, kontrolle: zeigeKontrolle, missionen: zeigeMissionen, automationen: zeigeAutomationen, labor: zeigeLabor, rechnen: zeigeRechnen, persoenlich: zeigePersoenlich, wissen: zeigeWissen, netzwerk: zeigeNetzwerk, sicherheit: zeigeSicherheit, module: zeigeModule };
  async function zeige(t) {
    tab = ANSICHT[t] ? t : "start";
    orbitStop?.(); orbitStop = null;
    $("zt-tabs").querySelectorAll("[data-tab]").forEach((b) => { b.classList.toggle("on", b.dataset.tab === tab); b.setAttribute("aria-selected", String(b.dataset.tab === tab)); });
    $("zt-tabs").querySelector(".on")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    inhalt().innerHTML = '<p class="muted">Lade …</p>';
    try { await ANSICHT[tab](); } catch (err) { inhalt().innerHTML = `<p class="error">Konnte nicht laden: ${esc(err.message)}</p>`; }
    try { localStorage.setItem("friday_zentrale_tab", tab); } catch { /* egal */ }
  }
  $("zt-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) zeige(b.dataset.tab); });
  sheet.addEventListener("click", (e) => { const g = e.target.closest("[data-go]"); if (g) { geheZu(g.dataset.go); return; } if (e.target === sheet) schliessen(); });
  $("zt-x").addEventListener("click", () => schliessen());
  trigger.addEventListener("click", () => oeffnen());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && offen()) schliessen(); });

  function offen() { return !sheet.classList.contains("hidden"); }
  function oeffnen(t) {
    let gemerkt = "start"; try { gemerkt = localStorage.getItem("friday_zentrale_tab") || "start"; } catch { /* egal */ }
    sheet.classList.remove("hidden");
    document.querySelector("#menu-pop")?.classList.add("hidden");
    zeige(typeof t === "string" && t ? t : gemerkt);
    clearInterval(timer);
    // Missionen und Kontrolle live halten, solange offen
    timer = setInterval(() => { if (offen() && !document.hidden && (tab === "missionen" || tab === "kontrolle") && !sheet.querySelector("input:focus, textarea:focus, select:focus")) ANSICHT[tab](); }, 6000);
  }
  function schliessen() { sheet.classList.add("hidden"); clearInterval(timer); timer = null; orbitStop?.(); orbitStop = null; }

  // Freigaben-Zähler am HUD (kleiner Chip, erscheint nur wenn etwas wartet)
  async function hudChip() {
    try {
      const d = await j("/api/zentrale");
      let chip = $("hb-zentrale");
      const bar = document.querySelector(".hud-bar");
      if (!bar) return;
      // Offene Freigaben zeigt seit v1.134.0 die Glocke (glocke.js); hier nur noch Notfall und Missions-Probleme.
      const zeigen = d.kontrolle.notfall || d.missionen.probleme > 0;
      if (!zeigen) { chip?.remove(); return; }
      if (!chip) { chip = document.createElement("button"); chip.type = "button"; chip.id = "hb-zentrale"; chip.className = "hb-chip hb-btn"; bar.insertBefore(chip, bar.querySelector(".hb-ver")); chip.addEventListener("click", () => oeffnen(chip.dataset.ziel || "missionen")); }
      chip.dataset.ziel = d.kontrolle.notfall ? "kontrolle" : "missionen";
      chip.classList.toggle("zt-alarm", Boolean(d.kontrolle.notfall));
      chip.innerHTML = d.kontrolle.notfall ? "<i class=\"hb-dot\"></i>🛑 <b>NOTFALL</b>" : `<i class="hb-dot"></i>Mission <b>⚠ ${d.missionen.probleme}</b>`;
    } catch { /* egal */ }
  }
  setTimeout(hudChip, 3000);
  setInterval(() => { if (!document.hidden) hudChip(); }, 30000);

  window.FridayZentrale = { open: oeffnen, close: schliessen, offen, refresh: () => { hudChip(); if (offen()) zeige(tab); } };
})();
