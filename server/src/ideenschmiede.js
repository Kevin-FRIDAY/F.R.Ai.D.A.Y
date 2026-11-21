// Ideen-Schmiede (v1.106.0): Start-up-Konzepte, Nischen-Business, Kreativ- und Technik-Projekte
// für Alltag und privaten Nutzen. Friday würfelt Ideen, prüft deine eigenen mit einem ehrlichen
// Schnell-Check (Problem, Zielgruppe, Geld, Aufwand, Risiko) und hebt alles im Ideen-Tresor auf.
// Läuft OHNE Claude. Nur „Ausarbeiten mit KI“ (Geschäftsmodell-Leinwand, Namensideen, erste Kunden) braucht Guthaben.
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { U } from "./datum.js";
import { denke } from "./denker.js";
import * as ausbau from "./friday-ausbau.js";

const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pick = (l) => l[Math.floor(Math.random() * l.length)];

export const BEREICHE = {
  alltag: { name: "Alltag", icon: "🏡" },
  kreativ: { name: "Kreativität", icon: "🎨" },
  nische: { name: "Nischen-Business", icon: "💼" },
  technik: { name: "Technik", icon: "🛠" },
  friday: { name: "Für Friday", icon: "🤖" },
};
// [Bereich, Titel, Pitch, erster Schritt, Startkosten]
const SAMEN = [
  ["alltag", "Nachbarschafts-Werkzeugverleih", "Bohrmaschine, Leiter, Hochdruckreiniger: einmal kaufen, im Haus per Liste verleihen.", "Zettel im Treppenhaus: Wer hat was? 10 Antworten sammeln.", "0–50 €"],
  ["alltag", "Rechnungs- und Vertrags-Ordner mit Fristen-Wecker", "Alle Verträge an einem Ort, Friday erinnert vor Kündigungsfristen.", "Deine 5 wichtigsten Verträge mit Kündigungsfrist notieren.", "0 €"],
  ["alltag", "Wochen-Essensplan aus dem Angebotsprospekt", "Aus den Angeboten der Woche einen günstigen Essensplan für die Familie bauen.", "Einen Prospekt nehmen und daraus 5 Gerichte planen.", "0 €"],
  ["alltag", "Familien-Notfallmappe", "Wichtige Nummern, Medikamente, Passwörter-Hinweise und Dokumente an einem sicheren Ort.", "Eine Seite mit den 10 wichtigsten Infos ausfüllen.", "0–20 €"],
  ["alltag", "Garten- und Pflanzen-Gießplan", "Welche Pflanze wann Wasser braucht – mit Erinnerung.", "Alle Pflanzen fotografieren und Namen herausfinden.", "0 €"],
  ["kreativ", "Mini-Doku über deine Stadt", "Jede Woche ein 60-Sekunden-Video über einen unbekannten Ort in deiner Stadt.", "Drei Orte aufschreiben und den ersten mit dem Handy filmen.", "0 €"],
  ["kreativ", "Persönliches Hörbuch für Kinder", "Gute-Nacht-Geschichten mit den Namen der eigenen Kinder, selbst eingesprochen.", "Eine 3-Minuten-Geschichte schreiben und aufnehmen.", "0 €"],
  ["kreativ", "Upcycling-Möbel", "Alte Möbel vom Sperrmüll aufarbeiten und verkaufen oder verschenken.", "Ein kleines Möbelstück abschleifen und neu streichen.", "30–80 €"],
  ["kreativ", "Familien-Rezeptbuch", "Omas Rezepte mit Fotos und Geschichten als gedrucktes Buch.", "Fünf Rezepte samt Geschichte dazu sammeln.", "0–40 €"],
  ["kreativ", "3D-gedruckte Ersatzteile", "Kleine kaputte Plastikteile (Halter, Clips, Knöpfe) nachdrucken.", "Ein kaputtes Teil vermessen und in einem kostenlosen 3D-Programm nachbauen.", "0–250 €"],
  ["nische", "Senioren-Technikhilfe", "Älteren Menschen Handy, Videoanruf und Online-Banking erklären – gegen Stundenlohn.", "Im Bekanntenkreis eine Person fragen, ob sie Hilfe bräuchte.", "0 €"],
  ["nische", "Kassenbon-zu-Haushaltsbuch-Service", "Kassenbons abfotografieren lassen und monatlich eine einfache Übersicht liefern.", "Einen Monat deine eigenen Bons auswerten und die Übersicht zeigen.", "0 €"],
  ["nische", "Smart-Home-Einrichter", "Lampen, Steckdosen und Alexa/HomeKit für Leute einrichten, die das nicht selbst wollen.", "Dein eigenes Smart Home als Vorzeige-Beispiel dokumentieren.", "0 €"],
  ["nische", "Webseiten für Handwerker", "Einfache, schnelle Ein-Seiten-Webseiten für kleine Betriebe ohne Internetauftritt.", "Drei Betriebe ohne Webseite in deiner Nähe heraussuchen.", "0 €"],
  ["nische", "Haustier-Sitting per App-Liste", "Katzen füttern und Gassi gehen in der Nachbarschaft – mit Foto-Update.", "In der Nachbarschaftsgruppe nachfragen, wer Bedarf hat.", "0 €"],
  ["nische", "Flohmarkt-Profi", "Für andere Sachen fotografieren, beschreiben und online verkaufen – gegen Anteil.", "Fünf eigene Sachen perfekt einstellen und verkaufen.", "0 €"],
  ["technik", "Energie-Spion für zu Hause", "Mit Zwischenstecker-Messgeräten die größten Stromfresser finden.", "Ein Messgerät besorgen und eine Woche lang Geräte messen.", "15–40 €"],
  ["technik", "Friday als Haus-Info-Display", "Ein altes Tablet an die Wand: Wetter, Termine, Müllabfuhr, Bahn.", "Altes Tablet suchen und Fridays Kern-Seite öffnen.", "0–30 €"],
  ["technik", "Pflanzen-Feuchtigkeitssensor", "Kleiner Sensor meldet per Telegram, wenn die Erde trocken ist.", "Einen ESP32 mit Bodenfeuchte-Sensor bestellen.", "10–20 €"],
  ["technik", "Lokaler Foto-Tresor", "Alle Familienfotos automatisch vom Handy auf eine eigene Festplatte sichern.", "Speicherbedarf prüfen und eine Festplatte aussuchen.", "60–120 €"],
  ["technik", "Briefkasten-Melder", "Sensor in der Klappe meldet: Post ist da.", "Einen Tür/Fenster-Sensor fürs Smart Home besorgen.", "10–25 €"],
];
// Würfel-Bausteine für frische Kombinationen
const FUER = ["Familien mit kleinen Kindern", "Senioren", "Haustierbesitzer", "Pendler", "kleine Handwerksbetriebe", "Studenten", "Gartenfreunde", "Vereine", "Nachbarn im Haus", "Hobby-Köche"];
const PROBLEM = ["vergessen ständig Termine", "werfen zu viel Essen weg", "verlieren den Überblick über Verträge", "finden keine Zeit zum Aufräumen", "kennen sich mit Technik nicht aus", "geben zu viel Geld für Kleinigkeiten aus", "suchen ständig Dinge", "haben keine Lust auf Papierkram"];
const FORM = ["einen Abo-Service", "eine einfache App", "einen Vor-Ort-Service", "ein Bastel-Set", "einen Kurs", "eine Vorlage zum Ausdrucken", "einen Friday-Agenten", "ein Wochenend-Angebot"];

export function wuerfeln(bereich = "") {
  if (bereich === "friday") {
    const v = ausbau.zufall();
    return { bereich: "friday", titel: v.titel, pitch: v.pitch, schritt: v.sprache && v.sprache !== "–" ? `Danach sagst du: „${v.sprache}“. Voraussetzung: ${v.braucht}.` : `Voraussetzung: ${v.braucht}.`, kosten: v.kosten, ausbau: v.id };
  }
  const pool = SAMEN.filter((x) => !bereich || x[0] === bereich);
  if (Math.random() < 0.2 || !pool.length) {
    const fuer = pick(FUER), prob = pick(PROBLEM), form = pick(FORM);
    return { bereich: bereich || pick(Object.keys(BEREICHE)), titel: `${form.replace(/^(einen|eine|ein) /, "").replace(/^./, (c) => c.toUpperCase())} für ${fuer}`, pitch: `Viele ${fuer} ${prob}. Lösung: ${form}, genau dafür.`, schritt: `Sprich mit drei Leuten aus der Gruppe „${fuer}“ und frag, ob sie das Problem kennen.`, kosten: "0–50 €", gewuerfelt: true };
  }
  const s = pick(pool);
  return { bereich: s[0], titel: s[1], pitch: s[2], schritt: s[3], kosten: s[4] };
}

// Ehrlicher Schnell-Check ohne KI
const CHECKS = [
  ["problem", "Problem klar?", /\b(problem|nervt|ärgert|aergert|fehlt|zeitaufwendig|teuer|vergessen|schwierig|kompliziert|lösen|loesen|spart|sparen)\b/i, "Schreib in einem Satz, welches Problem du löst. Ohne Problem kein Kunde."],
  ["zielgruppe", "Zielgruppe genannt?", /\b(für|fuer|kunden|familien|senioren|eltern|studenten|firmen|betriebe|handwerker|nachbarn|leute|menschen|nutzer|zielgruppe)\b/i, "Für wen genau? „Alle“ ist keine Zielgruppe."],
  ["geld", "Wie kommt Geld rein?", /\b(preis|euro|€|abo|monatlich|verkaufen|verkauf|gebühr|gebuehr|stundenlohn|provision|bezahlen|kostet)\b/i, "Wer zahlt wie viel wofür? Leg einen ersten Preis fest, auch wenn er falsch ist."],
  ["test", "Schnell testbar?", /\b(test|ausprobieren|prototyp|erst mal|zuerst|klein anfangen|probe|pilot|umfrage|fragen)\b/i, "Wie kannst du es in einer Woche mit 0 € testen?"],
  ["anders", "Was ist anders?", /\b(anders|besser|einzig|neu|günstiger|guenstiger|schneller|einfacher|persönlich|persoenlich|lokal)\b/i, "Warum sollte jemand dich nehmen statt der Konkurrenz oder gar nichts?"],
];
export function pruefen(text) {
  const t = String(text || "").trim();
  if (t.length < 10) throw new Error("Beschreib deine Idee in ein, zwei Sätzen.");
  const ergebnis = CHECKS.map(([key, titel, re, tipp]) => ({ key, titel, ok: re.test(t), tipp }));
  const punkte = ergebnis.filter((x) => x.ok).length;
  const risiken = [];
  if (/\b(app|plattform|software|ki|künstliche intelligenz)\b/i.test(t)) risiken.push("Software dauert fast immer dreimal so lange wie gedacht. Starte ohne App (Liste, Formular, WhatsApp).");
  if (/\b(laden|lokal|geschäft|geschaeft|miete|lager)\b/i.test(t)) risiken.push("Feste Kosten (Miete, Lager) erst, wenn Kunden da sind.");
  if (/\b(lebensmittel|essen|kosmetik|medizin|gesundheit)\b/i.test(t)) risiken.push("Lebensmittel, Kosmetik und Gesundheit haben strenge Regeln (Hygiene, Kennzeichnung, Heilversprechen).");
  if (/\b(kinder|daten|fotos|kamera)\b/i.test(t)) risiken.push("Daten und Fotos von Personen: Datenschutz (DSGVO) mitdenken.");
  if (/\b(verkaufen|verkauf|einnahmen|kunden)\b/i.test(t)) risiken.push("Regelmäßige Einnahmen brauchen meist eine Gewerbeanmeldung (Kleinunternehmerregelung prüfen).");
  return {
    punkte, max: CHECKS.length, ergebnis, risiken,
    urteil: punkte >= 4 ? "Starke Grundlage. Jetzt testen!" : punkte >= 2 ? "Gute Richtung, aber es fehlen wichtige Antworten." : "Noch ein Gedanke, kein Plan. Beantworte die Fragen unten.",
    schritte: ["Problem und Zielgruppe in einem Satz aufschreiben.", "Mit drei echten Menschen aus der Zielgruppe sprechen.", "Kleinste Version bauen, die man verkaufen oder verschenken kann (1 Woche, 0 €).", "Ersten Preis nennen und schauen, ob jemand Ja sagt."],
  };
}

// Ideen-Tresor
export const tresor = () => store.load("ideen", []).slice().reverse();
export function speichern(idee = {}) {
  const liste = store.load("ideen", []);
  const e = liste.find((x) => x.id === idee.id) || { id: neueId(), at: new Date().toISOString(), status: "idee" };
  e.titel = String(idee.titel || "").trim().slice(0, 120) || "Neue Idee";
  e.text = String(idee.text || idee.pitch || "").slice(0, 4000);
  e.bereich = BEREICHE[idee.bereich] ? idee.bereich : e.bereich || "alltag";
  if (["idee", "test", "umsetzung", "erledigt", "verworfen"].includes(idee.status)) e.status = idee.status;
  if (idee.check) e.check = idee.check;
  if (idee.ki) e.ki = idee.ki;
  if (!liste.includes(e)) { liste.push(e); logbuch.eintragen({ bereich: "idee", titel: `Ideen-Tresor: ${e.titel}` }); }
  store.save("ideen", liste.slice(-200));
  return e;
}
export function loeschen(id) { store.save("ideen", store.load("ideen", []).filter((x) => x.id !== id)); return true; }

export async function ausarbeiten({ titel = "", text = "" }) {
  const r = await denke({
    stufe: "mittel", quelle: "ideen", maxTokens: 3000,
    system: "Du bist ein ehrlicher Gründungs-Coach für einen Einsteiger in Deutschland. Antworte auf Deutsch, kurz und konkret. Gib nur dieses JSON zurück: {\"problem\":\"…\",\"zielgruppe\":\"…\",\"loesung\":\"…\",\"preis\":\"…\",\"erste_kunden\":[\"…\",\"…\",\"…\"],\"test_in_7_tagen\":\"…\",\"kosten\":\"…\",\"risiken\":[\"…\",\"…\"],\"namen\":[\"…\",\"…\",\"…\"],\"ehrliche_meinung\":\"…\"}",
    text: `Idee: ${titel}\n${text}`,
  });
  if (!r.ok) throw new Error(r.error || "Claude ist gerade nicht erreichbar.");
  try { return JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1)); } catch { return { frei: r.text }; }
}

// ---------- Sprache ----------
const OEFFNEN = U(/^(öffne|oeffne|zeig|zeige|starte)( mir)?( die| den| das)? (ideen-schmiede|ideenschmiede|ideen schmiede|ideen-tresor|ideentresor|meine ideen)\b/);
const WUERFEL = U(/\b(gib|nenn|sag|hast du|brauche|würfel|wuerfel)( mir)?( mal)? (eine |ne |n )?(neue |gute |coole |verrückte |verrueckte )?(start-?up-?idee|startup idee|geschäftsidee|geschaeftsidee|business-?idee|idee|projektidee|nischen-?idee|bastelidee|technik-?idee)( für| fuer| zum| im)? ?(alltag|kreativität|kreativitaet|nische|nischen-business|technik)?\b/);
const AUSBAU = U(/\b(was (kann|könnte|koennte|sollte) (man|ich) (bei dir|in friday|dir) (noch )?(einbauen|einbinden|bauen|ergänzen|ergaenzen|verbessern)|wie kann (ich|man) dich (erweitern|verbessern|ausbauen)|(schlag|schlage|nenn) (mir )?(eine |ne )?(neue )?(funktion|erweiterung|verbesserung|einbindung) (für|fuer) dich( vor)?|(öffne|oeffne|zeig)( mir)?( den)? (friday-?)?(bauplan|ausbau)|friday ausbauen)\b/);
const MERKEN = U(/^(?:merk dir|speicher|notier) (?:die |eine |meine )?(?:idee|geschäftsidee|geschaeftsidee)[,:]? (.{6,})$/);

export function quickCommand(text) {
  const t = String(text || "").replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/i, "").trim();
  const k = t.toLowerCase();
  if (AUSBAU.test(k)) {
    const a = ausbau.ausbau();
    const v = a.vorschlaege.find((x) => x.id === a.passend[0]) || ausbau.zufall();
    const grund = a.passend[0] ? ` Das passt zu dir, du hast ${v.passt}-mal danach gefragt.` : "";
    return { answer: `Mein Vorschlag: ${v.titel}. ${v.pitch}${grund} Im Bauplan stehen ${a.zahlen.offen} Ideen für mich.`, actions: ["ideen:ausbau"] };
  }
  if (OEFFNEN.test(k)) return { answer: "Die Ideen-Schmiede ist offen. Soll ich würfeln oder prüfen wir deine Idee?", actions: ["ideen"] };
  let m = k.match(MERKEN);
  if (m) {
    const s = t.slice(k.indexOf(m[1]));
    const c = pruefen(s);
    speichern({ titel: s.split(/[.,!]/)[0].slice(0, 80), text: s, check: c });
    return { answer: `Im Ideen-Tresor gespeichert. Schnell-Check: ${c.punkte} von ${c.max}. ${c.urteil}`, actions: ["ideen"] };
  }
  m = k.match(WUERFEL);
  if (m && /idee/.test(k)) {
    const b = m[8] ? (/krea/.test(m[8]) ? "kreativ" : /nisch/.test(m[8]) ? "nische" : /technik/.test(m[8]) ? "technik" : "alltag") : /start|gesch|business/.test(k) ? "nische" : "";
    const i = wuerfeln(b);
    return { answer: `${i.titel}. ${i.pitch} Erster Schritt: ${i.schritt}`, actions: ["ideen", `idee:${encodeURIComponent(JSON.stringify(i))}`] };
  }
  return null;
}
