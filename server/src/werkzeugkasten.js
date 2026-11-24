// Fridays Werkzeugkasten (v1.162.0): 100 kleine Werkzeuge für alle Bereiche – Rechner, Generatoren, Prüfer, Vorlagen.
// Alle laufen OHNE Claude und ohne Guthaben (lokal auf dem Mac oder über kostenlose Dienste ohne Schlüssel).
//
// Warum EIN Werkzeugkasten statt 100 einzelner Claude-Werkzeuge?
//   Jedes Claude-Werkzeug wird bei JEDER Frage mitgeschickt. 100 einzelne Werkzeuge wären rund 15.000 Tokens mehr
//   pro Frage (≈ dreimal so teuer und langsamer, und Claude wählt schlechter). Hier gibt es für Claude nur ein
//   Werkzeug "werkzeugkasten" mit einer kurzen Liste – und die meisten Sätze erkennt Friday sogar ganz ohne Claude.
import { config } from "./config.js";
import * as logbuch from "./logbuch.js";
import geld from "./werkzeugkasten/geld.js";
import haushalt from "./werkzeugkasten/haushalt.js";
import zeit from "./werkzeugkasten/zeit.js";
import gesundheit from "./werkzeugkasten/gesundheit.js";
import textW from "./werkzeugkasten/text.js";
import sicherheit from "./werkzeugkasten/sicherheit.js";
import technik from "./werkzeugkasten/technik.js";
import mathe from "./werkzeugkasten/mathe.js";
import wissen from "./werkzeugkasten/wissen.js";
import unterwegs from "./werkzeugkasten/unterwegs.js";
import natur from "./werkzeugkasten/natur.js";
import spass from "./werkzeugkasten/spass.js";
import buero from "./werkzeugkasten/buero.js";

export const WERKZEUGE = [...geld, ...haushalt, ...zeit, ...gesundheit, ...textW, ...sicherheit, ...technik, ...mathe, ...wissen, ...unterwegs, ...natur, ...spass, ...buero];
const NACH_ID = new Map(WERKZEUGE.map((w) => [w.id, w]));
if (NACH_ID.size !== WERKZEUGE.length) throw new Error("Werkzeugkasten: doppelte id");
export const GRUPPEN = [...new Set(WERKZEUGE.map((w) => w.gruppe))];
const ONLINE = new Set(["passwort_geleakt", "webseite_pruefen", "synonyme", "rechtschreibung", "buch_suchen", "luftlinie", "pollenflug", "uv_index", "wassertemperatur"]);

/** Katalog fürs Dashboard (ohne Funktionen). */
export function katalog() {
  return {
    anzahl: WERKZEUGE.length,
    gruppen: GRUPPEN,
    werkzeuge: WERKZEUGE.map(({ id, titel, icon, gruppe, info, felder, geheim, sprache }) => ({ id, titel, icon, gruppe, info, felder: felder || [], geheim: !!geheim, online: ONLINE.has(id), sprache: !!sprache?.length })),
  };
}

let letzter = null; // letzter Lauf über Sprache oder Claude, damit das Dashboard ihn zeigen kann

/** Ein Werkzeug ausführen. Wirft nie – Fehler kommen als { ok:false, error }. */
export async function ausfuehren(id, eingabe = {}, { quelle = "dashboard", kanal = "" } = {}) {
  const w = NACH_ID.get(String(id || ""));
  if (!w) return { ok: false, error: `Das Werkzeug „${id}“ gibt es nicht.` };
  const e = eingabe && typeof eingabe === "object" ? { ...eingabe } : {};
  for (const f of w.felder || []) if ((e[f.k] === undefined || e[f.k] === "") && f.standard !== undefined) e[f.k] = f.standard;
  const start = Date.now();
  let r;
  try {
    r = await Promise.race([Promise.resolve(w.run(e)), new Promise((_, nein) => setTimeout(() => nein(new Error("Das Werkzeug hat zu lange gebraucht.")), 20000).unref?.())]);
  } catch (err) {
    const netz = /fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|network|aborted|timeout/i.test(String(err?.cause?.code || err?.message || ""));
    const error = netz ? "Dafür brauche ich Internet, und der Dienst ist gerade nicht erreichbar." : err?.message || String(err);
    log(w, { ok: false, text: error }, quelle, kanal, Date.now() - start);
    return { ok: false, id: w.id, titel: w.titel, error };
  }
  const aus = { ok: true, id: w.id, titel: w.titel, icon: w.icon, ...r };
  log(w, aus, quelle, kanal, Date.now() - start);
  if (quelle !== "dashboard") letzter = { at: Date.now(), id: w.id, eingabe: w.geheim ? {} : e, ergebnis: w.geheim || r.geheimesErgebnis ? null : aus };
  return aus;
}

function log(w, r, quelle, kanal, dauer) {
  // Geheimes (Passwörter, PINs, Wichtel-Paare) kommt nie ins Logbuch.
  const details = w.geheim || r.geheimesErgebnis ? "" : String(r.text || "").slice(0, 300);
  logbuch.eintragen({ bereich: "werkzeug", titel: `${w.icon} ${w.titel}`, details, quelle, kanal, ok: r.ok !== false, dauer_ms: dauer });
}

export const letzterLauf = () => letzter;

// ---------- Sprachbefehle ohne Claude ----------
function vereinfachen(text) {
  return String(text || "").replace(/€/g, " euro").replace(/[„“”"!?¿¡]/g, " ")
    .replace(/^(hey |hallo |hi |ok |okay )?(friday|freitag|fraiday)[,:]?\s*/i, "")
    .replace(/^(bitte |kannst du (mir )?(bitte )?|könntest du (mir )?(bitte )?|sag mir (bitte )?|zeig mir (bitte )?|rechne (mir )?(bitte )?aus,? )/i, "")
    .replace(/\s+/g, " ").replace(/[\s.,;:]+$/, "").replace(/\s+bitte$/, "").trim();
}
const b64 = (o) => Buffer.from(JSON.stringify(o), "utf8").toString("base64url");

/** Erkennt Sätze wie „19 Prozent von 250“ oder „mach mir einen QR-Code für …“. Gibt {answer, actions} oder null. */
export async function quickCommand(text) {
  const roh = vereinfachen(text), t = roh.toLowerCase();
  if (!t || t.length > 400) return null;
  const gleich = roh.length === t.length;
  if (/^(öffne|zeig|zeige|starte?)( mir)? (den |deinen |meinen )?werkzeugkasten$|^werkzeugkasten$|^(welche|was für) (werkzeuge|rechner) hast du$/.test(t)) {
    // v1.165.0: kein eigenes Fenster mehr – Friday erklärt, wie man die Werkzeuge per Sprache nutzt.
    return { answer: `Ich habe ${WERKZEUGE.length} Werkzeuge eingebaut, ${config.userName || "Boss"}, alle ohne Guthaben. Sag einfach, was du brauchst, zum Beispiel „Mehrwertsteuer von 250 Euro“, „Brückentage 2027“, „QR-Code für meine Webseite“ oder „erstelle ein Passwort“.`, actions: [] };
  }
  for (const w of WERKZEUGE) {
    for (const [re, zuEingabe] of w.sprache || []) {
      let m = t.match(re);
      if (!m) continue;
      // Namen und Links in Originalschreibweise ("Kevin", "https://…/Abc") – gleiche Stelle im Originaltext.
      if (w.grossKlein && gleich) {
        const md = new RegExp(re.source, re.flags.replace("d", "") + "d").exec(t);
        if (md?.indices) m = md.map((g, i) => (g == null || !md.indices[i] ? g : roh.slice(md.indices[i][0], md.indices[i][1])));
      }
      let eingabe;
      try { eingabe = zuEingabe(m); } catch { continue; }
      if (eingabe === null) continue; // Muster passt, aber gemeint ist etwas anderes
      eingabe ||= {};
      // Geheimes läuft nur im Fenster – so landet es weder im Archiv noch im Vorlesen.
      if (w.geheim) return { answer: `Ich habe „${w.titel}“ für dich geöffnet. Das Ergebnis steht nur im Fenster.`, actions: [`werkzeug_lauf:${w.id}:${b64(eingabe)}`] };
      const r = await ausfuehren(w.id, eingabe, { quelle: "sprache" });
      if (!r.ok) return { answer: r.error, actions: [`werkzeug_offen:${w.id}:${b64(eingabe)}`] };
      return { answer: r.text, actions: r.zeigen ? ["werkzeug_letzter", `werkzeug:${w.id}`] : [`werkzeug:${w.id}`] };
    }
  }
  return null;
}

// ---------- Ein Werkzeug für Claude ----------
const kurzFelder = (w) => (w.felder || []).map((f) => (f.typ === "wahl" ? `${f.k}=${f.optionen.slice(0, 6).join("|")}` : f.k)).join(",");
export const toolDefinition = {
  name: "werkzeugkasten",
  description: `Fridays Werkzeugkasten: ${WERKZEUGE.length} fertige Rechner, Generatoren, Prüfer und Vorlagen. Kostenlos, rechnet exakt. Benutze ihn statt selbst zu rechnen, wenn ein Werkzeug passt. `
    + `Passwörter, PINs, Wichteln und WLAN-QR erzeugt nur das Fenster (du bekommst kein Ergebnis). Datumsangaben als TT.MM.JJJJ, Zahlen als Zahl. Werkzeuge (id(eingabe-felder)): `
    + WERKZEUGE.map((w) => `${w.id}(${kurzFelder(w)})`).join("; "),
  input_schema: {
    type: "object",
    properties: {
      werkzeug: { type: "string", description: "id des Werkzeugs, z. B. mwst" },
      eingabe: { type: "object", description: "Felder des Werkzeugs, z. B. {\"betrag\": 100, \"richtung\": \"netto → brutto\"}" },
    },
    required: ["werkzeug"],
  },
};
export async function runClaudeTool(input = {}, wer = {}) {
  const w = NACH_ID.get(String(input.werkzeug || ""));
  if (!w) return { error: `Unbekanntes Werkzeug. Verfügbar: ${WERKZEUGE.map((x) => x.id).join(", ")}` };
  if (w.geheim) {
    letzter = { at: Date.now(), id: w.id, eingabe: input.eingabe || {}, ergebnis: null, starten: true };
    return { hinweis: `${w.titel} ist im Dashboard geöffnet und erzeugt das Ergebnis dort. Sag Boss nur, dass es im Fenster steht – nenne nie selbst Passwörter, PINs oder Paare.` };
  }
  const r = await ausfuehren(w.id, input.eingabe || {}, { quelle: "claude", kanal: wer.kanal });
  if (!r.ok) return { error: r.error, felder: w.felder?.map((f) => f.k) };
  const { ok, icon, ...rest } = r;
  return { ...rest, ...(r.zeigen ? { info: "Das Ergebnis ist im Dashboard-Fenster zu sehen." } : {}) };
}

// ---------- Routen ----------
export function werkzeugRouten(app, asyncRoute) {
  app.get("/api/werkzeugkasten", asyncRoute(async (req, res) => res.json(katalog())));
  app.get("/api/werkzeugkasten/letzter", asyncRoute(async (req, res) => res.json({ letzter })));
  app.post("/api/werkzeugkasten/:id", asyncRoute(async (req, res) => {
    const r = await ausfuehren(req.params.id, req.body?.eingabe || {}, { quelle: "dashboard" });
    res.status(r.ok || r.id ? 200 : 404).json(r);
  }));
}
