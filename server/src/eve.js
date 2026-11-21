// Eve – die Testversion von Friday (v1.137.0).
// Eve ist dieselbe Friday-Installation, nur im Test-Modus (Umschalter oben im Dashboard, pro Gerät).
// 1) Neue Funktionen stehen in server/eve-funktionen.json. In Eve sind sie sofort benutzbar,
//    in Friday liegen sie hinter einem Schloss, bis Boss sie in Eve freigibt.
// 2) Eve sammelt Änderungswünsche (Chatfenster im Schnellzugriff + Feld unter jedem Bereich)
//    und schickt sie mit einem Tipp als Auftrag (GitHub-Issue) an Claude.
//    Ohne passenden GitHub-Schlüssel: Text kopieren und in den Claude-Chat einfügen.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config, DATA_DIR, ROOT } from "./config.js";
import { githubToken } from "./updater.js";
import { eintragen } from "./logbuch.js";
import { eveZustand, eveZuruecksetzen } from "./eve-prozess.js";

const DATEI = path.join(DATA_DIR, "eve.json");
const KATALOG = path.join(ROOT, "eve-funktionen.json");
const LABEL = "eve-wunsch";
const API = () => String(process.env.FRIDAY_GITHUB_API || "https://api.github.com").replace(/\/$/, "");
const MAX_WUENSCHE = 300;

function lesen() {
  try {
    const d = JSON.parse(fs.readFileSync(DATEI, "utf8"));
    return { freigegeben: d.freigegeben || {}, wuensche: Array.isArray(d.wuensche) ? d.wuensche : [], sendungen: Array.isArray(d.sendungen) ? d.sendungen : [] };
  } catch { return { freigegeben: {}, wuensche: [], sendungen: [] }; }
}
function schreiben(d) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATEI}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, DATEI);
}

/** Funktionen, die gerade im Test sind (kommen mit jedem Update aus dem Repo). */
export function katalog() {
  try {
    const k = JSON.parse(fs.readFileSync(KATALOG, "utf8"));
    return (Array.isArray(k.funktionen) ? k.funktionen : []).filter((f) => f && /^[\w-]{2,60}$/.test(f.id || ""));
  } catch { return []; }
}

/** Darf Friday (nicht Eve) diese Funktion schon benutzen? Unbekannte Funktionen sind frei. */
export function istFrei(id) {
  if (!katalog().some((f) => f.id === id)) return true;
  return Boolean(lesen().freigegeben[id]);
}

export function stand() {
  const d = lesen();
  const tok = githubToken();
  return {
    funktionen: katalog().map((f) => ({ ...f, frei: Boolean(d.freigegeben[f.id]), freiAm: d.freigegeben[f.id]?.am || null })),
    wuensche: d.wuensche.slice(-MAX_WUENSCHE),
    offen: d.wuensche.filter((w) => w.status === "offen").length,
    sendungen: d.sendungen.slice(-10).reverse(),
    github: { schluessel: Boolean(tok), repo: config.updateRepo },
    prozess: eveZustand(),
  };
}

export function freigeben(id, frei) {
  const f = katalog().find((x) => x.id === id);
  if (!f) return { ok: false, error: "Diese Funktion ist nicht (mehr) im Test." };
  const d = lesen();
  if (frei) d.freigegeben[id] = { am: new Date().toISOString(), name: f.name };
  else delete d.freigegeben[id];
  schreiben(d);
  eintragen({ bereich: "system", quelle: "eve", titel: frei ? `Freigegeben für Friday: ${f.name}` : `Wieder gesperrt in Friday: ${f.name}` });
  return { ok: true, ...stand() };
}

export function wunschDazu(text, bereich) {
  const t = String(text || "").trim().slice(0, 2000);
  if (!t) return { ok: false, error: "Schreib erst, was sich ändern soll." };
  const d = lesen();
  d.wuensche.push({ id: crypto.randomUUID().slice(0, 8), text: t, bereich: String(bereich || "Allgemein").slice(0, 80), zeit: new Date().toISOString(), status: "offen" });
  if (d.wuensche.length > MAX_WUENSCHE) d.wuensche = d.wuensche.slice(-MAX_WUENSCHE);
  schreiben(d);
  return { ok: true, ...stand() };
}

export function wunschWeg(id) {
  const d = lesen();
  d.wuensche = d.wuensche.filter((w) => w.id !== id);
  schreiben(d);
  return { ok: true, ...stand() };
}

/** Text für Claude (zum Kopieren oder als Issue-Inhalt). */
export function auftragsText(liste) {
  const gruppen = {};
  for (const w of liste) (gruppen[w.bereich] ||= []).push(w);
  const zeilen = ["Änderungswünsche aus Eve (Testversion von Friday).", "Bitte zuerst nur in Eve einbauen (neue Funktion in server/eve-funktionen.json eintragen, damit sie in Friday gesperrt bleibt, bis ich sie freigebe).", ""];
  for (const [b, ws] of Object.entries(gruppen)) {
    zeilen.push(`### ${b}`);
    for (const w of ws) zeilen.push(`- ${w.text.replace(/\n+/g, " ")}  _(${new Date(w.zeit).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })})_`);
    zeilen.push("");
  }
  return zeilen.join("\n");
}

function offeneMarkieren(ids, info) {
  const d = lesen();
  for (const w of d.wuensche) if (ids.includes(w.id)) Object.assign(w, { status: "gesendet", gesendet: new Date().toISOString(), ...info });
  d.sendungen.push({ zeit: new Date().toISOString(), anzahl: ids.length, ...info });
  d.sendungen = d.sendungen.slice(-50);
  schreiben(d);
}

/** Alle offenen Wünsche als GitHub-Issue anlegen. Braucht einen Schlüssel mit "Issues: Lesen und Schreiben". */
export async function senden({ nurKopiert = false } = {}) {
  const offen = lesen().wuensche.filter((w) => w.status === "offen");
  if (!offen.length) return { ok: false, error: "Es sind keine offenen Wünsche gesammelt." };
  const text = auftragsText(offen);
  if (nurKopiert) {
    offeneMarkieren(offen.map((w) => w.id), { weg: "kopiert" });
    return { ok: true, weg: "kopiert", ...stand() };
  }
  const tok = githubToken();
  if (!tok) return { ok: false, grund: "kein_schluessel", text, error: "Für den direkten Versand fehlt der GitHub-Schlüssel. Tippe auf „Kopieren“ und füge den Text bei Claude ein." };
  if (!/^[\w.-]+\/[\w.-]+$/.test(config.updateRepo)) return { ok: false, text, error: "UPDATE_REPO in der .env ist ungültig." };
  const titel = `Eve-Wünsche: ${offen.length} ${offen.length === 1 ? "Änderung" : "Änderungen"} (${new Date().toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })})`;
  const anlegen = (mitLabel) => fetch(`${API()}/repos/${config.updateRepo}/issues`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "Friday-Eve", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ title: titel, body: text, ...(mitLabel ? { labels: [LABEL] } : {}) }),
    signal: AbortSignal.timeout(15000),
  });
  let r;
  try {
    r = await anlegen(true);
    if (r.status === 422) r = await anlegen(false); // Label gibt es nicht / darf nicht angelegt werden
  } catch {
    return { ok: false, text, error: "GitHub ist gerade nicht erreichbar. Tippe auf „Kopieren“ oder versuch es gleich nochmal." };
  }
  if (r.status === 401) return { ok: false, grund: "schluessel", text, error: "GitHub kennt den Schlüssel nicht (abgelaufen?). Trag in Einstellungen → Immer aktuell einen neuen ein." };
  if (r.status === 403 || r.status === 404) return { ok: false, grund: "rechte", text, error: "Der GitHub-Schlüssel darf keine Aufträge anlegen. Gib ihm auf github.com zusätzlich das Recht „Issues: Read and write“ (Anleitung 44-eve.md). Bis dahin: Kopieren." };
  if (!r.ok) return { ok: false, text, error: `GitHub antwortet mit Fehler ${r.status}. Tippe auf „Kopieren“.` };
  const issue = await r.json().catch(() => ({}));
  offeneMarkieren(offen.map((w) => w.id), { weg: "github", issue: issue.number || null, url: issue.html_url || null });
  eintragen({ bereich: "system", quelle: "eve", titel: `${offen.length} Eve-Wünsche an Claude geschickt (Auftrag #${issue.number || "?"})` });
  return { ok: true, weg: "github", issue: issue.number, url: issue.html_url, ...stand() };
}

export function eveRouten(app, asyncRoute) {
  app.get("/api/eve", (req, res) => res.json(stand()));
  app.post("/api/eve/freigabe", (req, res) => res.json(freigeben(String(req.body?.id || ""), Boolean(req.body?.frei))));
  app.post("/api/eve/wunsch", (req, res) => {
    const r = wunschDazu(req.body?.text, req.body?.bereich);
    res.status(r.ok ? 200 : 400).json(r);
  });
  app.delete("/api/eve/wunsch/:id", (req, res) => res.json(wunschWeg(String(req.params.id))));
  app.get("/api/eve/text", (req, res) => {
    const offen = lesen().wuensche.filter((w) => w.status === "offen");
    res.json({ text: offen.length ? auftragsText(offen) : "", anzahl: offen.length });
  });
  app.post("/api/eve/zuruecksetzen", asyncRoute(async (req, res) => { await eveZuruecksetzen(); res.json({ ok: true, ...stand() }); }));
  app.post("/api/eve/senden", asyncRoute(async (req, res) => res.json(await senden({ nurKopiert: Boolean(req.body?.kopiert) }))));
}
