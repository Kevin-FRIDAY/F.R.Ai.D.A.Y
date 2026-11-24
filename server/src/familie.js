// Familien-Pinnwand (v1.160.0, Wunsch aus der Ideen-Schmiede).
// Mehrere Profile (Kevin, Carla …) mit eigener Liste und eigenen Erinnerungen, dazu eine gemeinsame Pinnwand.
// "Friday, schreib an die Pinnwand: Oma kommt Sonntag" · "Was steht an der Pinnwand?"
// "Setz Windeln auf Carlas Liste" · "Was steht auf Carlas Liste?" · "Erinner Carla morgen um 8 an den Arzt"
// Alles bleibt auf dem Mac (data/familie.json). Erinnerungen laufen über Fridays normale Erinnerungen.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { config } from "./config.js";
import { U } from "./datum.js";
import { neueId, sauber, tagStr, uhrzeit, datumLang } from "./wunsch-hilfe.js";
import { parseZeit } from "./offline.js";

const DATEI = "familie";
const FARBEN = ["#ff8a2a", "#38e1ff", "#ff6fb5", "#38e08c", "#a978ff", "#ffc44d"];
const lade = () => {
  const d = store.load(DATEI, {});
  return { profile: d.profile?.length ? d.profile : [{ id: "ich", name: config.userName && config.userName !== "Boss" ? config.userName : "Kevin", emoji: "🦾", farbe: FARBEN[0] }], pinnwand: d.pinnwand || [], listen: d.listen || {} };
};
const sichere = (d) => store.save(DATEI, d);
export const stand = () => { const d = lade(); return { ...d, pinnwand: d.pinnwand.slice().reverse() }; };

export function profilSpeichern({ id, name, emoji = "🙂", farbe } = {}) {
  const n = String(name || "").trim().slice(0, 30);
  if (!n) throw new Error("Wie heißt das Profil?");
  const d = lade();
  let p = d.profile.find((x) => x.id === id) || d.profile.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (!p) { if (d.profile.length >= 8) throw new Error("Höchstens 8 Profile."); p = { id: neueId() }; d.profile.push(p); }
  Object.assign(p, { name: n, emoji: String(emoji).slice(0, 4) || "🙂", farbe: /^#[0-9a-f]{6}$/i.test(farbe || "") ? farbe : p.farbe || FARBEN[d.profile.length % FARBEN.length] });
  sichere(d);
  return p;
}
export function profilWeg(id) { const d = lade(); if (d.profile.length <= 1) throw new Error("Ein Profil muss bleiben."); d.profile = d.profile.filter((p) => p.id !== id); delete d.listen[id]; sichere(d); return true; }

const finde = (d, name) => { const q = String(name || "").toLowerCase().replace(/s$/, ""); return d.profile.find((p) => p.name.toLowerCase() === q || p.name.toLowerCase() === String(name || "").toLowerCase()) || d.profile.find((p) => q && p.name.toLowerCase().startsWith(q)); };

export function anPinnwand({ text, von = "" } = {}) {
  const t = String(text || "").trim().slice(0, 300);
  if (!t) throw new Error("Was soll an die Pinnwand?");
  const d = lade();
  const p = finde(d, von) || d.profile[0];
  const e = { id: neueId(), text: t, von: p.id, at: new Date().toISOString(), erledigt: false };
  d.pinnwand.push(e);
  d.pinnwand = d.pinnwand.slice(-100);
  sichere(d);
  logbuch.eintragen({ bereich: "familie", titel: `Pinnwand: ${t}`, details: `von ${p.name}` });
  return e;
}
export function pinnAendern(id, { erledigt, weg } = {}) {
  const d = lade();
  if (weg) d.pinnwand = d.pinnwand.filter((x) => x.id !== id);
  else { const e = d.pinnwand.find((x) => x.id === id); if (e && erledigt !== undefined) e.erledigt = Boolean(erledigt); }
  sichere(d);
  return true;
}
export function aufListe({ profil, text } = {}) {
  const d = lade();
  const p = finde(d, profil) || d.profile.find((x) => x.id === profil);
  if (!p) throw new Error(`Ein Profil „${profil}“ gibt es noch nicht.`);
  const t = String(text || "").trim().slice(0, 200);
  if (!t) throw new Error("Was soll auf die Liste?");
  (d.listen[p.id] ||= []).push({ id: neueId(), text: t, erledigt: false, at: new Date().toISOString() });
  d.listen[p.id] = d.listen[p.id].slice(-150);
  sichere(d);
  return { profil: p, text: t };
}
export function listeAendern(profilId, id, { erledigt, weg } = {}) {
  const d = lade();
  const l = d.listen[profilId] || [];
  if (weg) d.listen[profilId] = l.filter((x) => x.id !== id);
  else { const e = l.find((x) => x.id === id); if (e && erledigt !== undefined) e.erledigt = Boolean(erledigt); }
  sichere(d);
  return true;
}

const PIN = U(/^(?:schreib|schreibe|häng|haeng|pinn|setz|leg)(?: bitte)?(?: mal)?(?: was| etwas)? (?:an|auf|in) (?:die|unsere) (?:pinnwand|familien-?pinnwand|familien ?wand)[,: ]+(.{2,300})$/);
const PIN_LESEN = U(/\b(was steht|was hängt|was haengt|zeig|zeige|lies|öffne|oeffne)( mir)?( an| auf)? (der |die )?(pinnwand|familien-?pinnwand)\b/);
const LISTE_DAZU = U(/^(?:setz|setze|schreib|schreibe|pack|tu)(?: bitte)? (.{2,120}?) (?:auf|in) (\p{L}{2,20}?)s? (?:liste|einkaufsliste|aufgabenliste)$/);
const LISTE_LESEN = U(/^was steht auf (\p{L}{2,20}?)s? liste$/);
const ERINNER = U(/^erinnere? (\p{L}{2,20}) (.{3,200})$/);

export function quickCommand(text) {
  const { t, k } = sauber(text);
  let m = k.match(PIN);
  if (m) {
    try { anPinnwand({ text: t.slice(t.length - m[1].length) }); return { answer: "Hängt an der Pinnwand.", actions: ["wunsch:familie"] }; } catch (err) { return { answer: err.message, actions: [] }; }
  }
  if (PIN_LESEN.test(k)) {
    const d = lade();
    const offen = d.pinnwand.filter((x) => !x.erledigt).slice(-5).reverse();
    const name = (id) => d.profile.find((p) => p.id === id)?.name || "";
    return { answer: offen.length ? `An der Pinnwand: ${offen.map((x) => `${x.text}${name(x.von) ? `, von ${name(x.von)}` : ""}`).join(". ")}.` : "Die Pinnwand ist leer.", actions: ["wunsch:familie"] };
  }
  m = k.match(LISTE_DAZU);
  if (m && !/^(die|meine|der|einkaufs)$/.test(m[2])) {
    const d = lade();
    const p = finde(d, m[2]);
    if (p) { const was = t.slice(k.indexOf(m[1]), k.indexOf(m[1]) + m[1].length); aufListe({ profil: p.id, text: was }); return { answer: `Steht auf ${p.name}s Liste.`, actions: ["wunsch:familie"] }; }
  }
  m = k.match(LISTE_LESEN);
  if (m && !/^(meine|der|die|einkaufs)$/.test(m[1])) {
    const d = lade();
    const p = finde(d, m[1]);
    if (p) { const l = (d.listen[p.id] || []).filter((x) => !x.erledigt); return { answer: l.length ? `Auf ${p.name}s Liste: ${l.slice(0, 8).map((x) => x.text).join(", ")}.` : `${p.name}s Liste ist leer.`, actions: ["wunsch:familie"] }; }
  }
  m = k.match(ERINNER);
  if (m && !/^(mich|uns|dich)$/.test(m[1])) {
    const roh = t.slice(t.length - m[2].length);
    const d = lade();
    const p = finde(d, m[1]);
    if (p) {
      const z = parseZeit(m[2]);
      if (z?.date) {
        const was = roh.replace(new RegExp(z.match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ").replace(/\b(übermorgen|uebermorgen|morgen|heute)\b/gi, " ").replace(/\s+/g, " ").trim().replace(/^(an|daran|dass) /i, "") || roh;
        store.addReminder(`Für ${p.name}: ${was}`, z.date.toISOString());
        const tag = tagStr(0, z.date.getTime());
        const wann = tag === tagStr() ? "heute" : tag === tagStr(1) ? "morgen" : `am ${datumLang(z.date.toISOString())}`;
        return { answer: `Okay, ich erinnere ${p.name} ${wann} um ${uhrzeit(z.date.toISOString())} Uhr an ${was}.`, actions: ["wunsch:familie"] };
      }
    }
  }
  return null;
}
