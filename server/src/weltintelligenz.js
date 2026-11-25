// Fridays Welt-Intelligenz (v1.181.0, Mark XII Punkte 11, 12, 13 und 25).
//
//  🌍 Global Intelligence  Eine Weltlage aus ALLEN Länder-Schlagzeilen, die das Lagezentrum ohnehin sammelt:
//                          gleiche Meldungen gebündelt (Dubletten), Quellen bewertet, "bestätigt", wenn mehrere
//                          unabhängige Quellen berichten. Auffälligkeiten: Länder mit viel mehr Meldungen als üblich.
//  🔎 Deep Research 2.0    Tiefen-Recherche aus mehreren öffentlichen Quellen (Wikipedia, Nachrichten, eigene Feeds),
//                          mit Quellen-Bewertung, Zeitleiste und Qualitäts-Angabe. Als Dossier gespeichert.
//                          KI-Zusammenfassung nur, wenn eine kostenlose KI bereit ist oder Boss es ausdrücklich will.
//  📈 Prognose-Zentrale    Friday sagt voraus, ob die Nachrichtenlage in Brennpunkt-Ländern steigt oder fällt –
//                          und prüft das am nächsten Tag selbst nach. Trefferquote ehrlich, im Vergleich zur
//                          einfachen Annahme "bleibt gleich". Keine Prognose ohne Nachprüfung.
//
// Nur öffentliche Quellen. Gespeichert in server/data/weltintelligenz.json.
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";
import { sende } from "./ereignisbus.js";
import { buendeln, entdoppeln, kernWoerter, QUELLEN_ARTEN, bewerteQuelle } from "./quellen.js";

const NAME = "weltintelligenz";
const UA = { "User-Agent": "Mozilla/5.0 F.R.Ai.D.A.Y (privater Assistent)" };
const lade = () => ({ tage: {}, prognosen: [], recherchen: [], ...store.load(NAME, {}) });
const sichere = (d) => store.save(NAME, d);
const heute = (versatz = 0) => { const d = new Date(Date.now() + versatz * 86400000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
// Für Tests: andere Adressen (Probe-Server), sonst die echten öffentlichen Quellen.
const WIKI = () => process.env.FRIDAY_TEST_WIKI || "https://de.wikipedia.org";
const NEWS = () => process.env.FRIDAY_TEST_NEWS || "https://news.google.com";

async function lagezentrum() { return import("./lagezentrum.js"); }

// ---------- 🌍 Global Intelligence ----------
/** Tageswerte merken: Meldungen je Land (höchster Stand des Tages). Grundlage für Auffälligkeiten und Prognosen. */
function tagesWerteMerken(d, zaehl) {
  const t = heute();
  const alt = d.tage[t] || {};
  for (const [id, n] of Object.entries(zaehl)) alt[id] = Math.max(alt[id] || 0, n);
  d.tage[t] = alt;
  const tage = Object.keys(d.tage).sort();
  for (const x of tage.slice(0, Math.max(0, tage.length - 30))) delete d.tage[x];
}
const normWort = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const median = (l) => { const s = l.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

export async function weltLage({ merken = true } = {}) {
  const lz = await lagezentrum();
  const snap = lz.newsSnapshot();
  const alle = [];
  const zaehl = {};
  for (const [id, items] of snap) {
    zaehl[id] = items.length;
    const land = lz.COUNTRIES.find((c) => c.id === id);
    // Gebündelte Länder-Meldungen wieder in ihre Quellen auffächern, damit die Weltlage alle Bestätigungen zählt.
    for (const it of items) for (const q of it.quellenNamen?.length ? it.quellenNamen : [it.source]) alle.push({ ...it, source: q, land: land?.name || id, landId: id });
  }
  const d = lade();
  if (merken && snap.length >= 20) { tagesWerteMerken(d, zaehl); sichere(d); }
  // Weltweit bündeln: gleiche Meldung aus mehreren Ländern/Quellen = eine Geschichte.
  // Länder im Titel erkennen (ganze Namen, deutsch/englisch/Hauptstadt), damit Meldungen über verschiedene Länder getrennt bleiben.
  const muster = lz.COUNTRIES.flatMap((c) => [c.name, c.en, c.cap].filter((n) => n && n.length > 3).map((n) => [c.id, normWort(n)]));
  const laenderImTitel = (t) => { const x = ` ${normWort(t)} `; const t2 = muster.filter(([, n]) => x.includes(` ${n} `)); return [...new Set(t2.filter(([, n]) => !t2.some(([, m]) => m !== n && m.includes(n))).map(([id]) => id))]; };
  const laenderWorte = new Set(lz.COUNTRIES.flatMap((c) => [...kernWoerter(`${c.name} ${c.en} ${c.cap || ""}`)]));
  const cluster = buendeln(alle.map((i) => ({ title: i.title, source: i.source, link: i.link, date: i.date, land: i.land })), { trenner: laenderImTitel });
  const geschichten = cluster.slice(0, 15).map((c) => ({ ...c, laender: c.laender.slice(0, 6) }));
  // Quellen-Mix
  const mix = {};
  for (const it of alle) { const a = it.bewertung?.art || bewerteQuelle(it.source, it.link).art; mix[a] = (mix[a] || 0) + 1; }
  // Auffälligkeiten: heute deutlich mehr Meldungen als an den Vortagen
  const vortage = Object.keys(d.tage).sort().filter((t) => t < heute()).slice(-7);
  const auffaellig = [];
  if (vortage.length >= 2) {
    for (const [id, n] of Object.entries(zaehl)) {
      const basis = median(vortage.map((t) => d.tage[t][id] || 0));
      if (n >= 8 && n >= Math.max(4, basis) * 2) auffaellig.push({ id, land: lz.COUNTRIES.find((c) => c.id === id)?.name || id, heute: n, ueblich: basis });
    }
  }
  auffaellig.sort((a, b) => b.heute / Math.max(1, b.ueblich) - a.heute / Math.max(1, a.ueblich));
  // Themen des Tages: häufigste Kernwörter über alle Schlagzeilen (Ländernamen ausgenommen)
  const woerter = new Map();
  for (const it of alle) for (const w of kernWoerter(it.title)) if (!laenderWorte.has(w) && w.length > 3) woerter.set(w, (woerter.get(w) || 0) + 1);
  const themen = [...woerter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([w, n]) => ({ wort: w, anzahl: n }));
  return {
    stand: new Date().toISOString(), laender: snap.length, schlagzeilen: alle.length, meldungen: cluster.length,
    dubletten: Math.max(0, alle.length - cluster.length),
    bestaetigt: cluster.filter((c) => c.bestaetigt).length,
    geschichten, auffaellig: auffaellig.slice(0, 8), themen,
    quellenMix: Object.entries(mix).map(([art, n]) => ({ art, name: QUELLEN_ARTEN[art]?.name || art, stufe: QUELLEN_ARTEN[art]?.stufe || 3, anzahl: n, anteil: alle.length ? Math.round((n / alle.length) * 100) : 0 })).sort((a, b) => b.stufe - a.stufe),
    tage_gemerkt: Object.keys(d.tage).length,
  };
}

// ---------- 📈 Prognose-Zentrale ----------
/** Trend aus den letzten Tagen (lineare Steigung). */
function trend(werte) {
  const n = werte.length;
  if (n < 3) return null;
  const mx = (n - 1) / 2, my = werte.reduce((s, v) => s + v, 0) / n;
  let z = 0, q = 0;
  werte.forEach((v, i) => { z += (i - mx) * (v - my); q += (i - mx) ** 2; });
  return { steigung: q ? z / q : 0, mittel: my };
}
const richtung = (alt, neu, toleranz) => (neu > alt + toleranz ? "steigt" : neu < alt - toleranz ? "faellt" : "gleich");

/** Prognosen von gestern nachprüfen, dann neue für morgen erstellen. Läuft täglich (Herzschlag) und auf Knopfdruck. */
export async function prognosenRunde() {
  const d = lade();
  const t = heute();
  const tage = Object.keys(d.tage).sort();
  let geprueft = 0, neu = 0;
  // 1) Nachprüfen: Prognosen für einen Tag, der vorbei ist und für den Werte vorliegen
  for (const p of d.prognosen) {
    if (p.geprueft || p.fuer >= t || !d.tage[p.fuer]) continue;
    const ist = d.tage[p.fuer][p.landId] || 0;
    const tol = Math.max(1, Math.round(p.basis * 0.15));
    p.ist = ist;
    p.ergebnis = richtung(p.basis, ist, tol);
    p.getroffen = p.ergebnis === p.aussage;
    p.naiv_getroffen = p.ergebnis === "gleich"; // Vergleich: einfach "bleibt gleich" sagen
    p.geprueft = new Date().toISOString();
    geprueft++;
  }
  // 2) Neue Prognosen für morgen (nur, wenn es mindestens 3 Tage Daten gibt und heute noch keine erstellt wurde)
  const morgen = heute(1);
  if (tage.length >= 3 && !d.prognosen.some((p) => p.fuer === morgen)) {
    const letzte = tage.slice(-5);
    const heuteWerte = d.tage[letzte.at(-1)] || {};
    const top = Object.entries(heuteWerte).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const lz = await lagezentrum();
    for (const [id, basis] of top) {
      const tr = trend(letzte.map((x) => d.tage[x][id] || 0));
      if (!tr) continue;
      const tol = Math.max(1, Math.round(basis * 0.15));
      const erwartet = Math.max(0, Math.round(basis + tr.steigung));
      const aussage = richtung(basis, erwartet, tol);
      d.prognosen.push({ id: neueId(), art: "nachrichtenlage", landId: id, land: lz.COUNTRIES.find((c) => c.id === id)?.name || id, erstellt: new Date().toISOString(), fuer: morgen, basis, erwartet, aussage, methode: `Trend der letzten ${letzte.length} Tage` });
      neu++;
    }
  }
  d.prognosen = d.prognosen.slice(-300);
  sichere(d);
  if (geprueft || neu) {
    const q = trefferquote(d.prognosen);
    eintragen({ bereich: "system", titel: `Prognose-Zentrale: ${geprueft} nachgeprüft, ${neu} neue Prognosen`, details: q.geprueft ? `Trefferquote ${q.quote} % (einfache Annahme „bleibt gleich“: ${q.naiv} %)` : "Noch keine nachgeprüften Prognosen.", quelle: "prognose-zentrale" });
    sende("prognose", { geprueft, neu, ...q }, { quelle: "prognose-zentrale" });
  }
  return { geprueft, neu, ...trefferquote(d.prognosen) };
}
function trefferquote(liste) {
  const g = liste.filter((p) => p.geprueft);
  return { geprueft: g.length, quote: g.length ? Math.round((g.filter((p) => p.getroffen).length / g.length) * 100) : null, naiv: g.length ? Math.round((g.filter((p) => p.naiv_getroffen).length / g.length) * 100) : null };
}
export function prognosen() {
  const d = lade();
  return { ...trefferquote(d.prognosen), offen: d.prognosen.filter((p) => !p.geprueft).slice(-12).reverse(), geprueft_liste: d.prognosen.filter((p) => p.geprueft).slice(-20).reverse(), tage_daten: Object.keys(d.tage).length };
}

// ---------- 🔎 Deep Research 2.0 ----------
const laufend = new Map(); // thema -> Promise
async function holeJson(url, ms = 12000) {
  const r = await fetch(url, { headers: { ...UA, Accept: "application/json" }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${new URL(url).host}: ${r.status}`);
  return r.json();
}
async function holeText(url, ms = 12000) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${new URL(url).host}: ${r.status}`);
  return r.text();
}
const dekodiere = (s) => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
function rss(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const get = (tag) => dekodiere(m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] || "");
    const full = get("title"), source = get("source");
    const title = source && full.endsWith(` - ${source}`) ? full.slice(0, -source.length - 3) : full;
    const datum = new Date(get("pubDate"));
    const link = get("link");
    out.push({ title, source, link: /^https:\/\//.test(link) ? link : "", date: Number.isNaN(datum.getTime()) ? null : datum.toISOString() });
  }
  return out;
}

/**
 * Tiefen-Recherche. Sammelt aus mehreren Quellen, bewertet, bündelt und speichert ein Dossier.
 * @param {string} thema
 * @param {{mitKi?: boolean}} [opt] mitKi: KI-Zusammenfassung auch, wenn sie Geld kostet (mit Kostenlimit)
 */
export async function tiefenRecherche(thema, { mitKi = false } = {}) {
  const th = String(thema || "").trim().slice(0, 100);
  if (th.length < 2) return { error: "Welches Thema soll ich recherchieren?" };
  if (laufend.has(th.toLowerCase())) return laufend.get(th.toLowerCase());
  const p = (async () => {
    const start = Date.now();
    const quellenStatus = [];
    const versuch = async (name, fn) => { try { const r = await fn(); quellenStatus.push({ name, ok: true, anzahl: Array.isArray(r) ? r.length : r ? 1 : 0 }); return r; } catch (err) { quellenStatus.push({ name, ok: false, fehler: String(err.message || err).slice(0, 80) }); return null; } };
    const [wiki, news, feeds] = await Promise.all([
      versuch("Wikipedia", async () => {
        const s = await holeJson(`${WIKI()}/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=5&srsearch=${encodeURIComponent(th)}`);
        const t = s?.query?.search || [];
        if (!t.length) return null;
        const sum = await holeJson(`${WIKI()}/api/rest_v1/page/summary/${encodeURIComponent(t[0].title.replace(/ /g, "_"))}`).catch(() => null);
        return { titel: t[0].title, text: String(sum?.extract || "").trim(), link: sum?.content_urls?.desktop?.page || `${WIKI()}/wiki/${encodeURIComponent(t[0].title)}`, verwandt: t.slice(1).map((x) => x.title) };
      }),
      versuch("Nachrichten", async () => rss(await holeText(`${NEWS()}/rss/search?q=${encodeURIComponent(th)}+when:7d&hl=de&gl=DE&ceid=DE:de`)).slice(0, 60)),
      versuch("Eigene Feeds", async () => {
        const f = await import("./feeds.js");
        const alle = await Promise.race([f.alle(), new Promise((res) => setTimeout(() => res([]), 8000))]);
        const w = [...kernWoerter(th)];
        const treffer = [];
        for (const feed of alle || []) for (const it of feed.artikel || []) {
          const titel = it.titel || "";
          const k = kernWoerter(`${titel} ${it.text || ""}`);
          if (w.length && w.every((x) => k.has(x))) treffer.push({ title: titel, source: feed.name, link: it.link || "", date: it.at || null });
        }
        return treffer;
      }),
    ]);
    const meldungen = buendeln([...(news || []), ...(feeds || [])]);
    const quellen = [...new Map(meldungen.flatMap((m) => m.quellen).map((q) => [q.name.toLowerCase(), q])).values()];
    const hochwertig = quellen.filter((q) => q.stufe >= 4).length;
    const zeitleiste = meldungen.filter((m) => m.datum).sort((a, b) => a.datum.localeCompare(b.datum)).slice(-12);
    // Qualität: wie gut ist das Thema belegt?
    const punkte = (wiki?.text ? 30 : 0) + Math.min(30, quellen.length * 5) + Math.min(25, hochwertig * 5) + Math.min(15, meldungen.filter((m) => m.bestaetigt).length * 5);
    const qualitaet = { punkte, stufe: punkte >= 70 ? "gut belegt" : punkte >= 40 ? "teilweise belegt" : "dünn belegt", quellen: quellen.length, hochwertig, bestaetigt: meldungen.filter((m) => m.bestaetigt).length };
    // Optional: KI-Zusammenfassung – kostenlos (Ollama) immer, bezahlt nur auf Wunsch und mit Kostenlimit
    let ki = null;
    try {
      const kc = await import("./ki-client.js");
      if ((kc.kostenlosBereit() || mitKi) && (wiki?.text || meldungen.length)) {
        const system = "Du fasst eine Recherche sachlich auf Deutsch zusammen. Nur was im Stoff steht, nichts erfinden. 5 bis 8 Sätze, dann eine Zeile 'Offene Fragen:' mit 2 Punkten.";
        const stoff = `Thema: ${th}\n\n${wiki?.text ? `Wikipedia: ${wiki.text}\n\n` : ""}Aktuelle Meldungen:\n${meldungen.slice(0, 15).map((m) => `- ${m.titel} (${m.quelle}, ${m.quellen.length} Quelle${m.quellen.length === 1 ? "" : "n"})`).join("\n")}`.slice(0, 12000);
        if (kc.kostenlosBereit() && !mitKi) {
          // Lokale KI zuerst (kostet nichts)
          const r = await kc.fragen("ollama", { max_tokens: 900, system, messages: [{ role: "user", content: stoff }] }, { quelle: "deep-research" });
          ki = (r?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim() || null;
          if (ki) ki = `${ki}\n(lokale KI)`;
        } else {
          // Ausdrücklich gewünscht: bezahlte KI, läuft über den Kosten-Deckel
          const { denke } = await import("./denker.js");
          const r = await denke({ system, text: stoff, stufe: "klein", maxTokens: 900, quelle: "deep-research" });
          if (r.ok) ki = r.text;
        }
      }
    } catch { /* KI ist Zugabe */ }
    const r = {
      id: neueId(), thema: th, erstellt: new Date().toISOString(), dauer_ms: Date.now() - start,
      ueberblick: wiki ? { titel: wiki.titel, text: wiki.text.slice(0, 1500), link: wiki.link, verwandt: wiki.verwandt } : null,
      meldungen: meldungen.slice(0, 20), zeitleiste, quellen: quellen.sort((a, b) => b.stufe - a.stufe).slice(0, 30), qualitaet, quellenStatus, ki,
    };
    // Dossier speichern
    try {
      const { dokumentErstellen } = await import("./dokumente.js");
      const md = [`# Tiefen-Recherche: ${th}`, `Stand: ${new Date().toLocaleString("de-DE")} · Qualität: ${qualitaet.stufe} (${qualitaet.quellen} Quellen, ${qualitaet.hochwertig} hochwertig, ${qualitaet.bestaetigt} bestätigte Meldungen)`,
        r.ueberblick ? `## Überblick\n${r.ueberblick.text}\n\nQuelle: ${r.ueberblick.link}` : "## Überblick\n(kein Wikipedia-Artikel gefunden)",
        ki ? `## KI-Zusammenfassung (ungeprüft)\n${ki}` : "",
        `## Aktuelle Meldungen\n${r.meldungen.slice(0, 12).map((m) => `- ${m.titel} – ${m.quelle} [${QUELLEN_ARTEN[m.art]?.name || ""}]${m.quellen.length > 1 ? ` · ✓ ${m.quellen.length} Quellen` : ""}${m.link ? ` (${m.link})` : ""}`).join("\n") || "- keine"}`,
        `## Zeitleiste\n${zeitleiste.map((m) => `- ${m.datum.slice(0, 10)}: ${m.titel}`).join("\n") || "- keine"}`,
        `## Quellen\n${r.quellen.map((q) => `- ${q.name} (${QUELLEN_ARTEN[q.art]?.name || q.art})`).join("\n") || "- keine"}`,
        `## Abgefragt\n${quellenStatus.map((q) => `- ${q.name}: ${q.ok ? `ok (${q.anzahl})` : `nicht erreichbar – ${q.fehler}`}`).join("\n")}`].filter(Boolean).join("\n\n");
      const doc = dokumentErstellen({ titel: `Recherche: ${th}`, inhalt: md });
      if (doc?.id) r.dokument = doc.id;
    } catch { /* Dossier ist Zugabe */ }
    const d = lade();
    d.recherchen = [...d.recherchen, r].slice(-25);
    sichere(d);
    const ok = Boolean(r.ueberblick || r.meldungen.length);
    eintragen({ bereich: "agent", titel: `Tiefen-Recherche: ${th}`, details: `${qualitaet.stufe}, ${qualitaet.quellen} Quellen, ${r.meldungen.length} Meldungen`, ok, quelle: "deep-research", dauer_ms: r.dauer_ms });
    sende("recherche", { thema: th, ok, qualitaet: qualitaet.stufe }, { quelle: "deep-research" });
    return r;
  })();
  laufend.set(th.toLowerCase(), p);
  try { return await p; } finally { laufend.delete(th.toLowerCase()); }
}
export const recherchen = () => lade().recherchen.slice().reverse().map(({ meldungen, zeitleiste, ...r }) => ({ ...r, meldungen: meldungen.length }));
export const recherche = (id) => lade().recherchen.find((r) => r.id === id) || null;
export const rechercheLaeuft = () => [...laufend.keys()];

/** Kurzantwort zum Vorlesen. */
export function rechercheText(r) {
  if (r.error) return r.error;
  if (!r.ueberblick && !r.meldungen.length) return `Zu ${r.thema} habe ich gerade keine Quelle erreicht (${r.quellenStatus.filter((q) => !q.ok).map((q) => q.name).join(", ")} nicht erreichbar).`;
  const satz = r.ueberblick?.text ? r.ueberblick.text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ") : "";
  return `${satz ? `${satz} ` : ""}Aktuell: ${r.meldungen.length} Meldung${r.meldungen.length === 1 ? "" : "en"} aus ${r.qualitaet.quellen} Quellen, davon ${r.qualitaet.bestaetigt} mehrfach bestätigt. Das Thema ist ${r.qualitaet.stufe}. Das Dossier liegt unter Dokumente.`;
}

// ---------- Sprachbefehle (ohne Claude) ----------
export async function quickCommand(text) {
  const t = String(text || "").trim().replace(/^(hey |hallo |ok )?friday[ ,.]*/i, "").replace(/[!?.]+$/g, "").trim();
  const k = t.toLowerCase();
  let m;
  if ((m = t.match(/^(?:recherchiere? gründlich(?: über| zu)?|tiefen-?recherche(?: über| zu)?|deep research(?: über| zu)?|mach(?: mir)? eine tiefen-?recherche (?:über|zu))\s+(.{2,80}?)(\s+mit ki)?$/i))) {
    const r = await tiefenRecherche(m[1], { mitKi: Boolean(m[2]) });
    return { answer: rechercheText(r), actions: ["cockpit:welt"] };
  }
  if (/^(wie ist die (welt-?)?lage|globale lage|global intelligence|welt-?intelligenz|was ist (heute )?(in der welt|weltweit) los|zeig( mir)? die welt-?lage)$/.test(k)) {
    const w = await weltLage();
    if (!w.schlagzeilen) return { answer: "Das Lagezentrum sammelt gerade noch Meldungen. Frag mich gleich nochmal.", actions: ["cockpit:welt"] };
    const top = w.geschichten.slice(0, 3).map((g) => `${g.titel}${g.quellen.length > 1 ? ` (${g.quellen.length} Quellen)` : ""}`);
    return { answer: `Weltweit ${w.meldungen} Meldungen aus ${w.laender} Ländern, ${w.dubletten} Doppelte habe ich zusammengefasst. Wichtigste Themen: ${top.join(". ")}.${w.auffaellig.length ? ` Auffällig viel los in: ${w.auffaellig.slice(0, 3).map((a) => a.land).join(", ")}.` : ""}`, actions: ["cockpit:welt"] };
  }
  if (/^(zeig( mir)? (die )?prognosen?|prognose-?zentrale|wie gut sind deine prognosen|trefferquote)$/.test(k)) {
    const p = prognosen();
    return { answer: p.geprueft ? `Ich habe ${p.geprueft} Prognosen nachgeprüft: ${p.quote} Prozent richtig. Zum Vergleich: Einfach „bleibt gleich“ zu sagen hätte ${p.naiv} Prozent getroffen. ${p.offen.length} Prognosen warten noch auf morgen.` : `Noch keine Prognose nachgeprüft. Ich brauche mindestens 3 Tage Nachrichten-Daten, ich habe ${p.tage_daten}.`, actions: ["cockpit:welt"] };
  }
  return null;
}

export function weltRouten(app, asyncRoute) {
  app.get("/api/welt/lage", asyncRoute(async (req, res) => res.json(await weltLage())));
  app.get("/api/welt/prognosen", (req, res) => res.json(prognosen()));
  app.post("/api/welt/prognosen/runde", asyncRoute(async (req, res) => res.json(await prognosenRunde())));
  app.get("/api/welt/recherchen", (req, res) => res.json({ recherchen: recherchen(), laufend: rechercheLaeuft() }));
  app.get("/api/welt/recherchen/:id", (req, res) => { const r = recherche(req.params.id); return r ? res.json(r) : res.status(404).json({ error: "Nicht gefunden." }); });
  app.post("/api/welt/recherche", asyncRoute(async (req, res) => {
    const r = await tiefenRecherche(String(req.body?.thema || ""), { mitKi: Boolean(req.body?.mitKi) });
    return r.error ? res.status(400).json(r) : res.json(r);
  }));
  app.post("/api/welt/quellen", (req, res) => res.json({ items: entdoppeln(Array.isArray(req.body?.items) ? req.body.items.slice(0, 200) : []) }));
}

/** Täglich (Herzschlag): Tageswerte merken, Prognosen nachprüfen und neu erstellen. */
export async function weltStart() {
  try {
    const hz = await import("./herzschlag.js");
    hz.aufgabeRegistrieren("prognose-zentrale", {
      name: "Prognose-Zentrale", text: "Merkt sich die Nachrichtenlage, prüft gestrige Prognosen nach und erstellt neue.", art: "taeglich", zeit: "21:30", standardAn: true,
      lauf: async () => { await weltLage(); const r = await prognosenRunde(); return { ok: true, text: `${r.geprueft} nachgeprüft, ${r.neu} neu${r.quote != null ? `, Trefferquote ${r.quote} %` : ""}` }; },
    });
    // Tageswerte auch tagsüber merken (alle 2 Stunden), damit Auffälligkeiten stimmen
    setInterval(() => weltLage().catch(() => {}), 2 * 3600 * 1000).unref?.();
  } catch { /* egal */ }
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "quellen", bereich: "Welt", name: "Quellen-Bewertung und Dubletten-Erkennung", lauf: async () => {
      const items = [
        { title: "Erdbeben der Stärke 6,1 erschüttert Japan", source: "tagesschau.de" },
        { title: "Japan: Starkes Erdbeben der Stärke 6,1 erschüttert Küste", source: "Reuters" },
        { title: "Bundestag beschließt Haushalt", source: "Mein Blog" },
      ];
      const b = buendeln(items);
      const ok = b.length === 2 && b[0].quellen.length === 2 && b[0].bestaetigt && b[1].art === "unbekannt" && bewerteQuelle("RT DE").art === "staatlich";
      return ok ? { status: "bestanden", text: "Doppelte Meldung erkannt, 2 Quellen bestätigt, Quellen-Arten richtig." } : { status: "fehler", text: `Unerwartet: ${JSON.stringify(b.map((x) => [x.titel, x.quellen.length]))}` };
    } });
    ft.pruefungAnmelden({ id: "prognose-zentrale", bereich: "Welt", name: "Prognosen werden nachgeprüft", lauf: async () => {
      const p = prognosen();
      if (p.tage_daten < 3) return { status: "uebersprungen", text: `Erst ${p.tage_daten} Tag(e) Nachrichten-Daten, ab 3 Tagen gibt es Prognosen.` };
      const ueberfaellig = p.offen.filter((x) => x.fuer < heute(-1));
      return ueberfaellig.length ? { status: "fehler", text: `${ueberfaellig.length} Prognosen wurden nicht rechtzeitig nachgeprüft.` } : { status: "bestanden", text: `${p.geprueft} nachgeprüft${p.quote != null ? `, ${p.quote} % richtig (bleibt-gleich: ${p.naiv} %)` : ""}.` };
    } });
  } catch { /* egal */ }
}
