// Gesundheit & Sport. Nur Richtwerte – ersetzt keinen Arzt.
import { nr, zahl, de, heute, tagNr, ausTagNr, datumText, pflichtDatum } from "./hilfe.js";

const G = "Gesundheit & Sport";
const Z = "(\\d[\\d.]*(?:,\\d+)?)";
const ARZT = "Nur ein Richtwert, ersetzt keine ärztliche Beratung.";

const MET = { "Gehen (zügig)": 4.3, Joggen: 8, "Laufen schnell": 11, Radfahren: 7, Schwimmen: 7, Krafttraining: 5, Yoga: 3, Fußball: 7, Tanzen: 5, Wandern: 6, Treppensteigen: 8.8, Putzen: 3.3, Gartenarbeit: 4 };

export default [
  {
    id: "bmi", titel: "BMI-Rechner", icon: "⚖️", gruppe: G,
    info: "Body-Mass-Index mit Einordnung.",
    felder: [{ k: "gewicht", label: "Gewicht kg", typ: "zahl" }, { k: "groesse", label: "Größe cm", typ: "zahl" }],
    sprache: [[new RegExp(`^(?:(?:was ist |wie ist |berechne )?(?:mein |der )?bmi (?:bei |mit |für )?)${Z} ?(?:kg|kilo|kilogramm),? (?:(?:und|bei|mit) )?${Z} ?(cm|zentimeter|m|meter)?$`), (m) => ({ gewicht: m[1], groesse: /^m|meter/.test(m[3] || "") && nr(m[2]) < 3 ? nr(m[2]) * 100 : m[2] })]],
    run(e) {
      const kg = zahl(e, "gewicht", "das Gewicht", { min: 20, max: 400 }); let cm = zahl(e, "groesse", "die Größe", { min: 1, max: 260 });
      if (cm < 3) cm *= 100;
      const b = kg / (cm / 100) ** 2;
      const k = b < 18.5 ? "Untergewicht" : b < 25 ? "Normalgewicht" : b < 30 ? "Übergewicht" : "starkes Übergewicht (Adipositas)";
      return { text: `Dein BMI ist ${de(b, 1)}, das gilt als ${k}. Normal ist 18,5 bis 25, also ${de(18.5 * (cm / 100) ** 2, 0)} bis ${de(25 * (cm / 100) ** 2, 0)} Kilo bei deiner Größe.`, hinweis: ARZT };
    },
  },
  {
    id: "kalorienbedarf", titel: "Kalorienbedarf", icon: "🍽️", gruppe: G,
    info: "Täglicher Kalorienbedarf (Mifflin-St-Jeor) – zum Halten, Ab- oder Zunehmen.",
    felder: [{ k: "geschlecht", label: "Geschlecht", typ: "wahl", optionen: ["Mann", "Frau"], standard: "Mann" }, { k: "alter", label: "Alter", typ: "zahl" }, { k: "gewicht", label: "Gewicht kg", typ: "zahl" }, { k: "groesse", label: "Größe cm", typ: "zahl" }, { k: "aktiv", label: "Aktivität", typ: "wahl", optionen: ["kaum Bewegung", "leicht aktiv", "mäßig aktiv", "sehr aktiv", "extrem aktiv"], standard: "leicht aktiv" }],
    run(e) {
      const a = zahl(e, "alter", "das Alter", { min: 10, max: 120 }), kg = zahl(e, "gewicht", "das Gewicht", { min: 20, max: 400 }), cm = zahl(e, "groesse", "die Größe", { min: 100, max: 260 });
      const grund = 10 * kg + 6.25 * cm - 5 * a + (e.geschlecht === "Frau" ? -161 : 5);
      const f = { "kaum Bewegung": 1.2, "leicht aktiv": 1.375, "mäßig aktiv": 1.55, "sehr aktiv": 1.725, "extrem aktiv": 1.9 }[e.aktiv] || 1.375;
      const ges = grund * f;
      return { text: `Dein Grundumsatz liegt bei etwa ${de(grund, 0)} Kalorien. Mit deiner Aktivität brauchst du rund ${de(ges, 0)} Kalorien am Tag. Zum Abnehmen etwa ${de(ges - 500, 0)}, zum Zunehmen ${de(ges + 300, 0)}.`, hinweis: ARZT };
    },
  },
  {
    id: "wasserbedarf", titel: "Wasserbedarf", icon: "💧", gruppe: G,
    info: "Wie viel du am Tag trinken solltest.",
    felder: [{ k: "gewicht", label: "Gewicht kg", typ: "zahl" }, { k: "sport", label: "Sport heute (Minuten)", typ: "zahl", standard: "0" }, { k: "hitze", label: "Heißer Tag?", typ: "wahl", optionen: ["nein", "ja"], standard: "nein" }],
    sprache: [[new RegExp(`^wie ?viel (?:wasser )?(?:soll|sollte|muss) ich (?:am tag |täglich |pro tag )?trinken(?:,? (?:bei|mit|wenn ich) ${Z} ?(?:kg|kilo)(?: wiege)?)?$`), (m) => ({ gewicht: m[1] || 75 })]],
    run(e) {
      const kg = zahl(e, "gewicht", "das Gewicht", { min: 20, max: 300 });
      const l = kg * 0.033 + ((nr(e.sport) || 0) / 30) * 0.35 + (e.hitze === "ja" ? 0.5 : 0);
      return { text: `Bei ${de(kg, 0)} Kilo solltest du etwa ${de(l, 1)} Liter am Tag trinken, das sind ungefähr ${Math.round(l / 0.25)} Gläser.`, hinweis: ARZT };
    },
  },
  {
    id: "herzfrequenz", titel: "Puls-Zonen", icon: "❤️", gruppe: G,
    info: "Trainings-Zonen nach Alter (und Ruhepuls, wenn bekannt).",
    felder: [{ k: "alter", label: "Alter", typ: "zahl" }, { k: "ruhepuls", label: "Ruhepuls (optional)", typ: "zahl" }],
    sprache: [[/^(?:meine |die )?(?:puls|herzfrequenz|trainings)[- ]?zonen?(?: (?:mit|bei|für) (\d+)(?: jahren?)?)?$|^(?:was ist mein |wie hoch ist mein )?maximal(?:er)? ?puls(?: mit| bei)? (\d+)(?: jahren?)?$/, (m) => ({ alter: m[1] || m[2] })]],
    run(e) {
      const a = zahl(e, "alter", "das Alter", { min: 10, max: 110 }), max = 208 - 0.7 * a, ruhe = nr(e.ruhepuls);
      const zone = (p1, p2) => ruhe ? [ruhe + (max - ruhe) * p1, ruhe + (max - ruhe) * p2] : [max * p1, max * p2];
      const Zn = [["Regeneration", 0.5, 0.6], ["Fettverbrennung / Grundlage", 0.6, 0.7], ["Ausdauer", 0.7, 0.8], ["Schwelle", 0.8, 0.9], ["Maximum", 0.9, 1]];
      const zeilen = Zn.map(([n, a1, a2]) => { const [x, y] = zone(a1, a2); return [n, `${Math.round(x)} – ${Math.round(y)}`]; });
      return { text: `Dein Maximalpuls liegt bei etwa ${Math.round(max)}. Für lockere Ausdauer bleib bei ${zeilen[1][1]} Schlägen pro Minute.`, tabelle: { kopf: ["Zone", "Puls"], zeilen }, hinweis: ARZT };
    },
  },
  {
    id: "lauftempo", titel: "Lauf-Tempo (Pace)", icon: "🏃", gruppe: G,
    info: "Pace, Zielzeit oder Geschwindigkeit fürs Laufen und Radeln.",
    felder: [{ k: "km", label: "Strecke km", typ: "zahl" }, { k: "zeit", label: "Zeit (mm:ss oder h:mm:ss)", typ: "text", platzhalter: "55:00" }],
    sprache: [[new RegExp(`^(?:welche |was ist (?:die |meine )?)?pace (?:für|bei) ${Z} ?(?:km|kilometer) in (\\d+) minuten$|^(?:wie schnell (?:muss ich|bin ich),? (?:wenn ich|um) )${Z} ?(?:km|kilometer) in (\\d+) minuten(?: laufe| zu laufen)?$`), (m) => ({ km: m[1] || m[3], zeit: `${m[2] || m[4]}:00` })]],
    run(e) {
      const km = zahl(e, "km", "die Strecke", { min: 0.1, max: 1000 });
      const t = String(e.zeit || "").trim().split(":").map(Number);
      if (!t.length || t.some((x) => !Number.isFinite(x))) throw new Error("Bitte gib die Zeit an, z. B. 55:00 oder 1:45:00.");
      const sek = t.length === 3 ? t[0] * 3600 + t[1] * 60 + t[2] : t.length === 2 ? t[0] * 60 + t[1] : t[0] * 60;
      const pace = sek / km, kmh = km / (sek / 3600);
      const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
      return { text: `Das ist eine Pace von ${mmss(pace)} Minuten pro Kilometer, also ${de(kmh, 1)} km/h. Hochgerechnet: 5 km in ${mmss(pace * 5)}, 10 km in ${mmss(pace * 10)}.` };
    },
  },
  {
    id: "kalorien_sport", titel: "Kalorien beim Sport", icon: "🔥", gruppe: G,
    info: "Wie viele Kalorien eine Aktivität verbrennt.",
    felder: [{ k: "aktivitaet", label: "Aktivität", typ: "wahl", optionen: Object.keys(MET), standard: "Joggen" }, { k: "minuten", label: "Minuten", typ: "zahl", standard: "30" }, { k: "gewicht", label: "Gewicht kg", typ: "zahl", standard: "75" }],
    sprache: [[new RegExp(`^wie ?viele kalorien (?:verbrenne ich|verbrennt man) (?:beim |bei )?(gehen|joggen|laufen|radfahren|fahrrad fahren|schwimmen|krafttraining|yoga|fußball|tanzen|wandern|treppensteigen|putzen|gartenarbeit)(?: in| für)? ?(\\d+)? ?(?:minuten)?$`), (m) => ({ aktivitaet: { gehen: "Gehen (zügig)", laufen: "Joggen", "fahrrad fahren": "Radfahren" }[m[1]] || m[1][0].toUpperCase() + m[1].slice(1), minuten: m[2] || 30 })]],
    run(e) {
      const met = MET[e.aktivitaet] ?? 6, min = zahl(e, "minuten", "die Minuten", { min: 1, max: 1440 }), kg = nr(e.gewicht) || 75;
      const kcal = (met * 3.5 * kg * min) / 200;
      return { text: `${e.aktivitaet || "Sport"} für ${de(min, 0)} Minuten verbrennt bei ${de(kg, 0)} Kilo etwa ${de(kcal, 0)} Kalorien.`, hinweis: "Grobe Schätzung." };
    },
  },
  {
    id: "geburtstermin", titel: "Geburtstermin", icon: "👶", gruppe: G,
    info: "Errechneter Geburtstermin und aktuelle Schwangerschaftswoche (Naegele-Regel).",
    felder: [{ k: "periode", label: "Erster Tag der letzten Periode", typ: "datum" }, { k: "zyklus", label: "Zykluslänge Tage", typ: "zahl", standard: "28" }],
    run(e) {
      const p = pflichtDatum(e, "periode", "den ersten Tag der letzten Periode"), z = nr(e.zyklus) || 28;
      const et = ausTagNr(tagNr(p) + 280 + (z - 28)), tage = tagNr(heute()) - tagNr(p) - (z - 28);
      const ssw = Math.floor(tage / 7), rest = tage % 7;
      return { text: `Der errechnete Geburtstermin ist ${datumText(et)}.${tage >= 0 && tage < 300 ? ` Heute ist SSW ${ssw}+${rest}, noch ${Math.max(0, tagNr(et) - tagNr(heute()))} Tage.` : ""}`, hinweis: "Nur ein Richtwert. Den genauen Termin bestimmt die Frauenärztin oder Hebamme." };
    },
  },
];
