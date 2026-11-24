// Paket-Verfolgung (v1.160.0, Wunsch aus der Ideen-Schmiede).
// Sendungsnummer sagen oder eintragen ("Friday, verfolge Paket 00340434…"), Friday fragt den Status
// bei DHL ab (kostenloser Entwickler-Schlüssel "Shipment Tracking – Unified", developer.dhl.com) und meldet
// sich per Telegram, wenn sich etwas ändert oder das Paket heute kommt. Ohne Schlüssel merkt sich Friday
// die Nummer trotzdem und zeigt den Verfolgungs-Link. Schlüssel: Fenster Wunschliste → Pakete
// (data/verbindungen.json, Eintrag "dhl") oder .env DHL_API_KEY. Er wird nie ans Dashboard geschickt.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import * as verb from "./verbindungen.js";
import { IST_EVE } from "./config.js";
import { U } from "./datum.js";
import { holen, neueId, sauber, datumLang, tagStr } from "./wunsch-hilfe.js";

const DATEI = "pakete";
const API = () => String(process.env.DHL_API || "https://api-eu.dhl.com").replace(/\/$/, "");
const schluessel = () => String(verb.get("dhl").key || process.env.DHL_API_KEY || "").trim();
export const eingerichtet = () => Boolean(schluessel());
export function schluesselSetzen(key) {
  const k = String(key || "").trim();
  if (k && !/^[A-Za-z0-9_-]{16,80}$/.test(k)) throw new Error("Das sieht nicht wie ein DHL-API-Key aus (Buchstaben/Zahlen, 16–80 Zeichen).");
  verb.set("dhl", { key: k || undefined });
  return eingerichtet();
}

/** Welcher Paketdienst? Nur grob, für den Link. */
export function dienstVon(nr) {
  const n = String(nr).toUpperCase();
  if (/^1Z[0-9A-Z]{16}$/.test(n)) return "UPS";
  if (/^(H\d{19}|\d{16})$/.test(n)) return "Hermes";
  if (/^\d{14}$/.test(n)) return "DPD";
  if (/^\d{11,12}$/.test(n) && !/^00/.test(n)) return "GLS";
  return "DHL";
}
export function link(nr) {
  const n = encodeURIComponent(nr);
  return {
    DHL: `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${n}`,
    Hermes: `https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation/#${n}`,
    DPD: `https://tracking.dpd.de/status/de_DE/parcel/${n}`,
    GLS: `https://www.gls-pakete.de/sendungsverfolgung?match=${n}`,
    UPS: `https://www.ups.com/track?loc=de_DE&tracknum=${n}`,
  }[dienstVon(nr)];
}

export const liste = () => store.load(DATEI, []);
const speichern = (l) => store.save(DATEI, l.slice(-60));

export function dazu({ nummer, name = "" } = {}) {
  const nr = String(nummer || "").replace(/[\s-]/g, "").toUpperCase();
  if (!/^[0-9A-Z]{8,35}$/.test(nr)) throw new Error("Das ist keine gültige Sendungsnummer (8–35 Buchstaben/Ziffern).");
  const l = liste();
  let e = l.find((x) => x.nummer === nr);
  if (!e) {
    e = { id: neueId(), nummer: nr, name: String(name || "").slice(0, 60) || `Paket ${nr.slice(-4)}`, dienst: dienstVon(nr), at: new Date().toISOString(), status: null, verlauf: [] };
    l.push(e);
    logbuch.eintragen({ bereich: "paket", titel: `Paket wird verfolgt: ${e.name}`, details: nr });
  } else if (name) e.name = String(name).slice(0, 60);
  speichern(l);
  return e;
}
export function weg(id) { speichern(liste().filter((x) => x.id !== id)); return true; }

/** Fragt DHL nach einem Paket und speichert den Stand. */
export async function abfragen(id) {
  const l = liste();
  const e = l.find((x) => x.id === id || x.nummer === id);
  if (!e) throw new Error("Paket nicht gefunden.");
  if (e.dienst !== "DHL") return { ...e, hinweis: `${e.dienst}-Pakete kann Friday nur per Link zeigen.`, link: link(e.nummer) };
  const key = schluessel();
  if (!key) return { ...e, hinweis: "Für Live-Status fehlt der kostenlose DHL-Schlüssel.", link: link(e.nummer) };
  const d = await holen(`${API()}/track/shipments?trackingNumber=${encodeURIComponent(e.nummer)}&language=de`, { headers: { "DHL-API-Key": key, Accept: "application/json" } });
  const s = d.shipments?.[0];
  if (!s) throw new Error("DHL kennt diese Nummer (noch) nicht.");
  const st = s.status || {};
  const neu = {
    code: st.statusCode || "unknown",
    text: st.description || st.status || "unbekannt",
    ort: st.location?.address?.addressLocality || "",
    zeit: st.timestamp || null,
    ankunft: s.estimatedTimeOfDelivery || s.estimatedDeliveryTimeFrame?.estimatedFrom || null,
  };
  const geaendert = !e.status || e.status.text !== neu.text || e.status.code !== neu.code;
  e.status = neu;
  e.geprueft = new Date().toISOString();
  e.verlauf = (s.events || []).slice(0, 12).map((x) => ({ zeit: x.timestamp, text: x.description || x.status, ort: x.location?.address?.addressLocality || "" }));
  speichern(l);
  return { ...e, geaendert, link: link(e.nummer) };
}

export function satz(e) {
  if (!e.status) return `${e.name}: noch kein Status${e.hinweis ? `. ${e.hinweis}` : ""}`;
  const s = e.status;
  if (s.code === "delivered") return `${e.name} ist zugestellt.`;
  const heute = s.ankunft && s.ankunft.slice(0, 10) === tagStr();
  const ank = s.ankunft ? (heute ? " Es kommt heute." : ` Voraussichtlich am ${datumLang(s.ankunft)}.`) : "";
  return `${e.name}: ${String(s.text).replace(/[.!\s]+$/, "")}${s.ort ? ` (${s.ort})` : ""}.${ank}`;
}

/** Alle 2 Stunden: offene DHL-Pakete prüfen, Änderungen melden. */
export async function pruefen(melde) {
  if (IST_EVE || !eingerichtet()) return;
  for (const e of liste().filter((x) => x.dienst === "DHL" && x.status?.code !== "delivered")) {
    try {
      const r = await abfragen(e.id);
      if (r.geaendert && r.status) {
        logbuch.eintragen({ bereich: "paket", titel: `Paket: ${satz(r)}` });
        await melde("📦 Paket-Update", satz(r));
      }
    } catch { /* nächstes Mal */ }
  }
  // Zugestellte nach 14 Tagen aufräumen
  const grenze = Date.now() - 14 * 864e5;
  speichern(liste().filter((x) => !(x.status?.code === "delivered" && Date.parse(x.geprueft || x.at) < grenze)));
}

const VERFOLGE = U(/\b(?:verfolge|verfolg|tracke|track|merk dir|speicher)(?: mir| mal)?(?: das| mein| die)? (?:paket|sendung|sendungsnummer|lieferung)(?:snummer)?[: ]+([0-9a-z][0-9a-z \-]{7,40})$/);
const WO = U(/\b(wo ist|wo bleibt|wann kommt|kommt heute|status) (mein|meine|das|die)? ?(paket|pakete|sendung|sendungen|lieferung|lieferungen)\b|\bmeine pakete\b/);
export async function quickCommand(text) {
  const { k } = sauber(text);
  const m = k.match(VERFOLGE);
  if (m) {
    try {
      const e = dazu({ nummer: m[1] });
      let r = e;
      try { r = await abfragen(e.id); } catch { /* Status später */ }
      return { answer: `Okay, ich verfolge ${e.dienst === "DHL" ? "das DHL-Paket" : `das ${e.dienst}-Paket`}. ${r.status ? satz(r) : eingerichtet() || e.dienst !== "DHL" ? "Noch kein Status." : "Für den Live-Status trag bitte noch den kostenlosen DHL-Schlüssel ein."}`, actions: ["wunsch:pakete"] };
    } catch (err) { return { answer: err.message, actions: [] }; }
  }
  if (!WO.test(k)) return null;
  const l = liste().filter((x) => x.status?.code !== "delivered");
  if (!l.length) return { answer: "Ich verfolge gerade kein offenes Paket. Sag zum Beispiel: Friday, verfolge Paket und dann die Sendungsnummer.", actions: ["wunsch:pakete"] };
  const saetze = [];
  for (const e of l.slice(0, 4)) {
    try { saetze.push(satz(await abfragen(e.id))); } catch (err) { saetze.push(`${e.name}: gerade kein Status (${err.message}).`); }
  }
  return { answer: saetze.join(" "), actions: ["wunsch:pakete"] };
}
