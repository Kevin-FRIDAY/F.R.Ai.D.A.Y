// Fridays Bau-Vorlagen: fertige 3D-Baupläne für Fahrzeuge & Co. – ohne Claude, sofort und ohne Guthaben.
// Sportwagen, Limousine, SUV, LKW, Bus, Motorrad, Zug, Verkehrsflugzeug, Kampfjet, Helikopter,
// Containerschiff, Kreuzfahrtschiff, Motorboot, Segelboot, U-Boot und Rakete.
//
// Jede Vorlage ist "parametrisch": Länge, Breite, Höhe (und Radstand/Spannweite) lassen sich anpassen,
// z. B. mit den echten Maßen, die Claude für ein bestimmtes Modell liefert. So gibt es nie wieder
// einen leeren Bauplan – klappt Claudes Entwurf nicht, baut Friday die passende Vorlage.

const r3 = (v) => Math.round(v * 1000) / 1000;
const fmt = (v, d = 2) => Number(v).toLocaleString("de-DE", { maximumFractionDigits: d });
const sprich = (v, d = 1) => fmt(v, d); // Zahlen so, wie man sie spricht ("4,5")

// ---------- Bauteile ----------
const profil = (name, pts, breite, farbe, { z = 0, rundung = 0.03 } = {}) =>
  ({ name, form: "profil", punkte2d: pts.map(([x, y]) => [r3(x), r3(y)]), breite: r3(breite), rundung, pos: [0, 0, r3(z)], farbe });
// Draufsicht-Fläche (Flügel, Rumpf von oben): punkte2d = [x, z] relativ zu pos, dicke = Höhe in y.
const flaeche = (name, pts, dicke, pos, farbe, drehung) =>
  ({ name, form: "flaeche", punkte2d: pts.map(([x, z]) => [r3(x), r3(z)]), dicke: r3(dicke), pos: pos.map(r3), farbe, ...(drehung ? { drehung } : {}) });
const box = (name, pos, groesse, farbe, drehung) => ({ name, form: "box", pos: pos.map(r3), groesse: groesse.map(r3), farbe, ...(drehung ? { drehung } : {}) });
// zylinder: radius = Ende bei +Achse (bei achse y: unten), radius2 = anderes Ende.
const zyl = (name, pos, radius, hoehe, achse, farbe, radius2, drehung) =>
  ({ name, form: "zylinder", pos: pos.map(r3), radius: r3(radius), hoehe: r3(hoehe), achse, farbe, ...(radius2 !== undefined ? { radius2: r3(radius2) } : {}), ...(drehung ? { drehung } : {}) });
const kugel = (name, pos, radius, farbe, skala) => ({ name, form: "kugel", pos: pos.map(r3), radius: r3(radius), farbe, ...(skala ? { skala } : {}) });
const rohr = (name, punkte, dicke, farbe) => ({ name, form: "rohr", punkte: punkte.map((p) => p.map(r3)), dicke: r3(dicke), farbe });

// Spiegelt ein Teil von rechts (+z) nach links (-z) und gibt beide zurück.
function paar(t) {
  const m = JSON.parse(JSON.stringify(t));
  if (m.pos) m.pos[2] = -m.pos[2];
  if (m.punkte) m.punkte = m.punkte.map((p) => [p[0], p[1], -p[2]]);
  if (m.form === "flaeche") m.punkte2d = m.punkte2d.map(([x, z]) => [x, -z]);
  if (m.drehung) m.drehung = [-m.drehung[0], -m.drehung[1], m.drehung[2]];
  return [{ ...t, name: `${t.name} rechts` }, { ...m, name: `${m.name} links` }];
}
const paare = (...teile) => teile.flatMap(paar);

// Linear zwischen Umrisspunkten (von vorne nach hinten sortiert) die Höhe an Stelle x ablesen.
function hoeheAn(pts, x) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if ((x <= x0 && x >= x1) || (x >= x0 && x <= x1)) return x0 === x1 ? Math.max(y0, y1) : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return pts[pts.length - 1][1];
}

// Rotorblätter/Propeller: n Blätter um eine Achse.
function blaetter(name, mitte, n, laenge, breite, dicke, farbe, achse = "y", start = 0) {
  const t = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i * 360) / n, rad = (a * Math.PI) / 180;
    if (achse === "y") t.push(box(`${name} ${i + 1}`, [mitte[0] + Math.cos(rad) * laenge / 2, mitte[1], mitte[2] - Math.sin(rad) * laenge / 2], [laenge, dicke, breite], farbe, [0, a, 0]));
    else if (achse === "x") t.push(box(`${name} ${i + 1}`, [mitte[0], mitte[1] + Math.sin(rad) * laenge / 2, mitte[2] + Math.cos(rad) * laenge / 2], [dicke, breite, laenge], farbe, [-a, 0, 0]));
    else t.push(box(`${name} ${i + 1}`, [mitte[0] + Math.cos(rad) * laenge / 2, mitte[1] + Math.sin(rad) * laenge / 2, mitte[2]], [laenge, breite, dicke], farbe, [0, 0, a]));
  }
  return t;
}

// ---------- Autos: Sportwagen, Limousine, SUV ----------
const AUTO = {
  sportwagen: {
    L: 4.46, B: 1.93, H: 1.17, rs: 2.62, r: 0.34, boden: 0.11, vorne: 0.54, motor: "mitte",
    oben: [[1, 0.27], [0.99, 0.37], [0.93, 0.48], [0.84, 0.6], [0.76, 0.64], [0.69, 0.63], [0.45, 0.68], [0.3, 0.7], [0.12, 0.67], [0.03, 0.64], [0, 0.58], [0, 0.28]],
    glas: [[0.69, 0.62], [0.53, 0.97], [0.44, 1], [0.33, 0.95], [0.2, 0.72], [0.2, 0.66]], dach: [0.52, 0.34], glasBreite: 0.74,
  },
  limousine: {
    L: 4.76, B: 1.85, H: 1.43, rs: 2.82, r: 0.33, boden: 0.14, vorne: 0.46, motor: "vorne",
    oben: [[1, 0.3], [0.995, 0.5], [0.96, 0.6], [0.9, 0.64], [0.76, 0.67], [0.3, 0.7], [0.12, 0.72], [0.03, 0.7], [0, 0.62], [0, 0.3]],
    glas: [[0.76, 0.66], [0.6, 0.97], [0.5, 1], [0.33, 0.98], [0.2, 0.73], [0.2, 0.69]], dach: [0.59, 0.33], glasBreite: 0.82,
  },
  suv: {
    L: 4.7, B: 1.9, H: 1.68, rs: 2.82, r: 0.37, boden: 0.2, vorne: 0.48, motor: "vorne",
    oben: [[1, 0.32], [0.995, 0.55], [0.96, 0.64], [0.9, 0.67], [0.78, 0.69], [0.1, 0.72], [0.02, 0.71], [0, 0.62], [0, 0.3]],
    glas: [[0.78, 0.68], [0.64, 0.97], [0.55, 1], [0.1, 0.99], [0.04, 0.8], [0.05, 0.7]], dach: [0.63, 0.1], glasBreite: 0.84,
  },
};

function auto(art, o) {
  const D = AUTO[art];
  const L = o.laenge || D.L, B = o.breite || D.B, H = o.hoehe || D.H;
  const k = L / D.L;
  const rs = o.radstand || D.rs * k, r = D.r * Math.sqrt(k), bd = D.boden;
  const f = o.farbe || (art === "sportwagen" ? "orange" : "cyan");
  const elektro = o.elektro;
  const X = (fx) => -L / 2 + fx * L, Y = (fy) => fy * H;
  const ueber = Math.max(0.3, L - rs);
  const xf = L / 2 - ueber * D.vorne, xh = xf - rs;
  const oben = D.oben.map(([fx, fy]) => [X(fx), Y(fy)]);
  // Unterkante mit Radausschnitten.
  const unten = [[X(0.004), bd + 0.1]];
  for (const ax of [xh, xf]) {
    const ra = Math.max(r * 0.98, Math.min(r * 1.1, hoeheAn(oben, ax) - 0.05 - r));
    unten.push([ax - ra, bd]);
    for (let i = 0; i <= 8; i++) { const a = Math.PI - (i * Math.PI) / 8; unten.push([ax + ra * Math.cos(a), r + ra * Math.sin(a)]); }
    unten.push([ax + ra, bd]);
  }
  unten.push([X(0.985), bd + 0.04]);
  const huelle = [...unten, ...oben.filter(([x]) => x > unten[0][0] || true)];
  const glas = D.glas.map(([fx, fy]) => [X(fx), Y(fy)]);
  const wsX = glas[0][0], belt = hoeheAn(oben, wsX - 0.1);
  const [d0, d1] = D.dach;

  const karosserie = [
    profil("Karosserie", huelle, B, f, { rundung: 0.07 }),
    profil("Fahrgastzelle (Scheiben)", glas, B * D.glasBreite, "glas", { rundung: 0.05 }),
    box("Dach", [(X(d0) + X(d1)) / 2, Y(0.985), 0], [Math.abs(X(d0) - X(d1)) * 0.92, 0.035, B * D.glasBreite * 0.94], f),
    box("Unterboden", [(xf + xh) / 2, bd + 0.03, 0], [rs + 0.4, 0.05, B * 0.86], "schwarz"),
  ];
  const tw = art === "sportwagen" ? 0.28 : 0.24, rz = B / 2 - tw / 2 - 0.02;
  const raeder = [];
  for (const [ax, wo] of [[xf, "vorne"], [xh, "hinten"]]) {
    raeder.push(...paare(
      zyl(`Reifen ${wo}`, [ax, r, rz], r, tw, "z", "schwarz"),
      zyl(`Felge ${wo}`, [ax, r, rz + 0.012], r * 0.68, tw + 0.01, "z", "chrom"),
      zyl(`Bremsscheibe ${wo}`, [ax, r, rz - 0.06], r * 0.5, 0.03, "z", "grau"),
      box(`Bremssattel ${wo}`, [ax + r * 0.32, r + r * 0.25, rz - 0.06], [0.12, 0.16, 0.07], art === "sportwagen" ? "gelb" : "rot"),
    ));
    raeder.push(zyl(`Achse ${wo}`, [ax, r, 0], 0.035, B - 0.4, "z", "grau"));
  }
  const xl = L / 2 - 0.2;
  const gesicht = [
    ...paare(box("Scheinwerfer", [xl, hoeheAn(oben, xl) - 0.07, B / 2 - 0.3], [0.32, 0.07, 0.42], "weiss", [0, 0, art === "sportwagen" ? -14 : -6])),
    ...paare(box("Rückleuchte", [X(0.012), hoeheAn(oben, X(0.012)) - 0.09, B / 2 - 0.3], [0.06, 0.08, 0.48], "rot")),
    box("Leuchtband hinten", [X(0.006), hoeheAn(oben, X(0.012)) - 0.09, 0], [0.04, 0.025, B * 0.36], "rot"),
    ...paare(box("Außenspiegel", [wsX - 0.12, belt + 0.06, B / 2 + 0.06], [0.16, 0.1, 0.14], f)),
    ...paare(box("Spiegelarm", [wsX - 0.12, belt + 0.02, B / 2 - 0.01], [0.06, 0.03, 0.08], "schwarz")),
    ...paare(box("Türgriff", [wsX - 0.75, belt - 0.08, B / 2 + 0.005], [0.16, 0.025, 0.02], "chrom")),
  ];
  if (art === "sportwagen") {
    gesicht.push(
      ...paare(box("Lufteinlass vorne", [L / 2 - 0.08, Y(0.2), B / 2 - 0.42], [0.12, 0.16, 0.5], "schwarz", [0, 0, -20])),
      ...paare(box("Seitlicher Lufteinlass", [xh + r * 1.6, Y(0.52), B / 2 - 0.02], [0.45, 0.16, 0.05], "schwarz", [0, 0, -12])),
      box("Diffusor", [X(0.02), bd + 0.09, 0], [0.3, 0.1, B * 0.7], "schwarz", [0, 0, 18]),
      box("Heckspoiler", [X(0.03), hoeheAn(oben, X(0.03)) + 0.03, 0], [0.22, 0.025, B * 0.8], "schwarz"),
      box("Motorabdeckung (Lamellen)", [X(0.17), hoeheAn(oben, X(0.17)) + 0.005, 0], [0.55, 0.02, B * 0.45], "schwarz"),
    );
  } else {
    gesicht.push(
      box("Kühlergrill", [L / 2 - 0.02, Y(art === "suv" ? 0.47 : 0.4), 0], [0.05, Y(art === "suv" ? 0.2 : 0.16), B * 0.4], "schwarz"),
      box("Emblem", [L / 2 + 0.01, Y(art === "suv" ? 0.5 : 0.43), 0], [0.02, 0.07, 0.2], "chrom"),
      box("Stoßfänger-Einlass", [L / 2 - 0.04, Y(0.22), 0], [0.06, 0.08, B * 0.6], "schwarz"),
      box("Kennzeichen", [X(0.004) - 0.01, Y(0.45), 0], [0.02, 0.11, 0.52], "weiss"),
    );
    if (art === "suv") gesicht.push(...paare(rohr("Dachreling", [[X(0.6), Y(1) + 0.05, B * 0.38], [X(0.15), Y(1) + 0.05, B * 0.38]], 0.04, "chrom")));
  }
  const sx = wsX - (art === "sportwagen" ? 0.85 : 0.75), sz = B * 0.2;
  const innen = [
    ...paare(box("Vordersitz", [sx, bd + 0.42, sz], [0.5, 0.52, 0.5], "grau")),
    box("Armaturenbrett", [wsX - 0.2, belt - 0.05, 0], [0.3, 0.2, B * 0.8], "schwarz"),
    zyl("Lenkrad", [wsX - 0.42, belt + 0.05, -sz], 0.18, 0.04, "x", "schwarz", undefined, [0, 0, -25]),
    box("Mittelkonsole", [sx + 0.1, bd + 0.3, 0], [0.7, 0.2, 0.2], "schwarz"),
  ];
  if (art !== "sportwagen") innen.push(box("Rückbank", [sx - 0.9, bd + 0.42, 0], [0.5, 0.5, B * 0.72], "grau"));

  let antrieb;
  if (elektro) {
    antrieb = [
      box("Batterie (Unterboden)", [(xf + xh) / 2, bd + 0.15, 0], [rs * 0.85, 0.14, B * 0.7], "gruen"),
      zyl("E-Motor hinten", [xh, r, 0], 0.16, 0.45, "z", "orange"),
      zyl("E-Motor vorne", [xf, r, 0], 0.14, 0.4, "z", "orange"),
      box("Leistungselektronik", [xh + 0.4, r + 0.15, 0], [0.3, 0.15, 0.4], "gelb"),
      rohr("Hochvoltkabel", [[xh + 0.4, r + 0.1, 0.1], [xf - 0.3, bd + 0.24, 0.1], [xf, r, 0.1]], 0.03, "gelb"),
      box("Ladeanschluss", [X(0.08), belt - 0.05, B / 2 - 0.01], [0.12, 0.1, 0.03], "gelb"),
    ];
  } else {
    const mx = D.motor === "mitte" ? xh + 0.75 : xf - 0.05;
    antrieb = [
      box("Motor", [mx, bd + 0.4, 0], [0.62, 0.42, 0.66], "orange"),
      box("Getriebe", [D.motor === "mitte" ? xh + 0.15 : mx - 0.5, bd + 0.3, 0], [0.45, 0.28, 0.32], "orange"),
      box("Kühler", [D.motor === "mitte" ? L / 2 - 0.35 : L / 2 - 0.25, bd + 0.3, 0], [0.08, 0.38, B * 0.55], "grau"),
      box("Tank", [D.motor === "mitte" ? xf - 0.55 : xh + 0.45, bd + 0.2, 0], [0.5, 0.22, B * 0.5], "rot"),
      box("Batterie", [D.motor === "mitte" ? xf - 0.1 : mx + 0.1, bd + 0.42, B * 0.3], [0.25, 0.18, 0.17], "gruen"),
      ...paare(rohr("Auspuff", [[mx - 0.2, bd + 0.25, 0.25], [X(0.06), bd + 0.16, 0.3], [X(-0.005), bd + 0.16, 0.3]], 0.07, "grau")),
      ...paare(zyl("Endrohr", [X(0.003), bd + 0.16, 0.3], 0.05, 0.12, "x", "chrom")),
    ];
    if (D.motor === "vorne") antrieb.push(rohr("Kardanwelle", [[mx - 0.75, bd + 0.2, 0], [xh, r, 0]], 0.06, "orange"));
  }
  const name = { sportwagen: "Sportwagen", limousine: "Limousine", suv: "SUV" }[art];
  return {
    titel: name, typ: `${name}${elektro ? " · Elektro" : ""}`,
    masse: { Länge: L, Breite: B, Höhe: H, Radstand: rs },
    schritte: [
      { status: "Karosserie", sagen: `Zuerst die Karosserie: ${sprich(L, 2)} Meter lang, ${sprich(B, 2)} breit und ${sprich(H, 2)} hoch. Darauf sitzt die Fahrgastzelle mit den Scheiben.`, teile: karosserie },
      { status: "Räder", sagen: `Jetzt die vier Räder mit Felgen und Bremsen. Der Radstand beträgt ${sprich(rs, 2)} Meter.`, teile: raeder },
      { status: "Gesicht & Lichter", sagen: art === "sportwagen" ? "Dann das Gesicht: flache Scheinwerfer, große Lufteinlässe, Diffusor und Spoiler hinten." : "Dann das Gesicht: Kühlergrill, Scheinwerfer, Rückleuchten und Außenspiegel.", teile: gesicht },
      { status: "Innenraum", sagen: "Im Innenraum sitzen Sitze, Armaturenbrett und Lenkrad.", teile: innen },
      { status: "Antrieb", sagen: elektro ? "Zum Schluss der Antrieb: die große Batterie im Unterboden und je ein Elektromotor an den Achsen." : D.motor === "mitte" ? "Zum Schluss der Antrieb: Der Motor sitzt hinter den Sitzen, das ist ein Mittelmotor. Dahinter das Getriebe und die Abgasanlage." : "Zum Schluss der Antrieb: Motor vorne, Getriebe, Kardanwelle, Tank und Auspuff.", teile: antrieb },
    ],
  };
}

// ---------- LKW (Sattelzug) ----------
function lkw(o) {
  const L = o.laenge || 16.5, B = o.breite || 2.55, H = o.hoehe || 4;
  const f = o.farbe || "rot", k = L / 16.5;
  const zl = 6 * k; // Zugmaschine
  const x0 = L / 2; // Front
  const r = 0.53;
  const kabine = profil("Fahrerhaus", [[x0, 0.9], [x0, 2.9], [x0 - 0.25, 3.75], [x0 - 2.3, 3.85], [x0 - 2.35, 0.9]], B, f, { rundung: 0.1 });
  const teile1 = [
    kabine,
    box("Frontscheibe", [x0 - 0.06, 2.95, 0], [0.04, 0.9, B * 0.9], "glas", [0, 0, 8]),
    box("Rahmen", [x0 - zl / 2, 0.85, 0], [zl, 0.25, 1.0], "grau"),
    box("Sattelkupplung", [x0 - zl + 1.4, 1.1, 0], [0.8, 0.1, 0.8], "schwarz"),
    box("Auflieger (Koffer)", [x0 - zl - 6.3 * k + 1.6, 2.55, 0], [13.6 * k, 2.8, B], "weiss"),
    box("Auflieger-Rahmen", [x0 - zl - 6.3 * k + 1.6, 1.05, 0], [13.6 * k, 0.2, 1.0], "grau"),
  ];
  const ach = [x0 - 1.4, x0 - zl + 1.6, -L / 2 + 3.2, -L / 2 + 2.0, -L / 2 + 0.8];
  const raeder = [];
  ach.forEach((ax, i) => {
    raeder.push(...paare(
      zyl(`Reifen Achse ${i + 1}`, [ax, r, B / 2 - 0.25], r, i === 0 ? 0.32 : 0.5, "z", "schwarz"),
      zyl(`Felge Achse ${i + 1}`, [ax, r, B / 2 - 0.24], r * 0.6, i === 0 ? 0.33 : 0.51, "z", "chrom"),
    ));
    raeder.push(zyl(`Achse ${i + 1}`, [ax, r, 0], 0.07, B - 0.5, "z", "grau"));
  });
  const details = [
    ...paare(box("Scheinwerfer", [x0 + 0.01, 1.15, B / 2 - 0.35], [0.04, 0.18, 0.4], "weiss")),
    box("Kühlergrill", [x0 + 0.01, 1.9, 0], [0.04, 1.0, B * 0.6], "schwarz"),
    box("Stoßstange", [x0 + 0.02, 0.85, 0], [0.12, 0.3, B], "grau"),
    ...paare(box("Außenspiegel", [x0 - 0.15, 3.0, B / 2 + 0.25], [0.12, 0.6, 0.2], "schwarz")),
    box("Dachspoiler", [x0 - 1.2, 4.0, 0], [1.8, 0.3, B * 0.9], f, [0, 0, -6]),
    ...paare(box("Rückleuchte", [-L / 2 + 0.01, 1.25, B / 2 - 0.25], [0.04, 0.14, 0.35], "rot")),
    ...paare(zyl("Tank", [x0 - 3.2, 1.0, B / 2 - 0.35], 0.33, 1.3, "x", "chrom")),
    ...paare(box("Trittstufen", [x0 - 1.1, 0.7, B / 2 - 0.02], [0.5, 0.35, 0.05], "grau")),
  ];
  const technik = [
    box("Dieselmotor (13 Liter)", [x0 - 1.4, 1.35, 0], [1.3, 0.9, 0.9], "orange"),
    box("Getriebe", [x0 - 2.5, 1.0, 0], [0.8, 0.5, 0.5], "orange"),
    rohr("Kardanwelle", [[x0 - 2.9, 0.9, 0], [x0 - zl + 1.6, r, 0]], 0.1, "orange"),
    box("AdBlue-Tank", [x0 - 3.3, 0.9, -B / 2 + 0.5], [0.6, 0.4, 0.4], "blau"),
    box("Batterien", [x0 - 4.3, 0.9, B / 2 - 0.4], [0.6, 0.35, 0.5], "gruen"),
    rohr("Auspuff", [[x0 - 1.8, 1.2, 0.4], [x0 - 2.5, 0.8, 0.8], [x0 - 3.8, 0.8, 0.8]], 0.12, "grau"),
  ];
  return {
    titel: "LKW (Sattelzug)", typ: "Nutzfahrzeug · Sattelzug", masse: { Länge: L, Breite: B, Höhe: H },
    schritte: [
      { status: "Zugmaschine & Auflieger", sagen: `Zuerst die Grundform: Zugmaschine mit Fahrerhaus und Auflieger, zusammen ${sprich(L)} Meter lang und ${sprich(H)} Meter hoch.`, teile: teile1 },
      { status: "Achsen & Räder", sagen: "Jetzt die fünf Achsen: zwei an der Zugmaschine, drei am Auflieger.", teile: raeder },
      { status: "Details", sagen: "Dann Scheinwerfer, Kühlergrill, Spiegel, Dachspoiler und die Tanks.", teile: details },
      { status: "Antrieb", sagen: "Zum Schluss der Antrieb: ein großer Dieselmotor unter dem Fahrerhaus, Getriebe und Kardanwelle zur Antriebsachse.", teile: technik },
    ],
  };
}

// ---------- Bus ----------
function bus(o) {
  const L = o.laenge || 12.2, B = o.breite || 2.55, H = o.hoehe || 3.4, f = o.farbe || "gelb";
  const x0 = L / 2, r = 0.5;
  const huelle = [[-x0, 0.35], [x0 - 0.1, 0.35], [x0, 0.6], [x0, 2.6], [x0 - 0.35, H], [-x0 + 0.25, H], [-x0, H - 0.3]];
  const form = [
    profil("Aufbau", huelle, B, f, { rundung: 0.1 }),
    box("Frontscheibe", [x0 - 0.03, 2.0, 0], [0.04, 1.8, B * 0.92], "glas", [0, 0, -4]),
    ...paare(box("Fensterband", [-0.4, 2.3, B / 2 + 0.005], [L - 2.4, 1.1, 0.02], "glas")),
    box("Dachklima", [-1, H + 0.15, 0], [2.6, 0.3, 1.6], "grau"),
  ];
  const raeder = [];
  for (const [ax, wo] of [[x0 - 2.7, "vorne"], [-x0 + 3.2, "hinten"]]) {
    raeder.push(...paare(zyl(`Reifen ${wo}`, [ax, r, B / 2 - 0.2], r, 0.32, "z", "schwarz"), zyl(`Felge ${wo}`, [ax, r, B / 2 - 0.19], r * 0.6, 0.33, "z", "chrom")));
  }
  const details = [
    ...paare(box("Scheinwerfer", [x0 + 0.01, 0.75, B / 2 - 0.35], [0.04, 0.15, 0.4], "weiss")),
    ...paare(box("Rückleuchte", [-x0 - 0.01, 1.0, B / 2 - 0.25], [0.04, 0.4, 0.2], "rot")),
    box("Tür vorne", [x0 - 1.0, 1.5, B / 2 + 0.01], [1.1, 2.3, 0.02], "glas"),
    box("Tür Mitte", [0, 1.5, B / 2 + 0.01], [1.2, 2.3, 0.02], "glas"),
    box("Zielanzeige", [x0 - 0.05, H - 0.25, 0], [0.04, 0.25, B * 0.7], "orange"),
    ...paare(box("Spiegel", [x0 + 0.2, 2.5, B / 2 + 0.1], [0.1, 0.4, 0.15], "schwarz")),
  ];
  const innen = [];
  for (let i = 0; i < 10; i++) innen.push(...paare(box(`Sitzreihe ${i + 1}`, [x0 - 3.2 - i * 0.8, 0.95, B / 2 - 0.55], [0.45, 0.5, 0.9], "grau")));
  innen.push(box("Fahrerplatz", [x0 - 1.4, 1.0, -B / 2 + 0.55], [0.5, 0.5, 0.5], "schwarz"), box("Motor (Heck)", [-x0 + 1.0, 1.0, 0], [1.2, 0.9, 1.4], "orange"));
  return {
    titel: "Bus", typ: "Linien- / Reisebus", masse: { Länge: L, Breite: B, Höhe: H },
    schritte: [
      { status: "Aufbau", sagen: `Zuerst der Aufbau: ${sprich(L)} Meter lang mit großem Fensterband.`, teile: form },
      { status: "Räder", sagen: "Jetzt die Räder: vorne gelenkt, hinten angetrieben.", teile: raeder },
      { status: "Türen & Lichter", sagen: "Dann Türen, Scheinwerfer, Rückleuchten und die Zielanzeige.", teile: details },
      { status: "Innenraum & Motor", sagen: "Innen die Sitzreihen und der Fahrerplatz. Der Motor sitzt im Heck.", teile: innen },
    ],
  };
}

// ---------- Motorrad ----------
function motorrad(o) {
  const L = o.laenge || 2.1, H = o.hoehe || 1.15, f = o.farbe || "rot", k = L / 2.1;
  const r = 0.31 * k, xv = 0.72 * k, xh = -0.7 * k;
  const raeder = [
    zyl("Reifen vorne", [xv, r, 0], r, 0.12, "z", "schwarz"), zyl("Felge vorne", [xv, r, 0], r * 0.75, 0.13, "z", "chrom"),
    zyl("Reifen hinten", [xh, r, 0], r, 0.19, "z", "schwarz"), zyl("Felge hinten", [xh, r, 0], r * 0.75, 0.2, "z", "chrom"),
    zyl("Bremsscheibe vorne", [xv, r, 0.09], r * 0.6, 0.01, "z", "grau"),
  ];
  const rahmen = [
    ...paare(rohr("Gabel", [[xv, r, 0.09], [xv - 0.26 * k, 0.95 * k, 0.09]], 0.05, "chrom")),
    rohr("Rahmen", [[xv - 0.27 * k, 0.95 * k, 0], [-0.05, 0.85 * k, 0], [xh + 0.1, 0.55 * k, 0], [xh, r, 0]], 0.05, "grau"),
    rohr("Rahmen unten", [[xv - 0.27 * k, 0.9 * k, 0], [0.1, 0.35 * k, 0], [-0.25 * k, 0.33 * k, 0], [xh, r, 0]], 0.05, "grau"),
    ...paare(rohr("Schwinge", [[-0.2 * k, 0.4 * k, 0.12], [xh, r, 0.12]], 0.05, "grau")),
  ];
  const verkleidung = [
    profil("Tank", [[0.35 * k, 0.85 * k], [0.28 * k, 1.0 * k], [-0.05, 1.02 * k], [-0.18 * k, 0.9 * k], [0.05, 0.8 * k]], 0.34, f, { rundung: 0.06 }),
    profil("Sitzbank", [[-0.18 * k, 0.9 * k], [-0.6 * k, 0.88 * k], [-0.75 * k, 0.92 * k], [-0.75 * k, 0.84 * k], [-0.18 * k, 0.82 * k]], 0.3, "schwarz", { rundung: 0.05 }),
    profil("Verkleidung vorne", [[0.62 * k, 0.75 * k], [0.55 * k, 1.05 * k], [0.4 * k, H], [0.35 * k, 0.9 * k], [0.45 * k, 0.6 * k]], 0.42, f, { rundung: 0.06 }),
    box("Windschild", [0.42 * k, H - 0.02, 0], [0.2, 0.18, 0.3], "glas", [0, 0, 40]),
    profil("Heck", [[-0.6 * k, 0.88 * k], [-0.95 * k, 1.0 * k], [-0.95 * k, 0.95 * k], [-0.6 * k, 0.75 * k]], 0.2, f, { rundung: 0.04 }),
    zyl("Scheinwerfer", [0.6 * k, 0.88 * k, 0], 0.09, 0.08, "x", "weiss"),
    box("Rücklicht", [-0.96 * k, 0.97 * k, 0], [0.03, 0.04, 0.12], "rot"),
    rohr("Lenker", [[0.32 * k, 1.0 * k, -0.36], [0.36 * k, 0.98 * k, 0], [0.32 * k, 1.0 * k, 0.36]], 0.03, "schwarz"),
    ...paare(box("Spiegel", [0.38 * k, 1.12 * k, 0.32], [0.04, 0.06, 0.12], "schwarz")),
  ];
  const technik = [
    box("Motor", [0.0, 0.45 * k, 0], [0.45 * k, 0.38 * k, 0.4], "orange"),
    zyl("Zylinderkopf", [0.15 * k, 0.7 * k, 0], 0.12, 0.42, "z", "orange"),
    rohr("Auspuff", [[0.2 * k, 0.45 * k, 0.15], [-0.1, 0.25 * k, 0.2], [-0.6 * k, 0.4 * k, 0.2], [-0.9 * k, 0.55 * k, 0.2]], 0.07, "chrom"),
    rohr("Kette", [[0.02, 0.38 * k, 0.12], [xh, r, 0.12]], 0.02, "grau"),
    box("Batterie", [-0.25 * k, 0.65 * k, 0], [0.12, 0.1, 0.15], "gruen"),
  ];
  return {
    titel: "Motorrad", typ: "Motorrad · Sporttourer", masse: { Länge: L, Höhe: H, Radstand: xv - xh },
    schritte: [
      { status: "Räder", sagen: "Zuerst die zwei Räder, vorne mit großer Bremsscheibe.", teile: raeder },
      { status: "Rahmen", sagen: "Jetzt der Rahmen mit Gabel und Schwinge. Er trägt alles.", teile: rahmen },
      { status: "Tank & Verkleidung", sagen: "Dann Tank, Sitzbank, Verkleidung, Lenker und Lichter.", teile: verkleidung },
      { status: "Motor", sagen: "Zum Schluss der Motor mit Auspuff und Kette zum Hinterrad.", teile: technik },
    ],
  };
}

// ---------- Zug (Hochgeschwindigkeitszug) ----------
function zug(o) {
  const f = o.farbe || "weiss", B = o.breite || 2.95, H = o.hoehe || 3.9;
  const kopf = 20, wagen = 24.8, n = 2, L = o.laenge || kopf + n * (wagen + 0.6);
  const x0 = L / 2;
  const form = [profil("Triebkopf", [[x0, 0.95], [x0 - 0.4, 1.5], [x0 - 3.5, 3.0], [x0 - 6.5, H], [x0 - kopf, H], [x0 - kopf, 0.9]], B, f, { rundung: 0.1 }),
    box("Frontscheibe", [x0 - 3.6, 3.1, 0], [2.2, 0.04, B * 0.75], "glas", [0, 0, 22]),
    box("Zierstreifen Triebkopf", [x0 - kopf / 2 - 1, 1.3, B / 2 + 0.005], [kopf - 2, 0.2, 0.02], "rot"),
    box("Zierstreifen links", [x0 - kopf / 2 - 1, 1.3, -B / 2 - 0.005], [kopf - 2, 0.2, 0.02], "rot")];
  const wagenTeile = [];
  for (let i = 0; i < n; i++) {
    const mx = x0 - kopf - 0.6 - wagen / 2 - i * (wagen + 0.6);
    wagenTeile.push(profil(`Mittelwagen ${i + 1}`, [[mx + wagen / 2, 0.9], [mx + wagen / 2, H - 0.25], [mx + wagen / 2 - 0.4, H], [mx - wagen / 2 + 0.4, H], [mx - wagen / 2, H - 0.25], [mx - wagen / 2, 0.9]], B, f, { rundung: 0.1 }));
    wagenTeile.push(...paare(box(`Fensterband Wagen ${i + 1}`, [mx, 2.55, B / 2 + 0.005], [wagen - 3, 0.75, 0.02], "glas")));
    wagenTeile.push(...paare(box(`Zierstreifen Wagen ${i + 1}`, [mx, 1.3, B / 2 + 0.005], [wagen - 1, 0.2, 0.02], "rot")));
    wagenTeile.push(box(`Übergang ${i + 1}`, [mx + wagen / 2 + 0.3, 2.2, 0], [0.6, 2.4, 1.4], "schwarz"));
  }
  const fahrwerk = [];
  const dgs = [x0 - 4, x0 - kopf + 3];
  for (let i = 0; i < n; i++) { const mx = x0 - kopf - 0.6 - wagen / 2 - i * (wagen + 0.6); dgs.push(mx + wagen / 2 - 3, mx - wagen / 2 + 3); }
  dgs.forEach((x, i) => {
    fahrwerk.push(box(`Drehgestell ${i + 1}`, [x, 0.55, 0], [3.2, 0.35, 2.2], "grau"));
    for (const dx of [-1.25, 1.25]) fahrwerk.push(...paare(zyl(`Rad ${i + 1}`, [x + dx, 0.46, 0.72], 0.46, 0.14, "z", "chrom")));
  });
  fahrwerk.push(...paare(rohr("Schiene", [[x0 + 5, 0.03, 0.72], [-x0 - 5, 0.03, 0.72]], 0.07, "grau")));
  const technik = [
    rohr("Stromabnehmer", [[x0 - 12, H, 0], [x0 - 13.2, H + 1.0, 0], [x0 - 12.2, H + 1.6, 0]], 0.06, "gelb"),
    box("Schleifleiste", [x0 - 12.2, H + 1.62, 0], [0.3, 0.05, 1.9], "gelb"),
    box("Transformator", [x0 - 11, 0.65, 0], [3.5, 0.6, 1.8], "orange"),
    box("Stromrichter", [x0 - 15, 2.0, 0], [3, 1.6, 1.4], "gelb"),
    ...dgs.slice(0, 2).map((x, i) => zyl(`Fahrmotor ${i + 1}`, [x, 0.55, 0], 0.3, 0.9, "z", "orange")),
    box("Führerstand", [x0 - 4.8, 2.3, 0], [1.2, 0.8, B * 0.8], "schwarz"),
  ];
  return {
    titel: "Hochgeschwindigkeitszug", typ: "Schienenfahrzeug · Triebkopf + Mittelwagen", masse: { Länge: L, Breite: B, Höhe: H },
    schritte: [
      { status: "Triebkopf", sagen: "Zuerst der Triebkopf mit der spitzen, windschnittigen Nase.", teile: form },
      { status: "Wagen", sagen: `Jetzt ${n} Mittelwagen mit Fensterbändern. Zusammen ist der Zug ${Math.round(L)} Meter lang.`, teile: wagenTeile },
      { status: "Drehgestelle", sagen: "Dann die Drehgestelle mit den Radsätzen auf den Schienen.", teile: fahrwerk },
      { status: "Technik", sagen: "Zum Schluss die Technik: Stromabnehmer auf dem Dach, Transformator, Stromrichter und Fahrmotoren.", teile: technik },
    ],
  };
}

// ---------- Verkehrsflugzeug ----------
function flugzeug(o) {
  const L = o.laenge || 37.6, S = o.spannweite || o.breite || 35.8, H = o.hoehe || 11.8, f = o.farbe || "weiss";
  const k = L / 37.6, R = 1.98 * k, yC = 1.6 * k + R;
  const rumpfVorne = 0.36 * L, rumpfHinten = -0.26 * L;
  const rumpf = [
    zyl("Rumpf", [(rumpfVorne + rumpfHinten) / 2, yC, 0], R, rumpfVorne - rumpfHinten, "x", f),
    zyl("Bug", [rumpfVorne + 0.05 * L, yC - 0.1 * R, 0], R * 0.5, 0.1 * L, "x", f, R),
    kugel("Bugspitze", [rumpfVorne + 0.1 * L, yC - 0.12 * R, 0], R * 0.5, f),
    zyl("Heckkonus", [rumpfHinten - 0.12 * L, yC + 0.08 * R, 0], R, 0.24 * L, "x", f, R * 0.18),
    box("Cockpitscheiben", [rumpfVorne + 0.065 * L, yC + 0.45 * R, 0], [1.4 * k, 0.4 * k, R * 1.1], "glas", [0, 0, -20]),
    ...paare(box("Fensterreihe", [0.04 * L, yC + 0.25 * R, R * 0.985], [0.55 * L, 0.28 * k, 0.03], "glas")),
    ...paare(box("Tür vorne", [rumpfVorne - 1.5 * k, yC, R * 0.99], [0.9 * k, 1.9 * k, 0.03], "grau")),
  ];
  const sw = Math.tan((25 * Math.PI) / 180);
  const halb = S / 2, wy = yC - 0.6 * R, lr = 0.1 * L, cr = 0.19 * L, ct = 0.045 * L;
  const fluegel = paare(
    flaeche("Tragfläche", [[lr, R * 0.7], [lr - (halb - R) * sw, halb], [lr - (halb - R) * sw - ct, halb], [lr - cr, R * 0.7]], 0.45 * k, [0, wy, 0], f, [-5, 0, 0]),
    box("Winglet", [lr - (halb - R) * sw - ct / 2, wy + (halb) * 0.087 + 1.1 * k, halb], [ct, 2.2 * k, 0.12], f, [0, 0, -15]),
  );
  const ht = rumpfHinten - 0.17 * L;
  fluegel.push(...paare(flaeche("Höhenleitwerk", [[ht + 2.5 * k, R * 0.3], [ht - 1.5 * k, 6.1 * k], [ht - 3.0 * k, 6.1 * k], [ht - 1.8 * k, R * 0.3]], 0.25 * k, [0, yC + 0.2 * R, 0], f, [-5, 0, 0])));
  fluegel.push(profil("Seitenleitwerk", [[rumpfHinten - 0.1 * L, yC + 0.6 * R], [rumpfHinten - 0.2 * L, H - 0.2], [rumpfHinten - 0.235 * L, H], [rumpfHinten - 0.25 * L, yC + 0.9 * R]], 0.35 * k, f));
  const ez = 0.32 * halb, ex = lr - (ez - R) * sw + 1.2 * k, ey = wy + ez * 0.087 - 1.35 * k;
  const triebwerke = paare(
    zyl("Triebwerk", [ex, ey, ez], 1.0 * k, 4.4 * k, "x", "grau", 0.8 * k),
    zyl("Fan", [ex + 2.15 * k, ey, ez], 0.92 * k, 0.08, "x", "chrom"),
    kugel("Spinner", [ex + 2.2 * k, ey, ez], 0.28 * k, "chrom"),
    box("Pylon", [ex - 1.0 * k, ey + 0.9 * k, ez], [3.2 * k, 0.8 * k, 0.35 * k], f),
  );
  const fahrwerk = [
    rohr("Bugfahrwerk", [[rumpfVorne - 1.2 * k, yC - R, 0], [rumpfVorne - 1.2 * k, 0.4 * k, 0]], 0.18 * k, "grau"),
    ...paare(zyl("Bugrad", [rumpfVorne - 1.2 * k, 0.38 * k, 0.25 * k], 0.38 * k, 0.25 * k, "z", "schwarz")),
  ];
  for (const z of [3.8 * k]) {
    fahrwerk.push(...paare(rohr("Hauptfahrwerk", [[0.02 * L - 2 * k, wy, z], [0.02 * L - 2 * k, 0.6 * k, z]], 0.25 * k, "grau")));
    fahrwerk.push(...paare(zyl("Hauptrad außen", [0.02 * L - 2 * k, 0.58 * k, z + 0.4 * k], 0.58 * k, 0.38 * k, "z", "schwarz"), zyl("Hauptrad innen", [0.02 * L - 2 * k, 0.58 * k, z - 0.4 * k], 0.58 * k, 0.38 * k, "z", "schwarz")));
  }
  const innen = [
    box("Kabinenboden", [0.04 * L, yC - 0.3 * R, 0], [0.6 * L, 0.08, R * 1.8], "grau"),
    ...paare(box("Sitzreihen", [0.03 * L, yC + 0.05 * R, R * 0.5], [0.55 * L, 0.6 * k, R * 0.7], "blau")),
    box("Cockpit", [rumpfVorne + 0.03 * L, yC, 0], [1.6 * k, 1.0 * k, R * 1.2], "schwarz"),
    box("Frachtraum", [0.03 * L, yC - 0.65 * R, 0], [0.5 * L, R * 0.55, R * 1.3], "orange"),
    ...paare(flaeche("Kerosintank", [[lr - 1 * k, R * 0.8], [lr - 1 * k - (halb * 0.7 - R) * sw, halb * 0.7], [lr - 1 * k - (halb * 0.7 - R) * sw - ct * 1.6, halb * 0.7], [lr - cr + 2 * k, R * 0.8]], 0.25 * k, [0, wy, 0], "orange", [-5, 0, 0])),
    box("Hilfsturbine (APU)", [rumpfHinten - 0.22 * L, yC + 0.25 * R, 0], [1.4 * k, 0.6 * k, 0.6 * k], "gelb"),
  ];
  return {
    titel: "Verkehrsflugzeug", typ: "Verkehrsflugzeug · Mittelstrecke", masse: { Länge: L, Spannweite: S, Höhe: H },
    schritte: [
      { status: "Rumpf", sagen: `Zuerst der Rumpf: ${sprich(L)} Meter lang, mit Cockpit vorne und der Fensterreihe für die Passagiere.`, teile: rumpf },
      { status: "Tragflächen & Leitwerk", sagen: `Jetzt die gepfeilten Tragflächen mit ${sprich(S)} Metern Spannweite, dazu Höhen- und Seitenleitwerk.`, teile: fluegel },
      { status: "Triebwerke", sagen: "Dann die zwei Mantelstrom-Triebwerke unter den Flügeln. Der große Fan vorne erzeugt den meisten Schub.", teile: triebwerke },
      { status: "Fahrwerk", sagen: "Das Fahrwerk: Bugrad vorne, zwei Hauptfahrwerke unter dem Rumpf.", teile: fahrwerk },
      { status: "Innen & Tanks", sagen: "Zum Schluss das Innere: Kabine mit Sitzreihen, Frachtraum unten, und der Treibstoff steckt in den Flügeln.", teile: innen },
    ],
  };
}

// ---------- Kampfjet ----------
function kampfjet(o) {
  const L = o.laenge || 15.1, S = o.spannweite || o.breite || 9.96, H = o.hoehe || 4.9, f = o.farbe || "grau";
  const k = L / 15.1, R = 0.68 * k, yC = 2.0 * k;
  const vorne = 0.2 * L, hinten = -0.42 * L;
  const rumpf = [
    zyl("Rumpf", [(vorne + hinten) / 2, yC, 0], R, vorne - hinten, "x", f),
    zyl("Rumpfspitze (Radom)", [vorne + 0.14 * L, yC - 0.05, 0], 0.08 * k, 0.28 * L, "x", f, R),
    zyl("Schubdüse", [hinten - 0.04 * L, yC, 0], R * 0.85, 0.08 * L, "x", "grau", R * 0.72),
    kugel("Cockpithaube", [vorne + 0.04 * L, yC + R * 0.85, 0], 0.5 * k, "glas", [3.2, 1.05, 0.95]),
    box("Lufteinlass", [0.02 * L, yC - R * 1.0, 0], [3.2 * k, 0.9 * k, 1.1 * k], "schwarz"),
    box("Rumpfrücken", [-0.12 * L, yC + R * 0.6, 0], [0.4 * L, 0.5 * k, 1.0 * k], f),
  ];
  const halb = S / 2, wy = yC - 0.1;
  const fluegel = paare(
    flaeche("Tragfläche", [[0.02 * L, R * 0.8], [-0.2 * L, halb], [-0.29 * L, halb], [-0.36 * L, R * 0.8]], 0.18 * k, [0, wy, 0], f),
    flaeche("Strake (LEX)", [[0.22 * L, R * 0.5], [0.02 * L, R * 1.25], [0.02 * L, R * 0.7]], 0.15 * k, [0, wy + 0.1, 0], f),
    flaeche("Höhenleitwerk", [[-0.36 * L, R * 0.7], [-0.44 * L, 2.8 * k], [-0.5 * L, 2.8 * k], [-0.5 * L, R * 0.7]], 0.12 * k, [0, yC - 0.1, 0], f, [8, 0, 0]),
    box("Flügelspitze (Startschiene)", [-0.24 * L, wy, halb], [0.18 * L, 0.12, 0.12], "grau"),
  );
  fluegel.push(profil("Seitenleitwerk", [[-0.2 * L, yC + R * 0.8], [-0.37 * L, H], [-0.44 * L, H], [-0.42 * L, yC + R * 0.8]], 0.2 * k, f));
  const fahrwerk = [
    rohr("Bugfahrwerk", [[0.08 * L, yC - R, 0], [0.08 * L, 0.3 * k, 0]], 0.1 * k, "grau"),
    zyl("Bugrad", [0.08 * L, 0.28 * k, 0], 0.28 * k, 0.18 * k, "z", "schwarz"),
    ...paare(rohr("Hauptfahrwerk", [[-0.2 * L, yC - R * 0.8, 0.9 * k], [-0.2 * L, 0.36 * k, 1.2 * k]], 0.12 * k, "grau")),
    ...paare(zyl("Hauptrad", [-0.2 * L, 0.36 * k, 1.2 * k], 0.36 * k, 0.22 * k, "z", "schwarz")),
  ];
  const technik = [
    zyl("Triebwerk mit Nachbrenner", [-0.24 * L, yC, 0], R * 0.75, 0.35 * L, "x", "orange"),
    kugel("Radar", [vorne + 0.12 * L, yC, 0], 0.32 * k, "gelb"),
    box("Schleudersitz", [vorne + 0.03 * L, yC + R * 0.45, 0], [0.6 * k, 0.9 * k, 0.55 * k], "schwarz"),
    box("Rumpftank", [-0.04 * L, yC + 0.1, 0], [2.6 * k, 0.6 * k, 0.9 * k], "rot"),
    box("Avionik", [vorne + 0.1 * L, yC - 0.1, 0], [1.0 * k, 0.4 * k, 0.6 * k], "gruen"),
  ];
  return {
    titel: "Kampfjet", typ: "Kampfflugzeug · einstrahlig (Vorlage)", masse: { Länge: L, Spannweite: S, Höhe: H },
    schritte: [
      { status: "Rumpf", sagen: `Zuerst der schlanke Rumpf: ${sprich(L)} Meter lang, mit spitzer Nase, Glaskanzel und dem Lufteinlass unter dem Cockpit.`, teile: rumpf },
      { status: "Flügel & Leitwerk", sagen: `Jetzt die Flügel mit ${sprich(S)} Metern Spannweite, die Strakes vorne für enge Kurven und das Leitwerk.`, teile: fluegel },
      { status: "Fahrwerk", sagen: "Dann das kurze, robuste Fahrwerk.", teile: fahrwerk },
      { status: "Technik", sagen: "Zum Schluss die Technik: ein Strahltriebwerk mit Nachbrenner, Radar in der Nase und der Schleudersitz des Piloten.", teile: technik },
    ],
  };
}

// ---------- Helikopter ----------
function helikopter(o) {
  const L = o.laenge || 12.7, D = o.rotor || 10.7, H = o.hoehe || 3.6, f = o.farbe || "rot";
  const k = L / 12.7;
  const kab = [[4.4 * k, 1.1 * k], [4.6 * k, 1.8 * k], [3.6 * k, 2.6 * k], [1.4 * k, 2.85 * k], [-0.8 * k, 2.8 * k], [-1.6 * k, 2.3 * k], [-1.5 * k, 1.1 * k], [0.5 * k, 0.75 * k], [3.2 * k, 0.75 * k]];
  const form = [
    profil("Kabine", kab, 1.75 * k, f, { rundung: 0.12 }),
    kugel("Cockpitscheibe", [3.2 * k, 2.0 * k, 0], 0.95 * k, "glas", [1.4, 0.8, 0.85]),
    ...paare(box("Seitenfenster", [1.6 * k, 2.1 * k, 0.88 * k], [1.4 * k, 0.6 * k, 0.03], "glas")),
    zyl("Heckausleger", [-4.4 * k, 2.15 * k, 0], 0.32 * k, 5.6 * k, "x", f, 0.16 * k),
    profil("Seitenflosse", [[-6.6 * k, 2.1 * k], [-7.4 * k, 3.4 * k], [-7.8 * k, 3.4 * k], [-7.4 * k, 2.0 * k]], 0.12, f),
    ...paare(flaeche("Höhenleitwerk", [[-5.6 * k, 0.1], [-5.8 * k, 1.1 * k], [-6.3 * k, 1.1 * k], [-6.2 * k, 0.1]], 0.08, [0, 2.15 * k, 0], f)),
  ];
  const mast = [0.4 * k, 3.45 * k, 0];
  const rotor = [
    zyl("Rotormast", [mast[0], 3.15 * k, 0], 0.12 * k, 0.6 * k, "y", "grau"),
    zyl("Rotorkopf", mast, 0.32 * k, 0.22 * k, "y", "grau"),
    ...blaetter("Rotorblatt", mast, 4, D / 2, 0.32 * k, 0.05, "schwarz", "y", 45),
    zyl("Heckrotor-Nabe", [-7.5 * k, 2.6 * k, -0.18], 0.1, 0.18, "z", "grau"),
    ...blaetter("Heckrotorblatt", [-7.5 * k, 2.6 * k, -0.25], 2, 0.85 * k, 0.16, 0.04, "schwarz", "z", 30),
  ];
  const kufen = [
    ...paare(rohr("Kufe", [[3.4 * k, 0.12, 1.15 * k], [3.0 * k, 0.05, 1.15 * k], [-1.7 * k, 0.05, 1.15 * k]], 0.09, "grau")),
    rohr("Querrohr vorne", [[2.0 * k, 0.05, 1.15 * k], [2.0 * k, 0.8 * k, 0.6 * k], [2.0 * k, 0.8 * k, -0.6 * k], [2.0 * k, 0.05, -1.15 * k]], 0.08, "grau"),
    rohr("Querrohr hinten", [[-0.7 * k, 0.05, 1.15 * k], [-0.7 * k, 0.8 * k, 0.6 * k], [-0.7 * k, 0.8 * k, -0.6 * k], [-0.7 * k, 0.05, -1.15 * k]], 0.08, "grau"),
  ];
  const technik = [
    zyl("Turbine", [-0.6 * k, 3.0 * k, 0], 0.3 * k, 1.4 * k, "x", "orange"),
    box("Hauptgetriebe", [0.4 * k, 2.95 * k, 0], [0.7 * k, 0.4 * k, 0.6 * k], "orange"),
    rohr("Heckrotorwelle", [[-1.4 * k, 2.6 * k, 0], [-7.4 * k, 2.6 * k, 0]], 0.05, "orange"),
    box("Tank", [-0.6 * k, 1.2 * k, 0], [1.2 * k, 0.5 * k, 1.2 * k], "rot"),
    ...paare(box("Sitz", [2.6 * k, 1.35 * k, 0.4 * k], [0.5, 0.6, 0.5], "grau")),
    box("Instrumente", [3.6 * k, 1.65 * k, 0], [0.3, 0.3, 1.2 * k], "schwarz"),
  ];
  return {
    titel: "Helikopter", typ: "Hubschrauber · leichte Klasse", masse: { Länge: L, Rotordurchmesser: D, Höhe: H },
    schritte: [
      { status: "Kabine & Heck", sagen: "Zuerst die Kabine mit großer Glasfront, dahinter der lange Heckausleger mit Leitwerk.", teile: form },
      { status: "Rotoren", sagen: `Jetzt der Hauptrotor mit vier Blättern und ${sprich(D)} Metern Durchmesser. Der kleine Heckrotor verhindert, dass sich der Helikopter mitdreht.`, teile: rotor },
      { status: "Kufen", sagen: "Dann die Landekufen.", teile: kufen },
      { status: "Antrieb", sagen: "Zum Schluss der Antrieb: Turbine und Getriebe sitzen oben über der Kabine, eine lange Welle treibt den Heckrotor.", teile: technik },
    ],
  };
}

// ---------- Schiffe & Boote ----------
// Rumpf von oben: Heck eckig, Bug spitz.
function rumpfPunkte(L, B, bugAnteil = 0.18, heckRund = 0.04) {
  const x0 = L / 2, b = B / 2, xb = x0 - L * bugAnteil;
  return [[-x0, -b * 0.85], [-x0 + L * heckRund, -b], [xb, -b], [xb + L * bugAnteil * 0.55, -b * 0.75], [x0, 0], [xb + L * bugAnteil * 0.55, b * 0.75], [xb, b], [-x0 + L * heckRund, b], [-x0, b * 0.85]];
}

function containerschiff(o) {
  const L = o.laenge || 220, B = o.breite || 32, H = o.hoehe || 18, f = o.farbe || "blau";
  const x0 = L / 2;
  const pts = rumpfPunkte(L, B);
  const rumpf = [
    flaeche("Unterwasserschiff", pts.map(([x, z]) => [x * 0.985, z * 0.97]), H * 0.45, [0, H * 0.225, 0], "rot"),
    flaeche("Rumpf", pts, H * 0.55, [0, H * 0.45 + H * 0.275, 0], f),
    flaeche("Deck", pts.map(([x, z]) => [x * 0.99, z * 0.98]), 0.4, [0, H, 0], "grau"),
    kugel("Wulstbug", [x0 - 3, H * 0.22, 0], H * 0.17, "rot", [2.8, 1, 1]),
  ];
  const ax = -x0 + 0.12 * L;
  const aufbau = [
    box("Deckshaus", [ax, H + 10, 0], [14, 20, B * 0.6], "weiss"),
    box("Brücke", [ax + 2, H + 21, 0], [6, 3, B * 1.02], "weiss"),
    box("Brückenfenster", [ax + 5.05, H + 21, 0], [0.1, 1.4, B * 0.95], "glas"),
    box("Schornstein", [ax - 9, H + 9, 0], [7, 14, 6], "orange"),
    box("Schornsteinkappe", [ax - 9, H + 16.3, 0], [7.2, 0.8, 6.2], "schwarz"),
    zyl("Radarmast", [ax + 1, H + 26, 0], 0.4, 7, "y", "grau"),
  ];
  const farben = ["rot", "blau", "gruen", "orange", "grau", "gelb", "weiss", "lila"];
  const container = [];
  const start = ax + 12, ende = x0 - L * 0.16, bay = 13.5;
  for (let i = 0, x = start; x + bay / 2 < ende; i++, x += bay) {
    const lagen = 3 + ((i * 7) % 4);
    container.push(box(`Containerreihe ${i + 1}`, [x + bay / 2, H + (lagen * 2.6) / 2, 0], [bay - 0.8, lagen * 2.6, B * 0.86], farben[i % farben.length]));
  }
  const technik = [
    box("Hauptmotor (Zweitakt-Diesel)", [ax - 4, H * 0.4, 0], [18, H * 0.5, B * 0.35], "orange"),
    rohr("Propellerwelle", [[ax - 13, H * 0.28, 0], [-x0 - 1, H * 0.28, 0]], 0.9, "orange"),
    ...blaetter("Propellerblatt", [-x0 - 1.2, H * 0.28, 0], 5, 4, 1.4, 0.3, "chrom", "x"),
    box("Ruder", [-x0 - 4, H * 0.35, 0], [5, 9, 0.8], "rot"),
    box("Bunkertank", [ax + 30, H * 0.25, 0], [24, H * 0.3, B * 0.7], "gelb"),
    ...paare(box("Anker", [x0 - 10, H * 0.75, B * 0.42], [2.2, 2.2, 0.6], "chrom")),
  ];
  return {
    titel: "Containerschiff", typ: "Frachtschiff · Containerschiff", masse: { Länge: L, Breite: B, Seitenhöhe: H },
    schritte: [
      { status: "Rumpf", sagen: `Zuerst der Rumpf: ${Math.round(L)} Meter lang und ${Math.round(B)} Meter breit, unten rot, mit Wulstbug für weniger Wasserwiderstand.`, teile: rumpf },
      { status: "Brücke", sagen: "Jetzt das Deckshaus mit der Brücke und dem Schornstein, ganz hinten.", teile: aufbau },
      { status: "Container", sagen: "Dann die Container, gestapelt in Reihen über das ganze Deck.", teile: container },
      { status: "Antrieb", sagen: "Zum Schluss der Antrieb: ein riesiger Zweitakt-Diesel treibt über eine lange Welle den Propeller, dahinter sitzt das Ruder.", teile: technik },
    ],
  };
}

function kreuzfahrtschiff(o) {
  const L = o.laenge || 300, B = o.breite || 36, H = o.hoehe || 14, f = o.farbe || "weiss";
  const x0 = L / 2;
  const pts = rumpfPunkte(L, B, 0.16);
  const rumpf = [
    flaeche("Unterwasserschiff", pts.map(([x, z]) => [x * 0.985, z * 0.97]), H * 0.55, [0, H * 0.275, 0], "rot"),
    flaeche("Rumpf", pts, H * 0.45, [0, H * 0.55 + H * 0.225, 0], f),
    kugel("Wulstbug", [x0 - 3, H * 0.25, 0], H * 0.2, "rot", [2.8, 1, 1]),
  ];
  const decks = [];
  const nDeck = 12;
  for (let i = 0; i < nDeck; i++) {
    const s = 1 - i * 0.03, len = L * 0.82 * s, mx = -L * 0.05 - i * 0.6;
    decks.push(flaeche(`Deck ${i + 3}`, rumpfPunkte(len, B * (i < 9 ? 0.98 : 0.86), 0.12).map(([x, z]) => [x + mx, z]), 2.8, [0, H + 1.4 + i * 2.9, 0], f));
    if (i < 10) decks.push(...paare(box(`Balkonreihe Deck ${i + 3}`, [mx - len * 0.05, H + 1.6 + i * 2.9, B * (i < 9 ? 0.49 : 0.43)], [len * 0.72, 1.6, 0.05], "glas")));
  }
  const top = H + nDeck * 2.9;
  const oben = [
    box("Brücke", [L * 0.28, top - 6, 0], [6, 3, B * 1.04], "weiss"),
    box("Brückenfenster", [L * 0.28 + 3.05, top - 6, 0], [0.1, 1.4, B], "glas"),
    box("Pool", [0, top + 0.5, 0], [22, 0.8, 12], "blau"),
    box("Wasserrutsche", [-L * 0.12, top + 4, B * 0.25], [3, 8, 3], "gelb"),
    rohr("Rutschbahn", [[-L * 0.12, top + 8, B * 0.25], [-L * 0.18, top + 5, B * 0.3], [-L * 0.14, top + 2, -B * 0.1], [-L * 0.08, top + 0.5, 0]], 1.2, "gelb"),
    box("Schornstein", [-L * 0.3, top + 6, 0], [14, 12, 8], "blau"),
    box("Schornsteinkappe", [-L * 0.3, top + 12.4, 0], [14.4, 0.8, 8.4], "schwarz"),
  ];
  const boote = [];
  for (let i = 0; i < 8; i++) boote.push(...paare(kugel(`Rettungsboot ${i + 1}`, [L * 0.25 - i * 16, H + 9, B * 0.51], 1.6, "orange", [6, 1.1, 1.3])));
  const technik = [
    box("Dieselgeneratoren", [-L * 0.15, H * 0.4, 0], [40, H * 0.5, B * 0.6], "orange"),
    ...paare(zyl("Pod-Antrieb", [-x0 + 10, H * 0.15, B * 0.2], 2.2, 7, "x", "orange")),
    ...paare(...blaetter("Propellerblatt", [-x0 + 6, H * 0.15, B * 0.2], 4, 3, 1.2, 0.3, "chrom", "x")),
    box("Theater", [L * 0.12, H + 6, 0], [24, 8, B * 0.7], "lila"),
    box("Restaurant", [-L * 0.25, H + 4.5, 0], [30, 5, B * 0.7], "gelb"),
  ];
  return {
    titel: "Kreuzfahrtschiff", typ: "Passagierschiff · Kreuzfahrt", masse: { Länge: L, Breite: B },
    schritte: [
      { status: "Rumpf", sagen: `Zuerst der Rumpf: ${Math.round(L)} Meter lang, unten rot mit Wulstbug.`, teile: rumpf },
      { status: "Decks", sagen: "Jetzt die vielen Passagierdecks mit Balkonkabinen, eines über dem anderen.", teile: decks },
      { status: "Oberdeck", sagen: "Oben die Brücke, der Pool, eine Wasserrutsche und der Schornstein.", teile: oben },
      { status: "Rettungsboote", sagen: "Dann die orangen Rettungsboote auf beiden Seiten.", teile: boote },
      { status: "Antrieb & Innen", sagen: "Zum Schluss: Dieselgeneratoren erzeugen Strom für die Pod-Antriebe, und innen gibt es Theater und Restaurants.", teile: technik },
    ],
  };
}

function motorboot(o) {
  const L = o.laenge || 12, B = o.breite || 3.8, H = o.hoehe || 3.2, f = o.farbe || "weiss";
  const k = L / 12, x0 = L / 2;
  const pts = rumpfPunkte(L, B, 0.32, 0.02);
  const rumpf = [
    flaeche("Rumpf unten", pts.map(([x, z]) => [x * 0.97, z * 0.82]), 0.5 * k, [0, 0.25 * k, 0], "blau"),
    flaeche("Rumpf", pts, 1.1 * k, [0, 0.5 * k + 0.55 * k, 0], f),
    profil("Bugsprung", [[x0 - 0.2, 1.0 * k], [x0, 1.75 * k], [x0 - 3.2 * k, 1.6 * k], [x0 - 3.2 * k, 1.0 * k]], B * 0.35, f),
    flaeche("Deck (Teak)", pts.map(([x, z]) => [x * 0.97, z * 0.92]), 0.08, [0, 1.62 * k, 0], "braun"),
  ];
  const aufbau = [
    profil("Kajütaufbau", [[x0 - 2.8 * k, 1.6 * k], [x0 - 4.5 * k, 2.6 * k], [-0.5 * k, 2.7 * k], [-0.5 * k, 1.6 * k]], B * 0.75, f, { rundung: 0.1 }),
    box("Frontscheibe", [x0 - 3.7 * k, 2.15 * k, 0], [1.6 * k, 0.04, B * 0.7], "glas", [0, 0, 30]),
    ...paare(box("Seitenfenster", [x0 - 6 * k, 2.15 * k, B * 0.38], [2.6 * k, 0.4 * k, 0.03], "glas")),
    box("Hardtop", [-1.5 * k, H, 0], [3 * k, 0.12, B * 0.8], f),
    ...paare(rohr("Hardtop-Stütze", [[-2.8 * k, 1.65 * k, B * 0.38], [-2.8 * k, H, B * 0.38]], 0.07, "chrom")),
    box("Badeplattform", [-x0 - 0.4 * k, 0.6 * k, 0], [0.8 * k, 0.1, B * 0.9], "braun"),
    ...paare(rohr("Reling", [[x0 - 0.4, 1.95 * k, 0.15], [x0 - 3 * k, 1.95 * k, B * 0.42], [-x0 + 1, 1.95 * k, B * 0.45]], 0.04, "chrom")),
  ];
  const innen = [
    box("Steuerstand", [-0.8 * k, 2.0 * k, -B * 0.2], [0.6, 0.8, 0.8], "schwarz"),
    zyl("Steuerrad", [-0.5 * k, 2.45 * k, -B * 0.2], 0.22, 0.04, "x", "chrom", undefined, [0, 0, -30]),
    box("Sitzbank Heck", [-x0 + 1.3 * k, 1.9 * k, 0], [0.7 * k, 0.5, B * 0.8], "weiss"),
    box("Kabine (Koje)", [x0 - 3.2 * k, 1.1 * k, 0], [2.6 * k, 0.5, B * 0.55], "grau"),
  ];
  const technik = [
    ...paare(box("Motor", [-x0 + 2.8 * k, 0.9 * k, B * 0.22], [1.4 * k, 0.7 * k, 0.7 * k], "orange")),
    ...paare(rohr("Welle", [[-x0 + 2.0 * k, 0.6 * k, B * 0.22], [-x0 + 0.4 * k, 0.05, B * 0.22]], 0.06, "orange")),
    ...paare(...blaetter("Propellerblatt", [-x0 + 0.35 * k, 0.05, B * 0.22], 3, 0.32 * k, 0.15, 0.02, "chrom", "x")),
    box("Tank", [0, 0.75 * k, 0], [1.6 * k, 0.4 * k, B * 0.5], "rot"),
    box("Batterien", [-x0 + 4.2 * k, 0.8 * k, 0], [0.5, 0.3, 0.6], "gruen"),
  ];
  return {
    titel: "Motorboot", typ: "Motoryacht · Hardtop", masse: { Länge: L, Breite: B, Höhe: H },
    schritte: [
      { status: "Rumpf", sagen: `Zuerst der Rumpf: ${sprich(L)} Meter lang, vorne spitz für hohe Geschwindigkeit, mit Teakdeck.`, teile: rumpf },
      { status: "Aufbau", sagen: "Jetzt der Aufbau mit Frontscheibe, Hardtop, Reling und Badeplattform.", teile: aufbau },
      { status: "Innen", sagen: "Innen Steuerstand mit Steuerrad, Sitzbank und vorne eine Koje zum Schlafen.", teile: innen },
      { status: "Antrieb", sagen: "Zum Schluss zwei Motoren mit Wellen und Propellern.", teile: technik },
    ],
  };
}

function segelboot(o) {
  const L = o.laenge || 10, B = o.breite || 3.4, f = o.farbe || "weiss";
  const k = L / 10, x0 = L / 2, kiel = 1.8 * k, mastH = o.hoehe || 15 * k;
  const pts = rumpfPunkte(L, B, 0.38, 0.02);
  const deckY = kiel + 1.0 * k;
  const rumpf = [
    flaeche("Rumpf", pts, 1.0 * k, [0, kiel + 0.5 * k, 0], f),
    flaeche("Rumpf unten", pts.map(([x, z]) => [x * 0.9, z * 0.7]), 0.4 * k, [0, kiel + 0.05, 0], "blau"),
    profil("Kiel", [[0.8 * k, kiel + 0.1], [0.2 * k, 0.35], [-0.6 * k, 0.35], [-0.8 * k, kiel + 0.1]], 0.12, "schwarz"),
    zyl("Kielbombe", [-0.15 * k, 0.25, 0], 0.22, 1.6 * k, "x", "grau", 0.18),
    profil("Ruder", [[-x0 + 1.0 * k, kiel + 0.1], [-x0 + 0.9 * k, 0.8 * k], [-x0 + 0.5 * k, 0.9 * k], [-x0 + 0.5 * k, kiel + 0.1]], 0.08, "schwarz"),
    flaeche("Deck", pts.map(([x, z]) => [x * 0.97, z * 0.93]), 0.06, [0, deckY, 0], "braun"),
  ];
  const mx = 0.8 * k;
  const rigg = [
    zyl("Mast", [mx, deckY + mastH / 2, 0], 0.09, mastH, "y", "chrom"),
    zyl("Baum", [mx - 2.0 * k, deckY + 1.6 * k, 0], 0.07, 4.0 * k, "x", "chrom"),
    rohr("Vorstag", [[x0 - 0.2, deckY, 0], [mx, deckY + mastH * 0.92, 0]], 0.02, "grau"),
    rohr("Achterstag", [[-x0 + 0.2, deckY, 0], [mx, deckY + mastH, 0]], 0.02, "grau"),
    ...paare(rohr("Want", [[mx - 0.2, deckY, B * 0.45], [mx, deckY + mastH * 0.9, 0]], 0.02, "grau")),
  ];
  const segel = [
    profil("Großsegel", [[mx - 0.1, deckY + 1.7 * k], [mx - 0.1, deckY + mastH * 0.97], [mx - 0.8 * k, deckY + mastH * 0.6], [mx - 3.9 * k, deckY + 1.7 * k]], 0.03, "weiss", { rundung: 0 }),
    profil("Vorsegel (Genua)", [[x0 - 0.35, deckY + 0.5], [mx + 0.05, deckY + mastH * 0.88], [mx - 1.2 * k, deckY + 0.6]], 0.03, "weiss", { z: 0.15, rundung: 0 }),
  ];
  const aufbau = [
    profil("Kajütdach", [[mx + 0.4 * k, deckY], [mx + 0.1 * k, deckY + 0.55 * k], [-1.6 * k, deckY + 0.6 * k], [-1.6 * k, deckY]], B * 0.6, f, { rundung: 0.08 }),
    ...paare(box("Kajütfenster", [-0.4 * k, deckY + 0.35 * k, B * 0.3], [1.2 * k, 0.15, 0.03], "glas")),
    box("Cockpit", [-x0 + 1.8 * k, deckY - 0.2, 0], [2.2 * k, 0.45, B * 0.55], "grau"),
    zyl("Steuerrad", [-x0 + 1.2 * k, deckY + 0.55, 0], 0.45, 0.04, "x", "chrom"),
    ...paare(box("Winsch", [-x0 + 2.8 * k, deckY + 0.15, B * 0.38], [0.18, 0.2, 0.18], "chrom")),
    box("Innenraum (Salon)", [0.2 * k, kiel + 0.6 * k, 0], [3 * k, 0.6, B * 0.6], "lila"),
    box("Hilfsmotor", [-x0 + 2.5 * k, kiel + 0.4 * k, 0], [0.7, 0.5, 0.5], "orange"),
  ];
  return {
    titel: "Segelboot", typ: "Segelyacht · Slup-Takelung", masse: { Länge: L, Breite: B, Masthöhe: mastH },
    schritte: [
      { status: "Rumpf & Kiel", sagen: `Zuerst der Rumpf, ${sprich(L)} Meter lang, mit Kiel und schwerer Kielbombe. Sie hält das Boot aufrecht.`, teile: rumpf },
      { status: "Mast & Rigg", sagen: `Jetzt der Mast, ${sprich(mastH)} Meter hoch, mit Baum, Stagen und Wanten.`, teile: rigg },
      { status: "Segel", sagen: "Dann die Segel: hinten das Großsegel, vorne die Genua.", teile: segel },
      { status: "Kajüte & Cockpit", sagen: "Zum Schluss Kajüte, Cockpit mit Steuerrad, Winschen und ein kleiner Hilfsmotor.", teile: aufbau },
    ],
  };
}

function uboot(o) {
  const L = o.laenge || 70, D = o.breite || 8, f = o.farbe || "schwarz";
  const k = L / 70, R = D / 2, yC = R + 0.5;
  const rumpf = [
    zyl("Druckkörper", [-0.05 * L, yC, 0], R, 0.6 * L, "x", f),
    kugel("Bug", [0.25 * L, yC, 0], R, f, [2.2, 1, 1]),
    zyl("Heck", [-0.47 * L + 0.1 * L, yC, 0], R, 0.26 * L, "x", f, R * 0.15),
  ];
  const turm = [
    profil("Turm", [[0.14 * L, yC + R * 0.8], [0.12 * L, yC + R + 6 * k], [0.0 * L, yC + R + 6 * k], [-0.02 * L, yC + R * 0.8]], 1.8 * k, f, { rundung: 0.2 }),
    ...paare(flaeche("Turmruder", [[0.1 * L, 0], [0.09 * L, 3.5 * k], [0.06 * L, 3.5 * k], [0.06 * L, 0]], 0.2, [0, yC + R + 4 * k, 0.9 * k], f)),
    zyl("Periskop", [0.08 * L, yC + R + 7.5 * k, 0], 0.15, 3 * k, "y", "grau"),
    zyl("Antennenmast", [0.04 * L, yC + R + 7 * k, 0], 0.12, 2.2 * k, "y", "grau"),
  ];
  const heck = [
    ...paare(flaeche("Tiefenruder hinten", [[-0.36 * L, R * 0.4], [-0.39 * L, R + 3 * k], [-0.43 * L, R + 3 * k], [-0.42 * L, R * 0.4]], 0.3, [0, yC, 0], f)),
    profil("Seitenruder oben", [[-0.36 * L, yC + R * 0.4], [-0.39 * L, yC + R + 3 * k], [-0.43 * L, yC + R + 3 * k], [-0.42 * L, yC + R * 0.4]], 0.3, f),
    profil("Seitenruder unten", [[-0.36 * L, yC - R * 0.4], [-0.42 * L, yC - R * 0.4], [-0.43 * L, Math.max(0.1, yC - R - 2 * k)], [-0.39 * L, Math.max(0.1, yC - R - 2 * k)]], 0.3, f),
    ...blaetter("Propellerblatt", [-0.47 * L, yC, 0], 7, 1.6 * k, 0.6, 0.1, "chrom", "x"),
    kugel("Propellernabe", [-0.47 * L, yC, 0], 0.5 * k, "chrom"),
  ];
  const innen = [
    box("Zentrale", [0.08 * L, yC + 0.5, 0], [8 * k, 2.4, R * 1.2], "gelb"),
    box("Batterien", [0.1 * L, yC - R * 0.6, 0], [14 * k, 1.2, R * 1.3], "gruen"),
    box("Elektromotor", [-0.28 * L, yC, 0], [5 * k, R, R], "orange"),
    box("Wohnbereich", [-0.08 * L, yC + 0.3, 0], [10 * k, 2.2, R * 1.2], "lila"),
    ...paare(box("Tauchtank", [0.0, yC - R * 0.3, R * 0.8], [20 * k, R * 0.6, 0.6], "blau")),
  ];
  return {
    titel: "U-Boot", typ: "Unterseeboot (Vorlage)", masse: { Länge: L, Durchmesser: D },
    schritte: [
      { status: "Druckkörper", sagen: `Zuerst der zigarrenförmige Druckkörper: ${Math.round(L)} Meter lang. Er hält dem Wasserdruck in der Tiefe stand.`, teile: rumpf },
      { status: "Turm", sagen: "Jetzt der Turm mit Periskop, Antennen und den Turmrudern.", teile: turm },
      { status: "Ruder & Propeller", sagen: "Hinten das Ruderkreuz und der große, langsam drehende Propeller, damit es leise bleibt.", teile: heck },
      { status: "Innen", sagen: "Innen die Zentrale unter dem Turm, Batterien, Elektromotor, Wohnbereich und die Tauchtanks zum Ab- und Auftauchen.", teile: innen },
    ],
  };
}

// ---------- Rakete ----------
function rakete(o) {
  const H = o.hoehe || o.laenge || 70, D = o.breite || 3.7, f = o.farbe || "weiss";
  const k = H / 70, R = D / 2;
  const s1 = 0.62 * H, s2 = 0.2 * H, nose = 0.18 * H - 1;
  const form = [
    zyl("Erste Stufe", [0, 1 + s1 / 2, 0], R, s1, "y", f),
    box("Zwischenstufe", [0, 1 + s1 + 0.4, 0], [D * 0.98, 0.8, D * 0.98], "schwarz"),
    zyl("Zweite Stufe", [0, 1 + s1 + 0.8 + s2 / 2, 0], R, s2, "y", f),
    zyl("Nutzlastverkleidung", [0, 1 + s1 + 0.8 + s2 + nose / 2, 0], R * 1.2, nose, "y", f, R * 0.25),
    kugel("Spitze", [0, 1 + s1 + 0.8 + s2 + nose, 0], R * 0.27, f),
    zyl("Nutzlastsockel", [0, 1 + s1 + 0.8 + s2 - 0.2, 0], R * 1.2, 0.4, "y", f),
  ];
  const fuesse = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4, cx = Math.cos(a), cz = Math.sin(a);
    fuesse.push(rohr(`Landebein ${i + 1}`, [[cx * R, 7 * k, cz * R], [cx * (R + 4 * k), 0.15, cz * (R + 4 * k)]], 0.35 * k, "grau"));
    fuesse.push(box(`Gitterflosse ${i + 1}`, [cx * (R + 0.6), 1 + s1 - 2, cz * (R + 0.6)], [1.2, 1.4, 0.2], "grau", [0, -(a * 180) / Math.PI, 0]));
  }
  const triebwerke = [zyl("Mitteltriebwerk", [0, 1, 0], 0.55 * k, 2.2 * k, "y", "grau", 0.3 * k)];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    triebwerke.push(zyl(`Triebwerk ${i + 2}`, [Math.cos(a) * R * 0.62, 1, Math.sin(a) * R * 0.62], 0.42 * k, 2 * k, "y", "grau", 0.22 * k));
  }
  triebwerke.push(zyl("Triebwerk zweite Stufe", [0, 1 + s1 + 0.3, 0], 0.8 * k, 2.4 * k, "y", "grau", 0.35 * k));
  const tanks = [
    zyl("Sauerstofftank (LOX)", [0, 1 + s1 * 0.72, 0], R * 0.9, s1 * 0.5, "y", "blau"),
    zyl("Kerosintank (RP-1)", [0, 1 + s1 * 0.25, 0], R * 0.9, s1 * 0.38, "y", "orange"),
    zyl("Tank zweite Stufe", [0, 1 + s1 + 0.8 + s2 / 2, 0], R * 0.88, s2 * 0.8, "y", "orange"),
    zyl("Satellit (Nutzlast)", [0, 1 + s1 + 0.8 + s2 + nose * 0.3, 0], R * 0.8, nose * 0.4, "y", "gelb"),
  ];
  return {
    titel: "Rakete", typ: "Trägerrakete · zweistufig", masse: { Höhe: H, Durchmesser: D },
    schritte: [
      { status: "Stufen", sagen: `Zuerst die Stufen: zusammen ${Math.round(H)} Meter hoch, oben die Nutzlastverkleidung.`, teile: form },
      { status: "Triebwerke", sagen: "Jetzt die Triebwerke: neun an der ersten Stufe, eines an der zweiten.", teile: triebwerke },
      { status: "Landebeine & Flossen", sagen: "Dann Landebeine und Gitterflossen, damit die erste Stufe wieder landen kann.", teile: fuesse },
      { status: "Tanks & Nutzlast", sagen: "Zum Schluss das Innere: flüssiger Sauerstoff und Kerosin, und ganz oben der Satellit.", teile: tanks },
    ],
  };
}

// ---------- Erkennen ----------
const ARTEN = {
  sportwagen: { bau: (o) => auto("sportwagen", o), wort: "Sportwagen" },
  limousine: { bau: (o) => auto("limousine", o), wort: "Auto" },
  suv: { bau: (o) => auto("suv", o), wort: "SUV" },
  lkw: { bau: lkw, wort: "LKW" },
  bus: { bau: bus, wort: "Bus" },
  motorrad: { bau: motorrad, wort: "Motorrad" },
  zug: { bau: zug, wort: "Zug" },
  flugzeug: { bau: flugzeug, wort: "Flugzeug" },
  kampfjet: { bau: kampfjet, wort: "Kampfjet" },
  helikopter: { bau: helikopter, wort: "Helikopter" },
  containerschiff: { bau: containerschiff, wort: "Schiff" },
  kreuzfahrtschiff: { bau: kreuzfahrtschiff, wort: "Kreuzfahrtschiff" },
  motorboot: { bau: motorboot, wort: "Boot" },
  segelboot: { bau: segelboot, wort: "Segelboot" },
  uboot: { bau: uboot, wort: "U-Boot" },
  rakete: { bau: rakete, wort: "Rakete" },
};
export const VORLAGEN = Object.keys(ARTEN);

// Reihenfolge zählt: spezielle Wörter zuerst (Kampfjet vor Flugzeug, Kreuzfahrtschiff vor Schiff, Segelboot vor Boot).
const REGELN = [
  ["uboot", /\bu-?boot|unterseeboot|\bu ?boot/],
  ["rakete", /rakete|falcon ?9|saturn ?v|starship|ariane|space ?shuttle|trägerrakete|traegerrakete/],
  ["kampfjet", /kampfjet|kampfflugzeug|jagdflugzeug|kampfjäger|abfangjäger|eurofighter|typhoon|tornado|\bf-? ?(14|15|16|18|22|35)\b|mig-? ?\d|\bsu-? ?(27|30|35|57)\b|rafale|gripen|tarnkappe|stealth|militärjet|militaerjet|düsenjäger|duesenjaeger/],
  ["helikopter", /helikopter|hubschrauber|\bheli\b|black ?hawk|apache|chinook|airbus h\d|bell \d|eurocopter|rettungshubschrauber|christoph/],
  ["flugzeug", /flugzeug|flieger|airliner|jumbo|boeing|airbus|\ba ?3[2-8]\d\b|\b7[0-8]7\b|jet\b|privatjet|cessna|propellermaschine|passagiermaschine/],
  ["kreuzfahrtschiff", /kreuzfahrt|aida|titanic|queen mary|passagierschiff|cruise/],
  ["segelboot", /segel(boot|yacht|jacht|schiff)|katamaran|jolle|segler/],
  ["containerschiff", /containerschiff|frachter|frachtschiff|tanker|schiff|flugzeugträger|flugzeugtraeger|fähre|faehre|kutter|zerstörer|fregatte/],
  ["motorboot", /motorboot|speedboot|schnellboot|yacht|jacht|\bboot|schlauchboot|riva|jetski/],
  ["zug", /\bzug\b|\bice\b|\btgv\b|lokomotive|\blok\b|eisenbahn|straßenbahn|strassenbahn|s-bahn|u-bahn|shinkansen|transrapid|dampflok/],
  ["lkw", /\blkw\b|laster|truck|sattelzug|lastwagen|lastkraftwagen|actros|scania|\bman tgx|volvo fh|kipper|feuerwehrauto|müllauto|muellauto|bagger|traktor|trecker|unimog/],
  ["bus", /\bbus\b|reisebus|linienbus|schulbus|doppeldecker/],
  ["motorrad", /motorrad|bike\b|harley|ducati|kawasaki|yamaha r|motorroller|roller\b|vespa|chopper|\bkrad\b/],
  ["suv", /\bsuv\b|geländewagen|gelaendewagen|offroader|jeep|g-klasse|range rover|land rover|defender|cayenne|macan|\bx[3-7]\b|\bq[3-8]\b|touareg|tiguan|\bglc\b|\bgle\b|\bgls\b|pick-?up|model [xy]\b|urus|bentayga/],
  ["sportwagen", /sportwagen|supersportwagen|rennwagen|hypercar|lamborghini|ferrari|mclaren|bugatti|koenigsegg|pagani|porsche|\bgt3\b|\bamg gt\b|corvette|aston martin|lotus|\br8\b|\bm[2-8]\b|formel ?1|rennauto|lambo/],
  ["limousine", /\bauto\b|\bautos\b|\bwagen\b|limousine|kombi|kleinwagen|cabrio|coupé|coupe|pkw|audi|\bbmw\b|mercedes|\bvw\b|volkswagen|golf|passat|tesla|opel|ford|toyota|skoda|seat|cupra|hyundai|kia|renault|peugeot|fiat|volvo|mazda|honda|nissan|polo|\ba[3-8]\b|e-?auto|elektroauto/],
];

export function erkenneArt(text) {
  const t = String(text || "").toLowerCase();
  for (const [art, re] of REGELN) if (re.test(t)) return art;
  return null;
}

// Farbwörter nur als ganzes Wort (sonst steckt "gelb" in "Segelboot" und "rot" in "Rotor").
const W = (stamm) => new RegExp(`\\b(${stamm})(e|er|es|en|em)?\\b`);
const FARBWORTE = [
  [W("rot|feuerrot|knallrot|rosso|red"), "rot"], [W("gelb|giallo|yellow"), "gelb"], [W("orange|orangen|arancio"), "orange"], [W("grün|gruen|verde|green"), "gruen"],
  [W("blau|dunkelblau|hellblau|blue"), "blau"], [W("lila|violett|purple"), "lila"], [W("weiß|weiss|white|bianco"), "weiss"],
  [/\w*schwarz\w*|\bblack\b|\bnero\b/, "schwarz"], [/\bsilber\w*|\b(grau|grey|gray|grigio)(e|er|es|en|em)?\b/, "grau"], [W("chrom"), "chrom"], [W("braun"), "braun"],
];
export function erkenneFarbe(text) {
  const t = String(text || "").toLowerCase();
  for (const [re, f] of FARBWORTE) if (re.test(t)) return f;
  return null;
}

// "4,46 m", "4.459 mm", "4459 mm", "35,8 Meter" → Meter
function meter(wert) {
  const s = String(wert || "").toLowerCase().replace(/ /g, " ");
  const m = s.match(/(\d[\d.,]*)\s*(mm|cm|m\b|meter)/);
  if (!m) return null;
  let z = m[1];
  if (m[2] === "mm") z = z.replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".");
  else z = z.replace(",", ".");
  let v = parseFloat(z);
  if (!Number.isFinite(v)) return null;
  if (m[2] === "mm") v /= 1000;
  if (m[2] === "cm") v /= 100;
  return v;
}

// Echte Maße aus Claudes Kennzahlen lesen (Länge, Breite, Höhe, Radstand, Spannweite).
export function masseAusKennzahlen(kennzahlen) {
  const o = {};
  for (const k of Array.isArray(kennzahlen) ? kennzahlen : []) {
    const l = String(k?.label || "").toLowerCase(), v = meter(k?.wert);
    if (!v) continue;
    if (/spannweite/.test(l)) o.spannweite ??= v;
    else if (/rotor/.test(l)) o.rotor ??= v;
    else if (/radstand/.test(l)) o.radstand ??= v;
    else if (/länge|laenge/.test(l)) o.laenge ??= v;
    else if (/breite/.test(l)) o.breite ??= v;
    else if (/höhe|hoehe/.test(l) && !/flughöhe|gipfel|dienst/.test(l)) o.hoehe ??= v;
  }
  return o;
}

// Unplausible Maße verwerfen (z. B. Länge in falscher Einheit).
function plausibel(art, roh) {
  const basis = ARTEN[art].bau({});
  const ref = basis.masse || {};
  const o = {};
  const passt = (v, r) => Number.isFinite(v) && v > 0 && (!r || (v > r / 3 && v < r * 3));
  if (passt(roh.laenge, ref.Länge ?? ref.Höhe)) o.laenge = roh.laenge;
  if (passt(roh.breite, ref.Breite ?? ref.Spannweite ?? ref.Durchmesser)) o.breite = roh.breite;
  if (passt(roh.hoehe, ref.Höhe ?? ref.Masthöhe)) o.hoehe = roh.hoehe;
  if (passt(roh.radstand, ref.Radstand)) o.radstand = roh.radstand;
  if (passt(roh.spannweite, ref.Spannweite)) o.spannweite = roh.spannweite;
  if (passt(roh.rotor, ref.Rotordurchmesser)) o.rotor = roh.rotor;
  return o;
}

/**
 * Baut die Vorlage als fertigen Werkstatt-Bauplan.
 * @param {string} art  Schlüssel aus VORLAGEN
 * @param {object} opt  { farbe, laenge, breite, hoehe, radstand, spannweite, rotor, elektro, titel }
 */
export function baueVorlage(art, opt = {}) {
  if (!ARTEN[art]) return null;
  const o = { ...plausibel(art, opt), farbe: opt.farbe || undefined, elektro: Boolean(opt.elektro) };
  const v = ARTEN[art].bau(o);
  const teile = v.schritte.reduce((n, s) => n + s.teile.length, 0);
  const kennzahlen = Object.entries(v.masse).map(([label, wert]) => ({ label, wert: `${fmt(wert, wert < 20 ? 2 : 1)} m` }));
  kennzahlen.push({ label: "Bauteile", wert: String(teile) });
  const titel = opt.titel || v.titel;
  return {
    titel,
    einleitung: `Sehr gern, Chef. Ich baue ${artikel(ARTEN[art].wort)} ${titel === v.titel ? "" : `– ${titel} – `}aus meiner Vorlage.`.replace(/\s+/g, " "),
    steckbrief: { typ: v.typ, baujahr: "–", preis: "–", kurz: "Fridays Bau-Vorlage mit typischen Maßen, ohne Claude gebaut." },
    kennzahlen,
    schritte: v.schritte,
    fazit: `So, Chef. Fertig: ${teile} Bauteile. Tipp ein Teil an, dann siehst du, was es ist.`,
    vorlage: art,
  };
}

function artikel(wort) {
  const fem = /^(Limousine|Rakete)$/.test(wort);
  const mask = /^(Sportwagen|SUV|LKW|Bus|Zug|Kampfjet|Helikopter)$/.test(wort);
  return `${fem ? "eine" : mask ? "einen" : "ein"} ${wort}`;
}

// "bau mir einen Kampfjet" / "bau ein rotes Auto" – ohne Marke/Modell → sofort die Vorlage.
const FUELL = /\b(friday|hey|bitte|kannst|könntest|koenntest|du|mir|uns|mal|einen|eine|ein|einem|einer|neuen|neues|neue|großen|grosses|großes|kleinen|kleines|schönen|schönes|in|der|die|das|werkstatt|3d|hologramm|als|modell|von|bau|baue|bauen|entwirf|entwerfe|zeichne|konstruier|konstruiere|mach|erstell|erstelle|zeig|zeige|und|typisches|typischen|normales|normalen|beliebiges|beliebigen|irgendein|irgendeinen|irgendeine)\b/g;
const OBERBEGRIFFE = /^(auto|autos|wagen|pkw|limousine|kombi|sportwagen|supersportwagen|rennwagen|suv|geländewagen|gelaendewagen|lkw|laster|truck|sattelzug|lastwagen|bus|reisebus|linienbus|motorrad|zug|eisenbahn|lokomotive|flugzeug|flieger|verkehrsflugzeug|passagierflugzeug|jet|kampfjet|kampfflugzeug|jagdflugzeug|helikopter|hubschrauber|heli|schiff|containerschiff|frachter|frachtschiff|kreuzfahrtschiff|boot|motorboot|yacht|jacht|speedboot|segelboot|segelyacht|u-boot|uboot|unterseeboot|rakete|elektroauto|e-auto)$/;
export function istVorlagenBefehl(text) {
  const t = String(text || "").toLowerCase().replace(/[!?.,;:"„“]/g, " ").trim();
  if (t.length > 120) return null;
  if (!/^(hey |ok |okay )?(friday[ ,]+)?(bitte )?(kannst du( mir)? |könntest du( mir)? |koenntest du( mir)? )?(bau|baue|entwirf|entwerfe|zeichne|konstruier|konstruiere|erstell|erstelle)\b/.test(t)) return null;
  const art = erkenneArt(t);
  if (!art) return null;
  const farbe = erkenneFarbe(t);
  let rest = t.replace(FUELL, " ");
  for (const [re] of FARBWORTE) rest = rest.replace(new RegExp(re.source, "g"), " ");
  rest = rest.replace(/\s+/g, " ").trim();
  return OBERBEGRIFFE.test(rest) ? { art, farbe, elektro: /elektro|e-auto/.test(rest) } : null;
}
