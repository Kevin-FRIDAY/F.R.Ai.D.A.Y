// Friday ausbauen (v1.130.0): Die Ideen-Schmiede macht jetzt auch Vorschläge für Friday selbst.
// 1) Bauplan-Katalog: Dienste, die man EINBINDEN kann (meist kostenlos), und Funktionen, die man BAUEN kann.
//    Jeder Vorschlag mit Nutzen, Aufwand, Kosten, was man braucht und einem Beispiel-Sprachbefehl.
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
  V("dwd-warnungen", "wetter", "Unwetter-Warnungen vom DWD", "Amtliche Warnungen (Gewitter, Sturm, Glätte) für deinen Ort, Friday sagt Bescheid, bevor es losgeht.", "Nie wieder vom Gewitter überrascht, Warnung aufs iPhone per Telegram.", 1, "kostenlos", "nichts, offene DWD-Schnittstelle", "Friday, gibt es eine Unwetterwarnung?", "unwetter.js", /\b(unwetter|gewitter|sturm|glätte|glaette|warnung)/i),
  V("pollen", "wetter", "Pollenflug-Vorhersage", "Täglicher Pollenflug (Birke, Gräser …) vom DWD im Morgen-Briefing.", "Für Allergiker: Tabletten rechtzeitig nehmen.", 1, "kostenlos", "nichts", "Friday, wie ist der Pollenflug?", "pollen.js|werkzeug:pollenflug", /\b(pollen|allergie|heuschnupfen)/i),
  V("strompreis", "wetter", "Günstige Strom-Stunden", "Börsenstrompreis (z. B. aWATTar/Tibber) – Friday sagt, wann Waschen und Laden am billigsten ist.", "Spart bei dynamischem Tarif echtes Geld.", 1, "kostenlos (Tibber-Schlüssel optional)", "dynamischer Stromtarif lohnt sich am meisten", "Friday, wann ist Strom heute am günstigsten?", "strompreis.js", /\b(strom|strompreis|energie ?kosten|waschmaschine)/i),
  V("sprit", "alltag", "Spritpreise in der Nähe", "Tankerkönig zeigt die günstigste Tankstelle im Umkreis, live.", "Ein paar Euro pro Tankfüllung sparen.", 1, "kostenlos", "kostenloser Tankerkönig-Schlüssel", "Friday, wo ist Diesel gerade am billigsten?", "sprit.js", /\b(tank|tanken|sprit|benzin|diesel|tankstelle)/i),
  V("pakete", "alltag", "Paket-Verfolgung", "Sendungsnummer sagen, Friday meldet „Paket kommt heute“.", "Kein Tracking-Link-Suchen mehr.", 2, "kostenlos", "DHL-Entwickler-Schlüssel (kostenlos)", "Friday, wo ist mein Paket?", "pakete.js", /\b(paket|sendung|dhl|lieferung|hermes)/i),
  V("muell", "alltag", "Müllabfuhr-Kalender", "Abfuhrtermine deiner Stadt (ICS-Datei) einlesen, Erinnerung am Vorabend.", "Nie wieder die Tonne vergessen.", 1, "kostenlos", "Kalender-Link deiner Stadt/Abfallwirtschaft", "Friday, welche Tonne kommt morgen?", "muell.js", /\b(müll|muell|tonne|abfall|gelber sack)/i),
  V("rss", "medien", "Eigene Nachrichtenquellen", "Lieblings-Seiten als RSS-Feed eintragen (Tagesschau, Heise, Kicker …) – Friday liest Schlagzeilen vor.", "Briefing genau mit deinen Themen.", 1, "kostenlos", "nichts", "Friday, was gibt's Neues bei Heise?", "feeds.js", /\b(nachrichten|news|schlagzeilen|heise|kicker|tagesschau)/i),
  V("fussball", "medien", "Fußball-Ergebnisse", "Bundesliga-Spielplan und Live-Ergebnisse (OpenLigaDB) für deinen Verein.", "Tor-Ansage, ohne in die App zu schauen.", 1, "kostenlos", "nichts", "Friday, wie hat Dortmund gespielt?", "fussball.js|sport.js", /\b(fußball|fussball|bundesliga|tor|spiel ergebnis|bayern|dortmund|verein)/i),
  V("jellyfin", "medien", "Eigene Mediathek (Jellyfin/Plex)", "Filme und Serien vom eigenen Server per Sprache auf dem Fernseher starten.", "Wie Netflix, nur mit deinen Filmen.", 2, "kostenlos", "Jellyfin oder Plex auf dem Mac", "Friday, spiel Iron Man auf dem Fernseher.", "mediathek.js", /\b(film|serie|plex|jellyfin|mediathek)/i),
  V("ollama", "ki", "Ollama-Gehirn (Mac oder Cloud)", "Ollama als zweites Gehirn: auf dem Mac kostenlos und ohne Internet, oder in der Ollama Cloud mit großen Modellen. Modus Notfall, Sparen oder Immer.", "Friday denkt weiter, auch wenn das Guthaben leer ist, und spart Claude-Guthaben.", 2, "Mac: kostenlos · Cloud: Gratis-Stufe oder Abo", "Ollama-App auf dem Mac (ca. 3 GB) oder Schlüssel von ollama.com", "Friday, denk sparsam.", "ollama.js", /\b(guthaben|offline|lokal)/i),
  V("shelly", "ki", "Strom-Messsteckdosen (Shelly)", "Shelly-Steckdosen lokal abfragen: Verbrauch live, Geräte schalten.", "Stromfresser finden, Geräte per Sprache aus.", 2, "ab ca. 15 € je Steckdose", "Shelly Plug im WLAN", "Friday, wie viel Strom zieht der PC?", "shelly.js", /\b(steckdose|verbrauch|watt|stromfresser)/i),
  V("fritzbox", "ki", "Fritz!Box-Status", "Internet-Geschwindigkeit, Störungen und Gäste-WLAN-QR-Code per Sprache.", "Bei Internet-Problemen sofort wissen, woran es liegt.", 2, "kostenlos", "Fritz!Box mit Benutzer + Passwort", "Friday, ist das Internet langsam?", "fritzbox.js", /\b(internet|wlan|wifi|router|fritz)/i),
  // ---- Neu nachgerückt (v1.164.0) ----
  V("nina", "wetter", "Warn-App NINA für deinen Kreis", "Amtliche Warnungen des Bevölkerungsschutzes (Hochwasser, Großbrand, Stromausfall, Bombenentschärfung) für deinen Landkreis, aus der offenen NINA-Schnittstelle.", "Wichtige Warnungen kommen sofort, auch ohne eigene Warn-App.", 1, "kostenlos", "nichts, offene Schnittstelle des Bundes (bund.dev)", "Friday, gibt es eine Warnung für Berlin?", "nina.js", /\b(warnung|katastroph\w*|stromausfall|evakuier\w*|bombe|nina)\b/i),
  V("pegel", "wetter", "Hochwasser & Pegelstände", "Wasserstand am Fluss in deiner Nähe (PEGELONLINE), mit Warnung, wenn er stark steigt.", "Früh wissen, ob der Keller oder der Radweg am Ufer gefährdet ist.", 1, "kostenlos", "nichts, offene Schnittstelle (PEGELONLINE)", "Friday, wie hoch steht die Spree?", "pegel.js", /\b(hochwasser|pegel|wasserstand|fluss|überschwemm\w*|ueberschwemm\w*)\b/i),
  V("himmel", "wetter", "Was ist heute am Himmel?", "Mondphase, sichtbare Planeten, Sternschnuppen-Nächte und wann die ISS über dich fliegt, alles direkt auf dem Mac berechnet.", "Abends wissen, wann sich der Blick nach oben lohnt.", 2, "kostenlos", "nichts", "Friday, was sehe ich heute am Himmel?", "himmel.js", /\b(mond|vollmond|sterne|sternschnuppe\w*|planet\w*|himmel)\b/i),
  V("rueckrufe", "alltag", "Lebensmittel-Rückrufe", "Offizielle Rückrufe von lebensmittelwarnung.de, abgeglichen mit deinen Kassenbons im Kühlschrank-Modul: Friday warnt, wenn du etwas Betroffenes gekauft hast.", "Gesundheit schützen, ohne täglich nachzusehen.", 2, "kostenlos", "nichts, offene Schnittstelle (bund.dev)", "Friday, gibt es Rückrufe für Lebensmittel?", "rueckrufe.js", /\b(rückruf\w*|rueckruf\w*|salmonellen|listerien|zurückgerufen|zurueckgerufen)\b/i),
  V("autobahn", "alltag", "Staus & Baustellen", "Staus, Sperrungen und Baustellen auf deinen Autobahnen (offene Autobahn-Schnittstelle des Bundes), auf Wunsch vor dem Heimweg.", "Rechtzeitig losfahren oder Umweg nehmen.", 1, "kostenlos", "nichts", "Friday, ist Stau auf der A100?", "autobahn.js", /\b(stau|autobahn|baustelle|sperrung|a\d{1,3})\b/i),
  V("drucken", "alltag", "Drucken per Sprache", "Einkaufsliste, Packliste oder ein Dokument direkt auf dem Drucker am Mac ausdrucken.", "Zettel in der Hand, ohne Datei zu suchen.", 1, "kostenlos", "Drucker, der am Mac eingerichtet ist", "Friday, druck die Einkaufsliste.", "drucken.js", /\b(druck\w*|ausdrucken|drucker)\b/i),
  V("radio", "medien", "Internetradio per Sprache", "Über 30.000 Radiosender (radio-browser.info) per Sprache starten, auch auf dem Fernseher oder Alexa.", "Lieblingssender sofort, ohne App.", 1, "kostenlos", "nichts", "Friday, spiel Radio Eins.", "radio.js", /\b(radio|sender|1live|antenne|bayern 3|radio eins)\b/i),
  V("podcasts", "medien", "Podcasts hören", "Podcasts suchen und abonnieren (freie Podcast-Suche), Friday meldet neue Folgen und spielt sie ab.", "Neue Folgen, ohne nachzuschauen.", 2, "kostenlos", "nichts", "Friday, gibt es eine neue Folge von Lage der Nation?", "podcasts.js|podcast.js", /\b(podcast\w*|folge)\b/i),
  V("briefscanner", "ki", "Brief-Scanner mit Fristen", "Brief abfotografieren: Apple Vision liest den Text, Friday erkennt Fristen und Beträge, legt den Brief ins Archiv und erinnert rechtzeitig.", "Keine verpasste Frist mehr bei Behörden-Post.", 2, "kostenlos", "Mac mit Apple Vision (schon da)", "Friday, scan den Brief.", "briefscanner.js", /\b(brief|post|frist|behörde|behoerde|finanzamt|bescheid)\b/i),
  // ---- Bauen ----
  V("tagebuch", "persoenlich", "Sprach-Tagebuch", "Abends kurz erzählen, wie der Tag war – Friday schreibt mit, sortiert nach Datum, mit Stimmungs-Kurve.", "Erinnerungen festhalten, ohne zu schreiben.", 1, "kostenlos", "nichts", "Friday, Tagebuch: Heute war …", "tagebuch.js", /\b(tagebuch|mein tag|stimmung|gefühl|gefuehl)/i),
  V("gewohnheiten", "persoenlich", "Gewohnheiten mit Serien", "Wasser trinken, Sport, Lesen: abhaken per Sprache, Friday zählt die Tage am Stück (Serie) und feiert Rekorde.", "Dranbleiben fällt leichter, wenn man die Serie sieht.", 1, "kostenlos", "nichts", "Friday, Sport erledigt.", "gewohnheiten.js|serien.js", /\b(sport|training|joggen|gewohnheit|wasser trinken|lesen)/i),
  V("geburtstage", "persoenlich", "Geburtstage + Geschenk-Ideen", "Geburtstage merken, 7 Tage vorher erinnern und passende Geschenk-Ideen vorschlagen.", "Kein vergessener Geburtstag mehr.", 1, "kostenlos (Ideen mit KI optional)", "nichts", "Friday, wann hat Mama Geburtstag?", "geburtstage.js", /\b(geburtstag|geschenk|jahrestag)/i),
  V("medikamente", "persoenlich", "Medikamenten-Wecker", "Einnahmezeiten mit Bestätigung („genommen“), Vorrat zählt mit und erinnert ans Nachkaufen.", "Sicher, dass nichts vergessen wird.", 1, "kostenlos", "nichts", "Friday, Tablette genommen.", "medikamente.js", /\b(tablette|medikament|pille|vitamin)/i),
  V("finanzen", "organisation", "Haushaltsbuch", "Ausgaben per Sprache oder aus den Kassenbons im Kühlschrank-Modul, Monatsübersicht als Diagramm.", "Sehen, wohin das Geld geht.", 2, "kostenlos", "nichts", "Friday, 12 Euro für Pizza ausgegeben.", "haushaltsbuch.js|konten.js", /\b(geld|ausgaben|euro|kosten|budget|sparen)/i),
  V("reise", "organisation", "Reise-Planer", "Ziel + Datum sagen: Packliste, Wetter am Ziel, Reisewarnung aus dem Lagezentrum, Countdown.", "Alles für die Reise an einem Ort.", 2, "kostenlos", "nichts", "Friday, ich fliege am 3. März nach Mallorca.", "reise.js", /\b(urlaub|reise|flug|koffer|packliste)/i),
  V("essensplan", "organisation", "Wochen-Essensplan", "7 Gerichte aus Vorrat und Lieblingsrezepten, fehlende Zutaten direkt auf die Einkaufsliste.", "Nie mehr „Was essen wir heute?“.", 2, "kostenlos", "nichts", "Friday, plan das Essen für diese Woche.", "essensplan.js", /\b(essen|kochen|rezept|abendessen|mittag)/i),
  V("pomodoro", "organisation", "Fokus-Timer mit Statistik", "25 Minuten Fokus, 5 Pause, Fokus-Sound automatisch an, Wochen-Statistik in der Datenbank.", "Konzentrierter lernen und arbeiten.", 1, "kostenlos", "nichts", "Friday, starte eine Fokus-Runde.", "fokus.js", /\b(fokus|konzentr\w*|pomodoro)/i),
  V("widget", "friday", "iPhone-Widget", "Friday-Kacheln auf dem Home-Bildschirm (Wetter, nächster Termin, Einkauf) über die App Scriptable.", "Wichtiges sehen, ohne Friday zu öffnen.", 2, "kostenlos", "App Scriptable auf dem iPhone", "–", "widget.js", /\b(widget|homescreen|home-bildschirm)/i),
  V("tagesrueckblick", "friday", "Abend-Rückblick", "Um 21 Uhr fasst Friday den Tag zusammen: erledigt, offen, morgen wichtig – aus der eigenen Datenbank.", "Tag sauber abschließen, morgen vorbereitet.", 1, "kostenlos", "nichts", "Friday, wie war mein Tag?", "rueckblick.js", /\b(wie war (mein|der) tag|rückblick|rueckblick|was habe ich heute)/i),
  V("familie", "friday", "Familien-Pinnwand", "Mehrere Profile (Kevin, Carla …): eigene Listen, eigene Erinnerungen, gemeinsame Pinnwand.", "Friday für die ganze Familie.", 3, "kostenlos", "nichts", "Friday, schreib an die Pinnwand: …", "familie.js", /\b(familie|pinnwand)/i),
  V("routinen", "friday", "Eigene Routinen bauen", "„Guten Morgen“ = Licht an, Wetter, Termine, Fokus-Sound – Bausteine selbst zusammenklicken.", "Ein Satz, viele Aktionen.", 2, "kostenlos", "nichts", "Friday, guten Morgen.", "routinen.js|automationen.js", /\b(guten morgen|gute nacht|routine)/i),
  V("lernen-ki", "friday", "Friday lernt dich kennen", "Aus der Datenbank wöchentlich Vorlieben ableiten (Lieblingsthemen, Uhrzeiten) und Vorschläge anpassen.", "Friday wird mit der Zeit persönlicher.", 3, "kostenlos (Auswertung mit KI optional)", "nichts", "Friday, was weißt du über meine Gewohnheiten?", "vorlieben.js", /\b(lieblings\w*|gewohnheit\w*)/i),
  // ---- Neu nachgerückt (v1.164.0) ----
  V("schlaf", "persoenlich", "Schlaf-Protokoll", "„Gute Nacht“ und „Guten Morgen“ sagen reicht: Friday notiert die Schlafdauer und zeigt eine Wochenkurve.", "Sehen, ob du genug schläfst, ganz ohne Uhr am Arm.", 1, "kostenlos", "nichts", "Friday, wie habe ich diese Woche geschlafen?", "schlaf.js", /\b(schlaf\w*|müde|muede|ausgeschlafen)\b/i),
  V("sprachtrainer", "persoenlich", "Sprach-Trainer", "Jeden Tag 5 neue Wörter (Englisch, Spanisch …), Friday fragt sie per Sprache ab und wiederholt, was noch hakt.", "Nebenbei eine Sprache lernen, 5 Minuten am Tag.", 2, "kostenlos", "nichts", "Friday, frag mich meine Vokabeln ab.", "sprachtrainer.js", /\b(vokabel\w*|englisch|spanisch|französisch|franzoesisch|sprache lernen|übersetz\w*|uebersetz\w*)\b/i),
  V("zeitkapsel", "persoenlich", "Zeitkapsel", "Eine Nachricht an dein zukünftiges Ich (oder die Familie) sprechen, Friday spielt sie an einem bestimmten Tag wieder ab.", "Schöne Überraschung zum Geburtstag oder Jahrestag.", 1, "kostenlos", "nichts", "Friday, Zeitkapsel für den 1. Januar: …", "zeitkapsel.js", /\b(zeitkapsel|in einem jahr|zukunft)\b/i),
  V("notfall", "persoenlich", "Notfall-Mappe", "Wichtige Nummern, Medikamente, Allergien und Ansprechpartner an einem Ort. „Friday, Notfall“ liest das Wichtigste sofort vor.", "Im Ernstfall keine Sucherei.", 1, "kostenlos", "nichts", "Friday, Notfall.", "notfall.js", /\b(notfall|notruf|allergie|blutgruppe)\b/i),
  V("kochmodus", "organisation", "Kochmodus mit Rezeptbuch", "Rezepte speichern, beim Kochen liest Friday Schritt für Schritt vor („weiter“, „nochmal“) und startet die Timer von selbst.", "Kochen mit dreckigen Händen, ohne aufs Handy zu tippen.", 2, "kostenlos", "nichts", "Friday, koch mit mir Lasagne.", "kochmodus.js", /\b(kochen|rezept|backen|lasagne|zutaten)\b/i),
  V("garantien", "organisation", "Garantie-Tresor", "Kaufbeleg abfotografieren, Friday merkt sich Garantie-Ende und Rückgabefrist und erinnert vorher.", "Defekt? Beleg und Frist in Sekunden parat.", 1, "kostenlos", "nichts", "Friday, wie lange habe ich noch Garantie auf den Fernseher?", "garantien.js", /\b(garantie|gewährleistung|gewaehrleistung|kassenbon|rückgabe|rueckgabe|umtausch)\b/i),
  V("fahrzeug", "organisation", "Auto-Logbuch", "TÜV, Ölwechsel, Reifenwechsel (von O bis O) und Tankbuch, Friday erinnert rechtzeitig.", "Nie wieder TÜV überzogen.", 1, "kostenlos", "nichts", "Friday, wann muss das Auto zum TÜV?", "fahrzeug.js", /\b(tüv|tuev|ölwechsel|oelwechsel|reifen\w*|werkstatt|inspektion|auto)\b/i),
  V("putzplan", "organisation", "Familien-Putzplan", "Haushaltsaufgaben reihum verteilen (mit den Familien-Profilen), abhaken per Sprache, Wochenübersicht für alle.", "Gerecht verteilt, ohne Diskussion.", 2, "kostenlos", "nichts", "Friday, wer ist diese Woche mit Bad dran?", "putzplan.js", /\b(putzen|putzplan|staubsaugen|aufräumen|aufraeumen|haushalt)\b/i),
  V("pflanzen", "organisation", "Pflanzen-Gießplan", "Jede Pflanze mit Foto und Gieß-Rhythmus, Friday erinnert und denkt an Regen auf dem Balkon.", "Keine vertrockneten Pflanzen mehr.", 1, "kostenlos", "nichts", "Friday, welche Pflanzen muss ich heute gießen?", "pflanzen.js", /\b(pflanze\w*|gießen|giessen|blumen|balkon|garten)\b/i),
  V("gaeste", "friday", "Gäste-Modus", "Besuch darf Licht, Musik und Fernseher steuern, aber Friday verrät keine privaten Dinge (Termine, Konten, Mails). Ein Satz an, ein Satz aus.", "Friday herzeigen, ohne dass Privates rausrutscht.", 2, "kostenlos", "nichts", "Friday, Gäste-Modus an.", "gaeste.js", /\b(gäste|gaeste|besuch|party)\b/i),
  V("briefing-audio", "friday", "Briefing zum Mitnehmen", "Morgens legt Friday das Briefing als Audio-Datei aufs iPhone (Dateien-App), zum Hören im Auto oder in der Bahn.", "Informiert unterwegs, ohne aufs Display zu schauen.", 2, "kostenlos (mit ElevenLabs schönere Stimme)", "nichts", "Friday, mach mir das Briefing zum Mitnehmen.", "briefing-audio.js", /\b(briefing|unterwegs|im auto)\b/i),
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
const norm = (t) => String(t || "").toLowerCase().replace(/[^a-zäöüß0-9]+/g, " ").trim();
const version = () => { try { return fs.readFileSync(VERSION_DATEI, "utf8").trim(); } catch { return ""; } };

/** Wünsche im Ideen-Tresor (Bereich „Für Friday“), die inzwischen eingebaut sind, automatisch abhaken. */
export function tresorAbgleich() {
  try {
    const gebaut = KATALOG.filter(vorhanden);
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
    gebaut: vorschlaege.filter((v) => v.schonDa).map(({ id, titel, gruppe }) => ({ id, titel, gruppe })),
    abgehakt,
    zahlen: { gesamt: KATALOG.length, offen: vorschlaege.filter((v) => !v.schonDa).length, schonDa: vorschlaege.filter((v) => v.schonDa).length, gespraeche: gespraeche.length, wunschliste: wunsch, tage },
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
    text: `Vorhandene Module: ${module.join(", ")}\nWerkzeuge im Werkzeugkasten: ${WERKZEUGE.map((w) => w.titel).join(", ")}\nSchon eingebaut: ${KATALOG.filter(vorhanden).map((v) => v.titel).join(", ")}\nSchon als Vorschlag im Katalog (nicht wiederholen): ${KATALOG.filter((v) => !vorhanden(v)).map((v) => v.titel).join(", ")}\nLetzte Fragen an Friday:\n${fragen.join("\n")}`,
  });
  if (!r.ok) throw new Error(r.error || "Claude ist gerade nicht erreichbar.");
  try {
    const j = JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1));
    const bekannt = new Set([...KATALOG.map((v) => norm(v.titel)), ...WERKZEUGE.map((w) => norm(w.titel))]);
    return (j.vorschlaege || []).filter((v) => !bekannt.has(norm(v.titel))).slice(0, 6).map((v, i) => ({ id: `ki-${Date.now().toString(36)}-${i}`, gruppe: v.art === "einbinden" ? "ki" : "friday", art: v.art === "einbinden" ? "einbinden" : "bauen", titel: String(v.titel || "Vorschlag").slice(0, 80), pitch: String(v.pitch || "").slice(0, 400), nutzen: String(v.nutzen || "").slice(0, 300), aufwand: [1, 2, 3].includes(Number(v.aufwand)) ? Number(v.aufwand) : 2, kosten: String(v.kosten || "").slice(0, 80), braucht: String(v.braucht || "").slice(0, 160), sprache: String(v.sprache || "").slice(0, 120), ki: true, passt: 0, schonDa: false }));
  } catch { throw new Error("Claude hat keine lesbare Liste geschickt. Bitte nochmal."); }
}
