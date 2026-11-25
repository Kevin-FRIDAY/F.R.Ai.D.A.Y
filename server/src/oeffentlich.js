// Öffentliche Daten (v1.166.0): eine Zentrale für kostenlose, offene Schnittstellen – Schwerpunkt Deutschland.
// Jede Quelle ist ein Objekt { id, titel, icon, gruppe, info, quelle, link, eingabe, sprache, laden(eingabe) }.
// - Sprache ohne Claude: quickCommand() (in brain.js vor dem Werkzeugkasten) → Antwort vorlesen + Fenster öffnen.
// - Claude: ein einziges Werkzeug "oeffentliche_daten" (quelle + eingabe).
// - Dashboard: GET /api/daten (Liste), GET /api/daten/:id?q=… (Ergebnis) → dashboard/oeffentlich.js.
// - Andere Module: `await abrufen("pegel", "Spree")` → { ok, id, titel, text, zeilen, … }.
// Grenze: nur öffentliche Quellen, keine Daten über einzelne Personen.
import { QUELLE as pegel } from "./pegel.js";
import { QUELLE as autobahn } from "./autobahn.js";
import { QUELLE as rueckrufe } from "./rueckrufe.js";
import { QUELLEN as DEUTSCHLAND } from "./oeffentlich/deutschland.js";
import { QUELLEN as WELT } from "./oeffentlich/welt.js";
import { sauber } from "./wunsch-hilfe.js";

const [nina, ...restDe] = DEUTSCHLAND;
export const QUELLEN = [nina, pegel, autobahn, rueckrufe, ...restDe, ...WELT];
export const GRUPPEN = ["Deutschland", "Weltraum", "Wissen", "Wirtschaft"];
const NACH_ID = new Map(QUELLEN.map((q) => [q.id, q]));
if (NACH_ID.size !== QUELLEN.length) throw new Error("Öffentliche Daten: doppelte id");

const FUELL = /\s+(?:gerade|jetzt|heute|aktuell|bitte|mal)$/i;
const putzen = (s) => { let t = String(s || "").trim(); while (FUELL.test(t)) t = t.replace(FUELL, ""); return t.replace(/^(?:der|die|das|den|dem)\s+/i, "").trim(); };

/** Eine Quelle abrufen. Wirft nie – Fehler kommen als { ok:false, error }. */
export async function abrufen(id, eingabe = "") {
  const q = NACH_ID.get(String(id || ""));
  if (!q) return { ok: false, error: `Unbekannte Quelle. Verfügbar: ${QUELLEN.map((x) => x.id).join(", ")}` };
  const kopf = { id: q.id, titel: q.titel, icon: q.icon, quelle: q.quelle, link: q.link, eingabe: String(eingabe || "") };
  try {
    const r = await q.laden(String(eingabe || "").slice(0, 200));
    return { ok: true, ...kopf, zeilen: [], ...r, abgerufen: new Date().toISOString() };
  } catch (err) {
    return { ok: false, ...kopf, error: err.message || String(err), text: `Ich komme gerade nicht an ${q.titel} (${err.message || err}).` };
  }
}

export function katalog() {
  return {
    anzahl: QUELLEN.length, gruppen: GRUPPEN,
    quellen: QUELLEN.map(({ id, titel, icon, gruppe, info, quelle, link, eingabe, sprache }) => ({
      id, titel, icon, gruppe, info, quelle, link, eingabe: eingabe || null, sprache: Boolean(sprache?.length),
    })),
  };
}

const OEFFNEN = /^(?:öffne|oeffne|zeig mir|zeige|starte)? ?(?:die )?(?:öffentlichen? daten|oeffentlichen? daten|daten-?zentrale|datenquellen|offene daten|open data|alle datenquellen)$/;

/** Sprachbefehl ohne Claude → { answer, actions } oder null. */
export async function quickCommand(text) {
  const { t, k } = sauber(text);
  // Eingabe in der Schreibweise des Nutzers ("Hamburg" statt "hamburg"), sofern die Länge gleich geblieben ist.
  const original = (teil) => {
    if (!teil || t.length !== k.length) return teil;
    const i = k.lastIndexOf(teil);
    return i >= 0 ? t.slice(i, i + teil.length) : teil;
  };
  if (!k) return null;
  if (OEFFNEN.test(k)) return { answer: `Hier sind ${QUELLEN.length} öffentliche Datenquellen, von Pegelständen bis zum NASA-Bild des Tages.`, actions: ["daten"] };
  for (const q of QUELLEN) {
    for (const re of q.sprache || []) {
      const m = k.match(re);
      if (!m) continue;
      const eingabe = q.ganzeFrage ? k : putzen(original(m[1] || m[2] || ""));
      const r = await abrufen(q.id, eingabe);
      // Im Fenster steht die kurze Form („Baustellen A1“ statt der ganzen Frage).
      const anzeige = q.kurz ? q.kurz(k) : eingabe;
      return { answer: r.text || r.error, actions: [`daten:${q.id}:${encodeURIComponent(anzeige)}`] };
    }
  }
  return null;
}

// ---------- Claude: ein Werkzeug für alle Quellen ----------
export const toolDefinition = {
  name: "oeffentliche_daten",
  description: "Holt aktuelle Daten aus kostenlosen öffentlichen Quellen (Ämter, Bund, EU, NASA, Wikipedia). Benutze es statt zu raten oder Websuche, wenn eine Quelle passt. "
    + "Das Ergebnis erscheint auch im Dashboard-Fenster. Quellen (id: Inhalt [Eingabe]): "
    + QUELLEN.map((q) => `${q.id}: ${q.info}${q.eingabe ? ` [${q.eingabe.platzhalter}]` : ""}`).join("; "),
  input_schema: {
    type: "object",
    properties: {
      quelle: { type: "string", enum: QUELLEN.map((q) => q.id), description: "id der Quelle" },
      eingabe: { type: "string", description: "Ort, Fluss, Autobahn, Suchwort … je nach Quelle; leer = Fridays Ort / Standard" },
    },
    required: ["quelle"],
  },
};
let letzter = null; // fürs Dashboard: letzter Abruf durch Claude
export async function runClaudeTool(input = {}) {
  const r = await abrufen(input.quelle, input.eingabe || "");
  if (r.ok) letzter = { at: Date.now(), id: r.id, eingabe: r.eingabe };
  if (!r.ok) return { error: r.error };
  const { ok, icon, punkte, bildGross, ...rest } = r;
  return { ...rest, zeilen: (r.zeilen || []).slice(0, 15).map(({ titel, wert, unter }) => ({ titel, wert, unter })), info: "Im Dashboard-Fenster „Öffentliche Daten“ zu sehen." };
}

// ---------- Routen ----------
export function datenRouten(app, asyncRoute) {
  app.get("/api/daten", asyncRoute(async (req, res) => res.json(katalog())));
  app.get("/api/daten/letzter", asyncRoute(async (req, res) => res.json({ letzter })));
  app.get("/api/daten/:id", asyncRoute(async (req, res) => {
    const r = await abrufen(req.params.id, String(req.query.q || ""));
    res.status(r.ok || r.id ? 200 : 404).json(r);
  }));
}
