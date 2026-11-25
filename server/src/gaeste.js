// Gäste-Modus (v1.169.0, Stern-Idee aus der Ideen-Schmiede).
// "Friday, Gästemodus an": Besuch darf Licht, Musik, Radio, Fernseher, Wetter, Spiele und Wissensfragen nutzen,
// aber Friday verrät nichts Privates (Termine, Konten, Mails, Nachrichten, Gedächtnis, Datenbank, Archiv, Familie …).
// Für Claude gilt dasselbe: kein Gesprächsverlauf, keine privaten Werkzeuge, klare Ansage im System-Text.
// Optional mit PIN zum Ausschalten ("Gästemodus aus 1234"), damit Besuch ihn nicht einfach abschaltet.
import crypto from "node:crypto";
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { sauber } from "./wunsch-hilfe.js";
import { U } from "./datum.js";

const DATEI = "gaeste";
const laden = () => ({ an: false, seit: null, pinHash: "", automatischAus: 0, ...store.load(DATEI, {}) });
const sichern = (d) => store.save(DATEI, d);
const hash = (pin) => crypto.createHash("sha256").update(`friday-gast:${pin}`).digest("hex");

/** Ist der Gäste-Modus gerade an? (schaltet sich nach der eingestellten Zeit selbst ab) */
export function aktiv() {
  const d = laden();
  if (!d.an) return false;
  if (d.automatischAus && d.seit && Date.now() - Date.parse(d.seit) > d.automatischAus * 3600 * 1000) { d.an = false; d.seit = null; sichern(d); return false; }
  return true;
}
export function stand() { const d = laden(); return { an: aktiv(), seit: d.seit, mitPin: Boolean(d.pinHash), automatischAus: d.automatischAus }; }
export function einstellen({ pin, automatischAus } = {}) {
  const d = laden();
  if (pin !== undefined) {
    const p = String(pin).replace(/\D/g, "");
    if (p && (p.length < 4 || p.length > 8)) throw new Error("Die PIN braucht 4 bis 8 Ziffern.");
    d.pinHash = p ? hash(p) : "";
  }
  if (automatischAus !== undefined) d.automatischAus = Math.min(48, Math.max(0, Number(automatischAus) || 0));
  sichern(d);
  return stand();
}
/** Schalten. Ausschalten mit PIN, falls eine gesetzt ist (im angemeldeten Dashboard reicht der Knopf: vonDashboard). */
export function schalten(an, { pin = "", vonDashboard = false } = {}) {
  const d = laden();
  if (!an && d.an && d.pinHash && !vonDashboard && hash(String(pin).replace(/\D/g, "")) !== d.pinHash) return { ok: false, grund: "pin" };
  d.an = Boolean(an);
  d.seit = d.an ? new Date().toISOString() : null;
  sichern(d);
  logbuch.eintragen({ bereich: "sicherheit", titel: d.an ? "Gäste-Modus an" : "Gäste-Modus aus" });
  return { ok: true, ...stand() };
}

// Private Themen: Was Besuch nicht erfahren soll.
const PRIVAT = U(/\b(termin\w*|kalender|meeting|verabredung|mail\w*|e-?mail\w*|postfach|nachricht\w*|imessage|whatsapp|sms|telegram|anruf\w*|ruf \w+ an|kontakt\w*|telefonnummer|adresse von|konto\w*|kontostand|bank\w*|umsatz\w*|umsätze|ausgaben|einnahmen|gehalt|finanz\w*|haushaltsbuch|depot|rechnung\w*|passwort\w*|pin|schlüssel|zugangsdaten|gedächtnis|gedaechtnis|erinnerst du dich|was weißt du über mich|was weisst du ueber mich|über mich|ueber mich|meine gewohnheiten|datenbank|archiv|logbuch|tagebuch|notiz\w*|dokument\w*|fotos?|vision|kamera|wache|überwachung|ueberwachung|familie\w*|pinnwand|meine frau|mein mann|freundin|freund von mir|geburtstag\w*|gesundheit|medikament\w*|schlaf-?protokoll|wie (habe|hab) ich geschlafen|aufgaben|to-?do|erinnerung\w*|einkaufsliste|pakete?|sendung\w*|standort|wo bin ich|wo wohne ich|heimweg|zu hause|zuhause|wer war (heute )?da|verlauf|was habe ich (dich )?gefragt|worüber haben wir \w+|worueber haben wir \w+|was haben wir besprochen|was hast du heute gemacht|einstellungen|system|update|sicherung\w*|verbindungen?|energie|guthaben|kosten)\b/);
// Erlaubt bleibt, was eindeutig harmlos ist (Gerät steuern), auch wenn ein privates Wort vorkommt.
const HARMLOS = U(/\b(licht|lampe|hue|musik|spotify|radio|sender|podcast|fernseher|tv|netflix|youtube|lauter|leiser|alexa|wetter|witz|spiel|snake|timer|wecker|uhrzeit|wie spät)\b/);

/** Private Werkzeuge, die Claude im Gäste-Modus nicht bekommt (nach Name). */
export const PRIVATE_WERKZEUGE = /mail|kalender|termin|calendar|gedaecht|memory|erinner|reminder|notiz|note|konto|konten|bank|finanz|datenbank|archiv|logbuch|dokument|kontakt|contact|anruf|nachricht|message|imessage|telegram|todoist|notion|aufgabe|task|einkauf|shopping|health|gesundheit|familie|tagebuch|vision|kamera|wache|standort|location|paket|profil|seele|wissen|lernen|datei|file|mac_|shell|system|einstellung|update|backup|sicherung|verbindung/i;
export const SYSTEM_HINWEIS = "GÄSTE-MODUS IST AN: Gerade spricht Besuch mit dir, nicht Boss. Gib keine privaten Informationen über Boss heraus (Termine, Kalender, Mails, Nachrichten, Kontakte, Konten, Geld, Gesundheit, Familie, Gedächtnis, Notizen, Dokumente, Fotos, Standort, Verlauf). Lenke freundlich ab. Licht, Musik, Fernseher, Wetter, Allgemeinwissen, Witze und Spiele sind erlaubt.";

export function quickCommand(text) {
  const { k } = sauber(text);
  const sch = k.match(/^(?:den |der )?(?:gäste|gaeste|gast|besuch)s?-?modus (an|ein|aus|ab)(?:schalten)?(?: ?(\d{4,8}))?$|^(?:schalte? )?(?:den )?(?:gäste|gaeste|gast|besuch)s?-?modus (an|ein|aus|ab)(?: ?(\d{4,8}))?$|^(?:wir haben|ich habe|ich hab) (?:jetzt )?(?:besuch|gäste|gaeste)$|^(?:der )?besuch ist (?:wieder )?weg(?: ?(\d{4,8}))?$/);
  if (sch) {
    const was = sch[1] || sch[3] || (/besuch ist/.test(k) ? "aus" : "an");
    const pin = sch[2] || sch[4] || sch[5] || "";
    const an = /an|ein/.test(was);
    const r = schalten(an, { pin });
    if (!r.ok) return { answer: "Zum Ausschalten brauche ich die PIN. Sag zum Beispiel: „Gästemodus aus 1234“.", actions: ["gaeste_status"] };
    return { answer: an ? "Gäste-Modus ist an. Euer Besuch kann Licht, Musik, Radio, Fernseher und Wetter nutzen, Privates bleibt privat." : "Gäste-Modus ist aus. Willkommen zurück, Boss.", actions: ["gaeste_status"] };
  }
  if (/^(ist der )?(gäste|gaeste)-?modus (an|aktiv)$/.test(k)) return { answer: aktiv() ? "Ja, der Gäste-Modus ist an." : "Nein, der Gäste-Modus ist aus.", actions: ["gaeste_status"] };
  if (!aktiv()) return null;
  if (PRIVAT.test(k) && !HARMLOS.test(k)) {
    return { answer: ["Das ist privat, darüber spreche ich im Gäste-Modus nicht. Ich kann aber Licht, Musik, Radio oder das Wetter übernehmen.", "Sorry, im Gäste-Modus bleibt das unter uns. Wie wäre es mit Musik oder einem Witz?", "Dazu sage ich gerade nichts, der Gäste-Modus ist an. Frag mich gern etwas anderes."][Math.floor(Math.random() * 3)], actions: ["gaeste_status"] };
  }
  return null;
}
