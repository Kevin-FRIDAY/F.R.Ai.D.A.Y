// iPhone-Widget (v1.160.0, Wunsch aus der Ideen-Schmiede).
// Friday-Kachel auf dem Home-Bildschirm über die kostenlose App "Scriptable": Wetter, nächster Termin,
// Einkaufsliste, offene Aufgaben, nächster Geburtstag, Unwetter-Warnung und Paket-Status.
// GET /api/widget/daten liefert die Werte (auch mit dem Kurzbefehl-Schlüssel, damit das Widget ohne
// Anmeldung im Hintergrund laden kann). Das fertige Scriptable-Skript baut das Dashboard (Fenster Wunschliste
// → Widget → Skript kopieren) mit der richtigen Adresse und dem Schlüssel.
import * as store from "./store.js";
import { config } from "./config.js";
import { getWeather } from "./tools.js";
import * as kalender from "./kalender.js";
import * as geb from "./geburtstage.js";
import * as unwetter from "./unwetter.js";
import * as pakete from "./pakete.js";
import { uhrzeit } from "./wunsch-hilfe.js";

export async function daten() {
  const [wetter, termin, warn] = await Promise.all([
    getWeather(config.city).catch(() => null),
    (async () => {
      if (!kalender.kalenderBereit()) return null;
      const r = await kalender.termine(0, 2).catch(() => null);
      const jetzt = Date.now();
      const t = r?.ok ? r.termine.find((x) => !x.ganz && +x.ende > jetzt) || r.termine[0] : null;
      return t ? { titel: t.titel, zeit: t.ganz ? "ganztägig" : uhrzeit(t.start), heute: new Date(t.start).toDateString() === new Date().toDateString() } : null;
    })().catch(() => null),
    unwetter.warnungen().catch(() => null),
  ]);
  const einkauf = store.getShopping().filter((x) => !x.done).map((x) => x.text);
  const aufgaben = store.getTasks().filter((x) => !x.done).map((x) => x.text);
  const g = geb.kommende(30)[0];
  const paket = pakete.liste().find((p) => p.status && p.status.code !== "delivered");
  return {
    stand: new Date().toISOString(),
    name: config.userName,
    wetter: wetter && !wetter.error ? { ort: wetter.ort, grad: Math.round(wetter.jetzt.temperatur), text: wetter.jetzt.wetter, max: Math.round(wetter.tage?.[0]?.max ?? 0), min: Math.round(wetter.tage?.[0]?.min ?? 0) } : null,
    termin,
    einkauf: { anzahl: einkauf.length, erste: einkauf.slice(0, 3) },
    aufgaben: { anzahl: aufgaben.length, erste: aufgaben.slice(0, 2) },
    geburtstag: g ? { name: g.name, tage: g.tage } : null,
    warnung: warn?.warnungen?.[0] ? { text: warn.warnungen[0].ereignis || warn.warnungen[0].titel, farbe: warn.warnungen[0].farbe } : null,
    paket: paket ? { name: paket.name, text: paket.status.text } : null,
  };
}

/** Das fertige Skript für Scriptable (Adresse + Schlüssel werden eingesetzt). */
export function skript({ adresse, schluessel }) {
  const a = JSON.stringify(String(adresse || "").replace(/\/+$/, ""));
  const k = JSON.stringify(String(schluessel || ""));
  return `// F.R.Ai.D.A.Y Widget (Scriptable) – v1.160.0
// In Scriptable: + → Skript einfügen → Name "Friday". Dann Home-Bildschirm → Widget → Scriptable → Skript "Friday".
const FRIDAY = ${a};
const SCHLUESSEL = ${k};
const ORANGE = new Color("#ff8a2a"), WEISS = new Color("#ffffff"), GRAU = new Color("#ffffff", 0.6), ROT = new Color("#ff4a3a");
async function laden() {
  const r = new Request(FRIDAY + "/api/widget/daten");
  r.headers = { Authorization: "Bearer " + SCHLUESSEL };
  r.timeoutInterval = 15;
  const d = await r.loadJSON();
  Keychain.set("friday_widget", JSON.stringify(d));
  return d;
}
let d;
try { d = await laden(); } catch (e) { d = Keychain.contains("friday_widget") ? JSON.parse(Keychain.get("friday_widget")) : null; }
const w = new ListWidget();
const bg = new LinearGradient(); bg.colors = [new Color("#0b0603"), new Color("#1d0f05")]; bg.locations = [0, 1]; w.backgroundGradient = bg;
w.setPadding(12, 14, 12, 14);
w.url = FRIDAY;
const kopf = w.addStack(); kopf.centerAlignContent();
const titel = kopf.addText("F.R.Ai.D.A.Y"); titel.font = Font.boldSystemFont(12); titel.textColor = ORANGE;
kopf.addSpacer();
if (d && d.wetter) { const t = kopf.addText(d.wetter.grad + "° " + d.wetter.text); t.font = Font.mediumSystemFont(12); t.textColor = WEISS; }
w.addSpacer(6);
function zeile(symbol, text, farbe) { const s = w.addStack(); s.centerAlignContent(); const i = s.addText(symbol + "  "); i.font = Font.systemFont(12); const t = s.addText(text); t.font = Font.systemFont(12); t.textColor = farbe || WEISS; t.lineLimit = 1; w.addSpacer(3); }
if (!d) zeile("⚠️", "Friday nicht erreichbar", ROT);
else {
  if (d.warnung) zeile("⛈", d.warnung.text, ROT);
  if (d.termin) zeile("📅", (d.termin.heute ? "" : "Morgen ") + d.termin.zeit + " " + d.termin.titel);
  else zeile("📅", "Keine Termine", GRAU);
  zeile("🛒", d.einkauf.anzahl ? d.einkauf.anzahl + " auf der Liste: " + d.einkauf.erste.join(", ") : "Einkaufsliste leer", d.einkauf.anzahl ? WEISS : GRAU);
  if (config.widgetFamily !== "small") {
    if (d.aufgaben.anzahl) zeile("✅", d.aufgaben.anzahl + " offen: " + d.aufgaben.erste.join(", "));
    if (d.paket) zeile("📦", d.paket.name + ": " + d.paket.text);
    if (d.geburtstag) zeile("🎂", d.geburtstag.name + (d.geburtstag.tage === 0 ? " heute!" : d.geburtstag.tage === 1 ? " morgen" : " in " + d.geburtstag.tage + " Tagen"));
  }
}
w.addSpacer();
const fuss = w.addText(d ? "Stand " + new Date(d.stand).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ""); fuss.font = Font.systemFont(9); fuss.textColor = GRAU;
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium();
Script.complete();
`;
}
