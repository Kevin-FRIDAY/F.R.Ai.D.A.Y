// Fridays Agenten-Leitung (v1.180.0, Mark XII Punkte 6, 7, 9, 10 und 24).
//
//  🛡 Kontroll-Agent      prüft JEDEN Bericht eines Agenten mit echten Regeln (nicht leer, keine Platzhalter,
//                         passende Inhalte: Wetter braucht °C, Krypto braucht Euro-Beträge …). Erst wenn die
//                         Prüfung besteht, zählt ein Einsatz als erfolgreich. Fehlende Quelle = Fehler, nicht "ok".
//  🏢 Unternehmensleitung Kennzahlen je Agent (Einsätze, Erfolgsquote, Prüfquote, Tempo). Wer 3-mal hintereinander
//                         scheitert, wird automatisch pausiert (1 h, bei Wiederholung länger, max. 24 h) und gemeldet.
//  🎓 Agenten-Ausbildung  eigene Agenten aus einem Grund-Agenten + fester Eingabe + eigenen Prüfregeln
//                         ("muss enthalten"). Erst nach einem bestandenen Probelauf sind sie einsatzbereit.
//  🗺 Aufgabenplanung     zerlegt einen Auftrag OHNE Claude in Agenten-Schritte (lokal, kostenlos).
//
// Alles ohne Claude. Gespeichert in server/data/agentenleitung.json.
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";
import { sende } from "./ereignisbus.js";

const NAME = "agentenleitung";
const SERIE_PAUSE = 3;
const PAUSE_MIN = 60;
const neueId = () => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const lade = () => ({ kpi: {}, eigene: [], ...store.load(NAME, {}) });
const sichere = (d) => store.save(NAME, d);
const jetzt = () => new Date().toISOString();

// Einsätze erst bei Bedarf laden (agenten-einsatz.js lädt dieses Modul ebenfalls → kein Import-Kreis).
let einsatzModul = null;
async function einsatz() { return (einsatzModul ||= await import("./agenten-einsatz.js")); }

// ---------- 🛡 Kontroll-Agent ----------
// Inhaltliche Mindestanforderung je Grund-Agent (passt zu den Berichten in agenten-einsatz.js).
export const REGELN = {
  wetter: { re: /°\s?C|grad/i, text: "Temperatur in °C" },
  strom: { re: /ct|cent|uhr/i, text: "Preis oder Uhrzeit" },
  pollen: { re: /pollen|belastung|keine|gering|mittel|hoch/i, text: "Pollen-Belastung" },
  pegel: { re: /\d+\s?cm|pegel/i, text: "Wasserstand in cm" },
  verkehr: { re: /\bA\s?\d+|stau|baustelle|sperrung|frei|meldung/i, text: "Autobahn-Meldung" },
  feiertage: { re: /\d{1,2}\.\s?\d{1,2}\.|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|feiertag|ferien/i, text: "Datum oder Feiertag" },
  nachrichten: { punkte: 2, text: "mindestens 2 Meldungen" },
  recherche: { laenge: 120, text: "mindestens 120 Zeichen Inhalt" },
  uebersetzer: { anders: true, text: "Übersetzung unterscheidet sich vom Original" },
  koch: { laenge: 30, text: "ein Vorschlag" },
  erdbeben: { re: /M\s?\d|stärke|beben/i, text: "Stärke der Beben" },
  weltraum: { laenge: 30, text: "Weltraum-Meldung" },
  krypto: { re: /\d[\d.,]*\s?(€|euro)/i, text: "Kurs in Euro" },
  weltdaten: { re: /\d+\s?(km|kilometer)/i, text: "Höhe/Entfernung in km" },
  system: { re: /dienste|grünen bereich|laufen/i, punkte: 1, text: "Dienste-Status" },
  lage: { punkte: 1, text: "mindestens ein Land" },
};
const PLATZHALTER = /\b(undefined|null|NaN)\b|\[object |\{\{|\$\{/;

/**
 * Prüft einen Bericht. Ergebnis: bestanden | fehler (mit Gründen). Ein gescheiterter Abruf ist immer "fehler".
 * @param {string} basis  Grund-Agent (z. B. "wetter")
 * @param {object} b      Bericht aus einsetzen()
 * @param {{muss?:string[], eingabe?:string}} [extra] eigene Prüfregeln
 */
export function pruefeBericht(basis, b, { muss = [], eingabe = "" } = {}) {
  const gruende = [];
  const text = String(b?.text || "");
  const alles = `${b?.titel || ""} ${text} ${(b?.punkte || []).join(" ")}`;
  if (!b || b.ok === false) gruende.push(b?.beschaeftigt ? "Agent war noch beschäftigt" : "Abruf gescheitert");
  else {
    if (text.trim().length < 15) gruende.push("Bericht ist (fast) leer");
    if (PLATZHALTER.test(alles)) gruende.push("Bericht enthält Platzhalter wie undefined/NaN");
    const r = REGELN[basis];
    if (r?.re && !r.re.test(alles)) gruende.push(`Inhalt fehlt: ${r.text}`);
    if (r?.punkte && (b.punkte || []).length < r.punkte) gruende.push(`Zu wenig Einträge: ${r.text}`);
    if (r?.laenge && alles.trim().length < r.laenge) gruende.push(`Zu kurz: ${r.text}`);
    if (r?.anders && eingabe && text.trim().toLowerCase() === String(eingabe).replace(/^[\p{L}]+:\s*/u, "").trim().toLowerCase()) gruende.push("Übersetzung ist identisch mit dem Original");
    for (const w of muss) if (w && !alles.toLowerCase().includes(String(w).toLowerCase())) gruende.push(`Muss „${w}“ enthalten`);
  }
  return { status: gruende.length ? "fehler" : "bestanden", gruende, geprueft: jetzt() };
}

// ---------- 🏢 Kennzahlen + Auto-Pause ----------
function kpiVon(d, id) {
  return (d.kpi[id] ||= { einsaetze: 0, bestanden: 0, fehler: 0, dauer_ms: 0, serie: 0, pausen: 0, pause_bis: null, letzte: [] });
}
export function pausiert(id) {
  const k = lade().kpi[id];
  return k?.pause_bis && new Date(k.pause_bis).getTime() > Date.now() ? k.pause_bis : null;
}
export function pauseAufheben(id) {
  const d = lade();
  const k = d.kpi[id];
  if (!k) return { error: "Agent unbekannt." };
  k.pause_bis = null; k.serie = 0;
  sichere(d);
  eintragen({ bereich: "agent", titel: `Unternehmensleitung: ${id} wieder im Dienst`, quelle: "dashboard" });
  return { ok: true };
}

/** Wird von agenten-einsatz.einsetzen() nach JEDEM Einsatz aufgerufen. */
export function nachEinsatz(kpiId, basis, bericht, { muss = [], eingabe = "", name = kpiId } = {}) {
  const p = pruefeBericht(basis, bericht, { muss, eingabe });
  if (bericht?.beschaeftigt) return p; // zählt nicht
  const d = lade();
  const k = kpiVon(d, kpiId);
  k.name = name;
  k.einsaetze++;
  k.dauer_ms += Number(bericht?.dauer_ms) || 0;
  k.zuletzt = jetzt();
  if (p.status === "bestanden") { k.bestanden++; k.serie = 0; } else { k.fehler++; k.serie++; }
  k.letzte = [{ at: k.zuletzt, status: p.status, grund: p.gruende.join("; ").slice(0, 160), titel: String(bericht?.titel || "").slice(0, 60) }, ...k.letzte].slice(0, 10);
  // eigene Agenten: nach dem ersten bestandenen Einsatz ausgebildet
  const eigen = d.eigene.find((x) => x.id === kpiId);
  if (eigen && p.status === "bestanden" && eigen.status !== "einsatzbereit") { eigen.status = "einsatzbereit"; eigen.ausgebildet = jetzt(); }
  let pause = null;
  if (p.status === "fehler" && k.serie >= SERIE_PAUSE) {
    k.pausen++;
    const min = Math.min(24 * 60, PAUSE_MIN * 2 ** Math.min(5, k.pausen - 1));
    k.pause_bis = new Date(Date.now() + min * 60000).toISOString();
    pause = min;
  }
  sichere(d);
  sende("agent", { agent: kpiId, name, pruefung: p.status, gruende: p.gruende }, { quelle: "kontroll-agent", wichtig: p.status !== "bestanden" });
  if (p.status !== "bestanden") eintragen({ bereich: "agent", titel: `Kontroll-Agent: ${name} nicht bestanden`, details: p.gruende.join("; "), ok: false, quelle: "kontroll-agent" });
  if (pause) {
    const text = `${name} ist ${k.serie}-mal hintereinander gescheitert und macht ${pause >= 60 ? `${Math.round(pause / 60)} Stunde${pause >= 120 ? "n" : ""}` : `${pause} Minuten`} Pause. Letzter Grund: ${p.gruende[0] || "?"}.`;
    eintragen({ bereich: "agent", titel: `Unternehmensleitung: ${name} pausiert`, details: text, ok: false, quelle: "unternehmensleitung" });
    sende("warnung", { titel: `${name} pausiert`, text }, { quelle: "unternehmensleitung", wichtig: true });
  }
  return { ...p, ...(pause ? { pausiert_min: pause } : {}) };
}

/** Überblick der Unternehmensleitung: Kennzahlen je Agent, Sorgenkinder, Empfehlungen. */
export function leitung() {
  const d = lade();
  const zeilen = Object.entries(d.kpi).filter(([id]) => !id.startsWith("_")).map(([id, k]) => ({
    id, name: k.name || id, einsaetze: k.einsaetze, bestanden: k.bestanden, fehler: k.fehler,
    quote: k.einsaetze ? Math.round((k.bestanden / k.einsaetze) * 100) : null,
    tempo_ms: k.einsaetze ? Math.round(k.dauer_ms / k.einsaetze) : null,
    serie: k.serie, pause_bis: k.pause_bis && new Date(k.pause_bis).getTime() > Date.now() ? k.pause_bis : null,
    zuletzt: k.zuletzt || null, letzte: k.letzte,
    eigen: d.eigene.some((x) => x.id === id),
  })).sort((a, b) => b.einsaetze - a.einsaetze);
  const summe = zeilen.reduce((s, z) => ({ e: s.e + z.einsaetze, b: s.b + z.bestanden }), { e: 0, b: 0 });
  const empfehlungen = [];
  for (const z of zeilen) {
    if (z.pause_bis) empfehlungen.push(`${z.name} ist pausiert (zu viele Fehler). Prüfe Internet/Quelle oder hebe die Pause auf.`);
    else if (z.einsaetze >= 4 && z.quote < 60) empfehlungen.push(`${z.name} besteht nur ${z.quote} % der Prüfungen. Eingabe oder Quelle prüfen.`);
  }
  const mitDaten = zeilen.filter((z) => z.einsaetze >= 2);
  return {
    gesamt: { einsaetze: summe.e, bestanden: summe.b, quote: summe.e ? Math.round((summe.b / summe.e) * 100) : null },
    agenten: zeilen,
    bester: mitDaten.filter((z) => z.quote >= 80).sort((a, b) => b.quote - a.quote || a.tempo_ms - b.tempo_ms)[0]?.name || null,
    sorgenkind: mitDaten.filter((z) => z.quote < 80).sort((a, b) => a.quote - b.quote)[0]?.name || null,
    pausiert: zeilen.filter((z) => z.pause_bis).map((z) => z.name),
    empfehlungen,
    regeln: Object.fromEntries(Object.entries(REGELN).map(([k, r]) => [k, r.text])),
  };
}
export function leitungsText() {
  const l = leitung();
  if (!l.gesamt.einsaetze) return "Meine Agenten hatten noch keinen Einsatz. Schick zum Beispiel den Wetter-Agenten los.";
  return `Mein Team hatte ${l.gesamt.einsaetze} Einsätze, ${l.gesamt.quote} Prozent haben die Prüfung des Kontroll-Agenten bestanden.${l.bester ? ` Am zuverlässigsten: ${l.bester}.` : ""}${l.sorgenkind ? ` Sorgenkind: ${l.sorgenkind}.` : ""}${l.pausiert.length ? ` Pausiert: ${l.pausiert.join(", ")}.` : " Niemand ist pausiert."}`;
}

// ---------- 🎓 Agenten-Ausbildung ----------
export function eigeneAgenten() { return lade().eigene; }
export async function ausbilden({ name, basis, eingabe = "", muss = [], beschreibung = "", emoji = "🎓" } = {}) {
  const { EINSAETZE } = await einsatz();
  const n = String(name || "").trim().slice(0, 40);
  if (n.length < 2) return { error: "Wie soll der Agent heißen?" };
  if (!EINSAETZE[basis]) return { error: "Bitte einen Grund-Agenten wählen." };
  if (EINSAETZE[basis].pflicht && !String(eingabe).trim()) return { error: `Der Grund-Agent braucht eine Eingabe (${EINSAETZE[basis].eingabe?.label || "Eingabe"}).` };
  const d = lade();
  if (d.eigene.some((x) => x.name.toLowerCase() === n.toLowerCase())) return { error: "Einen Agenten mit diesem Namen gibt es schon." };
  const a = {
    id: neueId(), name: n, basis, eingabe: String(eingabe).trim().slice(0, 300),
    muss: (Array.isArray(muss) ? muss : String(muss).split(",")).map((x) => String(x).trim()).filter(Boolean).slice(0, 6),
    beschreibung: String(beschreibung).slice(0, 200), emoji: String(emoji || "🎓").slice(0, 4), status: "in_ausbildung", erstellt: jetzt(),
  };
  d.eigene.push(a);
  sichere(d);
  eintragen({ bereich: "agent", titel: `Agenten-Ausbildung: ${a.name} angelegt`, details: `Grund-Agent ${basis}${a.eingabe ? `, Eingabe „${a.eingabe}“` : ""}${a.muss.length ? `, Prüfregel: ${a.muss.join(", ")}` : ""}`, quelle: "dashboard" });
  return a;
}
export function eigenWeg(id) {
  const d = lade();
  const a = d.eigene.find((x) => x.id === id);
  if (!a) return { error: "Agent nicht gefunden." };
  d.eigene = d.eigene.filter((x) => x.id !== id);
  delete d.kpi[id];
  sichere(d);
  return { ok: true };
}
export function eigenFinden(name) {
  const n = String(name || "").toLowerCase().replace(/[-\s]?agent(en|in)?$/, "").trim();
  if (!n) return null;
  return lade().eigene.find((x) => x.id === name || x.name.toLowerCase() === n || x.name.toLowerCase().replace(/[-\s]?agent(en|in)?$/, "").trim() === n) || null;
}
/** Eigenen Agenten losschicken (auch Probelauf). Gibt den Bericht mit Prüfung zurück. */
export async function eigenLos(id, { kanal = "dashboard" } = {}) {
  const a = lade().eigene.find((x) => x.id === id) || eigenFinden(id);
  if (!a) return { ok: false, text: "Diesen Agenten gibt es nicht." };
  const { einsetzen } = await einsatz();
  return einsetzen(a.basis, a.eingabe, { name: a.name, kanal, kpiId: a.id, muss: a.muss });
}

/**
 * Einen Agenten per Name oder ID losschicken – Grund-Agent, eigener Agent oder "team".
 * Für Automationen (24/7-Daueraufträge), Missionen und Sprachbefehle.
 */
export async function losschicken(wer, eingabe = "", { kanal = "dashboard" } = {}) {
  const w = String(wer || "").trim();
  const eigen = eigenFinden(w);
  if (eigen) return eigenLos(eigen.id, { kanal });
  const { agentLosschicken } = await import("./agents.js");
  const { AGENTS } = await import("./agents.js");
  const a = AGENTS.find((x) => x.id === w.toLowerCase() || x.name.toLowerCase() === w.toLowerCase() || x.name.toLowerCase().replace(/-agent$/, "") === w.toLowerCase());
  return agentLosschicken(a?.id || w.toLowerCase(), eingabe, kanal);
}

// ---------- 🗺 Autonome Aufgabenplanung (lokal, ohne Claude) ----------
const PLAN = [
  { re: /wetter|regen|sonne|temperatur|draußen|ausflug|grill|wander|radtour|garten/i, id: "wetter", text: "Wetter für die nächsten Tage prüfen" },
  { re: /pollen|allerg|heuschnupfen/i, id: "pollen", text: "Pollenflug prüfen" },
  { re: /strom|wasch|trockner|laden|e-?auto|wallbox|spülmaschine/i, id: "strom", text: "Günstigste Strom-Stunden finden" },
  { re: /autobahn|\bA\s?\d{1,3}\b|stau|fahrt|fahren|anreise|urlaub|reise/i, id: "verkehr", text: "Verkehrslage auf der Autobahn prüfen", eingabe: (z) => (z.match(/\bA\s?\d{1,3}\b/i)?.[0] || "").replace(/\s/g, "") },
  { re: /feiertag|ferien|brückentag|urlaub planen|freie tage/i, id: "feiertage", text: "Feiertage und Ferien nachsehen" },
  { re: /nachrichten|news|was ist los|schlagzeilen/i, id: "nachrichten", text: "Aktuelle Top-Meldungen holen" },
  { re: /kochen|essen|rezept|abendessen|mittagessen/i, id: "koch", text: "Koch-Idee aus dem Kühlschrank finden" },
  { re: /hochwasser|pegel|fluss|rhein|elbe|donau|boot|kanu/i, id: "pegel", text: "Wasserstände prüfen" },
  { re: /bitcoin|krypto|ethereum/i, id: "krypto", text: "Krypto-Kurse holen (nur ansehen)" },
  { re: /erdbeben/i, id: "erdbeben", text: "Erdbeben prüfen" },
  { re: /iss\b|raumstation/i, id: "weltdaten", text: "ISS orten" },
  { re: /weltlage|krisen|lagebild/i, id: "lage", text: "Weltlage holen" },
  { re: /system|server|friday läuft|prüf(e)? dich/i, id: "system", text: "System-Check machen" },
];
const RECHERCHE = /(?:über|zu|zum|zur|recherchier\w*|informier\w*(?: mich)? über|infos? (?:zu|über))\s+([\p{L}\d][\p{L}\d -]{2,40})/iu;

/** Zerlegt einen Auftrag lokal in Agenten-Schritte. Schritte mit "einsatz" laufen ohne Claude. */
export function lokalerPlan(ziel = "") {
  const z = String(ziel);
  const schritte = [];
  for (const p of PLAN) if (p.re.test(z) && !schritte.some((s) => s.einsatz === p.id)) schritte.push({ text: p.text, einsatz: p.id, eingabe: p.eingabe ? p.eingabe(z) : "" });
  const r = z.match(RECHERCHE);
  if (r && !/^(dem|der|den|das|die|morgen|heute)$/i.test(r[1].trim())) schritte.push({ text: `Hintergrund zu „${r[1].trim()}“ recherchieren`, einsatz: "recherche", eingabe: r[1].trim() });
  for (const e of lade().eigene) if (e.status === "einsatzbereit" && z.toLowerCase().includes(e.name.toLowerCase())) schritte.push({ text: `${e.name} losschicken`, einsatz: `eigen:${e.id}` });
  const verkehrOhneStrasse = schritte.find((s) => s.einsatz === "verkehr" && !s.eingabe);
  if (verkehrOhneStrasse) schritte.splice(schritte.indexOf(verkehrOhneStrasse), 1);
  if (!schritte.length) return { schritte: [], lokal: false };
  schritte.splice(6);
  schritte.push({ text: "Ergebnisse zusammenfassen", einsatz: "_zusammenfassen" });
  return { schritte, lokal: true, hinweis: `Lokal geplant (ohne Claude): ${schritte.length - 1} Agenten-Schritt${schritte.length === 2 ? "" : "e"}.` };
}

/** Führt einen lokalen Missions-Schritt aus. Rückgabe {ok, text}. */
export async function schrittLokal(s, vorher = []) {
  if (s.einsatz === "_zusammenfassen") {
    const gut = vorher.filter((x) => x.ergebnis && x.status === "fertig");
    if (!gut.length) return { ok: false, text: "Es gibt noch keine Ergebnisse zum Zusammenfassen." };
    return { ok: true, text: gut.map((x) => `• ${x.text}: ${String(x.ergebnis).split("\n")[0].slice(0, 300)}`).join("\n") };
  }
  const b = s.einsatz.startsWith("eigen:") ? await eigenLos(s.einsatz.slice(6), { kanal: "mission" }) : await (await import("./agents.js")).agentLosschicken(s.einsatz, s.eingabe || "", "mission");
  const ok = b.ok !== false && b.pruefung?.status !== "fehler";
  return { ok, text: ok ? `${b.text}${(b.punkte || []).length ? `\n${b.punkte.slice(0, 5).join("\n")}` : ""}` : `${b.text}${b.pruefung?.gruende?.length ? ` (Kontroll-Agent: ${b.pruefung.gruende.join("; ")})` : ""}` };
}

// ---------- Sprachbefehle (ohne Claude) ----------
export async function quickCommand(text) {
  const t = String(text || "").trim().replace(/^(hey |hallo |ok )?friday[ ,.]*/i, "").replace(/[!?.]+$/g, "").trim();
  const k = t.toLowerCase();
  let m;
  if (/^(wie läuft (es bei )?(dein|mein|das) (agenten-?)?team|agenten-?bericht|bericht der unternehmensleitung|unternehmensleitung|wie arbeiten (deine|meine) agenten|zeig( mir)? (die )?(agenten-?)?kennzahlen)$/.test(k)) {
    return { answer: leitungsText(), actions: ["cockpit:agenten"] };
  }
  if ((m = k.match(/^(?:hebe? (?:die )?pause (?:von|für|vom) (.+?) auf|(.+?) (?:soll )?wieder arbeiten)$/))) {
    const wer = (m[1] || m[2]).replace(/^(den|die|das)\s+/, "").replace(/[-\s]?agent(en|in)?$/, "");
    const l = leitung().agenten.find((z) => z.name.toLowerCase().replace(/[-\s]?agent(en|in)?$/, "") === wer || z.id === wer);
    if (!l) return null;
    pauseAufheben(l.id);
    return { answer: `${l.name} ist wieder im Dienst.`, actions: ["cockpit:agenten"] };
  }
  // 24/7: "schick den Wetter-Agenten jeden Tag um 7 Uhr los", "… jede Stunde los", "… alle 30 Minuten los"
  if ((m = t.match(/^(?:schick|sende|starte?)(?: mal)? (?:den |die |das |meinen |meine )?(.{2,40}?)(?:[-\s]?agent(?:en|in)?)? (jeden (?:tag|morgen|abend)|täglich|jede stunde|stündlich|alle (\d{1,4}) (?:minuten|min|stunden))(?: um (\d{1,2})(?:[:.](\d{2}))?(?: uhr)?)? los$/i))) {
    const wer = m[1].replace(/^(den|die|das)\s+/i, "");
    const { AGENTS } = await import("./agents.js");
    const { EINSAETZE } = await einsatz();
    const eigen = eigenFinden(wer);
    const a = AGENTS.find((x) => EINSAETZE[x.id] && (x.id === wer.toLowerCase() || x.name.toLowerCase().replace(/-agent$/, "") === wer.toLowerCase()));
    if (!eigen && !a && !/^team$/i.test(wer)) return { answer: `Einen Agenten „${wer}“ kenne ich nicht.`, actions: [] };
    const takt = m[2].toLowerCase();
    let ausloeser;
    if (/tag|morgen|abend|täglich/.test(takt)) {
      const h = m[4] != null ? Number(m[4]) : /abend/.test(takt) ? 18 : 7;
      ausloeser = { art: "taeglich", zeit: `${String(Math.min(23, h)).padStart(2, "0")}:${String(Math.min(59, Number(m[5] || 0))).padStart(2, "0")}` };
    } else {
      const n = m[3] ? Number(m[3]) * (/stunden/.test(takt) ? 60 : 1) : 60;
      ausloeser = { art: "intervall", minuten: Math.max(15, n) };
    }
    const name = eigen?.name || a?.name || "Team";
    const auto = await import("./automationen.js");
    const r = auto.speichereRegel({ name: `${name} 24/7`, ausloeser, aktion: { art: "agent", text: eigen?.id || a?.id || "team", melden: "fehler" } });
    if (r.error) return { answer: r.error, actions: [] };
    return { answer: `Dauerauftrag steht: ${name} ${ausloeser.art === "taeglich" ? `jeden Tag um ${ausloeser.zeit} Uhr` : `alle ${ausloeser.minuten} Minuten`}. Wenn der Kontroll-Agent etwas beanstandet, melde ich mich.`, actions: ["cockpit:missionen"] };
  }
  // Lokale Aufgabenplanung: "plane lokal: Ausflug am Wochenende", "Agenten, kümmert euch um …"
  if ((m = t.match(/^(?:plane? lokal|plan ohne claude|agenten,? kümmert euch um|lass (?:das|die) agenten(?:-?team)? (?:planen|erledigen))[: ]+(.{4,})$/i))) {
    const lp = lokalerPlan(m[1]);
    if (!lp.lokal) return { answer: "Dafür finde ich keinen passenden Agenten. Das müsste Claude planen.", actions: [] };
    const mi = await import("./missionen.js");
    const r = await mi.neu({ ziel: m[1], titel: m[1].slice(0, 80), schritte: lp.schritte });
    return { answer: r.error || `Lokal geplant, ohne Claude: ${lp.schritte.slice(0, -1).map((x) => x.text).join(", ")}. Die Agenten legen los.`, actions: ["cockpit:missionen"] };
  }
  if ((m = t.match(/^(?:schick|sende|starte?)(?: mal)? (?:den |die |das |meinen |meine )?(.{2,40}?)(?:[-\s]?agent(?:en|in)?)? los$/i))) {
    const e = eigenFinden(m[1]);
    if (!e) {
      // Grund-Agent mit Einsatz ("schick den Wetter-Agenten los") – nur, wenn wirklich "Agent" gesagt wurde.
      if (!/agent/i.test(t)) return null;
      const { AGENTS, agentLosschicken } = await import("./agents.js");
      const { EINSAETZE } = await einsatz();
      const wer = m[1].toLowerCase().replace(/^(den|die|das)\s+/, "");
      const a = AGENTS.find((x) => EINSAETZE[x.id] && (x.id === wer || x.name.toLowerCase().replace(/[-\s]?agent$/, "") === wer));
      if (!a || EINSAETZE[a.id].pflicht) return null;
      const b = await agentLosschicken(a.id, "", "sprache");
      return { answer: `${b.text}${b.pruefung?.status === "fehler" && b.ok !== false ? ` Achtung, der Kontroll-Agent hat das nicht abgenommen: ${b.pruefung.gruende.join("; ")}.` : ""}`, actions: [`buero:${a.id}`] };
    }
    const b = await eigenLos(e.id, { kanal: "sprache" });
    return { answer: b.ok === false ? b.text : `${e.name}: ${b.text}${b.pruefung?.status === "fehler" ? ` Achtung, der Kontroll-Agent hat das nicht abgenommen: ${b.pruefung.gruende.join("; ")}.` : ""}`, actions: ["cockpit:agenten"] };
  }
  return null;
}

export function agentenleitungRouten(app, asyncRoute) {
  const ok = (res, r) => (r && r.error ? res.status(400).json(r) : res.json(r));
  app.get("/api/agentenleitung", asyncRoute(async (req, res) => {
    const { EINSAETZE, einsatzLaeuft } = await einsatz();
    const { AGENTS } = await import("./agents.js");
    const auto = await import("./automationen.js");
    res.json({
      ...leitung(),
      eigene: eigeneAgenten(),
      grundagenten: Object.entries(EINSAETZE).map(([id, e]) => ({ id, name: AGENTS.find((a) => a.id === id)?.name || id, emoji: AGENTS.find((a) => a.id === id)?.emoji || "🤖", knopf: e.knopf, eingabe: e.eingabe || null, pflicht: Boolean(e.pflicht), regel: REGELN[id]?.text || "" })),
      laufend: [...einsatzLaeuft().entries()].map(([id, x]) => ({ id, seit: new Date(x.seit).toISOString(), text: x.text })),
      dauerauftraege: auto.liste().regeln.filter((r) => r.aktion.art === "agent"),
    });
  }));
  app.post("/api/agentenleitung/eigene", asyncRoute(async (req, res) => ok(res, await ausbilden(req.body || {}))));
  app.delete("/api/agentenleitung/eigene/:id", (req, res) => ok(res, eigenWeg(req.params.id)));
  app.post("/api/agentenleitung/eigene/:id/los", asyncRoute(async (req, res) => res.json(await eigenLos(req.params.id))));
  app.post("/api/agentenleitung/pause/:id/aufheben", (req, res) => ok(res, pauseAufheben(req.params.id)));
  app.post("/api/agentenleitung/plan", (req, res) => res.json(lokalerPlan(String(req.body?.ziel || ""))));
}
