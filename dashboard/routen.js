// F.R.Ai.D.A.Y Routen & Verbindungen (v1.103.0, v1.157.0: Standort-Gedächtnis + Google Maps)
// "Friday, wie lange brauche ich nach Hamburg?" → Fenster mit Karte, Fahrzeit für Auto, Fahrrad, zu Fuß
// und Bahn-/Bus-Verbindungen mit Abfahrt, Gleis, Umstiegen und Verspätung. Alles kostenlos, ohne Claude.
// Öffnen: Werkzeug-Menü → Routen & Verbindungen, oder per Sprache.
(() => {
  "use strict";
  const F = window.Friday || {};
  const api = F.api;
  if (!api) return;
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const $ = (id) => document.getElementById(id);
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* egal */ } },
  };

  const MODI = [
    { id: "auto", icon: "🚗", name: "Auto", farbe: "#ff8a2a", apple: "d", google: "driving" },
    { id: "oepnv", icon: "🚆", name: "Bahn & Bus", farbe: "#ffc44d", apple: "r", google: "transit" },
    { id: "rad", icon: "🚲", name: "Fahrrad", farbe: "#2ee6d0", apple: "c", google: "bicycling" },
    { id: "fuss", icon: "🚶", name: "Zu Fuß", farbe: "#a978ff", apple: "w", google: "walking" },
  ];

  // ---------- Fenster ----------
  const sheet = document.createElement("section");
  sheet.id = "routen";
  sheet.className = "sheet hidden";
  sheet.setAttribute("aria-label", "Routen und Verbindungen");
  sheet.innerHTML = `<div class="panel sheet-box rt-box" id="rt-box" lang="de">
      <header class="sheet-top"><h2>🧭 Routen &amp; Verbindungen</h2><button id="rt-x" class="ghost small" aria-label="Schließen">✕</button></header>
      <form id="rt-form" class="rt-form" autocomplete="off">
        <div class="rt-felder">
          <label class="rt-feld"><span class="rt-punkt">A</span><input id="rt-von" type="text" placeholder="Zuhause" enterkeyhint="next" aria-label="Start"><button type="button" id="rt-gps" class="rt-mini" title="Mein Standort" aria-label="Mein Standort">📍</button></label>
          <button type="button" id="rt-tausch" class="rt-tausch" title="Start und Ziel tauschen" aria-label="Tauschen">⇅</button>
          <label class="rt-feld"><span class="rt-punkt b">B</span><input id="rt-nach" type="text" placeholder="Wohin? z. B. Hamburg Hbf" enterkeyhint="go" aria-label="Ziel"></label>
        </div>
        <div class="rt-zeile">
          <select id="rt-wann" aria-label="Wann"><option value="jetzt">Jetzt los</option><option value="ab">Abfahrt um</option><option value="an">Ankunft um</option></select>
          <input id="rt-zeit" type="datetime-local" class="hidden" aria-label="Uhrzeit">
          <button type="submit" class="chip primary rt-go">Route berechnen</button>
        </div>
      </form>
      <div id="rt-status" class="rt-status muted">Sag zum Beispiel: „Friday, wie lange brauche ich nach Hamburg?“ oder „Wann fährt der nächste Zug nach Köln?“</div>
      <div id="rt-modi" class="rt-modi"></div>
      <div class="rt-haupt">
        <div class="rt-kartewrap"><div id="rt-karte" class="rt-karte" aria-label="Karte"></div><div id="rt-gkarte" class="rt-karte hidden" aria-label="Google-Karte"></div>
          <button type="button" id="rt-kartenwahl" class="rt-kartenwahl hidden" title="Karte wechseln">🗺 Google</button></div>
        <div id="rt-liste" class="rt-liste"></div>
      </div>
      <div class="rt-aktionen">
        <button type="button" id="rt-sprich" class="chip">🔊 Vorlesen</button>
        <a id="rt-apple" class="chip" target="_blank" rel="noopener">🍎 Apple Karten</a>
        <a id="rt-google" class="chip" target="_blank" rel="noopener">🗺 Google Maps</a>
      </div>
      <details id="rt-orte" class="rt-orte">
        <summary>⚙ Meine Orte &amp; Standort</summary>
        <div class="rt-ort"><span>🏠 Zuhause</span><input id="rt-heim" type="text" placeholder="Straße Nr., PLZ Ort"><button type="button" class="chip" data-ort="heim">Speichern</button></div>
        <div class="rt-ort"><span>💼 Arbeit</span><input id="rt-arbeit" type="text" placeholder="Straße Nr., PLZ Ort"><button type="button" class="chip" data-ort="arbeit">Speichern</button></div>
        <label class="rt-check"><input type="checkbox" id="rt-gps-an"> 📍 Friday darf den Standort dieses Geräts kennen. Dann rechnet „Wie lange brauche ich nach Hause?“ ab dort, wo du gerade bist – auch über Telegram oder Siri.</label>
        <div id="rt-standort" class="rt-standort muted"></div>
        <details class="rt-kb"><summary>Im Hintergrund orten (iPhone-Kurzbefehl)</summary>
          <p class="rt-klein">Eine Web-App darf den Standort nur orten, solange sie offen ist. Damit Friday es auch weiß, wenn sie zu ist, schickt ein Kurzbefehl den Standort: Kurzbefehle-App → <b>+</b> → „Aktuellen Standort abrufen“ → „Inhalte von URL abrufen“ an <code id="rt-kb-url">…/api/standort/kurzbefehl</code>, Methode POST, Header <code>Authorization</code> = <code>Bearer</code> + Kurzbefehl-Schlüssel, JSON <code>lat</code> = Breitengrad, <code>lon</code> = Längengrad. Dann unter Automation z. B. „Beim Verlassen von Arbeit“ oder stündlich ausführen. Genaue Schritte: Anleitung 52.</p>
        </details>
        <p class="muted rt-klein" id="rt-quelle">Ohne Google: Fahrzeiten ohne Stau-Daten (OpenStreetMap). Mit Google Maps (Verbindungen) mit Live-Verkehr und Abbiege-Hinweisen. Verbindungen von Transitous, Karten © OpenStreetMap, CARTO. Orte und Standort bleiben auf deinem Mac – gespeichert wird nur der letzte Punkt.</p>
      </details>
    </div>`;
  ($("app") || document.body).appendChild(sheet);
  const trigger = document.createElement("button");
  trigger.id = "routen-open"; trigger.className = "hidden"; trigger.setAttribute("aria-hidden", "true"); trigger.tabIndex = -1;
  document.body.appendChild(trigger);

  const style = document.createElement("style");
  style.textContent = `
.rt-box { width: min(1180px, 100%); max-height: 92vh; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.rt-box > .rt-haupt { flex: none; }
.rt-box > * { flex-shrink: 0; }
.rt-form { display: grid; grid-template-columns: 1fr auto; gap: 10px 14px; align-items: center; }
.rt-felder { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; }
.rt-feld { display: flex; align-items: center; gap: 8px; padding: 4px 6px 4px 8px; border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 12px; background: rgba(255,140,30,.05); min-width: 0; }
.rt-feld:focus-within { border-color: var(--u-rand, var(--cyan)); box-shadow: 0 0 14px color-mix(in srgb, var(--cyan) 30%, transparent); }
.rt-feld input, .rt-feld input:focus { flex: 1; min-width: 0; background: transparent !important; border: 0 !important; box-shadow: none !important; border-radius: 0 !important; outline: 0; color: var(--text); font: inherit; font-size: 15px; padding: 8px 2px; }
.rt-punkt { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 700; color: #120800; background: var(--cyan); box-shadow: 0 0 12px var(--cyan); }
.rt-punkt.b { background: #fff3e6; box-shadow: 0 0 12px rgba(255,220,180,.7); }
.rt-mini, .rt-tausch { flex: none; border: 1px solid var(--u-rand-soft, var(--line)); background: transparent; color: var(--text); border-radius: 9px; width: 34px; height: 34px; cursor: pointer; font-size: 15px; }
.rt-mini.an { border-color: var(--cyan); box-shadow: 0 0 10px var(--cyan); }
.rt-tausch:hover, .rt-mini:hover { border-color: var(--cyan); }
.rt-zeile { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.rt-zeile select, .rt-zeile input, .rt-ort input { background: rgba(255,140,30,.06); color: var(--text); border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 10px; padding: 8px 10px; font: inherit; }
.rt-go { white-space: nowrap; }
.rt-status { font-size: 13px; min-height: 18px; }
.rt-status.fehler { color: #ff5a4a; }
.rt-modi { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.rt-modus { position: relative; text-align: left; cursor: pointer; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--u-rand-soft, var(--line)); background: var(--u-karte, rgba(255,140,30,.05)); color: var(--text); font: inherit; overflow: hidden; transition: border-color .2s, box-shadow .2s, transform .15s; }
.rt-modus::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--m); box-shadow: 0 0 12px var(--m); opacity: .7; }
.rt-modus:hover { transform: translateY(-1px); }
.rt-modus.an { border-color: var(--m); box-shadow: 0 0 22px color-mix(in srgb, var(--m) 35%, transparent), inset 0 0 18px color-mix(in srgb, var(--m) 10%, transparent); }
.rt-modus.aus { opacity: .45; }
.rt-m-kopf { display: flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.rt-m-kopf i { font-style: normal; font-size: 18px; }
.rt-m-zeit { display: block; margin-top: 6px; font-family: var(--font-head, inherit); font-size: 22px; letter-spacing: .03em; color: var(--u-titel, #fff); text-shadow: 0 0 12px color-mix(in srgb, var(--m) 55%, transparent); white-space: nowrap; }
.rt-m-sub { display: block; font-size: 12px; color: var(--muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rt-modus.laedt .rt-m-zeit { opacity: .4; animation: rt-puls 1s ease-in-out infinite; }
@keyframes rt-puls { 50% { opacity: .9; } }
.rt-haupt { display: grid; grid-template-columns: 1.25fr 1fr; gap: 12px; flex: 1 1 auto; min-height: 0; }
.rt-kartewrap { position: relative; border-radius: 14px; overflow: hidden; border: 1px solid var(--u-rand-soft, var(--line)); min-height: 380px; background: #0b0603; }
.rt-karte { position: absolute; inset: 0; }
.rt-karte .leaflet-container, .rt-karte.leaflet-container { background: #0b0603; }
.rt-karte .leaflet-control-zoom a { background: rgba(14,8,3,.9); color: var(--text); border-color: var(--u-rand-soft, var(--line)); }
.rt-karte .leaflet-control-attribution { background: rgba(8,5,2,.7); color: var(--muted); font-size: 9px; }
.rt-karte .leaflet-control-attribution a { color: var(--muted); }
.rt-pin { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font: 700 12px/1 sans-serif; color: #120800; background: var(--cyan); box-shadow: 0 0 0 3px rgba(0,0,0,.5), 0 0 16px var(--cyan); }
.rt-pin.b { background: #fff3e6; box-shadow: 0 0 0 3px rgba(0,0,0,.5), 0 0 16px rgba(255,220,180,.9); }
.rt-karte-leer { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-size: 13px; text-align: center; padding: 20px; }
.rt-liste { overflow-y: auto; min-height: 0; max-height: 52vh; display: flex; flex-direction: column; gap: 8px; padding-right: 2px; }
.rt-vb { border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 12px; background: rgba(255,140,30,.04); cursor: pointer; transition: border-color .2s, box-shadow .2s; }
.rt-vb:hover { border-color: var(--u-rand, var(--cyan)); }
.rt-vb.an { border-color: #ffc44d; box-shadow: 0 0 18px rgba(255,196,77,.22); }
.rt-vb.ausfall { border-color: rgba(255,90,74,.6); }
.rt-vb-kopf { display: grid; grid-template-columns: auto 1fr auto; gap: 4px 12px; padding: 10px 12px; align-items: center; }
.rt-vb-zeit { font-family: var(--font-head, inherit); font-size: 17px; color: var(--u-titel, #fff); white-space: nowrap; }
.rt-vb-zeit small { font-size: 12px; margin-left: 3px; }
.rt-vb-dauer { text-align: right; font-size: 12px; color: var(--muted); white-space: nowrap; }
.rt-vb-dauer b { display: block; font-size: 14px; color: var(--text); }
.rt-linien { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.rt-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; border: 1px solid color-mix(in srgb, var(--lc, #ffc44d) 70%, transparent); background: color-mix(in srgb, var(--lc, #ffc44d) 18%, transparent); color: #fff; white-space: nowrap; }
.rt-chip.fuss { border-style: dashed; background: transparent; color: var(--muted); font-weight: 400; }
.rt-pfeil { color: var(--muted); font-size: 11px; }
.rt-vb-ab { grid-column: 1 / -1; font-size: 12px; color: var(--muted); }
.rt-spaet { color: #ff5a4a; font-weight: 600; }
.rt-puenktlich { color: #6ee7a0; }
.rt-weg { display: none; padding: 4px 12px 12px 12px; }
.rt-vb.offen .rt-weg { display: block; }
.rt-schritt { display: grid; grid-template-columns: 46px 16px 1fr; gap: 0 8px; font-size: 13px; }
.rt-schritt .t { color: var(--u-titel, #fff); font-variant-numeric: tabular-nums; padding-top: 1px; }
.rt-schritt .s { position: relative; }
.rt-schritt .s::before { content: ""; position: absolute; left: 7px; top: 0; bottom: 0; width: 2px; background: var(--lc, var(--cyan)); opacity: .8; }
.rt-schritt.fuss .s::before { background: none; border-left: 2px dotted var(--muted); }
.rt-schritt .s::after { content: ""; position: absolute; left: 3px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: #0b0603; border: 2px solid var(--lc, var(--cyan)); }
.rt-schritt .i { padding-bottom: 10px; }
.rt-schritt .i small { display: block; color: var(--muted); font-size: 12px; }
.rt-karte-info { border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 12px; padding: 14px; background: rgba(255,140,30,.04); }
.rt-karte-info h3 { margin: 0 0 6px; }
.rt-gross { font-family: var(--font-head, inherit); font-size: 30px; color: var(--u-titel, #fff); text-shadow: 0 0 14px color-mix(in srgb, var(--m, var(--cyan)) 55%, transparent); }
.rt-aktionen { display: flex; gap: 8px; flex-wrap: wrap; }
.rt-aktionen a.chip { text-decoration: none; }
.rt-orte { border-top: 1px solid var(--u-rand-soft, var(--line)); padding-top: 10px; }
.rt-kartenwahl { position: absolute; right: 10px; top: 10px; z-index: 500; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(14,8,3,.88); color: var(--text); border-radius: 10px; padding: 6px 10px; font: inherit; font-size: 12px; cursor: pointer; }
.rt-kartenwahl:hover { border-color: var(--cyan); }
.rt-standort { font-size: 12px; margin: 8px 0 0 26px; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
.rt-standort .chip { padding: 3px 9px; font-size: 12px; }
.rt-standort .live { color: #6ee7a0; }
.rt-kb { margin: 8px 0 0 26px; font-size: 12px; }
.rt-kb summary { cursor: pointer; color: var(--muted); }
.rt-kb code { font-size: 11px; word-break: break-all; background: rgba(255,140,30,.08); padding: 0 4px; border-radius: 4px; }
.rt-schritte { margin-top: 10px; display: flex; flex-direction: column; gap: 2px; max-height: 34vh; overflow-y: auto; }
.rt-sch { display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: baseline; padding: 6px 4px; border-bottom: 1px solid rgba(255,140,30,.08); font-size: 13px; cursor: pointer; }
.rt-sch:hover { background: rgba(255,140,30,.06); }
.rt-sch i { font-style: normal; color: var(--cyan); text-align: center; font-size: 15px; }
.rt-sch small { color: var(--muted); white-space: nowrap; }
.rt-stau { color: #ff5a4a; font-weight: 600; }
.rt-frei { color: #6ee7a0; }
.rt-hint { position: fixed; left: 50%; bottom: calc(86px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 90; width: min(440px, calc(100% - 32px)); padding: 12px 14px; border-radius: 14px; border: 1px solid var(--u-rand, var(--cyan)); background: rgba(14,8,3,.95); box-shadow: 0 0 24px color-mix(in srgb, var(--cyan) 30%, transparent); font-size: 13px; display: grid; gap: 8px; }
.rt-hint div { display: flex; gap: 8px; justify-content: flex-end; }
.rt-orte summary { cursor: pointer; color: var(--muted); font-size: 13px; letter-spacing: .04em; }
.rt-ort { display: grid; grid-template-columns: 96px 1fr auto; gap: 8px; align-items: center; margin-top: 10px; }
.rt-check { display: flex; gap: 8px; align-items: flex-start; margin-top: 12px; font-size: 13px; }
.rt-klein { font-size: 11px; margin: 10px 0 0; }
@media (max-width: 900px) {
  .rt-form { grid-template-columns: 1fr; }
  .rt-felder { grid-template-columns: 1fr; }
  .rt-felder { position: relative; gap: 10px; }
  .rt-tausch { position: absolute; right: 54px; top: 50%; transform: translateY(-50%); z-index: 2; height: 30px; width: 30px; border-radius: 50%; background: rgba(14,8,3,.96); }
  .rt-zeile { justify-content: stretch; }
  .rt-zeile > * { flex: 1; }
  .rt-feld input, .rt-zeile select, .rt-zeile input, .rt-ort input { font-size: 16px; }
  .rt-modi { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .rt-modus { padding: 10px 12px; }
  .rt-m-zeit { font-size: 19px; }
  .rt-haupt { grid-template-columns: 1fr; }
  .rt-kartewrap { min-height: 240px; height: 42vh; }
  .rt-liste { max-height: none; overflow: visible; }
  .rt-ort { grid-template-columns: 1fr auto; }
  .rt-ort span { grid-column: 1 / -1; }
}
`;
  document.head.appendChild(style);

  // ---------- Hilfen ----------
  const uhr = (iso) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  function dauer(sek) {
    const min = Math.max(1, Math.round(sek / 60));
    if (min < 60) return `${min} Min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} Std ${m}` : `${h} Std`;
  }
  const km = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString("de-DE", { maximumFractionDigits: m < 10000 ? 1 : 0 })} km`);
  const halt = (n) => String(n || "").replace(/\s*\((?:Berlin|Hamburg|München|Köln)\)$/, "");
  const verspaetung = (min) => (min >= 2 ? ` <span class="rt-spaet">+${min}</span>` : min <= -2 ? "" : "");

  const farbe = (f, std = "#ffc44d") => (/^#[0-9a-f]{6}$/i.test(f || "") ? f : std);

  let aktuell = null, modus = "auto", gewaehlt = 0;

  // ---------- Standort ----------
  const gpsAn = () => ls.get("routen_gps") === "1";
  function letzterStandort(maxAlterMin = 30) {
    try {
      const p = JSON.parse(ls.get("routen_pos") || "null");
      if (p && Date.now() - p.at < maxAlterMin * 60000) return { lat: p.lat, lon: p.lon };
    } catch { /* egal */ }
    return null;
  }
  function holeStandort() {
    return new Promise((ok, nein) => {
      if (!navigator.geolocation) return nein(new Error("Dieses Gerät gibt keinen Standort heraus."));
      navigator.geolocation.getCurrentPosition((pos) => {
        const p = { lat: +pos.coords.latitude.toFixed(5), lon: +pos.coords.longitude.toFixed(5), genau: Math.round(pos.coords.accuracy || 0), at: Date.now() };
        ls.set("routen_pos", JSON.stringify(p));
        if (gpsAn()) senden(p);
        ok(p);
      }, (err) => nein(new Error(err.code === 1 ? "Standort nicht erlaubt. In Safari/Einstellungen den Standort für Friday zulassen." : "Standort gerade nicht verfügbar.")), { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 });
    });
  }
  // v1.157.0: Solange Friday offen ist, laufend orten und den letzten Punkt an den Mac schicken.
  // So weiß Friday auch über Telegram/Siri, wo Boss gerade ist. Nur wenn auf diesem Gerät erlaubt.
  let beobachter = null, gesendet = null, serverAn = true;
  const geraet = /iPhone/.test(navigator.userAgent) ? "iPhone" : /iPad/.test(navigator.userAgent) ? "iPad" : /Mac/.test(navigator.userAgent) ? "Mac" : "Gerät";
  const abstand = (a, b) => {
    const r = Math.PI / 180, x = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(x));
  };
  function senden(p) {
    if (!serverAn) return;
    if (gesendet && Date.now() - gesendet.at < 3 * 60000 && abstand(gesendet, p) < 120) return; // höchstens alle 3 Min, außer man bewegt sich
    gesendet = { lat: p.lat, lon: p.lon, at: Date.now() };
    api("/api/standort", { method: "POST", body: JSON.stringify({ lat: p.lat, lon: p.lon, genau: p.genau, geraet }) })
      .then((r) => r.json()).then((d) => { if (d?.aus) serverAn = false; if (!sheet.classList.contains("hidden")) standortAnzeigen(); }).catch(() => { gesendet = null; });
  }
  function neuePosition(pos) {
    const p = { lat: +pos.coords.latitude.toFixed(5), lon: +pos.coords.longitude.toFixed(5), genau: Math.round(pos.coords.accuracy || 0), at: Date.now() };
    ls.set("routen_pos", JSON.stringify(p));
    senden(p);
  }
  function ortungStarten() {
    if (!gpsAn() || beobachter !== null || !navigator.geolocation || document.visibilityState !== "visible") return;
    beobachter = navigator.geolocation.watchPosition(neuePosition, (err) => {
      if (err.code === 1) { ortungStoppen(); ls.set("routen_gps", "0"); $("rt-gps-an").checked = false; }
    }, { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 });
  }
  function ortungStoppen() {
    if (beobachter !== null) { try { navigator.geolocation.clearWatch(beobachter); } catch { /* egal */ } }
    beobachter = null;
  }
  document.addEventListener("visibilitychange", () => (document.visibilityState === "visible" ? ortungStarten() : ortungStoppen()));
  setTimeout(() => {
    api("/api/standort").then((r) => r.json()).then((d) => { serverAn = d.an !== false; ortungStarten(); }).catch(ortungStarten);
  }, 3000);

  // Einmalig fragen (pro Gerät), ob Friday den Standort kennen darf – Boss wollte das ausdrücklich.
  function standortFragen() {
    if (gpsAn() || ls.get("routen_gps") === "0" || ls.get("routen_gps_gefragt") || !navigator.geolocation) return;
    ls.set("routen_gps_gefragt", "1");
    const h = document.createElement("div");
    h.className = "rt-hint panel"; h.setAttribute("role", "dialog");
    h.innerHTML = `<span>📍 Soll Friday wissen, wo du bist? Dann rechnet „Wie lange brauche ich nach Hause?“ ab deinem aktuellen Ort. Der Standort bleibt auf deinem Mac.</span><div><button type="button" class="ghost small" data-n>Später</button><button type="button" class="chip primary" data-j>Erlauben</button></div>`;
    document.body.appendChild(h);
    h.querySelector("[data-n]").onclick = () => h.remove();
    h.querySelector("[data-j]").onclick = async () => {
      h.remove();
      try { const p = await holeStandort(); ls.set("routen_gps", "1"); serverAn = true; await api("/api/standort", { method: "POST", body: JSON.stringify({ an: true }) }).catch(() => {}); gesendet = null; senden(p); ortungStarten(); F.say?.("Alles klar, Boss. Ich weiß jetzt, wo du bist."); }
      catch (err) { F.say?.(err.message); }
    };
  }
  setTimeout(standortFragen, 9000);

  function vorMin(at) {
    const min = Math.round((Date.now() - at) / 60000);
    return min < 2 ? "gerade eben" : min < 60 ? `vor ${min} Min` : min < 48 * 60 ? `vor ${Math.round(min / 60)} Std` : `vor ${Math.round(min / 1440)} Tagen`;
  }
  async function standortAnzeigen() {
    const box = $("rt-standort");
    if (!box) return;
    try {
      const d = await (await api("/api/standort")).json();
      serverAn = d.an !== false;
      const p = d.pos;
      const teile_ = [];
      if (!d.an) teile_.push("Friday merkt sich gerade keinen Standort.");
      else if (p) teile_.push(`${beobachter !== null && Date.now() - p.at < 5 * 60000 ? '<span class="live">● live</span> ' : ""}Zuletzt ${esc(vorMin(p.at))}${p.ort ? ` in <b>${esc(p.ort)}</b>` : ""} · ${p.quelle === "kurzbefehl" ? "Kurzbefehl" : esc(p.geraet || "App")}${p.genau ? ` · ±${p.genau} m` : ""}`);
      else teile_.push("Noch kein Standort gemerkt.");
      box.innerHTML = `<span>${teile_.join("")}</span>${p ? '<button type="button" class="ghost small chip" id="rt-st-weg">Vergessen</button>' : ""}<button type="button" class="ghost small chip" id="rt-st-schalter">${d.an ? "Ganz ausschalten" : "Wieder einschalten"}</button>`;
      $("rt-st-weg")?.addEventListener("click", async () => { await api("/api/standort/vergessen", { method: "POST", body: "{}" }); gesendet = null; standortAnzeigen(); });
      $("rt-st-schalter")?.addEventListener("click", async () => {
        await api("/api/standort", { method: "POST", body: JSON.stringify({ an: !d.an }) });
        serverAn = !d.an; gesendet = null;
        if (!serverAn) { ortungStoppen(); ls.set("routen_gps", "0"); $("rt-gps-an").checked = false; $("rt-gps").classList.remove("an"); }
        standortAnzeigen();
      });
    } catch { box.textContent = ""; }
    const u = $("rt-kb-url"); if (u) u.textContent = `${location.origin}/api/standort/kurzbefehl`;
  }

  // ---------- Karte ----------
  let karte = null, ebenen = null, leafletLaden = null;
  function ladeLeaflet() {
    if (window.L?.map) return Promise.resolve();
    leafletLaden ??= (async () => {
      if (!document.getElementById("leaflet-css")) {
        const l = document.createElement("link"); l.id = "leaflet-css"; l.rel = "stylesheet";
        l.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"; document.head.append(l);
      }
      const m = await import("https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet-src.esm.js");
      window.L = window.L?.map ? window.L : m;
    })().catch((e) => { leafletLaden = null; throw e; });
    return leafletLaden;
  }
  // ---------- Google-Karte (wenn in Verbindungen eingerichtet) ----------
  let gInfo = null, gLaden = null, gKarte = null, gTeile = [], gVerkehr = null;
  let kartenArt = ls.get("routen_karte") || "google";
  async function googleInfo() {
    if (gInfo) return gInfo;
    try { gInfo = await (await api("/api/routen/googlekarte")).json(); } catch { gInfo = { an: false }; }
    return gInfo;
  }
  function ladeGoogle(key) {
    if (window.google?.maps?.Map) return Promise.resolve();
    gLaden ??= new Promise((ok, nein) => {
      window.__fridayGoogleBereit = () => ok();
      window.gm_authFailure = () => { gInfo = { an: false, fehler: true }; nein(new Error("Google lehnt den Schlüssel für die Karte ab. In der Google Cloud Console die „Maps JavaScript API“ aktivieren.")); };
      const sc = document.createElement("script");
      sc.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=de&region=DE&callback=__fridayGoogleBereit`;
      sc.async = true; sc.onerror = () => nein(new Error("Google-Karte nicht ladbar."));
      document.head.appendChild(sc);
    }).catch((e) => { gLaden = null; throw e; });
    return gLaden;
  }
  const G_STIL = [
    { elementType: "geometry", stylers: [{ color: "#120b06" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#c9a88a" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0b0603" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a1a0e" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4a2a10" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#06101a" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#24170c" }] },
  ];
  async function googleZeichnen() {
    const info = await googleInfo();
    const wahl = $("rt-kartenwahl");
    wahl.classList.toggle("hidden", !info.an);
    const nutzen = info.an && kartenArt === "google";
    wahl.textContent = nutzen ? "🌙 Friday-Karte" : "🗺 Google-Karte";
    $("rt-gkarte").classList.toggle("hidden", !nutzen);
    $("rt-karte").classList.toggle("hidden", nutzen);
    if (!nutzen || !aktuell) return nutzen;
    try { await ladeGoogle(info.key); } catch (err) { $("rt-status").textContent = err.message; kartenArt = "friday"; $("rt-gkarte").classList.add("hidden"); $("rt-karte").classList.remove("hidden"); wahl.classList.add("hidden"); return false; }
    const g = window.google.maps;
    if (!gKarte) {
      gKarte = new g.Map($("rt-gkarte"), { styles: G_STIL, disableDefaultUI: true, zoomControl: true, mapTypeControl: true, mapTypeControlOptions: { style: g.MapTypeControlStyle.DROPDOWN_MENU, position: g.ControlPosition.LEFT_TOP }, gestureHandling: "greedy", backgroundColor: "#0b0603" });
      gVerkehr = new g.TrafficLayer();
    }
    gTeile.forEach((x) => x.setMap(null)); gTeile = [];
    const d = aktuell, grenzen = new g.LatLngBounds();
    const pfad = (pts) => pts.map(([la, lo]) => { const p = { lat: la, lng: lo }; grenzen.extend(p); return p; });
    const linie = (pts, farbe, gewicht = 5, gestrichelt = false) => {
      if (!pts?.length) return;
      const path = pfad(pts);
      if (gestrichelt) gTeile.push(new g.Polyline({ map: gKarte, path, strokeOpacity: 0, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, strokeColor: farbe, scale: 2 }, offset: "0", repeat: "10px" }] }));
      else {
        gTeile.push(new g.Polyline({ map: gKarte, path, strokeColor: farbe, strokeOpacity: 0.25, strokeWeight: gewicht + 8 }));
        gTeile.push(new g.Polyline({ map: gKarte, path, strokeColor: farbe, strokeOpacity: 0.95, strokeWeight: gewicht }));
      }
    };
    const m = MODI.find((x) => x.id === modus);
    if (modus === "oepnv") {
      const v = d.oepnv.verbindungen?.[gewaehlt];
      for (const a of v?.abschnitte || []) linie(a.punkte, a.fuss ? "#e8dccd" : farbe(a.farbe, m.farbe), a.fuss ? 3 : 5, a.fuss);
      gVerkehr.setMap(null);
    } else {
      const r = d[modus];
      linie(r?.linie, m.farbe);
      for (const st of r?.stau || []) linie(r.linie.slice(st.von, st.bis + 1), st.tempo === "stau" ? "#ff3b30" : "#ffb020", 6);
      gVerkehr.setMap(modus === "auto" ? gKarte : null);
    }
    const pin = (p, txt, hell) => gTeile.push(new g.Marker({ map: gKarte, position: { lat: p.lat, lng: p.lon }, title: p.label || p.name, label: { text: txt, color: "#120800", fontWeight: "700" }, icon: { path: g.SymbolPath.CIRCLE, scale: 13, fillColor: hell ? "#fff3e6" : "#ff8a2a", fillOpacity: 1, strokeColor: "#000", strokeWeight: 2 } }));
    pin(d.von, "A"); pin(d.nach, "B", true);
    grenzen.extend({ lat: d.von.lat, lng: d.von.lon }); grenzen.extend({ lat: d.nach.lat, lng: d.nach.lon });
    setTimeout(() => gKarte.fitBounds(grenzen, 40), 40);
    return true;
  }
  function zuPunkt(lat, lon) {
    if (gKarte && kartenArt === "google" && !$("rt-gkarte").classList.contains("hidden")) { gKarte.panTo({ lat, lng: lon }); gKarte.setZoom(17); }
    else if (karte) karte.setView([lat, lon], 17);
  }

  async function karteZeichnen() {
    if (await googleZeichnen()) return;
    const box = $("rt-karte");
    if (!aktuell) { box.innerHTML = '<div class="rt-karte-leer">Hier erscheint die Route.</div>'; return; }
    try { await ladeLeaflet(); } catch { box.innerHTML = '<div class="rt-karte-leer">Karte gerade nicht ladbar – die Zeiten stimmen trotzdem.</div>'; return; }
    const L = window.L;
    if (!karte) {
      box.innerHTML = "";
      karte = L.map(box, { zoomControl: true, attributionControl: true });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, subdomains: "abcd", attribution: "© OpenStreetMap, © CARTO" }).addTo(karte);
      ebenen = L.layerGroup().addTo(karte);
    }
    ebenen.clearLayers();
    const d = aktuell;
    const grenzen = L.latLngBounds([[d.von.lat, d.von.lon], [d.nach.lat, d.nach.lon]]);
    const linie = (pts, farbe, opt = {}) => {
      if (!pts?.length) return;
      if (!opt.dashArray) L.polyline(pts, { color: farbe, weight: (opt.weight || 5) + 8, opacity: 0.18, interactive: false }).addTo(ebenen); // Glow
      L.polyline(pts, { color: farbe, weight: opt.weight || 5, opacity: opt.opacity ?? 0.95, dashArray: opt.dashArray, lineCap: "round" }).addTo(ebenen);
      pts.forEach((p) => grenzen.extend(p));
    };
    // Erst die anderen Wege blass, dann der gewählte leuchtend
    for (const m of MODI) {
      if (m.id === modus || m.id === "oepnv") continue;
      const r = d[m.id];
      if (r?.linie?.length) L.polyline(r.linie, { color: m.farbe, weight: 3, opacity: 0.28, interactive: false }).addTo(ebenen);
    }
    const m = MODI.find((x) => x.id === modus);
    if (modus === "oepnv") {
      const v = d.oepnv.verbindungen?.[gewaehlt];
      for (const a of v?.abschnitte || []) {
        if (a.fuss) linie(a.punkte, "#e8dccd", { weight: 3, dashArray: "2 8", opacity: 0.8 });
        else linie(a.punkte, farbe(a.farbe, m.farbe), { weight: 5 });
      }
      for (const a of (v?.abschnitte || []).filter((x) => !x.fuss)) {
        const p = a.punkte?.[0];
        if (p) L.circleMarker(p, { radius: 5, color: "#0b0603", weight: 2, fillColor: "#ffc44d", fillOpacity: 1 }).bindTooltip(`${a.linie} · ${uhr(a.ab)} ${halt(a.von)}`).addTo(ebenen);
      }
    } else {
      const r = d[modus];
      linie(r?.linie, m.farbe);
      // Stau-Stellen (nur mit Google): rot = Stau, gelb = zäh
      for (const st of r?.stau || []) {
        const teil = r.linie.slice(st.von, st.bis + 1);
        if (teil.length > 1) L.polyline(teil, { color: st.tempo === "stau" ? "#ff3b30" : "#ffb020", weight: 6, opacity: 0.95, lineCap: "round" }).bindTooltip(st.tempo === "stau" ? "Stau" : "Zäher Verkehr").addTo(ebenen);
      }
    }
    const pin = (p, txt, b) => L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "", html: `<div class="rt-pin${b ? " b" : ""}">${txt}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) }).bindTooltip(esc(p.label || p.name)).addTo(ebenen);
    pin(d.von, "A"); pin(d.nach, "B", true);
    setTimeout(() => { karte.invalidateSize(); karte.fitBounds(grenzen, { padding: [30, 30], maxZoom: 16 }); }, 40);
  }

  // ---------- Anzeige ----------
  function kacheln() {
    const d = aktuell;
    $("rt-modi").innerHTML = MODI.map((m) => {
      let zeit = "–", sub = "", aus = false;
      if (!d) { sub = m.id === "oepnv" ? "Abfahrten & Gleise" : "Fahrzeit"; }
      else if (m.id === "oepnv") {
        const v = d.oepnv.verbindungen?.find((x) => !x.ausfall) || d.oepnv.verbindungen?.[0];
        if (v) { zeit = dauer(v.dauer); sub = `ab ${uhr(v.erste?.ab || v.ab)} · ${v.umstiege === 0 ? "direkt" : `${v.umstiege}× umst.`}`; }
        else { aus = true; sub = d.oepnv.zuNah ? "zu nah" : d.oepnv.fehler ? "gerade nicht erreichbar" : "keine Verbindung"; }
      } else {
        const r = d[m.id];
        if (r?.dauer) {
          zeit = dauer(r.dauer);
          const stau = r.verkehr ? Math.round((r.dauer - (r.dauerOhneStau || r.dauer)) / 60) : 0;
          sub = `${km(r.distanz)} · an ${uhr(Date.now() + r.dauer * 1000)}${stau >= 3 ? ` · +${stau} Stau` : r.verkehr ? " · frei" : ""}`;
        }
        else { aus = true; sub = r?.zuWeit ? "zu weit" : "nicht berechnet"; }
      }
      return `<button type="button" class="rt-modus${m.id === modus ? " an" : ""}${aus ? " aus" : ""}" data-modus="${m.id}" style="--m:${m.farbe}">
        <span class="rt-m-kopf"><i>${m.icon}</i>${m.name}</span><span class="rt-m-zeit">${zeit}</span><span class="rt-m-sub">${esc(sub)}</span></button>`;
    }).join("");
  }

  function linienChips(v) {
    const out = [];
    v.abschnitte.forEach((a, i) => {
      if (a.fuss) { if (a.dauer >= 120 || i === 0) out.push(`<span class="rt-chip fuss">🚶 ${Math.round(a.dauer / 60)}′</span>`); }
      else out.push(`<span class="rt-chip" style="--lc:${farbe(a.farbe)}">${a.icon} ${esc(a.linie)}</span>`);
    });
    return out.join('<span class="rt-pfeil">›</span>');
  }

  function wegListe(v) {
    const zeilen = [];
    for (const a of v.abschnitte) {
      const lc = a.fuss ? "" : `--lc:${farbe(a.farbe)}`;
      const gleis = a.gleisAb ? ` · ${/^\d/.test(a.gleisAb) ? "Gleis " : ""}${esc(a.gleisAb)}` : "";
      if (a.fuss) {
        zeilen.push(`<div class="rt-schritt fuss"><span class="t">${uhr(a.ab)}</span><span class="s"></span><span class="i">🚶 ${Math.max(1, Math.round(a.dauer / 60))} Min zu Fuß${a.distanz ? ` (${km(a.distanz)})` : ""}<small>bis ${esc(halt(a.nach))}</small></span></div>`);
      } else {
        zeilen.push(`<div class="rt-schritt" style="${lc}"><span class="t">${uhr(a.ab)}${verspaetung(a.verspaetungAb)}</span><span class="s"></span><span class="i"><b>${esc(halt(a.von))}</b>${gleis}<small>${a.icon} ${esc(a.linie)}${a.richtung ? ` → ${esc(a.richtung)}` : ""}${a.halte ? ` · ${a.halte} Halte` : ""}${a.reservierung ? " · Reservierung nötig" : ""}${a.ausfall ? ' · <span class="rt-spaet">fällt aus</span>' : ""}</small></span></div>`);
        zeilen.push(`<div class="rt-schritt" style="${lc}"><span class="t">${uhr(a.an)}${verspaetung(a.verspaetungAn)}</span><span class="s"></span><span class="i"><b>${esc(halt(a.nach))}</b>${a.gleisAn ? ` · ${/^\d/.test(a.gleisAn) ? "Gleis " : ""}${esc(a.gleisAn)}` : ""}</span></div>`);
      }
    }
    zeilen.push(`<div class="rt-schritt fuss"><span class="t">${uhr(v.an)}</span><span class="s"></span><span class="i"><b>🏁 ${esc(aktuell.nach.name)}</b></span></div>`);
    return zeilen.join("");
  }

  function liste() {
    const d = aktuell, box = $("rt-liste");
    if (!d) { box.innerHTML = ""; return; }
    const m = MODI.find((x) => x.id === modus);
    if (modus === "oepnv") {
      const vs = d.oepnv.verbindungen || [];
      if (!vs.length) {
        box.innerHTML = `<div class="rt-karte-info"><h3>🚆 Bahn &amp; Bus</h3><p class="muted">${d.oepnv.zuNah ? "Das Ziel ist so nah, dass sich Bahn und Bus nicht lohnen." : d.oepnv.fehler ? "Der Fahrplan-Dienst antwortet gerade nicht. Versuch es gleich noch mal." : "Für diese Strecke habe ich keine Verbindung gefunden."}</p></div>`;
        return;
      }
      box.innerHTML = vs.map((v, i) => {
        const e = v.erste;
        const ab = e?.ab || v.ab;
        const status = e?.verspaetung >= 2 ? `<span class="rt-spaet">+${e.verspaetung} Min</span>` : v.abschnitte.some((a) => a.echtzeit) ? '<span class="rt-puenktlich">pünktlich</span>' : "";
        return `<div class="rt-vb${i === gewaehlt ? " an offen" : ""}${v.ausfall ? " ausfall" : ""}" data-vb="${i}" role="button" tabindex="0">
          <div class="rt-vb-kopf">
            <span class="rt-vb-zeit">${uhr(ab)}<small>→ ${uhr(v.an)}</small></span>
            <span class="muted" style="font-size:12px">${status}${v.ausfall ? ' <span class="rt-spaet">Ausfall</span>' : ""}</span>
            <span class="rt-vb-dauer"><b>${dauer(v.dauer)}</b>${v.umstiege === 0 ? "direkt" : `${v.umstiege}× umsteigen`}</span>
            <div class="rt-linien">${linienChips(v)}</div>
            ${e?.von ? `<div class="rt-vb-ab">ab ${esc(halt(e.von))}${e.gleis ? ` · ${/^\d/.test(e.gleis) ? "Gleis " : ""}${esc(e.gleis)}` : ""}</div>` : ""}
          </div>
          <div class="rt-weg">${wegListe(v)}</div>
        </div>`;
      }).join("") + `<button type="button" class="chip" id="rt-spaeter">Spätere Verbindungen</button>`;
      return;
    }
    const r = d[modus];
    if (!r?.dauer) {
      box.innerHTML = `<div class="rt-karte-info" style="--m:${m.farbe}"><h3>${m.icon} ${m.name}</h3><p class="muted">${r?.zuWeit ? `Zu weit – Luftlinie ${km(d.luftlinie)}.` : "Diese Strecke konnte ich gerade nicht berechnen."}</p></div>`;
      return;
    }
    const an = Date.now() + r.dauer * 1000;
    box.innerHTML = `<div class="rt-karte-info" style="--m:${m.farbe}">
      <h3>${m.icon} ${m.name}</h3>
      <div class="rt-gross">${dauer(r.dauer)}</div>
      <p>${km(r.distanz)} · Ankunft ca. <b>${uhr(an)} Uhr</b>, wenn du jetzt losfährst.</p>
      ${r.ueber ? `<p>über <b>${esc(r.ueber)}</b></p>` : ""}
      ${verkehrZeile(r)}
      <p class="muted rt-klein">Von <b>${esc(d.von.label || d.von.name)}</b>${d.von.standortAlter ? ` (Standort ${esc(vorMin(Date.now() - d.von.standortAlter * 60000))})` : ""}<br>nach <b>${esc(d.nach.label || d.nach.name)}</b></p>
      ${modus === "auto" && !r.verkehr ? `<p class="muted rt-klein">Ohne aktuelle Stau-Infos${r.googleFehler ? ` (Google: ${esc(r.googleFehler)})` : ". Mit Google Maps (Werkzeug-Menü → Verbindungen) rechnet Friday mit Live-Verkehr"}.</p>` : ""}
      ${r.schritte?.length ? `<div class="rt-schritte">${r.schritte.map((x) => `<div class="rt-sch"${x.lat ? ` data-lat="${x.lat}" data-lon="${x.lon}"` : ""}><i>${esc(x.icon)}</i><span>${esc(x.text)}</span><small>${x.distanz ? km(x.distanz) : ""}</small></div>`).join("")}<div class="rt-sch"><i>🏁</i><span>Ziel: ${esc(d.nach.label || d.nach.name)}</span><small></small></div></div>` : ""}
      <p class="muted rt-klein">Weg: ${esc(r.quelle || "OpenStreetMap")}</p>
    </div>`;
  }

  function verkehrZeile(r) {
    if (!r.verkehr) return "";
    const stau = Math.round((r.dauer - (r.dauerOhneStau || r.dauer)) / 60);
    return stau >= 3 ? `<p class="rt-stau">🚦 ${stau} Min Verzögerung durch Verkehr</p>` : '<p class="rt-frei">🟢 Verkehr frei</p>';
  }

  function links() {
    const d = aktuell, m = MODI.find((x) => x.id === modus);
    const a = $("rt-apple"), g = $("rt-google");
    if (!d) { a.removeAttribute("href"); g.removeAttribute("href"); return; }
    const s = `${d.von.lat},${d.von.lon}`, z = `${d.nach.lat},${d.nach.lon}`;
    a.href = `https://maps.apple.com/?saddr=${s}&daddr=${z}&dirflg=${m.apple}`;
    g.href = `https://www.google.com/maps/dir/?api=1&origin=${s}&destination=${z}&travelmode=${m.google}`;
  }

  function zeigen() { kacheln(); liste(); links(); karteZeichnen(); }

  function uebernehmen(d) {
    aktuell = d;
    gewaehlt = Math.max(0, (d.oepnv.verbindungen || []).findIndex((v) => !v.ausfall));
    // Gewünschtes Verkehrsmittel vorn, sonst das schnellste
    if (d.modus) modus = d.modus;
    else {
      const zeiten = [["auto", d.auto?.dauer], ["oepnv", d.oepnv.verbindungen?.[gewaehlt]?.dauer], ["rad", d.rad?.dauer && d.rad.dauer < 3600 ? d.rad.dauer : null], ["fuss", d.fuss?.dauer && d.fuss.dauer < 1500 ? d.fuss.dauer : null]];
      modus = d.fuss?.dauer && d.fuss.dauer < 1200 ? "fuss" : d.auto?.dauer ? "auto" : (zeiten.find(([, t]) => t)?.[0] || "auto");
    }
    $("rt-von").value = d.von.art === "heim" ? "Zuhause" : d.von.art === "standort" ? "📍 Mein Standort" : d.von.art === "stadt" ? "" : d.von.label || d.von.name;
    $("rt-nach").value = d.nach.art === "heim" ? "Zuhause" : d.nach.art === "arbeit" ? "Arbeit" : d.nach.label || d.nach.name;
    const st = $("rt-status");
    st.classList.remove("fehler");
    st.innerHTML = `<b>${esc(d.von.name)}</b> → <b>${esc(d.nach.name)}</b> · Luftlinie ${km(d.luftlinie)}${d.zeit ? ` · ${d.ankunft ? "Ankunft" : "Abfahrt"} ${new Date(d.zeit).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : ""}${d.hinweis ? `<br>${esc(d.hinweis)}` : ""}`;
    zeigen();
  }

  function laedt(text) {
    const st = $("rt-status");
    st.classList.remove("fehler"); st.textContent = text;
    document.querySelectorAll(".rt-modus").forEach((b) => b.classList.add("laedt"));
  }
  function fehler(text) {
    const st = $("rt-status");
    st.classList.add("fehler"); st.textContent = text;
    document.querySelectorAll(".rt-modus").forEach((b) => b.classList.remove("laedt"));
  }

  // ---------- Berechnen ----------
  let vonStandort = null;
  async function berechnen(extra = {}) {
    const nach = $("rt-nach").value.trim();
    if (!nach) { fehler("Wohin soll es gehen? Trag ein Ziel ein."); $("rt-nach").focus(); return; }
    let von = $("rt-von").value.trim();
    const body = { nach, modus: aktuell && modus ? modus : "" };
    if (von === "📍 Mein Standort" || (!von && gpsAn())) {
      const p = vonStandort || letzterStandort(10) || await holeStandort().catch((e) => { fehler(e.message); return null; });
      if (!p) return;
      body.standort = { lat: p.lat, lon: p.lon };
      von = "";
    }
    if (von === "Zuhause") body.von = "zuhause";
    else if (von) body.von = von;
    const wann = $("rt-wann").value;
    if (wann !== "jetzt" && $("rt-zeit").value) { body.zeit = new Date($("rt-zeit").value).toISOString(); body.ankunft = wann === "an"; }
    Object.assign(body, extra);
    laedt("Friday rechnet die Route …");
    try {
      const r = await api("/api/routen/planen", { method: "POST", body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Fehler");
      uebernehmen(d);
    } catch (err) {
      fehler(err.message);
    }
  }

  async function ladeErgebnis(id) {
    oeffnen();
    laedt("Lade Route …");
    try {
      const r = await api(`/api/routen/ergebnis/${encodeURIComponent(id)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Fehler");
      uebernehmen(d);
    } catch (err) { fehler(err.message); }
  }

  async function orteLaden() {
    try {
      const r = await api("/api/routen/orte");
      const o = await r.json();
      $("rt-heim").value = o.heim?.text || "";
      $("rt-arbeit").value = o.arbeit?.text || "";
      if (!o.heim && !gpsAn()) $("rt-orte").open = true;
      const st = await (await api("/api/standort")).json().catch(() => ({}));
      const frisch = st.an && st.frisch;
      $("rt-von").placeholder = frisch ? "📍 Mein Standort" : o.heim ? "Zuhause" : "Start, z. B. deine Adresse";
    } catch { /* egal */ }
  }

  function oeffnen(opts = {}) {
    sheet.classList.remove("hidden");
    $("rt-gps-an").checked = gpsAn();
    $("rt-gps").classList.toggle("an", gpsAn());
    orteLaden();
    standortAnzeigen();
    ortungStarten();
    if (!aktuell) zeigen();
    else setTimeout(() => karte?.invalidateSize(), 60);
    if (opts.ziel) { $("rt-nach").value = opts.ziel; }
    if (!aktuell && !opts.ziel) setTimeout(() => $("rt-nach").focus({ preventScroll: true }), 80);
  }
  function schliessen() { sheet.classList.add("hidden"); }

  // ---------- Bedienung ----------
  $("rt-x").addEventListener("click", schliessen);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) schliessen(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.classList.contains("hidden")) schliessen(); });
  trigger.addEventListener("click", () => oeffnen());
  $("rt-form").addEventListener("submit", (e) => { e.preventDefault(); berechnen(); });
  $("rt-wann").addEventListener("change", () => {
    const z = $("rt-zeit"), an = $("rt-wann").value !== "jetzt";
    z.classList.toggle("hidden", !an);
    if (an && !z.value) {
      const d = new Date(Date.now() + 30 * 60000); d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
      z.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
  });
  $("rt-tausch").addEventListener("click", () => {
    const a = $("rt-von").value, b = $("rt-nach").value;
    $("rt-von").value = b; $("rt-nach").value = a || "Zuhause";
  });
  $("rt-gps").addEventListener("click", async () => {
    $("rt-von").value = "📍 Mein Standort";
    try { vonStandort = await holeStandort(); $("rt-gps").classList.add("an"); if ($("rt-nach").value.trim()) berechnen(); }
    catch (err) { fehler(err.message); }
  });
  $("rt-von").addEventListener("input", () => { vonStandort = null; });
  $("rt-gps-an").addEventListener("change", async (e) => {
    ls.set("routen_gps", e.target.checked ? "1" : "0");
    $("rt-gps").classList.toggle("an", e.target.checked);
    if (e.target.checked) {
      try {
        const p = await holeStandort();
        if (!serverAn) { await api("/api/standort", { method: "POST", body: JSON.stringify({ an: true }) }); serverAn = true; }
        gesendet = null; senden(p); ortungStarten();
      } catch (err) { fehler(err.message); e.target.checked = false; ls.set("routen_gps", "0"); }
    } else ortungStoppen();
    setTimeout(standortAnzeigen, 800);
  });
  $("rt-kartenwahl").addEventListener("click", () => {
    kartenArt = kartenArt === "google" ? "friday" : "google";
    ls.set("routen_karte", kartenArt);
    karteZeichnen();
  });
  $("rt-orte").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-ort]");
    if (!b) return;
    const art = b.dataset.ort, text = $(art === "heim" ? "rt-heim" : "rt-arbeit").value.trim();
    b.disabled = true; b.textContent = "…";
    try {
      const r = await api("/api/routen/orte", { method: "POST", body: JSON.stringify({ art, text }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Fehler");
      b.textContent = "✓ Gespeichert";
      const st = $("rt-status"); st.classList.remove("fehler");
      st.textContent = d.ort ? `${art === "heim" ? "Zuhause" : "Arbeit"}: ${d.ort.label}` : "Gelöscht.";
      orteLaden();
    } catch (err) { fehler(err.message); b.textContent = "Speichern"; }
    finally { setTimeout(() => { b.disabled = false; b.textContent = "Speichern"; }, 1600); }
  });
  $("rt-modi").addEventListener("click", (e) => {
    const b = e.target.closest("[data-modus]");
    if (!b || !aktuell) return;
    modus = b.dataset.modus;
    zeigen();
  });
  $("rt-liste").addEventListener("click", (e) => {
    if (e.target.closest("#rt-spaeter")) {
      const vs = aktuell?.oepnv.verbindungen || [];
      const letzte = vs[vs.length - 1];
      if (letzte) berechnen({ zeit: new Date(new Date(letzte.erste?.ab || letzte.ab).getTime() + 60000).toISOString(), ankunft: false, modus: "oepnv" });
      return;
    }
    const sch = e.target.closest(".rt-sch[data-lat]");
    if (sch) { zuPunkt(+sch.dataset.lat, +sch.dataset.lon); return; }
    const k = e.target.closest("[data-vb]");
    if (!k) return;
    const i = +k.dataset.vb;
    if (i === gewaehlt) k.classList.toggle("offen");
    else { gewaehlt = i; liste(); karteZeichnen(); }
  });
  $("rt-sprich").addEventListener("click", () => { if (aktuell?.sprechText) F.say?.(aktuell.sprechText); });

  window.FridayRouten = {
    open: oeffnen,
    close: schliessen,
    zeige: ladeErgebnis,
    neueste: () => ladeErgebnis("neuestes"),
    offen: () => !sheet.classList.contains("hidden"),
    // Für app.js: Standort mitschicken, wenn im Routen-Fenster erlaubt
    standort: () => (gpsAn() ? letzterStandort(30) : null),
  };
})();
