// Freigabe-Glocke (v1.134.0, Idee aus OpenJarvis "Approval Bell").
// Riskante Aktionen (Löschen, Nachrichten an andere, Mac, Smart Home …) landen als Anfrage in der Glocke
// oben im Dashboard. Boss gibt sie dort frei – oder per Knopf direkt in Telegram.
// Die Anfragen selbst verwaltet kommando.js (Genehmigungsmanager), hier kommen Glocke, Telegram und Sprache dazu.
import { config } from "./config.js";
import * as kommando from "./kommando.js";
import { eintragen } from "./logbuch.js";

const api = (methode) => `https://api.telegram.org/bot${config.telegramToken}/${methode}`;
let runToolFn = null;
async function ausfuehren(werkzeug, eingabe) {
  if (!runToolFn) runToolFn = (await import("./tools.js")).runTool;
  return runToolFn(werkzeug, eingabe, { quelle: "freigabe", kanal: "freigabe" });
}

/** Kurze, lesbare Beschreibung, was die Aktion genau tun würde. */
export function beschreibe(g) {
  const e = g?.eingabe || {};
  const teile = [];
  for (const [k, v] of Object.entries(e)) {
    if (v == null || v === "") continue;
    const wert = typeof v === "object" ? JSON.stringify(v) : String(v);
    teile.push(`${k}: ${wert.slice(0, 140)}`);
    if (teile.length >= 5) break;
  }
  return teile.join(" · ");
}

function fuerDashboard(g) {
  return { id: g.id, status: g.status, werkzeug: g.werkzeug, titel: g.titel, was: beschreibe(g), kanal: g.kanal, grund: g.grund, erstellt: g.erstellt, entschieden: g.entschieden, ergebnis: g.ergebnis };
}

export function glockeStand() {
  const s = kommando.stand();
  return {
    offen: s.offen.map(fuerDashboard),
    erledigt: s.erledigt.slice(0, 12).map(fuerDashboard),
    autonomie: s.autonomie,
    stufe: s.stufe?.name,
    notfall: Boolean(s.notfall),
    immerFragen: s.immerFragen,
    fragbar: s.fragbar,
    telegram: Boolean(config.telegramToken && config.telegramChatId),
  };
}

export async function entscheiden(id, ja) {
  return kommando.entscheide(id, Boolean(ja), ausfuehren);
}

// ---------- Telegram: neue Anfrage mit zwei Knöpfen ----------
async function telegramMelden(g) {
  if (!config.telegramToken || !config.telegramChatId) return;
  const text = `🔔 Friday bittet um Freigabe\n${g.titel}${beschreibe(g) ? `\n${beschreibe(g)}` : ""}${g.grund ? `\nGrund: ${g.grund}` : ""}`;
  try {
    await fetch(api("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: text.slice(0, 3500),
        reply_markup: { inline_keyboard: [[{ text: "✅ Freigeben", callback_data: `frg:${g.id}:1` }, { text: "✋ Ablehnen", callback_data: `frg:${g.id}:0` }]] },
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.error("Freigabe an Telegram:", err.message);
  }
}

/** Knopfdruck in Telegram (callback_query). Gibt true zurück, wenn es eine Freigabe war. */
export async function telegramKnopf(cb) {
  const daten = String(cb?.data || "");
  const m = daten.match(/^frg:([a-z0-9]+):([01])$/i);
  if (!m) return false;
  const chatId = String(cb.message?.chat?.id || "");
  const antworte = (text) => fetch(api("answerCallbackQuery"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: cb.id, text: text.slice(0, 190) }) }).catch(() => {});
  if (chatId !== String(config.telegramChatId)) { await antworte("Nicht erlaubt."); return true; }
  const r = await entscheiden(m[1], m[2] === "1");
  const text = r.error ? r.error : m[2] === "1" ? (r.ok ? "Freigegeben und erledigt." : `Freigegeben, aber: ${String(r.ergebnis?.error || "hat nicht geklappt")}`) : "Abgelehnt.";
  await antworte(text);
  // Die Nachricht aktualisieren, damit die Knöpfe verschwinden.
  try {
    await fetch(api("editMessageText"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: cb.message?.message_id, text: `${String(cb.message?.text || "").slice(0, 3000)}\n\n→ ${text}` }),
    });
  } catch { /* egal */ }
  return true;
}

export function freigabenStart() {
  kommando.beiNeuerFreigabe((g) => telegramMelden(g));
}

// ---------- Sprache: "Friday, gib frei" / "lehne ab" / "was wartet auf Freigabe?" ----------
const norm = (t) => String(t || "").toLowerCase().replace(/[.!?,]/g, " ").replace(/\s+/g, " ").trim().replace(/^(hey |hallo |ok |okay )?friday /, "");

export async function quickCommand(text) {
  const t = norm(text);
  if (!t || t.length > 80) return null;
  const offen = kommando.stand().offen;
  if (/^(was|welche (aktionen|anfragen|freigaben)) (wartet|warten|liegt|liegen|ist|sind)( noch)? (auf|in) (meine |der |die )?(freigabe|glocke)|^(zeig|öffne)( mir)? (die )?(freigabe[- ]?glocke|glocke|freigaben)$|^offene freigaben$/.test(t)) {
    if (!offen.length) return { answer: "In der Glocke wartet gerade nichts, Boss.", actions: ["glocke"] };
    const liste = offen.slice(-3).map((g) => g.titel).join(", ");
    return { answer: `${offen.length === 1 ? "Eine Aktion wartet" : `${offen.length} Aktionen warten`} auf deine Freigabe: ${liste}. Sag "gib frei" oder "lehne ab", oder tipp auf die Glocke.`, actions: ["glocke"] };
  }
  const ja = /^(gib (das |es |sie )?frei|freigeben|ich gebe (das |es )?frei|erlaube (das|es)|erlaubt|genehmigt|genehmige (das|es)|ja,? (mach|gib frei|freigeben))$/.test(t);
  const nein = /^(lehne (das |es |sie )?ab|ablehnen|abgelehnt|nicht freigeben|verweigert|nein,? (nicht|lass das))$/.test(t);
  if (!ja && !nein) return null;
  if (!offen.length) return { answer: "Es wartet gerade keine Aktion auf eine Freigabe.", actions: ["glocke"] };
  const g = offen[offen.length - 1];
  const r = await entscheiden(g.id, ja);
  eintragen({ bereich: "system", titel: `Per Sprache ${ja ? "freigegeben" : "abgelehnt"}: ${g.titel}`, quelle: "sprache" });
  if (r.error) return { answer: r.error, actions: ["glocke"] };
  if (!ja) return { answer: `In Ordnung, ${g.titel} lasse ich bleiben.`, actions: ["glocke"] };
  const fehler = r.ergebnis?.error;
  return { answer: fehler ? `Freigegeben, aber das hat nicht geklappt: ${fehler}` : `Freigegeben. ${g.titel} ist erledigt.`, actions: ["glocke"] };
}

export function freigabenRouten(app, asyncRoute) {
  app.get("/api/glocke", (req, res) => res.json(glockeStand()));
  app.post("/api/glocke/:id", asyncRoute(async (req, res) => {
    const r = await entscheiden(req.params.id, req.body?.ja === true || req.body?.ja === 1 || req.body?.ja === "1");
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ ...glockeStand(), ergebnis: r.ergebnis ?? null, ok: r.ok });
  }));
  app.post("/api/glocke-regel", (req, res) => {
    const r = kommando.setzeImmerFragen(String(req.body?.werkzeug || ""), Boolean(req.body?.an));
    if (r.error) return res.status(400).json(r);
    res.json(glockeStand());
  });
}
