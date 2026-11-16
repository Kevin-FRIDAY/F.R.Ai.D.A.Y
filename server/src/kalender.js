// Apple Kalender & Erinnerungen – über den Mac-Agenten (AppleScript), kostenlos und ohne Schlüssel.
// Beim ersten Mal fragt macOS, ob Friday auf Kalender und Erinnerungen zugreifen darf: "OK" klicken.
import { config } from "./config.js";
import { isAgentOnline, sendToAgent } from "./agent-hub.js";
import * as V from "./verbindungen.js";
import { teile, abHeute, tagPlus, ortszeit, tageBis, uhrText, tagText, findeTag, findeUhrzeit, U } from "./datum.js";

const name = () => config.userName || "Boss";
const d = () => V.get("kalender");
export const kalenderBereit = () => isAgentOnline() && d().aus !== true;

function agent(action, value, timeout = 50000) {
  return sendToAgent(action, { value: JSON.stringify(value || {}) }, timeout);
}

function macFehler(r) {
  const e = String(r?.error || "");
  if (/nicht verbunden/.test(e)) return `Der Mac ist gerade nicht verbunden, ${name()}. Kalender und Erinnerungen laufen über den Mac.`;
  if (/Unbekannte Aktion/.test(e)) return "Der Mac-Agent ist noch auf einem alten Stand. Starte Friday einmal neu, dann klappt der Kalender.";
  if (/-1743|not allowed|nicht erlaubt|Not authorized/i.test(e)) return "macOS erlaubt Friday den Zugriff noch nicht. Öffne Systemeinstellungen → Datenschutz & Sicherheit → Automation und erlaube node den Zugriff auf Kalender und Erinnerungen.";
  if (/rechtzeitig/.test(e)) return "Der Kalender hat zu lange gebraucht. Versuch es gleich nochmal.";
  return `Das hat am Mac nicht geklappt: ${e || "unbekannter Fehler"}.`;
}

// ---------- Wiederholungen (z. B. "jeden Montag") selbst ausrechnen ----------
const WT = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
function regel(rrule) {
  const r = {};
  for (const teil of String(rrule || "").replace(/^RRULE:/i, "").split(";")) {
    const [k, v] = teil.split("=");
    if (k && v) r[k.toUpperCase()] = v;
  }
  return r;
}
// Liefert alle Vorkommen (Sekunden ab heute 0:00) zwischen von und bis.
function vorkommen(start, dauer, rrule, von, bis) {
  const r = regel(rrule);
  const freq = r.FREQ;
  const iv = Math.max(1, Number(r.INTERVAL) || 1);
  let count = r.COUNT ? Number(r.COUNT) : Infinity;
  let until = Infinity;
  if (r.UNTIL) {
    const m = r.UNTIL.match(/^(\d{4})(\d{2})(\d{2})/);
    if (m) {
      const h = teile();
      until = (Date.UTC(+m[1], +m[2] - 1, +m[3], 23, 59) - Date.UTC(h.y, h.m - 1, h.d)) / 1000;
    }
  }
  const out = [];
  const tag = 86400;
  const passt = (s) => s < bis && s + Math.max(dauer, 1) > von && s <= until;
  if (freq === "DAILY" || (freq === "WEEKLY" && !r.BYDAY)) {
    const schritt = (freq === "DAILY" ? 1 : 7) * iv * tag;
    let n = Math.max(0, Math.floor((von - dauer - start) / schritt));
    if (Number.isFinite(count) && n >= count) return out;
    for (let s = start + n * schritt; s < bis && n < count; s += schritt, n++) if (passt(s)) out.push(s);
    return out;
  }
  if (freq === "WEEKLY") {
    const tage = r.BYDAY.split(",").map((x) => WT[x.slice(-2)]).filter((x) => x != null);
    // Wochenanfang (Montag) der Startwoche, an der Wanduhr gerechnet
    const h = teile();
    const basisWt = new Date(Date.UTC(h.y, h.m - 1, h.d)).getUTCDay();
    const startTag = Math.floor(start / tag);
    const startWt = (((basisWt + startTag) % 7) + 7) % 7;
    const zeit = start - startTag * tag;
    const wocheStart = startTag - ((startWt + 6) % 7);
    let woche = Math.max(0, Math.floor((Math.floor(von / tag) - wocheStart) / 7 / iv) - 1);
    let gezaehlt = 0;
    if (Number.isFinite(count)) woche = 0; // mit COUNT von vorne zählen
    for (let w = woche; w < woche + 400; w++) {
      const wBeginn = wocheStart + w * 7 * iv;
      if (wBeginn * tag > bis) break;
      for (const wt of [...tage].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) {
        const tg = wBeginn + ((wt + 6) % 7);
        const s = tg * tag + zeit;
        if (s < start) continue;
        gezaehlt++;
        if (gezaehlt > count) return out;
        if (passt(s)) out.push(s);
      }
    }
    return out;
  }
  if (freq === "MONTHLY" || freq === "YEARLY") {
    const h = teile();
    const basis = Date.UTC(h.y, h.m - 1, h.d);
    const s0 = new Date(basis + start * 1000);
    for (let n = 0, i = 0; n < 1200 && i < count; n++) {
      const x = new Date(s0);
      if (freq === "MONTHLY") x.setUTCMonth(s0.getUTCMonth() + n * iv);
      else x.setUTCFullYear(s0.getUTCFullYear() + n * iv);
      if (x.getUTCDate() !== s0.getUTCDate()) continue; // 31. gibt es nicht in jedem Monat
      i++;
      const s = (x.getTime() - basis) / 1000;
      if (s >= bis) break;
      if (passt(s)) out.push(s);
    }
    return out;
  }
  return passt(start) ? [start] : [];
}

// ---------- Termine lesen ----------
let cache = { key: "", zeit: 0, liste: [] };

/**
 * Termine ab heute+von für "tage" Tage.
 * @returns {Promise<{ok:true, termine:Array<{titel, start:Date, ende:Date, ganz:boolean, kalender:string}>} | {ok:false, error:string}>}
 */
export async function termine(von = 0, tage = 1) {
  if (!isAgentOnline()) return { ok: false, error: macFehler({ error: "nicht verbunden" }) };
  const key = `${von}|${tage}|${teile().d}`;
  if (cache.key === key && Date.now() - cache.zeit < 90_000) return { ok: true, termine: cache.liste };
  const r = await agent("kalender_termine", { von, tage });
  if (!r.ok) return { ok: false, error: macFehler(r) };
  const vonS = von * 86400, bisS = (von + tage) * 86400;
  const ausblenden = new Set(d().ausblenden || []);
  const liste = [];
  for (const t of r.termine || []) {
    if (ausblenden.has(t.kal)) continue;
    const dauer = Math.max(0, t.e - t.s);
    const starts = t.rrule ? vorkommen(t.s, dauer, t.rrule, vonS, bisS) : t.s < bisS && t.e > vonS ? [t.s] : [];
    for (const s of starts) {
      liste.push({ titel: String(t.titel || "Termin").trim() || "Termin", start: abHeute(s), ende: abHeute(s + dauer), ganz: Boolean(t.ganz), kalender: t.kal });
    }
  }
  // Doppelte (gleicher Titel + Zeit in zwei Kalendern) nur einmal
  const gesehen = new Set();
  const sauber = liste
    .sort((a, b) => (tageBis(a.start) - tageBis(b.start)) || (b.ganz - a.ganz) || (a.start - b.start))
    .filter((x) => { const k = `${x.titel}|${+x.start}`; if (gesehen.has(k)) return false; gesehen.add(k); return true; });
  cache = { key, zeit: Date.now(), liste: sauber };
  return { ok: true, termine: sauber };
}

function terminSatz(t, mitTag = false) {
  const tag = mitTag ? `${tagText(t.start)} ` : "";
  if (t.ganz) return `${tag}${t.titel} (ganztägig)`;
  return `${tag}um ${uhrText(t.start)} ${t.titel}`;
}

export function termineVorlesen(liste, wann = "heute", { mitTag = false } = {}) {
  if (!liste.length) return `${wann.charAt(0).toUpperCase() + wann.slice(1)} hast du keine Termine.`;
  const satz = V.aufzaehlen(liste.slice(0, 6).map((t) => terminSatz(t, mitTag)));
  const rest = liste.length > 6 ? ` Und ${liste.length - 6} weitere.` : "";
  return `${wann.charAt(0).toUpperCase() + wann.slice(1)} ${liste.length === 1 ? "hast du einen Termin" : `hast du ${liste.length} Termine`}: ${satz}.${rest}`;
}

// Freie Zeiten zwischen 8 und 20 Uhr
function freieZeiten(liste, tag) {
  const beginn = +ortszeit(tag.y, tag.m, tag.d, 8, 0), ende = +ortszeit(tag.y, tag.m, tag.d, 20, 0);
  const belegt = liste.filter((t) => !t.ganz).map((t) => [Math.max(+t.start, beginn), Math.min(+t.ende, ende)]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  const frei = [];
  let zeiger = Math.max(beginn, Date.now());
  for (const [a, b] of belegt) {
    if (a - zeiger >= 30 * 60000) frei.push([zeiger, a]);
    zeiger = Math.max(zeiger, b);
  }
  if (ende - zeiger >= 30 * 60000) frei.push([zeiger, ende]);
  return frei.map(([a, b]) => `von ${uhrText(new Date(a))} bis ${uhrText(new Date(b))}`);
}

// ---------- Termine eintragen ----------
export async function neuerTermin({ titel, zeit, dauer = 60, ganztag = false, ort = "" }) {
  if (!isAgentOnline()) return { ok: false, error: macFehler({ error: "nicht verbunden" }) };
  const r = await agent("kalender_neu", { titel, zeit, dauer, ganztag, ort, kalender: d().kalender || "" }, 35000);
  if (!r.ok) return { ok: false, error: macFehler(r) };
  cache.key = "";
  const wann = ortszeit(zeit.y, zeit.m, zeit.d, zeit.h || 0, zeit.mi || 0);
  return { ok: true, text: ganztag ? `Eingetragen: ${titel}, ${tagText(wann)}, ganztägig.` : `Eingetragen: ${titel}, ${tagText(wann)} um ${uhrText(wann)}.`, kalender: r.kalender };
}

// ---------- Erinnerungen (Apple) ----------
export async function erinnerungen() {
  if (!isAgentOnline()) return { ok: false, error: macFehler({ error: "nicht verbunden" }) };
  const r = await agent("erinnerungen_liste", {});
  if (!r.ok) return { ok: false, error: macFehler(r) };
  const liste = (r.erinnerungen || []).map((e) => ({ titel: e.titel, faellig: e.faellig == null ? null : abHeute(e.faellig), liste: e.liste }));
  return { ok: true, erinnerungen: liste };
}

export async function neueErinnerung(titel, zeit = null) {
  if (!isAgentOnline()) return { ok: false, error: macFehler({ error: "nicht verbunden" }) };
  const r = await agent("erinnerungen_neu", { titel, zeit, liste: d().liste || "" }, 35000);
  if (!r.ok) return { ok: false, error: macFehler(r) };
  const wann = zeit ? ortszeit(zeit.y, zeit.m, zeit.d, zeit.h, zeit.mi) : null;
  return { ok: true, text: wann ? `In deinen Erinnerungen: ${titel}, ${tagText(wann)} um ${uhrText(wann)}.` : `${titel} steht jetzt in deinen Erinnerungen${r.liste ? ` (Liste ${r.liste})` : ""}.` };
}

export async function erinnerungErledigt(wunsch) {
  const l = await erinnerungen();
  if (!l.ok) return l;
  const e = V.bester(wunsch, l.erinnerungen, (x) => x.titel, 0.5);
  if (!e) return { ok: false, error: `In deinen Erinnerungen finde ich nichts zu „${wunsch}“.` };
  const r = await agent("erinnerungen_erledigt", { titel: e.titel }, 35000);
  if (!r.ok) return { ok: false, error: macFehler(r) };
  return { ok: true, text: `Abgehakt: ${e.titel}.` };
}

// ---------- Fenster "Verbindungen" ----------
export const info = { id: "kalender", name: "Apple Kalender & Erinnerungen", emoji: "📅", kurz: "Termine und Erinnerungen von deinem Mac und iPhone (iCloud)." };

export async function status() {
  const x = d();
  const online = isAgentOnline();
  return {
    ...info,
    eingerichtet: online && x.aus !== true,
    text: !online ? "Wartet auf den Mac – der Kalender läuft über den Mac-Agenten." : x.aus ? "Ausgeschaltet." : `Bereit${x.kalender ? ` · neue Termine in „${x.kalender}“` : ""}${x.geprueft ? "" : " · tipp einmal auf „Zugriff testen“"}`,
    felder: [],
    auswahl: online
      ? [
          { name: "kalender", label: "Neue Termine in", wert: x.kalender || "", optionen: [{ wert: "", text: "Erster Kalender" }, ...(x.kalenderListe || []).map((k) => ({ wert: k, text: k }))] },
          { name: "aus", label: "Kalender benutzen", wert: x.aus ? "aus" : "an", optionen: [{ wert: "an", text: "An" }, { wert: "aus", text: "Aus" }] },
        ]
      : [],
    aktionen: online ? [{ action: "testen", text: "🔐 Zugriff testen" }, { action: "heute", text: "📅 Heute" }] : [],
    ohneSchluessel: true,
  };
}
export async function einrichten() {
  return command({ action: "testen" });
}
export async function einstellen({ name: n, wert } = {}) {
  if (n === "kalender") { V.set("kalender", { kalender: String(wert || "").slice(0, 80) || undefined }); return { ok: true }; }
  if (n === "aus") { V.set("kalender", { aus: wert === "aus" ? true : undefined }); return { ok: true }; }
  return { ok: false, error: "Unbekannte Einstellung." };
}
export function vergessen() {
  V.clear("kalender");
  cache.key = "";
  return { ok: true };
}

export async function command({ action, value, tag, uhrzeit, dauer, ganztag, ort, tage } = {}) {
  switch (String(action || "")) {
    case "testen": {
      if (!isAgentOnline()) return { ok: false, error: macFehler({ error: "nicht verbunden" }) };
      const k = await agent("kalender_namen", {}, 60000);
      if (!k.ok) return { ok: false, error: macFehler(k) };
      const e = await agent("erinnerungen_liste", {}, 60000);
      V.set("kalender", { kalenderListe: (k.kalender || []).slice(0, 40), geprueft: new Date().toISOString() });
      if (!e.ok) return { ok: true, text: `Kalender klappt (${(k.kalender || []).length} Kalender). Erinnerungen noch nicht: ${macFehler(e)}` };
      return { ok: true, text: `Alles klappt: ${(k.kalender || []).length} Kalender und ${(e.erinnerungen || []).length} offene Erinnerungen gefunden.` };
    }
    case "heute":
    case "termine": {
      const von = Number.isFinite(Number(value)) ? Number(value) : 0;
      const n = Math.max(1, Math.min(31, Number(tage) || 1));
      const r = await termine(von, n);
      if (!r.ok) return r;
      const wann = n > 1 ? "in diesem Zeitraum" : von === 0 ? "heute" : von === 1 ? "morgen" : tagText(abHeute(von * 86400));
      return { ok: true, text: termineVorlesen(r.termine, wann, { mitTag: n > 1 }), termine: r.termine.map((t) => ({ titel: t.titel, start: t.start.toISOString(), ende: t.ende.toISOString(), ganztag: t.ganz, kalender: t.kalender })) };
    }
    case "neu": {
      // Für Claude: tag = "YYYY-MM-DD", uhrzeit = "HH:MM"
      const titel = String(value || "").trim().slice(0, 200);
      if (!titel) return { ok: false, error: "Wie soll der Termin heißen?" };
      const m = String(tag || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return { ok: false, error: "Datum fehlt (Format JJJJ-MM-TT)." };
      const u = String(uhrzeit || "").match(/^(\d{1,2}):(\d{2})$/);
      const ganz = Boolean(ganztag) || !u;
      return neuerTermin({ titel, zeit: { y: +m[1], m: +m[2], d: +m[3], h: u ? +u[1] : 0, mi: u ? +u[2] : 0 }, dauer: Number(dauer) || 60, ganztag: ganz, ort: String(ort || "") });
    }
    case "erinnerungen": {
      const r = await erinnerungen();
      if (!r.ok) return r;
      return { ok: true, text: erinnerungenVorlesen(r.erinnerungen), erinnerungen: r.erinnerungen.slice(0, 40).map((e) => ({ titel: e.titel, faellig: e.faellig?.toISOString() || null, liste: e.liste })) };
    }
    case "erinnerung_neu": {
      const titel = String(value || "").trim().slice(0, 200);
      if (!titel) return { ok: false, error: "Was soll in die Erinnerungen?" };
      const m = String(tag || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const u = String(uhrzeit || "").match(/^(\d{1,2}):(\d{2})$/);
      return neueErinnerung(titel, m ? { y: +m[1], m: +m[2], d: +m[3], h: u ? +u[1] : 9, mi: u ? +u[2] : 0 } : null);
    }
    case "erinnerung_erledigt":
      return erinnerungErledigt(String(value || ""));
    default:
      return { ok: false, error: "Unbekannte Kalender-Aktion." };
  }
}

function erinnerungenVorlesen(liste) {
  if (!liste.length) return "In deinen Erinnerungen ist nichts offen.";
  const sortiert = [...liste].sort((a, b) => (a.faellig ? +a.faellig : Infinity) - (b.faellig ? +b.faellig : Infinity));
  const teile_ = sortiert.slice(0, 7).map((e) => (e.faellig ? `${e.titel} (${tagText(e.faellig)}${teile(+e.faellig).h || teile(+e.faellig).mi ? ` um ${uhrText(e.faellig)}` : ""})` : e.titel));
  const rest = liste.length > 7 ? ` Und ${liste.length - 7} weitere.` : "";
  return `${liste.length === 1 ? "Eine Erinnerung ist offen" : `${liste.length} Erinnerungen sind offen`}: ${V.aufzaehlen(teile_)}.${rest}`;
}

// ---------- Sprachbefehle ohne Claude ----------
const ZEITWORTE = /\b(heute abend|heute früh|heute frueh|heute mittag|heute nachmittag|morgen früh|morgen frueh|abends|nachmittags|vormittags|früh|frueh|uhr|um|am|den|ganztägig|ganztaegig|den ganzen tag)\b/g;
function titelAus(t, ...weg) {
  let s = ` ${t} `;
  for (const w of weg) if (w) s = s.replace(w, " ");
  s = s.replace(U(ZEITWORTE), " ").replace(/\s+/g, " ").trim();
  s = s.replace(U(/^(einen |ein |eine |den |die |das |termin |neuen termin |neuer termin )+/), "").replace(U(/\b(ein|in den kalender|im kalender|in meinen kalender|in meinem kalender|kalender)$/), "").trim();
  s = s.replace(U(/\b(ein|in den kalender|in meinen kalender)$/), "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/**
 * @param {string} t - normalisierter Text (klein, ohne "Friday,")
 * @param {string} roh - Originaltext (für Groß-/Kleinschreibung)
 */
export async function quick(t, roh = t) {
  if (d().aus === true) return null;
  const has = (re) => U(re).test(t);
  const online = isAgentOnline();

  // Termine eintragen: "Trag Zahnarzt am Freitag um 10 ein", "Neuer Termin: Friseur morgen um 14 Uhr", "Termin morgen um 9 Meeting"
  const eintragen = t.match(U(/^(?:trag|trage)(?: mir| bitte)? (.+?) (?:in (?:den|meinen) kalender )?ein$/))
    || t.match(U(/^(?:neuer termin|neuen termin|termin eintragen|kalender eintrag|kalendereintrag|termin)[: ]+(.+)$/))
    || t.match(U(/^(?:mach|erstell|erstelle|leg|lege)(?: mir)? (?:einen )?(?:neuen )?termin(?: an)?[: ]+(.+?)(?: an)?$/))
    || t.match(U(/^(?:schreib|schreibe|setz|setze)(?: mir)? (.+?) in (?:den|meinen) kalender$/));
  if (eintragen && !has(/^(termine?|termin) (heute|morgen|übermorgen|uebermorgen|diese woche)$/)) {
    const rest = eintragen[1];
    const tag = findeTag(rest);
    const zeit = findeUhrzeit(rest);
    if (!tag && !zeit) return null; // ohne Datum lieber Claude fragen
    if (!online) return macFehler({ error: "nicht verbunden" });
    const ganz = !zeit || has(/\bganzt(ä|ae)gig\b|\bden ganzen tag\b/);
    let tg = tag?.tag || tagPlus(0);
    // "um 9" ohne Tag und schon vorbei -> morgen
    if (!tag && zeit && +ortszeit(tg.y, tg.m, tg.d, zeit.h, zeit.mi) < Date.now()) tg = tagPlus(1);
    const titel = titelAus(rest, tag?.match, zeit?.match) || "Termin";
    const titelGross = grossWie(titel, roh);
    const r = await neuerTermin({ titel: titelGross, zeit: { ...tg, h: zeit?.h ?? 0, mi: zeit?.mi ?? 0 }, dauer: zeit?.dauer || 60, ganztag: ganz });
    return r.ok ? r.text : r.error;
  }

  // Termine abfragen
  const frage = has(/^(was steht|was hab ich|was habe ich|was ist|was liegt)( denn)?( für)? ?(heute|morgen|übermorgen|uebermorgen|diese woche|am \w+)? ?(an|vor|los|so an)( heute| morgen| übermorgen| diese woche)?$/)
    || has(/^(welche|meine|zeig|zeig mir|lies|lies mir)( meine| die)? ?termine\b/)
    || has(/^(habe|hab) ich (heute|morgen|übermorgen|uebermorgen|am \w+|diese woche)( noch)? (termine|was vor|etwas vor|was|zeit)$/)
    || has(/^termine?( heute| morgen| übermorgen| uebermorgen| diese woche| am \w+)?$/)
    || has(/^(kalender|mein kalender|mein tag|mein tag heute|tagesplan|wie sieht mein tag aus|wie sieht (mein|der) (tag|morgen) aus)$/)
    || has(/^was steht (heute|morgen|übermorgen|uebermorgen|diese woche|am \w+)? ?(im|in meinem) kalender$/);
  if (frage) {
    if (!online) return null; // Offline-Gehirn zeigt dann Fridays eigene Erinnerungen
    if (has(/\bdiese woche\b|\bwoche\b/)) {
      const r = await termine(0, 7);
      return r.ok ? termineVorlesen(r.termine, "diese Woche", { mitTag: true }) : r.error;
    }
    const tag = findeTag(t);
    const plus = tag ? tag.plus : 0;
    const r = await termine(plus, 1);
    if (!r.ok) return r.error;
    let liste = r.termine;
    if (plus === 0) liste = liste.filter((x) => x.ganz || +x.ende > Date.now());
    const wann = plus === 0 ? "heute" : plus === 1 ? "morgen" : tagText(abHeute(plus * 86400));
    return termineVorlesen(liste, plus === 0 && liste.length < r.termine.length ? "heute noch" : wann);
  }

  // Nächster Termin
  if (has(/^(was ist|wann ist|wo ist)? ?mein(en?)? nächste[nr]? termin$|^nächster termin$|^naechster termin$|^(wann|was) ist (mein )?(der )?nächste[nr]? termin$/)) {
    if (!online) return null;
    const r = await termine(0, 14);
    if (!r.ok) return r.error;
    const n = r.termine.find((x) => !x.ganz && +x.start > Date.now()) || r.termine.find((x) => x.ganz && tageBis(x.start) > 0);
    if (!n) return "In den nächsten zwei Wochen steht nichts im Kalender.";
    const min = Math.round((+n.start - Date.now()) / 60000);
    if (!n.ganz && min < 90) return `Dein nächster Termin ist ${n.titel}, in ${min} Minuten.`;
    return `Dein nächster Termin: ${terminSatz(n, true)}.`;
  }

  // Freie Zeit
  const frei = t.match(U(/^(?:wann bin ich|wann habe ich|wann hab ich) (heute|morgen|übermorgen|uebermorgen|am \w+)? ?(?:noch )?(?:frei|zeit)$/));
  if (frei) {
    if (!online) return macFehler({ error: "nicht verbunden" });
    const tag = findeTag(t);
    const plus = tag ? tag.plus : 0;
    const r = await termine(plus, 1);
    if (!r.ok) return r.error;
    const tg = tagPlus(plus);
    const fz = freieZeiten(r.termine, tg);
    const wann = plus === 0 ? "Heute" : plus === 1 ? "Morgen" : tagText(abHeute(plus * 86400)).replace(/^am /, "Am ");
    return fz.length ? `${wann} bist du frei ${V.aufzaehlen(fz)}.` : `${wann} ist zwischen 8 und 20 Uhr alles belegt.`;
  }

  // Apple Erinnerungen
  if (has(/^(zeig|lies|zeig mir|lies mir|was steht (in|auf))( mir)? (meine[n]? |den |die )?(apple[- ]?)?erinnerungen(-app| app| liste)?$|^(meine )?apple[- ]erinnerungen$|^erinnerungen[- ]app$|^was steht in (den|meinen) erinnerungen$/)) {
    if (!online) return null;
    const r = await command({ action: "erinnerungen" });
    return r.ok ? r.text : r.error;
  }
  const neu = t.match(U(/^(?:setz|setze|schreib|schreibe|füg|füge|fueg|fuege|pack|packe|trag|trage) (.+?) (?:auf|in|zu) (?:meine[n]?|die|den) (?:apple[- ]?)?erinnerungen(?:-app| app| liste)?(?: hinzu| ein)?$/))
    || t.match(U(/^(?:neue )?(?:apple[- ]?)?erinnerung(?:en)?(?:-app| app)?: (.+)$/));
  if (neu) {
    if (!online) return macFehler({ error: "nicht verbunden" });
    const rest = neu[1];
    const tag = findeTag(rest), zeit = findeUhrzeit(rest);
    let titel = titelAus(rest, tag?.match, zeit?.match) || rest;
    titel = grossWie(titel, roh);
    const z = tag || zeit ? { ...(tag?.tag || tagPlus(0)), h: zeit?.h ?? 9, mi: zeit?.mi ?? 0 } : null;
    const r = await neueErinnerung(titel, z);
    return r.ok ? r.text : r.error;
  }
  const hak = t.match(U(/^(?:hake|hak|haken) (.+?) (?:in den erinnerungen |in meinen erinnerungen )?ab$/)) || t.match(U(/^(.+?) (?:in den erinnerungen|in meinen erinnerungen) (?:ist )?erledigt$/));
  if (hak && online && /erinnerung/.test(t) && !/todoist|notion/.test(t)) {
    const r = await erinnerungErledigt(hak[1]);
    return r.ok ? r.text : r.error;
  }
  return null;
}

// Holt die Original-Schreibweise eines Stücks zurück ("bäcker" -> "Bäcker"), sonst erster Buchstabe groß.
export function grossWie(stueck, roh) {
  const s = String(stueck || "");
  const i = String(roh || "").toLowerCase().indexOf(s.toLowerCase());
  const o = i >= 0 ? String(roh).slice(i, i + s.length) : s;
  return o.charAt(0).toUpperCase() + o.slice(1);
}

// Für das Briefing und "Was steht heute an": kurzer Satz oder null.
export async function heuteSatz(plus = 0) {
  if (!kalenderBereit()) return null;
  const r = await termine(plus, 1).catch(() => null);
  if (!r || !r.ok) return null;
  const liste = plus === 0 ? r.termine.filter((x) => x.ganz || +x.ende > Date.now()) : r.termine;
  if (!liste.length) return plus === 0 ? (r.termine.length ? "Im Kalender steht heute nichts mehr." : "Im Kalender steht heute nichts.") : null;
  return termineVorlesen(liste, plus === 0 ? (liste.length < r.termine.length ? "heute noch" : "heute") : plus === 1 ? "morgen" : tagText(abHeute(plus * 86400)));
}
