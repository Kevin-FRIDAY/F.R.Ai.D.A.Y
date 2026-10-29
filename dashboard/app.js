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

  // "Nur vorlesen": statt Text ein Hinweis, dass Friday spricht.
  function addSpeaking() {
    clearSpeaking();
    const div = document.createElement("div");
    div.className = "msg friday speaking-msg";
    div.id = "speaking-msg";
    const label = document.createElement("small");
    label.textContent = "F.R.AI.D.A.Y";
    const note = document.createElement("span");
    note.className = "speaking-note";
    note.textContent = "🔊 Friday spricht";
    div.append(label, note);
    $("transcript").append(div);
    $("transcript").scrollTop = $("transcript").scrollHeight;
  }

  function clearSpeaking() {
    document.getElementById("speaking-msg")?.remove();
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
      if (!ul) return;
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
      if (!box) return;
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
    refreshSystem();
    loadToday();
    setGreeting();
  }

  // System-Infos (vom Mac): Wärme, Akku, Prozessor, Netzwerk, Speicher, Leistung.
  async function refreshSystem() {
    const box = $("system-body"); const proc = $("proc-list");
    if (!box) return;
    try {
      const s = await (await api("/api/system")).json();
      if (!s.online) { box.innerHTML = '<span class="muted">Mac nicht verbunden</span>'; if (proc) proc.innerHTML = '<li class="muted">–</li>'; return; }
      const stat = (label, p, val) => `<li class="sysrow"><span>${label}</span><b>${val}</b></li><span class="sys-bar"><i style="width:${Math.max(3, Math.min(100, p || 0))}%;background:${p > 85 ? "var(--bad)" : "var(--cyan)"}"></i></span>`;
      const rows = [];
      if (s.cpu_prozent != null) rows.push(stat("CPU", s.cpu_prozent, s.cpu_prozent + "%"));
      if (s.ram_prozent != null) rows.push(stat("RAM", s.ram_prozent, s.ram_prozent + "%"));
      if (s.disk_prozent != null) rows.push(stat("Speicher", s.disk_prozent, s.disk_prozent + "%"));
      const extra = [];
      if (s.akku != null) extra.push(`Akku ${s.akku}%${s.akku_laedt ? " ⚡" : ""}`);
      extra.push(`Wärme ${s.temp || "-"}`);
      if (s.netzwerk) extra.push(escapeHtml(s.netzwerk));
      box.innerHTML = `<ul class="list sys-list">${rows.join("")}</ul><div class="sys-extra muted">${extra.join(" · ")}</div>`;
      if (proc) proc.innerHTML = (s.prozesse || []).length
        ? s.prozesse.map((a) => `<li class="procrow"><span>${escapeHtml(a.name)}</span><b>${a.cpu}%</b></li>`).join("")
        : '<li class="muted">–</li>';
    } catch { box.innerHTML = '<span class="muted">nicht verfügbar</span>'; }
  }
  setInterval(() => { if (token) refreshSystem(); }, 8000);

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
    const all = speechSynthesis.getVoices();
    const saved = storage.get("friday_voice");
    const de = all.filter((v) => v.lang.startsWith("de"));
    germanVoice = (saved && all.find((v) => v.name === saved))
      || de.find((v) => /anna|helena|petra|katja|marlene|vicki/i.test(v.name)) || de[0] || all[0] || null;
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
          window.FridayFace?.talkWithAudio(audio);
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
          u.rate = Number(storage.get("friday_rate")) || 1.05;
          u.pitch = Number(storage.get("friday_pitch")) || 1;
          u.onstart = () => window.FridayFace?.talk(true);
          u.onend = resolve;
          u.onerror = resolve;
          speechSynthesis.speak(u);
        });
      }
    } catch { /* still */ } finally {
      speaking = false;
      window.FridayFace?.stop();
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
      // Nur vorlesen: Bei erfolgreicher Antwort und aktivem Vorlesen keinen Text zeigen.
      const voiceOn = $("voice-toggle").checked && "speechSynthesis" in window;
      if (data.answer && voiceOn) addSpeaking();
      else addMessage("friday", answer);
      busy = false;
      if (data.actions?.some((a) => a === "set_reminder")) refreshReminders();
      await say(answer);
      clearSpeaking();
    } catch (err) {
      addMessage("friday", `Verbindung gestört: ${err.message}`);
      setState("Fehler", "");
    } finally {
      busy = false;
      if (!speaking) setState("Bereit, Boss.");
    }
  }

  $("chat-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = $("text").value;
    $("text").value = "";
    send(t);
  });

  // Für das Lagezentrum (lagezentrum.js).
  window.Friday = { api, say, escapeHtml };

  // ---------- Seitenleiste: Einstellungen & Gehirn ----------
  const openSheet = (id) => $(id)?.classList.remove("hidden");
  const closeSheet = (id) => $(id)?.classList.add("hidden");
  $("settings-btn")?.addEventListener("click", () => openSheet("settings"));
  $("settings-x")?.addEventListener("click", () => closeSheet("settings"));

  // Schwebendes Menü: hält alle Funktionen ohne Seitenleiste erreichbar.
  const menuPop = $("menu-pop");
  $("menu-fab")?.addEventListener("click", (e) => { e.stopPropagation(); menuPop?.classList.toggle("hidden"); });
  $("menu-side")?.addEventListener("click", (e) => { e.stopPropagation(); menuPop?.classList.toggle("hidden"); });
  // Osiris läuft selbst gehostet auf dem Mac (Port 3100). Lokal direkt, von unterwegs über Tailscale (HTTPS, Port 8443).
  const OSIRIS_LAYERS = "flights,private,jets,military,maritime,transit,satellites,cctv,cctv_previews,live_news,earthquakes,fires,weather,infrastructure,global_incidents,alert_pins,day_night,cables,sdk_sea,sdk_air,sdk_naval,live_clouds,wind,rain,wind_controls,rain_controls,wind_particles,terrain_3d,terrain_elevation,malware,cyber_attacks,gdelt_events";
  function osirisBase() {
    const h = location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return "http://localhost:3100";
    return "https://" + h + ":8443"; // Tailscale stellt Osiris hier bereit
  }
  const OSIRIS_URL = () => osirisBase() + "/?layers=" + OSIRIS_LAYERS;
  window.openOsiris = () => { const u = OSIRIS_URL(); try { window.open(u, "_blank", "noopener"); } catch { location.href = u; } };
  // Osiris direkt im Lagezentrum als eingebettete Vollkarte ein-/ausblenden.
  function showOsirisEmbed(on) {
    const box = $("lage-osiris"); if (!box) return;
    if (on) {
      const f = $("lage-osiris-frame"); if (f && !f.getAttribute("src")) f.setAttribute("src", OSIRIS_URL());
      const open = $("lage-osiris-open"); if (open) open.href = OSIRIS_URL();
      box.classList.remove("hidden");
      const b = $("osiris-btn"); if (b) b.textContent = "◎ Globus";
    } else {
      box.classList.add("hidden");
      const b = $("osiris-btn"); if (b) b.textContent = "◎ Osiris";
    }
  }
  window.showOsirisEmbed = showOsirisEmbed;
  $("osiris-btn")?.addEventListener("click", () => showOsirisEmbed($("lage-osiris")?.classList.contains("hidden")));
  menuPop?.addEventListener("click", (e) => {
    const row = e.target.closest(".menu-row");
    if (!row) return;
    menuPop.classList.add("hidden");
    if (row.hasAttribute("data-osiris")) { document.getElementById("lage-btn")?.click(); setTimeout(() => showOsirisEmbed(true), 60); return; }
    document.getElementById(row.dataset.target)?.click();
  });
  document.addEventListener("click", (e) => { if (menuPop && !menuPop.classList.contains("hidden") && !menuPop.contains(e.target) && e.target.id !== "menu-fab" && !e.target.closest("#menu-side")) menuPop.classList.add("hidden"); });

  // ---------- Design: Farb-Themes + AMOLED ----------
  const THEMES = { orange: "#ff8a1e", cyan: "#4fd8ff", gruen: "#46e0a0", rot: "#ff5d6c", lila: "#b57bff", gold: "#ffcc4d", pink: "#ff6ec7", eis: "#8fb6ff" };
  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function applyTheme(name) {
    const hex = THEMES[name] || THEMES.orange;
    const [r, g, b] = hexRgb(hex);
    const root = document.documentElement.style;
    root.setProperty("--cyan", hex);
    root.setProperty("--cyan-soft", `rgba(${r},${g},${b},0.12)`);
    root.setProperty("--line", `rgba(${r},${g},${b},0.24)`);
    root.setProperty("--gold", hex);
    storage.set("friday_theme", name);
    document.querySelectorAll(".swatch").forEach((sw) => sw.classList.toggle("on", sw.dataset.theme === name));
  }
  $("theme-swatches")?.addEventListener("click", (e) => { const sw = e.target.closest(".swatch"); if (sw) applyTheme(sw.dataset.theme); });
  function applyAmoled(on) {
    document.documentElement.style.setProperty("--bg", on ? "#000000" : "#050403");
    storage.set("friday_amoled", on ? "1" : "0");
  }
  $("amoled-toggle")?.addEventListener("change", (e) => applyAmoled(e.target.checked));
  // Gesicht- & Globus-Schalter (von face.js/lagezentrum.js via localStorage gelesen)
  function bindFlag(id, key, def) {
    const el = $(id);
    if (!el) return;
    const saved = storage.get(key);
    el.checked = saved === null || saved === undefined ? def : saved === "1";
    el.addEventListener("change", () => { storage.set(key, el.checked ? "1" : "0"); window.dispatchEvent(new Event("friday-settings")); });
  }
  bindFlag("set-mouth", "friday_mouth", true);
  bindFlag("set-headmove", "friday_headmove", true);
  bindFlag("set-globespin", "friday_globespin", true);
  bindFlag("set-reduce", "friday_reduce", false);
  const applyReduce = () => document.body.classList.toggle("reduce-anim", storage.get("friday_reduce") === "1");
  applyReduce();
  window.addEventListener("friday-settings", applyReduce);
  bindFlag("set-osiris-default", "friday_osiris_default", false);
  bindFlag("set-ticker", "friday_ticker", true);
  const applyTicker = () => { const t = document.getElementById("lage-ticker"); if (t) t.style.display = storage.get("friday_ticker") === "0" ? "none" : ""; };
  applyTicker();
  window.addEventListener("friday-settings", applyTicker);
  // Lagezentrum optional direkt mit Osiris öffnen
  document.getElementById("lage-btn")?.addEventListener("click", () => { if (storage.get("friday_osiris_default") === "1") setTimeout(() => window.showOsirisEmbed && window.showOsirisEmbed(true), 90); });

  // Gespeicherte Vorlieben anwenden.
  // Einmalige Umstellung auf Mockup-Orange (falls noch ein altes Theme gespeichert war).
  if (!storage.get("friday_theme_mockup")) { applyTheme("orange"); storage.set("friday_theme_mockup", "1"); }
  else applyTheme(storage.get("friday_theme") || "orange");
  if (storage.get("friday_amoled") === "1") { applyAmoled(true); const a = $("amoled-toggle"); if (a) a.checked = true; }

  // ---------- Stimme: Auswahl, Tempo, Tonhöhe ----------
  function fillVoices() {
    const sel = $("voice-select");
    if (!sel || !("speechSynthesis" in window)) return;
    const voices = speechSynthesis.getVoices();
    const de = voices.filter((v) => v.lang.startsWith("de"));
    const list = de.length ? de : voices.slice(0, 12);
    const saved = storage.get("friday_voice");
    sel.innerHTML = list.map((v) => `<option value="${escapeHtml(v.name)}"${v.name === saved ? " selected" : ""}>${escapeHtml(v.name)}</option>`).join("");
  }
  if ("speechSynthesis" in window) { fillVoices(); speechSynthesis.addEventListener?.("voiceschanged", fillVoices); }
  $("voice-select")?.addEventListener("change", (e) => { storage.set("friday_voice", e.target.value); pickVoice(); });
  $("voice-rate")?.addEventListener("input", (e) => storage.set("friday_rate", e.target.value));
  $("voice-pitch")?.addEventListener("input", (e) => storage.set("friday_pitch", e.target.value));
  { const r = storage.get("friday_rate"); if (r && $("voice-rate")) $("voice-rate").value = r; const p = storage.get("friday_pitch"); if (p && $("voice-pitch")) $("voice-pitch").value = p; }
  $("voice-test")?.addEventListener("click", () => say("Hallo Boss, so klinge ich jetzt."));
  $("brain-btn")?.addEventListener("click", () => { openSheet("brain"); loadBrain(); });
  $("brain-x")?.addEventListener("click", () => closeSheet("brain"));
  $("apps-btn")?.addEventListener("click", () => { openSheet("apps"); buildApps(); });
  $("apps-x")?.addEventListener("click", () => closeSheet("apps"));
  $("organizer-btn")?.addEventListener("click", () => { openSheet("organizer"); loadOrganizer(); });
  $("organizer-x")?.addEventListener("click", () => closeSheet("organizer"));

  // ---------- Organizer: Aufgaben + Einkaufsliste ----------
  async function loadOrganizer() { renderOrg("task", "/api/tasks"); renderOrg("shop", "/api/shopping"); }
  async function renderOrg(kind, url) {
    const list = $(kind + "-list");
    if (!list) return;
    try {
      const items = await (await api(url)).json();
      list.innerHTML = items.length ? items.map((i) =>
        `<li class="org-item${i.done ? " done" : ""}" data-id="${i.id}"><button class="org-check" aria-label="Erledigt">${i.done ? "☑" : "☐"}</button><span>${escapeHtml(i.text)}</span><button class="org-del" aria-label="Löschen">✕</button></li>`).join("")
        : '<li class="muted">Nichts hier.</li>';
    } catch { list.innerHTML = '<li class="muted">Nicht erreichbar.</li>'; }
  }
  function orgHandlers(kind, base) {
    $(kind + "-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inp = $(kind + "-input"); const text = inp.value.trim(); if (!text) return;
      inp.value = "";
      await api(base, { method: "POST", body: JSON.stringify({ text }) });
      renderOrg(kind, base);
    });
    $(kind + "-list")?.addEventListener("click", async (e) => {
      const li = e.target.closest(".org-item"); if (!li) return;
      const id = li.dataset.id;
      if (e.target.closest(".org-check")) { await api(`${base}/${id}`, { method: "PATCH" }); renderOrg(kind, base); }
      else if (e.target.closest(".org-del")) { await api(`${base}/${id}`, { method: "DELETE" }); renderOrg(kind, base); }
    });
  }
  orgHandlers("task", "/api/tasks");
  orgHandlers("shop", "/api/shopping");

  // ---------- Navigation (Seitenleiste + Schnellzugriff) ----------
  function navTo(where, el) {
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.nav === where));
    switch (where) {
      case "home": break;
      case "chat": $("text")?.focus(); break;
      case "kalender": openSheet("kalender"); loadKalender(); break;
      case "aufgaben": openSheet("organizer"); loadOrganizer(); break;
      case "dateien": openSheet("dateien"); break;
      case "wissen": openSheet("brain"); loadBrain(); break;
      case "system": openSheet("brain"); loadBrain(); break;
      case "einstellungen": openSheet("settings"); break;
      case "websuche": { const t = $("text"); if (t) { t.value = ""; t.placeholder = "Was soll Friday im Web suchen?"; t.focus(); } break; }
    }
  }
  document.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => navTo(b.dataset.nav, b)));

  // ---------- Begrüßung nach Tageszeit ----------
  function setGreeting() {
    const g = $("greeting"); if (!g) return;
    const h = new Date().getHours();
    const teil = h < 5 ? "Gute Nacht" : h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
    g.textContent = `${teil}, ${status.name || "Boss"}.`;
  }
  setGreeting(); setInterval(setGreeting, 10 * 60000);

  // ---------- "Heute" + Schnellzugriff-Zähler ----------
  async function loadToday() {
    try {
      const [rem, tasks] = await Promise.all([
        (await api("/api/reminders")).json(),
        (await api("/api/tasks")).json(),
      ]);
      const today = new Date().toDateString();
      const items = rem.filter((r) => new Date(r.due).toDateString() === today)
        .sort((a, b) => a.due.localeCompare(b.due))
        .map((r) => ({ t: r.text, z: new Date(r.due).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) }));
      const tl = $("today-list");
      if (tl) tl.innerHTML = items.length
        ? items.map((i) => `<li class="todayrow"><span>${escapeHtml(i.t)}</span><small>${i.z}</small></li>`).join("")
        : '<li class="muted">Nichts geplant</li>';
      const open = tasks.filter((t) => !t.done).length;
      if ($("q-auf")) $("q-auf").textContent = `${open} offen`;
      const next = rem.filter((r) => new Date(r.due) >= new Date()).sort((a, b) => a.due.localeCompare(b.due))[0];
      if ($("q-kal")) $("q-kal").textContent = next ? new Date(next.due).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "Kein Termin";
    } catch { /* still */ }
  }
  setInterval(() => token && loadToday(), 60000);

  // ---------- Kalender-Sheet ----------
  $("kalender-x")?.addEventListener("click", () => closeSheet("kalender"));
  async function loadKalender() {
    const list = $("kal-list"); if (!list) return;
    try {
      const rem = await (await api("/api/reminders")).json();
      list.innerHTML = rem.length ? rem.sort((a, b) => a.due.localeCompare(b.due)).map((r) =>
        `<li class="org-item" data-id="${r.id}"><span>${escapeHtml(r.text)}</span><small class="muted" style="margin:0 8px">${new Date(r.due).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</small><button class="org-del">✕</button></li>`).join("")
        : '<li class="muted">Keine Termine.</li>';
    } catch { list.innerHTML = '<li class="muted">Nicht erreichbar.</li>'; }
  }
  $("kal-form")?.addEventListener("submit", async (e) => {
    e.preventDefault(); const inp = $("kal-input"); const text = inp.value.trim(); if (!text) return;
    inp.value = ""; await api("/api/reminders", { method: "POST", body: JSON.stringify({ text }) }); loadKalender(); loadToday();
  });
  $("kal-list")?.addEventListener("click", async (e) => {
    const li = e.target.closest(".org-item"); if (!li || !e.target.closest(".org-del")) return;
    await api(`/api/reminders/${li.dataset.id}`, { method: "DELETE" }); loadKalender(); loadToday();
  });

  // ---------- Dateien-Sheet ----------
  $("dateien-x")?.addEventListener("click", () => closeSheet("dateien"));
  $("file-form")?.addEventListener("submit", async (e) => {
    e.preventDefault(); const q = $("file-input").value.trim(); const list = $("file-list"); if (!q || !list) return;
    list.innerHTML = '<li class="muted">Suche...</li>';
    try {
      const r = await (await api(`/api/find?q=${encodeURIComponent(q)}`)).json();
      if (!r.online) { list.innerHTML = '<li class="muted">Mac nicht verbunden.</li>'; return; }
      list.innerHTML = r.dateien.length ? r.dateien.map((f) => `<li class="filerow">${escapeHtml(f.split("/").pop())}<small class="muted">${escapeHtml(f)}</small></li>`).join("") : '<li class="muted">Nichts gefunden.</li>';
    } catch { list.innerHTML = '<li class="muted">Fehler.</li>'; }
  });

  const APPS = [
    { n: "YouTube", d: "youtube.com", u: "https://www.youtube.com" },
    { n: "Netflix", d: "netflix.com", u: "https://www.netflix.com" },
    { n: "Amazon", d: "amazon.de", u: "https://www.amazon.de" },
    { n: "Prime Video", d: "primevideo.com", u: "https://www.primevideo.com" },
    { n: "Disney+", d: "disneyplus.com", u: "https://www.disneyplus.com" },
    { n: "Spotify", d: "spotify.com", u: "https://open.spotify.com" },
    { n: "Apple Music", d: "music.apple.com", u: "https://music.apple.com" },
    { n: "YouTube Music", d: "music.youtube.com", u: "https://music.youtube.com" },
    { n: "Twitch", d: "twitch.tv", u: "https://www.twitch.tv" },
    { n: "TikTok", d: "tiktok.com", u: "https://www.tiktok.com" },
    { n: "Instagram", d: "instagram.com", u: "https://www.instagram.com" },
    { n: "WhatsApp", d: "whatsapp.com", u: "https://web.whatsapp.com" },
    { n: "Telegram", d: "telegram.org", u: "https://web.telegram.org" },
    { n: "Gmail", d: "gmail.com", u: "https://mail.google.com" },
    { n: "Google", d: "google.com", u: "https://www.google.com" },
    { n: "Maps", d: "google.com/maps", u: "https://maps.google.com" },
    { n: "X", d: "x.com", u: "https://x.com" },
    { n: "Facebook", d: "facebook.com", u: "https://www.facebook.com" },
    { n: "Reddit", d: "reddit.com", u: "https://www.reddit.com" },
    { n: "ChatGPT", d: "chatgpt.com", u: "https://chatgpt.com" },
    { n: "eBay", d: "ebay.de", u: "https://www.ebay.de" },
    { n: "PayPal", d: "paypal.com", u: "https://www.paypal.com" },
    { n: "DAZN", d: "dazn.com", u: "https://www.dazn.com" },
    { n: "Wetter", d: "wetter.com", u: "https://www.wetter.com" },
  ];
  let appsBuilt = false;
  function buildApps() {
    const grid = $("apps-grid");
    if (!grid || appsBuilt) return;
    grid.innerHTML = APPS.map((a) =>
      `<a class="app-tile" href="${a.u}" target="_blank" rel="noopener noreferrer">
        <img loading="lazy" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(a.d)}&sz=64" alt="" width="40" height="40">
        <span>${escapeHtml(a.n)}</span></a>`).join("");
    appsBuilt = true;
  }
  $("briefing-btn2")?.addEventListener("click", () => { closeSheet("settings"); send("Gib mir mein Briefing."); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeSheet("settings"); closeSheet("brain"); } });
  document.querySelectorAll(".sheet").forEach((sh) => sh.addEventListener("click", (e) => { if (e.target === sh) sh.classList.add("hidden"); }));

  async function loadBrain() {
    const box = $("brain-memory");
    if (box) {
      try {
        const mem = await (await api("/api/memory")).json();
        const addRow = `<div class="mem-add"><input id="mem-add-input" type="text" placeholder="Etwas dauerhaft merken..." maxlength="300"><button id="mem-add-btn" class="chip">Merken</button></div>`;
        const head = `<div class="muted" style="margin-bottom:6px">${mem.length} ${mem.length === 1 ? "Eintrag" : "Einträge"} · bleiben dauerhaft gespeichert</div>`;
        const list = mem.length
          ? mem.slice().reverse().map((m) => {
              const d = m.created ? new Date(m.created).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";
              return `<div class="brain-mem-item"><span>${escapeHtml(m.text)}${d ? ` <small class="muted">· ${d}</small>` : ""}</span><button class="mem-del" data-id="${escapeHtml(m.id)}" title="Löschen">✕</button></div>`;
            }).join("")
          : '<span class="muted">Noch nichts gemerkt. Trag hier etwas ein oder sag "Merk dir ...".</span>';
        box.innerHTML = addRow + head + list;
      } catch { box.textContent = "Gedächtnis nicht erreichbar."; }
    }
    if ($("st-screen")) setBadge("st-screen", status.agent?.online, "verfügbar", "Mac aus");
  }
  async function addMemoryFromUI() {
    const inp = $("mem-add-input");
    const text = inp?.value.trim();
    if (!text) return;
    try { await api("/api/memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }); } catch {}
    if (inp) inp.value = "";
    loadBrain();
  }
  $("brain-memory")?.addEventListener("click", async (e) => {
    const del = e.target.closest(".mem-del");
    if (del) { try { await api("/api/memory/" + encodeURIComponent(del.dataset.id), { method: "DELETE" }); } catch {} loadBrain(); return; }
    if (e.target.id === "mem-add-btn") addMemoryFromUI();
  });
  $("brain-memory")?.addEventListener("keydown", (e) => { if (e.target.id === "mem-add-input" && e.key === "Enter") addMemoryFromUI(); });

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
  $("camera-btn")?.addEventListener("click", () => $("photo")?.click());
  $("photo")?.addEventListener("change", async (e) => {
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
    if ($("photo")) $("photo").value = "";
    $("photo-preview")?.classList.add("hidden");
    if ($("text")) $("text").placeholder = "Schreib Friday etwas...";
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


  // ---------- Live-Kamera (deine eigene, mit Erlaubnis) ----------
  let camStream = null;
  let camFacing = "environment";

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      addMessage("friday", "Dieser Browser gibt mir keinen Kamerazugriff, Boss.");
      return;
    }
    $("camera").classList.remove("hidden");
    try {
      stopCamera();
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camFacing }, audio: false });
      $("camera-video").srcObject = camStream;
      $("camera-hint").textContent = 'Richte die Kamera auf etwas und tippe auf "Friday, was siehst du?".';
    } catch (err) {
      $("camera-hint").innerHTML = `<span class="error">Kein Zugriff auf die Kamera (${escapeHtml(err.name || "Fehler")}). Erlaube den Zugriff in den Browser-Einstellungen.</span>`;
    }
  }

  function stopCamera() {
    if (camStream) { camStream.getTracks().forEach((t) => t.stop()); camStream = null; }
    $("camera-video").srcObject = null;
  }

  function closeCamera() { stopCamera(); $("camera").classList.add("hidden"); }

  function grabFrame() {
    const v = $("camera-video");
    if (!v.videoWidth) return null;
    const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d").drawImage(v, 0, 0, canvas.width, canvas.height);
    return { mediaType: "image/jpeg", data: canvas.toDataURL("image/jpeg", 0.85).split(",")[1] };
  }

  $("camera-live-btn").addEventListener("click", startCamera);
  $("camera-x").addEventListener("click", closeCamera);
  $("camera-switch").addEventListener("click", () => { camFacing = camFacing === "environment" ? "user" : "environment"; startCamera(); });
  $("camera-shot").addEventListener("click", () => {
    const frame = grabFrame();
    if (!frame) { $("camera-hint").textContent = "Die Kamera ist noch nicht bereit, einen Moment."; return; }
    pendingImage = frame;
    closeCamera();
    send("Was siehst du durch die Kamera?");
  });

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
