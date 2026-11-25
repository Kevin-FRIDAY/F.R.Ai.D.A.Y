// Öffentliche Daten aus Deutschland (v1.165.0): NINA-Warnungen, DWD-Pollen, Schulferien, Strommix & Börsenstrompreis,
// Postleitzahlen, Jobsuche der Arbeitsagentur, Radioaktivität (BfS). Alles kostenlos, ohne eigenen Schlüssel.
import { config } from "../config.js";
import { holen, gemerkt, de, datum, zeit, heute, kuerzen, km, ortOder, ortZuKoordinaten, deOrt, landSchluessel, LAENDER } from "./hilfe.js";

// ---------- NINA (Bundesamt für Bevölkerungsschutz) ----------
const NINA = "https://warnung.bund.de/api31";
const STUFE = { Extreme: ["extrem", "#c03cff", 4], Severe: ["schwer", "#ff4a3a", 3], Moderate: ["mittel", "#ff9a2a", 2], Minor: ["gering", "#ffe14d", 1], Unknown: ["Hinweis", "#9aa0a6", 0], Cancel: ["Entwarnung", "#3ddc84", 0] };
const ANBIETER = { MOWAS: "Bevölkerungsschutz", KATWARN: "Katwarn", BIWAPP: "Biwapp", DWD: "Wetterdienst", LHP: "Hochwasserzentrale", POLICE: "Polizei" };
const nina = {
  id: "nina", titel: "NINA-Warnungen", icon: "🚨", gruppe: "Deutschland",
  info: "Amtliche Warnungen für deinen Kreis: Katastrophenschutz, Hochwasser, Polizei, Unwetter.",
  quelle: "NINA – Bundesamt für Bevölkerungsschutz (BBK)", link: "https://warnung.bund.de",
  eingabe: { platzhalter: "Ort oder PLZ (leer = dein Ort)" },
  sprache: [
    /^(?:gibt es |gibts |welche |zeig mir (?:die )?|aktuelle )?(?:nina|nina-?warnungen?|katastrophen-?warnungen?|katastrophenschutz|bevölkerungsschutz|bevoelkerungsschutz|warnungen vom bund|amtliche warnungen|warn-?app)(?: (?:für|fuer|in|bei) (.+?))?(?: gerade| heute| aktuell)?$/,
    /^(?:gibt es |gibts )(?:eine |irgendwelche )?(?:warnungen?|gefahr|gefahren)(?: (?:für|fuer|in|bei) (.+?))?(?: gerade| heute| aktuell)?$/,
  ],
  async laden(q) {
    const ort = await deOrt(ortOder(q));
    const liste = await gemerkt(`nina:${ort.ars}`, 5 * 60 * 1000, () => holen(`${NINA}/dashboard/${ort.ars}.json`));
    const w = (Array.isArray(liste) ? liste : []).map((x) => {
      const d = x.payload?.data || {};
      const s = STUFE[d.severity] || STUFE.Unknown;
      return { id: x.id || x.payload?.id, titel: x.i18nTitle?.de || d.headline || "Warnung", anbieter: ANBIETER[d.provider] || d.provider || "", stufe: s[0], farbe: s[1], rang: s[2], zeit: x.sent || x.startDate, typ: d.msgType };
    }).sort((a, b) => b.rang - a.rang);
    // Für die wichtigsten drei den Text nachladen (Was tun?).
    await Promise.all(w.slice(0, 3).map(async (x) => {
      try {
        const det = await gemerkt(`ninad:${x.id}`, 30 * 60 * 1000, () => holen(`${NINA}/warnings/${encodeURIComponent(x.id)}.json`, { timeout: 8000 }));
        const info = (det.info || []).find((i) => /^de/i.test(i.language || "de")) || det.info?.[0] || {};
        x.text = String(info.description || "").replace(/<[^>]+>/g, " ");
        x.tipp = String(info.instruction || "").replace(/<[^>]+>/g, " ");
      } catch { /* ohne Details */ }
    }));
    const kreis = ort.kreisName || ort.name;
    const text = !w.length
      ? `Für ${kreis} gibt es gerade keine amtliche Warnung.`
      : `${w.length} ${w.length === 1 ? "Warnung" : "Warnungen"} für ${kreis}. ${w[0].stufe === "Hinweis" ? "" : `Stufe ${w[0].stufe}: `}${w[0].titel}.${w[0].tipp ? ` ${kuerzen(w[0].tipp.split(/(?<=\.)\s/)[0], 200)}` : ""}`;
    return {
      text, ort: kreis,
      zeilen: w.map((x) => ({ titel: x.titel, wert: x.stufe, farbe: x.farbe, unter: kuerzen([x.anbieter, x.zeit ? zeit(x.zeit) : "", x.tipp || x.text].filter(Boolean).join(" · "), 300), link: "https://warnung.bund.de/meldungen" })),
    };
  },
};

// ---------- Pollenflug-Gefahrenindex (DWD) ----------
const POLLEN = { Hasel: "Hasel", Erle: "Erle", Esche: "Esche", Birke: "Birke", Graeser: "Gräser", Roggen: "Roggen", Beifuss: "Beifuß", Ambrosia: "Ambrosia" };
const PSTUFE = { "0": ["keine", 0], "0-1": ["keine bis gering", 0.5], "1": ["gering", 1], "1-2": ["gering bis mittel", 1.5], "2": ["mittel", 2], "2-3": ["mittel bis hoch", 2.5], "3": ["hoch", 3] };
const pfarbe = (r) => (r >= 2.5 ? "#ff4a3a" : r >= 1.5 ? "#ff9a2a" : r >= 0.5 ? "#ffe14d" : "#3ddc84");
const pollenDwd = {
  id: "pollen_dwd", titel: "Pollenflug (DWD)", icon: "🌼", gruppe: "Deutschland",
  info: "Offizieller Pollenflug-Index für heute, morgen und übermorgen in deiner Region.",
  quelle: "Deutscher Wetterdienst", link: "https://www.dwd.de/pollenflug",
  eingabe: { platzhalter: "Ort oder Bundesland (leer = dein Ort)" },
  sprache: [
    /^(?:wie (?:wird|ist) (?:der )?)?(?:pollenflug|pollen|pollenbelastung)(?:-?vorhersage)? (?:morgen|übermorgen|uebermorgen|vorhersage|dwd|diese woche)(?: (?:in|für|fuer) (.+))?$/,
    /^(?:dwd-?)?pollen-?(?:vorhersage|flugvorhersage|index)(?: (?:in|für|fuer) (.+))?$/,
  ],
  async laden(q) {
    let land = landSchluessel(q);
    if (!land) land = (await deOrt(ortOder(q))).land;
    const landName = LAENDER[land]?.[1] || "";
    const d = await gemerkt("pollen_dwd", 60 * 60 * 1000, () => holen("https://opendata.dwd.de/climate_environment/health/alerts/s31fg.json"));
    const regionen = d.content || [];
    const r = regionen.find((x) => String(x.region_name).includes(landName)) || regionen.find((x) => String(x.partregion_name).includes(landName))
      || regionen.find((x) => landName === "Hamburg" && /Schleswig/.test(x.region_name)) || regionen.find((x) => landName === "Berlin" && /Brandenburg/.test(x.region_name))
      || regionen.find((x) => landName === "Bremen" && /Niedersachsen/.test(x.region_name)) || regionen.find((x) => landName === "Saarland" && /Rheinland/.test(x.region_name));
    if (!r) return { text: `Für ${landName || q} hat der DWD keinen Pollenflug-Index.`, zeilen: [] };
    const werte = Object.entries(POLLEN).map(([k, n]) => {
      const p = r.Pollen?.[k] || {};
      const st = (v) => PSTUFE[String(v)] || ["keine Angabe", -1];
      return { n, heute: st(p.today), morgen: st(p.tomorrow), ueber: st(p.dayafter_to) };
    });
    const aktiv = werte.filter((w) => w.heute[1] >= 1).sort((a, b) => b.heute[1] - a.heute[1]);
    const morgen = werte.filter((w) => w.morgen[1] >= 1).sort((a, b) => b.morgen[1] - a.morgen[1]);
    const gebiet = r.partregion_name && r.partregion_id !== -1 ? `${r.region_name} (${r.partregion_name})` : r.region_name;
    const text = (aktiv.length ? `Pollenflug heute in ${gebiet}: ${aktiv.slice(0, 3).map((w) => `${w.n} ${w.heute[0]}`).join(", ")}.` : `Heute fliegen in ${gebiet} kaum Pollen.`)
      + (morgen.length ? ` Morgen: ${morgen.slice(0, 3).map((w) => `${w.n} ${w.morgen[0]}`).join(", ")}.` : " Morgen bleibt es ruhig.");
    return {
      text,
      zeilen: werte.map((w) => ({ titel: w.n, wert: w.heute[0], farbe: pfarbe(w.heute[1]), unter: `Morgen: ${w.morgen[0]} · Übermorgen: ${w.ueber[0]}` })),
      stand: d.last_update,
    };
  },
};

// ---------- Schulferien (OpenHolidays API) ----------
const FERIEN_ART = /\b(oster|sommer|herbst|winter|weihnachts|pfingst|faschings)ferien\b/i;
/** "wann sind die sommerferien in bayern" → ["Sommerferien", "bayern"]; "Bayern" → ["", "Bayern"]. */
function ferienTeile(text) {
  const t = String(text || "").trim();
  const a = t.match(FERIEN_ART);
  const art = a ? `${a[1][0].toUpperCase()}${a[1].slice(1).toLowerCase()}ferien` : "";
  const ort = t.match(/\b(?:in|für|fuer)\s+(.+?)(?:\s+los)?$/i)?.[1]
    || t.replace(FERIEN_ART, " ").replace(/\b(?:wann|sind|die|nächsten|naechsten|schulferien|ferien|beginnen|kommen|fangen|an|los|zeig|mir)\b/gi, " ").replace(/\s+/g, " ");
  return [art, ort.trim()];
}
const schulferien = {
  id: "schulferien", titel: "Schulferien", icon: "🎒", gruppe: "Deutschland",
  info: "Die nächsten Schulferien in deinem Bundesland (auch andere Länder wählbar).",
  quelle: "OpenHolidays API", link: "https://www.openholidaysapi.org",
  eingabe: { platzhalter: "Bundesland oder Ort (leer = dein Ort)" },
  sprache: [
    /^(?:wann (?:sind|beginnen|kommen|fangen) (?:die )?(?:nächsten |naechsten )?)?(?:schul)?ferien(?: an)?(?: (?:in|für|fuer) (.+?))?(?: los)?$/,
    /^(?:wann sind|wann beginnen|wann kommen|zeig mir) (?:die )?(?:nächsten |naechsten )?(?:schul)?(?:ferien|osterferien|sommerferien|herbstferien|winterferien|weihnachtsferien|pfingstferien|faschingsferien)(?: (?:in|für|fuer) (.+?))?$/,
  ],
  // Sprache: ganze Frage, damit „Sommerferien in Bayern“ die Sommerferien zeigt.
  ganzeFrage: true,
  kurz: (k) => ferienTeile(k).filter(Boolean).join(" "),
  async laden(eingabe) {
    const [art, ortTeil] = ferienTeile(eingabe);
    const q = ortTeil;
    let land = landSchluessel(q);
    if (!land) land = (await deOrt(ortOder(q))).land;
    const [kurz, name] = LAENDER[land] || [];
    if (!kurz) return { text: "Das Bundesland habe ich nicht erkannt.", zeilen: [] };
    const von = heute().iso;
    const bis = heute(500).iso;
    const liste = await gemerkt(`ferien:${kurz}`, 12 * 3600 * 1000, () => holen(`https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&subdivisionCode=DE-${kurz}&languageIsoCode=DE&validFrom=${von}&validTo=${bis}`, { headers: { Accept: "application/json" } }));
    const alle = (Array.isArray(liste) ? liste : []).map((x) => ({ name: (x.name || []).find((n) => n.language === "DE")?.text || x.name?.[0]?.text || "Ferien", von: x.startDate, bis: x.endDate }))
      .filter((x) => x.bis >= von).sort((a, b) => a.von.localeCompare(b.von));
    // Bestimmte Ferien gewünscht (z. B. Sommerferien) → diese zuerst.
    const passend = art ? alle.filter((x) => x.name.toLowerCase().startsWith(art.slice(0, 4).toLowerCase())) : [];
    const f = passend.length ? [...passend, ...alle.filter((x) => !passend.includes(x))] : alle;
    if (!f.length) return { text: `Für ${name} habe ich keine kommenden Schulferien gefunden.`, zeilen: [] };
    const jetzt = f[0].von <= von;
    const tage = Math.round((new Date(f[0].von) - new Date(von)) / 864e5);
    const text = jetzt
      ? `In ${name} sind gerade ${f[0].name}, bis ${datum(f[0].bis, false)}.${f[1] ? ` Danach kommen die ${f[1].name} ab ${datum(f[1].von)}.` : ""}`
      : passend.length ? `Die ${f[0].name} in ${name} sind vom ${datum(f[0].von, false)} bis ${datum(f[0].bis)}, also in ${tage} ${tage === 1 ? "Tag" : "Tagen"}.` : `Die nächsten Ferien in ${name}: ${f[0].name} vom ${datum(f[0].von, false)} bis ${datum(f[0].bis)}, also in ${tage} ${tage === 1 ? "Tag" : "Tagen"}.`;
    return { text, zeilen: f.slice(0, 10).map((x, i) => ({ titel: x.name, wert: `${datum(x.von, false)} – ${datum(x.bis)}`, farbe: i === 0 && jetzt ? "#3ddc84" : "#ff9a2a", unter: name })) };
  },
};

// ---------- Strom: Mix & Börsenpreis (Energy-Charts, Fraunhofer ISE) ----------
const ART_DE = {
  "Wind onshore": ["Wind an Land", 1], "Wind offshore": ["Wind auf See", 1], Solar: ["Sonne", 1], Biomass: ["Biomasse", 1], "Hydro Run-of-River": ["Wasserkraft", 1],
  "Hydro water reservoir": ["Speicherwasser", 1], Geothermal: ["Erdwärme", 1], "Fossil brown coal / lignite": ["Braunkohle", 0], "Fossil hard coal": ["Steinkohle", 0],
  "Fossil gas": ["Erdgas", 0], "Fossil oil": ["Öl", 0], "Fossil coal-derived gas": ["Kohlegas", 0], Nuclear: ["Kernkraft", 0], "Hydro pumped storage": ["Pumpspeicher", 0], Waste: ["Müll", 0], Others: ["Sonstige", 0],
};
const strom = {
  id: "strom", titel: "Strom: Mix & Börsenpreis", icon: "⚡", gruppe: "Deutschland",
  info: "Woher der Strom gerade kommt, wie viel Ökostrom, und was die Kilowattstunde an der Börse kostet.",
  quelle: "Energy-Charts (Fraunhofer ISE)", link: "https://www.energy-charts.info",
  eingabe: null,
  sprache: [
    /^(?:wie (?:viel|hoch) (?:ist )?(?:der )?)?(?:strommix|ökostrom(?:-?anteil)?|oekostrom(?:-?anteil)?|strompreis|börsenstrompreis|boersenstrompreis|strom ?börse|stromboerse)(?: gerade| jetzt| heute| aktuell)?$/,
    /^(?:wie viel|wieviel) (?:ökostrom|oekostrom|wind ?strom|solar ?strom) (?:gibt es|haben wir|kommt)(?: gerade| jetzt| heute)?$/,
    /^woher kommt (?:gerade |jetzt )?(?:der |unser )?strom$/,
    /^(?:wann ist )?(?:der )?strom (?:heute )?am (?:billigsten|günstigsten|guenstigsten)$/,
  ],
  async laden() {
    const [mix, preis] = await Promise.all([
      gemerkt("strom:mix", 10 * 60 * 1000, () => holen("https://api.energy-charts.info/public_power?country=de", { timeout: 15000 })),
      gemerkt("strom:preis", 30 * 60 * 1000, () => holen("https://api.energy-charts.info/price?bzn=DE-LU", { timeout: 15000 })).catch(() => null),
    ]);
    const typen = mix.production_types || [];
    const last = typen.find((t) => t.name === "Load");
    let i = (last?.data || typen[0]?.data || []).length - 1;
    while (i > 0 && !typen.some((t) => ART_DE[t.name] && Number(t.data?.[i]) > 0)) i--;
    const teile = typen.filter((t) => ART_DE[t.name]).map((t) => ({ name: ART_DE[t.name][0], oeko: ART_DE[t.name][1], mw: Math.max(0, Number(t.data?.[i]) || 0) })).filter((t) => t.mw > 0).sort((a, b) => b.mw - a.mw);
    const summe = teile.reduce((s, t) => s + t.mw, 0) || 1;
    const oeko = teile.filter((t) => t.oeko).reduce((s, t) => s + t.mw, 0);
    const anteil = Math.round((oeko / summe) * 100);
    const stand = mix.unix_seconds?.[i] ? new Date(mix.unix_seconds[i] * 1000) : null;
    let preisText = "";
    const zeilenPreis = [];
    if (preis?.price?.length) {
      const jetzt = Date.now() / 1000;
      let j = preis.unix_seconds.findIndex((s, k) => s <= jetzt && (preis.unix_seconds[k + 1] ?? Infinity) > jetzt);
      if (j < 0) j = preis.price.length - 1;
      const ct = (v) => Number(v) / 10; // €/MWh → ct/kWh
      const heuteIso = heute().iso;
      const tag = preis.unix_seconds.map((s, k) => ({ s, p: preis.price[k] })).filter((x) => x.p != null && new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone }).format(new Date(x.s * 1000)) === heuteIso);
      const min = tag.reduce((a, b) => (b.p < a.p ? b : a), tag[0] || { p: preis.price[j], s: preis.unix_seconds[j] });
      const max = tag.reduce((a, b) => (b.p > a.p ? b : a), tag[0] || { p: preis.price[j], s: preis.unix_seconds[j] });
      const uhr = (s) => new Date(s * 1000).toLocaleTimeString("de-DE", { timeZone: config.timezone, hour: "2-digit", minute: "2-digit" });
      preisText = ` An der Strombörse kostet die Kilowattstunde gerade ${de(ct(preis.price[j]), 1)} Cent (ohne Steuern und Netz), am günstigsten heute um ${uhr(min.s)} Uhr mit ${de(ct(min.p), 1)} Cent.`;
      zeilenPreis.push({ titel: "💶 Börsenpreis jetzt", wert: `${de(ct(preis.price[j]), 1)} ct/kWh`, farbe: ct(preis.price[j]) < 5 ? "#3ddc84" : ct(preis.price[j]) < 12 ? "#ffe14d" : "#ff4a3a", unter: "Day-Ahead DE-LU, ohne Steuern, Umlagen und Netzentgelt" });
      zeilenPreis.push({ titel: "⬇ Am günstigsten heute", wert: `${uhr(min.s)} Uhr`, unter: `${de(ct(min.p), 1)} ct/kWh`, farbe: "#3ddc84" });
      zeilenPreis.push({ titel: "⬆ Am teuersten heute", wert: `${uhr(max.s)} Uhr`, unter: `${de(ct(max.p), 1)} ct/kWh`, farbe: "#ff4a3a" });
    }
    const text = `Gerade kommen ${anteil} Prozent des Stroms in Deutschland aus erneuerbaren Quellen, vor allem ${teile.filter((t) => t.oeko).slice(0, 2).map((t) => t.name).join(" und ") || "Wasser und Biomasse"}.${preisText}`;
    return {
      text, stand,
      zeilen: [
        { titel: "🌱 Ökostrom-Anteil", wert: `${anteil} %`, farbe: anteil >= 60 ? "#3ddc84" : anteil >= 40 ? "#ffe14d" : "#ff9a2a", unter: `Erzeugung ${de(summe / 1000, 1)} GW${stand ? ` · Stand ${zeit(stand)}` : ""}`, balken: anteil },
        ...zeilenPreis,
        ...teile.map((t) => ({ titel: t.name, wert: `${de(t.mw / 1000, 1)} GW`, unter: `${Math.round((t.mw / summe) * 100)} %`, farbe: t.oeko ? "#3ddc84" : "#9aa0a6", balken: Math.round((t.mw / summe) * 100) })),
      ],
    };
  },
};

// ---------- Postleitzahlen (OpenPLZ API) ----------
const plz = {
  id: "plz", titel: "Postleitzahlen & Orte", icon: "📮", gruppe: "Deutschland",
  info: "PLZ zu einem Ort oder Ort zu einer PLZ, mit Kreis und Bundesland.",
  quelle: "OpenPLZ API", link: "https://www.openplzapi.org",
  eingabe: { platzhalter: "Ort oder PLZ, z. B. Potsdam oder 80331", pflicht: true },
  sprache: [
    /^(?:welche |was ist die |wie ist die |wie lautet die )?(?:postleitzahl|plz)(?: hat| von| für| fuer| in)? (.+?)(?: hat)?$/,
    /^(?:welcher ort hat (?:die )?(?:postleitzahl |plz )?|wo ist (?:die )?(?:postleitzahl |plz )|wo liegt (?:die )?(?:postleitzahl |plz )?)(\d{5})$/,
  ],
  async laden(q) {
    if (!String(q || "").trim()) return { text: "Welcher Ort oder welche Postleitzahl?", zeilen: [], frage: true };
    const o = await deOrt(q);
    const istPlz = /^\d{5}$/.test(String(q).trim());
    const text = istPlz
      ? `Die Postleitzahl ${q.trim()} gehört zu ${o.name}${o.kreisName && o.kreisName !== o.name ? ` im ${o.kreisName}` : ""}, ${o.landName}.`
      : o.plzListe.length > 1 ? `${o.name} hat mehrere Postleitzahlen, zum Beispiel ${o.plzListe.slice(0, 3).join(", ")}. Der Ort liegt in ${o.landName}.` : `${o.name} hat die Postleitzahl ${o.plz} und liegt in ${o.landName}.`;
    return {
      text,
      zeilen: [
        { titel: "Ort", wert: o.name, unter: o.gemeindeName !== o.name ? `Gemeinde ${o.gemeindeName}` : "" },
        { titel: "Postleitzahl", wert: istPlz ? q.trim() : o.plzListe.slice(0, 6).join(", ") + (o.plzListe.length > 6 ? " …" : "") },
        { titel: "Kreis", wert: o.kreisName || "–" },
        { titel: "Bundesland", wert: o.landName },
        { titel: "Gemeindeschlüssel", wert: o.gemeinde || "–", unter: "amtlicher Schlüssel (AGS)" },
      ],
    };
  },
};

// ---------- Jobsuche (Bundesagentur für Arbeit) ----------
const jobs = {
  id: "jobs", titel: "Jobsuche", icon: "💼", gruppe: "Deutschland",
  info: "Offene Stellen aus der Jobbörse der Bundesagentur für Arbeit.",
  quelle: "Bundesagentur für Arbeit (Jobbörse)", link: "https://www.arbeitsagentur.de/jobsuche",
  eingabe: { platzhalter: "Beruf und Ort, z. B. Elektriker in Hamburg", pflicht: true },
  sprache: [
    /^(?:such(?:e)? (?:mir )?|finde (?:mir )?|zeig mir )?(?:jobs?|stellen|stellenangebote|arbeit|eine stelle|einen job) (?:als |für |fuer )(.+)$/,
    /^(?:gibt es |welche )?(?:offene )?(?:jobs?|stellen|stellenangebote) (?:in|bei) (.+)$/,
  ],
  async laden(q) {
    const t = String(q || "").trim();
    if (!t) return { text: "Welchen Beruf soll ich suchen, und wo?", zeilen: [], frage: true };
    const [, was = t, wo = ""] = t.match(/^(.*?)(?:\s+(?:in|bei|um|nahe)\s+(.+))?$/) || [];
    const ort = wo || config.city;
    const url = `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs?was=${encodeURIComponent(was)}&wo=${encodeURIComponent(ort)}&umkreis=25&size=20&page=1`;
    const d = await gemerkt(`jobs:${was}:${ort}`.toLowerCase(), 30 * 60 * 1000, () => holen(url, { headers: { "X-API-Key": "jobboerse-jobsuche", Accept: "application/json" }, timeout: 15000 }));
    const st = d.stellenangebote || [];
    const anzahl = Number(d.maxErgebnisse) || st.length;
    const text = !st.length ? `Ich finde gerade keine Stellen für ${was} bei ${ort}.` : `Ich habe ${de(anzahl)} offene Stellen für ${was} im Umkreis von ${ort} gefunden. Zum Beispiel ${st[0].titel} bei ${st[0].arbeitgeber}.`;
    return {
      text,
      zeilen: st.map((s) => ({
        titel: s.titel || s.beruf, wert: s.arbeitsort?.ort || "", farbe: "#ff9a2a",
        unter: [s.arbeitgeber, s.aktuelleVeroeffentlichungsdatum ? `seit ${datum(s.aktuelleVeroeffentlichungsdatum)}` : ""].filter(Boolean).join(" · "),
        link: s.externeUrl || (s.refnr ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(s.refnr)}` : "https://www.arbeitsagentur.de/jobsuche"),
      })),
    };
  },
};

// ---------- Radioaktivität (Bundesamt für Strahlenschutz, ODL-Messnetz) ----------
const strahlung = {
  id: "strahlung", titel: "Strahlung (ODL)", icon: "☢️", gruppe: "Deutschland",
  info: "Natürliche Umgebungsstrahlung an der nächsten Messstelle des Bundes.",
  quelle: "Bundesamt für Strahlenschutz (BfS)", link: "https://odlinfo.bfs.de",
  eingabe: { platzhalter: "Ort (leer = dein Ort)" },
  sprache: [
    /^(?:wie (?:hoch|stark) ist (?:die )?)?(?:strahlung|radioaktivität|radioaktivitaet|strahlenbelastung|odl)(?: (?:in|bei|für|fuer) (.+?))?(?: gerade| heute| aktuell)?$/,
  ],
  async laden(q) {
    const bei = await ortZuKoordinaten(ortOder(q));
    const d = await gemerkt("odl", 30 * 60 * 1000, () => holen("https://www.imis.bfs.de/ogc/opendata/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=opendata:odlinfo_odl_1h_latest&outputFormat=application/json", { timeout: 20000 }));
    const st = (d.features || []).map((f) => {
      const p = f.properties || {};
      const [lon, lat] = f.geometry?.coordinates || [];
      return { name: p.locality_name || p.name || p.kenn, wert: Number(p.value), einheit: p.unit || "µSv/h", zeit: p.end_measure, lat, lon, km: Number.isFinite(lat) ? km(bei, { lat, lon }) : Infinity };
    }).filter((s) => Number.isFinite(s.wert) && s.wert >= 0).sort((a, b) => a.km - b.km).slice(0, 8);
    if (!st.length) return { text: "Das Messnetz meldet gerade keine Werte.", zeilen: [] };
    const s = st[0];
    const bewert = s.wert < 0.2 ? "normal" : s.wert < 0.3 ? "leicht erhöht, meist wegen Regen" : "erhöht";
    return {
      text: `An der Messstelle ${s.name}, ${de(s.km)} Kilometer von ${bei.name}, liegt die Strahlung bei ${de(s.wert, 3)} Mikrosievert pro Stunde. Das ist ${bewert}.`,
      zeilen: st.map((x) => ({ titel: x.name, wert: `${de(x.wert, 3)} ${x.einheit}`, farbe: x.wert < 0.2 ? "#3ddc84" : x.wert < 0.3 ? "#ffe14d" : "#ff4a3a", unter: `${de(x.km)} km entfernt · ${zeit(x.zeit)}` })),
      punkte: st.map((x) => ({ lat: x.lat, lon: x.lon, name: x.name })),
    };
  },
};

export const QUELLEN = [nina, pollenDwd, schulferien, strom, plz, jobs, strahlung];
