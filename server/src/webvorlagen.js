// v1.158.0 Profi-Vorlagen der Webseiten-Werkstatt: 6 Stile × 14 Branchen.
// Baut ohne Claude in unter einer Sekunde eine hochwertige, animierte, responsive Seite mit 11 Abschnitten.
// Dient als Sofort-Vorlage, als Rettung, wenn Claude ausfällt, und als Design-Vorgabe für Claude.

export const STILE = {
  neon: { name: "Neon Future", dunkel: true, bg: "#05060a", bg2: "#0b0f18", card: "rgba(255,255,255,.045)", line: "rgba(255,255,255,.10)", text: "#eef2f8", muted: "#9aa6ba", a1: "#ff8a1e", a2: "#22d3ee", kopf: "Space Grotesk", fliess: "Inter", radius: 18, beschreibung: "dunkel, Neon-Orange und Cyan, Glas-Optik, leuchtende Kanten" },
  elegant: { name: "Elegant Gold", dunkel: true, bg: "#0e0c0a", bg2: "#17130f", card: "rgba(255,240,220,.04)", line: "rgba(233,213,167,.16)", text: "#f4ede3", muted: "#b9ad9b", a1: "#c9a86a", a2: "#f0dcae", kopf: "Playfair Display", fliess: "Inter", radius: 6, beschreibung: "edel, fast schwarz mit Gold, große Serifenschrift, viel Luft" },
  hell: { name: "Clean Modern", dunkel: false, bg: "#f7f9fc", bg2: "#edf1f7", card: "#ffffff", line: "rgba(15,23,42,.09)", text: "#0f172a", muted: "#556074", a1: "#2563eb", a2: "#7c3aed", kopf: "Plus Jakarta Sans", fliess: "Inter", radius: 16, beschreibung: "hell, klar, Blau-Violett-Verlauf, weiße Karten mit weichen Schatten" },
  natur: { name: "Natur & Wärme", dunkel: false, bg: "#faf6ef", bg2: "#f1eadd", card: "#fffdf8", line: "rgba(60,45,25,.12)", text: "#26211a", muted: "#6f665a", a1: "#3f7d4f", a2: "#c0843d", kopf: "Fraunces", fliess: "Inter", radius: 22, beschreibung: "warm, Creme mit Waldgrün und Honig, runde Formen, freundlich" },
  kraft: { name: "Kraft & Stahl", dunkel: true, bg: "#0d0d0d", bg2: "#171717", card: "rgba(255,255,255,.04)", line: "rgba(255,255,255,.12)", text: "#f5f5f5", muted: "#a8a8a8", a1: "#facc15", a2: "#f97316", kopf: "Archivo", fliess: "Inter", radius: 6, beschreibung: "kräftig, Anthrazit mit Signalgelb, große fette Schrift, kantig" },
  verspielt: { name: "Bunt & Fröhlich", dunkel: false, bg: "#fff7f3", bg2: "#ffece4", card: "#ffffff", line: "rgba(80,30,50,.10)", text: "#2b1b24", muted: "#7a6470", a1: "#ff5c8a", a2: "#7c5cff", kopf: "Poppins", fliess: "Nunito", radius: 26, beschreibung: "fröhlich, Pastell mit Pink und Violett, sehr runde Formen, verspielt" },
};

// Kleine Strich-Symbole (24×24), passend zu jeder Branche.
const ICON = {
  schere: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  funke: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  herz: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
  stern: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
  besteck: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 4-3 7h3v11"/>',
  kaffee: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3"/>',
  hammer: '<path d="m14 6 4 4M3 21l9-9M12.5 3.5l8 8-3 3-8-8Z"/>',
  werkzeug: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4Z"/>',
  auto: '<path d="M5 16h14M3 16v-3l2-5h14l2 5v3"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/>',
  kreuz: '<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7Z"/>',
  hantel: '<path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/>',
  kamera: '<path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/>',
  haus: '<path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6"/>',
  waage: '<path d="M12 4v16M5 20h14M5 8h14M7 8l-3 6a3 3 0 0 0 6 0ZM17 8l-3 6a3 3 0 0 0 6 0Z"/>',
  bett: '<path d="M3 18V8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',
  blatt: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15M5 19l7-7"/>',
  tropfen: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  blitz: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
  schild: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  uhr: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  tasche: '<path d="M5 8h14l-1 12H6ZM9 8a3 3 0 0 1 6 0"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  ort: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  pfeil: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
export const ICONS = ICON;
const svg = (n, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ICON.funke}</svg>`;

// Branchen: Texte, Leistungen, Pakete, Ablauf, Fragen, Foto-Suchwörter (Englisch, für Openverse).
export const BRANCHEN = {
  friseur: {
    name: "Friseur", re: /friseur|frisör|coiffeur|haar|barber|barbier|salon/, stil: "elegant", beispiel: "Salon Lumen", icons: ["schere", "funke", "tropfen", "stern"],
    kicker: "Friseur & Haarkunst", h1: "Haare, die deinen Stil erzählen.", sub: "Schnitt, Farbe und Pflege mit viel Zeit für dich. Modern, ehrlich beraten und mit einem Ergebnis, das auch nach Tagen noch sitzt.",
    cta: "Termin anfragen", stats: [["30", " Min.", "Beratung inklusive"], ["24", " h", "Antwort auf Anfragen"], ["100", " %", "ehrliche Beratung"]],
    leistungen: [["Damenschnitt", "Waschen, Beratung, Schnitt und Styling, abgestimmt auf Gesicht und Alltag.", "ab 49 €"], ["Herrenschnitt", "Präzise Konturen, Fade oder Klassiker, inklusive Styling-Tipp.", "ab 29 €"], ["Farbe & Balayage", "Natürliche Verläufe, Strähnen oder komplette Farbe mit Pflege.", "ab 89 €"], ["Pflege & Styling", "Intensivpflege, Hochsteckfrisuren und Styling für besondere Anlässe.", "ab 35 €"]],
    pakete: [["Schnitt", "ab 29 €", ["Beratung", "Waschen & Schnitt", "Styling"]], ["Farbe & Schnitt", "ab 119 €", ["Typ-Beratung", "Farbe oder Strähnen", "Schnitt & Pflege", "Styling"]], ["Braut & Event", "ab 149 €", ["Probetermin", "Frisur am großen Tag", "Haarschmuck-Beratung"]]],
    ablauf: [["Termin wählen", "Online anfragen oder anrufen, wir melden uns schnell."], ["Beratung", "Wir hören zu und zeigen, was zu dir passt."], ["Verwandlung", "Schnitt, Farbe und Styling in entspannter Atmosphäre."]],
    faq: [["Brauche ich einen Termin?", "Am besten ja, damit wir genug Zeit für dich haben. Spontan geht oft auch, frag einfach an."], ["Welche Produkte nutzt ihr?", "[Produktmarken eintragen] – auf Wunsch auch vegan und ohne Duftstoffe."], ["Kann ich mit Karte zahlen?", "[Zahlungsarten eintragen, z. B. Bar, EC-Karte, Apple Pay]"]],
    bilder: { hero: "hair salon interior", about: "hairdresser cutting hair", galerie: ["hairstyle woman", "barber shop", "hair color balayage"] }, zeiten: [["Mo", "geschlossen"], ["Di–Fr", "9–19 Uhr"], ["Sa", "9–15 Uhr"]], preis: 990,
  },
  restaurant: {
    name: "Restaurant", re: /restaurant|gaststätte|gasthaus|bistro|pizzeria|trattoria|küche|grill|steakhouse|sushi|imbiss|burger/, stil: "elegant", beispiel: "Tavola", icons: ["besteck", "stern", "blatt", "herz"],
    kicker: "Restaurant", h1: "Gutes Essen. Echte Gastfreundschaft.", sub: "Frische Zutaten aus der Region, ehrliche Küche und ein Abend, an den man sich gern erinnert. Reserviere deinen Tisch in wenigen Sekunden.",
    cta: "Tisch reservieren", stats: [["100", " %", "frisch gekocht"], ["2", " Std.", "Zeit für dich am Tisch"], ["7", " Tage", "Mittagstisch & Abendkarte"]],
    leistungen: [["Vorspeisen", "Saisonale Kleinigkeiten zum Teilen, hausgemachtes Brot und Dips.", "ab 7 €"], ["Hauptgerichte", "Unsere Klassiker und wechselnde Tagesgerichte aus der Region.", "ab 16 €"], ["Desserts", "Hausgemacht, nicht zu süß und immer ein bisschen überraschend.", "ab 6 €"], ["Feiern & Catering", "Geburtstage, Firmenfeiern oder Catering bei dir vor Ort.", "auf Anfrage"]],
    pakete: [["Mittagstisch", "ab 12,90 €", ["Tagesgericht", "Kleiner Salat", "Wasser"]], ["Menü am Abend", "ab 49 €", ["3 Gänge", "Amuse-Bouche", "Weinbegleitung optional"]], ["Feier", "ab 39 € p. P.", ["Eigener Bereich", "Menü nach Wunsch", "Getränkepauschale"]]],
    ablauf: [["Reservieren", "Online, telefonisch oder per Mail."], ["Ankommen", "Wir haben deinen Tisch vorbereitet."], ["Genießen", "Lehn dich zurück, wir kümmern uns um den Rest."]],
    faq: [["Gibt es vegetarische Gerichte?", "Ja, auf der Karte stehen immer vegetarische und vegane Gerichte."], ["Kann ich für Gruppen reservieren?", "Gern, ab 8 Personen am besten mit ein paar Tagen Vorlauf."], ["Habt ihr Parkplätze?", "[Parkmöglichkeiten eintragen]"]],
    bilder: { hero: "restaurant interior dinner", about: "chef cooking kitchen", galerie: ["gourmet dish plate", "restaurant table", "dessert plate"] }, zeiten: [["Mo", "Ruhetag"], ["Di–Fr", "11:30–14:30 · 17:30–22 Uhr"], ["Sa–So", "12–22 Uhr"]], preis: 1190,
  },
  cafe: {
    name: "Café", re: /café|cafe|kaffee|bäckerei|backstube|konditorei|eisdiele|brunch|rösterei/, stil: "natur", beispiel: "Kaffeeliebe", icons: ["kaffee", "herz", "blatt", "stern"],
    kicker: "Café & Bäckerei", h1: "Dein Lieblingsplatz für guten Kaffee.", sub: "Frisch gerösteter Kaffee, hausgemachter Kuchen und ein Ort zum Ankommen. Morgens schnell zum Mitnehmen oder sonntags lange zum Brunch.",
    cta: "Vorbeikommen", stats: [["7", " Uhr", "frische Brötchen ab"], ["12", "+", "Kuchen pro Woche"], ["100", " %", "mit Liebe gebacken"]],
    leistungen: [["Kaffee & Spezialitäten", "Espresso, Flat White, Chai und saisonale Specials.", "ab 2,50 €"], ["Kuchen & Torten", "Täglich frisch, auch als ganze Torte auf Bestellung.", "ab 3,80 €"], ["Frühstück & Brunch", "Vom kleinen Frühstück bis zum großen Sonntags-Brunch.", "ab 8,50 €"], ["Bestellungen", "Torten für Geburtstage, Hochzeiten und Firmen.", "auf Anfrage"]],
    pakete: [["To go", "ab 2,50 €", ["Kaffee nach Wahl", "Gebäck dazu", "Mehrwegbecher"]], ["Frühstück", "ab 12 €", ["Heißgetränk", "Brötchen & Aufstriche", "Obst"]], ["Sonntags-Brunch", "ab 24 €", ["Buffet", "Heißgetränke satt", "Saft & Prosecco"]]],
    ablauf: [["Reinkommen", "Such dir einen Lieblingsplatz."], ["Bestellen", "Wir beraten dich gern an der Theke."], ["Genießen", "Bleib so lange, wie du magst."]],
    faq: [["Habt ihr Hafermilch?", "Ja, Hafer-, Mandel- und Laktosefrei-Milch ohne Aufpreis."], ["Kann ich Torten bestellen?", "Ja, am besten 3 Tage vorher per Mail oder Telefon."], ["Gibt es WLAN?", "[WLAN-Angabe eintragen]"]],
    bilder: { hero: "cozy cafe coffee", about: "barista latte art", galerie: ["cake slice cafe", "croissant breakfast", "coffee cup table"] }, zeiten: [["Mo–Fr", "7–18 Uhr"], ["Sa", "8–18 Uhr"], ["So", "9–17 Uhr"]], preis: 890,
  },
  handwerk: {
    name: "Handwerk", re: /handwerk|maler|elektri|sanitär|heizung|dachdeck|tischler|schreiner|zimmer|fliesen|bau(?:firma|unternehm)|installateur|klempner|garten(?:bau|pflege)|landschaft/, stil: "kraft", beispiel: "Meisterbetrieb Becker", icons: ["hammer", "werkzeug", "schild", "uhr"],
    kicker: "Meisterbetrieb", h1: "Sauber geplant. Pünktlich gebaut.", sub: "Handwerk mit Meisterqualität aus der Region. Festes Angebot, klare Termine und eine Baustelle, die wir ordentlich verlassen.",
    cta: "Kostenloses Angebot", stats: [["48", " h", "bis zum Angebot"], ["5", " Jahre", "Gewährleistung"], ["100", " %", "Festpreis-Garantie"]],
    leistungen: [["Neubau & Umbau", "Von der Planung bis zur Übergabe, alles aus einer Hand.", "nach Aufmaß"], ["Sanierung", "Altbau, Bad oder Fassade, mit sauberer Abdeckung und wenig Staub.", "nach Aufmaß"], ["Reparatur & Notdienst", "Schnelle Hilfe, wenn es drauf ankommt.", "ab 69 €"], ["Wartung", "Regelmäßige Checks, damit nichts teuer wird.", "ab 89 €"]],
    pakete: [["Check", "ab 89 €", ["Vor-Ort-Termin", "Zustandsbericht", "Empfehlung"]], ["Projekt", "nach Aufmaß", ["Planung", "Festpreis-Angebot", "Ausführung", "Abnahme"]], ["Wartungsvertrag", "ab 19 €/Monat", ["Jährlicher Check", "Vorrang bei Terminen", "Rabatt auf Material"]]],
    ablauf: [["Anfrage", "Kurz beschreiben, gern mit Fotos."], ["Vor-Ort-Termin", "Wir schauen uns alles an und messen auf."], ["Festpreis-Angebot", "Klar, verständlich und verbindlich."], ["Ausführung", "Pünktlich, sauber, mit fester Ansprechperson."]],
    faq: [["Wie schnell bekomme ich ein Angebot?", "In der Regel innerhalb von 48 Stunden nach dem Vor-Ort-Termin."], ["Arbeitet ihr auch am Wochenende?", "Im Notfall ja, sonst Montag bis Freitag."], ["Welches Gebiet deckt ihr ab?", "[Einsatzgebiet eintragen, z. B. 30 km um die Stadt]"]],
    bilder: { hero: "carpenter workshop", about: "craftsman tools work", galerie: ["construction renovation house", "tiles bathroom renovation", "workshop wood"] }, zeiten: [["Mo–Fr", "7–17 Uhr"], ["Sa", "nach Absprache"], ["Notdienst", "[Nummer eintragen]"]], preis: 1290,
  },
  auto: {
    name: "Autowerkstatt", re: /auto|kfz|werkstatt|reifen|autohaus|lackier|karosserie|tuning|fahrschule|car/, stil: "kraft", beispiel: "Garage 47", icons: ["auto", "werkzeug", "schild", "blitz"],
    kicker: "Kfz-Meisterwerkstatt", h1: "Dein Auto in besten Händen.", sub: "Inspektion, Reparatur und TÜV für alle Marken. Transparente Preise vorab, Ersatzwagen auf Wunsch und schnelle Termine.",
    cta: "Termin buchen", stats: [["24", " h", "Termin meist binnen"], ["0", " €", "Kostenvoranschlag"], ["100", " %", "alle Marken"]],
    leistungen: [["Inspektion", "Nach Herstellervorgabe, ohne dass die Garantie verloren geht.", "ab 149 €"], ["HU / AU (TÜV)", "Vorbereitung und Abnahme an einem Tag.", "ab 129 €"], ["Reifenservice", "Wechsel, Einlagerung und Achsvermessung.", "ab 39 €"], ["Diagnose & Elektrik", "Fehlerspeicher, Elektronik und Klimaservice.", "ab 59 €"]],
    pakete: [["Reifen", "ab 39 €", ["Räderwechsel", "Sichtprüfung", "Luftdruck"]], ["Inspektion", "ab 149 €", ["Herstellervorgabe", "Ölwechsel", "Prüfbericht", "Stempel im Serviceheft"]], ["Rundum-sorglos", "ab 299 €", ["Inspektion", "HU / AU", "Klimaservice", "Wäsche"]]],
    ablauf: [["Termin", "Online oder telefonisch, auch kurzfristig."], ["Check & Angebot", "Wir sagen dir vorher, was es kostet."], ["Reparatur", "Mit Originalteilen oder gleichwertigen Teilen."], ["Abholung", "Mit Erklärung, was wir gemacht haben."]],
    faq: [["Bleibt meine Garantie erhalten?", "Ja, wir arbeiten nach Herstellervorgaben."], ["Gibt es einen Ersatzwagen?", "[Angabe eintragen, z. B. ja, nach Verfügbarkeit]"], ["Kann ich vor Ort warten?", "Bei kleinen Arbeiten gern, mit Kaffee."]],
    bilder: { hero: "car garage mechanic", about: "mechanic repairing car", galerie: ["sports car garage", "car tire service", "car engine"] }, zeiten: [["Mo–Fr", "7:30–18 Uhr"], ["Sa", "8–13 Uhr"], ["So", "geschlossen"]], preis: 1190,
  },
  praxis: {
    name: "Praxis", re: /praxis|arzt|ärzt|zahn|physio|therap|heilpraktik|osteopath|tierarzt|psycholog|pflege|ergo/, stil: "hell", beispiel: "Praxis am Park", icons: ["kreuz", "herz", "schild", "uhr"],
    kicker: "Praxis", h1: "Gesundheit mit Zeit und Herz.", sub: "Moderne Behandlung, verständliche Erklärungen und kurze Wartezeiten. Wir nehmen uns Zeit für dich und deine Fragen.",
    cta: "Termin anfragen", stats: [["15", " Min.", "Wartezeit im Schnitt"], ["24", " h", "Rückmeldung"], ["100", " %", "verständlich erklärt"]],
    leistungen: [["Vorsorge", "Check-ups und Früherkennung, damit du gesund bleibst.", "Kasse & privat"], ["Behandlung", "Moderne, schonende Methoden mit klarer Erklärung.", "Kasse & privat"], ["Beratung", "Zeit für Fragen, zweite Meinung und Therapieplanung.", "nach Termin"], ["Hausbesuche", "Für Menschen, die nicht in die Praxis kommen können.", "nach Absprache"]],
    pakete: [["Erstgespräch", "Kasse", ["Anamnese", "Untersuchung", "Plan"]], ["Vorsorge-Check", "ab 89 €", ["Ausführliche Untersuchung", "Laborwerte", "Befundbesprechung"]], ["Premium-Check", "ab 249 €", ["Rundum-Check", "Zusatzdiagnostik", "Persönlicher Bericht"]]],
    ablauf: [["Termin anfragen", "Online, telefonisch oder per Mail."], ["Gespräch", "Wir hören zu und untersuchen gründlich."], ["Behandlung", "Mit Plan, den du verstehst."]],
    faq: [["Nehmt ihr neue Patienten?", "[Angabe eintragen]"], ["Welche Kassen?", "Alle gesetzlichen Kassen und Privatversicherte."], ["Ist die Praxis barrierefrei?", "[Angabe eintragen, z. B. Aufzug, ebenerdig]"]],
    bilder: { hero: "modern medical practice", about: "doctor patient consultation", galerie: ["clinic reception", "physiotherapy", "medical equipment"] }, zeiten: [["Mo, Di, Do", "8–12 · 14–18 Uhr"], ["Mi, Fr", "8–13 Uhr"], ["Notfall", "116 117"]], preis: 1390,
  },
  fitness: {
    name: "Fitness", re: /fitness|gym|personal trainer|yoga|pilates|kampfsport|boxen|crossfit|tanz/, stil: "neon", beispiel: "Pulse Studio", icons: ["hantel", "blitz", "herz", "chart"],
    kicker: "Fitness & Training", h1: "Stärker. Jeden Tag.", sub: "Training, das wirkt, mit Coaches, die dich kennen. Kleine Gruppen, moderne Geräte und ein Plan, der zu deinem Leben passt.",
    cta: "Probetraining sichern", stats: [["7", " Tage", "die Woche geöffnet"], ["12", "", "Kurse pro Woche"], ["1", " : 1", "Coaching möglich"]],
    leistungen: [["Krafttraining", "Freie Gewichte und Geräte mit Einweisung.", "inklusive"], ["Kurse", "HIIT, Mobility, Yoga und Functional in kleinen Gruppen.", "inklusive"], ["Personal Training", "Dein Coach, dein Plan, deine Ziele.", "ab 59 €"], ["Ernährung", "Alltagstaugliche Beratung ohne Verbote.", "ab 49 €"]],
    pakete: [["Basic", "29 €/Monat", ["Gerätefläche", "App-Trainingsplan", "Monatlich kündbar"]], ["Premium", "49 €/Monat", ["Alle Kurse", "Sauna", "Quartals-Check", "Getränke-Flat"]], ["Coaching", "149 €/Monat", ["4× Personal Training", "Ernährungsplan", "Alle Premium-Vorteile"]]],
    ablauf: [["Probetraining", "Kostenlos und unverbindlich."], ["Ziel-Check", "Wir messen, wo du stehst."], ["Dein Plan", "Training, das zu dir passt."], ["Dranbleiben", "Coaches, die nachfragen."]],
    faq: [["Wie lange läuft der Vertrag?", "Monatlich kündbar oder günstiger mit 12 Monaten."], ["Bin ich zu untrainiert?", "Nein. Jeder fängt mal an, wir holen dich ab."], ["Gibt es Duschen?", "Ja, mit Handtuchservice im Premium-Tarif."]],
    bilder: { hero: "gym fitness training", about: "personal trainer gym", galerie: ["weights gym", "yoga class", "fitness workout"] }, zeiten: [["Mo–Fr", "6–23 Uhr"], ["Sa–So", "8–20 Uhr"], ["Feiertage", "9–18 Uhr"]], preis: 1290,
  },
  fotograf: {
    name: "Fotograf", re: /foto|photo|video(?:graf)?|film|kamera|hochzeitsfoto/, stil: "elegant", beispiel: "Lichtwerk", icons: ["kamera", "herz", "stern", "funke"],
    kicker: "Fotografie", h1: "Momente, die bleiben.", sub: "Natürliche Bilder mit Gefühl für Licht und Menschen. Für Hochzeiten, Porträts, Familien und Marken, die gesehen werden wollen.",
    cta: "Shooting anfragen", stats: [["48", " h", "Vorschau-Galerie"], ["4", " Wochen", "bis zur fertigen Galerie"], ["100", " %", "bearbeitet in Handarbeit"]],
    leistungen: [["Hochzeit", "Vom Getting Ready bis zum ersten Tanz.", "ab 1.490 €"], ["Porträt", "Natürliche Porträts drinnen oder draußen.", "ab 189 €"], ["Business", "Teamfotos und Bildwelten für deine Marke.", "ab 390 €"], ["Familie", "Entspannte Shootings, gern bei euch zu Hause.", "ab 249 €"]],
    pakete: [["Porträt", "ab 189 €", ["1 Stunde", "15 bearbeitete Bilder", "Online-Galerie"]], ["Hochzeit", "ab 1.490 €", ["8 Stunden", "400+ Bilder", "Vorgespräch", "Online-Galerie"]], ["Marke", "ab 390 €", ["Halber Tag", "Bilder für Web & Social", "Nutzungsrechte"]]],
    ablauf: [["Kennenlernen", "Wir sprechen über Ideen und Orte."], ["Shooting", "Entspannt, ohne steifes Posieren."], ["Galerie", "Bearbeitete Bilder online zum Teilen."]],
    faq: [["Bekomme ich alle Bilder?", "Du bekommst die besten, liebevoll bearbeiteten Bilder in hoher Auflösung."], ["Reist du auch?", "Ja, deutschlandweit und auf Anfrage weltweit."], ["Wie reserviere ich?", "Mit einer kurzen Anfrage und Anzahlung ist der Termin fest."]],
    bilder: { hero: "photographer camera portrait", about: "photographer at work", galerie: ["wedding couple photo", "portrait woman natural light", "landscape golden hour"] }, zeiten: [["Termine", "nach Vereinbarung"], ["Anfragen", "Mo–Fr 9–18 Uhr"], ["Studio", "[Adresse eintragen]"]], preis: 1090,
  },
  immobilien: {
    name: "Immobilien", re: /immobilien|makler|hausverwaltung|wohnung|vermiet|bauträger|architekt/, stil: "hell", beispiel: "Hausblick Immobilien", icons: ["haus", "chart", "schild", "ort"],
    kicker: "Immobilien", h1: "Das richtige Zuhause. Der richtige Preis.", sub: "Verkaufen, vermieten oder bewerten mit lokaler Erfahrung und ehrlicher Beratung. Wir begleiten dich vom ersten Gespräch bis zum Notartermin.",
    cta: "Kostenlose Bewertung", stats: [["48", " h", "bis zur Bewertung"], ["0", " €", "Erstberatung"], ["1", "", "feste Ansprechperson"]],
    leistungen: [["Verkauf", "Marktgerechter Preis, starke Präsentation, geprüfte Käufer.", "erfolgsabhängig"], ["Vermietung", "Mieterauswahl, Verträge und Übergabe.", "erfolgsabhängig"], ["Bewertung", "Fundierte Einschätzung deiner Immobilie.", "kostenlos"], ["Verwaltung", "Wir kümmern uns um Mieter, Technik und Abrechnung.", "ab 25 €/Einheit"]],
    pakete: [["Bewertung", "0 €", ["Vor-Ort-Termin", "Marktanalyse", "Preisempfehlung"]], ["Verkauf", "erfolgsabhängig", ["Profi-Fotos & Exposé", "Besichtigungen", "Verhandlung", "Notarbegleitung"]], ["Verwaltung", "ab 25 €/Einheit", ["Mieterbetreuung", "Nebenkostenabrechnung", "Handwerker-Koordination"]]],
    ablauf: [["Gespräch", "Wir lernen dich und die Immobilie kennen."], ["Bewertung", "Mit echten Marktdaten."], ["Vermarktung", "Fotos, Exposé, Portale, Besichtigungen."], ["Abschluss", "Bis zur Schlüsselübergabe."]],
    faq: [["Was kostet die Bewertung?", "Die Erstbewertung ist für dich kostenlos."], ["Wie lange dauert ein Verkauf?", "Meist 2–4 Monate, je nach Lage und Preis."], ["Wer zahlt die Provision?", "[Regelung eintragen]"]],
    bilder: { hero: "modern house exterior", about: "real estate agent keys", galerie: ["living room interior", "apartment kitchen modern", "house garden"] }, zeiten: [["Mo–Fr", "9–18 Uhr"], ["Sa", "nach Vereinbarung"], ["Besichtigungen", "auch abends"]], preis: 1490,
  },
  kanzlei: {
    name: "Kanzlei", re: /kanzlei|anwalt|rechtsanw|notar|steuerber|steuerkanzlei|buchhalt|versicherung|finanzber/, stil: "elegant", beispiel: "Kanzlei Weber", icons: ["waage", "schild", "chart", "uhr"],
    kicker: "Kanzlei", h1: "Klarer Rat. Starke Vertretung.", sub: "Wir erklären verständlich, handeln entschlossen und behalten deine Ziele im Blick. Persönlich, diskret und erreichbar.",
    cta: "Erstberatung anfragen", stats: [["24", " h", "Rückmeldung"], ["1", "", "feste Ansprechperson"], ["100", " %", "Diskretion"]],
    leistungen: [["Beratung", "Einschätzung deiner Lage und klare Handlungsoptionen.", "nach RVG / Vereinbarung"], ["Vertretung", "Außergerichtlich und vor Gericht.", "nach RVG"], ["Verträge", "Prüfen, verhandeln und rechtssicher aufsetzen.", "nach Vereinbarung"], ["Unternehmen", "Laufende Betreuung für Selbstständige und Firmen.", "Pauschale möglich"]],
    pakete: [["Erstberatung", "[Preis]", ["45 Minuten", "Einschätzung", "Nächste Schritte"]], ["Mandat", "nach RVG", ["Akte & Strategie", "Schriftverkehr", "Vertretung"]], ["Firmen-Paket", "ab [Preis]/Monat", ["Laufende Beratung", "Vertragsprüfung", "Schnelle Termine"]]],
    ablauf: [["Kontakt", "Kurz schildern, worum es geht."], ["Erstgespräch", "Wir prüfen deine Lage."], ["Strategie", "Klarer Plan mit Kosten vorab."], ["Umsetzung", "Wir vertreten deine Interessen."]],
    faq: [["Was kostet die Erstberatung?", "[Preis eintragen] – du weißt vorher, was es kostet."], ["Geht das auch online?", "Ja, per Video-Termin oder Telefon."], ["Übernimmt die Rechtsschutzversicherung?", "Wir klären das gern für dich mit der Versicherung."]],
    bilder: { hero: "law office desk", about: "lawyer meeting client", galerie: ["office library books", "business meeting", "signing contract"] }, zeiten: [["Mo–Do", "8:30–18 Uhr"], ["Fr", "8:30–14 Uhr"], ["Termine", "auch online"]], preis: 1490,
  },
  hotel: {
    name: "Hotel", re: /hotel|pension|ferienwohnung|ferienhaus|gästehaus|unterkunft|resort|camping|b&b/, stil: "natur", beispiel: "Haus Seeblick", icons: ["bett", "stern", "blatt", "kaffee"],
    kicker: "Hotel & Gästehaus", h1: "Ankommen. Durchatmen. Bleiben.", sub: "Gemütliche Zimmer, ein Frühstück, das den Tag rettet, und Gastgeber, die sich freuen, dass du da bist. Direkt buchen lohnt sich.",
    cta: "Verfügbarkeit prüfen", stats: [["24", " h", "Check-in möglich"], ["1", "", "Frühstück, das bleibt"], ["0", " €", "Gebühr bei Direktbuchung"]],
    leistungen: [["Doppelzimmer", "Ruhig, hell, mit Blick ins Grüne.", "ab 89 €/Nacht"], ["Suite", "Mehr Platz, Sitzecke und Balkon.", "ab 139 €/Nacht"], ["Frühstück", "Regional, frisch und reichhaltig.", "18 € p. P."], ["Wellness", "Sauna und Ruheraum für Hausgäste.", "inklusive"]],
    pakete: [["Kurztrip", "ab 179 €", ["2 Nächte", "Frühstück", "Spätes Check-out"]], ["Auszeit", "ab 349 €", ["3 Nächte", "Halbpension", "Wellness", "Begrüßungsgetränk"]], ["Lange Woche", "ab 690 €", ["7 Nächte", "Frühstück", "1 Nacht geschenkt"]]],
    ablauf: [["Anfragen", "Direkt hier, ohne Buchungsportal."], ["Bestätigung", "Persönlich, mit allen Infos."], ["Ankommen", "Wir freuen uns auf dich."]],
    faq: [["Sind Hunde erlaubt?", "[Angabe eintragen]"], ["Gibt es Parkplätze?", "[Angabe eintragen]"], ["Bis wann kann ich stornieren?", "[Stornobedingungen eintragen]"]],
    bilder: { hero: "boutique hotel room", about: "hotel breakfast table", galerie: ["hotel lobby cozy", "lake view landscape", "spa sauna"] }, zeiten: [["Check-in", "ab 15 Uhr"], ["Check-out", "bis 11 Uhr"], ["Rezeption", "7–22 Uhr"]], preis: 1390,
  },
  kosmetik: {
    name: "Kosmetik", re: /kosmetik|beauty|nagel|nails|spa|massage|wellness|wimper|lash|make-?up|tattoo|piercing/, stil: "verspielt", beispiel: "Glow Studio", icons: ["funke", "herz", "tropfen", "stern"],
    kicker: "Beauty & Kosmetik", h1: "Zeit für dich. Zeit zum Strahlen.", sub: "Behandlungen mit hochwertigen Produkten, viel Ruhe und einem Ergebnis, das du siehst und spürst.",
    cta: "Termin buchen", stats: [["60", " Min.", "nur für dich"], ["24", " h", "Antwort auf Anfragen"], ["100", " %", "hygienisch & sorgfältig"]],
    leistungen: [["Gesichtsbehandlung", "Reinigung, Peeling, Maske und Massage.", "ab 69 €"], ["Nägel", "Maniküre, Gel und Nail-Art.", "ab 35 €"], ["Wimpern & Brauen", "Lifting, Färben und Form.", "ab 39 €"], ["Massage", "Entspannung für Rücken, Nacken und Kopf.", "ab 49 €"]],
    pakete: [["Quick Glow", "49 €", ["Reinigung", "Maske", "Pflege"]], ["Me-Time", "119 €", ["Gesichtsbehandlung", "Maniküre", "Tee & Ruhe"]], ["Deluxe", "189 €", ["Gesicht", "Massage", "Wimpernlifting", "Pflege-Set"]]],
    ablauf: [["Buchen", "Online, per Mail oder Telefon."], ["Beratung", "Wir finden, was deiner Haut guttut."], ["Genießen", "Zurücklehnen und entspannen."]],
    faq: [["Welche Produkte nutzt ihr?", "[Marken eintragen] – auf Wunsch vegan."], ["Gibt es Gutscheine?", "Ja, für jede Behandlung und jeden Betrag."], ["Was, wenn ich absagen muss?", "Bitte bis 24 Stunden vorher Bescheid geben."]],
    bilder: { hero: "beauty salon spa", about: "facial treatment cosmetic", galerie: ["manicure nails", "spa massage stones", "skincare products"] }, zeiten: [["Mo", "geschlossen"], ["Di–Fr", "10–19 Uhr"], ["Sa", "9–15 Uhr"]], preis: 990,
  },
  reinigung: {
    name: "Reinigung", re: /reinigung|putz|gebäudeservice|hausmeister|umzug|entrümpel|transport|kurier|logistik/, stil: "hell", beispiel: "Glanzwerk Service", icons: ["tropfen", "schild", "uhr", "check"],
    kicker: "Service & Reinigung", h1: "Sauber. Zuverlässig. Pünktlich.", sub: "Reinigung und Service für Büros, Praxen und Zuhause. Feste Teams, klare Preise und ein Ergebnis, das man sieht.",
    cta: "Angebot anfordern", stats: [["24", " h", "bis zum Angebot"], ["1", "", "festes Team"], ["100", " %", "versichert"]],
    leistungen: [["Büroreinigung", "Regelmäßig, gründlich und außerhalb der Arbeitszeit.", "ab 25 €/Std."], ["Privathaushalt", "Wohnung oder Haus, einmalig oder regelmäßig.", "ab 29 €/Std."], ["Grundreinigung", "Nach Umzug, Renovierung oder vor dem Verkauf.", "nach Fläche"], ["Fenster & Glas", "Streifenfrei, auch in großer Höhe.", "ab 3 €/m²"]],
    pakete: [["Einmalig", "ab 29 €/Std.", ["Besichtigung", "Reinigung", "Abnahme"]], ["Regelmäßig", "ab 25 €/Std.", ["Festes Team", "Feste Zeiten", "Checkliste", "Vertretung bei Urlaub"]], ["Gewerbe", "nach Angebot", ["Reinigungsplan", "Qualitätskontrolle", "Monatliche Abrechnung"]]],
    ablauf: [["Anfrage", "Fläche und Wünsche kurz beschreiben."], ["Besichtigung", "Kostenlos vor Ort."], ["Angebot", "Klarer Festpreis."], ["Start", "Mit festem Team."]],
    faq: [["Bringt ihr Putzmittel mit?", "Ja, umweltschonend und auf Wunsch ohne Duftstoffe."], ["Seid ihr versichert?", "Ja, mit Betriebshaftpflicht."], ["Wie kurzfristig geht es?", "Oft schon in der gleichen Woche."]],
    bilder: { hero: "clean bright office", about: "cleaning service team", galerie: ["clean kitchen", "window cleaning", "clean living room"] }, zeiten: [["Mo–Fr", "7–19 Uhr"], ["Sa", "8–14 Uhr"], ["Einsätze", "auch abends"]], preis: 890,
  },
  agentur: {
    name: "Agentur & Start-up", re: /agentur|start-?up|software|app|it-|it\b|digital|marketing|beratung|consult|coach|ki\b|tech|saas|online/, stil: "neon", beispiel: "Nova Digital", icons: ["chip", "blitz", "chart", "funke"],
    kicker: "Digital Studio", h1: "Ideen, die online funktionieren.", sub: "Strategie, Design und Technik aus einem Guss. Wir bauen digitale Produkte, die schnell sind, gut aussehen und messbar wirken.",
    cta: "Projekt besprechen", stats: [["2", " Wochen", "bis zum ersten Ergebnis"], ["24", " h", "Antwortzeit"], ["100", " %", "transparent"]],
    leistungen: [["Strategie", "Ziele, Zielgruppe und Plan, bevor wir loslegen.", "ab 690 €"], ["Design", "Marken, Webseiten und Apps, die im Kopf bleiben.", "ab 1.490 €"], ["Entwicklung", "Schnelle, sichere Technik nach aktuellem Stand.", "ab 2.900 €"], ["Wachstum", "SEO, Kampagnen und Auswertung, die man versteht.", "ab 490 €/Monat"]],
    pakete: [["Start", "ab 990 €", ["Landingpage", "Basis-SEO", "Kontaktformular"]], ["Wachstum", "ab 2.900 €", ["Mehrseitige Webseite", "Blog/CMS", "Analytics", "Schulung"]], ["Produkt", "nach Angebot", ["Workshop", "Design-System", "Web-App", "Betreuung"]]],
    ablauf: [["Kickoff", "Wir verstehen Ziel und Zielgruppe."], ["Konzept", "Klickbarer Entwurf in wenigen Tagen."], ["Umsetzung", "In kurzen Schritten mit Feedback."], ["Launch & Wachstum", "Live gehen, messen, verbessern."]],
    faq: [["Wie lange dauert ein Projekt?", "Eine Landingpage oft 2 Wochen, größere Projekte 6–12 Wochen."], ["Arbeitet ihr remote?", "Ja, und gern auch vor Ort beim Kickoff."], ["Was kostet die Betreuung?", "Je nach Umfang, transparent als Monatspaket."]],
    bilder: { hero: "modern office technology", about: "team meeting startup", galerie: ["laptop design workspace", "creative team brainstorming", "city skyline night"] }, zeiten: [["Mo–Fr", "9–18 Uhr"], ["Termine", "auch online"], ["Support", "[Angabe eintragen]"]], preis: 1490,
  },
  // v1.171.0: Eigene Seite ("bau eine Webseite von uns und stell uns vor") – keine Preise, kein Verkauf.
  persoenlich: {
    name: "Persönlich (wir selbst)", re: /$^/, stil: "neon", beispiel: "Das sind wir", icons: ["herz", "stern", "funke", "uhr"], ohnePreise: true,
    kicker: "Hallo, schön dass du da bist", h1: "Das sind wir. Schön, dich kennenzulernen.", sub: "Hier erzählen wir, wer wir sind, was uns antreibt und woran wir gerade arbeiten. Ganz persönlich, ohne Werbung.",
    cta: "Schreib uns", stats: [["1", "", "Zuhause"], ["100", " %", "wir selbst"], ["24", " h", "für Ideen offen"]],
    leistungen: [["Wer wir sind", "[Kurz beschreiben: Wer gehört dazu, was macht euch aus?]", ""], ["Was uns antreibt", "[Was ist euch wichtig, was liebt ihr?]", ""], ["Unsere Projekte", "Woran wir gerade bauen, zum Beispiel unser KI-Assistent F.R.Ai.D.A.Y.", ""], ["Unsere Freizeit", "[Hobbys, Reisen, Lieblingsorte eintragen]", ""]],
    pakete: [],
    ablauf: [["Der Anfang", "[Wie alles begann]"], ["Heute", "[Wo ihr gerade steht]"], ["Als Nächstes", "[Was ihr euch vornehmt]"]],
    faq: [["Wie erreiche ich euch?", "Am einfachsten über das Formular unten."], ["Woran arbeitet ihr gerade?", "[Aktuelles Projekt eintragen]"], ["Wo seid ihr zu Hause?", "[Ort eintragen, nur wenn ihr das zeigen wollt]"]],
    bilder: { hero: "happy couple sunset", about: "family together home", galerie: ["travel adventure mountains", "cozy home living room", "technology workspace night"] }, zeiten: [["Antwort", "meist innerhalb von 1–2 Tagen"], ["Am besten", "per Mail"], ["Treffen", "nach Absprache"]], preis: null,
  },
  allgemein: {
    name: "Unternehmen", re: /$^/, stil: "hell", beispiel: "Musterfirma", icons: ["stern", "schild", "uhr", "herz"],
    kicker: "Willkommen", h1: "Qualität, auf die du dich verlassen kannst.", sub: "Persönlicher Service, faire Preise und ein Team, das sich kümmert. Erfahre, was wir für dich tun können.",
    cta: "Kontakt aufnehmen", stats: [["24", " h", "Antwortzeit"], ["1", "", "feste Ansprechperson"], ["100", " %", "persönlich"]],
    leistungen: [["Beratung", "Wir hören zu und finden die passende Lösung.", "kostenlos"], ["Leistung", "[Hauptleistung beschreiben]", "ab [Preis]"], ["Service", "Schnell, freundlich und zuverlässig.", "inklusive"], ["Extras", "[Zusatzleistung beschreiben]", "auf Anfrage"]],
    pakete: [["Basis", "ab [Preis]", ["Beratung", "Leistung", "Service"]], ["Plus", "ab [Preis]", ["Alles aus Basis", "Extras", "Vorrang bei Terminen"]], ["Premium", "ab [Preis]", ["Rundum-Betreuung", "Persönlicher Ansprechpartner", "Alles inklusive"]]],
    ablauf: [["Kontakt", "Kurz melden."], ["Beratung", "Wir besprechen deine Wünsche."], ["Umsetzung", "Zuverlässig und pünktlich."]],
    faq: [["Wie erreiche ich euch?", "Per Telefon, Mail oder über das Formular unten."], ["Wie schnell antwortet ihr?", "Meist innerhalb von 24 Stunden."], ["Wo seid ihr?", "[Adresse eintragen]"]],
    bilder: { hero: "modern business office", about: "friendly team work", galerie: ["workspace desk", "handshake business", "city street shop"] }, zeiten: [["Mo–Fr", "9–18 Uhr"], ["Sa", "nach Vereinbarung"], ["So", "geschlossen"]], preis: 990,
  },
};

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

export function erkenneBranche(text) {
  const t = String(text || "").toLowerCase();
  for (const [id, b] of Object.entries(BRANCHEN)) if (id !== "allgemein" && b.re.test(t)) return id;
  return "allgemein";
}

/** v1.171.0: Ist das eine Seite für den Nutzer selbst ("von uns", "stell uns vor") statt für einen Kunden? Dann kein Angebot und kein Preis. */
export function istEigeneSeite(text) {
  const t = String(text || "").toLowerCase().replace(/ü/g, "ue");
  if (/\b(ohne|kein(?:en|e)?)\s+(?:verkaufs-?)?(?:preis|angebot)|nicht\s+(?:zum\s+)?verkauf(?:en)?\b|nicht\s+fuer\s+(?:einen\s+)?kunden|fuer\s+(?:uns|mich)\s+selbst|privat\w*\s+(?:web)?seite/.test(t)) return true;
  if (/\bstell\w*\s+(?:uns|mich|(?:meine|unsere)\s+\w+)\s+(?:\w+\s+){0,3}vor\b|\b(?:uns|mich)\s+vorzustellen|\b(?:uns|mich)\s+vorstell/.test(t)) return true;
  if (/\bkund(?:e|in|en)\b/.test(t)) return false;
  if (/\b(?:web)?seite\s+(?:von|ueber)\s+(?:uns|mir|mich)\b(?!\s*-|\s*(?:bereich|abschnitt|teil|seite))/.test(t)) return true;
  if (/\b(?:website|homepage|webseite|internetseite)\s+(?:von|ueber|fuer)\s+(?:uns|mir|mich)\b(?!\s*-|\s*(?:bereich|abschnitt|teil))/.test(t)) return true;
  if (/\b(?:unsere|meine)\s+(?:eigene\s+|private\s+|persoenliche\s+)?(?:web)?(?:seite|site|homepage|internetseite)\b/.test(t)) return true;
  return false;
}

const STIL_WOERTER = [
  ["neon", /neon|futur|dunkel|schwarz|tech|cyber|gaming|iron ?man|jarvis|2050/],
  ["elegant", /elegant|edel|luxus|luxuriös|gold|premium|exklusiv|klassisch|vornehm/],
  ["kraft", /kräftig|robust|industri|stahl|stark|männlich|bold|kantig/],
  ["verspielt", /verspielt|bunt|fröhlich|kinder|pastell|rosa|pink|lustig/],
  ["natur", /natur|bio|öko|grün|warm|gemütlich|rustikal|holz|nachhaltig|handgemacht/],
  ["hell", /hell|clean|frisch|minimal|weiß|seriös|freundlich|modern/],
];
export function erkenneStil(text, branche) {
  const t = String(text || "").toLowerCase();
  for (const [id, re] of STIL_WOERTER) if (re.test(t)) return id;
  return BRANCHEN[branche]?.stil || "hell";
}

/** Name und Ort aus dem Auftrag, z. B. Friseursalon „Mira“ in Berlin-Neukölln. */
export function erkenneName(text) {
  const t = String(text || "");
  const q = t.match(/[„"“»‚']([^„"“”»«‚‘']{2,40})[“”"«‘']/);
  if (q) return q[1].trim();
  const f = t.match(/\b(?:namens|name|heißt|heisst|firma)\s*:?\s+([A-ZÄÖÜ0-9][\wÄÖÜäöüß&.'-]*(?:\s+[A-ZÄÖÜ0-9][\wÄÖÜäöüß&.'-]*){0,3})/);
  if (f) return f[1].trim();
  const w = t.match(/\b(Salon|Studio|Pizzeria|Trattoria|Restaurant|Bistro|Café|Cafe|Bäckerei|Praxis|Kanzlei|Hotel|Pension|Garage|Autohaus|Werkstatt|Agentur)\s+([A-ZÄÖÜ][\wäöüß&'-]+(?:\s+[A-ZÄÖÜ][\wäöüß&'-]+)?)/);
  if (w && !/^(In|Und|Mit|Für|Aus|Am|Im)\b/.test(w[2])) return `${w[1]} ${w[2].replace(/\s+(In|Und|Mit|Für|Aus|Am|Im)$/, "")}`;
  return "";
}
export function erkenneOrt(text) {
  const m = String(text || "").match(/\b(?:in|aus)\s+([A-ZÄÖÜ][\wäöüß]+(?:-[A-ZÄÖÜ][\wäöüß]+)*(?:\s(?:am|an der|im)\s[A-ZÄÖÜ][\wäöüß]+)?)/);
  if (!m || /^(Neon|Gold|Schwarz|Weiß|Blau|Grün|Rot|Orange|Pink|Deutsch|Englisch|Minuten|Stunden|Sekunden)/.test(m[1])) return "";
  return m[1];
}

export function vorlagenOptionen() {
  return {
    stile: Object.entries(STILE).map(([id, s]) => ({ id, name: s.name, a1: s.a1, a2: s.a2, bg: s.bg, beschreibung: s.beschreibung })),
    branchen: Object.entries(BRANCHEN).map(([id, b]) => ({ id, name: b.name, stil: b.stil })),
  };
}

/** Kurzbeschreibung für Claude: welche Abschnitte, welcher Stil. */
export function designVorgabe(branche, stil) {
  const b = BRANCHEN[branche] || BRANCHEN.allgemein, s = STILE[stil] || STILE.hell;
  return `Erkannte Branche: ${b.name}. Gewählter Stil: ${s.name} (${s.beschreibung}).
Design-Tokens für diesen Stil (als CSS-Variablen nutzen): Hintergrund ${s.bg}, zweiter Hintergrund ${s.bg2}, Text ${s.text}, gedämpft ${s.muted}, Akzent ${s.a1}, zweiter Akzent ${s.a2}, Ecken ${s.radius}px, Überschriften-Schrift "${s.kopf}", Fließtext "${s.fliess}" (Google Fonts).
Passende Leistungen als Anregung: ${b.leistungen.map((l) => `${l[0]} (${l[2]})`).join(", ")}.
Foto-Suchwörter (Englisch) als Anregung: ${[b.bilder.hero, b.bilder.about, ...b.bilder.galerie].join(" | ")}.`;
}

function css(s) {
  const dunkel = s.dunkel;
  return `:root{--bg:${s.bg};--bg2:${s.bg2};--card:${s.card};--line:${s.line};--text:${s.text};--muted:${s.muted};--a1:${s.a1};--a2:${s.a2};--r:${s.radius}px;--kopf:"${s.kopf}",ui-sans-serif,system-ui,sans-serif;--fliess:"${s.fliess}",ui-sans-serif,system-ui,sans-serif;--schatten:${dunkel ? "0 20px 60px rgba(0,0,0,.45)" : "0 18px 50px rgba(30,40,70,.10)"};--glas:${dunkel ? "rgba(10,12,18,.62)" : "rgba(255,255,255,.72)"};--max:1180px}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--text);font:400 clamp(15px,1.05vw,17px)/1.65 var(--fliess);overflow-x:hidden;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}a{color:inherit}h1,h2,h3{font-family:var(--kopf);line-height:1.08;margin:0;letter-spacing:${s.kopf === "Playfair Display" || s.kopf === "Fraunces" ? "-.01em" : "-.03em"}}
h1{font-size:clamp(40px,6.4vw,84px);font-weight:${s.kopf === "Archivo" ? 900 : 700}}h2{font-size:clamp(30px,4vw,52px);font-weight:700}h3{font-size:20px;font-weight:650}
p{margin:0}.wrap{width:min(var(--max),100% - 40px);margin-inline:auto}.muted{color:var(--muted)}
.verlauf{background:linear-gradient(100deg,var(--a1),var(--a2));-webkit-background-clip:text;background-clip:text;color:transparent}
.fortschritt{position:fixed;inset:0 auto auto 0;height:3px;width:0;background:linear-gradient(90deg,var(--a1),var(--a2));z-index:60}
.nav{position:fixed;inset:14px 0 auto;z-index:50;transition:inset .35s}.nav .wrap{display:flex;align-items:center;gap:20px;padding:12px 14px 12px 20px;border:1px solid var(--line);border-radius:999px;background:var(--glas);backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);box-shadow:var(--schatten)}
.nav.klein{inset:8px 0 auto}.logo{display:flex;align-items:center;gap:10px;font:700 18px var(--kopf);text-decoration:none;white-space:nowrap}.logo i{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;font-style:normal;color:${dunkel ? "#000" : "#fff"};background:linear-gradient(135deg,var(--a1),var(--a2));box-shadow:0 0 24px color-mix(in srgb,var(--a1) 45%,transparent)}
.links{display:flex;gap:26px;margin-left:auto}.links a{text-decoration:none;font-size:15px;color:var(--muted);transition:color .2s}.links a:hover{color:var(--text)}
.knopf{display:inline-flex;align-items:center;gap:10px;padding:14px 22px;border-radius:999px;border:0;font:600 15px var(--fliess);text-decoration:none;cursor:pointer;color:${dunkel ? "#0a0a0a" : "#fff"};background:linear-gradient(110deg,var(--a1),var(--a2));box-shadow:0 10px 30px color-mix(in srgb,var(--a1) 35%,transparent);transition:transform .25s,box-shadow .25s}
.knopf:hover{transform:translateY(-2px);box-shadow:0 16px 40px color-mix(in srgb,var(--a1) 50%,transparent)}.knopf .ic{width:18px;height:18px}.knopf.leer{background:transparent;color:var(--text);border:1px solid var(--line);box-shadow:none}.knopf.leer:hover{border-color:var(--a1)}
.nav .knopf{padding:10px 18px}.burger{display:none;margin-left:auto;width:44px;height:44px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--text);cursor:pointer}.burger span{display:block;width:18px;height:2px;margin:4px auto;background:currentColor;transition:.3s}
.ic{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.hero{position:relative;min-height:100svh;display:grid;align-items:center;padding:140px 0 90px;overflow:hidden;isolation:isolate}
.orbs{position:absolute;inset:0;z-index:-1;overflow:hidden}.orbs b{position:absolute;border-radius:50%;filter:blur(70px);opacity:${dunkel ? ".55" : ".45"};animation:schweben 18s ease-in-out infinite alternate}
.orbs b:nth-child(1){width:46vw;height:46vw;left:-12vw;top:-10vw;background:var(--a1)}.orbs b:nth-child(2){width:38vw;height:38vw;right:-10vw;top:10vh;background:var(--a2);animation-delay:-6s}.orbs b:nth-child(3){width:30vw;height:30vw;left:30vw;bottom:-14vw;background:var(--a1);opacity:.25;animation-delay:-11s}
.raster{position:absolute;inset:0;z-index:-1;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:64px 64px;mask-image:radial-gradient(ellipse at 50% 40%,#000 20%,transparent 75%);-webkit-mask-image:radial-gradient(ellipse at 50% 40%,#000 20%,transparent 75%);opacity:${dunkel ? ".55" : ".7"}}
@keyframes schweben{to{transform:translate3d(6vw,4vh,0) scale(1.15)}}
.hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:56px;align-items:center}.kicker{display:inline-flex;align-items:center;gap:10px;padding:7px 14px;border-radius:999px;border:1px solid var(--line);background:var(--card);font:600 13px var(--fliess);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.kicker:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--a1);box-shadow:0 0 12px var(--a1);animation:puls 2s infinite}@keyframes puls{50%{opacity:.35}}
.hero h1{margin:22px 0 20px}.hero .sub{font-size:clamp(17px,1.4vw,20px);max-width:560px;color:var(--muted)}.aktionen{display:flex;flex-wrap:wrap;gap:12px;margin-top:34px}
.vertrauen{display:flex;flex-wrap:wrap;gap:22px;margin-top:38px;font-size:14px;color:var(--muted)}.vertrauen span{display:flex;align-items:center;gap:8px}.vertrauen .ic{width:18px;height:18px;color:var(--a1)}
.hero-bild{position:relative;aspect-ratio:4/5;border-radius:calc(var(--r) * 1.6);padding:10px;background:linear-gradient(160deg,color-mix(in srgb,var(--a1) 60%,transparent),transparent 40%,color-mix(in srgb,var(--a2) 60%,transparent));box-shadow:var(--schatten);transform:perspective(1200px) rotateY(-6deg) rotateX(3deg);transition:transform .6s}
.hero-bild:hover{transform:none}.hero-bild>img,.hero-bild>.fb-art{width:100%;height:100%;object-fit:cover;border-radius:calc(var(--r) * 1.3)}
.schwebe{position:absolute;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:16px;border:1px solid var(--line);background:var(--glas);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:var(--schatten);font-size:14px;animation:wippen 6s ease-in-out infinite}
.schwebe b{display:block;font:700 18px var(--kopf)}.schwebe .ic{color:var(--a1)}.schwebe.s1{left:-34px;bottom:14%}.schwebe.s2{right:-22px;top:12%;animation-delay:-3s}@keyframes wippen{50%{transform:translateY(-12px)}}
.laufband{border-block:1px solid var(--line);background:var(--bg2);overflow:hidden;padding:18px 0}.laufband div{display:flex;gap:48px;width:max-content;animation:laufen 32s linear infinite}
.laufband span{display:flex;align-items:center;gap:48px;font:600 clamp(18px,2vw,26px) var(--kopf);white-space:nowrap;color:var(--muted)}.laufband span:after{content:"✦";color:var(--a1)}@keyframes laufen{to{transform:translateX(-50%)}}
section{padding:clamp(80px,10vw,130px) 0}.kopf{max-width:720px;margin-bottom:54px}.kopf p{margin-top:16px;font-size:18px;color:var(--muted)}.marke{display:block;margin-bottom:14px;font:600 13px var(--fliess);letter-spacing:.16em;text-transform:uppercase;color:var(--a1)}
.zahlen{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:56px;position:relative;z-index:2}.zahl{padding:26px;border-radius:var(--r);border:1px solid var(--line);background:var(--glas);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:var(--schatten)}
.zahl b{display:block;font:700 clamp(34px,4vw,50px) var(--kopf)}.zahl>span{color:var(--muted);font-size:15px}
.karten{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}.karte{position:relative;padding:30px 26px;border-radius:var(--r);border:1px solid var(--line);background:var(--card);overflow:hidden;transition:transform .35s,border-color .35s,box-shadow .35s;box-shadow:${dunkel ? "none" : "0 6px 24px rgba(30,40,70,.06)"}}
.karte:before{content:"";position:absolute;inset:0;background:radial-gradient(320px circle at var(--mx,50%) var(--my,0%),color-mix(in srgb,var(--a1) 18%,transparent),transparent 60%);opacity:0;transition:opacity .35s}
.karte:hover{transform:translateY(-6px);border-color:color-mix(in srgb,var(--a1) 55%,transparent);box-shadow:var(--schatten)}.karte:hover:before{opacity:1}
.karte .sym{display:grid;place-items:center;width:54px;height:54px;border-radius:16px;margin-bottom:22px;color:var(--a1);background:color-mix(in srgb,var(--a1) 13%,transparent);border:1px solid color-mix(in srgb,var(--a1) 30%,transparent)}
.karte h3{margin-bottom:10px}.karte p{color:var(--muted);font-size:15px}.karte .preis{display:inline-block;margin-top:18px;font:600 14px var(--fliess);color:var(--a1)}
.ueber{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}.ueber-bild{position:relative;aspect-ratio:5/4;border-radius:calc(var(--r) * 1.4);overflow:hidden;box-shadow:var(--schatten)}.ueber-bild>img,.ueber-bild>.fb-art{width:100%;height:100%;object-fit:cover}
.ueber-bild:after{content:"";position:absolute;inset:auto 0 0;height:40%;background:linear-gradient(transparent,color-mix(in srgb,var(--bg) 70%,transparent))}
.haken{list-style:none;padding:0;margin:28px 0 0;display:grid;gap:14px}.haken li{display:flex;gap:12px;align-items:flex-start}.haken .ic{flex:none;width:26px;height:26px;padding:4px;border-radius:50%;color:${dunkel ? "#000" : "#fff"};background:var(--a1)}
.schritte{display:grid;grid-template-columns:repeat(var(--n,4),1fr);gap:18px;counter-reset:s}.schritt{position:relative;padding:28px 24px 26px;border-top:2px solid var(--line)}.schritt:before{counter-increment:s;content:"0" counter(s);display:block;margin-bottom:16px;font:700 44px var(--kopf);color:transparent;-webkit-text-stroke:1.4px var(--a1)}
.schritt:after{content:"";position:absolute;top:-2px;left:0;height:2px;width:0;background:linear-gradient(90deg,var(--a1),var(--a2));transition:width 1.2s .2s}.schritt.in:after{width:100%}.schritt p{margin-top:8px;color:var(--muted)}
.galerie{display:grid;grid-template-columns:2fr 1fr 1fr;grid-auto-rows:260px;gap:16px}.galerie figure{margin:0;position:relative;border-radius:var(--r);overflow:hidden}.galerie figure:first-child{grid-row:span 2}
.galerie img,.galerie .fb-art{width:100%;height:100%;object-fit:cover;transition:transform .8s}.galerie figure:hover img{transform:scale(1.06)}.galerie figcaption{position:absolute;left:14px;bottom:14px;padding:6px 12px;border-radius:999px;background:var(--glas);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font-size:13px}
.galerie figure:last-child{grid-column:span 2}
.pakete{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:stretch}.paket{display:flex;flex-direction:column;padding:34px 30px;border-radius:calc(var(--r) * 1.2);border:1px solid var(--line);background:var(--card)}
.paket.top{position:relative;border-color:transparent;background:linear-gradient(var(--card),var(--card)) padding-box,linear-gradient(var(--bg2),var(--bg2)) padding-box,linear-gradient(140deg,var(--a1),var(--a2)) border-box;border:1.5px solid transparent;box-shadow:0 24px 70px color-mix(in srgb,var(--a1) 22%,transparent);transform:scale(1.03)}
.paket.top:before{content:"Beliebt";position:absolute;top:-13px;left:30px;padding:4px 12px;border-radius:999px;font:700 12px var(--fliess);letter-spacing:.06em;color:${dunkel ? "#000" : "#fff"};background:linear-gradient(110deg,var(--a1),var(--a2))}
.paket .betrag{margin:14px 0 22px;font:700 34px var(--kopf)}.paket ul{list-style:none;padding:0;margin:0 0 28px;display:grid;gap:10px;flex:1}.paket li{display:flex;gap:10px;color:var(--muted)}.paket li .ic{width:20px;height:20px;color:var(--a1)}.paket .knopf{justify-content:center}
.stimmen{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.stimme{margin:0;padding:30px;border-radius:var(--r);border:1px dashed var(--line);background:var(--card)}.stimme .sterne{color:var(--a1);letter-spacing:3px}.stimme p{margin:14px 0 20px;font-size:17px}
.stimme small{color:var(--muted)}.hinweis{display:inline-block;margin-top:18px;font-size:13px;color:var(--muted)}
.faq{max-width:820px}.faq details{border-bottom:1px solid var(--line)}.faq summary{display:flex;justify-content:space-between;gap:20px;padding:24px 0;font:600 19px var(--kopf);cursor:pointer;list-style:none}.faq summary::-webkit-details-marker{display:none}
.faq summary:after{content:"+";font:300 28px/1 var(--fliess);color:var(--a1);transition:transform .3s}.faq details[open] summary:after{transform:rotate(45deg)}.faq details p{padding:0 0 24px;color:var(--muted);animation:auf .4s}@keyframes auf{from{opacity:0;transform:translateY(-6px)}}
.band{position:relative;overflow:hidden;padding:clamp(48px,7vw,80px);border-radius:calc(var(--r) * 1.8);text-align:center;background:linear-gradient(120deg,color-mix(in srgb,var(--a1) 85%,#000 0%),color-mix(in srgb,var(--a2) 85%,#000 0%));color:${dunkel ? "#0a0a0a" : "#fff"}}
.band:before{content:"";position:absolute;inset:-40%;background:conic-gradient(from 0deg,transparent,rgba(255,255,255,.25),transparent 30%);animation:drehen 9s linear infinite}.band>*{position:relative}@keyframes drehen{to{transform:rotate(1turn)}}
.band p{margin:16px auto 30px;max-width:560px;font-size:18px;opacity:.85}.band .knopf{background:${dunkel ? "#0a0a0a" : "#fff"};color:${dunkel ? "#fff" : "#111"};box-shadow:0 14px 40px rgba(0,0,0,.25)}
.kontakt{display:grid;grid-template-columns:1.1fr .9fr;gap:28px}.formular{display:grid;gap:14px;padding:34px;border-radius:calc(var(--r) * 1.2);border:1px solid var(--line);background:var(--card)}.formular .zwei{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.formular label{display:grid;gap:6px;font-size:14px;color:var(--muted)}.formular input,.formular textarea,.formular select{width:100%;padding:14px 16px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:16px var(--fliess);transition:border-color .2s,box-shadow .2s}
.formular input:focus,.formular textarea:focus,.formular select:focus{outline:0;border-color:var(--a1);box-shadow:0 0 0 4px color-mix(in srgb,var(--a1) 18%,transparent)}.formular .knopf{justify-content:center;margin-top:6px}
.info{display:grid;gap:14px;align-content:start}.info-k{display:flex;gap:16px;padding:22px;border-radius:var(--r);border:1px solid var(--line);background:var(--card)}.info-k .sym{flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:14px;color:var(--a1);background:color-mix(in srgb,var(--a1) 13%,transparent)}
.info-k b{display:block;margin-bottom:4px}.info-k span,.info-k a{color:var(--muted);text-decoration:none}.zeiten{width:100%;border-collapse:collapse;font-size:15px}.zeiten td{padding:4px 0;color:var(--muted)}.zeiten td:last-child{text-align:right;color:var(--text)}
.karte-ort{display:grid;place-items:center;min-height:150px;border-radius:var(--r);border:1px solid var(--line);background:repeating-linear-gradient(45deg,var(--bg2) 0 14px,transparent 14px 28px);text-decoration:none;color:var(--muted)}
footer{padding:64px 0 40px;border-top:1px solid var(--line);background:var(--bg2);font-size:14px;color:var(--muted)}.fuss{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:30px}.fuss h4{margin:0 0 12px;color:var(--text);font:600 15px var(--kopf)}.fuss a{display:block;margin:6px 0;text-decoration:none}.fuss a.logo{display:inline-flex;margin:0}.fuss a:hover{color:var(--a1)}
.unten{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin-top:40px;padding-top:24px;border-top:1px solid var(--line);font-size:13px}.fb-credits{font-size:12px;opacity:.75;max-width:760px}
.fb-art{position:relative;display:grid;place-items:center;min-height:100%;background:radial-gradient(circle at 30% 25%,color-mix(in srgb,var(--a2) 55%,transparent),transparent 55%),radial-gradient(circle at 75% 80%,color-mix(in srgb,var(--a1) 60%,transparent),transparent 55%),var(--bg2);color:var(--text)}
.fb-art:after{content:"";position:absolute;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:32px 32px;opacity:.6}.fb-art .ic{position:relative;z-index:1;width:30%;max-width:120px;height:auto;opacity:.8;stroke-width:1.1;filter:drop-shadow(0 0 18px var(--a1))}
.js .rv{opacity:0;transform:translateY(34px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1);transition-delay:calc(var(--i,0) * 90ms)}.js .rv.in{opacity:1;transform:none}
.oben{position:fixed;right:18px;bottom:18px;z-index:40;display:grid;place-items:center;width:48px;height:48px;border-radius:50%;border:1px solid var(--line);background:var(--glas);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:var(--text);text-decoration:none;opacity:0;pointer-events:none;transition:opacity .3s}.oben.zeig{opacity:1;pointer-events:auto}.oben .ic{transform:rotate(-90deg)}
@media (max-width:1024px){.karten{grid-template-columns:repeat(2,1fr)}.schritte{grid-template-columns:repeat(2,1fr)}}
@media (max-width:860px){.links,.nav .knopf{display:none}.burger{display:block}.nav.auf .links{display:flex;position:absolute;top:calc(100% + 10px);left:0;right:0;flex-direction:column;gap:4px;padding:16px;border:1px solid var(--line);border-radius:22px;background:var(--glas);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:var(--schatten)}
.nav.auf .links a{padding:12px 10px;font-size:18px;color:var(--text)}.nav .wrap{position:relative}.nav.auf .burger span:nth-child(1){transform:translateY(6px) rotate(45deg)}.nav.auf .burger span:nth-child(2){opacity:0}.nav.auf .burger span:nth-child(3){transform:translateY(-6px) rotate(-45deg)}
.hero{padding-top:120px;min-height:auto}.hero-grid,.ueber,.kontakt{grid-template-columns:1fr;gap:40px}.hero-bild{aspect-ratio:4/3;transform:none;max-width:560px}.schwebe.s1{left:8px;bottom:-18px}.schwebe.s2{right:8px;top:-14px}
.zahlen,.pakete,.stimmen{grid-template-columns:1fr}.zahlen{margin-top:32px}.paket.top{transform:none}.galerie{grid-template-columns:1fr 1fr;grid-auto-rows:180px}.galerie figure:first-child{grid-column:span 2;grid-row:span 1}.galerie figure:last-child{grid-column:span 2}.fuss{grid-template-columns:1fr}}
@media (max-width:560px){.karten,.schritte,.formular .zwei{grid-template-columns:1fr}.wrap{width:calc(100% - 32px)}.aktionen .knopf{flex:1 1 auto;justify-content:center;padding:14px 18px;white-space:nowrap}.band{text-align:left}}
@media (prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}.js .rv{opacity:1;transform:none}}`;
}

const JS = `(()=>{const d=document,nav=d.querySelector(".nav"),bar=d.querySelector(".fortschritt"),hoch=d.querySelector(".oben");
const scroll=()=>{const y=scrollY,h=d.documentElement.scrollHeight-innerHeight;nav.classList.toggle("klein",y>30);bar.style.width=(h>0?y/h*100:0)+"%";hoch.classList.toggle("zeig",y>900)};addEventListener("scroll",scroll,{passive:true});scroll();
d.querySelector(".burger").addEventListener("click",e=>{const auf=nav.classList.toggle("auf");e.currentTarget.setAttribute("aria-expanded",auf)});d.querySelectorAll(".links a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("auf")));
const zaehle=el=>{const ziel=+el.dataset.zahl,t0=performance.now(),f=t=>{const k=Math.min(1,(t-t0)/1400);el.textContent=Math.round(ziel*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(f)};requestAnimationFrame(f)};
const io="IntersectionObserver"in window?new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;e.target.classList.add("in");e.target.querySelectorAll("[data-zahl]").forEach(zaehle);io.unobserve(e.target)}),{threshold:.15,rootMargin:"0px 0px -40px"}):null;
d.querySelectorAll(".rv").forEach(el=>io?io.observe(el):el.classList.add("in"));
d.querySelectorAll(".karte").forEach(k=>k.addEventListener("pointermove",e=>{const r=k.getBoundingClientRect();k.style.setProperty("--mx",e.clientX-r.left+"px");k.style.setProperty("--my",e.clientY-r.top+"px")}));
const f=d.querySelector(".formular");f&&f.addEventListener("submit",e=>{e.preventDefault();const v=n=>(f.elements[n]||{}).value||"";location.href="mailto:"+f.dataset.mail+"?subject="+encodeURIComponent("Anfrage über die Webseite")+"&body="+encodeURIComponent("Name: "+v("name")+"\\nE-Mail: "+v("email")+"\\nTelefon: "+v("tel")+"\\n\\n"+v("nachricht"))});
d.querySelectorAll("[data-jahr]").forEach(el=>el.textContent=new Date().getFullYear())})();`;

/** Baut die komplette Seite. Bilder kommen als <img data-bild="…"> und werden danach von webbilder.js gefüllt. */
export function bauVorlage({ auftrag = "", stil, branche, name, ort, eigen } = {}) {
  // Eigene Seite ohne erkannte Branche → persönliche Vorstellung; mit Branche (eigener Betrieb) bleibt der Inhalt, nur ohne Angebot.
  let bId = BRANCHEN[branche] ? branche : erkenneBranche(auftrag);
  if (eigen && bId === "allgemein") bId = "persoenlich";
  const b = BRANCHEN[bId];
  const sId = STILE[stil] ? stil : erkenneStil(auftrag, bId);
  const s = STILE[sId];
  const privat = Boolean(b.ohnePreise);
  const firma = (name || erkenneName(auftrag) || b.beispiel).slice(0, 40);
  const stadt = (ort || erkenneOrt(auftrag)).slice(0, 40);
  const F = esc(firma), O = esc(stadt);
  const initial = esc(firma.replace(/^(salon|studio|praxis|kanzlei|haus|café|cafe|garage|meisterbetrieb)\s+/i, "").charAt(0).toUpperCase() || "F");
  const ic = (i) => b.icons[i % b.icons.length];
  const fonts = [...new Set([s.kopf, s.fliess])].map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700${f === "Archivo" ? ";800;900" : ""}`).join("&");
  const titel = privat ? `${firma}${firma === b.beispiel ? "" : " – Das sind wir"}${stadt ? ` · ${stadt}` : ""}` : `${firma}${stadt ? ` – ${b.name} in ${stadt}` : ` – ${b.name}`}`;
  const beschreibung = `${b.sub.split(".")[0]}. ${firma}${stadt ? ` in ${stadt}` : ""}.`;
  const bild = (q, alt, cls = "") => `<img data-bild="${esc(q)}" data-icon="${ic(0)}" alt="${esc(alt)}"${cls ? ` class="${cls}"` : ""}>`;
  const reihe = (arr) => arr.map((x, i) => x.replace("{i}", String(i)));
  const laufband = b.leistungen.map((l) => `<span>${esc(l[0])}</span>`).join("") + (stadt ? `<span>${O}</span>` : "") + `<span>${esc(b.cta)}</span>`;

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titel)}</title>
<meta name="description" content="${esc(beschreibung)}">
<meta name="theme-color" content="${s.bg}">
<meta property="og:title" content="${esc(titel)}">
<meta property="og:description" content="${esc(beschreibung)}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g"><stop stop-color="${s.a1}"/><stop offset="1" stop-color="${s.a2}"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#g)"/><text x="32" y="44" font-size="34" font-family="Arial" font-weight="700" text-anchor="middle" fill="${s.dunkel ? "#000" : "#fff"}">${initial}</text></svg>`)}">
<script>document.documentElement.classList.add("js")</script>
<style>
${css(s)}
</style>
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": privat ? "WebSite" : "LocalBusiness", name: firma, description: beschreibung, address: stadt ? { "@type": "PostalAddress", addressLocality: stadt } : undefined }).replace(/</g, "\\u003c")}</script>
</head>
<body data-stil="${sId}" data-branche="${bId}">
<div class="fortschritt" aria-hidden="true"></div>
<header class="nav" id="top">
  <div class="wrap">
    <a class="logo" href="#start"><i>${initial}</i>${F}</a>
    <nav class="links" aria-label="Hauptmenü">${privat ? `<a href="#leistungen">Wir</a><a href="#ueber-uns">Über uns</a><a href="#ablauf">Geschichte</a><a href="#galerie">Einblicke</a><a href="#kontakt">Kontakt</a>` : `<a href="#leistungen">Leistungen</a><a href="#ueber-uns">Über uns</a><a href="#preise">Preise</a><a href="#faq">Fragen</a><a href="#kontakt">Kontakt</a>`}</nav>
    <a class="knopf" href="#kontakt">${esc(b.cta)}</a>
    <button class="burger" type="button" aria-label="Menü öffnen" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>
</header>

<main>
<section class="hero" id="start" aria-label="Start">
  <div class="orbs" aria-hidden="true"><b></b><b></b><b></b></div><div class="raster" aria-hidden="true"></div>
  <div class="wrap hero-grid">
    <div>
      <span class="kicker rv">${esc(b.kicker)}${stadt ? ` · ${O}` : ""}</span>
      <h1 class="rv" style="--i:1">${esc(b.h1).replace(/\s(\S+)\.?$/, (m, w) => ` <span class="verlauf">${w}</span>`)}</h1>
      <p class="sub rv" style="--i:2">${esc(b.sub)}</p>
      <div class="aktionen rv" style="--i:3"><a class="knopf" href="#kontakt">${esc(b.cta)} ${svg("pfeil")}</a><a class="knopf leer" href="#leistungen">${privat ? "Mehr über uns" : "Leistungen ansehen"}</a></div>
      <div class="vertrauen rv" style="--i:4">${b.stats.map((x) => `<span>${svg("check")}${esc(x[2])}</span>`).slice(0, 3).join("")}</div>
    </div>
    <div class="hero-bild rv" style="--i:2">
      ${bild(b.bilder.hero, `${b.name} ${firma}`)}
      <div class="schwebe s1">${svg(ic(0))}<div><b>${esc(b.stats[0][0] + b.stats[0][1])}</b>${esc(b.stats[0][2])}</div></div>
      <div class="schwebe s2">${svg(ic(1))}<div><b>${esc(b.leistungen[0][0])}</b>${esc(privat ? "persönlich" : b.leistungen[0][2])}</div></div>
    </div>
  </div>
</section>

<div class="laufband" aria-hidden="true"><div>${laufband}${laufband}</div></div>

<div class="wrap zahlen">
  ${b.stats.map((x, i) => `<div class="zahl rv" style="--i:${i}"><b><span data-zahl="${Number(x[0]) || 0}">${esc(x[0])}</span>${esc(x[1])}</b><span>${esc(x[2])}</span></div>`).join("\n  ")}
</div>

<section id="leistungen" aria-label="${privat ? "Das sind wir" : "Leistungen"}">
  <div class="wrap">
    <div class="kopf rv">${privat ? `<span class="marke">Das sind wir</span><h2>Was uns ausmacht</h2><p>Ein kleiner Einblick in unser Leben, unsere Ideen und unsere Projekte.</p>` : `<span class="marke">Leistungen</span><h2>Was wir für dich tun</h2><p>Alles aus einer Hand, klar erklärt und mit fairen Preisen.</p>`}</div>
    <div class="karten">
      ${b.leistungen.map((l, i) => `<article class="karte rv" style="--i:${i}"><div class="sym">${svg(ic(i))}</div><h3>${esc(l[0])}</h3><p>${esc(l[1])}</p>${l[2] ? `<span class="preis">${esc(l[2])}</span>` : ""}</article>`).join("\n      ")}
    </div>
  </div>
</section>

<section id="ueber-uns" aria-label="Über uns" style="background:var(--bg2)">
  <div class="wrap ueber">
    <div class="ueber-bild rv">${bild(b.bilder.about, `Team von ${firma}`)}</div>
    <div class="rv" style="--i:1">
      <span class="marke">Über uns</span>
      <h2>${F}${stadt ? ` – mitten in ${O}` : ""}</h2>
      ${privat ? `<p class="muted" style="margin-top:18px;font-size:18px">[Erzählt hier eure Geschichte: Wer seid ihr, wie habt ihr euch gefunden, was liebt ihr?] Wir sind neugierig, bauen gern Neues und freuen uns über jeden, der vorbeischaut.</p>
      <ul class="haken"><li>${svg("check")}<span>Echte Menschen, keine Werbung</span></li><li>${svg("check")}<span>Neugierig auf Technik und neue Ideen</span></li><li>${svg("check")}<span>[Was euch noch wichtig ist]</span></li></ul>` : `<p class="muted" style="margin-top:18px;font-size:18px">[Kurz erzählen: Wer steckt dahinter, seit wann gibt es euch, was ist euch wichtig?] Wir nehmen uns Zeit, hören zu und machen nur, was wirklich zu dir passt.</p>
      <ul class="haken">${b.stats.map((x) => `<li>${svg("check")}<span><b>${esc(x[0] + x[1])}</b> ${esc(x[2])}</span></li>`).join("")}<li>${svg("check")}<span>Persönliche Ansprechperson von Anfang bis Ende</span></li></ul>`}
    </div>
  </div>
</section>

<section id="ablauf" aria-label="Ablauf">
  <div class="wrap">
    <div class="kopf rv">${privat ? `<span class="marke">Unsere Geschichte</span><h2>Wie alles kam</h2>` : `<span class="marke">So einfach geht's</span><h2>In ${b.ablauf.length} Schritten zum Ziel</h2>`}</div>
    <div class="schritte" style="--n:${b.ablauf.length}">
      ${b.ablauf.map((a, i) => `<div class="schritt rv" style="--i:${i}"><h3>${esc(a[0])}</h3><p>${esc(a[1])}</p></div>`).join("\n      ")}
    </div>
  </div>
</section>

<section id="galerie" aria-label="Einblicke" style="padding-top:0">
  <div class="wrap">
    <div class="kopf rv"><span class="marke">Einblicke</span><h2>${privat ? "Momente, die uns wichtig sind" : "Ein Blick hinter die Kulissen"}</h2></div>
    <div class="galerie">
      ${reihe([b.bilder.hero, ...b.bilder.galerie].map((q, i) => `<figure class="rv" style="--i:{i}">${bild(i === 0 ? `${q} detail` : q, `${b.name}: Eindruck ${i + 1}`)}<figcaption>${esc([b.leistungen[0][0], b.leistungen[1][0], b.leistungen[2][0], b.leistungen[3][0]][i] || b.name)}</figcaption></figure>`)).join("\n      ")}
    </div>
  </div>
</section>

${privat ? "" : `<section id="preise" aria-label="Preise" style="background:var(--bg2)">
  <div class="wrap">
    <div class="kopf rv"><span class="marke">Preise</span><h2>Klare Pakete. Keine Überraschungen.</h2><p>Alle Preise sind Richtwerte. Du bekommst vorher immer ein verbindliches Angebot.</p></div>
    <div class="pakete">
      ${b.pakete.map((p, i) => `<div class="paket rv${i === 1 ? " top" : ""}" style="--i:${i}"><h3>${esc(p[0])}</h3><div class="betrag">${esc(p[1])}</div><ul>${p[2].map((x) => `<li>${svg("check")}${esc(x)}</li>`).join("")}</ul><a class="knopf${i === 1 ? "" : " leer"}" href="#kontakt">Anfragen</a></div>`).join("\n      ")}
    </div>
  </div>
</section>

<section id="stimmen" aria-label="Kundenstimmen">
  <div class="wrap">
    <div class="kopf rv"><span class="marke">Kundenstimmen</span><h2>Was Kunden sagen</h2></div>
    <div class="stimmen">
      ${[1, 2, 3].map((n, i) => `<figure class="stimme rv" style="--i:${i}"><div class="sterne" aria-hidden="true">★★★★★</div><p>„[Echte Kundenstimme ${n} hier einfügen – zum Beispiel aus Google-Bewertungen, mit Erlaubnis.]“</p><small>[Vorname, Ort]</small></figure>`).join("\n      ")}
    </div>
    <span class="hinweis">Platzhalter: Bitte nur echte Bewertungen mit Zustimmung der Kunden einsetzen.</span>
  </div>
</section>

`}<section id="faq" aria-label="Häufige Fragen" style="padding-top:0">
  <div class="wrap faq">
    <div class="kopf rv"><span class="marke">Fragen</span><h2>Häufige Fragen</h2></div>
    ${b.faq.map((f, i) => `<details class="rv" style="--i:${i}"${i === 0 ? " open" : ""}><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("\n    ")}
  </div>
</section>

<div class="wrap"><div class="band rv">${privat ? `<h2>Lust, Hallo zu sagen?</h2><p>Wir freuen uns über jede Nachricht, ob Idee, Frage oder einfach ein Gruß.</p>` : `<h2>Bereit für den nächsten Schritt?</h2><p>Schreib uns kurz, was du brauchst. Wir melden uns innerhalb von 24 Stunden mit einem klaren Vorschlag.</p>`}<a class="knopf" href="#kontakt">${esc(b.cta)} ${svg("pfeil")}</a></div></div>

<section id="kontakt" aria-label="Kontakt">
  <div class="wrap">
    <div class="kopf rv"><span class="marke">Kontakt</span><h2>Wir freuen uns auf dich</h2></div>
    <div class="kontakt">
      <form class="formular rv" data-mail="[email@firma.de]">
        <div class="zwei"><label>Name<input name="name" autocomplete="name" required></label><label>Telefon<input name="tel" type="tel" autocomplete="tel"></label></div>
        <label>E-Mail<input name="email" type="email" autocomplete="email" required></label>
        <label>Deine Nachricht<textarea name="nachricht" rows="5" placeholder="${privat ? "Was möchtest du uns sagen?" : "Worum geht es? Wunschtermin?"}"></textarea></label>
        <label style="display:flex;gap:10px;align-items:flex-start;font-size:13px"><input type="checkbox" required style="width:auto;margin-top:3px"> Ich bin einverstanden, dass meine Angaben zur Bearbeitung der Anfrage genutzt werden (siehe Datenschutz).</label>
        <button class="knopf" type="submit">Nachricht senden ${svg("pfeil")}</button>
      </form>
      <div class="info rv" style="--i:1">
        <div class="info-k"><div class="sym">${svg("tel")}</div><div><b>Telefon</b><a href="tel:[Telefonnummer]">[Telefonnummer]</a></div></div>
        <div class="info-k"><div class="sym">${svg("mail")}</div><div><b>E-Mail</b><a href="mailto:[email@firma.de]">[email@firma.de]</a></div></div>
        <div class="info-k"><div class="sym">${svg("uhr")}</div><div style="flex:1"><b>${privat ? "Erreichbar" : "Öffnungszeiten"}</b><table class="zeiten">${b.zeiten.map((z) => `<tr><td>${esc(z[0])}</td><td>${esc(z[1])}</td></tr>`).join("")}</table></div></div>
        ${privat ? "" : `<a class="karte-ort" href="https://www.openstreetmap.org/search?query=${encodeURIComponent(`${firma} ${stadt}`.trim())}" target="_blank" rel="noopener">${svg("ort")}&nbsp; [Straße, PLZ ${O || "Ort"}] · Karte öffnen</a>`}
      </div>
    </div>
  </div>
</section>
</main>

<footer>
  <div class="wrap">
    <div class="fuss">
      <div><a class="logo" href="#start"><i>${initial}</i>${F}</a><p style="margin-top:14px;max-width:340px">${esc(b.sub.split(".")[0])}.</p></div>
      <div><h4>Seiten</h4>${privat ? `<a href="#leistungen">Wir</a><a href="#ablauf">Geschichte</a><a href="#galerie">Einblicke</a><a href="#kontakt">Kontakt</a>` : `<a href="#leistungen">Leistungen</a><a href="#preise">Preise</a><a href="#faq">Fragen</a><a href="#kontakt">Kontakt</a>`}</div>
      <div><h4>Rechtliches</h4><a href="#impressum">Impressum [Platzhalter]</a><a href="#datenschutz">Datenschutz [Platzhalter]</a></div>
    </div>
    <div class="unten"><span>© <span data-jahr></span> ${F}. Alle Rechte vorbehalten.</span><span class="fb-credits" data-bildnachweis></span></div>
  </div>
</footer>
<a class="oben" href="#start" aria-label="Nach oben">${svg("pfeil")}</a>
<script>
${JS}
</script>
</body>
</html>
`;
  if (eigen || privat) return { titel, html, angebot: "", preis_eur: null, eigen: true, stil: sId, branche: bId, name: firma, ort: stadt };
  const preis = b.preis;
  const angebot = `Hallo${firma !== b.beispiel ? ` ${firma}` : ""}, ich habe euch eine moderne Webseite entworfen: ${s.name}-Design, perfekt fürs Handy, mit Animationen, ${b.leistungen.length} Leistungen, Preis-Paketen, Ablauf, Galerie, häufigen Fragen und einem Kontaktformular. Texte und Preise sind Vorschläge – ich passe sie mit euren echten Angaben, Fotos und Bewertungen an. Impressum und Datenschutz ergänze ich mit euren Daten. Im Preis enthalten sind zwei Korrekturrunden und die Einrichtung bei eurem Anbieter. Sollen wir kurz telefonieren?`;
  return { titel, html, angebot, preis_eur: preis, stil: sId, branche: bId, name: firma, ort: stadt };
}
