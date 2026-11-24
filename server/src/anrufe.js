// Anrufe & Nachrichten: "Friday, ruf meine Frau an und sag ihr, dass ich heute Pizza essen will."
// Friday erreicht nur Kontakte, die Kevin selbst im Fenster "Verbindungen" einträgt.
//
// Drei Wege:
//  - nachricht: iMessage (oder SMS übers iPhone) aus der Nachrichten-App des Macs. Kostenlos.
//  - facetime:  Nachricht wie oben UND der Mac startet einen FaceTime-Audio-Anruf. Kostenlos, man spricht selbst.
//  - twilio:    echter Telefonanruf, Friday spricht die Nachricht mit ihrer Stimme. Braucht ein Twilio-Konto (kostet).
import { eintragen } from "./logbuch.js";
import { config } from "./config.js";
import { isAgentOnline, sendToAgent } from "./agent-hub.js";
import * as V from "./verbindungen.js";
import { U } from "./datum.js";
import { IST_EVE } from "./config.js";
import { istFrei } from "./eve.js";

// v1.147.0 (im Test, in Friday erst nach Freigabe in Eve): Nachrichten gehen direkt an den Empfänger.
// "Schick meiner Frau, dass ich sie liebe" → "Ich liebe dich." statt "Ich liebe sie."
export const FUNKTION_DU = "nachricht-du-form";
export const duFormFrei = () => IST_EVE || istFrei(FUNKTION_DU);

const d = () => V.get("anrufe");
const boss = () => config.userName || "Boss";
const ich = () => d().ich_name || config.userName || "Kevin";

// ---------- Nummern ----------
// "0171 / 123 45-67" → "+491711234567", "0049…" → "+49…". Apple-ID-Mails (nur iMessage) bleiben, wie sie sind.
export function nummerNorm(roh, land = "+49") {
  const s = String(roh || "").trim();
  if (!s) return "";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s.toLowerCase();
  let n = s.replace(/[\s()/.\-]/g, "");
  if (!/^\+?\d{5,16}$/.test(n)) return null;
  if (n.startsWith("00")) n = "+" + n.slice(2);
  else if (n.startsWith("0")) n = land + n.slice(1);
  else if (!n.startsWith("+")) n = "+" + n;
  return n;
}
const istMail = (n) => n.includes("@");
const zeigeNummer = (n) => (istMail(n) ? n : /^\+491/.test(n) ? n.replace(/^(\+49)(1\d\d)(\d+)$/, "$1 $2 $3") : n.replace(/^(\+\d{2})(\d{2,4})(\d+)$/, "$1 $2 $3"));

// ---------- Kontakte ----------
const FRAU = ["frau", "ehefrau", "schatz", "liebling", "liebste", "gattin", "partnerin", "freundin"];
const MICH = ["mich", "mir", "ich", "mein handy", "meinem handy", "mein iphone", "meinem iphone"];

export function kontakte() {
  const x = d();
  const liste = [];
  if (x.frau_nummer) liste.push({ id: "frau", name: x.frau_name || "deine Frau", nummer: x.frau_nummer, rolle: "frau" });
  if (x.ich_nummer) liste.push({ id: "ich", name: ich(), nummer: x.ich_nummer, rolle: "ich" });
  for (const k of x.weitere || []) if (k?.name && k?.nummer) liste.push({ id: `k:${k.name}`, name: k.name, nummer: k.nummer, rolle: "weitere" });
  return liste;
}
export const anrufeBereit = () => kontakte().length > 0;
export const twilioBereit = () => Boolean(d().twilio_sid && d().twilio_token && d().twilio_von);

// "meine Frau", "meiner Frau", "Anna", "mich", "Mama" → Kontakt (oder null)
export function findeKontakt(wer) {
  let w = V.norm(wer).replace(/^(an |bei |zu )/, "").replace(/^(meine[mnrs]?|die|der|den|dem|unsere?[mnr]?) /, "").trim();
  if (!w) return null;
  const alle = kontakte();
  const frau = alle.find((k) => k.rolle === "frau");
  const selbst = alle.find((k) => k.rolle === "ich");
  if (MICH.includes(w) || MICH.includes(V.norm(wer))) return selbst || { fehlt: "ich" };
  if (FRAU.includes(w)) return frau || { fehlt: "frau" };
  return V.bester(w, alle, (k) => k.name, 0.6) || (frau && V.passt(w, frau.name) > 0.5 ? frau : null);
}

// ---------- Text umformen ----------
// "dass ich heute Pizza essen will" → "Ich will heute Pizza essen."
// Im Nebensatz steht das Verb hinten; für die Nachricht wandert es nach vorne.
export function hauptsatz(roh, { mehr = false } = {}) {
  let t = String(roh || "").trim().replace(/^[,:\s]+/, "").replace(/[.\s]+$/, "");
  t = t.replace(/^(bitte |mal |doch )/i, "");
  const dass = /^dass\s+/i.test(t);
  if (dass) {
    t = t.replace(/^dass\s+/i, "");
    const w = t.split(/\s+/);
    // mehr: auch "dass sie heute kommen soll" → "Sie soll heute kommen" (nur ein einfacher Satz ohne Komma)
    const subj = mehr && !/[,;]/.test(t) ? /^(ich|wir|sie|er|du|es|man)$/i : /^(ich|wir)$/i;
    if (w.length >= 3 && subj.test(w[0])) {
      const verb = w.pop();
      // mehr: trennbare Verben wieder trennen ("dass ich dein Auto abhole" → "Ich hole dein Auto ab")
      const tr = mehr && w.length >= 2 && !/^(antwort|analys|ander|angel|arbeit)/i.test(verb)
        ? /^(zurück|vorbei|zusammen|weiter|heim|fest|weg|los|nach|mit|auf|aus|ein|vor|ab|an|zu)(\p{L}{3,})$/iu.exec(verb) : null;
      if (tr) { w.splice(1, 0, tr[2]); w.push(tr[1]); } else w.splice(1, 0, verb);
      t = w.join(" ");
    }
  }
  if (!t) return "";
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(t) ? t : t + ".";
}

// ---------- Du-Form: an den Empfänger, nicht über ihn ----------
const VERB_DU = {
  ist: "bist", hat: "hast", wird: "wirst", war: "warst", kann: "kannst", muss: "musst", soll: "sollst", darf: "darfst",
  will: "willst", mag: "magst", "möchte": "möchtest", "weiß": "weißt", tut: "tust", "wäre": "wärst", "würde": "würdest",
  "könnte": "könntest", sollte: "solltest", "müsste": "müsstest", "dürfte": "dürftest", "hätte": "hättest", wollte: "wolltest",
  konnte: "konntest", musste: "musstest", durfte: "durftest", hatte: "hattest", wurde: "wurdest", "isst": "isst", "liest": "liest",
};
const HILFSVERB = new Set(["ist", "hat", "wird", "war", "kann", "muss", "soll", "darf", "will", "mag", "möchte", "wäre", "würde", "könnte", "sollte", "hätte", "hatte", "wollte"]);
const PLURAL = /^(sind|haben|werden|waren|können|müssen|sollen|dürfen|wollen|mögen|möchten|wären|würden|hätten|hatten)$/i;
const BINDE = new Set(["und", "aber", "oder", "weil", "dass", "ob", "wenn", "wie", "damit", "als", "denn", "sondern", "obwohl", "bis", "nachdem", "sobald"]);
const NEBEN = new Set(["weil", "dass", "ob", "wenn", "wie", "damit", "als", "obwohl", "bis", "nachdem", "sobald"]);
const POSS = { "": "dein", e: "deine", en: "deinen", em: "deinem", er: "deiner", es: "deines" };

export function verbDu(v) {
  const w = String(v || ""), k = w.toLowerCase();
  if (VERB_DU[k]) return VERB_DU[k];
  if (/(st|zt|ßt|xt|ss)$/.test(k)) return w;      // heißt, sitzt, isst
  if (/[dt]et$/.test(k)) return w.slice(0, -1) + "st"; // arbeitet → arbeitest
  if (/[^aeiouäöü]t$/.test(k) || /[aeiouäöühr]t$/.test(k)) return w.slice(0, -1) + "st"; // liebt → liebst, geht → gehst
  if (/te$/.test(k)) return w + "st";                // kaufte → kauftest
  return w;
}

// Wer ist der Empfänger: "w" (sie/ihr), "m" (er/ihn) oder null (unklar)
function geschlecht(k, t) {
  if (k?.rolle === "frau") return "w";
  if (k?.rolle === "ich" || !k) return null;
  const n = V.norm(k.name || "");
  if (/(mama|mutter|mutti|oma|schwester|tante|tochter|freundin|frau|cousine|nichte|chefin)\b/.test(n)) return "w";
  if (/(papa|vater|vati|opa|bruder|onkel|sohn|freund|mann|cousin|neffe|chef)\b/.test(n)) return "m";
  const w = /\b(sie|ihr|ihre[mnrs]?)\b/i.test(t), m = /\b(er|ihn|ihm|sein|seine[mnrs]?)\b/i.test(t);
  return w && !m ? "w" : m && !w ? "m" : null;
}

/** Formt "Ich liebe sie." für den Empfänger k um zu "Ich liebe dich." (nur Pronomen, die den Empfänger meinen). */
export function duForm(satz, k) {
  const t = String(satz || "");
  const g = geschlecht(k, t);
  if (!t || !g) return t;
  const tok = t.split(/(\s+)/); // Wörter und Leerzeichen abwechselnd
  const idx = []; for (let i = 0; i < tok.length; i++) if (/\S/.test(tok[i])) idx.push(i);
  const kern = (s) => s.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  const setze = (i, neu) => { const alt = tok[i]; const w = kern(alt); const g1 = w[0] && w[0] === w[0].toUpperCase(); tok[i] = alt.replace(w, g1 ? neu[0].toUpperCase() + neu.slice(1) : neu); };
  const klauselEnde = (p) => { // Wortposition des letzten Worts dieses Nebensatzes
    for (let q = p; q < idx.length; q++) { if (/[,.;!?]$/.test(tok[idx[q]]) || q === idx.length - 1) return q; if (BINDE.has(kern(tok[idx[q + 1]] || "").toLowerCase())) return q; }
    return idx.length - 1;
  };
  let subjekt = false;
  for (let p = 0; p < idx.length; p++) {
    const i = idx[p], w = kern(tok[i]), lw = w.toLowerCase();
    const vor = p > 0 ? kern(tok[idx[p - 1]]).toLowerCase() : "";
    const vorEnde = p > 0 && /[,.;!?]$/.test(tok[idx[p - 1]]);
    const nach = p + 1 < idx.length ? kern(tok[idx[p + 1]]) : "";
    const istSubj = (g === "w" && lw === "sie") || (g === "m" && lw === "er");
    if (istSubj) {
      if (p === 0 || vorEnde || BINDE.has(vor)) {
        // Hauptsatz: Verb direkt danach; Nebensatz (dass, weil, ob …): Verb am Ende
        const vp = NEBEN.has(vor) ? klauselEnde(p) : p + 1;
        const verb = vp < idx.length ? kern(tok[idx[vp]]) : "";
        if (PLURAL.test(verb) || /en$/i.test(verb) && vp === p + 1) continue; // "sie sind …" = mehrere Leute
        setze(i, "du"); if (verb && vp !== p) setze(idx[vp], verbDu(verb)); subjekt = true;
        continue;
      }
      if (HILFSVERB.has(vor) || (/[^e]t$/.test(vor) && p >= 2 && lw === "er")) { // "heute soll sie kommen"
        setze(i, "du"); setze(idx[p - 1], verbDu(kern(tok[idx[p - 1]]))); subjekt = true; continue;
      }
      if (g === "w") setze(i, "dich"); // "ich liebe sie" → "ich liebe dich"
      continue;
    }
    if (g === "w" && lw === "sie") { setze(i, "dich"); continue; }
    if (g === "m" && lw === "ihn") { setze(i, "dich"); continue; }
    if (g === "m" && lw === "ihm") { setze(i, "dir"); continue; }
    const poss = g === "w" ? /^ihr(e|en|em|er|es)?$/i.exec(w) : /^sein(e|en|em|er|es)?$/i.exec(w);
    if (poss) {
      const end = poss[1] || "";
      // "ihr" ohne Endung: vor einem Nomen (groß geschrieben) = "dein", sonst = "dir" ("ich habe ihr Blumen gekauft")
      if (g === "w" && !end && !(nach && nach[0] === nach[0].toUpperCase() && /\p{L}/u.test(nach[0]) && !/^(Blumen|Geschenke)$/.test(nach))) setze(i, "dir");
      else setze(i, POSS[end.toLowerCase()]);
      continue;
    }
    if (subjekt && lw === "sich") setze(i, "dich");
  }
  let out = tok.join("");
  if (/^ob\s/i.test(out)) out = out.replace(/[.]$/, "?");
  return out.charAt(0).toUpperCase() + out.slice(1);
}

// "in der steht", "mit dem Text" usw. vor der eigentlichen Nachricht weglassen
export function ohneEinleitung(t) {
  return String(t || "").replace(/^[,:\s]*(?:(?:in der|wo(?: da)?(?: drin)?|worin|auf der) (?:steht|stehen soll)|(?:mit|und) (?:dem|folgendem|diesem) (?:text|inhalt)|die (?:lautet|heißt|heisst)|(?:dass )?(?:da|darin|drin) (?:steht|stehen soll)|mit folgendem|folgendes|und (?:schreib|schreibe) (?:ihr|ihm)|und (?:sag|sage) (?:ihr|ihm))[,:\s]*/i, "");
}

/** Der Text, der beim Empfänger ankommt. */
export function nachrichtText(text, k) {
  if (!text) return "";
  if (!duFormFrei()) return hauptsatz(text);
  return duForm(hauptsatz(ohneEinleitung(text), { mehr: true }), k);
}

// So spricht Friday am Telefon: [Begrüßung, Nachricht]
function ansage(k, text) {
  if (k.rolle === "ich") return [`Hallo ${ich()}, hier ist Friday.`, text ? `Deine Nachricht: ${text}` : "Du wolltest, dass ich dich anrufe."];
  const name = k.rolle === "frau" && !d().frau_name ? "" : ` ${k.name}`;
  return [`Hallo${name}, hier ist Friday, die Assistentin von ${ich()}.`, text ? `${ich()} lässt dir ausrichten: ${text}` : `${ich()} bittet dich um einen Rückruf.`];
}

// ---------- Mac (Nachrichten-App, FaceTime) ----------
function macFehler(r) {
  const e = String(r?.error || "");
  if (/nicht verbunden/.test(e)) return `Der Mac ist gerade nicht verbunden, ${boss()}. Nachrichten verschicke ich über die Nachrichten-App am Mac.`;
  if (/Unbekannte Aktion/.test(e)) return "Der Mac-Agent ist noch auf einem alten Stand. Starte Friday einmal neu, dann klappt das.";
  if (/-1743|not allowed|nicht erlaubt|Not authorized/i.test(e)) return "macOS erlaubt Friday die Nachrichten-App noch nicht. Systemeinstellungen → Datenschutz & Sicherheit → Automation: bei node „Nachrichten“ einschalten.";
  return `Das hat am Mac nicht geklappt: ${e || "unbekannter Fehler"}.`;
}

async function sendeNachricht(k, text) {
  if (!isAgentOnline()) return { ok: false, error: macFehler({ error: "nicht verbunden" }) };
  const zusatz = d().signatur === false ? "" : " (über Friday)";
  const r = await sendToAgent("nachricht_senden", { value: JSON.stringify({ an: k.nummer, text: `${text}${zusatz}` }) }, 30000);
  return r.ok ? { ok: true, weg: r.weg || "iMessage" } : { ok: false, error: macFehler(r) };
}

async function starteFaceTime(k) {
  if (!isAgentOnline()) return { ok: false, error: macFehler({ error: "nicht verbunden" }) };
  const r = await sendToAgent("anruf_starten", { value: JSON.stringify({ an: k.nummer }) }, 20000);
  return r.ok ? { ok: true } : { ok: false, error: macFehler(r) };
}

// ---------- Twilio (echter Anruf) ----------
const TWILIO = () => String(process.env.TWILIO_API || "https://api.twilio.com").replace(/\/$/, "");
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function twilioAuth(sid = d().twilio_sid, token = d().twilio_token) {
  return { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` };
}
function twilioFehler(r) {
  if (r.netz) return "Twilio ist gerade nicht erreichbar.";
  if (r.status === 401) return "Twilio lehnt die Zugangsdaten ab. Prüf Account SID und Auth Token in der Twilio-Konsole.";
  const msg = String(r.data?.message || "");
  if (/unverified/i.test(msg)) return "Mit einem Twilio-Testkonto darf Friday nur bestätigte Nummern anrufen. Trag die Nummer in der Twilio-Konsole unter Verified Caller IDs ein oder lade das Konto auf.";
  if (/geo|permission to call/i.test(msg)) return "Twilio darf in dieses Land noch nicht anrufen. In der Twilio-Konsole unter Voice → Geo Permissions Deutschland erlauben.";
  if (/balance|funds/i.test(msg)) return "Das Twilio-Guthaben ist leer.";
  return `Twilio meldet: ${msg || `Fehler ${r.status}`}`;
}

// Friday sagt die Begrüßung einmal und die Nachricht zweimal (falls man sie beim ersten Mal nicht versteht).
export function twiml(gruss, botschaft = "") {
  const v = xml(d().twilio_stimme || "Polly.Vicki");
  const say = (t) => `<Say language="de-DE" voice="${v}">${xml(String(t).slice(0, 1000))}</Say>`;
  return `<Response><Pause length="1"/>${say(gruss)}${botschaft ? `${say(botschaft)}<Pause length="1"/>${say(`Ich wiederhole: ${botschaft}`)}` : ""}${say("Tschüss!")}</Response>`;
}

async function twilioAnruf(k, text) {
  if (!twilioBereit()) return { ok: false, error: "Für echte Anrufe braucht Friday ein Twilio-Konto. Das trägst du im Fenster Verbindungen unter Anrufe ein." };
  if (istMail(k.nummer)) return { ok: false, error: `Für ${k.name} ist nur eine Apple-ID hinterlegt. Für einen Anruf braucht Friday eine Telefonnummer.` };
  const x = d();
  const r = await V.holeJson(`${TWILIO()}/2010-04-01/Accounts/${encodeURIComponent(x.twilio_sid)}/Calls.json`, {
    method: "POST", form: true, headers: twilioAuth(), timeout: 15000,
    body: { To: k.nummer, From: x.twilio_von, Twiml: twiml(...ansage(k, text)) },
  });
  return r.ok ? { ok: true, sid: r.data?.sid } : { ok: false, error: twilioFehler(r) };
}

// Weckruf (v1.161.0): Friday ruft Kevin selbst an und spricht die Meldung. Nur mit Twilio.
export async function anrufAnMich(text) {
  const k = kontakte().find((x) => x.rolle === "ich");
  if (!k) return { ok: false, error: "Deine eigene Handynummer fehlt (Verbindungen → Anrufe & Nachrichten)." };
  // Emojis vorlesen klingt seltsam ("Feuer Friday Warnung") – weg damit.
  const t = String(text || "").replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").replace(/\s+/g, " ").trim();
  return twilioAnruf(k, t.slice(0, 600));
}

// ---------- Der eigentliche Auftrag ----------
const weg = () => {
  const w = d().anruf_weg;
  if (w === "twilio" && !twilioBereit()) return "nachricht";
  return ["nachricht", "facetime", "twilio"].includes(w) ? w : twilioBereit() ? "twilio" : "nachricht";
};
const ihr = (k) => (k.rolle === "ich" ? "dir" : k.rolle === "frau" ? "ihr" : k.name);
const wen = (k) => (k.rolle === "ich" ? "dich" : k.rolle === "frau" ? (d().frau_name || "deine Frau") : k.name);

/**
 * @param {{an:string|object, text?:string, art?:"nachricht"|"anruf"}} p
 */
export async function ausfuehren(p = {}) {
  const r = await ausfuehrenIntern(p);
  // Logbuch: an wen, was, auf welchem Weg – und ob es geklappt hat.
  try {
    const k = typeof p.an === "object" && p.an ? p.an : findeKontakt(p.an);
    const wer = k && !k.fehlt ? wen(k) : k?.fehlt === "frau" ? "deine Frau" : k?.fehlt === "ich" ? "dich" : String(p.an?.name || p.an || "?");
    const satz = p.text && !k?.fehlt ? nachrichtText(p.text, k) : "";
    const weg = r.aktion === "anruf" ? "Anruf (Twilio)" : r.aktion === "facetime" ? "FaceTime" : r.aktion === "nachricht" ? "iMessage/SMS" : "";
    eintragen({
      bereich: "anruf",
      titel: `${p.art === "anruf" ? "Anruf" : "Nachricht"} an ${wer}${satz ? `: „${satz}“` : ""}`,
      details: r.ok ? `${weg ? `Weg: ${weg}. ` : ""}${r.text || ""}` : r.error,
      ok: Boolean(r.ok),
    });
  } catch { /* egal */ }
  return r;
}

async function ausfuehrenIntern({ an, text = "", art = "nachricht" } = {}) {
  const k = typeof an === "object" && an ? an : findeKontakt(an);
  if (!k) return { ok: false, error: `„${an}“ kenne ich nicht, ${boss()}. Trag den Kontakt im Fenster Verbindungen unter Anrufe ein. Ich schreibe nur Leuten, die du dort hinterlegst.` };
  if (k.fehlt === "frau") return { ok: false, error: "Ich habe noch keine Nummer von deiner Frau. Trag sie im Werkzeug-Menü unter Verbindungen → Anrufe ein." };
  if (k.fehlt === "ich") return { ok: false, error: "Ich habe deine eigene Handynummer noch nicht. Trag sie im Werkzeug-Menü unter Verbindungen → Anrufe ein." };
  const satz = text ? nachrichtText(text, k) : "";
  if (art === "nachricht" && !satz) return { ok: false, error: `Was soll ich ${ihr(k)} schreiben?` };

  if (art === "anruf") {
    const w = weg();
    if (w === "twilio") {
      const r = await twilioAnruf(k, satz);
      if (!r.ok) return r;
      return { ok: true, text: `Ich rufe ${wen(k)} jetzt an${satz ? ` und sage: ${satz}` : "."}`, aktion: "anruf" };
    }
    // Ohne Twilio: Nachricht schicken, bei "facetime" zusätzlich den Anruf am Mac starten.
    let teil = "";
    if (satz) {
      const n = await sendeNachricht(k, satz);
      if (!n.ok) return n;
      teil = `Ich habe ${ihr(k)} geschrieben: ${satz}`;
    }
    if (w === "facetime" && k.rolle !== "ich") {
      const f = await starteFaceTime(k);
      if (!f.ok) return teil ? { ok: true, text: `${teil} Den FaceTime-Anruf konnte ich nicht starten.` } : f;
      return { ok: true, text: `${teil ? teil + " Und ich starte" : "Ich starte"} am Mac einen FaceTime-Anruf. Tipp dort auf Anrufen, dann kannst du selbst sprechen.`.trim(), aktion: "facetime" };
    }
    if (!satz) return { ok: false, error: `Was soll ich ${ihr(k)} sagen?` };
    return { ok: true, text: `${teil} Echt anrufen kann ich erst mit Twilio, darum kam es als Nachricht.`, aktion: "nachricht" };
  }

  const n = await sendeNachricht(k, satz);
  if (!n.ok) return n;
  return { ok: true, text: `Erledigt, ${boss()}. Ich habe ${ihr(k)} geschrieben: ${satz}`, aktion: "nachricht" };
}

// ---------- Werkzeug für Claude ----------
export async function command({ action, an, value, text } = {}) {
  const a = String(action || "");
  if (a === "kontakte" || a === "liste") {
    const l = kontakte();
    return { ok: true, text: l.length ? `Hinterlegt: ${V.aufzaehlen(l.map((k) => (k.rolle === "frau" ? `${k.name} (Frau)` : k.rolle === "ich" ? `${k.name} selbst` : k.name)))}.` : "Noch keine Kontakte hinterlegt.", kontakte: l.map(({ name, rolle }) => ({ name, rolle })), anruf_weg: weg() };
  }
  if (a === "test_nachricht" || a === "test_anruf") {
    const k = kontakte().find((x) => x.rolle === "ich");
    if (!k) return { ok: false, error: "Trag zuerst deine eigene Handynummer ein, dann schicke ich dir den Test." };
    if (a === "test_nachricht") {
      const r = await sendeNachricht(k, "Test von Friday: Nachrichten funktionieren.");
      return r.ok ? { ok: true, text: `Testnachricht ist raus (${r.weg}). Schau auf dein iPhone.`, sprechen: true } : r;
    }
    const r = await twilioAnruf(k, "Das ist ein Testanruf. Anrufe funktionieren.");
    return r.ok ? { ok: true, text: "Friday ruft dich jetzt an.", sprechen: true } : r;
  }
  if (a === "nachricht" || a === "anruf") return ausfuehren({ an: String(an || ""), text: String(text ?? value ?? ""), art: a });
  return { ok: false, error: "Unbekannte Aktion." };
}

// ---------- Fenster "Verbindungen" ----------
export const info = { id: "anrufe", name: "Anrufe & Nachrichten", emoji: "📞", kurz: "„Ruf meine Frau an und sag ihr …“ – iMessage, FaceTime oder echter Anruf.", ohneSchluessel: true, knopf: "Speichern" };

export async function status() {
  const x = d();
  const l = kontakte();
  const ein = l.length > 0;
  const wege = { nachricht: "per iMessage/SMS", facetime: "per iMessage + FaceTime-Anruf am Mac", twilio: "als echter Anruf (Twilio)" };
  const weitere = (x.weitere || []).map((k) => `${k.name} = ${zeigeNummer(k.nummer)}`).join(", ");
  return {
    ...info,
    eingerichtet: ein,
    text: ein
      ? `${l.length === 1 ? "1 Kontakt" : `${l.length} Kontakte`}: ${V.aufzaehlen(l.map((k) => k.name))}. „Ruf … an“ geht ${wege[weg()]}.${isAgentOnline() ? "" : " Der Mac ist gerade nicht verbunden."}`
      : "Noch keine Kontakte. Trag unten die Nummer deiner Frau und deine eigene ein.",
    hinweis: "Friday schreibt und ruft nur die Kontakte an, die hier stehen. Nachrichten gehen kostenlos über die Nachrichten-App am Mac (dein iMessage). Für echte Anrufe, bei denen Friday selbst spricht, brauchst du ein Twilio-Konto mit Telefonnummer (ein paar Euro im Monat). Anleitung: anleitungen/18-anrufe.md.",
    felder: [
      { name: "frau_name", label: "Name deiner Frau", platzhalter: "z. B. Anna", wert: x.frau_name || "" },
      { name: "frau_nummer", label: "Handynummer deiner Frau (oder ihre Apple-ID)", platzhalter: "0171 1234567", wert: x.frau_nummer ? zeigeNummer(x.frau_nummer) : "" },
      { name: "ich_nummer", label: "Deine eigene Handynummer", platzhalter: "0172 7654321", wert: x.ich_nummer ? zeigeNummer(x.ich_nummer) : "" },
      { name: "weitere", label: "Weitere Kontakte (Name = Nummer, mit Komma trennen)", platzhalter: "Mama = 0170 111222, Papa = 0170 333444", wert: weitere },
      { name: "twilio_sid", label: "Twilio Account SID (optional, für echte Anrufe)", platzhalter: "AC…", wert: x.twilio_sid || "" },
      { name: "twilio_token", label: x.twilio_token ? "Twilio Auth Token (gespeichert, leer lassen = behalten)" : "Twilio Auth Token (optional)", typ: "password", platzhalter: "32 Zeichen" },
      { name: "twilio_von", label: "Deine Twilio-Telefonnummer (optional)", platzhalter: "+49 …", wert: x.twilio_von ? zeigeNummer(x.twilio_von) : "" },
    ],
    auswahl: ein ? [
      { name: "anruf_weg", label: "„Ruf … an“ bedeutet", wert: weg(), optionen: [
        { wert: "nachricht", text: "Nachricht schicken (kostenlos)" },
        { wert: "facetime", text: "Nachricht + FaceTime-Anruf am Mac (kostenlos)" },
        ...(twilioBereit() ? [{ wert: "twilio", text: "Echter Anruf, Friday spricht (Twilio)" }] : []),
      ] },
      { name: "signatur", label: "Unter jede Nachricht „(über Friday)“", wert: x.signatur === false ? "aus" : "an", optionen: [{ wert: "an", text: "Ja" }, { wert: "aus", text: "Nein" }] },
    ] : [],
    aktionen: [
      ...(l.some((k) => k.rolle === "ich") ? [{ action: "test_nachricht", text: "📨 Testnachricht an mich" }] : []),
      ...(twilioBereit() && l.some((k) => k.rolle === "ich") ? [{ action: "test_anruf", text: "📞 Testanruf an mich" }] : []),
    ],
  };
}

export async function einrichten(f = {}) {
  const neu = {};
  const fehler = [];
  const nr = (feld, label) => {
    const roh = String(f[feld] ?? "").trim();
    if (!roh) return undefined;
    const n = nummerNorm(roh);
    if (!n) fehler.push(`${label} sieht nicht wie eine Telefonnummer aus.`);
    return n || undefined;
  };
  neu.frau_name = String(f.frau_name || "").trim().slice(0, 40) || undefined;
  neu.frau_nummer = nr("frau_nummer", "Die Nummer deiner Frau");
  neu.ich_nummer = nr("ich_nummer", "Deine Nummer");
  if (neu.ich_nummer && istMail(neu.ich_nummer)) { /* Apple-ID geht für Nachrichten */ }
  const weitere = [];
  for (const teil of String(f.weitere || "").split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).slice(0, 20)) {
    const m = teil.match(/^(.+?)\s*[=:]\s*(.+)$/);
    const n = m && nummerNorm(m[2]);
    if (!m || !n) { fehler.push(`„${teil}“ verstehe ich nicht. Schreib es so: Mama = 0170 111222`); continue; }
    weitere.push({ name: m[1].trim().slice(0, 40), nummer: n });
  }
  neu.weitere = weitere.length ? weitere : undefined;
  // Twilio
  const sid = String(f.twilio_sid || "").trim();
  const token = String(f.twilio_token || "").trim() || d().twilio_token || "";
  const von = String(f.twilio_von || "").trim();
  if (sid || von || f.twilio_token) {
    if (!/^AC[0-9a-f]{32}$/i.test(sid)) fehler.push("Die Twilio Account SID beginnt mit AC und hat 34 Zeichen.");
    if (!V.schluesselOk(token, 20, 80)) fehler.push("Das Twilio Auth Token fehlt oder ist zu kurz.");
    const vonN = nummerNorm(von);
    if (!vonN || istMail(vonN)) fehler.push("Die Twilio-Telefonnummer fehlt (die Nummer, die du bei Twilio bekommen hast).");
    if (!fehler.length) {
      const r = await V.holeJson(`${TWILIO()}/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`, { headers: twilioAuth(sid, token) });
      if (!r.ok) return { ok: false, error: twilioFehler(r) };
      Object.assign(neu, { twilio_sid: sid, twilio_token: token, twilio_von: vonN });
    }
  } else {
    Object.assign(neu, { twilio_sid: undefined, twilio_token: undefined, twilio_von: undefined });
  }
  if (fehler.length) return { ok: false, error: fehler.join(" ") };
  if (!neu.frau_nummer && !neu.ich_nummer && !neu.weitere) return { ok: false, error: "Trag mindestens eine Nummer ein." };
  V.set("anrufe", neu);
  const l = kontakte();
  return { ok: true, text: `Gespeichert. Ich kenne jetzt ${V.aufzaehlen(l.map((k) => k.name))}${twilioBereit() ? " und kann auch echt anrufen" : ""}.` };
}

export async function einstellen({ name, wert } = {}) {
  if (name === "anruf_weg" && ["nachricht", "facetime", "twilio"].includes(wert)) {
    if (wert === "twilio" && !twilioBereit()) return { ok: false, error: "Dafür zuerst die Twilio-Daten eintragen." };
    V.set("anrufe", { anruf_weg: wert });
    return { ok: true };
  }
  if (name === "signatur") { V.set("anrufe", { signatur: wert === "aus" ? false : undefined }); return { ok: true }; }
  return { ok: false, error: "Unbekannte Einstellung." };
}
export function vergessen() {
  V.clear("anrufe");
  return { ok: true };
}

// ---------- Sprachbefehle ohne Claude ----------
const WARTEZEIT_MS = 2 * 60 * 1000;
const wartet = new Map(); // Kanal -> {bis, kontakt, art}

const SAG = "(?:sag|sage|sagst|richte|richtest|erzähl|erzähle|schreib|schreibe|schreibst|teil|teile)";
const DAT = "(?:ihr|ihm|mir|ihnen)";

// Trennt "meiner frau eine nachricht dass ich komme" in Empfänger und Rest.
// Probiert 1–3 Wörter als Empfänger, der erste bekannte Kontakt gewinnt.
function trenneEmpfaenger(rest) {
  const w = rest.split(" ");
  for (let n = 1; n <= Math.min(3, w.length - 1); n++) {
    const wer = w.slice(0, n).join(" ");
    if (/^(meine[mnrs]?|unsere?[mnr]?|an|die|der|den|dem)$/.test(wer)) continue;
    if (!findeKontakt(wer)) continue;
    let r = w.slice(n).join(" ").replace(/^(?:eine |ne )?(?:nachricht|sms|imessage|message|bescheid)\b\s*/, "").replace(/^(?:aus|mit)\b\s*/, "");
    return { wer, text: r.replace(/^das /, "dass ") };
  }
  // Unbekannt, aber eindeutig gemeint ("meiner Schwester …"): für die Rückmeldung
  const m = rest.match(/^((?:meine[mnrs]?|unsere?[mnr]?) [^ ]+)\s*(.*)$/);
  return m ? { wer: m[1], text: m[2], unbekannt: true } : null;
}

// Zerlegt einen Satz in {wer, text, art} oder null.
export function verstehe(t) {
  let m;
  // "ruf meine frau an und sag ihr (dass) ..."  /  "ruf mich an"
  m = t.match(U(new RegExp(`^(?:ruf|rufe|ruft) (.+?) an(?:\\s+und\\s+${SAG}(?: ${DAT})?(?: (?:aus|mit|bescheid))?(?: bitte)?\\s*(.*))?$`)));
  if (m && m[1].split(" ").length <= 4) return { wer: m[1], text: (m[2] || "").replace(/^(aus|mit|bescheid)\s+/, "").replace(/^das /, "dass "), art: "anruf" };
  // "(kannst du) meine frau anrufen (und ihr sagen dass ...)"
  m = t.match(U(new RegExp(`^(.+?) anrufen(?:\\s+und\\s+(?:${DAT} )?(?:sagen|ausrichten|mitteilen|erzählen|schreiben)(?: ${DAT})?\\s*(.*))?$`)));
  if (m && (findeKontakt(m[1]) || /^(meine[mnr]? [^ ]+|mich)$/.test(m[1]))) return { wer: m[1], text: (m[2] || "").replace(/^das /, "dass "), art: "anruf" };
  // "schreib meiner frau (eine nachricht) (dass) ..."  /  "sag meiner frau bescheid dass ..."
  m = t.match(U(/^(schreib|schreibe|schick|schicke|sende|sag|sage|richte|teil|teile) (?:an )?(.+)$/));
  if (m) {
    const e = trenneEmpfaenger(m[2]);
    if (!e) return null;
    const istSag = /^(sag|sage|richte|teil|teile)$/.test(m[1]);
    // "sag mir …" ist fast immer eine Frage an Friday, keine Nachricht an sich selbst.
    if (istSag && (/^(mir|mich)$/.test(e.wer) || !/^dass /.test(e.text))) return null;
    return { wer: e.wer, text: e.text, art: "nachricht", unbekannt: e.unbekannt };
  }
  return null;
}

/** @returns {Promise<{answer:string, actions:string[]} | null>} */
export async function quickCommand(text, channel = "web") {
  const { normalize } = await import("./offline.js");
  // Doppelte Wörter aus der Spracherkennung ("ruf meine Frau an an und …") entfernen.
  const t = normalize(text).replace(/(^| )(an|und|ihr|ihm|mir) \2(?= |$)/g, "$1$2");
  if (!t || t.length > 400) return null;
  const roh = normalize(text, { gross: true }).replace(/(^| )(an|und|ihr|ihm|mir) \2(?= |$)/gi, "$1$2");

  // Antwort auf "Was soll ich ihr sagen?"
  const w = wartet.get(channel);
  if (w && w.bis > Date.now()) {
    wartet.delete(channel);
    // Eine Rückfrage an Friday ("Hast du sie angerufen?") ist keine Nachricht – nicht verschicken.
    if (/^(hast du (sie|ihn|es|ihr|ihm)|hat (es|das) (geklappt|funktioniert)|klappt (es|das)|wurde (sie|er|es)|ist (sie|er|es) (angekommen|raus|verschickt))\b/.test(t)) {
      return { answer: `Ich habe noch nichts geschickt, ${boss()}. Sag einfach, was ich ${ihr(w.kontakt)} sagen soll, oder: Ruf ${w.kontakt.rolle === "frau" ? "meine Frau" : w.kontakt.name} an.`, actions: ["anrufe"] };
    }
    if (/^(nichts|egal|vergiss es|abbrechen|stopp|stop|nein|doch nicht|lass es)$/.test(t)) return { answer: `Alles klar, ${boss()}. Ich schicke nichts.`, actions: ["anrufe"] };
    if (!verstehe(t)) {
      const nur = /^(einfach anrufen|nur anrufen|ruf (sie|ihn|einfach) an|nur anruf)$/.test(t);
      const r = await ausfuehren({ an: w.kontakt, text: nur ? "" : roh, art: nur ? "anruf" : w.art });
      return { answer: r.ok ? r.text : r.error, actions: ["anrufe"] };
    }
  } else if (w) wartet.delete(channel);

  const v = verstehe(t);
  if (!v) return null;
  const k = findeKontakt(v.wer);
  if (!k) {
    if (!anrufeBereit()) return { answer: "Ich habe noch keine Kontakte. Trag die Nummern im Werkzeug-Menü unter Verbindungen → Anrufe & Nachrichten ein.", actions: ["anrufe"] };
    return { answer: `„${v.wer}“ habe ich nicht in deinen Kontakten, ${boss()}. Ich schreibe und rufe nur Leute an, die du im Fenster Verbindungen unter Anrufe einträgst.`, actions: ["anrufe"] };
  }
  if (k.fehlt) {
    const r = await ausfuehren({ an: v.wer, art: v.art, text: "x" });
    return { answer: r.error, actions: ["anrufe"] };
  }
  // Text aus dem Original mit Groß-/Kleinschreibung holen
  let nachricht = v.text;
  if (nachricht) {
    const i = roh.toLowerCase().lastIndexOf(nachricht.toLowerCase());
    if (i >= 0) nachricht = roh.slice(i, i + nachricht.length);
  }
  // "sag ihr, was ich heute essen will" → Friday fragt nach dem Inhalt
  if (/^(was|wann|wo|wie|wohin|ob) /i.test(nachricht) && nachricht.split(" ").length <= 7 && !/[,]/.test(nachricht)) nachricht = "";
  if (!nachricht) {
    if (v.art === "anruf" && weg() !== "nachricht" && /^(ruf|rufe|ruft) /.test(t) && !/ und /.test(t)) {
      // "Ruf meine Frau an" ohne Text: FaceTime direkt, bei Twilio fragen
      if (weg() === "facetime" && k.rolle !== "ich") {
        const r = await ausfuehren({ an: k, art: "anruf" });
        return { answer: r.ok ? r.text : r.error, actions: ["anrufe"] };
      }
    }
    wartet.set(channel, { bis: Date.now() + WARTEZEIT_MS, kontakt: k, art: v.art });
    return { answer: v.art === "anruf" ? `Was soll ich ${ihr(k)} sagen?` : `Was soll ich ${ihr(k)} schreiben?`, actions: ["anrufe", "zuhoeren"] };
  }
  const r = await ausfuehren({ an: k, text: nachricht, art: v.art });
  return { answer: r.ok ? r.text : r.error, actions: ["anrufe"] };
}

// Für Fridays Gehirn
export function kurzinfo() {
  if (!anrufeBereit()) return "";
  return `Anrufe & Nachrichten (anrufe): Kontakte ${V.aufzaehlen(kontakte().map((k) => (k.rolle === "frau" ? `${k.name} (Frau)` : k.rolle === "ich" ? `${k.name} selbst` : k.name)))}; "ruf an" geht ${weg() === "twilio" ? "als echter Anruf" : weg() === "facetime" ? "als Nachricht + FaceTime" : "als Nachricht"}.`;
}
