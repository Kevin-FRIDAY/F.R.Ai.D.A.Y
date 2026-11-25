// Sprach-Trainer (v1.166.0, Stern-Idee aus der Ideen-Schmiede).
// Jeden Tag 5 neue Wörter (Englisch, Spanisch, Französisch, Italienisch). "Friday, frag mich Vokabeln ab":
// Friday fragt per Sprache, hört die Antwort ab (Mikro bleibt an) und wiederholt, was noch hakt (Lernkartei
// mit 5 Fächern: falsch → Fach 1, richtig → ein Fach weiter, Fach 1 täglich, Fach 5 nach 2 Wochen). Ohne Claude.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { sauber, tagStr } from "./wunsch-hilfe.js";

const DATEI = "sprachtrainer";
export const SPRACHEN = { en: "Englisch", es: "Spanisch", fr: "Französisch", it: "Italienisch" };
// [Deutsch, Englisch, Spanisch, Französisch, Italienisch]
const WOERTER = [
  ["Hund", "dog", "perro", "chien", "cane"], ["Katze", "cat", "gato", "chat", "gatto"], ["Haus", "house", "casa", "maison", "casa"],
  ["Wasser", "water", "agua", "eau", "acqua"], ["Brot", "bread", "pan", "pain", "pane"], ["Apfel", "apple", "manzana", "pomme", "mela"],
  ["Auto", "car", "coche", "voiture", "macchina"], ["Buch", "book", "libro", "livre", "libro"], ["Freund", "friend", "amigo", "ami", "amico"],
  ["Stadt", "city", "ciudad", "ville", "città"], ["Straße", "street", "calle", "rue", "strada"], ["Baum", "tree", "árbol", "arbre", "albero"],
  ["Sonne", "sun", "sol", "soleil", "sole"], ["Mond", "moon", "luna", "lune", "luna"], ["Tag", "day", "día", "jour", "giorno"],
  ["Nacht", "night", "noche", "nuit", "notte"], ["Zeit", "time", "tiempo", "temps", "tempo"], ["Arbeit", "work", "trabajo", "travail", "lavoro"],
  ["Geld", "money", "dinero", "argent", "soldi"], ["Familie", "family", "familia", "famille", "famiglia"], ["Kind", "child", "niño", "enfant", "bambino"],
  ["Frau", "woman", "mujer", "femme", "donna"], ["Mann", "man", "hombre", "homme", "uomo"], ["Schule", "school", "escuela", "école", "scuola"],
  ["Essen", "food", "comida", "nourriture", "cibo"], ["Milch", "milk", "leche", "lait", "latte"], ["Käse", "cheese", "queso", "fromage", "formaggio"],
  ["Fisch", "fish", "pescado", "poisson", "pesce"], ["Fleisch", "meat", "carne", "viande", "carne"], ["Zucker", "sugar", "azúcar", "sucre", "zucchero"],
  ["Tür", "door", "puerta", "porte", "porta"], ["Fenster", "window", "ventana", "fenêtre", "finestra"], ["Tisch", "table", "mesa", "table", "tavolo"],
  ["Stuhl", "chair", "silla", "chaise", "sedia"], ["Bett", "bed", "cama", "lit", "letto"], ["Küche", "kitchen", "cocina", "cuisine", "cucina"],
  ["Meer", "sea", "mar", "mer", "mare"], ["Berg", "mountain", "montaña", "montagne", "montagna"], ["Fluss", "river", "río", "rivière", "fiume"],
  ["Regen", "rain", "lluvia", "pluie", "pioggia"], ["Schnee", "snow", "nieve", "neige", "neve"], ["Wind", "wind", "viento", "vent", "vento"],
  ["rot", "red", "rojo", "rouge", "rosso"], ["blau", "blue", "azul", "bleu", "blu"], ["grün", "green", "verde", "vert", "verde"],
  ["groß", "big", "grande", "grand", "grande"], ["klein", "small", "pequeño", "petit", "piccolo"], ["schnell", "fast", "rápido", "rapide", "veloce"],
  ["langsam", "slow", "lento", "lent", "lento"], ["heiß", "hot", "caliente", "chaud", "caldo"], ["kalt", "cold", "frío", "froid", "freddo"],
  ["gut", "good", "bueno", "bon", "buono"], ["schön", "beautiful", "bonito", "beau", "bello"], ["neu", "new", "nuevo", "nouveau", "nuovo"],
  ["alt", "old", "viejo", "vieux", "vecchio"], ["essen", "to eat", "comer", "manger", "mangiare"], ["trinken", "to drink", "beber", "boire", "bere"],
  ["schlafen", "to sleep", "dormir", "dormir", "dormire"], ["gehen", "to go", "ir", "aller", "andare"], ["sprechen", "to speak", "hablar", "parler", "parlare"],
  ["sehen", "to see", "ver", "voir", "vedere"], ["kaufen", "to buy", "comprar", "acheter", "comprare"], ["lernen", "to learn", "aprender", "apprendre", "imparare"],
  ["Flughafen", "airport", "aeropuerto", "aéroport", "aeroporto"], ["Bahnhof", "train station", "estación", "gare", "stazione"], ["Rechnung", "bill", "cuenta", "addition", "conto"],
  ["Frühstück", "breakfast", "desayuno", "petit-déjeuner", "colazione"], ["Kaffee", "coffee", "café", "café", "caffè"], ["Bier", "beer", "cerveza", "bière", "birra"],
  ["Hilfe", "help", "ayuda", "aide", "aiuto"], ["Arzt", "doctor", "médico", "médecin", "medico"], ["Schlüssel", "key", "llave", "clé", "chiave"],
  ["Woche", "week", "semana", "semaine", "settimana"], ["Jahr", "year", "año", "an", "anno"], ["heute", "today", "hoy", "aujourd'hui", "oggi"],
  ["morgen", "tomorrow", "mañana", "demain", "domani"], ["gestern", "yesterday", "ayer", "hier", "ieri"], ["danke", "thank you", "gracias", "merci", "grazie"],
];
const IDX = { en: 1, es: 2, fr: 3, it: 4 };
const ABSTAND = [0, 1, 2, 4, 7, 14]; // Tage je Fach
const PRO_TAG = 5;
const RUNDE = 8;

const laden = () => ({ sprache: "en", karten: {}, neuHeute: { tag: "", n: 0 }, verlauf: [], ...store.load(DATEI, {}) });
const sichern = (d) => store.save(DATEI, d);
let abfrage = null; // { bis, sprache, liste:[deutsch], i, richtig, falsch, versuch }

const ohneAkzent = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z' -]/g, " ").replace(/\s+/g, " ").trim();
const ARTIKEL = /^(the|a|an|to|el|la|los|las|un|una|le|les|l'|une|il|lo|gli|i|uno)\s+|^l'|^(the|el|la|le|il) /;
export function stimmt(antwort, soll) {
  const a = ohneAkzent(antwort).replace(/^(das heisst|es heisst|heisst|ich glaube|vielleicht|das ist|ist)\s+/, "").replace(ARTIKEL, "").trim();
  const s = ohneAkzent(soll).replace(ARTIKEL, "").trim();
  if (!a) return false;
  if (a === s || a.split(" ").includes(s) || (s.includes(" ") && a.includes(s))) return true;
  // kleiner Tippfehler / Spracherkennung (ein Buchstabe daneben bei Wörtern ab 5 Buchstaben)
  return s.length >= 5 && levenshtein(a, s) <= 1;
}
function levenshtein(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}
const wort = (de, sp) => { const w = WOERTER.find((x) => x[0] === de); return w ? w[IDX[sp]] : ""; };
const tageZwischen = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

/** Heute fällige Karten + bis zu 5 neue Wörter. */
export function faellig(d = laden()) {
  const sp = d.sprache;
  const karten = d.karten[sp] || {};
  const heute = tagStr();
  const alt = Object.entries(karten).filter(([, k]) => tageZwischen(k.zuletzt, heute) >= ABSTAND[k.fach]).sort((a, b) => a[1].fach - b[1].fach).map(([de]) => de);
  const schonNeu = d.neuHeute.tag === heute ? d.neuHeute.n : 0;
  const neu = WOERTER.map((w) => w[0]).filter((de) => !karten[de]).slice(0, Math.max(0, PRO_TAG - schonNeu));
  return { alt, neu };
}
export function stand() {
  const d = laden();
  const karten = d.karten[d.sprache] || {};
  const faecher = [1, 2, 3, 4, 5].map((f) => Object.values(karten).filter((k) => k.fach === f).length);
  const f = faellig(d);
  return { sprache: d.sprache, spracheName: SPRACHEN[d.sprache], sprachen: SPRACHEN, gelernt: Object.keys(karten).length, gesamt: WOERTER.length, faecher, faelligAlt: f.alt.length, neuHeute: f.neu.map((de) => ({ de, fremd: wort(de, d.sprache) })), verlauf: d.verlauf.slice(-14), laeuft: Boolean(abfrage && abfrage.bis > Date.now()) };
}
export function einstellen({ sprache } = {}) { const d = laden(); if (SPRACHEN[sprache]) d.sprache = sprache; sichern(d); abfrage = null; return stand(); }
export function zuruecksetzen() { const d = laden(); delete d.karten[d.sprache]; d.neuHeute = { tag: "", n: 0 }; sichern(d); abfrage = null; return stand(); }

function bewerten(de, richtig) {
  const d = laden();
  const sp = d.sprache;
  d.karten[sp] = d.karten[sp] || {};
  const k = d.karten[sp][de];
  if (!k) {
    const heute = tagStr();
    d.neuHeute = d.neuHeute.tag === heute ? { tag: heute, n: d.neuHeute.n + 1 } : { tag: heute, n: 1 };
  }
  d.karten[sp][de] = { fach: richtig ? Math.min(5, (k?.fach || 0) + 1) : 1, zuletzt: tagStr() };
  sichern(d);
}
const frage = (de, sp) => `Was heißt „${de}“ auf ${SPRACHEN[sp]}?`;

export function starte() {
  const d = laden();
  const f = faellig(d);
  const liste = [...f.alt, ...f.neu].slice(0, RUNDE);
  if (!liste.length) return { answer: `Für heute ist alles gelernt, ${SPRACHEN[d.sprache]} sitzt! Morgen gibt es neue Wörter.`, actions: ["wunsch:sprachtrainer"] };
  abfrage = { bis: Date.now() + 3 * 60 * 1000, sprache: d.sprache, liste, i: 0, richtig: 0, falsch: [], versuch: 0 };
  const neu = f.neu.filter((de) => liste.includes(de));
  const intro = neu.length && !f.alt.length ? `Heute ${neu.length} neue Wörter auf ${SPRACHEN[d.sprache]}. Ich sage dir zuerst die Lösung, dann frage ich. ${neu.map((de) => `${de} heißt ${wort(de, d.sprache)}.`).join(" ")} ` : `Los geht's mit ${liste.length} Wörtern auf ${SPRACHEN[d.sprache]}. Sag „Stopp“, um aufzuhören. `;
  return { answer: intro + frage(liste[0], d.sprache), actions: ["zuhoeren"] };
}

function antwort(text) {
  const a = abfrage;
  const de = a.liste[a.i];
  const soll = wort(de, a.sprache);
  const ok = stimmt(text, soll);
  let rueck;
  if (ok) { a.richtig += 1; rueck = ["Richtig!", "Genau!", "Super!", "Stimmt!"][a.i % 4]; bewerten(de, a.versuch === 0); a.versuch = 0; a.i += 1; }
  else if (a.versuch === 0 && !/weiß nicht|weiss nicht|keine ahnung|sag es mir|lösung|loesung|überspringen|weiter/.test(text.toLowerCase())) { a.versuch = 1; a.bis = Date.now() + 3 * 60 * 1000; return { answer: `Nicht ganz. Noch ein Versuch: ${frage(de, a.sprache)}`, actions: ["zuhoeren"] }; }
  else { a.falsch.push(de); rueck = `Das heißt ${soll}.`; bewerten(de, false); a.versuch = 0; a.i += 1; }
  if (a.i >= a.liste.length) {
    abfrage = null;
    const d = laden();
    d.verlauf.push({ tag: tagStr(), richtig: a.richtig, gesamt: a.liste.length, sprache: a.sprache });
    d.verlauf = d.verlauf.slice(-60);
    sichern(d);
    logbuch.eintragen({ bereich: "lernen", titel: `Sprach-Trainer ${SPRACHEN[a.sprache]}: ${a.richtig} von ${a.liste.length} richtig` });
    return { answer: `${rueck} Fertig für heute: ${a.richtig} von ${a.liste.length} richtig.${a.falsch.length ? ` Morgen übe ich nochmal: ${a.falsch.join(", ")}.` : " Alles gewusst, stark!"}`, actions: ["wunsch:sprachtrainer"] };
  }
  a.bis = Date.now() + 3 * 60 * 1000;
  return { answer: `${rueck} ${frage(a.liste[a.i], a.sprache)}`, actions: ["zuhoeren"] };
}

export function quickCommand(text) {
  const { t, k } = sauber(text);
  // Läuft gerade eine Abfrage? Dann ist alles eine Antwort (außer Stopp).
  if (abfrage && abfrage.bis > Date.now()) {
    if (/^(stopp|stop|aufhören|aufhoeren|ende|beenden|genug|abbrechen|danke)$/.test(k)) { const r = abfrage.richtig; abfrage = null; return { answer: `Okay, Pause. ${r} richtig bis hier.`, actions: ["wunsch:sprachtrainer"] }; }
    return antwort(t);
  }
  abfrage = null;
  if (/^(öffne |zeig )?(den |meinen )?sprach-?trainer( an)?$/.test(k)) return { answer: "Hier ist dein Sprach-Trainer.", actions: ["wunsch:sprachtrainer"] };
  const lern = k.match(/\bich (?:will|möchte|moechte) (englisch|spanisch|französisch|franzoesisch|italienisch) lernen\b|\bsprach-?trainer (?:auf )?(englisch|spanisch|französisch|franzoesisch|italienisch)\b/);
  if (lern) {
    const name = (lern[1] || lern[2]).replace("franzoesisch", "französisch");
    const sp = Object.keys(SPRACHEN).find((x) => SPRACHEN[x].toLowerCase() === name);
    einstellen({ sprache: sp });
    return { answer: `Gut, ab jetzt lernen wir ${SPRACHEN[sp]}. Sag „Frag mich Vokabeln ab“, wenn du bereit bist.`, actions: ["wunsch:sprachtrainer"] };
  }
  if (/\b(frag|frage|prüf|pruef|teste?) mich\b.*\b(vokabeln|wörter|woerter|englisch|spanisch|französisch|italienisch)\b|\bvokabeln (abfragen|üben|ueben|lernen)\b|\b(starte|start) (den )?sprach-?trainer\b|\bsprach-?training\b|\bneue wörter( für heute)?\b/.test(k)) return starte();
  return null;
}
