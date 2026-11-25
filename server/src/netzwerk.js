// FRIDAY Command Network (digitales Modell deiner Geräte), digitale Zeitachse und persönlicher Wissensgraph.
// Alles wird aus Daten gebaut, die Friday ohnehin hat – nichts davon braucht Claude.
import os from "node:os";
import * as store from "./store.js";
import { isAgentOnline, getAgentInfo } from "./agent-hub.js";
import { alleStatus } from "./dienste.js";
import { status as tvStatus } from "./fernseher.js";
import { status as alexaStatus } from "./alexa.js";
import { tage as logbuchTage, suche as logbuchSuche } from "./logbuch.js";
import { notfallAktiv, stand as kommandoStand } from "./kommando.js";
import { localVersion } from "./updater.js";
import { alleDokumente } from "./dokumente.js";
import { installierte } from "./modulsystem.js";
import { kontakte } from "./anrufe.js";

const mitZeit = (p, ms = 3000) => Promise.race([p, new Promise((res) => setTimeout(() => res(null), ms))]).catch(() => null);

/** Command Network: alle verbundenen Geräte und Dienste als Knoten rund um Friday. */
export async function geraete() {
  const [dienste, tv, alexa] = await Promise.all([mitZeit(alleStatus(), 4000), mitZeit(tvStatus(), 2500), mitZeit(alexaStatus(), 2000)]);
  const knoten = [];
  const last = os.loadavg()[0];
  knoten.push({ id: "server", name: "Friday-Server", emoji: "🧠", art: "kern", zustand: notfallAktiv() ? "notfall" : "online", text: `Version ${localVersion()} · ${os.hostname()} · Last ${last.toFixed(2)} · ${Math.round((os.totalmem() - os.freemem()) / 1e9 * 10) / 10}/${Math.round(os.totalmem() / 1e9)} GB` });
  const mac = getAgentInfo();
  knoten.push({ id: "mac", name: "Mac-Agent", emoji: "💻", art: "geraet", zustand: isAgentOnline() ? "online" : "offline", text: isAgentOnline() ? `Verbunden${mac?.hostname ? ` · ${mac.hostname}` : ""}` : "Nicht verbunden – Mac-Aktionen gehen gerade nicht" });
  knoten.push({ id: "tv", name: "Fernseher", emoji: "📺", art: "geraet", zustand: !tv?.eingerichtet ? "einrichten" : tv.erreichbar ? "online" : "offline", text: !tv?.eingerichtet ? "Noch nicht gekoppelt (Werkzeuge → Fernbedienung)" : `${tv.name || "Samsung-TV"} · ${tv.erreichbar ? tv.zustand || "an" : "aus / nicht erreichbar"}` });
  knoten.push({ id: "alexa", name: "Alexa", emoji: "🔵", art: "dienst", zustand: alexa?.eingerichtet ? "online" : "einrichten", text: alexa?.eingerichtet ? `${alexa.routinen?.length || 0} Routinen · ${alexa.lautsprecher?.length || 0} Lautsprecher` : "Voice-Monkey-Schlüssel fehlt" });
  for (const d of dienste?.dienste || []) knoten.push({ id: d.id, name: d.name, emoji: d.emoji || "🔗", art: "dienst", zustand: d.eingerichtet ? "online" : "einrichten", text: String(d.text || "").slice(0, 140) });
  const offen = kommandoStand().offen.length;
  return {
    knoten,
    online: knoten.filter((k) => k.zustand === "online").length,
    gesamt: knoten.length,
    notfall: notfallAktiv(),
    freigaben_offen: offen,
    zeit: new Date().toISOString(),
  };
}

/** Digitale Zeitachse: Missionen, Ziele, Entscheidungen, Updates, Module, Dokumente und Logbuch-Tage. */
export function zeitachse({ tage = 90 } = {}) {
  const seit = Date.now() - tage * 86400000;
  const ev = [];
  const add = (at, art, titel, details = "", ref = "") => { if (at && new Date(at).getTime() >= seit) ev.push({ at, art, titel: String(titel).slice(0, 160), details: String(details).slice(0, 300), ref }); };
  for (const m of store.load("missionen", [])) {
    add(m.erstellt, "mission", `Mission gestartet: ${m.titel}`, `${m.schritte.length} Schritte`, m.id);
    if (m.fertig) add(m.fertig, "mission", `Mission fertig: ${m.titel}`, "", m.id);
    for (const e of m.entscheidungen || []) add(e.at, "entscheidung", `Entscheidung in „${m.titel}“`, e.text, m.id);
  }
  for (const z of store.load("ziele", [])) {
    add(z.erstellt, "ziel", `Ziel gesetzt: ${z.titel}`, z.frist ? `Frist: ${z.frist}` : "", z.id);
    for (const s of z.schritte) if (s.erledigt && s.am) add(s.am, "ziel", `Ziel-Schritt geschafft: ${s.text}`, z.titel, z.id);
  }
  for (const e of store.load("entscheidungen", [])) add(e.datum, "entscheidung", `Entschieden: ${e.entscheidung}`, e.frage, e.id);
  for (const d of alleDokumente()) add(d.erstellt, "dokument", `${d.art === "fragebogen" ? "Fragebogen" : "Dokument"}: ${d.titel}`, "", d.id);
  try {
    for (const e of logbuchSuche({ bereich: "update", limit: 200 })) add(e.at, "update", e.titel, e.details || "");
    for (const e of logbuchSuche({ bereich: "system", q: "Modul", limit: 100 })) add(e.at, "modul", e.titel, e.details || "");
  } catch { /* Logbuch noch leer */ }
  ev.sort((a, b) => b.at.localeCompare(a.at));
  let aktivitaet = [];
  try { aktivitaet = logbuchTage({ anzahl: Math.min(tage, 120) }); } catch { aktivitaet = []; }
  return { ereignisse: ev.slice(0, 400), aktivitaet, tage };
}

// ---- Wissensgraph ----
const STOPP = new Set("aber alle alles also auch auf aus bei bin bis bitte dann das dass dem den der des die dies diese dir doch dort durch ein eine einem einen einer eines für hab habe hat hier ich ihr im in ist ja jetzt kann kein mal man mehr mein meine mich mir mit nach nicht noch nur oder ohne sehr sein sich sie sind so soll über um und uns unter vom von vor war was weil welche wenn wer wie wieder wir wird zu zum zur friday boss schritt mission ziel heute morgen".split(" "));
function woerter(text) {
  return new Set(String(text || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 4 && !STOPP.has(w)));
}

/** Verknüpft Projekte (Missionen), Ziele, Entscheidungen, Dokumente, Gedächtnis, Personen und Module über gemeinsame Begriffe. */
export function wissensgraph() {
  const knoten = [];
  const add = (id, art, name, text) => knoten.push({ id, art, name: String(name).slice(0, 60), w: woerter(`${name} ${text || ""}`) });
  for (const m of store.load("missionen", []).slice(-40)) add(`m-${m.id}`, "mission", m.titel, `${m.ziel} ${m.schritte.map((s) => s.text).join(" ")}`);
  for (const z of store.load("ziele", []).slice(-30)) add(`z-${z.id}`, "ziel", z.titel, `${z.warum || ""} ${z.schritte.map((s) => s.text).join(" ")}`);
  for (const e of store.load("entscheidungen", []).slice(-40)) add(`e-${e.id}`, "entscheidung", e.entscheidung, `${e.frage} ${e.gruende}`);
  for (const d of alleDokumente().slice(-40)) add(`d-${d.id}`, "dokument", d.titel, String(d.inhalt || (d.fragen || []).map((f) => f.frage).join(" ")).slice(0, 3000));
  for (const [i, g] of store.getMemories().slice(-60).entries()) add(`g-${i}`, "wissen", g.text, "");
  // v1.179.0: Projektgedächtnis gehört auch in den Graphen (das große Wissensnetz liegt im Gehirn-Cockpit).
  for (const p of store.load("projekte", []).slice(-30)) add(`pr-${p.id}`, "mission", `📁 ${p.name}`, (p.notizen || []).map((n) => n.text).join(" "));
  try {
    for (const k of kontakte().slice(0, 30)) if (k?.name) add(`p-${k.name}`, "person", k.name, k.rolle === "frau" ? "Frau Ehefrau Familie" : k.rolle || "");
  } catch { /* keine Kontakte */ }
  for (const m of installierte().filter((x) => x.an)) add(`mod-${m.id}`, "modul", m.name, m.beschreibung);
  const p = store.load("wissensprofil", {});
  for (const i of [...(p.interessen || []), ...(p.lernziele || [])].slice(0, 30)) add(`i-${i}`, "interesse", i, "");
  // Kanten: gemeinsame Begriffe (Gewicht = Anzahl)
  const kanten = [];
  const haeufigkeit = new Map();
  for (const k of knoten) for (const w of k.w) haeufigkeit.set(w, (haeufigkeit.get(w) || 0) + 1);
  for (let a = 0; a < knoten.length; a++) {
    for (let b = a + 1; b < knoten.length; b++) {
      const gemeinsam = [...knoten[a].w].filter((w) => knoten[b].w.has(w) && (haeufigkeit.get(w) || 0) <= Math.max(3, knoten.length / 4));
      if (gemeinsam.length) kanten.push({ von: knoten[a].id, nach: knoten[b].id, gewicht: gemeinsam.length, begriffe: gemeinsam.slice(0, 4) });
    }
  }
  kanten.sort((x, y) => y.gewicht - x.gewicht);
  const top = [...haeufigkeit.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([w, n]) => ({ begriff: w, anzahl: n }));
  return { knoten: knoten.map(({ w, ...k }) => k), kanten: kanten.slice(0, 300), themen: top };
}
