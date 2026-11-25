// F.R.Ai.D.A.Y 3D-Büro (v1.156.0): das Agenten-Team als begehbares Hologramm-Büro.
// Jeder Agent sitzt an seinem Arbeitsplatz in seiner Abteilung, Friday steht als Chefin in der Mitte.
// Alles echt: Status, "arbeitet gerade" und "zuletzt" kommen aus /api/agents (laufende Aufträge + Logbuch).
// Antippen/Klicken eines Agenten zeigt, was er gerade tut. Ziehen dreht, Zwei-Finger/Mausrad zoomt.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const sheet = $("agents");
  const huelle = $("buero");
  if (!sheet || !huelle) return;
  const F = window.Friday || {};
  const api = F.api || ((u, o) => fetch(u, o));
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));

  const ANSICHT_KEY = "friday_agenten_ansicht";
  const lies = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const schreib = (k, v) => { try { localStorage.setItem(k, v); } catch { /* egal */ } };

  // ---------- Ansicht umschalten (Büro / Liste) ----------
  const knopfBuero = $("agents-ansicht-buero");
  const knopfListe = $("agents-ansicht-liste");
  let ansicht = lies(ANSICHT_KEY) === "liste" ? "liste" : "buero";
  function zeigeAnsicht(a, speichern) {
    ansicht = a;
    sheet.classList.toggle("ansicht-buero", a === "buero");
    sheet.classList.toggle("ansicht-liste", a === "liste");
    knopfBuero?.classList.toggle("an", a === "buero");
    knopfListe?.classList.toggle("an", a === "liste");
    knopfBuero?.setAttribute("aria-pressed", String(a === "buero"));
    knopfListe?.setAttribute("aria-pressed", String(a === "liste"));
    if (speichern) schreib(ANSICHT_KEY, a);
    pruefeLauf();
  }
  knopfBuero?.addEventListener("click", () => zeigeAnsicht("buero", true));
  knopfListe?.addEventListener("click", () => zeigeAnsicht("liste", true));

  // ---------- Farben ----------
  const css = () => getComputedStyle(document.documentElement);
  function akzent() {
    const c = (css().getPropertyValue("--cyan") || "#ff8a1e").trim();
    return /^#|^rgb/.test(c) ? c : "#ff8a1e";
  }
  const FARBE = { aktiv: 0xff8a1e, arbeitet: 0xffd27a, mac: 0xf2c94c, setup: 0x5b5048, fehler: 0xff3b3b };

  // ---------- Hilfen ----------
  function zeitText(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return "";
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return "gerade eben";
    if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
    const d = new Date(t);
    const uhr = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const heute = new Date();
    if (d.toDateString() === heute.toDateString()) return `heute ${uhr}`;
    const gestern = new Date(heute); gestern.setDate(heute.getDate() - 1);
    if (d.toDateString() === gestern.toDateString()) return `gestern ${uhr}`;
    return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ${uhr}`;
  }
  const zustand = (a) => (a.arbeitet ? "arbeitet" : a.status === "aktiv" ? "aktiv" : a.status === "mac" ? "mac" : "setup");
  function tutGerade(a) {
    if (a.arbeitet) return a.jetzt || "Arbeitet an einem Auftrag …";
    if (a.status === "aktiv") return "Bereit – wartet auf einen Auftrag";
    if (a.status === "mac") return "Wartet auf den Mac";
    return "Noch nicht eingerichtet";
  }
  const kurz = (s, n) => { const t = String(s || ""); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

  // ---------- Daten ----------
  let daten = null;
  let ladeFehler = false;
  async function laden() {
    try {
      const r = await api("/api/agents");
      if (!r.ok) throw new Error(String(r.status));
      daten = await r.json();
      ladeFehler = false;
      if (szene) aktualisiereSzene();
      zeigeKopf();
      if (auswahl) zeigeDetail(auswahl);
    } catch {
      ladeFehler = true;
      zeigeKopf();
    }
  }

  function zeigeKopf() {
    const k = $("buero-kopf");
    if (!k) return;
    if (!daten) { k.innerHTML = ladeFehler ? `<span class="bu-fehler">Team nicht erreichbar.</span>` : `<span class="muted">Lade Büro …</span>`; return; }
    const c = daten.chefin || {};
    k.innerHTML = `<span class="bu-pill"><i class="bu-p aktiv"></i>${daten.aktiv} von ${daten.gesamt} bereit</span>`
      + `<span class="bu-pill"><i class="bu-p arbeitet"></i>${daten.arbeiten || 0} arbeiten gerade</span>`
      + `<button type="button" class="bu-pill bu-chef-pill" data-chefin="1"><b>FRIDAY</b> ${esc(kurz(c.jetzt, 60))}</button>`;
  }
  $("buero-kopf")?.addEventListener("click", (e) => { if (e.target.closest("[data-chefin]")) waehle("friday"); });

  // ---------- Detail-Karte ----------
  const detail = $("buero-detail");
  let auswahl = null;
  function zeigeDetail(id) {
    if (!detail || !daten) return;
    const altFeld = detail.querySelector(".bu-eingabe input");
    const alt = altFeld ? { id: altFeld.id, wert: altFeld.value, fokus: document.activeElement === altFeld } : null;
    if (id === "friday") {
      const c = daten.chefin || {};
      const arbeiter = daten.agents.filter((a) => a.arbeitet);
      detail.innerHTML = `<button type="button" class="bu-zu" aria-label="Schließen">✕</button>
        <div class="bu-d-kopf"><span class="bu-d-emoji">✦</span><div><b>FRIDAY</b><small>Chefin · leitet ${daten.gesamt} Agenten</small></div></div>
        <div class="bu-d-jetzt ${c.arbeitet ? "arbeitet" : ""}"><small>Gerade</small><p>${esc(c.jetzt || "Leitet das Team")}</p>${c.arbeitet ? `<div class="bu-balken"><i style="width:${Math.max(5, Math.min(100, c.prozent || 0))}%"></i></div>` : ""}</div>
        <p class="bu-d-text">${arbeiter.length ? `Im Einsatz: ${arbeiter.map((a) => `${esc(a.emoji)} ${esc(a.name)}`).join(", ")}.` : "Kein Agent ist gerade im Einsatz. Gib Friday einen Auftrag, dann siehst du hier, wer daran arbeitet."}</p>
        <p class="bu-d-text muted">${daten.aktiv} Agenten sind einsatzbereit, ${daten.gesamt - daten.aktiv} brauchen noch den Mac oder eine Verbindung.</p>
        <div class="bu-einsatz"><button type="button" class="bu-los" data-los="team" ${laeuftEinsatz.has("team") ? "disabled" : ""}>${laeuftEinsatz.has("team") ? "⏳ Team ist unterwegs …" : "🚀 Team-Lagebericht"}</button>
        <small class="muted">Wetter, Strompreis, Pollen, Ferien und Nachrichten – gleichzeitig.</small></div>
        ${berichtHtml(teamBericht)}`;
    } else {
      const a = daten.agents.find((x) => x.id === id);
      if (!a) return;
      const z = zustand(a);
      const zl = a.zuletzt;
      detail.innerHTML = `<button type="button" class="bu-zu" aria-label="Schließen">✕</button>
        <div class="bu-d-kopf"><span class="bu-d-emoji">${esc(a.emoji)}</span><div><b>${esc(a.name)}</b><small>${esc(a.cat)}</small></div><i class="bu-p ${z}" title="${esc(a.hint)}"></i></div>
        <div class="bu-d-jetzt ${z}"><small>Gerade</small><p>${esc(tutGerade(a))}</p></div>
        ${zl ? `<div class="bu-d-zuletzt"><small>Zuletzt · ${esc(zeitText(zl.at))}${zl.ok ? "" : " · Fehler"}</small><p>${esc(kurz(zl.titel, 140))}</p></div>` : `<div class="bu-d-zuletzt"><small>Zuletzt</small><p class="muted">Noch nichts im Logbuch.</p></div>`}
        ${a.heute ? `<p class="bu-d-text">Heute ${a.heute}× im Einsatz.</p>` : ""}
        <p class="bu-d-text">${esc(a.purpose)}</p>
        ${einsatzHtml(a)}
        <div class="bu-d-ex">${(a.examples || []).map((x) => `<button type="button" class="agent-chip">${esc(x)}</button>`).join("")}</div>
        <span class="agent-hint">${esc(a.hint)}</span>`;
    }
    if (alt) {
      const neu = $(alt.id);
      if (neu) { neu.value = alt.wert; if (alt.fokus) neu.focus(); }
    }
    detail.classList.remove("hidden");
  }
  detail?.addEventListener("click", (e) => {
    if (e.target.closest(".bu-zu")) { waehle(null); return; }
    const los = e.target.closest("[data-los]");
    if (los) { losschicken(los.dataset.los); return; }
    const vor = e.target.closest("[data-vorlesen]");
    if (vor) { const b = vor.dataset.vorlesen === "team" ? teamBericht : daten?.agents.find((x) => x.id === vor.dataset.vorlesen)?.bericht; if (b?.text) F.say?.(b.text); return; }
    const chip = e.target.closest(".agent-chip");
    if (chip) {
      const t = $("text");
      if (!t) return;
      $("agents-x")?.click();
      t.value = chip.textContent;
      t.focus();
    }
  });

  // ---------- Einsatz: Agenten wirklich losschicken ----------
  const laeuftEinsatz = new Set();
  let teamBericht = null;
  function berichtHtml(b) {
    if (!b) return "";
    return `<div class="bu-bericht ${b.ok === false ? "fehler" : ""}">
      <small>Bericht · ${esc(zeitText(b.at))}${b.quelle ? ` · ${esc(b.quelle)}` : ""}</small>
      <p>${esc(b.text)}</p>
      ${(b.punkte || []).length ? `<ul>${b.punkte.slice(0, 8).map((p) => `<li>${esc(kurz(p, 220))}</li>`).join("")}</ul>` : ""}
      <div class="bu-bericht-fuss">${b.text ? `<button type="button" class="ghost small" data-vorlesen="${esc(b.agent || "")}">🔊 Vorlesen</button>` : ""}${b.link ? `<a class="ghost small" href="${esc(b.link)}" target="_blank" rel="noopener">Quelle öffnen ↗</a>` : ""}</div>
    </div>`;
  }
  function einsatzHtml(a) {
    if (!a.einsatz) return "";
    const l = laeuftEinsatz.has(a.id) || a.arbeitet;
    const e = a.einsatz;
    return `<div class="bu-einsatz">
      ${e.eingabe ? `<label class="bu-eingabe"><span>${esc(e.eingabe.label)}</span><input type="text" id="bu-eingabe-${esc(a.id)}" placeholder="${esc(e.eingabe.platzhalter || "")}" maxlength="400" enterkeyhint="go"></label>` : ""}
      <button type="button" class="bu-los" data-los="${esc(a.id)}" ${l ? "disabled" : ""}>${l ? "⏳ Ist unterwegs …" : `🚀 ${esc(e.knopf)}`}</button>
    </div>
    ${berichtHtml(a.bericht ? { ...a.bericht, agent: a.id } : null)}`;
  }
  async function losschicken(id) {
    if (laeuftEinsatz.has(id)) return;
    const feld = $(`bu-eingabe-${id}`);
    const eingabe = feld ? feld.value.trim() : "";
    const a = daten?.agents.find((x) => x.id === id);
    if (a?.einsatz?.pflicht && !eingabe) { feld?.focus(); feld?.classList.add("fehlt"); return; }
    laeuftEinsatz.add(id);
    // Sofort sichtbar: der Roboter (oder beim Team alle) fängt an zu arbeiten
    const ids = id === "team" ? ["wetter", "strom", "pollen", "feiertage", "nachrichten"] : [id];
    for (const x of ids) { const ag = daten?.agents.find((y) => y.id === x); if (ag) { ag.arbeitet = true; ag.jetzt = ag.einsatz?.knopf ? `${ag.einsatz.knopf} …` : "Arbeitet …"; } }
    if (id === "team" && daten?.chefin) { daten.chefin.arbeitet = true; daten.chefin.jetzt = "Schickt das Team los …"; }
    aktualisiereSzene();
    if (auswahl) zeigeDetail(auswahl);
    try {
      const r = await api(`/api/agents/${encodeURIComponent(id)}/einsatz`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eingabe }) });
      const b = await r.json();
      if (id === "team") teamBericht = { ...b, agent: "team" };
      if (b?.text && (auswahl === id || (id === "team" && auswahl === "friday"))) F.say?.(b.text);
    } catch {
      if (id === "team") teamBericht = { ok: false, text: "Team nicht erreichbar.", at: new Date().toISOString(), agent: "team" };
    } finally {
      laeuftEinsatz.delete(id);
      await laden();
    }
  }

  // ---------- 3D-Szene (v1.165.0: echtes 3D) ----------
  // Physikalisch basiertes Licht (PBR), weiche Schatten, Spiegelungen aus einer Raum-Lichtumgebung,
  // Nachleuchten (Bloom) der Neon-Kanten und animierte 3D-Roboter (CC0-Modell) als Agenten.
  // Qualität richtet sich nach dem Gerät: Mac = alles, iPhone = ohne Bloom, Flüssig-Modus = ohne Schatten.
  let szene = null; // { renderer, scene, camera, ... }
  let laeuft = false;
  let rafId = 0;
  let pollId = 0;
  const handy = () => (window.FridayLeistung?.istHandy?.() ?? /iPhone|iPad|Android/i.test(navigator.userAgent));
  const fluessig = () => document.documentElement.classList.contains("perf-fluessig");
  // hoch = Mac (Bloom, große Schatten) · mittel = iPhone (Schatten ohne Bloom) · niedrig = Flüssig-Modus (ohne Schatten)
  function qualitaet() {
    const L = window.FridayLeistung;
    if (L?.modus === "fluessig") return "niedrig";
    if (handy()) return "mittel";
    return fluessig() ? "niedrig" : "hoch";
  }

  // Zusatz-Skripte erst laden, wenn das Büro wirklich geöffnet wird (Startseite bleibt schnell).
  const skripte = new Map();
  function ladeSkript(src) {
    if (!skripte.has(src)) {
      skripte.set(src, new Promise((ok, nein) => {
        const el = document.createElement("script");
        el.src = src; el.async = true;
        el.onload = () => ok(); el.onerror = () => { skripte.delete(src); nein(new Error(src)); };
        document.head.appendChild(el);
      }));
    }
    return skripte.get(src);
  }
  const ladeGlb = (url) => new Promise((ok, nein) => {
    if (!window.THREE?.GLTFLoader) { nein(new Error("GLTF-Lader fehlt")); return; }
    new window.THREE.GLTFLoader().load(url, ok, undefined, nein);
  });

  function textSprite(T, zeilen, { breite = 256, hoehe = 72, groesse = 1.6, farbe = "#ffd9b0", rand = true, hell = false } = {}) {
    const c = document.createElement("canvas");
    c.width = breite * 2; c.height = hoehe * 2;
    const g = c.getContext("2d");
    g.scale(2, 2);
    const tex = new T.CanvasTexture(c);
    tex.minFilter = T.LinearFilter;
    tex.encoding = T.sRGBEncoding;
    const mat = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const s = new T.Sprite(mat);
    s.scale.set(groesse, groesse * (hoehe / breite), 1);
    s.userData.zeichne = (z, opts = {}) => {
      g.clearRect(0, 0, breite, hoehe);
      if (rand) {
        const grad = g.createLinearGradient(0, 0, 0, hoehe);
        grad.addColorStop(0, opts.hell || hell ? "rgba(70,34,8,0.9)" : "rgba(22,12,5,0.85)");
        grad.addColorStop(1, opts.hell || hell ? "rgba(40,18,4,0.9)" : "rgba(8,5,3,0.85)");
        g.fillStyle = grad;
        g.strokeStyle = opts.kante || "rgba(255,138,30,0.8)";
        g.lineWidth = 2.5;
        const r = 14;
        g.beginPath();
        g.moveTo(r, 2); g.lineTo(breite - r, 2); g.quadraticCurveTo(breite - 2, 2, breite - 2, r);
        g.lineTo(breite - 2, hoehe - r); g.quadraticCurveTo(breite - 2, hoehe - 2, breite - r, hoehe - 2);
        g.lineTo(r, hoehe - 2); g.quadraticCurveTo(2, hoehe - 2, 2, hoehe - r);
        g.lineTo(2, r); g.quadraticCurveTo(2, 2, r, 2);
        g.closePath(); g.fill(); g.stroke();
      }
      g.textAlign = "center"; g.textBaseline = "middle";
      const n = z.filter(Boolean).length || 1;
      z.forEach((zeile, i) => {
        if (!zeile && i) return;
        const erste = i === 0;
        g.font = `${erste ? "600" : "400"} ${erste ? Math.round(hoehe * (n > 1 ? 0.34 : 0.46)) : Math.round(hoehe * 0.24)}px -apple-system, "SF Pro Text", "Segoe UI", sans-serif`;
        g.fillStyle = erste ? (opts.farbe || farbe) : "rgba(255,210,160,0.8)";
        const y = n === 1 ? hoehe / 2 : hoehe * (erste ? 0.38 : 0.74);
        g.fillText(zeile, breite / 2, y, breite - 16);
      });
      tex.needsUpdate = true;
    };
    s.userData.zeichne(zeilen);
    return s;
  }

  // Bildschirm am Arbeitsplatz: zeigt Symbol, Zustand und – beim Arbeiten – einen laufenden Balken.
  function monitorTextur(T) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 160;
    const tex = new T.CanvasTexture(c);
    tex.minFilter = T.LinearFilter;
    tex.encoding = T.sRGBEncoding;
    const g = c.getContext("2d");
    tex.userData = {
      zeichne(a, puls) {
        const z = zustand(a);
        const grad = g.createLinearGradient(0, 0, 0, 160);
        grad.addColorStop(0, z === "setup" ? "#1c1714" : "#2a1406");
        grad.addColorStop(1, z === "setup" ? "#0d0b0a" : "#0e0703");
        g.fillStyle = grad; g.fillRect(0, 0, 256, 160);
        const ak = z === "arbeitet" ? "#ffd27a" : z === "aktiv" ? "#ff8a1e" : z === "mac" ? "#f2c94c" : "#6b5d52";
        g.strokeStyle = "rgba(255,138,30,0.10)"; g.lineWidth = 1;
        for (let x = 0; x < 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 160); g.stroke(); }
        for (let y = 0; y < 160; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
        g.fillStyle = ak; g.fillRect(0, 0, 256, 5);
        g.font = "50px -apple-system, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(a.emoji || "•", 128, 62);
        g.font = "600 19px -apple-system, 'Segoe UI', sans-serif";
        g.fillStyle = ak;
        const zeile = z === "arbeitet" ? "ARBEITET" : z === "aktiv" ? "BEREIT" : z === "mac" ? "WARTET AUF MAC" : "EINRICHTEN";
        g.fillText(zeile, 128, 114);
        if (z === "arbeitet") {
          const w = 200, x0 = 28, p = (puls || 0) % 1;
          g.fillStyle = "rgba(255,210,122,0.22)"; g.fillRect(x0, 136, w, 7);
          g.fillStyle = "#ffd27a"; g.fillRect(x0 + p * (w - 60), 136, 60, 7);
        } else if (a.bericht?.ok) {
          g.font = "13px -apple-system, 'Segoe UI', sans-serif";
          g.fillStyle = "rgba(255,210,160,0.75)";
          g.fillText(`Bericht ${zeitText(a.bericht.at)}`, 128, 140, 230);
        }
        tex.needsUpdate = true;
      },
    };
    return tex;
  }

  // Boden mit Fugen-Raster: Fugen matter, Fliesen glänzend → echte Spiegelungen.
  function bodenTexturen(T) {
    const n = 512;
    const c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d");
    g.fillStyle = "#3a3a3a"; g.fillRect(0, 0, n, n); // Rauheit Fliese (dunkel = glatt)
    g.strokeStyle = "#d0d0d0"; g.lineWidth = 6;
    for (let i = 0; i <= n; i += n / 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, n); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(n, i); g.stroke(); }
    const rauh = new T.CanvasTexture(c);
    rauh.wrapS = rauh.wrapT = T.RepeatWrapping;
    rauh.repeat.set(9, 9);
    const f = document.createElement("canvas");
    f.width = f.height = n;
    const h = f.getContext("2d");
    h.fillStyle = "#17110d"; h.fillRect(0, 0, n, n);
    for (let i = 0; i < 1400; i++) { h.fillStyle = `rgba(${40 + Math.random() * 30},${28 + Math.random() * 18},${20 + Math.random() * 12},${Math.random() * 0.35})`; h.fillRect(Math.random() * n, Math.random() * n, 2, 2); }
    h.strokeStyle = "#0a0705"; h.lineWidth = 6;
    for (let i = 0; i <= n; i += n / 4) { h.beginPath(); h.moveTo(i, 0); h.lineTo(i, n); h.stroke(); h.beginPath(); h.moveTo(0, i); h.lineTo(n, i); h.stroke(); }
    const farbe = new T.CanvasTexture(f);
    farbe.encoding = T.sRGBEncoding;
    farbe.wrapS = farbe.wrapT = T.RepeatWrapping;
    farbe.repeat.set(9, 9);
    return { rauh, farbe };
  }

  // Farben im Code sind sRGB (wie im CSS) → für das physikalische Licht in linearen Raum umrechnen.
  function linearisiere(wurzel) {
    wurzel.traverse((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        if (!m || m.userData.lin) continue;
        m.userData.lin = true;
        m.color?.convertSRGBToLinear();
        m.emissive?.convertSRGBToLinear();
      }
    });
  }
  const setzeFarbe = (farbe, hex) => farbe.setHex(hex).convertSRGBToLinear();

  function rundePlatte(T, b, t, h, r) {
    const s = new T.Shape();
    const x = -b / 2, y = -t / 2;
    s.moveTo(x + r, y); s.lineTo(x + b - r, y); s.quadraticCurveTo(x + b, y, x + b, y + r);
    s.lineTo(x + b, y + t - r); s.quadraticCurveTo(x + b, y + t, x + b - r, y + t);
    s.lineTo(x + r, y + t); s.quadraticCurveTo(x, y + t, x, y + t - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const geo = new T.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 6 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -h / 2, 0);
    return geo;
  }

  function baueSzene() {
    const T = window.THREE;
    const leinwand = $("buero-leinwand");
    if (!T || !leinwand) return null;
    const q = qualitaet();
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: leinwand, antialias: q === "hoch", alpha: false, powerPreference: "high-performance" });
    } catch {
      return null;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, q === "niedrig" ? 1.25 : q === "mittel" ? 1.6 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x040302, 1);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.physicallyCorrectLights = false;
    renderer.shadowMap.enabled = q !== "niedrig";
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
    const scene = new T.Scene();
    scene.background = new T.Color(0x040302);
    scene.fog = new T.Fog(0x040302, 30, 70);
    const camera = new T.PerspectiveCamera(46, 1, 0.1, 200);

    const ak = new T.Color(akzent());
    const akHex = ak.getHex();

    // ---- Licht ----
    scene.add(new T.HemisphereLight(0xffd7b0, 0x1a0c05, 0.35));
    const sonne = new T.DirectionalLight(0xfff1e0, 1.15);
    sonne.position.set(9, 22, 12);
    sonne.castShadow = q !== "niedrig";
    sonne.shadow.mapSize.set(q === "hoch" ? 2048 : 1024, q === "hoch" ? 2048 : 1024);
    const sc = sonne.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 4; sc.far = 60;
    sonne.shadow.bias = -0.0006;
    sonne.shadow.normalBias = 0.02;
    sonne.shadow.radius = 3;
    scene.add(sonne);
    const kernLicht = new T.PointLight(akHex, 2.2, 22, 1.8);
    kernLicht.position.set(0, 3.4, 0);
    scene.add(kernLicht);
    const fuell = new T.DirectionalLight(0xff9a50, 0.35);
    fuell.position.set(-12, 6, -10);
    scene.add(fuell);

    // ---- Materialien (PBR) ----
    const tex = bodenTexturen(T);
    const M = {
      boden: new T.MeshStandardMaterial({ color: 0xffffff, map: tex.farbe, roughness: 1, roughnessMap: tex.rauh, metalness: 0.35, envMapIntensity: 0.45 }),
      metall: new T.MeshStandardMaterial({ color: 0x2e2824, metalness: 0.9, roughness: 0.3, envMapIntensity: 0.6 }),
      dunkel: new T.MeshStandardMaterial({ color: 0x141110, metalness: 0.55, roughness: 0.42 }),
      platte: new T.MeshStandardMaterial({ color: 0x1d1510, metalness: 0.25, roughness: 0.18, envMapIntensity: 0.5 }),
      neon: new T.MeshBasicMaterial({ color: new T.Color(akHex).multiplyScalar(1.6), toneMapped: false }),
      neonWarm: new T.MeshBasicMaterial({ color: 0xffc98a, toneMapped: false }),
      decke: new T.MeshBasicMaterial({ color: 0x8a4a18, toneMapped: false }),
      glas: new T.MeshStandardMaterial({ color: 0x2a1a10, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.14, envMapIntensity: 0.8, side: T.DoubleSide, depthWrite: false }),
      topf: new T.MeshStandardMaterial({ color: 0x2a2420, metalness: 0.1, roughness: 0.55 }),
      blatt: new T.MeshStandardMaterial({ color: 0x2f6b2c, metalness: 0, roughness: 0.6, side: T.DoubleSide }),
      tastatur: new T.MeshStandardMaterial({ color: 0x0f0d0c, metalness: 0.4, roughness: 0.5, emissive: akHex, emissiveIntensity: 0.06 }),
    };

    // ---- Raum: Boden, Lichtbänder, Glaswände mit Metallstützen, Deckenringe ----
    const RW = 21.5;
    const boden = new T.Mesh(new T.CircleGeometry(RW + 0.5, 96), M.boden);
    boden.rotation.x = -Math.PI / 2;
    boden.receiveShadow = true;
    scene.add(boden);
    for (const [r, b] of [[3.6, 0.05], [8.4, 0.03], [16.2, 0.04], [RW - 0.2, 0.06]]) {
      const band = new T.Mesh(new T.RingGeometry(r - b, r + b, 128), M.neon);
      band.rotation.x = -Math.PI / 2; band.position.y = 0.006;
      scene.add(band);
    }
    const stuetzeGeo = new T.BoxGeometry(0.22, 4.2, 0.22);
    const stuetzeLichtGeo = new T.BoxGeometry(0.035, 3.6, 0.035);
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
      const p0 = new T.Vector3(Math.cos(a0) * RW, 0, Math.sin(a0) * RW);
      const p1 = new T.Vector3(Math.cos(a1) * RW, 0, Math.sin(a1) * RW);
      const wand = new T.Mesh(new T.PlaneGeometry(p0.distanceTo(p1), 4.2), M.glas);
      wand.position.copy(p0.clone().add(p1).multiplyScalar(0.5)).setY(2.1);
      wand.lookAt(0, 2.1, 0);
      scene.add(wand);
      const st = new T.Mesh(stuetzeGeo, M.metall);
      st.position.copy(p0).setY(2.1);
      st.castShadow = q === "hoch";
      scene.add(st);
      const lt = new T.Mesh(stuetzeLichtGeo, M.neon);
      lt.position.copy(p0.clone().multiplyScalar((RW - 0.13) / RW)).setY(2.1);
      scene.add(lt);
    }
    const decke = new T.Group();
    for (const [r, y] of [[RW - 0.1, 4.2], [12.6, 5.2]]) {
      const ring = new T.Mesh(new T.TorusGeometry(r, 0.035, 8, 160), M.decke);
      ring.rotation.x = Math.PI / 2; ring.position.y = y;
      decke.add(ring);
    }
    scene.add(decke);

    // ---- Friday in der Mitte ----
    const chefin = new T.Group();
    const sockel = new T.Mesh(new T.CylinderGeometry(2.6, 2.95, 0.38, 64), M.metall);
    sockel.position.y = 0.19;
    sockel.castShadow = true; sockel.receiveShadow = true;
    chefin.add(sockel);
    const sockelOben = new T.Mesh(new T.CylinderGeometry(2.45, 2.55, 0.06, 64), M.platte);
    sockelOben.position.y = 0.41; sockelOben.receiveShadow = true;
    chefin.add(sockelOben);
    const sockelRing = new T.Mesh(new T.TorusGeometry(2.6, 0.035, 8, 96), M.neon);
    sockelRing.rotation.x = Math.PI / 2; sockelRing.position.y = 0.39;
    chefin.add(sockelRing);
    // Chef-Pult (Halbring mit Glasplatte)
    const pult = new T.Mesh(new T.TorusGeometry(1.75, 0.12, 12, 64, Math.PI * 1.15), M.platte);
    pult.rotation.x = Math.PI / 2; pult.rotation.z = Math.PI * 0.92; pult.position.y = 1.1;
    pult.castShadow = true;
    chefin.add(pult);
    const pultLicht = new T.Mesh(new T.TorusGeometry(1.87, 0.012, 6, 64, Math.PI * 1.15), M.neon);
    pultLicht.rotation.copy(pult.rotation); pultLicht.position.y = 1.1;
    chefin.add(pultLicht);
    // Hologramm-Figur (Ersatz, bis der echte Kopf geladen ist)
    const holoMat = new T.MeshStandardMaterial({ color: 0xffb066, emissive: akHex, emissiveIntensity: 0.9, transparent: true, opacity: 0.5, roughness: 0.2, metalness: 0.2, depthWrite: false });
    const koerper = new T.Mesh(new T.CylinderGeometry(0.32, 0.55, 1.6, 32, 1, true), holoMat);
    koerper.position.y = 1.3;
    chefin.add(koerper);
    const kopf = new T.Mesh(new T.SphereGeometry(0.36, 32, 24), holoMat);
    kopf.position.y = 2.4;
    chefin.add(kopf);
    const gitter = new T.Mesh(new T.IcosahedronGeometry(0.5, 1), new T.MeshBasicMaterial({ color: akHex, wireframe: true, transparent: true, opacity: 0.45, toneMapped: false }));
    gitter.position.y = 2.4;
    chefin.add(gitter);
    const reaktor = new T.Mesh(new T.TorusGeometry(0.16, 0.05, 10, 32), M.neonWarm);
    reaktor.position.set(0, 1.75, 0.42);
    chefin.add(reaktor);
    const ringe = [];
    for (let i = 0; i < 3; i++) {
      const r = new T.Mesh(new T.TorusGeometry(0.9 + i * 0.3, 0.016, 6, 96), new T.MeshBasicMaterial({ color: new T.Color(akHex).multiplyScalar(1.3), transparent: true, opacity: 0.75 - i * 0.18, toneMapped: false }));
      r.position.y = 1.5 + i * 0.45;
      r.rotation.x = Math.PI / 2 + (i - 1) * 0.35;
      chefin.add(r); ringe.push(r);
    }
    const strahl = new T.Mesh(new T.CylinderGeometry(0.9, 1.7, 7, 48, 1, true), new T.MeshBasicMaterial({ color: akHex, transparent: true, opacity: 0.05, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }));
    strahl.position.y = 3.9;
    chefin.add(strahl);
    const chefTreffer = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 3.4, 12), new T.MeshBasicMaterial({ visible: false }));
    chefTreffer.position.y = 1.7; chefTreffer.userData.id = "friday";
    chefin.add(chefTreffer);
    const chefSchild = textSprite(T, ["FRIDAY", "Chefin"], { breite: 300, hoehe: 96, groesse: 3.2, hell: true, farbe: "#ffe2b8" });
    chefSchild.position.y = 3.75;
    chefin.add(chefSchild);
    scene.add(chefin);

    const pickbar = [chefTreffer];
    const agenten = new Map();

    // Geometrie-Vorlagen der Arbeitsplätze (werden am Ende zu wenigen Zeichen-Aufrufen verschmolzen)
    const G = {
      platte: rundePlatte(T, 1.2, 0.64, 0.045, 0.08),
      kante: new T.BoxGeometry(1.14, 0.014, 0.014),
      bein: new T.BoxGeometry(0.05, 0.74, 0.52),
      fuss: new T.BoxGeometry(0.1, 0.02, 0.6),
      rahmen: rundePlatte(T, 0.86, 0.035, 0.54, 0.02),
      staender: new T.CylinderGeometry(0.018, 0.024, 0.26, 10),
      sfuss: new T.CylinderGeometry(0.11, 0.12, 0.016, 20),
      tastatur: new T.BoxGeometry(0.48, 0.016, 0.15),
      topf: new T.CylinderGeometry(0.2, 0.15, 0.42, 20),
      blatt: new T.ConeGeometry(0.07, 0.7, 4, 1, true),
    };
    G.rahmen.rotateX(Math.PI / 2); // aufrecht stellen
    const monGeo = new T.PlaneGeometry(0.78, 0.48);
    const trefferGeo = new T.BoxGeometry(1.25, 2.0, 1.7);
    const sammel = { metall: [], dunkel: [], platte: [], neon: [], tastatur: [], topf: [], blatt: [] };
    const hinzu = (art, geo, matrix) => { const g = geo.clone(); g.applyMatrix4(matrix); sammel[art].push(g); };

    const R = 12.6;      // Radius der Arbeitsplätze
    const SCHRITT = 1.6; // Abstand zwischen Tischen
    const abteilungen = [];
    const zonenMat = new T.MeshBasicMaterial({ color: akHex, transparent: true, opacity: 0.05, side: T.DoubleSide, depthWrite: false });
    const zonenRandMat = new T.MeshBasicMaterial({ color: new T.Color(akHex).multiplyScalar(1.4), transparent: true, opacity: 0.8, side: T.DoubleSide, toneMapped: false });
    const lichtLinieMat = () => new T.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.0, toneMapped: false });
    const schattenTex = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const g = c.getContext("2d");
      const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      r.addColorStop(0, "rgba(0,0,0,0.55)"); r.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
      return new T.CanvasTexture(c);
    })();
    const schattenMat = new T.MeshBasicMaterial({ map: schattenTex, transparent: true, depthWrite: false });
    const schattenGeo = new T.PlaneGeometry(0.9, 0.9);

    function pflanze(x, z) {
      const m = new T.Matrix4();
      hinzu("topf", G.topf, m.clone().makeTranslation(x, 0.21, z));
      for (let i = 0; i < 9; i++) {
        const w = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
        const neig = 0.25 + Math.random() * 0.35;
        const e = new T.Euler(Math.cos(w) * neig, 0, Math.sin(w) * neig);
        const mm = new T.Matrix4().compose(new T.Vector3(x + Math.sin(w) * 0.09, 0.72 + Math.random() * 0.1, z + Math.cos(w) * 0.09), new T.Quaternion().setFromEuler(e), new T.Vector3(1, 0.8 + Math.random() * 0.5, 0.35));
        hinzu("blatt", G.blatt, mm);
      }
    }

    function platziere(liste, kategorien) {
      const n = kategorien.length;
      kategorien.forEach((cat, ci) => {
        const mitte = -Math.PI / 2 + (ci / n) * Math.PI * 2;
        const mitglieder = liste.filter((a) => a.cat === cat);
        const breite = (mitglieder.length * SCHRITT) / R;
        const zone = new T.Mesh(new T.RingGeometry(R - 1.7, R + 2.0, 48, 1, -mitte - breite / 2 - 0.06, breite + 0.12), zonenMat);
        zone.rotation.x = -Math.PI / 2; zone.position.y = 0.008;
        scene.add(zone);
        const zr = new T.Mesh(new T.RingGeometry(R + 1.96, R + 2.03, 64, 1, -mitte - breite / 2 - 0.06, breite + 0.12), zonenRandMat);
        zr.rotation.x = -Math.PI / 2; zr.position.y = 0.012;
        scene.add(zr);
        const schild = textSprite(T, [cat.toUpperCase()], { breite: 480, hoehe: 64, groesse: 4.6, rand: false, farbe: "#ffa040" });
        schild.position.set(Math.cos(mitte) * (R + 3.3), 0.95, Math.sin(mitte) * (R + 3.3));
        scene.add(schild);
        abteilungen.push({ cat, mitte, schild });
        // Pflanzen an den Enden jeder Abteilung
        for (const s of [-1, 1]) {
          const w = mitte + s * (breite / 2 + 0.03);
          pflanze(Math.cos(w) * (R + 0.9), Math.sin(w) * (R + 0.9));
        }

        mitglieder.forEach((a, i) => {
          const winkel = mitte + (i - (mitglieder.length - 1) / 2) * (SCHRITT / R);
          const g = new T.Group();
          g.position.set(Math.cos(winkel) * R, 0, Math.sin(winkel) * R);
          g.lookAt(0, 0, 0); // lokal +z zeigt zur Mitte
          g.updateMatrixWorld(true);
          const W = g.matrixWorld;
          const at = (x, y, z, rx = 0, ry = 0) => new T.Matrix4().multiplyMatrices(W, new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, 0)), new T.Vector3(1, 1, 1)));
          // Tisch (verschmolzen)
          hinzu("platte", G.platte, at(0, 0.76, 0));
          hinzu("neon", G.kante, at(0, 0.745, 0.33));
          for (const sx of [-0.52, 0.52]) { hinzu("metall", G.bein, at(sx, 0.37, 0)); hinzu("metall", G.fuss, at(sx, 0.01, 0)); }
          hinzu("dunkel", G.rahmen, at(0, 1.12, 0.14));
          hinzu("metall", G.staender, at(0, 0.9, 0.17));
          hinzu("metall", G.sfuss, at(0, 0.79, 0.17));
          hinzu("tastatur", G.tastatur, at(0, 0.79, -0.13));
          // Bildschirm (eigene Textur je Agent) – zeigt zum Agenten (nach außen)
          const mtex = monitorTextur(T);
          const monitor = new T.Mesh(monGeo, new T.MeshBasicMaterial({ map: mtex, toneMapped: false }));
          monitor.position.set(0, 1.12, 0.12);
          monitor.rotation.y = Math.PI;
          g.add(monitor);
          // Ersatz-Figur (bis die 3D-Roboter geladen sind, oder wenn sie nicht laden)
          const mat = new T.MeshStandardMaterial({ color: 0xffa04a, emissive: akHex, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.3 });
          const figur = new T.Group();
          const fk = new T.Mesh(new T.CylinderGeometry(0.16, 0.24, 0.9, 16), mat); fk.position.y = 0.62; fk.castShadow = true;
          const fh = new T.Mesh(new T.SphereGeometry(0.17, 18, 14), mat); fh.position.y = 1.26; fh.castShadow = true;
          figur.add(fk, fh);
          figur.position.set(0, 0, -0.62);
          g.add(figur);
          const blob = new T.Mesh(schattenGeo, schattenMat);
          blob.rotation.x = -Math.PI / 2; blob.position.set(0, 0.011, -0.62);
          blob.visible = q !== "hoch";
          g.add(blob);
          const treffer = new T.Mesh(trefferGeo, new T.MeshBasicMaterial({ visible: false }));
          treffer.position.set(0, 1.0, -0.25);
          treffer.userData.id = a.id;
          g.add(treffer);
          pickbar.push(treffer);
          const ring = new T.Mesh(new T.RingGeometry(0.72, 0.8, 48), new T.MeshBasicMaterial({ color: new T.Color(0xffe2b8).multiplyScalar(1.3), transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, toneMapped: false }));
          ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.02, -0.4);
          g.add(ring);
          const schildA = textSprite(T, [`${a.emoji} ${a.name}`, ""], { breite: 300, hoehe: 84, groesse: 1.55 });
          schildA.position.set(0, 2.15, -0.5);
          g.add(schildA);
          scene.add(g);
          const welt = new T.Vector3(Math.cos(winkel) * R, 1.4, Math.sin(winkel) * R);
          const ziel = new T.Vector3(0, 2.0, 0);
          const kurve = new T.QuadraticBezierCurve3(welt, welt.clone().lerp(ziel, 0.5).setY(4.8), ziel);
          const linie = new T.Line(new T.BufferGeometry().setFromPoints(kurve.getPoints(48)), lichtLinieMat());
          scene.add(linie);
          const punkt = new T.Mesh(new T.SphereGeometry(0.08, 12, 8), new T.MeshBasicMaterial({ color: new T.Color(0xffe2b8).multiplyScalar(2), transparent: true, opacity: 0, toneMapped: false }));
          scene.add(punkt);
          agenten.set(a.id, { gruppe: g, figur, kopf: fh, mat, monitor: mtex, schild: schildA, ring, winkel, kurve, linie, punkt, blob, phase: Math.random() * 6, zustand: "", daten: a, roboter: null });
        });
      });
      // Alle Tische, Beine, Bildschirmrahmen und Pflanzen zu je einem Zeichen-Aufruf verschmelzen
      const BGU = T.BufferGeometryUtils;
      for (const [art, geos] of Object.entries(sammel)) {
        if (!geos.length) continue;
        const liste = BGU ? [BGU.mergeBufferGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)))] : geos;
        for (const geo of liste) {
          if (!geo) continue;
          const mesh = new T.Mesh(geo, M[art]);
          mesh.castShadow = art !== "neon" && q !== "niedrig";
          mesh.receiveShadow = art === "platte" || art === "metall";
          scene.add(mesh);
        }
        sammel[art] = [];
      }
      linearisiere(scene);
    }

    // Schwebende Funken (nicht im Flüssig-Modus)
    let funken = null;
    if (q !== "niedrig") {
      const N = q === "hoch" ? 420 : 220;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const r = Math.random() * 20, w = Math.random() * Math.PI * 2;
        pos[i * 3] = Math.cos(w) * r; pos[i * 3 + 1] = Math.random() * 6; pos[i * 3 + 2] = Math.sin(w) * r;
      }
      const gg = new T.BufferGeometry();
      gg.setAttribute("position", new T.BufferAttribute(pos, 3));
      funken = new T.Points(gg, new T.PointsMaterial({ color: new T.Color(akHex).multiplyScalar(1.5), size: 0.05, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }));
      scene.add(funken);
    }

    linearisiere(scene);
    return { T, q, renderer, scene, camera, chefin, ringe, gitter, kopf, koerper, holoMat, strahl, kernLicht, sockelRing, pickbar, agenten, platziere, abteilungen, funken, M, composer: null, mixer: [], aufgebaut: false };
  }

  // Raum-Licht (Spiegelungen), Nachleuchten und echte 3D-Modelle nachladen – ohne den Start zu bremsen.
  async function veredle() {
    if (!szene || szene.veredelt) return;
    szene.veredelt = true;
    const { T } = szene;
    try { await ladeSkript("vendor/three-extras.js"); } catch { return; }
    if (!szene) return;
    // Spiegelungen: vorgefilterte Raum-Lichtumgebung
    try {
      if (T.RoomEnvironment) {
        const pm = new T.PMREMGenerator(szene.renderer);
        szene.scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
        pm.dispose();
      }
    } catch { /* ohne Spiegelungen weiter */ }
    // Nachleuchten (Bloom) nur auf starken Geräten
    try {
      if (szene.q === "hoch" && T.EffectComposer && T.UnrealBloomPass) {
        const leinwand = $("buero-leinwand");
        const w = leinwand.clientWidth || 800, h = leinwand.clientHeight || 600;
        const comp = new T.EffectComposer(szene.renderer);
        comp.addPass(new T.RenderPass(szene.scene, szene.camera));
        const bloom = new T.UnrealBloomPass(new T.Vector2(w, h), 0.75, 0.45, 0.82);
        comp.addPass(bloom);
        if (T.GammaCorrectionShader) comp.addPass(new T.ShaderPass(T.GammaCorrectionShader));
        szene.composer = comp;
        szene.bloom = bloom;
        groesse();
      }
    } catch { szene.composer = null; }
    // Echte 3D-Roboter
    ladeGlb("vendor/roboter.glb").then((gltf) => { szene.roboterVorlage = gltf; if (szene.aufgebaut) setzeRoboter(); }).catch(() => { /* Ersatz-Figuren bleiben */ });
    // Fridays Kopf als Hologramm in der Mitte
    ladeGlb("vendor/head.glb").then((gltf) => {
      let geo = null;
      gltf.scene.traverse((o) => { if (o.isMesh && !geo) geo = o.geometry; });
      if (!geo || !szene) return;
      geo = geo.clone(); geo.center(); geo.computeBoundingBox();
      const hoehe = geo.boundingBox.max.y - geo.boundingBox.min.y;
      const s = 1.5 / hoehe;
      const holo = new T.MeshStandardMaterial({ color: 0x281206, emissive: akzent(), emissiveIntensity: 0.6, metalness: 0.85, roughness: 0.25, envMapIntensity: 0.7 });
      const k = new T.Mesh(geo, holo);
      k.scale.setScalar(s); k.position.y = 2.2;
      k.castShadow = true;
      const netz = new T.Mesh(geo, new T.MeshBasicMaterial({ color: new T.Color(akzent()).multiplyScalar(1.4), wireframe: true, transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false }));
      netz.scale.setScalar(s * 1.01); netz.position.y = 2.2;
      linearisiere(k); linearisiere(netz);
      szene.chefin.add(k, netz);
      szene.kopf.visible = false;
      szene.koerper.visible = false;
      szene.gitter.scale.setScalar(1.9);
      szene.gitter.material.opacity = 0.16;
      szene.echterKopf = k; szene.kopfNetz = netz;
    }).catch(() => { /* Kugel bleibt */ });
  }

  // Jeder Agent bekommt seinen eigenen animierten Roboter (Leerlauf, Arbeiten, Winken, Daumen hoch).
  function setzeRoboter() {
    const T = szene?.T;
    const vorlage = szene?.roboterVorlage;
    if (!T || !vorlage || szene.roboterGesetzt) return;
    szene.roboterGesetzt = true;
    const box = new T.Box3().setFromObject(vorlage.scene);
    const hoehe = box.max.y - box.min.y || 1;
    const massstab = 1.42 / hoehe;
    const klon = T.SkeletonUtils?.clone || ((o) => o.clone(true));
    const schatten = szene.q === "hoch"; // iPhone: Roboter mit weichem Bodenschatten statt Schattenwurf
    for (const s of szene.agenten.values()) {
      const r = klon(vorlage.scene);
      r.scale.setScalar(massstab);
      r.position.set(0, 0, -0.66);
      const mats = { haupt: [], alle: [] };
      r.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = schatten;
        o.frustumCulled = !o.isSkinnedMesh; // Hände sind gehäutet (Grenzen stimmen nicht), Rest darf ausgeblendet werden
        const neu = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
        o.material = neu;
        for (const m of Array.isArray(neu) ? neu : [neu]) {
          m.userData.lin = true;
          m.envMapIntensity = 0.55;
          if (m.name === "Main") { m.metalness = 0.55; m.roughness = 0.32; mats.haupt.push(m); }
          else if (m.name === "Grey") { setzeFarbe(m.color, 0x3b3633); m.metalness = 0.85; m.roughness = 0.28; }
          else { m.metalness = 0.3; m.roughness = 0.5; }
          mats.alle.push(m);
        }
      });
      const mixer = new T.AnimationMixer(r);
      const clip = (n) => T.AnimationClip.findByName(vorlage.animations, n);
      const akt = {};
      for (const n of ["Idle", "Yes", "Wave", "ThumbsUp", "Sitting"]) {
        const c = clip(n);
        if (c) akt[n] = mixer.clipAction(c);
      }
      for (const n of ["Wave", "ThumbsUp"]) if (akt[n]) { akt[n].setLoop(T.LoopOnce, 1); akt[n].clampWhenFinished = true; }
      if (akt.Sitting) { akt.Sitting.setLoop(T.LoopOnce, 1); akt.Sitting.clampWhenFinished = true; }
      mixer.addEventListener("finished", () => spieleZustand(s, true));
      s.gruppe.add(r);
      s.figur.visible = false;
      s.roboter = { obj: r, mixer, akt, mats, jetzt: null };
      szene.mixer.push(mixer);
      s.zustand = ""; // neu einfärben
    }
    aktualisiereSzene();
  }

  function blende(s, name, dauer = 0.35) {
    const rb = s.roboter;
    if (!rb?.akt[name] || rb.jetzt === name) return;
    const neu = rb.akt[name];
    neu.reset().setEffectiveWeight(1).fadeIn(dauer).play();
    if (rb.jetzt && rb.akt[rb.jetzt]) rb.akt[rb.jetzt].fadeOut(dauer);
    rb.jetzt = name;
  }
  function spieleZustand(s, sofort) {
    const rb = s.roboter;
    if (!rb) return;
    const z = s.zustand;
    const ziel = z === "arbeitet" ? "Yes" : "Idle";
    if (sofort) rb.jetzt = rb.jetzt === ziel ? null : rb.jetzt;
    blende(s, ziel);
    if (rb.akt.Idle) rb.akt.Idle.timeScale = z === "setup" ? 0.35 : 1;
    if (rb.akt.Yes) rb.akt.Yes.timeScale = 0.7;
  }
  function geste(id, name) {
    const s = szene?.agenten.get(id);
    if (s?.roboter?.akt[name]) blende(s, name, 0.25);
  }

  // Farben/Bildschirme/Linien an den echten Status anpassen
  const ROBO_FARBE = { aktiv: 0xd9741c, arbeitet: 0xffb347, mac: 0xc9a23a, setup: 0x4a423c };
  function aktualisiereSzene() {
    if (!szene || !daten) return;
    if (!szene.aufgebaut) {
      szene.platziere(daten.agents, daten.categories);
      szene.aufgebaut = true;
      if (szene.roboterVorlage) setzeRoboter();
      if (wartendeAuswahl) { const w = wartendeAuswahl; wartendeAuswahl = null; waehle(w); }
    }
    for (const a of daten.agents) {
      const s = szene.agenten.get(a.id);
      if (!s) continue;
      const alt = s.daten;
      s.daten = a;
      const z = zustand(a);
      if (z !== s.zustand) {
        const vorher = s.zustand;
        s.zustand = z;
        const farbe = FARBE[z];
        setzeFarbe(s.mat.color, z === "setup" ? 0x3a322c : z === "arbeitet" ? 0xffe2b8 : 0xffa04a);
        setzeFarbe(s.mat.emissive, farbe);
        s.mat.emissiveIntensity = z === "setup" ? 0.05 : z === "arbeitet" ? 0.9 : 0.35;
        if (s.roboter) {
          for (const m of s.roboter.mats.haupt) {
            setzeFarbe(m.color, ROBO_FARBE[z]);
            setzeFarbe(m.emissive, z === "arbeitet" ? 0xff8a1e : z === "setup" ? 0x000000 : 0x3a1600);
            m.emissiveIntensity = z === "arbeitet" ? 0.5 : 0.3;
          }
          spieleZustand(s, true);
          // Fertig mit Bericht → Daumen hoch
          if (vorher === "arbeitet" && z !== "arbeitet" && a.bericht?.ok) geste(a.id, "ThumbsUp");
        }
        s.monitor.userData.zeichne(a, 0);
      } else if (alt?.bericht?.at !== a.bericht?.at) {
        s.monitor.userData.zeichne(a, 0);
      }
      const zeile2 = a.arbeitet ? kurz(a.jetzt, 28) : a.status === "aktiv" ? (a.zuletzt ? `zuletzt ${zeitText(a.zuletzt.at)}` : a.einsatz ? "bereit · Einsatz möglich" : "bereit") : a.status === "mac" ? "braucht Mac" : "einrichten";
      const neu = `${a.emoji} ${a.name}|${zeile2}|${z}`;
      if (s.schildText !== neu) {
        s.schildText = neu;
        s.schild.userData.zeichne([`${a.emoji} ${a.name}`, zeile2], { kante: z === "arbeitet" ? "rgba(255,226,184,0.95)" : z === "setup" ? "rgba(120,100,85,0.6)" : undefined, hell: z === "arbeitet" });
        s.schild.material.opacity = z === "setup" ? 0.6 : 1;
      }
    }
  }

  // ---------- Kamera (eigene, leichte Orbit-Steuerung) ----------
  const kam = { theta: Math.PI / 2, phi: 0.9, radius: 21, ziel: { x: 0, y: 0.8, z: 0 } };
  const soll = { theta: Math.PI / 2, phi: 0.9, radius: 21, ziel: { x: 0, y: 0.8, z: 0 } };
  let letzteEingabe = 0;
  const begrenze = () => {
    soll.phi = Math.max(0.35, Math.min(1.38, soll.phi));
    soll.radius = Math.max(6, Math.min(46, soll.radius));
  };
  function hochformat() {
    const leinwand = $("buero-leinwand");
    return Boolean(leinwand && leinwand.clientHeight > leinwand.clientWidth * 1.05);
  }
  const startRadius = () => (hochformat() ? 36 : 25);
  const startPhi = () => (hochformat() ? 0.62 : 0.9);

  let wartendeAuswahl = null;
  function waehle(id) {
    if (id && id !== "friday" && (!szene || !szene.aufgebaut)) { wartendeAuswahl = id; return; }
    auswahl = id;
    if (!id) {
      detail?.classList.add("hidden");
      soll.ziel = { x: 0, y: 0.8, z: 0 };
      soll.radius = startRadius();
      soll.phi = startPhi();
    } else if (id === "friday") {
      soll.ziel = { x: 0, y: hochformat() ? -1.2 : 1.6, z: 0 };
      soll.radius = hochformat() ? 14 : 11;
      soll.phi = 1.05;
      zeigeDetail(id);
    } else if (szene) {
      const s = szene.agenten.get(id);
      if (s) {
        const p = s.gruppe.position;
        // Auf dem Handy liegt die Detail-Karte unten → Blickpunkt tiefer, damit die Agentin oben im Bild steht
        soll.ziel = { x: p.x * 0.92, y: hochformat() ? -1.6 : 1.0, z: p.z * 0.92 };
        // Kamera hinter die Agentin (außen), Blick über die Schulter zur Mitte
        soll.theta = Math.atan2(p.z, p.x);
        soll.radius = 7.5;
        soll.phi = 0.85;
        geste(id, "Wave");
        // theta auf kürzestem Weg
        while (soll.theta - kam.theta > Math.PI) soll.theta -= Math.PI * 2;
        while (soll.theta - kam.theta < -Math.PI) soll.theta += Math.PI * 2;
      }
      zeigeDetail(id);
    }
    if (szene) {
      for (const [aid, s] of szene.agenten) s.ring.material.opacity = aid === id ? 0.9 : 0;
    }
    letzteEingabe = performance.now();
  }

  // Zeiger: ziehen = drehen, zwei Finger/Mausrad = zoomen, kurz tippen = auswählen
  const zeiger = new Map();
  let start = null;
  let pinchStart = 0;
  function eingabeAn(leinwand) {
    leinwand.addEventListener("pointerdown", (e) => {
      leinwand.setPointerCapture?.(e.pointerId);
      zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (zeiger.size === 1) start = { x: e.clientX, y: e.clientY, t: performance.now(), bewegt: false };
      if (zeiger.size === 2) { const [a, b] = [...zeiger.values()]; pinchStart = Math.hypot(a.x - b.x, a.y - b.y); start && (start.bewegt = true); }
      letzteEingabe = performance.now();
    });
    leinwand.addEventListener("pointermove", (e) => {
      const alt = zeiger.get(e.pointerId);
      if (!alt) return;
      const dx = e.clientX - alt.x, dy = e.clientY - alt.y;
      zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (zeiger.size === 2) {
        const [a, b] = [...zeiger.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchStart > 0) { soll.radius *= pinchStart / Math.max(1, d); pinchStart = d; begrenze(); }
      } else if (zeiger.size === 1) {
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) start.bewegt = true;
        if (start?.bewegt) {
          soll.theta += dx * 0.008;
          soll.phi -= dy * 0.006;
          begrenze();
        }
      }
      letzteEingabe = performance.now();
    });
    const ende = (e) => {
      const war = zeiger.has(e.pointerId);
      zeiger.delete(e.pointerId);
      if (zeiger.size < 2) pinchStart = 0;
      if (war && zeiger.size === 0 && start && !start.bewegt && performance.now() - start.t < 500 && e.type === "pointerup") tippe(e, leinwand);
      if (zeiger.size === 0) start = null;
    };
    leinwand.addEventListener("pointerup", ende);
    leinwand.addEventListener("pointercancel", ende);
    leinwand.addEventListener("wheel", (e) => { e.preventDefault(); soll.radius *= 1 + Math.sign(e.deltaY) * 0.08; begrenze(); letzteEingabe = performance.now(); }, { passive: false });
    leinwand.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") soll.theta -= 0.2;
      else if (e.key === "ArrowRight") soll.theta += 0.2;
      else if (e.key === "ArrowUp" || e.key === "+") soll.radius *= 0.9;
      else if (e.key === "ArrowDown" || e.key === "-") soll.radius *= 1.1;
      else return;
      e.preventDefault(); begrenze(); letzteEingabe = performance.now();
    });
  }

  function tippe(e, leinwand) {
    if (!szene) return;
    const T = szene.T;
    const r = leinwand.getBoundingClientRect();
    const v = new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new T.Raycaster();
    ray.setFromCamera(v, szene.camera);
    const hit = ray.intersectObjects(szene.pickbar, false)[0];
    waehle(hit ? hit.object.userData.id : null);
  }

  // ---------- Zeichnen ----------
  let letzteZeit = 0;
  let monitorTakt = 0;
  function bild(t) {
    if (!laeuft || !szene) return;
    rafId = requestAnimationFrame(bild);
    const fps = szene.q === "hoch" ? 60 : 30;
    if (t - letzteZeit < 1000 / fps - 2) return;
    const dt = Math.min(0.1, (t - letzteZeit) / 1000 || 0.016);
    letzteZeit = t;
    const { T, renderer, scene, camera } = szene;

    // Langsames Kreisen, wenn niemand bedient und nichts ausgewählt ist
    if (!auswahl && t - letzteEingabe > 4000) soll.theta += dt * 0.05;
    const k = 1 - Math.pow(0.002, dt);
    kam.theta += (soll.theta - kam.theta) * k;
    kam.phi += (soll.phi - kam.phi) * k;
    kam.radius += (soll.radius - kam.radius) * k;
    for (const a of ["x", "y", "z"]) kam.ziel[a] += (soll.ziel[a] - kam.ziel[a]) * k;
    const sp = Math.sin(kam.phi);
    camera.position.set(kam.ziel.x + kam.radius * sp * Math.cos(kam.theta), kam.ziel.y + kam.radius * Math.cos(kam.phi), kam.ziel.z + kam.radius * sp * Math.sin(kam.theta));
    camera.lookAt(kam.ziel.x, kam.ziel.y, kam.ziel.z);

    const s = t / 1000;
    // Friday lebt
    const chefArbeitet = Boolean(daten?.chefin?.arbeitet);
    szene.ringe.forEach((r, i) => { r.rotation.z += dt * (0.4 + i * 0.25) * (chefArbeitet ? 2.2 : 1) * (i % 2 ? -1 : 1); });
    szene.gitter.rotation.y += dt * 0.5;
    szene.gitter.rotation.x += dt * 0.2;
    szene.strahl.material.opacity = 0.05 + Math.sin(s * 1.6) * 0.02 + (chefArbeitet ? 0.05 : 0);
    szene.kernLicht.intensity = 1.4 + Math.sin(s * 2) * 0.2 + (chefArbeitet ? 0.6 : 0);
    szene.chefin.position.y = Math.sin(s * 1.2) * 0.04;
    if (szene.echterKopf) {
      szene.echterKopf.rotation.y = Math.sin(s * 0.35) * 0.6;
      szene.kopfNetz.rotation.y = szene.echterKopf.rotation.y;
      szene.echterKopf.material.emissiveIntensity = 0.45 + Math.sin(s * 2.2) * 0.12 + (chefArbeitet ? 0.35 : 0);
    }
    // Animationen: auf dem Handy nur jedes zweite Bild (spart Rechenzeit, sieht gleich aus)
    szene.takt = (szene.takt || 0) + 1;
    const mixDt = (szene.mixDt || 0) + dt;
    if (szene.q === "hoch" || szene.takt % 2 === 0) { for (const m of szene.mixer) m.update(mixDt); szene.mixDt = 0; } else szene.mixDt = mixDt;
    if (szene.funken) szene.funken.rotation.y += dt * 0.02;

    // Agenten: atmen, arbeitende pulsieren und schicken Daten zu Friday
    monitorTakt += dt;
    const monitorNeu = monitorTakt > 0.12;
    if (monitorNeu) monitorTakt = 0;
    for (const a of szene.agenten.values()) {
      const z = a.zustand;
      const atmen = Math.sin(s * 1.6 + a.phase);
      if (!a.roboter) a.kopf.position.y = 1.26 + atmen * 0.015;
      if (z === "arbeitet") {
        a.mat.emissiveIntensity = 0.7 + Math.sin(s * 6 + a.phase) * 0.3;
        if (!a.roboter) a.kopf.rotation.y = Math.sin(s * 3 + a.phase) * 0.4;
        a.linie.material.opacity = 0.55 + Math.sin(s * 4) * 0.2;
        const p = (s * 0.6 + a.phase) % 1;
        a.punkt.position.copy(a.kurve.getPoint(p));
        a.punkt.material.opacity = 0.95;
        if (monitorNeu) a.monitor.userData.zeichne(a.daten, s * 0.8);
      } else {
        a.linie.material.opacity = 0;
        a.punkt.material.opacity = 0;
        a.kopf.rotation.y *= 0.95;
      }
      if (a.ring.material.opacity > 0) a.ring.rotation.z += dt;
    }
    if (szene.composer) szene.composer.render(dt); else renderer.render(scene, camera);
  }

  function groesse() {
    if (!szene) return;
    const leinwand = $("buero-leinwand");
    const w = leinwand.clientWidth || 1, h = leinwand.clientHeight || 1;
    szene.renderer.setSize(w, h, false);
    szene.camera.aspect = w / h;
    szene.camera.updateProjectionMatrix();
    if (szene.composer) { szene.composer.setPixelRatio?.(szene.renderer.getPixelRatio()); szene.composer.setSize(w, h); }
  }

  function zeigeFallback(text) {
    const f = $("buero-fallback");
    if (f) { f.textContent = text; f.classList.remove("hidden"); }
  }

  function starte() {
    if (laeuft) return;
    if (!szene) {
      if (!window.THREE) { zeigeFallback("3D wird geladen …"); setTimeout(pruefeLauf, 500); return; }
      szene = baueSzene();
      if (!szene) { zeigeFallback("Dieses Gerät kann das 3D-Büro nicht zeigen. Tipp oben auf ☰ Liste."); return; }
      $("buero-fallback")?.classList.add("hidden");
      eingabeAn($("buero-leinwand"));
      new ResizeObserver(groesse).observe($("buero-leinwand"));
      soll.radius = kam.radius = startRadius();
      soll.phi = kam.phi = startPhi();
      if (daten) aktualisiereSzene();
    }
    groesse();
    veredle();
    laeuft = true;
    letzteZeit = 0;
    rafId = requestAnimationFrame(bild);
  }
  function stoppe() {
    laeuft = false;
    cancelAnimationFrame(rafId);
  }

  function offen() { return !sheet.classList.contains("hidden"); }
  function pruefeLauf() {
    const sichtbar = offen() && ansicht === "buero" && !document.hidden;
    if (sichtbar) starte(); else stoppe();
    // Status regelmäßig frisch holen, solange das Fenster offen ist
    if (offen() && !pollId) { laden(); pollId = setInterval(() => { if (!document.hidden) laden(); }, 4000); }
    if (!offen() && pollId) { clearInterval(pollId); pollId = 0; if (auswahl) waehle(null); }
  }

  new MutationObserver(pruefeLauf).observe(sheet, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener("visibilitychange", pruefeLauf);
  zeigeAnsicht(ansicht, false);

  detail?.addEventListener("keydown", (e) => {
    const f = e.target.closest?.(".bu-eingabe input");
    if (f && e.key === "Enter") { e.preventDefault(); losschicken(f.id.replace("bu-eingabe-", "")); }
  });
  // Von außen (Sprachbefehl "schick den Pollen-Agenten los"): Büro öffnen und Agent zeigen
  function zeige(id) {
    window.FridayAgenten?.open?.();
    zeigeAnsicht("buero", false);
    if (id) setTimeout(() => waehle(id), 50);
  }
  window.Friday = Object.assign(window.Friday || {}, { buero: { waehle, laden, zeige, losschicken, get daten() { return daten; }, get szene() { return szene; } } });
})();
