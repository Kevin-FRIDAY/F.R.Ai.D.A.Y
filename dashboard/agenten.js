// F.R.Ai.D.A.Y Agenten-Team: Übersicht aller Spezial-Agenten mit Status.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { api, escapeHtml } = window.Friday;
  const sheet = $("agents");
  if (!sheet) return;

  const dot = (s) => (s === "aktiv" ? "ok" : s === "mac" ? "warn" : "off");

  async function load() {
    const list = $("agents-list");
    try {
      const data = await (await api("/api/agents")).json();
      $("agents-count").textContent = `${data.aktiv} von ${data.gesamt} aktiv`;
      list.innerHTML = data.categories.map((cat) => {
        const items = data.agents.filter((a) => a.cat === cat);
        return `<section class="agents-cat"><h3>${escapeHtml(cat)}</h3><div class="agents-grid">${items.map((a) =>
          `<div class="agent-card ${escapeHtml(a.status)}">
            <div class="agent-top"><span class="agent-emoji">${escapeHtml(a.emoji)}</span><b>${escapeHtml(a.name)}</b><i class="agent-dot ${dot(a.status)}"></i></div>
            <p class="agent-purpose">${escapeHtml(a.purpose)}</p>
            <div class="agent-ex">${a.examples.map((x) => `<button type="button" class="agent-chip">${escapeHtml(x)}</button>`).join("")}</div>
            ${a.arbeitet ? `<span class="agent-jetzt">⚡ ${escapeHtml(a.jetzt || "Arbeitet gerade …")}</span>` : a.zuletzt ? `<span class="agent-hint">Zuletzt: ${escapeHtml(String(a.zuletzt.titel || "").slice(0, 80))}</span>` : ""}
            <span class="agent-hint">${escapeHtml(a.hint)}</span>
          </div>`).join("")}</div></section>`;
      }).join("");
      // Beispiel antippen: ins Chatfeld übernehmen (nicht automatisch senden).
      list.querySelectorAll(".agent-chip").forEach((b) => b.addEventListener("click", () => {
        const t = $("text");
        if (!t) return;
        close();
        t.value = b.textContent;
        t.focus();
      }));
    } catch {
      list.innerHTML = `<p class="error">Team konnte nicht geladen werden.</p>`;
    }
  }

  function open() { sheet.classList.remove("hidden"); load(); } // Status jedes Mal frisch
  function close() { sheet.classList.add("hidden"); }

  $("agents-open")?.addEventListener("click", open);
  $("agents-x")?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.classList.contains("hidden")) close(); });
})();
