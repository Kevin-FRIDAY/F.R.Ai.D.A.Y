// F.R.Ai.D.A.Y System-Zentrale: moderne Ansicht für das "System"-Menü.
// Live-Ringe (Prozessor, Speicher, Festplatte, Friday), Verlauf, Dienste als Kacheln, Gedächtnis, Werkzeuge.
// Alles lokal vom Mac (GET /api/system/live), kostet kein Claude-Guthaben.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api;
  const esc = F.escapeHtml || ((s) => String(s));
  const sheet = $("brain");
  if (!sheet || !api) return;

  const UMFANG = 2 * Math.PI * 42;
  let timer = null, status = null, live = null;

  // ---------- Reiter ----------
  const tabs = sheet.querySelectorAll(".sz-tabs button");
  function zeigeReiter(name) {
    tabs.forEach((b) => b.classList.toggle("active", b.dataset.sz === name));
    sheet.querySelectorAll(".sz-pane").forEach((p) => p.classList.toggle("hidden", p.dataset.pane !== name));
    try { localStorage.setItem("fsz_tab", name); } catch { /* egal */ }
  }
  tabs.forEach((b) => b.addEventListener("click", () => zeigeReiter(b.dataset.sz)));
  try { const t = localStorage.getItem("fsz_tab"); if (t && sheet.querySelector(`[data-pane="${t}"]`)) zeigeReiter(t); } catch { /* egal */ }

  // ---------- Hilfen ----------
  const dauer = (s) => {
    if (s == null) return "–";
    const t = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (t) return `${t} T ${h} Std`;
    if (h) return `${h} Std ${m} Min`;
    return `${Math.max(1, m)} Min`;
  };
  const stufe = (p) => (p >= 90 ? "bad" : p >= 70 ? "warn" : "ok");
  function ring(id, prozent, text, sub) {
    const el = $(id); if (!el) return;
    const p = Math.max(0, Math.min(100, Number(prozent) || 0));
    const val = el.querySelector(".sz-g-val");
    val.style.strokeDasharray = `${UMFANG}`;
    val.style.strokeDashoffset = `${UMFANG * (1 - p / 100)}`;
    el.dataset.stufe = stufe(p);
    el.querySelector("b").textContent = text;
    let s = el.querySelector(".sz-g-sub");
    if (!s) { s = document.createElement("em"); s.className = "sz-g-sub"; el.querySelector(".sz-g-txt").append(s); }
    s.textContent = sub || "";
  }
  function spark(verlauf) {
    const svg = $("sz-spark"); if (!svg || !verlauf?.length) return;
    const n = Math.max(verlauf.length, 2);
    const pfad = (k) => verlauf.map((v, i) => `${i ? "L" : "M"}${((i / (n - 1)) * 300).toFixed(1)},${(68 - (v[k] / 100) * 64).toFixed(1)}`).join(" ");
    svg.querySelector(".sz-sp-cpu").setAttribute("d", pfad("cpu"));
    svg.querySelector(".sz-sp-ram").setAttribute("d", pfad("ram"));
  }

  // ---------- Live-Werte ----------
  async function ladeLive() {
    try {
      live = await (await api("/api/system/live")).json();
    } catch { live = null; }
    malen();
  }
  function malen() {
    const L = live;
    if (L) {
      ring("sz-g-cpu", L.cpu.prozent, `${L.cpu.prozent}%`, `${L.cpu.kerne} Kerne`);
      ring("sz-g-ram", L.ram.prozent, `${L.ram.prozent}%`, `${L.ram.belegtGB} / ${L.ram.gesamtGB} GB`);
      if (L.platte) ring("sz-g-disk", L.platte.prozent, `${L.platte.prozent}%`, `${Math.round(L.platte.freiGB)} GB frei`);
      ring("sz-g-fri", Math.min(100, (L.friday.ramMB / 1024) * 100), `${L.friday.ramMB}`, "MB Speicher");
      spark(L.verlauf);
    }
    const facts = $("sz-facts");
    if (facts) {
      const s = status || {};
      const kachel = (k, v) => `<div class="sz-fact"><small>${esc(k)}</small><b>${esc(v)}</b></div>`;
      facts.innerHTML = [
        kachel("Friday läuft seit", dauer(L?.friday.laufzeit ?? s.uptime)),
        kachel("Rechner an seit", dauer(L?.rechner.laufzeit)),
        kachel("Version", s.version || "–"),
        kachel("Letzte Sicherung", s.sicherung?.letzte ? (F.relTime ? F.relTime(new Date(s.sicherung.letzte)) : new Date(s.sicherung.letzte).toLocaleString("de-DE")) : "keine"),
        kachel("Fridays Daten", L ? `${L.friday.datenMB} MB` : "–"),
        kachel("System", L ? `${L.rechner.plattform} · ${L.rechner.arch}` : "–"),
        kachel("Prozessor", L?.cpu.modell ? L.cpu.modell.replace(/\(R\)|\(TM\)|CPU|Processor/gi, "").replace(/\s+/g, " ").trim() : "–"),
        kachel("Node", L?.friday.node || "–"),
      ].join("");
    }
    zusammenfassung();
  }

  // ---------- Kopf: Gesamtzustand ----------
  function zusammenfassung() {
    const s = status;
    const sum = $("sz-summary"), score = $("sz-score");
    if ($("sz-version")) $("sz-version").textContent = s?.version || "–";
    if (!s) { if (sum) sum.textContent = "Server nicht erreichbar"; sheet.dataset.zustand = "bad"; if (score) score.textContent = "!"; return; }
    const punkte = [
      ["Gehirn", true],
      ["Mac", Boolean(s.agent?.online)],
      ["Sicherung", Boolean(s.sicherung?.letzte) && Date.now() - Date.parse(s.sicherung.letzte) < 7 * 864e5],
      ["Speicher", !live || live.ram.prozent < 92],
      ["Festplatte", !live?.platte || live.platte.prozent < 92],
      ["Prozessor", !live || live.cpu.prozent < 90],
    ];
    const gut = punkte.filter((p) => p[1]).length;
    const schlecht = punkte.filter((p) => !p[1]).map((p) => p[0]);
    if (score) score.textContent = `${Math.round((gut / punkte.length) * 100)}`;
    sheet.dataset.zustand = schlecht.length === 0 ? "ok" : schlecht.length <= 2 ? "warn" : "bad";
    if (sum) sum.textContent = schlecht.length ? `${schlecht.length === 1 ? "Ein Hinweis" : `${schlecht.length} Hinweise`}: ${schlecht.join(", ")}` : "Alle Systeme laufen";
  }

  // Dienste-Kacheln, die app.js nicht selbst setzt
  function dienstExtras() {
    const setz = (id, an, tAn, tAus) => { const el = $(id); if (!el) return; el.textContent = an ? tAn : tAus; el.className = an ? "ok" : "off"; };
    setz("st-wake", $("wake-toggle")?.checked, "hört zu", "aus");
    setz("st-net", navigator.onLine !== false, "online", "offline");
    if (status) setz("st-screen", status.agent?.online, "verfügbar", "Mac aus");
    const bat = $("st-battery");
    if (bat && bat.textContent === "-") { bat.textContent = "unbekannt"; bat.className = "off"; }
    const srv = $("st-server");
    if (srv && srv.textContent === "offline") srv.className = "bad";
  }

  window.addEventListener("friday-status", (e) => { status = e.detail || null; if (!sheet.classList.contains("hidden")) { dienstExtras(); zusammenfassung(); malen(); } });
  window.addEventListener("online", dienstExtras);
  window.addEventListener("offline", dienstExtras);

  // ---------- Öffnen / Schließen: nur messen, solange die Zentrale offen ist ----------
  function aufAuf() {
    if (sheet.classList.contains("hidden")) { clearInterval(timer); timer = null; return; }
    if (timer) return;
    dienstExtras();
    ladeLive();
    timer = setInterval(() => { if (document.visibilityState !== "hidden") ladeLive(); }, 4000);
  }
  new MutationObserver(aufAuf).observe(sheet, { attributes: true, attributeFilter: ["class"] });

  // ---------- Werkzeuge ----------
  const msg = (t) => { const m = $("sz-msg"); if (m) m.textContent = t; };
  const schliessen = () => sheet.classList.add("hidden");
  sheet.querySelectorAll("[data-sz-go]").forEach((b) => b.addEventListener("click", () => { schliessen(); $(b.dataset.szGo)?.click(); }));
  sheet.querySelectorAll("[data-sz-nav]").forEach((b) => b.addEventListener("click", () => { schliessen(); document.querySelector(`.nav-item[data-nav="${b.dataset.szNav}"]`)?.click(); }));
  sheet.querySelectorAll("[data-sz-act]").forEach((b) => b.addEventListener("click", async () => {
    const was = b.dataset.szAct;
    if (was === "neuladen") { location.reload(); return; }
    if (was === "cache") {
      msg("Leere Zwischenspeicher …");
      try {
        if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
        const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
        for (const r of regs) await r.update().catch(() => {});
      } catch { /* egal */ }
      msg("Erledigt. Lade neu …");
      setTimeout(() => location.reload(), 600);
      return;
    }
    if (was === "sichern") {
      b.disabled = true; msg("Sichere Daten und Programm …");
      try {
        const r = await api("/api/backups", { method: "POST" });
        const j = await r.json();
        msg(r.ok ? "Sicherung fertig ✓" : j.error || "Sicherung hat nicht geklappt.");
        F.refreshStatus?.();
      } catch { msg("Sicherung hat nicht geklappt."); }
      b.disabled = false;
      return;
    }
    if (was === "update") {
      const sub = $("sz-upd-sub");
      if (sub) sub.textContent = "Prüfe GitHub …";
      try {
        const u = await (await api("/api/update")).json();
        if (u.available) {
          if (sub) sub.textContent = `Neu: ${u.latest} – tippen zum Installieren`;
          b.dataset.szAct = "installieren";
          msg(`Version ${u.latest} ist da. Noch einmal tippen, dann installiert Friday sie (vorher wird gesichert).`);
        } else if (sub) sub.textContent = u.error ? "Konnte nicht prüfen" : `Aktuell ✓ (${u.installed})`;
      } catch { if (sub) sub.textContent = "Konnte nicht prüfen"; }
      return;
    }
    if (was === "installieren") {
      try { await api("/api/update", { method: "POST" }); msg("Update läuft – siehe Ladebalken oben."); } catch { msg("Update konnte nicht starten."); }
      b.dataset.szAct = "update";
    }
  }));

  window.FridaySystem = { aktualisieren: ladeLive };
})();
