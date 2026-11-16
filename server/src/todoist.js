// Todoist: Aufgaben per Sprache ("Füg Steuererklärung zu Todoist hinzu", "Was steht heute in Todoist?").
// Schlüssel: todoist.com → Einstellungen → Integrationen → Entwickler → API-Token.
import * as V from "./verbindungen.js";
import { U } from "./datum.js";

const API = () => String(process.env.TODOIST_API || "https://api.todoist.com/api/v1").replace(/\/$/, "");
const d = () => V.get("todoist");
export const todoistBereit = () => Boolean(d().token);
// Wenn an: Aufgaben, die man Friday sagt ("Neue Aufgabe: …", "Was muss ich heute machen?"), gehen direkt an Todoist.
export const todoistFuerAlles = () => todoistBereit() && d().alles === true;

async function td(method, pfad, body, query, tokenWunsch) {
  const t = tokenWunsch || d().token;
  if (!t) return { ok: false, error: "Todoist ist noch nicht eingerichtet. Werkzeug-Menü → Verbindungen → Todoist." };
  const q = query ? `?${new URLSearchParams(query)}` : "";
  const r = await V.holeJson(`${API()}${pfad}${q}`, { method, headers: { Authorization: `Bearer ${t}` }, body });
  if (r.netz) return { ok: false, error: "Todoist ist gerade nicht erreichbar." };
  if (r.status === 401 || r.status === 403) return { ok: false, status: r.status, error: "Todoist lehnt den Schlüssel ab. Kopier das API-Token nochmal aus den Todoist-Einstellungen." };
  if (!r.ok) return { ok: false, status: r.status, error: `Todoist meldet Fehler ${r.status}.` };
  return { ok: true, data: r.data };
}
// Neue API liefert {results: [...], next_cursor}; ältere liefern direkt eine Liste.
const liste = (data) => (Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : Array.isArray(data?.items) ? data.items : []);

async function alle(pfad, query = {}) {
  const out = [];
  let cursor = null;
  for (let i = 0; i < 5; i++) {
    const r = await td("GET", pfad, null, { ...query, ...(cursor ? { cursor } : {}), limit: "200" });
    if (!r.ok) return r;
    out.push(...liste(r.data));
    cursor = r.data?.next_cursor;
    if (!cursor) break;
  }
  return { ok: true, items: out };
}

export async function aufgaben(filter = "") {
  const r = filter ? await alle("/tasks/filter", { query: filter, lang: "de" }) : await alle("/tasks");
  if (!r.ok) return r;
  return { ok: true, aufgaben: r.items.map((t) => ({ id: String(t.id), text: String(t.content || ""), faellig: t.due?.string || t.due?.date || null, datum: t.due?.date || null, prio: t.priority || 1 })) };
}

export async function neu(text, wann = "") {
  const inhalt = String(text || "").trim().slice(0, 500);
  if (!inhalt) return { ok: false, error: "Was soll in Todoist?" };
  const body = { content: inhalt };
  if (wann) Object.assign(body, { due_string: String(wann).slice(0, 80), due_lang: "de" });
  const r = await td("POST", "/tasks", body);
  if (!r.ok) return r;
  let f = r.data?.due?.string || r.data?.due?.date;
  if (f) f = String(f).replace(/\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
  return { ok: true, text: `In Todoist: ${inhalt}${f ? `, fällig ${f}` : ""}.` };
}

export async function erledigt(wunsch) {
  const l = await aufgaben();
  if (!l.ok) return l;
  const t = V.bester(wunsch, l.aufgaben, (x) => x.text, 0.5);
  if (!t) return { ok: false, error: `In Todoist finde ich keine offene Aufgabe zu „${wunsch}“.` };
  const r = await td("POST", `/tasks/${encodeURIComponent(t.id)}/close`);
  return r.ok ? { ok: true, text: `Erledigt: ${t.text}.` } : r;
}

function vorlesen(l, leer, titel) {
  if (!l.length) return leer;
  const namen = l.slice(0, 7).map((t) => t.text);
  const rest = l.length > 7 ? ` und ${l.length - 7} weitere` : "";
  return `${titel} ${l.length === 1 ? "eine Aufgabe" : `${l.length} Aufgaben`}: ${V.aufzaehlen(namen)}${rest}.`;
}

export async function heuteSatz() {
  if (!todoistBereit()) return null;
  const r = await aufgaben("today | overdue").catch(() => null);
  if (!r?.ok) return null;
  return r.aufgaben.length ? vorlesen(r.aufgaben, "", "In Todoist hast du heute") : null;
}

export async function command({ action, value, wann } = {}) {
  switch (String(action || "")) {
    case "heute": {
      const r = await aufgaben("today | overdue");
      return r.ok ? { ok: true, text: vorlesen(r.aufgaben, "In Todoist ist heute nichts fällig.", "In Todoist hast du heute"), aufgaben: r.aufgaben.slice(0, 30) } : r;
    }
    case "liste": {
      const r = await aufgaben();
      return r.ok ? { ok: true, text: vorlesen(r.aufgaben, "In Todoist ist nichts offen.", "Offen in Todoist sind"), aufgaben: r.aufgaben.slice(0, 50) } : r;
    }
    case "neu": return neu(value, wann);
    case "erledigt": return erledigt(String(value || ""));
    default: return { ok: false, error: "Unbekannte Todoist-Aktion." };
  }
}

// ---------- Fenster "Verbindungen" ----------
export const info = { id: "todoist", name: "Todoist", emoji: "✅", kurz: "Deine Aufgaben per Sprache: eintragen, vorlesen, abhaken." };

export async function status() {
  const x = d();
  const ein = todoistBereit();
  return {
    ...info,
    eingerichtet: ein,
    text: ein ? `Verbunden${x.alles ? " · alle Aufgaben, die du Friday sagst, landen in Todoist" : ""}` : "Nicht eingerichtet.",
    felder: ein ? [] : [{ name: "token", label: "Todoist-API-Token", typ: "password", platzhalter: "40 Zeichen" }],
    auswahl: ein ? [{ name: "alles", label: "„Neue Aufgabe …“ speichern in", wert: x.alles ? "todoist" : "friday", optionen: [{ wert: "friday", text: "Fridays eigener Liste" }, { wert: "todoist", text: "Todoist" }] }] : [],
    aktionen: ein ? [{ action: "heute", text: "📋 Heute fällig" }, { action: "liste", text: "🗂 Alle offenen" }] : [],
  };
}
export async function einrichten({ token } = {}) {
  const t = String(token || "").trim();
  if (!V.schluesselOk(t, 20, 200)) return { ok: false, error: "Das Todoist-Token hat rund 40 Zeichen ohne Leerzeichen." };
  const r = await td("GET", "/projects", null, { limit: "5" }, t);
  if (!r.ok) return r;
  V.set("todoist", { token: t });
  return { ok: true, text: "Todoist ist verbunden." };
}
export async function einstellen({ name, wert } = {}) {
  if (name === "alles") { V.set("todoist", { alles: wert === "todoist" ? true : undefined }); return { ok: true }; }
  return { ok: false, error: "Unbekannte Einstellung." };
}
export function vergessen() {
  V.clear("todoist");
  return { ok: true };
}

// ---------- Sprachbefehle ohne Claude ----------
export async function quick(t) {
  if (!todoistBereit()) return /\btodoist\b/.test(t) ? "Todoist ist noch nicht verbunden. Das geht im Werkzeug-Menü unter Verbindungen." : null;
  const sag = (r) => (r.ok ? r.text : r.error);
  const alles = todoistFuerAlles();
  let m;
  // Lesen
  if (/^(was steht|was ist)( heute)? (in|auf) (meinem |meiner |dem )?todoist( heute)?( an)?$|^(meine |zeig |lies |zeig mir |lies mir )?(meine )?todoist( aufgaben| liste)?( für heute| heute)?$|^todoist (heute|aufgaben)$/.test(t)) {
    return sag(await command({ action: /alle|liste/.test(t) && !/heute/.test(t) ? "liste" : "heute" }));
  }
  if (/^(alle|alle offenen) todoist[- ]?aufgaben$|^was ist (alles )?offen in todoist$/.test(t)) return sag(await command({ action: "liste" }));
  if (alles && U(/^(was steht (auf|in) (meiner|der|meinen|den) (aufgaben|to ?do|todo)( ?liste)?|(lies|zeig)( mir)? (meine|die) (aufgaben|to ?dos?|todos?)( ?liste)?|(meine|offene|die) (aufgaben|to ?dos?|todos?)( ?liste)?|welche aufgaben (habe|hab) ich( noch)?( offen)?|aufgaben( ?liste)?|to ?dos?|todo ?liste|was muss ich (heute )?(noch )?(machen|erledigen|tun))$/).test(t)) {
    return sag(await command({ action: /heute/.test(t) ? "heute" : "liste" }));
  }
  // Eintragen
  m = t.match(U(/^(?:füg|füge|fueg|fuege|setz|setze|schreib|schreibe|trag|trage|pack|packe) (.+?) (?:zu|auf|in|bei) (?:meine[nm]?|die|das|den)? ?todoist(?:[- ]liste)?(?: hinzu| ein)?$/))
    || t.match(U(/^todoist[: ]+(?:neue aufgabe[: ]+)?(.+)$/))
    || t.match(U(/^neue todoist[- ]aufgabe[: ]+(.+)$/));
  if (!m && alles) {
    m = t.match(U(/^(?:neue aufgabe|aufgabe|notiere aufgabe|to ?do)[: ]+(.+)$/)) || t.match(U(/^(?:setz|setze|schreib|schreibe|trag|trage|füg|füge|fueg|fuege) (.+?) (?:auf|in|zu) (?:meine|die) (?:aufgaben|to ?do)(?: ?liste)?(?: hinzu)?$/));
  }
  if (m) {
    let text = m[1].trim();
    if (/^(heute|aufgaben|liste)$/.test(text)) return null;
    // "Steuererklärung bis Freitag" / "Müll rausbringen morgen" -> Fälligkeit an Todoist geben
    let wann = "";
    const f = text.match(U(/^(.+?)\s+(?:bis |für |fuer |am )?(heute|morgen|übermorgen|uebermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|nächste woche|naechste woche|jeden (?:tag|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag))( um \d{1,2}(?::\d{2})?(?: uhr)?)?$/));
    if (f) { text = f[1]; wann = `${f[2]}${f[3] || ""}`.trim(); }
    return sag(await neu(text.charAt(0).toUpperCase() + text.slice(1), wann));
  }
  // Abhaken
  m = t.match(U(/^(?:hake|hak|haken) (.+?) (?:in todoist )?ab$/)) || t.match(U(/^(.+?) in todoist (?:ist )?erledigt$/)) || t.match(U(/^todoist (.+?) erledigt$/));
  if (m && (/todoist/.test(t) || alles)) return sag(await erledigt(m[1]));
  return null;
}
