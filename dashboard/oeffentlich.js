// F.R.Ai.D.A.Y – Öffentliche Daten (v1.166.0)
// Kacheln für alle offenen Datenquellen (NINA, Pegel, Autobahn, Rückrufe, Strom, Ferien, Jobs, NASA, Wikipedia,
// Eurostat, EZB …). Klick → Live-Abruf mit Ergebnis-Liste, Bild, Verlauf und Vorlesen.
// Öffnen: Werkzeug-Menü → Welt → Öffentliche Daten, „Friday, öffne die öffentlichen Daten“, oder Aktionen
//   daten | daten:<id>:<eingabe> | oeffentliche_daten (Claude hat eine Quelle abgefragt)
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  // Nur echte Web-Adressen aus fremden Daten übernehmen (kein javascript: o. Ä.).
  const url = (u) => (/^https?:\/\//i.test(String(u || "")) ? esc(u) : "");
  let katalog = null, gruppe = "Alle", aktiv = null, zaehler = 0;

  const f = H.fenster({
    id: "oeffentlich", titel: "🛰️ Öffentliche Daten", klasse: "od-box",
    html: `
      <div id="od-liste">
        <p class="hf-hinweis" id="od-unter">Lädt …</p>
        <div id="od-gruppen" class="hf-tabs" role="tablist"></div>
        <div id="od-kacheln" class="od-kacheln"></div>
      </div>
      <div id="od-detail" class="hidden"></div>
      <div id="od-status" class="hf-status"></div>`,
    onOpen: (o = {}) => start(o),
  });
  const $ = (s) => f.$(s);
  const status = (t = "", fehler = false) => { const s = $("#od-status"); s.textContent = t; s.classList.toggle("fehler", fehler); };

  async function start(o = {}) {
    status("");
    try { if (!katalog) katalog = await json("/api/daten"); } catch (err) { status(err.message || String(err), true); return; }
    if (o.id) return zeige(o.id, o.eingabe || "", o.ergebnis);
    liste();
  }

  function liste() {
    aktiv = null;
    $("#od-detail").classList.add("hidden");
    $("#od-liste").classList.remove("hidden");
    $("#od-unter").innerHTML = `${katalog.anzahl} offene Datenquellen von Ämtern, Bund, EU, NASA und Wikipedia – live, kostenlos, <b>ohne Guthaben</b>. Alles geht auch per Sprache, z. B. „Friday, wie hoch steht der Rhein?“`;
    const gr = ["Alle", ...katalog.gruppen];
    $("#od-gruppen").innerHTML = gr.map((g) => `<button type="button" class="hf-tab${g === gruppe ? " an" : ""}" data-g="${esc(g)}">${esc(g)}</button>`).join("");
    const l = katalog.quellen.filter((q) => gruppe === "Alle" || q.gruppe === gruppe);
    $("#od-kacheln").innerHTML = l.map((q) => `
      <button type="button" class="od-kachel" data-id="${esc(q.id)}">
        <span class="od-icon">${esc(q.icon)}</span>
        <span class="od-k-text"><b>${esc(q.titel)}</b><small>${esc(q.info)}</small><em>${esc(q.quelle)}</em></span>
      </button>`).join("");
  }
  $("#od-gruppen").addEventListener("click", (e) => { const b = e.target.closest("[data-g]"); if (b) { gruppe = b.dataset.g; liste(); } });
  $("#od-kacheln").addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) zeige(b.dataset.id, ""); });

  function zeige(id, eingabe = "", ergebnis = null) {
    const q = katalog.quellen.find((x) => x.id === id);
    if (!q) return liste();
    aktiv = q;
    $("#od-liste").classList.add("hidden");
    const d = $("#od-detail");
    d.classList.remove("hidden");
    d.innerHTML = `
      <div class="hf-reihe od-kopf"><button type="button" class="hf-mini" id="od-zurueck">← Alle Quellen</button><span class="od-titel">${esc(q.icon)} ${esc(q.titel)}</span></div>
      ${q.eingabe ? `<form class="hf-reihe od-form" id="od-form"><input id="od-eingabe" class="hf-input grow" type="search" autocomplete="off" placeholder="${esc(q.eingabe.platzhalter)}" value="${esc(eingabe)}"><button class="hf-btn haupt" type="submit">Abrufen</button></form>` : `<div class="hf-reihe"><button class="hf-btn" type="button" id="od-neu">↻ Neu laden</button></div>`}
      <div id="od-ergebnis" class="od-ergebnis"></div>`;
    d.querySelector("#od-zurueck").addEventListener("click", liste);
    d.querySelector("#od-form")?.addEventListener("submit", (e) => { e.preventDefault(); abrufen(q, d.querySelector("#od-eingabe").value.trim()); });
    d.querySelector("#od-neu")?.addEventListener("click", () => abrufen(q, ""));
    if (ergebnis) zeichne(ergebnis);
    else if (!q.eingabe?.pflicht || eingabe) abrufen(q, eingabe);
    else setTimeout(() => d.querySelector("#od-eingabe")?.focus(), 60);
  }

  async function abrufen(q, eingabe) {
    const nr = ++zaehler;
    const box = $("#od-ergebnis");
    if (!box) return;
    box.innerHTML = `<div class="od-laedt"><i></i><i></i><i></i> ${esc(q.quelle)} wird abgefragt …</div>`;
    status("");
    try {
      const r = await json(`/api/daten/${encodeURIComponent(q.id)}?q=${encodeURIComponent(eingabe)}`);
      if (nr !== zaehler || aktiv?.id !== q.id) return;
      zeichne(r);
    } catch (err) {
      if (nr === zaehler) box.innerHTML = `<p class="od-fehler">${esc(err.message || String(err))}</p>`;
    }
  }

  // Kleiner Verlauf als Linie (z. B. Inflation der letzten 13 Monate).
  function verlauf(p = []) {
    if (p.length < 2) return "";
    const ys = p.map((x) => Number(x.y));
    const min = Math.min(...ys), max = Math.max(...ys), sp = max - min || 1;
    const W = 600, Hh = 110;
    const pts = ys.map((y, i) => `${(i / (ys.length - 1)) * W},${Hh - 10 - ((y - min) / sp) * (Hh - 24)}`).join(" ");
    return `<svg class="od-verlauf" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${pts}" fill="none" stroke="var(--cyan)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
      </svg><div class="od-achse"><span>${esc(p[0].x)}</span><span>${esc(p[p.length - 1].x)}</span></div>`;
  }

  function zeichne(r) {
    const box = $("#od-ergebnis");
    if (!box) return;
    if (!r.ok) { box.innerHTML = `<p class="od-fehler">${esc(r.text || r.error || "Fehler")}</p>`; return; }
    const zeilen = (r.zeilen || []).map((z) => {
      const inhalt = `
        <span class="od-punkt" style="--c:${esc(z.farbe || "var(--cyan)")}"></span>
        ${url(z.bild) ? `<img class="od-mini" src="${url(z.bild)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}
        <span class="name"><b>${esc(z.titel || "")}</b>${z.unter ? `<span class="klein">${esc(z.unter)}</span>` : ""}
          ${Number.isFinite(z.balken) ? `<span class="hf-balken"><i style="width:${Math.max(2, Math.min(100, z.balken))}%"></i></span>` : ""}</span>
        ${z.wert ? `<span class="od-wert">${esc(z.wert)}</span>` : ""}`;
      return url(z.link) ? `<li><a class="hf-zeile od-zeile" href="${url(z.link)}" target="_blank" rel="noopener">${inhalt}</a></li>` : `<li class="hf-zeile od-zeile">${inhalt}</li>`;
    }).join("");
    box.innerHTML = `
      <div class="od-satz"><p>${esc(r.text || "")}</p><button type="button" class="hf-mini" id="od-vorlesen" title="Vorlesen">🔊</button></div>
      ${url(r.bild) ? `<a href="${url(r.bildGross) || url(r.bild)}" target="_blank" rel="noopener"><img class="od-bild" src="${url(r.bild)}" alt="" referrerpolicy="no-referrer"></a>` : ""}
      ${r.verlauf ? verlauf(r.verlauf) : ""}
      ${zeilen ? `<ul class="hf-liste od-liste">${zeilen}</ul>` : ""}
      <p class="hf-hinweis od-quelle">Quelle: <a href="${url(r.link) || "#"}" target="_blank" rel="noopener">${esc(r.quelle || "")}</a> · abgerufen ${new Date(r.abgerufen || Date.now()).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr</p>`;
    box.querySelector("#od-vorlesen").addEventListener("click", () => window.Friday?.say?.(r.text || ""));
  }

  // ---------- Von außen (Sprache, Claude) ----------
  async function vonAussen(actions = []) {
    const a = actions.find((x) => typeof x === "string" && x.startsWith("daten:"));
    if (a) {
      const [, id, ...rest] = a.split(":");
      let eingabe = "";
      try { eingabe = decodeURIComponent(rest.join(":")); } catch { /* egal */ }
      f.auf({ id, eingabe });
      return;
    }
    if (actions.includes("daten")) { gruppe = "Alle"; f.auf(); return; }
    if (actions.includes("oeffentliche_daten")) {
      try {
        const { letzter } = await json("/api/daten/letzter");
        if (letzter && Date.now() - letzter.at < 120000) f.auf({ id: letzter.id, eingabe: letzter.eingabe });
      } catch { /* egal */ }
    }
  }
  window.FridayDaten = { open: (o) => f.auf(o), vonAussen };

  const style = document.createElement("style");
  style.textContent = `
.od-box { width: min(1100px, 100%); }
.od-kacheln { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; margin-top: 10px; }
.od-kachel { display: flex; gap: 12px; align-items: flex-start; text-align: left; border: 1px solid var(--u-rand-soft, var(--line)); background: linear-gradient(160deg, rgba(255,140,30,.08), rgba(0,0,0,.25)); color: var(--text); border-radius: 14px; padding: 12px; font: inherit; cursor: pointer; transition: border-color .2s, box-shadow .2s, transform .2s; }
.od-kachel:hover, .od-kachel:focus-visible { border-color: var(--cyan); box-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 30%, transparent); transform: translateY(-1px); outline: 0; }
.od-icon { font-size: 26px; line-height: 1; flex: none; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--cyan) 45%, transparent)); }
.od-k-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.od-k-text b { font-size: 14.5px; }
.od-k-text small { font-size: 12.5px; color: var(--muted); line-height: 1.35; }
.od-k-text em { font-size: 11px; font-style: normal; color: var(--u-titel, var(--cyan)); opacity: .85; letter-spacing: .03em; }
.od-kopf { margin-bottom: 10px; }
.od-titel { font-size: 17px; font-weight: 700; color: var(--u-titel, var(--cyan)); }
.od-form { margin-bottom: 10px; }
.od-ergebnis { margin-top: 10px; }
.od-satz { display: flex; gap: 10px; align-items: flex-start; border-left: 3px solid var(--cyan); padding: 4px 0 4px 12px; margin-bottom: 12px; }
.od-satz p { margin: 0; font-size: 17px; line-height: 1.5; flex: 1; }
.od-bild { display: block; max-width: 100%; max-height: 420px; border-radius: 12px; margin: 0 0 12px; border: 1px solid var(--u-rand-soft, var(--line)); box-shadow: 0 0 24px rgba(0,0,0,.5); }
.od-liste a.od-zeile { color: inherit; text-decoration: none; }
.od-liste a.od-zeile:hover { border-color: var(--cyan); }
.od-zeile .name { display: flex; flex-direction: column; gap: 3px; }
.od-zeile .hf-balken { margin-top: 3px; }
.od-punkt { width: 10px; height: 10px; border-radius: 50%; flex: none; background: var(--c); box-shadow: 0 0 8px var(--c); }
.od-mini { width: 40px; height: 40px; object-fit: cover; border-radius: 8px; flex: none; }
.od-wert { font-weight: 700; white-space: nowrap; color: var(--text); font-variant-numeric: tabular-nums; }
.od-verlauf { width: 100%; height: 110px; display: block; background: rgba(0,0,0,.25); border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 10px; }
.od-achse { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin: 3px 2px 12px; }
.od-quelle { margin-top: 12px; }
.od-quelle a { color: var(--cyan); }
.od-fehler { color: #ffb4a8; }
.od-laedt { color: var(--muted); font-size: 14px; display: flex; align-items: center; gap: 5px; padding: 12px 0; }
.od-laedt i { width: 7px; height: 7px; border-radius: 50%; background: var(--cyan); animation: od-puls 1s infinite ease-in-out; }
.od-laedt i:nth-child(2) { animation-delay: .15s; } .od-laedt i:nth-child(3) { animation-delay: .3s; margin-right: 6px; }
@keyframes od-puls { 0%, 100% { opacity: .25; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.1); } }
@media (max-width: 900px) {
  .od-kacheln { grid-template-columns: 1fr; }
  .od-satz p { font-size: 16px; }
  .od-zeile .od-wert { margin-left: auto; }
}`;
  document.head.appendChild(style);
})();
