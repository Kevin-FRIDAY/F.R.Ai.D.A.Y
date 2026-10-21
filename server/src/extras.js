// Kostenlose Dienste ohne API-Schlüssel. Alle Quellen sind frei zugänglich.
const UA = { "User-Agent": "F.R.Ai.D.A.Y/1.0" };
const cache = new Map();
async function cached(key, ms, fn) {
  const c = cache.get(key);
  if (c && Date.now() - c.at < ms) return c.val;
  const val = await fn();
  cache.set(key, { at: Date.now(), val });
  return val;
}
const num = (v) => (typeof v === "number" ? v.toLocaleString("de-DE") : v);

// --- Luftqualität (Open-Meteo, kein Schlüssel) ---
const AQI_TEXT = (v) =>
  v == null ? "unbekannt" : v <= 20 ? "sehr gut" : v <= 40 ? "gut" : v <= 60 ? "mittel" : v <= 80 ? "schlecht" : v <= 100 ? "sehr schlecht" : "extrem schlecht";

export async function getAirQuality(lat, lon) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone`;
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) }).then((x) => x.json());
  const c = r.current || {};
  return { luftqualitaet_index: c.european_aqi, bewertung: AQI_TEXT(c.european_aqi), feinstaub_pm25: c.pm2_5, feinstaub_pm10: c.pm10, stickstoffdioxid: c.nitrogen_dioxide, ozon: c.ozone };
}

// --- Wechselkurse (Frankfurter, Daten der EZB) ---
export async function getExchange(betrag = 1, von = "EUR", nach = "USD") {
  von = String(von).toUpperCase().slice(0, 3); nach = String(nach).toUpperCase().slice(0, 3);
  const r = await fetch(`https://api.frankfurter.dev/v1/latest?base=${von}&symbols=${nach}`, { signal: AbortSignal.timeout(12000) }).then((x) => x.json());
  const kurs = r.rates?.[nach];
  if (kurs == null) return { error: `Währung ${von} oder ${nach} nicht gefunden.` };
  const b = Number(betrag) || 1;
  return { betrag: b, von, nach, kurs, ergebnis: Math.round(b * kurs * 100) / 100, stand: r.date };
}

// --- Krypto-Preise (CoinGecko) ---
const COIN_IDS = { btc: "bitcoin", bitcoin: "bitcoin", eth: "ethereum", ethereum: "ethereum", sol: "solana", solana: "solana", xrp: "ripple", ada: "cardano", doge: "dogecoin", bnb: "binancecoin", ltc: "litecoin", dot: "polkadot" };
export async function getCrypto(coin = "bitcoin", waehrung = "eur") {
  const id = COIN_IDS[String(coin).toLowerCase()] || String(coin).toLowerCase();
  const vs = String(waehrung).toLowerCase().slice(0, 3);
  const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=${vs}&include_24hr_change=true`, { headers: UA, signal: AbortSignal.timeout(12000) }).then((x) => x.json());
  const d = r[id];
  if (!d) return { error: `Kryptowährung "${coin}" nicht gefunden.` };
  return { coin: id, waehrung: vs.toUpperCase(), preis: d[vs], veraenderung_24h_prozent: Math.round((d[`${vs}_24h_change`] || 0) * 100) / 100 };
}

// --- Feiertage (Nager.Date) ---
export async function getHolidays(land = "DE", jahr = new Date().getFullYear()) {
  const code = String(land).toUpperCase().slice(0, 2);
  const y = Number(jahr) || new Date().getFullYear();
  const list = await cached(`hol:${code}:${y}`, 24 * 3600 * 1000, () =>
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/${code}`, { headers: UA, signal: AbortSignal.timeout(12000) }).then((x) => (x.ok ? x.json() : [])),
  );
  if (!Array.isArray(list) || !list.length) return { error: `Keine Feiertage für ${code} ${y} gefunden.` };
  const heute = new Date().toISOString().slice(0, 10);
  const naechste = list.filter((h) => h.date >= heute).slice(0, 6);
  return { land: code, jahr: y, naechste_feiertage: (naechste.length ? naechste : list.slice(0, 6)).map((h) => ({ datum: h.date, name: h.localName })) };
}

// --- Position der Raumstation ISS (wheretheiss.at) ---
export async function getISS() {
  const r = await fetch("https://api.wheretheiss.at/v1/satellites/25544", { headers: UA, signal: AbortSignal.timeout(12000) }).then((x) => x.json());
  return { breitengrad: Math.round(r.latitude * 100) / 100, laengengrad: Math.round(r.longitude * 100) / 100, hoehe_km: Math.round(r.altitude), geschwindigkeit_kmh: Math.round(r.velocity), ueber: r.visibility === "daylight" ? "Tagseite der Erde" : "Nachtseite der Erde" };
}

// --- Nachschlagen (Wikipedia, deutsche Zusammenfassung) ---
export async function getWiki(begriff) {
  const t = encodeURIComponent(String(begriff).trim().replace(/\s+/g, "_"));
  const r = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${t}`, { headers: UA, signal: AbortSignal.timeout(12000) });
  if (!r.ok) return { error: `Zu "${begriff}" habe ich bei Wikipedia nichts gefunden.` };
  const d = await r.json();
  if (d.type === "disambiguation" || !d.extract) return { error: `"${begriff}" ist nicht eindeutig. Sei bitte genauer.` };
  return { titel: d.title, zusammenfassung: d.extract, link: d.content_urls?.desktop?.page || "", bild: d.thumbnail?.source || "" };
}

// --- Bevölkerung (Weltbank, kostenlos) ---
export async function getPopulation(cca2) {
  if (!cca2) return null;
  try {
    const r = await cached(`pop:${cca2}`, 7 * 24 * 3600 * 1000, () =>
      fetch(`https://api.worldbank.org/v2/country/${cca2}/indicator/SP.POP.TOTL?format=json&per_page=1&mrv=1`, { headers: UA, signal: AbortSignal.timeout(12000) }).then((x) => x.json()),
    );
    return r?.[1]?.[0]?.value ?? null;
  } catch { return null; }
}

export { num };
