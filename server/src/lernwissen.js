// Carlas Lernecke (v1.115.0): mehr als Karteikarten.
// - Wissen aus dem Internet: Friday schlägt das Thema bei Wikipedia nach (kostenlos, ohne Guthaben)
//   und macht daraus auf Wunsch Karten, eine Tabelle oder Übungsaufgaben.
// - Übungsaufgaben aus den eigenen Karten (ohne Claude): Multiple Choice, Lückentext, Wahr/Falsch,
//   Zuordnen und Reihenfolge.
// - Tabellen: jeder Stapel lässt sich als Tabelle ansehen, bearbeiten und exportieren.
// - Mit Guthaben: Claude erstellt Aufgaben, Tabelle und Karten zu einem Thema.
import { denke, jsonAus } from "./denker.js";
import * as logbuch from "./logbuch.js";

const WIKI = "https://de.wikipedia.org";
const UA = { "User-Agent": "FRIDAY-Lernecke/1.0 (privater Lernhelfer)", Accept: "application/json" };
const kurz = (s, n) => String(s ?? "").slice(0, n);
const sauber = (s) => String(s || "").replace(/\s+/g, " ").trim();
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const mischen = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

// ---------- Sätze trennen (ohne bei „z. B.“ oder „ca. 5“ zu zerschneiden) ----------
const ABK = ["z. B.", "z.B.", "d. h.", "d.h.", "u. a.", "u.a.", "bzw.", "ca.", "etc.", "evtl.", "ggf.", "inkl.", "Nr.", "S.", "vgl.", "v. Chr.", "n. Chr.", "Jh.", "Mio.", "Mrd.", "bspw.", "usw.", "sog.", "u. U.", "o. ä.", "Dr.", "St.", "lat.", "griech.", "engl.", "franz."];
export function saetze(text) {
  let t = sauber(text);
  ABK.forEach((a, i) => { t = t.split(a).join(`§${i}§`); });
  t = t.replace(/(\d)\.\s(?=\d|[a-zäöü]|(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Jahrhundert|Jahrtausend|Weltkrieg)\b)/g, "$1§p§ ");
  return t.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9„"(])/)
    .map((s) => s.replace(/§(\d+)§/g, (_, i) => ABK[+i]).replace(/§p§/g, ".").trim())
    .filter((s) => s.length > 2);
}

// ---------- Wikipedia ----------
const cache = new Map();
const UNWICHTIG = /^(literatur|weblinks|einzelnachweise|siehe auch|anmerkungen|quellen|belege|filmografie|diskografie|werke|rezeption in der populärkultur|trivia|fußnoten|weitere|verwandte themen)/i;
async function holeJson(url) {
  let r;
  try { r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000) }); } catch { throw new Error("Ich komme gerade nicht ins Internet. Ist der Mac online? Versuch es gleich nochmal."); }
  if (!r.ok) throw new Error(`Wikipedia antwortet gerade nicht (Fehler ${r.status}). Versuch es gleich nochmal.`);
  return r.json();
}
const ohneHtml = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Text einer Wikipedia-Seite in Einleitung und Abschnitte zerlegen. */
export function abschnitteAus(text) {
  const teile = String(text || "").split(/^(={2,6})\s*(.+?)\s*\1\s*$/m);
  const einleitung = sauber(teile[0]);
  const abschnitte = [];
  for (let i = 1; i + 2 < teile.length + 1; i += 3) {
    const ebene = (teile[i] || "").length, titel = sauber(teile[i + 1]), inhalt = sauber(teile[i + 2]);
    if (!titel) continue;
    if (UNWICHTIG.test(titel)) { if (ebene === 2) break; continue; }
    if (inhalt.length < 40) continue;
    abschnitte.push({ titel, text: kurz(saetze(inhalt).slice(0, 4).join(" "), 900) });
    if (abschnitte.length >= 8) break;
  }
  return { einleitung, abschnitte };
}

/** Thema bei Wikipedia nachschlagen. q = Suchbegriff, titel = genau diese Seite. */
export async function webSuchen({ q, titel } = {}) {
  const such = sauber(titel || q).slice(0, 160);
  if (!such) throw new Error("Wonach soll ich suchen?");
  const key = `${titel ? "t" : "q"}:${such.toLowerCase()}`;
  const alt = cache.get(key);
  if (alt && Date.now() - alt.at < 6 * 3600 * 1000) return alt.wert;
  let weitere = [];
  let seite = titel ? such : null;
  if (!seite) {
    const s = await holeJson(`${WIKI}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(such)}&srlimit=6&srprop=snippet&format=json&formatversion=2&utf8=1`);
    const treffer = s?.query?.search || [];
    if (!treffer.length) {
      const e = new Error(`Zu „${such}“ habe ich bei Wikipedia nichts gefunden. Versuch ein anderes Wort.`);
      e.status = 404; throw e;
    }
    seite = treffer[0].title;
    weitere = treffer.slice(1).map((t) => ({ titel: t.title, text: kurz(sauber(ohneHtml(t.snippet)), 160) }));
  }
  const d = await holeJson(`${WIKI}/w/api.php?action=query&prop=extracts%7Cpageimages%7Cinfo%7Cpageprops&ppprop=disambiguation&inprop=url&explaintext=1&exsectionformat=wiki&exchars=12000&piprop=thumbnail&pithumbsize=480&redirects=1&titles=${encodeURIComponent(seite)}&format=json&formatversion=2&utf8=1`);
  const p = d?.query?.pages?.[0];
  if (!p || p.missing || !p.extract) { const e = new Error(`Die Seite „${seite}“ gibt es bei Wikipedia nicht.`); e.status = 404; throw e; }
  const { einleitung, abschnitte } = abschnitteAus(p.extract);
  if (p.pageprops && "disambiguation" in p.pageprops) {
    const e = new Error(`„${p.title}“ hat bei Wikipedia mehrere Bedeutungen. Sag es bitte genauer, z. B. „${p.title} Biologie“.`); e.status = 404; throw e;
  }
  const wert = {
    titel: p.title,
    zusammenfassung: kurz(saetze(einleitung).slice(0, 4).join(" "), 900),
    einleitung: kurz(einleitung, 3000),
    abschnitte,
    bild: p.thumbnail?.source || "",
    link: p.fullurl || `${WIKI}/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
    weitere,
    quelle: "Wikipedia (CC BY-SA 4.0)",
  };
  cache.set(key, { at: Date.now(), wert });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  logbuch.eintragen({ bereich: "lernen", titel: `Lernecke: bei Wikipedia „${p.title}“ nachgeschlagen` });
  return wert;
}

/** Aus nachgeschlagenem Wissen Karteikarten machen (ohne Claude). */
export function kartenAusWissen(w) {
  const titel = sauber(w?.titel);
  if (!titel) return { titel: null, karten: [] };
  const karten = [];
  const intro = saetze(w.einleitung || w.zusammenfassung || "");
  if (intro.length) karten.push({ frage: `Was ist ${titel}?`, antwort: intro.slice(0, 2).join("\n") });
  if (intro.length > 2) karten.push({ frage: `${titel}: Was ist noch wichtig?`, antwort: intro.slice(2, 5).join("\n") });
  for (const a of (w.abschnitte || []).slice(0, 8)) {
    const s = saetze(a.text).slice(0, 3);
    if (s.length) karten.push({ frage: `${titel}: ${a.titel}`, antwort: s.join("\n") });
  }
  return { titel, karten: karten.map((k) => ({ frage: kurz(k.frage, 400), antwort: kurz(k.antwort, 3000), reihenfolge: false })) };
}

/** Wissen als kleine Tabelle (Thema → kurz erklärt). */
export function tabelleAusWissen(w) {
  const zeilen = [];
  const intro = saetze(w?.einleitung || w?.zusammenfassung || "");
  if (intro[0]) zeilen.push(["Was ist das?", intro[0]]);
  for (const a of (w?.abschnitte || [])) zeilen.push([a.titel, saetze(a.text)[0] || a.text]);
  return { titel: sauber(w?.titel) || "Tabelle", spalten: ["Thema", "Kurz erklärt"], zeilen };
}

// ---------- Übungsaufgaben aus Karten (ohne Claude) ----------
const punkte = (a) => String(a || "").split("\n").map((s) => s.replace(/^\s*(?:[-–•*]|\d+[.)])\s*/, "").trim()).filter(Boolean);
const kurzAntwort = (k) => { const p = punkte(k.antwort); if (!p.length) return ""; const t = p.slice(0, 4).join("; "); return t.length > 160 ? `${t.slice(0, 157).replace(/\s+\S*$/, "")} …` : t; };
const STOPP = new Set("aber alle allem allen aller alles also andere anderen auch auf aus bei beim bzw dabei damit dann darum dass dein deine dem den denn der deren des dessen die dies diese diesem diesen dieser dieses doch dort durch eine einem einen einer eines etwa euch ganz gegen haben hatte hier ihre ihrem ihren ihrer immer indem jede jedem jeden jeder jedes jetzt kann kein keine können machen mehr meist mich mit muss nach nicht noch nur oder ohne sehr sein seine seinem seinen seiner sich sind sowie über unter viel viele vom von vor wann warum was weil weiter welche welchem welchen welcher wenn werden wieder wird wurde wurden zum zur zwischen".split(" "));
function lueckeAus(k) {
  const satz = punkte(k.antwort).join(" · ");
  if (satz.length < 8) return null;
  const woerter = (satz.match(/[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]{3,}/g) || []).filter((x) => !STOPP.has(x.toLowerCase()));
  if (!woerter.length) return null;
  // Am liebsten ein langes Hauptwort (großgeschrieben), sonst das längste Wort.
  const haupt = woerter.filter((x) => /^[A-ZÄÖÜ]/.test(x) && x.length >= 5);
  const wort = (haupt.length ? haupt : woerter).sort((a, b) => b.length - a.length)[Math.floor(Math.random() * Math.min(2, (haupt.length || woerter.length)))];
  const i = satz.indexOf(wort);
  const text = kurz(satz, 260);
  if (i < 0 || i + wort.length > text.length) return null;
  return { satz: `${text.slice(0, i)}_____${text.slice(i + wort.length)}`, loesung: wort };
}
const ARTEN = ["mc", "luecke", "wahrfalsch", "zuordnen", "reihenfolge"];
export const ART_NAME = { mc: "Multiple Choice", luecke: "Lückentext", wahrfalsch: "Wahr oder falsch?", zuordnen: "Zuordnen", reihenfolge: "Reihenfolge", frei: "Frage" };

/** Übungsaufgaben aus Karten erstellen. art = mix | mc | luecke | wahrfalsch | zuordnen | reihenfolge */
export function aufgabenAusKarten(karten, { art = "mix", anzahl = 8 } = {}) {
  const alle = (karten || []).filter((k) => sauber(k?.frage));
  const mitAntwort = alle.filter((k) => kurzAntwort(k));
  const n = Math.max(1, Math.min(30, Number(anzahl) || 8));
  const arten = art === "mix" || !ARTEN.includes(art) ? ARTEN : [art];
  const aufgaben = [];
  const benutzt = new Map(ARTEN.map((a) => [a, new Set()]));
  const baue = {
    mc: (k) => {
      const richtig = kurzAntwort(k);
      const falsche = mischen([...new Set(mitAntwort.filter((x) => x !== k).map(kurzAntwort).filter((x) => x && x !== richtig))]).slice(0, 3);
      if (!falsche.length) return null;
      return { art: "mc", frage: k.frage, optionen: mischen([richtig, ...falsche]), loesung: richtig };
    },
    luecke: (k) => { const l = lueckeAus(k); return l ? { art: "luecke", frage: k.frage, satz: l.satz, loesung: l.loesung } : null; },
    wahrfalsch: (k) => {
      const andere = mitAntwort.filter((x) => x !== k && kurzAntwort(x) !== kurzAntwort(k));
      const wahr = !andere.length || Math.random() < 0.5;
      const aussage = wahr ? kurzAntwort(k) : kurzAntwort(andere[Math.floor(Math.random() * andere.length)]);
      return { art: "wahrfalsch", frage: k.frage, aussage, loesung: wahr ? "wahr" : "falsch", richtig: kurzAntwort(k) };
    },
    reihenfolge: (k) => {
      const p = punkte(k.antwort);
      if (p.length < 3 || p.length > 10) return null;
      let schritte = mischen(p);
      for (let v = 0; v < 5 && schritte.join("|") === p.join("|"); v++) schritte = mischen(p);
      return { art: "reihenfolge", frage: k.frage, schritte, loesung: p };
    },
  };
  // Zuordnen ist eine Aufgabe mit bis zu 5 Paaren aus verschiedenen Karten.
  const zuordnen = () => {
    const paare = mischen(mitAntwort).slice(0, 5).map((k) => ({ links: kurz(k.frage, 120), rechts: kurzAntwort(k), karte: k.id }));
    if (paare.length < 3) return null;
    return { art: "zuordnen", frage: "Was gehört zusammen?", paare, rechts: mischen(paare.map((p) => p.rechts)) };
  };
  let zuordnenDa = false;
  // Jede Aufgabenart bekommt ihre eigene, gemischte Reihenfolge, damit nicht alle Arten an derselben Karte hängen.
  const pool = mitAntwort.length ? mitAntwort : alle;
  const reihen = Object.fromEntries(ARTEN.map((a) => [a, mischen(pool)]));
  for (let runde = 0; aufgaben.length < n && runde < n * 6; runde++) {
    const a = arten[runde % arten.length];
    if (a === "zuordnen") {
      if (zuordnenDa) { if (arten.length === 1) break; continue; }
      zuordnenDa = true;
      const z = zuordnen();
      if (z) aufgaben.push(z);
      continue;
    }
    const frei = reihen[a].filter((k) => !benutzt.get(a).has(k));
    if (!frei.length) { if (arten.every((x) => x === "zuordnen" || !pool.some((k) => !benutzt.get(x).has(k)))) break; continue; }
    const k = frei[0];
    benutzt.get(a).add(k);
    const x = baue[a](k);
    if (x) aufgaben.push({ ...x, karte: k.id });
  }
  const fertig = aufgaben.slice(0, n).map((x) => ({ id: neueId(), titel: ART_NAME[x.art], ...x }));
  let hinweis = "";
  if (!alle.length) hinweis = "Im Stapel sind noch keine Karten.";
  else if (!fertig.length) hinweis = "Aus diesen Karten konnte ich keine Aufgaben machen. Mehr Karten mit Antworten helfen (mindestens 2, für Zuordnen 3).";
  else if (fertig.length < n) hinweis = `Mit diesen Karten gingen ${fertig.length} Aufgaben. Mehr Karten = mehr Aufgaben.`;
  return { aufgaben: fertig, hinweis };
}

/** Stapel als Tabelle. */
export function tabelleAusKarten(s) {
  return { titel: s?.titel || "Tabelle", spalten: ["Begriff / Frage", "Antwort"], zeilen: (s?.karten || []).map((k) => [k.frage, k.antwort || ""]), ids: (s?.karten || []).map((k) => k.id) };
}

/** Arbeitsblatt als Text (für Archiv oder zum Ausdrucken), Lösungen am Ende. */
export function arbeitsblattText(titel, aufgaben) {
  const z = [`Arbeitsblatt: ${titel}`, "=".repeat(Math.min(60, titel.length + 13)), ""];
  const l = ["", "Lösungen", "--------"];
  (aufgaben || []).forEach((a, i) => {
    const nr = `${i + 1}.`;
    if (a.art === "mc") { z.push(`${nr} ${a.frage}`, ...a.optionen.map((o, j) => `   ${"abcd"[j]}) ${o}`)); l.push(`${nr} ${"abcd"[a.optionen.indexOf(a.loesung)]}) ${a.loesung}`); }
    else if (a.art === "luecke") { z.push(`${nr} ${a.frage}`, `   ${a.satz}`); l.push(`${nr} ${a.loesung}`); }
    else if (a.art === "wahrfalsch") { z.push(`${nr} ${a.frage}: „${a.aussage}“ – wahr oder falsch?`); l.push(`${nr} ${a.loesung}`); }
    else if (a.art === "zuordnen") { z.push(`${nr} ${a.frage}`, ...a.paare.map((p, j) => `   ${j + 1}. ${p.links}`), ...a.rechts.map((r, j) => `   ${"ABCDE"[j]}. ${r}`)); l.push(`${nr} ${a.paare.map((p, j) => `${j + 1}-${"ABCDE"[a.rechts.indexOf(p.rechts)]}`).join(", ")}`); }
    else if (a.art === "reihenfolge") { z.push(`${nr} Bring in die richtige Reihenfolge: ${a.frage}`, ...a.schritte.map((s) => `   ☐ ${s}`)); l.push(`${nr} ${a.loesung.join(" → ")}`); }
    else { z.push(`${nr} ${a.frage}`, "   ______________________________"); l.push(`${nr} ${a.loesung}`); }
    z.push("");
  });
  return [...z, ...l].join("\n");
}

// ---------- Mit Claude (braucht Guthaben) ----------
/** Claude erstellt Übungsaufgaben, eine Tabelle und Karten zu einem Thema (aus Karten oder Wikipedia-Text). */
export async function kiAufgaben({ thema, karten = [], text = "", anzahl = 8 }) {
  const stoff = [
    karten.length ? `Lernkarten:\n${karten.slice(0, 60).map((k) => `- ${k.frage}: ${String(k.antwort || "").replace(/\n/g, "; ")}`).join("\n")}` : "",
    text ? `Infotext:\n${String(text).slice(0, 10000)}` : "",
  ].filter(Boolean).join("\n\n");
  if (!thema && !stoff) throw new Error("Kein Thema und keine Karten.");
  const n = Math.max(3, Math.min(15, Number(anzahl) || 8));
  const r = await denke({
    stufe: "mittel", quelle: "lernen", maxTokens: 5000,
    system: `Du bist Lernhelfer für Carla. Erstelle auf Deutsch abwechslungsreiche Übungsaufgaben, eine Übersichtstabelle und Karteikarten. Halte dich an den gegebenen Stoff, erfinde keine Fakten. Antworte NUR mit JSON:
{"titel":"…","aufgaben":[{"art":"mc","frage":"…","optionen":["…","…","…","…"],"loesung":"genau eine der Optionen","erklaerung":"1 Satz"},{"art":"luecke","frage":"…","satz":"Satz mit _____ als Lücke","loesung":"Wort"},{"art":"wahrfalsch","frage":"Thema","aussage":"…","loesung":"wahr|falsch","erklaerung":"…"},{"art":"frei","frage":"offene Frage","loesung":"Musterlösung kurz"}],"tabelle":{"spalten":["…","…"],"zeilen":[["…","…"]]},"karten":[{"frage":"…","antwort":"…"}]}`,
    text: `Thema: ${thema || "(siehe Stoff)"}\nAnzahl Aufgaben: ${n}\n\n${stoff}`,
  });
  if (!r.ok) { const e = new Error(r.error); e.status = r.leer ? 402 : 502; throw e; }
  const j = jsonAus(r.text) || {};
  const aufgaben = (Array.isArray(j.aufgaben) ? j.aufgaben : []).map((a) => {
    const art = ["mc", "luecke", "wahrfalsch", "frei"].includes(a?.art) ? a.art : "frei";
    const x = { id: neueId(), art, titel: ART_NAME[art], frage: kurz(sauber(a.frage), 400), loesung: kurz(sauber(a.loesung), 400), erklaerung: kurz(sauber(a.erklaerung), 400) };
    if (art === "mc") { x.optionen = (a.optionen || []).map((o) => kurz(sauber(o), 200)).filter(Boolean).slice(0, 5); if (!x.optionen.includes(x.loesung)) x.optionen.push(x.loesung); x.optionen = mischen(x.optionen); }
    if (art === "luecke") { x.satz = kurz(sauber(a.satz), 400); if (!x.satz.includes("_")) return null; }
    if (art === "wahrfalsch") { x.aussage = kurz(sauber(a.aussage), 400); x.loesung = /^f/i.test(x.loesung) ? "falsch" : "wahr"; }
    return x.frage && x.loesung ? x : null;
  }).filter(Boolean).slice(0, 20);
  if (!aufgaben.length) throw new Error("Die KI hat keine Aufgaben geliefert. Versuch es nochmal.");
  const sp = Array.isArray(j.tabelle?.spalten) ? j.tabelle.spalten.map((s) => kurz(sauber(s), 60)).slice(0, 5) : [];
  const tabelle = sp.length >= 2 ? { titel: kurz(sauber(j.titel || thema), 120), spalten: sp, zeilen: (j.tabelle.zeilen || []).filter(Array.isArray).slice(0, 40).map((z) => sp.map((_, i) => kurz(sauber(z[i]), 400))) } : null;
  const kk = (Array.isArray(j.karten) ? j.karten : []).map((k) => ({ frage: kurz(sauber(k?.frage), 400), antwort: kurz(String(k?.antwort || "").trim(), 3000), reihenfolge: false })).filter((k) => k.frage).slice(0, 40);
  return { titel: kurz(sauber(j.titel || thema), 120), aufgaben, tabelle, karten: kk, model: r.model, ki: true };
}
