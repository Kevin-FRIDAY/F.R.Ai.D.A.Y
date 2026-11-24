// Büro & Verträge. Nur prüfen und rechnen – Friday überweist nie selbst Geld.
import { nr, zahl, text, de, eur, heute, tagNr, ausTagNr, wochentag, datumText, datum, pflichtDatum } from "./hilfe.js";
import { feiertageOffline } from "../offline-plus.js";

const G = "Büro & Verträge";

const IBAN_LAENGE = { DE: 22, AT: 20, CH: 21, FR: 27, IT: 27, ES: 24, NL: 18, BE: 16, LU: 20, PL: 28, CZ: 24, DK: 18, SE: 24, NO: 15, FI: 18, GB: 22, IE: 22, PT: 25, GR: 27, HR: 21, HU: 28, LT: 20, LV: 21, EE: 20, SK: 24, SI: 19, MT: 31, CY: 28, LI: 21, TR: 26, RO: 24, BG: 22 };

const CHECKLISTEN = {
  Umzug: ["Mietvertrag kündigen (meist 3 Monate Frist)", "Umzugstermin festlegen, Urlaub nehmen", "Helfer oder Umzugsfirma organisieren", "Halteverbotszone beantragen", "Kartons, Klebeband, Folie besorgen", "Ausmisten und Sperrmüll anmelden", "Nachsendeauftrag bei der Post", "Strom, Gas, Internet ummelden", "Zählerstände fotografieren (alt und neu)", "Wohnungsübergabe mit Protokoll", "Innerhalb von 2 Wochen beim Bürgeramt ummelden", "Neue Adresse an Bank, Versicherungen, Arbeitgeber, Krankenkasse", "KFZ-Papiere aktualisieren", "Rundfunkbeitrag ummelden", "Kaution zurückfordern"],
  "Urlaub – Haus verlassen": ["Pass/Ausweis gültig?", "Auslandskrankenversicherung", "Nachbarn Bescheid geben, Briefkasten leeren lassen", "Pflanzen versorgen lassen", "Kühlschrank leeren", "Fenster schließen", "Wasserhähne zu, Geräte vom Strom", "Heizung runter", "Mülltonnen raus/rein klären", "Abwesenheitsnotiz in der Mail", "Zeitschaltuhr fürs Licht", "Ladegeräte und Adapter einpacken"],
  "Neues Auto": ["Versicherung abschließen (eVB-Nummer)", "Zulassung beim Straßenverkehrsamt", "Kennzeichen prägen lassen", "Kfz-Steuer per SEPA-Mandat", "Alte Versicherung kündigen oder übertragen", "Warnweste, Warndreieck, Verbandskasten prüfen", "Reifen (Winter/Sommer) und Reifendruck prüfen", "Termin für erste Inspektion merken"],
  "Kliniktasche Geburt": ["Mutterpass", "Krankenkassenkarte, Personalausweis", "Familienstammbuch/Geburtsurkunde", "Bequeme Kleidung, Bademantel", "Still-BH, Stilleinlagen", "Große Binden, Netzunterhosen", "Hausschuhe, Socken", "Handy-Ladekabel (langes)", "Snacks und Getränke", "Babykleidung für die Heimfahrt", "Babyschale fürs Auto"],
  "Party planen": ["Datum und Gästeliste", "Einladungen verschicken", "Zu- und Absagen sammeln", "Essen und Getränke planen", "Einkaufsliste", "Musik/Playlist", "Deko", "Geschirr, Gläser, Servietten", "Nachbarn informieren", "Aufräum-Helfer fragen"],
  Jahresende: ["Steuerunterlagen sammeln", "Freistellungsauftrag prüfen", "Versicherungen prüfen und vergleichen", "Abos aufräumen (siehe Abo-Kosten)", "Urlaubstage fürs neue Jahr planen (Brückentage!)", "Passwörter erneuern", "Backups prüfen", "Handwerkerrechnungen für die Steuer bezahlen", "Spenden für die Steuer bis 31.12."],
  "Neue Wohnung einziehen": ["Namensschild an Briefkasten und Klingel", "Rauchmelder prüfen", "Internetanschluss beauftragen", "Hausratversicherung anpassen", "Mülltrennung im Haus erfragen", "Hausordnung lesen", "Nachbarn vorstellen", "Schlüssel nachmachen lassen (Ersatz)"],
};

function feiertagSet(y1, y2) { const s = new Set(); for (let y = y1; y <= y2; y++) for (const f of feiertageOffline(y)) s.add(f.datum); return s; }
const iso = (t) => `${t.y}-${String(t.m).padStart(2, "0")}-${String(t.d).padStart(2, "0")}`;
const monatsEnde = (y, m) => ausTagNr(tagNr({ y: m === 12 ? y + 1 : y, m: m === 12 ? 1 : m + 1, d: 1 }) - 1);
function plusMonate(t, n) { const g = t.y * 12 + t.m - 1 + n, y = Math.floor(g / 12), m = (g % 12) + 1; return { y, m, d: Math.min(t.d, monatsEnde(y, m).d) }; }

export default [
  {
    id: "iban_pruefen", titel: "IBAN prüfen", icon: "🏦", gruppe: G,
    info: "Prüft eine IBAN auf Tippfehler (Prüfziffer) und zeigt Bankleitzahl und Kontonummer. Nur Prüfung, keine Überweisung.",
    felder: [{ k: "iban", label: "IBAN", typ: "text", platzhalter: "DE89 3704 0044 0532 0130 00" }],
    run(e) {
      const s = text(e, "iban", "eine IBAN", { max: 50 }).toUpperCase().replace(/[\s-]/g, "");
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(s)) throw new Error("Das sieht nicht wie eine IBAN aus.");
      const land = s.slice(0, 2), soll = IBAN_LAENGE[land];
      if (soll && s.length !== soll) return { text: `Diese IBAN ist ungültig: Für ${land} braucht sie ${soll} Zeichen, sie hat aber ${s.length}.` };
      const num = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
      let rest = 0; for (const ch of num) rest = (rest * 10 + +ch) % 97;
      const schoen = s.replace(/(.{4})/g, "$1 ").trim();
      if (rest !== 1) return { text: `Achtung: Die IBAN ${schoen} ist ungültig. Wahrscheinlich ein Tippfehler.` };
      return { text: `Die IBAN ${schoen} ist gültig.${land === "DE" ? ` Bankleitzahl ${s.slice(4, 12)}, Kontonummer ${s.slice(12).replace(/^0+/, "")}.` : ""}`, ergebnis: schoen, hinweis: "Die Prüfung erkennt Tippfehler, aber nicht, ob das Konto wirklich existiert oder wem es gehört." };
    },
  },
  {
    id: "kuendigungsfrist", titel: "Kündigungsfrist", icon: "📮", gruppe: G,
    info: "Bis wann du kündigen musst – oder wann der Vertrag frühestens endet.",
    felder: [
      { k: "modus", label: "Was willst du wissen?", typ: "wahl", optionen: ["Wann endet der Vertrag, wenn ich am … kündige?", "Bis wann muss ich kündigen, damit er zum … endet?"], standard: "Wann endet der Vertrag, wenn ich am … kündige?" },
      { k: "datum", label: "Datum (Kündigung bzw. Wunsch-Ende)", typ: "datum", standard: "heute" },
      { k: "frist", label: "Frist", typ: "zahl", standard: "3" }, { k: "einheit", label: "Einheit", typ: "wahl", optionen: ["Monate", "Wochen", "Tage"], standard: "Monate" },
      { k: "zum", label: "Kündigung zum …", typ: "wahl", optionen: ["Monatsende", "Quartalsende", "Jahresende", "beliebigen Tag", "Mietwohnung (bis 3. Werktag)"], standard: "Monatsende" },
    ],
    run(e) {
      const d = pflichtDatum(e, "datum", "das Datum"), f = Math.round(zahl(e, "frist", "die Frist", { min: 0, max: 120 })), ein = e.einheit || "Monate", zum = e.zum || "Monatsende";
      const plus = (t, n) => (ein === "Monate" ? plusMonate(t, n) : ausTagNr(tagNr(t) + n * (ein === "Wochen" ? 7 : 1)));
      const aufStichtag = (t) => {
        if (zum === "beliebigen Tag") return t;
        if (zum === "Jahresende") return { y: t.m === 12 && t.d === 31 ? t.y : t.y, m: 12, d: 31 };
        if (zum === "Quartalsende") { const q = Math.ceil(t.m / 3) * 3; return monatsEnde(t.y, q); }
        return monatsEnde(t.y, t.m);
      };
      if (zum.startsWith("Mietwohnung")) {
        // § 573c BGB: Kündigung bis zum 3. Werktag eines Monats → Ende des übernächsten Monats. Samstag zählt nicht mit (BGH).
        const ft = feiertagSet(d.y, d.y + 1);
        const werktag3 = (y, m) => { let n = 0, k = tagNr({ y, m, d: 1 }); for (;;) { const t = ausTagNr(k), w = wochentag(t); if (w !== 0 && w !== 6 && !ft.has(iso(t))) { n++; if (n === 3) return t; } k++; } };
        if (String(e.modus).startsWith("Bis wann")) {
          const zielMonat = { y: d.y, m: d.m }, start = plusMonate({ ...zielMonat, d: 1 }, -2), w3 = werktag3(start.y, start.m);
          return { text: `Damit die Wohnung zum ${datumText(monatsEnde(d.y, d.m), { mitTag: false })} gekündigt ist, muss die Kündigung spätestens am ${datumText(w3)} beim Vermieter sein.`, hinweis: "Gesetzliche Frist für Mieter. Der Zugang zählt, nicht das Absendedatum." };
        }
        const w3 = werktag3(d.y, d.m), versatz = tagNr(d) <= tagNr(w3) ? 2 : 3, ende = monatsEnde(plusMonate({ y: d.y, m: d.m, d: 1 }, versatz).y, plusMonate({ y: d.y, m: d.m, d: 1 }, versatz).m);
        return { text: `Kommt die Kündigung am ${datumText(d, { mitTag: false })} an, endet das Mietverhältnis am ${datumText(ende)}.${versatz === 3 ? ` Der 3. Werktag war schon am ${datumText(w3, { mitTag: false })}, darum ein Monat später.` : ""}`, hinweis: "Gesetzliche Frist für Mieter. Der Zugang zählt, nicht das Absendedatum." };
      }
      if (String(e.modus).startsWith("Bis wann")) {
        const ziel = aufStichtag(d), minus = ein === "Monate" ? plusMonate(ziel, -f) : ausTagNr(tagNr(ziel) - f * (ein === "Wochen" ? 7 : 1));
        const spaet = zum === "beliebigen Tag" ? minus : ein === "Monate" && ziel.d === monatsEnde(ziel.y, ziel.m).d ? monatsEnde(minus.y, minus.m) : minus;
        return { text: `Damit der Vertrag zum ${datumText(ziel, { mitTag: false })} endet, muss die Kündigung spätestens am ${datumText(spaet)} beim Anbieter sein.`, hinweis: "Der Zugang beim Empfänger zählt. Im Zweifel ein paar Tage früher schicken." };
      }
      const ende = aufStichtag(plus(d, f));
      return { text: `Bei Kündigung am ${datumText(d, { mitTag: false })} mit ${f} ${ein} Frist zum ${zum} endet der Vertrag am ${datumText(ende)}.`, hinweis: "Seit März 2022 können viele Verträge nach der Mindestlaufzeit mit 1 Monat Frist gekündigt werden (Fairer-Verbraucherverträge-Gesetz)." };
    },
  },
  {
    id: "meeting_kosten", titel: "Was kostet das Meeting?", icon: "🕴️", gruppe: G,
    info: "Rechnet aus, was ein Termin an Arbeitszeit kostet.",
    felder: [{ k: "personen", label: "Teilnehmer", typ: "zahl", standard: "6" }, { k: "stundensatz", label: "Ø Stundensatz € (mit Nebenkosten)", typ: "zahl", standard: "60" }, { k: "minuten", label: "Dauer Minuten", typ: "zahl", standard: "60" }, { k: "pro_woche", label: "Wie oft pro Woche?", typ: "zahl", standard: "1" }],
    run(e) {
      const p = zahl(e, "personen", "die Teilnehmer", { min: 1 }), s = nr(e.stundensatz) || 60, m = zahl(e, "minuten", "die Dauer", { min: 1 }), w = nr(e.pro_woche) ?? 1;
      const k = (p * s * m) / 60;
      return { text: `Dieses Meeting kostet ${eur(k)}${w > 0 ? `, im Jahr bei ${de(w)} pro Woche etwa ${eur(k * w * 46)}` : ""}. Jede eingesparte Viertelstunde spart ${eur((p * s) / 4)}.` };
    },
  },
  {
    id: "dienstreise", titel: "Dienstreise & Pendeln", icon: "🚗", gruppe: G,
    info: "Kilometergeld und Verpflegungspauschale (Inland) für die Reisekosten-Abrechnung.",
    felder: [{ k: "km", label: "Gefahrene km (gesamt)", typ: "zahl", standard: "0" }, { k: "tage", label: "Volle Reisetage (24 h)", typ: "zahl", standard: "0" }, { k: "anabreise", label: "An-/Abreisetage", typ: "zahl", standard: "0" }, { k: "eintaegig", label: "Eintägige Reisen über 8 h", typ: "zahl", standard: "0" }, { k: "fruehstueck", label: "Gestelltes Frühstück (Anzahl)", typ: "zahl", standard: "0" }],
    run(e) {
      const km = nr(e.km) || 0, voll = nr(e.tage) || 0, an = nr(e.anabreise) || 0, ein = nr(e.eintaegig) || 0, fr = nr(e.fruehstueck) || 0;
      const fahrt = km * 0.3, verpfl = Math.max(0, voll * 28 + (an + ein) * 14 - fr * 5.6);
      if (!km && !voll && !an && !ein) throw new Error("Bitte gib Kilometer oder Reisetage an.");
      return { text: `Erstattungsfähig: ${eur(fahrt)} Kilometergeld und ${eur(verpfl)} Verpflegungspauschale, zusammen ${eur(fahrt + verpfl)}.`, tabelle: { kopf: ["Posten", "Betrag"], zeilen: [[`${de(km, 0)} km × 0,30 €`, eur(fahrt)], [`${de(voll)} volle Tage × 28 €`, eur(voll * 28)], [`${de(an + ein)} Tage × 14 €`, eur((an + ein) * 14)], [`${de(fr)} × Frühstück −5,60 €`, eur(-fr * 5.6)]] }, hinweis: "Pauschalen für Deutschland, Stand 2025/2026. Für die Steuer gilt beim Pendeln die Entfernungspauschale – bitte im aktuellen Steuerjahr nachprüfen." };
    },
  },
  {
    id: "checkliste", titel: "Checklisten", icon: "✅", gruppe: G,
    info: "Fertige Checklisten: Umzug, Urlaub, neues Auto, Kliniktasche, Party, Jahresende, Einzug.",
    felder: [{ k: "liste", label: "Checkliste", typ: "wahl", optionen: Object.keys(CHECKLISTEN), standard: "Umzug" }],
    sprache: [[/^(?:zeig mir |gib mir |mach mir |ich brauche )?(?:eine |die )?checkliste (?:für |zum |zur |fürs |für den |für die |für das )?(umzug|urlaub|neues auto|auto|kliniktasche|geburt|party|jahresende|einzug|neue wohnung)$/, (m) => ({ liste: { umzug: "Umzug", urlaub: "Urlaub – Haus verlassen", "neues auto": "Neues Auto", auto: "Neues Auto", kliniktasche: "Kliniktasche Geburt", geburt: "Kliniktasche Geburt", party: "Party planen", jahresende: "Jahresende", einzug: "Neue Wohnung einziehen", "neue wohnung": "Neue Wohnung einziehen" }[m[1]] })]],
    run(e) {
      const n = CHECKLISTEN[e.liste] ? e.liste : "Umzug";
      return { text: `Die Checkliste „${n}“ hat ${CHECKLISTEN[n].length} Punkte. Ich zeige sie dir zum Abhaken.`, zeilen: CHECKLISTEN[n], checkliste: true, zeigen: true };
    },
  },
];
