// Mission Control + Aufgaben-Warteschlange.
// Eine Mission ist ein größerer Auftrag, den Friday in Schritte zerlegt und nacheinander abarbeitet.
// - Warteschlange: wartende Missionen laufen nach Priorität (hoch → mittel → niedrig), dann nach Alter.
// - Fortschrittsüberwachung: ein Schritt, der zu lange läuft, wird als "hängt" markiert.
// - Rückfallstrategie: scheitert ein Schritt, versucht Friday einmal einen anderen Weg, dann stoppt sie und sagt Bescheid.
// - Wissensübergabe: jeder Schritt bekommt die Ergebnisse der vorigen Schritte mit (auch zwischen Agenten).
// - Versionen: jede Änderung an einer Mission wird mit Zeit festgehalten (Projektverlauf).
// Gespeichert in server/data/missionen.json.
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";
import { notfallAktiv, stand as kommandoStand, darf } from "./kommando.js";
import { denke, jsonAus } from "./denker.js";
import { AGENTS } from "./agents.js";
import { notifyAll } from "./notify.js";

const NAME = "missionen";
const MAX = 150;
const SCHRITT_ZEITLIMIT = 4 * 60 * 1000; // länger = "hängt"
const STOCKT_NACH = 24 * 3600 * 1000;
export const PRIO = { 1: "hoch", 2: "mittel", 3: "niedrig" };
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const jetzt = () => new Date().toISOString();

let askFn = null; // wird beim Start gesetzt (verhindert Kreis-Import mit brain.js)
let busy = null;  // id der Mission, an der gerade gearbeitet wird

function alle() { return store.load(NAME, []); }
function speichern(liste) { store.save(NAME, liste.slice(-MAX)); }
function finde(liste, id) { return liste.find((m) => m.id === id); }
function version(m, was) {
  m.versionen = [...(m.versionen || []), { at: jetzt(), was: String(was).slice(0, 200) }].slice(-60);
  m.geaendert = jetzt();
}

// ---- Prioritäten-Erkennung (ohne Claude) ----
const DRINGEND = /\b(dringend|sofort|heute|asap|notfall|frist|deadline|mahnung|rechnung|steuer|arzt|krank|kaputt|ausfall|wichtig|kritisch|bis morgen|morgen früh)\b/i;
const NIEDRIG = /\b(irgendwann|mal|vielleicht|idee|später|wenn zeit|nice to have|optional)\b/i;
/** Schätzt die Priorität eines Textes: 1 hoch, 2 mittel, 3 niedrig – mit Begründung. */
export function erkennePrioritaet(text = "") {
  const t = String(text || "");
  const hoch = t.match(DRINGEND);
  if (hoch) return { prio: 1, grund: `enthält „${hoch[0]}“` };
  const datum = t.match(/\b(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?\b/);
  if (datum) {
    const j = datum[3] ? Number(datum[3].length === 2 ? `20${datum[3]}` : datum[3]) : new Date().getFullYear();
    const d = new Date(j, Number(datum[2]) - 1, Number(datum[1]));
    const tage = (d - Date.now()) / 86400000;
    if (tage <= 3 && tage > -30) return { prio: 1, grund: `Termin ${datum[0]} ist nah` };
    if (tage <= 14) return { prio: 2, grund: `Termin ${datum[0]} in ${Math.ceil(tage)} Tagen` };
  }
  const n = t.match(NIEDRIG);
  if (n) return { prio: 3, grund: `klingt nach „${n[0]}“` };
  return { prio: 2, grund: "nichts Dringendes erkannt" };
}

// ---- Planen (Ziel → Schritte) ----
/**
 * Zerlegt ein Ziel in konkrete Schritte. Mit Claude, sonst einfache Ersatz-Planung.
 * @returns {Promise<{schritte:{text:string, agent?:string, frist?:string}[], mitClaude:boolean, hinweis?:string}>}
 */
export async function planeSchritte(ziel, { art = "mission", kontext = "" } = {}) {
  const agenten = AGENTS.map((a) => `${a.id}: ${a.name}`).join(", ");
  const system = art === "ziel"
    ? "Du bist Fridays Ziel-Navigator. Übersetze ein langfristiges Ziel in 4 bis 8 konkrete, machbare Schritte mit sinnvoller Reihenfolge. Jeder Schritt beginnt mit einem Verb und ist in einer Woche oder weniger schaffbar. Antworte NUR mit JSON: {\"schritte\":[{\"text\":\"…\",\"frist\":\"in 1 Woche\"}],\"hinweis\":\"ein Satz, worauf es ankommt\"}"
    : `Du bist Fridays Mission Control. Zerlege den Auftrag in 2 bis 6 Schritte, die eine KI mit Werkzeugen (Websuche, Dokumente erstellen, Erinnerungen, Aufgaben, Mac, Smart Home …) nacheinander erledigen kann. Der letzte Schritt fasst das Ergebnis in einem Dokument zusammen. Ordne jedem Schritt den passenden Agenten zu (${agenten}). Antworte NUR mit JSON: {"schritte":[{"text":"…","agent":"<id>"}],"hinweis":"ein Satz"}`;
  const r = await denke({ system, text: `${art === "ziel" ? "Ziel" : "Auftrag"}: ${ziel}${kontext ? `\n\nWas Friday über Boss weiß:\n${kontext}` : ""}`, stufe: "mittel", maxTokens: 2000, quelle: art === "ziel" ? "ziele" : "missionen" });
  const j = r.ok ? jsonAus(r.text) : null;
  const schritte = Array.isArray(j?.schritte) ? j.schritte : Array.isArray(j) ? j : null;
  if (schritte?.length) {
    return {
      mitClaude: true,
      hinweis: typeof j?.hinweis === "string" ? j.hinweis.slice(0, 300) : "",
      schritte: schritte.slice(0, 10).map((s) => ({
        text: String(s?.text || s || "").slice(0, 400),
        ...(s?.agent && AGENTS.some((a) => a.id === s.agent) ? { agent: s.agent } : {}),
        ...(s?.frist ? { frist: String(s.frist).slice(0, 40) } : {}),
      })).filter((s) => s.text),
    };
  }
  // Ohne Claude (v1.180.0): zuerst die lokale Aufgabenplanung – Agenten-Schritte, die ohne Claude laufen.
  if (art !== "ziel") {
    try {
      const { lokalerPlan } = await import("./agentenleitung.js");
      const lp = lokalerPlan(ziel);
      if (lp.lokal) return { mitClaude: false, lokal: true, hinweis: `${r.leer ? "Ohne Guthaben" : "Claude war nicht erreichbar"} – ${lp.hinweis}`, schritte: lp.schritte };
    } catch { /* weiter mit dem Standard-Plan */ }
  }
  // Ohne Claude: einfacher Plan, den Boss selbst anpassen kann.
  const ersatz = art === "ziel"
    ? ["Ziel genau aufschreiben: Woran merke ich, dass ich es geschafft habe?", "Informationen sammeln, was dafür nötig ist", "Ersten kleinen Schritt für diese Woche festlegen und erledigen", "Nach einer Woche prüfen: Was lief gut, was nicht?", "Nächste Schritte planen"]
    : [`Informationen sammeln zu: ${ziel}`, `Ergebnis zu „${ziel}“ als Dokument zusammenfassen`];
  return { mitClaude: false, hinweis: r.leer ? "Ohne Guthaben habe ich einen einfachen Standard-Plan erstellt." : "Claude war nicht erreichbar – das ist ein einfacher Standard-Plan.", schritte: ersatz.map((text) => ({ text })) };
}

// ---- Missionen verwalten ----
export function liste() {
  const l = alle();
  pruefeFortschritt(l);
  const reihenfolge = warteschlange(l).map((m) => m.id);
  return {
    missionen: l.slice().reverse(),
    warteschlange: reihenfolge,
    aktiv: busy,
    notfall: notfallAktiv(),
    autonomie: kommandoStand().autonomie,
    prio: PRIO,
    agenten: AGENTS.map((a) => ({ id: a.id, name: a.name })),
  };
}

function warteschlange(l) {
  return l.filter((m) => m.status === "wartet" || m.status === "laeuft")
    .sort((a, b) => (a.status === "laeuft" ? -1 : 0) - (b.status === "laeuft" ? -1 : 0) || a.prioritaet - b.prioritaet || a.erstellt.localeCompare(b.erstellt));
}

export async function neu({ titel, ziel, prioritaet, schritte, starten = true, planen = true, lokal = false }) {
  const z = String(ziel || titel || "").trim().slice(0, 2000);
  if (!z) return { error: "Was soll Friday erledigen?" };
  const p = Number(prioritaet) || erkennePrioritaet(z).prio;
  let plan = { schritte: [], mitClaude: false };
  if (Array.isArray(schritte) && schritte.length) plan.schritte = schritte.map((s) => ({ text: String(s?.text || s).slice(0, 400), ...(s?.agent ? { agent: String(s.agent) } : {}), ...(s?.einsatz ? { einsatz: String(s.einsatz).slice(0, 40), eingabe: String(s.eingabe || "").slice(0, 300) } : {}) })).filter((s) => s.text);
  else if (planen && lokal) {
    // Lokale Aufgabenplanung zuerst (kostet nichts); nur wenn sie nichts findet, plant Claude.
    const { lokalerPlan } = await import("./agentenleitung.js");
    const lp = lokalerPlan(z);
    plan = lp.lokal ? { mitClaude: false, hinweis: lp.hinweis, schritte: lp.schritte } : await planeSchritte(z, {});
  } else if (planen) {
    const kontext = darf("missionen", "gedaechtnis") ? store.getMemories().slice(-20).map((m) => `- ${m.text}`).join("\n") : "";
    plan = await planeSchritte(z, { kontext });
  } else plan.schritte = [{ text: z }];
  const m = {
    id: neueId(),
    titel: String(titel || z).slice(0, 100),
    ziel: z,
    prioritaet: [1, 2, 3].includes(p) ? p : 2,
    status: starten ? "wartet" : "geplant",
    schritte: plan.schritte.map((s) => ({ id: neueId(), ...s, status: "offen", versuche: 0 })),
    hinweis: plan.hinweis || "",
    erstellt: jetzt(),
    geaendert: jetzt(),
    versionen: [],
  };
  version(m, `Mission angelegt (${m.schritte.length} Schritte${plan.mitClaude ? ", von Claude geplant" : m.schritte.some((x) => x.einsatz) ? ", lokal geplant" : ""})`);
  const l = alle();
  l.push(m);
  speichern(l);
  eintragen({ bereich: "aufgabe", titel: `Mission angelegt: ${m.titel}`, details: m.schritte.map((s, i) => `${i + 1}. ${s.text}`).join(" · "), quelle: "dashboard" });
  setTimeout(() => tick().catch(() => {}), 500);
  return { ok: true, mission: m };
}

export function aendern(id, patch = {}) {
  const l = alle();
  const m = finde(l, id);
  if (!m) return { error: "Mission nicht gefunden." };
  if (typeof patch.titel === "string" && patch.titel.trim()) { m.titel = patch.titel.trim().slice(0, 100); version(m, "Titel geändert"); }
  if ([1, 2, 3].includes(Number(patch.prioritaet)) && Number(patch.prioritaet) !== m.prioritaet) { m.prioritaet = Number(patch.prioritaet); version(m, `Priorität: ${PRIO[m.prioritaet]}`); }
  if (Array.isArray(patch.schritte)) {
    const alt = new Map(m.schritte.map((s) => [s.id, s]));
    m.schritte = patch.schritte.map((s) => {
      const vorher = s?.id && alt.get(s.id);
      const text = String(s?.text || "").slice(0, 400).trim();
      if (!text) return null;
      return vorher ? { ...vorher, text, ...(s.agent !== undefined ? { agent: s.agent || undefined } : {}) } : { id: neueId(), text, ...(s.agent ? { agent: s.agent } : {}), status: "offen", versuche: 0 };
    }).filter(Boolean);
    version(m, "Schritte bearbeitet");
  }
  if (typeof patch.notiz === "string") { m.notizen = [...(m.notizen || []), { at: jetzt(), text: patch.notiz.slice(0, 1000) }].slice(-50); version(m, "Notiz hinzugefügt"); }
  if (typeof patch.entscheidung === "string" && patch.entscheidung.trim()) { m.entscheidungen = [...(m.entscheidungen || []), { at: jetzt(), text: patch.entscheidung.slice(0, 600) }].slice(-50); version(m, `Entscheidung: ${patch.entscheidung.slice(0, 80)}`); }
  speichern(l);
  return { ok: true, mission: m };
}

/** Steuerung: start | pause | weiter | stopp | neu (von vorn) | schritt (nur nächsten Schritt) | ueberspringen | loeschen */
export async function steuern(id, aktion) {
  const l = alle();
  const m = finde(l, id);
  if (!m) return { error: "Mission nicht gefunden." };
  switch (aktion) {
    case "start": case "weiter":
      if (notfallAktiv()) return { error: "Der Notfallmodus ist an. Beende ihn zuerst." };
      m.status = "wartet"; m.problem = ""; version(m, aktion === "start" ? "Gestartet" : "Fortgesetzt");
      for (const s of m.schritte) if (s.status === "fehler" || s.status === "haengt" || s.status === "wartet_freigabe") { s.status = "offen"; s.versuche = 0; }
      break;
    case "pause": m.status = "pausiert"; version(m, "Pausiert"); break;
    case "stopp": m.status = "gestoppt"; version(m, "Gestoppt"); break;
    case "neu":
      for (const s of m.schritte) { s.status = "offen"; s.versuche = 0; delete s.ergebnis; }
      m.status = "wartet"; m.problem = ""; version(m, "Von vorn gestartet"); break;
    case "ueberspringen": {
      const s = m.schritte.find((x) => x.status !== "fertig" && x.status !== "uebersprungen");
      if (s) { s.status = "uebersprungen"; version(m, `Schritt übersprungen: ${s.text.slice(0, 60)}`); }
      if (m.status === "fehler") m.status = "pausiert";
      break;
    }
    case "loeschen":
      if (busy === id) return { error: "Daran arbeitet Friday gerade. Erst pausieren." };
      speichern(l.filter((x) => x.id !== id));
      eintragen({ bereich: "aufgabe", titel: `Mission gelöscht: ${m.titel}`, quelle: "dashboard" });
      return { ok: true };
    case "schritt":
      speichern(l);
      return schrittAusfuehren(id, { vonHand: true });
    default: return { error: "Unbekannte Aktion." };
  }
  speichern(l);
  if (aktion !== "pause" && aktion !== "stopp") setTimeout(() => tick().catch(() => {}), 300);
  return { ok: true, mission: m };
}

// ---- Fortschrittsüberwachung ----
function pruefeFortschritt(l) {
  let geaendert = false;
  const t = Date.now();
  for (const m of l) {
    for (const s of m.schritte) {
      if (s.status === "laeuft" && s.gestartet && t - new Date(s.gestartet).getTime() > SCHRITT_ZEITLIMIT && busy !== m.id) {
        s.status = "haengt"; m.status = "fehler"; m.problem = `Schritt „${s.text.slice(0, 60)}“ kam nicht voran (länger als 4 Minuten).`; version(m, "Fortschrittswächter: Schritt hängt"); geaendert = true;
      }
    }
    if (m.status === "wartet" && t - new Date(m.geaendert).getTime() > STOCKT_NACH && !m.stocktGemeldet) { m.stockt = true; m.stocktGemeldet = true; geaendert = true; }
  }
  if (geaendert) speichern(l);
}

// ---- Abarbeiten ----
function prompt(m, s, idx, rueckfall) {
  const vorher = m.schritte.slice(0, idx).filter((x) => x.ergebnis).map((x, i) => `${i + 1}. ${x.text}\n   Ergebnis: ${x.ergebnis.slice(0, 700)}`).join("\n");
  const agent = s.agent ? AGENTS.find((a) => a.id === s.agent) : null;
  return `[Mission Control – automatischer Auftrag, nicht live mit Boss]
Mission: ${m.titel}
Ziel: ${m.ziel}
${vorher ? `Übergabe – was die vorigen Schritte ergeben haben:\n${vorher}\n` : ""}${agent ? `Du arbeitest jetzt als Agent „${agent.name}“.\n` : ""}Jetzt Schritt ${idx + 1} von ${m.schritte.length}: ${s.text}
${rueckfall ? `\nRÜCKFALLSTRATEGIE: Der erste Versuch hat nicht geklappt (${rueckfall}). Nimm einen anderen Lösungsweg (andere Quelle, anderes Werkzeug oder kleinerer Teilschritt).\n` : ""}
Erledige genau diesen Schritt jetzt mit deinen Werkzeugen. Antworte danach mit dem Ergebnis in höchstens acht Sätzen (keine Ankündigungen). Wenn der Schritt nicht machbar ist, beginne deine Antwort mit "GEHT NICHT:" und nenne den Grund. Wenn Informationen fehlen, beginne mit "FEHLT:".`;
}

async function schrittAusfuehren(id, { vonHand = false } = {}) {
  if (!askFn) return { error: "Friday startet noch." };
  if (notfallAktiv()) return { error: "Notfallmodus ist an." };
  if (busy) return { error: "Friday arbeitet schon an einer Mission." };
  let l = alle();
  let m = finde(l, id);
  if (!m) return { error: "Mission nicht gefunden." };
  const idx = m.schritte.findIndex((s) => s.status === "offen" || s.status === "laeuft");
  if (idx < 0) { abschliessen(l, m); return { ok: true, mission: m }; }
  busy = id;
  const s = m.schritte[idx];
  s.status = "laeuft"; s.gestartet = jetzt(); s.versuche = (s.versuche || 0) + 1;
  if (m.status !== "laeuft") { m.status = "laeuft"; }
  const rueckfall = s.versuche > 1 ? s.letzterFehler || "unbekannter Fehler" : "";
  version(m, `Schritt ${idx + 1} gestartet${rueckfall ? " (Rückfallstrategie)" : ""}`);
  speichern(l);
  const offenVorher = new Set(kommandoStand().offen.map((g) => g.id));
  let res;
  try {
    if (s.einsatz) {
      // Lokaler Agenten-Schritt (v1.180.0): läuft ohne Claude, der Kontroll-Agent prüft das Ergebnis.
      const { schrittLokal } = await import("./agentenleitung.js");
      const r = await schrittLokal(s, m.schritte.slice(0, idx));
      res = { answer: r.ok ? r.text : `GEHT NICHT: ${r.text}`, fehler: !r.ok };
    } else res = await askFn({ text: prompt(m, s, idx, rueckfall), channel: "mission", keepHistory: false });
  } catch (err) {
    res = { answer: `GEHT NICHT: ${err.message}`, fehler: true };
  } finally {
    busy = null;
  }
  l = alle(); m = finde(l, id);
  if (!m) return { error: "Mission wurde gelöscht." };
  const s2 = m.schritte.find((x) => x.id === s.id);
  if (!s2) { speichern(l); return { ok: true, mission: m }; }
  const antwort = String(res?.answer || "").trim();
  const neueFreigaben = kommandoStand().offen.filter((g) => !offenVorher.has(g.id) && g.kanal === "mission");
  if (neueFreigaben.length) {
    s2.status = "wartet_freigabe"; s2.ergebnis = antwort; m.status = "pausiert"; s2.freigaben = neueFreigaben.map((g) => g.id);
    m.problem = `Wartet auf deine Freigabe: ${neueFreigaben.map((g) => g.titel).join(", ")}. Danach „Weiter“ drücken.`;
    version(m, "Wartet auf Freigabe");
    speichern(l);
    notifyAll("Mission wartet auf dich", `${m.titel}: ${m.problem}`, { art: "mission" }).catch(() => {});
    return { ok: true, mission: m };
  }
  const gescheitert = res?.fehler || /^(GEHT NICHT|FEHLT)\s*:/i.test(antwort);
  if (gescheitert) {
    s2.letzterFehler = antwort.replace(/^(GEHT NICHT|FEHLT)\s*:\s*/i, "").slice(0, 300);
    if (s2.versuche < 2 && !/^FEHLT/i.test(antwort)) {
      s2.status = "offen"; // Rückfallstrategie beim nächsten Durchlauf
      m.status = vonHand ? "pausiert" : "wartet";
      version(m, `Schritt ${idx + 1} gescheitert – Rückfallstrategie folgt`);
    } else {
      s2.status = "fehler"; s2.ergebnis = antwort; m.status = "fehler";
      m.problem = /^FEHLT/i.test(antwort) ? `Friday braucht Infos von dir: ${s2.letzterFehler}` : `Schritt ${idx + 1} ging auch auf anderem Weg nicht: ${s2.letzterFehler}`;
      version(m, `Gestoppt bei Schritt ${idx + 1}`);
      notifyAll("Mission braucht dich", `${m.titel}: ${m.problem}`, { art: "mission" }).catch(() => {});
    }
    speichern(l);
    eintragen({ bereich: "aufgabe", titel: `Mission „${m.titel}“: Schritt ${idx + 1} hat nicht geklappt`, details: antwort, ok: false, kanal: "mission" });
    return { ok: true, mission: m };
  }
  s2.status = "fertig"; s2.ergebnis = antwort.slice(0, 4000); s2.fertig = jetzt();
  version(m, `Schritt ${idx + 1} fertig`);
  if (!m.schritte.some((x) => x.status === "offen")) abschliessen(l, m);
  else m.status = vonHand ? "pausiert" : "wartet";
  speichern(l);
  return { ok: true, mission: m };
}

/** Nach deiner Entscheidung im Genehmigungsmanager: Mission mit dem Ergebnis weitermachen lassen. */
export function nachFreigabe(g, ja, ergebnis) {
  const l = alle();
  for (const m of l) {
    const s = m.schritte.find((x) => x.status === "wartet_freigabe" && (x.freigaben || []).includes(g.id));
    if (!s) continue;
    s.freigaben = s.freigaben.filter((id) => id !== g.id);
    const kurzErg = (() => { try { return typeof ergebnis === "string" ? ergebnis : JSON.stringify(ergebnis); } catch { return ""; } })().slice(0, 300);
    if (!ja) {
      s.status = "fehler"; m.status = "pausiert"; m.problem = `Du hast „${g.titel}“ abgelehnt. Schritt überspringen oder Mission stoppen.`;
      version(m, `Freigabe abgelehnt: ${g.titel}`);
    } else {
      s.ergebnis = `${s.ergebnis || ""}\nFreigegeben und ausgeführt (${g.titel}): ${ergebnis?.error ? `Fehler – ${ergebnis.error}` : kurzErg}`.trim();
      if (!s.freigaben.length) {
        s.status = ergebnis?.error ? "fehler" : "fertig"; s.fertig = jetzt();
        m.status = ergebnis?.error ? "fehler" : "wartet"; m.problem = ergebnis?.error ? `Die freigegebene Aktion ging nicht: ${ergebnis.error}` : "";
        if (!ergebnis?.error && !m.schritte.some((x) => x.status === "offen")) { speichern(l); abschliessen(l, m); return; }
      }
      version(m, `Freigabe erteilt: ${g.titel}`);
    }
    speichern(l);
    setTimeout(() => tick().catch(() => {}), 500);
    return;
  }
}

function abschliessen(l, m) {
  if (m.status === "fertig") return;
  m.status = "fertig"; m.fertig = jetzt(); m.problem = "";
  version(m, "Mission abgeschlossen");
  speichern(l);
  eintragen({ bereich: "aufgabe", titel: `✅ Mission fertig: ${m.titel}`, details: m.schritte.map((s, i) => `${i + 1}. ${s.text}: ${(s.ergebnis || s.status).slice(0, 120)}`).join(" · "), kanal: "mission" });
  notifyAll("Mission erledigt", `${m.titel} ist fertig, Boss.`, { art: "aufgabe" }).catch(() => {});
}

// Hintergrund: nimmt die wichtigste wartende Mission und macht den nächsten Schritt.
export async function tick() {
  if (busy || !askFn || notfallAktiv()) return;
  if (kommandoStand().autonomie === 0) return; // Stufe 0: nur Schritt für Schritt per Klick
  const l = alle();
  pruefeFortschritt(l);
  const naechste = warteschlange(l)[0];
  if (naechste) await schrittAusfuehren(naechste.id);
}

export function missionenStart(ask) {
  askFn = ask;
  // Nach einem Neustart: Schritte, die mitten drin waren, wieder auf "offen".
  const l = alle();
  let g = false;
  for (const m of l) for (const s of m.schritte) if (s.status === "laeuft") { s.status = "offen"; s.versuche = Math.max(0, (s.versuche || 1) - 1); g = true; if (m.status === "laeuft") m.status = "wartet"; }
  if (g) speichern(l);
  setInterval(() => tick().catch((e) => console.error("Missionen:", e.message)), 20 * 1000);
}

export function zaehler() {
  const l = alle();
  return { aktiv: l.filter((m) => ["wartet", "laeuft"].includes(m.status)).length, probleme: l.filter((m) => m.status === "fehler" || m.stockt).length, fertig: l.filter((m) => m.status === "fertig").length, gesamt: l.length };
}
