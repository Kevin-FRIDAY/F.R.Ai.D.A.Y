// Schlaf-Protokoll (v1.169.0, Stern-Idee aus der Ideen-Schmiede).
// "Friday, gute Nacht" merkt sich die Uhrzeit, "Friday, guten Morgen" rechnet die Schlafdauer aus
// und liest danach das kostenlose Kurz-Briefing vor. Wochenkurve im Fenster. Ohne Claude, ohne Uhr am Arm.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { config } from "./config.js";
import { sauber, tagStr, uhrzeit, uhrJetzt } from "./wunsch-hilfe.js";

const DATEI = "schlaf";
const laden = () => ({ nacht: [], offen: null, ziel: 8, ...store.load(DATEI, {}) });
const sichern = (d) => store.save(DATEI, d);
const dauerText = (min) => { const h = Math.floor(min / 60), m = min % 60; return `${h} ${h === 1 ? "Stunde" : "Stunden"}${m ? ` und ${m} Minuten` : ""}`; };

export function stand() {
  const d = laden();
  const woche = Array.from({ length: 7 }, (_, i) => {
    const tag = tagStr(i - 6);
    const n = d.nacht.find((x) => x.tag === tag);
    return { tag, minuten: n?.minuten || 0, von: n?.von || null, bis: n?.bis || null };
  });
  const mit = d.nacht.slice(-7).filter((n) => n.minuten);
  const schnitt = mit.length ? Math.round(mit.reduce((s, n) => s + n.minuten, 0) / mit.length) : 0;
  return { ziel: d.ziel, offen: d.offen, woche, schnitt, schnittText: schnitt ? dauerText(schnitt) : "", liste: d.nacht.slice(-30).reverse() };
}
export function einstellen({ ziel } = {}) { const d = laden(); const z = Number(ziel); if (z >= 4 && z <= 12) d.ziel = z; sichern(d); return stand(); }
export function weg(tag) { const d = laden(); d.nacht = d.nacht.filter((n) => n.tag !== tag); sichern(d); return stand(); }

export function guteNacht(ms = Date.now()) {
  const d = laden();
  d.offen = new Date(ms).toISOString();
  sichern(d);
  return d.offen;
}
/** Aufwachen: Nacht abschließen. Gibt null zurück, wenn kein passendes "Gute Nacht" (3–16 Stunden vorher) da ist. */
export function aufgewacht(ms = Date.now()) {
  const d = laden();
  if (!d.offen) return null;
  const min = Math.round((ms - Date.parse(d.offen)) / 60000);
  if (min < 180 || min > 16 * 60) { d.offen = null; sichern(d); return null; }
  const tag = tagStr(0, ms);
  const n = { tag, von: d.offen, bis: new Date(ms).toISOString(), minuten: min };
  d.nacht = [...d.nacht.filter((x) => x.tag !== tag), n].sort((a, b) => a.tag.localeCompare(b.tag)).slice(-400);
  d.offen = null;
  sichern(d);
  logbuch.eintragen({ bereich: "schlaf", titel: `Geschlafen: ${dauerText(min)}`, details: `${uhrzeit(n.von)} bis ${uhrzeit(n.bis)} Uhr` });
  return { ...n, ziel: d.ziel };
}

const NACHT = /^(gute nacht|ich geh(e)? (jetzt )?(schlafen|ins bett)|ich bin (dann )?(mal )?im bett|nacht friday|schlaf gut)$/;
const MORGEN = /^(guten morgen|morgen|moin|ich bin wach|bin wach|ich bin aufgestanden)$/;
export async function quickCommand(text) {
  const { k } = sauber(text);
  if (/^(öffne |zeig )?(mein |das )?schlaf-?protokoll( an)?$|^wie (habe|hab) ich (diese woche )?geschlafen$|^wie lange (habe|hab) ich geschlafen$/.test(k)) {
    const s = stand();
    const letzte = s.liste[0];
    return { answer: letzte ? `Letzte Nacht: ${dauerText(letzte.minuten)}. Im Schnitt der letzten Tage ${s.schnittText}, dein Ziel sind ${s.ziel} Stunden.` : "Ich habe noch keine Nacht notiert. Sag abends „Gute Nacht“ und morgens „Guten Morgen“.", actions: ["wunsch:schlaf"] };
  }
  if (NACHT.test(k)) {
    const { h } = uhrJetzt();
    if (h >= 6 && h < 19) return null; // tagsüber kein Schlaf-Eintrag
    guteNacht();
    return { answer: `Gute Nacht, ${config.userName}. Ich notiere ${uhrzeit(new Date().toISOString())} Uhr als Schlafenszeit und halte die Stellung.`, actions: [] };
  }
  if (MORGEN.test(k)) {
    const n = aufgewacht();
    if (!n) return null; // normaler Morgen-Gruß: Briefing wie gewohnt
    const diff = n.minuten - n.ziel * 60;
    const bewertung = diff >= -15 ? "Gut ausgeschlafen." : diff >= -60 ? "Etwas knapp." : "Das war zu wenig, gönn dir heute eine Pause.";
    let briefing = "";
    try { briefing = await (await import("./offline.js")).offlineBriefing(); } catch { /* ohne Briefing */ }
    return { answer: `Du hast ${dauerText(n.minuten)} geschlafen. ${bewertung}${briefing ? ` ${briefing.replace(/^(Guten Morgen|Guten Tag|Guten Abend),[^.]*\.\s*/, "")}` : ""}`, actions: ["wunsch:schlaf"] };
  }
  return null;
}
