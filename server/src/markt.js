// Fridays Markt-Radar: Kronos rechnet lokal 100 mögliche Verläufe, dazu ein Papierdepot mit Spielgeld.
// Es gibt hier keine echten Orders und keine Verbindung zu einer Börse.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { DATA_DIR, ROOT } from "./config.js";

const PYTHON = path.resolve(ROOT, "..", ".venv", "bin", "python");
const SCRIPT = path.join(ROOT, "tools", "markt.py");
const KRONOS = path.resolve(ROOT, "..", "kronos");
const DEPOT_FILE = path.join(DATA_DIR, "papierdepot.json");
export const MAERKTE = { gold: "Gold", bitcoin: "Bitcoin", ethereum: "Ethereum" };
const FRESH_MS = 30 * 60 * 1000;
const START_GELD = 10000;
const KAUF_BETRAG = 1000;

const cache = {};   // asset -> { at, data }
const state = {};   // asset -> { status, seit, error }
let queue = Promise.resolve();

export function marktReady() {
  return fs.existsSync(PYTHON) && fs.existsSync(SCRIPT) && fs.existsSync(path.join(KRONOS, "model"));
}

export function signalOf(d) {
  const share = d.hoeher / d.anzahl;
  return share >= 0.7 ? "kaufen" : share <= 0.3 ? "verkaufen" : "abwarten";
}

function runForecast(asset) {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON, [SCRIPT, asset, "100", "24"], { env: { ...process.env, FRIDAY_KRONOS_DIR: KRONOS } });
    let out = "", err = "", done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    // Hängt der Download oder die Rechnung, nach 10 Minuten abbrechen.
    const timer = setTimeout(() => { proc.kill("SIGKILL"); finish({ error: "Die Rechnung hat zu lange gedauert." }); }, 10 * 60 * 1000);
    proc.on("error", (e) => finish({ error: `Kronos ließ sich nicht starten (${e.code || e.message}).` }));
    proc.stdout.on("data", (c) => { out += c.toString(); });
    proc.stderr.on("data", (c) => { err = (err + c.toString()).slice(-1500); });
    proc.on("close", (code) => {
      const line = out.trim().split("\n").pop() || "";
      try {
        const data = JSON.parse(line);
        if (data.error) return finish({ error: data.error });
        if (code !== 0) return finish({ error: `Abbruch (Code ${code})` });
        finish({ data });
      } catch {
        finish({ error: (err.trim().split("\n").pop() || `Abbruch (Code ${code})`).slice(0, 300) });
      }
    });
  });
}

// Liefert die Prognose aus dem Zwischenspeicher oder startet eine neue Rechnung (immer nur eine gleichzeitig).
export function getForecast(asset, { force = false } = {}) {
  if (!MAERKTE[asset]) return { status: "fehler", error: "Unbekannter Markt" };
  if (!marktReady()) return { status: "fehler", error: "Kronos ist auf diesem Mac nicht installiert." };
  const c = cache[asset];
  const busy = state[asset] && ["rechnet", "wartet"].includes(state[asset].status);
  if (!force && c && Date.now() - c.at < FRESH_MS) return { status: "fertig", at: c.at, data: c.data, signal: signalOf(c.data) };
  if (!busy) {
    state[asset] = { status: "wartet", seit: Date.now() };
    queue = queue.then(async () => {
      state[asset] = { status: "rechnet", seit: Date.now() };
      const r = await runForecast(asset);
      if (r.data) {
        cache[asset] = { at: Date.now(), data: r.data };
        state[asset] = { status: "fertig" };
        logPrognose(r.data);
      } else state[asset] = { status: "fehler", error: r.error };
    }).catch((e) => { state[asset] = { status: "fehler", error: String(e?.message || e).slice(0, 200) }; }); // Warteschlange nie blockieren
  }
  const s = state[asset];
  // Ältere Prognose weiter zeigen, während eine neue rechnet.
  return { status: s.status, seit: s.seit, error: s.error, at: c?.at, data: c?.data, signal: c ? signalOf(c.data) : undefined };
}

// ---------- Papierdepot ----------
function loadDepot() {
  try { return JSON.parse(fs.readFileSync(DEPOT_FILE, "utf8")); } catch { return { start: START_GELD, cash: START_GELD, bestand: {}, trades: [], prognosen: [] }; }
}
function saveDepot(d) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DEPOT_FILE, JSON.stringify(d, null, 2));
}

function logPrognose(data) {
  const d = loadDepot();
  const faellig = new Date(new Date(data.zeit_jetzt).getTime() + data.stunden * 3600 * 1000).toISOString();
  d.preise = { ...(d.preise || {}), [data.asset]: { preis: data.jetzt, zeit: data.zeit_jetzt } };
  d.prognosen.push({ asset: data.asset, zeit: data.zeit_jetzt, jetzt: data.jetzt, hoeher: data.hoeher, anzahl: data.anzahl, median: data.median, faellig });
  if (d.prognosen.length > 300) d.prognosen.shift();
  bewerten(d);
  saveDepot(d);
}

// Prognosen bewerten, sobald der Kurs zum fälligen Zeitpunkt bekannt ist.
function bewerten(d) {
  for (const p of d.prognosen) {
    if (p.treffer !== undefined) continue;
    const kerzen = cache[p.asset]?.data?.kerzen || [];
    const k = kerzen.find(([t]) => new Date(t) >= new Date(p.faellig));
    if (!k) continue;
    const real = k[4];
    p.real = real;
    p.treffer = (p.hoeher / p.anzahl >= 0.5) === (real > p.jetzt);
  }
}

export function getDepot() {
  const d = loadDepot();
  bewerten(d);
  const positionen = Object.entries(d.bestand).filter(([, m]) => m > 0).map(([asset, menge]) => {
    const preis = cache[asset]?.data?.jetzt ?? d.preise?.[asset]?.preis; // nach Neustart: letzter bekannter Kurs
    return { asset, name: MAERKTE[asset], menge, preis: preis ?? null, wert: preis ? menge * preis : null };
  });
  const wert = d.cash + positionen.reduce((s, p) => s + (p.wert || 0), 0);
  const bewertet = d.prognosen.filter((p) => p.treffer !== undefined);
  return {
    start: d.start, cash: d.cash, positionen, gesamt: wert, ergebnis: wert - d.start,
    trades: d.trades.slice(-15).reverse(),
    trefferquote: { treffer: bewertet.filter((p) => p.treffer).length, bewertet: bewertet.length, offen: d.prognosen.length - bewertet.length },
  };
}

// Nur nach Klick auf "Freigeben" im Dashboard. Spielgeld, keine echte Order.
export function paperTrade(asset, richtung) {
  if (!MAERKTE[asset]) return { ok: false, error: "Unbekannter Markt" };
  const c = cache[asset];
  if (!c || Date.now() - c.at > 2 * 3600 * 1000) return { ok: false, error: "Keine aktuelle Prognose für diesen Markt. Erst neu rechnen." };
  const preis = c.data.jetzt;
  const d = loadDepot();
  if (richtung === "kaufen") {
    const betrag = Math.min(KAUF_BETRAG, d.cash);
    if (betrag < 1) return { ok: false, error: "Kein Spielgeld mehr übrig." };
    const menge = betrag / preis;
    d.cash -= betrag;
    d.bestand[asset] = (d.bestand[asset] || 0) + menge;
    d.trades.push({ zeit: new Date().toISOString(), asset, richtung, preis, menge, betrag, signal: signalOf(c.data) });
  } else if (richtung === "verkaufen") {
    const menge = d.bestand[asset] || 0;
    if (menge <= 0) return { ok: false, error: "Davon ist nichts im Papierdepot." };
    const betrag = menge * preis;
    d.cash += betrag;
    d.bestand[asset] = 0;
    d.trades.push({ zeit: new Date().toISOString(), asset, richtung, preis, menge, betrag, signal: signalOf(c.data) });
  } else return { ok: false, error: "Richtung muss kaufen oder verkaufen sein." };
  saveDepot(d);
  return { ok: true, depot: getDepot() };
}

export function resetDepot() {
  saveDepot({ start: START_GELD, cash: START_GELD, bestand: {}, trades: [], prognosen: loadDepot().prognosen });
  return { ok: true, depot: getDepot() };
}
