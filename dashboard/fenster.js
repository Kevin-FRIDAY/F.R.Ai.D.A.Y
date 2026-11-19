// Fenster-Ordnung (v1.104.0): Friday zeigt immer nur ein großes Fenster auf einmal.
// - Öffnet sich ein Fenster über das Werkzeug-Menü, die Stimme oder die Seitenleiste, gehen die anderen zu.
// - Öffnet man ein Fenster aus einem anderen heraus (z. B. Verbindungen aus den Einstellungen),
//   bleibt das alte darunter liegen und kommt nach dem Schließen wieder zum Vorschein.
// - Esc schließt immer nur das oberste Fenster.
// Geschlossen wird über den ✕-Knopf des Fensters, damit z. B. die Kamera richtig ausgeht.
(() => {
  const AUSSER = new Set(["login", "call", "upd-bar", "auftrag-bar"]);
  const AUCH = ["sat", "camera", "vision", "schnitt", "markt", "werkstatt", "webseiten", "lage", "dok"];
  const istFenster = (el) => el && el.id && !AUSSER.has(el.id) && (el.classList.contains("sheet") || AUCH.includes(el.id));
  const offen = (el) => !el.classList.contains("hidden");
  const alle = () => [...document.querySelectorAll("section.sheet[id], #" + AUCH.join(", #"))].filter(istFenster);

  const stapel = []; // geöffnete Fenster, das oberste zuletzt
  let letzterKlick = null; // wo zuletzt getippt wurde (Fenster oder nicht)
  let klickZeit = 0;
  let schliesstGerade = false;

  function schliessen(el) {
    if (!el || !offen(el)) return;
    const knopf = el.querySelector('[id$="-x"], [id$="-close"], .sheet-close, [data-close]');
    schliesstGerade = true;
    try {
      if (knopf) knopf.click();
      if (offen(el)) el.classList.add("hidden");
    } finally {
      schliesstGerade = false;
    }
  }

  function geoeffnet(el) {
    const i = stapel.indexOf(el);
    if (i >= 0) stapel.splice(i, 1);
    // Aus einem offenen Fenster heraus geöffnet? Dann darf das alte darunter liegen bleiben.
    const frisch = Date.now() - klickZeit < 2000;
    const ausFenster = frisch && letzterKlick && stapel.some((f) => offen(f) && f.contains(letzterKlick));
    if (!ausFenster) for (const f of [...stapel]) if (f !== el && offen(f)) schliessen(f);
    stapel.push(el);
  }

  function geschlossen(el) {
    const i = stapel.indexOf(el);
    if (i >= 0) stapel.splice(i, 1);
  }

  function beobachten() {
    const beob = new MutationObserver((liste) => {
      for (const m of liste) {
        const el = m.target;
        if (!istFenster(el)) continue;
        const warOffen = !String(m.oldValue || "").split(/\s+/).includes("hidden");
        const istOffen = offen(el);
        if (istOffen && !warOffen) geoeffnet(el);
        else if (!istOffen && warOffen) geschlossen(el);
      }
    });
    beob.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
    // Schon offene Fenster (z. B. nach dem Neuladen) mitzählen.
    for (const el of alle()) if (offen(el)) stapel.push(el);
  }

  // Merken, wo getippt wurde – kurz danach öffnet sich vielleicht ein neues Fenster.
  document.addEventListener("pointerdown", (e) => { letzterKlick = e.target; klickZeit = Date.now(); }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { letzterKlick = e.target; klickZeit = Date.now(); } }, true);
  // Klick im Werkzeug-Menü zählt nie als "aus einem Fenster heraus".
  document.addEventListener("click", (e) => { if (e.target.closest?.("#menu-pop, .side-nav, #menu-fab")) letzterKlick = null; }, true);

  // Esc: Viele Fenster schließen sich schon selbst. Nur wenn keins reagiert hat, schließen wir das oberste.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || schliesstGerade) return;
    const vorher = stapel.filter(offen).length;
    setTimeout(() => {
      const nochOffen = stapel.filter(offen);
      if (nochOffen.length && nochOffen.length === vorher) schliessen(nochOffen[nochOffen.length - 1]);
    }, 0);
  });

  window.fridayFenster = { stapel: () => stapel.filter(offen).map((f) => f.id), schliessen: (id) => schliessen(document.getElementById(id)), alleZu: () => [...stapel].reverse().forEach(schliessen) };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", beobachten);
  else beobachten();
})();
