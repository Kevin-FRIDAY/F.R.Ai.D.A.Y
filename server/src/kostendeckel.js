// Kosten-Deckel (v1.135.0, Idee aus Conway-Research/automaton "Überlebens-Stufen", MIT – in Node nachgebaut).
// Feste Grenze pro Stunde und pro Tag für Claude. Je näher die Grenze, desto sparsamer:
//   normal   → Modell nach Denk-Tempo
//   sparsam  → ab 80 % der Grenze (oder Guthaben knapp): günstiges Modell, keine Websuche
//   gesperrt → Grenze erreicht: nur noch Offline-Befehle, bis die Stunde/der Tag vorbei ist
// Zählt ALLE Claude-Kosten (Chat, Spiele, Werkstatt, Video …), weil energie.recordUsage hier bucht.
// Friday bewegt dabei kein Geld: Es ist nur eine Bremse für den eigenen Verbrauch.
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";

const NAME = "kostendeckel";
const STANDARD = { an: true, stunde: 1, tag: 3, spar_ab: 80 };

function jetztSchluessel(d = new Date()) {
  const lokal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
  return { tag: lokal.slice(0, 10), stunde: lokal.slice(0, 13) };
}
function laden() {
  const d = store.load(NAME, {});
  return { ...STANDARD, ...d, tage: d.tage || {}, stunden: d.stunden || {}, gemeldet: d.gemeldet || {} };
}
function speichern(d) {
  const tage = Object.keys(d.tage).sort().slice(-35);
  d.tage = Object.fromEntries(tage.map((k) => [k, d.tage[k]]));
  const st = Object.keys(d.stunden).sort().slice(-48);
  d.stunden = Object.fromEntries(st.map((k) => [k, d.stunden[k]]));
  store.save(NAME, d);
}

/** Von energie.recordUsage nach jeder Claude-Antwort aufgerufen. */
export function buche(usd, quelle = "chat") {
  if (!(usd > 0)) return;
  try {
    const d = laden();
    const k = jetztSchluessel();
    d.tage[k.tag] = Math.round(((d.tage[k.tag] || 0) + usd) * 10000) / 10000;
    d.stunden[k.stunde] = Math.round(((d.stunden[k.stunde] || 0) + usd) * 10000) / 10000;
    d.letzte_quelle = quelle;
    speichern(d);
    const s = stand();
    if (s.stufe === "gesperrt" && d.gemeldet.gesperrt !== k.stunde) {
      d.gemeldet.gesperrt = k.stunde;
      speichern(d);
      eintragen({ bereich: "energie", titel: "Kosten-Deckel erreicht – Friday nutzt nur noch Offline-Befehle", details: s.grund, ok: false });
    } else if (s.stufe === "sparsam" && d.gemeldet.sparsam !== k.tag) {
      d.gemeldet.sparsam = k.tag;
      speichern(d);
      eintragen({ bereich: "energie", titel: "Kosten-Deckel fast erreicht – Friday spart", details: s.grund });
    }
  } catch { /* nie Friday aufhalten */ }
}

export function stand() {
  const d = laden();
  const k = jetztSchluessel();
  const tag = d.tage[k.tag] || 0;
  const stunde = d.stunden[k.stunde] || 0;
  const pt = d.tag > 0 ? Math.round((tag / d.tag) * 100) : 0;
  const ps = d.stunde > 0 ? Math.round((stunde / d.stunde) * 100) : 0;
  let stufe = "normal", grund = "";
  if (d.an && d.tag > 0 && tag >= d.tag) { stufe = "gesperrt"; grund = `Heute schon ${fmt(tag)} von ${fmt(d.tag)} verbraucht.`; }
  else if (d.an && d.stunde > 0 && stunde >= d.stunde) { stufe = "gesperrt"; grund = `In dieser Stunde schon ${fmt(stunde)} von ${fmt(d.stunde)} verbraucht.`; }
  else if (d.an && (pt >= d.spar_ab || ps >= d.spar_ab)) { stufe = "sparsam"; grund = `${Math.max(pt, ps)} % der Grenze erreicht.`; }
  const verlauf = Object.entries(d.tage).sort().slice(-14).map(([t, usd]) => ({ tag: t, usd }));
  return { an: d.an, grenze: { stunde: d.stunde, tag: d.tag, spar_ab: d.spar_ab }, heute: tag, diese_stunde: stunde, prozent: { tag: pt, stunde: ps }, stufe, grund, verlauf };
}

export function einstellen({ an, stunde, tag, spar_ab } = {}) {
  const d = laden();
  if (an !== undefined) d.an = Boolean(an);
  const zahl = (v, min, max) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : null; };
  if (stunde !== undefined) { const n = zahl(stunde, 0, 1000); if (n == null) return { error: "Stunden-Grenze bitte als Zahl in Dollar (0 = keine)." }; d.stunde = n; }
  if (tag !== undefined) { const n = zahl(tag, 0, 10000); if (n == null) return { error: "Tages-Grenze bitte als Zahl in Dollar (0 = keine)." }; d.tag = n; }
  if (spar_ab !== undefined) { const n = zahl(spar_ab, 10, 100); if (n == null) return { error: "Sparen ab: 10 bis 100 %." }; d.spar_ab = n; }
  speichern(d);
  eintragen({ bereich: "energie", titel: `Kosten-Deckel ${d.an ? `an: ${fmt(d.stunde)}/Stunde, ${fmt(d.tag)}/Tag` : "aus"}`, quelle: "dashboard" });
  return stand();
}

/** Für brain.js: null = Claude darf, sonst ein Satz, warum nicht. */
export function sperre() {
  const s = stand();
  return s.stufe === "gesperrt" ? `Mein Kosten-Deckel ist erreicht, Boss. ${s.grund} Bis dahin laufen nur meine Offline-Befehle. Du kannst die Grenze im Kontrollraum unter Kosten-Deckel ändern.` : null;
}
/** Für energie.brainModel: ab 80 % (und erst recht gesperrt) das günstige Modell nehmen. */
export function sparen() {
  return stand().stufe !== "normal";
}

function fmt(usd) { return `${(Math.round(usd * 100) / 100).toFixed(2).replace(".", ",")} $`; }
