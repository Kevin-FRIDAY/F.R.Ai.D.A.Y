// Einstellungen, Teil 2: Reiter + Suche (v1.154.0), Schnellzugriff, neue Schalter (Ruhezeit, Wach halten, Klick-Töne, Startfenster, Kontrast, Neuronen-Netz),
// Profil, Uhr & Startseite, eigene Farbe, Glas, Ecken,
// Raster, Lautstärke, Signaltöne, Export/Import/Zurücksetzen.
// Alle Werte liegen als friday_* in localStorage und werden von einstellungen-sync.js auf den Mac gespiegelt.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const box = $("settings");
  if (!box) return;
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* privat */ } };
  const melden = () => window.dispatchEvent(new Event("friday-settings"));

  // ---------- 1. Reiter + Suche (v1.154.0) ----------
  // Links (Mac) bzw. oben (iPhone) die Bereiche, rechts die Karten des gewählten Bereichs.
  // Die Suche durchsucht alle Bereiche gleichzeitig und zeigt nur passende Zeilen.
  const gruppen = [...box.querySelectorAll(".set-group")];
  const tabs = [...box.querySelectorAll(".set-tab")];
  const panes = [...box.querySelectorAll(".set-pane")];
  const layout = box.querySelector(".set-layout");
  function zeigeTab(name, { scroll = true } = {}) {
    if (!panes.some((p) => p.dataset.pane === name)) name = "schnell";
    tabs.forEach((t) => { const an = t.dataset.setTab === name; t.classList.toggle("on", an); t.setAttribute("aria-selected", an ? "true" : "false"); });
    panes.forEach((p) => p.classList.toggle("on", p.dataset.pane === name));
    set("friday_set_tab", name);
    if (name === "schnell") kachelnMalen();
    if (scroll) {
      const sb = box.querySelector(".sheet-box");
      const ziel = layout ? layout.offsetTop - 6 : 0;
      if (sb && sb.scrollTop > ziel) sb.scrollTop = ziel;
      tabs.find((t) => t.classList.contains("on"))?.scrollIntoView?.({ block: "nearest", inline: "center" });
    }
  }
  tabs.forEach((t) => t.addEventListener("click", () => { const q = $("set-suche"); if (q && q.value) { q.value = ""; suchen(""); } zeigeTab(t.dataset.setTab); }));
  tabs.forEach((t, i) => t.addEventListener("keydown", (e) => {
    const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const n = tabs[(i + d + tabs.length) % tabs.length];
    n.focus(); n.click();
  }));

  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function suchen(roh) {
    const q = norm(roh.trim());
    layout?.classList.toggle("set-sucht", Boolean(q));
    let treffer = 0;
    gruppen.forEach((g) => {
      const zeilen = g.querySelectorAll(".set-g-body > *");
      const kopfPasst = !q || norm(g.querySelector(".set-g-head").textContent).includes(q);
      let drin = 0;
      zeilen.forEach((z) => {
        const passt = kopfPasst || norm(z.textContent + " " + [...z.querySelectorAll("option")].map((o) => o.textContent).join(" ")).includes(q);
        z.classList.toggle("set-weg", !passt);
        if (passt) drin++;
      });
      g.classList.toggle("set-weg", drin === 0);
      if (drin > 0 && !g.closest(".set-pane[data-pane=schnell]")) treffer++;
    });
    // Bereiche ohne Treffer ganz ausblenden; Schnellzugriff in der Suche nicht doppelt zeigen
    panes.forEach((p) => p.classList.toggle("set-weg", Boolean(q) && (p.dataset.pane === "schnell" || !p.querySelector(".set-group:not(.set-weg)"))));
    $("set-nichts")?.classList.toggle("hidden", !q || treffer > 0);
  }
  $("set-suche")?.addEventListener("input", (e) => suchen(e.target.value));

  // Kopfhöhe messen, damit die Reiter beim Scrollen direkt darunter kleben
  function kopfMessen() {
    const k = box.querySelector(".sheet-top");
    if (k) box.style.setProperty("--set-kopf", `${Math.round(k.getBoundingClientRect().height)}px`);
  }
  window.addEventListener("resize", kopfMessen);

  // Regler zeigen ihren Wert (z. B. „1,05×“ oder „45 %“)
  const FORMAT = {
    "set-glas": (v) => `${Math.round(v * 100)} %`,
    "set-glow": (v) => `${Math.round(v * 100)} %`,
    "voice-rate": (v) => `${Number(v).toFixed(2).replace(".", ",")}×`,
    "voice-pitch": (v) => `${Number(v).toFixed(2).replace(".", ",")}`,
    "set-lautstaerke": (v) => `${Math.round(v * 100)} %`,
    "set-tonlaut": (v) => `${Math.round(v * 100)} %`,
    "set-visionschwelle": (v) => `${Math.round(v)} %`,
  };
  const regler = [...box.querySelectorAll("input[type=range]")];
  regler.forEach((r) => {
    const o = document.createElement("output");
    o.className = "set-wert";
    o.setAttribute("aria-hidden", "true");
    r.insertAdjacentElement("afterend", o);
    r.addEventListener("input", () => reglerMalen(r));
  });
  function reglerMalen(r) {
    const o = r.nextElementSibling?.classList?.contains("set-wert") ? r.nextElementSibling : r.parentElement?.querySelector(".set-wert");
    const min = Number(r.min || 0), max = Number(r.max || 100), v = Number(r.value);
    r.style.setProperty("--fuell", `${((v - min) / (max - min || 1)) * 100}%`);
    if (o) o.textContent = (FORMAT[r.id] || ((x) => x))(v);
  }

  // ---------- 1b. Schnellzugriff: Kacheln, die die echten Schalter umlegen ----------
  const KACHELN = [
    ["voice-toggle", "🔊", "Vorlesen"],
    ["wake-toggle", "🎧", "Auf „Friday“ hören"],
    ["set-gespraech", "💬", "Gesprächsmodus"],
    ["set-vonselbst", "📣", "Spricht von selbst"],
    ["set-ruhe", "🌙", "Ruhezeit"],
    ["amoled-toggle", "⬛", "Tiefschwarz"],
    ["set-vollbild", "⛶", "Vollbild"],
    ["set-reduce", "🍃", "Weniger Animationen"],
    ["set-wach", "☀", "Bildschirm wach"],
    ["set-klick", "🔔", "Klick-Töne"],
    ["translate-toggle", "🌐", "Übersetzer"],
    ["set-diagnose", "🩺", "Diagnose"],
  ];
  let letzteKachel = null;
  function kachelnMalen() {
    const ziel = $("set-kacheln"); if (!ziel) return;
    if (!ziel.childElementCount) {
      ziel.innerHTML = KACHELN.filter(([id]) => $(id)).map(([id, ico, name]) =>
        `<label class="set-kachel" for="${id}" data-fuer="${id}" tabindex="0" role="switch"><span class="sk-ico">${ico}</span><span class="sk-name">${name}</span><span class="sk-stand"></span><span class="sk-haken"></span></label>`).join("");
      ziel.querySelectorAll(".set-kachel").forEach((k) => {
        k.addEventListener("click", () => { letzteKachel = { k, t: Date.now() }; });
        k.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $(k.dataset.fuer)?.click(); letzteKachel = { k, t: Date.now() }; } });
      });
    }
    ziel.querySelectorAll(".set-kachel").forEach((k) => {
      const an = Boolean($(k.dataset.fuer)?.checked);
      k.classList.toggle("an", an);
      k.setAttribute("aria-checked", an ? "true" : "false");
      k.querySelector(".sk-stand").textContent = an ? "An" : "Aus";
    });
  }
  box.addEventListener("change", (e) => { if (e.target.matches?.("input[type=checkbox]")) setTimeout(kachelnMalen, 0); });
  window.addEventListener("friday:gespeichert", () => {
    if (letzteKachel && Date.now() - letzteKachel.t < 4000) { window.FridayHaken?.zeige?.(letzteKachel.k.querySelector(".sk-haken")); letzteKachel = null; }
  });

  // „Über Friday“
  async function ueberMalen() {
    const el = $("set-ueber"); if (!el) return;
    const ua = navigator.userAgent;
    const geraet = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Macintosh/.test(ua) ? (navigator.maxTouchPoints > 1 ? "iPad" : "Mac") : /Android/.test(ua) ? "Android" : "Computer";
    const app = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone ? "als App" : "im Browser";
    let version = "–";
    try { const st = await (await F.api("/api/status")).json(); version = st.version || version; } catch { /* egal */ }
    const anzahl = (() => { let n = 0; try { for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i)?.startsWith("friday_")) n++; } catch { /* egal */ } return n; })();
    const zeile = (k, v) => `<div class="si-zeile"><span>${k}</span><b>${v}</b></div>`;
    el.innerHTML = zeile("Version", `v${String(version).replace(/^v/, "")}`) + zeile("Dieses Gerät", `${geraet} · ${app}`) +
      zeile("Gespeicherte Einstellungen", `${anzahl}, gelten auf allen Geräten`) + zeile("Speicherort", "Auf deinem Mac (server/data)");
  }

  zeigeTab(get("friday_set_tab") || "schnell", { scroll: false });

  // Beim Öffnen: Kopf messen, Regler und Kacheln auffrischen
  new MutationObserver(() => {
    if (box.classList.contains("hidden")) return;
    requestAnimationFrame(() => { kopfMessen(); regler.forEach(reglerMalen); kachelnMalen(); ruheZeigen(); });
    ueberMalen();
  }).observe(box, { attributes: true, attributeFilter: ["class"] });
  // Andere Skripte setzen Regler beim Start: kurz danach einmal malen
  setTimeout(() => regler.forEach(reglerMalen), 1500);

  // ---------- 2. Profil (Server: gilt für Friday überall, auch Telegram und Briefing) ----------
  async function profilLaden() {
    try {
      const s = await (await F.api("/api/einstellungen")).json();
      if ($("srv-anrede")) $("srv-anrede").value = s.anrede || "";
      if ($("srv-stadt")) $("srv-stadt").value = s.stadt || "";
    } catch { /* später */ }
  }
  $("profil-save")?.addEventListener("click", async () => {
    const info = $("profil-info");
    const body = { anrede: $("srv-anrede")?.value || "", stadt: $("srv-stadt")?.value || "" };
    try {
      const r = await F.api("/api/einstellungen", { method: "POST", body: JSON.stringify(body) });
      const s = await r.json();
      const ok = r.ok && s.anrede === body.anrede.replace(/\s+/g, " ").trim() && s.stadt === body.stadt.replace(/\s+/g, " ").trim();
      if (info) info.textContent = ok ? "Gespeichert ✓ Friday nennt dich jetzt so." : "Nur Buchstaben, Zahlen, Leerzeichen und Bindestrich (max. 40).";
      if (ok) { window.FridaySync?.gespeichert(); F.refreshStatus?.(); window.dispatchEvent(new Event("friday-wetter-neu")); }
    } catch { if (info) info.textContent = "Konnte nicht speichern."; window.FridaySync?.nichtGespeichert(); }
  });
  const obs = new MutationObserver(() => { if (!box.classList.contains("hidden")) profilLaden(); });
  obs.observe(box, { attributes: true, attributeFilter: ["class"] });

  // ---------- 3. Schalter und Regler (einfach gespeichert) ----------
  function flag(id, key, def) {
    const el = $(id); if (!el) return;
    const v = get(key);
    el.checked = v == null ? def : v === "1";
    el.addEventListener("change", () => { set(key, el.checked ? "1" : "0"); anwenden(); melden(); });
  }
  function wert(id, key, def) {
    const el = $(id); if (!el) return;
    el.value = get(key) ?? def;
    el.addEventListener("input", () => { set(key, el.value); anwenden(); melden(); });
  }
  flag("set-gruss", "friday_gruss", true);
  flag("set-uhrsek", "friday_uhrsek", true);
  wert("set-uhr12", "friday_uhr12", "0");
  wert("set-datum", "friday_datum", "lang");
  wert("set-glas", "friday_glas", "0.94");
  wert("set-ecken", "friday_ecken", "rund");
  flag("set-raster", "friday_raster", false);
  wert("set-lautstaerke", "friday_lautstaerke", "1");
  flag("set-toene", "friday_toene", true);
  wert("set-tonlaut", "friday_tonlaut", "0.6");
  // v1.154.0: neue Einstellungen
  flag("set-netz", "friday_netz", true);
  flag("set-kontrast", "friday_kontrast", false);
  flag("set-wach", "friday_wach", false);
  flag("set-klick", "friday_klick", false);
  flag("set-ruhe", "friday_ruhe", false);
  wert("set-ruhe-von", "friday_ruhe_von", "22:00");
  wert("set-ruhe-bis", "friday_ruhe_bis", "07:00");
  wert("set-startfenster", "friday_startfenster", "");
  function ruheZeigen() { $("set-ruhe-zeiten")?.classList.toggle("set-aus", get("friday_ruhe") !== "1"); }
  ruheZeigen();
  window.addEventListener("friday-settings", ruheZeigen);

  // Karten auf der Startseite
  const aus = () => new Set((get("friday_karten_aus") || "").split(",").filter(Boolean));
  box.querySelectorAll("#set-karten input[data-karte]").forEach((cb) => {
    cb.checked = !aus().has(cb.dataset.karte);
    cb.addEventListener("change", () => {
      const a = aus();
      cb.checked ? a.delete(cb.dataset.karte) : a.add(cb.dataset.karte);
      set("friday_karten_aus", [...a].join(","));
      anwenden(); melden();
    });
  });

  // Eigene Akzentfarbe
  const farbe = $("set-eigenfarbe");
  if (farbe) {
    if (/^#[0-9a-f]{6}$/i.test(get("friday_themefarbe") || "")) farbe.value = get("friday_themefarbe");
    const nimm = () => { set("friday_themefarbe", farbe.value); window.FridayTheme?.("eigen"); };
    farbe.addEventListener("input", nimm);
    farbe.addEventListener("click", () => { if (get("friday_theme") !== "eigen") nimm(); });
  }

  // ---------- 4b. Neue Helfer (v1.154.0) ----------
  // Ruhezeit: zwischen „von“ und „bis“ (auch über Mitternacht) spricht Friday nichts von selbst und piept nicht.
  window.FridayRuhezeit = () => {
    if (get("friday_ruhe") !== "1") return false;
    const min = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    const von = min(get("friday_ruhe_von") || "22:00"), bis = min(get("friday_ruhe_bis") || "07:00");
    if (von == null || bis == null || von === bis) return false;
    const d = new Date(), jetzt = d.getHours() * 60 + d.getMinutes();
    return von < bis ? jetzt >= von && jetzt < bis : jetzt >= von || jetzt < bis;
  };

  // Bildschirm wach halten (Wake Lock; iPhone ab iOS 16.4). Nach dem Zurückkehren in die App neu anfordern.
  let sperre = null, wachSoll = false;
  async function wachHalten(an) {
    wachSoll = an;
    try {
      if (!an) { if (sperre) { await sperre.release(); sperre = null; } return; }
      if (sperre || !navigator.wakeLock || document.visibilityState !== "visible") return;
      sperre = await navigator.wakeLock.request("screen");
      sperre.addEventListener("release", () => { sperre = null; });
    } catch { sperre = null; }
  }
  document.addEventListener("visibilitychange", () => { if (wachSoll && document.visibilityState === "visible") wachHalten(true); });

  // Klick-Töne: ganz leises, kurzes Sci-Fi-Klicken bei Knöpfen
  let klickTon = null;
  document.addEventListener("pointerdown", (e) => {
    if (get("friday_klick") !== "1" || window.FridayRuhezeit?.()) return;
    if (!e.target?.closest?.("button, .chip, .nav-item, .set-tab, .set-kachel, [role=button], .swatch")) return;
    try {
      klickTon = klickTon || new (window.AudioContext || window.webkitAudioContext)();
      const t = klickTon.currentTime, o = klickTon.createOscillator(), g = klickTon.createGain();
      const laut = Math.min(1, Number(get("friday_tonlaut") ?? 0.6) || 0.6) * 0.09;
      o.type = "triangle"; o.frequency.setValueAtTime(1850, t); o.frequency.exponentialRampToValueAtTime(950, t + 0.05);
      g.gain.setValueAtTime(laut, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g).connect(klickTon.destination); o.start(t); o.stop(t + 0.08);
    } catch { /* kein Ton möglich */ }
  }, { passive: true, capture: true });

  // Beim Start ein Fenster öffnen (nur wenn noch keins offen ist)
  const START = { welt: () => $("lage-btn")?.click(), system: () => document.querySelector('[data-nav="system"]')?.click(), wissen: () => document.querySelector('[data-nav="wissen"]')?.click(), archiv: () => document.querySelector('[data-nav="archiv"]')?.click() };
  setTimeout(() => {
    const f = START[get("friday_startfenster") || ""];
    if (!f || !window.Friday?.api) return;
    if (document.querySelector(".sheet:not(.hidden)")) return;
    try { f(); } catch { /* egal */ }
  }, 4500);

  // ---------- 4. Anwenden ----------
  function anwenden() {
    const b = document.body, root = document.documentElement.style;
    const a = aus();
    for (const k of ["weather", "panel-status", "panel-proc", "panel-heute", "panel-backup", "quick", "hudbar", "chips", "transcript"]) b.classList.toggle(`aus-${k}`, a.has(k));
    b.classList.toggle("aus-gruss", get("friday_gruss") === "0");
    b.classList.toggle("hud-raster", get("friday_raster") === "1");
    b.classList.toggle("netz-aus", get("friday_netz") === "0");
    b.classList.toggle("set-kontrast", get("friday_kontrast") === "1");
    wachHalten(get("friday_wach") === "1");
    b.classList.remove("ecken-weich", "ecken-kantig");
    const e = get("friday_ecken");
    if (e === "weich" || e === "kantig") b.classList.add(`ecken-${e}`);
    const g = Math.min(1, Math.max(0.5, Number(get("friday_glas")) || 0.94));
    if (Math.abs(g - 0.94) > 0.001) {
      root.setProperty("--u-glas", `linear-gradient(160deg, color-mix(in srgb, var(--cyan) 11%, rgba(14, 8, 3, ${g})), rgba(8, 5, 2, ${Math.min(1, g + 0.02)}))`);
    } else root.removeProperty("--u-glas");
  }
  anwenden();
  window.addEventListener("friday-settings", anwenden);
  window.addEventListener("storage", anwenden);

  // ---------- 5. Export / Import / Zurücksetzen ----------
  const NUR_GERAET = /^friday_(token|voice|alarm_last|focus_.*|boot|wake|theme_mockup|sync_.*)$/;
  const msg = (t) => { const m = $("set-daten-msg"); if (m) m.textContent = t; };
  function alleWerte() {
    const w = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("friday_") && !NUR_GERAET.test(k)) w[k] = localStorage.getItem(k);
      }
    } catch { /* egal */ }
    return w;
  }
  $("set-export")?.addEventListener("click", () => {
    const daten = { app: "F.R.Ai.D.A.Y", art: "einstellungen", erstellt: new Date().toISOString(), werte: alleWerte() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(daten, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `friday-einstellungen-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    msg(`${Object.keys(daten.werte).length} Einstellungen gespeichert.`);
  });
  $("set-import")?.addEventListener("change", async (e) => {
    const datei = e.target.files?.[0];
    if (!datei) return;
    try {
      const d = JSON.parse(await datei.text());
      const werte = d?.werte && typeof d.werte === "object" ? d.werte : null;
      if (!werte) throw new Error("falsch");
      let n = 0;
      for (const [k, v] of Object.entries(werte)) {
        if (/^friday_[a-z0-9_]{1,48}$/.test(k) && !NUR_GERAET.test(k) && typeof v === "string" && v.length <= 300) { set(k, v); n++; }
      }
      msg(`${n} Einstellungen geladen. Lade neu …`);
      await window.FridaySync?.flush?.();
      setTimeout(() => location.reload(), 900);
    } catch { msg("Das ist keine Friday-Einstellungsdatei."); }
    e.target.value = "";
  });
  let resetBereit = 0;
  $("set-reset")?.addEventListener("click", async (e) => {
    if (Date.now() - resetBereit > 5000) {
      resetBereit = Date.now();
      e.target.textContent = "Wirklich? Nochmal tippen";
      msg("Alle Dashboard-Einstellungen gehen auf Standard (Anmeldung, Gedächtnis und Daten bleiben).");
      setTimeout(() => { if (Date.now() - resetBereit >= 5000) e.target.textContent = "↺ Alles zurücksetzen"; }, 5100);
      return;
    }
    for (const k of Object.keys(alleWerte())) { try { localStorage.removeItem(k); } catch { /* egal */ } }
    msg("Zurückgesetzt. Lade neu …");
    await window.FridaySync?.flush?.();
    setTimeout(() => location.reload(), 900);
  });
})();
