// Echtes Live-Wetter je Land (Open-Meteo — kostenlos, kein API-Key nötig)
// für dieselben Länderkoordinaten, die auch der Globus benutzt. Läuft
// parallel zur Weltlage-Suche und wird wie diese gecacht.

const express = require('express');
const { findCountry, getCountryByCode } = require('../countries');

const router = express.Router();

const FETCH_TIMEOUT_MS = 6000;
// Wetter ändert sich langsamer als Nachrichten — größerer Cache-Puffer.
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map(); // code -> { data, timestamp }

const WEATHER_CODE_DE = {
  0: 'Klarer Himmel', 1: 'Überwiegend klar', 2: 'Teilweise bewölkt', 3: 'Bedeckt',
  45: 'Nebel', 48: 'Reifnebel',
  51: 'Leichter Nieselregen', 53: 'Nieselregen', 55: 'Starker Nieselregen',
  56: 'Leichter gefrierender Nieselregen', 57: 'Gefrierender Nieselregen',
  61: 'Leichter Regen', 63: 'Regen', 65: 'Starker Regen',
  66: 'Leichter gefrierender Regen', 67: 'Gefrierender Regen',
  71: 'Leichter Schneefall', 73: 'Schneefall', 75: 'Starker Schneefall', 77: 'Schneegriesel',
  80: 'Leichte Regenschauer', 81: 'Regenschauer', 82: 'Starke Regenschauer',
  85: 'Leichte Schneeschauer', 86: 'Starke Schneeschauer',
  95: 'Gewitter', 96: 'Gewitter mit leichtem Hagel', 99: 'Gewitter mit starkem Hagel',
};

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAndCache(country) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${country.lat}&longitude=${country.lon}&current_weather=true`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Wetterdienst-Status ${res.status}`);
  const body = await res.json();
  const cw = body.current_weather;
  if (!cw) throw new Error('Keine Wetterdaten erhalten.');

  const data = {
    country: country.name,
    code: country.code,
    temperature: cw.temperature,
    windspeed: cw.windspeed,
    weatherCode: cw.weathercode,
    conditionDe: WEATHER_CODE_DE[cw.weathercode] || 'Unbekannt',
    isDay: Boolean(cw.is_day),
    time: cw.time,
  };

  const previous = cache.get(country.code);
  const changed = !previous
    || previous.data.weatherCode !== data.weatherCode
    || Math.abs(previous.data.temperature - data.temperature) >= 1;
  cache.set(country.code, { data, timestamp: Date.now() });
  return { data, changed };
}

// Für den Hintergrunddienst, analog zu server/routes/news.js.
function getCachedCodes() {
  return Array.from(cache.keys());
}

async function refreshCountryByCode(code) {
  const country = getCountryByCode(code);
  if (!country) throw new Error(`Unbekannter Ländercode: ${code}`);
  return fetchAndCache(country);
}

router.get('/', async (req, res) => {
  const query = typeof req.query.country === 'string' ? req.query.country.trim() : '';
  const codeParam = typeof req.query.code === 'string' ? req.query.code.trim().toUpperCase() : '';

  const country = codeParam ? getCountryByCode(codeParam) : findCountry(query);
  if (!country) {
    return res.status(404).json({ error: `Land nicht erkannt.` });
  }

  const cached = cache.get(country.code);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ ...cached.data, cached: true });
  }

  try {
    const { data } = await fetchAndCache(country);
    res.json(data);
  } catch (err) {
    if (cached) {
      return res.json({ ...cached.data, cached: true, stale: true });
    }
    res.status(502).json({ error: 'Wetterdienst nicht erreichbar.', detail: err.message });
  }
});

module.exports = router;
module.exports.getCachedCodes = getCachedCodes;
module.exports.refreshCountryByCode = refreshCountryByCode;
