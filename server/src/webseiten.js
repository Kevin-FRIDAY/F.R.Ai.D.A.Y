// Fridays Webseiten-Werkstatt: baut aus einem Auftrag eine fertige Webseite (eine HTML-Datei)
// plus Angebotstext. Verkaufen und kassieren tut der Nutzer selbst; einen Verkauf trägt er ein,
// dann zählt er als Einnahme in Fridays Überlebens-Bilanz.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { brainModel, SPAR_MODELL, recordUsage, isCreditError, markEmpty, einnahme } from "./energie.js";

const client = new Anthropic({ apiKey: config.anthropicKey });
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
  if (!config.anthropicKey) return { ok: false, error: "Ohne Claude-Schlüssel kann ich keine Webseiten bauen." };
  const text = String(auftrag || "").trim().slice(0, 2000);
  if (!text) return { ok: false, error: "Beschreib mir den Kunden und was die Seite können soll." };
  let user = `Auftrag: ${text}`;
  const basis = basisId ? safeId(basisId) : null;
  if (basis) user = `Überarbeite diese bestehende Webseite nach dem Wunsch unten und gib die komplette neue Datei zurück.\n\nBestehende Seite:\n${getSiteHtml(basis).slice(0, 60000)}\n\nWunsch: ${text}`;
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
  const w = block.input;
  const id = basis || `${new Date().toISOString().slice(0, 10)}-${slug(w.titel)}-${Date.now().toString(36).slice(-4)}`;
  const dir = path.join(WEB_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
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
export async function markSold(id, betragEur) {
  const ok = safeId(id);
  if (!ok) return { ok: false, error: "Projekt nicht gefunden." };
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
