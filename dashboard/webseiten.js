// F.R.Ai.D.A.Y Webseiten-Werkstatt: Aufträge, Vorschau, Download, Angebot und "verkauft".
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { api, say, escapeHtml } = window.Friday;
  const box = $("webseiten");
  if (!box) return;

  let sites = [], current = null, currentHtml = "", busy = false;
  // v1.158.0: Stil-Wahl, Branche, Sofort-Vorlage, Geräte-Vorschau, Qualitäts-Note.
  let stil = "";
  try { stil = localStorage.getItem("friday_ws_stil") || ""; } catch { /* egal */ }
  let optionenDa = false;
  async function optionenLaden() {
    if (optionenDa) return;
    try {
      const o = await (await api("/api/webseiten/optionen")).json();
      $("ws-stile").innerHTML = [{ id: "", name: "Auto", a1: "#888", a2: "#ccc", bg: "#222", beschreibung: "passend zur Branche" }, ...o.stile].map((x) =>
        `<button type="button" role="radio" data-stil="${escapeHtml(x.id)}" title="${escapeHtml(x.beschreibung)}" class="${x.id === stil ? "on" : ""}" aria-checked="${x.id === stil}"><i style="background:linear-gradient(135deg,${escapeHtml(x.a1)},${escapeHtml(x.a2)});box-shadow:inset 0 0 0 3px ${escapeHtml(x.bg)}"></i>${escapeHtml(x.name)}</button>`).join("");
      $("ws-branche").innerHTML = `<option value="">Automatisch erkennen</option>${o.branchen.filter((b) => b.id !== "allgemein").map((b) => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)}</option>`).join("")}<option value="allgemein">Sonstiges</option>`;
      optionenDa = true;
    } catch { /* offline */ }
  }
  $("ws-stile")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-stil]");
    if (!b) return;
    stil = b.dataset.stil;
    try { localStorage.setItem("friday_ws_stil", stil); } catch { /* egal */ }
    $("ws-stile").querySelectorAll("button").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", String(x === b)); });
  });
  const wahl = () => ({ stil: stil || undefined, branche: $("ws-branche")?.value || undefined });

  function geraet(w) {
    $("ws-geraet").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.w === w));
    $("ws-frame").style.width = w ? `${w}px` : "";
    $("ws-frame").parentElement.classList.toggle("schmal", Boolean(w));
  }
  $("ws-geraet")?.addEventListener("click", (e) => { const b = e.target.closest("button[data-w]"); if (b) geraet(b.dataset.w); });

  async function noteZeigen(site) {
    const n = $("ws-note"), l = $("ws-checks");
    n.classList.add("hidden"); l.classList.add("hidden");
    try {
      const q = await (await api(`/api/webseite/${encodeURIComponent(site.id)}/qualitaet`)).json();
      if (current?.id !== site.id || q.punkte == null) return;
      n.textContent = `Qualität ${q.punkte}/100`;
      n.className = `ws-note ${q.punkte >= 90 ? "gut" : q.punkte >= 70 ? "mittel" : "schwach"}`;
      l.innerHTML = q.checks.map((c) => `<li class="${c.ok ? "ok" : "fehlt"}">${c.ok ? "✓" : "✕"} <b>${escapeHtml(c.name)}</b>${c.ok ? "" : ` – ${escapeHtml(c.tipp)}`}</li>`).join("")
        + `<li class="info">${q.abschnitte} Abschnitte · ${q.fotos} Fotos · ${q.groesse_kb.toLocaleString("de-DE")} KB</li>`;
    } catch { /* egal */ }
  }
  $("ws-note")?.addEventListener("click", () => $("ws-checks").classList.toggle("hidden"));

  async function sofort() {
    if (busy) return;
    const auftrag = String($("ws-auftrag").value || "").trim();
    busy = true; $("ws-go").disabled = true; $("ws-sofort").disabled = true;
    msg("Friday baut aus ihren Profi-Vorlagen und sucht passende Fotos …");
    $("ws-state").textContent = "BAUT"; $("ws-state").className = "ws-state busy";
    try {
      const r = await (await api("/api/webseite/vorlage", { method: "POST", body: JSON.stringify({ auftrag, ...wahl() }) })).json();
      if (!r.ok) { msg(r.error || "Das ging gerade nicht.", true); return; }
      msg(`Fertig: ${r.titel}. Qualität ${r.qualitaet?.punkte ?? "–"}/100, ${r.qualitaet?.fotos ?? 0} Fotos. Preisvorschlag ${eur(r.preis_eur)}.`);
      say(`Fertig, Chef. ${r.titel} steht. Mein Preisvorschlag: ${Math.round(r.preis_eur || 0)} Euro.`);
      await loadList(r.id);
    } catch { msg("Friday ist gerade nicht erreichbar.", true); }
    finally { busy = false; $("ws-go").disabled = false; $("ws-sofort").disabled = false; $("ws-state").textContent = ""; $("ws-state").className = "ws-state"; }
  }
  $("ws-sofort")?.addEventListener("click", sofort);
  const eur = (v) => (v == null ? "–" : `${Number(v).toLocaleString("de-DE", { maximumFractionDigits: 2 })} €`);
  const msg = (t, err) => { const m = $("ws-msg"); m.textContent = t || ""; m.classList.toggle("error", Boolean(err)); };

  async function loadList(selectId) {
    try { sites = await (await api("/api/webseiten")).json(); } catch { sites = []; }
    const sold = sites.filter((s) => s.status === "verkauft");
    $("ws-sum").textContent = `${sites.length} Projekte · ${sold.length} verkauft · ${eur(sold.reduce((a, s) => a + (s.verkauft_eur || 0), 0))} eingenommen`;
    $("ws-list").innerHTML = sites.map((s) => `<li><button type="button" data-id="${escapeHtml(s.id)}" class="${current?.id === s.id ? "on" : ""}">
        <b>${escapeHtml(s.titel)}</b><span>${new Date(s.erstellt).toLocaleDateString("de-DE")} · ${s.status === "verkauft" ? `✓ verkauft ${eur(s.verkauft_eur)}` : `Entwurf · Vorschlag ${eur(s.preis_eur)}`}${s.qualitaet?.punkte != null ? ` · ★ ${s.qualitaet.punkte}` : ""}${s.quelle === "vorlage" ? " · ⚡ Vorlage" : ""}</span></button></li>`).join("")
      || `<li class="muted">Noch keine Webseiten. Beschreib oben deinen ersten Kunden.</li>`;
    const pick = selectId ? sites.find((s) => s.id === selectId) : current ? sites.find((s) => s.id === current.id) : sites[0];
    if (pick) show(pick); else { current = null; $("ws-detail").classList.add("hidden"); }
  }

  async function show(site) {
    current = site;
    box.querySelectorAll("#ws-list button").forEach((b) => b.classList.toggle("on", b.dataset.id === site.id));
    if (live && !live.ende) return; // Während des Live-Baus bleibt die Live-Ansicht vorn.
    if (live) { $("ws-live").classList.add("hidden"); }
    $("ws-detail").classList.remove("hidden");
    $("ws-titel").textContent = site.titel;
    $("ws-angebot").textContent = site.angebot || "";
    $("ws-preis").textContent = site.status === "verkauft" ? `Verkauft für ${eur(site.verkauft_eur)}` : `Preisvorschlag: ${eur(site.preis_eur)}`;
    $("ws-sold-form").classList.toggle("hidden", site.status === "verkauft");
    if (site.preis_eur && !$("ws-sold-betrag").value) $("ws-sold-betrag").placeholder = String(site.preis_eur);
    try {
      currentHtml = (await (await api(`/api/webseite/${encodeURIComponent(site.id)}/html`)).json()).html || "";
      $("ws-frame").srcdoc = currentHtml;
      noteZeigen(site);
    } catch { $("ws-frame").srcdoc = "<p style='font-family:sans-serif;padding:20px'>Vorschau nicht verfügbar.</p>"; }
  }

  // ---------- Live-Bau mit Countdown (v1.146.0, zuerst nur in Eve) ----------
  // Man sieht, wie Friday die Seite programmiert (Code + wachsende Vorschau), dazu Countdown und Ladebalken.
  // In Friday antwortet der Server mit 423 (noch im Test) → dann baut Friday wie bisher.
  let live = null; // { id, ab, code, t0, schaetzung, timer, vorschauZeit }
  const wl = (id) => $(id);
  const hlEsc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const hl = (t) => hlEsc(t).replace(/(&lt;!--[\s\S]*?(?:--&gt;|$))|("[^"\n]*")|(&lt;\/?[\w-]+)|([\w:-]+)(?==)/g,
    (m, k, str, tag, attr) => (k ? `<span class="k">${k}</span>` : str ? `<span class="s">${str}</span>` : tag ? `<span class="t">${tag}</span>` : `<span class="a">${attr}</span>`));
  const uhr = (sek) => { const s = Math.max(0, Math.round(sek)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

  function liveZeigen(an) {
    $("ws-live").classList.toggle("hidden", !an);
    if (an) $("ws-detail").classList.add("hidden");
  }

  function liveTick() {
    if (!live || live.ende) return;
    const vergangen = (Date.now() - live.t0) / 1000;
    const rest = live.schaetzung - vergangen;
    const box = $("ws-live");
    box.classList.toggle("wl-ueber", rest < 0);
    wl("wl-zeit").textContent = rest >= 0 ? uhr(rest) : `+${uhr(-rest)}`;
    wl("wl-uhr-text").textContent = rest >= 0 ? "bis fertig" : "gleich fertig";
    const p = Math.min(0.97, Math.max(live.code.length / Math.max(1, live.erwartet), (vergangen / live.schaetzung) * 0.92));
    live.p = Math.max(live.p || 0, p);
    wl("wl-fuell").style.width = `${(live.p * 100).toFixed(1)}%`;
    wl("wl-prozent").textContent = `${Math.round(live.p * 100)} %`;
  }

  function liveCode(neu) {
    const pre = wl("wl-code");
    const unten = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 60;
    const alt = live.code;
    live.code = alt + neu;
    pre.innerHTML = hl(alt) + (neu ? `<span class="neu">${hl(neu)}</span>` : "");
    if (unten) pre.scrollTop = pre.scrollHeight;
    if (neu && Date.now() - (live.vorschauZeit || 0) > 1800 && /<body[\s>]/i.test(live.code)) {
      live.vorschauZeit = Date.now();
      wl("wl-frame").srcdoc = live.code;
    }
  }

  // v1.151.0: Friday sagt laut, was sie gerade baut ("Das baue ich gerade: den Kopfbereich").
  // Jede Phase nur einmal, und nie mitten in einen Satz hinein (sonst schneidet die nächste Ansage ab).
  const sprechDauer = (t) => 900 + (String(t).length / 13) * 1000;
  function phaseAnsagen(satz) {
    if (!live || live.ende || !satz) return;
    let an = true;
    try { an = localStorage.getItem("friday_ws_ansage") !== "0"; } catch { /* egal */ }
    if (!an) return;
    live.gesagt ||= new Set();
    if (live.gesagt.has(satz)) return;
    live.wartet = satz;
    if (Date.now() < (live.frei || 0)) {
      clearTimeout(live.ansageTimer);
      live.ansageTimer = setTimeout(() => { const w2 = live?.wartet; if (w2) { live.wartet = ""; phaseAnsagen(w2); } }, live.frei - Date.now() + 50);
      return;
    }
    live.wartet = "";
    live.gesagt.add(satz);
    live.frei = Date.now() + sprechDauer(satz);
    say(satz);
  }

  async function livePoll() {
    if (!live || live.ende) return;
    let j;
    try { j = await (await api(`/api/webseite/live/${live.id}?ab=${live.code.length}`)).json(); } catch { live.poll = setTimeout(livePoll, 1500); return; }
    if (!live || live.id !== j.id) return;
    if (j.ab < live.code.length) { live.code = live.code.slice(0, j.ab); }
    liveCode(j.code || "");
    if (j.titel) wl("wl-titel").textContent = j.titel;
    wl("wl-phase").textContent = j.phase || "";
    if (j.status === "baut") phaseAnsagen(j.sprich);
    wl("wl-zeilen").textContent = (j.zeilen || 0).toLocaleString("de-DE");
    wl("wl-zeichen").textContent = (j.zeichen || 0).toLocaleString("de-DE");
    if (j.status === "baut") { live.poll = setTimeout(livePoll, 600); return; }
    liveEnde(j);
  }

  function liveEnde(j) {
    live.ende = true;
    clearInterval(live.timer);
    clearTimeout(live.ansageTimer);
    const box = $("ws-live");
    busy = false; $("ws-go").disabled = false; $("ws-change-go").disabled = false; $("ws-sofort").disabled = false;
    $("ws-state").textContent = ""; $("ws-state").className = "ws-state";
    box.classList.remove("wl-ueber");
    if (j.status === "fertig" && j.ergebnis) {
      const sek = Math.round(j.vergangen_s);
      box.classList.add("wl-fertig");
      wl("wl-fuell").style.width = "100%"; wl("wl-prozent").textContent = "100 % ✓";
      wl("wl-zeit").textContent = uhr(sek); wl("wl-uhr-text").textContent = "fertig in";
      wl("wl-frame").srcdoc = live.code;
      wl("wl-code").innerHTML = hl(live.code);
      const r = j.ergebnis;
      const knapp = sek <= j.schaetzung_s + 3 ? `${sek} Sekunden, wie versprochen.` : `${sek} Sekunden, etwas länger als gedacht.`;
      msg(`${j.hinweis ? `${j.hinweis} ` : ""}Fertig in ${sek} s: ${r.titel}. Qualität ${r.qualitaet?.punkte ?? "–"}/100. Preisvorschlag ${eur(r.preis_eur)}.`, Boolean(j.hinweis));
      // Nicht mitten in die letzte Bau-Ansage hinein (höchstens 3 s warten). Schon fertige Bauten nicht noch mal ansagen.
      const fertigSatz = `Fertig, Chef. ${knapp} ${r.titel} steht. Mein Preisvorschlag: ${Math.round(r.preis_eur || 0)} Euro.`;
      if (!live.stumm) setTimeout(() => say(fertigSatz), Math.min(3000, Math.max(0, (live.frei || 0) - Date.now())));
      window.FridayEnergie?.refresh();
      setTimeout(() => { if (live?.id === j.id) { liveZeigen(false); loadList(r.id); } }, 4000);
    } else {
      box.classList.add("wl-fehler");
      wl("wl-phase").textContent = j.error || "Hat nicht geklappt.";
      msg(j.error || "Die Webseite hat gerade nicht geklappt.", true);
      if (!live.stumm) say(j.error || "Das hat leider nicht geklappt, Chef.");
    }
  }

  function liveFolgen(job, { sprechen } = {}) {
    if (live && !live.ende) { clearTimeout(live.poll); clearInterval(live.timer); }
    live = { id: job.id, code: "", t0: Date.now() - (job.vergangen_s || 0) * 1000, schaetzung: job.schaetzung_s || 60, erwartet: job.erwartet_zeichen || 20000, p: 0, stumm: job.status && job.status !== "baut" };
    const box = $("ws-live");
    box.classList.remove("wl-fertig", "wl-fehler", "wl-ueber");
    wl("wl-code").innerHTML = ""; wl("wl-frame").srcdoc = "";
    wl("wl-titel").textContent = job.titel || "Friday baut …";
    wl("wl-spruch").textContent = job.spruch ? `„${job.spruch}“` : "";
    wl("wl-modell").textContent = job.modus === "schnell" ? "⚡ Tempo-Modus" : "";
    liveZeigen(true);
    box.scrollTop = 0; // Handy: Live-Ansicht steht oben
    busy = true; $("ws-go").disabled = true; $("ws-change-go").disabled = true; $("ws-sofort").disabled = true;
    $("ws-state").textContent = "BAUT LIVE"; $("ws-state").className = "ws-state busy";
    msg("");
    if (sprechen && job.spruch) { say(job.spruch); live.frei = Date.now() + sprechDauer(job.spruch); }
    live.timer = setInterval(liveTick, 250);
    liveTick();
    livePoll();
  }

  /** true = Live-Bau läuft, false = gesperrt (alter Weg), null = Fehler schon gemeldet. */
  async function buildLive(auftrag, basis) {
    let res;
    try { res = await api("/api/webseite/live", { method: "POST", body: JSON.stringify({ auftrag, basis, ...wahl() }) }); } catch { return false; }
    if (res.status === 423) return false;
    const r = await res.json().catch(() => ({}));
    if (!r.ok) { msg(r.error || "Das ging gerade nicht.", true); return null; }
    liveFolgen(r.job, { sprechen: !r.laeuft_schon });
    return true;
  }

  async function laufendenBauHolen() {
    try {
      const res = await api("/api/webseite/live/aktuell");
      if (!res.ok) return;
      const { job } = await res.json();
      if (job && (!live || live.id !== job.id)) liveFolgen(job);
    } catch { /* gesperrt oder offline */ }
  }

  async function build(auftrag, basis) {
    if (busy) return;
    auftrag = String(auftrag || "").trim();
    if (!auftrag) { msg("Beschreib zuerst den Kunden und die Seite.", true); return; }
    if ((await buildLive(auftrag, basis)) !== false) return;
    busy = true;
    $("ws-go").disabled = true; $("ws-change-go").disabled = true;
    msg(basis ? "Friday überarbeitet die Seite … (1–2 Minuten)" : "Friday baut die Webseite … (1–2 Minuten)");
    $("ws-state").textContent = "BAUT"; $("ws-state").className = "ws-state busy";
    try {
      const res = await api("/api/webseite", { method: "POST", body: JSON.stringify({ auftrag, basis, ...wahl() }) });
      const r = await res.json();
      if (!r.ok) { msg(r.error, true); return; }
      msg(`${r.hinweis ? `${r.hinweis} ` : ""}Fertig: ${r.titel}. Qualität ${r.qualitaet?.punkte ?? "–"}/100. Preisvorschlag ${eur(r.preis_eur)}.`, Boolean(r.hinweis));
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

  const open = (id) => { box.classList.remove("hidden"); optionenLaden(); loadList(id); laufendenBauHolen(); };
  $("webseiten-open")?.addEventListener("click", () => open());
  $("webseiten-x")?.addEventListener("click", () => box.classList.add("hidden"));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !box.classList.contains("hidden")) box.classList.add("hidden"); });
  window.FridayWebseiten = { open };
})();
