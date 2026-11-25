// Entscheiden & Vorausrechnen (v1.184.0, Mark XIII).
//
//  ⚖️ Entscheidungs-Matrix   Optionen × Kriterien mit Gewicht 1–5 und Noten 1–10 → Punktzahl 0–100. Dazu eine
//                            Empfindlichkeitsprüfung: Bleibt der Sieger, wenn man ein Gewicht verändert? Kommt ins
//                            bestehende Entscheidungsarchiv (persoenlich.js), nichts doppelt.
//  📈 Entscheidungslernen    Aus deinen rückblickenden Bewertungen (1–5): Wie gut lief es, wenn du der Matrix gefolgt bist,
//                            und wie gut, wenn nicht? Und welcher Bereich läuft gut?
//  🔭 Zukunftssimulator      „Was wäre wenn“ mit Monte-Carlo-Rechnung (2000 Durchläufe, lokal): Sparen/Anlegen, Ziel
//                            schaffen (aus echtem Ziel-Fortschritt), Gewohnheit halten (aus echter Quote).
//  🗣️ Agenten-Diskussion    3 Rollen diskutieren in 2 Runden, danach fasst eine Moderatorin zusammen. Erst lokale KI
//                            (Ollama, kostenlos). Bezahlte KI nur, wenn du es ausdrücklich willst – mit Kosten-Deckel.
import * as store from "./store.js";

const DATEI = "entscheiden";
const lade = () => { const d = store.load(DATEI, null); return d && typeof d === "object" ? { matrizen: [], simulationen: [], diskussionen: [], ...d } : { matrizen: [], simulationen: [], diskussionen: [] }; };
const sichere = (d) => store.save(DATEI, d);
const neueId = () => Math.random().toString(36).slice(2, 10);
const kurz = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const zahl = (x, min, max, std) => { const n = Number(x); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std; };

// ---------- ⚖️ Matrix ----------
export function matrixRechnen({ optionen = [], kriterien = [], werte = {} } = {}) {
  const opt = optionen.map((o) => kurz(o, 60)).filter(Boolean).slice(0, 8);
  const kri = kriterien.map((k) => ({ name: kurz(k.name ?? k, 60), gewicht: zahl(k.gewicht, 1, 5, 3) })).filter((k) => k.name).slice(0, 10);
  if (opt.length < 2) return { error: "Bitte mindestens 2 Möglichkeiten eintragen." };
  if (!kri.length) return { error: "Bitte mindestens ein Kriterium eintragen." };
  const note = (o, k) => zahl(werte?.[o]?.[k], 1, 10, 5);
  const punkte = (gew) => opt.map((o) => {
    const summeG = kri.reduce((s, k, i) => s + gew[i], 0);
    const p = kri.reduce((s, k, i) => s + gew[i] * note(o, k.name), 0) / summeG; // 1..10
    return { option: o, punkte: Math.round(((p - 1) / 9) * 100) };
  }).sort((a, b) => b.punkte - a.punkte);
  const basis = kri.map((k) => k.gewicht);
  const rangliste = punkte(basis);
  const sieger = rangliste[0].option;
  // Empfindlichkeit: jedes Gewicht einzeln auf 1 und auf 5 setzen
  const kipp = [];
  kri.forEach((k, i) => {
    for (const g of [1, 5]) {
      if (g === k.gewicht) continue;
      const gew = basis.slice(); gew[i] = g;
      const r = punkte(gew);
      if (r[0].option !== sieger) kipp.push({ kriterium: k.name, gewicht: g, neuerSieger: r[0].option });
    }
  });
  const abstand = rangliste[0].punkte - rangliste[1].punkte;
  const staerken = kri.map((k) => ({ kriterium: k.name, vorsprung: note(sieger, k.name) - Math.max(...opt.filter((o) => o !== sieger).map((o) => note(o, k.name))) })).sort((a, b) => b.vorsprung - a.vorsprung);
  return {
    optionen: opt, kriterien: kri, rangliste, sieger, abstand, robust: kipp.length === 0, kipp,
    satz: `${sieger} liegt vorn mit ${rangliste[0].punkte} von 100 Punkten (${abstand} vor ${rangliste[1].option}).${kipp.length ? ` Aber Vorsicht: Wenn dir „${kipp[0].kriterium}“ ${kipp[0].gewicht === 5 ? "sehr wichtig" : "unwichtig"} ist, gewinnt ${kipp[0].neuerSieger}.` : " Das Ergebnis ist robust: Auch mit anderen Gewichten bleibt es dabei."}${staerken[0]?.vorsprung > 0 ? ` Stärkster Punkt: ${staerken[0].kriterium}.` : ""}`,
  };
}

/** Matrix rechnen und (auf Wunsch) mit Entscheidung im Archiv festhalten. */
export async function matrixSpeichern({ frage, optionen, kriterien, werte, gewaehlt, bereich, pruefen_am } = {}) {
  const r = matrixRechnen({ optionen, kriterien, werte });
  if (r.error) return r;
  const wahl = kurz(gewaehlt || r.sieger, 60);
  const P = await import("./persoenlich.js");
  const e = P.entscheidungSpeichern({
    frage: kurz(frage, 300) || `Wahl zwischen ${r.optionen.join(", ")}`, entscheidung: wahl, bereich,
    gruende: `Entscheidungs-Matrix: ${r.rangliste.map((x) => `${x.option} ${x.punkte}`).join(" · ")}. ${r.robust ? "Robust." : "Knapp/empfindlich."}`,
    alternativen: r.optionen.filter((o) => o !== wahl).join(", "), pruefen_am,
  });
  if (e.error) return e;
  const d = lade();
  d.matrizen.push({ id: neueId(), entscheidung: e.entscheidung.id, frage: e.entscheidung.frage, optionen: r.optionen, kriterien: r.kriterien, werte, sieger: r.sieger, gewaehlt: wahl, robust: r.robust, at: new Date().toISOString() });
  d.matrizen = d.matrizen.slice(-200);
  sichere(d);
  return { ok: true, ...r, entscheidung: e.entscheidung };
}

/** Lernen aus rückblickend bewerteten Entscheidungen. */
export async function entscheidungsLernen() {
  const P = await import("./persoenlich.js");
  const alle = P.entscheidungen();
  const bilanz = P.entscheidungsBilanz();
  const nachId = new Map(alle.map((e) => [e.id, e]));
  const gefolgt = [], nicht = [];
  for (const m of lade().matrizen) {
    const e = nachId.get(m.entscheidung);
    if (!e?.bewertung) continue;
    (m.gewaehlt === m.sieger ? gefolgt : nicht).push(e.bewertung);
  }
  const schnitt = (l) => (l.length ? Math.round((l.reduce((a, b) => a + b, 0) / l.length) * 10) / 10 : null);
  const erkenntnisse = [];
  if (gefolgt.length && nicht.length) erkenntnisse.push(`Wenn du der Matrix gefolgt bist: Ø ${schnitt(gefolgt)}/5, sonst Ø ${schnitt(nicht)}/5.`);
  const bereiche = bilanz.bereiche.filter((b) => b.anzahl >= 2).sort((a, b) => b.schnitt - a.schnitt);
  if (bereiche.length >= 2) erkenntnisse.push(`Am besten laufen deine Entscheidungen bei ${bereiche[0].bereich} (Ø ${bereiche[0].schnitt}/5), am schwächsten bei ${bereiche.at(-1).bereich} (Ø ${bereiche.at(-1).schnitt}/5).`);
  if (bilanz.faellig.length) erkenntnisse.push(`${bilanz.faellig.length} Entscheidung${bilanz.faellig.length === 1 ? " wartet" : "en warten"} auf deinen Rückblick.`);
  return { bilanz, matrix: { gefolgt: { anzahl: gefolgt.length, schnitt: schnitt(gefolgt) }, nicht: { anzahl: nicht.length, schnitt: schnitt(nicht) } }, erkenntnisse, genug: bilanz.bewertet >= 3 };
}

// ---------- 🔭 Zukunftssimulator ----------
const N = 2000;
function normal(rnd) { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
/** Kleiner, reproduzierbarer Zufallsgenerator (gleiche Eingaben → gleiches Ergebnis). */
export function zufall(seed = 42) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quantil = (l, q) => { const s = l.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const euro = (x) => `${Math.round(x).toLocaleString("de-DE")} €`;

export function simSparen({ monatlich = 100, jahre = 10, start = 0, rendite = 5, schwankung = 15 } = {}, rnd = zufall(7)) {
  const m = zahl(monatlich, 0, 1e6, 100), j = Math.round(zahl(jahre, 1, 50, 10)), s0 = zahl(start, 0, 1e9, 0), r = zahl(rendite, -20, 30, 5) / 100, sd = zahl(schwankung, 0, 80, 15) / 100;
  const ende = [], verlust = [];
  for (let n = 0; n < N; n++) {
    let k = s0;
    for (let y = 0; y < j; y++) { const jr = r + sd * normal(rnd); k = (k + m * 12 / 2) * (1 + jr) + m * 12 / 2; if (k < 0) k = 0; }
    ende.push(k);
  }
  const eingezahlt = s0 + m * 12 * j;
  for (const e of ende) if (e < eingezahlt) verlust.push(e);
  const p10 = quantil(ende, 0.1), p50 = quantil(ende, 0.5), p90 = quantil(ende, 0.9);
  return { art: "sparen", eingaben: { monatlich: m, jahre: j, start: s0, rendite: r * 100, schwankung: sd * 100 }, eingezahlt, p10, p50, p90, verlustRisiko: Math.round((verlust.length / N) * 100),
    satz: `Nach ${j} Jahren hast du ${euro(eingezahlt)} eingezahlt. In der Mitte der Rechnungen kommen ${euro(p50)} heraus, im schlechten Fall (10 %) ${euro(p10)}, im guten Fall (90 %) ${euro(p90)}. In ${Math.round((verlust.length / N) * 100)} % der Durchläufe wäre am Ende weniger da als eingezahlt.` };
}

export async function simZiel({ ziel: zielId, tage = 90 } = {}, rnd = zufall(11)) {
  const P = await import("./persoenlich.js");
  const z = P.ziele().find((x) => x.id === zielId) || P.ziele().find((x) => P.fortschritt(x) < 100);
  if (!z) return { error: "Leg zuerst ein Ziel an (Persönlich → Ziele). Dann rechne ich aus, wann du es schaffst." };
  const fertig = z.schritte.filter((s) => s.erledigt).length, offen = z.schritte.length - fertig;
  if (!offen) return { art: "ziel", ziel: z.titel, satz: `„${z.titel}“ ist schon geschafft.`, wahrscheinlichkeit: 100 };
  const alter = (Date.now() - Date.parse(z.erstellt)) / 864e5;
  const alterTage = Math.max(7, alter); // ein neues Ziel nicht wild hochrechnen: mindestens eine Woche ansetzen
  const neu = alter < 7 || fertig === 0;
  const p = Math.min(0.9, Math.max(0.02, fertig / alterTage)); // echte Schritte pro Tag bisher
  const frist = /^\d{4}-\d{2}-\d{2}$/.test(z.frist || "") ? Math.max(0, Math.ceil((Date.parse(`${z.frist}T23:59:00`) - Date.now()) / 864e5)) : Math.round(zahl(tage, 1, 3650, 90));
  const dauer = [];
  let geschafft = 0;
  for (let n = 0; n < N; n++) {
    let rest = offen, d = 0;
    while (rest > 0 && d < 3650) { d++; if (rnd() < p) rest--; }
    dauer.push(d);
    if (d <= frist) geschafft++;
  }
  const w = Math.round((geschafft / N) * 100);
  return { art: "ziel", ziel: z.titel, eingaben: { offen, fertig, schritteProTag: Math.round(p * 100) / 100, frist, fristText: z.frist || `${frist} Tage` }, wahrscheinlichkeit: w, p50: quantil(dauer, 0.5), p90: quantil(dauer, 0.9), geschaetzt: neu,
    satz: `Für „${z.titel}“ fehlen noch ${offen} Schritt${offen === 1 ? "" : "e"}. ${neu ? "Grob geschätzt, weil das Ziel noch neu ist," : "Bei deinem bisherigen Tempo"} brauchst du etwa ${quantil(dauer, 0.5)} Tage, eher ${quantil(dauer, 0.9)}. Bis ${/^\d{4}-\d{2}-\d{2}$/.test(z.frist || "") ? new Date(`${z.frist}T12:00:00`).toLocaleDateString("de-DE") : z.frist || `in ${frist} Tagen`} schaffst du es mit ${w} % Wahrscheinlichkeit.` };
}

export async function simGewohnheit({ gewohnheit, ziel = 21, tage = 30 } = {}, rnd = zufall(13)) {
  const G = await import("./gewohnheiten.js");
  const l = G.stand().liste;
  const g = l.find((x) => x.id === gewohnheit) || l[0];
  if (!g) return { error: "Leg zuerst eine Gewohnheit an („Friday, neue Gewohnheit Wasser trinken“)." };
  const quote = Math.min(0.98, Math.max(0.05, g.woche.filter(Boolean).length / 7));
  const zielSerie = Math.round(zahl(ziel, 2, 365, 21)), t = Math.round(zahl(tage, 7, 365, 30));
  let erreicht = 0; const tageGemacht = [];
  for (let n = 0; n < N; n++) {
    let serie = g.aktuell || 0, best = serie, gemacht = 0;
    for (let d = 0; d < t; d++) { if (rnd() < quote) { serie++; gemacht++; if (serie > best) best = serie; } else serie = 0; }
    if (best >= zielSerie) erreicht++;
    tageGemacht.push(gemacht);
  }
  const w = Math.round((erreicht / N) * 100);
  return { art: "gewohnheit", gewohnheit: `${g.icon} ${g.name}`, eingaben: { quote: Math.round(quote * 100), aktuell: g.aktuell, ziel: zielSerie, tage: t }, wahrscheinlichkeit: w, p50: quantil(tageGemacht, 0.5),
    satz: `${g.name}: Diese Woche hast du ${Math.round(quote * 100)} % geschafft. Wenn das so bleibt, machst du in ${t} Tagen etwa ${quantil(tageGemacht, 0.5)}-mal mit, und eine Serie von ${zielSerie} Tagen schaffst du mit ${w} % Wahrscheinlichkeit.${w < 30 && quote < 0.9 ? " Schon ein Tag mehr pro Woche hilft deutlich." : ""}` };
}

export async function simulieren(art, eingaben = {}) {
  const r = art === "sparen" ? simSparen(eingaben) : art === "ziel" ? await simZiel(eingaben) : art === "gewohnheit" ? await simGewohnheit(eingaben) : { error: "Unbekannte Simulation." };
  if (!r.error) { const d = lade(); d.simulationen.push({ id: neueId(), at: new Date().toISOString(), art, satz: r.satz }); d.simulationen = d.simulationen.slice(-50); sichere(d); }
  return r;
}

// ---------- 🗣️ Agenten-Diskussion ----------
export const ROLLEN = [
  { id: "chancen", name: "Chancen-Agentin", emoji: "🌱", auftrag: "Du siehst die Chancen und den Nutzen. Sei ehrlich, nicht naiv." },
  { id: "risiko", name: "Risiko-Agent", emoji: "🛡️", auftrag: "Du suchst Risiken, Kosten und was schiefgehen kann. Fair, keine Panik." },
  { id: "praxis", name: "Praxis-Agent", emoji: "🔧", auftrag: "Du denkst praktisch: Aufwand, Zeit, erster konkreter Schritt." },
];
export async function diskutieren(frage, { mitKi = false, runden = 2 } = {}) {
  const f = kurz(frage, 600);
  if (f.length < 5) return { error: "Worüber sollen die Agenten diskutieren?" };
  const kc = await import("./ki-client.js");
  const lokal = kc.kostenlosBereit();
  if (!lokal && !mitKi) return { error: "Für die Diskussion brauche ich eine KI. Kostenlos geht es mit Ollama (Gehirn-Cockpit → KI-Modelle). Oder starte sie ausdrücklich mit bezahlter KI – dann gilt dein Kosten-Deckel.", ohneKi: true };
  const frag = async (system, text, max = 220) => {
    if (lokal && !mitKi) {
      const r = await kc.fragen("ollama", { max_tokens: max, system, messages: [{ role: "user", content: text }] }, { quelle: "diskussion" });
      return (r?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    }
    const { denke } = await import("./denker.js");
    const r = await denke({ system, text, stufe: "klein", maxTokens: max, quelle: "diskussion" });
    if (!r.ok) throw new Error(r.error || "KI nicht erreichbar");
    return String(r.text || "").trim();
  };
  const verlauf = [];
  const start = Date.now();
  try {
    for (let runde = 1; runde <= Math.min(3, Math.max(1, runden)); runde++) {
      const bisher = verlauf.map((b) => `${b.name} (Runde ${b.runde}): ${b.text}`).join("\n");
      for (const r of ROLLEN) {
        const system = `Du bist ${r.name} in einer Diskussionsrunde. ${r.auftrag} Antworte auf Deutsch in 2 bis 3 Sätzen, ohne Aufzählung.${runde > 1 ? " Geh auf die anderen ein: Wo hast du deine Meinung geändert, wo bleibst du dabei?" : ""}`;
        const text = await frag(system, `Frage: ${f}${bisher ? `\n\nBisher gesagt:\n${bisher}` : ""}`);
        verlauf.push({ rolle: r.id, name: r.name, emoji: r.emoji, runde, text: text || "(keine Antwort)" });
      }
    }
    const ergebnis = await frag("Du bist Friday und moderierst. Fasse die Diskussion zusammen: 1) Worin sind sich alle einig? 2) Wo bleibt Streit? 3) Deine Empfehlung in einem Satz. Deutsch, höchstens 6 Sätze, nichts erfinden.", `Frage: ${f}\n\n${verlauf.map((b) => `${b.name} (Runde ${b.runde}): ${b.text}`).join("\n")}`, 400);
    const r = { id: neueId(), at: new Date().toISOString(), frage: f, ki: lokal && !mitKi ? "lokale KI (kostenlos)" : "bezahlte KI (mit Kosten-Deckel)", verlauf, ergebnis, dauer_ms: Date.now() - start };
    const d = lade(); d.diskussionen.push(r); d.diskussionen = d.diskussionen.slice(-20); sichere(d);
    return { ok: true, ...r };
  } catch (err) {
    return { error: `Die Diskussion ist abgebrochen: ${String(err.message || err).slice(0, 160)}`, verlauf };
  }
}

export function uebersicht() {
  const d = lade();
  return { matrizen: d.matrizen.slice().reverse().slice(0, 20), simulationen: d.simulationen.slice().reverse().slice(0, 10), diskussionen: d.diskussionen.slice().reverse().slice(0, 10).map(({ verlauf, ...x }) => ({ ...x, beitraege: verlauf.length })), rollen: ROLLEN };
}

export async function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/, "").replace(/[?!.]+$/, "").trim();
  if (/^(öffne|oeffne|zeig|zeige|starte)( mir)?( die| den| das)? (entscheidungs-?matrix|zukunftssimulator|zukunfts-?simulator|agenten-?diskussion)$/.test(t)) return { answer: "Hier kannst du Entscheidungen abwägen, die Zukunft durchrechnen und Agenten diskutieren lassen.", actions: ["cockpit:denken"] };
  const m = t.match(/^was w(ä|ae)re,? wenn ich (jeden monat |monatlich )?(\d+[.,]?\d*) ?(€|euro) (im monat |monatlich |pro monat )?(\d+) jahre? (lang )?(spare|anlege|zur seite lege)$/);
  if (m) { const r = simSparen({ monatlich: Number(m[3].replace(",", ".")), jahre: Number(m[6]) }); return { answer: `${r.satz} Gerechnet mit 5 % Rendite und 15 % Schwankung pro Jahr, das ist keine Anlageberatung.`, actions: ["cockpit:denken"] }; }
  if (/schaffe ich (mein|das) ziel|wann schaffe ich mein ziel/.test(t)) { const r = await simZiel({}); return { answer: r.error || r.satz, actions: ["cockpit:denken"] }; }
  return null;
}

export function entscheidenRouten(app, asyncRoute) {
  app.get("/api/entscheiden", asyncRoute(async (_req, res) => res.json({ ...uebersicht(), lernen: await entscheidungsLernen() })));
  app.post("/api/entscheiden/matrix", asyncRoute(async (req, res) => res.json(req.body?.speichern ? await matrixSpeichern(req.body) : matrixRechnen(req.body || {}))));
  app.post("/api/entscheiden/simulation", asyncRoute(async (req, res) => res.json(await simulieren(req.body?.art, req.body || {}))));
  app.post("/api/entscheiden/diskussion", asyncRoute(async (req, res) => res.json(await diskutieren(req.body?.frage, { mitKi: req.body?.mitKi === true }))));
}

export async function entscheidenStart() {
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "entscheiden", bereich: "Denken", name: "Entscheidungs-Matrix und Zukunftssimulator", lauf: async () => {
      // Nachrechenbar: A ist bei beiden Kriterien besser → muss gewinnen und robust sein.
      const m = matrixRechnen({ optionen: ["A", "B"], kriterien: [{ name: "Preis", gewicht: 3 }, { name: "Qualität", gewicht: 4 }], werte: { A: { Preis: 8, Qualität: 9 }, B: { Preis: 4, Qualität: 5 } } });
      if (m.sieger !== "A" || !m.robust) return { status: "fehler", text: "Die Matrix rechnet falsch." };
      // Ohne Rendite und Schwankung muss genau die Einzahlung herauskommen.
      const s = simSparen({ monatlich: 100, jahre: 2, rendite: 0, schwankung: 0 });
      if (Math.round(s.p50) !== 2400) return { status: "fehler", text: `Der Simulator rechnet falsch (${Math.round(s.p50)} statt 2400).` };
      return { status: "bestanden", text: "Matrix und Simulator an nachrechenbaren Beispielen geprüft. Agenten-Diskussion braucht eine KI und wird hier nicht geprüft." };
    } });
  } catch { /* egal */ }
}
