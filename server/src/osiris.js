// Osiris Live-Lagekarte.
// Bevorzugt die selbst gehostete Kopie auf dem Mac (Port 3100). Läuft die nicht
// (z. B. nach dem Umzug auf einen neuen Mac-Benutzer), nimmt Friday automatisch
// die öffentliche Online-Version osirisai.live – dann geht Osiris trotzdem.
export const OSIRIS_LAYERS = "flights,private,jets,military,maritime,transit,satellites,cctv,cctv_previews,live_news,earthquakes,fires,weather,infrastructure,global_incidents,alert_pins,day_night,cables,sdk_sea,sdk_air,sdk_naval,live_clouds,wind,rain,wind_controls,rain_controls,wind_particles,terrain_3d,terrain_elevation,malware,cyber_attacks,gdelt_events";
export const OSIRIS_LOKAL = "http://localhost:3100/?layers=" + OSIRIS_LAYERS;
export const OSIRIS_ONLINE = "https://osirisai.live/?layers=" + OSIRIS_LAYERS;

let cache = { zeit: 0, lokal: false };

/** Läuft die lokale Osiris-Kopie auf dem Mac? (30 s gemerkt) */
export async function osirisLokalAktiv() {
  if (Date.now() - cache.zeit < 30_000) return cache.lokal;
  let lokal = false;
  try {
    const r = await fetch("http://127.0.0.1:3100/", { signal: AbortSignal.timeout(2500) });
    lokal = r.status < 500;
  } catch { lokal = false; }
  cache = { zeit: Date.now(), lokal };
  return lokal;
}

/** Adresse, die der Mac öffnen soll: lokal, wenn da, sonst online. */
export async function osirisUrl() {
  return (await osirisLokalAktiv()) ? OSIRIS_LOKAL : OSIRIS_ONLINE;
}

export async function osirisStatus() {
  const lokal = await osirisLokalAktiv();
  return { lokal, online: OSIRIS_ONLINE, url: lokal ? OSIRIS_LOKAL : OSIRIS_ONLINE };
}
