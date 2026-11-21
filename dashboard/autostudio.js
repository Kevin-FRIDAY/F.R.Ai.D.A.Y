// F.R.Ai.D.A.Y Auto-Studio (v1.136.0): Autos wie auf Kevins TikTok-Bildern – Seitenansicht im hellen Studio,
// Spiegelboden, Markenfarben, Daten (Motor, PS, 0–100, Spitze) und ganze Modellreihen zum Vergleichen.
// Die Autos baut Friday selbst (keine Dateien, kein Claude): Karosserie als Hülle aus Querschnitten,
// Lack mit Klarlack, getönte Scheiben, Felgen mit Speichen und Bremssätteln in Markenfarbe.
// Logos werden nicht nachgebaut – nur Schriftzug und Farben.
(() => {
  "use strict";
  const THREE = window.THREE;
  const $ = (id) => document.getElementById(id);
  const host = $("werkstatt");
  if (!THREE || !host || !window.Friday) return;
  const { escapeHtml } = window.Friday;

  // ---------- Karosserie-Formen (Seitenansicht, u = 0 Heck … 1 Front; Höhen als Anteil der Gesamthöhe) ----------
  // nase: Höhe vorne, haube: Haube an der Frontscheibe, guertel: Fensterunterkante hinten, heck: Heckkante,
  // uRw/uRe/uRf/uWs: Heckscheibe unten, Dach hinten, Dach vorne, Frontscheibe unten; boden: Bodenfreiheit (m).
  const FORMEN = {
    coupe: { nase: 0.43, haube: 0.68, guertel: 0.71, heck: 0.64, uRw: 0.13, uRe: 0.36, uRf: 0.57, uWs: 0.71, boden: 0.12, vorne: 0.45, n: 4.6, bPfosten: false },
    limousine: { nase: 0.45, haube: 0.67, guertel: 0.69, heck: 0.66, uRw: 0.19, uRe: 0.34, uRf: 0.6, uWs: 0.72, boden: 0.13, vorne: 0.46, n: 4.6, bPfosten: true },
    sportback: { nase: 0.43, haube: 0.66, guertel: 0.69, heck: 0.62, uRw: 0.06, uRe: 0.38, uRf: 0.6, uWs: 0.72, boden: 0.12, vorne: 0.46, n: 4.6, bPfosten: true },
    kombi: { nase: 0.45, haube: 0.67, guertel: 0.69, heck: 0.69, uRw: 0.025, uRe: 0.075, uRf: 0.61, uWs: 0.72, boden: 0.13, vorne: 0.46, n: 4.6, bPfosten: true, dPfosten: true },
    schraeg: { nase: 0.47, haube: 0.66, guertel: 0.68, heck: 0.66, uRw: 0.035, uRe: 0.2, uRf: 0.6, uWs: 0.71, boden: 0.13, vorne: 0.47, n: 4.6, bPfosten: true },
    suv: { nase: 0.55, haube: 0.63, guertel: 0.65, heck: 0.65, uRw: 0.02, uRe: 0.065, uRf: 0.63, uWs: 0.74, boden: 0.2, vorne: 0.47, n: 4.6, bPfosten: true, dPfosten: true, beplankung: true },
    suvcoupe: { nase: 0.55, haube: 0.63, guertel: 0.65, heck: 0.62, uRw: 0.04, uRe: 0.3, uRf: 0.62, uWs: 0.74, boden: 0.2, vorne: 0.47, n: 4.6, bPfosten: true, beplankung: true },
    gelaende: { nase: 0.56, haube: 0.6, guertel: 0.6, heck: 0.6, uRw: 0.012, uRe: 0.03, uRf: 0.78, uWs: 0.8, boden: 0.24, vorne: 0.5, n: 7, bPfosten: true, dPfosten: true, eckig: true },
    elfer: { nase: 0.42, haube: 0.62, guertel: 0.68, heck: 0.63, uRw: 0.05, uRe: 0.44, uRf: 0.58, uWs: 0.7, boden: 0.11, vorne: 0.43, n: 4.6, bPfosten: false },
  };

  const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  // Materialien pro Auto (Lackfarbe wechselt, der Rest bleibt).
  function materialien(spec, lackHex) {
    const hell = new THREE.Color(lackHex).getHSL({}).l;
    const lack = new THREE.MeshPhysicalMaterial({ color: lin(lackHex), metalness: hell < 0.15 ? 0.25 : 0.5, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.025, envMapIntensity: hell < 0.15 ? 0.8 : 1.05 });
    return {
      lack,
      glas: new THREE.MeshPhysicalMaterial({ color: lin(0x0a0c0f), metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.7 }),
      trim: new THREE.MeshPhysicalMaterial({ color: lin(0x0c0d10), metalness: 0.2, roughness: 0.35, clearcoat: 0.6, envMapIntensity: 0.9 }),
      matt: new THREE.MeshStandardMaterial({ color: lin(0x111214), metalness: 0, roughness: 0.85 }),
      gummi: new THREE.MeshStandardMaterial({ color: lin(0x121315), metalness: 0, roughness: 0.92 }),
      felge: new THREE.MeshStandardMaterial({ color: lin(spec.felge || 0x3c4047), metalness: 0.85, roughness: 0.3, envMapIntensity: 1.15 }),
      felgeTief: new THREE.MeshStandardMaterial({ color: lin(0x0b0c0e), metalness: 0.4, roughness: 0.6 }),
      scheibe: new THREE.MeshStandardMaterial({ color: lin(0x3a3d42), metalness: 0.9, roughness: 0.5, envMapIntensity: 0.6 }),
      sattel: new THREE.MeshPhysicalMaterial({ color: lin(spec.bremse || "#c8102e"), metalness: 0.2, roughness: 0.35, clearcoat: 1, envMapIntensity: 1 }),
      chrom: new THREE.MeshStandardMaterial({ color: lin(0xd9dde2), metalness: 1, roughness: 0.12, envMapIntensity: 1.3 }),
      licht: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.2 }),
      lichtGlas: new THREE.MeshPhysicalMaterial({ color: lin(0x15181c), metalness: 0.3, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.6 }),
      rueck: new THREE.MeshStandardMaterial({ color: lin(0x7a0710), emissive: 0xff1a2a, emissiveIntensity: 1.2, roughness: 0.3 }),
    };
  }

  // Hülle aus Querschnitten: ring(i) liefert für Schritt i die Punkte [z, y] und x; mats(i, j) das Material.
  function huelle(stufen, ringPunkte, ringFn, matFn, matListe) {
    const pos = [], gruppen = matListe.map(() => []);
    for (let i = 0; i <= stufen; i++) {
      const { x, punkte } = ringFn(i);
      for (const [z, y] of punkte) pos.push(x, y, z);
    }
    const N = ringPunkte;
    for (let i = 0; i < stufen; i++) {
      for (let j = 0; j < N; j++) {
        const a = i * N + j, b = i * N + ((j + 1) % N), c = (i + 1) * N + j, d = (i + 1) * N + ((j + 1) % N);
        gruppen[matFn(i, j)].push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const index = [];
    gruppen.forEach((g, k) => { if (g.length) { geo.addGroup(index.length, g.length, k); index.push(...g); } });
    geo.setIndex(index);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, matListe);
  }

  /**
   * Baut ein Auto. spec: { karosserie, laenge, hoehe, breite, radstand, rad, bremse, fluegel }.
   * Front zeigt nach +x, Boden y = 0, Mitte z = 0.
   */
  function baueAuto(spec, lackHex) {
    const f = FORMEN[spec.karosserie] || FORMEN.limousine;
    const L = spec.laenge || 4.7, H = spec.hoehe || 1.42, B = spec.breite || 1.9, R = spec.radstand || 2.85, r = spec.rad || 0.36;
    const mat = materialien(spec, lackHex);
    const auto = new THREE.Group();
    const xF = L / 2 - (L - R) * f.vorne, xH = xF - R;
    const ra = r + 0.035; // Radlauf
    const X = (u) => -L / 2 + u * L;

    // Oberkante Unterbau (Haube, Gürtellinie, Heckdeckel)
    const ys = (u) => {
      if (u >= f.uWs) { const t = (u - f.uWs) / (1 - f.uWs); return H * (f.nase + (f.haube - f.nase) * (1 - Math.pow(t, f.eckig ? 6 : 2.4))); }
      if (u >= f.uRw) return H * (f.guertel + (f.haube - f.guertel) * ((u - f.uRw) / (f.uWs - f.uRw)));
      const t = u / f.uRw;
      return H * (f.heck + (f.guertel - f.heck) * Math.pow(smooth(t), 0.6));
    };
    // Dachlinie (nur zwischen Heck- und Frontscheibe)
    const yt = (u) => {
      if (u <= f.uRw || u >= f.uWs) return ys(u);
      if (u >= f.uRf) { const t = (u - f.uRf) / (f.uWs - f.uRf); return H + (ys(f.uWs) - H) * Math.pow(t, f.eckig ? 1 : 1.25); }
      if (u <= f.uRe) { const t = (f.uRe - u) / (f.uRe - f.uRw); return H + (ys(f.uRw) - H) * Math.pow(t, f.eckig ? 1 : 1.35); }
      const m = (f.uRe + f.uRf) / 2, h = (f.uRf - f.uRe) / 2;
      return H - (f.eckig ? 0.004 : 0.018) * H * Math.pow((u - m) / h, 2);
    };
    // Unterkante mit Radläufen und hochgezogenen Enden (Frontlippe, Diffusor)
    const yb = (u) => {
      const x = X(u);
      let y = f.boden;
      if (u > 0.93) y += (u - 0.93) / 0.07 * 0.16;
      if (u < 0.06) y += (0.06 - u) / 0.06 * 0.14;
      for (const xa of [xF, xH]) { const dx = x - xa; if (Math.abs(dx) < ra) y = Math.max(y, r + Math.sqrt(ra * ra - dx * dx)); }
      return y;
    };
    // Halbe Breite in der Draufsicht (vorn/hinten gerundet)
    const hw = (u) => {
      const t = Math.abs(u * 2 - 1);
      const p = f.eckig ? 9 : u < 0.5 ? 7 : 5.5; // Heck flacher, Front runder
      return (B / 2) * Math.pow(Math.max(0, 1 - Math.pow(t, p)), 1 / p);
    };

    // --- Unterbau ---
    const S = 280, NU = 44;
    // Querschnitt: abgerundetes Rechteck mit Schulterlinie (fängt das Licht) und Kotflügel-Wölbung über den Rädern.
    const superRing = (n, z0, y0, wz, hy, N, x) => {
      const pts = [];
      let fl = 0;
      for (const xa of [xF, xH]) fl = Math.max(fl, Math.exp(-Math.pow((x - xa) / (ra * 1.25), 2)));
      for (let j = 0; j < N; j++) {
        const a = (j / N) * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        const ys2 = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
        const yAbs = y0 + hy * ys2;
        const schulter = 0.018 * Math.exp(-Math.pow((yAbs - (y0 + hy * 0.55)) / 0.05, 2));
        const kotfluegel = f.eckig ? 0 : 0.02 * fl * smooth(1 - Math.abs(yAbs - (r * 1.6)) / 0.5);
        pts.push([z0 + wz * (1 + schulter + kotfluegel) * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), yAbs]);
      }
      return pts;
    };
    const uOf = (i) => { const t = i / S; return 0.5 - 0.5 * Math.cos(Math.PI * t); }; // dichter an den Enden
    const xA = X(f.uWs) - 0.06, xBp = X(f.uRe + (f.uRf - f.uRe) * 0.45);
    const fugen = f.bPfosten ? [xA, xBp, X(f.uRe) + (f.dPfosten ? 0.25 : 0.05)] : [xA, X(f.uRe) + 0.25];
    const unterbau = huelle(S, NU, (i) => {
      const u = uOf(i), top = ys(u), bot = Math.min(yb(u), top - 0.02);
      return { x: X(u), punkte: superRing(f.n, 0, (top + bot) / 2, Math.max(0.002, hw(u) * 0.965), Math.max(0.005, (top - bot) / 2), NU, X(u)) };
    }, (i, j) => {
      const s = Math.sin(((j + 0.5) / NU) * Math.PI * 2), c = Math.abs(Math.cos(((j + 0.5) / NU) * Math.PI * 2));
      if (s < -0.82) return 1; // Unterboden/Schweller dunkel
      // Türfugen: schmale dunkle Linien auf der Flanke
      if (c > 0.45 && s > -0.7 && s < 0.85) { const x = X((uOf(i) + uOf(i + 1)) / 2); if (fugen.some((xf) => Math.abs(x - xf) < 0.006)) return 2; }
      if (f.beplankung && s < -0.55) { const u = uOf(i), x = X(u); if ([xF, xH].some((xa) => Math.abs(x - xa) < ra + 0.08)) return 1; }
      return 0;
    }, [mat.lack, mat.matt, mat.trim]);
    unterbau.castShadow = true;
    auto.add(unterbau);

    // --- Aufbau (Fenster, Dach, Säulen) ---
    const uB = f.uRe + (f.uRf - f.uRe) * 0.45;
    const SG = 110, NG = 36;
    const uG = (i) => f.uRw + (f.uWs - f.uRw) * (i / SG);
    const aufbau = huelle(SG, NG, (i) => {
      const u = uG(i), y0 = ys(u) - 0.02, y1 = Math.max(yt(u), y0 + 0.004), w = hw(u);
      const wb = w * 0.93, wt = w * (f.eckig ? 0.86 : 0.7);
      const pts = [];
      for (let j = 0; j < NG; j++) {
        const a = (j / NG) * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        if (s >= 0) {
          const yv = Math.pow(s, 2 / (f.eckig ? 8 : 3.2));
          const zz = Math.sign(c) * Math.pow(Math.abs(c), 2 / (f.eckig ? 8 : 3.2));
          pts.push([zz * (wb + (wt - wb) * yv), y0 + yv * (y1 - y0)]);
        } else pts.push([c * wb * 0.98, y0 - 0.03 * -s]);
      }
      return { x: X(u), punkte: pts };
    }, (i, j) => {
      const u = uG(i + 0.5), a = ((j + 0.5) / NG) * Math.PI * 2, s = Math.sin(a), c = Math.abs(Math.cos(a));
      if (s < 0) return 2;
      const yv = Math.pow(s, 2 / 3.2);
      const dach = u > f.uRe + 0.005 && u < f.uRf - 0.005;
      if (dach && yv > 0.93) return 0; // Dach in Wagenfarbe
      if (yv < 0.07) return 2; // Fensterleiste unten
      if (u >= f.uRf) return c > 0.8 ? 0 : 1; // A-Säule / Frontscheibe
      if (u <= f.uRe) { if (f.dPfosten) return u < f.uRw + (f.uRe - f.uRw) * 0.5 || c < 0.75 ? (c > 0.75 ? 0 : 1) : 0; return c > 0.72 ? 0 : 1; }
      if (f.bPfosten && Math.abs(X(u) - X(uB)) < 0.05 && c > 0.6) return 2; // B-Säule schwarz
      if (f.dPfosten && u < f.uRe + 0.035 && c > 0.6) return 0; // D-Säule
      if (dach && yv > 0.86) return 2; // Dachkante (Zierleiste)
      return 1;
    }, [mat.lack, mat.glas, mat.trim]);
    aufbau.castShadow = true;
    auto.add(aufbau);

    // --- Räder ---
    const tb = 0.26 + (r - 0.35) * 0.4;
    for (const xa of [xF, xH]) for (const seite of [-1, 1]) {
      const rd = rad(r, tb, seite, mat, xa === xF);
      rd.position.set(xa, r, seite * (B / 2 - tb / 2 - 0.035));
      auto.add(rd);
      // dunkles Radhaus, damit man nicht durchs Auto schaut
      const haus = new THREE.Mesh(new THREE.CircleGeometry(ra, 32), mat.matt);
      haus.position.set(xa, r, seite * (B / 2 - tb - 0.06));
      haus.rotation.y = seite < 0 ? Math.PI : 0;
      auto.add(haus);
      const haus2 = haus.clone(); haus2.rotation.y += Math.PI; auto.add(haus2);
    }

    // --- Lichter, Spiegel, Details ---
    const box = (gr, m, pos, rot) => { const o = new THREE.Mesh(new THREE.BoxGeometry(...gr), m); o.position.set(...pos); if (rot) o.rotation.set(...rot); auto.add(o); return o; };
    const uL = 0.915, wl = hw(uL) * 0.96, yl = ys(uL) - (f.eckig ? 0.12 : 0.07);
    for (const s of [-1, 1]) {
      // Scheinwerfer: dunkles Glas mit leuchtendem Tagfahrlicht-Strich
      box([0.34, 0.07, 0.24], mat.lichtGlas, [X(uL), yl, s * (wl * 0.92 - 0.12)], [0, s * 0.42, f.eckig ? 0 : -0.1]);
      box([0.3, 0.014, 0.2], mat.licht, [X(uL) + 0.01, yl + 0.014, s * (wl * 0.92 - 0.1)], [0, s * 0.42, f.eckig ? 0 : -0.1]);
      // Rückleuchten
      const uT = 0.045, wt = hw(uT);
      box([0.12, 0.045, 0.42], mat.rueck, [X(uT), ys(uT) - 0.075, s * (wt - 0.2)], [0, s * -0.3, 0]);
      // Außenspiegel
      const uS = f.uWs - 0.035, sp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), mat.lack);
      sp.scale.set(1.3, 0.75, 1.1); sp.position.set(X(uS), ys(uS) + 0.09, s * (hw(uS) + 0.06)); sp.castShadow = true; auto.add(sp);
      box([0.1, 0.03, 0.08], mat.trim, [X(uS) - 0.02, ys(uS) + 0.04, s * (hw(uS) + 0.01)]);
      // Türgriff (bündig)
      const uG2 = f.uRe + (f.uRf - f.uRe) * (f.bPfosten ? 0.62 : 0.4);
      box([0.17, 0.018, 0.02], mat.trim, [X(uG2), ys(uG2) - 0.11, s * (hw(uG2) * 0.995)]);
    }
    // Kühlergrill / Lufteinlass vorn, Diffusor und Endrohre hinten
    box([0.06, H * (f.eckig ? 0.16 : 0.1), B * 0.4], mat.trim, [X(0.985), H * f.nase * 0.62, 0]);
    box([0.05, 0.07, B * 0.6], mat.trim, [X(0.975), f.boden + 0.17, 0]);
    box([0.14, 0.1, B * 0.6], mat.matt, [X(0.03), f.boden + 0.12, 0]);
    const rohre = spec.ps >= 500 ? [-0.62, -0.5, 0.5, 0.62] : [-0.55, 0.55];
    for (const z of rohre) {
      const ro = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 20), mat.chrom);
      ro.rotation.z = Math.PI / 2; ro.position.set(X(0.012), f.boden + 0.12, z * B / 2 * 0.8); auto.add(ro);
    }
    if (spec.karosserie === "gelaende") { // Reserverad hinten
      const rr = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.24, 36), mat.gummi);
      rr.rotation.z = Math.PI / 2; rr.position.set(-L / 2 - 0.1, H * 0.42, 0); auto.add(rr);
      box([0.04, H * 0.08, B * 0.92], mat.trim, [0, H * 0.62, 0]); // Zierleiste umlaufend angedeutet
    }
    if (spec.fluegel) { // Heckflügel (GT3)
      box([0.32, 0.025, B * 0.82], mat.trim, [-L / 2 + 0.3, H * 1.02, 0]);
      for (const s of [-1, 1]) box([0.08, H * 0.26, 0.02], mat.trim, [-L / 2 + 0.36, H * 0.86, s * 0.36]);
    }

    auto.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    auto.userData.masse = { L, H, B };
    return auto;
  }

  // Ein Rad: Reifen, Felge mit Doppelspeichen, Bremsscheibe, Bremssattel in Markenfarbe. seite -1 = links (Kamera).
  function rad(r, tb, seite, mat, vorne) {
    const g = new THREE.Group();
    const reifen = new THREE.Mesh(new THREE.CylinderGeometry(r, r, tb, 48, 1, true), mat.gummi);
    reifen.rotation.x = Math.PI / 2; g.add(reifen);
    const flanke = new THREE.Mesh(new THREE.TorusGeometry(r - 0.045, 0.05, 12, 48), mat.gummi);
    flanke.position.z = seite * (tb / 2 - 0.03); g.add(flanke);
    const innen = flanke.clone(); innen.position.z = -seite * (tb / 2 - 0.03); g.add(innen);
    const rr = r * 0.76;
    const tief = new THREE.Mesh(new THREE.CircleGeometry(rr, 40), mat.felgeTief);
    tief.position.z = seite * (tb / 2 - 0.12); tief.rotation.y = seite < 0 ? Math.PI : 0; g.add(tief);
    // Bremsscheibe + Sattel (hinter den Speichen)
    const scheibe = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.7, rr * 0.7, 0.03, 40), mat.scheibe);
    scheibe.rotation.x = Math.PI / 2; scheibe.position.z = seite * (tb / 2 - 0.1); g.add(scheibe);
    const sattel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.07), mat.sattel);
    const wink = vorne ? Math.PI * 0.18 : Math.PI * 0.82; // vorn hinter, hinten vor der Achse
    sattel.position.set(Math.cos(wink) * rr * 0.68, Math.sin(wink) * rr * 0.68, seite * (tb / 2 - 0.075));
    sattel.rotation.z = wink - Math.PI / 2; g.add(sattel);
    // Felgenhorn
    const horn = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.014, 8, 56), mat.felge);
    horn.position.z = seite * (tb / 2 - 0.02); g.add(horn);
    // 10 Speichen (5 Doppelspeichen)
    for (let k = 0; k < 10; k++) {
      const a = Math.floor(k / 2) * (Math.PI * 2 / 5) + (k % 2 ? 0.17 : -0.17);
      const sp = new THREE.Mesh(new THREE.BoxGeometry(rr * 0.9, 0.065, 0.035), mat.felge);
      sp.position.set(Math.cos(a) * rr * 0.5, Math.sin(a) * rr * 0.5, seite * (tb / 2 - 0.035));
      sp.rotation.z = a; g.add(sp);
    }
    const nabe = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.2, rr * 0.22, 0.05, 24), mat.felge);
    nabe.rotation.x = Math.PI / 2; nabe.position.z = seite * (tb / 2 - 0.03); g.add(nabe);
    const deckel = new THREE.Mesh(new THREE.CircleGeometry(rr * 0.1, 20), mat.trim);
    deckel.position.z = seite * (tb / 2 - 0.004); deckel.rotation.y = seite < 0 ? Math.PI : 0; g.add(deckel);
    return g;
  }

  // ---------- Studio: heller Raum, Spiegelboden, weiche Lichter ----------
  const BODEN = "#e8eaed";
  function verlaufTextur(stops, w = 4, h = 256, radial = false) {
    const c = document.createElement("canvas"); c.width = radial ? h : w; c.height = h;
    const g = c.getContext("2d");
    const gr = radial ? g.createRadialGradient(h / 2, h / 2, 0, h / 2, h / 2, h / 2) : g.createLinearGradient(0, 0, 0, h);
    for (const [p, col] of stops) gr.addColorStop(p, col);
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function studioUmgebung(renderer) {
    const env = new THREE.Scene();
    const raum = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), new THREE.MeshBasicMaterial({ color: 0x55595f, side: THREE.BackSide }));
    raum.position.y = 5; env.add(raum);
    const flaeche = (w, h, pos, rot, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos); m.rotation.set(...rot); env.add(m); };
    flaeche(24, 24, [0, -0.9, 0], [-Math.PI / 2, 0, 0], 0.85); // heller Studioboden spiegelt sich in den Flanken
    flaeche(14, 5, [0, 10.9, 0], [Math.PI / 2, 0, 0], 5); // große Deckenbox
    flaeche(1.2, 10, [-5, 10.8, 0], [Math.PI / 2, 0, 0], 6);
    flaeche(1.2, 10, [5, 10.8, 0], [Math.PI / 2, 0, 0], 6);
    flaeche(16, 1.1, [0, 4.2, -11.9], [0, 0, 0], 4); // Lichtstreifen hinten (Kante im Lack)
    flaeche(16, 1.1, [0, 4.2, 11.9], [0, Math.PI, 0], 4);
    flaeche(6, 4, [-11.9, 4, 0], [0, Math.PI / 2, 0], 2.5);
    flaeche(6, 4, [11.9, 4, 0], [0, -Math.PI / 2, 0], 2.5);
    const pm = new THREE.PMREMGenerator(renderer);
    const tex = pm.fromScene(env, 0.02).texture;
    pm.dispose();
    return tex;
  }

  // Bühne: Boden mit Spiegelbild (Kopie des Autos, an y gespiegelt), weicher Schatten, Licht.
  function buehne(renderer, mitHintergrund) {
    const scene = new THREE.Scene();
    scene.environment = studioUmgebung(renderer);
    if (mitHintergrund) {
      scene.background = verlaufTextur([[0, "#d3d6da"], [0.3, "#e2e4e7"], [0.45, BODEN], [1, BODEN]]);
      scene.fog = new THREE.Fog(BODEN, 16, 40);
    }
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9bcc2, 0.55));
    const sonne = new THREE.DirectionalLight(0xffffff, 0.9); sonne.position.set(2, 8, -3); scene.add(sonne);
    // Spiegelboden: halbdurchsichtige Fläche über dem gespiegelten Auto; zur Kamera hin deckender (Spiegelung blendet aus).
    // Oben im Verlauf = Kameraseite (−z): dort deckend, unter dem Auto durchsichtiger (kräftige Spiegelung).
    // Stufen in Metern ab Automitte (z), Fläche 400 × 400 m, damit nirgends eine Kante zu sehen ist.
    const T = 400, stufe = (z, a) => [(z + T / 2) / T, `rgba(232,234,237,${a})`];
    const bodenTex = verlaufTextur([[0, "rgba(232,234,237,1)"], stufe(-7.2, 0.97), stufe(-4, 0.72), stufe(-2, 0.46), stufe(0, 0.42), stufe(2, 0.75), stufe(4, 0.97), [1, "rgba(232,234,237,1)"]], 4, 4096);
    const boden = new THREE.Mesh(new THREE.PlaneGeometry(T, T), new THREE.MeshBasicMaterial({ map: bodenTex, transparent: true, depthWrite: false, fog: true, toneMapped: false }));
    boden.rotation.x = -Math.PI / 2; boden.renderOrder = 1; scene.add(boden);
    const schatten = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: verlaufTextur([[0, "rgba(0,0,0,0.55)"], [0.55, "rgba(0,0,0,0.25)"], [1, "rgba(0,0,0,0)"]], 4, 256, true), transparent: true, depthWrite: false, toneMapped: false }));
    schatten.rotation.x = -Math.PI / 2; schatten.position.y = 0.004; schatten.renderOrder = 2; scene.add(schatten);
    return { scene, boden, schatten, auto: null, spiegel: null };
  }
  function setzeAuto(b, auto) {
    if (b.auto) { b.scene.remove(b.auto, b.spiegel); entsorge(b.auto); }
    b.auto = auto;
    b.spiegel = auto.clone(true); b.spiegel.scale.y = -1;
    b.scene.add(auto, b.spiegel);
    const { L, B } = auto.userData.masse;
    b.schatten.scale.set(L * 1.12, B * 1.35, 1);
    // Boden-Verlauf: Mitte des Autos bei v = 0.5 → Fläche so legen, dass der deckende Teil zur Kamera (−z) zeigt.
    b.boden.position.set(0, 0, 0);
  }
  function entsorge(o) {
    o.traverse((k) => { if (k.isMesh) { k.geometry?.dispose(); (Array.isArray(k.material) ? k.material : [k.material]).forEach((m) => m?.dispose?.()); } });
  }

  // Kamera: Seitenansicht von links (Front zeigt nach links wie auf Kevins Bildern).
  function kameraSetzen(cam, masse, yaw, pitch, aspekt, rand = 1.12) {
    const { L, H } = masse;
    const ziel = new THREE.Vector3(0, H * 0.46, 0);
    const vfov = (cam.fov * Math.PI) / 180;
    const breiteDist = (L * rand / 2) / Math.tan(Math.atan(Math.tan(vfov / 2) * aspekt));
    const hoeheDist = (H * 2.2 / 2) / Math.tan(vfov / 2);
    const d = Math.max(breiteDist, hoeheDist) + 1.2;
    cam.position.set(ziel.x + d * Math.cos(pitch) * Math.sin(yaw), ziel.y + d * Math.sin(pitch), ziel.z - d * Math.cos(pitch) * Math.cos(yaw));
    cam.lookAt(ziel);
  }

  // ---------- Live-Studio im Werkstatt-Fenster ----------
  let renderer = null, buehneLive = null, cam = null, raf = 0, ansicht = { yaw: 0, pitch: 0.06, drehen: false };
  let aktuell = null; // { marke, modell, farbe }
  const el = document.createElement("section");
  el.id = "autostudio"; el.className = "autostudio hidden"; el.setAttribute("aria-label", "Auto-Studio");
  el.innerHTML = `
    <canvas id="as-canvas" class="as-canvas"></canvas>
    <header class="as-top">
      <div class="as-brand">FRIDAY · AUTO-STUDIO</div>
      <button type="button" id="as-x" class="as-knopf" title="Zurück zur Werkstatt">✕</button>
    </header>
    <div id="as-karte" class="as-karte"></div>
    <div class="as-leiste">
      <div id="as-farben" class="as-farben" aria-label="Lackfarbe"></div>
      <div class="as-knoepfe">
        <button type="button" data-ansicht="seite" class="as-knopf on">Seite</button>
        <button type="button" data-ansicht="vorne" class="as-knopf">Schräg vorn</button>
        <button type="button" data-ansicht="hinten" class="as-knopf">Schräg hinten</button>
        <button type="button" data-ansicht="drehen" class="as-knopf">360°</button>
        <button type="button" id="as-reihe-knopf" class="as-knopf as-haupt">Modellreihe</button>
        <button type="button" id="as-foto" class="as-knopf">📸 Bild</button>
      </div>
    </div>
    <section id="as-reihe" class="as-reihe hidden" aria-label="Modellreihe">
      <div class="as-reihe-kopf"><button type="button" id="as-reihe-foto" class="as-knopf as-haupt">📸 Als Bild speichern</button><button type="button" id="as-reihe-x" class="as-knopf">✕</button></div>
      <div id="as-reihe-inhalt" class="as-reihe-inhalt"></div>
    </section>`;
  host.appendChild(el);

  const LACKE = [["Schwarz", "#14161b"], ["Weiß", "#e9ecef"], ["Grau", "#8d939b"], ["Silber", "#c9ccd1"], ["Rot", "#8e0f1d"], ["Blau", "#1d3f8c"], ["Dunkelblau", "#16264f"], ["Grün", "#2a4d3a"], ["Gelb", "#e8b21a"], ["Orange", "#e5621c"]];
  const FARBWORT = { schwarz: "#14161b", weiss: "#e9ecef", grau: "#8d939b", chrom: "#c9ccd1", rot: "#a3101f", blau: "#1d3f8c", gruen: "#2a4d3a", gelb: "#e8b21a", orange: "#e5621c", lila: "#4b2a7a", braun: "#5a3a22" };
  $("as-farben").innerHTML = LACKE.map(([n, h]) => `<button type="button" data-lack="${h}" title="${n}" style="--lack:${h}"></button>`).join("");

  function initLive() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ canvas: $("as-canvas"), antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    buehneLive = buehne(renderer, true);
    cam = new THREE.PerspectiveCamera(26, 1, 0.1, 200);
    let zug = null;
    const c = renderer.domElement;
    c.addEventListener("pointerdown", (e) => { zug = { x: e.clientX, y: e.clientY, yaw: ansicht.yaw, pitch: ansicht.pitch }; c.setPointerCapture(e.pointerId); ansicht.drehen = false; knopfAn(null); });
    c.addEventListener("pointermove", (e) => { if (!zug) return; ansicht.yaw = zug.yaw + (e.clientX - zug.x) * 0.006; ansicht.pitch = clamp(zug.pitch + (e.clientY - zug.y) * 0.003, 0.0, 0.7); });
    c.addEventListener("pointerup", () => { zug = null; });
    window.addEventListener("resize", groesse);
  }
  function groesse() {
    if (!renderer) return;
    const c = renderer.domElement, w = c.clientWidth || 800, h = c.clientHeight || 500;
    renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  function schleife() {
    raf = requestAnimationFrame(schleife);
    if (!buehneLive?.auto) return;
    if (ansicht.drehen) ansicht.yaw += 0.004;
    const schmal = cam.aspect < 1.1;
    // Handy (hochkant): Auto etwas kleiner, Platz für die Datenkarte darüber
    kameraSetzen(cam, buehneLive.auto.userData.masse, ansicht.yaw, ansicht.pitch, cam.aspect, schmal ? 1.08 : 1.5);
    if (schmal) { cam.position.y += 0.35; cam.lookAt(0, buehneLive.auto.userData.masse.H * 0.75, 0); }
    renderer.render(buehneLive.scene, cam);
  }
  function knopfAn(name) { el.querySelectorAll("[data-ansicht]").forEach((b) => b.classList.toggle("on", b.dataset.ansicht === name)); }

  const zahl = (n) => (Number.isFinite(n) ? n.toFixed(1) : String(n)).replace(".", ",");
  const spitzeKurz = (s) => String(s || "").replace(/\s*\(.*\)\s*$/, "");
  function akzent(marke, gross = false) {
    const farben = marke.akzent?.length ? marke.akzent : ["#ff8a1e"];
    return `<span class="as-akzent${gross ? " gross" : ""}">${farben.map((c) => `<i style="background:${c}"></i>`).join("")}</span>`;
  }
  function datenZeilen(m) {
    return `<li>${escapeHtml(m.motor)}</li><li><b>${m.ps} PS</b></li><li>0–100 km/h: ${zahl(m.null100)} s</li><li>Spitze: ${escapeHtml(m.spitze)}</li>`;
  }
  function zeigeKarte() {
    const { marke, modell } = aktuell;
    $("as-karte").innerHTML = `<div class="as-marke">${akzent(marke)}<span>${escapeHtml(marke.titel)}</span></div>
      <h2 class="as-name">${escapeHtml(modell.name)}</h2>${modell.zusatz ? `<div class="as-zusatz">${escapeHtml(modell.zusatz)}</div>` : ""}
      <ul class="as-daten">${datenZeilen(modell)}</ul>
      <div class="as-hinweis">Herstellerangaben, gerundet · je nach Ausstattung</div>`;
    el.querySelectorAll("[data-lack]").forEach((b) => b.classList.toggle("on", b.dataset.lack.toLowerCase() === aktuell.farbe.toLowerCase()));
    $("as-reihe-knopf").classList.toggle("hidden", reiheVon(marke).length < 2);
  }
  const reiheVon = (marke) => (marke.modelle || []).filter((m) => m.inReihe !== false);

  function zeigeModell(marke, modell, farbe) {
    initLive();
    aktuell = { marke, modell, farbe: farbe || modell.farbe };
    el.classList.remove("ist-echt");
    setzeAuto(buehneLive, baueAuto(modell, aktuell.farbe));
    zeigeKarte();
  }

  // ---------- Modellreihe (wie die TikTok-Bilder) ----------
  const FOTO_H = 600;
  let fotoRenderer = null, fotoBuehne = null, fotoCam = null;
  const bildCache = new Map();
  function fotoInit() {
    if (fotoRenderer) return;
    const c = document.createElement("canvas");
    fotoRenderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true });
    fotoRenderer.setPixelRatio(1);
    fotoRenderer.setSize(1200, FOTO_H, false);
    fotoRenderer.outputEncoding = THREE.sRGBEncoding;
    fotoRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    fotoBuehne = buehne(fotoRenderer, false);
    fotoBuehne.scene.background = new THREE.Color(BODEN); // gleiche Farbe wie das Blatt → nahtlos
    fotoCam = new THREE.PerspectiveCamera(16, 1200 / FOTO_H, 0.1, 200);
  }
  // Ein Foto des Autos (Seitenansicht) als Bild-URL. Alle Autos einer Reihe im selben Maßstab (größtes = Bildbreite).
  function fotoVon(modell, farbe, massstabL) {
    const key = `${modell.id}|${farbe}|${massstabL}`;
    if (bildCache.has(key)) return bildCache.get(key);
    fotoInit();
    const auto = baueAuto(modell, farbe);
    setzeAuto(fotoBuehne, auto);
    // gleiche Kamera für alle: am längsten Auto der Reihe ausgerichtet, Auto rechtsbündig wie auf den Vorlagen
    // Abstand so, dass das längste Auto der Reihe ~94 % der Bildbreite füllt; Spiegelung unten im Bild.
    const hf = 2 * Math.atan(Math.tan((fotoCam.fov * Math.PI) / 360) * fotoCam.aspect);
    const d = Math.max((massstabL * 1.08 / 2) / Math.tan(hf / 2), 1.55 / Math.tan((fotoCam.fov * Math.PI) / 360)) + 0.95;
    const xc = (massstabL - auto.userData.masse.L) / 2; // kürzere Autos rechtsbündig wie auf den Vorlagen
    fotoCam.position.set(-xc, 0.95, -d);
    fotoCam.lookAt(-xc, 0.62, 0);
    fotoRenderer.render(fotoBuehne.scene, fotoCam);
    const url = fotoRenderer.domElement.toDataURL("image/png");
    bildCache.set(key, url);
    return url;
  }
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  async function zeigeReihe(marke) {
    const liste = reiheVon(marke);
    const inhalt = $("as-reihe-inhalt");
    $("as-reihe").classList.remove("hidden");
    inhalt.innerHTML = `<header class="as-reihe-titel">${akzent(marke, true)}<h2>${escapeHtml(marke.titel)}</h2></header>
      <ol class="as-reihe-liste">${liste.map((m, i) => `<li data-i="${i}" tabindex="0" title="Im Studio ansehen">
        <div class="as-reihe-text"><h3>${akzent(marke)}${escapeHtml(m.name)}</h3>${m.zusatz ? `<small>${escapeHtml(m.zusatz)}</small>` : ""}
        <ul>${datenZeilen({ ...m, spitze: spitzeKurz(m.spitze) })}</ul>
        <div class="as-balken" title="Leistung im Vergleich"><i style="width:${Math.round((m.ps / Math.max(...liste.map((x) => x.ps))) * 100)}%;background:${(marke.akzent || ["#ff8a1e"]).slice(-1)[0]}"></i></div></div>
        <div class="as-reihe-bild"><span class="as-lädt">baut …</span></div></li>`).join("")}</ol>
      <p class="as-reihe-fuss">Werte: Herstellerangaben, gerundet, je nach Ausstattung · Darstellung: Friday-Modell, keine Original-Fotos</p>`;
    inhalt.scrollTop = 0;
    const maxL = Math.max(...liste.map((m) => m.laenge));
    for (let i = 0; i < liste.length; i++) {
      await frame();
      if ($("as-reihe").classList.contains("hidden")) return;
      const url = fotoVon(liste[i], liste[i].farbe, maxL);
      const zelle = inhalt.querySelector(`li[data-i="${i}"] .as-reihe-bild`);
      if (zelle) zelle.innerHTML = `<img alt="${escapeHtml(liste[i].name)}" src="${url}">`;
    }
  }
  $("as-reihe-inhalt").addEventListener("click", (e) => {
    const li = e.target.closest("li[data-i]");
    if (!li || !aktuell) return;
    const m = reiheVon(aktuell.marke)[Number(li.dataset.i)];
    $("as-reihe").classList.add("hidden");
    zeigeModell(aktuell.marke, m, m.farbe);
  });

  // ---------- Als Bild speichern ----------
  function lade(url) { return new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; }); }
  function hintergrund(g, w, h) {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#d9dce1"); gr.addColorStop(0.12, BODEN); gr.addColorStop(1, BODEN);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  function akzentMalen(g, farben, x, y, hoch) {
    const b = hoch * 0.42;
    (farben?.length ? farben : ["#ff8a1e"]).forEach((c, i) => {
      g.fillStyle = c; g.beginPath();
      const x0 = x + i * (b + 4);
      g.moveTo(x0 + hoch * 0.35, y); g.lineTo(x0 + hoch * 0.35 + b, y); g.lineTo(x0 + b, y + hoch); g.lineTo(x0, y + hoch); g.closePath(); g.fill();
    });
    return (farben?.length || 1) * (b + 4) + hoch * 0.35 + 8;
  }
  async function reiheAlsBild(marke) {
    const liste = reiheVon(marke), W = 1080, H = 1920;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    hintergrund(g, W, H);
    g.fillStyle = marke.schrift || "#111";
    g.font = "italic 900 84px system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
    const tw = g.measureText(marke.titel).width;
    const aw = akzentMalen(g, marke.akzent, (W - tw) / 2 - 90, 92, 62);
    g.fillStyle = marke.schrift || "#111";
    g.fillText(marke.titel, (W - tw) / 2 - 90 + aw, 150);
    const top = 220, zeile = (H - top - 60) / liste.length;
    const maxL = Math.max(...liste.map((m) => m.laenge));
    for (let i = 0; i < liste.length; i++) {
      const m = liste[i], y = top + i * zeile;
      const img = await lade(fotoVon(m, m.farbe, maxL));
      const bw = 700, bh = bw * (FOTO_H / 1200);
      g.drawImage(img, W - bw - 10, y + zeile * 0.5 - bh * 0.62, bw, bh);
      g.fillStyle = marke.schrift || "#111";
      g.font = "italic 900 50px system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
      const a = akzentMalen(g, marke.akzent, 36, y + zeile * 0.18, 40);
      let name = m.name;
      while (g.measureText(name).width > 380 - a && name.length > 4) name = name.slice(0, -2);
      g.fillText(name === m.name ? name : `${name}…`, 36 + a, y + zeile * 0.18 + 38);
      g.font = "500 24px system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
      const motor = m.motor.length > 30 ? m.motor.replace(/,.*$/, "") : m.motor;
      [motor, `${m.ps} PS`, `0–100 km/h: ${zahl(m.null100)} s`, `Spitze: ${spitzeKurz(m.spitze)}`].forEach((t, k) => {
        g.font = `${k === 1 ? 800 : 500} 25px system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif`;
        g.fillText(t, 40, y + zeile * 0.18 + 78 + k * 31);
      });
    }
    g.font = "500 18px system-ui, sans-serif"; g.fillStyle = "#6b7078";
    g.fillText("F.R.Ai.D.A.Y Auto-Studio · Herstellerangaben, gerundet", 36, H - 28);
    return c;
  }
  function speichern(canvas, name) {
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const datei = new File([blob], `${name}.png`, { type: "image/png" });
      // iPhone: Teilen-Menü ("Bild sichern"), Mac: normaler Download.
      try { if (navigator.canShare?.({ files: [datei] }) && /iphone|ipad|android/i.test(navigator.userAgent)) { await navigator.share({ files: [datei], title: name }); return; } } catch { /* abgebrochen */ }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = datei.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/png");
  }
  const dateiname = (t) => `friday-${String(t).toLowerCase().replace(/[^a-z0-9äöü]+/g, "-").replace(/^-|-$/g, "")}`;

  $("as-reihe-foto").addEventListener("click", async () => { if (!aktuell) return; speichern(await reiheAlsBild(aktuell.marke), dateiname(`${aktuell.marke.titel}-modellreihe`)); });
  $("as-foto").addEventListener("click", () => {
    if (!renderer || !aktuell) return;
    renderer.render(buehneLive.scene, cam);
    const bild = renderer.domElement.toDataURL("image/png");
    lade(bild).then((img) => {
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const g = c.getContext("2d"); g.drawImage(img, 0, 0);
      const k = img.width / 1200, { marke, modell } = aktuell;
      g.fillStyle = marke.schrift || "#111";
      const a = akzentMalen(g, marke.akzent, 40 * k, 40 * k, 46 * k);
      g.font = `italic 900 ${54 * k}px system-ui, -apple-system, Arial, sans-serif`; g.fillText(modell.name, 40 * k + a, 84 * k);
      g.font = `500 ${24 * k}px system-ui, -apple-system, Arial, sans-serif`;
      [modell.motor, `${modell.ps} PS`, `0–100 km/h: ${zahl(modell.null100)} s`, `Spitze: ${spitzeKurz(modell.spitze)}`].forEach((t, i) => g.fillText(t, 44 * k, (124 + i * 32) * k));
      speichern(c, dateiname(`${marke.titel}-${modell.name}`));
    });
  });

  // ---------- Bedienung ----------
  el.addEventListener("click", (e) => {
    const lack = e.target.closest("[data-lack]");
    if (lack && aktuell) { zeigeModell(aktuell.marke, aktuell.modell, lack.dataset.lack); return; }
    const a = e.target.closest("[data-ansicht]");
    if (!a) return;
    const v = a.dataset.ansicht;
    ansicht.drehen = v === "drehen";
    if (v === "seite") Object.assign(ansicht, { yaw: 0, pitch: 0.06 });
    if (v === "vorne") Object.assign(ansicht, { yaw: 0.75, pitch: 0.14 });
    if (v === "hinten") Object.assign(ansicht, { yaw: -0.75, pitch: 0.14 });
    knopfAn(v);
  });
  $("as-reihe-knopf").addEventListener("click", () => aktuell && zeigeReihe(aktuell.marke));
  $("as-reihe-x").addEventListener("click", () => $("as-reihe").classList.add("hidden"));
  $("as-x").addEventListener("click", schliessen);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.classList.contains("hidden")) { e.stopImmediatePropagation(); if (!$("as-reihe").classList.contains("hidden")) $("as-reihe").classList.add("hidden"); else schliessen(); } }, true);

  function oeffnen() {
    el.classList.remove("hidden");
    initLive(); groesse();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(schleife);
  }
  function schliessen() {
    el.classList.add("hidden");
    $("as-reihe").classList.add("hidden");
    cancelAnimationFrame(raf);
  }
  // Werkstatt zu → Studio auch zu (spart Akku).
  new MutationObserver(() => { if (host.classList.contains("hidden")) schliessen(); }).observe(host, { attributes: true, attributeFilter: ["class"] });

  /** Von der Werkstatt aufgerufen: studio = { art: "reihe"|"modell", marke, modell, start, farbe } */
  function zeige(studio) {
    if (!studio?.marke?.modelle?.length) return false;
    const marke = studio.marke;
    const farbe = studio.farbe ? FARBWORT[studio.farbe] : null;
    oeffnen();
    Object.assign(ansicht, { yaw: 0, pitch: 0.06, drehen: false }); knopfAn("seite");
    if (studio.art === "reihe") {
      const start = marke.modelle.find((m) => m.id === studio.start) || reiheVon(marke)[0];
      zeigeModell(marke, start, farbe || start.farbe);
      zeigeReihe(marke);
    } else {
      const m = marke.modelle.find((x) => x.id === studio.modell) || marke.modelle[0];
      zeigeModell(marke, m, farbe || m.farbe);
    }
    return true;
  }
  // ---------- Echtes 3D-Modell (aus Fridays Bibliothek / Sketchfab) im Studio ----------
  async function echt(datei) {
    if (!datei?.id || !aktuell || !THREE.GLTFLoader) return false;
    const fuer = aktuell.modell.id;
    try {
      const res = await window.Friday.api(`/api/modelle/datei/${encodeURIComponent(datei.id)}`);
      if (!res.ok) return false;
      const gltf = await new Promise(async (ok, fail) => new THREE.GLTFLoader().parse(await res.arrayBuffer(), "", ok, fail));
      if (!aktuell || aktuell.modell.id !== fuer) return false; // inzwischen anderes Auto gewählt
      const obj = gltf.scene || gltf.scenes?.[0];
      if (!obj) return false;
      obj.updateMatrixWorld(true);
      let bb = new THREE.Box3().setFromObject(obj), size = bb.getSize(new THREE.Vector3());
      if (size.z > size.x) { obj.rotation.y = Math.PI / 2; obj.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(obj); size = bb.getSize(new THREE.Vector3()); }
      const k = (Number(datei.laenge) || aktuell.modell.laenge || 4.7) / Math.max(size.x, 1e-6);
      const wrap = new THREE.Group();
      obj.scale.multiplyScalar(k); wrap.add(obj); wrap.updateMatrixWorld(true);
      bb = new THREE.Box3().setFromObject(wrap);
      const c = bb.getCenter(new THREE.Vector3());
      obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= bb.min.y;
      wrap.updateMatrixWorld(true);
      bb = new THREE.Box3().setFromObject(wrap); size = bb.getSize(new THREE.Vector3());
      obj.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m && m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = Math.min(m.opacity ?? 1, 0.35); m.color?.setRGB(0.04, 0.05, 0.06); m.roughness = 0.03; m.depthWrite = false; m.needsUpdate = true; }
          if (m && "envMapIntensity" in m) m.envMapIntensity = Math.max(m.envMapIntensity || 1, 1.1);
        }
      });
      wrap.userData.masse = { L: size.x, H: size.y, B: size.z };
      setzeAuto(buehneLive, wrap);
      aktuell.echt = datei;
      el.classList.add("ist-echt");
      const q = document.createElement("div");
      q.className = "as-quelle";
      q.innerHTML = `Echtes 3D-Modell: ${escapeHtml(datei.name || "")}${datei.autor ? ` · ${escapeHtml(datei.autor)}` : ""}${datei.lizenz ? ` · ${escapeHtml(datei.lizenz)}` : ""}${/^https:\/\//.test(datei.link || "") ? ` · <a href="${escapeHtml(datei.link)}" target="_blank" rel="noopener">Quelle</a>` : ""} · <button type="button" data-friday-modell>Friday-Modell zeigen</button>`;
      $("as-karte").appendChild(q);
      return true;
    } catch (err) {
      console.warn("Auto-Studio, echtes Modell:", err);
      return false;
    }
  }
  el.addEventListener("click", (e) => { if (e.target.closest("[data-friday-modell]") && aktuell) zeigeModell(aktuell.marke, aktuell.modell, aktuell.farbe); });

  window.FridayStudio = { zeige, schliessen, baueAuto, echt };
})();
