// Kühlschrank- & Reste-Regisseur (v1.106.0)
// Kassenbon (Foto oder Text) → Lebensmittel mit geschätztem Ablaufdatum → Rezepte, bevor etwas schlecht wird
// → fehlende Kleinigkeiten auf die Einkaufsliste (der bestehende Organizer).
// Läuft OHNE Claude: Bon-Text wird hier erkannt, die Texterkennung vom Foto macht der Browser (Tesseract).
// Nur das Lesen eines Bon-Fotos über Claude („KI liest den Bon“) braucht Guthaben.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { teile, tagPlus, findeTag, U } from "./datum.js";

const DATEI = "kuehlschrank";
const leer = { vorrat: [], gewarnt: "" };
const laden = () => ({ ...leer, ...store.load(DATEI, leer) });
const speichern = (d) => store.save(DATEI, d);
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ymd = (t) => `${t.y}-${String(t.m).padStart(2, "0")}-${String(t.d).padStart(2, "0")}`;
const heute = () => ymd(teile());
export function tageBisDatum(s) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const h = teile();
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(h.y, h.m - 1, h.d)) / 86400000);
}
const inTagen = (n) => ymd(tagPlus(n));
const norm = (s) => String(s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// ---------- Lebensmittel: Name, Symbol, typische Haltbarkeit (Tage, im Kühlschrank bzw. Vorrat) ----------
// key = Zutat für Rezepte. alias = Wörter, wie sie auf Kassenbons stehen (ohne Umlaute, klein).
const L = (key, name, icon, tage, kat, alias) => ({ key, name, icon, tage, kat, alias: alias.split("|") });
export const LEBENSMITTEL = [
  L("milch", "Milch", "🥛", 7, "Milchprodukte", "milch|h milch|hmilch|vollmilch|frischmilch|fettarme milch|weidemilch"),
  L("hafermilch", "Hafermilch", "🥛", 7, "Milchprodukte", "haferdrink|hafermilch|oat|sojadrink|mandeldrink"),
  L("joghurt", "Joghurt", "🥣", 14, "Milchprodukte", "joghurt|jogh|yoghurt|skyr|griech joghurt"),
  L("quark", "Quark", "🥣", 10, "Milchprodukte", "quark|magerquark|speisequark"),
  L("sahne", "Sahne", "🥛", 7, "Milchprodukte", "sahne|schlagsahne|kochsahne|creme fraiche|schmand|saure sahne"),
  L("butter", "Butter", "🧈", 30, "Milchprodukte", "butter|suessrahmbutter|kerrygold|margarine|rama"),
  L("kaese", "Käse", "🧀", 21, "Milchprodukte", "kaese|gouda|emmentaler|cheddar|edamer|bergkaese|kaesescheiben|reibekaese|gerieb|parmesan|grana"),
  L("mozzarella", "Mozzarella", "🧀", 7, "Milchprodukte", "mozzarella|mozz|burrata"),
  L("feta", "Feta", "🧀", 14, "Milchprodukte", "feta|hirtenkaese|schafskaese"),
  L("frischkaese", "Frischkäse", "🧀", 14, "Milchprodukte", "frischkaese|philadelphia|exquisa|hüttenkaese|huettenkaese"),
  L("eier", "Eier", "🥚", 21, "Eier", "eier|ei bod|freiland ei|bio eier|10 eier|6 eier|eier m|eier l"),
  L("hackfleisch", "Hackfleisch", "🥩", 1, "Fleisch & Fisch", "hack|hackfleisch|gemischtes hack|rinderhack|hackfl"),
  L("haehnchen", "Hähnchen", "🍗", 2, "Fleisch & Fisch", "haehnchen|haehn|huhn|chicken|putenbrust|pute|haehnchenbrust|geflügel|gefluegel|hähnchen"),
  L("wurst", "Wurst & Aufschnitt", "🥓", 7, "Fleisch & Fisch", "salami|schinken|aufschnitt|wurst|mortadella|lyoner|bierschinken|kochschinken|speck|bacon"),
  L("wuerstchen", "Würstchen", "🌭", 10, "Fleisch & Fisch", "wuerstchen|wiener|bratwurst|frankfurter|bockwurst|nuernberger"),
  L("rind", "Rindfleisch", "🥩", 3, "Fleisch & Fisch", "rind|steak|gulasch|rinderhuefte|entrecote|schnitzel|schwein|kotelett|nackensteak"),
  L("lachs", "Lachs/Fisch", "🐟", 2, "Fleisch & Fisch", "lachs|fisch|forelle|kabeljau|seelachs|thunfisch frisch|garnelen|shrimps"),
  L("tofu", "Tofu", "🧊", 10, "Vegetarisch", "tofu|seitan|veggie|vegan hack|beyond|rügenwalder vegan"),
  L("brot", "Brot", "🍞", 4, "Backwaren", "brot|vollkorn|baguette|ciabatta|toast|broetchen|semmel|brezel|laugen|bauernbrot|wraps|tortilla"),
  L("salat", "Salat", "🥬", 4, "Gemüse", "salat|eisberg|rucola|feldsalat|kopfsalat|romana|babyspinat|spinat|salatmix"),
  L("tomaten", "Tomaten", "🍅", 7, "Gemüse", "tomate|tomaten|cherry|rispentomate|cocktailtomate|strauchtomate"),
  L("gurke", "Gurke", "🥒", 7, "Gemüse", "gurke|salatgurke|mini gurke"),
  L("paprika", "Paprika", "🫑", 8, "Gemüse", "paprika|spitzpaprika"),
  L("zucchini", "Zucchini", "🥒", 7, "Gemüse", "zucchini"),
  L("brokkoli", "Brokkoli", "🥦", 5, "Gemüse", "brokkoli|broccoli|blumenkohl"),
  L("karotten", "Karotten", "🥕", 21, "Gemüse", "karotte|karotten|moehre|moehren|rüebli"),
  L("pilze", "Champignons", "🍄", 4, "Gemüse", "champignon|pilze|egerlinge|champ"),
  L("zwiebeln", "Zwiebeln", "🧅", 30, "Gemüse", "zwiebel|zwiebeln|schalotte|lauchzwiebel|fruehlingszwiebel"),
  L("knoblauch", "Knoblauch", "🧄", 30, "Gemüse", "knoblauch"),
  L("kartoffeln", "Kartoffeln", "🥔", 30, "Gemüse", "kartoffel|kartoffeln|drillinge|suesskartoffel"),
  L("lauch", "Lauch", "🥬", 10, "Gemüse", "lauch|porree"),
  L("mais", "Mais", "🌽", 365, "Vorrat", "mais"),
  L("avocado", "Avocado", "🥑", 4, "Obst", "avocado"),
  L("aepfel", "Äpfel", "🍎", 21, "Obst", "apfel|aepfel|elstar|braeburn|pink lady|jonagold|gala"),
  L("bananen", "Bananen", "🍌", 6, "Obst", "banane|bananen|bio banane"),
  L("beeren", "Beeren", "🍓", 3, "Obst", "erdbeere|erdbeeren|himbeere|heidelbeere|blaubeere|beeren"),
  L("zitrone", "Zitronen", "🍋", 21, "Obst", "zitrone|zitronen|limette|limetten"),
  L("orangen", "Orangen", "🍊", 14, "Obst", "orange|orangen|mandarine|clementine"),
  L("trauben", "Trauben", "🍇", 6, "Obst", "trauben|weintrauben"),
  L("nudeln", "Nudeln", "🍝", 365, "Vorrat", "nudeln|spaghetti|penne|fusilli|farfalle|pasta|tagliatelle|lasagne"),
  L("reis", "Reis", "🍚", 365, "Vorrat", "reis|basmati|jasmin|risotto"),
  L("passierte", "Passierte Tomaten", "🥫", 365, "Vorrat", "passierte|tomatenmark|dosentomaten|stueckige tomaten|pizzatomaten|tomatensauce|tomatensoße"),
  L("bohnen", "Bohnen/Kichererbsen", "🥫", 365, "Vorrat", "kidney|bohnen|kichererbsen|linsen"),
  L("mehl", "Mehl", "🌾", 365, "Vorrat", "mehl|weizenmehl"),
  L("haferflocken", "Haferflocken", "🥣", 365, "Vorrat", "haferflocken|muesli|müsli|cornflakes"),
  L("thunfisch", "Thunfisch (Dose)", "🥫", 365, "Vorrat", "thunfisch"),
  L("pesto", "Pesto", "🫙", 10, "Vorrat", "pesto"),
  L("kokosmilch", "Kokosmilch", "🥥", 365, "Vorrat", "kokosmilch|kokos"),
  L("tiefkuehl", "Tiefkühlware", "🧊", 90, "Tiefkühl", "tk |tiefkuehl|pizza|fischstaebchen|pommes|rahmspinat|tk gemuese|eis "),
];
const BASIS = new Set(["salz", "pfeffer", "oel", "wasser", "zucker", "gewuerze", "essig", "bruehe"]);
// Kein Lebensmittel: Pfand, Tüten, Summen, Zahlungsarten …
const KEIN_ESSEN = /\b(pfand|leergut|tuete|tragetasche|summe|zwischensumme|gesamt|bar|ec |ec-|karte|girocard|visa|mastercard|mwst|ust|netto|brutto|rueckgeld|gegeben|bonus|payback|rabatt|coupon|kasse|filiale|uhrzeit|datum|beleg|steuer|danke|vielen dank|www|tel|zahlung|betrag|kundenkarte|punkte|batterie|spuelmittel|klopapier|toilettenpapier|waschmittel|shampoo|duschgel|zahnpasta|kuechenrolle|taschentuch|zigaretten)\b/;

/** Erkennt ein Lebensmittel in einer Zeile (Bon oder Satz). */
export function erkenne(zeile) {
  const n = ` ${norm(zeile)} `;
  if (!n.trim() || KEIN_ESSEN.test(n)) return null;
  let best = null;
  for (const l of LEBENSMITTEL) {
    for (const a of l.alias) {
      const an = norm(a);
      if (!an) continue;
      // Wortanfang reicht ("jogh" passt auf "joghurt natur")
      const i = n.indexOf(` ${an}`);
      if (i >= 0 && (!best || an.length > best.len)) best = { l, len: an.length };
    }
  }
  return best?.l || null;
}

/** Kassenbon-Text → erkannte Lebensmittel (Vorschau, noch nicht gespeichert). */
export function bonLesen(text) {
  const zeilen = String(text || "").split(/\r?\n/).map((z) => z.trim()).filter(Boolean);
  const gefunden = new Map();
  const unbekannt = [];
  for (const z of zeilen) {
    // Nur Zeilen mit Buchstaben; Preise und Mengen weg.
    const ohne = z.replace(/-?\d+[,.]\d{2}\s*(€|eur|[ab])?\s*$/i, "").replace(/\b\d+\s*(x|stk|st|g|kg|ml|l)\b/gi, " ").trim();
    if (!/[a-zäöü]{3,}/i.test(ohne)) continue;
    const l = erkenne(ohne);
    if (!l) { if (!KEIN_ESSEN.test(` ${norm(ohne)} `) && unbekannt.length < 30 && /[a-z]{3,}/i.test(ohne) && !/\d{4,}/.test(ohne)) unbekannt.push(ohne.slice(0, 40)); continue; }
    const g = gefunden.get(l.key);
    if (g) g.menge += 1;
    else gefunden.set(l.key, { key: l.key, name: l.name, icon: l.icon, kategorie: l.kat, menge: 1, ablauf: inTagen(l.tage), bon: ohne.slice(0, 40) });
  }
  return { posten: [...gefunden.values()], unbekannt };
}

// ---------- Vorrat ----------
export function vorrat() {
  const d = laden();
  return d.vorrat
    .map((v) => ({ ...v, tage: tageBisDatum(v.ablauf) }))
    .sort((a, b) => (a.tage ?? 999) - (b.tage ?? 999));
}
export function hinzufuegen(posten = [], quelle = "hand") {
  const d = laden();
  const neu = [];
  for (const p of [].concat(posten)) {
    const name = String(p.name || "").trim().slice(0, 60);
    if (!name) continue;
    const l = LEBENSMITTEL.find((x) => x.key === p.key) || erkenne(name);
    const ablauf = /^\d{4}-\d{2}-\d{2}$/.test(p.ablauf || "") ? p.ablauf : inTagen(l?.tage ?? 7);
    // Gleiches Lebensmittel mit gleichem Datum: Menge erhöhen
    const gleich = d.vorrat.find((v) => v.key && v.key === (l?.key || p.key) && v.ablauf === ablauf);
    if (gleich) { gleich.menge = (gleich.menge || 1) + (Number(p.menge) || 1); neu.push(gleich); continue; }
    const e = { id: neueId(), key: l?.key || p.key || norm(name).replace(/ /g, "_"), name, icon: p.icon || l?.icon || "🍽", kategorie: l?.kat || p.kategorie || "Sonstiges", menge: Math.max(1, Math.min(99, Number(p.menge) || 1)), ablauf, hinzu: new Date().toISOString(), quelle };
    d.vorrat.push(e);
    neu.push(e);
  }
  d.vorrat = d.vorrat.slice(-300);
  speichern(d);
  if (neu.length) logbuch.eintragen({ bereich: "kuehlschrank", titel: `Kühlschrank: ${neu.map((x) => x.name).join(", ")} eingeräumt`, quelle });
  return neu;
}
export function aendern(id, felder = {}) {
  const d = laden();
  const v = d.vorrat.find((x) => x.id === id);
  if (!v) return null;
  if (felder.ablauf && /^\d{4}-\d{2}-\d{2}$/.test(felder.ablauf)) v.ablauf = felder.ablauf;
  if (felder.menge != null) v.menge = Math.max(1, Math.min(99, Number(felder.menge) || 1));
  if (felder.name) v.name = String(felder.name).slice(0, 60);
  speichern(d);
  return v;
}
export function entfernen(id, grund = "verbraucht") {
  const d = laden();
  const v = d.vorrat.find((x) => x.id === id);
  if (!v) return false;
  d.vorrat = d.vorrat.filter((x) => x.id !== id);
  d.statistik = d.statistik || { verbraucht: 0, weggeworfen: 0 };
  d.statistik[grund === "weg" ? "weggeworfen" : "verbraucht"]++;
  speichern(d);
  logbuch.eintragen({ bereich: "kuehlschrank", titel: `Kühlschrank: ${v.name} ${grund === "weg" ? "weggeworfen" : "verbraucht"}` });
  return true;
}
export function statistik() { return laden().statistik || { verbraucht: 0, weggeworfen: 0 }; }

// ---------- Rezepte (eingebaut, ohne Claude) ----------
const R = (name, icon, minuten, zutaten, optional, schritte) => ({ name, icon, minuten, zutaten: zutaten.split(" "), optional: optional ? optional.split(" ") : [], schritte });
export const REZEPTE = [
  R("Pfannkuchen", "🥞", 20, "milch eier mehl", "bananen beeren aepfel", ["Mehl, Milch, Eier und eine Prise Salz glatt rühren.", "In wenig Öl dünne Pfannkuchen backen.", "Mit Obst oder Zucker servieren."]),
  R("Rührei mit Brot", "🍳", 10, "eier brot", "tomaten kaese schinken wurst lauch", ["Eier verquirlen, salzen, pfeffern.", "In Butter bei mittlerer Hitze stocken lassen.", "Mit Brot und Resten (Tomaten, Käse) servieren."]),
  R("Omelett mit Gemüse", "🍳", 15, "eier", "paprika zucchini pilze tomaten kaese zwiebeln brokkoli", ["Gemüse klein schneiden und anbraten.", "Verquirlte Eier darüber gießen.", "Zugedeckt stocken lassen, Käse darüber."]),
  R("Spaghetti Bolognese", "🍝", 35, "hackfleisch nudeln passierte", "zwiebeln karotten knoblauch kaese", ["Zwiebel, Karotte, Knoblauch anbraten, Hack krümelig braten.", "Passierte Tomaten dazu, 20 Minuten köcheln.", "Mit Nudeln und Käse servieren."]),
  R("Chili con Carne", "🌶", 40, "hackfleisch bohnen passierte", "mais paprika zwiebeln knoblauch reis", ["Hack mit Zwiebeln anbraten.", "Paprika, Bohnen, Mais und Tomaten dazu.", "Mit Chili würzen, 25 Minuten köcheln, mit Reis oder Brot."]),
  R("Frikadellen", "🍔", 30, "hackfleisch eier brot", "zwiebeln kartoffeln salat", ["Altes Brot einweichen, ausdrücken.", "Mit Hack, Ei, Zwiebel, Salz und Pfeffer kneten.", "Flache Bällchen formen und von beiden Seiten braten."]),
  R("Hähnchen-Curry", "🍛", 30, "haehnchen kokosmilch reis", "paprika zucchini brokkoli karotten zwiebeln", ["Hähnchen würfeln und anbraten.", "Gemüse dazu, mit Currypulver bestäuben.", "Kokosmilch angießen, 15 Minuten köcheln, mit Reis."]),
  R("Hähnchen-Pfanne mit Gemüse", "🍗", 25, "haehnchen", "paprika zucchini brokkoli pilze reis nudeln sahne", ["Hähnchen in Streifen anbraten.", "Gemüse dazu und mitbraten.", "Mit Sahne oder Brühe ablöschen, mit Reis oder Nudeln."]),
  R("Gemüse-Reispfanne", "🍚", 25, "reis", "paprika zucchini karotten brokkoli eier mais lauch pilze", ["Reis kochen (gern vom Vortag).", "Gemüse anbraten, Reis dazu.", "Mit Sojasoße würzen, ein Ei unterrühren."]),
  R("Nudeln mit Tomatensoße", "🍅", 20, "nudeln passierte", "zwiebeln knoblauch kaese mozzarella zucchini", ["Nudeln kochen.", "Zwiebel und Knoblauch anschwitzen, Tomaten dazu, würzen.", "Mit Käse servieren."]),
  R("Pasta mit Pesto", "🌿", 15, "nudeln pesto", "tomaten mozzarella kaese", ["Nudeln kochen.", "Mit Pesto mischen.", "Tomaten und Käse darüber."]),
  R("Käse-Sahne-Nudeln", "🧀", 20, "nudeln sahne kaese", "schinken wurst brokkoli pilze lauch", ["Nudeln kochen.", "Sahne erhitzen, Käse darin schmelzen.", "Reste wie Schinken oder Brokkoli unterheben."]),
  R("Nudelauflauf", "🫕", 45, "nudeln kaese sahne", "eier schinken wurst brokkoli tomaten zucchini", ["Nudeln vorkochen, mit Resten in eine Form.", "Sahne mit Ei verquirlen, darüber gießen.", "Käse drauf, 25 Minuten bei 200 Grad backen."]),
  R("Bratkartoffeln mit Spiegelei", "🥔", 30, "kartoffeln eier", "zwiebeln speck wurst gurke", ["Gekochte Kartoffeln in Scheiben schneiden.", "Mit Zwiebeln und Speck knusprig braten.", "Spiegelei dazu."]),
  R("Kartoffelsuppe", "🥣", 40, "kartoffeln karotten", "lauch zwiebeln wuerstchen sahne", ["Gemüse würfeln, in Brühe 20 Minuten kochen.", "Teilweise pürieren, mit Sahne verfeinern.", "Würstchen in Scheiben dazu."]),
  R("Gemüsesuppe (Resteküche)", "🍲", 35, "karotten", "kartoffeln zucchini lauch brokkoli paprika tomaten zwiebeln nudeln", ["Alles Gemüse klein schneiden.", "In Brühe 20 Minuten köcheln.", "Würzen, nach Wunsch pürieren."]),
  R("Bunter Salat", "🥗", 10, "salat", "tomaten gurke paprika feta mais eier avocado haehnchen", ["Salat waschen, Gemüse schneiden.", "Mit Öl, Essig, Salz und Pfeffer anmachen.", "Feta oder Ei obendrauf."]),
  R("Griechischer Salat", "🥗", 10, "tomaten gurke feta", "paprika zwiebeln salat", ["Gemüse grob würfeln.", "Feta darüber bröseln.", "Mit Olivenöl und Oregano."]),
  R("Caprese", "🍅", 5, "tomaten mozzarella", "pesto brot", ["Tomaten und Mozzarella in Scheiben.", "Abwechselnd legen, salzen, pfeffern.", "Mit Öl oder Pesto beträufeln."]),
  R("Toast Hawaii / Überbackenes Brot", "🍞", 15, "brot kaese", "schinken wurst tomaten", ["Brot belegen.", "Käse obendrauf.", "Im Ofen bei 200 Grad 10 Minuten überbacken."]),
  R("Arme Ritter (French Toast)", "🍞", 15, "brot eier milch", "beeren bananen", ["Eier mit Milch und Zimt verquirlen.", "Altes Brot darin tränken.", "In Butter goldbraun braten."]),
  R("Wraps mit Resten", "🌯", 15, "brot", "haehnchen salat tomaten gurke kaese paprika mais bohnen", ["Wraps oder Fladenbrot kurz erwärmen.", "Mit Resten füllen.", "Mit Joghurt-Soße einrollen."]),
  R("Quiche / Gemüsekuchen", "🥧", 50, "eier sahne kaese mehl butter", "lauch brokkoli zucchini pilze schinken", ["Mürbeteig aus Mehl, Butter, Wasser.", "Gemüse darauf, Eier mit Sahne darüber.", "Käse drauf, 35 Minuten bei 180 Grad."]),
  R("Shakshuka", "🍳", 25, "eier passierte", "paprika zwiebeln knoblauch feta brot", ["Paprika und Zwiebel anbraten.", "Tomaten dazu, würzen, Mulden formen.", "Eier hineinschlagen, zugedeckt stocken lassen."]),
  R("Pilzpfanne mit Knödel/Brot", "🍄", 20, "pilze sahne", "zwiebeln brot nudeln", ["Pilze kräftig anbraten.", "Zwiebeln dazu, mit Sahne ablöschen.", "Mit Brot oder Nudeln servieren."]),
  R("Lachs mit Gemüse", "🐟", 25, "lachs", "brokkoli zucchini kartoffeln reis zitrone", ["Lachs würzen, von beiden Seiten braten.", "Gemüse dämpfen oder braten.", "Mit Zitrone und Reis oder Kartoffeln."]),
  R("Tofu-Gemüse-Pfanne", "🥢", 25, "tofu", "paprika brokkoli karotten reis zwiebeln pilze", ["Tofu würfeln, knusprig braten.", "Gemüse dazu.", "Mit Sojasoße, mit Reis servieren."]),
  R("Bananenbrot", "🍌", 60, "bananen mehl eier butter", "haferflocken", ["Reife Bananen zerdrücken.", "Mit Butter, Eiern, Zucker und Mehl verrühren.", "50 Minuten bei 175 Grad backen."]),
  R("Overnight Oats", "🥣", 5, "haferflocken joghurt", "milch beeren bananen aepfel", ["Haferflocken mit Joghurt und Milch mischen.", "Über Nacht kalt stellen.", "Mit Obst essen."]),
  R("Obstsalat", "🍓", 10, "aepfel bananen", "beeren orangen trauben joghurt zitrone", ["Obst klein schneiden.", "Mit Zitronensaft mischen.", "Mit Joghurt servieren."]),
  R("Smoothie", "🥤", 5, "bananen", "beeren joghurt milch haferflocken aepfel salat", ["Alles in den Mixer.", "Mit Milch oder Wasser auffüllen.", "Kurz mixen, fertig."]),
  R("Quark-Dip mit Ofenkartoffeln", "🥔", 40, "kartoffeln quark", "gurke knoblauch zwiebeln", ["Kartoffeln halbieren, mit Öl 30 Minuten backen.", "Quark mit Kräutern, Salz und Knoblauch verrühren.", "Zusammen servieren."]),
  R("Wurstsalat", "🥓", 10, "wurst zwiebeln", "gurke kaese", ["Wurst in Streifen schneiden.", "Mit Zwiebeln und Gurke mischen.", "Mit Essig und Öl anmachen."]),
  R("Würstchen mit Kartoffelsalat", "🌭", 30, "wuerstchen kartoffeln", "gurke zwiebeln eier", ["Kartoffeln kochen, pellen, schneiden.", "Mit Brühe, Essig, Öl und Zwiebeln anmachen.", "Würstchen erhitzen."]),
];

/** Rezepte, die möglichst viel von dem verwerten, was bald abläuft. */
export function rezepte({ limit = 6 } = {}) {
  const v = vorrat();
  const hab = new Map();
  for (const x of v) {
    const t = x.tage ?? 30;
    const dring = t <= 0 ? 6 : t <= 1 ? 5 : t <= 2 ? 4 : t <= 4 ? 2 : 1;
    hab.set(x.key, Math.max(hab.get(x.key) || 0, dring));
  }
  const raus = REZEPTE.map((r) => {
    const fehlt = r.zutaten.filter((z) => !hab.has(z) && !BASIS.has(z));
    const genutzt = [...r.zutaten, ...r.optional].filter((z) => hab.has(z));
    const punkte = genutzt.reduce((s, z) => s + hab.get(z), 0) - fehlt.length * 3;
    const rettet = genutzt.filter((z) => hab.get(z) >= 4);
    return { ...r, fehlt: fehlt.map(zutatName), genutzt: genutzt.map(zutatName), rettet: rettet.map(zutatName), punkte };
  }).filter((r) => r.genutzt.length > 0 && r.fehlt.length <= 2)
    .sort((a, b) => b.punkte - a.punkte || a.fehlt.length - b.fehlt.length || a.minuten - b.minuten);
  return raus.slice(0, limit);
}
export const zutatName = (key) => LEBENSMITTEL.find((l) => l.key === key)?.name || key;

export function aufEinkaufsliste(namen = []) {
  const vorhanden = new Set(store.getShopping().filter((s) => !s.done).map((s) => norm(s.text)));
  const neu = [];
  for (const n of [].concat(namen)) {
    const t = String(n || "").trim().slice(0, 60);
    if (!t || vorhanden.has(norm(t))) continue;
    store.addShopping(t);
    vorhanden.add(norm(t));
    neu.push(t);
  }
  return neu;
}

// ---------- Warnung: was muss weg? ----------
export function baldWeg(tage = 2) { return vorrat().filter((x) => x.tage != null && x.tage <= tage); }
function baldSatz(liste) {
  const teil = (x) => `${x.name} ${x.tage < 0 ? "ist abgelaufen" : x.tage === 0 ? "heute" : x.tage === 1 ? "morgen" : `in ${x.tage} Tagen`}`;
  return liste.slice(0, 5).map(teil).join(", ");
}

/** Einmal am Tag (ab 9 Uhr) eine Mitteilung, wenn etwas bald abläuft. */
export async function taeglichPruefen(notifyAll) {
  const t = teile();
  if (t.h < 9) return;
  const d = laden();
  if (d.gewarnt === heute()) return;
  const bald = baldWeg(1);
  d.gewarnt = heute();
  speichern(d);
  if (!bald.length) return;
  const r = rezepte({ limit: 1 })[0];
  const text = `Kühlschrank: ${baldSatz(bald)}.${r ? ` Idee: ${r.name} (${r.minuten} Min.).` : ""}`;
  try { await notifyAll?.("🧊 Reste-Regisseur", text); } catch { /* egal */ }
  logbuch.eintragen({ bereich: "kuehlschrank", titel: "Kühlschrank-Warnung verschickt", details: text });
}

// ---------- Sprache ----------
function vorbereiten(text) {
  return String(text || "").toLowerCase().replace(/[„“”"!?;]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/, "").trim();
}
const OEFFNEN = U(/^(öffne|oeffne|zeig|zeige)( mir)?( den| meinen| das| die)? (kühlschrank|kuehlschrank|reste regisseur|reste-regisseur|resteregisseur|vorrat|vorratsliste)\b/);
const WAS_WEG = U(/\b(was muss (weg|bald weg|gegessen werden)|was läuft (bald )?ab|was laeuft (bald )?ab|was wird schlecht|was verdirbt|läuft (etwas|was) ab)\b/);
const KOCHEN = U(/\b(was (kann|soll) ich (heute |jetzt |damit )?(kochen|essen|machen)|rezept(e)? (aus|mit) (resten|dem kühlschrank|dem kuehlschrank)|resteessen|reste verwerten|reste-rezept|was koche ich)\b/);
const GEKAUFT = U(/\b(ich habe|ich hab|hab|habe) (\S.*?) (gekauft|eingekauft|besorgt|mitgebracht)\b/);
const IN_KUEHL = U(/^(leg|pack|tu|trag)e? (\S.*?) (in den|in meinen|zum) (kühlschrank|kuehlschrank|vorrat)\b/);
const ABLAUF = U(/^(?:die |der |das |mein |meine )?(\S.*?) (läuft|laeuft|ist haltbar bis|hält bis|haelt bis) (.+?)( ab)?$/);
const LEER = U(/^(?:die |der |das |mein |meine )?(\S.*?) (ist|sind) (leer|alle|aufgebraucht|verbraucht|weg|gegessen|schlecht|abgelaufen)$/);

function zerlege(liste) {
  return liste.split(/,| und | sowie /).map((s) => s.replace(/^(eine?n?|ein|zwei|drei|vier|fünf|sechs|\d+|etwas|bisschen|packung|flasche|beutel|dose|kilo|liter)\s+/g, "").trim()).filter((s) => s.length > 1);
}

export function quickCommand(text) {
  const t = vorbereiten(text);
  if (!t) return null;
  if (OEFFNEN.test(t)) {
    const b = baldWeg(2);
    return { answer: b.length ? `Der Kühlschrank ist offen. Bald weg muss: ${baldSatz(b)}.` : "Der Kühlschrank ist offen. Gerade läuft nichts ab.", actions: ["kuehlschrank"] };
  }
  if (WAS_WEG.test(t)) {
    const b = baldWeg(3);
    if (!vorrat().length) return { answer: "Ich kenne deinen Kühlschrank noch nicht. Fotografier einen Kassenbon im Kühlschrank-Fenster oder sag: Ich habe Milch und Eier gekauft.", actions: ["kuehlschrank"] };
    return { answer: b.length ? `Bald weg muss: ${baldSatz(b)}.` : "Nichts läuft in den nächsten drei Tagen ab. Alles frisch, Boss.", actions: ["kuehlschrank"] };
  }
  if (KOCHEN.test(t)) {
    const r = rezepte({ limit: 3 });
    if (!r.length) return { answer: vorrat().length ? "Mit dem, was da ist, finde ich kein passendes Rezept. Im Kühlschrank-Fenster siehst du, was fehlt." : "Ich weiß noch nicht, was in deinem Kühlschrank ist. Sag zum Beispiel: Ich habe Hackfleisch, Nudeln und Tomaten gekauft.", actions: ["kuehlschrank"] };
    const a = r[0];
    const fehlt = a.fehlt.length ? ` Dafür fehlt nur ${a.fehlt.join(" und ")}.` : " Alles dafür ist da.";
    const rettet = a.rettet.length ? `, damit rettest du ${a.rettet.join(" und ")}` : "";
    return { answer: `Mein Vorschlag: ${a.name}, ${a.minuten} Minuten${rettet}.${fehlt}${r[1] ? ` Oder ${r[1].name}.` : ""}`, actions: ["kuehlschrank", "kuehlschrank:rezepte"] };
  }
  let m = t.match(GEKAUFT) || t.match(IN_KUEHL);
  if (m) {
    const teile_ = zerlege(m[2]);
    const posten = teile_.map((n) => { const l = erkenne(n); return l ? { key: l.key, name: l.name } : { name: n.charAt(0).toUpperCase() + n.slice(1) }; });
    const neu = hinzufuegen(posten, "sprache");
    if (!neu.length) return null;
    return { answer: `Eingeräumt: ${neu.map((x) => x.name).join(", ")}. Ich passe auf die Ablaufdaten auf.`, actions: ["kuehlschrank"] };
  }
  if ((m = t.match(ABLAUF))) {
    const l = erkenne(m[1]);
    const tag = findeTag(m[3]);
    const v = vorrat().find((x) => (l && x.key === l.key) || norm(x.name) === norm(m[1]));
    if (l && tag) {
      const datum = ymd(tag.tag);
      if (v) aendern(v.id, { ablauf: datum }); else hinzufuegen([{ key: l.key, name: l.name, ablauf: datum }], "sprache");
      return { answer: `Notiert: ${l.name} läuft ${tag.plus === 0 ? "heute" : tag.plus === 1 ? "morgen" : `in ${tag.plus} Tagen`} ab.`, actions: ["kuehlschrank"] };
    }
  }
  if ((m = t.match(LEER))) {
    const l = erkenne(m[1]);
    const v = l && vorrat().find((x) => x.key === l.key);
    if (v) {
      entfernen(v.id, /schlecht|abgelaufen/.test(m[3]) ? "weg" : "verbraucht");
      const nachkaufen = !/schlecht|abgelaufen/.test(m[3]);
      if (nachkaufen) aufEinkaufsliste([v.name]);
      return { answer: `${v.name} ist raus aus dem Kühlschrank${nachkaufen ? " und steht auf der Einkaufsliste" : ""}.`, actions: ["kuehlschrank", ...(nachkaufen ? ["add_shopping"] : [])] };
    }
  }
  return null;
}
