// Fridays Modul-Zentrale: der eine Ort für alle Module, Kontrolle, Missionen und Labore.
// Hier stehen: die Modul-Übersicht (was ist echt, was ist vorbereitet), die Sprachbefehle
// der Zentrale und alle /api/zentrale/...-Wege fürs Dashboard.
import { config } from "./config.js";
import * as kommando from "./kommando.js";
import * as missionen from "./missionen.js";
import * as automationen from "./automationen.js";
import * as persoenlich from "./persoenlich.js";
import * as labor from "./labor.js";
import * as rechen from "./rechenlabor.js";
import * as waechter from "./waechter.js";
import * as modulsystem from "./modulsystem.js";
import * as netzwerk from "./netzwerk.js";
import { runTool } from "./tools.js";
import * as store from "./store.js";
import { waehleModell, MODELLE } from "./denker.js";
import { getSettings } from "./einstellungen.js";

let askFn = null;

// status: echt = funktioniert jetzt · verbessert = gab es schon, jetzt besser · vorhanden = gab es schon (Verweis)
//         braucht = funktioniert, braucht aber Guthaben/Einrichtung · geruest = nur vorbereitet
export const MODULE = [
  // Kontrolle & Sicherheit
  { id: "autonomie", name: "Autonomie-Regler", gruppe: "Kontrolle & Sicherheit", status: "echt", tab: "kontrolle", text: "Du bestimmst in 4 Stufen, wie selbstständig Friday arbeitet." },
  { id: "genehmigung", name: "Genehmigungsmanager", gruppe: "Kontrolle & Sicherheit", status: "echt", tab: "kontrolle", text: "Kritische Aktionen warten auf deine Freigabe (Knopf Erlauben/Ablehnen)." },
  { id: "notfall", name: "Notfallmodus", gruppe: "Kontrolle & Sicherheit", status: "echt", tab: "kontrolle", text: "Ein Knopf (oder „Friday, Notfall!“) stoppt Missionen, Automationen, Auto-Updates und alle Aktionen." },
  { id: "zugriff", name: "Zugriffskontrolle", gruppe: "Kontrolle & Sicherheit", status: "echt", tab: "kontrolle", text: "Legt fest, welche Module welche Daten lesen dürfen." },
  { id: "manipulation", name: "Manipulationserkennung", gruppe: "Kontrolle & Sicherheit", status: "echt", tab: "sicherheit", text: "Findet versteckte KI-Befehle, unsichtbare Zeichen, gefälschte Links in Texten und Dokumenten." },
  { id: "datenleck", name: "Datenleck-Wächter", gruppe: "Kontrolle & Sicherheit", status: "echt", tab: "sicherheit", text: "Prüft Fridays eigene Dateien: offene Schlüssel, Dateirechte, Git, Tailscale Funnel." },
  { id: "aktionsprotokoll", name: "Aktionsprotokoll", gruppe: "Kontrolle & Sicherheit", status: "verbessert", tab: "logbuch", text: "Das Logbuch hält jetzt auch Freigaben, Missionen, Automationen und Module fest." },
  // Aufträge
  { id: "mission", name: "Mission Control", gruppe: "Aufträge & Abläufe", status: "braucht", tab: "missionen", text: "Große Aufträge als Missionen: Friday plant Schritte und arbeitet sie ab (braucht Guthaben)." },
  { id: "warteschlange", name: "Aufgaben-Warteschlange", gruppe: "Aufträge & Abläufe", status: "echt", tab: "missionen", text: "Missionen laufen nach Priorität hoch → mittel → niedrig." },
  { id: "rueckfall", name: "Rückfallstrategie", gruppe: "Aufträge & Abläufe", status: "echt", tab: "missionen", text: "Scheitert ein Schritt, versucht Friday einen anderen Weg, dann fragt sie dich." },
  { id: "fortschritt", name: "Fortschrittsüberwachung", gruppe: "Aufträge & Abläufe", status: "echt", tab: "missionen", text: "Erkennt Schritte, die hängen, und Missionen, die seit einem Tag stocken." },
  { id: "automation", name: "Automatisierungszentrale", gruppe: "Aufträge & Abläufe", status: "echt", tab: "automationen", text: "Wenn-Dann-Regeln: Zeitplan → Auftrag, Mitteilung, Protokoll, Aufgabe oder Mission." },
  { id: "team", name: "Team-Agenten", gruppe: "Aufträge & Abläufe", status: "verbessert", tab: "missionen", text: "Jeder Missions-Schritt bekommt einen Agenten aus dem Agenten-Team." },
  { id: "uebergabe", name: "Wissensübergabe", gruppe: "Aufträge & Abläufe", status: "echt", tab: "missionen", text: "Jeder Schritt bekommt die Ergebnisse der vorigen Schritte mit." },
  { id: "verlauf", name: "Projektverlauf mit Versionen", gruppe: "Aufträge & Abläufe", status: "echt", tab: "missionen", text: "Jede Mission speichert alle Änderungen, Notizen und Entscheidungen mit Zeit." },
  // Denken
  { id: "hypothesen", name: "Hypothesen-Engine", gruppe: "Denk-Labor", status: "braucht", tab: "labor", text: "Mehrere Erklärungen für ein unbekanntes Problem, mit Test." },
  { id: "widerspruch", name: "Widerspruchserkennung", gruppe: "Denk-Labor", status: "braucht", tab: "labor", text: "Findet widersprüchliche Aussagen in Ergebnissen." },
  { id: "luecken", name: "Wissenslücken-Scanner", gruppe: "Denk-Labor", status: "braucht", tab: "labor", text: "Findet fehlende Informationen für eine Aufgabe." },
  { id: "perspektiven", name: "Mehrperspektiven-Analyse", gruppe: "Denk-Labor", status: "braucht", tab: "labor", text: "Ein Problem aus 6+ Blickwinkeln." },
  { id: "unsicherheit", name: "Unsicherheitsbewertung", gruppe: "Denk-Labor", status: "braucht", tab: "labor", text: "Jedes Labor-Ergebnis sagt, wie sicher es ist – plus eigenes Prüf-Werkzeug." },
  { id: "qualitaet", name: "Qualitätsoptimierung", gruppe: "Denk-Labor", status: "braucht", tab: "labor", text: "Selbstprüfung: Friday bewertet ihr Ergebnis und verbessert es." },
  { id: "adaptiv", name: "Adaptive Intelligenz", gruppe: "Denk-Labor", status: "echt", tab: "labor", text: "Jedes Werkzeug hat eine eigene Denk-Strategie, Modellwahl und Websuche." },
  { id: "routing", name: "KI-Modell-Routing", gruppe: "Denk-Labor", status: "echt", tab: "kontrolle", text: "Denk-Tempo „Automatisch“: Haiku für Kurzes, Sonnet als Standard, Opus für Schweres. Spart bei knappem Guthaben." },
  { id: "berater", name: "Persönlicher Berater", gruppe: "Persönlich", status: "braucht", tab: "labor", text: "Empfehlungen auf Grundlage deiner Ziele, Werte und Aufgaben." },
  // Arbeit
  { id: "datenanalyse", name: "Datenanalyse", gruppe: "Daten & Rechnen", status: "braucht", tab: "labor", text: "Muster und Auswertungen aus Tabellen (Claude)." },
  { id: "prognose", name: "Prognosen aus Datensätzen", gruppe: "Daten & Rechnen", status: "echt", tab: "rechnen", text: "Trend + Unsicherheitsband aus deinen Zahlen, ohne Claude." },
  { id: "formel", name: "Formel-Labor", gruppe: "Daten & Rechnen", status: "echt", tab: "rechnen", text: "Rechner mit Funktionen, Variablen und Wertetabelle (auch per Sprache: „rechne …“)." },
  { id: "waswaerewenn", name: "Was-wäre-wenn-Labor", gruppe: "Daten & Rechnen", status: "echt", tab: "rechnen", text: "Zahlen-Szenarien mit Monte-Carlo-Simulation vergleichen (plus Text-Variante im Labor)." },
  { id: "simulator", name: "System-Simulator", gruppe: "Daten & Rechnen", status: "echt", tab: "rechnen", text: "Simuliert ein Modell aus Formeln und unsicheren Werten." },
  { id: "modell3d", name: "3D-Objektmodelle analysieren", gruppe: "Daten & Rechnen", status: "echt", tab: "rechnen", text: "STL/OBJ vermessen: Größe, Fläche, Volumen, dicht für den 3D-Druck?" },
  { id: "klauseln", name: "Klausel-Prüfer", gruppe: "Arbeit & Kommunikation", status: "braucht", tab: "labor", text: "Auffällige Klauseln in Verträgen mit Ampel." },
  { id: "meeting", name: "Meeting-Intelligenz", gruppe: "Arbeit & Kommunikation", status: "braucht", tab: "labor", text: "Zusammenfassung + Aufgabenliste (direkt in deine Aufgaben übernehmbar)." },
  { id: "verhandlung", name: "Verhandlungsassistent", gruppe: "Arbeit & Kommunikation", status: "braucht", tab: "labor", text: "Argumente, Einwände, Strategie." },
  { id: "kommunikation", name: "Kommunikationsanalyse", gruppe: "Arbeit & Kommunikation", status: "braucht", tab: "labor", text: "Offene Fragen und fehlende Antworten in Gesprächen." },
  // Kreativ
  { id: "skizze", name: "Skizze → Projektentwurf", gruppe: "Kreativ", status: "braucht", tab: "labor", text: "Foto einer Skizze oder Screenshot → Projektentwurf." },
  { id: "app", name: "App-Prototyp", gruppe: "Kreativ", status: "braucht", tab: "labor", text: "Bildschirme und Funktionen einer App entwerfen; bauen in der Webseiten-Werkstatt." },
  { id: "werkstatt3d", name: "3D-Werkstatt", gruppe: "Kreativ", status: "vorhanden", tab: "werkstatt", text: "Gab es schon: Werkstatt (3D) im Werkzeug-Menü." },
  { id: "raum", name: "3D-Raumplanung", gruppe: "Kreativ", status: "vorhanden", tab: "werkstatt", text: "Gab es schon: Haus-Werkstatt mit Grundrissen, Möbeln und Leitungen." },
  { id: "storyboard", name: "Video-Storyboard", gruppe: "Kreativ", status: "braucht", tab: "labor", text: "Szenen und Drehbuch." },
  { id: "kreativ", name: "Kreativ-Labor", gruppe: "Kreativ", status: "braucht", tab: "labor", text: "Kombiniert Ideen zu neuen Konzepten." },
  // Forschung
  { id: "forschung", name: "Forschungsassistent", gruppe: "Wissenschaft & Forschung", status: "braucht", tab: "labor", text: "Echte Studien aus OpenAlex + Websuche." },
  { id: "studien", name: "Studienvergleich", gruppe: "Wissenschaft & Forschung", status: "braucht", tab: "labor", text: "Methoden und Ergebnisse im Vergleich." },
  { id: "techradar", name: "Technologie-Radar", gruppe: "Wissenschaft & Forschung", status: "braucht", tab: "labor", text: "Live von Hacker News, eingeordnet." },
  { id: "experiment", name: "Experiment-Planer", gruppe: "Wissenschaft & Forschung", status: "braucht", tab: "labor", text: "Kontrollierte Testpläne." },
  // Persönlich
  { id: "entscheidungen", name: "Entscheidungsarchiv", gruppe: "Persönlich", status: "echt", tab: "persoenlich", text: "Entscheidungen mit Gründen speichern und später bewerten." },
  { id: "ziele", name: "Ziel-Navigator", gruppe: "Persönlich", status: "echt", tab: "persoenlich", text: "Langfristige Ziele → konkrete Schritte (mit Claude besser, ohne einfacher Plan)." },
  { id: "gewohnheiten", name: "Gewohnheitsanalyse", gruppe: "Persönlich", status: "echt", tab: "persoenlich", text: "Wann und wofür du Friday nutzt, wiederkehrende Abläufe." },
  { id: "prioritaeten", name: "Prioritäten-Erkennung", gruppe: "Persönlich", status: "echt", tab: "persoenlich", text: "Sortiert offene Aufgaben, Ziel-Schritte und Erinnerungen nach Wichtigkeit." },
  { id: "profil", name: "Persönliches Wissensprofil", gruppe: "Persönlich", status: "echt", tab: "persoenlich", text: "Interessen, Fähigkeiten, Lernziele, Werte." },
  // Zukunft
  { id: "orbit", name: "Interaktive 3D-Oberfläche", gruppe: "Zukunftssysteme", status: "echt", tab: "start", text: "Modul-Orbit: alle Module als drehbare 3D-Kugel." },
  { id: "network", name: "FRIDAY Command Network", gruppe: "Zukunftssysteme", status: "echt", tab: "netzwerk", text: "Alle verbundenen Geräte und Dienste auf einen Blick." },
  { id: "zwilling", name: "Digitales Modell (Zwilling)", gruppe: "Zukunftssysteme", status: "echt", tab: "netzwerk", text: "Live-Modell von Mac, TV, Alexa und Diensten mit Zustand." },
  { id: "umgebungen", name: "Multi-Umgebungs-Steuerung", gruppe: "Zukunftssysteme", status: "echt", tab: "netzwerk", text: "Arbeitsumgebungen (z. B. Arbeit, Abend) mit eigenen Einstellungen speichern und wechseln." },
  { id: "graph", name: "Persönlicher Wissensgraph", gruppe: "Zukunftssysteme", status: "echt", tab: "wissen", text: "Verknüpft Missionen, Ziele, Dokumente, Personen, Wissen." },
  { id: "zeitachse", name: "Digitale Zeitachse", gruppe: "Zukunftssysteme", status: "echt", tab: "wissen", text: "Alle Projekte, Entscheidungen und Updates auf einer Zeitlinie." },
  // System
  { id: "modulsystem", name: "Dynamisches Modulsystem", gruppe: "System", status: "echt", tab: "module", text: "Erkennt neue Module im Ordner und bindet sie über eine feste Schnittstelle ein." },
  { id: "marktplatz", name: "Modul-Marktplatz", gruppe: "System", status: "echt", tab: "module", text: "Eigene und mitgelieferte Erweiterungen installieren, ein-/ausschalten, entfernen." },
  { id: "kompat", name: "Kompatibilitätsprüfung", gruppe: "System", status: "echt", tab: "module", text: "Prüft Version, Rechte und Befehle, bevor ein Modul läuft." },
  { id: "sandbox", name: "Update-Sandbox", gruppe: "System", status: "echt", tab: "sicherheit", text: "Jedes Update wird vorher im Testlabor geprüft; kaputte Updates werden nicht installiert." },
  { id: "testlabor", name: "Virtuelles Testlabor / Testumgebung", gruppe: "System", status: "echt", tab: "sicherheit", text: "Prüft die Software isoliert (Syntax, Dateien, Importe), ohne sie zu starten." },
  { id: "versionen", name: "Versionen & Änderungen", gruppe: "System", status: "vorhanden", tab: "sicherung", text: "Gab es schon: Sicherungen mit Zurückholen + Update-Verlauf im Logbuch." },
];

// ---- Sprachbefehle der Zentrale ----
const norm = (s) => String(s || "").toLowerCase().replace(/[!?]/g, " ").replace(/\s+/g, " ").trim().replace(/^(hey |hallo )?friday,? /, "");

export async function quickCommand(text, channel = "web") {
  const t = norm(text);
  if (!t || t.length > 400) return null;
  // Eigene Module zuerst (nur eingeschaltete)
  const mod = await modulsystem.modulBefehl(text, askFn).catch(() => null);
  if (mod) return mod;
  // Formel-Labor: "rechne 2^10 + 5", "was ist sqrt(2) mal pi"
  const r = t.match(/^(?:rechne|berechne|formel)\s*:?\s*(.+)$/);
  if (r && /[\d)]/.test(r[1])) {
    const f = r[1].replace(/\bmal\b/g, "*").replace(/\bgeteilt durch\b/g, "/").replace(/\bplus\b/g, "+").replace(/\bminus\b/g, "-").replace(/\bhoch\b/g, "^").replace(/\bwurzel aus\b\s*([\d.,]+)/g, "sqrt($1)").replace(/(\d),(\d)/g, "$1.$2").replace(/\.$/, "");
    try {
      const v = rechen.formelLabor({ formel: f });
      if (!v.error) return { answer: `Das ergibt ${String(v.ergebnis).replace(".", ",")}.`, actions: ["rechnen"] };
    } catch { /* weiter an Claude */ }
  }
  // Prioritäten: "was ist am wichtigsten", "was soll ich zuerst machen"
  if (/^(was ist (heute )?(am )?wichtigst|was soll ich (heute )?zuerst|meine prioritäten|was ist dringend)/.test(t)) {
    const p = persoenlich.prioritaeten();
    if (!p.length) return { answer: `Du hast gerade keine offenen Aufgaben, Ziel-Schritte oder Erinnerungen. Freie Bahn, ${config.userName}.`, actions: ["zentrale:persoenlich"] };
    const hoch = p.filter((x) => x.prio === 1);
    const liste = (hoch.length ? hoch : p).slice(0, 3).map((x) => x.text);
    return { answer: `${hoch.length ? "Am wichtigsten" : "Nichts ist wirklich dringend. Als Nächstes"}: ${liste.join(", dann ")}.`, actions: ["zentrale:persoenlich"] };
  }
  // Mission anlegen: "neue mission: …", "starte eine mission …"
  const m = t.match(/^(?:neue|starte (?:eine )?|leg (?:eine )?)?mission(?: an)?\s*:?\s+(.{6,})$/);
  if (m) {
    const res = await missionen.neu({ ziel: m[1] });
    if (res.error) return { answer: res.error, actions: [] };
    return { answer: `Mission „${res.mission.titel}“ ist angelegt, mit ${res.mission.schritte.length} Schritten und Priorität ${missionen.PRIO[res.mission.prioritaet]}. ${kommando.stand().autonomie === 0 ? "Bei Autonomie „Nur Vorschläge“ startest du jeden Schritt selbst." : "Ich arbeite sie in der Warteschlange ab."}`, actions: ["zentrale:missionen"] };
  }
  if (/^(wie läuft|status) (meine |die )?mission(en)?$|^missionen?( status)?$/.test(t)) {
    const z = missionen.zaehler();
    return { answer: `${z.aktiv} Missionen laufen oder warten, ${z.fertig} sind fertig${z.probleme ? `, ${z.probleme} brauchen dich` : ""}.`, actions: ["zentrale:missionen"] };
  }
  if (/^(öffne |zeig( mir)? )?(die |meine )?(zeitachse|zeitlinie)/.test(t)) return { answer: "Hier ist deine Zeitachse.", actions: ["zentrale:wissen"] };
  if (/^(öffne |zeig( mir)? )?(den |meinen )?wissensgraph/.test(t)) return { answer: "Das ist dein Wissensgraph.", actions: ["zentrale:wissen"] };
  if (/^(öffne |zeig( mir)? )?(das |mein )?(command network|netzwerk|geräte ?netz|alle geräte)/.test(t)) return { answer: "Das ist dein Command Network.", actions: ["zentrale:netzwerk"] };
  if (/^(öffne |zeig( mir)? )?(das )?(denk ?labor|labor)$/.test(t)) return { answer: "Das Denk-Labor ist offen.", actions: ["zentrale:labor"] };
  if (/^(öffne |zeig( mir)? )?(den )?(modul ?marktplatz|marktplatz|module)$/.test(t)) return { answer: "Hier sind deine Module.", actions: ["zentrale:module"] };
  if (/^(prüf|pruef|scanne?)\w* (auf )?(datenleck|datenlecks|sicherheit)/.test(t)) {
    const s = await waechter.datenleckScan();
    return { answer: s.funde.length ? `Ich habe ${s.funde.length} Hinweise gefunden. Der wichtigste: ${s.funde[0].was}. Details stehen in der Modul-Zentrale unter Sicherheit.` : "Alles sauber. Keine offenen Schlüssel und die Dateirechte passen.", actions: ["zentrale:sicherheit"] };
  }
  return null;
}

export function zentraleStart(ask) {
  askFn = ask;
  missionen.missionenStart(ask);
  automationen.automationenStart(ask);
  setTimeout(() => { try { modulsystem.installierte(); } catch { /* egal */ } }, 5000); // neue Module erkennen
}

// ---- Wege fürs Dashboard ----
export function zentraleRouten(app, asyncRoute) {
  const ok = (res, r) => res.status(r?.error ? 400 : 200).json(r);
  // Übersicht
  app.get("/api/zentrale", (req, res) => {
    const k = kommando.stand();
    res.json({
      module: MODULE,
      kontrolle: { autonomie: k.autonomie, stufe: k.stufe, notfall: k.notfall, offen: k.offen.length },
      missionen: missionen.zaehler(),
      eigene: modulsystem.installierte().map((m) => ({ id: m.id, name: m.name, an: m.an, ok: m.pruefung.ok, neu: m.neu })),
      tempo: getSettings().tempo,
      routing: Object.fromEntries(["leicht", "mittel", "schwer"].map((s) => [s, { ...MODELLE[s], aktuell: waehleModell(s).model }])),
    });
  });
  // Kontrolle
  app.get("/api/zentrale/kontrolle", (req, res) => res.json(kommando.stand()));
  app.post("/api/zentrale/autonomie", (req, res) => ok(res, kommando.setzeAutonomie(req.body?.stufe)));
  app.post("/api/zentrale/notfall", (req, res) => res.json(req.body?.an ? kommando.notfallAn(String(req.body?.grund || "Notfall-Knopf im Dashboard")) : kommando.notfallAus()));
  app.post("/api/zentrale/recht", (req, res) => ok(res, kommando.setzeRecht(String(req.body?.nutzer), String(req.body?.daten), Boolean(req.body?.an))));
  app.post("/api/zentrale/freigabe/:id", asyncRoute(async (req, res) => {
    const ja = Boolean(req.body?.ja);
    const r = await kommando.entscheide(req.params.id, ja, (w, e) => runTool(w, e, { quelle: "freigabe", kanal: "freigabe" }));
    if (!r.error && r.g?.kanal === "mission") missionen.nachFreigabe(r.g, ja, r.ergebnis);
    ok(res, r);
  }));
  // Missionen
  app.get("/api/zentrale/missionen", (req, res) => res.json(missionen.liste()));
  app.post("/api/zentrale/missionen", asyncRoute(async (req, res) => ok(res, await missionen.neu(req.body || {}))));
  app.post("/api/zentrale/missionen/:id", (req, res) => ok(res, missionen.aendern(req.params.id, req.body || {})));
  app.post("/api/zentrale/missionen/:id/:aktion", asyncRoute(async (req, res) => ok(res, await missionen.steuern(req.params.id, req.params.aktion))));
  app.post("/api/zentrale/prioritaet", (req, res) => res.json(missionen.erkennePrioritaet(String(req.body?.text || ""))));
  // Automationen
  app.get("/api/zentrale/automationen", (req, res) => res.json(automationen.liste()));
  app.post("/api/zentrale/automationen", (req, res) => ok(res, automationen.speichereRegel(req.body || {})));
  app.post("/api/zentrale/automationen/:id/an", (req, res) => ok(res, automationen.schalten(req.params.id, Boolean(req.body?.an))));
  app.post("/api/zentrale/automationen/:id/jetzt", asyncRoute(async (req, res) => ok(res, await automationen.jetztAusfuehren(req.params.id))));
  app.delete("/api/zentrale/automationen/:id", (req, res) => res.json(automationen.loeschen(req.params.id)));
  // Persönlich
  app.get("/api/zentrale/persoenlich", (req, res) => res.json({
    ziele: persoenlich.ziele().map((z) => ({ ...z, fortschritt: persoenlich.fortschritt(z) })),
    entscheidungen: persoenlich.entscheidungen(),
    bilanz: persoenlich.entscheidungsBilanz(),
    profil: persoenlich.profil(),
    prioritaeten: persoenlich.prioritaeten(),
  }));
  app.get("/api/zentrale/gewohnheiten", (req, res) => res.json(persoenlich.gewohnheiten({ tage: Math.min(365, Number(req.query.tage) || 30) })));
  app.post("/api/zentrale/ziele", asyncRoute(async (req, res) => ok(res, await persoenlich.zielAnlegen(req.body || {}))));
  app.post("/api/zentrale/ziele/:id", (req, res) => ok(res, persoenlich.zielAendern(req.params.id, req.body || {})));
  app.post("/api/zentrale/entscheidungen", (req, res) => ok(res, persoenlich.entscheidungSpeichern(req.body || {})));
  app.delete("/api/zentrale/entscheidungen/:id", (req, res) => res.json(persoenlich.entscheidungLoeschen(req.params.id)));
  app.post("/api/zentrale/profil", (req, res) => res.json(persoenlich.profilSpeichern(req.body || {})));
  // Labor
  app.get("/api/zentrale/labor", (req, res) => res.json(labor.vorlagen()));
  app.post("/api/zentrale/labor", asyncRoute(async (req, res) => {
    const b = req.body || {};
    const image = b.image?.data && /^image\/(png|jpe?g|webp|gif)$/.test(b.image.mediaType || "") ? { data: String(b.image.data), mediaType: b.image.mediaType } : null;
    ok(res, await labor.ausfuehren({ vorlage: String(b.vorlage || ""), text: String(b.text || ""), image, selbstpruefung: Boolean(b.selbstpruefung), speichern: Boolean(b.speichern), modell: ["auto", "leicht", "mittel", "schwer"].includes(b.modell) ? b.modell : "auto" }));
  }));
  app.post("/api/zentrale/labor/aufgaben", (req, res) => {
    const liste = (Array.isArray(req.body?.aufgaben) ? req.body.aufgaben : []).map((x) => String(x).slice(0, 200)).filter(Boolean).slice(0, 20);
    liste.forEach((a) => store.addTask(a));
    res.json({ ok: true, angelegt: liste.length });
  });
  // Rechnen
  app.post("/api/zentrale/rechnen/formel", (req, res) => ok(res, rechen.formelLabor(req.body || {})));
  app.post("/api/zentrale/rechnen/prognose", (req, res) => ok(res, rechen.prognose(req.body || {})));
  app.post("/api/zentrale/rechnen/simulation", (req, res) => { try { ok(res, rechen.simuliere(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); } });
  app.post("/api/zentrale/rechnen/modell3d", (req, res) => ok(res, rechen.analysiereModell(req.body || {})));
  // Sicherheit
  app.post("/api/zentrale/sicherheit/text", (req, res) => res.json(waechter.pruefeText(String(req.body?.text || "").slice(0, 200000))));
  app.post("/api/zentrale/sicherheit/datenleck", asyncRoute(async (req, res) => res.json(await waechter.datenleckScan())));
  app.post("/api/zentrale/sicherheit/reparieren", (req, res) => ok(res, waechter.reparieren(String(req.body?.was || ""))));
  app.post("/api/zentrale/sicherheit/selbsttest", (req, res) => res.json(modulsystem.selbstTest()));
  app.post("/api/zentrale/sicherheit/updatetest", asyncRoute(async (req, res) => res.json(await modulsystem.updateTesten())));
  app.get("/api/zentrale/sicherheit/updatetest", (req, res) => res.json(modulsystem.letzterUpdateTest() || {}));
  // Module
  app.get("/api/zentrale/module", (req, res) => res.json({ installiert: modulsystem.installierte(), katalog: modulsystem.katalog(), rechte: modulsystem.RECHTE }));
  app.post("/api/zentrale/module/pruefen", (req, res) => {
    let m = req.body?.modul;
    if (typeof m === "string") { try { m = JSON.parse(m); } catch (err) { return res.json({ ok: false, fehler: [`Kein gültiges JSON: ${err.message}`], warnungen: [] }); } }
    res.json(modulsystem.pruefeModul(m, { andere: modulsystem.installierte() }));
  });
  app.post("/api/zentrale/module", (req, res) => ok(res, req.body?.katalog ? modulsystem.ausKatalog(String(req.body.katalog)) : modulsystem.installiere(req.body?.modul)));
  app.post("/api/zentrale/module/:id/an", (req, res) => ok(res, modulsystem.schalte(req.params.id, Boolean(req.body?.an))));
  app.delete("/api/zentrale/module/:id", (req, res) => ok(res, modulsystem.entferne(req.params.id)));
  // Netzwerk & Wissen
  app.get("/api/zentrale/netzwerk", asyncRoute(async (req, res) => res.json(await netzwerk.geraete())));
  app.get("/api/zentrale/zeitachse", (req, res) => res.json(netzwerk.zeitachse({ tage: Math.min(730, Number(req.query.tage) || 90) })));
  app.get("/api/zentrale/wissensgraph", (req, res) => res.json(netzwerk.wissensgraph()));
}
