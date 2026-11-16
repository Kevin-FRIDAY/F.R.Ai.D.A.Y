// Philips Hue: Lampen direkt über die Hue Bridge im WLAN (kein Konto, kein Internet nötig).
// Einrichten: Bridge suchen, runden Knopf auf der Bridge drücken, "Koppeln". Danach:
// "Licht an", "Wohnzimmer Licht aus", "Licht auf 30 Prozent", "Licht blau", "Neon-Modus".
// Extra: Wenn Friday spricht, leuchten die gewählten Lampen Neon-Orange und gehen danach zurück.
import * as V from "./verbindungen.js";

const DISCOVERY = () => process.env.HUE_DISCOVERY || "https://discovery.meethue.com/";
const d = () => V.get("hue");
export const hueBereit = () => Boolean(d().ip && d().user);
const basis = () => `http://${d().ip}/api/${d().user}`;

// Farben im Hue-Format (hue 0–65535, sat 0–254) bzw. Weißtöne (ct in Mired)
const FARBEN = {
  rot: { hue: 0, sat: 254 },
  orange: { hue: 5600, sat: 254 },
  neon: { hue: 5600, sat: 254 },
  gelb: { hue: 10500, sat: 254 },
  grün: { hue: 25500, sat: 254 },
  gruen: { hue: 25500, sat: 254 },
  türkis: { hue: 33000, sat: 254 },
  tuerkis: { hue: 33000, sat: 254 },
  cyan: { hue: 36000, sat: 254 },
  blau: { hue: 46920, sat: 254 },
  lila: { hue: 50000, sat: 254 },
  violett: { hue: 50000, sat: 254 },
  pink: { hue: 56100, sat: 254 },
  rosa: { hue: 58000, sat: 160 },
  magenta: { hue: 54000, sat: 254 },
  weiß: { ct: 300 },
  weiss: { ct: 300 },
  warmweiß: { ct: 454 },
  warmweiss: { ct: 454 },
  kaltweiß: { ct: 200 },
  kaltweiss: { ct: 200 },
  tageslicht: { ct: 180 },
};
const NEON = { on: true, hue: 5600, sat: 254, bri: 254 };

async function hue(method, pfad, body, timeout = 6000) {
  if (!hueBereit()) return { ok: false, error: "Philips Hue ist noch nicht eingerichtet. Werkzeug-Menü → Verbindungen → Philips Hue." };
  const r = await V.holeJson(`${basis()}${pfad}`, { method, body, timeout });
  if (r.netz) return { ok: false, error: "Die Hue Bridge antwortet nicht. Ist sie an und im selben WLAN?" };
  const fehler = Array.isArray(r.data) ? r.data.find((x) => x?.error)?.error : null;
  if (fehler?.type === 1) return { ok: false, error: "Die Hue Bridge kennt Friday nicht mehr. Bitte neu koppeln." };
  if (!r.ok || (fehler && method === "GET")) return { ok: false, error: `Hue meldet: ${fehler?.description || r.status}` };
  return { ok: true, data: r.data };
}

// ---------- Suchen & Koppeln ----------
export async function suchen() {
  const r = await V.holeJson(DISCOVERY(), { timeout: 8000 });
  const list = Array.isArray(r.data) ? r.data : [];
  return { ok: true, bridges: list.filter((b) => b?.internalipaddress).map((b) => ({ ip: String(b.internalipaddress), id: String(b.id || "") })) };
}

const ipOk = (ip) => /^(\d{1,3}\.){3}\d{1,3}(:\d{2,5})?$/.test(ip) || /^[a-z0-9-]+(\.local)?$/i.test(ip);

// Wartet bis zu ~30 Sekunden darauf, dass der Knopf auf der Bridge gedrückt wird.
export async function koppeln(ipWunsch) {
  let ip = String(ipWunsch || "").trim();
  if (!ip) {
    const s = await suchen();
    if (!s.bridges.length) return { ok: false, error: "Ich finde keine Hue Bridge. Trag ihre IP-Adresse ein (steht in der Hue-App unter Einstellungen → Bridges)." };
    ip = s.bridges[0].ip;
  }
  if (!ipOk(ip)) return { ok: false, error: "Die IP-Adresse sieht so aus: 192.168.1.30" };
  const ende = Date.now() + Number(process.env.HUE_KOPPELN_MS || 30000);
  while (Date.now() < ende) {
    const r = await V.holeJson(`http://${ip}/api`, { method: "POST", body: { devicetype: "friday#mac" }, timeout: 5000 });
    if (r.netz) return { ok: false, error: `Unter ${ip} antwortet keine Hue Bridge.` };
    const x = Array.isArray(r.data) ? r.data[0] : null;
    if (x?.success?.username) {
      V.set("hue", { ip, user: x.success.username });
      const raeume = await raeumeLaden();
      return { ok: true, text: `Hue ist gekoppelt – ${raeume.length} Räume gefunden.` };
    }
    if (x?.error?.type !== 101) return { ok: false, error: `Hue meldet: ${x?.error?.description || r.status}` };
    await new Promise((res) => setTimeout(res, 2000));
  }
  return { ok: false, error: "Der Knopf auf der Bridge wurde nicht gedrückt. Drück den großen runden Knopf und tipp dann gleich auf Koppeln." };
}

// ---------- Räume / Lampen / Szenen ----------
async function raeumeLaden() {
  const r = await hue("GET", "/groups");
  if (!r.ok) return [];
  const raeume = Object.entries(r.data || {})
    .filter(([, g]) => ["Room", "Zone", "LightGroup"].includes(g.type))
    .map(([id, g]) => ({ id, name: g.name, lampen: g.lights || [], an: Boolean(g.state?.any_on) }));
  V.set("hue", { raeume: raeume.map(({ id, name, lampen }) => ({ id, name, lampen })) });
  return raeume;
}
async function lampen() {
  const r = await hue("GET", "/lights");
  return r.ok ? Object.entries(r.data || {}).map(([id, l]) => ({ id, name: l.name, an: l.state?.on, farbe: Boolean(l.state?.hue != null || l.state?.xy) })) : [];
}

// Ziel finden: Raum, Lampe oder alle (Gruppe 0)
async function ziel(wunsch) {
  const w = V.norm(wunsch).replace(/\b(licht|lichter|lampe|lampen|beleuchtung|im|in der|in|das|die|der|den|hue)\b/g, " ").replace(/\s+/g, " ").trim();
  if (!w || /^(alle|alles|ueberall|ganze wohnung|wohnung|haus|ganzes haus)$/.test(w)) return { art: "gruppe", id: "0", name: "alle Lampen" };
  let raeume = d().raeume || [];
  if (!raeume.length) raeume = await raeumeLaden();
  const r = V.bester(w, raeume);
  if (r) return { art: "gruppe", id: r.id, name: r.name };
  const l = V.bester(w, await lampen());
  if (l) return { art: "lampe", id: l.id, name: l.name };
  return null;
}

async function setze(z, state) {
  const pfad = z.art === "gruppe" ? `/groups/${z.id}/action` : `/lights/${z.id}/state`;
  return hue("PUT", pfad, state);
}

export async function licht(wunsch, state, satz) {
  const z = await ziel(wunsch);
  if (!z) return { ok: false, error: `Bei Hue finde ich keinen Raum und keine Lampe „${wunsch}“.`, kein: true };
  const r = await setze(z, state);
  if (!r.ok) return r;
  return { ok: true, text: satz(z.name === "alle Lampen" ? "Alle Lampen" : z.name) };
}

export async function szene(wunsch) {
  const r = await hue("GET", "/scenes");
  if (!r.ok) return r;
  const szenen = Object.entries(r.data || {}).map(([id, s]) => ({ id, name: s.name, gruppe: s.group }));
  const s = V.bester(wunsch, szenen);
  if (!s) return { ok: false, error: `Eine Hue-Szene „${wunsch}“ finde ich nicht.`, kein: true };
  const g = await hue("PUT", `/groups/${s.gruppe || "0"}/action`, { scene: s.id });
  return g.ok ? { ok: true, text: `Szene ${s.name}.` } : g;
}

// ---------- Neon-Licht beim Sprechen ----------
let vorher = null;      // gespeicherte Zustände der Lampen
let zurueckTimer = null;
let sprichtSeit = 0;
export async function sprechen(an) {
  const x = d();
  if (!hueBereit() || !x.sprechen) return { ok: true, aus: true };
  const gruppe = (x.raeume || []).find((r) => r.id === x.sprechen);
  const ids = gruppe ? gruppe.lampen : [];
  if (!ids.length) return { ok: true, aus: true };
  if (an) {
    clearTimeout(zurueckTimer);
    zurueckTimer = null;
    if (vorher) { sprichtSeit = Date.now(); return { ok: true }; }
    const st = await hue("GET", "/lights");
    if (!st.ok) return st;
    vorher = ids.map((id) => {
      const s = st.data?.[id]?.state || {};
      const z = { on: Boolean(s.on) };
      if (s.on) {
        z.bri = s.bri;
        if (s.colormode === "ct" && s.ct) z.ct = s.ct;
        else if (s.colormode === "xy" && s.xy) z.xy = s.xy;
        else if (s.hue != null) { z.hue = s.hue; z.sat = s.sat; }
      }
      return [id, z];
    });
    sprichtSeit = Date.now();
    await Promise.all(ids.map((id) => hue("PUT", `/lights/${id}/state`, { ...NEON, transitiontime: 2 })));
    // Sicherheitsnetz: nach spätestens 2 Minuten zurück, falls das Dashboard das Ende nicht meldet.
    zurueckTimer = setTimeout(() => sprechen(false), 120_000);
    return { ok: true };
  }
  // Kurz warten: spricht Friday gleich weiter (nächster Satz), bleibt das Licht an.
  clearTimeout(zurueckTimer);
  zurueckTimer = setTimeout(async () => {
    zurueckTimer = null;
    const alt = vorher;
    vorher = null;
    if (!alt) return;
    await Promise.all(alt.map(([id, z]) => hue("PUT", `/lights/${id}/state`, { ...z, transitiontime: 4 })));
  }, Number(process.env.HUE_ZURUECK_MS || 1500));
  return { ok: true };
}

// ---------- Einheitlicher Einstieg ----------
export async function command({ action, value, wo, wert } = {}) {
  const ort = wo || "";
  switch (String(action || "")) {
    case "an": return licht(ort || value, { on: true }, (n) => `${n} an.`);
    case "aus": return licht(ort || value, { on: false }, (n) => `${n} aus.`);
    case "helligkeit": {
      const p = Math.max(1, Math.min(100, Number(wert ?? value) || 50));
      return licht(ort, { on: true, bri: Math.round((p / 100) * 254) }, (n) => `${n} auf ${p} Prozent.`);
    }
    case "heller": return licht(ort || value, { on: true, bri_inc: 64 }, (n) => `${n} heller.`);
    case "dunkler": return licht(ort || value, { bri_inc: -64 }, (n) => `${n} dunkler.`);
    case "farbe": {
      const f = FARBEN[V.norm(wert ?? value).replace(/ /g, "")] || FARBEN[String(wert ?? value).toLowerCase()];
      if (!f) return { ok: false, error: `Die Farbe „${wert ?? value}“ kenne ich nicht. Ich kann ${Object.keys(FARBEN).filter((k) => !/ae|oe|ue|ss/.test(k)).slice(0, 12).join(", ")}.` };
      return licht(ort, { on: true, ...f, bri: 254 }, (n) => `${n} ${V.norm(wert ?? value)}.`);
    }
    case "neon": return licht(ort || value, { ...NEON }, (n) => `Neon-Modus: ${n} leuchten Orange.`);
    case "szene": return szene(value);
    case "raeume": {
      const r = await raeumeLaden();
      return { ok: true, text: r.length ? `Deine Hue-Räume: ${V.aufzaehlen(r.map((x) => x.name))}.` : "Bei Hue sind noch keine Räume angelegt.", raeume: r.map((x) => x.name) };
    }
    case "sprechen": return sprechen(value === true || value === "an" || value === "true");
    default: return { ok: false, error: "Unbekannte Hue-Aktion." };
  }
}

// ---------- Fenster "Verbindungen" ----------
export const info = { id: "hue", name: "Philips Hue", emoji: "💡", kurz: "Lampen per Sprache – und Neon-Orange, wenn Friday spricht." };

export async function status() {
  const x = d();
  const ein = hueBereit();
  return {
    ...info,
    eingerichtet: ein,
    text: ein ? `Gekoppelt mit Bridge ${x.ip} · ${(x.raeume || []).length} Räume${x.sprechen ? ` · Neon beim Sprechen: ${(x.raeume || []).find((r) => r.id === x.sprechen)?.name || "an"}` : ""}` : "Nicht eingerichtet. Drück den runden Knopf auf der Bridge und tipp dann auf Koppeln.",
    felder: ein ? [] : [{ name: "ip", label: "IP der Bridge (leer = automatisch suchen)", typ: "text", platzhalter: "z. B. 192.168.1.30", wert: x.ip || "" }],
    knopf: ein ? null : "Koppeln (Knopf auf der Bridge drücken)",
    auswahl: ein
      ? [{ name: "sprechen", label: "Neon-Orange, wenn Friday spricht", wert: x.sprechen || "", optionen: [{ wert: "", text: "Aus" }, ...(x.raeume || []).map((r) => ({ wert: r.id, text: r.name }))] }]
      : [],
    aktionen: ein ? [{ action: "neon", text: "🟠 Neon-Modus" }, { action: "an", text: "💡 Alle an" }, { action: "aus", text: "🌑 Alle aus" }, { action: "raeume", text: "↻ Räume laden" }] : [],
  };
}
export async function einrichten({ ip } = {}) {
  return koppeln(ip);
}
export async function einstellen({ name, wert } = {}) {
  if (name === "sprechen") {
    const ok = !wert || (d().raeume || []).some((r) => r.id === wert);
    if (!ok) return { ok: false, error: "Diesen Raum kenne ich nicht." };
    V.set("hue", { sprechen: wert || undefined });
    return { ok: true, text: wert ? "Die Lampen leuchten jetzt Neon-Orange, wenn ich spreche." : "Neon beim Sprechen ist aus." };
  }
  return { ok: false, error: "Unbekannte Einstellung." };
}
export function vergessen() {
  V.clear("hue");
  vorher = null;
  return { ok: true };
}
export const hueSprechenAn = () => hueBereit() && Boolean(d().sprechen);

// ---------- Sprachbefehle ohne Claude ----------
// kein:true in einem Ergebnis heißt: Hue kennt das Ziel nicht – dann darf Home Assistant es versuchen.
export async function quick(t) {
  if (!hueBereit()) return null;
  let m;
  const sag = (r) => (r.kein ? null : r.ok ? r.text : r.error);
  const LICHT = "(?:das |die |den )?(?:licht|lichter|lampen?|beleuchtung)";
  if ((m = t.match(/^(?:neon[- ]?modus|friday[- ]?licht|neonlicht|neon licht)(?: (?:im |in der |in )?(.+?))?(?: an| ein)?$/))) return sag(await command({ action: "neon", wo: m[1] || "" }));
  // "Licht an", "Licht im Wohnzimmer aus", "Mach das Licht in der Küche an", "Wohnzimmer Licht an", "Schalt alle Lampen aus"
  if ((m = t.match(new RegExp(`^(?:mach|mache|schalt|schalte|knips|knipse|dreh|drehe)?\\s?(?:bitte |mal )?(?:alle |überall |ueberall )?${LICHT}(?: (?:im|in der|in|vom|auf dem|am) (.+?))? (an|ein|aus)$`)))) {
    return sag(await command({ action: /an|ein/.test(m[2]) ? "an" : "aus", wo: m[1] || "" }));
  }
  if ((m = t.match(/^(?:mach |schalt |schalte )?(?:im |in der |in )?(.+?) ?(?:licht|lichter|lampen?) (an|ein|aus)$/))) {
    return sag(await command({ action: /an|ein/.test(m[2]) ? "an" : "aus", wo: m[1] }));
  }
  // Helligkeit
  if ((m = t.match(new RegExp(`^(?:stell |stelle |mach |dimm |dimme |setz |setze )?${LICHT}(?: (?:im|in der|in) (.+?))? (?:auf )?(\\d{1,3}) ?(?:prozent|%)$`)))) {
    return sag(await command({ action: "helligkeit", wo: m[1] || "", wert: Number(m[2]) }));
  }
  if ((m = t.match(new RegExp(`^(?:mach |mache )?${LICHT}(?: (?:im|in der|in) (.+?))? (heller|dunkler)$`))) || (m = t.match(new RegExp(`^(heller|dunkler)$`)))) {
    if (m.length === 2) return sag(await command({ action: m[1] === "heller" ? "heller" : "dunkler", wo: "" }));
    return sag(await command({ action: m[2] === "heller" ? "heller" : "dunkler", wo: m[1] || "" }));
  }
  // Farbe: "Licht blau", "Mach das Licht im Wohnzimmer rot", "Licht auf Orange"
  if ((m = t.match(new RegExp(`^(?:mach |mache |stell |stelle |färb |faerb )?${LICHT}(?: (?:im|in der|in) (.+?))? (?:auf |in )?([a-zäöüß]+)$`)))) {
    const farbe = m[2];
    if (FARBEN[farbe] || FARBEN[V.norm(farbe).replace(/ /g, "")]) return sag(await command({ action: "farbe", wo: m[1] || "", wert: farbe }));
  }
  // Szene
  if ((m = t.match(/^(?:hue[- ])?szene (.+?)(?: an| aktivieren| starten)?$/))) return sag(await szene(m[1]));
  return null;
}
