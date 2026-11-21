// F.R.Ai.D.A.Y Freigabe-Glocke (v1.134.0, Idee aus OpenJarvis "Approval Gates")
// Riskante Aktionen (Mail löschen, Updates, Dinge, die du auf "immer fragen" stellst) warten hier auf dein OK.
// Die Glocke oben im HUD zeigt, wie viele warten. Gleiches geht per Telegram-Knopf oder Sprache ("gib frei").
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  let stand = null;
  let bekannte = null; // IDs, die wir schon gesehen haben (für den Ping)

  const w = H.fenster({
    id: "glocke", titel: "🔔 Freigabe-Glocke", klasse: "gl-box",
    html: `
      <div id="gl-kopf" class="hf-reihe"></div>
      <div id="gl-status" class="hf-status">Riskante Aktionen warten hier, bis du sie freigibst. Du kannst auch sagen: „Friday, gib frei“ oder „lehne ab“.</div>
      <div class="hf-karte"><h3>Wartet auf dich</h3><div id="gl-offen" class="hf-liste"></div></div>
      <div class="hf-karte"><h3>Immer nachfragen bei …</h3><div id="gl-regeln" class="gl-regeln"></div>
        <p class="hf-hinweis">Was hier an ist, macht Friday nie allein, auch wenn die Autonomie-Stufe hoch ist (nur „Volle Autonomie“ fragt nicht).</p></div>
      <div class="hf-karte"><h3>Zuletzt entschieden</h3><div id="gl-erledigt" class="hf-liste"></div></div>`,
    onOpen: () => laden(),
  });
  const $ = (s) => w.$(s);
  const status = (t, f = false) => { const s = $("#gl-status"); s.textContent = t; s.classList.toggle("fehler", f); };
  const zeit = (iso) => { if (!iso) return ""; const d = new Date(iso); const heute = new Date().toDateString() === d.toDateString(); return d.toLocaleString("de-DE", heute ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
  const KANAL = { telegram: "Telegram", dashboard: "Dashboard", stimme: "Sprache", automation: "Automation", mission: "Mission", freigabe: "Glocke" };
  const STATUS = { erlaubt: ["✅ freigegeben", "hf-gut"], abgelehnt: ["✋ abgelehnt", "hf-info"], verfallen: ["⌛ verfallen", "hf-info"], abgebrochen: ["🛑 Notfall-Stopp", "hf-schlecht"] };

  function zeichne() {
    const s = stand;
    if (!s) return;
    $("#gl-kopf").innerHTML = `${s.notfall ? '<span class="hf-badge hf-schlecht">🛑 NOTFALL – alles angehalten</span>' : ""}<span class="hf-badge hf-info">Autonomie: ${esc(s.stufe || "?")}</span><span class="hf-badge ${s.telegram ? "hf-gut" : "hf-info"}">${s.telegram ? "Telegram-Knöpfe an" : "Telegram nicht verbunden"}</span>`;
    $("#gl-offen").innerHTML = s.offen.length ? s.offen.map((g) => `
      <div class="hf-zeile gl-zeile" data-id="${esc(g.id)}">
        <span class="icon">🔔</span>
        <span class="name"><b>${esc(g.titel)}</b><br><span class="klein">${esc(g.was || "")}${g.grund ? ` · ${esc(g.grund)}` : ""} · ${esc(KANAL[g.kanal] || g.kanal || "")} · ${zeit(g.erstellt)}</span></span>
        <button class="hf-btn haupt" data-ja="1">✓ Freigeben</button>
        <button class="hf-btn leise" data-ja="0">✋ Ablehnen</button>
      </div>`).join("") : '<div class="hf-leer">Nichts offen. Friday wartet auf nichts.</div>';
    $("#gl-erledigt").innerHTML = s.erledigt.length ? s.erledigt.map((g) => {
      const [txt, kl] = STATUS[g.status] || [g.status, "hf-info"];
      return `<div class="hf-zeile"><span class="name">${esc(g.titel)}<br><span class="klein">${zeit(g.entschieden || g.erstellt)}${g.ergebnis ? ` · ${esc(String(g.ergebnis).slice(0, 120))}` : ""}</span></span><span class="hf-badge ${kl}">${txt}</span></div>`;
    }).join("") : '<div class="hf-leer">Noch nichts entschieden.</div>';
    $("#gl-regeln").innerHTML = Object.entries(s.fragbar || {}).map(([k, name]) => `
      <label class="gl-regel"><input type="checkbox" data-regel="${esc(k)}" ${s.immerFragen?.includes(k) ? "checked" : ""}> <span>${esc(name)}</span></label>`).join("");
  }

  function chip() {
    const bar = document.querySelector(".hud-bar");
    if (!bar) return;
    let c = document.getElementById("hb-glocke");
    if (!c) {
      c = document.createElement("button");
      c.type = "button"; c.id = "hb-glocke"; c.className = "hb-chip hb-btn"; c.title = "Freigabe-Glocke";
      bar.insertBefore(c, bar.querySelector(".hb-ver"));
      c.addEventListener("click", () => w.auf());
    }
    const n = stand?.offen.length || 0;
    c.classList.toggle("gl-wartet", n > 0);
    c.innerHTML = `<span class="gl-icon">🔔</span>${n ? `<b>${n}</b>` : ""}`;
    c.setAttribute("aria-label", n ? `${n} Freigabe${n > 1 ? "n" : ""} offen` : "Freigabe-Glocke, nichts offen");
  }

  function ping() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(1320, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.35);
      g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.65);
      setTimeout(() => ctx.close?.(), 900);
    } catch { /* kein Ton möglich */ }
  }

  async function laden() {
    if (!window.Friday?.api) return;
    try {
      stand = await json("/api/glocke");
      const ids = new Set(stand.offen.map((g) => g.id));
      if (bekannte && [...ids].some((id) => !bekannte.has(id))) ping();
      bekannte = ids;
      chip();
      if (stand.offen.length) window.FridayRing?.melde("glocke", "warn", `${stand.offen.length} Aktion${stand.offen.length > 1 ? "en warten" : " wartet"} auf Freigabe`, 0, () => w.auf());
      else window.FridayRing?.melde("glocke", null);
      if (w.offen()) zeichne();
    } catch { /* später nochmal */ }
  }

  w.sheet.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-ja]");
    if (!b) return;
    const id = b.closest("[data-id]")?.dataset.id;
    const ja = b.dataset.ja === "1";
    b.closest(".gl-zeile").querySelectorAll("button").forEach((x) => { x.disabled = true; });
    status(ja ? "Wird ausgeführt …" : "Wird abgelehnt …");
    try {
      const r = await json(`/api/glocke/${encodeURIComponent(id)}`, { body: { ja } });
      stand = r;
      status(ja ? (r.ok === false ? `Freigegeben, aber es hat nicht geklappt: ${r.ergebnis || ""}` : "Freigegeben und erledigt.") : "Abgelehnt. Friday lässt es bleiben.", ja && r.ok === false);
      bekannte = new Set(stand.offen.map((g) => g.id));
      chip(); zeichne();
      if (!stand.offen.length) window.FridayRing?.melde("glocke", null);
      window.FridayZentrale?.refresh();
    } catch (err) { status(err.message, true); laden(); }
  });
  w.sheet.addEventListener("change", async (e) => {
    const c = e.target.closest("[data-regel]");
    if (!c) return;
    try { stand = await json("/api/glocke-regel", { body: { werkzeug: c.dataset.regel, an: c.checked } }); zeichne(); status(c.checked ? "Gespeichert: Friday fragt dabei ab jetzt immer nach." : "Gespeichert: Friday fragt dabei nur noch je nach Autonomie-Stufe."); } catch (err) { status(err.message, true); c.checked = !c.checked; }
  });

  const style = document.createElement("style");
  style.textContent = `
.gl-box { width: min(760px, 100%); }
#hb-glocke .gl-icon { font-size: 13px; line-height: 1; filter: grayscale(.6); opacity: .75; }
#hb-glocke.gl-wartet { border-color: #ffc44d; color: #ffc44d; box-shadow: 0 0 16px rgba(255,196,77,.45); }
#hb-glocke.gl-wartet .gl-icon { filter: none; opacity: 1; display: inline-block; animation: gl-wackeln 2.4s ease-in-out infinite; transform-origin: 50% 10%; }
#hb-glocke b { margin-left: 4px; }
@keyframes gl-wackeln { 0%, 70%, 100% { transform: rotate(0); } 75% { transform: rotate(16deg); } 82% { transform: rotate(-14deg); } 89% { transform: rotate(8deg); } 95% { transform: rotate(-4deg); } }
.gl-regeln { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px 14px; }
.gl-regel { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; padding: 4px 0; }
.gl-regel input { width: 18px; height: 18px; accent-color: var(--cyan); }
@media (max-width: 900px) { .gl-zeile .hf-btn { flex: 1; } .gl-regeln { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { #hb-glocke.gl-wartet .gl-icon { animation: none; } }`;
  document.head.appendChild(style);

  // Regelmäßig nachsehen (alle 10 s, nur wenn sichtbar). Erst starten, wenn angemeldet.
  let n = 0;
  const warte = setInterval(() => { if (window.Friday?.api || ++n > 120) { clearInterval(warte); laden(); } }, 500);
  setInterval(() => { if (!document.hidden) laden(); }, 10000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) laden(); });

  window.FridayGlocke = { open: () => w.auf(), offen: w.offen, refresh: laden };
})();
