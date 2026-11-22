// Klangwelt (v1.131.0): Sprachbefehle für den Stimmungs-Sound, echte Fotos zu jedem Klang
// (v1.140.0: dazu frei lizenzierte Videos von Wikimedia Commons, zuerst nur in Eve)
// (nur frei lizenzierte Bilder über Openverse) und "Wo regnet es gerade?" (Open-Meteo, ohne Schlüssel).
// Der Klang selbst und die bewegten Szenen entstehen im Browser (dashboard/klangraum.js + klangbild.js).
import { U } from "./datum.js";
import { IST_EVE } from "./config.js";
import { istFrei } from "./eve.js";

// ---------- Sprachbefehle (ohne Claude) ----------
const KLANG = [
  ["gewitter", /\b(gewitter|donner|blitz|unwetter|sturm)\b/],
  ["regen", /\b(regen|regengeräusche|regengeraeusche|regenrauschen)\b/],
  ["unterwasser", /\b(unterwasser|unter wasser|tauchen|aquarium)\b/],
  ["meer", /\b(meer|meeresrauschen|wellen|ozean|strand)\b/],
  ["bach", /\b(bach|bachlauf|fluss|plätschern|plaetschern|wasserfall)\b/],
  ["dschungel", /\b(dschungel|regenwald|urwald|tropen)\b/],
  ["wald", /\b(wald|vögel|voegel|vogelgezwitscher|natur|naturgeräusche|naturgeraeusche)\b/],
  ["kamin", /\b(kamin|kaminfeuer|lagerfeuer|feuer knistern)\b/],
  ["schnee", /\b(schnee|winter|winterwald|schneesturm)\b/],
  ["wind", /\b(wind|berge|bergwind|alpen)\b/],
  ["cafe", /\b(café|cafe|kaffeehaus|kaffee|stimmengewirr)\b/],
  ["zug", /\b(zug|zugfahrt|bahn|eisenbahn)\b/],
  ["klangschale", /\b(klangschale|meditation|meditieren|yoga|gong)\b/],
  ["herz", /\b(herzschlag|herz|beruhigen)\b/],
  ["raumschiff", /\b(raumschiff|brücke|bruecke|enterprise|jarvis)\b/],
  ["fokus", /\b(fokus|konzentration|konzentrier|brown noise|braunes rauschen|lernmusik|arbeitsmusik|fokus-sound|fokussound|deep work)\b/],
  ["nacht", /\b(nacht|grillen|einschlafen|schlafen|schlafgeräusche|schlafgeraeusche)\b/],
  ["weltraum", /\b(weltraum|space|all|sci-fi|scifi)\b/],
  ["puls", /\b(puls|energie|power|motivation|training|sport|party|workout)\b/],
];
const ANTWORT = {
  regen: "Regen läuft. Gemütlich.", gewitter: "Gewitter zieht auf. Schön drinnen bleiben.", meer: "Meeresrauschen läuft.",
  wald: "Wald und Vögel laufen.", kamin: "Das Kaminfeuer knistert.", fokus: "Fokus-Rauschen läuft. Viel Erfolg, Boss.",
  nacht: "Nachtgeräusche laufen. Schlaf gut.", weltraum: "Weltraum-Klang läuft.", puls: "Energie-Puls läuft.",
  wind: "Bergwind weht.", bach: "Der Bach plätschert.", schnee: "Winterwald im Schnee.", cafe: "Willkommen im Café.",
  zug: "Zugfahrt läuft. Lehn dich zurück.", unterwasser: "Abgetaucht.", dschungel: "Regenwald läuft.",
  klangschale: "Klangschale läuft. Tief durchatmen.", raumschiff: "Brücke ist bereit, Boss.", herz: "Ruhiger Herzschlag läuft.",
};

export function klangQuick(text) {
  const t = String(text || "").toLowerCase().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/, "").replace(/[!?.]/g, "").trim();
  if (U(/^(öffne|oeffne|zeig)( mir)?( den| die)? (stimmungs-?sound|klangraum|klang-raum|sound-?mixer|geräusche|geraeusche)$/).test(t)) return { answer: "Der Stimmungs-Sound ist offen.", actions: ["klang"] };
  if (U(/\b(stimmungs-?sound|hintergrund-?sound|hintergrundgeräusche|hintergrundgeraeusche|klangraum|naturgeräusche|naturgeraeusche|fokus-?sound|sound|geräusche|geraeusche|klang)\b.*\b(aus|stopp|stop|beenden|leiser machen)\b|^(mach|stell) (den |die )?(sound|geräusche|geraeusche|klang|stimmungs-?sound)( wieder)? aus$/).test(t)) return { answer: "Stimmungs-Sound ist aus.", actions: ["klang:aus"] };
  if (U(/\b(stimmungs-?sound|klang|sound)\b.*\b(automatisch|auto|passend|selbst aussuchen)\b|^(pass|passe) (den )?(sound|klang|die musik) (an|automatisch an)|^stimmungs-?sound( an)?$/).test(t)) return { answer: "Automatik an: Ich passe die Geräusche an das an, was du gerade in Friday machst.", actions: ["klang:auto"] };
  if (U(/^(wo|in welcher stadt) (regnet|schneit|gewittert|stürmt) es( gerade| jetzt| grade)?$/).test(t)) {
    const art = /schneit/.test(t) ? "schnee" : /gewitter|stürmt/.test(t) ? "gewitter" : "regen";
    return { answer: { regen: "Ich zeige dir, wo es gerade regnet.", schnee: "Ich zeige dir, wo es gerade schneit.", gewitter: "Ich zeige dir, wo es gerade gewittert." }[art], actions: [`klang:wo:${art}`] };
  }
  // v1.140.0 (Test in Eve): "Kaminfeuer mit Video", "zeig mir ein Video zum Regen", "Stimmungs-Sound als Video"
  const mitVideo = /\b(mit|als) (einem |dem )?videos?\b|\bvideos? (zum|zur|zu|vom|von|mit|über|ueber)\b|^(zeig|zeige)( mir)?( ein| das| ein paar)? videos?\b/.test(t)
    && !/^(erstell|mach|bau|dreh|schneid|produzier|render|schreib)/.test(t);
  if (mitVideo) {
    const zusatz = IST_EVE || istFrei("klang-video") ? "Mit Video." : "Die Videos dazu sind noch im Test – probier sie in Eve aus.";
    for (const [id, re] of KLANG) if (U(re).test(t)) return { answer: `${ANTWORT[id]} ${zusatz}`, actions: [`klang:${id}`, "klangvideo"] };
    if (/\b(stimmungs-?sound|klangraum|sound|klang|geräusch|geraeusch)/.test(t)) return { answer: "Ich zeige dir zum Klang ein passendes Video.", actions: ["klang", "klangvideo"] };
  }
  const klangWort = U(/\b(geräusch|geraeusch|sound|klang|rauschen|atmosphäre|atmosphaere|hintergrundmusik|musik|lernmusik|arbeitsmusik)\w*/).test(t);
  if (/\b(spotify|playlist|lied|song|album|radio|licht|lampe|fernseher|tv|alexa|wetter)\b/.test(t)) return null;
  for (const [id, re] of KLANG) {
    if (!U(re).test(t)) continue;
    const kurzBefehl = U(/^(spiel|spiele|starte|mach|ich brauche|gib mir)( mir)?( mal| etwas| ein bisschen| ein| einen| eine| den| die| das)* \S+( \S+)?( an| ab| bitte)*$/).test(t);
    if (klangWort || (kurzBefehl && !["puls", "nacht", "herz", "bach"].includes(id))) return { answer: ANTWORT[id], actions: [`klang:${id}`] };
  }
  return null;
}

// ---------- Echte Fotos (Openverse: nur frei lizenzierte Bilder) ----------
const FOTO_SUCHE = {
  regen: "rain window city", gewitter: "lightning storm night", meer: "ocean sunset waves", wald: "forest sunlight",
  kamin: "fireplace fire", fokus: "desk lamp night study", nacht: "starry night meadow", weltraum: "nebula hubble",
  puls: "concert lights stage", wind: "mountains clouds wind", bach: "forest stream", schnee: "snowy forest winter",
  cafe: "cafe interior cozy", zug: "train window landscape", unterwasser: "underwater coral reef fish",
  dschungel: "rainforest jungle", klangschale: "singing bowl", raumschiff: "spacecraft cockpit", herz: "heart light",
};
const fotoCache = new Map(); // suche -> { at, fotos }

export async function fotos(art, ort = "") {
  const basis = FOTO_SUCHE[art];
  if (!basis) return [];
  const suche = ort ? `${ort} ${art === "schnee" ? "snow" : art === "gewitter" ? "storm" : "rain"}` : basis;
  const c = fotoCache.get(suche);
  if (c && Date.now() - c.at < 6 * 60 * 60 * 1000) return c.fotos;
  try {
    const res = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(suche)}&page_size=12&mature=false&aspect_ratio=wide&size=large`, {
      headers: { "User-Agent": "F.R.Ai.D.A.Y/1.0" }, signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const liste = (data.results || []).map((r) => ({
      bild: r.url || r.thumbnail, klein: r.thumbnail || r.url,
      titel: r.title || "", autor: r.creator || "", lizenz: `${String(r.license || "").toUpperCase()} ${r.license_version || ""}`.trim(),
      seite: r.foreign_landing_url || r.url || "", quelle: r.source || r.provider || "",
    })).filter((f) => /^https:\/\//.test(f.bild));
    // Mit Ort nichts gefunden? Dann das allgemeine Motiv.
    if (!liste.length && ort) return fotos(art, "");
    fotoCache.set(suche, { at: Date.now(), fotos: liste });
    return liste;
  } catch { return ort ? fotos(art, "") : []; }
}

// ---------- Videos zu jedem Klang (v1.140.0, zuerst nur in Eve) ----------
// Nur Wikimedia Commons: dort ist jedes Video frei lizenziert (CC0, CC BY, CC BY-SA, gemeinfrei).
// Handverlesene Clips je Klang; wenn die nicht erreichbar sind, sucht Friday selbst auf Commons.
// Die Videos laufen stumm – der Klang kommt weiter live aus dem Browser.
const VIDEO_AUSWAHL = {
  regen: ["Radevormwald - Raindrops on a window 07 (1) ies.webm", "Raindrops against the window in the night city, Las Palmas.webm", "Radevormwald - Raindrops on a window 09 (1) ies.webm", "Rain in Sonoma - December 2025 - Sarah Stierch.webm", "Rainfall in East Legon 03.webm"],
  gewitter: ["Гроза в Донецке- Thunderstorm in Donetsk.webm", "Éclairs orage de canicule soir 20 juin 2026 Lille.ogg", "Lightning - condensed version.webm", "Heat lightning - tokyo area - Aug 30 2021.webm"],
  meer: ["Waves crashing on rocks off Beach 4, Kalaloch Beach, Washington 01.webm", "Ocean Shores - Waves &Seagulls 2015-06 303 (90 Sec).ogv", "Groyne and sea waves at Curonian Spit.webm", "Waves of the sea (Video).webm", "Aerial view of sand beach. Top view sea waves. Drone footage.webm"],
  wald: ["Valla forest Nature reserve - A quiet place.webm", "Valla forest Nature reserve - High summer day.webm", "Hatfield Forest Lake and visitor centre, Hatfield Broad Oak Essex England.webm", "Birds of Sahyadri -Asian Paradise Flycatcher -.webm"],
  kamin: ["Fantastic-fireplace-fire-chimney-hearth- background - texture - motion graphics - free video library.webm", "Fireplace 1 2021-02-14.webm", "Fireplace in Akita City Akarenga-kan Museum 2024 march 28.ogg", "Fire آتش 01.ogv", "Fire آتش 03.ogv"],
  fokus: ["ဖယောင်းတိုင်မီးတောက်.webm", "White candle video.webm", "Blue candle burning.webm", "Wachsbrenner (minimalistisch).webm"],
  nacht: ["JAPAN Milk Way 4K - Beautiful Star and Sky at Night Time Lapse.webm", "Timelapse of Milky way changing colors during Aurora - 53921478021.webm", "La Silla Timelapse General view.ogv", "A timelapse of the Milky Way's movement against the backdrop of the Assy-Turgen Observatory at an altitude of 2,750 m. Kazakhstan.webm"],
  weltraum: ["Flight through Orion Nebula in visible light (Hubblecast 106b excerpt).webm", "Zoom into the Horsehead Nebula ESA496748.webm", "Orion Nebula 3D Fly-Through - HST.ogv", "Alexander Gerst’s Earth timelapses (2017 reissue).webm"],
  puls: ["Laserbeam laser show in Bad Westernkotten 20240817 212704.webm", "Laser LY-RGBW01 presets in smoke PC291932.webm", "Laserbeam laser show in Bad Westernkotten 20240817 213138.webm", "1. Light Mowe Festival - Łódź 2015 - Laser show.webm"],
  wind: ["Time Lapse Clouds above Steens Mountain (36203941112).webm", "Lenticular cloud over Longs Peak, Colorado (time lapse).ogv", "Wind blowing into grass and plants on a sunny day 2024-05-09.webm", "Winter Timelapse of Clouds Roiling over Rimrock on Okanagan Mountain.webm"],
  bach: ["Barnes Creek 2022.webm", "Stream of water by Barnes Creek.webm", "Autumn stream in West Virginia.webm", "Cascading stream at Cascade Springs, May 17.webm", "Wolf Creek Falls Trail (25652917596).webm"],
  schnee: ["Snow falling in Charlton MA 2025-12-14.webm", "Snow under LED street light in Tuntorp, Brastad.webm", "Landschaftsschutzgebiet Volkspark Rehberge lub 2026-01-03 snowing.webm", "Daffodils in the Snow.webm"],
  cafe: ["Café Lomi, Paris - Vimeo.webm", "Kahvin tiputtelu Moccamasterilla.webm", "Cafe du Monde1.webm", "ET Bahir Dar asv2018-02 coffee roasting video.webm"],
  zug: ["Amtrak Hiawatha 334 Dome View Milwaukee To Airport.webm", "EXPO-1520 double-decker train ride in 2013.webm", "2ES5 cab ride.webm"],
  unterwasser: ["Tropical Fish Banner Fish on Coral Reef.webm", "First records of fish species at the Chesterfield-Bellona reef complex in the Coral Sea Marine Park (Ifremer 00669-78069 - 31555).webm", "Grüner Vogel-Lippfisch (Gomphosus varius)-Лазоревый клюворыл (Female fish) DSCF2720.webm", "Scuba diver with fish - kanagawa - 2025 march 21.webm", "Underwater Videos 5.webm"],
  dschungel: ["California Academy of Sciences - Rainforests of the World 3 2024-01-16.webm", "Diana Creek Rapids.webm", "011 Dark-capped bulbul eating at Bwindi Impenetrable Forest National Park Video by Giles Laurent.webm", "Amazon Rainforest, Brazil.webm"],
  klangschale: ["Watching Tibetan bowls sing.webm", "Singing bowl.ogv", "ဖယောင်းတိုင်မီးတောက်.webm"],
  herz: ["White candle video.webm", "Timelapse of Milky way changing colors during Aurora - 53921478021.webm", "Blue candle burning.webm"],
  raumschiff: ["First 8K Video from Space - Ultra HD VP9.webm", "Dragon CRS-11 Cargo Ship Departs ISS for Earth.webm", "Alexander Gerst’s Earth timelapses (2017 reissue).webm"],
};
// Ersatz-Suche auf Commons, falls die Auswahl nicht reicht
const VIDEO_SUCHE = {
  regen: "rain window", gewitter: "lightning thunderstorm", meer: "ocean waves beach", wald: "forest birds", kamin: "fireplace",
  fokus: "candle flame", nacht: "milky way timelapse", weltraum: "nebula", puls: "laser show", wind: "clouds timelapse",
  bach: "forest stream", schnee: "snow falling", cafe: "cafe", zug: "cab ride", unterwasser: "coral reef fish",
  dschungel: "rainforest", klangschale: "singing bowl", herz: "candle", raumschiff: "space station",
};
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const videoCache = new Map(); // art -> { at, videos }
const ohneHtml = (t) => String(t || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();

function videoEintrag(seite) {
  const v = seite?.videoinfo?.[0];
  if (!v || !(v.width > v.height)) return null; // nur Querformat
  const d = Array.isArray(v.derivatives) ? v.derivatives : [];
  const nach = (k) => d.find((x) => x.transcodekey === k);
  const webm = nach("720p.vp9.webm") || nach("480p.vp9.webm") || nach("720p.webm") || nach("480p.webm");
  const webmHD = nach("1080p.vp9.webm") || nach("720p.vp9.webm") || webm;
  const mov = nach("360p.mpeg4.mov") || d.find((x) => /mp4|quicktime/.test(x.type || ""));
  if (!webm && !mov) return null;
  const m = v.extmetadata || {};
  return {
    titel: ohneHtml(m.ObjectName?.value) || String(seite.title || "").replace(/^File:/, "").replace(/\.(webm|ogv|ogg)$/i, ""),
    autor: ohneHtml(m.Artist?.value).slice(0, 60),
    lizenz: ohneHtml(m.LicenseShortName?.value) || "frei",
    seite: v.descriptionurl || "",
    poster: v.thumburl || "",
    dauer: Math.round(v.duration || 0),
    quellen: [
      webm && { src: webm.src, type: "video/webm", hd: webmHD?.src || webm.src },
      mov && { src: mov.src, type: "video/mp4" }, // Safari spielt die .mov-Fassung als MP4
    ].filter(Boolean),
  };
}

async function commons(params, versuch = 0) {
  const q = new URLSearchParams({ action: "query", format: "json", formatversion: "2", prop: "videoinfo", viprop: "url|size|extmetadata|derivatives", viurlwidth: "1280", ...params });
  const res = await fetch(`${COMMONS}?${q}`, { headers: { "User-Agent": "F.R.Ai.D.A.Y/1.0 (Stimmungs-Sound)" }, signal: AbortSignal.timeout(12000) });
  // Commons bremst bei vielen Anfragen kurz hintereinander (429) – dann einmal kurz warten und neu fragen.
  if ((res.status === 429 || res.status >= 500) && versuch < 2) { await new Promise((r) => setTimeout(r, 2500 * (versuch + 1))); return commons(params, versuch + 1); }
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  const data = await res.json();
  return data?.query?.pages || [];
}

export async function videos(art) {
  const auswahl = VIDEO_AUSWAHL[art];
  if (!auswahl) return [];
  const c = videoCache.get(art);
  if (c && Date.now() - c.at < 12 * 60 * 60 * 1000) return c.videos;
  let liste = [];
  try {
    const seiten = await commons({ titles: auswahl.map((t) => `File:${t}`).join("|") });
    const rang = new Map(auswahl.map((t, i) => [`File:${t}`.replace(/_/g, " "), i]));
    liste = seiten.filter((s) => !s.missing).sort((a, b) => (rang.get(a.title) ?? 99) - (rang.get(b.title) ?? 99)).map(videoEintrag).filter(Boolean);
  } catch { /* Ersatz-Suche versuchen */ }
  if (liste.length < 2) {
    try {
      const seiten = await commons({ generator: "search", gsrsearch: `${VIDEO_SUCHE[art]} filetype:video`, gsrnamespace: "6", gsrlimit: "12" });
      const da = new Set(liste.map((v) => v.seite));
      for (const v of seiten.map(videoEintrag).filter(Boolean)) if (v.dauer >= 8 && !da.has(v.seite)) liste.push(v);
    } catch { /* nichts erreichbar */ }
  }
  liste = liste.slice(0, 6);
  if (liste.length) videoCache.set(art, { at: Date.now(), videos: liste });
  return liste;
}

// ---------- Wo regnet/schneit/gewittert es gerade? ----------
const ORTE = [
  ["Berlin", "🇩🇪", 52.52, 13.41], ["Hamburg", "🇩🇪", 53.55, 9.99], ["München", "🇩🇪", 48.14, 11.58], ["Köln", "🇩🇪", 50.94, 6.96],
  ["Wien", "🇦🇹", 48.21, 16.37], ["Zürich", "🇨🇭", 47.37, 8.54], ["London", "🇬🇧", 51.51, -0.13], ["Dublin", "🇮🇪", 53.35, -6.26],
  ["Paris", "🇫🇷", 48.86, 2.35], ["Amsterdam", "🇳🇱", 52.37, 4.9], ["Bergen", "🇳🇴", 60.39, 5.32], ["Stockholm", "🇸🇪", 59.33, 18.07],
  ["Reykjavík", "🇮🇸", 64.15, -21.94], ["Rom", "🇮🇹", 41.9, 12.5], ["Madrid", "🇪🇸", 40.42, -3.7], ["Lissabon", "🇵🇹", 38.72, -9.14],
  ["Athen", "🇬🇷", 37.98, 23.73], ["Istanbul", "🇹🇷", 41.01, 28.98], ["Moskau", "🇷🇺", 55.76, 37.62], ["Kairo", "🇪🇬", 30.04, 31.24],
  ["Lagos", "🇳🇬", 6.52, 3.38], ["Nairobi", "🇰🇪", -1.29, 36.82], ["Kapstadt", "🇿🇦", -33.92, 18.42], ["Dubai", "🇦🇪", 25.2, 55.27],
  ["Mumbai", "🇮🇳", 19.08, 72.88], ["Bangkok", "🇹🇭", 13.76, 100.5], ["Singapur", "🇸🇬", 1.35, 103.82], ["Jakarta", "🇮🇩", -6.21, 106.85],
  ["Hongkong", "🇭🇰", 22.32, 114.17], ["Peking", "🇨🇳", 39.9, 116.4], ["Seoul", "🇰🇷", 37.57, 126.98], ["Tokio", "🇯🇵", 35.68, 139.69],
  ["Sydney", "🇦🇺", -33.87, 151.21], ["Auckland", "🇳🇿", -36.85, 174.76], ["Honolulu", "🇺🇸", 21.31, -157.86], ["Vancouver", "🇨🇦", 49.28, -123.12],
  ["Seattle", "🇺🇸", 47.61, -122.33], ["Los Angeles", "🇺🇸", 34.05, -118.24], ["Chicago", "🇺🇸", 41.88, -87.63], ["New York", "🇺🇸", 40.71, -74.01],
  ["Miami", "🇺🇸", 25.76, -80.19], ["Mexiko-Stadt", "🇲🇽", 19.43, -99.13], ["Bogotá", "🇨🇴", 4.71, -74.07], ["Manaus", "🇧🇷", -3.12, -60.02],
  ["Rio de Janeiro", "🇧🇷", -22.91, -43.17], ["Buenos Aires", "🇦🇷", -34.6, -58.38], ["Lima", "🇵🇪", -12.05, -77.04], ["Anchorage", "🇺🇸", 61.22, -149.9],
];
// WMO-Wettercodes
const CODE_TEXT = { 51: "Nieselregen", 53: "Nieselregen", 55: "starker Niesel", 56: "gefrierender Niesel", 57: "gefrierender Niesel", 61: "leichter Regen", 63: "Regen", 65: "starker Regen", 66: "Eisregen", 67: "Eisregen", 71: "leichter Schnee", 73: "Schnee", 75: "starker Schnee", 77: "Schneegriesel", 80: "Regenschauer", 81: "Regenschauer", 82: "heftige Schauer", 85: "Schneeschauer", 86: "Schneeschauer", 95: "Gewitter", 96: "Gewitter mit Hagel", 99: "Gewitter mit Hagel" };
const PASST = {
  regen: (c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95,
  gewitter: (c) => c >= 95,
  schnee: (c) => (c >= 71 && c <= 77) || c === 85 || c === 86,
};
let wetterCache = null; // { at, liste }

async function weltWetter() {
  if (wetterCache && Date.now() - wetterCache.at < 15 * 60 * 1000) return wetterCache.liste;
  const lat = ORTE.map((o) => o[2]).join(","), lon = ORTE.map((o) => o[3]).join(",");
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,temperature_2m,precipitation&timezone=auto`, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = await res.json();
  const arr = Array.isArray(data) ? data : [data];
  const liste = arr.map((d, i) => ({
    name: ORTE[i][0], flagge: ORTE[i][1], code: d.current?.weather_code ?? -1,
    temp: d.current?.temperature_2m ?? null, mm: d.current?.precipitation ?? 0, zeit: d.current?.time || "",
  }));
  wetterCache = { at: Date.now(), liste };
  return liste;
}

export async function woGerade(art) {
  const passt = PASST[art];
  if (!passt) return { art, orte: [], geprueft: 0 };
  const liste = await weltWetter();
  let orte = liste.filter((o) => passt(o.code));
  // Gerade nirgends Gewitter? Dann wenigstens starker Regen.
  let ersatz = false;
  if (!orte.length && art === "gewitter") { orte = liste.filter((o) => [65, 82].includes(o.code)); ersatz = orte.length > 0; }
  orte = orte.sort((a, b) => (b.mm || 0) - (a.mm || 0) || b.code - a.code).slice(0, 10)
    .map((o) => ({ ...o, text: CODE_TEXT[o.code] || "Niederschlag" }));
  return { art, orte, geprueft: liste.length, ersatz };
}

export function klangRouten(app, asyncRoute) {
  app.get("/api/klang/foto", asyncRoute(async (req, res) => {
    res.json({ fotos: await fotos(String(req.query.art || ""), String(req.query.ort || "").slice(0, 40)) });
  }));
  app.get("/api/klang/video", asyncRoute(async (req, res) => {
    res.json({ videos: await videos(String(req.query.art || "")) });
  }));
  app.get("/api/klang/wo", asyncRoute(async (req, res) => {
    try { res.json(await woGerade(String(req.query.art || "regen"))); } catch (err) { res.status(502).json({ error: `Wetterdaten gerade nicht erreichbar (${err.message}).` }); }
  }));
}
