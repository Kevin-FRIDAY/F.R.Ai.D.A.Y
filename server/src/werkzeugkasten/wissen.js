// Wissen & Sprache: kostenlose Dienste ohne Schlüssel (OpenThesaurus, LanguageTool, Open Library) und ein eigenes Periodensystem.
import { text, holeJson, nr, de } from "./hilfe.js";

const G = "Wissen & Sprache";

const PSE = ("H Wasserstoff 1.008|He Helium 4.0026|Li Lithium 6.94|Be Beryllium 9.0122|B Bor 10.81|C Kohlenstoff 12.011|N Stickstoff 14.007|O Sauerstoff 15.999|F Fluor 18.998|Ne Neon 20.180|"
  + "Na Natrium 22.990|Mg Magnesium 24.305|Al Aluminium 26.982|Si Silicium 28.085|P Phosphor 30.974|S Schwefel 32.06|Cl Chlor 35.45|Ar Argon 39.948|K Kalium 39.098|Ca Calcium 40.078|"
  + "Sc Scandium 44.956|Ti Titan 47.867|V Vanadium 50.942|Cr Chrom 51.996|Mn Mangan 54.938|Fe Eisen 55.845|Co Cobalt 58.933|Ni Nickel 58.693|Cu Kupfer 63.546|Zn Zink 65.38|"
  + "Ga Gallium 69.723|Ge Germanium 72.630|As Arsen 74.922|Se Selen 78.971|Br Brom 79.904|Kr Krypton 83.798|Rb Rubidium 85.468|Sr Strontium 87.62|Y Yttrium 88.906|Zr Zirconium 91.224|"
  + "Nb Niob 92.906|Mo Molybdän 95.95|Tc Technetium 98|Ru Ruthenium 101.07|Rh Rhodium 102.91|Pd Palladium 106.42|Ag Silber 107.87|Cd Cadmium 112.41|In Indium 114.82|Sn Zinn 118.71|"
  + "Sb Antimon 121.76|Te Tellur 127.60|I Iod 126.90|Xe Xenon 131.29|Cs Caesium 132.91|Ba Barium 137.33|La Lanthan 138.91|Ce Cer 140.12|Pr Praseodym 140.91|Nd Neodym 144.24|"
  + "Pm Promethium 145|Sm Samarium 150.36|Eu Europium 151.96|Gd Gadolinium 157.25|Tb Terbium 158.93|Dy Dysprosium 162.50|Ho Holmium 164.93|Er Erbium 167.26|Tm Thulium 168.93|Yb Ytterbium 173.05|"
  + "Lu Lutetium 174.97|Hf Hafnium 178.49|Ta Tantal 180.95|W Wolfram 183.84|Re Rhenium 186.21|Os Osmium 190.23|Ir Iridium 192.22|Pt Platin 195.08|Au Gold 196.97|Hg Quecksilber 200.59|"
  + "Tl Thallium 204.38|Pb Blei 207.2|Bi Bismut 208.98|Po Polonium 209|At Astat 210|Rn Radon 222|Fr Francium 223|Ra Radium 226|Ac Actinium 227|Th Thorium 232.04|"
  + "Pa Protactinium 231.04|U Uran 238.03|Np Neptunium 237|Pu Plutonium 244|Am Americium 243|Cm Curium 247|Bk Berkelium 247|Cf Californium 251|Es Einsteinium 252|Fm Fermium 257|"
  + "Md Mendelevium 258|No Nobelium 259|Lr Lawrencium 266|Rf Rutherfordium 267|Db Dubnium 268|Sg Seaborgium 269|Bh Bohrium 270|Hs Hassium 269|Mt Meitnerium 278|Ds Darmstadtium 281|"
  + "Rg Roentgenium 282|Cn Copernicium 285|Nh Nihonium 286|Fl Flerovium 289|Mc Moscovium 290|Lv Livermorium 293|Ts Tenness 294|Og Oganesson 294")
  .split("|").map((z, i) => { const [sym, name, masse] = z.split(" "); return { nr: i + 1, sym, name, masse: +masse }; });
const GASE = new Set(["H", "He", "N", "O", "F", "Ne", "Cl", "Ar", "Kr", "Xe", "Rn"]), FLUESSIG = new Set(["Br", "Hg"]);
const ALIAS = { gold: "Au", silber: "Ag", eisen: "Fe", kupfer: "Cu", blei: "Pb", zinn: "Sn", quecksilber: "Hg", uran: "U", natrium: "Na", kalium: "K", sauerstoff: "O", wasserstoff: "H", stickstoff: "N", kohlenstoff: "C", silizium: "Si", jod: "I", cäsium: "Cs", kobalt: "Co", chrom: "Cr", zirkonium: "Zr", kalzium: "Ca", wismut: "Bi" };
export function findeElement(q) {
  const s = String(q || "").trim();
  if (/^\d+$/.test(s)) return PSE[+s - 1] || null;
  const l = s.toLowerCase();
  return PSE.find((e) => e.sym.toLowerCase() === l) || PSE.find((e) => e.name.toLowerCase() === l) || (ALIAS[l] ? PSE.find((e) => e.sym === ALIAS[l]) : null) || null;
}

export default [
  {
    id: "synonyme", titel: "Synonyme finden", icon: "📖", gruppe: G,
    info: "Andere Wörter mit gleicher Bedeutung (OpenThesaurus, kostenlos).",
    felder: [{ k: "wort", label: "Wort", typ: "text" }],
    sprache: [[/^(?:was ist )?(?:ein |das )?(?:anderes wort|synonyme?|alternativen?|ein anderer begriff) (?:für|zu) ([a-zäöüß -]{2,40})$/, (m) => ({ wort: m[1] })]],
    async run(e) {
      const w = text(e, "wort", "ein Wort", { max: 60 });
      const d = await holeJson(`https://www.openthesaurus.de/synonyme/search?format=application/json&q=${encodeURIComponent(w)}`);
      const gruppen = (d.synsets || []).map((s) => (s.terms || []).map((t) => t.term).filter((t) => t.toLowerCase() !== w.toLowerCase())).filter((g) => g.length);
      if (!gruppen.length) return { text: `Für „${w}“ habe ich keine Synonyme gefunden.` };
      const alle = [...new Set(gruppen.flat())];
      return { text: `Statt „${w}“ kannst du sagen: ${alle.slice(0, 8).join(", ")}.`, zeilen: gruppen.slice(0, 8).map((g) => g.join(" · ")), quelle: "OpenThesaurus.de" };
    },
  },
  {
    id: "rechtschreibung", titel: "Rechtschreibung prüfen", icon: "✔️", gruppe: G,
    info: "Findet Rechtschreib- und Grammatikfehler (LanguageTool, kostenlos). Der Text wird dafür an LanguageTool geschickt.",
    felder: [{ k: "text", label: "Text", typ: "textarea" }],
    async run(e) {
      const t = text(e, "text", "einen Text", { max: 15000 });
      const body = new URLSearchParams({ text: t, language: "de-DE" });
      const d = await holeJson("https://api.languagetool.org/v2/check", { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 15000 });
      const fehler = (d.matches || []).filter((m) => m.length > 0);
      if (!fehler.length) return { text: "Ich habe keine Fehler gefunden. Sieht gut aus!", ergebnis: t };
      let korr = t;
      for (const m of [...fehler].sort((a, b) => b.offset - a.offset)) { const r = m.replacements?.[0]?.value; if (r != null) korr = korr.slice(0, m.offset) + r + korr.slice(m.offset + m.length); }
      return {
        text: `Ich habe ${fehler.length} ${fehler.length === 1 ? "mögliche Stelle" : "mögliche Stellen"} gefunden. Die korrigierte Fassung steht im Fenster.`,
        tabelle: { kopf: ["Stelle", "Hinweis", "Vorschlag"], zeilen: fehler.slice(0, 50).map((m) => [t.slice(m.offset, m.offset + m.length), m.message, (m.replacements || []).slice(0, 3).map((r) => r.value).join(", ") || "–"]) },
        ergebnis: korr, quelle: "LanguageTool",
      };
    },
  },
  {
    id: "buch_suchen", titel: "Buch-Suche", icon: "📚", gruppe: G,
    info: "Bücher nach Titel, Autor oder ISBN finden (Open Library, kostenlos).",
    felder: [{ k: "suche", label: "Titel, Autor oder ISBN", typ: "text" }],
    async run(e) {
      const q = text(e, "suche", "einen Suchbegriff", { max: 120 }), isbn = q.replace(/[-\s]/g, "");
      const url = /^\d{9}[\dXx]$|^\d{13}$/.test(isbn) ? `https://openlibrary.org/search.json?isbn=${isbn}&limit=5` : `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=6`;
      const d = await holeJson(url, { timeout: 12000 });
      const b = (d.docs || []).slice(0, 6);
      if (!b.length) return { text: `Zu „${q}“ habe ich kein Buch gefunden.` };
      return {
        text: `Bester Treffer: „${b[0].title}“${b[0].author_name ? ` von ${b[0].author_name.slice(0, 2).join(" und ")}` : ""}${b[0].first_publish_year ? `, erschienen ${b[0].first_publish_year}` : ""}.`,
        tabelle: { kopf: ["Titel", "Autor", "Jahr", "Seiten"], zeilen: b.map((x) => [x.title, (x.author_name || []).slice(0, 2).join(", "), x.first_publish_year || "", x.number_of_pages_median || ""]) }, quelle: "Open Library",
      };
    },
  },
  {
    id: "periodensystem", titel: "Periodensystem", icon: "⚗️", gruppe: G,
    info: "Alle 118 Elemente: Symbol, Ordnungszahl, Atommasse.",
    felder: [{ k: "element", label: "Name, Symbol oder Ordnungszahl", typ: "text" }],
    sprache: [[/^(?:was ist (?:das )?element (?:nummer |mit der (?:ordnungszahl|nummer) )?|welches element (?:hat die (?:ordnungszahl|nummer) |ist )|(?:ordnungszahl|atommasse|symbol|elementsymbol) (?:von |für )?|element )([a-zäöü]{1,15}|\d{1,3})$/, (m) => ({ element: m[1] })]],
    run(e) {
      const q = text(e, "element", "ein Element", { max: 30 }), el = findeElement(q);
      if (!el) throw new Error(`Das Element „${q}“ kenne ich nicht.`);
      const zustand = GASE.has(el.sym) ? "gasförmig" : FLUESSIG.has(el.sym) ? "flüssig" : el.nr > 103 ? "künstlich, nur im Labor" : "fest";
      return { text: `${el.name}, Symbol ${el.sym}, Ordnungszahl ${el.nr}, Atommasse ${de(el.masse, 3)} u. Bei Raumtemperatur ${zustand}.` };
    },
  },
];
