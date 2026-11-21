// Eve-Start (v1.138.0) – läuft als ALLERERSTES Skript.
// Setzt das Merkzeichen (Cookie friday_eve), damit Friday alle Anfragen dieses Geräts an Eve weiterreicht,
// und hält die Einstellungen auf diesem Gerät für Friday und Eve getrennt (je ein eigener Schnappschuss).
(() => {
  "use strict";
  let LS;
  try { LS = window.localStorage; } catch { return; }
  const P = Storage.prototype;
  const set = P.setItem, rem = P.removeItem, get = P.getItem;
  const eve = get.call(LS, "eve_modus") === "1";
  const sicher = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = eve
    ? `friday_eve=1; path=/; max-age=31536000; SameSite=Strict${sicher}`
    : `friday_eve=; path=/; max-age=0; SameSite=Strict${sicher}`;
  document.documentElement.classList.toggle("eve-modus", eve);

  // Diese Werte gehören zum Gerät, nicht zu Friday oder Eve.
  const GERAET = /^friday_(token|voice|alarm_last|focus_.*|boot|wake|theme_mockup|sync_.*|leistung)$/;
  const eigene = () => Object.keys(LS).filter((k) => /^friday_/.test(k) && !GERAET.test(k));

  /** Zwischen Friday und Eve wechseln: Einstellungen merken, die der anderen Seite holen, neu laden. */
  function wechsel(zuEve) {
    const von = eve ? "eve" : "friday";
    const nach = zuEve ? "eve" : "friday";
    if (von !== nach) {
      const schnapp = {};
      for (const k of eigene()) schnapp[k] = get.call(LS, k);
      set.call(LS, `eve_schnapp_${von}`, JSON.stringify(schnapp));
      let ziel = null;
      try { ziel = JSON.parse(get.call(LS, `eve_schnapp_${nach}`) || "null"); } catch { ziel = null; }
      if (ziel && typeof ziel === "object") {
        for (const k of eigene()) rem.call(LS, k);
        for (const [k, v] of Object.entries(ziel)) if (/^friday_/.test(k) && !GERAET.test(k)) set.call(LS, k, String(v));
      } // Erstes Mal Eve: Eve startet mit denselben Einstellungen wie Friday (exakte Kopie).
      rem.call(LS, "friday_sync_pending"); // nichts von der einen Seite zur anderen schicken
    }
    set.call(LS, "eve_modus", zuEve ? "1" : "0");
    location.reload();
  }
  /** Nach „Eve zurücksetzen“: Eves Einstellungen auf diesem Gerät vergessen. */
  function eveEinstellungenVergessen() { rem.call(LS, "eve_schnapp_eve"); }

  window.EveStart = { eve, wechsel, eveEinstellungenVergessen };
})();
