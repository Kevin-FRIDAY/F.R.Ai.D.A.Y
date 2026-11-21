// Dauer-Wächter (v1.134.0, Idee aus OpenJarvis "Scheduled Monitor"):
// Friday beobachtet ein Thema über Tage und meldet sich per Telegram (und Push), sobald sich etwas tut.
//   krypto      – Bitcoin & Co. über/unter einem Preis oder starke Bewegung
//   waehrung    – Wechselkurs über/unter einem Wert (z. B. Euro → Dollar)
//   nachrichten – neue Schlagzeilen zu einem Land oder Thema (Google News)
//   webseite    – eine Webseite ändert sich (optional: ein bestimmtes Wort taucht auf oder verschwindet)
//   wetter      – morgen Regen, Frost, Hitze, Schnee oder Gewitter in deiner Stadt
// Alles kostenlos und ohne Claude. Gespeichert in server/data/dauerwaechter.json.
import crypto from "node:crypto";
import { config } from "./config.js";
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";
import { notifyAll } from "./notify.js";
import { getCrypto, getExchange } from "./extras.js";
import { findCountry } from "./lagezentrum.js";
import { notfallAktiv } from "./kommando.js";

const NAME = "dauerwaechter";
const MAX = 30;
const UA = { "User-Agent": "Mozilla/5.0 F.R.Ai.D.A.Y" };
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const ARTEN = {
  krypto: { icon: "₿", name: "Krypto-Preis", intervall: 15 },
  waehrung: { icon: "💱", name: "Wechselkurs", intervall: 60 },
  nachrichten: { icon: "📰", name: "Nachrichten", intervall: 30 },
  webseite: { icon: "🌐", name: "Webseite", intervall: 60 },
  wetter: { icon: "🌦", name: "Wetter morgen", intervall: 180 },
};
export const WETTER = { regen: "Regen", frost: "Frost", hitze: "Hitze (ab 30 Grad)", schnee: "Schnee", gewitter: "Gewitter" };
const COINS = { bitcoin: "Bitcoin", btc: "Bitcoin", ethereum: "Ethereum", eth: "Ethereum", solana: "Solana", sol: "Solana", xrp: "XRP", ripple: "XRP", dogecoin: "Dogecoin", doge: "Dogecoin", cardano: "Cardano", ada: "Cardano", litecoin: "Litecoin", ltc: "Litecoin" };
const COIN_ID = { Bitcoin: "bitcoin", Ethereum: "ethereum", Solana: "solana", XRP: "ripple", Dogecoin: "dogecoin", Cardano: "cardano", Litecoin: "litecoin" };

function daten() {
  const d = store.load(NAME, {});
  return { liste: Array.isArray(d.liste) ? d.liste : [], ereignisse: Array.isArray(d.ereignisse) ? d.ereignisse : [] };
}
function sichern(d) {
  d.ereignisse = d.ereignisse.slice(-200);
  store.save(NAME, d);
}
const zahl = (v) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/\s|€|\$|euro|dollar/gi, "");
  // 80.000 / 80.000,50 / 1,08 / 80000
  const n = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s.replace(",", ".");
  return Number(n);
};
const deZahl = (n, stellen = 2) => (Number.isFinite(n) ? n.toLocaleString("de-DE", { maximumFractionDigits: stellen }) : "?");

// ---------- Anlegen, prüfen, löschen ----------
function name(w) {
  const z = w.ziel || {};
  if (w.art === "krypto") return z.bedingung === "bewegung" ? `${z.coinName}: Bewegung ab ${deZahl(z.wert)} %` : `${z.coinName} ${z.bedingung === "unter" ? "unter" : "über"} ${deZahl(z.wert)} ${z.waehrung.toUpperCase()}`;
  if (w.art === "waehrung") return `${z.von} → ${z.nach} ${z.bedingung === "unter" ? "unter" : "über"} ${deZahl(z.wert, 4)}`;
  if (w.art === "nachrichten") return `Nachrichten: ${z.suche}`;
  if (w.art === "webseite") return `Webseite: ${z.host}${z.suchwort ? ` („${z.suchwort}“)` : ""}`;
  if (w.art === "wetter") return `${WETTER[z.bedingung]} morgen in ${z.ort}`;
  return w.art;
}

function privateAdresse(host) {
  const h = String(host || "").toLowerCase();
  return h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1|\[::1\])/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /\.ts\.net$/.test(h);
}

/** Prüft die Eingabe und baut daraus einen Wächter. */
export function baue(eingabe = {}) {
  const art = String(eingabe.art || "");
  if (!ARTEN[art]) return { error: `Unbekannte Art. Möglich: ${Object.keys(ARTEN).join(", ")}.` };
  const ziel = {};
  if (art === "krypto") {
    const coinName = COINS[String(eingabe.coin || "bitcoin").toLowerCase()] || null;
    if (!coinName) return { error: "Diese Kryptowährung kenne ich nicht. Möglich: Bitcoin, Ethereum, Solana, XRP, Dogecoin, Cardano, Litecoin." };
    const bedingung = ["unter", "ueber", "bewegung"].includes(eingabe.bedingung) ? eingabe.bedingung : "unter";
    const wert = zahl(eingabe.wert);
    if (!(wert > 0)) return { error: bedingung === "bewegung" ? "Ab wie viel Prozent Bewegung soll ich melden?" : "Bei welchem Preis soll ich mich melden?" };
    Object.assign(ziel, { coin: COIN_ID[coinName], coinName, bedingung, wert, waehrung: /usd|dollar/i.test(String(eingabe.waehrung || "")) ? "usd" : "eur" });
  } else if (art === "waehrung") {
    const von = String(eingabe.von || "EUR").toUpperCase().slice(0, 3), nach = String(eingabe.nach || "USD").toUpperCase().slice(0, 3);
    const wert = zahl(eingabe.wert);
    if (!(wert > 0) || !/^[A-Z]{3}$/.test(von) || !/^[A-Z]{3}$/.test(nach)) return { error: "Welcher Kurs und bei welchem Wert? Zum Beispiel: Euro zu Dollar über 1,15." };
    Object.assign(ziel, { von, nach, bedingung: eingabe.bedingung === "unter" ? "unter" : "ueber", wert });
  } else if (art === "nachrichten") {
    let suche = String(eingabe.suche || eingabe.thema || "").trim().slice(0, 80);
    const land = findCountry(suche);
    if (land) suche = land.name;
    if (suche.length < 2) return { error: "Welches Land oder Thema soll ich beobachten?" };
    const filter = (Array.isArray(eingabe.filter) ? eingabe.filter : String(eingabe.filter || "").split(/[,;]/)).map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 8);
    Object.assign(ziel, { suche, land: land?.id || null, filter });
  } else if (art === "webseite") {
    let url;
    try { url = new URL(String(eingabe.url || "").trim()); } catch { return { error: "Das ist keine gültige Internetadresse." }; }
    if (!/^https?:$/.test(url.protocol)) return { error: "Nur Adressen mit http oder https." };
    if (privateAdresse(url.hostname)) return { error: "Adressen aus dem eigenen Netz beobachte ich nicht, nur öffentliche Webseiten." };
    Object.assign(ziel, { url: url.href, host: url.hostname.replace(/^www\./, ""), suchwort: String(eingabe.suchwort || "").trim().slice(0, 60) });
  } else if (art === "wetter") {
    const bedingung = WETTER[eingabe.bedingung] ? eingabe.bedingung : "regen";
    Object.assign(ziel, { bedingung, ort: String(eingabe.ort || config.city || "Berlin").trim().slice(0, 60) });
  }
  const minuten = Number(eingabe.intervall_min);
  const w = {
    id: neueId(),
    art,
    ziel,
    an: true,
    intervall_min: Number.isFinite(minuten) && minuten >= 5 ? Math.min(1440, Math.round(minuten)) : ARTEN[art].intervall,
    erstellt: new Date().toISOString(),
    zuletzt: null,
    meldungen: 0,
    status: "Wartet auf die erste Prüfung",
    zustand: {},
  };
  w.name = String(eingabe.name || "").trim().slice(0, 80) || name(w);
  return { ok: true, waechter: w };
}

export function anlegen(eingabe) {
  const b = baue(eingabe);
  if (b.error) return b;
  const d = daten();
  if (d.liste.length >= MAX) return { error: `Es laufen schon ${MAX} Wächter. Lösch erst einen alten.` };
  const gleich = d.liste.find((w) => w.art === b.waechter.art && JSON.stringify(w.ziel) === JSON.stringify(b.waechter.ziel));
  if (gleich) { gleich.an = true; sichern(d); return { ok: true, waechter: gleich, schon: true }; }
  d.liste.push(b.waechter);
  sichern(d);
  eintragen({ bereich: "waechter", titel: `Dauer-Wächter angelegt: ${b.waechter.name}`, details: `alle ${b.waechter.intervall_min} Minuten`, quelle: eingabe.quelle || "" });
  // Gleich einmal prüfen, damit der Ausgangswert feststeht (Nachrichten von vorher melden wir nicht).
  setTimeout(() => pruefe(b.waechter.id).catch(() => {}), 1500);
  return { ok: true, waechter: b.waechter };
}

export function liste() {
  const d = daten();
  return { liste: d.liste, ereignisse: d.ereignisse.slice(-40).reverse(), arten: ARTEN, wetter: WETTER, telegram: Boolean(config.telegramToken && config.telegramChatId), ntfy: Boolean(config.ntfyTopic), notfall: notfallAktiv() };
}

export function aendern(id, felder = {}) {
  const d = daten();
  const w = d.liste.find((x) => x.id === id);
  if (!w) return { error: "Diesen Wächter gibt es nicht mehr." };
  if (typeof felder.an === "boolean") w.an = felder.an;
  if (Number(felder.intervall_min) >= 5) w.intervall_min = Math.min(1440, Math.round(Number(felder.intervall_min)));
  if (typeof felder.name === "string" && felder.name.trim()) w.name = felder.name.trim().slice(0, 80);
  sichern(d);
  return { ok: true, waechter: w };
}

export function loeschen(id) {
  const d = daten();
  const w = d.liste.find((x) => x.id === id);
  if (!w) return { error: "Diesen Wächter gibt es nicht mehr." };
  d.liste = d.liste.filter((x) => x.id !== id);
  sichern(d);
  eintragen({ bereich: "waechter", titel: `Dauer-Wächter gelöscht: ${w.name}` });
  return { ok: true, name: w.name };
}

/** Findet Wächter zu einem Stichwort ("bitcoin", "taiwan"). */
export function finde(stichwort) {
  const s = String(stichwort || "").toLowerCase().trim();
  if (!s) return [];
  return daten().liste.filter((w) => w.name.toLowerCase().includes(s) || JSON.stringify(w.ziel).toLowerCase().includes(s));
}

// ---------- Prüfen ----------
async function nachrichtenHolen(suche) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(suche)}+when:2d&hl=de&gl=DE&ceid=DE:de`;
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Google News antwortet mit ${r.status}`);
  const xml = await r.text();
  const dec = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const get = (tag) => dec(m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] || "");
    const source = get("source");
    let title = get("title");
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -source.length - 3);
    items.push({ title, source, link: get("link"), key: crypto.createHash("sha1").update(title.toLowerCase()).digest("hex").slice(0, 12) });
  }
  return items;
}

function seitenText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|section|article)>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split("\n").map((z) => z.replace(/\s+/g, " ").trim()).filter((z) => z.length > 2)
    // Uhrzeiten, Zähler und Datumsangaben ändern sich ständig – die zählen nicht als Änderung.
    .filter((z) => !/^[\d\s:.,/-]+$/.test(z));
}

/** Prüft einen Wächter. Liefert { meldung?: {titel, text}, status } */
async function pruefeEinen(w) {
  const z = w.ziel, st = w.zustand || (w.zustand = {});
  if (w.art === "krypto") {
    const r = await getCrypto(z.coin, z.waehrung);
    if (r.error) throw new Error(r.error);
    const p = Number(r.preis);
    const preisText = `${deZahl(p)} ${z.waehrung === "usd" ? "Dollar" : "Euro"}`;
    w.wert = preisText;
    if (z.bedingung === "bewegung") {
      if (!st.basis) { st.basis = p; return { status: `Aktuell ${preisText}` }; }
      const proz = ((p - st.basis) / st.basis) * 100;
      if (Math.abs(proz) >= z.wert) {
        st.basis = p;
        return { status: `Aktuell ${preisText}`, meldung: { titel: `${z.coinName} ${proz > 0 ? "steigt" : "fällt"} stark`, text: `${z.coinName} hat sich um ${deZahl(proz, 1)} Prozent bewegt und steht jetzt bei ${preisText}.` } };
      }
      return { status: `Aktuell ${preisText} (${proz >= 0 ? "+" : ""}${deZahl(proz, 1)} % seit letzter Meldung)` };
    }
    const erfuellt = z.bedingung === "unter" ? p < z.wert : p > z.wert;
    const vorher = st.erfuellt;
    st.erfuellt = erfuellt;
    // Nur beim Überschreiten melden (nicht jede Viertelstunde, solange es so bleibt).
    if (erfuellt && vorher === false) {
      return { status: `Aktuell ${preisText}`, meldung: { titel: `${z.coinName} ${z.bedingung === "unter" ? "unter" : "über"} ${deZahl(z.wert)}`, text: `${z.coinName} steht jetzt bei ${preisText}, also ${z.bedingung === "unter" ? "unter" : "über"} deiner Marke von ${deZahl(z.wert)}.` } };
    }
    if (erfuellt && vorher === undefined) {
      return { status: `Aktuell ${preisText} – schon ${z.bedingung === "unter" ? "unter" : "über"} der Marke`, meldung: { titel: `${z.coinName}: Marke schon erreicht`, text: `${z.coinName} steht schon jetzt bei ${preisText}. Ich melde mich wieder, wenn er die Marke erneut überschreitet.` } };
    }
    return { status: `Aktuell ${preisText}` };
  }
  if (w.art === "waehrung") {
    const r = await getExchange(1, z.von, z.nach);
    if (r.error) throw new Error(r.error);
    const k = Number(r.kurs);
    w.wert = `1 ${z.von} = ${deZahl(k, 4)} ${z.nach}`;
    const erfuellt = z.bedingung === "unter" ? k < z.wert : k > z.wert;
    const vorher = st.erfuellt;
    st.erfuellt = erfuellt;
    if (erfuellt && vorher !== true) return { status: w.wert, meldung: { titel: `Kurs ${z.von}/${z.nach} ${z.bedingung === "unter" ? "unter" : "über"} ${deZahl(z.wert, 4)}`, text: `Ein ${z.von} kostet jetzt ${deZahl(k, 4)} ${z.nach}.` } };
    return { status: w.wert };
  }
  if (w.art === "nachrichten") {
    const items = await nachrichtenHolen(z.suche);
    const gesehen = new Set(st.gesehen || []);
    const erstesMal = !st.gesehen;
    const neu = items.filter((n) => !gesehen.has(n.key) && (!z.filter?.length || z.filter.some((f) => n.title.toLowerCase().includes(f))));
    st.gesehen = [...new Set([...items.map((n) => n.key), ...(st.gesehen || [])])].slice(0, 400);
    w.wert = `${items.length} Meldungen in 2 Tagen`;
    if (erstesMal || !neu.length) return { status: erstesMal ? `Beobachte ab jetzt (${items.length} bekannte Meldungen)` : `Nichts Neues (${items.length} Meldungen in 2 Tagen)` };
    const top = neu.slice(0, 3);
    return {
      status: `${neu.length} neue Meldung${neu.length === 1 ? "" : "en"}`,
      meldung: { titel: `Neues zu ${z.suche}`, text: top.map((n) => `• ${n.title}${n.source ? ` (${n.source})` : ""}`).join("\n") + (neu.length > 3 ? `\n… und ${neu.length - 3} weitere` : ""), links: top.map((n) => n.link).filter(Boolean) },
    };
  }
  if (w.art === "webseite") {
    const r = await fetch(z.url, { headers: { ...UA, Accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`Die Seite antwortet mit ${r.status}`);
    const html = (await r.text()).slice(0, 3_000_000);
    const zeilen = seitenText(html);
    const hash = crypto.createHash("sha1").update(zeilen.join("\n")).digest("hex");
    w.wert = `${zeilen.length} Textzeilen`;
    if (z.suchwort) {
      const da = zeilen.some((l) => l.toLowerCase().includes(z.suchwort.toLowerCase()));
      const vorher = st.da;
      st.da = da;
      w.wert = da ? `„${z.suchwort}“ steht drauf` : `„${z.suchwort}“ steht nicht drauf`;
      if (vorher !== undefined && vorher !== da) return { status: w.wert, meldung: { titel: `${z.host}: „${z.suchwort}“ ${da ? "ist aufgetaucht" : "ist verschwunden"}`, text: `Auf ${z.url} ${da ? "steht jetzt" : "steht nicht mehr"} „${z.suchwort}“.` } };
      return { status: w.wert };
    }
    const alt = new Set(st.zeilen || []);
    const vorher = st.hash;
    st.hash = hash;
    st.zeilen = zeilen.slice(0, 600);
    if (!vorher) return { status: "Beobachte ab jetzt" };
    if (vorher === hash) return { status: "Unverändert" };
    const neu = zeilen.filter((l) => !alt.has(l)).slice(0, 4);
    if (!neu.length) return { status: "Nur Kleinigkeiten geändert" };
    return { status: "Geändert", meldung: { titel: `${z.host} hat sich geändert`, text: `Neu auf der Seite:\n${neu.map((l) => `• ${l.slice(0, 160)}`).join("\n")}\n${z.url}` } };
  }
  if (w.art === "wetter") {
    const { getWeather } = await import("./tools.js");
    const wd = await getWeather(z.ort);
    if (wd?.error) throw new Error(wd.error);
    const morgen = wd.tage?.[1];
    if (!morgen) throw new Error("Keine Vorhersage für morgen");
    const txt = String(morgen.wetter || "").toLowerCase();
    const trifft = {
      regen: (morgen.regen_prozent ?? 0) >= 60 || /regen|schauer|niesel/.test(txt),
      frost: morgen.min != null && morgen.min <= 0,
      hitze: morgen.max != null && morgen.max >= 30,
      schnee: /schnee/.test(txt),
      gewitter: /gewitter/.test(txt),
    }[z.bedingung];
    w.wert = `Morgen ${morgen.wetter}, ${Math.round(morgen.min)} bis ${Math.round(morgen.max)} Grad${morgen.regen_prozent != null ? `, Regen ${morgen.regen_prozent} %` : ""}`;
    if (trifft && st.gemeldetFuer !== morgen.tag) {
      st.gemeldetFuer = morgen.tag;
      return { status: w.wert, meldung: { titel: `${WETTER[z.bedingung]} morgen in ${wd.ort || z.ort}`, text: `Für morgen ist ${morgen.wetter} angesagt, ${Math.round(morgen.min)} bis ${Math.round(morgen.max)} Grad${morgen.regen_prozent != null ? ` und ${morgen.regen_prozent} Prozent Regenrisiko` : ""}.` } };
    }
    return { status: w.wert };
  }
  return { status: "?" };
}

const laufend = new Set();
/** Prüft einen Wächter jetzt und speichert das Ergebnis. */
export async function pruefe(id, { vonHand = false } = {}) {
  if (laufend.has(id)) return { error: "Läuft gerade schon." };
  laufend.add(id);
  try {
    let d = daten();
    const w = d.liste.find((x) => x.id === id);
    if (!w) return { error: "Diesen Wächter gibt es nicht mehr." };
    let ergebnis;
    try {
      ergebnis = await pruefeEinen(w);
      w.fehler = 0;
      w.status = ergebnis.status;
    } catch (err) {
      w.fehler = (w.fehler || 0) + 1;
      w.status = `Fehler: ${String(err.message || err).slice(0, 140)}`;
      ergebnis = {};
    }
    w.zuletzt = new Date().toISOString();
    // Andere Änderungen in der Zwischenzeit (z. B. ausgeschaltet) nicht überschreiben: frisch laden und nur diesen Wächter ersetzen.
    d = daten();
    const i = d.liste.findIndex((x) => x.id === id);
    if (i < 0) return { error: "Der Wächter wurde gerade gelöscht." };
    w.an = d.liste[i].an;
    w.name = d.liste[i].name;
    w.intervall_min = d.liste[i].intervall_min;
    if (ergebnis.meldung) {
      w.meldungen = (w.meldungen || 0) + 1;
      w.letzte_meldung = new Date().toISOString();
      d.ereignisse.push({ id: neueId(), waechter: w.id, name: w.name, art: w.art, titel: ergebnis.meldung.titel, text: ergebnis.meldung.text, at: w.letzte_meldung });
    }
    d.liste[i] = w;
    sichern(d);
    if (ergebnis.meldung) {
      eintragen({ bereich: "waechter", titel: `🔭 ${ergebnis.meldung.titel}`, details: ergebnis.meldung.text, quelle: "automatisch" });
      const gesendet = await notifyAll(`🔭 ${ergebnis.meldung.titel}`, ergebnis.meldung.text).catch(() => false);
      for (const fn of zuhoerer) { try { fn(ergebnis.meldung, w); } catch { /* egal */ } }
      return { ok: true, waechter: w, meldung: ergebnis.meldung, gesendet };
    }
    return { ok: true, waechter: w, vonHand };
  } finally {
    laufend.delete(id);
  }
}

const zuhoerer = new Set();
export function beiMeldung(fn) { zuhoerer.add(fn); }

let takt = null;
export function waechterStart() {
  if (takt) return;
  // Jede Minute schauen, welcher Wächter dran ist. Höchstens drei gleichzeitig.
  takt = setInterval(async () => {
    if (notfallAktiv()) return;
    const jetzt = Date.now();
    const faellig = daten().liste.filter((w) => w.an && !laufend.has(w.id) && (!w.zuletzt || jetzt - new Date(w.zuletzt).getTime() >= w.intervall_min * 60000 * (w.fehler >= 3 ? 4 : 1)));
    for (const w of faellig.slice(0, 3)) pruefe(w.id).catch((err) => console.error("Dauer-Wächter:", err.message));
  }, 60000);
  takt.unref?.();
}

// ---------- Sprache (ohne Claude) ----------
const norm = (t) => String(t || "").replace(/[!?]/g, " ").replace(/\s+/g, " ").trim().replace(/^(hey |hallo |ok |okay )?friday[, ]+/i, "");

/** Versteht "Beobachte …"-Sätze. Gibt eine Eingabe für anlegen() zurück oder null. */
export function verstehe(text) {
  const roh = norm(text);
  const t = roh.toLowerCase();
  // Wetter: "sag mir, wenn es morgen regnet", "warn mich, wenn es morgen Frost gibt"
  const wm = t.match(/^(sag|melde|warne?|schreib)( mir| mich| dich)?( bescheid)?,? (wenn|falls|sobald) (es )?morgen (in ([a-zäöüß -]+?) )?(regnet|regen gibt|frost gibt|friert|schneit|gewitter gibt|ein gewitter gibt|heiß wird|heiss wird|über 30 grad (hat|gibt|sind))/);
  if (wm) {
    const was = wm[8];
    const bedingung = /regn|regen/.test(was) ? "regen" : /frost|frier/.test(was) ? "frost" : /schnee|schneit/.test(was) ? "schnee" : /gewitter/.test(was) ? "gewitter" : "hitze";
    return { art: "wetter", bedingung, ort: wm[7] ? wm[7].trim().replace(/^./, (c) => c.toUpperCase()) : config.city };
  }
  if (!/^(beobachte|überwache|ueberwache|behalte|behalt|achte auf|pass auf|halte ein auge auf|wache über)\b/.test(t)) return null;
  const rest = t.replace(/^(beobachte|überwache|ueberwache|behalte|behalt|achte auf|pass auf|halte ein auge auf|wache über)\s*(für mich\s*)?/, "").replace(/\s*im (auge|blick)\b/, "");
  // Webseite
  const url = roh.match(/https?:\/\/\S+/)?.[0];
  if (url) {
    const sw = roh.match(/(?:wenn|ob|sobald) (?:dort |da |darauf )?[„"']?([^„"']+?)[“"']? (?:steht|auftaucht|erscheint|verschwindet|drauf steht)/i);
    return { art: "webseite", url: url.replace(/[.,)]+$/, ""), suchwort: sw ? sw[1].trim() : "" };
  }
  // Krypto
  const coin = Object.keys(COINS).find((c) => new RegExp(`\\b${c}`, "i").test(rest));
  if (coin) {
    const prozent = rest.match(/(\d+(?:[.,]\d+)?)\s*(%|prozent)/);
    if (prozent) return { art: "krypto", coin, bedingung: "bewegung", wert: zahl(prozent[1]) };
    const wert = rest.match(/(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(k|tausend)?/);
    const unter = /\b(unter|fällt|faellt|sinkt|weniger als|billiger als)\b/.test(rest);
    const ueber = /\b(über|ueber|steigt|mehr als|teurer als)\b/.test(rest);
    if (wert) {
      let n = zahl(wert[1]);
      if (wert[2]) n *= 1000;
      return { art: "krypto", coin, bedingung: unter && !ueber ? "unter" : ueber && !unter ? "ueber" : "unter", wert: n, waehrung: /dollar|usd/.test(rest) ? "usd" : "eur" };
    }
    return { art: "krypto", coin, bedingung: "bewegung", wert: 5 };
  }
  // Wechselkurs: "beobachte den Euro-Dollar-Kurs über 1,15"
  const wk = rest.match(/(euro|dollar|pfund|franken|yen)[- ]?(zu[- ]|in[- ]|\/)?(dollar|euro|pfund|franken|yen)[- ]?(kurs)?/);
  if (wk) {
    const C = { euro: "EUR", dollar: "USD", pfund: "GBP", franken: "CHF", yen: "JPY" };
    const wert = rest.match(/(\d+(?:[.,]\d+)?)/);
    return { art: "waehrung", von: C[wk[1]], nach: C[wk[3]], bedingung: /\b(unter|fällt|sinkt)\b/.test(rest) ? "unter" : "ueber", wert: wert ? zahl(wert[1]) : NaN };
  }
  // Nachrichten zu Land oder Thema: "die Lage in Taiwan", "die Nachrichten über Tesla", "das Thema Bahnstreik"
  const thema = rest
    .replace(/^(die |das |den |der )?(lage|nachrichten|news|meldungen|schlagzeilen|situation|entwicklung|thema)( in| zu| über| ueber| um| von| aus| zum| zur)?\s*/, "")
    .replace(/\s*(und )?(sag|melde|schreib|gib)( mir| dich)?.*$/, "")
    .replace(/^(die |das |den |der )/, "")
    .trim();
  if (thema.length >= 2 && thema.length <= 60) return { art: "nachrichten", suche: roh.slice(roh.toLowerCase().indexOf(thema), roh.toLowerCase().indexOf(thema) + thema.length) || thema };
  return null;
}

function bestaetigung(r) {
  const w = r.waechter;
  const wie = config.telegramToken && config.telegramChatId ? "per Telegram" : config.ntfyTopic ? "per Mitteilung aufs Handy" : "im Logbuch und im Dashboard (Telegram ist noch nicht eingerichtet)";
  if (r.schon) return `Den Wächter „${w.name}“ gibt es schon, Boss. Er läuft weiter.`;
  const takt = w.intervall_min >= 60 ? `${w.intervall_min / 60 === 1 ? "jede Stunde" : `alle ${deZahl(w.intervall_min / 60, 1)} Stunden`}` : `alle ${w.intervall_min} Minuten`;
  return `Erledigt, Boss. Der Dauer-Wächter „${w.name}“ läuft ab jetzt und prüft ${takt}. Sobald sich etwas tut, melde ich mich ${wie}.`;
}

export async function quickCommand(text) {
  const t = norm(text).toLowerCase().replace(/[.,]/g, "");
  if (/^((öffne|zeig)( mir)? )?(die |meine )?(dauer[- ]?wächter|dauerwaechter|wächter liste|beobachtungen)( öffnen)?$|^(was|welche wächter) (beobachtest|überwachst|laufen) (du|gerade)?/.test(t) || /^was beobachtest du( gerade)?$/.test(t)) {
    const l = daten().liste.filter((w) => w.an);
    const ans = l.length ? `Ich beobachte gerade ${l.length === 1 ? "eine Sache" : `${l.length} Dinge`}: ${l.slice(0, 5).map((w) => w.name).join(", ")}${l.length > 5 ? " und mehr" : ""}.` : "Gerade beobachte ich nichts. Sag zum Beispiel: Beobachte den Bitcoin-Preis und sag mir, wenn er unter 80.000 Euro fällt.";
    return { answer: ans, actions: ["dauerwaechter"] };
  }
  const stopp = t.match(/^(stopp(e)?|lösche|loesche|beende|entferne|hör auf mit|hoer auf mit)( den| die| das)? (dauer[- ]?)?(wächter|beobachtung|waechter)( für| zu| von| über)? (.+)$/) || t.match(/^(hör|hoer) auf (.+?) zu beobachten$/);
  if (stopp) {
    const stichwort = (stopp[7] || stopp[2] || "").replace(/^(den |die |das )/, "").trim();
    const treffer = finde(stichwort);
    if (!treffer.length) return { answer: `Einen Wächter zu „${stichwort}“ finde ich nicht.`, actions: ["dauerwaechter"] };
    for (const w of treffer) loeschen(w.id);
    return { answer: treffer.length === 1 ? `Erledigt, „${treffer[0].name}“ beobachte ich nicht mehr.` : `Erledigt, ${treffer.length} Wächter zu „${stichwort}“ sind gelöscht.`, actions: ["dauerwaechter"] };
  }
  const eingabe = verstehe(text);
  if (!eingabe) return null;
  const r = anlegen({ ...eingabe, quelle: "sprache" });
  if (r.error) return { answer: r.error, actions: ["dauerwaechter"] };
  return { answer: bestaetigung(r), actions: ["dauerwaechter"] };
}

// ---------- Claude-Werkzeug ----------
export const toolDefinition = {
  name: "dauer_waechter",
  description: "Dauer-Wächter: Friday beobachtet etwas über Tage und meldet sich per Telegram, sobald sich etwas tut. Arten: krypto (coin, bedingung unter|ueber|bewegung, wert = Preis oder Prozent, waehrung eur|usd), waehrung (von, nach als ISO-Code, bedingung unter|ueber, wert), nachrichten (suche = Land oder Thema, optional filter = Stichwörter), webseite (url, optional suchwort), wetter (bedingung regen|frost|hitze|schnee|gewitter, ort). aktion=liste zeigt alle, aktion=loeschen mit stichwort entfernt. Benutze es für 'beobachte …', 'sag mir Bescheid, wenn …', 'halte mich auf dem Laufenden über …'.",
  input_schema: {
    type: "object",
    properties: {
      aktion: { type: "string", enum: ["anlegen", "liste", "loeschen"] },
      art: { type: "string", enum: Object.keys(ARTEN) },
      coin: { type: "string" }, bedingung: { type: "string" }, wert: { type: "number" }, waehrung: { type: "string" },
      von: { type: "string" }, nach: { type: "string" },
      suche: { type: "string" }, filter: { type: "array", items: { type: "string" } },
      url: { type: "string" }, suchwort: { type: "string" },
      ort: { type: "string" },
      intervall_min: { type: "number", description: "Wie oft prüfen (Minuten, mindestens 5)" },
      stichwort: { type: "string", description: "Zum Löschen: Name oder Stichwort des Wächters" },
    },
    required: ["aktion"],
  },
};

export async function runTool(input = {}) {
  if (input.aktion === "liste") return { waechter: daten().liste.map((w) => ({ name: w.name, an: w.an, status: w.status, zuletzt: w.zuletzt, meldungen: w.meldungen })) };
  if (input.aktion === "loeschen") {
    const t = finde(input.stichwort || input.suche || input.coin || "");
    if (!t.length) return { error: "Keinen passenden Wächter gefunden." };
    for (const w of t) loeschen(w.id);
    return { geloescht: t.map((w) => w.name) };
  }
  const r = anlegen({ ...input, quelle: "claude" });
  if (r.error) return { error: r.error };
  return { angelegt: r.waechter.name, schon_vorhanden: Boolean(r.schon), intervall_min: r.waechter.intervall_min, meldet_per: config.telegramToken && config.telegramChatId ? "Telegram" : config.ntfyTopic ? "Handy-Mitteilung" : "nur Dashboard/Logbuch (Telegram fehlt)" };
}

export function waechterRouten(app, asyncRoute) {
  app.get("/api/dauerwaechter", (req, res) => res.json(liste()));
  app.post("/api/dauerwaechter", (req, res) => {
    const r = anlegen({ ...(req.body || {}), quelle: "dashboard" });
    if (r.error) return res.status(400).json(r);
    res.json({ ...liste(), neu: r.waechter.id });
  });
  app.post("/api/dauerwaechter/verstehen", (req, res) => {
    const e = verstehe(String(req.body?.text || ""));
    if (!e) return res.status(400).json({ error: "Das habe ich nicht verstanden. Beispiel: Beobachte Bitcoin unter 80.000 Euro." });
    const r = anlegen({ ...e, quelle: "dashboard" });
    if (r.error) return res.status(400).json(r);
    res.json({ ...liste(), neu: r.waechter.id, text: bestaetigung(r) });
  });
  app.post("/api/dauerwaechter/:id", (req, res) => {
    const r = aendern(req.params.id, req.body || {});
    if (r.error) return res.status(404).json(r);
    res.json(liste());
  });
  app.post("/api/dauerwaechter/:id/pruefen", asyncRoute(async (req, res) => {
    const r = await pruefe(req.params.id, { vonHand: true });
    if (r.error) return res.status(400).json(r);
    res.json({ ...liste(), meldung: r.meldung || null });
  }));
  app.delete("/api/dauerwaechter/:id", (req, res) => {
    const r = loeschen(req.params.id);
    if (r.error) return res.status(404).json(r);
    res.json(liste());
  });
}
