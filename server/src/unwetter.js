// Unwetter-Warnungen vom DWD (v1.160.0, Wunsch aus der Ideen-Schmiede).
// Amtliche Warnungen des Deutschen Wetterdienstes für deinen Ort über Bright Sky (api.brightsky.dev,
// kostenlos, ohne Schlüssel, Daten vom DWD). Friday prüft alle 15 Minuten und meldet neue Warnungen
// per Telegram/Push (nur Friday, nicht Eve). Ort = Einstellung "Ort" in Friday, sonst CITY aus der .env.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { config, IST_EVE } from "./config.js";
import { U } from "./datum.js";
import { holen, ortZuKoordinaten, datumLang, uhrzeit, sauber } from "./wunsch-hilfe.js";

const API = () => String(process.env.BRIGHTSKY_API || "https://api.brightsky.dev").replace(/\/$/, "");
const DATEI = "unwetter";
const STUFEN = { minor: { name: "Wetterwarnung", farbe: "#ffe14d", rang: 1 }, moderate: { name: "Markante Warnung", farbe: "#ff9a2a", rang: 2 }, severe: { name: "Unwetterwarnung", farbe: "#ff4a3a", rang: 3 }, extreme: { name: "Extremes Unwetter", farbe: "#c03cff", rang: 4 } };

export const einstellungen = () => ({ an: true, ort: "", abStufe: "minor", ...(store.load(DATEI, {}).einstellungen || {}) });
export function einstellen(e = {}) {
  const d = store.load(DATEI, {});
  const alt = einstellungen();
  d.einstellungen = { an: e.an ?? alt.an, ort: e.ort !== undefined ? String(e.ort).slice(0, 80) : alt.ort, abStufe: STUFEN[e.abStufe] ? e.abStufe : alt.abStufe };
  store.save(DATEI, d);
  cache = null;
  return d.einstellungen;
}

let cache = null; // { zeit, daten }
/** Aktuelle Warnungen für den Ort. */
export async function warnungen({ frisch = false } = {}) {
  if (!frisch && cache && Date.now() - cache.zeit < 5 * 60 * 1000) return cache.daten;
  const e = einstellungen();
  const ort = await ortZuKoordinaten(e.ort || config.city);
  const d = await holen(`${API()}/alerts?lat=${ort.lat}&lon=${ort.lon}&tz=${encodeURIComponent(config.timezone)}`);
  const liste = (d.alerts || []).map((a) => ({
    id: String(a.id ?? a.alert_id ?? `${a.event_code}-${a.onset}`),
    stufe: STUFEN[a.severity] ? a.severity : "minor",
    stufeName: (STUFEN[a.severity] || STUFEN.minor).name,
    farbe: (STUFEN[a.severity] || STUFEN.minor).farbe,
    titel: a.headline_de || a.event_de || a.headline_en || "Wetterwarnung",
    ereignis: a.event_de || "",
    text: a.description_de || a.description_en || "",
    tipp: a.instruction_de || "",
    ab: a.onset || a.effective || null,
    bis: a.expires || null,
  })).sort((x, y) => STUFEN[y.stufe].rang - STUFEN[x.stufe].rang);
  const daten = { ort: d.location?.name || ort.name, warnungen: liste, stand: new Date().toISOString(), quelle: "Deutscher Wetterdienst (über Bright Sky)" };
  cache = { zeit: Date.now(), daten };
  return daten;
}

export function satz(d) {
  if (!d.warnungen.length) return `Für ${d.ort} gibt es gerade keine Wetterwarnung vom DWD.`;
  const w = d.warnungen[0];
  const zeit = w.bis ? ` bis ${datumLang(w.bis) === datumLang(new Date().toISOString()) ? "" : `${datumLang(w.bis)}, `}${uhrzeit(w.bis)} Uhr` : "";
  const mehr = d.warnungen.length > 1 ? ` Insgesamt ${d.warnungen.length} Warnungen.` : "";
  return `Achtung, ${w.stufeName} für ${d.ort}: ${w.ereignis || w.titel}${zeit}.${w.tipp ? ` ${w.tipp.split(/(?<=\.)\s/)[0]}` : ""}${mehr}`;
}

/** Hintergrund-Prüfung: neue Warnungen melden (einmal je Warnung). */
export async function pruefen(melde) {
  const e = einstellungen();
  if (!e.an || IST_EVE) return;
  let d;
  try { d = await warnungen({ frisch: true }); } catch { return; }
  const st = store.load(DATEI, {});
  const gemeldet = new Set(st.gemeldet || []);
  const neu = d.warnungen.filter((w) => !gemeldet.has(w.id) && STUFEN[w.stufe].rang >= STUFEN[e.abStufe].rang);
  for (const w of neu) {
    gemeldet.add(w.id);
    logbuch.eintragen({ bereich: "wetter", titel: `DWD: ${w.stufeName} – ${w.ereignis || w.titel}`, details: w.text.slice(0, 300) });
    try { await melde(`⚠️ ${w.stufeName} (${d.ort})`, `${w.titel}${w.bis ? ` · bis ${uhrzeit(w.bis)} Uhr` : ""}\n${w.tipp || w.text}`.slice(0, 900), { art: "unwetter", wichtig: STUFEN[w.stufe].rang >= STUFEN.severe.rang }); } catch { /* egal */ }
  }
  st.gemeldet = [...gemeldet].slice(-200);
  st.zuletzt = d.stand;
  store.save(DATEI, st);
}

const FRAGE = U(/\b(gibt es|gibts|habe ich|haben wir|kommt|kommen)?\s*(eine |ein |ne )?(unwetter|unwetterwarnung|wetterwarnung|warnung vor gewitter|gewitterwarnung|sturmwarnung|glättewarnung|glaettewarnung|dwd-?warnung|dwd)\b/);
export async function quickCommand(text) {
  const { k } = sauber(text);
  const schalter = k.match(/^(?:die )?(?:unwetter|wetter|dwd)-?(?: ?warnungen?)? (aus|an|ein)(?:schalten)?$/);
  if (schalter) {
    const an = schalter[1] !== "aus";
    einstellen({ an });
    return { answer: an ? "Unwetter-Warnungen sind an. Ich melde mich, wenn der DWD warnt." : "Unwetter-Warnungen sind aus.", actions: ["wunsch:unwetter"] };
  }
  if (!FRAGE.test(k)) return null;
  try {
    const d = await warnungen();
    return { answer: satz(d), actions: ["wunsch:unwetter"] };
  } catch (err) {
    return { answer: `Ich komme gerade nicht an die DWD-Warnungen (${err.message}).`, actions: ["wunsch:unwetter"] };
  }
}
