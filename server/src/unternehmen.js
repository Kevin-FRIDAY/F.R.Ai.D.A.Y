// Friday als Unternehmen (v1.185.0, Mark XIV).
//
//  🏢 Abteilungen         12 Leitungs-Agenten (CEO, Forschung, Entwicklung, Sicherheit, Finanz, Strategie, Qualität,
//                         Kreativ, Daten, Automation, Krisen, Datenschutz). Jede Leitung schreibt ihren Bericht aus den
//                         Modulen, die es schon gibt (kein Doppel): z. B. Sicherheit = Sicherheits-Zentrale,
//                         Finanz = Konten (nur lesen) + Kosten-Deckel. Die bestehenden Agenten sind den Abteilungen zugeordnet.
//  📌 Pinnwand            Agenten-Kommunikation über den Ereignis-Bus: Ergebnisse, Warnungen und Recherchen landen
//                         als Zettel an der gemeinsamen Pinnwand, jede Abteilung sieht die ihrer Kollegen.
//  🤝 CEO-Verteilung      Ein Auftrag wird lokal in Schritte zerlegt. Für jeden Schritt „bieten“ die passenden Agenten
//                         (Passung, Erfolgsquote laut Kontroll-Agent, frei/pausiert, Tempo). Die CEO-Agentin nimmt das
//                         beste Angebot. Im Schattenmodus wird nur aufgeschrieben.
//  📁 Projektmanager      Projekte (aus dem Projektgedächtnis) bekommen Meilensteine und Aufgaben mit Frist,
//                         Wichtigkeit und Aufwand, Fortschritt in %, Berichte. Autopilot: Agenten bereiten offene
//                         Aufgaben vor (nur lesende Agenten, Ergebnis wird angehängt, abhaken tust du).
//  🛠 Automations-Designer Satz → fertiger Automations-Vorschlag, erst nach deinem OK gespeichert.
// Alles ohne Claude, ohne Kosten.
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";
import { hoere } from "./ereignisbus.js";
import * as schatten from "./schatten.js";

const sicher = async (fn) => { try { return await fn(); } catch { return null; } };
const neueId = () => Math.random().toString(36).slice(2, 10);
const kurz = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const STUFE = (gut, warn) => (gut ? "gut" : warn ? "hinweis" : "problem");

// ---------- 🏢 Abteilungen ----------
export const ABTEILUNGEN = [
  { id: "ceo", name: "Geschäftsleitung", emoji: "👑", leitung: "CEO-Agentin", auftrag: "Verteilt Aufträge, fasst alle Abteilungen zusammen.", agenten: [] },
  { id: "forschung", name: "Forschung", emoji: "🔬", leitung: "Forschungs-Agent", auftrag: "Recherchen, Wissenslücken, Nachrichten.", agenten: ["recherche", "nachrichten", "uebersetzer", "wissen"] },
  { id: "entwicklung", name: "Entwicklung", emoji: "🛠", leitung: "Entwicklungs-Agent", auftrag: "Neue Fähigkeiten, Updates, Funktionstests.", agenten: ["code", "mac", "dreid"] },
  { id: "sicherheit", name: "Sicherheit", emoji: "🔐", leitung: "Sicherheits-Agent", auftrag: "Schützt Friday: Anmeldungen, Schlüssel, Sicherungen.", agenten: ["system"] },
  { id: "finanz", name: "Finanzen", emoji: "💶", leitung: "Finanz-Agent", auftrag: "Konten und KI-Kosten im Blick (nur lesen, bewegt nie Geld).", agenten: ["krypto", "markt"] },
  { id: "strategie", name: "Strategie", emoji: "🧭", leitung: "Strategie-Agent", auftrag: "Ziele, Entscheidungen, Planung.", agenten: ["kalender", "aufgaben", "mail", "feiertage"] },
  { id: "qualitaet", name: "Qualität", emoji: "✅", leitung: "Qualitäts-Agent", auftrag: "Prüft Agenten-Berichte und Fridays Antworten.", agenten: [] },
  { id: "kreativ", name: "Kreativ", emoji: "🎨", leitung: "Kreativ-Agent", auftrag: "Ideen, Videos, Webseiten, Design.", agenten: ["video", "webseiten", "design", "stimme", "musik", "koch"] },
  { id: "daten", name: "Daten", emoji: "📊", leitung: "Daten-Agent", auftrag: "Fridays Datenbank, Archiv und Muster.", agenten: ["dateien", "weltdaten", "karten"] },
  { id: "automation", name: "Automation", emoji: "⚙️", leitung: "Automations-Agent", auftrag: "Automationen und Smart Home.", agenten: ["smarthome", "licht", "fernseher", "alexa", "strom"] },
  { id: "krisen", name: "Krisenstab", emoji: "🚨", leitung: "Krisen-Agent", auftrag: "Weltlage, Unwetter, Notfallmodus.", agenten: ["lage", "erdbeben", "weltraum", "wetter", "pegel", "verkehr", "pollen"] },
  { id: "datenschutz", name: "Datenschutz", emoji: "🛡", leitung: "Datenschutz-Agent", auftrag: "Was verlässt den Mac? Gästemodus, Datenlecks.", agenten: [] },
];
const abteilungVonAgent = (id) => ABTEILUNGEN.find((a) => a.agenten.includes(id))?.id || "ceo";

/** Bericht je Abteilung – nur aus vorhandenen Daten, schnell und ohne Netz. */
const BERICHTE = {
  async forschung() {
    const S = await sicher(async () => (await import("./selbstlernen.js")).uebersicht());
    const W = await sicher(async () => (await import("./weltintelligenz.js")).recherchen());
    const offen = S?.offen || 0;
    return { stufe: STUFE(offen <= 3, offen <= 8), text: `${W?.length || 0} Recherchen im Archiv, ${offen} offene Wissenslücke${offen === 1 ? "" : "n"}.`, zahl: offen, zahlText: "Lücken" };
  },
  async entwicklung() {
    const ft = await sicher(async () => (await import("./funktionstest.js")).stand());
    const l = ft?.letzte;
    const fehler = l ? (l.ergebnisse || l.liste || []).filter((x) => x.status === "fehler").length : null;
    const version = await sicher(async () => { const fs = await import("node:fs"); const p = await import("node:path"); const u = await import("node:url"); return fs.readFileSync(p.join(p.dirname(u.fileURLToPath(import.meta.url)), "..", "..", "VERSION"), "utf8").trim(); });
    return { stufe: fehler == null ? "hinweis" : STUFE(fehler === 0, fehler <= 2), text: `Version ${version || "?"}. ${fehler == null ? "Noch kein Funktionstest gelaufen." : fehler ? `${fehler} Funktionstest(s) fehlgeschlagen.` : "Alle Funktionstests bestanden."}`, zahl: fehler ?? "–", zahlText: "Testfehler" };
  },
  async sicherheit() {
    const u = await sicher(async () => (await import("./sicherheit.js")).uebersicht());
    if (!u) return { stufe: "hinweis", text: "Sicherheits-Zentrale nicht erreichbar." };
    return { stufe: STUFE(u.punkte >= 80, u.punkte >= 60), text: `Sicherheits-Punktzahl ${u.punkte}/100, ${u.fehl24} falsche Passwörter in 24 Std.`, zahl: u.punkte, zahlText: "Punkte" };
  },
  async finanz() {
    const k = await sicher(async () => (await import("./konten.js")).uebersicht());
    const kd = await sicher(async () => (await import("./kostendeckel.js")).stand());
    const summe = k?.summe && Object.keys(k.summe).length ? Object.entries(k.summe).map(([w, v]) => `${Math.round(v).toLocaleString("de-DE")} ${w}`).join(", ") : null;
    const kosten = kd ? `KI-Kosten heute ${Number(kd.heute || 0).toFixed(2)} $${kd.an && kd.grenze?.tag ? ` von ${kd.grenze.tag} $` : ""}` : "";
    return { stufe: kd?.stufe === "gesperrt" ? "problem" : kd?.stufe === "sparsam" ? "hinweis" : "gut", text: `${summe ? `Kontostand ${summe} (nur gelesen). ` : "Keine Konten verbunden. "}${kosten}.`, zahl: kd ? `${kd.prozent?.tag || 0} %` : "–", zahlText: "vom Kostenlimit" };
  },
  async strategie() {
    const P = await sicher(async () => import("./persoenlich.js"));
    const ziele = P ? P.ziele().filter((z) => P.fortschritt(z) < 100) : [];
    const faellig = P ? P.entscheidungsBilanz().faellig.length : 0;
    return { stufe: STUFE(true), text: `${ziele.length} offene Ziele${ziele[0] ? ` (z. B. „${ziele[0].titel}“ ${P.fortschritt(ziele[0])} %)` : ""}. ${faellig ? `${faellig} Entscheidung(en) warten auf deinen Rückblick.` : ""}`.trim(), zahl: ziele.length, zahlText: "Ziele" };
  },
  async qualitaet() {
    const L = await sicher(async () => (await import("./agentenleitung.js")).leitung());
    const S = await sicher(async () => (await import("./selbstlernen.js")).uebersicht());
    const q = L?.gesamt?.quote, a = S?.qualitaet?.quote;
    return { stufe: q == null && a == null ? "hinweis" : STUFE((q ?? 100) >= 80 && (a ?? 100) >= 80, (q ?? 100) >= 60), text: `Agenten bestehen ${q ?? "–"} % der Prüfungen, Fridays Antworten sind zu ${a ?? "–"} % ohne Mangel.${L?.pausiert?.length ? ` Pausiert: ${L.pausiert.join(", ")}.` : ""}`, zahl: q != null ? `${q} %` : "–", zahlText: "Prüfquote" };
  },
  async kreativ() {
    const ideen = store.load("ideen", []);
    return { stufe: "gut", text: `${ideen.length} Ideen im Ideen-Tresor.`, zahl: ideen.length, zahlText: "Ideen" };
  },
  async daten() {
    const n = (() => { try { return store.leseArchiv().length; } catch { return 0; } })();
    const K = await sicher(async () => (await import("./kontext.js")).trefferquote());
    return { stufe: "gut", text: `${n.toLocaleString("de-DE")} Einträge in Fridays Datenbank.${K?.quote != null ? ` Befehls-Vorhersage trifft ${K.quote} %.` : ""}`, zahl: n, zahlText: "Einträge" };
  },
  async automation() {
    const A = await sicher(async () => (await import("./automationen.js")).liste());
    const regeln = A?.regeln || [];
    const kaputt = regeln.filter((r) => r.an && r.ok === false);
    const H = await sicher(async () => (await import("./hausintelligenz.js")).muster());
    return { stufe: STUFE(!kaputt.length, kaputt.length <= 1), text: `${regeln.filter((r) => r.an).length} Automationen aktiv${kaputt.length ? `, ${kaputt.length} mit Fehler (${kaputt[0].name})` : ""}.${H?.length ? ` ${H.length} Gewohnheit(en) im Zuhause erkannt.` : ""}`, zahl: regeln.filter((r) => r.an).length, zahlText: "aktiv" };
  },
  async krisen() {
    const notfall = await sicher(async () => (await import("./kommando.js")).notfallAktiv());
    const w = await sicher(async () => (await import("./weltintelligenz.js")).weltLage({ merken: false }));
    const auff = w?.auffaellig?.length || 0;
    return { stufe: notfall ? "problem" : STUFE(auff <= 2, true), text: `${notfall ? "Notfallmodus ist AN. " : ""}${w?.laender ? `${w.laender} Länder beobachtet, ${auff} auffällige Entwicklung(en).` : "Weltlage noch nicht geladen."}`, zahl: auff, zahlText: "auffällig" };
  },
  async datenschutz() {
    const u = await sicher(async () => (await import("./sicherheit.js")).uebersicht());
    const gaeste = await sicher(async () => (await import("./gaeste.js")).aktiv());
    const funde = u?.scan?.funde?.length || 0;
    const verb = Object.keys(store.load("verbindungen", {}) || {}).length;
    return { stufe: STUFE(funde === 0, funde <= 2), text: `${funde ? `${funde} mögliche Datenlecks gefunden. ` : u?.scan ? "Keine Datenlecks gefunden. " : "Datenleck-Prüfung noch nicht gelaufen. "}${verb} externe Dienste verbunden.${gaeste ? " Gästemodus ist an." : ""}`, zahl: funde, zahlText: "Funde" };
  },
};

export async function abteilungen() {
  const { AGENTS } = await import("./agents.js");
  const leitung = await sicher(async () => (await import("./agentenleitung.js")).leitung());
  const kpi = new Map((leitung?.agenten || []).map((a) => [a.id, a]));
  const pins = pinnwand();
  const liste = [];
  for (const a of ABTEILUNGEN) {
    const b = a.id === "ceo" ? null : (await sicher(() => BERICHTE[a.id]())) || { stufe: "hinweis", text: "Kein Bericht." };
    const team = a.agenten.map((id) => AGENTS.find((x) => x.id === id)).filter(Boolean).map((x) => ({ id: x.id, name: x.name, emoji: x.emoji, quote: kpi.get(x.id)?.quote ?? null, einsaetze: kpi.get(x.id)?.einsaetze || 0 }));
    liste.push({ ...a, bericht: b, team, pins: pins.filter((p) => p.abteilung === a.id).slice(0, 3) });
  }
  const ceo = liste[0];
  const probleme = liste.filter((x) => x.bericht?.stufe === "problem"), hinweise = liste.filter((x) => x.bericht?.stufe === "hinweis");
  ceo.bericht = { stufe: probleme.length ? "problem" : hinweise.length ? "hinweis" : "gut", text: probleme.length ? `Achtung bei ${probleme.map((x) => x.name).join(", ")}: ${probleme[0].bericht.text}` : hinweise.length ? `Alles läuft, ein Blick lohnt sich bei ${hinweise.map((x) => x.name).join(", ")}.` : "Alle Abteilungen melden: alles im grünen Bereich.", zahl: `${liste.length - 1 - probleme.length}/${liste.length - 1}`, zahlText: "ohne Problem" };
  return { abteilungen: liste, schatten: schatten.stand().an };
}

// ---------- 📌 Pinnwand ----------
let pinsCache = null;
const pinsLaden = () => (pinsCache ||= store.load("pinnwand", []));
export function pinnwand() { return pinsLaden().slice().reverse(); }
export function anheften({ abteilung = "ceo", von = "", text = "", wichtig = false } = {}) {
  const t = kurz(text, 300);
  if (!t) return null;
  const l = pinsLaden();
  // gleicher Zettel innerhalb 10 Min. nicht doppelt
  if (l.slice(-20).some((p) => p.text === t && Date.now() - Date.parse(p.at) < 600000)) return null;
  const p = { id: neueId(), at: new Date().toISOString(), abteilung, von: kurz(von, 60), text: t, ...(wichtig ? { wichtig: true } : {}) };
  l.push(p);
  pinsCache = l.slice(-150);
  store.save("pinnwand", pinsCache);
  return p;
}
function busHoeren() {
  hoere("agent", (e) => { const d = e.daten || {}; anheften({ abteilung: abteilungVonAgent(String(d.agent || "")), von: d.name || d.agent, text: d.pruefung === "bestanden" ? `${d.name || d.agent}: Einsatz geprüft und bestanden.` : `${d.name || d.agent}: Prüfung nicht bestanden (${(d.gruende || []).join("; ")}).`, wichtig: d.pruefung !== "bestanden" }); });
  hoere("recherche", (e) => { const d = e.daten || {}; anheften({ abteilung: "forschung", von: "Forschungs-Agent", text: `Recherche „${d.thema}“ fertig (${d.qualitaet || (d.ok ? "ok" : "ohne Ergebnis")}).` }); });
  hoere("warnung", (e) => { const d = e.daten || {}; anheften({ abteilung: /pausiert|agent/i.test(d.titel || "") ? "qualitaet" : "krisen", von: e.quelle || "Friday", text: `${d.titel || "Warnung"}${d.text ? `: ${d.text}` : ""}`, wichtig: true }); });
}

// ---------- 🤝 CEO-Verteilung mit Angeboten ----------
/** Angebote aller passenden Agenten für einen Schritt. */
export async function angebote(schritt, { leitung, eigene } = {}) {
  const { AGENTS } = await import("./agents.js");
  const kpi = new Map((leitung?.agenten || []).map((a) => [a.id, a]));
  const kandidaten = [];
  if (schritt.einsatz.startsWith("eigen:")) kandidaten.push({ id: schritt.einsatz.slice(6), eigen: true, passung: 100 });
  else {
    kandidaten.push({ id: schritt.einsatz, eigen: false, passung: 100 });
    for (const e of eigene || []) if (e.basis === schritt.einsatz && e.status === "einsatzbereit") kandidaten.push({ id: e.id, eigen: true, passung: e.eingabe && schritt.eingabe && e.eingabe.toLowerCase() === String(schritt.eingabe).toLowerCase() ? 100 : 85 });
  }
  return kandidaten.map((k) => {
    const s = kpi.get(k.id);
    const pausiert = Boolean(s?.pause_bis);
    const quote = s?.quote ?? 70; // ohne Erfahrung: neutral
    const tempo = s?.tempo_ms ? Math.max(0, 100 - Math.round(s.tempo_ms / 300)) : 60;
    const punkte = pausiert ? 0 : Math.round(k.passung * 0.45 + quote * 0.35 + tempo * 0.1 + 10);
    const name = k.eigen ? (eigene || []).find((e) => e.id === k.id)?.name || k.id : AGENTS.find((a) => a.id === k.id)?.name || k.id;
    return { id: k.id, eigen: k.eigen, name, punkte, passung: k.passung, quote: s?.quote ?? null, einsaetze: s?.einsaetze || 0, pausiert, grund: pausiert ? "pausiert" : `Passung ${k.passung}, Erfolg ${s?.quote ?? "neu"}${s?.quote != null ? " %" : ""}` };
  }).sort((a, b) => b.punkte - a.punkte);
}

export async function verteilen(auftrag, { kanal = "dashboard", automatisch = false } = {}) {
  const ziel = kurz(auftrag, 400);
  if (ziel.length < 3) return { error: "Was soll das Team erledigen?" };
  const L = await import("./agentenleitung.js");
  const plan = L.lokalerPlan(ziel);
  const schritte = plan.schritte.filter((s) => s.einsatz !== "_zusammenfassen");
  if (!schritte.length) return { error: "Dafür habe ich keinen passenden Agenten. Frag mich direkt oder starte eine Mission.", ziel };
  const leitung = L.leitung(), eigene = L.eigeneAgenten();
  const zuteilung = [];
  for (const s of schritte) {
    const a = await angebote(s, { leitung, eigene });
    zuteilung.push({ schritt: s.text, eingabe: s.eingabe || "", angebote: a, gewinner: a.find((x) => !x.pausiert) || null });
  }
  const nurSchatten = automatisch && schatten.an();
  const ergebnisse = [];
  for (const z of zuteilung) {
    if (!z.gewinner) { ergebnisse.push({ schritt: z.schritt, ok: false, text: "Alle passenden Agenten sind pausiert." }); continue; }
    if (nurSchatten) { schatten.notiere("CEO-Agentin", `${z.gewinner.name} für „${z.schritt}“ losschicken`, ziel); ergebnisse.push({ schritt: z.schritt, ok: true, schatten: true, text: `Würde ${z.gewinner.name} losschicken.` }); continue; }
    const b = z.gewinner.eigen ? await L.eigenLos(z.gewinner.id, { kanal }) : await L.losschicken(z.gewinner.id, z.eingabe, { kanal });
    const ok = b.ok !== false && b.pruefung?.status !== "fehler";
    ergebnisse.push({ schritt: z.schritt, agent: z.gewinner.name, ok, text: `${b.text || ""}${(b.punkte || []).length ? `\n${b.punkte.slice(0, 4).join("\n")}` : ""}`.trim().slice(0, 900) });
  }
  const gut = ergebnisse.filter((e) => e.ok).length;
  eintragen({ bereich: "agent", titel: `CEO-Agentin verteilt: ${ziel.slice(0, 80)}`, details: zuteilung.map((z) => `${z.schritt} → ${z.gewinner?.name || "niemand"} (${z.angebote.length} Angebot${z.angebote.length === 1 ? "" : "e"})`).join(" · "), ok: gut > 0, quelle: "ceo" });
  anheften({ abteilung: "ceo", von: "CEO-Agentin", text: nurSchatten ? `Schatten: würde „${ziel.slice(0, 80)}“ auf ${zuteilung.length} Agent${zuteilung.length === 1 ? "" : "en"} verteilen.` : `„${ziel.slice(0, 80)}“ auf ${zuteilung.length} Agent${zuteilung.length === 1 ? "" : "en"} verteilt, ${gut} erfolgreich.` });
  return { ok: gut > 0, ziel, zuteilung: zuteilung.map(({ angebote: a, ...z }) => ({ ...z, angebote: a.slice(0, 4) })), ergebnisse, schatten: nurSchatten };
}

// ---------- 📁 Projektmanager ----------
const projekteLaden = () => store.load("projekte", []);
const projekteSichern = (l) => store.save("projekte", l);
export function projektFortschritt(p) {
  const a = p.aufgaben || [];
  return a.length ? Math.round((a.filter((x) => x.erledigt).length / a.length) * 100) : p.status === "fertig" ? 100 : 0;
}
function projektAnsicht(p) {
  const heute = new Date().toISOString().slice(0, 10);
  const aufgaben = (p.aufgaben || []);
  const ueberfaellig = aufgaben.filter((a) => !a.erledigt && a.frist && a.frist < heute);
  const meilensteine = (p.meilensteine || []).map((m) => {
    const ma = aufgaben.filter((a) => a.meilenstein === m.id);
    return { ...m, aufgaben: ma.length, fertig: ma.filter((a) => a.erledigt).length, prozent: ma.length ? Math.round((ma.filter((a) => a.erledigt).length / ma.length) * 100) : m.erledigt ? 100 : 0 };
  });
  return { id: p.id, name: p.name, status: p.status, aktiv: Boolean(p.aktiv), autopilot: Boolean(p.autopilot), notizen: (p.notizen || []).length, fortschritt: projektFortschritt(p), meilensteine, aufgaben, ueberfaellig: ueberfaellig.length, bericht: p.bericht || null };
}
export function projekte() { return projekteLaden().map(projektAnsicht).sort((a, b) => (a.status === "fertig") - (b.status === "fertig") || b.aktiv - a.aktiv); }

export async function projektAendern(id, x = {}) {
  const l = projekteLaden();
  let p = l.find((y) => y.id === id);
  if (!p && x.neu) {
    const G = await import("./gedaechtnis.js");
    const n = G.projektAnlegen(x.neu, { aktiv: false });
    if (n.error) return n;
    return projektAendern(n.id, { ...x, neu: undefined });
  }
  if (!p) return { error: "Projekt nicht gefunden." };
  p.meilensteine ||= []; p.aufgaben ||= [];
  if (x.meilenstein) { const t = kurz(x.meilenstein, 120); if (t) p.meilensteine.push({ id: neueId(), titel: t, frist: /^\d{4}-\d{2}-\d{2}$/.test(x.frist || "") ? x.frist : "" }); }
  if (x.aufgabe) {
    const t = kurz(x.aufgabe, 200);
    if (t) p.aufgaben.push({ id: neueId(), text: t, frist: /^\d{4}-\d{2}-\d{2}$/.test(x.frist || "") ? x.frist : "", meilenstein: p.meilensteine.some((m) => m.id === x.zuMeilenstein) ? x.zuMeilenstein : "", wichtig: [1, 2, 3].includes(Number(x.wichtig)) ? Number(x.wichtig) : 2, aufwand: [1, 2, 3].includes(Number(x.aufwand)) ? Number(x.aufwand) : 2, erledigt: false, erstellt: new Date().toISOString() });
  }
  if (x.abhaken) { const a = p.aufgaben.find((y) => y.id === x.abhaken); if (a) { a.erledigt = !a.erledigt; a.am = a.erledigt ? new Date().toISOString() : null; } }
  if (x.aufgabeWeg) p.aufgaben = p.aufgaben.filter((y) => y.id !== x.aufgabeWeg);
  if (x.meilensteinWeg) { p.meilensteine = p.meilensteine.filter((y) => y.id !== x.meilensteinWeg); for (const a of p.aufgaben) if (a.meilenstein === x.meilensteinWeg) a.meilenstein = ""; }
  if (typeof x.autopilot === "boolean") p.autopilot = x.autopilot;
  if (x.status) p.status = x.status === "fertig" ? "fertig" : "offen";
  p.geaendert = new Date().toISOString();
  projekteSichern(l);
  return { ok: true, projekt: projektAnsicht(p) };
}

export function projektBericht(p) {
  const v = projektAnsicht(p);
  const offen = v.aufgaben.filter((a) => !a.erledigt);
  const seit = Date.now() - 7 * 864e5;
  const dieseWoche = v.aufgaben.filter((a) => a.erledigt && a.am && Date.parse(a.am) > seit).length;
  const naechste = offen.slice().sort((a, b) => (a.frist || "9999").localeCompare(b.frist || "9999") || b.wichtig - a.wichtig)[0];
  return `Projekt „${v.name}“: ${v.fortschritt} % erledigt (${v.aufgaben.length - offen.length} von ${v.aufgaben.length} Aufgaben), ${dieseWoche} diese Woche.${v.ueberfaellig ? ` ${v.ueberfaellig} Aufgabe${v.ueberfaellig === 1 ? " ist" : "n sind"} überfällig.` : ""}${naechste ? ` Als Nächstes: ${naechste.text}${naechste.frist ? ` (bis ${new Date(`${naechste.frist}T12:00:00`).toLocaleDateString("de-DE")})` : ""}.` : v.aufgaben.length ? " Alles erledigt." : " Noch keine Aufgaben angelegt."}`;
}
export function berichteErstellen() {
  const l = projekteLaden();
  const offen = l.filter((p) => p.status !== "fertig" && (p.aufgaben || []).length);
  for (const p of offen) p.bericht = { at: new Date().toISOString(), text: projektBericht(p) };
  projekteSichern(l);
  return offen.map((p) => p.bericht.text);
}

/** Autopilot: Agenten bereiten offene Aufgaben vor (nur was ein lesender Agent kann). Abhaken bleibt bei dir. */
export async function autopilot({ automatisch = true } = {}) {
  const L = await import("./agentenleitung.js");
  const l = projekteLaden();
  const erledigt = [];
  for (const p of l.filter((x) => x.autopilot && x.status !== "fertig")) {
    for (const a of (p.aufgaben || []).filter((x) => !x.erledigt && !x.vorbereitet)) {
      if (!L.lokalerPlan(a.text).schritte.some((s) => s.einsatz !== "_zusammenfassen")) continue;
      const r = await verteilen(a.text, { kanal: "mission", automatisch });
      if (r.error) continue;
      if (r.schatten) { erledigt.push(`${p.name}: würde „${a.text}“ vorbereiten`); continue; }
      const frisch = projekteLaden();
      const fp = frisch.find((x) => x.id === p.id); const fa = fp?.aufgaben?.find((x) => x.id === a.id);
      if (fa) { fa.vorbereitet = new Date().toISOString(); fa.ergebnis = r.ergebnisse.map((e) => `${e.agent || ""}: ${e.text}`).join("\n").slice(0, 1500); projekteSichern(frisch); }
      erledigt.push(`${p.name}: „${a.text}“ vorbereitet`);
      if (erledigt.length >= 5) break;
    }
  }
  return erledigt;
}

// ---------- 🛠 Automations-Designer ----------
const WOCHENTAGE = { sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6 };
export async function automationEntwerfen(satz = "") {
  const roh = String(satz).trim().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/i, "").replace(/^(erstelle?|bau|mach|leg an)( mir)?( eine)? automation[: ,]*/i, "");
  const t = roh.toLowerCase();
  if (t.length < 5) return { error: "Beschreib die Automation in einem Satz, z. B. „Jeden Morgen um 7 schick mir das Wetter“." };
  // Wann?
  let ausloeser = null;
  const zeit = t.match(/um (\d{1,2})(?:[:.](\d{2}))?\s*(uhr)?/);
  const hhmm = zeit ? `${String(Math.min(23, Number(zeit[1]))).padStart(2, "0")}:${zeit[2] || "00"}` : null;
  let tage = [0, 1, 2, 3, 4, 5, 6];
  if (/werktags|wochentags|montags? bis freitags?|unter der woche/.test(t)) tage = [1, 2, 3, 4, 5];
  else if (/(am )?wochenende/.test(t)) tage = [0, 6];
  else { const genannt = Object.entries(WOCHENTAGE).filter(([n]) => new RegExp(`\\b(jeden )?${n}s?\\b`).test(t)).map(([, i]) => i); if (genannt.length) tage = genannt; }
  const iv = t.match(/alle (\d+) (minuten|min|stunden|std)/) || (/(jede|alle) stunde\b|stündlich/.test(t) ? [null, "1", "stunden"] : null);
  if (/(wenn|sobald) (friday|du) (startet|startest|hochfährt)|beim start/.test(t)) ausloeser = { art: "start" };
  else if (iv) ausloeser = { art: "intervall", minuten: Math.max(15, Number(iv[1]) * (/stund|std/.test(iv[2]) ? 60 : 1)) };
  else if (hhmm || /jeden (morgen|abend|tag|mittag)|täglich|taeglich|morgens|abends/.test(t) || tage.length < 7) ausloeser = { art: "taeglich", zeit: hhmm || (/abend/.test(t) ? "19:00" : /mittag/.test(t) ? "12:00" : "07:00"), tage };
  if (!ausloeser) return { error: "Wann soll das passieren? Zum Beispiel „jeden Morgen um 7“, „werktags um 18 Uhr“ oder „alle 2 Stunden“." };
  // Was?
  const ZEIT_WEG = [/\b(jeden|jede|jedes) (morgen|abend|mittag|tag|stunde)\b/gi, /\b(jeden )?(sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag)s?\b/gi, /\b(täglich|taeglich|werktags|wochentags|morgens|abends|mittags|stündlich|stuendlich|am wochenende|unter der woche|montags? bis freitags?)\b/gi, /\bum \d{1,2}([:.]\d{2})?(\s*uhr)?/gi, /\balle \d+ (minuten|min|stunden|std)\b/gi, /\balle stunde\b/gi, /\b(wenn|sobald) (friday|du) (startet|startest|hochfährt)\b/gi, /\bbeim start\b/gi];
  const rest = ZEIT_WEG.reduce((x, re) => x.replace(re, " "), roh).replace(/\s+/g, " ").trim().replace(/^[,.:\s]+|[,.:\s]+$/g, "");
  const r = rest.toLowerCase();
  let aktion = null, m;
  const L = await import("./agentenleitung.js");
  if ((m = rest.match(/erinner\w* mich (?:daran,? |an )?(.+)/i))) aktion = { art: "mitteilung", text: m[1].replace(/^(dass|zu) /i, "") };
  else if ((m = rest.match(/(?:leg|lege|erstell\w*) (?:mir )?(?:eine )?aufgabe(?: an)?:? (.+)/i))) aktion = { art: "aufgabe", text: m[1] };
  else if ((m = rest.match(/(?:starte?|führe?) (?:das )?protokoll:? (.+)/i))) aktion = { art: "protokoll", name: m[1] };
  else if ((m = rest.match(/(?:starte?|beginne?) (?:eine )?mission:? (.+)/i))) aktion = { art: "mission", text: m[1] };
  else {
    const plan = L.lokalerPlan(rest).schritte.filter((s) => s.einsatz !== "_zusammenfassen" && !s.einsatz.startsWith("eigen:"));
    // Nur ein Agent und nichts weiter verlangt ("… und schreib ein Gedicht") → kostenloser Agent, sonst Friday selbst.
    if (plan.length === 1 && !/\bund\b/.test(r)) aktion = { art: "agent", text: plan[0].einsatz, eingabe: plan[0].eingabe || "", melden: /(schick|sag|meld|zeig|\bmir\b)/.test(r) ? "immer" : "fehler" };
    else aktion = { art: "friday", text: rest };
  }
  const regel = { name: kurz(rest, 60) || "Neue Automation", ausloeser, aktion, an: true };
  const A = await import("./automationen.js");
  const hinweise = [];
  if (aktion.art === "friday") hinweise.push("Das erledigt Friday mit ihrem großen Gehirn (kostet ein wenig KI-Guthaben).");
  if (aktion.art === "agent") hinweise.push("Läuft ohne KI, kostenlos. Der Kontroll-Agent prüft jedes Ergebnis.");
  if (schatten.an()) hinweise.push("Schattenmodus ist an: Die Automation wird nur aufgeschrieben, nicht ausgeführt.");
  return { ok: true, regel, beschreibung: A.beschreibe(regel), hinweise };
}
export async function automationUebernehmen(regel) {
  const A = await import("./automationen.js");
  const r = A.speichereRegel(regel || {});
  if (r.ok) anheften({ abteilung: "automation", von: "Automations-Agent", text: `Neue Automation: ${r.regel.name} (${A.beschreibe(r.regel)})` });
  return r;
}

// ---------- Sprachbefehle ----------
export async function quickCommand(text) {
  const roh = String(text || "").trim().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/i, "");
  const t = roh.toLowerCase().replace(/[?!.]+$/, "");
  let m;
  if (/^(öffne|oeffne|zeig|zeige)( mir)? (die |meine )?(firma|abteilungen|unternehmen|pinnwand)$/.test(t)) return { answer: "Hier ist deine Firma mit allen Abteilungen.", actions: ["cockpit:firma"] };
  if (/^(wie läuft|wie laeuft|wie steht'?s um) (die |meine |deine )?(firma|abteilungen|unternehmen)|^(abteilungs|firmen)bericht$/.test(t)) {
    const a = await abteilungen();
    return { answer: a.abteilungen[0].bericht.text, actions: ["cockpit:firma"] };
  }
  if ((m = roh.match(/^(?:ceo|team|firma)[,:]? (?:kümmer(?:e)? dich um|erledige?|verteile?):? (.{3,})$/i)) || (m = roh.match(/^verteile?:? (.{3,})$/i))) {
    const r = await verteilen(m[1], { kanal: "sprache" });
    if (r.error) return { answer: r.error, actions: ["cockpit:firma"] };
    return { answer: `Die CEO-Agentin hat ${r.zuteilung.map((z) => `${z.gewinner?.name || "niemand"} für ${z.schritt}`).join(", ")} eingeteilt. ${r.ergebnisse.filter((e) => e.ok).length} von ${r.ergebnisse.length} erfolgreich.`, actions: ["cockpit:firma"] };
  }
  if ((m = t.match(/^schatten-?modus (an|ein|aus)$/)) || (m = t.match(/^(starte|beende) (den )?schatten-?modus$/))) {
    const ein = ["an", "ein", "starte"].includes(m[1]);
    schatten.setzen(ein);
    return { answer: ein ? "Schattenmodus ist an. Ich schreibe nur auf, was ich selbstständig tun würde, und führe nichts davon aus." : "Schattenmodus ist aus. Automationen laufen wieder normal.", actions: ["cockpit:firma"] };
  }
  if ((m = roh.match(/^wie (?:steht|läuft|laeuft) (?:es mit )?(?:dem |mein(?:em)? )?projekt ([\p{L}\d -]{2,40})$/iu)) || (m = roh.match(/^wie (?:steht|läuft|laeuft) (?:das |mein )projekt ([\p{L}\d -]{2,40})$/iu))) {
    const G = await import("./gedaechtnis.js");
    const p0 = G.projektFinden(m[1]);
    const p = p0 && projekteLaden().find((x) => x.id === p0.id);
    return { answer: p ? projektBericht(p) : `Ein Projekt „${m[1]}“ kenne ich nicht.`, actions: ["cockpit:projekte"] };
  }
  if (/^(erstelle?|bau|mach|leg an)( mir)?( eine)? automation/i.test(roh)) {
    const r = await automationEntwerfen(roh);
    if (r.error) return { answer: r.error, actions: ["cockpit:projekte"] };
    return { answer: `Mein Vorschlag: ${r.beschreibung}. Bestätige ihn im Gehirn-Cockpit unter Projekte, dann ist er aktiv.`, actions: ["cockpit:projekte"], entwurf: r.regel };
  }
  return null;
}

export function unternehmenRouten(app, asyncRoute) {
  app.get("/api/firma", asyncRoute(async (_req, res) => res.json({ ...(await abteilungen()), pinnwand: pinnwand().slice(0, 40), schattenmodus: schatten.stand() })));
  app.post("/api/firma/verteilen", asyncRoute(async (req, res) => res.json(await verteilen(req.body?.auftrag))));
  app.post("/api/firma/angebote", asyncRoute(async (req, res) => {
    const L = await import("./agentenleitung.js");
    const plan = L.lokalerPlan(String(req.body?.auftrag || "")).schritte.filter((s) => s.einsatz !== "_zusammenfassen");
    const leitung = L.leitung(), eigene = L.eigeneAgenten();
    res.json({ schritte: await Promise.all(plan.map(async (s) => ({ schritt: s.text, angebote: await angebote(s, { leitung, eigene }) }))) });
  }));
  app.post("/api/firma/schatten", (req, res) => res.json(req.body?.leeren ? schatten.leeren() : schatten.setzen(Boolean(req.body?.an))));
  app.post("/api/firma/pinnwand", (req, res) => res.json(anheften({ abteilung: ABTEILUNGEN.some((a) => a.id === req.body?.abteilung) ? req.body.abteilung : "ceo", von: "Boss", text: req.body?.text }) || { error: "Leerer Zettel." }));
  app.get("/api/firma/projekte", (_req, res) => res.json({ projekte: projekte(), prioritaeten: null }));
  app.post("/api/firma/projekte/:id", asyncRoute(async (req, res) => res.json(await projektAendern(req.params.id, req.body || {}))));
  app.post("/api/firma/projekte-bericht", (_req, res) => res.json({ berichte: berichteErstellen() }));
  app.post("/api/firma/autopilot", asyncRoute(async (_req, res) => res.json({ erledigt: await autopilot({ automatisch: false }) })));
  app.get("/api/firma/prioritaeten", asyncRoute(async (_req, res) => res.json({ liste: (await import("./persoenlich.js")).prioritaeten().slice(0, 25) })));
  app.post("/api/firma/automation-entwurf", asyncRoute(async (req, res) => res.json(await automationEntwerfen(req.body?.satz))));
  app.post("/api/firma/automation", asyncRoute(async (req, res) => res.json(await automationUebernehmen(req.body?.regel))));
}

export async function unternehmenStart() {
  busHoeren();
  try {
    const hz = await import("./herzschlag.js");
    hz.aufgabeRegistrieren("projekt-autopilot", { name: "Projekt-Autopilot", text: "Agenten bereiten offene Projekt-Aufgaben vor (nur bei Projekten mit eingeschaltetem Autopilot, nur lesende Agenten, abhaken tust du).", art: "intervall", minuten: 120, standardAn: true, lauf: async () => {
      const e = await autopilot({ automatisch: true });
      return { ok: true, text: e.length ? e.join(" · ").slice(0, 300) : "Nichts vorzubereiten" };
    } });
    hz.aufgabeRegistrieren("fortschrittsbericht", { name: "Fortschrittsberichte", text: "Schreibt täglich einen Bericht je Projekt. Sonntags kommt eine Wochen-Mitteilung (nur Text, kein Vorlesen).", art: "taeglich", zeit: "18:00", standardAn: true, lauf: async () => {
      const b = berichteErstellen();
      const sonntag = new Date(new Date().toLocaleString("en-US", { timeZone: (await import("./config.js")).config.timezone })).getDay() === 0;
      if (sonntag && b.length) await import("./notify.js").then((n) => n.notifyAll("📁 Wochenbericht Projekte", b.slice(0, 4).join("\n\n"))).catch(() => {});
      return { ok: true, text: b.length ? `${b.length} Projektbericht(e)${sonntag ? ", Wochen-Mitteilung geschickt" : ""}` : "Keine Projekte mit Aufgaben" };
    } });
  } catch { /* egal */ }
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "unternehmen", bereich: "Agenten", name: "Firma: Abteilungen, Angebote, Automations-Designer", lauf: async () => {
      const a = await abteilungen();
      if (a.abteilungen.length !== 12 || a.abteilungen.some((x) => !x.bericht?.text)) return { status: "fehler", text: "Nicht alle 12 Abteilungen liefern einen Bericht." };
      const e = await automationEntwerfen("Jeden Morgen um 7 schick mir das Wetter");
      if (!e.ok || e.regel.ausloeser.zeit !== "07:00" || e.regel.aktion.art !== "agent" || e.regel.aktion.text !== "wetter") return { status: "fehler", text: "Der Automations-Designer versteht „Jeden Morgen um 7 schick mir das Wetter“ nicht richtig." };
      const L = await import("./agentenleitung.js");
      const ang = await angebote({ einsatz: "wetter", text: "Wetter" }, { leitung: L.leitung(), eigene: L.eigeneAgenten() });
      if (!ang.length) return { status: "fehler", text: "Für das Wetter gab es kein Angebot." };
      return { status: "bestanden", text: `12 Abteilungen berichten, Designer und Angebote geprüft (bestes Angebot fürs Wetter: ${ang[0].name}, ${ang[0].punkte} Punkte). Echte Agenten-Einsätze prüft der Kontroll-Agent.` };
    } });
  } catch { /* egal */ }
}
