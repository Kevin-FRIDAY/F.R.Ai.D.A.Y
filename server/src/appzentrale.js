// App-Zentrale (v1.139.0, zuerst nur in Eve): 21 Apps und Dienste an einem Ort.
// Ehrlich nach drei Stufen:
//   "echt"  – Friday liest echte Daten (Kalender, Erinnerungen, Fotos, Musik, Kurzbefehle, Drive, OneDrive, GitHub, Spotify, Alexa, YouTube)
//   "mac"   – Friday öffnet die App am Mac oder startet sie am Fernseher (Netflix, Prime Video, Disney+, Apple TV)
//   "link"  – es gibt keine offene Schnittstelle, Friday öffnet nur die Seite/App (Ring, Arlo, PayPal, Amazon, eBay, Google Pay)
// Feste Grenzen: Friday bezahlt, kauft, bietet oder überweist NIE selbst. Ring/Arlo: nur Kevins eigene Kameras.
// In Eve wird alles, was am Mac/TV etwas auslöst (öffnen, Kurzbefehl starten), nur simuliert und ins Logbuch geschrieben.
import { config, IST_EVE } from "./config.js";
import { isAgentOnline, sendToAgent } from "./agent-hub.js";
import { githubToken } from "./updater.js";
import { simuliereWerkzeug } from "./eve-schutz.js";
import { istFrei } from "./eve.js";
import { eintragen } from "./logbuch.js";
import * as kalender from "./kalender.js";
import * as apple from "./apple.js";
import * as spotify from "./spotify.js";
import * as alexa from "./alexa.js";
import { openApp as tvOpenApp, tvConfigured } from "./fernseher.js";

export const FUNKTION_ID = "app-zentrale";
const boss = () => config.userName || "Boss";
/** In Friday erst nach Freigabe in Eve benutzbar. */
export const frei = () => IST_EVE || istFrei(FUNKTION_ID);

export const GRUPPEN = [
  { id: "apple", name: "Apple" },
  { id: "cloud", name: "Cloud & Code" },
  { id: "film", name: "Filme & Musik" },
  { id: "zuhause", name: "Zuhause" },
  { id: "shop", name: "Einkaufen & Bezahlen" },
];

// art: echt | mac | link. web = Seite im Browser, ios = App-Adresse fürs iPhone, mac = Mac-App, tv = App am Fernseher.
export const APPS = [
  { id: "kalender", name: "Apple Kalender", gruppe: "apple", art: "echt", farbe: "#ff3b30", zeichen: "31", web: "https://www.icloud.com/calendar", ios: "calshow://", mac: "Calendar", worte: ["kalender", "apple kalender", "kalender app"], kann: "Liest deine Termine von heute und morgen (iCloud, über den Mac). Neue Termine per Sprache: „Friday, trag morgen 10 Uhr Zahnarzt ein“." },
  { id: "erinnerungen", name: "Apple Erinnerungen", gruppe: "apple", art: "echt", farbe: "#ff9500", zeichen: "☑", web: "https://www.icloud.com/reminders", ios: "x-apple-reminderkit://", mac: "Reminders", worte: ["erinnerungen", "apple erinnerungen"], kann: "Zeigt deine offenen Erinnerungen. Neue per Sprache: „Friday, erinnere mich an Müll rausbringen“." },
  { id: "fotos", name: "Apple Fotos", gruppe: "apple", art: "echt", farbe: "#f7c948", zeichen: "✿", web: "https://www.icloud.com/photos", ios: "photos-redirect://", mac: "Photos", worte: ["fotos", "apple fotos", "fotos app", "foto app", "fotomediathek"], kann: "Zählt deine Fotos und zeigt deine Alben (über den Mac, alles bleibt auf dem Mac). Fridays eigene Fotos liegen im Archiv." },
  { id: "musik", name: "Apple Music", gruppe: "apple", art: "echt", farbe: "#fa2d48", zeichen: "♫", web: "https://music.apple.com", ios: "music://", mac: "Music", worte: ["apple music", "musik app", "itunes"], kann: "Was läuft gerade, Playlists aus deiner Mediathek abspielen (über den Mac). Mehr im Fenster Apple-Apps." },
  { id: "kurzbefehle", name: "Apple Kurzbefehle", gruppe: "apple", art: "echt", farbe: "#5e5ce6", zeichen: "⌘", web: "https://support.apple.com/de-de/guide/shortcuts-mac/welcome/mac", ios: "shortcuts://", mac: "Shortcuts", worte: ["kurzbefehle", "shortcuts", "apple kurzbefehle"], kann: "Listet deine Kurzbefehle am Mac und startet sie: „Friday, starte Kurzbefehl Guten Morgen“." },
  { id: "appletv", name: "Apple TV", gruppe: "film", art: "mac", farbe: "#a2aaad", zeichen: "tv", web: "https://tv.apple.com", ios: "videos://", mac: "TV", tv: "appletv", worte: ["apple tv", "apple tv plus", "apple tv+", "tv app"], kann: "Öffnet Apple TV am Mac, auf dem iPhone oder startet die App am Samsung-Fernseher." },
  { id: "gdrive", name: "Google Drive", gruppe: "cloud", art: "echt", farbe: "#1fa463", zeichen: "▲", web: "https://drive.google.com", ios: "googledrive://", worte: ["google drive", "drive", "gdrive"], kann: "Zeigt deine zuletzt geänderten Dateien, wenn „Google Drive für den Mac“ installiert ist. Sonst öffnet Friday drive.google.com." },
  { id: "onedrive", name: "OneDrive", gruppe: "cloud", art: "echt", farbe: "#0078d4", zeichen: "☁", web: "https://onedrive.live.com", ios: "ms-onedrive://", worte: ["onedrive", "one drive"], kann: "Zeigt deine zuletzt geänderten Dateien, wenn die OneDrive-App am Mac läuft. Sonst öffnet Friday onedrive.live.com." },
  { id: "github", name: "GitHub", gruppe: "cloud", art: "echt", farbe: "#8b949e", zeichen: "⌥", web: "https://github.com", worte: ["github", "git hub"], kann: "Zeigt Fridays Repo: neueste Änderungen, offene Aufträge und Eve-Wünsche (nur lesen)." },
  { id: "youtube", name: "YouTube", gruppe: "film", art: "echt", farbe: "#ff0000", zeichen: "▶", web: "https://www.youtube.com", ios: "youtube://", tv: "youtube", worte: ["youtube", "you tube"], kann: "Sucht Videos direkt hier im Fenster. Öffnen am Mac, iPhone oder Fernseher." },
  { id: "netflix", name: "Netflix", gruppe: "film", art: "mac", farbe: "#e50914", zeichen: "N", web: "https://www.netflix.com", ios: "nflx://", tv: "netflix", worte: ["netflix"], kann: "Netflix hat keine offene Schnittstelle. Friday öffnet es am Mac/iPhone oder startet es am Fernseher." },
  { id: "spotify", name: "Spotify", gruppe: "film", art: "echt", farbe: "#1db954", zeichen: "◉", web: "https://open.spotify.com", ios: "spotify://", tv: "spotify", worte: ["spotify"], kann: "Was läuft, Pause, Weiter, Playlists per Sprache (Verbindung im Fenster Verbindungen)." },
  { id: "prime", name: "Prime Video", gruppe: "film", art: "mac", farbe: "#00a8e1", zeichen: "P", web: "https://www.primevideo.com", ios: "aiv://", tv: "prime", worte: ["prime video", "amazon prime video", "amazon prime"], kann: "Keine offene Schnittstelle. Friday öffnet Prime Video am Mac/iPhone oder startet es am Fernseher." },
  { id: "disney", name: "Disney+", gruppe: "film", art: "mac", farbe: "#113ccf", zeichen: "D+", web: "https://www.disneyplus.com", ios: "disneyplus://", tv: "disney", worte: ["disney", "disney plus", "disney+", "disneyplus"], kann: "Keine offene Schnittstelle. Friday öffnet Disney+ am Mac/iPhone oder startet es am Fernseher." },
  { id: "alexa", name: "Amazon Alexa", gruppe: "zuhause", art: "echt", farbe: "#00caff", zeichen: "◯", web: "https://alexa.amazon.de", worte: ["alexa", "amazon alexa", "alexa app"], kann: "Routinen auslösen und Ansagen auf deinen Echos (über Voice Monkey, Fenster Alexa)." },
  { id: "ring", name: "Ring", gruppe: "zuhause", art: "link", farbe: "#1998d5", zeichen: "◎", web: "https://account.ring.com/account/dashboard", ios: "ring://", worte: ["ring", "ring kamera", "ring app", "ring klingel", "türklingel"], kann: "Ring hat keine offene Schnittstelle für eigene Programme. Friday öffnet deine Ring-App/Seite. Nur deine eigenen Kameras." },
  { id: "arlo", name: "Arlo", gruppe: "zuhause", art: "link", farbe: "#00b388", zeichen: "◉", web: "https://my.arlo.com", ios: "arlo://", worte: ["arlo", "arlo kamera", "arlo app"], kann: "Arlo hat keine offene Schnittstelle für eigene Programme. Friday öffnet my.arlo.com. Nur deine eigenen Kameras." },
  { id: "paypal", name: "PayPal", gruppe: "shop", art: "link", farbe: "#003087", zeichen: "P", web: "https://www.paypal.com/myaccount/summary", ios: "paypal://", geld: true, worte: ["paypal", "pay pal"], kann: "Öffnet dein PayPal-Konto zum Nachsehen. Friday bezahlt und überweist nie selbst." },
  { id: "amazon", name: "Amazon", gruppe: "shop", art: "link", farbe: "#ff9900", zeichen: "a", web: "https://www.amazon.de", ios: "com.amazon.mobile.shopping://", geld: true, worte: ["amazon", "amazon shop", "amazon bestellungen"], extra: [{ text: "📦 Meine Bestellungen", url: "https://www.amazon.de/gp/css/order-history" }], kann: "Öffnet Amazon oder deine Bestellungen. Friday kauft nie selbst ein." },
  { id: "ebay", name: "eBay", gruppe: "shop", art: "link", farbe: "#e53238", zeichen: "e", web: "https://www.ebay.de", ios: "ebay://", geld: true, worte: ["ebay", "e bay"], extra: [{ text: "🧾 Meine Käufe", url: "https://www.ebay.de/mye/myebay/purchase" }], kann: "Öffnet eBay oder deine Käufe. Friday bietet und kauft nie selbst." },
  { id: "googlepay", name: "Google Pay", gruppe: "shop", art: "link", farbe: "#4285f4", zeichen: "G", web: "https://pay.google.com", geld: true, worte: ["google pay", "google wallet", "gpay"], kann: "Öffnet Google Pay zum Nachsehen. Friday bezahlt nie selbst." },
];
const nachId = new Map(APPS.map((a) => [a.id, a]));

const ART_TEXT = { echt: "Echte Daten", mac: "Öffnen & Starten", link: "Nur öffnen" };
const mitZeit = (p, ms = 8000) => Promise.race([p, new Promise((r) => setTimeout(() => r({ ok: false, error: "Hat zu lange gedauert." }), ms))]);
const macAus = () => `Der Mac ist gerade nicht verbunden, ${boss()}.`;
const fehlerText = (r, app) => {
  const e = String(r?.error || "");
  if (/Unbekannte Aktion/.test(e)) return "Der Mac-Agent ist noch auf einem alten Stand. Starte Friday einmal neu, dann klappt es.";
  if (/-1743|not allowed|nicht erlaubt|Not authorized/i.test(e)) return `macOS erlaubt Friday den Zugriff auf ${app} noch nicht. Systemeinstellungen → Datenschutz & Sicherheit → Automation → node erlauben.`;
  if (/shortcuts.*(not found|ENOENT)|ENOENT/i.test(e)) return "Die Kurzbefehle-App gibt es auf diesem Mac nicht (ab macOS 12).";
  return e || "Das hat nicht geklappt.";
};

// Was in der Kachel steht – schnell, ohne den Mac zu bemühen.
function kurzStatus(a) {
  const mac = isAgentOnline();
  switch (a.id) {
    case "kalender": case "erinnerungen": return kalender.kalenderBereit() ? { an: true, text: "Über den Mac verbunden" } : { an: false, text: mac ? "Im Fenster Verbindungen ausgeschaltet" : "Mac nicht verbunden" };
    case "fotos": case "musik": case "kurzbefehle": case "gdrive": case "onedrive": return { an: mac, text: mac ? "Über den Mac" : "Mac nicht verbunden" };
    case "spotify": return spotify.spotifyVerbunden() ? { an: true, text: "Verbunden" } : { an: false, text: "Noch nicht verbunden" };
    case "alexa": return alexa.alexaConfigured() ? { an: true, text: "Über Voice Monkey" } : { an: false, text: "Noch nicht verbunden" };
    case "github": return { an: true, text: githubToken() ? "Mit Schlüssel" : "Öffentlich lesen" };
    case "youtube": return { an: true, text: config.googleKey ? "Suche mit API" : "Suche ohne Schlüssel" };
    default: return { an: a.art !== "link" && (mac || (a.tv && tvConfigured())), text: a.art === "link" ? "Öffnet App oder Seite" : [mac ? "Mac" : null, a.tv && tvConfigured() ? "Fernseher" : null].filter(Boolean).join(" + ") || "Öffnet im Browser" };
  }
}

export function liste() {
  return {
    eve: IST_EVE,
    frei: frei(),
    mac: isAgentOnline(),
    tv: tvConfigured(),
    gruppen: GRUPPEN,
    apps: APPS.map((a) => ({
      id: a.id, name: a.name, gruppe: a.gruppe, art: a.art, artText: ART_TEXT[a.art], farbe: a.farbe, zeichen: a.zeichen,
      web: a.web, ios: a.ios || null, extra: a.extra || [], kann: a.kann, geld: Boolean(a.geld),
      amMac: Boolean(a.mac || a.web), amTv: Boolean(a.tv), ...kurzStatus(a),
    })),
  };
}

// ---------- Details (echte Daten, nur lesen – darum auch in Eve echt) ----------
async function github() {
  const repo = config.updateRepo;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return { error: "UPDATE_REPO in der .env ist ungültig." };
  const tok = githubToken();
  const h = { Accept: "application/vnd.github+json", "User-Agent": "Friday-Apps", "X-GitHub-Api-Version": "2022-11-28", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) };
  const hol = (p) => fetch(`https://api.github.com/repos/${repo}${p}`, { headers: h, signal: AbortSignal.timeout(10000) }).then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
  try {
    const [info, commits, issues] = await Promise.all([hol(""), hol("/commits?per_page=6"), hol("/issues?state=open&per_page=10")]);
    return {
      repo, url: info.html_url, privat: Boolean(info.private), sterne: info.stargazers_count || 0,
      commits: (commits || []).map((c) => ({ text: String(c.commit?.message || "").split("\n")[0].slice(0, 120), zeit: c.commit?.author?.date || null, url: c.html_url })),
      auftraege: (issues || []).filter((i) => !i.pull_request).map((i) => ({ nr: i.number, titel: i.title, url: i.html_url, eve: (i.labels || []).some((l) => l.name === "eve-wunsch") })),
      pullRequests: (issues || []).filter((i) => i.pull_request).map((i) => ({ nr: i.number, titel: i.title, url: i.html_url })),
    };
  } catch (err) {
    const c = err.message;
    return { error: c === "404" ? "GitHub findet das Repo nicht (privat? Dann braucht Friday den GitHub-Schlüssel aus Einstellungen → Immer aktuell)." : c === "401" ? "Der GitHub-Schlüssel ist abgelaufen." : c === "403" ? "GitHub bremst gerade (zu viele Abfragen). Gleich nochmal." : "GitHub ist gerade nicht erreichbar." };
  }
}

export async function youtubeSuche(q) {
  const text = String(q || "").trim().slice(0, 100);
  if (!text) return { videos: [] };
  if (config.googleKey) {
    try {
      const p = new URLSearchParams({ part: "snippet", q: text, type: "video", maxResults: "8", key: config.googleKey, regionCode: "DE", relevanceLanguage: "de" });
      const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${p}`, { signal: AbortSignal.timeout(10000) });
      if (r.ok) {
        const d = await r.json();
        return { videos: (d.items || []).filter((i) => i.id?.videoId).map((i) => ({ id: i.id.videoId, titel: i.snippet?.title || "", kanal: i.snippet?.channelTitle || "", bild: i.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${i.id.videoId}/mqdefault.jpg` })) };
      }
    } catch { /* ohne Schlüssel weiter */ }
  }
  try {
    const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(text)}`, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/537.36 Chrome/120 Safari/537.36", "Accept-Language": "de,en" }, signal: AbortSignal.timeout(10000) });
    const html = r.ok ? await r.text() : "";
    const videos = [];
    for (const m of html.matchAll(/"videoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})".{0,1500}?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/g)) {
      if (videos.some((v) => v.id === m[1])) continue;
      let titel = m[2];
      try { titel = JSON.parse(`"${m[2]}"`); } catch { /* roh */ }
      videos.push({ id: m[1], titel, kanal: "", bild: `https://i.ytimg.com/vi/${m[1]}/mqdefault.jpg` });
      if (videos.length >= 8) break;
    }
    return { videos, ohneSchluessel: true };
  } catch {
    return { videos: [], error: "YouTube ist gerade nicht erreichbar." };
  }
}

export async function details(id) {
  const a = nachId.get(id);
  if (!a) return { error: "Diese App kenne ich nicht." };
  const basis = { id, name: a.name, kann: a.kann, ...kurzStatus(a) };
  const macNoetig = ["kalender", "erinnerungen", "fotos", "musik", "kurzbefehle", "gdrive", "onedrive"];
  if (macNoetig.includes(id) && !isAgentOnline()) return { ...basis, hinweis: macAus() };
  switch (id) {
    case "kalender": {
      const [h, m] = await Promise.all([mitZeit(kalender.termine(0, 1), 20000), mitZeit(kalender.termine(1, 1), 20000)]);
      if (!h.ok) return { ...basis, hinweis: h.error };
      const z = (t) => ({ titel: t.titel, start: t.start, ganz: t.ganz, kalender: t.kalender });
      return { ...basis, heute: (h.termine || []).map(z), morgen: (m.termine || []).map(z) };
    }
    case "erinnerungen": {
      const r = await mitZeit(kalender.erinnerungen(), 20000);
      if (!r.ok) return { ...basis, hinweis: r.error };
      return { ...basis, erinnerungen: (r.erinnerungen || []).slice(0, 40) };
    }
    case "fotos": {
      const r = await mitZeit(sendToAgent("fotos_info", { value: "{}" }, 90000), 90000);
      if (!r.ok) return { ...basis, hinweis: fehlerText(r, "Fotos") };
      return { ...basis, anzahl: r.anzahl, alben: r.alben || [] };
    }
    case "musik": {
      const [s, p] = await Promise.all([mitZeit(apple.musikStatus(), 20000), mitZeit(apple.musikPlaylists(), 30000)]);
      return { ...basis, jetzt: s?.error ? null : s, playlists: (p?.playlists || []).slice(0, 30), hinweis: s?.error || p?.error || "" };
    }
    case "kurzbefehle": {
      const r = await mitZeit(sendToAgent("kurzbefehle_liste", { value: "{}" }, 25000), 25000);
      if (!r.ok) return { ...basis, hinweis: fehlerText(r, "Kurzbefehle") };
      return { ...basis, kurzbefehle: r.kurzbefehle || [], gesamt: r.gesamt || 0 };
    }
    case "gdrive": case "onedrive": {
      const r = await mitZeit(sendToAgent("cloud_ordner", { value: JSON.stringify({ dienst: id }) }, 30000), 30000);
      if (!r.ok) return { ...basis, hinweis: fehlerText(r, a.name) };
      if (!r.gefunden) return { ...basis, hinweis: `${a.name} ist auf deinem Mac nicht installiert. Mit der Mac-App (${id === "gdrive" ? "„Google Drive für den Mac“" : "„OneDrive“ aus dem App Store"}) zeigt Friday hier deine neuesten Dateien. Bis dahin: öffnen im Browser.` };
      return { ...basis, ordner: r.ordner, dateien: r.dateien || [] };
    }
    case "github": return { ...basis, ...(await github()) };
    case "spotify": {
      if (!spotify.spotifyVerbunden()) return { ...basis, hinweis: "Spotify ist noch nicht verbunden. Werkzeug-Menü → Verbindungen → Spotify." };
      const j = await mitZeit(spotify.jetzt(), 10000).catch(() => null);
      return { ...basis, jetzt: j && !j.error ? j : null };
    }
    case "alexa": {
      if (!alexa.alexaConfigured()) return { ...basis, hinweis: "Alexa ist noch nicht verbunden. Werkzeug-Menü → Alexa (Anleitung 13)." };
      const s = await alexa.status();
      return { ...basis, routinen: (s.routinen || []).map((r) => r.name).slice(0, 30), lautsprecher: (s.lautsprecher || []).map((l) => l.name).slice(0, 20) };
    }
    case "ring": case "arlo": return { ...basis, hinweis: `Eigene Kameras: Wenn deine ${a.name}-Kamera einen RTSP- oder Schnappschuss-Link anbietet, kannst du sie in der Kamera-Wache eintragen. Fremde Kameras nie.` };
    default:
      if (a.geld) return { ...basis, hinweis: "Friday bezahlt, kauft, bietet und überweist nie selbst. Hier nur öffnen und selbst entscheiden." };
      return basis;
  }
}

// ---------- Aktionen (lösen am Mac/TV etwas aus → in Eve nur simuliert) ----------
function simuliert(was, input) {
  const s = simuliereWerkzeug(`apps:${was}`, input);
  return { ok: true, eve_simuliert: true, text: `Eve-Test: ${input.app || input.name || ""} – „${was}“ wurde nur simuliert. In Friday passiert es echt.` , info: s.info };
}

export async function aktion(id, { aktion: was, name } = {}) {
  const a = nachId.get(id);
  if (!a) return { ok: false, error: "Diese App kenne ich nicht." };
  if (was === "mac_oeffnen") {
    if (!a.mac && !a.web) return { ok: false, error: "Das geht am Mac nicht." };
    if (IST_EVE) return simuliert("am Mac öffnen", { app: a.name });
    if (!isAgentOnline()) return { ok: false, error: macAus() };
    const r = a.mac ? await sendToAgent("open_app", { value: a.mac }) : await sendToAgent("open_url", { value: a.web });
    if (!r.ok && a.mac && a.web) { const r2 = await sendToAgent("open_url", { value: a.web }); if (r2.ok) return { ok: true, text: `${a.name} ist am Mac offen.` }; }
    if (!r.ok) return { ok: false, error: fehlerText(r, a.name) };
    eintragen({ bereich: "mac", quelle: "apps", titel: `${a.name} am Mac geöffnet` });
    return { ok: true, text: `${a.name} ist am Mac offen.` };
  }
  if (was === "tv_starten") {
    if (!a.tv) return { ok: false, error: `${a.name} gibt es nicht als Fernseher-App.` };
    if (IST_EVE) return simuliert("am Fernseher starten", { app: a.name });
    const r = await tvOpenApp(a.tv);
    if (r.ok) eintragen({ bereich: "tv", quelle: "apps", titel: `${a.name} am Fernseher gestartet` });
    return r.ok ? { ok: true, text: r.text || `${a.name} startet.` } : r;
  }
  if (was === "kurzbefehl" && id === "kurzbefehle") {
    const n = String(name || "").trim().slice(0, 120);
    if (!n) return { ok: false, error: "Welcher Kurzbefehl?" };
    if (IST_EVE) return simuliert("Kurzbefehl starten", { name: n });
    if (!isAgentOnline()) return { ok: false, error: macAus() };
    const r = await sendToAgent("kurzbefehl_ausfuehren", { value: JSON.stringify({ name: n }) }, 125000);
    if (!r.ok) return { ok: false, error: fehlerText(r, "Kurzbefehle") };
    eintragen({ bereich: "mac", quelle: "apps", titel: `Kurzbefehl gestartet: ${n}`, details: r.ausgabe || "" });
    return { ok: true, text: `Kurzbefehl „${n}“ ist gelaufen.${r.ausgabe ? ` Ergebnis: ${r.ausgabe.slice(0, 200)}` : ""}` };
  }
  if (was === "ordner" && (id === "gdrive" || id === "onedrive")) {
    if (IST_EVE) return simuliert("Ordner im Finder öffnen", { app: a.name });
    if (!isAgentOnline()) return { ok: false, error: macAus() };
    const r = await sendToAgent("cloud_oeffnen", { value: JSON.stringify({ dienst: id }) });
    return r.ok ? { ok: true, text: `${a.name}-Ordner ist im Finder offen.` } : { ok: false, error: fehlerText(r, a.name) };
  }
  return { ok: false, error: "Diese Aktion gibt es hier nicht." };
}

// ---------- Sprache (ohne Claude) ----------
const norm = (text) => String(text || "").toLowerCase().replace(/[„“”"'!?.,:;]/g, " ").replace(/\s+/g, " ").trim()
  .replace(/^(?:hey |hallo |hi |ok |okay )?(?:friday|freitag|fraiday|eve)(?: |$)/, "").trim()
  .replace(/^(?:bitte |kannst du (?:mir )?(?:bitte )?|könntest du (?:mir )?(?:bitte )?)/, "").trim()
  .replace(/ bitte$/, "").trim();

function findeApp(stueck) {
  const s = String(stueck || "").trim().replace(/^(?:die |das |den |meine |mein |meinen )/, "").replace(/(?: app| seite| konto)$/, "").trim();
  let best = null;
  for (const a of APPS) for (const w of a.worte) if (s === w && (!best || w.length > best.w.length)) best = { a, w };
  return best?.a || null;
}

/** @returns {Promise<{answer:string, actions:string[]} | null>} */
export async function quickCommand(text) {
  if (!frei()) return null;
  const t = norm(text);
  if (!t || t.length > 160) return null;

  // Geld: nie selbst bezahlen/kaufen/überweisen/bieten.
  if (/\b(bezahl|bezahle|zahl|zahle|überweis|ueberweis|kauf|kaufe|bestell|bestelle|biete|sende geld|schick geld|schicke geld)\w*\b.*\b(paypal|pay pal|google pay|gpay|amazon|ebay|e bay|wallet)\b|\b(paypal|google pay|amazon|ebay)\b.*\b(bezahlen|überweisen|ueberweisen|kaufen|bestellen|bieten)\b/.test(t)) {
    const a = /paypal|pay pal/.test(t) ? nachId.get("paypal") : /google pay|gpay|wallet/.test(t) ? nachId.get("googlepay") : /ebay|e bay/.test(t) ? nachId.get("ebay") : nachId.get("amazon");
    return { answer: `Bezahlen, kaufen und überweisen mache ich nie selbst, ${boss()}. Ich habe dir ${a.name} in der App-Zentrale bereitgelegt, dann entscheidest du selbst.`, actions: [`apps:${a.id}`] };
  }

  // Übersicht öffnen
  if (/^(?:öffne|oeffne|zeig|zeige|mach)(?: mir)?(?: mal)? (?:die |meine |alle |deine )?(?:app[ -]?zentrale|apps|alle apps|meine apps|app übersicht|app uebersicht|dienste übersicht)(?: auf)?$/.test(t)
    || /^(?:app[ -]?zentrale|meine apps|alle apps)$/.test(t)) {
    return { answer: `Hier sind deine ${APPS.length} Apps und Dienste, ${boss()}.`, actions: ["apps"] };
  }

  // Kurzbefehl starten: "starte Kurzbefehl Guten Morgen", "führe den Kurzbefehl X aus"
  const kb = t.match(/^(?:starte|start|führe|fuehre|mach)(?: den| mal den)? (?:kurzbefehl|shortcut) (.{2,80}?)(?: aus| an)?$/);
  if (kb) {
    const roh = String(text || "").replace(/[„“”"!?.]/g, " ").match(/(?:kurzbefehl|shortcut)\s+(.{2,80}?)(?:\s+(?:aus|an|bitte))*\s*$/i)?.[1]?.trim() || kb[1];
    if (!IST_EVE && isAgentOnline()) {
      const liste = await sendToAgent("kurzbefehle_liste", { value: "{}" }, 20000);
      const treffer = (liste.kurzbefehle || []).find((n) => n.toLowerCase() === roh.toLowerCase()) || (liste.kurzbefehle || []).find((n) => n.toLowerCase().includes(roh.toLowerCase()));
      if (!treffer) return { answer: liste.ok ? `Einen Kurzbefehl „${roh}“ finde ich am Mac nicht.` : fehlerText(liste, "Kurzbefehle"), actions: ["apps:kurzbefehle"] };
      const r = await aktion("kurzbefehle", { aktion: "kurzbefehl", name: treffer });
      return { answer: r.ok ? r.text : r.error, actions: ["apps:kurzbefehle"] };
    }
    const r = await aktion("kurzbefehle", { aktion: "kurzbefehl", name: roh });
    return { answer: r.ok ? (r.eve_simuliert ? `Test: Ich hätte jetzt den Kurzbefehl „${roh}“ gestartet. In Eve passiert das nur zum Schein.` : r.text) : r.error, actions: ["apps:kurzbefehle"] };
  }

  // GitHub: "was gibt's neues auf GitHub?"
  if (/^(?:was gibt(?: ?s| es)? neues|was ist neu|neuigkeiten) (?:auf|bei|in) (?:github|git hub)$|^(?:github|git hub) (?:status|neuigkeiten)$/.test(t)) {
    const g = await github();
    if (g.error) return { answer: g.error, actions: ["apps:github"] };
    const eve = g.auftraege.filter((x) => x.eve).length;
    const letzte = g.commits[0]?.text;
    return { answer: `Auf GitHub: ${g.auftraege.length === 1 ? "ein offener Auftrag" : `${g.auftraege.length} offene Aufträge`}${eve ? `, davon ${eve} Eve-Wünsche` : ""}${g.pullRequests.length ? `, ${g.pullRequests.length} ${g.pullRequests.length === 1 ? "Änderung wartet" : "Änderungen warten"} auf dein OK` : ""}.${letzte ? ` Zuletzt geändert: ${letzte}.` : ""}`, actions: ["apps:github"] };
  }

  // Fotos zählen: "wie viele Fotos habe ich?"
  if (/^wie ?viele (?:fotos|bilder) (?:habe ich|hab ich)(?: in (?:apple )?fotos| auf dem mac)?$/.test(t)) {
    if (!isAgentOnline()) return { answer: macAus(), actions: ["apps:fotos"] };
    const r = await sendToAgent("fotos_info", { value: "{}" }, 90000);
    if (!r.ok) return { answer: fehlerText(r, "Fotos"), actions: ["apps:fotos"] };
    return { answer: `In deiner Fotos-Mediathek sind ${Number(r.anzahl || 0).toLocaleString("de-DE")} Fotos und Videos${r.alben?.length ? ` in ${r.alben.length} Alben` : ""}.`, actions: ["apps:fotos"] };
  }

  // "öffne Ring", "öffne meine OneDrive", "zeig mir Disney+", "mach Arlo auf"
  // "zeig mir …" nur für Apps ohne Schnittstelle (sonst lesen Kalender & Co. weiter selbst vor).
  const oe = t.match(/^(?:öffne|oeffne|starte|start)(?: mir)?(?: mal)? (.{2,40}?)(?: auf dem mac)?$/) || t.match(/^mach(?: mir)?(?: mal)? (.{2,40}?) auf$/);
  const zg = !oe && t.match(/^(?:zeig|zeige)(?: mir)?(?: mal)? (.{2,40})$/);
  if ((oe || zg) && !/fernseher|\btv\b/.test(t)) {
    const a = findeApp((oe || zg)[1]);
    if (!a || (zg && !(a.geld || a.art === "link"))) return null;
    if (a.geld || a.art === "link") return { answer: `${a.name} liegt in der App-Zentrale bereit. Tipp auf „Öffnen“.${a.geld ? " Bezahlen und kaufen machst du selbst." : ""}`, actions: [`apps:${a.id}`, `apps_oeffnen:${a.id}`] };
    const r = await aktion(a.id, { aktion: "mac_oeffnen" });
    return { answer: r.ok ? (r.eve_simuliert ? `Test: Ich hätte ${a.name} jetzt am Mac geöffnet.` : r.text) : r.error, actions: [`apps:${a.id}`] };
  }
  return null;
}

export function appsRouten(app, asyncRoute) {
  const gesperrt = (res) => { if (frei()) return false; res.status(423).json({ error: "Die App-Zentrale ist noch im Test. Probier sie in Eve aus und gib sie dort frei." }); return true; };
  app.get("/api/apps", (req, res) => { if (!gesperrt(res)) res.json(liste()); });
  app.get("/api/apps/youtube/suche", asyncRoute(async (req, res) => { if (!gesperrt(res)) res.json(await youtubeSuche(req.query.q)); }));
  app.get("/api/apps/:id", asyncRoute(async (req, res) => { if (!gesperrt(res)) res.json(await details(String(req.params.id))); }));
  app.post("/api/apps/:id", asyncRoute(async (req, res) => {
    if (gesperrt(res)) return;
    const r = await aktion(String(req.params.id), { aktion: String(req.body?.aktion || ""), name: req.body?.name });
    res.status(r.ok ? 200 : 400).json(r);
  }));
}
