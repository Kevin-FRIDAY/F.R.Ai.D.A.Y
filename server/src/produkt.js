// Produkt-Scan für Friday Vision (v1.154.0)
// Du hältst ein Produkt (z. B. einen Joghurt) in die Kamera:
//  1. Strichcode erkannt (im Browser) → Open Food Facts (kostenlos, offen): Name, Marke, Menge,
//     Nährwerte pro 100 g, Zutaten, Allergene, Nutri-Score. Nicht gefunden → Open Beauty Facts (Kosmetik).
//  2. Preis: Open Prices (gemeldete Kassenbon-Preise der Open-Food-Facts-Gemeinschaft). Gibt es keine
//     Meldung, schätzt Friday (mit Guthaben) einen Richtwert und sagt deutlich, dass es eine Schätzung ist.
//  3. Kein Strichcode lesbar → das Foto geht an Fridays Gehirn: Produkt erkennen, danach bei
//     Open Food Facts suchen. Findet sich nichts, sind die Werte als "geschätzt" markiert.
// Friday kennt KEINE echten, aktuellen Ladenpreise eines bestimmten Geschäfts. Das sagt sie auch so.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { denke, jsonAus } from "./denker.js";
import { config } from "./config.js";
import { ersatzBereit } from "./ki-client.js";

const UA = "F.R.Ai.D.A.Y-Assistent/1.154 (privater Sprachassistent)";
const OFF = () => (process.env.PRODUKT_OFF_BASIS || "https://world.openfoodfacts.org").replace(/\/$/, "");
const OBF = () => (process.env.PRODUKT_OBF_BASIS || "https://world.openbeautyfacts.org").replace(/\/$/, "");
const PREISE = () => (process.env.PRODUKT_PREISE_BASIS || "https://prices.openfoodfacts.org").replace(/\/$/, "");
const FELDER = "code,product_name,product_name_de,generic_name_de,brands,quantity,image_front_url,image_front_small_url,ingredients_text_de,ingredients_text,allergens_tags,traces_tags,nutriments,nutriscore_grade,nova_group,labels_tags,categories_tags,additives_tags,serving_size";
const CACHE_MS = 7 * 24 * 3600 * 1000;

const kiBereit = () => Boolean(config.anthropicKey) || ersatzBereit();

async function holeJson(url, ms = 8000) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(ms) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Gültiger Strichcode? EAN-8, UPC-A (12), EAN-13, GTIN-14 mit Prüfziffer. */
export function codeGueltig(code) {
  const c = String(code || "").replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(c.length)) return false;
  const ziffern = c.split("").map(Number);
  const pruef = ziffern.pop();
  const summe = ziffern.reverse().reduce((s, z, i) => s + z * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (summe % 10)) % 10 === pruef;
}

// ---------- Zahlen schön sprechen ----------
const zahl = (n, stellen = 1) => {
  if (n === null || n === undefined || n === "" || !Number.isFinite(Number(n))) return null;
  const v = Number(n);
  const r = Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10 ** stellen) / 10 ** stellen;
  return String(r).replace(".", ",");
};
const euro = (n) => `${Number(n).toFixed(2).replace(".", ",")} €`;
const euroSprich = (n) => {
  const v = Math.round(Number(n) * 100);
  const e = Math.floor(v / 100), c = v % 100;
  if (!e) return `${c} Cent`;
  return c ? `${e} Euro ${c}` : `${e} Euro`;
};
const tagName = (t) => String(t || "").replace(/^[a-z]{2}:/, "").replace(/-/g, " ");
const ALLERGEN_DE = {
  milk: "Milch", gluten: "Gluten", eggs: "Ei", nuts: "Schalenfrüchte", peanuts: "Erdnüsse", soybeans: "Soja", fish: "Fisch",
  crustaceans: "Krebstiere", molluscs: "Weichtiere", celery: "Sellerie", mustard: "Senf", "sesame-seeds": "Sesam",
  "sulphur-dioxide-and-sulphites": "Sulfite", lupin: "Lupinen",
};
const allergenDe = (t) => ALLERGEN_DE[String(t || "").replace(/^[a-z]{2}:/, "")] || tagName(t);

/** Wandelt ein Open-Food-Facts-Produkt in Fridays Form um. */
export function ausOff(p = {}, quelle = "Open Food Facts") {
  const n = p.nutriments || {};
  const w = (k) => (Number.isFinite(Number(n[`${k}_100g`])) ? Number(n[`${k}_100g`]) : null);
  let kcal = w("energy-kcal");
  if (kcal === null && w("energy") !== null) kcal = Math.round(w("energy") / 4.184);
  const zutaten = String(p.ingredients_text_de || p.ingredients_text || "").replace(/_/g, "").replace(/\s+/g, " ").trim();
  return {
    code: String(p.code || ""),
    name: String(p.product_name_de || p.product_name || p.generic_name_de || "").trim(),
    marke: String(p.brands || "").split(",")[0].trim(),
    menge: String(p.quantity || "").trim(),
    bild: p.image_front_small_url || p.image_front_url || "",
    naehrwerte: {
      kcal, fett: w("fat"), gesaettigt: w("saturated-fat"), kohlenhydrate: w("carbohydrates"), zucker: w("sugars"),
      ballaststoffe: w("fiber"), eiweiss: w("proteins"), salz: w("salt"),
    },
    zutaten,
    allergene: [...new Set((p.allergens_tags || []).map(allergenDe))].filter(Boolean),
    spuren: [...new Set((p.traces_tags || []).map(allergenDe))].filter(Boolean),
    zusatzstoffe: (p.additives_tags || []).map((t) => tagName(t).toUpperCase()).slice(0, 15),
    nutriscore: /^[a-e]$/.test(String(p.nutriscore_grade || "")) ? String(p.nutriscore_grade).toUpperCase() : "",
    nova: Number(p.nova_group) || null,
    vegan: (p.labels_tags || []).some((t) => /vegan/.test(t)),
    bio: (p.labels_tags || []).some((t) => /organic|bio/.test(t)),
    quelle,
    geschaetzt: false,
  };
}

/** Preise aus Open Prices: Median der letzten 12 Monate (Euro). */
export async function preisVon(code) {
  try {
    const d = await holeJson(`${PREISE()}/api/v1/prices?product_code=${encodeURIComponent(code)}&order_by=-date&size=50`, 6000);
    const jahr = Date.now() - 365 * 24 * 3600 * 1000;
    const alle = (d?.items || []).filter((x) => String(x.currency || "EUR").toUpperCase() === "EUR" && Number(x.price) > 0);
    const frisch = alle.filter((x) => !x.date || Date.parse(x.date) >= jahr);
    const liste = (frisch.length ? frisch : alle).slice(0, 50);
    if (!liste.length) return null;
    const werte = liste.map((x) => Number(x.price)).sort((a, b) => a - b);
    const mitte = werte.length % 2 ? werte[(werte.length - 1) / 2] : (werte[werte.length / 2 - 1] + werte[werte.length / 2]) / 2;
    const laeden = [...new Set(liste.map((x) => x.location?.osm_brand || x.location?.osm_name).filter(Boolean))].slice(0, 4);
    return {
      art: "gemeldet",
      wert: Math.round(mitte * 100) / 100,
      min: werte[0], max: werte.at(-1), anzahl: liste.length,
      zuletzt: liste[0]?.date || "", laeden,
      alt: !frisch.length,
      quelle: "Open Prices (von Käufern gemeldete Kassenbon-Preise)",
    };
  } catch { return null; }
}

/** Ohne gemeldeten Preis: Friday schätzt (mit Guthaben). Immer als Schätzung gekennzeichnet. */
async function preisSchaetzen(p) {
  if (!kiBereit() || !p?.name) return null;
  const r = await denke({
    stufe: "leicht", quelle: "produkt", maxTokens: 300,
    system: "Du schätzt typische Ladenpreise in Deutschland (Supermarkt/Discounter, aktuelles Jahr). Antworte NUR mit JSON {\"von\":0.49,\"bis\":0.79} in Euro. Weißt du es gar nicht, gib {\"von\":null,\"bis\":null}.",
    text: `Produkt: ${[p.marke, p.name, p.menge].filter(Boolean).join(" · ")}`,
  });
  const j = r.ok ? jsonAus(r.text) : null;
  const von = Number(j?.von), bis = Number(j?.bis);
  if (!(von > 0) || !(bis > 0)) return null;
  return { art: "geschaetzt", wert: Math.round(((von + bis) / 2) * 100) / 100, min: Math.min(von, bis), max: Math.max(von, bis), quelle: "Schätzung von Friday (kein echter Ladenpreis)" };
}

// ---------- Ansage (kurz, zum Vorlesen) ----------
export function ansage(p) {
  if (!p) return "";
  const s = [];
  const titel = [p.marke && !String(p.name).toLowerCase().includes(p.marke.toLowerCase()) ? p.marke : "", p.name].filter(Boolean).join(" ") || "ein Produkt";
  s.push(`Das ist ${titel}${p.menge ? `, ${p.menge.replace(/\bg\b/, "Gramm").replace(/\bml\b/i, "Milliliter").replace(/\bl\b/, "Liter")}` : ""}.`);
  if (p.preis?.art === "gemeldet") {
    const spanne = p.preis.anzahl > 1 && p.preis.max - p.preis.min >= 0.1 ? `, gemeldet zwischen ${euroSprich(p.preis.min)} und ${euroSprich(p.preis.max)}` : "";
    s.push(`Richtpreis etwa ${euroSprich(p.preis.wert)}${spanne}. Das sind ${p.preis.anzahl === 1 ? "eine Preismeldung" : `${p.preis.anzahl} Preismeldungen`} von Käufern${p.preis.alt ? ", allerdings älter als ein Jahr" : ""}, kein Preis aus deinem Laden.`);
  } else if (p.preis?.art === "geschaetzt") {
    s.push(`Einen gemeldeten Preis gibt es nicht. Ich schätze etwa ${euroSprich(p.preis.min)} bis ${euroSprich(p.preis.max)}, das ist nur eine Schätzung.`);
  } else {
    s.push("Einen Preis kenne ich dafür leider nicht.");
  }
  const n = p.naehrwerte || {};
  const teile = [];
  if (n.kcal !== null && n.kcal !== undefined) teile.push(`${Math.round(n.kcal)} Kilokalorien`);
  if (n.fett !== null && n.fett !== undefined) teile.push(`${zahl(n.fett)} Gramm Fett`);
  if (n.zucker !== null && n.zucker !== undefined) teile.push(`${zahl(n.zucker)} Gramm Zucker`);
  if (n.eiweiss !== null && n.eiweiss !== undefined) teile.push(`${zahl(n.eiweiss)} Gramm Eiweiß`);
  if (n.salz !== null && n.salz !== undefined) teile.push(`${zahl(n.salz, 2)} Gramm Salz`);
  if (teile.length) s.push(`${p.geschaetzt ? "Geschätzt pro" : "Pro"} 100 Gramm: ${teile.join(", ")}.`);
  if (p.nutriscore) s.push(`Nutri-Score ${p.nutriscore}.`);
  if (p.allergene?.length) s.push(`Allergene: ${p.allergene.join(", ")}.`);
  if (p.zutaten) {
    const liste = p.zutaten.replace(/\([^)]*\)/g, "").split(/,|;/).map((x) => x.trim().replace(/[.:]$/, "")).filter(Boolean);
    const kurz = liste.slice(0, 8).join(", ");
    s.push(`Zutaten: ${kurz}${liste.length > 8 ? " und weitere" : ""}.`);
  }
  if (p.vegan) s.push("Laut Etikett vegan.");
  if (p.geschaetzt) s.push("Die Werte habe ich vom Foto geschätzt, bitte auf der Packung nachsehen.");
  return s.join(" ");
}

// ---------- Nachschlagen ----------
function cache() { return store.load("produkte", {}); }
function merke(p) {
  const c = cache();
  if (p.code) c[p.code] = { ...p, zeit: Date.now() };
  const keys = Object.keys(c);
  if (keys.length > 300) keys.sort((a, b) => (c[a].zeit || 0) - (c[b].zeit || 0)).slice(0, keys.length - 300).forEach((k) => delete c[k]);
  store.save("produkte", c);
  const v = store.load("produkt-verlauf", []);
  v.unshift({ code: p.code, name: p.name, marke: p.marke, bild: p.bild, preis: p.preis?.wert ?? null, preisArt: p.preis?.art || "", zeit: new Date().toISOString(), geschaetzt: p.geschaetzt });
  store.save("produkt-verlauf", v.filter((x, i) => i === 0 || !x.code || x.code !== v[0].code).slice(0, 30));
}

/** Produkt per Strichcode. */
export async function perCode(code, { schaetzen = true } = {}) {
  const c = String(code || "").replace(/\D/g, "");
  if (!c) return { ok: false, error: "Kein Strichcode." };
  const alt = cache()[c];
  if (alt && Date.now() - (alt.zeit || 0) < CACHE_MS) {
    const p = { ...alt };
    merke(p);
    return { ok: true, produkt: p, ansage: ansage(p), cache: true };
  }
  let p = null;
  try {
    const d = await holeJson(`${OFF()}/api/v2/product/${c}.json?fields=${FELDER}`);
    if (d?.product && (d.status === 1 || d.status === "success" || d.product.product_name || d.product.product_name_de)) p = ausOff({ code: c, ...d.product });
  } catch (e) { console.error("Produkt (OFF):", e.message); }
  if (!p) {
    try {
      const d = await holeJson(`${OBF()}/api/v2/product/${c}.json?fields=${FELDER}`);
      if (d?.product && (d.product.product_name || d.product.product_name_de)) p = ausOff({ code: c, ...d.product }, "Open Beauty Facts");
    } catch { /* nicht gefunden */ }
  }
  if (!p) return { ok: false, code: c, unbekannt: true, error: "Diesen Strichcode kennt Open Food Facts noch nicht." };
  p.preis = (await preisVon(c)) || (schaetzen ? await preisSchaetzen(p).catch(() => null) : null);
  merke(p);
  logbuch.eintragen({ bereich: "kauf", titel: `Produkt gescannt: ${[p.marke, p.name].filter(Boolean).join(" ")}`, details: p.preis ? `Preis ${p.preis.art}: ${euro(p.preis.wert)}` : "kein Preis" });
  return { ok: true, produkt: p, ansage: ansage(p) };
}

async function suche(begriff) {
  try {
    const d = await holeJson(`${OFF()}/cgi/search.pl?search_terms=${encodeURIComponent(begriff)}&search_simple=1&action=process&json=1&page_size=5&fields=${FELDER}`, 9000);
    const treffer = (d?.products || []).filter((x) => x.product_name || x.product_name_de);
    return treffer[0] || null;
  } catch { return null; }
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ");
function passt(a, b) {
  const wa = new Set(norm(a).split(/\s+/).filter((w) => w.length > 2));
  const wb = norm(b).split(/\s+/).filter((w) => w.length > 2);
  if (!wa.size || !wb.length) return false;
  return wb.filter((w) => wa.has(w)).length / Math.min(wa.size, wb.length) >= 0.5;
}

const BILD_SYSTEM = `Du bist Friday Vision und erkennst Produkte auf einem Kamerabild (Lebensmittel, Getränke, Drogerie, Haushalt).
Antworte NUR mit JSON, ohne Text drumherum:
{"erkannt":true,"name":"Produktname wie auf der Packung","marke":"Marke","menge":"z. B. 150 g","ean":"Ziffern unter dem Strichcode, nur wenn klar lesbar, sonst leer","kategorie":"z. B. Joghurt",
"naehrwerte":{"kcal":null,"fett":null,"zucker":null,"eiweiss":null,"salz":null},"naehrwerte_von_packung":false,
"zutaten":"Zutaten, wenn auf dem Bild lesbar, sonst leer","allergene":["Milch"],"preis_von":0.49,"preis_bis":0.79,"hinweis":"kurzer Satz, falls etwas unsicher ist"}
Regeln: Nährwerte pro 100 g/ml. Steht die Nährwerttabelle lesbar auf dem Bild, übernimm sie und setze naehrwerte_von_packung=true; sonst schätze typische Werte für diese Produktart. Preis = typischer Ladenpreis in Deutschland (Schätzung).
Ist kein Produkt zu sehen: {"erkannt":false,"hinweis":"was du stattdessen siehst, ein Satz"}.
Erkenne oder benenne niemals Personen.`;

/** Produkt per Foto: Friday erkennt es, danach wird bei Open Food Facts nachgeschlagen. */
export async function perBild(image) {
  if (!image?.data) return { ok: false, error: "Kein Bild." };
  if (!kiBereit()) return { ok: false, error: "Ich sehe keinen Strichcode. Halte ihn näher und gerade in die Kamera. Zum Erkennen ohne Strichcode brauche ich Guthaben." };
  const r = await denke({ system: BILD_SYSTEM, text: "Welches Produkt ist das?", image, stufe: "mittel", maxTokens: 900, quelle: "produkt" });
  if (!r.ok) return { ok: false, error: r.error || "Ich konnte das Bild gerade nicht auswerten." };
  const j = jsonAus(r.text) || {};
  if (!j.erkannt) return { ok: false, keinProdukt: true, error: j.hinweis ? `Ich sehe kein Produkt. ${j.hinweis}` : "Ich sehe kein Produkt. Halte es bitte näher an die Kamera." };
  const ean = String(j.ean || "").replace(/\D/g, "");
  if (codeGueltig(ean)) {
    const per = await perCode(ean, { schaetzen: false });
    if (per.ok) {
      if (!per.produkt.preis && Number(j.preis_von) > 0) {
        per.produkt.preis = { art: "geschaetzt", wert: Math.round(((Number(j.preis_von) + Number(j.preis_bis || j.preis_von)) / 2) * 100) / 100, min: Number(j.preis_von), max: Number(j.preis_bis || j.preis_von), quelle: "Schätzung von Friday (kein echter Ladenpreis)" };
        per.ansage = ansage(per.produkt);
      }
      return { ...per, weg: "foto+code" };
    }
  }
  const begriff = [j.marke, j.name].filter(Boolean).join(" ");
  const treffer = begriff ? await suche(begriff) : null;
  if (treffer && passt(`${treffer.brands || ""} ${treffer.product_name_de || treffer.product_name || ""}`, begriff) && treffer.code) {
    const per = await perCode(treffer.code, { schaetzen: false });
    if (per.ok) {
      per.produkt.gesucht = true;
      if (!per.produkt.preis && Number(j.preis_von) > 0) per.produkt.preis = { art: "geschaetzt", wert: Math.round(((Number(j.preis_von) + Number(j.preis_bis || j.preis_von)) / 2) * 100) / 100, min: Number(j.preis_von), max: Number(j.preis_bis || j.preis_von), quelle: "Schätzung von Friday (kein echter Ladenpreis)" };
      per.ansage = ansage(per.produkt);
      return { ...per, weg: "foto+suche" };
    }
  }
  const nw = j.naehrwerte || {};
  const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const p = {
    code: "", name: String(j.name || j.kategorie || "Produkt").slice(0, 120), marke: String(j.marke || "").slice(0, 60), menge: String(j.menge || "").slice(0, 30), bild: "",
    naehrwerte: { kcal: num(nw.kcal), fett: num(nw.fett), gesaettigt: null, kohlenhydrate: null, zucker: num(nw.zucker), ballaststoffe: null, eiweiss: num(nw.eiweiss), salz: num(nw.salz) },
    zutaten: String(j.zutaten || "").slice(0, 1500), allergene: Array.isArray(j.allergene) ? j.allergene.map(String).slice(0, 10) : [], spuren: [], zusatzstoffe: [],
    nutriscore: "", nova: null, vegan: false, bio: false,
    quelle: "Fridays Bilderkennung", geschaetzt: !j.naehrwerte_von_packung, hinweis: String(j.hinweis || "").slice(0, 200),
    preis: Number(j.preis_von) > 0 ? { art: "geschaetzt", wert: Math.round(((Number(j.preis_von) + Number(j.preis_bis || j.preis_von)) / 2) * 100) / 100, min: Number(j.preis_von), max: Number(j.preis_bis || j.preis_von), quelle: "Schätzung von Friday (kein echter Ladenpreis)" } : null,
  };
  merke(p);
  logbuch.eintragen({ bereich: "kauf", titel: `Produkt per Foto erkannt: ${[p.marke, p.name].filter(Boolean).join(" ")}`, details: "Werte geschätzt (nicht bei Open Food Facts gefunden)" });
  return { ok: true, produkt: p, ansage: ansage(p), weg: "foto" };
}

export const verlauf = () => store.load("produkt-verlauf", []);
