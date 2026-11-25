// v1.176.0: Dateisuche mit antippbaren Treffern.
// Der Mac-Agent sucht (Spotlight). Jeder Treffer bekommt eine zufällige Nummer (id).
// Öffnen, im Finder zeigen und Ansehen/Laden gehen NUR über diese Nummern –
// nie über einen Pfad, den der Browser schickt. So kommt niemand an andere Dateien.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { isAgentOnline, sendToAgent } from "./agent-hub.js";
import { aktiv as gaesteAktiv } from "./gaeste.js";

const HALTBAR_MS = 12 * 60 * 60 * 1000; // Treffer gelten 12 Stunden
const LINK_MS = 30 * 60 * 1000;          // Ansehen-Links gelten 30 Minuten
const MAX = 300;

const treffer = new Map(); // id → { pfad, zeit }
const links = new Map();   // ticket → { id, bis }
let letzte = { q: "", zeit: 0, ids: [] };

const MIME = {
  pdf: "application/pdf", txt: "text/plain; charset=utf-8", csv: "text/csv; charset=utf-8", md: "text/plain; charset=utf-8",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pages: "application/vnd.apple.pages", numbers: "application/vnd.apple.numbers", key: "application/vnd.apple.keynote",
  rtf: "application/rtf", zip: "application/zip",
};
// Diese Arten zeigt ein Browser selbst an. Alles andere (z. B. HTML, SVG) wird nur heruntergeladen, damit darin nie Code mit Fridays Anmeldung läuft.
const ANZEIGBAR = new Set(["pdf", "txt", "csv", "md", "jpg", "jpeg", "png", "gif", "webp", "heic", "mp4", "m4v", "mov", "mp3", "m4a", "wav"]);

const PAKETE = new Set(["pages", "numbers", "key", "rtfd", "app"]);
const endung = (p) => path.extname(p).slice(1).toLowerCase();
const neueId = () => crypto.randomBytes(16).toString("hex");

function aufraeumen() {
  const jetzt = Date.now();
  for (const [id, t] of treffer) if (jetzt - t.zeit > HALTBAR_MS) treffer.delete(id);
  for (const [k, l] of links) if (jetzt > l.bis) links.delete(k);
  while (treffer.size > MAX) treffer.delete(treffer.keys().next().value);
}

// Pfade aus der Suche merken und als Treffer-Liste zurückgeben.
export function merke(pfade, q = "") {
  aufraeumen();
  const liste = [];
  for (const pfad of pfade.slice(0, 15)) {
    if (typeof pfad !== "string" || !pfad.startsWith("/")) continue;
    const id = neueId();
    treffer.set(id, { pfad, zeit: Date.now() });
    liste.push(beschreibe(id, pfad));
  }
  letzte = { q: String(q).slice(0, 200), zeit: Date.now(), ids: liste.map((t) => t.id) };
  return liste;
}

function beschreibe(id, pfad) {
  const e = endung(pfad);
  let groesse = null, ordner = false;
  try { const st = fs.statSync(pfad); groesse = st.isFile() ? st.size : null; ordner = st.isDirectory(); } catch { /* Server darf evtl. nicht lesen – egal */ }
  // Pages/Numbers/Keynote können am Mac „Pakete“ sein (in Wahrheit Ordner). Die öffnen sich am Mac ganz normal.
  const paket = ordner && PAKETE.has(e);
  return { id, name: path.basename(pfad), ordner: path.dirname(pfad).replace(/^\/Users\/[^/]+/, "~"), pfad, endung: e, groesse, istOrdner: ordner && !paket, paket, anzeigbar: ANZEIGBAR.has(e) };
}

// Für das Dashboard: jeder Treffer bekommt fertige Links zum Ansehen/Laden (echte <a>-Links, damit iPhone-Safari sie sicher öffnet).
export function mitLinks(liste) {
  return liste.map((t) => {
    if (t.istOrdner || t.paket) return t;
    const l = link(t.id);
    return l.ok ? { ...t, ansehen: l.url, laden: `${l.url}?laden=1` } : t;
  });
}

export function letzteTreffer() {
  aufraeumen();
  if (gaesteAktiv()) return { q: "", zeit: 0, treffer: [] };
  const liste = letzte.ids.filter((id) => treffer.has(id)).map((id) => beschreibe(id, treffer.get(id).pfad));
  return { q: letzte.q, zeit: letzte.zeit, treffer: mitLinks(liste) };
}

function holeTreffer(id) {
  aufraeumen();
  if (typeof id !== "string" || !/^[0-9a-f]{32}$/.test(id)) return null;
  return treffer.get(id) || null;
}

// Suche über den Mac-Agenten.
export async function suche(q) {
  q = String(q || "").trim().slice(0, 200);
  if (gaesteAktiv()) return { online: isAgentOnline(), dateien: [], treffer: [], error: "Im Gäste-Modus ist die Dateisuche aus." };
  if (!q) return { online: isAgentOnline(), dateien: [], treffer: [] };
  if (!isAgentOnline()) return { online: false, dateien: [], treffer: [] };
  const r = await sendToAgent("find_file", { value: q }, 30000);
  if (!r?.ok) return { online: true, dateien: [], treffer: [], error: r?.error || "Suche fehlgeschlagen" };
  const text = r.result ? String(r.result) : "";
  const pfade = text && text !== "Nichts gefunden" ? text.split("\n").filter(Boolean).slice(0, 15) : [];
  const liste = merke(pfade, q);
  return { online: true, dateien: liste.map((t) => t.pfad), treffer: liste };
}

export async function sucheFuerDashboard(q) {
  const r = await suche(q);
  return { ...r, treffer: mitLinks(r.treffer || []) };
}

const macOpen = (args) => new Promise((resolve) => {
  if (process.platform !== "darwin") return resolve({ ok: false, error: "Öffnen geht nur am Mac." });
  execFile("open", args, { timeout: 15000 }, (err) => resolve(err ? { ok: false, error: "Der Mac konnte die Datei nicht öffnen." } : { ok: true }));
});

// Am Mac öffnen (in der passenden App, z. B. Numbers, Pages, Vorschau – dort auch bearbeiten).
// art: "oeffnen" oder "finder"
export async function amMac(id, art = "oeffnen") {
  if (gaesteAktiv()) return { ok: false, status: 403, error: "Im Gäste-Modus ist die Dateisuche aus." };
  const t = holeTreffer(id);
  if (!t) return { ok: false, status: 404, error: "Treffer abgelaufen. Bitte noch einmal suchen." };
  const aktion = art === "finder" ? "datei_zeigen" : "datei_oeffnen";
  if (isAgentOnline()) {
    const r = await sendToAgent(aktion, { value: t.pfad }, 20000);
    if (r?.ok) return { ok: true, name: path.basename(t.pfad) };
    // Älterer Mac-Agent ohne diese Aktion: Server (läuft ja auf dem Mac) öffnet selbst.
    if (!/Unbekannte Aktion/.test(String(r?.error || ""))) return { ok: false, status: 400, error: r?.error || "Der Mac hat nicht geantwortet." };
  }
  const r = await macOpen(art === "finder" ? ["-R", t.pfad] : [t.pfad]);
  return r.ok ? { ok: true, name: path.basename(t.pfad) } : { ...r, status: 400 };
}

// Kurzlebiger Link zum Ansehen/Laden (für iPhone/Browser). Bindet an genau einen Treffer.
export function link(id, laden = false) {
  if (gaesteAktiv()) return { ok: false, status: 403, error: "Im Gäste-Modus ist die Dateisuche aus." };
  const t = holeTreffer(id);
  if (!t) return { ok: false, status: 404, error: "Treffer abgelaufen. Bitte noch einmal suchen." };
  const ticket = crypto.randomBytes(24).toString("hex");
  links.set(ticket, { id, bis: Date.now() + LINK_MS });
  const name = encodeURIComponent(path.basename(t.pfad));
  return { ok: true, url: `/datei/${ticket}/${name}${laden ? "?laden=1" : ""}` };
}

// Ausliefern: Express-Handler für GET /datei/:ticket/:name
export async function ausliefern(req, res) {
  aufraeumen();
  const l = links.get(String(req.params.ticket || ""));
  const t = l && Date.now() <= l.bis ? treffer.get(l.id) : null;
  if (!t) return res.status(404).type("text/plain; charset=utf-8").send("Link abgelaufen. Bitte in Friday noch einmal suchen.");
  const e = endung(t.pfad);
  const laden = req.query.laden === "1" || !ANZEIGBAR.has(e);
  const name = path.basename(t.pfad);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Disposition", `${laden ? "attachment" : "inline"}; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.type(MIME[e] || "application/octet-stream");
  // 1. Versuch: Server liest selbst (läuft auf dem Mac).
  let st = null;
  try { st = fs.statSync(t.pfad); } catch (err) { if (err.code === "ENOENT") return res.status(404).type("text/plain; charset=utf-8").send("Die Datei gibt es nicht mehr."); }
  if (st && st.isDirectory()) return res.status(400).type("text/plain; charset=utf-8").send("Das lässt sich nur am Mac öffnen (Ordner oder Pages-/Numbers-Paket).");
  if (st) {
    try { fs.accessSync(t.pfad, fs.constants.R_OK); return res.sendFile(t.pfad, { dotfiles: "allow" }, (err) => { if (err && !res.headersSent) holeVomAgent(t, res); }); } catch { /* weiter zum Agenten */ }
  }
  // 2. Versuch: macOS lässt den Server nicht in den Ordner → der Mac-Agent holt die Datei.
  return holeVomAgent(t, res);
}

async function holeVomAgent(t, res) {
  if (!isAgentOnline()) return res.status(503).type("text/plain; charset=utf-8").send("Der Mac ist gerade nicht verbunden.");
  const r = await sendToAgent("datei_holen", { value: t.pfad }, 30000);
  if (!r?.ok || !r.daten) return res.status(400).type("text/plain; charset=utf-8").send(r?.error || "Die Datei konnte nicht geholt werden.");
  res.send(Buffer.from(r.daten, "base64"));
}

// Für Claude: kurze Liste (ohne volle Pfade) + Hinweis.
export function fuerClaude(liste) {
  if (!liste.length) return { gefunden: 0, hinweis: "Nichts gefunden." };
  return {
    gefunden: liste.length,
    treffer: liste.map((t, i) => ({ nr: i + 1, name: t.name, ordner: t.ordner })),
    hinweis: "Die Treffer stehen jetzt antippbar im Dashboard-Fenster Dateien. Lies höchstens die ersten Namen vor. Zum Öffnen am Mac: Werkzeug mac mit action open_found_file und value = Nummer.",
  };
}

export function oeffneNr(nr) {
  const id = letzte.ids[Math.max(0, Math.round(Number(nr) || 1) - 1)];
  if (!id) return Promise.resolve({ ok: false, error: "Es gibt keinen solchen Treffer. Bitte zuerst suchen." });
  return amMac(id, "oeffnen");
}

// Schnellbefehl ohne Claude: „Friday, such die Datei Sushi for you Lohnabrechnungen“, „öffne Treffer 2“.
const ZAHLWORT = { erste: 1, ersten: 1, eins: 1, zweite: 2, zweiten: 2, zwei: 2, dritte: 3, dritten: 3, drei: 3, vierte: 4, vierten: 4, vier: 4, fünfte: 5, fünften: 5, fünf: 5 };
export async function quick(text) {
  const t = String(text || "").trim().replace(/^(hey |hallo )?friday[,!.:]?\s*/i, "").replace(/[.!?]+$/, "").trim();
  const tl = t.toLowerCase();
  const m = tl.match(/^(?:such|suche|find|finde|zeig|zeige)(?: mir)?(?: mal)? (?:die |meine |eine )?(?:datei|dateien|datei namens|dateien zu|datei zu)(?: namens| mit dem namen| zu| von)? (.{2,150})$/);
  if (m && !/^nach /.test(m[1])) {
    const q = t.slice(t.length - m[1].length).replace(/^["„“]|["„“]$/g, "").trim();
    const r = await suche(q);
    if (!r.online) return { answer: "Der Mac ist gerade nicht verbunden, darum kann ich keine Dateien suchen.", actions: ["dateien"] };
    if (r.error) return { answer: `Die Suche hat nicht geklappt: ${r.error}`, actions: ["dateien"] };
    const n = r.treffer.length;
    if (!n) return { answer: `Ich habe keine Datei mit „${q}“ gefunden.`, actions: ["dateien"] };
    return { answer: `${n === 1 ? "Eine Datei" : `${n} Dateien`} gefunden${n === 1 ? `: ${r.treffer[0].name}` : ""}. Tipp sie an, dann öffne ich sie.`, actions: ["dateien"] };
  }
  const o = tl.match(/^(?:öffne|oeffne|mach)(?: mir)? (?:die |den )?(?:(erste|ersten|zweite|zweiten|dritte|dritten|vierte|vierten|fünfte|fünften)(?: datei| treffer)?|(?:datei|treffer)(?: nummer| nr\.?)? (\d{1,2}|eins|zwei|drei|vier|fünf))(?: auf)?$/);
  if (o && letzte.ids.length && Date.now() - letzte.zeit < 15 * 60 * 1000) {
    const nr = ZAHLWORT[o[1]] || Number(o[2]) || ZAHLWORT[o[2]] || 1;
    const r = await oeffneNr(nr);
    return { answer: r.ok ? `${r.name} ist am Mac offen.` : r.error, actions: ["dateien"] };
  }
  return null;
}
