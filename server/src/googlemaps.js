// Google Maps für Routen (v1.157.0): genaue Wege mit Live-Verkehr, Abbiege-Hinweisen auf Deutsch
// und auf Wunsch die echte Google-Karte im Routen-Fenster.
// Schlüssel: Google Cloud Console → APIs & Dienste → "Routes API" (und für die Karte "Maps JavaScript API")
// aktivieren → Anmeldedaten → API-Schlüssel. Boss trägt ihn im Fenster Verbindungen ein (nie im Chat posten).
// Ohne Schlüssel rechnet Friday wie bisher kostenlos mit OpenStreetMap (OSRM).
import * as V from "./verbindungen.js";

const ROUTES_URL = () => String(process.env.GOOGLE_ROUTES_URL || "https://routes.googleapis.com/directions/v2:computeRoutes");
const d = () => V.get("googlemaps");
export const googleBereit = () => Boolean(d().key);
export const karteAn = () => googleBereit() && d().karte !== false;

// Schutz vor Überraschungs-Rechnungen: höchstens so viele Google-Abfragen pro Tag (Gratis-Kontingent reicht locker).
const TAGES_LIMIT = Number(process.env.GOOGLE_MAPS_TAGESLIMIT || 150);
let zaehler = { tag: "", n: 0 };
function zaehlen() {
  const tag = new Date().toISOString().slice(0, 10);
  if (zaehler.tag !== tag) zaehler = { tag, n: 0 };
  if (zaehler.n >= TAGES_LIMIT) return false;
  zaehler.n++;
  return true;
}

const ART = { auto: "DRIVE", rad: "BICYCLE", fuss: "WALK" };

// Google-Polyline (5 Stellen) → [[lat, lon], …]
export function decode(str) {
  const out = [];
  let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && i < str.length);
      const dlt = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += dlt; else lon += dlt;
    }
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}
const sek = (s) => (typeof s === "string" ? Math.round(parseFloat(s)) : Number(s) || 0);

function duenn(punkte, max = 600) {
  const r = (p) => [+p[0].toFixed(5), +p[1].toFixed(5)];
  if (punkte.length <= max) return punkte.map(r);
  const step = punkte.length / max, out = [];
  for (let i = 0; i < max; i++) out.push(punkte[Math.floor(i * step)]);
  out.push(punkte[punkte.length - 1]);
  return out.map(r);
}

function fehlerText(status, data, schluessel = false) {
  const msg = String(data?.error?.message || "");
  const grund = String(data?.error?.status || "");
  if (status === 0) return "Google Maps ist gerade nicht erreichbar.";
  if (/API key not valid|API_KEY_INVALID/i.test(msg)) return "Google kennt diesen Schlüssel nicht. Kopier ihn nochmal aus der Google Cloud Console (Anmeldedaten).";
  if (/has not been used|is disabled|SERVICE_DISABLED|not enabled/i.test(msg)) return "Im Google-Projekt ist die „Routes API“ noch aus. Google Cloud Console → APIs & Dienste → Bibliothek → „Routes API“ → Aktivieren. Danach 2 Minuten warten.";
  if (/billing/i.test(msg)) return "Google verlangt für das Projekt ein Abrechnungskonto (Kreditkarte). Erst dann gehen Routen – im Gratis-Kontingent kostet es nichts.";
  if (/referer|referrer|ip address|API_KEY_.*BLOCKED|blocked/i.test(msg)) return "Der Schlüssel ist eingeschränkt und lässt Friday nicht durch. Unter Anmeldedaten → Schlüssel → Anwendungseinschränkung „Keine“ wählen (API-Einschränkung auf Routes API und Maps JavaScript API reicht).";
  if (status === 429 || grund === "RESOURCE_EXHAUSTED") return "Das Google-Kontingent für heute ist aufgebraucht.";
  if (status === 403) return schluessel ? "Google lehnt den Schlüssel ab (keine Berechtigung)." : "Google lehnt die Anfrage ab.";
  return `Google meldet Fehler ${status}${msg ? `: ${msg.slice(0, 120)}` : ""}.`;
}

async function rufe(body, fieldMask, key) {
  return V.holeJson(ROUTES_URL(), {
    method: "POST",
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": fieldMask },
    body,
    timeout: 12000,
  });
}

const FELDER = [
  "routes.duration", "routes.staticDuration", "routes.distanceMeters", "routes.description",
  "routes.polyline.encodedPolyline", "routes.warnings",
  "routes.legs.steps.distanceMeters", "routes.legs.steps.staticDuration",
  "routes.legs.steps.navigationInstruction", "routes.legs.steps.startLocation",
  "routes.travelAdvisory.speedReadingIntervals", "routes.legs.travelAdvisory.speedReadingIntervals",
].join(",");

const ICON = { TURN_LEFT: "↰", TURN_SLIGHT_LEFT: "↖", TURN_SHARP_LEFT: "↰", TURN_RIGHT: "↱", TURN_SLIGHT_RIGHT: "↗", TURN_SHARP_RIGHT: "↱", UTURN_LEFT: "↶", UTURN_RIGHT: "↷", STRAIGHT: "↑", RAMP_LEFT: "↖", RAMP_RIGHT: "↗", MERGE: "⤨", FORK_LEFT: "↖", FORK_RIGHT: "↗", FERRY: "⛴", ROUNDABOUT_LEFT: "⟲", ROUNDABOUT_RIGHT: "⟳", DEPART: "●", NAME_CHANGE: "↑" };

/**
 * Route über Google.
 * @returns {Promise<{art, dauer, dauerOhneStau, distanz, linie, schritte, verkehr, ueber, quelle:"Google"} | {art, fehler}>}
 */
export async function route(art, von, nach, { zeit } = {}) {
  const key = d().key;
  if (!key) return { art, fehler: "kein Schlüssel" };
  if (!ART[art]) return { art, fehler: "nicht unterstützt" };
  if (!zaehlen()) return { art, fehler: "Tageslimit" };
  const body = {
    origin: { location: { latLng: { latitude: von.lat, longitude: von.lon } } },
    destination: { location: { latLng: { latitude: nach.lat, longitude: nach.lon } } },
    travelMode: ART[art],
    languageCode: "de-DE",
    units: "METRIC",
    polylineQuality: "HIGH_QUALITY",
  };
  if (art === "auto") {
    body.routingPreference = "TRAFFIC_AWARE";
    body.extraComputations = ["TRAFFIC_ON_POLYLINE"];
    if (zeit && new Date(zeit).getTime() > Date.now() + 60000) body.departureTime = new Date(zeit).toISOString();
  }
  const r = await rufe(body, FELDER, key);
  if (!r.ok) return { art, fehler: fehlerText(r.status, r.data), status: r.status };
  const rt = r.data?.routes?.[0];
  if (!rt) return { art, fehler: "keine Route" };
  const punkte = rt.polyline?.encodedPolyline ? decode(rt.polyline.encodedPolyline) : [];
  const schritte = [];
  for (const leg of rt.legs || []) {
    for (const s of leg.steps || []) {
      const text = String(s.navigationInstruction?.instructions || "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      schritte.push({
        text: text.slice(0, 200),
        icon: ICON[s.navigationInstruction?.maneuver] || "•",
        distanz: Math.round(s.distanceMeters || 0),
        dauer: sek(s.staticDuration),
        ...(s.startLocation?.latLng ? { lat: +Number(s.startLocation.latLng.latitude).toFixed(5), lon: +Number(s.startLocation.latLng.longitude).toFixed(5) } : {}),
      });
    }
  }
  // Stau-Abschnitte (nur Auto): [{von, bis, tempo: SLOW|TRAFFIC_JAM}] als Index in der vollen Linie
  const intervalle = rt.travelAdvisory?.speedReadingIntervals || rt.legs?.[0]?.travelAdvisory?.speedReadingIntervals || [];
  const voll = punkte.length;
  const linie = duenn(punkte);
  const faktor = voll > 1 ? (linie.length - 1) / (voll - 1) : 1;
  const stau = intervalle
    .filter((i) => i.speed === "SLOW" || i.speed === "TRAFFIC_JAM")
    .map((i) => ({ von: Math.floor((i.startPolylinePointIndex || 0) * faktor), bis: Math.ceil((i.endPolylinePointIndex || 0) * faktor), tempo: i.speed === "TRAFFIC_JAM" ? "stau" : "zaeh" }))
    .filter((i) => i.bis > i.von)
    .slice(0, 80);
  const dauer = sek(rt.duration), ohne = sek(rt.staticDuration) || dauer;
  return {
    art,
    dauer,
    dauerOhneStau: ohne,
    distanz: Math.round(rt.distanceMeters || 0),
    linie,
    schritte: schritte.slice(0, 120),
    stau,
    verkehr: art === "auto",
    ueber: String(rt.description || "").slice(0, 80),
    hinweise: (rt.warnings || []).map((w) => String(w).slice(0, 160)).slice(0, 3),
    quelle: "Google",
  };
}

// ---------- Fenster "Verbindungen" ----------
export const info = { id: "googlemaps", name: "Google Maps", emoji: "🗺", kurz: "Genaue Wege mit Live-Verkehr und die echte Google-Karte im Routen-Fenster." };

export async function status() {
  const x = d();
  const ein = googleBereit();
  return {
    ...info,
    eingerichtet: ein,
    text: ein
      ? `Verbunden · Routen mit Live-Verkehr${x.karte !== false ? " · Google-Karte im Routen-Fenster" : ""} · heute ${zaehler.tag === new Date().toISOString().slice(0, 10) ? zaehler.n : 0} von ${TAGES_LIMIT} Abfragen`
      : "Nicht eingerichtet. Ohne Schlüssel rechnet Friday kostenlos mit OpenStreetMap.",
    hinweis: ein ? "" : "Schlüssel holen: console.cloud.google.com → Projekt anlegen → „Routes API“ und „Maps JavaScript API“ aktivieren → Anmeldedaten → API-Schlüssel erstellen. Schritt für Schritt in Anleitung 52.",
    felder: ein ? [] : [{ name: "key", label: "Google-API-Schlüssel", typ: "password", platzhalter: "beginnt mit AIza…" }],
    auswahl: ein ? [{ name: "karte", label: "Karte im Routen-Fenster", wert: x.karte === false ? "friday" : "google", optionen: [{ wert: "google", text: "Google-Karte (mit Verkehr)" }, { wert: "friday", text: "Fridays dunkle Karte" }] }] : [],
    aktionen: ein ? [{ action: "test", text: "🧪 Testroute" }] : [],
  };
}

const TEST_VON = { lat: 52.52, lon: 13.405 }, TEST_NACH = { lat: 52.3906, lon: 13.0645 }; // Berlin → Potsdam

export async function einrichten({ key } = {}) {
  const k = String(key || "").trim();
  if (!V.schluesselOk(k, 30, 60) || !/^AIza[0-9A-Za-z_-]{20,}$/.test(k)) return { ok: false, error: "Ein Google-API-Schlüssel beginnt mit „AIza“ und hat 39 Zeichen ohne Leerzeichen." };
  const r = await rufe({
    origin: { location: { latLng: { latitude: TEST_VON.lat, longitude: TEST_VON.lon } } },
    destination: { location: { latLng: { latitude: TEST_NACH.lat, longitude: TEST_NACH.lon } } },
    travelMode: "DRIVE",
  }, "routes.duration,routes.distanceMeters", k);
  if (!r.ok) return { ok: false, error: fehlerText(r.status, r.data, true) };
  V.set("googlemaps", { key: k });
  return { ok: true, text: "Google Maps ist verbunden. Ab jetzt rechne ich Routen mit Live-Verkehr." };
}
export async function einstellen({ name, wert } = {}) {
  if (name === "karte") { V.set("googlemaps", { karte: wert === "friday" ? false : undefined }); return { ok: true, text: wert === "friday" ? "Routen-Fenster zeigt Fridays Karte." : "Routen-Fenster zeigt die Google-Karte." }; }
  return { ok: false, error: "Unbekannte Einstellung." };
}
export function vergessen() {
  V.clear("googlemaps");
  return { ok: true };
}
export async function command({ action } = {}) {
  if (action !== "test") return { ok: false, error: "Unbekannte Aktion." };
  const r = await route("auto", TEST_VON, TEST_NACH);
  if (r.fehler) return { ok: false, error: r.fehler === "Tageslimit" ? `Heute sind schon ${TAGES_LIMIT} Google-Abfragen gelaufen (Schutz vor Kosten).` : r.fehler };
  const min = Math.round(r.dauer / 60), ohne = Math.round(r.dauerOhneStau / 60);
  return { ok: true, sprechen: true, text: `Google antwortet: Berlin nach Potsdam gerade ${min} Minuten für ${Math.round(r.distanz / 1000)} Kilometer${min - ohne >= 3 ? `, davon ${min - ohne} Minuten Verkehr` : ""}.` };
}

// Für die Google-Karte im Dashboard: Schlüssel nur an angemeldete Geräte, nur wenn die Karte gewünscht ist.
export function karteSchluessel() {
  return karteAn() ? d().key : "";
}
