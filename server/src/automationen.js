// Automatisierungszentrale: "Wenn … dann …"-Regeln, die Programme und Dienste verknüpfen.
// Auslöser: täglich zu einer Uhrzeit (an bestimmten Wochentagen), alle N Minuten, beim Start von Friday.
// Aktionen: Friday einen Auftrag geben, Mitteilung schicken, Protokoll starten, Aufgabe anlegen, Mission starten.
// Alles läuft durch den Autonomie-Regler (Freigaben) und stoppt im Notfallmodus.
// Gespeichert in server/data/automationen.json.
import { config, IST_EVE } from "./config.js";
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";
import { notfallAktiv } from "./kommando.js";
import { notifyAll } from "./notify.js";
import { runTool } from "./tools.js";
import * as missionen from "./missionen.js";

const NAME = "automationen";
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const AUSLOESER = { taeglich: "Täglich um …", intervall: "Alle … Minuten", start: "Wenn Friday startet" };
export const AKTIONEN = { friday: "Friday einen Auftrag geben", mitteilung: "Mitteilung aufs Handy", protokoll: "Protokoll starten", aufgabe: "Aufgabe anlegen", mission: "Mission starten", agent: "Agenten losschicken (24/7)", haus: "Smart-Home-Gerät schalten" };
const TAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
let askFn = null;
const laufend = new Set();

function alle() { return store.load(NAME, []); }
function speichern(l) { store.save(NAME, l.slice(-100)); }

function pruefen(r = {}) {
  const a = r.ausloeser || {}, x = r.aktion || {};
  if (!AUSLOESER[a.art]) return "Unbekannter Auslöser.";
  if (a.art === "taeglich" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(a.zeit || ""))) return "Uhrzeit bitte als HH:MM.";
  if (a.art === "intervall" && !(Number(a.minuten) >= 15 && Number(a.minuten) <= 10080)) return "Intervall: mindestens 15 Minuten.";
  if (!AKTIONEN[x.art]) return "Unbekannte Aktion.";
  if (x.art === "protokoll" ? !String(x.name || "").trim() : !String(x.text || "").trim()) return "Bei der Aktion fehlt der Text.";
  return "";
}

export function liste() {
  return { regeln: alle(), ausloeser: AUSLOESER, aktionen: AKTIONEN, notfall: notfallAktiv() };
}

export function speichereRegel(r = {}) {
  const fehler = pruefen(r);
  if (fehler) return { error: fehler };
  const l = alle();
  const alt = r.id && l.find((x) => x.id === r.id);
  const regel = {
    id: alt?.id || neueId(),
    name: String(r.name || "").trim().slice(0, 80) || beschreibe(r),
    an: r.an !== false,
    ausloeser: {
      art: r.ausloeser.art,
      ...(r.ausloeser.art === "taeglich" ? { zeit: r.ausloeser.zeit, tage: (Array.isArray(r.ausloeser.tage) ? r.ausloeser.tage : [0, 1, 2, 3, 4, 5, 6]).map(Number).filter((t) => t >= 0 && t <= 6) } : {}),
      ...(r.ausloeser.art === "intervall" ? { minuten: Math.round(Number(r.ausloeser.minuten)) } : {}),
    },
    aktion: { art: r.aktion.art, ...(r.aktion.art === "protokoll" ? { name: String(r.aktion.name).slice(0, 80) } : { text: String(r.aktion.text).slice(0, 1500) }), ...(r.aktion.art === "agent" ? { eingabe: String(r.aktion.eingabe || "").slice(0, 300), melden: ["immer", "fehler", "nie"].includes(r.aktion.melden) ? r.aktion.melden : "fehler" } : {}), ...(r.aktion.art === "haus" ? { schalten: r.aktion.schalten === "aus" ? "aus" : "an" } : {}) },
    erstellt: alt?.erstellt || new Date().toISOString(),
    zuletzt: alt?.zuletzt || null,
    ergebnis: alt?.ergebnis || "",
  };
  speichern(alt ? l.map((x) => (x.id === regel.id ? regel : x)) : [...l, regel]);
  eintragen({ bereich: "system", titel: `Automation ${alt ? "geändert" : "angelegt"}: ${regel.name}`, quelle: "dashboard" });
  return { ok: true, regel };
}

export function loeschen(id) {
  speichern(alle().filter((x) => x.id !== id));
  return { ok: true };
}
export function schalten(id, an) {
  const l = alle();
  const r = l.find((x) => x.id === id);
  if (!r) return { error: "Regel nicht gefunden." };
  r.an = Boolean(an);
  speichern(l);
  return { ok: true, regel: r };
}

export function beschreibe(r) {
  const a = r.ausloeser || {}, x = r.aktion || {};
  const wann = a.art === "taeglich" ? `${(a.tage?.length && a.tage.length < 7) ? a.tage.map((t) => TAGE[t]).join(", ") : "Täglich"} ${a.zeit}` : a.art === "intervall" ? `Alle ${a.minuten} Min.` : "Beim Start";
  const was = x.art === "protokoll" ? `Protokoll „${x.name}“` : `${AKTIONEN[x.art] || x.art}: ${String(x.text || "").slice(0, 40)}`;
  return `${wann} → ${was}`;
}

async function ausfuehren(r, grund = "") {
  if (laufend.has(r.id)) return { error: "Läuft schon." };
  if (notfallAktiv()) return { error: "Notfallmodus ist an." };
  // Schattenmodus (v1.185.0): Selbst Ausgelöstes nur aufschreiben, nicht ausführen. "Von Hand gestartet" läuft normal.
  if (grund !== "Von Hand gestartet") {
    const S = await import("./schatten.js");
    if (S.an()) {
      S.notiere("Automation", `„${r.name}“ ausführen (${beschreibe(r)})`, grund);
      const l = alle(); const r2 = l.find((y) => y.id === r.id);
      if (r2) { r2.zuletzt = new Date().toISOString(); r2.ergebnis = "Schattenmodus: nur aufgeschrieben, nicht ausgeführt."; speichern(l); }
      return { ok: true, ergebnis: "Schattenmodus: nur aufgeschrieben." };
    }
  }
  laufend.add(r.id);
  let ergebnis = "", ok = true;
  try {
    const x = r.aktion;
    if (x.art === "friday") {
      if (!askFn) throw new Error("Friday startet noch.");
      const res = await askFn({ text: `[Automation „${r.name}“ – automatisch ausgelöst, nicht live mit Boss] ${x.text}`, channel: "automation", keepHistory: false });
      ergebnis = res.answer; ok = !res.fehler;
      if (ok && ergebnis) await notifyAll(r.name, ergebnis).catch(() => {});
    } else if (x.art === "mitteilung") {
      await notifyAll("F.R.Ai.D.A.Y", x.text);
      ergebnis = "Mitteilung geschickt.";
    } else if (x.art === "protokoll") {
      const res = await runTool("run_protocol", { name: x.name }, { kanal: "automation", grund: `Automation „${r.name}“` });
      ok = !res?.error; ergebnis = res?.error || res?.info || "Protokoll ausgeführt.";
    } else if (x.art === "aufgabe") {
      store.addTask(x.text);
      ergebnis = "Aufgabe angelegt.";
    } else if (x.art === "agent") {
      // 24/7-Missionszentrale (v1.180.0): Agent nach Zeitplan, Kontroll-Agent prüft, gemeldet wird nach Wunsch.
      const { losschicken } = await import("./agentenleitung.js");
      const b = await losschicken(x.text, x.eingabe || "", { kanal: "automation" });
      ok = b.ok !== false && b.pruefung?.status !== "fehler";
      ergebnis = `${b.text || ""}${!ok && b.pruefung?.gruende?.length ? ` (Kontroll-Agent: ${b.pruefung.gruende.join("; ")})` : ""}`;
      if (x.melden === "immer" || (x.melden !== "nie" && !ok)) await notifyAll(ok ? r.name : `⚠ ${r.name}`, ergebnis.slice(0, 600), { art: "agent" }).catch(() => {});
    } else if (x.art === "haus") {
      // Smart Home Intelligence (v1.182.0): von Kevin angenommene Gewohnheit. Schlösser nie.
      if (String(x.text).startsWith("lock.")) throw new Error("Schlösser schaltet Friday nie automatisch.");
      const H = await import("./homeassistant.js");
      const res = await H.schalten(x.text, x.schalten !== "aus");
      ok = res.ok; ergebnis = res.ok ? res.text : res.error;
      if (!ok) await notifyAll(`⚠ ${r.name}`, ergebnis).catch(() => {});
    } else if (x.art === "mission") {
      const m = await missionen.neu({ ziel: x.text, titel: x.text.slice(0, 80) });
      ok = !m.error; ergebnis = m.error || `Mission „${m.mission.titel}“ in der Warteschlange.`;
    }
  } catch (err) {
    ok = false; ergebnis = err.message;
  } finally {
    laufend.delete(r.id);
  }
  const l = alle();
  const r2 = l.find((y) => y.id === r.id);
  if (r2) { r2.zuletzt = new Date().toISOString(); r2.ergebnis = String(ergebnis || "").slice(0, 600); r2.ok = ok; speichern(l); }
  eintragen({ bereich: "system", titel: `Automation: ${r.name}`, details: `${grund ? `${grund}. ` : ""}${ergebnis || ""}`, ok, kanal: "automation", quelle: "automatisch" });
  return { ok, ergebnis };
}

export async function jetztAusfuehren(id) {
  const r = alle().find((x) => x.id === id);
  if (!r) return { error: "Regel nicht gefunden." };
  return ausfuehren(r, "Von Hand gestartet");
}

function faellig(r, jetzt) {
  const a = r.ausloeser;
  const zuletzt = r.zuletzt ? new Date(r.zuletzt).getTime() : 0;
  if (a.art === "intervall") return jetzt - zuletzt >= a.minuten * 60 * 1000;
  if (a.art === "taeglich") {
    const lokal = new Date(jetzt).toLocaleString("sv-SE", { timeZone: config.timezone });
    const [tag, zeit] = lokal.split(" ");
    const wochentag = new Date(`${tag}T12:00:00`).getDay();
    if (!a.tage.includes(wochentag) || zeit.slice(0, 5) < a.zeit) return false;
    const zuletztTag = zuletzt ? new Date(zuletzt).toLocaleString("sv-SE", { timeZone: config.timezone }).slice(0, 10) : "";
    // Nur am selben Tag nachholen und höchstens 2 Stunden zu spät (z. B. nach einem Neustart).
    const [h, m] = a.zeit.split(":").map(Number);
    const [hn, mn] = zeit.slice(0, 5).split(":").map(Number);
    return zuletztTag !== tag && (hn * 60 + mn) - (h * 60 + m) <= 120;
  }
  return false;
}

async function tick() {
  if (notfallAktiv()) return;
  const jetzt = Date.now();
  for (const r of alle()) if (r.an && r.ausloeser.art !== "start" && faellig(r, jetzt)) await ausfuehren(r, "Zeitplan");
}

export function automationenStart(ask) {
  askFn = ask;
  if (IST_EVE) return; // Eve: Automationen laufen nur von Hand (sonst liefe alles doppelt und kostet doppelt)
  setTimeout(() => {
    if (notfallAktiv()) return;
    for (const r of alle()) if (r.an && r.ausloeser.art === "start") ausfuehren(r, "Friday ist gestartet").catch(() => {});
  }, 3 * 60 * 1000);
  setInterval(() => tick().catch((e) => console.error("Automationen:", e.message)), 30 * 1000);
}
