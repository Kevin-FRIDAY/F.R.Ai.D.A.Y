// F.R.Ai.D.A.Y Welt-Runde (v1.116.0): "Friday, zeig mir, was in der Welt passiert."
// Friday fliegt auf dem Globus nacheinander zu den Weltmächten, zeigt dort Videos + Bilder (wie beim Antippen
// eines Landes) und liest die Top-Nachrichten vor. Ohne Claude-Guthaben.
// Steuerung: Knöpfe unten oder per Sprache "Friday, weiter" / "zurück" / "stopp".
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = () => window.Friday || {};
  const api = (p, o) => (F().api || fetch)(p, o);
  const esc = (s) => (F().escapeHtml || ((x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))))(s);
  const warte = (ms) => new Promise((r) => setTimeout(r, ms));

  let tour = null;      // { stationen, i }
  let lauf = 0;         // jede Navigation startet einen neuen Lauf; alte Läufe hören dann auf
  let pause = false;

  function stimmeAn() { return Boolean($("voice-toggle")?.checked); }

  // Vorlesen. Ohne Stimme (oder wenn das Vorlesen sofort fertig ist) bleibt Zeit zum Mitlesen.
  async function sprich(text, nr) {
    const start = Date.now();
    if (stimmeAn() && F().say) await F().say(text);
    if (nr !== lauf) return false;
    if (F().unterbrochen?.()) { setzePause(true); return false; }
    const lesen = Math.min(20000, Math.max(5000, text.split(/\s+/).length * 330));
    const rest = lesen - (Date.now() - start);
    if (rest > 0 && (!stimmeAn() || Date.now() - start < 1500)) await warte(rest);
    return nr === lauf;
  }

  function leiste() {
    let el = $("welttour");
    if (el) return el;
    el = document.createElement("div");
    el.id = "welttour"; el.className = "welttour";
    el.setAttribute("role", "region"); el.setAttribute("aria-label", "Welt-Runde");
    el.innerHTML = `<div class="wt-kopf"><span class="wt-titel">🌍 Was in der Welt passiert</span><span class="wt-punkte" id="wt-punkte"></span></div>
      <div class="wt-land" id="wt-land">Nachrichten werden geladen …</div>
      <ol class="wt-news" id="wt-news"></ol>
      <div class="wt-knoepfe">
        <button type="button" class="chip" data-a="zurueck" title="Vorheriges Land">⏮ Zurück</button>
        <button type="button" class="chip" data-a="pause" id="wt-pause" title="Anhalten / Weiter">⏸ Pause</button>
        <button type="button" class="chip wt-haupt" data-a="weiter" title="Nächstes Land">Weiter ⏭</button>
        <button type="button" class="chip" data-a="stopp" title="Welt-Runde beenden">✕ Stopp</button>
      </div>`;
    el.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "weiter") weiter();
      else if (a === "zurueck") zurueck();
      else if (a === "stopp") stopp();
      else if (a === "pause") setzePause(!pause);
      const p = e.target.closest("[data-i]");
      if (p) gehe(Number(p.dataset.i));
    });
    ($("lage") || document.body).append(el);
    return el;
  }

  function zeige(i) {
    const s = tour.stationen[i];
    $("wt-punkte").innerHTML = tour.stationen.map((x, k) => `<button type="button" class="wt-punkt${k === i ? " an" : ""}${k < i ? " fertig" : ""}" data-i="${k}" title="${esc(x.name)}">${esc(x.flag || "●")}</button>`).join("");
    $("wt-land").innerHTML = `<b>${esc(s.flag)} ${esc(s.name)}</b> <small>${esc(s.rolle)} · ${i + 1} von ${tour.stationen.length}</small>`;
    $("wt-news").innerHTML = s.schlagzeilen.length
      ? s.schlagzeilen.map((n) => `<li>${/^https:\/\//.test(n.link) ? `<a href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">${esc(n.titel)}</a>` : esc(n.titel)}</li>`).join("")
      : `<li class="muted">Gerade keine großen Meldungen.</li>`;
  }

  function setzePause(an) {
    pause = an;
    const b = $("wt-pause");
    if (b) b.textContent = an ? "▶ Weiter vorlesen" : "⏸ Pause";
    $("welttour")?.classList.toggle("pausiert", an);
    if (an) F().stopSpeaking?.();
    else if (tour) gehe(tour.i);
  }

  async function gehe(i) {
    if (!tour) return;
    if (i < 0) i = 0;
    const nr = ++lauf;
    F().stopSpeaking?.();
    if (i >= tour.stationen.length) { ende(nr); return; }
    tour.i = i;
    pause = false; setzePauseKnopf();
    zeige(i);
    const s = tour.stationen[i];
    window.FridayLage?.showCountry(s.id, { stumm: true });
    await warte(1300); // Globus fliegt hin
    if (nr !== lauf) return;
    if (!(await sprich(s.text, nr))) return;
    await warte(1800);
    if (nr !== lauf || pause) return;
    gehe(i + 1);
  }
  function setzePauseKnopf() { const b = $("wt-pause"); if (b) b.textContent = "⏸ Pause"; $("welttour")?.classList.remove("pausiert"); }

  async function ende(nr) {
    await sprich("Das war die Welt-Runde, Boss. Tippe auf ein Land, wenn du mehr wissen willst.", nr);
    if (nr === lauf) aufraeumen();
  }
  function aufraeumen() {
    tour = null; lauf++;
    $("welttour")?.remove();
    api("/api/welttour/ende", { method: "POST" }).catch(() => {});
  }

  let startZeit = 0;
  async function start() {
    // Derselbe Befehl kommt doppelt an (z. B. Echo vom Mikrofon): laufende Runde nicht neu starten.
    if (Date.now() - startZeit < 10000 && (tour || $("welttour"))) return;
    startZeit = Date.now();
    const nr = ++lauf;
    F().stopSpeaking?.();
    pause = false;
    if (!window.FridayLage?.offen()) window.FridayLage?.open({ stumm: true });
    leiste();
    $("wt-land").textContent = "Nachrichten der Weltmächte werden geladen …";
    $("wt-news").innerHTML = ""; $("wt-punkte").innerHTML = "";
    // Sofort etwas sagen, während die Nachrichten aus sechs Ländern geladen werden (kann ein paar Sekunden dauern).
    const moment = stimmeAn() && F().say ? F().say("Einen Moment, Boss. Ich hole die Nachrichten der Weltmächte.").catch(() => {}) : Promise.resolve();
    let daten = null;
    try {
      const r = await api("/api/welttour");
      if (!r.ok) throw new Error("Server");
      daten = await r.json();
    } catch {
      if (nr !== lauf) return;
      $("wt-land").textContent = "Die Nachrichten kann ich gerade nicht laden.";
      await sprich("Die Weltnachrichten kann ich gerade nicht abrufen. Versuch es gleich nochmal.", nr);
      if (nr === lauf) aufraeumen();
      return;
    }
    await moment;
    if (nr !== lauf) return;
    if (!daten?.stationen?.length) {
      $("wt-land").textContent = "Gerade kamen keine Nachrichten an.";
      await sprich("Gerade kommen keine Weltnachrichten an. Versuch es gleich nochmal.", nr);
      if (nr === lauf) aufraeumen();
      return;
    }
    tour = { stationen: daten.stationen, i: 0 };
    zeige(0);
    const namen = daten.stationen.map((s) => s.name.replace("Vereinigte Staaten", "USA").replace("Vereinigtes Königreich", "Großbritannien"));
    if (!(await sprich(`Hier ist, was gerade in der Welt passiert. Ich reise für dich zu ${namen.slice(0, -1).join(", ")} und ${namen.at(-1)}.`, nr))) return;
    gehe(0);
  }

  const weiter = () => { if (tour) gehe(tour.i + 1); };
  const zurueck = () => { if (tour) gehe(tour.i - 1); };
  function stopp() { if (!tour && !$("welttour")) return; F().stopSpeaking?.(); aufraeumen(); }

  window.addEventListener("friday-lage", (e) => { if (e.detail && e.detail.offen === false && tour) stopp(); });
  document.addEventListener("keydown", (e) => {
    if (!tour || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "")) return;
    if (e.key === "ArrowRight") weiter();
    else if (e.key === "ArrowLeft") zurueck();
  });

  window.FridayWelttour = { start, weiter, zurueck, stopp, aktiv: () => Boolean(tour) };
})();
