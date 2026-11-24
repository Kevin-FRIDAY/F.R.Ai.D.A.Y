// Natur & Umwelt: Open-Meteo (kostenlos, ohne Schlüssel) und eigene Rechner.
import { nr, zahl, de, ort, holeJson } from "./hilfe.js";

const G = "Natur & Umwelt";
const ORT = "([a-zäöüß .-]{2,40})";

const POLLEN = { birch_pollen: "Birke", alder_pollen: "Erle", grass_pollen: "Gräser", mugwort_pollen: "Beifuß", ragweed_pollen: "Ambrosia", olive_pollen: "Olive" };
const stufe = (v) => (v == null ? null : v < 1 ? "keine" : v < 20 ? "schwach" : v < 100 ? "mittel" : "stark");
const MEERE = { ostsee: "Kiel", nordsee: "Sylt", mittelmeer: "Nizza", adria: "Rimini", atlantik: "Biarritz" };

// UBA-nahe Richtwerte in g CO₂-Äquivalent pro Personenkilometer (gerundet).
const CO2 = { "Auto (Benzin/Diesel)": 150, "E-Auto (Strommix)": 60, "Bahn Fernverkehr": 30, "Bahn Nahverkehr": 55, "Fernbus": 30, "Linienbus/Tram": 75, "Flugzeug Inland/Kurzstrecke": 250, "Flugzeug Langstrecke": 200, Fahrrad: 0 };

export default [
  {
    id: "pollenflug", titel: "Pollenflug", icon: "🌼", gruppe: G,
    info: "Aktuelle Pollenbelastung (Birke, Gräser, Erle …) für deinen Ort.",
    felder: [{ k: "ort", label: "Ort (leer = deine Stadt)", typ: "text" }],
    sprache: [[new RegExp(`^(?:wie (?:ist|stark ist) (?:der |die )?)?(?:pollenflug|pollen|pollenbelastung|heuschnupfen)(?: heute| gerade| jetzt)?(?: in ${ORT})?$`), (m) => ({ ort: m[1] || "" })]],
    async run(e) {
      const o = await ort(e.ort);
      const d = await holeJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${o.lat}&longitude=${o.lon}&current=${Object.keys(POLLEN).join(",")}&timezone=auto`);
      const c = d.current || {};
      const werte = Object.entries(POLLEN).map(([k, n]) => [n, c[k]]).filter(([, v]) => v != null);
      if (!werte.length) return { text: `Für ${o.name} gibt es keine Pollendaten (nur für Europa verfügbar).` };
      const aktiv = werte.filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]);
      return {
        text: aktiv.length ? `Pollenflug in ${o.name}: ${aktiv.slice(0, 3).map(([n, v]) => `${n} ${stufe(v)}`).join(", ")}.` : `In ${o.name} fliegen gerade praktisch keine Pollen.`,
        tabelle: { kopf: ["Pollen", "Körner/m³", "Stärke"], zeilen: werte.map(([n, v]) => [n, de(v, 0), stufe(v)]) }, quelle: "Open-Meteo / CAMS",
      };
    },
  },
  {
    id: "uv_index", titel: "UV-Index", icon: "🕶️", gruppe: G,
    info: "Wie stark die Sonne heute ist – und ob du Sonnencreme brauchst.",
    felder: [{ k: "ort", label: "Ort (leer = deine Stadt)", typ: "text" }],
    sprache: [[new RegExp(`^(?:wie (?:hoch|stark) ist (?:der )?)?uv[- ]?(?:index|wert|strahlung)(?: heute| gerade| jetzt)?(?: in ${ORT})?$|^brauche ich (?:heute )?sonnencreme(?: in ${ORT})?$`), (m) => ({ ort: m[1] || m[2] || "" })]],
    async run(e) {
      const o = await ort(e.ort);
      const d = await holeJson(`https://api.open-meteo.com/v1/forecast?latitude=${o.lat}&longitude=${o.lon}&current=uv_index&daily=uv_index_max&forecast_days=1&timezone=auto`);
      const jetzt = d.current?.uv_index, max = d.daily?.uv_index_max?.[0];
      if (max == null) throw new Error("Der Wetterdienst hat keinen UV-Wert geliefert.");
      const rat = max < 3 ? "kein Schutz nötig" : max < 6 ? "Sonnencreme und Sonnenbrille empfohlen" : max < 8 ? "hoch: Sonnencreme, Hut, mittags in den Schatten" : "sehr hoch: möglichst nicht in die Mittagssonne";
      return { text: `UV-Index in ${o.name}: heute höchstens ${de(max, 1)}${jetzt != null ? `, gerade ${de(jetzt, 1)}` : ""}. ${rat[0].toUpperCase() + rat.slice(1)}.`, quelle: "Open-Meteo" };
    },
  },
  {
    id: "wassertemperatur", titel: "Wassertemperatur Meer", icon: "🌊", gruppe: G,
    info: "Wie warm das Meer ist (Ostsee, Nordsee, Mittelmeer oder ein Küstenort).",
    felder: [{ k: "ort", label: "Meer oder Küstenort", typ: "text", platzhalter: "Ostsee, Mallorca, Rimini …" }],
    sprache: [[new RegExp(`^(?:wie (?:warm|kalt) ist (?:das wasser|das meer|die) (?:in |an der |am |auf )?|wassertemperatur (?:in |an der |am |auf |der |von )?)${ORT}$`), (m) => ({ ort: m[1] })]],
    async run(e) {
      const q = String(e.ort || "").trim();
      if (!q) throw new Error("Bitte gib ein Meer oder einen Küstenort an.");
      const o = await ort(MEERE[q.toLowerCase()] || q);
      const d = await holeJson(`https://marine-api.open-meteo.com/v1/marine?latitude=${o.lat}&longitude=${o.lon}&current=sea_surface_temperature,wave_height&timezone=auto`);
      const t = d.current?.sea_surface_temperature;
      if (t == null) return { text: `Für ${o.name} habe ich keine Meerestemperatur. Das geht nur für Orte direkt am Meer.` };
      const w = d.current?.wave_height;
      return { text: `Das Meer bei ${o.name} hat gerade ${de(t, 1)} Grad${w != null ? `, die Wellen sind etwa ${de(w, 1)} Meter hoch` : ""}. ${t < 16 ? "Ganz schön frisch!" : t < 21 ? "Erfrischend." : "Angenehm zum Baden."}`, quelle: "Open-Meteo Marine" };
    },
  },
  {
    id: "gefuehlte_temperatur", titel: "Gefühlte Temperatur & Taupunkt", icon: "🥶", gruppe: G,
    info: "Windchill, Hitze-Index und Taupunkt aus Temperatur, Wind und Luftfeuchte.",
    felder: [{ k: "temp", label: "Temperatur °C", typ: "zahl" }, { k: "wind", label: "Wind km/h", typ: "zahl", standard: "10" }, { k: "feuchte", label: "Luftfeuchte %", typ: "zahl", standard: "60" }],
    run(e) {
      const T = zahl(e, "temp", "die Temperatur", { min: -60, max: 60 }), v = nr(e.wind) ?? 10, rh = Math.min(100, Math.max(1, nr(e.feuchte) ?? 60));
      let gef = T, art = "";
      if (T <= 10 && v > 4.8) { gef = 13.12 + 0.6215 * T - 11.37 * v ** 0.16 + 0.3965 * T * v ** 0.16; art = "durch den Wind (Windchill)"; }
      else if (T >= 27) { const F = T * 1.8 + 32; const HI = -42.379 + 2.04901523 * F + 10.14333127 * rh - 0.22475541 * F * rh - 0.00683783 * F * F - 0.05481717 * rh * rh + 0.00122874 * F * F * rh + 0.00085282 * F * rh * rh - 0.00000199 * F * F * rh * rh; gef = (HI - 32) / 1.8; art = "durch die Schwüle (Hitze-Index)"; }
      const a = 17.62, b = 243.12, g = Math.log(rh / 100) + (a * T) / (b + T), tau = (b * g) / (a - g);
      return { text: `Bei ${de(T, 1)} Grad fühlt es sich an wie ${de(gef, 1)} Grad${art ? ` ${art}` : ""}. Der Taupunkt liegt bei ${de(tau, 1)} Grad${tau >= 16 ? ", das ist schwül" : ""}.` };
    },
  },
  {
    id: "co2_rechner", titel: "CO₂-Rechner Reise", icon: "🌍", gruppe: G,
    info: "CO₂-Ausstoß einer Strecke mit Auto, Bahn, Bus oder Flugzeug im Vergleich.",
    felder: [{ k: "km", label: "Strecke km", typ: "zahl" }, { k: "mittel", label: "Verkehrsmittel", typ: "wahl", optionen: Object.keys(CO2), standard: "Auto (Benzin/Diesel)" }, { k: "personen", label: "Personen im Auto", typ: "zahl", standard: "1" }],
    sprache: [[/^(?:wie ?viel )?co2 (?:für|von|bei|verursachen?) (\d[\d.]*) ?(?:km|kilometer) (?:mit dem |mit der |im |mit )?(auto|bahn|zug|bus|flugzeug|flug|fliegen)$/, (m) => ({ km: m[1], mittel: /auto/.test(m[2]) ? "Auto (Benzin/Diesel)" : /bahn|zug/.test(m[2]) ? "Bahn Fernverkehr" : /bus/.test(m[2]) ? "Fernbus" : nr(m[1]) > 3000 ? "Flugzeug Langstrecke" : "Flugzeug Inland/Kurzstrecke" })]],
    run(e) {
      const km = zahl(e, "km", "die Strecke", { min: 0.1 }), m = CO2[e.mittel] != null ? e.mittel : "Auto (Benzin/Diesel)", p = /^Auto|^E-Auto/.test(m) ? Math.max(1, nr(e.personen) || 1) : 1;
      const kg = (km * CO2[m]) / 1000 / p;
      const vergleich = Object.entries(CO2).filter(([k]) => k !== m && !/Fahrrad|Linienbus|Nahverkehr/.test(k)).map(([k, g]) => [k, `${de((km * g) / 1000, 1)} kg`]);
      return { text: `${de(km, 0)} Kilometer mit ${m} verursachen etwa ${de(kg, 1)} Kilogramm CO₂${p > 1 ? " pro Person" : ""}. Ein Baum braucht rund ${de(kg / 10, 1)} Jahre, um das wieder aufzunehmen.`, tabelle: { kopf: ["Alternative", "CO₂ pro Person"], zeilen: vergleich }, hinweis: "Richtwerte nach Umweltbundesamt, gerundet." };
    },
  },
];
