// Öffentliche Daten aus Weltraum, Wissen und Wirtschaft (v1.165.0): NASA-Bild des Tages, Asteroiden, Menschen im All,
// Wikipedia „Heute vor … Jahren“ und „Meistgelesen“, Nobelpreise, Inflation & Arbeitslosigkeit (Eurostat), EZB-Leitzins.
// Alles kostenlos. NASA geht ohne Schlüssel (DEMO_KEY, wenige Abrufe pro Stunde); mit NASA_API_KEY in der .env mehr.
import { holen, gemerkt, de, datum, heute, kuerzen } from "./hilfe.js";

const NASA = () => process.env.NASA_API_KEY || "DEMO_KEY";

// ---------- NASA: Astronomie-Bild des Tages ----------
const apod = {
  id: "apod", titel: "NASA-Bild des Tages", icon: "🔭", gruppe: "Weltraum",
  info: "Jeden Tag ein neues Weltraumbild der NASA mit Erklärung.",
  quelle: "NASA APOD", link: "https://apod.nasa.gov",
  eingabe: null,
  sprache: [/^(?:zeig mir )?(?:das )?(?:nasa-?bild|weltraumbild|astronomie-?bild|bild des tages|nasa bild des tages|apod)(?: des tages)?(?: von heute)?$/],
  async laden() {
    const d = await gemerkt(`apod:${heute().iso}`, 6 * 3600 * 1000, () => holen(`https://api.nasa.gov/planetary/apod?api_key=${NASA()}&thumbs=true`));
    const bild = d.media_type === "image" ? d.url : d.thumbnail_url || null;
    return {
      text: `Das NASA-Bild des Tages heißt „${d.title}“.${d.copyright ? ` Aufgenommen von ${String(d.copyright).trim()}.` : ""} Ich zeige es dir im Fenster.`,
      bild, bildGross: d.hdurl || bild, video: d.media_type === "video" ? d.url : null,
      zeilen: [{ titel: d.title, wert: d.date ? datum(d.date) : "", unter: kuerzen(d.explanation, 900) + " (Text der NASA, englisch)", link: `https://apod.nasa.gov/apod/ap${String(d.date || "").replace(/-/g, "").slice(2)}.html` }],
    };
  },
};

// ---------- NASA: erdnahe Asteroiden heute ----------
const asteroiden = {
  id: "asteroiden", titel: "Asteroiden heute", icon: "☄️", gruppe: "Weltraum",
  info: "Welche Asteroiden heute an der Erde vorbeifliegen, wie groß und wie nah.",
  quelle: "NASA NeoWs (JPL)", link: "https://cneos.jpl.nasa.gov",
  eingabe: null,
  sprache: [/^(?:welche |gibt es |kommen )?(?:asteroiden|meteoriten|kometen|erdnahe objekte)(?: (?:fliegen|kommen))?(?: (?:heute|gerade|diese woche))?(?: an der erde vorbei| vorbei| in der nähe| in erdnähe)?$/],
  async laden() {
    const t = heute().iso;
    const d = await gemerkt(`neo:${t}`, 6 * 3600 * 1000, () => holen(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${t}&end_date=${t}&api_key=${NASA()}`, { timeout: 20000 }));
    const liste = (d.near_earth_objects?.[t] || Object.values(d.near_earth_objects || {})[0] || []).map((a) => {
      const n = a.close_approach_data?.[0] || {};
      const m = a.estimated_diameter?.meters || {};
      return { name: String(a.name || "").replace(/[()]/g, ""), gefahr: a.is_potentially_hazardous_asteroid, groesse: ((Number(m.estimated_diameter_min) || 0) + (Number(m.estimated_diameter_max) || 0)) / 2, abstand: Number(n.miss_distance?.kilometers), mond: Number(n.miss_distance?.lunar), tempo: Number(n.relative_velocity?.kilometers_per_hour), zeit: n.close_approach_date_full };
    }).sort((a, b) => a.abstand - b.abstand);
    if (!liste.length) return { text: "Heute meldet die NASA keinen Asteroiden in Erdnähe.", zeilen: [] };
    const n = liste[0];
    const gross = [...liste].sort((a, b) => b.groesse - a.groesse)[0];
    return {
      text: `Heute fliegen ${liste.length} Asteroiden an der Erde vorbei. Der nächste, ${n.name}, kommt bis auf ${de(n.abstand / 1e6, 1)} Millionen Kilometer heran, das ist ${de(n.mond, 1)}-mal die Entfernung zum Mond. Der größte ist etwa ${de(gross.groesse)} Meter groß. Keiner trifft die Erde.`,
      zeilen: liste.slice(0, 25).map((a) => ({ titel: `${a.gefahr ? "⚠️ " : ""}${a.name}`, wert: `${de(a.mond, 1)}× Mond`, farbe: a.mond < 5 ? "#ff9a2a" : "#3ddc84", unter: `ca. ${de(a.groesse)} m · ${de(a.abstand / 1e6, 2)} Mio. km · ${de(a.tempo)} km/h${a.gefahr ? " · von der NASA als „potenziell gefährlich“ eingestuft (Bahn, keine Einschlaggefahr heute)" : ""}` })),
    };
  },
};

// ---------- Menschen im All ----------
const astronauten = {
  id: "astronauten", titel: "Menschen im All", icon: "👩‍🚀", gruppe: "Weltraum",
  info: "Wer gerade im Weltraum ist, auf welcher Station und aus welchem Land.",
  quelle: "corquaid People in Space / Open Notify", link: "https://whoisinspace.com",
  eingabe: null,
  sprache: [/^(?:wer ist|wie viele (?:menschen|leute|astronauten) sind|wieviele (?:menschen|leute|astronauten) sind)(?: gerade| jetzt| aktuell)? (?:im (?:all|weltraum|weltall)|auf der iss)$/, /^(?:menschen|astronauten) im (?:all|weltraum)$/],
  async laden() {
    let leute = [];
    try {
      const d = await gemerkt("astros", 3 * 3600 * 1000, () => holen("https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json"));
      leute = (d.people || []).map((p) => ({ name: p.name, ort: p.spacecraft || (p.iss ? "ISS" : ""), land: p.country || "", rolle: p.position || "", agentur: p.agency || "", bild: p.image || null }));
    } catch {
      const d = await gemerkt("astros2", 3 * 3600 * 1000, () => holen("http://api.open-notify.org/astros.json"));
      leute = (d.people || []).map((p) => ({ name: p.name, ort: p.craft, land: "", rolle: "", agentur: "" }));
    }
    if (!leute.length) return { text: "Ich bekomme gerade keine Liste der Raumfahrer.", zeilen: [] };
    const orte = {};
    for (const p of leute) orte[p.ort || "Raumschiff"] = (orte[p.ort || "Raumschiff"] || 0) + 1;
    return {
      text: `Gerade sind ${leute.length} Menschen im All: ${Object.entries(orte).map(([o, n]) => `${n} ${o === "ISS" ? "auf der ISS" : `in ${o}`}`).join(", ")}.`,
      zeilen: leute.map((p) => ({ titel: p.name, wert: p.ort, unter: [p.rolle, p.agentur, p.land].filter(Boolean).join(" · "), bild: p.bild })),
    };
  },
};

// ---------- Wikipedia: Heute vor … Jahren ----------
const WIKI = "https://de.wikipedia.org/api/rest_v1/feed";
const heuteDamals = {
  id: "heute_damals", titel: "Heute vor … Jahren", icon: "📜", gruppe: "Wissen",
  info: "Was an diesem Tag in der Geschichte passiert ist.",
  quelle: "Wikipedia (Wikimedia-Feed)", link: "https://de.wikipedia.org",
  eingabe: null,
  sprache: [/^(?:was (?:ist|geschah|passierte|war) )?(?:heute vor (?:\w+ )?jahren|an diesem tag|heute in der geschichte|was geschah heute|was ist heute (?:früher |frueher )?passiert|was passierte heute|historisches ereignis(?: heute)?)$/],
  async laden() {
    const { m, t, j } = heute();
    const d = await gemerkt(`otd:${m}${t}`, 12 * 3600 * 1000, async () => {
      try { return await holen(`${WIKI}/onthisday/events/${m}/${t}`); } catch { return holen(`https://api.wikimedia.org/feed/v1/wikipedia/de/onthisday/events/${m}/${t}`); }
    });
    const ev = (d.events || d.selected || []).filter((e) => e.text && e.year).sort((a, b) => b.year - a.year);
    if (!ev.length) return { text: "Für heute habe ich keine Ereignisse gefunden.", zeilen: [] };
    // Eine runde Zahl zum Vorlesen, sonst das jüngste Ereignis.
    const rund = ev.find((e) => (Number(j) - e.year) % 25 === 0) || ev.find((e) => (Number(j) - e.year) % 10 === 0) || ev[0];
    const vor = Number(j) - rund.year;
    return {
      text: `Heute vor ${vor} Jahren, ${rund.year}: ${kuerzen(rund.text, 240)}`,
      zeilen: ev.slice(0, 30).map((e) => ({ titel: String(e.year), wert: `vor ${Number(j) - e.year} J.`, unter: kuerzen(e.text, 300), link: e.pages?.[0]?.content_urls?.desktop?.page })),
    };
  },
};

// ---------- Wikipedia: Meistgelesen ----------
const meistgelesen = {
  id: "meistgelesen", titel: "Wikipedia: Meistgelesen", icon: "🔥", gruppe: "Wissen",
  info: "Die Wikipedia-Artikel, die Deutschland gestern am meisten gelesen hat, und der Artikel des Tages.",
  quelle: "Wikipedia (Wikimedia-Feed)", link: "https://de.wikipedia.org",
  eingabe: null,
  sprache: [/^(?:was (?:lesen|suchen) (?:die leute|alle|die deutschen) (?:gerade |heute )?(?:auf |bei )?(?:wikipedia)?|meistgelesen(?:e artikel)?(?: auf wikipedia)?|wikipedia (?:trends|meistgelesen)|artikel des tages)$/],
  async laden() {
    const { j, m, t } = heute();
    const d = await gemerkt(`feat:${j}${m}${t}`, 3 * 3600 * 1000, async () => {
      try { return await holen(`${WIKI}/featured/${j}/${m}/${t}`); } catch { return holen(`https://api.wikimedia.org/feed/v1/wikipedia/de/featured/${j}/${m}/${t}`); }
    });
    const art = (d.mostread?.articles || []).filter((a) => !/^(Wikipedia|Spezial|Datei|Hauptseite|Portal):?/i.test(a.titles?.normalized || a.title || "")).slice(0, 15);
    const tfa = d.tfa;
    const text = (art.length ? `Gestern am meisten gelesen auf Wikipedia: ${art.slice(0, 3).map((a) => a.titles?.normalized || a.title).join(", ")}.` : "")
      + (tfa ? ` Artikel des Tages: ${tfa.titles?.normalized || tfa.title}.` : "");
    return {
      text: text.trim() || "Wikipedia liefert gerade keine Liste.",
      bild: tfa?.thumbnail?.source || null,
      zeilen: [
        ...(tfa ? [{ titel: `⭐ Artikel des Tages: ${tfa.titles?.normalized || tfa.title}`, unter: kuerzen(tfa.extract, 400), link: tfa.content_urls?.desktop?.page, farbe: "#ffe14d" }] : []),
        ...art.map((a, i) => ({ titel: `${i + 1}. ${a.titles?.normalized || a.title}`, wert: `${de(a.views)} Aufrufe`, unter: kuerzen(a.extract || a.description, 200), link: a.content_urls?.desktop?.page, bild: a.thumbnail?.source })),
      ],
    };
  },
};

// ---------- Nobelpreise ----------
const KAT_EN = { Physics: "physik", Chemistry: "chemie", "Physiology or Medicine": "medizin", Medicine: "medizin", Literature: "literatur", Peace: "frieden", "Economic Sciences": "wirtschaft" };
const KAT = { phy: "Physik", che: "Chemie", med: "Medizin", lit: "Literatur", pea: "Frieden", eco: "Wirtschaft" };
function nobelKat(t) {
  const s = String(t || "").toLowerCase();
  if (/physik/.test(s)) return "phy";
  if (/chemie/.test(s)) return "che";
  if (/medizin|physiologie/.test(s)) return "med";
  if (/literatur/.test(s)) return "lit";
  if (/frieden/.test(s)) return "pea";
  if (/wirtschaft/.test(s)) return "eco";
  return "";
}
const nobelpreis = {
  id: "nobelpreis", titel: "Nobelpreise", icon: "🏅", gruppe: "Wissen",
  info: "Wer den Nobelpreis bekommen hat, in jedem Fach und Jahr seit 1901.",
  quelle: "Nobel Prize API (Nobelstiftung)", link: "https://www.nobelprize.org",
  eingabe: { platzhalter: "Fach und Jahr, z. B. Physik 2024 (leer = neuestes Jahr)" },
  sprache: [
    /^(?:wer hat |wer bekam |wer bekommt |wer erhielt )?(?:den )?(?:(physik|chemie|medizin|literatur|friedens|wirtschafts)-?)?nobelpreis(?: (?:für|fuer|in) )?(\D*?)? ?(\d{4})?(?: bekommen| gewonnen| erhalten)?$/,
  ],
  ganzeFrage: true,
  kurz: (k) => [KAT[nobelKat(k)], k.match(/\b(19\d{2}|20\d{2})\b/)?.[1]].filter(Boolean).join(" "),
  async laden(q) {
    const s = String(q || "");
    const jahr = Number(s.match(/\b(19\d{2}|20\d{2})\b/)?.[1]) || null;
    const kat = nobelKat(s);
    const hole = (y) => gemerkt(`nobel:${y}:${kat}`, 864e5, () => holen(`https://api.nobelprize.org/2.1/nobelPrizes?nobelPrizeYear=${y}${kat ? `&nobelPrizeCategory=${kat}` : ""}&limit=20`));
    let y = jahr || Number(heute().j);
    let d = await hole(y);
    if (!jahr && !(d.nobelPrizes || []).some((p) => p.laureates?.length)) { y -= 1; d = await hole(y); }
    const preise = (d.nobelPrizes || []).filter((p) => p.laureates?.length);
    if (!preise.length) return { text: `Einen Nobelpreis${kat ? ` für ${KAT[kat]}` : ""} ${y} habe ich nicht gefunden.`, zeilen: [] };
    const namen = (p) => p.laureates.map((l) => l.knownName?.en || l.orgName?.en || l.fullName?.en || "?");
    const fach = (p) => KAT[nobelKat(KAT_EN[p.category?.en] || "")] || p.category?.en || "";
    const text = preise.length === 1
      ? `Den Nobelpreis für ${fach(preise[0])} ${y} bekam${preise[0].laureates.length > 1 ? "en" : ""} ${namen(preise[0]).join(" und ")}.`
      : `Nobelpreise ${y}: ${preise.map((p) => `${fach(p)}: ${namen(p).join(", ")}`).join(". ")}.`;
    return {
      text,
      zeilen: preise.flatMap((p) => p.laureates.map((l) => ({ titel: l.knownName?.en || l.orgName?.en || "?", wert: `${fach(p)} ${y}`, unter: kuerzen(l.motivation?.en || "", 260), link: `https://www.nobelprize.org/prizes/${String(p.category?.en || "").toLowerCase().replace(/\s.*/, "")}/${y}/summary/` }))),
    };
  },
};

// ---------- Eurostat (Inflation, Arbeitslosigkeit) ----------
/** JSON-stat 2.0 von Eurostat → [{ zeit, wert }] (älteste zuerst). */
async function eurostat(datensatz, filter) {
  const d = await gemerkt(`es:${datensatz}:${filter}`, 6 * 3600 * 1000, () => holen(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${datensatz}?format=JSON&lang=DE&${filter}`, { timeout: 20000 }));
  const idx = d.dimension?.time?.category?.index || {};
  return Object.entries(idx).map(([zeit, i]) => ({ zeit, wert: d.value?.[i] ?? d.value?.[String(i)] })).filter((x) => x.wert != null).sort((a, b) => a.zeit.localeCompare(b.zeit));
}
const monat = (z) => { const [y, m] = String(z).split("-"); return m ? new Date(Date.UTC(Number(y), Number(m) - 1, 15)).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }) : z; };
const inflation = {
  id: "inflation", titel: "Inflation", icon: "📈", gruppe: "Wirtschaft",
  info: "Teuerung in Deutschland und im Euroraum (harmonisierter Verbraucherpreisindex).",
  quelle: "Eurostat (HVPI)", link: "https://ec.europa.eu/eurostat",
  eingabe: null,
  sprache: [/^(?:wie hoch ist (?:die |gerade die )?)?(?:inflation|inflationsrate|teuerung|teuerungsrate)(?: in deutschland| im euroraum)?(?: gerade| jetzt| aktuell)?$/],
  async laden() {
    const reihe = async (geo) => {
      try { return await eurostat("prc_hicp_manr", `geo=${geo}&coicop=CP00&lastTimePeriod=13`); } catch { return eurostat("prc_hicp_minr", `geo=${geo}&coicop18=TOTAL&lastTimePeriod=13`); }
    };
    const [deu, ea] = await Promise.all([reihe("DE"), reihe("EA").catch(() => [])]);
    const l = deu[deu.length - 1];
    if (!l) return { text: "Eurostat liefert gerade keine Inflationszahl.", zeilen: [] };
    const v = deu[deu.length - 2];
    const e = ea[ea.length - 1];
    return {
      text: `Die Inflation in Deutschland lag im ${monat(l.zeit)} bei ${de(l.wert, 1)} Prozent${v ? `, im Monat davor bei ${de(v.wert, 1)} Prozent` : ""}.${e ? ` Im Euroraum waren es ${de(e.wert, 1)} Prozent.` : ""}`,
      verlauf: deu.map((x) => ({ x: x.zeit, y: x.wert })),
      zeilen: [...deu].reverse().map((x) => ({ titel: monat(x.zeit), wert: `${de(x.wert, 1)} %`, farbe: x.wert <= 2.2 ? "#3ddc84" : x.wert <= 4 ? "#ffe14d" : "#ff4a3a", unter: ea.find((y) => y.zeit === x.zeit) ? `Euroraum ${de(ea.find((y) => y.zeit === x.zeit).wert, 1)} %` : "" })),
    };
  },
};
const arbeitslosigkeit = {
  id: "arbeitslosigkeit", titel: "Arbeitslosigkeit", icon: "👷", gruppe: "Wirtschaft",
  info: "Arbeitslosenquote in Deutschland und der EU (international vergleichbar, ILO).",
  quelle: "Eurostat", link: "https://ec.europa.eu/eurostat",
  eingabe: null,
  sprache: [/^(?:wie hoch ist (?:die )?)?(?:arbeitslosigkeit|arbeitslosenquote|arbeitslosenzahl)(?: in deutschland| in der eu)?(?: gerade| jetzt| aktuell)?$/],
  async laden() {
    const f = (geo) => `geo=${geo}&age=TOTAL&sex=T&s_adj=SA&unit=PC_ACT&lastTimePeriod=12`;
    const [deu, eu] = await Promise.all([eurostat("une_rt_m", f("DE")), eurostat("une_rt_m", f("EU27_2020")).catch(() => [])]);
    const l = deu[deu.length - 1];
    if (!l) return { text: "Eurostat liefert gerade keine Arbeitslosenquote.", zeilen: [] };
    const e = eu[eu.length - 1];
    return {
      text: `Die Arbeitslosenquote in Deutschland lag im ${monat(l.zeit)} bei ${de(l.wert, 1)} Prozent (Messung nach internationaler Methode).${e ? ` In der EU waren es ${de(e.wert, 1)} Prozent.` : ""}`,
      verlauf: deu.map((x) => ({ x: x.zeit, y: x.wert })),
      zeilen: [...deu].reverse().map((x) => ({ titel: monat(x.zeit), wert: `${de(x.wert, 1)} %`, unter: eu.find((y) => y.zeit === x.zeit) ? `EU ${de(eu.find((y) => y.zeit === x.zeit).wert, 1)} %` : "" })),
    };
  },
};

// ---------- EZB-Leitzins ----------
async function ezb(schluessel) {
  const d = await gemerkt(`ezb:${schluessel}`, 6 * 3600 * 1000, () => holen(`https://data-api.ecb.europa.eu/service/data/FM/${schluessel}?lastNObservations=1&format=jsondata`, { headers: { Accept: "application/json" }, timeout: 15000 }));
  const serie = Object.values(d.dataSets?.[0]?.series || {})[0];
  const obs = Object.entries(serie?.observations || {})[0];
  if (!obs) return null;
  const zeit = d.structure?.dimensions?.observation?.[0]?.values?.[Number(obs[0])]?.id;
  return { wert: Number(obs[1][0]), zeit };
}
const leitzins = {
  id: "leitzins", titel: "EZB-Leitzins", icon: "🏦", gruppe: "Wirtschaft",
  info: "Die Zinssätze der Europäischen Zentralbank (Einlagesatz und Hauptrefinanzierung).",
  quelle: "Europäische Zentralbank (ECB Data Portal)", link: "https://data.ecb.europa.eu",
  eingabe: null,
  sprache: [/^(?:wie hoch ist (?:der |gerade der )?|wo steht (?:der )?)?(?:leitzins|ezb-?zins|ezb-?leitzins|zinsen der ezb|einlagezins|einlagensatz)(?: gerade| jetzt| aktuell)?$/],
  async laden() {
    const [dfr, mrr] = await Promise.all([ezb("B.U2.EUR.4F.KR.DFR.LEV"), ezb("B.U2.EUR.4F.KR.MRR_FR.LEV").catch(() => null)]);
    if (!dfr) return { text: "Die EZB liefert gerade keinen Zinssatz.", zeilen: [] };
    return {
      text: `Der wichtigste Leitzins der EZB, der Einlagesatz, liegt bei ${de(dfr.wert, 2)} Prozent${mrr ? `. Der Hauptrefinanzierungssatz liegt bei ${de(mrr.wert, 2)} Prozent` : ""}.`,
      zeilen: [
        { titel: "Einlagesatz (Leitzins)", wert: `${de(dfr.wert, 2)} %`, unter: dfr.zeit ? `gültig seit ${datum(dfr.zeit)}` : "", farbe: "#ff9a2a" },
        ...(mrr ? [{ titel: "Hauptrefinanzierungssatz", wert: `${de(mrr.wert, 2)} %`, unter: mrr.zeit ? `gültig seit ${datum(mrr.zeit)}` : "" }] : []),
      ],
    };
  },
};

export const QUELLEN = [apod, asteroiden, astronauten, heuteDamals, meistgelesen, nobelpreis, inflation, arbeitslosigkeit, leitzins];
