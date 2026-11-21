// Fridays Regelwerk (v1.135.0, Idee aus Conway-Research/automaton, MIT-Lizenz – in Node nachgebaut).
// Bevor Friday ein Werkzeug benutzt, prüft eine feste Regel-Liste: erlaubt oder verboten?
// Jede Entscheidung wird gespeichert (server/data/regelwerk.json) und ist im Kontrollraum zu sehen.
// "Boss fragen" macht NICHT dieses Modul, sondern die Freigabe-Glocke in kommando.js (läuft danach).
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";
import { NUR_LESEN, KRITISCH } from "./kommando.js";
import { pruefeText } from "./waechter.js";

const NAME = "regelwerk";

// Risiko-Stufen wie bei Automaton: sicher, vorsicht, gefährlich. "Verboten" entscheidet eine Regel.
export const STUFEN = {
  sicher: { text: "Sicher", farbe: "gut", info: "Liest nur oder legt etwas Harmloses an." },
  vorsicht: { text: "Vorsicht", farbe: "warn", info: "Ändert etwas bei Friday selbst (Listen, Gedächtnis, Dokumente)." },
  gefaehrlich: { text: "Gefährlich", farbe: "schlecht", info: "Wirkt nach außen: Geräte, Nachrichten, Mac, Updates." },
};
export function stufeVon(name) {
  if (NUR_LESEN.has(name)) return "sicher";
  if (KRITISCH.has(name)) return "gefaehrlich";
  return "vorsicht";
}

// Höchstens so oft pro Stunde (gefährliche Werkzeuge). Schützt vor durchdrehenden Schleifen.
const STUNDEN_GRENZE = {
  anrufe: 10, send_push: 20, mac: 60, update: 2, forget: 10, sort_mail: 6, run_protocol: 20, smart_home: 60, alexa: 40,
  fernseher: 60, hue: 80, video_schnitt: 6, webseite_bauen: 6, werkstatt: 10,
};
const STANDARD_GRENZE = 120; // alle anderen Werkzeuge
const GEFAEHRLICH_PRO_AUFTRAG = 6; // pro Frage an Friday

// Geschützte Dateien: Schlüssel, Passwörter, Fridays eigene Grenzen.
const GESCHUETZT = /(^|[\/\\\s"'])\.env\b|verbindungen\.json|github\.json|alexa\.json|auth\.json|passwor[dt]\.json|id_rsa|\.ssh\b|keychain|schlüsselbund|schluesselbund/i;
// Kevins feste Grenze: Friday bewegt kein echtes Geld und hat kein eigenes Konto/Wallet.
const GELD = /(?<![\wäöüß])(?:überweis\w*|ueberweis\w*|bezahl\w*|zahl\w*|schick\w*|send\w*)\b.{0,40}(?:\d+(?:[.,]\d+)? ?(?:€|euro|eur|dollar|usd|\$|btc|eth|usdc))|\b(?:paypal|klarna|apple ?pay|kreditkarten?nummer|iban:? ?[a-z]{2}\d{2})\b|\b(?:krypto-?|bitcoin-?|eth-?)?wallet (?:anleg|erstell|einricht|öffn|aufladen)\w*|\b(?:bitcoin|krypto\w*|usdc|eth)\b.{0,20}(?:send|schick|überweis|kauf)\w*/i;
// Text-Werkzeuge (Nachricht an die Frau, Notiz, Dokument) dürfen über Geld REDEN – sie bewegen keins.
const NUR_TEXT = new Set(["anrufe", "send_push", "remember", "dokument_erstellen", "fragebogen_erstellen", "add_task", "add_shopping", "set_reminder", "notion", "todoist", "kalender", "seele_notiz", "faehigkeit_erstellen", "ablauf_speichern"]);
const SELBSTZERSTOERUNG = /\brm\s+-rf\b|\bsudo\s+rm\b|\bmkfs\b|lösch\w* (?:alles|alle dateien|den mac|die festplatte)|format\w* (?:die )?festplatte|\bkillall\b|launchctl\s+(?:unload|remove)/i;

// Regeln, die Kevin im Kontrollraum an- und ausschalten kann. "geld" und "pfade" sind immer an.
export const REGELN = [
  { id: "geld", name: "Kein echtes Geld", text: "Überweisen, bezahlen, Wallets, Krypto verschicken: immer verboten (feste Grenze).", fest: true },
  { id: "pfade", name: "Geheime Dateien schützen", text: "Nichts mit .env, Schlüsseln, Passwörtern oder Verbindungs-Daten.", fest: true },
  { id: "zerstoerung", name: "Nichts zerstören", text: "Befehle wie 'alles löschen', 'rm -rf', Festplatte formatieren: verboten.", fest: true },
  { id: "manipulation", name: "Manipulation erkennen", text: "Steckt in einer gefährlichen Aktion ein versteckter Befehl (Prompt-Injection), wird sie gestoppt." },
  { id: "tempo", name: "Tempo-Grenze", text: "Gefährliche Werkzeuge nur begrenzt oft pro Stunde (z. B. höchstens 10 Anrufe)." },
  { id: "auftrag", name: "Pro Auftrag begrenzt", text: `Höchstens ${GEFAEHRLICH_PRO_AUFTRAG} gefährliche Aktionen pro Frage an Friday.` },
  { id: "eingaben", name: "Eingaben prüfen", text: "Zu lange Texte, kaputte Links und leere 'vergiss'-Befehle werden abgelehnt." },
];

function laden() {
  const d = store.load(NAME, {});
  return { aus: [], entscheidungen: [], zaehler: { erlaubt: 0, verboten: 0 }, ...d };
}
function speichern(d) {
  d.entscheidungen = d.entscheidungen.slice(-400);
  store.save(NAME, d);
}

const stunde = new Map(); // Werkzeug → Zeitstempel der letzten Stunde
const proAuftrag = new Map(); // auftragId → Anzahl gefährlicher Aktionen

function texteAus(input) {
  const teile = [];
  const lauf = (v, tiefe = 0) => {
    if (tiefe > 4 || teile.length > 60) return;
    if (typeof v === "string") teile.push(v);
    else if (Array.isArray(v)) v.forEach((x) => lauf(x, tiefe + 1));
    else if (v && typeof v === "object") Object.values(v).forEach((x) => lauf(x, tiefe + 1));
  };
  lauf(input);
  return teile.join("\n");
}

/**
 * Prüft einen Werkzeug-Aufruf.
 * @param {string} name
 * @param {object} input
 * @param {{quelle?:string, kanal?:string, auftrag?:string}} wer
 * @returns {{erlaubt:boolean, stufe:string, regel?:string, grund?:string}}
 */
export function pruefe(name, input = {}, wer = {}) {
  const d = laden();
  const an = (id) => REGELN.find((r) => r.id === id)?.fest || !d.aus.includes(id);
  const stufe = stufeVon(name);
  const text = texteAus(input);
  let urteil = null;
  const nein = (regel, grund) => { urteil = { erlaubt: false, stufe, regel, grund }; };

  if (an("geld") && GELD.test(text) && !NUR_TEXT.has(name) && stufe !== "sicher") {
    nein("geld", "Friday bewegt kein echtes Geld (feste Grenze von Boss).");
  } else if (an("pfade") && GESCHUETZT.test(text)) {
    nein("pfade", "Das betrifft geheime Dateien (Schlüssel, Passwörter, Verbindungen). Da geht Friday nicht ran.");
  } else if (an("zerstoerung") && SELBSTZERSTOERUNG.test(text)) {
    nein("zerstoerung", "Das würde Daten oder Friday selbst zerstören.");
  } else if (an("eingaben") && text.length > 30000) {
    nein("eingaben", "Die Eingabe ist viel zu lang.");
  } else if (an("eingaben") && name === "forget" && String(input.query || "").replace(/[\s*.?%]/g, "").length < 3) {
    nein("eingaben", "'Vergiss' braucht einen genauen Begriff, sonst wäre alles weg.");
  } else if (an("eingaben") && name === "mac" && input.action === "open_url" && input.value && !/^https?:\/\//i.test(String(input.value).trim())) {
    nein("eingaben", "Links nur mit http:// oder https://.");
  } else if (an("manipulation") && stufe === "gefaehrlich" && pruefeText(text).stufe === "gefahr") {
    nein("manipulation", "In der Aktion steckt ein verdächtiger versteckter Befehl.");
  }

  if (!urteil && stufe === "gefaehrlich" && an("tempo")) {
    const jetzt = Date.now();
    const liste = (stunde.get(name) || []).filter((t) => jetzt - t < 3600_000);
    const grenze = STUNDEN_GRENZE[name] ?? STANDARD_GRENZE;
    if (liste.length >= grenze) nein("tempo", `${name} wurde in der letzten Stunde schon ${liste.length}-mal benutzt (Grenze ${grenze}).`);
    else { liste.push(jetzt); stunde.set(name, liste); }
  }
  if (!urteil && stufe === "gefaehrlich" && an("auftrag") && wer.auftrag) {
    const n = (proAuftrag.get(wer.auftrag) || 0) + 1;
    proAuftrag.set(wer.auftrag, n);
    if (proAuftrag.size > 200) proAuftrag.delete(proAuftrag.keys().next().value);
    if (n > GEFAEHRLICH_PRO_AUFTRAG) nein("auftrag", `Schon ${GEFAEHRLICH_PRO_AUFTRAG} gefährliche Aktionen in diesem Auftrag.`);
  }
  if (!urteil) urteil = { erlaubt: true, stufe };

  // Nur gefährliche oder verbotene Aufrufe dauerhaft festhalten (sonst wird die Liste zu lang).
  if (!urteil.erlaubt || stufe !== "sicher") {
    d.entscheidungen.push({ zeit: new Date().toISOString(), werkzeug: name, stufe, erlaubt: urteil.erlaubt, ...(urteil.regel ? { regel: urteil.regel, grund: urteil.grund } : {}), quelle: wer.quelle || "", kanal: wer.kanal || "", eingabe: text.slice(0, 160) });
  }
  d.zaehler[urteil.erlaubt ? "erlaubt" : "verboten"]++;
  speichern(d);
  if (!urteil.erlaubt) eintragen({ bereich: "system", titel: `Regelwerk hat ${name} gestoppt`, details: urteil.grund, quelle: wer.quelle || "", kanal: wer.kanal || "", ok: false });
  return urteil;
}

export function uebersicht() {
  const d = laden();
  const heute = new Date().toISOString().slice(0, 10);
  const heuteListe = d.entscheidungen.filter((e) => e.zeit.startsWith(heute));
  return {
    regeln: REGELN.map((r) => ({ ...r, an: r.fest || !d.aus.includes(r.id) })),
    stufen: STUFEN,
    zaehler: d.zaehler,
    heute: { geprueft: heuteListe.length, gestoppt: heuteListe.filter((e) => !e.erlaubt).length },
    entscheidungen: d.entscheidungen.slice(-80).reverse(),
    grenzen: STUNDEN_GRENZE,
  };
}

export function schalteRegel(id, an) {
  const r = REGELN.find((x) => x.id === id);
  if (!r) return { error: "Diese Regel gibt es nicht." };
  if (r.fest) return { error: "Diese Regel ist eine feste Grenze und bleibt immer an." };
  const d = laden();
  d.aus = d.aus.filter((x) => x !== id);
  if (!an) d.aus.push(id);
  speichern(d);
  eintragen({ bereich: "system", titel: `Regel ${an ? "an" : "aus"}: ${r.name}`, quelle: "dashboard" });
  return uebersicht();
}
