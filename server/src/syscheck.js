// F.R.Ai.D.A.Y System-Check: prüft alle wichtigen Dienste und Datenquellen.
import { config } from "./config.js";
import { isAgentOnline } from "./agent-hub.js";
import { mailConfigured } from "./mail.js";
import { shipsStatus } from "./ships.js";

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
    timed("Fridays Denken (Claude)", async () => ({ ok: Boolean(config.anthropicKey), detail: config.anthropicKey ? "Schlüssel vorhanden (Guthaben separat)" : "kein Schlüssel" })),
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
    timed("Telegram", async () => ({ ok: Boolean(config.telegramToken), detail: config.telegramToken ? "eingerichtet" : "nicht eingerichtet" })),
    // Stimme
    timed("Stimme (ElevenLabs)", async () => ({ ok: Boolean(config.elevenKey), detail: config.elevenKey ? "Schlüssel vorhanden" : "Gerätestimme" })),
  ]);
  const ok = checks.filter((c) => c.ok).length;
  return { stand: new Date().toISOString(), gesamt: checks.length, ok, checks };
}
