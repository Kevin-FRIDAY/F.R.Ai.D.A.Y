// F.R.Ai.D.A.Y Arbeits-Balken: zeigt im Stil des Update-Balkens, wie weit Friday mit einem Auftrag ist
// (Verstehen → Arbeiten → Erstellen → Fertig). Erscheint nur, wenn es länger als einen Augenblick dauert.
(() => {
  "use strict";
  const F = window.Friday || {};
  const api = F.api;
  if (!api) return;

  const SCHRITTE = [
    { id: "verstehen", name: "Verstehen", bis: 25 },
    { id: "arbeiten", name: "Arbeiten", bis: 70 },
    { id: "erstellen", name: "Erstellen", bis: 95 },
    { id: "fertig", name: "Fertig", bis: 100 },
  ];
  const box = document.createElement("div");
  box.id = "auftrag-bar";
  box.className = "upd-bar ab-bar hidden";
  box.setAttribute("role", "status");
  box.setAttribute("aria-live", "polite");
  box.innerHTML = `
    <div class="ub-kopf">
      <span class="ub-ring"></span>
      <div class="ub-titel"><b>AUFTRAG LÄUFT</b><small id="ab-sub">Friday arbeitet</small></div>
      <span class="ub-prozent" id="ab-prozent">0 %</span>
    </div>
    <div class="ub-spur"><div class="ub-fuell" id="ab-fuell"></div><div class="ub-glanz"></div></div>
    <ol class="ub-schritte" id="ab-schritte">${SCHRITTE.map((s, i) => `<li data-i="${i}"><span class="ub-punkt"></span>${s.name}</li>`).join("")}</ol>`;
  document.body.appendChild(box);
  const $ = (id) => document.getElementById(id);

  let aktiv = false, gezeigt = 0, ziel = 0, schritt = 0, beginn = 0, zeigTimer = null, anim = null, poll = null, nr = 0;

  function zeichne() {
    $("ab-fuell").style.width = `${gezeigt}%`;
    $("ab-prozent").textContent = `${Math.round(gezeigt)} %`;
    box.querySelectorAll("#ab-schritte li").forEach((li) => {
      const i = Number(li.dataset.i);
      li.className = i < schritt || (schritt === 3 && i === 3) ? "fertig" : i === schritt ? "aktiv" : "";
    });
  }
  function animiere() {
    // Langsam weiterkriechen, damit man sieht, dass Friday arbeitet (wie beim Update).
    const decke = SCHRITTE[schritt].bis - 2;
    if (gezeigt < ziel) gezeigt += Math.max(0.8, (ziel - gezeigt) * 0.25);
    else if (gezeigt < decke) gezeigt += (decke - gezeigt) * 0.015;
    gezeigt = Math.min(gezeigt, schritt === 3 ? 100 : decke);
    zeichne();
  }
  async function frage() {
    try {
      const r = await (await api("/api/auftrag/fortschritt?kanal=web")).json();
      if (!aktiv || !r.schritt) return;
      const i = SCHRITTE.findIndex((s) => s.id === r.schritt);
      if (i >= 0 && i < 3) { schritt = Math.max(schritt, i); ziel = Math.max(ziel, r.prozent || 0); }
      if (r.text && i < 3) $("ab-sub").textContent = r.text;
    } catch { /* egal */ }
  }

  function start() {
    const meine = ++nr;
    aktiv = true; gezeigt = 0; ziel = 5; schritt = 0; beginn = Date.now();
    box.classList.remove("ub-gruen", "ub-rot");
    $("ab-sub").textContent = "Friday liest den Auftrag …";
    clearTimeout(zeigTimer);
    // Schnelle Antworten (unter 0,7 s) brauchen keinen Balken.
    zeigTimer = setTimeout(() => {
      if (!aktiv || meine !== nr) return;
      box.classList.remove("hidden");
      clearInterval(anim); anim = setInterval(animiere, 100);
      clearInterval(poll); poll = setInterval(frage, 600);
      frage();
    }, 700);
  }
  function ende(ok = true) {
    if (!aktiv) return;
    aktiv = false;
    clearTimeout(zeigTimer); clearInterval(poll);
    if (box.classList.contains("hidden")) { clearInterval(anim); return; }
    schritt = 3; ziel = 100;
    box.classList.add(ok ? "ub-gruen" : "ub-rot");
    $("ab-sub").textContent = ok ? "Erledigt, Boss." : "Das hat nicht geklappt.";
    const meine = nr;
    setTimeout(() => {
      if (meine !== nr) return;
      clearInterval(anim); gezeigt = 100; zeichne();
      setTimeout(() => { if (meine === nr && !aktiv) box.classList.add("hidden"); }, 900);
    }, 500);
  }

  window.FridayAuftrag = { start, ende };
})();
