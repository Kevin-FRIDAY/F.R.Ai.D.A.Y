// Neue Stern-Ideen aus der Ideen-Schmiede (v1.169.0).
// Kevin hat am 24.11.2026 weitere Bauplan-Ideen mit ⭐ auf die Wunschliste gesetzt. Diese 11 sind hier eingebaut,
// alle kostenlos und ohne Claude: Was ist am Himmel · Spritpreise · Drucken per Sprache · Internetradio · Podcasts
// · Gewohnheiten mit Serien · Schlaf-Protokoll · Sprach-Trainer · Auto-Logbuch · Gäste-Modus · Briefing zum Mitnehmen.
// (Pegelstände, Staus und Lebensmittel-Rückrufe baut das Paket „Öffentliche Daten“.)
// Sie erscheinen als weitere Kacheln im Fenster „Meine Wunschliste“ (dashboard/sternideen.js).
import * as himmel from "./himmel.js";
import * as sprit from "./sprit.js";
import * as drucken from "./drucken.js";
import * as radio from "./radio.js";
import * as podcasts from "./podcasts.js";
import * as gewohnheiten from "./gewohnheiten.js";
import * as schlaf from "./schlaf.js";
import * as trainer from "./sprachtrainer.js";
import * as fahrzeug from "./fahrzeug.js";
import * as gaeste from "./gaeste.js";
import * as briefingAudio from "./briefing-audio.js";
import { IST_EVE } from "./config.js";

export const STERN_WUENSCHE = [
  { id: "himmel", reiter: "himmel", icon: "🔭", titel: "Was ist heute am Himmel?", sprache: "Friday, was ist heute am Himmel?" },
  { id: "sprit", reiter: "sprit", icon: "⛽", titel: "Spritpreise in der Nähe", sprache: "Friday, wo ist Diesel gerade am billigsten?" },
  { id: "drucken", reiter: "drucken", icon: "🖨", titel: "Drucken per Sprache", sprache: "Friday, druck die Einkaufsliste." },
  { id: "radio", reiter: "radio", icon: "📻", titel: "Internetradio per Sprache", sprache: "Friday, spiel Radio Eins." },
  { id: "podcasts", reiter: "podcasts", icon: "🎙", titel: "Podcasts hören", sprache: "Friday, gibt es eine neue Folge von Lage der Nation?" },
  { id: "gewohnheiten", reiter: "gewohnheiten", icon: "🔥", titel: "Gewohnheiten mit Serien", sprache: "Friday, Sport erledigt." },
  { id: "schlaf", reiter: "schlaf", icon: "😴", titel: "Schlaf-Protokoll", sprache: "Friday, gute Nacht." },
  { id: "sprachtrainer", reiter: "sprachtrainer", icon: "🗣", titel: "Sprach-Trainer", sprache: "Friday, frag mich Vokabeln ab." },
  { id: "fahrzeug", reiter: "fahrzeug", icon: "🚗", titel: "Auto-Logbuch", sprache: "Friday, wann muss das Auto zum TÜV?" },
  { id: "gaeste", reiter: "gaeste", icon: "🛋", titel: "Gäste-Modus", sprache: "Friday, Gästemodus an." },
  { id: "briefing-audio", reiter: "briefingaudio", icon: "🎧", titel: "Briefing zum Mitnehmen", sprache: "Friday, leg mir das Briefing als Audio aufs iPhone." },
];

/**
 * Ganz früh in brain.ask (vor allen anderen Schnellbefehlen):
 * Gäste-Modus (Schalten + private Fragen abblocken) und eine laufende Vokabel-Abfrage (jede Antwort gehört dorthin).
 */
export function fruehBefehl(text) {
  const t = String(text || "");
  if (!t.trim() || t.length > 400) return null;
  return gaeste.quickCommand(t) || trainer.quickCommand(t);
}

/** Normale Schnellbefehle (in der Wunschliste-Kette). */
export async function quickCommand(text) {
  const t = String(text || "");
  if (!t.trim() || t.length > 400) return null;
  return (await schlaf.quickCommand(t))
    || gewohnheiten.quickCommand(t)
    || (await fahrzeug.quickCommand(t))
    || (await briefingAudio.quickCommand(t))
    || (await drucken.quickCommand(t))
    || (await podcasts.quickCommand(t))
    || (await radio.quickCommand(t))
    || (await sprit.quickCommand(t))
    || (await himmel.quickCommand(t));
}

export { gaeste };
/** Laufende Vokabel-Abfrage: dann kein Sprachverständnis-Umbau (Folgefragen, Zerlegen) davor. */
export const vorrang = () => trainer.laeuft();

export function sternStart(sicher, notifyAll) {
  if (IST_EVE) return;
  setInterval(sicher(() => fahrzeug.pruefen(notifyAll)), 60 * 60 * 1000);
  setTimeout(sicher(() => fahrzeug.pruefen(notifyAll)), 4 * 60 * 1000);
  setInterval(sicher(() => podcasts.pruefen(notifyAll)), 3 * 60 * 60 * 1000);
  setTimeout(sicher(() => podcasts.pruefen(notifyAll)), 6 * 60 * 1000);
  setInterval(sicher(() => gewohnheiten.pruefen(notifyAll)), 5 * 60 * 1000);
  setInterval(sicher(() => briefingAudio.pruefen()), 5 * 60 * 1000);
}

export function sternRouten(app, r, asyncRoute) {
  // Himmel
  app.get("/api/wunsch/himmel", r(async (req) => himmel.heute({ ort: String(req.query.ort || "") })));

  // Sprit
  app.get("/api/wunsch/sprit", r(async (req) => {
    const e = { ...sprit.einstellungen(), eingerichtet: sprit.eingerichtet(), sorten: sprit.SORTEN };
    if (!e.eingerichtet) return { einstellungen: e };
    try { return { einstellungen: e, ...(await sprit.preise({ sorte: req.query.sorte, radius: req.query.radius })) }; } catch (err) { return { einstellungen: e, fehler: err.message }; }
  }));
  app.post("/api/wunsch/sprit", r(async (req) => ({ einstellungen: sprit.einstellen(req.body || {}) })));

  // Drucken
  app.get("/api/wunsch/drucken", r(async () => ({ ...(await drucken.drucker()), einkauf: (await import("./store.js")).getShopping().filter((x) => !x.done).length, dokumente: ((await import("./store.js")).load("dokumente", []) || []).slice(-10).reverse().map(({ id, titel }) => ({ id, titel })) })));
  app.post("/api/wunsch/drucken", r(async (req) => drucken.drucke(req.body || {})));
  app.post("/api/wunsch/drucken/einstellungen", r(async (req) => drucken.einstellen(req.body || {})));

  // Radio
  app.get("/api/wunsch/radio", r(async (req) => ({ favoriten: await radio.frisch(radio.favoriten()), sender: req.query.q ? await radio.suchen(String(req.query.q)) : await radio.beliebt().catch(() => []) })));
  app.post("/api/wunsch/radio/favorit", r(async (req) => ({ favoriten: radio.favoritDazu(req.body || {}) })));
  app.delete("/api/wunsch/radio/favorit/:id", r(async (req) => ({ favoriten: radio.favoritWeg(req.params.id) })));
  app.post("/api/wunsch/radio/gehoert", r(async (req) => { radio.merkeZuletzt(req.body || {}); radio.geklickt(req.body?.id); return { ok: true }; }));

  // Podcasts
  app.get("/api/wunsch/podcasts", r(async (req) => ({ abos: podcasts.abos(), ...(req.query.q ? { treffer: await podcasts.suchen(String(req.query.q)) } : { neueste: await podcasts.neueste() }) })));
  app.get("/api/wunsch/podcasts/folgen", r(async (req) => podcasts.folgen(String(req.query.feed || ""))));
  app.post("/api/wunsch/podcasts", r(async (req) => ({ abos: await podcasts.abonnieren(req.body || {}) })));
  app.delete("/api/wunsch/podcasts/:id", r(async (req) => ({ abos: podcasts.abbestellen(req.params.id) })));

  // Gewohnheiten
  app.get("/api/wunsch/gewohnheiten", r(async () => gewohnheiten.stand()));
  app.post("/api/wunsch/gewohnheiten", r(async (req) => gewohnheiten.anlegen(req.body || {})));
  app.post("/api/wunsch/gewohnheiten/einstellungen", r(async (req) => gewohnheiten.einstellen(req.body || {})));
  app.post("/api/wunsch/gewohnheiten/:id/abhaken", r(async (req) => { const x = gewohnheiten.abhaken(req.params.id, { an: req.body?.an !== false, tag: /^\d{4}-\d{2}-\d{2}$/.test(req.body?.tag || "") ? req.body.tag : undefined }); return { rekord: x.rekord, serie: x.serie, ...gewohnheiten.stand() }; }));
  app.delete("/api/wunsch/gewohnheiten/:id", r(async (req) => gewohnheiten.loeschen(req.params.id)));

  // Schlaf
  app.get("/api/wunsch/schlaf", r(async () => schlaf.stand()));
  app.post("/api/wunsch/schlaf", r(async (req) => {
    const b = req.body || {};
    if (b.aktion === "nacht") schlaf.guteNacht();
    else if (b.aktion === "morgen") { const n = schlaf.aufgewacht(); if (!n) throw new Error("Es fehlt ein „Gute Nacht“ von gestern Abend (3 bis 16 Stunden her)."); }
    else if (b.ziel !== undefined) schlaf.einstellen({ ziel: b.ziel });
    return schlaf.stand();
  }));
  app.delete("/api/wunsch/schlaf/:tag", r(async (req) => schlaf.weg(req.params.tag)));

  // Sprach-Trainer
  app.get("/api/wunsch/sprachtrainer", r(async () => trainer.stand()));
  app.post("/api/wunsch/sprachtrainer", r(async (req) => (req.body?.zuruecksetzen ? trainer.zuruecksetzen() : trainer.einstellen(req.body || {}))));

  // Auto-Logbuch
  app.get("/api/wunsch/fahrzeug", r(async () => ({ autos: fahrzeug.stand(), arten: fahrzeug.TERMINE })));
  app.post("/api/wunsch/fahrzeug", r(async (req) => ({ auto: fahrzeug.autoSpeichern(req.body || {}), autos: fahrzeug.stand() })));
  app.post("/api/wunsch/fahrzeug/tanken", r(async (req) => ({ eintrag: fahrzeug.tanken(req.body || {}), autos: fahrzeug.stand() })));
  app.delete("/api/wunsch/fahrzeug/tanken/:id", r(async (req) => ({ ok: fahrzeug.tankWeg(req.params.id), autos: fahrzeug.stand() })));
  app.delete("/api/wunsch/fahrzeug/:id", r(async (req) => ({ ok: fahrzeug.autoWeg(req.params.id), autos: fahrzeug.stand() })));

  // Gäste-Modus (im angemeldeten Dashboard ohne PIN schaltbar)
  app.get("/api/wunsch/gaeste", r(async () => gaeste.stand()));
  app.post("/api/wunsch/gaeste", r(async (req) => {
    const b = req.body || {};
    if (b.pin !== undefined || b.automatischAus !== undefined) gaeste.einstellen(b);
    if (b.an !== undefined) return gaeste.schalten(Boolean(b.an), { vonDashboard: true });
    return gaeste.stand();
  }));

  // Briefing zum Mitnehmen
  app.get("/api/wunsch/briefingaudio", r(async () => ({ ...briefingAudio.stand(), stimmen: await briefingAudio.stimmen() })));
  app.post("/api/wunsch/briefingaudio", r(async (req) => ({ einstellungen: briefingAudio.einstellen(req.body || {}) })));
  app.post("/api/wunsch/briefingaudio/jetzt", r(async () => briefingAudio.erstellen()));
  app.get("/api/wunsch/briefingaudio/datei/:datei", asyncRoute(async (req, res) => {
    const p = briefingAudio.pfad(req.params.datei);
    if (!p) return res.status(404).json({ error: "Nicht gefunden." });
    res.set("Cache-Control", "private, max-age=3600").type("audio/mp4");
    if (req.query.laden === "1") res.attachment(req.params.datei);
    res.sendFile(p);
  }));
}
