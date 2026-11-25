// F.R.Ai.D.A.Y Großauftrag (v1.176.0): zeigt, wie Friday einen Auftrag mit mehreren Teilen der Reihe nach erledigt
// (Drehbuch → Film → Auto → Premieren-Webseite), mit Fortschritt je Schritt und ehrlicher Bilanz am Ende.
(() => {
  "use strict";
  const F = window.Friday || {};
  const api = F.api;
  if (!api) return;
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const token = () => { try { return localStorage.getItem("friday_token") || ""; } catch { return ""; } };

  const huelle = document.createElement("div");
  huelle.id = "grossauftrag";
  huelle.className = "dok-huelle hidden";
  huelle.innerHTML = `<div class="upd-bar dok-karte ga-karte" role="dialog" aria-modal="true" aria-labelledby="ga-titel">
      <div class="ub-kopf">
        <span class="ub-ring" id="ga-ring"></span>
        <div class="ub-titel"><b id="ga-titel">GROSSAUFTRAG</b><small id="ga-sub">Friday erledigt alles der Reihe nach</small></div>
        <span class="ub-prozent" id="ga-prozent"></span>
        <button class="ub-x" id="ga-x" title="Schließen (Friday arbeitet weiter)" aria-label="Schließen">×</button>
      </div>
      <div class="ub-spur" id="ga-spur"><div class="ub-fuell" id="ga-fuell"></div><div class="ub-glanz"></div></div>
      <div id="ga-inhalt" class="dok-inhalt"></div>
    </div>`;
  document.body.appendChild(huelle);
  const $ = (id) => document.getElementById(id);

  let aktuell = null, poll = null, liste = [];
  const offen = () => !huelle.classList.contains("hidden");
  function zu() { huelle.classList.add("hidden"); clearTimeout(poll); }
  $("ga-x").addEventListener("click", zu);
  huelle.addEventListener("click", (e) => { if (e.target === huelle) zu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && offen()) zu(); });

  const STATUS = { offen: ["○", "wartet"], laeuft: ["✱", "läuft"], fertig: ["✓", "fertig"], fehler: ["✗", "nicht geklappt"], teilweise: ["◐", "teilweise"] };
  const fertigStatus = (s) => ["fertig", "teilweise", "fehler"].includes(s);

  function knoepfe(s) {
    const e = s.ergebnis;
    if (!e || s.status !== "fertig") return "";
    if (s.id === "drehbuch") return `<button type="button" class="chip" data-a="dok" data-v="${esc(e.dokument)}">📜 Drehbuch lesen</button>`;
    if (s.id === "film") return `<button type="button" class="chip" data-a="film">🎬 Im Schnitt-Team</button>`;
    if (s.id === "auto") return `<button type="button" class="chip" data-a="auto">🏎️ Auto im Studio ansehen</button>`;
    if (s.id === "webseite") return `<button type="button" class="chip" data-a="web" data-v="${esc(e.webseite)}">🌐 Seite ansehen</button>`;
    return "";
  }

  function zeichne(g) {
    aktuell = g;
    const fertig = fertigStatus(g.status);
    const karte = huelle.querySelector(".ga-karte");
    karte.classList.toggle("ub-gruen", g.status === "fertig");
    karte.classList.toggle("ub-rot", g.status === "fehler");
    $("ga-ring").classList.toggle("still", fertig);
    $("ga-titel").textContent = fertig ? (g.status === "fertig" ? "GROSSAUFTRAG FERTIG" : g.status === "teilweise" ? "GROSSAUFTRAG TEILWEISE FERTIG" : "GROSSAUFTRAG NICHT GEKLAPPT") : g.status === "wartet" ? "GROSSAUFTRAG WARTET" : "GROSSAUFTRAG LÄUFT";
    const titel = g.schritte.find((s) => s.ergebnis?.titel)?.ergebnis?.titel;
    $("ga-sub").textContent = titel ? `„${titel}“ · ${g.schritte.length} Teile` : `${g.schritte.length} Teile · Friday arbeitet sie der Reihe nach ab`;
    $("ga-prozent").textContent = `${g.prozent} %`;
    $("ga-fuell").style.width = `${g.prozent}%`;
    const film = g.schritte.find((s) => s.id === "film" && s.status === "fertig")?.ergebnis;
    $("ga-inhalt").innerHTML = `
      <p class="ga-auftrag">„${esc(g.text)}“</p>
      <ol class="ga-schritte">${g.schritte.map((s, i) => {
        const [sym, wort] = STATUS[s.status] || STATUS.offen;
        return `<li class="ga-s ga-${s.status}">
          <span class="ga-sym" aria-hidden="true">${sym}</span>
          <div class="ga-mitte"><b>${i + 1}. ${s.icon} ${esc(s.name)}</b> <small>· ${esc(s.werkstatt)} · ${wort}</small>
            ${s.text ? `<div class="ga-text">${esc(s.text)}</div>` : ""}
            ${s.status === "laeuft" ? `<div class="ga-mini"><i style="width:${Math.max(4, s.pct || 4)}%"></i></div>` : ""}
            ${s.id === "film" && film ? `<video class="ga-video" controls playsinline preload="metadata" poster="${esc(`${film.poster}?t=${encodeURIComponent(token())}`)}" src="${esc(`/api/archiv/datei/${film.datei}?t=${encodeURIComponent(token())}`)}"></video>` : ""}
            <div class="ga-knoepfe">${knoepfe(s)}</div>
          </div></li>`;
      }).join("")}</ol>
      ${g.bilanz ? `<div class="ga-bilanz">
          <h3>Bilanz</h3><p>${esc(g.bilanz.satz)}</p>
          ${g.bilanz.grenzen?.length ? `<h4>Ehrlich gesagt – die Grenzen</h4><ul>${g.bilanz.grenzen.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
          ${g.bilanz.vorschlag ? `<details class="ga-vorschlag"><summary>💡 ${esc(g.bilanz.vorschlag.titel)}</summary><p>${esc(g.bilanz.vorschlag.text)}</p></details>` : ""}
          ${g.status !== "fertig" ? `<button type="button" class="chip" data-a="nachholen">↻ Fehlendes nachholen</button>` : ""}
        </div>` : g.unbekannt?.length ? `<p class="ga-hinweis">Nicht zuordnen konnte ich: ${g.unbekannt.map((u) => `„${esc(u)}“`).join(", ")}. Das steht am Ende in der Bilanz.</p>` : ""}
      ${liste.length > 1 ? `<details class="ga-frueher"><summary>Frühere Großaufträge (${liste.length - 1})</summary><ul>${liste.filter((x) => x.id !== g.id).slice(0, 10).map((x) => `<li><button type="button" class="ghost small" data-a="zeige" data-v="${esc(x.id)}">${esc(new Date(x.erstellt).toLocaleDateString("de-DE"))} · ${esc(x.schritte.find((s) => s.ergebnis?.titel)?.ergebnis?.titel || x.text.slice(0, 50))} · ${esc((STATUS[x.status] || STATUS.offen)[1])}</button></li>`).join("")}</ul></details>` : ""}`;
    clearTimeout(poll);
    if (!fertig && offen()) poll = setTimeout(() => laden(g.id), 2500);
  }

  async function laden(id) {
    try {
      const r = await (await api("/api/grossauftraege")).json();
      liste = r.auftraege || [];
      const g = (id && liste.find((x) => x.id === id)) || liste[0];
      if (!g) { $("ga-inhalt").innerHTML = `<p class="muted">Noch kein Großauftrag. Schreib zum Beispiel in die Aufgaben: „Mach mir ein Drehbuch für einen Kurzfilm, dreh den Film, bau eine Webseite für die Premiere und ein passendes Auto zum Film.“</p>`; return; }
      zeichne(g);
    } catch { clearTimeout(poll); poll = setTimeout(() => laden(id), 5000); }
  }

  $("ga-inhalt").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-a]");
    if (!b || !aktuell) return;
    const a = b.dataset.a, v = b.dataset.v;
    if (a === "dok") window.FridayDokumente?.oeffne(v);
    else if (a === "film") { zu(); window.FridayStudio?.open({ tab: "videos" }); }
    else if (a === "web") { zu(); window.FridayWebseiten?.open(v); }
    else if (a === "zeige") laden(v);
    else if (a === "auto") {
      try {
        const r = await (await api(`/api/grossauftrag/${encodeURIComponent(aktuell.id)}/auto`, { method: "POST" })).json();
        if (r.ok && r.job) { zu(); window.FridayWerkstatt?.play(r.job); }
      } catch { /* egal */ }
    } else if (a === "nachholen") {
      await api(`/api/grossauftrag/${encodeURIComponent(aktuell.id)}/nachholen`, { method: "POST" });
      laden(aktuell.id);
    }
  });

  function open(id) { huelle.classList.remove("hidden"); laden(id || null); }
  document.getElementById("grossauftrag-open")?.addEventListener("click", () => open());
  window.FridayGrossauftrag = { open, offen };
})();
