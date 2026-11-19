// Carlas Lern-Archiv (v1.109.0): Alle Lernunterlagen an einem Ort, dauerhaft.
// - Jedes gescannte Foto landet automatisch hier (mit erkanntem Text), auch wenn keine Karten daraus wurden.
// - Carla kann eigene Dateien ablegen (PDF, Fotos, Word, Text …) und Notizen schreiben.
// - Ordner nach Fach, Suche im Titel und im Text, Favoriten, Papierkorb mit Zurückholen.
// Nichts davon braucht Claude. Daten: data/lernen-archiv.json + data/lernen-unterlagen/ (Fotos: data/lernen-bilder/).
// Alles liegt in server/data und ist damit in jeder Friday-Sicherung enthalten.
import fs from "node:fs";
import path from "node:path";
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { DATA_DIR } from "./config.js";

const DATEI = "lernen-archiv";
const ORDNER = path.join(DATA_DIR, "lernen-unterlagen");
const BILDER = path.join(DATA_DIR, "lernen-bilder");
const MAX_BYTES = 8.5 * 1024 * 1024; // passt in die 12-MB-Grenze der Anfrage (Base64)

// Nur diese Arten zeigt die Lernecke direkt an. Alles andere gibt es nur zum Herunterladen.
export const ARTEN = {
  pdf: { mime: "application/pdf", icon: "📕", zeigen: "pdf" },
  jpg: { mime: "image/jpeg", icon: "🖼", zeigen: "bild" }, jpeg: { mime: "image/jpeg", icon: "🖼", zeigen: "bild" },
  png: { mime: "image/png", icon: "🖼", zeigen: "bild" }, webp: { mime: "image/webp", icon: "🖼", zeigen: "bild" },
  gif: { mime: "image/gif", icon: "🖼", zeigen: "bild" }, heic: { mime: "image/heic", icon: "🖼", zeigen: "bild" },
  txt: { mime: "text/plain", icon: "📄", zeigen: "text" }, md: { mime: "text/plain", icon: "📄", zeigen: "text" },
  csv: { mime: "text/plain", icon: "📄", zeigen: "text" },
  doc: { mime: "application/msword", icon: "📘" }, docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", icon: "📘" },
  pages: { mime: "application/octet-stream", icon: "📘" }, odt: { mime: "application/vnd.oasis.opendocument.text", icon: "📘" }, rtf: { mime: "application/rtf", icon: "📘" },
  ppt: { mime: "application/vnd.ms-powerpoint", icon: "📙" }, pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", icon: "📙" }, key: { mime: "application/octet-stream", icon: "📙" },
  xls: { mime: "application/vnd.ms-excel", icon: "📗" }, xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", icon: "📗" }, numbers: { mime: "application/octet-stream", icon: "📗" },
  mp3: { mime: "audio/mpeg", icon: "🎧", zeigen: "audio" }, m4a: { mime: "audio/mp4", icon: "🎧", zeigen: "audio" }, wav: { mime: "audio/wav", icon: "🎧", zeigen: "audio" },
};

const leer = { unterlagen: [], uebernommen: false };
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const kurz = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const sicher = (id) => String(id || "").replace(/[^a-z0-9]/gi, "");
const endung = (name) => (String(name || "").toLowerCase().match(/\.([a-z0-9]{1,8})$/) || [])[1] || "";
const jetzt = () => new Date().toISOString();

function laden() {
  const d = { ...structuredClone(leer), ...store.load(DATEI, leer) };
  if (!Array.isArray(d.unterlagen)) d.unterlagen = [];
  if (!d.uebernommen) uebernehmen(d);
  return d;
}
const speichern = (d) => store.save(DATEI, d);

// Einmalig: Fotos, die vor dem Archiv gescannt wurden, aus den Stapeln übernehmen.
function uebernehmen(d) {
  d.uebernommen = true;
  const lern = store.load("lernen", { stapel: [] });
  const schon = new Set(d.unterlagen.map((u) => u.bild).filter(Boolean));
  for (const s of lern.stapel || []) {
    const bilder = new Set([...(s.bilder || []), ...(s.karten || []).map((k) => k.bild).filter(Boolean)]);
    for (const b of bilder) {
      if (schon.has(b) || !fs.existsSync(path.join(BILDER, `${sicher(b)}.jpg`))) continue;
      const karten = (s.karten || []).filter((k) => k.bild === b);
      d.unterlagen.push({
        id: neueId(), typ: "scan", titel: kurz(s.titel, 120) || "Scan", fach: kurz(s.fach, 60), bild: b,
        text: karten.map((k) => `${k.frage}\n${k.antwort}`).join("\n\n").slice(0, 60000),
        stapel: [s.id], erstellt: s.erstellt || jetzt(), geaendert: jetzt(),
      });
      schon.add(b);
    }
  }
  speichern(d);
}

function kurzinfo(u, q) {
  const art = u.typ === "datei" ? ARTEN[endung(u.datei?.name)] : null;
  let auszug = "";
  if (u.text) {
    const t = String(u.text).replace(/\s+/g, " ");
    const i = q ? t.toLowerCase().indexOf(q) : -1;
    auszug = i > 40 ? `… ${t.slice(i - 30, i + 110)}` : t.slice(0, 140);
  }
  return {
    id: u.id, typ: u.typ, titel: u.titel, fach: u.fach || "", erstellt: u.erstellt, geaendert: u.geaendert,
    favorit: Boolean(u.favorit), stapel: u.stapel || [], bild: u.bild || null, vorschau: u.vorschau || null,
    datei: u.datei ? { name: u.datei.name, groesse: u.datei.groesse } : null,
    icon: u.typ === "scan" ? "📷" : u.typ === "notiz" ? "📝" : art?.icon || "📎",
    zeigen: u.typ === "scan" ? "bild" : u.typ === "notiz" ? "text" : art?.zeigen || null,
    hatText: Boolean(u.text), auszug, geloescht: u.geloescht || null,
  };
}

/** Liste der Unterlagen (ohne Volltext). q = Suche, fach = Ordner, papierkorb = gelöschte zeigen. */
export function liste({ q = "", fach = "", papierkorb = false } = {}) {
  const d = laden();
  const such = String(q || "").toLowerCase().trim();
  const alle = d.unterlagen.filter((u) => Boolean(u.geloescht) === Boolean(papierkorb));
  const treffer = alle.filter((u) => (!fach || (fach === "-" ? !u.fach : u.fach === fach))
    && (!such || `${u.titel} ${u.fach} ${u.datei?.name || ""} ${u.text || ""}`.toLowerCase().includes(such)));
  treffer.sort((a, b) => (b.favorit ? 1 : 0) - (a.favorit ? 1 : 0) || String(b.geaendert || b.erstellt).localeCompare(String(a.geaendert || a.erstellt)));
  const faecher = {};
  for (const u of d.unterlagen) if (!u.geloescht) faecher[u.fach || ""] = (faecher[u.fach || ""] || 0) + 1;
  return {
    unterlagen: treffer.slice(0, 500).map((u) => kurzinfo(u, such)),
    anzahl: d.unterlagen.filter((u) => !u.geloescht).length,
    papierkorb: d.unterlagen.filter((u) => u.geloescht).length,
    faecher: Object.entries(faecher).map(([name, n]) => ({ name, n })).sort((a, b) => a.name.localeCompare(b.name, "de")),
  };
}

export function holen(id) {
  const u = laden().unterlagen.find((x) => x.id === id);
  return u ? { ...kurzinfo(u), text: u.text || "" } : null;
}

/** Gescanntes Foto ablegen (wird von der Lernecke bei jedem Scan aufgerufen). */
export function scanAblegen({ bild, text, titel, fach, vorschau }) {
  if (!bild) return null;
  const d = laden();
  let u = d.unterlagen.find((x) => x.bild === bild);
  if (!u) {
    const erste = String(text || "").split("\n").map((z) => z.trim()).find((z) => z.length > 2);
    const h = new Date();
    u = { id: neueId(), typ: "scan", titel: kurz(titel, 120) || kurz(erste, 80) || `Scan vom ${h.getDate()}.${h.getMonth() + 1}.${h.getFullYear()}`, fach: kurz(fach, 60), bild, text: String(text || "").slice(0, 60000), stapel: [], erstellt: jetzt(), geaendert: jetzt(), automatisch: true };
    d.unterlagen.unshift(u);
  } else if (text && !u.text) u.text = String(text).slice(0, 60000);
  if (vorschau) u.vorschau = vorschauPruefen(vorschau);
  speichern(d);
  return kurzinfo(u);
}

/** Karten wurden aus Fotos gespeichert: Fotos mit dem Stapel verknüpfen (Titel/Fach übernehmen, wenn noch automatisch). */
export function mitStapelVerknuepfen(bilder, stapel) {
  const set = new Set((bilder || []).filter(Boolean));
  if (!set.size || !stapel?.id) return;
  const d = laden();
  let geaendert = false;
  for (const u of d.unterlagen) {
    if (!set.has(u.bild)) continue;
    if (!(u.stapel ||= []).includes(stapel.id)) u.stapel.push(stapel.id);
    if (u.automatisch) { u.titel = kurz(stapel.titel, 120) || u.titel; if (stapel.fach && !u.fach) u.fach = kurz(stapel.fach, 60); }
    u.geaendert = jetzt();
    geaendert = true;
  }
  if (geaendert) speichern(d);
}

/** Wird ein Foto noch im Archiv gebraucht? (Dann darf es beim Löschen eines Stapels nicht weg.) */
export function bildImArchiv(bild) {
  return laden().unterlagen.some((u) => u.bild === bild);
}

function vorschauPruefen(v) {
  const s = String(v || "");
  return /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 60000 ? s : null;
}

/** Eigene Datei oder Notiz ablegen. */
export function ablegen({ titel, fach, text, datei, vorschau }) {
  const d = laden();
  const u = { id: neueId(), titel: "", fach: kurz(fach, 60), stapel: [], erstellt: jetzt(), geaendert: jetzt() };
  if (datei?.data) {
    const name = kurz(path.basename(String(datei.name || "Datei")), 140).replace(/[/\\]/g, "_") || "Datei";
    const buf = Buffer.from(String(datei.data), "base64");
    if (!buf.length) throw new Error("Die Datei ist leer.");
    if (buf.length > MAX_BYTES) throw new Error("Die Datei ist zu groß (höchstens 8 MB).");
    fs.mkdirSync(ORDNER, { recursive: true });
    const ext = endung(name);
    const datName = `${u.id}${ext ? `.${ext}` : ""}`;
    fs.writeFileSync(path.join(ORDNER, datName), buf);
    u.typ = "datei";
    u.datei = { name, groesse: buf.length, datei: datName };
    u.titel = kurz(titel, 120) || name.replace(/\.[a-z0-9]{1,8}$/i, "");
    if (ARTEN[ext]?.zeigen === "text") u.text = buf.toString("utf8").slice(0, 60000);
    else if (text) u.text = String(text).slice(0, 60000);
    if (vorschau) u.vorschau = vorschauPruefen(vorschau);
  } else {
    if (!String(text || "").trim() && !String(titel || "").trim()) throw new Error("Die Notiz ist leer.");
    u.typ = "notiz";
    u.titel = kurz(titel, 120) || kurz(String(text).split("\n")[0], 80) || "Notiz";
    u.text = String(text || "").slice(0, 60000);
  }
  d.unterlagen.unshift(u);
  speichern(d);
  logbuch.eintragen({ bereich: "lernen", titel: `Lern-Archiv: „${u.titel}“ abgelegt` });
  return kurzinfo(u);
}

export function aendern(id, felder = {}) {
  const d = laden();
  const u = d.unterlagen.find((x) => x.id === id);
  if (!u) return null;
  if (felder.titel !== undefined && kurz(felder.titel, 120)) u.titel = kurz(felder.titel, 120);
  if (felder.fach !== undefined) u.fach = kurz(felder.fach, 60);
  if (felder.text !== undefined) u.text = String(felder.text || "").slice(0, 60000);
  if (felder.favorit !== undefined) u.favorit = Boolean(felder.favorit);
  if (felder.vorschau !== undefined) u.vorschau = vorschauPruefen(felder.vorschau);
  if (felder.zurueck) delete u.geloescht;
  if (felder.titel !== undefined || felder.fach !== undefined) delete u.automatisch;
  u.geaendert = jetzt();
  speichern(d);
  return kurzinfo(u);
}

/** Löschen = erst in den Papierkorb. Aus dem Papierkorb heraus endgültig (Datei kommt in einen Papierkorb-Ordner). */
export function loeschen(id) {
  const d = laden();
  const u = d.unterlagen.find((x) => x.id === id);
  if (!u) return { ok: false };
  if (!u.geloescht) {
    u.geloescht = jetzt();
    speichern(d);
    logbuch.eintragen({ bereich: "lernen", titel: `Lern-Archiv: „${u.titel}“ in den Papierkorb` });
    return { ok: true, papierkorb: true };
  }
  d.unterlagen = d.unterlagen.filter((x) => x.id !== id);
  speichern(d);
  try {
    fs.mkdirSync(path.join(ORDNER, "papierkorb"), { recursive: true });
    if (u.datei?.datei) fs.renameSync(path.join(ORDNER, u.datei.datei), path.join(ORDNER, "papierkorb", u.datei.datei));
  } catch { /* egal */ }
  // Scan-Fotos bleiben in lernen-bilder, solange ein Stapel sie noch braucht.
  if (u.bild) {
    const lern = store.load("lernen", { stapel: [] });
    const gebraucht = (lern.stapel || []).some((s) => (s.bilder || []).includes(u.bild) || (s.karten || []).some((k) => k.bild === u.bild));
    if (!gebraucht) {
      try { fs.mkdirSync(path.join(BILDER, "papierkorb"), { recursive: true }); fs.renameSync(path.join(BILDER, `${sicher(u.bild)}.jpg`), path.join(BILDER, "papierkorb", `${sicher(u.bild)}.jpg`)); } catch { /* egal */ }
    }
  }
  logbuch.eintragen({ bereich: "lernen", titel: `Lern-Archiv: „${u.titel}“ endgültig gelöscht` });
  return { ok: true, endgueltig: true };
}

/** Datei zum Anzeigen/Herunterladen. Nur bekannte, harmlose Arten bekommen ihren echten Typ. */
export function dateiVon(id) {
  const u = laden().unterlagen.find((x) => x.id === id);
  if (!u) return null;
  if (u.typ === "scan" && u.bild) {
    const p = path.join(BILDER, `${sicher(u.bild)}.jpg`);
    return fs.existsSync(p) ? { pfad: p, mime: "image/jpeg", name: `${u.titel || "Scan"}.jpg` } : null;
  }
  if (u.typ === "datei" && u.datei?.datei) {
    const p = path.join(ORDNER, path.basename(u.datei.datei));
    if (!fs.existsSync(p)) return null;
    return { pfad: p, mime: ARTEN[endung(u.datei.name)]?.mime || "application/octet-stream", name: u.datei.name };
  }
  return null;
}

export function archivRouten(app) {
  const fehler = (res, err) => res.status(400).json({ error: err.message });
  app.get("/api/lernen/archiv", (req, res) => res.json(liste({ q: String(req.query.q || "").slice(0, 200), fach: String(req.query.fach || "").slice(0, 60), papierkorb: req.query.papierkorb === "1" })));
  app.get("/api/lernen/archiv/:id", (req, res) => { const u = holen(req.params.id); return u ? res.json(u) : res.status(404).json({ error: "Nicht gefunden." }); });
  app.post("/api/lernen/archiv", (req, res) => { try { res.json(ablegen(req.body || {})); } catch (err) { fehler(res, err); } });
  app.patch("/api/lernen/archiv/:id", (req, res) => { const u = aendern(req.params.id, req.body || {}); return u ? res.json(u) : res.status(404).json({ error: "Nicht gefunden." }); });
  app.delete("/api/lernen/archiv/:id", (req, res) => res.json(loeschen(req.params.id)));
  app.get("/api/lernen/archiv/:id/datei", (req, res) => {
    const f = dateiVon(req.params.id);
    if (!f) return res.status(404).json({ error: "Datei nicht gefunden." });
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "sandbox");
    res.setHeader("Content-Disposition", `${req.query.laden === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    res.type(f.mime);
    res.sendFile(f.pfad);
  });
}
