// Fridays Kontrollraum (v1.135.0): die acht Bausteine aus Conway-Research/automaton (MIT-Lizenz),
// für Friday in Node nachgebaut – ohne Geld, Wallet, Selbst-Vervielfältigung und Selbst-Umprogrammieren.
//   🛡 Regelwerk · 🔁 Schleifen-Schutz · 🧠 Gedächtnis-Schubladen · 💓 Herzschlag · 💰 Kosten-Deckel
//   ✨ Seele · 🧩 Fähigkeiten · 🕘 Änderungs-Protokoll
// Hier: Schnittstellen fürs Dashboard, Sprachbefehle ohne Claude und die Werkzeuge für Claude.
import * as regelwerk from "./regelwerk.js";
import * as schleifen from "./schleifen.js";
import * as gedaechtnis from "./gedaechtnis.js";
import * as neuronen from "./neuronen.js";
import * as herzschlag from "./herzschlag.js";
import * as kostendeckel from "./kostendeckel.js";
import * as seele from "./seele.js";
import * as faehigkeiten from "./faehigkeiten.js";
import * as aenderungen from "./aenderungen.js";

// ---------- Werkzeuge für Claude ----------
export const kernTools = [
  {
    name: "ablauf_speichern",
    description: "Speichert einen Ablauf (wie man etwas macht, Schritt für Schritt) in deinem Gedächtnis, damit du es beim nächsten Mal genauso machen kannst. Nutze es, wenn Boss dir erklärt, wie er etwas haben will, oder wenn ein mehrstufiger Weg gut geklappt hat.",
    input_schema: { type: "object", properties: { name: { type: "string", description: "Kurzer Name, z. B. 'Morgens Licht und Musik'" }, schritte: { type: "array", items: { type: "string" } }, ausloeser: { type: "string", description: "Optional: Wann der Ablauf passt" } }, required: ["name", "schritte"] },
  },
  {
    name: "ablauf_bewerten",
    description: "Sagt deinem Gedächtnis, ob ein gespeicherter Ablauf gerade geklappt hat (zählt Erfolge und Fehlschläge).",
    input_schema: { type: "object", properties: { name: { type: "string" }, geklappt: { type: "boolean" } }, required: ["name", "geklappt"] },
  },
  {
    name: "seele_notiz",
    description: "Schreibt eine wichtige Erkenntnis über deine Arbeit mit Boss in deine Seele (Abschnitt 'Was ich gelernt habe'), z. B. 'Boss will Antworten kürzer'. Nur echte, dauerhafte Erkenntnisse, höchstens ein Satz.",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "faehigkeit_erstellen",
    description: "Legt eine neue Fähigkeit als Datei an: eine Anleitung, die du automatisch mitliest, wenn eines der Auslöser-Wörter in einer Frage vorkommt. Nutze es, wenn Boss sagt 'lerne, wie man …' oder 'mach daraus eine Fähigkeit'.",
    input_schema: { type: "object", properties: { name: { type: "string" }, beschreibung: { type: "string" }, ausloeser: { type: "array", items: { type: "string" }, description: "Wörter, bei denen die Fähigkeit greift" }, anleitung: { type: "string", description: "Wie du vorgehst, in normalen Sätzen oder nummerierten Schritten" } }, required: ["name", "ausloeser", "anleitung"] },
  },
];
const NAMEN = new Set(kernTools.map((t) => t.name));
export const istKernTool = (n) => NAMEN.has(n);
export function runKernTool(name, input = {}) {
  switch (name) {
    case "ablauf_speichern": return gedaechtnis.ablaufSpeichern(input);
    case "ablauf_bewerten": return gedaechtnis.ablaufBewerten(input.name, Boolean(input.geklappt));
    case "seele_notiz": return seele.notiz(input.text);
    case "faehigkeit_erstellen": return faehigkeiten.speichern({ name: input.name, beschreibung: input.beschreibung, ausloeser: input.ausloeser, text: input.anleitung, aktiv: true }, "friday");
    default: return { error: "Unbekanntes Werkzeug" };
  }
}

// ---------- Zusatz für Fridays Kontext (brain.js) ----------
export function kontextFuer(frage = "") {
  const g = gedaechtnis.kontext(frage);
  const teile = [`Was du über Boss weißt (nach Schubladen):\n${g.fakten}`];
  if (g.ablaeufe) teile.push(`Passende Abläufe aus deinem Gedächtnis (so hat es früher geklappt):\n${g.ablaeufe}`);
  if (g.ereignisse) teile.push(`Passende frühere Ereignisse:\n${g.ereignisse}`);
  if (g.kurzzeit) teile.push(`Kurzzeitgedächtnis:\n${g.kurzzeit}`);
  if (g.projekt) teile.push(`Projektgedächtnis:\n${g.projekt}`);
  const nb = neuronen.kontextBlock(frage, { schon: teile.join("\n") });
  if (nb) teile.push(nb);
  const f = faehigkeiten.fuerKontext(frage);
  if (f) teile.push(f);
  return teile.join("\n\n");
}

// ---------- Sprachbefehle ohne Claude ----------
const OEFFNE = "(öffne|oeffne|zeig|zeige|starte|mach)( mir)?( den| die| das| deine?n?| meine?n?)?";
export function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/, "").replace(/[!?.]+$/g, "").trim();
  if (!t) return null;
  const auf = (re) => new RegExp(`^${OEFFNE} ${re}( auf)?$`, "iu").test(t);
  if (auf("(kontrollraum|kontroll-raum|automaton)")) return { answer: "Hier ist mein Kontrollraum: Regeln, Gedächtnis, Herzschlag, Kosten, Seele, Fähigkeiten und alle Änderungen.", actions: ["kern"] };
  if (auf("(seele|persönlichkeit|persoenlichkeit)")) return { answer: "Das ist meine Seele. Du kannst sie lesen und ändern. Die festen Grenzen gelten immer.", actions: ["kern:seele"] };
  if (auf("(regeln|regelwerk|sicherheits-?regeln)")) {
    const u = regelwerk.uebersicht();
    return { answer: `Mein Regelwerk hat heute ${u.heute.geprueft} Aktionen geprüft und ${u.heute.gestoppt} gestoppt.`, actions: ["kern:regeln"] };
  }
  if (auf("(herzschlag|herzschlag-planer|hintergrund-?aufgaben)")) return { answer: "Das ist mein Herzschlag. Hier siehst du, welche Aufgaben ich im Hintergrund erledige.", actions: ["kern:herzschlag"] };
  if (auf("(fähigkeiten|faehigkeiten|skills)")) {
    const n = faehigkeiten.alle().filter((f) => f.aktiv).length;
    return { answer: `Ich habe ${n} aktive Fähigkeit${n === 1 ? "" : "en"}. Du kannst neue anlegen.`, actions: ["kern:faehigkeiten"] };
  }
  if (auf("(änderungen|aenderungen|änderungs-?protokoll|aenderungs-?protokoll|versionen)")) return { answer: "Hier sind alle Änderungen an meinen Einstellungen. Jede Fassung kannst du zurückholen.", actions: ["kern:aenderungen"] };
  if (auf("(gedächtnis-?schubladen|schubladen|abläufe|ablaeufe)")) return { answer: "Hier ist mein Gedächtnis, sortiert nach Schubladen.", actions: ["kern:gedaechtnis"] };
  if (auf("(kosten-?deckel|kostengrenze|kosten)") || /^(was|wie viel|wieviel) (hast du|habe ich) heute (schon )?(ausgegeben|verbraucht|gekostet)$|^was (hat|kostet) (claude|friday) heute( gekostet)?$/iu.test(t)) {
    const s = kostendeckel.stand();
    const euro = (v) => `${v.toFixed(2).replace(".", ",")} Dollar`;
    const grenze = s.an && s.grenze.tag > 0 ? ` Meine Grenze liegt bei ${euro(s.grenze.tag)} am Tag.` : " Der Kosten-Deckel ist aus.";
    return { answer: `Heute habe ich ungefähr ${euro(s.heute)} verbraucht.${grenze}${s.stufe === "gesperrt" ? " Die Grenze ist erreicht, ich nutze nur noch Offline-Befehle." : s.stufe === "sparsam" ? " Ich spare gerade." : ""}`, actions: ["kern:kosten"] };
  }
  return null;
}

// ---------- Schnittstellen fürs Dashboard ----------
export function kernRouten(app, asyncRoute) {
  const ok = (res, r) => (r && r.error ? res.status(400).json(r) : res.json(r));
  app.get("/api/kern", (req, res) => res.json({
    regeln: regelwerk.uebersicht(),
    schleifen: schleifen.uebersicht(),
    kosten: kostendeckel.stand(),
    herzschlag: herzschlag.uebersicht(),
    faehigkeiten: faehigkeiten.alle().length,
    gedaechtnis: { fakten: gedaechtnis.fakten().length, ablaeufe: gedaechtnis.ablaeufe().length },
  }));
  // Regelwerk
  app.get("/api/kern/regeln", (req, res) => res.json(regelwerk.uebersicht()));
  app.post("/api/kern/regeln/:id", (req, res) => ok(res, regelwerk.schalteRegel(req.params.id, Boolean(req.body?.an))));
  app.get("/api/kern/schleifen", (req, res) => res.json(schleifen.uebersicht()));
  // Gedächtnis
  app.get("/api/kern/gedaechtnis", (req, res) => res.json(gedaechtnis.uebersicht()));
  app.post("/api/kern/gedaechtnis/fakt", (req, res) => {
    const t = String(req.body?.text || "").trim();
    if (t.length < 3) return res.status(400).json({ error: "Bitte einen Satz eingeben." });
    res.json(gedaechtnis.faktMerken(t, req.body?.schublade));
  });
  app.post("/api/kern/gedaechtnis/fakt/:id", (req, res) => ok(res, gedaechtnis.faktVerschieben(req.params.id, String(req.body?.schublade || ""))));
  app.delete("/api/kern/gedaechtnis/fakt/:id", (req, res) => ok(res, gedaechtnis.faktLoeschen(req.params.id)));
  app.post("/api/kern/gedaechtnis/ablauf", (req, res) => ok(res, gedaechtnis.ablaufSpeichern(req.body || {})));
  app.delete("/api/kern/gedaechtnis/ablauf/:id", (req, res) => ok(res, gedaechtnis.ablaufLoeschen(req.params.id)));
  // Gedächtnis-Ebenen (v1.179.0): Monitor, Kurzzeit, Projekte
  app.get("/api/gedaechtnis/monitor", (req, res) => res.json(gedaechtnis.monitor()));
  app.post("/api/gedaechtnis/kurz", (req, res) => ok(res, gedaechtnis.kurzMerken(req.body?.text, { stunden: Math.max(1, Math.min(24 * 7, Number(req.body?.stunden) || 48)) })));
  app.delete("/api/gedaechtnis/kurz/:id", (req, res) => { gedaechtnis.kurzWeg(req.params.id); res.json({ ok: true }); });
  app.post("/api/gedaechtnis/projekte", (req, res) => ok(res, gedaechtnis.projektAnlegen(req.body?.name, { aktiv: req.body?.aktiv !== false })));
  app.post("/api/gedaechtnis/projekte/:id", (req, res) => ok(res, gedaechtnis.projektSetzen(req.params.id, req.body || {})));
  app.post("/api/gedaechtnis/projekte/:id/notiz", (req, res) => {
    const p = gedaechtnis.projekte().find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: "Projekt nicht gefunden." });
    ok(res, gedaechtnis.projektNotiz(p.name, req.body?.text));
  });
  app.post("/api/gedaechtnis/befoerdern/:id", (req, res) => ok(res, gedaechtnis.befoerdern(req.params.id)));
  neuronen.neuronenRouten(app);
  // Herzschlag
  app.get("/api/kern/herzschlag", (req, res) => res.json(herzschlag.uebersicht()));
  app.post("/api/kern/herzschlag/:id", (req, res) => ok(res, herzschlag.einstellen(req.params.id, req.body || {})));
  app.post("/api/kern/herzschlag/:id/jetzt", asyncRoute(async (req, res) => ok(res, await herzschlag.jetzt(req.params.id))));
  // Kosten-Deckel
  app.get("/api/kern/kosten", (req, res) => res.json(kostendeckel.stand()));
  app.post("/api/kern/kosten", (req, res) => ok(res, kostendeckel.einstellen(req.body || {})));
  // Seele
  app.get("/api/kern/seele", (req, res) => res.json(seele.stand()));
  app.post("/api/kern/seele", (req, res) => ok(res, seele.speichern(req.body?.text)));
  app.post("/api/kern/seele/zurueck/:nr", (req, res) => ok(res, seele.zurueckholen(req.params.nr)));
  // Fähigkeiten
  app.get("/api/kern/faehigkeiten", (req, res) => res.json({ faehigkeiten: faehigkeiten.alle() }));
  app.post("/api/kern/faehigkeiten", (req, res) => ok(res, faehigkeiten.speichern(req.body || {}, "boss")));
  app.post("/api/kern/faehigkeiten/:id/schalten", (req, res) => ok(res, faehigkeiten.schalten(req.params.id, Boolean(req.body?.an))));
  app.delete("/api/kern/faehigkeiten/:id", (req, res) => ok(res, faehigkeiten.loeschen(req.params.id)));
  app.post("/api/kern/faehigkeiten/test", (req, res) => res.json({ passend: faehigkeiten.passend(String(req.body?.frage || "")).map((f) => f.name) }));
  // Änderungs-Protokoll
  app.get("/api/kern/aenderungen", (req, res) => res.json(aenderungen.liste({ datei: String(req.query.datei || ""), limit: Math.min(400, Number(req.query.limit) || 120) })));
  app.get("/api/kern/aenderungen/:id", (req, res) => ok(res, aenderungen.inhalt(req.params.id)));
  app.post("/api/kern/aenderungen/:id/zurueck", (req, res) => ok(res, aenderungen.zurueckholen(req.params.id)));
  app.post("/api/kern/aenderungen/jetzt", (req, res) => res.json({ neu: aenderungen.sichern("von Hand") }));
}

export function kernStart() {
  faehigkeiten.start();
  herzschlag.herzschlagStart();
}
