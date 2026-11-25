// Friday lernt dich kennen (v1.171.0) – alles lokal, ohne Claude, kostet kein Guthaben.
//
// 1. Kennenlern-Runde: "Friday, lern mich kennen" → Friday stellt 5 Fragen (Essen, Musik, Arbeit, Familie,
//    Ziele, wie Friday antworten soll …), hört nach jeder Frage zu und merkt sich die Antwort.
//    "weiß nicht" / "nächste" überspringt, "sag ich nicht" fragt nie wieder, "Stopp" beendet.
// 2. Nebenbei mitlernen: Sagt Boss irgendwann "ich mag Sushi", "mein Lieblingsfilm ist Interstellar",
//    "meine Frau heißt Carla" oder "ich wohne in Hamburg", merkt Friday sich das von selbst
//    (abschaltbar im Fenster "Friday kennt dich").
// 3. Fragen dazu ohne Claude: "Was ist mein Lieblingsessen?", "Wie heißt mein Hund?",
//    "Wie gut kennst du mich?", "Was weißt du über mich?".
// 4. Claude bekommt einen kurzen Steckbrief (wie Boss Antworten haben will, Lieblingssachen),
//    damit jede Antwort persönlicher wird.
//
// Gespeichert in data/kennenlernen.json. Jede Antwort steht zusätzlich als Fakt im Gedächtnis
// (Schublade passend, mit "schluessel", damit eine neue Antwort die alte ersetzt statt doppelt zu stehen).
import { config } from "./config.js";
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";
import { U } from "./datum.js";
import { rateSchublade } from "./gedaechtnis.js";
import * as profil from "./profil.js";
import * as vorlieben from "./vorlieben.js";

const DATEI = "kennenlernen";
const RUNDE = 5;
const MINUTEN = 3;

export const KATEGORIEN = {
  essen: ["🍕", "Essen & Trinken"],
  freizeit: ["🎮", "Freizeit & Hobbys"],
  medien: ["🎵", "Musik, Filme & Serien"],
  arbeit: ["💼", "Arbeit & Projekte"],
  familie: ["👨‍👩‍👧", "Familie & Freunde"],
  alltag: ["☕", "Dein Alltag"],
  technik: ["🚗", "Autos & Technik"],
  ziele: ["🚀", "Ziele & Träume"],
  friday: ["🤖", "Wie ich für dich sein soll"],
};

// [id, kategorie, Frage, Bezeichnung im Gedächtnis, Schublade, Profil-Feld?]
const F = (id, kat, frage, label, schublade, feld) => ({ id, kat, frage, label, schublade, feld });
export const FRAGEN = [
  F("lieblingsessen", "essen", "Was ist dein Lieblingsessen?", "Lieblingsessen", "vorliebe", "lieblingsessen"),
  F("lieblingsgetraenk", "essen", "Was trinkst du am liebsten?", "Lieblingsgetränk", "vorliebe"),
  F("fruehstueck", "essen", "Was gibt es bei dir meistens zum Frühstück?", "Frühstück", "vorliebe"),
  F("mag_nicht_essen", "essen", "Gibt es etwas, das du überhaupt nicht isst?", "Isst nicht", "vorliebe"),
  F("lieblingsrestaurant", "essen", "Hast du ein Lieblingsrestaurant oder eine Lieblingsküche, zum Beispiel italienisch oder asiatisch?", "Lieblingsrestaurant / Küche", "vorliebe"),
  F("suessigkeit", "essen", "Süß oder salzig, was ist deine Schwäche?", "Süß oder salzig", "vorliebe"),
  F("hobbys", "freizeit", "Was machst du in deiner Freizeit am liebsten?", "Hobbys", "vorliebe", "hobbys"),
  F("sport", "freizeit", "Machst du Sport? Wenn ja, welchen?", "Sport", "vorliebe"),
  F("lieblingsverein", "freizeit", "Hast du einen Lieblingsverein, zum Beispiel im Fußball?", "Lieblingsverein", "vorliebe"),
  F("wochenende", "freizeit", "Wie sieht für dich ein perfektes Wochenende aus?", "Perfektes Wochenende", "vorliebe"),
  F("urlaub", "freizeit", "Wo machst du am liebsten Urlaub?", "Lieblings-Urlaubsort", "ort"),
  F("traumreise", "freizeit", "Welches Land würdest du gern einmal sehen?", "Traumreise", "ort"),
  F("spiele", "freizeit", "Spielst du Videospiele? Welche magst du?", "Lieblingsspiele", "vorliebe"),
  F("musik", "medien", "Welche Musik hörst du am liebsten?", "Lieblingsmusik", "vorliebe", "musik"),
  F("lieblingskuenstler", "medien", "Wer ist dein Lieblingskünstler oder deine Lieblingsband?", "Lieblingskünstler", "vorliebe"),
  F("lieblingsfilm", "medien", "Was ist dein Lieblingsfilm?", "Lieblingsfilm", "vorliebe"),
  F("lieblingsserie", "medien", "Welche Serie schaust du gerade oder magst du am meisten?", "Lieblingsserie", "vorliebe"),
  F("lieblingsheld", "medien", "Wer ist dein Lieblings-Superheld? Ich tippe auf Iron Man.", "Lieblingsheld", "vorliebe"),
  F("podcast", "medien", "Hörst du Podcasts oder YouTube-Kanäle, die du richtig gut findest?", "Lieblings-Kanäle", "vorliebe"),
  F("beruf", "arbeit", "Was machst du beruflich?", "Beruf", "arbeit", "beruf"),
  F("arbeitszeit", "arbeit", "Wann arbeitest du normalerweise, eher früh, spät oder in Schichten?", "Arbeitszeiten", "arbeit"),
  F("projekt", "arbeit", "An welchem Projekt arbeitest du gerade am liebsten?", "Aktuelles Lieblingsprojekt", "arbeit"),
  F("staerke", "arbeit", "Was kannst du richtig gut?", "Stärken", "arbeit"),
  F("lernen_will", "arbeit", "Was würdest du gern noch lernen?", "Will lernen", "arbeit"),
  F("name_partner", "familie", "Wie heißt deine Frau, dein Mann oder deine Partnerin?", "Partner/in heißt", "person", "partner"),
  F("kinder", "familie", "Hast du Kinder? Wie heißen sie?", "Kinder", "person", "kinder"),
  F("haustiere", "familie", "Hast du Haustiere? Wie heißen sie?", "Haustiere", "person", "haustiere"),
  F("bester_freund", "familie", "Wer ist dein bester Freund oder deine beste Freundin?", "Bester Freund / beste Freundin", "person"),
  F("familie_wichtig", "familie", "Wer ist dir in der Familie besonders wichtig?", "Besonders wichtig", "person"),
  F("aufstehen", "alltag", "Wann stehst du an einem normalen Tag auf?", "Aufstehzeit", "termin"),
  F("schlafen", "alltag", "Und wann gehst du meistens schlafen?", "Schlafenszeit", "termin"),
  F("morgen", "alltag", "Was ist das Erste, was du morgens machst?", "Morgenroutine", "vorliebe"),
  F("wetter_mag", "alltag", "Welches Wetter magst du am liebsten?", "Lieblingswetter", "vorliebe"),
  F("jahreszeit", "alltag", "Welche Jahreszeit ist deine liebste?", "Lieblingsjahreszeit", "vorliebe"),
  F("lieblingsfarbe", "alltag", "Was ist deine Lieblingsfarbe?", "Lieblingsfarbe", "vorliebe"),
  F("nervt", "alltag", "Was nervt dich im Alltag am meisten?", "Nervt ihn", "vorliebe"),
  F("gute_laune", "alltag", "Was macht dir sofort gute Laune?", "Macht gute Laune", "vorliebe"),
  F("auto", "technik", "Was für ein Auto fährst du?", "Auto", "technik", "auto"),
  F("traumauto", "technik", "Und was wäre dein Traumauto?", "Traumauto", "technik"),
  F("handy", "technik", "Welches Handy und welchen Computer benutzt du?", "Geräte", "technik"),
  F("technik_liebe", "technik", "Welches Technik-Thema findest du gerade am spannendsten?", "Spannendes Technik-Thema", "technik"),
  F("ziel_jahr", "ziele", "Was willst du dieses Jahr unbedingt noch schaffen?", "Ziel für dieses Jahr", "arbeit"),
  F("traum", "ziele", "Was ist dein großer Traum?", "Großer Traum", "sonstiges"),
  F("in_fuenf_jahren", "ziele", "Wo siehst du dich in fünf Jahren?", "In fünf Jahren", "sonstiges"),
  F("stolz", "ziele", "Worauf bist du richtig stolz?", "Stolz auf", "sonstiges"),
  F("antwort_laenge", "friday", "Soll ich dir eher kurz und knapp antworten oder lieber ausführlich?", "Antworten am liebsten", "vorliebe"),
  F("humor", "friday", "Darf ich mit dir Witze machen und ein bisschen frech sein?", "Humor von Friday", "vorliebe"),
  F("briefing_themen", "friday", "Was soll ich dir jeden Morgen unbedingt erzählen?", "Wichtig fürs Briefing", "vorliebe"),
  F("hilfe_wunsch", "friday", "Wobei soll ich dir am meisten helfen?", "Wobei Friday am meisten helfen soll", "vorliebe"),
  F("nicht_stoeren", "friday", "Gibt es Zeiten, in denen ich dich auf keinen Fall stören soll?", "Nicht stören", "termin"),
];
const FRAGE_NACH_ID = Object.fromEntries(FRAGEN.map((f) => [f.id, f]));

// ---------- Speicher ----------
function laden() {
  const d = store.load(DATEI, {});
  return {
    antworten: d.antworten && typeof d.antworten === "object" ? d.antworten : {},
    gelernt: Array.isArray(d.gelernt) ? d.gelernt : [],
    nie: d.nie && typeof d.nie === "object" ? d.nie : {},
    mitlernen: d.mitlernen !== false,
    runden: Array.isArray(d.runden) ? d.runden : [],
  };
}
const sichern = (d) => store.save(DATEI, d);
const name = () => config.userName || "Boss";
const gross1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const kurz = (s, n = 160) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Fakt im Gedächtnis anlegen oder den alten mit gleichem Schlüssel ersetzen. */
function gedaechtnisSetzen(schluessel, text, schublade) {
  const liste = store.getMemories().filter((m) => m.schluessel !== schluessel);
  const e = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4), text: kurz(text, 500), created: new Date().toISOString(), schluessel, schublade: schublade || rateSchublade(text), quelle: "kennenlernen" };
  liste.push(e);
  store.save("memory", liste.slice(-300));
  return e;
}
function gedaechtnisWeg(schluessel) {
  const liste = store.getMemories();
  const rest = liste.filter((m) => m.schluessel !== schluessel);
  if (rest.length !== liste.length) store.save("memory", rest);
}

// Füllwörter und Echo der Frage aus der Antwort entfernen: "Also mein Lieblingsessen ist Pizza, glaube ich" → "Pizza"
export function antwortKern(roh) {
  let a = kurz(roh, 300).replace(/^(hey |ok |okay )?(friday|freitag)[ ,.!:]*/i, "");
  for (let r = 0; r < 2; r++) {
  for (let i = 0; i < 3; i++) {
    a = a.replace(U(/^(also|ähm|äh|hm+|ehm|na ja|naja|ja|nein,? also|ich glaube|ich denke|ich würde sagen|würde ich sagen|auf jeden fall|definitiv|eindeutig|ganz klar|puh|gute frage|klar|natürlich)\b[ ,.:!]*/i), "");
  }
  a = a.replace(U(/^(mein(e|en)?|meine?) [a-zäöüß\-]+ (ist|sind|heißt|heisst|wäre|waere)( wohl| eigentlich| ganz klar| natürlich)? /i), "")
    .replace(U(/^(das )?(ist|sind|wäre|waere) /i), "")
    .replace(U(/^(am liebsten|meistens|normalerweise|eigentlich) /i), "")
    .replace(U(/[ ,]+(glaube ich|würde ich sagen|denke ich|oder so|schätze ich|eigentlich)$/i), "")
    .replace(/[.!]+$/, "").trim();
  }
  return gross1(kurz(a, 160));
}

// ---------- Kennenlern-Runde ----------
let runde = null; // { bis, fragen:[id], i, gemerkt, ein }

export const laeuft = () => Boolean(runde && runde.bis > Date.now());

function naechsteFragen(n, d = laden()) {
  const offen = FRAGEN.filter((f) => !d.antworten[f.id] && !d.nie[f.id]);
  // Gleichmäßig über die Kategorien: zuerst die, in der Friday am wenigsten weiß.
  const proKat = {};
  for (const f of FRAGEN) if (d.antworten[f.id]) proKat[f.kat] = (proKat[f.kat] || 0) + 1;
  const gemischt = offen.map((f) => ({ f, r: (proKat[f.kat] || 0) + Math.random() * 0.9 })).sort((a, b) => a.r - b.r);
  const out = [];
  const katGenommen = new Set();
  for (const { f } of gemischt) { if (out.length >= n) break; if (!katGenommen.has(f.kat)) { out.push(f.id); katGenommen.add(f.kat); } }
  for (const { f } of gemischt) { if (out.length >= n) break; if (!out.includes(f.id)) out.push(f.id); }
  return out;
}

export function starte({ anzahl = RUNDE, nurId } = {}) {
  const d = laden();
  const ids = nurId ? [nurId] : naechsteFragen(anzahl, d);
  if (!ids.length) {
    return { answer: `Ich habe dir schon alle ${FRAGEN.length} Fragen gestellt, die ich mir ausgedacht habe. Ich kenne dich richtig gut! Du kannst mir aber jederzeit einfach etwas über dich erzählen.`, actions: ["kennenlernen"] };
  }
  runde = { bis: Date.now() + MINUTEN * 60000, fragen: ids, i: 0, gemerkt: [], ein: Boolean(nurId) || ids.length === 1 };
  const erste = FRAGE_NACH_ID[ids[0]].frage;
  const intro = nurId || ids.length === 1 ? "" : d.runden.length
    ? `Schön, noch eine Runde! ${ids.length} Fragen. Sag „weiter“, wenn du eine nicht beantworten willst, und „Stopp“ zum Aufhören. `
    : `Sehr gern, ich will dich besser kennenlernen! Ich stelle dir ${ids.length} Fragen. Sag „weiter“, wenn du eine überspringen willst, „sag ich nicht“, wenn ich sie nie wieder stellen soll, und „Stopp“ zum Aufhören. `;
  return { answer: intro + erste, actions: ["kennenlernen", "zuhoeren"] };
}

function rundeEnde(prefix = "") {
  const r = runde;
  runde = null;
  if (!r) return { answer: prefix.trim() || "Okay.", actions: ["kennenlernen"] };
  const d = laden();
  if (r.gemerkt.length && !r.ein) {
    d.runden = [...d.runden, { at: new Date().toISOString(), n: r.gemerkt.length }].slice(-100);
    sichern(d);
    eintragen({ bereich: "gedaechtnis", titel: `Kennenlern-Runde: ${r.gemerkt.length} neue Dinge über dich gelernt`, details: r.gemerkt.join(", ") });
  }
  const g = grad(d);
  const schluss = r.ein ? "" : r.gemerkt.length
    ? ` Danke! ${r.gemerkt.length === 1 ? "Eine neue Sache" : `${r.gemerkt.length} neue Sachen`} über dich gelernt. Ich kenne dich jetzt zu ${g} Prozent.`
    : prefix ? "" : " Kein Problem, dann ein andermal.";
  return { answer: `${prefix}${schluss}`.trim(), actions: ["kennenlernen"] };
}

const STOPP = U(/^(stopp|stop|aufhören|aufhoeren|hör auf|hoer auf|ende|beenden|genug|abbrechen|das reicht|reicht|fertig|schluss|keine lust( mehr)?|später|spaeter)$/);
const WEITER = U(/^(weiß nicht|weiss nicht|weiß ich nicht|weiss ich nicht|keine ahnung|überspringen|ueberspringen|überspring|nächste|naechste|nächste frage|naechste frage|weiter|pass|passe|egal|andere frage|keine antwort|hmm+|ähm+)$/);
const NIE = U(/^(sag ich nicht|sage ich nicht|verrat ich nicht|verrate ich nicht|privat|das ist privat|geht dich nichts an|möchte ich nicht sagen|moechte ich nicht sagen|will ich nicht sagen|frag das nie wieder|nie wieder fragen)$/);

function antwortInRunde(text) {
  const r = runde;
  const k = String(text || "").toLowerCase().replace(/^(hey |ok |okay )?(friday|freitag)[ ,.!:]*/, "").replace(/[?!.,]+/g, "").replace(/\s+/g, " ").trim();
  if (!k) return { answer: FRAGE_NACH_ID[r.fragen[r.i]].frage, actions: ["kennenlernen", "zuhoeren"] };
  if (STOPP.test(k) || /^danke( dir)?( friday)?$/.test(k)) return rundeEnde("Alles klar, wir machen ein andermal weiter.");
  const f = FRAGE_NACH_ID[r.fragen[r.i]];
  let rueck;
  if (NIE.test(k)) {
    const d = laden(); d.nie[f.id] = true; sichern(d);
    rueck = "Verstanden, das frage ich nicht mehr.";
  } else if (WEITER.test(k)) {
    rueck = ["Okay, nächste Frage.", "Kein Problem.", "Gut, dann was anderes."][r.i % 3];
  } else {
    const a = antwortKern(text);
    if (!a || a.length < 1) rueck = "Okay.";
    else {
      merkeAntwort(f.id, a, "runde");
      r.gemerkt.push(f.label);
      rueck = ["Gemerkt!", "Notiert.", "Schön, das merke ich mir.", "Okay, gespeichert.", "Cool, gemerkt."][r.gemerkt.length % 5];
    }
  }
  r.i += 1;
  if (r.i >= r.fragen.length) return rundeEnde(rueck);
  r.bis = Date.now() + MINUTEN * 60000;
  return { answer: `${rueck} ${FRAGE_NACH_ID[r.fragen[r.i]].frage}`, actions: ["kennenlernen", "zuhoeren"] };
}

/** Speichert eine Antwort auf eine Kennenlern-Frage (Runde, Dashboard oder Mitlernen). */
export function merkeAntwort(id, text, quelle = "dashboard") {
  const f = FRAGE_NACH_ID[id];
  if (!f) return { ok: false, error: "Unbekannte Frage." };
  const a = kurz(text, 200);
  const d = laden();
  if (!a) {
    delete d.antworten[id];
    sichern(d);
    gedaechtnisWeg(`kl:${id}`);
    return { ok: true, geloescht: true };
  }
  d.antworten[id] = { text: a, at: new Date().toISOString(), quelle };
  delete d.nie[id];
  sichern(d);
  gedaechtnisSetzen(`kl:${id}`, `${name()} – ${f.label}: ${a}`, f.schublade);
  // Passendes Feld im Profil gleich mit ausfüllen (nur wenn das Profil freigegeben ist).
  if (f.feld) { try { if (profil.frei()) profil.speichern({ [f.feld]: a }); } catch { /* Profil ist optional */ } }
  return { ok: true, antwort: d.antworten[id] };
}

// ---------- Nebenbei mitlernen ----------
const PRONOMEN = /^(dich|euch|es|das|dies\w*|den|dem|sie|ihn|ihm|ihr|so|nicht|wenn|dass|das nicht|es nicht|deine?n?|dein|alles|nichts|gar nichts)( |$)/;
const ROLLEN = {
  frau: "partner", freundin: "partner", partnerin: "partner", mann: "partner", freund: "partner", partner: "partner", verlobte: "partner",
  sohn: "sohn", tochter: "tochter", hund: "hund", katze: "katze", kater: "katze", mutter: "mutter", mama: "mutter", vater: "vater", papa: "vater",
  bruder: "bruder", schwester: "schwester", chef: "chef", chefin: "chef", oma: "oma", opa: "opa", "bester freund": "bester_freund", "beste freundin": "bester_freund",
};
const WEIBLICH = /^(frau|freundin|partnerin|verlobte|tochter|katze|mutter|mama|schwester|chefin|oma|beste freundin)$/;
const deinRolle = (w) => `Dein${WEIBLICH.test(w) ? "e" : ""} ${w.split(" ").map(gross1).join(" ")}`;
const ROLLEN_NAME = { partner: "Partner/in", sohn: "Sohn", tochter: "Tochter", hund: "Hund", katze: "Katze", mutter: "Mutter", vater: "Vater", bruder: "Bruder", schwester: "Schwester", chef: "Chef/in", oma: "Oma", opa: "Opa", bester_freund: "Bester Freund / beste Freundin" };
const VERB3 = { esse: "isst", trinke: "trinkt", höre: "hört", hoere: "hört", spiele: "spielt", schaue: "schaut", gucke: "guckt", lese: "liest", koche: "kocht", fahre: "fährt", backe: "backt", reise: "reist", tanze: "tanzt", zocke: "zockt", sehe: "sieht" };
const VERB_DU = { esse: "isst", trinke: "trinkst", höre: "hörst", hoere: "hörst", spiele: "spielst", schaue: "schaust", gucke: "guckst", lese: "liest", koche: "kochst", fahre: "fährst", backe: "backst", reise: "reist", tanze: "tanzt", zocke: "zockst", sehe: "siehst" };
const LIEBLINGS_ZU_FRAGE = { essen: "lieblingsessen", gericht: "lieblingsessen", getränk: "lieblingsgetraenk", getraenk: "lieblingsgetraenk", film: "lieblingsfilm", serie: "lieblingsserie", farbe: "lieblingsfarbe", verein: "lieblingsverein", band: "lieblingskuenstler", künstler: "lieblingskuenstler", kuenstler: "lieblingskuenstler", sänger: "lieblingskuenstler", saenger: "lieblingskuenstler", sängerin: "lieblingskuenstler", musik: "musik", held: "lieblingsheld", superheld: "lieblingsheld", restaurant: "lieblingsrestaurant", jahreszeit: "jahreszeit", spiel: "spiele", auto: "traumauto", sport: "sport" };

function objekt(s) {
  const o = String(s || "").replace(U(/[ ,]+(sehr|total|so|richtig|über alles|ueber alles|am meisten|wirklich|einfach|halt|eben|auch|gern|gerne)$/i), "").replace(/[.!]+$/, "").trim();
  if (o.length < 2 || o.length > 60 || o.includes("?") || PRONOMEN.test(o.toLowerCase())) return null;
  return o;
}

/** Erkennt Aussagen über sich selbst in einem Satz. Gibt {schluessel, fakt, du, schublade, frageId?} oder null. */
export function erkenneAussage(satz) {
  const t = String(satz || "").replace(/^(hey |ok |okay |übrigens |uebrigens |also |und )?(friday|freitag)?[ ,.!:]*/i, "").replace(/^(übrigens|uebrigens|also|und|weißt du|weisst du)[ ,]+/i, "").trim().replace(/[.!]+$/, "");
  const k = t.toLowerCase();
  if (!k || k.length > 140 || /\?/.test(t)) return null;
  if (U(/^(was|wie|wer|wo|wann|warum|wieso|weshalb|welche\w*|kannst|könntest|koenntest|sollte?|darf|ist|sind|hast|bist|gibt|weißt|weisst)\b/).test(k)) return null;
  if (U(/\b(wenn|falls|ob|vielleicht|früher|frueher|nicht mehr|sag mir|zeig mir|such|finde)\b/).test(k)) return null;
  const n = name();
  const M = (re) => { const u = U(re); return k.match(new RegExp(u.source, u.flags + "d")); };
  // Originalschreibweise des Treffers (Groß/klein bleibt erhalten: "Sushi", nicht "sushi").
  const teil = (m, i) => (m.indices?.[i] ? t.slice(m.indices[i][0], m.indices[i][1]) : m[i]);
  let m;
  // "mein Lieblingsessen ist Pizza", "meine Lieblingsband sind die Toten Hosen"
  if ((m = M((/^mein(?:e|en)? lieblings-?([a-zäöüß]{3,20}) (?:ist|sind|heißt|heisst|bleibt) (?:immer noch |definitiv |ganz klar )?(.{2,60})$/)))) {
    const o = objekt(teil(m, 2)); if (!o) return null;
    const frageId = LIEBLINGS_ZU_FRAGE[m[1]] || null;
    const label = frageId ? FRAGE_NACH_ID[frageId].label : `Lieblings${m[1]}`;
    return { schluessel: frageId ? `kl:${frageId}` : `auto:lieblings${m[1]}`, frageId, wert: o, fakt: `${n} – ${label}: ${o}`, du: `Dein ${gross1(`lieblings${m[1]}`)}: ${o}`, schublade: "vorliebe" };
  }
  // "meine Frau heißt Carla", "mein Hund heißt Bruno"
  if ((m = M((/^mein(?:e)? (bester freund|beste freundin|frau|freundin|partnerin|mann|freund|partner|verlobte|sohn|tochter|hund|katze|kater|mutter|mama|vater|papa|bruder|schwester|chef|chefin|oma|opa) (?:heißt|heisst|ist die|ist der) ([a-zäöüß][a-zäöüß\- ]{1,30})$/)))) {
    const rolle = ROLLEN[m[1]];
    const nm = teil(m, 2).split(" ").slice(0, 3).map(gross1).join(" ");
    const frageId = rolle === "partner" ? "name_partner" : rolle === "bester_freund" ? "bester_freund" : null;
    return { schluessel: frageId ? `kl:${frageId}` : `auto:name_${rolle}`, frageId, wert: nm, fakt: `${n}s ${ROLLEN_NAME[rolle]} heißt ${nm}`, du: `${deinRolle(m[1])} heißt ${nm}`, schublade: "person" };
  }
  // "ich esse gern Sushi", "ich höre gerne Rap", "ich trinke Kaffee am liebsten"
  if ((m = M((/^ich (esse|trinke|höre|hoere|spiele|schaue|gucke|lese|koche|fahre|backe|reise|tanze|zocke|sehe) (?:sehr |total |richtig |besonders |am liebsten |unheimlich )?gerne? (.{2,60})$/))) || (m = M((/^ich (esse|trinke|höre|hoere|spiele|schaue|gucke|lese|koche|fahre|backe|reise|tanze|zocke|sehe) (.{2,60}?) (?:sehr |total |richtig |besonders )?(?:gerne?|am liebsten)$/)))) {
    const o = objekt(teil(m, 2)); if (!o) return null;
    return { schluessel: `auto:${m[1]}:${o.toLowerCase().slice(0, 40)}`, wert: o, fakt: `${n} ${VERB3[m[1]]} gern ${o}`, du: `Du ${VERB_DU[m[1]]} gern ${o}`, schublade: "vorliebe" };
  }
  // "ich mag keine Pilze", "ich hasse Montage"
  if ((m = M((/^ich (?:mag|esse|trinke) (?:überhaupt |ueberhaupt |gar )?(kein(?:e|en)?) (.{2,50})$/)))) {
    const o = objekt(teil(m, 2)); if (!o) return null;
    return { schluessel: `auto:magnicht:${o.toLowerCase().slice(0, 40)}`, wert: o, fakt: `${n} mag ${m[1]} ${o}`, du: `Du magst ${m[1]} ${o}`, schublade: "vorliebe" };
  }
  if ((m = M((/^ich (?:hasse|kann (.{2,40}) nicht leiden|mag (.{2,40}) (?:überhaupt |gar )?nicht)(?: (.{2,50}))?$/)))) {
    const o = objekt(teil(m, m[1] ? 1 : m[2] ? 2 : 3) || ""); if (!o) return null;
    return { schluessel: `auto:magnicht:${o.toLowerCase().slice(0, 40)}`, wert: o, fakt: `${n} mag ${o} nicht`, du: `Du magst ${o} nicht`, schublade: "vorliebe" };
  }
  // "ich mag Sushi", "ich liebe Iron Man"
  if ((m = M((/^ich (mag|liebe|feiere|vergöttere) (?:total |sehr |richtig |echt )?(.{2,50})$/)))) {
    const o = objekt(teil(m, 2)); if (!o) return null;
    const v = m[1] === "liebe" ? ["liebt", "liebst"] : ["mag", "magst"];
    return { schluessel: `auto:mag:${o.toLowerCase().slice(0, 40)}`, wert: o, fakt: `${n} ${v[0]} ${o}`, du: `Du ${v[1]} ${o}`, schublade: "vorliebe" };
  }
  // "ich bin allergisch gegen Nüsse", "ich vertrage keine Laktose"
  if ((m = M((/^ich bin allergisch (?:gegen|auf) (.{2,50})$/))) || (m = M((/^ich habe eine (.{2,40}?)[- ]?allergie$/)))) {
    const o = objekt(teil(m, 1)); if (!o) return null;
    return { schluessel: `auto:allergie:${o.toLowerCase().slice(0, 40)}`, wert: o, fakt: `${n} ist allergisch gegen ${o}`, du: `Du bist allergisch gegen ${o}. Darauf achte ich bei Rezepten`, schublade: "vorliebe" };
  }
  if ((m = M((/^ich vertrage (kein(?:e|en)?) (.{2,40})$/)))) {
    const o = objekt(teil(m, 2)); if (!o) return null;
    return { schluessel: `auto:vertraegt:${o.toLowerCase().slice(0, 40)}`, wert: o, fakt: `${n} verträgt ${m[1]} ${o}`, du: `Du verträgst ${m[1]} ${o}. Darauf achte ich`, schublade: "vorliebe" };
  }
  if ((m = M((/^ich (?:bin|lebe) (vegetarier(?:in)?|veganer(?:in)?|vegan|vegetarisch)$/)))) {
    const o = gross1(m[1]);
    return { schluessel: "auto:ernaehrung", wert: o, fakt: `${n} ernährt sich ${/vegan/.test(m[1]) ? "vegan" : "vegetarisch"}`, du: `Du lebst ${/vegan/.test(m[1]) ? "vegan" : "vegetarisch"}. Das merke ich mir für Rezepte`, schublade: "vorliebe" };
  }
  // "ich wohne in Hamburg", "ich arbeite als Elektriker", "ich arbeite bei Bosch"
  if ((m = M((/^ich wohne (?:jetzt |seit \S+ (?:jahren? )?)?(?:in|im) ([a-zäöüß][a-zäöüß\- .]{1,40})$/)))) {
    const o = objekt(teil(m, 1)); if (!o) return null;
    return { schluessel: "auto:wohnort", wert: gross1(o), fakt: `${n} wohnt in ${gross1(o)}`, du: `Du wohnst in ${gross1(o)}`, schublade: "ort" };
  }
  if ((m = M((/^ich (?:arbeite|jobbe) als (.{2,40})$/))) || (m = M((/^ich bin (.{3,30}) von beruf$/)))) {
    const o = objekt(teil(m, 1)); if (!o) return null;
    return { schluessel: "kl:beruf", frageId: "beruf", wert: gross1(o), fakt: `${n} – Beruf: ${gross1(o)}`, du: `Du arbeitest als ${gross1(o)}`, schublade: "arbeit" };
  }
  if ((m = M((/^ich arbeite (?:bei|für|fuer) (.{2,40})$/)))) {
    const o = objekt(teil(m, 1)); if (!o) return null;
    return { schluessel: "auto:arbeitgeber", wert: gross1(o), fakt: `${n} arbeitet bei ${gross1(o)}`, du: `Du arbeitest bei ${gross1(o)}`, schublade: "arbeit" };
  }
  // "ich fahre einen Mercedes C63"
  if ((m = M((/^ich fahre (?:einen|eine|ein) ((?:neuen |alten |schwarzen |weißen |weissen |roten |blauen |grauen )?(?:mercedes|benz|amg|bmw|audi|vw|volkswagen|golf|polo|passat|tiguan|porsche|opel|ford|toyota|tesla|skoda|seat|cupra|hyundai|kia|renault|peugeot|fiat|mazda|honda|nissan|volvo|dacia|citroen|citroën|smart|mini|jeep|land rover|range rover|lamborghini|ferrari|maserati|bentley|jaguar|lexus|suzuki|mitsubishi|subaru|alfa|e-auto|elektroauto|kombi|suv|transporter|cabrio)\b.{0,30})$/)))) {
    const o = objekt(teil(m, 1)); if (!o) return null;
    return { schluessel: "kl:auto", frageId: "auto", wert: gross1(o), fakt: `${n} – Auto: ${gross1(o)}`, du: `Du fährst einen ${gross1(o)}`, schublade: "technik" };
  }
  // "ich bin Fan von Bayern", "ich bin großer Dortmund-Fan"
  if ((m = M((/^ich bin (?:ein |eine )?(?:großer |grosser |riesiger |totaler |richtiger )?fan (?:von|vom|der|des) (.{2,40})$/))) || (m = M((/^ich bin (?:ein |eine )?(?:großer |grosser |riesiger |totaler |richtiger )?([a-zäöüß0-9]{2,25})[- ]fan$/)))) {
    const o = objekt(teil(m, 1)); if (!o) return null;
    return { schluessel: `auto:fan:${o.toLowerCase().slice(0, 40)}`, wert: gross1(o), fakt: `${n} ist Fan von ${gross1(o)}`, du: `Du bist Fan von ${gross1(o)}`, schublade: "vorliebe" };
  }
  // "ich stehe meistens um 6 Uhr auf"
  if ((m = M((/^ich (?:stehe|steh) (?:meistens |immer |normalerweise |jeden tag )?um (\d{1,2}(?:[:.]\d{2})?) (?:uhr )?auf$/)))) {
    return { schluessel: "kl:aufstehen", frageId: "aufstehen", wert: `${m[1]} Uhr`, fakt: `${n} – Aufstehzeit: ${m[1]} Uhr`, du: `Du stehst um ${m[1]} Uhr auf`, schublade: "termin" };
  }
  // "antworte mir kürzer", "ich will kurze Antworten"
  if ((m = M((/^(?:antworte|antwortet) (?:mir )?(?:bitte )?(?:immer )?(kürzer|kuerzer|kurz|ausführlicher|ausfuehrlicher|ausführlich|ausfuehrlich)$/))) || (m = M((/^ich (?:will|möchte|moechte|mag) (?:lieber )?(kurze|kürzere|kuerzere|ausführliche|ausfuehrliche|lange|längere) antworten$/)))) {
    const kurzW = /k(ü|ue)rz|kurz/.test(m[1]);
    const o = kurzW ? "kurz und knapp" : "ausführlich";
    return { schluessel: "kl:antwort_laenge", frageId: "antwort_laenge", wert: gross1(o), fakt: `${n} – Antworten am liebsten: ${o}`, du: `Ab jetzt antworte ich dir ${o}`, schublade: "vorliebe" };
  }
  return null;
}

function saetze(text) {
  return String(text || "").split(/(?<=[.!;])\s+|\s+(?:und außerdem|außerdem|ausserdem)\s+/i).map((s) => s.trim()).filter(Boolean).slice(0, 6);
}

let zuletzt = { at: 0, liste: [] };
/** Nebenbei mitlernen: speichert Aussagen über Boss. Gibt die Treffer zurück (leer, wenn nichts). */
export function mitlernen(text, { quelle = "gespraech" } = {}) {
  if (runde && runde.bis > Date.now()) return [];
  const d = laden();
  if (!d.mitlernen) return [];
  const treffer = [];
  for (const s of saetze(text)) {
    const a = erkenneAussage(s);
    if (!a) continue;
    if (a.frageId) {
      merkeAntwort(a.frageId, a.wert, "mitgelernt");
    } else {
      const d2 = laden();
      d2.gelernt = [...d2.gelernt.filter((x) => x.schluessel !== a.schluessel), { schluessel: a.schluessel, text: a.fakt, du: a.du, wert: a.wert, schublade: a.schublade, at: new Date().toISOString(), quelle }].slice(-200);
      sichern(d2);
      gedaechtnisSetzen(a.schluessel, a.fakt, a.schublade);
    }
    eintragen({ bereich: "gedaechtnis", titel: `Nebenbei gelernt: ${a.du}` });
    treffer.push(a);
  }
  if (treffer.length) zuletzt = { at: Date.now(), liste: treffer.map((x) => x.fakt) };
  return treffer;
}

export function gelerntLoeschen(schluessel) {
  const d = laden();
  const vorher = d.gelernt.length;
  d.gelernt = d.gelernt.filter((x) => x.schluessel !== schluessel);
  sichern(d);
  gedaechtnisWeg(schluessel);
  return { ok: d.gelernt.length !== vorher };
}

// ---------- Auswertung ----------
export function grad(d = laden()) {
  const beantwortet = FRAGEN.filter((f) => d.antworten[f.id]).length;
  const extra = Math.min(20, d.gelernt.length);
  const mem = Math.min(15, store.getMemories().filter((m) => !m.schluessel).length);
  return Math.min(100, Math.round(((beantwortet + extra * 0.5 + mem * 0.3) / FRAGEN.length) * 100));
}

export function stand() {
  const d = laden();
  const kategorien = Object.entries(KATEGORIEN).map(([id, [icon, name]]) => {
    const fr = FRAGEN.filter((f) => f.kat === id);
    return { id, icon, name, gesamt: fr.length, beantwortet: fr.filter((f) => d.antworten[f.id]).length };
  });
  let gewohnheiten = "";
  try { const p = vorlieben.gespeichert(); if (p) gewohnheiten = vorlieben.satz(p).replace(/\s+/g, " ").replace(/ ,/g, ","); } catch { /* egal */ }
  return {
    grad: grad(d),
    mitlernen: d.mitlernen,
    runden: d.runden.length,
    kategorien,
    fragen: FRAGEN.map((f) => ({ id: f.id, kat: f.kat, frage: f.frage, label: f.label, antwort: d.antworten[f.id]?.text || "", at: d.antworten[f.id]?.at || null, quelle: d.antworten[f.id]?.quelle || null, nie: Boolean(d.nie[f.id]) })),
    gelernt: d.gelernt.slice().reverse(),
    gedaechtnis: store.getMemories().length,
    gewohnheiten,
    laeuft: laeuft(),
  };
}

export function einstellen(roh = {}) {
  const d = laden();
  if ("mitlernen" in roh) d.mitlernen = roh.mitlernen !== false && roh.mitlernen !== "0";
  if (roh.nie && typeof roh.nie === "object" && FRAGE_NACH_ID[roh.nie.id]) { if (roh.nie.an) d.nie[roh.nie.id] = true; else delete d.nie[roh.nie.id]; }
  sichern(d);
  return stand();
}

/** Kurzer Steckbrief für Claude (System-Kontext). Leer, wenn noch nichts bekannt ist. */
export function kontext() {
  let d;
  try { d = laden(); } catch { return ""; }
  const zeilen = [];
  const fr = FRAGEN.filter((f) => d.antworten[f.id]);
  const wieFriday = fr.filter((f) => f.kat === "friday").map((f) => `${f.label}: ${d.antworten[f.id].text}`);
  const rest = fr.filter((f) => f.kat !== "friday").map((f) => `${f.label}: ${d.antworten[f.id].text}`);
  const neben = d.gelernt.slice(-8).map((x) => x.text.replace(`${name()} `, "").replace(`${name()}s `, ""));
  if (wieFriday.length) zeilen.push(`So will ${name()} dich haben (unbedingt beachten): ${wieFriday.join("; ")}.`);
  if (rest.length || neben.length) zeilen.push(`Das weißt du über ${name()} (nutze es, um persönlich zu antworten, ohne es ständig aufzuzählen): ${[...rest, ...neben].join("; ").slice(0, 900)}.`);
  if (zuletzt.liste.length && Date.now() - zuletzt.at < 120000) zeilen.push(`Gerade eben schon automatisch gemerkt (nicht noch einmal mit remember speichern): ${zuletzt.liste.join("; ")}.`);
  return zeilen.join("\n");
}

// ---------- Sprachbefehle ----------
const START = U(/^(?:bitte )?(?:lern|lerne) mich (?:besser |noch besser |richtig )?kennen$|^(?:lass|lasst) uns (?:uns )?(?:besser )?kennenlernen$|^kennenlern[- ]?(?:runde|fragen|modus)$|^kennenlernen$|^(?:stell|stelle) mir (?:ein paar |mal |paar |noch ein paar )?fragen(?: über mich| ueber mich| zu mir)?$|^frag mich (?:mal |ein paar dinge |etwas |was |ein bisschen )?(?:über mich|ueber mich|aus|persönliches|persoenliches)$|^interview mich$|^willst du mich (?:besser )?kennenlernen$|^noch eine kennenlern ?runde$/);
const WIE_GUT = U(/^(?:wie gut kennst du mich|was weißt du (?:alles )?über mich|was weisst du (?:alles )?(?:über|ueber) mich|was hast du (?:alles )?über mich gelernt|was hast du (?:alles )?ueber mich gelernt|wie viel weißt du über mich|öffne friday kennt (?:dich|mich)|zeig mir was du über mich weißt|was weißt du von mir)$/);
const LIEBLINGS_FRAGE = U(/^(?:was|wer|welche[rs]?) (?:ist|sind|war) (?:eigentlich )?mein(?:e|en)? lieblings-?([a-zäöüß]{3,20})$/);
const WER_HEISST = U(/^wie heißt (?:eigentlich )?mein(?:e)? (bester freund|beste freundin|frau|freundin|partnerin|mann|freund|partner|sohn|tochter|hund|katze|kater|mutter|mama|vater|papa|bruder|schwester|chef|chefin|oma|opa)$/);
const MITLERNEN_AUS = U(/^(?:hör|hoer|höre|hoere) auf(?:,)? (?:mich |dir )?(?:nebenbei )?(?:dinge |sachen )?(?:zu merken|mitzulernen|über mich zu lernen)$|^nebenbei (?:mit)?lernen aus$|^mitlernen aus$/);
const MITLERNEN_AN = U(/^nebenbei (?:mit)?lernen an$|^mitlernen an$|^(?:lerne|lern) wieder (?:nebenbei )?mit$/);

function sauber(text) {
  return String(text || "").replace(/^(hey |hallo |ok |okay )?(friday|freitag)[ ,.!:]*/i, "").trim().replace(/[?!.]+$/, "").toLowerCase().replace(/\s+/g, " ");
}

function aufzaehlen(l) { return l.length > 1 ? `${l.slice(0, -1).join(", ")} und ${l.at(-1)}` : l[0] || ""; }

/** Läuft eine Kennenlern-Runde? Dann gehört jede Antwort hierher (ganz früh in brain.ask). */
export function fruehBefehl(text) {
  if (!laeuft()) { runde = null; return null; }
  return antwortInRunde(text);
}

export function quickCommand(text) {
  const k = sauber(text);
  if (!k || k.length > 160) return null;
  if (START.test(k)) return starte();
  if (/^(?:frag mich (?:eine|noch eine) frage(?: über mich| ueber mich)?|noch eine frage über mich)$/.test(k)) return starte({ anzahl: 1 });
  if (MITLERNEN_AUS.test(k)) { einstellen({ mitlernen: false }); return { answer: "Okay, ich merke mir nebenbei nichts mehr. Sag „mitlernen an“, wenn ich wieder zuhören soll.", actions: ["kennenlernen"] }; }
  if (MITLERNEN_AN.test(k)) { einstellen({ mitlernen: true }); return { answer: "Gut, ich lerne wieder nebenbei mit, wenn du mir etwas über dich erzählst.", actions: ["kennenlernen"] }; }
  if (WIE_GUT.test(k)) {
    const d = laden();
    const g = grad(d);
    const bekannt = FRAGEN.filter((f) => d.antworten[f.id] && f.kat !== "friday").map((f) => `${f.label}: ${d.antworten[f.id].text}`);
    const neben = d.gelernt.slice(-4).map((x) => x.du.replace(/\. Darauf.*$|\. Das merke.*$/, "").replace(/^Du /, "du ").replace(/^Dein/, "dein"));
    const beispiele = [...bekannt.sort(() => Math.random() - 0.5).slice(0, 4), ...neben.slice(0, 2)];
    if (!beispiele.length) return { answer: "Noch nicht so gut, wie ich gern würde. Sag „lern mich kennen“, dann stelle ich dir ein paar Fragen. Oder erzähl mir einfach, was du magst, ich merke es mir.", actions: ["kennenlernen"] };
    return { answer: `Ich kenne dich zu ${g} Prozent. Zum Beispiel: ${aufzaehlen(beispiele)}.${g < 80 ? " Sag „lern mich kennen“, dann frage ich weiter." : ""}`, actions: ["kennenlernen"] };
  }
  let m;
  if ((m = k.match(LIEBLINGS_FRAGE))) {
    const id = LIEBLINGS_ZU_FRAGE[m[1]];
    const d = laden();
    const a = id && d.antworten[id]?.text;
    const neben = !a && d.gelernt.find((x) => x.schluessel === `auto:lieblings${m[1]}`);
    if (a || neben) return { answer: `Dein Lieblings${m[1]}: ${a || neben.wert}.`, actions: ["kennenlernen"] };
    if (id) { const r = starte({ nurId: id }); return { answer: `Das weiß ich noch nicht. ${r.answer}`, actions: r.actions }; }
    return null; // unbekannte Kategorie → normales Gedächtnis/Claude
  }
  if ((m = k.match(WER_HEISST))) {
    const rolle = ROLLEN[m[1]];
    const d = laden();
    const frageId = rolle === "partner" ? "name_partner" : rolle === "bester_freund" ? "bester_freund" : null;
    const a = frageId ? d.antworten[frageId]?.text : d.gelernt.find((x) => x.schluessel === `auto:name_${rolle}`)?.wert;
    if (a) return { answer: `${deinRolle(m[1])} heißt ${a}.`, actions: ["kennenlernen"] };
    return null; // vielleicht steht es im normalen Gedächtnis oder im Profil → normaler Weg
  }
  return null;
}

/**
 * Vor dem normalen Weg (brain.askVerstanden): nebenbei mitlernen. Ist der ganze Satz nur eine Aussage über Boss
 * ("ich mag Sushi"), antwortet Friday gleich selbst, ohne Claude. Nicht, wenn Friday gerade auf eine Antwort wartet
 * (letzte Antwort hatte "zuhoeren", z. B. "Was soll ich ihr sagen?").
 */
export function vorab(text, letzteAktionen = []) {
  if (laeuft() || (letzteAktionen || []).includes("zuhoeren")) return null;
  const t = String(text || "");
  if (!t.trim() || t.length > 400) return null;
  const tr = mitlernen(t, { quelle: "gespraech" });
  if (!tr.length || saetze(t).length !== 1) return null;
  return { answer: `${["Gemerkt!", "Notiert.", "Okay, merk ich mir.", "Schön zu wissen, gemerkt."][Math.floor(Math.random() * 4)]} ${tr[0].du}.`, actions: ["kennenlernen_gemerkt"] };
}

export function routen(app, asyncRoute) {
  app.get("/api/kennenlernen", asyncRoute(async (_req, res) => res.json(stand())));
  app.post("/api/kennenlernen/antwort", asyncRoute(async (req, res) => {
    const { id, text } = req.body || {};
    const r = merkeAntwort(String(id || ""), String(text ?? ""), "dashboard");
    if (!r.ok) return res.status(400).json(r);
    res.json({ ...r, stand: stand() });
  }));
  app.post("/api/kennenlernen/einstellungen", asyncRoute(async (req, res) => res.json(einstellen(req.body || {}))));
  app.post("/api/kennenlernen/vergessen", asyncRoute(async (req, res) => { gelerntLoeschen(String(req.body?.schluessel || "")); res.json(stand()); }));
}
