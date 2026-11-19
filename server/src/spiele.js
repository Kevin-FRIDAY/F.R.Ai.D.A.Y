// Fridays Spiele-Werkstatt: "Friday, bau mir ein Spiel …"
// Claude schreibt ein komplettes Browser-Spiel (eine HTML-Datei). Der Code kommt Stück für Stück
// (Streaming), das Dashboard zeigt live, wie Friday programmiert, und startet das Spiel danach selbst.
// Jedes Spiel liegt dauerhaft in ~/Friday-Spiele/<id>/index.html (+ spiel.json) und ist später wieder spielbar.
// Ohne Guthaben/Schlüssel gibt es ein paar eingebaute Vorlagen-Spiele – ehrlich als "Vorlage (offline)" gekennzeichnet.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { brainModel, SPAR_MODELL, recordUsage, isCreditError, markEmpty, getEnergie } from "./energie.js";
import { getSettings } from "./einstellungen.js";
import * as logbuch from "./logbuch.js";

const client = new Anthropic({ apiKey: config.anthropicKey });
export const SPIELE_DIR = process.env.FRIDAY_SPIELE_DIR || path.join(os.homedir(), "Friday-Spiele");
const VORLAGEN_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "spiele-vorlagen");

// Eingebaute Spiele für den Offline-Fall. Die Wörter entscheiden, welche Vorlage passt.
export const VORLAGEN = [
  { id: "snake", datei: "snake.html", titel: "Neon-Schlange", woerter: /snake|schlange|wurm/ },
  { id: "ziegel", datei: "ziegel.html", titel: "Ziegel-Brecher", woerter: /breakout|arkanoid|ziegel|block|bl(ö|oe)cke|steine|ball|pong|schl(ä|ae)ger/ },
  { id: "paare", datei: "paare.html", titel: "Neon-Paare", woerter: /memory|memo|paare|karten|merk|gedächtnis|gedaechtnis/ },
  { id: "meteor", datei: "meteor.html", titel: "Meteor-Abwehr", woerter: /weltraum|space|shooter|meteor|asteroid|raumschiff|rakete|alien|ballern|schie(ß|ss)/ },
];

const SYSTEM = `Du bist die Spiele-Werkstatt von F.R.Ai.D.A.Y. Du programmierst kleine, sofort spielbare Browser-Spiele.

Antworte NUR mit dem vollständigen Code einer einzigen HTML-Datei. Beginne direkt mit <!doctype html> und ende mit </html>. Kein Text davor oder danach, keine Markdown-Codeblöcke.

Anforderungen:
- Komplett eigenständig: alles CSS und JS inline, keine externen Skripte, Bilder, Schriften oder Netzwerkzugriffe. Grafik mit Canvas, CSS, Inline-SVG oder Emoji. Töne höchstens per Web Audio API (erst nach einer Berührung starten).
- Läuft in einem abgeschotteten iframe (sandbox ohne same-origin): localStorage nur in try/catch benutzen; kein alert/confirm/prompt, keine Pop-ups, kein Formular-Absenden.
- Muss auf dem iPhone (Touch) UND am Mac (Tastatur/Maus) spielbar sein: Touch-Steuerung (Wischen, Antippen oder eingeblendete Knöpfe) plus Pfeiltasten/WASD/Leertaste. touch-action: none auf der Spielfläche, viewport-Meta mit user-scalable=no, passt sich jeder Fenstergröße an (resize).
- Startbildschirm mit Titel, kurzer Anleitung auf Deutsch und Start-Knopf; Punkte-Anzeige; Game-Over mit "Nochmal"-Knopf; ggf. Rekord (localStorage, try/catch).
- Stil: schwarzer Hintergrund, Neon-Orange (#ff8a1e) als Hauptfarbe mit Glow, Türkis (#2ee6d0) als Akzent, moderne futuristische Optik. Rot nur für Gefahr/Schaden.
- Gut lesbarer, sauber eingerückter Code mit kurzen deutschen Kommentaren. Bau ein eigenes, originelles Spiel; kopiere keine Figuren, Namen oder Grafiken bekannter Spiele (allgemeine Spielideen wie "Schlange frisst Punkte" sind ok).
- Halte es kompakt (höchstens etwa 600 Zeilen), aber vollständig und fehlerfrei. Lieber einfach und rund als groß und kaputt.`;

const slug = (s) => String(s || "spiel").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "spiel";
const neueId = (titel) => `${new Date().toISOString().slice(0, 10)}-${slug(titel)}-${Date.now().toString(36).slice(-4)}`;

// ---------- Gespeicherte Spiele ----------
function spielOrdner() {
  try {
    return fs.readdirSync(SPIELE_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith(".") && fs.existsSync(path.join(SPIELE_DIR, d.name, "spiel.json")))
      .map((d) => d.name);
  } catch { return []; }
}
function leseMeta(id) {
  try { return JSON.parse(fs.readFileSync(path.join(SPIELE_DIR, id, "spiel.json"), "utf8")); } catch { return null; }
}
function sichereId(id) {
  const s = String(id || "");
  return /^[\w-]{1,80}$/.test(s) && spielOrdner().includes(s) ? s : null;
}
export function listeSpiele() {
  return spielOrdner().map((id) => ({ id, ...leseMeta(id) }))
    .filter((s) => s.titel)
    .sort((a, b) => String(b.erstellt).localeCompare(String(a.erstellt)));
}
export function spielHtml(id) {
  const ok = sichereId(id);
  if (!ok) return null;
  try {
    const meta = leseMeta(ok);
    if (meta) { meta.gespielt = new Date().toISOString(); meta.mal = (meta.mal || 0) + 1; fs.writeFileSync(path.join(SPIELE_DIR, ok, "spiel.json"), JSON.stringify(meta, null, 2)); }
  } catch { /* egal */ }
  return fs.readFileSync(path.join(SPIELE_DIR, ok, "index.html"), "utf8");
}
export function spielPfad(id) {
  const ok = sichereId(id);
  return ok ? path.join(SPIELE_DIR, ok, "index.html") : null;
}
// Spiel in den Papierkorb (~/Friday-Spiele/.Papierkorb), nicht endgültig löschen.
export function spielWegwerfen(id) {
  const ok = sichereId(id);
  if (!ok) return { ok: false, error: "Spiel nicht gefunden." };
  const korb = path.join(SPIELE_DIR, ".Papierkorb");
  fs.mkdirSync(korb, { recursive: true });
  fs.renameSync(path.join(SPIELE_DIR, ok), path.join(korb, `${ok}-${Date.now().toString(36)}`));
  logbuch.eintragen({ bereich: "spiel", titel: `Spiel in den Papierkorb: ${leseMetaKorb(ok)}`, quelle: "dashboard" });
  return { ok: true };
}
const leseMetaKorb = (id) => id.replace(/^\d{4}-\d\d-\d\d-/, "").replace(/-[a-z0-9]{4}$/, "").replace(/-/g, " ");

function speichern({ html, titel, auftrag, quelle, modell, vorlage, basis }) {
  const alt = basis ? leseMeta(basis) : null;
  const id = alt ? basis : neueId(titel);
  const dir = path.join(SPIELE_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  // Vorige Fassung behalten, falls die Änderung schlechter ist.
  if (alt && fs.existsSync(path.join(dir, "index.html"))) fs.copyFileSync(path.join(dir, "index.html"), path.join(dir, `index.vorher-${Date.now().toString(36)}.html`));
  fs.writeFileSync(path.join(dir, "index.html"), html);
  const meta = {
    titel: String(titel || "Spiel").slice(0, 80),
    auftrag: alt?.auftrag && quelle === "claude" ? `${alt.auftrag} · Änderung: ${auftrag}`.slice(0, 1000) : String(auftrag || "").slice(0, 600),
    quelle, ...(modell ? { modell } : {}), ...(vorlage ? { vorlage } : {}),
    erstellt: alt?.erstellt || new Date().toISOString(), geaendert: new Date().toISOString(),
    zeilen: html.split("\n").length, zeichen: html.length, mal: alt?.mal || 0,
  };
  fs.writeFileSync(path.join(dir, "spiel.json"), JSON.stringify(meta, null, 2));
  return { id, ...meta };
}

// Ein Spiel nach Namen finden ("öffne mein Snake-Spiel").
export function findeSpiel(name) {
  const n = slug(name).replace(/-/g, " ").replace(/\b(spiel|game|mein|meine|das|die|der)\b/g, " ").replace(/\s+/g, " ").trim();
  const liste = listeSpiele();
  if (!n) return liste[0] || null;
  const woerter = n.split(" ").filter((w) => w.length > 1);
  let best = null, bestWert = 0;
  for (const s of liste) {
    const heu = slug(`${s.titel} ${s.auftrag || ""} ${s.vorlage || ""}`).replace(/-/g, " ");
    const titel = slug(s.titel).replace(/-/g, " ");
    let wert = 0;
    for (const w of woerter) { if (titel.includes(w)) wert += 3; else if (heu.includes(w)) wert += 1; }
    if (wert > bestWert) { best = s; bestWert = wert; }
  }
  return best;
}

// ---------- Bau-Aufträge (laufen im Hintergrund, das Dashboard fragt den Stand ab) ----------
const jobs = new Map();
let letzterJob = null;

function aufraeumen() {
  const grenze = Date.now() - 30 * 60 * 1000;
  for (const [id, j] of jobs) if (j.ende && j.ende < grenze) jobs.delete(id);
}

function titelAusHtml(html, fallback) {
  const t = html.match(/<title[^>]*>([^<]{1,80})<\/title>/i)?.[1]?.trim();
  return t || fallback || "Mein Spiel";
}
function saeubern(roh) {
  let s = String(roh || "");
  const start = s.search(/<!doctype html|<html[\s>]/i);
  if (start > 0) s = s.slice(start);
  const ende = s.search(/<\/html>/i);
  if (ende >= 0) s = s.slice(0, ende + 7);
  return s.trim() + "\n";
}

function passendeVorlage(auftrag) {
  const t = String(auftrag || "").toLowerCase();
  return VORLAGEN.find((v) => v.woerter.test(t)) || null;
}

// Hat Friday gerade Energie für Claude?
export function claudeBereit() {
  return Boolean(config.anthropicKey) && getEnergie().zustand !== "tot";
}

/**
 * Startet den Bau eines Spiels.
 * @param {string} auftrag - z. B. "bau mir ein Snake-Spiel mit Power-ups"
 * @param {{basis?:string, kanal?:string, vorlage?:string}} [opt] - basis = vorhandenes Spiel ändern
 */
export function starteSpiel(auftrag, opt = {}) {
  aufraeumen();
  const text = String(auftrag || "").trim().slice(0, 1500);
  const basis = opt.basis ? sichereId(opt.basis) : null;
  for (const j of jobs.values()) if (!j.ende) return { ok: true, jobId: j.id, laeuftSchon: true, quelle: j.quelle, titel: j.titel };
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const vorlageWunsch = opt.vorlage ? VORLAGEN.find((v) => v.id === opt.vorlage) : null;
  const mitClaude = !vorlageWunsch && claudeBereit();
  if (basis && !mitClaude) return { ok: false, error: "Spiele ändern kann ich nur mit Claude-Guthaben, Boss. Die Vorlagen bleiben, wie sie sind." };
  const job = { id, auftrag: text || "ein Spiel", basis, code: "", status: "schreibt", quelle: mitClaude ? "claude" : "vorlage", start: Date.now(), kanal: opt.kanal || "web", titel: null, hinweis: "" };
  jobs.set(id, job);
  letzterJob = id;
  if (mitClaude) bauMitClaude(job).catch((err) => fehler(job, err));
  else bauAusVorlage(job, vorlageWunsch, config.anthropicKey ? "Mein Guthaben ist leer" : "Ohne Claude-Schlüssel").catch((err) => fehler(job, err));
  return { ok: true, jobId: id, quelle: job.quelle, basis: Boolean(basis) };
}

function fehler(job, err) {
  if (job.ende) return;
  job.status = "fehler";
  job.error = String(err?.message || err || "Unbekannter Fehler").slice(0, 300);
  job.ende = Date.now();
  logbuch.eintragen({ bereich: "spiel", titel: `Spiel bauen fehlgeschlagen: ${job.auftrag}`, details: job.error, quelle: job.quelle === "claude" ? "claude" : "offline", kanal: job.kanal, ok: false, dauer_ms: job.ende - job.start });
}

async function bauMitClaude(job) {
  const tempo = getSettings().tempo;
  const gewuenscht = tempo === "gruendlich" ? config.model : "claude-sonnet-5-5";
  const model = brainModel(gewuenscht);
  const sparen = model === SPAR_MODELL && gewuenscht !== SPAR_MODELL;
  job.modell = model;
  let user = `Auftrag von Boss: ${job.auftrag}`;
  if (job.basis) {
    const altHtml = fs.readFileSync(path.join(SPIELE_DIR, job.basis, "index.html"), "utf8");
    user = `Hier ist ein bestehendes Spiel. Ändere es nach dem Wunsch unten und gib die komplette neue HTML-Datei zurück.\n\nWunsch: ${job.auftrag}\n\nBestehendes Spiel:\n${altHtml}`;
  }
  const params = {
    model,
    max_tokens: sparen ? 12000 : 24000,
    system: SYSTEM,
    output_config: { effort: sparen ? "low" : "medium" },
    messages: [{ role: "user", content: user }],
  };
  let msg;
  try {
    const stream = client.messages.stream(params);
    // job.code wächst nur (das Dashboard holt ab einer Stelle nach). Ein ```html-Anfang wird vorher abgeschnitten.
    let roh = "", praefixFertig = false;
    stream.on("text", (t) => {
      if (praefixFertig) { job.code += t; roh += t; return; }
      roh += t;
      if (roh.length < 16 && !roh.includes("<")) return;
      job.code = roh.replace(/^\s*```[\w-]*[ \t]*\n?/, "");
      praefixFertig = true;
    });
    msg = await stream.finalMessage();
  } catch (err) {
    if (isCreditError(err)) {
      markEmpty();
      // Ehrlich umschalten: Guthaben leer → Vorlage statt Claude.
      job.code = "";
      job.quelle = "vorlage";
      return bauAusVorlage(job, null, "Mein Guthaben ist gerade leer geworden");
    }
    throw new Error("Claude ist gerade nicht erreichbar. Versuch es gleich noch einmal.");
  }
  recordUsage(msg.model || model, msg.usage, "spiel");
  const html = saeubern((msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("") || job.code);
  if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) {
    throw new Error(msg.stop_reason === "max_tokens" ? "Das Spiel wurde zu groß. Beschreib es etwas einfacher." : "Der Code kam nicht vollständig zurück.");
  }
  fertig(job, html, titelAusHtml(html, job.auftrag), { quelle: "claude", modell: msg.model || model });
}

// Offline: Vorlage nehmen und sichtbar "einspielen" (gleiche Live-Ansicht, aber ehrlich gekennzeichnet).
async function bauAusVorlage(job, wunsch, grund) {
  job.quelle = "vorlage";
  let v = wunsch;
  if (!v && job.basis) v = VORLAGEN.find((x) => x.id === leseMeta(job.basis)?.vorlage) || null;
  if (!v) v = passendeVorlage(job.auftrag);
  const passt = Boolean(v);
  if (!v) v = VORLAGEN[0];
  job.vorlage = v.id;
  job.hinweis = wunsch
    ? `Vorlage ${v.titel} (eingebaut, ohne Claude).`
    : passt
      ? `${grund}: Ich spiele meine eingebaute Vorlage ${v.titel} ein. Für ein ganz eigenes Spiel brauche ich Claude-Guthaben.`
      : `${grund}: Dein Wunschspiel kann ich ohne Claude nicht programmieren. Hier ist meine eingebaute Vorlage ${v.titel}.`;
  const html = fs.readFileSync(path.join(VORLAGEN_DIR, v.datei), "utf8");
  // In Häppchen ausgeben, damit man sieht, wie der Code entsteht (ca. 3 Sekunden).
  const stueck = Math.max(60, Math.ceil(html.length / 34));
  for (let i = 0; i < html.length; i += stueck) {
    job.code = html.slice(0, i + stueck);
    await new Promise((r) => setTimeout(r, 90));
  }
  job.code = html;
  fertig(job, html, v.titel, { quelle: "vorlage", vorlage: v.id });
}

function fertig(job, html, titel, { quelle, modell, vorlage }) {
  // Eine Vorlage liegt nur einmal in der Sammlung: dieselbe wieder einspielen ersetzt die alte Kopie.
  if (!job.basis && quelle === "vorlage") job.basis = listeSpiele().find((x) => x.quelle === "vorlage" && x.vorlage === vorlage)?.id || null;
  const s = speichern({ html, titel, auftrag: job.auftrag, quelle, modell, vorlage, basis: job.basis });
  // job.code bleibt, wie er gestreamt wurde (nur anhängen!). Die saubere Fassung holt das Dashboard über /api/spiel/:id/html.
  job.titel = s.titel;
  job.spielId = s.id;
  job.status = "fertig";
  job.ende = Date.now();
  logbuch.eintragen({
    bereich: "spiel",
    titel: `${job.basis ? "Spiel geändert" : "Spiel gebaut"}: ${s.titel}`,
    details: `${quelle === "claude" ? `Von Claude programmiert (${modell})` : "Eingebaute Vorlage (offline)"} · ${s.zeilen} Zeilen · Auftrag: ${job.auftrag}`,
    quelle: quelle === "claude" ? "claude" : "offline",
    claude: quelle === "claude",
    kanal: job.kanal,
    dauer_ms: job.ende - job.start,
    aktionen: ["spiel_bauen"],
  });
}

// Stand eines Auftrags: Code ab Zeichen "ab" (damit das Dashboard nur Neues holt).
export function jobStand(id, ab = 0) {
  const j = jobs.get(String(id || ""));
  if (!j) return null;
  const von = Math.max(0, Math.min(Number(ab) || 0, j.code.length));
  return {
    id: j.id, status: j.status, quelle: j.quelle, modell: j.modell || null, vorlage: j.vorlage || null, hinweis: j.hinweis || "",
    auftrag: j.auftrag, basis: j.basis, titel: j.titel, spielId: j.spielId || null, error: j.error || null,
    laenge: j.code.length, ab: von, stueck: j.code.slice(von), sekunden: Math.round(((j.ende || Date.now()) - j.start) / 1000),
  };
}
export function aktuellerJob() {
  const j = letzterJob && jobs.get(letzterJob);
  return j ? { id: j.id, status: j.status, titel: j.titel, spielId: j.spielId || null, quelle: j.quelle } : null;
}

// ---------- Sprachbefehle (ohne Claude) ----------
const normal = (text) => String(text || "").toLowerCase()
  .replace(/[„“”"'!?.,:;]/g, " ").replace(/\s+/g, " ").trim()
  .replace(/^(?:hey |hallo |hi |ok |okay )?(?:friday|freitag|fraiday)(?: |$)/, "").trim()
  .replace(/^(?:bitte |kannst du (?:mir )?(?:bitte )?|könntest du (?:mir )?(?:bitte )?|würdest du (?:mir )?)/, "").trim();

const SPIEL_WORT = /(?:^|[\s-])[a-zäöüß]*(?:spiel|spielchen|game|games)(?=$|\s|-)/;
const BAU_VERB = /\b(?:bau|baue|baust|bauen|programmier|programmiere|programmierst|programmieren|mach|mache|machst|erstell|erstelle|erstellst|entwickel|entwickle|entwickelst|schreib|schreibe|code|coden|kreier|erfinde|erfinden)\b/;

/** @returns {null | {answer:string, actions:string[]}} */
export function quickCommand(text, kanal = "web") {
  const t = normal(text);
  if (!t || t.length > 400 || /beispiel|spielplan|fu(ß|ss)ballspiel(?:e)? (?:heute|morgen|ergebnis)|spielstand|playlist/.test(t)) return null;
  const hatSpiel = SPIEL_WORT.test(t);

  // Spiele-Werkstatt / Liste öffnen
  if (/^(?:öffne|oeffne|zeig|zeige|mach)(?: mir)?(?: mal)? (?:die |deine |meine |fridays )?(?:spiele ?werkstatt|spiele|games|spielesammlung|spielesammlung)(?: auf| bitte)?$/.test(t)
    || /^(?:welche|was für) spiele (?:hast du|habe ich|gibt es)(?: schon)?(?: gebaut)?$/.test(t)) {
    const n = listeSpiele().length;
    return { answer: n ? `Hier ist deine Spiele-Werkstatt, Boss. ${n === 1 ? "Ein Spiel" : `${n} Spiele`} liegen bereit.` : "Hier ist die Spiele-Werkstatt, Boss. Noch leer. Sag einfach: Bau mir ein Spiel.", actions: ["spiele"] };
  }

  // Vorhandenes Spiel öffnen: "öffne mein Snake-Spiel", "lass uns Snake spielen", "starte das Weltraumspiel"
  const oeffnen = t.match(/^(?:öffne|oeffne|starte|start|zeig|zeige|lade)(?: mir)?(?: mal)? (?:mein|meine|meinen|das|dein|unser) (.+)$/)
    || t.match(/^(?:lass uns|ich will|ich möchte|ich moechte) (?:mein |das |nochmal |noch mal |wieder )*(.+?) spielen$/);
  if (oeffnen && !BAU_VERB.test(t.split(" ")[0])) {
    const name = oeffnen[1].replace(/\b(?:spiel|spielchen|game)\b/g, "").replace(/-?spiel$/, "").replace(/-$/, "").trim();
    if (hatSpiel || /spielen$/.test(t)) {
      const s = findeSpiel(name);
      if (s) return { answer: `${s.titel} startet, Boss. Viel Spaß!`, actions: [`spiel:${s.id}`] };
      if (hatSpiel) return { answer: `Ich finde kein Spiel namens ${name || "so"}. Sag: Bau mir ein ${name || "neues"}-Spiel, dann programmiere ich es.`, actions: ["spiele"] };
    }
  }

  // Letztes Spiel ändern: "mach das Spiel schneller", "änder mein Spiel: mehr Gegner"
  const aendern = t.match(/^(?:mach|mache|änder|ändere|aender|aendere|verbesser|verbessere|überarbeite|ueberarbeite)(?: mal)? (?:das|mein|dein|unser) (?:letzte |neue )?spiel (.+)$/);
  if (aendern) {
    const s = listeSpiele()[0];
    if (s) {
      if (!claudeBereit()) return { answer: `Spiele ändern kann ich nur mit Claude-Guthaben, Boss. ${s.titel} starte ich dir so, wie es ist.`, actions: [`spiel:${s.id}`] };
      const r = starteSpiel(aendern[1], { basis: s.id, kanal });
      return antwortStart(r, kanal, `Ich ändere ${s.titel}`);
    }
  }

  // Neues Spiel bauen: "bau mir ein Spiel", "programmier mir ein Snake-Spiel", "mach mir ein Weltraum-Game"
  if (hatSpiel && BAU_VERB.test(t)) {
    const r = starteSpiel(t, { kanal });
    return antwortStart(r, kanal);
  }
  return null;
}

function antwortStart(r, kanal, wasStatt) {
  if (r.laeuftSchon) return { answer: "Ich programmiere gerade schon ein Spiel, Boss. Schau zu, gleich ist es fertig.", actions: [`spiel_bauen:${r.jobId}`] };
  const web = kanal === "web";
  const wo = web ? "Schau zu, wie ich programmiere. Sobald der Code steht, startet das Spiel." : "Öffne gleich das Dashboard, dort liegt es in der Spiele-Werkstatt.";
  const answer = r.quelle === "claude"
    ? `${wasStatt || "Ich programmiere dir das Spiel"}, Boss. ${wo}`
    : `Ohne Claude-Guthaben nehme ich eine meiner eingebauten Vorlagen, Boss. ${wo}`;
  return { answer, actions: [`spiel_bauen:${r.jobId}`] };
}
