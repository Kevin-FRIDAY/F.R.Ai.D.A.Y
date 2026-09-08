// Land-Aliase -> echte, direkt verlinkende Nachrichtenquelle (kein
// Google-News-Redirect, damit sich Bild/Video aus dem echten Artikel lesen
// lassen) + Globus-Marker-Koordinaten (Hauptstadt).
//
// Jede feedUrl wurde manuell gegen die echte Quelle geprüft. Nur eindeutige
// Wörter als Alias (keine kurzen ISO-Codes), damit die Worterkennung im
// Sprachbefehl nicht versehentlich anschlägt.

const COUNTRIES = [
  {
    code: 'US', name: 'USA', lat: 38.9, lon: -77.0, lang: 'en-US',
    feedUrl: 'https://feeds.npr.org/1001/rss.xml', source: 'NPR',
    aliases: ['usa', 'vereinigte staaten', 'united states', 'amerika', 'america'],
  },
  {
    code: 'DE', name: 'Deutschland', lat: 52.5, lon: 13.4, lang: 'de-DE',
    feedUrl: 'https://www.tagesschau.de/xml/rss2', source: 'Tagesschau',
    aliases: ['deutschland', 'germany'],
  },
  {
    code: 'GB', name: 'Vereinigtes Königreich', lat: 51.5, lon: -0.1, lang: 'en-GB',
    feedUrl: 'http://feeds.bbci.co.uk/news/rss.xml', source: 'BBC',
    aliases: ['grossbritannien', 'großbritannien', 'vereinigtes königreich', 'england', 'britain', 'united kingdom'],
  },
  {
    code: 'FR', name: 'Frankreich', lat: 48.9, lon: 2.4, lang: 'fr-FR',
    feedUrl: 'https://www.lemonde.fr/rss/une.xml', source: 'Le Monde',
    aliases: ['frankreich', 'france'],
  },
  {
    code: 'IT', name: 'Italien', lat: 41.9, lon: 12.5, lang: 'it-IT',
    feedUrl: 'https://www.ansa.it/sito/ansait_rss.xml', source: 'ANSA',
    aliases: ['italien', 'italy'],
  },
  {
    code: 'ES', name: 'Spanien', lat: 40.4, lon: -3.7, lang: 'es-ES',
    feedUrl: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', source: 'El Mundo',
    aliases: ['spanien', 'spain'],
  },
  {
    code: 'RU', name: 'Russland', lat: 55.8, lon: 37.6, lang: 'ru-RU',
    feedUrl: 'https://tass.com/rss/v2.xml', source: 'TASS',
    aliases: ['russland', 'russia'],
  },
  {
    code: 'CN', name: 'China', lat: 39.9, lon: 116.4, lang: 'zh-CN',
    feedUrl: 'https://www.scmp.com/rss/91/feed', source: 'South China Morning Post',
    aliases: ['china'],
  },
  {
    code: 'JP', name: 'Japan', lat: 35.7, lon: 139.7, lang: 'ja-JP',
    feedUrl: 'https://www3.nhk.or.jp/rss/news/cat0.xml', source: 'NHK',
    aliases: ['japan'],
  },
  {
    code: 'IN', name: 'Indien', lat: 28.6, lon: 77.2, lang: 'en-IN',
    feedUrl: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', source: 'Times of India',
    aliases: ['indien', 'india'],
  },
  {
    code: 'BR', name: 'Brasilien', lat: -15.8, lon: -47.9, lang: 'pt-BR',
    feedUrl: 'https://g1.globo.com/rss/g1/', source: 'G1 Globo',
    aliases: ['brasilien', 'brazil'],
  },
  {
    code: 'CA', name: 'Kanada', lat: 45.4, lon: -75.7, lang: 'en-CA',
    feedUrl: 'https://www.cbc.ca/cmlink/rss-topstories', source: 'CBC',
    aliases: ['kanada', 'canada'],
  },
  {
    code: 'AU', name: 'Australien', lat: -35.3, lon: 149.1, lang: 'en-AU',
    feedUrl: 'https://www.abc.net.au/news/feed/51120/rss.xml', source: 'ABC News Australia',
    aliases: ['australien', 'australia'],
  },
  {
    code: 'KR', name: 'Südkorea', lat: 37.6, lon: 127.0, lang: 'ko-KR',
    feedUrl: 'https://en.yna.co.kr/RSS/news.xml', source: 'Yonhap',
    aliases: ['südkorea', 'suedkorea', 'south korea', 'korea'],
  },
  {
    code: 'MX', name: 'Mexiko', lat: 19.4, lon: -99.1, lang: 'es-MX',
    feedUrl: 'https://www.jornada.com.mx/rss/edicion.xml', source: 'La Jornada',
    aliases: ['mexiko', 'mexico'],
  },
  {
    code: 'ZA', name: 'Südafrika', lat: -25.7, lon: 28.2, lang: 'en-ZA',
    feedUrl: 'https://www.iol.co.za/rss', source: 'IOL',
    aliases: ['südafrika', 'suedafrika', 'south africa'],
  },
  {
    code: 'TR', name: 'Türkei', lat: 39.9, lon: 32.9, lang: 'tr-TR',
    feedUrl: 'https://www.hurriyet.com.tr/rss/anasayfa', source: 'Hürriyet',
    aliases: ['türkei', 'tuerkei', 'turkey'],
  },
  {
    code: 'CH', name: 'Schweiz', lat: 46.9, lon: 7.4, lang: 'de-CH',
    feedUrl: 'https://www.srf.ch/news/bnf/rss/1890', source: 'SRF',
    aliases: ['schweiz', 'switzerland'],
  },
  {
    code: 'AT', name: 'Österreich', lat: 48.2, lon: 16.4, lang: 'de-AT',
    feedUrl: 'https://kurier.at/xml/rssd', source: 'Kurier',
    aliases: ['österreich', 'oesterreich', 'austria'],
  },
  {
    code: 'NL', name: 'Niederlande', lat: 52.1, lon: 4.3, lang: 'nl-NL',
    feedUrl: 'https://feeds.nos.nl/nosnieuwsalgemeen', source: 'NOS',
    aliases: ['niederlande', 'netherlands', 'holland'],
  },
  {
    code: 'PL', name: 'Polen', lat: 52.2, lon: 21.0, lang: 'pl-PL',
    feedUrl: 'https://www.rp.pl/rss_main', source: 'Rzeczpospolita',
    aliases: ['polen', 'poland'],
  },
  {
    code: 'UA', name: 'Ukraine', lat: 50.4, lon: 30.5, lang: 'uk-UA',
    feedUrl: 'https://www.pravda.com.ua/eng/rss/', source: 'Ukrayinska Pravda',
    aliases: ['ukraine'],
  },
  {
    code: 'IL', name: 'Israel', lat: 31.8, lon: 35.2, lang: 'he-IL',
    feedUrl: 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx', source: 'The Jerusalem Post',
    aliases: ['israel'],
  },
  {
    code: 'SA', name: 'Saudi-Arabien', lat: 24.7, lon: 46.7, lang: 'ar-SA',
    feedUrl: 'https://www.arabnews.com/rss.xml', source: 'Arab News',
    aliases: ['saudi-arabien', 'saudi arabien', 'saudi arabia'],
  },
  {
    code: 'EG', name: 'Ägypten', lat: 30.0, lon: 31.2, lang: 'ar-EG',
    feedUrl: 'https://dailynewsegypt.com/feed/', source: 'Daily News Egypt',
    aliases: ['ägypten', 'aegypten', 'egypt'],
  },
  {
    code: 'AR', name: 'Argentinien', lat: -34.6, lon: -58.4, lang: 'es-AR',
    feedUrl: 'https://www.batimes.com.ar/feed', source: 'Buenos Aires Times',
    aliases: ['argentinien', 'argentina'],
  },
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Findet das erste Land, dessen Alias als ganzes Wort im Text vorkommt.
// Längere Aliase zuerst prüfen, damit z.B. "südkorea" vor generischeren
// Treffern gewinnt.
function findCountry(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const candidates = COUNTRIES
    .flatMap(c => c.aliases.map(a => ({ country: c, alias: a })))
    .sort((a, b) => b.alias.length - a.alias.length);

  for (const { country, alias } of candidates) {
    const re = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
    if (re.test(lower)) return country;
  }
  return null;
}

function listCountries() {
  return COUNTRIES.map(c => ({ code: c.code, name: c.name, lat: c.lat, lon: c.lon, lang: c.lang }));
}

module.exports = { COUNTRIES, findCountry, listCountries };
