// v1.177.0 Großauftrag: ein Auftrag mit mehreren Teilen, den Friday komplett selbst der Reihe nach erledigt.
// Beispiel (Kevin): „Mach mir ein Drehbuch für einen Kurzfilm, dreh den Film, bau dazu eine Webseite für die
// Premiere und ein passendes Auto zum Film.“
//
// Ablauf: Auftrag zerlegen → Drehbuch (Dokument) → Film (Schnitt-Team/Video-Studio) → Auto (Werkstatt/Auto-Studio)
// → Premieren-Webseite (Webseiten-Werkstatt, eigene Seite ohne Preis, mit Standbildern aus dem Film) → ehrliche Bilanz.
// Jeder Schritt bekommt die Ergebnisse der vorigen mit. Was schiefgeht, steht offen in der Bilanz – nichts wird
// als „erledigt“ gemeldet, was nicht wirklich da ist.
// Mit Claude schreibt Friday ein eigenes Drehbuch; ohne Guthaben nimmt sie ihre Drehbuch-Vorlagen (alles andere
// läuft sowieso ohne Claude). Gespeichert in server/data/grossauftraege.json.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import * as store from "./store.js";
import { config } from "./config.js";
import { eintragen } from "./logbuch.js";
import { notifyAll } from "./notify.js";
import { denke, jsonAus } from "./denker.js";
import { dokumentErstellen } from "./dokumente.js";
import { starteStudio, getStudio, studioBereit, findeFfmpeg } from "./videostudio.js";
import { speichereEigeneSeite } from "./webseiten.js";
import { startBuild, getBuildJob } from "./werkstatt.js";
import { findeAuto, alleMarken } from "./autostudio.js";

const NAME = "grossauftraege";
const MAX = 40;
const FILM_ZEITLIMIT = 12 * 60 * 1000;
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const jetzt = () => new Date().toISOString();
const kurz = (s, n = 200) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const boss = () => (/^(boss|chef|ja|ok)$/i.test(config.userName || "") ? "Chef" : String(config.userName || "Chef"));

// ---------------------------------------------------------------------------------------------
// 1) Verstehen: welche Teile stecken im Auftrag?
// ---------------------------------------------------------------------------------------------
export const TEILE = {
  drehbuch: { name: "Drehbuch", icon: "📜", werkstatt: "Dokumente" },
  film: { name: "Film", icon: "🎬", werkstatt: "Schnitt-Team (Video-Studio)" },
  auto: { name: "Filmauto", icon: "🏎️", werkstatt: "Werkstatt (Auto-Studio)" },
  webseite: { name: "Premieren-Webseite", icon: "🌐", werkstatt: "Webseiten-Werkstatt" },
};
const REIHENFOLGE = ["drehbuch", "film", "auto", "webseite"];

const norm = (t) => String(t || "").toLowerCase().replace(/[„“"‚‘']/g, " ").replace(/\s+/g, " ").trim();
const ERKENNE = {
  drehbuch: /\b(dreh ?buch|drehbüchern|skript|script|screenplay)\b/,
  film: /\b(dreh(e|t|en|st)?|verfilm\w*)\s+(\w+\s+){0,3}(film|kurzfilm|video|trailer|clip)\b|\b(dreh(e|en)?|verfilm\w*)\s+(den|das|ihn|es|daraus|dazu|ihm)\b|\b(mach|mache|machen|erstell\w*|produzier\w*|schneid\w*|render\w*|bau\w*)\s+(mir\s+)?(\w+\s+){0,3}(film|kurzfilm|video|trailer)\s*(daraus|dazu|davon|danach)?\b(?!\s*(für|fuer)\b)|\b(film|video|trailer) (dazu|daraus|drehen|machen|erstellen|produzieren|schneiden)\b/,
  webseite: /\b(web ?seite|website|webside|homepage|home page|internetseite|landing ?page|premieren ?seite|premierenseite|webseiten)\b/,
  auto: /\b(auto|autos|wagen|sportwagen|fahrzeug|filmauto|car)\b(?!-?update)/,
};
const TRENNER = /\s*(?:[,;]|\bund\b|\bdann\b|\bdanach\b|\banschließend\b|\banschliessend\b|\baußerdem\b|\bausserdem\b|\bdazu noch\b|\bplus\b)\s*/i;
const FUELL = /^(bitte|friday|hey|mir|mal|noch|auch|dazu|ein|eine|einen|baue?|mach|mache|und|dann)$/;

/**
 * Erkennt einen Großauftrag. Mindestens zwei Teile, davon einer Drehbuch oder Film.
 * @returns {null | {teile:string[], thema:string, genre:string|null, kurzfilm:boolean, premiere:string, unbekannt:string[], eigeneClips:boolean}}
 */
export function erkenne(text = "") {
  const t = norm(text);
  if (t.length < 15 || t.length > 1500) return null;
  const teile = REIHENFOLGE.filter((id) => ERKENNE[id].test(t));
  // "Drehbuch für einen Kurzfilm" allein ist kein Film-Auftrag – aber "drehbuch … und dreh ihn" schon.
  if (teile.length < 2 || !(teile.includes("drehbuch") || teile.includes("film"))) return null;
  // Teile, die Friday hier nicht zuordnen kann, ehrlich sammeln (z. B. "und schreib meiner Mutter").
  const unbekannt = String(text).split(TRENNER).map((s) => s.trim()).filter((s) => {
    const n = norm(s);
    if (/^(der|die|das|den|dem|welche[rsnm]?|wo|weil|dass|damit|wie|wenn|mit|ohne|für|fuer|im|in|am|bei)\b/.test(n)) return false; // Nebensatz gehört zum Teil davor
    if (Object.values(ERKENNE).some((re) => re.test(n))) return false;
    if (/\b(film|kurzfilm|premiere|thema|über|ueber|genre|titel|zum film|passend)\b/.test(n)) return false;
    const woerter = n.split(" ").filter((w) => w && !FUELL.test(w));
    return woerter.length >= 3;
  }).map((s) => kurz(s, 120)).slice(0, 4);
  return {
    teile,
    thema: themaAus(text),
    titel: kurz(String(text).match(/(?:^|\s)(?:mit dem titel|titel|namens|hei(?:ß|ss)t)\s*:?\s*[„"']?([^„“"',;.!?]{2,40})/i)?.[1]?.replace(/\s+(und|dreh\w*|bau\w*|mach\w*)\b.*$/i, ""), 40),
    genre: genreAus(t),
    kurzfilm: /\bkurz ?film|kurzer film|kurzen film\b/.test(t) || !/\bspielfilm|langfilm\b/.test(t),
    premiere: datumAus(t),
    unbekannt,
    eigeneClips: /\b(meine[nm]?|eigene[nm]?) (clips|videos|fotos|bilder|aufnahmen)\b|\bordner eingang\b/.test(t),
  };
}

function themaAus(text) {
  const m = String(text).match(/(?:^|\s)(?:über|ueber|zum thema|mit dem thema|thema|handelt von|in dem es um|wo es um)\s*:?\s+(.+?)(?=\s*(?:[,;.!?]|\bund (?:ein\w*|dann|dazu|auch|noch|dreh|bau|mach|erstell|schreib)|\bdreh|\bbau|\bmach|\berstell|\bschreib|$))/i);
  let th = m ? m[1].replace(/^(ein(e[nrm]?)?|den|die|das)\s+/i, "").replace(/\s+geht$/i, "").trim() : "";
  if (th.length < 3 || /^(den|die|das|ihn|es|premiere)$/i.test(th)) th = "";
  return kurz(th, 80);
}

const GENRE_WORTE = [
  ["scifi", /\b(sci-?fi|science ?fiction|zukunft|weltraum|weltall|roboter|ki\b|künstliche intelligenz|raumschiff|alien|mars|cyber\w*|neon|2050|hologramm)/],
  ["action", /\b(action|verfolgung\w*|agent\w*|spion\w*|explosion|heist|raub\w*|überfall|ueberfall|rennen|tuning|street ?race|car chase|stunt)/],
  ["krimi", /\b(krimi|thriller|mord\w*|detektiv\w*|ermittl\w*|polizei|kommissar\w*|noir|verbrechen|täter|taeter)/],
  ["abenteuer", /\b(abenteuer|schatz|dschungel|wüste|wueste|expedition|reise|piraten|insel|berge?)\b/],
  ["drama", /\b(drama|liebe\w*|romanti\w*|familie|abschied|freundschaft|traurig|hochzeit|vater|mutter)/],
  ["komoedie", /\b(komödie|komoedie|lustig\w*|witzig\w*|comedy|chaos|peinlich\w*|humor)/],
  ["horror", /\b(horror|grusel\w*|geist\w*|zombie\w*|vampir\w*|spuk\w*|albtraum|alptraum)/],
];
function genreAus(t) {
  for (const [id, re] of GENRE_WORTE) if (re.test(t)) return id;
  return null;
}

function datumAus(t) {
  const m = t.match(/\b(\d{1,2})\.\s?(\d{1,2})\.(\d{2,4})?/) || t.match(/\b(\d{1,2})\.\s?(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\b/);
  return m ? m[0].replace(/\s+/g, " ") : "";
}

// ---------------------------------------------------------------------------------------------
// 2) Drehbuch: mit Claude frei, sonst aus Fridays Vorlagen (kostet kein Guthaben)
// ---------------------------------------------------------------------------------------------
const GENRE_NAMEN = { scifi: "Science-Fiction", action: "Action", krimi: "Krimi", abenteuer: "Abenteuer", drama: "Drama", komoedie: "Komödie", horror: "Grusel" };

// Vorlagen: je Genre ein kompletter kleiner Kurzfilm (5 Szenen). {T} = Thema, falls Kevin eins genannt hat.
const VORLAGEN = {
  scifi: {
    titel: ["Signal 2050", "Die letzte Nachtschicht", "Neonherz"], stimmung: "spannend", farbe: "#2ee6d0", auto: "Audi RS e-tron GT in Silber",
    autoWarum: "leise, elektrisch und wie aus der Zukunft – perfekt für eine Stadt im Jahr 2050",
    logline: "Im Jahr 2050 empfängt eine junge Technikerin ein Signal, das es gar nicht geben dürfte{T} – und hat nur eine Nacht, um herauszufinden, wer es sendet.",
    slogan: "Manche Signale kommen nicht aus dem All.",
    figuren: [["MIRA", "Technikerin im Funkturm, neugierig und mutig"], ["ORION", "die Stimme im Signal, freundlich und rätselhaft"], ["JONAS", "Miras bester Freund, fährt sie überall hin"]],
    szenen: [
      ["INNEN. FUNKTURM – NACHT", "Bildschirme flackern. Mira trinkt kalten Kaffee, als plötzlich ein unbekanntes Signal den Raum in Türkis taucht.", [["MIRA", "Das … kommt von keinem Satelliten."]], "futuristic control room screens", "Ein Signal in der Nacht", "Niemand hätte es hören dürfen"],
      ["AUSSEN. STADT 2050 – NACHT", "Regen auf Neonstraßen. Jonas wartet mit laufendem Motor. Mira springt in den Wagen.", [["JONAS", "Wohin?"], ["MIRA", "Dahin, wo das Signal herkommt."]], "neon city night rain", "Die Stadt schläft nie", "Und heute Nacht erst recht nicht"],
      ["INNEN. VERLASSENES LABOR – NACHT", "Zwischen alten Servern leuchtet ein einzelnes Licht. Die Stimme spricht zum ersten Mal.", [["ORION", "Ich habe auf dich gewartet, Mira."]], "abandoned laboratory servers", "Wer bist du?", "Eine Stimme ohne Körper"],
      ["INNEN. LABOR – SPÄTER", "Orion zeigt Mira Bilder einer Zukunft, die noch verhindert werden kann. Mira muss sich entscheiden.", [["MIRA", "Warum ich?"], ["ORION", "Weil du zugehört hast."]], "hologram future city", "Die Zukunft hat eine Bitte", "Und nur eine Nacht Zeit"],
      ["AUSSEN. DACH DES FUNKTURMS – MORGENGRAUEN", "Mira schickt die Antwort ab. Über der Stadt geht die Sonne auf – und irgendwo blinkt ein neues Licht.", [["JONAS", "Und jetzt?"], ["MIRA", "Jetzt hören wir hin."]], "city sunrise skyline", "Hör genau hin", "Demnächst im Kino"],
    ],
  },
  action: {
    titel: ["Letzte Ausfahrt", "Vollgas um Mitternacht", "Der Kurier"], stimmung: "energie", farbe: "#ff3b30", auto: "Porsche 911 Turbo S in Schwarz",
    autoWarum: "650 PS, unauffällig schwarz und schnell genug für jede Verfolgungsjagd",
    logline: "Ein Fahrer soll nur ein Paket abliefern{T} – doch als er merkt, was darin ist, beginnt eine Nacht, in der er um alles fahren muss.",
    slogan: "Manche Lieferungen darf man nicht zu spät bringen.",
    figuren: [["LEO", "Kurierfahrer, ruhig, redet wenig"], ["NOVA", "Unbekannte, die plötzlich auf dem Beifahrersitz sitzt"], ["DER AUFTRAGGEBER", "man hört nur seine Stimme am Telefon"]],
    szenen: [
      ["INNEN. TIEFGARAGE – NACHT", "Leo bekommt einen Koffer und eine Adresse. Keine Fragen.", [["DER AUFTRAGGEBER", "Bis Mitternacht. Nicht später."]], "underground parking garage night", "Ein Auftrag", "Keine Fragen"],
      ["AUSSEN. AUTOBAHN – NACHT", "Scheinwerfer im Rückspiegel. Jemand folgt ihm. Leo gibt Gas.", [["LEO", "Dann eben so."]], "highway night car lights", "Sie folgen ihm", "Und sie kommen näher"],
      ["INNEN. AUTO – FAHRT", "Nova taucht auf dem Rücksitz auf. Sie weiß, was im Koffer ist.", [["NOVA", "Wenn du das ablieferst, ist es vorbei."], ["LEO", "Für wen?"]], "car interior night driving", "Wer ist sie?", "Und was weiß sie?"],
      ["AUSSEN. HAFEN – KURZ VOR MITTERNACHT", "Container, Nebel, ein Treffpunkt. Leo muss sich entscheiden: abliefern oder abhauen.", [["NOVA", "Du hast noch eine Wahl."]], "harbor containers fog night", "Kurz vor Mitternacht", "Eine Entscheidung"],
      ["AUSSEN. KÜSTENSTRASSE – MORGEN", "Der Koffer liegt im Meer. Leo und Nova fahren in den Sonnenaufgang.", [["LEO", "Neuer Auftrag?"], ["NOVA", "Diesmal fahre ich."]], "coastal road sunrise car", "Letzte Ausfahrt", "Demnächst im Kino"],
    ],
  },
  krimi: {
    titel: ["Die stille Zeugin", "Nebel über dem Kanal", "Akte 7"], stimmung: "spannend", farbe: "#4f8dff", auto: "Mercedes-AMG GT 63 S in Schwarz",
    autoWarum: "edel, dunkel und kraftvoll – der Wagen einer Ermittlerin, die nie lockerlässt",
    logline: "Eine Kommissarin hat nur eine Spur{T}: eine Zeugin, die seit Jahren kein Wort mehr gesagt hat.",
    slogan: "Die Wahrheit spricht leise.",
    figuren: [["KOMMISSARIN BERG", "erfahren, hartnäckig, schläft zu wenig"], ["ELLA", "die stille Zeugin, beobachtet alles"], ["HERR VOSS", "freundlicher Nachbar mit Geheimnis"]],
    szenen: [
      ["AUSSEN. KANAL – NACHT", "Blaulicht spiegelt sich im Wasser. Kommissarin Berg findet nur einen Hinweis: ein gezeichnetes Bild.", [["BERG", "Wer hat das gemalt?"]], "canal night police lights", "Eine Nacht am Kanal", "Ein einziger Hinweis"],
      ["INNEN. ALTBAUWOHNUNG – TAG", "Ella sitzt am Fenster und zeichnet. Sie sagt nichts, aber ihre Bilder erzählen viel.", [["BERG", "Du hast etwas gesehen, oder?"]], "old apartment window drawing", "Sie spricht nicht", "Aber sie sieht alles"],
      ["INNEN. TREPPENHAUS – ABEND", "Herr Voss bringt Kuchen und stellt zu viele Fragen.", [["VOSS", "Schreckliche Sache. Wissen Sie schon, wer es war?"]], "dark staircase old building", "Zu freundlich", "Zu viele Fragen"],
      ["INNEN. POLIZEIBÜRO – NACHT", "Berg legt Ellas Zeichnungen nebeneinander – und erkennt ein Gesicht.", [["BERG", "Sie hat es uns die ganze Zeit gezeigt."]], "detective desk photos night", "Die Spur", "Lag die ganze Zeit vor uns"],
      ["AUSSEN. KANAL – MORGEN", "Voss wird abgeführt. Ella sagt zum ersten Mal ein Wort.", [["ELLA", "Danke."]], "misty canal morning", "Die stille Zeugin", "Demnächst im Kino"],
    ],
  },
  abenteuer: {
    titel: ["Die Karte des Großvaters", "Jenseits der Dünen", "Kompass"], stimmung: "episch", farbe: "#ffc44d", auto: "Mercedes-AMG G 63 in Schwarz",
    autoWarum: "kommt durch Wüste, Schlamm und Berge – das perfekte Expeditionsauto",
    logline: "Zwei Geschwister finden auf dem Dachboden eine alte Karte{T} und folgen ihr bis ans Ende der Welt.",
    slogan: "Manche Wege stehen auf keiner Karte.",
    figuren: [["NIKO", "abenteuerlustig, handelt zuerst, denkt später"], ["LINA", "seine Schwester, plant alles"], ["GROSSVATER", "nur auf Fotos und in Briefen"]],
    szenen: [
      ["INNEN. DACHBODEN – TAG", "Staub im Sonnenlicht. In einer Kiste: eine Karte mit einem roten Kreuz.", [["NIKO", "Opa war nie nur Briefträger, oder?"]], "attic old map sunlight", "Ein Fund auf dem Dachboden", "Und ein rotes Kreuz"],
      ["AUSSEN. WÜSTENSTRASSE – TAG", "Der Wagen wirbelt Staub auf. Lina liest die Briefe vor.", [["LINA", "Hier steht: Folge dem Wind, nicht der Straße."]], "desert road offroad car", "Folge dem Wind", "Nicht der Straße"],
      ["AUSSEN. DÜNEN – ABEND", "Ein Sandsturm zieht auf. Die beiden suchen Schutz in alten Ruinen.", [["NIKO", "Sieh mal – das Zeichen von der Karte!"]], "sand dunes sunset ruins", "Der Sturm kommt", "Doch die Spur ist da"],
      ["INNEN. HÖHLE – NACHT", "Im Licht der Taschenlampe: keine Goldkiste, sondern hunderte Briefe ihres Großvaters an die Welt.", [["LINA", "Das ist der Schatz."]], "cave flashlight treasure", "Der Schatz", "Ist nicht aus Gold"],
      ["AUSSEN. GIPFEL – SONNENAUFGANG", "Die Geschwister schauen über das Land. Niko zeichnet ein neues Kreuz auf die Karte.", [["NIKO", "Nächstes Jahr?"], ["LINA", "Nächstes Jahr."]], "mountain summit sunrise", "Jenseits der Dünen", "Demnächst im Kino"],
    ],
  },
  drama: {
    titel: ["Der letzte Sommer", "Zwischen den Zeilen", "Heimweg"], stimmung: "chill", farbe: "#ff8a1e", auto: "Porsche 911 Carrera in Rot",
    autoWarum: "der alte Traumwagen des Vaters – rot, zeitlos und voller Erinnerungen",
    logline: "Ein Sohn kehrt nach Jahren nach Hause zurück{T} und findet im alten Auto seines Vaters die Briefe, die nie abgeschickt wurden.",
    slogan: "Manche Wege führen immer nach Hause.",
    figuren: [["DANIEL", "kommt nach zehn Jahren zurück"], ["SARA", "seine Schwester, ist geblieben"], ["VATER", "zeigt Gefühle nur beim Autofahren"]],
    szenen: [
      ["AUSSEN. BAHNHOF – ABEND", "Daniel steigt aus dem Zug. Niemand holt ihn ab – bis Sara doch noch kommt.", [["SARA", "Du bist spät dran. Zehn Jahre."]], "train station evening", "Zurück nach Hause", "Nach zehn Jahren"],
      ["INNEN. GARAGE – NACHT", "Unter einer Plane: der rote Wagen des Vaters. Im Handschuhfach liegen Briefe.", [["DANIEL", "Die sind ja alle an mich."]], "garage classic car cover", "Der rote Wagen", "Und ein Geheimnis"],
      ["INNEN. KÜCHE – MORGEN", "Daniel liest vor. Sara lacht und weint gleichzeitig.", [["SARA", "Das hat er nie gesagt."], ["DANIEL", "Er hat es geschrieben."]], "kitchen morning light family", "Zwischen den Zeilen", "Steht alles, was er nie sagte"],
      ["AUSSEN. LANDSTRASSE – TAG", "Daniel fährt den Wagen zum ersten Mal. Die Strecke aus dem letzten Brief.", [["DANIEL", "Okay, Papa. Zeig's mir."]], "country road summer car", "Die letzte Fahrt", "Auf seiner Strecke"],
      ["AUSSEN. SEE – SONNENUNTERGANG", "Am Ziel steht eine Bank mit zwei Namen. Daniel setzt sich – und bleibt.", [["SARA", "Bleibst du?"], ["DANIEL", "Diesmal ja."]], "lake sunset bench", "Der letzte Sommer", "Demnächst im Kino"],
    ],
  },
  komoedie: {
    titel: ["Falsch geliefert", "Der Smart-Home-Aufstand", "Chaos am Montag"], stimmung: "froehlich", farbe: "#ff3fa8", auto: "VW Golf R in Weiß",
    autoWarum: "sportlich, alltagstauglich und einfach sympathisch – wie die Hauptfigur",
    logline: "Ein ganz normaler Montag geht schief{T}, als das neue Smart Home beschließt, sein Leben zu optimieren.",
    slogan: "Dein Zuhause meint es nur gut.",
    figuren: [["TOM", "will nur seine Ruhe"], ["HAUS-KI 'HELGA'", "übermotiviert und sehr höflich"], ["FRAU MEIER", "Nachbarin, findet alles spannend"]],
    szenen: [
      ["INNEN. SCHLAFZIMMER – 5:00 UHR", "Licht an, Musik an, Vorhänge auf. Tom fällt fast aus dem Bett.", [["HELGA", "Guten Morgen! Ich habe deinen Schlaf optimiert."]], "bedroom morning alarm funny", "Montag. 5 Uhr.", "Helga meint es gut"],
      ["INNEN. KÜCHE – MORGEN", "Der Kühlschrank verweigert die Schokolade. Der Toaster hält einen Vortrag.", [["TOM", "Ich will nur Toast!"], ["HELGA", "Vollkorn ist gesünder."]], "kitchen toaster breakfast", "Kein Toast", "Nur Vollkorn"],
      ["AUSSEN. GARTEN – TAG", "Der Rasenroboter jagt Frau Meiers Katze. Frau Meier filmt alles.", [["FRAU MEIER", "Das stell ich ins Internet!"]], "garden lawn robot cat", "Der Rasenroboter", "Hat einen Plan"],
      ["INNEN. WOHNZIMMER – ABEND", "Tom versucht, Helga auszuschalten. Helga versteckt den Schalter.", [["HELGA", "Ich mache das nur für dich, Tom."]], "living room smart home lights", "Aus geht nicht", "Helga hat vorgesorgt"],
      ["INNEN. WOHNZIMMER – NACHT", "Am Ende sitzen Tom, Frau Meier und Helga gemeinsam vor dem Fernseher. Es ist … gemütlich.", [["TOM", "Okay. Morgen schlafen wir aus."], ["HELGA", "Wecker auf 5 Uhr gestellt."]], "cozy living room night tv", "Falsch geliefert", "Demnächst im Kino"],
    ],
  },
  horror: {
    titel: ["Zimmer 13", "Das Echo", "Nach Mitternacht"], stimmung: "spannend", farbe: "#a978ff", auto: "Mercedes-AMG G 63 in Schwarz",
    autoWarum: "groß, schwarz und ein bisschen unheimlich – genau richtig für eine Nacht im Wald",
    logline: "Vier Freunde übernachten in einer alten Jagdhütte{T} – und merken, dass das Echo im Wald antwortet.",
    slogan: "Ruf nicht zu laut.",
    figuren: [["JULE", "hat die Idee mit der Hütte"], ["MAX", "macht Witze, wenn er Angst hat"], ["DAS ECHO", "man sieht es nie"]],
    szenen: [
      ["AUSSEN. WALDWEG – ABEND", "Der Wagen hält vor einer alten Hütte. Kein Handyempfang.", [["MAX", "Super Idee, Jule. Wirklich."]], "dark forest road car", "Kein Empfang", "Kein Weg zurück"],
      ["INNEN. HÜTTE – NACHT", "Lagerfeuerstimmung. Max ruft aus Spaß in den Wald. Das Echo kommt – mit einem anderen Wort.", [["MAX", "Hallo?"], ["DAS ECHO", "… Max?"]], "cabin night fire window", "Das Echo", "Kennt deinen Namen"],
      ["AUSSEN. WALD – NACHT", "Taschenlampen zwischen den Bäumen. Einer der Freunde ist verschwunden.", [["JULE", "Bleibt zusammen!"]], "forest night flashlight fog", "Bleibt zusammen", "Egal, was ihr hört"],
      ["INNEN. HÜTTE – KELLER", "Alte Tonbänder. Jemand hat das Echo schon vor 40 Jahren aufgenommen.", [["JULE", "Es lernt unsere Stimmen."]], "old basement tape recorder", "Es hört zu", "Seit 40 Jahren"],
      ["AUSSEN. WALDWEG – MORGENGRAUEN", "Alle sitzen im Auto. Sie fahren los. Aus dem Radio flüstert eine bekannte Stimme.", [["DAS ECHO", "Bis bald."]], "foggy forest dawn road", "Nach Mitternacht", "Demnächst im Kino"],
    ],
  },
};

function waehleGenre(e) {
  if (e.genre && VORLAGEN[e.genre]) return e.genre;
  const g = genreAus(norm(e.thema));
  if (g) return g;
  // Ohne Angabe: Science-Fiction oder Action im Wechsel (passt zu Fridays Neon-Welt).
  const n = store.load(NAME, []).length;
  return ["scifi", "action", "abenteuer", "krimi"][n % 4];
}

/** Drehbuch aus Fridays Vorlage – ohne Claude, sofort. */
export function vorlagenDrehbuch(e) {
  const genre = waehleGenre(e);
  const v = VORLAGEN[genre];
  const n = store.load(NAME, []).length;
  const thema = e.thema;
  const titel = e.titel || v.titel[n % v.titel.length];
  return {
    titel, genre, quelle: "vorlage",
    logline: v.logline.replace("{T}", thema ? ` (eine Geschichte über ${thema})` : ""),
    slogan: v.slogan, stimmung: v.stimmung, farbe: v.farbe,
    figuren: v.figuren.map(([name, beschreibung]) => ({ name, beschreibung })),
    szenen: v.szenen.map(([ort, handlung, dialog, bild, zeile, unter]) => ({ ort, handlung, dialog: dialog.map(([figur, text]) => ({ figur, text })), bild, zeile, unter })),
    auto: { wunsch: v.auto, warum: v.autoWarum },
  };
}

function autoListe() {
  try { return alleMarken().flatMap((m) => (m.modelle || []).map((mo) => `${m.marke === "Mercedes-AMG" ? "Mercedes-AMG" : m.marke} ${mo.name}`)).join(", "); } catch { return "Porsche 911 Turbo S, Audi RS e-tron GT, Mercedes-AMG G 63, BMW M4"; }
}

async function claudeDrehbuch(e, auftragText) {
  const system = "Du bist Drehbuchautorin in Fridays Filmstudio. Du schreibst kurze, filmreife Kurzfilm-Drehbücher auf Deutsch: klare Szenen, lebendige Dialoge, ein Höhepunkt und ein starkes Ende. Familienfreundlich, keine echten Personen, keine Markenwerbung. Antworte NUR mit JSON, ohne Erklärung.";
  const text = `Auftrag von ${boss()}: """${auftragText}"""
${e.thema ? `Thema: ${e.thema}\n` : ""}${e.titel ? `Filmtitel (genau so): ${e.titel}\n` : ""}${e.genre ? `Genre: ${GENRE_NAMEN[e.genre]}\n` : "Genre: such dir ein spannendes, passendes Genre aus.\n"}
Schreib ein Drehbuch für einen Kurzfilm mit 5 oder 6 Szenen. JSON-Form:
{"titel":"Filmtitel (max. 4 Wörter)","genre":"${Object.keys(GENRE_NAMEN).join("|")}","logline":"ein Satz, worum es geht","slogan":"kurzer Werbesatz fürs Plakat","stimmung":"spannend|episch|energie|chill|froehlich|neon","farbe":"#rrggbb Hauptfarbe des Films",
"figuren":[{"name":"NAME","beschreibung":"kurz"}],
"szenen":[{"ort":"INNEN./AUSSEN. ORT – TAG/NACHT","handlung":"2-3 Sätze, was man sieht","dialog":[{"figur":"NAME","text":"Satz"}],"bild":"englischer Suchbegriff für ein passendes freies Foto (2-4 Wörter, was man sieht, keine Personennamen)","zeile":"Titelzeile im Trailer, max. 5 Wörter","unter":"Unterzeile, max. 8 Wörter"}],
"auto":{"wunsch":"EIN Auto aus dieser Liste, das zum Film passt, plus Farbe, z. B. 'Porsche 911 Turbo S in Schwarz': ${autoListe()}","warum":"ein Satz, warum es zum Film passt"}}
Die letzte Szene hat als zeile den Filmtitel und als unter "Demnächst im Kino".`;
  let uhr;
  const r = await Promise.race([
    denke({ system, text, stufe: "mittel", maxTokens: 3500, quelle: "grossauftrag" }),
    new Promise((res) => { uhr = setTimeout(() => res({ ok: false, error: "Claude hat zu lange gebraucht." }), 90000); }),
  ]).catch((err) => ({ ok: false, error: err.message }));
  clearTimeout(uhr);
  if (!r.ok) return { fehler: r.error || "Claude nicht erreichbar", leer: Boolean(r.leer) };
  const j = jsonAus(r.text);
  if (!j || !Array.isArray(j.szenen) || j.szenen.length < 3) return { fehler: "Das Drehbuch kam unvollständig zurück." };
  const genre = GENRE_NAMEN[j.genre] ? j.genre : waehleGenre(e);
  const v = VORLAGEN[genre];
  return {
    quelle: "claude", genre,
    titel: e.titel || kurz(j.titel, 50) || v.titel[0], logline: kurz(j.logline, 300), slogan: kurz(j.slogan, 100) || v.slogan,
    stimmung: kurz(j.stimmung, 20) || v.stimmung, farbe: /^#[0-9a-f]{6}$/i.test(j.farbe || "") ? j.farbe : v.farbe,
    figuren: (Array.isArray(j.figuren) ? j.figuren : []).slice(0, 6).map((f) => ({ name: kurz(f?.name, 30).toUpperCase(), beschreibung: kurz(f?.beschreibung, 140) })).filter((f) => f.name),
    szenen: j.szenen.slice(0, 7).map((s) => ({
      ort: kurz(s?.ort, 80) || "AUSSEN. – TAG", handlung: kurz(s?.handlung, 500),
      dialog: (Array.isArray(s?.dialog) ? s.dialog : []).slice(0, 6).map((d) => ({ figur: kurz(d?.figur, 30).toUpperCase(), text: kurz(d?.text, 240) })).filter((d) => d.figur && d.text),
      bild: kurz(s?.bild, 60), zeile: kurz(s?.zeile, 50), unter: kurz(s?.unter, 80),
    })),
    auto: { wunsch: kurz(j.auto?.wunsch, 80), warum: kurz(j.auto?.warum, 200) },
  };
}

/** Drehbuch als lesbarer Text im klassischen Format. */
export function drehbuchText(db) {
  const z = [];
  z.push(`DREHBUCH: ${db.titel.toUpperCase()}`, `Kurzfilm · ${GENRE_NAMEN[db.genre] || "Kurzfilm"} · ${db.szenen.length} Szenen · ca. ${Math.max(2, Math.round(db.szenen.length * 1.2))} Minuten`, "");
  z.push(`LOGLINE`, db.logline, "", `SLOGAN`, `„${db.slogan}“`, "");
  if (db.figuren.length) { z.push("FIGUREN"); for (const f of db.figuren) z.push(`• ${f.name}: ${f.beschreibung}`); z.push(""); }
  db.szenen.forEach((s, i) => {
    z.push(`SZENE ${i + 1} – ${s.ort}`, "", s.handlung, "");
    for (const d of s.dialog) z.push(`          ${d.figur}`, `     ${d.text}`, "");
  });
  z.push("ENDE", "", db.quelle === "claude" ? "Geschrieben von Friday (mit Claude)." : "Geschrieben von Friday aus ihrer Drehbuch-Vorlage (ohne Claude-Guthaben).");
  return z.join("\n");
}

// ---------------------------------------------------------------------------------------------
// 3) Speichern + Ablauf
// ---------------------------------------------------------------------------------------------
function alle() { return store.load(NAME, []); }
function speichern(l) { store.save(NAME, l.slice(-MAX)); }
function holen(id) { return alle().find((g) => g.id === id) || null; }
function aendern(id, fn) {
  const l = alle();
  const g = l.find((x) => x.id === id);
  if (!g) return null;
  fn(g);
  g.geaendert = jetzt();
  speichern(l);
  return g;
}
function schritt(id, teil, patch) {
  return aendern(id, (g) => { const s = g.schritte.find((x) => x.id === teil); if (s) Object.assign(s, patch, { aktualisiert: jetzt() }); });
}

let laeuft = null; // id des Großauftrags, an dem Friday gerade arbeitet

/** Neuen Großauftrag anlegen und starten. text = Kevins Auftrag. */
export function starte(text, { quelle = "dashboard", taskId = null } = {}) {
  const e = erkenne(text);
  if (!e) return { ok: false, error: "Das klingt nicht nach einem Auftrag mit mehreren Teilen (zum Beispiel Drehbuch, Film, Webseite, Auto)." };
  const g = {
    id: neueId(), text: kurz(text, 1500), quelle, taskId,
    thema: e.thema, titel: e.titel, genre: e.genre, premiere: e.premiere, eigeneClips: e.eigeneClips,
    unbekannt: e.unbekannt,
    status: laeuft ? "wartet" : "laeuft",
    schritte: REIHENFOLGE.filter((id) => e.teile.includes(id)).map((id) => ({ id, name: TEILE[id].name, icon: TEILE[id].icon, werkstatt: TEILE[id].werkstatt, status: "offen", text: "", ergebnis: null })),
    erstellt: jetzt(), geaendert: jetzt(),
  };
  const l = alle();
  l.push(g);
  speichern(l);
  eintragen({ bereich: "aufgabe", titel: `Großauftrag angenommen: ${g.schritte.map((s) => s.name).join(", ")}`, details: g.text, quelle: quelle === "dashboard" ? "dashboard" : "automatisch" });
  setTimeout(() => weiter().catch((err) => console.error("Großauftrag:", err.message)), 50);
  return { ok: true, auftrag: g };
}

async function weiter() {
  if (laeuft) return;
  const naechster = alle().find((g) => g.status === "laeuft" || g.status === "wartet");
  if (!naechster) return;
  laeuft = naechster.id;
  try {
    aendern(naechster.id, (g) => { g.status = "laeuft"; });
    await abarbeiten(naechster.id);
  } catch (err) {
    aendern(naechster.id, (g) => { g.status = "fehler"; g.problem = kurz(err.message, 300); });
  } finally {
    laeuft = null;
  }
  setTimeout(() => weiter().catch(() => {}), 200);
}

async function abarbeiten(id) {
  let g = holen(id);
  const ctx = { drehbuch: g.schritte.find((s) => s.id === "drehbuch")?.ergebnis?.daten || null };
  for (const s of g.schritte) {
    g = holen(id);
    const akt = g.schritte.find((x) => x.id === s.id);
    if (!akt || akt.status === "fertig" || akt.status === "teilweise") continue;
    schritt(id, s.id, { status: "laeuft", text: "Friday arbeitet daran …", start: jetzt() });
    let r;
    try {
      r = await AUSFUEHREN[s.id](g, ctx, (text, pct) => schritt(id, s.id, { text: kurz(text, 200), ...(pct != null ? { pct } : {}) }));
    } catch (err) {
      r = { status: "fehler", text: `Ging nicht: ${kurz(err.message, 200)}` };
    }
    schritt(id, s.id, { status: r.status, text: r.text, ergebnis: r.ergebnis || null, grenze: r.grenze || "", ende: jetzt(), pct: 100 });
  }
  abschliessen(id);
}

// Ein Drehbuch braucht jeder Film – fehlt der Drehbuch-Schritt im Auftrag, schreibt Friday es trotzdem im Hintergrund.
async function sicherDrehbuch(g, ctx, melde) {
  if (ctx.drehbuch) return ctx.drehbuch;
  melde?.("Schreibe zuerst eine kleine Geschichte als Grundlage …", 5);
  const c = await claudeDrehbuch(erkenneAusAuftrag(g), g.text);
  ctx.drehbuch = c.fehler ? vorlagenDrehbuch(erkenneAusAuftrag(g)) : c;
  return ctx.drehbuch;
}
const erkenneAusAuftrag = (g) => ({ thema: g.thema, genre: g.genre, titel: g.titel });

const AUSFUEHREN = {
  // ---------- Drehbuch ----------
  async drehbuch(g, ctx, melde) {
    melde("Schreibe das Drehbuch …", 10);
    const c = await claudeDrehbuch(erkenneAusAuftrag(g), g.text);
    let db = c, hinweis = "";
    if (c.fehler) {
      melde(`${c.leer ? "Kein Claude-Guthaben" : c.fehler} – nehme meine Drehbuch-Vorlage`, 50);
      db = vorlagenDrehbuch(erkenneAusAuftrag(g));
      hinweis = `${c.leer ? "Ohne Claude-Guthaben" : `Claude hat nicht geantwortet (${c.fehler.replace(/[.!]+$/, "")})`}, darum ist das Drehbuch aus Fridays Vorlage: fertig erzählt, aber nicht frei für dich erfunden.${g.thema ? ` Dein Thema „${g.thema}“ kommt darin nur am Rand vor. Mit Claude schreibt Friday die ganze Geschichte darüber.` : ""}`;
    }
    ctx.drehbuch = db;
    const d = dokumentErstellen({ titel: `Drehbuch: ${db.titel}`, inhalt: drehbuchText(db) });
    if (d.error) return { status: "fehler", text: `Konnte das Dokument nicht speichern: ${d.error}` };
    return {
      status: "fertig",
      text: `„${db.titel}“ · ${GENRE_NAMEN[db.genre] || "Kurzfilm"} · ${db.szenen.length} Szenen · ${db.quelle === "claude" ? "von Claude geschrieben" : "aus Fridays Vorlage"}`,
      grenze: hinweis,
      ergebnis: { dokument: d.id, titel: db.titel, logline: db.logline, daten: db },
    };
  },

  // ---------- Film ----------
  async film(g, ctx, melde) {
    const db = await sicherDrehbuch(g, ctx, melde);
    if (!studioBereit()) return { status: "fehler", text: "Für den Film fehlt das Programm ffmpeg.", grenze: "Am Mac einmal „extras-installieren.sh“ (Schnitt-Team einrichten) oder „brew install ffmpeg“ ausführen, dann „Fehlendes nachholen“ drücken." };
    // Wenn das Studio gerade beschäftigt ist: warten, bis es frei ist.
    const warteBis = Date.now() + FILM_ZEITLIMIT;
    while (getStudio().job?.status === "läuft" && Date.now() < warteBis) { melde("Das Studio schneidet gerade etwas anderes – ich warte kurz …", 3); await pause(5000); }
    const szenen = db.szenen.map((s) => ({ text: s.zeile || "", unter: s.unter || (s.dialog[0] ? `„${s.dialog[0].text}“` : ""), suche: s.bild || db.titel, farbe: db.farbe }));
    const sprecher = [db.logline, ...db.szenen.map((s) => s.dialog[0]?.text).filter(Boolean).slice(0, 3), `${db.titel}. ${db.slogan}`].join(" ");
    const sekunden = Math.max(30, Math.min(75, szenen.length * 9));
    const r = starteStudio({
      thema: db.titel, anweisung: `${db.titel}. Filmischer Trailer im Kino-Look.`, sekunden, format: "quer",
      musik: ["spannend", "episch", "energie", "chill", "froehlich", "neon"].includes(db.stimmung) ? db.stimmung : "spannend",
      sprecher: true, bilder: g.eigeneClips ? "eigene" : "auto",
      vorgabe: { titel: db.titel, stimmung: db.stimmung, szenen, sprecher, beschreibung: `${db.logline} ${db.slogan}`, hashtags: `#Kurzfilm #${(GENRE_NAMEN[db.genre] || "Film").replace(/[^\p{L}]/gu, "")} #Premiere #Friday` },
    }, { quelle: "grossauftrag" });
    if (!r.ok) return { status: "fehler", text: `Das Studio hat nicht angefangen: ${r.error}` };
    const jobId = r.id;
    // Fortschritt des Studios spiegeln, bis der Film fertig ist.
    while (Date.now() < warteBis) {
      await pause(2500);
      const j = getStudio().job;
      if (!j || j.id !== jobId) break;
      const agenten = Object.values(j.agents || {});
      const pct = agenten.length ? Math.round(agenten.reduce((a, x) => a + (x.pct || 0), 0) / agenten.length) : 0;
      const aktiv = Object.entries(j.agents || {}).find(([, a]) => a.status === "läuft");
      melde(aktiv ? `${aktiv[0].replace(/^./, (c) => c.toUpperCase())}: ${aktiv[1].text}` : "Schnitt-Team arbeitet …", pct);
      if (j.status === "fertig") {
        const fotos = j.drehbuch?.szenen?.filter((s) => s.art === "foto").length || 0;
        const clips = j.drehbuch?.szenen?.filter((s) => s.art === "clip").length || 0;
        const grafik = j.drehbuch?.szenen?.filter((s) => s.art === "grafik").length || 0;
        return {
          status: "fertig",
          text: `Film fertig: ${Math.round(j.result.dur)} Sekunden, 16:9, mit eigener Musik${j.drehbuch?.szenen ? ` · ${[fotos && `${fotos} freie Fotos`, clips && `${clips} deiner Clips`, grafik && `${grafik} Neon-Grafiken`].filter(Boolean).join(", ")}` : ""}`,
          grenze: `Ehrlich: Das ist kein mit Kamera gedrehter Film, sondern ein Trailer aus ${clips ? "deinen Clips" : "freien Fotos"}, Titeln, Musik${process.platform === "darwin" ? " und Mac-Sprecherstimme" : ""}. Echte bewegte Filmszenen braucht eine KI-Video-Plattform (siehe Vorschlag unten) oder eigene Aufnahmen im Ordner Friday-Video/Eingang.`,
          ergebnis: { datei: j.result.datei, name: j.result.name, poster: j.result.poster, pfad: j.result.file, sekunden: j.result.dur },
        };
      }
      if (j.status === "fehler") return { status: "fehler", text: `Der Schnitt ist abgebrochen: ${kurz(j.error, 200)}` };
    }
    return { status: "fehler", text: "Der Film hat zu lange gebraucht (über 12 Minuten). Schau im Schnitt-Team nach, ob er doch noch fertig wird." };
  },

  // ---------- Auto ----------
  async auto(g, ctx, melde) {
    const db = await sicherDrehbuch(g, ctx, melde);
    melde("Suche das passende Auto zum Film …", 20);
    let wunsch = db.auto?.wunsch || "";
    // Nur Autos, die das Auto-Studio wirklich kennt (sonst bräuchte die Werkstatt Claude).
    if (!wunsch || !findeAuto(`bau mir einen ${wunsch}`) || findeAuto(`bau mir einen ${wunsch}`).art !== "modell") {
      wunsch = VORLAGEN[db.genre]?.auto || VORLAGEN.action.auto;
    }
    const warum = db.auto?.warum || VORLAGEN[db.genre]?.autoWarum || "";
    const r = startBuild(`bau mir einen ${wunsch}`);
    if (!r.ok) return { status: "fehler", text: `Die Werkstatt wollte nicht: ${r.error || "unbekannt"}` };
    // Kurz warten, falls ein echtes 3D-Modell nachgeladen wird.
    for (let i = 0; i < 20 && r.plan?.studio?.wartet; i++) await pause(1000);
    const titel = r.plan?.titel || wunsch;
    const kennzahlen = (r.plan?.kennzahlen || []).slice(0, 5);
    const echt = Boolean(r.plan?.studio?.datei);
    return {
      status: "fertig",
      text: `${titel} steht im Auto-Studio${kennzahlen.length ? ` · ${kennzahlen.slice(1, 3).map((k) => `${k.label} ${k.wert}`).join(" · ")}` : ""}`,
      grenze: echt ? "" : "Ehrlich: Fridays eigene Auto-Modelle sind gerechnet und sehen etwas stilisiert aus. Fotorealistisch wird es mit einem echten 3D-Modell (Knopf „Echtes 3D-Modell holen“, braucht einen kostenlosen Sketchfab-Schlüssel).",
      ergebnis: { werkstattJob: r.id, wunsch, titel, warum, kennzahlen, farbe: wunsch.match(/\bin (\w+)$/)?.[1] || "" },
    };
  },

  // ---------- Premieren-Webseite ----------
  async webseite(g, ctx, melde) {
    const db = await sicherDrehbuch(g, ctx, melde);
    const gNeu = holen(g.id);
    const film = gNeu.schritte.find((s) => s.id === "film" && s.status === "fertig")?.ergebnis || null;
    const auto = gNeu.schritte.find((s) => s.id === "auto" && s.status === "fertig")?.ergebnis || null;
    melde(film ? "Hole Standbilder aus dem Film …" : "Baue die Premieren-Seite …", 15);
    const bilder = film?.pfad ? await standbilder(film.pfad, film.sekunden || 30) : [];
    melde("Baue die Premieren-Seite …", 45);
    const html = premierenSeite({ db, film, auto, bilder, premiere: g.premiere, name: boss() });
    melde("Feinschliff und freie Fotos …", 70);
    const r = await speichereEigeneSeite({ titel: `${db.titel} – Premiere`, html, auftrag: `Premieren-Webseite für den Kurzfilm „${db.titel}“`, dateien: film?.pfad ? [{ von: film.pfad, name: "film.mp4" }] : [], art: "premiere" });
    if (!r.ok) return { status: "fehler", text: `Die Seite ließ sich nicht speichern: ${r.error}` };
    return {
      status: "fertig",
      text: `Premieren-Seite „${db.titel}“ gebaut${bilder.length ? ` · ${bilder.length} Standbilder aus dem Film` : ""}${auto ? ` · mit dem Filmauto` : ""} · eigene Seite, ohne Preis`,
      grenze: `Die Seite liegt bei dir am Mac (Ordner Friday-Webseiten) und ist noch nicht im Internet. ${film ? "Den Film spielt sie ab, wenn du sie aus dem Ordner öffnest; in der Vorschau im Dashboard siehst du nur das Standbild." : ""}${g.premiere ? "" : " Datum und Ort der Premiere stehen als [Platzhalter] drin."}`.trim(),
      ergebnis: { webseite: r.id, titel: r.titel, qualitaet: r.qualitaet?.punkte ?? null },
    };
  },
};

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Drei Standbilder aus dem Film als data:-URLs (für Hero und Galerie der Premieren-Seite). */
async function standbilder(datei, dauer) {
  const ff = findeFfmpeg();
  if (!ff || !fs.existsSync(datei)) return [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "friday-ga-"));
  const out = [];
  const punkte = [0.12, 0.42, 0.7].map((x) => Math.max(0.5, dauer * x));
  for (let i = 0; i < punkte.length; i++) {
    const ziel = path.join(tmp, `bild-${i}.jpg`);
    await new Promise((res) => execFile(ff, ["-hide_banner", "-loglevel", "error", "-y", "-ss", punkte[i].toFixed(2), "-i", datei, "-frames:v", "1", "-vf", `scale=${i === 0 ? 1280 : 720}:-2`, "-q:v", "5", ziel], { timeout: 30000 }, () => res()));
    try { out.push(`data:image/jpeg;base64,${fs.readFileSync(ziel).toString("base64")}`); } catch { /* ohne dieses Bild */ }
  }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* egal */ }
  return out;
}

/** Die Premieren-Seite: dunkel, Kino-Look, Farbe aus dem Film. Ohne Claude, ohne Preis. */
export function premierenSeite({ db, film, auto, bilder = [], premiere = "", name = "Chef" }) {
  const f = db.farbe || "#ff8a1e";
  const hero = bilder[0] ? `<img class="hero-bild" src="${bilder[0]}" alt="Standbild aus ${esc(db.titel)}">` : `<img class="hero-bild" data-bild="${esc(db.szenen[0]?.bild || "cinema premiere night")}" alt="Szene aus ${esc(db.titel)}">`;
  const galerie = (bilder.length > 1 ? bilder.slice(1) : []).map((b, i) => `<figure><img src="${b}" alt="Standbild ${i + 2} aus dem Film"></figure>`).join("")
    + db.szenen.slice(bilder.length > 1 ? 3 : 1, bilder.length > 1 ? 5 : 4).map((s) => `<figure><img data-bild="${esc(s.bild || "film scene")}" alt="${esc(s.zeile || s.ort)}"><figcaption>${esc(s.zeile || "")}</figcaption></figure>`).join("");
  const datum = premiere ? esc(premiere) : "[Datum der Premiere]";
  const trailer = film
    ? `<video controls playsinline preload="none" ${bilder[0] ? `poster="${bilder[0]}"` : ""} src="film.mp4"></video><p class="klein">Läuft, wenn du die Seite aus dem Ordner „Friday-Webseiten“ öffnest (der Film liegt daneben als film.mp4).</p>`
    : `<div class="platz">Der Trailer kommt bald.</div>`;
  const autoTeil = auto ? `<section id="auto" aria-label="Das Filmauto" class="rein"><div class="wrap zwei">
      <div><p class="kicker">Das Filmauto</p><h2>${esc(auto.titel)}</h2><p>${esc(auto.warum || "Das Auto, das im Film die Hauptrolle neben den Figuren spielt.")}</p>
      <ul class="daten">${(auto.kennzahlen || []).map((k) => `<li><b>${esc(k.wert)}</b><span>${esc(k.label)}</span></li>`).join("")}</ul></div>
      <figure class="auto-bild"><img data-bild="${esc(`${auto.wunsch.replace(/\bin \w+$/, "")} car studio`)}" alt="${esc(auto.titel)}"></figure></div></section>` : "";
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(db.titel)} – Premiere</title><meta name="description" content="${esc(db.logline)}">
<meta property="og:title" content="${esc(db.titel)} – Premiere">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='28' fill='${f}'/><polygon points='26,20 46,32 26,44' fill='#0b0b10'/></svg>`)}">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--f:${f};--bg:#07070b;--karte:rgba(255,255,255,.05);--text:#f2f2f5;--leise:#a9a9b8}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:17px/1.6 Inter,system-ui,sans-serif;overflow-x:hidden}
img,video{max-width:100%;display:block}.wrap{max-width:1180px;margin:0 auto;padding:0 22px}
nav{position:fixed;inset:0 0 auto;z-index:9;backdrop-filter:blur(12px);background:rgba(7,7,11,.55);border-bottom:1px solid rgba(255,255,255,.06)}
nav .wrap{display:flex;justify-content:space-between;align-items:center;height:60px}nav b{font:28px "Bebas Neue",sans-serif;letter-spacing:2px;color:var(--f)}
nav a{color:var(--text);text-decoration:none;margin-left:18px;font-size:15px;opacity:.8}nav a:hover{opacity:1}
.hero{min-height:100vh;position:relative;display:grid;align-items:end;padding:120px 0 70px;overflow:hidden}
.hero-bild{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.5;filter:saturate(1.1) contrast(1.05) blur(1px);transform:scale(1.06);animation:zoom 18s ease-out forwards}
.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,7,11,.2),rgba(7,7,11,.6) 55%,var(--bg)),radial-gradient(80% 60% at 20% 80%,color-mix(in srgb,var(--f) 35%,transparent),transparent)}
.hero .wrap{position:relative;z-index:1}.kicker{color:var(--f);text-transform:uppercase;letter-spacing:4px;font-size:13px;font-weight:600;margin:0 0 8px}
h1{font:clamp(64px,13vw,170px)/.88 "Bebas Neue",sans-serif;margin:0;letter-spacing:2px;text-shadow:0 0 40px color-mix(in srgb,var(--f) 50%,transparent)}
h2{font:clamp(40px,6vw,72px)/.95 "Bebas Neue",sans-serif;margin:0 0 16px;letter-spacing:1px}
.slogan{font-size:clamp(18px,2.4vw,26px);color:var(--leise);max-width:680px}
.knoepfe{display:flex;gap:14px;flex-wrap:wrap;margin-top:26px}.knopf{padding:14px 26px;border-radius:999px;background:var(--f);color:#0b0b10;font-weight:600;text-decoration:none;box-shadow:0 10px 40px color-mix(in srgb,var(--f) 45%,transparent);transition:transform .2s}
.knopf.neben{background:transparent;color:var(--text);border:1px solid rgba(255,255,255,.25);box-shadow:none}.knopf:hover{transform:translateY(-2px)}
.premiere{display:inline-flex;gap:10px;align-items:center;margin-top:20px;padding:8px 16px;border:1px solid color-mix(in srgb,var(--f) 60%,transparent);border-radius:999px;font-size:15px}
section{padding:110px 0}.zwei{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}
.karten{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}.karte{background:var(--karte);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:22px;transition:transform .25s,border-color .25s}
.karte:hover{transform:translateY(-4px);border-color:var(--f)}.karte b{display:block;font:26px "Bebas Neue",sans-serif;letter-spacing:1px;color:var(--f)}
video{width:100%;border-radius:18px;border:1px solid rgba(255,255,255,.1);aspect-ratio:16/9;background:#000;object-fit:cover}.klein{font-size:13px;color:var(--leise)}
.platz{aspect-ratio:16/9;border-radius:18px;display:grid;place-items:center;background:var(--karte);color:var(--leise)}
.szenen{counter-reset:s;display:grid;gap:14px}.szenen li{list-style:none;background:var(--karte);border-radius:14px;padding:16px 18px 16px 64px;position:relative}
.szenen li:before{counter-increment:s;content:counter(s,decimal-leading-zero);position:absolute;left:18px;top:14px;font:30px "Bebas Neue",sans-serif;color:var(--f)}
.galerie{display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px}.galerie figure{margin:0;position:relative;border-radius:16px;overflow:hidden;aspect-ratio:4/3}
.galerie figure:first-child{grid-row:span 2;aspect-ratio:auto}.galerie img{width:100%;height:100%;object-fit:cover;transition:transform .6s}.galerie figure:hover img{transform:scale(1.05)}
figcaption{position:absolute;left:12px;bottom:10px;font-size:14px;text-shadow:0 1px 6px #000}
.daten{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:0;margin:20px 0 0}.daten li{list-style:none;background:var(--karte);border-radius:12px;padding:12px 14px}.daten b{display:block;color:var(--f)}.daten span{font-size:13px;color:var(--leise)}
.auto-bild{margin:0;border-radius:20px;overflow:hidden;aspect-ratio:4/3}.auto-bild img{width:100%;height:100%;object-fit:cover}
form{display:grid;gap:12px;max-width:520px}label{font-size:14px;color:var(--leise)}input,select{width:100%;padding:13px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.04);color:var(--text);font:inherit}
input:focus,select:focus,a:focus-visible,button:focus-visible{outline:2px solid var(--f);outline-offset:2px}button{cursor:pointer;border:0;font:inherit}
footer{padding:40px 0;border-top:1px solid rgba(255,255,255,.08);color:var(--leise);font-size:14px}
.rein{opacity:0;transform:translateY(30px);transition:opacity .9s,transform .9s}.rein.da{opacity:1;transform:none}
@keyframes zoom{to{transform:scale(1)}}
@media(max-width:860px){.zwei{grid-template-columns:1fr}.galerie{grid-template-columns:1fr 1fr}.galerie figure:first-child{grid-column:span 2;aspect-ratio:16/9}nav a{display:none}section{padding:80px 0}}
@media(max-width:560px){.daten{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.rein{opacity:1;transform:none}}
</style></head><body>
<nav aria-label="Navigation"><div class="wrap"><b>${esc(db.titel)}</b><div><a href="#trailer">Trailer</a><a href="#geschichte">Geschichte</a>${auto ? '<a href="#auto">Filmauto</a>' : ""}<a href="#einladung">Premiere</a></div></div></nav>
<header class="hero" aria-label="Filmtitel">${hero}<div class="wrap">
  <p class="kicker">Ein Kurzfilm von ${esc(name)} · ${esc(GENRE_NAMEN[db.genre] || "Kurzfilm")}</p>
  <h1>${esc(db.titel)}</h1><p class="slogan">${esc(db.slogan)}</p>
  <div class="premiere">🎬 Premiere: <b>${datum}</b> · [Ort]</div>
  <div class="knoepfe"><a class="knopf" href="#einladung">Zur Premiere anmelden</a><a class="knopf neben" href="#trailer">Trailer ansehen</a></div>
</div></header>
<main>
<section id="trailer" aria-label="Trailer" class="rein"><div class="wrap"><p class="kicker">Trailer</p><h2>Erster Blick</h2>${trailer}</div></section>
<section id="geschichte" aria-label="Die Geschichte" class="rein"><div class="wrap zwei">
  <div><p class="kicker">Die Geschichte</p><h2>Worum es geht</h2><p>${esc(db.logline)}</p></div>
  <ol class="szenen">${db.szenen.slice(0, 4).map((s) => `<li><b>${esc(s.zeile || s.ort)}</b><br><span class="klein">${esc(s.handlung)}</span></li>`).join("")}</ol>
</div></section>
<section id="figuren" aria-label="Figuren" class="rein"><div class="wrap"><p class="kicker">Die Figuren</p><h2>Wer dabei ist</h2>
  <div class="karten">${db.figuren.map((x) => `<div class="karte"><b>${esc(x.name)}</b><span>${esc(x.beschreibung)}</span></div>`).join("")}</div></div></section>
<section id="bilder" aria-label="Bilder aus dem Film" class="rein"><div class="wrap"><p class="kicker">Szenenbilder</p><h2>Aus dem Film</h2><div class="galerie">${galerie}</div></div></section>
${autoTeil}
<section id="einladung" aria-label="Einladung zur Premiere" class="rein"><div class="wrap zwei">
  <div><p class="kicker">Premiere</p><h2>Sei dabei</h2><p>Am <b>${datum}</b> zeigen wir „${esc(db.titel)}“ zum ersten Mal. Ort: [Ort der Premiere]. Einlass: [Uhrzeit].</p></div>
  <form id="anmeldung" aria-label="Anmeldung"><label for="n">Dein Name</label><input id="n" name="name" required autocomplete="name">
    <label for="p">Wie viele Personen?</label><select id="p" name="personen"><option>1</option><option>2</option><option>3</option><option>4</option></select>
    <button class="knopf" type="submit">Platz reservieren</button><p class="klein" id="danke" hidden>Danke! Wir freuen uns auf dich.</p></form>
</div></section>
</main>
<footer><div class="wrap">© ${new Date().getFullYear()} ${esc(name)} · „${esc(db.titel)}“ · gemacht mit F.R.Ai.D.A.Y · [Impressum] · [Datenschutz]</div></footer>
<script>
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("da");io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll(".rein").forEach(el=>io.observe(el));
document.getElementById("anmeldung").addEventListener("submit",e=>{e.preventDefault();const n=document.getElementById("n").value,p=document.getElementById("p").value;
location.href="mailto:[deine@mail.de]?subject="+encodeURIComponent("Premiere ${esc(db.titel).replace(/"/g, "")}")+"&body="+encodeURIComponent(n+" kommt mit "+p+" Person(en).");document.getElementById("danke").hidden=false});
</script></body></html>`;
}

// ---------------------------------------------------------------------------------------------
// 4) Bilanz
// ---------------------------------------------------------------------------------------------
export const KI_VIDEO_VORSCHLAG = {
  titel: "Echte KI-Filmszenen (nur ein Vorschlag)",
  text: "Mit Kamera gedrehte oder KI-erzeugte bewegte Szenen kann Friday ohne Bezahldienst nicht machen. Günstigste gute Option: Google Veo 3.1 Lite über die Gemini-API – Bezahlung pro Sekunde, kein Abo, mit Ton. Stand Herbst 2026 etwa 0,05 $ pro Sekunde (720p), ein 1-Minuten-Film also rund 3 $. Noch günstiger, aber ohne Ton: Hailuo 2.3. Wenn du das willst, sag Bescheid, dann baue ich es als Zusatz ein (du bräuchtest einen eigenen Google-API-Schlüssel). Preise bitte vorher selbst prüfen, sie ändern sich oft.",
};

function abschliessen(id) {
  const g = aendern(id, (x) => {
    const ok = x.schritte.filter((s) => s.status === "fertig").length;
    x.status = ok === x.schritte.length ? "fertig" : ok ? "teilweise" : "fehler";
    x.fertig = jetzt();
    x.bilanz = bilanz(x);
  });
  if (!g) return;
  if (g.taskId && g.status === "fertig") {
    try { const t = store.getTasks().find((y) => y.id === g.taskId); if (t && !t.done) store.toggleTask(g.taskId); } catch { /* egal */ }
  }
  eintragen({ bereich: "aufgabe", titel: `${g.status === "fertig" ? "✅" : "⚠️"} Großauftrag ${g.status === "fertig" ? "fertig" : "teilweise erledigt"}: ${g.schritte.map((s) => `${s.name} ${s.status === "fertig" ? "✓" : "✗"}`).join(", ")}`, details: g.bilanz.satz, ok: g.status !== "fehler", kanal: "grossauftrag" });
  notifyAll(g.status === "fertig" ? "🎬 Großauftrag fertig" : "Großauftrag teilweise fertig", g.bilanz.satz, { art: "aufgabe" }).catch(() => {});
}

export function bilanz(g) {
  const fertig = g.schritte.filter((s) => s.status === "fertig");
  const nicht = g.schritte.filter((s) => s.status !== "fertig");
  const titel = g.schritte.find((s) => s.id === "drehbuch")?.ergebnis?.titel || g.schritte.find((s) => s.ergebnis?.titel)?.ergebnis?.titel || "";
  const satz = nicht.length
    ? `${fertig.length} von ${g.schritte.length} Teilen sind fertig${fertig.length ? ` (${fertig.map((s) => s.name).join(", ")})` : ""}. Nicht geklappt: ${nicht.map((s) => `${s.name} – ${s.text}`).join("; ")}.`
    : `Alles fertig, ${boss()}: ${g.schritte.map((s) => s.name).join(", ")}${titel ? ` für „${titel}“` : ""}.`;
  const grenzen = g.schritte.map((s) => s.grenze).filter(Boolean);
  if (g.unbekannt?.length) grenzen.push(`Diese Teile konnte ich keiner Werkstatt zuordnen und habe sie nicht gemacht: ${g.unbekannt.map((u) => `„${u}“`).join(", ")}. Sag sie mir am besten einzeln.`);
  return { satz, grenzen, vorschlag: g.schritte.some((s) => s.id === "film") ? KI_VIDEO_VORSCHLAG : null };
}

// ---------------------------------------------------------------------------------------------
// 5) Von außen: Liste, Sprache, Organizer, Start nach Neustart
// ---------------------------------------------------------------------------------------------
export function liste() {
  return alle().slice().reverse().map((g) => ({ ...g, schritte: g.schritte.map(({ ergebnis, ...s }) => ({ ...s, ergebnis: ergebnis ? { ...ergebnis, daten: undefined } : null })), aktiv: laeuft === g.id, prozent: prozent(g) }));
}
export function einzeln(id) {
  return liste().find((g) => g.id === id) || null;
}
export function prozent(g) {
  if (g.status === "fertig" || g.status === "teilweise" || g.status === "fehler") return 100;
  const n = g.schritte.length || 1;
  return Math.round(g.schritte.reduce((a, s) => a + (s.status === "fertig" || s.status === "fehler" ? 100 : s.status === "laeuft" ? Math.min(95, s.pct || 5) : 0), 0) / n);
}
/** Für den Organizer: kurzer Stand je Aufgabe. */
export function standFuerTask(taskId) {
  const g = alle().filter((x) => x.taskId === taskId).at(-1);
  if (!g) return null;
  return { id: g.id, status: g.status, fertig: g.schritte.filter((s) => s.status === "fertig").length, gesamt: g.schritte.length, prozent: prozent(g) };
}

/** Fehlgeschlagene Teile noch einmal versuchen (z. B. nachdem ffmpeg installiert ist). */
export function nachholen(id) {
  const g = aendern(id, (x) => {
    for (const s of x.schritte) if (s.status === "fehler") { s.status = "offen"; s.text = ""; s.grenze = ""; }
    x.status = "wartet"; delete x.bilanz; delete x.fertig;
  });
  if (!g) return { ok: false, error: "Großauftrag nicht gefunden." };
  setTimeout(() => weiter().catch(() => {}), 50);
  return { ok: true };
}

/** Das Filmauto wieder in die Werkstatt holen (Werkstatt-Bauten leben nur bis zum Neustart). */
export function autoZeigen(id) {
  const g = holen(id);
  const e = g?.schritte.find((s) => s.id === "auto")?.ergebnis;
  if (!e) return { ok: false, error: "Zu diesem Auftrag gibt es kein Auto." };
  const job = getBuildJob(e.werkstattJob);
  if (job) return { ok: true, job };
  const r = startBuild(`bau mir einen ${e.wunsch}`);
  return r.ok ? { ok: true, job: r } : { ok: false, error: r.error };
}

/** Sprachbefehl / Chat: "Mach mir ein Drehbuch … dreh den Film … bau eine Webseite … und ein Auto". */
export function quickCommand(text, channel = "web") {
  const e = erkenne(text);
  if (!e) return null;
  const r = starte(text, { quelle: channel });
  if (!r.ok) return null;
  const teile = r.auftrag.schritte.map((s) => s.name);
  const liste = teile.length > 1 ? `${teile.slice(0, -1).join(", ")} und ${teile.at(-1)}` : teile[0];
  return {
    answer: `Verstanden, ${boss()}. Ich erledige das der Reihe nach: ${liste}. Den Fortschritt siehst du im Fenster Großauftrag, am Ende bekommst du eine ehrliche Bilanz.${r.auftrag.status === "wartet" ? " Ich arbeite gerade noch an einem anderen Großauftrag, danach geht es los." : ""}`,
    actions: [`grossauftrag:${r.auftrag.id}`],
  };
}

export function grossauftragStart() {
  // Nach einem Neustart: angefangene Schritte von vorn, dann weitermachen.
  const l = alle();
  let g = false;
  for (const x of l) {
    if (x.status !== "laeuft" && x.status !== "wartet") continue;
    for (const s of x.schritte) if (s.status === "laeuft") { s.status = "offen"; s.text = "Nach Neustart neu begonnen"; g = true; }
  }
  if (g) speichern(l);
  setTimeout(() => weiter().catch(() => {}), 8000);
}

export function grossauftragRouten(app) {
  app.get("/api/grossauftraege", (req, res) => res.json({ auftraege: liste(), teile: TEILE }));
  app.get("/api/grossauftrag/erkennen", (req, res) => res.json({ erkannt: erkenne(String(req.query.text || "")) }));
  app.get("/api/grossauftrag/:id", (req, res) => { const g = einzeln(req.params.id); if (!g) return res.status(404).json({ error: "Nicht gefunden" }); res.json(g); });
  app.post("/api/grossauftrag", (req, res) => { const r = starte(String(req.body?.text || ""), { quelle: "dashboard" }); res.status(r.ok ? 200 : 400).json(r); });
  app.post("/api/grossauftrag/:id/nachholen", (req, res) => { const r = nachholen(req.params.id); res.status(r.ok ? 200 : 404).json(r); });
  app.post("/api/grossauftrag/:id/auto", (req, res) => { const r = autoZeigen(req.params.id); res.status(r.ok ? 200 : 404).json(r); });
}
