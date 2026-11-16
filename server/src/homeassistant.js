// Home Assistant: die Zentrale für Licht, Steckdosen, Heizung, Rollos und Sensoren.
// Adresse + "Langlebiges Zugangs-Token" im Dashboard (Verbindungen → Home Assistant) oder in der .env
// (HOME_ASSISTANT_URL, HOME_ASSISTANT_TOKEN). Läuft komplett im eigenen WLAN.
import { config } from "./config.js";
import * as V from "./verbindungen.js";

const d = () => V.get("homeassistant");
const url = () => String(d().url || config.haUrl || "").replace(/\/+$/, "");
const tok = () => String(d().token || config.haToken || "").trim();
export const haBereit = () => Boolean(url() && tok());

const DOMAINS = /^(light|switch|scene|script|cover|climate|fan|media_player|lock|input_boolean|sensor|binary_sensor|vacuum)\./;

async function ha(method, pfad, body, timeout = 10000) {
  if (!haBereit()) return { ok: false, error: "Home Assistant ist noch nicht eingerichtet. Werkzeug-Menü → Verbindungen → Home Assistant." };
  const r = await V.holeJson(`${url()}${pfad}`, { method, headers: { Authorization: `Bearer ${tok()}` }, body, timeout });
  if (r.netz) return { ok: false, error: "Home Assistant ist nicht erreichbar. Stimmt die Adresse und ist der Mac im selben WLAN?" };
  if (r.status === 401) return { ok: false, error: "Home Assistant lehnt das Token ab. Leg in deinem Profil ein neues langlebiges Token an." };
  if (!r.ok) return { ok: false, error: `Home Assistant meldet Fehler ${r.status}.` };
  return { ok: true, data: r.data };
}

let geraeteCache = { zeit: 0, liste: [] };
export async function geraete(frisch = false) {
  if (!frisch && Date.now() - geraeteCache.zeit < 30_000) return { ok: true, geraete: geraeteCache.liste };
  const r = await ha("GET", "/api/states");
  if (!r.ok) return r;
  const liste = (Array.isArray(r.data) ? r.data : [])
    .filter((s) => DOMAINS.test(s.entity_id))
    .map((s) => ({
      id: s.entity_id,
      domain: s.entity_id.split(".")[0],
      name: String(s.attributes?.friendly_name || s.entity_id.split(".")[1].replace(/_/g, " ")),
      status: s.state,
      einheit: s.attributes?.unit_of_measurement || "",
      klasse: s.attributes?.device_class || "",
      ziel: s.attributes?.temperature,
      ist: s.attributes?.current_temperature,
    }));
  geraeteCache = { zeit: Date.now(), liste };
  return { ok: true, geraete: liste };
}

// Passendes Gerät zu einem gesprochenen Namen. Bevorzugt Domains passend zum Wort ("Licht" -> light).
function finde(liste, wunsch, domains = null) {
  let w = String(wunsch || "").trim();
  const pool = domains ? liste.filter((g) => domains.includes(g.domain)) : liste;
  return V.bester(w, pool, (g) => g.name, 0.5) || V.bester(w, pool, (g) => g.id.split(".")[1].replace(/_/g, " "), 0.6);
}

function domainsFuer(wort) {
  const w = V.norm(wort);
  if (/\b(licht|lampe|lampen|leuchte|beleuchtung|led|deckenlicht|stehlampe)\b/.test(w)) return ["light", "switch"];
  if (/\b(steckdose|stecker|schalter)\b/.test(w)) return ["switch", "input_boolean"];
  if (/\b(heizung|thermostat|klima|klimaanlage)\b/.test(w)) return ["climate"];
  if (/\b(rollo|rollos|rolladen|rollladen|jalousie|markise|vorhang|tor|garagentor)\b/.test(w)) return ["cover"];
  if (/\b(ventilator|luefter)\b/.test(w)) return ["fan"];
  if (/\b(schloss|tuer|haustuer)\b/.test(w)) return ["lock"];
  if (/\b(sauger|staubsauger|saugroboter)\b/.test(w)) return ["vacuum"];
  return null;
}
// "Licht im Wohnzimmer" -> "Wohnzimmer"
const ohneArt = (w) => V.norm(w).replace(/\b(das|die|der|den|im|in der|in|vom|von|licht|lampe|lampen|leuchte|steckdose|heizung|rollo|rollladen|rolladen|jalousie)\b/g, " ").replace(/\s+/g, " ").trim();

async function dienst(domain, service, data) {
  const r = await ha("POST", `/api/services/${domain}/${service}`, data);
  geraeteCache.zeit = 0;
  return r;
}

export async function schalten(wunsch, an) {
  const g0 = await geraete();
  if (!g0.ok) return g0;
  const doms = domainsFuer(wunsch);
  const g = g0.geraete.find((x) => x.id === wunsch) || finde(g0.geraete, wunsch, doms) || (doms ? finde(g0.geraete, ohneArt(wunsch), doms) : null) || finde(g0.geraete, wunsch, ["light", "switch", "fan", "input_boolean", "media_player", "scene", "script", "cover"]);
  if (!g) return { ok: false, error: `In Home Assistant finde ich kein Gerät „${wunsch}“.` };
  let r;
  if (g.domain === "scene" || g.domain === "script") r = await dienst(g.domain, "turn_on", { entity_id: g.id });
  else if (g.domain === "cover") r = await dienst("cover", an ? "open_cover" : "close_cover", { entity_id: g.id });
  else if (g.domain === "lock") return { ok: false, error: "Schlösser schalte ich aus Sicherheitsgründen nicht per Sprache." };
  else r = await dienst("homeassistant", an === "toggle" ? "toggle" : an ? "turn_on" : "turn_off", { entity_id: g.id });
  if (!r.ok) return r;
  const was = g.domain === "scene" ? `Szene ${g.name} aktiviert.` : g.domain === "cover" ? `${g.name} ${an ? "geht hoch" : "geht runter"}.` : `${g.name} ${an === "toggle" ? "umgeschaltet" : an ? "ist an" : "ist aus"}.`;
  return { ok: true, text: was, geraet: g.id };
}

export async function helligkeit(wunsch, prozent) {
  const g0 = await geraete();
  if (!g0.ok) return g0;
  const g = finde(g0.geraete, wunsch, ["light"]) || finde(g0.geraete, ohneArt(wunsch), ["light"]);
  if (!g) return { ok: false, error: `Ich finde kein Licht „${wunsch}“.` };
  const p = Math.max(1, Math.min(100, Math.round(prozent)));
  const r = await dienst("light", "turn_on", { entity_id: g.id, brightness_pct: p });
  return r.ok ? { ok: true, text: `${g.name} auf ${p} Prozent.` } : r;
}

export async function temperatur(wunsch, grad) {
  const g0 = await geraete();
  if (!g0.ok) return g0;
  const heizungen = g0.geraete.filter((g) => g.domain === "climate");
  const g = (wunsch && (finde(heizungen, wunsch) || finde(heizungen, ohneArt(wunsch)))) || (heizungen.length === 1 ? heizungen[0] : null);
  if (!g) return { ok: false, error: heizungen.length ? `Welche Heizung? Ich kenne ${V.aufzaehlen(heizungen.map((h) => h.name))}.` : "In Home Assistant ist keine Heizung angelegt." };
  const t = Math.max(5, Math.min(30, Number(grad)));
  const r = await dienst("climate", "set_temperature", { entity_id: g.id, temperature: t });
  return r.ok ? { ok: true, text: `${g.name} auf ${String(t).replace(".", ",")} Grad.` } : r;
}

export async function wert(wunsch) {
  const g0 = await geraete();
  if (!g0.ok) return g0;
  const raum = ohneArt(wunsch);
  const temp = g0.geraete.filter((g) => (g.domain === "sensor" && g.klasse === "temperature") || g.domain === "climate");
  const g = finde(temp, raum || wunsch) || (temp.length === 1 ? temp[0] : null);
  if (!g) return { ok: false, error: `Für „${wunsch}“ finde ich keinen Temperatur-Sensor.` };
  const v = g.domain === "climate" ? g.ist : g.status;
  if (v == null || v === "unavailable" || v === "unknown") return { ok: false, error: `${g.name} liefert gerade keinen Wert.` };
  return { ok: true, text: `${g.name}: ${String(v).replace(".", ",")} ${g.einheit || "Grad"}`.replace("°C", "Grad").trim() + "." };
}

// ---------- Einheitlicher Einstieg ----------
export async function command({ action, value, entity_id: eid, wert: w } = {}) {
  // Alte Werkzeug-Namen (turn_on/turn_off/toggle/list) weiter unterstützen.
  const a = { turn_on: "an", turn_off: "aus", toggle: "umschalten", list: "liste" }[action] || action;
  const name = value || eid;
  switch (a) {
    case "liste": {
      const r = await geraete(true);
      if (!r.ok) return r;
      return { ok: true, geraete: r.geraete.filter((g) => g.domain !== "sensor" && g.domain !== "binary_sensor").slice(0, 80).map((g) => ({ id: g.id, name: g.name, status: g.status })) };
    }
    case "an": return schalten(name, true);
    case "aus": return schalten(name, false);
    case "umschalten": return schalten(name, "toggle");
    case "helligkeit": return helligkeit(name, Number(w));
    case "temperatur": return temperatur(name, Number(w));
    case "wert": return wert(name);
    default: return { ok: false, error: "Unbekannte Home-Assistant-Aktion." };
  }
}

// ---------- Fenster "Verbindungen" ----------
export const info = { id: "homeassistant", name: "Home Assistant", emoji: "🏠", kurz: "Licht, Steckdosen, Heizung, Rollos und Sensoren im ganzen Zuhause." };

export async function status() {
  const x = d();
  const ein = haBereit();
  let text = "Nicht eingerichtet.";
  if (ein) {
    const g = await geraete().catch(() => null);
    text = g?.ok ? `Verbunden mit ${url()} · ${g.geraete.filter((y) => !/sensor/.test(y.domain)).length} Geräte` : `Eingetragen, aber ${g?.error || "nicht erreichbar"}`;
  }
  return {
    ...info,
    eingerichtet: ein,
    text,
    quelle: x.token ? "dashboard" : config.haToken ? "env" : null,
    felder: ein ? [] : [
      { name: "url", label: "Adresse", typ: "text", platzhalter: "http://homeassistant.local:8123", wert: x.url || config.haUrl || "" },
      { name: "token", label: "Langlebiges Zugangs-Token", typ: "password", platzhalter: "eyJ…" },
    ],
    auswahl: [],
    aktionen: ein ? [{ action: "liste", text: "📋 Geräte anzeigen" }] : [],
  };
}

export async function einrichten({ url: u, token: t } = {}) {
  let adr = String(u || "").trim().replace(/\/+$/, "");
  if (adr && !/^https?:\/\//.test(adr)) adr = `http://${adr}`;
  if (!/^https?:\/\/[^\s/]+(:\d+)?$/.test(adr)) return { ok: false, error: "Die Adresse sieht so aus: http://homeassistant.local:8123 oder http://192.168.1.20:8123" };
  const tk = String(t || "").trim();
  if (!V.schluesselOk(tk, 30, 1000)) return { ok: false, error: "Das Token ist sehr lang (beginnt meist mit eyJ). Kopier es nochmal komplett." };
  const r = await V.holeJson(`${adr}/api/`, { headers: { Authorization: `Bearer ${tk}` }, timeout: 8000 });
  if (r.netz) return { ok: false, error: `Unter ${adr} antwortet kein Home Assistant. Stimmt die Adresse?` };
  if (r.status === 401) return { ok: false, error: "Home Assistant lehnt das Token ab." };
  if (!r.ok) return { ok: false, error: `Home Assistant meldet Fehler ${r.status}.` };
  V.set("homeassistant", { url: adr, token: tk });
  geraeteCache.zeit = 0;
  const g = await geraete(true);
  return { ok: true, text: `Home Assistant ist verbunden${g.ok ? ` – ${g.geraete.filter((y) => !/sensor/.test(y.domain)).length} Geräte gefunden` : ""}.` };
}
export async function einstellen() {
  return { ok: false, error: "Unbekannte Einstellung." };
}
export function vergessen() {
  V.clear("homeassistant");
  geraeteCache.zeit = 0;
  return { ok: true };
}

// ---------- Sprachbefehle ohne Claude ----------
// Gibt null zurück, wenn der Satz nicht nach Zuhause-Steuerung klingt oder kein Gerät passt (dann versucht es der Nächste).
export async function quick(t) {
  if (!haBereit()) return null;
  let m;
  const sag = (r) => (r.ok ? r.text : r.error);
  // Heizung
  if ((m = t.match(/^(?:stell |stelle |mach |dreh |setz |setze )?(?:die )?(heizung|thermostat|klima(?:anlage)?)(?: (?:im |in der |in |vom )?(.+?))? (?:auf )?(\d{1,2}(?:[.,]5)?) grad$/))) {
    return sag(await temperatur(m[2] || "", Number(m[3].replace(",", "."))));
  }
  if ((m = t.match(/^(?:stell |stelle |mach |dreh |setz |setze )?(?:die )?(?:heizung|thermostat) (?:im |in der |in )?(.+?) (?:auf )?(\d{1,2}(?:[.,]5)?) grad$/))) {
    return sag(await temperatur(m[1], Number(m[2].replace(",", "."))));
  }
  // Temperatur abfragen
  if ((m = t.match(/^wie (?:warm|kalt) ist es (?:im |in der |in )(.+)$|^(?:temperatur|wie viel grad hat es|wieviel grad hat es|wie viel grad sind) (?:im |in der |in )(.+)$/))) {
    const r = await wert(m[1] || m[2]);
    return r.ok ? r.text : null;
  }
  // Helligkeit
  if ((m = t.match(/^(?:stell |stelle |mach |dimm |dimme |setz |setze )?(?:das |die |den )?(.+?) (?:auf )?(\d{1,3}) ?(?:prozent|%)$/)) && domainsFuer(m[1])?.includes("light")) {
    const r = await helligkeit(m[1], Number(m[2]));
    return r.ok ? r.text : null;
  }
  // Rollos
  if ((m = t.match(/^(?:mach |fahr |fahre |zieh |ziehe )?(?:das |die |den )?(.+?) (hoch|rauf|auf|runter|herunter|zu)$/)) && domainsFuer(m[1])?.includes("cover")) {
    return sag(await schalten(m[1], /hoch|rauf|auf/.test(m[2])));
  }
  // Szene
  if ((m = t.match(/^(?:aktiviere |starte |start )?(?:die )?szene (.+?)(?: an| aktivieren| starten)?$/))) {
    const g0 = await geraete();
    if (!g0.ok) return null;
    const g = finde(g0.geraete, m[1], ["scene", "script"]);
    if (!g) return null;
    return sag(await schalten(g.id, true));
  }
  // An/aus: "Mach das Licht im Wohnzimmer an", "Schalte die Kaffeemaschine aus", "Wohnzimmerlicht an", "Steckdose Fernseher aus"
  if ((m = t.match(/^(?:bitte )?(?:mach|mache|schalt|schalte|dreh|drehe|knips|knipse)?\s?(?:mal |bitte )?(?:das |die |den )?(.+?) (an|ein|aus|ab|um)$/))) {
    const wunsch = m[1].trim();
    if (!wunsch || wunsch.split(" ").length > 6) return null;
    if (/^(alles|alle|es|ihn|sie|das)$/.test(wunsch)) return null;
    const g0 = await geraete();
    if (!g0.ok) return domainsFuer(wunsch) ? g0.error : null;
    const doms = domainsFuer(wunsch);
    const g = finde(g0.geraete, wunsch, doms || ["light", "switch", "fan", "input_boolean", "media_player", "scene", "script"]) || (doms ? finde(g0.geraete, ohneArt(wunsch), doms) : null);
    if (!g) return null; // vielleicht ein Hue-Raum oder ein Mac-Befehl
    const an = m[2] === "um" ? "toggle" : /an|ein/.test(m[2]);
    return sag(await schalten(g.id, an));
  }
  return null;
}
