// Spaß & Familie.
import crypto from "node:crypto";
import { nr, zahl, text, de, liste, pflichtDatum } from "./hilfe.js";

const G = "Spaß & Familie";
const zufall = (n) => crypto.randomInt(n);
const mischen = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = zufall(i + 1); [x[i], x[j]] = [x[j], x[i]]; } return x; };

const STERN = [["Steinbock", 1, 19], ["Wassermann", 2, 18], ["Fische", 3, 20], ["Widder", 4, 19], ["Stier", 5, 20], ["Zwillinge", 6, 20], ["Krebs", 7, 22], ["Löwe", 8, 22], ["Jungfrau", 9, 22], ["Waage", 10, 22], ["Skorpion", 11, 21], ["Schütze", 12, 21], ["Steinbock", 12, 31]];
const CHIN = ["Ratte", "Büffel", "Tiger", "Hase", "Drache", "Schlange", "Pferd", "Ziege", "Affe", "Hahn", "Hund", "Schwein"];

// Geschenke: [Idee, ungefährer Preis €, Für (Kürzel), Interessen]
const GESCHENKE = [
  ["Gemeinsamer Kochkurs", 80, "pfx", "kochen"], ["Gutes Messer (Santoku)", 60, "pmvfx", "kochen"], ["Gewürz-Set aus aller Welt", 30, "pmvfx", "kochen"], ["Kochbuch eines Lieblingskochs", 25, "pmvfkx", "kochen"],
  ["Smartwatch oder Fitness-Tracker", 120, "pvftx", "sport technik"], ["Bluetooth-Kopfhörer", 70, "pvftx", "technik musik"], ["Powerbank mit MagSafe", 35, "pmvftx", "technik"], ["Smarte Lampe (Hue-Starter)", 60, "pvfx", "technik"],
  ["Kindle / E-Reader", 110, "pmvf", "lesen"], ["Buch-Abo oder Gutschein für die Buchhandlung", 30, "pmvfktx", "lesen"], ["Leselampe zum Anklemmen", 20, "pmvfkt", "lesen"],
  ["Massagegutschein / Wellnesstag", 90, "pmf", "wellness"], ["Kuschelige Decke + Tee-Set", 40, "pmf", "wellness"], ["Duftkerzen-Set", 25, "pmfx", "wellness"],
  ["Wochenendtrip (Städtetrip)", 250, "p", "reisen"], ["Reise-Organizer-Set", 30, "pmvfx", "reisen"], ["Rubbel-Weltkarte", 25, "pvft", "reisen"],
  ["Brettspiel des Jahres", 35, "pfkt", "spiele"], ["Escape-Room-Gutschein", 90, "pft", "spiele"], ["LEGO-Set", 60, "pvfk", "spiele technik"], ["Puzzle 1000 Teile", 20, "pmvf", "spiele"],
  ["Hochbeet oder Kräutergarten-Set", 50, "pmv", "garten"], ["Gutes Gartenwerkzeug", 40, "mv", "garten"], ["Insektenhotel", 25, "mvk", "garten natur"],
  ["Konzert- oder Theaterkarten", 120, "pmvf", "musik erlebnis"], ["Fotobuch mit gemeinsamen Erinnerungen", 40, "pmv", "erinnerung"], ["Personalisierte Tasse oder Kissen", 20, "mvkx", "erinnerung"],
  ["Laufschuhe-Gutschein", 100, "pft", "sport"], ["Yogamatte + Kurs", 50, "pmf", "sport wellness"], ["Fahrradzubehör (Licht, Schloss)", 40, "pvft", "sport"],
  ["Experimentierkasten", 35, "k", "technik lernen"], ["Malset / Kreativbox", 25, "kt", "kreativ"], ["Kinder-Kamera", 50, "k", "technik kreativ"], ["Tonie-Figur", 17, "k", "musik"],
  ["Sofortbildkamera", 80, "tpf", "kreativ technik"], ["Gaming-Guthaben", 25, "tk", "spiele"], ["LED-Streifen fürs Zimmer", 25, "t", "technik"],
  ["Gute Pralinen", 20, "pmvfx", "genuss"], ["Weinprobe oder Whisky-Tasting", 70, "pvf", "genuss"], ["Kaffee-Abo", 35, "pmvfx", "genuss kochen"],
];
const FUER = { "Partner/in": "p", Mutter: "m", Vater: "v", "Freund/in": "f", Kind: "k", Teenager: "t", "Kollege/Kollegin": "x" };

export default [
  {
    id: "wichteln", grossKlein: true, titel: "Wichtel-Auslosung", icon: "🎁", gruppe: G, geheim: true,
    info: "Lost Wichtel-Partner aus – niemand zieht sich selbst, Paare können ausgeschlossen werden. Jeder deckt nur seinen eigenen Namen auf.",
    felder: [{ k: "namen", label: "Namen (einer pro Zeile)", typ: "textarea" }, { k: "nicht", label: "Nicht zusammen (z. B. „Kevin-Carla“, einer pro Zeile)", typ: "textarea" }, { k: "budget", label: "Budget € (optional)", typ: "zahl" }],
    sprache: [[/^(?:los(?:e)?|mach|mache|starte?)? ?(?:die |eine )?wichtel(?:n|-auslosung| auslosung|-ziehung| ziehung)?(?: aus)?(?: mit| für)? (.{3,300})$/, (m) => ({ namen: m[1].replace(/ und /g, ", ") })]],
    run(e) {
      const n = [...new Set(liste(e.namen))];
      if (n.length < 3) throw new Error("Zum Wichteln braucht es mindestens 3 Namen.");
      const verbot = new Set(String(e.nicht || "").split("\n").flatMap((z) => { const [a, b] = z.split(/\s*[-–]\s*/).map((x) => x?.trim().toLowerCase()); return a && b ? [`${a}>${b}`, `${b}>${a}`] : []; }));
      for (let v = 0; v < 2000; v++) {
        const z = mischen(n);
        if (n.every((x, i) => x !== z[i] && !verbot.has(`${x.toLowerCase()}>${z[i].toLowerCase()}`))) {
          const budget = nr(e.budget);
          return { text: `Die Wichtel-Auslosung für ${n.length} Personen ist fertig. Jeder tippt im Fenster auf seinen Namen und sieht nur sein eigenes Ergebnis.${budget ? ` Budget: ${de(budget, 0)} Euro.` : ""}`, wichtel: n.map((x, i) => [x, z[i]]), zeigen: true, geheimesErgebnis: true };
        }
      }
      throw new Error("Mit diesen Ausschlüssen geht die Auslosung nicht auf. Bitte weniger Paare ausschließen.");
    },
  },
  {
    id: "teams", grossKlein: true, titel: "Teams bilden", icon: "👥", gruppe: G,
    info: "Teilt Namen zufällig und gleichmäßig in Teams auf.",
    felder: [{ k: "namen", label: "Namen (einer pro Zeile oder mit Komma)", typ: "textarea" }, { k: "anzahl", label: "Anzahl Teams", typ: "zahl", standard: "2" }],
    sprache: [[/^(?:teile|mach|bilde|mische) (.{3,300}?) (?:in|auf) (\d+|zwei|drei|vier|fünf) (?:teams|gruppen|mannschaften)$/, (m) => ({ namen: m[1].replace(/ und /g, ", "), anzahl: { zwei: 2, drei: 3, vier: 4, fünf: 5 }[m[2]] || m[2] })]],
    run(e) {
      const n = mischen(liste(e.namen)), k = Math.round(zahl(e, "anzahl", "die Anzahl Teams", { min: 2, max: 50 }));
      if (n.length < k) throw new Error("Es gibt weniger Namen als Teams.");
      const t = Array.from({ length: k }, () => []);
      n.forEach((x, i) => t[i % k].push(x));
      return { text: t.map((x, i) => `Team ${i + 1}: ${x.join(", ")}`).join(". ") + ".", zeilen: t.map((x, i) => `Team ${i + 1}: ${x.join(", ")}`) };
    },
  },
  {
    id: "zufall_liste", grossKlein: true, titel: "Zufalls-Auswahl", icon: "🎡", gruppe: G,
    info: "Wählt zufällig aus einer Liste – z. B. wer abwäscht oder welcher Film läuft.",
    felder: [{ k: "liste", label: "Auswahl (eine pro Zeile oder mit Komma)", typ: "textarea" }, { k: "anzahl", label: "Wie viele ziehen?", typ: "zahl", standard: "1" }],
    sprache: [[/^(?:wähle|wähl|such|zieh|ziehe|bestimme|nimm)(?: mir)? (?:zufällig |per zufall )?(?:eine[ns]? |jemanden )?(?:aus|von|zwischen|unter) (.{3,300})$/, (m) => ({ liste: m[1].replace(/ (?:und|oder) /g, ", ") })]],
    run(e) {
      const l = liste(e.liste), k = Math.round(Math.min(l.length, Math.max(1, nr(e.anzahl) || 1)));
      if (l.length < 2) throw new Error("Bitte gib mindestens zwei Möglichkeiten an.");
      const w = mischen(l).slice(0, k);
      return { text: k === 1 ? `Das Los fällt auf: ${w[0]}.` : `Gezogen: ${w.join(", ")}.` };
    },
  },
  {
    id: "wuerfel", titel: "Würfel-Set", icon: "🎲", gruppe: G,
    info: "Mehrere Würfel auf einmal, auch W4 bis W100 – z. B. „3W6+2“ oder „2d20“.",
    felder: [{ k: "wurf", label: "Wurf", typ: "text", standard: "2W6" }],
    sprache: [[/^(?:würfle|würfel|wirf|rolle?)(?: mir)? (\d+ ?[wd] ?\d+(?: ?[+-] ?\d+)?|\d+ würfel|zwei würfel|drei würfel)$/, (m) => ({ wurf: /würfel/.test(m[1]) ? `${{ zwei: 2, drei: 3 }[m[1].split(" ")[0]] || m[1].split(" ")[0]}W6` : m[1] })]],
    run(e) {
      const m = String(e.wurf || "2W6").toLowerCase().replace(/\s/g, "").match(/^(\d*)[wd](\d+)([+-]\d+)?$/);
      if (!m) throw new Error("Schreib den Wurf z. B. als 3W6 oder 2d20+1.");
      const n = Math.min(100, +(m[1] || 1)), s = +m[2], plus = +(m[3] || 0);
      if (s < 2 || s > 1000) throw new Error("Würfel haben 2 bis 1000 Seiten.");
      const w = Array.from({ length: n }, () => zufall(s) + 1), sum = w.reduce((a, b) => a + b, 0) + plus;
      return { text: n === 1 && !plus ? `Gewürfelt: ${w[0]}.` : `Gewürfelt: ${w.join(", ")}${plus ? ` ${plus > 0 ? "plus" : "minus"} ${Math.abs(plus)}` : ""}. Zusammen ${sum}.` };
    },
  },
  {
    id: "sternzeichen", titel: "Sternzeichen", icon: "♈", gruppe: G,
    info: "Sternzeichen und chinesisches Tierkreiszeichen zu einem Geburtsdatum.",
    felder: [{ k: "geburt", label: "Geburtsdatum", typ: "datum" }],
    sprache: [[/^(?:welches sternzeichen (?:bin ich|hat man|ist|hat)|sternzeichen),? (?:wenn (?:ich|man) )?(?:am |vom |für |bei |der |den |zum )?(\d{1,2}\.\s?\d{1,2}\.(?:\d{2,4})?|\d{1,2}\.? [a-zäöü]+(?: \d{4})?)(?: geboren(?: bin| ist)?)?$/, (m) => ({ geburt: m[1] })]],
    run(e) {
      const g = pflichtDatum(e, "geburt", "das Geburtsdatum");
      const s = STERN.find(([, m, d]) => g.m < m || (g.m === m && g.d <= d))[0];
      const jahr = g.m < 2 || (g.m === 2 && g.d < 5) ? g.y - 1 : g.y; // grob: chinesisches Neujahr Ende Januar/Anfang Februar
      return { text: `Sternzeichen ${s}. Im chinesischen Tierkreis ${["Ratte", "Schlange", "Ziege"].includes(CHIN[(((jahr - 2020) % 12) + 12) % 12]) ? "eine" : "ein"} ${CHIN[(((jahr - 2020) % 12) + 12) % 12]}.`, hinweis: "Beim chinesischen Zeichen zählt das chinesische Neujahr (Ende Januar bis Mitte Februar) – bei Geburtstagen dazwischen bitte nachprüfen." };
    },
  },
  {
    id: "geschenkideen", titel: "Geschenk-Ideen", icon: "🎀", gruppe: G,
    info: "Ideen nach Person, Budget und Interessen.",
    felder: [{ k: "fuer", label: "Für wen?", typ: "wahl", optionen: Object.keys(FUER), standard: "Partner/in" }, { k: "budget", label: "Budget bis €", typ: "zahl", standard: "50" }, { k: "interesse", label: "Interesse (optional)", typ: "wahl", optionen: ["egal", "technik", "kochen", "sport", "lesen", "wellness", "reisen", "spiele", "garten", "musik", "kreativ", "genuss"], standard: "egal" }],
    sprache: [[/^(?:hast du |gib mir |ich brauche )?(?:eine |ein paar )?geschenk(?:idee|ideen|tipps?)(?: für)? (?:meine |meinen |mein |die |den |einen |eine )?(frau|freundin|mann|freund|partner|partnerin|mama|mutter|papa|vater|kind|sohn|tochter|teenager|kollegen|kollegin|kollege)?(?: (?:bis|unter|für) (\d+) ?(?:euro|€)?)?$/, (m) => ({ fuer: !m[1] ? "Partner/in" : /frau|mann|partner/.test(m[1]) ? "Partner/in" : /mama|mutter/.test(m[1]) ? "Mutter" : /papa|vater/.test(m[1]) ? "Vater" : /freund/.test(m[1]) ? "Freund/in" : /teen/.test(m[1]) ? "Teenager" : /koll/.test(m[1]) ? "Kollege/Kollegin" : "Kind", budget: m[2] || 50 })]],
    run(e) {
      const f = FUER[e.fuer] || "p", b = nr(e.budget) || 50, i = e.interesse && e.interesse !== "egal" ? e.interesse : null;
      let t = GESCHENKE.filter(([, p, w, tags]) => p <= b && w.includes(f) && (!i || tags.includes(i)));
      if (!t.length) t = GESCHENKE.filter(([, p, w]) => p <= b && w.includes(f));
      if (!t.length) return { text: `Unter ${de(b, 0)} Euro fällt mir für ${e.fuer || "diese Person"} leider nichts Passendes ein. Wie wäre es mit einem selbstgemachten Gutschein für gemeinsame Zeit?` };
      const w = mischen(t).slice(0, 6);
      return { text: `Ideen für ${e.fuer || "Partner/in"} bis ${de(b, 0)} Euro: ${w.slice(0, 3).map((x) => x[0]).join(", ")}.`, tabelle: { kopf: ["Idee", "ca. Preis"], zeilen: w.map((x) => [x[0], `${x[1]} €`]) } };
    },
  },
];
