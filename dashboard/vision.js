// F.R.Ai.D.A.Y Vision: erkennt Dinge und Hand-Gesten vor der eigenen Kamera.
// Alles läuft im Browser auf diesem Gerät. Kein Bild wird gespeichert oder verschickt,
// außer du fragst "Was siehst du?" (dann geht ein Standbild an Fridays Gehirn) oder scannst ein Produkt.
// v1.154.0: Produkt-Scan (Strichcode → Open Food Facts + Open Prices, sonst Foto-Erkennung) und
// "Friday, was siehst du?" aus jedem Menü: Vision geht von selbst auf und Friday antwortet per Stimme.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { say } = window.Friday;
  const box = $("vision");
  if (!box) return;

  const LIB = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
  const MODELS = "https://storage.googleapis.com/mediapipe-models/";
  const DE = {
    person: "Person", "cell phone": "Handy", cup: "Tasse", laptop: "Laptop", keyboard: "Tastatur", mouse: "Maus",
    bottle: "Flasche", book: "Buch", chair: "Stuhl", tv: "Bildschirm", remote: "Fernbedienung", clock: "Uhr",
    backpack: "Rucksack", "wine glass": "Glas", couch: "Sofa", bed: "Bett", "potted plant": "Pflanze",
    scissors: "Schere", cat: "Katze", dog: "Hund", banana: "Banane", apple: "Apfel", "dining table": "Tisch",
  };
  const HAND_LINES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

  const video = $("vision-video"), canvas = $("vision-canvas"), ctx = canvas.getContext("2d");
  let stream = null, detector = null, gestures = null, models = null, raf = 0, running = false, lastRun = 0;
  const IST_HANDY = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let facing = "user"; // "user" = Selfie-Kamera, "environment" = Rückkamera (Handy)

  // ---------- Modelle laden (einmal) ----------
  function loadModels() {
    models ??= (async () => {
      const v = await import(`${LIB}/vision_bundle.mjs`);
      const files = await v.FilesetResolver.forVisionTasks(`${LIB}/wasm`);
      detector = await v.ObjectDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${MODELS}object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite` },
        runningMode: "VIDEO", scoreThreshold: 0.3, maxResults: 10,
      });
      gestures = await v.GestureRecognizer.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${MODELS}gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task` },
        runningMode: "VIDEO", numHands: 2,
      });
    })().catch((err) => { models = null; throw err; });
    return models;
  }

  // ---------- Fokus-Modus: Handyzeit nur für dich ----------
  const dayKey = () => `friday_focus_${new Date().toLocaleDateString("sv-SE")}`;
  const getSecs = () => { try { return Number(localStorage.getItem(dayKey())) || 0; } catch { return 0; } };
  const addSecs = (s) => { try { localStorage.setItem(dayKey(), String(getSecs() + s)); } catch { /* egal */ } };
  const fmtTime = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} Std. ${Math.round((s % 3600) / 60)} Min.` : s >= 60 ? `${Math.round(s / 60)} Min.` : `${Math.round(s)} Sek.`);
  let phoneLastSeen = 0, lastNag = 0;
  const showPhoneTime = () => { $("vision-phone").textContent = `Handy heute: ${fmtTime(getSecs())}`; };

  function trackFocus(objects, now, dt) {
    if (!$("vision-focus").checked) return;
    if (!objects.some((o) => o.name === "cell phone")) return;
    addSecs(dt);
    showPhoneTime();
    // Spruch nur, wenn das Handy neu auftaucht, und höchstens einmal pro Minute.
    if (now - phoneLastSeen > 20000 && now - lastNag > 60000) { lastNag = now; say("Boss, das Handy. Du wolltest dich konzentrieren."); }
    phoneLastSeen = now;
  }

  // ---------- Gesten ----------
  let gestureSince = 0, gestureName = "", lastAction = 0;
  function handleGesture(name, now) {
    if (name !== gestureName) { gestureName = name; gestureSince = now; }
    const label = $("vision-gesture");
    if (name === "Open_Palm") label.textContent = "✋ STOPP";
    else if (name === "Thumb_Up") label.textContent = "👍 BESTÄTIGT";
    else label.textContent = "";
    // Offene Hand kurz halten: Friday hört auf zu sprechen.
    if (name === "Open_Palm" && now - gestureSince > 500 && now - lastAction > 2000) { lastAction = now; window.Friday.stopSpeaking?.(); }
  }

  // ---------- Zeichnen ----------
  function draw(objects, hands) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const u = Math.max(1, canvas.width / 640);
    ctx.lineWidth = 2 * u;
    ctx.font = `${13 * u}px ui-monospace, Menlo, monospace`;
    objects.forEach((o, i) => {
      const hot = o.name === "cell phone";
      ctx.strokeStyle = ctx.fillStyle = hot ? "#ff5d6c" : "#4dffa6";
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      const text = `${String.fromCharCode(65 + (i % 26))}${i + 1} · ${(DE[o.name] || o.name).toUpperCase()} ${Math.round(o.score * 100)}%`;
      const tw = ctx.measureText(text).width + 10 * u;
      ctx.fillRect(o.x, Math.max(0, o.y - 20 * u), tw, 20 * u);
      ctx.fillStyle = "#04120a";
      ctx.fillText(text, o.x + 5 * u, Math.max(14 * u, o.y - 6 * u));
    });
    ctx.strokeStyle = "#4fd8ff"; ctx.fillStyle = "#ffffff";
    for (const hand of hands) {
      ctx.beginPath();
      for (const [a, b] of HAND_LINES) { ctx.moveTo(hand[a].x * canvas.width, hand[a].y * canvas.height); ctx.lineTo(hand[b].x * canvas.width, hand[b].y * canvas.height); }
      ctx.stroke();
      for (const p of hand) { ctx.beginPath(); ctx.arc(p.x * canvas.width, p.y * canvas.height, 3 * u, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  // Wertet ein Bild aus (Video oder Standbild) und gibt Objekte + Hände zurück.
  const minScore = () => { try { return (Number(localStorage.getItem("friday_vision_schwelle")) || 45) / 100; } catch { return 0.45; } };
  const gesturesOn = () => { try { return localStorage.getItem("friday_vision_gesten") !== "0"; } catch { return true; } };
  function analyse(source, ts) {
    const det = detector.detectForVideo(source, ts);
    const objects = (det.detections || []).filter((d) => (d.categories[0]?.score || 0) >= minScore()).map((d) => ({
      name: d.categories[0]?.categoryName || "?", score: d.categories[0]?.score || 0,
      x: d.boundingBox.originX, y: d.boundingBox.originY, w: d.boundingBox.width, h: d.boundingBox.height,
    }));
    if (!gesturesOn()) return { objects, hands: [], gesture: "" };
    const g = gestures.recognizeForVideo(source, ts);
    return { objects, hands: g.landmarks || [], gesture: g.gestures?.[0]?.[0]?.categoryName || "" };
  }

  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (now - lastRun < 80 || !video.videoWidth) return; // ~12 Bilder pro Sekunde reichen
    const dt = lastRun ? Math.min(1, (now - lastRun) / 1000) : 0;
    lastRun = now;
    if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
    try {
      const r = analyse(video, now);
      draw(r.objects, r.hands);
      handleGesture(r.gesture, now);
      trackFocus(r.objects, now, dt);
      $("vision-count").textContent = `${r.objects.length} Objekte · ${r.hands.length} Hände`;
    } catch { /* einzelnes Bild übersprungen */ }
  }

  // ---------- Start / Stopp ----------
  const hint = (text, error) => { const h = $("vision-hint"); h.textContent = text; h.classList.toggle("error", Boolean(error)); h.classList.toggle("hidden", !text); };

  let openRun = 0;
  async function open() {
    if (stream) return true; // läuft schon
    const run = ++openRun;
    box.classList.remove("hidden");
    showPhoneTime();
    hint("Lade Erkennung …");
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 } }, audio: false });
    } catch (err) {
      hint(`Kein Zugriff auf die Kamera (${err.name || "Fehler"}). Erlaube den Zugriff in den Browser-Einstellungen.`, true);
      return false;
    }
    if (run !== openRun) { stream.getTracks().forEach((t) => t.stop()); stream = null; return false; } // inzwischen geschlossen
    video.srcObject = stream;
    $("vision-live").classList.remove("hidden");
    // Ohne Erkennungs-Modelle (kein Internet) gehen Fragen und Produkt-Scan trotzdem.
    let modelleOk = true;
    try { await loadModels(); } catch { modelleOk = false; hint("Rahmen-Erkennung nicht geladen (Internet nötig beim ersten Start). Fragen und Produkt-Scan gehen trotzdem.", true); }
    if (!stream) return false; // inzwischen geschlossen
    if (modelleOk) hint("");
    running = true; lastRun = 0;
    raf = requestAnimationFrame(loop);
    return true;
  }

  // Kamera wechseln (Handy: vorne ↔ hinten).
  async function wechsleKamera(ziel) {
    const neu = ziel || (facing === "user" ? "environment" : "user");
    if (neu === facing && stream) return true;
    facing = neu;
    if (!stream) return true;
    const alt = stream;
    try {
      const s2 = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 } }, audio: false });
      alt.getTracks().forEach((t) => t.stop());
      stream = s2; video.srcObject = s2;
      await bereit(3000);
      return true;
    } catch { return false; }
  }

  // Wartet, bis das Kamerabild wirklich da ist (Belichtung braucht einen Moment).
  async function bereit(maxMs = 6000) {
    const t0 = Date.now();
    while (!video.videoWidth && Date.now() - t0 < maxMs) await new Promise((r) => setTimeout(r, 100));
    if (!video.videoWidth) return false;
    await new Promise((r) => setTimeout(r, 450));
    return true;
  }

  function close() {
    openRun++;
    running = false;
    scanStopp();
    zeigeProdukt(null);
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    $("vision-live").classList.add("hidden");
    $("vision-gesture").textContent = "";
    box.classList.add("hidden");
  }

  $("vision-open")?.addEventListener("click", open);
  $("vision-x")?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !box.classList.contains("hidden")) close(); });

  // Standbild der Kamera (verkleinert) für Fridays Gehirn.
  function standbild(max = 1280) {
    if (!video.videoWidth) return null;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(video.videoWidth * scale); c.height = Math.round(video.videoHeight * scale);
    c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
    return { mediaType: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] };
  }

  // "Was siehst du?": ein Standbild an Fridays Gehirn. Vision bleibt offen, Friday antwortet per Stimme.
  $("vision-ask")?.addEventListener("click", () => frage("Was siehst du durch die Kamera?"));

  // Foto nur auf Knopfdruck: Kamerabild mit den Rahmen ins Archiv auf dem Mac (Jahr → Monat).
  // Klappt das nicht (z. B. Server weg), wird es wie früher als Datei heruntergeladen.
  $("vision-foto")?.addEventListener("click", async () => {
    if (!video.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = video.videoWidth; c.height = video.videoHeight;
    const g = c.getContext("2d");
    g.drawImage(video, 0, 0); g.drawImage(canvas, 0, 0);
    const bild = c.toDataURL("image/jpeg", 0.9);
    const knopf = $("vision-foto");
    knopf.disabled = true;
    try {
      const r = await (await window.Friday.api("/api/archiv/foto", { method: "POST", body: JSON.stringify({ bild, quelle: "vision" }) })).json();
      if (!r.ok) throw new Error(r.error || "Fehler");
      hint(`📸 Im Archiv gespeichert: ${new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}`);
      setTimeout(() => hint(""), 2600);
      window.FridayArchiv?.refresh();
    } catch {
      const a = document.createElement("a");
      a.href = bild;
      a.download = `friday-vision-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.jpg`;
      a.click();
      hint("Archiv nicht erreichbar, Foto wurde heruntergeladen.", true);
      setTimeout(() => hint(""), 3500);
    } finally { knopf.disabled = false; }
  });

  $("vision-summary")?.addEventListener("click", () => {
    const s = getSecs();
    const text = s < 5 ? "Heute habe ich dich im Fokus-Modus noch nicht am Handy gesehen." : `Heute warst du im Fokus-Modus ${fmtTime(s)} am Handy.`;
    $("vision-phone").textContent = `Handy heute: ${fmtTime(s)}`;
    say(text);
  });

  // ======================================================================
  // Produkt-Scan (v1.154.0): Strichcode lesen → Open Food Facts / Open Prices. Kein Code → Foto an Friday.
  // ======================================================================
  const ZX = "/vendor/zxing/";
  let zxing = null, nativ = null, scan = null, letztesProdukt = null;
  const FORMATE_NATIV = ["ean_13", "ean_8", "upc_a", "upc_e"];

  async function codeLeser() {
    if (nativ === null) {
      nativ = false;
      try {
        if ("BarcodeDetector" in window) {
          const da = await window.BarcodeDetector.getSupportedFormats?.();
          if (!da || FORMATE_NATIV.some((f) => da.includes(f))) nativ = new window.BarcodeDetector({ formats: FORMATE_NATIV.filter((f) => !da || da.includes(f)) });
        }
      } catch { nativ = false; }
    }
    if (nativ) return nativ;
    zxing ??= import(`${ZX}reader.js`).then((m) => { m.setZXingModuleOverrides({ locateFile: (pfad, pre) => (pfad.endsWith(".wasm") ? `${ZX}${pfad}` : pre + pfad) }); return m; })
      .catch((e) => { zxing = null; throw e; });
    return zxing;
  }

  const scanCanvas = document.createElement("canvas");
  async function leseCode() {
    if (!video.videoWidth) return "";
    const leser = await codeLeser();
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    scanCanvas.width = Math.round(video.videoWidth * scale); scanCanvas.height = Math.round(video.videoHeight * scale);
    const g = scanCanvas.getContext("2d", { willReadFrequently: true });
    g.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
    if (leser === nativ && nativ) {
      const r = await nativ.detect(scanCanvas);
      return r.map((x) => x.rawValue).find((v) => /^\d{8,14}$/.test(v)) || "";
    }
    const daten = g.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
    const r = await leser.readBarcodes(daten, { formats: ["EAN13", "EAN8", "UPCA", "UPCE"], tryHarder: true, maxNumberOfSymbols: 1 });
    return r.map((x) => x.text).find((v) => /^\d{8,14}$/.test(v)) || "";
  }

  const ist = (el, an) => el?.classList.toggle("hidden", !an);
  function scanStopp() {
    if (scan) { clearTimeout(scan.timer); scan.aktiv = false; }
    scan = null;
    ist($("vision-scanrahmen"), false);
    $("vision-scan")?.classList.remove("on");
  }

  // Startet den Scan. Findet sich nach ein paar Sekunden kein Strichcode, schaut Friday aufs Foto.
  async function scanStart({ stimme = true, fotoNach = 5000 } = {}) {
    if (!stream && !(await open())) { if (stimme) say("Ich komme gerade nicht an die Kamera."); return; }
    if (IST_HANDY && facing === "user") await wechsleKamera("environment");
    if (!(await bereit())) { hint("Die Kamera ist noch nicht bereit.", true); return; }
    scanStopp();
    zeigeProdukt(null);
    const s = (scan = { aktiv: true, seit: Date.now(), stimme });
    ist($("vision-scanrahmen"), true);
    $("vision-scan")?.classList.add("on");
    hint("Halte das Produkt mit dem Strichcode in den Rahmen …");
    let leserOk = true;
    while (s.aktiv && Date.now() - s.seit < fotoNach) {
      let code = "";
      try { code = await leseCode(); } catch { leserOk = false; break; }
      if (!s.aktiv) return;
      if (code) { scanStopp(); return nachschlagen(code, stimme); }
      await new Promise((r) => setTimeout(r, 180));
    }
    if (!s.aktiv) return;
    scanStopp();
    return fotoErkennen(stimme, leserOk);
  }

  async function nachschlagen(code, stimme) {
    hint(`Strichcode ${code} erkannt · schlage nach …`);
    try { navigator.vibrate?.(60); } catch { /* egal */ }
    window.FridayAuftrag?.start?.();
    try {
      const r = await (await window.Friday.api(`/api/produkt/code/${encodeURIComponent(code)}`)).json();
      if (r.ok) { hint(""); return fertig(r, stimme); }
      if (r.unbekannt) { hint("Strichcode unbekannt · Friday schaut aufs Foto …"); return fotoErkennen(stimme, true); }
      throw new Error(r.error || "Fehler");
    } catch {
      hint("Produkt-Datenbank gerade nicht erreichbar.", true);
      if (stimme) say("Die Produkt-Datenbank ist gerade nicht erreichbar.");
    } finally { window.FridayAuftrag?.ende?.(true); }
  }

  async function fotoErkennen(stimme, leserOk = true) {
    const bild = standbild(1280);
    if (!bild) return;
    hint(leserOk ? "Kein Strichcode zu sehen · Friday erkennt das Produkt am Foto …" : "Friday erkennt das Produkt am Foto …");
    window.FridayAuftrag?.start?.();
    try {
      const r = await (await window.Friday.api("/api/produkt/bild", { method: "POST", body: JSON.stringify({ image: bild }) })).json();
      if (r.ok) { hint(""); return fertig(r, stimme); }
      hint(r.error || "Nicht erkannt.", true);
      if (stimme) say(r.error || "Das konnte ich leider nicht erkennen.");
    } catch {
      hint("Mac nicht erreichbar.", true);
      if (stimme) say("Ich erreiche gerade den Mac nicht.");
    } finally { window.FridayAuftrag?.ende?.(true); }
  }

  function fertig(r, stimme) {
    letztesProdukt = r;
    zeigeProdukt(r.produkt);
    if (stimme) say(r.ansage);
  }

  // ---------- Produkt-Karte ----------
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kz = (n, d = 1) => (n === null || n === undefined ? "–" : String(Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10 ** d) / 10 ** d).replace(".", ","));
  const eur = (n) => `${Number(n).toFixed(2).replace(".", ",")} €`;
  const NUTRI = { A: "#1e8f4e", B: "#60ac3e", C: "#f5c100", D: "#ef7d00", E: "#e63e11" };

  function zeigeProdukt(p) {
    const k = $("vision-produkt");
    if (!k) return;
    if (!p) { k.classList.add("hidden"); k.innerHTML = ""; return; }
    const n = p.naehrwerte || {};
    const zeile = (name, wert, einheit, d) => `<tr><td>${name}</td><td>${wert === null || wert === undefined ? "–" : `${kz(wert, d)} ${einheit}`}</td></tr>`;
    const pr = p.preis;
    const preis = !pr ? `<div class="vp-preis leer"><b>Preis unbekannt</b><span>Noch keine Preismeldung vorhanden.</span></div>`
      : `<div class="vp-preis ${pr.art}"><b>${pr.art === "geschaetzt" ? `ca. ${eur(pr.min)} – ${eur(pr.max)}` : `≈ ${eur(pr.wert)}`}</b>`
        + `<span>${pr.art === "geschaetzt" ? "Schätzung von Friday, kein echter Ladenpreis" : `Richtwert aus ${pr.anzahl} Preismeldung${pr.anzahl === 1 ? "" : "en"}${pr.min !== pr.max ? ` (${eur(pr.min)} – ${eur(pr.max)})` : ""}${pr.laeden?.length ? ` · ${esc(pr.laeden.join(", "))}` : ""}${pr.zuletzt ? ` · zuletzt ${new Date(pr.zuletzt).toLocaleDateString("de-DE", { month: "short", year: "numeric" })}` : ""}`}</span></div>`;
    k.innerHTML = `
      <header class="vp-kopf">
        ${p.bild ? `<img src="${esc(p.bild)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : `<div class="vp-ico">🛒</div>`}
        <div class="vp-titel"><small>${esc(p.marke || "PRODUKT")}${p.menge ? ` · ${esc(p.menge)}` : ""}</small><b>${esc(p.name || "Unbekanntes Produkt")}</b>
          ${p.code ? `<span class="vp-code">EAN ${esc(p.code)}</span>` : ""}</div>
        <button class="ghost small vp-x" data-vp="zu" title="Schließen">✕</button>
      </header>
      ${preis}
      <div class="vp-reihe">
        ${p.nutriscore ? `<span class="vp-ns" style="--ns:${NUTRI[p.nutriscore] || "#888"}">Nutri-Score <b>${p.nutriscore}</b></span>` : ""}
        ${p.nova ? `<span class="vp-tag">NOVA ${p.nova}</span>` : ""}
        ${p.vegan ? `<span class="vp-tag gut">vegan</span>` : ""}${p.bio ? `<span class="vp-tag gut">bio</span>` : ""}
        ${p.geschaetzt ? `<span class="vp-tag warn">Werte geschätzt</span>` : ""}
      </div>
      <h4>Nährwerte pro 100 g</h4>
      <table class="vp-nw">${zeile("Energie", n.kcal, "kcal", 0)}${zeile("Fett", n.fett, "g")}${zeile("davon gesättigt", n.gesaettigt, "g")}${zeile("Kohlenhydrate", n.kohlenhydrate, "g")}${zeile("davon Zucker", n.zucker, "g")}${zeile("Ballaststoffe", n.ballaststoffe, "g")}${zeile("Eiweiß", n.eiweiss, "g")}${zeile("Salz", n.salz, "g", 2)}</table>
      ${p.allergene?.length ? `<h4>Allergene</h4><div class="vp-reihe">${p.allergene.map((a) => `<span class="vp-tag warn">${esc(a)}</span>`).join("")}</div>` : ""}
      ${p.spuren?.length ? `<p class="vp-klein">Kann Spuren enthalten: ${esc(p.spuren.join(", "))}</p>` : ""}
      ${p.zutaten ? `<h4>Zutaten</h4><p class="vp-zutaten">${esc(p.zutaten)}</p>` : ""}
      ${p.zusatzstoffe?.length ? `<p class="vp-klein">Zusatzstoffe: ${esc(p.zusatzstoffe.join(", "))}</p>` : ""}
      ${p.hinweis ? `<p class="vp-klein">${esc(p.hinweis)}</p>` : ""}
      <footer class="vp-fuss">
        <button class="chip" data-vp="sag">🔊 Vorlesen</button>
        <button class="chip" data-vp="liste">🛒 Auf die Einkaufsliste</button>
        <button class="chip" data-vp="neu">↻ Nächstes Produkt</button>
      </footer>
      <p class="vp-quelle">Quelle: ${esc(p.quelle || "")}${p.gesucht ? " (per Suche gefunden, bitte prüfen)" : ""}${pr ? ` · Preis: ${esc(pr.quelle)}` : ""}</p>`;
    k.classList.remove("hidden");
    k.scrollTop = 0;
  }

  $("vision-produkt")?.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-vp]");
    if (!b) return;
    const was = b.dataset.vp;
    if (was === "zu") zeigeProdukt(null);
    else if (was === "sag" && letztesProdukt) say(letztesProdukt.ansage);
    else if (was === "neu") scanStart();
    else if (was === "liste" && letztesProdukt) {
      const p = letztesProdukt.produkt;
      const name = [p.marke, p.name].filter(Boolean).join(" ");
      try {
        await window.Friday.api("/api/shopping", { method: "POST", body: JSON.stringify({ text: name }) });
        b.textContent = "✓ Auf der Liste"; b.disabled = true;
        say(`${p.name || "Das Produkt"} steht auf der Einkaufsliste.`);
      } catch { hint("Einkaufsliste nicht erreichbar.", true); }
    }
  });

  $("vision-scan")?.addEventListener("click", () => (scan ? (scanStopp(), hint("")) : scanStart()));
  $("vision-switch")?.addEventListener("click", () => wechsleKamera());
  if (!IST_HANDY) $("vision-switch")?.classList.add("hidden");

  // ======================================================================
  // Fragen an Vision – aus jedem Menü ("Friday, was siehst du?")
  // ======================================================================
  // Ist Vision zu, zählen nur eindeutige Kamera-Fragen. Ist sie offen, auch "was ist das?", "was kostet das?" …
  const SEH_IMMER = /\b(?:siehst|erkennst)\s+du\b|\bwas\s+(?:halte|habe|hab|hält|halt)\s+ich\b|\bin\s+(?:die|der)\s+kamera\b|\b(?:schau|guck|kuck|sieh)(?:e)?\s+(?:dir\s+)?(?:mal\s+)?(?:das|dies|hier|her)\b|\bwas\s+(?:ist|sind)\s+(?:das|dies)\s+(?:hier|da)\b|\bwas\s+steht\s+(?:da|hier)\s*(?:drauf)?\b|\b(?:friday\s+)?vision\b.*\?|\bkannst\s+du\s+(?:das|mich|es)\s+sehen\b/i;
  const SEH_OFFEN = /^(?:und\s+)?(?:was|wie|wo|wer|welche[snrm]?|wieviel|wie\s+viel(?:e)?|ist|sind|hat|kannst|lies|zähl|zaehl|beschreib)\b.*\b(?:das|dies|der|die|den|es|hier|da|davon|drauf|ich|mir|finger|farbe|kamera|bild)\b/i;
  const PRODUKT = /\b(?:scann?e?n?|scan|strichcode|barcode|ean|produkt|artikel|nährwert\w*|naehrwert\w*|kalorien|kcal|zucker|fett|eiweiß|eiweiss|inhaltsstoff\w*|zutat\w*|allergen\w*|nutri\w*|vegan|laktose|gluten|preis|kostet|kosten|teuer|günstig|guenstig|gesund|haltbar\w*|lebensmittel)\b/i;
  const PRODUKT_HIER = /\b(?:scann?e?n?|scan|strichcode|barcode)\b|\b(?:hier|in\s+der\s+hand|in\s+die\s+kamera|halte|hälst|haeltst)\b/i;
  const NICHT = /\b(?:bitcoin|ethereum|krypto|gold|aktie|aktien|dax|euro\s+kurs|dollar|wetter|uhr|spät|spaet|termin|netflix|spotify|abo|bildschirm|monitor|screen|display)\b/i;
  const offen = () => !box.classList.contains("hidden");

  /** Soll diese Frage an die Kamera gehen? Gibt "produkt", "sehen" oder "" zurück. */
  function artDerFrage(text) {
    const t = String(text || "").trim();
    if (!t || t.length > 160 || NICHT.test(t)) return "";
    const produkt = PRODUKT.test(t);
    if (SEH_IMMER.test(t)) return produkt ? "produkt" : "sehen";
    if (produkt && PRODUKT_HIER.test(t)) return "produkt";
    if (offen() && (SEH_OFFEN.test(t) || produkt)) return produkt ? "produkt" : "sehen";
    return "";
  }

  // Beantwortet eine Frage zum Kamerabild. Vision geht dafür von selbst auf (auch aus jedem Menü).
  async function frage(text, art = artDerFrage(text) || "sehen") {
    if (!offen() || !stream) {
      document.querySelectorAll("#menu-pop:not(.hidden)").forEach((m) => m.classList.add("hidden"));
      if (!(await open())) { say("Ich komme gerade nicht an die Kamera. Erlaube den Kamera-Zugriff in den Einstellungen."); return; }
    }
    if (art === "produkt") return scanStart({ fotoNach: 3500 });
    if (!(await bereit())) { say("Die Kamera ist noch nicht bereit, einen Moment."); return; }
    const bild = standbild(1280);
    if (!bild) return;
    hint("Friday schaut hin …");
    setTimeout(() => hint(""), 2500);
    // Was die Erkennung gerade sieht, als kleine Hilfe dazu (ohne Personen zu benennen).
    let hilfe = "";
    try {
      if (detector) {
        const r = analyse(video, performance.now());
        const namen = [...new Set(r.objects.map((o) => DE[o.name] || o.name))];
        if (namen.length) hilfe = ` (Die Rahmen-Erkennung sieht gerade: ${namen.join(", ")}.)`;
      }
    } catch { /* egal */ }
    window.Friday.askAboutImage?.(bild, `${text}${hilfe}\nDas Bild kommt live aus meiner Kamera (Friday Vision). Antworte kurz zum Vorlesen, ohne Aufzählungszeichen. Benenne keine Personen.`);
  }

  // Für app.js: Fragen abfangen, bevor sie normal an den Mac gehen.
  // Für Tests: Modelle laden und ein Standbild auswerten.
  window.FridayVision = {
    load: loadModels, analyse: (source) => analyse(source, performance.now()),
    artDerFrage, frage, open, close, scanStart, nachschlagen, zeigeProdukt,
    get offen() { return offen(); },
  };
})();
