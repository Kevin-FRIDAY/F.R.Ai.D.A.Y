// Markt-Radar Plus (v1.145.0, zuerst nur in Eve): viele Märkte, Zeitstrahl bis 1 Jahr, Analyse,
// Prognose auf Wunsch und eine Markt-Wache, die im Hintergrund dauerhaft aufpasst.
//
// - Daten: frei und ohne Schlüssel. Yahoo Finance (Aktien, Indizes, Rohstoffe, Devisen, Krypto),
//   Ausweichen: Binance (Krypto) und Frankfurter/EZB (Devisen, nur Tageskurse).
// - Analyse: reine Rechnung ohne Claude (Trend, Durchschnitte, RSI, Schwankung, 52-Wochen-Spanne).
// - Prognose: statistische Spielerei (viele zufällige Verläufe aus den echten Tagesbewegungen
//   des letzten Jahres). Dazu ehrlich: wie oft diese Methode früher richtig lag. Keine Anlageberatung.
// - Markt-Wache: prüft alle paar Minuten die beobachteten Märkte und meldet starke Bewegungen,
//   Preis-Marken und neue Jahreshochs/-tiefs (Logbuch, Status-Ring, Push/Telegram).
// Es gibt hier keine Orders und kein echtes Geld. Gehandelt wird nirgends.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR, IST_EVE } from "./config.js";
import { istFrei } from "./eve.js";
import { eintragen } from "./logbuch.js";
import { notifyAll } from "./notify.js";

export const FUNKTION_ID = "markt-plus";
export const plusFrei = () => IST_EVE || istFrei(FUNKTION_ID);

const YAHOO = () => String(process.env.FRIDAY_MARKT_YAHOO || "https://query1.finance.yahoo.com").replace(/\/$/, "");
const BINANCE = () => String(process.env.FRIDAY_MARKT_BINANCE || "https://api.binance.com").replace(/\/$/, "");
const FRANKFURTER = () => String(process.env.FRIDAY_MARKT_FRANKFURTER || "https://api.frankfurter.dev").replace(/\/$/, "");
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) F.R.Ai.D.A.Y", Accept: "application/json" };
const WACHE_DATEI = path.join(DATA_DIR, "markt-wache.json");

// ---------- Katalog ----------
// gruppe, symbol (Yahoo), name, worte (Sprache), binance (Krypto-Ausweiche), fx [von, nach] (Devisen-Ausweiche)
const M = (gruppe, symbol, name, worte = [], extra = {}) => ({ gruppe, symbol, name, worte, ...extra });
export const KATALOG = [
  // Indizes
  M("indizes", "^GDAXI", "DAX", ["dax", "deutscher aktienindex"]),
  M("indizes", "^MDAXI", "MDAX", ["mdax"]),
  M("indizes", "^TECDAX", "TecDAX", ["tecdax", "tec dax"]),
  M("indizes", "^STOXX50E", "Euro Stoxx 50", ["euro stoxx", "eurostoxx", "stoxx"]),
  M("indizes", "^GSPC", "S&P 500", ["s&p 500", "s&p", "s und p", "sp 500", "s p 500", "standard and poors"]),
  M("indizes", "^NDX", "Nasdaq 100", ["nasdaq 100", "nasdaq"]),
  M("indizes", "^DJI", "Dow Jones", ["dow jones", "dow"]),
  M("indizes", "^RUT", "Russell 2000", ["russell"]),
  M("indizes", "^FTSE", "FTSE 100", ["ftse", "footsie"]),
  M("indizes", "^FCHI", "CAC 40", ["cac"]),
  M("indizes", "^SSMI", "SMI (Schweiz)", ["smi"]),
  M("indizes", "^N225", "Nikkei 225", ["nikkei"]),
  M("indizes", "^HSI", "Hang Seng", ["hang seng"]),
  M("indizes", "000001.SS", "Shanghai Composite", ["shanghai"]),
  M("indizes", "URTH", "MSCI World (ETF)", ["msci world", "msci", "weltindex"]),
  M("indizes", "^VIX", "VIX (Angst-Index)", ["vix", "angstindex", "angst index"]),
  // Aktien
  M("aktien", "AAPL", "Apple", ["apple"]),
  M("aktien", "MSFT", "Microsoft", ["microsoft"]),
  M("aktien", "NVDA", "Nvidia", ["nvidia"]),
  M("aktien", "AMZN", "Amazon", ["amazon"]),
  M("aktien", "GOOGL", "Alphabet (Google)", ["alphabet", "google"]),
  M("aktien", "META", "Meta (Facebook)", ["meta", "facebook"]),
  M("aktien", "TSLA", "Tesla", ["tesla"]),
  M("aktien", "NFLX", "Netflix", ["netflix"]),
  M("aktien", "AMD", "AMD", ["amd"]),
  M("aktien", "TSM", "TSMC", ["tsmc"]),
  M("aktien", "SAP.DE", "SAP", ["sap"]),
  M("aktien", "SIE.DE", "Siemens", ["siemens"]),
  M("aktien", "ALV.DE", "Allianz", ["allianz"]),
  M("aktien", "DTE.DE", "Deutsche Telekom", ["telekom", "deutsche telekom"]),
  M("aktien", "MBG.DE", "Mercedes-Benz", ["mercedes", "daimler"]),
  M("aktien", "BMW.DE", "BMW", ["bmw"]),
  M("aktien", "VOW3.DE", "Volkswagen", ["volkswagen", "vw"]),
  M("aktien", "RHM.DE", "Rheinmetall", ["rheinmetall"]),
  M("aktien", "ADS.DE", "Adidas", ["adidas"]),
  M("aktien", "DBK.DE", "Deutsche Bank", ["deutsche bank"]),
  M("aktien", "AIR.PA", "Airbus", ["airbus"]),
  M("aktien", "ASML.AS", "ASML", ["asml"]),
  M("aktien", "NOVO-B.CO", "Novo Nordisk", ["novo nordisk", "novo"]),
  M("aktien", "MC.PA", "LVMH", ["lvmh", "louis vuitton"]),
  // Rohstoffe
  M("rohstoffe", "GC=F", "Gold", ["gold", "goldpreis"]),
  M("rohstoffe", "SI=F", "Silber", ["silber", "silberpreis"]),
  M("rohstoffe", "PL=F", "Platin", ["platin"]),
  M("rohstoffe", "PA=F", "Palladium", ["palladium"]),
  M("rohstoffe", "HG=F", "Kupfer", ["kupfer"]),
  M("rohstoffe", "BZ=F", "Öl (Brent)", ["brent", "öl", "oel", "ölpreis", "erdöl", "rohöl"]),
  M("rohstoffe", "CL=F", "Öl (WTI)", ["wti"]),
  M("rohstoffe", "NG=F", "Erdgas", ["erdgas", "gas", "gaspreis"]),
  M("rohstoffe", "ZW=F", "Weizen", ["weizen"]),
  M("rohstoffe", "ZC=F", "Mais", ["mais"]),
  M("rohstoffe", "ZS=F", "Sojabohnen", ["soja"]),
  M("rohstoffe", "KC=F", "Kaffee", ["kaffee"]),
  M("rohstoffe", "CC=F", "Kakao", ["kakao"]),
  M("rohstoffe", "SB=F", "Zucker", ["zucker"]),
  // Krypto
  M("krypto", "BTC-USD", "Bitcoin", ["bitcoin", "btc"], { binance: "BTCUSDT" }),
  M("krypto", "ETH-USD", "Ethereum", ["ethereum", "eth", "ether"], { binance: "ETHUSDT" }),
  M("krypto", "SOL-USD", "Solana", ["solana", "sol"], { binance: "SOLUSDT" }),
  M("krypto", "XRP-USD", "XRP", ["xrp", "ripple"], { binance: "XRPUSDT" }),
  M("krypto", "BNB-USD", "BNB", ["bnb", "binance coin"], { binance: "BNBUSDT" }),
  M("krypto", "ADA-USD", "Cardano", ["cardano", "ada"], { binance: "ADAUSDT" }),
  M("krypto", "DOGE-USD", "Dogecoin", ["dogecoin", "doge"], { binance: "DOGEUSDT" }),
  M("krypto", "DOT-USD", "Polkadot", ["polkadot"], { binance: "DOTUSDT" }),
  M("krypto", "LTC-USD", "Litecoin", ["litecoin"], { binance: "LTCUSDT" }),
  M("krypto", "LINK-USD", "Chainlink", ["chainlink"], { binance: "LINKUSDT" }),
  M("krypto", "AVAX-USD", "Avalanche", ["avalanche"], { binance: "AVAXUSDT" }),
  // Devisen
  M("devisen", "EURUSD=X", "Euro → US-Dollar", ["euro dollar", "eur usd", "euro", "dollar"], { fx: ["EUR", "USD"] }),
  M("devisen", "EURGBP=X", "Euro → Pfund", ["pfund", "eur gbp"], { fx: ["EUR", "GBP"] }),
  M("devisen", "EURCHF=X", "Euro → Franken", ["franken", "eur chf"], { fx: ["EUR", "CHF"] }),
  M("devisen", "EURJPY=X", "Euro → Yen", ["yen", "eur jpy"], { fx: ["EUR", "JPY"] }),
  M("devisen", "EURTRY=X", "Euro → Lira", ["lira", "eur try"], { fx: ["EUR", "TRY"] }),
  M("devisen", "EURPLN=X", "Euro → Złoty", ["zloty", "eur pln"], { fx: ["EUR", "PLN"] }),
  M("devisen", "GBPUSD=X", "Pfund → US-Dollar", ["gbp usd"], { fx: ["GBP", "USD"] }),
  M("devisen", "USDJPY=X", "US-Dollar → Yen", ["usd jpy"], { fx: ["USD", "JPY"] }),
  M("devisen", "USDCNY=X", "US-Dollar → Yuan", ["yuan", "renminbi"], { fx: ["USD", "CNY"] }),
  M("devisen", "DX-Y.NYB", "Dollar-Index", ["dollar index", "dollarindex", "dxy"]),
];
export const GRUPPEN = { indizes: "Indizes", aktien: "Aktien", rohstoffe: "Rohstoffe", krypto: "Krypto", devisen: "Devisen" };
const KRYPTO = (s) => /-USD$|-EUR$/.test(s) && !/=X$/.test(s);

export function eintragVon(symbol) {
  const s = String(symbol || "").trim();
  return KATALOG.find((m) => m.symbol.toLowerCase() === s.toLowerCase()) || null;
}
const gueltig = (s) => /^[\w^.=\-]{1,24}$/.test(String(s || ""));

// ---------- Zeitstrahl ----------
// Yahoo: range + interval. Binance: interval + limit. Frankfurter: nur Tageskurse (ab 1M sinnvoll).
export const ZEITRAEUME = {
  "1T": { titel: "1 Tag", range: "1d", interval: "5m", bi: ["5m", 288], tage: 1, ttl: 2 * 60e3 },
  "1W": { titel: "1 Woche", range: "5d", interval: "30m", bi: ["30m", 336], tage: 7, ttl: 10 * 60e3 },
  "1M": { titel: "1 Monat", range: "1mo", interval: "60m", bi: ["1h", 720], tage: 31, ttl: 20 * 60e3 },
  "3M": { titel: "3 Monate", range: "3mo", interval: "1d", bi: ["1d", 92], tage: 92, ttl: 30 * 60e3 },
  "6M": { titel: "6 Monate", range: "6mo", interval: "1d", bi: ["1d", 183], tage: 183, ttl: 30 * 60e3 },
  "1J": { titel: "1 Jahr", range: "1y", interval: "1d", bi: ["1d", 366], tage: 366, ttl: 30 * 60e3 },
};

const cache = new Map(); // `${symbol}|${zeitraum}` -> { at, data }
const laeuft = new Map(); // gleiche Anfrage nicht doppelt schicken

async function holeJson(url, ms = 15000) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function vonYahoo(symbol, z) {
  const zr = ZEITRAEUME[z];
  const pfad = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${zr.range}&interval=${zr.interval}&includePrePost=false`;
  let j;
  try { j = await holeJson(YAHOO() + pfad); } catch (e) {
    if (process.env.FRIDAY_MARKT_YAHOO) throw e;
    j = await holeJson("https://query2.finance.yahoo.com" + pfad); // zweiter Yahoo-Server
  }
  const res = j?.chart?.result?.[0];
  if (!res) throw new Error(j?.chart?.error?.description || "Keine Daten");
  const q = res.indicators?.quote?.[0] || {};
  const ts = res.timestamp || [];
  const punkte = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close?.[i];
    if (c == null || !Number.isFinite(c)) continue;
    const o = q.open?.[i] ?? c, h = q.high?.[i] ?? c, l = q.low?.[i] ?? c;
    punkte.push([ts[i] * 1000, o, h, l, c, q.volume?.[i] || 0]);
  }
  if (punkte.length < 2) throw new Error("Zu wenige Kurse");
  const m = res.meta || {};
  const jetzt = Number.isFinite(m.regularMarketPrice) ? m.regularMarketPrice : punkte.at(-1)[4];
  if (Number.isFinite(m.regularMarketPrice)) {
    const letzt = punkte.at(-1);
    letzt[4] = m.regularMarketPrice; letzt[2] = Math.max(letzt[2], letzt[4]); letzt[3] = Math.min(letzt[3], letzt[4]);
  }
  return {
    quelle: "Yahoo Finance", jetzt,
    vortag: z === "1T" ? (m.chartPreviousClose ?? m.previousClose ?? null) : null,
    waehrung: m.currency || "", boerse: m.fullExchangeName || m.exchangeName || "",
    name: m.shortName || m.longName || null, zeit: (m.regularMarketTime || 0) * 1000 || punkte.at(-1)[0],
    punkte,
  };
}

async function vonBinance(eintrag, z) {
  const [iv, limit] = ZEITRAEUME[z].bi;
  const rows = await holeJson(`${BINANCE()}/api/v3/klines?symbol=${eintrag.binance}&interval=${iv}&limit=${Math.min(1000, limit)}`);
  const punkte = rows.map((r) => [r[0], +r[1], +r[2], +r[3], +r[4], +r[5]]).filter((p) => Number.isFinite(p[4]));
  if (punkte.length < 2) throw new Error("Zu wenige Kurse");
  return { quelle: "Binance", jetzt: punkte.at(-1)[4], vortag: z === "1T" ? punkte[0][1] : null, waehrung: "USD", boerse: "Binance", name: null, zeit: punkte.at(-1)[0], punkte };
}

async function vonFrankfurter(eintrag, z) {
  const [von, nach] = eintrag.fx;
  const start = new Date(Date.now() - Math.max(ZEITRAEUME[z].tage, 10) * 864e5).toISOString().slice(0, 10);
  const j = await holeJson(`${FRANKFURTER()}/v1/${start}..?base=${von}&symbols=${nach}`);
  const punkte = Object.entries(j.rates || {}).map(([d, r]) => { const c = r[nach]; return [Date.parse(`${d}T16:00:00Z`), c, c, c, c, 0]; }).filter((p) => Number.isFinite(p[4])).sort((a, b) => a[0] - b[0]);
  if (punkte.length < 2) throw new Error("Zu wenige Kurse");
  return { quelle: "EZB (Frankfurter)", jetzt: punkte.at(-1)[4], vortag: z === "1T" ? punkte.at(-2)[4] : null, waehrung: nach, boerse: "EZB-Referenzkurs", name: null, zeit: punkte.at(-1)[0], punkte, nurTage: true };
}

/** Kursverlauf eines Markts für einen Zeitraum (mit Ausweich-Quellen und Zwischenspeicher). */
export async function verlauf(symbol, zeitraum = "1J", { maxAlter } = {}) {
  const z = ZEITRAEUME[zeitraum] ? zeitraum : "1J";
  if (!gueltig(symbol)) return { ok: false, error: "Unbekanntes Kürzel." };
  const key = `${symbol}|${z}`;
  const c = cache.get(key);
  if (c && Date.now() - c.at < (maxAlter ?? ZEITRAEUME[z].ttl)) return c.data;
  if (laeuft.has(key)) return laeuft.get(key);
  const eintrag = eintragVon(symbol) || { symbol, name: symbol, gruppe: KRYPTO(symbol) ? "krypto" : "gesucht" };
  const p = (async () => {
    const fehler = [];
    const wege = [() => vonYahoo(symbol, z)];
    if (eintrag.binance) wege.push(() => vonBinance(eintrag, z));
    if (eintrag.fx) wege.push(() => vonFrankfurter(eintrag, z));
    for (const weg of wege) {
      try {
        const d = await weg();
        const erster = d.punkte[0][4];
        const basis = d.vortag ?? erster;
        const data = {
          ok: true, symbol, name: eintrag.name !== symbol ? eintrag.name : (d.name || symbol), gruppe: eintrag.gruppe,
          zeitraum: z, quelle: d.quelle, waehrung: d.waehrung, boerse: d.boerse, zeit: d.zeit, nurTage: Boolean(d.nurTage),
          jetzt: d.jetzt, basis, veraenderung: basis ? (d.jetzt / basis - 1) * 100 : null,
          hoch: Math.max(...d.punkte.map((x) => x[2])), tief: Math.min(...d.punkte.map((x) => x[3])),
          punkte: d.punkte,
        };
        cache.set(key, { at: Date.now(), data });
        if (cache.size > 400) cache.delete(cache.keys().next().value);
        return data;
      } catch (e) { fehler.push(e.message); }
    }
    // Lieber alte Daten als gar keine
    if (c) return { ...c.data, veraltet: true };
    return { ok: false, error: `Kurse für ${eintrag.name} gerade nicht erreichbar (${fehler.join(" / ").slice(0, 160)}).` };
  })().finally(() => laeuft.delete(key));
  laeuft.set(key, p);
  return p;
}

/** Kurzer Überblick einer Gruppe: Kurs + Tagesveränderung (max. 4 Anfragen gleichzeitig). */
export async function uebersicht(gruppe) {
  const liste = KATALOG.filter((m) => m.gruppe === gruppe);
  const aus = new Array(liste.length);
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < liste.length) {
      const k = i++;
      const m = liste[k];
      const v = await verlauf(m.symbol, "1T", { maxAlter: 5 * 60e3 }).catch(() => null);
      aus[k] = { symbol: m.symbol, name: m.name, jetzt: v?.ok ? v.jetzt : null, veraenderung: v?.ok ? v.veraenderung : null, waehrung: v?.waehrung || "", spark: v?.ok ? duenn(v.punkte.map((p) => p[4]), 40) : [] };
    }
  }));
  return { ok: true, gruppe, titel: GRUPPEN[gruppe] || gruppe, maerkte: aus };
}
function duenn(arr, n) {
  if (arr.length <= n) return arr;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
  return out;
}

/** Suche: erst im eigenen Katalog, dann bei Yahoo (findet fast jede Aktie, jeden ETF, jede Währung). */
export async function suche(q) {
  const t = String(q || "").trim().toLowerCase().slice(0, 60);
  if (!t) return { ok: true, treffer: [] };
  const eigen = KATALOG.filter((m) => m.name.toLowerCase().includes(t) || m.symbol.toLowerCase() === t || m.worte.some((w) => w.includes(t) || t.includes(w) && w.length > 3))
    .slice(0, 8).map((m) => ({ symbol: m.symbol, name: m.name, art: GRUPPEN[m.gruppe], boerse: "" }));
  let fremd = [];
  try {
    const j = await holeJson(`${YAHOO()}/v1/finance/search?q=${encodeURIComponent(t)}&quotesCount=10&newsCount=0&listsCount=0`, 10000);
    const ART = { EQUITY: "Aktie", ETF: "ETF", INDEX: "Index", CURRENCY: "Devisen", CRYPTOCURRENCY: "Krypto", FUTURE: "Rohstoff/Future", MUTUALFUND: "Fonds" };
    fremd = (j.quotes || []).filter((x) => x.symbol && gueltig(x.symbol) && ART[x.quoteType])
      .map((x) => ({ symbol: x.symbol, name: x.shortname || x.longname || x.symbol, art: ART[x.quoteType], boerse: x.exchDisp || "" }));
  } catch { /* nur eigener Katalog */ }
  const gesehen = new Set();
  const treffer = [...eigen, ...fremd].filter((x) => !gesehen.has(x.symbol) && gesehen.add(x.symbol)).slice(0, 12);
  return { ok: true, treffer };
}

// ---------- Analyse (ohne Claude) ----------
const schnitt = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sma = (c, n) => (c.length >= n ? schnitt(c.slice(-n)) : null);
function rsi(c, n = 14) {
  if (c.length <= n) return null;
  let auf = 0, ab = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; if (d > 0) auf += d; else ab -= d; }
  auf /= n; ab /= n;
  for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; auf = (auf * (n - 1) + Math.max(d, 0)) / n; ab = (ab * (n - 1) + Math.max(-d, 0)) / n; }
  return ab === 0 ? 100 : 100 - 100 / (1 + auf / ab);
}
const renditen = (c) => c.slice(1).map((x, i) => Math.log(x / c[i])).filter(Number.isFinite);
function stdabw(a) { const m = schnitt(a); return Math.sqrt(schnitt(a.map((x) => (x - m) ** 2))); }
const pz = (v) => (v == null ? "–" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`);
export const zahl = (v) => (v == null ? "–" : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("de-DE") : v.toLocaleString("de-DE", { maximumFractionDigits: Math.abs(v) < 10 ? 4 : 2 }));

function aenderungSeit(punkte, tage) {
  const ziel = punkte.at(-1)[0] - tage * 864e5;
  const p = punkte.find((x) => x[0] >= ziel);
  return p ? (punkte.at(-1)[4] / p[4] - 1) * 100 : null;
}

/** Rechnet die Kennzahlen aus einem 1-Jahres-Verlauf (Tageskurse). */
export function analysiere(v, tag = null) {
  const punkte = v.punkte;
  const c = punkte.map((p) => p[4]);
  const jetzt = tag?.ok ? tag.jetzt : v.jetzt;
  const proJahr = KRYPTO(v.symbol) ? 365 : 252;
  const r = renditen(c);
  const s20 = sma(c, 20), s50 = sma(c, 50), s200 = sma(c, 200);
  const hoch = Math.max(...punkte.map((p) => p[2])), tief = Math.min(...punkte.map((p) => p[3]));
  let spitze = c[0], maxRueck = 0;
  for (const x of c) { spitze = Math.max(spitze, x); maxRueck = Math.min(maxRueck, (x / spitze - 1) * 100); }
  const schwankung = r.length > 10 ? stdabw(r) * Math.sqrt(proJahr) * 100 : null;
  const rsi14 = rsi(c);
  const veraenderung = {
    "1T": tag?.ok ? tag.veraenderung : (c.length > 1 ? (c.at(-1) / c.at(-2) - 1) * 100 : null),
    "1W": aenderungSeit(punkte, 7), "1M": aenderungSeit(punkte, 30), "3M": aenderungSeit(punkte, 91), "6M": aenderungSeit(punkte, 182),
    "1J": (c.at(-1) / c[0] - 1) * 100,
  };
  let trend = "seitwärts", trendText = "Kein klarer Trend: Der Kurs pendelt um seine Durchschnitte.";
  if (s50 && s200 && jetzt > s50 && s50 > s200) { trend = "aufwärts"; trendText = "Aufwärtstrend: Der Kurs liegt über dem 50- und dem 200-Tage-Schnitt."; }
  else if (s50 && s200 && jetzt < s50 && s50 < s200) { trend = "abwärts"; trendText = "Abwärtstrend: Der Kurs liegt unter dem 50- und dem 200-Tage-Schnitt."; }
  else if (!s200 && s50 && s20) {
    if (jetzt > s20 && s20 > s50) { trend = "aufwärts"; trendText = "Kurzfristig aufwärts (über dem 20- und 50-Tage-Schnitt)."; }
    else if (jetzt < s20 && s20 < s50) { trend = "abwärts"; trendText = "Kurzfristig abwärts (unter dem 20- und 50-Tage-Schnitt)."; }
  }
  const rsiText = rsi14 == null ? "" : rsi14 >= 70 ? `RSI ${Math.round(rsi14)}: zuletzt stark gestiegen, wirkt heißgelaufen.` : rsi14 <= 30 ? `RSI ${Math.round(rsi14)}: zuletzt stark gefallen, wirkt ausverkauft.` : `RSI ${Math.round(rsi14)}: weder heißgelaufen noch ausverkauft.`;
  const stufe = schwankung == null ? "" : schwankung < 12 ? "ruhig" : schwankung < 25 ? "mittel" : schwankung < 50 ? "stark" : "sehr stark";
  const lage52 = hoch > tief ? ((jetzt - tief) / (hoch - tief)) * 100 : 50;
  const saetze = [
    `${v.name} steht bei ${zahl(jetzt)}${v.waehrung ? ` ${v.waehrung}` : ""}. Heute ${pz(veraenderung["1T"])}, in einem Monat ${pz(veraenderung["1M"])}, in einem Jahr ${pz(veraenderung["1J"])}.`,
    trendText,
    rsiText,
    schwankung == null ? "" : `Schwankung: ${stufe} (etwa ${Math.round(schwankung)} % im Jahr). Größter Rückgang im letzten Jahr: ${pz(maxRueck)}.`,
    `52-Wochen-Spanne ${zahl(tief)} bis ${zahl(hoch)}, der Kurs liegt bei ${Math.round(lage52)} % davon${lage52 >= 97 ? " (fast am Jahreshoch)" : lage52 <= 3 ? " (fast am Jahrestief)" : ""}.`,
  ].filter(Boolean);
  return {
    jetzt, veraenderung, trend, trendText, rsi: rsi14, schwankung, schwankungStufe: stufe, maxRueckgang: maxRueck,
    hoch52: hoch, tief52: tief, lage52, sma: { s20, s50, s200 }, saetze, text: saetze.join(" "),
  };
}

// ---------- Prognose (auf Wunsch) ----------
// Viele zufällige Verläufe aus echten Tagesbewegungen des letzten Jahres (in 5er-Blöcken, damit ruhige
// und wilde Phasen zusammenbleiben). Dazu ein ehrlicher Rückblick: Wie oft lag "Richtung des letzten
// Vierteljahres hält an" in der Vergangenheit richtig? Ein Münzwurf liegt bei 50 %.
function zufall(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function prognose(v, tage = 20, pfade = 500) {
  const c = v.punkte.map((p) => p[4]);
  const r = renditen(c);
  if (r.length < 40) return { ok: false, error: "Für eine Prognose brauche ich mindestens zwei Monate Tageskurse." };
  const h = Math.max(1, Math.min(120, Math.round(tage)));
  const rnd = zufall(crypto.createHash("md5").update(`${v.symbol}|${c.length}|${c.at(-1)}`).digest().readUInt32LE(0)); // gleiche Daten = gleiches Bild
  const enden = [], spalten = Array.from({ length: h }, () => []);
  const beispiele = [];
  for (let k = 0; k < pfade; k++) {
    let x = v.jetzt, j = 0;
    const pfad = [];
    while (j < h) {
      const start = Math.floor(rnd() * (r.length - 5));
      for (let b = 0; b < 5 && j < h; b++, j++) { x *= Math.exp(r[start + b]); spalten[j].push(x); pfad.push(x); }
    }
    enden.push(x);
    if (k < 40) beispiele.push(pfad);
  }
  const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
  const band = spalten.map((col) => [q(col, 0.05), q(col, 0.25), q(col, 0.5), q(col, 0.75), q(col, 0.95)]);
  const hoeher = enden.filter((x) => x > v.jetzt).length;
  // Rückblick: Richtung der letzten 60 Tage fortschreiben, mit dem echten Ergebnis nach h Tagen vergleichen.
  let treffer = 0, faelle = 0, auf = 0;
  for (let i = 60; i + h < c.length; i++) {
    const tipp = c[i] > c[i - 60];
    const echt = c[i + h] > c[i];
    faelle++; if (tipp === echt) treffer++; if (echt) auf++;
  }
  const quote = faelle ? Math.round((treffer / faelle) * 100) : null;
  const immerAuf = faelle ? Math.round((auf / faelle) * 100) : null;
  const median = q(enden, 0.5);
  const anteil = Math.round((hoeher / pfade) * 100);
  const sicht = anteil >= 65 ? "eher steigend" : anteil <= 35 ? "eher fallend" : "offen (etwa gleich viele Wege nach oben wie nach unten)";
  const text = `Prognose für ${h} Handelstage: ${anteil} % der ${pfade} gerechneten Verläufe enden höher als heute, Mitte bei ${zahl(median)} (${pz((median / v.jetzt - 1) * 100)}). `
    + `Mit 90 % Wahrscheinlichkeit nach dieser Rechnung zwischen ${zahl(q(enden, 0.05))} und ${zahl(q(enden, 0.95))}. Bild: ${sicht}. `
    + (quote == null ? "" : `Ehrlich: Diese Art Vorhersage lag im letzten Jahr in ${quote} % der Fälle richtig, ein Münzwurf schafft 50 %. `)
    + "Das ist eine Rechnung aus der Vergangenheit, keine Gewissheit und keine Anlageberatung.";
  return {
    ok: true, tage: h, pfade, hoeher, anteil, median, p5: q(enden, 0.05), p25: q(enden, 0.25), p75: q(enden, 0.75), p95: q(enden, 0.95),
    band, beispiele, sicht, rueckblick: { quote, faelle, immerAuf }, text,
    warnung: "Prognose, keine Gewissheit. Keine Anlageberatung. Es wird nichts gekauft oder verkauft.",
  };
}

/** Alles für einen Markt: Verlauf des gewünschten Zeitraums + Analyse (+ Prognose auf Wunsch). */
export async function markt(symbol, { zeitraum = "1J", prognoseTage = 0 } = {}) {
  const [jahr, tag] = await Promise.all([verlauf(symbol, "1J"), verlauf(symbol, "1T").catch(() => null)]);
  const ansicht = zeitraum === "1J" ? jahr : await verlauf(symbol, zeitraum);
  if (!jahr.ok && !ansicht.ok) return jahr;
  const basis = jahr.ok ? jahr : ansicht;
  const analyse = jahr.ok && jahr.punkte.length > 15 ? analysiere(jahr, tag) : null;
  const prog = prognoseTage > 0 && jahr.ok ? prognose(jahr, prognoseTage) : null;
  return {
    ok: true, symbol, name: basis.name, gruppe: basis.gruppe, waehrung: basis.waehrung, boerse: basis.boerse, quelle: (ansicht.ok ? ansicht : basis).quelle,
    jetzt: tag?.ok ? tag.jetzt : basis.jetzt, tag: tag?.ok ? { veraenderung: tag.veraenderung, basis: tag.basis } : null,
    verlauf: ansicht.ok ? ansicht : null, jahr: jahr.ok ? { punkte: jahr.punkte.map((p) => [p[0], p[4]]) } : null,
    analyse, prognose: prog, beobachtet: Boolean(wacheLaden().liste.find((w) => w.symbol === symbol)),
  };
}

// ---------- Markt-Wache (Hintergrund) ----------
const STANDARD_WACHE = [
  ["^GDAXI", "DAX", 2.5], ["^GSPC", "S&P 500", 2.5], ["GC=F", "Gold", 2.5], ["BTC-USD", "Bitcoin", 5], ["EURUSD=X", "Euro → US-Dollar", 1],
];
function neuerWaechter(symbol, name, bewegung = 3) {
  return { id: crypto.randomUUID().slice(0, 8), symbol, name, bewegung, ueber: null, unter: null, jahresmarken: true, an: true, zustand: {} };
}
function wacheLaden() {
  try {
    const d = JSON.parse(fs.readFileSync(WACHE_DATEI, "utf8"));
    return { an: d.an !== false, intervall_min: d.intervall_min || 15, melden: d.melden !== false, liste: Array.isArray(d.liste) ? d.liste : [], hinweise: Array.isArray(d.hinweise) ? d.hinweise : [], zuletzt: d.zuletzt || null, fehler: d.fehler || null };
  } catch {
    // Erster Start: Standard-Wache anlegen und gleich speichern (sonst bekämen die Wächter jedes Mal neue IDs).
    const d = { an: true, intervall_min: 15, melden: true, liste: STANDARD_WACHE.map(([s, n, b]) => neuerWaechter(s, n, b)), hinweise: [], zuletzt: null, fehler: null };
    try { wacheSpeichern(d); } catch { /* nur lesen */ }
    return d;
  }
}
function wacheSpeichern(d) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${WACHE_DATEI}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, WACHE_DATEI);
}
const ohneZustand = (w) => { const { zustand, ...rest } = w; return { ...rest, letzterKurs: zustand?.kurs ?? null, letzteVeraenderung: zustand?.veraenderung ?? null, geprueft: zustand?.geprueft ?? null }; };

export function wacheStand() {
  const d = wacheLaden();
  return { ok: true, an: d.an, intervall_min: d.intervall_min, melden: d.melden, liste: d.liste.map(ohneZustand), hinweise: d.hinweise.slice(-60).reverse(), neu: d.hinweise.filter((h) => !h.gelesen).length, zuletzt: d.zuletzt, fehler: d.fehler, laeuft: pruefLaeuft };
}

export function wacheEinstellen({ an, intervall_min, melden } = {}) {
  const d = wacheLaden();
  if (an !== undefined) d.an = Boolean(an);
  if (intervall_min !== undefined) d.intervall_min = Math.max(5, Math.min(240, Math.round(Number(intervall_min) || 15)));
  if (melden !== undefined) d.melden = Boolean(melden);
  wacheSpeichern(d);
  return wacheStand();
}

const zahlOderNull = (v) => (v === null || v === "" || v === undefined ? null : Number.isFinite(Number(String(v).replace(",", "."))) ? Number(String(v).replace(",", ".")) : null);
export function wacheSetzen({ symbol, name, bewegung, ueber, unter, jahresmarken, an } = {}) {
  if (!gueltig(symbol)) return { ok: false, error: "Unbekanntes Kürzel." };
  const d = wacheLaden();
  let w = d.liste.find((x) => x.symbol === symbol);
  if (!w) {
    if (d.liste.length >= 25) return { ok: false, error: "Die Markt-Wache passt auf höchstens 25 Märkte auf." };
    w = neuerWaechter(symbol, String(name || eintragVon(symbol)?.name || symbol).slice(0, 60), 3);
    d.liste.push(w);
  }
  if (bewegung !== undefined) w.bewegung = Math.max(0, Math.min(50, zahlOderNull(bewegung) ?? 0));
  if (ueber !== undefined) { w.ueber = zahlOderNull(ueber); delete w.zustand.ueberAus; }
  if (unter !== undefined) { w.unter = zahlOderNull(unter); delete w.zustand.unterAus; }
  if (jahresmarken !== undefined) w.jahresmarken = Boolean(jahresmarken);
  if (an !== undefined) w.an = Boolean(an);
  wacheSpeichern(d);
  return { ...wacheStand(), waechter: ohneZustand(w) };
}

export function wacheEntfernen(idOderSymbol) {
  const d = wacheLaden();
  d.liste = d.liste.filter((w) => w.id !== idOderSymbol && w.symbol !== idOderSymbol);
  wacheSpeichern(d);
  return wacheStand();
}

export function hinweiseGelesen() {
  const d = wacheLaden();
  d.hinweise.forEach((h) => { h.gelesen = true; });
  wacheSpeichern(d);
  return wacheStand();
}

const tagHeute = () => new Date().toISOString().slice(0, 10);
/** Prüft einen Wächter. Gibt neue Hinweise zurück (verändert w.zustand). */
async function pruefeEinen(w) {
  const v = await verlauf(w.symbol, "1T", { maxAlter: 60e3 });
  if (!v.ok) throw new Error(v.error);
  const z = w.zustand || (w.zustand = {});
  const neu = [];
  const kurs = v.jetzt, chg = v.veraenderung;
  const melde = (art, text) => neu.push({ id: crypto.randomUUID().slice(0, 8), zeit: new Date().toISOString(), symbol: w.symbol, name: w.name, art, kurs, text });
  // 1) Starke Bewegung heute (einmal pro Tag und Richtung, danach erst wieder bei doppelter Schwelle)
  if (w.bewegung > 0 && chg != null && Math.abs(chg) >= w.bewegung) {
    const richtung = chg > 0 ? "auf" : "ab";
    const schluessel = `${tagHeute()}|${richtung}`;
    const stufe = Math.floor(Math.abs(chg) / w.bewegung);
    if (z.bewegung?.schluessel !== schluessel || stufe > z.bewegung.stufe) {
      z.bewegung = { schluessel, stufe };
      melde("bewegung", `${w.name} ${chg > 0 ? "steigt" : "fällt"} heute stark: ${pz(chg)} auf ${zahl(kurs)}.`);
    }
  }
  // 2) Preis-Marken (melden beim Überschreiten, wieder scharf, wenn der Kurs zurück ist)
  if (w.ueber != null) {
    if (kurs >= w.ueber && !z.ueberAus) { z.ueberAus = true; melde("ueber", `${w.name} ist über deine Marke ${zahl(w.ueber)} gestiegen (jetzt ${zahl(kurs)}).`); }
    else if (kurs < w.ueber * 0.995) z.ueberAus = false;
  }
  if (w.unter != null) {
    if (kurs <= w.unter && !z.unterAus) { z.unterAus = true; melde("unter", `${w.name} ist unter deine Marke ${zahl(w.unter)} gefallen (jetzt ${zahl(kurs)}).`); }
    else if (kurs > w.unter * 1.005) z.unterAus = false;
  }
  // 3) Neues 52-Wochen-Hoch oder -Tief (einmal pro Tag)
  if (w.jahresmarken !== false) {
    const jahr = await verlauf(w.symbol, "1J", { maxAlter: 6 * 3600e3 }).catch(() => null);
    if (jahr?.ok && jahr.punkte.length > 100) {
      const frueher = jahr.punkte.slice(0, -1);
      const hoch = Math.max(...frueher.map((p) => p[2])), tief = Math.min(...frueher.map((p) => p[3]));
      if (kurs > hoch && z.hochTag !== tagHeute()) { z.hochTag = tagHeute(); melde("hoch52", `${w.name} erreicht ein neues 52-Wochen-Hoch: ${zahl(kurs)}.`); }
      if (kurs < tief && z.tiefTag !== tagHeute()) { z.tiefTag = tagHeute(); melde("tief52", `${w.name} fällt auf ein neues 52-Wochen-Tief: ${zahl(kurs)}.`); }
    }
  }
  z.kurs = kurs; z.veraenderung = chg; z.geprueft = new Date().toISOString(); delete z.fehler;
  return neu;
}

const zuhoerer = new Set();
export function beiHinweis(fn) { zuhoerer.add(fn); }

let pruefLaeuft = false;
export async function wachePruefen({ vonHand = false } = {}) {
  if (pruefLaeuft) return { ...wacheStand(), info: "Prüfe schon." };
  pruefLaeuft = true;
  const neue = [];
  let fehler = 0;
  try {
    const d = wacheLaden();
    for (const w of d.liste.filter((x) => x.an)) {
      try { neue.push(...await pruefeEinen(w)); }
      catch (e) { fehler++; w.zustand = { ...(w.zustand || {}), fehler: String(e.message).slice(0, 160) }; }
      await new Promise((r) => setTimeout(r, vonHand ? 150 : 1200)); // die freien Quellen schonen
    }
    // frisch laden und nur Zustände + Hinweise übernehmen (falls zwischendurch etwas geändert wurde)
    const frisch = wacheLaden();
    for (const w of frisch.liste) { const alt = d.liste.find((x) => x.id === w.id); if (alt) w.zustand = alt.zustand; }
    frisch.hinweise.push(...neue);
    if (frisch.hinweise.length > 200) frisch.hinweise = frisch.hinweise.slice(-200);
    frisch.zuletzt = new Date().toISOString();
    frisch.fehler = fehler && fehler === d.liste.filter((x) => x.an).length ? "Keine Kurse erreichbar (Internet oder Quelle gestört)." : null;
    wacheSpeichern(frisch);
    for (const h of neue) {
      eintragen({ bereich: "markt", quelle: "markt-wache", titel: `Markt-Wache: ${h.text}`.slice(0, 200) });
      for (const fn of zuhoerer) { try { fn(h); } catch { /* egal */ } }
    }
    if (neue.length && frisch.melden) {
      const text = neue.map((h) => `• ${h.text}`).join("\n").slice(0, 1500);
      notifyAll("📈 Markt-Wache", `${text}\n(Nur ein Hinweis, keine Anlageberatung.)`, { art: "markt" }).catch(() => {});
    }
  } finally { pruefLaeuft = false; }
  return { ...wacheStand(), neueHinweise: neue };
}

let takt = null;
export function marktWacheStart() {
  if (takt) return;
  takt = setInterval(() => {
    if (!plusFrei()) return; // in Friday erst nach Freigabe in Eve
    const d = wacheLaden();
    if (!d.an || !d.liste.some((w) => w.an)) return;
    if (d.zuletzt && Date.now() - Date.parse(d.zuletzt) < d.intervall_min * 60e3) return;
    wachePruefen().catch((e) => console.error("Markt-Wache:", e.message));
  }, 60e3);
  takt.unref?.();
}

// ---------- Sprache (ohne Claude) ----------
const norm = (t) => String(t || "").toLowerCase().replace(/[!?.,]/g, " ").replace(/\s+/g, " ").trim().replace(/^(hey |hallo |ok |okay )?friday /, "");
export function findeMarkt(text) {
  const t = ` ${norm(text)} `;
  let best = null;
  for (const m of KATALOG) {
    for (const w of [m.name.toLowerCase(), ...m.worte]) {
      const re = new RegExp(`[\\s(]${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(-?(aktie|kurs|preis|index|s))?[\\s)]`);
      if (re.test(t) && (!best || w.length > best.len)) best = { m, len: w.length };
    }
  }
  return best?.m || null;
}

/** "Friday, analysiere den DAX", "Prognose für Gold", "wie steht Tesla", "öffne Markt-Wache". */
export async function quickCommand(text) {
  if (!plusFrei()) return null;
  const t = norm(text);
  if (/^((öffne|zeig)( mir)? )?(die )?markt[- ]?wache( öffnen)?$|^was (macht|sagt) die markt[- ]?wache/.test(t)) {
    const s = wacheStand();
    const ans = s.neu ? `Die Markt-Wache hat ${s.neu === 1 ? "einen neuen Hinweis" : `${s.neu} neue Hinweise`}: ${s.hinweise.filter((h) => !h.gelesen).slice(0, 3).map((h) => h.text).join(" ")}` : `Die Markt-Wache passt auf ${s.liste.filter((w) => w.an).length} Märkte auf${s.an ? "" : ", ist aber gerade aus"}. Nichts Auffälliges.`;
    return { answer: ans, actions: ["marktplus:wache"] };
  }
  if (/^((öffne|zeig)( mir)? )?(alle märkte|markt[- ]?radar plus|alle börsen|die börse)( öffnen)?$/.test(t)) {
    return { answer: "Hier sind alle Märkte.", actions: ["marktplus:"] };
  }
  const prog = /prognose|vorhersage|wohin geht|wie geht es weiter|wird .* steigen|wird .* fallen/.test(t);
  const ana = /analys|wie steht|wie läuft|wie entwickelt|wo steht|kurs (von|vom|der|des)|was macht (der|die|das)/.test(t);
  const wach = /^(beobachte|überwache|bewache|pass auf)/.test(t) && /markt|aktie|kurs|index/.test(t);
  if (!prog && !ana && !wach) return null;
  const m = findeMarkt(text);
  if (!m) return null;
  if (wach) {
    const r = wacheSetzen({ symbol: m.symbol, name: m.name });
    return { answer: r.ok === false ? r.error : `Mach ich. Die Markt-Wache passt jetzt auch auf ${m.name} auf und meldet sich bei starken Bewegungen.`, actions: [`marktplus:${m.symbol}`] };
  }
  const r = await markt(m.symbol, { prognoseTage: prog ? 20 : 0 });
  if (!r.ok) return { answer: r.error, actions: [`marktplus:${m.symbol}`] };
  const teile = [r.analyse?.text || `${r.name} steht bei ${zahl(r.jetzt)}.`];
  if (r.prognose?.ok) teile.push(r.prognose.text);
  else if (!prog) teile.push("Keine Anlageberatung.");
  return { answer: teile.join(" "), actions: [`marktplus:${m.symbol}${prog ? "|prognose" : ""}`] };
}

// ---------- Werkzeug für Claude ----------
export const WERKZEUG = {
  name: "markt_plus",
  description: "Markt-Radar Plus: Kurse, Zeitstrahl bis 1 Jahr, Analyse und Prognose für fast jeden Markt (Aktien, Indizes wie DAX/S&P 500, Rohstoffe wie Gold/Öl, Krypto, Devisen). "
    + "action=analyse (symbol oder name): Trend, Veränderung 1 Tag bis 1 Jahr, RSI, Schwankung, 52-Wochen-Spanne. action=prognose (+ tage, Standard 20): viele gerechnete Verläufe aus den echten Bewegungen des letzten Jahres + ehrlicher Rückblick, wie oft die Methode früher stimmte. "
    + "action=suche (name): findet das Kürzel. action=wache: Stand der Markt-Wache und neue Hinweise. action=beobachten (symbol/name, optional bewegung %, ueber, unter): Markt in die Wache aufnehmen. "
    + "Sag immer dazu: Prognose, keine Gewissheit, keine Anlageberatung. Friday kauft und verkauft nie etwas.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["analyse", "prognose", "suche", "wache", "beobachten"] },
      symbol: { type: "string", description: "Yahoo-Kürzel, z. B. ^GDAXI, AAPL, GC=F, BTC-USD, EURUSD=X" },
      name: { type: "string", description: "Name, wenn das Kürzel unbekannt ist (z. B. 'DAX', 'Apple', 'Gold')" },
      tage: { type: "number" }, bewegung: { type: "number" }, ueber: { type: "number" }, unter: { type: "number" },
    },
    required: ["action"],
  },
};

async function symbolAus(input) {
  if (input.symbol && gueltig(input.symbol)) return input.symbol;
  const n = String(input.name || input.symbol || "");
  const m = findeMarkt(n) || KATALOG.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (m) return m.symbol;
  const s = await suche(n);
  return s.treffer[0]?.symbol || null;
}

export async function werkzeug(input = {}) {
  if (!plusFrei()) return { error: "Markt-Radar Plus ist noch im Test (nur in Eve). Boss kann es in Eve freigeben." };
  const a = input.action;
  if (a === "wache") { const s = wacheStand(); return { an: s.an, alle_min: s.intervall_min, beobachtet: s.liste.map((w) => w.name), neue_hinweise: s.hinweise.filter((h) => !h.gelesen).map((h) => h.text), letzte_hinweise: s.hinweise.slice(0, 8).map((h) => h.text) }; }
  if (a === "suche") return suche(input.name || input.symbol);
  const symbol = await symbolAus(input);
  if (!symbol) return { error: "Diesen Markt finde ich nicht. Versuch es mit dem Namen oder Kürzel." };
  if (a === "beobachten") {
    const r = wacheSetzen({ symbol, name: input.name, bewegung: input.bewegung, ueber: input.ueber, unter: input.unter });
    return r.ok === false ? r : { beobachtet: r.waechter, hinweis: "Die Markt-Wache prüft im Hintergrund und meldet sich." };
  }
  const r = await markt(symbol, { prognoseTage: a === "prognose" ? (input.tage || 20) : 0 });
  if (!r.ok) return { error: r.error };
  return {
    markt: r.name, kuerzel: symbol, kurs: r.jetzt, waehrung: r.waehrung, quelle: r.quelle,
    veraenderung_prozent: r.analyse?.veraenderung, trend: r.analyse?.trend, rsi: r.analyse?.rsi && Math.round(r.analyse.rsi),
    schwankung_jahr_prozent: r.analyse?.schwankung && Math.round(r.analyse.schwankung), spanne_52w: r.analyse ? [r.analyse.tief52, r.analyse.hoch52] : null,
    zusammenfassung: r.analyse?.text,
    prognose: r.prognose?.ok ? { tage: r.prognose.tage, anteil_hoeher_prozent: r.prognose.anteil, mitte: r.prognose.median, spanne_90: [r.prognose.p5, r.prognose.p95], methode_lag_richtig_prozent: r.prognose.rueckblick.quote, text: r.prognose.text } : undefined,
    warnung: "Prognose, keine Gewissheit. Keine Anlageberatung.",
  };
}

// ---------- Routen ----------
export function marktplusRouten(app, asyncRoute) {
  const gesperrt = (res) => res.status(403).json({ ok: false, error: "Markt-Radar Plus ist noch im Test – in Eve ausprobieren und dort freigeben." });
  app.get("/api/marktplus/katalog", (req, res) => res.json({
    ok: true, frei: plusFrei(), gruppen: GRUPPEN, zeitraeume: Object.fromEntries(Object.entries(ZEITRAEUME).map(([k, v]) => [k, v.titel])),
    maerkte: KATALOG.map(({ gruppe, symbol, name }) => ({ gruppe, symbol, name })),
  }));
  app.get("/api/marktplus/uebersicht/:gruppe", asyncRoute(async (req, res) => {
    if (!plusFrei()) return gesperrt(res);
    if (!GRUPPEN[req.params.gruppe]) return res.status(404).json({ ok: false, error: "Diese Gruppe gibt es nicht." });
    res.json(await uebersicht(req.params.gruppe));
  }));
  app.get("/api/marktplus/suche", asyncRoute(async (req, res) => { if (!plusFrei()) return gesperrt(res); res.json(await suche(req.query.q)); }));
  app.get("/api/marktplus/markt", asyncRoute(async (req, res) => {
    if (!plusFrei()) return gesperrt(res);
    const r = await markt(String(req.query.symbol || ""), { zeitraum: String(req.query.zeitraum || "1J"), prognoseTage: Number(req.query.prognose) || 0 });
    res.status(r.ok ? 200 : 502).json(r);
  }));
  app.get("/api/marktplus/wache", (req, res) => (plusFrei() ? res.json(wacheStand()) : gesperrt(res)));
  app.post("/api/marktplus/wache", (req, res) => (plusFrei() ? res.json(wacheEinstellen(req.body || {})) : gesperrt(res)));
  app.post("/api/marktplus/wache/markt", (req, res) => { if (!plusFrei()) return gesperrt(res); const r = wacheSetzen(req.body || {}); res.status(r.ok === false ? 400 : 200).json(r); });
  app.post("/api/marktplus/wache/entfernen", (req, res) => (plusFrei() ? res.json(wacheEntfernen(String(req.body?.id || ""))) : gesperrt(res)));
  app.post("/api/marktplus/wache/gelesen", (req, res) => (plusFrei() ? res.json(hinweiseGelesen()) : gesperrt(res)));
  app.post("/api/marktplus/wache/pruefen", asyncRoute(async (req, res) => (plusFrei() ? res.json(await wachePruefen({ vonHand: true })) : gesperrt(res))));
}
