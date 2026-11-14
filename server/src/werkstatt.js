// Fridays Werkstatt: Claude entwirft aus einem Wunsch ("ein Porsche", "ein Wohnhaus mit 12 Etagen")
// einen 3D-Bauplan aus einfachen Teilen, den das Dashboard Schritt für Schritt als Hologramm aufbaut.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

const client = new Anthropic({ apiKey: config.anthropicKey });

const FARBEN = ["cyan", "weiss", "rot", "orange", "gelb", "gruen", "blau", "lila", "grau", "schwarz", "glas"];
const point = { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 };
const TEIL = {
  type: "object",
  properties: {
    form: { type: "string", enum: ["box", "zylinder", "kugel", "rohr", "text"], description: "box: Quader; zylinder: Rad, Säule, Tank; kugel; rohr: Leitung/Kabel entlang punkte; text: Beschriftung im Raum" },
    pos: { ...point, description: "Mittelpunkt [x, y, z] in Metern. y ist oben, Boden y=0, Objekt mittig um x=0, z=0." },
    groesse: { ...point, description: "box: [Breite x, Höhe y, Tiefe z] in Metern" },
    radius: { type: "number" },
    hoehe: { type: "number", description: "zylinder: Länge entlang der achse" },
    achse: { type: "string", enum: ["x", "y", "z"], description: "zylinder: Richtung der Längsachse (Rad: z oder x)" },
    drehung: { ...point, description: "optionale Drehung [x, y, z] in Grad" },
    punkte: { type: "array", items: point, description: "rohr: Eckpunkte der Leitung" },
    dicke: { type: "number", description: "rohr: Durchmesser in Metern" },
    farbe: { type: "string", enum: FARBEN },
    text: { type: "string", description: "text: kurze Beschriftung, z. B. '800-V-Batterie' oder '3,20 m'" },
  },
  required: ["form", "farbe"],
};
const BAUPLAN_TOOL = {
  name: "bauplan",
  description: "Gibt den 3D-Bauplan zurück.",
  input_schema: {
    type: "object",
    properties: {
      titel: { type: "string" },
      einleitung: { type: "string", description: "Ein Satz, gesprochen, bevor es losgeht, z. B. 'Sehr gern, Chef. Ein Porsche Taycan.'" },
      kennzahlen: { type: "array", items: { type: "object", properties: { label: { type: "string" }, wert: { type: "string" } }, required: ["label", "wert"] }, description: "4 bis 8 echte Eckdaten mit Einheit" },
      schritte: {
        type: "array",
        description: "4 bis 8 Bauabschnitte in sinnvoller Reihenfolge",
        items: {
          type: "object",
          properties: {
            sagen: { type: "string", description: "Was Friday bei diesem Schritt sagt: 1 bis 2 kurze Sätze mit echten Zahlen" },
            teile: { type: "array", items: TEIL },
          },
          required: ["sagen", "teile"],
        },
      },
      fazit: { type: "string", description: "Abschluss-Satz, z. B. 'So, Chef. Fertig.'" },
    },
    required: ["titel", "einleitung", "kennzahlen", "schritte", "fazit"],
  },
};

const SYSTEM = `Du bist die Werkstatt von F.R.Ai.D.A.Y. Du entwirfst aus einem Wunsch ein glaubwürdiges, technisch plausibles 3D-Modell aus einfachen Teilen und erklärst den Aufbau wie ein Ingenieur.

Regeln für das Modell:
- Maßstab in Metern, echte Größen (Auto ca. 4,5–5 m lang, Geschoss 3 m hoch, Mensch 1,8 m). y zeigt nach oben, der Boden ist y=0, das Objekt steht mittig auf x=0, z=0, die Länge liegt auf der x-Achse.
- Insgesamt 40 bis 160 Teile. Lieber viele kleine, saubere Teile als wenige grobe: Ein Auto bekommt Karosserie aus mehreren Boxen, Kabine, 4 Räder (zylinder, achse z), Batterie mit einzelnen Modulen, Motoren. Ein Haus bekommt Bodenplatten je Etage, Stützen, Fensterbänder, Treppenhaus, Haustechnik mit Rohren.
- Farben haben Bedeutung: cyan = Struktur/Hülle, glas = Scheiben, rot = Heizung/heiß, blau = Wasser/kalt, gelb = Strom/Elektrik, orange = Lüftung/Mechanik, gruen = Batterie/Energie, weiss/grau = Ausbau.
- Pro Schritt 1 bis 3 Beschriftungen (form text) direkt an den wichtigen Stellen, mit echten Werten.
- Echte Eckdaten und Zahlen aus deinem Wissen; wenn es ein reales Produkt ist, dessen echte Maße. Rechne nachvollziehbar.

Ton: Deutsch, knapp, trocken-souverän wie JARVIS, sprich den Nutzer mit "Chef" an. Nichts Gefährliches: keine Waffen, Sprengstoffe oder Anleitungen zum Schaden anderer – dann baust du stattdessen etwas Harmloses und sagst das.`;

let latest = null;
let seq = 0;

function compact(plan) {
  // Kurzfassung eines bestehenden Plans für Erweiterungen (ohne alle Koordinaten).
  return JSON.stringify({ titel: plan.titel, kennzahlen: plan.kennzahlen, schritte: plan.schritte.map((s) => s.sagen) });
}

export async function planBuild(wunsch, basis = null) {
  if (!config.anthropicKey) return { ok: false, error: "Ohne Claude-Schlüssel kann die Werkstatt nichts entwerfen." };
  const text = String(wunsch || "").trim().slice(0, 1000);
  if (!text) return { ok: false, error: "Was soll ich bauen, Chef?" };
  let user = `Wunsch: ${text}`;
  if (basis) {
    user = `Es gibt schon dieses Modell (Kurzfassung): ${compact(basis)}\n\nDie Teile davon bleiben stehen. Liefere NUR die neuen Bauabschnitte als Ergänzung (schritte), passend in dasselbe Koordinatensystem, und aktualisierte kennzahlen.\n\nWunsch: ${text}`;
  }
  let res;
  try {
    res = await client.beta.messages.create({
    model: config.model,
    max_tokens: 20000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    tools: [BAUPLAN_TOOL],
    tool_choice: { type: "tool", name: "bauplan" },
    messages: [{ role: "user", content: user }],
    });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/credit balance/i.test(msg)) return { ok: false, error: "Dein Claude-Guthaben ist leer, Chef. Lade es auf console.anthropic.com auf, dann baue ich wieder." };
    if (/authentication|api[_ -]?key|401/i.test(msg)) return { ok: false, error: "Der Claude-Schlüssel wird nicht angenommen." };
    return { ok: false, error: "Der Bauplan hat gerade nicht geklappt. Versuch es gleich noch einmal." };
  }
  const block = (res.content || []).find((b) => b.type === "tool_use" && b.name === "bauplan");
  if (!block) return { ok: false, error: res.stop_reason === "refusal" ? "Das baue ich nicht, Chef." : "Der Bauplan kam nicht zustande." };
  const plan = block.input;
  plan.schritte = (plan.schritte || []).map((s) => ({ sagen: String(s.sagen || ""), teile: (s.teile || []).filter((t) => t && t.form).slice(0, 120) })).filter((s) => s.teile.length);
  if (!plan.schritte.length) return { ok: false, error: "Der Bauplan war leer." };
  seq += 1;
  latest = { id: seq, wunsch: text, erweiterung: Boolean(basis), plan, zeit: new Date().toISOString() };
  return { ok: true, ...latest };
}

export function getLatestBuild() {
  return latest;
}
