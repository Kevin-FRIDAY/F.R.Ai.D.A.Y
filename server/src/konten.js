// F.R.Ai.D.A.Y Meine Konten (v1.161.0) – Berliner Sparkasse, Revolut und jede andere Bank, NUR LESEN.
//
// Zwei Wege, beide kostenlos:
//  1. Live über Enable Banking (PSD2-Kontoinformationsdienst, von der finnischen Finanzaufsicht zugelassen).
//     Kevin registriert eine eigene "App" bei enablebanking.com, verknüpft seine eigenen Konten
//     (eingeschränkter Modus = kostenlos für private Nutzung) und gibt Friday hier die App-ID + den
//     privaten Schlüssel. Die Anmeldung bei der Bank (pushTAN, Revolut-App) passiert bei der Bank selbst –
//     Friday sieht weder PIN noch Passwort.
//  2. CSV-Datei aus dem Online-Banking (Sparkasse: Umsätze → Export CSV-CAMT; Revolut: Kontoauszug → Excel/CSV).
//
// Feste Grenze: Friday bewegt KEIN Geld. Der Bank-Zugang ist ein reiner Kontoinformations-Zugang (AIS),
// und api() lässt nur die unten aufgezählten Lese-Aufrufe durch. Zahlungs-Endpunkte gibt es hier nicht.
//
// Alles liegt nur auf dem Mac in server/data/konten/ (von Updates ausgenommen, Dateirechte 600).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR, config } from "./config.js";

const DIR = path.join(DATA_DIR, "konten");
const F_ZUGANG = path.join(DIR, "enablebanking.json");
const F_SCHLUESSEL = path.join(DIR, "enablebanking-schluessel.pem");
const F_DATEN = path.join(DIR, "konten.json");
const EB = (process.env.KONTEN_EB_URL || "https://api.enablebanking.com").replace(/\/$/, "");
const TAG = 86400000;
const MAX_ABRUFE_TAG = 4; // die meisten Banken erlauben ~4 Abrufe ohne Anwesenheit pro Tag
const AUTO_ALLE = 6 * 3600000;

const boss = () => config.userName || "Boss";

// ---------- Speicher ----------
function lies(f, leer) {
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return leer; }
}
function schreib(f, d) {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const tmp = `${f}.tmp`;
  fs.writeFileSync(tmp, typeof d === "string" ? d : JSON.stringify(d, null, 1), { mode: 0o600 });
  fs.renameSync(tmp, f);
}
let cache = null;
function daten() {
  if (!cache) {
    cache = lies(F_DATEN, {});
    cache.verbindungen ||= [];
    cache.konten ||= {};
    cache.regeln ||= {}; // Gegenüber → eigene Kategorie
  }
  return cache;
}
function speichern() { schreib(F_DATEN, daten()); }
export function _reset() { cache = null; zustaende.clear(); }

function zugang() {
  const z = lies(F_ZUGANG, null);
  if (!z?.appId) return null;
  let key = "";
  try { key = fs.readFileSync(F_SCHLUESSEL, "utf8"); } catch { /* fehlt */ }
  return key ? { ...z, key } : null;
}

// ---------- Enable Banking (nur lesen) ----------
const ERLAUBT = [
  ["GET", /^\/aspsps(\?.*)?$/],
  ["POST", /^\/auth$/], // Zustimmung NUR für Kontoinformationen (access.valid_until), keine Zahlung
  ["POST", /^\/sessions$/],
  ["GET", /^\/sessions\/[\w-]+$/],
  ["DELETE", /^\/sessions\/[\w-]+$/], // Zugang widerrufen
  ["GET", /^\/accounts\/[\w-]+\/(balances|transactions|details)(\?.*)?$/],
];
export function erlaubt(method, pfad) {
  return ERLAUBT.some(([m, re]) => m === method && re.test(pfad));
}

const b64u = (x) => Buffer.from(x).toString("base64url");
export function jwt(appId, keyPem, jetzt = Date.now()) {
  const iat = Math.floor(jetzt / 1000);
  const kopf = b64u(JSON.stringify({ typ: "JWT", alg: "RS256", kid: appId }));
  const inhalt = b64u(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat, exp: iat + 3600 }));
  const sig = crypto.createSign("RSA-SHA256").update(`${kopf}.${inhalt}`).sign(keyPem).toString("base64url");
  return `${kopf}.${inhalt}.${sig}`;
}

class BankFehler extends Error {
  constructor(text, status, code) { super(text); this.status = status; this.code = code; }
}

async function api(method, pfad, body, z = zugang()) {
  if (!erlaubt(method, pfad)) throw new BankFehler("Friday darf bei der Bank nur lesen. Dieser Aufruf ist gesperrt.", 403, "NUR_LESEN");
  if (!z) throw new BankFehler("Enable Banking ist noch nicht eingerichtet.", 400, "NICHT_EINGERICHTET");
  let res;
  try {
    res = await fetch(EB + pfad, {
      method,
      headers: { Authorization: `Bearer ${jwt(z.appId, z.key)}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(25000),
    });
  } catch (err) {
    throw new BankFehler(`Enable Banking ist gerade nicht erreichbar (${err.message}).`, 502, "NETZ");
  }
  const text = await res.text().catch(() => "");
  let d = {};
  try { d = text ? JSON.parse(text) : {}; } catch { d = { message: text.slice(0, 200) }; }
  if (!res.ok) throw new BankFehler(deutsch(res.status, d), res.status, d.error || d.code || "");
  return d;
}

function deutsch(status, d) {
  const code = String(d.error || d.code || "");
  const msg = String(d.message || d.detail || "").slice(0, 200);
  if (code === "EXPIRED_SESSION" || /expired/i.test(msg)) return "Die Freigabe der Bank ist abgelaufen. Bitte die Bank neu verbinden.";
  if (code === "ASPSP_RATE_LIMIT_EXCEEDED" || status === 429) return "Die Bank erlaubt nur wenige Abrufe am Tag. Friday versucht es in ein paar Stunden wieder.";
  if (status === 401) return "Enable Banking erkennt den Schlüssel nicht. Stimmen App-ID und privater Schlüssel (die .pem-Datei) zusammen?";
  if (status === 403) return "Enable Banking verweigert den Zugriff. Ist die App aktiviert (Konten im Control Panel verknüpft)?";
  if (code === "WRONG_TRANSACTIONS_PERIOD") return "Die Bank liefert für diesen Zeitraum keine Umsätze.";
  return `Enable Banking meldet Fehler ${status}${code ? ` (${code})` : ""}${msg ? `: ${msg}` : ""}.`;
}

export function zugangSpeichern({ appId, schluessel, redirectUrl }) {
  const id = String(appId || "").trim();
  const key = String(schluessel || "").trim();
  const url = String(redirectUrl || "").trim();
  if (!/^[\w-]{8,80}$/.test(id)) return { ok: false, error: "Die App-ID sieht nicht richtig aus (steht im Enable-Banking-Control-Panel unter API applications)." };
  if (!/^https:\/\/[^\s]+\/api\/konten\/rueckruf$/.test(url)) return { ok: false, error: "Die Rückkehr-Adresse muss mit https:// beginnen und auf /api/konten/rueckruf enden (z. B. deine Tailscale-Adresse)." };
  const alt = zugang();
  const neuerKey = key || alt?.key || "";
  if (!neuerKey) return { ok: false, error: "Bitte den privaten Schlüssel (Inhalt der .pem-Datei) einfügen." };
  try {
    const k = crypto.createPrivateKey(neuerKey);
    if (k.asymmetricKeyType !== "rsa") throw new Error("kein RSA");
  } catch {
    return { ok: false, error: "Der private Schlüssel lässt sich nicht lesen. Füge den kompletten Inhalt der .pem-Datei ein (mit -----BEGIN PRIVATE KEY-----)." };
  }
  schreib(F_SCHLUESSEL, neuerKey.endsWith("\n") ? neuerKey : `${neuerKey}\n`);
  schreib(F_ZUGANG, { appId: id, redirectUrl: url, gespeichert: new Date().toISOString() });
  return { ok: true };
}

export async function zugangTesten() {
  const r = await api("GET", "/aspsps?country=DE&psu_type=personal");
  return { ok: true, banken: (r.aspsps || []).length };
}

export function zugangLoeschen() {
  for (const f of [F_ZUGANG, F_SCHLUESSEL]) { try { fs.unlinkSync(f); } catch { /* weg */ } }
}

let bankListe = { zeit: 0, land: "", liste: [] };
export async function banken(land = "DE", suche = "") {
  const L = /^[A-Z]{2}$/.test(land) ? land : "DE";
  if (bankListe.land !== L || Date.now() - bankListe.zeit > TAG) {
    const r = await api("GET", `/aspsps?country=${L}&psu_type=personal`);
    bankListe = { zeit: Date.now(), land: L, liste: (r.aspsps || []).map((a) => ({ name: a.name, land: a.country, logo: a.logo || "", beta: Boolean(a.beta), maxTage: a.maximum_consent_validity ? Math.floor(a.maximum_consent_validity / 86400) : 180 })) };
  }
  const q = flach(suche);
  const l = q ? bankListe.liste.filter((b) => flach(b.name).includes(q)) : bankListe.liste;
  return l.slice(0, 60);
}

// Offene Anmeldungen bei der Bank (state → Bank), 20 Minuten gültig
const zustaende = new Map();

export async function verbinden({ bank, land = "DE", tage }) {
  const z = zugang();
  if (!z) throw new BankFehler("Bitte zuerst Enable Banking einrichten (App-ID + Schlüssel).", 400, "NICHT_EINGERICHTET");
  const liste = await banken(land, "");
  const b = liste.find((x) => x.name === bank) || null;
  if (!b) throw new BankFehler(`„${bank}“ kenne ich bei Enable Banking nicht. Bitte aus der Liste wählen.`, 400, "BANK");
  const dauer = Math.max(1, Math.min(Number(tage) || 180, b.maxTage || 180, 180));
  const state = crypto.randomBytes(18).toString("base64url");
  const r = await api("POST", "/auth", {
    access: { valid_until: new Date(Date.now() + dauer * TAG).toISOString() },
    aspsp: { name: b.name, country: b.land },
    state,
    redirect_url: z.redirectUrl,
    psu_type: "personal",
    language: "de",
  }, z);
  if (!r.url) throw new BankFehler("Enable Banking hat keine Anmelde-Adresse geschickt.", 502, "AUTH");
  for (const [k, v] of zustaende) if (Date.now() - v.zeit > 20 * 60000) zustaende.delete(k);
  zustaende.set(state, { bank: b.name, land: b.land, zeit: Date.now() });
  return { url: r.url };
}

// Die Bank schickt den Browser mit ?code=…&state=… zurück
export async function rueckruf({ code, state, error }) {
  const s = zustaende.get(String(state || ""));
  if (!s) return { ok: false, error: "Diese Anmeldung ist unbekannt oder abgelaufen. Bitte in Friday noch einmal auf „Verbinden“ tippen." };
  zustaende.delete(state);
  if (error) return { ok: false, error: `Die Bank hat die Anmeldung abgebrochen (${String(error).slice(0, 80)}).` };
  if (!/^[\w.~+/=-]{4,600}$/.test(String(code || ""))) return { ok: false, error: "Die Bank hat keinen gültigen Code geschickt." };
  const r = await api("POST", "/sessions", { code });
  const d = daten();
  // eine Bank = eine Verbindung; eine alte Verbindung derselben Bank wird ersetzt
  const alt = d.verbindungen.find((v) => v.bank === s.bank && v.land === s.land);
  const id = alt?.id || `eb-${crypto.randomBytes(5).toString("hex")}`;
  const konten = (r.accounts || []).map((a) => ({
    uid: a.uid,
    iban: a.account_id?.iban || "",
    name: a.name || a.product || a.details || "",
    waehrung: a.currency || "EUR",
  })).filter((a) => a.uid);
  const v = { id, bank: s.bank, land: s.land, sessionId: r.session_id, gueltigBis: r.access?.valid_until || "", verbunden: new Date().toISOString(), konten: konten.map((k) => k.uid), abrufe: [], fehler: "" };
  if (alt) Object.assign(alt, v); else d.verbindungen.push(v);
  for (const k of konten) {
    const kid = `${id}:${k.uid}`;
    d.konten[kid] = { ...(d.konten[kid] || { umsaetze: [] }), id: kid, quelle: "bank", verbindung: id, uid: k.uid, bank: s.bank, iban: k.iban, name: k.name || s.bank, waehrung: k.waehrung };
  }
  speichern();
  aktualisiereVerbindung(v, { erzwingen: true }).catch((err) => console.error("Konten:", err.message));
  return { ok: true, bank: s.bank, anzahl: konten.length };
}

export async function trennen(id) {
  const d = daten();
  const v = d.verbindungen.find((x) => x.id === id);
  if (v) {
    try { await api("DELETE", `/sessions/${v.sessionId}`); } catch { /* lokal trotzdem löschen */ }
    d.verbindungen = d.verbindungen.filter((x) => x.id !== id);
  }
  for (const k of Object.keys(d.konten)) if (k === id || d.konten[k].verbindung === id) delete d.konten[k];
  speichern();
  return { ok: true };
}

const BUCHUNGS_ART = ["CLBD", "ITBD", "OPBD", "PRCD", "INFO"];
const VERFUEGBAR_ART = ["ITAV", "CLAV", "XPCD", "OPAV", "FWAV"];
function waehleSaldo(liste) {
  const nimm = (arten) => { for (const a of arten) { const b = liste.find((x) => x.balance_type === a); if (b) return b; } return null; };
  const geb = nimm(BUCHUNGS_ART) || nimm(VERFUEGBAR_ART) || liste[0] || null;
  const verf = nimm(VERFUEGBAR_ART);
  return {
    saldo: geb ? Number(geb.balance_amount?.amount) : null,
    verfuegbar: verf ? Number(verf.balance_amount?.amount) : null,
    waehrung: geb?.balance_amount?.currency || "",
  };
}

function ausBank(t) {
  const roh = Number(t.transaction_amount?.amount || 0);
  const betrag = t.credit_debit_indicator === "DBIT" ? -Math.abs(roh) : t.credit_debit_indicator === "CRDT" ? Math.abs(roh) : roh;
  const gegen = betrag < 0 ? t.creditor?.name : t.debtor?.name;
  const gegenIban = betrag < 0 ? t.creditor_account?.iban : t.debtor_account?.iban;
  const zweck = (Array.isArray(t.remittance_information) ? t.remittance_information.join(" ") : String(t.remittance_information || "")) || t.bank_transaction_code?.description || t.note || "";
  const datum = String(t.booking_date || t.value_date || t.transaction_date || "").slice(0, 10);
  const u = { datum, betrag: runde(betrag), waehrung: t.transaction_amount?.currency || "EUR", gegenueber: String(gegen || "").trim(), gegenIban: gegenIban || "", zweck: zweck.replace(/\s+/g, " ").trim().slice(0, 300), vorgemerkt: t.status && t.status !== "BOOK" };
  u.id = t.entry_reference || t.transaction_id || fingerabdruck(u);
  return u;
}

export async function aktualisiereVerbindung(v, { erzwingen = false } = {}) {
  const jetzt = Date.now();
  v.abrufe = (v.abrufe || []).filter((t) => jetzt - t < TAG);
  if (v.abrufe.length >= MAX_ABRUFE_TAG && !erzwingen) {
    const frei = new Date(v.abrufe[0] + TAG);
    throw new BankFehler(`Heute sind schon ${MAX_ABRUFE_TAG} Abrufe bei ${v.bank} gelaufen (mehr erlaubt die Bank nicht). Wieder möglich ab ${frei.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr.`, 429, "LIMIT");
  }
  v.abrufe.push(jetzt);
  const d = daten();
  try {
    for (const uid of v.konten) {
      const k = d.konten[`${v.id}:${uid}`];
      if (!k) continue;
      const b = await api("GET", `/accounts/${uid}/balances`);
      const s = waehleSaldo(b.balances || []);
      if (s.saldo != null && Number.isFinite(s.saldo)) { k.saldo = s.saldo; k.verfuegbar = Number.isFinite(s.verfuegbar) ? s.verfuegbar : null; k.saldoDatum = new Date().toISOString(); if (s.waehrung) k.waehrung = s.waehrung; }
      const letzte = (k.umsaetze || []).map((u) => u.datum).sort().pop();
      const von = letzte ? isoTag(new Date(Date.parse(letzte) - 10 * TAG)) : isoTag(new Date(jetzt - 89 * TAG));
      const neu = [];
      let key = "";
      for (let seite = 0; seite < 40; seite++) {
        const q = `date_from=${von}${key ? `&continuation_key=${encodeURIComponent(key)}` : ""}`;
        let r;
        try { r = await api("GET", `/accounts/${uid}/transactions?${q}`); }
        catch (err) { if (err.code === "WRONG_TRANSACTIONS_PERIOD" && !letzte && seite === 0) { r = await api("GET", `/accounts/${uid}/transactions?date_from=${isoTag(new Date(jetzt - 30 * TAG))}`); } else throw err; }
        neu.push(...(r.transactions || []).map(ausBank));
        key = r.continuation_key || "";
        if (!key) break;
      }
      mische(k, neu, { vorgemerkteErsetzen: true });
      k.aktualisiert = new Date().toISOString();
    }
    v.fehler = "";
    v.letzterAbruf = new Date().toISOString();
  } catch (err) {
    v.fehler = err.message;
    if (err.code === "EXPIRED_SESSION" || err.status === 401) v.abgelaufen = true;
    throw err;
  } finally {
    speichern();
  }
  return { ok: true };
}

export async function alleAktualisieren() {
  const ergebnisse = [];
  for (const v of daten().verbindungen) {
    if (v.abgelaufen) { ergebnisse.push({ bank: v.bank, ok: false, error: "Freigabe abgelaufen – bitte neu verbinden." }); continue; }
    try { await aktualisiereVerbindung(v); ergebnisse.push({ bank: v.bank, ok: true }); }
    catch (err) { ergebnisse.push({ bank: v.bank, ok: false, error: err.message }); }
  }
  return ergebnisse;
}

// ---------- CSV-Import (Sparkasse, Revolut, fast jede Bank) ----------
export function csvZeilen(text) {
  const t = String(text || "").replace(/^﻿/, "");
  const kopf = t.split(/\r?\n/, 1)[0] || "";
  const trenner = [";", ",", "\t"].sort((a, b) => kopf.split(b).length - kopf.split(a).length)[0];
  const zeilen = [];
  let feld = "", zeile = [], inQ = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQ) {
      if (c === '"') { if (t[i + 1] === '"') { feld += '"'; i++; } else inQ = false; }
      else feld += c;
    } else if (c === '"') inQ = true;
    else if (c === trenner) { zeile.push(feld); feld = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      zeile.push(feld); feld = "";
      if (zeile.some((x) => x.trim())) zeilen.push(zeile);
      zeile = [];
    } else feld += c;
  }
  zeile.push(feld);
  if (zeile.some((x) => x.trim())) zeilen.push(zeile);
  return zeilen;
}

function zahl(s) {
  let x = String(s ?? "").replace(/[€\s ]/g, "").replace(/EUR|USD|GBP/gi, "");
  if (!x) return NaN;
  if (/,\d{1,2}$/.test(x) || (/,/.test(x) && !/\./.test(x))) x = x.replace(/\./g, "").replace(",", ".");
  else x = x.replace(/,/g, "");
  return Number(x);
}
function datumAus(s) {
  const x = String(s || "").trim();
  let m = x.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = x.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) { const j = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${j}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  m = x.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

const SPALTEN = {
  datum: ["buchungstag", "buchungsdatum", "completed date", "abschlussdatum", "datum abgeschlossen", "started date", "startdatum", "datum", "date", "valutadatum", "wertstellung"],
  betrag: ["betrag", "betrag (eur)", "amount", "umsatz", "betrag in eur"],
  gebuehr: ["fee", "gebuhr", "gebuehr", "gebühr"],
  waehrung: ["waehrung", "wahrung", "währung", "currency"],
  gegenueber: ["beguenstigter/zahlungspflichtiger", "begunstigter/zahlungspflichtiger", "name zahlungsbeteiligter", "empfanger", "empfaenger", "auftraggeber / beguenstigter", "auftraggeber/empfanger", "zahlungsempfanger", "description", "beschreibung", "name"],
  zweck: ["verwendungszweck", "buchungstext", "description", "beschreibung", "reference", "referenz"],
  iban: ["kontonummer/iban", "iban zahlungsbeteiligter", "iban"],
  konto: ["auftragskonto", "kontonummer", "konto"],
  produkt: ["product", "produkt"],
  status: ["state", "status"],
  saldo: ["balance", "saldo", "kontostand"],
  art: ["type", "art", "typ"],
};
const kopfNorm = (s) => String(s || "").toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss").replace(/\s+/g, " ").trim();

export function csvLesen(text, { bank = "" } = {}) {
  const zeilen = csvZeilen(text);
  // Kopfzeile finden (manche Banken schreiben vorher ein paar Infozeilen)
  let ki = zeilen.findIndex((z) => z.map(kopfNorm).some((h) => SPALTEN.betrag.map(kopfNorm).includes(h)));
  if (ki < 0) throw new Error("In der Datei fehlt eine Spalte „Betrag“ bzw. „Amount“. Ist das der Umsatz-Export als CSV?");
  const kopf = zeilen[ki].map(kopfNorm);
  const spalte = (art) => { for (const n of SPALTEN[art].map(kopfNorm)) { const i = kopf.indexOf(n); if (i >= 0) return i; } return -1; };
  const S = Object.fromEntries(Object.keys(SPALTEN).map((k) => [k, spalte(k)]));
  if (S.datum < 0) throw new Error("In der Datei fehlt eine Datums-Spalte (z. B. „Buchungstag“ oder „Completed Date“).");
  const revolut = kopf.includes("product") || kopf.includes("produkt") || /revolut/i.test(bank);
  const konten = new Map();
  let uebersprungen = 0;
  for (const z of zeilen.slice(ki + 1)) {
    const wert = (k) => (S[k] >= 0 ? String(z[S[k]] ?? "").trim() : "");
    const datum = datumAus(wert("datum")) || datumAus(z[spalte("datum")]);
    let betrag = zahl(wert("betrag"));
    if (!datum || !Number.isFinite(betrag)) { uebersprungen++; continue; }
    const st = wert("status");
    if (/revert|declin|fail|abgelehnt|storn|ruckgang|rückgäng|zurückerstattet/i.test(st)) { uebersprungen++; continue; }
    const geb = zahl(wert("gebuehr"));
    if (Number.isFinite(geb) && geb) betrag -= Math.abs(geb);
    const waehrung = (wert("waehrung") || "EUR").toUpperCase().slice(0, 3);
    const produkt = produktName(wert("produkt"));
    const kontoNr = wert("konto").replace(/\s/g, "");
    const schluessel = revolut ? `${produkt || "Konto"}-${waehrung}` : kontoNr || "Konto";
    if (!konten.has(schluessel)) konten.set(schluessel, { iban: /^[A-Z]{2}\d/.test(kontoNr) ? kontoNr : "", name: revolut ? `${produkt || "Konto"} ${waehrung}` : kontoNr ? `Girokonto …${kontoNr.slice(-4)}` : "Konto", waehrung, umsaetze: [], saldo: null, saldoDatum: "" });
    const k = konten.get(schluessel);
    const gegen = wert("gegenueber");
    const zweck = S.zweck >= 0 && S.zweck !== S.gegenueber ? wert("zweck") : (wert("art") || "");
    const u = { datum, betrag: runde(betrag), waehrung, gegenueber: gegen.slice(0, 120), gegenIban: wert("iban").replace(/\s/g, ""), zweck: zweck.replace(/\s+/g, " ").slice(0, 300), vorgemerkt: /pending|ausstehend|vorgemerkt|umsatz vorgemerkt/i.test(st) || /vorgemerkt/i.test(wert("zweck")) };
    u.id = fingerabdruck(u);
    k.umsaetze.push(u);
    const sal = zahl(wert("saldo"));
    if (Number.isFinite(sal) && (!k.saldoDatum || datum >= k.saldoDatum)) { k.saldo = sal; k.saldoDatum = datum; }
  }
  // gleiche Umsätze am selben Tag (z. B. 2× derselbe Kaffee) bekommen eine laufende Nummer
  for (const k of konten.values()) {
    const n = new Map();
    for (const u of k.umsaetze) { const c = (n.get(u.id) || 0) + 1; n.set(u.id, c); if (c > 1) u.id = `${u.id}-${c}`; }
  }
  return { konten: [...konten.values()], uebersprungen };
}

export function csvImport({ text, bank = "Bank", saldo }) {
  const name = String(bank || "Bank").trim().slice(0, 60) || "Bank";
  const r = csvLesen(text, { bank: name });
  if (!r.konten.length || !r.konten.some((k) => k.umsaetze.length)) throw new Error("In der Datei habe ich keine Umsätze gefunden.");
  const d = daten();
  let neu = 0;
  const ergebnis = [];
  for (const k of r.konten) {
    const id = `csv-${slug(name)}-${slug(k.iban || k.name)}`;
    const ziel = d.konten[id] ||= { id, quelle: "csv", bank: name, iban: k.iban, name: k.name, waehrung: k.waehrung, umsaetze: [] };
    neu += mische(ziel, k.umsaetze);
    if (k.saldo != null) { ziel.saldo = k.saldo; ziel.saldoDatum = k.saldoDatum; }
    ziel.aktualisiert = new Date().toISOString();
    ergebnis.push({ id, name: ziel.name, umsaetze: k.umsaetze.length });
  }
  const s = zahl(saldo);
  if (Number.isFinite(s) && r.konten.length === 1) { const z = d.konten[ergebnis[0].id]; z.saldo = s; z.saldoDatum = isoTag(new Date()); }
  speichern();
  return { ok: true, neu, konten: ergebnis, uebersprungen: r.uebersprungen };
}

export function kontoLoeschen(id) {
  const d = daten();
  if (!d.konten[id] || d.konten[id].quelle !== "csv") return { ok: false, error: "Nur importierte Konten lassen sich hier löschen. Bank-Verbindungen bitte über „Trennen“." };
  delete d.konten[id];
  speichern();
  return { ok: true };
}

export function saldoSetzen(id, wert) {
  const d = daten();
  const k = d.konten[id];
  const s = zahl(wert);
  if (!k || k.quelle !== "csv" || !Number.isFinite(s)) return { ok: false, error: "Kontostand nicht gespeichert." };
  k.saldo = s; k.saldoDatum = isoTag(new Date());
  speichern();
  return { ok: true };
}

// ---------- Kategorien ----------
const KATEGORIEN = [
  ["Umbuchung", "🔁", /\b(revolut( bank)?|top-?up|aufladung|umbuchung|ubertrag|übertrag|eigenes konto|sparen|savings|vault|pocket|tagesgeld)\b/],
  ["Gehalt & Einnahmen", "💶", /\b(gehalt|lohn|bezuge|bezüge|kindergeld|familienkasse|rente|erstattung|gutschrift|salary|payroll)\b/],
  ["Miete & Wohnen", "🏠", /\b(miete|mietzahlung|hausverwaltung|wohnungsbau|degewo|gewobag|vonovia|deutsche wohnen|howoge|gesobau|nebenkosten|hausgeld)\b/],
  ["Strom & Energie", "⚡", /\b(vattenfall|e\.?on|eon|enbw|stromio|tibber|octopus|gasag|strom|gas|fernwarme|fernwärme|energie)\b/],
  ["Handy & Internet", "📶", /\b(telekom|vodafone|o2|telefonica|1&1|congstar|freenet|aldi talk|fraenk|kabel|internet|mobilfunk)\b/],
  ["Versicherung", "🛡️", /\b(versicherung|allianz|huk|ergo|axa|debeka|generali|signal iduna|devk|barmer|aok|tk |techniker|krankenkasse)\b/],
  ["Lebensmittel", "🛒", /\b(rewe|edeka|lidl|aldi|netto|penny|kaufland|real|norma|bio company|denns|alnatura|globus|famila|marktkauf|flink|gorillas|getir|picnic|knuspr|supermarkt)\b/],
  ["Drogerie & Gesundheit", "💊", /\b(dm|rossmann|muller|müller drogerie|apotheke|docmorris|shop apotheke|arzt|zahnarzt)\b/],
  ["Essen & Trinken", "🍽️", /\b(restaurant|lieferando|wolt|uber eats|mcdonald|burger king|kfc|starbucks|cafe|café|bäckerei|backerei|baeckerei|pizza|doner|döner|imbiss|bar |kneipe|subway)\b/],
  ["Tanken & Auto", "⛽", /\b(aral|shell|esso|total|jet |star tankstelle|tankstelle|agip|avia|hem |kfz|werkstatt|atu|parken|parkhaus|park now|easypark|adac)\b/],
  ["Bus & Bahn", "🚆", /\b(bvg|s-bahn|db vertrieb|deutsche bahn|db fernverkehr|bahn|flixbus|flixtrain|uber|bolt|free now|taxi|miles|share now|lime|tier|deutschlandticket|vbb)\b/],
  ["Abos & Streaming", "📺", /\b(netflix|spotify|disney|dazn|sky |wow |amazon prime|prime video|apple\.com|itunes|youtube|google storage|google one|icloud|chatgpt|openai|anthropic|claude|playstation|xbox|nintendo|audible|kindle unlimited|rtl\+|joyn|paramount)\b/],
  ["Online-Shopping", "📦", /\b(amazon|amzn|zalando|otto|ebay|temu|shein|aboutyou|about you|mediamarkt|saturn|ikea|h&m|primark|decathlon|paypal)\b/],
  ["Bargeld", "🏧", /\b(geldautomat|bargeld|atm|auszahlung|cash)\b/],
  ["Freizeit & Reisen", "✈️", /\b(hotel|booking\.com|airbnb|lufthansa|ryanair|easyjet|eurowings|kino|cinema|fitness|mcfit|urban sports|ticketmaster|eventim)\b/],
  ["Steuern & Gebühren", "🏛️", /\b(finanzamt|rundfunk|beitragsservice|gez|kontofuhrung|kontoführung|entgelt|gebuhr|gebühr|zinsen)\b/],
];
const SYMBOL = Object.fromEntries(KATEGORIEN.map(([n, s]) => [n, s]));
SYMBOL.Sonstiges = "🔹";
SYMBOL["Sonstige Einnahmen"] = "💰";
export const KATEGORIE_NAMEN = [...KATEGORIEN.map(([n]) => n), "Sonstiges", "Sonstige Einnahmen"];

const gegenKey = (u) => flach(u.gegenueber || u.zweck).replace(/\d+/g, "").trim().slice(0, 40);

export function kategorie(u, eigeneIbans = new Set()) {
  const regel = daten().regeln[gegenKey(u)];
  if (regel) return regel;
  if (u.gegenIban && eigeneIbans.has(u.gegenIban)) return "Umbuchung";
  const t = ` ${flach(`${u.gegenueber} ${u.zweck}`)} `;
  for (const [name, , re] of KATEGORIEN) {
    if (name === "Gehalt & Einnahmen" && u.betrag < 0) continue;
    if (re.test(t)) return name;
  }
  return u.betrag > 0 ? "Sonstige Einnahmen" : "Sonstiges";
}

export function regelSetzen(gegenueber, kat) {
  if (!KATEGORIE_NAMEN.includes(kat)) return { ok: false, error: "Unbekannte Kategorie." };
  const key = gegenKey({ gegenueber });
  if (!key) return { ok: false, error: "Ohne Namen kann ich mir das nicht merken." };
  daten().regeln[key] = kat;
  speichern();
  return { ok: true };
}

// ---------- Auswerten ----------
function alleUmsaetze() {
  const d = daten();
  const eigene = new Set(Object.values(d.konten).map((k) => k.iban).filter(Boolean));
  const liste = [];
  for (const k of Object.values(d.konten)) for (const u of k.umsaetze || []) liste.push({ ...u, konto: k.id, kontoName: `${k.bank} · ${k.name}`, kategorie: kategorie(u, eigene) });
  return liste.sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
}

export function uebersicht() {
  const d = daten();
  const z = lies(F_ZUGANG, null);
  const konten = Object.values(d.konten).map((k) => ({
    id: k.id, quelle: k.quelle, bank: k.bank, name: k.name, iban: k.iban ? maskiere(k.iban) : "", waehrung: k.waehrung,
    saldo: k.saldo ?? null, verfuegbar: k.verfuegbar ?? null, saldoDatum: k.saldoDatum || "", aktualisiert: k.aktualisiert || "",
    umsaetze: (k.umsaetze || []).length, verbindung: k.verbindung || "",
  }));
  const summe = {};
  for (const k of konten) if (k.saldo != null) summe[k.waehrung] = runde((summe[k.waehrung] || 0) + k.saldo);
  const verbindungen = d.verbindungen.map((v) => {
    const tageRest = v.gueltigBis ? Math.ceil((Date.parse(v.gueltigBis) - Date.now()) / TAG) : null;
    return { id: v.id, bank: v.bank, land: v.land, gueltigBis: v.gueltigBis, tageRest, abgelaufen: Boolean(v.abgelaufen) || (tageRest != null && tageRest <= 0), letzterAbruf: v.letzterAbruf || "", fehler: v.fehler || "", abrufeHeute: (v.abrufe || []).filter((t) => Date.now() - t < TAG).length, maxAbrufe: MAX_ABRUFE_TAG };
  });
  return { konten, summe, verbindungen, eingerichtet: Boolean(z?.appId && fs.existsSync(F_SCHLUESSEL)), appId: z?.appId ? `${z.appId.slice(0, 6)}…` : "", redirectUrl: z?.redirectUrl || "", kategorien: KATEGORIE_NAMEN.map((n) => ({ name: n, symbol: SYMBOL[n] })), nurLesen: true };
}

export function umsaetze({ konto = "", q = "", kategorie: kat = "", monat = "", limit = 200 } = {}) {
  const f = flach(q);
  let l = alleUmsaetze();
  if (konto) l = l.filter((u) => u.konto === konto);
  if (kat) l = l.filter((u) => u.kategorie === kat);
  if (/^\d{4}-\d{2}$/.test(monat)) l = l.filter((u) => u.datum.startsWith(monat));
  if (f) l = l.filter((u) => flach(`${u.gegenueber} ${u.zweck} ${u.kategorie}`).includes(f) || String(Math.abs(u.betrag)).includes(f.replace(",", ".")));
  return { umsaetze: l.slice(0, Math.min(Number(limit) || 200, 1000)).map((u) => ({ ...u, symbol: SYMBOL[u.kategorie] || "🔹", gegenIban: u.gegenIban ? maskiere(u.gegenIban) : "" })), gesamt: l.length };
}

export function auswertung(monat = "") {
  const alle = alleUmsaetze().filter((u) => !u.vorgemerkt);
  const m = /^\d{4}-\d{2}$/.test(monat) ? monat : (alle[0]?.datum || isoTag(new Date())).slice(0, 7);
  const vor = vorMonat(m);
  const zaehlt = (u) => u.kategorie !== "Umbuchung";
  const imMonat = alle.filter((u) => u.datum.startsWith(m) && zaehlt(u));
  const imVor = alle.filter((u) => u.datum.startsWith(vor) && zaehlt(u));
  const summe = (l) => runde(l.reduce((s, u) => s + u.betrag, 0));
  const ein = summe(imMonat.filter((u) => u.betrag > 0));
  const aus = -summe(imMonat.filter((u) => u.betrag < 0));
  const proKat = new Map();
  for (const u of imMonat.filter((x) => x.betrag < 0)) proKat.set(u.kategorie, (proKat.get(u.kategorie) || 0) - u.betrag);
  const vorKat = new Map();
  for (const u of imVor.filter((x) => x.betrag < 0)) vorKat.set(u.kategorie, (vorKat.get(u.kategorie) || 0) - u.betrag);
  const kategorien = [...proKat].map(([name, betrag]) => ({ name, symbol: SYMBOL[name] || "🔹", betrag: runde(betrag), anteil: aus ? Math.round((betrag / aus) * 100) : 0, vormonat: runde(vorKat.get(name) || 0) })).sort((a, b) => b.betrag - a.betrag);
  const groesste = imMonat.filter((u) => u.betrag < 0).sort((a, b) => a.betrag - b.betrag).slice(0, 5).map((u) => ({ datum: u.datum, betrag: u.betrag, gegenueber: u.gegenueber || u.zweck.slice(0, 60), kategorie: u.kategorie, symbol: SYMBOL[u.kategorie] || "🔹" }));
  const monate = [...new Set(alle.map((u) => u.datum.slice(0, 7)))].sort().reverse();
  const verlauf = monate.slice(0, 6).reverse().map((mm) => { const l = alle.filter((u) => u.datum.startsWith(mm) && zaehlt(u)); return { monat: mm, ein: summe(l.filter((u) => u.betrag > 0)), aus: -summe(l.filter((u) => u.betrag < 0)) }; });
  return { monat: m, einnahmen: ein, ausgaben: runde(aus), ergebnis: runde(ein - aus), vormonat: { monat: vor, ausgaben: -summe(imVor.filter((u) => u.betrag < 0)), einnahmen: summe(imVor.filter((u) => u.betrag > 0)) }, kategorien, groesste, abos: abos(alle), monate, verlauf };
}

// Regelmäßige Zahlungen: gleicher Empfänger, ähnlicher Betrag, in mindestens 2 der letzten 4 Monate
export function abos(alle = alleUmsaetze().filter((u) => !u.vorgemerkt)) {
  const grenze = isoTag(new Date(Date.now() - 125 * TAG));
  const gruppen = new Map();
  for (const u of alle) {
    if (u.betrag >= 0 || u.datum < grenze || u.kategorie === "Umbuchung" || u.kategorie === "Bargeld" || u.kategorie === "Lebensmittel") continue;
    const k = gegenKey(u);
    if (!k) continue;
    if (!gruppen.has(k)) gruppen.set(k, []);
    gruppen.get(k).push(u);
  }
  const l = [];
  for (const [, us] of gruppen) {
    const monate = new Set(us.map((u) => u.datum.slice(0, 7)));
    if (monate.size < 2) continue;
    const betraege = us.map((u) => -u.betrag).sort((a, b) => a - b);
    const mitte = betraege[Math.floor(betraege.length / 2)];
    if (betraege.some((b) => Math.abs(b - mitte) > Math.max(2, mitte * 0.15))) continue;
    if (us.length > monate.size * 1.5) continue; // mehrmals im Monat = eher Einkauf als Abo
    const letzte = us[0];
    l.push({ name: letzte.gegenueber || letzte.zweck.slice(0, 50), betrag: runde(mitte), kategorie: letzte.kategorie, symbol: SYMBOL[letzte.kategorie] || "🔹", zuletzt: letzte.datum, monate: monate.size });
  }
  return l.sort((a, b) => b.betrag - a.betrag);
}

// ---------- Sprache (ohne Claude) ----------
const eur = (n, w = "EUR") => `${Number(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${w === "EUR" ? "Euro" : w}`;
const MONATSNAME = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const monatsName = (m) => MONATSNAME[Number(m.slice(5, 7)) - 1] || m;

export function quickCommand(text) {
  let t = flach(text).replace(/^(hey |hallo |ok |okay )?(friday|freitag|eve)( |$)/, "").trim();
  if (!t || t.length > 140) return null;
  // Geld bewegen: feste Grenze
  const geldWeg = /^(bitte )?(uberweis|ueberweis|transferier)\w*\b/.test(t) || /\b(uberweisung|ueberweisung|dauerauftrag) (machen|ausfuhren|ausfuehren|anlegen|einrichten|tatigen)\b/.test(t)
    || (/^(bitte )?(schick|send|zahl|bezahl|buch)\w*\b/.test(t) && /\b(\d+([.,]\d+)? ?(euro|eur|€)|geld)\b/.test(t) && !/\b(nachricht|sms|imessage|whatsapp|mail|dass|sag|schreib|foto|bild)\b/.test(t));
  if (geldWeg) {
    return { answer: `Das mache ich bewusst nicht, ${boss()}. Ich darf deine Konten nur ansehen, nie Geld bewegen. Überweisungen machst du bitte selbst in der Sparkassen- oder Revolut-App.`, actions: [] };
  }
  const kontoWort = /\b(konto|konten|kontostand|kontostande|bank|sparkasse|revolut|girokonto|finanzen|guthaben)\b/.test(t);
  const oeffnen = /\b(zeig|zeige|offne|oeffne|öffne)\b.*\b(konten|konto|kontostand|finanzen|umsatze|umsaetze|umsätze|kontoauszug|banking)\b/.test(t);
  const stand = /\b(kontostand|wie viel geld (hab|habe|ist)|wieviel geld (hab|habe|ist)|was ist auf meinem konto|was hab ich auf dem konto|wie viel ist auf|wie steht mein konto|wie sieht mein konto aus)\b/.test(t);
  const ausgaben = /\b(ausgegeben|ausgaben|verbraucht)\b/.test(t) || (/\b(bezahlt|gezahlt)\b/.test(t) && /\b(wie viel|wieviel|was)\b/.test(t) && /\b(ich|monat)\b/.test(t));
  const aboFrage = /\b(abos|abonnements|fixkosten|vertrage|vertraege|daueraufträge|dauerauftrage|regelmassige zahlungen|regelmaessige zahlungen)\b/.test(t) && /\b(welche|zeig|meine|was|wie viel|wieviel|liste)\b/.test(t);
  const einnahmen = /\b(eingenommen|einnahmen|bekommen|gehalt (kam|da|eingegangen))\b/.test(t) && (kontoWort || /\bmonat\b/.test(t));
  if (!oeffnen && !stand && !ausgaben && !aboFrage && !einnahmen) return null;
  if (ausgaben && !kontoWort && !/\b(ich|monat|woche|diesen|letzten|fur|für)\b/.test(t)) return null;
  // Fridays eigene Kosten ("was hast du heute ausgegeben", "was hat Claude gekostet") gehören dem Kontrollraum
  if (!kontoWort && (/\b(claude|friday|du|kosten|gekostet|energie|token)\b/.test(t) || (ausgaben && /\bheute\b/.test(t)))) return null;

  const u = uebersicht();
  if (!u.konten.length) {
    return { answer: `Deine Konten sind noch nicht verbunden, ${boss()}. Ich öffne „Meine Konten“, dort richtest du die Sparkasse und Revolut ein – nur zum Ansehen.`, actions: ["konten:einrichten"] };
  }
  if (stand || (oeffnen && !ausgaben)) {
    const teile = u.konten.filter((k) => k.saldo != null).map((k) => `${k.bank}${u.konten.filter((x) => x.bank === k.bank).length > 1 ? ` ${k.name}` : ""} ${eur(k.saldo, k.waehrung)}`);
    const sum = Object.entries(u.summe).map(([w, n]) => eur(n, w)).join(" und ");
    const alt = u.konten.filter((k) => k.saldoDatum && Date.now() - Date.parse(k.saldoDatum) > 2 * TAG).length;
    if (!teile.length) return { answer: `Für deine Konten habe ich noch keinen Kontostand, ${boss()}. Ich öffne die Übersicht.`, actions: ["konten"] };
    return { answer: `${teile.length > 1 ? `Zusammen hast du ${sum}. ` : ""}${teile.join(", ")}.${alt ? " Ein Teil davon ist älter als zwei Tage." : ""}`, actions: ["konten"] };
  }
  if (aboFrage) {
    const a = abos();
    if (!a.length) return { answer: `Ich finde noch keine regelmäßigen Zahlungen, ${boss()}. Dafür brauche ich Umsätze aus mindestens zwei Monaten.`, actions: ["konten:auswertung"] };
    const sum = runde(a.reduce((s, x) => s + x.betrag, 0));
    return { answer: `Ich sehe ${a.length} regelmäßige Zahlungen, zusammen etwa ${eur(sum)} im Monat. Die größten: ${a.slice(0, 4).map((x) => `${x.name} ${eur(x.betrag)}`).join(", ")}.`, actions: ["konten:auswertung"] };
  }
  const jetztM = isoTag(new Date()).slice(0, 7);
  const monat = /\b(letzten|vorigen|vergangenen) monat\b/.test(t) ? vorMonat(jetztM) : jetztM;
  const a = auswertung(monat);
  if (einnahmen && !ausgaben) return { answer: `Im ${monatsName(monat)} sind ${eur(a.einnahmen)} eingegangen, ausgegeben hast du ${eur(a.ausgaben)}.`, actions: ["konten:auswertung"] };
  // "wie viel für Lebensmittel / Tanken / Netflix"
  const fuer = t.match(/\b(?:fur|für|bei|an) ([a-z0-9äöüß&.\- ]{3,40}?)(?: ausgegeben| bezahlt| gezahlt| diesen| letzten| im| $|$)/);
  if (fuer) {
    const w = fuer[1].trim();
    const katName = KATEGORIEN.find(([n]) => flach(n).includes(w));
    const treffer = katName ? [] : alleUmsaetze().filter((x) => x.datum.startsWith(monat) && x.betrag < 0 && flach(`${x.gegenueber} ${x.zweck}`).includes(w));
    if (treffer.length) return { answer: `Bei ${w} hast du im ${monatsName(monat)} ${treffer.length}-mal bezahlt, zusammen ${eur(-treffer.reduce((s, x) => s + x.betrag, 0))}.`, actions: [`konten:umsaetze:${encodeURIComponent(w)}`] };
    const kat = katName || KATEGORIEN.find(([, , re]) => re.test(` ${w} `));
    if (kat) {
      const k = a.kategorien.find((x) => x.name === kat[0]);
      return { answer: `Für ${kat[0]} hast du im ${monatsName(monat)} ${eur(k?.betrag || 0)} ausgegeben${k?.vormonat ? `, im Monat davor ${eur(k.vormonat)}` : ""}.`, actions: ["konten:auswertung"] };
    }
  }
  const top = a.kategorien.slice(0, 3).map((k) => `${k.name} ${eur(k.betrag)}`).join(", ");
  return { answer: `Im ${monatsName(monat)} hast du ${eur(a.ausgaben)} ausgegeben${a.einnahmen ? ` und ${eur(a.einnahmen)} eingenommen` : ""}.${top ? ` Am meisten: ${top}.` : ""}`, actions: ["konten:auswertung"] };
}

// ---------- Werkzeug für Claude (nur lesen) ----------
export const toolDefinitions = [{
  name: "konten",
  description: "Kevins Bankkonten (Berliner Sparkasse, Revolut …) NUR ANSEHEN: Kontostände, Umsätze suchen, Monats-Auswertung nach Kategorien, regelmäßige Zahlungen/Abos. Friday kann damit KEIN Geld bewegen, nichts überweisen und nichts bezahlen – wer das will, bekommt den Hinweis, es selbst in der Banking-App zu tun. action: stand | umsaetze (q = Suchwort, monat = JJJJ-MM) | auswertung (monat) | abos | oeffnen.",
  input_schema: {
    type: "object",
    properties: { action: { type: "string", enum: ["stand", "umsaetze", "auswertung", "abos", "oeffnen"] }, q: { type: "string" }, monat: { type: "string", description: "JJJJ-MM" } },
    required: ["action"],
  },
}];
export const istKontenTool = (n) => n === "konten";
export function runKontenTool(_name, input = {}) {
  const u = uebersicht();
  if (!u.konten.length) return { info: "Es sind noch keine Konten verbunden. Kevin kann sie im Werkzeug-Menü unter „Meine Konten“ einrichten (nur lesen).", aktion: "konten:einrichten" };
  switch (input.action) {
    case "stand": return { konten: u.konten.map(({ bank, name, saldo, verfuegbar, waehrung, saldoDatum }) => ({ bank, name, saldo, verfuegbar, waehrung, stand: saldoDatum })), summe: u.summe };
    case "umsaetze": { const r = umsaetze({ q: input.q || "", monat: input.monat || "", limit: 40 }); return { gesamt: r.gesamt, umsaetze: r.umsaetze.map(({ datum, betrag, waehrung, gegenueber, zweck, kategorie: k }) => ({ datum, betrag, waehrung, gegenueber, zweck: zweck.slice(0, 80), kategorie: k })) }; }
    case "auswertung": { const a = auswertung(input.monat || ""); return { monat: a.monat, einnahmen: a.einnahmen, ausgaben: a.ausgaben, ergebnis: a.ergebnis, vormonat: a.vormonat, kategorien: a.kategorien, groesste: a.groesste }; }
    case "abos": return { abos: abos() };
    default: return { info: "Ich öffne „Meine Konten“.", aktion: "konten" };
  }
}

// ---------- Routen ----------
const fehlerAntwort = (res, err) => res.status(err.status && err.status >= 400 && err.status < 600 ? err.status : 500).json({ error: err.message });

export function kontenRueckrufRoute(app, asyncRoute) {
  // Öffentlich (die Bank leitet den Browser hierher zurück), aber nur mit dem einmaligen "state" gültig.
  app.get("/api/konten/rueckruf", asyncRoute(async (req, res) => {
    const q = req.query || {};
    let r;
    try { r = await rueckruf({ code: String(q.code || ""), state: String(q.state || ""), error: String(q.error || "") }); }
    catch (err) { r = { ok: false, error: err.message }; }
    const titel = r.ok ? `${r.bank} ist verbunden` : "Das hat nicht geklappt";
    const text = r.ok ? `${r.anzahl} Konto${r.anzahl === 1 ? "" : "en"} gefunden. Friday holt jetzt Kontostand und Umsätze – nur zum Ansehen. Du kannst dieses Fenster schließen.` : r.error;
    const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    res.setHeader("Cache-Control", "no-store");
    res.status(r.ok ? 200 : 400).type("html").send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titel)}</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#050505;color:#f5e9dc;font-family:-apple-system,system-ui,sans-serif">
<div style="max-width:420px;margin:16px;padding:28px;border:1px solid rgba(255,138,30,.45);border-radius:18px;background:rgba(255,138,30,.06);box-shadow:0 0 40px rgba(255,138,30,.18);text-align:center">
<div style="font-size:42px">${r.ok ? "🏦" : "⚠️"}</div><h1 style="color:#ff8a1e;font-size:20px;letter-spacing:.08em">${esc(titel)}</h1><p style="line-height:1.5">${esc(text)}</p>
<p><a href="/?konten=1" style="color:#ff8a1e">Zurück zu Friday</a></p></div></body>`);
  }));
}

export function kontenRouten(app, asyncRoute) {
  app.get("/api/konten", (_req, res) => res.json(uebersicht()));
  app.post("/api/konten/zugang", asyncRoute(async (req, res) => {
    const r = zugangSpeichern(req.body || {});
    if (!r.ok) return res.status(400).json(r);
    try { const t = await zugangTesten(); res.json({ ok: true, banken: t.banken }); }
    catch (err) { res.status(err.status === 502 ? 502 : 400).json({ ok: false, gespeichert: true, error: err.message }); }
  }));
  app.delete("/api/konten/zugang", (_req, res) => { zugangLoeschen(); res.json({ ok: true }); });
  app.get("/api/konten/banken", asyncRoute(async (req, res) => {
    try { res.json({ banken: await banken(String(req.query.land || "DE").toUpperCase(), String(req.query.q || "")) }); }
    catch (err) { fehlerAntwort(res, err); }
  }));
  app.post("/api/konten/verbinden", asyncRoute(async (req, res) => {
    try { res.json(await verbinden(req.body || {})); } catch (err) { fehlerAntwort(res, err); }
  }));
  app.post("/api/konten/trennen", asyncRoute(async (req, res) => res.json(await trennen(String(req.body?.id || "")))));
  app.post("/api/konten/aktualisieren", asyncRoute(async (_req, res) => {
    const ergebnisse = await alleAktualisieren();
    res.json({ ergebnisse, ...uebersicht() });
  }));
  app.post("/api/konten/import", (req, res) => {
    try { res.json(csvImport(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post("/api/konten/konto/loeschen", (req, res) => { const r = kontoLoeschen(String(req.body?.id || "")); res.status(r.ok ? 200 : 400).json(r); });
  app.post("/api/konten/konto/saldo", (req, res) => { const r = saldoSetzen(String(req.body?.id || ""), req.body?.saldo); res.status(r.ok ? 200 : 400).json(r); });
  app.get("/api/konten/umsaetze", (req, res) => res.json(umsaetze({ konto: String(req.query.konto || ""), q: String(req.query.q || ""), kategorie: String(req.query.kategorie || ""), monat: String(req.query.monat || ""), limit: req.query.limit })));
  app.get("/api/konten/auswertung", (req, res) => res.json(auswertung(String(req.query.monat || ""))));
  app.post("/api/konten/kategorie", (req, res) => { const r = regelSetzen(String(req.body?.gegenueber || ""), String(req.body?.kategorie || "")); res.status(r.ok ? 200 : 400).json(r); });
}

let takt = null;
export function kontenStart() {
  if (takt) return;
  // alle 6 Stunden frische Kontostände (die Bank erlaubt ~4 Abrufe am Tag)
  takt = setInterval(() => {
    for (const v of daten().verbindungen) {
      if (v.abgelaufen) continue;
      if (v.letzterAbruf && Date.now() - Date.parse(v.letzterAbruf) < AUTO_ALLE - 60000) continue;
      aktualisiereVerbindung(v).catch((err) => console.error(`Konten (${v.bank}):`, err.message));
    }
  }, 30 * 60000);
  takt.unref?.();
}

// Revolut schreibt den Kontotyp je nach App-Sprache anders ("Current" / "Aktuell")
function produktName(p) {
  const x = flach(p);
  if (!x) return "";
  if (/^(current|aktuell|laufend|girokonto|hauptkonto)/.test(x)) return "Hauptkonto";
  if (/(saving|spar|tagesgeld|vault|pocket|deposit|einlage)/.test(x)) return "Sparkonto";
  return String(p).trim().slice(0, 30);
}

// ---------- kleine Helfer ----------
function flach(s) {
  return String(s || "").toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss").replace(/[^a-z0-9&.+\- ]/g, " ").replace(/\s+/g, " ").trim();
}
const runde = (n) => Math.round(Number(n) * 100) / 100;
const isoTag = (d) => d.toISOString().slice(0, 10);
const slug = (s) => flach(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "konto";
const maskiere = (iban) => (iban.length > 8 ? `${iban.slice(0, 4)} •••• ${iban.slice(-4)}` : iban);
function vorMonat(m) { const [j, mo] = m.split("-").map(Number); return mo === 1 ? `${j - 1}-12` : `${j}-${String(mo - 1).padStart(2, "0")}`; }
function fingerabdruck(u) { return crypto.createHash("sha1").update(`${u.datum}|${u.betrag}|${u.gegenueber}|${u.zweck}`).digest("hex").slice(0, 16); }
function mische(konto, neu, { vorgemerkteErsetzen = false } = {}) {
  const alt = konto.umsaetze || [];
  const neueIds = new Set(neu.map((u) => u.id));
  const behalten = vorgemerkteErsetzen ? alt.filter((u) => !u.vorgemerkt || neueIds.has(u.id)) : alt;
  const map = new Map(behalten.map((u) => [u.id, u]));
  let n = 0;
  for (const u of neu) { if (!map.has(u.id)) n++; map.set(u.id, u); }
  konto.umsaetze = [...map.values()].sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0)).slice(0, 5000);
  return n;
}
