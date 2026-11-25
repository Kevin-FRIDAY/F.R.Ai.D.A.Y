// Mein Tag (v1.190.0, Mark XVII): Tagesplanung, Zeitfresser, Jahresziele auf Kurs, Wissen aufräumen.
// Baut auf Vorhandenem auf und legt nichts doppelt an:
//  - Termine aus kalender.js, Aufgaben/Ziel-Schritte/Erinnerungen/Projekte aus persoenlich.prioritaeten()
//  - Ziele + Schritte aus persoenlich.js (hier nur: Kurs-Prüfung und Etappen pro Quartal)
//  - Gedächtnis aus gedaechtnis.js (exakte Doppelte macht pflege(), hier zusätzlich fast gleiche – nur mit Freigabe)
// Zeitfresser: nur auf Kevins eigenem Mac, alle 5 Minuten das Programm im Vordergrund (lsappinfo, nur lesen).
// Bleibt auf dem Mac, keine Fenstertitel, keine Webseiten. Ohne Claude, ohne Kosten.
import os from "node:os";
import { execFile } from "node:child_process";
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";

const NAME = "tagesplan";
const lade = () => ({ von: 8, bis: 20, apps: {}, ablenkung: [], produktiv: [], zeitAn: true, ...store.load(NAME, {}) });
const sichere = (d) => store.save(NAME, d);
const kurz = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const sicher = async (fn) => { try { return await fn(); } catch { return null; } };
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;
const tagKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dauerText = (m) => (m >= 60 ? `${Math.floor(m / 60)} Std.${m % 60 ? ` ${m % 60} Min.` : ""}` : `${m} Min.`);

// ---------- 🗓 Tagesplanung ----------
export const DAUER = { 1: 15, 2: 45, 3: 90 };

/**
 * Reine Planung: Termine sind fest, freie Lücken werden mit den wichtigsten Aufgaben gefüllt.
 * Nach 90 Minuten am Stück kommt eine Pause von 15 Minuten. Große Aufgaben, die nicht passen, werden angefangen (45 Min.).
 */
export function planen({ termine = [], aufgaben = [], jetztMin = 0, von = 8, bis = 20 } = {}) {
  const start = Math.max(von * 60, Math.ceil(jetztMin / 15) * 15);
  const ende = bis * 60;
  const fest = termine.filter((t) => !t.ganz && Number.isFinite(t.vonMin) && Number.isFinite(t.bisMin) && t.bisMin > start && t.vonMin < ende)
    .map((t) => ({ von: Math.max(t.vonMin, start), bis: Math.min(t.bisMin, ende), art: "termin", text: t.titel }))
    .sort((a, b) => a.von - b.von);
  const luecken = [];
  let z = start;
  for (const t of fest) { if (t.von > z) luecken.push([z, t.von]); z = Math.max(z, t.bis); }
  if (z < ende) luecken.push([z, ende]);
  const offen = aufgaben.slice();
  const bloecke = [...fest];
  for (const [a, b] of luecken) {
    let t = a, amStueck = 0;
    while (t < b && offen.length) {
      if (amStueck >= 90 && b - t >= 30) { bloecke.push({ von: t, bis: t + 15, art: "pause", text: "Pause" }); t += 15; amStueck = 0; continue; }
      const frei = b - t;
      const i = offen.findIndex((x) => DAUER[x.aufwand || 2] <= frei || (x.aufwand === 3 && frei >= 45));
      if (i < 0) break;
      const x = offen.splice(i, 1)[0];
      const voll = DAUER[x.aufwand || 2] <= frei;
      const d = voll ? DAUER[x.aufwand || 2] : 45;
      bloecke.push({ von: t, bis: t + d, art: "aufgabe", text: voll ? x.text : `Anfangen: ${x.text}`, quelle: x.quelle || "", prio: x.prio || 2 });
      t += d; amStueck += d;
    }
  }
  bloecke.sort((x, y) => x.von - y.von);
  const verplant = bloecke.filter((x) => x.art !== "pause").reduce((s, x) => s + (x.bis - x.von), 0);
  return { start, ende, bloecke: bloecke.map((x) => ({ ...x, vonText: hhmm(x.von), bisText: hhmm(x.bis) })), uebrig: offen, freiMin: Math.max(0, ende - start - verplant) };
}

export async function tagesplan() {
  const d = lade();
  const jetzt = new Date();
  let jetztMin = jetzt.getHours() * 60 + jetzt.getMinutes();
  // Nach Feierabend (30 Min. vor Ende) plant Friday schon den nächsten Tag.
  const morgen = jetztMin >= d.bis * 60 - 30;
  const tag = morgen ? new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + 1) : jetzt;
  if (morgen) jetztMin = 0;
  const kal = await sicher(async () => (await import("./kalender.js")).termine(morgen ? 1 : 0, 1));
  const termine = (kal?.ok ? kal.termine : []).filter((t) => tagKey(new Date(t.start)) === tagKey(tag) || t.ganz).map((t) => {
    const s = new Date(t.start), e = new Date(t.ende || t.start);
    return { titel: t.titel, ganz: t.ganz, vonMin: s.getHours() * 60 + s.getMinutes(), bisMin: tagKey(e) !== tagKey(s) ? 24 * 60 : e.getHours() * 60 + e.getMinutes() };
  });
  const prio = (await sicher(async () => (await import("./persoenlich.js")).prioritaeten())) || [];
  const p = planen({ termine, aufgaben: prio.slice(0, 15), jetztMin, von: d.von, bis: d.bis });
  return {
    ok: true, datum: tagKey(tag), morgen, von: d.von, bis: d.bis, ...p,
    ganztags: termine.filter((t) => t.ganz).map((t) => t.titel),
    kalender: kal?.ok ? { ok: true, anzahl: termine.length } : { ok: false, hinweis: kal?.error || "Kalender nicht erreichbar (Mac-Agent)." },
  };
}
export function arbeitszeitSetzen(von, bis) {
  const a = Math.round(Number(von)), b = Math.round(Number(bis));
  if (!(a >= 5 && a <= 12 && b >= 13 && b <= 23 && b > a)) return { error: "Bitte Start zwischen 5 und 12 Uhr und Ende zwischen 13 und 23 Uhr." };
  const d = lade(); d.von = a; d.bis = b; sichere(d);
  return { ok: true, text: `Planung jetzt von ${a} bis ${b} Uhr.` };
}
export function planSatz(p) {
  const auf = p.bloecke.filter((b) => b.art === "aufgabe");
  const ter = p.bloecke.filter((b) => b.art === "termin");
  const wann = p.morgen ? "Morgen" : "Heute";
  if (!auf.length && !ter.length) return `${wann} ist nichts geplant und nichts offen. Ein freier Tag.`;
  return [
    p.morgen ? "Für heute ist Feierabend, hier ist der Plan für morgen." : "",
    ter.length ? `${ter.length} Termin${ter.length === 1 ? "" : "e"}.` : "",
    auf.length ? `Zuerst um ${auf[0].vonText}: ${auf[0].text}.` : "",
    auf[1] ? `Danach ${auf[1].vonText}: ${auf[1].text}.` : "",
    p.uebrig.length ? `${p.uebrig.length} Aufgabe${p.uebrig.length === 1 ? " passt" : "n passen"} ${p.morgen ? "morgen" : "heute"} nicht mehr rein.` : "",
    !p.kalender.ok ? "Den Kalender konnte ich nicht lesen." : "",
  ].filter(Boolean).join(" ");
}

// ---------- ⏳ Zeitfresser ----------
export const ABLENKUNG = ["netflix", "youtube", "tiktok", "instagram", "facebook", "twitch", "prime video", "disney+", "steam", "reddit", "x", "twitter", "9gag", "candy crush", "roblox", "minecraft", "fortnite", "snapchat"];
export const SYSTEM_APPS = ["loginwindow", "screensaverengine", "dock", "systemuiserver", "control center", "notification center"];

function befehl(cmd, args, ms = 5000) {
  return new Promise((resolve) => {
    try { execFile(cmd, args, { timeout: ms, maxBuffer: 1024 * 1024, env: { ...process.env, LC_ALL: "C" } }, (err, out) => resolve(out ? String(out) : err ? null : "")); } catch { resolve(null); }
  });
}
/** "LSDisplayName"="Safari" → Safari */
export function appNameAus(out) {
  const m = String(out || "").match(/"(?:LSDisplayName|name)"\s*=\s*"([^"]+)"/);
  return m ? kurz(m[1], 60) : null;
}
/** ioreg … "HIDIdleTime" = 123456789 (Nanosekunden) → Sekunden */
export function leerlaufAus(out) {
  const m = String(out || "").match(/"HIDIdleTime"\s*=\s*(\d+)/);
  return m ? Math.round(Number(m[1]) / 1e9) : null;
}
export async function zeitProbe({ minuten = 5 } = {}) {
  const d = lade();
  if (!d.zeitAn) return { ok: true, uebersprungen: true, text: "ausgeschaltet" };
  if (os.platform() !== "darwin") return { ok: true, uebersprungen: true, text: "nur am Mac" };
  const idle = leerlaufAus(await befehl("ioreg", ["-c", "IOHIDSystem", "-d", "4", "-r", "-k", "HIDIdleTime"]));
  if (idle != null && idle > 300) return { ok: true, text: "Mac ruht" };
  const asn = String((await befehl("lsappinfo", ["front"])) || "").trim();
  if (!asn) return { ok: false, text: "Vordergrund-Programm nicht lesbar" };
  const app = appNameAus(await befehl("lsappinfo", ["info", "-only", "name", asn]));
  if (!app || SYSTEM_APPS.includes(app.toLowerCase())) return { ok: true, text: "kein Programm" };
  const k = tagKey();
  (d.apps[k] ||= {})[app] = (d.apps[k][app] || 0) + minuten;
  const alt = Object.keys(d.apps).sort().slice(0, -35);
  for (const x of alt) delete d.apps[x];
  sichere(d);
  return { ok: true, text: app };
}
const istAblenkung = (app, d) => {
  const a = app.toLowerCase();
  if (d.produktiv.includes(a)) return false;
  return d.ablenkung.includes(a) || ABLENKUNG.includes(a);
};
export function zeitAuswerten(apps, d = lade(), heute = tagKey()) {
  const tage = Object.keys(apps).sort().slice(-7);
  const summe = (tagListe) => {
    const m = {};
    for (const t of tagListe) for (const [app, min] of Object.entries(apps[t] || {})) m[app] = (m[app] || 0) + min;
    return Object.entries(m).map(([app, min]) => ({ app, min, ablenkung: istAblenkung(app, d) })).sort((a, b) => b.min - a.min);
  };
  const h = summe([heute]), w = summe(tage);
  const abl = (l) => l.filter((x) => x.ablenkung).reduce((s, x) => s + x.min, 0);
  const ges = (l) => l.reduce((s, x) => s + x.min, 0);
  const tipps = [];
  const schnittAbl = tage.length ? Math.round(abl(w) / tage.length) : 0;
  if (schnittAbl >= 120) tipps.push(`Im Schnitt ${dauerText(schnittAbl)} am Tag mit Ablenkung. Ein fester Fokus-Block am Vormittag hilft.`);
  const top = w.find((x) => x.ablenkung);
  if (top && top.min >= 180) tipps.push(`${top.app} war diese Woche ${dauerText(top.min)} im Vordergrund.`);
  return { heute: h.slice(0, 10), woche: w.slice(0, 12), heuteMin: ges(h), heuteAblenkung: abl(h), wocheMin: ges(w), wocheAblenkung: abl(w), tage: tage.length, tipps };
}
export async function zeitfresser() {
  const d = lade();
  const z = zeitAuswerten(d.apps, d);
  const liegen = (store.getTasks() || []).filter((t) => !t.done && t.at && Date.now() - Number(t.at) > 14 * 864e5);
  return {
    ok: true, an: d.zeitAn, mac: os.platform() === "darwin", ...z,
    liegen: liegen.slice(0, 8).map((t) => ({ text: t.text, tage: Math.round((Date.now() - Number(t.at)) / 864e5) })),
    eigeneAblenkung: d.ablenkung, eigeneProduktiv: d.produktiv,
  };
}
export function appEinordnen(app, ablenkung) {
  const a = kurz(app, 60).toLowerCase();
  if (!a) return { error: "Welches Programm?" };
  const d = lade();
  d.ablenkung = d.ablenkung.filter((x) => x !== a);
  d.produktiv = d.produktiv.filter((x) => x !== a);
  (ablenkung ? d.ablenkung : d.produktiv).push(a);
  sichere(d);
  return { ok: true, text: `${app} zählt jetzt ${ablenkung ? "als Zeitfresser" : "nicht als Zeitfresser"}.` };
}
export function zeitSchalten(an) {
  const d = lade(); d.zeitAn = Boolean(an); sichere(d);
  return { ok: true, text: an ? "Zeitfresser-Messung ist an." : "Zeitfresser-Messung ist aus. Bisherige Werte bleiben, bis du sie löschst." };
}
export function zeitLoeschen() {
  const d = lade(); d.apps = {}; sichere(d);
  eintragen({ bereich: "datenschutz", titel: "Zeitfresser-Werte gelöscht", quelle: "tagesplan" });
  return { ok: true, text: "Alle Zeitfresser-Werte sind gelöscht." };
}

// ---------- 🎯 Jahresziele auf Kurs ----------
/** Frist lesen: 2026-12-31, 31.12.2026, 12/2026, Q3 2026, Ende 2026, 2026. */
export function fristAus(text) {
  const t = String(text || "").toLowerCase().trim();
  let m;
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return new Date(+m[1], +m[2] - 1, +m[3], 23, 59);
  if ((m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) return new Date(+m[3], +m[2] - 1, +m[1], 23, 59);
  if ((m = t.match(/^(\d{1,2})[/.](\d{4})$/))) return new Date(+m[2], +m[1], 0, 23, 59);
  if ((m = t.match(/^q([1-4])\s*(\d{4})$/))) return new Date(+m[2], +m[1] * 3, 0, 23, 59);
  if ((m = t.match(/^(?:ende |bis )?(\d{4})$/))) return new Date(+m[1], 11, 31, 23, 59);
  return null;
}
const quartal = (d) => `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
export function kursPruefen(z, jetzt = new Date()) {
  const fertig = z.schritte.filter((s) => s.erledigt).length;
  const ist = z.schritte.length ? Math.round((fertig / z.schritte.length) * 100) : 0;
  const frist = fristAus(z.frist);
  const offen = z.schritte.filter((s) => !s.erledigt);
  if (ist >= 100) return { ist, soll: 100, status: "fertig", text: "Geschafft.", etappen: [] };
  if (!frist) return { ist, soll: null, status: "ohne", text: "Ohne Frist kann ich den Kurs nicht prüfen.", etappen: [] };
  const anfang = new Date(z.erstellt || jetzt);
  const gesamt = Math.max(1, frist - anfang);
  const soll = Math.max(0, Math.min(100, Math.round(((jetzt - anfang) / gesamt) * 100)));
  // Offene Schritte gleichmäßig auf die restlichen Quartale verteilen.
  const quartale = [];
  for (let d = new Date(jetzt.getFullYear(), Math.floor(jetzt.getMonth() / 3) * 3, 1); d <= frist && quartale.length < 8; d = new Date(d.getFullYear(), d.getMonth() + 3, 1)) quartale.push(quartal(d));
  if (!quartale.length) quartale.push(quartal(jetzt));
  const proQ = Math.ceil(offen.length / quartale.length) || 1;
  const etappen = quartale.map((q, i) => ({ quartal: q, schritte: offen.slice(i * proQ, (i + 1) * proQ).map((s) => s.text) })).filter((e) => e.schritte.length);
  if (frist < jetzt) return { ist, soll: 100, status: "ueberfaellig", text: `Frist vorbei, ${ist} % geschafft.`, etappen };
  const status = ist >= soll - 10 ? "kurs" : "hinterher";
  return { ist, soll, status, text: status === "kurs" ? `Auf Kurs: ${ist} % geschafft, ${soll} % der Zeit vorbei.` : `Hinterher: ${ist} % geschafft, aber schon ${soll} % der Zeit vorbei.`, etappen, frist: tagKey(frist) };
}
export async function jahresziele() {
  const P = await import("./persoenlich.js");
  const liste = P.ziele().map((z) => ({ id: z.id, titel: z.titel, frist: z.frist || "", naechster: z.schritte.find((s) => !s.erledigt)?.text || "", schritte: z.schritte.length, ...kursPruefen(z) }));
  const rang = { hinterher: 0, ueberfaellig: 1, kurs: 2, ohne: 3, fertig: 4 };
  return { ok: true, ziele: liste.sort((a, b) => rang[a.status] - rang[b.status]) };
}

// ---------- 🧹 Wissen aufräumen ----------
const woerter = (t) => new Set(String(t || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ß ]/g, " ").split(/\s+/).filter((w) => w.length >= 3));
export function aehnlich(a, b) {
  const x = woerter(a), y = woerter(b);
  if (!x.size || !y.size) return 0;
  let schnitt = 0;
  for (const w of x) if (y.has(w)) schnitt++;
  return schnitt / (x.size + y.size - schnitt);
}
export function fastGleich(eintraege, schwelle = 0.7) {
  const paare = [];
  const vergeben = new Set();
  const gleich = (t) => String(t || "").trim().toLowerCase();
  for (let i = 0; i < eintraege.length && paare.length < 30; i++) {
    if (vergeben.has(eintraege[i].id)) continue;
    for (let j = i + 1; j < eintraege.length && paare.length < 30; j++) {
      if (vergeben.has(eintraege[j].id) || gleich(eintraege[i].text) === gleich(eintraege[j].text)) continue; // exakt gleiche räumt pflege() auf
      const s = aehnlich(eintraege[i].text, eintraege[j].text);
      if (s >= schwelle) {
        const [lang, kurzE] = eintraege[i].text.length >= eintraege[j].text.length ? [eintraege[i], eintraege[j]] : [eintraege[j], eintraege[i]];
        paare.push({ behalten: { id: lang.id, text: lang.text }, weg: { id: kurzE.id, text: kurzE.text }, prozent: Math.round(s * 100) });
        vergeben.add(kurzE.id);
        if (kurzE === eintraege[i]) break;
      }
    }
  }
  return paare;
}
export async function wissenPruefen({ aufraeumen = false } = {}) {
  const G = await import("./gedaechtnis.js");
  const exakt = aufraeumen ? G.pflege() : null;
  const f = G.fakten();
  const schubladen = {};
  for (const x of f) schubladen[x.schublade] = (schubladen[x.schublade] || 0) + 1;
  const gesehen = new Set();
  const exaktDoppelt = f.filter((x) => { const k = String(x.text || "").trim().toLowerCase(); if (gesehen.has(k)) return true; gesehen.add(k); return false; }).length;
  return { ok: true, anzahl: f.length, exaktDoppelt, schubladen: Object.entries(schubladen).map(([id, n]) => ({ id, name: G.SCHUBLADEN[id]?.name || G.SCHUBLADEN[id]?.[1] || id, n })).sort((a, b) => b.n - a.n), paare: fastGleich(f), exakt };
}
export async function wissenZusammenfuehren(behaltenId, wegId) {
  const G = await import("./gedaechtnis.js");
  const f = G.fakten();
  const b = f.find((x) => x.id === behaltenId), w = f.find((x) => x.id === wegId);
  if (!b || !w || b.id === w.id) return { error: "Diese Einträge gibt es nicht mehr." };
  G.faktLoeschen(w.id);
  eintragen({ bereich: "gedaechtnis", titel: "Fast doppelten Eintrag entfernt", details: `behalten: ${kurz(b.text, 120)} · entfernt: ${kurz(w.text, 120)}`, quelle: "tagesplan" });
  return { ok: true, text: `Zusammengeführt. Behalten: „${kurz(b.text, 80)}“.` };
}

// ---------- Übersicht, Sprache, Routen ----------
export async function uebersicht() {
  const [plan, zeit, ziele, wissen] = await Promise.all([tagesplan(), zeitfresser(), jahresziele().catch((e) => ({ ok: false, error: e.message, ziele: [] })), wissenPruefen().catch((e) => ({ ok: false, error: e.message, paare: [] }))]);
  return { plan, zeit, ziele, wissen };
}

const punkt = (a) => (a && typeof a.answer === "string" ? { ...a, answer: a.answer.replace(/\.\./g, ".") } : a);
export async function quickCommand(text) { return punkt(await quickRoh(text)); }
async function quickRoh(text) {
  const k = String(text || "").toLowerCase().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/, "").replace(/[?!.]+$/, "").trim();
  if (/^(öffne|oeffne|zeig|zeige)( mir)? (die |den |meine |meinen )?(tagesplanung|zeitfresser|jahresziele|mein tag|meinen tag)$/.test(k)) return { answer: "Hier ist dein Tag.", actions: ["cockpit:meintag"] };
  if (/^(plan|plane|planen|plan mir|plane mir) (mir )?(meinen|den) tag|^tagesplanung$|^(mach|erstell|erstelle) (mir )?(einen )?(tagesplan|plan für heute)|^wie (soll ich|plane ich) (meinen|den) tag/.test(k)) {
    return { answer: planSatz(await tagesplan()), actions: ["cockpit:meintag"] };
  }
  if (/zeitfresser|wo (geht|bleibt) meine zeit|wofür (brauche|verbrauche) ich (meine|die) zeit/.test(k)) {
    const z = await zeitfresser();
    if (!z.mac && !z.wocheMin) return { answer: "Die Zeitfresser-Messung läuft nur auf deinem Mac. Dort zählt Friday alle 5 Minuten, welches Programm vorne ist.", actions: ["cockpit:meintag"] };
    if (!z.wocheMin) return { answer: "Ich habe noch keine Werte. Nach ein paar Stunden am Mac weiß ich mehr.", actions: ["cockpit:meintag"] };
    const top = z.woche.slice(0, 3).map((x) => `${x.app} ${dauerText(x.min)}`).join(", ");
    return { answer: `Diese Woche vorne: ${top}. Davon Ablenkung: ${dauerText(z.wocheAblenkung)}.${z.liegen.length ? ` ${z.liegen.length} Aufgabe${z.liegen.length === 1 ? " liegt" : "n liegen"} seit über 2 Wochen.` : ""}`, actions: ["cockpit:meintag"] };
  }
  if (/^(wie stehen|wie steht es um|wie läuft es mit) (meine[nm]? )?(jahres)?ziele|^bin ich (bei meinen zielen )?auf kurs/.test(k)) {
    const j = await jahresziele();
    if (!j.ziele.length) return { answer: "Du hast noch keine Ziele. Leg eins im Cockpit unter Denken an, dann plant Friday die Schritte.", actions: ["cockpit:meintag"] };
    const hint = j.ziele.filter((z) => z.status === "hinterher" || z.status === "ueberfaellig");
    const kurs = j.ziele.filter((z) => z.status === "kurs");
    return { answer: [kurs.length ? `${kurs.length} auf Kurs.` : "", hint.length ? `Hinterher: ${hint.slice(0, 3).map((z) => `${z.titel} (${z.ist} %)`).join(", ")}.` : "", hint[0]?.naechster ? `Nächster Schritt: ${hint[0].naechster}.` : ""].filter(Boolean).join(" ") || `${j.ziele.length} Ziele, noch ohne Frist.`, actions: ["cockpit:meintag"] };
  }
  return null;
}

export function tagesplanRouten(app, asyncRoute) {
  app.get("/api/meintag", asyncRoute(async (_req, res) => res.json(await uebersicht())));
  app.post("/api/meintag/arbeitszeit", (req, res) => res.json(arbeitszeitSetzen(req.body?.von, req.body?.bis)));
  app.post("/api/meintag/app", (req, res) => res.json(appEinordnen(String(req.body?.app || ""), Boolean(req.body?.ablenkung))));
  app.post("/api/meintag/zeit", (req, res) => res.json(req.body?.loeschen ? zeitLoeschen() : zeitSchalten(req.body?.an)));
  app.post("/api/meintag/wissen", asyncRoute(async (req, res) => res.json(req.body?.behalten ? await wissenZusammenfuehren(String(req.body.behalten), String(req.body.weg || "")) : await wissenPruefen({ aufraeumen: true }))));
}

export async function tagesplanStart() {
  try {
    const hz = await import("./herzschlag.js");
    hz.aufgabeRegistrieren("zeitfresser", { name: "Zeitfresser messen", text: "Alle 5 Minuten: welches Programm am Mac vorne ist (nur der Name, keine Fenster, keine Webseiten). Ruht der Mac über 5 Minuten, zählt nichts. Bleibt auf dem Mac.", art: "intervall", minuten: 5, standardAn: true, lauf: () => zeitProbe() });
  } catch (err) { console.error("Mein Tag/Herzschlag:", err.message); }
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "meintag", bereich: "Alltag", name: "Mein Tag (Planung, Zeitfresser, Ziel-Kurs, Wissen)", lauf: async () => {
      const p = planen({ termine: [{ titel: "Arzt", vonMin: 600, bisMin: 660 }], aufgaben: [{ text: "Anrufen", aufwand: 1 }, { text: "Bericht schreiben", aufwand: 3 }, { text: "Mail", aufwand: 2 }], jetztMin: 480, von: 8, bis: 12 });
      const a = p.bloecke.filter((b) => b.art === "aufgabe");
      if (a[0]?.vonText !== "08:00" || p.bloecke.some((b) => b.art === "aufgabe" && b.von < 660 && b.bis > 600)) return { status: "fehler", text: "Tagesplan überschneidet Termine." };
      if (appNameAus('"LSDisplayName"="Safari"') !== "Safari" || leerlaufAus('"HIDIdleTime" = 7000000000') !== 7) return { status: "fehler", text: "Zeitfresser-Auswertung liest falsch." };
      const z = zeitAuswerten({ "2026-01-01": { Netflix: 130, Xcode: 60 } }, { ablenkung: [], produktiv: [] }, "2026-01-01");
      if (z.heuteAblenkung !== 130 || z.heuteMin !== 190) return { status: "fehler", text: "Zeitfresser rechnet falsch." };
      const k = kursPruefen({ frist: "2026-12-31", erstellt: "2026-01-01T00:00:00", schritte: [{ text: "a", erledigt: true }, { text: "b" }, { text: "c" }, { text: "d" }] }, new Date(2026, 6, 1));
      if (k.status !== "hinterher" || k.ist !== 25 || !k.etappen.length) return { status: "fehler", text: "Ziel-Kurs falsch berechnet." };
      if (fastGleich([{ id: 1, text: "Kevin trinkt morgens gerne Kaffee" }, { id: 2, text: "Kevin trinkt morgens gerne schwarzen Kaffee" }, { id: 3, text: "Lieblingsfarbe Orange" }]).length !== 1) return { status: "fehler", text: "Fast gleiche Einträge werden falsch erkannt." };
      const echt = await tagesplan();
      const mac = os.platform() === "darwin";
      return { status: "bestanden", text: `Rechnungen geprüft. Echt: ${echt.bloecke.length} Blöcke geplant${echt.kalender.ok ? " mit Kalender" : ", Kalender nicht erreichbar"}.${mac ? "" : " Zeitfresser-Messung nur am Mac."}` };
    } });
  } catch (err) { console.error("Mein Tag/Funktionstest:", err.message); }
}
