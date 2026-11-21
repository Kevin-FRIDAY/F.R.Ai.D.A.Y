// F.R.Ai.D.A.Y Whisper-Ohr (v1.134.0, Idee aus OpenJarvis "Speech: faster-whisper")
// Nimmt deinen Befehl mit dem Mikrofon auf (hört selbst auf, wenn du nicht mehr sprichst) und lässt ihn
// auf dem Mac von Whisper verstehen. Das Weckwort „Friday“ hört weiter das Gerät; Whisper übernimmt danach:
// nach „Friday“ allein, nach einem Tipp auf Fridays Kopf und bei Rückfragen. Ohne Geräte-Spracherkennung
// (z. B. manche iPhone-Apps) geht so trotzdem: Kopf antippen, sprechen.
(() => {
  "use strict";
  const KEY = "friday_hoeren";
  const lies = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const schreib = (k, v) => { try { localStorage.setItem(k, v); } catch { /* privater Modus */ } };
  const hatGeraetOhr = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const kannAufnehmen = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  let server = { bereit: null, grund: "" };
  let aufnahme = null; // { stopp(), abbrechen() }
  let gesperrtBis = 0; // nach einem Fehler kurz das Gerät nehmen

  const modus = () => lies(KEY) || "auto";
  /** Soll Whisper den nächsten Befehl aufnehmen? */
  function soll() {
    if (!kannAufnehmen || Date.now() < gesperrtBis || server.bereit === false) return false;
    const m = modus();
    return m === "whisper" || (m === "auto" && !hatGeraetOhr);
  }

  async function status(neu = false) {
    if (!window.Friday?.api) return server;
    try { server = await (await window.Friday.api(`/api/hoeren${neu ? "?neu=1" : ""}`)).json(); } catch { /* später */ }
    zeigeInfo();
    return server;
  }

  function mimeWahl() {
    for (const t of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"]) {
      try { if (MediaRecorder.isTypeSupported?.(t)) return t; } catch { /* weiter */ }
    }
    return "";
  }

  /**
   * Nimmt auf, bis du still bist (1,2 s Pause nach dem Sprechen), höchstens maxMs.
   * Ergebnis: { text } oder { error } oder { text: "", leer: true }.
   */
  async function aufnehmen({ maxMs = 9000, wartenMs = 6000, onPegel } = {}) {
    if (aufnahme) aufnahme.abbrechen();
    if (!kannAufnehmen) return { error: "Dieses Gerät kann keine Aufnahme machen." };
    window.Friday.mikroBelegt = true;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (err) {
      window.Friday.mikroBelegt = false;
      return { error: /denied|notallowed|permission/i.test(`${err?.name} ${err?.message}`) ? "Ich darf das Mikrofon nicht benutzen. Erlaube es in den Browser-Einstellungen." : `Mikrofon nicht verfügbar (${err?.message || err}).` };
    }
    const typ = mimeWahl();
    const rec = new MediaRecorder(stream, typ ? { mimeType: typ, audioBitsPerSecond: 64000 } : undefined);
    const teile = [];
    rec.ondataavailable = (e) => { if (e.data?.size) teile.push(e.data); };

    // Stille-Erkennung über die Lautstärke
    let ctx = null, analyser = null, puffer = null;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 300))]);
      if (ctx.state === "running") {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        puffer = new Float32Array(analyser.fftSize);
      }
    } catch { analyser = null; }

    let abgebrochen = false;
    const fertig = new Promise((ok) => { rec.onstop = ok; });
    const start = Date.now();
    let gesprochen = false, letzteStimme = 0, grund = 0.008, timer = null;
    const ende = () => { clearInterval(timer); if (rec.state !== "inactive") try { rec.stop(); } catch { /* egal */ } };
    aufnahme = { stopp: ende, abbrechen: () => { abgebrochen = true; ende(); } };
    rec.start(250);
    document.body.classList.add("whisper-hoert");
    timer = setInterval(() => {
      const jetzt = Date.now();
      if (analyser) {
        analyser.getFloatTimeDomainData(puffer);
        let s = 0;
        for (let i = 0; i < puffer.length; i++) s += puffer[i] * puffer[i];
        const rms = Math.sqrt(s / puffer.length);
        if (jetzt - start < 400) grund = Math.max(grund, rms * 1.6); // Grundrauschen der ersten Zehntelsekunden
        const schwelle = Math.max(0.012, grund * 1.8);
        onPegel?.(Math.min(1, rms / (schwelle * 3)));
        if (rms > schwelle) { if (!gesprochen && jetzt - start > 150) gesprochen = true; letzteStimme = jetzt; }
        if (!gesprochen && jetzt - start > wartenMs) { abgebrochen = "still"; ende(); }
        if (gesprochen && jetzt - letzteStimme > 1200) ende();
      } else if (jetzt - start > Math.min(maxMs, 6500)) ende(); // ohne Pegel: feste Zeit
      if (jetzt - start > maxMs) ende();
    }, 80);

    await fertig;
    stream.getTracks().forEach((t) => t.stop());
    try { ctx?.close(); } catch { /* egal */ }
    document.body.classList.remove("whisper-hoert");
    aufnahme = null;
    window.Friday.mikroBelegt = false;
    if (abgebrochen === "still") return { text: "", leer: true };
    if (abgebrochen) return { text: "", abgebrochen: true };
    const blob = new Blob(teile, { type: (rec.mimeType || typ || "audio/webm").split(";")[0] });
    if (blob.size < 1200) return { text: "", leer: true };
    try {
      const r = await window.Friday.api("/api/hoeren", { method: "POST", body: blob, headers: { "Content-Type": blob.type || "audio/webm" } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) { if (r.status === 503) { gesperrtBis = Date.now() + 5 * 60 * 1000; status(true); } return { error: d.error || `Whisper-Fehler ${r.status}` }; }
      window.FridayDiag?.schritt?.(`Whisper (${d.modell || "?"}, ${Math.round((d.dauer_ms || 0) / 100) / 10} s): „${String(d.text || "").slice(0, 80)}“`);
      return { text: d.text || "", leer: !d.text };
    } catch (err) {
      return { error: `Mac nicht erreichbar (${err?.message || err}).` };
    }
  }

  // ---------- Einstellungen ----------
  const $ = (id) => document.getElementById(id);
  function zeigeInfo() {
    const info = $("set-hoeren-info");
    if (!info) return;
    const teile = [];
    if (server.bereit === false) teile.push(`⚠ ${server.grund || "Whisper ist am Mac nicht bereit."}`);
    else if (server.bereit) teile.push(`✓ Whisper ist bereit${server.geladen ? " und geladen" : ""}${server.letzte_dauer_ms ? `, zuletzt ${Math.round(server.letzte_dauer_ms / 100) / 10} s` : ""}.`);
    if (!kannAufnehmen) teile.push("Dieses Gerät kann keine Aufnahmen machen.");
    teile.push(hatGeraetOhr ? "Das Weckwort „Friday“ hört weiter das Gerät. Mit Whisper nimmt Friday danach deinen Befehl auf (nach „Friday“ allein, nach einem Tipp auf den Kopf, bei Rückfragen)." : "Dieses Gerät hat keine eigene Spracherkennung: Tipp auf Fridays Kopf und sprich, Whisper versteht dich.");
    info.textContent = teile.join(" ");
    const m = $("set-hoeren-modell");
    if (m && server.modell && document.activeElement !== m) m.value = server.modell;
  }
  function einstellungen() {
    const sel = $("set-hoeren");
    if (!sel || sel.dataset.fertig) return;
    sel.dataset.fertig = "1";
    sel.value = modus();
    sel.addEventListener("change", () => {
      schreib(KEY, sel.value);
      gesperrtBis = 0;
      if (sel.value !== "geraet") window.Friday?.api?.("/api/hoeren/vorwaermen", { method: "POST", body: "{}" }).then((r) => r.json()).then((d) => { server = d; zeigeInfo(); }).catch(() => {});
    });
    $("set-hoeren-modell")?.addEventListener("change", async (e) => {
      try { server = await (await window.Friday.api("/api/hoeren/modell", { method: "POST", body: JSON.stringify({ modell: e.target.value }) })).json(); zeigeInfo(); } catch { /* egal */ }
    });
    $("set-hoeren-test")?.addEventListener("click", async (e) => {
      const b = e.currentTarget;
      const alt = b.textContent;
      b.disabled = true;
      b.textContent = "🔴 Sprich jetzt …";
      const r = await aufnehmen({ maxMs: 7000, wartenMs: 5000 });
      b.disabled = false;
      b.textContent = alt;
      const info = $("set-hoeren-info");
      if (info) info.textContent = r.error ? `⚠ ${r.error}` : r.text ? `✓ Verstanden: „${r.text}“` : "Ich habe nichts gehört. Sprich etwas lauter oder näher am Mikrofon.";
    });
    status();
  }

  const style = document.createElement("style");
  style.textContent = `
body.whisper-hoert .reactor { filter: drop-shadow(0 0 22px color-mix(in srgb, var(--cyan) 70%, transparent)); }
body.whisper-hoert #state::after { content: " ● REC"; color: #ff5a4a; font-size: 11px; letter-spacing: .12em; animation: wh-blink 1s steps(2) infinite; }
@keyframes wh-blink { 50% { opacity: .2; } }`;
  document.head.appendChild(style);

  // Warten bis angemeldet, dann einmal den Stand holen; Whisper vorwärmen, wenn es genutzt wird.
  let n = 0;
  const warte = setInterval(() => {
    if (!window.Friday?.api && ++n < 120) return;
    clearInterval(warte);
    einstellungen();
    status().then(() => { if (soll() || modus() === "whisper") window.Friday?.api?.("/api/hoeren/vorwaermen", { method: "POST", body: "{}" }).catch(() => {}); });
  }, 500);
  document.addEventListener("click", (e) => { if (e.target.closest?.("[data-target='settings-open'], #settings-btn, .set-g-head")) einstellungen(); }, true);

  window.FridayHoeren = {
    soll,
    aufnehmen,
    nimmtAuf: () => Boolean(aufnahme),
    fertig: () => aufnahme?.stopp(),
    abbrechen: () => aufnahme?.abbrechen(),
    status,
  };
})();
