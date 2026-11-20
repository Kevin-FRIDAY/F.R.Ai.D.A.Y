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
    // v1.118.0: Startseite liegt komplett unter einem Fenster → ihre Dauer-Animationen anhalten (style.css)
    root.classList.toggle("friday-verdeckt", verdeckt);
  }
  setInterval(pruefeVerdeckt, 400);
  document.addEventListener("click", () => setTimeout(pruefeVerdeckt, 30), true);
  document.addEventListener("keyup", () => setTimeout(pruefeVerdeckt, 30), true);

  // ---- Ruhe (v1.118.0): Friday-Fenster im Hintergrund ----
  // Arbeitet Kevin in einer anderen App, muss Friday nicht mit voller Kraft weiterzeichnen:
  // CSS-Animationen halten an (html.friday-ruhe), Kopf und Globus laufen im Spar-Takt.
  // Spricht oder hört Friday, läuft der Kopf trotzdem flüssig.
  let fokus = true;
  function pruefeFokus() {
    let f = true;
    try {
      // Klick in ein eingebettetes Video/Spiel (iframe) zählt als "Friday ist vorne"
      f = document.hasFocus() || document.activeElement?.tagName === "IFRAME";
      if (document.hidden) f = false;
    } catch { f = true; }
    if (f === fokus) return;
    fokus = f;
    root.classList.toggle("friday-ruhe", !fokus);
    melden();
  }
  window.addEventListener("focus", pruefeFokus);
  window.addEventListener("blur", () => setTimeout(pruefeFokus, 50));
  document.addEventListener("visibilitychange", pruefeFokus);
  setInterval(pruefeFokus, 1500);

  // Weltgeschehen: Sind Satelliten/Schiffe/Flugzeuge an, zeichnet jedes Globus-Bild zehntausende Punkte neu.
  const SCHWERE_EBENEN = ["lage-sats-on", "lage-ships-on", "lage-planes-on"];
  const schwereEbenen = () => SCHWERE_EBENEN.some((id) => document.getElementById(id)?.checked);

  // ---- Animations-Takt (v1.118.0) ----
  // Jede Dauer-Animation (pulsierende Punkte, drehende Ringe, Laufschrift, blinkende Lämpchen) zwingt den
  // Browser zu 60 Bildern pro Sekunde – und jedes Bild setzt den ganzen Bildschirm samt Glas-Unschärfe,
  // Globus und Punkte-Ebenen neu zusammen. Gemessen am Mac: Weltgeschehen (Globus steht still) 96 % Last,
  // ohne diese Animationen 18 %. Darum schalten wir sie selbst weiter: Startseite 30× pro Sekunde
  // (so oft zeichnet der Kopf ohnehin), sonst 20×. Sie sehen gleich aus und laufen gleich schnell,
  // nur in etwas größeren Schritten. Ruhe/verdeckt: sie stehen (siehe style.css).
  // Einmalige Effekte (Einblenden, Wackeln …) laufen unverändert.
  let taktLetzt = 0;
  const zurStartseite = (t) => {
    try {
      if (t === document.body || t === document.documentElement) return true;
      if (t.classList && (t.classList.contains("grid-bg") || t.classList.contains("scanline"))) return true;
      const app = document.getElementById("app");
      if (!app || !app.contains(t)) return false;
      for (const s of app.querySelectorAll(":scope > .sheet")) if (s.contains(t)) return false;
      return true;
    } catch { return false; }
  };
  function animTakt() {
    if (document.hidden || !document.getAnimations) return;
    const now = performance.now();
    const fps = verdeckt ? 20 : 30;
    if (now - taktLetzt < 1000 / fps - 8) return;
    taktLetzt = now;
    let liste;
    try { liste = document.getAnimations(); } catch { return; }
    for (const a of liste) {
      try {
        if (typeof CSSAnimation !== "undefined" && !(a instanceof CSSAnimation)) continue; // nur CSS-Animationen
        if (a.effect.getComputedTiming().iterations !== Infinity) continue;
        if (a.__fStart == null) {
          if (a.playState !== "running") continue; // von CSS angehalten: nicht anfassen
          a.__fStart = now - (Number(a.currentTime) || 0);
          a.__fStartseite = zurStartseite(a.effect.target);
          a.pause();
        } else if (a.playState === "running") a.pause(); // CSS hat sie wieder angestoßen (z. B. nach Ruhe)
        if (!fokus) continue;                                // Ruhe: stehen lassen
        if (verdeckt && a.__fStartseite) continue;            // Startseite unter einem Fenster: stehen lassen
        a.currentTime = now - a.__fStart;
      } catch { /* einzelne Animation egal */ }
    }
  }
  setInterval(animTakt, 25);

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
    // Ruhe: Globus dreht nur noch 4× pro Sekunde weiter. Viele Punkte: 22 statt 33 Bilder/s (sieht gleich ruhig aus).
    get globusMs() {
      if (!fokus) return 250;
      const basis = stufe === "fluessig" ? 66 : 30;
      return schwereEbenen() ? Math.max(basis, 45) : basis;
    },
    // Kopf: Spricht/hört Friday → volle Bilder/s. Sonst bewegt er sich nur langsam → 30 reichen.
    // Fenster im Hintergrund → 12 Bilder/s (er bleibt lebendig, kostet aber kaum noch etwas).
    kopfFps(aktiv) {
      const voll = stufe === "fluessig" ? 30 : 60;
      if (aktiv) return voll;
      if (!fokus) return 12;
      return Math.min(voll, 30);
    },
    get ruhe() { return !fokus; },
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
