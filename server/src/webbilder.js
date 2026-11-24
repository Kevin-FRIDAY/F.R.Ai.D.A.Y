// v1.156.0 Echte Fotos für die Webseiten-Werkstatt.
// Seiten markieren Bilder mit <img data-bild="englische suchwörter" alt="…">. Friday sucht dazu freie Fotos
// bei Openverse (kommerziell nutzbare Lizenzen), lädt sie, verkleinert sie am Mac (sips) und bettet sie
// direkt in die HTML-Datei ein – so bleibt die Seite eine einzige Datei. Bildnachweise kommen in den Fußbereich.
// Findet Friday nichts (offline), wird aus dem Bild eine gestaltete Grafik im Stil der Seite.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";

const OPENVERSE = process.env.FRIDAY_OPENVERSE_URL || "https://api.openverse.org/v1/images/";
const MAX_BILDER = 8;
const cache = new Map();

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ESC[c]);
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i")) || [])[1] ?? null;

async function suche(q) {
  const c = cache.get(q);
  if (c && Date.now() - c.at < 6 * 3600 * 1000) return c.liste;
  const url = `${OPENVERSE}?q=${encodeURIComponent(q)}&page_size=10&mature=false&license_type=commercial`;
  const res = await fetch(url, { headers: { "User-Agent": "F.R.Ai.D.A.Y/1.0" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const liste = ((await res.json()).results || []).map((r) => ({
    id: String(r.id || r.url || ""), url: r.url, thumb: r.thumbnail, titel: r.title || "Foto", autor: r.creator || "unbekannt",
    lizenz: `${String(r.license || "").toUpperCase()} ${r.license_version || ""}`.trim(), seite: r.foreign_landing_url || r.url || "",
    breite: Number(r.width) || 0,
  })).filter((f) => /^https?:\/\//.test(f.thumb || f.url || ""));
  cache.set(q, { at: Date.now(), liste });
  return liste;
}

async function holen(url, maxBytes) {
  if (!/^https?:\/\//.test(String(url || ""))) return null;
  const res = await fetch(url, { headers: { "User-Agent": "F.R.Ai.D.A.Y/1.0" }, signal: AbortSignal.timeout(12000), redirect: "follow" });
  const typ = String(res.headers.get("content-type") || "").split(";")[0].trim();
  if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(typ)) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > 1000 && buf.length <= maxBytes ? { buf, typ } : null;
}

/** Am Mac große Originale scharf, aber klein machen (max. 1600 px, JPEG 72 %). */
function verkleinern(buf) {
  if (process.platform !== "darwin") return Promise.resolve(null);
  const ein = path.join(os.tmpdir(), `friday-web-${process.pid}-${Math.random().toString(36).slice(2)}`);
  const aus = `${ein}.jpg`;
  fs.writeFileSync(ein, buf);
  return new Promise((ok) => {
    execFile("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "72", "-Z", "1600", ein, "--out", aus], { timeout: 15000 }, (err) => {
      let r = null;
      try { if (!err) r = { buf: fs.readFileSync(aus), typ: "image/jpeg" }; } catch { /* egal */ }
      fs.rm(ein, () => {}); fs.rm(aus, () => {});
      ok(r && r.buf.length < 900000 ? r : null);
    });
  });
}

async function bildLaden(f) {
  // Erst das Original (schärfer), am Mac verkleinert; sonst das Vorschaubild von Openverse (~600 px).
  if (process.platform === "darwin" && f.url) {
    try { const o = await holen(f.url, 12e6); const k = o && (await verkleinern(o.buf)); if (k) return k; } catch { /* weiter */ }
  }
  try { const t = await holen(f.thumb, 1.5e6); if (t) return t; } catch { /* weiter */ }
  if (f.url) { try { return await holen(f.url, 700000); } catch { /* nichts */ } }
  return null;
}

const ICON = '<path d="M4 6h16v12H4Z"/><circle cx="9" cy="10" r="2"/><path d="m4 16 5-4 4 3 3-2 4 3"/>';
const ART_CSS = `<style data-fb-art>.fb-art{position:relative;display:grid;place-items:center;min-height:220px;width:100%;height:100%;border-radius:inherit;overflow:hidden;background:radial-gradient(circle at 30% 25%,rgba(124,92,255,.45),transparent 55%),radial-gradient(circle at 75% 80%,rgba(255,138,30,.5),transparent 55%),#11131a}.fb-art svg{width:28%;max-width:110px;fill:none;stroke:#fff;stroke-width:1.2;opacity:.75}</style>`;
const kunst = (alt, icon) => `<div class="fb-art" role="img" aria-label="${esc(alt || "Bild")}"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${icon || ICON}</svg></div>`;

/**
 * Füllt alle <img data-bild="…"> ohne Bildquelle mit echten Fotos. Gibt die neue HTML zurück,
 * dazu wie viele Fotos gefunden wurden. Dauert höchstens etwa 25 Sekunden.
 */
export async function fuelleBilder(html, { icons = {} } = {}) {
  const tags = [...String(html).matchAll(/<img\b[^>]*\bdata-bild\s*=\s*"[^"]*"[^>]*>/gi)].map((m) => m[0]).filter((t) => !/^data:|^https?:/.test(attr(t, "src") || ""));
  if (!tags.length) return { html, fotos: 0, grafiken: 0 };
  const benutzt = new Set(), nachweise = [], ersetzt = new Map();
  const ende = Date.now() + 25000;
  const auftraege = tags.slice(0, MAX_BILDER).map((tag, i) => ({ tag, i, q: (attr(tag, "data-bild") || "").slice(0, 80) }));
  // Suchen parallel, Auswahl der Fotos der Reihe nach (damit kein Foto doppelt vorkommt).
  const treffer = await Promise.all(auftraege.map((a) => suche(a.q).catch(() => [])));
  const wahl = auftraege.map((a, k) => {
    const f = treffer[k].find((x) => !benutzt.has(x.id)) || null;
    if (f) benutzt.add(f.id);
    return f;
  });
  const geladen = await Promise.all(wahl.map((f) => (f ? Promise.race([bildLaden(f).catch(() => null), new Promise((ok) => setTimeout(() => ok(null), Math.max(1000, ende - Date.now())))]) : null)));
  let fotos = 0;
  auftraege.forEach((a, k) => {
    const g = geladen[k], f = wahl[k];
    if (g && f) {
      fotos += 1;
      const src = `data:${g.typ};base64,${g.buf.toString("base64")}`;
      const neu = a.tag.replace(/\s+src\s*=\s*"[^"]*"/i, "").replace(/^<img\b/i, `<img src="${src}"${a.i > 0 ? ' loading="lazy"' : ""} decoding="async"`);
      ersetzt.set(a.tag, neu);
      nachweise.push(`<a href="${esc(f.seite)}" target="_blank" rel="noopener">„${esc(f.titel.slice(0, 60))}“</a> von ${esc(f.autor.slice(0, 40))} (${esc(f.lizenz || "CC")})`);
    }
  });
  let aus = String(html), grafiken = 0;
  for (const tag of tags) {
    if (ersetzt.has(tag)) { const neu = ersetzt.get(tag); aus = aus.replace(tag, () => neu); continue; }
    grafiken += 1;
    const k = kunst(attr(tag, "alt"), icons[attr(tag, "data-icon")]); aus = aus.replace(tag, () => k);
  }
  if (grafiken && !/\.fb-art\s*\{/.test(aus)) aus = aus.replace(/<\/head>/i, () => `${ART_CSS}</head>`);
  if (nachweise.length) {
    const text = `Bildnachweise: ${nachweise.join(" · ")}`;
    if (/data-bildnachweis[^>]*>/.test(aus)) aus = aus.replace(/(<[^>]*data-bildnachweis[^>]*>)[\s\S]*?(<\/\w+>)/, (m, a, b) => `${a}${text}${b}`);
    else aus = aus.replace(/<\/body>/i, () => `<p class="fb-credits" data-bildnachweis style="max-width:900px;margin:24px auto;padding:0 20px;font:12px/1.5 system-ui,sans-serif;opacity:.7">${text}</p></body>`);
  }
  return { html: aus, fotos, grafiken };
}

/** Für Claude: eingebettete Fotos durch kurze Marken ersetzen (spart riesige Mengen Text), danach zurücktauschen. */
export function bilderAbziehen(html) {
  const liste = [];
  const aus = String(html).replace(/src\s*=\s*"(data:image\/[^"]{200,})"/gi, (m, d) => { liste.push(d); return `src="bild:${liste.length}"`; });
  return { html: aus, liste };
}
export function bilderZurueck(html, liste) {
  return String(html).replace(/src\s*=\s*"bild:(\d+)"/gi, (m, n) => (liste[Number(n) - 1] ? `src="${liste[Number(n) - 1]}"` : m));
}
