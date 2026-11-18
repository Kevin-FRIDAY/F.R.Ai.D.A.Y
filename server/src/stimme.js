// Fridays echte Stimme über ElevenLabs (elevenlabs.io).
// Schlüssel im Dashboard (Verbindungen → ElevenLabs) oder in der .env (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID).
// Ist das Gratis-Kontingent aufgebraucht oder ElevenLabs nicht erreichbar, spricht Friday automatisch mit der Gerätestimme.
import { config } from "./config.js";
import * as V from "./verbindungen.js";

const API = () => String(process.env.ELEVENLABS_API || "https://api.elevenlabs.io").replace(/\/$/, "");
// "Sarah": weibliche Standard-Stimme, die jedes ElevenLabs-Konto hat. Spricht mit dem Multilingual-Modell Deutsch.
const STANDARD_STIMME = "EXAVITQu4vr4xnSDxMaL";
const MODELLE = {
  schnell: { id: "eleven_flash_v2_5", name: "Schnell (spart Zeichen)" },
  beste: { id: "eleven_multilingual_v2", name: "Beste Qualität" },
};

const d = () => V.get("stimme");
const key = () => String(d().key || config.elevenKey || "").trim();
const stimmeId = () => String(d().stimme || config.elevenVoice || STANDARD_STIMME);
const modell = () => MODELLE[d().modell] || MODELLE.schnell;

export function stimmeAktiv() {
  return Boolean(key()) && d().aus !== true;
}

// Warum ElevenLabs gerade nicht spricht (leer = alles gut). Fürs Dashboard.
export function stimmeHinweis() {
  return stimmeAktiv() && Date.now() < pauseBis ? pauseGrund : "";
}

// Wenn das Kontingent leer ist, ein paar Stunden lang gar nicht erst fragen (spart Wartezeit).
let pauseBis = 0;
let pauseGrund = "";

const cache = new Map(); // Text -> MP3 (kurze, oft wiederholte Sätze wie "Erledigt.")
function merken(k, buf) {
  if (buf.length > 400_000) return;
  cache.set(k, buf);
  if (cache.size > 40) cache.delete(cache.keys().next().value);
}

/**
 * Wandelt Text in Sprache um.
 * @returns {Promise<{ok:true, audio:Buffer} | {ok:false, error:string}>}
 */
export async function sprich(text) {
  const t = String(text || "").trim().slice(0, 1500);
  if (!t) return { ok: false, error: "Kein Text" };
  if (!stimmeAktiv()) return { ok: false, error: "Keine ElevenLabs-Stimme eingerichtet" };
  if (Date.now() < pauseBis) return { ok: false, error: pauseGrund };
  const k = `${stimmeId()}|${modell().id}|${t}`;
  if (cache.has(k)) return { ok: true, audio: cache.get(k) };
  let res;
  try {
    res = await fetch(`${API()}/v1/text-to-speech/${encodeURIComponent(stimmeId())}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key(), "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: t, model_id: modell().id, language_code: modell().id === "eleven_flash_v2_5" ? "de" : undefined }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    return { ok: false, error: "ElevenLabs ist gerade nicht erreichbar, deshalb spreche ich mit der Gerätestimme." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const status = String(body?.detail?.status || body?.detail?.code || "");
    if (/quota_exceeded/.test(status)) {
      pauseBis = Date.now() + 6 * 3600 * 1000;
      const basis = "Das ElevenLabs-Guthaben ist aufgebraucht, deshalb spreche ich mit der Gerätestimme.";
      const datum = (iso) => new Date(iso).toLocaleDateString("de-DE", { timeZone: config.timezone, day: "numeric", month: "long" });
      pauseGrund = abo?.neuAm ? `${basis} Es füllt sich am ${datum(abo.neuAm)} wieder auf, oder du nimmst bei elevenlabs.io ein Abo.` : `${basis} Es füllt sich nächsten Monat wieder auf, oder du nimmst bei elevenlabs.io ein Abo.`;
      // Datum zum Auffüllen im Hintergrund nachladen (nicht warten, sonst stockt die Antwort).
      kontingent(true).then((k) => {
        if (k?.neuAm && /Guthaben/.test(pauseGrund)) pauseGrund = `${basis} Es füllt sich am ${datum(k.neuAm)} wieder auf, oder du nimmst bei elevenlabs.io ein Abo.`;
      }).catch(() => {});
    } else if (/missing_permissions/.test(status)) {
      pauseBis = Date.now() + 10 * 60 * 1000;
      pauseGrund = "Dem ElevenLabs-Schlüssel fehlt das Recht „Text to Speech“, deshalb spreche ich mit der Gerätestimme.";
    } else if (/detected_unusual_activity/.test(status)) {
      pauseBis = Date.now() + 30 * 60 * 1000;
      pauseGrund = "ElevenLabs hat das Gratis-Konto gesperrt (ungewöhnliche Aktivität, zum Beispiel VPN), deshalb spreche ich mit der Gerätestimme.";
    } else if (res.status === 401) {
      pauseBis = Date.now() + 10 * 60 * 1000;
      pauseGrund = "Der ElevenLabs-Schlüssel wird abgelehnt, deshalb spreche ich mit der Gerätestimme. Trag unter Verbindungen einen neuen Schlüssel ein.";
    } else if (res.status === 404) {
      pauseBis = Date.now() + 10 * 60 * 1000;
      pauseGrund = "Die gewählte ElevenLabs-Stimme gibt es nicht mehr. Wähl unter Verbindungen eine andere.";
    } else if (res.status === 429) {
      pauseBis = Date.now() + 60 * 1000;
      pauseGrund = "ElevenLabs bremst gerade, deshalb spreche ich kurz mit der Gerätestimme.";
    }
    const grund = pauseGrund || `ElevenLabs meldet Fehler ${res.status}, deshalb spreche ich mit der Gerätestimme.`;
    console.warn(`[stimme] ElevenLabs ${res.status} ${status}: ${grund}`);
    return { ok: false, error: grund };
  }
  const audio = Buffer.from(await res.arrayBuffer());
  if (t.length <= 120) merken(k, audio);
  return { ok: true, audio };
}

// --- Kontingent (wie viele Zeichen noch übrig sind) ---
let abo = null, aboZeit = 0;
async function kontingent(frisch = false) {
  if (!key()) return null;
  if (!frisch && abo && Date.now() - aboZeit < 10 * 60 * 1000) return abo;
  const r = await V.holeJson(`${API()}/v1/user/subscription`, { headers: { "xi-api-key": key() }, timeout: 8000 });
  if (!r.ok) return abo;
  const x = r.data || {};
  abo = {
    plan: x.tier || "",
    benutzt: Number(x.character_count) || 0,
    limit: Number(x.character_limit) || 0,
    neuAm: x.next_character_count_reset_unix ? new Date(x.next_character_count_reset_unix * 1000).toISOString() : null,
  };
  aboZeit = Date.now();
  return abo;
}

async function stimmenListe(k = key()) {
  const r = await V.holeJson(`${API()}/v1/voices`, { headers: { "xi-api-key": k } });
  if (!r.ok) return r;
  const list = Array.isArray(r.data?.voices) ? r.data.voices : [];
  return {
    ok: true,
    stimmen: list.map((v) => ({
      id: String(v.voice_id),
      name: String(v.name || v.voice_id),
      art: [v.labels?.gender === "female" ? "weiblich" : v.labels?.gender === "male" ? "männlich" : "", v.labels?.accent || ""].filter(Boolean).join(", "),
    })),
  };
}

// ---------- Für das Fenster "Verbindungen" ----------
export const info = { id: "stimme", name: "ElevenLabs-Stimme", emoji: "🗣️", kurz: "Echte, natürliche Friday-Stimme statt Gerätestimme." };

export async function status() {
  const x = d();
  const ein = Boolean(key());
  const k = ein ? await kontingent().catch(() => null) : null;
  const rest = k && k.limit ? Math.max(0, k.limit - k.benutzt) : null;
  return {
    ...info,
    eingerichtet: ein,
    text: !ein
      ? "Nicht eingerichtet – Friday spricht mit der Gerätestimme."
      : x.aus
        ? "Verbunden, aber ausgeschaltet – Friday nutzt die Gerätestimme."
        : `Aktiv${x.stimmeName ? ` mit „${x.stimmeName}“` : ""}${rest != null ? ` · noch ${rest.toLocaleString("de-DE")} von ${k.limit.toLocaleString("de-DE")} Zeichen` : ""}${Date.now() < pauseBis ? ` · Pause: ${pauseGrund}` : ""}`,
    quelle: x.key ? "dashboard" : config.elevenKey ? "env" : null,
    felder: ein ? [] : [{ name: "key", label: "ElevenLabs-API-Schlüssel", typ: "password", platzhalter: "sk_…" }],
    auswahl: ein
      ? [
          { name: "stimme", label: "Stimme", wert: stimmeId(), optionen: (x.stimmen || []).map((s) => ({ wert: s.id, text: s.art ? `${s.name} (${s.art})` : s.name })) },
          { name: "modell", label: "Tempo", wert: x.modell || "schnell", optionen: Object.entries(MODELLE).map(([w, m]) => ({ wert: w, text: m.name })) },
          { name: "aus", label: "Stimme benutzen", wert: x.aus ? "aus" : "an", optionen: [{ wert: "an", text: "An" }, { wert: "aus", text: "Aus (Gerätestimme)" }] },
        ]
      : [],
    aktionen: ein ? [{ action: "probe", text: "▶ Probe hören" }, { action: "aktualisieren", text: "↻ Stimmen laden" }] : [],
  };
}

// ElevenLabs schickt bei Fehlern {detail: {status, message}}. Daraus einen verständlichen deutschen Satz machen.
function fehlerText(r) {
  if (r.netz) return "ElevenLabs ist gerade nicht erreichbar. Ist der Mac online?";
  const det = r.data?.detail;
  const code = String((typeof det === "object" && (det?.status || det?.code)) || "");
  const msg = String((typeof det === "object" ? det?.message : det) || r.data?.message || "");
  if (/missing_permissions/.test(code) || /missing.*permission/i.test(msg)) {
    const recht = (msg.match(/permission[s]?\s+([a-z_]+)/i) || [])[1];
    return `Dem Schlüssel fehlen Rechte${recht ? ` (${recht})` : ""}. Erstelle bei elevenlabs.io → API Keys einen neuen Schlüssel und stell dort „Text to Speech“ auf Zugriff und „Voices“ auf Lesen (oder lass alle Rechte an).`;
  }
  if (/detected_unusual_activity|unusual/i.test(code + msg)) return "ElevenLabs hat das Gratis-Konto vorübergehend gesperrt (ungewöhnliche Aktivität, z. B. VPN). Ohne VPN nochmal versuchen oder bei ElevenLabs den Support fragen.";
  if (/quota_exceeded/.test(code)) return "Das ElevenLabs-Kontingent ist aufgebraucht. Es füllt sich nächsten Monat wieder auf.";
  if (/invalid_api_key|invalid.*key/i.test(code + msg) || r.status === 401) return "ElevenLabs kennt diesen Schlüssel nicht. Vielleicht wurde er gelöscht oder nicht ganz kopiert. Erstelle bei elevenlabs.io → API Keys einen neuen und füg ihn komplett ein.";
  if (r.status === 429) return "ElevenLabs bremst gerade. In einer Minute nochmal versuchen.";
  return `ElevenLabs meldet einen Fehler (${r.status}${msg ? `: ${msg.slice(0, 120)}` : ""}).`;
}
const fehltRecht = (r) => /missing_permissions/.test(String(r.data?.detail?.status || "")) || /missing.*permission/i.test(String(r.data?.detail?.message || ""));

// Kurzer Sprechtest – damit klappt die Einrichtung auch mit Schlüsseln, die nur "Text to Speech" dürfen.
async function sprechTest(k) {
  return V.holeJson(`${API()}/v1/text-to-speech/${STANDARD_STIMME}?output_format=mp3_22050_32`, {
    method: "POST",
    headers: { "xi-api-key": k, Accept: "audio/mpeg" },
    body: { text: "Hallo.", model_id: MODELLE.schnell.id, language_code: "de" },
    timeout: 15000,
  });
}

export async function einrichten({ key: k } = {}) {
  // Beim Kopieren rutschen manchmal Anführungszeichen oder "xi-api-key:" mit rein.
  const t = String(k || "").trim().replace(/^xi-api-key:\s*/i, "").replace(/^["'„“]+|["'„“]+$/g, "").trim();
  if (!V.schluesselOk(t, 20)) return { ok: false, error: "Das sieht nicht wie ein ElevenLabs-Schlüssel aus. Er beginnt mit sk_ und hat keine Leerzeichen." };
  let r = await stimmenListe(t);
  if (!r.ok && fehltRecht(r)) {
    // Schlüssel darf keine Stimmen auflisten → prüfen, ob er wenigstens sprechen darf.
    const p = await sprechTest(t);
    if (!p.ok) return { ok: false, error: fehlerText(p) };
    V.set("stimme", { key: t, stimmen: [{ id: STANDARD_STIMME, name: "Sarah", art: "weiblich" }], stimme: STANDARD_STIMME, stimmeName: "Sarah", aus: undefined });
    pauseBis = 0;
    abo = null;
    return { ok: true, text: "ElevenLabs ist verbunden, ich spreche mit der Stimme Sarah. Dein Schlüssel darf keine Stimmen auflisten, deshalb gibt es nur Sarah. Für mehr Stimmen beim Schlüssel „Voices: Lesen“ erlauben." };
  }
  if (!r.ok) return { ok: false, error: fehlerText(r) };
  const wahl = r.stimmen.find((s) => s.id === STANDARD_STIMME) || r.stimmen.find((s) => /weiblich/.test(s.art)) || r.stimmen[0];
  V.set("stimme", { key: t, stimmen: r.stimmen.slice(0, 80), stimme: wahl?.id || STANDARD_STIMME, stimmeName: wahl?.name || "Sarah", aus: undefined });
  pauseBis = 0;
  abo = null;
  return { ok: true, text: `ElevenLabs ist verbunden. Ich spreche jetzt mit der Stimme ${wahl?.name || "Sarah"}.` };
}

export async function einstellen({ name, wert } = {}) {
  const x = d();
  if (name === "stimme") {
    const s = (x.stimmen || []).find((v) => v.id === wert);
    if (!s) return { ok: false, error: "Diese Stimme kenne ich nicht." };
    V.set("stimme", { stimme: s.id, stimmeName: s.name });
    return { ok: true, text: `Stimme gewechselt: ${s.name}.` };
  }
  if (name === "modell" && MODELLE[wert]) { V.set("stimme", { modell: wert }); return { ok: true }; }
  if (name === "aus") { V.set("stimme", { aus: wert === "aus" ? true : undefined }); return { ok: true }; }
  return { ok: false, error: "Unbekannte Einstellung." };
}

export function vergessen() {
  V.clear("stimme");
  abo = null;
  pauseBis = 0;
  cache.clear();
  return { ok: true };
}

export async function command({ action, value } = {}) {
  if (!key()) return { ok: false, error: "ElevenLabs ist noch nicht eingerichtet. Trag den Schlüssel im Werkzeug-Menü unter Verbindungen ein." };
  if (action === "aktualisieren") {
    const r = await stimmenListe();
    if (!r.ok) return { ok: false, error: `Konnte die Stimmen nicht laden. ${fehlerText(r)}` };
    V.set("stimme", { stimmen: r.stimmen.slice(0, 80) });
    return { ok: true, text: `${r.stimmen.length} Stimmen geladen.` };
  }
  if (action === "probe") {
    // Erst wirklich bei ElevenLabs testen, damit ein Fehler hier steht statt still die Gerätestimme zu nehmen.
    pauseBis = 0;
    const p = await sprich(`Hallo ${config.userName}. So klinge ich mit ElevenLabs.`);
    if (!p.ok) return { ok: false, error: p.error };
    return { ok: true, text: `Hallo ${config.userName}. So klinge ich mit ElevenLabs.`, sprechen: true };
  }
  if (action === "kontingent") {
    const k = await kontingent(true);
    if (!k || !k.limit) return { ok: false, error: "Das Kontingent konnte ich nicht abfragen. Vielleicht darf dein Schlüssel das nicht (Recht „User: Lesen“)." };
    const rest = Math.max(0, k.limit - k.benutzt);
    const neu = k.neuAm ? ` Es füllt sich am ${new Date(k.neuAm).toLocaleDateString("de-DE", { timeZone: config.timezone, day: "numeric", month: "long" })} wieder auf.` : "";
    return { ok: true, text: `Du hast noch ${rest.toLocaleString("de-DE")} von ${k.limit.toLocaleString("de-DE")} Zeichen bei ElevenLabs.${neu}` };
  }
  if (action === "wechseln") {
    const s = V.bester(value, d().stimmen || []);
    if (!s) return { ok: false, error: `Eine Stimme „${value}“ finde ich nicht.` };
    V.set("stimme", { stimme: s.id, stimmeName: s.name });
    return { ok: true, text: `Okay, ich spreche jetzt als ${s.name}.` };
  }
  return { ok: false, error: "Unbekannte Stimm-Aktion." };
}

// "Wie viel Stimme habe ich noch?", "Wechsel die Stimme zu Lily"
export async function quick(t) {
  if (/^(wie ?viel|wieviele?|wie viele) (zeichen|stimme|elevenlabs)( guthaben| kontingent)?( habe ich| hab ich)?( noch)?( übrig| uebrig)?$|^elevenlabs (guthaben|kontingent|zeichen)$|^(stimmen|elevenlabs)[ -]?(kontingent|guthaben)$/.test(t)) {
    if (!key()) return "ElevenLabs ist noch nicht eingerichtet. Ich spreche mit der Gerätestimme.";
    const r = await command({ action: "kontingent" });
    return r.ok ? r.text : r.error;
  }
  const m = t.match(/^(?:wechsel|wechsle|ändere|aendere) (?:deine |die )?stimme (?:zu|auf|in) (.{2,40})$|^(?:sprich|rede) (?:ab jetzt |jetzt )?(?:als|mit der stimme(?: von)?) (.{2,40})$/);
  if (m && key()) {
    const r = await command({ action: "wechseln", value: m[1] || m[2] });
    return r.ok ? r.text : r.error;
  }
  return null;
}
