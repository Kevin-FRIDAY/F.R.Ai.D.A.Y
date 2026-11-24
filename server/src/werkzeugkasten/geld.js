// Geld & Rechnen: nur ausrechnen, nie Geld bewegen.
import { nr, zahl, text, de, eur, liste } from "./hilfe.js";

const G = "Geld & Rechnen";
const Z = "(-?\\d[\\d.]*(?:,\\d+)?)"; // Zahl im Sprachbefehl

export default [
  {
    id: "mwst", titel: "Mehrwertsteuer", icon: "🧾", gruppe: G,
    info: "Rechnet netto ↔ brutto mit 19 % oder 7 %.",
    felder: [
      { k: "betrag", label: "Betrag in €", typ: "zahl" },
      { k: "richtung", label: "Richtung", typ: "wahl", optionen: ["netto → brutto", "brutto → netto"], standard: "netto → brutto" },
      { k: "satz", label: "Steuersatz %", typ: "wahl", optionen: ["19", "7"], standard: "19" },
    ],
    sprache: [
      [new RegExp(`^(?:wie viel ist |was ist |rechne )?(?:die )?(?:mehrwertsteuer|mwst|umsatzsteuer) (?:von|auf|für|bei) ${Z}(?: euro)?$`), (m) => ({ betrag: m[1], richtung: "netto → brutto" })],
      [new RegExp(`^${Z}(?: euro)? netto (?:in|zu|auf) brutto$`), (m) => ({ betrag: m[1], richtung: "netto → brutto" })],
      [new RegExp(`^${Z}(?: euro)? (?:brutto )?(?:ohne|minus) (?:mehrwertsteuer|mwst)$|^${Z}(?: euro)? brutto (?:in|zu|auf) netto$`), (m) => ({ betrag: m[1] || m[2], richtung: "brutto → netto" })],
    ],
    run(e) {
      const b = zahl(e, "betrag", "den Betrag");
      const s = nr(e.satz) ?? 19;
      const zuBrutto = !String(e.richtung || "").startsWith("brutto");
      const netto = zuBrutto ? b : b / (1 + s / 100);
      const brutto = zuBrutto ? b * (1 + s / 100) : b;
      const steuer = brutto - netto;
      return {
        text: `Netto ${eur(netto)}, plus ${s} % Mehrwertsteuer (${eur(steuer)}) macht brutto ${eur(brutto)}.`,
        tabelle: { kopf: ["", "Betrag"], zeilen: [["Netto", eur(netto)], [`MwSt ${s} %`, eur(steuer)], ["Brutto", eur(brutto)]] },
      };
    },
  },
  {
    id: "prozent", titel: "Prozentrechner", icon: "％", gruppe: G,
    info: "X % von Y, Anteil in Prozent oder Veränderung von A nach B.",
    felder: [
      { k: "modus", label: "Was?", typ: "wahl", optionen: ["X % von Y", "X ist wie viel % von Y", "Veränderung von X auf Y"], standard: "X % von Y" },
      { k: "x", label: "X", typ: "zahl" },
      { k: "y", label: "Y", typ: "zahl" },
    ],
    sprache: [
      [new RegExp(`^(?:was sind |wie viel sind |wieviel sind |rechne )?${Z} ?(?:prozent|%) von ${Z}$`), (m) => ({ modus: "X % von Y", x: m[1], y: m[2] })],
      [new RegExp(`^wie ?viel prozent (?:sind|ist|macht) ${Z} von ${Z}$`), (m) => ({ modus: "X ist wie viel % von Y", x: m[1], y: m[2] })],
      [new RegExp(`^(?:prozentuale )?(?:veränderung|steigerung|unterschied) von ${Z} (?:auf|zu|nach) ${Z}(?: in prozent)?$`), (m) => ({ modus: "Veränderung von X auf Y", x: m[1], y: m[2] })],
    ],
    run(e) {
      const x = zahl(e, "x", "X"), y = zahl(e, "y", "Y");
      const mo = String(e.modus || "X % von Y");
      if (mo.startsWith("Veränderung")) {
        if (x === 0) throw new Error("Von 0 aus lässt sich keine Veränderung in Prozent berechnen.");
        const p = ((y - x) / Math.abs(x)) * 100;
        return { text: `Von ${de(x)} auf ${de(y)} ist eine ${p >= 0 ? "Steigerung" : "Senkung"} um ${de(Math.abs(p))} Prozent.` };
      }
      if (mo.includes("wie viel")) {
        if (y === 0) throw new Error("Y darf nicht 0 sein.");
        return { text: `${de(x)} sind ${de((x / y) * 100)} Prozent von ${de(y)}.` };
      }
      return { text: `${de(x)} Prozent von ${de(y)} sind ${de((x / 100) * y)}.` };
    },
  },
  {
    id: "rabatt", titel: "Rabatt-Rechner", icon: "🏷️", gruppe: G,
    info: "Preis nach Rabatt und wie viel du sparst.",
    felder: [{ k: "preis", label: "Preis in €", typ: "zahl" }, { k: "rabatt", label: "Rabatt in %", typ: "zahl" }, { k: "extra", label: "Extra-Rabatt in % (optional)", typ: "zahl" }],
    sprache: [[new RegExp(`^${Z}(?: euro)? (?:minus|mit|abzüglich|und) ${Z} ?(?:prozent|%)(?: rabatt)?$|^(?:(?:was sind|was ist|was kostet es mit|wie viel sind|wie viel ist|was macht|rechne) )?${Z} ?(?:prozent|%) rabatt (?:auf|bei|von) ${Z}(?: euro)?$`), (m) => (m[1] ? { preis: m[1], rabatt: m[2] } : { preis: m[4], rabatt: m[3] })]],
    run(e) {
      const p = zahl(e, "preis", "den Preis", { min: 0 }), r = zahl(e, "rabatt", "den Rabatt", { min: 0, max: 100 });
      const x = nr(e.extra) || 0;
      const neu = p * (1 - r / 100) * (1 - x / 100);
      return { text: `Statt ${eur(p)} zahlst du ${eur(neu)}. Du sparst ${eur(p - neu)}${x ? `, insgesamt ${de((1 - neu / p) * 100)} Prozent` : ""}.` };
    },
  },
  {
    id: "kredit", titel: "Kredit-Rate", icon: "🏦", gruppe: G,
    info: "Monatsrate, Zinsen gesamt und Tilgungsplan (Annuität).",
    felder: [{ k: "betrag", label: "Kreditbetrag €", typ: "zahl" }, { k: "zins", label: "Sollzins % pro Jahr", typ: "zahl" }, { k: "jahre", label: "Laufzeit in Jahren", typ: "zahl" }],
    sprache: [[new RegExp(`^(?:kreditrate|kredit|rate|monatsrate)(?: für| über| bei| von)? ${Z}(?: euro)? (?:mit|zu|bei) ${Z} ?(?:prozent|%)(?: zinsen)? (?:über|für|auf|in) ${Z} jahre?n?$`), (m) => ({ betrag: m[1], zins: m[2], jahre: m[3] })],
      [new RegExp(`^(?:kreditrate|kredit|rate|monatsrate)(?: für| über| bei| von)? ${Z}(?: euro)?,? (?:mit |zu |bei )?${Z} ?(?:prozent|%)(?: zinsen)?,? (?:über |für |auf |in )?${Z} (jahre?n?|monate?n?)$`), (m) => ({ betrag: m[1], zins: m[2], jahre: /^m/.test(m[4]) ? Math.round((nr(m[3]) / 12) * 100) / 100 : m[3] })]],
    run(e) {
      const P = zahl(e, "betrag", "den Kreditbetrag", { min: 1 }), z = zahl(e, "zins", "den Zins", { min: 0, max: 50 }), J = zahl(e, "jahre", "die Laufzeit", { min: 0.1, max: 50 });
      const n = Math.round(J * 12), r = z / 100 / 12;
      const rate = r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));
      let rest = P; const zeilen = [];
      for (let j = 1; j <= Math.ceil(n / 12); j++) {
        let zj = 0, tj = 0;
        for (let k = 0; k < 12 && rest > 0.005; k++) { const zi = rest * r; const t = Math.min(rate - zi, rest); zj += zi; tj += t; rest -= t; }
        zeilen.push([`Jahr ${j}`, eur(zj), eur(tj), eur(Math.max(rest, 0))]);
      }
      const gesamt = rate * n;
      return {
        text: `Die Monatsrate liegt bei ${eur(rate)}. Über ${de(J)} Jahre zahlst du ${eur(gesamt)}, davon ${eur(gesamt - P)} Zinsen.`,
        tabelle: { kopf: ["", "Zinsen", "Tilgung", "Restschuld"], zeilen },
        hinweis: "Grobe Rechnung ohne Gebühren. Das echte Angebot der Bank zählt.",
      };
    },
  },
  {
    id: "zinseszins", titel: "Sparplan & Zinseszins", icon: "📈", gruppe: G,
    info: "Wie viel aus Startbetrag + monatlicher Rate mit Zinsen wird.",
    felder: [{ k: "start", label: "Startbetrag €", typ: "zahl", standard: "0" }, { k: "rate", label: "Monatliche Rate €", typ: "zahl", standard: "0" }, { k: "zins", label: "Zins/Rendite % pro Jahr", typ: "zahl" }, { k: "jahre", label: "Jahre", typ: "zahl" }],
    sprache: [
      [new RegExp(`^${Z}(?: euro)? (?:mit|zu|bei) ${Z} ?(?:prozent|%)(?: zinsen| rendite)? (?:für|über|nach|in) ${Z} jahre?n?$`), (m) => ({ start: m[1], rate: 0, zins: m[2], jahre: m[3] })],
      [new RegExp(`^(?:sparplan|sparrate)(?: mit| von)? ${Z}(?: euro)?(?: im monat| monatlich| pro monat)? (?:mit|zu|bei) ${Z} ?(?:prozent|%)(?: zinsen| rendite)? (?:für|über|nach|in) ${Z} jahre?n?$`), (m) => ({ start: 0, rate: m[1], zins: m[2], jahre: m[3] })],
    ],
    run(e) {
      const S = nr(e.start) || 0, R = nr(e.rate) || 0, z = zahl(e, "zins", "den Zins", { min: -20, max: 50 }), J = zahl(e, "jahre", "die Jahre", { min: 1, max: 80 });
      if (!S && !R) throw new Error("Bitte gib einen Startbetrag oder eine monatliche Rate an.");
      const r = z / 100 / 12; let w = S; const zeilen = [];
      for (let j = 1; j <= J; j++) { for (let k = 0; k < 12; k++) w = w * (1 + r) + R; if (j <= 5 || j % 5 === 0 || j === J) zeilen.push([`Jahr ${j}`, eur(S + R * 12 * j), eur(w)]); }
      const ein = S + R * 12 * J;
      return {
        text: `Nach ${de(J)} Jahren hast du etwa ${eur(w)}. Eingezahlt sind ${eur(ein)}, der Rest von ${eur(w - ein)} sind Zinsen.`,
        tabelle: { kopf: ["", "Eingezahlt", "Wert"], zeilen }, hinweis: "Ohne Steuern, Kosten und Inflation. Renditen sind nicht garantiert.",
      };
    },
  },
  {
    id: "sparziel", titel: "Sparziel", icon: "🎯", gruppe: G,
    info: "Wie lange bis zum Ziel – oder welche Rate du brauchst.",
    felder: [{ k: "ziel", label: "Sparziel €", typ: "zahl" }, { k: "rate", label: "Monatliche Rate € (leer = ausrechnen)", typ: "zahl" }, { k: "monate", label: "…oder Zeit in Monaten", typ: "zahl" }, { k: "start", label: "Schon gespart €", typ: "zahl", standard: "0" }],
    sprache: [[new RegExp(`^wie lange (?:brauche ich|dauert es|spare ich),? (?:um |bis )?${Z}(?: euro)? (?:zu sparen|gespart sind)?,? ?(?:mit|bei|wenn ich) ${Z}(?: euro)?(?: im monat| monatlich| pro monat)?(?: spare)?$`), (m) => ({ ziel: m[1], rate: m[2] })]],
    run(e) {
      const ziel = zahl(e, "ziel", "das Sparziel", { min: 1 }), start = nr(e.start) || 0, fehlt = Math.max(ziel - start, 0);
      const rate = nr(e.rate), monate = nr(e.monate);
      if (!fehlt) return { text: "Du hast dein Ziel schon erreicht. Glückwunsch!" };
      if (rate > 0) {
        const n = Math.ceil(fehlt / rate);
        return { text: `Mit ${eur(rate)} im Monat brauchst du ${n} Monate${n >= 12 ? `, also etwa ${de(n / 12, 1)} Jahre` : ""}.` };
      }
      if (monate > 0) return { text: `Für ${eur(ziel)} in ${de(monate, 0)} Monaten musst du ${eur(fehlt / monate)} im Monat zurücklegen.` };
      throw new Error("Gib eine monatliche Rate oder die Zeit in Monaten an.");
    },
  },
  {
    id: "stundenlohn", titel: "Stundenlohn ↔ Monatsgehalt", icon: "⏱️", gruppe: G,
    info: "Rechnet Monatsgehalt in Stundenlohn um (und zurück).",
    felder: [{ k: "monat", label: "Monatsgehalt € (oder leer)", typ: "zahl" }, { k: "stunde", label: "Stundenlohn € (oder leer)", typ: "zahl" }, { k: "wochenstunden", label: "Stunden pro Woche", typ: "zahl", standard: "40" }],
    sprache: [
      [new RegExp(`^(?:wie (?:hoch|viel) ist (?:mein |der )?)?stundenlohn (?:bei|von|für) ${Z}(?: euro)?(?: im monat| monatlich| brutto| netto)*(?: und ${Z} stunden(?: pro woche| die woche)?)?$`), (m) => ({ monat: m[1], wochenstunden: m[2] })],
      [new RegExp(`^${Z}(?: euro)? (?:die |pro |in der )?stunde (?:sind|ist|macht) wie ?viel (?:im monat|monatlich)$`), (m) => ({ stunde: m[1] })],
    ],
    run(e) {
      const w = nr(e.wochenstunden) || 40, f = (w * 52) / 12;
      const mo = nr(e.monat), st = nr(e.stunde);
      if (mo > 0) return { text: `${eur(mo)} im Monat bei ${de(w)} Stunden pro Woche sind etwa ${eur(mo / f)} pro Stunde.` };
      if (st > 0) return { text: `${eur(st)} pro Stunde bei ${de(w)} Stunden pro Woche sind etwa ${eur(st * f)} im Monat, ${eur(st * w * 52)} im Jahr.` };
      throw new Error("Gib ein Monatsgehalt oder einen Stundenlohn an.");
    },
  },
  {
    id: "rechnung_teilen", titel: "Rechnung teilen", icon: "🍕", gruppe: G,
    info: "Teilt eine Rechnung auf Personen auf, mit Trinkgeld.",
    felder: [{ k: "betrag", label: "Rechnung €", typ: "zahl" }, { k: "personen", label: "Personen", typ: "zahl", standard: "2" }, { k: "trinkgeld", label: "Trinkgeld %", typ: "zahl", standard: "10" }],
    sprache: [[new RegExp(`^(?:teile|teil|teile die rechnung von|teil die rechnung von|rechnung von|rechnung über) ${Z}(?: euro)? (?:durch|auf|unter) ${Z}(?: personen| leute| freunde)?(?: (?:mit|plus) ${Z} ?(?:prozent|%)(?: trinkgeld)?)?$`), (m) => ({ betrag: m[1], personen: m[2], trinkgeld: m[3] ?? 0 })]],
    run(e) {
      const b = zahl(e, "betrag", "den Betrag", { min: 0 }), p = Math.round(zahl(e, "personen", "die Personenzahl", { min: 1, max: 500 })), t = nr(e.trinkgeld) || 0;
      const ges = b * (1 + t / 100), pro = ges / p, rund = Math.ceil(pro * 2) / 2;
      return { text: `${t ? `Mit ${de(t)} Prozent Trinkgeld sind es` : "Ohne Trinkgeld sind es"} ${eur(ges)}, also ${eur(pro)} pro Person. Aufgerundet ${eur(rund)}.` };
    },
  },
  {
    id: "grundpreis", titel: "Angebote vergleichen", icon: "⚖️", gruppe: G,
    info: "Preis pro kg/Liter/Stück: Welches Angebot ist wirklich günstiger?",
    felder: [
      { k: "preis1", label: "Preis A €", typ: "zahl" }, { k: "menge1", label: "Menge A", typ: "zahl" },
      { k: "preis2", label: "Preis B €", typ: "zahl" }, { k: "menge2", label: "Menge B", typ: "zahl" },
      { k: "preis3", label: "Preis C € (optional)", typ: "zahl" }, { k: "menge3", label: "Menge C", typ: "zahl" },
      { k: "einheit", label: "Einheit", typ: "wahl", optionen: ["g", "kg", "ml", "l", "Stück"], standard: "g" },
    ],
    run(e) {
      const ein = e.einheit || "g", basis = ein === "g" ? ["kg", 1000] : ein === "ml" ? ["Liter", 1000] : ein === "kg" ? ["kg", 1] : ein === "l" ? ["Liter", 1] : ["Stück", 1];
      const ang = [1, 2, 3].map((i) => ({ n: "ABC"[i - 1], p: nr(e[`preis${i}`]), m: nr(e[`menge${i}`]) })).filter((a) => a.p > 0 && a.m > 0);
      if (ang.length < 2) throw new Error("Bitte gib mindestens zwei Angebote mit Preis und Menge an.");
      ang.forEach((a) => (a.gp = (a.p / a.m) * basis[1]));
      ang.sort((a, b) => a.gp - b.gp);
      const [best, zweit] = ang;
      return {
        text: `Angebot ${best.n} ist am günstigsten mit ${eur(best.gp)} pro ${basis[0]}, ${de((1 - best.gp / zweit.gp) * 100, 0)} Prozent billiger als ${zweit.n}.`,
        tabelle: { kopf: ["Angebot", "Preis", "Menge", `pro ${basis[0]}`], zeilen: ang.map((a) => [a.n, eur(a.p), `${de(a.m)} ${ein}`, eur(a.gp)]) },
      };
    },
  },
  {
    id: "abo_kosten", titel: "Abo-Kosten", icon: "🔁", gruppe: G,
    info: "Alle Abos zusammenrechnen: pro Monat und pro Jahr.",
    felder: [{ k: "abos", label: "Ein Abo pro Zeile, z. B. „Netflix 13,99“ oder „Amazon 89,90 jährlich“", typ: "textarea", platzhalter: "Netflix 13,99\nSpotify 11,99\nAmazon Prime 89,90 jährlich\nFitnessstudio 29,90" }],
    run(e) {
      const zeilen = String(text(e, "abos", "deine Abos")).split("\n").map((z) => z.trim()).filter(Boolean);
      const abos = zeilen.map((z) => {
        const m = z.match(/(\d[\d.]*(?:,\d+)?|\d+\.\d+)\s*(?:€|eur|euro)?\s*(.*)$/i);
        if (!m) return null;
        const betrag = nr(m[1]), rest = (m[2] || "") + " " + z;
        const jahr = /jähr|jaehr|jahr|p\.a|\/a\b/i.test(rest), woche = /woche|wöchentl/i.test(rest), quartal = /quartal/i.test(rest);
        const monat = jahr ? betrag / 12 : woche ? (betrag * 52) / 12 : quartal ? betrag / 3 : betrag;
        return { name: z.slice(0, z.indexOf(m[1])).trim() || "Abo", monat };
      }).filter((a) => a && a.monat > 0);
      if (!abos.length) throw new Error("Ich habe keine Beträge gefunden. Schreib z. B. „Netflix 13,99“.");
      const sum = abos.reduce((s, a) => s + a.monat, 0);
      abos.sort((a, b) => b.monat - a.monat);
      return {
        text: `Deine ${abos.length} Abos kosten zusammen ${eur(sum)} im Monat, das sind ${eur(sum * 12)} im Jahr. Am teuersten: ${abos[0].name}.`,
        tabelle: { kopf: ["Abo", "pro Monat", "pro Jahr"], zeilen: [...abos.map((a) => [a.name, eur(a.monat), eur(a.monat * 12)]), ["Summe", eur(sum), eur(sum * 12)]] },
      };
    },
  },
  {
    id: "budget", titel: "50/30/20-Budget", icon: "🥧", gruppe: G,
    info: "Teilt dein Nettoeinkommen in Fixkosten, Wünsche und Sparen.",
    felder: [{ k: "netto", label: "Netto-Einkommen pro Monat €", typ: "zahl" }],
    sprache: [[new RegExp(`^(?:50 30 20|50/30/20|budget)(?: regel)?(?: plan)? (?:bei|für|mit|von) ${Z}(?: euro)?(?: netto)?$`), (m) => ({ netto: m[1] })]],
    run(e) {
      const n = zahl(e, "netto", "dein Netto-Einkommen", { min: 1 });
      return {
        text: `Bei ${eur(n)} netto: ${eur(n * 0.5)} für Fixkosten, ${eur(n * 0.3)} für Wünsche und ${eur(n * 0.2)} zum Sparen.`,
        tabelle: { kopf: ["Topf", "Anteil", "Betrag"], zeilen: [["Fixkosten (Miete, Strom, Versicherung)", "50 %", eur(n * 0.5)], ["Wünsche (Freizeit, Essen gehen)", "30 %", eur(n * 0.3)], ["Sparen & Schulden tilgen", "20 %", eur(n * 0.2)]] },
      };
    },
  },
];
