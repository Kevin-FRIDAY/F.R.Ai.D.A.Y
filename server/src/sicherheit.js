// Cybersecurity-Zentrale + zentrale Sicherheits- und Freigabeverwaltung (v1.183.0, Mark XII Punkte 19 und 29).
// Schützt Friday SELBST – keine Angriffe, keine Überwachung anderer.
//
//  - Zugriffs-Protokoll: jede Anmeldung (geklappt / falsches Passwort / gesperrt) mit Zeit, IP und Gerät.
//  - "Überall abmelden": alle bisherigen Anmeldungen werden ungültig (z. B. wenn ein Handy verloren ging).
//    Das Gerät, auf dem du den Knopf drückst, bleibt angemeldet.
//  - Sicherheits-Punktzahl (0–100) aus echten Prüfungen: Passwort, Schlüssel-Längen, Fehlversuche,
//    Datenleck-Wächter, Autonomie-Stufe, Notfallmodus, Plugins mit Rechten, Sicherungen, Update-Rollback.
//  - Alles an einem Ort: offene Freigaben, Autonomie-Stufe, Plugin-Rechte – mit Links zu den Stellen,
//    an denen man es ändert (keine zweite Freigabe-Verwaltung, die bestehende bleibt maßgeblich).
// Gespeichert in server/data/sicherheit.json.
import fs from "node:fs";
import path from "node:path";
import * as store from "./store.js";
import { config, DATA_DIR } from "./config.js";
import { createToken, setzeGueltigAb } from "./auth.js";
import { eintragen } from "./logbuch.js";

const NAME = "sicherheit";
const leer = () => ({ protokoll: [], gueltigAb: 0, scan: null });
const lade = () => ({ ...leer(), ...store.load(NAME, leer()) });
const sichere = (d) => { d.protokoll = d.protokoll.slice(-300); store.save(NAME, d); };

const geraetAus = (ua = "") => {
  const u = String(ua);
  const os = /iPhone/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Android/.test(u) ? "Android" : /Mac OS X/.test(u) ? "Mac" : /Windows/.test(u) ? "Windows" : /Linux/.test(u) ? "Linux" : /curl|node|python/i.test(u) ? "Programm" : "unbekannt";
  const br = /CriOS|Chrome/.test(u) && !/Edg/.test(u) ? "Chrome" : /Edg/.test(u) ? "Edge" : /Firefox|FxiOS/.test(u) ? "Firefox" : /Safari/.test(u) ? "Safari" : "";
  return br ? `${os} · ${br}` : os;
};

/** Anmelde-Versuch merken (aus der Login-Route). art: ok | falsch | gesperrt */
export function anmeldung(art, req) {
  const d = lade();
  d.protokoll.push({ zeit: new Date().toISOString(), art, ip: String(req?.ip || "").replace(/^::ffff:/, ""), geraet: geraetAus(req?.headers?.["user-agent"]) });
  sichere(d);
  if (art !== "ok") {
    const fehl = d.protokoll.filter((e) => e.art !== "ok" && Date.now() - Date.parse(e.zeit) < 3600e3).length;
    if (fehl === 5 || fehl === 20) {
      eintragen({ bereich: "system", titel: `Sicherheit: ${fehl} fehlgeschlagene Anmeldungen in einer Stunde`, ok: false, quelle: "automatisch" });
      import("./notify.js").then((n) => n.notifyAll("🔐 Friday-Sicherheit", `${fehl} falsche Passwort-Versuche in der letzten Stunde. Wenn du das nicht warst: Im Cockpit unter Sicherheit „Überall abmelden“ und das Passwort ändern.`)).catch(() => {});
    }
  }
}

/** Alle Anmeldungen ungültig machen. Gibt eine frische Anmeldung für das aufrufende Gerät zurück. */
export function ueberallAbmelden(req) {
  const d = lade();
  d.gueltigAb = Date.now();
  setzeGueltigAb(d.gueltigAb);
  d.protokoll.push({ zeit: new Date().toISOString(), art: "abgemeldet", ip: String(req?.ip || "").replace(/^::ffff:/, ""), geraet: geraetAus(req?.headers?.["user-agent"]) });
  sichere(d);
  eintragen({ bereich: "system", titel: "Sicherheit: überall abgemeldet", details: "Alle älteren Anmeldungen gelten nicht mehr.", quelle: "dashboard" });
  return { ok: true, token: createToken(), text: "Alle anderen Geräte sind abgemeldet. Dieses Gerät bleibt angemeldet." };
}

export async function datenleckPruefen() {
  const W = await import("./waechter.js");
  const r = await W.datenleckScan();
  const d = lade();
  d.scan = { zeit: r.zeit, stufe: r.stufe, funde: (r.funde || []).map((f) => ({ was: f.was, stufe: f.stufe, tipp: f.tipp || "", reparieren: f.reparieren || null })).slice(0, 20), hinweise: (r.hinweise || []).slice(0, 10) };
  sichere(d);
  return d.scan;
}

const UPDATE_SH = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "update.sh");
async function neuesteSicherung() {
  try {
    const dir = (await import("./backup.js")).backupDir();
    const namen = fs.readdirSync(dir).filter((n) => /^\d{4}-\d\d-\d\d/.test(n)).sort();
    if (!namen.length) return null;
    return fs.statSync(path.join(dir, namen.at(-1))).mtimeMs;
  } catch { return null; }
}

/** Alle Prüfungen mit Gewicht. ok: true/false/null (null = nicht prüfbar, zählt nicht). */
export async function uebersicht() {
  const d = lade();
  const tag = Date.now() - 864e5;
  const fehl24 = d.protokoll.filter((e) => e.art !== "ok" && e.art !== "abgemeldet" && Date.parse(e.zeit) > tag).length;
  const ok24 = d.protokoll.filter((e) => e.art === "ok" && Date.parse(e.zeit) > tag);
  const K = await import("./kommando.js").catch(() => null);
  const k = K?.stand();
  const M = await import("./modulsystem.js").catch(() => null);
  const plugins = (M?.installierte?.() || []).map((m) => ({ id: m.id, name: m.name, an: m.an !== false, rechte: (m.rechte || []).map((r) => M.RECHTE[r] || r) }));
  const sicherung = await neuesteSicherung();
  let rollback = false;
  try { rollback = /gesund\(\)/.test(fs.readFileSync(UPDATE_SH, "utf8")); } catch { /* egal */ }
  let letzterRollback = null;
  try { letzterRollback = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "update-rollback.json"), "utf8")); } catch { /* keiner */ }

  const pruefungen = [
    { id: "passwort", name: "Passwort-Schutz an", gewicht: 20, ok: Boolean(config.passwordHash && String(config.passwordHash).includes(":")), rat: "In der .env fehlt PASSWORD_HASH. Ohne Passwort kann jeder im Netz Friday benutzen." },
    { id: "schluessel", name: "Lange geheime Schlüssel", gewicht: 10, ok: [config.sessionSecret, config.agentToken, config.shortcutToken].every((x) => String(x || "").length >= 32), rat: "SESSION_SECRET, AGENT_TOKEN und SHORTCUT_TOKEN sollten mindestens 32 Zeichen lang sein." },
    { id: "fehlversuche", name: "Wenig falsche Passwörter (24 h)", gewicht: 15, ok: fehl24 < 10, wert: `${fehl24} Fehlversuche`, rat: "Viele falsche Versuche. Wenn du das nicht warst: überall abmelden und Passwort ändern." },
    { id: "datenleck", name: "Datenleck-Wächter ohne ernste Funde", gewicht: 15, ok: d.scan ? d.scan.stufe !== "hoch" : null, wert: d.scan ? `${d.scan.funde.length} Hinweise` : "noch nicht geprüft", rat: "Schau dir die Funde unten an. Einige lassen sich mit einem Klick reparieren." },
    { id: "autonomie", name: "Kritische Aktionen nur mit Freigabe", gewicht: 15, ok: k ? k.autonomie <= 2 : null, wert: k?.stufe?.name || "", rat: "Bei „Selbstständig“ fragt Friday auch bei kritischen Aktionen nicht nach. Empfohlen: Normal oder Vorsichtig." },
    { id: "notfall", name: "Notfallmodus aus", gewicht: 5, ok: k ? !k.notfall : null, rat: "Der Notfallmodus ist an. Das ist sicher, aber Friday arbeitet dann nur eingeschränkt." },
    { id: "plugins", name: "Plugins ohne riskante Rechte", gewicht: 5, ok: !plugins.some((p) => p.an && p.rechte.some((r) => /Guthaben/.test(r))), wert: `${plugins.length} installiert`, rat: "Ein eingeschaltetes Plugin darf Sätze an Fridays Gehirn geben (kostet Guthaben). Prüfe, ob du es brauchst." },
    { id: "sicherung", name: "Sicherung jünger als 3 Tage", gewicht: 10, ok: sicherung ? Date.now() - sicherung < 3 * 864e5 : false, wert: sicherung ? new Date(sicherung).toLocaleDateString("de-DE") : "keine", rat: "Leg im System-Arzt oder unter Sicherung eine neue Sicherung an." },
    { id: "rollback", name: "Update mit Gesundheits-Check und Rollback", gewicht: 5, ok: rollback, rat: "Das Update-Skript ist alt. Nach dem nächsten Update ist der Schutz aktiv." },
  ];
  const gezaehlt = pruefungen.filter((p) => p.ok !== null);
  const summe = gezaehlt.reduce((s, p) => s + p.gewicht, 0);
  const punkte = summe ? Math.round((gezaehlt.filter((p) => p.ok).reduce((s, p) => s + p.gewicht, 0) / summe) * 100) : 0;
  return {
    punkte, pruefungen,
    protokoll: d.protokoll.slice(-40).reverse(),
    anmeldungen24: ok24.length, fehl24,
    geraete: [...new Set(ok24.map((e) => e.geraet))],
    gueltigAb: d.gueltigAb || null,
    scan: d.scan,
    freigaben: k ? { offen: k.offen.length, stufe: k.stufe?.name, autonomie: k.autonomie, notfall: k.notfall } : null,
    plugins,
    letzterRollback,
  };
}

export function satz(u) {
  const schlecht = u.pruefungen.filter((p) => p.ok === false);
  return `Sicherheits-Punktzahl ${u.punkte} von 100. ${schlecht.length ? `Verbessern: ${schlecht.slice(0, 2).map((p) => p.name).join(", ")}.` : "Alle Prüfungen bestanden."} In den letzten 24 Stunden ${u.anmeldungen24} Anmeldungen und ${u.fehl24} falsche Passwörter.`;
}

export async function quickCommand(text) {
  const t = String(text || "").toLowerCase();
  if (!/wie sicher (ist|bin) (friday|ich|mein system)|sicherheits.?(zentrale|check|status|punkt)|cyber.?security|wer hat sich (bei dir )?angemeldet/.test(t)) return null;
  return { answer: satz(await uebersicht()), actions: ["cockpit:sicherheit"] };
}

export function sicherheitRouten(app, asyncRoute) {
  app.get("/api/sicherheit", asyncRoute(async (_req, res) => res.json(await uebersicht())));
  app.post("/api/sicherheit/ueberall-abmelden", asyncRoute(async (req, res) => res.json(ueberallAbmelden(req))));
  app.post("/api/sicherheit/datenleck", asyncRoute(async (_req, res) => res.json(await datenleckPruefen())));
  app.post("/api/sicherheit/reparieren", asyncRoute(async (req, res) => {
    const was = String(req.body?.was || "");
    if (!["env-rechte", "data-rechte"].includes(was)) return res.status(400).json({ error: "Unbekannte Reparatur." });
    const W = await import("./waechter.js");
    const r = W.reparieren(was);
    if (!r.error) await datenleckPruefen().catch(() => {});
    res.status(r.error ? 400 : 200).json(r);
  }));
}

export async function sicherheitStart() {
  setzeGueltigAb(lade().gueltigAb || 0);
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "sicherheit", bereich: "System", name: "Anmelde-Schutz und Überall-Abmelden", lauf: async () => {
      const { verifyToken } = await import("./auth.js");
      const alt = lade().gueltigAb || 0;
      const vorher = createToken();
      await new Promise((r) => setTimeout(r, 5));
      // Echter Ablauf mit Fridays eigener Anmelde-Prüfung, danach wird der alte Stand wiederhergestellt.
      setzeGueltigAb(Date.now());
      const nachher = createToken();
      const ok = !verifyToken(vorher) && verifyToken(nachher) && !verifyToken("v1.9999999999999.falsch");
      setzeGueltigAb(alt);
      const u = await uebersicht();
      return ok ? { status: "bestanden", text: `Alte Anmeldungen werden abgewiesen, neue gelten. Sicherheits-Punktzahl ${u.punkte}.` } : { status: "fehler", text: "Überall-Abmelden wirkt nicht richtig." };
    } });
  } catch { /* egal */ }
}
