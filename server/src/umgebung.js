// Umgebungserkennung (v1.182.0, Mark XII Punkt 16) – wie ist es gerade um Kevin herum?
//
// Quellen (alles eigene Geräte, nichts von Fremden):
//  - Home-Assistant-Sensoren: Temperatur, Luftfeuchte, CO₂, Helligkeit, Feinstaub.
//  - Geräusch-Pegel vom EIGENEN Gerät: Das Dashboard misst auf Knopfdruck 3 Sekunden lang nur die Lautstärke
//    (eine Zahl). Es wird nichts aufgenommen, gespeichert oder verschickt außer dieser Zahl.
//  - Kamera-Wache: nur ob sie scharf ist (eigene Kameras).
//  - Wetter draußen (bestehendes Wetter-Modul), damit Friday z. B. "draußen ist es kühler, jetzt lüften" sagen kann.
// Gespeichert: die letzten 50 Pegel-Messungen in server/data/umgebung.json.
import * as store from "./store.js";

const NAME = "umgebung";
const lade = () => store.load(NAME, { messungen: [] });
const sicher = async (fn) => { try { return await fn(); } catch { return null; } };

export function laermStufe(db) {
  if (db == null) return null;
  if (db < 35) return { stufe: "sehr leise", icon: "🤫" };
  if (db < 50) return { stufe: "leise", icon: "🙂" };
  if (db < 65) return { stufe: "normal", icon: "🗣" };
  if (db < 80) return { stufe: "laut", icon: "📢" };
  return { stufe: "sehr laut", icon: "🔊" };
}

/** Pegel-Messung vom eigenen Gerät speichern (nur die Zahl). */
export function messungSpeichern({ db, geraet = "" } = {}) {
  const v = Number(db);
  if (!Number.isFinite(v) || v < 0 || v > 140) return { error: "Ungültiger Messwert." };
  const d = lade();
  const m = { db: Math.round(v), geraet: String(geraet).slice(0, 30), zeit: new Date().toISOString() };
  d.messungen = [...d.messungen, m].slice(-50);
  store.save(NAME, d);
  return { ok: true, messung: { ...m, ...laermStufe(m.db) } };
}

export async function lage() {
  const raum = { temperatur: null, feuchte: null, co2: null, hell: null, feinstaub: null, sensoren: 0 };
  const H = await sicher(() => import("./homeassistant.js"));
  let haText = "Home Assistant nicht eingerichtet";
  if (H?.haBereit()) {
    const r = await sicher(() => H.geraete());
    if (r?.ok) {
      haText = "";
      const innen = r.geraete.filter((g) => g.domain === "sensor" && !/aussen|außen|outdoor|draussen|draußen|balkon|garten/i.test(`${g.name} ${g.id}`));
      const mittel = (klasse) => { const w = innen.filter((g) => g.klasse === klasse).map((g) => Number(g.status)).filter(Number.isFinite); raum.sensoren += w.length; return w.length ? Math.round((w.reduce((s, x) => s + x, 0) / w.length) * 10) / 10 : null; };
      raum.temperatur = mittel("temperature"); raum.feuchte = mittel("humidity"); raum.co2 = mittel("carbon_dioxide"); raum.hell = mittel("illuminance"); raum.feinstaub = mittel("pm25");
    } else haText = r?.error || "Home Assistant nicht erreichbar";
  }
  const d = lade();
  const letzte = d.messungen.at(-1) || null;
  const laerm = letzte && Date.now() - Date.parse(letzte.zeit) < 6 * 3600e3 ? { ...letzte, ...laermStufe(letzte.db) } : null;
  const wache = await sicher(async () => { const W = await import("./wache.js"); const u = W.uebersicht({ mitEreignissen: 0 }); return { scharf: Boolean(u.scharf), kameras: u.kameras.length, heute: u.heute.anzahl }; });
  const draussen = await sicher(async () => { const T = await import("./tools.js"); const w = await Promise.race([T.getWeather(), new Promise((r) => setTimeout(() => r(null), 4000))]); return w?.jetzt ? { ort: w.ort, temperatur: w.jetzt.temperatur, feuchte: w.jetzt.luftfeuchte, wetter: w.jetzt.wetter } : null; });

  const empfehlungen = [];
  if (raum.co2 != null && raum.co2 > 1000) empfehlungen.push("Die Luft ist verbraucht (CO₂ hoch). Kurz Stoßlüften.");
  if (raum.feuchte != null && raum.feuchte > 65) empfehlungen.push("Die Luft ist feucht. Lüften hilft gegen Schimmel.");
  if (raum.feuchte != null && raum.feuchte < 30) empfehlungen.push("Die Luft ist sehr trocken. Wasser trinken, ggf. Pflanzen oder Luftbefeuchter.");
  if (raum.temperatur != null && raum.temperatur < 18) empfehlungen.push("Es ist kühl im Raum.");
  if (raum.temperatur != null && raum.temperatur > 26) empfehlungen.push("Es ist warm im Raum. Abends lüften oder beschatten.");
  if (raum.hell != null && raum.hell < 50 && new Date().getHours() >= 8 && new Date().getHours() < 20) empfehlungen.push("Es ist eher dunkel. Mehr Licht ist besser für die Augen.");
  if (draussen && raum.temperatur != null && raum.temperatur > 24 && draussen.temperatur < raum.temperatur - 3) empfehlungen.push(`Draußen ist es kühler (${draussen.temperatur} °C). Jetzt lüften kühlt die Wohnung.`);
  if (laerm && laerm.db >= 70) empfehlungen.push("Es ist ziemlich laut. Für konzentriertes Arbeiten Kopfhörer oder ein ruhigerer Raum.");
  return { raum, haText, laerm, messungen: d.messungen.slice(-12).reverse().map((m) => ({ ...m, ...laermStufe(m.db) })), wache, draussen, empfehlungen };
}

export function satz(l) {
  const t = [];
  const r = l.raum;
  const teile = [];
  if (r.temperatur != null) teile.push(`${String(r.temperatur).replace(".", ",")} Grad`);
  if (r.feuchte != null) teile.push(`${Math.round(r.feuchte)} Prozent Luftfeuchte`);
  if (r.co2 != null) teile.push(`CO2 ${Math.round(r.co2)} ppm`);
  if (teile.length) t.push(`Drinnen: ${teile.join(", ")}.`);
  if (l.laerm) t.push(`Zuletzt gemessen: etwa ${l.laerm.db} Dezibel, ${l.laerm.stufe}.`);
  if (l.wache) t.push(l.wache.scharf ? "Die Kamera-Wache ist scharf." : "Die Kamera-Wache ist aus.");
  if (l.empfehlungen.length) t.push(l.empfehlungen[0]);
  return t.join(" ") || "Ich habe noch keine Umgebungsdaten. Richte Home Assistant ein oder tippe im Cockpit unter Zuhause auf „Geräusch messen“.";
}

export async function quickCommand(text) {
  const t = String(text || "").toLowerCase();
  if (!/wie ist (die|meine) umgebung|umgebung(serkennung| prüfen| checken)|wie laut ist es|raumklima|wie ist die luft/.test(t)) return null;
  const l = await lage();
  return { answer: satz(l), actions: ["cockpit:zuhause"] };
}

export function umgebungRouten(app, asyncRoute) {
  app.get("/api/umgebung", asyncRoute(async (_req, res) => res.json(await lage())));
  app.post("/api/umgebung/messung", asyncRoute(async (req, res) => { const r = messungSpeichern(req.body || {}); res.status(r.error ? 400 : 200).json(r); }));
}

export async function umgebungStart() {
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "umgebung", bereich: "Alltag", name: "Umgebungserkennung hat echte Messwerte", lauf: async () => {
      const l = await lage();
      const quellen = [l.raum.sensoren ? `${l.raum.sensoren} Sensoren` : "", l.laerm ? "Geräusch-Messung" : ""].filter(Boolean);
      return quellen.length ? { status: "bestanden", text: `Echte Werte aus: ${quellen.join(", ")}.` } : { status: "uebersprungen", text: "Noch keine echten Werte: keine Raum-Sensoren und keine Geräusch-Messung in den letzten 6 Stunden." };
    } });
  } catch { /* egal */ }
}
