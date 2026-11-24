// Abend-Rückblick (v1.160.0, Wunsch aus der Ideen-Schmiede).
// Um 21 Uhr (einstellbar) fasst Friday den Tag zusammen – nur aus Fridays eigener Datenbank, ohne Claude:
// erledigt (Logbuch), offen (Aufgaben, Pinnwand), morgen wichtig (Termine, Erinnerungen, Geburtstage, Wetter).
// Kommt per Telegram/Push (nur Friday) und steht im Fenster Wunschliste. "Friday, wie war mein Tag?"
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { config, IST_EVE } from "./config.js";
import { U } from "./datum.js";
import { getWeather } from "./tools.js";
import * as kalender from "./kalender.js";
import * as geb from "./geburtstage.js";
import * as familie from "./familie.js";
import { tagStr, uhrJetzt, uhrzeit, sauber } from "./wunsch-hilfe.js";

const DATEI = "rueckblick";
export const einstellungen = () => ({ an: true, stunde: 21, ...(store.load(DATEI, {}).einstellungen || {}) });
export function einstellen(e = {}) {
  const d = store.load(DATEI, {});
  const alt = einstellungen();
  const h = Number(e.stunde);
  d.einstellungen = { an: e.an ?? alt.an, stunde: Number.isInteger(h) && h >= 15 && h <= 23 ? h : alt.stunde };
  store.save(DATEI, d);
  return d.einstellungen;
}
export const verlauf = () => (store.load(DATEI, {}).liste || []).slice().reverse();

const zahlWort = (n) => ["keine", "eine", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn"][n] || String(n);

/** Baut den Rückblick für heute. */
export async function bauen() {
  const heute = tagStr();
  const lb = logbuch.tag({ tag: heute, limit: 2000 });
  const eintraege = lb.eintraege || [];
  const erledigt = eintraege.filter((e) => /^Aufgabe erledigt: /.test(e.titel)).map((e) => e.titel.replace(/^Aufgabe erledigt: /, ""));
  const gekauft = eintraege.filter((e) => e.bereich === "einkauf" && /eingekauft|abgehakt|gekauft/i.test(e.titel)).length;
  let gespraeche = 0;
  try { gespraeche = store.leseArchiv().filter((e) => String(e.at || "").startsWith(heute) || tagStr(0, Date.parse(e.at)) === heute).length; } catch { /* egal */ }
  const offeneAufgaben = store.getTasks().filter((t) => !t.done).map((t) => t.text);
  const morgen = tagStr(1);
  const erinnerungen = store.getReminders().filter((r) => !r.done && r.due && tagStr(0, Date.parse(r.due)) === morgen).map((r) => `${uhrzeit(r.due)} ${r.text}`);
  let termine = [];
  try { if (kalender.kalenderBereit()) { const r = await kalender.termine(1, 1); if (r.ok) termine = r.termine.map((t) => (t.ganz ? t.titel : `${uhrzeit(t.start)} ${t.titel}`)); } } catch { /* Mac aus */ }
  const geburtstage = geb.kommende(1).map((e) => `${e.name}${e.tage === 0 ? " (heute)" : " (morgen)"}`);
  const pinnwand = familie.stand().pinnwand.filter((x) => !x.erledigt).slice(0, 5).map((x) => x.text);
  let wetter = null;
  try { const w = await getWeather(config.city); const t = w.tage?.[1]; if (t) wetter = { ort: w.ort, text: t.wetter, max: Math.round(t.max), min: Math.round(t.min), regen: t.regen_prozent }; } catch { /* egal */ }

  const s = [];
  s.push(`Dein Tag in Kürze: ${gespraeche ? `Wir haben ${gespraeche === 1 ? "einmal" : `${gespraeche}-mal`} gesprochen` : "Heute haben wir nicht gesprochen"}${lb.gesamt ? (lb.gesamt === 1 ? ", im Logbuch steht ein Eintrag" : `, im Logbuch stehen ${lb.gesamt} Einträge`) : ""}.`);
  if (erledigt.length) s.push(`Erledigt: ${erledigt.slice(0, 4).join(", ")}${erledigt.length > 4 ? ` und ${erledigt.length - 4} mehr` : ""}.`);
  if (offeneAufgaben.length) s.push(`Noch offen sind ${zahlWort(offeneAufgaben.length)} ${offeneAufgaben.length === 1 ? "Aufgabe" : "Aufgaben"}, zum Beispiel ${offeneAufgaben.slice(0, 2).join(" und ")}.`);
  const mrg = [...termine.slice(0, 4), ...erinnerungen.slice(0, 3)];
  if (mrg.length) s.push(`Morgen wichtig: ${mrg.join(", ")}.`);
  else s.push("Morgen steht nichts Festes an.");
  if (geburtstage.length) s.push(`Geburtstag: ${geburtstage.join(", ")}.`);
  if (wetter) s.push(`Wetter morgen in ${wetter.ort}: ${wetter.text}, ${wetter.min} bis ${wetter.max} Grad${wetter.regen >= 40 ? `, ${wetter.regen} Prozent Regenrisiko – Schirm einpacken` : ""}.`);
  if (pinnwand.length) s.push(`An der Pinnwand: ${pinnwand.slice(0, 2).join(", ")}.`);
  s.push("Schlaf gut.");
  return { tag: heute, at: new Date().toISOString(), text: s.join(" "), teile: { gespraeche, logbuch: lb.gesamt || 0, erledigt, offeneAufgaben: offeneAufgaben.slice(0, 10), termine, erinnerungen, geburtstage, pinnwand, wetter } };
}

/** Jede Minute vom Takt aufgerufen: zur eingestellten Stunde einmal am Tag senden. */
export async function pruefen(melde) {
  const e = einstellungen();
  if (!e.an || IST_EVE) return;
  const { h } = uhrJetzt();
  if (h !== e.stunde) return;
  const d = store.load(DATEI, {});
  if (d.zuletzt === tagStr()) return;
  d.zuletzt = tagStr();
  store.save(DATEI, d);
  const r = await bauen();
  const neu = store.load(DATEI, {});
  neu.liste = [...(neu.liste || []), r].slice(-60);
  store.save(DATEI, neu);
  logbuch.eintragen({ bereich: "rueckblick", titel: "Abend-Rückblick verschickt", details: r.text.slice(0, 600) });
  try { await melde("🌙 Abend-Rückblick", r.text); } catch { /* egal */ }
}

const FRAGE = U(/\b(wie war (mein|der|unser) tag|tages-?rückblick|tages-?rueckblick|abend-?rückblick|abend-?rueckblick|fass (mir )?(den|meinen) tag zusammen|was habe ich heute (geschafft|erledigt))\b/);
export async function quickCommand(text) {
  const { k } = sauber(text);
  const sch = k.match(/^(?:den )?(?:abend-?|tages-?)?r(?:ü|ue)ckblick (aus|an|ein)$/);
  if (sch) { einstellen({ an: sch[1] !== "aus" }); return { answer: sch[1] === "aus" ? "Der Abend-Rückblick ist aus." : `Okay, ab jetzt bekommst du jeden Abend um ${einstellungen().stunde} Uhr deinen Rückblick.`, actions: ["wunsch:rueckblick"] }; }
  if (!FRAGE.test(k)) return null;
  const r = await bauen();
  return { answer: r.text.replace(/ Schlaf gut\.$/, uhrJetzt().h >= 20 ? " Schlaf gut." : ""), actions: ["wunsch:rueckblick"] };
}
