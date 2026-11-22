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
    const t0 = Date.now();
    const kurz = String(path).split("?")[0];
    let res;
    try {
      res = await fetch(path, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
      });
    } catch (err) {
      if (err?.name !== "AbortError" && kurz !== "/api/tts") window.FridayDiag?.schritt(`Mac nicht erreichbar bei ${kurz} (${err?.message || err})`, "bad");
      throw err;
    }
    const ms = Date.now() - t0;
    if (!res.ok && res.status !== 401 && kurz !== "/api/tts") window.FridayDiag?.schritt(`Mac meldet Fehler ${res.status} bei ${kurz}`, "bad");
    else if (ms > 8000 && kurz !== "/api/chat") window.FridayDiag?.schritt(`${kurz} hat ${Math.round(ms / 1000)} s gebraucht`, "warn");
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

  function tagesGruss(h = new Date().getHours()) {
    return h >= 4 && h < 11 ? "Guten Morgen" : h >= 11 && h < 18 ? "Guten Tag" : "Guten Abend";
  }
  window.Friday = Object.assign(window.Friday || {}, { tagesGruss });

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
      say(`${tagesGruss()}, ${data.name || "Boss"}. Willkommen zurück.`);
    } catch (err) {
      $("login-error").textContent = err.message;
    }
  });

  $("logout").addEventListener("click", showLogin);

  // ---------- v1.122.6: Diagnose-Zeile ----------
  // Zeigt unten links kurz an, was gerade passiert: gehört → gesendet → Antwort → gesprochen.
  // So sieht man auf dem iPhone, an welcher Stelle es hängt. Antippen = ganze Liste. Aus: Einstellungen
  // → Assistent → "Diagnose anzeigen" (friday_diagnose = "0").
  const diag = (() => {
    const liste = [];
    let el = null, versteck = null;
    const an = () => storage.get("friday_diagnose") !== "0";
    // v1.129.0: Die Diagnose sitzt jetzt fest in der linken Seitenleiste (unter "Meine Dienste", über dem Profil).
    // Gibt es den Platz nicht (z. B. core.html), schwebt sie wie früher unten links.
    let imPanel = false;
    function box() {
      if (el) return el;
      el = document.getElementById("diag");
      imPanel = !!el;
      if (!el) {
        el = document.createElement("div");
        el.id = "diag"; el.className = "diag";
        document.body.append(el);
      }
      el.setAttribute("aria-live", "polite");
      el.title = "Diagnose: antippen für alle Schritte";
      el.addEventListener("click", () => { el.classList.toggle("gross"); zeichne(); zeigen(); });
      return el;
    }
    function panelSichtbar() { document.body.classList.toggle("diag-aus", !an()); }
    panelSichtbar();
    window.addEventListener("storage", panelSichtbar);
    window.addEventListener("friday-settings", panelSichtbar);
    function zeichne() {
      if (!el) return;
      const n = el.classList.contains("gross") ? 40 : (imPanel ? 14 : 4);
      el.innerHTML = liste.slice(-n).map((x) => `<div class="d-${x.stufe}"><b>${x.zeit}</b> ${escapeHtml(x.text)}</div>`).join("");
      if (imPanel) el.scrollTop = el.scrollHeight;
    }
    function zeigen() {
      clearTimeout(versteck);
      el.classList.add("sichtbar");
      if (imPanel) return; // in der Seitenleiste bleibt sie stehen
      versteck = setTimeout(() => { if (!el.classList.contains("gross")) el.classList.remove("sichtbar"); }, 25000);
    }
    function schritt(text, stufe = "info") {
      text = String(text || "").slice(0, 160);
      if (liste.length && liste.at(-1).text === text) return;
      const d = new Date();
      const zeit = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
      liste.push({ zeit, text, stufe });
      if (liste.length > 60) liste.shift();
      try { console.log("[Friday]", zeit, text); } catch { /* egal */ }
      panelSichtbar();
      if (!an()) return;
      box(); zeichne(); zeigen();
    }
    return { schritt, liste: () => liste.slice() };
  })();
  window.FridayDiag = diag;
  // Diagnose für alles (v1.122.7): Programmfehler, Fenster auf/zu, Lagezentrum, Netz, Mac-Verbindung.
  window.addEventListener("error", (e) => {
    if (!e?.message || /ResizeObserver/.test(e.message)) return;
    diag.schritt(`Programmfehler: ${e.message}${e.filename ? " (" + String(e.filename).split("/").pop() + ":" + e.lineno + ")" : ""}`, "bad");
  });
  window.addEventListener("unhandledrejection", (e) => {
    const m = e?.reason?.message || String(e?.reason || "");
    if (!m || /AbortError|aborted|play\(\)|NotAllowedError/i.test(m)) return;
    diag.schritt(`Fehler im Hintergrund: ${m.slice(0, 100)}`, "bad");
  });
  window.addEventListener("friday-lage", (e) => diag.schritt(e.detail?.offen ? "Lagezentrum geöffnet" : "Lagezentrum geschlossen"));
  window.addEventListener("online", () => diag.schritt("Internet wieder da", "ok"));
  window.addEventListener("offline", () => diag.schritt("Kein Internet auf diesem Gerät", "bad"));
  // Fenster: jedes große Fenster meldet, wenn es auf- oder zugeht.
  try {
    const namen = new Map();
    const fensterName = (el) => el.getAttribute("aria-label") || el.querySelector("h2")?.textContent?.trim() || el.id;
    new MutationObserver((liste) => {
      for (const m of liste) {
        const el = m.target;
        if (!el.id || !(el.classList.contains("sheet") || el.id === "werkstatt" || el.id === "vision" || el.id === "camera")) continue;
        const war = String(m.oldValue || "").split(/\s+/).includes("hidden");
        const ist = el.classList.contains("hidden");
        if (war === ist) continue;
        if (!namen.has(el.id)) namen.set(el.id, String(fensterName(el)).slice(0, 40));
        diag.schritt(`Fenster ${ist ? "zu" : "offen"}: ${namen.get(el.id)}`);
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  } catch { /* egal */ }

  // ---------- Anzeige ----------
  let coreMode = null;
  // v1.98.0: Ruhe-Zustand ("Bereit, Boss.") wird auf der Startseite nicht mehr angezeigt.
  const RUHE = /^(Bereit, Boss\.|Höre auf "Friday")$/;
  function setState(text, mode = "") {
    $("state").textContent = text;
    $("state").classList.toggle("ruhe", RUHE.test(text));
    $("reactor").className = `reactor ${mode}`;
    // Zustand an Fridays Kern (Orb auf dem Zweitgerät) melden.
    if (token && mode !== coreMode) {
      coreMode = mode;
      fetch("/api/core-state", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ mode }) }).catch(() => {});
    }
  }

  function addMessage(who, text) {
    const div = document.createElement("div");
    div.className = `msg ${who}`;
    const label = document.createElement("small");
    label.textContent = who === "user" ? (status.name || "DU").toUpperCase() : "F.R.AI.D.A.Y";
    div.append(label, document.createTextNode(text));
    $("transcript").append(div);
    kuerzeVerlauf();
  }
  // Chat-Verlauf klein halten: nur die letzten Nachrichten, der Rest steht in der Datenbank (Wissen).
  const VERLAUF_MAX = 4;
  function kuerzeVerlauf() {
    const t = $("transcript");
    if (!t) return;
    const alle = t.querySelectorAll(".msg:not(.speaking-msg)");
    for (let i = 0; i < alle.length - VERLAUF_MAX; i++) alle[i].remove();
    $("verlauf-link")?.classList.toggle("hidden", alle.length < 2);
    t.scrollTop = t.scrollHeight;
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
    kuerzeVerlauf();
  }

  function clearSpeaking() {
    document.getElementById("speaking-msg")?.remove();
  }

  function tick() {
    const now = new Date();
    // Einstellungen → Uhr & Startseite: 12/24 Stunden, Sekunden, Datum lang/kurz/aus
    const h12 = storage.get("friday_uhr12") === "1";
    const sek = storage.get("friday_uhrsek") !== "0";
    const datum = storage.get("friday_datum") || "lang";
    $("clock").textContent = now.toLocaleTimeString(h12 ? "en-US" : "de-DE", { hour: "2-digit", minute: "2-digit", ...(sek ? { second: "2-digit" } : {}), hour12: h12 });
    const d = $("date");
    d.textContent = datum === "aus" ? "" : now.toLocaleDateString("de-DE", datum === "kurz" ? { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" } : { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    d.hidden = datum === "aus";
  }
  window.addEventListener("friday-settings", () => tick());
  setInterval(tick, 1000);
  tick();

  function setBadge(id, on, onText = "aktiv", offText = "aus") {
    const el = $(id);
    el.textContent = on ? onText : offText;
    el.className = on ? "ok" : "off";
  }

  // Friday aktualisiert sich selbst: Wechselt die Version auf dem Server, lädt das Dashboard neu,
  // sobald gerade nichts läuft (kein Gespräch, kein offenes Werkzeug).
  let bootVersion = null, reloadPending = false;
  function reloadWhenIdle(v) {
    if (reloadPending) return;
    reloadPending = true;
    setState(`Update auf ${v} – lade neu …`);
    const tryReload = () => {
      const openTool = document.querySelector("#call:not(.hidden), #werkstatt:not(.hidden), #schnitt:not(.hidden), #vision:not(.hidden), #webseiten:not(.hidden), #markt:not(.hidden), #spiele:not(.hidden)");
      if (busy || speaking || openTool) { setTimeout(tryReload, 15000); return; }
      location.reload();
    };
    setTimeout(tryReload, 3000);
  }

  async function refreshStatus() {
    try {
      status = await (await api("/api/status")).json();
      if (status.version) {
        if (!bootVersion) bootVersion = status.version;
        else if (status.version !== bootVersion) reloadWhenIdle(status.version);
      }
      setBadge("st-server", true, "online");
      setBadge("st-mac", status.agent?.online, status.agent?.name || "verbunden", "getrennt");
      setBadge("st-voice", true, germanVoice ? `Apple: ${stimmName(germanVoice)}` : "Apple: Systemstimme", "Apple-Stimme");
      setBadge("st-push", status.push);
      setBadge("st-telegram", status.telegram);
      setBadge("st-home", status.smartHome);
      $("st-version").textContent = status.version || "-";
      updateHudBar(true);
      window.dispatchEvent(new CustomEvent("friday-status", { detail: status }));
    } catch {
      updateHudBar(false);
      window.dispatchEvent(new Event("friday-status-fehler"));
      $("st-server").textContent = "offline";
      $("st-server").className = "bad";
    }
  }

  // Obere HUD-Leiste: Kern, Mac, Sicherung, Version auf einen Blick.
  function updateHudBar(online) {
    const chip = (id, state, text) => {
      const el = $(id); if (!el) return;
      el.querySelector(".hb-dot").className = `hb-dot ${state}`;
      el.querySelector("b").textContent = text;
    };
    chip("hb-core", online ? "ok" : "bad", online ? "online" : "offline");
    chip("hb-mac", status.agent?.online ? "ok" : "warn", status.agent?.online ? "verbunden" : "getrennt");
    const last = status.sicherung?.letzte ? new Date(status.sicherung.letzte) : null;
    const age = last ? Date.now() - last.getTime() : Infinity;
    chip("hb-backup", age < 36 * 3600000 ? "ok" : age < 7 * 86400000 ? "warn" : "bad", last ? relTime(last) : "keine");
    if ($("hb-version")) $("hb-version").textContent = status.version || "-";
  }

  function relTime(d) {
    const min = Math.round((Date.now() - d.getTime()) / 60000);
    if (min < 1) return "gerade eben";
    if (min < 60) return `vor ${min} Min.`;
    const h = Math.round(min / 60);
    if (h < 24) return `vor ${h} Std.`;
    const t = Math.round(h / 24);
    return t === 1 ? "gestern" : `vor ${t} Tagen`;
  }

  // Wetter-Symbole (eigene Linien-Icons im Neon-Stil)
  function weatherIcon(text = "") {
    const t = text.toLowerCase();
    const sun = '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>';
    const cloud = '<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18z"/>';
    let body = cloud, cls = "wi-cloud";
    if (/gewitter/.test(t)) { body = cloud + '<path d="M12.5 13.5l-2 3.2h3l-2 3.3"/>'; cls = "wi-storm"; }
    else if (/schnee/.test(t)) { body = cloud + '<path d="M9 20.5h.01M12 21.5h.01M15 20.5h.01"/>'; cls = "wi-snow"; }
    else if (/regen|niesel|schauer/.test(t)) { body = '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 6.2 4.4 4.4 0 0 0 7 15z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>'; cls = "wi-rain"; }
    else if (/nebel/.test(t)) { body = '<path d="M4 9h16M6 13h12M4 17h16"/>'; cls = "wi-fog"; }
    else if (/klar|sonnig|heiter/.test(t)) { body = sun; cls = "wi-sun"; }
    else if (/bewölkt|wolkig/.test(t)) { body = '<path d="M8.5 6.5a3.5 3.5 0 0 1 6.4 1"/><path d="M7 19h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 10.2 4.4 4.4 0 0 0 7 19z"/>'; cls = "wi-cloud"; }
    return `<svg class="wi ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }
  let weatherRetry = null;
  async function refreshWeather() {
    clearTimeout(weatherRetry);
    try {
      const w = await (await api("/api/weather")).json();
      if (w.error) throw new Error(w.error);
      const days = w.tage.slice(1).map((d) => {
        const name = new Date(d.tag).toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "");
        return `<div class="wd" title="${escapeHtml(d.wetter)}"><span>${escapeHtml(name)}</span>${weatherIcon(d.wetter)}<b>${Math.round(d.max)}°</b><small>${Math.round(d.min)}°</small></div>`;
      }).join("");
      $("weather").classList.remove("muted");
      $("weather").innerHTML = `<div class="weather-top">${weatherIcon(w.jetzt.wetter)}<div class="weather-now">${Math.round(w.jetzt.temperatur)}°</div></div>
        <div class="weather-place">${escapeHtml(w.ort)} · ${escapeHtml(w.jetzt.wetter)}</div><div class="weather-days">${days}</div>`;
    } catch {
      $("weather").classList.add("muted");
      $("weather").innerHTML = `<div class="weather-off">${weatherIcon("bewölkt")}<span>Wetter offline</span><small>neuer Versuch gleich</small></div>`;
      weatherRetry = setTimeout(() => token && refreshWeather(), 60000);
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
      if (!s.online) { box.innerHTML = '<div class="sys-off"><i class="hb-dot warn"></i><span>Mac nicht verbunden</span></div>'; if (proc) proc.innerHTML = '<li class="muted">–</li>'; return; }
      // Runde Anzeige je Wert; ab 85 % rot.
      const stat = (label, p, val) => {
        const v = Math.max(0, Math.min(100, Number(p) || 0));
        return `<div class="gauge${v > 85 ? " hot" : ""}" style="--p:${v}"><svg viewBox="0 0 40 40"><circle class="g-bg" cx="20" cy="20" r="16"/><circle class="g-val" cx="20" cy="20" r="16" pathLength="100"/></svg><b>${val}</b><span>${label}</span></div>`;
      };
      const rows = [];
      if (s.cpu_prozent != null) rows.push(stat("CPU", s.cpu_prozent, s.cpu_prozent + "%"));
      if (s.ram_prozent != null) rows.push(stat("RAM", s.ram_prozent, s.ram_prozent + "%"));
      if (s.disk_prozent != null) rows.push(stat("Speicher", s.disk_prozent, s.disk_prozent + "%"));
      const extra = [];
      if (s.akku != null) extra.push(`Akku ${s.akku}%${s.akku_laedt ? " ⚡" : ""}`);
      extra.push(`Wärme ${s.temp || "-"}`);
      if (s.netzwerk) extra.push(escapeHtml(s.netzwerk));
      box.innerHTML = `<div class="gauges">${rows.join("")}</div><div class="sys-extra muted">${extra.join(" · ")}</div>`;
      if (proc) proc.innerHTML = (s.prozesse || []).length
        ? s.prozesse.map((a) => `<li class="procrow"><span>${escapeHtml(a.name)}</span><b>${a.cpu}%</b></li>`).join("")
        : '<li class="muted">–</li>';
    } catch { box.innerHTML = '<span class="muted">nicht verfügbar</span>'; }
  }
  // Abfragen ruhen, solange die App im Hintergrund ist (spart Akku und Netz auf dem iPhone)
  const aktiv = () => token && !document.hidden;
  setInterval(() => { if (aktiv()) refreshSystem(); }, 8000);

  setInterval(() => aktiv() && refreshStatus(), 20000);
  setInterval(() => aktiv() && refreshReminders(), 60000);
  document.addEventListener("visibilitychange", () => { if (aktiv()) { refreshSystem(); refreshStatus(); } });
  setInterval(() => token && refreshWeather(), 15 * 60000);
  window.addEventListener("friday-wetter-neu", () => token && refreshWeather());

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
  // Alle Apple-/Systemstimmen des Geräts: Qualität erkennen (Premium > Erweitert > Standard), Spaß-/Retro-Stimmen markieren.
  const SPASS_STIMMEN = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|fred|kathy)\b/i;
  const RETRO_STIMMEN = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
  function stimmArt(v) {
    const s = `${v.voiceURI || ""} ${v.name || ""}`.toLowerCase();
    if (/premium/.test(s)) return { rang: 3, text: "Premium" };
    if (/enhanced|erweitert|verbessert/.test(s)) return { rang: 2, text: "Erweitert" };
    if (/siri/.test(s)) return { rang: 2, text: "Siri" };
    if (SPASS_STIMMEN.test(v.name)) return { rang: -1, text: "Spaß" };
    if (/eloquence/.test(s) || RETRO_STIMMEN.test(v.name)) return { rang: 0, text: "Retro" };
    if (v.localService === false) return { rang: 1, text: "Online" };
    return { rang: 1, text: "Standard" };
  }
  const stimmKey = (v) => v.voiceURI || v.name;
  const stimmName = (v) => String(v.name || "").replace(/\s*\((premium|enhanced|erweitert|verbessert)\)\s*/i, "").trim();
  window.Friday = window.Friday || {};
  window.Friday.stimmArt = stimmArt;
  let germanVoice = null;
  function besteDeutsche(all) {
    const de = all.filter((v) => /^de/i.test(v.lang));
    const wert = (v) => stimmArt(v).rang * 10 + (/anna|helena|petra|marlene|katja|vicki/i.test(v.name) ? 1 : 0);
    return de.sort((a, b) => wert(b) - wert(a))[0] || null;
  }
  // v1.123.1: Das iPhone zeigt Webseiten oft nur einen Teil der geladenen Stimmen (Schutz vor
  // Fingerprinting in Safari). "Systemstimme" gibt keine Stimme vor, nur Deutsch: dann spricht Friday mit
  // der Stimme, die in den iPhone-Einstellungen für Deutsch ausgewählt ist (auch Premium-Stimmen).
  const SYSTEMSTIMME = "__system__";
  const AUF_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let systemStimme = false;
  function pickVoice() {
    const all = speechSynthesis.getVoices();
    const saved = storage.get("friday_voice") || (AUF_IOS ? SYSTEMSTIMME : "");
    systemStimme = saved === SYSTEMSTIMME;
    if (systemStimme) { germanVoice = null; return; }
    germanVoice = (saved && (all.find((v) => v.voiceURI === saved) || all.find((v) => v.name === saved)))
      || besteDeutsche(all) || all[0] || null;
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  const audio = new Audio();

  // Philips Hue: Lampen leuchten Neon-Orange, solange Friday spricht (wenn in Verbindungen eingeschaltet).
  const hueSprechen = (an) => { if (status.hueSprechen) api("/api/dienste/hue/sprechen", { method: "POST", body: JSON.stringify({ an }) }).catch(() => {}); };

  // Lange Texte in Häppchen teilen: Der erste Satz wird sofort gesprochen, der Rest lädt währenddessen.
  // So fängt Friday schneller an zu reden, statt auf die Stimme für den ganzen Text zu warten.
  function haeppchen(text) {
    const saetze = String(text).match(/[^.!?…]+[.!?…]+["“”»)]*\s*|[^.!?…]+$/g) || [text];
    const out = [];
    let cur = "";
    for (const satz of saetze) {
      const grenze = out.length === 0 ? 60 : 320; // erstes Häppchen kurz, danach größere
      if (cur && (cur + satz).length > grenze) { out.push(cur.trim()); cur = ""; }
      cur += satz;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.length ? out : [text];
  }
  let sprechNr = 0; // jede neue Ansage / jedes Stoppen bricht die alte ab
  // v1.123.0: ElevenLabs ist entfernt. Friday spricht nur noch mit der Apple-Stimme des Geräts.
  window.Friday = window.Friday || {};
  window.Friday.stimmHinweis = () => false;

  // v1.121.1: Friday redet nicht von allein. Meldungen, die keiner bestellt hat (Timer, Erinnerung,
  // Energie, "Video fertig"), erscheinen still am Status-Ring statt vorgelesen zu werden.
  // Einschalten: Einstellungen → Assistent → "Friday darf von sich aus sprechen".
  const vonSelbstAn = () => storage.get("friday_vonselbst") === "1";
  window.Friday.sagVonSelbst = (text, { quelle = "hinweis", stufe = "warn", dauer = 10 * 60000 } = {}) => {
    if (!text) return;
    if (vonSelbstAn()) return say(text);
    try { window.FridayRing?.melde?.(quelle, stufe, text, dauer); } catch { /* egal */ }
  };

  async function say(text, { hinweis = true } = {}) {
    if (!$("voice-toggle").checked || !text) return;
    const nr = ++sprechNr;
    speaking = true;
    hueSprechen(true);
    gesagtText = String(text);
    setState("Spricht", "speaking");
    diag.schritt(`Spricht: „${String(text).slice(0, 50)}${String(text).length > 50 ? " …" : ""}“`);
    const mikroWarAn = ohrVorStimme(nr);
    try {
      // iPhone: Das Mikrofon braucht einen Moment, bis es wirklich aus ist. Sonst bleibt die Stimme stumm.
      if (mikroWarAn) await new Promise((r) => setTimeout(r, 600));
      if (nr !== sprechNr) return;
      if ("speechSynthesis" in window) {
        // v1.121.3: Auf dem iPhone bricht iOS die Stimme ab, wenn ein Geräusch (S-Bahn) das Mikrofon
        // anspringen lässt. Hört Friday auf, ohne dass jemand "Friday"/Stopp gesagt hat, spricht sie
        // ab der Stelle weiter, an der sie unterbrochen wurde (höchstens 4-mal).
        let rest = text, neuStarts = 0;
        while (rest && nr === sprechNr) {
          const teil = rest;
          let bisZeichen = 0, fehler = "", zeitUm = false;
          const t0 = Date.now();
          await new Promise((resolve) => {
            const u = new SpeechSynthesisUtterance(teil);
            u.lang = germanVoice?.lang || "de-DE";
            if (germanVoice) u.voice = germanVoice;
            u.rate = Number(storage.get("friday_rate")) || 1.05;
            u.pitch = Number(storage.get("friday_pitch")) || 1;
            u.volume = Math.min(1, Math.max(0.05, Number(storage.get("friday_lautstaerke")) || 1));
            u.onstart = () => window.FridayFace?.talk(true);
            // Mund im Takt der gesprochenen Wörter bewegen
            u.onboundary = (e) => {
              if (e.charIndex > bisZeichen) bisZeichen = e.charIndex;
              if (!e.name || e.name === "word") window.FridayFace?.boundary?.(e.charIndex, teil);
            };
            // v1.121.4: Safari auf dem iPhone meldet das Ende manchmal nie. Wächter: nach geschätzter
            // Sprechdauer + 4 s weiter, oder wenn die Stimme 3 s lang sichtbar nicht mehr spricht.
            let fertig = false;
            const ende = () => { if (fertig) return; fertig = true; clearTimeout(waechter); clearInterval(pruef); resolve(); };
            const waechter = setTimeout(() => { zeitUm = true; diag.schritt("Stimme hing, übersprungen", "warn"); ende(); }, Math.min(90000, 4000 + teil.split(/\s+/).length * 550));
            let still = 0;
            const pruef = setInterval(() => {
              try { still = (speechSynthesis.speaking || speechSynthesis.pending) ? 0 : still + 1; } catch { still++; }
              if (still >= 3) ende();
            }, 1000);
            u.onend = ende;
            u.onerror = (e) => { fehler = e?.error || "fehler"; if (fehler !== "interrupted" && fehler !== "canceled") diag.schritt(`Stimme: Fehler „${fehler}“${fehler === "not-allowed" ? " – einmal tippen" : ""}`, "bad"); ende(); };
            speechSynthesis.speak(u);
          });
          if (nr !== sprechNr) break; // absichtlich gestoppt ("Friday", Stopp, Tippen)
          if (zeitUm) { try { speechSynthesis.cancel(); } catch { /* egal */ } break; } // hing: nicht noch mal von vorn
          const erwartetMs = (teil.length / 14) * 1000 / (Number(storage.get("friday_rate")) || 1.05);
          const zuFrueh = fehler === "interrupted" || fehler === "canceled"
            || (bisZeichen > 0 && bisZeichen < teil.length - 25)
            || (bisZeichen === 0 && teil.length > 60 && Date.now() - t0 < erwartetMs * 0.5);
          if (!zuFrueh || neuStarts >= 4) break;
          neuStarts++;
          // Ab dem Satz bzw. Wort weitermachen, in dem sie unterbrochen wurde.
          let ab = bisZeichen;
          if (!ab) ab = Math.min(teil.length, Math.round(((Date.now() - t0) / erwartetMs) * teil.length));
          const satz = Math.max(teil.lastIndexOf(". ", ab), teil.lastIndexOf("! ", ab), teil.lastIndexOf("? ", ab));
          ab = satz > 0 && ab - satz < 160 ? satz + 2 : Math.max(0, teil.lastIndexOf(" ", ab));
          rest = teil.slice(ab).trim();
          if (rest.length < 3) break;
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    } catch { /* still */ } finally {
      speaking = false;
      hueSprechen(false);
      window.FridayFace?.stop();
      if (nr === sprechNr) gesagtEnde = Date.now();
      if (nr === sprechNr) audioFreigeben();
      ohrNachStimme(nr);
      if (ohr.modus === "befehl") setState("Ich höre", "listening");
      else zeigeRuhe();
    }
  }

  // ---------- Senden ----------
  async function send(text, opts = {}) {
    text = (text || "").trim();
    if ((!text && !pendingImage) || busy) { if (busy && text) diag.schritt(`Nicht gesendet, Friday ist noch beschäftigt: „${text}“`, "warn"); return; }
    // "System Check" / "System Status": lokal prüfen (ohne Guthaben)
    if (/^system\s*[- ]?\s*(check|status|pr[üu]fung|test)$/i.test(text)) {
      addMessage("user", text);
      clearPhoto();
      if (window.openSysCheck) window.openSysCheck();
      const t = $("text"); if (t) t.value = "";
      return;
    }
    busy = true;
    // Für den Stimmungs-Sound (Automatik): nur was Boss gerade in Friday sagt/tippt.
    try { window.dispatchEvent(new CustomEvent("friday-eingabe", { detail: { text } })); } catch { /* egal */ }
    window.FridayAuftrag?.start();
    befehlEnde(); // getippt statt gesprochen
    const meinAuftrag = ++auftragNr;
    addMessage("user", pendingImage ? `📷 ${text}` : text);
    setState("Denkt nach", "thinking");
    const body = { text, image: pendingImage || undefined };
    // Routen: Standort mitschicken, wenn im Routen-Fenster erlaubt ("wie lange brauche ich nach …" ab hier).
    const standort = window.FridayRouten?.standort?.();
    if (standort) body.standort = standort;
    if ($("translate-toggle").checked) {
      body.mode = "translate";
      body.targetLang = $("translate-lang").value;
    }
    clearPhoto();
    const t0 = Date.now();
    diag.schritt(`Gesendet an den Mac: „${text}“`);
    // Hängt die Verbindung (Tailscale, WLAN), nicht ewig "Denkt nach" zeigen.
    const abbruch = new AbortController();
    const langsam = setTimeout(() => diag.schritt("Noch keine Antwort vom Mac (15 s) …", "warn"), 15000);
    const zuLang = setTimeout(() => abbruch.abort(), 120000);
    try {
      let res;
      try { res = await api("/api/chat", { method: "POST", body: JSON.stringify(body), signal: abbruch.signal }); }
      finally { clearTimeout(langsam); clearTimeout(zuLang); }
      const sek = ((Date.now() - t0) / 1000).toFixed(1).replace(".", ",");
      let data;
      try { data = await res.json(); } catch { throw new Error(`Mac antwortet mit Status ${res.status}`); }
      diag.schritt(`Antwort nach ${sek} s${data.error ? " – Fehler: " + data.error : ""}${data.answer ? ": „" + String(data.answer).slice(0, 60) + "“" : ""}${data.actions?.length ? " · Aktionen: " + data.actions.filter((a) => typeof a === "string").join(", ") : ""}`, data.error || !res.ok ? "bad" : "ok");
      if (meinAuftrag !== auftragNr) { diag.schritt("Antwort verworfen (vorher „Stopp“ gehört)", "warn"); return; } // "Friday, stopp" während sie nachdachte
      // Lernecke: Begrüßung macht das Fenster selbst (es weiß, ob Carla oder Kevin da ist), darum hier ohne Text.
      const stillLernen = !data.answer && !data.error && data.actions?.some((a) => typeof a === "string" && a.startsWith("lernen"));
      // v1.121.2: Nur Aktionen ohne Text (z. B. Welt-Runde) → nichts sagen, statt "Keine Antwort." vorzulesen.
      const nurAktion = !data.answer && !data.error && data.actions?.length > 0;
      let answer = data.answer || data.error || (stillLernen || nurAktion ? "" : "Keine Antwort.");
      const hat = (a) => data.actions?.includes(a);
      window.FridayAuftrag?.ende(res.ok && !data.error);
      const aktion = (p) => data.actions?.find((a) => typeof a === "string" && a.startsWith(p));
      try {
        // Friday hat ein Dokument oder einen Fragebogen erstellt: gleich zeigen.
        if (hat("fragebogen_erstellen") || hat("dokument_erstellen")) window.FridayDokumente?.neuestes();
        // Vollbild: im Browser umschalten (auf dem iPhone ist die Home-Bildschirm-App schon Vollbild).
        if (hat("vollbild") || hat("vollbild_aus")) {
          const r = window.FridayVollbild?.sprachBefehl(hat("vollbild"));
          if (r) answer = r;
        }
        // Nur vorlesen: Bei erfolgreicher Antwort und aktivem Vorlesen keinen Text zeigen.
        const voiceOn = $("voice-toggle").checked && "speechSynthesis" in window;
        if (data.answer && voiceOn) addSpeaking();
        else if (answer) addMessage("friday", answer);
        busy = false;
        if (data.actions?.some((a) => a === "set_reminder")) { refreshReminders(); window.FridayHud?.refresh(); }
        if (data.actions?.includes("werkstatt")) window.FridayWerkstatt?.showLatest();
        const landAktion = data.actions?.find((a) => typeof a === "string" && a.startsWith("land:"));
        if (landAktion) window.FridayLand?.open(landAktion.slice(5));
        // Weltgeschehen als Gespräch: Globus öffnen, Land anfliegen, Bewertung zeigen.
        const lageLand = data.actions?.find((a) => typeof a === "string" && a.startsWith("lage_land:"));
        const lageWert = data.actions?.find((a) => typeof a === "string" && a.startsWith("lage_bewertung:"));
        if (lageLand) window.FridayLage?.showCountry(lageLand.slice(10), { stumm: true, bewertung: lageWert?.slice(15) });
        else if (hat("weltgeschehen") && !window.FridayLage?.offen()) window.FridayLage?.open({ stumm: true });
        if (data.actions?.includes("welt_alarm")) window.FridayAlarm?.play();
        // Satelliten (v1.113.0): einzelner Satellit mit Steckbrief, eine Gruppe oder alle.
        const satA = data.actions?.find((a) => typeof a === "string" && a.startsWith("satellit:"));
        const satG = data.actions?.find((a) => typeof a === "string" && a.startsWith("satgruppe:"));
        if (satA) window.FridaySatelliten?.zeigeNr(Number(satA.slice(9)));
        else if (satG) window.FridaySatelliten?.gruppe(satG.slice(10));
        else if (hat("satelliten")) window.FridaySatelliten?.oeffne();
        // Schiffe (v1.114.0)
        const schiffA = data.actions?.find((a) => typeof a === "string" && a.startsWith("schiff:"));
        const schiffG = data.actions?.find((a) => typeof a === "string" && a.startsWith("schiffgruppe:"));
        if (schiffA) window.FridaySchiffe?.zeigeNr(Number(schiffA.slice(7)));
        else if (schiffG) window.FridaySchiffe?.gruppe(schiffG.slice(13));
        else if (hat("schiffe")) window.FridaySchiffe?.oeffne();
        // Flugzeuge (v1.115.0)
        const flugA = data.actions?.find((a) => typeof a === "string" && a.startsWith("flugzeug:"));
        const flugG = data.actions?.find((a) => typeof a === "string" && a.startsWith("fluggruppe:"));
        if (flugA) window.FridayFlugzeuge?.zeigeNr(flugA.slice(9));
        else if (flugG) window.FridayFlugzeuge?.gruppe(flugG.slice(11));
        else if (hat("flugzeuge")) window.FridayFlugzeuge?.oeffne();
        // Klimazonen (v1.119.0)
        if (hat("klimazonen")) window.FridayKlima?.an();
        if (hat("klimazonen_aus")) window.FridayKlima?.aus();
        // Welt-Runde (v1.116.0): "Zeig mir, was in der Welt passiert"
        if (hat("welttour")) window.FridayWelttour?.start();
        if (hat("welttour_weiter")) window.FridayWelttour?.weiter();
        if (hat("welttour_zurueck")) window.FridayWelttour?.zurueck();
        if (hat("welttour_stopp")) window.FridayWelttour?.stopp(true);
        if (data.actions?.includes("webseite_bauen")) window.FridayWebseiten?.open();
        // Schnitt-Team / Video-Studio (v1.132.0): "erstell mir ein 20-Sekunden-Video über …"
        const studioJob = aktion("studio_job:");
        if (studioJob) window.FridayStudio?.verfolge(studioJob.slice(11));
        else if (hat("video_erstellen")) window.FridayStudio?.verfolge(null);
        else if (hat("studio:videos")) window.FridayStudio?.open({ tab: "videos" });
        else if (hat("studio")) window.FridayStudio?.open({ tab: "erstellen" });
        else if (hat("video_schnitt")) window.FridayStudio?.open({ tab: "schneiden" });
        if (hat("archiv")) window.FridayArchiv?.open();
        if (hat("gehirn")) window.FridayGehirn?.open();
        if (hat("oekosystem")) window.FridayOekosystem?.open();
        // Routen & Verbindungen: Karte mit Auto, Rad, zu Fuß und Bahn/Bus zeigen.
        const routeAktion = data.actions?.find((a) => typeof a === "string" && a.startsWith("route:"));
        const routeZiel = data.actions?.find((a) => typeof a === "string" && a.startsWith("route_ziel:"));
        if (routeAktion) window.FridayRouten?.zeige(routeAktion.slice(6));
        else if (hat("route_planen")) window.FridayRouten?.neueste();
        else if (routeZiel) window.FridayRouten?.open({ ziel: decodeURIComponent(routeZiel.slice(11)) });
        else if (hat("routen")) window.FridayRouten?.open();
        // Kontrollraum (v1.135.0): "öffne den Kontrollraum", "zeig mir deine Seele", "was hast du heute ausgegeben?"
        const kernA = data.actions?.find((a) => a === "kern" || (typeof a === "string" && a.startsWith("kern:")));
        if (kernA) window.FridayKern?.open({ tab: kernA.startsWith("kern:") ? kernA.slice(5) : "" });
        else if (hat("kosten_deckel")) window.FridayKern?.open({ tab: "kosten" });
        // Kamera-Wache (v1.127.0): Fenster öffnen, eine Kamera zeigen, Ereignisse zeigen.
        const wacheA = aktion("wache:");
        if (wacheA === "wache:ereignisse") window.FridayWache?.open({ tab: "ereignisse" });
        else if (wacheA) window.FridayWache?.open({ kamera: wacheA.slice(6) });
        else if (hat("wache")) window.FridayWache?.open();
        else if (hat("wache_status")) window.FridayWache?.refresh();
        // OpenJarvis-Paket (v1.134.0): Freigabe-Glocke, Dauer-Wächter, Dokumenten-Wissen, Apple-Apps.
        if (hat("glocke")) window.FridayGlocke?.open();
        else window.FridayGlocke?.refresh();
        if (hat("dauerwaechter")) window.FridayWaechter?.open();
        else window.FridayWaechter?.refresh();
        const dokA = data.actions?.find((a) => a === "dokwissen" || (typeof a === "string" && a.startsWith("dokwissen:")));
        if (dokA === "dokwissen:dokumente") window.FridayDokwissen?.open({ tab: "dokumente" });
        else if (dokA) window.FridayDokwissen?.open(dokA.startsWith("dokwissen:") ? { frage: decodeURIComponent(dokA.slice(10)), ergebnis: data.answer } : {});
        const appleA = data.actions?.find((a) => a === "apple" || (typeof a === "string" && a.startsWith("apple:")));
        if (appleA) { const [, t, q] = appleA.split(":"); window.FridayApple?.open({ tab: t || "notizen", q: q ? decodeURIComponent(q) : "" }); }
        // App-Zentrale (v1.139.0, im Test): "apps" = Übersicht, "apps:<id>" = eine App zeigen, "apps_oeffnen:<id>" = Öffnen-Knopf hervorheben.
        // Zerlege-Labor (v1.143.0, im Test): "zerlegen:<modell>:<befehl>"
        const zerlA = aktion("zerlegen:");
        if (zerlA) { const [, mid, bef] = zerlA.split(":"); window.FridayZerlege?.open({ modell: mid, befehl: bef ? decodeURIComponent(bef) : "" }); }
        const appsA = aktion("apps:");
        if (appsA) window.FridayApps?.open({ id: appsA.slice(5), hervor: hat(`apps_oeffnen:${appsA.slice(5)}`) });
        else if (hat("apps")) window.FridayApps?.open();
        // Helfer-Paket (v1.106.0): Kühlschrank, Kaufberater, Advocatus Diaboli, Ideen-Schmiede, Stimmungs-Sound.
        if (hat("profil")) window.FridayProfil?.open();
        if (hat("kuehlschrank")) window.FridayKuehl?.open({ tab: hat("kuehlschrank:rezepte") ? "rezepte" : "vorrat" });
        else window.FridayKuehl?.refresh();
        const kaufA = aktion("kauf:");
        if (kaufA) window.FridayKauf?.open({ id: kaufA.slice(5) });
        else if (hat("kaufberater")) window.FridayKauf?.open();
        const gegenA = aktion("gegenrede:");
        if (gegenA) window.FridayGegen?.open({ id: gegenA.slice(10) });
        else if (hat("gegenrede")) window.FridayGegen?.open();
        const wissenA = data.actions?.find((a) => a === "wissen" || (typeof a === "string" && a.startsWith("wissen:")));
        if (wissenA) window.FridayWissen?.oeffne(wissenA.startsWith("wissen:") ? decodeURIComponent(wissenA.slice(7)) : "");
        if (hat("ideen:ausbau")) window.FridayIdeen?.open({ reiter: "ausbau" });
        const ideeA = aktion("idee:");
        if (ideeA) { try { window.FridayIdeen?.open({ wurf: JSON.parse(decodeURIComponent(ideeA.slice(5))) }); } catch { window.FridayIdeen?.open(); } }
        else if (hat("ideen")) window.FridayIdeen?.open();
        const klangA = aktion("klang:");
        if (klangA === "klang:aus") window.FridayKlang?.aus();
        else if (klangA?.startsWith("klang:wo:")) window.FridayKlang?.wo(klangA.slice(9));
        else if (klangA === "klang:auto") { window.FridayKlang?.auto(true); window.FridayKlang?.open(); }
        else if (klangA) window.FridayKlang?.spiele(klangA.slice(6));
        else if (hat("klang")) window.FridayKlang?.open();
        if (hat("klangvideo")) window.FridayKlang?.ansicht("video");
        // Spiele-Werkstatt: live zuschauen, wie Friday programmiert, oder ein gespeichertes Spiel starten.
        const spielBau = data.actions?.find((a) => typeof a === "string" && a.startsWith("spiel_bauen:"));
        const spielStart = data.actions?.find((a) => typeof a === "string" && a.startsWith("spiel:"));
        if (spielBau) window.FridaySpiele?.verfolge(spielBau.slice(12));
        else if (hat("spiel_bauen")) window.FridaySpiele?.neuester();
        else if (spielStart) window.FridaySpiele?.spiel(spielStart.slice(6));
        else if (hat("spiele")) window.FridaySpiele?.open();
        // Markt-Radar Plus (v1.145.0): Markt anzeigen, Prognose oder Markt-Wache.
        const mpA = aktion("marktplus:");
        if (mpA) window.FridayMarktPlus?.open(mpA.slice(10));
        else if (hat("markt_plus")) window.FridayMarktPlus?.open("");
        const zentraleAktion = data.actions?.find((a) => typeof a === "string" && a.startsWith("zentrale:"));
        if (zentraleAktion) window.FridayZentrale?.open(zentraleAktion.slice(9));
        else window.FridayZentrale?.refresh();
        const logbuchAktion = data.actions?.find((a) => typeof a === "string" && a.startsWith("logbuch:"));
        if (logbuchAktion) window.FridayLogbuch?.open(logbuchAktion.slice(8));
        else window.FridayLogbuch?.refresh();
        window.FridayEnergie?.refresh();
        window.FridayRing?.melde("auftrag", null);
      } catch (e) { diag.schritt(`Fehler beim Anzeigen: ${e?.message || e}`, "bad"); busy = false; }
      // Die Werkstatt erzählt selbst, was sie baut (Einleitung, jedes Bauteil, Fazit): nicht doppelt reden.
      if (!data.actions?.includes("werkstatt")) await say(answer);
      clearSpeaking();
      // Carlas Lernecke (v1.108.0): erst begrüßen bzw. ansagen, dann öffnet sich die Lernecke und hört selbst zu.
      const lernA = aktion("lernen");
      if (lernA) window.FridayLernen?.open({ modus: lernA.split(":")[1] || "start", suche: lernA.split(":").slice(2).join(" "), stimme: Boolean(opts.stimme) });
      // Friday hat eine Frage gestellt ("Welches Land?"): gleich zuhören, ohne Knopfdruck.
      // Gesprächsmodus: Kam der Befehl per Stimme, hört Friday danach weiter zu, ohne "Friday" davor.
      const weiter = ohr.modus !== "befehl" && !ohr.wartend && !unterbrochenEben() && !lernA && !window.FridayLernen?.offen() && (hat("zuhoeren") || (opts.stimme && (gespraechAn() || gespraechDauer() > 0) && data.answer));
      if (weiter && (Recognition || window.FridayHoeren?.soll()) && !callActive && !window.FridayDokumente?.offen()) {
        setTimeout(() => { if (!busy && !speaking) listenOnce({ folge: true, frage: hat("zuhoeren") }); }, 150);
      }
    } catch (err) {
      window.FridayAuftrag?.ende(false);
      const weg = err?.name === "AbortError" || /load failed|failed to fetch|network/i.test(err?.message || "");
      const grund = err?.name === "AbortError" ? "Der Mac hat 2 Minuten nicht geantwortet." : weg ? "Ich erreiche den Mac nicht." : err.message;
      diag.schritt(`Fehler: ${grund} (${err?.message || err})`, "bad");
      addMessage("friday", `Verbindung gestört: ${grund}`);
      if (weg) say(`${grund} Prüfe am Mac, ob Tailscale an ist.`);
      setState("Fehler", "");
      window.FridayRing?.melde("auftrag", "bad", "Auftrag fehlgeschlagen: Verbindung gestört", 2 * 60000);
    } finally {
      busy = false;
      if (!speaking) zeigeRuhe();
      // Kam während des Nachdenkens schon der nächste "Friday …"-Befehl: jetzt ausführen.
      const naechster = ohr.wartend; ohr.wartend = "";
      if (naechster) setTimeout(() => send(naechster, { stimme: true }), 50);
    }
  }

  $("chat-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = $("text").value;
    $("text").value = "";
    send(t);
  });

  // Für das Lagezentrum (lagezentrum.js).
  window.Friday = Object.assign(window.Friday || {}, { api, say, send, escapeHtml, relTime, refreshStatus: () => refreshStatus() });

  // ---------- Seitenleiste: Einstellungen & Gehirn ----------
  const openSheet = (id) => $(id)?.classList.remove("hidden");
  const closeSheet = (id) => $(id)?.classList.add("hidden");
  $("settings-btn")?.addEventListener("click", () => openSheet("settings"));
  $("settings-x")?.addEventListener("click", () => closeSheet("settings"));

  // Schwebendes Menü: hält alle Funktionen ohne Seitenleiste erreichbar.
  const menuPop = $("menu-pop");
  $("menu-fab")?.addEventListener("click", (e) => { e.stopPropagation(); menuPop?.classList.toggle("hidden"); });
  $("menu-side")?.addEventListener("click", (e) => { e.stopPropagation(); menuPop?.classList.toggle("hidden"); });
  // Osiris: lokal auf dem Mac (Port 3100), wenn diese Kopie läuft und Friday am Mac selbst offen ist.
  // Sonst (iPhone, unterwegs, oder Mac-Kopie aus) die öffentliche Online-Version osirisai.live.
  // Die Online-Version lässt sich nicht einbetten, darum öffnet sie in einem eigenen Tab.
  const OSIRIS_LAYERS = "flights,private,jets,military,maritime,transit,satellites,cctv,cctv_previews,live_news,earthquakes,fires,weather,infrastructure,global_incidents,alert_pins,day_night,cables,sdk_sea,sdk_air,sdk_naval,live_clouds,wind,rain,wind_controls,rain_controls,wind_particles,terrain_3d,terrain_elevation,malware,cyber_attacks,gdelt_events";
  const OSIRIS_ONLINE = "https://osirisai.live/?layers=" + OSIRIS_LAYERS;
  const amMac = () => location.hostname === "localhost" || location.hostname === "127.0.0.1";
  let osirisLokal = false;
  async function pruefeOsiris() {
    if (!amMac()) { osirisLokal = false; return; }
    try { const r = await api("/api/osiris"); if (r.ok) osirisLokal = Boolean((await r.json()).lokal); } catch { osirisLokal = false; }
  }
  setTimeout(pruefeOsiris, 1500);
  setInterval(pruefeOsiris, 60_000);
  const OSIRIS_URL = () => (amMac() && osirisLokal) ? "http://localhost:3100/?layers=" + OSIRIS_LAYERS : OSIRIS_ONLINE;
  // Direkt im Klick aufrufen, sonst blockt Safari (iPhone) das neue Fenster.
  window.openOsiris = () => {
    const u = OSIRIS_URL();
    let w = null;
    try { w = window.open(u, "_blank"); if (w) w.opener = null; } catch { w = null; }
    if (!w) { try { location.href = u; } catch {} } // Popup blockiert → im selben Fenster öffnen
  };
  // Lokale Osiris-Kopie direkt im Lagezentrum einbetten; Online-Version im eigenen Tab.
  function showOsirisEmbed(on) {
    const box = $("lage-osiris"); if (!box) return;
    if (on && !(amMac() && osirisLokal)) { window.openOsiris(); return; }
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
    if (row.hasAttribute("data-osiris")) {
      if (!(amMac() && osirisLokal)) { window.openOsiris(); return; } // sofort im Klick öffnen (Popup-Blocker)
      document.getElementById("lage-btn")?.click(); setTimeout(() => showOsirisEmbed(true), 60); return;
    }
    document.getElementById(row.dataset.target)?.click();
  });
  document.addEventListener("click", (e) => { if (menuPop && !menuPop.classList.contains("hidden") && !menuPop.contains(e.target) && e.target.id !== "menu-fab" && !e.target.closest("#menu-side")) menuPop.classList.add("hidden"); });

  // ---------- Schriftart ----------
  const FONTS = {
    "1": { head: "Orbitron", ui: "Rajdhani" },
    "2": { head: "'Exo 2'", ui: "'Exo 2'" },
    "3": { head: "Audiowide", ui: "'Chakra Petch'" },
    "4": { head: "Oxanium", ui: "Oxanium" },
    "5": { head: "Michroma", ui: "Saira" },
  };
  function applyFont(key) {
    const f = FONTS[key] || FONTS["1"];
    const root = document.documentElement.style;
    root.setProperty("--font-head", `${f.head}, ui-monospace, monospace`);
    root.setProperty("--font-ui", `${f.ui}, system-ui, sans-serif`);
    storage.set("friday_font", key);
    const sel = $("font-select"); if (sel) sel.value = key;
  }
  $("font-select")?.addEventListener("change", (e) => applyFont(e.target.value));
  applyFont(storage.get("friday_font") || "1");

  // ---------- Design: Farb-Themes + AMOLED ----------
  const THEMES = { orange: "#ff8a1e", cyan: "#4fd8ff", gruen: "#46e0a0", rot: "#ff5d6c", lila: "#b57bff", gold: "#ffcc4d", pink: "#ff6ec7", eis: "#8fb6ff" };
  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function applyTheme(name) {
    const eigen = /^#[0-9a-f]{6}$/i.test(storage.get("friday_themefarbe") || "") ? storage.get("friday_themefarbe") : THEMES.orange;
    const hex = name === "eigen" ? eigen : THEMES[name] || THEMES.orange;
    const [r, g, b] = hexRgb(hex);
    const root = document.documentElement.style;
    root.setProperty("--cyan", hex);
    root.setProperty("--cyan-soft", `rgba(${r},${g},${b},0.12)`);
    root.setProperty("--line", `rgba(${r},${g},${b},0.24)`);
    root.setProperty("--gold", hex);
    storage.set("friday_theme", name);
    document.querySelectorAll(".swatch").forEach((sw) => sw.classList.toggle("on", sw.dataset.theme === name || (name === "eigen" && sw.classList.contains("swatch-eigen"))));
  }
  window.FridayTheme = applyTheme;
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
  bindFlag("set-vollbild", "friday_vollbild", false);
  // Einmalig umstellen (v1.118.1): Gesprächsmodus aus, damit Friday nur noch auf "Friday" hört.
  if (storage.get("friday_nur_weckwort") !== "1") {
    // Je zweimal setzen: Nur eine echte Änderung (alter Wert vorhanden) nimmt der Mac-Abgleich mit,
    // sonst würde ein alter Wert vom Mac die Umstellung gleich wieder überschreiben.
    storage.set("friday_gespraech", "1");
    storage.set("friday_gespraech", "0");
    storage.set("friday_nur_weckwort", "0");
    storage.set("friday_nur_weckwort", "1");
  }
  bindFlag("set-gespraech", "friday_gespraech", false);
  (() => { // v1.147.0: wie lange Friday im Gespräch dran bleibt (Eve-Test „gespraech-laenger“)
    const el = $("set-gespraech-dauer");
    if (!el) return;
    const v = storage.get("friday_gespraech_dauer");
    el.value = v === null || v === undefined || v === "" ? "30" : String(v);
    if (!el.value) el.value = "30";
    el.addEventListener("change", () => { storage.set("friday_gespraech_dauer", el.value); window.dispatchEvent(new Event("friday-settings")); });
  })();
  bindFlag("set-unterbrechen", "friday_unterbrechen", true);
  bindFlag("set-vonselbst", "friday_vonselbst", false);
  bindFlag("set-diagnose", "friday_diagnose", true);
  // Kopf-Stil: wird beim Laden von face.js gelesen, darum nach dem Wechsel neu laden
  (() => {
    const sel = $("set-kopfstil");
    if (!sel) return;
    sel.value = storage.get("friday_kopfstil") || window.FridayFace?.standardStil || "neuronen";
    sel.addEventListener("change", () => { storage.set("friday_kopfstil", sel.value); location.reload(); });
  })();
  // Leistungsmodus (leistung.js): Automatisch / Schön / Flüssig – gilt nur für dieses Gerät
  (() => {
    const sel = $("set-leistung"), info = $("set-leistung-info");
    const L = window.FridayLeistung;
    if (!sel || !L) return;
    const zeige = () => {
      sel.value = L.modus;
      if (info) info.textContent = L.modus === "auto"
        ? `Gerade aktiv: ${L.fluessig ? "Flüssig" : "Schön"} (${L.istHandy() ? "Handy erkannt" : "Computer erkannt"})`
        : `Gerade aktiv: ${L.fluessig ? "Flüssig" : "Schön"}`;
    };
    zeige();
    sel.addEventListener("change", () => {
      L.setzen(sel.value);
      zeige();
      // Pixeldichte und Partikel des Kopfes werden beim Laden festgelegt → kurz neu laden
      setTimeout(() => location.reload(), 350);
    });
    window.addEventListener("friday-leistung", zeige);
  })();
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
  // Länder-Namen auf dem Globus (von lagezentrum.js gelesen)
  bindFlag("set-globelabels", "friday_globelabels", true);
  bindFlag("set-alarmauto", "friday_alarm_auto", false);
  bindFlag("set-lagedetail", "friday_lage_detail", true);
  bindFlag("set-marktspeak", "friday_markt_speak", true);
  bindFlag("set-visiongesten", "friday_vision_gesten", true);
  bindFlag("set-werkstattmassiv", "friday_werkstatt_massiv", false);
  // Auswahlfelder und Regler, die einfach gespeichert werden
  const bindValue = (id, key, def) => {
    const el = $(id); if (!el) return;
    el.value = storage.get(key) ?? def;
    el.addEventListener("input", () => { storage.set(key, el.value); window.dispatchEvent(new Event("friday-settings")); });
  };
  bindValue("set-marktdefault", "friday_markt_default", "gold");
  bindValue("set-visionschwelle", "friday_vision_schwelle", "45");
  bindValue("set-schnittlook", "friday_schnitt_look", "natürlich");

  // ---------- Glow ----------
  const applyGlow = () => {
    document.documentElement.style.setProperty("--glow", storage.get("friday_glow") ?? "1");
    document.body.classList.toggle("glow-breathe", storage.get("friday_glowbreathe") === "1");
  };
  bindValue("set-glow", "friday_glow", "1");
  bindFlag("set-glowbreathe", "friday_glowbreathe", false);
  applyGlow();
  window.addEventListener("friday-settings", applyGlow);

  // ---------- Immer aktuell (Server-Einstellungen + Update-Stand) ----------
  async function loadServerSettings() {
    try {
      const s = await (await api("/api/einstellungen")).json();
      for (const k of ["autoUpdate", "vorladen", "marktVorrechnen"]) { const el = $(`srv-${k}`); if (el) el.checked = Boolean(s[k]); }
      if ($("srv-tempo") && s.tempo) $("srv-tempo").value = s.tempo;
    } catch { /* später */ }
  }
  for (const k of ["autoUpdate", "vorladen", "marktVorrechnen"]) {
    $(`srv-${k}`)?.addEventListener("change", (e) => api("/api/einstellungen", { method: "POST", body: JSON.stringify({ [k]: e.target.checked }) })
      .then((r) => (r.ok ? window.FridaySync?.gespeichert() : window.FridaySync?.nichtGespeichert()))
      .catch(() => window.FridaySync?.nichtGespeichert()));
  }
  $("srv-tempo")?.addEventListener("change", (e) => api("/api/einstellungen", { method: "POST", body: JSON.stringify({ tempo: e.target.value }) })
    .then((r) => (r.ok ? window.FridaySync?.gespeichert() : window.FridaySync?.nichtGespeichert()))
    .catch(() => window.FridaySync?.nichtGespeichert()));
  async function checkUpdateInfo() {
    const info = $("upd-info"); if (!info) return;
    info.textContent = "Prüfe GitHub …";
    try {
      const u = await (await api("/api/update")).json();
      info.textContent = u.error ? `Version ${u.installed} · ${u.error}` : u.available ? `Version ${u.installed} · neu: ${u.latest}` : `Version ${u.installed} · aktuell ✓`;
      zeigeInstallKnopf(u);
      showGhKey(u.githubSchluessel);
    } catch { info.textContent = "Konnte nicht prüfen."; zeigeInstallKnopf(null); }
  }
  // Deutlicher Knopf „Jetzt installieren“, sobald eine neue Version da ist.
  let einstUpdate = null;
  function zeigeInstallKnopf(u) {
    const box = $("upd-neu"); if (!box) return;
    einstUpdate = u && !u.error && u.available ? u : null;
    box.classList.toggle("hidden", !einstUpdate);
    if (!einstUpdate) return;
    $("upd-neu-titel").textContent = `Update auf ${u.latest} verfügbar`;
    $("upd-neu-sub").textContent = `Du hast ${u.installed}. Vorher wird automatisch gesichert, Friday ist danach kurz offline.`;
    const btn = $("upd-install");
    const laeuft = window.FridayUpdate?.aktiv?.();
    btn.disabled = Boolean(laeuft);
    btn.textContent = laeuft ? "Update läuft …" : "⬇ Jetzt installieren";
  }
  $("upd-check")?.addEventListener("click", checkUpdateInfo);
  $("upd-install")?.addEventListener("click", async () => {
    if (!einstUpdate) return;
    const btn = $("upd-install");
    btn.disabled = true; btn.textContent = "Startet …";
    const ok = await installUpdate(einstUpdate);
    if (ok) { btn.textContent = "Update läuft …"; $("upd-info").textContent = `Installiere Version ${einstUpdate.latest} …`; }
    else { btn.disabled = false; btn.textContent = "⬇ Jetzt installieren"; }
  });
  // GitHub-Schlüssel (nur nötig, wenn das Repo privat ist). Der Schlüssel selbst kommt nie zurück.
  function showGhKey(k) {
    const el = $("gh-info"); if (!el || !k) return;
    el.textContent = k.set ? `GitHub-Schlüssel: ✓ eingetragen${k.source === "env" ? " (in der .env)" : ""}` : "GitHub-Schlüssel: keiner (reicht, solange das Repo öffentlich ist)";
    $("gh-forget")?.classList.toggle("hidden", k.source !== "dashboard");
  }
  $("gh-save")?.addEventListener("click", async () => {
    const inp = $("gh-token"), btn = $("gh-save");
    const token = inp.value.trim(); if (!token) return;
    btn.disabled = true; btn.textContent = "Prüfe …";
    let r;
    try { r = await (await api("/api/update/schluessel", { method: "POST", body: JSON.stringify({ token }) })).json(); } catch { r = { error: "Friday ist nicht erreichbar." }; }
    btn.disabled = false; btn.textContent = "Speichern";
    if (!r.ok) { alert(r.error || "Das hat nicht geklappt."); return; }
    inp.value = "";
    showGhKey(r);
    checkUpdateInfo();
  });
  $("gh-forget")?.addEventListener("click", async () => {
    if (!confirm("GitHub-Schlüssel entfernen? Bei einem privaten Repo klappen Updates dann nicht mehr.")) return;
    try { showGhKey(await (await api("/api/update/schluessel/vergessen", { method: "POST" })).json()); checkUpdateInfo(); } catch { /* später */ }
  });
  // Sobald die Einstellungen sichtbar werden: Server-Werte und Update-Stand holen.
  const settingsSheet = $("settings");
  if (settingsSheet) new MutationObserver(() => { if (!settingsSheet.classList.contains("hidden")) { loadServerSettings(); checkUpdateInfo(); } }).observe(settingsSheet, { attributes: true, attributeFilter: ["class"] });

  // ---------- Textgröße ----------
  function applyTextSize(v) {
    const map = { s: "0.92", m: "1", l: "1.1", xl: "1.2" };
    document.documentElement.style.zoom = map[v] || map.m;
    storage.set("friday_textsize", v);
    const s = $("text-size"); if (s) s.value = v;
  }
  $("text-size")?.addEventListener("change", (e) => applyTextSize(e.target.value));
  applyTextSize(storage.get("friday_textsize") || "m");

  // ---------- Globus-Stil: Echt / Hologramm ----------
  function applyGlobeStyle(v) {
    document.body.classList.toggle("globe-holo", v === "holo");
    storage.set("friday_globestyle", v);
    const s = $("globe-style"); if (s) s.value = v;
    window.dispatchEvent(new Event("friday-settings"));
  }
  $("globe-style")?.addEventListener("change", (e) => applyGlobeStyle(e.target.value));
  applyGlobeStyle(storage.get("friday_globestyle") || "echt");
  // Lagezentrum optional direkt mit Osiris öffnen
  document.getElementById("lage-btn")?.addEventListener("click", () => { if (storage.get("friday_osiris_default") === "1" && amMac() && osirisLokal) setTimeout(() => window.showOsirisEmbed && window.showOsirisEmbed(true), 90); });

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
    pickVoice();
    const aktiv = systemStimme ? SYSTEMSTIMME : germanVoice ? stimmKey(germanVoice) : "";
    let sprachName = (c) => c;
    try { const dn = new Intl.DisplayNames(["de"], { type: "language" }); sprachName = (c) => dn.of(c) || c; } catch { /* alter Browser */ }
    const gruppen = new Map();
    for (const v of voices) {
      const code = String(v.lang || "?").replace("_", "-").split("-")[0].toLowerCase();
      if (!gruppen.has(code)) gruppen.set(code, []);
      gruppen.get(code).push(v);
    }
    const reihe = (c) => (c === "de" ? 0 : c === "en" ? 1 : 2);
    const codes = [...gruppen.keys()].sort((a, b) => reihe(a) - reihe(b) || sprachName(a).localeCompare(sprachName(b), "de"));
    const option = (v) => {
      const art = stimmArt(v);
      const land = String(v.lang || "").replace("_", "-").split("-")[1];
      const extra = [art.rang >= 2 || art.rang <= 0 || art.text === "Online" ? art.text : "", land && land !== "DE" ? land : ""].filter(Boolean).join(", ");
      const stern = art.rang >= 3 ? "★ " : art.rang === 2 ? "☆ " : "";
      return `<option value="${escapeHtml(stimmKey(v))}"${stimmKey(v) === aktiv ? " selected" : ""}>${stern}${escapeHtml(stimmName(v))}${extra ? ` · ${escapeHtml(extra)}` : ""}</option>`;
    };
    sel.innerHTML = codes.map((c) => {
      const liste = gruppen.get(c).sort((a, b) => stimmArt(b).rang - stimmArt(a).rang || stimmName(a).localeCompare(stimmName(b), "de"));
      const titel = c === "de" ? `Deutsch (${liste.length})` : `${sprachName(c)} (${liste.length})${c === "en" ? "" : " – spricht mit Akzent"}`;
      const sys = c === "de" ? `<option value="${SYSTEMSTIMME}"${aktiv === SYSTEMSTIMME ? " selected" : ""}>⚙︎ Systemstimme (wie in den ${AUF_IOS ? "iPhone" : "Mac"}-Einstellungen)</option>` : "";
      return `<optgroup label="${escapeHtml(titel)}">${sys}${liste.map(option).join("")}</optgroup>`;
    }).join("");
    if (!gruppen.has("de")) sel.insertAdjacentHTML("afterbegin", `<option value="${SYSTEMSTIMME}"${aktiv === SYSTEMSTIMME ? " selected" : ""}>⚙︎ Systemstimme</option>`);
    const info = $("voice-info");
    if (info) {
      const de = gruppen.get("de") || [];
      const gut = de.filter((v) => stimmArt(v).rang >= 2).length;
      info.innerHTML = voices.length
        ? `${voices.length} Stimmen auf diesem Gerät, davon <b>${de.length} auf Deutsch</b>${gut ? ` (${gut} in Premium/Erweitert ★)` : " – noch keine Premium-Stimme geladen"}.`
        : "Dieses Gerät meldet noch keine Stimmen. Tippe auf „Liste neu laden“.";
      if (AUF_IOS) info.innerHTML += `<br><b>iPhone:</b> Safari zeigt Webseiten nur einen Teil deiner geladenen Stimmen. Nimm oben <b>„⚙︎ Systemstimme“</b> und wähle die Stimme im iPhone aus: Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Deutsch → Stimme antippen (Häkchen). Danach Friday ganz schließen und neu öffnen.`;
    }
  }
  if ("speechSynthesis" in window) { fillVoices(); speechSynthesis.addEventListener?.("voiceschanged", fillVoices); }
  $("voice-reload")?.addEventListener("click", () => { fillVoices(); setTimeout(fillVoices, 600); });
  // Gerätestimme kurz probehören.
  function probeGeraet() {
    if (!("speechSynthesis" in window) || (!germanVoice && !systemStimme)) return;
    try {
      speechSynthesis.cancel();
      const de = systemStimme || /^de/i.test(germanVoice.lang);
      const name = germanVoice ? stimmName(germanVoice) : "Friday";
      const u = new SpeechSynthesisUtterance(de ? `Hallo ${status.name || "Boss"}, ich bin ${name}.` : `Hello, I am ${name}.`);
      if (germanVoice) { u.voice = germanVoice; u.lang = germanVoice.lang; } else u.lang = "de-DE";
      u.rate = Number(storage.get("friday_rate")) || 1.05;
      u.pitch = Number(storage.get("friday_pitch")) || 1;
      u.volume = Math.min(1, Math.max(0.05, Number(storage.get("friday_lautstaerke")) || 1));
      speechSynthesis.speak(u);
    } catch { /* egal */ }
  }
  $("voice-select")?.addEventListener("change", (e) => { storage.set("friday_voice", e.target.value); pickVoice(); probeGeraet(); });
  $("voice-probe")?.addEventListener("click", probeGeraet);
  $("voice-rate")?.addEventListener("input", (e) => storage.set("friday_rate", e.target.value));
  $("voice-pitch")?.addEventListener("input", (e) => storage.set("friday_pitch", e.target.value));
  { const r = storage.get("friday_rate"); if (r && $("voice-rate")) $("voice-rate").value = r; const p = storage.get("friday_pitch"); if (p && $("voice-pitch")) $("voice-pitch").value = p; }
  $("voice-test")?.addEventListener("click", () => say(`${tagesGruss()}, ${status.name || "Boss"}. So klinge ich jetzt.`));
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
      case "home": try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { window.scrollTo(0, 0); } break;
      case "chat": $("text")?.focus(); break;
      case "kalender": openSheet("kalender"); loadKalender(); break;
      case "aufgaben": openSheet("organizer"); loadOrganizer(); break;
      case "dateien": openSheet("dateien"); break;
      case "wissen": openSheet("wissen"); ladeWissen(); break;
      case "archiv": window.FridayArchiv?.open(); break;
      case "system": openSheet("brain"); loadBrain(); break;
      case "einstellungen": openSheet("settings"); break;
      case "websuche": { const t = $("text"); if (t) { t.value = ""; t.placeholder = "Was soll Friday im Web suchen?"; t.focus(); } break; }
    }
  }
  document.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => navTo(b.dataset.nav, b)));
  // Dienste in der Sidebar (Amazon/Netflix/YouTube) öffnen
  document.querySelectorAll(".nav-svc[data-url]").forEach((b) => b.addEventListener("click", () => {
    const u = b.dataset.url; try { window.open(u, "_blank", "noopener"); } catch { location.href = u; }
  }));

  // ---------- Begrüßung nach Tageszeit ----------
  // Morgens (4–11 Uhr) „Guten Morgen“, mittags/nachmittags (11–18 Uhr) „Guten Tag“, abends und nachts „Guten Abend“.
  function setGreeting() {
    const g = $("greeting"); if (!g) return;
    g.textContent = `${tagesGruss()}, ${status.name || "Boss"}.`;
  }
  setGreeting(); setInterval(setGreeting, 10 * 60000);
  window.addEventListener("friday-status", setGreeting);

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
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeSheet("settings"); closeSheet("brain"); closeSheet("wissen"); } });
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
  // ---------- Wissen = Fridays Datenbank: alles, was gesprochen und gemacht wurde ----------
  const W_ICON = { gespraech: "💬", aktion: "⚡", gedaechtnis: "🧠", aufgabe: "✅", erinnerung: "⏰", einkauf: "🛒", dokument: "📄", notiz: "📝", idee: "💡", entscheidung: "⚖️", ziel: "🎯", mission: "🚀", geraet: "🔌", vorrat: "🥫", lernen: "🎓" };
  const W_NAME = { gespraech: "Gespräche", aktion: "Aktionen", gedaechtnis: "Gemerkt", aufgabe: "Aufgaben", erinnerung: "Erinnerungen", einkauf: "Einkauf", dokument: "Dokumente", notiz: "Notizen", idee: "Ideen", entscheidung: "Entscheidungen", ziel: "Ziele", mission: "Missionen", geraet: "Geräte", vorrat: "Vorrat", lernen: "Lernstapel" };
  const W_KANAL = { web: "Dashboard", telegram: "Telegram", siri: "Siri", briefing: "Briefing" };
  let wTyp = "", wQ = "", wLetztes = "", wSuchTimer = null, wLaedt = false;
  const wMark = (t) => {
    const h = escapeHtml(t || "");
    if (!wQ) return h;
    const q = escapeHtml(wQ).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return h.replace(new RegExp(q, "gi"), (m) => `<mark>${m}</mark>`);
  };
  const wTagName = (d) => {
    const heute = new Date(); const gestern = new Date(Date.now() - 864e5);
    const gleich = (a, b) => a.toDateString() === b.toDateString();
    if (gleich(d, heute)) return "Heute";
    if (gleich(d, gestern)) return "Gestern";
    return d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  };
  function wEintrag(e) {
    const d = new Date(e.at);
    const zeit = e.alt ? "früher" : d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    let haupt = "", neben = "";
    if (e.typ === "gespraech") {
      haupt = `${wMark(e.frage || "(ohne Text)")}<span class="kanal">${escapeHtml(W_KANAL[e.kanal] || e.kanal || "")}</span>`;
      neben = e.antwort ? `<div class="antwort" title="Antippen zum Aufklappen">${wMark(e.antwort)}</div>` : "";
    } else if (e.typ === "erinnerung") {
      haupt = wMark(e.text);
      if (e.faellig) neben = `<div class="antwort">fällig ${escapeHtml(new Date(e.faellig).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }))}</div>`;
    } else if (e.typ === "dokument") {
      haupt = `${wMark(e.text)}<span class="kanal">${e.art === "fragebogen" ? "Fragebogen" : "Dokument"}${e.info ? ` · ${escapeHtml(e.info)}` : ""}</span>`;
      neben = `<div class="antwort">${wMark((e.inhalt || "").slice(0, 400))}</div>`;
      return `<div class="wissen-e wissen-dok" data-dok="${escapeHtml(e.id)}" role="button" tabindex="0" title="Öffnen"><span class="ico">${e.art === "fragebogen" ? "📝" : "📄"}</span><div><div class="frage">${haupt}</div>${neben}</div><span class="zeit">${zeit}</span></div>`;
    } else {
      haupt = wMark(e.text);
      if (e.typ === "aktion" && e.art) haupt += `<span class="kanal">${escapeHtml(e.art)}</span>`;
      else if (e.info) haupt += `<span class="kanal">${escapeHtml(e.info)}</span>`;
      if (e.typ !== "gedaechtnis" && e.typ !== "aktion" && W_NAME[e.typ] && !wTyp) haupt += `<span class="kanal db-quelle">${escapeHtml(W_NAME[e.typ])}</span>`;
      if (e.inhalt) neben = `<div class="antwort" title="Antippen zum Aufklappen">${wMark(String(e.inhalt).slice(0, 1200))}</div>`;
    }
    const weg = e.typ === "notiz" && e.id ? `<button class="db-weg" type="button" data-notiz="${escapeHtml(e.id)}" title="Notiz löschen" aria-label="Notiz löschen">✕</button>` : "";
    return `<div class="wissen-e${e.erledigt ? " erledigt" : ""}" data-typ="${escapeHtml(e.typ)}"><span class="ico">${W_ICON[e.typ] || "•"}</span><div><div class="frage">${haupt}</div>${neben}</div><span class="zeit">${zeit}${weg}</span></div>`;
  }
  async function ladeWissen(weiter = false) {
    if (wLaedt) return;
    wLaedt = true;
    const liste = $("wissen-liste");
    if (!weiter) { wLetztes = ""; if (liste) liste.innerHTML = '<span class="muted">Lade …</span>'; }
    try {
      const u = new URLSearchParams({ typ: wTyp, q: wQ, limit: "120" });
      if (weiter && wLetztes) u.set("vor", wLetztes);
      const d = await (await api("/api/wissen/datenbank?" + u)).json();
      if (!weiter) window.FridayDatenbank?.kern();
      const tr = $("wissen-treffer");
      if (tr) tr.textContent = wQ || wTyp ? `${d.treffer || 0} Treffer${wTyp ? ` in ${W_NAME[wTyp] || wTyp}` : ""}${wQ ? ` zu „${wQ}“` : ""}` : "";
      let html = "", letzterTag = weiter && liste?.dataset.tag ? liste.dataset.tag : "";
      for (const e of d.eintraege || []) {
        const tag = e.alt ? "Ältere Gespräche" : wTagName(new Date(e.at));
        if (tag !== letzterTag) { html += `<div class="wissen-tag">${escapeHtml(tag)}</div>`; letzterTag = tag; }
        html += wEintrag(e);
      }
      if (liste) {
        liste.dataset.tag = letzterTag;
        if (!weiter) liste.innerHTML = html || `<span class="muted">${wQ ? `Nichts gefunden zu „${escapeHtml(wQ)}“.` : wTyp ? `Noch keine ${W_NAME[wTyp]} gespeichert.` : "Noch nichts gespeichert. Ab jetzt landet hier alles, was du mit Friday besprichst."}</span>`;
        else liste.insertAdjacentHTML("beforeend", html);
      }
      const l = d.eintraege || [];
      if (l.length) wLetztes = l[l.length - 1].at;
      $("wissen-mehr")?.classList.toggle("hidden", !d.mehr);
    } catch {
      if (liste && !weiter) liste.innerHTML = '<span class="muted">Datenbank nicht erreichbar.</span>';
    } finally { wLaedt = false; }
  }
  $("wissen-x")?.addEventListener("click", () => closeSheet("wissen"));
  $("wissen-mehr")?.addEventListener("click", () => ladeWissen(true));
  $("wissen-q")?.addEventListener("input", (e) => { clearTimeout(wSuchTimer); wSuchTimer = setTimeout(() => { wQ = e.target.value.trim(); ladeWissen(); }, 250); });
  $("wissen-filter")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-typ]");
    if (!b) return;
    wTyp = b.dataset.typ;
    document.querySelectorAll("#wissen-filter button").forEach((x) => x.classList.toggle("active", x === b));
    ladeWissen();
  });
  $("wissen-liste")?.addEventListener("click", async (e) => {
    const weg = e.target.closest("[data-notiz]");
    if (weg) {
      try { await api("/api/wissen/notiz/" + encodeURIComponent(weg.dataset.notiz), { method: "DELETE" }); } catch { /* egal */ }
      ladeWissen(); return;
    }
    const dok = e.target.closest("[data-dok]");
    if (dok) { window.FridayDokumente?.oeffne(dok.dataset.dok); return; }
    const a = e.target.closest(".antwort"); if (a) a.classList.toggle("offen");
  });
  $("wissen-csv")?.addEventListener("click", async () => {
    try {
      const blob = await (await api("/api/wissen/export?" + new URLSearchParams({ format: "csv", typ: wTyp, q: wQ }))).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `friday-datenbank-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch { /* egal */ }
  });
  // Von außen (Speicher-Karte, Themen, Sprachbefehl): Filter oder Suche setzen.
  window.FridayWissen = {
    oeffne(q = "", typ = "") {
      openSheet("wissen");
      wQ = String(q || ""); wTyp = String(typ || "");
      const f = $("wissen-q"); if (f) f.value = wQ;
      document.querySelectorAll("#wissen-filter button").forEach((x) => x.classList.toggle("active", x.dataset.typ === wTyp));
      ladeWissen();
    },
    typ(t) { wTyp = t || ""; document.querySelectorAll("#wissen-filter button").forEach((x) => x.classList.toggle("active", x.dataset.typ === wTyp)); ladeWissen(); },
    suche(q) { wQ = String(q || ""); const f = $("wissen-q"); if (f) f.value = wQ; ladeWissen(); },
    neu() { ladeWissen(); },
    get aktiverTyp() { return wTyp; },
  };
  $("wissen-export")?.addEventListener("click", async () => {
    try {
      const blob = await (await api("/api/wissen/export")).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `friday-datenbank-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch { /* egal */ }
  });

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
    await installUpdate(update);
  });
  // Startet das Update sofort (Kopf-Knopf und „Jetzt installieren“ in den Einstellungen).
  async function installUpdate(u) {
    let res;
    try { res = await (await api("/api/update", { method: "POST" })).json(); } catch { res = { error: "Friday ist nicht erreichbar." }; }
    if (res.error) { addMessage("sys", res.error); return false; }
    showUpdate("busy", "Update läuft...");
    addMessage("friday", `Ich spiele Version ${u.latest} ein und starte gleich neu, Boss.`);
    // Ladebalken zeigt Herunterladen → Sicherung → Installieren → Neustart und lädt am Ende neu.
    window.FridayUpdate?.start({ ziel: u.latest, von: u.installed });
    return true;
  }
  window.addEventListener("friday-update-ende", (e) => {
    if (e.detail?.ok === false) { if (e.detail.text) addMessage("sys", e.detail.text); checkUpdate(); checkUpdateInfo(); }
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
  // Für Friday Vision (vision.js): Standbild fragen, Stimme stoppen.
  window.Friday.askAboutImage = (frame, text) => { pendingImage = frame; return send(text); };
  window.Friday.stopSpeaking = () => { sprechNr++; try { speechSynthesis?.cancel(); } catch { /* egal */ } try { audio.pause(); } catch { /* egal */ } };

  // ---------- Sprachsteuerung (v1.122.0): EIN Ohr, ein klarer Ablauf ----------
  // Früher liefen bis zu drei Mikrofone nacheinander (Weckwort-Ohr, Zuhören, Unterbrechen-Ohr). Jeder Wechsel
  // brauchte auf dem iPhone Zeit, schnitt die Stimme ab oder ließ Safari hängen ("Nicht verstanden", taub).
  // Jetzt gibt es genau EIN Mikrofon, das durchgehend läuft, und einen Ablauf mit vier Schritten:
  //   1. Warten:   Friday hört zu, reagiert aber NUR auf Sätze mit "Friday". Alles andere (Gespräche mit
  //                deiner Frau, Fernseher, S-Bahn) wird ignoriert.
  //   2. Befehl:   Nach "Friday" allein (oder wenn Friday etwas gefragt hat) zählt der nächste Satz auch ohne "Friday".
  //   3. Denken:   Der Server arbeitet. "Friday, stopp" bricht ab, ein neuer "Friday …"-Befehl wartet so lange.
  //   4. Sprechen: Friday redet. Nur "Friday …" unterbricht sie ("Friday, stopp" = sofort still), sonst redet sie weiter.
  // Das Mikrofon wird dafür nie umgeschaltet. Endet es von selbst (Browser, Stille, Geräusch), startet es neu.
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  // "Friday" zählt überall im Satz (außer "Black Friday"). Das deutsche Wort "Freitag" zählt nur ganz am
  // Anfang ("Freitag, wie spät ist es?"), sonst springt sie bei "am Freitag fahren wir zu Oma" an.
  const WAKE_WORT = /(?<!black\s)\b(?:friday|fraidei|freiday|frei day)\b[,.!?]?\s*/i;
  const WAKE_START = /^\s*(?:(?:hey|hi|hallo|ok|okay|na)[,]?\s+)?freitag\b[,.!?]?\s*/i;
  const WAKE = {
    [Symbol.match](said) {
      const t = String(said || "");
      return t.match(WAKE_WORT) || t.match(WAKE_START);
    },
  };
  window.Friday.weckwort = (said) => { const m = String(said || "").match(WAKE); return m ? { index: m.index, ende: m.index + m[0].length } : null; };

  // Gesprächsmodus (Standard AUS): Nach einer gesprochenen Antwort zählt der nächste Satz auch ohne "Friday".
  // Aus, weil Friday sonst das Gespräch mit anderen an sich selbst schickt. Einschalten: Einstellungen → Assistent.
  const gespraechAn = () => storage.get("friday_gespraech") === "1";
  // v1.147.0 (Eve-Test „gespraech-laenger“): Hat Boss Friday mit „Friday …“ angesprochen, bleibt sie nach jeder
  // Antwort eine Weile dran (Einstellung friday_gespraech_dauer: 0 = aus, 15/30/60 s, Standard 30).
  const langFrei = () => { try { return !window.FridayEve?.frei || window.FridayEve.frei("gespraech-laenger"); } catch { return false; } };
  const gespraechDauer = () => {
    if (!langFrei()) return 0;
    const v = storage.get("friday_gespraech_dauer");
    if (v === null || v === undefined || v === "") return 30;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.min(120, n) : 0;
  };
  window.Friday.gespraechDauer = gespraechDauer;
  const unterbrechenAn = () => storage.get("friday_unterbrechen") !== "0";
  // Damit endet ein Gespräch, ohne dass es an Friday geschickt wird.
  const GESPRAECH_ENDE = /^(?:(?:ok(?:ay)?|gut|alles klar|super|perfekt)[ ,.!]*)?(?:danke(?: dir| schön| schoen| sehr)?|das wars?|das war's|das war es|das reicht|reicht|fertig|stopp?|ende|schluss|tschüss|tschuess|bis später|bis spaeter|nichts mehr|nein danke)(?: friday| boss)?[ .!]*$/i;
  // "Friday, stopp" & Co.: sofort still sein, nichts an den Server schicken.
  const NUR_STOPP = /^(?:(?:bitte|jetzt|mal)\s+)?(?:stopp?|halt|ruhe|still|sei still|sei ruhig|schluss|aus|hör auf|hoer auf|aufhören|aufhoeren|warte|moment|danke|ok(?:ay)?|genug|pause|das reicht|reicht|es reicht)(?:\s+(?:bitte|jetzt|friday|boss))*[ .!]*$/i;
  const IST_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const ohr = {
    rec: null,          // das eine Mikrofon
    laeuft: false,
    modus: "warten",    // "warten" (nur "Friday …") oder "befehl" (nächster Satz zählt)
    befehl: {},         // { folge, frage } im Befehl-Modus
    befehlTimer: null,
    timer: null,
    gestartet: 0,
    lebenszeichen: 0,
    gestoppt: 0,        // wann das Mikrofon zuletzt aus ging (iPhone braucht danach eine kurze Pause)
    schnell: 0,         // wie oft es direkt wieder aufgehört hat (sonst Dauerschleife)
    brauchtTipp: false, // Safari will erst einen Tipp aufs Display
    verbraucht: new Map(), // Satz-Nr. → wie viele Zeichen davon schon verarbeitet sind
    verstummt: new Set(),
    stabil: new Map(),     // Satz-Nr. → Zeitschalter: Zwischenstand gilt als fertig, wenn er sich nicht mehr ändert
    wartend: "",        // Befehl, der kam, während Friday noch nachdachte
  };
  let wakeActive = !!Recognition;
  let bargeZeit = 0;        // wann Friday zuletzt per "Friday …" unterbrochen wurde
  let gesagtText = "";      // was Friday gerade sagt oder zuletzt gesagt hat (Echo-Erkennung)
  let gesagtEnde = 0;
  let auftragNr = 0;        // "Friday, stopp" beim Nachdenken verwirft die laufende Antwort
  const unterbrochenEben = () => Date.now() - bargeZeit < 4000;
  window.Friday.unterbrochen = () => unterbrochenEben() || ohr.modus === "befehl";
  window.Friday.beschaeftigt = () => busy || speaking || ohr.modus === "befehl";

  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ß ]+/g, " ").replace(/\s+/g, " ").trim();
  const sagtFridaySelbst = () => /\b(friday|freitag)\b/.test(norm(gesagtText));
  // Hört das Mikrofon Fridays eigene Stimme aus dem Lautsprecher? (gleiche Wörter wie ihr Satz)
  function istEcho(said) {
    if (!speaking && Date.now() - gesagtEnde > 2500) return false;
    const woerter = norm(said).split(" ").filter((w) => w.length > 2);
    if (woerter.length <= 1) return false;
    const menge = new Set(norm(gesagtText).split(" "));
    return woerter.filter((w) => menge.has(w)).length / woerter.length >= 0.6;
  }

  // v1.122.5 iPhone: Läuft das Mikrofon, während Friday spricht, wird Safari stumm oder bricht ab
  // (Kevins Video: erster Satz hörbar, danach Stille). Darum auf dem iPhone: Mikrofon aus, kurz warten,
  // dann sprechen; erst wenn sie fertig ist (oder gestoppt wurde), wieder zuhören. "Friday, stopp" geht
  // dort in den Pausen zwischen den Sätzen, oder per Tipp auf Fridays Kopf.
  let stimmPause = false, stimmBesitzer = 0;
  function ohrVorStimme(nr) {
    if (!IST_IOS) return false;
    stimmBesitzer = nr;
    const warAn = ohr.laeuft || Date.now() - ohr.gestoppt < 500;
    clearTimeout(ohr.timer);
    stimmPause = true;
    ohrStopp();
    return warAn;
  }
  function ohrNachStimme(nr) {
    // Nur die neueste Ansage gibt das Mikrofon wieder frei (sonst springt es mitten in der nächsten an).
    if (!stimmPause || nr !== stimmBesitzer) return;
    stimmPause = false;
    ohrSpaeter(450);
  }

  function ohrDarf() {
    return wakeActive && !stimmPause && !ohr.brauchtTipp && !callActive && !window.Friday?.mikroBelegt
      && document.visibilityState !== "hidden";
  }
  function zeigeRuhe() {
    if (busy || speaking || ohr.modus === "befehl") return;
    if (ohr.brauchtTipp && ohr.sperrText && ohr.verweigert >= 2) setState(ohr.sperrText);
    else if (ohr.brauchtTipp) setState('Einmal tippen, dann höre ich auf "Friday"');
    else setState(wakeActive && Recognition ? 'Höre auf "Friday"' : "Bereit, Boss.");
  }

  function ohrSpaeter(ms) {
    clearTimeout(ohr.timer);
    ohr.timer = setTimeout(ohrStart, ms);
  }
  function ohrStart() {
    clearTimeout(ohr.timer);
    if (!Recognition || ohr.laeuft || !ohrDarf()) return;
    // iPhone: direkt nach dem Ausschalten ist das Mikrofon noch belegt.
    const pause = (IST_IOS ? 450 : 150) - (Date.now() - ohr.gestoppt);
    if (pause > 0) { ohrSpaeter(pause); return; }
    let rec;
    try { rec = new Recognition(); } catch { ohrSpaeter(2000); return; }
    rec.lang = "de-DE";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    ohr.rec = rec; ohr.laeuft = true; ohr.gestartet = ohr.lebenszeichen = Date.now();
    ohrRundeNeu();
    rec.onstart = () => { if (ohr.rec === rec) { ohr.lebenszeichen = Date.now(); ohr.verweigert = 0; diag.schritt(ohr.modus === "befehl" ? "Mikrofon an, warte auf Befehl" : "Mikrofon an, warte auf „Friday“"); zeigeRuhe(); } };
    rec.onresult = (e) => {
      if (ohr.rec !== rec) return;
      ohr.lebenszeichen = Date.now();
      ohr.kaputt = 0;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = String(r[0]?.transcript || "").trim();
        clearTimeout(ohr.stabil.get(i));
        // v1.122.2: Safari auf dem iPhone meldet im Dauer-Zuhören oft NIE "fertig" (isFinal) und hängt
        // alles Gesagte an denselben Satz an. Darum: Ändert sich ein Zwischenstand eine Weile nicht mehr,
        // gilt er als fertig. Schon verarbeitete Teile werden übersprungen.
        // v1.122.6: Ein Befehl nach "Friday" bekommt mehr Zeit (kurze Denkpause mitten im Satz schneidet sonst ab).
        if (!r.isFinal) ohr.stabil.set(i, setTimeout(() => { if (ohr.rec === rec) { try { hoeren(text, true, i); } catch { /* egal */ } } }, stabilMs(text, i)));
        try { hoeren(text, r.isFinal, i); } catch { /* ein Satz darf das Ohr nie anhalten */ }
      }
    };
    rec.onerror = (e) => {
      if (ohr.rec !== rec) return;
      const f = e?.error || "";
      if (f && f !== "no-speech" && f !== "aborted") diag.schritt(`Mikrofon-Fehler: ${f}${f === "not-allowed" ? " (einmal tippen oder Mikrofon erlauben)" : ""}`, "bad");
      // v1.122.7: "audio-capture" = Safari bekommt das Mikrofon nicht (Ton-Wiedergabe, Anruf, Siri,
      // andere App). Wiedergabe freigeben, länger warten; klappt es zweimal nicht, per Tipp neu starten.
      if (f === "audio-capture") {
        ohr.kaputt = (ohr.kaputt || 0) + 1;
        if (!speaking) audioFreigeben();
        if (ohr.kaputt >= 2 && IST_IOS) {
          ohr.brauchtTipp = true;
          ohr.sperrText = "Mikrofon blockiert: einmal auf den Bildschirm tippen";
          ohr.verweigert = 2;
          befehlEnde(); zeigeRuhe();
          diag.schritt("Mikrofon ist blockiert. Einmal tippen, dann starte ich es neu. Hilft das nicht: App ganz schließen und neu öffnen.", "warn");
        }
      }
      if (f === "not-allowed" || f === "service-not-allowed") {
        ohr.brauchtTipp = true;
        ohr.verweigert = (ohr.verweigert || 0) + 1;
        zeigeRuhe();
        // Home-Bildschirm-App auf dem iPhone: Manche iOS-Versionen erlauben dort gar keine Spracherkennung.
        const app = window.navigator.standalone || window.matchMedia?.("(display-mode: standalone)").matches;
        if (ohr.verweigert >= 2 && IST_IOS) {
          ohr.sperrText = (app ? "Mikrofon gesperrt: Einstellungen → Safari → Mikrofon „Erlauben“, oder Friday in Safari öffnen"
            : "Mikrofon gesperrt: aA in der Adressleiste → Website-Einstellungen → Mikrofon „Erlauben“");
          setState(ohr.sperrText);
        }
      }
      // Safari schickt nach einem Fehler manchmal kein Ende-Signal mehr: dann selbst beenden.
      setTimeout(() => { if (ohr.rec === rec) ohrEnde(rec); }, 1200);
    };
    rec.onend = () => ohrEnde(rec);
    try { rec.start(); } catch { ohr.rec = null; ohr.laeuft = false; ohr.gestoppt = Date.now(); ohrSpaeter(1000); return; }
    zeigeRuhe();
  }
  function ohrEnde(rec) {
    if (ohr.rec !== rec) return;
    ohr.rec = null; ohr.laeuft = false; ohr.gestoppt = Date.now();
    if (!ohrDarf()) { zeigeRuhe(); return; }
    ohr.schnell = Date.now() - ohr.gestartet < 1500 ? Math.min(ohr.schnell + 1, 5) : 0;
    let ms = ohr.schnell ? 400 * 2 ** ohr.schnell : 250;
    if (ohr.kaputt) ms = Math.max(ms, 1500); // Mikrofon war belegt: etwas länger warten
    // iPhone: Ein Mikrofon-Neustart schneidet Friday kurz das Wort ab (say() spricht danach an der Stelle weiter).
    if (speaking && IST_IOS) ms = Math.max(ms, 1500);
    ohrSpaeter(ms);
  }
  function stabilMs(text, i) {
    const rest = String(text || "").slice(ohr.verbraucht.get(i) || 0);
    const m = rest.match(WAKE_WORT);
    const nachWort = m ? rest.slice(m.index + m[0].length).trim() : rest.trim();
    const befehl = ohr.modus === "befehl" || (m && nachWort.length > 1);
    if (!befehl) return IST_IOS ? 1200 : 1500;
    return IST_IOS ? 1800 : 2000;
  }
  function ohrRundeNeu() {
    for (const t of ohr.stabil?.values?.() || []) clearTimeout(t);
    ohr.verbraucht = new Map(); ohr.verstummt = new Set(); ohr.stabil = new Map();
  }
  function ohrStopp() {
    clearTimeout(ohr.timer);
    const r = ohr.rec;
    ohr.rec = null;
    if (ohr.laeuft) ohr.gestoppt = Date.now();
    ohr.laeuft = false;
    if (r) { r.onend = null; r.onresult = null; r.onerror = null; try { r.abort(); } catch { /* egal */ } }
  }

  // Befehl-Modus: der nächste Satz zählt auch ohne "Friday" (nach "Friday" allein, nach einer Frage von Friday).
  function befehlModus({ folge = false, frage = false } = {}) {
    clearTimeout(ohr.befehlTimer);
    if (window.FridayHoeren?.soll()) { whisperBefehl({ folge, frage }); return; }
    ohr.modus = "befehl";
    ohr.befehl = { folge, frage };
    document.body.classList.toggle("gespraech", folge);
    setState(folge ? "Ich höre weiter …" : "Ich höre", "listening");
    befehlZeit(frage ? 12000 : befehlMs());
  }
  // Wie lange der Befehl-Modus auf den nächsten Satz wartet. Im langen Gespräch: die eingestellte Zeit.
  function befehlMs() {
    const d = ohr.befehl.folge && !ohr.befehl.frage ? gespraechDauer() : 0;
    return d > 0 ? d * 1000 : ohr.befehl.frage ? 12000 : 8000;
  }
  function befehlZeit(ms) {
    clearTimeout(ohr.befehlTimer);
    ohr.befehlBis = Date.now() + ms;
    ohr.befehlTimer = setTimeout(befehlEnde, ms);
    gespraechPille();
  }
  // Sichtbare Restzeit unten: „Ich höre weiter · 24 s · „Danke“ beendet“
  let pille = null, pilleTimer = null;
  function gespraechPille() {
    const an = ohr.modus === "befehl" && ohr.befehl.folge && !ohr.befehl.frage && gespraechDauer() > 0;
    if (!an) { if (pille) pille.hidden = true; clearInterval(pilleTimer); pilleTimer = null; return; }
    if (!pille) {
      pille = document.createElement("div");
      pille.id = "gespraech-pille";
      pille.setAttribute("role", "status");
      pille.innerHTML = '<span class="gp-punkt" aria-hidden="true"></span><span class="gp-text">Ich höre weiter</span><b class="gp-zeit"></b><span class="gp-tipp">„Danke“ beendet</span><button type="button" class="gp-x" aria-label="Gespräch beenden">✕</button><i class="gp-balken" aria-hidden="true"></i>';
      pille.querySelector(".gp-x").addEventListener("click", () => { befehlEnde(); });
      document.body.appendChild(pille);
    }
    pille.hidden = false;
    const gesamt = Math.max(1000, ohr.befehlBis - Date.now());
    const tick = () => {
      const rest = Math.max(0, ohr.befehlBis - Date.now());
      if (ohr.modus !== "befehl" || !rest) { gespraechPille(); return; }
      pille.querySelector(".gp-zeit").textContent = `${Math.ceil(rest / 1000)} s`;
      pille.querySelector(".gp-balken").style.width = `${Math.min(100, (rest / gesamt) * 100)}%`;
    };
    tick();
    clearInterval(pilleTimer);
    pilleTimer = setInterval(tick, 250);
  }
  // v1.134.0 Whisper (hoeren.js): Befehl aufnehmen und auf dem Mac verstehen lassen.
  async function whisperBefehl({ folge = false, frage = false } = {}) {
    ohr.modus = "befehl";
    ohr.befehl = { folge, frage, whisper: true };
    document.body.classList.toggle("gespraech", folge);
    ohrStopp();
    if (speaking) stilleJetzt();
    setState(folge ? "Ich höre weiter (Whisper) …" : "Ich höre (Whisper) …", "listening");
    const lang = folge && !frage ? gespraechDauer() : 0;
    if (lang) { ohr.befehlBis = Date.now() + lang * 1000; gespraechPille(); }
    const r = await window.FridayHoeren.aufnehmen({ maxMs: lang ? lang * 1000 + 15000 : frage ? 14000 : 10000, wartenMs: lang ? lang * 1000 : frage ? 8000 : 6000 });
    if (ohr.modus !== "befehl" || !ohr.befehl.whisper) return; // inzwischen gestoppt
    ohr.modus = "warten";
    ohr.befehl = {};
    document.body.classList.remove("gespraech");
    gespraechPille();
    ohrSpaeter(600);
    if (r.error) { diag.schritt(`Whisper: ${r.error}`, "warn"); setState(r.error); setTimeout(zeigeRuhe, 4000); return; }
    const said = String(r.text || "").trim();
    if (!said) { zeigeRuhe(); return; }
    diag.schritt(`Gehört (Whisper): „${said.slice(0, 80)}“`);
    const m = said.match(WAKE);
    const cmd = m && m.index < 3 ? nachWeckwort(said, m) : said.replace(/^[,.!\s]+/, "").trim();
    if (folge && !frage && GESPRAECH_ENDE.test(cmd)) {
      addMessage("user", said);
      say(["Gern, Boss.", "Jederzeit, Boss.", "Alles klar, Boss."][Math.floor(Math.random() * 3)]);
      return;
    }
    if (cmd.length < 2) { zeigeRuhe(); return; }
    ausfuehren(cmd);
  }
  function befehlEnde() {
    clearTimeout(ohr.befehlTimer);
    if (ohr.modus !== "befehl") return;
    if (ohr.befehl.whisper) window.FridayHoeren?.abbrechen();
    ohr.modus = "warten";
    ohr.befehl = {};
    document.body.classList.remove("gespraech");
    gespraechPille();
    zeigeRuhe();
  }
  function stilleJetzt() {
    window.Friday.stopSpeaking?.();
    bargeZeit = Date.now();
  }

  // Text nach dem Weckwort; "Friday, Friday, stopp" → "stopp".
  function nachWeckwort(said, m) {
    let rest = said.slice(m.index + m[0].length).replace(/^[,.!?\s]+/, "");
    for (let k = 0; k < 3; k++) {
      const w = rest.match(WAKE_WORT);
      if (!w || w.index > 0) break;
      rest = rest.slice(w[0].length).replace(/^[,.!?\s]+/, "");
    }
    return rest.trim();
  }

  // Ein erkannter Satz (Zwischenstand oder fertig). Nummer i: Satz in dieser Mikrofon-Runde.
  function hoeren(ganz, fertig, i) {
    // Nur den Teil nehmen, der noch nicht verarbeitet wurde (iPhone hängt alles an einen Satz an).
    const ab = ohr.verbraucht.get(i) || 0;
    const said = String(ganz || "").slice(ab).replace(/^[\s,.!?]+/, "").trim();
    if (!/[a-zäöüß0-9]/i.test(said)) return;
    const erledigt = () => ohr.verbraucht.set(i, String(ganz).length);
    const m = said.match(WAKE);
    // Befehl-Modus: der nächste fertige Satz zählt, auch ohne "Friday".
    if (ohr.modus === "befehl" && !busy) {
      if (!fertig) { befehlZeit(Math.max(8000, befehlMs())); return; }
      // Fridays eigene letzte Worte ("Ja, Boss?") aus dem Lautsprecher
      if (!m && (istEcho(said) || /^(ja|ja boss|ich hore|boss)$/.test(norm(said)))) { erledigt(); return; }
      if (speaking) stilleJetzt(); // Boss redet schon, während sie noch "Ja?" sagt
      erledigt();
      ohr.jaOffen = false;
      diag.schritt(`Gehört (Befehl): „${said.slice(0, 80)}“`);
      const { folge, frage } = ohr.befehl;
      befehlEnde();
      const cmd = m ? nachWeckwort(said, m) : said.replace(/^[,.!\s]+/, "").trim();
      if (folge && !frage && GESPRAECH_ENDE.test(cmd)) {
        addMessage("user", said);
        say(["Gern, Boss.", "Jederzeit, Boss.", "Alles klar, Boss."][Math.floor(Math.random() * 3)]);
        return;
      }
      if (!cmd && m) { ausfuehren(""); return; }
      ausfuehren(cmd);
      return;
    }
    // Sonst zählt nur, was mit "Friday" angesprochen wird. Nebengespräche, TV und Geräusche: ignorieren.
    if (!m) { if (fertig) erledigt(); return; }
    if (speaking) {
      if (!unterbrechenAn()) return;
      // Sagt Friday das Wort gerade selbst, erst den fertigen Satz abwarten (könnte ihr Echo sein).
      if (!fertig && sagtFridaySelbst()) return;
      if (sagtFridaySelbst() && istEcho(said)) { if (fertig) erledigt(); return; }
      if (!ohr.verstummt.has(i)) { ohr.verstummt.add(i); stilleJetzt(); setState("Ich höre", "listening"); }
    }
    if (!fertig) return;
    erledigt();
    diag.schritt(`Gehört: „${said.slice(0, 80)}“`);
    ausfuehren(nachWeckwort(said, m));
  }

  // Was nach "Friday" kam, ausführen.
  function ausfuehren(cmd) {
    cmd = String(cmd || "").trim();
    ohr.jaOffen = false;
    if (NUR_STOPP.test(cmd)) {
      diag.schritt(`Stopp erkannt („${cmd}“)`);
      stilleJetzt();
      if (busy) { auftragNr++; window.FridayAuftrag?.ende(false); }
      ohr.wartend = "";
      window.FridayWelttour?.stopp?.();
      try { window.dispatchEvent(new CustomEvent("friday-stopp")); } catch { /* egal */ }
      window.FridayRing?.melde?.("unterbrechen", null);
      befehlEnde();
      if (!busy) setState("Bereit, Boss.");
      setTimeout(zeigeRuhe, 1200);
      return;
    }
    if (cmd.length < 2) { // nur "Friday": kurz antworten und auf den Befehl warten
      // Mit Whisper erst nach dem "Ja?" aufnehmen (sonst nimmt sie ihre eigene Stimme auf).
      if (!window.FridayHoeren?.soll()) befehlModus({});
      // Solange sie "Ja?" sagt, läuft die Zeit nicht (die Stimme kann ein paar Sekunden brauchen).
      // Danach läuft das 8-Sekunden-Fenster für den Befehl neu.
      clearTimeout(ohr.befehlTimer);
      ohr.jaOffen = true;
      Promise.resolve(say(["Ja, Boss?", "Ja?", "Ich höre."][Math.floor(Math.random() * 3)], { hinweis: false }))
        .finally(() => { if (ohr.jaOffen) { ohr.jaOffen = false; befehlModus({}); } });
      return;
    }
    if (busy) { ohr.wartend = cmd; diag.schritt(`Wartet, bis die letzte Antwort fertig ist: „${cmd}“`, "warn"); setState("Kommt gleich dran …", "thinking"); return; }
    send(cmd, { stimme: true });
  }

  // Für andere Fenster und den Reaktor-Knopf: jetzt zuhören (ohne "Friday").
  function listenOnce(opts = {}) {
    if (window.FridayHoeren?.soll()) { befehlModus(opts); return; }
    if (!Recognition) {
      addMessage("friday", "Dein Browser kann keine Sprache erkennen. Nutze Safari oder Chrome, oder tipp unten.");
      return;
    }
    if (!wakeActive) { wakeActive = true; const t = $("wake-toggle"); if (t) t.checked = true; }
    ohr.brauchtTipp = false;
    befehlModus(opts);
    ohrStart();
  }
  window.Friday.zuhoeren = listenOnce;

  $("reactor").addEventListener("click", () => {
    if (window.FridayHoeren?.nimmtAuf()) { window.FridayHoeren.fertig(); return; } // Tipp = fertig gesprochen
    if (speaking) { stilleJetzt(); setTimeout(zeigeRuhe, 300); return; }
    listenOnce();
  });

  window.Friday.unterbrechen = { an: unterbrechenAn, aktiv: () => ohr.laeuft && speaking };
  // Für die Lernecke (lernen.js): eigenes Mikrofon, solange sie abfragt.
  window.Friday.wakePause = () => { befehlEnde(); ohrStopp(); };
  window.Friday.wakeWeiter = () => ohrSpaeter(300);
  window.Friday.ohrZustand = () => ({ laeuft: ohr.laeuft, modus: ohr.modus, speaking, busy, tipp: ohr.brauchtTipp });

  // Wächter: Ist das Ohr aus, obwohl es laufen dürfte, wieder anwerfen. Hängt es still (Chrome/Safari
  // melden manchmal nichts mehr), nach 2 Minuten ohne Lebenszeichen frisch starten.
  setInterval(() => {
    if (!ohrDarf()) return;
    if (!ohr.laeuft) { ohrStart(); return; }
    if (!speaking && !busy && ohr.modus === "warten" && Date.now() - ohr.lebenszeichen > 120000) { ohrStopp(); ohrSpaeter(300); }
  }, 5000);
  storage.remove("friday_wake"); // alter, nie gelesener Wert

  $("wake-toggle").checked = true;
  $("wake-toggle").addEventListener("change", (e) => {
    wakeActive = e.target.checked && !!Recognition;
    if (wakeActive) { ohr.brauchtTipp = false; ohrStart(); }
    else { befehlEnde(); ohrStopp(); setState("Bereit, Boss."); }
  });

  // iPhone/Safari: Mikrofon darf oft erst nach einem Tipp starten – dann direkt beim Tipp anwerfen.
  const ohrNachTipp = () => {
    if (!wakeActive) return;
    if (ohr.kaputt >= 2) { ohr.kaputt = 0; ohr.verweigert = 0; ohr.sperrText = ""; ohrStopp(); }
    if (!ohr.laeuft) { ohr.brauchtTipp = false; ohrStart(); }
  };
  document.addEventListener("pointerdown", ohrNachTipp, true);
  document.addEventListener("keydown", ohrNachTipp, true);

  // v1.122.3: Ton freischalten. Das iPhone spielt Stimme und Audio nur ab, wenn das erste Abspielen
  // durch einen Fingertipp ausgelöst wurde. Ein Sprachbefehl zählt dafür nicht, darum blieb Friday dort
  // stumm. Beim ersten Tipp (egal wo) spielen wir einmal "Stille" ab, danach darf sie jederzeit reden.
  const STILLE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
  let tonFrei = false;
  function tonFreischalten() {
    if (tonFrei || speaking) return;
    tonFrei = true;
    // v1.122.7: Auf dem iPhone darf dabei das Mikrofon nicht laufen, sonst bekommt Safari es danach
    // nicht mehr ("audio-capture", Friday hört nichts). Also: Mikro kurz aus, Stille abspielen,
    // Audio wieder freigeben, Mikro neu starten.
    if (IST_IOS) { clearTimeout(ohr.timer); stimmPause = true; ohrStopp(); diag.schritt("Ton wird freigeschaltet (Mikro kurz aus)"); }
    const fertig = () => {
      if (!IST_IOS) return;
      try { if (audio.src === STILLE || audio.src.startsWith("data:")) { audio.pause(); audio.removeAttribute("src"); audio.load(); } } catch { /* egal */ }
      if (!speaking) { stimmPause = false; ohrSpaeter(700); }
    };
    setTimeout(fertig, 900);
    try {
      if ("speechSynthesis" in window && !speechSynthesis.speaking) {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        speechSynthesis.speak(u);
      }
    } catch { /* egal */ }
    // v1.123.0: Ohne ElevenLabs braucht es kein Audio-Element mehr, nur die Gerätestimme.
  }
  window.Friday.tonFrei = () => tonFrei;
  for (const ev of ["touchend", "click", "keydown"]) document.addEventListener(ev, tonFreischalten, true);
  // iPhone: Nach dem Abspielen über das Audio-Element die Wiedergabe ganz freigeben,
  // damit das Mikrofon danach wieder aufnehmen darf.
  function audioFreigeben() {
    if (!IST_IOS) return;
    try { audio.pause(); audio.removeAttribute("src"); audio.load(); } catch { /* egal */ }
  }
  // App im Hintergrund: Mikrofon aus. Wieder vorne: neu starten.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { ohr.brauchtTipp = false; ohrSpaeter(400); }
    else { befehlEnde(); ohrStopp(); }
  });
  window.addEventListener("pageshow", () => ohrSpaeter(400));
  setTimeout(ohrStart, 800);

  // ---------- Friday anrufen (freihändiges Gespräch: zuhören ↔ antworten) ----------
  let callActive = false, callRec = null, callMuted = false, callVoicePrev = null;
  const callStatus = (t) => { const e = $("call-status"); if (e) e.textContent = t; };
  const callOrb = (state) => { const o = $("call-orb"); if (o) o.className = "call-orb" + (state ? " " + state : ""); };
  const callText = (t) => { const e = $("call-transcript"); if (e) e.textContent = t; };

  function openCall() {
    if (!Recognition) { addMessage("friday", "Für den Anruf brauche ich Spracherkennung – nutze Chrome/Safari oder die App."); return; }
    if (callActive) return;
    callActive = true; callMuted = false;
    $("call")?.classList.remove("hidden");
    $("call-mute")?.classList.remove("off");
    callText("");
    const vt = $("voice-toggle"); callVoicePrev = vt ? vt.checked : null; if (vt) vt.checked = true; // Vorlesen fürs Gespräch an
    befehlEnde(); ohrStopp();
    callOrb("listening"); callStatus("Verbunden – ich höre");
    setTimeout(callListen, IST_IOS ? 450 : 50); // iPhone: erst das Friday-Ohr ganz ausgehen lassen
  }

  function closeCall() {
    callActive = false;
    if (callRec) { try { callRec.abort(); } catch { /* egal */ } callRec = null; }
    try { speechSynthesis?.cancel(); } catch { /* egal */ }
    try { audio.pause(); } catch { /* egal */ }
    $("call")?.classList.add("hidden");
    const vt = $("voice-toggle"); if (vt && callVoicePrev !== null) vt.checked = callVoicePrev;
    if (!busy && !speaking) zeigeRuhe();
    ohrSpaeter(IST_IOS ? 500 : 250);
  }

  function callListen() {
    if (!callActive || callMuted || speaking || busy) return;
    const rec = new Recognition();
    rec.lang = "de-DE"; rec.interimResults = true; rec.maxAlternatives = 1;
    callRec = rec;
    callOrb("listening"); callStatus("Ich höre…");
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      callText((finalText + " " + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        addMessage("friday", "Ich brauche die Mikrofon-Erlaubnis für den Anruf.");
        closeCall();
      }
    };
    rec.onend = async () => {
      callRec = null;
      if (!callActive) return;
      const text = finalText.trim();
      if (!text) { if (callActive && !callMuted) setTimeout(callListen, 250); return; } // nichts gehört → weiter zuhören
      callOrb("speaking"); callStatus("Friday antwortet…"); callText(text);
      try { await send(text); } catch { /* Fehler zeigt send selbst */ }
      if (callActive) { callText(""); callListen(); }
    };
    try { rec.start(); } catch { setTimeout(() => { if (callActive) callListen(); }, 400); }
  }

  $("call-btn")?.addEventListener("click", openCall);
  $("call-hang")?.addEventListener("click", closeCall);
  $("call-mute")?.addEventListener("click", () => {
    callMuted = !callMuted;
    $("call-mute")?.classList.toggle("off", callMuted);
    if (callMuted) { callStatus("Stumm – tipp aufs Mikro zum Weitersprechen"); callOrb(""); if (callRec) { try { callRec.abort(); } catch { /* egal */ } } }
    else { callStatus("Ich höre…"); callListen(); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && callActive) closeCall(); });

  // ---------- Start ----------
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  if (token) showApp();
  else showLogin();
})();
