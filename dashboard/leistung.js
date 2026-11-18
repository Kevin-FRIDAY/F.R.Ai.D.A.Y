// F.R.Ai.D.A.Y – Leistungsmodus (v1.94.0)
// Entscheidet, wie viel Grafik-Aufwand das Gerät verträgt:
//   "schoen"   – volle Qualität (Mac/PC)
//   "fluessig" – gleiche Optik, aber sparsamer: 30 Bilder/s für den Kopf, ohne teure Kantenglättung,
//                weniger Partikel, kein Weichzeichner hinter Glas-Karten, keine Dauer-Glüh-Animationen
//   "auto"     – Handy/Tablet → flüssig, Computer → schön. Ruckelt ein Computer trotzdem
//                (unter ~35 Bilder/s), schaltet Friday für diese Sitzung selbst auf flüssig.
// Wird früh im <head> geladen, damit die CSS-Klasse schon beim ersten Zeichnen stimmt.
// Die Einstellung gilt nur für dieses Gerät (iPhone flüssig, Mac schön).
(() => {
  "use strict";
  const KEY = "friday_leistung";
  const MODI = ["auto", "schoen", "fluessig"];
  const root = document.documentElement;
  let autoGedrosselt = false; // Auto-Modus hat Ruckeln gemessen → flüssig für diese Sitzung

  const lies = () => {
    try { const v = localStorage.getItem(KEY); return MODI.includes(v) ? v : "auto"; } catch { return "auto"; }
  };

  function istHandy() {
    try {
      const ua = navigator.userAgent || "";
      if (/iPhone|iPod|Android.+Mobile|Mobile Safari/i.test(ua)) return true;
      // iPad meldet sich als Mac – erkennbar an Touch
      if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
      const grob = window.matchMedia && matchMedia("(pointer: coarse)").matches;
      return !!grob && Math.min(screen.width, screen.height) <= 1024;
    } catch { return false; }
  }

  function schwachesGeraet() {
    const kerne = navigator.hardwareConcurrency || 8;
    const ram = navigator.deviceMemory || 8;
    return kerne <= 2 || ram <= 2; // alles andere entscheidet der Selbsttest (Bilder/s)
  }

  function berechneStufe(modus) {
    if (modus === "schoen" || modus === "fluessig") return modus;
    if (autoGedrosselt) return "fluessig";
    return istHandy() || schwachesGeraet() ? "fluessig" : "schoen";
  }

  let modus = lies();
  let stufe = berechneStufe(modus);

  function anwenden() {
    root.classList.toggle("perf-fluessig", stufe === "fluessig");
    root.dataset.leistung = stufe;
  }
  anwenden();

  function melden() {
    try { window.dispatchEvent(new CustomEvent("friday-leistung", { detail: { modus, stufe } })); } catch {}
  }

  // ---- Ist der Kopf gerade überhaupt zu sehen? ----
  // Ein offenes Fenster (Einstellungen, Weltgeschehen, Archiv …) liegt über ihm → nicht zeichnen.
  const VERDECKER = ".sheet:not(.hidden), #lage:not(.hidden), #call:not(.hidden), .arc-gross, .lz-lightbox, .dok-huelle";
  let verdeckt = false;
  function pruefeVerdeckt() {
    try {
      let v = false;
      if (document.body) {
        for (const n of document.querySelectorAll(VERDECKER)) {
          if (n.offsetParent !== null || getComputedStyle(n).position === "fixed") {
            const r = n.getBoundingClientRect();
            // nur Fenster, die (fast) den ganzen Bildschirm bedecken
            if (r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.85) { v = true; break; }
          }
        }
      }
      verdeckt = v;
    } catch { verdeckt = false; }
  }
  setInterval(pruefeVerdeckt, 400);
  document.addEventListener("click", () => setTimeout(pruefeVerdeckt, 30), true);
  document.addEventListener("keyup", () => setTimeout(pruefeVerdeckt, 30), true);

  // ---- Auto: selbst messen, ob es ruckelt (nur einmal kurz nach dem Start) ----
  function selbstTest() {
    if (modus !== "auto" || stufe === "fluessig") return;
    let n = 0, start = 0, langsam = 0, last = 0;
    const f = (t) => {
      if (document.hidden || verdeckt) { start = 0; n = 0; langsam = 0; last = 0; requestAnimationFrame(f); return; }
      if (!start) { start = t; last = t; }
      if (t - last > 50) langsam++;
      last = t; n++;
      if (t - start < 5000) { requestAnimationFrame(f); return; }
      const fps = (n * 1000) / (t - start);
      if (fps < 35 || langsam > 25) {
        autoGedrosselt = true;
        stufe = "fluessig"; anwenden(); melden();
        try { console.info(`[Friday] Leistung: ${fps.toFixed(0)} Bilder/s gemessen → flüssiger Modus`); } catch {}
      }
    };
    // erst messen, wenn das Modell geladen ist und sich alles beruhigt hat
    setTimeout(() => requestAnimationFrame(f), 6000);
  }
  if (document.readyState === "complete") selbstTest(); else window.addEventListener("load", selbstTest);

  window.FridayLeistung = {
    get modus() { return modus; },
    get stufe() { return stufe; },
    get fluessig() { return stufe === "fluessig"; },
    // Kopf: Bilder pro Sekunde, maximale Pixeldichte, Anteil der Partikel
    get fps() { return stufe === "fluessig" ? 30 : 60; },
    get maxDpr() { return 2; },
    // Kantenglättung (MSAA) kostet auf dem Handy am meisten – bei 2-facher Pixeldichte kaum sichtbar
    get kantenglaettung() { return stufe !== "fluessig"; },
    get partikel() { return stufe === "fluessig" ? 0.45 : 1; },
    // Globus: Mindestabstand zwischen zwei Bildern beim Drehen (ms)
    get globusMs() { return stufe === "fluessig" ? 66 : 30; },
    get verdeckt() { return verdeckt; },
    istHandy,
    setzen(m) {
      if (!MODI.includes(m)) return;
      modus = m; autoGedrosselt = false;
      try { localStorage.setItem(KEY, m); } catch {}
      stufe = berechneStufe(modus); anwenden(); melden();
    },
  };
})();
