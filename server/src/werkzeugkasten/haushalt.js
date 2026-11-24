// Haushalt, Küche & Energie.
import { nr, zahl, text, de, eur, heute, MONATSNAMEN } from "./hilfe.js";

const G = "Haushalt & Energie";
const Z = "(\\d[\\d.]*(?:,\\d+)?)";

// Menge am Zeilenanfang: "200", "1,5", "1/2", "½", "1 1/2"
const BRUCH = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };
function mengeVorne(z) {
  const m = z.match(/^\s*(?:(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)|(\d+(?:[.,]\d+)?)\s*([½¼¾⅓⅔⅛])?|([½¼¾⅓⅔⅛]))/);
  if (!m) return null;
  let n;
  if (m[1]) n = +m[1] + +m[2] / +m[3];
  else if (m[4]) n = +m[4] / +m[5];
  else if (m[6]) n = nr(m[6]) + (m[7] ? BRUCH[m[7]] : 0);
  else n = BRUCH[m[8]];
  return { n, rest: z.slice(m[0].length) };
}
const schoen = (n) => (n >= 10 ? de(Math.round(n)) : n >= 1 ? de(Math.round(n * 4) / 4) : de(Math.round(n * 100) / 100));

const DICHTE = { wasser: 1, milch: 1.03, sahne: 1, mehl: 0.53, zucker: 0.85, puderzucker: 0.56, butter: 0.96, reis: 0.85, öl: 0.92, honig: 1.42, salz: 1.2, haferflocken: 0.38, kakao: 0.42, joghurt: 1.03 };
const VOLUMEN = { "tasse/cup (240 ml)": 240, "esslöffel (el)": 15, "teelöffel (tl)": 5, "flüssigunze (fl oz)": 29.57, "milliliter": 1, "liter": 1000 };
const GEWICHT = { "unze (oz)": 28.35, "pfund (lb)": 453.6, "gramm": 1 };

const SAISON = {
  Äpfel: [1, 2, 3, 4, 8, 9, 10, 11, 12], Birnen: [1, 8, 9, 10, 11, 12], Erdbeeren: [5, 6, 7], Kirschen: [6, 7, 8], Heidelbeeren: [7, 8, 9], Himbeeren: [6, 7, 8, 9],
  Johannisbeeren: [6, 7, 8], Pflaumen: [7, 8, 9, 10], Rhabarber: [4, 5, 6], Weintrauben: [8, 9, 10], Kürbis: [8, 9, 10, 11, 12],
  Spargel: [4, 5, 6], Tomaten: [7, 8, 9, 10], Gurken: [6, 7, 8, 9], Zucchini: [6, 7, 8, 9], Paprika: [7, 8, 9, 10], Bohnen: [7, 8, 9, 10], Erbsen: [6, 7, 8],
  Blumenkohl: [6, 7, 8, 9, 10], Brokkoli: [6, 7, 8, 9, 10], Rosenkohl: [1, 2, 10, 11, 12], Grünkohl: [1, 2, 11, 12], Rotkohl: [1, 2, 3, 9, 10, 11, 12], Weißkohl: [1, 2, 3, 7, 8, 9, 10, 11, 12],
  Wirsing: [1, 2, 3, 6, 7, 8, 9, 10, 11, 12], Karotten: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12], Kartoffeln: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12], Lauch: [1, 2, 3, 8, 9, 10, 11, 12],
  Pastinaken: [1, 2, 3, 10, 11, 12], "Rote Bete": [1, 2, 3, 8, 9, 10, 11, 12], Sellerie: [1, 2, 3, 9, 10, 11, 12], Feldsalat: [1, 2, 3, 10, 11, 12], Radieschen: [4, 5, 6, 7, 8, 9],
  Kopfsalat: [5, 6, 7, 8, 9, 10], Spinat: [3, 4, 5, 9, 10, 11], Bärlauch: [3, 4, 5], Zwiebeln: [1, 2, 3, 7, 8, 9, 10, 11, 12], Mais: [8, 9, 10], Pilze: [8, 9, 10, 11], Topinambur: [1, 2, 3, 10, 11, 12],
};

const FLECKEN = {
  rotwein: "Sofort mit Salz oder Mineralwasser abtupfen (nicht reiben), dann kalt auswaschen. Alte Flecken mit Gallseife einweichen.",
  kaffee: "Mit kaltem Wasser ausspülen, dann Gallseife oder etwas Spülmittel einreiben und waschen.",
  tee: "Wie Kaffee: kalt ausspülen, mit Zitronensaft oder Gallseife behandeln.",
  fett: "Speisestärke oder Babypuder draufstreuen, einwirken lassen, ausbürsten. Danach mit Spülmittel vorbehandeln und warm waschen.",
  öl: "Spülmittel einmassieren, 10 Minuten wirken lassen, so warm waschen wie erlaubt.",
  blut: "Nur KALTES Wasser! Warmes Wasser lässt Eiweiß gerinnen. Mit Salzwasser oder Gallseife einweichen.",
  gras: "Mit Zitronensaft oder etwas Alkohol (Spiritus) vorbehandeln, dann mit Gallseife waschen.",
  kugelschreiber: "Mit Alkohol (Spiritus oder Desinfektionsmittel) auf einem Tuch abtupfen, von außen nach innen.",
  tinte: "Mit Milch oder Zitronensaft einweichen, danach Gallseife.",
  kerzenwachs: "Einfrieren und abkratzen. Reste mit Löschpapier drauf und lauwarm bügeln.",
  kaugummi: "Kleidung in den Gefrierschrank legen, dann den harten Kaugummi abbrechen.",
  tomate: "Erst kalt ausspülen, dann Spülmittel. In die Sonne legen hilft: UV bleicht den Farbstoff.",
  schokolade: "Antrocknen lassen, abkratzen, dann mit Gallseife und lauwarmem Wasser behandeln.",
  makeup: "Mit Rasierschaum oder Mizellenwasser einreiben, abtupfen, dann waschen.",
  rost: "Zitronensaft und Salz drauf, in die Sonne legen, danach auswaschen.",
  schweiß: "Mit Natron-Paste oder Essigwasser einweichen, dann waschen.",
  obst: "Mit kaltem Wasser und Zitronensaft behandeln, danach waschen.",
  senf: "Glycerin einwirken lassen, dann Gallseife.",
  kurkuma: "Spülmittel einreiben und ab in die Sonne – Kurkuma bleicht im Sonnenlicht aus.",
};

export default [
  {
    id: "rezept_skalieren", titel: "Rezept umrechnen", icon: "👩‍🍳", gruppe: G,
    info: "Zutaten auf andere Portionen umrechnen.",
    felder: [
      { k: "zutaten", label: "Zutaten (eine pro Zeile)", typ: "textarea", platzhalter: "500 g Mehl\n2 Eier\n1/2 TL Salz\n250 ml Milch" },
      { k: "von", label: "Rezept ist für … Portionen", typ: "zahl", standard: "4" }, { k: "auf", label: "Ich brauche … Portionen", typ: "zahl", standard: "2" },
    ],
    run(e) {
      const v = zahl(e, "von", "die Portionen im Rezept", { min: 0.1 }), a = zahl(e, "auf", "die gewünschten Portionen", { min: 0.1 }), f = a / v;
      const zeilen = text(e, "zutaten", "die Zutaten").split("\n").map((z) => z.trim()).filter(Boolean).map((z) => {
        const m = mengeVorne(z);
        if (!m) return [z, "nach Gefühl"];
        let neu = m.n * f, rest = m.rest.trim();
        if (/^(eier?|ei\b)/i.test(rest) && neu < 1) neu = 1;
        return [z, `${/^(eier?\b)/i.test(rest) ? de(Math.max(1, Math.round(neu))) : schoen(neu)} ${rest}`];
      });
      return { text: `Ich habe ${zeilen.length} Zutaten von ${de(v)} auf ${de(a)} Portionen umgerechnet.`, tabelle: { kopf: ["Original", `Für ${de(a)} Portionen`], zeilen }, zeigen: true };
    },
  },
  {
    id: "kueche_einheiten", titel: "Küchen-Maße", icon: "🥄", gruppe: G,
    info: "Tassen, Löffel, Unzen und Pfund in Gramm und Milliliter.",
    felder: [
      { k: "menge", label: "Menge", typ: "zahl", standard: "1" },
      { k: "einheit", label: "Einheit", typ: "wahl", optionen: [...Object.keys(VOLUMEN), ...Object.keys(GEWICHT)], standard: "tasse/cup (240 ml)" },
      { k: "zutat", label: "Zutat", typ: "wahl", optionen: Object.keys(DICHTE), standard: "mehl" },
    ],
    sprache: [[new RegExp(`^wie ?viel (?:gramm|g) (?:sind|ist|hat|wiegt) (?:ein|eine|einen|${Z}) (tasse|tassen|cup|cups|esslöffel|el|teelöffel|tl)(?: (${Object.keys(DICHTE).join("|")}))?$`), (m) => ({ menge: m[1] || 1, einheit: /tasse|cup/.test(m[2]) ? "tasse/cup (240 ml)" : /^(esslöffel|el)$/.test(m[2]) ? "esslöffel (el)" : "teelöffel (tl)", zutat: m[3] || "wasser" })]],
    run(e) {
      const n = zahl(e, "menge", "die Menge", { min: 0 }), ein = String(e.einheit || "tasse/cup (240 ml)"), zu = String(e.zutat || "wasser"), d = DICHTE[zu] ?? 1;
      const NAME = { "tasse/cup (240 ml)": n === 1 ? "Tasse" : "Tassen", "esslöffel (el)": n === 1 ? "Esslöffel" : "Esslöffel", "teelöffel (tl)": "Teelöffel", "flüssigunze (fl oz)": "Flüssigunzen", milliliter: "Milliliter", liter: "Liter", "unze (oz)": n === 1 ? "Unze" : "Unzen", "pfund (lb)": "Pfund", gramm: "Gramm" }[ein] || ein;
      const zuName = zu[0].toUpperCase() + zu.slice(1);
      if (VOLUMEN[ein]) { const ml = n * VOLUMEN[ein]; return { text: `${de(n)} ${NAME} ${zuName} sind ${de(ml, 0)} Milliliter, das wiegt etwa ${de(ml * d, 0)} Gramm.` }; }
      const g = n * GEWICHT[ein];
      return { text: `${de(n)} ${NAME} sind ${de(g, 0)} Gramm${zu !== "wasser" ? `, bei ${zuName} etwa ${de(g / d, 0)} Milliliter` : ""}.` };
    },
  },
  {
    id: "backofen", titel: "Backofen-Umrechner", icon: "🔥", gruppe: G,
    info: "Ober-/Unterhitze, Umluft und Gas-Stufen umrechnen.",
    felder: [{ k: "grad", label: "Temperatur °C (oder Gas-Stufe)", typ: "zahl" }, { k: "von", label: "Angabe im Rezept", typ: "wahl", optionen: ["Ober-/Unterhitze", "Umluft", "Gas-Stufe"], standard: "Ober-/Unterhitze" }],
    sprache: [[new RegExp(`^${Z} ?(?:grad|°)? ?(umluft|ober ?unterhitze|ober- ?und unterhitze|ober-unterhitze) (?:in|zu|auf|als) (?:umluft|ober ?unterhitze|ober- ?und unterhitze|ober-unterhitze)$`), (m) => ({ grad: m[1], von: m[2].startsWith("umluft") ? "Umluft" : "Ober-/Unterhitze" })]],
    run(e) {
      const GAS = [0, 140, 150, 170, 180, 190, 200, 220, 230, 240];
      const g = zahl(e, "grad", "die Temperatur", { min: 1, max: 300 }), von = e.von || "Ober-/Unterhitze";
      const ou = von === "Umluft" ? g + 20 : von === "Gas-Stufe" ? GAS[Math.min(9, Math.max(1, Math.round(g)))] : g;
      const gas = GAS.reduce((best, t, i) => (i && Math.abs(t - ou) < Math.abs(GAS[best] - ou) ? i : best), 1);
      const ziel = [von !== "Ober-/Unterhitze" && `${de(ou, 0)} Grad Ober- und Unterhitze`, von !== "Umluft" && `${de(ou - 20, 0)} Grad Umluft`, von !== "Gas-Stufe" && `Gas-Stufe ${gas}`].filter(Boolean);
      return { text: `${von === "Gas-Stufe" ? `Gas-Stufe ${de(g, 0)}` : `${de(g, 0)} Grad ${von}`} entspricht ${ziel.join(" oder ")}.` };
    },
  },
  {
    id: "eier_kochzeit", titel: "Eier-Kochzeit", icon: "🥚", gruppe: G,
    info: "Wie lange dein Ei kochen muss.",
    felder: [{ k: "wunsch", label: "Wie?", typ: "wahl", optionen: ["weich", "wachsweich", "hart"], standard: "wachsweich" }, { k: "groesse", label: "Größe", typ: "wahl", optionen: ["S", "M", "L", "XL"], standard: "M" }, { k: "kalt", label: "Aus dem Kühlschrank?", typ: "wahl", optionen: ["ja", "nein"], standard: "ja" }],
    sprache: [[/^wie lange (?:muss ich |soll ich )?(?:ein |die |mein )?eie?r? kochen(?: wenn es| damit es| für)? ?(weich|wachsweich|hart)?(?: werden soll| sein soll| ist)?$/, (m) => ({ wunsch: m[1] || "wachsweich" })],
      [/^wie lange (?:koche ich|kocht man|muss) (?:ein |die |mein )?(?:(weich|wachsweich|hart)(?:es|e)? )?eie?r?(?: kochen)?$/, (m) => ({ wunsch: m[1] || "wachsweich" })]],
    run(e) {
      const basis = { weich: 4.5, wachsweich: 6.5, hart: 9.5 }[e.wunsch || "wachsweich"] ?? 6.5;
      const t = basis + ({ S: -0.5, M: 0, L: 0.5, XL: 1 }[e.groesse || "M"] ?? 0) + (e.kalt === "nein" ? 0 : 0.5);
      const min = Math.floor(t), sek = Math.round((t - min) * 60);
      return { text: `Ein ${e.wunsch || "wachsweich"}es Ei der Größe ${e.groesse || "M"} braucht ${min} Minuten${sek ? ` und ${sek} Sekunden` : ""} in sprudelnd kochendem Wasser. Danach kalt abschrecken.` };
    },
  },
  {
    id: "kerntemperatur", titel: "Kerntemperatur", icon: "🌡️", gruppe: G,
    info: "Die richtige Kerntemperatur für Fleisch und Fisch.",
    felder: [{ k: "was", label: "Was?", typ: "wahl", optionen: ["Rind rare", "Rind medium", "Rind durch", "Schweinefilet", "Schweinebraten", "Hähnchen", "Pute", "Ente", "Lamm rosa", "Hackfleisch", "Lachs", "Fisch"], standard: "Rind medium" }],
    sprache: [[/^(?:welche |was ist die )?kerntemperatur (?:für|von|bei|hat) (?:ein |eine |einen )?(rind|steak|schwein|schweinefilet|schweinebraten|hähnchen|huhn|pute|ente|lamm|hack|hackfleisch|lachs|fisch)\w*$/, (m) => ({ was: { rind: "Rind medium", steak: "Rind medium", schwein: "Schweinebraten", schweinefilet: "Schweinefilet", schweinebraten: "Schweinebraten", hähnchen: "Hähnchen", huhn: "Hähnchen", pute: "Pute", ente: "Ente", lamm: "Lamm rosa", hack: "Hackfleisch", hackfleisch: "Hackfleisch", lachs: "Lachs", fisch: "Fisch" }[m[1]] })]],
    run(e) {
      const T = { "Rind rare": "50 bis 52", "Rind medium": "56 bis 58", "Rind durch": "über 65", Schweinefilet: "63 bis 65", Schweinebraten: "75 bis 80", Hähnchen: "mindestens 74, gut sind 75 bis 80", Pute: "mindestens 74, gut sind 75 bis 80", Ente: "80 (Brust allein 58 bis 62)", "Lamm rosa": "58 bis 62", Hackfleisch: "mindestens 70", Lachs: "50 bis 55", Fisch: "55 bis 60" };
      const w = e.was || "Rind medium";
      return { text: `${w}: ${T[w] || "?"} Grad im Kern.${/Hähnchen|Pute|Hack|Ente/.test(w) ? " Geflügel und Hack immer durchgaren." : ""}` };
    },
  },
  {
    id: "saisonkalender", titel: "Saisonkalender", icon: "🥕", gruppe: G,
    info: "Welches Obst und Gemüse aus Deutschland gerade Saison hat.",
    felder: [{ k: "monat", label: "Monat", typ: "wahl", optionen: ["jetzt", ...MONATSNAMEN], standard: "jetzt" }],
    sprache: [[/^(?:was hat|welches (?:obst|gemüse)(?: und (?:obst|gemüse))? hat) (?:gerade |jetzt |im (\w+) )?saison$|^saisonkalender$|^was ist (?:gerade |jetzt )?(?:in der )?saison$/, (m) => ({ monat: m[1] ? MONATSNAMEN.find((x) => x.toLowerCase() === m[1]) || "jetzt" : "jetzt" })]],
    run(e) {
      const mi = !e.monat || e.monat === "jetzt" ? heute().m : MONATSNAMEN.indexOf(e.monat) + 1;
      if (mi < 1) throw new Error("Unbekannter Monat.");
      const da = Object.entries(SAISON).filter(([, ms]) => ms.includes(mi)).map(([n]) => n);
      const neu = Object.entries(SAISON).filter(([, ms]) => ms.includes(mi) && !ms.includes(mi === 1 ? 12 : mi - 1)).map(([n]) => n);
      return { text: `Im ${MONATSNAMEN[mi - 1]} haben Saison: ${da.join(", ")}.${neu.length ? ` Neu dazu: ${neu.join(", ")}.` : ""}`, zeilen: da };
    },
  },
  {
    id: "flecken", titel: "Flecken-Helfer", icon: "🧽", gruppe: G,
    info: "So bekommst du Flecken wieder raus.",
    felder: [{ k: "fleck", label: "Was für ein Fleck?", typ: "wahl", optionen: Object.keys(FLECKEN), standard: "rotwein" }],
    sprache: [[new RegExp(`^(?:wie (?:bekomme|kriege|krieg|bekomm|entferne) (?:ich )?(?:einen |den |ein )?)?(${Object.keys(FLECKEN).join("|")}|make-up|wachs|kuli|blut)(?:fleck|flecken|-fleck)? ?(?:raus|weg|entfernen|aus der kleidung)?$`), (m) => ({ fleck: { "make-up": "makeup", wachs: "kerzenwachs", kuli: "kugelschreiber" }[m[1]] || m[1] })]],
    run(e) {
      const f = String(e.fleck || "").toLowerCase();
      if (!FLECKEN[f]) throw new Error(`Diesen Fleck kenne ich nicht. Ich kenne: ${Object.keys(FLECKEN).join(", ")}.`);
      return { text: `${f[0].toUpperCase() + f.slice(1)}: ${FLECKEN[f]} Vorher an einer versteckten Stelle testen.` };
    },
  },
  {
    id: "wandfarbe", titel: "Wandfarbe-Bedarf", icon: "🎨", gruppe: G,
    info: "Wie viel Farbe du für ein Zimmer brauchst.",
    felder: [{ k: "laenge", label: "Raum-Länge m", typ: "zahl" }, { k: "breite", label: "Raum-Breite m", typ: "zahl" }, { k: "hoehe", label: "Raum-Höhe m", typ: "zahl", standard: "2,5" }, { k: "abzug", label: "Fenster & Türen m²", typ: "zahl", standard: "4" }, { k: "decke", label: "Decke mitstreichen?", typ: "wahl", optionen: ["nein", "ja"], standard: "nein" }, { k: "anstriche", label: "Anstriche", typ: "zahl", standard: "2" }, { k: "ergiebig", label: "m² pro Liter (Eimer)", typ: "zahl", standard: "7" }],
    run(e) {
      const l = zahl(e, "laenge", "die Länge", { min: 0.1 }), b = zahl(e, "breite", "die Breite", { min: 0.1 }), h = nr(e.hoehe) || 2.5;
      const fl = Math.max(0, 2 * (l + b) * h - (nr(e.abzug) || 0) + (e.decke === "ja" ? l * b : 0));
      const liter = (fl * (nr(e.anstriche) || 2)) / (nr(e.ergiebig) || 7);
      return { text: `${de(fl, 1)} Quadratmeter Fläche, bei ${de(nr(e.anstriche) || 2, 0)} Anstrichen brauchst du etwa ${de(Math.ceil(liter * 1.1 * 2) / 2, 1)} Liter Farbe (mit 10 Prozent Reserve).` };
    },
  },
  {
    id: "bodenbedarf", titel: "Boden & Fliesen", icon: "🧱", gruppe: G,
    info: "Wie viele Pakete Laminat, Parkett oder Fliesen du brauchst.",
    felder: [{ k: "laenge", label: "Länge m", typ: "zahl" }, { k: "breite", label: "Breite m", typ: "zahl" }, { k: "verlegung", label: "Verlegung", typ: "wahl", optionen: ["gerade (10 % Verschnitt)", "diagonal (15 %)", "Fischgrät (20 %)"], standard: "gerade (10 % Verschnitt)" }, { k: "paket", label: "m² pro Paket", typ: "zahl", standard: "2,2" }, { k: "preis", label: "Preis pro m² € (optional)", typ: "zahl" }],
    run(e) {
      const fl = zahl(e, "laenge", "die Länge", { min: 0.1 }) * zahl(e, "breite", "die Breite", { min: 0.1 });
      const vs = /20/.test(e.verlegung) ? 0.2 : /15/.test(e.verlegung) ? 0.15 : 0.1, bedarf = fl * (1 + vs), paket = nr(e.paket) || 2.2, pakete = Math.ceil(bedarf / paket);
      const preis = nr(e.preis);
      return { text: `${de(fl, 2)} Quadratmeter Raum, mit Verschnitt ${de(bedarf, 2)}. Du brauchst ${pakete} Pakete à ${de(paket)} Quadratmeter${preis ? `, das kostet etwa ${eur(pakete * paket * preis)}` : ""}.` };
    },
  },
  {
    id: "spritkosten", titel: "Spritkosten", icon: "⛽", gruppe: G,
    info: "Was eine Autofahrt an Sprit kostet – auch pro Person.",
    felder: [{ k: "km", label: "Strecke km", typ: "zahl" }, { k: "verbrauch", label: "Verbrauch l/100 km", typ: "zahl", standard: "7" }, { k: "preis", label: "Spritpreis €/l", typ: "zahl", standard: "1,75" }, { k: "personen", label: "Personen", typ: "zahl", standard: "1" }, { k: "rueck", label: "Hin und zurück?", typ: "wahl", optionen: ["nein", "ja"], standard: "nein" }],
    sprache: [[new RegExp(`^(?:was kosten |wie viel kosten |wie teuer sind )?(?:die )?(?:spritkosten|benzinkosten|tankkosten|sprit|benzin) (?:für|bei) ${Z} ?(?:km|kilometer)(?: (?:bei|mit) ${Z} ?(?:liter|l))?$`), (m) => ({ km: m[1], verbrauch: m[2] })]],
    run(e) {
      const km = zahl(e, "km", "die Strecke", { min: 0.1 }) * (e.rueck === "ja" ? 2 : 1), v = nr(e.verbrauch) || 7, p = nr(e.preis) || 1.75, per = Math.max(1, nr(e.personen) || 1);
      const liter = (km * v) / 100, kosten = liter * p;
      return { text: `Für ${de(km, 0)} Kilometer brauchst du etwa ${de(liter, 1)} Liter, das kostet ${eur(kosten)}${per > 1 ? `, also ${eur(kosten / per)} pro Person` : ""}.` };
    },
  },
  {
    id: "stromkosten", titel: "Stromkosten eines Geräts", icon: "🔌", gruppe: G,
    info: "Was ein Gerät im Jahr an Strom kostet.",
    felder: [{ k: "watt", label: "Leistung in Watt", typ: "zahl" }, { k: "stunden", label: "Stunden pro Tag", typ: "zahl", standard: "1" }, { k: "preis", label: "Strompreis ct/kWh", typ: "zahl", standard: "35" }],
    sprache: [[new RegExp(`^(?:was kostet|wie viel kostet|stromkosten (?:für|von)) (?:ein gerät mit |ein |eine )?${Z} ?(?:watt|w)(?: (?:bei |für |und )?${Z} stunden?(?: am tag| pro tag| täglich)?)?(?: im jahr| an strom)?$`), (m) => ({ watt: m[1], stunden: m[2] ?? 1 })]],
    run(e) {
      const w = zahl(e, "watt", "die Leistung", { min: 0 }), h = nr(e.stunden) ?? 1, p = (nr(e.preis) || 35) / 100;
      const kwh = (w * h * 365) / 1000;
      return { text: `${de(w)} Watt bei ${de(h)} Stunden am Tag sind ${de(kwh, 0)} Kilowattstunden im Jahr. Das kostet etwa ${eur(kwh * p)} im Jahr, ${eur((kwh * p) / 12)} im Monat.` };
    },
  },
  {
    id: "eauto_laden", titel: "E-Auto laden", icon: "🔋", gruppe: G,
    info: "Ladedauer und Kosten fürs E-Auto.",
    felder: [{ k: "akku", label: "Akku kWh", typ: "zahl", standard: "60" }, { k: "von", label: "Von %", typ: "zahl", standard: "20" }, { k: "bis", label: "Bis %", typ: "zahl", standard: "80" }, { k: "leistung", label: "Ladeleistung kW", typ: "zahl", standard: "11" }, { k: "preis", label: "Preis ct/kWh", typ: "zahl", standard: "35" }],
    run(e) {
      const ak = zahl(e, "akku", "die Akkugröße", { min: 1 }), von = nr(e.von) ?? 20, bis = nr(e.bis) ?? 80, kw = nr(e.leistung) || 11, p = (nr(e.preis) || 35) / 100;
      if (bis <= von) throw new Error("„Bis“ muss größer als „von“ sein.");
      const netz = (ak * (bis - von)) / 100 / 0.9, h = netz / kw;
      return { text: `Von ${de(von, 0)} auf ${de(bis, 0)} Prozent fließen etwa ${de(netz, 1)} Kilowattstunden (mit Ladeverlust). Das dauert bei ${de(kw)} kW rund ${de(h, 1)} Stunden und kostet etwa ${eur(netz * p)}.` };
    },
  },
];
