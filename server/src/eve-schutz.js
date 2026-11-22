// Eve-Schutz (v1.138.0): Läuft dieser Prozess als Eve (Testversion), darf nichts nach außen wirken.
// Alles, was etwas in der echten Welt verändert (Alexa, Licht, Smart Home, Spotify, Todoist, Notion,
// Anrufe/SMS, Telegram, Push, GitHub …), wird nur simuliert: Eve tut so, als hätte es geklappt,
// und schreibt ins Logbuch, was Friday an dieser Stelle getan HÄTTE.
// Lesen (GET) ist erlaubt, damit Eve genauso aussieht und funktioniert wie Friday.
import { IST_EVE } from "./config.js";
import { eintragen } from "./logbuch.js";

// Diese Dienste dürfen auch in Eve etwas schicken, weil sie nur antworten (denken, sprechen, Daten liefern).
const POST_ERLAUBT = [
  /(^|\.)anthropic\.com$/i,
  /(^|\.)openrouter\.ai$/i, // Ersatz-Gehirn (v1.142.0): denkt nur
  /(^|\.)elevenlabs\.io$/i,
  /^auth\.opensky-network\.org$/i,
  /^127\.0\.0\.1$|^localhost$/i, // Eves eigener Server
];
// Diese Dienste sind in Eve ganz tabu (auch GET), weil schon ein Aufruf etwas auslöst.
const IMMER_GESPERRT = [
  /(^|\.)voicemonkey\.io$/i,
  /^api\.telegram\.org$/i,
  /(^|\.)twilio\.com$/i,
  /(^|\.)ntfy\.sh$/i,
];

const simuliert = [];
/** Was Eve zuletzt nur simuliert hat (für Dashboard/Logbuch). */
export const letzteSimulationen = () => simuliert.slice(-30).reverse();

export function eveSchutzAn() {
  if (!IST_EVE || globalThis.__eveSchutz) return;
  globalThis.__eveSchutz = true;
  const echt = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (eingabe, opts = {}) => {
    let url;
    try { url = new URL(typeof eingabe === "string" ? eingabe : eingabe?.url || String(eingabe)); } catch { return echt(eingabe, opts); }
    const methode = String(opts?.method || eingabe?.method || "GET").toUpperCase();
    const host = url.hostname;
    const sperren = IMMER_GESPERRT.some((r) => r.test(host)) || (!["GET", "HEAD", "OPTIONS"].includes(methode) && !POST_ERLAUBT.some((r) => r.test(host)));
    if (!sperren) return echt(eingabe, opts);
    simuliert.push({ zeit: new Date().toISOString(), methode, ziel: `${host}${url.pathname}`.slice(0, 160) });
    if (simuliert.length > 200) simuliert.splice(0, 100);
    console.log(`[Eve] simuliert statt gesendet: ${methode} ${host}${url.pathname}`);
    eintragen({ bereich: "system", quelle: "eve", titel: `Eve-Test: nur simuliert (${methode} ${host})`, details: `${host}${url.pathname}`.slice(0, 200) });
    const body = JSON.stringify({ ok: true, eve_simuliert: true, info: "Eve-Testmodus: nicht wirklich ausgeführt." });
    return new Response(body, { status: 200, headers: { "content-type": "application/json", "x-eve-simuliert": "1" } });
  };
}

// Werkzeuge, die in Eve nur simuliert werden (sie steuern Geräte, Konten oder schicken etwas weg).
export const EVE_SIMULIERT = new Set(["open_app", "mac", "run_protocol", "fernseher", "alexa", "update", "send_push", "anrufe", "kalender", "spotify", "hue", "todoist", "notion", "smart_home", "sort_mail"]);
export function simuliereWerkzeug(name, input) {
  const was = Object.entries(input || {}).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ").slice(0, 300);
  simuliert.push({ zeit: new Date().toISOString(), methode: "WERKZEUG", ziel: `${name}${was ? ` (${was})` : ""}` });
  eintragen({ bereich: "system", quelle: "eve", titel: `Eve-Test: „${name}“ nur simuliert`, details: was });
  return {
    ok: true, eve_simuliert: true,
    info: `Eve-Testmodus: „${name}“ wurde NICHT wirklich ausgeführt (${was || "ohne Angaben"}). In Friday würde es echt passieren. Sag Boss ehrlich, dass es nur ein Test war.`,
  };
}
