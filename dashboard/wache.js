// F.R.Ai.D.A.Y Kamera-Wache (v1.126.0)
// Friday passt mit deinen EIGENEN Kameras auf dein Zuhause auf:
//   🚶 Bewegung · 🧍 Personen · 🐕 Hunde & Katzen · 🔍 Gegenstände · 🔥 Feuerschein/Rauch (soweit sichtbar)
//   🚪 Tür-Linie · 🏠 mehrere Räume · 🗣 "Was passiert zu Hause?" · 📸 Ereignisprotokoll · 🚨 Alarm (Telegram)
// Die Erkennung läuft hier im Browser (MediaPipe, wie Friday Vision) – kein Bild geht dafür ins Internet.
// Bewusst NICHT: Gesichtserkennung oder erkennen, WER jemand ist. Nur eigene Kameras.
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;

  const LIB = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
  // Mac: genaueres Modell (lite2, 12 MB). Handy/Tablet: schnelles Modell (lite0), damit es nicht heiß wird.
  const HANDY = /iPhone|iPad|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  const MODELL = HANDY
    ? "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite"
    : "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/latest/efficientdet_lite2.tflite";
  const DE = {
    person: "Person", dog: "Hund", cat: "Katze", bird: "Vogel", "cell phone": "Handy", laptop: "Laptop", tv: "Fernseher",
    chair: "Stuhl", couch: "Sofa", bed: "Bett", cup: "Tasse", bottle: "Flasche", book: "Buch", backpack: "Rucksack",
    handbag: "Handtasche", suitcase: "Koffer", bicycle: "Fahrrad", car: "Auto", motorcycle: "Motorrad", "potted plant": "Pflanze",
    "dining table": "Tisch", clock: "Uhr", keyboard: "Tastatur", mouse: "Maus", remote: "Fernbedienung", umbrella: "Regenschirm",
    "teddy bear": "Teddy", "wine glass": "Glas", bowl: "Schüssel", scissors: "Schere", vase: "Vase", oven: "Ofen",
    refrigerator: "Kühlschrank", sink: "Spüle", microwave: "Mikrowelle", toaster: "Toaster", "sports ball": "Ball", knife: "Messer",
  };
  const BEWACHBAR = ["laptop", "bicycle", "backpack", "handbag", "suitcase", "tv", "car", "motorcycle", "cell phone", "potted plant"];
  const TIERE = ["dog", "cat", "bird"];
  const ICON = { bewegung: "🚶", person: "🧍", tier: "🐕", objekt: "🔍", gefahr: "🔥", tuer: "🚪", offline: "📵", system: "🛡" };
  const TYPNAME = { bewegung: "Bewegung", person: "Person", tier: "Tier", objekt: "Gegenstand", gefahr: "Rauch/Feuer", tuer: "Tür", offline: "Kamera aus", system: "Wache" };
  const de = (k) => DE[k] || k;
  const lese = (k, alt = "") => { try { return localStorage.getItem(k) ?? alt; } catch { return alt; } };
  const merke = (k, v) => { try { localStorage.setItem(k, v); } catch { /* egal */ } };
  const MEINE_ID = Math.random().toString(36).slice(2, 10); // dieses Fenster als Auswerter

  let stand = null; // GET /api/wache
  let tab = "live";
  let filterTyp = "";
  let filterTag = "";
  const blobs = new Map(); // Bildpfad -> objectURL

  // ---------- Fenster ----------
  const w = H.fenster({
    id: "wache", titel: "🛡 Kamera-Wache", klasse: "kw-box",
    html: `
      <div class="kw-kopf">
        <button id="kw-scharf" class="kw-scharf" type="button" aria-pressed="false">
          <span class="kw-schild">🛡</span><span><b id="kw-scharf-t">WACHE AUS</b><small id="kw-scharf-u">Tippen zum Scharfschalten</small></span>
        </button>
        <div id="kw-heute" class="kw-heute"></div>
      </div>
      <div class="hf-tabs" role="tablist">
        <button class="hf-tab an" data-tab="live">📡 Live</button>
        <button class="hf-tab" data-tab="ereignisse">📸 Ereignisse</button>
        <button class="hf-tab" data-tab="einstellungen">⚙ Einstellungen</button>
        <button class="hf-tab" data-tab="hilfe">❔ Was brauche ich?</button>
      </div>
      <div id="kw-status" class="hf-status">Sag zum Beispiel: „Friday, was passiert zu Hause?“, „Wache an“ oder „Ist jemand im Wohnzimmer?“</div>
      <section data-seite="live">
        <div id="kw-raster" class="kw-raster"></div>
        <div class="hf-zwei">
          <div class="hf-karte">
            <h3>📱 Dieses Gerät als Kamera</h3>
            <div class="hf-reihe">
              <input id="kw-raum" class="hf-input grow" type="text" maxlength="40" placeholder="Raum, z. B. Wohnzimmer, Flur, Haustür" aria-label="Raum">
              <select id="kw-cam" class="hf-input" style="width:auto" aria-label="Kamera"><option value="user">Frontkamera</option><option value="environment">Rückkamera</option></select>
            </div>
            <div class="hf-reihe" style="margin-top:8px">
              <button id="kw-start" class="hf-btn haupt" type="button">▶ Kamera starten</button>
              <button id="kw-stopp" class="hf-btn leise hidden" type="button">■ Kamera stoppen</button>
            </div>
            <p class="hf-hinweis">Altes iPhone oder iPad? Dort Friday öffnen, hier einen Raum eintragen, starten, ans Ladekabel hängen und hinstellen. Das Fenster darf zu sein – nur Friday muss offen bleiben.</p>
          </div>
          <div class="hf-karte">
            <h3>📷 IP-Kamera im WLAN</h3>
            <div class="hf-reihe">
              <input id="kw-ipname" class="hf-input grow" type="text" maxlength="40" placeholder="Name, z. B. Garten" aria-label="Name der IP-Kamera">
            </div>
            <div class="hf-reihe" style="margin-top:8px">
              <input id="kw-ipurl" class="hf-input grow" type="text" placeholder="http://… Schnappschuss-Adresse oder rtsp://…" aria-label="Adresse der IP-Kamera" autocomplete="off" spellcheck="false">
              <button id="kw-ipneu" class="hf-btn" type="button">＋ Hinzufügen</button>
            </div>
            <label class="switch" style="margin-top:8px"><input type="checkbox" id="kw-ipauswerten"><span>IP-Kameras auf diesem Gerät auswerten</span></label>
            <p class="hf-hinweis">Der Mac holt das Bild aus deinem WLAN. Am besten wertet der Mac sie auch aus: Schalter an und Friday auf dem Mac offen lassen.</p>
          </div>
        </div>
      </section>
      <section data-seite="ereignisse" class="hidden">
        <div class="hf-reihe">
          <div id="kw-filter" class="hf-tabs"></div>
          <input id="kw-tag" class="hf-input" type="date" style="width:auto" aria-label="Tag">
        </div>
        <div id="kw-bericht" class="hf-hinweis"></div>
        <div id="kw-liste" class="kw-liste"></div>
      </section>
      <section data-seite="einstellungen" class="hidden">
        <div class="hf-zwei">
          <div class="hf-karte"><h3>Was Friday erkennt</h3><div id="kw-erkennen" class="kw-schalter"></div>
            <label class="hf-feld" style="margin-top:10px"><span>Bewegung: Empfindlichkeit <b id="kw-empf-w"></b></span><input id="kw-empf" type="range" min="0" max="100" step="5"></label>
          </div>
          <div class="hf-karte"><h3>Alarm, wenn die Wache scharf ist</h3><div id="kw-alarm" class="kw-schalter"></div>
            <label class="switch"><input type="checkbox" id="kw-gefahrimmer"><span>🔥 Feuer/Rauch immer melden (auch ohne Wache)</span></label>
            <label class="switch"><input type="checkbox" id="kw-foto"><span>Foto mit an Telegram schicken</span></label>
            <label class="switch"><input type="checkbox" id="kw-ton"><span>Warnton am Kamera-Gerät bei Alarm</span></label>
            <label class="hf-feld" style="margin-top:8px"><span>Gleicher Alarm frühestens wieder nach</span>
              <select id="kw-pause" class="hf-input"><option value="0">sofort</option><option value="1">1 Minute</option><option value="2">2 Minuten</option><option value="5">5 Minuten</option><option value="10">10 Minuten</option><option value="30">30 Minuten</option></select></label>
            <div id="kw-wege" class="hf-hinweis"></div>
          </div>
        </div>
        <div class="hf-karte"><h3>🔍 Gegenstände bewachen</h3>
          <p class="hf-hinweis">Friday sagt Bescheid, wenn einer dieser Gegenstände länger nicht mehr zu sehen ist (z. B. das Fahrrad im Flur).</p>
          <div id="kw-bewachen" class="kw-chips"></div></div>
        <div class="hf-karte"><h3>Kameras</h3><div id="kw-kameras" class="hf-liste"></div>
          <label class="hf-feld" style="margin-top:10px"><span>Fotos der Ereignisse aufheben</span>
            <select id="kw-tage" class="hf-input"><option value="1">1 Tag</option><option value="3">3 Tage</option><option value="7">7 Tage</option><option value="14">14 Tage</option><option value="30">30 Tage</option><option value="90">90 Tage</option></select></label>
          <p class="hf-hinweis">Die Fotos liegen nur auf deinem Mac im Ordner Friday-Archiv/Kamera-Wache und werden danach automatisch gelöscht.</p></div>
      </section>
      <section data-seite="hilfe" class="hidden">
        <div class="hf-raster kw-hilfe">
          <div class="hf-karte"><h3>Reicht für den Anfang</h3><p>Dein Mac mit eingebauter Kamera – oder ein <b>altes iPhone/iPad</b> pro Raum (mit Ladekabel). Kostet nichts extra.</p></div>
          <div class="hf-karte"><h3>Für mehrere Räume</h3><p>WLAN-Kameras mit <b>RTSP</b> oder <b>JPEG-Schnappschuss</b>, z. B. Reolink, Tapo C200/C210 (RTSP im App-Menü anschalten), Amcrest, Foscam. Ca. 25–60 € pro Stück. Nicht geeignet: reine Cloud-Kameras ohne RTSP (z. B. Ring, Blink, viele Eufy-Modelle).</p></div>
          <div class="hf-karte"><h3>Damit es nachts läuft</h3><p>Mac am Strom, Ruhezustand aus (Systemeinstellungen → Energie: „Automatisches Ruhezustand verhindern“). Friday-Fenster offen lassen. Für dunkle Räume: Kamera mit Infrarot-Nachtsicht.</p></div>
          <div class="hf-karte"><h3>Ehrlich gesagt</h3><p>🔥 Feuer und Rauch erkennt Friday nur, wenn sie im Bild zu sehen sind – das ist ein Hinweis, <b>kein Ersatz für einen Rauchmelder</b>. Personen erkennt Friday als „Person“, aber nie, wer es ist. Kameras nur in deinen eigenen Räumen, Gäste informieren.</p></div>
          <div class="hf-karte"><h3>Alarm aufs Handy</h3><p>Über deinen Telegram-Bot (mit Foto) und ntfy. Ist Telegram nicht eingerichtet: „Telegram einrichten.command“ auf dem Mac starten.</p></div>
          <div class="hf-karte"><h3>Per Sprache</h3><p>„Friday, Wache an“ · „Ich gehe weg“ · „Was passiert zu Hause?“ · „Ist jemand im Wohnzimmer?“ · „Wo ist die Katze?“ · „Schau genau hin“ · „Was ist heute passiert?“ · in Telegram: „Foto vom Wohnzimmer“</p></div>
        </div>
      </section>
      <div id="kw-gross" class="kw-gross hidden" role="dialog" aria-label="Foto"><img alt=""><p></p><button class="hf-btn" type="button">✕ Schließen</button></div>`,
    onOpen: (opt = {}) => { if (opt.tab) zeigeTab(opt.tab); laden(); starteAnzeige(); if (opt.kamera) setTimeout(() => fokus(opt.kamera), 300); },
  });
  const $ = w.$;

  // ---------- Stil ----------
  const style = document.createElement("style");
  style.textContent = `
.kw-box { width: min(1180px, 100%); }
.kw-kopf { display: flex; gap: 12px; align-items: stretch; flex-wrap: wrap; }
.kw-scharf { display: flex; align-items: center; gap: 12px; padding: 10px 18px 10px 12px; border-radius: 16px; cursor: pointer; font: inherit; color: var(--text);
  border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.35); text-align: left; min-width: 240px; }
.kw-scharf b { display: block; letter-spacing: .14em; font-size: 15px; } .kw-scharf small { color: var(--muted); font-size: 12px; }
.kw-schild { font-size: 30px; filter: grayscale(1) opacity(.6); transition: filter .3s; }
.kw-scharf.an { border-color: #ff3b3b; background: linear-gradient(135deg, rgba(255,40,40,.22), rgba(255,120,40,.10)); box-shadow: 0 0 26px rgba(255,50,50,.35), inset 0 0 18px rgba(255,60,60,.15); }
.kw-scharf.an .kw-schild { filter: none; animation: kw-puls 1.8s ease-in-out infinite; } .kw-scharf.an b { color: #ff6b5a; }
@keyframes kw-puls { 50% { transform: scale(1.12); filter: drop-shadow(0 0 10px #ff3b3b); } }
.kw-heute { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; flex: 1; }
.kw-zahl { border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 12px; padding: 6px 12px; background: rgba(0,0,0,.25); font-size: 13px; color: var(--muted); }
.kw-zahl b { color: var(--text); font-size: 17px; margin-left: 4px; }
.kw-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 12px; }
.kw-kachel { position: relative; border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 16px; overflow: hidden; background: #050505; }
.kw-kachel.alarm { border-color: #ff3b3b; box-shadow: 0 0 24px rgba(255,50,50,.45); }
.kw-kachel.fokus { outline: 2px solid var(--cyan); }
.kw-bild { position: relative; aspect-ratio: 16 / 10; background: radial-gradient(circle at 50% 40%, rgba(255,140,30,.08), transparent 60%), #030303; }
.kw-bild video, .kw-bild img, .kw-bild canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.kw-bild canvas.kw-ov { pointer-events: none; }
.kw-bild.zeichnen canvas.kw-ov { pointer-events: auto; cursor: crosshair; }
.kw-leer { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-size: 13px; text-align: center; padding: 16px; }
.kw-scan { position: absolute; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--cyan), transparent); opacity: .55; animation: kw-scan 3.5s linear infinite; pointer-events: none; }
@keyframes kw-scan { from { top: 0; } to { top: 100%; } }
.kw-ecke { position: absolute; top: 8px; left: 10px; right: 10px; display: flex; justify-content: space-between; gap: 6px; font: 11px ui-monospace, Menlo, monospace; letter-spacing: .08em; pointer-events: none; }
.kw-ecke span { background: rgba(0,0,0,.6); padding: 3px 7px; border-radius: 6px; }
.kw-live-an { color: #45e38b; } .kw-live-aus { color: #888; } .kw-rec { color: #ff5a4a; }
.kw-fuss { padding: 9px 11px; display: flex; flex-direction: column; gap: 7px; }
.kw-name { display: flex; align-items: center; gap: 8px; font-weight: 700; letter-spacing: .06em; }
.kw-name small { font-weight: 400; color: var(--muted); letter-spacing: 0; margin-left: auto; font-size: 11px; }
.kw-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.kw-chip { font-size: 12px; border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 999px; padding: 3px 9px; color: var(--muted); background: rgba(0,0,0,.3); }
.kw-chip.lebend { color: var(--text); border-color: var(--cyan); }
.kw-chip.gefahr { color: #fff; background: #c81e1e; border-color: #ff3b3b; }
button.kw-chip { cursor: pointer; font: inherit; font-size: 12px; } button.kw-chip.an { color: #140900; background: var(--cyan); border-color: var(--cyan); font-weight: 700; }
.kw-bew { height: 4px; border-radius: 9px; background: rgba(255,255,255,.07); overflow: hidden; }
.kw-bew i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, var(--cyan), #ffcf7a); transition: width .4s; }
.kw-knoepfe { display: flex; gap: 6px; flex-wrap: wrap; }
.kw-liste { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; }
.kw-ev { border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 14px; overflow: hidden; background: rgba(0,0,0,.3); display: flex; flex-direction: column; }
.kw-ev.alarm { border-color: #ff3b3b; }
.kw-ev .kw-evbild { width: 100%; border-radius: 0 !important; padding: 0; margin: 0; box-shadow: none !important; aspect-ratio: 16 / 10; background: #050505 center / cover no-repeat; cursor: zoom-in; display: grid; place-items: center; font-size: 34px; border: 0; }
.kw-ev .kw-evtext { padding: 8px 10px; font-size: 13px; display: flex; flex-direction: column; gap: 3px; }
.kw-ev .kw-evtext small { color: var(--muted); font-size: 11.5px; display: flex; gap: 6px; align-items: center; }
.kw-ev .kw-evtext small .hf-mini { margin-left: auto; }
.kw-schalter { display: flex; flex-direction: column; gap: 4px; }
.kw-gross { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.88); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 16px; }
.kw-gross img { max-width: 100%; max-height: 78vh; border-radius: 12px; border: 1px solid var(--u-rand-soft, var(--line)); }
.kw-gross p { color: var(--text); margin: 0; text-align: center; }
.kw-pille { position: fixed; z-index: 60; left: 16px; bottom: 16px; display: flex; align-items: center; gap: 8px; padding: 7px 13px; border-radius: 999px; font: 12px ui-monospace, Menlo, monospace; letter-spacing: .06em;
  color: var(--text); background: rgba(10,6,2,.82); border: 1px solid var(--u-rand-soft, var(--line)); cursor: pointer; backdrop-filter: blur(8px); }
.kw-pille i { width: 8px; height: 8px; border-radius: 50%; background: #45e38b; box-shadow: 0 0 8px #45e38b; }
.kw-pille.scharf { border-color: #ff3b3b; } .kw-pille.scharf i { background: #ff3b3b; box-shadow: 0 0 10px #ff3b3b; animation: kw-puls 1.6s infinite; }
.kw-hilfe p { margin: 0; font-size: 13.5px; line-height: 1.5; }
@media (max-width: 900px) {
  .kw-raster, .kw-liste { grid-template-columns: 1fr; }
  .kw-scharf { flex: 1 1 100%; }
  .kw-pille { bottom: calc(84px + env(safe-area-inset-bottom, 0px)); left: 12px; }
}`;
  document.head.appendChild(style);

  // ---------- Tabs ----------
  function zeigeTab(t) {
    tab = t;
    w.$$(".hf-tab[data-tab]").forEach((b) => b.classList.toggle("an", b.dataset.tab === t));
    w.$$("section[data-seite]").forEach((s) => s.classList.toggle("hidden", s.dataset.seite !== t));
    if (t === "ereignisse") ladeEreignisse();
    if (t === "einstellungen") zeigeEinstellungen();
  }
  w.$$(".hf-tab[data-tab]").forEach((b) => b.addEventListener("click", () => zeigeTab(b.dataset.tab)));
  const status = (text, fehler) => { const s = $("#kw-status"); s.textContent = text; s.classList.toggle("fehler", Boolean(fehler)); };

  // ---------- Erkennung (einmal laden, für alle Kameras) ----------
  let detektor = null, ladeVersuch = null;
  function ladeErkennung() {
    ladeVersuch ??= (async () => {
      if (window.FridayWacheTest?.detektor) { detektor = window.FridayWacheTest.detektor; return; }
      const v = await import(`${LIB}/vision_bundle.mjs`);
      const files = await v.FilesetResolver.forVisionTasks(`${LIB}/wasm`);
      detektor = await v.ObjectDetector.createFromOptions(files, { baseOptions: { modelAssetPath: MODELL }, runningMode: "IMAGE", scoreThreshold: 0.35, maxResults: 15 });
    })().catch((err) => { ladeVersuch = null; throw err; });
    return ladeVersuch;
  }

  // ---------- Ein Wächter pro Kamera, die DIESES Gerät auswertet ----------
  class Waechter {
    constructor({ id, name, typ, quelle }) {
      Object.assign(this, { id, name, typ, quelle }); // quelle: <video> oder <img>
      this.arbeit = document.createElement("canvas"); // volles Bild für Erkennung + Fotos
      this.klein = document.createElement("canvas"); this.klein.width = 80; this.klein.height = 60;
      this.kctx = this.klein.getContext("2d", { willReadFrequently: true });
      this.vorher = null; this.ruhigSeit = Date.now(); this.bewegt = false;
      this.objekte = []; this.zahlen = {}; this.bewegung = 0; this.gefahr = null;
      this.spuren = []; this.verlauf = []; this.feuer = []; this.rauch = { basis: null, zaehler: 0 };
      this.gesehen = {}; this.zuletztGesehen = {}; this.gemeldet = {}; this.letzterStatus = 0; this.letztesBild = 0;
      this.einst = stand?.einstellungen || {}; this.linie = null; this.scharf = false; this.alarmBis = 0;
    }
    bereit() { const q = this.quelle; return q instanceof HTMLVideoElement ? q.videoWidth > 0 && q.readyState >= 2 : q?.naturalWidth > 0 && q.complete; }
    groesse() { const q = this.quelle; return q instanceof HTMLVideoElement ? [q.videoWidth, q.videoHeight] : [q.naturalWidth, q.naturalHeight]; }

    takt() {
      if (!this.bereit()) return;
      const [bw, bh] = this.groesse();
      const s = Math.min(1, 960 / Math.max(bw, bh));
      const W = Math.round(bw * s), Hh = Math.round(bh * s);
      if (this.arbeit.width !== W) { this.arbeit.width = W; this.arbeit.height = Hh; }
      const g = this.arbeit.getContext("2d");
      g.drawImage(this.quelle, 0, 0, W, Hh);
      const e = this.einst.erkennen || {};
      this.kctx.drawImage(this.arbeit, 0, 0, 80, 60);
      const px = this.kctx.getImageData(0, 0, 80, 60).data;
      this.bewegungMessen(px);
      let erkannt = [];
      if (detektor) {
        try {
          const r = detektor.detect(this.arbeit);
          const minimum = 0.4;
          erkannt = (r.detections || []).filter((d) => (d.categories[0]?.score || 0) >= minimum).map((d) => ({
            name: d.categories[0].categoryName, score: d.categories[0].score,
            x: d.boundingBox.originX / W, y: d.boundingBox.originY / Hh, w: d.boundingBox.width / W, h: d.boundingBox.height / Hh,
          }));
        } catch (err) { if (!this._fehlerGezeigt) { this._fehlerGezeigt = true; console.warn("Kamera-Wache Erkennung:", err?.message || err); } }
      }
      if (e.personen === false) erkannt = erkannt.filter((o) => o.name !== "person");
      if (e.tiere === false) erkannt = erkannt.filter((o) => !TIERE.includes(o.name));
      if (e.objekte === false) erkannt = erkannt.filter((o) => o.name === "person" || TIERE.includes(o.name));
      this.objekte = erkannt;
      if (e.gefahr !== false) this.gefahrPruefen(px); else this.gefahr = null;
      const z = {};
      for (const o of erkannt) z[o.name] = (z[o.name] || 0) + 1;
      this.zahlen = z;
      this.verlauf.push(z); if (this.verlauf.length > 4) this.verlauf.shift();
      this.ereignissePruefen(e);
      this.statusSenden();
    }

    // Bewegung: Unterschied zum letzten Bild (80×60 Graustufen), träge gegen Bildrauschen.
    bewegungMessen(px) {
      const grau = new Uint8Array(80 * 60);
      for (let i = 0; i < grau.length; i++) grau[i] = (px[i * 4] * 3 + px[i * 4 + 1] * 6 + px[i * 4 + 2]) / 10;
      let anders = 0;
      if (this.vorher) for (let i = 0; i < grau.length; i++) if (Math.abs(grau[i] - this.vorher[i]) > 28) anders++;
      this.vorher = grau;
      const anteil = anders / grau.length;
      const empf = Number(this.einst.empfindlichkeit ?? 50);
      const schwelle = 0.09 - (empf / 100) * 0.08; // 9 % … 1 % der Fläche
      this.bewegung = Math.min(100, Math.round((anteil / Math.max(0.005, schwelle)) * 40));
      this.bewegtJetzt = anteil > schwelle;
    }

    // Feuerschein: viele sehr helle rot-orange Bildpunkte, die flackern. Rauch: Bild wird langsam grau und verliert Kontraste.
    gefahrPruefen(px) {
      // Bildpunkte in Personen/Tieren zählen nicht (orange Jacke, rotes Fell).
      const lebend = this.objekte.filter((o) => o.name === "person" || TIERE.includes(o.name));
      const inLebend = (x, y) => lebend.some((o) => x >= o.x * 80 - 2 && x <= (o.x + o.w) * 80 + 2 && y >= o.y * 60 - 2 && y <= (o.y + o.h) * 60 + 2);
      let feuer = 0, fx = 0, fy = 0, hell = 0, satt = 0, kanten = 0;
      for (let i = 0; i < 80 * 60; i++) {
        const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
        const x = i % 80, y = (i / 80) | 0;
        if (r > 225 && g > 100 && g < 230 && b < 120 && r - g > 30 && g - b > 30 && !inLebend(x, y)) { feuer++; fx += x; fy += y; }
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        hell += mx; satt += mx ? (mx - mn) / mx : 0;
        if (x && Math.abs(r - px[i * 4 - 4]) > 18) kanten++;
      }
      const n = 80 * 60;
      this.feuer.push({ a: feuer / n, x: feuer ? fx / feuer / 80 : -1, y: feuer ? fy / feuer / 60 : -1 });
      if (this.feuer.length > 10) this.feuer.shift();
      const a = this.feuer.map((f) => f.a);
      const mittel = a.reduce((p, q) => p + q, 0) / a.length;
      const flackern = Math.sqrt(a.reduce((p, q) => p + (q - mittel) ** 2, 0) / a.length);
      // Feuer flackert am selben Ort. Was durchs Bild läuft (orange Jacke), wandert dagegen.
      const orte = this.feuer.filter((f) => f.x >= 0);
      const wandert = orte.length > 1 && Math.max(...orte.map((f) => f.x)) - Math.min(...orte.map((f) => f.x)) + Math.max(...orte.map((f) => f.y)) - Math.min(...orte.map((f) => f.y)) > 0.12;
      const feuerJetzt = this.feuer.length >= 8 && mittel > 0.008 && flackern > mittel * 0.15 && a.slice(-6).every((x) => x > 0.004) && !wandert;
      // Rauch: Bild wird über ~10 s grau und verliert Kontraste, verglichen mit einem langsam wandernden Grundwert.
      const k = { kanten: kanten / n, satt: satt / n, hell: hell / n };
      const ba = this.rauch.basis;
      if (!ba) this.rauch.basis = k;
      else {
        const rauchig = k.kanten < ba.kanten * 0.5 && k.satt < ba.satt * 0.7 && k.hell > ba.hell * 0.95 && !lebend.length;
        this.rauch.zaehler = rauchig ? this.rauch.zaehler + 1 : Math.max(0, this.rauch.zaehler - 2);
        if (!rauchig) for (const key of Object.keys(k)) ba[key] = ba[key] * 0.97 + k[key] * 0.03; // Licht an/aus: Grundwert wandert mit
      }
      const rauchJetzt = this.rauch.zaehler >= 18; // ≈ 10 Sekunden am Stück
      this.gefahr = feuerJetzt ? "möglicher Feuerschein" : rauchJetzt ? "möglicher Rauch" : null;
    }

    stabil(name) { return this.verlauf.length >= 2 && this.verlauf.slice(-2).every((z) => z[name] > 0); }

    ereignissePruefen(e) {
      const jetzt = Date.now();
      const darf = (typ, ms = 45000) => { if (jetzt - (this.gemeldet[typ] || 0) < ms) return false; this.gemeldet[typ] = jetzt; return true; };
      // 🔥 Gefahr
      if (this.gefahr && darf("gefahr", 60000)) this.melde("gefahr", `Achtung: ${this.gefahr} im Bild`, "Hinweis aus dem Kamerabild, kein Rauchmelder.");
      // 🧍 Person taucht auf
      const personen = this.zahlen.person || 0;
      if (e.personen !== false && personen && this.stabil("person") && !this.personDa) {
        this.personDa = true;
        if (darf("person")) this.melde("person", personen === 1 ? "Eine Person ist im Bild" : `${personen} Personen sind im Bild`);
      }
      if (!personen && this.verlauf.every((z) => !z.person)) this.personDa = false;
      // 🐕 Tier taucht auf
      for (const t of TIERE) {
        const n = this.zahlen[t] || 0;
        if (e.tiere !== false && n && this.stabil(t) && !this[`da_${t}`]) {
          this[`da_${t}`] = true;
          if (darf(`tier_${t}`, 120000)) this.melde("tier", `${n === 1 ? (t === "dog" ? "Ein Hund" : t === "cat" ? "Eine Katze" : "Ein Vogel") : `${n} ${t === "dog" ? "Hunde" : t === "cat" ? "Katzen" : "Vögel"}`} im Bild`);
        }
        if (!n && this.verlauf.every((z) => !z[t])) this[`da_${t}`] = false;
      }
      // 🚶 Bewegung (nach Ruhe, wenn sonst niemand erkannt wurde)
      if (this.bewegtJetzt) {
        if (!this.bewegt && jetzt - this.ruhigSeit > 20000 && e.bewegung !== false && !personen && !TIERE.some((t) => this.zahlen[t]) && darf("bewegung", 60000)) this.melde("bewegung", "Bewegung erkannt");
        this.bewegt = true;
      } else if (this.bewegt) { this.bewegt = false; this.ruhigSeit = jetzt; }
      // 🚪 Tür-Linie
      if (e.tuer !== false && this.linie) this.tuerPruefen(jetzt, darf);
      // 🔍 Bewachte Gegenstände verschwunden
      for (const ding of this.einst.bewachen || []) {
        if (this.zahlen[ding]) { this.gesehen[ding] = Math.min(40, (this.gesehen[ding] || 0) + 1); this.zuletztGesehen[ding] = jetzt; this[`weg_${ding}`] = false; }
        else if ((this.gesehen[ding] || 0) >= 20 && jetzt - (this.zuletztGesehen[ding] || jetzt) > 15000 && !this[`weg_${ding}`] && !personen) {
          this[`weg_${ding}`] = true; this.gesehen[ding] = 0;
          this.melde("objekt", `${de(ding)} ist nicht mehr zu sehen`);
        }
      }
    }

    // Personen verfolgen und prüfen, ob jemand die gezogene Tür-Linie überquert.
    tuerPruefen(jetzt, darf) {
      const { x1, y1, x2, y2 } = this.linie;
      const seite = (p) => Math.sign((x2 - x1) * (p.y - y1) - (y2 - y1) * (p.x - x1));
      const aufStrecke = (p) => { const dx = x2 - x1, dy = y2 - y1; const t = ((p.x - x1) * dx + (p.y - y1) * dy) / (dx * dx + dy * dy); return t > -0.15 && t < 1.15; };
      const punkte = this.objekte.filter((o) => o.name === "person").map((o) => ({ x: o.x + o.w / 2, y: o.y + o.h * 0.85 }));
      const neu = [];
      for (const p of punkte) {
        let best = null, bd = 0.25;
        for (const s of this.spuren) { const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < bd && !s.vergeben) { bd = d; best = s; } }
        const sp = best || { seite: seite(p), seit: jetzt };
        sp.vergeben = true;
        const jetztSeite = seite(p);
        if (best && jetztSeite && sp.seite && jetztSeite !== sp.seite && aufStrecke(p)) {
          if (darf("tuer", 8000)) this.melde("tuer", "Jemand ist durch die Tür gegangen", `Richtung ${jetztSeite > 0 ? "A → B" : "B → A"}`);
        }
        neu.push({ x: p.x, y: p.y, seite: jetztSeite || sp.seite, zuletzt: jetzt });
      }
      // Kurz verdeckte Personen 2 Sekunden lang merken.
      for (const s of this.spuren) if (!s.vergeben && jetzt - s.zuletzt < 2000) neu.push(s);
      this.spuren = neu.map((s) => ({ ...s, vergeben: false }));
    }

    foto(qualitaet = 0.8, max = 1280) {
      const [bw, bh] = this.groesse();
      const s = Math.min(1, max / Math.max(bw, bh));
      const c = document.createElement("canvas");
      c.width = Math.round(bw * s); c.height = Math.round(bh * s);
      const g = c.getContext("2d");
      g.drawImage(this.quelle, 0, 0, c.width, c.height);
      zeichneRahmen(g, c.width, c.height, this.objekte, this.linie, this.gefahr);
      g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(0, c.height - 26, c.width, 26);
      g.fillStyle = "#ff8a1e"; g.font = "14px ui-monospace, Menlo, monospace";
      g.fillText(`FRIDAY WACHE · ${this.name.toUpperCase()} · ${new Date().toLocaleString("de-DE")}`, 10, c.height - 9);
      return c.toDataURL("image/jpeg", qualitaet);
    }

    async melde(typ, text, details) {
      window.FridayWache?._neu?.({ typ, text, raum: this.name, kamera: this.id });
      try {
        const r = await json("/api/wache/ereignis", { body: { id: this.id, typ, text, details, bild: this.foto() } });
        if (r.alarm) { this.alarmBis = Date.now() + 15000; if (this.einst.ton) piep(typ === "gefahr" ? 6 : 3); }
        if (w.offen()) { laden(); if (tab === "ereignisse") ladeEreignisse(); }
      } catch { /* nächstes Mal */ }
    }

    async statusSenden() {
      const jetzt = Date.now();
      if (jetzt - this.letzterStatus < 4000) return;
      this.letzterStatus = jetzt;
      const body = { id: this.id, objekte: this.zahlen, bewegung: this.bewegung, gefahr: this.gefahr, auswerter: MEINE_ID };
      // Geräte-Kameras schicken alle 8 s ein kleines Bild mit (bleibt nur im Speicher des Macs, für Live-Ansicht und "Schau genau hin").
      if (this.typ === "geraet" && jetzt - this.letztesBild > 8000) { body.bild = this.foto(0.6, 640); this.letztesBild = jetzt; }
      try {
        const r = await json("/api/wache/status", { body });
        if (r.unbekannt) { stoppeGeraet(); return; }
        if (r.schonVergeben) this.fremd = true; else this.fremd = false;
        this.einst = r.einstellungen || this.einst; this.linie = r.linie; this.scharf = r.scharf;
        if (r.name && r.name !== this.name) this.name = r.name;
        aktualisierePille();
      } catch { /* Mac kurz weg */ }
    }
  }

  function zeichneRahmen(g, W, Hh, objekte, linie, gefahr) {
    const u = Math.max(1, W / 640);
    g.lineWidth = 2 * u;
    g.font = `${12 * u}px ui-monospace, Menlo, monospace`;
    for (const o of objekte || []) {
      const lebend = o.name === "person" || TIERE.includes(o.name);
      g.strokeStyle = g.fillStyle = o.name === "person" ? "#ff8a1e" : lebend ? "#4fd8ff" : "#4dffa6";
      const x = o.x * W, y = o.y * Hh, bw = o.w * W, bh = o.h * Hh;
      // HUD-Ecken statt voller Rahmen
      const e = Math.min(bw, bh) * 0.22;
      g.beginPath();
      for (const [ax, ay, dx, dy] of [[x, y, 1, 1], [x + bw, y, -1, 1], [x, y + bh, 1, -1], [x + bw, y + bh, -1, -1]]) { g.moveTo(ax + dx * e, ay); g.lineTo(ax, ay); g.lineTo(ax, ay + dy * e); }
      g.stroke();
      g.globalAlpha = 0.12; g.fillRect(x, y, bw, bh); g.globalAlpha = 1;
      const t = `${de(o.name).toUpperCase()} ${Math.round(o.score * 100)}%`;
      const tw = g.measureText(t).width + 10 * u;
      g.fillRect(x, Math.max(0, y - 18 * u), tw, 18 * u);
      g.fillStyle = "#060300"; g.fillText(t, x + 5 * u, Math.max(13 * u, y - 5 * u));
    }
    if (linie) {
      g.strokeStyle = "#ffcf3a"; g.setLineDash([10 * u, 6 * u]); g.lineWidth = 3 * u;
      g.beginPath(); g.moveTo(linie.x1 * W, linie.y1 * Hh); g.lineTo(linie.x2 * W, linie.y2 * Hh); g.stroke(); g.setLineDash([]);
      g.fillStyle = "#ffcf3a"; g.fillText("🚪 TÜR", linie.x1 * W + 6 * u, linie.y1 * Hh - 6 * u);
    }
    if (gefahr) {
      g.strokeStyle = "#ff3b3b"; g.lineWidth = 6 * u; g.strokeRect(3 * u, 3 * u, W - 6 * u, Hh - 6 * u);
      g.fillStyle = "#ff3b3b"; g.font = `bold ${18 * u}px ui-monospace, Menlo, monospace`; g.fillText(`🔥 ${gefahr.toUpperCase()}`, 14 * u, 34 * u);
    }
  }

  function piep(mal = 3) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < mal; i++) {
        const o = ac.createOscillator(), v = ac.createGain();
        o.frequency.value = i % 2 ? 660 : 880; o.type = "square"; v.gain.value = 0.08;
        o.connect(v); v.connect(ac.destination); o.start(ac.currentTime + i * 0.35); o.stop(ac.currentTime + i * 0.35 + 0.25);
      }
      setTimeout(() => ac.close(), mal * 400 + 300);
    } catch { /* kein Ton */ }
  }

  // ---------- Motor: läuft weiter, wenn das Fenster zu ist ----------
  const waechter = new Map(); // kameraId -> Waechter
  let motor = 0;
  let geraet = null; // { id, stream, video, waechter }
  let ipBilder = new Map(); // id -> { img, laden }
  let wakeLock = null;

  function motorAn() {
    if (motor) return;
    motor = setInterval(() => {
      for (const wa of waechter.values()) { try { wa.takt(); } catch { /* weiter */ } }
      if (w.offen()) zeichneKacheln();
    }, 550);
  }
  function motorPruefen() { if (!waechter.size && motor) { clearInterval(motor); motor = 0; } aktualisierePille(); }

  async function starteGeraet() {
    const raum = $("#kw-raum").value.trim() || "Kamera";
    merke("wache_raum", raum);
    merke("wache_cam", $("#kw-cam").value);
    status("Kamera startet …");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: $("#kw-cam").value, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (err) {
      status(`Kein Zugriff auf die Kamera (${err.name || "Fehler"}). Erlaube den Zugriff in den Browser-Einstellungen.`, true);
      return;
    }
    let st;
    try { st = await json("/api/wache/station", { body: { id: lese("wache_station"), name: raum } }); }
    catch (err) { stream.getTracks().forEach((t) => t.stop()); status(`Der Mac antwortet nicht: ${err.message}`, true); return; }
    merke("wache_station", st.id);
    merke("wache_laeuft", "1");
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.autoplay = true; video.srcObject = stream;
    video.play().catch(() => {});
    const wa = new Waechter({ id: st.id, name: st.name, typ: "geraet", quelle: video });
    wa.linie = st.linie;
    geraet = { id: st.id, stream, video, waechter: wa };
    waechter.set(st.id, wa);
    stream.getVideoTracks()[0]?.addEventListener("ended", () => stoppeGeraet());
    motorAn();
    wachHalten();
    $("#kw-start").classList.add("hidden"); $("#kw-stopp").classList.remove("hidden");
    status("Erkennung lädt …");
    try { await ladeErkennung(); status(`📡 ${st.name} läuft. Friday passt auf.`); }
    catch { status("Die Erkennung konnte nicht geladen werden (beim ersten Mal braucht Friday Internet). Bewegung und Feuerschein laufen trotzdem.", true); }
    laden();
  }

  function stoppeGeraet() {
    if (!geraet) return;
    geraet.stream.getTracks().forEach((t) => t.stop());
    waechter.delete(geraet.id);
    geraet = null;
    merke("wache_laeuft", "0");
    $("#kw-start").classList.remove("hidden"); $("#kw-stopp").classList.add("hidden");
    try { wakeLock?.release(); } catch { /* egal */ } wakeLock = null;
    motorPruefen();
    status("Kamera gestoppt.");
    laden();
  }

  // Bildschirm nicht ausgehen lassen (altes iPhone als Kamera).
  async function wachHalten() {
    try { if ("wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch { /* nicht erlaubt */ }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && geraet) wachHalten(); });

  // IP-Kameras: Bild vom Mac holen (alle ~1,2 s) und hier auswerten.
  function ipAuswerten() { return lese("wache_ip_auswerten") === "1"; }
  function ipAbgleichen() {
    const ips = (stand?.kameras || []).filter((k) => k.typ === "ip");
    for (const k of ips) {
      if (ipAuswerten() && !waechter.has(k.id)) {
        const img = new Image();
        const wa = new Waechter({ id: k.id, name: k.name, typ: "ip", quelle: img });
        wa.linie = k.linie;
        waechter.set(k.id, wa);
        ipBilder.set(k.id, { img, laden: false, fehler: "" });
      }
    }
    for (const id of [...waechter.keys()]) {
      if (waechter.get(id).typ === "ip" && (!ipAuswerten() || !ips.some((k) => k.id === id))) { waechter.delete(id); ipBilder.delete(id); }
    }
    if (waechter.size) { motorAn(); ladeErkennung().catch(() => {}); }
    motorPruefen();
  }
  setInterval(async () => {
    for (const [id, b] of ipBilder) {
      if (b.laden) continue;
      b.laden = true;
      try {
        const r = await window.Friday.api(`/api/wache/live/${encodeURIComponent(id)}`);
        if (r.status === 204) continue;
        if (!r.ok) { b.fehler = (await r.json().catch(() => ({}))).error || `Fehler ${r.status}`; continue; }
        const url = URL.createObjectURL(await r.blob());
        const alt = b.img.src;
        b.img.src = url; b.fehler = "";
        if (alt.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(alt), 3000);
      } catch (err) { b.fehler = err.message; } finally { b.laden = false; }
    }
  }, 1200);

  // ---------- Laden + Anzeige ----------
  async function laden() {
    try {
      stand = await json("/api/wache");
    } catch (err) { status(`Kamera-Wache nicht erreichbar: ${err.message}`, true); return; }
    for (const k of stand.kameras) { const wa = waechter.get(k.id); if (wa) { wa.linie = k.linie; wa.einst = stand.einstellungen; wa.name = k.name; } }
    ipAbgleichen();
    zeigeKopf();
    if (w.offen()) { baueKacheln(); if (tab === "einstellungen") zeigeEinstellungen(); }
    aktualisierePille();
  }

  function zeigeKopf() {
    const b = $("#kw-scharf");
    b.classList.toggle("an", stand.scharf);
    b.setAttribute("aria-pressed", String(stand.scharf));
    $("#kw-scharf-t").textContent = stand.scharf ? "WACHE SCHARF" : "WACHE AUS";
    $("#kw-scharf-u").textContent = stand.scharf ? `seit ${new Date(stand.scharfSeit).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr · Tippen zum Ausschalten` : "Tippen zum Scharfschalten";
    const t = stand.heute.typen || {};
    const an = stand.kameras.filter((k) => k.online).length;
    $("#kw-heute").innerHTML = `<span class="kw-zahl">📡 Kameras<b>${an}/${stand.kameras.length}</b></span>`
      + ["bewegung", "person", "tier", "tuer", "gefahr"].map((x) => `<span class="kw-zahl" title="${TYPNAME[x]} heute">${ICON[x]}<b>${t[x] || 0}</b></span>`).join("")
      + `<span class="kw-zahl">🚨 Alarme<b>${stand.heute.alarme}</b></span>`;
  }

  $("#kw-scharf").addEventListener("click", async () => {
    try { await json("/api/wache/scharf", { body: { an: !stand?.scharf } }); await laden(); status(stand.scharf ? "🛡 Wache ist scharf. Friday meldet Auffälligkeiten." : "Wache aus. Die Kameras zeigen weiter live."); }
    catch (err) { status(err.message, true); }
  });

  // Kacheln: eine pro Kamera.
  let kachelIds = "";
  function baueKacheln() {
    const box = $("#kw-raster");
    const ids = stand.kameras.map((k) => k.id).join(",");
    if (!stand.kameras.length) { box.innerHTML = `<div class="hf-leer">Noch keine Kamera. Starte unten „Dieses Gerät als Kamera“ oder füge eine IP-Kamera hinzu.</div>`; kachelIds = ""; return; }
    if (ids !== kachelIds) {
      kachelIds = ids;
      box.innerHTML = stand.kameras.map((k) => `
        <article class="kw-kachel" data-id="${esc(k.id)}">
          <div class="kw-bild"><div class="kw-leer">Warte auf Bild …</div><img class="kw-img" alt="" hidden><canvas class="kw-ov"></canvas><div class="kw-scan"></div>
            <div class="kw-ecke"><span class="kw-l"></span><span class="kw-r"></span></div></div>
          <div class="kw-fuss">
            <div class="kw-name">${k.typ === "ip" ? "📷" : "📱"} <span class="kw-n"></span><small class="kw-z"></small></div>
            <div class="kw-bew"><i></i></div>
            <div class="kw-chips kw-o"></div>
            <div class="kw-knoepfe">
              <button class="hf-mini" data-a="linie" type="button">🚪 Tür-Linie ziehen</button>
              <button class="hf-mini" data-a="genau" type="button">👁 Schau genau hin</button>
              <button class="hf-mini" data-a="ereignisse" type="button">📸 Ereignisse</button>
            </div>
          </div>
        </article>`).join("");
      box.querySelectorAll(".kw-kachel").forEach((el) => {
        el.querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", () => kachelAktion(el.dataset.id, b.dataset.a, b)));
        el.querySelector(".kw-ov").addEventListener("pointerdown", (e) => linieStart(el, e));
      });
    }
    zeichneKacheln();
  }

  const fremdeBilder = new Map(); // id -> { at, url }
  async function holeFremdesBild(k) {
    const f = fremdeBilder.get(k.id) || {};
    if (f.laden || Date.now() - (f.at || 0) < (k.typ === "ip" ? 1500 : 4000)) return f.url;
    f.laden = true; fremdeBilder.set(k.id, f);
    try {
      const r = await window.Friday.api(`/api/wache/live/${encodeURIComponent(k.id)}`);
      if (r.status === 204) { /* noch kein Bild */ }
      else if (r.ok) { const url = URL.createObjectURL(await r.blob()); if (f.url) setTimeout(() => URL.revokeObjectURL(f.url), 3000); f.url = url; f.fehler = ""; }
      else f.fehler = (await r.json().catch(() => ({}))).error || "";
    } catch { /* weiter */ } finally { f.laden = false; f.at = Date.now(); }
    return f.url;
  }

  function zeichneKacheln() {
    if (!stand) return;
    for (const el of w.$$(".kw-kachel")) {
      const k = stand.kameras.find((x) => x.id === el.dataset.id);
      if (!k) continue;
      const wa = waechter.get(k.id);
      const bild = el.querySelector(".kw-bild");
      const img = el.querySelector(".kw-img");
      const ov = el.querySelector(".kw-ov");
      const leer = el.querySelector(".kw-leer");
      let quelle = null, objekte = [], zahlen = k.objekte || {}, bewegung = k.bewegung, gefahr = k.gefahr, linie = k.linie, online = k.online;
      if (wa && wa.bereit()) {
        quelle = wa.quelle; objekte = wa.objekte; zahlen = wa.zahlen; bewegung = wa.bewegung; gefahr = wa.gefahr; linie = wa.linie; online = true;
        // Das Gerät selbst: Video direkt in die Kachel hängen.
        if (quelle instanceof HTMLVideoElement && quelle.parentElement !== bild) { quelle.className = "kw-vid"; bild.insertBefore(quelle, ov); }
        if (quelle instanceof HTMLImageElement) { img.hidden = false; if (img.src !== quelle.src) img.src = quelle.src; }
        leer.hidden = true;
      } else {
        // Kamera an einem anderen Gerät: Standbild vom Mac.
        holeFremdesBild(k).then((url) => { if (url && img.src !== url) { img.src = url; img.hidden = false; leer.hidden = true; } });
        const f = fremdeBilder.get(k.id);
        if (!img.src) { leer.hidden = false; leer.textContent = f?.fehler ? `⚠ ${f.fehler}` : k.online ? "Warte auf Bild …" : k.typ === "ip" ? "IP-Kamera: Schalter „auf diesem Gerät auswerten“ an, oder Bild kommt …" : "Kamera ist aus. Öffne auf dem Gerät die Kamera-Wache."; }
      }
      // Overlay (Rahmen, Tür-Linie)
      const [bw, bh] = quelle ? wa.groesse() : [img.naturalWidth || 1280, img.naturalHeight || 800];
      const r = bild.getBoundingClientRect();
      const s = Math.min(r.width / bw, r.height / bh) || 1;
      const W = Math.round(bw * s), Hh = Math.round(bh * s);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (ov.width !== Math.round(r.width * dpr)) { ov.width = Math.round(r.width * dpr); ov.height = Math.round(r.height * dpr); }
      const g = ov.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, r.width, r.height);
      g.save(); g.translate((r.width - W) / 2, (r.height - Hh) / 2);
      ov._box = { x: (r.width - W) / 2, y: (r.height - Hh) / 2, W, H: Hh };
      zeichneRahmen(g, W, Hh, objekte, el._ziehLinie || linie, gefahr);
      g.restore();
      // Texte
      el.querySelector(".kw-n").textContent = k.name;
      el.querySelector(".kw-z").textContent = online ? (wa ? (wa.fremd ? "wird woanders ausgewertet" : "wertet hier aus") : "live") : k.zuletzt ? `zuletzt ${new Date(k.zuletzt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : "aus";
      el.querySelector(".kw-l").innerHTML = online ? `<b class="kw-live-an">● LIVE</b>` : `<b class="kw-live-aus">○ AUS</b>`;
      el.querySelector(".kw-r").innerHTML = stand.scharf && online ? `<b class="kw-rec">◉ WACHE</b>` : esc(new Date().toLocaleTimeString("de-DE"));
      el.querySelector(".kw-bew i").style.width = `${Math.min(100, bewegung || 0)}%`;
      const chips = Object.entries(zahlen || {}).sort((a, b) => (b[0] === "person") - (a[0] === "person") || TIERE.includes(b[0]) - TIERE.includes(a[0])).slice(0, 8)
        .map(([n, z]) => `<span class="kw-chip ${n === "person" || TIERE.includes(n) ? "lebend" : ""}">${n === "person" ? "🧍" : n === "dog" ? "🐕" : n === "cat" ? "🐈" : "🔍"} ${esc(de(n))}${z > 1 ? ` ×${z}` : ""}</span>`);
      if (gefahr) chips.unshift(`<span class="kw-chip gefahr">🔥 ${esc(gefahr)}</span>`);
      if (!chips.length && online) chips.push(`<span class="kw-chip">✓ alles ruhig</span>`);
      el.querySelector(".kw-o").innerHTML = chips.join("");
      el.classList.toggle("alarm", Boolean(gefahr || (wa && wa.alarmBis > Date.now())));
    }
  }
  let anzeigeTimer = 0;
  function starteAnzeige() {
    clearInterval(anzeigeTimer);
    anzeigeTimer = setInterval(() => { if (!w.offen()) { clearInterval(anzeigeTimer); return; } if (!waechter.size) zeichneKacheln(); }, 1000);
    // Live-Stand der anderen Geräte alle 5 s neu holen
    const t = setInterval(() => { if (!w.offen()) { clearInterval(t); return; } laden(); }, 5000);
  }

  function fokus(id) {
    zeigeTab("live");
    const el = w.$$(".kw-kachel").find((x) => x.dataset.id === id);
    if (!el) return;
    w.$$(".kw-kachel").forEach((x) => x.classList.toggle("fokus", x === el));
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ---------- Tür-Linie ziehen ----------
  function linieStart(el, e) {
    if (!el.querySelector(".kw-bild").classList.contains("zeichnen")) return;
    const ov = el.querySelector(".kw-ov");
    const box = ov._box;
    const rect = ov.getBoundingClientRect();
    const pos = (ev) => ({ x: Math.min(1, Math.max(0, (ev.clientX - rect.left - box.x) / box.W)), y: Math.min(1, Math.max(0, (ev.clientY - rect.top - box.y) / box.H)) });
    const a = pos(e);
    el._ziehLinie = { x1: a.x, y1: a.y, x2: a.x, y2: a.y };
    ov.setPointerCapture(e.pointerId);
    const move = (ev) => { const b = pos(ev); el._ziehLinie = { ...el._ziehLinie, x2: b.x, y2: b.y }; zeichneKacheln(); };
    const up = async () => {
      ov.removeEventListener("pointermove", move); ov.removeEventListener("pointerup", up);
      el.querySelector(".kw-bild").classList.remove("zeichnen");
      const l = el._ziehLinie; el._ziehLinie = null;
      const lang = Math.hypot(l.x2 - l.x1, l.y2 - l.y1) >= 0.05;
      try {
        await json("/api/wache/kamera", { body: { id: el.dataset.id, linie: lang ? l : null } });
        status(lang ? "🚪 Tür-Linie gespeichert. Geht jemand darüber, meldet Friday es." : "Tür-Linie entfernt.");
        laden();
      } catch (err) { status(err.message, true); }
    };
    ov.addEventListener("pointermove", move); ov.addEventListener("pointerup", up);
  }

  async function kachelAktion(id, a, knopf) {
    const k = stand.kameras.find((x) => x.id === id);
    if (a === "linie") {
      const bild = w.$$(".kw-kachel").find((x) => x.dataset.id === id)?.querySelector(".kw-bild");
      bild?.classList.add("zeichnen");
      status(`🚪 Zieh im Bild von ${k?.name} eine Linie quer über die Tür (Finger oder Maus). Kurz tippen = Linie löschen.`);
    }
    if (a === "ereignisse") { filterTyp = ""; zeigeTab("ereignisse"); ladeEreignisse(id); }
    if (a === "genau") {
      knopf.disabled = true; status("👁 Friday schaut genau hin …");
      try {
        const r = await json("/api/wache/beschreiben", { body: { id } });
        status(r.text, !r.ok);
        if (r.ok) window.Friday?.say?.(r.text);
      } catch (err) { status(err.message, true); } finally { knopf.disabled = false; }
    }
  }

  // ---------- Ereignisse ----------
  let filterKamera = "";
  async function ladeEreignisse(kamera) {
    if (kamera !== undefined) filterKamera = kamera;
    const f = $("#kw-filter");
    f.innerHTML = [["", "Alle"], ...["person", "tier", "bewegung", "tuer", "gefahr", "objekt", "offline", "system"].map((t) => [t, `${ICON[t]} ${TYPNAME[t]}`])]
      .map(([t, n]) => `<button class="hf-tab ${filterTyp === t ? "an" : ""}" data-typ="${t}" type="button">${n}</button>`).join("")
      + (filterKamera ? `<button class="hf-tab an" data-kam="" type="button">📷 ${esc(stand?.kameras.find((k) => k.id === filterKamera)?.name || "Kamera")} ✕</button>` : "");
    f.querySelectorAll("[data-typ]").forEach((b) => b.addEventListener("click", () => { filterTyp = b.dataset.typ; ladeEreignisse(); }));
    f.querySelector("[data-kam]")?.addEventListener("click", () => ladeEreignisse(""));
    const q = new URLSearchParams({ limit: "120", ...(filterTyp ? { typ: filterTyp } : {}), ...(filterTag ? { tag: filterTag } : {}), ...(filterKamera ? { kamera: filterKamera } : {}) });
    let d;
    try { d = await json(`/api/wache/ereignisse?${q}`); } catch (err) { $("#kw-liste").innerHTML = `<div class="hf-leer">${esc(err.message)}</div>`; return; }
    $("#kw-bericht").textContent = d.bericht || "";
    const liste = $("#kw-liste");
    if (!d.ereignisse.length) { liste.innerHTML = `<div class="hf-leer">Keine Ereignisse${filterTyp || filterTag ? " mit diesem Filter" : ""}. Alles ruhig.</div>`; return; }
    liste.innerHTML = d.ereignisse.map((e) => `
      <article class="kw-ev ${e.alarm ? "alarm" : ""}" data-id="${esc(e.id)}">
        <button class="kw-evbild" type="button" ${e.bild ? `data-bild="${esc(e.bild)}"` : "disabled"} aria-label="Foto ansehen">${e.bild ? "" : ICON[e.typ] || "•"}</button>
        <div class="kw-evtext"><b>${ICON[e.typ] || "•"} ${esc(e.text)}</b>
          <small>${esc(e.raum || "Wache")}${e.details ? ` (${esc(e.details)})` : ""} · ${new Date(e.at).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}${e.alarm ? ' · <span class="hf-schlecht">🚨 Alarm</span>' : ""}
          <button class="hf-mini" data-weg type="button" title="Löschen">🗑</button></small></div>
      </article>`).join("");
    liste.querySelectorAll(".kw-ev").forEach((el) => {
      const b = el.querySelector("[data-bild]");
      if (b) {
        bildUrl(b.dataset.bild).then((url) => { if (url) b.style.backgroundImage = `url("${url}")`; });
        b.addEventListener("click", async () => { const g = $("#kw-gross"); g.querySelector("img").src = await bildUrl(b.dataset.bild); g.querySelector("p").textContent = el.querySelector("b").textContent + " · " + el.querySelector("small").firstChild.textContent; g.classList.remove("hidden"); });
      }
      el.querySelector("[data-weg]").addEventListener("click", async () => { await json(`/api/wache/ereignis/${encodeURIComponent(el.dataset.id)}`, { method: "DELETE" }).catch(() => {}); el.remove(); });
    });
  }
  async function bildUrl(pfad) {
    if (blobs.has(pfad)) return blobs.get(pfad);
    try {
      const r = await window.Friday.api(`/api/wache/bild/${pfad}`);
      if (!r.ok) return "";
      const url = URL.createObjectURL(await r.blob());
      blobs.set(pfad, url);
      return url;
    } catch { return ""; }
  }
  $("#kw-gross").addEventListener("click", () => $("#kw-gross").classList.add("hidden"));
  $("#kw-tag").addEventListener("change", (e) => { filterTag = e.target.value; ladeEreignisse(); });

  // ---------- Einstellungen ----------
  function zeigeEinstellungen() {
    if (!stand) return;
    const e = stand.einstellungen;
    const schalter = (gruppe, liste) => liste.map(([k, n]) => `<label class="switch"><input type="checkbox" data-g="${gruppe}" data-k="${k}" ${e[gruppe][k] ? "checked" : ""}><span>${n}</span></label>`).join("");
    $("#kw-erkennen").innerHTML = schalter("erkennen", [["bewegung", "🚶 Bewegung"], ["personen", "🧍 Personen (nur „Person“, nie wer)"], ["tiere", "🐕 Hunde & Katzen"], ["objekte", "🔍 Gegenstände"], ["gefahr", "🔥 Feuerschein & Rauch (soweit sichtbar)"], ["tuer", "🚪 Tür-Linie"]]);
    $("#kw-alarm").innerHTML = schalter("alarmBei", [["person", "🧍 Person"], ["tuer", "🚪 Jemand geht durch die Tür"], ["bewegung", "🚶 Jede Bewegung"], ["tier", "🐕 Tier"], ["objekt", "🔍 Bewachter Gegenstand weg"], ["gefahr", "🔥 Feuer/Rauch"], ["offline", "📵 Kamera fällt aus"]]);
    $("#kw-gefahrimmer").checked = e.gefahrImmer; $("#kw-foto").checked = e.telegramFoto; $("#kw-ton").checked = e.ton;
    $("#kw-pause").value = String(e.pauseMin); $("#kw-tage").value = String(e.aufbewahrenTage);
    $("#kw-empf").value = String(e.empfindlichkeit); $("#kw-empf-w").textContent = `${e.empfindlichkeit} %`;
    $("#kw-wege").innerHTML = `Alarm geht an: ${e.telegram ? "✅ Telegram" : "⚠ Telegram nicht eingerichtet"} · ${e.ntfy ? "✅ ntfy" : "ntfy aus"}`;
    $("#kw-bewachen").innerHTML = BEWACHBAR.map((k) => `<button type="button" class="kw-chip ${e.bewachen.includes(k) ? "an" : ""}" data-ding="${k}">${esc(de(k))}</button>`).join("");
    $("#kw-kameras").innerHTML = stand.kameras.length ? stand.kameras.map((k) => `
      <div class="hf-zeile" data-id="${esc(k.id)}"><span class="icon">${k.typ === "ip" ? "📷" : "📱"}</span>
        <input class="hf-input name" value="${esc(k.name)}" maxlength="40" aria-label="Name">
        ${k.typ === "ip" ? `<input class="hf-input name kw-url" value="${esc(k.url)}" aria-label="Adresse" spellcheck="false">` : `<span class="klein">${k.online ? "● an" : "○ aus"}</span>`}
        ${k.typ === "ip" ? '<button class="hf-mini" data-test type="button">Testen</button>' : ""}
        <button class="hf-mini" data-save type="button">Speichern</button><button class="hf-mini" data-del type="button">🗑</button></div>`).join("") : `<div class="hf-leer">Noch keine Kamera.</div>`;
    w.$$("#kw-kameras .hf-zeile").forEach((z) => {
      const id = z.dataset.id;
      z.querySelector("[data-save]").addEventListener("click", async () => {
        try { await json("/api/wache/kamera", { body: { id, name: z.querySelector(".name").value, url: z.querySelector(".kw-url")?.value } }); status("Gespeichert."); laden(); } catch (err) { status(err.message, true); }
      });
      z.querySelector("[data-del]").addEventListener("click", async () => {
        if (geraet?.id === id) stoppeGeraet();
        await json(`/api/wache/kamera/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
        status("Kamera entfernt. Die gespeicherten Ereignisse bleiben."); laden();
      });
      z.querySelector("[data-test]")?.addEventListener("click", async (ev) => {
        ev.target.disabled = true; status("Teste die Kamera …");
        try { const r = await json(`/api/wache/kamera/${encodeURIComponent(id)}/test`, { body: {} }); status(r.ok ? `✅ Bild kommt an (${Math.round(r.groesse / 1024)} KB).` : `⚠ ${r.error}`, !r.ok); }
        catch (err) { status(err.message, true); } finally { ev.target.disabled = false; }
      });
    });
  }
  async function speichereEinst(teil) {
    try { stand.einstellungen = await json("/api/wache/einstellungen", { body: teil }); zeigeEinstellungen(); status("Gespeichert."); for (const wa of waechter.values()) wa.einst = stand.einstellungen; }
    catch (err) { status(err.message, true); }
  }
  w.sheet.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.dataset?.g) speichereEinst({ [t.dataset.g]: { [t.dataset.k]: t.checked } });
    else if (t.id === "kw-gefahrimmer") speichereEinst({ gefahrImmer: t.checked });
    else if (t.id === "kw-foto") speichereEinst({ telegramFoto: t.checked });
    else if (t.id === "kw-ton") speichereEinst({ ton: t.checked });
    else if (t.id === "kw-pause") speichereEinst({ pauseMin: Number(t.value) });
    else if (t.id === "kw-tage") speichereEinst({ aufbewahrenTage: Number(t.value) });
    else if (t.id === "kw-empf") speichereEinst({ empfindlichkeit: Number(t.value) });
    else if (t.id === "kw-ipauswerten") { merke("wache_ip_auswerten", t.checked ? "1" : "0"); ipAbgleichen(); status(t.checked ? "IP-Kameras werden auf diesem Gerät ausgewertet." : "IP-Kameras werden hier nicht mehr ausgewertet."); }
  });
  $("#kw-empf").addEventListener("input", (e) => { $("#kw-empf-w").textContent = `${e.target.value} %`; });
  $("#kw-bewachen").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-ding]"); if (!b) return;
    const set = new Set(stand.einstellungen.bewachen);
    set.has(b.dataset.ding) ? set.delete(b.dataset.ding) : set.add(b.dataset.ding);
    speichereEinst({ bewachen: [...set] });
  });

  // ---------- Knöpfe Live ----------
  $("#kw-start").addEventListener("click", starteGeraet);
  $("#kw-stopp").addEventListener("click", stoppeGeraet);
  $("#kw-raum").value = lese("wache_raum", "");
  $("#kw-cam").value = lese("wache_cam", "user") === "environment" ? "environment" : "user";
  $("#kw-ipauswerten").checked = ipAuswerten();
  $("#kw-ipneu").addEventListener("click", async () => {
    const name = $("#kw-ipname").value.trim(), url = $("#kw-ipurl").value.trim();
    if (!url) { status("Trag die Adresse der Kamera ein (steht in der Anleitung der Kamera, oft rtsp://…).", true); return; }
    try {
      const r = await json("/api/wache/kamera", { body: { name: name || "IP-Kamera", url } });
      $("#kw-ipname").value = ""; $("#kw-ipurl").value = "";
      status("Kamera hinzugefügt, ich teste sie …");
      const t = await json(`/api/wache/kamera/${encodeURIComponent(r.id)}/test`, { body: {} });
      status(t.ok ? "✅ Die Kamera liefert ein Bild." : `⚠ ${t.error}`, !t.ok);
      laden();
    } catch (err) { status(err.message, true); }
  });

  // ---------- Kleine Anzeige, wenn das Fenster zu ist ----------
  const pille = document.createElement("button");
  pille.className = "kw-pille hidden"; pille.type = "button";
  pille.addEventListener("click", () => w.auf());
  document.body.appendChild(pille);
  function aktualisierePille() {
    const laeuft = waechter.size > 0;
    pille.classList.toggle("hidden", !laeuft || w.offen());
    pille.classList.toggle("scharf", Boolean(stand?.scharf));
    if (laeuft) pille.innerHTML = `<i></i>${stand?.scharf ? "WACHE SCHARF" : "KAMERA-WACHE"} · ${esc([...waechter.values()].map((x) => x.name).join(", "))}`;
  }
  new MutationObserver(aktualisierePille).observe(w.sheet, { attributes: true, attributeFilter: ["class"] });

  // ---------- Start: ?wache=1&raum=Küche (altes iPhone als Kamera) oder Kamera lief beim letzten Mal ----------
  const p = new URLSearchParams(location.search);
  function wennAngemeldet(fn) {
    let n = 0;
    const t = setInterval(() => {
      if (++n > 120) { clearInterval(t); return; }
      if (!window.Friday?.api || !lese("friday_token") || document.getElementById("login")?.offsetParent) return;
      clearInterval(t); fn();
    }, 500);
  }
  if (p.has("wache")) {
    if (p.get("raum")) $("#kw-raum").value = p.get("raum").slice(0, 40);
    if (p.get("cam") === "hinten") $("#kw-cam").value = "environment";
    wennAngemeldet(() => { w.auf(); if (p.get("raum")) starteGeraet(); });
  } else {
    wennAngemeldet(() => {
      laden();
      // Kamera lief beim letzten Mal (z. B. Seite neu geladen nach Update): wieder starten, damit die Wache nicht ausfällt.
      if (lese("wache_laeuft") === "1" && lese("wache_station")) starteGeraet();
    });
  }

  window.FridayWache = {
    open: (opt) => w.auf(opt || {}),
    refresh: () => laden(),
    _neu: null, // Test-Haken
    _waechter: waechter,
  };
})();
