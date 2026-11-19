// Lagebild: eigene Friday-Ebenen für das Weltgeschehen (im Stil eines OSINT-Lagebilds).
// Nur frei zugängliche, öffentliche Quellen ohne Schlüssel:
//   NOAA SWPC (Weltraumwetter, Polarlicht), IODA / Georgia Tech (Internet-Störungen je Land),
//   Open-Meteo (Wind, Temperatur, Regen, Luftqualität), The Space Devs (Raketenstarts),
//   TeleGeography (Seekabel-Karte), RainViewer (Regenradar-Kacheln), dazu Friday's eigene
//   Nachrichten-Auswertung (Konflikt-Meldungen aus Schlagzeilen).
// Bewusst NICHT dabei: Überwachung, fremde Kameras, nicht-öffentliche oder militärische Live-Daten.
import { COUNTRIES, newsSnapshot } from "./lagezentrum.js";

const UA = { "User-Agent": "F.R.Ai.D.A.Y/1.0 (privater Assistent)" };
const cache = new Map(); // key -> { at, data }

async function cached(key, ms, fn) {
  const c = cache.get(key);
  if (c && Date.now() - c.at < ms) return c.data;
  try {
    const data = await fn();
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    if (c) return c.data; // lieber alte Daten als keine
    throw err;
  }
}
async function getJson(url, ms = 15000) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.json();
}

const byCca2 = new Map(COUNTRIES.filter((c) => c.cca2).map((c) => [c.cca2.toUpperCase(), c]));

// ---------- Weltraumwetter (NOAA SWPC) ----------
const KP_TEXT = (kp) => kp >= 8 ? "extremer Sturm" : kp >= 7 ? "schwerer Sturm" : kp >= 6 ? "starker Sturm" : kp >= 5 ? "Sturm" : kp >= 4 ? "unruhig" : "ruhig";
export function getWeltraum() {
  return cached("weltraum", 10 * 60 * 1000, async () => {
    const base = "https://services.swpc.noaa.gov";
    const [kpRaw, wind, scales] = await Promise.all([
      getJson(`${base}/products/noaa-planetary-k-index.json`).catch(() => null),
      getJson(`${base}/products/summary/solar-wind-speed.json`).catch(() => null),
      getJson(`${base}/products/noaa-scales.json`).catch(() => null),
    ]);
    // Format ist entweder [{time_tag,Kp}] oder (älter) [["time_tag","Kp",...], [...]]
    let kpList = [];
    if (Array.isArray(kpRaw)) {
      if (Array.isArray(kpRaw[0])) kpList = kpRaw.slice(1).map((r) => ({ zeit: r[0], kp: Number(r[1]) }));
      else kpList = kpRaw.map((r) => ({ zeit: r.time_tag, kp: Number(r.Kp ?? r.kp_index) }));
    }
    kpList = kpList.filter((k) => Number.isFinite(k.kp));
    const kp = kpList.at(-1)?.kp ?? null;
    const jetzt = scales?.["0"] || {};
    const sw = Array.isArray(wind) ? Number(wind[0]?.proton_speed ?? wind[0]?.WindSpeed) : null;
    return {
      kp, kp_text: kp == null ? "unbekannt" : KP_TEXT(kp),
      kp_verlauf: kpList.slice(-16).map((k) => k.kp),
      sonnenwind_kms: Number.isFinite(sw) ? sw : null,
      skalen: { funk: jetzt.R?.Scale ?? null, strahlung: jetzt.S?.Scale ?? null, geomagnetisch: jetzt.G?.Scale ?? null },
      stand: new Date().toISOString(), quelle: "NOAA Space Weather Prediction Center",
    };
  });
}

// Polarlicht-Vorhersage (OVATION). 1°-Raster -> auf 3° ausgedünnt, nur sichtbare Stärke.
export function getPolarlicht() {
  return cached("polarlicht", 15 * 60 * 1000, async () => {
    const d = await getJson("https://services.swpc.noaa.gov/json/ovation_aurora_latest.json", 20000);
    const punkte = [];
    for (const [lon, lat, v] of d.coordinates || []) {
      if (v < 8 || lon % 3 || lat % 2) continue;
      punkte.push([lon > 180 ? lon - 360 : lon, lat, v]);
    }
    punkte.sort((a, b) => b[2] - a[2]);
    return { vorhersage: d["Forecast Time"] || null, punkte: punkte.slice(0, 700), quelle: "NOAA OVATION" };
  });
}

// ---------- Internet-Störungen je Land (IODA, Georgia Tech) ----------
const QUELLEN = { bgp: "Netz-Routen (BGP)", "ping-slash24": "Erreichbarkeit (Ping)", "merit-nt": "Netz-Teleskop", gtr: "Google-Verkehr" };
export function getInternet() {
  return cached("internet", 15 * 60 * 1000, async () => {
    const until = Math.floor(Date.now() / 1000), from = until - 24 * 3600;
    const d = await getJson(`https://api.ioda.inetintel.cc.gatech.edu/v2/outages/alerts?from=${from}&until=${until}&entityType=country&limit=2000`, 20000);
    // Pro Land + Quelle die letzte Meldung: noch "critical"/"warning" = Störung läuft.
    const last = new Map();
    for (const a of d.data || []) {
      const code = a.entity?.code; if (!code) continue;
      const k = code + "|" + a.datasource;
      if (!last.has(k) || last.get(k).time < a.time) last.set(k, a);
    }
    const proLand = new Map();
    for (const a of last.values()) {
      const code = a.entity.code;
      const e = proLand.get(code) || { code, name: a.entity.name, quellen: [], stufe: "normal", seit: null, einbruch: 0, vorbei: 0 };
      if (a.level === "normal") e.vorbei++;
      else {
        e.quellen.push(QUELLEN[a.datasource] || a.datasource);
        if (a.level === "critical" || e.stufe === "normal") e.stufe = a.level;
        e.seit = e.seit ? Math.min(e.seit, a.time) : a.time;
        if (a.historyValue > 0) e.einbruch = Math.max(e.einbruch, Math.round((1 - a.value / a.historyValue) * 100));
      }
      proLand.set(code, e);
    }
    const liste = [];
    for (const e of proLand.values()) {
      const c = byCca2.get(e.code);
      if (!c) continue;
      const aktiv = e.stufe !== "normal";
      // Nur Google-Verkehr gesunken (schwankt bei kleinen Ländern stark) -> höchstens "leicht".
      const nurGoogle = e.quellen.length === 1 && e.quellen[0] === QUELLEN.gtr;
      liste.push({ id: c.id, land: c.name, flag: c.flag || "", lat: c.lat, lon: c.lon, aktiv, stufe: aktiv ? (e.stufe === "critical" && !nurGoogle ? "stark" : "leicht") : "behoben", quellen: e.quellen, einbruch_prozent: e.einbruch || null, seit: e.seit ? new Date(e.seit * 1000).toISOString() : null });
    }
    liste.sort((a, b) => (b.aktiv - a.aktiv) || ((b.stufe === "stark") - (a.stufe === "stark")) || ((b.einbruch_prozent || 0) - (a.einbruch_prozent || 0)));
    return { stoerungen: liste, aktiv: liste.filter((x) => x.aktiv).length, stand: new Date().toISOString(), quelle: "IODA (Georgia Tech)" };
  });
}

// ---------- Konflikt- und Krisen-Meldungen aus Fridays eigener Nachrichten-Auswertung ----------
const KAMPF = /(luftangriff|angriff|angegriffen|rakete|drohne|beschuss|beschossen|gefecht|kämpfe|krieg|offensive|front|explosion|anschlag|bombe|terror|schüsse|getötet|tote\b|militär|truppen|soldaten|geisel|massaker|waffenruhe|invasion)/i;
const UNRUHE = /(protest|demonstr|unruhen|aufstand|putsch|ausschreitung|massenproteste|generalstreik|tränengas|festnahmen)/i;
export function getKonflikte() {
  const out = [];
  for (const [id, items] of newsSnapshot()) {
    const c = COUNTRIES.find((x) => x.id === id);
    if (!c || !items?.length) continue;
    const kampf = items.filter((i) => KAMPF.test(i.title));
    const unruhe = items.filter((i) => !KAMPF.test(i.title) && UNRUHE.test(i.title));
    const n = kampf.length + unruhe.length;
    if (n < 2) continue;
    out.push({
      id, land: c.name, flag: c.flag || "", lat: c.lat, lon: c.lon,
      art: kampf.length >= unruhe.length ? "kampf" : "unruhe",
      meldungen: n, anteil: Math.round((n / items.length) * 100),
      schlagzeilen: [...kampf, ...unruhe].slice(0, 4).map((i) => ({ titel: i.title, quelle: i.source, link: i.link, zeit: i.date })),
    });
  }
  out.sort((a, b) => b.meldungen - a.meldungen);
  return { laender: out.slice(0, 40), stand: new Date().toISOString(), quelle: "Friday-Auswertung öffentlicher Schlagzeilen (Google News)", hinweis: "Häufung von Konflikt-Wörtern in Schlagzeilen, keine bestätigten Lagemeldungen." };
}

// ---------- Wetter-Raster für den Globus (Open-Meteo) ----------
export function getWetterRaster() {
  return cached("wetter", 90 * 60 * 1000, async () => {
    const lats = [], lons = [];
    for (let lat = -60; lat <= 75; lat += 15) for (let lon = -180; lon < 180; lon += 15) { lats.push(lat); lons.push(lon); }
    const felder = "temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover";
    const punkte = [];
    // In zwei Teilen abfragen (URL nicht zu lang).
    for (let i = 0; i < lats.length; i += 120) {
      const la = lats.slice(i, i + 120), lo = lons.slice(i, i + 120);
      const d = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${la.join(",")}&longitude=${lo.join(",")}&current=${felder}&wind_speed_unit=kmh`, 25000);
      const arr = Array.isArray(d) ? d : [d];
      arr.forEach((p, j) => {
        const c = p.current || {};
        punkte.push({ lat: la[j], lon: lo[j], temp: c.temperature_2m, wind: c.wind_speed_10m, richtung: c.wind_direction_10m, regen: c.precipitation, wolken: c.cloud_cover });
      });
    }
    return { punkte, stand: new Date().toISOString(), quelle: "Open-Meteo" };
  });
}

// ---------- Luftqualität in Großstädten (Open-Meteo Air Quality) ----------
const STAEDTE = [
  ["Berlin", 52.52, 13.4], ["Hamburg", 53.55, 10], ["München", 48.14, 11.58], ["Paris", 48.86, 2.35], ["London", 51.51, -0.13], ["Madrid", 40.42, -3.7],
  ["Rom", 41.9, 12.5], ["Warschau", 52.23, 21.01], ["Kiew", 50.45, 30.52], ["Moskau", 55.76, 37.62], ["Istanbul", 41.01, 28.98], ["Kairo", 30.04, 31.24],
  ["Lagos", 6.52, 3.38], ["Kinshasa", -4.32, 15.31], ["Nairobi", -1.29, 36.82], ["Johannesburg", -26.2, 28.05], ["Riad", 24.71, 46.68], ["Dubai", 25.2, 55.27],
  ["Teheran", 35.69, 51.39], ["Bagdad", 33.31, 44.36], ["Karatschi", 24.86, 67.01], ["Lahore", 31.55, 74.34], ["Delhi", 28.61, 77.21], ["Mumbai", 19.08, 72.88],
  ["Kolkata", 22.57, 88.36], ["Dhaka", 23.81, 90.41], ["Bangkok", 13.76, 100.5], ["Jakarta", -6.21, 106.85], ["Manila", 14.6, 120.98], ["Hanoi", 21.03, 105.85],
  ["Peking", 39.9, 116.4], ["Shanghai", 31.23, 121.47], ["Chengdu", 30.57, 104.07], ["Seoul", 37.57, 126.98], ["Tokio", 35.68, 139.69], ["Sydney", -33.87, 151.21],
  ["New York", 40.71, -74.01], ["Los Angeles", 34.05, -118.24], ["Chicago", 41.88, -87.63], ["Mexiko-Stadt", 19.43, -99.13], ["Toronto", 43.65, -79.38],
  ["Bogotá", 4.71, -74.07], ["Lima", -12.05, -77.04], ["Santiago", -33.45, -70.67], ["São Paulo", -23.55, -46.63], ["Buenos Aires", -34.6, -58.38],
  ["Ulaanbaatar", 47.89, 106.91], ["Taschkent", 41.3, 69.24], ["Kabul", 34.56, 69.21], ["Addis Abeba", 9.03, 38.74], ["Khartum", 15.5, 32.56], ["Algier", 36.75, 3.06],
];
const AQI_TEXT = (v) => v == null ? "unbekannt" : v <= 20 ? "sehr gut" : v <= 40 ? "gut" : v <= 60 ? "mäßig" : v <= 80 ? "schlecht" : v <= 100 ? "sehr schlecht" : "extrem schlecht";
export function getLuft() {
  return cached("luft", 60 * 60 * 1000, async () => {
    const d = await getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${STAEDTE.map((s) => s[1]).join(",")}&longitude=${STAEDTE.map((s) => s[2]).join(",")}&current=european_aqi,pm2_5`, 25000);
    const arr = Array.isArray(d) ? d : [d];
    const staedte = STAEDTE.map(([name, lat, lon], i) => {
      const c = arr[i]?.current || {};
      return { name, lat, lon, aqi: c.european_aqi ?? null, pm25: c.pm2_5 ?? null, text: AQI_TEXT(c.european_aqi) };
    });
    return { staedte, stand: new Date().toISOString(), quelle: "Open-Meteo / CAMS (Copernicus)" };
  });
}

// ---------- Raketenstarts (The Space Devs, Launch Library 2) ----------
// Gratis-Grenze: 15 Abfragen pro Stunde -> 1 Stunde zwischenspeichern.
export function getRaketen() {
  return cached("raketen", 60 * 60 * 1000, async () => {
    const d = await getJson("https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=15&hide_recent_previous=true", 20000);
    const starts = (d.results || []).map((l) => ({
      name: l.name, zeit: l.net, status: l.status?.abbrev || "", status_text: l.status?.name || "",
      anbieter: l.launch_service_provider?.name || "", rakete: l.rocket?.configuration?.full_name || "",
      mission: (l.mission?.description || "").slice(0, 220), umlaufbahn: l.mission?.orbit?.name || "",
      ort: l.pad?.location?.name || l.pad?.name || "", lat: Number(l.pad?.latitude), lon: Number(l.pad?.longitude),
      video: l.vidURLs?.[0]?.url || l.mission?.vid_urls?.[0]?.url || "", bild: typeof l.image === "string" ? l.image : (l.image?.image_url || ""),
    })).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon));
    return { starts, stand: new Date().toISOString(), quelle: "The Space Devs – Launch Library 2" };
  });
}

// ---------- Seekabel (TeleGeography, öffentliche Karte) ----------
// Koordinaten vereinfacht (0,1° Raster), damit der Globus flüssig bleibt.
export function getSeekabel() {
  return cached("seekabel", 24 * 3600 * 1000, async () => {
    const d = await getJson("https://www.submarinecablemap.com/api/v3/cable/cable-geo.json", 30000);
    const linien = [];
    for (const f of d.features || []) {
      const g = f.geometry;
      const teile = g?.type === "MultiLineString" ? g.coordinates : g?.type === "LineString" ? [g.coordinates] : [];
      for (const t of teile) {
        const out = [];
        for (const [x, y] of t) {
          const p = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
          const q = out.at(-1);
          if (!q || Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) >= 0.8) out.push(p);
        }
        const ende = [Math.round(t.at(-1)[0] * 10) / 10, Math.round(t.at(-1)[1] * 10) / 10];
        if (out.length && (out.at(-1)[0] !== ende[0] || out.at(-1)[1] !== ende[1])) out.push(ende);
        if (out.length >= 2) linien.push(out);
      }
    }
    return { anzahl: (d.features || []).length, linien, quelle: "TeleGeography Submarine Cable Map (CC BY-NC-SA)" };
  });
}

// ---------- Regenradar-Kacheln (RainViewer) für die Detailkarte ----------
export function getRadar() {
  return cached("radar", 10 * 60 * 1000, async () => {
    const d = await getJson("https://api.rainviewer.com/public/weather-maps.json");
    const last = d.radar?.past?.at(-1);
    return { host: d.host || "https://tilecache.rainviewer.com", pfad: last?.path || null, zeit: last?.time ? new Date(last.time * 1000).toISOString() : null, quelle: "RainViewer" };
  });
}

// ---------- Übersicht für die Lagebild-Leiste ----------
export async function getUebersicht() {
  const safe = (p) => p.catch(() => null);
  const [weltraum, internet, raketen, luft] = await Promise.all([safe(getWeltraum()), safe(getInternet()), safe(getRaketen()), safe(getLuft())]);
  const konflikte = getKonflikte();
  const jetzt = Date.now();
  const naechster = raketen?.starts?.find((s) => new Date(s.zeit).getTime() > jetzt - 30 * 60 * 1000) || null;
  const schlechteLuft = (luft?.staedte || []).filter((s) => s.aqi != null && s.aqi > 60).sort((a, b) => b.aqi - a.aqi);
  return {
    weltraum, naechster_start: naechster,
    internet_aktiv: internet ? internet.aktiv : null, internet_top: (internet?.stoerungen || []).filter((x) => x.aktiv).slice(0, 3),
    konflikt_laender: konflikte.laender.length, konflikt_top: konflikte.laender.slice(0, 3).map((k) => ({ land: k.land, flag: k.flag, meldungen: k.meldungen })),
    luft_schlecht: schlechteLuft.length, luft_top: schlechteLuft.slice(0, 3).map((s) => ({ name: s.name, aqi: s.aqi })),
    stand: new Date().toISOString(),
  };
}

// Was Friday ehrlich NICHT zeigt (für die Anzeige im Ebenen-Menü).
export const NICHT_MOEGLICH = [
  { was: "Militär live", warum: "Truppen- und Militärbewegungen sind nicht öffentlich. Friday zeigt nur Konflikt-Meldungen aus Nachrichten." },
  { was: "Fremde Kameras / CCTV", warum: "Kein Zugriff auf private oder Überwachungskameras. Öffentliche Webcams gibt es pro Land (Windy)." },
  { was: "Cyber-Angriffe live", warum: "Dafür gibt es keine freie, verlässliche Live-Quelle. Internet-Störungen je Land zeigt Friday über IODA." },
  { was: "Stromausfälle weltweit", warum: "Keine freie weltweite Quelle. Große Ausfälle erkennt man oft an den Internet-Störungen." },
  { was: "3D-Gelände", warum: "Der Globus bleibt flach gezeichnet, damit er auf dem iPhone flüssig läuft. Gelände gibt es in der Satelliten-Detailkarte." },
];

export function lagebildRouten(app, asyncRoute) {
  app.get("/api/lagebild", asyncRoute(async (req, res) => res.json(await getUebersicht())));
  app.get("/api/lagebild/weltraum", asyncRoute(async (req, res) => res.json(await getWeltraum())));
  app.get("/api/lagebild/polarlicht", asyncRoute(async (req, res) => res.json(await getPolarlicht())));
  app.get("/api/lagebild/internet", asyncRoute(async (req, res) => res.json(await getInternet())));
  app.get("/api/lagebild/konflikte", (req, res) => res.json(getKonflikte()));
  app.get("/api/lagebild/wetter", asyncRoute(async (req, res) => res.json(await getWetterRaster())));
  app.get("/api/lagebild/luft", asyncRoute(async (req, res) => res.json(await getLuft())));
  app.get("/api/lagebild/raketen", asyncRoute(async (req, res) => res.json(await getRaketen())));
  app.get("/api/lagebild/seekabel", asyncRoute(async (req, res) => res.json(await getSeekabel())));
  app.get("/api/lagebild/radar", asyncRoute(async (req, res) => res.json(await getRadar())));
  app.get("/api/lagebild/grenzen", (req, res) => res.json(NICHT_MOEGLICH));
}

// ---------- Sprachbefehle ohne Claude ("Friday, wie ist das Weltraumwetter?") ----------
const dauer = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return "";
  if (ms < 0) return "gerade eben";
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
  return h >= 48 ? `in ${Math.round(h / 24)} Tagen` : h ? `in ${h} Stunden und ${m} Minuten` : `in ${m} Minuten`;
};
const aufzaehlen = (l) => l.length <= 1 ? l.join("") : l.slice(0, -1).join(", ") + " und " + l.at(-1);
export async function lagebildAnswer(t) {
  t = String(t || "").toLowerCase();
  if (/weltraumwetter|sonnensturm|magnetsturm|polarlicht|nordlicht|kp[- ]?index|sonnenwind/.test(t)) {
    const w = await getWeltraum();
    if (w.kp == null) return { text: "Die Weltraumwetter-Daten der NOAA kommen gerade nicht durch, Boss." };
    const kp = w.kp.toLocaleString("de-DE", { maximumFractionDigits: 1 });
    const polar = w.kp >= 7 ? "Polarlichter sind heute Nacht sogar in Süddeutschland möglich." : w.kp >= 5 ? "In Norddeutschland könnten heute Nacht Polarlichter zu sehen sein." : "Polarlichter gibt es nur hoch im Norden, in Deutschland eher nicht.";
    return { text: `Weltraumwetter: Kp-Index ${kp}, ${w.kp_text}.${w.sonnenwind_kms ? ` Der Sonnenwind weht mit ${Math.round(w.sonnenwind_kms)} Kilometern pro Sekunde.` : ""} ${polar}`, zeigen: true };
  }
  if (/(rakete|raketenstart|weltraumstart|nächste[rn]? start|naechste[rn]? start)/.test(t) && /(wann|nächst|naechst|start)/.test(t)) {
    const r = await getRaketen();
    const n = r.starts.find((s) => new Date(s.zeit).getTime() > Date.now() - 30 * 60e3);
    if (!n) return { text: "Ich finde gerade keinen geplanten Raketenstart, Boss." };
    return { text: `Der nächste Raketenstart ist ${n.name.replace("|", "mit")} von ${n.ort.split(",")[0]}, ${dauer(n.zeit)}.${n.anbieter ? ` Betreiber: ${n.anbieter}.` : ""}`, zeigen: true };
  }
  if (/internet.{0,3}(störung|stoerung|ausfall|ausfälle|ausfaelle|abschaltung)|wo ist das internet (weg|aus)/.test(t)) {
    const d = await getInternet();
    const a = d.stoerungen.filter((s) => s.aktiv);
    if (!a.length) return { text: "Gerade melden die Messstellen keine größeren Internet-Störungen, Boss.", zeigen: true };
    return { text: `Internet-Störungen gerade in ${a.length} ${a.length === 1 ? "Land" : "Ländern"}: ${aufzaehlen(a.slice(0, 5).map((s) => s.land))}.`, zeigen: true };
  }
  if (/(konfliktherde|krisenherde|wo (gibt es|ist|herrscht) (gerade )?(krieg|kämpfe|konflikt)|welche konflikte|wo wird gekämpft)/.test(t)) {
    const k = getKonflikte().laender;
    if (!k.length) return { text: "Ich lese die Schlagzeilen noch ein, Boss. Frag mich gleich nochmal.", zeigen: true };
    return { text: `Die meisten Konflikt-Meldungen gerade aus ${aufzaehlen(k.slice(0, 5).map((x) => x.land))}. Das zähle ich aus öffentlichen Schlagzeilen.`, zeigen: true };
  }
  if (/(luft|luftqualität|luftqualitaet).{0,25}(weltweit|am schlechtesten|am dreckigsten)|wo ist die luft am schlechtesten/.test(t)) {
    const l = await getLuft();
    const s = l.staedte.filter((x) => x.aqi != null).sort((a, b) => b.aqi - a.aqi).slice(0, 3);
    if (!s.length) return null;
    return { text: `Die schlechteste Luft gerade in ${aufzaehlen(s.map((x) => `${x.name} (Index ${x.aqi})`))}.`, zeigen: true };
  }
  if (/^(zeig( mir)? )?(das )?lagebild$|wie ist das lagebild|lagebild (zeigen|bitte)/.test(t)) {
    const u = await getUebersicht();
    const teile = [];
    if (u.konflikt_laender) teile.push(`Konflikt-Meldungen aus ${u.konflikt_laender} Ländern`);
    if (u.internet_aktiv != null) teile.push(u.internet_aktiv ? `Internet-Störungen in ${u.internet_aktiv} Ländern` : "keine Internet-Störungen");
    if (u.weltraum?.kp != null) teile.push(`Weltraumwetter ${u.weltraum.kp_text}`);
    if (u.naechster_start) teile.push(`nächster Raketenstart ${dauer(u.naechster_start.zeit)}`);
    return { text: `Lagebild: ${aufzaehlen(teile) || "die Daten laden noch"}.`, zeigen: true };
  }
  return null;
}
