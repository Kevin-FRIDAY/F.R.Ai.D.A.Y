// Staus, Sperrungen, Baustellen & Ladesäulen an Autobahnen (v1.165.0, Stern-Idee aus der Ideen-Schmiede).
// Offene Schnittstelle der Autobahn GmbH des Bundes (verkehr.autobahn.de), kostenlos, ohne Schlüssel.
// Eingabe: Autobahn ("A7", "a 100"), optional Art ("Baustellen A1", "Sperrungen A3", "Ladesäulen A9").
import { holen, gemerkt, de, zeit, kuerzen } from "./oeffentlich/hilfe.js";

const API = "https://verkehr.autobahn.de/o/autobahn";
const ARTEN = {
  warning: { name: "Verkehrsmeldungen", eins: "Meldung", icon: "🚗", farbe: "#ff4a3a" },
  closure: { name: "Sperrungen", eins: "Sperrung", icon: "⛔", farbe: "#ff4a3a" },
  roadworks: { name: "Baustellen", eins: "Baustelle", icon: "🚧", farbe: "#ff9a2a" },
  electric_charging_station: { name: "Ladesäulen", eins: "Ladesäule", icon: "🔌", farbe: "#3ddc84" },
};

export function verstehen(eingabe = "") {
  const t = String(eingabe || "").toLowerCase();
  const m = t.match(/\ba\s?-?(\d{1,3})\b/);
  const art = /baustell/.test(t) ? "roadworks" : /sperr|gesperrt/.test(t) ? "closure" : /lade|strom|e-?auto/.test(t) ? "electric_charging_station" : "warning";
  return { strasse: m ? `A${Number(m[1])}` : "", art };
}

async function holeArt(strasse, art) {
  const d = await gemerkt(`ab:${strasse}:${art}`, 5 * 60 * 1000, () => holen(`${API}/${strasse}/services/${art}`, { timeout: 15000 }));
  return Array.isArray(d?.[art]) ? d[art] : [];
}

export async function laden(eingabe = "") {
  const { strasse, art } = verstehen(eingabe);
  if (!strasse) return { text: "Welche Autobahn? Sag zum Beispiel: Stau auf der A7, oder: Baustellen auf der A1.", zeilen: [], frage: true };
  const roads = await gemerkt("ab:roads", 864e5, () => holen(`${API}/`)).catch(() => null);
  if (Array.isArray(roads?.roads) && !roads.roads.includes(strasse)) return { text: `Die ${strasse} kenne ich nicht.`, zeilen: [] };
  const liste = await holeArt(strasse, art);
  // Bei Staumeldungen gleich die Sperrungen mitnehmen.
  const sperrungen = art === "warning" ? await holeArt(strasse, "closure").catch(() => []) : [];
  const a = ARTEN[art];
  const eintraege = [...liste.map((x) => ({ x, art })), ...sperrungen.filter((s) => !s.future).map((x) => ({ x, art: "closure" }))];
  const zeilen = eintraege.slice(0, 40).map(({ x, art: ar }) => {
    const beschr = Array.isArray(x.description) ? x.description.filter(Boolean).join(" · ") : String(x.description || "");
    const verz = Number(x.delayTimeValue);
    return {
      titel: `${ARTEN[ar].icon} ${x.title || strasse}`,
      wert: Number.isFinite(verz) && verz > 0 ? `+${de(verz)} min` : x.isBlocked === "true" || x.isBlocked === true ? "gesperrt" : "",
      unter: kuerzen(`${x.subtitle ? `${x.subtitle} · ` : ""}${beschr}${x.startTimestamp ? ` · seit ${zeit(x.startTimestamp)}` : ""}`, 260),
      farbe: ARTEN[ar].farbe,
      lat: Number(x.coordinate?.lat), lon: Number(x.coordinate?.long),
    };
  });
  let text;
  if (!liste.length && !sperrungen.length) text = art === "warning" ? `Auf der ${strasse} gibt es gerade keine Stau- oder Sperrungsmeldung.` : `Auf der ${strasse} gibt es gerade keine ${a.name}.`;
  else if (art === "warning") {
    const lang = liste.map((x) => Number(x.delayTimeValue) || 0).sort((p, q) => q - p)[0] || 0;
    text = `Auf der ${strasse} gibt es ${liste.length} ${liste.length === 1 ? "Verkehrsmeldung" : "Verkehrsmeldungen"}`
      + (sperrungen.length ? ` und ${sperrungen.length} ${sperrungen.length === 1 ? "Sperrung" : "Sperrungen"}` : "") + "."
      + (liste[0] ? ` Zum Beispiel ${String(liste[0].title || "").replace(/\s*\|\s*/, ": ")}${lang ? `, bis zu ${de(lang)} Minuten Verzögerung` : ""}.` : "");
  } else text = `Auf der ${strasse} gibt es ${liste.length} ${liste.length === 1 ? a.eins : a.name}.${liste[0] ? ` Zum Beispiel ${String(liste[0].title || "").replace(/\s*\|\s*/, ": ")}.` : ""}`;
  return { text, zeilen, punkte: zeilen.filter((z) => Number.isFinite(z.lat)).map((z) => ({ lat: z.lat, lon: z.lon, name: z.titel, farbe: z.farbe })) };
}

export const QUELLE = {
  id: "autobahn", titel: "Autobahn: Stau & Baustellen", icon: "🛣️", gruppe: "Deutschland",
  info: "Staus, Sperrungen, Baustellen und Ladesäulen auf jeder Autobahn.",
  quelle: "Autobahn GmbH des Bundes", link: "https://verkehr.autobahn.de",
  eingabe: { platzhalter: "z. B. A7 oder Baustellen A1" },
  sprache: [
    /^(?:(?:ist|gibt es|gibts|habe ich) )?(?:(?:einen|ein|eine) )?(?:stau|staus|sperrung|sperrungen|baustelle|baustellen|ladesäulen?|ladesaeulen?|verkehr|verkehrslage|verkehrsmeldungen?)(?: (?:auf|an) (?:der|die))? (a\s?-?\d{1,3})(?: gerade| jetzt| heute)?$/,
    /^(?:wie ist )?(?:der )?verkehr (?:auf|an) der (a\s?-?\d{1,3})$/,
    /^(?:ist )?(?:die )?(a\s?-?\d{1,3}) (?:frei|gesperrt|dicht|voll)$/,
  ],
  // Für die Sprache: die ganze Frage weitergeben, damit "Baustellen" erkannt wird.
  ganzeFrage: true,
  kurz: (k) => { const v = verstehen(k); return v.art === "warning" ? v.strasse : `${ARTEN[v.art].name} ${v.strasse}`; },
  laden,
};
