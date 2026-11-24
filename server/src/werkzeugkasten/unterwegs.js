// Unterwegs & Reisen.
import { nr, zahl, text, de, ort } from "./hilfe.js";

const G = "Unterwegs & Reisen";

// Land: [Vorwahl, Steckertypen, Spannung, Trinkgeld]
const LAENDER = {
  Deutschland: ["+49", "C, F", "230 V", "5 bis 10 Prozent, oder aufrunden"], Österreich: ["+43", "C, F", "230 V", "5 bis 10 Prozent"], Schweiz: ["+41", "C, J", "230 V", "im Preis enthalten, aufrunden ist üblich"],
  Frankreich: ["+33", "C, E", "230 V", "Service ist inklusive, 5 Prozent bei gutem Service"], Italien: ["+39", "C, F, L", "230 V", "Coperto steht oft auf der Rechnung, 5 bis 10 Prozent freiwillig"],
  Spanien: ["+34", "C, F", "230 V", "5 bis 10 Prozent oder aufrunden"], Portugal: ["+351", "C, F", "230 V", "5 bis 10 Prozent"], Niederlande: ["+31", "C, F", "230 V", "5 bis 10 Prozent"],
  Belgien: ["+32", "C, E", "230 V", "Service inklusive, aufrunden"], Luxemburg: ["+352", "C, F", "230 V", "5 bis 10 Prozent"], Dänemark: ["+45", "C, E, F, K", "230 V", "inklusive, aufrunden"],
  Schweden: ["+46", "C, F", "230 V", "inklusive, aufrunden"], Norwegen: ["+47", "C, F", "230 V", "inklusive, aufrunden"], Finnland: ["+358", "C, F", "230 V", "nicht üblich"], Island: ["+354", "C, F", "230 V", "inklusive"],
  Polen: ["+48", "C, E", "230 V", "10 Prozent"], Tschechien: ["+420", "C, E", "230 V", "10 Prozent"], Ungarn: ["+36", "C, F", "230 V", "10 bis 15 Prozent"], Kroatien: ["+385", "C, F", "230 V", "10 Prozent"],
  Griechenland: ["+30", "C, F", "230 V", "5 bis 10 Prozent"], Türkei: ["+90", "C, F", "230 V", "5 bis 10 Prozent"], Zypern: ["+357", "G", "230 V", "10 Prozent"], Malta: ["+356", "G", "230 V", "5 bis 10 Prozent"],
  Großbritannien: ["+44", "G", "230 V", "10 bis 12,5 Prozent, oft schon als Service Charge auf der Rechnung"], Irland: ["+353", "G", "230 V", "10 bis 15 Prozent"],
  Russland: ["+7", "C, F", "220 V", "10 Prozent"], Ukraine: ["+380", "C, F", "230 V", "10 Prozent"],
  USA: ["+1", "A, B", "120 V", "15 bis 20 Prozent – wird praktisch erwartet"], Kanada: ["+1", "A, B", "120 V", "15 bis 20 Prozent"], Mexiko: ["+52", "A, B", "127 V", "10 bis 15 Prozent"],
  Kuba: ["+53", "A, B, C, L", "110/220 V", "10 Prozent"], "Dominikanische Republik": ["+1", "A, B", "120 V", "10 Prozent extra, auch wenn Service inklusive ist"],
  Brasilien: ["+55", "C, N", "127/220 V", "10 Prozent, meist auf der Rechnung"], Argentinien: ["+54", "C, I", "220 V", "10 Prozent"],
  Ägypten: ["+20", "C, F", "220 V", "10 bis 15 Prozent, kleines Bakschisch ist überall üblich"], Marokko: ["+212", "C, E", "220 V", "10 Prozent"], Tunesien: ["+216", "C, E", "230 V", "5 bis 10 Prozent"],
  Südafrika: ["+27", "C, D, M, N", "230 V", "10 bis 15 Prozent"], Kenia: ["+254", "G", "240 V", "10 Prozent"],
  "Vereinigte Arabische Emirate": ["+971", "G (oft auch C, D)", "230 V", "10 bis 15 Prozent"], Israel: ["+972", "C, H", "230 V", "12 bis 15 Prozent"],
  Indien: ["+91", "C, D, M", "230 V", "10 Prozent"], Thailand: ["+66", "A, B, C, O", "220 V", "aufrunden, in Restaurants etwa 10 Prozent"], Vietnam: ["+84", "A, C", "220 V", "5 bis 10 Prozent"],
  Indonesien: ["+62", "C, F", "230 V", "5 bis 10 Prozent"], China: ["+86", "A, C, I", "220 V", "nicht üblich"], Japan: ["+81", "A, B", "100 V", "kein Trinkgeld – gilt eher als unhöflich"],
  Südkorea: ["+82", "C, F", "220 V", "nicht üblich"], Singapur: ["+65", "G", "230 V", "Service inklusive"], Australien: ["+61", "I", "230 V", "nicht nötig, 10 Prozent bei sehr gutem Service"], Neuseeland: ["+64", "I", "230 V", "nicht nötig"],
};
const LAND_ALIAS = { england: "Großbritannien", uk: "Großbritannien", schottland: "Großbritannien", london: "Großbritannien", amerika: "USA", "vereinigte staaten": "USA", dubai: "Vereinigte Arabische Emirate", emirate: "Vereinigte Arabische Emirate", vae: "Vereinigte Arabische Emirate", bali: "Indonesien", mallorca: "Spanien", teneriffa: "Spanien", "gran canaria": "Spanien", korea: "Südkorea", holland: "Niederlande", tschechei: "Tschechien", "dom rep": "Dominikanische Republik", "dominikanische republik": "Dominikanische Republik" };
export function findeLand(q) {
  const l = String(q || "").trim().toLowerCase().replace(/^(der |die |den |dem |in |nach )+/, "");
  const n = Object.keys(LAENDER).find((k) => k.toLowerCase() === l) || LAND_ALIAS[l];
  return n ? { name: n, d: LAENDER[n] } : null;
}
const LAND_RE = `([a-zäöüß .-]{2,30})`;
const passtDeutsch = (st) => /\b[CEF]\b/.test(st);

function haversine(a, b) {
  const R = 6371, r = (x) => (x * Math.PI) / 180, dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const PACK = {
  immer: ["Ausweis / Reisepass", "Handy + Ladekabel", "Geldbörse, Karten, etwas Bargeld", "Schlüssel", "Medikamente", "Zahnbürste & Zahnpasta", "Duschzeug & Deo", "Unterwäsche", "Socken", "Schlafsachen", "Powerbank", "Kopfhörer"],
  Strand: ["Badesachen (2×)", "Sonnencreme LSF 30+", "Sonnenbrille", "Sonnenhut/Cap", "Strandtuch", "Flip-Flops", "After-Sun", "leichte Kleidung", "wasserdichte Handyhülle"],
  Städtetrip: ["bequeme Schuhe", "kleiner Rucksack", "Regenschirm/-jacke", "Stadtplan/Offline-Karte", "Tickets ausgedruckt oder in der Wallet"],
  Ski: ["Skijacke & -hose", "Thermounterwäsche", "Skisocken", "Handschuhe", "Mütze/Helm", "Skibrille", "Lippenpflege mit LSF", "Sonnencreme", "Skipass/Versicherung"],
  Wandern: ["Wanderschuhe (eingelaufen)", "Regenjacke", "Trinkflasche", "Blasenpflaster", "Erste-Hilfe-Set", "Stirnlampe", "Wanderkarte/App offline", "Snacks"],
  Business: ["Anzug/Business-Outfit", "Hemden/Blusen", "Laptop + Netzteil", "Präsentation auf USB-Stick", "Visitenkarten", "Notizblock", "Bügelfreies Hemd als Reserve"],
  Camping: ["Zelt + Heringe", "Schlafsack", "Isomatte", "Campingkocher + Gas", "Taschenlampe", "Geschirr & Besteck", "Müllbeutel", "Mückenschutz", "Taschenmesser"],
  Flug: ["Flugtickets/Bordkarte", "Flüssigkeiten im 1-Liter-Beutel", "Nackenkissen", "Kaugummi für den Druckausgleich", "Koffer wiegen"],
  Kinder: ["Kuscheltier", "Spielzeug für unterwegs", "Snacks", "Feuchttücher", "Wechselkleidung griffbereit", "Kinder-Reisepass", "Kinder-Medikamente (Fieber, Pflaster)"],
  Ausland: ["Reiseadapter", "Auslandskrankenversicherung", "Kopie vom Pass (digital)", "Roaming/eSIM prüfen", "Impfungen prüfen"],
};

export default [
  {
    id: "luftlinie", titel: "Entfernung (Luftlinie)", icon: "📏", gruppe: G,
    info: "Entfernung zwischen zwei Orten, mit grober Fahr- und Flugzeit.",
    felder: [{ k: "von", label: "Von", typ: "text", platzhalter: "Berlin" }, { k: "nach", label: "Nach", typ: "text", platzhalter: "Rom" }],
    sprache: [[/^(?:wie weit ist es |wie weit ist |entfernung |die )?luftlinie (?:von |zwischen )?([a-zäöüß .-]{2,40}?) (?:nach|bis|und) ([a-zäöüß .-]{2,40})$/, (m) => ({ von: m[1], nach: m[2] })]],
    async run(e) {
      const [a, b] = await Promise.all([ort(text(e, "von", "den Startort", { max: 80 })), ort(text(e, "nach", "das Ziel", { max: 80 }))]);
      const km = haversine(a, b), flug = km / 800 + 0.5, auto = (km * 1.3) / 85;
      return { text: `Von ${a.name} nach ${b.name} sind es ${de(km, 0)} Kilometer Luftlinie. Mit dem Auto grob ${de(km * 1.3, 0)} Kilometer und ${de(auto, 1)} Stunden, geflogen etwa ${de(flug, 1)} Stunden.`, hinweis: "Grobe Schätzung. Für echte Routen: „Friday, wie lange brauche ich nach …“." };
    },
  },
  {
    id: "koordinaten", titel: "Koordinaten umrechnen", icon: "🧭", gruppe: G,
    info: "GPS-Koordinaten: Dezimal ↔ Grad, Minuten, Sekunden, mit Kartenlink.",
    felder: [{ k: "koord", label: "Koordinaten", typ: "text", platzhalter: "52.5200, 13.4050  oder  52°31'12\"N 13°24'18\"E" }],
    run(e) {
      const roh = text(e, "koord", "Koordinaten", { max: 100 }), s = roh.includes(".") ? roh : roh.replace(/(\d),(\d)/g, "$1.$2");
      let lat, lon;
      const dms = [...s.matchAll(/(\d{1,3})[°\s]+(\d{1,2})['′\s]+(\d{1,2}(?:\.\d+)?)["″]?\s*([NSEWO])/gi)];
      if (dms.length === 2) {
        const w = (m) => (+m[1] + +m[2] / 60 + +m[3] / 3600) * (/[SW]/i.test(m[4]) ? -1 : 1);
        [lat, lon] = /[NS]/i.test(dms[0][4]) ? [w(dms[0]), w(dms[1])] : [w(dms[1]), w(dms[0])];
      } else {
        const z = s.match(/-?\d{1,3}(?:\.\d+)?/g);
        if (!z || z.length < 2) throw new Error("Bitte gib zwei Werte ein, z. B. 52.52, 13.405.");
        [lat, lon] = [+z[0], +z[1]];
      }
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error("Diese Koordinaten gibt es nicht.");
      const zuDms = (v, p, n) => { const a = Math.abs(v), g = Math.floor(a), m = Math.floor((a - g) * 60), sk = ((a - g) * 60 - m) * 60; return `${g}°${m}'${sk.toFixed(1)}"${v >= 0 ? p : n}`; };
      const karte = `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=15/${lat.toFixed(5)}/${lon.toFixed(5)}`;
      return { text: `Dezimal ${lat.toFixed(5)}, ${lon.toFixed(5)}. In Grad: ${zuDms(lat, "N", "S")} ${zuDms(lon, "O", "W")}.`, link: karte, tabelle: { kopf: ["Format", "Wert"], zeilen: [["Dezimal", `${lat.toFixed(6)}, ${lon.toFixed(6)}`], ["Grad/Min/Sek", `${zuDms(lat, "N", "S")} ${zuDms(lon, "E", "W")}`]] } };
    },
  },
  {
    id: "laendervorwahl", titel: "Länder-Vorwahl", icon: "☎️", gruppe: G,
    info: "Telefon-Vorwahl eines Landes – oder welches Land zu einer Vorwahl gehört.",
    felder: [{ k: "suche", label: "Land oder Vorwahl", typ: "text", platzhalter: "Italien  oder  +44" }],
    sprache: [
      [new RegExp(`^(?:was ist |wie ist |welche )?(?:die )?(?:vorwahl|ländervorwahl|telefonvorwahl) (?:von|für|in|nach) ${LAND_RE}$`), (m) => ({ suche: m[1] })],
      [/^(?:welches land hat die vorwahl|wem gehört die vorwahl|vorwahl) (?:plus |\+|00)?(\d{1,4})$/, (m) => ({ suche: "+" + m[1] })],
    ],
    run(e) {
      const q = text(e, "suche", "ein Land oder eine Vorwahl", { max: 40 });
      const v = q.replace(/^00/, "+").replace(/\s/g, "");
      if (/^\+?\d{1,4}$/.test(v)) {
        const n = "+" + v.replace("+", ""), l = Object.entries(LAENDER).filter(([, d]) => d[0] === n).map(([k]) => k);
        return { text: l.length ? `Die Vorwahl ${n} gehört zu ${l.join(" und ")}.` : `Die Vorwahl ${n} habe ich nicht in meiner Liste.` };
      }
      const l = findeLand(q);
      if (!l) throw new Error(`Das Land „${q}“ habe ich nicht in meiner Liste.`);
      return { text: `Die Vorwahl für ${l.name} ist ${l.d[0]}, von Deutschland aus also 00${l.d[0].slice(1)}.` };
    },
  },
  {
    id: "steckdose", titel: "Steckdose im Ausland", icon: "🔌", gruppe: G,
    info: "Welche Steckdosen und Spannung es im Reiseland gibt – und ob du einen Adapter brauchst.",
    felder: [{ k: "land", label: "Land", typ: "wahl", optionen: Object.keys(LAENDER).sort((a, b) => a.localeCompare(b, "de")), standard: "Großbritannien" }],
    sprache: [[new RegExp(`^(?:welche |was für )?(?:steckdosen?|stecker|adapter|reiseadapter) (?:gibt es |hat man |braucht man |brauche ich )?(?:in|für) ${LAND_RE}$|^brauche ich (?:einen )?(?:reise)?adapter (?:in|für) ${LAND_RE}$`), (m) => ({ land: m[1] || m[2] })]],
    run(e) {
      const l = findeLand(e.land);
      if (!l) throw new Error(`Das Land „${e.land}“ habe ich nicht in meiner Liste.`);
      const ok = passtDeutsch(l.d[1]);
      return { text: `${l.name}: Steckertyp ${l.d[1]}, ${l.d[2]}. ${ok ? "Deutsche Stecker passen, du brauchst keinen Adapter." : `Du brauchst einen Reiseadapter.${/1[0-2]\d V/.test(l.d[2]) ? " Achtung, niedrigere Spannung: Föhn und Glätteisen nur, wenn sie 100–240 V können." : ""}`}` };
    },
  },
  {
    id: "trinkgeld_land", titel: "Trinkgeld im Ausland", icon: "💶", gruppe: G,
    info: "Wie viel Trinkgeld man in welchem Land gibt.",
    felder: [{ k: "land", label: "Land", typ: "wahl", optionen: Object.keys(LAENDER).sort((a, b) => a.localeCompare(b, "de")), standard: "USA" }],
    sprache: [[new RegExp(`^(?:wie ?viel )?trinkgeld (?:gibt man )?(?:in|für) ${LAND_RE}$|^wie ?viel trinkgeld gibt man in ${LAND_RE}$`), (m) => ({ land: m[1] || m[2] })]],
    run(e) {
      const l = findeLand(e.land);
      if (!l) throw new Error(`Das Land „${e.land}“ habe ich nicht in meiner Liste.`);
      return { text: `Trinkgeld in ${l.name}: ${l.d[3]}.` };
    },
  },
  {
    id: "kleidergroesse", titel: "Kleider- & Schuhgrößen", icon: "👟", gruppe: G,
    info: "Schuh- und Kleidergrößen zwischen EU, UK, US und Italien umrechnen.",
    felder: [{ k: "art", label: "Was?", typ: "wahl", optionen: ["Schuhe", "Kleidung Damen", "Kleidung Herren"], standard: "Schuhe" }, { k: "groesse", label: "Deutsche/EU-Größe", typ: "zahl" }],
    sprache: [[/^(?:schuhgröße|schuhgrösse) (\d{2}(?:,5)?) (?:in )?(?:us|uk|englisch|amerikanisch)(?:e größe)?$/, (m) => ({ art: "Schuhe", groesse: m[1] })]],
    run(e) {
      const g = zahl(e, "groesse", "die Größe", { min: 16, max: 70 }), r = (x) => Math.round(x * 2) / 2;
      if (e.art === "Kleidung Damen") return { text: `Damengröße ${de(g)}: UK ${de(g - 28)}, US ${de(g - 30)}, Frankreich ${de(g + 2)}, Italien ${de(g + 4)}.` };
      if (e.art === "Kleidung Herren") return { text: `Herrengröße ${de(g)}: US/UK ${de(g - 10)} (Brustumfang in Zoll), Italien ${de(g)}. ${g >= 44 && g <= 58 ? `International etwa ${["XS", "S", "M", "L", "XL", "XXL", "3XL", "3XL"][Math.floor((g - 44) / 2)]}.` : ""}` };
      const uk = r((g - 40) * 0.75 + 6.5);
      return { text: `Schuhgröße EU ${de(g)}: UK ${de(uk)}, US Herren ${de(uk + 1)}, US Damen ${de(uk + 2)}. Fußlänge etwa ${de((g * 2) / 3 - 1.5, 1)} Zentimeter.`, hinweis: "Hersteller weichen oft eine halbe Größe ab." };
    },
  },
  {
    id: "packliste", titel: "Packliste", icon: "🧳", gruppe: G,
    info: "Packliste passend zur Reise: Strand, Stadt, Ski, Wandern, Business, Camping.",
    felder: [{ k: "art", label: "Reise-Art", typ: "wahl", optionen: ["Strand", "Städtetrip", "Ski", "Wandern", "Business", "Camping"], standard: "Strand" }, { k: "tage", label: "Tage", typ: "zahl", standard: "7" }, { k: "flug", label: "Mit dem Flugzeug?", typ: "wahl", optionen: ["ja", "nein"], standard: "ja" }, { k: "ausland", label: "Ins Ausland?", typ: "wahl", optionen: ["ja", "nein"], standard: "ja" }, { k: "kinder", label: "Mit Kindern?", typ: "wahl", optionen: ["nein", "ja"], standard: "nein" }],
    sprache: [[/^(?:mach|mache|erstell|erstelle|schreib)?(?: mir)? ?(?:eine )?packliste(?: für)?(?: (?:einen |eine |ein )?(\d+)[- ]?tage?s?)?(?: (?:für |zum |in den |ins )?(?:den |die |das )?(strand|strandurlaub|badeurlaub|städtetrip|städtereise|stadt|ski|skiurlaub|wandern|wanderurlaub|business|geschäftsreise|dienstreise|camping)\w*)?$/, (m) => ({ tage: m[1] || 7, art: !m[2] ? "Strand" : /strand|bade/.test(m[2]) ? "Strand" : /stadt|städte/.test(m[2]) ? "Städtetrip" : /ski/.test(m[2]) ? "Ski" : /wander/.test(m[2]) ? "Wandern" : /camp/.test(m[2]) ? "Camping" : "Business" })]],
    run(e) {
      const t = Math.round(Math.min(60, Math.max(1, nr(e.tage) || 7))), art = PACK[e.art] ? e.art : "Strand";
      const kl = Math.min(t, 7) + 1;
      const liste = [...PACK.immer.map((x) => (x === "Unterwäsche" || x === "Socken" ? `${x} (${kl}×)` : x)), `T-Shirts/Oberteile (${Math.ceil(kl * 0.8)}×)`, `Hosen/Röcke (${Math.max(2, Math.ceil(t / 3))}×)`, ...PACK[art],
        ...(e.flug !== "nein" ? PACK.Flug : []), ...(e.ausland !== "nein" ? PACK.Ausland : []), ...(e.kinder === "ja" ? PACK.Kinder : []), ...(t > 7 ? ["Waschmittel-Reisetube"] : [])];
      return { text: `Deine Packliste für ${t} Tage ${art} hat ${liste.length} Punkte. Ich zeige sie dir zum Abhaken.`, zeilen: liste, checkliste: true, zeigen: true };
    },
  },
];
