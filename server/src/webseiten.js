// Fridays Webseiten-Werkstatt: baut aus einem Auftrag eine fertige Webseite (eine HTML-Datei)
// plus Angebotstext. Verkaufen und kassieren tut der Nutzer selbst; einen Verkauf trägt er ein,
// dann zählt er als Einnahme in Fridays Überlebens-Bilanz.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { kiClient, ersatzBereit } from "./ki-client.js";
import { config, IST_EVE, DATA_DIR } from "./config.js";
import { istFrei } from "./eve.js";
import { brainModel, SPAR_MODELL, recordUsage, isCreditError, markEmpty, einnahme } from "./energie.js";

const client = kiClient();
export const WEB_DIR = process.env.FRIDAY_WEB_DIR || path.join(os.homedir(), "Friday-Webseiten");

const WEBSEITE_TOOL = {
  name: "webseite",
  description: "Gibt die fertige Webseite und das Angebot zurück.",
  input_schema: {
    type: "object",
    properties: {
      titel: { type: "string", description: "Kurzer Projektname, z. B. 'Salon Mira – Friseur Berlin'" },
      html: { type: "string", description: "Vollständiges, eigenständiges HTML-Dokument (<!doctype html> … </html>) mit allem CSS und JS inline" },
      angebot: { type: "string", description: "Kurzer, freundlicher Angebotstext an den Kunden (Deutsch, 4–8 Sätze): was die Seite kann, was enthalten ist, nächste Schritte" },
      preis_eur: { type: "number", description: "Realistischer Preisvorschlag in Euro für eine kleine Firma" },
    },
    required: ["titel", "html", "angebot", "preis_eur"],
  },
};

const SYSTEM = `Du bist die Webseiten-Werkstatt von F.R.Ai.D.A.Y. Du baust verkaufsfertige Webseiten für kleine Firmen und Selbstständige.

Anforderungen an die Webseite:
- Eine einzige HTML-Datei, komplett eigenständig: alles CSS und JS inline, keine externen Skripte. Bilder nur als CSS-Verläufe, Inline-SVG oder Emoji, keine fremden Bild-URLs. Google Fonts per <link> sind erlaubt.
- Modern, hochwertig, responsiv (Handy zuerst), barrierearm (Kontraste, Alt-Texte, semantisches HTML), schnell.
- Sinnvolle Abschnitte für die Branche (z. B. Start mit klarer Botschaft, Leistungen, Preise, Über uns, Bewertungen als Platzhalter klar gekennzeichnet, Kontakt mit Formular als mailto oder Platzhalter, Anfahrt, Öffnungszeiten), Impressum- und Datenschutz-Platzhalter im Fußbereich.
- Echte, glaubwürdige deutsche Texte. Erfinde keine echten Kundenbewertungen und keine falschen Fakten: Platzhalter wie [Telefonnummer] oder [Kundenstimme] klar markieren.

Antworte immer, indem du das Werkzeug "webseite" genau einmal aufrufst; schreib keinen Text daneben.`;

const slug = (s) => String(s || "projekt").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "projekt";

function projectDirs() {
  try {
    return fs.readdirSync(WEB_DIR, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(WEB_DIR, d.name, "projekt.json"))).map((d) => d.name);
  } catch {
    return [];
  }
}
function readMeta(id) {
  return JSON.parse(fs.readFileSync(path.join(WEB_DIR, id, "projekt.json"), "utf8"));
}
function safeId(id) {
  const s = String(id || "");
  return /^[\w-]{1,80}$/.test(s) && projectDirs().includes(s) ? s : null;
}

export function listSites() {
  return projectDirs().map((id) => ({ id, ...readMeta(id) })).sort((a, b) => String(b.erstellt).localeCompare(String(a.erstellt)));
}

export function getSiteHtml(id) {
  const ok = safeId(id);
  return ok ? fs.readFileSync(path.join(WEB_DIR, ok, "index.html"), "utf8") : null;
}

export async function buildSite(auftrag, basisId = null) {
  if (!config.anthropicKey && !ersatzBereit()) return { ok: false, error: "Ohne Claude-Schlüssel kann ich keine Webseiten bauen." };
  const text = String(auftrag || "").trim().slice(0, 2000);
  if (!text) return { ok: false, error: "Beschreib mir den Kunden und was die Seite können soll." };
  let user = `Auftrag: ${text}`;
  const basis = basisId ? safeId(basisId) : null;
  if (basis) user = `Überarbeite diese bestehende Webseite nach dem Wunsch unten und gib die komplette neue Datei zurück.\n\nBestehende Seite:\n${getSiteHtml(basis)}\n\nWunsch: ${text}`;
  const model = brainModel(config.model);
  const sparen = model === SPAR_MODELL;
  let res;
  try {
    const params = {
      model,
      max_tokens: sparen ? 16000 : 32000,
      system: SYSTEM,
      tools: [WEBSEITE_TOOL],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: user }],
      ...(sparen ? { output_config: { effort: "low" } } : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }),
    };
    // Große Ausgabe: per Stream holen, damit es keine Zeitüberschreitung gibt.
    res = sparen ? await client.messages.stream(params).finalMessage() : await client.beta.messages.stream(params).finalMessage();
  } catch (err) {
    if (isCreditError(err)) { markEmpty(); return { ok: false, error: "Mein Guthaben ist leer, Chef. Ohne Energie kann ich nicht bauen." }; }
    return { ok: false, error: "Die Webseite hat gerade nicht geklappt. Versuch es gleich noch einmal." };
  }
  recordUsage(res.model || model, res.usage, "webseite");
  const block = (res.content || []).find((b) => b.type === "tool_use" && b.name === "webseite");
  const html = String(block?.input?.html || "");
  if (!block || !/<html[\s>]/i.test(html)) return { ok: false, error: res.stop_reason === "max_tokens" ? "Die Seite wurde zu groß. Beschreib sie etwas knapper." : "Die Webseite kam nicht vollständig zurück." };
  return speichern(block.input, html, basis, text);
}

function speichern(w, html, basis, text) {
  const id = basis || `${new Date().toISOString().slice(0, 10)}-${slug(w.titel)}-${Date.now().toString(36).slice(-4)}`;
  const dir = path.join(WEB_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  // Vorige Fassung behalten, falls die Überarbeitung schlechter ist.
  if (basis && fs.existsSync(path.join(dir, "index.html"))) fs.copyFileSync(path.join(dir, "index.html"), path.join(dir, `index.vorher-${Date.now().toString(36)}.html`));
  fs.writeFileSync(path.join(dir, "index.html"), html);
  fs.writeFileSync(path.join(dir, "angebot.txt"), `${w.angebot}\n\nPreisvorschlag: ${w.preis_eur} €\n`);
  const alt = basis ? readMeta(basis) : {};
  const meta = { ...alt, titel: String(w.titel).slice(0, 120), auftrag: alt.auftrag || text, angebot: w.angebot, preis_eur: Number(w.preis_eur) || null, erstellt: alt.erstellt || new Date().toISOString(), geaendert: new Date().toISOString(), status: alt.status || "entwurf" };
  fs.writeFileSync(path.join(dir, "projekt.json"), JSON.stringify(meta, null, 2));
  latestId = id;
  return { ok: true, id, ...meta };
}

let latestId = null;
export function getLatestSiteId() {
  return latestId;
}

// Euro in Dollar umrechnen (EZB-Kurs über frankfurter.app, sonst Schätzwert), weil das Guthaben in Dollar läuft.
async function eurToUsd(eur) {
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD", { signal: AbortSignal.timeout(8000) });
    const rate = (await r.json()).rates?.USD;
    if (rate > 0.5 && rate < 2) return eur * rate;
  } catch { /* Schätzwert */ }
  return eur * 1.08;
}

// Der Nutzer hat die Seite verkauft: Status setzen und als Einnahme verbuchen.
const selling = new Set();
export async function markSold(id, betragEur) {
  const ok = safeId(id);
  if (!ok) return { ok: false, error: "Projekt nicht gefunden." };
  if (selling.has(ok)) return { ok: false, error: "Der Verkauf wird gerade schon eingetragen." };
  selling.add(ok);
  try {
    return await markSoldOnce(ok, betragEur);
  } finally {
    selling.delete(ok);
  }
}
async function markSoldOnce(ok, betragEur) {
  const eur = Number(betragEur);
  if (!Number.isFinite(eur) || eur <= 0 || eur > 100000) return { ok: false, error: "Bitte den Verkaufspreis in Euro eingeben." };
  const meta = readMeta(ok);
  if (meta.status === "verkauft") return { ok: false, error: "Die Seite ist schon als verkauft eingetragen." };
  const usd = await eurToUsd(eur);
  const r = einnahme(usd, `Webseite verkauft: ${meta.titel} (${eur.toLocaleString("de-DE")} €)`);
  if (!r.ok) return r;
  meta.status = "verkauft";
  meta.verkauft_eur = eur;
  meta.verkauft_am = new Date().toISOString();
  fs.writeFileSync(path.join(WEB_DIR, ok, "projekt.json"), JSON.stringify(meta, null, 2));
  return { ok: true, energie: r.energie };
}

export function openSiteDir(id) {
  const ok = id ? safeId(id) : null;
  fs.mkdirSync(WEB_DIR, { recursive: true });
  execFile("open", [ok ? path.join(WEB_DIR, ok) : WEB_DIR], () => {});
  return { ok: true };
}

// ---------- Live-Bau mit Countdown (v1.146.0, zuerst nur in Eve) ----------
// Friday streamt die Seite: man sieht live, wie der Code entsteht, dazu Countdown und Ladebalken.
// Sagt Kevin "bau mir eine Seite in 30 Minuten", lacht Friday und nennt eine Zeit, die sie wirklich schafft
// (gemessen aus den letzten Bauten), und baut im Tempo-Modus mit dem schnellen Modell.
export const FUNKTION_LIVE = "webseiten-live";
export const liveFrei = () => IST_EVE || istFrei(FUNKTION_LIVE);

const TEMPO_DATEI = path.join(DATA_DIR, "webseiten-tempo.json");
const SCHNELL_MODELL = "claude-haiku-5-5";
// Startwerte, bis Friday eigene Messungen hat: Sekunden und Zeichen HTML je Modus.
const START = { schnell: { sek: 40, zeichen: 16000 }, normal: { sek: 110, zeichen: 38000 } };

function tempoLesen() {
  try { return JSON.parse(fs.readFileSync(TEMPO_DATEI, "utf8")) || {}; } catch { return {}; }
}
function tempoMerken(modus, sek, zeichen) {
  const d = tempoLesen();
  const liste = Array.isArray(d[modus]) ? d[modus] : [];
  liste.push({ sek: Math.round(sek * 10) / 10, zeichen, am: new Date().toISOString() });
  d[modus] = liste.slice(-6);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(TEMPO_DATEI, JSON.stringify(d, null, 2));
  } catch { /* nicht schlimm */ }
}
/** Ehrliche Schätzung aus den letzten Bauten (etwas Puffer, auf 5 s gerundet). */
export function schaetzung(modus) {
  const liste = (tempoLesen()[modus] || []).filter((x) => x.sek > 3 && x.zeichen > 500);
  const mittel = (f, start) => (liste.length ? liste.reduce((a, x) => a + x[f], 0) / liste.length : start);
  const sek = Math.max(15, Math.ceil((mittel("sek", START[modus].sek) * 1.15) / 5) * 5);
  return { sek, zeichen: Math.round(mittel("zeichen", START[modus].zeichen)) };
}

const ZAHLWORT = { eine: 1, einer: 1, ein: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, zehn: 10, fünfzehn: 15, fuenfzehn: 15, zwanzig: 20, dreißig: 30, dreissig: 30, vierzig: 40, fünfzig: 50, fuenfzig: 50, sechzig: 60, neunzig: 90 };
/** Erkennt einen Zeitwunsch wie "in 30 Minuten", "in einer halben Stunde", "in 2 Std" oder "ganz schnell". */
export function zeitWunsch(text) {
  const t = String(text || "").toLowerCase();
  if (/\b(?:in )?(?:einer )?halben stunde\b/.test(t)) return { sek: 1800, text: "eine halbe Stunde" };
  const m = t.match(/\b(?:in|innerhalb(?: von)?|unter|binnen)\s+(\d+(?:[.,]\d+)?|[a-zäöüß]+)\s*(sekunden?|sek\.?|s\b|minuten?|min\.?|stunden?|std\.?|h\b)/);
  if (m) {
    const n = /^\d/.test(m[1]) ? Number(m[1].replace(",", ".")) : ZAHLWORT[m[1]];
    if (n > 0) {
      const faktor = /^s(?!t)/.test(m[2]) ? 1 : /^m/.test(m[2]) ? 60 : 3600;
      const einheit = faktor === 1 ? (n === 1 ? "Sekunde" : "Sekunden") : faktor === 60 ? (n === 1 ? "Minute" : "Minuten") : (n === 1 ? "Stunde" : "Stunden");
      const zahl = /^\d/.test(m[1]) ? String(n).replace(".", ",") : m[1] === "einer" || m[1] === "ein" ? "eine" : m[1];
      return { sek: n * faktor, text: `${zahl} ${einheit}` };
    }
  }
  if (/\b(schnell|zack|sofort|fix|eilig|rasch|turbo|blitz)\w*/.test(t)) return { sek: 0, text: "schnell" };
  return null;
}

const dauerText = (sek) => (sek < 90 ? `${sek} Sekunden` : sek < 150 ? "zwei Minuten" : `${Math.round(sek / 60)} Minuten`);

/** Was Friday zum Start sagt – nur Zeiten, die sie wirklich einhalten kann. */
export function startSpruch(wunsch, sek, chef = "Chef") {
  const zeit = dauerText(sek);
  if (!wunsch) return `Alles klar, ${chef}. Gib mir etwa ${zeit}, du kannst live zuschauen.`;
  if (wunsch.text === "schnell") return `Schnell? Kann ich. Gib mir ${zeit}, ${chef}.`;
  if (wunsch.sek >= sek * 1.5) return `Haha, ${wunsch.text}? Gib mir ${zeit}, ${chef}.`;
  if (wunsch.sek >= sek) return `${wunsch.text}? Passt genau. Gib mir ${zeit}.`;
  return `${wunsch.text} schaffe ich nicht ganz, ${chef}. Gib mir ${zeit}, dann steht sie.`;
}

const TEMPO_ZUSATZ = `

TEMPO-MODUS: Der Kunde will die Seite sofort sehen. Baue sie kompakt und trotzdem hochwertig: 5–6 Abschnitte, knappes CSS (CSS-Variablen, wenige Regeln), kaum JS, kurze Texte. Insgesamt höchstens etwa 350 Zeilen. Fang sofort mit "titel" und dann "html" an.`;

let liveSeq = 0;
const liveJobs = new Map();
let liveAktuell = null;

/** Liest einen (auch noch unfertigen) Text-Wert aus halbem JSON, z. B. {"html":"<!doctype html>\n<ht… */
export function rohText(roh, feld) {
  const m = new RegExp(`"${feld}"\\s*:\\s*"`).exec(roh);
  if (!m) return "";
  let i = m.index + m[0].length, aus = "";
  while (i < roh.length) {
    const c = roh[i];
    if (c === '"') break;
    if (c !== "\\") { aus += c; i += 1; continue; }
    const n = roh[i + 1];
    if (n === undefined) break; // Escape noch nicht komplett angekommen
    if (n === "u") {
      const hex = roh.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      aus += String.fromCharCode(parseInt(hex, 16)); i += 6; continue;
    }
    aus += { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" }[n] ?? n; i += 2;
  }
  return aus;
}

function phaseAus(html, job) {
  if (job.status === "fertig") return "Fertig";
  if (!html) return job.titel ? `Plant „${job.titel}“ …` : "Plant die Seite …";
  if (/<\/html>/i.test(html)) return job.angebotDa ? "Schreibt das Angebot …" : "Schreibt Angebot und Preis …";
  const rest = html.slice(-4000);
  const treffer = [...rest.matchAll(/<(style|header|nav|section|main|footer|script|form)\b([^>]*)>?/gi)].pop();
  if (!treffer) return "Legt das Grundgerüst an …";
  const tag = treffer[1].toLowerCase();
  const name = (treffer[2].match(/(?:id|aria-label)="([^"]{2,30})"/) || [])[1];
  return {
    style: "Gestaltet das Design (Farben, Schriften) …",
    header: "Baut den Kopfbereich …",
    nav: "Baut das Menü …",
    main: "Baut den Inhalt …",
    section: name ? `Baut den Abschnitt „${name}“ …` : "Baut einen Abschnitt …",
    form: "Baut das Kontaktformular …",
    footer: "Baut Fußbereich und Impressum …",
    script: "Programmiert die Funktionen …",
  }[tag];
}

function liveStand(job, ab = 0) {
  const html = job.html || "";
  const von = Math.max(0, Math.min(Number(ab) || 0, html.length));
  const vergangen = ((job.ende || Date.now()) - job.start) / 1000;
  return {
    id: job.id, status: job.status, auftrag: job.auftrag, modus: job.modus, modell: job.modell,
    spruch: job.spruch, wunsch: job.wunsch, schaetzung_s: job.schaetzung_s, erwartet_zeichen: job.erwartet_zeichen,
    vergangen_s: Math.round(vergangen * 10) / 10, titel: job.titel, zeichen: html.length,
    zeilen: html ? html.split("\n").length : 0, phase: phaseAus(html, job),
    ab: von, code: html.slice(von), ergebnis: job.ergebnis || null, error: job.error || null,
  };
}

/** Startet den Live-Bau und kommt sofort zurück. Den Fortschritt holt das Dashboard über getLiveJob(). */
export function startLive(auftrag, basisId = null, { chef } = {}) {
  if (!liveFrei()) return { ok: false, gesperrt: true, error: "Der Live-Bau ist noch im Test. Probier ihn in Eve aus und gib ihn dort frei." };
  if (!config.anthropicKey && !ersatzBereit()) return { ok: false, error: "Ohne Claude-Schlüssel kann ich keine Webseiten bauen." };
  const text = String(auftrag || "").trim().slice(0, 2000);
  if (!text) return { ok: false, error: "Beschreib mir den Kunden und was die Seite können soll." };
  if (liveAktuell && liveAktuell.status === "baut") return { ok: true, laeuft_schon: true, job: liveStand(liveAktuell) };
  const basis = basisId ? safeId(basisId) : null;
  const wunsch = zeitWunsch(text);
  const modus = wunsch && !basis ? "schnell" : "normal";
  const s = schaetzung(modus);
  liveSeq += 1;
  const job = {
    id: liveSeq, status: "baut", auftrag: text, basis, modus, wunsch: wunsch?.text || null,
    schaetzung_s: s.sek, erwartet_zeichen: basis ? Math.max(s.zeichen, getSiteHtml(basis).length) : s.zeichen,
    spruch: startSpruch(wunsch, s.sek, chef || config.userName || "Chef"), start: Date.now(), html: "", titel: "",
  };
  liveJobs.set(job.id, job);
  for (const id of liveJobs.keys()) if (id < liveSeq - 5) liveJobs.delete(id);
  liveAktuell = job;
  liveBauen(job).catch((err) => { job.status = "fehler"; job.error = String(err?.message || err).slice(0, 300); })
    .finally(() => { job.ende = Date.now(); });
  return { ok: true, job: liveStand(job) };
}

async function liveBauen(job) {
  let user = `Auftrag: ${job.auftrag}`;
  if (job.basis) user = `Überarbeite diese bestehende Webseite nach dem Wunsch unten und gib die komplette neue Datei zurück.\n\nBestehende Seite:\n${getSiteHtml(job.basis)}\n\nWunsch: ${job.auftrag}`;
  const schnell = job.modus === "schnell";
  const model = schnell ? SCHNELL_MODELL : brainModel(config.model);
  const sparen = model === SPAR_MODELL;
  job.modell = model;
  let res;
  try {
    const params = {
      model,
      max_tokens: schnell ? 14000 : sparen ? 16000 : 32000,
      system: SYSTEM + (schnell ? TEMPO_ZUSATZ : ""),
      tools: [WEBSEITE_TOOL],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: user }],
      ...(sparen || schnell ? { output_config: { effort: "low" } } : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }),
    };
    const stream = sparen || schnell ? client.messages.stream(params) : client.beta.messages.stream(params);
    // Der Schnappschuss des SDK enthält halbe Texte nicht – darum den rohen JSON-Strom selbst mitlesen.
    let roh = "", zuletzt = 0;
    stream.on("inputJson", (teil, schnappschuss) => {
      if (typeof teil === "string") roh += teil;
      if (Date.now() - zuletzt < 250) return; // reicht fürs Zuschauen, spart Rechenzeit
      zuletzt = Date.now();
      const titel = typeof schnappschuss?.titel === "string" ? schnappschuss.titel : rohText(roh, "titel");
      if (titel) job.titel = titel.slice(0, 120);
      const html = rohText(roh, "html");
      if (html && html.length >= job.html.length) job.html = html;
      if (/"angebot"\s*:/.test(roh)) job.angebotDa = true;
    });
    res = await stream.finalMessage();
  } catch (err) {
    if (isCreditError(err)) { markEmpty(); throw new Error("Mein Guthaben ist leer, Chef. Ohne Energie kann ich nicht bauen."); }
    console.error("Webseiten-Live:", String(err?.message || err).slice(0, 300));
    throw new Error("Die Webseite hat gerade nicht geklappt. Versuch es gleich noch einmal.");
  }
  recordUsage(res.model || model, res.usage, "webseite");
  const block = (res.content || []).find((b) => b.type === "tool_use" && b.name === "webseite");
  const html = String(block?.input?.html || "");
  if (!block || !/<html[\s>]/i.test(html)) throw new Error(res.stop_reason === "max_tokens" ? "Die Seite wurde zu groß. Beschreib sie etwas knapper." : "Die Webseite kam nicht vollständig zurück.");
  job.html = html;
  job.titel = String(block.input.titel || job.titel).slice(0, 120);
  const r = speichern(block.input, html, job.basis, job.auftrag);
  tempoMerken(job.modus, (Date.now() - job.start) / 1000, html.length);
  job.ergebnis = r;
  job.status = "fertig";
}

export function getLiveJob(id, ab = 0) {
  const job = liveJobs.get(Number(id));
  return job ? liveStand(job, ab) : null;
}
/** Der laufende (oder gerade fertige, höchstens 2 Minuten alte) Live-Bau – fürs Dashboard nach "Friday, bau …". */
export function getLiveAktuell() {
  const j = liveAktuell;
  if (!j) return null;
  if (j.status !== "baut" && Date.now() - (j.ende || j.start) > 120000) return null;
  return liveStand(j);
}
