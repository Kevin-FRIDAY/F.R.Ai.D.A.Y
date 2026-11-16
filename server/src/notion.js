// Notion: Notizen per Sprache in eine Notion-Seite schreiben, in Notion suchen, Notizen vorlesen.
// Schlüssel: notion.so/profile/integrations → Neue interne Integration → "Internal Integration Secret".
// Danach die Notizen-Seite in Notion mit der Integration teilen (… → Verbindungen → Friday).
import { config } from "./config.js";
import * as V from "./verbindungen.js";
import { U } from "./datum.js";

const API = () => String(process.env.NOTION_API || "https://api.notion.com/v1").replace(/\/$/, "");
const VERSION = "2022-06-28";
const d = () => V.get("notion");
export const notionBereit = () => Boolean(d().token);

async function nt(method, pfad, body, tokenWunsch) {
  const t = tokenWunsch || d().token;
  if (!t) return { ok: false, error: "Notion ist noch nicht eingerichtet. Werkzeug-Menü → Verbindungen → Notion." };
  const r = await V.holeJson(`${API()}${pfad}`, { method, headers: { Authorization: `Bearer ${t}`, "Notion-Version": VERSION }, body });
  if (r.netz) return { ok: false, error: "Notion ist gerade nicht erreichbar." };
  if (r.status === 401) return { ok: false, status: 401, error: "Notion lehnt den Schlüssel ab. Kopier das Integration Secret nochmal." };
  if (r.status === 404) return { ok: false, status: 404, error: "Diese Notion-Seite ist für Friday nicht freigegeben. Teile sie in Notion mit deiner Integration." };
  if (r.status === 429) return { ok: false, status: 429, error: "Notion bremst gerade. Gleich nochmal versuchen." };
  if (!r.ok) return { ok: false, status: r.status, error: `Notion meldet: ${r.data?.message || r.status}` };
  return { ok: true, data: r.data };
}

function titelVon(seite) {
  const props = seite?.properties || {};
  for (const p of Object.values(props)) {
    if (p?.type === "title") return (p.title || []).map((x) => x.plain_text || "").join("").trim() || "Ohne Titel";
  }
  return "Ohne Titel";
}
const textVon = (block) => {
  const inhalt = block?.[block?.type];
  return Array.isArray(inhalt?.rich_text) ? inhalt.rich_text.map((x) => x.plain_text || "").join("").trim() : "";
};

async function seitenSuchen(query = "", tokenWunsch) {
  const r = await nt("POST", "/search", { query, filter: { property: "object", value: "page" }, page_size: 25 }, tokenWunsch);
  if (!r.ok) return r;
  return { ok: true, seiten: (r.data.results || []).map((s) => ({ id: s.id, titel: titelVon(s), url: s.url })) };
}

export async function notiz(text) {
  const inhalt = String(text || "").trim().slice(0, 1800);
  if (!inhalt) return { ok: false, error: "Was soll ich notieren?" };
  const seite = d().seite;
  if (!seite) return { ok: false, error: "Wähle im Verbindungen-Fenster bei Notion erst die Seite für Notizen." };
  const zeit = new Date().toLocaleString("de-DE", { timeZone: config.timezone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const r = await nt("PATCH", `/blocks/${seite}/children`, {
    children: [{ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: `${zeit} – ${inhalt}` } }] } }],
  });
  return r.ok ? { ok: true, text: `In Notion notiert: ${inhalt}` } : r;
}

export async function letzteNotizen(n = 5) {
  const seite = d().seite;
  if (!seite) return { ok: false, error: "Wähle im Verbindungen-Fenster bei Notion erst die Seite für Notizen." };
  const bloecke = [];
  let cursor = null;
  for (let i = 0; i < 10; i++) {
    const r = await nt("GET", `/blocks/${seite}/children?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!r.ok) return r;
    bloecke.push(...(r.data.results || []));
    if (!r.data.has_more) break;
    cursor = r.data.next_cursor;
  }
  const texte = bloecke.map(textVon).filter(Boolean).slice(-n);
  if (!texte.length) return { ok: true, text: "Auf deiner Notizen-Seite steht noch nichts." };
  return { ok: true, text: `Deine letzten Notizen: ${texte.map((x) => x.replace(/^\d{2}\.\d{2}\.?,? \d{2}:\d{2} – /, "")).join(". ")}.`, notizen: texte };
}

export async function suchen(q) {
  const r = await seitenSuchen(String(q || "").slice(0, 100));
  if (!r.ok) return r;
  if (!r.seiten.length) return { ok: true, text: `In Notion finde ich nichts zu „${q}“. Denk dran: Friday sieht nur Seiten, die du mit der Integration geteilt hast.` };
  const top = r.seiten[0];
  // Den Anfang der besten Seite vorlesen
  const b = await nt("GET", `/blocks/${top.id}/children?page_size=30`);
  const anfang = b.ok ? (b.data.results || []).map(textVon).filter(Boolean).slice(0, 4).map((x) => x.replace(/^\d{2}\.\d{2}\.?,? \d{2}:\d{2} – /, "").replace(/[.!?]$/, "")).join(". ").slice(0, 400) : "";
  const weitere = r.seiten.length > 1 ? ` Außerdem: ${V.aufzaehlen(r.seiten.slice(1, 4).map((s) => s.titel))}.` : "";
  return { ok: true, text: `In Notion: ${top.titel}.${anfang ? ` ${anfang}.` : ""}${weitere}`, seiten: r.seiten.slice(0, 10) };
}

export async function command({ action, value } = {}) {
  switch (String(action || "")) {
    case "notiz": return notiz(value);
    case "letzte": return letzteNotizen(Number(value) || 5);
    case "suchen": return suchen(value);
    case "seiten": {
      const r = await seitenSuchen("");
      if (!r.ok) return r;
      V.set("notion", { seiten: r.seiten.slice(0, 50).map(({ id, titel }) => ({ id, titel })) });
      return { ok: true, text: r.seiten.length ? `${r.seiten.length} freigegebene Seiten gefunden.` : "Noch keine Seite freigegeben. Teile in Notion eine Seite mit deiner Integration." };
    }
    default: return { ok: false, error: "Unbekannte Notion-Aktion." };
  }
}

// ---------- Fenster "Verbindungen" ----------
export const info = { id: "notion", name: "Notion", emoji: "🧠", kurz: "Notizen per Sprache und Wissen aus deinen Notion-Seiten." };

export async function status() {
  const x = d();
  const ein = notionBereit();
  const seite = (x.seiten || []).find((s) => s.id === x.seite);
  return {
    ...info,
    eingerichtet: ein,
    text: ein ? (seite ? `Verbunden · Notizen landen in „${seite.titel}“` : "Verbunden · wähle unten die Seite für Notizen") : "Nicht eingerichtet.",
    felder: ein ? [] : [{ name: "token", label: "Notion Integration Secret", typ: "password", platzhalter: "ntn_…" }],
    auswahl: ein ? [{ name: "seite", label: "Notizen-Seite", wert: x.seite || "", optionen: [{ wert: "", text: "– bitte wählen –" }, ...(x.seiten || []).map((s) => ({ wert: s.id, text: s.titel }))] }] : [],
    aktionen: ein ? [{ action: "seiten", text: "↻ Seiten laden" }, { action: "letzte", text: "📝 Letzte Notizen" }] : [],
  };
}
export async function einrichten({ token } = {}) {
  const t = String(token || "").trim();
  if (!V.schluesselOk(t, 20, 200)) return { ok: false, error: "Das Notion-Secret beginnt mit ntn_ oder secret_ und hat keine Leerzeichen." };
  const me = await nt("GET", "/users/me", null, t);
  if (!me.ok) return me;
  const s = await seitenSuchen("", t);
  const seiten = s.ok ? s.seiten.slice(0, 50).map(({ id, titel }) => ({ id, titel })) : [];
  const vorschlag = seiten.find((x) => /friday|notiz|notes|inbox|eingang/i.test(x.titel)) || (seiten.length === 1 ? seiten[0] : null);
  V.set("notion", { token: t, seiten, seite: vorschlag?.id });
  return { ok: true, text: seiten.length ? `Notion ist verbunden – ${seiten.length} freigegebene Seiten.${vorschlag ? ` Notizen landen in „${vorschlag.titel}“.` : " Wähle die Notizen-Seite aus."}` : "Notion ist verbunden. Teile jetzt in Notion eine Seite mit der Integration und tipp auf „Seiten laden“." };
}
export async function einstellen({ name, wert } = {}) {
  if (name === "seite") {
    if (wert && !(d().seiten || []).some((s) => s.id === wert)) return { ok: false, error: "Diese Seite kenne ich nicht." };
    V.set("notion", { seite: wert || undefined });
    return { ok: true };
  }
  return { ok: false, error: "Unbekannte Einstellung." };
}
export function vergessen() {
  V.clear("notion");
  return { ok: true };
}

// ---------- Sprachbefehle ohne Claude ----------
export async function quick(t, roh = t) {
  const nenntNotion = /\bnotion\b/.test(t);
  if (!notionBereit()) return nenntNotion ? "Notion ist noch nicht verbunden. Das geht im Werkzeug-Menü unter Verbindungen." : null;
  const sag = (r) => (r.ok ? r.text : r.error);
  let m;
  // Original-Schreibweise für den Notiz-Text
  const ausRoh = (stueck) => {
    const i = String(roh).toLowerCase().indexOf(stueck);
    return i >= 0 ? String(roh).slice(i, i + stueck.length) : stueck;
  };
  m = t.match(U(/^(?:notiz|neue notiz|notion notiz|notiz in notion)[: ]+(.+)$/))
    || t.match(U(/^(?:schreib|schreibe|notier|notiere|speicher|speichere) (?:in notion|bei notion|in meine notizen|in meinen notizen)[: ]+(.+)$/))
    || t.match(U(/^(?:schreib|schreibe|notier|notiere|speicher|speichere|pack|packe) (.+?) (?:in|zu|bei) (?:notion|meine notizen|meinen notizen)$/));
  if (m) return sag(await notiz(ausRoh(m[1].trim())));
  if (/^(lies|zeig|lies mir|zeig mir)( meine)? (letzten |neuesten )?notizen( vor| aus notion)?$|^(meine )?(letzten )?notion[- ]notizen$|^was habe ich (zuletzt )?notiert$/.test(t)) return sag(await letzteNotizen(5));
  m = t.match(U(/^(?:such|suche|finde|schau) (?:in|bei) notion (?:nach |über |ueber )?(.+)$/)) || t.match(U(/^(?:was steht|was weiß ich|was weiss ich|was habe ich) in notion (?:über|ueber|zu) (.+)$/)) || t.match(U(/^notion suche[: ]+(.+)$/));
  if (m) return sag(await suchen(m[1]));
  return null;
}
