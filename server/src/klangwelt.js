// Klangwelt (v1.131.0): Sprachbefehle für den Stimmungs-Sound, echte Fotos zu jedem Klang
// (nur frei lizenzierte Bilder über Openverse) und "Wo regnet es gerade?" (Open-Meteo, ohne Schlüssel).
// Der Klang selbst und die bewegten Szenen entstehen im Browser (dashboard/klangraum.js + klangbild.js).
import { U } from "./datum.js";

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
  app.get("/api/klang/wo", asyncRoute(async (req, res) => {
    try { res.json(await woGerade(String(req.query.art || "regen"))); } catch (err) { res.status(502).json({ error: `Wetterdaten gerade nicht erreichbar (${err.message}).` }); }
  }));
}
