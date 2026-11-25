// Friday Shadow Mode (v1.185.0, Mark XIV): Friday schaut zu und schreibt nur auf, was sie selbstständig tun WÜRDE –
// geplante Automationen, Agenten-Verteilung der CEO-Agentin und der Projekt-Autopilot werden dann NICHT ausgeführt.
// Was du direkt verlangst (Sprachbefehl, Knopf "Jetzt ausführen"), läuft weiter normal.
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";

const NAME = "schatten";
const lade = () => ({ an: false, seit: null, notizen: [], ...store.load(NAME, {}) });

export const an = () => lade().an === true;
export function setzen(ein) {
  const d = lade();
  d.an = Boolean(ein);
  d.seit = d.an ? new Date().toISOString() : null;
  store.save(NAME, d);
  eintragen({ bereich: "system", titel: `Schattenmodus ${d.an ? "an" : "aus"}`, details: d.an ? "Friday schreibt nur auf, was sie selbstständig tun würde." : "", quelle: "dashboard" });
  return stand();
}
/** Merkt sich, was Friday getan hätte. */
export function notiere(wer, was, details = "") {
  const d = lade();
  d.notizen.push({ at: new Date().toISOString(), wer: String(wer).slice(0, 60), was: String(was).slice(0, 300), details: String(details).slice(0, 300) });
  d.notizen = d.notizen.slice(-200);
  store.save(NAME, d);
  eintragen({ bereich: "system", titel: `Schatten: ${wer} würde ${String(was).slice(0, 120)}`, quelle: "schattenmodus" });
}
export function stand() { const d = lade(); return { an: d.an === true, seit: d.seit, notizen: d.notizen.slice().reverse().slice(0, 60) }; }
export function leeren() { const d = lade(); d.notizen = []; store.save(NAME, d); return stand(); }
