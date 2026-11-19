// F.R.Ai.D.A.Y System-Check: prüft alle wichtigen Dienste und Datenquellen.
import { config } from "./config.js";
import { telegramZustand } from "./telegram.js";
import { isAgentOnline } from "./agent-hub.js";
import { mailConfigured } from "./mail.js";
import { shipsStatus } from "./ships.js";
import { getEnergie } from "./energie.js";
import { videoTeamReady } from "./videoteam.js";
import { marktReady } from "./markt.js";
import { status as alexaStatus } from "./alexa.js";
import { status as tvStatus } from "./fernseher.js";
import { alleStatus } from "./dienste.js";

async function timed(label, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    return { label, ok: r.ok !== false, detail: r.detail || "", ms: Date.now() - t0 };
  } catch (err) {
    return { label, ok: false, detail: friendly(err), ms: Date.now() - t0 };
  }
}

function friendly(err) {
  const m = String(err?.message || err || "");
  if (/timeout|aborted/i.test(m)) return "Zeitüberschreitung";
  if (/ECONN|fetch failed|ENOTFOUND/i.test(m)) return "nicht erreichbar";
  return "Fehler";
}

async function ping(url, opts = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(opts.timeout || 7000), method: opts.method || "GET", headers: opts.headers });
  if (!res.ok && res.status >= 500) throw new Error("Status " + res.status);
  return res;
}

export async function runSystemCheck() {
  const checks = await Promise.all([
    // Grundlagen
    timed("Internet", async () => { await ping("https://www.cloudflare.com/cdn-cgi/trace", { timeout: 6000 }); return { ok: true, detail: "online" }; }),
    timed("Mac verbunden", async () => ({ ok: isAgentOnline(), detail: isAgentOnline() ? "verbunden" : "nicht verbunden" })),
    timed("Fridays Denken (Claude)", async () => ({ ok: Boolean(config.anthropicKey), detail: config.anthropicKey ? "Schlüssel vorhanden" : "kein Schlüssel" })),
    timed("Energie (Claude-Guthaben)", async () => {
      const e = getEnergie();
      if (e.zustand === "tot") return { ok: false, detail: "leer – Notstrom, bitte aufladen" };
      if (e.rest == null) return { ok: true, detail: "Betrag noch nicht eingetragen" };
      return { ok: e.zustand === "voll", detail: `${e.prozent} % (ca. ${e.rest.toFixed(2)} $)${e.zustand === "spar" ? " – Sparmodus" : ""}` };
    }),
    timed("Schnitt-Team (Whisper + ffmpeg)", async () => ({ ok: videoTeamReady(), detail: videoTeamReady() ? "installiert" : "Python-Umgebung fehlt" })),
    timed("Markt-Radar (Kronos)", async () => ({ ok: marktReady(), detail: marktReady() ? "installiert" : "Kronos fehlt" })),
    timed("Welt-Alarm (GDACS)", async () => { await ping("https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP", { timeout: 9000 }); return { ok: true, detail: "erreichbar" }; }),
    // Osiris
    timed("Osiris", async () => { await ping("http://127.0.0.1:3100/", { timeout: 6000 }); return { ok: true, detail: "läuft (Port 3100)" }; }),
    // Lagezentrum-Quellen
    timed("Lagezentrum: Erdbeben (USGS)", async () => { await ping("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson", { timeout: 8000 }); return { ok: true, detail: "erreichbar" }; }),
    timed("Lagezentrum: Ereignisse (NASA EONET)", async () => { await ping("https://eonet.gsfc.nasa.gov/api/v3/categories", { timeout: 8000 }); return { ok: true, detail: "erreichbar" }; }),
    timed("Lagezentrum: Satelliten (Celestrak)", async () => { await ping("https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle", { timeout: 8000 }); return { ok: true, detail: "erreichbar" }; }),
    timed("Lagezentrum: Flugzeuge (adsb.lol)", async () => { await ping("https://api.adsb.lol/v2/lat/52/lon/13/dist/25", { timeout: 8000 }); return { ok: true, detail: "erreichbar" }; }),
    timed("Lagezentrum: Schiffe (AIS)", async () => { const s = shipsStatus(); return { ok: Boolean(s && s.aktiv), detail: s && s.aktiv ? "verbunden" : "aus / kein Schlüssel" }; }),
    timed("Lagezentrum: Wetter (Open-Meteo)", async () => { await ping("https://api.open-meteo.com/v1/forecast?latitude=52.5&longitude=13.4&current=temperature_2m", { timeout: 7000 }); return { ok: true, detail: "erreichbar" }; }),
    timed("Lagezentrum: Nachrichten (Google News)", async () => { await ping("https://news.google.com/rss?hl=de", { timeout: 7000 }); return { ok: true, detail: "erreichbar" }; }),
    // Postfach
    timed("iCloud-Postfach", async () => ({ ok: mailConfigured(), detail: mailConfigured() ? "verbunden" : "nicht verbunden" })),
    // Telegram
    timed("Telegram", async () => {
      if (!config.telegramToken) return { ok: false, detail: "nicht eingerichtet" };
      if (telegramZustand.problem) return { ok: false, detail: telegramZustand.problem };
      return { ok: true, detail: telegramZustand.aktiv ? "Bot verbunden" : "eingerichtet" };
    }),
    // Fernseher
    timed("Fernseher (Samsung)", async () => {
      const s = await tvStatus();
      if (!s.eingerichtet) return { ok: false, detail: "nicht eingerichtet" };
      if (!s.gekoppelt) return { ok: false, detail: "noch nicht gekoppelt" };
      return { ok: true, detail: s.erreichbar ? `${s.name}: ${s.zustand === "standby" ? "Standby" : "an"}` : `${s.name}: aus` };
    }),
    // Alexa (Voice Monkey)
    timed("Alexa (Voice Monkey)", async () => {
      const s = await alexaStatus();
      if (!s.eingerichtet) return { ok: false, detail: "nicht eingerichtet" };
      return { ok: true, detail: `${s.routinen.length} Routinen, ${s.lautsprecher.length} Lautsprecher` };
    }),
    // Stimme
  ]);
  // Verbindungen (Kalender, Stimme, Spotify, Home Assistant, Hue, Todoist, Notion)
  try {
    const t0 = Date.now();
    const v = await Promise.race([alleStatus(), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 9000))]);
    for (const x of v.dienste) checks.push({ label: x.name, ok: Boolean(x.eingerichtet), detail: String(x.text || "").slice(0, 90), ms: Date.now() - t0 });
  } catch (err) {
    checks.push({ label: "Verbindungen", ok: false, detail: friendly(err), ms: 0 });
  }
  const ok = checks.filter((c) => c.ok).length;
  return { stand: new Date().toISOString(), gesamt: checks.length, ok, checks };
}
