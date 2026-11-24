// Fridays Standort-Gedächtnis (v1.156.0): "Friday, wie lange brauche ich nach Hause?" rechnet ab dem Ort,
// an dem Boss gerade ist – auch über Telegram oder Siri, wenn das Gerät gerade nichts mitschickt.
// - Das Dashboard (iPhone-Web-App, Mac) schickt den Standort, solange Friday offen ist und Boss es erlaubt hat.
// - Ein iPhone-Kurzbefehl (Automation) kann ihn auch im Hintergrund schicken: POST /api/standort/kurzbefehl.
// Gespeichert wird NUR der letzte Punkt, lokal auf dem Mac in data/standort.json. Kein Verlauf, keine Weitergabe.
// Abschaltbar ("Friday, Standort aus") und löschbar ("Friday, vergiss meinen Standort").
import * as store from "./store.js";

const DATEI = "standort";
const UA = "F.R.Ai.D.A.Y-Assistent/1.156 (privater Sprachassistent)";
export const MAX_ALTER_H = 6; // älter als 6 Stunden → nicht mehr für Routen nehmen

function laden() {
  const d = store.load(DATEI, {}) || {};
  return { an: d.an !== false, pos: d.pos || null };
}
function speichern(d) {
  store.save(DATEI, d);
}

// "52,5200" (deutsches Komma aus Kurzbefehlen) oder 52.52 → Zahl
export function zahl(v) {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim().replace(/\s/g, "");
  if (!s) return NaN;
  // "13,4050" → 13.4050 ; "1.234,5" kommt bei Koordinaten nicht vor
  return Number(/^-?\d+,\d+$/.test(s) ? s.replace(",", ".") : s);
}

/** Prüft {lat, lon} (auch "lat,lon" als Text). → {lat, lon} oder null */
export function pruefe(lat, lon) {
  if (lon === undefined && typeof lat === "string") {
    const m = lat.match(/(-?\d{1,2}(?:[.,]\d+)?)\s*[;,/ ]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
    if (!m) return null;
    return pruefe(m[1], m[2]);
  }
  const a = zahl(lat), b = zahl(lon);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  if (a === 0 && b === 0) return null; // "kein Standort" bei manchen Geräten
  return { lat: +a.toFixed(5), lon: +b.toFixed(5) };
}

export const istAn = () => laden().an;

export function setzeAn(an) {
  const d = laden();
  d.an = Boolean(an);
  if (!d.an) d.pos = null; // Ausschalten löscht auch den letzten Punkt
  speichern(d);
  return status();
}

export function vergessen() {
  const d = laden();
  d.pos = null;
  speichern(d);
  return status();
}

/**
 * Neuen Standort merken.
 * @param {{lat, lon, genau?, quelle?, geraet?}} p
 */
export function merke(p = {}) {
  const d = laden();
  if (!d.an) return { ok: false, aus: true, error: "Standort ist bei Friday ausgeschaltet." };
  const k = pruefe(p.lat, p.lon);
  if (!k) return { ok: false, error: "Ungültiger Standort." };
  const genau = Number.isFinite(zahl(p.genau)) ? Math.max(0, Math.round(zahl(p.genau))) : null;
  const quelle = ["app", "kurzbefehl"].includes(p.quelle) ? p.quelle : "app";
  const geraet = String(p.geraet || "").replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 40);
  const alt = d.pos;
  // Ortsname nur neu suchen, wenn man sich bewegt hat
  const bewegt = !alt || luftlinie(alt, k) > 250;
  d.pos = { ...k, genau, quelle, geraet, at: Date.now(), ort: bewegt ? "" : alt.ort || "" };
  speichern(d);
  if (bewegt || !d.pos.ort) ortsnameNachladen(d.pos).catch(() => {});
  return { ok: true, pos: d.pos };
}

/** Letzter bekannter Standort, wenn er frisch genug ist. → {lat, lon, at, alterMin, quelle, ort} oder null */
export function letzter(maxStunden = MAX_ALTER_H) {
  const d = laden();
  if (!d.an || !d.pos) return null;
  const alter = Date.now() - Number(d.pos.at || 0);
  if (!(alter >= 0) || alter > maxStunden * 3600000) return null;
  return { lat: d.pos.lat, lon: d.pos.lon, at: d.pos.at, alterMin: Math.round(alter / 60000), quelle: d.pos.quelle, ort: d.pos.ort || "", genau: d.pos.genau };
}

export function status() {
  const d = laden();
  const p = d.pos;
  return {
    an: d.an,
    pos: p ? { lat: p.lat, lon: p.lon, at: p.at, genau: p.genau, quelle: p.quelle, geraet: p.geraet, ort: p.ort || "" } : null,
    frisch: Boolean(letzter()),
    maxAlterStunden: MAX_ALTER_H,
  };
}

export function luftlinie(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Ortsname ("Berlin-Mitte, Torstraße") über Photon (OpenStreetMap), ohne Schlüssel
async function ortsnameNachladen(pos) {
  const basis = String(process.env.PHOTON_URL || "https://photon.komoot.io").replace(/\/$/, "");
  const r = await fetch(`${basis}/reverse?lat=${pos.lat}&lon=${pos.lon}&lang=de&limit=1`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return;
  const j = await r.json();
  const p = j.features?.[0]?.properties;
  if (!p) return;
  const stadt = p.city || p.town || p.village || p.county || "";
  const teil = p.district || p.locality || p.suburb || "";
  const strasse = p.street || p.name || "";
  const ort = [stadt && teil && teil !== stadt ? `${stadt}-${teil}` : stadt || teil, strasse].filter(Boolean).join(", ").slice(0, 100);
  const d = laden();
  if (d.pos && d.pos.at === pos.at) { d.pos.ort = ort; speichern(d); }
}

export function alterText(min) {
  if (min < 2) return "gerade eben";
  if (min < 60) return `vor ${min} Minuten`;
  const h = Math.round(min / 60);
  return h === 1 ? "vor einer Stunde" : `vor ${h} Stunden`;
}

// ---------- Sprachbefehle ohne Claude ----------
const norm = (s) => String(s || "").toLowerCase().replace(/[„“”"!?.,;:]/g, " ").replace(/\s+/g, " ").trim()
  .replace(/^(hey |hallo |ok |okay )?(friday|freitag|fraiday)( |$)/, "").replace(/^(bitte |sag mal |sag mir )/, "").trim();

export function quickCommand(text) {
  const t = norm(text);
  if (!t || t.length > 80) return null;
  if (/^(wo bin ich( gerade| jetzt)?|wo bin ich denn|weißt du wo ich bin|weisst du wo ich bin|wo befinde ich mich( gerade)?|mein standort|wo ist mein standort)$/.test(t)) {
    const d = laden();
    if (!d.an) return { answer: "Den Standort habe ich ausgeschaltet, Boss. Sag „Standort an“, dann merke ich mir, wo du bist.", actions: ["routen"] };
    const l = letzter(48);
    if (!l) return { answer: "Das weiß ich gerade nicht, Boss. Öffne Friday auf dem iPhone und erlaube den Standort, oder richte den Kurzbefehl „Friday Standort“ ein.", actions: ["routen"] };
    const wo = l.ort ? `in ${l.ort}` : "an einem Ort ohne Namen auf der Karte";
    return { answer: `Zuletzt warst du ${wo}, ${alterText(l.alterMin)}.`, actions: ["routen"] };
  }
  if (/^(standort|ortung|standort ortung|standortverfolgung)( tracken| merken)? (an|ein|einschalten|anschalten|aktivieren)$|^(schalte|schalt|mach) (den |die )?(standort|ortung)( wieder)? (an|ein)$|^merk dir wo ich bin$/.test(t)) {
    setzeAn(true);
    return { answer: "Standort ist an. Solange Friday offen ist, weiß ich, wo du bist. Im Hintergrund klappt es mit dem Kurzbefehl „Friday Standort“.", actions: ["routen"] };
  }
  if (/^(standort|ortung|standortverfolgung)( tracken| merken)? (aus|ausschalten|abschalten|deaktivieren|stopp|stop)$|^(schalte|schalt|mach) (den |die )?(standort|ortung) (aus|ab)$|^hör auf mich zu (orten|verfolgen|tracken)$/.test(t)) {
    setzeAn(false);
    return { answer: "Standort ist aus und der letzte Punkt gelöscht. Ich merke mir nicht mehr, wo du bist.", actions: [] };
  }
  if (/^(vergiss|lösch|lösche|loesche|loesch) (meinen |den )?(standort|letzten standort)$/.test(t)) {
    vergessen();
    return { answer: "Erledigt, deinen letzten Standort habe ich gelöscht.", actions: [] };
  }
  return null;
}

// ---------- Routen für index.js ----------
export function standortRouten(app, { requireShortcutOrAuth } = {}) {
  app.get("/api/standort", (_req, res) => res.json(status()));
  app.post("/api/standort", (req, res) => {
    const b = req.body || {};
    if (typeof b.an === "boolean") return res.json({ ok: true, ...setzeAn(b.an) });
    const r = merke({ lat: b.lat, lon: b.lon, genau: b.genau, quelle: "app", geraet: b.geraet });
    res.status(r.ok || r.aus ? 200 : 400).json(r);
  });
  app.post("/api/standort/vergessen", (_req, res) => res.json({ ok: true, ...vergessen() }));
}

// Für den iPhone-Kurzbefehl (läuft VOR der normalen Anmeldung, mit dem Kurzbefehl-Schlüssel)
export function kurzbefehlRoute(app, requireShortcutOrAuth) {
  app.post("/api/standort/kurzbefehl", requireShortcutOrAuth, (req, res) => {
    const b = req.body || {};
    // Kurzbefehle schicken manchmal alles als Text, manchmal "Standort" als "52.52, 13.40"
    const k = pruefe(b.lat ?? b.latitude ?? b.breitengrad, b.lon ?? b.lng ?? b.longitude ?? b.laengengrad ?? b.längengrad)
      || (typeof b.standort === "string" ? pruefe(b.standort) : null)
      || (typeof b.text === "string" ? pruefe(b.text) : null);
    if (!k) return res.status(400).type("text/plain").send("Friday: Standort nicht lesbar. Schick lat und lon als Zahlen.");
    const r = merke({ ...k, genau: b.genau ?? b.accuracy, quelle: "kurzbefehl", geraet: b.geraet || "iPhone" });
    if (!r.ok) return res.status(r.aus ? 200 : 400).type("text/plain").send(r.aus ? "Friday: Standort ist ausgeschaltet." : "Friday: Ungültiger Standort.");
    res.type("text/plain").send("Friday: Standort gemerkt.");
  });
}
