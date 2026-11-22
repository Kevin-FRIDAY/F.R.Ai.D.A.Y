// Grüner Haken beim Speichern (v1.153.0)
// Überall im Dashboard: Wenn Kevin etwas speichert (Knopf „Speichern“, „Sichern“, „Eintragen“ …,
// ein Schalter, eine Auswahl oder ein Regler in einem Fenster), erscheint direkt daneben ein
// grüner Kreis mit Haken, und unten kurz das Schild „Gespeichert“.
// Der Haken kommt erst, wenn der Mac das Speichern wirklich bestätigt hat. Klappt es nicht,
// gibt es stattdessen einen roten Kreis mit „!“.
// Läuft im <head> direkt nach einstellungen-sync.js, damit jede Anfrage an den Mac mitgezählt wird.
// Für eigene Stellen: window.FridayHaken.zeige(element, "Text") / .fehler(element, "Text").
(() => {
  "use strict";

  // Knöpfe, die etwas speichern (Beschriftung)
  const SPEICHER_KNOPF = /(speicher|sichern|übernehm|uebernehm|eintragen|anlegen|hinzufüg|hinzufueg|merken|verbinden|koppeln|bestätig|bestaetig|einrichten|aktivieren|festlegen|setzen|^\s*[＋+✓✔]\s*\S)/i;
  // … aber nicht diese (räumen auf, laden nur herunter, brechen ab)
  const KEIN_SPEICHERN = /(zwischenspeicher|arbeitsspeicher|leeren|lösch|loesch|entfern|vergessen|abbrech|zurücksetz|zuruecksetz|als datei|als bild|herunterlad|⬇|trennen)/i;
  // Anfragen, die nie „Speichern“ sind (Gespräch, Stimme, Anmeldung, Befehle, Prüfungen …)
  const NIE = /^\/api\/(ask|chat|tts|login|siri|health|core-state|hoeren|hoeren\/vorwaermen|einstellungen\/oberflaeche)$|\/(befehl|sprechen|ki|recherche|pruefen|planen|einschaetzung|briefing|run|jetzt|test|frage|scan|suchen|bewerten|sitzung|senden|lob)(\/|$)/;
  // Bei Schaltern/Auswahlfeldern zählt nur, was nach Speichern aussieht (nicht z. B. ein Filter, der etwas berechnet)
  const FELD_NIE = /^\/api\/(video-job|video-open|studio|spiel|werkstatt|webseite|webseite\/live|routen\/planen|lernen\/(start|text|aufgaben|arbeitsblatt|vorbereitung)|zentrale\/rechnen\/.*|zentrale\/sicherheit\/.*|kaufberater\/pruefen|gegenrede|ideen\/ausarbeiten|dokwissen\/(frage|einlesen)|markt\/.*)$/;

  const FENSTER = ".sheet, .sheet-box, .menu-pop, [role=dialog], #einstellungen, #settings";
  const ZEIT = 6000; // so lange nach dem Klick darf die Bestätigung vom Mac dauern

  let anker = null; // { el, art: "knopf" | "feld", t, fertig }

  const beschriftung = (el) => (el.getAttribute?.("aria-label") || el.value || el.textContent || el.title || "").trim().slice(0, 80);

  function speicherKnopf(el) {
    const b = el?.closest?.("button, input[type=submit], input[type=button], [role=button], a.btn");
    if (!b || b.disabled || b.closest("[data-kein-haken]")) return null;
    const t = beschriftung(b);
    return t && SPEICHER_KNOPF.test(t) && !KEIN_SPEICHERN.test(t) ? b : null;
  }

  // ---- Wer hat gerade etwas gespeichert? ----
  window.addEventListener("click", (e) => {
    const b = speicherKnopf(e.target);
    if (b) { anker = neu(b, "knopf"); return; }
    // Andere Knöpfe in Fenstern (z. B. Farbkreise): zählen nur, wenn danach eine Einstellung gespeichert wird.
    const k = e.target?.closest?.("button, [role=button], [role=radio], [role=switch]");
    if (k && k.closest(FENSTER) && !k.closest("[data-kein-haken], .sheet-top, header") && !KEIN_SPEICHERN.test(beschriftung(k))) anker = neu(k, "klick");
  }, { capture: true, passive: true });

  window.addEventListener("submit", (e) => {
    const f = e.target;
    if (!(f instanceof HTMLFormElement) || f.closest("[data-kein-haken]")) return;
    const b = e.submitter || f.querySelector("button[type=submit], button:not([type]), input[type=submit]");
    const t = b ? beschriftung(b) : "";
    if (b && KEIN_SPEICHERN.test(t)) return;
    // Formulare in Fenstern sind fast immer „Speichern“; das Chat-Eingabefeld nicht.
    if ((b && SPEICHER_KNOPF.test(t)) || (f.closest(FENSTER) && !NIE_FORM(f))) anker = neu(b || f, "knopf");
  }, { capture: true });
  const NIE_FORM = (f) => /chat|ask|eingabe|prompt|suche|search|login/i.test(`${f.id} ${f.className}`);

  window.addEventListener("change", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.matches("input, select, textarea") || el.closest("[data-kein-haken]")) return;
    if (el.matches("input[type=file], input[type=search], input[type=password]") && !el.closest(FENSTER)) return;
    if (!el.closest(FENSTER)) return; // nur in Fenstern (Einstellungen, Verbindungen, Profil …)
    anker = neu(el, "feld");
  }, { capture: true, passive: true });

  function neu(el, art) {
    return { el, art, t: Date.now(), fertig: false, id: el.id, name: el.name, text: beschriftung(el), fenster: el.closest(FENSTER) };
  }
  // Viele Fenster bauen sich nach dem Speichern neu auf: dann den neuen, gleichen Knopf/Schalter suchen.
  function aktuell(a) {
    if (a.el.isConnected) return a.el;
    const raum = a.fenster?.isConnected ? a.fenster : document;
    if (a.id) { const x = document.getElementById(a.id); if (x) return x; }
    if (a.name) { const x = raum.querySelector(`[name="${CSS.escape(a.name)}"]`); if (x) return x; }
    if (a.text) for (const x of raum.querySelectorAll("button, input[type=submit], [role=button]")) if (beschriftung(x) === a.text) return x;
    return null;
  }

  const frisch = () => anker && !anker.fertig && Date.now() - anker.t < ZEIT ? anker : null;

  // ---- Jede Anfrage an den Mac beobachten ----
  const origFetch = window.fetch;
  if (typeof origFetch === "function") {
    window.fetch = function (input, init) {
      const p = origFetch.apply(this, arguments);
      try {
        const a = frisch();
        if (a) {
          const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
          const url = new URL(typeof input === "string" ? input : input?.url || String(input), location.href);
          const pfad = url.pathname;
          if (method !== "GET" && method !== "HEAD" && url.origin === location.origin && pfad.startsWith("/api/") && !NIE.test(pfad) && a.art !== "klick" && !(a.art === "feld" && FELD_NIE.test(pfad))) {
            p.then((res) => {
              if (a.fertig) return;
              if (res.ok) ok(a);
              else if (res.status !== 401) fehler(a, res.status);
            }, (err) => { if (err?.name !== "AbortError" && !a.fertig) fehler(a, 0); });
          }
        }
      } catch { /* nie das eigentliche Laden stören */ }
      return p;
    };
  }

  // Einstellungen, die nur im Browser liegen und von einstellungen-sync.js zum Mac geschickt werden
  window.addEventListener("friday:gespeichert", () => { const a = frisch(); if (a) ok(a, { schild: false }); });
  window.addEventListener("friday:nicht-gespeichert", () => { const a = frisch(); if (a) { a.fertig = true; markiere(a, "warte"); } });

  function ok(a, { schild = true } = {}) {
    a.fertig = true;
    markiere(a, "ok");
    if (schild) window.FridaySync?.schild ? window.FridaySync.schild("ok") : window.FridaySync?.gespeichert?.();
  }
  function fehler(a, status) {
    a.fertig = true;
    markiere(a, "fehler", status ? `Mac meldet Fehler ${status}` : "Mac nicht erreichbar");
    window.FridaySync?.schild?.("fehler", status ? `Mac meldet Fehler ${status}` : "Mac nicht erreichbar");
  }

  // ---- Der grüne Kreis ----
  function ziel(el) {
    if (el instanceof HTMLFormElement) return el.querySelector("button[type=submit], button:not([type]), input[type=submit]") || el.lastElementChild || el;
    if (el.matches?.("input[type=checkbox], input[type=radio]")) return el.closest("label") || el;
    return el;
  }
  function markiere(el, art = "ok", text) {
    if (el && el.el) el = aktuell(el);
    const z = el && ziel(el);
    if (!z || !z.parentNode) return;
    // Schalter mit Beschriftung: Haken ans Ende der Zeile. Sonst direkt hinter das Feld bzw. den Knopf.
    // Knopf-Gruppen (z. B. Farbkreise): Haken ans Ende der Gruppe, nicht zwischen die Knöpfe.
    const gruppe = z.matches("button, [role=button], [role=radio]") && z.parentElement && z.parentElement.querySelectorAll(":scope > button, :scope > [role=button], :scope > [role=radio]").length > 2 ? z.parentElement : null;
    // Feld in einer Zeile „Beschriftung … Feld“: Haken hinter die Beschriftung, damit das Feld nicht verrutscht.
    const titel = z.matches("input, select, textarea") && z.parentElement?.tagName === "LABEL" ? z.parentElement.querySelector(":scope > span, :scope > b, :scope > .set-label") : null;
    const box = z.tagName === "LABEL" && z.querySelector("input[type=checkbox], input[type=radio]") ? z : gruppe || (titel && !titel.contains(z) ? titel : null);
    let h = box ? box.querySelector(":scope > .fh-haken") : z.nextElementSibling?.classList?.contains("fh-haken") ? z.nextElementSibling : null;
    if (!h) {
      h = document.createElement("fh-haken"); // eigenes Element: keine fremden span-Regeln
      h.setAttribute("role", "status");
      if (box) box.appendChild(h); else z.insertAdjacentElement("afterend", h);
    }
    h.className = `fh-haken fh-${art}`;
    h.textContent = art === "ok" ? "✓" : art === "warte" ? "…" : "!";
    h.title = art === "ok" ? "Gespeichert" : art === "warte" ? "Auf diesem Gerät gespeichert, Mac folgt" : `Nicht gespeichert${text ? ` (${text})` : ""}`;
    h.setAttribute("aria-label", h.title);
    void h.offsetWidth; h.classList.add("fh-rein");
    h.__quelle = z;
  }

  // Sobald an derselben Stelle wieder getippt wird, verschwindet der Haken – bis zum nächsten Speichern.
  // (Schalter/Auswahlen ersetzen ihren Haken beim nächsten Speichern einfach durch einen neuen.)
  window.addEventListener("input", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement) || !t.matches("input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]), textarea, [contenteditable]")) return;
    document.querySelectorAll(".fh-haken").forEach((h) => {
      const q = h.__quelle;
      if (!q) return;
      const raum = q === t || q.contains?.(t) ? q : (q.closest("form") || (q.matches("button, input[type=submit], [role=button]") ? q.parentElement?.parentElement : null));
      if (raum && (raum === t || raum.contains(t))) h.remove();
    });
  }, { capture: true, passive: true });

  window.FridayHaken = {
    zeige: (el, text) => { if (el) markiere(el, "ok"); window.FridaySync?.schild?.("ok", text); },
    fehler: (el, text) => { if (el) markiere(el, "fehler", text); window.FridaySync?.schild?.("fehler", text); },
  };
})();
