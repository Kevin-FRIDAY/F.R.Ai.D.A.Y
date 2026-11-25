// Kontext-Erkennung + Command Prediction (v1.184.0, Mark XIII).
//
//  🧭 Kontext-Erkennung   In welcher Lage ist Boss gerade? Tageszeit, Werktag/Wochenende, nächster Termin, ob er
//                         schläft ("gute Nacht" gesagt), laufende Mission, Gäste- oder Notfallmodus, zuletzt benutztes
//                         Gerät. Daraus ein Modus (Morgenroutine, Arbeit, Feierabend, Nacht, Wochenende) – Friday
//                         bekommt das als eine Zeile in den Kontext und antwortet passender.
//  🔮 Command Prediction  Aus Fridays eigener Datenbank (alle früheren Fragen): Was fragt Boss um diese Uhrzeit an so
//                         einem Tag meistens? Und was kommt oft direkt nach der letzten Frage? Mit ehrlicher
//                         Trefferquote (Rückrechnung auf echte frühere Fragen).
// Ohne Claude, ohne Kosten.
import * as store from "./store.js";
import { config } from "./config.js";
import { aktiv as gaesteAktiv } from "./gaeste.js";

const sicher = async (fn) => { try { return await fn(); } catch { return null; } };
let lageCache = { zeit: 0, wert: null };

function ortszeit(ms = Date.now()) {
  const s = new Date(ms).toLocaleString("sv-SE", { timeZone: config.timezone || "Europe/Berlin" });
  const [tag, zeit] = s.split(" ");
  const [h, m] = zeit.split(":").map(Number);
  return { tag, h, m, wd: new Date(`${tag}T12:00:00Z`).getUTCDay() };
}

/** Lage jetzt (asynchron, mit Kalender). Wird alle 5 Minuten aufgefrischt. */
export async function lageErkennen() {
  const o = ortszeit();
  const werktag = o.wd >= 1 && o.wd <= 5;
  const tageszeit = o.h < 5 ? "Nacht" : o.h < 10 ? "Morgen" : o.h < 12 ? "Vormittag" : o.h < 14 ? "Mittag" : o.h < 18 ? "Nachmittag" : o.h < 22 ? "Abend" : "Nacht";
  const schlaf = await sicher(async () => (await import("./schlaf.js")).stand());
  const schlaeft = Boolean(schlaf?.offen);
  const kal = await sicher(async () => (await import("./kalender.js")).termine(0, 1));
  const jetzt = Date.now();
  const termine = kal?.ok ? kal.termine.filter((t) => !t.ganz) : [];
  const laufend = termine.find((t) => +new Date(t.start) <= jetzt && +new Date(t.ende) > jetzt);
  const naechster = termine.find((t) => +new Date(t.start) > jetzt);
  const mission = await sicher(async () => { const M = await import("./missionen.js"); const l = M.liste?.() || M.uebersicht?.(); const arr = Array.isArray(l) ? l : l?.missionen || []; return arr.find((x) => ["laeuft", "läuft", "aktiv"].includes(x.status)) || null; });
  const gaeste = await sicher(async () => (await import("./gaeste.js")).aktiv());
  const notfall = await sicher(async () => (await import("./kommando.js")).notfallAktiv());
  const letzte = letzteFragen(1)[0];
  let modus;
  if (schlaeft || tageszeit === "Nacht") modus = "Nacht";
  else if (laufend) modus = "Im Termin";
  else if (!werktag) modus = "Wochenende";
  else if (o.h < 9) modus = "Morgenroutine";
  else if (o.h < 17) modus = "Arbeitszeit";
  else modus = "Feierabend";
  const wert = {
    zeit: new Date(jetzt).toISOString(), tageszeit, werktag, wochentag: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][o.wd], modus,
    schlaeft, termin: laufend ? { titel: laufend.titel, bis: laufend.ende } : null,
    naechster: naechster ? { titel: naechster.titel, start: naechster.start, inMin: Math.round((+new Date(naechster.start) - jetzt) / 60000) } : null,
    kalender: Boolean(kal?.ok), mission: mission ? { titel: mission.titel || mission.ziel } : null,
    gaeste: Boolean(gaeste), notfall: Boolean(notfall),
    geraet: letzte ? kanalName(letzte.kanal) : null,
  };
  lageCache = { zeit: jetzt, wert };
  return wert;
}
const kanalName = (k) => ({ web: "Dashboard", telegram: "Telegram", siri: "Siri/Kurzbefehl", automation: "Automation", briefing: "Briefing" }[k] || k || "Dashboard");

/** Eine Zeile für Fridays Kontext (synchron, aus dem Zwischenspeicher). */
export function zeile() {
  const l = lageCache.wert;
  if (!l || Date.now() - lageCache.zeit > 30 * 60000) return "";
  const t = [`Lage jetzt: ${l.wochentag}, ${l.tageszeit}, Modus „${l.modus}“`];
  if (l.gaeste || gaesteAktiv()) return `${t[0]}. Gästemodus an. Antworte passend zur Lage.`; // keine privaten Termine/Missionen für Besuch
  if (l.termin) t.push(`gerade im Termin „${l.termin.titel}“`);
  else if (l.naechster && l.naechster.inMin <= 90) t.push(`nächster Termin „${l.naechster.titel}“ in ${l.naechster.inMin} Min.`);
  if (l.mission) t.push(`Mission läuft: ${l.mission.titel}`);
  return `${t.join(", ")}. Antworte passend zur Lage (z. B. im Termin kurz, nachts leise und knapp).`;
}

// ---------- 🔮 Command Prediction ----------
const STOP = new Set("friday freitag bitte mal mir mich mein meine meinen ich du was wie wo ist sind der die das den dem ein eine und oder zu zum zur im in am an auf für von mit noch jetzt heute hey hallo ok".split(" "));
/** Aus einer Frage ein wiedererkennbares Muster machen ("Friday, wie ist das Wetter in Köln?" → "wetter köln"). */
export function muster(frage = "") {
  const w = String(frage).toLowerCase().replace(/[^a-zäöüß0-9 ]+/g, " ").split(/\s+/).filter((x) => x.length > 2 && !STOP.has(x) && !/^\d+$/.test(x));
  return w.slice(0, 3).join(" ");
}
function letzteFragen(n = 3000) {
  const l = store.leseArchiv().filter((e) => e.typ === "gespraech" && e.frage && !["automation", "briefing"].includes(e.kanal));
  return l.slice(-n).reverse();
}

/** Vorhersage aus einer Liste früherer Fragen (älteste zuerst) für einen Zeitpunkt. */
export function vorhersageAus(fragen, ms = Date.now(), letzte = null) {
  const o = ortszeit(ms);
  const wt = o.wd >= 1 && o.wd <= 5;
  const punkte = new Map();
  const beispiel = new Map();
  const add = (m, p, f) => { if (!m) return; punkte.set(m, (punkte.get(m) || 0) + p); if (!beispiel.has(m)) beispiel.set(m, f); };
  for (const e of fragen) {
    const t = ortszeit(Date.parse(e.at));
    const m = muster(e.frage);
    const diffH = Math.min(Math.abs(t.h + t.m / 60 - (o.h + o.m / 60)), 24 - Math.abs(t.h + t.m / 60 - (o.h + o.m / 60)));
    if (diffH <= 1.5) add(m, ((t.wd >= 1 && t.wd <= 5) === wt ? 1 : 0.4) * (diffH <= 0.5 ? 1.5 : 1), e.frage);
  }
  // Abfolge: was kam früher innerhalb von 10 Minuten nach derselben Frage?
  if (letzte) {
    const lm = muster(letzte);
    for (let i = 0; i < fragen.length - 1; i++) {
      if (muster(fragen[i].frage) !== lm) continue;
      const n = fragen[i + 1];
      if (Date.parse(n.at) - Date.parse(fragen[i].at) < 600000 && muster(n.frage) !== lm) add(muster(n.frage), 2, n.frage);
    }
  }
  const summe = [...punkte.values()].reduce((a, b) => a + b, 0) || 1;
  return [...punkte.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, p]) => ({ muster: m, beispiel: beispiel.get(m), sicherheit: Math.round((p / summe) * 100) }));
}

/** Ehrliche Trefferquote: für die letzten 40 Fragen vorhersagen, nur mit dem, was davor war. */
export function trefferquote(fragenNeuZuerst = letzteFragen()) {
  const alt = fragenNeuZuerst.slice().reverse();
  let geprueft = 0, treffer = 0;
  for (let i = Math.max(20, alt.length - 40); i < alt.length; i++) {
    const vorher = alt.slice(0, i);
    const v = vorhersageAus(vorher, Date.parse(alt[i].at), alt[i - 1]?.frage);
    if (!v.length) continue;
    geprueft++;
    if (v.some((x) => x.muster === muster(alt[i].frage))) treffer++;
  }
  return { geprueft, treffer, quote: geprueft ? Math.round((treffer / geprueft) * 100) : null };
}

export async function stand() {
  const lage = await lageErkennen();
  const fragen = letzteFragen();
  const alt = fragen.slice().reverse();
  return { lage, vorhersage: fragen.length >= 10 ? vorhersageAus(alt, Date.now(), fragen[0]?.frage) : [], fragen: fragen.length, treffer: fragen.length >= 25 ? trefferquote(fragen) : { geprueft: 0, treffer: 0, quote: null } };
}

export async function quickCommand(text) {
  const t = String(text || "").toLowerCase();
  if (/was (will|möchte|frage) ich (wohl )?(als nächstes|gleich)|errate(st)? (du )?meinen nächsten befehl|was frag ich (sonst )?um diese zeit/.test(t)) {
    const s = await stand();
    if (!s.vorhersage.length) return { answer: "Dafür kenne ich dich noch zu wenig. Ab etwa 10 gespeicherten Fragen kann ich raten.", actions: ["cockpit:denken"] };
    return { answer: `Ich tippe auf: ${s.vorhersage.map((v) => `„${v.beispiel}“`).join(" oder ")}.${s.treffer.quote != null ? ` Bisher liege ich damit in ${s.treffer.quote} Prozent der Fälle richtig.` : ""}`, actions: ["cockpit:denken"] };
  }
  if (/in welche(r)? (lage|situation) bin ich|welcher modus|was ist (gerade )?mein kontext|kontext.?erkennung/.test(t)) {
    const l = await lageErkennen();
    return { answer: `Ich sehe: ${l.wochentag}, ${l.tageszeit}, Modus ${l.modus}.${l.termin ? ` Du bist gerade im Termin ${l.termin.titel}.` : l.naechster ? ` Nächster Termin: ${l.naechster.titel} in ${l.naechster.inMin} Minuten.` : ""}${l.mission ? ` Es läuft die Mission ${l.mission.titel}.` : ""}`, actions: ["cockpit:denken"] };
  }
  return null;
}

export function kontextRouten(app, asyncRoute) {
  app.get("/api/kontext", asyncRoute(async (_req, res) => res.json(await stand())));
}

export async function kontextStart() {
  lageErkennen().catch(() => {});
  setInterval(() => lageErkennen().catch(() => {}), 5 * 60000).unref?.();
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "kontext", bereich: "Denken", name: "Kontext-Erkennung und Befehls-Vorhersage", lauf: async () => {
      const l = await lageErkennen();
      if (!l.modus || !l.tageszeit) return { status: "fehler", text: "Keine Lage erkannt." };
      const fragen = letzteFragen();
      if (fragen.length < 25) return { status: "uebersprungen", text: `Lage erkannt (${l.modus}). Für die Vorhersage-Trefferquote fehlen noch Fragen (${fragen.length}/25).` };
      const q = trefferquote(fragen);
      return { status: "bestanden", text: `Lage: ${l.modus}. Vorhersage an ${q.geprueft} echten Fragen nachgeprüft: ${q.quote} % Treffer (Top 3).` };
    } });
  } catch { /* egal */ }
}
