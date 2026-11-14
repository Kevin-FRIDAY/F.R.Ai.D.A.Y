// F.R.Ai.D.A.Y Webseiten-Werkstatt: Aufträge, Vorschau, Download, Angebot und "verkauft".
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { api, say, escapeHtml } = window.Friday;
  const box = $("webseiten");
  if (!box) return;

  let sites = [], current = null, currentHtml = "", busy = false;
  const eur = (v) => (v == null ? "–" : `${Number(v).toLocaleString("de-DE", { maximumFractionDigits: 2 })} €`);
  const msg = (t, err) => { const m = $("ws-msg"); m.textContent = t || ""; m.classList.toggle("error", Boolean(err)); };

  async function loadList(selectId) {
    try { sites = await (await api("/api/webseiten")).json(); } catch { sites = []; }
    const sold = sites.filter((s) => s.status === "verkauft");
    $("ws-sum").textContent = `${sites.length} Projekte · ${sold.length} verkauft · ${eur(sold.reduce((a, s) => a + (s.verkauft_eur || 0), 0))} eingenommen`;
    $("ws-list").innerHTML = sites.map((s) => `<li><button type="button" data-id="${escapeHtml(s.id)}" class="${current?.id === s.id ? "on" : ""}">
        <b>${escapeHtml(s.titel)}</b><span>${new Date(s.erstellt).toLocaleDateString("de-DE")} · ${s.status === "verkauft" ? `✓ verkauft ${eur(s.verkauft_eur)}` : `Entwurf · Vorschlag ${eur(s.preis_eur)}`}</span></button></li>`).join("")
      || `<li class="muted">Noch keine Webseiten. Beschreib oben deinen ersten Kunden.</li>`;
    const pick = selectId ? sites.find((s) => s.id === selectId) : current ? sites.find((s) => s.id === current.id) : sites[0];
    if (pick) show(pick); else { current = null; $("ws-detail").classList.add("hidden"); }
  }

  async function show(site) {
    current = site;
    box.querySelectorAll("#ws-list button").forEach((b) => b.classList.toggle("on", b.dataset.id === site.id));
    $("ws-detail").classList.remove("hidden");
    $("ws-titel").textContent = site.titel;
    $("ws-angebot").textContent = site.angebot || "";
    $("ws-preis").textContent = site.status === "verkauft" ? `Verkauft für ${eur(site.verkauft_eur)}` : `Preisvorschlag: ${eur(site.preis_eur)}`;
    $("ws-sold-form").classList.toggle("hidden", site.status === "verkauft");
    if (site.preis_eur && !$("ws-sold-betrag").value) $("ws-sold-betrag").placeholder = String(site.preis_eur);
    try {
      currentHtml = (await (await api(`/api/webseite/${encodeURIComponent(site.id)}/html`)).json()).html || "";
      $("ws-frame").srcdoc = currentHtml;
    } catch { $("ws-frame").srcdoc = "<p style='font-family:sans-serif;padding:20px'>Vorschau nicht verfügbar.</p>"; }
  }

  async function build(auftrag, basis) {
    if (busy) return;
    auftrag = String(auftrag || "").trim();
    if (!auftrag) { msg("Beschreib zuerst den Kunden und die Seite.", true); return; }
    busy = true;
    $("ws-go").disabled = true; $("ws-change-go").disabled = true;
    msg(basis ? "Friday überarbeitet die Seite … (1–2 Minuten)" : "Friday baut die Webseite … (1–2 Minuten)");
    $("ws-state").textContent = "BAUT"; $("ws-state").className = "ws-state busy";
    try {
      const res = await api("/api/webseite", { method: "POST", body: JSON.stringify({ auftrag, basis }) });
      const r = await res.json();
      if (!r.ok) { msg(r.error, true); return; }
      msg(`Fertig: ${r.titel}. Preisvorschlag ${eur(r.preis_eur)}.`);
      say(`Fertig, Chef. ${r.titel} steht. Mein Preisvorschlag: ${Math.round(r.preis_eur || 0)} Euro.`);
      await loadList(r.id);
      window.FridayEnergie?.refresh();
    } catch { msg("Friday ist gerade nicht erreichbar.", true); }
    finally { busy = false; $("ws-go").disabled = false; $("ws-change-go").disabled = false; $("ws-state").textContent = ""; $("ws-state").className = "ws-state"; }
  }

  function download() {
    if (!current || !currentHtml) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([currentHtml], { type: "text/html" }));
    a.download = `${current.id}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  $("ws-form")?.addEventListener("submit", (e) => { e.preventDefault(); build($("ws-auftrag").value); });
  $("ws-change-form")?.addEventListener("submit", (e) => { e.preventDefault(); if (current) { build($("ws-change").value, current.id); $("ws-change").value = ""; } });
  $("ws-list")?.addEventListener("click", (e) => { const b = e.target.closest("button[data-id]"); if (b) { const s = sites.find((x) => x.id === b.dataset.id); if (s) show(s); } });
  $("ws-download")?.addEventListener("click", download);
  $("ws-ordner")?.addEventListener("click", () => current && api(`/api/webseite/${encodeURIComponent(current.id)}/ordner`, { method: "POST" }));
  $("ws-copy")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(`${current.angebot}\n\nPreis: ${eur(current.preis_eur)}`); msg("Angebot kopiert."); } catch { msg("Kopieren ging nicht.", true); } });
  let selling = false;
  $("ws-sold-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!current || selling) return;
    selling = true;
    setTimeout(() => { selling = false; }, 3000);
    const betrag = String($("ws-sold-betrag").value || current.preis_eur || "").replace(",", ".");
    const r = await (await api(`/api/webseite/${encodeURIComponent(current.id)}/verkauft`, { method: "POST", body: JSON.stringify({ betrag }) })).json();
    if (!r.ok) { msg(r.error, true); return; }
    msg("Verkauf eingetragen. Das zählt für Fridays Überlebens-Bilanz.");
    say("Danke, Chef. Das verlängert mein Leben.");
    $("ws-sold-betrag").value = "";
    window.FridayEnergie?.refresh();
    loadList(current.id);
  });

  const open = (id) => { box.classList.remove("hidden"); loadList(id); };
  $("webseiten-open")?.addEventListener("click", () => open());
  $("webseiten-x")?.addEventListener("click", () => box.classList.add("hidden"));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !box.classList.contains("hidden")) box.classList.add("hidden"); });
  window.FridayWebseiten = { open };
})();
