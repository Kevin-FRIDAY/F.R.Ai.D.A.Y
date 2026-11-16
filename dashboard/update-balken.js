// F.R.Ai.D.A.Y Update-Ladebalken: zeigt beim Update, wie weit Friday ist
// (Herunterladen → Sicherung → Installieren → Neustart). Auch beim automatischen Update.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api;
  if (!api) return;

  // Schritte mit dem Prozentbereich, in dem sie liegen.
  const SCHRITTE = [
    { id: "laden", name: "Herunterladen", von: 3, bis: 28 },
    { id: "sichern", name: "Sicherung", von: 28, bis: 55 },
    { id: "installieren", name: "Installieren", von: 55, bis: 90 },
    { id: "neustart", name: "Neustart", von: 90, bis: 100 },
  ];
  const index = (id) => Math.max(0, SCHRITTE.findIndex((s) => s.id === id));
  // Ältere Update-Skripte melden nur Text: daraus den Schritt ableiten.
  function schrittAusText(msg = "") {
    const m = msg.toLowerCase();
    if (m.includes("installiert")) return { step: "neustart", percent: 90 };
    if (m.includes("installiere")) return { step: "installieren", percent: 60 };
    if (m.includes("sichere")) return { step: "sichern", percent: 30 };
    if (m.includes("lade")) return { step: "laden", percent: 10 };
    return { step: "laden", percent: 3 };
  }

  // ---------- Oberfläche ----------
  const box = document.createElement("div");
  box.id = "upd-bar";
  box.className = "upd-bar hidden";
  box.setAttribute("role", "status");
  box.setAttribute("aria-live", "polite");
  box.innerHTML = `
    <div class="ub-kopf">
      <span class="ub-ring"></span>
      <div class="ub-titel"><b id="ub-titel">SYSTEM-UPDATE</b><small id="ub-sub">Friday wird aktualisiert</small></div>
      <span class="ub-prozent" id="ub-prozent">0 %</span>
      <button class="ub-x" id="ub-x" title="Ausblenden (das Update läuft weiter)" aria-label="Ausblenden">×</button>
    </div>
    <div class="ub-spur"><div class="ub-fuell" id="ub-fuell"></div><div class="ub-glanz"></div></div>
    <ol class="ub-schritte" id="ub-schritte">${SCHRITTE.map((s, i) => `<li data-i="${i}"><span class="ub-punkt"></span>${s.name}</li>`).join("")}</ol>
    <div class="ub-text" id="ub-text">Update startet …</div>`;
  document.body.appendChild(box);

  let aktiv = false, ziel = "", von = "", manuell = false, auto = false, fertig = false, fehler = false;
  let gezeigt = 0, sollMin = 0, sollMax = 0, schrittIdx = 0, letzteMeldung = 0, offlineSeit = 0;
  let pollTimer = null, animTimer = null;

  function unterzeile() {
    const versionen = von && ziel ? `Version ${von} → ${ziel}` : ziel ? `auf Version ${ziel}` : "Friday wird aktualisiert";
    $("ub-sub").textContent = auto ? `${versionen} · automatisch` : versionen;
  }

  function zeichne() {
    const p = Math.round(gezeigt);
    $("ub-fuell").style.width = `${gezeigt}%`;
    $("ub-prozent").textContent = `${p} %`;
    box.querySelectorAll("#ub-schritte li").forEach((li) => {
      const i = Number(li.dataset.i);
      li.className = fertig || i < schrittIdx ? "fertig" : i === schrittIdx ? (fehler ? "fehler" : "aktiv") : "";
    });
  }

  // Der Balken kriecht innerhalb eines Schritts langsam weiter, damit man sieht, dass Friday arbeitet.
  function animiere() {
    if (!fehler) {
      if (gezeigt < sollMin) gezeigt += Math.max(0.6, (sollMin - gezeigt) * 0.2);
      else if (gezeigt < sollMax) gezeigt += (sollMax - gezeigt) * 0.012;
      gezeigt = Math.min(gezeigt, fertig ? 100 : sollMax);
    }
    zeichne();
  }

  function setze({ step, percent, text }) {
    const i = index(step);
    schrittIdx = Math.max(schrittIdx, i);
    const s = SCHRITTE[schrittIdx];
    sollMin = Math.max(sollMin, Math.min(Number(percent) || s.von, 99));
    sollMax = Math.max(sollMin, s.bis - 2);
    if (text) $("ub-text").textContent = text;
  }

  function zeige(info = {}) {
    if (!aktiv) {
      aktiv = true; fertig = false; fehler = false; manuell = false; auto = false; ziel = ""; von = "";
      gezeigt = 0; sollMin = 0; sollMax = 0; schrittIdx = 0; offlineSeit = 0;
      box.classList.remove("ub-rot", "ub-gruen", "ub-zu");
    }
    ziel = info.ziel || ziel; von = info.von || von;
    if (info.manuell) manuell = true;
    if (info.auto) auto = true;
    unterzeile();
    box.classList.remove("hidden");
    letzteMeldung = Date.now();
    clearInterval(animTimer); animTimer = setInterval(animiere, 120);
    clearInterval(pollTimer); pollTimer = setInterval(frage, 1500);
    frage();
  }

  function beende() {
    clearInterval(pollTimer); clearInterval(animTimer);
    pollTimer = animTimer = null;
  }

  function erfolg(version) {
    if (fertig) return;
    fertig = true; schrittIdx = SCHRITTE.length - 1; sollMin = sollMax = 100;
    box.classList.add("ub-gruen");
    $("ub-text").textContent = `Version ${version} läuft. ${manuell ? "Lade die Oberfläche neu …" : "Die Oberfläche lädt neu, sobald du fertig bist."}`;
    clearInterval(pollTimer); pollTimer = null;
    setTimeout(() => {
      beende(); gezeigt = 100; zeichne();
      if (manuell) location.reload();
      else setTimeout(() => box.classList.add("hidden"), 6000); // Neuladen übernimmt app.js, wenn nichts läuft
    }, 1600);
  }

  function misserfolg(text) {
    if (fehler) return;
    fehler = true;
    box.classList.add("ub-rot");
    $("ub-text").textContent = text || "Das Update hat nicht geklappt.";
    $("ub-prozent").textContent = "Fehler";
    beende(); zeichne();
    $("ub-prozent").textContent = "Fehler";
    aktiv = false;
    window.dispatchEvent(new CustomEvent("friday-update-ende", { detail: { ok: false, text } }));
  }

  async function frage() {
    let r;
    try {
      r = await (await api("/api/update/fortschritt")).json();
    } catch {
      // Während des Neustarts ist Friday kurz nicht erreichbar.
      if (!offlineSeit) offlineSeit = Date.now();
      if (schrittIdx >= 2) { setze({ step: "neustart", percent: 92, text: "Friday startet neu … gleich wieder da." }); }
      if (Date.now() - offlineSeit > 3 * 60000) misserfolg("Friday ist nach dem Update nicht wieder hochgekommen. Doppelklick auf „Friday starten.command“ im Ordner ~/Friday.");
      return;
    }
    offlineSeit = 0;
    const st = r.status || {};
    if (st.ziel && st.ziel !== ziel) { ziel = st.ziel; unterzeile(); }
    // Fertig: Die neue Version läuft wirklich (der Server meldet die neue Nummer).
    if ((ziel && r.installed === ziel) || (von && r.installed && r.installed !== von)) return erfolg(r.installed);
    if (st.state === "fehler") return misserfolg(st.message);
    const schritt = st.step && st.step !== "start" ? { step: st.step, percent: st.percent } : st.step === "start" ? { step: "laden", percent: 3 } : schrittAusText(st.message);
    setze({ ...schritt, text: st.state === "fertig" ? "Friday startet neu … gleich wieder da." : st.message });
    if (st.state === "laeuft" || st.state === "fertig") letzteMeldung = Date.now();
    if (Date.now() - letzteMeldung > 10 * 60000) misserfolg("Das Update dauert ungewöhnlich lange. Schau in ~/Library/Logs/Friday/update.log nach.");
  }

  $("ub-x").addEventListener("click", () => {
    box.classList.add("hidden");
    if (!pollTimer) { aktiv = false; beende(); }
  });

  // Automatisches Update (oder per Sprache gestartet): kommt über den normalen Status.
  window.addEventListener("friday-status", (e) => {
    const u = e.detail?.update;
    if (!u || aktiv) return;
    const frisch = Date.now() - new Date(u.time).getTime() < 10 * 60000;
    // "fertig" heißt: neue Version liegt bereit, Friday startet gerade neu.
    const neustart = u.state === "fertig" && u.ziel && u.ziel !== e.detail.version && Date.now() - new Date(u.time).getTime() < 3 * 60000;
    if ((u.state === "laeuft" && frisch) || neustart) zeige({ auto: u.auto, von: e.detail.version, ziel: u.ziel });
  });

  window.FridayUpdate = {
    // Vom Update-Knopf: sofort anzeigen.
    start: (info) => zeige({ ...info, manuell: true }),
    aktiv: () => aktiv,
  };
})();
