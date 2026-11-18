// Fridays Archiv: alles, was Friday erzeugt, sortiert nach Jahr → Monat.
// Fotos (Friday Vision, Kamera, hinzugefügte Bilder) liegen als echte Dateien in
//   ~/Friday-Archiv/Fotos/<Jahr>/<MM-Monat>/
// Webseiten (~/Friday-Webseiten), fertige Videos (~/Friday-Video/Fertig) und Dokumente
// bleiben, wo sie sind, und werden im Archiv nur mit angezeigt.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { WEB_DIR, listSites } from "./webseiten.js";
import { VIDEO_DIRS } from "./videoteam.js";
import { alleDokumente } from "./dokumente.js";

export const ARCHIV_DIR = process.env.FRIDAY_ARCHIV_DIR || path.join(os.homedir(), "Friday-Archiv");
const FOTO_DIR = path.join(ARCHIV_DIR, "Fotos");
const DOWNLOADS = process.env.FRIDAY_DOWNLOADS_DIR || path.join(os.homedir(), "Downloads");

export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const BILD_EXT = /\.(jpe?g|png|webp|heic|gif)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", html: "text/html; charset=utf-8" };
const MAX_BILD = 15 * 1024 * 1024;

const zwei = (n) => String(n).padStart(2, "0");
const monatsOrdner = (d) => path.join(String(d.getFullYear()), `${zwei(d.getMonth() + 1)}-${MONATE[d.getMonth()]}`);
const stempel = (d) => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}_${zwei(d.getHours())}-${zwei(d.getMinutes())}-${zwei(d.getSeconds())}`;
const quelleName = { vision: "vision", kamera: "kamera", import: "foto" };

function freierName(dir, basis, ext) {
  let name = `${basis}.${ext}`;
  for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `${basis}-${i}.${ext}`;
  return name;
}

// Ein Foto (Base64 oder data:-URL) im Archiv ablegen.
export function speichereFoto({ bild, quelle = "vision", zeit } = {}) {
  const roh = String(bild || "");
  const m = roh.match(/^data:image\/(jpeg|jpg|png|webp);base64,/i);
  const ext = m ? (m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase()) : "jpg";
  const daten = Buffer.from(m ? roh.slice(m[0].length) : roh, "base64");
  if (daten.length < 100) return { ok: false, error: "Kein Bild bekommen." };
  if (daten.length > MAX_BILD) return { ok: false, error: "Das Bild ist zu groß (max. 15 MB)." };
  const d = zeit && !Number.isNaN(new Date(zeit).getTime()) ? new Date(zeit) : new Date();
  const dir = path.join(FOTO_DIR, monatsOrdner(d));
  fs.mkdirSync(dir, { recursive: true });
  const name = freierName(dir, `friday-${quelleName[quelle] || "foto"}-${stempel(d)}`, ext);
  fs.writeFileSync(path.join(dir, name), daten);
  try { fs.utimesSync(path.join(dir, name), d, d); } catch { /* egal */ }
  return { ok: true, datei: path.join(monatsOrdner(d), name), ordner: dir, jahr: d.getFullYear(), monat: d.getMonth() + 1 };
}

// Zeit aus dem Dateinamen holen, z. B. friday-vision-2026-11-18-10-04-22.jpg (UTC, alte Downloads)
// oder friday-vision-2026-11-18_11-04-22.jpg (Ortszeit, Archiv).
function zeitAusName(name, fallback) {
  const alt = name.match(/friday-vision-(\d{4})-(\d\d)-(\d\d)-(\d\d)-(\d\d)-(\d\d)/i);
  if (alt) return new Date(Date.UTC(+alt[1], alt[2] - 1, +alt[3], +alt[4], +alt[5], +alt[6]));
  const neu = name.match(/(\d{4})-(\d\d)-(\d\d)_(\d\d)-(\d\d)-(\d\d)/);
  if (neu) return new Date(+neu[1], neu[2] - 1, +neu[3], +neu[4], +neu[5], +neu[6]);
  return fallback;
}

function verschiebe(von, nach) {
  try { fs.renameSync(von, nach); } catch (e) {
    if (e.code !== "EXDEV") throw e;
    fs.copyFileSync(von, nach); fs.unlinkSync(von);
  }
}

// Alte Vision-Fotos aus dem Download-Ordner ins Archiv einsortieren (nur Dateien namens friday-vision-*).
// Asynchron: macOS kann beim ersten Zugriff auf "Downloads" nachfragen, das darf Friday nicht anhalten.
export async function einsortieren() {
  let namen;
  try { namen = await fs.promises.readdir(DOWNLOADS); } catch (e) {
    return { ok: false, verschoben: 0, error: e.code === "EPERM" || e.code === "EACCES" ? "Friday darf den Download-Ordner nicht lesen (macOS-Datenschutz)." : "Download-Ordner nicht gefunden." };
  }
  const treffer = namen.filter((n) => /^friday-vision-.*\.(jpe?g|png)$/i.test(n));
  let verschoben = 0; const fehler = [];
  for (const n of treffer) {
    const von = path.join(DOWNLOADS, n);
    try {
      const st = await fs.promises.stat(von);
      if (!st.isFile()) continue;
      const d = zeitAusName(n, st.mtime);
      const dir = path.join(FOTO_DIR, monatsOrdner(d));
      fs.mkdirSync(dir, { recursive: true });
      const ext = path.extname(n).slice(1).toLowerCase().replace("jpeg", "jpg");
      const ziel = path.join(dir, freierName(dir, `friday-vision-${stempel(d)}`, ext));
      verschiebe(von, ziel);
      try { fs.utimesSync(ziel, d, d); } catch { /* egal */ }
      verschoben++;
    } catch (e) { fehler.push(`${n}: ${e.message}`); }
  }
  return { ok: fehler.length === 0, verschoben, gefunden: treffer.length, ...(fehler.length ? { error: fehler.slice(0, 3).join("; ") } : {}) };
}

function fotos() {
  const out = [];
  let jahre = [];
  try { jahre = fs.readdirSync(FOTO_DIR).filter((j) => /^\d{4}$/.test(j)); } catch { return out; }
  for (const j of jahre) {
    let monate = [];
    try { monate = fs.readdirSync(path.join(FOTO_DIR, j)).filter((m) => /^\d\d-/.test(m)); } catch { continue; }
    for (const m of monate) {
      let dateien = [];
      try { dateien = fs.readdirSync(path.join(FOTO_DIR, j, m)).filter((f) => BILD_EXT.test(f) && !f.startsWith(".")); } catch { continue; }
      for (const f of dateien) {
        const rel = path.join(j, m, f);
        let st; try { st = fs.statSync(path.join(FOTO_DIR, rel)); } catch { continue; }
        const nameZeit = zeitAusName(f, null);
        // Ordner bestimmt Jahr/Monat; Zeit aus dem Namen, sonst Dateidatum
        let zeit = nameZeit || st.mtime;
        if (zeit.getFullYear() !== +j || zeit.getMonth() + 1 !== +m.slice(0, 2)) zeit = new Date(+j, +m.slice(0, 2) - 1, 1, 12);
        const quelle = /vision/i.test(f) ? "Friday Vision" : /kamera/i.test(f) ? "Kamera" : "Foto";
        out.push({ typ: "foto", id: `foto:${rel}`, titel: quelle, name: f, zeit: zeit.toISOString(), groesse: st.size, datei: `foto/${rel.split(path.sep).map(encodeURIComponent).join("/")}` });
      }
    }
  }
  return out;
}

function videos() {
  let namen = [];
  try { namen = fs.readdirSync(VIDEO_DIRS.fertig).filter((f) => VIDEO_EXT.test(f) && !f.startsWith(".")); } catch { return []; }
  return namen.map((f) => {
    let st; try { st = fs.statSync(path.join(VIDEO_DIRS.fertig, f)); } catch { return null; }
    return { typ: "video", id: `video:${f}`, titel: f.replace(VIDEO_EXT, "").replace(/[-_]+/g, " "), name: f, zeit: st.mtime.toISOString(), groesse: st.size, datei: `video/${encodeURIComponent(f)}` };
  }).filter(Boolean);
}

function webseiten() {
  try {
    return listSites().map((s) => ({ typ: "webseite", id: `webseite:${s.id}`, titel: s.titel || s.id, zeit: s.erstellt || s.geaendert, status: s.status, preis: s.verkauft_eur ?? s.preis_eur ?? null, datei: `webseite/${encodeURIComponent(s.id)}` }));
  } catch { return []; }
}

function dokumente() {
  try {
    return alleDokumente().map((d) => ({ typ: "dokument", id: `dokument:${d.id}`, dokId: d.id, titel: d.titel || "Dokument", art: d.art, zeit: d.erstellt }));
  } catch { return []; }
}

// Alles nach Jahr → Monat gruppiert, neueste zuerst.
export function archivUebersicht() {
  const alle = [...fotos(), ...videos(), ...webseiten(), ...dokumente()]
    .filter((e) => e.zeit && !Number.isNaN(new Date(e.zeit).getTime()))
    .sort((a, b) => String(b.zeit).localeCompare(String(a.zeit)));
  const jahre = new Map();
  for (const e of alle) {
    const d = new Date(e.zeit);
    const j = d.getFullYear(), m = d.getMonth() + 1;
    if (!jahre.has(j)) jahre.set(j, new Map());
    const mm = jahre.get(j);
    if (!mm.has(m)) mm.set(m, []);
    mm.get(m).push(e);
  }
  const zaehle = (liste) => liste.reduce((z, e) => { z[e.typ] = (z[e.typ] || 0) + 1; z.gesamt++; return z; }, { gesamt: 0 });
  return {
    ordner: ARCHIV_DIR,
    gesamt: zaehle(alle),
    jahre: [...jahre.entries()].map(([jahr, mm]) => {
      const monate = [...mm.entries()].map(([monat, eintraege]) => ({ monat, name: MONATE[monat - 1], anzahl: zaehle(eintraege), eintraege }));
      return { jahr, anzahl: zaehle(monate.flatMap((m) => m.eintraege)), monate };
    }),
  };
}

// Pfad zu einer Archiv-Datei sicher auflösen (kein Ausbrechen aus den Ordnern).
function innerhalb(basis, rel) {
  const voll = path.resolve(basis, rel);
  return voll.startsWith(path.resolve(basis) + path.sep) ? voll : null;
}
export function dateiPfad(art, rel) {
  const r = String(rel || "");
  if (!r || r.includes("\0")) return null;
  let voll = null;
  if (art === "foto" && BILD_EXT.test(r)) voll = innerhalb(FOTO_DIR, r);
  else if (art === "video" && VIDEO_EXT.test(r) && !r.includes("/")) voll = innerhalb(VIDEO_DIRS.fertig, r);
  else if (art === "webseite" && /^[\w-]{1,80}$/.test(r)) voll = innerhalb(WEB_DIR, path.join(r, "index.html"));
  if (!voll || !fs.existsSync(voll) || !fs.statSync(voll).isFile()) return null;
  return { voll, mime: MIME[path.extname(voll).slice(1).toLowerCase()] || "application/octet-stream" };
}

// Foto aus dem Archiv entfernen: kommt in ~/Friday-Archiv/Papierkorb (nicht endgültig gelöscht).
export function fotoWegwerfen(rel) {
  const p = dateiPfad("foto", rel);
  if (!p) return { ok: false, error: "Foto nicht gefunden." };
  const korb = path.join(ARCHIV_DIR, "Papierkorb");
  fs.mkdirSync(korb, { recursive: true });
  verschiebe(p.voll, path.join(korb, freierName(korb, path.basename(p.voll, path.extname(p.voll)), path.extname(p.voll).slice(1))));
  return { ok: true };
}

// Archiv-Ordner im Finder öffnen (nur am Mac).
export function oeffneOrdner(jahr, monat) {
  let dir = FOTO_DIR;
  if (/^\d{4}$/.test(String(jahr || ""))) {
    dir = path.join(FOTO_DIR, String(jahr));
    const m = Number(monat);
    if (m >= 1 && m <= 12) dir = path.join(dir, `${zwei(m)}-${MONATE[m - 1]}`);
  }
  if (!fs.existsSync(dir)) dir = FOTO_DIR;
  fs.mkdirSync(dir, { recursive: true });
  if (process.platform !== "darwin") return { ok: true, ordner: dir, hinweis: "Ordner öffnen geht nur am Mac." };
  execFile("open", [dir], () => {});
  return { ok: true, ordner: dir };
}

// Beim Start: Ordner anlegen und kurz danach alte Downloads einsortieren (still, ohne Absturz).
export function archivStart() {
  try { fs.mkdirSync(FOTO_DIR, { recursive: true }); } catch { /* egal */ }
  setTimeout(() => {
    einsortieren()
      .then((r) => { if (r.verschoben) console.log(`Archiv: ${r.verschoben} Vision-Fotos aus Downloads einsortiert.`); })
      .catch((e) => console.error("Archiv:", e.message));
  }, 15000).unref?.();
}

// Sprachbefehl: "öffne das Archiv", "zeig mir meine Fotos", "Fotoalbum".
export function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/[„“”"'!?.,:;]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^(?:hey |hallo |hi |ok |okay )?(?:friday|freitag|fraiday)(?: |$)/, "").trim()
    .replace(/^(?:bitte |kannst du (?:mir )?(?:bitte )?|könntest du (?:mir )?(?:bitte )?)/, "").trim();
  if (/^(?:bitte )?(?:öffne|oeffne|zeig|zeige|mach)(?: mir)?(?: mal)? (?:das |dein |mein |fridays )?(?:archiv|foto ?archiv|fotoalbum|album)(?: auf| bitte)?$/.test(t)
    || /^(?:zeig|zeige)(?: mir)?(?: mal)? (?:meine |die |deine )?(?:fotos|bilder|vision fotos)(?: aus dem archiv)?$/.test(t)
    || /^(?:mir )?(?:das |dein |mein |fridays |meine |die )?(?:archiv|foto ?archiv|fotoalbum|album|fotos)(?: zeigen| öffnen| oeffnen| auf ?machen)$/.test(t)
    || /^(?:archiv|fotoarchiv|fotoalbum)$/.test(t)) {
    const n = fotos().length;
    return { answer: n ? `Hier ist dein Archiv, Boss. ${n === 1 ? "Ein Foto" : `${n} Fotos`}, sortiert nach Jahr und Monat.` : "Hier ist dein Archiv, Boss. Noch sind keine Fotos drin.", actions: ["archiv"] };
  }
  return null;
}
