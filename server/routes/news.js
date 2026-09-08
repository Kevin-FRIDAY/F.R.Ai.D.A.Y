const express = require('express');
const { XMLParser } = require('fast-xml-parser');
const { findCountry, listCountries } = require('../countries');

const router = express.Router();
const parser = new XMLParser({ ignoreAttributes: false });

const FETCH_TIMEOUT_MS = 8000;
// Viele Nachrichtenseiten blocken Anfragen ohne Browser-User-Agent.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Schont die (kostenlosen, öffentlichen) Quellen und macht wiederholte
// Abfragen robust gegen kurzzeitige Rate-Limits/Blocks einzelner Anbieter.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map(); // code -> { data, timestamp }

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, ...(options.headers || {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractMeta(html, names) {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      'i'
    );
    const match = html.match(re);
    if (match) return match[1].replace(/&amp;/g, '&');

    // Manche Seiten schreiben content zuerst, property/name danach.
    const reReversed = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`,
      'i'
    );
    const matchReversed = html.match(reReversed);
    if (matchReversed) return matchReversed[1].replace(/&amp;/g, '&');
  }
  return null;
}

async function fetchArticleMedia(link) {
  try {
    const res = await fetchWithTimeout(link);
    if (!res.ok) return { image: null, video: null };
    const html = await res.text();
    const image = extractMeta(html, ['og:image', 'og:image:secure_url', 'twitter:image']);
    const video = extractMeta(html, ['og:video', 'og:video:url', 'og:video:secure_url']);
    return { image, video };
  } catch (err) {
    return { image: null, video: null };
  }
}

function firstItemFrom(parsedFeed) {
  const items = parsedFeed?.rss?.channel?.item || parsedFeed?.feed?.entry;
  return Array.isArray(items) ? items[0] : items;
}

function extractLink(item) {
  let link = item?.link;
  if (typeof link === 'object') link = link['@_href'] || link['#text'];
  return link || null;
}

function extractTitle(item) {
  const raw = item?.title;
  return typeof raw === 'string' ? raw.trim() : String(raw?.['#text'] || raw || '').trim();
}

// Übersetzt die Meldung ins Deutsche, damit F.R.Ai.D.A.Y sie auf Deutsch
// vorlesen kann — unabhängig von der Sprache der Originalquelle.
async function translateToGerman(text, sourceLang) {
  const primary = (sourceLang || '').split('-')[0].toLowerCase();
  if (!text || primary === 'de') return text;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(primary || 'en')}|de`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return text;
    const body = await res.json();
    const translated = body?.responseData?.translatedText;
    return typeof translated === 'string' && translated.trim() ? translated.trim() : text;
  } catch (err) {
    return text;
  }
}

router.get('/countries', (req, res) => {
  res.json(listCountries());
});

router.get('/', async (req, res) => {
  const query = typeof req.query.country === 'string' ? req.query.country.trim() : '';
  if (!query) return res.status(400).json({ error: 'Parameter "country" ist erforderlich.' });

  const country = findCountry(query);
  if (!country) {
    return res.status(404).json({ error: `Land in "${query}" nicht erkannt.` });
  }

  const cached = cache.get(country.code);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ ...cached.data, cached: true });
  }

  try {
    const feedRes = await fetchWithTimeout(country.feedUrl);
    if (!feedRes.ok) throw new Error(`Feed-Status ${feedRes.status}`);
    const feedText = await feedRes.text();

    const parsed = parser.parse(feedText);
    const topItem = firstItemFrom(parsed);
    if (!topItem) throw new Error('Keine Meldungen im Feed gefunden.');

    const title = extractTitle(topItem);
    const link = extractLink(topItem);
    const publishedAt = topItem.pubDate || topItem.published || topItem.updated || null;

    let image = null;
    let video = null;
    if (link) {
      const media = await fetchArticleMedia(link);
      image = media.image;
      video = media.video;
    }

    const titleDe = await translateToGerman(title, country.lang);

    const data = {
      country: country.name,
      code: country.code,
      lat: country.lat,
      lon: country.lon,
      lang: country.lang,
      title,
      titleDe,
      source: country.source,
      publishedAt,
      link,
      image,
      video,
    };
    cache.set(country.code, { data, timestamp: Date.now() });
    res.json(data);
  } catch (err) {
    // Quelle gerade nicht erreichbar/blockiert — lieber eine veraltete,
    // aber echte Meldung zeigen als einen Fehler, falls vorhanden.
    if (cached) {
      return res.json({ ...cached.data, cached: true, stale: true });
    }
    res.status(502).json({ error: 'Nachrichtenquelle nicht erreichbar.', detail: err.message });
  }
});

module.exports = router;
