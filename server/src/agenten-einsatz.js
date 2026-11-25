// Agenten-Einsätze (v1.165.0): Agenten, die wirklich etwas tun.
// Jeder Einsatz holt echte, öffentliche Daten (ohne Schlüssel), wertet sie aus und liefert einen fertigen
// Bericht zum Vorlesen. Während ein Agent arbeitet, sieht man ihn im 3D-Büro arbeiten; jeder Einsatz
// landet im Logbuch. Kein Einsatz bewegt Geld oder beobachtet Personen – nur öffentliche Quellen.
import path from "node:path";
import fs from "node:fs";
import { config, DATA_DIR } from "./config.js";
import { eintragen as logbuchEintrag } from "./logbuch.js";
import { setzeAuftrag, auftragFertig } from "./auftrag.js";

const BERICHTE = path.join(DATA_DIR, "agenten-berichte.json");
const UA = { "User-Agent": "Friday-Assistent/1.0 (privater Sprachassistent)" };
const MAX_MS = 20000;

// ---------- kleine Helfer ----------
async function holeJson(url, ms = 12000, kopf = {}) {
  const r = await fetch(url, { headers: { ...UA, Accept: "application/json", ...kopf }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${new URL(url).host} antwortet mit ${r.status}`);
  return r.json();
}
const zahlDe = (x, n = 1) => (Number.isFinite(x) ? x.toLocaleString("de-DE", { minimumFractionDigits: n, maximumFractionDigits: n }) : "?");
const uhr = (d) => new Date(d).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: config.timezone });
const datumKurz = (d) => new Date(d).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: config.timezone });
const flach = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
function entfernungKm(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Öffentliche Module aus dem Daten-Ausbau (oeffentlich.js), falls vorhanden – sonst eigene Abrufe.
let oeffentlichModul;
async function oeffentlich(id, eingabe) {
  if (oeffentlichModul === undefined) oeffentlichModul = await import("./oeffentlich.js").catch(() => null);
  if (!oeffentlichModul?.abrufen) return null;
  try {
    const r = await oeffentlichModul.abrufen(id, eingabe);
    return r && r.ok && r.text ? r : null;
  } catch { return null; }
}

// Heimatort (Stadt aus Einstellungen/.env) mit Koordinaten und Bundesland.
const ortCache = new Map();
const LAENDER = {
  "baden-wurttemberg": "BW", bayern: "BY", berlin: "BE", brandenburg: "BB", bremen: "HB", hamburg: "HH", hessen: "HE",
  "mecklenburg-vorpommern": "MV", niedersachsen: "NI", "nordrhein-westfalen": "NW", "rheinland-pfalz": "RP", saarland: "SL",
  sachsen: "SN", "sachsen-anhalt": "ST", "schleswig-holstein": "SH", thuringen: "TH",
};
export async function heimOrt(name = config.city) {
  const n = String(name || "Berlin").trim();
  const k = flach(n);
  if (ortCache.has(k)) return ortCache.get(k);
  const d = await holeJson(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=${encodeURIComponent(n)}`);
  const p = d?.results?.[0];
  if (!p) throw new Error(`Ort „${n}“ nicht gefunden`);
  const land = flach(p.admin1 || "");
  const ort = { name: p.name, lat: p.latitude, lon: p.longitude, bundesland: p.admin1 || "", code: p.country_code === "DE" ? LAENDER[land] || "" : "", landCode: p.country_code || "" };
  ortCache.set(k, ort);
  return ort;
}

// ---------- Die Einsätze ----------
// lauf(eingabe, h) → { titel, text, punkte?, quelle, link? }   (text = fertiger Satz zum Vorlesen)

// Strompreis: günstigste Stunden an der Strombörse (aWATTar, Day-Ahead Deutschland).
async function strom() {
  const d = await holeJson(`https://api.awattar.de/v1/marketdata?start=${Date.now() - 3600000}`).catch(() => ({ data: [] }));
  const slots = (d.data || []).map((s) => ({ von: s.start_timestamp, bis: s.end_timestamp, ct: s.marketprice / 10 })).filter((s) => s.bis > Date.now());
  if (!slots.length) {
    const o = await oeffentlich("strom");
    if (o) return { titel: o.titel || "Strompreis", text: o.text, punkte: o.zeilen || [], quelle: o.quelle };
    throw new Error("Keine Börsenpreise gefunden");
  }
  const jetzt = slots[0];
  // günstigstes 3-Stunden-Fenster (egal ob Stunden- oder Viertelstunden-Raster)
  let best = null;
  for (let i = 0; i < slots.length; i++) {
    const ende = slots[i].von + 3 * 3600000;
    const teil = [];
    for (let j = i; j < slots.length && slots[j].von < ende; j++) teil.push(slots[j]);
    if (teil.at(-1).bis < ende) break;
    const mittel = teil.reduce((s, x) => s + x.ct * (x.bis - x.von), 0) / (3 * 3600000);
    if (!best || mittel < best.mittel) best = { von: slots[i].von, bis: ende, mittel };
  }
  const teuer = slots.reduce((a, b) => (b.ct > a.ct ? b : a));
  const billig = slots.reduce((a, b) => (b.ct < a.ct ? b : a));
  const punkte = [
    `Jetzt: ${zahlDe(jetzt.ct)} ct/kWh (Börse, ohne Steuern und Netz)`,
    best ? `Bestes 3-Stunden-Fenster: ${datumKurz(best.von)} ${uhr(best.von)}–${uhr(best.bis)} (Ø ${zahlDe(best.mittel)} ct)` : "",
    `Billigster Moment: ${datumKurz(billig.von)} ${uhr(billig.von)} (${zahlDe(billig.ct)} ct)`,
    `Teuerster Moment: ${datumKurz(teuer.von)} ${uhr(teuer.von)} (${zahlDe(teuer.ct)} ct)`,
  ].filter(Boolean);
  const text = best
    ? `Der Börsenstrom kostet gerade ${zahlDe(jetzt.ct)} Cent. Am günstigsten wird es ${datumKurz(best.von)} von ${uhr(best.von)} bis ${uhr(best.bis)} Uhr – gut für Waschmaschine, Trockner oder das Laden vom Auto.`
    : `Der Börsenstrom kostet gerade ${zahlDe(jetzt.ct)} Cent pro Kilowattstunde.`;
  return { titel: "Strompreis-Fenster", text, punkte, quelle: "aWATTar (Strombörse EPEX, Deutschland)", link: "https://www.awattar.de" };
}

// Pollenflug (Deutscher Wetterdienst) für das Bundesland des Heimatorts.
const POLLEN_STUFE = { "-1": null, 0: 0, "0-1": 0.5, 1: 1, "1-2": 1.5, 2: 2, "2-3": 2.5, 3: 3 };
const STUFE_TEXT = (v) => (v >= 2.5 ? "stark" : v >= 1.5 ? "mittel" : v >= 0.5 ? "schwach" : "keine");
const POLLEN_NAME = { Graeser: "Gräser", Beifuss: "Beifuß" };
async function pollen() {
  const o = await oeffentlich("pollen_dwd");
  if (o) return { titel: o.titel || "Pollenflug", text: o.text, punkte: o.zeilen || [], quelle: o.quelle || "Deutscher Wetterdienst" };
  const [ort, d] = await Promise.all([heimOrt(), holeJson("https://opendata.dwd.de/climate_environment/health/alerts/s31fg.json")]);
  const land = flach(ort.bundesland);
  const region = (d.content || []).filter((c) => land && flach(c.region_name).includes(land));
  const quelle = region.length ? region : (d.content || []).slice(0, 1);
  if (!quelle.length) throw new Error("Keine Pollendaten");
  const werte = {};
  for (const r of quelle) {
    for (const [art, v] of Object.entries(r.Pollen || {})) {
      const heute = POLLEN_STUFE[v.today] ?? null, morgen = POLLEN_STUFE[v.tomorrow] ?? null;
      const alt = werte[art] || { heute: 0, morgen: 0 };
      werte[art] = { heute: Math.max(alt.heute, heute ?? 0), morgen: Math.max(alt.morgen, morgen ?? 0) };
    }
  }
  const liste = Object.entries(werte).map(([art, w]) => ({ art: POLLEN_NAME[art] || art, ...w })).sort((a, b) => b.heute - a.heute || b.morgen - a.morgen);
  const aktiv = liste.filter((x) => x.heute >= 0.5 || x.morgen >= 0.5);
  const regionName = quelle[0].region_name || ort.bundesland;
  const text = aktiv.length
    ? `Pollenflug in ${regionName}: ${aktiv.slice(0, 3).map((x) => `${x.art} ${STUFE_TEXT(x.heute)}`).join(", ")}. Morgen am stärksten: ${aktiv.slice().sort((a, b) => b.morgen - a.morgen)[0].art}.`
    : `In ${regionName} fliegen heute und morgen praktisch keine Pollen. Durchatmen!`;
  return { titel: "Pollenflug", text, punkte: liste.map((x) => `${x.art}: heute ${STUFE_TEXT(x.heute)}, morgen ${STUFE_TEXT(x.morgen)}`), quelle: "Deutscher Wetterdienst (Pollenflug-Gefahrenindex)" };
}

// Wasserstände an Flüssen in der Nähe (Pegelonline, Wasserstraßen- und Schifffahrtsverwaltung).
async function pegel(eingabe) {
  const o = await oeffentlich("pegel", eingabe || config.city);
  if (o) return { titel: o.titel || "Wasserstände", text: o.text, punkte: o.zeilen || [], quelle: o.quelle || "Pegelonline (WSV)", link: o.link };
  const ort = await heimOrt(eingabe || config.city);
  const d = await holeJson(`https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json?latitude=${ort.lat}&longitude=${ort.lon}&radius=40&includeTimeseries=true&includeCurrentMeasurement=true`);
  const st = (Array.isArray(d) ? d : []).map((s) => {
    const w = (s.timeseries || []).find((t) => t.shortname === "W" && t.currentMeasurement);
    if (!w) return null;
    return { name: s.longname || s.shortname, fluss: s.water?.longname || "", cm: w.currentMeasurement.value, zustand: w.currentMeasurement.stateMnwMhw || "", dist: entfernungKm(ort, { lat: s.latitude, lon: s.longitude }) };
  }).filter(Boolean).sort((a, b) => a.dist - b.dist).slice(0, 4);
  if (!st.length) return { titel: "Wasserstände", text: `In 40 Kilometern um ${ort.name} gibt es keinen Pegel an einer Bundeswasserstraße.`, punkte: [], quelle: "Pegelonline (WSV)" };
  const ZT = { low: "niedrig", normal: "normal", high: "hoch", unknown: "" };
  const p = st[0];
  const text = `Am Pegel ${p.name}${p.fluss ? ` (${p.fluss[0] + p.fluss.slice(1).toLowerCase()})` : ""} stehen gerade ${Math.round(p.cm)} Zentimeter${ZT[p.zustand] ? ` – das ist ${ZT[p.zustand]}` : ""}.`;
  return { titel: "Wasserstände", text, punkte: st.map((s) => `${s.name}: ${Math.round(s.cm)} cm${ZT[s.zustand] ? ` (${ZT[s.zustand]})` : ""} · ${Math.round(s.dist)} km`), quelle: "Pegelonline (Wasserstraßen- und Schifffahrtsverwaltung des Bundes)", link: "https://www.pegelonline.wsv.de" };
}

// Staus, Sperrungen und Baustellen auf einer Autobahn (Autobahn GmbH des Bundes).
async function verkehr(eingabe) {
  const m = String(eingabe || "").match(/a\s*-?\s*(\d{1,3})/i);
  const strasse = m ? `A${m[1]}` : "A100";
  const o = await oeffentlich("autobahn", strasse);
  if (o) return { titel: `Verkehr ${strasse}`, text: o.text, punkte: o.zeilen || [], quelle: o.quelle || "Autobahn GmbH des Bundes" };
  const basis = `https://verkehr.autobahn.de/o/autobahn/${strasse}/services`;
  const [warn, zu, bau] = await Promise.all([
    holeJson(`${basis}/warning`).catch(() => null),
    holeJson(`${basis}/closure`).catch(() => null),
    holeJson(`${basis}/roadworks`).catch(() => null),
  ]);
  if (!warn && !zu && !bau) throw new Error(`Keine Daten für die ${strasse}`);
  const w = warn?.warning || [], c = zu?.closure || [], r = bau?.roadworks || [];
  const zeile = (x) => `${x.title || ""}${x.subtitle ? ` – ${x.subtitle}` : ""}`.trim();
  const punkte = [...w.slice(0, 4).map((x) => `⚠ ${zeile(x)}`), ...c.slice(0, 2).map((x) => `⛔ ${zeile(x)}`)];
  if (r.length) punkte.push(`🚧 ${r.length} Baustellen auf der ${strasse}`);
  const text = w.length
    ? `Auf der ${strasse} gibt es gerade ${w.length} Verkehrsmeldung${w.length === 1 ? "" : "en"}${c.length ? ` und ${c.length} Sperrung${c.length === 1 ? "" : "en"}` : ""}. Zuerst: ${zeile(w[0])}.`
    : `Auf der ${strasse} ist gerade kein Stau gemeldet${c.length ? `, aber es gibt ${c.length} Sperrung${c.length === 1 ? "" : "en"}` : ""}${r.length ? ` und ${r.length} Baustellen` : ""}.`;
  return { titel: `Verkehr ${strasse}`, text, punkte, quelle: "Autobahn GmbH des Bundes", link: "https://verkehr.autobahn.de" };
}

// Feiertage und Schulferien im eigenen Bundesland (OpenHolidays).
async function feiertage() {
  const ort = await heimOrt().catch(() => ({ code: "", bundesland: "" }));
  const heute = new Date();
  const bis = new Date(heute.getTime() + 330 * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  const sub = ort.code ? `&subdivisionCode=DE-${ort.code}` : "";
  const basis = `countryIsoCode=DE&languageIsoCode=DE&validFrom=${iso(heute)}&validTo=${iso(bis)}${sub}`;
  const [fei, fer] = await Promise.all([
    holeJson(`https://openholidaysapi.org/PublicHolidays?${basis}`).catch(() => []),
    ort.code ? holeJson(`https://openholidaysapi.org/SchoolHolidays?${basis}`).catch(() => []) : Promise.resolve([]),
  ]);
  const name = (x) => (x.name || []).find((n) => n.language === "DE")?.text || x.name?.[0]?.text || "";
  const tage = (d) => Math.round((new Date(`${d}T00:00:00`) - new Date(iso(heute) + "T00:00:00")) / 86400000);
  const f = (Array.isArray(fei) ? fei : []).filter((x) => tage(x.endDate) >= 0).slice(0, 4);
  const s = (Array.isArray(fer) ? fer : []).filter((x) => tage(x.endDate) >= 0).slice(0, 3);
  if (!f.length && !s.length) throw new Error("Keine Feiertage gefunden");
  const punkte = [
    ...f.map((x) => `🎉 ${name(x)}: ${datumKurz(x.startDate)} (in ${tage(x.startDate)} Tagen)`),
    ...s.map((x) => `🏖 ${name(x)}: ${datumKurz(x.startDate)} – ${datumKurz(x.endDate)}${tage(x.startDate) <= 0 ? " (läuft gerade)" : ""}`),
  ];
  const t1 = f[0] ? `Der nächste Feiertag${ort.bundesland ? ` in ${ort.bundesland}` : ""} ist ${name(f[0])} – ${tage(f[0].startDate) === 0 ? "heute" : `in ${tage(f[0].startDate)} Tagen`}.` : "";
  const t2 = s[0] ? (tage(s[0].startDate) <= 0 ? ` Gerade sind ${name(s[0])}.` : ` Die nächsten Schulferien sind ${name(s[0])} ab ${datumKurz(s[0].startDate)}.`) : "";
  return { titel: "Feiertage & Ferien", text: (t1 + t2).trim(), punkte, quelle: "OpenHolidays API", link: "https://www.openholidaysapi.org" };
}

// Top-Meldungen der Tagesschau.
async function nachrichten() {
  const d = await holeJson("https://www.tagesschau.de/api2u/homepage/");
  const news = (d.news || []).filter((n) => n.title && (n.type === "story" || !n.type)).slice(0, 5);
  if (!news.length) throw new Error("Keine Meldungen");
  const punkte = news.map((n) => `${n.topline ? `${n.topline}: ` : ""}${n.title}`);
  const text = `Die wichtigsten Meldungen: ${news.slice(0, 3).map((n) => n.title.replace(/[.!?]$/, "")).join(". ")}.`;
  return { titel: "Tagesschau – Top-Meldungen", text, punkte, quelle: "tagesschau.de", link: news[0].shareURL || "https://www.tagesschau.de" };
}

// Recherche-Dossier: Wikipedia-Zusammenfassung + verwandte Artikel → als Dokument gespeichert.
async function recherche(eingabe) {
  const thema = String(eingabe || "").trim();
  if (!thema) throw new Error("Welches Thema soll ich recherchieren?");
  const such = await holeJson(`https://de.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=5&srsearch=${encodeURIComponent(thema)}`);
  const treffer = such?.query?.search || [];
  if (!treffer.length) return { titel: `Recherche: ${thema}`, text: `Zu „${thema}“ habe ich in der Wikipedia nichts gefunden.`, punkte: [], quelle: "Wikipedia" };
  const haupt = await holeJson(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(treffer[0].title.replace(/ /g, "_"))}`).catch(() => null);
  const auszug = String(haupt?.extract || "").trim();
  const verwandt = treffer.slice(1).map((t) => t.title);
  const link = haupt?.content_urls?.desktop?.page || `https://de.wikipedia.org/wiki/${encodeURIComponent(treffer[0].title)}`;
  let dokId = null;
  try {
    const { dokumentErstellen } = await import("./dokumente.js");
    const doc = dokumentErstellen({ titel: `Dossier: ${treffer[0].title}`, inhalt: `# ${treffer[0].title}\n\n${auszug || "(keine Zusammenfassung)"}\n\n## Verwandte Themen\n${verwandt.map((v) => `- ${v}`).join("\n") || "- keine"}\n\nQuelle: ${link}` });
    dokId = doc?.id || null;
  } catch { /* Dokument ist Zugabe */ }
  const saetze = auszug.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  return { titel: `Recherche: ${treffer[0].title}`, text: saetze || `Ich habe den Artikel ${treffer[0].title} gefunden.`, punkte: [auszug.slice(0, 600), verwandt.length ? `Verwandt: ${verwandt.join(", ")}` : "", dokId ? "📄 Als Dossier unter Dokumente gespeichert" : ""].filter(Boolean), quelle: "Wikipedia (CC BY-SA)", link };
}

// Übersetzer (MyMemory, frei bis ca. 5000 Zeichen am Tag).
const SPRACHEN = { englisch: "en", english: "en", französisch: "fr", franzoesisch: "fr", spanisch: "es", italienisch: "it", türkisch: "tr", tuerkisch: "tr", polnisch: "pl", russisch: "ru", ukrainisch: "uk", niederländisch: "nl", portugiesisch: "pt", griechisch: "el", arabisch: "ar", chinesisch: "zh-CN", japanisch: "ja", kroatisch: "hr", deutsch: "de" };
async function uebersetzer(eingabe) {
  let t = String(eingabe || "").trim();
  if (!t) throw new Error("Was soll ich übersetzen? Zum Beispiel: „Englisch: Wo ist der Bahnhof?“");
  let ziel = "en";
  const m = t.match(/^(?:auf |ins |in )?([a-zäöüß]+)\s*[:,-]\s*(.+)$/i) || t.match(/^(.+?)\s+(?:auf|ins|in)\s+([a-zäöüß]+)$/i);
  if (m) {
    const [a, b] = SPRACHEN[m[1].toLowerCase()] ? [m[1], m[2]] : [m[2], m[1]];
    if (SPRACHEN[a.toLowerCase()]) { ziel = SPRACHEN[a.toLowerCase()]; t = b.trim(); }
  }
  const quelle = ziel === "de" ? "en" : "de";
  const d = await holeJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(t.slice(0, 450))}&langpair=${quelle}|${ziel}`);
  const out = String(d?.responseData?.translatedText || "").trim();
  if (!out || d.responseStatus >= 400) throw new Error(d?.responseDetails || "Übersetzung fehlgeschlagen");
  const sprache = Object.entries(SPRACHEN).find(([, c]) => c === ziel)?.[0] || ziel;
  return { titel: `Übersetzung (${sprache})`, text: out, punkte: [`Original: ${t}`, `${sprache[0].toUpperCase() + sprache.slice(1)}: ${out}`], quelle: "MyMemory (Translated)" };
}

// Koch-Agent: kocht aus dem, was im Kühlschrank bald abläuft.
async function koch() {
  const k = await import("./kuehlschrank.js");
  const bald = k.baldWeg(2);
  const rez = k.rezepte({ limit: 3 });
  if (!rez.length) {
    const v = k.vorrat();
    return { titel: "Koch-Ideen", text: v.length ? "Mit dem, was gerade im Kühlschrank ist, finde ich kein passendes Rezept. Trag noch ein paar Zutaten ein." : "Dein Kühlschrank in Friday ist leer. Scann einen Kassenbon oder trag ein, was du da hast – dann koche ich dir was.", punkte: [], quelle: "Fridays Kühlschrank" };
  }
  const r = rez[0];
  const text = `Mein Vorschlag: ${r.name}, dauert etwa ${r.minuten} Minuten${r.rettet?.length ? ` und rettet ${r.rettet.join(", ")}` : ""}.${r.fehlt?.length ? ` Dir fehlt nur noch ${r.fehlt.join(" und ")}.` : " Du hast alles da."}`;
  return {
    titel: "Koch-Ideen aus dem Kühlschrank", text,
    punkte: [...(bald.length ? [`Läuft bald ab: ${bald.map((x) => x.name).join(", ")}`] : []), ...rez.map((x) => `${x.emoji || "🍽"} ${x.name} · ${x.minuten} Min.${x.fehlt.length ? ` · fehlt: ${x.fehlt.join(", ")}` : ""}`)],
    quelle: "Fridays Kühlschrank",
  };
}

// Erdbeben-Wächter: stärkstes Beben weltweit + das nächste zum Heimatort (USGS, letzte 24 h).
async function erdbeben() {
  const [ort, d] = await Promise.all([heimOrt().catch(() => null), holeJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson")]);
  const liste = (d.features || []).map((f) => ({ mag: f.properties?.mag, ort: f.properties?.place || "", zeit: f.properties?.time, lat: f.geometry?.coordinates?.[1], lon: f.geometry?.coordinates?.[0] })).filter((x) => Number.isFinite(x.mag));
  if (!liste.length) return { titel: "Erdbeben", text: "In den letzten 24 Stunden gab es kein Beben über Stärke 2,5.", punkte: [], quelle: "USGS" };
  const stark = liste.slice().sort((a, b) => b.mag - a.mag);
  const nah = ort ? liste.map((x) => ({ ...x, km: entfernungKm(ort, x) })).filter((x) => x.km < 1500).sort((a, b) => a.km - b.km) : [];
  const text = `${liste.length} Beben in 24 Stunden. Das stärkste: Stärke ${zahlDe(stark[0].mag)} – ${stark[0].ort}.${nah.length ? ` Das nächste zu ${ort.name}: Stärke ${zahlDe(nah[0].mag)}, ${Math.round(nah[0].km)} Kilometer entfernt.` : ort ? ` Im Umkreis von 1500 Kilometern um ${ort.name} war es ruhig.` : ""}`;
  return { titel: "Erdbeben-Wächter", text, punkte: [...stark.slice(0, 4).map((x) => `M ${zahlDe(x.mag)} · ${x.ort} · ${uhr(x.zeit)}`), ...nah.slice(0, 2).map((x) => `📍 Nah: M ${zahlDe(x.mag)} · ${x.ort} · ${Math.round(x.km)} km`)], quelle: "U.S. Geological Survey", link: "https://earthquake.usgs.gov/earthquakes/map/" };
}

// Weltraum: nächste Raketenstarts, Weltraumwetter (Polarlicht-Chance), ISS.
async function weltraum() {
  const lb = await import("./lagebild.js");
  const [r, w] = await Promise.all([lb.getRaketen().catch(() => null), lb.getWeltraum().catch(() => null)]);
  const starts = (r?.starts || []).filter((s) => Date.parse(s.zeit) > Date.now() - 3600000).slice(0, 3);
  if (!starts.length && !w) throw new Error("Weltraumdaten nicht erreichbar");
  const s = starts[0];
  const kp = w?.kp;
  const polar = kp == null ? "" : kp >= 6 ? " Starker Sonnensturm – heute Nacht sind Polarlichter bis nach Mitteldeutschland möglich!" : kp >= 5 ? " Sonnensturm: Im Norden Deutschlands sind Polarlichter möglich." : ` Das Weltraumwetter ist ${w.kp_text}.`;
  const text = `${s ? `Nächster Raketenstart: ${s.name} am ${datumKurz(s.zeit)} um ${uhr(s.zeit)} Uhr${s.anbieter ? ` von ${s.anbieter}` : ""}.` : ""}${polar}`.trim();
  return {
    titel: "Weltraum-Lage", text,
    punkte: [...starts.map((x) => `🚀 ${x.name} · ${datumKurz(x.zeit)} ${uhr(x.zeit)}${x.ort ? ` · ${x.ort}` : ""}`), kp != null ? `🌌 Kp-Index ${zahlDe(kp)} (${w.kp_text})${w.sonnenwind_kms ? ` · Sonnenwind ${Math.round(w.sonnenwind_kms)} km/s` : ""}` : ""].filter(Boolean),
    quelle: "The Space Devs · NOAA SWPC",
  };
}

// Bestehende Agenten bekommen auch einen echten Einsatz (über Fridays vorhandene Funktionen).
async function wetter() {
  const { getWeather } = await import("./tools.js");
  const w = await getWeather(config.city);
  if (w?.error) throw new Error(w.error);
  const j = w.jetzt || {};
  const tage = w.tage || [];
  const morgen = tage[1];
  const text = `In ${w.ort} sind es gerade ${Math.round(j.temperatur)} Grad, ${j.wetter}.${morgen ? ` Morgen ${morgen.wetter}, ${Math.round(morgen.min)} bis ${Math.round(morgen.max)} Grad${morgen.regen_prozent >= 40 ? `, Regenrisiko ${morgen.regen_prozent} Prozent – Schirm mitnehmen` : ""}.` : ""}`;
  return { titel: `Wetter ${w.ort}`, text, punkte: tage.map((d) => `${datumKurz(d.tag)}: ${d.wetter}, ${Math.round(d.min)}–${Math.round(d.max)} °C, Regen ${d.regen_prozent ?? "?"} %`), quelle: "Open-Meteo" };
}
async function krypto() {
  const { getCrypto } = await import("./extras.js");
  const [B, E] = await Promise.all([getCrypto("bitcoin", "eur"), getCrypto("ethereum", "eur").catch(() => null)]);
  if (!Number.isFinite(B?.preis)) throw new Error(B?.error || "Kurs nicht erreichbar");
  const p = (x) => Math.round(x.preis).toLocaleString("de-DE");
  const ch = (x) => `${x.veraenderung_24h_prozent >= 0 ? "+" : ""}${zahlDe(x.veraenderung_24h_prozent)} %`;
  const e = Number.isFinite(E?.preis) ? E : null;
  return { titel: "Krypto-Kurse", text: `Bitcoin steht bei ${p(B)} Euro, ${ch(B)} in 24 Stunden.${e ? ` Ethereum bei ${p(e)} Euro, ${ch(e)}.` : ""} Nur Daten, kein Handel.`, punkte: [`₿ Bitcoin: ${p(B)} € (${ch(B)})`, e ? `Ξ Ethereum: ${p(e)} € (${ch(e)})` : ""].filter(Boolean), quelle: "CoinGecko" };
}
async function iss() {
  const { getISS } = await import("./extras.js");
  const d = await getISS();
  const ort = await heimOrt().catch(() => null);
  const km = ort ? Math.round(entfernungKm(ort, { lat: d.breitengrad, lon: d.laengengrad })) : null;
  return { titel: "ISS-Position", text: `Die ISS fliegt gerade in ${d.hoehe_km} Kilometern Höhe über der ${d.ueber}${km != null ? `, ${km.toLocaleString("de-DE")} Kilometer von ${ort.name} entfernt` : ""} – mit ${d.geschwindigkeit_kmh.toLocaleString("de-DE")} km/h.`, punkte: [`Breite ${d.breitengrad}°, Länge ${d.laengengrad}°`, `Höhe ${d.hoehe_km} km · ${d.geschwindigkeit_kmh.toLocaleString("de-DE")} km/h`], quelle: "wheretheiss.at" };
}
async function systemCheck() {
  const { runSystemCheck } = await import("./syscheck.js");
  const r = await runSystemCheck();
  const kaputt = (r.checks || []).filter((c) => !c.ok);
  return { titel: "System-Check", text: kaputt.length ? `${r.ok} von ${r.gesamt} Diensten laufen. Hakt: ${kaputt.slice(0, 3).map((c) => c.label).join(", ")}.` : `Alles im grünen Bereich: alle ${r.gesamt} Dienste laufen.`, punkte: (r.checks || []).map((c) => `${c.ok ? "✓" : "✗"} ${c.label}${c.detail ? ` – ${c.detail}` : ""}`).slice(0, 10), quelle: "Friday" };
}
async function lage() {
  const { getOverview } = await import("./lagezentrum.js");
  const list = (getOverview()?.laender || []).slice().sort((a, b) => b.meldungen - a.meldungen).slice(0, 5);
  if (!list.length) throw new Error("Das Lagezentrum sammelt noch Meldungen");
  const top = (c) => (Array.isArray(c.top) ? c.top[0]?.title || c.top[0] : c.top?.title || c.top || "");
  return { titel: "Weltlage", text: `Am meisten los ist gerade in ${list.slice(0, 3).map((c) => c.name).join(", ")}.${top(list[0]) ? ` ${list[0].name}: ${String(top(list[0])).replace(/[.!?]$/, "")}.` : ""}`, punkte: list.map((c) => `${c.name}: ${c.meldungen} Meldungen${top(c) ? ` – ${String(top(c)).slice(0, 90)}` : ""}`), quelle: "Lagezentrum (Google News)" };
}

export const EINSAETZE = {
  strom: { lauf: strom, knopf: "Günstige Stunden finden" },
  pollen: { lauf: pollen, knopf: "Pollenflug prüfen" },
  pegel: { lauf: pegel, knopf: "Wasserstände holen", eingabe: { label: "Ort (leer = Heimatort)", platzhalter: "z. B. Köln" } },
  verkehr: { lauf: verkehr, knopf: "Autobahn prüfen", eingabe: { label: "Autobahn", platzhalter: "z. B. A7" } },
  feiertage: { lauf: feiertage, knopf: "Nächste freie Tage" },
  nachrichten: { lauf: nachrichten, knopf: "Top-Meldungen holen" },
  recherche: { lauf: recherche, knopf: "Dossier erstellen", eingabe: { label: "Thema", platzhalter: "z. B. Kernfusion" }, pflicht: true },
  uebersetzer: { lauf: uebersetzer, knopf: "Übersetzen", eingabe: { label: "Text (optional mit Sprache)", platzhalter: "Englisch: Wo ist der Bahnhof?" }, pflicht: true },
  koch: { lauf: koch, knopf: "Was koche ich heute?" },
  erdbeben: { lauf: erdbeben, knopf: "Erdbeben prüfen" },
  weltraum: { lauf: weltraum, knopf: "Weltraum-Lage holen" },
  wetter: { lauf: wetter, knopf: "Wetter holen" },
  krypto: { lauf: krypto, knopf: "Kurse holen" },
  weltdaten: { lauf: iss, knopf: "ISS orten" },
  system: { lauf: systemCheck, knopf: "System prüfen" },
  lage: { lauf: lage, knopf: "Weltlage holen" },
};
// Der Team-Lagebericht: Friday schickt mehrere Agenten gleichzeitig los.
export const TEAM = ["wetter", "strom", "pollen", "feiertage", "nachrichten"];
export const EINSATZ_IDS = [...Object.keys(EINSAETZE), "team"];

// ---------- Ablauf + Speicher ----------
const laufend = new Map(); // agentId -> { seit, text }
export const einsatzLaeuft = () => new Map(laufend);

function berichteLaden() {
  try { return JSON.parse(fs.readFileSync(BERICHTE, "utf8")); } catch { return { letzte: {} }; }
}
function berichtSpeichern(id, b) {
  try {
    const d = berichteLaden();
    d.letzte = d.letzte || {};
    d.letzte[id] = b;
    fs.mkdirSync(path.dirname(BERICHTE), { recursive: true });
    fs.writeFileSync(BERICHTE, JSON.stringify(d, null, 1));
  } catch { /* egal */ }
}
export const letzterBericht = (id) => berichteLaden().letzte?.[id] || null;

/**
 * Einen Agenten losschicken. Gibt immer einen Bericht zurück (bei Fehlern mit ok:false und verständlichem Text).
 * @param {string} id  Agenten-ID (z. B. "strom")
 * @param {string} [eingabe]  optionale Eingabe (Thema, Autobahn, Text …)
 */
export async function einsetzen(id, eingabe = "", { name = id, kanal = "dashboard" } = {}) {
  const e = EINSAETZE[id];
  if (!e) return { agent: id, ok: false, titel: "Unbekannter Agent", text: `Den Agenten „${id}“ kann ich nicht losschicken.`, punkte: [], at: new Date().toISOString() };
  if (laufend.has(id)) return { agent: id, ok: false, beschaeftigt: true, titel: name, text: `${name} ist schon unterwegs.`, punkte: [], at: new Date().toISOString() };
  const start = Date.now();
  const kanalId = `agent:${id}`;
  laufend.set(id, { seit: start, text: `${e.knopf} …` });
  try { setzeAuftrag(kanalId, "arbeiten", 40, `${name}: ${e.knopf} …`, [`agent_${id}`]); } catch { /* egal */ }
  let bericht;
  try {
    const r = await Promise.race([
      e.lauf(String(eingabe || "").slice(0, 500)),
      new Promise((_, nein) => setTimeout(() => nein(new Error("Die Quelle antwortet gerade nicht (Zeitlimit).")), MAX_MS)),
    ]);
    bericht = { agent: id, ok: true, titel: r.titel || name, text: String(r.text || "").replace(/\.\.(?=\s|$)/g, "."), punkte: (r.punkte || []).filter(Boolean).slice(0, 10), quelle: r.quelle || "", link: r.link || "", at: new Date().toISOString(), dauer_ms: Date.now() - start };
  } catch (err) {
    const m = String(err?.message || err);
    const grund = /fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|network/i.test(m) ? "Die Quelle ist gerade nicht erreichbar (Internet?)." : /abort|timeout/i.test(m) ? "Die Quelle antwortet gerade nicht (Zeitlimit)." : m;
    bericht = { agent: id, ok: false, titel: name, text: `${name} kam nicht durch: ${grund.slice(0, 160)}`, punkte: [], at: new Date().toISOString(), dauer_ms: Date.now() - start };
  } finally {
    laufend.delete(id);
    try { auftragFertig(kanalId, bericht?.ok !== false); } catch { /* egal */ }
  }
  berichtSpeichern(id, bericht);
  logbuchEintrag({ bereich: "agent", titel: `${name}: ${bericht.titel}`, details: bericht.text, kanal, ok: bericht.ok, dauer_ms: bericht.dauer_ms, aktionen: [`agent_${id}`] });
  return bericht;
}

/** Team-Lagebericht: mehrere Agenten gleichzeitig, eine gemeinsame Ansage. */
export async function teamEinsatz({ namen = {}, kanal = "dashboard" } = {}) {
  const start = Date.now();
  const berichte = await Promise.all(TEAM.map((id) => einsetzen(id, "", { name: namen[id] || id, kanal })));
  const gut = berichte.filter((b) => b.ok);
  const text = gut.length ? gut.map((b) => b.text).join(" ") : "Mein Team kam gerade nicht durch – das Internet oder die Quellen streiken.";
  return { agent: "team", ok: gut.length > 0, titel: "Team-Lagebericht", text, berichte, at: new Date().toISOString(), dauer_ms: Date.now() - start };
}

// ---------- Sprachbefehl ohne Claude ----------
// "Friday, schick den Pollen-Agenten los", "Agent Strompreis", "Team-Lagebericht"
const WORTE = {
  strom: /strom ?preis|strombörse|strom ?agent|günstige(?:n)? strom|billige(?:n)? strom/,
  pollen: /pollen/,
  pegel: /pegel|wasserst(?:a|ä)nd/,
  verkehr: /verkehrs? ?agent|stau ?agent/,
  feiertage: /feiertag|ferien ?agent|schulferien/,
  nachrichten: /nachrichten ?agent|tagesschau ?agent/,
  koch: /koch ?agent|koch(?:-| )?ideen/,
  erdbeben: /erdbeben/,
  weltraum: /weltraum ?agent|raketen ?agent/,
};
export function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/[„“”"!?.,;:-]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^(?:hey |hallo |ok |okay )?(?:friday|freitag)\s*/, "");
  if (!t || t.length > 90) return null;
  if (/^(?:schick|sende|starte?)(?: mal)? (?:das |dein |mein )?(?:ganze |komplette )?team (?:los|raus)$|^team ?lage ?bericht$|^(?:mach|gib mir) (?:einen |den )?team ?lage ?bericht$/.test(t)) {
    return { team: true };
  }
  const v = /verkehrs? ?agent\w*(?: los)?(?: (?:für die|für|auf der|auf|zur))? ?(a ?\d{1,3})?/.exec(t);
  if (v) return { id: "verkehr", eingabe: v[1] || "" };
  const los = /(?:schick|sende|starte?|setz)(?: mal)? (?:den |die |das )?(.+?)(?: agent(?:en|in)?)?(?: los| ein| raus)?$/.exec(t);
  const kern = los ? los[1] : /^agent(?:in)? (.+)$/.exec(t)?.[1];
  if (!kern || !/agent|los$|einsetzen|ein$/.test(t)) return null;
  for (const [id, re] of Object.entries(WORTE)) if (re.test(kern) || re.test(t)) return { id };
  return null;
}
