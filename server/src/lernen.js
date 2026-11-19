// Carlas Lernecke (v1.108.0): Lernkarten scannen, speichern, abfragen und wiederholen.
// Alles läuft OHNE Claude: Die Texterkennung macht Apple Vision auf dem Mac (oder Tesseract im Browser),
// der Vergleich der Antwort passiert hier mit Stichworten und Tippfehler-Toleranz.
// Nur die Knöpfe mit „braucht Guthaben“ (KI liest Handschrift, KI prüft, KI erklärt) fragen Claude.
// Carlas Daten liegen getrennt von Kevins in data/lernen.json und data/lernen-bilder/.
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { DATA_DIR, ROOT } from "./config.js";
import { teile, tagPlus, U } from "./datum.js";
import { denke, jsonAus } from "./denker.js";
import * as archiv from "./lernarchiv.js";

const DATEI = "lernen";
const BILDER = path.join(DATA_DIR, "lernen-bilder");
const NAME = "Carla";
const leer = { profil: { name: NAME, besuche: 0, erster: null, letzter: null }, stapel: [], sitzungen: [] };
const laden = () => { const d = store.load(DATEI, leer); return { ...structuredClone(leer), ...d, profil: { ...leer.profil, ...(d.profil || {}) } }; };
const speichern = (d) => store.save(DATEI, d);
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ymd = (t) => `${t.y}-${String(t.m).padStart(2, "0")}-${String(t.d).padStart(2, "0")}`;
const heute = () => ymd(teile());
const inTagen = (n) => ymd(tagPlus(n));
const kurz = (s, n) => String(s ?? "").slice(0, n);

// ---------- Wiederholung (Lernkartei mit 5 Fächern) ----------
// Fach 1 = jeden Tag, dann 1, 3, 7, 14 Tage später. Falsch = zurück in Fach 1.
const ABSTAND = [0, 1, 1, 3, 7, 14];
const FAECHER = 5;

// ---------- Text vergleichen ----------
const STOPP = new Set(("der die das den dem des ein eine einer einem einen eines und oder aber auch als am an auf aus bei bis "
  + "durch für fuer gegen im in ins ist sind war waren wird werden wurde wurden hat haben hatte sein seine ihr ihre es er sie wir "
  + "man mit nach nicht noch nur ob ohne so um vom von vor wie was wer wo zu zum zur sich dass da dann denn doch ja nein mal "
  + "sehr viel mehr kann können koennen muss müssen muessen soll sollen also halt eben einfach dies diese dieser dieses jetzt "
  + "ich du mich dich mir dir uns euch ähm aehm äh aeh hm genau glaube ok okay naja quasi sozialer").split(" "));
const ZAHLWORT = { null: 0, eins: 1, ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwoelf: 12, dreizehn: 13, vierzehn: 14, fuenfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19, zwanzig: 20, dreissig: 30, vierzig: 40, fuenfzig: 50, hundert: 100, tausend: 1000 };
export const norm = (s) => String(s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
function stamm(w) {
  if (/^\d+$/.test(w)) return w;
  let s = w;
  for (const e of ["ungen", "ung", "ern", "en", "er", "es", "em", "e", "n", "s"]) {
    if (s.length - e.length >= 4 && s.endsWith(e)) { s = s.slice(0, -e.length); break; }
  }
  return s;
}
function woerter(text) {
  return norm(text).split(" ").filter(Boolean).map((w) => (ZAHLWORT[w] !== undefined && !["ein", "eine"].includes(w) ? String(ZAHLWORT[w]) : w));
}
/** Stichworte eines Textes (ohne Füllwörter), als Wortstämme. */
export function stichworte(text) {
  const out = [];
  for (const w of woerter(text)) {
    if (STOPP.has(w)) continue;
    if (w.length < 3 && !/^\d+$/.test(w)) continue;
    const s = stamm(w);
    if (!out.some((x) => x.s === s)) out.push({ w, s });
  }
  return out;
}
function abstand(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 3) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
/** Wie gut passt ein gesprochenes Wort zu einem Stichwort? 0 = gar nicht, 1 = genau. */
function passt(kw, wort) {
  if (kw === wort) return 1;
  if (/^\d+$/.test(kw) || /^\d+$/.test(wort)) return 0;
  const d = abstand(kw, wort);
  const erlaubt = kw.length >= 9 ? 2 : kw.length >= 5 ? 1 : 0;
  if (d <= erlaubt) return 1 - d * 0.1;
  // Zusammengesetzte Wörter: "Zellkern" enthält "kern", "Photosynthese" ≈ "Fotosynthese"
  if (kw.length >= 4 && wort.length > kw.length && wort.includes(kw)) return 0.85;
  if (wort.length >= 5 && kw.includes(wort) && wort.length >= kw.length * 0.7) return 0.75;
  const k2 = kw.replace(/ph/g, "f").replace(/th/g, "t").replace(/c(?=[aou])/g, "k").replace(/y/g, "i");
  const w2 = wort.replace(/ph/g, "f").replace(/th/g, "t").replace(/c(?=[aou])/g, "k").replace(/y/g, "i");
  if (k2 === w2 || (k2.length >= 5 && abstand(k2, w2) <= erlaubt)) return 0.85;
  return 0;
}

const NUMMER = /^\s*(?:\(?\d{1,2}[.)]|[a-h][.)]|schritt \d+:?)\s+/i;
const AUFZ = /^\s*(?:[-–—•*·▪►✓→>]|\(?\d{1,2}[.)]|[a-h][.)])\s*/;
/** Zerlegt die Antwort einer Karte in einzelne Punkte (Stichpunkte, nummerierte Liste oder Aufzählung). */
export function punkteVon(antwort) {
  const zeilen = String(antwort || "").split(/\n+/).map((z) => z.trim()).filter(Boolean);
  if (zeilen.length > 1) return zeilen.map((z) => z.replace(AUFZ, "").trim()).filter(Boolean);
  const z = (zeilen[0] || "").replace(AUFZ, "").trim();
  if (!z) return [];
  const saetze = z.split(/(?<=[.!?;])\s+(?=[A-ZÄÖÜ0-9])/).map((s) => s.trim()).filter(Boolean);
  if (saetze.length > 1) return saetze;
  // "Prophase, Metaphase, Anaphase und Telophase" → 4 Punkte (nur wenn die Teile kurz sind)
  const teileK = z.replace(/[.!]$/, "").split(/\s*(?:,|;|\bund\b|\bsowie\b|→|->)\s*/i).map((s) => s.trim()).filter(Boolean);
  if (teileK.length >= 2 && teileK.every((t) => t.split(/\s+/).length <= 4)) return teileK;
  return [z];
}
const istNummeriert = (antwort) => {
  const z = String(antwort || "").split(/\n+/).filter((x) => x.trim());
  return z.length >= 2 && z.filter((x) => NUMMER.test(x)).length >= Math.ceil(z.length * 0.6);
};
export function reihenfolgeWichtig(karte) {
  if (karte?.reihenfolge === true || karte?.reihenfolge === false) return karte.reihenfolge;
  return istNummeriert(karte?.antwort) || /→|->/.test(karte?.antwort || "");
}

/**
 * Vergleicht Carlas Antwort mit der Karte.
 * @returns {{ergebnis:"richtig"|"teilweise"|"falsch", quote:number, punkte:Array, fehlt:string[], reihenfolgeFalsch:boolean, sprechText:string}}
 */
export function vergleiche(karte, antwort, { reihenfolge = "auto" } = {}) {
  const punkte = punkteVon(karte?.antwort);
  const einzeln = woerter(antwort);
  // Auch zwei Wörter zusammen prüfen ("pro phase" → "prophase"), weil die Spracherkennung oft trennt.
  const gesagt = [
    ...einzeln.map((w, i) => ({ w, s: stamm(w), idx: [i] })),
    ...einzeln.slice(1).map((w, i) => ({ w: einzeln[i] + w, s: stamm(einzeln[i] + w), idx: [i, i + 1] })),
  ];
  const pruefeReihe = reihenfolge === "immer" ? punkte.length > 1 : reihenfolge === "nie" ? false : reihenfolgeWichtig(karte) && punkte.length > 1;
  const genutzt = new Set();
  const ergebnisse = punkte.map((p, pi) => {
    const kws = stichworte(p);
    if (!kws.length) return { text: p, getroffen: true, anteil: 1, pos: -1, fehlende: [] };
    let treffer = 0;
    let pos = Infinity;
    const fehlende = [];
    for (const kw of kws) {
      let best = 0, bestI = -1;
      gesagt.forEach((g, gi) => {
        if (g.idx.some((i) => genutzt.has(i))) return; // jedes gesagte Wort zählt nur für einen Punkt
        const wert = Math.max(passt(kw.s, g.s), passt(kw.w, g.w));
        if (wert > best) { best = wert; bestI = gi; }
      });
      if (best >= 0.75) { treffer++; pos = Math.min(pos, gesagt[bestI].idx[0]); if (punkte.length > 1) gesagt[bestI].idx.forEach((i) => genutzt.add(i)); }
      else fehlende.push(kw.w);
    }
    const anteil = treffer / kws.length;
    // Ein Punkt zählt, wenn gut die Hälfte seiner Stichworte genannt wurde (bei 1–2 Stichworten: eins).
    const noetig = kws.length <= 2 ? 1 / kws.length : 0.5;
    return { text: p, getroffen: anteil >= noetig - 1e-9, anteil, pos: Number.isFinite(pos) ? pos : -1, fehlende, nr: pi + 1 };
  });
  const n = ergebnisse.length || 1;
  const getroffen = ergebnisse.filter((e) => e.getroffen);
  // Bei nur einem Punkt (ein Satz/eine Definition) zählt der Anteil der Stichworte.
  const quote = ergebnisse.length === 1 ? ergebnisse[0].anteil : getroffen.length / n;
  let reihenfolgeFalsch = false;
  if (pruefeReihe && getroffen.length >= 2) {
    const pos = getroffen.map((e) => e.pos);
    reihenfolgeFalsch = pos.some((p, i) => i > 0 && p < pos[i - 1]);
  }
  let ergebnis = quote >= 0.8 ? "richtig" : quote >= 0.4 ? "teilweise" : "falsch";
  if (ergebnis === "richtig" && reihenfolgeFalsch) ergebnis = "teilweise";
  const fehltPunkte = ergebnisse.filter((e) => !e.getroffen).map((e) => e.text);
  const fehlt = ergebnisse.length === 1 ? ergebnisse[0].fehlende : fehltPunkte;
  return { ergebnis, quote: Math.round(quote * 100) / 100, punkte: ergebnisse.map(({ text, getroffen: g, nr }) => ({ text, getroffen: g, nr })), fehlt, reihenfolgeFalsch, pruefeReihe, sprechText: rueckmeldung({ ergebnis, quote, fehlt, reihenfolgeFalsch, punkte, karte, leer: !einzeln.length }) };
}

const liste = (a) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} und ${a[a.length - 1]}`);
const zufall = (a) => a[Math.floor(Math.random() * a.length)];
function rueckmeldung({ ergebnis, fehlt, reihenfolgeFalsch, punkte, karte, leer: nichts }) {
  const loesung = punkte.length > 1 ? liste(punkte) : String(karte?.antwort || "").replace(/\s+/g, " ").trim();
  if (nichts) return `Ich habe keine Antwort gehört. Richtig wäre: ${loesung}`;
  if (ergebnis === "richtig") return zufall(["Richtig! Super, Carla.", "Genau richtig!", "Perfekt, das sitzt.", "Richtig, stark!"]);
  if (reihenfolgeFalsch && !fehlt.length) return `Inhaltlich alles drin, aber die Reihenfolge stimmt nicht. Richtig ist: ${liste(punkte.map((p, i) => `${i + 1}. ${p}`))}`;
  const zuViel = fehlt.length > 4;
  const fehltText = zuViel ? `${liste(fehlt.slice(0, 4))} und noch ${fehlt.length - 4} weitere Punkte` : liste(fehlt);
  if (ergebnis === "teilweise") {
    let t = `Fast. Du hast vergessen: ${fehltText}.`;
    if (reihenfolgeFalsch) t += " Und die Reihenfolge war nicht ganz richtig.";
    return t;
  }
  return `Leider nicht ganz. Richtig wäre: ${loesung}`;
}

// ---------- Karten aus gescanntem Text bauen ----------
const TRENNER = /^\s*(?:-{3,}|\*{3,}|={3,}|_{3,}|#{3,})\s*$/;
const FRAGE_MARK = /^\s*(?:frage|f|q|vorderseite|vorne|begriff)\s*[:.)]\s*/i;
const ANTWORT_MARK = /^\s*(?:antwort|a|lösung|loesung|rückseite|rueckseite|hinten|erklärung|erklaerung|definition)\s*[:.)]\s*/i;
const PAAR = /^\s*(?:[-–•*]\s*)?([^:=–—]{2,80}?)\s*(?::|=|\s[–—-]\s)\s*(.{2,})$/;
const sauber = (s) => String(s || "").replace(/[ \t]+/g, " ").replace(/­/g, "").trim();

/** Macht aus Text (vom Scan oder abgetippt) einen Vorschlag für Lernkarten. */
export function kartenAusText(text) {
  const zeilen = String(text || "").replace(/\r/g, "").split("\n").map(sauber);
  const karten = [];
  // 1) Ausdrücklich "Frage: … / Antwort: …"
  if (zeilen.some((z) => FRAGE_MARK.test(z)) && zeilen.some((z) => ANTWORT_MARK.test(z))) {
    let akt = null, modus = null;
    for (const z of zeilen) {
      if (!z) continue;
      if (FRAGE_MARK.test(z)) { if (akt?.frage) karten.push(akt); akt = { frage: z.replace(FRAGE_MARK, ""), antwort: "" }; modus = "f"; continue; }
      if (ANTWORT_MARK.test(z)) { if (!akt) akt = { frage: "", antwort: "" }; akt.antwort = z.replace(ANTWORT_MARK, ""); modus = "a"; continue; }
      if (!akt) continue;
      if (modus === "f") akt.frage += ` ${z}`; else akt.antwort += (akt.antwort ? "\n" : "") + z;
    }
    if (akt?.frage) karten.push(akt);
    return fertig(karten, null);
  }
  // 2) Blöcke (durch Leerzeilen oder --- getrennt)
  const bloecke = [];
  let b = [];
  for (const z of zeilen) {
    if (!z || TRENNER.test(z)) { if (b.length) bloecke.push(b); b = []; continue; }
    b.push(z);
  }
  if (b.length) bloecke.push(b);
  let titel = null;
  // Überschrift ganz oben, danach mehrere Blöcke → Titel des Stapels.
  if (bloecke.length > 2 && bloecke[0].length === 1 && !PAAR.test(bloecke[0][0]) && bloecke[0][0].length < 60
    && !bloecke[1].every((z) => AUFZ.test(z)) && !bloecke[0][0].endsWith("?")) titel = bloecke.shift()[0];
  for (let i = 0; i < bloecke.length; i++) {
    const bl = bloecke[i];
    const paare = bl.map((z) => z.match(PAAR)).filter(Boolean);
    // Glossar: jede Zeile "Begriff: Erklärung" ist eine eigene Karte
    if (paare.length >= 2 && paare.length >= bl.length * 0.7) {
      let letzte = null;
      for (const z of bl) {
        const m = z.match(PAAR);
        if (m) { letzte = { frage: m[1].replace(/^[-–•*]\s*/, "").trim(), antwort: m[2].trim() }; karten.push(letzte); }
        else if (letzte) letzte.antwort += `\n${z}`;
      }
      continue;
    }
    if (bl.length === 1) {
      const m = bl[0].match(PAAR);
      if (m) { karten.push({ frage: m[1].trim(), antwort: m[2].trim() }); continue; }
      // Einzelne Zeile, danach ein Block ohne eigene Überschrift → das ist die Überschrift dazu.
      const next = bloecke[i + 1];
      if (next && next.every((z) => AUFZ.test(z) || next.length === 1)) { karten.push({ frage: bl[0], antwort: next.join("\n") }); i++; continue; }
      if (bl[0].endsWith("?") && next) { karten.push({ frage: bl[0], antwort: next.join("\n") }); i++; continue; }
      karten.push({ frage: bl[0], antwort: "" });
      continue;
    }
    // Überschrift + Inhalt
    let [kopf, ...rest] = bl;
    const m = kopf.match(PAAR);
    if (m && !AUFZ.test(kopf) && m[2].length > 2 && rest.every((z) => AUFZ.test(z))) { rest = [m[2], ...rest]; kopf = m[1]; }
    karten.push({ frage: kopf.replace(/[:]\s*$/, ""), antwort: rest.join("\n") });
  }
  return fertig(karten, titel);
}
function fertig(karten, titel) {
  const k = karten.map((x) => ({ frage: sauber(x.frage).slice(0, 400), antwort: String(x.antwort || "").split("\n").map(sauber).filter(Boolean).join("\n").slice(0, 3000) }))
    .filter((x) => x.frage);
  return { titel, karten: k.map((x) => ({ ...x, reihenfolge: reihenfolgeWichtig(x) })) };
}

// ---------- Fortschritt (Ringe pro Thema) ----------
// Geübt = Anteil der Karten, die schon mindestens einmal abgefragt wurden.
// Gemerkt = Trefferquote aller Abfragen (richtig zählt voll, teilweise halb).
// Auswendig = Anteil der Karten in Fach 4 oder 5 (mehrmals hintereinander richtig).
function ringeVon(karten) {
  const n = karten.length;
  if (!n) return { geuebt: 0, gemerkt: 0, auswendig: 0 };
  const versuche = karten.reduce((a, k) => a + (k.richtig || 0) + (k.teilweise || 0) + (k.falsch || 0), 0);
  const punkte = karten.reduce((a, k) => a + (k.richtig || 0) + (k.teilweise || 0) / 2, 0);
  return {
    geuebt: Math.round((karten.filter((k) => k.gesehen).length / n) * 100),
    gemerkt: versuche ? Math.round((punkte / versuche) * 100) : 0,
    auswendig: Math.round((karten.filter((k) => (k.fach || 1) >= 4).length / n) * 100),
  };
}

// ---------- Lob, wenn ein Ring voll ist (v1.112.0) ----------
// Pro Thema und Ring nur einmal. Fällt ein Ring wieder unter 100 % (z. B. neue Karten dazu),
// darf Friday beim nächsten Vollwerden wieder loben.
// „Gemerkt“ zählt erst als voll, wenn auch alle Karten geübt sind (sonst wäre 1 von 1 schon 100 %).
const RING_NAME = { geuebt: "Geübt", gemerkt: "Gemerkt", auswendig: "Auswendig" };
export function lobPruefen(sid) {
  const d = laden();
  const neu = [];
  let geaendert = false;
  for (const s of d.stapel) {
    if (sid && s.id !== sid) continue;
    if (!(s.karten || []).length) continue;
    const r = ringeVon(s.karten);
    const voll = { geuebt: r.geuebt >= 100, gemerkt: r.gemerkt >= 100 && r.geuebt >= 100, auswendig: r.auswendig >= 100 };
    s.gelobt ||= {};
    for (const ring of Object.keys(RING_NAME)) {
      if (voll[ring] && !s.gelobt[ring]) { s.gelobt[ring] = new Date().toISOString(); neu.push({ stapel: s.id, titel: s.titel, ring, name: RING_NAME[ring] }); geaendert = true; }
      else if (!voll[ring] && s.gelobt[ring]) { delete s.gelobt[ring]; geaendert = true; }
    }
  }
  if (geaendert) speichern(d);
  if (!neu.length) return { lob: [] };
  // Der größte Erfolg zuerst: Auswendig > Gemerkt > Geübt.
  const rang = { auswendig: 3, gemerkt: 2, geuebt: 1 };
  neu.sort((a, b) => rang[b.ring] - rang[a.ring]);
  const top = neu[0];
  const was = { auswendig: `Du kannst „${top.titel}“ jetzt komplett auswendig!`, gemerkt: `Bei „${top.titel}“ war alles richtig!`, geuebt: `Du hast alle Karten von „${top.titel}“ geübt!` }[top.ring];
  const text = `Wow, ${NAME}! ${was} Hast du richtig gut gemacht. Ich bin stolz auf dich!`;
  for (const n of neu) logbuch.eintragen({ bereich: "lernen", titel: `Lernecke: Ring „${n.name}“ bei „${n.titel}“ voll – Carla gelobt` });
  return { lob: neu, text };
}

// ---------- Stapel & Karten ----------
function stapelInfo(s) {
  const h = heute();
  const karten = s.karten || [];
  const faechern = [0, 0, 0, 0, 0];
  for (const k of karten) faechern[Math.min(FAECHER, Math.max(1, k.fach || 1)) - 1]++;
  return {
    id: s.id, titel: s.titel, fach: s.fach || "", erstellt: s.erstellt, geaendert: s.geaendert, anzahl: karten.length,
    faellig: karten.filter((k) => !k.faellig || k.faellig <= h).length,
    neu: karten.filter((k) => !k.gesehen).length,
    gelernt: karten.filter((k) => (k.fach || 1) >= 4).length,
    ringe: ringeVon(karten),
    faechern, plan: s.plan || null, bilder: (s.bilder || []).length,
  };
}
export function uebersicht() {
  const d = laden();
  const stapel = d.stapel.map(stapelInfo);
  return {
    profil: d.profil, stapel,
    faellig: stapel.reduce((a, s) => a + s.faellig, 0),
    karten: stapel.reduce((a, s) => a + s.anzahl, 0),
    heute: heutePlan(d),
    letzte: (d.sitzungen || []).slice(-8).reverse(),
    ringe: ringeVon(d.stapel.flatMap((s) => s.karten || [])),
    unterlagen: archiv.liste().anzahl,
    ocr: { mac: process.platform === "darwin" },
  };
}
function heutePlan(d) {
  const h = heute();
  const out = [];
  for (const s of d.stapel) {
    const tag = s.plan?.tage?.find((t) => t.datum === h);
    if (tag) out.push({ stapel: s.id, titel: s.titel, text: tag.text, karten: [...tag.neu, ...tag.wiederholen] });
  }
  return out;
}
export function stapelHolen(id) {
  const s = laden().stapel.find((x) => x.id === id);
  return s ? { ...stapelInfo(s), karten: s.karten, bilder: s.bilder || [] } : null;
}
const neueKarte = (k, quelle) => ({
  id: neueId(), frage: kurz(sauber(k.frage), 400), antwort: kurz(String(k.antwort || "").trim(), 3000),
  ...(typeof k.reihenfolge === "boolean" ? { reihenfolge: k.reihenfolge } : {}),
  ...(k.bild ? { bild: kurz(k.bild, 40) } : {}),
  fach: 1, faellig: heute(), richtig: 0, falsch: 0, gesehen: 0, erstellt: new Date().toISOString(), quelle: quelle || "hand",
});
/** Karten speichern: in einen bestehenden Stapel (stapel = id) oder einen neuen (titel). */
export function kartenSpeichern({ stapel, titel, fach, karten = [], quelle, bild }) {
  const d = laden();
  let s = stapel ? d.stapel.find((x) => x.id === stapel) : null;
  if (!s) {
    s = { id: neueId(), titel: kurz(sauber(titel) || `Lernkarten vom ${teile().d}.${teile().m}.`, 120), fach: kurz(sauber(fach), 60), erstellt: new Date().toISOString(), karten: [], bilder: [] };
    d.stapel.unshift(s);
  }
  const neu = (Array.isArray(karten) ? karten : []).filter((k) => sauber(k?.frage)).slice(0, 300).map((k) => neueKarte({ ...k, bild: k.bild || bild }, quelle));
  s.karten.push(...neu);
  if (bild && !(s.bilder ||= []).includes(bild)) s.bilder.push(bild);
  s.geaendert = new Date().toISOString();
  speichern(d);
  try { archiv.mitStapelVerknuepfen([bild, ...neu.map((k) => k.bild)], s); } catch { /* egal */ }
  if (neu.length) logbuch.eintragen({ bereich: "lernen", titel: `Lernecke: ${neu.length} Karte${neu.length === 1 ? "" : "n"} in „${s.titel}“ gespeichert`, quelle: quelle || "hand" });
  return { stapel: stapelInfo(s), neu: neu.length };
}
export function stapelAendern(id, { titel, fach }) {
  const d = laden();
  const s = d.stapel.find((x) => x.id === id);
  if (!s) return null;
  if (titel !== undefined && sauber(titel)) s.titel = kurz(sauber(titel), 120);
  if (fach !== undefined) s.fach = kurz(sauber(fach), 60);
  s.geaendert = new Date().toISOString();
  speichern(d);
  return stapelInfo(s);
}
export function stapelLoeschen(id) {
  const d = laden();
  const s = d.stapel.find((x) => x.id === id);
  if (!s) return false;
  d.stapel = d.stapel.filter((x) => x.id !== id);
  speichern(d);
  // Fotos, die kein anderer Stapel braucht, in den Papierkorb-Ordner schieben (nicht hart löschen).
  const nochGebraucht = new Set(d.stapel.flatMap((x) => [...(x.bilder || []), ...x.karten.map((k) => k.bild).filter(Boolean)]));
  for (const b of new Set([...(s.bilder || []), ...s.karten.map((k) => k.bild).filter(Boolean)])) {
    if (nochGebraucht.has(b) || archiv.bildImArchiv(b)) continue;
    try { fs.mkdirSync(path.join(BILDER, "papierkorb"), { recursive: true }); fs.renameSync(bildPfad(b), path.join(BILDER, "papierkorb", `${b}.jpg`)); } catch { /* egal */ }
  }
  logbuch.eintragen({ bereich: "lernen", titel: `Lernecke: Stapel „${s.titel}“ gelöscht` });
  return true;
}
export function karteAendern(sid, kid, felder = {}) {
  const d = laden();
  const k = d.stapel.find((x) => x.id === sid)?.karten.find((x) => x.id === kid);
  if (!k) return null;
  if (felder.frage !== undefined && sauber(felder.frage)) k.frage = kurz(sauber(felder.frage), 400);
  if (felder.antwort !== undefined) k.antwort = kurz(String(felder.antwort).trim(), 3000);
  if (felder.reihenfolge === true || felder.reihenfolge === false) k.reihenfolge = felder.reihenfolge;
  if (felder.reihenfolge === null) delete k.reihenfolge;
  if (felder.zuruecksetzen) Object.assign(k, { fach: 1, faellig: heute(), richtig: 0, falsch: 0 });
  speichern(d);
  return k;
}
export function karteLoeschen(sid, kid) {
  const d = laden();
  const s = d.stapel.find((x) => x.id === sid);
  if (!s) return false;
  const vorher = s.karten.length;
  s.karten = s.karten.filter((k) => k.id !== kid);
  speichern(d);
  return s.karten.length < vorher;
}

/** Ergebnis eintragen: richtig → ein Fach weiter, teilweise → bleibt, falsch → zurück in Fach 1 (morgen wieder). */
export function bewerten(sid, kid, ergebnis) {
  const d = laden();
  const k = d.stapel.find((x) => x.id === sid)?.karten.find((x) => x.id === kid);
  if (!k) return null;
  const alt = k.fach || 1;
  if (ergebnis === "richtig") k.fach = Math.min(FAECHER, alt + 1);
  else if (ergebnis === "falsch") k.fach = 1;
  else k.fach = Math.max(1, alt);
  if (ergebnis === "richtig") k.richtig = (k.richtig || 0) + 1;
  if (ergebnis === "falsch") k.falsch = (k.falsch || 0) + 1;
  if (ergebnis === "teilweise") k.teilweise = (k.teilweise || 0) + 1;
  k.gesehen = (k.gesehen || 0) + 1;
  k.zuletzt = new Date().toISOString();
  k.letztes = ergebnis;
  k.faellig = inTagen(ergebnis === "richtig" ? ABSTAND[k.fach] : 1);
  speichern(d);
  return { fach: k.fach, faellig: k.faellig };
}
export function sitzungSpeichern({ stapel, richtig = 0, teilweise = 0, falsch = 0, dauer = 0, modus = "abfragen" }) {
  const d = laden();
  const s = d.stapel.find((x) => x.id === stapel);
  const e = { at: new Date().toISOString(), stapel: stapel || "", titel: s?.titel || "Alle Stapel", richtig: +richtig || 0, teilweise: +teilweise || 0, falsch: +falsch || 0, dauer: Math.round(+dauer || 0), modus };
  d.sitzungen = [...(d.sitzungen || []), e].slice(-200);
  speichern(d);
  const sum = e.richtig + e.teilweise + e.falsch;
  if (sum) logbuch.eintragen({ bereich: "lernen", titel: `Lernecke: ${sum} Karten abgefragt (${e.richtig} richtig) · ${e.titel}` });
  return e;
}

// ---------- Begrüßung ----------
export function begruessung() {
  const d = laden();
  const p = d.profil;
  const jetzt = Date.now();
  const kurzVorher = p.letzter && jetzt - Date.parse(p.letzter) < 10 * 60 * 1000;
  const erstesMal = !p.besuche;
  if (!kurzVorher) p.besuche = (p.besuche || 0) + 1;
  p.erster ||= new Date().toISOString();
  p.letzter = new Date().toISOString();
  speichern(d);
  const info = uebersicht();
  const text = erstesMal
    ? `Hi ${NAME}, ich bin Friday, die künstliche Assistentin von Kevin. Er hat mich gebeten, dir beim Lernen zu helfen. Was wollen wir machen: Soll ich dich abfragen, oder soll ich dir generell beim Lernen helfen?`
    : `Hi ${NAME}, freut mich, dass du da bist. Wie kann ich dir beim Lernen helfen?`;
  return { text, erstesMal, wiederholt: Boolean(kurzVorher), besuche: p.besuche, ...info };
}

// ---------- Lernplan ----------
const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export function lernplan(sid, { pruefung, minuten = 20 } = {}) {
  const d = laden();
  const s = d.stapel.find((x) => x.id === sid);
  if (!s) throw new Error("Stapel nicht gefunden.");
  const karten = s.karten;
  if (!karten.length) throw new Error("Der Stapel hat noch keine Karten.");
  const h = teile();
  let tage = 7;
  const m = String(pruefung || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) tage = Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(h.y, h.m - 1, h.d)) / 86400000);
  if (m && tage < 1) throw new Error("Die Prüfung muss in der Zukunft liegen.");
  tage = Math.min(Math.max(tage, 1), 120);
  const min = Math.min(Math.max(+minuten || 20, 5), 240);
  const proTagMax = Math.max(3, Math.floor(min / 1.5)); // ca. 1,5 Minuten pro Karte (Frage, Antwort, Rückmeldung)
  // Zuerst unbekannte und oft falsche Karten.
  const reihe = [...karten].sort((a, b) => (a.fach || 1) - (b.fach || 1) || (b.falsch || 0) - (a.falsch || 0));
  const wiederholTage = tage >= 4 ? 2 : tage >= 2 ? 1 : 0; // die letzten Tage nur wiederholen
  const lernTage = Math.max(1, tage - wiederholTage);
  const neuProTag = Math.ceil(reihe.length / lernTage);
  const plan = [];
  const eingefuehrt = [];
  for (let i = 0; i < tage; i++) {
    const t = tagPlus(i);
    const neu = i < lernTage ? reihe.slice(i * neuProTag, (i + 1) * neuProTag).map((k) => k.id) : [];
    eingefuehrt[i] = neu;
    let wdh = [];
    if (i >= lernTage) wdh = karten.map((k) => k.id);
    else for (const zurueck of [1, 3, 7]) if (i - zurueck >= 0) wdh.push(...eingefuehrt[i - zurueck]);
    wdh = [...new Set(wdh.filter((id) => !neu.includes(id)))];
    const gesamt = neu.length + wdh.length;
    const zuViel = gesamt > proTagMax * 1.3;
    const datum = ymd(t);
    const text = i >= lernTage
      ? `Alles wiederholen (${wdh.length} Karten)${i === tage - 1 ? ", morgen ist die Prüfung. Früh schlafen!" : "."}`
      : neu.length ? `${neu.length} neue Karte${neu.length === 1 ? "" : "n"}${wdh.length ? ` + ${wdh.length} wiederholen` : ""}.`
        : wdh.length ? `${wdh.length} Karte${wdh.length === 1 ? "" : "n"} wiederholen.` : "Frei. Wenn du magst, schau kurz die schwierigsten Karten an.";
    plan.push({ datum, wt: WT[t.wt ?? new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay()], neu, wiederholen: wdh, text, minuten: Math.round(gesamt * 1.5), zuViel });
  }
  s.plan = { erstellt: new Date().toISOString(), pruefung: m ? pruefung : null, minuten: min, tage: plan };
  speichern(d);
  logbuch.eintragen({ bereich: "lernen", titel: `Lernecke: Lernplan für „${s.titel}“ (${tage} Tage)` });
  return s.plan;
}

// ---------- Texterkennung auf dem Mac (Apple Vision, kostenlos, kann Handschrift) ----------
const QUELLE = path.join(ROOT, "tools", "vision-ocr.swift");
const PROGRAMM = path.join(DATA_DIR, "werkzeuge", "vision-ocr");
let bauen = null;
let bauFehler = null;
function programmBereit() {
  if (process.platform !== "darwin") return Promise.reject(new Error("Die Mac-Texterkennung gibt es nur auf dem Mac."));
  try {
    if (fs.statSync(PROGRAMM).mtimeMs >= fs.statSync(QUELLE).mtimeMs) return Promise.resolve(PROGRAMM);
  } catch { /* noch nicht gebaut */ }
  if (bauFehler && Date.now() - bauFehler.at < 10 * 60 * 1000) return Promise.reject(bauFehler.err);
  if (bauen) return bauen;
  fs.mkdirSync(path.dirname(PROGRAMM), { recursive: true });
  bauen = new Promise((ok, nein) => {
    // Einmalig übersetzen (dauert beim ersten Mal ca. 40 Sekunden). Nutzt die Command Line Tools.
    execFile("/usr/bin/swiftc", ["-O", QUELLE, "-o", `${PROGRAMM}.neu`], { timeout: 240000, env: { ...process.env, DEVELOPER_DIR: process.env.DEVELOPER_DIR || "/Library/Developer/CommandLineTools" } }, (err, _o, stderr) => {
      bauen = null;
      if (err) {
        const e = new Error(`Mac-Texterkennung ließ sich nicht einrichten (${String(stderr || err.message).split("\n")[0].slice(0, 160)}).`);
        bauFehler = { at: Date.now(), err: e };
        return nein(e);
      }
      try { fs.renameSync(`${PROGRAMM}.neu`, PROGRAMM); } catch (e2) { return nein(e2); }
      ok(PROGRAMM);
    });
  });
  return bauen;
}
/** Beim Serverstart schon mal vorbereiten, damit der erste Scan nicht warten muss. */
export function lernenStart() {
  if (process.platform === "darwin") setTimeout(() => programmBereit().catch((e) => console.error("Lernecke:", e.message)), 90 * 1000);
}
const bildPfad = (id) => path.join(BILDER, `${String(id).replace(/[^a-z0-9]/gi, "")}.jpg`);
export function bildDatei(id) {
  const p = bildPfad(id);
  return fs.existsSync(p) ? p : null;
}
/** Foto speichern und (auf dem Mac) Text erkennen. */
export async function scannen(image, opts = {}) {
  const { ocr = true } = opts;
  if (!image?.data) throw new Error("Kein Foto.");
  const buf = Buffer.from(String(image.data), "base64");
  if (buf.length > 9 * 1024 * 1024) throw new Error("Das Foto ist zu groß.");
  fs.mkdirSync(BILDER, { recursive: true });
  const id = neueId();
  fs.writeFileSync(bildPfad(id), buf);
  // Jedes Foto kommt sofort ins Lern-Archiv, damit nichts verloren geht (Text wird nachgetragen).
  const ablegen = (text) => { try { return archiv.scanAblegen({ bild: id, text, titel: opts.titel, fach: opts.fach, vorschau: opts.vorschau }); } catch { return null; } };
  if (!ocr) return { bild: id, text: null, unterlage: ablegen("") };
  try {
    const prog = await programmBereit();
    const lies = (spiegeln) => new Promise((ok, nein) => execFile(prog, [bildPfad(id), ...(spiegeln ? ["--spiegeln"] : [])], { timeout: 60000, maxBuffer: 4 * 1024 * 1024 }, (err, out, stderr) => (err ? nein(new Error(String(stderr || err.message).trim().slice(0, 160))) : ok(String(out).trim()))));
    // Frontkamera (Mac): Schrift kann spiegelverkehrt sein. Sieht der Text nicht nach echten Wörtern aus,
    // liest Friday das Bild zusätzlich gespiegelt und nimmt das bessere Ergebnis.
    let text = await lies(Boolean(opts.spiegeln));
    let gespiegelt = Boolean(opts.spiegeln);
    if (!opts.spiegeln && textGuete(text) < 0.6) {
      const andersrum = await lies(true).catch(() => "");
      if (textGuete(andersrum) > textGuete(text) + 0.1) { text = andersrum; gespiegelt = true; }
    }
    return { bild: id, text, quelle: "mac", gespiegelt, unterlage: ablegen(text), ...kartenAusText(text) };
  } catch (err) {
    return { bild: id, text: null, quelle: null, grund: err.message, unterlage: ablegen("") };
  }
}

/** Wie sehr sieht ein Text nach echten Wörtern aus? 0 = Buchstabensalat, 1 = sauberer Text. */
export function textGuete(text) {
  const w = String(text || "").split(/\s+/).filter((x) => /[A-Za-zÄÖÜäöüß]/.test(x));
  if (!w.length) return 0;
  const gut = w.filter((x) => { const b = x.replace(/[^A-Za-zÄÖÜäöüß]/g, ""); return b.length >= 2 && /[aeiouäöüy]/i.test(b) && !/[bcdfghjklmnpqrstvwxz]{5,}/i.test(b) && b.length / x.length > 0.7; }).length;
  const buchstaben = String(text).replace(/[^A-Za-zÄÖÜäöüß]/g, "").length;
  return (gut / w.length) * Math.min(1, buchstaben / 12);
}

// ---------- Optional mit Claude (braucht Guthaben) ----------
const KI_SYSTEM = "Du hilfst Carla beim Lernen. Antworte auf Deutsch, freundlich, einfach und kurz.";
export async function kiKarten({ bild, text }) {
  let image = null;
  if (bild) { const p = bildDatei(bild); if (p) image = { mediaType: "image/jpeg", data: fs.readFileSync(p).toString("base64") }; }
  if (!image && !text) throw new Error("Kein Foto und kein Text.");
  const r = await denke({
    stufe: "mittel", quelle: "lernen", maxTokens: 4000, image,
    system: "Du liest Lernkarten, Notizen und Arbeitsblätter (auch Handschrift) und machst daraus Karteikarten. Antworte NUR mit JSON: {\"titel\": \"…\", \"karten\": [{\"frage\": \"Überschrift oder Frage\", \"antwort\": \"Antwort; mehrere Punkte je in eigener Zeile, nummeriert wenn die Reihenfolge wichtig ist\"}]}. Übernimm den Inhalt genau so wie er dasteht, erfinde nichts dazu.",
    text: text ? `Erkannter Text (kann Fehler enthalten):\n${String(text).slice(0, 12000)}` : "Mach aus diesem Foto Lernkarten.",
  });
  if (!r.ok) { const e = new Error(r.error); e.status = r.leer ? 402 : 502; throw e; }
  const j = jsonAus(r.text);
  if (!j?.karten?.length) throw new Error("Die KI hat keine Karten gefunden.");
  return { ...fertig(j.karten, j.titel || null), quelle: "ki", model: r.model };
}
export async function kiPruefen(karte, antwort) {
  const r = await denke({
    stufe: "leicht", quelle: "lernen", maxTokens: 600, system: `${KI_SYSTEM} Du prüfst eine gesprochene Antwort (Spracherkennung, kann Hörfehler haben) gegen die Lernkarte. Sinngemäß richtig zählt als richtig. Antworte NUR mit JSON: {"ergebnis":"richtig|teilweise|falsch","fehlt":["…"],"reihenfolgeFalsch":false,"sprechText":"1-2 kurze Sätze an Carla"}`,
    text: `Frage: ${karte.frage}\nRichtige Antwort laut Karte:\n${karte.antwort}\nReihenfolge wichtig: ${reihenfolgeWichtig(karte) ? "ja" : "nein"}\n\nCarlas Antwort: ${antwort}`,
  });
  if (!r.ok) { const e = new Error(r.error); e.status = r.leer ? 402 : 502; throw e; }
  const j = jsonAus(r.text) || {};
  const ergebnis = ["richtig", "teilweise", "falsch"].includes(j.ergebnis) ? j.ergebnis : "teilweise";
  return { ergebnis, fehlt: Array.isArray(j.fehlt) ? j.fehlt.slice(0, 8).map(String) : [], reihenfolgeFalsch: Boolean(j.reihenfolgeFalsch), sprechText: String(j.sprechText || "").slice(0, 500), ki: true, model: r.model };
}
export async function kiErklaeren(karte, frage) {
  const r = await denke({
    stufe: "mittel", quelle: "lernen", maxTokens: 1200, system: `${KI_SYSTEM} Erkläre so, dass man es sich gut merken kann: ein Alltagsbeispiel, eine Eselsbrücke, höchstens 6 kurze Sätze. Kein Markdown, der Text wird vorgelesen.`,
    text: `Lernkarte\nFrage: ${karte.frage}\nAntwort: ${karte.antwort}\n\n${frage ? `Carlas Frage dazu: ${String(frage).slice(0, 800)}` : "Erklär mir das bitte einfach."}`,
  });
  if (!r.ok) { const e = new Error(r.error); e.status = r.leer ? 402 : 502; throw e; }
  return { text: r.text, model: r.model };
}

// ---------- Sprachbefehle ohne Claude ----------
export function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/, "").replace(/[!?.]/g, "").trim();
  const lern = U(/\b(lernmodus|lern-modus|lernecke|lern-ecke|lernbereich|lernkarten?|karteikarten?|karteikasten|lernkartei|lehrermodus|lehrer-modus|lernhilfe|lernarchiv|lern-archiv|lernunterlagen|lern-unterlagen)\b/);
  const carla = U(/\b(carla|karla)\b.*\b(lernen|abfragen|lernecke|lernmodus)\b|\b(lernen|abfragen)\b.*\b(carla|karla)\b/);
  if (!lern.test(t) && !carla.test(t) && !U(/^(frag mich ab|lass uns lernen|ich will lernen|ich möchte lernen|ich moechte lernen|wir lernen)\b/).test(t)) return null;
  // Kevin will nur testen/verbessern: keine Carla-Begrüßung, nichts zählt für Carlas Fortschritt.
  if (U(/\b(testen|testmodus|test-modus|ausprobieren|probieren)\b/).test(t) && lern.test(t)) return { answer: "Lernecke im Testmodus. Carla wird nicht begrüßt und ihr Fortschritt bleibt unverändert.", actions: ["lernen:test"] };
  if (U(/\b(archiv|lernarchiv|lern-archiv|unterlagen|lernunterlagen|dokumente|mitschriften?|skripte?)\b/).test(t)) return { answer: "", actions: ["lernen:archiv"] };
  // Die Begrüßung macht die Lernecke selbst, weil nur sie weiß, wer am Gerät ist (Carla oder Kevin).
  if (U(/\b(scann|scanne|scannen|fotografier|einlesen|abfotografieren)\w*/).test(t)) return { answer: "", actions: ["lernen:scannen"] };
  if (U(/\b(frag|fragen|abfragen|abfrage|prüf|pruef|test)\w*/).test(t)) return { answer: "", actions: ["lernen:abfragen"] };
  if (U(/\b(plan|lernplan)\b/).test(t)) return { answer: "", actions: ["lernen:plan"] };
  return { answer: "", actions: ["lernen:start"] };
}

// ---------- Server-Routen ----------
export function lernenRouten(app, asyncRoute) {
  const fehler = (res, err, code) => res.status(err.status || code || 400).json({ error: err.message || String(err) });
  app.get("/api/lernen", (req, res) => res.json(uebersicht()));
  app.post("/api/lernen/start", (req, res) => res.json(begruessung()));
  archiv.archivRouten(app);
  app.get("/api/lernen/stapel/:id", (req, res) => { const s = stapelHolen(req.params.id); return s ? res.json(s) : res.status(404).json({ error: "Stapel nicht gefunden." }); });
  app.patch("/api/lernen/stapel/:id", (req, res) => res.json(stapelAendern(req.params.id, req.body || {}) || {}));
  app.delete("/api/lernen/stapel/:id", (req, res) => res.json({ ok: stapelLoeschen(req.params.id) }));
  app.post("/api/lernen/karten", (req, res) => { try { res.json(kartenSpeichern(req.body || {})); } catch (err) { fehler(res, err); } });
  app.patch("/api/lernen/stapel/:sid/karte/:kid", (req, res) => res.json(karteAendern(req.params.sid, req.params.kid, req.body || {}) || {}));
  app.delete("/api/lernen/stapel/:sid/karte/:kid", (req, res) => res.json({ ok: karteLoeschen(req.params.sid, req.params.kid) }));
  app.post("/api/lernen/text", (req, res) => res.json(kartenAusText(String(req.body?.text || "").slice(0, 30000))));
  app.post("/api/lernen/scan", asyncRoute(async (req, res) => { try { const b = req.body || {}; res.json(await scannen(b.image, { ocr: b.ocr !== false, spiegeln: b.spiegeln === true, titel: b.titel, fach: b.fach, vorschau: b.vorschau })); } catch (err) { fehler(res, err); } }));
  app.get("/api/lernen/bild/:id", (req, res) => { const p = bildDatei(req.params.id); return p ? res.sendFile(p) : res.status(404).end(); });
  app.post("/api/lernen/pruefen", (req, res) => {
    const { stapel, karte, antwort, reihenfolge } = req.body || {};
    const k = laden().stapel.find((x) => x.id === stapel)?.karten.find((x) => x.id === karte);
    if (!k) return res.status(404).json({ error: "Karte nicht gefunden." });
    res.json(vergleiche(k, String(antwort || "").slice(0, 4000), { reihenfolge }));
  });
  app.post("/api/lernen/bewerten", (req, res) => {
    const { stapel, karte, ergebnis } = req.body || {};
    const r = bewerten(stapel, karte, ["richtig", "teilweise", "falsch"].includes(ergebnis) ? ergebnis : "falsch");
    return r ? res.json(r) : res.status(404).json({ error: "Karte nicht gefunden." });
  });
  app.post("/api/lernen/sitzung", (req, res) => res.json(sitzungSpeichern(req.body || {})));
  app.post("/api/lernen/lob", (req, res) => res.json(lobPruefen(typeof req.body?.stapel === "string" && req.body.stapel !== "alle" ? req.body.stapel : null)));
  app.post("/api/lernen/plan/:id", (req, res) => { try { res.json(lernplan(req.params.id, req.body || {})); } catch (err) { fehler(res, err); } });
  app.post("/api/lernen/ki/karten", asyncRoute(async (req, res) => { try { res.json(await kiKarten(req.body || {})); } catch (err) { fehler(res, err, 502); } }));
  app.post("/api/lernen/ki/pruefen", asyncRoute(async (req, res) => {
    const { stapel, karte, antwort } = req.body || {};
    const k = laden().stapel.find((x) => x.id === stapel)?.karten.find((x) => x.id === karte);
    if (!k) return res.status(404).json({ error: "Karte nicht gefunden." });
    try { res.json(await kiPruefen(k, String(antwort || "").slice(0, 4000))); } catch (err) { fehler(res, err, 502); }
  }));
  app.post("/api/lernen/ki/erklaeren", asyncRoute(async (req, res) => {
    const { stapel, karte, frage } = req.body || {};
    const k = laden().stapel.find((x) => x.id === stapel)?.karten.find((x) => x.id === karte);
    if (!k) return res.status(404).json({ error: "Karte nicht gefunden." });
    try { res.json(await kiErklaeren(k, frage)); } catch (err) { fehler(res, err, 502); }
  }));
}
