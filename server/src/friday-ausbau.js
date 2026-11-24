// Friday ausbauen (v1.130.0): Die Ideen-Schmiede macht jetzt auch Vorschläge für Friday selbst.
// 1) Bauplan-Katalog: Dienste, die man EINBINDEN kann (meist kostenlos), und Funktionen, die man BAUEN kann.
//    Jeder Vorschlag mit Nutzen, Aufwand, Kosten, was man braucht und einem Beispiel-Sprachbefehl.
//    Ist etwas schon eingebaut (Modul-Datei vorhanden), wird es als „schon da“ markiert statt vorgeschlagen.
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

const HIER = path.dirname(fileURLToPath(import.meta.url));
const DASH = path.join(HIER, "..", "..", "dashboard");

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
  V("pollen", "wetter", "Pollenflug-Vorhersage", "Täglicher Pollenflug (Birke, Gräser …) vom DWD im Morgen-Briefing.", "Für Allergiker: Tabletten rechtzeitig nehmen.", 1, "kostenlos", "nichts", "Friday, wie ist der Pollenflug?", "pollen.js", /\b(pollen|allergie|heuschnupfen)/i),
  V("strompreis", "wetter", "Günstige Strom-Stunden", "Börsenstrompreis (z. B. aWATTar/Tibber) – Friday sagt, wann Waschen und Laden am billigsten ist.", "Spart bei dynamischem Tarif echtes Geld.", 1, "kostenlos (Tibber-Schlüssel optional)", "dynamischer Stromtarif lohnt sich am meisten", "Friday, wann ist Strom heute am günstigsten?", "strompreis.js", /\b(strom|strompreis|energie ?kosten|waschmaschine)/i),
  V("sprit", "alltag", "Spritpreise in der Nähe", "Tankerkönig zeigt die günstigste Tankstelle im Umkreis, live.", "Ein paar Euro pro Tankfüllung sparen.", 1, "kostenlos", "kostenloser Tankerkönig-Schlüssel", "Friday, wo ist Diesel gerade am billigsten?", "sprit.js", /\b(tank|tanken|sprit|benzin|diesel|tankstelle)/i),
  V("pakete", "alltag", "Paket-Verfolgung", "Sendungsnummer sagen, Friday meldet „Paket kommt heute“.", "Kein Tracking-Link-Suchen mehr.", 2, "kostenlos", "DHL-Entwickler-Schlüssel (kostenlos)", "Friday, wo ist mein Paket?", "pakete.js", /\b(paket|sendung|dhl|lieferung|hermes)/i),
  V("muell", "alltag", "Müllabfuhr-Kalender", "Abfuhrtermine deiner Stadt (ICS-Datei) einlesen, Erinnerung am Vorabend.", "Nie wieder die Tonne vergessen.", 1, "kostenlos", "Kalender-Link deiner Stadt/Abfallwirtschaft", "Friday, welche Tonne kommt morgen?", "muell.js", /\b(müll|muell|tonne|abfall|gelber sack)/i),
  V("rss", "medien", "Eigene Nachrichtenquellen", "Lieblings-Seiten als RSS-Feed eintragen (Tagesschau, Heise, Kicker …) – Friday liest Schlagzeilen vor.", "Briefing genau mit deinen Themen.", 1, "kostenlos", "nichts", "Friday, was gibt's Neues bei Heise?", "feeds.js", /\b(nachrichten|news|schlagzeilen|heise|kicker|tagesschau)/i),
  V("fussball", "medien", "Fußball-Ergebnisse", "Bundesliga-Spielplan und Live-Ergebnisse (OpenLigaDB) für deinen Verein.", "Tor-Ansage, ohne in die App zu schauen.", 1, "kostenlos", "nichts", "Friday, wie hat Dortmund gespielt?", "fussball.js", /\b(fußball|fussball|bundesliga|tor|spiel ergebnis|bayern|dortmund|verein)/i),
  V("jellyfin", "medien", "Eigene Mediathek (Jellyfin/Plex)", "Filme und Serien vom eigenen Server per Sprache auf dem Fernseher starten.", "Wie Netflix, nur mit deinen Filmen.", 2, "kostenlos", "Jellyfin oder Plex auf dem Mac", "Friday, spiel Iron Man auf dem Fernseher.", "mediathek.js", /\b(film|serie|plex|jellyfin|mediathek)/i),
  V("ollama", "ki", "Ollama-Gehirn (Mac oder Cloud)", "Ollama als zweites Gehirn: auf dem Mac kostenlos und ohne Internet, oder in der Ollama Cloud mit großen Modellen. Modus Notfall, Sparen oder Immer.", "Friday denkt weiter, auch wenn das Guthaben leer ist, und spart Claude-Guthaben.", 2, "Mac: kostenlos · Cloud: Gratis-Stufe oder Abo", "Ollama-App auf dem Mac (ca. 3 GB) oder Schlüssel von ollama.com", "Friday, denk sparsam.", "ollama.js", /\b(guthaben|offline|lokal)/i),
  V("shelly", "ki", "Strom-Messsteckdosen (Shelly)", "Shelly-Steckdosen lokal abfragen: Verbrauch live, Geräte schalten.", "Stromfresser finden, Geräte per Sprache aus.", 2, "ab ca. 15 € je Steckdose", "Shelly Plug im WLAN", "Friday, wie viel Strom zieht der PC?", "shelly.js", /\b(steckdose|verbrauch|watt|stromfresser)/i),
  V("fritzbox", "ki", "Fritz!Box-Status", "Internet-Geschwindigkeit, Störungen und Gäste-WLAN-QR-Code per Sprache.", "Bei Internet-Problemen sofort wissen, woran es liegt.", 2, "kostenlos", "Fritz!Box mit Benutzer + Passwort", "Friday, ist das Internet langsam?", "fritzbox.js", /\b(internet|wlan|wifi|router|fritz)/i),
  // ---- Bauen ----
  V("tagebuch", "persoenlich", "Sprach-Tagebuch", "Abends kurz erzählen, wie der Tag war – Friday schreibt mit, sortiert nach Datum, mit Stimmungs-Kurve.", "Erinnerungen festhalten, ohne zu schreiben.", 1, "kostenlos", "nichts", "Friday, Tagebuch: Heute war …", "tagebuch.js", /\b(tagebuch|mein tag|stimmung|gefühl|gefuehl)/i),
  V("gewohnheiten", "persoenlich", "Gewohnheiten mit Serien", "Wasser trinken, Sport, Lesen: abhaken per Sprache, Friday zählt die Tage am Stück (Serie) und feiert Rekorde.", "Dranbleiben fällt leichter, wenn man die Serie sieht.", 1, "kostenlos", "nichts", "Friday, Sport erledigt.", "serien.js", /\b(sport|training|joggen|gewohnheit|wasser trinken|lesen)/i),
  V("geburtstage", "persoenlich", "Geburtstage + Geschenk-Ideen", "Geburtstage merken, 7 Tage vorher erinnern und passende Geschenk-Ideen vorschlagen.", "Kein vergessener Geburtstag mehr.", 1, "kostenlos (Ideen mit KI optional)", "nichts", "Friday, wann hat Mama Geburtstag?", "geburtstage.js", /\b(geburtstag|geschenk|jahrestag)/i),
  V("medikamente", "persoenlich", "Medikamenten-Wecker", "Einnahmezeiten mit Bestätigung („genommen“), Vorrat zählt mit und erinnert ans Nachkaufen.", "Sicher, dass nichts vergessen wird.", 1, "kostenlos", "nichts", "Friday, Tablette genommen.", "medikamente.js", /\b(tablette|medikament|pille|vitamin)/i),
  V("finanzen", "organisation", "Haushaltsbuch", "Ausgaben per Sprache oder aus den Kassenbons im Kühlschrank-Modul, Monatsübersicht als Diagramm.", "Sehen, wohin das Geld geht.", 2, "kostenlos", "nichts", "Friday, 12 Euro für Pizza ausgegeben.", "haushaltsbuch.js", /\b(geld|ausgaben|euro|kosten|budget|sparen)/i),
  V("reise", "organisation", "Reise-Planer", "Ziel + Datum sagen: Packliste, Wetter am Ziel, Reisewarnung aus dem Lagezentrum, Countdown.", "Alles für die Reise an einem Ort.", 2, "kostenlos", "nichts", "Friday, ich fliege am 3. März nach Mallorca.", "reise.js", /\b(urlaub|reise|flug|koffer|packliste)/i),
  V("essensplan", "organisation", "Wochen-Essensplan", "7 Gerichte aus Vorrat und Lieblingsrezepten, fehlende Zutaten direkt auf die Einkaufsliste.", "Nie mehr „Was essen wir heute?“.", 2, "kostenlos", "nichts", "Friday, plan das Essen für diese Woche.", "essensplan.js", /\b(essen|kochen|rezept|abendessen|mittag)/i),
  V("pomodoro", "organisation", "Fokus-Timer mit Statistik", "25 Minuten Fokus, 5 Pause, Fokus-Sound automatisch an, Wochen-Statistik in der Datenbank.", "Konzentrierter lernen und arbeiten.", 1, "kostenlos", "nichts", "Friday, starte eine Fokus-Runde.", "fokus.js", /\b(fokus|konzentr\w*|pomodoro)/i),
  V("widget", "friday", "iPhone-Widget", "Friday-Kacheln auf dem Home-Bildschirm (Wetter, nächster Termin, Einkauf) über die App Scriptable.", "Wichtiges sehen, ohne Friday zu öffnen.", 2, "kostenlos", "App Scriptable auf dem iPhone", "–", "widget.js", /\b(widget|homescreen|home-bildschirm)/i),
  V("tagesrueckblick", "friday", "Abend-Rückblick", "Um 21 Uhr fasst Friday den Tag zusammen: erledigt, offen, morgen wichtig – aus der eigenen Datenbank.", "Tag sauber abschließen, morgen vorbereitet.", 1, "kostenlos", "nichts", "Friday, wie war mein Tag?", "rueckblick.js", /\b(wie war (mein|der) tag|rückblick|rueckblick|was habe ich heute)/i),
  V("familie", "friday", "Familien-Pinnwand", "Mehrere Profile (Kevin, Carla …): eigene Listen, eigene Erinnerungen, gemeinsame Pinnwand.", "Friday für die ganze Familie.", 3, "kostenlos", "nichts", "Friday, schreib an die Pinnwand: …", "familie.js", /\b(familie|pinnwand)/i),
  V("routinen", "friday", "Eigene Routinen bauen", "„Guten Morgen“ = Licht an, Wetter, Termine, Fokus-Sound – Bausteine selbst zusammenklicken.", "Ein Satz, viele Aktionen.", 2, "kostenlos", "nichts", "Friday, guten Morgen.", "routinen.js", /\b(guten morgen|gute nacht|routine)/i),
  V("lernen-ki", "friday", "Friday lernt dich kennen", "Aus der Datenbank wöchentlich Vorlieben ableiten (Lieblingsthemen, Uhrzeiten) und Vorschläge anpassen.", "Friday wird mit der Zeit persönlicher.", 3, "kostenlos (Auswertung mit KI optional)", "nichts", "Friday, was weißt du über meine Gewohnheiten?", "vorlieben.js", /\b(lieblings\w*|gewohnheit\w*)/i),
];

function vorhanden(v) {
  return v.module.some((m) => fs.existsSync(path.join(HIER, m)) || fs.existsSync(path.join(DASH, m)));
}

// Antworten, bei denen Friday passen musste → Lücken
const LUECKE = /\b(kann ich (leider )?(noch )?nicht|kann ich dir (leider )?(noch )?nicht|weiß ich (leider )?nicht|weiss ich (leider )?nicht|habe ich keinen zugriff|hab ich keinen zugriff|keinen zugriff|nicht verstanden|dafür habe ich kein|dafuer habe ich kein|das geht (noch )?nicht|nicht möglich|nicht moeglich|keine verbindung zu|guthaben ist leer)\b/i;

export function ausbau({ tage = 60 } = {}) {
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
    zahlen: { gesamt: KATALOG.length, offen: vorschlaege.filter((v) => !v.schonDa).length, schonDa: vorschlaege.filter((v) => v.schonDa).length, gespraeche: gespraeche.length, wunschliste: wunsch, tage },
  };
}

export const zufall = () => {
  const offen = KATALOG.filter((v) => !vorhanden(v));
  const v = offen[Math.floor(Math.random() * offen.length)] || KATALOG[0];
  return v;
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
    text: `Vorhandene Module: ${module.join(", ")}\nSchon im Katalog: ${KATALOG.map((v) => v.titel).join(", ")}\nLetzte Fragen an Friday:\n${fragen.join("\n")}`,
  });
  if (!r.ok) throw new Error(r.error || "Claude ist gerade nicht erreichbar.");
  try {
    const j = JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1));
    return (j.vorschlaege || []).slice(0, 6).map((v, i) => ({ id: `ki-${Date.now().toString(36)}-${i}`, gruppe: v.art === "einbinden" ? "ki" : "friday", art: v.art === "einbinden" ? "einbinden" : "bauen", titel: String(v.titel || "Vorschlag").slice(0, 80), pitch: String(v.pitch || "").slice(0, 400), nutzen: String(v.nutzen || "").slice(0, 300), aufwand: [1, 2, 3].includes(Number(v.aufwand)) ? Number(v.aufwand) : 2, kosten: String(v.kosten || "").slice(0, 80), braucht: String(v.braucht || "").slice(0, 160), sprache: String(v.sprache || "").slice(0, 120), ki: true, passt: 0, schonDa: false }));
  } catch { throw new Error("Claude hat keine lesbare Liste geschickt. Bitte nochmal."); }
}
