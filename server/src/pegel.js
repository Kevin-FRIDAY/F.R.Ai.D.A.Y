// Hochwasser & Pegelstände (v1.165.0, Stern-Idee aus der Ideen-Schmiede).
// Wasserstände an Bundeswasserstraßen von PEGELONLINE (Wasserstraßen- und Schifffahrtsverwaltung des Bundes),
// kostenlos, ohne Schlüssel. Eingabe: Fluss ("Spree", "Rhein") oder Ort ("Köln") – ohne Eingabe Fridays Ort.
import { holen, ortZuKoordinaten, gemerkt, de, zeit, km, ortOder, ersterGross } from "./oeffentlich/hilfe.js";

const API = "https://www.pegelonline.wsv.de/webservices/rest-api/v2";
const ZUSTAND = { low: ["niedrig", "#4ab3ff"], normal: ["normal", "#3ddc84"], high: ["hoch", "#ff4a3a"], unknown: ["unbekannt", "#9aa0a6"] };
const name = (s) => ersterGross(String(s || "").toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase()));

function station(s, bei) {
  const w = (s.timeseries || []).find((t) => t.shortname === "W") || {};
  const m = w.currentMeasurement || {};
  const z = ZUSTAND[m.stateMnwMhw] || ZUSTAND.unknown;
  const schifffahrt = m.stateNswHsw === "high";
  return {
    id: s.uuid, name: name(s.longname || s.shortname), fluss: name(s.water?.longname || s.water?.shortname), km: s.km,
    lat: s.latitude, lon: s.longitude, wert: m.value, einheit: w.unit || "cm", stand: m.timestamp,
    zustand: z[0], farbe: schifffahrt ? "#ff4a3a" : z[1], hoch: m.stateMnwMhw === "high" || schifffahrt, schifffahrt,
    entfernung: bei && Number.isFinite(s.latitude) ? km(bei, { lat: s.latitude, lon: s.longitude }) : null,
  };
}

async function trend(id) {
  try {
    const m = await holen(`${API}/stations/${id}/W/measurements.json?start=PT3H`, { timeout: 8000 });
    if (!Array.isArray(m) || m.length < 2) return null;
    return m[m.length - 1].value - m[0].value;
  } catch { return null; }
}

/** Pegel suchen → { text, zeilen, ... } */
export async function laden(eingabe = "") {
  const q = String(eingabe || "").trim().replace(/^(an |am |der |die |in |bei )+/i, "");
  return gemerkt(`pegel:${q.toLowerCase()}`, 10 * 60 * 1000, async () => {
    const opt = "includeTimeseries=true&includeCurrentMeasurement=true&timeseries=W";
    let liste = [];
    let bei = null;
    if (q) {
      const fluss = q.toUpperCase();
      liste = await holen(`${API}/stations.json?${opt}&waters=${encodeURIComponent(fluss)}`).catch(() => []);
    }
    if (!liste.length) {
      bei = await ortZuKoordinaten(ortOder(q));
      for (const radius of [25, 60, 120]) {
        liste = await holen(`${API}/stations.json?${opt}&latitude=${bei.lat}&longitude=${bei.lon}&radius=${radius}`).catch(() => []);
        if (liste.length) break;
      }
    }
    if (!liste.length) return { text: `Ich finde keinen Pegel an einer Bundeswasserstraße bei ${q || bei?.name || "dir"}.`, zeilen: [] };
    let st = liste.map((s) => station(s, bei)).filter((s) => Number.isFinite(s.wert));
    st.sort((a, b) => (bei ? a.entfernung - b.entfernung : (b.hoch - a.hoch) || (a.km ?? 0) - (b.km ?? 0)));
    st = st.slice(0, 12);
    if (!st.length) return { text: "Die Pegel melden gerade keine aktuellen Werte.", zeilen: [] };
    const erster = st[0];
    const t = await trend(erster.id);
    const trendText = t == null ? "" : Math.abs(t) < 2 ? ", gleichbleibend" : t > 0 ? `, steigt (+${de(t)} cm in 3 Std.)` : `, fällt (${de(t)} cm in 3 Std.)`;
    const hohe = st.filter((s) => s.hoch);
    const text = `Pegel ${erster.name} (${erster.fluss}): ${de(erster.wert)} ${erster.einheit}, ${erster.zustand}${trendText}.`
      + (hohe.length ? ` Achtung: ${hohe.length === 1 ? `${hohe[0].name} meldet Hochwasser` : `${hohe.length} Pegel melden hohen Wasserstand`}.` : "");
    return {
      text,
      zeilen: st.map((s) => ({
        titel: `${s.name} · ${s.fluss}`, wert: `${de(s.wert)} ${s.einheit}`, farbe: s.farbe,
        unter: `${s.zustand}${s.schifffahrt ? " · über Höchstem Schifffahrtswasserstand" : ""}${s.entfernung != null ? ` · ${de(s.entfernung)} km entfernt` : ""} · ${zeit(s.stand)}`,
        link: `https://www.pegelonline.wsv.de/gast/stammdaten?pegelnr=${encodeURIComponent(s.id)}`,
      })),
      punkte: st.map((s) => ({ lat: s.lat, lon: s.lon, name: s.name, farbe: s.farbe })),
    };
  });
}

const FLUESSE = "rhein|elbe|donau|main|mosel|weser|ems|oder|neckar|spree|havel|saale|lahn|ruhr|fulda|werra|saar|aller|leine|trave|peene|neiße|neisse";

export const QUELLE = {
  id: "pegel", titel: "Pegel & Hochwasser", icon: "🌊", gruppe: "Deutschland",
  info: "Wasserstände an Flüssen und Kanälen mit Hochwasser-Hinweis und Trend.",
  quelle: "PEGELONLINE (WSV)", link: "https://www.pegelonline.wsv.de",
  eingabe: { platzhalter: "Fluss oder Ort, z. B. Elbe oder Köln" },
  sprache: [
    /^(?:wie (?:hoch )?(?:ist|steht) (?:der |die |das )?)?(?:pegel|wasserstand|pegelstand)(?:stand)?(?: (?:der|des|vom|von der|von|am|an der|in|bei))? ?(.*)$/,
    new RegExp(`^wie (?:hoch|tief) (?:steht|ist) (?:der |die |das )?(${FLUESSE})(?: gerade| jetzt| heute)?$`),
    /^(?:gibt es |gibts |droht )?(?:ein )?hochwasser(?: (?:an der|am|in|bei))? ?(.*)$/,
  ],
  laden,
};
