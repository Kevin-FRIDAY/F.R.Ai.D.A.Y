// Spotify: Musik per Sprache steuern ("Friday, spiel meine Playlist Workout").
// Anmeldung über Spotify (OAuth mit PKCE, kein Geheimschlüssel nötig). Kevin legt einmal eine kostenlose
// App auf developer.spotify.com an und trägt deren Client-ID ein. Zum Steuern verlangt Spotify ein Premium-Konto.
import crypto from "node:crypto";
import { config } from "./config.js";
import { isAgentOnline, sendToAgent } from "./agent-hub.js";
import * as V from "./verbindungen.js";

const ACCOUNTS = () => String(process.env.SPOTIFY_ACCOUNTS || "https://accounts.spotify.com").replace(/\/$/, "");
const API = () => String(process.env.SPOTIFY_API || "https://api.spotify.com/v1").replace(/\/$/, "");
const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
].join(" ");

const d = () => V.get("spotify");
export const standardRedirect = () => `http://127.0.0.1:${config.port}/api/spotify/callback`;
const redirect = () => d().redirect || standardRedirect();
export const spotifyVerbunden = () => Boolean(d().refresh);

// ---------- Anmeldung ----------
const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function anmeldeLink() {
  const x = d();
  if (!x.clientId) return null;
  const verifier = b64url(crypto.randomBytes(48));
  const state = b64url(crypto.randomBytes(18));
  V.set("spotify", { pkce: { verifier, state, zeit: Date.now() } });
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const q = new URLSearchParams({
    client_id: x.clientId,
    response_type: "code",
    redirect_uri: redirect(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
    state,
  });
  return `${ACCOUNTS()}/authorize?${q}`;
}

// Spotify schickt den Browser hierher zurück (öffentliche Adresse, geschützt durch "state").
export async function callback({ code, state, error } = {}) {
  const x = d();
  const p = x.pkce;
  if (error) return { ok: false, error: error === "access_denied" ? "Du hast die Anmeldung bei Spotify abgebrochen." : `Spotify meldet: ${error}` };
  if (!p || !state || !code || typeof state !== "string" || state.length !== p.state.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(p.state))) {
    return { ok: false, error: "Diese Anmeldung ist abgelaufen. Tipp im Dashboard nochmal auf „Bei Spotify anmelden“." };
  }
  if (Date.now() - p.zeit > 15 * 60 * 1000) return { ok: false, error: "Die Anmeldung hat zu lange gedauert. Bitte nochmal." };
  const r = await V.holeJson(`${ACCOUNTS()}/api/token`, {
    method: "POST",
    form: true,
    body: { grant_type: "authorization_code", code: String(code), redirect_uri: redirect(), client_id: x.clientId, code_verifier: p.verifier },
  });
  V.set("spotify", { pkce: undefined });
  if (!r.ok || !r.data.access_token) return { ok: false, error: `Spotify hat die Anmeldung abgelehnt (${r.data.error_description || r.data.error || r.status}).` };
  V.set("spotify", { access: r.data.access_token, refresh: r.data.refresh_token, ablauf: Date.now() + (Number(r.data.expires_in) || 3600) * 1000 });
  const me = await api("GET", "/me");
  if (me.ok) V.set("spotify", { konto: me.data.display_name || me.data.id, premium: me.data.product === "premium" });
  return { ok: true };
}

let erneuern = null;
async function token() {
  const x = d();
  if (!x.refresh) return null;
  if (x.access && Date.now() < (x.ablauf || 0) - 60_000) return x.access;
  if (!erneuern) {
    erneuern = (async () => {
      const r = await V.holeJson(`${ACCOUNTS()}/api/token`, { method: "POST", form: true, body: { grant_type: "refresh_token", refresh_token: x.refresh, client_id: x.clientId } });
      if (!r.ok || !r.data.access_token) {
        if (r.status === 400 && /invalid_grant/.test(String(r.data.error))) V.set("spotify", { access: undefined, refresh: undefined });
        return null;
      }
      V.set("spotify", { access: r.data.access_token, refresh: r.data.refresh_token || x.refresh, ablauf: Date.now() + (Number(r.data.expires_in) || 3600) * 1000 });
      return r.data.access_token;
    })().finally(() => { erneuern = null; });
  }
  return erneuern;
}

async function api(method, pfad, body, query) {
  const tok = await token();
  if (!tok) return { ok: false, status: 401, error: spotifyVerbunden() ? "Spotify-Anmeldung abgelaufen. Melde dich im Verbindungen-Fenster neu an." : "Spotify ist noch nicht verbunden." };
  const q = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== ""))}` : "";
  const r = await V.holeJson(`${API()}${pfad}${q}`, { method, headers: { Authorization: `Bearer ${tok}` }, body });
  if (r.netz) return { ok: false, status: 0, error: "Spotify ist gerade nicht erreichbar." };
  if (r.ok) return { ok: true, status: r.status, data: r.data };
  const reason = String(r.data?.error?.reason || "");
  let error = r.data?.error?.message || `Spotify-Fehler ${r.status}`;
  if (reason === "NO_ACTIVE_DEVICE" || (r.status === 404 && /device/i.test(error))) error = "NO_ACTIVE_DEVICE";
  else if (reason === "PREMIUM_REQUIRED" || (r.status === 403 && /premium/i.test(error))) error = "Zum Steuern verlangt Spotify ein Premium-Konto. Abfragen wie „Was läuft gerade?“ gehen trotzdem.";
  else if (r.status === 429) error = "Spotify bremst gerade. Versuch es gleich nochmal.";
  else if (r.status === 401) error = "Spotify-Anmeldung abgelaufen. Melde dich im Verbindungen-Fenster neu an.";
  return { ok: false, status: r.status, error };
}

// ---------- Geräte ----------
async function geraete() {
  const r = await api("GET", "/me/player/devices");
  return r.ok ? r.data.devices || [] : [];
}
async function zielGeraet({ starten = true } = {}) {
  let list = await geraete();
  if (!list.length && starten && isAgentOnline()) {
    // Spotify-App auf dem Mac öffnen und kurz warten, bis sie sich bei Spotify meldet.
    await sendToAgent("open_app", { value: "Spotify" });
    for (let i = 0; i < 5 && !list.length; i++) {
      await new Promise((r) => setTimeout(r, Number(process.env.SPOTIFY_WARTEN_MS || 1500)));
      list = await geraete();
    }
  }
  if (!list.length) return null;
  const lieblings = d().geraet;
  return list.find((g) => g.is_active) || (lieblings && list.find((g) => g.name === lieblings)) || list.find((g) => g.type === "Computer") || list[0];
}

// Führt einen Player-Befehl aus; hat Spotify gerade kein aktives Gerät, wird eins gesucht (notfalls die Mac-App gestartet).
async function player(method, pfad, body, query = {}) {
  let r = await api(method, pfad, body, query);
  if (r.ok || r.error !== "NO_ACTIVE_DEVICE") return r;
  const g = await zielGeraet();
  if (!g) return { ok: false, error: "Ich finde kein Spotify-Gerät. Öffne Spotify auf dem Mac oder Handy und versuch es nochmal." };
  r = await api(method, pfad, body, { ...query, device_id: g.id });
  return r.error === "NO_ACTIVE_DEVICE" ? { ok: false, error: "Spotify reagiert auf keinem Gerät. Öffne die Spotify-App einmal." } : r;
}

// ---------- Suchen & Abspielen ----------
async function meinePlaylists() {
  const out = [];
  for (let off = 0; off < 200; off += 50) {
    const r = await api("GET", "/me/playlists", null, { limit: 50, offset: off });
    if (!r.ok) break;
    out.push(...(r.data.items || []).filter(Boolean));
    if (!r.data.next) break;
  }
  return out;
}

async function suche(q, typen) {
  const r = await api("GET", "/search", null, { q, type: typen, limit: 5, market: "from_token" });
  return r.ok ? r.data : {};
}

/**
 * Spielt etwas ab.
 * @param {string} wunsch - "Workout", "Bohemian Rhapsody", "Musik von Adele"
 * @param {"auto"|"titel"|"playlist"|"kuenstler"|"album"} art
 */
export async function spiele(wunsch, art = "auto") {
  let w = String(wunsch || "").trim();
  if (!w) {
    const r = await player("PUT", "/me/player/play");
    return r.ok ? { ok: true, text: "Weiter geht's." } : { ok: false, error: r.error };
  }
  // Lieblingssongs
  if (/^(meine |die )?(lieblingssongs|lieblingslieder|lieblings ?musik|gespeicherten songs|liked songs|songs die mir gefallen)$/i.test(w)) {
    const r = await api("GET", "/me/tracks", null, { limit: 50 });
    const uris = (r.data?.items || []).map((i) => i.track?.uri).filter(Boolean);
    if (!uris.length) return { ok: false, error: "In deinen Lieblingssongs ist nichts gespeichert." };
    for (let i = uris.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [uris[i], uris[j]] = [uris[j], uris[i]]; }
    const p = await player("PUT", "/me/player/play", { uris });
    return p.ok ? { ok: true, text: "Deine Lieblingssongs, gemischt." } : { ok: false, error: p.error };
  }
  // Eigene Playlists zuerst (bei "Playlist" oder wenn der Name gut passt)
  if (art === "auto" || art === "playlist") {
    const eigene = await meinePlaylists();
    const pl = V.bester(w, eigene, (x) => x.name, art === "playlist" ? 0.5 : 0.85);
    if (pl) {
      const p = await player("PUT", "/me/player/play", { context_uri: pl.uri });
      return p.ok ? { ok: true, text: `Deine Playlist ${pl.name}.` } : { ok: false, error: p.error };
    }
  }
  let kuenstlerName = null;
  const von = w.match(/^(.+?) von (.+)$/i);
  if (von && art !== "kuenstler") { w = von[1]; kuenstlerName = von[2]; }
  const typ = { titel: "track", playlist: "playlist", kuenstler: "artist", album: "album" }[art] || "track,artist,playlist";
  const q = kuenstlerName ? `track:${w} artist:${kuenstlerName}` : w;
  const s = await suche(q, kuenstlerName ? "track" : typ);
  const track = s.tracks?.items?.find(Boolean);
  const artist = s.artists?.items?.find(Boolean);
  const playlist = s.playlists?.items?.find(Boolean);
  const album = s.albums?.items?.find(Boolean);
  let ziel = null;
  if (art === "kuenstler" && artist) ziel = { context_uri: artist.uri, text: `Musik von ${artist.name}.` };
  else if (art === "playlist" && playlist) ziel = { context_uri: playlist.uri, text: `Playlist ${playlist.name}.` };
  else if (art === "album" && album) ziel = { context_uri: album.uri, text: `Das Album ${album.name}.` };
  else if (art === "auto" && artist && V.passt(w, artist.name) >= 0.95) ziel = { context_uri: artist.uri, text: `Musik von ${artist.name}.` };
  else if (track) ziel = { uris: [track.uri], text: `${track.name} von ${(track.artists || []).map((a) => a.name).slice(0, 2).join(" und ")}.` };
  else if (artist) ziel = { context_uri: artist.uri, text: `Musik von ${artist.name}.` };
  else if (playlist) ziel = { context_uri: playlist.uri, text: `Playlist ${playlist.name}.` };
  if (!ziel) return { ok: false, error: `Zu „${wunsch}“ finde ich bei Spotify nichts.` };
  const { text, ...body } = ziel;
  const p = await player("PUT", "/me/player/play", body);
  return p.ok ? { ok: true, text } : { ok: false, error: p.error };
}

export async function jetzt() {
  const r = await api("GET", "/me/player/currently-playing", null, { market: "from_token" });
  if (!r.ok) return { ok: false, error: r.error === "NO_ACTIVE_DEVICE" ? "Gerade läuft nichts." : r.error };
  if (r.status === 204 || !r.data?.item) return { ok: true, text: "Gerade läuft nichts auf Spotify." };
  const i = r.data.item;
  const wer = (i.artists || []).map((a) => a.name).slice(0, 2).join(" und ") || i.show?.name || "";
  return { ok: true, text: `${r.data.is_playing ? "Gerade läuft" : "Pausiert"}: ${i.name}${wer ? ` von ${wer}` : ""}.`, titel: i.name, kuenstler: wer, spielt: Boolean(r.data.is_playing) };
}

async function lautstaerke(neu, relativ = false) {
  let ziel = neu;
  if (relativ) {
    const st = await api("GET", "/me/player");
    const jetzt_ = st.ok ? Number(st.data?.device?.volume_percent) : NaN;
    ziel = (Number.isFinite(jetzt_) ? jetzt_ : 50) + neu;
  }
  ziel = Math.max(0, Math.min(100, Math.round(ziel)));
  const r = await player("PUT", "/me/player/volume", null, { volume_percent: ziel });
  return r.ok ? { ok: true, text: `Spotify auf ${ziel} Prozent.` } : { ok: false, error: r.error };
}

// Einheitlicher Einstieg für Claude-Werkzeug und Dashboard.
export async function command({ action, value, art } = {}) {
  if (action === "anmelden") {
    const link = anmeldeLink();
    return link ? { ok: true, link } : { ok: false, error: "Erst die Client-ID eintragen." };
  }
  if (!spotifyVerbunden()) return { ok: false, error: "Spotify ist noch nicht verbunden. Werkzeug-Menü → Verbindungen → Spotify." };
  const ok = (r, text) => (r.ok ? { ok: true, text } : { ok: false, error: r.error === "NO_ACTIVE_DEVICE" ? "Auf Spotify läuft gerade nichts." : r.error });
  switch (String(action || "")) {
    case "spielen": return spiele(value, art || "auto");
    case "pause": return ok(await api("PUT", "/me/player/pause"), "Pausiert.");
    case "weiter": return ok(await player("PUT", "/me/player/play"), "Weiter geht's.");
    case "naechster": return ok(await player("POST", "/me/player/next"), "Nächster Titel.");
    case "vorheriger": return ok(await player("POST", "/me/player/previous"), "Ein Titel zurück.");
    case "lauter": return lautstaerke(15, true);
    case "leiser": return lautstaerke(-15, true);
    case "lautstaerke": return lautstaerke(Number(value) || 50);
    case "zufall_an": return ok(await player("PUT", "/me/player/shuffle", null, { state: "true" }), "Zufallswiedergabe an.");
    case "zufall_aus": return ok(await player("PUT", "/me/player/shuffle", null, { state: "false" }), "Zufallswiedergabe aus.");
    case "jetzt": return jetzt();
    case "playlists": {
      const l = await meinePlaylists();
      return { ok: true, text: l.length ? `Deine Playlists: ${V.aufzaehlen(l.slice(0, 10).map((p) => p.name))}.` : "Du hast noch keine Playlists.", playlists: l.slice(0, 50).map((p) => p.name) };
    }
    case "geraete": {
      const g = await geraete();
      return { ok: true, text: g.length ? `Spotify-Geräte: ${V.aufzaehlen(g.map((x) => x.name))}.` : "Gerade ist kein Spotify-Gerät online.", geraete: g.map((x) => ({ name: x.name, aktiv: x.is_active, typ: x.type })) };
    }
    default:
      return { ok: false, error: "Unbekannte Spotify-Aktion." };
  }
}

// ---------- Fenster "Verbindungen" ----------
export const info = { id: "spotify", name: "Spotify", emoji: "🎵", kurz: "Musik per Sprache: Playlists, Songs, Künstler, Pause, Lautstärke." };

export async function status() {
  const x = d();
  const verbunden = spotifyVerbunden();
  let text;
  if (verbunden) text = `Verbunden${x.konto ? ` als ${x.konto}` : ""}${x.premium === false ? " · Achtung: ohne Premium kann Spotify nicht gesteuert werden" : ""}`;
  else if (x.clientId) text = "Client-ID gespeichert. Jetzt bei Spotify anmelden (am besten hier am Mac).";
  else text = "Nicht eingerichtet.";
  return {
    ...info,
    eingerichtet: verbunden,
    text,
    hinweis: verbunden ? "" : `Trag in deiner Spotify-App (developer.spotify.com) diese Redirect-URI ein: ${redirect()}`,
    felder: verbunden ? [] : [
      { name: "clientId", label: "Client-ID", typ: "text", platzhalter: "32 Zeichen von developer.spotify.com", wert: x.clientId || "" },
      { name: "redirect", label: "Redirect-URI (nur ändern, wenn du weißt warum)", typ: "text", platzhalter: standardRedirect(), wert: x.redirect || "" },
    ],
    auswahl: [],
    aktionen: verbunden
      ? [{ action: "jetzt", text: "🎧 Was läuft?" }, { action: "pause", text: "⏸ Pause" }, { action: "weiter", text: "▶ Weiter" }, { action: "naechster", text: "⏭ Nächster" }]
      : x.clientId ? [{ action: "anmelden", text: "🔑 Bei Spotify anmelden", link: true }] : [],
  };
}

export async function einrichten({ clientId, redirect: red } = {}) {
  const id = String(clientId || "").trim();
  if (!/^[a-f0-9]{32}$/i.test(id)) return { ok: false, error: "Die Client-ID hat 32 Zeichen (Zahlen und Buchstaben a–f). Du findest sie in deiner App auf developer.spotify.com." };
  const r = String(red || "").trim();
  if (r && !/^(https:\/\/|http:\/\/127\.0\.0\.1[:/])/.test(r)) return { ok: false, error: "Die Redirect-URI muss mit https:// oder http://127.0.0.1 beginnen." };
  V.set("spotify", { clientId: id, redirect: r || undefined });
  return { ok: true, text: "Gespeichert. Tipp jetzt auf „Bei Spotify anmelden“.", link: anmeldeLink() };
}
export async function einstellen() {
  return { ok: false, error: "Unbekannte Einstellung." };
}
export function vergessen() {
  V.clear("spotify");
  return { ok: true };
}

// ---------- Sprachbefehle ohne Claude ----------
const MUSIK = /\b(spotify|musik|song|songs|lied|lieder|titel|track|playlist|album)\b/;
export async function quick(t) {
  const verbunden = spotifyVerbunden();
  const nenntSpotify = /\bspotify\b/.test(t);
  if (!verbunden) return nenntSpotify && /^(spiel|spiele|play|öffne spotify und spiel)/.test(t) ? "Spotify ist noch nicht verbunden. Das geht im Werkzeug-Menü unter Verbindungen." : null;
  const s = t.replace(/\s+(auf|bei|über|mit) spotify$/, "").replace(/^spotify[ ,]+/, "");
  const sag = async (cmd) => { const r = await command(cmd); return r.ok ? r.text : r.error; };
  let m;

  if (/^(was läuft|was laeuft|welches lied|welcher song|welcher titel|wie heißt (das|dieses) lied|wie heisst (das|dieses) lied|was hör ich|was höre ich)( gerade| da| hier)?( auf spotify)?$/.test(t)) return sag({ action: "jetzt" });
  if (/^(spiel|spiele|mach) (die )?musik( an| ab| weiter)?$|^musik (an|weiter)$|^(spotify )?(weiter|fortsetzen|play)$/.test(s) || /^spotify (an|weiter|play)$/.test(t)) {
    const r = await command({ action: "weiter" });
    return r.ok ? r.text : nenntSpotify ? r.error : null;
  }
  if (/^(musik |song |lied )?(pause|pausieren|stopp|stop|anhalten)$|^musik (aus|stopp|stop)$|^(halt|stopp) die musik( an)?$/.test(s) || /^spotify (pause|aus|stopp|stop)$/.test(t)) {
    const r = await command({ action: "pause" });
    // Läuft auf Spotify nichts, darf die Mac-Musik-App übernehmen.
    return r.ok ? r.text : nenntSpotify ? r.error : null;
  }
  if (/^(nächster|naechster|nächstes|naechstes) (song|titel|lied|track)$|^(song|titel|lied) (weiter|überspringen|ueberspringen)$|^skip$|^überspring(en)?( das lied)?$/.test(s) || /^spotify (weiter|skip|nächster)$/.test(t)) {
    const r = await command({ action: "naechster" });
    return r.ok ? r.text : nenntSpotify ? r.error : null;
  }
  if (/^(vorheriger|letzter|vorheriges) (song|titel|lied|track)$|^(nochmal|noch mal) (das lied|den song)$/.test(s)) {
    const r = await command({ action: "vorheriger" });
    return r.ok ? r.text : nenntSpotify ? r.error : null;
  }
  if ((m = s.match(/^(?:musik|spotify) (lauter|leiser)$|^(?:mach |dreh )?(?:die )?musik (lauter|leiser)$/))) return sag({ action: (m[1] || m[2]) === "lauter" ? "lauter" : "leiser" });
  if ((m = t.match(/^(?:spotify|musik)(?: lautstärke| lautstaerke)? (?:auf )?(\d{1,3})(?: prozent)?$/))) return sag({ action: "lautstaerke", value: m[1] });
  if (/^(zufall|zufallswiedergabe|shuffle|mischen)( an| ein)?$|^misch (die musik|die playlist)$/.test(s)) return sag({ action: "zufall_an" });
  if (/^(zufall|zufallswiedergabe|shuffle)( aus)$/.test(s)) return sag({ action: "zufall_aus" });
  if (/^(welche|meine|zeig mir meine|zeig meine) playlists( habe ich| hab ich)?$/.test(t)) return sag({ action: "playlists" });

  // "spiel meine Playlist Workout", "spiel Musik von Adele", "spiel Bohemian Rhapsody", "spiel etwas Entspanntes"
  if ((m = s.match(/^(?:spiel|spiele|play|hör|hoer|lass) (?:mal |bitte |uns )?(.+?)(?: laufen| ab| abspielen)?$/))) {
    let w = m[1].trim();
    if (/^(ein |eine )?(spiel|runde|witz|video|film|serie)\b/.test(w)) return null;
    // "auf dem Fernseher" / "im TV" gehört nicht zu Spotify
    if (/\b(fernseher|tv|netflix|youtube)\b/.test(w)) return null;
    let art = "auto";
    let x;
    if ((x = w.match(/^(?:meine |die |unsere )?playlist (.+)$/)) || (x = w.match(/^(?:meine |die )(.+?) playlist$/))) { art = "playlist"; w = x[1]; }
    else if ((x = w.match(/^(?:musik|songs|lieder|etwas|was|was von) von (.+)$/))) { art = "kuenstler"; w = x[1]; }
    else if ((x = w.match(/^(?:das )?album (.+)$/))) { art = "album"; w = x[1]; }
    else if ((x = w.match(/^(?:den song|das lied|den titel|song|lied|titel) (.+)$/))) { art = "titel"; w = x[1]; }
    else if (/^(etwas|was|musik|irgendwas|irgendetwas) /.test(w) || /^(entspannte|ruhige|chillige|gute|laute|fröhliche|froehliche|traurige|motivierende) musik$/.test(w)) {
      const stimmung = w.replace(/^(etwas|was|irgendwas|irgendetwas) /, "").replace(/ musik$/, "").replace(/^musik (zum |für |fuer )?/, "");
      art = "playlist";
      w = /musik|songs|lieder/.test(stimmung) ? stimmung : `${stimmung} musik`;
    }
    // Nur greifen, wenn es nach Musik klingt oder Spotify genannt wurde – sonst entscheidet Claude.
    if (!nenntSpotify && art === "auto" && !MUSIK.test(t) && w.split(" ").length > 6) return null;
    return sag({ action: "spielen", value: w, art });
  }
  return null;
}
