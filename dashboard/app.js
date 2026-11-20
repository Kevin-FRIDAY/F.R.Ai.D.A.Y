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
      setBadge("st-voice", status.voice && !status.voiceHinweis, "ElevenLabs", status.voice ? "Gerät (ElevenLabs-Pause)" : "Gerät");
      if ($("st-voice")) $("st-voice").title = status.voiceHinweis || "";
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
  function pickVoice() {
    const all = speechSynthesis.getVoices();
    const saved = storage.get("friday_voice");
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
  async function stimmeHolen(t) {
    const res = await api("/api/tts", { method: "POST", body: JSON.stringify({ text: t }) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.grund || j.error || `ElevenLabs antwortet nicht (Fehler ${res.status}), deshalb spreche ich mit der Gerätestimme.`);
    }
    return URL.createObjectURL(await res.blob());
  }

  // Wenn ElevenLabs nicht spricht: kleines Schild unten rechts und einmal hörbar sagen, warum.
  // v1.98.0: höchstens einmal pro Tag (gleicher Grund), mit "Nicht mehr zeigen".
  const HINWEIS_AUS = "friday_stimmhinweis_aus";
  const HINWEIS_TAG = "friday_stimmhinweis_tag";
  const lies = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const schreib = (k, v) => { try { localStorage.setItem(k, v); } catch { /* egal */ } };
  function stimmHinweis(grund) {
    if (!grund) return false;
    const b = $("st-voice");
    if (b) { b.textContent = "Gerät (ElevenLabs-Pause)"; b.title = grund; }
    if (lies(HINWEIS_AUS) === "1") return false;
    const art = grund.split(/[.,]/)[0]; // nur der Kern zählt (Datum o. ä. kann sich ändern)
    const heute = new Date().toISOString().slice(0, 10);
    const merk = `${heute}|${art}`;
    if (lies(HINWEIS_TAG) === merk) return false;
    schreib(HINWEIS_TAG, merk);
    let el = document.getElementById("stimm-hinweis");
    if (!el) {
      el = document.createElement("div");
      el.id = "stimm-hinweis";
      el.setAttribute("role", "status");
      el.innerHTML = '<b>🔊 Gerätestimme statt ElevenLabs</b><button type="button" class="sh-x" aria-label="Schließen">✕</button><span></span><button type="button" class="sh-nie">Nicht mehr zeigen</button>';
      el.querySelector(".sh-x").onclick = () => el.classList.remove("an");
      el.querySelector(".sh-nie").onclick = () => { schreib(HINWEIS_AUS, "1"); el.classList.remove("an"); };
      document.body.appendChild(el);
    }
    el.querySelector("span").textContent = grund;
    el.classList.add("an");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("an"), 12000);
    return true;
  }
  window.Friday = window.Friday || {};
  window.Friday.stimmHinweis = stimmHinweis;

  // v1.121.1: Friday redet nicht von allein. Meldungen, die keiner bestellt hat (Timer, Erinnerung,
  // Energie, "Video fertig"), erscheinen still am Status-Ring statt vorgelesen zu werden.
  // Einschalten: Einstellungen → Assistent → "Friday darf von sich aus sprechen".
  const vonSelbstAn = () => storage.get("friday_vonselbst") === "1";
  window.Friday.sagVonSelbst = (text, { quelle = "hinweis", stufe = "warn", dauer = 10 * 60000 } = {}) => {
    if (!text) return;
    if (vonSelbstAn()) return say(text);
    try { window.FridayRing?.melde?.(quelle, stufe, text, dauer); } catch { /* egal */ }
  };

  async function say(text) {
    if (!$("voice-toggle").checked || !text) return;
    const nr = ++sprechNr;
    speaking = true;
    hueSprechen(true);
    pauseWake();
    setState("Spricht", "speaking");
    startBarge(text, nr);
    try {
      if (status.voice) {
        const teile = text.length > 160 ? haeppchen(text) : [text];
        let naechstes = stimmeHolen(teile[0]);
        let ok = false;
        for (let i = 0; i < teile.length; i++) {
          let url;
          try { url = await naechstes; } catch (e) { if (!ok && stimmHinweis(e?.message) && !text.includes(e.message)) text = `Kurzer Hinweis: ${e.message} ${text}`; break; }
          if (nr !== sprechNr) { URL.revokeObjectURL(url); return; }
          if (i + 1 < teile.length) { naechstes = stimmeHolen(teile[i + 1]); naechstes.catch(() => {}); }
          audio.src = url;
          audio.volume = Math.min(1, Math.max(0.05, Number(storage.get("friday_lautstaerke")) || 1));
          window.FridayFace?.talkWithAudio(audio);
          try { await audio.play(); } catch (e) {
            URL.revokeObjectURL(url);
            if (nr !== sprechNr) return;
            if (!ok) {
              const grund = "Der Browser hat die ElevenLabs-Wiedergabe blockiert. Tipp einmal auf den Bildschirm, dann klappt es wieder.";
              if (stimmHinweis(grund)) text = `Kurzer Hinweis: ${grund} ${text}`;
            }
            break;
          }
          ok = true;
          for (let weiter = 0; ; weiter++) {
            await new Promise((r) => { audio.onended = r; audio.onerror = r; audio.onpause = r; });
            // iPhone: Ein Geräusch lässt das Mikrofon anspringen und iOS pausiert die Wiedergabe.
            // Hat niemand gestoppt (sprechNr gleich), einfach weiterspielen.
            if (nr !== sprechNr || audio.ended || !audio.paused || weiter >= 4) break;
            await new Promise((r) => setTimeout(r, 200));
            if (nr !== sprechNr) break;
            try { await audio.play(); } catch { break; }
          }
          URL.revokeObjectURL(url);
          if (nr !== sprechNr || (audio.paused && !audio.ended)) return; // gestoppt
        }
        if (ok) return;
      }
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
            const waechter = setTimeout(() => { zeitUm = true; ende(); }, Math.min(90000, 4000 + teil.split(/\s+/).length * 550));
            let still = 0;
            const pruef = setInterval(() => {
              try { still = (speechSynthesis.speaking || speechSynthesis.pending) ? 0 : still + 1; } catch { still++; }
              if (still >= 3) ende();
            }, 1000);
            u.onend = ende;
            u.onerror = (e) => { fehler = e?.error || "fehler"; ende(); };
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
      if (!bargeFang && bargeNr === nr) stopBarge();
      setState(bargeFang ? "Ich höre" : "Bereit, Boss.", bargeFang ? "listening" : undefined);
      resumeWake();
    }
  }

  // ---------- Senden ----------
  async function send(text, opts = {}) {
    text = (text || "").trim();
    if ((!text && !pendingImage) || busy) return;
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
    if (gespraechRec) { try { gespraechRec.abort(); } catch { /* egal */ } } // getippt statt gesprochen
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
    try {
      const res = await api("/api/chat", { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      // Lernecke: Begrüßung macht das Fenster selbst (es weiß, ob Carla oder Kevin da ist), darum hier ohne Text.
      const stillLernen = !data.answer && !data.error && data.actions?.some((a) => typeof a === "string" && a.startsWith("lernen"));
      // v1.121.2: Nur Aktionen ohne Text (z. B. Welt-Runde) → nichts sagen, statt "Keine Antwort." vorzulesen.
      const nurAktion = !data.answer && !data.error && data.actions?.length > 0;
      let answer = data.answer || data.error || (stillLernen || nurAktion ? "" : "Keine Antwort.");
      const hat = (a) => data.actions?.includes(a);
      window.FridayAuftrag?.ende(res.ok && !data.error);
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
      if (hat("archiv")) window.FridayArchiv?.open();
      if (hat("oekosystem")) window.FridayOekosystem?.open();
      // Routen & Verbindungen: Karte mit Auto, Rad, zu Fuß und Bahn/Bus zeigen.
      const routeAktion = data.actions?.find((a) => typeof a === "string" && a.startsWith("route:"));
      const routeZiel = data.actions?.find((a) => typeof a === "string" && a.startsWith("route_ziel:"));
      if (routeAktion) window.FridayRouten?.zeige(routeAktion.slice(6));
      else if (hat("route_planen")) window.FridayRouten?.neueste();
      else if (routeZiel) window.FridayRouten?.open({ ziel: decodeURIComponent(routeZiel.slice(11)) });
      else if (hat("routen")) window.FridayRouten?.open();
      // Helfer-Paket (v1.106.0): Kühlschrank, Kaufberater, Advocatus Diaboli, Ideen-Schmiede, Stimmungs-Sound.
      const aktion = (p) => data.actions?.find((a) => typeof a === "string" && a.startsWith(p));
      if (hat("kuehlschrank")) window.FridayKuehl?.open({ tab: hat("kuehlschrank:rezepte") ? "rezepte" : "vorrat" });
      else window.FridayKuehl?.refresh();
      const kaufA = aktion("kauf:");
      if (kaufA) window.FridayKauf?.open({ id: kaufA.slice(5) });
      else if (hat("kaufberater")) window.FridayKauf?.open();
      const gegenA = aktion("gegenrede:");
      if (gegenA) window.FridayGegen?.open({ id: gegenA.slice(10) });
      else if (hat("gegenrede")) window.FridayGegen?.open();
      const ideeA = aktion("idee:");
      if (ideeA) { try { window.FridayIdeen?.open({ wurf: JSON.parse(decodeURIComponent(ideeA.slice(5))) }); } catch { window.FridayIdeen?.open(); } }
      else if (hat("ideen")) window.FridayIdeen?.open();
      const klangA = aktion("klang:");
      if (klangA === "klang:aus") window.FridayKlang?.aus();
      else if (klangA === "klang:auto") { window.FridayKlang?.auto(true); window.FridayKlang?.open(); }
      else if (klangA) window.FridayKlang?.spiele(klangA.slice(6));
      else if (hat("klang")) window.FridayKlang?.open();
      // Spiele-Werkstatt: live zuschauen, wie Friday programmiert, oder ein gespeichertes Spiel starten.
      const spielBau = data.actions?.find((a) => typeof a === "string" && a.startsWith("spiel_bauen:"));
      const spielStart = data.actions?.find((a) => typeof a === "string" && a.startsWith("spiel:"));
      if (spielBau) window.FridaySpiele?.verfolge(spielBau.slice(12));
      else if (hat("spiel_bauen")) window.FridaySpiele?.neuester();
      else if (spielStart) window.FridaySpiele?.spiel(spielStart.slice(6));
      else if (hat("spiele")) window.FridaySpiele?.open();
      const zentraleAktion = data.actions?.find((a) => typeof a === "string" && a.startsWith("zentrale:"));
      if (zentraleAktion) window.FridayZentrale?.open(zentraleAktion.slice(9));
      else window.FridayZentrale?.refresh();
      const logbuchAktion = data.actions?.find((a) => typeof a === "string" && a.startsWith("logbuch:"));
      if (logbuchAktion) window.FridayLogbuch?.open(logbuchAktion.slice(8));
      else window.FridayLogbuch?.refresh();
      window.FridayEnergie?.refresh();
      window.FridayRing?.melde("auftrag", null);
      await say(answer);
      clearSpeaking();
      // Carlas Lernecke (v1.108.0): erst begrüßen bzw. ansagen, dann öffnet sich die Lernecke und hört selbst zu.
      const lernA = aktion("lernen");
      if (lernA) window.FridayLernen?.open({ modus: lernA.split(":")[1] || "start", suche: lernA.split(":").slice(2).join(" "), stimme: Boolean(opts.stimme) });
      // Friday hat eine Frage gestellt ("Welches Land?"): gleich zuhören, ohne Knopfdruck.
      // Gesprächsmodus: Kam der Befehl per Stimme, hört Friday danach weiter zu, ohne "Friday" davor.
      const weiter = !bargeFang && !unterbrochenEben() && !lernA && !window.FridayLernen?.offen() && (hat("zuhoeren") || (opts.stimme && gespraechAn() && data.answer));
      if (weiter && Recognition && !callActive && !window.FridayDokumente?.offen()) {
        setTimeout(() => { if (!busy && !speaking) listenOnce({ folge: true, frage: hat("zuhoeren") }); }, 250);
      }
    } catch (err) {
      window.FridayAuftrag?.ende(false);
      addMessage("friday", `Verbindung gestört: ${err.message}`);
      setState("Fehler", "");
      window.FridayRing?.melde("auftrag", "bad", "Auftrag fehlgeschlagen: Verbindung gestört", 2 * 60000);
    } finally {
      busy = false;
      if (!speaking) setState("Bereit, Boss.");
      resumeWake();
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
  bindFlag("set-unterbrechen", "friday_unterbrechen", true);
  bindFlag("set-vonselbst", "friday_vonselbst", false);
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
    const aktiv = germanVoice ? stimmKey(germanVoice) : "";
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
      return `<optgroup label="${escapeHtml(titel)}">${liste.map(option).join("")}</optgroup>`;
    }).join("");
    const info = $("voice-info");
    if (info) {
      const de = gruppen.get("de") || [];
      const gut = de.filter((v) => stimmArt(v).rang >= 2).length;
      info.innerHTML = voices.length
        ? `${voices.length} Stimmen auf diesem Gerät, davon <b>${de.length} auf Deutsch</b>${gut ? ` (${gut} in Premium/Erweitert ★)` : " – noch keine Premium-Stimme geladen"}.`
        : "Dieses Gerät meldet noch keine Stimmen. Tippe auf „Liste neu laden“.";
    }
  }
  if ("speechSynthesis" in window) { fillVoices(); speechSynthesis.addEventListener?.("voiceschanged", fillVoices); }
  $("voice-reload")?.addEventListener("click", () => { fillVoices(); setTimeout(fillVoices, 600); });
  // Gerätestimme kurz probehören (auch wenn ElevenLabs die Hauptstimme ist).
  function probeGeraet() {
    if (!("speechSynthesis" in window) || !germanVoice) return;
    try {
      speechSynthesis.cancel();
      const de = /^de/i.test(germanVoice.lang);
      const u = new SpeechSynthesisUtterance(de ? `Hallo ${status.name || "Boss"}, ich bin ${stimmName(germanVoice)}.` : `Hello, I am ${stimmName(germanVoice)}.`);
      u.voice = germanVoice; u.lang = germanVoice.lang;
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
  const W_ICON = { gespraech: "💬", aktion: "⚡", gedaechtnis: "🧠", aufgabe: "✅", erinnerung: "⏰", einkauf: "🛒", dokument: "📄" };
  const W_NAME = { gespraech: "Gespräche", aktion: "Aktionen", gedaechtnis: "Gemerkt", aufgabe: "Aufgaben", erinnerung: "Erinnerungen", einkauf: "Einkauf", dokument: "Dokumente" };
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
    }
    return `<div class="wissen-e${e.erledigt ? " erledigt" : ""}"><span class="ico">${W_ICON[e.typ] || "•"}</span><div><div class="frage">${haupt}</div>${neben}</div><span class="zeit">${zeit}</span></div>`;
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
      const st = d.stats || {};
      const seit = st.seit ? new Date(st.seit).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–";
      $("wissen-stats").innerHTML = `<div class="wissen-stat"><b>${st.gesamt || 0}</b><small>Einträge gesamt</small></div>`
        + ["gespraech", "aktion", "gedaechtnis"].map((t) => `<div class="wissen-stat"><b>${st[t] || 0}</b><small>${W_NAME[t]}</small></div>`).join("")
        + `<div class="wissen-stat"><b style="font-size:15px">${seit}</b><small>Erster Eintrag</small></div>`;
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
  $("wissen-liste")?.addEventListener("click", (e) => {
    const dok = e.target.closest("[data-dok]");
    if (dok) { window.FridayDokumente?.oeffne(dok.dataset.dok); return; }
    const a = e.target.closest(".antwort"); if (a) a.classList.toggle("offen");
  });
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

  // ---------- Spracherkennung ----------
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  // v1.118.1: Friday reagiert NUR, wenn sie angesprochen wird.
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
  let wakeRec = null;
  let wakeActive = false;

  // Gesprächsmodus (Standard an): Nach einer gesprochenen Antwort hört Friday weiter zu.
  // v1.118.1: Standard AUS. Sonst schickt Friday nach jeder Antwort auch das Gespräch mit anderen
  // (z. B. mit deiner Frau) an sich selbst und redet dazwischen. Einschalten: Einstellungen → Assistent.
  const gespraechAn = () => storage.get("friday_gespraech") === "1";
  // Damit endet das Gespräch, ohne dass es an Friday geschickt wird.
  const GESPRAECH_ENDE = /^(?:(?:ok(?:ay)?|gut|alles klar|super|perfekt)[ ,.!]*)?(?:danke(?: dir| schön| schoen| sehr)?|das wars?|das war's|das war es|das reicht|reicht|fertig|stopp?|ende|schluss|tschüss|tschuess|bis später|bis spaeter|nichts mehr|nein danke)(?: friday| boss)?[ .!]*$/i;
  let gespraechRec = null;

  // v1.121.5: Auf dem iPhone darf immer nur EIN Mikrofon laufen. Startet das Zuhören, bevor das
  // "Friday"-Ohr ganz aus ist, meldet Safari einen Fehler ("audio-capture") und schickt danach oft
  // kein Ende-Signal mehr. Dann stand unten "Nicht verstanden" und Friday reagierte gar nicht mehr.
  // Jetzt: erst das alte Mikrofon ganz beenden lassen, bei Mikrofon-Fehlern still neu versuchen und
  // nie wieder auf ein fehlendes Ende-Signal warten (Sicherheits-Zeitschalter).
  let gespraechSeit = 0;
  function listenOnce({ folge = false, frage = false, versuch = 1, mikroVersuch = 1 } = {}) {
    if (!Recognition) {
      addMessage("friday", "Dein Browser kann keine Sprache erkennen. Nutze Safari oder Chrome, oder tipp unten.");
      return;
    }
    const andereAn = wakeLaeuft || !!bargeRec;
    pauseWake();
    stopBarge();
    if (gespraechRec) { const alt = gespraechRec; gespraechRec = null; try { alt.abort(); } catch { /* egal */ } }
    // Platzhalter, damit sich in der Wartezeit kein anderes Ohr einschaltet.
    const platz = {};
    gespraechRec = platz;
    setState(folge ? "Ich höre weiter …" : "Ich höre", "listening");
    document.body.classList.toggle("gespraech", folge);
    gespraechSeit = Date.now();
    const los = () => {
      if (gespraechRec !== platz) return; // inzwischen abgebrochen oder neu gestartet
      let rec;
      try { rec = new Recognition(); } catch { gespraechRec = null; resumeWake(); return; }
      gespraechRec = rec;
      rec.lang = "de-DE";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      let gehoert = false, stille = false, mikroFehler = false, beendet = false, notEnde = null;
      rec.onresult = (e) => {
        const said = String(e.results?.[0]?.[0]?.transcript || "").trim();
        if (!said) return;
        gehoert = true;
        // "Danke" / "Das war's" beendet das Gespräch (außer Friday hat gerade etwas gefragt, dann entscheidet der Server).
        if (folge && !frage && GESPRAECH_ENDE.test(said.replace(/^(?:hey |ok )?(?:friday|freitag)[,.!]?\s*/i, ""))) {
          addMessage("user", said);
          say(["Gern, Boss.", "Jederzeit, Boss.", "Alles klar, Boss."][Math.floor(Math.random() * 3)]);
          return;
        }
        send(said, { stimme: true });
      };
      rec.onerror = (e) => {
        const f = e?.error || "";
        if (f === "no-speech" || f === "aborted") stille = true;
        else if (f === "audio-capture" || f === "network") mikroFehler = true; // Mikrofon war noch belegt
        else if (f === "not-allowed" || f === "service-not-allowed") {
          wakeBrauchtTipp = true;
          setState("Mikrofon erlauben: einmal auf Fridays Kopf tippen");
        } else setState("Nicht verstanden");
        // Safari schickt nach einem Fehler manchmal kein Ende-Signal mehr: selbst beenden.
        clearTimeout(notEnde);
        notEnde = setTimeout(() => ende(), 1200);
      };
      const ende = () => {
        if (beendet) return;
        beendet = true;
        clearTimeout(notEnde);
        if (gespraechRec !== rec) return; // ein neueres Zuhören hat übernommen
        gespraechRec = null;
        document.body.classList.remove("gespraech");
        // Mikrofon war noch belegt: kurz warten und still nochmal versuchen.
        if (mikroFehler && !gehoert && mikroVersuch < 3 && !busy && !speaking) {
          setTimeout(() => { if (!busy && !speaking && !gespraechRec) listenOnce({ folge, frage, versuch, mikroVersuch: mikroVersuch + 1 }); }, 500);
          return;
        }
        // Im Gespräch einmal nachhaken, falls der Browser zu früh aufgibt.
        if (folge && !gehoert && stille && versuch < 2 && !busy && !speaking) {
          setTimeout(() => { if (!busy && !speaking && !gespraechRec) listenOnce({ folge, frage, versuch: versuch + 1 }); }, 150);
          return;
        }
        if (!busy && !speaking && !wakeBrauchtTipp) setState(wakeActive ? 'Höre auf "Friday"' : "Bereit, Boss.");
        if (!busy && !speaking && mikroFehler && !gehoert) setState("Mikrofon belegt – tipp auf Fridays Kopf");
        resumeWake();
      };
      rec.onend = ende;
      // Hängt das Zuhören ohne Ende-Signal, nach 20 s aufräumen.
      setTimeout(() => { if (!beendet && gespraechRec === rec) { try { rec.abort(); } catch { /* egal */ } setTimeout(ende, 800); } }, 20000);
      try { rec.start(); } catch { mikroFehler = true; ende(); }
    };
    // Lief gerade ein anderes Ohr, ihm Zeit zum Ausgehen geben (iPhone braucht das).
    if (andereAn) setTimeout(los, IST_IOS ? 450 : 200); else los();
  }

  $("reactor").addEventListener("click", () => {
    if (speaking) {
      sprechNr++;
      speechSynthesis?.cancel();
      audio.pause();
      return;
    }
    listenOnce();
  });

  // ---------- Unterbrechen mit "Friday" (v1.106.0) ----------
  // Während Friday spricht, hört ein zweites Ohr mit. Nur wenn darin "Friday" vorkommt, hört sie sofort
  // auf zu reden und nimmt den Befehl an ("Friday, stopp" / "Friday, wie spät ist es?").
  // Normales Reden ohne "Friday" wird ignoriert. Hört das Mikrofon Fridays eigene Stimme aus dem
  // Lautsprecher (Echo), erkennt sie das am Text und unterbricht sich nicht selbst.
  const unterbrechenAn = () => storage.get("friday_unterbrechen") !== "0";
  const NUR_STOPP = /^(stopp?|halt|ruhe|still|sei still|schluss|aus|warte|moment|danke|ok(ay)?|genug|pause)[ .!]*$/i;
  let bargeRec = null;     // das zweite Ohr
  let bargeText = "";      // was Friday gerade sagt (für den Echo-Vergleich)
  let bargeFang = false;   // "Friday" wurde gehört, Friday ist still und wartet auf den Befehl
  let bargeTimer = null;
  let bargeZeit = 0;
  let bargeNr = -1;
  let bargeNeustarts = 0;
  const IST_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const unterbrochenEben = () => Date.now() - bargeZeit < 4000;
  window.Friday.unterbrochen = () => unterbrochenEben() || bargeFang;
  window.Friday.beschaeftigt = () => busy || speaking || bargeFang;
  const bargeNorm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ß ]+/g, " ").replace(/\s+/g, " ").trim();
  // Stammt das Gehörte aus Fridays eigenem Satz? (Echo aus dem Lautsprecher)
  function bargeEcho(said) {
    const gesagt = bargeNorm(bargeText);
    if (!/\b(friday|freitag)\b/.test(gesagt)) return false; // Friday sagt das Wort gar nicht → muss Boss sein
    const woerter = bargeNorm(said).split(" ").filter((w) => w.length > 2);
    if (woerter.length <= 1) return false;
    const menge = new Set(gesagt.split(" "));
    const treffer = woerter.filter((w) => menge.has(w)).length;
    return treffer / woerter.length >= 0.6;
  }
  function stopBarge() {
    clearTimeout(bargeTimer);
    const r = bargeRec;
    bargeRec = null;
    bargeFang = false;
    if (r) { r.onend = null; try { r.abort(); } catch { /* egal */ } }
  }
  function bargeBefehl(cmd) {
    stopBarge();
    bargeZeit = Date.now();
    cmd = String(cmd || "").replace(/^[,.!\s]+/, "").trim();
    window.FridayRing?.melde?.("unterbrechen", null);
    if (cmd.length > 2 && !NUR_STOPP.test(cmd)) { setTimeout(() => send(cmd, { stimme: true }), 120); return; }
    if (NUR_STOPP.test(cmd)) { setState("Bereit, Boss."); resumeWake(); return; }
    setTimeout(() => { if (!busy && !speaking) listenOnce({ folge: true }); }, 200);
  }
  function startBarge(text, nr) {
    stopBarge();
    bargeNr = nr;
    if (!Recognition || !unterbrechenAn() || callActive || document.visibilityState === "hidden") return;
    bargeText = String(text || "");
    bargeNeustarts = 0;
    let rec;
    try { rec = new Recognition(); } catch { return; }
    rec.lang = "de-DE";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const said = String(e.results[i][0]?.transcript || "");
        const fertig = e.results[i].isFinal;
        const m = said.match(WAKE);
        if (!m) continue;
        if (!bargeFang) {
          // Zwischenergebnis: nur sofort stoppen, wenn Friday das Wort selbst gar nicht sagt (dann kann es kein Echo sein).
          if (!fertig && /\b(friday|freitag)\b/.test(bargeNorm(bargeText))) continue;
          if (bargeEcho(said)) continue;
          bargeFang = true;
          bargeZeit = Date.now();
          window.Friday.stopSpeaking?.();
          setState("Ich höre", "listening");
          // Kommt kein fertiger Satz mehr, einfach normal zuhören.
          bargeTimer = setTimeout(() => bargeBefehl(""), 3500);
        }
        if (fertig) { clearTimeout(bargeTimer); bargeBefehl(said.slice(m.index + m[0].length)); return; }
      }
    };
    rec.onerror = (e) => {
      // Still: Unterbrechen ist ein Extra. iPhone: Mikrofon war noch vom "Friday"-Ohr belegt → gleich nochmal.
      if (e?.error === "audio-capture" && bargeRec === rec && speaking && bargeNeustarts < 3) {
        bargeNeustarts++;
        setTimeout(() => { if (bargeRec === rec && speaking) { try { rec.start(); } catch { /* läuft */ } } }, 500);
      }
    };
    rec.onend = () => {
      // Der Browser beendet das Zuhören manchmal von selbst: solange Friday spricht, neu starten.
      if (bargeRec !== rec) return;
      if (bargeFang) { bargeBefehl(""); return; }
      // iPhone/iPad: Jeder Neustart des Mikrofons schaltet dort den Ton um und schneidet Friday das Wort ab.
      // Darum dort nur selten neu starten (Geräusche wie die S-Bahn beenden das Zuhören oft).
      if (speaking && IST_IOS) {
        bargeNeustarts++;
        if (bargeNeustarts <= 2) bargeTimer = setTimeout(() => { if (bargeRec === rec && speaking) { try { rec.start(); } catch { bargeRec = null; } } }, 4000);
        else bargeRec = null;
        return;
      }
      if (speaking) { try { rec.start(); } catch { bargeRec = null; } } else bargeRec = null;
    };
    bargeRec = rec;
    // iPhone: erst starten, wenn das "Friday"-Ohr wirklich aus ist (nur ein Mikrofon gleichzeitig).
    if (IST_IOS) setTimeout(() => { if (bargeRec === rec && speaking) { try { rec.start(); } catch { /* läuft */ } } }, 450);
    else { try { rec.start(); } catch { bargeRec = null; } }
  }
  window.Friday.unterbrechen = { an: unterbrechenAn, aktiv: () => !!bargeRec };

  // Dauerhaft auf "Friday" hören (klappt, solange das Dashboard offen ist).
  // v1.102.0: Das Weckwort ist IMMER an. Früher wurde die Einstellung zwar gespeichert,
  // beim Neuladen aber nie wieder gelesen – darum war es nach jedem Start aus.
  // Der Schalter pausiert jetzt nur bis zum nächsten Neuladen.
  let wakeLaeuft = false;     // Erkennung läuft gerade
  let wakeBrauchtTipp = false; // Browser (v. a. iPhone/Safari) will erst einen Tipp aufs Display
  let wakeSchnellEnden = 0;   // wie oft die Erkennung direkt wieder aufgehört hat
  let wakeGestartet = 0;
  let wakeTimer = null;
  let wakeLetzterFehler = 0;
  // Wächter (v1.121.5): Ist das "Friday"-Ohr aus, obwohl es laufen dürfte, wieder anwerfen.
  // Hängt ein einmaliges Zuhören länger als 25 s, aufräumen – sonst reagiert Friday gar nicht mehr.
  setInterval(() => {
    if (gespraechRec && !busy && !speaking && Date.now() - gespraechSeit > 25000) {
      const alt = gespraechRec; gespraechRec = null;
      try { alt.abort?.(); } catch { /* egal */ }
      document.body.classList.remove("gespraech");
      setState(wakeActive ? 'Höre auf "Friday"' : "Bereit, Boss.");
    }
    if (wakeActive && !wakeLaeuft && !wakeBrauchtTipp && wakeDarf()) startWake();
  }, 5000);
  storage.remove("friday_wake"); // alter, nie gelesener Wert

  function wakeDarf() {
    return wakeActive && !speaking && !busy && !gespraechRec && !bargeRec
      && !callActive && !window.Friday?.mikroBelegt
      && document.visibilityState !== "hidden";
  }

  function wakeBauen() {
    const rec = new Recognition();
    rec.lang = "de-DE";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onstart = () => { wakeLaeuft = true; wakeBrauchtTipp = false; wakeGestartet = Date.now(); };
    rec.onresult = (e) => {
      const said = e.results[e.results.length - 1][0].transcript;
      const match = said.match(WAKE);
      if (!match || busy || speaking) return;
      const command = said.slice(match.index + match[0].length).trim();
      if (command.length > 2) send(command, { stimme: true });
      else listenOnce();
    };
    rec.onerror = (e) => {
      // Mikrofon nicht freigegeben oder Start ohne Tipp: beim nächsten Tipp neu versuchen.
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wakeBrauchtTipp = true;
        if (wakeActive && !busy && !speaking) setState('Einmal tippen, dann höre ich auf "Friday"');
      }
      // iPhone: nach einem Fehler kommt manchmal kein Ende-Signal – dann gilt das Ohr als aus.
      const fehlerZeit = Date.now();
      setTimeout(() => { if (wakeLaeuft && wakeLetzterFehler === fehlerZeit) { wakeLaeuft = false; if (!wakeBrauchtTipp && wakeDarf()) wakeSpaeter(400); } }, 1500);
      wakeLetzterFehler = fehlerZeit;
    };
    rec.onend = () => {
      wakeLaeuft = false;
      if (wakeBrauchtTipp || !wakeDarf()) return;
      // Hört der Browser sofort wieder auf, etwas länger warten (sonst Dauerschleife).
      wakeSchnellEnden = Date.now() - wakeGestartet < 1500 ? Math.min(wakeSchnellEnden + 1, 6) : 0;
      wakeSpaeter(wakeSchnellEnden ? 400 * 2 ** wakeSchnellEnden : 300);
    };
    return rec;
  }

  function wakeSpaeter(ms) {
    clearTimeout(wakeTimer);
    wakeTimer = setTimeout(startWake, ms);
  }

  function startWake() {
    if (!Recognition || !wakeDarf() || wakeLaeuft) return;
    if (!wakeRec) wakeRec = wakeBauen();
    try { wakeRec.start(); wakeLaeuft = true; } catch { /* läuft schon */ }
    if (!busy && !speaking) setState('Höre auf "Friday"');
  }

  function pauseWake() {
    clearTimeout(wakeTimer);
    if (wakeRec) { try { wakeRec.abort(); } catch { /* egal */ } }
    wakeLaeuft = false;
  }

  function resumeWake() {
    if (wakeActive) wakeSpaeter(500); // nach dem Gesprächsmodus-Zuhören (250 ms), damit sich beide nicht stören
  }
  // Für die Lernecke (lernen.js): eigenes Mikrofon, solange sie abfragt.
  window.Friday.wakePause = pauseWake;
  window.Friday.wakeWeiter = resumeWake;

  $("wake-toggle").checked = true;
  wakeActive = !!Recognition;
  $("wake-toggle").addEventListener("change", (e) => {
    wakeActive = e.target.checked;
    if (wakeActive) {
      wakeBrauchtTipp = false;
      startWake();
    } else {
      pauseWake();
      setState("Bereit, Boss.");
    }
  });

  // iPhone/Safari: Mikrofon darf oft erst nach einem Tipp starten – dann beim ersten Tipp anwerfen.
  const wakeNachTipp = () => { if (wakeActive && !wakeLaeuft) { wakeBrauchtTipp = false; wakeSpaeter(400); } };
  document.addEventListener("pointerdown", wakeNachTipp, true);
  document.addEventListener("keydown", wakeNachTipp, true);
  // App wieder im Vordergrund (iPhone beendet das Zuhören im Hintergrund): neu starten.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { wakeBrauchtTipp = false; resumeWake(); }
    else pauseWake();
  });
  window.addEventListener("pageshow", () => resumeWake());
  // Gleich beim Start anwerfen (nach dem Aufbau der Seite).
  setTimeout(startWake, 800);

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
    pauseWake();
    callOrb("listening"); callStatus("Verbunden – ich höre");
    callListen();
  }

  function closeCall() {
    callActive = false;
    if (callRec) { try { callRec.abort(); } catch { /* egal */ } callRec = null; }
    try { speechSynthesis?.cancel(); } catch { /* egal */ }
    try { audio.pause(); } catch { /* egal */ }
    $("call")?.classList.add("hidden");
    const vt = $("voice-toggle"); if (vt && callVoicePrev !== null) vt.checked = callVoicePrev;
    if (!busy && !speaking) setState("Bereit, Boss.");
    resumeWake();
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
