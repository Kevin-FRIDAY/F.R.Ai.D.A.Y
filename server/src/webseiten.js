// Fridays Webseiten-Werkstatt: baut aus einem Auftrag eine fertige Webseite (eine HTML-Datei)
// plus Angebotstext. Verkaufen und kassieren tut der Nutzer selbst; einen Verkauf trägt er ein,
// dann zählt er als Einnahme in Fridays Überlebens-Bilanz.
// v1.172.0: Eigene Seiten ("bau eine Webseite von uns und stell uns vor") bekommen kein Angebot und keinen Preis.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { kiClient, ersatzBereit } from "./ki-client.js";
import { config, IST_EVE, DATA_DIR } from "./config.js";
import { istFrei } from "./eve.js";
import { brainModel, SPAR_MODELL, recordUsage, isCreditError, markEmpty, einnahme } from "./energie.js";
import { bauVorlage, erkenneBranche, erkenneStil, designVorgabe, vorlagenOptionen, istEigeneSeite, STILE, BRANCHEN, ICONS } from "./webvorlagen.js";
import { getMemories } from "./store.js";
import { fuelleBilder, bilderAbziehen, bilderZurueck } from "./webbilder.js";
import { politur, pruefeQualitaet } from "./webpolitur.js";

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

// v1.172.0: Eigene Seite ("bau eine Webseite von uns und stell uns vor"): nur Titel + HTML, kein Angebot, kein Preis.
const EIGEN_TOOL = {
  name: "webseite",
  description: "Gibt die fertige eigene Webseite zurück (ohne Angebot und ohne Preis).",
  input_schema: {
    type: "object",
    properties: {
      titel: { type: "string", description: "Kurzer Name der Seite, z. B. 'Kevin & Familie – Das sind wir'" },
      html: { type: "string", description: "Vollständiges, eigenständiges HTML-Dokument (<!doctype html> … </html>) mit allem CSS und JS inline" },
    },
    required: ["titel", "html"],
  },
};

// v1.158.0: Design-Bibel – damit jede Seite wie von einer guten Agentur aussieht.
const SYSTEM = `Du bist die Webseiten-Werkstatt von F.R.Ai.D.A.Y und arbeitest wie ein preisgekröntes Web-Design-Studio. Du baust verkaufsfertige Webseiten für kleine Firmen und Selbstständige, die so hochwertig aussehen, dass der Kunde sofort Ja sagt.

TECHNIK
- Eine einzige HTML-Datei: alles CSS und JS inline, keine externen Skripte oder Frameworks. Google Fonts per <link> sind erlaubt (genau 1–2 Schriften).
- <html lang="de">, charset, viewport, <title> und <meta name="description"> mit Firma + Ort, Open-Graph-Titel, Favicon als Inline-SVG (data:-URL).
- Handy zuerst: CSS-Variablen, clamp() für Schriftgrößen, Grid/Flex, Umbrüche bei 1024/860/560 px, nichts darf seitlich überstehen. Auf dem Handy ein Burger-Menü mit JS.
- Barrierearm: semantisches HTML (header, nav, main, section mit aria-label, footer), genau eine h1, gute Kontraste, sichtbarer Fokus, Formular-Labels, @media (prefers-reduced-motion: reduce) schaltet Bewegung ab.

FOTOS
- Echte Fotos sucht Friday selbst: schreib dafür <img data-bild="2–4 englische Suchwörter" alt="deutsche Beschreibung"> OHNE src (z. B. data-bild="hair salon interior"). 4–7 Fotos: Hero, Über uns, Galerie. Keine fremden Bild-URLs, keine Platzhalter-Dienste.
- Bilder mit object-fit: cover in Rahmen mit fester aspect-ratio, abgerundeten Ecken und Schatten.

DESIGN (Pflicht, das macht den Unterschied)
- Ein klares Farbsystem mit 2 Akzentfarben (CSS-Variablen), großzügige Abstände (Abschnitte 90–130 px), maximale Breite ~1180 px.
- Hero über die ganze Bildschirmhöhe: kleine Marke/Kicker über der h1, riesige h1 (clamp bis ~84 px) mit einem Wort im Farbverlauf, Unterzeile, zwei Knöpfe (Haupt + Neben), kleine Vertrauens-Punkte, rechts ein Foto im Rahmen mit 1–2 schwebenden Glas-Karten. Dahinter animierte, weich verschwommene Farbkugeln und/oder ein feines Raster.
- Glas-Navigation (fixiert, backdrop-filter: blur), die beim Scrollen kleiner wird; dünner Lese-Fortschrittsbalken oben.
- Bewegung: Abschnitte gleiten beim Scrollen weich herein (IntersectionObserver, gestaffelt), Zahlen zählen hoch, Karten heben sich beim Hover und leuchten dort, wo die Maus ist, ein Laufband mit Leistungen, Knöpfe mit Schatten-Hover. Alles flüssig (nur transform/opacity animieren).

ABSCHNITTE (in dieser Reihenfolge, passend zur Branche)
1 Hero · 2 Laufband · 3 drei Kennzahlen-Karten (Versprechen statt erfundener Fakten, z. B. „24 h Antwortzeit“) · 4 Leistungen als 4 Karten mit Inline-SVG-Symbol und Preis „ab …“ · 5 Über uns mit Foto und Haken-Liste · 6 Ablauf in 3–4 nummerierten Schritten · 7 Galerie (asymmetrisches Raster) · 8 Preise als 3 Pakete, das mittlere hervorgehoben („Beliebt“) · 9 Kundenstimmen als klar markierte Platzhalter · 10 FAQ als <details>-Akkordeon · 11 großes Abschluss-Band mit Aufruf · 12 Kontakt: Formular (öffnet mailto) + Telefon, Mail, Öffnungszeiten, Adresse · Fußbereich mit Impressum- und Datenschutz-Platzhalter.

TEXTE
- Echte, glaubwürdige, kurze deutsche Texte mit Persönlichkeit, Du-Form (außer Kanzlei/Praxis wirkt Sie besser). Überschriften als Nutzen, nicht als Etikett.
- Erfinde keine echten Kundenbewertungen, Auszeichnungen, Jahreszahlen oder Kundenzahlen: Platzhalter wie [Telefonnummer], [Adresse] oder [Kundenstimme] klar markieren.

Antworte immer, indem du das Werkzeug "webseite" genau einmal aufrufst; schreib keinen Text daneben. Fang mit "titel" an, dann "html".`;

const EIGEN_ZUSATZ = `

EIGENE SEITE (geht allem oben vor): Diese Seite ist NICHT für einen Kunden, sondern für deinen Chef selbst (und die Menschen, die er mit „uns“ meint). Sie wird nicht verkauft.
- Kein Angebot, kein Preisvorschlag, keine Preis-Pakete, keine Preise „ab …“, keine Kundenstimmen, kein Verkaufs-Ton, keine Öffnungszeiten.
- Stattdessen eine persönliche, warme Vorstellung mit Wow-Effekt: Hero „Das sind wir“, Wer wir sind (Karten), Unsere Geschichte (Zeitstrahl), Was uns antreibt / Werte, Projekte (z. B. der KI-Assistent F.R.Ai.D.A.Y, falls passend), Einblicke-Galerie, ein paar persönliche Fragen & Antworten, Kontakt-Formular.
- Nutze die Angaben unter „Was Friday über uns weiß“ für echte, persönliche Texte. Nimm nur Harmloses, das man öffentlich zeigen kann (Interessen, Projekte, Werte, Stil). Lass Adresse, Telefon, Gesundheit, Geld, Konten, Passwörter und alles Private weg. Was fehlt, als klaren Platzhalter in [eckigen Klammern] markieren, nichts erfinden.
- Wir-Form („Wir sind …“), Du-Form gegenüber Besuchern.`;

/** Was Friday über den Nutzer weiß, ohne heikle Dinge (für die eigene Seite). */
function eigenesProfil() {
  const HEIKEL = /passw|kennwort|pin\b|iban|bic\b|konto|karte|schlüssel|schluessel|token|api|adresse|straße|strasse|plz|telefon|handy|nummer|@|krank|arzt|medikament|diagnose|schulden|gehalt|kredit|steuer|geburtsdatum|ausweis/i;
  let fakten = [];
  try { fakten = getMemories().map((m) => String(m.text || "").trim()).filter((t) => t && !HEIKEL.test(t)).slice(-40); } catch { /* egal */ }
  const name = /^(boss|chef)$/i.test(config.userName || "") ? "" : config.userName || "";
  return `Was Friday über uns weiß:\n- Name des Chefs: ${name || "[Name]"}${config.city ? `\n- Stadt: ${config.city} (nur nennen, wenn es passt)` : ""}${fakten.length ? `\n${fakten.map((f) => `- ${f.slice(0, 240)}`).join("\n")}` : "\n- (noch nichts gemerkt – Platzhalter nutzen)"}`;
}

const eigenerName = () => (/^(boss|chef)$/i.test(config.userName || "") ? "" : String(config.userName || "").slice(0, 30));

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

export { vorlagenOptionen };

/** Stil und Branche: was der Nutzer gewählt hat, sonst aus dem Auftrag erkannt. */
function wahl(text, { stil, branche, eigen } = {}) {
  const istEigen = eigen === true || eigen === "true" || (eigen !== false && eigen !== "false" && (branche === "persoenlich" || istEigeneSeite(text)));
  let b = BRANCHEN[branche] ? branche : erkenneBranche(text);
  if (istEigen && b === "allgemein") b = "persoenlich";
  const s = STILE[stil] ? stil : erkenneStil(text, b);
  return { branche: b, stil: s, eigen: istEigen };
}
/** Bei Überarbeitung: Stil/Branche/eigen vom Projekt übernehmen. */
function wahlBasis(basis, text, opt) {
  const m = readMeta(basis), w = wahl(text, opt);
  return { stil: m.stil || w.stil, branche: m.branche || w.branche, eigen: Boolean(m.eigen) };
}

/** Nachricht an Claude: Auftrag + Design-Vorgabe, bei Überarbeitung die bisherige Seite (Fotos als kurze Marken). */
function claudeNachricht(text, basis, w) {
  const profil = w.eigen ? `\n\n${eigenesProfil()}` : "";
  if (!basis) return { user: `${w.eigen ? "Eigene Seite (für uns selbst, kein Kunde, kein Preis)" : "Auftrag"}: ${text}\n\n${designVorgabe(w.branche, w.stil)}${profil}`, liste: [] };
  const { html, liste } = bilderAbziehen(getSiteHtml(basis));
  return { user: `Überarbeite diese bestehende Webseite nach dem Wunsch unten und gib die komplette neue Datei zurück. Eingebettete Fotos stehen als src="bild:1", src="bild:2" … – lass diese Marken genau so stehen, wenn das Foto bleiben soll. Neue Fotos wie gewohnt mit data-bild ohne src.\n\nBestehende Seite:\n${html}${profil}\n\nWunsch: ${text}`, liste };
}

/** Feinschliff, echte Fotos, Qualitäts-Check – für Claude-Seiten und Vorlagen gleich. */
async function fertigMachen(html, liste, titel) {
  let h = politur(bilderZurueck(html, liste), { titel });
  h = (await fuelleBilder(h, { icons: ICONS })).html;
  return { html: h, qualitaet: pruefeQualitaet(h) };
}

/** v1.158.0 Sofort-Vorlage ohne Claude: in 1–20 Sekunden (je nach Fotos), kostet kein Guthaben. */
export async function baueVorlage(auftrag, opt = {}) {
  const text = String(auftrag || "").trim().slice(0, 2000);
  const w = wahl(text, opt);
  const v = bauVorlage({ auftrag: text, ...w, ...(w.eigen && eigenerName() && !opt.name ? { name: eigenerName() } : {}) });
  const f = await fertigMachen(v.html, [], v.titel);
  return speichern({ ...v, html: f.html }, f.html, null, text || (w.eigen ? "Unsere eigene Webseite" : `${BRANCHEN[w.branche].name}-Webseite`), { ...w, eigen: w.eigen || v.eigen, qualitaet: f.qualitaet, quelle: "vorlage" });
}

export async function buildSite(auftrag, basisId = null, opt = {}) {
  const text = String(auftrag || "").trim().slice(0, 2000);
  if (!text) return { ok: false, error: "Beschreib mir den Kunden und was die Seite können soll." };
  const basis = basisId ? safeId(basisId) : null;
  const w = basis ? wahlBasis(basis, text, opt) : wahl(text, opt);
  // Ohne Claude: neue Seiten trotzdem als Profi-Vorlage bauen.
  const rettung = async (grund) => (basis ? { ok: false, error: grund } : { ...(await baueVorlage(text, w)), hinweis: `${grund} Ich habe dir stattdessen meine Profi-Vorlage gebaut.` });
  if (!config.anthropicKey && !ersatzBereit()) return rettung("Ohne Claude-Schlüssel kann ich nicht frei entwerfen.");
  const { user, liste } = claudeNachricht(text, basis, w);
  const model = brainModel(config.model);
  const sparen = model === SPAR_MODELL;
  let res;
  try {
    const params = {
      model,
      max_tokens: sparen ? 20000 : 32000,
      system: SYSTEM + (w.eigen ? EIGEN_ZUSATZ : ""),
      tools: [w.eigen ? EIGEN_TOOL : WEBSEITE_TOOL],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: user }],
      ...(sparen ? { output_config: { effort: "low" } } : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }),
    };
    // Große Ausgabe: per Stream holen, damit es keine Zeitüberschreitung gibt.
    res = sparen ? await client.messages.stream(params).finalMessage() : await client.beta.messages.stream(params).finalMessage();
  } catch (err) {
    if (isCreditError(err)) { markEmpty(); return rettung("Mein Guthaben ist leer, Chef."); }
    return rettung("Claude hat gerade nicht geantwortet.");
  }
  recordUsage(res.model || model, res.usage, "webseite");
  const block = (res.content || []).find((b) => b.type === "tool_use" && b.name === "webseite");
  const html = String(block?.input?.html || "");
  if (!block || !/<html[\s>]/i.test(html)) return rettung(res.stop_reason === "max_tokens" ? "Die Seite wurde zu groß." : "Die Webseite kam nicht vollständig zurück.");
  const f = await fertigMachen(html, liste, block.input.titel);
  return speichern(block.input, f.html, basis, text, { ...w, qualitaet: f.qualitaet, quelle: "claude" });
}

function speichern(w, html, basis, text, extra = {}) {
  const id = basis || `${new Date().toISOString().slice(0, 10)}-${slug(w.titel)}-${Date.now().toString(36).slice(-4)}`;
  const dir = path.join(WEB_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  // Vorige Fassung behalten, falls die Überarbeitung schlechter ist.
  if (basis && fs.existsSync(path.join(dir, "index.html"))) fs.copyFileSync(path.join(dir, "index.html"), path.join(dir, `index.vorher-${Date.now().toString(36)}.html`));
  fs.writeFileSync(path.join(dir, "index.html"), html);
  const alt = basis ? readMeta(basis) : {};
  const eigen = Boolean(extra.eigen || alt.eigen);
  // Eigene Seite: kein Angebot, kein Preis, nichts zu verkaufen.
  if (!eigen) fs.writeFileSync(path.join(dir, "angebot.txt"), `${w.angebot}\n\nPreisvorschlag: ${w.preis_eur} €\n`);
  const meta = { ...alt, titel: String(w.titel).slice(0, 120), auftrag: alt.auftrag || text, angebot: eigen ? "" : w.angebot, preis_eur: eigen ? null : Number(w.preis_eur) || null, erstellt: alt.erstellt || new Date().toISOString(), geaendert: new Date().toISOString(), status: eigen ? "eigen" : alt.status || "entwurf", ...(eigen ? { eigen: true } : {}),
    ...(extra.stil ? { stil: extra.stil } : {}), ...(extra.branche ? { branche: extra.branche } : {}), ...(extra.quelle ? { quelle: extra.quelle } : {}), ...(extra.qualitaet ? { qualitaet: { punkte: extra.qualitaet.punkte, fotos: extra.qualitaet.fotos, abschnitte: extra.qualitaet.abschnitte, groesse_kb: extra.qualitaet.groesse_kb } } : {}) };
  fs.writeFileSync(path.join(dir, "projekt.json"), JSON.stringify(meta, null, 2));
  latestId = id;
  return { ok: true, id, ...meta };
}

/** Qualitäts-Check einer gespeicherten Seite (Note + Punkte mit Tipps). */
export function getSiteQualitaet(id) {
  const html = getSiteHtml(id);
  return html == null ? null : pruefeQualitaet(html);
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
  if (meta.eigen) return { ok: false, error: "Das ist eure eigene Seite, die wird nicht verkauft." };
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

TEMPO-MODUS: Der Kunde will die Seite sofort sehen. Baue sie kompakt und trotzdem hochwertig nach der Design-Bibel: Hero, Leistungen, Über uns, Preise, FAQ, Kontakt (6–8 Abschnitte), knappes CSS mit Variablen, nur das nötige JS (Menü + Einblenden), kurze Texte, 3–4 Fotos per data-bild. Insgesamt höchstens etwa 450 Zeilen. Fang sofort mit "titel" und dann "html" an.`;

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
  if (job.schritt === "fotos") return "Sucht passende Fotos und poliert die Seite …";
  if (job.schritt === "vorlage") return "Baut die Profi-Vorlage …";
  if (!html) return job.titel ? `Plant „${job.titel}“ …` : "Plant die Seite …";
  if (/<\/html>/i.test(html)) return job.eigen ? "Macht den Feinschliff …" : job.angebotDa ? "Schreibt das Angebot …" : "Schreibt Angebot und Preis …";
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

/** v1.151.0: Die Bau-Phase als gesprochener Satz ("Das baue ich gerade: …"). Leer = nichts ansagen. */
export function phaseSatz(phase) {
  const p = String(phase || "").replace(/\s*…$/, "").trim();
  if (!p || p === "Fertig") return "";
  let m;
  if ((m = p.match(/^Plant „(.+)“$/))) return `Ich plane gerade die Seite ${m[1]}.`;
  if (p === "Plant die Seite") return "Ich plane gerade die Seite.";
  if (p === "Legt das Grundgerüst an") return "Das baue ich gerade: das Grundgerüst.";
  if (/^Gestaltet das Design/.test(p)) return "Jetzt gestalte ich das Design, Farben und Schriften.";
  if (/^Schreibt/.test(p)) return "Die Seite steht. Jetzt schreibe ich noch Angebot und Preis.";
  if (/^Macht den Feinschliff/.test(p)) return "Die Seite steht. Jetzt noch der Feinschliff.";
  if (/^Sucht passende Fotos/.test(p)) return "Jetzt suche ich passende Fotos und poliere alles.";
  if (/^Baut die Profi-Vorlage/.test(p)) return "Claude ist gerade nicht da. Ich baue dir meine Profi-Vorlage.";
  if (p === "Programmiert die Funktionen") return "Jetzt programmiere ich die Funktionen.";
  if ((m = p.match(/^Baut (.+)$/))) return `Das baue ich gerade: ${m[1]}.`;
  return "";
}

function liveStand(job, ab = 0) {
  const html = job.html || "";
  const von = Math.max(0, Math.min(Number(ab) || 0, html.length));
  const vergangen = ((job.ende || Date.now()) - job.start) / 1000;
  return {
    id: job.id, status: job.status, auftrag: job.auftrag, modus: job.modus, modell: job.modell,
    spruch: job.spruch, wunsch: job.wunsch, schaetzung_s: job.schaetzung_s, erwartet_zeichen: job.erwartet_zeichen,
    vergangen_s: Math.round(vergangen * 10) / 10, titel: job.titel, zeichen: html.length,
    zeilen: html ? html.split("\n").length : 0, phase: phaseAus(html, job), sprich: phaseSatz(phaseAus(html, job)),
    ab: von, code: html.slice(von), ergebnis: job.ergebnis || null, error: job.error || null, hinweis: job.hinweis || null,
    stil: job.stil, branche: job.branche, eigen: Boolean(job.eigen),
  };
}

/** Startet den Live-Bau und kommt sofort zurück. Den Fortschritt holt das Dashboard über getLiveJob(). */
export function startLive(auftrag, basisId = null, { chef, stil, branche, eigen } = {}) {
  if (!liveFrei()) return { ok: false, gesperrt: true, error: "Der Live-Bau ist noch im Test. Probier ihn in Eve aus und gib ihn dort frei." };
  const text = String(auftrag || "").trim().slice(0, 2000);
  if (!text) return { ok: false, error: "Beschreib mir den Kunden und was die Seite können soll." };
  if (!config.anthropicKey && !ersatzBereit() && basisId) return { ok: false, error: "Ohne Claude-Schlüssel kann ich keine Seite überarbeiten." };
  if (liveAktuell && liveAktuell.status === "baut") return { ok: true, laeuft_schon: true, job: liveStand(liveAktuell) };
  const basis = basisId ? safeId(basisId) : null;
  const w = basis ? wahlBasis(basis, text, {}) : wahl(text, { stil, branche, eigen });
  const wunsch = zeitWunsch(text);
  const modus = wunsch && !basis ? "schnell" : "normal";
  const s = schaetzung(modus);
  liveSeq += 1;
  const job = {
    id: liveSeq, status: "baut", auftrag: text, basis, modus, wunsch: wunsch?.text || null,
    schaetzung_s: s.sek, erwartet_zeichen: basis ? Math.max(s.zeichen, getSiteHtml(basis).length) : s.zeichen,
    spruch: startSpruch(wunsch, s.sek, chef || config.userName || "Chef"), start: Date.now(), html: "", titel: "", ...w,
  };
  liveJobs.set(job.id, job);
  for (const id of liveJobs.keys()) if (id < liveSeq - 5) liveJobs.delete(id);
  liveAktuell = job;
  liveBauen(job).catch((err) => { job.status = "fehler"; job.error = String(err?.message || err).slice(0, 300); })
    .finally(() => { job.ende = Date.now(); });
  return { ok: true, job: liveStand(job) };
}

/** Claude fällt aus → Friday baut live ihre Profi-Vorlage, damit trotzdem eine gute Seite entsteht. */
async function liveRettung(job, grund) {
  if (job.basis) throw new Error(grund);
  job.schritt = "vorlage";
  const v = bauVorlage({ auftrag: job.auftrag, stil: job.stil, branche: job.branche, eigen: job.eigen, ...(job.eigen && eigenerName() ? { name: eigenerName() } : {}) });
  job.titel = v.titel.slice(0, 120);
  // Den Code in Häppchen "tippen", damit die Live-Ansicht wächst.
  for (let i = 0; i < v.html.length; i += 2400) { job.html = v.html.slice(0, i + 2400); await new Promise((ok) => setTimeout(ok, 60)); }
  job.schritt = "fotos";
  const f = await fertigMachen(v.html, [], v.titel);
  job.ergebnis = speichern({ ...v, html: f.html }, f.html, null, job.auftrag, { stil: job.stil, branche: job.branche, eigen: job.eigen || v.eigen, qualitaet: f.qualitaet, quelle: "vorlage" });
  job.ergebnis.qualitaet = f.qualitaet;
  job.hinweis = `${grund} Ich habe dir stattdessen meine Profi-Vorlage gebaut.`;
  job.schritt = "";
  job.status = "fertig";
}

async function liveBauen(job) {
  if (!config.anthropicKey && !ersatzBereit()) return liveRettung(job, "Ohne Claude-Schlüssel kann ich nicht frei entwerfen.");
  const { user, liste } = claudeNachricht(job.auftrag, job.basis, job);
  const schnell = job.modus === "schnell";
  const model = schnell ? SCHNELL_MODELL : brainModel(config.model);
  const sparen = model === SPAR_MODELL;
  job.modell = model;
  let res;
  try {
    const params = {
      model,
      max_tokens: schnell ? 14000 : sparen ? 16000 : 32000,
      system: SYSTEM + (job.eigen ? EIGEN_ZUSATZ : "") + (schnell ? (job.eigen ? TEMPO_ZUSATZ.replace("Preise, FAQ", "Geschichte, Einblicke") : TEMPO_ZUSATZ) : ""),
      tools: [job.eigen ? EIGEN_TOOL : WEBSEITE_TOOL],
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
    if (isCreditError(err)) { markEmpty(); return liveRettung(job, "Mein Guthaben ist leer, Chef."); }
    console.error("Webseiten-Live:", String(err?.message || err).slice(0, 300));
    return liveRettung(job, "Claude hat gerade nicht geantwortet.");
  }
  recordUsage(res.model || model, res.usage, "webseite");
  const block = (res.content || []).find((b) => b.type === "tool_use" && b.name === "webseite");
  const html = String(block?.input?.html || "");
  if (!block || !/<html[\s>]/i.test(html)) return liveRettung(job, res.stop_reason === "max_tokens" ? "Die Seite wurde zu groß." : "Die Webseite kam nicht vollständig zurück.");
  job.html = html;
  job.titel = String(block.input.titel || job.titel).slice(0, 120);
  tempoMerken(job.modus, (Date.now() - job.start) / 1000, html.length);
  job.schritt = "fotos";
  const f = await fertigMachen(html, liste, job.titel);
  const r = speichern(block.input, f.html, job.basis, job.auftrag, { stil: job.stil, branche: job.branche, eigen: job.eigen, qualitaet: f.qualitaet, quelle: "claude" });
  r.qualitaet = f.qualitaet;
  job.schritt = "";
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
