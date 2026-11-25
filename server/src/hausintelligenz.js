// Smart Home Intelligence (v1.182.0, Mark XII Punkt 14) – baut auf Home Assistant auf, kein zweites Smart-Home-Modul.
//
//  - Beobachten: Alle 5 Minuten schaut Friday, welche Lichter/Steckdosen/Rollos an oder aus sind, und merkt sich
//    jede Änderung mit Uhrzeit (nur Kevins eigene Geräte, nur im eigenen WLAN).
//  - Gewohnheiten erkennen: Schaltet Kevin z. B. werktags fast immer gegen 18:30 das Wohnzimmerlicht ein,
//    schlägt Friday vor, das automatisch zu machen. Nichts passiert ohne Kevins "Ja" (Vorschlag annehmen = Freigabe).
//    Angenommene Vorschläge werden normale Automationen (Automatisierungszentrale, Notfallmodus stoppt sie).
//  - Hinweise aus Sensoren: zu kalt, zu warm, Luftfeuchte hoch (lüften), CO2 hoch, Batterie schwach,
//    Fenster offen während die Heizung läuft.
// Schlösser werden nie automatisch geschaltet. Gespeichert in server/data/hausintelligenz.json.
import * as store from "./store.js";
import { config } from "./config.js";
import { eintragen } from "./logbuch.js";

const NAME = "hausintelligenz";
const SCHALTBAR = new Set(["light", "switch", "cover", "fan", "input_boolean"]);
const TAGE_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const leer = () => ({ letzte: {}, ereignisse: [], angenommen: [], abgelehnt: [], beobachtet: null });
const lade = () => ({ ...leer(), ...store.load(NAME, leer()) });
const sichere = (d) => { d.ereignisse = d.ereignisse.slice(-4000); store.save(NAME, d); };

// Ortszeit (Zeitzone aus der Konfiguration), damit "18:30" auch 18:30 bei Kevin ist.
function ortszeit(ms = Date.now()) {
  const s = new Date(ms).toLocaleString("sv-SE", { timeZone: config.timezone || "Europe/Berlin" });
  const [tag, zeit] = s.split(" ");
  const [h, m] = zeit.split(":").map(Number);
  const wd = new Date(`${tag}T12:00:00Z`).getUTCDay();
  return { tag, min: h * 60 + m, wd };
}
const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const istAn = (g) => (g.domain === "cover" ? ["open", "opening"].includes(g.status) : g.status === "on");

async function ha() { return import("./homeassistant.js"); }

/** Einmal nachsehen, was sich im Zuhause geändert hat (läuft alle 5 Minuten). */
export async function beobachten() {
  const H = await ha();
  if (!H.haBereit()) return { ok: false, uebersprungen: true, text: "Home Assistant ist nicht eingerichtet." };
  const r = await H.geraete(true);
  if (!r.ok) return { ok: false, text: r.error };
  const d = lade();
  const erstesMal = !Object.keys(d.letzte).length;
  let neu = 0;
  const jetzt = Date.now();
  const o = ortszeit(jetzt);
  for (const g of r.geraete) {
    if (!SCHALTBAR.has(g.domain) || ["unavailable", "unknown"].includes(g.status)) continue;
    const an = istAn(g);
    if (!erstesMal && g.id in d.letzte && d.letzte[g.id] !== an) {
      d.ereignisse.push({ id: g.id, name: g.name, an, t: new Date(jetzt).toISOString(), ...o });
      neu++;
    }
    d.letzte[g.id] = an;
  }
  d.beobachtet = new Date(jetzt).toISOString();
  sichere(d);
  return { ok: true, text: erstesMal ? `${Object.keys(d.letzte).length} Geräte zum ersten Mal gesehen.` : `${neu} Änderung(en) gemerkt.`, neu };
}

const schluessel = (v) => `${v.id}|${v.an ? "an" : "aus"}|${v.werktag ? "wt" : "we"}`;

/**
 * Gewohnheiten aus den gemerkten Schaltvorgängen.
 * Regel: Dasselbe Gerät, gleiche Richtung, an mindestens 4 verschiedenen Tagen (Werktag oder Wochenende getrennt)
 * innerhalb von ±30 Minuten um die übliche Zeit, in mindestens 60 % der Tage mit so einem Vorgang.
 */
export function muster(ereignisse = lade().ereignisse, { heute = ortszeit().tag, ausschliessen = [] } = {}) {
  const grenze = new Date(Date.parse(`${heute}T12:00:00Z`) - 28 * 864e5).toISOString().slice(0, 10);
  const gruppen = new Map();
  for (const e of ereignisse) {
    if (e.tag < grenze) continue;
    const werktag = e.wd >= 1 && e.wd <= 5;
    const k = schluessel({ id: e.id, an: e.an, werktag });
    if (!gruppen.has(k)) gruppen.set(k, { id: e.id, name: e.name, an: e.an, werktag, proTag: new Map() });
    const g = gruppen.get(k);
    // pro Tag nur der erste Vorgang zählt (sonst zählt Hin- und Herschalten mehrfach)
    if (!g.proTag.has(e.tag) || g.proTag.get(e.tag) > e.min) g.proTag.set(e.tag, e.min);
  }
  const vorschlaege = [];
  for (const [k, g] of gruppen) {
    if (ausschliessen.includes(k)) continue;
    const zeiten = [...g.proTag.values()].sort((a, b) => a - b);
    if (zeiten.length < 4) continue;
    const mitte = zeiten[Math.floor(zeiten.length / 2)];
    const treffer = zeiten.filter((m) => Math.abs(m - mitte) <= 30).length;
    if (treffer < 4 || treffer / zeiten.length < 0.6) continue;
    const zeit = hhmm(Math.round(mitte / 5) * 5);
    vorschlaege.push({
      key: k, id: g.id, name: g.name, an: g.an, werktag: g.werktag, zeit, tage: g.werktag ? [1, 2, 3, 4, 5] : [0, 6], treffer, tageGesamt: zeiten.length,
      text: `${g.werktag ? "Werktags" : "Am Wochenende"} schaltest du „${g.name}“ meist gegen ${zeit} ${g.an ? "ein" : "aus"} (${treffer} von ${zeiten.length} Tagen). Soll ich das automatisch machen?`,
    });
  }
  return vorschlaege.sort((a, b) => b.treffer - a.treffer);
}

/** Vorschlag annehmen: wird eine normale Automation. Kevins Klick ist die Freigabe. */
export async function annehmen(key) {
  const d = lade();
  const v = muster(d.ereignisse, { ausschliessen: [...d.angenommen, ...d.abgelehnt] }).find((x) => x.key === key);
  if (!v) return { error: "Diesen Vorschlag gibt es nicht mehr." };
  if (String(v.id).startsWith("lock.")) return { error: "Schlösser schaltet Friday nie automatisch." };
  const A = await import("./automationen.js");
  const r = A.speichereRegel({ name: `${v.name} ${v.an ? "an" : "aus"} (${v.werktag ? "werktags" : "Wochenende"} ${v.zeit})`, ausloeser: { art: "taeglich", zeit: v.zeit, tage: v.tage }, aktion: { art: "haus", text: v.id, schalten: v.an ? "an" : "aus" } });
  if (r.error) return r;
  d.angenommen.push(key);
  sichere(d);
  eintragen({ bereich: "system", titel: `Smart-Home-Gewohnheit übernommen: ${r.regel.name}`, quelle: "dashboard" });
  return { ok: true, text: `Erledigt. Ab jetzt ${v.werktag ? "werktags" : "am Wochenende"} um ${v.zeit}: ${v.name} ${v.an ? "an" : "aus"}. Abschalten kannst du das unter Automationen.`, regel: r.regel };
}
export function ablehnen(key) {
  const d = lade();
  if (!d.abgelehnt.includes(key)) d.abgelehnt.push(key);
  sichere(d);
  return { ok: true };
}

/** Hinweise aus den Sensor-Werten (nur lesen). */
export function hinweise(geraete = []) {
  const l = [];
  const zahl = (g) => { const v = Number(g.status); return Number.isFinite(v) ? v : null; };
  for (const g of geraete) {
    if (g.domain !== "sensor") continue;
    const v = zahl(g);
    if (v == null) continue;
    const name = g.name;
    if (g.klasse === "temperature" && !/aussen|außen|outdoor|draussen|draußen|balkon|garten/i.test(name)) {
      if (v < 17) l.push({ stufe: "warn", icon: "🥶", text: `${name}: nur ${v} °C – heizen?` });
      else if (v > 27) l.push({ stufe: "warn", icon: "🥵", text: `${name}: ${v} °C – lüften oder beschatten?` });
    }
    if (g.klasse === "humidity") {
      if (v > 65) l.push({ stufe: "warn", icon: "💧", text: `${name}: ${v} % Luftfeuchte – bitte lüften (Schimmelgefahr).` });
      else if (v < 30) l.push({ stufe: "info", icon: "🌵", text: `${name}: nur ${v} % Luftfeuchte – sehr trocken.` });
    }
    if ((g.klasse === "carbon_dioxide" || /co2/i.test(g.id)) && v > 1200) l.push({ stufe: "warn", icon: "🌬", text: `${name}: CO₂ ${v} ppm – Fenster auf.` });
    if (g.klasse === "battery" && v < 15) l.push({ stufe: "warn", icon: "🔋", text: `${name}: Batterie nur noch ${v} %.` });
  }
  const fensterOffen = geraete.filter((g) => g.domain === "binary_sensor" && ["window", "door", "opening"].includes(g.klasse) && g.status === "on" && /fenster|window/i.test(`${g.name} ${g.id}`));
  const heizt = geraete.filter((g) => g.domain === "climate" && !["off", "unavailable"].includes(g.status));
  if (fensterOffen.length && heizt.length) l.push({ stufe: "warn", icon: "🪟", text: `${fensterOffen.map((f) => f.name).join(", ")} offen, während ${heizt.map((h) => h.name).join(", ")} heizt.` });
  return l;
}

/** Gesamtbild fürs Cockpit. */
export async function uebersicht() {
  const H = await ha();
  const d = lade();
  const vorschlaege = muster(d.ereignisse, { ausschliessen: [...d.angenommen, ...d.abgelehnt] });
  const tage = new Set(d.ereignisse.map((e) => e.tag)).size;
  if (!H.haBereit()) return { bereit: false, vorschlaege, ereignisse: d.ereignisse.length, tage, hinweise: [], geraete: null, text: "Home Assistant ist noch nicht eingerichtet (Werkzeug-Menü → Verbindungen → Home Assistant)." };
  const r = await H.geraete();
  if (!r.ok) return { bereit: true, fehler: r.error, vorschlaege, ereignisse: d.ereignisse.length, tage, hinweise: [], geraete: null };
  const g = r.geraete;
  const schaltbar = g.filter((x) => SCHALTBAR.has(x.domain));
  const an = schaltbar.filter((x) => istAn(x));
  const sensoren = g.filter((x) => x.domain === "sensor" && ["temperature", "humidity", "carbon_dioxide", "illuminance", "pm25", "battery"].includes(x.klasse)).map((x) => ({ id: x.id, name: x.name, wert: x.status, einheit: x.einheit, klasse: x.klasse }));
  return {
    bereit: true, vorschlaege, uebernommen: d.angenommen.length, ereignisse: d.ereignisse.length, tage, beobachtet: d.beobachtet,
    geraete: { gesamt: g.length, schaltbar: schaltbar.length, an: an.map((x) => ({ id: x.id, name: x.name })) },
    sensoren: sensoren.slice(0, 30), hinweise: hinweise(g),
    letzte: d.ereignisse.slice(-12).reverse().map((e) => ({ name: e.name, an: e.an, zeit: `${TAGE_KURZ[e.wd]} ${hhmm(e.min)}` })),
  };
}

export function satz(u) {
  if (!u.bereit) return u.text;
  if (u.fehler) return u.fehler;
  const teile = [`Im Zuhause sind ${u.geraete.an.length} von ${u.geraete.schaltbar} Geräten an.`];
  if (u.hinweise.length) teile.push(u.hinweise.slice(0, 3).map((h) => h.text).join(" "));
  else teile.push("Keine Auffälligkeiten bei den Sensoren.");
  if (u.vorschlaege.length) teile.push(`Ich habe ${u.vorschlaege.length} Gewohnheit${u.vorschlaege.length === 1 ? "" : "en"} erkannt: ${u.vorschlaege[0].text}`);
  else if (u.uebernommen) teile.push(`${u.uebernommen} erkannte Gewohnheit${u.uebernommen === 1 ? " läuft" : "en laufen"} schon automatisch, gerade gibt es keine neuen Vorschläge.`);
  else teile.push(`Gewohnheiten erkenne ich, sobald ich ein paar Tage zugesehen habe (bisher ${u.tage} Tag${u.tage === 1 ? "" : "e"} mit Schaltvorgängen).`);
  return teile.join(" ");
}

export async function quickCommand(text) {
  const t = String(text || "").toLowerCase();
  if (!/\b(smart.?home|zuhause|zu hause|wohnung)\b.*\b(intelligen\w*|gelernt|gewohnheit\w*|vorschl\w*|status)\b|was (hast|weißt) du (über|von) mein(em)? (zuhause|wohnung)|hausintelligenz|wie ist es zu ?hause/.test(t)) return null;
  const u = await uebersicht();
  return { answer: satz(u), actions: ["cockpit:zuhause"] };
}

export function hausRouten(app, asyncRoute) {
  app.get("/api/haus-intelligenz", asyncRoute(async (_req, res) => res.json(await uebersicht())));
  app.post("/api/haus-intelligenz/beobachten", asyncRoute(async (_req, res) => res.json(await beobachten())));
  app.post("/api/haus-intelligenz/vorschlag", asyncRoute(async (req, res) => {
    const key = String(req.body?.key || "");
    const r = req.body?.annehmen === true ? await annehmen(key) : ablehnen(key);
    res.status(r.error ? 400 : 200).json(r);
  }));
}

export async function hausStart() {
  try {
    const hz = await import("./herzschlag.js");
    hz.aufgabeRegistrieren("haus-beobachten", {
      name: "Smart-Home beobachten", text: "Merkt sich alle 5 Minuten, welche Geräte an oder aus sind, um Gewohnheiten zu erkennen.", art: "intervall", minuten: 5, standardAn: true,
      lauf: async () => { const r = await beobachten(); return { ok: r.ok || r.uebersprungen, text: r.text }; },
    });
  } catch { /* egal */ }
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "hausintelligenz", bereich: "Alltag", name: "Smart Home Intelligence", lauf: async () => {
      // 1) Rechenweg mit festen Beispieldaten (keine Geräte-Simulation, nur die Gewohnheits-Regel)
      const bsp = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-09"].map((tag, i) => ({ id: "light.test", name: "Test", an: true, tag, wd: new Date(`${tag}T12:00:00Z`).getUTCDay(), min: 18 * 60 + 25 + i * 3 }));
      const m = muster(bsp, { heute: "2026-11-10" });
      if (!(m.length === 1 && m[0].werktag && m[0].zeit === "18:30")) return { status: "fehler", text: `Gewohnheits-Regel rechnet falsch: ${JSON.stringify(m)}` };
      // 2) Echter Abruf bei Home Assistant
      const H = await ha();
      if (!H.haBereit()) return { status: "uebersprungen", text: "Rechenweg ok. Home Assistant ist nicht eingerichtet, echter Abruf nicht möglich." };
      const r = await H.geraete(true);
      return r.ok ? { status: "bestanden", text: `Rechenweg ok, Home Assistant liefert ${r.geraete.length} Geräte.` } : { status: "fehler", text: r.error };
    } });
  } catch { /* egal */ }
}
