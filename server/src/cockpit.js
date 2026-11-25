// Gehirn-Cockpit (v1.178.0, Mark XII Punkte 31–38): die zentrale Steuerung des ganzen KI-Systems.
// Keine eigenen Daten-Inseln: das Cockpit liest nur, was die Module ohnehin führen
// (Schwarm, Energie, Kosten-Deckel, Agenten, Missionen, Gedächtnis, Logbuch, Freigaben, System, Funktionstest)
// und bündelt es an einem Ort. Live-Neuigkeiten kommen über den Ereignis-Bus.
import os from "node:os";
import fs from "node:fs";
import { execFile } from "node:child_process";
import * as store from "./store.js";
import { config } from "./config.js";
import * as SW from "./ki-schwarm.js";
import { GEHIRNE, GEHIRN_NAMEN, gehirnGrund, bereiteGehirne, fragen } from "./ki-client.js";
import * as OR from "./openrouter.js";
import * as OL from "./ollama.js";
import { getEnergie } from "./energie.js";
import { stand as deckelStand } from "./kostendeckel.js";
import { systemLive } from "./systemlive.js";
import * as logbuch from "./logbuch.js";
import * as kommando from "./kommando.js";
import { glockeStand, entscheiden as glockeEntscheiden } from "./freigaben.js";
import * as funktionstest from "./funktionstest.js";
import * as bus from "./ereignisbus.js";
import { isAgentOnline } from "./agent-hub.js";

// ---------- KI-Modelle (32) ----------
export function kiStand() {
  const s = SW.uebersicht();
  const fremd = (id, extra) => ({ id, name: GEHIRN_NAMEN[id], grund: gehirnGrund(id), bereit: !gehirnGrund(id), ...SW.fremdStand(id), ...extra });
  const ol = OL.einstellungen();
  const gehirne = [
    fremd("claude", { emoji: "🟠", modell: config.model, art: "Hauptgehirn", kosten: "nach Verbrauch (Claude-Guthaben)", eingerichtet: Boolean(config.anthropicKey) }),
    ...s.dienste.map((d) => ({ ...d, art: d.ersatz ? `Ersatz Nr. ${s.kette.indexOf(d.id) + 1 || "–"}` : "nur auf Wunsch", kosten: `${d.preis[0]} / ${d.preis[1]} $ je 1 Mio. Tokens (geschätzt)` })),
    fremd("openrouter", { emoji: "🧠", modell: OR.modellFuer(""), art: "Ersatz (danach)", kosten: "nach Verbrauch (OpenRouter-Guthaben)", eingerichtet: OR.eingerichtet() }),
    fremd("ollama", { emoji: "🦙", modell: ol.modell, art: ol.modus === "aus" ? "aus" : `Modus: ${ol.modus}`, kosten: ol.art === "lokal" ? "kostenlos (läuft auf dem Mac)" : "Ollama-Cloud-Abo", eingerichtet: ol.modus !== "aus" }),
  ];
  const e = getEnergie();
  const d = deckelStand();
  return {
    gehirne, live: SW.liveListe(), kette: ["claude", ...s.kette, ...(OR.ersatzBereit() ? ["openrouter"] : []), ...(OL.bereit() ? ["ollama"] : [])],
    reihenfolge: s.reihenfolge,
    kosten: {
      claude: { zustand: e.zustand, rest: e.rest, verbrauch: e.verbrauch },
      deckel: { stufe: d.stufe, heute: d.heute, grenze_tag: d.grenze.tag, grenze_stunde: d.grenze.stunde, grund: d.grund },
      schwarm_tage: s.tage,
      regel: "Lokale KI (Ollama) zuerst, wenn eingerichtet. Bezahlte Dienste nur mit eigenem Schlüssel und Tageslimit. Ist der Kosten-Deckel erreicht, denkt nur noch Ollama (oder Friday arbeitet offline).",
    },
    labor: SW.laborVerlauf().slice(0, 5),
  };
}

// ---------- Netzwerk (37) ----------
let netzVorher = null;
function netzBytes() {
  return new Promise((res) => {
    if (process.platform === "linux") {
      try {
        let rx = 0, tx = 0;
        for (const z of fs.readFileSync("/proc/net/dev", "utf8").split("\n").slice(2)) {
          const [name, rest] = z.split(":");
          if (!rest || /^\s*lo$/.test(name)) continue;
          const f = rest.trim().split(/\s+/).map(Number);
          rx += f[0] || 0; tx += f[8] || 0;
        }
        return res({ rx, tx });
      } catch { return res(null); }
    }
    if (process.platform === "darwin") {
      execFile("netstat", ["-ib"], { timeout: 3000 }, (err, out) => {
        if (err) return res(null);
        let rx = 0, tx = 0;
        const gesehen = new Set();
        for (const z of String(out).split("\n").slice(1)) {
          const f = z.trim().split(/\s+/);
          if (f.length < 10 || f[0].startsWith("lo") || gesehen.has(f[0]) || !/^<Link/.test(f[2] || "")) continue;
          gesehen.add(f[0]);
          rx += Number(f[6]) || 0; tx += Number(f[9]) || 0;
        }
        res({ rx, tx });
      });
      return;
    }
    res(null);
  });
}
export async function netzStand() {
  const jetzt = await netzBytes();
  let rate = null;
  if (jetzt && netzVorher) {
    const s = (Date.now() - netzVorher.t) / 1000;
    if (s > 0.5) rate = { runter_kbs: Math.max(0, Math.round((jetzt.rx - netzVorher.rx) / 1024 / s)), hoch_kbs: Math.max(0, Math.round((jetzt.tx - netzVorher.tx) / 1024 / s)) };
  }
  if (jetzt) netzVorher = { ...jetzt, t: Date.now() };
  const adressen = [];
  for (const [name, liste] of Object.entries(os.networkInterfaces())) {
    for (const a of liste || []) {
      if (a.internal || a.family !== "IPv4") continue;
      adressen.push({ name, ip: a.address, tailscale: /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(a.address) });
    }
  }
  return { rate, gesamt_mb: jetzt ? { runter: Math.round(jetzt.rx / 1e6), hoch: Math.round(jetzt.tx / 1e6) } : null, adressen, tailscale: adressen.some((a) => a.tailscale), macAgent: isAgentOnline() };
}

// ---------- Fehler & Warnungen (36) ----------
const QUITTIERT = "cockpit-quittiert";
export function warnungen() {
  const quittiert = new Set(store.load(QUITTIERT, []));
  const liste = [];
  const dazu = (w) => { if (!quittiert.has(w.id)) liste.push(w); };
  // 1. Logbuch-Fehler der letzten zwei Tage (gleiche Titel zusammengefasst)
  const heute = logbuch.tagVon();
  const gestern = logbuch.tagVon(new Date(Date.now() - 86400000));
  const gruppen = new Map();
  for (const t of [gestern, heute]) {
    for (const e of logbuch.tag({ tag: t, fehler: true, limit: 400 }).eintraege || []) {
      const k = e.titel.replace(/\d+/g, "#").slice(0, 90);
      const g = gruppen.get(k) || { anzahl: 0, e };
      g.anzahl++;
      if (e.at > g.e.at) g.e = e;
      gruppen.set(k, g);
    }
  }
  for (const [k, g] of gruppen) dazu({ id: `lb:${k}`, stufe: g.anzahl >= 3 ? "fehler" : "warnung", quelle: logbuch.BEREICHE[g.e.bereich]?.[1] || g.e.bereich, titel: g.e.titel, text: g.e.details || "", anzahl: g.anzahl, zeit: g.e.at });
  // 2. Funktionsprüfung
  const ft = funktionstest.stand();
  for (const [id, e] of Object.entries(ft.je || {})) if (e.status === "fehler") dazu({ id: `ft:${id}:${e.zeit}`, stufe: "fehler", quelle: "Funktionsprüfung", titel: `${e.name} geht nicht`, text: e.text, zeit: e.zeit });
  if (!ft.letzte) dazu({ id: "ft:nie", stufe: "hinweis", quelle: "Funktionsprüfung", titel: "Noch keine Funktionsprüfung gelaufen", text: "Im Cockpit unter Tests auf „Jetzt prüfen“ tippen – oder nachts um 03:45 automatisch.", zeit: null });
  // 3. KI-Dienste in Pause
  for (const d of SW.uebersicht().dienste) if (d.pause) dazu({ id: `ki:${d.id}:${d.pause.bis}`, stufe: "warnung", quelle: "KI-Schwarm", titel: `${d.name} macht Pause`, text: `${d.pause.grund} – bis ${new Date(d.pause.bis).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}. Friday nimmt solange den nächsten Dienst.`, zeit: null });
  // 4. Kosten, Energie, Notfall
  const dk = deckelStand();
  if (dk.stufe !== "normal") dazu({ id: `kd:${dk.stufe}:${heute}`, stufe: dk.stufe === "gesperrt" ? "fehler" : "warnung", quelle: "Kosten-Deckel", titel: dk.stufe === "gesperrt" ? "Kosten-Deckel erreicht" : "Kosten-Deckel fast erreicht", text: dk.grund, zeit: null });
  const en = getEnergie();
  if (en.zustand === "tot") dazu({ id: `en:tot:${heute}`, stufe: "fehler", quelle: "Energie", titel: "Claude-Guthaben leer", text: "Aufladen auf console.anthropic.com, danach Betrag im ⚡ Energie-Fenster eintragen. Ersatz-Gehirne springen ein, falls eingerichtet.", zeit: null });
  if (kommando.notfallAktiv()) dazu({ id: "notfall", stufe: "fehler", quelle: "Modul-Zentrale", titel: "Notfall-Stopp ist AN", text: "Friday führt keine Aktionen aus. Aufheben: „Friday, Notfall aus“.", zeit: null });
  const offen = glockeStand().offen.length;
  if (offen) dazu({ id: `fg:${offen}`, stufe: "hinweis", quelle: "Freigaben", titel: `${offen} Aktion${offen === 1 ? " wartet" : "en warten"} auf deine Freigabe`, text: "Unter Freigaben ansehen.", zeit: null });
  // 5. System
  const sl = systemLive();
  if (sl.platte?.prozent >= 90) dazu({ id: `sys:platte:${heute}`, stufe: "warnung", quelle: "System", titel: `Festplatte zu ${sl.platte.prozent} % voll`, text: `${sl.platte.freiGB ?? "?"} GB frei.`, zeit: null });
  if (sl.ram?.prozent >= 92) dazu({ id: `sys:ram:${heute}`, stufe: "hinweis", quelle: "System", titel: `Arbeitsspeicher zu ${sl.ram.prozent} % belegt`, text: "", zeit: null });
  const rang = { fehler: 0, warnung: 1, hinweis: 2 };
  liste.sort((a, b) => rang[a.stufe] - rang[b.stufe] || String(b.zeit || "").localeCompare(String(a.zeit || "")));
  return { warnungen: liste, zaehl: { fehler: liste.filter((w) => w.stufe === "fehler").length, warnung: liste.filter((w) => w.stufe === "warnung").length, hinweis: liste.filter((w) => w.stufe === "hinweis").length }, quittiert: quittiert.size };
}
export function quittieren(id) {
  const l = store.load(QUITTIERT, []);
  if (id === "*") { for (const w of warnungen().warnungen) l.push(w.id); } else if (id) l.push(String(id).slice(0, 200));
  store.save(QUITTIERT, [...new Set(l)].slice(-500));
  return warnungen();
}

// ---------- Freigabe-Zentrale (29, 38) ----------
export function freigabenStand() {
  const g = glockeStand();
  const k = kommando.stand();
  return { ...g, stufen: k.stufen, rechte: k.rechte, daten: k.daten, nutzer: k.nutzer, notfall_seit: k.notfall?.seit || null };
}

// ---------- Übersicht (31) ----------
export async function uebersicht() {
  const ki = kiStand();
  const w = warnungen();
  const ft = funktionstest.stand();
  let agenten = null, missionen = null, gedaechtnis = null;
  try { const a = (await import("./agents.js")).agentsWithStatus(); agenten = { gesamt: a.gesamt, aktiv: a.aktiv, arbeiten: a.arbeiten, chefin: a.chefin?.jetzt }; } catch { /* optional */ }
  try { const m = (await import("./missionen.js")).liste(); missionen = { laufend: m.missionen.filter((x) => x.status === "laeuft").length, wartend: m.missionen.filter((x) => x.status === "wartet").length, fertig: m.missionen.filter((x) => x.status === "fertig").length, gesamt: m.missionen.length }; } catch { /* optional */ }
  try { const g = (await import("./gedaechtnis.js")).uebersicht(); gedaechtnis = { fakten: g.fakten.length, ablaeufe: g.ablaeufe.length, neueste: g.fakten.slice(0, 5).map((f) => ({ text: f.text, zeit: f.created || f.zeit || null, schublade: f.schublade })) }; } catch { /* optional */ }
  return {
    version: (await import("./updater.js")).runningVersion(),
    ki: { bereit: bereiteGehirne(), live: ki.live, kette: ki.kette, kosten: ki.kosten },
    warnungen: w.zaehl, top_warnungen: w.warnungen.slice(0, 4),
    tests: ft.letzte ? { zeit: ft.letzte.zeit, bestanden: ft.letzte.bestanden, fehler: ft.letzte.fehler, uebersprungen: ft.letzte.uebersprungen, quote: ft.letzte.quote } : null,
    freigaben: { offen: glockeStand().offen.length, autonomie: kommando.stand().stufe?.name, notfall: kommando.notfallAktiv() },
    agenten, missionen, gedaechtnis,
    system: systemLive(),
    bus: bus.stand(),
  };
}

// ---------- Routen ----------
export function cockpitRouten(app, asyncRoute) {
  app.get("/api/cockpit", asyncRoute(async (req, res) => res.json(await uebersicht())));
  app.get("/api/cockpit/ki", (req, res) => res.json(kiStand()));
  app.post("/api/cockpit/ki/reihenfolge", (req, res) => res.json(SW.reihenfolgeSetzen(req.body?.reihenfolge)));
  app.post("/api/cockpit/ki/:id/einrichten", asyncRoute(async (req, res) => { const r = await SW.einrichten(req.params.id, req.body || {}); res.status(r.ok ? 200 : 400).json(r); }));
  app.post("/api/cockpit/ki/:id/einstellen", (req, res) => { const r = SW.einstellen(req.params.id, req.body || {}); res.status(r.ok ? 200 : 400).json(r); });
  app.post("/api/cockpit/ki/:id/vergessen", (req, res) => res.json(SW.vergessen(req.params.id)));
  app.post("/api/cockpit/schwarm", asyncRoute(async (req, res) => {
    const frage = String(req.body?.frage || "").trim().slice(0, 4000);
    if (!frage) return res.status(400).json({ error: "Bitte eine Frage eingeben." });
    const bereit = bereiteGehirne();
    const gewuenscht = (Array.isArray(req.body?.dienste) ? req.body.dienste : []).filter((id) => bereit.includes(id));
    const dienste = gewuenscht.length ? gewuenscht : schwarmAuswahl(bereit);
    res.json(await schwarmMitRichter(frage, dienste));
  }));
  app.get("/api/cockpit/labor", (req, res) => res.json({ verlauf: SW.laborVerlauf(), prueffragen: SW.PRUEFFRAGEN.map((f) => ({ id: f.id, text: f.text })), bereit: bereiteGehirne() }));
  app.post("/api/cockpit/labor", asyncRoute(async (req, res) => {
    const bereit = bereiteGehirne();
    const dienste = (Array.isArray(req.body?.dienste) ? req.body.dienste : bereit).filter((id) => bereit.includes(id));
    if (!dienste.length) return res.status(400).json({ error: "Kein KI-Dienst bereit. Trag zuerst einen Schlüssel ein oder richte Ollama ein." });
    res.json(await SW.laborLauf({ dienste, fragen: (id, p) => fragen(id, p, { quelle: "labor" }) }));
  }));
  app.get("/api/cockpit/tests", (req, res) => res.json(funktionstest.stand()));
  app.post("/api/cockpit/tests", asyncRoute(async (req, res) => { const r = await funktionstest.pruefen({ mitKi: req.body?.mitKi === true }); res.status(r.error ? 409 : 200).json(r); }));
  app.get("/api/cockpit/warnungen", (req, res) => res.json(warnungen()));
  app.post("/api/cockpit/warnungen/quittieren", (req, res) => res.json(quittieren(req.body?.id)));
  app.get("/api/cockpit/system", asyncRoute(async (req, res) => res.json({ ...systemLive(), netz: await netzStand() })));
  app.get("/api/cockpit/freigaben", (req, res) => res.json(freigabenStand()));
  app.post("/api/cockpit/freigaben/:id", asyncRoute(async (req, res) => res.json(await glockeEntscheiden(req.params.id, req.body?.ja === true))));
  app.post("/api/cockpit/autonomie", (req, res) => res.json(kommando.setzeAutonomie(Number(req.body?.stufe))));
  app.post("/api/cockpit/immer-fragen", (req, res) => res.json(kommando.setzeImmerFragen(String(req.body?.werkzeug || ""), req.body?.an === true)));
}

// Lokal zuerst (Grundregel), dann günstige Dienste, Claude zuletzt – höchstens 3.
function schwarmAuswahl(bereit) {
  const reihe = ["ollama", "deepseek", "gemini", "openai", "grok", "claude", "openrouter"];
  return reihe.filter((id) => bereit.includes(id)).slice(0, 3);
}
async function schwarmMitRichter(frage, dienste) {
  const bereit = bereiteGehirne();
  const richter = ["ollama", "claude", ...SW.kette()].find((id) => bereit.includes(id)) || null;
  return SW.schwarmFrage(frage, { dienste, fragen: (id, p) => fragen(id, p, { quelle: "schwarm" }), richter });
}

// ---------- Sprachbefehle (ohne Claude) ----------
const norm = (t) => String(t || "").toLowerCase().replace(/[!?.,]+/g, " ").replace(/\s+/g, " ").trim().replace(/^(hey |hallo )?friday,? /, "");
export async function quickCommand(text) {
  const t = norm(text);
  if (!t) return null;
  if (/^(öffne|zeig|zeige|starte?)( mir)? (das |dein |mein )?(gehirn-?cockpit|cockpit|ki-?cockpit)$|^(gehirn-?)?cockpit$/.test(t)) {
    return { answer: "Hier ist das Gehirn-Cockpit, Boss. Alles auf einen Blick: KI-Modelle, Agenten, Missionen, Gedächtnis, Warnungen, System und Freigaben.", actions: ["cockpit"] };
  }
  if (/^(öffne|zeig|zeige|starte?)( mir)? (das |dein )?(omniverse|omniversum|neural ?brain( 3d)?|gehirn in 3d|wissensnetz in 3d|3d-?gehirn)$/.test(t)) {
    return { answer: "Hier ist das Omniverse: alle Systeme und dein Wissen als 3D-Netz.", actions: ["cockpit:omniverse"] };
  }
  if (/^(welche|was für) (ki|kis|ki-modelle|modelle|gehirne) (sind|laufen|hast du)( gerade)?( aktiv| an| bereit)?$|^(zeig|zeige)( mir)? (die )?(aktiven )?ki-?modelle$/.test(t)) {
    const b = bereiteGehirne();
    return { answer: b.length ? `Bereit sind gerade ${b.length}: ${b.map((id) => GEHIRN_NAMEN[id]).join(", ")}. Die Reihenfolge bei Ausfällen ist ${kiStand().kette.map((id) => GEHIRN_NAMEN[id].split(" (")[0]).join(", dann ")}.` : "Gerade ist kein KI-Gehirn bereit. Meine Offline-Befehle laufen trotzdem.", actions: ["cockpit:ki"] };
  }
  if (/^(zeig|zeige|gibt es|gibt's|welche)( mir)? (die )?(fehler|warnungen|probleme)( gerade| im system)?$|^(fehler|warnungs?)-?zentrale$/.test(t)) {
    const w = warnungen();
    const z = w.zaehl;
    const top = w.warnungen.slice(0, 2).map((x) => x.titel).join(". ");
    return { answer: z.fehler + z.warnung + z.hinweis ? `${z.fehler} Fehler, ${z.warnung} Warnungen und ${z.hinweis} Hinweise. ${top}.` : "Keine Fehler und keine Warnungen, Boss. Alles ruhig.", actions: ["cockpit:warnungen"] };
  }
  if (/^(starte |mach |führe )?(die |eine )?funktions(prüfung|test)( durch| starten)?$|^(teste|prüfe) (alle |deine )?funktionen$/.test(t)) {
    const l = await funktionstest.pruefen({ wie: "Sprachbefehl" });
    if (l.error) return { answer: l.error, actions: ["cockpit:tests"] };
    return { answer: `Funktionsprüfung fertig: ${l.bestanden} bestanden, ${l.fehler} Fehler, ${l.uebersprungen} nicht prüfbar.${l.fehler ? ` Nicht geklappt: ${l.ergebnisse.filter((e) => e.status === "fehler").slice(0, 3).map((e) => e.name).join(", ")}.` : ""}`, actions: ["cockpit:tests"] };
  }
  const sm = t.match(/^(frag|frage) (den schwarm|alle kis|alle ki|mehrere kis|die anderen kis)[: ]+(.{4,})$/);
  if (sm) {
    const bereit = bereiteGehirne();
    const dienste = schwarmAuswahl(bereit);
    if (dienste.length < 2) return { answer: `Für eine Schwarm-Frage brauche ich mindestens zwei bereite KIs, gerade ${dienste.length === 1 ? `nur ${GEHIRN_NAMEN[dienste[0]]}` : "keine"}. Trag im Gehirn-Cockpit unter KI-Modelle weitere Schlüssel ein oder richte Ollama ein.`, actions: ["cockpit:ki"] };
    const r = await schwarmMitRichter(sm[3], dienste);
    return { answer: r.ok ? `${r.antwort}${r.einigkeit != null ? ` (Einigkeit der ${r.antworten.filter((a) => a.ok).length} KIs: ${r.einigkeit} %)` : ""}` : r.error || "Keine KI hat geantwortet.", actions: ["cockpit:ki"], claude: dienste.includes("claude") };
  }
  return null;
}
