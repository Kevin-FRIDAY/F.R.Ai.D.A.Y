// Einstellungen dauerhaft speichern (v1.84.0)
// Jede Einstellung im Dashboard (Textgröße, Globus-Stil, Glow, Kopf-Stil, Farbe ...) wird
// zusätzlich auf dem Mac gespeichert (server/data/oberflaeche.json). So bleibt sie nach
// Neuladen, Updates und Browser-Aufräumen erhalten, und Mac und iPhone sind gleich eingestellt.
// Läuft vor allen anderen Skripten und hängt sich an localStorage, damit alle bestehenden
// Schalter und Regler automatisch mitgespeichert werden.
(() => {
  "use strict";
  let LS;
  try { LS = window.localStorage; LS.getItem("friday_sync_probe"); } catch { return; } // privater Modus: nichts zu tun

  const KEY = /^friday_[a-z0-9_]{1,48}$/;
  // Bleibt nur auf diesem Gerät (gleiche Liste wie im Server)
  const NUR_GERAET = /^friday_(token|voice|alarm_last|focus_.*|boot|wake|theme_mockup|sync_.*)$/;
  const synced = (k) => KEY.test(k) && !NUR_GERAET.test(k);
  const PENDING = "friday_sync_pending";
  const proto = Storage.prototype;
  const origSet = proto.setItem;
  const origRemove = proto.removeItem;
  const origGet = proto.getItem;
  const get = (k) => origGet.call(LS, k);

  let quiet = false;   // true, während Werte vom Mac übernommen werden
  let lastUserAction = 0;
  let flushTimer = null;
  let retryTimer = null;
  let pulling = false;
  let lastPull = 0;

  ["pointerdown", "keydown", "input", "change", "touchstart"].forEach((t) =>
    window.addEventListener(t, () => { lastUserAction = Date.now(); }, { capture: true, passive: true }));
  const userMade = () => Date.now() - lastUserAction < 4000;

  // ---- Warteschlange (überlebt Neuladen, falls der Mac gerade nicht erreichbar ist) ----
  const readPending = () => {
    try { const p = JSON.parse(get(PENDING) || "{}"); return { set: p.set && typeof p.set === "object" ? p.set : {}, remove: Array.isArray(p.remove) ? p.remove : [] }; } catch { return { set: {}, remove: [] }; }
  };
  let pending = readPending();
  const savePending = () => {
    try {
      if (!Object.keys(pending.set).length && !pending.remove.length) origRemove.call(LS, PENDING);
      else origSet.call(LS, PENDING, JSON.stringify(pending));
    } catch { /* voll */ }
  };
  const hasPending = () => Object.keys(pending.set).length > 0 || pending.remove.length > 0;

  proto.setItem = function (k, v) {
    const key = String(k), val = String(v);
    const watch = this === LS && !quiet && synced(key);
    const old = watch ? origGet.call(this, key) : null;
    origSet.call(this, k, v);
    // Beim Start füllt das Dashboard leere Felder mit Standardwerten: das ist keine Änderung
    // und darf die gespeicherten Werte vom Mac nicht überschreiben.
    if (watch && old !== val && (old !== null || userMade())) {
      pending.set[key] = val;
      pending.remove = pending.remove.filter((x) => x !== key);
      queue(userMade());
    }
  };
  proto.removeItem = function (k) {
    const key = String(k);
    const watch = this === LS && !quiet && synced(key) && origGet.call(this, key) !== null;
    origRemove.call(this, k);
    if (watch) {
      delete pending.set[key];
      if (!pending.remove.includes(key)) pending.remove.push(key);
      queue(userMade());
    }
  };

  let toastWanted = false;
  function queue(fromUser) {
    savePending();
    if (fromUser) toastWanted = true;
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 450); // Regler schicken viele Werte: kurz sammeln
  }

  const token = () => get("friday_token");
  async function call(method, body) {
    const res = await fetch("/api/einstellungen/oberflaeche", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function flush() {
    clearTimeout(flushTimer);
    if (!hasPending()) return true;
    const zeigen = toastWanted;
    if (!token()) return false; // nach der Anmeldung
    const sending = { set: { ...pending.set }, remove: [...pending.remove] };
    try {
      await call("POST", sending);
      // Nur entfernen, was sich in der Zwischenzeit nicht wieder geändert hat
      for (const [k, v] of Object.entries(sending.set)) if (pending.set[k] === v) delete pending.set[k];
      pending.remove = pending.remove.filter((k) => !sending.remove.includes(k) || get(k) !== null);
      savePending();
      if (zeigen) { toastWanted = false; toast("ok"); }
      return true;
    } catch {
      if (zeigen) { toastWanted = false; toast("offline"); }
      clearTimeout(retryTimer);
      retryTimer = setTimeout(flush, 30000);
      return false;
    }
  }

  // ---- Werte vom Mac holen ----
  async function pull({ reloadOnChange = true } = {}) {
    if (pulling || !token()) return;
    pulling = true;
    lastPull = Date.now();
    try {
      await flush();
      const { werte = {} } = await call("GET");
      let changed = false;
      quiet = true;
      try {
        for (const [k, v] of Object.entries(werte)) {
          if (!synced(k) || k in pending.set || pending.remove.includes(k)) continue; // eigene, neuere Änderung
          if (get(k) !== v) { origSet.call(LS, k, v); changed = true; }
        }
      } finally { quiet = false; }
      // Was nur hier eingestellt ist (z. B. beim ersten Mal), auch auf dem Mac speichern
      const fehlt = {};
      for (let i = 0; i < LS.length; i++) {
        const k = LS.key(i);
        if (k && synced(k) && !(k in werte)) fehlt[k] = get(k);
      }
      if (Object.keys(fehlt).length) { Object.assign(pending.set, fehlt); savePending(); await flush(); }
      if (changed && reloadOnChange) {
        // Die Oberfläche liest ihre Einstellungen beim Start: einmal neu laden (nie in Schleife)
        let last = 0;
        try { last = Number(sessionStorage.getItem("friday_sync_reload")) || 0; } catch { /* egal */ }
        if (Date.now() - last > 15000) {
          try { sessionStorage.setItem("friday_sync_reload", String(Date.now())); } catch { /* egal */ }
          location.reload();
        }
      }
    } catch { /* Mac nicht erreichbar: lokale Werte gelten weiter */ }
    finally { pulling = false; }
  }

  // ---- „Gespeichert“-Hinweis im Orange-Glas-Stil ----
  let toastEl = null, toastTimer = null;
  function toast(art) {
    if (!document.body) return;
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.id = "sync-toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    const ok = art === "ok";
    toastEl.className = ok ? "ok" : "warn";
    toastEl.innerHTML = ok
      ? '<span class="st-ico">✓</span><span class="st-txt"><b>Gespeichert</b><small>gilt auf Mac und iPhone</small></span>'
      : '<span class="st-ico">!</span><span class="st-txt"><b>Auf diesem Gerät gespeichert</b><small>Mac nicht erreichbar, wird nachgeholt</small></span>';
    // Die Textgröße vergrößert die ganze Seite (zoom). Das Schild bleibt immer gleich groß und sichtbar.
    toastEl.style.zoom = String(1 / (parseFloat(document.documentElement.style.zoom) || 1));
    void toastEl.offsetWidth;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), ok ? 1800 : 3600);
  }

  // Für Schalter, die direkt am Server hängen (Auto-Update, Vorladen ...)
  window.FridaySync = { gespeichert: () => toast("ok"), nichtGespeichert: () => toast("offline"), pull, flush };

  // Beim Start, nach der Anmeldung und wenn die App wieder in den Vordergrund kommt
  const start = () => pull({ reloadOnChange: true });
  if (token()) start();
  window.addEventListener("storage", (e) => { if (e.key === "friday_token" && e.newValue) start(); });
  const origSetToken = proto.setItem;
  proto.setItem = function (k, v) {
    const neuAngemeldet = this === LS && String(k) === "friday_token" && v && origGet.call(this, "friday_token") !== String(v);
    origSetToken.call(this, k, v);
    if (neuAngemeldet) setTimeout(() => pull({ reloadOnChange: true }), 50); // nach der Anmeldung: Einstellungen vom Mac übernehmen
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lastPull > 5000) pull({ reloadOnChange: true });
    if (document.visibilityState === "hidden" && hasPending()) flush();
  });
  window.addEventListener("online", () => { if (hasPending()) flush(); });
})();
