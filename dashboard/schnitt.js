// F.R.Ai.D.A.Y Schnitt-Team (v1.129.0): drei Reiter im Stil von Fridays Gehirn.
//  🎬 Video erstellen – Video-Studio auf Zuruf: Regie, Bildsucher, Grafik, Komponist, Sprecher, Render (GET/POST /api/studio)
//  ✂ Clips schneiden – das bisherige Schnitt-Team (GET/POST /api/video-job)
//  ▶ Fertige Videos  – alles aus ~/Friday-Video/Fertig mit Abspielen (GET /api/studio/videos)
// Öffnen: Werkzeug-Menü → Schnitt-Team, oder „Friday, erstell mir ein 20-Sekunden-Video über …“.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { api, say, escapeHtml } = window.Friday;
  const esc = escapeHtml;
  const box = $("schnitt");
  if (!box) return;

  const COLORS = ["#ff3fa8", "#ff8a1e", "#4dffa6", "#4fd8ff", "#b57bff", "#ffcc4d"];
  const DOT = { wartet: "wait", "läuft": "run", bereit: "ready", fertig: "done", "übersprungen": "skip", fehler: "bad" };
  // Agenten des Studios: Farbe + Symbol (Linien-Icons wie im Gehirn)
  const ICON = {
    regie: '<path d="M4 7h16v12H4z"/><path d="M4 7l3-4h4l-3 4M11 3h4l-3 4M15 3h4l-3 4"/>',
    bilder: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    grafik: '<path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z"/>',
    komponist: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    sprecher: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    render: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4.5-2.5z"/>',
  };
  const FARBE = { regie: "#ff8a1e", bilder: "#2ee6d0", grafik: "#a978ff", komponist: "#ffc44d", sprecher: "#4f8dff", render: "#ff3fa8" };
  // Nur neu zeichnen, wenn sich etwas geändert hat (sonst starten Animationen jede Sekunde neu).
  const setHtml = (el, html) => { if (el && el.__html !== html) { el.__html = html; el.innerHTML = html; } };
  const svg = (id) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id] || ""}</svg>`;

  let tab = "erstellen";
  let timer = null, starting = false;
  let lastJobId = null, lastStatus = null;       // Schnitt-Team
  let stJobId = null, stStatus = null;           // Studio
  let studio = null;                              // letzte Antwort von /api/studio
  let gezeigtesVideo = null;
  const wahl = { laenge: 20, format: "hoch", musik: "auto", bilder: "auto" };

  const loggedIn = () => { try { return Boolean(localStorage.getItem("friday_token")); } catch { return false; } };
  const token = () => { try { return localStorage.getItem("friday_token") || ""; } catch { return ""; } };
  const videoUrl = (datei) => `/api/archiv/datei/${datei}?t=${encodeURIComponent(token())}`;
  const posterUrl = (p) => (p ? ` poster="${esc(`${p}?t=${encodeURIComponent(token())}`)}"` : "");
  const offen = () => !box.classList.contains("hidden");
  const uhr = (t) => { try { return new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { return ""; } };

  // ====================================================================
  // Reiter 1: Video-Studio
  // ====================================================================
  function waehle(gruppe, schluessel) {
    const el = $(gruppe);
    el?.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-v]");
      if (!b) return;
      el.querySelectorAll("button").forEach((x) => x.classList.toggle("an", x === b));
      wahl[schluessel] = schluessel === "laenge" ? Number(b.dataset.v) : b.dataset.v;
      if (schluessel === "format") renderVorschau(studio?.job);
    });
  }
  waehle("st-laenge", "laenge");
  waehle("st-format", "format");
  waehle("st-musik", "musik");
  waehle("st-bilder", "bilder");

  function renderStudio(d) {
    studio = d;
    const j = d.job;
    const laeuft = j && j.status === "läuft";
    $("st-go").disabled = laeuft || !d.bereit;
    $("st-go").textContent = laeuft ? "Team arbeitet …" : "▶ Video erstellen";
    if (tab === "erstellen") {
      const s = $("schnitt-state");
      s.textContent = !d.bereit ? "Für Videos fehlt ffmpeg auf diesem Mac (Schnitt-Team einrichten)."
        : !j ? "Bereit. Sag mir ein Thema." : laeuft ? `Arbeitet an „${j.drehbuch?.titel || j.auftrag.thema}“ …`
          : j.status === "fertig" ? `Fertig: ${j.drehbuch?.titel || j.auftrag.thema} (${Math.round(j.result?.dur || 0)} s)` : `Abgebrochen: ${j.error || "unbekannter Fehler"}`;
      box.dataset.zustand = j?.status === "fehler" || !d.bereit ? "bad" : laeuft ? "warn" : "";
    }

    // Produktions-Pfade
    const team = d.team;
    setHtml($("st-flow"), team.map((t, i) => {
      const a = j ? j.agents[t.id] : { status: "wartet", text: "", pct: 0 };
      const pct = Math.max(0, Math.min(100, a.pct || 0));
      return `${i ? `<i class="st-kabel ${a.status === "wartet" ? "" : "an"}" style="--f:${FARBE[t.id]}"></i>` : ""}
        <div class="st-knoten ${DOT[a.status] || "wait"}" style="--f:${FARBE[t.id]};--p:${pct}" title="${esc(a.text || t.aufgabe)}">
          <span class="st-ring">${svg(t.id)}</span><b>${esc(t.name)}</b><small>${esc(a.status === "läuft" ? `${pct} %` : a.status)}</small></div>`;
    }).join(""));
    const aktiv = j ? team.find((t) => j.agents[t.id].status === "läuft") : null;
    $("st-pfad-info").textContent = !j ? "bereit" : aktiv ? `${aktiv.name} arbeitet` : j.status;

    // Agenten-Karten (wie unten im Gehirn)
    setHtml($("st-agenten"), team.map((t) => {
      const a = j ? j.agents[t.id] : { status: "wartet", text: "", pct: 0 };
      return `<div class="st-agent ${DOT[a.status] || "wait"}" style="--f:${FARBE[t.id]}">
        <span class="gh-ico">${svg(t.id)}</span>
        <div><b>${esc(t.name)}</b><em>${esc(a.text || t.aufgabe)}</em><span class="gh-bar"><s style="width:${Math.max(2, a.pct || 0)}%"></s></span></div></div>`;
    }).join(""));

    // Drehbuch
    const db = j?.drehbuch;
    $("st-db-info").textContent = db ? `${db.szenen.length} Szenen · ${db.quelle}` : "";
    setHtml($("st-story"), db ? db.szenen.map((s, i) => `<li style="--f:${esc(s.farbe || "#ff8a1e")}">
        <span class="st-nr">${i + 1}</span><div><b>${esc(s.text)}</b>${s.unter ? `<em>${esc(s.unter)}</em>` : ""}</div>
        <span class="st-art" title="${esc(s.bild?.titel || "")}">${s.art === "foto" ? "📷" : s.art === "clip" ? "🎞" : s.art === "grafik" ? "✦" : "…"}</span></li>`).join("")
      : `<li class="muted">${j && j.status === "läuft" ? "Die Regie schreibt gerade …" : "Das Drehbuch erscheint, sobald die Regie fertig ist."}</li>`);

    // Zeitleiste: Szenen, Titel, Musik (Takte), Sprecher
    const T = j?.auftrag?.sekunden || wahl.laenge;
    const n = db?.szenen?.length || 0;
    const L = n ? (T + (n - 1) * 0.6) / n : 0;
    const kopf = j && j.agents.render.status === "läuft" ? `<em style="left:${j.agents.render.pct || 0}%"></em>` : "";
    const szenen = n ? db.szenen.map((s, i) => `<s style="left:${(i * (L - 0.6) / T) * 100}%;width:${(L / T) * 100}%;background:${esc(s.farbe)}"></s>`).join("") : "";
    const titel = n ? db.szenen.map((s, i) => `<s style="left:${((i * (L - 0.6) + 0.25) / T) * 100}%;width:${((L - 0.6 * 0.6) / T) * 100 * 0.9}%"></s>`).join("") : "";
    const m = j?.musik;
    const schlaege = m?.bpm ? Math.floor(T / (60 / m.bpm)) : 0;
    const musik = schlaege ? Array.from({ length: Math.min(schlaege, 160) }, (_, i) => `<s style="left:${(i / schlaege) * 100}%;height:${i % 4 === 0 ? 100 : 30 + ((i * 37) % 50)}%"></s>`).join("") : "";
    const sprecher = j?.agents?.sprecher?.status === "fertig" ? `<s style="left:3%;width:94%"></s>` : "";
    $("st-tl-info").textContent = m ? `${T} s · ${m.name}${m.bpm ? ` · ${m.bpm} BPM` : ""}` : `${T} s`;
    setHtml($("st-tl"), `<div class="st-spur"><span>SZENEN</span><div>${szenen}${kopf}</div></div>
      <div class="st-spur titel"><span>TITEL</span><div>${titel}${kopf}</div></div>
      <div class="st-spur musik"><span>MUSIK</span><div>${musik}${kopf}</div></div>
      <div class="st-spur sprecher"><span>SPRECHER</span><div>${sprecher}${kopf}</div></div>
      <div class="st-skala"><span>0 s</span><span>${Math.round(T / 2)} s</span><span>${T} s</span></div>`);

    // Datenstrom
    setHtml($("st-strom"), j ? j.log.slice(-12).reverse().map((e) => `<li class="${/fehler|abgebrochen/i.test(e.text) ? "fehler" : ""}">
        <span style="color:${FARBE[e.agent] || "#ff8a1e"}">●</span><b>${esc(e.agent.toUpperCase())} · ${esc(e.text)}</b><time>${uhr(e.t)}</time></li>`).join("")
      : `<li><span>●</span><b>Warte auf deinen Auftrag</b><time></time></li>`);

    renderVorschau(j);
  }

  function renderVorschau(j) {
    const v = $("st-vorschau");
    const format = j?.auftrag?.format || wahl.format;
    v.dataset.format = format;
    const erg = $("st-ergebnis");
    if (j && j.status === "fertig" && j.result) {
      $("st-vs-info").textContent = `${Math.round(j.result.dur)} s · ${format === "hoch" ? "9:16" : format === "quer" ? "16:9" : "1:1"}`;
      if (gezeigtesVideo !== j.result.name) {
        gezeigtesVideo = j.result.name;
        v.innerHTML = `<video controls playsinline preload="metadata"${posterUrl(j.result.poster)} src="${esc(videoUrl(j.result.datei))}"></video>`;
      }
      erg.classList.remove("hidden");
      erg.innerHTML = `<b>✓ ${esc(j.drehbuch?.titel || j.result.name)}</b>
        ${j.result.beschreibung ? `<p>${esc(j.result.beschreibung)} <span class="st-tags">${esc(j.result.hashtags || "")}</span></p>` : ""}
        <div class="chips"><a class="chip primary" href="${esc(videoUrl(j.result.datei))}" download="${esc(j.result.name)}">⬇ Laden</a><button class="chip" data-finder="${esc(j.result.name)}">Im Finder zeigen</button><button class="chip" data-st-tab="videos">Alle Videos</button></div>`;
      return;
    }
    gezeigtesVideo = null;
    erg.classList.toggle("hidden", !(j && j.status === "fehler"));
    if (j && j.status === "fehler") erg.innerHTML = `<b class="error">Abgebrochen:</b> ${esc(j.error || "unbekannter Fehler")}`;
    const pct = j && j.status === "läuft" ? Math.round(Object.values(j.agents).reduce((s, a) => s + (a.pct || 0), 0) / 6) : 0;
    $("st-vs-info").textContent = j && j.status === "läuft" ? `${pct} %` : "";
    v.innerHTML = `<div class="st-leer ${j && j.status === "läuft" ? "arbeitet" : ""}"><i style="--p:${pct}"></i><span>${j && j.status === "läuft" ? `Team arbeitet · ${pct} %` : "Hier läuft gleich dein Video."}</span></div>`;
  }

  async function starteStudio() {
    if (starting) return;
    const thema = $("st-thema").value.trim();
    if (!thema) { $("st-thema").focus(); $("schnitt-state").textContent = "Schreib zuerst, worum es gehen soll."; return; }
    starting = true;
    try {
      const res = await api("/api/studio", { method: "POST", body: JSON.stringify({ thema, sekunden: wahl.laenge, format: wahl.format, musik: wahl.musik, bilder: wahl.bilder, sprecher: $("st-sprecher").checked }) });
      const r = await res.json();
      if (!r.ok) $("schnitt-state").textContent = r.error;
      else { stStatus = "läuft"; stJobId = r.id; say(`Verstanden, Chef. ${wahl.laenge} Sekunden über ${thema}. Das Team legt los.`); }
    } catch { $("schnitt-state").textContent = "Friday ist gerade nicht erreichbar."; } finally { starting = false; refresh(); }
  }

  // Probehören: Friday komponiert 9 Sekunden in der gewählten Stimmung.
  let probe = null;
  async function hoerprobe() {
    const b = $("st-hoer");
    if (probe && !probe.paused) { probe.pause(); b.textContent = "▶ probehören"; return; }
    const st = ["auto", "eigene", "aus"].includes(wahl.musik) ? "neon" : wahl.musik;
    b.textContent = "komponiert …";
    try {
      const r = await api(`/api/studio/hoerprobe/${st}`);
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob());
      probe?.pause();
      probe = new Audio(url);
      probe.onended = () => { b.textContent = "▶ probehören"; };
      await probe.play();
      b.textContent = "■ stopp";
    } catch { b.textContent = "▶ probehören"; }
  }

  // ====================================================================
  // Reiter 2: Clips schneiden (bisheriges Schnitt-Team)
  // ====================================================================
  function renderSchnitt(d) {
    const j = d.job;
    $("schnitt-clips").innerHTML = d.clips.length
      ? d.clips.map((c, i) => `<li><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(c)}</li>`).join("")
      : `<li class="muted">Noch keine Clips. Leg Videos in den Ordner „Eingang".</li>`;
    const sel = $("schnitt-look");
    if (!sel.options.length) {
      sel.innerHTML = d.looks.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
      sel.value = (() => { try { return localStorage.getItem("friday_schnitt_look") || "natürlich"; } catch { return "natürlich"; } })();
    }
    const running = j && j.status === "läuft";
    $("schnitt-start").disabled = running || !d.clips.length || !d.ready;
    $("schnitt-start").textContent = running ? "Team arbeitet …" : "▶ Schneide das Video";
    if (tab === "schneiden") {
      $("schnitt-state").textContent = !d.ready ? "Das Schnitt-Team ist auf diesem Mac nicht installiert." : !j ? `Bereit · ${d.clips.length} Clips im Eingang` : j.status === "läuft" ? "Team schneidet" : j.status === "fertig" ? "Fertig geschnitten" : "Fehler beim Schneiden";
      box.dataset.zustand = j?.status === "fehler" ? "bad" : running ? "warn" : "";
    }

    $("schnitt-agents").innerHTML = d.team.map((t) => {
      const a = j ? j.agents[t.id] : { status: "wartet", text: "", pct: 0 };
      return `<li class="sa ${DOT[a.status] || "wait"}">
        <div class="sa-top"><i></i><b>${esc(t.name)}</b><span>${esc(a.status.toUpperCase())}</span></div>
        <div class="sa-text">${esc(a.text || t.job)}</div>
        <div class="sa-bar"><s style="width:${Math.max(0, Math.min(100, a.pct || 0))}%"></s></div></li>`;
    }).join("");

    const tl = $("schnitt-timeline");
    if (j && j.plan && j.plan.total > 0) {
      const total = j.plan.total;
      let off = 0;
      const video = [];
      j.plan.clips.forEach((c, i) => c.segs.forEach(([a, b]) => {
        video.push(`<s style="left:${(off / total) * 100}%;width:${((b - a) / total) * 100}%;background:${COLORS[i % COLORS.length]}" title="${esc(c.name)}"></s>`);
        off += b - a;
      }));
      const subs = (j.subs || []).map(([a, b]) => `<s style="left:${(a / total) * 100}%;width:${Math.max(0.4, ((b - a) / total) * 100)}%"></s>`).join("");
      const playhead = j.agents.regie.status === "läuft" ? `<em style="left:${j.agents.regie.pct || 0}%"></em>` : "";
      tl.innerHTML = `<div class="tl-row"><span>VIDEO</span><div class="tl-track">${video.join("")}${playhead}</div></div>
        <div class="tl-row"><span>UNTERTITEL</span><div class="tl-track subs">${subs}${playhead}</div></div>
        <div class="tl-scale"><span>0 s</span><span>${Math.round(total)} s</span></div>`;
    } else tl.innerHTML = `<p class="muted">Die Zeitleiste erscheint, sobald der Schnitt-Agent geplant hat.</p>`;

    const lv = $("schnitt-levels");
    lv.innerHTML = j && j.levels ? j.levels.map((l, i) => {
      const h = l == null ? 4 : Math.max(6, Math.min(100, (l + 40) * 2.8));
      return `<div class="lv"><s style="height:${h}%;background:${COLORS[i % COLORS.length]}"></s><span>${l == null ? "–" : Math.round(l)}</span></div>`;
    }).join("") : `<p class="muted">Pegel nach der Messung</p>`;

    $("schnitt-log").innerHTML = j ? j.log.slice(-9).reverse().map((e) => `<li><b>${esc(e.agent.toUpperCase())}</b> ${esc(e.text)}</li>`).join("") : "";

    const res = $("schnitt-result");
    if (j && j.status === "fertig" && j.result) {
      res.classList.remove("hidden");
      res.innerHTML = `<b>✓ ${esc(j.result.name)}</b> · ${Math.round(j.result.dur)} s
        ${j.result.caption ? `<p>${esc(j.result.caption)}</p>` : ""}
        <button class="chip primary" data-open="fertig">Im Finder zeigen</button> <button class="chip" data-st-tab="videos">Ansehen</button>`;
    } else if (j && j.status === "fehler") {
      res.classList.remove("hidden");
      res.innerHTML = `<b class="error">Abgebrochen:</b> ${esc(j.error || "unbekannter Fehler")}`;
    } else res.classList.add("hidden");
  }

  async function startSchnitt() {
    if (starting) return;
    starting = true;
    try {
      const res = await api("/api/video-job", { method: "POST", body: JSON.stringify({ look: $("schnitt-look").value }) });
      const r = await res.json();
      if (!r.ok) $("schnitt-state").textContent = r.error;
      else { lastStatus = "läuft"; say("Verstanden, Chef. Das Team legt los."); }
    } finally { starting = false; refresh(); }
  }

  // ====================================================================
  // Reiter 3: fertige Videos
  // ====================================================================
  async function ladeVideos() {
    const el = $("st-videos");
    try {
      const { videos } = await (await api("/api/studio/videos")).json();
      $("st-zahl").textContent = videos.length;
      if (tab !== "videos") return;
      $("schnitt-state").textContent = videos.length ? `${videos.length} fertige Videos in ~/Friday-Video/Fertig` : "Noch keine fertigen Videos.";
      el.innerHTML = videos.length ? videos.map((v) => `<article class="st-vk ${esc(v.art)}">
          <video preload="metadata" playsinline controls${posterUrl(v.poster)} src="${esc(videoUrl(v.datei))}#t=0.8"></video>
          <div class="st-vk-txt"><b>${esc(v.titel)}</b><small>${v.art === "studio" ? "🎬 Studio" : v.art === "schnitt" ? "✂ Schnitt" : "Video"} · ${new Date(v.zeit).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}${v.sekunden ? ` · ${Math.round(v.sekunden)} s` : ""}${v.musik ? ` · ♪ ${esc(v.musik)}` : ""} · ${(v.groesse / 1e6).toFixed(1)} MB</small>
          <div class="chips"><a class="chip" href="${esc(videoUrl(v.datei))}" download="${esc(v.name)}">⬇ Laden</a><button class="chip" data-finder="${esc(v.name)}">Finder</button></div></div></article>`).join("")
        : `<p class="muted">Noch keine Videos. Im Reiter „Video erstellen“ geht's los, oder sag: „Friday, erstell mir ein 20-Sekunden-Video über …“</p>`;
    } catch { if (tab === "videos") el.innerHTML = `<p class="muted">Videos konnten nicht geladen werden.</p>`; }
  }

  // ====================================================================
  // Melden, Abfragen, Reiter
  // ====================================================================
  const sagS = (t, st) => (window.Friday.sagVonSelbst || say)(t, { quelle: "schnitt", stufe: st });

  function meldeSchnitt(d) {
    const j = d.job;
    if (!j) return;
    if (j.id === lastJobId && lastStatus === "läuft" && j.status !== "läuft") {
      if (j.status === "fertig") sagS(`Fertig, Chef. Dein Video ist ${Math.round(j.result?.dur || 0)} Sekunden lang und liegt im Ordner Fertig.`, "warn");
      else sagS("Chef, beim Schneiden ist etwas schiefgegangen. Die Details stehen im Schnitt-Fenster.", "bad");
    }
    lastJobId = j.id;
    lastStatus = j.status;
  }
  function meldeStudio(d) {
    const j = d.job;
    if (!j) return;
    if (j.id === stJobId && stStatus === "läuft" && j.status !== "läuft") {
      if (j.status === "fertig") {
        sagS(`Fertig, Chef. Dein Video „${j.drehbuch?.titel || j.auftrag.thema}“ ist ${Math.round(j.result?.dur || 0)} Sekunden lang${j.musik ? `, mit ${j.musik.name}-Musik` : ""}.`, "warn");
        if (!offen()) open({ tab: "erstellen" });
      } else sagS("Chef, beim Video ist etwas schiefgegangen. Die Details stehen im Studio.", "bad");
      ladeVideos();
    }
    stJobId = j.id;
    stStatus = j.status;
  }

  async function refresh() {
    if (!loggedIn()) { schedule(false); return; }
    let schnell = false;
    try {
      const [s, v] = await Promise.all([
        api("/api/studio").then((r) => r.json()).catch(() => null),
        api("/api/video-job").then((r) => r.json()).catch(() => null),
      ]);
      if (s) { meldeStudio(s); if (offen()) renderStudio(s); schnell ||= s.job?.status === "läuft"; }
      if (v) { meldeSchnitt(v); if (offen()) renderSchnitt(v); schnell ||= v.job?.status === "läuft"; }
      const agenten = (s?.team?.length || 6) + (v?.team?.length || 6);
      $("st-pille").textContent = `${agenten} Agenten`;
    } catch { /* später nochmal */ }
    schedule(schnell);
  }

  function schedule(fast) {
    clearTimeout(timer);
    timer = setTimeout(refresh, fast && offen() ? 1000 : fast ? 4000 : 20000);
  }

  function zeigeTab(t) {
    tab = ["erstellen", "schneiden", "videos"].includes(t) ? t : "erstellen";
    box.querySelectorAll("[data-st]").forEach((b) => b.classList.toggle("active", b.dataset.st === tab));
    box.querySelectorAll("[data-stp]").forEach((p) => p.classList.toggle("hidden", p.dataset.stp !== tab));
    box.dataset.reiter = tab;
    if (tab === "videos") ladeVideos();
    refresh();
  }

  function open(opt = {}) {
    const warZu = !offen();
    box.classList.remove("hidden");
    if (warZu) { box.scrollTop = 0; const sb = box.querySelector(".sz-box"); if (sb) sb.scrollTop = 0; }
    if (opt.thema) $("st-thema").value = opt.thema;
    zeigeTab(opt.tab || tab);
    ladeVideos();
  }
  function close() { box.classList.add("hidden"); probe?.pause(); }
  /** Einem per Sprache gestarteten Auftrag folgen (Friday meldet sich, wenn er fertig ist). */
  function verfolge(id) { stJobId = id; stStatus = "läuft"; open({ tab: "erstellen" }); }

  $("schnitt-open")?.addEventListener("click", () => open());
  $("schnitt-x")?.addEventListener("click", close);
  $("schnitt-start")?.addEventListener("click", startSchnitt);
  $("st-go")?.addEventListener("click", starteStudio);
  $("st-hoer")?.addEventListener("click", hoerprobe);
  $("st-thema")?.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); starteStudio(); } });
  box.addEventListener("click", (e) => {
    const t = e.target.closest("[data-st]");
    if (t) return zeigeTab(t.dataset.st);
    const st = e.target.closest("[data-st-tab]");
    if (st) return zeigeTab(st.dataset.stTab);
    const b = e.target.closest("[data-open]");
    if (b) return api("/api/video-open", { method: "POST", body: JSON.stringify({ which: b.dataset.open }) });
    const f = e.target.closest("[data-finder]");
    if (f) api("/api/studio/finder", { method: "POST", body: JSON.stringify({ name: f.dataset.finder }) });
    if (e.target === box) close();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && offen()) close(); });

  window.FridayStudio = { open, close, verfolge, refresh };
  // Im Hintergrund prüfen, damit Friday "Fertig, Chef" auch sagt, wenn per Sprache gestartet wurde.
  setTimeout(refresh, 3000);
})();
