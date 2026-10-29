// F.R.Ai.D.A.Y Tagesbericht: Diagramme, was Friday getan hat (Aufgaben, Mac, Suchen ...).
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api, esc = F.escapeHtml || ((s) => s);

  const CATS = {
    aufgabe: { icon: "✅", label: "Aufgaben", color: "#46e0a0" },
    mac: { icon: "💻", label: "Mac-Aktionen", color: "#ff8a1e" },
    erinnerung: { icon: "⏰", label: "Erinnerungen", color: "#5ad2ff" },
    suche: { icon: "🔎", label: "Suchen", color: "#8fb6ff" },
    gedaechtnis: { icon: "🧠", label: "Gemerkt", color: "#c79bff" },
    einkauf: { icon: "🛒", label: "Einkauf", color: "#ffcc4d" },
    mitteilung: { icon: "🔔", label: "Mitteilungen", color: "#ff6ec7" },
    mail: { icon: "✉️", label: "Mails", color: "#7ef0d0" },
    chat: { icon: "💬", label: "Gespräche", color: "#ff5d6c" },
  };
  const meta = (c) => CATS[c] || { icon: "•", label: c, color: "#ff8a1e" };

  let days = 1;

  function open() { $("aktiv")?.classList.remove("hidden"); load(); }
  function close() { $("aktiv")?.classList.add("hidden"); }
  $("aktiv-btn")?.addEventListener("click", open);
  $("aktiv-x")?.addEventListener("click", close);
  $("akt-range")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-days]");
    if (!b) return;
    days = +b.dataset.days;
    document.querySelectorAll("#akt-range button").forEach((x) => x.classList.toggle("on", x === b));
    load();
  });

  async function load() {
    const body = $("aktiv-body");
    if (!body || !api) return;
    body.innerHTML = '<p class="muted">Lade...</p>';
    let list;
    try { list = await (await api("/api/activity")).json(); } catch { body.innerHTML = '<p class="muted">Bericht nicht erreichbar.</p>'; return; }
    const now = Date.now();
    const span = days * 86400000;
    const items = (list || []).filter((a) => a.at && now - new Date(a.at).getTime() < span).reverse();

    if (!items.length) {
      body.innerHTML = `<div class="akt-empty"><div class="akt-empty-ic">📊</div>
        <p>Für diesen Zeitraum ist noch nichts protokolliert.</p>
        <p class="muted">Sobald Friday etwas erledigt – Aufgaben, Mac-Aktionen, Suchen, Erinnerungen, Gemerktes – erscheint es hier als Diagramm.</p></div>`;
      return;
    }

    // Nach Kategorie zählen
    const byCat = {};
    for (const a of items) byCat[a.cat] = (byCat[a.cat] || 0) + 1;
    const cats = Object.entries(byCat).sort((x, y) => y[1] - x[1]);
    const maxCat = Math.max(...cats.map((c) => c[1]));

    // Tiles
    const tiles = cats.map(([c, n]) => {
      const m = meta(c);
      return `<div class="akt-tile"><div class="akt-tile-ic">${m.icon}</div><div class="akt-tile-n">${n}</div><div class="akt-tile-l">${esc(m.label)}</div></div>`;
    }).join("");

    // Balken pro Kategorie
    const bars = cats.map(([c, n]) => {
      const m = meta(c);
      return `<div class="akt-bar-row"><span class="akt-bar-label">${m.icon} ${esc(m.label)}</span>
        <span class="akt-bar-track"><span class="akt-bar-fill" style="width:${Math.round(n / maxCat * 100)}%;background:${m.color}"></span></span>
        <b class="akt-bar-n">${n}</b></div>`;
    }).join("");

    // Tagesverlauf (nur bei Zeitraum > 1 Tag)
    let daily = "";
    if (days > 1) {
      const buckets = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now - i * 86400000);
        buckets[d.toISOString().slice(0, 10)] = 0;
      }
      for (const a of items) { const k = new Date(a.at).toISOString().slice(0, 10); if (k in buckets) buckets[k]++; }
      const vals = Object.values(buckets);
      const maxD = Math.max(1, ...vals);
      const cols = Object.entries(buckets).map(([k, v]) => {
        const lbl = new Date(k).toLocaleDateString("de-DE", { weekday: "short" }).slice(0, 2);
        return `<div class="akt-day" title="${k}: ${v}"><span class="akt-day-bar" style="height:${Math.round(v / maxD * 100)}%"></span><small>${lbl}</small><b>${v || ""}</b></div>`;
      }).join("");
      daily = `<h3 class="akt-h">Verlauf</h3><div class="akt-days">${cols}</div>`;
    }

    // Letzte Aktivitäten
    const recent = items.slice(0, 18).map((a) => {
      const m = meta(a.cat);
      const t = new Date(a.at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      return `<div class="akt-item"><span class="akt-item-ic">${m.icon}</span><span class="akt-item-l">${esc(a.label || m.label)}</span><small class="akt-item-t">${t}</small></div>`;
    }).join("");

    body.innerHTML = `
      <div class="akt-sum muted">${items.length} Aktion${items.length === 1 ? "" : "en"} ${days === 1 ? "heute" : "in " + days + " Tagen"}</div>
      <div class="akt-tiles">${tiles}</div>
      <h3 class="akt-h">Nach Bereich</h3>
      <div class="akt-bars">${bars}</div>
      ${daily}
      <h3 class="akt-h">Zuletzt</h3>
      <div class="akt-list">${recent}</div>`;
  }
})();
