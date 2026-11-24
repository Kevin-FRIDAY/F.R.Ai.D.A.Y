// Friday lernt dich kennen (v1.160.0, Wunsch aus der Ideen-Schmiede).
// Einmal pro Woche (und auf Knopfdruck) liest Friday die eigene Datenbank (alle Gespräche) und das Logbuch
// und leitet Vorlieben ab: Lieblingsthemen, wann du Friday am meisten nutzt, welche Funktionen du gern
// verwendest und welche Fragen öfter kommen. Ohne Claude, alles lokal (data/vorlieben.json).
// Genutzt wird das für: "Friday, was weißt du über meine Gewohnheiten?", die Bauplan-Vorschläge in der
// Ideen-Schmiede und kleine Tipps (z. B. "du fragst morgens oft nach dem Wetter → steht im Briefing").
// Mit Guthaben kann Claude zusätzlich eine Einschätzung in Worten schreiben (Knopf im Fenster).
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { U } from "./datum.js";
import { denke } from "./denker.js";
import { tagStr, sauber } from "./wunsch-hilfe.js";
import { config } from "./config.js";

const DATEI = "vorlieben";
export const THEMEN = [
  ["wetter", "Wetter", /\b(wetter|regen|temperatur|grad|sonne|schnee|gewitter)/i],
  ["welt", "Weltgeschehen & Nachrichten", /\b(nachrichten|news|welt|krieg|politik|lage|land|länder|schlagzeilen)/i],
  ["markt", "Börse & Krypto", /\b(bitcoin|btc|krypto|aktie|börse|boerse|gold|kurs|markt)/i],
  ["sport", "Sport", /\b(fußball|fussball|bundesliga|spiel|tor|bayern|dortmund|formel|nba|sport)/i],
  ["auto", "Autos & Werkstatt", /\b(auto|mercedes|amg|bmw|porsche|motor|werkstatt|3d|bau mir)/i],
  ["musik", "Musik & Medien", /\b(musik|spotify|song|lied|film|serie|netflix|youtube|playlist)/i],
  ["haus", "Zuhause & Smart Home", /\b(licht|lampe|hue|alexa|fernseher|tv|heizung|kamera|haus)/i],
  ["organisation", "Termine & Aufgaben", /\b(termin|kalender|erinner|aufgabe|einkauf|liste|todo)/i],
  ["unterwegs", "Unterwegs & Routen", /\b(route|nach hause|fahr|bahn|bus|stau|weg|navigation|standort)/i],
  ["geld", "Geld & Einkaufen", /\b(geld|euro|preis|kaufen|kosten|budget|sparen|amazon)/i],
  ["lernen", "Lernen & Wissen", /\b(lern|erklär|erklaer|was ist|wer ist|wie funktioniert|lexikon|wissen)/i],
  ["ideen", "Ideen & Projekte", /\b(idee|projekt|webseite|spiel programm|business|startup)/i],
  ["essen", "Essen & Kochen", /\b(essen|kochen|rezept|kühlschrank|kuehlschrank|pizza)/i],
  ["familie", "Familie", /\b(mama|papa|carla|frau|kind|familie|oma|opa|pinnwand|geburtstag)/i],
];
const TAGESZEIT = (h) => (h < 5 ? "nachts" : h < 11 ? "morgens" : h < 14 ? "mittags" : h < 18 ? "nachmittags" : h < 22 ? "abends" : "spätabends");
const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const stundeVon = (iso) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: config.timezone, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));
const wochentagVon = (iso) => new Date(`${tagStr(0, Date.parse(iso))}T12:00:00Z`).getUTCDay();

/** Wertet die letzten `tage` Tage aus. */
export function auswerten({ tage = 90 } = {}) {
  const seit = new Date(Date.now() - tage * 864e5).toISOString();
  let g = [];
  try { g = store.leseArchiv().filter((e) => e.at >= seit && e.frage && (e.typ || "gespraech") === "gespraech"); } catch { /* leer */ }
  const themen = Object.fromEntries(THEMEN.map(([id]) => [id, 0]));
  const stunden = Array(24).fill(0);
  const wochentage = Array(7).fill(0);
  const kanaele = {};
  const fragen = new Map();
  for (const e of g) {
    const f = String(e.frage);
    for (const [id, , re] of THEMEN) if (re.test(f)) themen[id]++;
    const h = stundeVon(e.at); if (Number.isFinite(h)) stunden[h]++;
    wochentage[wochentagVon(e.at)]++;
    kanaele[e.kanal || "web"] = (kanaele[e.kanal || "web"] || 0) + 1;
    const key = f.toLowerCase().replace(/^(hey |ok )?(friday|freitag)[ ,.!]*/, "").replace(/[^a-zäöüß0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (key.length > 4) fragen.set(key, { text: f.slice(0, 100), n: (fragen.get(key)?.n || 0) + 1 });
  }
  // Funktionen aus dem Logbuch
  const funktionen = {};
  try { for (const e of logbuch.letzte({ anzahlMonate: Math.ceil(tage / 30) + 1, limit: 8000 })) { if (e.at < seit || ["befehl", "system", "sonstiges"].includes(e.bereich)) continue; funktionen[e.bereich] = (funktionen[e.bereich] || 0) + 1; } } catch { /* egal */ }
  const top = Object.entries(themen).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, name: THEMEN.find((t) => t[0] === id)[1], n }));
  const spitzeH = stunden.indexOf(Math.max(...stunden));
  const spitzeT = wochentage.indexOf(Math.max(...wochentage));
  const zeiten = {};
  stunden.forEach((n, h) => { zeiten[TAGESZEIT(h)] = (zeiten[TAGESZEIT(h)] || 0) + n; });
  const lieblingsZeit = Object.entries(zeiten).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const morgensWetter = g.filter((e) => stundeVon(e.at) < 11 && THEMEN[0][2].test(e.frage)).length;
  const tipps = [];
  if (morgensWetter >= 3) tipps.push("Du fragst morgens oft nach dem Wetter. Das steht auch jeden Morgen im Briefing.");
  if (top[0]) tipps.push(`Dein Lieblingsthema ist ${top[0].name}. Im Bauplan der Ideen-Schmiede stehen passende Vorschläge oben.`);
  if (stunden.slice(22).concat(stunden.slice(0, 5)).reduce((a, b) => a + b, 0) > g.length * 0.25 && g.length > 20) tipps.push("Du bist oft spät abends aktiv. Der Abend-Rückblick kann auch später kommen (Einstellung im Fenster).");
  return {
    tage, stand: new Date().toISOString(), gespraeche: g.length,
    themen: top.slice(0, 8), stunden, wochentage, kanaele,
    spitze: g.length ? { stunde: spitzeH, wochentag: WOCHENTAGE[spitzeT], tageszeit: lieblingsZeit } : null,
    funktionen: Object.entries(funktionen).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([b, n]) => ({ bereich: b, name: logbuch.BEREICHE[b]?.[1] || b, icon: logbuch.BEREICHE[b]?.[0] || "•", n })),
    haeufig: [...fragen.values()].filter((x) => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 8),
    tipps,
  };
}

export function gespeichert() { return store.load(DATEI, {}).profil || null; }
export function aktualisieren() {
  const p = auswerten();
  const d = store.load(DATEI, {});
  d.profil = { ...p, ki: d.profil?.ki || null };
  d.verlauf = [...(d.verlauf || []), { stand: p.stand, top: p.themen.slice(0, 3).map((t) => t.id), gespraeche: p.gespraeche }].slice(-52);
  store.save(DATEI, d);
  return d.profil;
}
/** Wöchentlich (bei Start älter als 7 Tage). */
export function pruefen() {
  const p = gespeichert();
  if (!p || Date.now() - Date.parse(p.stand) > 7 * 864e5) {
    const neu = aktualisieren();
    logbuch.eintragen({ bereich: "vorlieben", titel: "Friday hat ihr Bild von dir aufgefrischt", details: neu.themen.slice(0, 3).map((t) => t.name).join(", ") });
  }
}

export async function kiEinschaetzung() {
  const p = gespeichert() || aktualisieren();
  const r = await denke({ stufe: "leicht", quelle: "vorlieben", maxTokens: 700, system: "Du bist Friday, ein freundlicher KI-Assistent. Beschreibe in 4 kurzen Sätzen auf Deutsch (Du-Form), was du aus diesen Nutzungsdaten über die Vorlieben deines Nutzers gelernt hast, und mach 2 konkrete Vorschläge, wie du ihm mehr helfen kannst. Keine Psychologie, keine Bewertung, nur Gewohnheiten.", text: JSON.stringify({ themen: p.themen, spitze: p.spitze, funktionen: p.funktionen, haeufig: p.haeufig.map((x) => x.text) }) });
  if (!r.ok) throw new Error(r.error);
  const d = store.load(DATEI, {});
  d.profil = { ...(d.profil || p), ki: { text: r.text, at: new Date().toISOString() } };
  store.save(DATEI, d);
  return d.profil.ki;
}

export function satz(p) {
  if (!p || !p.gespraeche) return "Ich kenne dich noch nicht gut genug. Je mehr wir reden, desto mehr lerne ich.";
  const t = p.themen.slice(0, 3).map((x) => x.name);
  return `Aus ${p.gespraeche} Gesprächen der letzten ${p.tage} Tage: Am meisten interessieren dich ${t.length > 1 ? `${t.slice(0, -1).join(", ")} und ${t.at(-1)}` : t[0] || "ganz verschiedene Dinge"}. Du redest am liebsten ${p.spitze?.tageszeit || ""} mit mir, besonders ${p.spitze?.wochentag ? `am ${p.spitze.wochentag}` : ""}.${p.funktionen[0] ? ` Am häufigsten nutzt du ${p.funktionen[0].name}.` : ""}${p.tipps[0] ? ` ${p.tipps[0]}` : ""}`;
}

const FRAGE = U(/\b(was weißt du über (meine gewohnheiten|meine vorlieben)|was weisst du über (meine gewohnheiten|meine vorlieben)|was weisst du ueber (meine gewohnheiten|meine vorlieben)|wie gut kennst du mich|was sind meine (vorlieben|lieblingsthemen|gewohnheiten)|was interessiert mich)\b/);
export function quickCommand(text) {
  const { k } = sauber(text);
  if (!FRAGE.test(k)) return null;
  const p = aktualisieren();
  return { answer: satz(p).replace(/\s+/g, " ").replace(/ ,/g, ","), actions: ["wunsch:vorlieben"] };
}
