// Mathe & Schule.
import { nr, zahl, text, de } from "./hilfe.js";

const G = "Mathe & Schule";
const zahlen = (s) => (String(s ?? "").match(/-?\d+(?:[.,]\d+)?/g) || []).map((x) => nr(x)).filter((x) => x != null);
const ggT = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

export default [
  {
    id: "dreisatz", titel: "Dreisatz", icon: "📐", gruppe: G,
    info: "Wenn A zu B gehört, was gehört dann zu C? (proportional oder umgekehrt)",
    felder: [{ k: "a", label: "A (z. B. 3 Äpfel)", typ: "zahl" }, { k: "b", label: "B (kosten 1,50 €)", typ: "zahl" }, { k: "c", label: "C (wie viel kosten 7 Äpfel?)", typ: "zahl" }, { k: "art", label: "Art", typ: "wahl", optionen: ["proportional (mehr → mehr)", "umgekehrt (mehr → weniger)"], standard: "proportional (mehr → mehr)" }],
    run(e) {
      const a = zahl(e, "a", "A"), b = zahl(e, "b", "B"), c = zahl(e, "c", "C");
      if (!a) throw new Error("A darf nicht 0 sein.");
      const um = String(e.art || "").startsWith("umgekehrt");
      if (um && !c) throw new Error("C darf beim umgekehrten Dreisatz nicht 0 sein.");
      const x = um ? (a * b) / c : (b / a) * c;
      return { text: `${um ? "Umgekehrter" : "Normaler"} Dreisatz: Zu ${de(c)} gehört ${de(x, 4)}.` };
    },
  },
  {
    id: "statistik", titel: "Durchschnitt & Statistik", icon: "📊", gruppe: G,
    info: "Mittelwert, Median, Minimum, Maximum und Streuung einer Zahlenreihe.",
    felder: [{ k: "zahlen", label: "Zahlen (mit Leerzeichen, Semikolon oder Zeilen getrennt)", typ: "textarea" }],
    sprache: [[/^(?:was ist (?:der )?|berechne (?:den )?|rechne (?:den )?)?(?:durchschnitt|mittelwert|schnitt) (?:von|aus) ([\d\s,.;und-]+)$/, (m) => ({ zahlen: m[1].replace(/ und /g, "; ").replace(/(\d), (?=\d)/g, "$1; ") })]],
    run(e) {
      const s = String(e.zahlen ?? "");
      const z = (/;|\n/.test(s) ? s.split(/[;\n]+/) : s.split(/\s+/)).map((x) => nr(x.trim())).filter((x) => x != null);
      if (!z.length) throw new Error("Bitte gib ein paar Zahlen ein.");
      const n = z.length, sum = z.reduce((a, b) => a + b, 0), mw = sum / n, so = [...z].sort((a, b) => a - b);
      const med = n % 2 ? so[(n - 1) / 2] : (so[n / 2 - 1] + so[n / 2]) / 2, sd = Math.sqrt(z.reduce((a, b) => a + (b - mw) ** 2, 0) / (n > 1 ? n - 1 : 1));
      return { text: `${n} Zahlen: Durchschnitt ${de(mw, 3)}, Median ${de(med, 3)}, kleinste ${de(so[0])}, größte ${de(so.at(-1))}.`, tabelle: { kopf: ["", "Wert"], zeilen: [["Anzahl", n], ["Summe", de(sum, 4)], ["Durchschnitt", de(mw, 4)], ["Median", de(med, 4)], ["Minimum", de(so[0], 4)], ["Maximum", de(so.at(-1), 4)], ["Spannweite", de(so.at(-1) - so[0], 4)], ["Standardabweichung", de(sd, 4)]] } };
    },
  },
  {
    id: "flaeche", titel: "Fläche & Umfang", icon: "⬛", gruppe: G,
    info: "Fläche, Umfang und Volumen von Kreis, Rechteck, Dreieck, Kugel, Zylinder.",
    felder: [{ k: "form", label: "Form", typ: "wahl", optionen: ["Kreis", "Rechteck", "Dreieck (rechtwinklig)", "Trapez", "Kugel", "Zylinder", "Quader"], standard: "Kreis" }, { k: "a", label: "a (bzw. Radius)", typ: "zahl" }, { k: "b", label: "b (bzw. Höhe)", typ: "zahl" }, { k: "c", label: "c (Trapez: Höhe, Quader: Tiefe)", typ: "zahl" }],
    sprache: [[/^(?:was ist die )?fläche (?:eines |von einem )?kreis(?:es)? (?:mit|bei) (?:einem )?(?:radius )?(\d+(?:,\d+)?)(?: ?(?:cm|m|mm))?(?: radius)?$/, (m) => ({ form: "Kreis", a: m[1] })]],
    run(e) {
      const f = e.form || "Kreis", a = zahl(e, "a", "a", { min: 0 }), b = nr(e.b), c = nr(e.c), PI = Math.PI;
      const brauche = (v, n) => { if (!(v > 0)) throw new Error(`Für ${f} brauche ich auch ${n}.`); return v; };
      if (f === "Kreis") return { text: `Kreis mit Radius ${de(a)}: Fläche ${de(PI * a * a, 3)}, Umfang ${de(2 * PI * a, 3)}, Durchmesser ${de(2 * a)}.` };
      if (f === "Rechteck") { brauche(b, "b"); return { text: `Rechteck ${de(a)} × ${de(b)}: Fläche ${de(a * b, 3)}, Umfang ${de(2 * (a + b), 3)}, Diagonale ${de(Math.hypot(a, b), 3)}.` }; }
      if (f.startsWith("Dreieck")) { brauche(b, "b"); const h = Math.hypot(a, b); return { text: `Rechtwinkliges Dreieck mit Katheten ${de(a)} und ${de(b)}: Hypotenuse ${de(h, 3)}, Fläche ${de((a * b) / 2, 3)}, Umfang ${de(a + b + h, 3)}.` }; }
      if (f === "Trapez") { brauche(b, "b"); brauche(c, "die Höhe c"); return { text: `Trapez: Fläche ${de(((a + b) / 2) * c, 3)}.` }; }
      if (f === "Kugel") return { text: `Kugel mit Radius ${de(a)}: Volumen ${de((4 / 3) * PI * a ** 3, 3)}, Oberfläche ${de(4 * PI * a * a, 3)}.` };
      if (f === "Zylinder") { brauche(b, "die Höhe b"); return { text: `Zylinder mit Radius ${de(a)} und Höhe ${de(b)}: Volumen ${de(PI * a * a * b, 3)}, Oberfläche ${de(2 * PI * a * (a + b), 3)}. In Litern (bei cm): ${de((PI * a * a * b) / 1000, 2)}.` }; }
      brauche(b, "b"); brauche(c, "c");
      return { text: `Quader ${de(a)} × ${de(b)} × ${de(c)}: Volumen ${de(a * b * c, 3)}, Oberfläche ${de(2 * (a * b + a * c + b * c), 3)}.` };
    },
  },
  {
    id: "primzahl", titel: "Primzahl & Teiler", icon: "🔣", gruppe: G,
    info: "Ist eine Zahl prim? Primfaktoren und alle Teiler.",
    felder: [{ k: "zahl", label: "Zahl", typ: "zahl" }],
    sprache: [[/^ist (\d+) (?:eine )?primzahl$|^primfaktoren (?:von )?(\d+)$/, (m) => ({ zahl: m[1] || m[2] })]],
    run(e) {
      const n = Math.round(zahl(e, "zahl", "eine Zahl", { min: 1, max: 1e15 }));
      let x = n; const f = [];
      for (let p = 2; p * p <= x; p += p === 2 ? 1 : 2) while (x % p === 0) { f.push(p); x /= p; }
      if (x > 1) f.push(x);
      const prim = n > 1 && f.length === 1;
      let teiler = "";
      if (n <= 1e7) { const t = []; for (let i = 1; i * i <= n; i++) if (n % i === 0) { t.push(i); if (i * i !== n) t.push(n / i); } t.sort((a, b) => a - b); teiler = ` Teiler (${t.length}): ${t.slice(0, 40).join(", ")}${t.length > 40 ? " …" : ""}.`; }
      return { text: n === 1 ? "1 ist keine Primzahl." : prim ? `Ja, ${n} ist eine Primzahl.` : `Nein, ${n} ist keine Primzahl: ${n} = ${f.join(" × ")}.${teiler}` };
    },
  },
  {
    id: "ggt_kgv", titel: "ggT & kgV", icon: "➗", gruppe: G,
    info: "Größter gemeinsamer Teiler und kleinstes gemeinsames Vielfaches.",
    felder: [{ k: "zahlen", label: "Zahlen", typ: "text", platzhalter: "12 18 30" }],
    sprache: [[/^(?:der |das |den )?(?:ggt|kgv|größte gemeinsame teiler|kleinste gemeinsame vielfache) (?:von )?(\d+)(?:,? und |, | )(\d+)(?:(?:,? und |, | )(\d+))?$/, (m) => ({ zahlen: [m[1], m[2], m[3]].filter(Boolean).join(" ") })]],
    run(e) {
      const z = zahlen(e.zahlen).map(Math.round).filter((x) => x > 0);
      if (z.length < 2) throw new Error("Bitte gib mindestens zwei ganze Zahlen ein.");
      const g = z.reduce(ggT), k = z.reduce((a, b) => (a / ggT(a, b)) * b);
      return { text: `Für ${z.join(", ")}: ggT ist ${g}, kgV ist ${de(k, 0)}.` };
    },
  },
  {
    id: "quadratisch", titel: "Gleichungen lösen", icon: "𝑥", gruppe: G,
    info: "Löst ax² + bx + c = 0 (oder linear, wenn a = 0).",
    felder: [{ k: "a", label: "a", typ: "zahl" }, { k: "b", label: "b", typ: "zahl" }, { k: "c", label: "c", typ: "zahl" }],
    run(e) {
      const a = nr(e.a) || 0, b = nr(e.b) || 0, c = nr(e.c) || 0;
      if (!a) { if (!b) return { text: c ? "Diese Gleichung hat keine Lösung." : "Jede Zahl ist eine Lösung." }; return { text: `Lineare Gleichung: x = ${de(-c / b, 6)}.` }; }
      const D = b * b - 4 * a * c;
      if (D < 0) { const re = -b / (2 * a), im = Math.sqrt(-D) / (2 * a); return { text: `Keine reelle Lösung (Diskriminante ${de(D, 4)}). Komplex: x = ${de(re, 4)} ± ${de(Math.abs(im), 4)}i.` }; }
      if (D === 0) return { text: `Genau eine Lösung: x = ${de(-b / (2 * a), 6)}.` };
      const x1 = (-b + Math.sqrt(D)) / (2 * a), x2 = (-b - Math.sqrt(D)) / (2 * a);
      return { text: `Zwei Lösungen: x₁ = ${de(x1, 6)} und x₂ = ${de(x2, 6)}. Scheitelpunkt bei (${de(-b / (2 * a), 4)} | ${de(c - (b * b) / (4 * a), 4)}).` };
    },
  },
  {
    id: "notenschluessel", titel: "Noten-Rechner", icon: "🎓", gruppe: G,
    info: "Note aus Punkten (IHK-Schlüssel) oder Notendurchschnitt.",
    felder: [{ k: "modus", label: "Was?", typ: "wahl", optionen: ["Note aus Punkten", "Notendurchschnitt"], standard: "Note aus Punkten" }, { k: "punkte", label: "Erreichte Punkte", typ: "zahl" }, { k: "max", label: "Maximale Punkte", typ: "zahl", standard: "100" }, { k: "noten", label: "Noten für den Durchschnitt (z. B. 2 1,7 3)", typ: "text" }],
    sprache: [[/^(?:welche note (?:sind|ist|bei|habe ich bei|hab ich bei|bekomme ich (?:bei|mit|für))|note (?:bei|für)) (\d+(?:,\d+)?) von (\d+(?:,\d+)?) punkten$/, (m) => ({ modus: "Note aus Punkten", punkte: m[1], max: m[2] })]],
    run(e) {
      if (e.modus === "Notendurchschnitt") {
        const n = zahlen(e.noten).filter((x) => x >= 1 && x <= 6);
        if (!n.length) throw new Error("Bitte gib Noten zwischen 1 und 6 ein.");
        return { text: `Der Durchschnitt aus ${n.length} Noten ist ${de(n.reduce((a, b) => a + b, 0) / n.length, 2)}.` };
      }
      const p = zahl(e, "punkte", "die Punkte", { min: 0 }), m = zahl(e, "max", "die Höchstpunktzahl", { min: 1 }), q = (p / m) * 100;
      const note = q >= 92 ? "1 (sehr gut)" : q >= 81 ? "2 (gut)" : q >= 67 ? "3 (befriedigend)" : q >= 50 ? "4 (ausreichend)" : q >= 30 ? "5 (mangelhaft)" : "6 (ungenügend)";
      return { text: `${de(p)} von ${de(m)} Punkten sind ${de(q, 1)} Prozent, das ist nach IHK-Schlüssel eine ${note}.`, hinweis: "Schulen verwenden oft eigene Notenschlüssel." };
    },
  },
];
