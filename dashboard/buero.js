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
    if (id === "friday") {
      const c = daten.chefin || {};
      const arbeiter = daten.agents.filter((a) => a.arbeitet);
      detail.innerHTML = `<button type="button" class="bu-zu" aria-label="Schließen">✕</button>
        <div class="bu-d-kopf"><span class="bu-d-emoji">✦</span><div><b>FRIDAY</b><small>Chefin · leitet ${daten.gesamt} Agenten</small></div></div>
        <div class="bu-d-jetzt ${c.arbeitet ? "arbeitet" : ""}"><small>Gerade</small><p>${esc(c.jetzt || "Leitet das Team")}</p>${c.arbeitet ? `<div class="bu-balken"><i style="width:${Math.max(5, Math.min(100, c.prozent || 0))}%"></i></div>` : ""}</div>
        <p class="bu-d-text">${arbeiter.length ? `Im Einsatz: ${arbeiter.map((a) => `${esc(a.emoji)} ${esc(a.name)}`).join(", ")}.` : "Kein Agent ist gerade im Einsatz. Gib Friday einen Auftrag, dann siehst du hier, wer daran arbeitet."}</p>
        <p class="bu-d-text muted">${daten.aktiv} Agenten sind einsatzbereit, ${daten.gesamt - daten.aktiv} brauchen noch den Mac oder eine Verbindung.</p>`;
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
        <div class="bu-d-ex">${(a.examples || []).map((x) => `<button type="button" class="agent-chip">${esc(x)}</button>`).join("")}</div>
        <span class="agent-hint">${esc(a.hint)}</span>`;
    }
    detail.classList.remove("hidden");
  }
  detail?.addEventListener("click", (e) => {
    if (e.target.closest(".bu-zu")) { waehle(null); return; }
    const chip = e.target.closest(".agent-chip");
    if (chip) {
      const t = $("text");
      if (!t) return;
      $("agents-x")?.click();
      t.value = chip.textContent;
      t.focus();
    }
  });

  // ---------- 3D-Szene ----------
  let szene = null; // { renderer, scene, camera, ... }
  let laeuft = false;
  let rafId = 0;
  let pollId = 0;
  const handy = () => (window.FridayLeistung?.istHandy?.() ?? /iPhone|iPad|Android/i.test(navigator.userAgent));
  const fluessig = () => document.documentElement.classList.contains("perf-fluessig");

  function textSprite(T, zeilen, { breite = 256, hoehe = 72, groesse = 1.6, farbe = "#ffd9b0", rand = true, hell = false } = {}) {
    const c = document.createElement("canvas");
    c.width = breite; c.height = hoehe;
    const g = c.getContext("2d");
    const tex = new T.CanvasTexture(c);
    tex.minFilter = T.LinearFilter;
    const mat = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const s = new T.Sprite(mat);
    s.scale.set(groesse, groesse * (hoehe / breite), 1);
    s.userData.zeichne = (z, opts = {}) => {
      g.clearRect(0, 0, breite, hoehe);
      if (rand) {
        g.fillStyle = opts.hell || hell ? "rgba(60,30,6,0.86)" : "rgba(14,8,3,0.78)";
        g.strokeStyle = opts.kante || "rgba(255,138,30,0.75)";
        g.lineWidth = 3;
        const r = 16;
        g.beginPath();
        g.moveTo(r, 2); g.lineTo(breite - r, 2); g.quadraticCurveTo(breite - 2, 2, breite - 2, r);
        g.lineTo(breite - 2, hoehe - r); g.quadraticCurveTo(breite - 2, hoehe - 2, breite - r, hoehe - 2);
        g.lineTo(r, hoehe - 2); g.quadraticCurveTo(2, hoehe - 2, 2, hoehe - r);
        g.lineTo(2, r); g.quadraticCurveTo(2, 2, r, 2);
        g.closePath(); g.fill(); g.stroke();
      }
      g.textAlign = "center"; g.textBaseline = "middle";
      const n = z.length;
      z.forEach((zeile, i) => {
        const erste = i === 0;
        g.font = `${erste ? "600" : "400"} ${erste ? Math.round(hoehe * (n > 1 ? 0.34 : 0.46)) : Math.round(hoehe * 0.24)}px -apple-system, "SF Pro Text", "Segoe UI", sans-serif`;
        g.fillStyle = erste ? (opts.farbe || farbe) : "rgba(255,210,160,0.75)";
        const y = n === 1 ? hoehe / 2 : hoehe * (erste ? 0.38 : 0.74);
        g.fillText(zeile, breite / 2, y, breite - 16);
      });
      tex.needsUpdate = true;
    };
    s.userData.zeichne(zeilen);
    return s;
  }

  // Bildschirm am Arbeitsplatz: zeigt Symbol, Name und was der Agent gerade tut.
  function monitorTextur(T) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 160;
    const tex = new T.CanvasTexture(c);
    tex.minFilter = T.LinearFilter;
    const g = c.getContext("2d");
    tex.userData = {
      zeichne(a, puls) {
        const z = zustand(a);
        g.clearRect(0, 0, 256, 160);
        const grund = z === "setup" ? "rgba(30,24,20,0.95)" : "rgba(26,12,2,0.95)";
        g.fillStyle = grund; g.fillRect(0, 0, 256, 160);
        const ak = z === "arbeitet" ? "#ffd27a" : z === "aktiv" ? "#ff8a1e" : z === "mac" ? "#f2c94c" : "#6b5d52";
        g.strokeStyle = ak; g.lineWidth = 6; g.strokeRect(3, 3, 250, 154);
        // Raster wie ein HUD
        g.strokeStyle = "rgba(255,138,30,0.12)"; g.lineWidth = 1;
        for (let x = 0; x < 256; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 160); g.stroke(); }
        g.font = "52px -apple-system, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(a.emoji || "•", 128, 58);
        g.font = "600 20px -apple-system, 'Segoe UI', sans-serif";
        g.fillStyle = ak;
        const zeile = z === "arbeitet" ? "ARBEITET" : z === "aktiv" ? "BEREIT" : z === "mac" ? "WARTET AUF MAC" : "EINRICHTEN";
        g.fillText(zeile, 128, 112);
        if (z === "arbeitet") {
          // Lauf-Balken
          const w = 200, x0 = 28, p = (puls || 0) % 1;
          g.fillStyle = "rgba(255,210,122,0.25)"; g.fillRect(x0, 134, w, 8);
          g.fillStyle = "#ffd27a"; g.fillRect(x0 + p * (w - 60), 134, 60, 8);
        }
        tex.needsUpdate = true;
      },
    };
    return tex;
  }

  function baueSzene() {
    const T = window.THREE;
    const leinwand = $("buero-leinwand");
    if (!T || !leinwand) return null;
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: leinwand, antialias: !fluessig(), alpha: false, powerPreference: "high-performance" });
    } catch {
      return null;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, fluessig() ? 1.25 : handy() ? 1.75 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x050302, 1);
    const scene = new T.Scene();
    scene.fog = new T.Fog(0x050302, 26, 60);
    const camera = new T.PerspectiveCamera(48, 1, 0.1, 200);

    const ak = new T.Color(akzent());
    scene.add(new T.AmbientLight(0xffffff, 0.35));
    scene.add(new T.HemisphereLight(0xffc999, 0x120804, 0.55));
    const kernLicht = new T.PointLight(ak.getHex(), 1.6, 26, 1.6);
    kernLicht.position.set(0, 4, 0);
    scene.add(kernLicht);
    const dir = new T.DirectionalLight(0xffffff, 0.35);
    dir.position.set(6, 14, 8);
    scene.add(dir);

    // Boden + Raster
    const boden = new T.Mesh(new T.CircleGeometry(19, 64), new T.MeshStandardMaterial({ color: 0x0b0603, roughness: 0.9, metalness: 0.1 }));
    boden.rotation.x = -Math.PI / 2;
    scene.add(boden);
    const raster = new T.PolarGridHelper(18.5, 20, 9, 64, ak.getHex(), ak.getHex());
    raster.material.transparent = true; raster.material.opacity = 0.13;
    raster.position.y = 0.01;
    scene.add(raster);

    // Glaswände (Achteck) mit Neon-Kanten
    const wandMat = new T.MeshBasicMaterial({ color: ak.getHex(), transparent: true, opacity: 0.05, side: T.DoubleSide, depthWrite: false });
    const kanteMat = new T.LineBasicMaterial({ color: ak.getHex(), transparent: true, opacity: 0.55 });
    const RW = 18.5;
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
      const p0 = new T.Vector3(Math.cos(a0) * RW, 0, Math.sin(a0) * RW);
      const p1 = new T.Vector3(Math.cos(a1) * RW, 0, Math.sin(a1) * RW);
      const laenge = p0.distanceTo(p1);
      const wand = new T.Mesh(new T.PlaneGeometry(laenge, 3.2), wandMat);
      wand.position.copy(p0.clone().add(p1).multiplyScalar(0.5)).setY(1.6);
      wand.lookAt(0, 1.6, 0);
      scene.add(wand);
      const kg = new T.BufferGeometry().setFromPoints([p0.clone().setY(3.2), p1.clone().setY(3.2), p1.clone().setY(0.02), p0.clone().setY(0.02)]);
      scene.add(new T.Line(kg, kanteMat));
    }

    // ---- Friday in der Mitte ----
    const chefin = new T.Group();
    const sockel = new T.Mesh(new T.CylinderGeometry(2.6, 2.9, 0.35, 48), new T.MeshStandardMaterial({ color: 0x140a04, roughness: 0.5, metalness: 0.6 }));
    sockel.position.y = 0.175;
    chefin.add(sockel);
    const sockelRing = new T.Mesh(new T.TorusGeometry(2.62, 0.04, 8, 72), new T.MeshBasicMaterial({ color: ak.getHex() }));
    sockelRing.rotation.x = Math.PI / 2; sockelRing.position.y = 0.36;
    chefin.add(sockelRing);
    // Chef-Tisch (Halbring)
    const tisch = new T.Mesh(new T.TorusGeometry(1.75, 0.16, 8, 48, Math.PI * 1.2), new T.MeshStandardMaterial({ color: 0x2a1608, emissive: ak.getHex(), emissiveIntensity: 0.25, roughness: 0.3, metalness: 0.7, transparent: true, opacity: 0.9 }));
    tisch.rotation.x = Math.PI / 2; tisch.rotation.z = Math.PI * 0.9; tisch.position.y = 1.05;
    chefin.add(tisch);
    // Hologramm-Figur
    const holoMat = new T.MeshStandardMaterial({ color: 0xffb066, emissive: ak.getHex(), emissiveIntensity: 0.7, transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0.3, depthWrite: false });
    const koerper = new T.Mesh(new T.CylinderGeometry(0.32, 0.55, 1.6, 24, 1, true), holoMat);
    koerper.position.y = 1.25;
    chefin.add(koerper);
    const kopf = new T.Mesh(new T.SphereGeometry(0.36, 24, 18), holoMat);
    kopf.position.y = 2.35;
    chefin.add(kopf);
    const gitter = new T.Mesh(new T.IcosahedronGeometry(0.5, 1), new T.MeshBasicMaterial({ color: ak.getHex(), wireframe: true, transparent: true, opacity: 0.45 }));
    gitter.position.y = 2.35;
    chefin.add(gitter);
    const reaktor = new T.Mesh(new T.TorusGeometry(0.16, 0.05, 8, 24), new T.MeshBasicMaterial({ color: 0xffe2b8 }));
    reaktor.position.set(0, 1.7, 0.4);
    chefin.add(reaktor);
    const ringe = [];
    for (let i = 0; i < 3; i++) {
      const r = new T.Mesh(new T.TorusGeometry(0.85 + i * 0.28, 0.018, 6, 64), new T.MeshBasicMaterial({ color: ak.getHex(), transparent: true, opacity: 0.6 - i * 0.15 }));
      r.position.y = 1.4 + i * 0.45;
      r.rotation.x = Math.PI / 2 + (i - 1) * 0.35;
      chefin.add(r); ringe.push(r);
    }
    const strahl = new T.Mesh(new T.CylinderGeometry(0.9, 1.6, 7, 32, 1, true), new T.MeshBasicMaterial({ color: ak.getHex(), transparent: true, opacity: 0.06, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
    strahl.position.y = 3.8;
    chefin.add(strahl);
    const chefTreffer = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 3.2, 12), new T.MeshBasicMaterial({ visible: false }));
    chefTreffer.position.y = 1.6; chefTreffer.userData.id = "friday";
    chefin.add(chefTreffer);
    const chefSchild = textSprite(T, ["FRIDAY", "Chefin"], { breite: 300, hoehe: 96, groesse: 3.2, hell: true, farbe: "#ffe2b8" });
    chefSchild.position.y = 3.6;
    chefin.add(chefSchild);
    scene.add(chefin);

    const pickbar = [chefTreffer];
    const agenten = new Map(); // id -> { gruppe, koerper, kopf, mat, monitor, schild, pos, winkel, linie, punkt }

    // Material-Vorlagen
    const tischMat = new T.MeshStandardMaterial({ color: 0x1c1008, roughness: 0.35, metalness: 0.6, transparent: true, opacity: 0.92 });
    const stuhlMat = new T.MeshStandardMaterial({ color: 0x0f0905, roughness: 0.7, metalness: 0.3 });
    const tischKante = new T.LineBasicMaterial({ color: ak.getHex(), transparent: true, opacity: 0.7 });
    const tischGeo = new T.BoxGeometry(1.15, 0.06, 0.62);
    const tischKantenGeo = new T.EdgesGeometry(tischGeo);
    const beinGeo = new T.BoxGeometry(0.05, 0.72, 0.5);
    const monGeo = new T.PlaneGeometry(0.78, 0.49);
    const monRahmenGeo = new T.BoxGeometry(0.84, 0.55, 0.03);
    const stuhlGeo = new T.BoxGeometry(0.5, 0.08, 0.48);
    const lehneGeo = new T.BoxGeometry(0.5, 0.55, 0.06);
    const koerperGeo = new T.CylinderGeometry(0.16, 0.24, 0.62, 16);
    const kopfGeo = new T.SphereGeometry(0.17, 18, 14);
    const trefferGeo = new T.BoxGeometry(1.2, 1.9, 1.6);
    const zonenMat = (c) => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.07, side: T.DoubleSide, depthWrite: false });
    const lichtLinieMat = () => new T.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.0 });

    const R = 10.2; // Radius der Arbeitsplätze
    const SCHRITT = 1.55; // Abstand zwischen Tischen
    const abteilungen = [];

    function platziere(liste, kategorien) {
      const n = kategorien.length;
      kategorien.forEach((cat, ci) => {
        const mitte = -Math.PI / 2 + (ci / n) * Math.PI * 2;
        const mitglieder = liste.filter((a) => a.cat === cat);
        const breite = (mitglieder.length * SCHRITT) / R;
        // Abteilungs-Zone auf dem Boden + Schild
        const zone = new T.Mesh(new T.RingGeometry(R - 1.6, R + 2.1, 32, 1, -mitte - breite / 2 - 0.08, breite + 0.16), zonenMat(ak.getHex()));
        zone.rotation.x = -Math.PI / 2; zone.position.y = 0.015;
        scene.add(zone);
        const zr = new T.Mesh(new T.RingGeometry(R + 2.05, R + 2.12, 48, 1, -mitte - breite / 2 - 0.08, breite + 0.16), new T.MeshBasicMaterial({ color: ak.getHex(), transparent: true, opacity: 0.6, side: T.DoubleSide }));
        zr.rotation.x = -Math.PI / 2; zr.position.y = 0.02;
        scene.add(zr);
        const schild = textSprite(T, [cat.toUpperCase()], { breite: 480, hoehe: 64, groesse: 4.6, rand: false, farbe: "#ff9a3a" });
        schild.position.set(Math.cos(mitte) * (R + 3.3), 0.9, Math.sin(mitte) * (R + 3.3));
        scene.add(schild);
        abteilungen.push({ cat, mitte, schild });

        mitglieder.forEach((a, i) => {
          const winkel = mitte + (i - (mitglieder.length - 1) / 2) * (SCHRITT / R);
          const g = new T.Group();
          g.position.set(Math.cos(winkel) * R, 0, Math.sin(winkel) * R);
          // Gruppe so drehen, dass "vorne" (−z lokal) zur Mitte zeigt
          g.lookAt(0, 0, 0);
          // Tisch
          const platte = new T.Mesh(tischGeo, tischMat);
          platte.position.set(0, 0.74, 0);
          g.add(platte);
          const kante = new T.LineSegments(tischKantenGeo, tischKante);
          kante.position.copy(platte.position);
          g.add(kante);
          for (const sx of [-0.52, 0.52]) {
            const bein = new T.Mesh(beinGeo, stuhlMat);
            bein.position.set(sx, 0.36, 0);
            g.add(bein);
          }
          // Monitor zur Agentin gedreht (nach außen), steht zur Mitte hin auf dem Tisch
          const tex = monitorTextur(T);
          const monitor = new T.Mesh(monGeo, new T.MeshBasicMaterial({ map: tex }));
          monitor.position.set(0, 1.08, 0.14);
          const rahmen = new T.Mesh(monRahmenGeo, stuhlMat);
          rahmen.position.set(0, 1.08, 0.12);
          // lookAt(0,0,0) richtet +z der Gruppe zur Mitte → Bildschirm nach außen drehen
          monitor.rotation.y = Math.PI;
          monitor.position.z = 0.1;
          g.add(rahmen); g.add(monitor);
          // Stuhl + Agent (außen)
          const stuhl = new T.Mesh(stuhlGeo, stuhlMat);
          stuhl.position.set(0, 0.46, -0.62);
          g.add(stuhl);
          const lehne = new T.Mesh(lehneGeo, stuhlMat);
          lehne.position.set(0, 0.75, -0.86);
          g.add(lehne);
          const mat = new T.MeshStandardMaterial({ color: 0xffa04a, emissive: ak.getHex(), emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.2, transparent: true, opacity: 0.95 });
          const koerper = new T.Mesh(koerperGeo, mat);
          koerper.position.set(0, 0.82, -0.6);
          const kopf = new T.Mesh(kopfGeo, mat);
          kopf.position.set(0, 1.28, -0.58);
          g.add(koerper); g.add(kopf);
          // Unsichtbare Trefferbox (leichter antippbar)
          const treffer = new T.Mesh(trefferGeo, new T.MeshBasicMaterial({ visible: false }));
          treffer.position.set(0, 0.95, -0.25);
          treffer.userData.id = a.id;
          g.add(treffer);
          pickbar.push(treffer);
          // Auswahl-Ring
          const ring = new T.Mesh(new T.RingGeometry(0.72, 0.8, 40), new T.MeshBasicMaterial({ color: 0xffe2b8, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
          ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.03, -0.3);
          g.add(ring);
          // Namensschild
          const schildA = textSprite(T, [`${a.emoji} ${a.name}`, ""], { breite: 300, hoehe: 84, groesse: 2.1 });
          schildA.position.set(0, 2.15, -0.4);
          g.add(schildA);
          scene.add(g);
          // Datenlinie zu Friday (sichtbar, wenn der Agent arbeitet)
          const welt = new T.Vector3(Math.cos(winkel) * R, 1.3, Math.sin(winkel) * R);
          const ziel = new T.Vector3(0, 1.9, 0);
          const kurve = new T.QuadraticBezierCurve3(welt, welt.clone().lerp(ziel, 0.5).setY(4.2), ziel);
          const linie = new T.Line(new T.BufferGeometry().setFromPoints(kurve.getPoints(40)), lichtLinieMat());
          scene.add(linie);
          const punkt = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), new T.MeshBasicMaterial({ color: 0xffe2b8, transparent: true, opacity: 0 }));
          scene.add(punkt);
          agenten.set(a.id, { gruppe: g, koerper, kopf, mat, monitor: tex, schild: schildA, ring, winkel, kurve, linie, punkt, phase: Math.random() * 6, zustand: "", daten: a });
        });
      });
    }

    // Schwebende Funken (nicht im Flüssig-Modus)
    let funken = null;
    if (!fluessig()) {
      const N = 260;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const r = Math.random() * 17, w = Math.random() * Math.PI * 2;
        pos[i * 3] = Math.cos(w) * r; pos[i * 3 + 1] = Math.random() * 6; pos[i * 3 + 2] = Math.sin(w) * r;
      }
      const gg = new T.BufferGeometry();
      gg.setAttribute("position", new T.BufferAttribute(pos, 3));
      funken = new T.Points(gg, new T.PointsMaterial({ color: ak.getHex(), size: 0.06, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
      scene.add(funken);
    }

    return { T, renderer, scene, camera, chefin, ringe, gitter, kopf, strahl, kernLicht, sockelRing, pickbar, agenten, platziere, abteilungen, funken, aufgebaut: false };
  }

  // Farben/Bildschirme/Linien an den echten Status anpassen
  function aktualisiereSzene() {
    if (!szene || !daten) return;
    if (!szene.aufgebaut) { szene.platziere(daten.agents, daten.categories); szene.aufgebaut = true; }
    for (const a of daten.agents) {
      const s = szene.agenten.get(a.id);
      if (!s) continue;
      s.daten = a;
      const z = zustand(a);
      if (z !== s.zustand) {
        s.zustand = z;
        const farbe = FARBE[z];
        s.mat.color.setHex(z === "setup" ? 0x3a322c : z === "arbeitet" ? 0xffe2b8 : 0xffa04a);
        s.mat.emissive.setHex(farbe);
        s.mat.emissiveIntensity = z === "setup" ? 0.08 : z === "arbeitet" ? 0.9 : 0.4;
        s.mat.opacity = z === "setup" ? 0.55 : 0.95;
        s.monitor.userData.zeichne(a, 0);
      }
      const zeile2 = a.arbeitet ? kurz(a.jetzt, 28) : a.status === "aktiv" ? (a.zuletzt ? `zuletzt ${zeitText(a.zuletzt.at)}` : "bereit") : a.status === "mac" ? "braucht Mac" : "einrichten";
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
    soll.radius = Math.max(6, Math.min(40, soll.radius));
  };
  function hochformat() {
    const leinwand = $("buero-leinwand");
    return Boolean(leinwand && leinwand.clientHeight > leinwand.clientWidth * 1.05);
  }
  const startRadius = () => (hochformat() ? 30 : 20.5);
  const startPhi = () => (hochformat() ? 0.62 : 0.9);

  function waehle(id) {
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
    const fps = fluessig() ? 30 : 60;
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
    if (szene.funken) szene.funken.rotation.y += dt * 0.02;

    // Agenten: atmen, arbeitende pulsieren und schicken Daten zu Friday
    monitorTakt += dt;
    const monitorNeu = monitorTakt > 0.12;
    if (monitorNeu) monitorTakt = 0;
    for (const a of szene.agenten.values()) {
      const z = a.zustand;
      const atmen = Math.sin(s * 1.6 + a.phase);
      a.kopf.position.y = 1.28 + atmen * 0.015;
      if (z === "arbeitet") {
        a.mat.emissiveIntensity = 0.7 + Math.sin(s * 6 + a.phase) * 0.3;
        a.kopf.rotation.y = Math.sin(s * 3 + a.phase) * 0.4;
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
    renderer.render(scene, camera);
  }

  function groesse() {
    if (!szene) return;
    const leinwand = $("buero-leinwand");
    const w = leinwand.clientWidth || 1, h = leinwand.clientHeight || 1;
    szene.renderer.setSize(w, h, false);
    szene.camera.aspect = w / h;
    szene.camera.updateProjectionMatrix();
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

  window.Friday = Object.assign(window.Friday || {}, { buero: { waehle, laden, get daten() { return daten; } } });
})();
