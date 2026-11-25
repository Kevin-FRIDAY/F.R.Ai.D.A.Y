// Selbstlernen (v1.184.0, Mark XIII).
//
//  🕳️ Wissenslücken      Antworten wie „weiß ich nicht“ oder „kann ich nicht“ werden gesammelt. Nachts recherchiert Friday
//                        bis zu 3 offene Lücken selbst – kostenlos (Wikipedia, Nachrichten, eigene Feeds; lokale KI nur,
//                        wenn Ollama läuft). Das Ergebnis kommt bei einer ähnlichen Frage in Fridays Kontext.
//  ✅ Antwortqualität     Jede Antwort bekommt eine kleine, nachvollziehbare Prüfung (leer, Lücke, zu lang fürs Vorlesen,
//                        Fehler, gleich wieder gefragt).
//  🧯 Fehlergedächtnis    „Das stimmt nicht“ / „schlechte Antwort“ merkt sich Frage + falsche Antwort. Kommt eine ähnliche
//                        Frage, bekommt Friday einen Warnhinweis in den Kontext.
//  🧬 Neural Evolution    Pro Antwortweg (Schnellbefehl, Offline, Claude, lokale KI …) zählt Friday 👍 und 👎 – aus Lob,
//                        Kritik und wiederholten Fragen. So sieht man, welche Wege gut funktionieren.
// Ohne Claude, ohne Kosten.
import * as store from "./store.js";
import { muster } from "./kontext.js";
import { LUECKE } from "./friday-ausbau.js";
import { aktiv as gaesteAktiv } from "./gaeste.js";

const DATEI = "selbstlernen";
const leer = () => ({ luecken: [], fehler: [], wege: {}, letzte: null, pruefungen: { gesamt: 0, gut: 0, maengel: {} } });
const lade = () => { const d = store.load(DATEI, null); return d && typeof d === "object" ? { ...leer(), ...d } : leer(); };
const sichere = (d) => store.save(DATEI, d);
const neueId = () => Math.random().toString(36).slice(2, 10);
const kurz = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

const LOB = /^(das war (richtig |echt |sehr )?(gut|super|klasse|perfekt|hilfreich|richtig)|gute antwort|super antwort|perfekte antwort|genau richtig|daumen hoch|👍)[.! ]*$/i;
const KRITIK = /^(das (war|ist) (schlecht|nicht hilfreich|unbrauchbar|quatsch|unsinn)|das stimmt (so )?nicht|stimmt nicht|schlechte antwort|falsche antwort|die antwort (war|ist) falsch|daumen runter|👎)[.! ]*$/i;

/** Antwortweg aus dem Ergebnis von ask(). */
export function weg(res = {}) {
  const a = (res.actions || []).filter((x) => typeof x === "string");
  if (res.fehler) return "fehler";
  if (res.claude) return res.gehirn && res.gehirn !== "claude" ? `ki:${res.gehirn}` : "claude";
  if (a.includes("offline")) return "offline";
  return "schnellbefehl";
}
export const WEG_NAMEN = { claude: "Claude", offline: "Offline-Gehirn", schnellbefehl: "Schnellbefehl", fehler: "Fehler" };
const wegName = (w) => WEG_NAMEN[w] || (w.startsWith("ki:") ? `KI ${w.slice(3)}` : w);

/** Nachvollziehbare Qualitätsprüfung einer Antwort. Gibt Mängel als Liste zurück (leer = gut). */
export function pruefeAntwort({ frage = "", antwort = "", kanal = "web", fehler = false } = {}) {
  const a = String(antwort || "").trim();
  const m = [];
  if (fehler) m.push("fehler");
  if (!a) m.push("leer");
  else if (LUECKE.test(a) && !/guthaben/i.test(a)) m.push("luecke");
  if (a.length > 900 && ["telegram", "siri"].includes(kanal) === false && !/```/.test(a)) m.push("lang");
  if (frage && a && a.toLowerCase() === String(frage).toLowerCase()) m.push("echo");
  return m;
}
export const MANGEL_NAMEN = { fehler: "Fehler beim Antworten", leer: "keine Antwort", luecke: "konnte es nicht beantworten", lang: "sehr lang zum Vorlesen", echo: "nur die Frage wiederholt", wiederholt: "gleich danach nochmal gefragt" };

function wegZaehlen(d, w, gut) {
  const s = (d.wege[w] ||= { gut: 0, schlecht: 0, gesamt: 0 });
  if (gut === true) s.gut++;
  else if (gut === false) s.schlecht++;
  else s.gesamt++;
}

/** Thema für eine Recherche aus einer Frage („Friday, was ist eigentlich ein Quasar?“ → „quasar“). */
export function themaAus(frage = "") {
  const w = String(frage).toLowerCase().replace(/[^a-zäöüß0-9 ]+/g, " ").split(/\s+/)
    .filter((x) => x.length > 2 && !/^(friday|freitag|bitte|kannst|könntest|weißt|weisst|eigentlich|erzähl|erklär|erklaer|sag|sage|mir|mich|was|wie|wer|wo|wann|warum|wieso|weshalb|welche|welcher|welches|ist|sind|ein|eine|einen|der|die|das|den|dem|und|oder|über|ueber|von|mit|für|fuer|noch|denn|mal|gibt|gerade|heute|jetzt|dir|du|ich|es|bedeutet|heißt|heisst|genau|detail|details|funktioniert|war|waren|eigentlich|einfach|kurz|bisschen|etwas|alles|viel|sehr|im|am|zum|zur|bei|für)$/.test(x));
  return w.slice(0, 4).join(" ");
}

/** Passt ein gespeichertes Thema zu einem neuen? (mindestens 2 gleiche Wörter, bei kurzen Themen alle) */
export function themaPasst(a = "", b = "") {
  const A = new Set(String(a).split(" ").filter(Boolean)), B = String(b).split(" ").filter(Boolean);
  const gleich = B.filter((w) => A.has(w)).length;
  return gleich > 0 && gleich >= Math.min(2, A.size, B.length);
}

/** Nach jeder Antwort (aus brain.js ask). Schnell und ohne Netz. */
export function nachAntwort({ frage = "", antwort = "", kanal = "web", res = {} } = {}) {
  if (!frage || ["automation", "briefing"].includes(kanal)) return null;
  const f = String(frage);
  if (LOB.test(f.trim()) || KRITIK.test(f.trim())) return null; // Rückmeldungen selbst nicht bewerten
  const d = lade();
  const w = weg(res);
  const maengel = pruefeAntwort({ frage: f, antwort, kanal, fehler: res.fehler });
  // Gleich wieder dieselbe Frage (innerhalb 2 Min.)? Dann war die letzte Antwort wohl nicht gut.
  const jetzt = Date.now();
  if (d.letzte && jetzt - Date.parse(d.letzte.at) < 120000 && muster(f) && muster(f) === muster(d.letzte.frage)) {
    wegZaehlen(d, d.letzte.weg, false);
    d.pruefungen.maengel.wiederholt = (d.pruefungen.maengel.wiederholt || 0) + 1;
    if (d.letzte.ohneMangel && d.pruefungen.gut > 0) d.pruefungen.gut--; // die letzte Antwort war wohl doch nicht gut
  }
  wegZaehlen(d, w, null);
  d.pruefungen.gesamt++;
  if (!maengel.length) d.pruefungen.gut++;
  for (const x of maengel) d.pruefungen.maengel[x] = (d.pruefungen.maengel[x] || 0) + 1;
  // Lücke: Friday wusste es nicht – oder das große Gehirn war aus und es war eine reine Wissensfrage.
  const wissensfrage = /^(was (ist|sind|bedeutet|heißt|heisst) |wer (ist|war) |wie funktioniert |erkl(ä|ae)r)/i.test(f.replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/i, "").trim());
  if (maengel.includes("luecke") || (maengel.includes("fehler") && wissensfrage)) {
    const thema = themaAus(f);
    if (thema && !d.luecken.some((l) => l.status !== "nichts gefunden" && themaPasst(l.thema, thema))) {
      d.luecken.push({ id: neueId(), frage: kurz(f, 200), antwort: kurz(antwort, 240), thema, at: new Date().toISOString(), status: "offen" });
      d.luecken = d.luecken.slice(-60);
    }
  }
  d.letzte = { frage: kurz(f, 200), antwort: kurz(antwort, 400), weg: w, at: new Date().toISOString(), bewertet: false, ohneMangel: !maengel.length };
  sichere(d);
  return { weg: w, maengel };
}

/** 👍/👎 auf die letzte Antwort. */
export function rueckmeldung(gut, { grund = "" } = {}) {
  const d = lade();
  const l = d.letzte;
  if (!l) return { error: "Ich habe noch keine Antwort, die du bewerten kannst." };
  if (l.bewertet) return { ok: true, schon: true, weg: l.weg };
  wegZaehlen(d, l.weg, Boolean(gut));
  l.bewertet = true;
  if (!gut) {
    d.fehler.push({ id: neueId(), frage: l.frage, antwort: l.antwort, muster: muster(l.frage), weg: l.weg, grund: kurz(grund, 200), at: new Date().toISOString() });
    d.fehler = d.fehler.slice(-100);
  }
  sichere(d);
  return { ok: true, gut: Boolean(gut), weg: l.weg, frage: l.frage };
}

/** Kontext-Zeilen für Friday: Warnung aus dem Fehlergedächtnis + Ergebnis einer Lücken-Recherche. */
export function kontextHinweis(frage = "") {
  const m = muster(frage);
  if (!m || gaesteAktiv()) return "";
  const d = lade();
  const t = [];
  const f = d.fehler.slice().reverse().find((x) => x.muster === m);
  if (f) t.push(`Fehlergedächtnis: Bei der ähnlichen Frage „${f.frage}“ war deine Antwort laut Boss falsch („${kurz(f.antwort, 160)}“). Mach es diesmal anders und prüfe genauer.`);
  const th = themaAus(frage);
  const l = th && d.luecken.slice().reverse().find((x) => x.status === "recherchiert" && x.ergebnis && themaPasst(x.thema, th));
  if (l) t.push(`Selbst nachrecherchiert (${l.recherchiert_am?.slice(0, 10)}, ${l.qualitaet || "ohne Bewertung"}) zu „${l.thema}“: ${kurz(l.ergebnis, 700)}`);
  return t.join("\n");
}

/** Eine offene Lücke selbst recherchieren (kostenlos). */
export async function lueckeRecherchieren(id) {
  const d0 = lade();
  const l0 = d0.luecken.find((x) => x.id === id);
  if (!l0) return { error: "Diese Wissenslücke gibt es nicht mehr." };
  const W = await import("./weltintelligenz.js");
  const r = await W.tiefenRecherche(l0.thema, { mitKi: false });
  const d = lade();
  const l = d.luecken.find((x) => x.id === id);
  if (!l) return { error: "Diese Wissenslücke gibt es nicht mehr." };
  if (r?.error) { l.status = "offen"; l.versuche = (l.versuche || 0) + 1; sichere(d); return { error: r.error }; }
  const text = r.ki ? r.ki : r.ueberblick?.text ? r.ueberblick.text : r.meldungen?.length ? `Aktuelle Meldungen: ${r.meldungen.slice(0, 4).map((x) => x.titel).join(" · ")}` : "";
  l.versuche = (l.versuche || 0) + 1;
  if (text) { l.status = "recherchiert"; l.ergebnis = kurz(text, 1500); l.quelle = r.ueberblick?.link || ""; l.qualitaet = r.qualitaet?.stufe || ""; l.recherche = r.id; l.recherchiert_am = new Date().toISOString(); }
  else if (l.versuche >= 3) l.status = "nichts gefunden";
  sichere(d);
  return { ok: Boolean(text), luecke: l };
}
export function lueckeWeg(id) { const d = lade(); d.luecken = d.luecken.filter((x) => x.id !== id); sichere(d); return { ok: true }; }
export function fehlerWeg(id) { const d = lade(); d.fehler = d.fehler.filter((x) => x.id !== id); sichere(d); return { ok: true }; }

export function uebersicht() {
  const d = lade();
  const wege = Object.entries(d.wege).map(([id, s]) => {
    const bewertet = s.gut + s.schlecht;
    return { id, name: wegName(id), ...s, quote: bewertet ? Math.round((s.gut / bewertet) * 100) : null };
  }).sort((a, b) => b.gesamt - a.gesamt);
  const p = d.pruefungen;
  return {
    luecken: d.luecken.slice().reverse(), fehler: d.fehler.slice().reverse().slice(0, 30), wege,
    qualitaet: { gesamt: p.gesamt, gut: p.gut, quote: p.gesamt ? Math.round((p.gut / p.gesamt) * 100) : null, maengel: Object.entries(p.maengel).map(([id, n]) => ({ id, name: MANGEL_NAMEN[id] || id, anzahl: n })).sort((a, b) => b.anzahl - a.anzahl) },
    offen: d.luecken.filter((x) => x.status === "offen").length,
  };
}

export async function quickCommand(text) {
  const t = String(text || "").trim().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/i, "").trim();
  if (LOB.test(t)) { const r = rueckmeldung(true); return { answer: r.error || (r.schon ? "Hab ich mir schon gemerkt." : "Danke, das merke ich mir."), actions: [] }; }
  if (KRITIK.test(t)) { const r = rueckmeldung(false); return { answer: r.error || (r.schon ? "Hab ich mir schon gemerkt." : "Tut mir leid. Ich merke mir das, damit es beim nächsten Mal besser wird."), actions: [] }; }
  const k = t.toLowerCase();
  // Großes Gehirn aus? Dann hilft, was Friday selbst nachrecherchiert hat.
  if (/^(was (ist|sind|bedeutet|heißt|heisst) |wer (ist|war) |wie funktioniert |erkl(ä|ae)r)/.test(k) && !gaesteAktiv()) {
    const th = themaAus(t);
    const l = th && lade().luecken.slice().reverse().find((x) => x.status === "recherchiert" && x.ergebnis && themaPasst(x.thema, th));
    if (l) {
      const kc = await import("./ki-client.js").catch(() => null);
      if (kc && !kc.denkenMoeglich()) return { answer: `Das habe ich neulich selbst nachgeschlagen: ${kurz(l.ergebnis, 600)}`, actions: ["offline"] };
    }
  }
  if (/(welche|meine|deine) wissensl(ü|ue)cken|was wei(ß|ss)t du (noch )?nicht/.test(k)) {
    const u = uebersicht();
    const offen = u.luecken.filter((l) => l.status === "offen");
    return { answer: offen.length ? `Ich habe ${offen.length} offene Wissenslücke${offen.length === 1 ? "" : "n"}, zum Beispiel ${offen.slice(0, 3).map((l) => `„${l.thema}“`).join(", ")}. Nachts recherchiere ich sie selbst.` : "Ich habe gerade keine offenen Wissenslücken.", actions: ["cockpit:denken"] };
  }
  if (/wie gut (sind|waren) deine antworten|antwortqualit(ä|ae)t/.test(k)) {
    const q = uebersicht().qualitaet;
    return { answer: q.gesamt ? `Von ${q.gesamt} Antworten waren ${q.quote} Prozent ohne Mangel.${q.maengel[0] ? ` Häufigster Mangel: ${q.maengel[0].name}.` : ""}` : "Ich habe noch keine Antworten geprüft.", actions: ["cockpit:denken"] };
  }
  return null;
}

export function selbstlernenRouten(app, asyncRoute) {
  app.get("/api/selbstlernen", (_req, res) => res.json(uebersicht()));
  app.post("/api/selbstlernen/rueckmeldung", (req, res) => res.json(rueckmeldung(Boolean(req.body?.gut), { grund: req.body?.grund })));
  app.post("/api/selbstlernen/luecke/:id/recherche", asyncRoute(async (req, res) => res.json(await lueckeRecherchieren(req.params.id))));
  app.delete("/api/selbstlernen/luecke/:id", (req, res) => res.json(lueckeWeg(req.params.id)));
  app.delete("/api/selbstlernen/fehler/:id", (req, res) => res.json(fehlerWeg(req.params.id)));
}

export async function selbstlernenStart() {
  try {
    const hz = await import("./herzschlag.js");
    hz.aufgabeRegistrieren("wissensluecken", { name: "Wissenslücken nachrecherchieren", text: "Recherchiert nachts bis zu 3 Fragen, die Friday nicht beantworten konnte – kostenlos (Wikipedia, Nachrichten, lokale KI).", art: "taeglich", zeit: "03:30", standardAn: true, lauf: async () => {
      const offen = lade().luecken.filter((l) => l.status === "offen" && (l.versuche || 0) < 3).slice(-3);
      let ok = 0;
      for (const l of offen) { const r = await lueckeRecherchieren(l.id).catch(() => null); if (r?.ok) ok++; }
      return { ok: true, text: offen.length ? `${ok} von ${offen.length} Lücken geschlossen` : "Keine offenen Lücken" };
    } });
  } catch { /* egal */ }
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "selbstlernen", bereich: "Denken", name: "Selbstlernen (Qualität, Lücken, Fehlergedächtnis)", lauf: async () => {
      const u = uebersicht();
      // Echte Prüfung der Regeln an festen Beispielen (kein Ergebnis wird gespeichert)
      const a = pruefeAntwort({ frage: "x", antwort: "Das weiß ich leider nicht." });
      const b = pruefeAntwort({ frage: "x", antwort: "Es ist 14 Uhr." });
      if (!a.includes("luecke") || b.length) return { status: "fehler", text: "Die Antwortprüfung erkennt Lücken nicht richtig." };
      if (!u.qualitaet.gesamt) return { status: "uebersprungen", text: "Regeln stimmen. Es wurden aber noch keine echten Antworten geprüft." };
      return { status: "bestanden", text: `${u.qualitaet.gesamt} echte Antworten geprüft, ${u.qualitaet.quote} % ohne Mangel, ${u.offen} offene Lücken, ${u.fehler.length} Einträge im Fehlergedächtnis.` };
    } });
  } catch { /* egal */ }
}
