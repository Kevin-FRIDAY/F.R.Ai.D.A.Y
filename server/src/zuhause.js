// Universal Control, Räume, Energie, Szenen und Gerätefehler (v1.189.0, Mark XVII).
//
//  🎛 Universal Control  EIN Bedienfeld für alles, was Friday schon steuern kann: Home Assistant (nach Räumen),
//                        Hue-Szenen, Fernseher, Alexa-Routinen. Nutzt die vorhandenen Module (kein Doppel).
//                        Schlösser werden nur angezeigt, nie geschaltet.
//  🛋 Raum-Profile       Pro Raum Temperatur, Feuchte, CO₂, Lichter + Wunschtemperatur → Lüften/Heizen-Vorschlag.
//  ⚡ Energie            Leistung (W) und Zähler (kWh) aus Home-Assistant-Sensoren: jetzt, heute, Grundlast,
//                        Standby-Kosten im Jahr, größte Verbraucher. Strompreis stellst du selbst ein.
//  🎬 Szenen             Eigene Szenen aus dem aktuellen Zustand eines Raums speichern und per Knopf/Sprache starten.
//                        Vorschläge aus den Gewohnheiten (Geräte, die du oft zusammen einschaltest).
//  🩺 Gerätefehler       Geräte, die „nicht erreichbar“ sind, und schwache Batterien. Mitteilung nur als Text.
//
// Alles ohne Claude, ohne Kosten. Braucht Home Assistant für Räume/Energie/Fehler. Gespeichert in data/zuhause.json.
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";

const NAME = "zuhause";
const lade = () => ({ szenen: [], wunsch: {}, preisCent: 35, proben: [], tagesStart: {}, offline: {}, gemeldet: {}, ...store.load(NAME, {}) });
const sichere = (d) => store.save(NAME, d);
const sicher = async (fn) => { try { return await fn(); } catch { return null; } };
const kurz = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const neueId = () => Math.random().toString(36).slice(2, 10);
const heute = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const SCHALTBAR = new Set(["light", "switch", "fan", "input_boolean", "cover"]);

export const RAEUME = ["Wohnzimmer", "Schlafzimmer", "Kinderzimmer", "Arbeitszimmer", "Gästezimmer", "Esszimmer", "Küche", "Bad", "Badezimmer", "Gäste-WC", "WC", "Büro", "Flur", "Diele", "Keller", "Garage", "Garten", "Balkon", "Terrasse", "Dachboden", "Hauswirtschaftsraum"];
const RAUM_NORM = { Badezimmer: "Bad", Diele: "Flur", WC: "Gäste-WC" };
const WUNSCH_STANDARD = { Schlafzimmer: 18, Kinderzimmer: 20, Bad: 22, Küche: 19, Flur: 18, Keller: 15, Garage: 12 };
export function raumAus(text = "") {
  const t = String(text).toLowerCase().replace(/_/g, " ");
  const r = RAEUME.slice().sort((a, b) => b.length - a.length).find((x) => t.includes(x.toLowerCase()) || t.includes(x.toLowerCase().replace(/ä/g, "ae").replace(/ü/g, "ue").replace(/ö/g, "oe")));
  return r ? RAUM_NORM[r] || r : "Sonstige";
}
const istAn = (g) => (g.domain === "cover" ? ["open", "opening"].includes(g.status) : g.domain === "climate" ? !["off", "unavailable", "unknown"].includes(g.status) : g.status === "on");
const fehlt = (g) => ["unavailable", "unknown"].includes(g.status);

async function haGeraete(frisch = false) {
  const H = await import("./homeassistant.js");
  if (!H.haBereit()) return { ok: false, bereit: false, error: "Home Assistant ist nicht eingerichtet (Werkzeug-Menü → Verbindungen)." };
  const r = await H.geraete(frisch);
  return r.ok ? { ok: true, bereit: true, geraete: r.geraete } : { ok: false, bereit: true, error: r.error };
}

// ---------- 🎛 Universal Control ----------
export async function universal() {
  const ha = await haGeraete();
  const raeume = {};
  if (ha.ok) {
    for (const g of ha.geraete) {
      if (!SCHALTBAR.has(g.domain) && !["climate", "scene", "script", "lock", "media_player", "vacuum"].includes(g.domain)) continue;
      const r = raumAus(`${g.name} ${g.id}`);
      (raeume[r] ||= []).push({ id: g.id, name: g.name, domain: g.domain, status: g.status, an: istAn(g), fehlt: fehlt(g), ziel: g.ziel ?? null, ist: g.ist ?? null, nurAnzeige: g.domain === "lock" });
    }
  }
  const [hue, tv, alexa] = await Promise.all([
    sicher(async () => { const h = await import("./hue.js"); if (!h.hueBereit()) return { bereit: false }; const r = await h.command({ action: "raeume" }); return { bereit: true, raeume: (r?.raeume || []).map((x) => x.name || x).slice(0, 20) }; }),
    sicher(async () => { const s = await (await import("./fernseher.js")).status(); return { bereit: Boolean(s?.eingerichtet), erreichbar: Boolean(s?.erreichbar), name: s?.name || "Fernseher" }; }),
    sicher(async () => { const s = await (await import("./alexa.js")).status(); return { bereit: Boolean(s?.eingerichtet), routinen: (s?.routinen || []).map((x) => x.name).slice(0, 30) }; }),
  ]);
  const mac = await sicher(async () => (await import("./agent-hub.js")).isAgentOnline());
  const d = lade();
  return {
    ha: { bereit: ha.bereit !== false, ok: ha.ok, error: ha.error || null },
    raeume: Object.entries(raeume).sort(([a], [b]) => (a === "Sonstige") - (b === "Sonstige") || a.localeCompare(b, "de")).map(([name, geraete]) => ({ name, geraete })),
    hue: hue || { bereit: false }, tv: tv || { bereit: false }, alexa: alexa || { bereit: false }, mac: Boolean(mac),
    szenen: d.szenen,
  };
}

/** Ein Gerät/System steuern. Schlösser nie. */
export async function steuern({ system = "ha", id = "", aktion = "", wert } = {}) {
  if (system === "ha") {
    const H = await import("./homeassistant.js");
    const ha = await haGeraete();
    if (!ha.ok) return { error: ha.error };
    const g = ha.geraete.find((x) => x.id === id);
    if (!g) return { error: "Dieses Gerät kenne ich nicht." };
    if (g.domain === "lock") return { error: "Schlösser schaltet Friday aus Sicherheitsgründen nie." };
    let r;
    if (aktion === "helligkeit") r = await H.helligkeit(g.name, Number(wert));
    else if (aktion === "temperatur") r = await H.temperatur(g.name, Number(wert));
    else r = await H.schalten(g.id, aktion === "an" ? true : aktion === "aus" ? false : "toggle");
    if (r.ok) eintragen({ bereich: "zuhause", titel: r.text, quelle: "universal-control" });
    return r.ok ? { ok: true, text: r.text } : { error: r.error };
  }
  if (system === "tv") { const r = await (await import("./fernseher.js")).command({ action: aktion }); return r.ok ? { ok: true, text: r.text || "Erledigt." } : { error: r.error }; }
  if (system === "alexa") { const r = await (await import("./alexa.js")).command({ action: "routine", value: id }); return r.ok ? { ok: true, text: r.text || `Routine ${id} gestartet.` } : { error: r.error }; }
  if (system === "hue") { const r = await (await import("./hue.js")).command({ action: aktion === "aus" ? "aus" : "an", wo: id }); return r.ok ? { ok: true, text: r.text } : { error: r.error }; }
  return { error: "Unbekanntes System." };
}

// ---------- 🛋 Raum-Profile ----------
export async function raumProfile() {
  const ha = await haGeraete();
  if (!ha.ok) return { ok: false, error: ha.error, raeume: [] };
  const d = lade();
  const m = {};
  const zahl = (g) => { const v = Number(g.status); return Number.isFinite(v) ? v : null; };
  for (const g of ha.geraete) {
    const r = raumAus(`${g.name} ${g.id}`);
    if (r === "Sonstige" || ["Garten", "Balkon", "Terrasse"].includes(r)) continue;
    const x = (m[r] ||= { name: r, temperatur: null, feuchte: null, co2: null, lichterAn: 0, lichter: 0, heizung: null, fenster: [] });
    if (g.domain === "sensor" && g.klasse === "temperature") x.temperatur = zahl(g);
    if (g.domain === "sensor" && g.klasse === "humidity") x.feuchte = zahl(g);
    if (g.domain === "sensor" && (g.klasse === "carbon_dioxide" || /co2/i.test(g.id))) x.co2 = zahl(g);
    if (g.domain === "light") { x.lichter++; if (istAn(g)) x.lichterAn++; }
    if (g.domain === "climate") { x.heizung = { id: g.id, name: g.name, ziel: g.ziel ?? null, status: g.status }; if (x.temperatur == null && Number.isFinite(Number(g.ist))) x.temperatur = Number(g.ist); }
    if (g.domain === "binary_sensor" && ["window", "door", "opening"].includes(g.klasse) && g.status === "on") x.fenster.push(g.name);
  }
  const raeume = Object.values(m).filter((x) => x.temperatur != null || x.feuchte != null || x.co2 != null || x.lichter || x.heizung).map((x) => {
    const wunsch = d.wunsch[x.name] ?? WUNSCH_STANDARD[x.name] ?? 21;
    const tipps = [];
    if (x.co2 != null && x.co2 > 1000) tipps.push({ icon: "🌬", text: `CO₂ ${x.co2} ppm: 5 Minuten Stoßlüften.` });
    if (x.feuchte != null && x.feuchte > 65) tipps.push({ icon: "💧", text: `${x.feuchte} % Feuchte: lüften gegen Schimmel.` });
    if (x.temperatur != null && x.temperatur < wunsch - 1.5) tipps.push({ icon: "🔥", text: `${x.temperatur} °C, gewünscht ${wunsch} °C.${x.fenster.length ? " Erst das Fenster schließen." : x.heizung ? " Heizung hochstellen?" : ""}`, heizen: x.heizung && !x.fenster.length ? { id: x.heizung.id, grad: wunsch } : null });
    if (x.temperatur != null && x.temperatur > wunsch + 3) tipps.push({ icon: "🥵", text: `${x.temperatur} °C, gewünscht ${wunsch} °C: lüften oder Heizung runter.` });
    if (x.fenster.length && x.heizung && !["off", "unavailable"].includes(x.heizung.status)) tipps.push({ icon: "🪟", text: `${x.fenster.join(", ")} offen, während geheizt wird.` });
    return { ...x, wunsch, tipps, stufe: tipps.length ? "hinweis" : "gut" };
  }).sort((a, b) => a.name.localeCompare(b.name, "de"));
  return { ok: true, raeume };
}
export function wunschSetzen(raum, grad) {
  const g = Number(grad);
  if (!Number.isFinite(g) || g < 10 || g > 28) return { error: "Bitte zwischen 10 und 28 Grad." };
  const d = lade(); d.wunsch[kurz(raum, 30)] = Math.round(g * 2) / 2; sichere(d);
  return { ok: true, text: `${raum}: Wunschtemperatur ${String(d.wunsch[kurz(raum, 30)]).replace(".", ",")} °C.` };
}

// ---------- ⚡ Energie ----------
const istLeistung = (g) => g.domain === "sensor" && (g.klasse === "power" || /^k?W$/.test(g.einheit));
const istZaehler = (g) => g.domain === "sensor" && (g.klasse === "energy" || /^[kM]?Wh$/.test(g.einheit));
const watt = (g) => { const v = Number(g.status); return Number.isFinite(v) ? (g.einheit === "kW" ? v * 1000 : v) : null; };
const kwh = (g) => { const v = Number(g.status); return Number.isFinite(v) ? (g.einheit === "Wh" ? v / 1000 : g.einheit === "MWh" ? v * 1000 : v) : null; };
/** Gesamtleistung ohne Doppelzählung: gibt es einen Haus-/Gesamtzähler, gilt der, sonst die Summe. */
export function gesamtLeistung(geraete) {
  const l = geraete.filter(istLeistung).map((g) => ({ g, w: watt(g) })).filter((x) => x.w != null && x.w >= 0);
  const haus = l.find((x) => /gesamt|haus|total|zähler|zaehler|netz|grid|main/i.test(`${x.g.name} ${x.g.id}`));
  return { gesamt: haus ? haus.w : l.reduce((s, x) => s + x.w, 0), hausZaehler: Boolean(haus), einzel: l.filter((x) => x !== haus).sort((a, b) => b.w - a.w).map((x) => ({ id: x.g.id, name: x.g.name, watt: Math.round(x.w) })) };
}
export function grundlast(proben) {
  const w = proben.filter((p) => Date.now() - Date.parse(p.t) < 24 * 3600e3).map((p) => p.w).sort((a, b) => a - b);
  if (w.length < 8) return null;
  return Math.round(w[Math.floor(w.length * 0.1)]);
}
export async function energieProbe() {
  const ha = await haGeraete(true);
  if (!ha.ok) return { ok: false, text: ha.error };
  const d = lade();
  const l = gesamtLeistung(ha.geraete);
  if (ha.geraete.some(istLeistung)) { d.proben.push({ t: new Date().toISOString(), w: Math.round(l.gesamt) }); d.proben = d.proben.slice(-7 * 96); }
  const t = heute();
  if (!d.tagesStart[t]) {
    d.tagesStart[t] = Object.fromEntries(ha.geraete.filter(istZaehler).map((g) => [g.id, kwh(g)]).filter(([, v]) => v != null));
    for (const k of Object.keys(d.tagesStart).sort().slice(0, -8)) delete d.tagesStart[k];
  }
  sichere(d);
  return { ok: true, watt: l.gesamt };
}
export async function energie() {
  const ha = await haGeraete();
  if (!ha.ok) return { ok: false, error: ha.error };
  const d = lade();
  const l = gesamtLeistung(ha.geraete);
  const zaehler = ha.geraete.filter(istZaehler);
  const start = d.tagesStart[heute()] || {};
  const heuteKwh = zaehler.map((g) => { const v = kwh(g), s = start[g.id]; return v != null && s != null && v >= s ? v - s : null; }).filter((v) => v != null);
  const haus = zaehler.find((g) => /gesamt|haus|total|zähler|zaehler|netz|grid|main/i.test(`${g.name} ${g.id}`));
  const heuteWert = haus && start[haus.id] != null ? kwh(haus) - start[haus.id] : heuteKwh.length ? heuteKwh.reduce((s, v) => s + v, 0) : null;
  const gl = grundlast(d.proben);
  const preis = d.preisCent / 100;
  const tipps = [];
  if (gl != null && gl > 150) tipps.push(`Grundlast ${gl} W: Geräte im Standby prüfen (z. B. Fernseher, Spielkonsole, alte Kühlgeräte). Jede 10 W kosten im Jahr etwa ${Math.round(10 * 8.76 * preis)} €.`);
  for (const x of l.einzel.filter((e) => e.watt > 1500).slice(0, 2)) tipps.push(`${x.name} zieht gerade ${x.watt} W.`);
  return {
    ok: true, preisCent: d.preisCent, jetztWatt: Math.round(l.gesamt), hausZaehler: l.hausZaehler, verbraucher: l.einzel.slice(0, 10),
    heuteKwh: heuteWert != null ? Math.round(heuteWert * 100) / 100 : null, heuteEuro: heuteWert != null ? Math.round(heuteWert * preis * 100) / 100 : null,
    grundlastWatt: gl, standbyEuroJahr: gl != null ? Math.round(gl * 8.76 * preis) : null,
    verlauf: d.proben.slice(-96).map((p) => p.w), sensoren: { leistung: ha.geraete.filter(istLeistung).length, zaehler: zaehler.length }, tipps,
  };
}
export function preisSetzen(cent) { const c = Number(cent); if (!Number.isFinite(c) || c < 5 || c > 150) return { error: "Bitte einen Preis zwischen 5 und 150 Cent pro kWh." }; const d = lade(); d.preisCent = Math.round(c * 10) / 10; sichere(d); return { ok: true, text: `Strompreis: ${String(d.preisCent).replace(".", ",")} Cent/kWh.` }; }

// ---------- 🎬 Szenen ----------
export async function szeneSpeichern(name, raum = "") {
  const n = kurz(name, 40).replace(/^./, (c) => c.toUpperCase());
  if (n.length < 2) return { error: "Wie soll die Szene heißen?" };
  const ha = await haGeraete(true);
  if (!ha.ok) return { error: ha.error };
  const geraete = ha.geraete.filter((g) => SCHALTBAR.has(g.domain) && !fehlt(g) && (!raum || raumAus(`${g.name} ${g.id}`) === raum));
  if (!geraete.length) return { error: raum ? `Im Raum ${raum} finde ich keine schaltbaren Geräte.` : "Keine schaltbaren Geräte gefunden." };
  const d = lade();
  d.szenen = d.szenen.filter((s) => s.name.toLowerCase() !== n.toLowerCase());
  const s = { id: neueId(), name: n, raum: raum || "", zustaende: geraete.map((g) => ({ id: g.id, name: g.name, an: istAn(g) })), at: new Date().toISOString() };
  d.szenen.push(s); sichere(d);
  return { ok: true, szene: s, text: `Szene „${n}“ gespeichert: ${s.zustaende.filter((z) => z.an).length} an, ${s.zustaende.filter((z) => !z.an).length} aus.` };
}
export async function szeneStarten(idOderName) {
  const d = lade();
  const k = String(idOderName || "").toLowerCase().trim();
  const s = d.szenen.find((x) => x.id === idOderName || x.name.toLowerCase() === k);
  if (!s) return { error: "Diese Szene kenne ich nicht." };
  const H = await import("./homeassistant.js");
  let ok = 0; const fehler = [];
  for (const z of s.zustaende) { const r = await H.schalten(z.id, z.an); if (r.ok) ok++; else fehler.push(z.name); }
  eintragen({ bereich: "zuhause", titel: `Szene ${s.name} gestartet`, details: fehler.length ? `nicht geklappt: ${fehler.join(", ")}` : `${ok} Geräte`, ok: !fehler.length, quelle: "szenen" });
  return { ok: fehler.length < s.zustaende.length, text: `Szene „${s.name}“: ${ok} von ${s.zustaende.length} Geräten geschaltet.${fehler.length ? ` Nicht geklappt: ${fehler.slice(0, 3).join(", ")}.` : ""}` };
}
export function szeneWeg(id) { const d = lade(); const s = d.szenen.find((x) => x.id === id); if (!s) return { error: "Diese Szene gibt es nicht mehr." }; d.szenen = d.szenen.filter((x) => x.id !== id); sichere(d); return { ok: true, text: `Szene „${s.name}“ gelöscht.` }; }

/** Vorschläge aus den Gewohnheiten: Geräte, die an mindestens 3 Tagen innerhalb von 10 Minuten zusammen eingeschaltet wurden. */
export function szenenVorschlaege(ereignisse) {
  const proTag = {};
  for (const e of ereignisse.filter((x) => x.an)) (proTag[e.tag] ||= []).push(e);
  const zaehl = new Map();
  for (const l of Object.values(proTag)) {
    l.sort((a, b) => a.min - b.min);
    const gesehen = new Set();
    for (let i = 0; i < l.length; i++) {
      const gruppe = l.filter((x) => x.min >= l[i].min && x.min - l[i].min <= 10);
      const ids = [...new Set(gruppe.map((x) => x.id))].sort();
      if (ids.length < 2) continue;
      const key = ids.join("|");
      if (gesehen.has(key)) continue;
      gesehen.add(key);
      const z = zaehl.get(key) || { ids, namen: [...new Set(gruppe.map((x) => x.name))], tage: 0, minuten: [] };
      z.tage++; z.minuten.push(l[i].min); zaehl.set(key, z);
    }
  }
  return [...zaehl.values()].filter((z) => z.tage >= 3).sort((a, b) => b.tage - a.tage || b.ids.length - a.ids.length).slice(0, 5).map((z) => {
    const m = z.minuten.sort((a, b) => a - b)[Math.floor(z.minuten.length / 2)];
    return { ...z, uhrzeit: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, text: `${z.namen.join(" + ")} schaltest du an ${z.tage} Tagen zusammen ein (meist gegen ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}).` };
  });
}
export async function szeneAusVorschlag(ids = [], name = "") {
  const ha = await haGeraete(true);
  if (!ha.ok) return { error: ha.error };
  const g = ha.geraete.filter((x) => ids.includes(x.id));
  if (g.length < 2) return { error: "Die Geräte gibt es nicht mehr." };
  const d = lade();
  const s = { id: neueId(), name: kurz(name, 40) || g.map((x) => x.name).join(" + ").slice(0, 40), raum: "", zustaende: g.map((x) => ({ id: x.id, name: x.name, an: true })), at: new Date().toISOString() };
  d.szenen.push(s); sichere(d);
  return { ok: true, text: `Szene „${s.name}“ angelegt.` };
}

// ---------- 🩺 Gerätefehler ----------
export async function geraeteFehler({ melden = false } = {}) {
  const ha = await haGeraete(true);
  if (!ha.ok) return { ok: false, error: ha.error, offline: [], batterien: [] };
  const d = lade();
  const jetzt = Date.now();
  const offline = [];
  const da = new Set();
  for (const g of ha.geraete) {
    if (!fehlt(g)) continue;
    da.add(g.id);
    d.offline[g.id] ||= new Date(jetzt).toISOString();
    offline.push({ id: g.id, name: g.name, raum: raumAus(`${g.name} ${g.id}`), seit: d.offline[g.id], minuten: Math.round((jetzt - Date.parse(d.offline[g.id])) / 6e4) });
  }
  for (const id of Object.keys(d.offline)) if (!da.has(id)) { delete d.offline[id]; delete d.gemeldet[id]; }
  let batterien = [];
  try { batterien = (await import("./hausintelligenz.js")).hinweise(ha.geraete).filter((h) => h.icon === "🔋"); } catch { /* egal */ }
  const neuMelden = offline.filter((o) => o.minuten >= 60 && !d.gemeldet[o.id]);
  if (melden && neuMelden.length) {
    for (const o of neuMelden) d.gemeldet[o.id] = new Date(jetzt).toISOString();
    try { await (await import("./notify.js")).notifyAll("🩺 Gerät nicht erreichbar", neuMelden.slice(0, 5).map((o) => `${o.name} (seit ${Math.round(o.minuten / 60)} Std.)`).join("\n")); } catch { /* egal */ }
    eintragen({ bereich: "zuhause", titel: `Gerätefehler: ${neuMelden.map((o) => o.name).join(", ")}`, ok: false, quelle: "zuhause" });
  }
  sichere(d);
  return { ok: true, offline: offline.sort((a, b) => b.minuten - a.minuten), batterien };
}

// ---------- Übersicht + Sprache ----------
export async function uebersicht() {
  const [u, r, e, f] = await Promise.all([universal(), raumProfile(), energie(), geraeteFehler()]);
  let vorschlaege = [];
  try { const hi = store.load("hausintelligenz", { ereignisse: [] }); vorschlaege = szenenVorschlaege(hi.ereignisse || []).filter((v) => !u.szenen.some((s) => v.ids.every((id) => s.zustaende.some((z) => z.id === id && z.an)))); } catch { /* egal */ }
  return { universal: u, raeume: r, energie: e, fehler: f, vorschlaege };
}
export async function quickCommand(text) {
  const k = String(text || "").toLowerCase().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/, "").replace(/[?!.]+$/, "").trim();
  let m;
  if (/^(öffne|oeffne|zeig|zeige)( mir)? (die |das )?(steuerzentrale|universal ?control|steuerung|zentrale steuerung|raum-?profile|energie-?übersicht|stromverbrauch)$/.test(k)) return { answer: "Hier ist die Steuerzentrale.", actions: ["cockpit:steuerung"] };
  if (/^(wie viel|wieviel) strom (verbrauche ich|verbrauchen wir|brauche ich)|^stromverbrauch|^was verbraucht (gerade )?(am meisten )?strom/.test(k)) {
    const e = await energie();
    if (!e.ok) return { answer: e.error, actions: [] };
    if (!e.sensoren.leistung && !e.sensoren.zaehler) return { answer: "In Home Assistant gibt es keine Strom-Sensoren (Watt oder kWh). Mit einer Mess-Steckdose oder einem Zähler-Lesekopf geht es.", actions: ["cockpit:steuerung"] };
    return { answer: [`Gerade ${e.jetztWatt} Watt.`, e.heuteKwh != null ? `Heute bisher ${String(e.heuteKwh).replace(".", ",")} kWh, etwa ${String(e.heuteEuro).replace(".", ",")} €.` : "", e.verbraucher[0] ? `Am meisten: ${e.verbraucher[0].name} mit ${e.verbraucher[0].watt} Watt.` : "", e.grundlastWatt != null ? `Grundlast ${e.grundlastWatt} Watt, das sind im Jahr etwa ${e.standbyEuroJahr} €.` : ""].filter(Boolean).join(" "), actions: ["cockpit:steuerung"] };
  }
  if (/^(welche|sind) geräte (sind )?(offline|gestört|kaputt|nicht erreichbar)|^(gibt es |habe ich |hab ich )?(gerätefehler|geräte-?störungen|offline-?geräte)|^ist (ein |irgendein )?gerät (offline|kaputt)/.test(k)) {
    const f = await geraeteFehler();
    if (!f.ok) return { answer: f.error, actions: [] };
    return { answer: f.offline.length || f.batterien.length ? [f.offline.length ? `Nicht erreichbar: ${f.offline.slice(0, 4).map((o) => o.name).join(", ")}.` : "", f.batterien.length ? f.batterien.map((b) => b.text).slice(0, 3).join(" ") : ""].filter(Boolean).join(" ") : "Alle Geräte sind erreichbar, keine Batterie ist schwach.", actions: ["cockpit:steuerung"] };
  }
  if ((m = k.match(/^(?:starte |aktiviere |start )?(?:meine |die )?szene (.+?)(?: an| aktivieren| starten)?$/))) {
    const d = lade();
    if (!d.szenen.some((s) => s.name.toLowerCase() === m[1].trim())) return null; // sonst Home-Assistant-/Hue-Szene
    const r = await szeneStarten(m[1]);
    return { answer: r.text || r.error, actions: ["cockpit:steuerung"] };
  }
  if ((m = k.match(/^(?:speicher|speichere|merk dir) (?:den jetzigen zustand |das )?(?:im |in der |in )?(\S+)? ?als szene (.+)$/))) {
    const raum = m[1] ? raumAus(m[1]) : "";
    const r = await szeneSpeichern(m[2], raum === "Sonstige" ? "" : raum);
    return { answer: r.text || r.error, actions: ["cockpit:steuerung"] };
  }
  return null;
}

export function zuhauseRouten(app, asyncRoute) {
  app.get("/api/zuhause", asyncRoute(async (_req, res) => res.json(await uebersicht())));
  app.post("/api/zuhause/steuern", asyncRoute(async (req, res) => res.json(await steuern(req.body || {}))));
  app.post("/api/zuhause/wunsch", (req, res) => res.json(wunschSetzen(String(req.body?.raum || ""), req.body?.grad)));
  app.post("/api/zuhause/preis", (req, res) => res.json(preisSetzen(req.body?.cent)));
  app.post("/api/zuhause/szene", asyncRoute(async (req, res) => res.json(req.body?.ids ? await szeneAusVorschlag(req.body.ids, req.body.name) : await szeneSpeichern(String(req.body?.name || ""), String(req.body?.raum || "")))));
  app.post("/api/zuhause/szene/:id/start", asyncRoute(async (req, res) => res.json(await szeneStarten(req.params.id))));
  app.delete("/api/zuhause/szene/:id", (req, res) => res.json(szeneWeg(req.params.id)));
}

export async function zuhauseStart() {
  try {
    const hz = await import("./herzschlag.js");
    hz.aufgabeRegistrieren("zuhause-waechter", { name: "Energie und Gerätefehler", text: "Alle 15 Minuten: Stromverbrauch aus Home Assistant mitschreiben und nicht erreichbare Geräte erkennen. Mitteilung (nur Text), wenn ein Gerät über eine Stunde weg ist.", art: "intervall", minuten: 15, standardAn: true, lauf: async () => {
      const H = await import("./homeassistant.js");
      if (!H.haBereit()) return { ok: true, uebersprungen: true, text: "Home Assistant nicht eingerichtet" };
      const [e, f] = await Promise.all([energieProbe(), geraeteFehler({ melden: true })]);
      return { ok: e.ok !== false && f.ok !== false, text: `${e.ok ? `${Math.round(e.watt)} W` : e.text} · ${f.ok ? `${f.offline.length} offline` : f.error}` };
    } });
  } catch (err) { console.error("Zuhause/Herzschlag:", err.message); }
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "zuhause", bereich: "Zuhause", name: "Steuerzentrale (Räume, Energie-Rechnung, Szenen-Vorschläge)", lauf: async () => {
      if (raumAus("Licht Wohnzimmer") !== "Wohnzimmer" || raumAus("sensor.badezimmer_feuchte") !== "Bad" || raumAus("Kaffeemaschine") !== "Sonstige") return { status: "fehler", text: "Räume werden falsch erkannt." };
      const g = gesamtLeistung([{ domain: "sensor", klasse: "power", einheit: "W", status: "120", name: "TV", id: "sensor.tv" }, { domain: "sensor", klasse: "power", einheit: "kW", status: "0.5", name: "Haus gesamt", id: "sensor.haus" }]);
      if (g.gesamt !== 500 || !g.hausZaehler) return { status: "fehler", text: "Gesamtleistung wird falsch gerechnet." };
      const ev = [1, 2, 3].flatMap((t) => [{ id: "light.a", name: "A", an: true, tag: `2026-01-0${t}`, min: 1200 }, { id: "switch.b", name: "B", an: true, tag: `2026-01-0${t}`, min: 1205 }]);
      const v = szenenVorschlaege(ev);
      if (v.length !== 1 || v[0].tage !== 3 || v[0].uhrzeit !== "20:00") return { status: "fehler", text: "Szenen-Vorschläge stimmen nicht." };
      const H = await import("./homeassistant.js");
      if (!H.haBereit()) return { status: "uebersprungen", text: "Rechnungen geprüft. Home Assistant ist nicht eingerichtet, darum keine echten Geräte." };
      const u = await universal();
      if (!u.ha.ok) return { status: "fehler", text: `Home Assistant: ${u.ha.error}` };
      return { status: "bestanden", text: `Rechnungen geprüft. Echt: ${u.raeume.reduce((s, r) => s + r.geraete.length, 0)} Geräte in ${u.raeume.length} Räumen.` };
    } });
  } catch (err) { console.error("Zuhause/Funktionstest:", err.message); }
}
