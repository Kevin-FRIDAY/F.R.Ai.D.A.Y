// Fridays Datenbank (v1.129.0): ein Ort für alles, was Friday weiß und getan hat.
// Vorher: Gespräche, Aktionen, Gemerktes, Aufgaben, Erinnerungen, Einkauf, Dokumente.
// Neu dazu: eigene Notizen („Wissen eintragen“), Ideen-Tresor, Entscheidungen, Ziele, Missionen,
// Meine Geräte, Vorrat (Kühlschrank) und Lernstapel. Dazu eine Übersicht im Stil von Fridays Gehirn:
// Speicher-Karte (Quellen mit echter Anzahl), Aktivität der letzten 30 Tage, häufige Themen, Rückblick
// („heute vor einer Woche/einem Monat“), Speichergröße. Alles ohne Claude.
import fs from "node:fs";
import path from "node:path";
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { DATA_DIR } from "./config.js";
import { alleDokumente } from "./dokumente.js";
import { U } from "./datum.js";

const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const kurz = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const zeitAusId = (id) => { const n = parseInt(String(id || ""), 36); return n > 1.5e12 && n < 4e12 ? new Date(n).toISOString() : null; };
const iso = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
const laden = (name, fb) => { try { return store.load(name, fb); } catch { return fb; } };

/** Alle Quellen mit Name, Symbol und Farbe (für Filter, Speicher-Karte und Liste). */
export const QUELLEN = {
  gespraech: { name: "Gespräche", icon: "💬", farbe: "#4fb8ff" },
  aktion: { name: "Aktionen", icon: "⚡", farbe: "#ffc44d" },
  gedaechtnis: { name: "Gemerkt", icon: "🧠", farbe: "#b06bff" },
  notiz: { name: "Notizen", icon: "📝", farbe: "#ff8a2a" },
  aufgabe: { name: "Aufgaben", icon: "✅", farbe: "#38e08c" },
  erinnerung: { name: "Erinnerungen", icon: "⏰", farbe: "#ff9d3c" },
  einkauf: { name: "Einkauf", icon: "🛒", farbe: "#2ee6d0" },
  dokument: { name: "Dokumente", icon: "📄", farbe: "#9fb4ff" },
  idee: { name: "Ideen", icon: "💡", farbe: "#ffd23c" },
  entscheidung: { name: "Entscheidungen", icon: "⚖️", farbe: "#ff6fb5" },
  ziel: { name: "Ziele", icon: "🎯", farbe: "#7dff6a" },
  mission: { name: "Missionen", icon: "🚀", farbe: "#ff7a45" },
  geraet: { name: "Geräte", icon: "🔌", farbe: "#a0e9ff" },
  vorrat: { name: "Vorrat", icon: "🥫", farbe: "#c9f27a" },
  lernen: { name: "Lernstapel", icon: "🎓", farbe: "#ffb3e6" },
};

// ---------- Eigene Notizen ----------
export const notizen = () => laden("wissen-notizen", []);
export function notizSpeichern({ titel = "", text = "", tags = "" } = {}) {
  const t = kurz(text, 4000);
  const ti = kurz(titel, 120) || kurz(t.split(/(?<!\d)[.!?](?:\s|$)|\n/)[0], 100);
  if (!t && !ti) throw new Error("Schreib erst etwas hinein.");
  const n = { id: neueId(), at: new Date().toISOString(), titel: ti, text: t, tags: kurz(Array.isArray(tags) ? tags.join(", ") : tags, 120) };
  store.save("wissen-notizen", [...notizen(), n].slice(-2000));
  logbuch.eintragen({ bereich: "gedaechtnis", titel: `Datenbank: Notiz „${ti}“ gespeichert` });
  return n;
}
export function notizLoeschen(id) {
  const l = notizen();
  const rest = l.filter((n) => n.id !== id);
  store.save("wissen-notizen", rest);
  return rest.length !== l.length;
}

// ---------- Alles zusammen ----------
export function alleEintraege() {
  const out = [];
  for (const e of store.leseArchiv()) out.push({ typ: e.typ || "gespraech", at: e.at, kanal: e.kanal, frage: e.frage, antwort: e.antwort, aktionen: e.aktionen, alt: e.uebernommen || undefined });
  for (const a of store.getActivity()) out.push({ typ: "aktion", at: a.at, art: a.cat, text: a.label });
  for (const m of store.getMemories()) out.push({ typ: "gedaechtnis", at: m.created || zeitAusId(m.id), text: m.text });
  for (const t of store.getTasks()) out.push({ typ: "aufgabe", at: t.at ? iso(t.at) : zeitAusId(t.id), text: t.text, erledigt: !!t.done });
  for (const r of store.getReminders()) out.push({ typ: "erinnerung", at: zeitAusId(r.id) || r.due, faellig: r.due, text: r.text, erledigt: !!r.done });
  for (const s of store.getShopping()) out.push({ typ: "einkauf", at: zeitAusId(s.id), text: s.text, erledigt: !!s.done });
  try {
    for (const d of alleDokumente()) {
      const n = d.fragen?.length || 0, b = d.fragen?.filter((f) => String(f.antwort || "").trim()).length || 0;
      out.push({ typ: "dokument", at: d.erstellt, id: d.id, art: d.art, text: d.titel, inhalt: d.art === "fragebogen" ? (d.fragen || []).map((f, i) => `${i + 1}. ${f.frage}${f.antwort ? ` → ${f.antwort}` : ""}`).join("\n") : d.inhalt, info: d.art === "fragebogen" ? `${b} von ${n} beantwortet` : "" });
    }
  } catch { /* Dokumente optional */ }
  for (const n of notizen()) out.push({ typ: "notiz", at: n.at, id: n.id, text: n.titel, inhalt: n.text !== n.titel ? n.text : "", info: n.tags });
  for (const i of laden("ideen", [])) out.push({ typ: "idee", at: i.at || zeitAusId(i.id), text: i.titel, inhalt: i.text, info: { idee: "Idee", test: "Test", umsetzung: "Umsetzung", erledigt: "Erledigt", verworfen: "Verworfen" }[i.status] || "", erledigt: i.status === "erledigt" });
  for (const e of laden("entscheidungen", [])) out.push({ typ: "entscheidung", at: e.datum, text: e.frage, inhalt: `→ ${e.entscheidung}${e.gruende ? `\nGründe: ${e.gruende}` : ""}${e.ergebnis ? `\nErgebnis: ${e.ergebnis}` : ""}`, info: e.bewertung ? `${e.bewertung}/5` : "" });
  for (const z of laden("ziele", [])) {
    const s = z.schritte || [], fertig = s.filter((x) => x.erledigt).length;
    out.push({ typ: "ziel", at: z.erstellt, text: z.titel, inhalt: s.map((x) => `${x.erledigt ? "✓" : "○"} ${x.text}`).join("\n"), info: s.length ? `${fertig}/${s.length} Schritte` : "", erledigt: s.length > 0 && fertig === s.length });
  }
  for (const m of laden("missionen", [])) out.push({ typ: "mission", at: m.erstellt, text: m.titel, inhalt: (m.schritte || []).map((x) => `${x.status === "fertig" ? "✓" : "○"} ${x.text}`).join("\n"), info: m.status || "", erledigt: m.status === "fertig" });
  for (const g of laden("geraete", [])) out.push({ typ: "geraet", at: g.seit, text: g.name, info: g.kaufdatum ? `gekauft ${g.kaufdatum}` : "", inhalt: g.notiz || "" });
  const kuehl = laden("kuehlschrank", { vorrat: [] });
  for (const v of kuehl.vorrat || []) out.push({ typ: "vorrat", at: v.hinzu, text: `${v.icon || ""} ${v.name}${v.menge > 1 ? ` ×${v.menge}` : ""}`.trim(), info: v.ablauf ? `haltbar bis ${v.ablauf}` : "" });
  const lern = laden("lernen", { stapel: [] });
  for (const s of lern.stapel || []) out.push({ typ: "lernen", at: s.erstellt || zeitAusId(s.id), text: s.titel, info: `${(s.karten || []).length} Karten`, inhalt: (s.karten || []).slice(0, 12).map((k) => `• ${k.frage}`).join("\n") });
  return out.filter((e) => e.at && iso(e.at)).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function filtern(alle, { typ = "", q = "" } = {}) {
  let l = alle;
  if (typ) l = l.filter((e) => e.typ === typ);
  const s = String(q || "").trim().toLowerCase();
  if (s) l = l.filter((e) => [e.frage, e.antwort, e.text, e.art, e.kanal, e.inhalt, e.info].some((v) => v && String(v).toLowerCase().includes(s)));
  return l;
}

// ---------- Übersicht (Speicher-Karte, Aktivität, Themen, Rückblick) ----------
const STOPP = new Set(("setz setze kostet steht merk merke spiel spiele zeig der die das den dem des ein eine einen einem einer und oder aber doch noch schon mal bitte danke ist sind war bin bist hat habe hast haben wird werden wurde kann kannst könnte koennte soll sollst will willst mir mich mein meine meinen meiner dir dich dein deine ich du er sie es wir ihr uns euch was wie wo wer wann warum welche welcher welches für fuer mit von vom zum zur auf aus bei nach über ueber unter vor im in an am als auch nicht kein keine nur so dann jetzt heute morgen gestern gerade ja nein ok okay hey hallo friday freitag boss gib zeig zeige sag sage mach mache öffne oeffne bitte ganz sehr viel mehr gut neue neuen eins zwei drei uhr da hier dort dass daß wenn weil sich man alle alles etwas einfach immer wieder bis seit ohne gegen").split(" "));
const ymdLokal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function ordnerGroesse(dir, tiefe = 0) {
  let summe = 0, dateien = 0;
  let liste = [];
  try { liste = fs.readdirSync(dir, { withFileTypes: true }); } catch { return { summe, dateien }; }
  for (const e of liste) {
    const p = path.join(dir, e.name);
    try {
      if (e.isDirectory()) { if (tiefe < 3) { const u = ordnerGroesse(p, tiefe + 1); summe += u.summe; dateien += u.dateien; } }
      else { summe += fs.statSync(p).size; dateien++; }
    } catch { /* egal */ }
  }
  return { summe, dateien };
}

export function uebersicht(alle = alleEintraege(), jetzt = new Date()) {
  const typen = {};
  for (const k of Object.keys(QUELLEN)) typen[k] = 0;
  for (const e of alle) typen[e.typ] = (typen[e.typ] || 0) + 1;
  const heuteStr = ymdLokal(jetzt);
  const tage = [];
  const proTag = new Map();
  for (let i = 29; i >= 0; i--) { const d = new Date(jetzt); d.setDate(d.getDate() - i); const k = ymdLokal(d); tage.push({ tag: k, n: 0 }); proTag.set(k, tage[tage.length - 1]); }
  const kanaele = {};
  const woerter = new Map();
  const vorWoche = new Date(jetzt.getTime() - 7 * 864e5);
  let heute = 0, woche = 0;
  for (const e of alle) {
    if (e.alt) continue;
    const d = new Date(e.at);
    const k = ymdLokal(d);
    if (k === heuteStr) heute++;
    if (d >= vorWoche) woche++;
    const t = proTag.get(k); if (t) t.n++;
    if (e.typ === "gespraech") {
      kanaele[e.kanal || "web"] = (kanaele[e.kanal || "web"] || 0) + 1;
      for (const w of String(e.frage || "").toLowerCase().match(/[a-zäöüß][a-zäöüß-]{3,}/g) || []) {
        if (STOPP.has(w)) continue;
        woerter.set(w, (woerter.get(w) || 0) + 1);
      }
    }
  }
  for (const e of alle) if (["gedaechtnis", "notiz", "idee"].includes(e.typ)) for (const w of String(e.text || "").toLowerCase().match(/[a-zäöüß][a-zäöüß-]{3,}/g) || []) if (!STOPP.has(w)) woerter.set(w, (woerter.get(w) || 0) + 1);
  const themen = [...woerter.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([wort, n]) => ({ wort, n }));
  // Rückblick: Was war heute vor 7 / 30 / 365 Tagen?
  const rueckblick = [];
  for (const [tg, name] of [[7, "Vor einer Woche"], [30, "Vor einem Monat"], [365, "Vor einem Jahr"]]) {
    const d = new Date(jetzt); d.setDate(d.getDate() - tg);
    const k = ymdLokal(d);
    const treffer = alle.filter((e) => !e.alt && ymdLokal(new Date(e.at)) === k && e.typ !== "aktion");
    if (treffer.length) rueckblick.push({ name, tag: k, anzahl: treffer.length, beispiel: treffer.slice(0, 3).map((e) => ({ typ: e.typ, text: kurz(e.frage || e.text, 90) })) });
  }
  const gr = ordnerGroesse(DATA_DIR);
  const quellenAktiv = Object.values(typen).filter((n) => n > 0).length;
  return {
    gesamt: alle.length, heute, woche, typen, quellen: QUELLEN, quellenAktiv,
    seit: alle.length ? alle[alle.length - 1].at : null,
    tage, kanaele, themen, rueckblick,
    speicher: { bytes: gr.summe, dateien: gr.dateien },
    zuletztGemerkt: alle.filter((e) => e.typ === "gedaechtnis" || e.typ === "notiz").slice(0, 4).map((e) => ({ typ: e.typ, text: kurz(e.text, 100), at: e.at })),
  };
}

export function alsCsv(eintraege) {
  const f = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const kopf = "zeit;quelle;text;antwort_oder_inhalt;info;kanal;erledigt";
  return "﻿" + [kopf, ...eintraege.map((e) => [e.at, QUELLEN[e.typ]?.name || e.typ, e.frage || e.text, e.antwort || e.inhalt, e.info || e.art || "", e.kanal || "", e.erledigt ? "ja" : ""].map(f).join(";"))].join("\n");
}

// ---------- Sprachbefehle (ohne Claude) ----------
const OEFFNEN = U(/^(öffne|oeffne|zeig|zeige|starte)( mir)?( die| deine| meine)? (datenbank|fridays datenbank|wissensdatenbank|wissensspeicher)$/);
const SUCHE = U(/^(?:durchsuch(?:e)?|such(?:e)?) (?:in )?(?:der |die |deine |deiner |meiner |meine )?(?:datenbank|wissensdatenbank) (?:nach |zu |über |ueber )?(.{2,80})$|^was steht in (?:der |deiner )?datenbank (?:über|ueber|zu) (.{2,80})$/);
const NOTIZ = U(/^(?:notier|notiere|schreib|schreibe|trag|trage) (?:in (?:die |deine )?datenbank|ins wissen)[,:]? (.{4,})$|^(?:datenbank|wissen) notiz[,:]? (.{4,})$/);
const GROESSE = U(/^(wie (groß|gross|voll) ist (deine|die) datenbank|was ist in (deiner|der) datenbank|wie viel (weißt|weisst) du)$/);
const RUECK = U(/^(was war|was habe ich gemacht|was haben wir gemacht) (heute )?vor (einer woche|einem monat|einem jahr)$/);

export function quickCommand(text) {
  const t = String(text || "").replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/i, "").replace(/[?!.]+$/, "").trim();
  const k = t.toLowerCase();
  if (!k) return null;
  if (OEFFNEN.test(k)) return { answer: "Hier ist meine Datenbank.", actions: ["wissen"] };
  let m = k.match(NOTIZ);
  if (m) {
    const roh = t.slice(k.indexOf(m[1] || m[2]));
    const n = notizSpeichern({ text: roh });
    return { answer: `Steht in der Datenbank: ${n.titel}.`, actions: [] };
  }
  m = k.match(SUCHE);
  if (m) {
    const q = (m[1] || m[2]).trim();
    const l = filtern(alleEintraege(), { q }).filter((e) => e.typ !== "aktion");
    if (!l.length) return { answer: `Zu „${q}“ finde ich nichts in meiner Datenbank.`, actions: [`wissen:${encodeURIComponent(q)}`] };
    const e = l[0];
    const was = e.typ === "gespraech" ? `Du hast gefragt: ${kurz(e.frage, 120)}. Ich habe geantwortet: ${kurz(e.antwort, 160)}` : `${QUELLEN[e.typ]?.name || ""}: ${kurz(e.text, 160)}`;
    return { answer: `${l.length} Treffer zu „${q}“. Der neueste: ${was}`, actions: [`wissen:${encodeURIComponent(q)}`] };
  }
  if (GROESSE.test(k)) {
    const u = uebersicht();
    const top = Object.entries(u.typen).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t2, n]) => `${n} ${QUELLEN[t2]?.name || t2}`).join(", ");
    return { answer: `In meiner Datenbank stehen ${u.gesamt} Einträge aus ${u.quellenAktiv} Quellen, heute ${u.heute} neue. Am meisten: ${top || "noch nichts"}.`, actions: ["wissen"] };
  }
  m = k.match(RUECK);
  if (m) {
    const u = uebersicht();
    const name = { "einer woche": "Vor einer Woche", "einem monat": "Vor einem Monat", "einem jahr": "Vor einem Jahr" }[m[3]];
    const r = u.rueckblick.find((x) => x.name === name);
    if (!r) return { answer: `${name} steht nichts in meiner Datenbank.`, actions: [] };
    return { answer: `${name} gab es ${r.anzahl} Einträge, zum Beispiel: ${r.beispiel.map((b) => b.text).join("; ")}.`, actions: ["wissen"] };
  }
  return null;
}
