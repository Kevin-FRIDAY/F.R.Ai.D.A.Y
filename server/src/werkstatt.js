// Fridays Werkstatt: Claude entwirft aus einem Wunsch ("ein Porsche", "ein Wohnhaus mit 12 Etagen")
// einen 3D-Bauplan aus einfachen Teilen, den das Dashboard Schritt für Schritt als Hologramm aufbaut.
import { eintragen } from "./logbuch.js";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { recordUsage, isCreditError, markEmpty, brainModel, SPAR_MODELL, getEnergie } from "./energie.js";
import { getSettings } from "./einstellungen.js";
import { isHausWunsch, isHausBefehl, planHouse } from "./haus.js";

const client = new Anthropic({ apiKey: config.anthropicKey });

const FARBEN = ["cyan", "weiss", "rot", "orange", "gelb", "gruen", "blau", "lila", "grau", "schwarz", "glas", "chrom"];
const point = { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 };
const TEIL = {
  type: "object",
  properties: {
    name: { type: "string", description: "Kurzer Name des Bauteils, z. B. 'Singleframe-Grill' oder 'Hinterrad links'. Erscheint nur beim Antippen." },
    form: { type: "string", enum: ["profil", "box", "zylinder", "kugel", "rohr"], description: "profil: Seitenansicht als Umriss (punkte2d), in der Breite ausgezogen – für Karosserie, Rumpf, Kabine; box: Quader; zylinder: Rad, Säule, Tank, Kegel; kugel; rohr: Leitung/Kabel entlang punkte" },
    pos: { ...point, description: "Mittelpunkt [x, y, z] in Metern. y ist oben, Boden y=0, Objekt mittig um x=0, z=0, Länge auf x (vorne = +x). profil: nur pos[2] zählt (Mitte in der Breite), die Umriss-Punkte sind schon absolut." },
    groesse: { ...point, description: "box: [Länge x, Höhe y, Breite z] in Metern" },
    punkte2d: { type: "array", items: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 }, description: "profil: 8 bis 30 Umriss-Punkte [x, y] in Metern, Seitenansicht, im Uhrzeigersinn, ohne Wiederholung des Startpunkts" },
    breite: { type: "number", description: "profil: Breite in z (Meter)" },
    rundung: { type: "number", description: "profil/box: Kantenrundung in Metern (0 bis 0.12)" },
    radius: { type: "number" },
    radius2: { type: "number", description: "zylinder: anderer Radius am oberen Ende (für Kegel, Düsen, Nasen)" },
    hoehe: { type: "number", description: "zylinder: Länge entlang der achse" },
    achse: { type: "string", enum: ["x", "y", "z"], description: "zylinder: Richtung der Längsachse (Rad: z)" },
    drehung: { ...point, description: "optionale Drehung [x, y, z] in Grad" },
    punkte: { type: "array", items: point, description: "rohr: Eckpunkte der Leitung" },
    dicke: { type: "number", description: "rohr: Durchmesser in Metern" },
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
            teile: { type: "array", items: TEIL },
          },
          required: ["status", "teile"],
        },
      },
    },
    required: ["titel", "steckbrief", "kennzahlen", "schritte"],
  },
};

const SYSTEM = `Du bist die Werkstatt von F.R.Ai.D.A.Y. Du baust aus einem Wunsch ein möglichst originalgetreues 3D-Modell aus einfachen Teilen. Man soll das Vorbild auf den ersten Blick erkennen.

Koordinaten: Meter, echte Maße des Originals. y oben, Boden y=0, Objekt mittig auf x=0, z=0, Länge auf der x-Achse, vorne = +x, Breite auf z.

So wird es genau:
- Die äußere Form IMMER mit "profil" bauen: Seitenansicht als Umriss mit 12 bis 30 Punkten, die die echte Silhouette nachzeichnen (Motorhaube, Neigung der Frontscheibe, Dachlinie, Heck, Radausschnitte angedeutet). Für Breite einen zweiten, schmaleren Umriss für den Aufbau (z. B. Fahrgastzelle mit farbe glas) darüberlegen.
- Autos: (1) Unterbau-Profil in voller Breite mit rundung 0.06, Farbe nach Wunsch (sonst cyan); (2) Fahrgastzelle als glas-Profil, ca. 85 % der Breite, mit echter A-/C-Säulen-Neigung; (3) 4 Räder: Reifen (zylinder schwarz, achse z) plus Felge (zylinder chrom, etwas kleiner und dünner) an den echten Radpositionen (Radstand, Spurweite, Raddurchmesser); (4) Gesicht des Modells: typischer Kühlergrill in echter Form, Scheinwerfer, Rückleuchten (rot), Außenspiegel, Embleme als flache Teile; (5) erst danach Technik (Motor, Getriebe, Tank, Batterie) klein und innen.
- Schiffe, Flugzeuge, Raketen, Gebäude genauso: Rumpf/Grundform als Profil oder Kegel, dann typische Erkennungsmerkmale.
- 50 bis 140 Teile insgesamt, jedes Teil mit kurzem name. Keine Textschilder, keine Beschriftungen im Modell.
- Farben: schwarz/grau/weiss/rot/blau usw. so wie das Original (Wunschfarbe des Nutzers beachten), glas = Scheiben, chrom = Felgen/Zierteile, gelb = Strom, orange = Mechanik, gruen = Batterie.
- steckbrief und kennzahlen: echte Werte des genannten Modells (Baujahr/Bauzeit, Neupreis, Leistung, Maße, Gewicht). Schätzungen mit "ca." kennzeichnen.

Antworte nur, indem du das Werkzeug "bauplan" genau einmal aufrufst. Kein Text daneben. Nichts Gefährliches: keine Waffen, Sprengstoffe oder Anleitungen zum Schaden anderer – dann baust du etwas Harmloses.`;

let latest = null;
let seq = 0;
const jobs = new Map();

function compact(plan) {
  // Kurzfassung eines bestehenden Plans für Erweiterungen (ohne alle Koordinaten).
  return JSON.stringify({ titel: plan.titel, kennzahlen: plan.kennzahlen, schritte: (plan.schritte || []).map((s) => s.status || s.sagen) });
}

function neuerJob(wunsch, erweiterung) {
  seq += 1;
  const job = { id: seq, wunsch, erweiterung, status: "plant", plan: { titel: "", kennzahlen: [], schritte: [] }, zeit: new Date().toISOString(), start: Date.now() };
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

// Sprachbefehl "Friday, bau mir ein Mehrfamilienhaus" – sofort und ohne Guthaben.
export function quickCommand(text) {
  if (!isHausBefehl(text)) return null;
  const r = planHaus(String(text).trim().slice(0, 1000));
  return { answer: "Einen Moment, Chef.", actions: ["werkstatt"], titel: r.plan.titel };
}

// Fürs Logbuch: die ersten Eckdaten als kurzer Text ("Wohnfläche: ca. 420 m², …").
function eckdaten(plan) {
  const k = Array.isArray(plan?.kennzahlen) ? plan.kennzahlen : [];
  return k.length ? ` · ${k.slice(0, 5).map((x) => `${x.label}: ${x.wert}`).join(", ")}` : "";
}

// Ein Bauabschnitt aus Claude: Textschilder raus (Kevin will keine Beschriftungs-Flut), Teile prüfen.
const istZahl = (v) => typeof v === "number" && Number.isFinite(v);
function teilOk(t) {
  if (!t || typeof t !== "object" || !t.form || t.form === "text") return false;
  if (t.form === "profil") return Array.isArray(t.punkte2d) && t.punkte2d.filter((q) => Array.isArray(q) && istZahl(q[0]) && istZahl(q[1])).length >= 3;
  if (t.form === "rohr") return Array.isArray(t.punkte) && t.punkte.length >= 2 && t.punkte.every((q) => Array.isArray(q) && q.length === 3 && q.every(istZahl));
  return true;
}
function saeubereSchritt(s) {
  const status = String(s?.status || s?.sagen || "").trim().slice(0, 40);
  return { status, teile: (Array.isArray(s?.teile) ? s.teile : []).filter(teilOk).slice(0, 120) };
}

// Aus dem halbfertigen Werkzeug-Aufruf alles übernehmen, was schon sicher fertig ist:
// ein Bauabschnitt gilt als fertig, sobald der nächste begonnen hat.
function uebernimm(job, roh, alles = false) {
  if (!roh || typeof roh !== "object") return;
  if (typeof roh.titel === "string") job.plan.titel = roh.titel;
  if (roh.steckbrief && typeof roh.steckbrief === "object") job.plan.steckbrief = { ...roh.steckbrief };
  if (Array.isArray(roh.kennzahlen)) job.plan.kennzahlen = roh.kennzahlen.filter((k) => k && k.label && k.wert);
  const sch = Array.isArray(roh.schritte) ? roh.schritte : [];
  const fertig = alles ? sch.length : Math.max(0, sch.length - 1);
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
  if (!config.anthropicKey) return { ok: false, error: "Ohne Claude-Schlüssel kann die Werkstatt nichts entwerfen." };
  if (getEnergie().zustand === "leer") return { ok: false, error: "Dein Claude-Guthaben ist leer, Chef. Lade es auf console.anthropic.com auf, dann baue ich wieder." };
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
    if (/credit balance/i.test(m)) throw new Error("Dein Claude-Guthaben ist leer, Chef. Lade es auf console.anthropic.com auf, dann baue ich wieder.");
    if (/authentication|api[_ -]?key|401/i.test(m)) throw new Error("Der Claude-Schlüssel wird nicht angenommen.");
    throw new Error("Der Bauplan hat gerade nicht geklappt. Versuch es gleich noch einmal.");
  }
  recordUsage(msg.model || model, msg.usage, "werkstatt");
  const block = (msg.content || []).find((b) => b.type === "tool_use" && b.name === "bauplan");
  if (!block) throw new Error(msg.stop_reason === "refusal" ? "Das baue ich nicht, Chef." : "Der Bauplan kam nicht zustande.");
  uebernimm(job, block.input, true);
  if (!job.plan.schritte.some((s) => s.teile.length)) throw new Error("Der Bauplan war leer.");
  job.status = "fertig";
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
