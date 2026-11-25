// Lebensmittel- und Produkt-Rückrufe (v1.165.0, Stern-Idee aus der Ideen-Schmiede).
// Offizielle Warnungen von lebensmittelwarnung.de (Bundesländer + BVL) über die offene Schnittstelle,
// die auch die App der Länder nutzt (dokumentiert auf bund.dev). Kostenlos, öffentlicher Zugangsschlüssel.
// Eingabe: Suchwort ("Käse", "Salmonellen") oder Bundesland ("Bayern"), leer = neueste Rückrufe.
import { holen, gemerkt, datumKurz, kuerzen, LAENDER, landSchluessel } from "./oeffentlich/hilfe.js";

const API = "https://megov.bayern.de/verbraucherschutz/baystmuv-verbraucherinfo/rest/api/warnings/merged";
// Öffentlicher Schlüssel aus der Dokumentation (bund.dev/apis → Lebensmittelwarnung), kein Geheimnis.
const AUTH = "baystmuv-vi-1.0 os=ios, key=9d9e8972-ff15-4943-8fea-117b5a973c61";

async function alle() {
  return gemerkt("rueckrufe", 30 * 60 * 1000, async () => {
    const seit = Date.now() - 90 * 864e5;
    const teil = { rows: 60, sort: "publishedDate desc, title asc", start: 0, fq: [`publishedDate > ${seit}`] };
    const d = await holen(API, {
      method: "POST", timeout: 15000,
      headers: { Authorization: AUTH, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ food: teil, products: teil }),
    });
    const docs = d?.response?.docs || [];
    return docs.map((x) => ({
      id: String(x.id ?? x.link ?? x.title),
      art: /product/i.test(x._type || "") ? "Produkt" : "Lebensmittel",
      titel: String(x.title || x.product?.productName || "Rückruf"),
      produkt: x.product?.productName || x.product?.designation || "",
      hersteller: x.product?.manufacturer || x.rapexInformation?.manufacturer || "",
      grund: String(x.warning || x.safetyInformation?.hazard || "").replace(/<[^>]+>/g, " "),
      laender: (x.affectedStates || []).map((s) => String(s)),
      datum: Number(x.publishedDate) || null,
      link: x.link || "https://www.lebensmittelwarnung.de",
      bild: x.product?.imageUrls?.[0] || null,
    })).sort((a, b) => (b.datum || 0) - (a.datum || 0));
  });
}

export async function laden(eingabe = "") {
  const q = String(eingabe || "").trim().replace(/^(für|fuer|zu|von|in|bei)\s+/i, "");
  let liste = await alle();
  let filter = "";
  const land = landSchluessel(q);
  if (land) {
    const name = LAENDER[land][1];
    liste = liste.filter((r) => !r.laender.length || r.laender.some((s) => s.toLowerCase().includes(name.toLowerCase()) || /alle|bundesweit/i.test(s)));
    filter = ` in ${name}`;
  } else if (q) {
    const w = q.toLowerCase();
    liste = liste.filter((r) => `${r.titel} ${r.produkt} ${r.hersteller} ${r.grund}`.toLowerCase().includes(w));
    filter = ` zu „${q}“`;
  }
  const neu = liste.filter((r) => r.datum && Date.now() - r.datum < 7 * 864e5);
  const text = !liste.length
    ? `Ich finde keinen aktuellen Rückruf${filter}.`
    : `${liste.length} ${liste.length === 1 ? "Rückruf" : "Rückrufe"}${filter} in den letzten 90 Tagen${neu.length ? `, ${neu.length} davon diese Woche` : ""}. Der neueste: ${kuerzen(liste[0].titel, 140)}.`;
  return {
    text,
    zeilen: liste.slice(0, 30).map((r) => ({
      titel: `${r.art === "Produkt" ? "🧸" : "🥫"} ${kuerzen(r.titel, 120)}`, wert: r.datum ? datumKurz(r.datum) : "",
      unter: kuerzen([r.hersteller, r.grund, r.laender.length ? `Betroffen: ${r.laender.slice(0, 6).join(", ")}${r.laender.length > 6 ? " …" : ""}` : ""].filter(Boolean).join(" · "), 260),
      farbe: neu.includes(r) ? "#ff4a3a" : "#ff9a2a", link: r.link, bild: r.bild,
    })),
  };
}

export const QUELLE = {
  id: "rueckrufe", titel: "Rückrufe & Warnungen", icon: "🥫", gruppe: "Deutschland",
  info: "Offizielle Lebensmittel- und Produktrückrufe, suchbar nach Produkt oder Bundesland.",
  quelle: "lebensmittelwarnung.de (Länder & BVL)", link: "https://www.lebensmittelwarnung.de",
  eingabe: { platzhalter: "Suchwort oder Bundesland, z. B. Käse oder Bayern" },
  sprache: [
    /^(?:gibt es |gibts |welche |zeig mir (?:die )?|aktuelle |neue )?(?:aktuelle |neue )?(?:lebensmittel-?|produkt-?)?(?:rückrufe?|rueckrufe?|lebensmittelwarnungen?|produktwarnungen?)(?: (?:für|fuer|zu|von|in|bei) (.+?))?(?: gerade| heute| aktuell)?$/,
    /^(?:wurde|wird) (.+?) zurückgerufen$/,
  ],
  laden,
};
