// F.R.Ai.D.A.Y Schnitt-Team: Live-Anzeige von Regie, Transkript, Schnitt, Farbe, Untertitel und Audio.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { api, say, escapeHtml } = window.Friday;
  const box = $("schnitt");
  if (!box) return;

  const COLORS = ["#ff3fa8", "#ff8a1e", "#4dffa6", "#4fd8ff", "#b57bff", "#ffcc4d"];
  const DOT = { wartet: "wait", "läuft": "run", bereit: "ready", fertig: "done" };
  let timer = null, lastJobId = null, lastStatus = null, starting = false;

  const loggedIn = () => { try { return Boolean(localStorage.getItem("friday_token")); } catch { return false; } };

  function render(d) {
    const j = d.job;
    $("schnitt-clips").innerHTML = d.clips.length
      ? d.clips.map((c, i) => `<li><i style="background:${COLORS[i % COLORS.length]}"></i>${escapeHtml(c)}</li>`).join("")
      : `<li class="muted">Noch keine Clips. Leg Videos in den Ordner „Eingang".</li>`;
    $("schnitt-look").innerHTML = d.looks.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("");
    if (j) $("schnitt-look").value = j.look;
    const running = j && j.status === "läuft";
    $("schnitt-start").disabled = running || !d.clips.length || !d.ready;
    $("schnitt-start").textContent = running ? "Team arbeitet …" : "▶ Schneide das Video";
    if (!d.ready) $("schnitt-state").textContent = "Das Schnitt-Team ist auf diesem Mac nicht installiert.";
    else $("schnitt-state").textContent = !j ? "Bereit" : j.status === "läuft" ? "Team arbeitet" : j.status === "fertig" ? "Fertig" : "Fehler";
    $("schnitt-state").className = `schnitt-state ${j ? j.status : ""}`;

    // Agenten-Liste
    $("schnitt-agents").innerHTML = d.team.map((t) => {
      const a = j ? j.agents[t.id] : { status: "wartet", text: "", pct: 0 };
      return `<li class="sa ${DOT[a.status] || "wait"}">
        <div class="sa-top"><i></i><b>${escapeHtml(t.name)}</b><span>${escapeHtml(a.status.toUpperCase())}</span></div>
        <div class="sa-text">${escapeHtml(a.text || t.job)}</div>
        <div class="sa-bar"><s style="width:${Math.max(0, Math.min(100, a.pct || 0))}%"></s></div></li>`;
    }).join("");

    // Zeitleiste: Video-Spur (Schnitte je Clip), Untertitel-Spur, Pegel
    const tl = $("schnitt-timeline");
    if (j && j.plan && j.plan.total > 0) {
      const total = j.plan.total;
      let off = 0;
      const video = [];
      j.plan.clips.forEach((c, i) => c.segs.forEach(([a, b]) => {
        video.push(`<s style="left:${(off / total) * 100}%;width:${((b - a) / total) * 100}%;background:${COLORS[i % COLORS.length]}" title="${escapeHtml(c.name)}"></s>`);
        off += b - a;
      }));
      const subs = (j.subs || []).map(([a, b]) => `<s style="left:${(a / total) * 100}%;width:${Math.max(0.4, ((b - a) / total) * 100)}%"></s>`).join("");
      const playhead = j.agents.regie.status === "läuft" ? `<em style="left:${j.agents.regie.pct || 0}%"></em>` : "";
      tl.innerHTML = `<div class="tl-row"><span>VIDEO</span><div class="tl-track">${video.join("")}${playhead}</div></div>
        <div class="tl-row"><span>UNTERTITEL</span><div class="tl-track subs">${subs}${playhead}</div></div>
        <div class="tl-scale"><span>0 s</span><span>${Math.round(total)} s</span></div>`;
    } else tl.innerHTML = `<p class="muted">Die Zeitleiste erscheint, sobald der Schnitt-Agent geplant hat.</p>`;

    // Pegel je Clip (gemessene Lautheit, Ziel −16 LUFS)
    const lv = $("schnitt-levels");
    lv.innerHTML = j && j.levels ? j.levels.map((l, i) => {
      const h = l == null ? 4 : Math.max(6, Math.min(100, (l + 40) * 2.8));
      return `<div class="lv"><s style="height:${h}%;background:${COLORS[i % COLORS.length]}"></s><span>${l == null ? "–" : Math.round(l)}</span></div>`;
    }).join("") : `<p class="muted">Pegel nach der Messung</p>`;

    // Protokoll
    $("schnitt-log").innerHTML = j ? j.log.slice(-9).reverse().map((e) => `<li><b>${escapeHtml(e.agent.toUpperCase())}</b> ${escapeHtml(e.text)}</li>`).join("") : "";

    // Ergebnis
    const res = $("schnitt-result");
    if (j && j.status === "fertig" && j.result) {
      res.classList.remove("hidden");
      res.innerHTML = `<b>✓ ${escapeHtml(j.result.name)}</b> · ${Math.round(j.result.dur)} s
        ${j.result.caption ? `<p>${escapeHtml(j.result.caption)}</p>` : ""}
        <button class="chip primary" data-open="fertig">Im Finder zeigen</button>`;
    } else if (j && j.status === "fehler") {
      res.classList.remove("hidden");
      res.innerHTML = `<b class="error">Abgebrochen:</b> ${escapeHtml(j.error || "unbekannter Fehler")}`;
    } else res.classList.add("hidden");
  }

  function announce(d) {
    const j = d.job;
    if (!j) return;
    // Nur melden, wenn wir den Job laufen gesehen haben (nicht beim ersten Laden der Seite).
    if (j.id === lastJobId && lastStatus === "läuft" && j.status !== "läuft") {
      if (j.status === "fertig") say(`Fertig, Chef. Dein Video ist ${Math.round(j.result?.dur || 0)} Sekunden lang und liegt im Ordner Fertig.`);
      else say("Chef, beim Schneiden ist etwas schiefgegangen. Die Details stehen im Schnitt-Fenster.");
    }
    lastJobId = j.id;
    lastStatus = j.status;
  }

  async function refresh() {
    if (!loggedIn()) return;
    try {
      const d = await (await api("/api/video-job")).json();
      announce(d);
      if (!box.classList.contains("hidden")) render(d);
      schedule(d.job && d.job.status === "läuft");
    } catch { schedule(false); }
  }

  function schedule(fast) {
    clearTimeout(timer);
    const open = !box.classList.contains("hidden");
    timer = setTimeout(refresh, fast && open ? 1000 : fast ? 4000 : 20000);
  }

  async function start() {
    if (starting) return;
    starting = true;
    try {
      const res = await api("/api/video-job", { method: "POST", body: JSON.stringify({ look: $("schnitt-look").value }) });
      const r = await res.json();
      if (!r.ok) $("schnitt-state").textContent = r.error;
      else { lastStatus = "läuft"; say("Verstanden, Chef. Das Team legt los."); }
    } finally { starting = false; refresh(); }
  }

  function open() { box.classList.remove("hidden"); refresh(); }
  function close() { box.classList.add("hidden"); }

  $("schnitt-open")?.addEventListener("click", open);
  $("schnitt-x")?.addEventListener("click", close);
  $("schnitt-start")?.addEventListener("click", start);
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b) api("/api/video-open", { method: "POST", body: JSON.stringify({ which: b.dataset.open }) });
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !box.classList.contains("hidden")) close(); });

  // Im Hintergrund prüfen, damit Friday "Fertig, Chef" auch sagt, wenn per Sprache gestartet wurde.
  setTimeout(refresh, 3000);
})();
