// Fridays Gehirn (KI-Kern): echte Zahlen für die Gehirn-Ansicht im Dashboard.
// Nichts davon ist erfunden: alles kommt aus Logbuch, Gedächtnis, Archiv, Energie, Auftrag und den Live-Werten des Macs.
// Kostet kein Claude-Guthaben und braucht kein Internet.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { getEnergie } from "./energie.js";
import { getSettings } from "./einstellungen.js";
import { auftragStand } from "./auftrag.js";
import { systemLive } from "./systemlive.js";
import { config } from "./config.js";

// Gehirn-Bereiche: welche Logbuch-Bereiche zu welchem "Zentrum" gehören.
export const ZENTREN = [
  { id: "sprache", name: "Sprachzentrum", farbe: "#4cc3ff", text: "Zuhören, Sprechen, Nachrichten", bereiche: ["befehl", "anruf", "mitteilung", "mail", "briefing", "alexa"] },
  { id: "logik", name: "Logik & Analyse", farbe: "#ff8a1e", text: "Suchen, Rechnen, Welt, Markt, Routen", bereiche: ["suche", "welt", "markt", "route", "kauf", "gegenrede", "kalender", "system"] },
  { id: "kreativ", name: "Emotionen & Kreativität", farbe: "#b06bff", text: "Ideen, Spiele, Werkstatt, Musik", bereiche: ["idee", "spiel", "webseite", "werkstatt", "haus", "klang", "video", "dokument", "musik"] },
  { id: "erinnerung", name: "Erinnerungen", farbe: "#46e08a", text: "Gedächtnis, Aufgaben, Listen, Archiv", bereiche: ["gedaechtnis", "erinnerung", "aufgabe", "einkauf", "archiv", "kuehlschrank", "lernen"] },
  { id: "motorik", name: "Handeln", farbe: "#ffd24d", text: "Mac, Fernseher, Licht, Smart Home", bereiche: ["mac", "tv", "smarthome", "verbindung", "update", "sicherung", "energie"] },
];
const ZENTRUM_VON = Object.fromEntries(ZENTREN.flatMap((z) => z.bereiche.map((b) => [b, z.id])));

const TEMPO_NAME = { blitz: "Blitz (Haiku)", schnell: "Schnell (Sonnet)", gruendlich: "Gründlich (Opus)", auto: "Automatisch" };

// Archiv lesen ist teuer (alle Gespräche) → höchstens jede Minute zählen.
let archivCache = { t: 0, n: 0 };
function archivAnzahl() {
  if (Date.now() - archivCache.t > 60000) {
    let n = 0;
    try { n = store.leseArchiv().length; } catch { n = 0; }
    archivCache = { t: Date.now(), n };
  }
  return archivCache.n;
}

function stundeVon(at) {
  try {
    const teil = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: config.timezone }).formatToParts(new Date(at)).find((p) => p.type === "hour");
    return Number(teil?.value);
  } catch {
    return new Date(at).getHours();
  }
}

function tagMinus(tage) {
  return logbuch.tagVon(new Date(Date.now() - tage * 864e5));
}

/** Alle Werte für die Gehirn-Ansicht. */
export function gehirnStand({ agentOnline = false, version = "" } = {}) {
  const heute = logbuch.tag({ limit: 5000 });
  const eintraege = heute.eintraege; // neueste zuerst
  const jetzt = Date.now();

  // Aktivität pro Stunde (heute, in Kevins Zeitzone)
  const stunden = new Array(24).fill(0);
  for (const e of eintraege) {
    const h = stundeVon(e.at);
    if (Number.isFinite(h) && h >= 0 && h < 24) stunden[h] += 1;
  }
  const letzteStunde = eintraege.filter((e) => jetzt - Date.parse(e.at) < 3600e3).length;

  // Letzte 7 Tage (für Lernkurve und Zentren)
  const sieben = new Set(Array.from({ length: 7 }, (_, i) => tagMinus(i)));
  const tageListe = logbuch.tage({ anzahl: 400 });
  const woche = Array.from({ length: 7 }, (_, i) => {
    const t = tagMinus(6 - i);
    return { tag: t, anzahl: tageListe.find((x) => x.tag === t)?.anzahl || 0 };
  });

  // Zentren: heute + 7 Tage
  const zaehl = Object.fromEntries(ZENTREN.map((z) => [z.id, { heute: 0, woche: 0 }]));
  for (const e of eintraege) { const z = ZENTRUM_VON[e.bereich]; if (z) zaehl[z].heute += 1; }
  // Neueste zuerst: aufhören, sobald die Woche vorbei ist.
  const aeltester = tagMinus(6);
  for (const e of logbuch.suche({ q: "", limit: 20000 })) {
    if (e.tag < aeltester) break;
    if (!sieben.has(e.tag)) continue;
    const z = ZENTRUM_VON[e.bereich]; if (z) zaehl[z].woche += 1;
  }
  const maxWoche = Math.max(1, ...Object.values(zaehl).map((z) => z.woche));
  const zentren = ZENTREN.map((z) => ({
    id: z.id, name: z.name, farbe: z.farbe, text: z.text,
    heute: zaehl[z.id].heute, woche: zaehl[z.id].woche,
    anteil: Math.round((zaehl[z.id].woche / maxWoche) * 100),
  }));

  // Wissen & Lernen
  const erinnerungen = store.getMemories();
  const neuWoche = erinnerungen.filter((m) => m.created && jetzt - Date.parse(m.created) < 7 * 864e5).length;
  const letzteErinnerung = erinnerungen.length ? erinnerungen[erinnerungen.length - 1] : null;
  const gespraeche = archivAnzahl();
  const logGesamt = tageListe.reduce((s, t) => s + t.anzahl, 0);

  // Befehle heute: Antwortzeit und Erfolg
  const befehle = eintraege.filter((e) => e.bereich === "befehl");
  const zeiten = befehle.map((e) => e.dauer_ms).filter((v) => Number.isFinite(v) && v > 0);
  const antwortMs = zeiten.length ? Math.round(zeiten.reduce((a, b) => a + b, 0) / zeiten.length) : null;
  const erfolg = heute.gesamt ? Math.round(((heute.gesamt - heute.fehler) / heute.gesamt) * 100) : null;

  // Energie & Denk-Tempo
  const energie = getEnergie();
  const tempo = getSettings().tempo;

  // Was Friday gerade tut (Analyse → Verarbeitung → Entscheidung → Aktion)
  const auftraege = ["web", "telegram", "shortcut", "siri"].map((k) => auftragStand(k)).filter(Boolean);
  const auftrag = auftraege.sort((a, b) => b.aktualisiert - a.aktualisiert)[0] || null;
  const PHASE = { verstehen: 0, arbeiten: 1, erstellen: 2, fertig: 3, fehler: 3 };
  const aktiv = auftrag && !["fertig", "fehler"].includes(auftrag.schritt) && jetzt - auftrag.aktualisiert < 120e3;

  let live = null;
  try { live = systemLive(); } catch { live = null; }

  return {
    zeit: new Date().toISOString(),
    version,
    denkt: Boolean(aktiv),
    phase: auftrag ? { stufe: PHASE[auftrag.schritt] ?? 0, schritt: auftrag.schritt, text: auftrag.text, prozent: auftrag.prozent, vor_s: Math.round((jetzt - auftrag.aktualisiert) / 1000) } : null,
    aktivitaet: { letzteStunde, heute: heute.gesamt, maxStunde: Math.max(...stunden), stunden },
    befehle: { heute: befehle.length, claude: heute.claude, offline: Math.max(0, befehle.length - heute.claude), fehler: heute.fehler, erfolg, antwortMs },
    wissen: { erinnerungen: erinnerungen.length, gespraeche, logbuch: logGesamt, synapsen: erinnerungen.length + gespraeche + logGesamt },
    lernen: { neuWoche, letzte: letzteErinnerung ? { text: letzteErinnerung.text.slice(0, 120), at: letzteErinnerung.created || null } : null, woche },
    verbindung: { claude: energie.zustand !== "tot", mac: Boolean(agentOnline) },
    energie: { prozent: energie.prozent, zustand: energie.zustand, rest: energie.rest },
    tempo: { id: tempo, name: TEMPO_NAME[tempo] || tempo },
    zentren,
    strom: eintraege.slice(0, 8).map((e) => ({ at: e.at, titel: e.titel, bereich: e.bereich, symbol: logbuch.BEREICHE[e.bereich]?.[0] || "•", ok: e.ok !== false, claude: Boolean(e.claude) })),
    system: live ? { cpu: live.cpu.prozent, ram: live.ram.prozent, verlauf: live.verlauf.slice(-30) } : null,
  };
}

// "Zeig mir dein Gehirn" usw. – ohne Claude.
export function quickCommand(text, opts = {}) {
  const t = String(text || "").toLowerCase().replace(/[„“”"'!?.,:;-]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^(?:hey |hallo |hi |ok |okay )?(?:friday|freitag|fraiday)(?: |$)/, "").trim()
    .replace(/^(?:bitte |kannst du (?:mir )?(?:bitte )?|könntest du (?:mir )?(?:bitte )?)/, "").trim();
  const ziel = "(?:gehirn|hirn|ki ?kern|ai ?core|kern|gehirn ansicht|gehirn bereich|neuronales netz(?:werk)?)";
  const treffer =
    new RegExp(`^(?:öffne|oeffne|zeig|zeige|mach)(?: mir)?(?: mal)? (?:das |dein |mein |fridays |den |deinen )?${ziel}(?: auf| bitte)?$`).test(t) ||
    new RegExp(`^(?:mir )?(?:das |dein |fridays |den |deinen )?${ziel}(?: zeigen| öffnen| oeffnen| auf ?machen)$`).test(t) ||
    /^(?:gehirn|ki kern|ai core)$/.test(t) ||
    /^wie (?:geht es|gehts|geht's) deinem (?:gehirn|kopf)$/.test(t) ||
    /^was (?:denkst|machst) du gerade$/.test(t);
  if (!treffer) return null;
  let s;
  try { s = gehirnStand(opts); } catch { return { answer: "Hier ist mein Gehirn, Boss.", actions: ["gehirn"] }; }
  const teile = [];
  if (s.befehle.heute) teile.push(`Heute habe ich ${s.befehle.heute === 1 ? "einen Auftrag" : `${s.befehle.heute} Aufträge`} bearbeitet, ${s.befehle.claude} davon mit Claude`);
  else teile.push("Heute war es noch ruhig");
  teile.push(`ich kenne ${s.wissen.erinnerungen} Dinge über dich`);
  if (s.lernen.neuWoche) teile.push(`${s.lernen.neuWoche} davon habe ich diese Woche gelernt`);
  const staerkstes = [...s.zentren].sort((a, b) => b.woche - a.woche)[0];
  const satz2 = staerkstes?.woche ? ` Am meisten arbeitet gerade mein Bereich ${staerkstes.name}.` : "";
  return { answer: `Hier ist mein Gehirn, Boss. ${teile.join(", ")}.${satz2}`, actions: ["gehirn"] };
}
