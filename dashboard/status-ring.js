// F.R.Ai.D.A.Y Status-Ring (v1.105.0): Der Kreis um Fridays Kopf zeigt per Farbe, wie es ihr geht.
//   grün  = Friday spricht gerade (hat immer Vorrang)
//   rot   = etwas funktioniert nicht (Server weg, kein Internet, Claude-Guthaben leer, Update fehlgeschlagen, Auftrag gescheitert)
//   gelb  = neue Info / Hinweis (Update da, Mac getrennt, Sparmodus, Sicherung alt, Stimmen-Hinweis)
//   ohne  = alles okay (Ring sieht aus wie immer)
// Andere Module können eigene Meldungen setzen: window.FridayRing.melde(quelle, "bad"|"warn"|null, text, dauerMs, aktion)
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const reactor = $("reactor");
  if (!reactor) return;

  const ring = document.createElement("span");
  ring.className = "status-ring";
  ring.setAttribute("aria-hidden", "true");
  reactor.appendChild(ring);

  // Kleines Schild unter dem Kopf: sagt, warum der Ring leuchtet. Antippen öffnet die passende Stelle.
  const schild = document.createElement("span");
  schild.className = "ring-schild";
  schild.setAttribute("role", "status");
  schild.innerHTML = '<i class="rs-punkt"></i><span class="rs-text"></span><b class="rs-x" title="Hinweis ausblenden">✕</b>';
  reactor.appendChild(schild);

  const LABEL = reactor.getAttribute("aria-label") || "Mit Friday sprechen";
  const QUITT_KEY = "friday_ring_gesehen";
  const meldungen = new Map(); // quelle -> { stufe, text, bis, aktion }

  const lies = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const schreib = (k, v) => { try { localStorage.setItem(k, v); } catch { /* privat */ } };
  let gesehen = {};
  try { gesehen = JSON.parse(lies(QUITT_KEY) || "{}") || {}; } catch { gesehen = {}; }

  function melde(quelle, stufe, text, dauerMs, aktion) {
    if (!stufe) meldungen.delete(quelle);
    else meldungen.set(quelle, { stufe, text: text || "", bis: dauerMs ? Date.now() + dauerMs : 0, aktion: aktion || null });
    if (dauerMs) setTimeout(zeichne, dauerMs + 50);
    zeichne();
  }

  // Wer gerade das Sagen hat: Sprechen > Fehler > Hinweis > ruhig.
  function aktuell() {
    const jetzt = Date.now();
    let rot = null, gelb = null;
    for (const [quelle, m] of meldungen) {
      if (m.bis && m.bis < jetzt) { meldungen.delete(quelle); continue; }
      if (m.stufe === "bad" && !rot) rot = { quelle, ...m };
      // Gelbe Hinweise lassen sich wegtippen, bis sich ihr Text ändert.
      if (m.stufe === "warn" && !gelb && gesehen[quelle] !== m.text) gelb = { quelle, ...m };
    }
    return rot || gelb;
  }

  let letzterZustand = "";
  function zeichne() {
    const spricht = reactor.classList.contains("speaking");
    const m = aktuell();
    const zustand = spricht ? "spricht" : m ? m.stufe : "";
    if (zustand) reactor.dataset.ring = zustand; else delete reactor.dataset.ring;
    const zeigeSchild = Boolean(m) && !spricht;
    schild.classList.toggle("an", zeigeSchild);
    if (m) {
      schild.dataset.stufe = m.stufe;
      schild.dataset.quelle = m.quelle;
      schild.querySelector(".rs-text").textContent = m.text;
      schild.querySelector(".rs-x").hidden = m.stufe !== "warn";
      schild.classList.toggle("klickbar", Boolean(m.aktion));
    }
    const grund = spricht ? "Friday spricht" : m ? m.text : "";
    reactor.title = grund;
    reactor.setAttribute("aria-label", grund ? `${LABEL} (${grund})` : LABEL);
    if (zustand !== letzterZustand) {
      letzterZustand = zustand;
      window.dispatchEvent(new CustomEvent("friday-ring", { detail: { zustand, text: grund } }));
    }
  }

  schild.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    const quelle = schild.dataset.quelle;
    const m = meldungen.get(quelle);
    if (!m) return;
    if (e.target.closest(".rs-x")) {
      gesehen[quelle] = m.text;
      schreib(QUITT_KEY, JSON.stringify(gesehen));
      zeichne();
      return;
    }
    try { m.aktion?.(); } catch { /* egal */ }
  });

  const klick = (id) => () => $(id)?.click();
  const oeffneSystem = () => (window.openSysCheck ? window.openSysCheck() : $("syscheck-btn")?.click());

  // --- Quellen ---------------------------------------------------------------
  const punkt = (id) => $(id)?.querySelector(".hb-dot");
  const hat = (el, cls) => Boolean(el?.classList.contains(cls));

  function pruefeChips() {
    // Mac-Agent getrennt (Friday läuft, aber Mac-Befehle gehen nicht)
    const mac = punkt("hb-mac");
    melde("mac", hat(mac, "warn") || hat(mac, "bad") ? "warn" : null, "Mac-Agent getrennt", 0, oeffneSystem);
    // Sicherung zu alt / keine
    const bk = punkt("hb-backup");
    const keine = $("hb-backup")?.querySelector("b")?.textContent === "keine";
    melde("sicherung", hat(bk, "bad") ? "warn" : null, keine ? "Noch keine Sicherung" : "Sicherung ist älter als 7 Tage", 0, klick("hb-backup"));
    // Update verfügbar
    const upd = $("update-btn");
    const neu = hat(upd, "upd-new");
    melde("update", neu ? "warn" : null, neu ? `${$("update-label")?.textContent || "Update"} verfügbar` : "", 0, klick("update-btn"));
  }

  function pruefeEnergie() {
    const b = document.body.classList;
    if (b.contains("friday-tot")) melde("energie", "bad", "Claude-Guthaben leer", 0, klick("hb-energie"));
    else if (b.contains("friday-spar")) melde("energie", "warn", "Sparmodus: Guthaben knapp", 0, klick("hb-energie"));
    else melde("energie", null);
  }

  function pruefeNetz() {
    melde("netz", navigator.onLine === false ? "bad" : null, "Kein Internet");
  }

  // Server nicht erreichbar: erst ab dem zweiten Fehlschlag hintereinander, damit kurze Aussetzer nicht rot blinken.
  let statusFehler = 0;
  window.addEventListener("friday-status-fehler", () => {
    if (++statusFehler >= 2) melde("server", "bad", "Friday-Server nicht erreichbar", 0, oeffneSystem);
  });
  window.addEventListener("friday-status", (e) => {
    statusFehler = 0;
    melde("server", null);
    const s = e.detail || {};
    melde("stimme", s.voiceHinweis ? "warn" : null, "ElevenLabs-Stimme pausiert", 0, () => window.Friday?.stimmHinweis?.(s.voiceHinweis));
    const u = s.update;
    const frisch = u?.time && Date.now() - new Date(u.time).getTime() < 24 * 3600000;
    melde("update-fehler", u?.state === "fehler" && frisch ? "bad" : null, "Update fehlgeschlagen", 0, klick("update-btn"));
    // Erst nach dem Status-Abruf sind die Chips gefüllt.
    setTimeout(pruefeChips, 0);
  });
  window.addEventListener("friday-update-ende", (e) => {
    if (e.detail && e.detail.ok === false) melde("update-fehler", "bad", "Update fehlgeschlagen", 30 * 60000, klick("update-btn"));
  });
  window.addEventListener("online", pruefeNetz);
  window.addEventListener("offline", pruefeNetz);

  // Änderungen an Chips, Update-Knopf, Energie und Sprech-Zustand beobachten.
  const mo = new MutationObserver((liste) => {
    let chips = false, energie = false, sprech = false;
    for (const r of liste) {
      if (r.target === document.body) energie = true;
      else if (r.target === reactor) sprech = true;
      else chips = true;
    }
    if (chips) pruefeChips();
    if (energie) pruefeEnergie();
    if (sprech) zeichne();
  });
  mo.observe(reactor, { attributes: true, attributeFilter: ["class"] });
  mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  ["hb-mac", "hb-backup"].forEach((id) => { const d = punkt(id); if (d) mo.observe(d, { attributes: true, attributeFilter: ["class"] }); });
  if ($("update-btn")) mo.observe($("update-btn"), { attributes: true, attributeFilter: ["class"] });

  pruefeChips(); pruefeEnergie(); pruefeNetz();
  setInterval(zeichne, 30000); // abgelaufene Kurz-Meldungen aufräumen

  window.FridayRing = { melde, zustand: () => letzterZustand };
})();
