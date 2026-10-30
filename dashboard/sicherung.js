// F.R.Ai.D.A.Y Sicherungen: Backups anlegen, anzeigen und zurückholen.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api, esc = F.escapeHtml || ((s) => s);
  const rel = F.relTime || ((d) => d.toLocaleString("de-DE"));

  const GRUND = {
    automatisch: "Automatisch",
    manuell: "Von Hand",
    "vor-wiederherstellung": "Vor dem Zurückholen",
  };
  const grundText = (g) => GRUND[g] || (g.startsWith("vor-update") ? `Vor Update ${g.replace("vor-update-", "")}`.trim() : g);
  const groesse = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

  function open() { $("backups")?.classList.remove("hidden"); load(); }
  function close() { $("backups")?.classList.add("hidden"); }
  ["backups-btn", "backups-btn2", "bk-open", "hb-backup"].forEach((id) => $(id)?.addEventListener("click", () => {
    $("settings")?.classList.add("hidden");
    open();
  }));
  $("backups-x")?.addEventListener("click", close);
  $("backups-new")?.addEventListener("click", () => backupNow($("backups-new")));
  $("bk-now")?.addEventListener("click", () => backupNow($("bk-now")));

  // Kleines Panel rechts: letzte Sicherung.
  window.addEventListener("friday-status", (e) => {
    const s = e.detail?.sicherung;
    if (!s) return;
    $("bk-last").textContent = s.letzte ? `Letzte: ${rel(new Date(s.letzte))}` : "Noch keine Sicherung";
    $("bk-count").textContent = s.anzahl ? `${s.anzahl} Sicherung${s.anzahl === 1 ? "" : "en"} · täglich automatisch` : "täglich automatisch";
    $("bk-last").closest(".backup-card")?.classList.toggle("bk-stale", !s.letzte || Date.now() - new Date(s.letzte).getTime() > 7 * 86400000);
  });

  async function backupNow(btn) {
    if (!api || btn?.disabled) return;
    const label = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "Sichere..."; }
    try {
      const r = await (await api("/api/backups", { method: "POST" })).json();
      if (r.error) throw new Error(r.error);
      if (btn) btn.textContent = "Gesichert ✓";
      F.refreshStatus?.();
      if (!$("backups")?.classList.contains("hidden")) load();
    } catch (err) {
      if (btn) btn.textContent = "Fehlgeschlagen";
      alert(`Sicherung hat nicht geklappt: ${err.message}`);
    }
    setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = label; } }, 2500);
  }

  async function load() {
    const body = $("backups-body");
    if (!body || !api) return;
    let d;
    try { d = await (await api("/api/backups")).json(); }
    catch { body.innerHTML = '<p class="muted">Sicherungen nicht erreichbar.</p>'; return; }
    const list = d.sicherungen || [];
    if (!list.length) {
      body.innerHTML = `<p class="muted">Noch keine Sicherung vorhanden. Tippe auf „Jetzt sichern“.</p>`;
      return;
    }
    body.innerHTML = `
      <div class="bk-folder muted">Ordner: <code>${esc(d.ordner)}</code></div>
      <div class="bk-list">${list.map((b, i) => {
        const t = new Date(b.zeit);
        return `
        <div class="bk-row${i === 0 ? " newest" : ""}">
          <div class="bk-when"><b>${esc(t.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }))}</b>
            <small>${esc(t.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }))} Uhr · ${esc(rel(t))}</small></div>
          <div class="bk-meta"><span class="bk-tag">${esc(grundText(b.grund))}</span>
            <small>v${esc(b.version || "?")} · ${groesse(b.groesse)}${b.programm ? " · mit Programm" : ""}</small></div>
          <button class="chip bk-restore" data-name="${esc(b.name)}" data-prog="${b.programm ? 1 : 0}">Zurückholen</button>
        </div>`;
      }).join("")}</div>`;
    body.querySelectorAll(".bk-restore").forEach((btn) => btn.addEventListener("click", () => restore(btn.dataset.name, btn.dataset.prog === "1")));
  }

  async function restore(name, hasProgram) {
    const when = name.slice(0, 10).split("-").reverse().join(".");
    if (!confirm(`Sicherung vom ${when} zurückholen?\n\nEinstellungen, Gedächtnis, Aufgaben und eigene Protokolle werden auf diesen Stand gesetzt. Der jetzige Stand wird vorher gesichert.`)) return;
    const programm = hasProgram && confirm("Auch die Programmversion von damals zurückholen?\n\nOK = ja, auch die alte Version\nAbbrechen = nur die Daten");
    const r = await (await api(`/api/backups/${encodeURIComponent(name)}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ programm }) })).json();
    if (r.error) { alert(r.error); return; }
    $("backups-body").innerHTML = '<p class="muted">Ich hole die Sicherung zurück und starte gleich neu …</p>';
    // Warten, bis Friday wieder da ist, dann neu laden.
    const start = Date.now();
    const poll = setInterval(async () => {
      if (Date.now() - start > 4 * 60000) { clearInterval(poll); $("backups-body").innerHTML = '<p class="error">Das dauert ungewöhnlich lange. Schau in ~/Library/Logs/Friday/wiederherstellung.log nach.</p>'; return; }
      try {
        const s = (await (await api("/api/backups")).json()).status;
        if (s?.state === "fertig" && Date.now() - start > 4000) { clearInterval(poll); location.reload(); }
        if (s?.state === "fehler") { clearInterval(poll); $("backups-body").innerHTML = `<p class="error">${esc(s.message)}</p>`; }
      } catch { /* Friday startet gerade neu */ }
    }, 2500);
  }
})();
