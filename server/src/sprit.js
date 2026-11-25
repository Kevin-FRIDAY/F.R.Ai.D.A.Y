// Spritpreise in der Nähe (v1.166.0, Stern-Idee aus der Ideen-Schmiede).
// Tankerkönig (creativecommons.tankerkoenig.de) liefert die Preise der Markttransparenzstelle für Kraftstoffe,
// live und kostenlos. Man braucht nur einen kostenlosen Schlüssel (onboarding.tankerkoenig.de).
// Schlüssel: Fenster "Meine Wunschliste" → Spritpreise, oder .env TANKERKOENIG_API_KEY. Ohne Claude.
import * as store from "./store.js";
import { config } from "./config.js";
import { holen, ortZuKoordinaten, sauber } from "./wunsch-hilfe.js";
import { U } from "./datum.js";

const API = () => String(process.env.TANKERKOENIG_API || "https://creativecommons.tankerkoenig.de/json").replace(/\/$/, "");
const DATEI = "sprit";
export const SORTEN = { e5: "Super E5", e10: "Super E10", diesel: "Diesel" };

const daten = () => store.load(DATEI, {});
const schluessel = () => String(process.env.TANKERKOENIG_API_KEY || daten().key || "").trim();
export const eingerichtet = () => /^[0-9a-f-]{36}$/i.test(schluessel());

export function einstellungen() {
  const e = daten().einstellungen || {};
  return { sorte: SORTEN[e.sorte] ? e.sorte : "e5", radius: Math.min(25, Math.max(1, Number(e.radius) || 5)), ort: e.ort || "" };
}
export function einstellen(e = {}) {
  const d = daten();
  const alt = einstellungen();
  d.einstellungen = { sorte: SORTEN[e.sorte] ? e.sorte : alt.sorte, radius: e.radius !== undefined ? Math.min(25, Math.max(1, Number(e.radius) || 5)) : alt.radius, ort: e.ort !== undefined ? String(e.ort).slice(0, 80) : alt.ort };
  if (e.key !== undefined && String(e.key).trim()) {
    const k = String(e.key).trim();
    if (!/^[0-9a-f-]{36}$/i.test(k)) throw new Error("Der Tankerkönig-Schlüssel sieht so aus: 00000000-0000-0000-0000-000000000000 (36 Zeichen).");
    d.key = k;
  }
  store.save(DATEI, d);
  cache.clear();
  return { ...d.einstellungen, eingerichtet: eingerichtet() };
}

const cache = new Map();
/** Günstigste Tankstellen im Umkreis. */
export async function preise({ sorte, radius, ort } = {}) {
  if (!eingerichtet()) throw Object.assign(new Error("Für die Spritpreise brauche ich einmal einen kostenlosen Tankerkönig-Schlüssel. Trag ihn in der Wunschliste unter Spritpreise ein."), { status: 400, ohneSchluessel: true });
  const e = einstellungen();
  const s = SORTEN[sorte] ? sorte : e.sorte;
  const r = Math.min(25, Math.max(1, Number(radius) || e.radius));
  const o = await ortZuKoordinaten(ort || e.ort || config.city);
  const k = `${s}|${r}|${o.lat}|${o.lon}`;
  const c = cache.get(k);
  if (c && Date.now() - c.zeit < 4 * 60 * 1000) return c.daten;
  const d = await holen(`${API()}/list.php?lat=${o.lat}&lng=${o.lon}&rad=${r}&sort=price&type=${s}&apikey=${encodeURIComponent(schluessel())}`);
  if (d.ok === false) throw new Error(d.message || "Tankerkönig meldet einen Fehler.");
  const liste = (d.stations || [])
    .filter((x) => typeof x.price === "number" && x.price > 0)
    .map((x) => ({ id: x.id, name: x.name, marke: x.brand || "", strasse: [x.street, x.houseNumber].filter(Boolean).join(" "), ort: [x.postCode, x.place].filter(Boolean).join(" "), km: Math.round(x.dist * 10) / 10, preis: x.price, offen: x.isOpen !== false, lat: x.lat, lon: x.lng }))
    .sort((a, b) => (b.offen - a.offen) || a.preis - b.preis);
  const daten = { sorte: s, sorteName: SORTEN[s], radius: r, ort: o.name, stand: new Date().toISOString(), tankstellen: liste.slice(0, 15), quelle: "Tankerkönig · Markttransparenzstelle für Kraftstoffe (CC BY 4.0)" };
  cache.set(k, { zeit: Date.now(), daten });
  return daten;
}

const euro = (p) => `${p.toFixed(2).replace(".", ",")} Euro`;
export function satz(d) {
  const offen = d.tankstellen.filter((t) => t.offen);
  if (!offen.length) return `Im Umkreis von ${d.radius} Kilometern um ${d.ort} hat gerade keine Tankstelle mit ${d.sorteName} offen.`;
  const t = offen[0];
  const zweite = offen[1] ? ` Danach ${offen[1].marke || offen[1].name} für ${euro(offen[1].preis)}.` : "";
  const spanne = offen.length > 2 ? ` Der Unterschied zur teuersten liegt bei ${Math.round((offen[offen.length - 1].preis - t.preis) * 100)} Cent pro Liter.` : "";
  return `${d.sorteName} ist gerade am billigsten bei ${t.marke || t.name}, ${t.strasse}, ${String(t.km).replace(".", ",")} Kilometer entfernt: ${euro(t.preis)} pro Liter.${zweite}${spanne}`;
}

const FRAGE = U(/\b(sprit|spritpreis\w*|benzinpreis\w*|dieselpreis\w*|tankstelle\w*|tanken|super ?e ?(5|10)|diesel)\b/);
const PREIS = U(/\b(billig|günstig|guenstig|preis|kostet|teuer|wo|wie viel|was kostet|tanken|tankstelle)\w*/);
export async function quickCommand(text) {
  const { k } = sauber(text);
  if (!FRAGE.test(k) || !PREIS.test(k)) return null;
  if (/\b(getankt|tankbuch)\b/.test(k)) return null; // gehört zum Auto-Logbuch
  const sorte = /diesel/.test(k) ? "diesel" : /e ?10/.test(k) ? "e10" : /super|e ?5|benzin/.test(k) ? "e5" : undefined;
  try {
    const d = await preise({ sorte });
    return { answer: satz(d), actions: ["wunsch:sprit"] };
  } catch (err) {
    return { answer: err.ohneSchluessel ? err.message : `Die Spritpreise kann ich gerade nicht abrufen (${err.message}).`, actions: ["wunsch:sprit"] };
  }
}
