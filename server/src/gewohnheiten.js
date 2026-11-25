// Gewohnheiten mit Serien (v1.169.0, Stern-Idee aus der Ideen-Schmiede).
// Wasser trinken, Sport, Lesen …: per Sprache abhaken, Friday zählt die Tage am Stück (Serie),
// feiert Rekorde und erinnert abends, wenn eine Serie zu reißen droht. Ohne Claude.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { IST_EVE } from "./config.js";
import { sauber, tagStr, uhrJetzt, neueId } from "./wunsch-hilfe.js";

const DATEI = "gewohnheiten";
export const VORSCHLAEGE = [
  { name: "Wasser trinken", icon: "💧", worte: ["wasser", "getrunken", "trinken"] },
  { name: "Sport", icon: "🏃", worte: ["sport", "training", "trainiert", "joggen", "gejoggt", "laufen", "fitness", "workout"] },
  { name: "Lesen", icon: "📖", worte: ["lesen", "gelesen", "buch"] },
  { name: "Meditieren", icon: "🧘", worte: ["meditieren", "meditiert", "meditation"] },
  { name: "Spazieren", icon: "🚶", worte: ["spazieren", "spaziergang", "gassi"] },
  { name: "Früh schlafen", icon: "🌙", worte: ["früh schlafen", "frueh schlafen", "früh ins bett"] },
  { name: "Kein Zucker", icon: "🍎", worte: ["zucker", "süßes", "suesses"] },
  { name: "Lernen", icon: "🎓", worte: ["lernen", "gelernt", "vokabeln"] },
];
const laden = () => ({ liste: [], erinnerung: "20:30", gemeldet: "", ...store.load(DATEI, {}) });
const sichern = (d) => store.save(DATEI, d);

/** Serie (Tage am Stück bis heute bzw. gestern) und Rekord aus der Liste der erledigten Tage. */
export function serie(tage = []) {
  const set = new Set(tage);
  const heute = tagStr(), gestern = tagStr(-1);
  let start = set.has(heute) ? 0 : set.has(gestern) ? -1 : null;
  let aktuell = 0;
  if (start !== null) while (set.has(tagStr(start - aktuell))) aktuell++;
  const sortiert = [...set].sort();
  let rekord = 0, lauf = 0, vorher = null;
  for (const t of sortiert) {
    lauf = vorher && Date.parse(`${t}T12:00:00Z`) - Date.parse(`${vorher}T12:00:00Z`) === 864e5 ? lauf + 1 : 1;
    rekord = Math.max(rekord, lauf);
    vorher = t;
  }
  return { aktuell, rekord, heute: set.has(heute), woche: Array.from({ length: 7 }, (_, i) => set.has(tagStr(i - 6))) };
}

export function stand() {
  const d = laden();
  return { erinnerung: d.erinnerung, vorschlaege: VORSCHLAEGE.filter((v) => !d.liste.some((g) => g.name === v.name)), liste: d.liste.map((g) => ({ ...g, tage: undefined, gesamt: g.tage.length, ...serie(g.tage) })) };
}
export function anlegen({ name, icon } = {}) {
  const n = String(name || "").trim().slice(0, 40);
  if (!n) throw new Error("Wie heißt die Gewohnheit?");
  const d = laden();
  if (d.liste.some((g) => g.name.toLowerCase() === n.toLowerCase())) return stand();
  const v = VORSCHLAEGE.find((x) => x.name.toLowerCase() === n.toLowerCase());
  d.liste.push({ id: neueId(), name: n, icon: String(icon || v?.icon || "⭐").slice(0, 4), worte: v?.worte || [n.toLowerCase()], tage: [] });
  sichern(d);
  return stand();
}
export function loeschen(id) { const d = laden(); d.liste = d.liste.filter((g) => g.id !== id); sichern(d); return stand(); }
export function einstellen({ erinnerung } = {}) {
  const d = laden();
  if (erinnerung === "" || /^\d{2}:\d{2}$/.test(erinnerung || "")) d.erinnerung = erinnerung;
  sichern(d);
  return stand();
}
/** Abhaken (oder rückgängig) für einen Tag. Gibt { g, neu, rekord } zurück. */
export function abhaken(id, { tag = tagStr(), an = true } = {}) {
  const d = laden();
  const g = d.liste.find((x) => x.id === id);
  if (!g) throw new Error("Gewohnheit nicht gefunden.");
  const vorher = serie(g.tage);
  const hatte = g.tage.includes(tag);
  if (an && !hatte) g.tage.push(tag);
  if (!an) g.tage = g.tage.filter((t) => t !== tag);
  g.tage = [...new Set(g.tage)].sort().slice(-1500);
  sichern(d);
  const nach = serie(g.tage);
  if (an && !hatte) logbuch.eintragen({ bereich: "gewohnheit", titel: `${g.icon} ${g.name} erledigt (Serie ${nach.aktuell})` });
  return { g, neu: an && !hatte, serie: nach, rekord: an && !hatte && nach.aktuell > vorher.rekord && nach.aktuell >= 3 };
}

/** Abends erinnern, wenn eine laufende Serie heute noch fehlt. */
export async function pruefen(melde) {
  if (IST_EVE) return;
  const d = laden();
  if (!d.erinnerung || d.gemeldet === tagStr()) return;
  const { h, m } = uhrJetzt();
  const [eh, em] = d.erinnerung.split(":").map(Number);
  if (h * 60 + m < eh * 60 + em) return;
  d.gemeldet = tagStr();
  sichern(d);
  const offen = stand().liste.filter((g) => !g.heute && g.aktuell >= 2);
  if (!offen.length) return;
  try { await melde("🔥 Serie in Gefahr", offen.map((g) => `${g.icon} ${g.name}: ${g.aktuell} Tage am Stück, heute fehlt noch.`).join("\n"), { art: "gewohnheit" }); } catch { /* egal */ }
}

const lob = (r) => (r.rekord ? ` Neuer Rekord: ${r.serie.aktuell} Tage am Stück! 🎉` : r.serie.aktuell >= 2 ? ` Das sind ${r.serie.aktuell} Tage am Stück.` : " Tag eins, weiter so.");
export function quickCommand(text) {
  const { t, k } = sauber(text);
  if (!k) return null;
  if (/^(öffne |zeig )?(meine |die )?gewohnheiten( an)?$/.test(k)) return { answer: "Hier sind deine Gewohnheiten.", actions: ["wunsch:gewohnheiten"] };
  const neu = t.match(/^(?:neue gewohnheit|gewohnheit anlegen|leg (?:eine )?gewohnheit an)[:\s]+(.{2,40})$/i);
  if (neu) { const name = neu[1].trim().replace(/^./, (c) => c.toUpperCase()); anlegen({ name }); return { answer: `Neue Gewohnheit: ${name}. Sag einfach „${name} erledigt“, wenn du es geschafft hast.`, actions: ["wunsch:gewohnheiten"] }; }
  const d = laden();
  if (!d.liste.length) return /gewohnheit/.test(k) && /serie|wie (lange|viele)/.test(k) ? { answer: "Du hast noch keine Gewohnheiten. Öffne die Wunschliste unter Gewohnheiten oder sag: „Neue Gewohnheit: Wasser trinken.“", actions: ["wunsch:gewohnheiten"] } : null;
  // Abfragen: "wie ist meine Serie", "wie viele Tage Sport am Stück"
  if (/\b(serie|serien|am stück|am stueck)\b/.test(k) && /\b(wie|was|zeig|meine)\b/.test(k)) {
    const s = stand().liste;
    const g = s.find((x) => x.worte.some((w) => k.includes(w)) || k.includes(x.name.toLowerCase()));
    const zeige = g ? [g] : s;
    return { answer: zeige.map((x) => `${x.name}: ${x.aktuell} ${x.aktuell === 1 ? "Tag" : "Tage"} am Stück${x.heute ? "" : ", heute noch offen"}, Rekord ${x.rekord}.`).join(" "), actions: ["wunsch:gewohnheiten"] };
  }
  // Abhaken: "Sport erledigt", "ich habe Wasser getrunken", "hab gelesen", "Gewohnheit Lesen erledigt"
  if (!/\b(erledigt|geschafft|gemacht|abhaken|hake|getrunken|gelesen|meditiert|trainiert|gejoggt|war spazieren|war joggen|war laufen|gelernt)\b/.test(k)) return null;
  const g = d.liste.find((x) => k.includes(x.name.toLowerCase()) || x.worte.some((w) => new RegExp(`\\b${w}\\b`).test(k)));
  if (!g) return null;
  const r = abhaken(g.id);
  return { answer: r.neu ? `${g.icon} ${g.name} abgehakt.${lob(r)}` : `${g.name} ist für heute schon abgehakt. Serie: ${r.serie.aktuell} Tage.`, actions: ["wunsch:gewohnheiten"] };
}
