// F.R.Ai.D.A.Y Fernbedienung: Samsung-Fernseher suchen, koppeln und steuern.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api, esc = F.escapeHtml || ((s) => String(s));

  const msg = (t, bad = false) => { const m = $("tv-msg"); if (m) { m.textContent = t || ""; m.classList.toggle("bad", bad); } };
  const post = (url, body) => api(url, { method: "POST", body: JSON.stringify(body || {}) });

  function open() { $("tv")?.classList.remove("hidden"); refresh(); }
  function close() { $("tv")?.classList.add("hidden"); }
  $("tv-open")?.addEventListener("click", open);
  $("tv-x")?.addEventListener("click", close);
  $("tv")?.addEventListener("click", (e) => { if (e.target.id === "tv") close(); });
  window.openFernseher = open;

  function show(which) {
    $("tv-setup")?.classList.toggle("hidden", which !== "setup");
    $("tv-remote")?.classList.toggle("hidden", which !== "remote");
  }

  async function refresh() {
    if (!api) return;
    let s;
    try { s = await (await api("/api/fernseher")).json(); } catch { s = { eingerichtet: false }; }
    if (!s.eingerichtet || !s.gekoppelt) { show("setup"); if (s.ip) $("tv-ip").value = s.ip; return; }
    show("remote");
    $("tv-name").textContent = s.name || "Fernseher";
    const st = $("tv-state");
    const on = s.erreichbar && s.zustand !== "standby";
    st.textContent = on ? "AN" : s.erreichbar ? "STANDBY" : "AUS";
    st.className = `tv-state ${on ? "on" : ""}`;
  }

  // --- Einrichten ---
  $("tv-search")?.addEventListener("click", async () => {
    const box = $("tv-found"), btn = $("tv-search");
    btn.disabled = true; btn.textContent = "Suche im WLAN …";
    box.innerHTML = "";
    try {
      const d = await (await post("/api/fernseher/suchen")).json();
      const list = d.gefunden || [];
      box.innerHTML = list.length
        ? list.map((t) => `<button class="tv-pick" data-ip="${esc(t.ip)}"><b>${esc(t.name)}</b><span>${esc(t.modell || "")} · ${esc(t.ip)}</span></button>`).join("")
        : '<p class="muted">Kein Fernseher gefunden. Ist er an und im selben WLAN? Du kannst die IP auch unten eintragen (Fernseher: Einstellungen → Allgemein → Netzwerk → Netzwerkstatus → IP-Einstellungen).</p>';
    } catch {
      box.innerHTML = '<p class="muted">Suche nicht möglich.</p>';
    }
    btn.disabled = false; btn.textContent = "🔍 Fernseher suchen";
  });
  $("tv-found")?.addEventListener("click", (e) => { const b = e.target.closest(".tv-pick"); if (b) pair(b.dataset.ip); });
  $("tv-pair")?.addEventListener("click", () => pair($("tv-ip").value.trim()));

  async function pair(ip) {
    const box = $("tv-found");
    box.innerHTML = '<p class="tv-wait">Schau jetzt auf den Fernseher und drück <b>Zulassen</b> … (bis zu 30 Sekunden)</p>';
    F.say?.("Schau auf den Fernseher und drück Zulassen.");
    try {
      const r = await (await post("/api/fernseher/koppeln", { ip })).json();
      if (r.ok) { box.innerHTML = ""; F.say?.(r.text || "Fernseher verbunden."); refresh(); }
      else box.innerHTML = `<p class="bad">${esc(r.error || "Verbinden hat nicht geklappt.")}</p>`;
    } catch {
      box.innerHTML = '<p class="bad">Verbinden hat nicht geklappt.</p>';
    }
  }

  $("tv-forget")?.addEventListener("click", async () => {
    await post("/api/fernseher/vergessen");
    $("tv-found").innerHTML = "";
    show("setup");
  });

  // --- Steuern ---
  let busy = false;
  async function cmd(body, el) {
    if (busy) return;
    busy = true;
    el?.classList.add("tv-press");
    try {
      const r = await (await post("/api/fernseher/befehl", body)).json();
      msg(r.ok ? (r.text || "") : r.error, !r.ok);
      if (!r.ok && body.action !== "taste") F.say?.(r.error);
      if (body.action === "an" || body.action === "aus") setTimeout(refresh, 1500);
    } catch {
      msg("Fernseher nicht erreichbar.", true);
    }
    el?.classList.remove("tv-press");
    busy = false;
  }

  $("tv-remote")?.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.tv) cmd({ action: b.dataset.tv, anzahl: b.dataset.n ? Number(b.dataset.n) : undefined }, b);
    else if (b.dataset.key) cmd({ action: "taste", value: b.dataset.key }, b);
    else if (b.dataset.app) cmd({ action: "app", value: b.dataset.app }, b);
  });
  const goChan = () => { const v = $("tv-chan").value.replace(/\D/g, ""); if (v) { cmd({ action: "sender", value: v }); $("tv-chan").value = ""; } };
  $("tv-chan-go")?.addEventListener("click", goChan);
  $("tv-chan")?.addEventListener("keydown", (e) => { if (e.key === "Enter") goChan(); });
})();
