// Ideen-Schmiede (v1.106.0): Start-up-Konzepte, Nischen-Business, Kreativ- und Technik-Projekte
// für Alltag und privaten Nutzen. Friday würfelt Ideen, prüft deine eigenen mit einem ehrlichen
// Schnell-Check (Problem, Zielgruppe, Geld, Aufwand, Risiko) und hebt alles im Ideen-Tresor auf.
// v1.164.0: Was schon in Friday eingebaut ist, wird nicht mehr vorgeschlagen; frische Ideen rücken nach.
// v1.171.0: aufgeräumt (Eingebautes raus) und mit neuen Ideen aufgefüllt.
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
// [Bereich, Titel, Pitch, erster Schritt, Startkosten, (optional) Friday-Module]
// Steht im 6. Feld ein Modul (wie im Bauplan, z. B. "pflanzen.js" oder "werkzeug:packliste") und ist es
// in Friday eingebaut, wird die Idee nicht mehr gewürfelt – Friday kann das dann ja schon selbst.
const SAMEN = [
  ["alltag", "Nachbarschafts-Werkzeugverleih", "Bohrmaschine, Leiter, Hochdruckreiniger: einmal kaufen, im Haus per Liste verleihen.", "Zettel im Treppenhaus: Wer hat was? 10 Antworten sammeln.", "0–50 €"],
  ["alltag", "Rechnungs- und Vertrags-Ordner mit Fristen-Wecker", "Alle Verträge an einem Ort, Friday erinnert vor Kündigungsfristen.", "Deine 5 wichtigsten Verträge mit Kündigungsfrist notieren.", "0 €", "vertraege.js"],
  ["alltag", "Wochen-Essensplan aus dem Angebotsprospekt", "Aus den Angeboten der Woche einen günstigen Essensplan für die Familie bauen.", "Einen Prospekt nehmen und daraus 5 Gerichte planen.", "0 €", "essensplan.js"],
  ["alltag", "Familien-Notfallmappe", "Wichtige Nummern, Medikamente, Passwörter-Hinweise und Dokumente an einem sicheren Ort.", "Eine Seite mit den 10 wichtigsten Infos ausfüllen.", "0–20 €", "notfall.js"],
  ["alltag", "Garten- und Pflanzen-Gießplan", "Welche Pflanze wann Wasser braucht – mit Erinnerung.", "Alle Pflanzen fotografieren und Namen herausfinden.", "0 €", "pflanzen.js"],
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
  ["technik", "Energie-Spion für zu Hause", "Mit Zwischenstecker-Messgeräten die größten Stromfresser finden.", "Ein Messgerät besorgen und eine Woche lang Geräte messen.", "15–40 €", "shelly.js"],
  ["technik", "Pflanzen-Feuchtigkeitssensor", "Kleiner Sensor meldet per Telegram, wenn die Erde trocken ist.", "Einen ESP32 mit Bodenfeuchte-Sensor bestellen.", "10–20 €"],
  ["technik", "Lokaler Foto-Tresor", "Alle Familienfotos automatisch vom Handy auf eine eigene Festplatte sichern.", "Speicherbedarf prüfen und eine Festplatte aussuchen.", "60–120 €"],
  ["technik", "Briefkasten-Melder", "Sensor in der Klappe meldet: Post ist da.", "Einen Tür/Fenster-Sensor fürs Smart Home besorgen.", "10–25 €"],
  // ---- Neu nachgerückt (v1.164.0) ----
  ["alltag", "Tausch-Regal im Hausflur", "Ein Regal für Bücher, Spiele und Deko: Wer etwas bringt, darf etwas mitnehmen.", "Hausverwaltung fragen und ein altes Regal mit fünf eigenen Büchern starten.", "0 €"],
  ["alltag", "Vorkoch-Sonntag", "Einmal pro Woche für drei, vier Tage vorkochen: spart Zeit, Geld und Stress unter der Woche.", "Zwei Gerichte aussuchen, die sich gut aufwärmen lassen, und Dosen besorgen.", "0–20 €"],
  ["alltag", "Digitaler Frühjahrsputz", "Alte Fotos, Apps, Mails und Abos aufräumen, ein Bereich pro Wochenende.", "Heute 20 Minuten: alle Apps löschen, die du ein halbes Jahr nicht benutzt hast.", "0 €"],
  ["kreativ", "Ein-Jahr-Zeitraffer", "Jeden Tag ein Foto vom selben Platz (Baum, Balkon, Straße), am Ende ein Video über ein ganzes Jahr.", "Platz festlegen, Handy-Halterung basteln, erstes Foto machen.", "0–15 €"],
  ["kreativ", "Familien-Podcast", "Einmal im Monat 15 Minuten: Was ist passiert, was war lustig? In 20 Jahren unbezahlbar.", "Erste Folge mit dem Handy am Küchentisch aufnehmen.", "0 €"],
  ["kreativ", "Stop-Motion-Film mit Lego", "Mit Figuren und dem Handy einen kurzen Trickfilm drehen, Friday macht die Musik dazu.", "Eine 10-Sekunden-Szene mit 50 Fotos legen.", "0 €"],
  ["nische", "Fahrrad-Check vor der Haustür", "Mobiler Fahrrad-Service: Bremsen, Licht, Kette direkt beim Kunden, besonders im Frühling.", "Drei Fahrräder von Freunden durchchecken und Fotos vorher/nachher machen.", "50–150 € Werkzeug"],
  ["nische", "Alte Fotos digitalisieren", "Dias, Negative und Fotoalben einscannen und als ordentliches Familien-Archiv zurückgeben.", "Ein eigenes Album scannen und die Zeit pro Seite messen.", "0–100 €"],
  ["nische", "Umzugs-Starthilfe", "Checkliste, Ummelde-Fristen, Kartons und Helfer-Plan als Paket für Leute, die umziehen.", "Deine eigene Umzugs-Checkliste aufschreiben und zwei Bekannten anbieten.", "0 €"],
  ["technik", "Eigene Wetterstation", "ESP32 mit Temperatur-, Feuchte- und Luftdrucksensor auf dem Balkon, Friday zeigt die Werte.", "Einen ESP32 und einen BME280-Sensor bestellen.", "15–30 €"],
  ["technik", "Retro-Spielkonsole", "Ein Raspberry Pi wird zur Spielkonsole für alte Spiele, die du selbst besitzt.", "Raspberry Pi und zwei günstige Controller besorgen.", "60–100 €"],
  ["technik", "Altes Handy als Küchen-Radio", "Ein ausgemustertes Handy mit Lautsprecher in der Küche: Radio, Rezepte, Timer.", "Altes Handy zurücksetzen und nur Radio-App plus Friday einrichten.", "0–20 €"],
  // ---- Neu nachgerückt (v1.171.0) ----
  ["alltag", "Leih-Kiste für Kinderkleidung", "Kinder wachsen schnell: Eltern im Haus tauschen Kleidung in Kisten nach Größe, statt ständig neu zu kaufen.", "Eine Kiste Größe 98 packen und in der Eltern-Gruppe anbieten.", "0 €"],
  ["alltag", "Zehn-Minuten-Aufräumen am Abend", "Jeden Abend ein Timer für 10 Minuten, alle räumen gleichzeitig auf, danach ist frei.", "Heute Abend einen Timer stellen und ausprobieren, was in 10 Minuten schaffbar ist.", "0 €"],
  ["alltag", "Wochenend-Ausflug-Glas", "Zettel mit Ausflugsideen in ein Glas, am Freitag wird eine gezogen. Keine Diskussion mehr, was man macht.", "Mit der Familie 15 Ideen sammeln und aufschreiben.", "0–5 €", "ausfluege.js"],
  ["kreativ", "Eigenes Kartenspiel entwerfen", "Ein Familien-Kartenspiel mit eigenen Regeln und Figuren, selbst gezeichnet und gedruckt.", "Zehn Karten auf Papier skizzieren und eine Proberunde spielen.", "0–30 €"],
  ["kreativ", "Hörspiel mit verteilten Rollen", "Eine kurze Geschichte mit Freunden einsprechen, Geräusche selbst machen, Friday schneidet Musik darunter.", "Ein 2-Seiten-Skript schreiben und die Rollen verteilen.", "0 €"],
  ["kreativ", "Foto-Schnitzeljagd", "Liste mit 20 Motiven (etwas Rotes, ein Spiegelbild …), wer zuerst alle fotografiert hat, gewinnt.", "Eine Liste schreiben und am Wochenende mit der Familie losziehen.", "0 €"],
  ["nische", "Handy-Umzug-Service", "Daten, Fotos, WhatsApp und Apps vom alten aufs neue Handy übertragen, für Leute, die Angst vor Datenverlust haben.", "Bei zwei Bekannten den nächsten Handy-Wechsel übernehmen und die Zeit stoppen.", "0 €"],
  ["nische", "Balkon-Kraftwerk-Berater", "Leuten helfen, das passende Steckersolargerät auszusuchen, anzumelden und sicher aufzubauen.", "Die Anmeldung bei deinem Netzbetreiber einmal selbst durchspielen und aufschreiben.", "0 €"],
  ["nische", "Geburtstags-Video-Collage", "Grußvideos von Freunden einsammeln und zu einem fertigen Geburtstagsfilm schneiden.", "Für den nächsten Geburtstag im Freundeskreis 5 Grüße sammeln.", "0 €"],
  ["technik", "Strom vom Balkon messen", "Ein Balkonkraftwerk mit Messsteckdose: Friday zeigt, wie viel Sonne heute Geld gespart hat.", "Preise für ein 800-Watt-Set vergleichen und die Balkonrichtung prüfen.", "300–600 €"],
  ["technik", "Bewässerung mit Raspberry Pi", "Kleine Pumpe und Feuchtesensor gießen die Balkonpflanzen im Urlaub automatisch.", "Eine 5-Volt-Pumpe, einen Schlauch und einen Sensor bestellen.", "20–40 €"],
  ["technik", "Nachtlicht mit Bewegungsmelder", "LED-Streifen im Flur, der nachts nur gedimmt angeht, wenn jemand vorbeiläuft. Kein Stolpern, kein grelles Licht.", "Einen LED-Streifen und einen kleinen Bewegungssensor fürs Smart Home bestellen.", "15–30 €"],
];
// Würfel-Bausteine für frische Kombinationen
const FUER = ["Familien mit kleinen Kindern", "Senioren", "Haustierbesitzer", "Pendler", "kleine Handwerksbetriebe", "Studenten", "Gartenfreunde", "Vereine", "Nachbarn im Haus", "Hobby-Köche"];
const PROBLEM = ["vergessen ständig Termine", "werfen zu viel Essen weg", "verlieren den Überblick über Verträge", "finden keine Zeit zum Aufräumen", "kennen sich mit Technik nicht aus", "geben zu viel Geld für Kleinigkeiten aus", "suchen ständig Dinge", "haben keine Lust auf Papierkram"];
const FORM = ["einen Abo-Service", "eine einfache App", "einen Vor-Ort-Service", "ein Bastel-Set", "einen Kurs", "eine Vorlage zum Ausdrucken", "einen Friday-Agenten", "ein Wochenend-Angebot"];

export function wuerfeln(bereich = "") {
  if (bereich === "friday") {
    const v = ausbau.zufall();
    if (!v) return { bereich: "friday", titel: "Alles eingebaut!", pitch: "Jede Idee aus dem Bauplan ist schon in Friday. Hol dir im Bauplan neue Vorschläge mit KI.", schritt: "Ideen-Schmiede → Friday ausbauen → Neue Vorschläge mit KI.", kosten: "–" };
    return { bereich: "friday", titel: v.titel, pitch: v.pitch, schritt: v.sprache && v.sprache !== "–" ? `Danach sagst du: „${v.sprache}“. Voraussetzung: ${v.braucht}.` : `Voraussetzung: ${v.braucht}.`, kosten: v.kosten, ausbau: v.id };
  }
  const pool = SAMEN.filter((x) => (!bereich || x[0] === bereich) && !(x[5] && ausbau.istGebaut(x[5])));
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
  if (idee.ausbau && /^[a-z0-9-]{2,40}$/.test(idee.ausbau)) e.ausbau = idee.ausbau;
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
    if (!v) return { answer: "Alles aus meinem Bauplan ist schon eingebaut. Im Bauplan kannst du neue Vorschläge mit KI holen.", actions: ["ideen:ausbau"] };
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
