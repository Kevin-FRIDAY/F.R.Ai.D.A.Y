// Internetradio per Sprache (v1.166.0, Stern-Idee aus der Ideen-Schmiede).
// Über 30.000 Sender aus dem freien Verzeichnis radio-browser.info (ohne Schlüssel).
// "Friday, spiel Radio Eins" → Sender suchen, im Dashboard abspielen. "Radio aus" stoppt.
// Lieblingssender lassen sich speichern und dann auch ohne das Wort "Radio" starten ("spiel 1Live"). Ohne Claude.
import * as store from "./store.js";
import { holen, sauber, neueId } from "./wunsch-hilfe.js";
import { U } from "./datum.js";

const SERVER = (process.env.RADIO_BROWSER_API ? [process.env.RADIO_BROWSER_API] : ["https://de1.api.radio-browser.info", "https://fi1.api.radio-browser.info", "https://de2.api.radio-browser.info"]).map((s) => s.replace(/\/$/, ""));
const DATEI = "radio";

const daten = () => ({ favoriten: [], zuletzt: null, ...store.load(DATEI, {}) });
const sichern = (d) => store.save(DATEI, d);
const sicher = (u) => (/^https?:\/\//i.test(String(u || "")) ? String(u) : "");

function sender(x) {
  return { id: x.stationuuid, name: String(x.name || "").trim().slice(0, 80), url: sicher(x.url_resolved || x.url), bild: sicher(x.favicon), land: x.countrycode || "", tags: String(x.tags || "").split(",").filter(Boolean).slice(0, 4), codec: x.codec || "", kbit: x.bitrate || 0, beliebt: x.clickcount || 0 };
}
async function api(pfad) {
  let letzter;
  for (const s of SERVER) {
    try { return await holen(`${s}/json/${pfad}`, { timeout: 8000 }); } catch (err) { letzter = err; }
  }
  throw letzter || new Error("Radio-Verzeichnis nicht erreichbar");
}

/** Sender suchen (Name), beliebte zuerst, deutsche Sender bevorzugt. */
export async function suchen(q, { limit = 12 } = {}) {
  const name = String(q || "").trim().slice(0, 60);
  if (!name) return beliebt();
  const roh = await api(`stations/search?name=${encodeURIComponent(name)}&limit=40&hidebroken=true&order=clickcount&reverse=true`);
  const n = name.toLowerCase().replace(/\s+/g, "");
  return roh.map(sender).filter((s) => s.url)
    .sort((a, b) => (b.name.toLowerCase().replace(/\s+/g, "") === n) - (a.name.toLowerCase().replace(/\s+/g, "") === n) || (b.land === "DE") - (a.land === "DE") || b.beliebt - a.beliebt)
    .slice(0, limit);
}
export async function beliebt() {
  return (await api("stations/search?countrycode=DE&limit=24&hidebroken=true&order=clickcount&reverse=true")).map(sender).filter((s) => s.url);
}
/** Beim Verzeichnis melden, dass der Sender gehört wird (hält die Beliebtheit aktuell, so wünscht es radio-browser). */
export function geklickt(id) { if (/^[0-9a-f-]{36}$/i.test(id || "")) api(`url/${id}`).catch(() => {}); }

export const favoriten = () => daten().favoriten;
export function favoritDazu(s = {}) {
  const d = daten();
  const url = sicher(s.url);
  if (!url || !s.name) throw new Error("Sender fehlt.");
  if (!d.favoriten.some((f) => f.url === url)) d.favoriten.push({ id: s.id || neueId(), name: String(s.name).slice(0, 80), url, bild: sicher(s.bild) });
  sichern(d);
  return d.favoriten;
}
export function favoritWeg(id) { const d = daten(); d.favoriten = d.favoriten.filter((f) => f.id !== id); sichern(d); return d.favoriten; }
export function merkeZuletzt(s) { const d = daten(); d.zuletzt = { id: s.id, name: s.name, url: s.url, bild: s.bild || "" }; sichern(d); }

const abspielen = (s) => { merkeZuletzt(s); geklickt(s.id); return `radio_spiel:${encodeURIComponent(JSON.stringify({ name: s.name, url: s.url, bild: s.bild || "" }))}`; };
const normal = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9äöüß]+/g, "");

export async function quickCommand(text) {
  const { t, k } = sauber(text);
  if (/^(das )?radio (aus|stopp|stop|beenden|leiser aus)$|^(stopp|stop|beende) (das )?radio$|^mach (das )?radio aus$/.test(k)) return { answer: "Radio ist aus.", actions: ["radio_stopp"] };
  if (/^(öffne |zeig )?(das |mein )?(internet)?radio( an)?$|^(mach|schalte?) (das )?radio an$/.test(k)) {
    const z = daten().zuletzt;
    if (z && /an$/.test(k)) return { answer: `Ich spiele ${z.name}.`, actions: ["wunsch:radio", abspielen(z)] };
    return { answer: "Welchen Sender möchtest du hören? Sag zum Beispiel: „Spiel Radio Eins.“", actions: ["wunsch:radio"] };
  }
  const m = t.match(/^(?:bitte )?(?:spiel|spiele|starte|mach|schalte?)\s+(?:mir\s+)?(?:den\s+|das\s+)?(?:(?:radio)?sender\s+|internetradio\s+)?(.+?)(?:\s+an|\s+ab)?$/i);
  if (!m) return null;
  const wunsch = m[1].trim();
  const fav = favoriten().find((f) => normal(f.name) === normal(wunsch) || normal(`radio ${f.name}`) === normal(wunsch));
  if (fav) return { answer: `Ich spiele ${fav.name}.`, actions: ["wunsch:radio", abspielen(fav)] };
  // Ohne Lieblingssender nur, wenn es klar ums Radio geht (sonst ist "spiel Iron Man" ein Film, "spiel Snake" ein Spiel).
  if (!/\b(radio|sender|fm|welle|eins|1live|bayern ?\d|antenne|ndr|wdr|swr|hr\d|mdr|rbb|br ?\d|dlf|deutschlandfunk|ffh|bigfm|energy|sunshine live|klassik|jazz ?radio|lounge ?fm)\b/i.test(wunsch)) return null;
  const q = wunsch.replace(/^(das |den )?(internet)?radio(sender)?\s*/i, "").trim() || wunsch;
  try {
    let liste = await suchen(q, { limit: 5 });
    if (!liste.length && q !== wunsch) liste = await suchen(wunsch, { limit: 5 });
    if (!liste.length) return { answer: `Ich finde keinen Sender namens ${q}.`, actions: ["wunsch:radio"] };
    const s = liste[0];
    return { answer: `Ich spiele ${s.name}.`, actions: ["wunsch:radio", abspielen(s)] };
  } catch (err) {
    return { answer: `Das Radio-Verzeichnis ist gerade nicht erreichbar (${err.message}).`, actions: ["wunsch:radio"] };
  }
}
