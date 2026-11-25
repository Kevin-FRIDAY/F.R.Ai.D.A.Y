// Fridays Modell-Bibliothek: echte, fertige 3D-Modelle (glTF/GLB) statt einfacher Grundformen.
//
// - Liegt in ~/Friday-Modelle (außerhalb des Repos, Updates fassen sie nie an).
// - Startmodell: der "Car Concept" von Khronos (CC BY 4.0) wird beim ersten Start geladen.
// - Mit einem kostenlosen Sketchfab-Schlüssel sucht Friday selbst ein passendes, frei herunterladbares
//   Modell ("Lamborghini Huracán", "Boeing 747", "Titanic" …), lädt es herunter und merkt es sich.
//   Urheber und Lizenz werden gespeichert und in der Werkstatt angezeigt (Pflicht bei CC BY).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { get as verbindungHolen, set as verbindungSetzen, clear as verbindungLoeschen, holeJson, passt, norm } from "./verbindungen.js";

export const MODELLE_DIR = process.env.FRIDAY_MODELLE_DIR || path.join(os.homedir(), "Friday-Modelle");
const INDEX = () => path.join(MODELLE_DIR, "modelle.json");
const MAX_BYTES = 60 * 1024 * 1024; // größere Modelle laden auf dem iPhone zu lange
const MAX_FACES = 900000;

const STARTMODELLE = [
  {
    id: "khronos-carconcept",
    name: "Car Concept",
    begriffe: ["auto", "sportwagen", "konzeptauto", "car", "concept car", "supersportwagen"],
    art: "sportwagen",
    autor: "Unity Fan / Khronos Group",
    lizenz: "CC BY 4.0",
    link: "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb",
    laenge: 4.6,
  },
];

function liesIndex() {
  try {
    const d = JSON.parse(fs.readFileSync(INDEX(), "utf8"));
    return Array.isArray(d.modelle) ? d : { modelle: [] };
  } catch {
    return { modelle: [] };
  }
}
function schreibIndex(d) {
  fs.mkdirSync(MODELLE_DIR, { recursive: true });
  const tmp = INDEX() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, INDEX());
}
const sicher = (id) => String(id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
const dateiVon = (m) => path.join(MODELLE_DIR, `${sicher(m.id)}.glb`);

export function liste() {
  return liesIndex().modelle.filter((m) => fs.existsSync(dateiVon(m)));
}
export function modellDatei(id) {
  const m = liste().find((x) => x.id === sicher(id));
  return m ? dateiVon(m) : null;
}

// Füllwörter weg: "Friday, bau mir bitte einen roten Lamborghini Huracán" → "lamborghini huracan"
const WEG = new Set("friday hey hallo bitte bau baue bauen entwirf entwerfe zeichne konstruier konstruiere mach erstell erstelle zeig zeige mir uns mal ein eine einen einem einer der die das den dem in werkstatt 3d modell hologramm als von und mit kannst du koenntest echtes echten echte realistisch realistisches neues neuen".split(" "));
const FARBEN = /^(rot|rote|roten|roter|rotes|gelb\w*|blau\w*|gruen\w*|schwarz\w*|weiss\w*|silber\w*|grau\w*|orange\w*|lila|violett\w*)$/;
const ohneAkzent = (t) => String(t || "").replace(/ß/g, "ss").replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function suchwort(text) {
  return norm(ohneAkzent(text)).split(" ").filter((w) => w && !WEG.has(w) && !FARBEN.test(w)).join(" ").trim();
}

// Deutsch → Englisch für die Suche (Sketchfab ist fast nur englisch beschriftet).
const UEBERSETZT = {
  auto: "car", sportwagen: "sports car", supersportwagen: "supercar", limousine: "sedan car", gelaendewagen: "suv", lkw: "truck", laster: "truck", sattelzug: "semi truck",
  bus: "bus", motorrad: "motorcycle", zug: "train", lokomotive: "locomotive", flugzeug: "airliner airplane", verkehrsflugzeug: "airliner", passagierflugzeug: "airliner",
  kampfjet: "fighter jet", kampfflugzeug: "fighter jet", helikopter: "helicopter", hubschrauber: "helicopter", schiff: "ship", containerschiff: "container ship",
  kreuzfahrtschiff: "cruise ship", frachter: "cargo ship", boot: "boat", motorboot: "motor boat", yacht: "yacht", segelboot: "sailboat", segelyacht: "sailing yacht",
  "u boot": "submarine", uboot: "submarine", rakete: "rocket", panzer: "tank", traktor: "tractor", bagger: "excavator", feuerwehrauto: "fire truck", elektroauto: "electric car",
  flugzeugtraeger: "aircraft carrier", haus: "house", burg: "castle", schloss: "castle", bruecke: "bridge", turm: "tower", raumschiff: "spaceship", roboter: "robot",
};
export function englisch(q) {
  let t = ` ${q} `;
  for (const [de, en] of Object.entries(UEBERSETZT)) t = t.replace(new RegExp(` ${de} `, "g"), ` ${en} `);
  return t.trim();
}

// Wie gut passt ein Modellname zur Suche? Wichtig: alle Suchwörter sollen drinstecken
// ("Container Ship" schlägt "Container" bei der Suche nach "container ship").
function treffer(q, name) {
  const qw = norm(ohneAkzent(q)).split(" ").filter(Boolean), nw = norm(ohneAkzent(name)).split(" ").filter(Boolean);
  if (!qw.length || !nw.length) return 0;
  const gleich = (a, b) => a === b || (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a)));
  const cov = qw.filter((w) => nw.some((x) => gleich(w, x))).length / qw.length;
  const prec = nw.filter((x) => qw.some((w) => gleich(w, x))).length / nw.length;
  return cov * 0.75 + prec * 0.25;
}

// Passendes Modell aus der eigenen Bibliothek.
export function findeLokal(text) {
  const q = suchwort(text);
  if (!q) return null;
  let best = null, score = 0;
  for (const m of liste()) {
    for (const n of [m.name, ...(m.begriffe || [])]) {
      const s = Math.max(treffer(q, n), passt(q, n));
      if (s > score) { best = m; score = s; }
    }
  }
  return score >= 0.72 ? best : null;
}

// ---------- Sketchfab ----------
export function sketchfabToken() {
  return process.env.SKETCHFAB_API_TOKEN || verbindungHolen("sketchfab").token || "";
}
export function status() {
  return { ordner: MODELLE_DIR, sketchfab: Boolean(sketchfabToken()), konto: verbindungHolen("sketchfab").name || "", modelle: liste().map(({ id, name, autor, lizenz, link }) => ({ id, name, autor, lizenz, link })) };
}
export async function sketchfabVerbinden(token) {
  const t = String(token || "").trim();
  if (!/^[a-zA-Z0-9]{20,64}$/.test(t)) return { ok: false, error: "Das sieht nicht wie ein Sketchfab-API-Schlüssel aus (32 Zeichen, nur Buchstaben und Zahlen)." };
  const r = await holeJson("https://api.sketchfab.com/v3/me", { headers: { Authorization: `Token ${t}` } });
  if (r.netz) return { ok: false, error: "Sketchfab ist gerade nicht erreichbar." };
  if (!r.ok) return { ok: false, error: "Sketchfab kennt diesen Schlüssel nicht. Kopier ihn bitte noch einmal unter sketchfab.com → Einstellungen → Password & API." };
  verbindungSetzen("sketchfab", { token: t, name: r.data?.displayName || r.data?.username || "" });
  return { ok: true, name: r.data?.displayName || r.data?.username || "" };
}
export function sketchfabTrennen() {
  verbindungLoeschen("sketchfab");
  return { ok: true };
}

const TEILE = /\b(wheel|rim|tire|tyre|engine|motor block|interior|seat|steering|cockpit only|dashboard|logo|badge|emblem|key|headlight|taillight|exhaust|spoiler|door|mirror|brake|caliper|piston|gearbox|propeller only|parts?|kit|pack|collection|scene|diorama|garage|showroom|toy|lego|minecraft|cartoon|low ?poly|lowpoly|sketch|wip|blueprint)\b/i;

const AUTO_ARTEN = new Set(["sportwagen", "limousine", "suv", "auto", "coupe", "kombi"]);

export async function sucheSketchfab(text, { art } = {}) {
  const q0 = suchwort(text);
  const q = englisch(q0) || q0;
  if (!q) return [];
  const url = `https://api.sketchfab.com/v3/search?type=models&downloadable=true&count=24&q=${encodeURIComponent(q)}`;
  const r = await holeJson(url, { timeout: 15000 });
  if (!r.ok) return [];
  const kandidaten = (r.data?.results || []).map((m) => {
    const glb = m.archives?.glb;
    const name = String(m.name || "");
    let s = Math.max(treffer(q, name), treffer(q0, name));
    if (TEILE.test(name)) s -= 0.6;
    if (!glb || !glb.size || glb.size > MAX_BYTES) s -= 2;
    if ((m.faceCount || 0) > MAX_FACES) s -= 0.5;
    if ((m.faceCount || 0) < 3000) s -= 0.3; // sehr grob → wirkt nicht echt
    // v1.175.0: Autos brauchen viele Flächen, sonst wirken sie wieder wie Spielzeug
    if (AUTO_ARTEN.has(art) && (m.faceCount || 0) < 25000) s -= 0.35;
    if (AUTO_ARTEN.has(art) && (m.faceCount || 0) >= 80000) s += 0.08;
    if (/^(cc0|cc ?by(?! ?-?nc)(?! ?-?nd)|cc attribution$)/i.test(String((m.license && (m.license.label || m.license)) || "").trim())) s += 0.05; // frei auch für Weitergabe
    if ((glb?.size || 0) > 30e6) s -= 0.1; // große Dateien laden auf dem iPhone lange
    s += Math.min(0.25, Math.log10(1 + (m.likeCount || 0)) / 12);
    return { uid: m.uid, name, autor: m.user?.displayName || m.user?.username || "", lizenz: (m.license && (m.license.label || m.license)) || "", link: m.viewerUrl, groesse: glb?.size || 0, faces: m.faceCount || 0, score: s, art };
  });
  return kandidaten.filter((k) => k.score > 0.3).sort((a, b) => b.score - a.score);
}

async function herunterladen(k, token) {
  const r = await holeJson(`https://api.sketchfab.com/v3/models/${encodeURIComponent(k.uid)}/download`, { headers: { Authorization: `Token ${token}` }, timeout: 15000 });
  if (r.status === 401 || r.status === 403) throw new Error("Sketchfab lehnt den Schlüssel ab.");
  const url = r.data?.glb?.url;
  if (!r.ok || !url) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES * 1.2 || buf.subarray(0, 4).toString() !== "glTF") return null;
  fs.mkdirSync(MODELLE_DIR, { recursive: true });
  const m = { id: sicher(`sf-${k.uid}`), name: k.name, autor: k.autor, lizenz: k.lizenz, link: k.link, quelle: "Sketchfab", art: k.art || null, geladen: new Date().toISOString() };
  fs.writeFileSync(dateiVon(m), buf);
  return m;
}

/** Sucht auf Sketchfab und lädt das beste Modell in die Bibliothek. Liefert den Eintrag oder null. */
export async function holeModell(text, { art, titel } = {}) {
  const token = sketchfabToken();
  if (!token) return null;
  let kandidaten = await sucheSketchfab(titel || text, { art });
  if (!kandidaten.length && titel) kandidaten = await sucheSketchfab(text, { art });
  for (const k of kandidaten.slice(0, 3)) {
    try {
      const m = await herunterladen(k, token);
      if (!m) continue;
      const d = liesIndex();
      m.begriffe = [...new Set([suchwort(text), suchwort(titel || ""), suchwort(k.name)].filter(Boolean))];
      d.modelle = [...d.modelle.filter((x) => x.id !== m.id), m];
      schreibIndex(d);
      return m;
    } catch (err) {
      if (/Schlüssel/.test(err.message)) throw err;
    }
  }
  return null;
}

/** Startmodelle einmalig herunterladen (still im Hintergrund, nur wenn sie fehlen). */
export async function startmodelleLaden() {
  const d = liesIndex();
  let neu = false;
  for (const s of STARTMODELLE) {
    if (d.modelle.some((m) => m.id === s.id) && fs.existsSync(dateiVon(s))) continue;
    try {
      const res = await fetch(s.url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.subarray(0, 4).toString() !== "glTF") continue;
      fs.mkdirSync(MODELLE_DIR, { recursive: true });
      fs.writeFileSync(dateiVon(s), buf);
      const { url, ...eintrag } = s;
      d.modelle = [...d.modelle.filter((m) => m.id !== s.id), { ...eintrag, quelle: "Khronos glTF Sample Assets" }];
      neu = true;
    } catch { /* später noch einmal */ }
  }
  if (neu) schreibIndex(d);
}

/**
 * v1.175.0 Auto-Studio: echtes Modell für "BMW M4" & Co. Erst die eigene Bibliothek, dann Sketchfab.
 * Antwort: { ok, datei } oder { ok: false, grund: "kein-schluessel" | "nichts-gefunden" | "schluessel-falsch", text }.
 */
export async function autoModell(suche, laenge = null) {
  const q = String(suche || "").trim().slice(0, 120);
  if (!q) return { ok: false, grund: "nichts-gefunden", text: "Welches Auto?" };
  const info = (m) => ({ id: m.id, name: m.name, autor: m.autor || "", lizenz: m.lizenz || "", link: m.link || "", quelle: m.quelle || "", laenge });
  const lokal = findeLokal(q);
  if (lokal && lokal.id !== "khronos-carconcept") return { ok: true, datei: info(lokal) };
  if (!sketchfabToken()) return { ok: false, grund: "kein-schluessel", text: "Für echte 3D-Modelle braucht Friday einmalig einen kostenlosen Sketchfab-Schlüssel." };
  try {
    const m = await holeModell(q, { art: "sportwagen", titel: q });
    if (m) return { ok: true, datei: info(m) };
  } catch (err) {
    return { ok: false, grund: "schluessel-falsch", text: err.message };
  }
  return { ok: false, grund: "nichts-gefunden", text: `Auf Sketchfab gibt es gerade kein frei ladbares, detailreiches Modell für „${q}“.` };
}
