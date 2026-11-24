// Eigene Mediathek – Jellyfin oder Plex (v1.160.0, Wunsch aus der Ideen-Schmiede).
// "Friday, spiel Iron Man" sucht in deiner eigenen Film-Sammlung auf dem Mac. Läuft ein Jellyfin-Abspieler
// (z. B. Jellyfin-App auf dem Samsung-TV), startet Friday den Film direkt dort; sonst gibt es den Link
// zum Abspielen im Browser. Zugang: Server-Adresse + Schlüssel (Jellyfin: Dashboard → API-Schlüssel,
// Plex: X-Plex-Token). Liegt in data/verbindungen.json ("mediathek"), wird nie ans Dashboard geschickt.
import * as verb from "./verbindungen.js";
import * as logbuch from "./logbuch.js";
import { U } from "./datum.js";
import { holen, sauber } from "./wunsch-hilfe.js";

const cfg = () => ({ art: "jellyfin", url: "", key: "", ...verb.get("mediathek") });
export const eingerichtet = () => { const c = cfg(); return Boolean(c.url && c.key); };
export function status() { const c = cfg(); return { eingerichtet: eingerichtet(), art: c.art, url: c.url }; }

export async function einrichten({ art = "jellyfin", url = "", key = "" } = {}) {
  const a = art === "plex" ? "plex" : "jellyfin";
  const u = String(url || "").trim().replace(/\/+$/, "") || (a === "plex" ? "http://127.0.0.1:32400" : "http://127.0.0.1:8096");
  if (!/^https?:\/\//.test(u)) throw new Error("Bitte die Adresse mit http:// angeben, z. B. http://127.0.0.1:8096");
  const k = String(key || "").trim() || cfg().key;
  if (!k) throw new Error(a === "plex" ? "Bitte den X-Plex-Token eintragen." : "Bitte einen Jellyfin-API-Schlüssel eintragen (Dashboard → API-Schlüssel → +).");
  const probe = await test({ art: a, url: u, key: k });
  verb.set("mediathek", { art: a, url: u, key: k });
  logbuch.eintragen({ bereich: "verbindung", titel: `Mediathek verbunden (${a === "plex" ? "Plex" : "Jellyfin"})`, details: probe.name });
  return { ...status(), name: probe.name };
}
export function vergessen() { verb.clear?.("mediathek"); return true; }

async function test({ art, url, key }) {
  if (art === "plex") {
    const d = await holen(`${url}/identity`, { headers: { Accept: "application/json", "X-Plex-Token": key } });
    return { name: d.MediaContainer?.friendlyName || "Plex", id: d.MediaContainer?.machineIdentifier };
  }
  const d = await holen(`${url}/System/Info`, { headers: { "X-Emby-Token": key } });
  return { name: d.ServerName || "Jellyfin", id: d.Id };
}

/** Suche in der eigenen Sammlung. */
export async function suchen(q, limit = 12, timeout = 12000) {
  const c = cfg();
  if (!eingerichtet()) throw new Error("Die Mediathek ist noch nicht verbunden.");
  const s = String(q || "").trim().slice(0, 100);
  if (c.art === "plex") {
    const d = await holen(`${c.url}/hubs/search?query=${encodeURIComponent(s)}&limit=${limit}`, { timeout, headers: { Accept: "application/json", "X-Plex-Token": c.key } });
    const id = (await test(c)).id;
    return (d.MediaContainer?.Hub || []).flatMap((h) => h.Metadata || []).filter((m) => ["movie", "show", "episode"].includes(m.type)).slice(0, limit).map((m) => ({
      id: m.ratingKey, titel: m.title, jahr: m.year || null, art: m.type === "movie" ? "Film" : m.type === "show" ? "Serie" : "Folge",
      text: String(m.summary || "").slice(0, 220),
      bild: m.thumb ? `/api/wunsch/mediathek/bild?pfad=${encodeURIComponent(m.thumb)}` : "",
      link: `${c.url}/web/index.html#!/server/${id}/details?key=${encodeURIComponent(`/library/metadata/${m.ratingKey}`)}`,
    }));
  }
  const d = await holen(`${c.url}/Items?searchTerm=${encodeURIComponent(s)}&Recursive=true&IncludeItemTypes=Movie,Series,Episode&Limit=${limit}&Fields=Overview,ProductionYear`, { timeout, headers: { "X-Emby-Token": c.key } });
  return (d.Items || []).map((m) => ({
    id: m.Id, titel: m.Name, jahr: m.ProductionYear || null, art: m.Type === "Movie" ? "Film" : m.Type === "Series" ? "Serie" : "Folge",
    text: String(m.Overview || "").slice(0, 220),
    bild: m.ImageTags?.Primary ? `/api/wunsch/mediathek/bild?pfad=${encodeURIComponent(`/Items/${m.Id}/Images/Primary?maxHeight=300`)}` : "",
    link: `${c.url}/web/index.html#!/details?id=${m.Id}`,
  }));
}

/** Bild über Friday holen (damit der Schlüssel nicht im Browser landet). */
export async function bild(pfad) {
  const c = cfg();
  const p = String(pfad || "");
  if (!eingerichtet() || !p.startsWith("/") || p.includes("..")) throw new Error("Ungültig.");
  const r = await fetch(`${c.url}${p}`, { headers: c.art === "plex" ? { "X-Plex-Token": c.key } : { "X-Emby-Token": c.key }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Bild ${r.status}`);
  return { typ: r.headers.get("content-type") || "image/jpeg", daten: Buffer.from(await r.arrayBuffer()) };
}

/** Abspieler, die Jellyfin fernsteuern kann (TV-App, Browser …). */
export async function abspieler() {
  const c = cfg();
  if (!eingerichtet() || c.art !== "jellyfin") return [];
  const d = await holen(`${c.url}/Sessions?ControllableByUserId=`, { headers: { "X-Emby-Token": c.key } }).catch(() => []);
  return (Array.isArray(d) ? d : []).filter((s) => s.SupportsRemoteControl).map((s) => ({ id: s.Id, name: `${s.DeviceName || "Gerät"} (${s.Client || "Jellyfin"})`, tv: /tv|samsung|tizen|lg|android ?tv|fire/i.test(`${s.DeviceName} ${s.Client}`) }));
}

/** Startet einen Titel auf einem Abspieler (Standard: Fernseher, falls einer läuft). */
export async function abspielen({ id, geraet = "" } = {}) {
  const c = cfg();
  if (c.art !== "jellyfin") return { ok: false, hinweis: "Mit Plex öffnet Friday den Titel im Browser." };
  const liste = await abspieler();
  const ziel = liste.find((s) => s.id === geraet) || liste.find((s) => s.tv) || liste[0];
  if (!ziel) return { ok: false, hinweis: "Ich sehe keinen laufenden Jellyfin-Abspieler. Öffne die Jellyfin-App auf dem Fernseher, dann kann ich dort starten." };
  const r = await fetch(`${c.url}/Sessions/${ziel.id}/Playing?playCommand=PlayNow&itemIds=${encodeURIComponent(id)}`, { method: "POST", headers: { "X-Emby-Token": c.key }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) return { ok: false, hinweis: `Jellyfin hat den Start abgelehnt (${r.status}).` };
  logbuch.eintragen({ bereich: "mediathek", titel: `Mediathek: Start auf ${ziel.name}` });
  return { ok: true, geraet: ziel.name };
}

const SPIEL = U(/^(?:spiel|spiele|starte)(?: mir)?(?: den film| die serie| den| die| das)? (.{2,80}?)(?: aus meiner (?:mediathek|sammlung)| von meinem server| auf dem fernseher| auf dem tv| an)?$/);
const SUCH = U(/\b(?:habe ich|hab ich|gibt es) (.{2,60}) in meiner (?:mediathek|sammlung|filmsammlung)\b|\b(?:öffne|oeffne|zeig)(?: mir)? (?:meine )?(?:mediathek|filmsammlung|jellyfin|plex)\b/);
export async function quickCommand(text) {
  if (!eingerichtet()) {
    const { k } = sauber(text);
    if (/\b(mediathek|jellyfin|plex|filmsammlung)\b/.test(k)) return { answer: "Die Mediathek ist noch nicht verbunden. Trag im Fenster Wunschliste unter Mediathek deine Jellyfin- oder Plex-Adresse und den Schlüssel ein.", actions: ["wunsch:mediathek"] };
    return null;
  }
  const { k } = sauber(text);
  const s = k.match(SUCH);
  if (s) {
    if (!s[1]) return { answer: "Deine Mediathek ist offen.", actions: ["wunsch:mediathek"] };
    const t = await suchen(s[1], 5, 4000).catch(() => []);
    return { answer: t.length ? `Ja, ich habe ${t.length === 1 ? "einen Treffer" : `${t.length} Treffer`}: ${t.slice(0, 3).map((x) => `${x.titel}${x.jahr ? ` von ${x.jahr}` : ""}`).join(", ")}.` : `Nein, ${s[1]} finde ich nicht in deiner Sammlung.`, actions: [`wunsch:mediathek:${encodeURIComponent(s[1])}`] };
  }
  const m = k.match(SPIEL);
  if (!m || /\b(musik|playlist|lied|song|radio|spotify|youtube|netflix|spiel(e)? (mit|gegen))\b/.test(k)) return null;
  const treffer = await suchen(m[1], 5, 3000).catch(() => []);
  if (!treffer.length) return null; // nicht in der Sammlung → andere Befehle (Netflix, YouTube …) dürfen ran
  const t = treffer[0];
  const r = await abspielen({ id: t.id }).catch((err) => ({ ok: false, hinweis: err.message }));
  return { answer: r.ok ? `Ich starte ${t.titel} auf ${r.geraet}.` : `${t.titel} habe ich gefunden. ${r.hinweis}`, actions: [`wunsch:mediathek:${encodeURIComponent(m[1])}`] };
}
