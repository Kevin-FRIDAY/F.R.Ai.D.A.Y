// Fridays Testlabor (Update-Sandbox / virtuelle Testumgebung).
// Prüft einen Friday-Ordner, OHNE ihn zu starten oder etwas zu verändern:
//  - alle nötigen Dateien da, VERSION gültig
//  - jede JavaScript-Datei hat keine Syntaxfehler (node --check)
//  - jeder Import zeigt auf eine vorhandene Datei, und jede importierte Funktion wird dort auch exportiert
//  - JSON-Dateien sind lesbar, jedes Skript aus index.html existiert
// Das ist eine statische Prüfung: sie findet kaputte oder unvollständige Updates, aber keine Logikfehler.
// Benutzt nur Node-Bordmittel, damit update.sh es auch ohne .env aufrufen kann:
//   node server/src/testlabor.js <ordner>   → Exit-Code 0 = bestanden, 1 = durchgefallen
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PFLICHT = ["VERSION", "server/src/index.js", "server/package.json", "dashboard/index.html", "mac-agent/agent.js", "update.sh"];
const JSON_DATEIEN = ["server/package.json", "mac-agent/package.json", "server/protocols.json", "dashboard/manifest.webmanifest"];

function jsDateien(dir) {
  try { return fs.readdirSync(dir).filter((f) => f.endsWith(".js") || f.endsWith(".mjs")).map((f) => path.join(dir, f)); } catch { return []; }
}

function exporte(text) {
  const namen = new Set();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) namen.add(m[1]);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) for (const teil of m[1].split(",")) { const n = teil.trim().split(/\s+as\s+/).pop().trim(); if (n) namen.add(n); }
  for (const m of text.matchAll(/export\s+(?:const|let|var)\s*\{([^}]*)\}/g)) for (const teil of m[1].split(",")) { const n = teil.trim().split(":").pop().trim(); if (n) namen.add(n); }
  if (/export\s+default\b/.test(text)) namen.add("default");
  if (/export\s+\*\s+from/.test(text)) namen.add("*");
  return namen;
}

/** @returns {{ok:boolean, version:string, geprueft:number, fehler:string[], warnungen:string[], dauer_ms:number}} */
export function pruefeOrdner(ordner, { node = process.execPath } = {}) {
  const start = Date.now();
  const fehler = [], warnungen = [];
  const p = (r) => path.join(ordner, r);
  for (const f of PFLICHT) if (!fs.existsSync(p(f))) fehler.push(`Datei fehlt: ${f}`);
  let version = "";
  try { version = fs.readFileSync(p("VERSION"), "utf8").trim().split("\n")[0]; } catch { /* oben gemeldet */ }
  if (version && !/^\d+\.\d+\.\d+$/.test(version)) fehler.push(`VERSION ist ungültig: „${version.slice(0, 20)}“`);
  for (const f of JSON_DATEIEN) {
    if (!fs.existsSync(p(f))) continue;
    try { JSON.parse(fs.readFileSync(p(f), "utf8")); } catch (err) { fehler.push(`${f} ist kaputt: ${err.message.slice(0, 80)}`); }
  }
  const server = jsDateien(p("server/src"));
  const alle = [...server, ...jsDateien(p("mac-agent")), ...jsDateien(p("dashboard"))];
  let geprueft = 0;
  for (const datei of alle) {
    const r = spawnSync(node, ["--check", datei], { encoding: "utf8", timeout: 20000 });
    geprueft++;
    if (r.status !== 0) {
      const zeile = String(r.stderr || "").split("\n").find((z) => /Error/.test(z)) || "Syntaxfehler";
      fehler.push(`${path.relative(ordner, datei)}: ${zeile.trim().slice(0, 140)}`);
    }
  }
  // Importe im Server prüfen
  const cache = new Map();
  const lies = (f) => { if (!cache.has(f)) { try { cache.set(f, fs.readFileSync(f, "utf8")); } catch { cache.set(f, null); } } return cache.get(f); };
  for (const datei of server) {
    const text = lies(datei) || "";
    for (const m of text.matchAll(/import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\}|\*\s+as\s+[\w$]+)?\s*from\s*["'](\.{1,2}\/[^"']+)["']/g)) {
      const ziel = path.resolve(path.dirname(datei), m[3]);
      const zielText = lies(ziel);
      const rel = path.relative(ordner, datei);
      if (zielText == null) { fehler.push(`${rel}: Import „${m[3]}“ zeigt auf eine fehlende Datei`); continue; }
      const ex = exporte(zielText);
      if (ex.has("*")) continue;
      if (m[1] && !ex.has("default")) fehler.push(`${rel}: „${m[3]}“ hat keinen Standard-Export`);
      for (const teil of (m[2] || "").split(",")) {
        const name = teil.trim().split(/\s+as\s+/)[0].trim();
        if (name && !ex.has(name)) fehler.push(`${rel}: „${name}“ fehlt in ${m[3]}`);
      }
    }
    for (const m of text.matchAll(/import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g)) {
      if (lies(path.resolve(path.dirname(datei), m[1])) == null) fehler.push(`${path.relative(ordner, datei)}: dynamischer Import „${m[1]}“ fehlt`);
    }
  }
  // Skripte im Dashboard
  const html = lies(p("dashboard/index.html")) || "";
  for (const m of html.matchAll(/<script[^>]+src=["']([^"':]+)["']/g)) {
    if (!fs.existsSync(path.join(p("dashboard"), m[1]))) fehler.push(`dashboard/index.html lädt „${m[1]}“, die Datei fehlt`);
  }
  // Neue Bausteine (npm) nur als Hinweis
  try {
    const pk = JSON.parse(lies(p("server/package.json")) || "{}");
    const anzahl = Object.keys(pk.dependencies || {}).length;
    if (anzahl > 12) warnungen.push(`Die neue Version braucht ${anzahl} Bausteine (npm).`);
  } catch { /* oben gemeldet */ }
  return { ok: fehler.length === 0, version, geprueft, fehler: fehler.slice(0, 40), warnungen, dauer_ms: Date.now() - start };
}

// Aufruf von der Kommandozeile (update.sh)
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const ordner = path.resolve(process.argv[2] || ".");
  const r = pruefeOrdner(ordner);
  console.log(r.ok ? `Testlabor bestanden: ${r.geprueft} Dateien geprüft (Version ${r.version})` : `Testlabor durchgefallen: ${r.fehler[0]}${r.fehler.length > 1 ? ` (+${r.fehler.length - 1} weitere)` : ""}`);
  console.log(JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
}
