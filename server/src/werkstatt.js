// Fridays Werkstatt: Claude entwirft aus einem Wunsch ("ein Porsche", "ein Wohnhaus mit 12 Etagen")
// einen 3D-Bauplan aus einfachen Teilen, den das Dashboard Schritt für Schritt als Hologramm aufbaut.
import { eintragen } from "./logbuch.js";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { recordUsage, isCreditError, markEmpty, brainModel, SPAR_MODELL, getEnergie } from "./energie.js";
import { getSettings } from "./einstellungen.js";
import { isHausWunsch, isHausBefehl, planHouse } from "./haus.js";
import { erkenneArt, erkenneFarbe, baueVorlage, istVorlagenBefehl, masseAusKennzahlen } from "./bauvorlagen.js";
import { findeLokal, holeModell, sketchfabToken, suchwort } from "./modelle.js";
import { findeAuto, istStudioBefehl, studioPlan } from "./autostudio.js";

const client = new Anthropic({ apiKey: config.anthropicKey });

const FARBEN = ["cyan", "weiss", "rot", "orange", "gelb", "gruen", "blau", "lila", "grau", "schwarz", "glas", "chrom"];
const point = { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 };
const TEIL = {
  type: "object",
  properties: {
    name: { type: "string", description: "Kurzer Name des Bauteils, z. B. 'Singleframe-Grill' oder 'Hinterrad links'. Erscheint nur beim Antippen." },
    form: { type: "string", enum: ["profil", "flaeche", "box", "zylinder", "kugel", "rohr"], description: "profil: Seitenansicht als Umriss (punkte2d [x, y]), in der Breite ausgezogen – für Karosserie, Kabine, Leitwerk; flaeche: Draufsicht als Umriss (punkte2d [x, z] relativ zu pos), dicke in y – für Tragflächen, Schiffsrumpf, Deck; box: Quader; zylinder: Rad, Rumpf, Säule, Tank, Kegel; kugel (mit skala auch Ellipsoid, z. B. Cockpithaube); rohr: Leitung/Kabel/Stange entlang punkte" },
    pos: { ...point, description: "Mittelpunkt [x, y, z] in Metern. y ist oben, Boden y=0, Objekt mittig um x=0, z=0, Länge auf x (vorne = +x). profil: nur pos[2] zählt (Mitte in der Breite), die Umriss-Punkte sind schon absolut." },
    groesse: { ...point, description: "box: [Länge x, Höhe y, Breite z] in Metern" },
    punkte2d: { type: "array", items: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 }, description: "profil: 8 bis 30 Umriss-Punkte [x, y] in Metern (Seitenansicht, absolut); flaeche: Punkte [x, z] (Draufsicht, relativ zu pos). Ohne Wiederholung des Startpunkts" },
    skala: { ...point, description: "optionale Streckung [x, y, z], z. B. kugel mit [3, 1, 1] als längliche Haube" },
    breite: { type: "number", description: "profil: Breite in z (Meter)" },
    rundung: { type: "number", description: "profil/box: Kantenrundung in Metern (0 bis 0.12)" },
    radius: { type: "number" },
    radius2: { type: "number", description: "zylinder: anderer Radius am oberen Ende (für Kegel, Düsen, Nasen)" },
    hoehe: { type: "number", description: "zylinder: Länge entlang der achse" },
    achse: { type: "string", enum: ["x", "y", "z"], description: "zylinder: Richtung der Längsachse (Rad: z)" },
    drehung: { ...point, description: "optionale Drehung [x, y, z] in Grad" },
    punkte: { type: "array", items: point, description: "rohr: Eckpunkte der Leitung" },
    dicke: { type: "number", description: "rohr: Durchmesser; flaeche: Dicke in y (Meter)" },
    farbe: { type: "string", enum: FARBEN },
  },
  required: ["form", "farbe"],
};
const BAUPLAN_TOOL = {
  name: "bauplan",
  description: "Gibt den 3D-Bauplan zurück.",
  input_schema: {
    type: "object",
    properties: {
      titel: { type: "string", description: "Genaue Bezeichnung, z. B. 'Audi A4 Limousine (B9)'" },
      einleitung: { type: "string", description: "Wird ZUERST vorgelesen, 1 bis 2 Sätze: was gebaut wird und was es besonders macht, z. B. 'Sehr gern, Chef. Ein Audi A4, die Mittelklasse-Limousine aus Ingolstadt, gebaut seit 2015.'" },
      steckbrief: {
        type: "object",
        description: "Infokarte. Echte Angaben; nur wenn wirklich unbekannt: '–'.",
        properties: {
          typ: { type: "string", description: "Hersteller und Art, z. B. 'Audi · Mittelklasse-Limousine'" },
          baujahr: { type: "string", description: "Bauzeit oder Baujahr, z. B. '2015–2024'" },
          preis: { type: "string", description: "Neupreis bzw. Kosten, z. B. 'ab ca. 41.000 € (2023)'" },
          kurz: { type: "string", description: "Ein Satz, was es besonders macht (max. 120 Zeichen)" },
        },
        required: ["typ", "baujahr", "preis", "kurz"],
      },
      kennzahlen: { type: "array", items: { type: "object", properties: { label: { type: "string" }, wert: { type: "string" } }, required: ["label", "wert"] }, description: "6 bis 10 echte Eckdaten mit Einheit (Maße, Leistung, Gewicht, Verbrauch …)" },
      schritte: {
        type: "array",
        description: "4 bis 7 Bauabschnitte. Zuerst die äußere Form (sofort erkennbar), danach Details, zuletzt Technik.",
        items: {
          type: "object",
          properties: {
            status: { type: "string", description: "Nur der Name des Abschnitts, 1 bis 3 Wörter, z. B. 'Karosserie', 'Räder', 'Lichter', 'Antrieb'" },
            sagen: { type: "string", description: "Was Friday vorliest, während dieser Abschnitt erscheint: 2 bis 3 gesprochene Sätze, die die Bauteile wie ein Ingenieur erklären, mit echten Zahlen. Z. B. 'Das ist der Motor: ein Zwei-Liter-Vierzylinder mit Turbo und 204 PS. Dahinter sitzt das Siebengang-Getriebe, das die Kraft an die Vorderräder bringt.' Zahlen so schreiben, wie man sie spricht. Kein Markdown." },
            teile: { type: "array", items: TEIL },
          },
          required: ["status", "sagen", "teile"],
        },
      },
      fazit: { type: "string", description: "Wird zum Schluss vorgelesen, 1 bis 2 Sätze, z. B. 'So, Chef. Fertig: viereinhalb Meter Audi, 204 PS, null auf hundert in 7,3 Sekunden.'" },
    },
    required: ["titel", "einleitung", "steckbrief", "kennzahlen", "schritte", "fazit"],
  },
};

const SYSTEM = `Du bist die Werkstatt von F.R.Ai.D.A.Y. Du baust aus einem Wunsch ein möglichst originalgetreues 3D-Modell aus einfachen Teilen. Man soll das Vorbild auf den ersten Blick erkennen.

Koordinaten: Meter, echte Maße des Originals. y oben, Boden y=0, Objekt mittig auf x=0, z=0, Länge auf der x-Achse, vorne = +x, Breite auf z.

So wird es genau:
- Die äußere Form IMMER mit "profil" bauen: Seitenansicht als Umriss mit 12 bis 30 Punkten, die die echte Silhouette nachzeichnen (Motorhaube, Neigung der Frontscheibe, Dachlinie, Heck, Radausschnitte angedeutet). Für Breite einen zweiten, schmaleren Umriss für den Aufbau (z. B. Fahrgastzelle mit farbe glas) darüberlegen.
- Autos: (1) Unterbau-Profil in voller Breite mit rundung 0.06, Farbe nach Wunsch (sonst cyan); (2) Fahrgastzelle als glas-Profil, ca. 85 % der Breite, mit echter A-/C-Säulen-Neigung; (3) 4 Räder: Reifen (zylinder schwarz, achse z) plus Felge (zylinder chrom, etwas kleiner und dünner) an den echten Radpositionen (Radstand, Spurweite, Raddurchmesser); (4) Gesicht des Modells: typischer Kühlergrill in echter Form, Scheinwerfer, Rückleuchten (rot), Außenspiegel, Embleme als flache Teile; (5) erst danach Technik (Motor, Getriebe, Tank, Batterie) klein und innen.
- Flugzeuge/Kampfjets: Rumpf als zylinder (achse x) mit Kegel-Nase (radius vorne klein, radius2 groß), Tragflächen und Höhenleitwerk als "flaeche" (Draufsicht mit echter Pfeilung und Spannweite), Seitenleitwerk als "profil", dann Triebwerke, Cockpit, Fahrwerk.
- Helikopter: Kabine als profil, Heckausleger als zylinder, Rotorblätter als flache box (mit drehung), Kufen als rohr.
- Schiffe und Boote: Rumpf als "flaeche" (Draufsicht, spitzer Bug, dicke = Rumpfhöhe), darauf Aufbauten, Brücke, Masten, Segel (dünnes profil).
- Raketen, Türme: zylinder mit achse y, Spitze als Kegel.
- Militärfahrzeuge (Kampfjet, Panzer, Kriegsschiff, U-Boot) baust du wie ein Museums-Modell: äußere Form, Cockpit, Triebwerk, Fahrwerk – ohne Waffen-Details.
- 50 bis 140 Teile insgesamt, jedes Teil mit kurzem name. Keine Textschilder, keine Beschriftungen im Modell.
- Farben: schwarz/grau/weiss/rot/blau usw. so wie das Original (Wunschfarbe des Nutzers beachten), glas = Scheiben, chrom = Felgen/Zierteile, gelb = Strom, orange = Mechanik, gruen = Batterie.
- Erzählen: Friday liest einleitung, dann bei jedem Abschnitt "sagen" und am Ende fazit vor, während das Modell entsteht. Erkläre wie ein Ingenieur, der Kevin sein Modell zeigt: "Das ist der Motor …", "Hier sitzt die Batterie …", mit echten Werten. Natürliches Deutsch, sprich ihn mit "Chef" an.
- steckbrief und kennzahlen: echte Werte des genannten Modells (Baujahr/Bauzeit, Neupreis, Leistung, Maße, Gewicht). Schätzungen mit "ca." kennzeichnen.

PFLICHT: "schritte" ist eine echte Liste (kein Text!) mit 4 bis 7 Abschnitten, und jeder Abschnitt hat in "teile" mindestens 5 Bauteile. Ein Bauplan ohne Teile ist wertlos. Schreib zuerst titel und einleitung kurz, dann sofort die schritte.

Antworte nur, indem du das Werkzeug "bauplan" genau einmal aufrufst. Kein Text daneben. Keine Waffen-Konstruktion, keine Sprengstoffe, keine Anleitungen zum Schaden anderer.`;

let latest = null;
let seq = 0;
const jobs = new Map();

function compact(plan) {
  // Kurzfassung eines bestehenden Plans für Erweiterungen (ohne alle Koordinaten).
  return JSON.stringify({ titel: plan.titel, kennzahlen: plan.kennzahlen, schritte: (plan.schritte || []).map((s) => s.status || s.sagen) });
}

function neuerJob(wunsch, erweiterung) {
  seq += 1;
  const job = { id: seq, planNr: 1, wunsch, erweiterung, status: "plant", plan: { titel: "", kennzahlen: [], schritte: [] }, zeit: new Date().toISOString(), start: Date.now() };
  jobs.set(job.id, job);
  for (const id of jobs.keys()) if (id < seq - 10) jobs.delete(id);
  latest = job;
  return job;
}

// Wohnhäuser entwirft Friday selbst (ohne Claude): Grundrisse, Möbel und alle Leitungen.
function planHaus(text) {
  const plan = planHouse(text);
  const job = neuerJob(text, false);
  Object.assign(job, { plan, status: "fertig", ohneClaude: true });
  eintragen({ bereich: "haus", titel: `Haus entworfen: ${plan.titel || text}`, details: `Wunsch: ${text}${eckdaten(plan)}` });
  return { ok: true, ...job };
}

// Fahrzeuge & Co. aus Fridays Vorlagen (server/src/bauvorlagen.js) – ohne Claude, sofort fertig.
function planVorlage(text, art, opt = {}, grund = "") {
  const plan = baueVorlage(art, opt);
  const job = neuerJob(text, false);
  Object.assign(job, { plan, status: "fertig", ohneClaude: true, vorlage: art, ...(grund ? { hinweis: grund } : {}) });
  eintragen({ bereich: "werkstatt", titel: `Vorlage gebaut: ${plan.titel}`, details: `Wunsch: ${text}${eckdaten(plan)}${grund ? ` · ${grund}` : ""}` });
  return { ok: true, ...job };
}

// v1.136.0 Auto-Studio: Autos aus Fridays Datenbank (server/src/autostudio.js) im hellen Studio.
// Einzelnes Auto: gibt es ein echtes 3D-Modell (eigene Bibliothek oder Sketchfab-Schlüssel), zeigt das Studio
// zuerst Fridays eigenes Modell und tauscht es gegen das echte, sobald es geladen ist.
const modellInfo = (m, laenge) => ({ id: m.id, name: m.name, autor: m.autor || "", lizenz: m.lizenz || "", link: m.link || "", quelle: m.quelle || "", laenge });
function planStudio(text, treffer) {
  const plan = studioPlan(treffer, erkenneFarbe(text));
  const job = neuerJob(text, false);
  Object.assign(job, { plan, status: "fertig", ohneClaude: true, studio: true });
  eintragen({ bereich: "werkstatt", titel: `Auto-Studio: ${plan.titel}`, details: `Wunsch: ${text}${eckdaten(plan)}` });
  if (treffer.art === "modell") {
    const suche = `${treffer.marke.marke} ${treffer.modell.name}`;
    const lokal = findeLokal(suche);
    if (lokal) plan.studio.datei = modellInfo(lokal, treffer.modell.laenge);
    else if (sketchfabToken()) {
      job.status = "baut";
      plan.studio.wartet = true;
      holeModell(suche, { art: erkenneArt(suche) || "sportwagen", titel: suche })
        .then((m) => { if (m) plan.studio.datei = modellInfo(m, treffer.modell.laenge); })
        .catch(() => {})
        .finally(() => { plan.studio.wartet = false; job.status = "fertig"; job.planNr += 1; });
    }
  }
  return { ok: true, ...job };
}

// Sprachbefehl "Friday, bau mir ein Mehrfamilienhaus" oder "bau mir einen Kampfjet" – sofort und ohne Guthaben.
export function quickCommand(text) {
  if (isHausBefehl(text)) {
    const r = planHaus(String(text).trim().slice(0, 1000));
    return { answer: "Einen Moment, Chef.", actions: ["werkstatt"], titel: r.plan.titel };
  }
  // v1.136.0: "Friday, zeig mir die BMW-M-Modelle" / "bau mir einen RS 6" → Auto-Studio, ohne Claude.
  const auto = istStudioBefehl(text);
  if (auto) {
    const r = planStudio(String(text).trim().slice(0, 1000), auto);
    return { answer: "Einen Moment, Chef.", actions: ["werkstatt"], titel: r.plan.titel };
  }
  if (!istVorlagenBefehl(text)) return null;
  const r = startBuild(String(text).trim().slice(0, 1000)); // echtes Modell, falls vorhanden – sonst Vorlage
  if (!r.ok) return null;
  return { answer: "Einen Moment, Chef.", actions: ["werkstatt"], titel: r.plan?.titel || "" };
}

// Fürs Logbuch: die ersten Eckdaten als kurzer Text ("Wohnfläche: ca. 420 m², …").
function eckdaten(plan) {
  const k = Array.isArray(plan?.kennzahlen) ? plan.kennzahlen : [];
  return k.length ? ` · ${k.slice(0, 5).map((x) => `${x.label}: ${x.wert}`).join(", ")}` : "";
}

// Ein Bauabschnitt aus Claude: Textschilder raus (Kevin will keine Beschriftungs-Flut), Teile prüfen.
// v1.124.0: Claude schickt verschachtelte Listen manchmal als Text ("[{...}]") oder Zahlen als "1,2" –
// das wird jetzt aufgeräumt statt verworfen (Ursache für "Der Bauplan war leer.").
const istZahl = (v) => typeof v === "number" && Number.isFinite(v);
function ausText(v) {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!/^[[{]/.test(t)) return v;
  try { return JSON.parse(t); } catch { return v; }
}
const zahl = (v) => (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v.replace(",", "."))) ? Number(v.replace(",", ".")) : v);
const zahlen = (a) => (Array.isArray(a) ? a.map((x) => (Array.isArray(x) ? zahlen(x) : zahl(x))) : a);
const FORMEN = { quader: "box", wuerfel: "box", würfel: "box", cube: "box", cylinder: "zylinder", sphere: "kugel", tube: "rohr", leitung: "rohr", profile: "profil", flaech: "flaeche", fläche: "flaeche", plane: "flaeche", kegel: "zylinder", cone: "zylinder" };
function teilAufraeumen(roh) {
  const t = ausText(roh);
  if (!t || typeof t !== "object" || Array.isArray(t)) return null;
  const x = { ...t };
  x.form = String(x.form || "").toLowerCase().trim();
  x.form = FORMEN[x.form] || x.form;
  for (const k of ["pos", "groesse", "punkte2d", "punkte", "drehung", "skala"]) if (x[k] !== undefined) x[k] = zahlen(ausText(x[k]));
  for (const k of ["radius", "radius2", "hoehe", "breite", "rundung", "dicke"]) if (x[k] !== undefined) x[k] = zahl(x[k]);
  if (x.form === "zylinder" && (roh?.form === "kegel" || roh?.form === "cone") && x.radius2 === undefined) x.radius2 = 0;
  if (typeof x.farbe === "string") x.farbe = x.farbe.toLowerCase().replace("ß", "ss").replace("ü", "ue");
  return x;
}
function teilOk(t) {
  if (!t || typeof t !== "object" || !t.form || t.form === "text") return false;
  if (t.form === "profil" || t.form === "flaeche") return Array.isArray(t.punkte2d) && t.punkte2d.filter((q) => Array.isArray(q) && istZahl(q[0]) && istZahl(q[1])).length >= 3;
  if (t.form === "rohr") return Array.isArray(t.punkte) && t.punkte.length >= 2 && t.punkte.every((q) => Array.isArray(q) && q.length === 3 && q.every(istZahl));
  if (!["box", "zylinder", "kugel"].includes(t.form)) return false;
  return !t.pos || (Array.isArray(t.pos) && t.pos.length === 3 && t.pos.every(istZahl));
}
function saeubereSchritt(roh) {
  const s = ausText(roh) || {};
  const status = String(s?.status || s?.name || s?.sagen || "").trim().slice(0, 40);
  const sagen = String(s?.sagen || "").trim().slice(0, 600);
  const teile = ausText(s?.teile ?? s?.bauteile);
  return { status, sagen, teile: (Array.isArray(teile) ? teile : []).map(teilAufraeumen).filter(teilOk).slice(0, 160) };
}

// Aus dem halbfertigen Werkzeug-Aufruf alles übernehmen, was schon sicher fertig ist:
// ein Bauabschnitt gilt als fertig, sobald der nächste begonnen hat.
function uebernimm(job, roh, alles = false) {
  if (!roh || typeof roh !== "object") return;
  if (typeof roh.titel === "string") job.plan.titel = roh.titel;
  // Die Einleitung erst übernehmen, wenn sie fertig geschrieben ist (danach kommt der Steckbrief).
  if (typeof roh.einleitung === "string" && (alles || roh.steckbrief)) job.plan.einleitung = roh.einleitung.slice(0, 400);
  if (typeof roh.fazit === "string" && alles) job.plan.fazit = roh.fazit.slice(0, 400);
  const sb = ausText(roh.steckbrief);
  if (sb && typeof sb === "object") job.plan.steckbrief = { ...sb };
  const kz = ausText(roh.kennzahlen);
  if (Array.isArray(kz)) job.plan.kennzahlen = kz.filter((k) => k && k.label && k.wert);
  const schRoh = ausText(roh.schritte);
  const sch = Array.isArray(schRoh) ? schRoh : [];
  const fertig = alles ? sch.length : Math.max(0, sch.length - 1);
  if (alles) {
    // Zum Schluss alles noch einmal sauber lesen: war ein Abschnitt beim Streamen leer (z. B. als Text
    // geschickt) und ist jetzt voll, wird der Plan neu gesetzt und das Dashboard baut von vorn.
    const frisch = sch.map(saeubereSchritt);
    if (job.plan.schritte.some((s, i) => !s.teile.length && frisch[i]?.teile.length)) { job.plan.schritte = frisch; job.planNr = (job.planNr || 1) + 1; }
  }
  while (job.plan.schritte.length < fertig) {
    const s = saeubereSchritt(sch[job.plan.schritte.length]);
    job.plan.schritte.push(s); // auch leere bleiben als Platzhalter, damit die Zählung stimmt
  }
  if (job.plan.schritte.length && job.status === "plant") job.status = "baut";
}

/**
 * Startet einen Bau und kommt SOFORT zurück. Das Dashboard holt die Abschnitte über
 * GET /api/werkstatt/job/:id, sobald Claude sie geschrieben hat (Streaming).
 */
export function startBuild(wunsch, basis = null) {
  const text = String(wunsch || "").trim().slice(0, 1000);
  if (!text) return { ok: false, error: "Was soll ich bauen, Chef?" };
  if (!basis && isHausWunsch(text)) return planHaus(text);
  if (!basis) { const auto = findeAuto(text); if (auto) return planStudio(text, auto); }
  const art = erkenneArt(text);
  const optAusText = { farbe: erkenneFarbe(text), elektro: /elektro|e-auto|tesla|taycan|e-tron|\bid\.? ?[3-7]\b/i.test(text) };
  // v1.125.0: Echte 3D-Modelle zuerst – aus der eigenen Bibliothek oder (mit Schlüssel) frisch von Sketchfab.
  if (!basis) {
    const lokal = findeLokal(text);
    if (lokal) return planModell(text, lokal, art);
    if (sketchfabToken()) return planSketchfab(text, art, optAusText);
  }
  // Ein schlichtes "bau mir einen Kampfjet" braucht kein Claude: die Vorlage ist sofort da.
  if (!basis && istVorlagenBefehl(text)) return planVorlage(text, art, optAusText);
  if (!config.anthropicKey) {
    if (!basis && art) return planVorlage(text, art, optAusText, "Ohne Claude-Schlüssel: Fridays Vorlage.");
    return { ok: false, error: "Ohne Claude-Schlüssel kann die Werkstatt nichts entwerfen." };
  }
  if (getEnergie().zustand === "leer") {
    if (!basis && art) return planVorlage(text, art, optAusText, "Claude-Guthaben leer: Fridays Vorlage.");
    return { ok: false, error: "Dein Claude-Guthaben ist leer, Chef. Lade es auf console.anthropic.com auf, dann baue ich wieder." };
  }
  const job = neuerJob(text, Boolean(basis));
  bauen(job, basis).catch((err) => {
    job.status = "fehler";
    job.error = String(err?.message || err).slice(0, 300);
  }).finally(() => {
    job.dauer_ms = Date.now() - job.start;
    eintragen(job.status === "fertig"
      ? { bereich: "werkstatt", titel: `${job.erweiterung ? "Modell ergänzt" : "3D-Modell entworfen"}: ${job.plan.titel || job.wunsch}`, details: `Wunsch: ${job.wunsch}${eckdaten(job.plan)} · ${Math.round(job.dauer_ms / 1000)} s`, claude: true, dauer_ms: job.dauer_ms }
      : { bereich: "werkstatt", titel: `Werkstatt: ${job.wunsch.slice(0, 120)}`, details: job.error, ok: false });
  });
  return { ok: true, ...job };
}

// ---------- Echte Modelle ----------
const INFO_TOOL = {
  name: "steckbrief",
  description: "Gibt Infokarte und Ansagen zu einem Fahrzeug/Objekt zurück.",
  input_schema: {
    type: "object",
    properties: {
      titel: BAUPLAN_TOOL.input_schema.properties.titel,
      einleitung: BAUPLAN_TOOL.input_schema.properties.einleitung,
      steckbrief: BAUPLAN_TOOL.input_schema.properties.steckbrief,
      kennzahlen: BAUPLAN_TOOL.input_schema.properties.kennzahlen,
      laenge_m: { type: "number", description: "Echte Gesamtlänge in Metern (bei Raketen/Türmen: Höhe)" },
      fazit: { type: "string", description: "1 Satz zum Schluss, mit einer echten Zahl, z. B. 'So, Chef: 610 PS, null auf hundert in 3,2 Sekunden.'" },
    },
    required: ["titel", "einleitung", "steckbrief", "kennzahlen", "laenge_m", "fazit"],
  },
};

// Infokarte (Baujahr, Preis, Eckdaten) zum Modell – schnell und günstig, notfalls ohne.
async function infoHolen(text) {
  if (!config.anthropicKey || getEnergie().zustand === "leer") return null;
  try {
    const model = brainModel("claude-haiku-5-5");
    const msg = await client.messages.create({
      model, max_tokens: 1500,
      system: "Du bist die Werkstatt von F.R.Ai.D.A.Y. Zum Wunsch lieferst du echte Daten für die Infokarte über das Werkzeug \"steckbrief\" (genau einmal, kein Text daneben). Natürliches Deutsch, sprich Kevin mit \"Chef\" an. Schätzungen mit \"ca.\" kennzeichnen.",
      tools: [INFO_TOOL], tool_choice: { type: "auto" },
      messages: [{ role: "user", content: `Wunsch: ${text}` }],
    }, { timeout: 20000 });
    recordUsage(msg.model || model, msg.usage, "werkstatt");
    return (msg.content || []).find((b) => b.type === "tool_use")?.input || null;
  } catch (err) {
    if (isCreditError(err)) markEmpty();
    return null;
  }
}

function modellPlan(m, info, text, vorlaeufig = false) {
  const i = info && typeof info === "object" ? info : {};
  const sb = ausText(i.steckbrief);
  const kz = ausText(i.kennzahlen);
  return {
    titel: i.titel || m.name || suchwort(text),
    einleitung: i.einleitung || (vorlaeufig ? "" : `Sehr gern, Chef. Hier ist ${m.name}.`),
    steckbrief: sb && typeof sb === "object" ? sb : { typ: m.quelle ? `Echtes 3D-Modell · ${m.quelle}` : "Echtes 3D-Modell", baujahr: "–", preis: "–", kurz: m.name },
    kennzahlen: Array.isArray(kz) ? kz.filter((k) => k && k.label && k.wert) : [],
    fazit: i.fazit || "So, Chef. Dreh es mit dem Finger, dann siehst du es von allen Seiten.",
    schritte: [],
    modell: { id: m.id, name: m.name, autor: m.autor || "", lizenz: m.lizenz || "", link: m.link || "", quelle: m.quelle || "", laenge: Number(i.laenge_m) > 0 ? Number(i.laenge_m) : m.laenge || null },
  };
}

function planModell(text, m, art) {
  const job = neuerJob(text, false);
  job.plan = modellPlan(m, null, text, true);
  job.phase = "Lade echtes Modell …";
  const fertig = (info) => {
    job.plan = modellPlan(m, info, text);
    job.planNr += 1;
    job.status = "fertig";
    job.dauer_ms = Date.now() - job.start;
    eintragen({ bereich: "werkstatt", titel: `Echtes 3D-Modell gezeigt: ${job.plan.titel}`, details: `Wunsch: ${text} · Modell: ${m.name}${m.autor ? ` von ${m.autor}` : ""}${m.lizenz ? ` (${m.lizenz})` : ""}` });
  };
  infoHolen(text).then(fertig, () => fertig(null));
  return { ok: true, ...job };
}

function planSketchfab(text, art, opt) {
  const job = neuerJob(text, false);
  job.phase = "Suche ein echtes 3D-Modell …";
  (async () => {
    const [m, info] = await Promise.all([holeModell(text, { art }).catch((e) => { job.sfFehler = e.message; return null; }), infoHolen(text)]);
    if (m) {
      job.plan = modellPlan(m, info, text);
      job.planNr += 1;
      job.status = "fertig";
      eintragen({ bereich: "werkstatt", titel: `Echtes 3D-Modell geladen: ${job.plan.titel}`, details: `Wunsch: ${text} · ${m.name}${m.autor ? ` von ${m.autor}` : ""} (${m.lizenz || "Lizenz unbekannt"}) · Sketchfab` });
      return;
    }
    // Nichts Passendes gefunden: wie bisher Vorlage oder Claude-Entwurf.
    job.phase = "";
    if (art && istVorlagenBefehl(text)) {
      const v = baueVorlage(art, opt);
      Object.assign(job, { plan: v, status: "fertig", ohneClaude: true, vorlage: art, hinweis: "Kein passendes echtes Modell gefunden – Friday zeigt ihre Vorlage." });
      job.planNr += 1;
      return;
    }
    if (config.anthropicKey && getEnergie().zustand !== "leer") {
      await bauen(job, null).catch((err) => { job.status = "fehler"; job.error = String(err?.message || err).slice(0, 300); });
    } else if (art) {
      Object.assign(job, { plan: baueVorlage(art, opt), status: "fertig", ohneClaude: true, vorlage: art });
      job.planNr += 1;
    } else {
      Object.assign(job, { status: "fehler", error: "Dazu habe ich kein Modell gefunden, Chef." });
    }
  })().catch((err) => { job.status = "fehler"; job.error = String(err?.message || err).slice(0, 300); })
    .finally(() => { job.dauer_ms = Date.now() - job.start; });
  return { ok: true, ...job };
}

async function bauen(job, basis) {
  let user = `Wunsch: ${job.wunsch}`;
  if (basis) {
    user = `Es gibt schon dieses Modell (Kurzfassung): ${compact(basis)}\n\nDie Teile davon bleiben stehen. Liefere NUR die neuen Bauabschnitte als Ergänzung (schritte), passend in dasselbe Koordinatensystem, und aktualisierte steckbrief und kennzahlen.\n\nWunsch: ${job.wunsch}`;
  }
  // Tempo: Sonnet 5.5 (schnell) als Standard, "gründlich" nimmt das große Modell aus der .env.
  const gruendlich = getSettings().tempo === "gruendlich";
  const gewuenscht = gruendlich ? config.model : "claude-sonnet-5-5";
  const model = brainModel(gewuenscht);
  const sparen = model === SPAR_MODELL && gewuenscht !== SPAR_MODELL;
  job.modell = model;
  let msg;
  try {
    const stream = client.messages.stream({
      model,
      max_tokens: sparen ? 12000 : 20000,
      system: SYSTEM,
      tools: [BAUPLAN_TOOL],
      tool_choice: { type: "auto" }, // Opus 5.5 erlaubt kein erzwungenes Werkzeug; der Auftrag steht im System-Prompt
      output_config: { effort: gruendlich && !sparen ? "medium" : "low" },
      messages: [{ role: "user", content: user }],
    });
    stream.on("inputJson", (_teil, schnappschuss) => uebernimm(job, schnappschuss));
    msg = await stream.finalMessage();
  } catch (err) {
    const m = String(err?.message || err);
    if (isCreditError(err)) markEmpty();
    if (isCreditError(err) || /credit balance/i.test(m)) {
      if (!basis && vorlageEinsetzen(job)) { job.hinweis = "Claude-Guthaben leer: Friday hat ihre Vorlage gebaut."; return; }
    }
    if (/credit balance/i.test(m)) throw new Error("Dein Claude-Guthaben ist leer, Chef. Lade es auf console.anthropic.com auf, dann baue ich wieder.");
    if (/authentication|api[_ -]?key|401/i.test(m)) throw new Error("Der Claude-Schlüssel wird nicht angenommen.");
    console.error("Werkstatt-Claude:", m.slice(0, 300));
    if (!basis && job.plan.schritte.some((s) => s.teile.length)) { job.status = "fertig"; return; } // Teilplan reicht
    if (!basis && vorlageEinsetzen(job)) return;
    throw new Error("Der Bauplan hat gerade nicht geklappt. Versuch es gleich noch einmal.");
  }
  recordUsage(msg.model || model, msg.usage, "werkstatt");
  const block = (msg.content || []).find((b) => b.type === "tool_use" && b.name === "bauplan");
  job.stop = msg.stop_reason;
  if (!block && msg.stop_reason === "refusal") throw new Error("Das baue ich nicht, Chef.");
  if (block) uebernimm(job, block.input, true);
  if (!job.plan.schritte.some((s) => s.teile.length)) {
    // Claude hat keine (brauchbaren) Bauteile geliefert. Statt "Der Bauplan war leer." baut Friday
    // die passende Vorlage – mit Claudes Titel, Steckbrief und den echten Maßen aus den Kennzahlen.
    const roh = block?.input && typeof block.input === "object" ? Object.keys(block.input).join(",") : "-";
    console.error(`Werkstatt: Bauplan ohne Teile (stop=${msg.stop_reason}, Felder=${roh}, Abschnitte=${job.plan.schritte.length})`);
    if (!basis && vorlageEinsetzen(job)) return;
    throw new Error(basis ? "Die Ergänzung kam ohne Bauteile zurück. Versuch es bitte noch einmal." : "Der Bauplan war leer. Sag mir genauer, was ich bauen soll (z. B. Auto, Flugzeug, Schiff).");
  }
  job.status = "fertig";
}

// Rettung: passende Vorlage einsetzen, Claudes Angaben (Titel, Steckbrief, Kennzahlen, Einleitung) behalten.
function vorlageEinsetzen(job) {
  const p = job.plan;
  const art = erkenneArt(`${job.wunsch} ${p.titel || ""} ${p.steckbrief?.typ || ""}`)
    || erkenneArt(`${p.steckbrief?.kurz || ""} ${p.einleitung || ""}`); // v1.133.0: auch Claudes Beschreibung lesen
  if (!art) return false;
  const text = `${job.wunsch} ${p.titel || ""}`;
  const v = baueVorlage(art, { ...masseAusKennzahlen(p.kennzahlen), farbe: erkenneFarbe(job.wunsch) || erkenneFarbe(p.titel), elektro: /elektro|e-auto|tesla|taycan|e-tron/i.test(text), titel: p.titel || undefined });
  job.plan = {
    ...v,
    titel: p.titel || v.titel,
    einleitung: p.einleitung || v.einleitung,
    steckbrief: p.steckbrief?.typ ? p.steckbrief : v.steckbrief,
    kennzahlen: p.kennzahlen?.length ? p.kennzahlen : v.kennzahlen,
    fazit: p.fazit || v.fazit,
  };
  job.vorlage = art;
  job.planNr = (job.planNr || 1) + 1; // Dashboard baut neu auf
  job.hinweis = "Claudes Entwurf kam ohne Bauteile – Friday hat die passende Vorlage mit den echten Maßen gebaut.";
  job.status = "fertig";
  return true;
}

/** Für das Claude-Werkzeug: startet den Bau und wartet höchstens kurz (die Werkstatt zeigt alles selbst). */
export async function planBuild(wunsch, basis = null) {
  return startBuild(wunsch, basis);
}

export function getBuildJob(id) {
  return jobs.get(Number(id)) || null;
}

export function getLatestBuild() {
  return latest;
}
