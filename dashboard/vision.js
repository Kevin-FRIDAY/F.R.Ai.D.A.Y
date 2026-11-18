// F.R.Ai.D.A.Y Vision: erkennt Dinge und Hand-Gesten vor der eigenen Kamera.
// Alles läuft im Browser auf diesem Gerät. Kein Bild wird gespeichert oder verschickt,
// außer du tippst auf "Was siehst du?" (dann geht ein Standbild an Fridays Gehirn).
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
    if (stream) return; // läuft schon
    const run = ++openRun;
    box.classList.remove("hidden");
    showPhoneTime();
    hint("Lade Erkennung …");
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false });
    } catch (err) {
      hint(`Kein Zugriff auf die Kamera (${err.name || "Fehler"}). Erlaube den Zugriff in den Browser-Einstellungen.`, true);
      return;
    }
    if (run !== openRun) { stream.getTracks().forEach((t) => t.stop()); stream = null; return; } // inzwischen geschlossen
    video.srcObject = stream;
    $("vision-live").classList.remove("hidden");
    try { await loadModels(); } catch { hint("Die Erkennung konnte nicht geladen werden (Internet nötig beim ersten Start).", true); return; }
    if (!stream) return; // inzwischen geschlossen
    hint("");
    running = true; lastRun = 0;
    raf = requestAnimationFrame(loop);
  }

  function close() {
    openRun++;
    running = false;
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

  // "Was siehst du?": ein Standbild an Fridays Gehirn.
  $("vision-ask")?.addEventListener("click", () => {
    if (!video.videoWidth) { hint("Die Kamera ist noch nicht bereit, einen Moment."); return; }
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(video.videoWidth * scale); c.height = Math.round(video.videoHeight * scale);
    c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
    const frame = { mediaType: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] };
    close();
    window.Friday.askAboutImage?.(frame, "Was siehst du durch die Kamera?");
  });

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

  // Für Tests: Modelle laden und ein Standbild auswerten.
  window.FridayVision = { load: loadModels, analyse: (source) => analyse(source, performance.now()) };
})();
