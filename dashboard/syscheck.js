// F.R.Ai.D.A.Y System-Check: zeigt an, ob alle Dienste laufen (grün/rot).
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api, esc = F.escapeHtml || ((s) => s);

  function open() { $("syscheck")?.classList.remove("hidden"); run(); }
  function close() { $("syscheck")?.classList.add("hidden"); }
  $("syscheck-btn")?.addEventListener("click", open);
  $("syscheck-x")?.addEventListener("click", close);
  $("syscheck-run")?.addEventListener("click", run);
  window.openSysCheck = open;

  let running = false;
  async function run() {
    if (running || !api) return;
    running = true;
    const body = $("syscheck-body");
    if (body) body.innerHTML = '<p class="muted">Prüfe alle Dienste …</p>';
    let d;
    try { d = await (await api("/api/systemcheck")).json(); }
    catch { if (body) body.innerHTML = '<p class="muted">System-Check nicht erreichbar.</p>'; running = false; return; }
    if (body) {
      const rows = (d.checks || []).map((c) => `
        <div class="sc-row ${c.ok ? "ok" : "bad"}">
          <span class="sc-ic">${c.ok ? "✓" : "✗"}</span>
          <span class="sc-label">${esc(c.label)}</span>
          <span class="sc-detail">${esc(c.detail || "")}</span>
        </div>`).join("");
      const allOk = d.ok === d.gesamt;
      body.innerHTML = `
        <div class="sc-head ${allOk ? "ok" : "warn"}">${d.ok}/${d.gesamt} Dienste laufen${allOk ? " – alles in Ordnung ✅" : ""}</div>
        <div class="sc-list">${rows}</div>`;
    }
    running = false;
  }
})();
