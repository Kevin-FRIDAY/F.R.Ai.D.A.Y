// F.R.Ai.D.A.Y Dashboard
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* privater Modus */ } },
    remove(key) { try { localStorage.removeItem(key); } catch { /* egal */ } },
  };

  let token = storage.get("friday_token");
  let status = {};
  let pendingImage = null;
  let speaking = false;
  let busy = false;

  // ---------- Server ----------
  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    if (res.status === 401) {
      showLogin();
      throw new Error("Nicht angemeldet");
    }
    return res;
  }

  // ---------- Anmeldung ----------
  function showLogin() {
    token = null;
    storage.remove("friday_token");
    $("app").classList.add("hidden");
    $("login").classList.remove("hidden");
    $("password").focus();
  }

  function showApp() {
    $("login").classList.add("hidden");
    $("app").classList.remove("hidden");
    refreshAll();
  }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("login-error").textContent = "";
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: $("password").value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      token = data.token;
      storage.set("friday_token", token);
      $("password").value = "";
      showApp();
      say(`Willkommen zurück, Boss.`);
    } catch (err) {
      $("login-error").textContent = err.message;
    }
  });

  $("logout").addEventListener("click", showLogin);

  // ---------- Anzeige ----------
  function setState(text, mode = "") {
    $("state").textContent = text;
    $("reactor").className = `reactor ${mode}`;
  }

  function addMessage(who, text) {
    const div = document.createElement("div");
    div.className = `msg ${who}`;
    const label = document.createElement("small");
    label.textContent = who === "user" ? (status.name || "DU").toUpperCase() : "F.R.AI.D.A.Y";
    div.append(label, document.createTextNode(text));
    $("transcript").append(div);
    $("transcript").scrollTop = $("transcript").scrollHeight;
  }

  function tick() {
    const now = new Date();
    $("clock").textContent = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    $("date").textContent = now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  setInterval(tick, 1000);
  tick();

  function setBadge(id, on, onText = "aktiv", offText = "aus") {
    const el = $(id);
    el.textContent = on ? onText : offText;
    el.className = on ? "ok" : "off";
  }

  async function refreshStatus() {
    try {
      status = await (await api("/api/status")).json();
      setBadge("st-server", true, "online");
      setBadge("st-mac", status.agent?.online, status.agent?.name || "verbunden", "getrennt");
      setBadge("st-voice", status.voice, "ElevenLabs", "Gerät");
      setBadge("st-push", status.push);
      setBadge("st-telegram", status.telegram);
      setBadge("st-home", status.smartHome);
      $("st-version").textContent = status.version || "-";
    } catch {
      $("st-server").textContent = "offline";
      $("st-server").className = "bad";
    }
  }

  async function refreshWeather() {
    try {
      const w = await (await api("/api/weather")).json();
      if (w.error) throw new Error(w.error);
      const days = w.tage.slice(1).map((d) => {
        const name = new Date(d.tag).toLocaleDateString("de-DE", { weekday: "short" });
        return `<div>${escapeHtml(name)}: ${Math.round(d.min)}° / ${Math.round(d.max)}° · ${escapeHtml(d.wetter)}</div>`;
      }).join("");
      $("weather").innerHTML = `<div class="weather-now">${Math.round(w.jetzt.temperatur)}°</div>
        <div>${escapeHtml(w.ort)} · ${escapeHtml(w.jetzt.wetter)}</div><div class="weather-days">${days}</div>`;
    } catch {
      $("weather").textContent = "Wetter nicht verfügbar";
    }
  }

  async function refreshReminders() {
    try {
      const list = await (await api("/api/reminders")).json();
      const ul = $("reminders");
      ul.innerHTML = "";
      if (!list.length) ul.innerHTML = '<li class="muted">Keine</li>';
      list.sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6).forEach((r) => {
        const li = document.createElement("li");
        const when = new Date(r.due).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" });
        li.textContent = `${when} · ${r.text}`;
        ul.append(li);
      });
    } catch { /* still */ }
  }

  async function refreshProtocols() {
    try {
      const protocols = await (await api("/api/protocols")).json();
      const box = $("protocols");
      box.innerHTML = "";
      Object.entries(protocols).forEach(([name, p]) => {
        const b = document.createElement("button");
        b.className = "chip";
        b.textContent = name;
        b.title = p.description || "";
        b.addEventListener("click", () => send(`Starte Protokoll ${name}`));
        box.append(b);
      });
    } catch { /* still */ }
  }

  function refreshAll() {
    refreshStatus();
    checkUpdate();
    refreshWeather();
    refreshReminders();
    refreshProtocols();
  }

  setInterval(() => token && refreshStatus(), 30000);
  setInterval(() => token && refreshReminders(), 60000);
  setInterval(() => token && refreshWeather(), 15 * 60000);

  if (navigator.getBattery) {
    navigator.getBattery().then((b) => {
      const show = () => { $("st-battery").textContent = `${Math.round(b.level * 100)} %${b.charging ? " ⚡" : ""}`; };
      show();
      b.addEventListener("levelchange", show);
      b.addEventListener("chargingchange", show);
    }).catch(() => {});
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- Stimme (Ausgabe) ----------
  let germanVoice = null;
  function pickVoice() {
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("de"));
    germanVoice = voices.find((v) => /anna|helena|petra|katja|marlene|vicki/i.test(v.name)) || voices[0] || null;
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  const audio = new Audio();

  async function say(text) {
    if (!$("voice-toggle").checked || !text) return;
    speaking = true;
    pauseWake();
    setState("Spricht", "speaking");
    try {
      if (status.voice) {
        const res = await api("/api/tts", { method: "POST", body: JSON.stringify({ text }) });
        if (res.ok) {
          audio.src = URL.createObjectURL(await res.blob());
          await audio.play();
          await new Promise((r) => { audio.onended = r; audio.onerror = r; });
          return;
        }
      }
      if ("speechSynthesis" in window) {
        await new Promise((resolve) => {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = "de-DE";
          if (germanVoice) u.voice = germanVoice;
          u.rate = 1.05;
          u.onend = resolve;
          u.onerror = resolve;
          speechSynthesis.speak(u);
        });
      }
    } catch { /* still */ } finally {
      speaking = false;
      setState("Bereit, Boss.");
      resumeWake();
    }
  }

  // ---------- Senden ----------
  async function send(text) {
    text = (text || "").trim();
    if ((!text && !pendingImage) || busy) return;
    busy = true;
    addMessage("user", pendingImage ? `📷 ${text}` : text);
    setState("Denkt nach", "thinking");
    const body = { text, image: pendingImage || undefined };
    if ($("translate-toggle").checked) {
      body.mode = "translate";
      body.targetLang = $("translate-lang").value;
    }
    clearPhoto();
    try {
      const res = await api("/api/chat", { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      const answer = data.answer || data.error || "Keine Antwort.";
      addMessage("friday", answer);
      busy = false;
      if (data.actions?.some((a) => a === "set_reminder")) refreshReminders();
      await say(answer);
    } catch (err) {
      addMessage("friday", `Verbindung gestört: ${err.message}`);
      setState("Fehler", "");
    } finally {
      busy = false;
      if (!speaking) setState("Bereit, Boss.");
    }
  }

  $("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = $("text").value;
    $("text").value = "";
    send(t);
  });

  // Für das Lagezentrum (lagezentrum.js).
  window.Friday = { api, say, escapeHtml };

  $("briefing-btn").addEventListener("click", () => send("Gib mir mein Briefing."));
  $("look-btn").addEventListener("click", () => send("Schau dir meinen Mac-Bildschirm an und sag mir kurz, was du siehst."));
  $("new-chat-btn").addEventListener("click", async () => {
    await api("/api/history/clear", { method: "POST" });
    $("transcript").innerHTML = "";
    setState("Neues Gespräch");
  });

  $("key-btn").addEventListener("click", async () => {
    const { token: key } = await (await api("/api/shortcut-token")).json();
    addMessage("friday", `Dein Kurzbefehl-Schlüssel (für Siri, Watch und Gesundheit):\n\n${key}\n\nNicht weitergeben, Boss.`);
  });

  $("translate-toggle").addEventListener("change", (e) => {
    $("translate-lang").classList.toggle("hidden", !e.target.checked);
  });

  // ---------- Updates ----------
  // Rot = neue Version da, Grün = aktuell, Grau = konnte nicht prüfen.
  let update = null;

  function showUpdate(kind, label, title) {
    $("update-btn").className = `update-btn upd-${kind}`;
    $("update-label").textContent = label;
    $("update-btn").title = title || label;
  }

  async function checkUpdate() {
    try {
      update = await (await api("/api/update")).json();
      if (update.error) showUpdate("unknown", "Updates prüfen", update.error);
      else if (update.available) showUpdate("new", `Update auf ${update.latest}`, `Neue Version ${update.latest} (du hast ${update.installed})`);
      else showUpdate("ok", `Aktuell · ${update.installed}`, "Friday ist auf dem neuesten Stand");
    } catch {
      showUpdate("unknown", "Updates prüfen", "Konnte nicht nach Updates suchen");
    }
  }
  setInterval(() => token && checkUpdate(), 6 * 3600000);

  $("update-btn").addEventListener("click", async () => {
    if ($("update-btn").classList.contains("upd-busy")) return;
    if (!update?.available) {
      showUpdate("busy", "Suche...");
      await checkUpdate();
      if (update?.error) addMessage("sys", update.error);
      return;
    }
    if (!confirm(`Friday auf Version ${update.latest} aktualisieren? Sie ist danach kurz offline.`)) return;
    const res = await (await api("/api/update", { method: "POST" })).json();
    if (res.error) return addMessage("sys", res.error);
    showUpdate("busy", "Update läuft...");
    addMessage("friday", `Ich spiele Version ${update.latest} ein und starte gleich neu, Boss.`);
    const target = update.latest;
    const started = Date.now();
    const poll = setInterval(async () => {
      try {
        const st = await (await api("/api/status")).json();
        const u = await (await api("/api/update")).json();
        if (u.status?.state === "fehler") {
          clearInterval(poll);
          addMessage("sys", u.status.message);
          checkUpdate();
        } else if (st.version === target) {
          clearInterval(poll);
          location.reload();
        }
      } catch { /* Friday startet gerade neu */ }
      if (Date.now() - started > 5 * 60000) {
        clearInterval(poll);
        addMessage("sys", "Das Update dauert ungewöhnlich lange. Schau in ~/Library/Logs/Friday/update.log nach.");
        checkUpdate();
      }
    }, 3000);
  });

  // ---------- Foto ----------
  $("camera-btn").addEventListener("click", () => $("photo").click());
  $("photo").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingImage = await shrinkImage(file);
    const img = document.createElement("img");
    img.src = `data:${pendingImage.mediaType};base64,${pendingImage.data}`;
    $("photo-preview").replaceChildren(img);
    $("photo-preview").classList.remove("hidden");
    $("text").placeholder = "Was soll Friday zum Foto sagen?";
    $("text").focus();
  });

  function clearPhoto() {
    pendingImage = null;
    $("photo").value = "";
    $("photo-preview").classList.add("hidden");
    $("text").placeholder = "Schreib Friday etwas...";
  }

  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(img.src);
        resolve({ mediaType: "image/jpeg", data: canvas.toDataURL("image/jpeg", 0.85).split(",")[1] });
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // ---------- Spracherkennung ----------
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const WAKE = /\b(friday|freitag|fraidei|frei day)\b[,.!]?\s*/i;
  let wakeRec = null;
  let wakeActive = false;

  function listenOnce() {
    if (!Recognition) {
      addMessage("friday", "Dein Browser kann keine Sprache erkennen. Nutze Safari oder Chrome, oder tipp unten.");
      return;
    }
    pauseWake();
    const rec = new Recognition();
    rec.lang = "de-DE";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setState("Ich höre", "listening");
    rec.onresult = (e) => send(e.results[0][0].transcript);
    rec.onerror = () => setState("Nicht verstanden");
    rec.onend = () => {
      if (!busy && !speaking) setState("Bereit, Boss.");
      resumeWake();
    };
    rec.start();
  }

  $("reactor").addEventListener("click", () => {
    if (speaking) {
      speechSynthesis?.cancel();
      audio.pause();
      return;
    }
    listenOnce();
  });

  // Dauerhaft auf "Friday" hören (klappt, solange das Dashboard offen ist).
  function startWake() {
    if (!Recognition) return;
    wakeRec = new Recognition();
    wakeRec.lang = "de-DE";
    wakeRec.continuous = true;
    wakeRec.interimResults = false;
    wakeRec.onresult = (e) => {
      const said = e.results[e.results.length - 1][0].transcript;
      const match = said.match(WAKE);
      if (!match || busy || speaking) return;
      const command = said.slice(match.index + match[0].length).trim();
      if (command.length > 2) send(command);
      else listenOnce();
    };
    wakeRec.onend = () => {
      if (wakeActive && !speaking && !busy) setTimeout(() => { try { wakeRec.start(); } catch { /* läuft schon */ } }, 300);
    };
    try { wakeRec.start(); } catch { /* läuft schon */ }
  }

  function pauseWake() {
    if (wakeRec) { try { wakeRec.abort(); } catch { /* egal */ } }
  }

  function resumeWake() {
    if (wakeActive && wakeRec && !speaking) { try { wakeRec.start(); } catch { /* läuft schon */ } }
  }

  $("wake-toggle").addEventListener("change", (e) => {
    wakeActive = e.target.checked;
    storage.set("friday_wake", wakeActive ? "1" : "0");
    if (wakeActive) {
      startWake();
      setState('Höre auf "Friday"');
    } else {
      pauseWake();
      wakeRec = null;
      setState("Bereit, Boss.");
    }
  });

  // ---------- Start ----------
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  if (token) showApp();
  else showLogin();
})();
