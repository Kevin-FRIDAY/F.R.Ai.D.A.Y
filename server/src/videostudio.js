// Fridays Video-Studio (Erweiterung des Schnitt-Teams): erstellt auf Zuruf ein komplettes Kurzvideo.
// "Friday, erstell mir ein 20-Sekunden-Video über Mallorca mit Musik"
//   Regie      – schreibt das Drehbuch (Claude, ohne Guthaben: Wikipedia/Vorlage)
//   Bildsucher – freie Fotos ohne Namensnennungspflicht (Openverse, nur CC0/Public Domain) oder deine eigenen Clips/Fotos
//   Grafik     – Neon-Hintergründe, Titel, Übergänge
//   Komponist  – komponiert eigene Musik (musik.js, keine fremden Lieder, keine Lizenzen)
//   Sprecher   – spricht den Text ein (Mac-Stimme, optional)
//   Render     – setzt alles mit ffmpeg zusammen → ~/Friday-Video/Fertig
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { ROOT } from "./config.js";
import { VIDEO_DIRS } from "./videoteam.js";
import { komponiere, STIMMUNGEN, STIMMUNG_IDS, stimmungAus } from "./musik.js";
import { denke, jsonAus } from "./denker.js";
import { eintragen } from "./logbuch.js";
import { leseAnweisung, LOOK_FILTER, LOOK_NAMEN } from "./regieplan.js";

export const FORMATE = {
  hoch: { w: 1080, h: 1920, name: "9:16 Hochformat (TikTok, Reels, Shorts)", openverse: "tall" },
  quer: { w: 1920, h: 1080, name: "16:9 Querformat (YouTube)", openverse: "wide" },
  quadrat: { w: 1080, h: 1080, name: "1:1 Quadrat (Instagram)", openverse: "square" },
};
export const BILDQUELLEN = { auto: "Freie Fotos (automatisch)", grafik: "Nur Neon-Grafik", eigene: "Meine Clips & Fotos (Ordner Eingang)" };
export const STUDIO_TEAM = [
  ["regie", "Regie", "Drehbuch schreiben, Szenen planen"],
  ["bilder", "Bildsucher", "Freie Fotos oder deine Clips"],
  ["grafik", "Grafik", "Neon-Look, Titel, Übergänge"],
  ["komponist", "Komponist", "Eigene Musik komponieren"],
  ["sprecher", "Sprecher", "Text einsprechen (Mac-Stimme)"],
  ["render", "Render", "Alles zusammensetzen"],
];
const FPS = 30;
const UEBERGANG = 0.6;
const UEBERGAENGE = ["fade", "slideleft", "circleopen", "smoothup", "dissolve", "wipeleft", "radial", "slideup"];
const UEBERGAENGE_WEICH = ["fade", "dissolve", "fadeblack", "smoothleft"];
const UEBERGAENGE_SCHNELL = ["slideleft", "wipeup", "smoothup", "slideright", "zoomin", "wipeleft"];
const BILD_EXT = /\.(jpe?g|png|webp)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm)$/i;
const FONTS_MAC = "/System/Library/Fonts/Supplemental";

let job = null;
let verlauf = []; // letzte fertige Aufträge (nur im Speicher)

// ---------- ffmpeg finden (mitgeliefert vom Schnitt-Team, Homebrew oder System) ----------
let ffCache;
export function findeFfmpeg() {
  if (ffCache !== undefined) return ffCache;
  const kandidaten = [process.env.FRIDAY_FFMPEG];
  try {
    const lib = path.resolve(ROOT, "..", ".venv", "lib");
    for (const py of fs.readdirSync(lib)) {
      const bin = path.join(lib, py, "site-packages", "imageio_ffmpeg", "binaries");
      try { for (const f of fs.readdirSync(bin)) if (/^ffmpeg/.test(f)) kandidaten.push(path.join(bin, f)); } catch { /* weiter */ }
    }
  } catch { /* keine Python-Umgebung */ }
  kandidaten.push("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg");
  ffCache = kandidaten.find((k) => k && fs.existsSync(k)) || null;
  return ffCache;
}

const kurz = (s, n = 160) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const klemm = (x, a, b) => Math.max(a, Math.min(b, x));

export function studioBereit() {
  return Boolean(findeFfmpeg());
}

export function getStudio() {
  return {
    bereit: studioBereit(),
    mac: process.platform === "darwin",
    formate: Object.entries(FORMATE).map(([id, f]) => ({ id, name: f.name })),
    stimmungen: STIMMUNG_IDS.map((id) => ({ id, name: STIMMUNGEN[id].name, bpm: STIMMUNGEN[id].bpm })),
    bildquellen: Object.entries(BILDQUELLEN).map(([id, name]) => ({ id, name })),
    team: STUDIO_TEAM.map(([id, name, aufgabe]) => ({ id, name, aufgabe })),
    job,
    verlauf: verlauf.slice(0, 8),
  };
}

/** Fertige Videos im Ordner Fertig (neueste zuerst). */
export function listeVideos() {
  let namen = [];
  try { namen = fs.readdirSync(VIDEO_DIRS.fertig).filter((f) => VIDEO_EXT.test(f) && !f.startsWith(".")); } catch { return []; }
  return namen.map((f) => {
    let st; try { st = fs.statSync(path.join(VIDEO_DIRS.fertig, f)); } catch { return null; }
    let info = null;
    try { info = JSON.parse(fs.readFileSync(path.join(VIDEO_DIRS.fertig, f.replace(VIDEO_EXT, ".json")), "utf8")); } catch { /* ohne Infos */ }
    return {
      name: f, zeit: st.mtime.toISOString(), groesse: st.size,
      art: /^Friday-Studio/.test(f) ? "studio" : /^Friday-Schnitt/.test(f) ? "schnitt" : "anderes",
      titel: info?.titel || f.replace(VIDEO_EXT, "").replace(/[-_]+/g, " "),
      sekunden: info?.sekunden || null, format: info?.format || null, musik: info?.musik?.name || null,
      datei: `video/${encodeURIComponent(f)}`,
      poster: fs.existsSync(path.join(VIDEO_DIRS.fertig, f.replace(VIDEO_EXT, ".jpg"))) ? `/api/studio/poster/${encodeURIComponent(f.replace(VIDEO_EXT, ".jpg"))}` : null,
    };
  }).filter(Boolean).sort((a, b) => b.zeit.localeCompare(a.zeit)).slice(0, 60);
}

// ---------- Auftrag verstehen ----------
export function normalisiereAuftrag(a = {}) {
  const sekunden = klemm(Math.round(Number(a.sekunden) || 20), 5, 90);
  const format = FORMATE[a.format] ? a.format : "hoch";
  let musik = a.musik;
  if (musik === true || musik === "ja" || musik === undefined || musik === null || musik === "") musik = "auto";
  if (musik === false || musik === "nein") musik = "aus";
  if (!["auto", "aus", "eigene", ...STIMMUNG_IDS].includes(musik)) musik = stimmungAus(musik) || "auto";
  const bilder = BILDQUELLEN[a.bilder] ? a.bilder : "auto";
  // Der Text ist eine Regie-Anweisung: daraus werden echte Schnitt-Vorgaben (und nur ein kurzes Thema).
  const anweisung = kurz([a.anweisung || a.thema, a.stil].filter(Boolean).join(". "), 900);
  const plan = leseAnweisung(anweisung, { art: "studio" });
  const auftrag = {
    thema: plan.kern || kurz(a.thema, 60) || "Friday", anweisung,
    sekunden: plan.sekunden ? klemm(plan.sekunden, 5, 90) : sekunden,
    format: plan.format || format,
    musik: plan.musik || musik,
    bilder: plan.bilder || bilder,
    sprecher: plan.sprecher ?? Boolean(a.sprecher),
    stil: kurz(a.stil, 200),
  };
  auftrag.regie = regieWerte(plan, auftrag);
  return auftrag;
}

/** Aus dem Regie-Plan konkrete Werte für Szenen, Übergänge, Zoom, Look und Text machen. */
export function regieWerte(plan, a) {
  const tempo = plan.tempo || "normal";
  const proSzene = tempo === "schnell" ? 2.2 : tempo === "ruhig" ? 6 : 4;
  let anzahl = klemm(Math.round(a.sekunden / proSzene), 2, tempo === "schnell" ? 20 : 12);
  if (plan.szenen.length) anzahl = klemm(Math.max(anzahl, plan.szenen.length + (plan.cta ? 1 : 0)), 2, 20);
  const uebergang = plan.uebergang || (tempo === "schnell" ? "schnell" : tempo === "ruhig" ? "weich" : "dynamisch");
  const dauer = { hart: 0.08, schnell: 0.3, weich: 1.0, dynamisch: UEBERGANG }[uebergang];
  return {
    tempo, anzahl, uebergang, uebergangDauer: Math.min(dauer, (a.sekunden / anzahl) * 0.4),
    zoom: tempo === "schnell" ? 0.22 : tempo === "ruhig" ? 0.07 : 0.14,
    look: plan.look || null, farbe: plan.farbe?.hex || null, textmenge: plan.textmenge || "normal",
    ziel: plan.ziel, szenen: plan.szenen, texte: plan.texte, cta: plan.cta,
    verstanden: plan.verstanden,
  };
}

// ---------- Start ----------
export function starteStudio(eingabe = {}, { quelle = "dashboard" } = {}) {
  if (!studioBereit()) return { ok: false, error: "Für Videos braucht Friday das Programm ffmpeg. Am einfachsten: Schnitt-Team einrichten (extras-installieren.sh) oder 'brew install ffmpeg'." };
  if (job && job.status === "läuft") return { ok: false, laeuftSchon: true, error: `Das Studio arbeitet gerade schon an „${job.auftrag.thema}“.` };
  const auftrag = normalisiereAuftrag(eingabe);
  job = {
    id: Date.now().toString(36), status: "läuft", start: new Date().toISOString(), quelle, auftrag,
    agents: Object.fromEntries(STUDIO_TEAM.map(([id]) => [id, { status: "wartet", text: "", pct: 0 }])),
    log: [], drehbuch: null, musik: null, result: null, error: null,
  };
  const j = job;
  produziere(j).catch((err) => {
    j.status = "fehler";
    j.error = kurz(err?.message || String(err), 300);
    melde(j, "render", "fehler", j.error);
  }).finally(() => {
    j.ende = new Date().toISOString();
    eintragen(j.status === "fertig"
      ? { bereich: "video", titel: `Video erstellt: ${j.drehbuch?.titel || j.auftrag.thema} (${j.auftrag.sekunden} s${j.musik ? `, Musik ${j.musik.name}` : ""})`, details: j.result?.name || "", quelle: quelle === "dashboard" ? "dashboard" : "automatisch" }
      : { bereich: "video", titel: `Video-Studio abgebrochen: ${j.auftrag.thema}`, details: j.error || "", quelle: "automatisch", ok: false });
    if (j.status === "fertig") verlauf.unshift({ id: j.id, titel: j.drehbuch?.titel, name: j.result?.name, sekunden: j.result?.dur, zeit: j.ende });
    verlauf = verlauf.slice(0, 20);
    try { fs.rmSync(j.arbeit, { recursive: true, force: true }); } catch { /* egal */ }
  });
  return { ok: true, id: j.id, auftrag };
}

function melde(j, agent, status, text = "", pct = null) {
  const a = j.agents[agent];
  if (!a) return;
  a.status = status;
  a.text = kurz(text, 200);
  if (pct !== null) a.pct = klemm(Math.round(pct), 0, 100);
  else if (status === "fertig" || status === "übersprungen") a.pct = 100;
  j.log.push({ t: Date.now(), agent, text: kurz(text, 200) });
  if (j.log.length > 80) j.log.shift();
}

async function produziere(j) {
  const a = j.auftrag;
  const F = FORMATE[a.format];
  for (const d of Object.values(VIDEO_DIRS)) fs.mkdirSync(d, { recursive: true });
  j.arbeit = fs.mkdtempSync(path.join(os.tmpdir(), "friday-studio-"));

  // 1) Regie: Drehbuch
  const R = a.regie;
  const anzahl = R.anzahl;
  if (R.verstanden.length) melde(j, "regie", "läuft", `Deine Anweisung: ${R.verstanden.slice(1).join(" · ") || R.verstanden[0]}`, 5);
  melde(j, "regie", "läuft", `Schreibe Drehbuch: ${anzahl} Szenen für ${a.sekunden} Sekunden (Tempo ${R.tempo}) …`, 10);
  const db = await drehbuch(a, anzahl, j);
  setzeVorgaben(db, a);
  db.uebergang = R.uebergangDauer;
  j.drehbuch = db;
  melde(j, "regie", "fertig", `„${db.titel}“ · ${db.szenen.length} Szenen · ${db.quelle}${R.look ? ` · Look ${LOOK_NAMEN[R.look]}` : ""}`);

  // 2) Bildsucher + 3) Komponist + Sprecher parallel
  const stimmung = a.musik === "auto" ? (STIMMUNGEN[db.stimmung] ? db.stimmung : stimmungAus(`${a.anweisung} ${R.tempo === "schnell" ? "energie" : R.tempo === "ruhig" ? "chill" : ""}`) || "neon") : a.musik;
  const [, musikDatei, stimme] = await Promise.all([
    bilderSuchen(j, db, F),
    musikMachen(j, stimmung, a.sekunden),
    sprechen(j, db, a),
  ]);

  // 4) Grafik: Hintergründe für Szenen ohne Bild, Titel als ASS
  melde(j, "grafik", "läuft", "Baue Neon-Hintergründe und Titel …", 10);
  db.szenen.forEach((s, i) => {
    if (!s.datei) { s.datei = path.join(j.arbeit, `grafik-${i}.ppm`); neonGrafik(s.datei, F.w / 2, F.h / 2, s.farbe, i); s.art = "grafik"; }
  });
  const U = db.uebergang;
  const L = (a.sekunden + (db.szenen.length - 1) * U) / db.szenen.length;
  const ass = path.join(j.arbeit, "titel.ass");
  fs.writeFileSync(ass, titelAss(db, F, L, U, R.textmenge));
  const nTitel = db.szenen.filter((s) => s.text).length;
  melde(j, "grafik", "fertig", `${db.szenen.filter((s) => s.art === "grafik").length} Neon-Grafiken · ${nTitel ? `${nTitel} Titel` : "ohne Text"} · ${db.szenen.length - 1} ${R.uebergang === "hart" ? "harte Schnitte" : R.uebergang === "weich" ? "weiche Blenden" : "Übergänge"}`);

  // 5) Render
  const stamm = `Friday-Studio_${new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-")}_${slug(db.titel)}`;
  const out = path.join(VIDEO_DIRS.fertig, `${stamm}.mp4`);
  await render(j, { db, F, L, ass, musikDatei, stimme, out, T: a.sekunden });
  const dur = await dauer(out);
  if (!dur) throw new Error("Das fertige Video ist leer.");
  // Vorschaubild (für die Video-Liste und iPhone-Safari, das ohne Antippen nur Schwarz zeigt)
  await new Promise((res) => execFile(findeFfmpeg(), ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(Math.min(2.2, dur / 3)), "-i", out, "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "4", out.replace(/\.mp4$/, ".jpg")], () => res()));
  const info = { titel: db.titel, thema: a.thema, anweisung: a.anweisung, regie: { tempo: R.tempo, uebergang: R.uebergang, look: R.look, textmenge: R.textmenge, verstanden: R.verstanden }, sekunden: Math.round(dur * 10) / 10, format: a.format, musik: j.musik, sprecher: Boolean(stimme), szenen: db.szenen.map((s) => ({ text: s.text, unter: s.unter, bild: s.bild || null })), erstellt: new Date().toISOString() };
  fs.writeFileSync(out.replace(/\.mp4$/, ".json"), JSON.stringify(info, null, 2));
  const quellen = db.szenen.filter((s) => s.bild?.seite).map((s) => `- ${s.bild.titel || "Foto"} (${s.bild.lizenz}) ${s.bild.seite}`);
  fs.writeFileSync(out.replace(/\.mp4$/, ".txt"), `${db.titel}\n\n${db.beschreibung || ""}\n\n${db.hashtags || ""}\n\nMusik: selbst komponiert von Friday (${j.musik?.name || "ohne"}), frei verwendbar.\n${quellen.length ? `Fotos (gemeinfrei, keine Namensnennung nötig):\n${quellen.join("\n")}\n` : ""}`);
  j.result = { file: out, name: path.basename(out), dur: info.sekunden, datei: `video/${encodeURIComponent(path.basename(out))}`, poster: `/api/studio/poster/${encodeURIComponent(path.basename(out).replace(/\.mp4$/, ".jpg"))}`, beschreibung: db.beschreibung || "", hashtags: db.hashtags || "" };
  j.status = "fertig";
  melde(j, "render", "fertig", `Fertig: ${path.basename(out)} (${Math.round(dur)} s)`);
}

function slug(s) {
  return String(s || "video").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "video";
}

// ---------- Regie ----------
const FARBEN = ["#ff8a1e", "#2ee6d0", "#a978ff", "#ff3fa8", "#4f8dff", "#ffc44d"];

async function drehbuch(a, anzahl, j) {
  const R = a.regie;
  const system = "Du bist die Regie in Fridays Video-Studio. Du schreibst Drehbücher für kurze Social-Media-Videos auf Deutsch. Der Auftrag ist eine ANWEISUNG an dich (worum es geht, wie es wirken soll) und KEIN Text fürs Video: setze sie um, übernimm keine Sätze daraus wörtlich ins Bild (Ausnahme: Texte in Anführungszeichen). Antworte NUR mit JSON, ohne Erklärung.";
  const vorgaben = [
    `Thema: ${a.thema}`,
    R.ziel && `Ziel: ${{ vorstellung: "Vorstellung – wer sind sie, was machen sie, warum sie (persönlich, sympathisch, KEIN Verkaufspreis, keine Preise)", werbung: "Werbung – klarer Nutzen, Aufruf am Ende", erklaerung: "Erklärvideo – Schritt für Schritt, ein Gedanke pro Szene", story: "Kleine Geschichte mit Anfang, Höhepunkt, Ende" }[R.ziel]}`,
    `Tempo: ${R.tempo}${R.tempo === "schnell" ? " (kurze, knackige Zeilen, viele Szenen)" : R.tempo === "ruhig" ? " (wenige, ruhige Szenen)" : ""}`,
    R.szenen.length && `Szenen-Reihenfolge (genau so einhalten, je eine Szene, Bild passend dazu): ${R.szenen.map((x, i) => `${i + 1}. ${x}`).join("; ")}`,
    R.texte.length && `Diese Texte müssen wörtlich vorkommen: ${R.texte.map((x) => `"${x}"`).join(", ")}`,
    R.cta && `Letzte Szene = Aufruf: "${R.cta}"`,
    R.textmenge === "ohne" ? "Kein Text im Bild: text und unter leer lassen (außer den vorgegebenen Texten)." : R.textmenge === "wenig" ? "Wenig Text: nur Hauptzeilen mit höchstens 4 Wörtern, unter leer." : "",
    R.look && `Look: ${LOOK_NAMEN[R.look]}`,
  ].filter(Boolean).join("\n");
  const text = `Auftrag von Kevin (Anweisung, nicht abschreiben): """${a.anweisung}"""

Was die Regie daraus verstanden hat:
${vorgaben}

Schreib ein Drehbuch für ein ${a.sekunden}-Sekunden-Video (${FORMATE[a.format].name}).
Genau ${anzahl} Szenen. JSON-Form:
{"titel":"kurzer Videotitel","stimmung":"${STIMMUNG_IDS.join("|")}","szenen":[{"text":"Hauptzeile, höchstens 6 Wörter (eigene Worte, nicht aus dem Auftrag kopiert)","unter":"Unterzeile, höchstens 10 Wörter (oder leer)","bild":"englischer Suchbegriff für ein passendes Foto (2-4 Wörter, konkret: was man sieht)","farbe":"#rrggbb Akzentfarbe"}],"sprecher":"Sprechertext für genau ${a.sekunden} Sekunden (ca. ${Math.round(a.sekunden * 2.2)} Wörter)","beschreibung":"Bildunterschrift für Social Media, 1-2 Sätze","hashtags":"4 passende Hashtags"}
Szene 1 ist ein starker Einstieg (Hook), die letzte ein Abschluss. Keine erfundenen Zahlen, keine Preise, keine Markennamen-Werbung.${R.farbe ? ` Akzentfarbe überwiegend ${R.farbe}.` : ""}`;
  let roh = null;
  let uhr;
  try {
    const r = await Promise.race([
      denke({ system, text, stufe: "leicht", maxTokens: 2200, quelle: "schnitt" }),
      new Promise((res) => { uhr = setTimeout(() => res({ ok: false, error: "Zeitüberschreitung" }), 35000); }),
    ]);
    clearTimeout(uhr);
    if (r.ok) roh = jsonAus(r.text);
    else melde(j, "regie", "läuft", `${r.error || "Claude nicht erreichbar"} · nehme Plan B`, 40);
  } catch { /* Plan B */ }
  if (roh?.szenen?.length) {
    const szenen = roh.szenen.slice(0, anzahl).map((s, i) => ({
      text: istKopie(s.text, a.anweisung) ? "" : kurz(s.text, 60), unter: istKopie(s.unter, a.anweisung) ? "" : kurz(s.unter, 90), suche: kurz(s.bild, 60) || R.szenen[i] || a.thema,
      farbe: R.farbe || (/^#[0-9a-f]{6}$/i.test(s.farbe || "") ? s.farbe : FARBEN[i % FARBEN.length]),
    }));
    return { titel: kurz(roh.titel, 70) || a.thema, stimmung: roh.stimmung, szenen, sprecher: kurz(roh.sprecher, 1200), beschreibung: kurz(roh.beschreibung, 300), hashtags: kurz(roh.hashtags, 120), quelle: "Claude" };
  }
  return planB(a, anzahl, j);
}

/** Hat jemand den Auftragstext einfach abgeschrieben? (mehr als 6 Wörter am Stück gleich) */
function istKopie(zeile, auftrag) {
  const z = String(zeile || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  const a = String(auftrag || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ");
  return z.split(" ").length >= 6 && a.includes(z);
}

/** Vorgaben aus der Anweisung fest einbauen – egal ob Claude oder Plan B das Drehbuch geschrieben hat. */
function setzeVorgaben(db, a) {
  const R = a.regie;
  const sz = db.szenen;
  // Szenen-Reihenfolge: Bildsuche je Szene nach Kevins Liste
  R.szenen.forEach((x, i) => { if (sz[i] && !sz[i].sucheFest) { sz[i].sucheFest = true; if (db.quelle !== "Claude") sz[i].suche = x; } });
  if (R.textmenge === "ohne") sz.forEach((s) => { s.text = ""; s.unter = ""; });
  if (R.textmenge === "wenig") sz.forEach((s) => { s.unter = ""; s.text = s.text.split(" ").slice(0, 4).join(" "); });
  // Texte in Anführungszeichen stehen wörtlich im Video
  R.texte.forEach((x, i) => { if (sz[i]) { sz[i].text = x; if (R.textmenge !== "normal") sz[i].unter = ""; } });
  if (R.cta && sz.length) { const l = sz[sz.length - 1]; l.text = R.cta; if (R.textmenge !== "normal") l.unter = ""; }
  if (R.farbe) sz.forEach((s) => { s.farbe = R.farbe; });
}

// Ohne Claude: Wikipedia-Zusammenfassung zum Thema, sonst eine Vorlage passend zum Ziel.
// Wichtig: der Auftragstext selbst landet NIE als Bildschirmtext – nur das kurze Thema.
const VORLAGEN = {
  vorstellung: [["Das sind wir", "Schön, dass du da bist"], ["Was wir machen", "Mit Herz und Können"], ["Darauf kannst du zählen", "Ehrlich, persönlich, zuverlässig"], ["Unser Team", "Menschen, die anpacken"], ["Lern uns kennen", ""]],
  werbung: [["Neu für dich", ""], ["Das bekommst du", "Qualität, die man sieht"], ["Darum lohnt es sich", "Einfach. Schnell. Gut."], ["Überzeug dich selbst", ""]],
  erklaerung: [["So funktioniert's", "Schritt für Schritt"], ["Schritt 1", "Der Anfang"], ["Schritt 2", "Jetzt wird's spannend"], ["Schritt 3", "Fertig!"], ["Gut zu wissen", "Kurz erklärt"]],
  story: [["Es fing an …", ""], ["Dann passierte es", ""], ["Der beste Moment", ""], ["Und am Ende", ""]],
  normal: [["Schon gewusst?", ""], ["Kurz & knackig", "In Sekunden erklärt"], ["Bleib dran", "Gleich kommt das Beste"], ["Das Wichtigste", ""]],
};
async function planB(a, anzahl, j) {
  const R = a.regie;
  melde(j, "regie", "läuft", "Ohne Claude: baue das Drehbuch aus deinen Vorgaben …", 50);
  let saetze = [];
  let titel = a.thema;
  if (!R.ziel || R.ziel === "erklaerung") {
    try {
      const r = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(a.thema)}`, { headers: { "User-Agent": "F.R.Ai.D.A.Y/1.0" }, signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const d = await r.json();
        if (d.type !== "disambiguation" && d.extract) {
          titel = d.title || titel;
          saetze = d.extract.replace(/\([^)]*\)/g, "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 12);
        }
      }
    } catch { /* Vorlage */ }
  }
  const kurzTitel = kurz(titel, 40);
  const szenen = [{ text: R.tempo === "schnell" ? kurzTitel.toUpperCase() : kurzTitel, unter: R.ziel === "vorstellung" ? "Stellt sich vor" : "", suche: a.thema }];
  let mitte;
  if (R.szenen.length) {
    // Kevins Reihenfolge: je Szene ein Bild und eine kurze Zeile
    mitte = R.szenen.map((x) => { const t = x.replace(/^(den|die|das|dem|der|ein|eine|einen)\s+/i, ""); return { text: kurz(t.charAt(0).toUpperCase() + t.slice(1), 40), unter: "", suche: x }; });
    szenen.length = 0;
  } else if (saetze.length) {
    mitte = saetze.slice(0, anzahl - 2).map((s) => { const w = s.split(" "); return { text: w.slice(0, 5).join(" ") + (w.length > 5 ? " …" : ""), unter: w.slice(5, 15).join(" "), suche: a.thema }; });
  } else {
    mitte = VORLAGEN[R.ziel || "normal"].map(([t, u]) => ({ text: t, unter: u, suche: a.thema }));
  }
  const ende = R.cta ? 1 : 1;
  for (let i = 0; szenen.length < anzahl - ende && i < mitte.length; i++) szenen.push(mitte[i]);
  let k = 0;
  while (szenen.length < anzahl - ende) { const v = VORLAGEN[R.ziel || "normal"]; const [t, u] = v[k++ % v.length]; szenen.push({ text: t, unter: R.tempo === "schnell" ? "" : u, suche: a.thema }); }
  szenen.push({ text: R.cta || (R.ziel === "vorstellung" ? "Lern uns kennen" : R.ziel === "werbung" ? "Jetzt entdecken" : "Folge für mehr"), unter: kurzTitel, suche: a.thema });
  szenen.forEach((s, i) => { s.farbe = FARBEN[i % FARBEN.length]; });
  return {
    titel: kurzTitel, stimmung: stimmungAus(`${a.anweisung} ${R.tempo === "schnell" ? "energie" : R.tempo === "ruhig" ? "chill" : ""}`) || "neon", szenen,
    sprecher: saetze.length ? saetze.join(" ").split(" ").slice(0, Math.round(a.sekunden * 2.2)).join(" ") : szenen.map((s) => [s.text, s.unter].filter(Boolean).join(". ")).filter(Boolean).join(". "),
    beschreibung: `${kurzTitel} in ${a.sekunden} Sekunden.`, hashtags: `#${slug(kurzTitel).replace(/-/g, "")} #friday #kurzvideo #${R.ziel === "vorstellung" ? "überuns" : "wissen"}`,
    quelle: saetze.length ? "Wikipedia (ohne Claude)" : "Vorlage (ohne Claude)",
  };
}

// ---------- Bildsucher ----------
async function bilderSuchen(j, db, F) {
  const a = j.auftrag;
  if (a.bilder === "grafik") { melde(j, "bilder", "übersprungen", "Nur Neon-Grafik gewünscht"); return; }
  if (a.bilder === "eigene") {
    let dateien = [];
    try { dateien = fs.readdirSync(VIDEO_DIRS.eingang).filter((f) => (BILD_EXT.test(f) || VIDEO_EXT.test(f)) && !f.startsWith(".")).sort(); } catch { /* leer */ }
    if (!dateien.length) { melde(j, "bilder", "übersprungen", "Ordner Eingang ist leer · nehme Neon-Grafik"); return; }
    db.szenen.forEach((s, i) => {
      const f = dateien[i % dateien.length];
      s.datei = path.join(VIDEO_DIRS.eingang, f);
      s.art = VIDEO_EXT.test(f) ? "clip" : "foto";
      s.bild = { titel: f, lizenz: "eigenes" };
    });
    melde(j, "bilder", "fertig", `${dateien.length} eigene ${dateien.length === 1 ? "Datei" : "Dateien"} auf ${db.szenen.length} Szenen verteilt`);
    return;
  }
  melde(j, "bilder", "läuft", "Suche freie Fotos (gemeinfrei, CC0) …", 5);
  let gefunden = 0;
  const benutzt = new Set();
  for (let i = 0; i < db.szenen.length; i++) {
    const s = db.szenen[i];
    try {
      const treffer = await openverse(s.suche, F.openverse);
      const t = treffer.find((x) => !benutzt.has(x.url)) || treffer[0];
      if (t) {
        const ziel = path.join(j.arbeit, `foto-${i}${/\.png(\?|$)/i.test(t.url) ? ".png" : ".jpg"}`);
        if (await laden(t.url, ziel)) { s.datei = ziel; s.art = "foto"; s.bild = t; benutzt.add(t.url); gefunden++; }
      }
    } catch { /* Szene bekommt Neon-Grafik */ }
    melde(j, "bilder", "läuft", `Szene ${i + 1}/${db.szenen.length}: ${s.art === "foto" ? `Foto „${kurz(s.bild?.titel, 40)}“` : "kein passendes Foto, Grafik übernimmt"}`, ((i + 1) / db.szenen.length) * 100);
  }
  melde(j, "bilder", "fertig", gefunden ? `${gefunden} freie Fotos gefunden (keine Namensnennung nötig)` : "Keine Fotos erreichbar · Neon-Grafik übernimmt");
}

async function openverse(q, seite) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&page_size=12&mature=false${seite ? `&aspect_ratio=${seite}` : ""}`;
  const r = await fetch(url, { headers: { "User-Agent": "F.R.Ai.D.A.Y/1.0" }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) return [];
  const d = await r.json();
  return (d.results || []).filter((x) => x.url && (!x.width || x.width >= 700)).map((x) => ({
    url: x.url, titel: kurz(x.title, 80), autor: kurz(x.creator, 60), lizenz: String(x.license || "cc0").toUpperCase(), seite: x.foreign_landing_url || "",
  }));
}

async function laden(url, ziel) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "F.R.Ai.D.A.Y/1.0" }, signal: AbortSignal.timeout(15000), redirect: "follow" });
    if (!r.ok || !/^image\/(jpe?g|png|webp)/i.test(r.headers.get("content-type") || "")) return false;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 8000 || buf.length > 25e6) return false;
    fs.writeFileSync(ziel, buf);
    return true;
  } catch { return false; }
}

// ---------- Komponist ----------
async function musikMachen(j, stimmung, T) {
  if (stimmung === "aus") { melde(j, "komponist", "übersprungen", "Ohne Musik gewünscht"); return null; }
  if (stimmung === "eigene") {
    let liste = [];
    try { liste = fs.readdirSync(VIDEO_DIRS.musik).filter((f) => /\.(mp3|m4a|wav|aac)$/i.test(f)).sort(); } catch { /* leer */ }
    if (liste.length) {
      j.musik = { name: `Eigene: ${liste[0]}`, stimmung: "eigene" };
      melde(j, "komponist", "fertig", `Nehme deine Musik „${liste[0]}“ aus dem Ordner Musik`);
      return path.join(VIDEO_DIRS.musik, liste[0]);
    }
    melde(j, "komponist", "läuft", "Ordner Musik ist leer · komponiere selbst", 10);
    stimmung = "neon";
  }
  melde(j, "komponist", "läuft", `Komponiere ${STIMMUNGEN[stimmung].name} (${STIMMUNGEN[stimmung].bpm} BPM) …`, 20);
  await new Promise((r) => setTimeout(r, 30));
  const datei = path.join(j.arbeit, "musik.wav");
  const m = komponiere({ stimmung, sekunden: T + 0.5, datei, seed: parseInt(j.id, 36) });
  j.musik = m;
  melde(j, "komponist", "fertig", `${m.name} · ${m.bpm} BPM · ${m.tonart} · ${m.takte} Takte, selbst komponiert`);
  return datei;
}

// ---------- Sprecher (macOS "say") ----------
function sayStimmen() {
  return new Promise((res) => execFile("say", ["-v", "?"], { timeout: 8000 }, (e, out) => res(e ? "" : String(out || ""))));
}

async function sprechen(j, db, a) {
  if (!a.sprecher) { melde(j, "sprecher", "übersprungen", "Ohne Sprecher (nur Musik)"); return null; }
  if (process.platform !== "darwin") { melde(j, "sprecher", "übersprungen", "Sprecher gibt es nur auf dem Mac"); return null; }
  const text = kurz(db.sprecher || db.szenen.map((s) => `${s.text}. ${s.unter}`).join(" "), 1200);
  if (!text) { melde(j, "sprecher", "übersprungen", "Kein Sprechtext"); return null; }
  melde(j, "sprecher", "läuft", "Spreche den Text ein …", 20);
  const liste = (await sayStimmen()).split("\n").filter((z) => /de_DE/.test(z)).map((z) => z.split(/\s{2,}|\s+de_DE/)[0].trim());
  const wunsch = ["Anna (Premium)", "Anna (Erweitert)", "Anna (Enhanced)", "Helena (Premium)", "Petra (Premium)", "Anna", "Helena", "Petra", "Markus", "Yannick"];
  const stimme = wunsch.find((w) => liste.includes(w)) || liste[0];
  const woerter = text.split(/\s+/).length;
  const rate = klemm(Math.round(woerter / Math.max(3, a.sekunden - 1.2) * 60), 140, 230);
  const datei = path.join(j.arbeit, "sprecher.aiff");
  const args = [...(stimme ? ["-v", stimme] : []), "-r", String(rate), "-o", datei, text];
  const ok = await new Promise((res) => execFile("say", args, { timeout: 60000 }, (e) => res(!e && fs.existsSync(datei))));
  if (!ok) { melde(j, "sprecher", "übersprungen", "Mac-Stimme hat nicht geantwortet"); return null; }
  melde(j, "sprecher", "fertig", `${woerter} Wörter · ${stimme || "Standardstimme"} · Tempo ${rate}`);
  return datei;
}

// ---------- Grafik: Neon-Hintergrund als PPM-Bild ----------
function hexRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || "") || [0, "ff8a1e"];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function neonGrafik(datei, w, h, farbe, nr) {
  w = Math.round(w); h = Math.round(h);
  const [r, g, b] = hexRgb(farbe);
  const kopf = Buffer.from(`P6\n${w} ${h}\n255\n`);
  const px = Buffer.alloc(w * h * 3);
  const cx = w * (0.3 + 0.4 * ((nr * 37) % 10) / 10), cy = h * 0.38;
  const horizont = h * 0.62;
  const diag = Math.hypot(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy) / diag;
      let glow = Math.exp(-d * d * 18) * 0.9 + Math.exp(-d * 5) * 0.15;
      // Leuchtringe
      const ring = Math.abs(d * diag - h * 0.16) < 2.2 ? 0.55 : Math.abs(d * diag - h * 0.26) < 1.2 ? 0.3 : 0;
      // Gitterboden (Perspektive)
      let gitter = 0;
      if (y > horizont) {
        const tief = (y - horizont) / (h - horizont);
        const wx = (x - w / 2) / (tief * w) * 6;
        const gx = Math.abs(wx - Math.round(wx)) * tief * w / 6;
        const wz = 1.6 / tief;
        const gz = Math.abs(wz - Math.round(wz)) * tief * tief * h * 0.6;
        if (gx < 1.3 || gz < 1.1) gitter = 0.25 + 0.45 * tief;
      }
      const lin = Math.abs(y - horizont) < 1.5 ? 0.8 : 0;
      const k = Math.min(1.4, glow + ring + gitter + lin);
      const grund = 0.05 + 0.05 * (1 - y / h);
      const o = (y * w + x) * 3;
      px[o] = Math.min(255, 8 + r * k + 30 * grund);
      px[o + 1] = Math.min(255, 5 + g * k + 15 * grund);
      px[o + 2] = Math.min(255, 4 + b * k + 25 * grund);
    }
  }
  // Funken
  let s = nr * 9301 + 49297;
  for (let i = 0; i < 160; i++) {
    s = (s * 9301 + 49297) % 233280; const x = Math.floor((s / 233280) * w);
    s = (s * 9301 + 49297) % 233280; const y = Math.floor((s / 233280) * horizont);
    const o = (y * w + x) * 3;
    px[o] = 255; px[o + 1] = Math.min(255, 180 + g / 3); px[o + 2] = Math.min(255, 120 + b / 2);
  }
  fs.writeFileSync(datei, Buffer.concat([kopf, px]));
}

// ---------- Grafik: Titel als ASS-Untertitel ----------
function assZeit(t) {
  t = Math.max(0, t);
  return `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${(t % 60).toFixed(2).padStart(5, "0")}`;
}
const assText = (s) => String(s || "").replace(/[{}\\]/g, "").replace(/\n/g, " ");
function assFarbe(hex) {
  const [r, g, b] = hexRgb(hex);
  return `&H00${b.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${r.toString(16).padStart(2, "0")}&`.toUpperCase();
}

function titelAss(db, F, L, U = UEBERGANG, textmenge = "normal") {
  const s = F.w / 1080; // Schriftgröße passend zum Format
  const gross = Math.round((F.h > F.w ? 96 : 84) * s), klein = Math.round((F.h > F.w ? 48 : 42) * s);
  const unten = Math.round(F.h * (F.h > F.w ? 0.27 : 0.16));
  const rand = Math.round(70 * s);
  const zeilen = [];
  db.szenen.forEach((sz, i) => {
    if (!sz.text && !sz.unter) return; // Szene ohne Text (z. B. „ohne Text“ gewünscht)
    const a = i * (L - U) + Math.min(0.25, U / 2);
    const e = a + L - U * 0.6;
    const yH = F.h - unten - klein * 1.6, yU = F.h - unten + klein * 0.2;
    const farbe = assFarbe(sz.farbe);
    // Hauptzeile: gleitet von unten rein, leuchtet in der Szenenfarbe
    if (sz.text) zeilen.push(`Dialogue: 1,${assZeit(a)},${assZeit(e)},Haupt,,0,0,0,,{\\an2\\move(${F.w / 2},${Math.round(yH + 40 * s)},${F.w / 2},${Math.round(yH)},0,350)\\fad(250,250)\\3c${farbe}\\blur2}${assText(i === 0 ? sz.text.toUpperCase() : sz.text)}`);
    if (sz.unter) zeilen.push(`Dialogue: 0,${assZeit(a + 0.3)},${assZeit(e)},Unter,,0,0,0,,{\\an2\\pos(${F.w / 2},${Math.round(yU + klein)})\\fad(300,250)}${assText(sz.unter)}`);
    // Leuchtstrich unter der Hauptzeile
    const bw = Math.round(F.w * 0.18);
    if (sz.text) zeilen.push(`Dialogue: 0,${assZeit(a + 0.15)},${assZeit(e)},Strich,,0,0,0,,{\\an7\\pos(${Math.round(F.w / 2 - bw / 2)},${Math.round(yH + 14 * s)})\\fad(200,250)\\1c${farbe}\\3c${farbe}\\blur3\\p1}m 0 0 l ${bw} 0 ${bw} ${Math.round(6 * s)} 0 ${Math.round(6 * s)}{\\p0}`);
  });
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${F.w}
PlayResY: ${F.h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Haupt,Arial Black,${gross},&H00FFFFFF,&H00FFFFFF,&H001E8AFF,&H96000000,-1,0,0,0,100,100,1,0,1,${Math.max(3, Math.round(5 * s))},${Math.round(3 * s)},2,${rand},${rand},0,1
Style: Unter,Arial,${klein},&H00F0F4FF,&H00FFFFFF,&H00000000,&H96000000,-1,0,0,0,100,100,0.5,0,1,${Math.max(2, Math.round(3 * s))},${Math.round(2 * s)},2,${rand},${rand},0,1
Style: Strich,Arial,20,&H00FFFFFF,&H00FFFFFF,&H00FFFFFF,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${zeilen.join("\n")}
`;
}

// ---------- Render ----------
const ffEsc = (p) => p.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");

function dauer(datei) {
  return new Promise((res) => execFile(findeFfmpeg(), ["-hide_banner", "-i", datei], (e, out, err) => {
    const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(String(err || ""));
    res(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0);
  }));
}

async function render(j, { db, F, L, ass, musikDatei, stimme, out, T }) {
  melde(j, "render", "läuft", "Setze Szenen, Übergänge, Titel und Ton zusammen …", 1);
  const R = j.auftrag.regie || {};
  const U = db.uebergang ?? UEBERGANG;
  const ZOOM = R.zoom ?? 0.14;
  const liste = R.uebergang === "weich" ? UEBERGAENGE_WEICH : R.uebergang === "hart" ? ["fade"] : R.uebergang === "schnell" ? UEBERGAENGE_SCHNELL : UEBERGAENGE;
  const lookFilter = R.look ? `,${LOOK_FILTER[R.look]}` : "";
  const W = F.w, H = F.h;
  const frames = Math.ceil(L * FPS) + 2;
  const inputs = [], teile = [];
  db.szenen.forEach((s, i) => {
    if (s.art === "clip") {
      inputs.push("-t", L.toFixed(2), "-i", s.datei);
      teile.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1,tpad=stop_mode=clone:stop_duration=${L.toFixed(2)},trim=0:${L.toFixed(3)},setpts=PTS-STARTPTS,eq=contrast=1.06:saturation=1.1,format=yuv420p[v${i}]`);
    } else {
      inputs.push("-i", s.datei);
      const W2 = Math.round(W * 1.5 / 2) * 2, H2 = Math.round(H * 1.5 / 2) * 2;
      const zoomRein = i % 2 === 0;
      const z = zoomRein ? `'min(1+${(ZOOM / frames).toFixed(6)}*on,${(1 + ZOOM).toFixed(3)})'` : `'max(${(1 + ZOOM).toFixed(3)}-${(ZOOM / frames).toFixed(6)}*on,1)'`;
      const dx = [0, 1, -1][i % 3];
      const x = `'iw/2-(iw/zoom/2)+${dx}*on*${(W2 * 0.03 / frames).toFixed(4)}'`;
      const look = s.art === "foto" ? "eq=contrast=1.08:saturation=1.12:brightness=-0.03,vignette=PI/5" : "eq=saturation=1.05";
      teile.push(`[${i}:v]scale=${W2}:${H2}:force_original_aspect_ratio=increase,crop=${W2}:${H2},setsar=1,zoompan=z=${z}:x=${x}:y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},trim=0:${L.toFixed(3)},setpts=PTS-STARTPTS,${look},format=yuv420p[v${i}]`);
    }
  });
  let letzte = "v0";
  for (let i = 1; i < db.szenen.length; i++) {
    const off = (i * (L - U)).toFixed(3);
    teile.push(`[${letzte}][v${i}]xfade=transition=${liste[(i - 1) % liste.length]}:duration=${U.toFixed(3)}:offset=${off}[x${i}]`);
    letzte = `x${i}`;
  }
  const fonts = fs.existsSync(FONTS_MAC) ? `:fontsdir='${ffEsc(FONTS_MAC)}'` : "";
  teile.push(`[${letzte}]${lookFilter.slice(1) ? `${lookFilter.slice(1)},` : ""}subtitles=filename='${ffEsc(ass)}'${fonts},fade=t=in:st=0:d=0.4,fade=t=out:st=${(T - 0.6).toFixed(2)}:d=0.6,format=yuv420p[vout]`);

  // Ton: Musik (unter dem Sprecher leiser), Sprecher, sonst Stille
  let n = db.szenen.length;
  const musikIn = musikDatei ? n++ : -1;
  if (musikDatei) inputs.push(...(/\.wav$/i.test(musikDatei) ? [] : ["-stream_loop", "-1"]), "-i", musikDatei);
  const stimmeIn = stimme ? n++ : -1;
  if (stimme) inputs.push("-i", stimme);
  const fmt = "aresample=48000,aformat=channel_layouts=stereo";
  if (musikIn >= 0 && stimmeIn >= 0) {
    teile.push(`[${stimmeIn}:a]${fmt},adelay=500|500,highpass=f=70,loudnorm=I=-16:TP=-1.5,apad,asplit=2[voc][key]`);
    teile.push(`[${musikIn}:a]${fmt},volume=0.55[mus]`);
    teile.push("[mus][key]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=450[duck]");
    teile.push(`[voc][duck]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,atrim=0:${T},afade=t=out:st=${(T - 1.2).toFixed(2)}:d=1.2,alimiter=limit=0.95,aresample=48000[aout]`);
  } else if (musikIn >= 0) {
    teile.push(`[${musikIn}:a]${fmt},atrim=0:${T},loudnorm=I=-15:TP=-1.5,afade=t=out:st=${(T - 1.5).toFixed(2)}:d=1.5,aresample=48000[aout]`);
  } else if (stimmeIn >= 0) {
    teile.push(`[${stimmeIn}:a]${fmt},adelay=500|500,loudnorm=I=-16:TP=-1.5,apad,atrim=0:${T},aresample=48000[aout]`);
  } else {
    teile.push(`anullsrc=r=48000:cl=stereo,atrim=0:${T}[aout]`);
  }
  const args = ["-hide_banner", "-nostdin", "-y", ...inputs, "-filter_complex", teile.join(";"), "-map", "[vout]", "-map", "[aout]",
    "-t", String(T), "-r", String(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-progress", "pipe:1", "-nostats", out];
  fs.writeFileSync(path.join(j.arbeit, "befehl.txt"), args.join(" "));
  await new Promise((res, rej) => {
    const p = spawn(findeFfmpeg(), args, { stdio: ["ignore", "pipe", "pipe"] });
    let fehler = "", rest = "", zuletzt = 0;
    p.stderr.on("data", (c) => { fehler = (fehler + c.toString()).slice(-3000); });
    p.stdout.on("data", (c) => {
      rest += c.toString();
      let i;
      while ((i = rest.indexOf("\n")) >= 0) {
        const z = rest.slice(0, i); rest = rest.slice(i + 1);
        const m = /^out_time_us=(\d+)/.exec(z);
        if (m) {
          const pct = Math.min(99, (Number(m[1]) / 1e6 / T) * 100);
          if (pct >= zuletzt + 2) { zuletzt = pct; melde(j, "render", "läuft", `Rendere ${FORMATE[j.auftrag.format].name.split(" ")[0]} … ${Math.round(pct)} %`, pct); }
        }
      }
    });
    p.on("error", (e) => rej(new Error(`ffmpeg ließ sich nicht starten (${e.code || e.message})`)));
    p.on("close", (code) => {
      if (code === 0) return res();
      const z = fehler.trim().split("\n").filter((x) => !/^\s*$/.test(x)).slice(-3).join(" | ");
      rej(new Error(`ffmpeg: ${kurz(z, 260)}`));
    });
  });
}

/** Pfad eines Vorschaubilds im Ordner Fertig (nur .jpg direkt im Ordner), sonst null. */
export function posterPfad(name) {
  const n = path.basename(String(name || ""));
  if (!/^[^/\\]+\.jpg$/i.test(n)) return null;
  const f = path.join(VIDEO_DIRS.fertig, n);
  return fs.existsSync(f) ? f : null;
}

// Ordner im Finder zeigen / Video im Finder markieren.
export function zeigeImFinder(name) {
  const f = path.join(VIDEO_DIRS.fertig, path.basename(String(name || "")));
  if (!fs.existsSync(f)) return { ok: false, error: "Video nicht gefunden" };
  execFile("open", ["-R", f], () => {});
  return { ok: true };
}

// ---------- Sprachbefehl (ohne Claude) ----------
const ZAHLWORT = { zehn: 10, fünfzehn: 15, fuenfzehn: 15, zwanzig: 20, dreißig: 30, dreissig: 30, vierzig: 40, fünfzig: 50, fuenfzig: 50, sechzig: 60, neunzig: 90 };

/** "erstell mir ein 20 Sekunden Video über Mallorca mit Musik" → Auftrag, sonst null. */
export function verstehe(text = "") {
  const roh = String(text || "").replace(/[!?.]+$/, "").replace(/^(hey |hallo )?friday[,:]?\s*/i, "").trim();
  const t = roh.toLowerCase();
  if (!/\b(video|clip|reel|tiktok|short)s?\b/.test(t)) return null;
  if (!/\b(erstell|generier|produzier|erzeug|zauber)\w*|\bdreh\w* (mir |uns )?(ein|einen|eine)\b|\b(mach|bau)\w* (mir |uns |mal )*(ein|einen|eine|n|nen)\b/.test(t)) return null;
  if (/\b(schneid|schnitt|eingang)\w*/.test(t) && !/(^|\s)(über|ueber|zum thema|thema)\s/.test(t)) return null;
  let sekunden = 20;
  const zahl = /(\d{1,3})\s*(?:-\s*)?(sek|sec|s\b|minute|min)/.exec(t) || new RegExp(`\\b(${Object.keys(ZAHLWORT).join("|")}|eine?)\\s*(?:-\\s*)?(sekunden|minute)`).exec(t);
  if (/einminüt|einminuet|eine minute/.test(t)) sekunden = 60;
  else if (zahl) {
    const wert = /^\d+$/.test(zahl[1]) ? Number(zahl[1]) : ZAHLWORT[zahl[1]] || 1;
    sekunden = /^min/.test(zahl[2]) ? wert * 60 : wert;
  }
  const format = /querformat|youtube|16[: ]9|breit|quer\b/.test(t) ? "quer" : /quadrat|1[: ]1|instagram post/.test(t) ? "quadrat" : "hoch";
  let musik = "auto";
  if (/ohne (musik|ton|sound)/.test(t)) musik = "aus";
  else if (/(meine|eigene)[nr]? musik/.test(t)) musik = "eigene";
  else musik = stimmungAus(t.match(/(?:mit |und )?([\wäöüß-]+ )?(musik|sound|beat|song)/)?.[0] || t.match(/(episch|chill|ruhig|energ\w*|fröhlich|froehlich|spannend|neon|synthwave|lofi|lo-fi)/)?.[0] || "") || "auto";
  const bilder = /(meine[nr]?|eigene[nr]?) (clips|videos|fotos|bilder|aufnahmen)|aus dem eingang/.test(t) ? "eigene" : /nur (grafik|neon)|ohne (fotos|bilder)/.test(t) ? "grafik" : "auto";
  const sprecher = /(mit|und) (sprecher|stimme|erzähler|erzaehler|voice)|sprich|vorgelesen|kommentar/.test(t);
  const tm = /(?:über|ueber|zum thema|thema|von|zu|für|fuer)\s+(?:das |die |den |dem |der |ein |eine |einen |mein |meine )?(.+)$/.exec(t);
  // Thema in der Original-Schreibweise behalten ("Bitcoin", nicht "bitcoin")
  let thema = (tm ? (roh.length === t.length ? roh.slice(tm.index + tm[0].length - tm[1].length) : tm[1]) : "")
    .replace(/\s(mit|ohne|und|im|in|als)\s+((eigene[nr]?|meine[nr]?)\s+)?([\wäöüß-]+\s+)?(musik|sound|beat|sprecher|stimme|hochformat|querformat|quadrat|format|bildern|fotos|clips|grafik|neon)\b.*$/i, "")
    .replace(/\s+(nur|ohne) (grafik|neon|fotos|bilder|musik)\b.*$/i, "")
    .replace(/\b(bitte|mal|danke)\b/gi, "").replace(/\s+/g, " ").trim();
  if (!thema || /^\d/.test(thema)) thema = "";
  else thema = thema.charAt(0).toUpperCase() + thema.slice(1);
  // Der ganze Satz geht als Regie-Anweisung mit (Tempo, Look, Szenen …), das Thema bleibt kurz.
  return { thema, anweisung: roh, sekunden: klemm(sekunden, 5, 90), format, musik, bilder, sprecher };
}

export function quickCommand(text) {
  const t = String(text || "").toLowerCase().trim();
  if (/^(friday,? )?(öffne|oeffne|zeig|zeige)( mir)? (das |dein |mein )?(schnitt-?team|schnitt-?studio|video-?studio|studio|meine videos|fertigen videos)\b/.test(t)) {
    return { answer: "Hier ist dein Schnitt-Studio, Chef.", actions: [/videos/.test(t) ? "studio:videos" : "studio"] };
  }
  const a = verstehe(text);
  if (!a) return null;
  if (!a.thema && !leseAnweisung(a.anweisung).kern) return { answer: "Gern, Chef. Worüber soll das Video sein? Schreib das Thema oben ins Studio, oder sag zum Beispiel: Erstell mir ein 20-Sekunden-Video über Mallorca.", actions: ["studio"] };
  const r = starteStudio(a, { quelle: "sprache" });
  if (!r.ok) return { answer: r.laeuftSchon ? `Moment, Chef. ${r.error} Ich sag Bescheid, wenn es fertig ist.` : r.error, actions: ["studio"] };
  const m = r.auftrag.musik === "aus" ? "ohne Musik" : r.auftrag.musik === "eigene" ? "mit deiner Musik" : r.auftrag.musik === "auto" ? "mit eigener Musik" : `mit ${STIMMUNGEN[r.auftrag.musik].name}-Musik`;
  return { answer: `Läuft, Chef. Ich mache ein ${r.auftrag.sekunden}-Sekunden-Video über ${r.auftrag.thema}, ${FORMATE[r.auftrag.format].name.split(" (")[0]}, ${m}${r.auftrag.sprecher ? " und mit Sprecher" : ""}. Das Team ist dran.`, actions: [`studio_job:${r.id}`] };
}
