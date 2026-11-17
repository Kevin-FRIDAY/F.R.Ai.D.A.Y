// F.R.Ai.D.A.Y Vollbild: Knopf oben (⛶), Taste F, Sprachbefehl "Friday, Vollbild"
// und auf Wunsch "Immer im Vollbild". Auf dem iPhone ist die Home-Bildschirm-App ohnehin Vollbild.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = document.documentElement;
  const geht = Boolean(el.requestFullscreen || el.webkitRequestFullscreen);
  const istAn = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  const immer = () => { try { return localStorage.getItem("friday_vollbild") === "1"; } catch { return false; } };

  async function an() {
    if (!geht || istAn()) return true;
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else el.webkitRequestFullscreen();
      return true;
    } catch {
      return false; // Browser verlangt einen Klick/Tipp
    }
  }
  function aus() {
    if (!istAn()) return;
    try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch { /* egal */ }
  }
  const umschalten = () => (istAn() ? aus() : an());

  // Browser erlauben Vollbild nur nach einem Klick. Kommt der Befehl per Stimme,
  // zeigt Friday einen großen Knopf: einmal tippen, fertig.
  const tipp = document.createElement("button");
  tipp.type = "button";
  tipp.className = "vb-tipp hidden";
  tipp.innerHTML = '<span class="vb-icon">⛶</span><b>Vollbild</b><small>Einmal tippen</small>';
  document.body.appendChild(tipp);
  tipp.addEventListener("click", () => { tipp.classList.add("hidden"); an(); });
  let tippTimer = null;
  function zeigeTipp() {
    tipp.classList.remove("hidden");
    clearTimeout(tippTimer);
    tippTimer = setTimeout(() => tipp.classList.add("hidden"), 12000);
  }

  // Knopf oben in der HUD-Leiste
  const knopf = $("hb-vollbild");
  if (knopf) {
    knopf.classList.toggle("hidden", !geht);
    knopf.addEventListener("click", umschalten);
  }
  const anzeigen = () => {
    document.body.classList.toggle("vollbild", istAn());
    if (knopf) knopf.querySelector("b").textContent = istAn() ? "Fenster" : "Vollbild";
    if (istAn()) tipp.classList.add("hidden");
  };
  document.addEventListener("fullscreenchange", anzeigen);
  document.addEventListener("webkitfullscreenchange", anzeigen);

  // Taste F (nicht beim Tippen in ein Feld)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "f" && e.key !== "F") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    umschalten();
  });

  // "Immer im Vollbild": beim ersten Klick oder Tastendruck nach dem Öffnen umschalten.
  function ersterKontakt(e) {
    if (e.target?.closest?.("#hb-vollbild, .vb-tipp")) return; // die Knöpfe schalten selbst
    if (e.type === "keydown" && (e.key === "f" || e.key === "F" || e.key === "Escape")) return;
    document.removeEventListener("pointerdown", ersterKontakt, true);
    document.removeEventListener("keydown", ersterKontakt, true);
    if (immer() && geht && !istAn()) an();
  }
  document.addEventListener("pointerdown", ersterKontakt, true);
  document.addEventListener("keydown", ersterKontakt, true);

  window.FridayVollbild = {
    an, aus, umschalten, geht, istAn,
    // Für "Friday, Vollbild": gibt einen anderen Ansagetext zurück, wenn es so nicht geht.
    sprachBefehl(einschalten) {
      if (!einschalten) { aus(); return null; }
      if (!geht) return "Auf dem iPhone bin ich als App vom Home-Bildschirm schon im Vollbild, Boss.";
      an().then((ok) => { if (!ok) zeigeTipp(); });
      return null;
    },
  };
})();
