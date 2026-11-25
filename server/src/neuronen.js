// Fridays Neural Brain 2.0 + Wissensnetz (v1.179.0, Mark XII Punkte 1 und 20).
//
// So funktioniert es (ohne Claude, ohne Internet, alles aus Fridays eigenen Daten):
//  • Wissens-Knoten: Langzeit-Fakten, Projekte, Kurzzeit-Themen, Missionen, Ziele, Entscheidungen,
//    Dokumente, Geburtstage (Menschen) und Interessen.
//  • Begriffs-Knoten ("Neuronen"): die wichtigen Wörter darin (vereinfacht auf den Wortstamm).
//  • Synapsen: Begriffe, die Boss in seinen Fragen (Archiv) zusammen benutzt, werden miteinander verbunden –
//    je öfter, desto stärker (Hebb'sche Regel: "was zusammen feuert, verdrahtet sich").
//  • Ausbreitende Aktivierung: Eine Frage aktiviert ihre Begriffe, die Aktivierung fließt über Synapsen weiter
//    zu verwandten Begriffen und von dort zu Wissens-Knoten. Die stärksten kommen als "Verwandtes Wissen"
//    in Fridays Kontext – so erinnert sich Friday auch an Dinge, die nicht wörtlich in der Frage stehen.
//
// Das Netz wird höchstens alle 2 Minuten neu gebaut (spart Rechenzeit, die Daten ändern sich langsam).
import * as store from "./store.js";
import { fakten, projekte, kurzzeit } from "./gedaechtnis.js";

const STOP = new Set(("der die das den dem des ein eine einen einem einer eines und oder aber auch noch schon nicht kein keine ist sind war waren bin bist hat habe hast haben wird werden wurde mit von vom zu zum zur im in am an auf aus bei für fuer über ueber unter nach vor seit bis was wie wer wo wann warum wieso welche welcher welches mir mich mein meine meinen meinem dein deine ich du er sie es wir ihr ihm ihn uns euch man sich dass weil wenn dann denn also sehr mehr viel viele alle alles etwas nichts heute morgen gestern jetzt immer wieder bitte danke friday boss kannst kann können soll sollst muss musst will willst mach mache machen zeig zeige sag sage gib gibt geht gehen bitte okay hallo dieser diese dieses jener hier dort da ganz gerade mal nur eben einfach merk merke notier notiere öffne oeffne starte erzähl erzaehl neues neue neuer projekt projekte wissensnetz gedächtnis gedaechtnis zusammen hängt haengt denkst woran verbindest")
  .split(/\s+/));
const ART = {
  fakt: ["🗄", "Langzeit"], projekt: ["📁", "Projekt"], thema: ["⏱", "Kurzzeit-Thema"], mission: ["🚀", "Mission"],
  ziel: ["🧭", "Ziel"], entscheidung: ["⚖", "Entscheidung"], dokument: ["📄", "Dokument"], person: ["👤", "Mensch"], interesse: ["✦", "Interesse"],
};
export const ARTEN = ART;

/** Wortstamm (sehr einfach, reicht für Deutsch im Alltag): "Garagen" → "garag", "Projektes" → "projekt". */
export function stamm(w) {
  let s = String(w || "").toLowerCase().replace(/ß/g, "ss").replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u");
  if (s.length > 6) s = s.replace(/(ungen|ung|heit|keit|lich|isch)$/, "");
  if (s.length > 5) s = s.replace(/(ern|en|er|es|em|e|n|s)$/, "");
  return s;
}
export function begriffe(text = "") {
  const out = new Set();
  for (const w of String(text).toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").split(/\s+/)) {
    if (w.length < 4 || STOP.has(w) || /^\d+$/.test(w)) continue;
    const s = stamm(w);
    if (s.length >= 3) out.add(s);
  }
  return out;
}

let cache = null;
let cacheZeit = 0;
const MAX_ALTER = 2 * 60 * 1000;

function sammleKnoten() {
  const k = [];
  const add = (id, art, name, text = "") => { const b = begriffe(`${name} ${text}`); if (b.size) k.push({ id, art, name: String(name).replace(/\s+/g, " ").trim().slice(0, 80), text: String(text).replace(/\s+/g, " ").trim().slice(0, 200), b }); };
  try { for (const f of fakten().slice(-300)) add(`f-${f.id}`, "fakt", f.text); } catch { /* leer */ }
  try { for (const p of projekte()) add(`p-${p.id}`, "projekt", p.name, p.notizen.slice(-20).map((n) => n.text).join(" · ")); } catch { /* leer */ }
  try { for (const t of kurzzeit().filter((x) => x.art === "thema")) add(`t-${t.id}`, "thema", t.text); } catch { /* leer */ }
  for (const m of store.load("missionen", []).slice(-40)) add(`m-${m.id}`, "mission", m.titel || "Mission", `${m.ziel || ""} ${(m.schritte || []).map((s) => s.text).join(" ")}`);
  for (const z of store.load("ziele", []).slice(-30)) add(`z-${z.id}`, "ziel", z.titel || "Ziel", `${z.warum || ""} ${(z.schritte || []).map((s) => s.text).join(" ")}`);
  for (const e of store.load("entscheidungen", []).slice(-40)) add(`e-${e.id}`, "entscheidung", e.entscheidung || e.frage || "Entscheidung", `${e.frage || ""} ${e.gruende || ""}`);
  for (const d of store.load("dokumente", []).slice(-40)) add(`d-${d.id}`, "dokument", d.titel || "Dokument", String(d.inhalt || (d.fragen || []).map((f) => f.frage).join(" ")).slice(0, 1500));
  const gb = store.load("geburtstage", {});
  for (const g of (gb.liste || []).slice(0, 60)) add(`g-${g.id || g.name}`, "person", g.name, `${g.beziehung || ""} ${g.hobbys || ""} ${g.notiz || ""} Geburtstag`);
  const wp = store.load("wissensprofil", {});
  for (const i of [...(wp.interessen || []), ...(wp.lernziele || [])].slice(0, 30)) add(`i-${i}`, "interesse", i);
  return k;
}

/** Synapsen zwischen Begriffen aus Boss' Fragen (die letzten 600 Gespräche). */
function sammleSynapsen() {
  const syn = new Map(); // "a|b" -> gewicht
  let fragen = 0;
  let archiv = [];
  try { archiv = store.leseArchiv().slice(-600); } catch { /* kein Archiv */ }
  for (const e of archiv) {
    if (e?.typ && e.typ !== "gespraech") continue;
    const b = [...begriffe(e?.frage || "")].slice(0, 8);
    if (b.length < 2) continue;
    fragen++;
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
      const key = b[i] < b[j] ? `${b[i]}|${b[j]}` : `${b[j]}|${b[i]}`;
      syn.set(key, (syn.get(key) || 0) + 1);
    }
  }
  return { syn, fragen };
}

function baue() {
  const knoten = sammleKnoten();
  const { syn, fragen } = sammleSynapsen();
  const df = new Map(); // in wie vielen Knoten kommt ein Begriff vor
  for (const n of knoten) for (const b of n.b) df.set(b, (df.get(b) || 0) + 1);
  const nachbarn = new Map(); // begriff -> Map(begriff -> gewicht)
  const verbinde = (a, b, w) => {
    if (!nachbarn.has(a)) nachbarn.set(a, new Map());
    nachbarn.get(a).set(b, (nachbarn.get(a).get(b) || 0) + w);
  };
  for (const [key, w] of syn) { const [a, b] = key.split("|"); verbinde(a, b, w); verbinde(b, a, w); }
  // Begriffe, die im selben Wissens-Knoten stehen, sind ebenfalls (schwächer) verbunden.
  for (const n of knoten) {
    const b = [...n.b].filter((x) => (df.get(x) || 0) <= Math.max(4, knoten.length / 3)).slice(0, 12);
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) { verbinde(b[i], b[j], 0.5); verbinde(b[j], b[i], 0.5); }
  }
  const index = new Map(); // begriff -> [knoten]
  for (const n of knoten) for (const b of n.b) { if (!index.has(b)) index.set(b, []); index.get(b).push(n); }
  cache = { knoten, nachbarn, index, df, fragen, synapsen: syn.size, gebaut: new Date().toISOString() };
  cacheZeit = Date.now();
  return cache;
}
function netzIntern(neu = false) {
  if (neu || !cache || Date.now() - cacheZeit > MAX_ALTER) return baue();
  return cache;
}
export function neuBauen() { return netzIntern(true); }

/**
 * Ausbreitende Aktivierung: Begriffe der Frage feuern (1.0), Nachbarn bekommen einen Teil (0.5 · Stärke),
 * Wissens-Knoten sammeln die Aktivierung ihrer Begriffe (seltene Begriffe zählen mehr).
 */
export function aktiviere(frage = "", { limit = 8, mindest = 0.35 } = {}) {
  const n = netzIntern();
  const start = [...begriffe(frage)];
  if (!start.length || !n.knoten.length) return { begriffe: start, treffer: [], bruecken: [] };
  const akt = new Map();
  for (const b of start) akt.set(b, Math.max(akt.get(b) || 0, 1));
  const bruecken = new Map();
  for (const b of start) {
    const nb = n.nachbarn.get(b);
    if (!nb) continue;
    const summe = [...nb.values()].reduce((s, w) => s + w, 0) || 1;
    for (const [c, w] of [...nb.entries()].sort((x, y) => y[1] - x[1]).slice(0, 12)) {
      const a = 0.5 * Math.min(1, (w / summe) * 3);
      if (a < 0.05) continue;
      if (!start.includes(c)) bruecken.set(c, Math.max(bruecken.get(c) || 0, a));
      akt.set(c, Math.max(akt.get(c) || 0, a));
    }
  }
  const punkte = new Map();
  for (const [b, a] of akt) {
    const liste = n.index.get(b) || [];
    if (!liste.length) continue;
    const selten = 1 / Math.sqrt(liste.length);
    for (const k of liste) punkte.set(k, (punkte.get(k) || 0) + a * selten);
  }
  const treffer = [...punkte.entries()].filter(([, p]) => p >= mindest).sort((x, y) => y[1] - x[1]).slice(0, limit)
    .map(([k, p]) => ({ id: k.id, art: k.art, name: k.name, text: k.text, aktivierung: Math.round(p * 100) / 100 }));
  return { begriffe: start, treffer, bruecken: [...bruecken.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([b, a]) => ({ begriff: b, staerke: Math.round(a * 100) / 100 })) };
}

/** Kontext-Block für Claude: nur, was die Aktivierung wirklich findet (sonst leer → spart Guthaben). */
export function kontextBlock(frage = "", { schon = "" } = {}) {
  try {
    const { treffer } = aktiviere(frage, { limit: 8, mindest: 0.6 });
    // Was schon im Kontext steht (Fakten, Kurzzeit, Projekte), nicht doppelt schicken – spart Guthaben.
    const nichtDoppelt = treffer.filter((t) => !schon.includes(t.name)).slice(0, 5);
    if (!nichtDoppelt.length) return "";
    return `Verwandtes Wissen aus deinem Wissensnetz (passt vermutlich zur Frage, nur nutzen, wenn es hilft):\n${nichtDoppelt.map((t) => `- ${ART[t.art]?.[1] || t.art}: ${t.name}${t.text && t.text !== t.name ? ` – ${t.text.slice(0, 140)}` : ""}`).join("\n")}`;
  } catch {
    return "";
  }
}

function findeKnoten(name) {
  const n = netzIntern();
  const q = String(name || "").toLowerCase().trim();
  if (!q) return { knoten: [], begriffe: [] };
  const direkt = n.knoten.filter((k) => k.name.toLowerCase().includes(q));
  const b = [...begriffe(q)];
  const ueber = b.flatMap((x) => n.index.get(x) || []);
  return { knoten: [...new Set([...direkt, ...ueber])], begriffe: b };
}

/** "Wie hängt X mit Y zusammen?" – kürzester Weg im Netz (über gemeinsame Begriffe und Synapsen). */
export function zusammenhang(a, b) {
  const n = netzIntern();
  const A = findeKnoten(a);
  const B = findeKnoten(b);
  if (!A.begriffe.length && !A.knoten.length) return { gefunden: false, text: `Zu „${a}“ finde ich nichts in meinem Wissensnetz.` };
  if (!B.begriffe.length && !B.knoten.length) return { gefunden: false, text: `Zu „${b}“ finde ich nichts in meinem Wissensnetz.` };
  // Startmenge: Begriffe von A (inkl. Begriffe der passenden Knoten), Ziel: Begriffe von B.
  const startB = new Set([...A.begriffe, ...A.knoten.flatMap((k) => [...k.b].slice(0, 6))]);
  const zielB = new Set([...B.begriffe, ...B.knoten.flatMap((k) => [...k.b].slice(0, 6))]);
  // 1) Direkt gemeinsame Begriffe oder ein Knoten, der beides enthält
  const beide = n.knoten.filter((k) => A.begriffe.some((x) => k.b.has(x)) && B.begriffe.some((x) => k.b.has(x)));
  if (beide.length) {
    const k = beide[0];
    return { gefunden: true, schritte: 1, pfad: [a, `${ART[k.art]?.[0] || "•"} ${k.name}`, b], text: `${a} und ${b} hängen direkt zusammen: ${ART[k.art]?.[1] || "Eintrag"} „${k.name}“${k.text && k.text !== k.name ? ` (${k.text.slice(0, 120)})` : ""}.` };
  }
  // 2) Breitensuche über Begriffs-Synapsen (max. 3 Sprünge)
  const vorher = new Map();
  let front = [...startB];
  for (const s of front) vorher.set(s, null);
  let ziel = null;
  for (let tiefe = 0; tiefe < 3 && front.length && !ziel; tiefe++) {
    const neu = [];
    for (const s of front) {
      for (const [c] of [...(n.nachbarn.get(s) || new Map()).entries()].sort((x, y) => y[1] - x[1]).slice(0, 25)) {
        if (vorher.has(c)) continue;
        vorher.set(c, s);
        if (zielB.has(c)) { ziel = c; break; }
        neu.push(c);
      }
      if (ziel) break;
    }
    front = neu;
  }
  if (!ziel) {
    const gem = [...startB].find((x) => zielB.has(x));
    if (gem) ziel = gem;
  }
  if (!ziel) return { gefunden: false, text: `Zwischen ${a} und ${b} finde ich in meinem Wissen noch keine Verbindung.` };
  const kette = [];
  for (let c = ziel; c != null; c = vorher.get(c)) kette.unshift(c);
  const zuKnoten = (begriff) => (n.index.get(begriff) || [])[0];
  const pfad = [a, ...kette.map((c) => { const k = zuKnoten(c); return k ? `${ART[k.art]?.[0] || "•"} ${k.name}` : c; }), b];
  const mitte = kette.slice(0, -1).map((c) => zuKnoten(c)?.name || c).filter(Boolean);
  return { gefunden: true, schritte: kette.length, pfad: [...new Set(pfad)], text: `${a} und ${b} hängen über ${mitte.length ? mitte.slice(0, 3).map((x) => `„${x}“`).join(" und ") : "gemeinsame Begriffe"} zusammen (${kette.length} Schritt${kette.length === 1 ? "" : "e"} im Wissensnetz).` };
}

/** Fürs Cockpit: Wissens-Knoten + Kanten (gemeinsame seltene Begriffe oder Synapsen) + stärkste Synapsen. */
export function netz({ neu = false, max = 120 } = {}) {
  const n = netzIntern(neu);
  const knoten = n.knoten.slice(-max);
  const kanten = [];
  for (let i = 0; i < knoten.length; i++) {
    for (let j = i + 1; j < knoten.length; j++) {
      let w = 0;
      const gem = [];
      for (const b of knoten[i].b) {
        if (knoten[j].b.has(b) && (n.df.get(b) || 0) <= Math.max(4, knoten.length / 4)) { w += 1; gem.push(b); continue; }
        const nb = n.nachbarn.get(b);
        if (!nb) continue;
        for (const c of knoten[j].b) { const s = nb.get(c); if (s >= 2) { w += 0.3; break; } }
      }
      if (w >= 1) kanten.push({ von: knoten[i].id, nach: knoten[j].id, gewicht: Math.round(w * 10) / 10, begriffe: gem.slice(0, 3) });
    }
  }
  kanten.sort((x, y) => y.gewicht - x.gewicht);
  const synapsen = [];
  for (const [a, nb] of n.nachbarn) for (const [b, w] of nb) if (a < b && w >= 2) synapsen.push({ a, b, staerke: w });
  synapsen.sort((x, y) => y.staerke - x.staerke);
  const zaehl = {};
  for (const k of n.knoten) zaehl[k.art] = (zaehl[k.art] || 0) + 1;
  return {
    arten: ART,
    knoten: knoten.map(({ b, ...k }) => ({ ...k, begriffe: b.size })),
    kanten: kanten.slice(0, 400),
    synapsen: synapsen.slice(0, 30),
    stand: { knoten: n.knoten.length, begriffe: n.index.size, synapsen: n.synapsen, fragen_gelernt: n.fragen, gebaut: n.gebaut, je_art: zaehl },
  };
}

// ---------- Sprachbefehle (ohne Claude) ----------
export function quickCommand(text) {
  const t = String(text || "").trim().replace(/^(hey |hallo |ok )?friday[ ,.]*/i, "").replace(/[!?.]+$/g, "").trim();
  const k = t.toLowerCase();
  let m;
  if (/^(öffne|zeig(e)?( mir)?) (das |dein(en)? )?(wissensnetz|neuronale[ns]? netz|neural brain|gehirn-?netz)$/.test(k)) {
    const s = netz().stand;
    return { answer: `Das ist mein Wissensnetz: ${s.knoten} Wissens-Knoten, ${s.begriffe} Begriffe und ${s.synapsen} Verbindungen, gelernt aus ${s.fragen_gelernt} deiner Fragen.`, actions: ["cockpit:wissensnetz"] };
  }
  if ((m = t.match(/^(?:wie (?:hängt|haengt|hangen|hängen) (.{2,50}?) (?:mit|und) (.{2,50}?) zusammen|was hat (.{2,50}?) mit (.{2,50}?) zu tun)$/i))) {
    const a = (m[1] || m[3]).replace(/^(der|die|das|mein|meine)\s+/i, "");
    const b = (m[2] || m[4]).replace(/^(der|die|das|mein|meine|dem|meinem|meiner)\s+/i, "");
    const z = zusammenhang(a, b);
    if (!z.gefunden && !begriffe(`${a} ${b}`).size) return null;
    return { answer: z.text, actions: ["cockpit:wissensnetz"] };
  }
  if ((m = t.match(/^(?:was verbindest du mit|woran denkst du bei)\s+(.{2,60})$/i)) || (m = t.match(/^was fällt dir (?:zu|bei) (.{2,60}) ein$/i))) {
    const a = aktiviere(m[1], { limit: 6, mindest: 0.3 });
    a.treffer = a.treffer.filter((x) => x.name.toLowerCase() !== m[1].toLowerCase().trim()).slice(0, 5);
    if (!a.treffer.length) return { answer: `Mit ${m[1]} verbinde ich noch nichts aus deinem Wissen.`, actions: ["cockpit:wissensnetz"] };
    return { answer: `Bei ${m[1]} denke ich an: ${a.treffer.map((x) => x.name).join(", ")}.`, actions: ["cockpit:wissensnetz"] };
  }
  return null;
}

export function neuronenRouten(app) {
  app.get("/api/neuronen", (req, res) => res.json(netz({ neu: req.query.neu === "1" })));
  app.get("/api/neuronen/aktiviere", (req, res) => res.json(aktiviere(String(req.query.q || ""), { limit: 12, mindest: 0.25 })));
  app.get("/api/neuronen/zusammenhang", (req, res) => res.json(zusammenhang(String(req.query.a || ""), String(req.query.b || ""))));
}
