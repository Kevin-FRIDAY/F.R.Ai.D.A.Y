// Kevins Wunschliste aus der Ideen-Schmiede (v1.160.0).
// Die 11 Bauplan-Ideen, die Kevin mit ⭐ auf die Wunschliste gesetzt hat, sind jetzt eingebaut:
// Friday lernt dich kennen · Unwetter-Warnungen (DWD) · Paket-Verfolgung · Eigene Nachrichtenquellen (RSS)
// · Eigene Mediathek (Jellyfin/Plex) · Lokales KI-Gehirn (Ollama) · Fritz!Box-Status · Geburtstage + Geschenke
// · iPhone-Widget (Scriptable) · Familien-Pinnwand · Abend-Rückblick.
// Hier hängen Routen, Sprachbefehle (alle ohne Claude) und Hintergrund-Prüfungen zusammen.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { notifyAll } from "./notify.js";
import { config, IST_EVE } from "./config.js";
import * as ausbau from "./friday-ausbau.js";
import * as unwetter from "./unwetter.js";
import * as feeds from "./feeds.js";
import * as pakete from "./pakete.js";
import * as mediathek from "./mediathek.js";
import * as ollama from "./ollama.js";
import * as fritz from "./fritzbox.js";
import * as geb from "./geburtstage.js";
import * as familie from "./familie.js";
import * as rueckblick from "./rueckblick.js";
import * as vorlieben from "./vorlieben.js";
import * as widget from "./widget.js";
import * as stern from "./sternideen.js";

/** Welche Wünsche sind eingebaut? (für das Fenster und die Ideen-Schmiede) */
export const WUENSCHE = [
  { id: "lernen-ki", reiter: "vorlieben", icon: "🧬", titel: "Friday lernt dich kennen", sprache: "Friday, was weißt du über meine Gewohnheiten?" },
  { id: "dwd-warnungen", reiter: "unwetter", icon: "⛈", titel: "Unwetter-Warnungen vom DWD", sprache: "Friday, gibt es eine Unwetterwarnung?" },
  { id: "pakete", reiter: "pakete", icon: "📦", titel: "Paket-Verfolgung", sprache: "Friday, wo ist mein Paket?" },
  { id: "rss", reiter: "feeds", icon: "📰", titel: "Eigene Nachrichtenquellen", sprache: "Friday, was gibt's Neues bei Heise?" },
  { id: "jellyfin", reiter: "mediathek", icon: "🎞", titel: "Eigene Mediathek (Jellyfin/Plex)", sprache: "Friday, spiel Iron Man." },
  { id: "ollama", reiter: "ollama", icon: "🧠", titel: "Ollama-Gehirn (Mac oder Cloud)", sprache: "Friday, denk sparsam." },
  { id: "fritzbox", reiter: "fritzbox", icon: "📶", titel: "Fritz!Box-Status", sprache: "Friday, ist das Internet langsam?" },
  { id: "geburtstage", reiter: "geburtstage", icon: "🎂", titel: "Geburtstage + Geschenk-Ideen", sprache: "Friday, wann hat Mama Geburtstag?" },
  { id: "widget", reiter: "widget", icon: "📱", titel: "iPhone-Widget", sprache: "–" },
  { id: "familie", reiter: "familie", icon: "👪", titel: "Familien-Pinnwand", sprache: "Friday, schreib an die Pinnwand: …" },
  { id: "tagesrueckblick", reiter: "rueckblick", icon: "🌙", titel: "Abend-Rückblick", sprache: "Friday, wie war mein Tag?" },
  // v1.166.0: die neuen Stern-Ideen vom 24.11.2026 (server/src/sternideen.js)
  ...stern.STERN_WUENSCHE.map((w) => ({ ...w, neu: true })),
];

/** Ein Schnellbefehl für brain.js (alles ohne Claude). */
export async function quickCommand(text) {
  const t = String(text || "");
  if (!t.trim() || t.length > 400) return null;
  return ollama.quickCommand(t)
    || vorlieben.quickCommand(t)
    || geb.quickCommand(t)
    || familie.quickCommand(t)
    || (await rueckblick.quickCommand(t))
    || (await unwetter.quickCommand(t))
    || (await pakete.quickCommand(t))
    || (await fritz.quickCommand(t))
    || (await feeds.quickCommand(t))
    || (await mediathek.quickCommand(t))
    || (await stern.quickCommand(t));
}

/** Ideen im Tresor, die jetzt eingebaut sind, als "erledigt" markieren (einmalig, nur Bereich "Für Friday"). */
export function tresorAbhaken() {
  try {
    const titel = new Map(ausbau.KATALOG.map((v) => [v.titel.toLowerCase(), v.id]));
    const gebaut = new Set(WUENSCHE.map((w) => w.id));
    const ideen = store.load("ideen", []);
    let n = 0;
    for (const i of ideen) {
      if (i.bereich !== "friday" || i.status === "erledigt") continue;
      const id = titel.get(String(i.titel || "").toLowerCase());
      if (id && gebaut.has(id)) { i.status = "erledigt"; i.erledigtAm = new Date().toISOString(); i.version = WUENSCHE.find((w) => w.id === id)?.neu ? "1.166.0" : "1.160.0"; n++; }
    }
    if (n) {
      store.save("ideen", ideen);
      logbuch.eintragen({ bereich: "idee", titel: `Wunschliste: ${n} Ideen eingebaut und abgehakt`, details: "Wunschliste" });
    }
    return n;
  } catch { return 0; }
}

/** Hintergrund-Prüfungen. */
export function wunschStart() {
  tresorAbhaken();
  const sicher = (fn) => () => { try { const p = fn(); p?.catch?.((err) => console.error("Wunschliste:", err.message)); } catch (err) { console.error("Wunschliste:", err.message); } };
  if (IST_EVE) return; // Eve meldet nichts nach außen
  setTimeout(sicher(() => unwetter.pruefen(notifyAll)), 90 * 1000);
  setInterval(sicher(() => unwetter.pruefen(notifyAll)), 15 * 60 * 1000);
  setInterval(sicher(() => pakete.pruefen(notifyAll)), 2 * 60 * 60 * 1000);
  setTimeout(sicher(() => pakete.pruefen(notifyAll)), 3 * 60 * 1000);
  setInterval(sicher(() => geb.pruefen(notifyAll)), 20 * 60 * 1000);
  setTimeout(sicher(() => geb.pruefen(notifyAll)), 2 * 60 * 1000);
  setInterval(sicher(() => rueckblick.pruefen(notifyAll)), 60 * 1000);
  setTimeout(sicher(() => vorlieben.pruefen()), 5 * 60 * 1000);
  setInterval(sicher(() => vorlieben.pruefen()), 12 * 60 * 60 * 1000);
  stern.sternStart(sicher, notifyAll);
}

const fehler = (res, err, code = 400) => res.status(err?.status && err.status >= 400 && err.status < 600 ? (err.status === 401 ? 400 : err.status) : code).json({ error: err?.message || String(err) });
const versuch = (fn) => async (req, res) => { try { res.json(await fn(req, res)); } catch (err) { fehler(res, err); } };

/** Vor der Anmeldung: Widget-Daten auch mit dem Kurzbefehl-Schlüssel. */
export function widgetRoute(app, requireShortcutOrAuth) {
  app.get("/api/widget/daten", requireShortcutOrAuth, versuch(() => widget.daten()));
}

export function wunschRouten(app, asyncRoute) {
  const r = (fn) => asyncRoute(versuch(fn));
  // Übersicht
  app.get("/api/wunsch", r(async () => ({
    wuensche: WUENSCHE,
    tresor: store.load("ideen", []).filter((i) => i.bereich === "friday").map(({ id, titel, status }) => ({ id, titel, status })),
  })));

  // Unwetter
  app.get("/api/wunsch/unwetter", r(async (req) => ({ einstellungen: unwetter.einstellungen(), ...(await unwetter.warnungen({ frisch: req.query.frisch === "1" })) })));
  app.post("/api/wunsch/unwetter", r(async (req) => ({ einstellungen: unwetter.einstellen(req.body || {}) })));

  // Nachrichtenquellen
  app.get("/api/wunsch/feeds", r(async () => ({ feeds: await feeds.alle(), vorschlaege: feeds.VORSCHLAEGE })));
  app.post("/api/wunsch/feeds", r(async (req) => feeds.dazu(req.body || {})));
  app.delete("/api/wunsch/feeds/:id", r(async (req) => ({ ok: feeds.weg(req.params.id) })));

  // Pakete
  app.get("/api/wunsch/pakete", r(async () => ({ pakete: pakete.liste().slice().reverse().map((p) => ({ ...p, link: pakete.link(p.nummer) })), eingerichtet: pakete.eingerichtet() })));
  app.post("/api/wunsch/pakete", r(async (req) => { const e = pakete.dazu(req.body || {}); try { return await pakete.abfragen(e.id); } catch (err) { return { ...e, link: pakete.link(e.nummer), hinweis: err.message }; } }));
  app.post("/api/wunsch/pakete/:id/pruefen", r(async (req) => pakete.abfragen(req.params.id)));
  app.delete("/api/wunsch/pakete/:id", r(async (req) => ({ ok: pakete.weg(req.params.id) })));
  app.post("/api/wunsch/pakete-schluessel", r(async (req) => ({ eingerichtet: pakete.schluesselSetzen(req.body?.key) })));

  // Mediathek
  app.get("/api/wunsch/mediathek", r(async (req) => {
    const s = mediathek.status();
    if (!s.eingerichtet) return s;
    const [treffer, geraete] = await Promise.all([req.query.q ? mediathek.suchen(req.query.q) : Promise.resolve([]), mediathek.abspieler().catch(() => [])]);
    return { ...s, treffer, geraete };
  }));
  app.post("/api/wunsch/mediathek", r(async (req) => mediathek.einrichten(req.body || {})));
  app.delete("/api/wunsch/mediathek", r(async () => ({ ok: mediathek.vergessen() })));
  app.post("/api/wunsch/mediathek/abspielen", r(async (req) => mediathek.abspielen(req.body || {})));
  app.get("/api/wunsch/mediathek/bild", asyncRoute(async (req, res) => {
    try { const b = await mediathek.bild(req.query.pfad); res.set("Cache-Control", "private, max-age=86400").type(b.typ).send(b.daten); } catch (err) { res.status(404).end(); }
  }));

  // Ollama
  app.get("/api/wunsch/ollama", r(async () => ollama.status()));
  app.post("/api/wunsch/ollama", r(async (req) => ollama.einstellen(req.body || {})));
  app.post("/api/wunsch/ollama/test", r(async () => {
    const start = Date.now();
    const a = await ollama.erstelle({ max_tokens: 120, system: "Antworte auf Deutsch in einem Satz.", messages: [{ role: "user", content: "Sag kurz Hallo und wer du bist." }] });
    return { text: a.content.filter((b) => b.type === "text").map((b) => b.text).join(""), modell: a.model, sekunden: Math.round((Date.now() - start) / 100) / 10 };
  }));

  // Fritz!Box
  app.get("/api/wunsch/fritzbox", r(async () => ({ ...(await fritz.status()), satz: undefined })));
  app.post("/api/wunsch/fritzbox", r(async (req) => fritz.einrichten(req.body || {})));
  app.get("/api/wunsch/fritzbox/gast", r(async () => fritz.gast()));
  app.post("/api/wunsch/fritzbox/gast", r(async (req) => fritz.gastSchalten(Boolean(req.body?.an))));

  // Geburtstage
  app.get("/api/wunsch/geburtstage", r(async () => ({ liste: geb.kommende(366).map((e) => ({ ...e, ideen: geb.geschenkIdeen(e) })) })));
  app.post("/api/wunsch/geburtstage", r(async (req) => geb.speichern(req.body || {})));
  app.delete("/api/wunsch/geburtstage/:id", r(async (req) => ({ ok: geb.weg(req.params.id) })));
  app.post("/api/wunsch/geburtstage/:id/ki", r(async (req) => {
    const e = geb.kommende(366).find((x) => x.id === req.params.id);
    if (!e) throw new Error("Nicht gefunden.");
    return { ideen: await geb.geschenkKi(e) };
  }));

  // Widget
  app.get("/api/wunsch/widget", r(async (req) => ({ daten: await widget.daten(), skript: widget.skript({ adresse: String(req.query.adresse || ""), schluessel: config.shortcutToken }) })));

  // Familie
  app.get("/api/wunsch/familie", r(async () => familie.stand()));
  app.post("/api/wunsch/familie/profil", r(async (req) => familie.profilSpeichern(req.body || {})));
  app.delete("/api/wunsch/familie/profil/:id", r(async (req) => ({ ok: familie.profilWeg(req.params.id) })));
  app.post("/api/wunsch/familie/pinnwand", r(async (req) => familie.anPinnwand(req.body || {})));
  app.patch("/api/wunsch/familie/pinnwand/:id", r(async (req) => ({ ok: familie.pinnAendern(req.params.id, req.body || {}) })));
  app.post("/api/wunsch/familie/liste", r(async (req) => familie.aufListe(req.body || {})));
  app.patch("/api/wunsch/familie/liste/:profil/:id", r(async (req) => ({ ok: familie.listeAendern(req.params.profil, req.params.id, req.body || {}) })));

  // Abend-Rückblick
  app.get("/api/wunsch/rueckblick", r(async (req) => ({ einstellungen: rueckblick.einstellungen(), verlauf: rueckblick.verlauf().slice(0, 14), ...(req.query.jetzt === "1" ? { jetzt: await rueckblick.bauen() } : {}) })));
  app.post("/api/wunsch/rueckblick", r(async (req) => ({ einstellungen: rueckblick.einstellen(req.body || {}) })));

  // Friday lernt dich kennen
  app.get("/api/wunsch/vorlieben", r(async (req) => (req.query.neu === "1" ? vorlieben.aktualisieren() : vorlieben.gespeichert() || vorlieben.aktualisieren())));
  app.post("/api/wunsch/vorlieben/ki", r(async () => vorlieben.kiEinschaetzung()));

  // v1.166.0: neue Stern-Ideen
  stern.sternRouten(app, r, asyncRoute);
}
