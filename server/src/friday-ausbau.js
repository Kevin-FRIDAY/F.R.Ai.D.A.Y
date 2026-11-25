// Friday ausbauen (v1.130.0): Die Ideen-Schmiede macht jetzt auch Vorschläge für Friday selbst.
// 1) Bauplan-Katalog: Dienste, die man EINBINDEN kann (meist kostenlos), und Funktionen, die man BAUEN kann.
//    Jeder Vorschlag mit Nutzen, Aufwand, Kosten, was man braucht und einem Beispiel-Sprachbefehl.
//    v1.171.0: Eingebautes ist ganz aus dem Katalog herausgenommen (Liste EINGEBAUT), dafür 20 neue Ideen.
//    Ist etwas schon eingebaut, verschwindet es aus den Vorschlägen (v1.164.0, automatischer Abgleich):
//    Friday prüft bei jedem Öffnen gegen den echten Funktionsumfang – Modul-Dateien in server/src,
//    server/src/werkzeugkasten und dashboard sowie die Werkzeug-IDs im Werkzeugkasten („werkzeug:id“).
//    Wer eine Idee einbaut, nennt die Datei wie im Feld „module“ (oder trägt den neuen Namen dort ein) –
//    dann rückt automatisch die nächste Idee nach, und der Wunsch im Ideen-Tresor wird abgehakt.
// 2) Aus deinem Alltag: Friday liest die eigene Datenbank (Gespräche) und findet
//    a) Lücken – Fragen, bei denen Friday passen musste – und
//    b) Vorschläge, die zu deinen häufigen Themen passen.
// 3) Mit KI (braucht Guthaben): Claude schlägt neue Ideen vor, passend zu dem, was es schon gibt.
// Ein Vorschlag kann auf die Friday-Wunschliste (Ideen-Tresor, Bereich „Für Friday“) oder als fertiger
// Bau-Auftrag kopiert werden (zum Einfügen in Claude). Friday baut sich NICHT selbst um.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./store.js";
import { denke } from "./denker.js";
import { WERKZEUGE } from "./werkzeugkasten.js";
import * as logbuch from "./logbuch.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const DASH = path.join(HIER, "..", "..", "dashboard");
const WKASTEN = path.join(HIER, "werkzeugkasten");
const VERSION_DATEI = path.join(HIER, "..", "..", "VERSION");

export const GRUPPEN = {
  wetter: { name: "Wetter & Umwelt", art: "einbinden", farbe: "#2ee6d0" },
  alltag: { name: "Alltag & Haushalt", art: "einbinden", farbe: "#4f8dff" },
  medien: { name: "Medien & Freizeit", art: "einbinden", farbe: "#a978ff" },
  ki: { name: "KI & Technik", art: "einbinden", farbe: "#ffc44d" },
  persoenlich: { name: "Persönlich", art: "bauen", farbe: "#ff6fb5" },
  organisation: { name: "Organisation", art: "bauen", farbe: "#38e08c" },
  friday: { name: "Friday selbst", art: "bauen", farbe: "#ff8a2a" },
};

// aufwand: 1 = Nachmittag, 2 = ein Abend-Projekt, 3 = größeres Projekt
const V = (id, gruppe, titel, pitch, nutzen, aufwand, kosten, braucht, sprache, module, stichworte) => ({
  id, gruppe, art: GRUPPEN[gruppe].art, titel, pitch, nutzen, aufwand, kosten, braucht, sprache, module: module ? module.split("|") : [], stichworte,
});
export const KATALOG = [
  // ---- Einbinden ----
  V("muell", "alltag", "Müllabfuhr-Kalender", "Abfuhrtermine deiner Stadt (ICS-Datei) einlesen, Erinnerung am Vorabend.", "Nie wieder die Tonne vergessen.", 1, "kostenlos", "Kalender-Link deiner Stadt/Abfallwirtschaft", "Friday, welche Tonne kommt morgen?", "muell.js", /\b(müll|muell|tonne|abfall|gelber sack)/i),
  V("shelly", "ki", "Strom-Messsteckdosen (Shelly)", "Shelly-Steckdosen lokal abfragen: Verbrauch live, Geräte schalten.", "Stromfresser finden, Geräte per Sprache aus.", 2, "ab ca. 15 € je Steckdose", "Shelly Plug im WLAN", "Friday, wie viel Strom zieht der PC?", "shelly.js", /\b(steckdose|verbrauch|watt|stromfresser)/i),
  V("briefscanner", "ki", "Brief-Scanner mit Fristen", "Brief abfotografieren: Apple Vision liest den Text, Friday erkennt Fristen und Beträge, legt den Brief ins Archiv und erinnert rechtzeitig.", "Keine verpasste Frist mehr bei Behörden-Post.", 2, "kostenlos", "Mac mit Apple Vision (schon da)", "Friday, scan den Brief.", "briefscanner.js", /\b(brief|post|frist|behörde|behoerde|finanzamt|bescheid)\b/i),
  // ---- Neu nachgerückt (v1.171.0) ----
  V("regenradar", "wetter", "Regen in den nächsten 2 Stunden", "Viertelstunden-Vorhersage (Open-Meteo, DWD-Modell): Friday sagt minutengenau, wann der Regen kommt und wann er aufhört.", "Trocken zum Bäcker, Wäsche rechtzeitig rein.", 1, "kostenlos", "nichts, offene Schnittstelle", "Friday, regnet es gleich?", "regenradar.js", /\b(regnet es gleich|regen gleich|regenradar|wann hört der regen|wann hoert der regen|regen in der nächsten|schirm mitnehmen)\b/i),
  V("wetterfuehlig", "wetter", "Wetterfühligkeits-Warnung", "Friday beobachtet Luftdruck- und Temperatursprünge und warnt am Vorabend, wenn ein Kopfschmerz- oder Kreislauf-Tag droht.", "Für Wetterfühlige: früher trinken, Termine leichter planen.", 1, "kostenlos", "nichts", "Friday, wird morgen ein Kopfschmerz-Tag?", "wetterfuehlig.js", /\b(wetterfühlig|wetterfuehlig|kopfschmerz|luftdruck|migräne|migraene|kreislauf)\b/i),
  V("offen", "alltag", "Was hat jetzt offen?", "Öffnungszeiten aus OpenStreetMap: Apotheke, Bäcker, Supermarkt, Tankstelle in deiner Nähe, mit Entfernung und „schließt in 20 Minuten“.", "Kein Hinfahren vor verschlossene Türen.", 2, "kostenlos", "nichts, OpenStreetMap (Overpass)", "Friday, welcher Supermarkt hat noch offen?", "offen.js", /\b(hat (noch |jetzt )?offen|geöffnet|geoeffnet|öffnungszeit|oeffnungszeit|apotheke|bäcker|baecker|supermarkt)\b/i),
  V("losfahren", "alltag", "Losfahr-Erinnerung", "Termin mit Ort im Kalender: Friday rechnet Weg und aktuellen Verkehr und sagt „In 10 Minuten musst du los“.", "Pünktlich, ohne selbst auf die Uhr zu schauen.", 2, "kostenlos", "Apple Kalender (schon verbunden) mit Ort im Termin", "Friday, wann muss ich los?", "losfahren.js", /\b(wann muss ich los|muss ich los|losfahren|rechtzeitig los|pünktlich|puenktlich)\b/i),
  V("filmtipps", "medien", "Film- und Serien-Tipps", "Neue Filme und Serien (TMDB) mit Bewertung, Trailer und wo sie gerade laufen (Netflix, Prime, Disney+ …), passend zu deinem Geschmack.", "Abends nicht mehr 20 Minuten durchscrollen.", 1, "kostenlos", "kostenloser TMDB-Schlüssel", "Friday, was soll ich heute schauen?", "filmtipps.js", /\b(film|serie|was soll ich schauen|was läuft|was laeuft|netflix|prime video|disney)\b/i),
  V("gratisspiele", "medien", "Gratis-Spiele der Woche", "Welche Spiele gibt es gerade kostenlos (Epic Games, Prime Gaming) und welche sind stark reduziert (CheapShark)? Friday meldet es jeden Donnerstag.", "Spiele behalten, ohne etwas zu bezahlen.", 1, "kostenlos", "nichts", "Friday, welche Spiele gibt es gerade gratis?", "gratisspiele.js", /\b(spiele|gratis spiel|gratisspiel|epic|steam|zocken|gaming|playstation)\b/i),
  V("stimmgeraet", "medien", "Stimmgerät und Metronom", "Gitarre, Ukulele oder Geige über das Mikrofon stimmen, Metronom per Sprache („Takt 90“), alles direkt im Browser.", "Kein extra Gerät für die Musik.", 1, "kostenlos", "Mikrofon (Mac oder iPhone)", "Friday, stimm meine Gitarre.", "stimmgeraet.js", /\b(gitarre|stimmen|stimmgerät|stimmgeraet|metronom|ukulele|klavier|takt)\b/i),
  V("paperless", "ki", "Dokumenten-Archiv Paperless-ngx", "Paperless-ngx auf dem Mac einbinden: Friday findet jedes eingescannte Dokument per Sprache („die Stromrechnung von März“) und zeigt es an.", "Jedes Papier in Sekunden gefunden.", 2, "kostenlos", "Paperless-ngx auf dem Mac (Docker)", "Friday, zeig mir die letzte Stromrechnung.", "paperless.js", /\b(dokument|rechnung|bescheid|brief|unterlagen|ordner|paperless)\b/i),
  V("bildki", "ki", "Bilder malen auf dem Mac", "Lokale Bild-KI (Draw Things oder ComfyUI auf dem Apple-Chip): „Friday, mal mir …“ erzeugt Bilder ohne Internet und ohne Kosten.", "Eigene Bilder für Einladungen, Webseiten und Spaß.", 2, "kostenlos", "Draw Things oder ComfyUI auf dem Mac", "Friday, mal mir einen Drachen über Hamburg.", "bildki.js", /\b(mal mir|male|zeichne|bild erzeugen|bild generieren|bild malen)\b/i),
  V("mqtt", "ki", "Eigene Sensoren (MQTT)", "ESP32-Sensoren und Zigbee-Geräte über MQTT einbinden: Temperatur, Tür offen, Briefkasten, Bodenfeuchte – Friday zeigt und meldet alles.", "Eigenes Smart Home aus Bastel-Teilen für ein paar Euro.", 3, "Sensoren ab ca. 5 €", "MQTT-Broker (Mosquitto) auf dem Mac", "Friday, wie warm ist es im Keller?", "mqtt.js", /\b(sensor|esp32|zigbee|mqtt|keller|briefkasten)\b/i),
  // ---- Bauen ----
  V("tagebuch", "persoenlich", "Sprach-Tagebuch", "Abends kurz erzählen, wie der Tag war – Friday schreibt mit, sortiert nach Datum, mit Stimmungs-Kurve.", "Erinnerungen festhalten, ohne zu schreiben.", 1, "kostenlos", "nichts", "Friday, Tagebuch: Heute war …", "tagebuch.js", /\b(tagebuch|mein tag|stimmung|gefühl|gefuehl)/i),
  V("medikamente", "persoenlich", "Medikamenten-Wecker", "Einnahmezeiten mit Bestätigung („genommen“), Vorrat zählt mit und erinnert ans Nachkaufen.", "Sicher, dass nichts vergessen wird.", 1, "kostenlos", "nichts", "Friday, Tablette genommen.", "medikamente.js", /\b(tablette|medikament|pille|vitamin)/i),
  V("reise", "organisation", "Reise-Planer", "Ziel + Datum sagen: Packliste, Wetter am Ziel, Reisewarnung aus dem Lagezentrum, Countdown.", "Alles für die Reise an einem Ort.", 2, "kostenlos", "nichts", "Friday, ich fliege am 3. März nach Mallorca.", "reise.js", /\b(urlaub|reise|flug|koffer|packliste)/i),
  V("essensplan", "organisation", "Wochen-Essensplan", "7 Gerichte aus Vorrat und Lieblingsrezepten, fehlende Zutaten direkt auf die Einkaufsliste.", "Nie mehr „Was essen wir heute?“.", 2, "kostenlos", "nichts", "Friday, plan das Essen für diese Woche.", "essensplan.js", /\b(essen|kochen|rezept|abendessen|mittag)/i),
  V("pomodoro", "organisation", "Fokus-Timer mit Statistik", "25 Minuten Fokus, 5 Pause, Fokus-Sound automatisch an, Wochen-Statistik in der Datenbank.", "Konzentrierter lernen und arbeiten.", 1, "kostenlos", "nichts", "Friday, starte eine Fokus-Runde.", "fokus.js", /\b(fokus|konzentr\w*|pomodoro)/i),
  V("zeitkapsel", "persoenlich", "Zeitkapsel", "Eine Nachricht an dein zukünftiges Ich (oder die Familie) sprechen, Friday spielt sie an einem bestimmten Tag wieder ab.", "Schöne Überraschung zum Geburtstag oder Jahrestag.", 1, "kostenlos", "nichts", "Friday, Zeitkapsel für den 1. Januar: …", "zeitkapsel.js", /\b(zeitkapsel|in einem jahr|zukunft)\b/i),
  V("notfall", "persoenlich", "Notfall-Mappe", "Wichtige Nummern, Medikamente, Allergien und Ansprechpartner an einem Ort. „Friday, Notfall“ liest das Wichtigste sofort vor.", "Im Ernstfall keine Sucherei.", 1, "kostenlos", "nichts", "Friday, Notfall.", "notfall.js", /\b(notfall|notruf|allergie|blutgruppe)\b/i),
  V("kochmodus", "organisation", "Kochmodus mit Rezeptbuch", "Rezepte speichern, beim Kochen liest Friday Schritt für Schritt vor („weiter“, „nochmal“) und startet die Timer von selbst.", "Kochen mit dreckigen Händen, ohne aufs Handy zu tippen.", 2, "kostenlos", "nichts", "Friday, koch mit mir Lasagne.", "kochmodus.js", /\b(kochen|rezept|backen|lasagne|zutaten)\b/i),
  V("putzplan", "organisation", "Familien-Putzplan", "Haushaltsaufgaben reihum verteilen (mit den Familien-Profilen), abhaken per Sprache, Wochenübersicht für alle.", "Gerecht verteilt, ohne Diskussion.", 2, "kostenlos", "nichts", "Friday, wer ist diese Woche mit Bad dran?", "putzplan.js", /\b(putzen|putzplan|staubsaugen|aufräumen|aufraeumen|haushalt)\b/i),
  V("pflanzen", "organisation", "Pflanzen-Gießplan", "Jede Pflanze mit Foto und Gieß-Rhythmus, Friday erinnert und denkt an Regen auf dem Balkon.", "Keine vertrockneten Pflanzen mehr.", 1, "kostenlos", "nichts", "Friday, welche Pflanzen muss ich heute gießen?", "pflanzen.js", /\b(pflanze\w*|gießen|giessen|blumen|balkon|garten)\b/i),
  // ---- Neu nachgerückt (v1.171.0) ----
  V("vertraege", "organisation", "Vertrags-Ordner mit Kündigungs-Wecker", "Handy, Strom, Versicherung, Fitnessstudio: Laufzeit und Kündigungsfrist eintragen, Friday erinnert 4 Wochen vorher und hat das Kündigungsschreiben fertig.", "Keine ungewollte Verlängerung mehr.", 1, "kostenlos", "nichts", "Friday, welche Verträge kann ich bald kündigen?", "vertraege.js", /\b(vertrag|verträge|vertraege|kündigen|kuendigen|kündigungsfrist|kuendigungsfrist|laufzeit|versicherung)\b/i),
  V("zaehler", "organisation", "Zählerstände mit Foto", "Strom, Gas und Wasser abfotografieren, Friday liest die Zahl, zeichnet die Verbrauchskurve und warnt früh vor einer Nachzahlung.", "Keine böse Überraschung bei der Jahresabrechnung.", 2, "kostenlos", "nichts (Foto per iPhone)", "Friday, Stromzähler 41.250.", "zaehler.js", /\b(zähler|zaehler|zählerstand|zaehlerstand|verbrauch|nachzahlung|abschlag|stromverbrauch|gasverbrauch)\b/i),
  V("steuermappe", "organisation", "Steuer-Sammelmappe", "Übers Jahr Belege sammeln (Handwerker, Arbeitsmittel, Spenden, Fahrten), sortiert nach Steuer-Kategorie, zum Jahresende als fertige Liste.", "Steuererklärung in einem Abend statt einem Wochenende.", 2, "kostenlos", "nichts", "Friday, leg die Handwerker-Rechnung in die Steuermappe.", "steuermappe.js", /\b(steuer|steuererklärung|steuererklaerung|absetzen|beleg|quittung|spendenquittung)\b/i),
  V("nachkauf", "organisation", "Vorrats-Nachkauf", "Klopapier, Waschmittel, Kaffee: Friday lernt, wie oft du etwas kaufst, und setzt es rechtzeitig auf die Einkaufsliste.", "Nie wieder ohne Kaffee am Montagmorgen.", 1, "kostenlos", "nichts", "Friday, Waschmittel gekauft.", "nachkauf.js", /\b(gekauft|nachkaufen|klopapier|waschmittel|kaffee|vorrat)\b/i),
  V("ausfluege", "organisation", "Ausflugs-Ideen fürs Wochenende", "Wetter am Wochenende plus Ziele aus OpenStreetMap (Seen, Burgen, Spielplätze, Wanderwege) in deiner Nähe, mit Fahrzeit.", "Spontan raus, ohne lange zu suchen.", 2, "kostenlos", "nichts", "Friday, was können wir am Sonntag machen?", "ausfluege.js", /\b(ausflug|wochenende|was können wir|was koennen wir|wandern|see|burg|spielplatz)\b/i),
  V("ausweise", "persoenlich", "Ausweis-Wächter", "Personalausweis, Reisepass, Führerschein, Gesundheitskarte: Ablaufdatum eintragen, Friday erinnert ein halbes Jahr vorher, vor Reisen auch ans Kinder-Dokument.", "Kein Urlaub, der am abgelaufenen Pass scheitert.", 1, "kostenlos", "nichts", "Friday, wann läuft mein Reisepass ab?", "ausweise.js", /\b(ausweis|reisepass|personalausweis|führerschein|fuehrerschein|abgelaufen|läuft ab|laeuft ab)\b/i),
  V("leseliste", "persoenlich", "Bücherregal und Leseliste", "Bücher per Titel oder Barcode merken (Open Library), „gelesen / will lesen“, Lesefortschritt und eine Jahres-Statistik.", "Endlich wissen, was als Nächstes dran ist.", 1, "kostenlos", "nichts", "Friday, setz Der Marsianer auf meine Leseliste.", "leseliste.js", /\b(buch|bücher|buecher|lesen|leseliste|roman|gelesen)\b/i),
  V("spieleabend", "persoenlich", "Punkte-Tafel für den Spieleabend", "Punkte per Sprache ansagen („Kevin plus 12“), Friday rechnet mit, zeigt die Tabelle groß auf dem Fernseher und merkt sich die ewige Bestenliste.", "Kein Zettel, kein Streit ums Kopfrechnen.", 1, "kostenlos", "nichts", "Friday, Carla plus 20 Punkte.", "spieleabend.js", /\b(punkte|spieleabend|kniffel|uno|wer führt|wer fuehrt|bestenliste)\b/i),
  V("sonnenlicht", "friday", "Licht folgt der Sonne", "Hue-Lampen passen Helligkeit und Farbe dem Sonnenstand an: morgens kühl und hell, abends warm und gedimmt, Sonnenuntergang schaltet das Licht an.", "Gemütlicher Abend, besserer Schlaf, ohne Schalter.", 1, "kostenlos", "Philips Hue (schon verbunden)", "Friday, Licht nach der Sonne an.", "sonnenlicht.js", /\b(sonnenuntergang|sonnenaufgang|abendlicht|gemütlich|gemuetlich|dimmen|licht nach der sonne)\b/i),
  V("wochenbericht", "friday", "Friday-Wochenbericht", "Sonntags ein schöner Rückblick als Karte aufs iPhone: Termine, erledigte Aufgaben, Schlaf, Gewohnheiten, Wetter der Woche und was nächste Woche wichtig wird.", "Die Woche sauber abschließen, die nächste im Blick.", 1, "kostenlos", "nichts", "Friday, wie war meine Woche?", "wochenbericht.js", /\b(meine woche|diese woche|wochenrückblick|wochenrueckblick|wochenbericht|letzte woche)\b/i),
];

// ---------- Schon eingebaut (aus dem Bauplan herausgenommen) ----------
// Diese Ideen sind fertig in Friday und stehen darum nicht mehr im Bauplan (v1.171.0 aufgeräumt).
// Die Liste bleibt nur, damit alte ⭐-Wünsche im Ideen-Tresor automatisch abgehakt werden und
// die Ideen-Schmiede „✓ schon eingebaut“ zeigen kann. Neues Eingebautes einfach hier anhängen.
const E = (id, gruppe, titel, module) => ({ id, gruppe, titel, module: module.split("|") });
export const EINGEBAUT = [
  E("dwd-warnungen", "wetter", "Unwetter-Warnungen vom DWD", "unwetter.js"),
  E("pollen", "wetter", "Pollenflug-Vorhersage", "pollen.js|werkzeug:pollenflug"),
  E("strompreis", "wetter", "Günstige Strom-Stunden", "strompreis.js|agenten-einsatz.js|oeffentlich/deutschland.js"),
  E("sprit", "alltag", "Spritpreise in der Nähe", "sprit.js"),
  E("pakete", "alltag", "Paket-Verfolgung", "pakete.js"),
  E("rss", "medien", "Eigene Nachrichtenquellen", "feeds.js"),
  E("fussball", "medien", "Fußball-Ergebnisse", "fussball.js|sport.js"),
  E("jellyfin", "medien", "Eigene Mediathek (Jellyfin/Plex)", "mediathek.js"),
  E("ollama", "ki", "Ollama-Gehirn (Mac oder Cloud)", "ollama.js"),
  E("fritzbox", "ki", "Fritz!Box-Status", "fritzbox.js"),
  E("nina", "wetter", "Warn-App NINA für deinen Kreis", "nina.js|oeffentlich/deutschland.js"),
  E("pegel", "wetter", "Hochwasser & Pegelstände", "pegel.js"),
  E("himmel", "wetter", "Was ist heute am Himmel?", "himmel.js"),
  E("rueckrufe", "alltag", "Lebensmittel-Rückrufe", "rueckrufe.js"),
  E("autobahn", "alltag", "Staus & Baustellen", "autobahn.js"),
  E("drucken", "alltag", "Drucken per Sprache", "drucken.js"),
  E("radio", "medien", "Internetradio per Sprache", "radio.js"),
  E("podcasts", "medien", "Podcasts hören", "podcasts.js|podcast.js"),
  E("gewohnheiten", "persoenlich", "Gewohnheiten mit Serien", "gewohnheiten.js|serien.js"),
  E("geburtstage", "persoenlich", "Geburtstage + Geschenk-Ideen", "geburtstage.js"),
  E("finanzen", "organisation", "Haushaltsbuch", "haushaltsbuch.js|konten.js"),
  E("widget", "friday", "iPhone-Widget", "widget.js"),
  E("tagesrueckblick", "friday", "Abend-Rückblick", "rueckblick.js"),
  E("familie", "friday", "Familien-Pinnwand", "familie.js"),
  E("routinen", "friday", "Eigene Routinen bauen", "routinen.js|automationen.js"),
  E("lernen-ki", "friday", "Friday lernt dich kennen", "vorlieben.js"),
  E("schlaf", "persoenlich", "Schlaf-Protokoll", "schlaf.js"),
  E("sprachtrainer", "persoenlich", "Sprach-Trainer", "sprachtrainer.js"),
  E("garantien", "organisation", "Garantie-Tresor", "garantien.js|kaufberater.js"),
  E("fahrzeug", "organisation", "Auto-Logbuch", "fahrzeug.js"),
  E("gaeste", "friday", "Gäste-Modus", "gaeste.js"),
  E("briefing-audio", "friday", "Briefing zum Mitnehmen", "briefing-audio.js"),
];

// ---------- Automatischer Abgleich mit dem echten Funktionsumfang ----------
const WERKZEUG_IDS = new Set(WERKZEUGE.map((w) => w.id));
/** Ist eines der Module schon in Friday? "datei.js" (server/src, Werkzeugkasten, dashboard) oder "werkzeug:id". */
export function istGebaut(module) {
  const liste = Array.isArray(module) ? module : String(module || "").split("|").filter(Boolean);
  return liste.some((m) => (m.startsWith("werkzeug:") ? WERKZEUG_IDS.has(m.slice(9))
    : fs.existsSync(path.join(HIER, m)) || fs.existsSync(path.join(WKASTEN, m)) || fs.existsSync(path.join(DASH, m))));
}
const vorhanden = (v) => istGebaut(v.module);
/** Alles, was fertig ist: die herausgenommenen Ideen plus Bauplan-Ideen, die inzwischen eingebaut wurden. */
const alleGebauten = () => [...EINGEBAUT, ...KATALOG.filter(vorhanden)];
const norm = (t) => String(t || "").toLowerCase().replace(/[^a-zäöüß0-9]+/g, " ").trim();
const version = () => { try { return fs.readFileSync(VERSION_DATEI, "utf8").trim(); } catch { return ""; } };

/** Wünsche im Ideen-Tresor (Bereich „Für Friday“), die inzwischen eingebaut sind, automatisch abhaken. */
export function tresorAbgleich() {
  try {
    const gebaut = alleGebauten();
    if (!gebaut.length) return 0;
    const nachId = new Map(gebaut.map((v) => [v.id, v]));
    const nachTitel = new Map(gebaut.map((v) => [norm(v.titel), v]));
    const ideen = store.load("ideen", []);
    let n = 0;
    for (const i of ideen) {
      if (i.bereich !== "friday" || i.status === "erledigt" || i.status === "verworfen") continue;
      const v = (i.ausbau && nachId.get(i.ausbau)) || nachTitel.get(norm(i.titel));
      if (!v) continue;
      i.status = "erledigt"; i.erledigtAm = new Date().toISOString(); i.ausbau = v.id;
      const ver = version(); if (ver) i.version = ver;
      n++;
    }
    if (n) {
      store.save("ideen", ideen);
      logbuch.eintragen({ bereich: "idee", titel: `Wunschliste: ${n} ${n === 1 ? "Idee ist" : "Ideen sind"} jetzt eingebaut und abgehakt` });
    }
    return n;
  } catch { return 0; }
}

// Antworten, bei denen Friday passen musste → Lücken
const LUECKE = /\b(kann ich (leider )?(noch )?nicht|kann ich dir (leider )?(noch )?nicht|weiß ich (leider )?nicht|weiss ich (leider )?nicht|habe ich keinen zugriff|hab ich keinen zugriff|keinen zugriff|nicht verstanden|dafür habe ich kein|dafuer habe ich kein|das geht (noch )?nicht|nicht möglich|nicht moeglich|keine verbindung zu|guthaben ist leer)\b/i;

export function ausbau({ tage = 60 } = {}) {
  const abgehakt = tresorAbgleich();
  const seit = new Date(Date.now() - tage * 864e5).toISOString();
  let gespraeche = [];
  try { gespraeche = store.leseArchiv().filter((e) => (e.typ || "gespraech") === "gespraech" && e.at >= seit && e.frage); } catch { /* leer */ }
  const vorschlaege = KATALOG.map((v) => {
    const treffer = gespraeche.filter((g) => v.stichworte.test(g.frage)).length;
    const { stichworte, module, ...rest } = v;
    return { ...rest, schonDa: vorhanden(v), passt: treffer };
  });
  const gesehen = new Set();
  const luecken = [];
  for (const g of gespraeche.slice().reverse()) {
    if (!LUECKE.test(String(g.antwort || ""))) continue;
    if (/guthaben/i.test(g.antwort) && !/kann ich|weiß ich|weiss ich/i.test(g.antwort)) continue;
    const k = String(g.frage).toLowerCase().replace(/[^a-zäöüß0-9 ]/g, "").trim();
    if (!k || gesehen.has(k)) continue;
    gesehen.add(k);
    luecken.push({ frage: String(g.frage).slice(0, 160), antwort: String(g.antwort || "").slice(0, 200), at: g.at });
    if (luecken.length >= 6) break;
  }
  const wunsch = store.load("ideen", []).filter((i) => i.bereich === "friday").length;
  return {
    gruppen: GRUPPEN,
    vorschlaege,
    passend: vorschlaege.filter((v) => !v.schonDa && v.passt > 0).sort((a, b) => b.passt - a.passt).slice(0, 4).map((v) => v.id),
    luecken,
    gebaut: alleGebauten().map(({ id, titel, gruppe }) => ({ id, titel, gruppe })),
    abgehakt,
    zahlen: { gesamt: KATALOG.length, offen: vorschlaege.filter((v) => !v.schonDa).length, schonDa: alleGebauten().length, gespraeche: gespraeche.length, wunschliste: wunsch, tage },
  };
}

export const zufall = () => {
  const offen = KATALOG.filter((v) => !vorhanden(v));
  return offen.length ? offen[Math.floor(Math.random() * offen.length)] : null;
};

/** Fertiger Bau-Auftrag zum Kopieren (für Claude / einen Thread). */
export function bauAuftrag(v = {}) {
  return [
    `Bitte baue in Friday (Repo Kevin-FRIDAY/F.R.Ai.D.A.Y) eine neue Funktion: „${v.titel}“.`,
    v.pitch ? `Was sie tun soll: ${v.pitch}` : "",
    v.nutzen ? `Nutzen: ${v.nutzen}` : "",
    v.sprache && v.sprache !== "–" ? `Sprachbefehl (ohne Claude, wenn möglich): „${v.sprache}“` : "",
    v.braucht ? `Voraussetzung: ${v.braucht}. Kosten: ${v.kosten || "–"}.` : "",
    "Im Stil von Fridays Gehirn / Tool-Ökosystem (Schwarz + Neon-Orange), mit Eintrag im Werkzeug-Menü, Logbuch-Eintrag, Anleitung und Screenshots für Mac und iPhone. Bitte per Pull Request.",
  ].filter(Boolean).join("\n");
}

export async function kiVorschlaege() {
  let module = [];
  try { module = fs.readdirSync(HIER).filter((f) => f.endsWith(".js")).map((f) => f.replace(/\.js$/, "")); } catch { /* egal */ }
  let fragen = [];
  try { fragen = store.leseArchiv().slice(-80).map((e) => e.frage).filter(Boolean).map((f) => String(f).slice(0, 80)); } catch { /* egal */ }
  const r = await denke({
    stufe: "mittel", quelle: "ideen", maxTokens: 2500,
    system: "Du bist Produkt-Berater für Friday, einen privaten KI-Assistenten im Iron-Man-Stil (Node-Server auf dem Mac, Web-Dashboard, iPhone-App, Sprachsteuerung). Schlage 5 NEUE, realistische Funktionen oder Einbindungen vor, die es noch nicht gibt. Bevorzuge kostenlose Dienste. Keine Überwachung anderer Personen, kein Geld bewegen. Antworte auf Deutsch, einfach. Nur JSON: {\"vorschlaege\":[{\"titel\":\"…\",\"art\":\"einbinden|bauen\",\"pitch\":\"…\",\"nutzen\":\"…\",\"aufwand\":1,\"kosten\":\"…\",\"braucht\":\"…\",\"sprache\":\"Friday, …\"}]}",
    text: `Vorhandene Module: ${module.join(", ")}\nWerkzeuge im Werkzeugkasten: ${WERKZEUGE.map((w) => w.titel).join(", ")}\nSchon eingebaut: ${alleGebauten().map((v) => v.titel).join(", ")}\nSchon als Vorschlag im Katalog (nicht wiederholen): ${KATALOG.filter((v) => !vorhanden(v)).map((v) => v.titel).join(", ")}\nLetzte Fragen an Friday:\n${fragen.join("\n")}`,
  });
  if (!r.ok) throw new Error(r.error || "Claude ist gerade nicht erreichbar.");
  try {
    const j = JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1));
    const bekannt = new Set([...KATALOG.map((v) => norm(v.titel)), ...EINGEBAUT.map((v) => norm(v.titel)), ...WERKZEUGE.map((w) => norm(w.titel))]);
    return (j.vorschlaege || []).filter((v) => !bekannt.has(norm(v.titel))).slice(0, 6).map((v, i) => ({ id: `ki-${Date.now().toString(36)}-${i}`, gruppe: v.art === "einbinden" ? "ki" : "friday", art: v.art === "einbinden" ? "einbinden" : "bauen", titel: String(v.titel || "Vorschlag").slice(0, 80), pitch: String(v.pitch || "").slice(0, 400), nutzen: String(v.nutzen || "").slice(0, 300), aufwand: [1, 2, 3].includes(Number(v.aufwand)) ? Number(v.aufwand) : 2, kosten: String(v.kosten || "").slice(0, 80), braucht: String(v.braucht || "").slice(0, 160), sprache: String(v.sprache || "").slice(0, 120), ki: true, passt: 0, schonDa: false }));
  } catch { throw new Error("Claude hat keine lesbare Liste geschickt. Bitte nochmal."); }
}
