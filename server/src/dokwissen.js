// Dokumenten-Wissen (v1.134.0, Idee aus OpenJarvis "Deep Research mit Quellen"):
// Friday liest deine eigenen Unterlagen (PDF, Word, Text, Notizen) aus dem Ordner ~/Friday-Wissen,
// durchsucht sie blitzschnell und sagt dir bei jeder Antwort, aus welcher Datei und von welcher Seite sie stammt.
// Das Lesen und Suchen läuft komplett auf dem Mac (kostenlos). Nur die ausformulierte Antwort nutzt Claude,
// wenn Guthaben da ist – sonst liest Friday die passende Stelle direkt vor.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { ROOT, DATA_DIR } from "./config.js";
import { eintragen } from "./logbuch.js";
import { alleDokumente } from "./dokumente.js";

export const ORDNER = process.env.FRIDAY_WISSEN_DIR || path.join(os.homedir(), "Friday-Wissen");
const PAPIERKORB = path.join(ORDNER, "Papierkorb");
const INDEX_DIR = path.join(DATA_DIR, "dokwissen");
const INDEX_DATEI = path.join(INDEX_DIR, "index.json");
const MAX_DATEI = 60 * 1024 * 1024; // größere Dateien überspringen
const MAX_TEXT = 3_000_000; // Zeichen pro Datei
const ARTEN = {
  ".pdf": "pdf", ".txt": "text", ".md": "text", ".markdown": "text", ".csv": "text", ".json": "text", ".log": "text",
  ".html": "html", ".htm": "html",
  ".docx": "textutil", ".doc": "textutil", ".rtf": "textutil", ".odt": "textutil", ".rtfd": "textutil", ".webarchive": "textutil", ".pages": "pages",
};
export const ENDUNGEN = Object.keys(ARTEN).filter((e) => e !== ".pages");

// ---------- Text aus Dateien holen ----------
const run = (cmd, args, timeout = 60000) => new Promise((ok, nein) => execFile(cmd, args, { timeout, maxBuffer: 64 * 1024 * 1024 }, (err, out, stderr) => (err ? nein(new Error(String(stderr || err.message).trim().split("\n")[0].slice(0, 200))) : ok(String(out)))));

const QUELLE = path.join(ROOT, "tools", "pdf-text.swift");
const PROGRAMM = path.join(DATA_DIR, "werkzeuge", "pdf-text");
let bauen = null;
let bauFehler = null;
function pdfProgramm() {
  if (process.platform !== "darwin") return Promise.reject(new Error("kein Mac"));
  try { if (fs.statSync(PROGRAMM).mtimeMs >= fs.statSync(QUELLE).mtimeMs) return Promise.resolve(PROGRAMM); } catch { /* noch nicht gebaut */ }
  if (bauFehler && Date.now() - bauFehler.at < 10 * 60 * 1000) return Promise.reject(bauFehler.err);
  if (bauen) return bauen;
  fs.mkdirSync(path.dirname(PROGRAMM), { recursive: true });
  bauen = new Promise((ok, nein) => {
    execFile("/usr/bin/swiftc", ["-O", QUELLE, "-o", `${PROGRAMM}.neu`], { timeout: 240000, env: { ...process.env, DEVELOPER_DIR: process.env.DEVELOPER_DIR || "/Library/Developer/CommandLineTools" } }, (err, _o, stderr) => {
      bauen = null;
      if (err) {
        const e = new Error(`PDF-Leser ließ sich nicht einrichten (${String(stderr || err.message).split("\n")[0].slice(0, 160)})`);
        bauFehler = { at: Date.now(), err: e };
        return nein(e);
      }
      try { fs.renameSync(`${PROGRAMM}.neu`, PROGRAMM); } catch (e2) { return nein(e2); }
      ok(PROGRAMM);
    });
  });
  return bauen;
}

const htmlZuText = (h) => String(h).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Liefert die Seiten einer Datei als Text-Array. */
async function leseSeiten(datei) {
  const art = ARTEN[path.extname(datei).toLowerCase()];
  if (art === "text") return [fs.readFileSync(datei, "utf8").slice(0, MAX_TEXT)];
  if (art === "html") return [htmlZuText(fs.readFileSync(datei, "utf8")).slice(0, MAX_TEXT)];
  if (art === "textutil") {
    if (process.platform !== "darwin") throw new Error("Word-Dateien liest Friday nur auf dem Mac");
    return [(await run("/usr/bin/textutil", ["-convert", "txt", "-stdout", datei])).slice(0, MAX_TEXT)];
  }
  if (art === "pages") throw new Error("Pages-Dateien bitte als PDF oder Word exportieren");
  if (art === "pdf") {
    let text = null;
    try { text = await run(await pdfProgramm(), [datei], 120000); } catch { /* nächster Weg */ }
    if (text == null) {
      // Ersatzwege: pdftotext (falls installiert) oder pypdf in Fridays Python-Umgebung
      try { text = await run("pdftotext", ["-layout", "-enc", "UTF-8", datei, "-"], 120000); } catch { /* weiter */ }
    }
    if (text == null) {
      const py = path.resolve(ROOT, "..", ".venv", "bin", "python");
      if (fs.existsSync(py)) {
        try { text = await run(py, ["-I", "-c", "import sys,pypdf\nr=pypdf.PdfReader(sys.argv[1])\nprint('\\f'.join((p.extract_text() or '') for p in r.pages))", datei], 120000); } catch { /* weiter */ }
      }
    }
    if (text == null) throw new Error("PDF-Leser fehlt (am Mac richtet Friday ihn beim ersten Mal selbst ein)");
    return text.slice(0, MAX_TEXT).split("\f");
  }
  throw new Error("Dateityp wird nicht unterstützt");
}

// ---------- Suchen (BM25, wie eine kleine Suchmaschine) ----------
const STOPP = new Set("der die das den dem des ein eine einer eines einem einen und oder aber auch als am an auf aus bei bis da dann dass daß du er es ich ihr im in ist ja mit nach nicht noch nur ob sie so um uns von vor was wie wir wo zu zum zur über ueber für fuer hat habe haben hast sind war waren wird werden kann können koennen soll sollte muss mein meine meinem meinen meiner dein deine sein seine ihre ihren man sich mir mich dir dich wenn weil welche welcher welches steht stehen gibt geht etwas alles mal hier dort the and of to a is for on that this with are be".split(" "));
const ENDUNG = /(ungen|ungs|heiten|keiten|lichen|ischen|ern|ung|heit|keit|lich|isch|chen|en|er|es|em|e|n|s)$/;
export function woerter(text) {
  return String(text || "").toLowerCase().replace(/ß/g, "ss").normalize("NFKC")
    .split(/[^a-z0-9äöü]+/i).filter((w) => w.length > 1 && !STOPP.has(w))
    .map((w) => (w.length > 5 ? w.replace(ENDUNG, "") : w.length > 4 ? w.replace(/(en|er|e|s|n)$/, "") : w))
    .filter((w) => w.length > 1);
}

function stuecke(seiten) {
  const out = [];
  seiten.forEach((roh, i) => {
    const text = String(roh || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return;
    const absaetze = text.split(/\n\s*\n/);
    let aktuell = "";
    const fertig = () => { if (aktuell.trim().length > 20) out.push({ seite: seiten.length > 1 ? i + 1 : null, text: aktuell.trim() }); };
    for (const a of absaetze) {
      if ((aktuell + "\n\n" + a).length > 1100 && aktuell) {
        fertig();
        // etwas Überlappung, damit Sätze an der Grenze nicht verloren gehen
        aktuell = aktuell.slice(-180).replace(/^\S*\s/, "") + "\n\n" + a;
      } else aktuell = aktuell ? `${aktuell}\n\n${a}` : a;
      while (aktuell.length > 1600) {
        const schnitt = Math.max(aktuell.lastIndexOf(". ", 1200), 800);
        out.push({ seite: seiten.length > 1 ? i + 1 : null, text: aktuell.slice(0, schnitt + 1).trim() });
        aktuell = aktuell.slice(Math.max(0, schnitt - 150));
      }
    }
    fertig();
  });
  return out;
}

// Index im Speicher: docs (Metadaten) und chunks (Text + Wortzählung)
let idx = { docs: {}, chunks: [] };
let df = new Map();
let schnittLaenge = 1;
let status = { laeuft: false, zuletzt: null, fehler: null, neu: 0 };

function neuBerechnen() {
  df = new Map();
  let summe = 0;
  for (const c of idx.chunks) {
    const w = woerter(c.text);
    c.tf = new Map();
    for (const x of w) c.tf.set(x, (c.tf.get(x) || 0) + 1);
    c.len = w.length || 1;
    summe += c.len;
    for (const x of c.tf.keys()) df.set(x, (df.get(x) || 0) + 1);
  }
  schnittLaenge = idx.chunks.length ? summe / idx.chunks.length : 1;
}

function laden() {
  try {
    const d = JSON.parse(fs.readFileSync(INDEX_DATEI, "utf8"));
    idx = { docs: d.docs || {}, chunks: Array.isArray(d.chunks) ? d.chunks : [] };
  } catch { idx = { docs: {}, chunks: [] }; }
  neuBerechnen();
}
function sichern() {
  fs.mkdirSync(INDEX_DIR, { recursive: true });
  const tmp = `${INDEX_DATEI}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ docs: idx.docs, chunks: idx.chunks.map(({ doc, seite, text }) => ({ doc, seite, text })) }));
  fs.renameSync(tmp, INDEX_DATEI);
}

const docId = (schluessel) => crypto.createHash("sha1").update(schluessel).digest("hex").slice(0, 14);

function dateienImOrdner() {
  const out = [];
  const gehe = (dir, tiefe) => {
    let eintraege = [];
    try { eintraege = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of eintraege) {
      if (e.name.startsWith(".") || e.name.startsWith("~$")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (p !== PAPIERKORB && tiefe < 4) gehe(p, tiefe + 1); continue; }
      if (!e.isFile()) continue;
      if (!ARTEN[path.extname(e.name).toLowerCase()]) continue;
      out.push(p);
    }
  };
  gehe(ORDNER, 0);
  return out;
}

/** Liest neue und geänderte Dateien ein, entfernt gelöschte. */
export async function einlesen({ alles = false } = {}) {
  if (status.laeuft) return { laeuft: true };
  status = { ...status, laeuft: true, fehler: null, neu: 0 };
  try {
    fs.mkdirSync(ORDNER, { recursive: true });
    const vorhanden = new Set();
    let geaendert = false;
    // 1) Dateien im Ordner
    for (const datei of dateienImOrdner()) {
      const id = docId(`datei:${path.relative(ORDNER, datei)}`);
      vorhanden.add(id);
      let st;
      try { st = fs.statSync(datei); } catch { continue; }
      const alt = idx.docs[id];
      if (!alles && alt && alt.mtime === st.mtimeMs && alt.groesse === st.size) continue;
      const meta = { id, quelle: "ordner", name: path.basename(datei), pfad: path.relative(ORDNER, datei), groesse: st.size, mtime: st.mtimeMs, art: path.extname(datei).slice(1).toLowerCase(), eingelesen: new Date().toISOString() };
      idx.chunks = idx.chunks.filter((c) => c.doc !== id);
      if (st.size > MAX_DATEI) { idx.docs[id] = { ...meta, status: "zu groß (über 60 MB)", stuecke: 0 }; geaendert = true; continue; }
      try {
        const seiten = await leseSeiten(datei);
        const s = stuecke(seiten);
        for (const c of s) idx.chunks.push({ doc: id, seite: c.seite, text: c.text });
        const zeichen = seiten.reduce((n, x) => n + String(x || "").trim().length, 0);
        idx.docs[id] = { ...meta, seiten: seiten.length, stuecke: s.length, status: s.length ? "bereit" : meta.art === "pdf" ? "kein Text (eingescanntes Bild-PDF?)" : "leer", zeichen };
        status.neu++;
      } catch (err) {
        idx.docs[id] = { ...meta, status: `nicht lesbar: ${err.message}`, stuecke: 0 };
      }
      geaendert = true;
    }
    // 2) Fridays eigene Dokumente (Listen, Pläne, Briefe, die sie für dich erstellt hat)
    for (const d of alleDokumente()) {
      if (d.art && d.art !== "dokument") continue;
      const id = docId(`friday:${d.id}`);
      vorhanden.add(id);
      const inhalt = String(d.inhalt || "");
      const hash = crypto.createHash("sha1").update(inhalt).digest("hex").slice(0, 10);
      if (!alles && idx.docs[id]?.hash === hash) continue;
      idx.chunks = idx.chunks.filter((c) => c.doc !== id);
      const s = stuecke([inhalt]);
      for (const c of s) idx.chunks.push({ doc: id, seite: null, text: c.text });
      idx.docs[id] = { id, quelle: "friday", name: `${d.titel}`, fridayId: d.id, art: "friday", hash, stuecke: s.length, status: s.length ? "bereit" : "leer", eingelesen: new Date().toISOString(), mtime: new Date(d.erstellt || Date.now()).getTime() };
      geaendert = true;
    }
    // 3) Gelöschtes entfernen
    for (const id of Object.keys(idx.docs)) {
      if (!vorhanden.has(id)) { delete idx.docs[id]; idx.chunks = idx.chunks.filter((c) => c.doc !== id); geaendert = true; }
    }
    if (geaendert) { neuBerechnen(); sichern(); }
    if (status.neu) eintragen({ bereich: "suche", titel: `Dokumenten-Wissen: ${status.neu} ${status.neu === 1 ? "Datei" : "Dateien"} eingelesen`, quelle: "automatisch" });
    return { ok: true, neu: status.neu };
  } catch (err) {
    status.fehler = err.message;
    return { error: err.message };
  } finally {
    status.laeuft = false;
    status.zuletzt = new Date().toISOString();
  }
}

function ausschnitt(text, begriffe, laenge = 320) {
  const t = String(text).replace(/\s+/g, " ").trim();
  if (t.length <= laenge) return t;
  const klein = t.toLowerCase().replace(/ß/g, "ss");
  let best = 0, bestTreffer = -1;
  for (let i = 0; i < klein.length; i += 60) {
    const fenster = klein.slice(i, i + laenge);
    const n = begriffe.reduce((s, b) => s + (fenster.includes(b) ? 1 : 0), 0);
    if (n > bestTreffer) { bestTreffer = n; best = i; }
  }
  const start = Math.max(0, best - 40);
  let s = t.slice(start, start + laenge);
  if (start > 0) s = `… ${s.replace(/^\S*\s/, "")}`;
  if (start + laenge < t.length) s = `${s.replace(/\s\S*$/, "")} …`;
  return s;
}

/** Durchsucht alle Unterlagen. Liefert die besten Stellen mit Quelle. */
export function suche(frage, anzahl = 6) {
  const q = [...new Set(woerter(frage))];
  if (!q.length || !idx.chunks.length) return [];
  const N = idx.chunks.length;
  const k1 = 1.4, b = 0.75;
  const roh = String(frage || "").toLowerCase().replace(/ß/g, "ss");
  const phrase = roh.replace(/^(was|wie|wo|wann|wer|welche[rsn]?|steht|gibt)\b.*?\b(über|zu|zum|zur|von|in)\s+/, "").trim();
  const punkte = [];
  for (let i = 0; i < N; i++) {
    const c = idx.chunks[i];
    let s = 0;
    for (const w of q) {
      const f = c.tf.get(w);
      if (!f) continue;
      const n = df.get(w) || 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * c.len) / schnittLaenge)));
    }
    if (!s) continue;
    // Bonus für den Dateinamen und für die genaue Wortfolge
    const name = String(idx.docs[c.doc]?.name || "").toLowerCase();
    if (q.some((w) => name.includes(w))) s *= 1.25;
    if (phrase.length > 5 && c.text.toLowerCase().replace(/ß/g, "ss").includes(phrase)) s *= 1.5;
    punkte.push([s, i]);
  }
  punkte.sort((a, b2) => b2[0] - a[0]);
  const out = [];
  const proDoc = new Map();
  for (const [s, i] of punkte) {
    const c = idx.chunks[i];
    if ((proDoc.get(c.doc) || 0) >= 2) continue; // höchstens zwei Stellen pro Datei
    proDoc.set(c.doc, (proDoc.get(c.doc) || 0) + 1);
    const d = idx.docs[c.doc] || {};
    out.push({ doc: c.doc, datei: d.name || "?", quelle: d.quelle, seite: c.seite, punkte: Math.round(s * 100) / 100, text: ausschnitt(c.text, q), voll: c.text.slice(0, 1800) });
    if (out.length >= anzahl) break;
  }
  return out;
}

export const quelleText = (h) => `${h.datei}${h.seite ? `, Seite ${h.seite}` : ""}`;

/** Beantwortet eine Frage aus den Unterlagen – mit Claude, wenn Guthaben da ist, sonst mit der besten Stelle. */
export async function beantworte(frage, { mitClaude = true } = {}) {
  const treffer = suche(frage, 6);
  if (!idx.chunks.length) return { antwort: `In deinem Wissens-Ordner liegt noch nichts, Boss. Leg PDFs, Word- oder Textdateien in den Ordner Friday-Wissen in deinem Benutzerordner, oder lade sie im Fenster Dokumenten-Wissen hoch.`, treffer: [], leer: true };
  if (!treffer.length) return { antwort: "Dazu finde ich in deinen Unterlagen nichts, Boss.", treffer: [] };
  if (mitClaude) {
    const { denke } = await import("./denker.js");
    const auszuege = treffer.map((h, i) => `[${i + 1}] Quelle: ${quelleText(h)}\n${h.voll}`).join("\n\n---\n\n");
    const r = await denke({
      quelle: "dokumente",
      stufe: "mittel",
      maxTokens: 1500,
      system: "Du bist Friday, die KI von Boss. Beantworte die Frage NUR mit den Auszügen aus seinen eigenen Unterlagen. Antworte auf Deutsch in zwei bis fünf gesprochenen Sätzen ohne Markdown und ohne Aufzählungszeichen. Nenne am Ende jeder wichtigen Aussage die Quelle in Klammern wie (Mietvertrag.pdf, Seite 3). Steht die Antwort nicht in den Auszügen, sag ehrlich, dass sie nicht drinsteht. Erfinde nichts.",
      text: `Frage: ${frage}\n\nAuszüge:\n${auszuege}`,
    });
    if (r.ok && r.text) return { antwort: r.text, treffer, claude: true };
  }
  const h = treffer[0];
  const satz = h.text.replace(/^… /, "").replace(/ …$/, "");
  return { antwort: `In ${quelleText(h).replace(", Seite", " auf Seite")} steht: ${satz.slice(0, 420)}${treffer.length > 1 ? ` Dazu gibt es noch ${treffer.length - 1} weitere Stellen im Fenster.` : ""}`, treffer, claude: false };
}

export function uebersicht() {
  const docs = Object.values(idx.docs).sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
  return {
    ordner: ORDNER,
    dokumente: docs.map(({ id, name, pfad, quelle, art, seiten, stuecke: n, status: s, groesse, mtime, eingelesen }) => ({ id, name, pfad, quelle, art, seiten, stuecke: n, status: s, groesse, mtime, eingelesen })),
    stuecke: idx.chunks.length,
    bereit: docs.filter((d) => d.status === "bereit").length,
    status,
    endungen: ENDUNGEN,
    mac: process.platform === "darwin",
  };
}

const sauberName = (n) => path.basename(String(n || "")).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/^\.+/, "").slice(0, 140);

export async function hochladen({ name, data }) {
  const n = sauberName(name);
  if (!n || !ARTEN[path.extname(n).toLowerCase()]) return { error: `Diesen Dateityp kann ich nicht lesen. Möglich: ${ENDUNGEN.join(" ")}` };
  const buf = Buffer.from(String(data || ""), "base64");
  if (!buf.length) return { error: "Die Datei ist leer." };
  fs.mkdirSync(ORDNER, { recursive: true });
  let ziel = path.join(ORDNER, n);
  for (let i = 2; fs.existsSync(ziel) && i < 100; i++) ziel = path.join(ORDNER, n.replace(/(\.[^.]+)$/, ` (${i})$1`));
  fs.writeFileSync(ziel, buf);
  eintragen({ bereich: "suche", titel: `Dokumenten-Wissen: ${path.basename(ziel)} hochgeladen`, quelle: "dashboard" });
  await einlesen();
  return { ok: true, name: path.basename(ziel) };
}

export function dateiPfad(id) {
  const d = idx.docs[id];
  if (!d || d.quelle !== "ordner") return null;
  const p = path.resolve(ORDNER, d.pfad);
  if (!p.startsWith(path.resolve(ORDNER) + path.sep)) return null;
  return fs.existsSync(p) ? p : null;
}

export async function entfernen(id) {
  const p = dateiPfad(id);
  if (!p) return { error: "Diese Datei liegt nicht im Wissens-Ordner (oder ist schon weg)." };
  fs.mkdirSync(PAPIERKORB, { recursive: true });
  let ziel = path.join(PAPIERKORB, path.basename(p));
  for (let i = 2; fs.existsSync(ziel) && i < 100; i++) ziel = path.join(PAPIERKORB, path.basename(p).replace(/(\.[^.]+)?$/, ` (${i})$1`));
  fs.renameSync(p, ziel);
  await einlesen();
  return { ok: true };
}

export function ordnerOeffnen() {
  fs.mkdirSync(ORDNER, { recursive: true });
  if (process.platform === "darwin") execFile("open", [ORDNER], () => {});
  return { ok: true, ordner: ORDNER };
}

let takt = null;
export function dokwissenStart() {
  laden();
  try { fs.mkdirSync(ORDNER, { recursive: true }); } catch { /* egal */ }
  setTimeout(() => einlesen().catch(() => {}), 20 * 1000).unref?.();
  takt = setInterval(() => einlesen().catch(() => {}), 10 * 60 * 1000);
  takt.unref?.();
  // PDF-Leser schon mal vorbereiten (einmal ca. 30 Sekunden übersetzen)
  if (process.platform === "darwin") setTimeout(() => pdfProgramm().catch((e) => console.error("Dokumenten-Wissen:", e.message)), 100 * 1000).unref?.();
}

// ---------- Sprache (ohne Claude für das Suchen) ----------
const norm = (t) => String(t || "").replace(/\s+/g, " ").trim().replace(/^(hey |hallo |ok |okay )?friday[, ]+/i, "");
export async function quickCommand(text) {
  const roh = norm(text);
  const t = roh.toLowerCase().replace(/[?!.]+$/, "");
  if (/^((öffne|zeig)( mir)? )?(das |mein )?(dokumenten[- ]?wissen|wissens[- ]?ordner)( öffnen)?$/.test(t) || /^welche (dokumente|unterlagen|dateien) (kennst|hast) du/.test(t)) {
    const u = uebersicht();
    return { answer: u.bereit ? `Ich kenne ${u.bereit} ${u.bereit === 1 ? "Dokument" : "Dokumente"} aus deinem Wissens-Ordner. Frag mich einfach, was drinsteht.` : "Dein Wissens-Ordner ist noch leer. Leg Dateien in den Ordner Friday-Wissen oder lade sie hier hoch.", actions: ["dokwissen"] };
  }
  const m = t.match(/^(?:durchsuche|such(?:e)?|schau)(?: mal)? (?:in )?(?:meine[n]?|den) (?:dokumente[n]?|unterlagen|dateien|pdfs|wissens[- ]?ordner)(?: nach| zu| über)? (.{2,200})$/)
    || t.match(/^was (?:steht|stand|findest du|weißt du|weisst du) in meinen (?:dokumenten|unterlagen|dateien|pdfs|verträgen|vertraegen)(?: über| zu| zum| zur| von| wegen)? (.{2,200})$/)
    || t.match(/^frag(?:e)? meine (?:dokumente|unterlagen)[: ,]+(.{2,200})$/)
    || t.match(/^(?:laut|in) meinen (?:dokumenten|unterlagen)[, ]+(.{2,200})$/)
    || t.match(/^(.{4,200}?)\s+(?:laut|aus|in) meinen (?:dokumenten|unterlagen|dateien|pdfs)$/);
  if (!m) return null;
  const pos = t.indexOf(m[1]);
  const frage = (pos >= 0 ? roh.slice(pos, pos + m[1].length) : m[1]).trim();
  const r = await beantworte(frage);
  return { answer: r.antwort, actions: [`dokwissen:${encodeURIComponent(frage.slice(0, 200))}`], ...(r.claude ? { claude: true } : {}) };
}

// ---------- Claude-Werkzeug ----------
export const toolDefinition = {
  name: "dokumente_suchen",
  description: "Durchsucht Boss' eigene Unterlagen (PDFs, Word-, Text-Dateien aus dem Ordner Friday-Wissen und deine selbst erstellten Dokumente) und liefert die passenden Stellen mit Quelle (Datei, Seite). Benutze es für Fragen wie 'Was steht in meinem Mietvertrag über Kündigung?', 'Wie lange ist die Garantie laut Rechnung?', 'Was sagt die Anleitung zu …'. Nenne in deiner Antwort immer die Quelle.",
  input_schema: { type: "object", properties: { frage: { type: "string", description: "Wonach gesucht wird, in Boss' Worten" } }, required: ["frage"] },
};
export function runTool(input = {}) {
  const t = suche(String(input.frage || ""), 6);
  if (!idx.chunks.length) return { info: "Der Wissens-Ordner ist noch leer (~/Friday-Wissen)." };
  if (!t.length) return { info: "Keine passenden Stellen in den Unterlagen gefunden." };
  return { stellen: t.map((h) => ({ quelle: quelleText(h), text: h.voll.slice(0, 1400) })), hinweis: "Antworte nur aus diesen Stellen und nenne die Quelle (Datei, Seite)." };
}

export function dokwissenRouten(app, asyncRoute) {
  app.get("/api/dokwissen", (req, res) => res.json(uebersicht()));
  app.get("/api/dokwissen/suche", (req, res) => res.json({ treffer: suche(String(req.query.q || "").slice(0, 300), Math.min(20, Number(req.query.n) || 8)).map(({ voll, ...h }) => h) }));
  app.post("/api/dokwissen/frage", asyncRoute(async (req, res) => {
    const frage = String(req.body?.frage || "").trim().slice(0, 400);
    if (frage.length < 2) return res.status(400).json({ error: "Was möchtest du wissen?" });
    const r = await beantworte(frage, { mitClaude: req.body?.claude !== false });
    eintragen({ bereich: "suche", titel: `Dokumenten-Wissen gefragt: ${frage.slice(0, 100)}`, details: r.antwort.slice(0, 300), claude: Boolean(r.claude), quelle: "dashboard" });
    res.json({ ...r, treffer: r.treffer.map(({ voll, ...h }) => h) });
  }));
  app.post("/api/dokwissen/einlesen", asyncRoute(async (req, res) => { await einlesen({ alles: req.body?.alles === true }); res.json(uebersicht()); }));
  app.post("/api/dokwissen/upload", asyncRoute(async (req, res) => {
    const r = await hochladen(req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json({ ...uebersicht(), hochgeladen: r.name });
  }));
  app.post("/api/dokwissen/ordner", (req, res) => res.json(ordnerOeffnen()));
  app.get("/api/dokwissen/datei/:id", (req, res) => {
    const p = dateiPfad(req.params.id);
    if (!p) return res.status(404).json({ error: "Datei nicht gefunden." });
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(path.basename(p))}`);
    res.sendFile(p);
  });
  app.get("/api/dokwissen/text/:id", (req, res) => {
    const d = idx.docs[req.params.id];
    if (!d) return res.status(404).json({ error: "Nicht gefunden." });
    const seite = req.query.seite ? Number(req.query.seite) : null;
    const teile = idx.chunks.filter((c) => c.doc === d.id && (!seite || c.seite === seite)).map((c) => ({ seite: c.seite, text: c.text }));
    res.json({ name: d.name, quelle: d.quelle, teile: teile.slice(0, 60) });
  });
  app.delete("/api/dokwissen/:id", asyncRoute(async (req, res) => {
    const r = await entfernen(req.params.id);
    if (r.error) return res.status(400).json(r);
    res.json(uebersicht());
  }));
}
