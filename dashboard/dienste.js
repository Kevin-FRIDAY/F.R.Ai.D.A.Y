// F.R.Ai.D.A.Y Verbindungen: Kalender, Stimme, Spotify, Home Assistant, Hue, Todoist, Notion an einem Ort.
// Der Server beschreibt jede Karte (Felder, Auswahl, Knöpfe) – hier wird sie nur gezeichnet.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api, esc = F.escapeHtml || ((s) => String(s));
  const post = (url, body) => api(url, { method: "POST", body: JSON.stringify(body || {}) });
  const json = async (p) => { try { const r = await p; const d = await r.json().catch(() => ({})); return { ok: r.ok, ...d }; } catch { return { ok: false, error: "Friday ist gerade nicht erreichbar." }; } };

  let offen = null; // welche Karte aufgeklappt ist

  function open() { $("dienste")?.classList.remove("hidden"); refresh(); }
  function close() { $("dienste")?.classList.add("hidden"); }
  $("dienste-open")?.addEventListener("click", open);
  $("dienste-open2")?.addEventListener("click", () => { $("settings")?.classList.add("hidden"); open(); });
  $("dienste-x")?.addEventListener("click", close);
  $("dienste")?.addEventListener("click", (e) => { if (e.target.id === "dienste") close(); });
  window.openDienste = open;

  function karte(d) {
    const auf = offen === d.id;
    const felder = (d.felder || []).map((f) => `
      <label class="dv-feld"><span>${esc(f.label)}</span>
        <input data-feld="${esc(f.name)}" type="${f.typ === "password" ? "password" : "text"}" placeholder="${esc(f.platzhalter || "")}" value="${esc(f.wert || "")}" autocomplete="off" spellcheck="false"></label>`).join("");
    const auswahl = (d.auswahl || []).map((a) => `
      <label class="dv-feld"><span>${esc(a.label)}</span>
        <select data-wahl="${esc(a.name)}">${(a.optionen || []).map((o) => `<option value="${esc(o.wert)}"${String(o.wert) === String(a.wert) ? " selected" : ""}>${esc(o.text)}</option>`).join("")}</select></label>`).join("");
    const knopfText = d.knopf || (d.ohneSchluessel ? "Zugriff testen" : "Verbinden");
    const einrichten = (d.felder || []).length || (!d.eingerichtet && d.knopf) ? `<button class="chip dv-verbinden">${esc(knopfText)}</button>` : "";
    const aktionen = (d.aktionen || []).map((a) => `<button class="ghost small dv-aktion" data-action="${esc(a.action)}"${a.link ? ' data-link="1"' : ""}>${esc(a.text)}</button>`).join("");
    const trennen = d.eingerichtet && !d.ohneSchluessel && d.quelle !== "env" ? `<button class="ghost small dv-trennen">Trennen</button>` : "";
    return `
      <article class="dv-karte${d.eingerichtet ? " an" : ""}${auf ? " auf" : ""}" data-id="${esc(d.id)}">
        <button class="dv-kopf" aria-expanded="${auf}">
          <span class="dv-ico">${esc(d.emoji || "•")}</span>
          <span class="dv-titel"><b>${esc(d.name)}</b><small>${esc(d.kurz || "")}</small></span>
          <span class="dv-pill">${d.eingerichtet ? "verbunden" : "nicht eingerichtet"}</span>
        </button>
        <div class="dv-body">
          <p class="dv-status">${esc(d.text || "")}</p>
          ${d.hinweis ? `<p class="muted dv-hinweis">${esc(d.hinweis)}</p>` : ""}
          ${felder}${auswahl}
          <div class="dv-knoepfe">${einrichten}${aktionen}${trennen}</div>
          <p class="dv-msg muted"></p>
        </div>
      </article>`;
  }

  function render(s) {
    const box = $("dienste-liste");
    if (!box) return;
    box.innerHTML = (s.dienste || []).map(karte).join("");
    const z = $("dienste-zahl");
    if (z) z.textContent = `${s.verbunden || 0} von ${s.gesamt || 0} verbunden`;
  }

  async function refresh() {
    if (!api) return;
    const s = await json(api("/api/dienste"));
    if (s.dienste) render(s);
    else if ($("dienste-liste")) $("dienste-liste").innerHTML = `<p class="muted">${esc(s.error || "Konnte die Verbindungen nicht laden.")}</p>`;
  }

  const msg = (k, t, bad = false) => { const m = k.querySelector(".dv-msg"); if (m) { m.textContent = t || ""; m.classList.toggle("bad", bad); } };

  $("dienste-liste")?.addEventListener("click", async (e) => {
    const k = e.target.closest(".dv-karte");
    if (!k) return;
    const id = k.dataset.id;
    if (e.target.closest(".dv-kopf")) {
      offen = offen === id ? null : id;
      k.classList.toggle("auf", offen === id);
      document.querySelectorAll(".dv-karte").forEach((x) => { if (x !== k) x.classList.remove("auf"); });
      return;
    }
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.classList.contains("dv-verbinden")) {
      const body = {};
      k.querySelectorAll("[data-feld]").forEach((i) => { body[i.dataset.feld] = i.value.trim(); });
      btn.disabled = true;
      const alt = btn.textContent;
      btn.textContent = id === "hue" ? "Warte auf Knopf …" : "Prüfe …";
      msg(k, id === "hue" ? "Drück jetzt den runden Knopf auf der Hue Bridge (30 Sekunden Zeit)." : "");
      const r = await json(post(`/api/dienste/${id}/einrichten`, body));
      btn.disabled = false; btn.textContent = alt;
      if (!r.ok) { msg(k, r.error || "Das hat nicht geklappt.", true); return; }
      if (r.link) { window.open(r.link, "_blank", "noopener"); }
      offen = id;
      await refresh();
      const k2 = document.querySelector(`.dv-karte[data-id="${id}"]`);
      if (k2) msg(k2, r.text || "Verbunden.");
      if (r.text) F.say?.(r.text);
      return;
    }
    if (btn.classList.contains("dv-trennen")) {
      if (!confirm("Diese Verbindung aus Friday entfernen? Der Schlüssel wird gelöscht.")) return;
      await post(`/api/dienste/${id}/vergessen`);
      offen = id;
      refresh();
      return;
    }
    if (btn.classList.contains("dv-aktion")) {
      const action = btn.dataset.action;
      btn.classList.add("busy");
      msg(k, "…");
      const r = await json(post(`/api/dienste/${id}/befehl`, { action }));
      btn.classList.remove("busy");
      if (!r.ok) { msg(k, r.error || "Hat nicht geklappt.", true); if (/^test|^probe$/.test(action)) F.say?.(r.error || "Das hat nicht geklappt."); return; }
      if (r.link) { window.open(r.link, "_blank", "noopener"); msg(k, "Spotify öffnet sich. Danach hier auf ↻ tippen."); return; }
      msg(k, r.text || "Erledigt.");
      if (r.sprechen || action === "probe" || action === "jetzt" || action === "heute") F.say?.(r.text);
      if (["aktualisieren", "seiten", "raeume", "testen"].includes(action)) { offen = id; setTimeout(refresh, 300); }
    }
  });

  $("dienste-liste")?.addEventListener("change", async (e) => {
    const sel = e.target.closest("select[data-wahl]");
    if (!sel) return;
    const k = sel.closest(".dv-karte");
    const r = await json(post(`/api/dienste/${k.dataset.id}/einstellen`, { name: sel.dataset.wahl, wert: sel.value }));
    msg(k, r.ok ? (r.text || "Gespeichert.") : (r.error || "Hat nicht geklappt."), !r.ok);
    if (r.ok) F.refreshStatus?.();
  });
  $("dienste-refresh")?.addEventListener("click", refresh);
})();
