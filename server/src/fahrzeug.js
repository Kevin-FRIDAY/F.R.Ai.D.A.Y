// Auto-Logbuch (v1.169.0, Stern-Idee aus der Ideen-Schmiede).
// TÜV/HU, Ölwechsel, Reifenwechsel (von O bis O: Oktober bis Ostern), Inspektion und ein Tankbuch mit Verbrauch.
// Friday erinnert 30, 7 und 1 Tag vorher per Telegram/Push und im Herbst/Frühling an die Reifen. Ohne Claude.
// Nur ein Notizbuch: Friday bezahlt oder bucht nichts.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { IST_EVE } from "./config.js";
import { sauber, datumLang, tagStr, neueId } from "./wunsch-hilfe.js";
import { U } from "./datum.js";

const DATEI = "fahrzeug";
export const TERMINE = {
  tuev: { name: "TÜV / Hauptuntersuchung", kurz: "TÜV", icon: "🛡" },
  oel: { name: "Ölwechsel", kurz: "Ölwechsel", icon: "🛢" },
  inspektion: { name: "Inspektion", kurz: "Inspektion", icon: "🔧" },
  reifen: { name: "Reifenwechsel", kurz: "Reifenwechsel", icon: "🛞" },
  versicherung: { name: "Versicherung / Steuer", kurz: "Versicherung", icon: "📄" },
};

const laden = () => ({ autos: [], tank: [], gemeldet: [], ...store.load(DATEI, {}) });
const sichern = (d) => store.save(DATEI, d);
const zahl = (x) => { const n = Number(String(x ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const datumJahr = (d) => { const t = datumLang(`${d}T12:00:00`); return d.slice(0, 4) === tagStr().slice(0, 4) ? t : `${t} ${d.slice(0, 4)}`; };
const tageBis = (datum) => Math.round((Date.parse(`${datum}T12:00:00`) - Date.parse(`${tagStr()}T12:00:00`)) / 864e5);

export function stand() {
  const d = laden();
  if (!d.autos.length) d.autos.push({ id: "auto", name: "Mein Auto", kennzeichen: "", termine: {} });
  return d.autos.map((a) => {
    const tank = d.tank.filter((t) => t.auto === a.id).sort((x, y) => (x.datum < y.datum ? 1 : -1));
    return { ...a, termine: Object.fromEntries(Object.keys(TERMINE).map((k) => [k, a.termine?.[k] ? { datum: a.termine[k], tage: tageBis(a.termine[k]) } : null])), tank: tank.slice(0, 30), verbrauch: verbrauch(tank), reifenTipp: reifenTipp() };
  });
}

export function autoSpeichern({ id, name, kennzeichen, termine = {} } = {}) {
  const d = laden();
  let a = d.autos.find((x) => x.id === (id || "auto"));
  if (!a) { a = { id: id || (d.autos.length ? neueId() : "auto"), name: "Mein Auto", kennzeichen: "", termine: {} }; d.autos.push(a); }
  if (name !== undefined) a.name = String(name).slice(0, 60) || "Mein Auto";
  if (kennzeichen !== undefined) a.kennzeichen = String(kennzeichen).toUpperCase().slice(0, 15);
  for (const [k, v] of Object.entries(termine || {})) {
    if (!TERMINE[k]) continue;
    if (!v) delete a.termine[k];
    else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) a.termine[k] = v;
    else if (/^\d{4}-\d{2}$/.test(v)) a.termine[k] = `${v}-28`; // TÜV-Plakette: nur Monat
  }
  d.gemeldet = d.gemeldet.filter((g) => !g.startsWith(`${a.id}:`));
  sichern(d);
  return a;
}
export function autoWeg(id) {
  const d = laden();
  d.autos = d.autos.filter((a) => a.id !== id);
  d.tank = d.tank.filter((t) => t.auto !== id);
  sichern(d);
  return true;
}

/** Tankbuch: { liter, euro, km, voll } */
export function tanken({ auto = "auto", liter, euro, km, voll = true, datum } = {}) {
  const l = zahl(liter), e = zahl(euro), k = zahl(km);
  if (!l || l <= 0 || l > 250) throw new Error("Wie viele Liter? (z. B. 42,5)");
  const d = laden();
  if (!d.autos.length) d.autos.push({ id: "auto", name: "Mein Auto", kennzeichen: "", termine: {} });
  const eintrag = { id: neueId(), auto, datum: /^\d{4}-\d{2}-\d{2}$/.test(datum || "") ? datum : tagStr(), liter: l, euro: e && e > 0 ? e : null, km: k && k > 0 ? k : null, voll: voll !== false };
  d.tank.push(eintrag);
  d.tank = d.tank.slice(-500);
  sichern(d);
  logbuch.eintragen({ bereich: "auto", titel: `Getankt: ${l} Liter${eintrag.euro ? ` für ${eintrag.euro} €` : ""}` });
  return eintrag;
}
export function tankWeg(id) { const d = laden(); d.tank = d.tank.filter((t) => t.id !== id); sichern(d); return true; }

/** Durchschnittsverbrauch aus vollen Tankfüllungen mit Kilometerstand. */
function verbrauch(tank) {
  const v = tank.filter((t) => t.voll && t.km).sort((a, b) => a.km - b.km);
  if (v.length < 2) return null;
  const km = v[v.length - 1].km - v[0].km;
  const liter = v.slice(1).reduce((s, t) => s + t.liter, 0);
  if (km <= 0) return null;
  const mitPreis = tank.filter((t) => t.euro && t.liter);
  const preis = mitPreis.length ? mitPreis.reduce((s, t) => s + t.euro, 0) / mitPreis.reduce((s, t) => s + t.liter, 0) : null;
  return { l100: Math.round((liter / km) * 1000) / 10, km, literPreis: preis ? Math.round(preis * 1000) / 1000 : null, euro100: preis ? Math.round((liter / km) * 100 * preis * 100) / 100 : null };
}

function reifenTipp() {
  const m = Number(tagStr().slice(5, 7));
  if (m === 10 || m === 11) return "Von O bis O: Ab Oktober gehören Winterreifen drauf.";
  if (m === 3 || m === 4) return "Ostern ist nah: Zeit für die Sommerreifen, wenn kein Frost mehr kommt.";
  return "";
}

const satzTermin = (a, k) => {
  const t = a.termine[k];
  if (!t) return `Für ${TERMINE[k].kurz} ist noch kein Datum eingetragen.`;
  const tage = t.tage;
  return tage < 0 ? `${TERMINE[k].kurz} ist seit ${-tage} Tagen überfällig (war am ${datumJahr(t.datum)}).` : tage === 0 ? `${TERMINE[k].kurz} ist heute fällig.` : `${TERMINE[k].kurz} ist am ${datumJahr(t.datum)} fällig, in ${tage} Tagen.`;
};

/** Erinnerungen 30, 7, 1 Tag vorher und am Tag selbst (einmal je Stufe). */
export async function pruefen(melde) {
  if (IST_EVE) return;
  const d = laden();
  const gemeldet = new Set(d.gemeldet);
  for (const a of stand()) {
    for (const k of Object.keys(TERMINE)) {
      const t = a.termine[k];
      if (!t) continue;
      const stufe = t.tage <= 0 ? 0 : t.tage <= 1 ? 1 : t.tage <= 7 ? 7 : t.tage <= 30 ? 30 : null;
      if (stufe === null || t.tage < -3) continue;
      const key = `${a.id}:${k}:${t.datum}:${stufe}`;
      if (gemeldet.has(key)) continue;
      gemeldet.add(key);
      try { await melde(`${TERMINE[k].icon} ${a.name}: ${TERMINE[k].kurz}`, satzTermin(a, k), { art: "auto" }); } catch { /* egal */ }
    }
  }
  const monat = tagStr().slice(0, 7);
  const tipp = reifenTipp();
  if (tipp && Number(tagStr().slice(8, 10)) >= 1 && !gemeldet.has(`reifen-tipp:${monat}`) && /^(10|03)$/.test(monat.slice(5)) && d.autos.length && d.autos.some((a) => !a.termine?.reifen)) {
    gemeldet.add(`reifen-tipp:${monat}`);
    try { await melde("🛞 Reifenwechsel", tipp, { art: "auto" }); } catch { /* egal */ }
  }
  d.gemeldet = [...gemeldet].slice(-300);
  sichern(d);
}

const MONATE = { januar: 1, jänner: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };
/** "im März 2027", "am 15.3.2027", "15.03.27", "03/2027" → YYYY-MM-DD */
export function datumAus(k) {
  let m = k.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) { const j = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${j}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  m = k.match(/(\d{1,2})\s*\/\s*(\d{4})/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-28`;
  m = k.match(/(januar|jänner|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*(\d{4})?/);
  if (m) { const mon = MONATE[m[1]]; let j = Number(m[2]) || Number(tagStr().slice(0, 4)); if (!m[2] && mon < Number(tagStr().slice(5, 7))) j++; return `${j}-${String(mon).padStart(2, "0")}-28`; }
  return null;
}

const ART = [[/t(ü|ue)v|hauptuntersuchung|\bhu\b/, "tuev"], [/ölwechsel|oelwechsel|\böl\b/, "oel"], [/inspektion|wartung|service/, "inspektion"], [/reifen/, "reifen"], [/versicherung|kfz-?steuer/, "versicherung"]];
const art = (k) => (ART.find(([re]) => re.test(k)) || [])[1];
export async function quickCommand(text) {
  const { k } = sauber(text);
  // Tankbuch: "ich habe 42 Liter für 71,50 Euro getankt bei 85000 km"
  if (/\bgetankt\b|\btankbuch\b/.test(k)) {
    if (/^(öffne |zeig )?(das |mein )?tankbuch$/.test(k)) return { answer: "Hier ist dein Tankbuch.", actions: ["wunsch:fahrzeug"] };
    const liter = (k.match(/(\d+(?:[.,]\d+)?)\s*(?:liter|l)\b/) || [])[1];
    const euro = (k.match(/(\d+(?:[.,]\d+)?)\s*(?:euro|€)/) || [])[1];
    const km = (k.match(/(\d{1,3}(?:[. ]?\d{3})+|\d+)\s*(?:km|kilometer)/) || [])[1];
    if (!liter) return { answer: "Wie viel hast du getankt? Sag zum Beispiel: „Ich habe 42 Liter für 70 Euro getankt, Kilometerstand 85.000“.", actions: ["wunsch:fahrzeug"] };
    try {
      const e = tanken({ liter, euro, km: km?.replace(/ /g, "") });
      const v = stand()[0]?.verbrauch;
      return { answer: `Eingetragen: ${String(e.liter).replace(".", ",")} Liter${e.euro ? ` für ${String(e.euro).replace(".", ",")} Euro` : ""}.${v ? ` Dein Schnitt liegt bei ${String(v.l100).replace(".", ",")} Litern auf 100 Kilometer.` : e.km ? "" : " Sag beim nächsten Mal den Kilometerstand dazu, dann rechne ich den Verbrauch aus."}`, actions: ["wunsch:fahrzeug"] };
    } catch (err) { return { answer: err.message, actions: ["wunsch:fahrzeug"] }; }
  }
  if (!/\b(auto|wagen|fahrzeug|t(ü|ue)v|hauptuntersuchung|ölwechsel|oelwechsel|inspektion|reifenwechsel|winterreifen|sommerreifen|verbrauch)\b/.test(k)) return null;
  if (/^(öffne |zeig )?(das |mein )?(auto-?logbuch|fahrzeug)( an)?$/.test(k)) return { answer: "Hier ist dein Auto-Logbuch.", actions: ["wunsch:fahrzeug"] };
  const a = art(k);
  // Eintragen: "der TÜV ist im März 2027 fällig", "nächster Ölwechsel am 15.6.2027"
  const datum = datumAus(k);
  if (a && datum && /\b(fällig|faellig|ist im|ist am|nächste|naechste|muss|trag|eintragen|bis)\b/.test(k)) {
    autoSpeichern({ termine: { [a]: datum } });
    return { answer: `Notiert: ${TERMINE[a].kurz} am ${datumJahr(datum)}. Ich erinnere dich 30 Tage, eine Woche und einen Tag vorher.`, actions: ["wunsch:fahrzeug"] };
  }
  if (/verbrauch/.test(k)) {
    const v = stand()[0]?.verbrauch;
    return { answer: v ? `Dein Auto braucht im Schnitt ${String(v.l100).replace(".", ",")} Liter auf 100 Kilometer${v.euro100 ? `, das sind etwa ${String(v.euro100).replace(".", ",")} Euro pro 100 Kilometer` : ""}.` : "Für den Verbrauch brauche ich mindestens zwei volle Tankfüllungen mit Kilometerstand im Tankbuch.", actions: ["wunsch:fahrzeug"] };
  }
  if (a && /\b(wann|fällig|faellig|wie lange|muss)\b/.test(k)) {
    const auto = stand()[0];
    return { answer: satzTermin(auto, a) + (a === "reifen" && reifenTipp() ? ` ${reifenTipp()}` : ""), actions: ["wunsch:fahrzeug"] };
  }
  if (/\b(was steht an|termine|fällig|faellig)\b/.test(k) && /\b(auto|wagen|fahrzeug)\b/.test(k)) {
    const auto = stand()[0];
    const da = Object.keys(TERMINE).filter((x) => auto.termine[x]).sort((x, y) => auto.termine[x].tage - auto.termine[y].tage);
    return { answer: da.length ? da.slice(0, 3).map((x) => satzTermin(auto, x)).join(" ") : "Im Auto-Logbuch steht noch nichts. Sag zum Beispiel: „Der TÜV ist im März 2027 fällig.“", actions: ["wunsch:fahrzeug"] };
  }
  return null;
}
