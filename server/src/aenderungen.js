// Änderungs-Protokoll (v1.135.0, Idee aus Conway-Research/automaton "audit log + git-versioniert", MIT – in Node nachgebaut).
// Friday hebt jede Fassung ihrer Einstellungen, Seele, Fähigkeiten, Automationen, Abläufe und ihres Gedächtnisses auf.
// Im Kontrollraum sieht Boss, was sich wann geändert hat, und kann jede Fassung mit einem Tipp zurückholen.
// Bewusst NICHT dabei: Schlüssel und Passwörter (.env, verbindungen.json, github.json …) – die landen nie in einer Kopie.
// Ohne git, damit es auch ohne Xcode-Werkzeuge auf dem Mac läuft.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR, ROOT } from "./config.js";
import { eintragen } from "./logbuch.js";

const DIR = path.join(DATA_DIR, "aenderungen");
const INDEX = path.join(DIR, "index.json");
const MAX_VERSIONEN = 400;
const MAX_GROESSE = 400_000;

// Beobachtete Dateien: [Pfad, Anzeigename]
function beobachtet() {
  const l = [
    [path.join(DATA_DIR, "einstellungen.json"), "Einstellungen"],
    [path.join(DATA_DIR, "oberflaeche.json"), "Oberfläche (Dashboard-Einstellungen)"],
    [path.join(DATA_DIR, "seele.md"), "Fridays Seele"],
    [path.join(DATA_DIR, "automationen.json"), "Automationen"],
    [path.join(DATA_DIR, "herzschlag.json"), "Herzschlag-Plan"],
    [path.join(DATA_DIR, "memory.json"), "Gedächtnis (Fakten)"],
    [path.join(DATA_DIR, "ablaeufe.json"), "Gedächtnis (Abläufe)"],
    [path.join(ROOT, "eigene-protokolle.json"), "Eigene Protokolle"],
  ];
  try {
    const fd = path.join(DATA_DIR, "faehigkeiten");
    for (const d of fs.readdirSync(fd)) if (d.endsWith(".md")) l.push([path.join(fd, d), `Fähigkeit: ${d.replace(/\.md$/, "")}`]);
  } catch { /* noch keine */ }
  return l;
}
const GEHEIM = /(^|\/)(\.env|verbindungen\.json|github\.json|alexa\.json|auth\.json)$/i;
const rel = (p) => path.relative(ROOT, p);

function index() {
  try { return JSON.parse(fs.readFileSync(INDEX, "utf8")); } catch { return { versionen: [], hashes: {} }; }
}
function indexSpeichern(ix) {
  fs.mkdirSync(DIR, { recursive: true });
  // Alte Fassungen aufräumen
  while (ix.versionen.length > MAX_VERSIONEN) {
    const alt = ix.versionen.shift();
    try { fs.unlinkSync(path.join(DIR, `${alt.id}.txt`)); } catch { /* weg */ }
  }
  fs.writeFileSync(`${INDEX}.tmp`, JSON.stringify(ix));
  fs.renameSync(`${INDEX}.tmp`, INDEX);
}
const hash = (t) => crypto.createHash("sha1").update(t).digest("hex");

// Bei JSON nur die lesbaren Werte zeigen (ohne ids und Zeitstempel)
const UNWICHTIG = /^\s*"(id|created|zeit|erstellt|geaendert|zuletzt|at)"\s*:/;
const lesbar = (z) => z.trim().replace(/^"([^"]+)":\s*/, "$1: ").replace(/^"|",?$|,$/g, "").replace(/: "/, ": ").slice(0, 120);
function zeilenDiff(alt = "", neu = "") {
  // Bei JSON: hübsch formatieren, damit die Zeilen vergleichbar sind
  const a = alt.split("\n"), b = neu.split("\n");
  const za = new Map(); for (const z of a) za.set(z, (za.get(z) || 0) + 1);
  let plus = 0; const neuZeilen = [];
  for (const z of b) { const n = za.get(z) || 0; if (n) za.set(z, n - 1); else { plus++; if (neuZeilen.length < 4 && /\p{L}{2}/u.test(z) && !UNWICHTIG.test(z)) neuZeilen.push(lesbar(z)); } }
  let minus = 0; for (const n of za.values()) minus += n;
  return { plus, minus, vorschau: neuZeilen };
}

let laeuft = false;
/** Alle beobachteten Dateien prüfen und neue Fassungen aufheben. Gibt die Zahl neuer Fassungen zurück. */
export function sichern(grund = "automatisch") {
  if (laeuft) return 0;
  laeuft = true;
  let neu = 0;
  let fassungen = 0;
  try {
    const ix = index();
    const gesehen = new Set();
    for (const [p, anzeige] of beobachtet()) {
      if (GEHEIM.test(p)) continue;
      const r = rel(p);
      gesehen.add(r);
      let inhalt = null;
      try { const st = fs.statSync(p); if (st.size <= MAX_GROESSE) inhalt = fs.readFileSync(p, "utf8"); } catch { /* fehlt */ }
      const war = ix.hashes[r]; // undefined = noch nie gesehen, "fehlt"/"geloescht" = gab es nicht
      if (inhalt == null) {
        if (war && war !== "geloescht" && war !== "fehlt") { version(ix, r, anzeige, "", "geloescht", grund); ix.hashes[r] = "geloescht"; neu++; fassungen++; }
        else if (!war) { ix.hashes[r] = "fehlt"; neu++; }
        continue;
      }
      const h = hash(inhalt);
      if (war === h) continue;
      const vorher = war && war !== "geloescht" && war !== "fehlt" ? letzterInhalt(ix, r) : null;
      // Allererste Aufnahme einer schon vorhandenen Datei = "erfasst" (Grundstand, wird nicht als Änderung gezeigt)
      const art = vorher != null ? "geaendert" : war ? "neu" : (ix.gestartet ? "neu" : "erfasst");
      version(ix, r, anzeige, inhalt, art, grund, vorher);
      ix.hashes[r] = h;
      neu++;
      if (art !== "erfasst") fassungen++;
    }
    if (!ix.gestartet) { ix.gestartet = new Date().toISOString(); neu++; }
    if (neu) indexSpeichern(ix);
  } catch (err) {
    console.error("Änderungs-Protokoll:", err.message);
  } finally {
    laeuft = false;
  }
  return fassungen;
}
function version(ix, r, anzeige, inhalt, art, grund, vorher = "") {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, `${id}.txt`), inhalt);
  const diff = art === "geaendert" ? zeilenDiff(schoen(vorher), schoen(inhalt)) : { plus: 0, minus: 0, vorschau: [] };
  ix.versionen.push({ id, zeit: new Date().toISOString(), datei: r, anzeige, art, grund, ...diff, groesse: inhalt.length });
}
function schoen(t) {
  try { return JSON.stringify(JSON.parse(t), null, 1); } catch { return t; }
}
function letzterInhalt(ix, r) {
  const v = [...ix.versionen].reverse().find((x) => x.datei === r && x.art !== "geloescht");
  if (!v) return null;
  try { return fs.readFileSync(path.join(DIR, `${v.id}.txt`), "utf8"); } catch { return null; }
}

export function liste({ datei = "", limit = 120 } = {}) {
  const ix = index();
  // "erfasst" = erste Aufnahme beim Start, interessiert in der Liste nicht
  const v = ix.versionen.filter((x) => x.art !== "erfasst" && (!datei || x.datei === datei)).slice(-limit).reverse();
  const dateien = [...new Set(ix.versionen.map((x) => x.datei))].map((d) => ({ datei: d, anzeige: ix.versionen.find((x) => x.datei === d)?.anzeige || d }));
  return { versionen: v, dateien, gesamt: ix.versionen.length };
}

export function inhalt(id) {
  const ix = index();
  const v = ix.versionen.find((x) => x.id === id);
  if (!v) return { error: "Diese Fassung gibt es nicht." };
  let text = "";
  try { text = fs.readFileSync(path.join(DIR, `${id}.txt`), "utf8"); } catch { /* weg */ }
  return { ...v, text: schoen(text).slice(0, 60000) };
}

/** Eine Fassung zurückholen. Der aktuelle Stand wird vorher selbst als Fassung aufgehoben. */
export function zurueckholen(id) {
  const ix = index();
  const v = ix.versionen.find((x) => x.id === id);
  if (!v) return { error: "Diese Fassung gibt es nicht." };
  if (v.art === "geloescht") return { error: "Das ist die Lösch-Markierung. Nimm die Fassung davor." };
  const ziel = path.resolve(ROOT, v.datei);
  if (!ziel.startsWith(ROOT + path.sep) || GEHEIM.test(ziel)) return { error: "Diese Datei darf nicht zurückgeholt werden." };
  if (!beobachtet().some(([p]) => p === ziel) && !ziel.startsWith(path.join(DATA_DIR, "faehigkeiten") + path.sep)) return { error: "Diese Datei wird nicht mehr beobachtet." };
  let text;
  try { text = fs.readFileSync(path.join(DIR, `${id}.txt`), "utf8"); } catch { return { error: "Die gespeicherte Fassung fehlt." }; }
  sichern("vor dem Zurückholen");
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.writeFileSync(`${ziel}.tmp`, text);
  fs.renameSync(`${ziel}.tmp`, ziel);
  sichern(`zurückgeholt: Fassung vom ${new Date(v.zeit).toLocaleString("de-DE")}`);
  eintragen({ bereich: "system", titel: `Ältere Fassung zurückgeholt: ${v.anzeige}`, details: `Stand vom ${new Date(v.zeit).toLocaleString("de-DE")}`, quelle: "dashboard" });
  return { ok: true, hinweis: /einstellungen|oberflaeche/.test(v.datei) ? "Lade das Dashboard neu, damit alles übernommen wird." : "" };
}
