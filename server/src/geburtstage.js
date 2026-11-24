// Geburtstage + Geschenk-Ideen (v1.160.0, Wunsch aus der Ideen-Schmiede).
// "Friday, Mama hat am 3. März Geburtstag" · "Wann hat Mama Geburtstag?" · "Welche Geburtstage kommen?"
// Friday erinnert 7 Tage vorher (Zeit fürs Geschenk) und am Tag selbst – per Telegram/Push (nur Friday).
// Geschenk-Ideen ohne KI aus Beziehung + Hobbys; mit Guthaben schlägt Claude persönlichere Ideen vor.
// Daten: data/geburtstage.json.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { IST_EVE } from "./config.js";
import { U } from "./datum.js";
import { denke } from "./denker.js";
import { neueId, sauber, tagStr, uhrJetzt } from "./wunsch-hilfe.js";

const DATEI = "geburtstage";
const MONATE = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
const MONAT_RE = "januar|jänner|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember";

const lade = () => ({ liste: [], gemeldet: {}, ...store.load(DATEI, {}) });
const sichere = (d) => store.save(DATEI, d);
export const liste = () => lade().liste;

/** "3. März", "03.03.", "3.3.1960", "1960-03-03" → { mm, dd, jahr } */
export function datumLesen(s) {
  const t = String(s || "").toLowerCase().trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { jahr: Number(m[1]), mm: Number(m[2]), dd: Number(m[3]) };
  m = t.match(/(\d{1,2})\.\s*(\d{1,2})\.?\s*(\d{4})?/);
  if (m) return { dd: Number(m[1]), mm: Number(m[2]), jahr: m[3] ? Number(m[3]) : null };
  m = t.match(new RegExp(`(\\d{1,2})\\.?\\s*(${MONAT_RE})\\s*(\\d{4})?`));
  if (m) { const name = m[2].replace("jänner", "januar").replace("maerz", "märz"); return { dd: Number(m[1]), mm: MONATE.indexOf(name) + 1, jahr: m[3] ? Number(m[3]) : null }; }
  return null;
}
const gueltig = (d) => d && d.mm >= 1 && d.mm <= 12 && d.dd >= 1 && d.dd <= 31;

export function speichern({ id, name, datum, beziehung = "", hobbys = "", notiz = "" } = {}) {
  const n = String(name || "").trim().slice(0, 60);
  if (!n) throw new Error("Wessen Geburtstag?");
  const dt = typeof datum === "object" ? datum : datumLesen(datum);
  if (!gueltig(dt)) throw new Error("Das Datum verstehe ich nicht. Zum Beispiel: 3. März oder 03.03.1960.");
  const d = lade();
  let e = d.liste.find((x) => x.id === id) || d.liste.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (!e) { e = { id: neueId(), at: new Date().toISOString() }; d.liste.push(e); }
  Object.assign(e, { name: n, mm: dt.mm, dd: dt.dd, jahr: dt.jahr || e.jahr || null, beziehung: String(beziehung || e.beziehung || "").slice(0, 40), hobbys: String(hobbys || e.hobbys || "").slice(0, 200), notiz: String(notiz || e.notiz || "").slice(0, 300) });
  sichere(d);
  logbuch.eintragen({ bereich: "geburtstag", titel: `Geburtstag gemerkt: ${e.name} (${e.dd}. ${MONATE[e.mm - 1]})` });
  return e;
}
export function weg(id) { const d = lade(); d.liste = d.liste.filter((x) => x.id !== id); sichere(d); return true; }

/** Tage bis zum nächsten Geburtstag (0 = heute) und das Alter dann. */
export function naechster(e, heute = tagStr()) {
  const [y, mo, da] = heute.split("-").map(Number);
  const h = Date.UTC(y, mo - 1, da);
  let j = y;
  let t = Date.UTC(j, e.mm - 1, Math.min(e.dd, e.mm === 2 && e.dd === 29 && !((j % 4 === 0 && j % 100) || j % 400 === 0) ? 28 : e.dd));
  if (t < h) { j += 1; t = Date.UTC(j, e.mm - 1, e.dd); }
  return { tage: Math.round((t - h) / 864e5), alter: e.jahr ? j - e.jahr : null, jahr: j };
}
export function kommende(tage = 365) {
  return liste().map((e) => ({ ...e, ...naechster(e) })).filter((e) => e.tage <= tage).sort((a, b) => a.tage - b.tage);
}

const IDEEN = {
  mama: ["ein Fotobuch mit gemeinsamen Erinnerungen", "ein Wellness-Gutschein", "ein gemeinsamer Ausflug oder Brunch", "Lieblingsblumen mit handgeschriebener Karte"],
  papa: ["ein Werkzeug oder Gadget für sein Hobby", "ein Tasting (Whisky, Bier, Kaffee)", "Tickets für ein Spiel oder Konzert", "ein gemeinsamer Tag mit Grillen"],
  partner: ["ein Abend zu zweit mit Überraschung", "ein Kurzurlaub oder Wochenendtrip", "Schmuck mit Gravur", "ein Erlebnis-Gutschein (Kochkurs, Spa)"],
  kind: ["ein Erlebnistag (Zoo, Freizeitpark, Kletterhalle)", "ein Bau- oder Experimentierset", "Bücher zum Lieblingsthema", "eine kleine Party mit Freunden"],
  freund: ["etwas Gemeinsames: Kino, Escape-Room, Essen", "ein Buch oder Spiel passend zu den Hobbys", "selbst Gemachtes: Playlist, Fotocollage", "ein Gutschein vom Lieblingsladen"],
  allgemein: ["ein persönlicher Gutschein für gemeinsame Zeit", "etwas Selbstgemachtes", "ein Buch zu den Interessen", "eine schöne Pflanze mit Karte"],
};
const HOBBY = [
  [/koch|back|essen/, "ein besonderes Kochbuch oder hochwertiges Küchenwerkzeug"], [/garten|pflanz/, "Saatgut-Set, gute Gartenschere oder eine besondere Pflanze"],
  [/fußball|fussball|sport|lauf|fitness/, "Trikot, Stadion-Tickets oder Laufzubehör"], [/musik|konzert/, "Konzert-Tickets oder Kopfhörer"],
  [/lesen|buch/, "ein E-Reader oder Bücher-Abo"], [/reise|urlaub/, "ein Reise-Gutschein oder Reiseführer"], [/technik|gaming|spiel/, "ein Gadget oder neues Spiel"],
  [/foto|kamera/, "ein Fotokurs oder Zubehör für die Kamera"], [/hund|katze|tier/, "etwas Schönes fürs Haustier und ein Foto-Shooting mit ihm"], [/wein|bier|whisky|kaffee/, "ein Tasting-Set"],
];
export function geschenkIdeen(e) {
  const b = String(e.beziehung || "").toLowerCase() + " " + String(e.name).toLowerCase();
  const typ = /mama|mutter|oma/.test(b) ? "mama" : /papa|vater|opa/.test(b) ? "papa" : /frau|mann|freundin|freund\b|partner|schatz/.test(b) && !/kumpel/.test(b) ? "partner" : /sohn|tochter|kind|neffe|nichte|enkel/.test(b) ? "kind" : /freund|kumpel|kolleg/.test(b) ? "freund" : "allgemein";
  const h = String(e.hobbys || "").toLowerCase();
  const passend = HOBBY.filter(([re]) => re.test(h)).map(([, x]) => x);
  return [...passend, ...IDEEN[typ]].slice(0, 5);
}
export async function geschenkKi(e) {
  const r = await denke({ stufe: "leicht", quelle: "geburtstage", maxTokens: 800, system: "Du bist ein herzlicher Geschenk-Berater. Antworte auf Deutsch mit genau 5 kurzen, konkreten Geschenk-Ideen als JSON-Liste von Strings, Preisrahmen 10–80 €. Nur JSON.", text: `Für: ${e.name}${e.beziehung ? ` (${e.beziehung})` : ""}${e.alter ? `, wird ${e.alter}` : ""}. Hobbys: ${e.hobbys || "unbekannt"}. Notiz: ${e.notiz || "-"}` });
  if (!r.ok) throw new Error(r.error);
  try { return JSON.parse(r.text.slice(r.text.indexOf("["), r.text.lastIndexOf("]") + 1)).slice(0, 5).map(String); } catch { return r.text.split("\n").filter(Boolean).slice(0, 5); }
}

const wannText = (e) => e.tage === 0 ? "heute" : e.tage === 1 ? "morgen" : `in ${e.tage} Tagen, am ${e.dd}. ${MONATE[e.mm - 1].replace(/^./, (c) => c.toUpperCase())}`;
export function satz(e) { return `${e.name} hat ${wannText(e)} Geburtstag${e.alter ? ` und wird ${e.alter}` : ""}.`; }

/** Täglich ab 9 Uhr: 7 Tage vorher und am Tag erinnern (je einmal pro Jahr). */
export async function pruefen(melde) {
  if (IST_EVE || uhrJetzt().h < 9) return;
  const d = lade();
  const heute = tagStr();
  let geaendert = false;
  for (const e of kommende(7)) {
    if (e.tage !== 0 && e.tage !== 7) continue;
    const key = `${e.id}:${e.jahr}:${e.tage}`;
    if (d.gemeldet[key]) continue;
    d.gemeldet[key] = heute;
    geaendert = true;
    const ideen = e.tage === 7 ? `\nGeschenk-Ideen: ${geschenkIdeen(e).slice(0, 3).join(" · ")}` : "";
    try { await melde(e.tage === 0 ? "🎂 Geburtstag heute" : "🎁 Geburtstag in einer Woche", `${satz(e)}${ideen}`); } catch { /* egal */ }
  }
  if (geaendert) {
    for (const [k, v] of Object.entries(d.gemeldet)) if (v < tagStr(-400)) delete d.gemeldet[k];
    sichere(d);
  }
}

const MERKE = U(new RegExp(`^(?:merk dir[,:]? )?(?:dass )?(.{2,40}?) hat (?:am )?(\\d{1,2}\\.\\s*(?:\\d{1,2}\\.?(?:\\s*\\d{4})?|(?:${MONAT_RE})(?:\\s*\\d{4})?)) geburtstag$`));
const MERKE2 = U(new RegExp(`^(?:merk dir |speicher )?(?:den )?geburtstag (?:von )?(.{2,40}?)[,:]? (?:am |ist am |ist der )?(\\d{1,2}\\.\\s*(?:\\d{1,2}\\.?(?:\\s*\\d{4})?|(?:${MONAT_RE})(?:\\s*\\d{4})?))$`));
const WANN = U(/^wann hat (.{2,40}?) geburtstag$/);
const LISTE = U(/\b(welche|wer hat|nächste|naechste|kommende|anstehende)( demnächst| bald| als nächstes)? (geburtstage?|hat geburtstag)\b|\bgeburtstage (diesen|im|nächsten|naechsten) monat\b/);
const GESCHENK = U(/^(?:was|welches geschenk) (?:soll ich|kann ich|könnte ich|koennte ich) (.{2,40}?) (?:schenken|zum geburtstag schenken|kaufen)$|^geschenk-?ideen? für (.{2,40})$/);
const name = (s) => String(s).replace(/^(meine?|mein|unsere?|der|die|das)\s+/i, "").replace(/^./, (c) => c.toUpperCase());
const finde = (n) => { const q = name(n).toLowerCase(); return liste().find((x) => x.name.toLowerCase() === q) || liste().find((x) => x.name.toLowerCase().includes(q) || q.includes(x.name.toLowerCase())); };

export function quickCommand(text) {
  const { t, k } = sauber(text);
  let m = k.match(MERKE) || k.match(MERKE2);
  if (m) {
    const roh = t.slice(k.indexOf(m[1]), k.indexOf(m[1]) + m[1].length);
    try {
      const e = speichern({ name: name(roh || m[1]), datum: m[2], beziehung: /mama|mutter|papa|vater|oma|opa|frau|mann|sohn|tochter|bruder|schwester/.test(m[1]) ? m[1].replace(/^(meine?|mein)\s+/, "") : "" });
      return { answer: `Gemerkt. ${satz({ ...e, ...naechster(e) })} Ich erinnere dich eine Woche vorher und am Tag selbst.`, actions: ["wunsch:geburtstage"] };
    } catch (err) { return { answer: err.message, actions: [] }; }
  }
  m = k.match(WANN);
  if (m) {
    const e = finde(m[1]);
    // Unbekannt: Apple-Kontakte (OpenJarvis-Paket) dürfen danach suchen.
    return e ? { answer: satz({ ...e, ...naechster(e) }), actions: ["wunsch:geburtstage"] } : null;
  }
  m = k.match(GESCHENK);
  if (m) {
    const e = finde(m[1] || m[2]);
    if (!e) return null;
    return { answer: `Ideen für ${e.name}: ${geschenkIdeen({ ...e, ...naechster(e) }).slice(0, 3).join(", ")}.`, actions: ["wunsch:geburtstage"] };
  }
  if (LISTE.test(k)) {
    const n = kommende(60).slice(0, 4);
    return { answer: n.length ? n.map(satz).join(" ") : "In den nächsten zwei Monaten hat niemand Geburtstag, den ich kenne.", actions: ["wunsch:geburtstage"] };
  }
  return null;
}
