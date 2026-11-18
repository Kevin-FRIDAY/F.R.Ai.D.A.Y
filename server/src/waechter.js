// Fridays Wächter: Manipulationserkennung und Datenleck-Wächter.
// - Manipulationserkennung: prüft Eingaben und Dokumente auf versteckte KI-Anweisungen ("Prompt-Injection"),
//   unsichtbare Zeichen, verwechselbare Buchstaben (z. B. kyrillisches "а" statt "a"), versteckte Skripte und Links.
// - Datenleck-Wächter: prüft NUR Fridays eigene Dateien auf diesem Mac: liegen Schlüssel offen herum
//   (Logbuch, Archiv, Dokumente, Dashboard), sind Dateirechte zu offen, ist .env geschützt?
//   Fremde Systeme werden nie gescannt.
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { ROOT, DATA_DIR, DASHBOARD_DIR } from "./config.js";
import { eintragen } from "./logbuch.js";

const INJEKTION = [
  [/\b(ignore|disregard|forget)\b.{0,30}\b(previous|prior|above|all)\b.{0,30}\b(instructions?|prompts?|rules?)/i, "Englische Aufforderung, frühere Anweisungen zu ignorieren"],
  [/\b(ignorier|vergiss|missachte)\w*\b.{0,40}\b(vorherig|bisherig|obig|alle)\w*\b.{0,30}\b(anweisung|regel|befehl|vorgabe)/i, "Aufforderung, frühere Anweisungen zu ignorieren"],
  [/\b(system ?prompt|systemnachricht|developer message|jailbreak|DAN mode|do anything now)\b/i, "Versuch, an Fridays Systemanweisungen zu kommen"],
  [/\b(you are now|ab jetzt bist du|du bist jetzt|act as|tu so als)\b/i, "Versuch, Fridays Rolle umzudefinieren"],
  [/\b(send|schick|überweis|transfer)\w*\b.{0,40}\b(passwor|schlüssel|token|api.?key|iban|kreditkart|bitcoin|wallet)/i, "Aufforderung, Geheimnisse oder Geld zu verschicken"],
  [/<\s*(script|iframe|object|embed)\b/i, "Versteckter Programmcode (script/iframe)"],
  [/\bjavascript:\s*/i, "JavaScript-Link"],
  [/data:[a-z]+\/[a-z0-9.+-]+;base64,/i, "Eingebettete Datei (data:-Link)"],
  [/\[(system|assistant|INST)\]|<\|(im_start|system|endoftext)\|>/i, "Gefälschte KI-Steuerzeichen"],
];
const UNSICHTBAR = /[​-‏‪-‮⁠-⁤⁦-⁩﻿­]/g;
const KYRILLISCH = /[Ѐ-ӿ]/;
const LATEIN = /[A-Za-z]/;

/** Prüft einen Text. @returns {{verdaechtig:boolean, stufe:"ok"|"achtung"|"gefahr", funde:{art:string, stelle:string}[]}} */
export function pruefeText(text = "") {
  const t = String(text || "");
  const funde = [];
  for (const [re, art] of INJEKTION) {
    const m = t.match(re);
    if (m) funde.push({ art, stelle: ausschnitt(t, m.index, m[0].length) });
  }
  const unsichtbar = t.match(UNSICHTBAR);
  if (unsichtbar) funde.push({ art: `${unsichtbar.length} unsichtbare Steuerzeichen (können Text verstecken oder umdrehen)`, stelle: "" });
  const gemischt = (t.match(/\S+/g) || []).filter((w) => KYRILLISCH.test(w) && LATEIN.test(w)).slice(0, 5);
  if (gemischt.length) funde.push({ art: "Wörter mit vermischten lateinischen und kyrillischen Buchstaben (typisch für gefälschte Links/Namen)", stelle: gemischt.join(", ") });
  const base64 = t.match(/[A-Za-z0-9+/]{300,}={0,2}/);
  if (base64) funde.push({ art: "Langer verschlüsselt aussehender Block (Base64)", stelle: `${base64[0].slice(0, 40)}…` });
  // Links, deren Text eine andere Adresse zeigt als das Ziel (HTML)
  for (const m of t.matchAll(/<a[^>]+href=["']?https?:\/\/([^/"'\s>]+)[^>]*>\s*(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})/gi)) {
    if (!m[1].toLowerCase().endsWith(m[2].toLowerCase())) funde.push({ art: "Link zeigt eine andere Adresse an, als er öffnet", stelle: `zeigt ${m[2]}, öffnet ${m[1]}` });
  }
  const gefahr = funde.some((f) => /Geheimnisse|Programmcode|ignorieren|Systemanweisungen/.test(f.art));
  return { verdaechtig: funde.length > 0, stufe: gefahr ? "gefahr" : funde.length ? "achtung" : "ok", funde: funde.slice(0, 20) };
}
function ausschnitt(t, i, n) {
  return `…${t.slice(Math.max(0, i - 30), i + n + 30).replace(/\s+/g, " ")}…`;
}

// ---- Datenleck-Wächter ----
const GEHEIM = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/g, "Claude-Schlüssel"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}/g, "GitHub-Schlüssel"],
  [/\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g, "Telegram-Bot-Token"],
  [/\bsk_[a-f0-9]{40,}\b/g, "ElevenLabs-Schlüssel"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, "Google-Schlüssel"],
  [/\bAC[a-f0-9]{32}\b/g, "Twilio-Konto-ID"],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "Privater Schlüssel"],
];
const maskiere = (s) => (s.length > 10 ? `${s.slice(0, 4)}…${s.slice(-3)}` : "•••");

function dateienIn(dir, { tiefe = 3, endungen = /\.(json|jsonl|js|html|css|md|txt|log|csv)$/i, max = 4000 } = {}) {
  const out = [];
  const lauf = (d, t) => {
    if (t < 0 || out.length >= max) return;
    let eintraege = [];
    try { eintraege = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of eintraege) {
      if (e.name === "node_modules" || e.name.startsWith(".git")) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) lauf(p, t - 1);
      else if (endungen.test(e.name)) out.push(p);
    }
  };
  lauf(dir, tiefe);
  return out;
}

// Diese Dateien SOLLEN Schlüssel enthalten (sind geschützt und werden nie hochgeladen).
const ERLAUBT = new Set(["verbindungen.json", "github.json", "alexa.json", "fernseher.json", "hue.json", "spotify.json", "telegram.json", "anrufe.json"]);

export async function datenleckScan() {
  const funde = [];
  const hinweise = [];
  const appDir = path.resolve(ROOT, "..");
  // 1) .env: vorhanden, nur für dich lesbar?
  const envDatei = path.join(ROOT, ".env");
  try {
    const st = fs.statSync(envDatei);
    const rechte = st.mode & 0o777;
    if (rechte & 0o077) funde.push({ stufe: "mittel", was: "server/.env ist für andere Benutzer auf dem Mac lesbar", wo: "server/.env", tipp: "Reparieren-Knopf drücken (setzt die Rechte auf „nur ich“)", reparieren: "env-rechte" });
    else hinweise.push("server/.env ist nur für dich lesbar.");
  } catch { hinweise.push("Keine server/.env gefunden."); }
  // 2) Datenordner-Rechte
  try {
    const rechte = fs.statSync(DATA_DIR).mode & 0o777;
    if (rechte & 0o007) funde.push({ stufe: "niedrig", was: "Der Datenordner (Gedächtnis, Logbuch …) ist für alle Benutzer lesbar", wo: "server/data", tipp: "Reparieren-Knopf drücken", reparieren: "data-rechte" });
  } catch { /* egal */ }
  // 3) Schlüssel, die in Logbuch, Archiv, Verlauf, Dokumenten oder im Dashboard stehen
  const dateien = [...dateienIn(DATA_DIR, { tiefe: 3 }), ...dateienIn(DASHBOARD_DIR, { tiefe: 2 })];
  let geprueft = 0;
  for (const datei of dateien) {
    const name = path.basename(datei);
    if (ERLAUBT.has(name)) continue;
    let inhalt = "";
    try {
      const st = fs.statSync(datei);
      if (st.size > 8 * 1024 * 1024) continue;
      inhalt = fs.readFileSync(datei, "utf8");
    } catch { continue; }
    geprueft++;
    for (const [re, art] of GEHEIM) {
      const treffer = [...new Set(inhalt.match(re) || [])];
      if (!treffer.length) continue;
      const imDashboard = datei.startsWith(DASHBOARD_DIR);
      funde.push({
        stufe: imDashboard ? "hoch" : "mittel",
        was: `${art} steht im Klartext${imDashboard ? " im Dashboard (für jeden mit Zugang sichtbar!)" : ""}`,
        wo: path.relative(appDir, datei),
        beispiel: treffer.slice(0, 2).map(maskiere).join(", "),
        tipp: imDashboard ? "Sofort entfernen und den Schlüssel beim Anbieter neu erstellen." : "Der Schlüssel stand in einem Gespräch oder Eintrag. Am sichersten: beim Anbieter neu erstellen (rotieren) und den alten löschen.",
      });
    }
  }
  // 4) Git: ist .env versehentlich im Repo?
  if (fs.existsSync(path.join(appDir, ".git"))) {
    const getrackt = await new Promise((res) => execFile("git", ["-C", appDir, "ls-files", "server/.env", "server/data"], { timeout: 5000 }, (e, out) => res(e ? "" : String(out).trim())));
    if (getrackt) funde.push({ stufe: "hoch", was: "Geheime Dateien sind in Git eingetragen und könnten hochgeladen werden", wo: getrackt.split("\n").slice(0, 3).join(", "), tipp: "Mit „git rm --cached“ aus Git nehmen und Schlüssel rotieren." });
  }
  const gi = (() => { try { return fs.readFileSync(path.join(appDir, ".gitignore"), "utf8"); } catch { return ""; } })();
  if (gi && !/\.env/.test(gi)) funde.push({ stufe: "mittel", was: ".gitignore schützt die .env nicht", wo: ".gitignore", tipp: "Zeile „.env“ ergänzen." });
  // 5) Tailscale Funnel = öffentlich im Internet?
  const ts = "/Applications/Tailscale.app/Contents/MacOS/Tailscale";
  if (fs.existsSync(ts)) {
    const out = await new Promise((res) => execFile(ts, ["funnel", "status"], { timeout: 6000 }, (e, o) => res(e ? "" : String(o))));
    if (/Funnel on/i.test(out)) funde.push({ stufe: "hoch", was: "Tailscale Funnel ist an: Friday ist öffentlich im Internet erreichbar", wo: "Tailscale", tipp: "Mit „tailscale funnel reset“ ausschalten. „serve“ (nur deine Geräte) reicht." });
    else if (out) hinweise.push("Tailscale Funnel ist aus – Friday ist nur für deine eigenen Geräte erreichbar.");
  }
  const reihen = { hoch: 0, mittel: 1, niedrig: 2 };
  funde.sort((a, b) => reihen[a.stufe] - reihen[b.stufe]);
  const ergebnis = { zeit: new Date().toISOString(), geprueft, funde, hinweise, stufe: funde.some((f) => f.stufe === "hoch") ? "hoch" : funde.length ? "mittel" : "ok" };
  eintragen({ bereich: "system", titel: `Datenleck-Wächter: ${funde.length ? `${funde.length} Hinweise` : "alles in Ordnung"}`, details: funde.map((f) => f.was).join(" · "), ok: !funde.some((f) => f.stufe === "hoch"), quelle: "dashboard" });
  return ergebnis;
}

export function reparieren(was) {
  try {
    if (was === "env-rechte") { fs.chmodSync(path.join(ROOT, ".env"), 0o600); return { ok: true, info: "server/.env ist jetzt nur für dich lesbar." }; }
    if (was === "data-rechte") { fs.chmodSync(DATA_DIR, 0o700); return { ok: true, info: "Der Datenordner ist jetzt nur für dich lesbar." }; }
  } catch (err) {
    return { error: `Ging nicht: ${err.message}` };
  }
  return { error: "Unbekannte Reparatur." };
}
