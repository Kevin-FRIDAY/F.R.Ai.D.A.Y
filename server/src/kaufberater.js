// Anti-Fehlkauf-Berater (v1.106.0)
// Prüft ein Produkt, BEVOR du es kaufst:
//  1. Passt es zu deinen Geräten? (Anschlüsse, iPhone/Android, Mac/Windows, Alexa/HomeKit/Matter, Zigbee/Thread …)
//  2. Echte Langzeit-Mängel: Bewertungen, die du aus dem Shop kopierst (oder per Lesezeichen schickst),
//     werden nach Mängeln sortiert – besonders die, die erst nach Wochen/Monaten auftreten.
//  3. Retouren-Gründe: Warum schicken Leute es zurück? (Größe, defekt, passt nicht, anders als Bild …)
//  4. Reparierbarkeit über iFixit (öffentliche, kostenlose Schnittstelle) und Links zu Tests & Preisvergleich.
// Alles OHNE Claude. Friday liest keine Shop-Seiten heimlich aus (kein Scraping): sie wertet nur aus,
// was du ihr gibst, und sagt ehrlich, wenn Daten fehlen. Die „Tiefen-Recherche“ mit Websuche braucht Guthaben.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { teile, U } from "./datum.js";

const UA = "F.R.Ai.D.A.Y-Assistent/1.106 (privater Sprachassistent)";
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- Meine Geräte (+ Garantie-Wächter) ----------
export function geraete() {
  return store.load("geraete", []).map((g) => ({ ...g, profil: profil(`${g.name} ${g.notiz || ""}`), garantie: garantie(g) }));
}
export function geraetSpeichern(g = {}) {
  const liste = store.load("geraete", []);
  const name = String(g.name || "").trim().slice(0, 80);
  if (!name) throw new Error("Wie heißt das Gerät?");
  const e = liste.find((x) => x.id === g.id) || { id: neueId(), seit: new Date().toISOString() };
  e.name = name;
  e.kaufdatum = /^\d{4}-\d{2}-\d{2}$/.test(g.kaufdatum || "") ? g.kaufdatum : "";
  e.notiz = String(g.notiz || "").slice(0, 200);
  if (!liste.includes(e)) liste.push(e);
  store.save("geraete", liste.slice(-200));
  logbuch.eintragen({ bereich: "kauf", titel: `Meine Geräte: ${name} gespeichert` });
  return e;
}
export function geraetLoeschen(id) {
  const liste = store.load("geraete", []);
  store.save("geraete", liste.filter((x) => x.id !== id));
  return true;
}
// 2 Jahre gesetzliche Gewährleistung (EU) ab Kaufdatum
function garantie(g) {
  const m = String(g.kaufdatum || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const ende = `${+m[1] + 2}-${m[2]}-${m[3]}`;
  const h = teile();
  const tage = Math.round((Date.UTC(+m[1] + 2, +m[2] - 1, +m[3]) - Date.UTC(h.y, h.m - 1, h.d)) / 86400000);
  return { ende, tage };
}
/** Einmal am Tag: Gewährleistung endet in 30 Tagen → Mitteilung. */
export async function garantiePruefen(notifyAll) {
  const liste = store.load("geraete", []);
  let geaendert = false;
  for (const g of liste) {
    const ga = garantie(g);
    if (!ga || g.gewarnt || ga.tage > 30 || ga.tage < 0) continue;
    g.gewarnt = true; geaendert = true;
    const text = `Die 2-Jahres-Gewährleistung für ${g.name} endet in ${ga.tage} Tagen. Hat es Macken? Jetzt reklamieren!`;
    try { await notifyAll?.("🛡 Garantie-Wächter", text); } catch { /* egal */ }
    logbuch.eintragen({ bereich: "kauf", titel: "Garantie-Wächter", details: text });
  }
  if (geaendert) store.save("geraete", liste);
}

// ---------- Eigenschaften aus Text erkennen ----------
// Was steckt in einem Namen/Text? (für Geräte UND Produkte)
const MERKMALE = [
  ["usbc", /\busb[- ]?c\b|\btype[- ]?c\b|thunderbolt|\busb 4\b|usb4/],
  ["lightning", /\blightning\b/],
  ["microusb", /micro[- ]?usb/],
  ["hdmi", /\bhdmi\b/],
  ["klinke", /3[,.]5 ?mm|klinke|aux[- ]?eingang/],
  ["qi", /\bqi2?\b|kabellos(es)? laden|wireless charg|induktiv/],
  ["magsafe", /magsafe/],
  ["ios", /\bios\b|iphone|ipad|apple watch|airpods/],
  ["android", /android|galaxy|pixel|xiaomi|oneplus|huawei|google play/],
  ["mac", /macos|\bmac\b|macbook|imac|mac mini|mac studio/],
  ["windows", /windows|\bpc\b|\bwin ?1[01]\b/],
  ["linux", /\blinux\b/],
  ["homekit", /homekit|apple home|siri/],
  ["alexa", /alexa|echo\b|echo dot|echo show|amazon echo/],
  ["google", /google home|google assistant|nest\b|chromecast/],
  ["matter", /\bmatter\b/],
  ["thread", /\bthread\b/],
  ["zigbee", /zigbee/],
  ["zwave", /z-?wave/],
  ["hue", /\bhue\b|philips hue/],
  ["smartthings", /smartthings/],
  ["samsungtv", /samsung.{0,20}(tv|fernseher|qled|neo|frame)|tizen/],
  ["playstation", /playstation|\bps5\b|\bps4\b/],
  ["xbox", /xbox/],
  ["switch", /nintendo switch|\bswitch 2\b/],
  ["wlan24", /nur 2[,.]4 ?ghz|2[,.]4 ?ghz only|only 2[,.]4/],
  ["bluetooth", /bluetooth|\bbt ?5/],
  ["abo", /\babo\b|abonnement|subscription|monatlich .{0,10}(gebühr|gebuehr|kosten)|cloud[- ]?abo|premium[- ]?abo/],
  ["app_pflicht", /nur (mit|über|ueber) (der )?app|app (ist )?erforderlich|app notwendig|app benötigt|app benoetigt|konto (erforderlich|nötig|noetig)/],
];
// Bekannte Geräte → typische Eigenschaften
const GERAETE_WISSEN = [
  [/iphone (1[5-9]|2\d)|iphone 1[5-9]|iphone air|iphone 17/, ["ios", "usbc", "qi", "magsafe", "bluetooth"]],
  [/iphone (1[2-4])/, ["ios", "lightning", "qi", "magsafe", "bluetooth"]],
  [/iphone ([6-9]|x|xs|xr|11|se)/, ["ios", "lightning", "bluetooth"]],
  [/\biphone\b/, ["ios", "bluetooth"]],
  [/ipad/, ["ios", "usbc", "bluetooth"]],
  [/macbook|imac|mac mini|mac studio|\bmac\b/, ["mac", "usbc", "bluetooth"]],
  [/apple tv|homepod mini|homepod/, ["homekit", "thread", "matter"]],
  [/echo (4|show 10|hub)|echo \(4/, ["alexa", "zigbee", "matter"]],
  [/echo|alexa/, ["alexa", "matter"]],
  [/hue bridge|philips hue/, ["hue", "zigbee", "homekit", "alexa", "matter"]],
  [/samsung.{0,20}(tv|fernseher|qled|neo|frame)/, ["samsungtv", "hdmi", "smartthings", "alexa", "bluetooth"]],
  [/fritz ?box/, ["wlan24"]],
  [/ps5|playstation/, ["playstation", "hdmi", "usbc"]],
  [/xbox/, ["xbox", "hdmi"]],
  [/nintendo switch/, ["switch", "usbc", "hdmi"]],
  [/galaxy|pixel|android/, ["android", "usbc", "qi", "bluetooth"]],
  [/windows|\bpc\b|laptop/, ["windows", "usbc", "hdmi", "bluetooth"]],
  [/airpods pro 2|airpods 4|airpods pro 3/, ["ios", "usbc", "bluetooth"]],
  [/airpods/, ["ios", "lightning", "bluetooth"]],
  [/apple watch/, ["ios"]],
  [/home ?assistant/, ["zigbee", "matter", "thread", "homekit", "alexa", "google"]],
];
export function profil(text, geraet = true) {
  const n = norm(text);
  const set = new Set();
  for (const [k, re] of MERKMALE) if (re.test(n)) set.add(k);
  if (geraet) for (const [re, ks] of GERAETE_WISSEN) if (re.test(n)) { ks.forEach((k) => set.add(k)); break; }
  return [...set];
}

// ---------- Passt es zu meinen Geräten? ----------
function kompatibel(produktText, meine) {
  const p = new Set(profil(produktText, false));
  const h = new Set(meine.flatMap((g) => g.profil));
  const namen = (k) => meine.filter((g) => g.profil.includes(k)).map((g) => g.name).slice(0, 2).join(", ");
  const out = [];
  const add = (stufe, text) => out.push({ stufe, text });
  if (!meine.length) {
    add("info", "Trag unten unter „Meine Geräte“ ein, was du schon hast (z. B. iPhone 15, MacBook Air, Samsung TV, Echo Dot). Dann prüft Friday, ob es passt.");
    return out;
  }
  // Handy
  if (p.has("android") && !p.has("ios") && h.has("ios") && !h.has("android")) add("bad", `Klingt nach „nur Android“ – du hast ein iPhone (${namen("ios")}). Prüf, ob es eine iPhone-App gibt.`);
  if (p.has("ios") && !p.has("android") && h.has("android") && !h.has("ios")) add("bad", "Klingt nach „nur iPhone“ – du hast Android.");
  if ((p.has("ios") || p.has("android")) && ((p.has("ios") && h.has("ios")) || (p.has("android") && h.has("android")))) add("ok", "Läuft mit deinem Handy.");
  // Computer
  if (p.has("windows") && !p.has("mac") && h.has("mac") && !h.has("windows")) add("warn", `Nur Windows erwähnt – du hast einen Mac (${namen("mac")}). Gibt es Mac-Software?`);
  if (p.has("mac") && h.has("mac")) add("ok", "Mac wird unterstützt.");
  // Stecker
  if (p.has("lightning") && h.has("usbc") && !h.has("lightning")) add("warn", "Hat Lightning – deine Geräte nutzen USB-C. Du bräuchtest einen Adapter.");
  if (p.has("microusb")) add("warn", "Micro-USB ist veraltet. Du brauchst ein extra Kabel, deine anderen passen nicht.");
  if (p.has("usbc") && h.has("usbc")) add("ok", "USB-C passt zu deinen Kabeln und Ladegeräten.");
  if (p.has("lightning") && h.has("lightning")) add("ok", "Lightning passt zu deinem iPhone.");
  if (p.has("magsafe") && !h.has("magsafe")) add("warn", "MagSafe hält nur bei iPhone 12 oder neuer magnetisch.");
  if ((p.has("magsafe") || p.has("qi")) && h.has("magsafe")) add("ok", "Kabelloses Laden klappt mit deinem iPhone.");
  if (p.has("klinke") && h.has("ios") && /kopfh|headset|kabel/.test(norm(produktText))) add("warn", "3,5-mm-Klinke: iPhones haben keine Buchse mehr, du brauchst einen Adapter.");
  // Smart Home
  const sh = ["homekit", "alexa", "google", "matter", "zigbee", "thread", "hue", "zwave", "smartthings"].filter((k) => p.has(k));
  if (sh.length) {
    const passt = [];
    if (p.has("matter") && (h.has("matter") || h.has("homekit") || h.has("alexa"))) passt.push("Matter");
    if (p.has("alexa") && h.has("alexa")) passt.push("Alexa");
    if (p.has("homekit") && (h.has("homekit") || h.has("ios"))) passt.push("Apple Home");
    if (p.has("hue") && h.has("hue")) passt.push("Hue-Bridge");
    if (p.has("smartthings") && h.has("smartthings")) passt.push("SmartThings");
    if (passt.length) add("ok", `Smart Home passt über ${[...new Set(passt)].join(", ")}.`);
    else add("bad", `Funktioniert mit ${sh.map(shName).join(", ")} – dazu hast du nichts Passendes eingetragen.`);
    if (p.has("zigbee") && !p.has("matter") && !p.has("homekit") && !h.has("zigbee")) add("warn", "Zigbee braucht eine Zentrale (z. B. Hue Bridge oder Echo 4). Ohne läuft es nicht.");
    if (p.has("thread") && !h.has("thread")) add("warn", "Thread braucht einen Border-Router (HomePod mini, Apple TV 4K oder neuer Echo).");
    if (p.has("zwave") && !h.has("zwave")) add("bad", "Z-Wave braucht eine eigene Zentrale – hast du nicht eingetragen.");
  }
  // Konsolen/TV
  for (const k of ["playstation", "xbox", "switch"]) if (p.has(k) && !h.has(k)) add("bad", `Ist für ${shName(k)} gemacht – die hast du nicht eingetragen.`);
  if (p.has("hdmi") && (h.has("samsungtv") || h.has("hdmi"))) add("ok", "HDMI passt an deinen Fernseher.");
  if (p.has("wlan24")) add("warn", "Braucht 2,4-GHz-WLAN. Die meisten Router können das, manchmal muss man es einzeln einschalten.");
  if (p.has("abo")) add("warn", "Achtung Folgekosten: Es wird ein Abo erwähnt. Rechne die monatlichen Kosten mit ein.");
  if (p.has("app_pflicht")) add("warn", "Funktioniert nur mit App/Konto. Wenn der Hersteller die App einstellt, kann das Gerät nutzlos werden.");
  // Schon vorhanden?
  const pn = norm(produktText);
  const doppelt = meine.find((g) => { const w = norm(g.name).split(/\s+/).filter((x) => x.length > 3); return w.length && w.every((x) => pn.includes(x)); });
  if (doppelt) add("warn", `Du hast schon „${doppelt.name}“. Brauchst du wirklich ein zweites?`);
  if (!out.length) add("info", "Aus Name und Beschreibung erkenne ich keine Anschlüsse oder Systeme. Füg die Produktbeschreibung („Technische Daten“) ein, dann prüfe ich genauer.");
  return out;
}
const shName = (k) => ({ homekit: "Apple Home", alexa: "Alexa", google: "Google Home", matter: "Matter", zigbee: "Zigbee", thread: "Thread", hue: "Philips Hue", zwave: "Z-Wave", smartthings: "SmartThings", playstation: "PlayStation", xbox: "Xbox", switch: "Nintendo Switch" }[k] || k);

// ---------- Bewertungen auswerten ----------
const MAENGEL = [
  ["Akku", "🔋", /akku|batterie|laufzeit|laedt nicht|lädt nicht|ladet nicht|haelt nur|hält nur|entlaedt|entlädt|battery/],
  ["Display/Bildschirm", "🖥", /display|bildschirm|pixel|touch|flackert|streifen|screen/],
  ["Anschluss/Kabel/Laden", "🔌", /anschluss|buchse|ladekabel|kabel|stecker|ladeport|usb|netzteil|wackel/],
  ["Bruch/Gehäuse/Material", "🧱", /bruch|gebrochen|abgebrochen|riss|gerissen|scharnier|gehaeuse|gehäuse|plastik|billig verarbeitet|verarbeitung|wackelt|klappert|haelt nicht|hält nicht|material/],
  ["Software/App/Updates", "📱", /app|software|update|firmware|absturz|stuerzt ab|stürzt ab|einrichtung|konto|server|cloud|bug|fehlermeldung/],
  ["Verbindung (WLAN/Bluetooth)", "📶", /verbindung|wlan|wifi|bluetooth|koppeln|pairing|verliert|bricht ab|abbrueche|abbrüche|reichweite|signal/],
  ["Ton/Mikrofon/Lautsprecher", "🔊", /ton|sound|lautsprecher|mikrofon|rauschen|knackt|knistert|lautstaerke|lautstärke|bass|hall/],
  ["Lautstärke/Geräusch/Motor", "⚙", /laut|geraeusch|geräusch|surrt|brummt|piept|luefter|lüfter|motor|vibriert|quietscht/],
  ["Wasser/Rost/Dichtung", "💧", /wasser|undicht|tropft|leck|rost|dichtung|feucht|kalk/],
  ["Tasten/Knöpfe/Schalter", "🔘", /taste|knopf|schalter|button|drehregler|reagiert nicht/],
  ["Totalausfall/Defekt", "💀", /geht nicht mehr|funktioniert nicht mehr|tot\b|totalausfall|kaputt|defekt|ausgefallen|gibt den geist|schrott|geht nicht an|startet nicht|ging kaputt/],
  ["Verschleiß/Optik", "🧵", /abgenutzt|verschleiss|verschleiß|verblasst|ausgebleicht|pilling|fusselt|naht|reissverschluss|reißverschluss|loest sich|löst sich|abblaettert|abblättert|kratzer|verkratzt|verfaerbt|verfärbt/],
  ["Kundendienst/Garantie", "☎", /kundendienst|kundenservice|support|garantie|gewaehrleistung|gewährleistung|reklamation|hersteller reagiert|keine antwort/],
];
const RETOUREN = [
  ["Größe/Passform falsch", /zu klein|zu gross|zu groß|zu eng|zu weit|faellt klein|fällt klein|faellt gross|fällt groß|passform|groesse|größe/],
  ["Anders als Bild/Beschreibung", /anders als (auf dem bild|abgebildet|beschrieben)|nicht wie beschrieben|entspricht nicht|farbe (anders|weicht)|sieht anders aus|irrefuehrend|irreführend/],
  ["Defekt angekommen", /defekt (angekommen|geliefert)|kam kaputt|beschaedigt (angekommen|geliefert)|beschädigt (angekommen|geliefert)|doa|direkt defekt|von anfang an defekt|ging gar nicht/],
  ["Passt nicht zu meinen Geräten", /nicht kompatibel|inkompatibel|passt nicht (an|zu|in)|funktioniert nicht mit|wird nicht erkannt|nicht unterstuetzt|nicht unterstützt/],
  ["Qualität enttäuschend", /billig|minderwertig|qualitaet (schlecht|mies|enttaeuschend)|qualität (schlecht|mies|enttäuschend)|wertig wirkt anders|fuehlt sich billig|fühlt sich billig/],
  ["Gebraucht/unvollständig", /gebraucht|benutzt|fehlte|unvollstaendig|unvollständig|ohne zubehoer|ohne zubehör|teile fehlen|verpackung (offen|geoeffnet|geöffnet)/],
  ["Zu laut/stört", /zu laut|nervt|stoert|stört|piept staendig|piept ständig/],
  ["Geruch", /riecht|stinkt|geruch|chemisch/],
  ["Zu teuer für das Gebotene", /zu teuer|preis.{0,20}(nicht wert|ueberteuert|überteuert)|ueberteuert|überteuert|geld nicht wert/],
];
const ZAHLWORT = { ein: 1, eine: 1, einem: 1, einen: 1, zwei: 2, drei: 3, vier: 4, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwoelf: 12, paar: 3, wenigen: 2, einigen: 4 };
// "nach 3 Monaten", "nach einem Jahr", "seit zwei Wochen", "nach kurzer Zeit"
function zeitAngabe(satz) {
  const n = norm(satz).replace(/ü/g, "ue");
  const m = n.match(/\b(nach|seit|innerhalb( von)?|binnen|knapp|gut|ueber|über)\s+(\d+|[a-z]+)\s+(tag|tagen|woche|wochen|monat|monaten|jahr|jahren|jahre)\b/);
  if (m) {
    const z = /^\d+$/.test(m[3]) ? +m[3] : ZAHLWORT[m[3]] ?? 1;
    const tage = z * (m[4].startsWith("tag") ? 1 : m[4].startsWith("woche") ? 7 : m[4].startsWith("monat") ? 30 : 365);
    return { tage, text: m[0] };
  }
  if (/nach (einem|1) jahr|nach ueber einem jahr|nach gut einem jahr/.test(n)) return { tage: 365, text: "nach einem Jahr" };
  if (/kurz nach (ablauf )?der garantie|nach ablauf der garantie|garantie (gerade )?abgelaufen/.test(n)) return { tage: 730, text: "nach der Garantie" };
  if (/nach kurzer zeit|schon nach kurzem|nach wenigen tagen/.test(n)) return { tage: 10, text: "nach kurzer Zeit" };
  if (/\b(update|nachtrag|edit)\b\s*[:(-]/.test(n)) return { tage: 60, text: "Nachtrag" };
  return null;
}
function saetze(text) {
  return String(text || "").replace(/\r/g, "").split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 8 && s.length < 600);
}
function sterne(text) {
  const n = norm(text);
  const werte = [];
  for (const m of n.matchAll(/(\d)[,.]?(\d)? von 5( sternen)?/g)) werte.push(+`${m[1]}.${m[2] || 0}`);
  for (const m of String(text).matchAll(/(★{1,5})(☆{0,4})/g)) if (m[1].length + m[2].length === 5) werte.push(m[1].length);
  if (!werte.length) return null;
  return { schnitt: Math.round((werte.reduce((a, b) => a + b, 0) / werte.length) * 10) / 10, anzahl: werte.length, schlecht: werte.filter((w) => w <= 2).length };
}
export function bewertungenAuswerten(text) {
  const s = saetze(text);
  const maengel = new Map();
  const retouren = new Map();
  let negativ = 0;
  for (const satz of s) {
    const n = norm(satz);
    const neg = /nicht|kein|kaputt|defekt|leider|schlecht|enttaeusch|enttäusch|mangel|problem|ärger|aerger|zurueck|zurück|retour|reklam|ausgefallen|nervig|schade/.test(n);
    if (neg) negativ++;
    const zeit = zeitAngabe(satz);
    for (const [name, icon, re] of MAENGEL) {
      if (!re.test(n) || !neg) continue;
      const e = maengel.get(name) || { name, icon, anzahl: 0, langzeit: 0, zitate: [], zeiten: [] };
      e.anzahl++;
      if (zeit && zeit.tage >= 30) { e.langzeit++; e.zeiten.push(zeit.text); }
      if (e.zitate.length < 3) e.zitate.push(satz.slice(0, 220));
      maengel.set(name, e);
    }
    for (const [name, re] of RETOUREN) {
      if (!re.test(n)) continue;
      const e = retouren.get(name) || { name, anzahl: 0, zitate: [] };
      e.anzahl++;
      if (e.zitate.length < 2) e.zitate.push(satz.slice(0, 200));
      retouren.set(name, e);
    }
  }
  const mListe = [...maengel.values()].sort((a, b) => b.langzeit - a.langzeit || b.anzahl - a.anzahl);
  const rListe = [...retouren.values()].sort((a, b) => b.anzahl - a.anzahl);
  return { saetze: s.length, negativ, sterne: sterne(text), maengel: mListe, retouren: rListe, langzeit: mListe.reduce((a, m) => a + m.langzeit, 0) };
}

// ---------- Öffentliche Quellen ----------
async function ifixit(produkt) {
  const q = String(produkt || "").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).slice(0, 5).join(" ");
  if (!q) return null;
  try {
    const r = await fetch(`https://www.ifixit.com/api/2.0/search/${encodeURIComponent(q)}?limit=5`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const d = await r.json();
    const treffer = (d.results || []).filter((x) => x.dataType === "guide" || x.dataType === "wiki" || x.dataType === "device").slice(0, 4)
      .filter((x) => /^https:\/\/(www\.)?ifixit\.com\//.test(String(x.url || ""))).map((x) => ({ titel: String(x.title || x.display_title || "").slice(0, 100), url: x.url, art: x.dataType === "guide" ? "Anleitung" : "Gerät" }));
    return { anzahl: d.totalResults ?? treffer.length, treffer };
  } catch { return null; }
}
function links(produkt) {
  const q = encodeURIComponent(String(produkt || "").trim());
  const qp = encodeURIComponent(`${String(produkt || "").trim()} Probleme nach Monaten`);
  return [
    { name: "Stiftung Warentest", url: `https://www.test.de/suche/?q=${q}`, icon: "🏅" },
    { name: "Preisvergleich (idealo)", url: `https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=${q}`, icon: "💶" },
    { name: "Preisvergleich (Geizhals)", url: `https://geizhals.de/?fs=${q}`, icon: "💶" },
    { name: "Langzeit-Erfahrungen (Reddit)", url: `https://www.reddit.com/search/?q=${encodeURIComponent(`${String(produkt || "").trim()} after months`)}`, icon: "💬" },
    { name: "Probleme nach Monaten (Web)", url: `https://duckduckgo.com/?q=${qp}`, icon: "🔎" },
    { name: "Langzeittest (YouTube)", url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${String(produkt || "").trim()} Langzeittest`)}`, icon: "▶" },
    { name: "Reparatur (iFixit)", url: `https://www.ifixit.com/Search?query=${q}`, icon: "🔧" },
  ];
}

// ---------- Gesamturteil ----------
export async function pruefen({ produkt = "", beschreibung = "", text = "", url = "" } = {}) {
  produkt = String(produkt || "").trim().slice(0, 200);
  text = String(text || "").slice(0, 60000);
  if (!produkt && !text) throw new Error("Welches Produkt soll ich prüfen? Name eintippen oder Bewertungen einfügen.");
  if (!produkt) produkt = saetze(text)[0]?.slice(0, 80) || "Produkt";
  const meine = geraete();
  beschreibung = String(beschreibung || "").slice(0, 8000);
  const kompat = kompatibel(`${produkt} ${beschreibung}`, meine);
  const bew = bewertungenAuswerten(text);
  const reparatur = await ifixit(produkt);
  const ehrlich = [];
  if (bew.saetze < 5) ehrlich.push("Ich habe kaum Bewertungstext. Kopier im Shop die Bewertungen (am besten die kritischen und die „Nachträge“) und füg sie ein, dann finde ich die Langzeit-Mängel.");
  else if (bew.saetze < 40) ehrlich.push(`Nur ${bew.saetze} Sätze ausgewertet. Je mehr Bewertungen du einfügst, desto sicherer wird das Urteil.`);
  if (!reparatur) ehrlich.push("iFixit war nicht erreichbar oder kennt das Produkt nicht – zur Reparierbarkeit kann ich nichts sagen.");
  ehrlich.push("Preise vergleicht Friday nicht selbst (kein Auslesen fremder Shops). Nutz die Preisvergleich-Links.");

  // Ampel
  let punkte = 0;
  punkte += kompat.filter((k) => k.stufe === "bad").length * 3 + kompat.filter((k) => k.stufe === "warn").length;
  punkte += Math.min(6, bew.langzeit * 1.5) + Math.min(3, (bew.maengel.find((m) => m.name.startsWith("Totalausfall"))?.anzahl || 0));
  if (bew.sterne && bew.sterne.schnitt < 3.5) punkte += 2;
  const ampel = punkte >= 6 ? "rot" : punkte >= 3 ? "gelb" : bew.saetze >= 5 || kompat.some((k) => k.stufe === "ok") ? "gruen" : "grau";
  const top = bew.maengel[0];
  const sprech = [
    ampel === "rot" ? `Vorsicht bei ${produkt}.` : ampel === "gelb" ? `${produkt}: kaufbar, aber mit Haken.` : ampel === "gruen" ? `${produkt} sieht gut aus.` : `Zu ${produkt} weiß ich noch zu wenig.`,
    kompat.find((k) => k.stufe === "bad")?.text || "",
    top ? `Häufigster Mangel: ${top.name}${top.langzeit ? `, ${top.langzeit} mal erst nach längerer Zeit` : ""}.` : "",
    bew.retouren[0] ? `Hauptgrund für Rücksendungen: ${bew.retouren[0].name}.` : "",
  ].filter(Boolean).join(" ");
  const e = { id: neueId(), at: new Date().toISOString(), produkt, url: /^https?:\/\//.test(url) ? String(url).slice(0, 500) : "", ampel, kompat, ...bew, reparatur, links: links(produkt), ehrlich, sprech, geraeteAnzahl: meine.length };
  const verlauf = store.load("kaufberater", []);
  verlauf.push({ ...e, maengel: e.maengel.map((m) => ({ ...m, zitate: m.zitate.slice(0, 2) })) });
  store.save("kaufberater", verlauf.slice(-40));
  logbuch.eintragen({ bereich: "kauf", titel: `Kaufberater: ${produkt} → ${{ rot: "Vorsicht", gelb: "mit Haken", gruen: "gut", grau: "zu wenig Daten" }[ampel]}` });
  return e;
}
export const verlauf = () => store.load("kaufberater", []).slice().reverse();
export const letzte = () => store.load("kaufberater", []).at(-1) || null;

// ---------- Sprache ----------
const OEFFNEN = U(/^(öffne|oeffne|zeig|zeige|starte)( mir)?( den| das| die)? (kaufberater|kauf-berater|anti-fehlkauf|fehlkauf-berater|kaufcheck|kauf-check|meine geräte|meine geraete)\b/);
const PRUEF = [
  U(/^soll ich (?:mir )?(?:den |die |das |einen |eine |ein )?(.{3,80}?) kaufen$/),
  U(/^lohnt sich (?:der |die |das |ein |eine |einen )?(.{3,80}?)(?: zu kaufen)?$/),
  U(/^(?:prüf|pruef|prüfe|pruefe|check|checke) (?:mal )?(?:ob )?(?:der |den |die |das |ein |eine |einen )?(.{3,80}?) (?:zu meinen geräten passt|zu meinen geraeten passt|vor dem kauf|bevor ich (?:es|ihn|sie) kaufe|auf fehlkauf)$/),
  U(/^(?:kaufberater|kauf-check|kaufcheck|fehlkauf-check)[,:]? (.{3,80})$/),
  U(/^ist (?:der |die |das |ein |eine )?(.{3,80}?) ein fehlkauf$/),
];
const GERAET = U(/^(?:ich habe|ich hab|ich besitze|merk dir,? ich habe) (?:ein(?:en|e)? |einen neuen |eine neue |ein neues )?(.{3,60}?)(?: gekauft| bekommen)?(?: am (\d{1,2})\.(\d{1,2})\.(\d{2,4}))?$/);

function vorbereiten(text) {
  return String(text || "").replace(/[„“”"!?;]/g, " ").replace(/\s+/g, " ").trim().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/i, "").trim();
}
export async function quickCommand(text) {
  const roh = vorbereiten(text);
  const t = roh.toLowerCase();
  if (!t) return null;
  if (OEFFNEN.test(t)) return { answer: "Der Kaufberater ist offen. Welches Produkt soll ich prüfen?", actions: ["kaufberater"] };
  const g = t.match(GERAET);
  if (g && profil(g[1]).length && !/kühlschrank|kuehlschrank|gekauft/.test(g[1]) && /iphone|ipad|mac|echo|alexa|tv|fernseher|playstation|ps5|xbox|switch|galaxy|pixel|airpods|watch|hue|homepod|router|fritz|laptop|pc/i.test(g[1])) {
    const datum = g[2] ? `${g[4].length === 2 ? `20${g[4]}` : g[4]}-${g[3].padStart(2, "0")}-${g[2].padStart(2, "0")}` : "";
    const name = roh.match(new RegExp(g[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))?.[0] || g[1];
    geraetSpeichern({ name, kaufdatum: datum });
    return { answer: `Notiert: ${name} steht jetzt bei deinen Geräten. Der Kaufberater prüft neue Käufe darauf.`, actions: ["kaufberater"] };
  }
  const m = PRUEF.map((re) => t.match(re)).find(Boolean);
  if (m) {
    const produkt = roh.slice(t.indexOf(m[1]), t.indexOf(m[1]) + m[1].length).trim() || m[1].trim();
    if (produkt.length < 3 || /^(ich|es|das|was)$/.test(produkt)) return null;
    const e = await pruefen({ produkt });
    return { answer: `${e.sprech}${e.saetze < 5 ? " Für echte Langzeit-Mängel kopier mir die Bewertungen ins Kaufberater-Fenster." : ""}`, actions: ["kaufberater", `kauf:${e.id}`] };
  }
  return null;
}
