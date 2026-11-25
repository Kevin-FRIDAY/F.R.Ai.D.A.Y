// Quellen-Bewertung und Dubletten-Erkennung (v1.181.0, Mark XII Punkt 25) – ohne Abhängigkeiten.
//
// Bewertung: Jede Nachrichtenquelle bekommt eine ART (was für eine Quelle ist das?) und daraus eine
// Vertrauens-STUFE 1–5. Die Einteilung beschreibt die Art des Mediums, keine politische Meinung:
//   5 Nachrichtenagentur / öffentlich-rechtlich · 4 Qualitätspresse/Fachmedium · 3 Regional-/Onlinemedium
//   oder unbekannt · 2 Boulevard · 1 staatlich gelenkt (Regierung bestimmt die Inhalte).
// Unbekannte Quellen sind "unbekannt" (Stufe 3), nicht automatisch schlecht.
//
// Dubletten: Dieselbe Meldung von mehreren Quellen wird zu EINER Meldung zusammengefasst.
// Mehrere unabhängige Quellen = "bestätigt". Das macht Fridays Weltlage ruhiger und ehrlicher.

const ARTEN = {
  agentur: { stufe: 5, name: "Nachrichtenagentur" },
  oer: { stufe: 5, name: "Öffentlich-rechtlich" },
  qualitaet: { stufe: 4, name: "Qualitätspresse" },
  fach: { stufe: 4, name: "Fachmedium" },
  regional: { stufe: 3, name: "Regional/Online" },
  unbekannt: { stufe: 3, name: "Unbekannt" },
  boulevard: { stufe: 2, name: "Boulevard" },
  staatlich: { stufe: 1, name: "Staatlich gelenkt" },
};
export const QUELLEN_ARTEN = ARTEN;

// Bekannte Quellen (Kleinbuchstaben, Teilwort reicht). Erweiterbar über eigene Einträge.
const BEKANNT = [
  ["agentur", ["reuters", "dpa", "afp", "associated press", "ap news", "apnews", "epd", "kna", "bloomberg", "ansa", "efe"]],
  ["oer", ["tagesschau", "ard", "zdf", "deutschlandfunk", "dlf", "deutsche welle", "dw.com", "dw ", "br24", "bayerischer rundfunk", "ndr", "wdr", "swr", "mdr", "hr-inforadio", "hessenschau", "rbb", "sr.de", "orf", "srf", "bbc", "phoenix", "3sat", "arte", "radio bremen", "funk", "sportschau", "npr", "pbs"]],
  ["qualitaet", ["spiegel", "zeit", "faz", "frankfurter allgemeine", "süddeutsche", "sueddeutsche", "sz.de", "handelsblatt", "nzz", "neue zürcher", "tagesspiegel", "welt", "die welt", "stern", "taz", "der standard", "die presse", "wirtschaftswoche", "capital", "manager magazin", "financial times", "the guardian", "new york times", "nytimes", "washington post", "le monde", "economist", "wall street journal", "wsj", "politico", "the times", "frankfurter rundschau", "rnd", "redaktionsnetzwerk"]],
  ["fach", ["heise", "golem", "c't", "t3n", "netzpolitik", "chip", "computerbase", "kicker", "aerzteblatt", "ärzteblatt", "spektrum", "nature", "science", "lto", "legal tribune", "finanzen.net", "börse", "boerse", "onvista", "auto motor", "adac"]],
  ["boulevard", ["bild", "b.z.", "express", "tz.de", "abendzeitung", "daily mail", "the sun", "mirror", "promiflash", "gala", "bunte"]],
  ["staatlich", ["rt deutsch", "rt.com", "rt de", "sputnik", "tass", "ria novosti", "cgtn", "xinhua", "global times", "china daily", "press tv", "presstv", "kcna", "tasnim", "irna", "anadolu", "trt"]],
  ["regional", ["focus online", "focus.de", "merkur", "rp online", "rheinische post", "waz", "ksta", "kölner stadt", "stuttgarter", "hamburger abendblatt", "mopo", "berliner zeitung", "morgenpost", "nordkurier", "ostsee-zeitung", "lvz", "mz", "hna", "op-online", "fr.de", "t-online", "n-tv", "ntv", "web.de", "gmx", "msn", "yahoo", "watson", "rtl", "sat.1", "pro7", "n24", "euronews", "cnn", "fox news", "al jazeera", "newsweek"]],
];

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Bewertung einer Quelle (Name oder Link). */
export function bewerteQuelle(quelle = "", link = "") {
  const q = norm(quelle);
  let host = "";
  try { host = link ? new URL(link).hostname.replace(/^www\./, "") : ""; } catch { /* egal */ }
  const ziel = `${q} ${host}`;
  // "welt" nur als ganzer Name, sonst passt es auf "weltbank" o. ä.
  for (const [art, namen] of BEKANNT) {
    for (const n of namen) {
      const nn = norm(n);
      const treffer = nn.length <= 4 || nn === "welt" || nn === "zeit" || nn === "bild" ? new RegExp(`(^|[^a-z])${nn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(ziel) : ziel.includes(nn);
      if (treffer) return { art, ...ARTEN[art] };
    }
  }
  return { art: "unbekannt", ...ARTEN.unbekannt };
}

// ---------- Dubletten ----------
const STOP = new Set("der die das den dem des ein eine einer eines einem und oder aber nach nach vor bei mit von vom zu zum zur im in am an auf aus für fuer über ueber unter gegen wie was wer ist sind war hat haben wird werden nicht auch noch mehr neue neuer neues jetzt heute live ticker news update video foto bilder the a an of to in on for and with at by from is are as".split(" "));
export function kernWoerter(titel = "") {
  return new Set(norm(titel).replace(/[^a-z0-9äöüß ]+/g, " ").split(" ").filter((w) => w.length > 2 && !STOP.has(w)).map((w) => (w.length > 6 ? w.slice(0, 6) : w)));
}
// Dice-Ähnlichkeit der Kernwörter (0–1). Gemeinsame Wörter zählen doppelt, beide Längen zählen mit.
export function aehnlich(a, b) {
  if (!a.size || !b.size) return 0;
  let g = 0;
  for (const w of a) if (b.has(w)) g++;
  return (2 * g) / (a.size + b.size);
}

/**
 * Gleiche Meldungen zusammenfassen.
 * @param {{title:string, source?:string, link?:string, date?:string}[]} items
 * @returns {{titel, quelle, link, datum, quellen:{name,stufe,art}[], anzahl, bestaetigt, vertrauen, beste}[]}
 */
export function buendeln(items = [], { schwelle = 0.55, trenner = null } = {}) {
  const cluster = [];
  // trenner (z. B. Ländernamen): Nennen zwei Meldungen verschiedene Länder, sind es verschiedene Geschichten.
  // Länder des ganzen Bündels zählen mit, damit eine Meldung ohne Ländernamen nicht zwei Länder verbindet.
  // trenner: Set von Kernwörtern ODER Funktion (titel) => Liste von Länder-Kennungen.
  const laenderVon = (w, titel) => (!trenner ? [] : typeof trenner === "function" ? trenner(titel) || [] : [...w].filter((x) => trenner.has(x)));
  const passt = (c, w, wl) => {
    if (wl.length && c.lw.size && !wl.some((x) => c.lw.has(x))) return false;
    return c.ws.some((v) => aehnlich(v, w) >= schwelle);
  };
  for (const it of items) {
    if (!it?.title) continue;
    const w = kernWoerter(it.title);
    const b = bewerteQuelle(it.source, it.link);
    // Vergleich mit jeder Meldung im Bündel (nicht mit einer wachsenden Wortsammlung – sonst schluckt ein Bündel alles).
    const wl = laenderVon(w, it.title);
    let c = cluster.find((x) => passt(x, w, wl));
    if (!c) { c = { ws: [], items: [], lw: new Set() }; cluster.push(c); }
    for (const x of wl) c.lw.add(x);
    c.items.push({ ...it, bewertung: b });
    if (c.ws.length < 6) c.ws.push(w);
  }
  return cluster.map((c) => {
    const sortiert = c.items.slice().sort((a, b) => b.bewertung.stufe - a.bewertung.stufe || String(b.date || "").localeCompare(String(a.date || "")));
    const beste = sortiert[0];
    const quellenNamen = [...new Map(c.items.map((i) => [norm(i.source || i.link || "?"), { name: i.source || "Quelle", stufe: i.bewertung.stufe, art: i.bewertung.art }])).values()];
    const unabhaengig = quellenNamen.length;
    const vertrauen = Math.min(100, Math.round((beste.bewertung.stufe / 5) * 60 + Math.min(4, unabhaengig - 1) * 10));
    return {
      titel: beste.title, quelle: beste.source || "", link: beste.link || "", datum: c.items.map((i) => i.date).filter(Boolean).sort()[0] || null,
      quellen: quellenNamen, anzahl: c.items.length, laender: [...new Set(c.items.map((i) => i.land).filter(Boolean))], bestaetigt: unabhaengig >= 2, vertrauen, stufe: beste.bewertung.stufe, art: beste.bewertung.art,
    };
  }).sort((a, b) => b.quellen.length - a.quellen.length || b.vertrauen - a.vertrauen);
}

/** Für Listen von Schlagzeilen: Dubletten raus, jede Zeile mit Bewertung und Zahl der Bestätigungen. */
export function entdoppeln(items = []) {
  return buendeln(items).map((c) => ({ title: c.titel, source: c.quelle, link: c.link, date: c.datum, bewertung: { stufe: c.stufe, art: c.art, name: ARTEN[c.art]?.name || "" }, quellen: c.quellen.length, quellenNamen: c.quellen.map((q) => q.name).slice(0, 8), vertrauen: c.vertrauen }));
}
