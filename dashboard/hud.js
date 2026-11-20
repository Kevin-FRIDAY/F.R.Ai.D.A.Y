// HUD-Extras: Start-Sequenz, Befehls-Vorschläge, Live-Countdowns für Timer/Erinnerungen mit Alarm, Sprach-Wellen.
// Alles läuft ohne Claude.
(() => {
  const F = window.Friday || {};
  const $ = (id) => document.getElementById(id);
  const esc = F.escapeHtml || ((s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const ruhig = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const angemeldet = () => !$("app")?.classList.contains("hidden");
  const session = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* egal */ } },
  };

  // ---------- 1. Start-Sequenz (einmal pro Sitzung) ----------
  function bootSequenz() {
    if (ruhig || session.get("friday_boot")) return;
    session.set("friday_boot", "1");
    const zeilen = ["Kern wird hochgefahren", "Stimmmodul bereit", "Offline-Gehirn geladen", "Lagezentrum verbunden", "Alle Systeme online"];
    const el = document.createElement("div");
    el.className = "boot";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `
      <div class="boot-core">
        <svg viewBox="0 0 200 200">
          <circle class="b-ring b1" cx="100" cy="100" r="92"/>
          <circle class="b-ring b2" cx="100" cy="100" r="74"/>
          <circle class="b-ring b3" cx="100" cy="100" r="56"/>
          <circle class="b-tick" cx="100" cy="100" r="84"/>
        </svg>
        <div class="boot-logo">F</div>
      </div>
      <div class="boot-name">F.R.Ai.D.A.Y</div>
      <ul class="boot-lines">${zeilen.map((z, i) => `<li style="--d:${0.25 + i * 0.32}s"><span>${esc(z)}</span><b>OK</b></li>`).join("")}</ul>
      <div class="boot-bar"><i></i></div>`;
    document.body.append(el);
    const weg = () => { el.classList.add("out"); setTimeout(() => el.remove(), 600); };
    el.addEventListener("click", weg);
    // Erst ausblenden, wenn der Ladebalken wirklich durchgelaufen ist (der Browser kann beim Start kurz hängen).
    el.querySelector(".boot-bar i").addEventListener("animationend", () => setTimeout(weg, 350));
    setTimeout(weg, 7000);
  }
  const appEl = $("app");
  if (appEl) {
    if (angemeldet()) bootSequenz();
    new MutationObserver(() => { if (angemeldet()) { bootSequenz(); start(); } }).observe(appEl, { attributes: true, attributeFilter: ["class"] });
  }

  // ---------- 2. Befehls-Vorschläge unter dem Eingabefeld ----------
  const VORSCHLAEGE = [
    "Wie spät ist es?", "Wie wird das Wetter morgen?", "Timer 5 Minuten", "Was kostet Bitcoin?", "Was ist in der Welt los?",
    "Was steht auf der Einkaufsliste?", "Was kannst du?", "Wann ist der nächste Feiertag?", "100 Euro in Dollar", "Zeig mir USA", "Erzähl mir was über Japan", "Wo ist die ISS?",
    "Erzähl mir einen Witz", "Brauche ich einen Schirm?", "Welche Erinnerungen habe ich?", "Was ist 15 Prozent von 80?",
    "Wie spät ist es in Tokio?", "10 km in Meilen", "Wie viele Tage bis Weihnachten?", "Mondphase", "Wann geht die Sonne unter?", "Motivier mich", "Wie geht es dem Mac?", "Trinkgeld für 40 Euro",
  ];
  function chipsZeigen() {
    const state = $("state");
    if (!state || $("cmd-chips")) return;
    const box = document.createElement("div");
    box.id = "cmd-chips";
    box.className = "cmd-chips";
    box.setAttribute("aria-label", "Vorschläge");
    const feste = VORSCHLAEGE.slice(0, 3);
    const rest = VORSCHLAEGE.slice(3).sort(() => Math.random() - 0.5).slice(0, 3);
    [...feste, ...rest].forEach((t, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cmd-chip";
      b.style.setProperty("--i", i);
      b.textContent = t;
      b.addEventListener("click", () => window.Friday?.send?.(t));
      box.append(b);
    });
    state.after(box);
  }

  // ---------- 3. Live-Countdowns + Alarm ----------
  let liste = [];
  const gemeldet = new Set();
  const vorher = new Set(); // nur melden, was wir noch laufen gesehen haben (kein Alarm beim Öffnen der Seite)
  const TIMER = /^Timer: /;
  async function ladeErinnerungen() {
    if (!angemeldet() || !F.api) return;
    try {
      const r = await F.api("/api/reminders");
      const neu = await r.json();
      if (!Array.isArray(neu)) return;
      // Was der Server schon erledigt hat, während wir offen sind, wird trotzdem gemeldet (über die Zeit).
      const ids = new Set(neu.map((x) => x.id));
      for (const x of neu) if (Date.parse(x.due) > Date.now()) vorher.add(x.id);
      liste = [...neu, ...liste.filter((x) => !ids.has(x.id) && !gemeldet.has(x.id) && Date.parse(x.due) > Date.now() - 120000)];
      zeichne();
    } catch { /* still */ }
  }
  function startZeit(r) {
    const n = parseInt(r.id, 36);
    return Number.isFinite(n) && n > 1.6e12 && n < Date.parse(r.due) ? n : Date.parse(r.due) - 3600000;
  }
  function restText(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sek = s % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(sek).padStart(2, "0")}` : `${m}:${String(sek).padStart(2, "0")}`;
  }
  function leiste() {
    let el = $("countdowns");
    if (!el) {
      const ziel = $("cmd-chips") || $("state");
      if (!ziel) return null;
      el = document.createElement("div");
      el.id = "countdowns";
      el.className = "countdowns";
      ziel.after(el);
      el.addEventListener("click", async (e) => {
        const x = e.target.closest("[data-weg]");
        if (!x) return;
        const id = x.dataset.weg;
        liste = liste.filter((r) => r.id !== id);
        gemeldet.add(id);
        zeichne();
        try { await F.api(`/api/reminders/${encodeURIComponent(id)}`, { method: "DELETE" }); } catch { /* egal */ }
      });
    }
    return el;
  }
  function zeichne() {
    const el = leiste();
    if (!el) return;
    const jetzt = Date.now();
    const bald = liste.filter((r) => !gemeldet.has(r.id) && Date.parse(r.due) - jetzt < 3 * 3600000)
      .sort((a, b) => Date.parse(a.due) - Date.parse(b.due)).slice(0, 3);
    el.innerHTML = bald.map((r) => {
      const due = Date.parse(r.due), start = startZeit(r);
      const anteil = Math.min(1, Math.max(0, (jetzt - start) / Math.max(1, due - start)));
      const timer = TIMER.test(r.text);
      const titel = timer ? r.text.replace(TIMER, "").replace(/ sind um$/, "") : r.text;
      return `<div class="cd ${timer ? "cd-timer" : ""}" data-id="${esc(r.id)}">
        <svg viewBox="0 0 36 36" class="cd-ring"><circle cx="18" cy="18" r="15.5" class="cd-bg"/><circle cx="18" cy="18" r="15.5" class="cd-fg" style="stroke-dashoffset:${(97.4 * anteil).toFixed(1)}"/></svg>
        <div class="cd-txt"><b>${restText(due - jetzt)}</b><small>${timer ? "Timer · " : ""}${esc(titel)}</small></div>
        <button type="button" class="cd-x" data-weg="${esc(r.id)}" title="Abbrechen" aria-label="Abbrechen">×</button>
      </div>`;
    }).join("");
    for (const r of liste) {
      if (!gemeldet.has(r.id) && Date.parse(r.due) <= jetzt) {
        gemeldet.add(r.id);
        if (vorher.has(r.id) && jetzt - Date.parse(r.due) < 120000) alarm(r);
      }
    }
  }

  let ton = null;
  function piepen() {
    let laut = 0.6;
    try {
      if (localStorage.getItem("friday_toene") === "0") return;
      laut = Number(localStorage.getItem("friday_tonlaut") ?? 0.6) || 0.6;
    } catch { /* egal */ }
    try {
      ton = ton || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = ton.currentTime;
      [0, 0.22, 0.44, 1.1, 1.32, 1.54].forEach((d, i) => {
        const o = ton.createOscillator(), g = ton.createGain();
        o.type = "sine";
        o.frequency.value = i % 3 === 2 ? 1320 : 880;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(Math.max(0.01, 0.3 * laut), t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
        o.connect(g).connect(ton.destination);
        o.start(t0 + d); o.stop(t0 + d + 0.2);
      });
    } catch { /* ohne Ton */ }
  }
  function alarm(r) {
    const timer = TIMER.test(r.text);
    const titel = timer ? "Timer abgelaufen" : "Erinnerung";
    const text = timer ? r.text.replace(TIMER, "").replace(/ sind um$/, "") + " sind um." : r.text;
    $("alarm-pop")?.remove();
    const el = document.createElement("div");
    el.id = "alarm-pop";
    el.className = "alarm-pop";
    el.setAttribute("role", "alertdialog");
    el.innerHTML = `<div class="alarm-box">
      <div class="alarm-ring"><span></span><span></span><span></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${timer ? '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>' : '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'}</svg></div>
      <h3>${esc(titel)}</h3><p>${esc(text)}</p>
      <button type="button" class="chip alarm-ok">Okay</button></div>`;
    document.body.append(el);
    const zu = () => { el.classList.add("out"); setTimeout(() => el.remove(), 350); };
    el.querySelector(".alarm-ok").addEventListener("click", zu);
    el.addEventListener("click", (e) => { if (e.target === el) zu(); });
    piepen();
    setTimeout(() => (F.sagVonSelbst || F.say)?.(timer ? `Boss, dein Timer ist abgelaufen. ${text}` : `Boss, ich soll dich erinnern: ${text}`, { quelle: "alarm", stufe: "warn", dauer: 5 * 60000 }), 1700); // Ton + Fenster immer, Stimme nur wenn erlaubt
    setTimeout(zu, 60000);
  }

  // ---------- 4. Sprach-Wellen am Gesicht ----------
  function wellen() {
    const r = $("reactor");
    if (!r || r.querySelector(".voice-wave")) return;
    const w = document.createElement("span");
    w.className = "voice-wave";
    w.setAttribute("aria-hidden", "true");
    w.innerHTML = Array.from({ length: 21 }, (_, i) => `<i style="--k:${(Math.sin(i * 1.7) * 0.5 + 0.5).toFixed(2)};--n:${i}"></i>`).join("");
    r.append(w);
  }

  // ---------- Start ----------
  let gestartet = false;
  function start() {
    if (gestartet || !angemeldet()) return;
    gestartet = true;
    // v1.98.0: Befehls-Vorschläge unter dem Eingabefeld entfernt (Kevins Wunsch).
    wellen();
    ladeErinnerungen();
    setInterval(ladeErinnerungen, 15000);
    setInterval(() => { if (liste.length) zeichne(); }, 1000);
  }
  // Neue Timer sofort zeigen, wenn Friday einen gestellt hat.
  window.FridayHud = { refresh: ladeErinnerungen };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
