// Einstellungen, Teil 2: Suche, Auf-/Zuklappen, Profil, Uhr & Startseite, eigene Farbe, Glas, Ecken,
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

  // ---------- 1. Suche + Auf-/Zuklappen ----------
  const gruppen = [...box.querySelectorAll(".set-group")];
  let zu = new Set((get("friday_set_zu") || "").split("|").filter(Boolean));
  const gName = (g) => g.querySelector(".set-g-txt h3")?.textContent.trim() || "";
  function zuMalen() {
    gruppen.forEach((g) => g.classList.toggle("zu", zu.has(gName(g))));
    const knopf = $("set-allezu");
    if (knopf) knopf.textContent = zu.size >= gruppen.length ? "Alle aufklappen" : "Alle zuklappen";
  }
  gruppen.forEach((g) => {
    const kopf = g.querySelector(".set-g-head");
    if (!kopf) return;
    kopf.setAttribute("role", "button");
    kopf.tabIndex = 0;
    kopf.insertAdjacentHTML("beforeend", '<span class="set-g-pfeil" aria-hidden="true">▾</span>');
    const toggle = () => {
      const n = gName(g);
      zu.has(n) ? zu.delete(n) : zu.add(n);
      set("friday_set_zu", [...zu].join("|"));
      zuMalen();
    };
    kopf.addEventListener("click", toggle);
    kopf.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  });
  $("set-allezu")?.addEventListener("click", () => {
    zu = zu.size >= gruppen.length ? new Set() : new Set(gruppen.map(gName));
    set("friday_set_zu", [...zu].join("|"));
    zuMalen();
  });
  zuMalen();

  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  $("set-suche")?.addEventListener("input", (e) => {
    const q = norm(e.target.value.trim());
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
      const zeigen = drin > 0;
      g.classList.toggle("set-weg", !zeigen);
      g.classList.toggle("such-offen", Boolean(q) && zeigen);
      if (zeigen) treffer++;
    });
    $("set-nichts")?.classList.toggle("hidden", treffer > 0);
  });

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

  // ---------- 4. Anwenden ----------
  function anwenden() {
    const b = document.body, root = document.documentElement.style;
    const a = aus();
    for (const k of ["weather", "panel-status", "panel-proc", "panel-heute", "panel-backup", "quick", "hudbar", "chips", "transcript"]) b.classList.toggle(`aus-${k}`, a.has(k));
    b.classList.toggle("aus-gruss", get("friday_gruss") === "0");
    b.classList.toggle("hud-raster", get("friday_raster") === "1");
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
