// Weckruf: Friday ruft Kevin an (oder lässt sein iPhone klingeln), wenn etwas Wichtiges passiert,
// ein wichtiger Termin ansteht oder eine Aufgabe fertig ist.
//
// Stufen pro Art von Meldung:
//  - aus:      nichts Zusätzliches (nur bei Terminen: gar keine Meldung)
//  - nachricht: normale Mitteilung (ntfy/Telegram) wie bisher
//  - wichtig:  klingeln nur, wenn die Meldung als wichtig erkannt wird ("wichtig", "dringend", Arzt, Flug …)
//  - klingeln: iPhone klingelt laut wie ein Anruf (Pushover-Notfall, sonst ntfy "dringend")
//  - anruf:    echter Telefonanruf, Friday spricht (Twilio); ohne Twilio wird geklingelt
//
// Wege (von günstig nach teuer):
//  - ntfy dringend (kostenlos, schon da): laute Mitteilung, aber kein Durchbrechen von Lautlos/Fokus
//  - Pushover-Notfall (einmalig ca. 5 $): klingelt jede Minute, bis Kevin auf „Bestätigen“ tippt,
//    geht auch durch Lautlos und Fokus (iOS „Kritische Hinweise“). Friday weiß, ob Kevin es gesehen hat.
//  - Twilio (pro Minute): echter Anruf. Optional als Eskalation, wenn Kevin das Klingeln nicht bestätigt.
//  - Alexa (falls eingerichtet): Ansage auf dem Echo zu Hause.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, IST_EVE, config } from "./config.js";
import * as V from "./verbindungen.js";
import { eintragen } from "./logbuch.js";
import { idleFor } from "./einstellungen.js";

const d = () => V.get("weckruf");
const boss = () => config.userName || "Boss";
const PUSHOVER = () => String(process.env.PUSHOVER_API || "https://api.pushover.net").replace(/\/$/, "");

export const STUFEN = {
  aus: "Aus",
  nachricht: "Nur Nachricht",
  wichtig: "Klingeln, wenn wichtig",
  klingeln: "Klingeln (wie ein Anruf)",
  anruf: "Echter Anruf (Twilio)",
};
const RANG = { aus: 0, nachricht: 1, wichtig: 2, klingeln: 3, anruf: 4 };

// Was als wichtig zählt – und wie laut es standardmäßig wird.
export const ARTEN = {
  alarm: { name: "Alarm (Kamera-Wache, Feuer, Gefahr)", std: "anruf", nachts: true },
  termin: { name: "Termin steht bald an", std: "wichtig" },
  aufgabe: { name: "Aufgabe erledigt", std: "klingeln" },
  mission: { name: "Mission braucht dich", std: "klingeln" },
  erinnerung: { name: "Erinnerung fällig", std: "wichtig" },
  unwetter: { name: "Unwetter-Warnung", std: "wichtig" },
  friday: { name: "Friday findet etwas wichtig", std: "klingeln" },
  system: { name: "System (Guthaben, Updates, Kosten)", std: "nachricht" },
  markt: { name: "Markt-Wache", std: "nachricht" },
};

// ---------- Was ist "wichtig"? ----------
const WICHTIG_WORT = /(wichtig|dringend|sofort|notfall|eilig|asap|achtung|nicht vergessen|deadline|frist)|!{1,}|‼|⚠|🔴|🚨|🔥/i;
const WICHTIG_TERMIN = /(arzt|ärztin|zahnarzt|kinderarzt|klinik|krankenhaus|praxis|op\b|operation|impf|flug|flughafen|abflug|zug\b|bahn|ice\b|bewerbung|vorstellung|interview|notar|amt\b|behörde|bürgeramt|finanzamt|jobcenter|gericht|anwalt|prüfung|klausur|abholen|kita|schule|elternabend|tüv|werkstatt|vertrag|bank|termin beim|geburt|hochzeit|beerdigung)/i;
const UNWETTER_HOCH = /(unwetter|extrem|orkan|schwer|sturmflut|hochwasser)/i;

export function istWichtig(art, titel = "", text = "") {
  const t = `${titel} ${text}`;
  if (WICHTIG_WORT.test(t)) return true;
  if (art === "termin") return WICHTIG_TERMIN.test(t) || (d().wichtige_woerter || []).some((w) => w && t.toLowerCase().includes(w));
  if (art === "unwetter") return UNWETTER_HOCH.test(t);
  if (art === "alarm") return true;
  return false;
}

export function stufeVon(art) {
  const s = d().stufen?.[art];
  return STUFEN[s] ? s : ARTEN[art]?.std || "nachricht";
}

// ---------- Kleiner Speicher: Protokoll + schon gemeldete Termine ----------
const FILE = path.join(DATA_DIR, "weckruf.json");
let mem = null;
function lade() {
  if (mem) return mem;
  try { mem = JSON.parse(fs.readFileSync(FILE, "utf8")) || {}; } catch { mem = {}; }
  mem.protokoll ||= [];
  mem.termine ||= {};
  return mem;
}
function speichere() {
  try {
    const m = lade();
    m.protokoll = m.protokoll.slice(-60);
    const grenze = Date.now() - 3 * 86400000;
    for (const [k, t] of Object.entries(m.termine)) if (t < grenze) delete m.termine[k];
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE + ".tmp", JSON.stringify(m, null, 2));
    fs.renameSync(FILE + ".tmp", FILE);
  } catch (err) { console.error("Weckruf speichern:", err.message); }
}
export function _reset() { mem = null; laufend.clear(); }

// ---------- Regeln: darf es jetzt klingeln? ----------
const MAX_PRO_STUNDE = 4;
const DOPPELT_MS = 20 * 60 * 1000;

function nachtruheJetzt(jetzt = new Date()) {
  const n = d().nachtruhe ?? "22-7";
  if (n === "aus") return false;
  const [von, bis] = String(n).split("-").map(Number);
  if (!Number.isFinite(von) || !Number.isFinite(bis)) return false;
  const h = Number(jetzt.toLocaleString("en-GB", { timeZone: config.timezone || "Europe/Berlin", hour: "2-digit", hour12: false })) % 24;
  return von > bis ? h >= von || h < bis : h >= von && h < bis;
}

export const pushoverBereit = () => Boolean(d().pushover_user && d().pushover_token);
const ntfyBereit = () => Boolean(config.ntfyTopic);
async function twilioBereit() {
  try { const a = await import("./anrufe.js"); return a.twilioBereit() && a.kontakte().some((k) => k.rolle === "ich"); } catch { return false; }
}
export const wegeBereit = () => pushoverBereit() || ntfyBereit();

/**
 * Entscheidet, ob eine Meldung klingeln (oder anrufen) soll. Zählt mit, damit es nicht dauernd klingelt.
 * @returns {null | {art, stufe:"klingeln"|"anruf", grund:string}}
 */
export function entscheide(art, { titel = "", text = "", wichtig, erzwingen = false } = {}) {
  if (IST_EVE || !ARTEN[art]) return null;
  const x = d();
  if (x.pause_bis && Date.now() < x.pause_bis && art !== "alarm") return null;
  let stufe = stufeVon(art);
  if (erzwingen && RANG[stufe] < RANG.klingeln) stufe = "klingeln";
  if (stufe === "wichtig") stufe = (wichtig ?? istWichtig(art, titel, text)) ? "klingeln" : "nachricht";
  if (RANG[stufe] < RANG.klingeln) return null;
  // Nachts nur Alarme (und was Kevin ausdrücklich bestellt hat)
  if (!ARTEN[art].nachts && !erzwingen && nachtruheJetzt()) return null;
  // Sitzt Kevin gerade am Dashboard, sagt Friday es dort – kein Klingeln nötig.
  if (x.am_dashboard !== "klingeln" && art !== "alarm" && !erzwingen && !idleFor(2 * 60 * 1000)) return null;
  const m = lade();
  const jetzt = Date.now();
  const letzte = m.protokoll.filter((p) => p.laut && jetzt - p.zeit < 3600000);
  if (art !== "alarm" && letzte.length >= MAX_PRO_STUNDE) return null;
  if (letzte.some((p) => p.titel === titel && p.text === text && jetzt - p.zeit < DOPPELT_MS)) return null;
  return { art, stufe, grund: erzwingen ? "bestellt" : ARTEN[art].name };
}

// ---------- Pushover ----------
function pushoverFehler(r) {
  if (r.netz) return "Pushover ist gerade nicht erreichbar.";
  const e = [].concat(r.data?.errors || []).join(" ");
  if (/user key is invalid|user identifier/i.test(e)) return "Pushover kennt diesen User Key nicht. Du findest ihn oben auf pushover.net nach dem Anmelden.";
  if (/application token is invalid|token is invalid/i.test(e)) return "Der Pushover API Token stimmt nicht. Leg auf pushover.net unter „Create an Application“ eine App „Friday“ an und kopier deren Token.";
  if (/no active devices/i.test(e)) return "In deinem Pushover-Konto ist noch kein iPhone. Installier die Pushover-App und melde dich dort an.";
  return `Pushover meldet: ${e || `Fehler ${r.status}`}`;
}

async function pushoverSenden(titel, text, { notfall = true, sound } = {}) {
  const x = d();
  const body = {
    token: x.pushover_token, user: x.pushover_user,
    title: String(titel).slice(0, 250), message: String(text || titel).slice(0, 1000),
    priority: notfall ? "2" : "1",
    sound: sound || x.pushover_ton || "persistent",
  };
  if (notfall) Object.assign(body, { retry: "60", expire: String(Math.max(5, Number(x.eskalation_min) || 0, 30) * 60) });
  const r = await V.holeJson(`${PUSHOVER()}/1/messages.json`, { method: "POST", form: true, body, timeout: 12000 });
  return r.ok && r.data?.status === 1 ? { ok: true, receipt: r.data.receipt || null } : { ok: false, error: pushoverFehler(r) };
}

async function pushoverBestaetigt(receipt) {
  const r = await V.holeJson(`${PUSHOVER()}/1/receipts/${encodeURIComponent(receipt)}.json?token=${encodeURIComponent(d().pushover_token || "")}`, { timeout: 10000 });
  if (!r.ok) return null;
  return { bestaetigt: r.data.acknowledged === 1, abgelaufen: r.data.expired === 1 };
}
async function pushoverStoppen(receipt) {
  await V.holeJson(`${PUSHOVER()}/1/receipts/${encodeURIComponent(receipt)}/cancel.json`, { method: "POST", form: true, body: { token: d().pushover_token }, timeout: 10000 }).catch(() => {});
}

// Laufende Weckrufe: Friday schaut alle 30 s, ob Kevin bestätigt hat; sonst ggf. echter Anruf.
const laufend = new Map(); // receipt -> {eintrag, start, timer}
const PRUEF_MS = () => Number(process.env.WECKRUF_PRUEF_MS) || 30000;

function beobachte(receipt, eintrag) {
  const start = Date.now();
  const eskalation = Number(d().eskalation_min) || 0;
  const timer = setInterval(async () => {
    try {
      const s = await pushoverBestaetigt(receipt);
      if (s?.bestaetigt) {
        clearInterval(timer); laufend.delete(receipt);
        eintrag.bestaetigt = Date.now(); speichere();
        eintragen({ bereich: "anruf", titel: `Weckruf bestätigt: ${eintrag.titel}`, quelle: "automatisch" });
        return;
      }
      const vorbei = Date.now() - start;
      if (eskalation && vorbei >= eskalation * 60000 && !eintrag.eskaliert) {
        eintrag.eskaliert = true;
        if (await twilioBereit()) {
          const a = await import("./anrufe.js");
          const r = await a.anrufAnMich(`${eintrag.titel}. ${eintrag.text}`);
          eintrag.wege.push(r.ok ? "twilio" : "twilio-fehler");
          eintragen({ bereich: "anruf", titel: `Weckruf nicht bestätigt, rufe echt an: ${eintrag.titel}`, details: r.ok ? "" : r.error, ok: r.ok, quelle: "automatisch" });
          if (r.ok) await pushoverStoppen(receipt);
        }
        speichere();
        clearInterval(timer); laufend.delete(receipt);
        return;
      }
      if (s?.abgelaufen || vorbei > 3 * 3600000) { clearInterval(timer); laufend.delete(receipt); }
    } catch { /* nächster Versuch */ }
  }, PRUEF_MS());
  timer.unref?.();
  laufend.set(receipt, { eintrag, start, timer });
}

// ---------- ntfy dringend ----------
async function ntfyDringend(titel, text) {
  if (!ntfyBereit()) return false;
  try {
    const res = await fetch(`${config.ntfyServer}/${encodeURIComponent(config.ntfyTopic)}`, {
      method: "POST",
      headers: { Title: encodeURIComponent(titel), Priority: "5", Tags: "rotating_light", "Content-Type": "text/plain; charset=utf-8" },
      body: text || titel,
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch { return false; }
}

/**
 * Lässt Kevins iPhone klingeln bzw. ruft echt an. ntfy/Telegram als normale Nachricht schickt notifyAll schon.
 * @param {{art, stufe}} e  Ergebnis von entscheide()
 */
export async function wecken(e, titel, text, { ntfySchonLaut = false } = {}) {
  const eintrag = { zeit: Date.now(), art: e.art, stufe: e.stufe, titel: String(titel).slice(0, 200), text: String(text || "").slice(0, 600), laut: true, wege: [] };
  lade().protokoll.push(eintrag);
  let fehler = "";
  // 1) Echter Anruf, wenn so eingestellt
  if (e.stufe === "anruf" && await twilioBereit()) {
    const a = await import("./anrufe.js");
    const r = await a.anrufAnMich(`${titel}. ${text || ""}`.trim());
    if (r.ok) eintrag.wege.push("twilio"); else fehler = r.error;
  }
  // 2) Klingeln
  if (pushoverBereit()) {
    const r = await pushoverSenden(titel, text);
    if (r.ok) { eintrag.wege.push("pushover"); if (r.receipt) beobachte(r.receipt, eintrag); }
    else fehler = r.error;
  }
  if (!eintrag.wege.length && !ntfySchonLaut && await ntfyDringend(titel, text)) eintrag.wege.push("ntfy");
  if (ntfySchonLaut) eintrag.wege.push("ntfy");
  // 3) Zu Hause: Alexa sagt es an
  if (d().alexa === "an") {
    try {
      const al = await import("./alexa.js");
      if (al.alexaConfigured()) { const r = await al.announce(`${boss()}, ${titel}. ${text || ""}`.slice(0, 400)); if (r.ok) eintrag.wege.push("alexa"); }
    } catch { /* egal */ }
  }
  // 4) Mac zeigt es auch
  try {
    const hub = await import("./agent-hub.js");
    if (hub.isAgentOnline()) hub.sendToAgent("notify", { value: `${titel}: ${text || ""}`.slice(0, 200) });
  } catch { /* egal */ }
  speichere();
  eintragen({
    bereich: "anruf",
    titel: `${e.stufe === "anruf" ? "📞 Anruf" : "🔔 Weckruf"}: ${titel}`,
    details: eintrag.wege.length ? `Weg: ${eintrag.wege.join(", ")}. Grund: ${e.grund || ARTEN[e.art]?.name || e.art}` : fehler || "Kein Weg eingerichtet",
    ok: eintrag.wege.length > 0,
    quelle: "automatisch",
  });
  return { ok: eintrag.wege.length > 0, wege: eintrag.wege, error: eintrag.wege.length ? undefined : fehler || "Für Weckrufe ist noch kein Weg eingerichtet (Pushover oder ntfy)." };
}

/** Bequemer Einstieg: entscheiden + wecken (ohne normale Nachricht). */
export async function melden(art, titel, text = "", opts = {}) {
  const e = entscheide(art, { titel, text, ...opts });
  if (!e) return { ok: true, laut: false };
  const r = await wecken(e, titel, text);
  return { ...r, laut: true, stufe: e.stufe };
}

// ---------- Termin-Wächter ----------
const VORLAUF = () => Math.max(5, Math.min(180, Number(d().vorlauf_min) || 15));
export async function termineTick(jetzt = Date.now()) {
  if (IST_EVE || stufeVon("termin") === "aus") return 0;
  const kal = await import("./kalender.js");
  if (!kal.kalenderBereit()) return 0;
  const r = await kal.termine(0, 2).catch(() => null);
  if (!r?.ok) return 0;
  const m = lade();
  const vorlauf = VORLAUF() * 60000;
  let n = 0;
  for (const t of r.termine) {
    if (t.ganz) continue;
    const start = +new Date(t.start);
    const bis = start - jetzt;
    if (bis <= 0 || bis > vorlauf) continue;
    const key = `${t.titel}|${start}`;
    if (m.termine[key]) continue;
    m.termine[key] = start;
    const min = Math.max(1, Math.round(bis / 60000));
    const uhr = new Date(start).toLocaleTimeString("de-DE", { timeZone: config.timezone || "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
    const titel = `📅 ${t.titel} um ${uhr} Uhr`;
    const text = `In ${min} Minuten: ${t.titel}${t.kalender ? ` (${t.kalender})` : ""}.`;
    const wichtig = d().termine === "alle" ? true : istWichtig("termin", t.titel);
    const { notifyAll } = await import("./notify.js");
    await notifyAll(titel, text, { art: "termin", wichtig }).catch(() => {});
    n++;
  }
  if (n) speichere();
  return n;
}

let gestartet = false;
export function weckrufStart() {
  if (gestartet || IST_EVE) return;
  gestartet = true;
  const lauf = () => termineTick().catch((e) => console.error("Termin-Wächter:", e.message));
  setTimeout(lauf, 75 * 1000);
  setInterval(lauf, 60 * 1000).unref?.();
}

// ---------- "… und ruf mich an, wenn du fertig bist" ----------
const FERTIG_RUF = /[,;.\s]*(?:und\s+)?(?:dann\s+)?(?:ruf(?:e)?\s+mich\s+(?:bitte\s+)?an|klingel(?:e)?\s+(?:mich\s+an|bei\s+mir)|weck(?:e)?\s+mich|gib\s+mir\s+bescheid|sag\s+mir\s+bescheid|melde\s+dich)(?:\s+bitte)?,?\s+(?:wenn|sobald)\s+(?:du\s+)?(?:damit\s+)?(?:fertig|durch|soweit)(?:\s+bist)?(?:\s+damit)?[.!]?\s*$/i;
/** Trennt den Wunsch "ruf mich an, wenn du fertig bist" vom eigentlichen Auftrag. */
export function fertigWunsch(text) {
  const s = String(text || "");
  if (!FERTIG_RUF.test(s)) return { text: s, rufen: false };
  const rest = s.replace(FERTIG_RUF, "").trim();
  return { text: rest || s, rufen: Boolean(rest) };
}

// ---------- Sprachbefehle ohne Claude ----------
export async function quickCommand(text) {
  const { normalize } = await import("./offline.js");
  const t = normalize(text);
  if (!t || t.length > 120) return null;
  if (/^(teste?|test) (den |die )?(weckruf|weckrufe|anruf funktion|notfall klingel)|^(ruf|klingel) mich (mal )?(zum|als) test an|^weckruf (test|testen)$/.test(t)) {
    const r = await command({ action: "test_klingeln" });
    return { answer: r.ok ? r.text : r.error, actions: ["weckruf"] };
  }
  let m = t.match(/^(?:weckrufe?|anrufe von dir|klingeln) (?:aus|pausieren|stumm)(?: für (\d+) stunden?)?$|^nicht (?:mehr )?(?:anrufen|klingeln)(?: für (\d+) stunden?)?$|^(?:bitte )?nicht stören(?: für (\d+) stunden?)?$/);
  if (m) {
    const h = Number(m[1] || m[2] || m[3]) || 3;
    V.set("weckruf", { pause_bis: Date.now() + h * 3600000 });
    return { answer: `Alles klar, ${boss()}. ${h} ${h === 1 ? "Stunde" : "Stunden"} lang rufe ich dich nicht an, außer bei einem echten Alarm.`, actions: ["weckruf"] };
  }
  if (/^(weckrufe?|anrufe von dir|klingeln) (wieder )?(an|einschalten)$|^du darfst (mich )?wieder anrufen$/.test(t)) {
    V.set("weckruf", { pause_bis: undefined });
    return { answer: `Weckrufe sind wieder an, ${boss()}. Bei Wichtigem klingle ich.`, actions: ["weckruf"] };
  }
  if (/^(wann|wobei|wofür) (rufst du mich an|klingelst du)|^was (ist|zählt) (für dich )?wichtig/.test(t)) {
    return { answer: regelnSatz(), actions: ["weckruf"] };
  }
  return null;
}

function regelnSatz() {
  const laut = Object.entries(ARTEN).filter(([a]) => RANG[stufeVon(a)] >= RANG.wichtig).map(([a, x]) => (stufeVon(a) === "wichtig" ? `${x.name} (wenn wichtig)` : x.name));
  const ruhe = d().nachtruhe ?? "22-7";
  return laut.length
    ? `Ich klingle bei: ${V.aufzaehlen(laut)}.${ruhe !== "aus" ? ` Nachts zwischen ${ruhe.replace("-", " und ")} Uhr nur bei Alarm.` : ""} Höchstens ${MAX_PRO_STUNDE} Mal pro Stunde.`
    : "Gerade klingle ich bei nichts. Das stellst du im Fenster Verbindungen unter Weckruf ein.";
}

// ---------- Werkzeug für Claude + Knöpfe ----------
export async function command({ action, titel, text, value } = {}) {
  const a = String(action || "");
  if (a === "wecken") {
    const t = String(titel || value || "").trim().slice(0, 120);
    if (!t) return { ok: false, error: "Worum geht es? (titel fehlt)" };
    if (!wegeBereit() && !(await twilioBereit())) return { ok: false, error: "Für Weckrufe ist noch nichts eingerichtet. Verbindungen → Weckruf." };
    const { notifyAll } = await import("./notify.js");
    const r = await notifyAll(`🔔 ${t}`, String(text || ""), { art: "friday", wichtig: true });
    return { ok: true, text: r ? "Boss ist benachrichtigt." : "Ich konnte Boss nicht erreichen." };
  }
  if (a === "test_klingeln" || a === "test_anruf") {
    if (a === "test_anruf") {
      if (!(await twilioBereit())) return { ok: false, error: "Für einen echten Testanruf brauchst du Twilio und deine Nummer (Verbindungen → Anrufe & Nachrichten)." };
      const an = await import("./anrufe.js");
      const r = await an.anrufAnMich("Das ist ein Test-Weckruf. Wenn es wichtig ist, rufe ich dich so an.");
      return r.ok ? { ok: true, text: "Ich rufe dich jetzt an.", sprechen: true } : r;
    }
    if (!wegeBereit()) return { ok: false, error: "Noch kein Weg eingerichtet. Trag hier deinen Pushover-Schlüssel ein, oder richte ntfy ein (NTFY_TOPIC)." };
    const r = await wecken({ art: "friday", stufe: "klingeln", grund: "Test" }, "🔔 Test-Weckruf von Friday", "So klingelt es, wenn etwas Wichtiges passiert. Tipp auf Bestätigen.");
    return r.ok ? { ok: true, text: `Dein iPhone sollte jetzt klingeln (${r.wege.join(", ")}).${r.wege.includes("pushover") ? " Tipp in Pushover auf Bestätigen, sonst klingelt es jede Minute weiter." : ""}`, sprechen: true } : r;
  }
  if (a === "status" || a === "regeln") return { ok: true, text: regelnSatz() };
  if (a === "protokoll") {
    const p = lade().protokoll.slice(-5).reverse();
    return { ok: true, text: p.length ? p.map((x) => `${new Date(x.zeit).toLocaleString("de-DE", { timeZone: config.timezone || "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} ${x.titel}${x.bestaetigt ? " ✓" : ""}`).join(" · ") : "Noch keine Weckrufe." };
  }
  return { ok: false, error: "Unbekannte Aktion." };
}

// ---------- Fenster "Verbindungen" ----------
export const info = { id: "weckruf", name: "Weckruf – Friday ruft dich an", emoji: "🔔", kurz: "Bei Alarm, wichtigen Terminen oder fertigen Aufgaben klingelt dein iPhone.", knopf: "Speichern" };

export async function status() {
  const x = d();
  const tw = await twilioBereit();
  const wege = [pushoverBereit() && "Pushover (klingelt, bis du bestätigst)", ntfyBereit() && "ntfy", tw && "Twilio (echter Anruf)"].filter(Boolean);
  const pause = x.pause_bis && Date.now() < x.pause_bis ? ` Pausiert bis ${new Date(x.pause_bis).toLocaleTimeString("de-DE", { timeZone: config.timezone || "Europe/Berlin", hour: "2-digit", minute: "2-digit" })} Uhr.` : "";
  const letzter = lade().protokoll.at(-1);
  const wahl = (name, label, wert, optionen) => ({ name, label, wert, optionen: optionen.map(([w, t]) => ({ wert: w, text: t })) });
  const stufenOpt = (art) => Object.entries(STUFEN).filter(([s]) => (s !== "aus" || art === "termin") && (s !== "anruf" || tw || stufeVon(art) === "anruf")).map(([s, t]) => [s, s === "anruf" && !tw ? `${t} – braucht Twilio` : t]);
  return {
    ...info,
    eingerichtet: wege.length > 0,
    text: (wege.length ? `Wege: ${wege.join(", ")}. ${regelnSatz()}` : "Noch kein Weg zum Klingeln. Empfehlung: Pushover (einmalig ca. 5 $), dann klingelt dein iPhone wie ein Anruf, auch im Lautlos-Modus.")
      + pause + (letzter ? ` Zuletzt: ${letzter.titel}${letzter.bestaetigt ? " (bestätigt)" : ""}.` : ""),
    hinweis: "So geht's: Pushover-App aufs iPhone laden und anmelden. Auf pushover.net den „User Key“ kopieren und unter „Create an Application“ eine App „Friday“ anlegen, deren „API Token“ kopieren. Beides hier eintragen. In der Pushover-App bei Einstellungen „Kritische Hinweise“ erlauben, dann klingelt es auch bei Lautlos und Fokus. Für echte Anrufe zusätzlich Twilio unter „Anrufe & Nachrichten“. Anleitung: anleitungen/56-weckruf.md.",
    felder: [
      { name: "pushover_user", label: "Pushover User Key", platzhalter: "u… (30 Zeichen)", wert: x.pushover_user || "" },
      { name: "pushover_token", label: x.pushover_token ? "Pushover API Token (gespeichert, leer lassen = behalten)" : "Pushover API Token", typ: "password", platzhalter: "a… (30 Zeichen)" },
      { name: "wichtige_woerter", label: "Eigene Stichwörter für wichtige Termine (mit Komma)", platzhalter: "z. B. Carla, Chef, Kunde", wert: (x.wichtige_woerter || []).join(", ") },
    ],
    auswahl: [
      ...Object.entries(ARTEN).map(([art, a]) => wahl(`stufe_${art}`, a.name, stufeVon(art), stufenOpt(art))),
      wahl("vorlauf_min", "Wie lange vor einem Termin", String(VORLAUF()), [["5", "5 Minuten"], ["10", "10 Minuten"], ["15", "15 Minuten"], ["30", "30 Minuten"], ["60", "1 Stunde"]]),
      wahl("termine", "Welche Termine zählen als wichtig", x.termine === "alle" ? "alle" : "wichtige", [["wichtige", "Mit „!“ oder Stichwort (Arzt, Flug, Amt …)"], ["alle", "Alle Termine"]]),
      wahl("nachtruhe", "Nachtruhe (dann nur Alarm)", x.nachtruhe ?? "22-7", [["22-7", "22 bis 7 Uhr"], ["23-7", "23 bis 7 Uhr"], ["0-6", "0 bis 6 Uhr"], ["aus", "Keine Nachtruhe"]]),
      wahl("eskalation_min", "Nicht bestätigt? Dann echt anrufen nach", String(Number(x.eskalation_min) || 0), [["0", "Nie"], ["3", "3 Minuten"], ["5", "5 Minuten"], ["10", "10 Minuten"]]),
      wahl("am_dashboard", "Wenn ich gerade am Dashboard bin", x.am_dashboard === "klingeln" ? "klingeln" : "sagen", [["sagen", "Nicht klingeln (ich sehe es ja)"], ["klingeln", "Trotzdem klingeln"]]),
      wahl("alexa", "Zu Hause auch über Alexa ansagen", x.alexa === "an" ? "an" : "aus", [["aus", "Nein"], ["an", "Ja"]]),
    ],
    aktionen: [
      ...(wegeBereit() ? [{ action: "test_klingeln", text: "🔔 Test: iPhone klingeln lassen" }] : []),
      ...(tw ? [{ action: "test_anruf", text: "📞 Test: echter Anruf" }] : []),
      { action: "protokoll", text: "📜 Letzte Weckrufe" },
    ],
  };
}

export async function einrichten(f = {}) {
  const user = String(f.pushover_user || "").trim();
  const token = String(f.pushover_token || "").trim() || d().pushover_token || "";
  const woerter = String(f.wichtige_woerter || "").split(/[,;\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 30);
  const neu = { wichtige_woerter: woerter.length ? woerter : undefined };
  if (user || f.pushover_token) {
    if (!/^[a-z0-9]{30}$/i.test(user)) return { ok: false, error: "Der Pushover User Key hat 30 Buchstaben und Zahlen. Du findest ihn oben auf pushover.net." };
    if (!/^[a-z0-9]{30}$/i.test(token)) return { ok: false, error: "Der Pushover API Token hat 30 Zeichen. Leg auf pushover.net eine App „Friday“ an und kopier deren Token." };
    const r = await V.holeJson(`${PUSHOVER()}/1/users/validate.json`, { method: "POST", form: true, body: { token, user }, timeout: 12000 });
    if (!(r.ok && r.data?.status === 1)) return { ok: false, error: pushoverFehler(r) };
    Object.assign(neu, { pushover_user: user, pushover_token: token });
  } else {
    Object.assign(neu, { pushover_user: undefined, pushover_token: undefined });
  }
  V.set("weckruf", neu);
  return { ok: true, text: pushoverBereit() ? "Gespeichert. Pushover ist verbunden. Tipp auf „Test: iPhone klingeln lassen“." : "Gespeichert." };
}

export async function einstellen({ name, wert } = {}) {
  const n = String(name || ""), w = String(wert ?? "");
  if (n.startsWith("stufe_")) {
    const art = n.slice(6);
    if (!ARTEN[art] || !STUFEN[w] || (w === "aus" && art !== "termin")) return { ok: false, error: "Unbekannte Stufe." };
    if (w === "anruf" && !(await twilioBereit())) return { ok: false, error: "Für echte Anrufe zuerst Twilio und deine eigene Nummer unter „Anrufe & Nachrichten“ eintragen." };
    V.set("weckruf", { stufen: { ...(d().stufen || {}), [art]: w } });
    return { ok: true, text: `${ARTEN[art].name}: ${STUFEN[w]}.` };
  }
  const erlaubt = {
    vorlauf_min: ["5", "10", "15", "30", "60"], termine: ["wichtige", "alle"], nachtruhe: ["22-7", "23-7", "0-6", "aus"],
    eskalation_min: ["0", "3", "5", "10"], am_dashboard: ["sagen", "klingeln"], alexa: ["an", "aus"],
  };
  if (!erlaubt[n]?.includes(w)) return { ok: false, error: "Unbekannte Einstellung." };
  if (n === "eskalation_min" && w !== "0" && !(await twilioBereit())) return { ok: false, error: "Für den echten Anruf brauchst du Twilio und deine Nummer unter „Anrufe & Nachrichten“." };
  V.set("weckruf", { [n]: /_min$/.test(n) ? Number(w) : w });
  return { ok: true };
}

export function vergessen() {
  V.set("weckruf", { pushover_user: undefined, pushover_token: undefined });
  return { ok: true };
}

export function kurzinfo() {
  if (!wegeBereit()) return "";
  return "Weckruf (weckruf): Mit action=wecken klingelt Boss' iPhone wie ein Anruf. Nur für wirklich Wichtiges, das nicht warten kann, oder wenn Boss 'ruf mich an, wenn …' gesagt hat.";
}
