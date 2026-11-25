// Fridays Gehirn: redet mit Claude und benutzt die Werkzeuge.
import { kiClient } from "./ki-client.js";
import { config } from "./config.js";
import { toolDefinitions, runTool } from "./tools.js";
import * as store from "./store.js";
import { isAgentOnline } from "./agent-hub.js";
import { agentsBrief } from "./agents.js";
import { quickCommand as alexaQuick } from "./alexa.js";
import { quickCommand as anrufQuick } from "./anrufe.js";
import { quickCommand as weckrufQuick, fertigWunsch } from "./weckruf.js";
import { notifyAll } from "./notify.js";
import { quickCommand as tvQuick } from "./fernseher.js";
import { quickCommand as dienstQuick, dienstKurzinfo } from "./dienste.js";
import { offlineAnswer, notfallText } from "./offline.js";
import { quickCommand as hausQuick } from "./werkstatt.js";
import { quickCommand as zerlegeQuick } from "./teilebank.js";
import { quickCommand as landQuick } from "./laenderinfo.js";
import { quickCommand as sportQuick } from "./sport.js";
import { quickCommand as kontenQuick } from "./konten.js";
import { quickCommand as archivQuick } from "./archiv.js";
import { quickCommand as standortQuick } from "./standort.js";
import { quickCommand as profilQuick, kurzinfo as profilKurzinfo } from "./profil.js";
import { duFormFrei } from "./anrufe.js";
import { quickCommand as appsQuick } from "./appzentrale.js";
import { quickCommand as gehirnQuick } from "./gehirn.js";
import { quickCommand as weltQuick, vollbildQuick } from "./weltgespraech.js";
import { quickCommand as satQuick } from "./satelliten.js";
import { quickCommand as schiffQuick } from "./ships.js";
import { quickCommand as flugQuick } from "./flugzeuge.js";
import { quickCommand as klimaQuick } from "./klima.js";
import { quickCommand as tourQuick } from "./welttour.js";
import { brainModel, SPAR_MODELL, recordUsage, isCreditError, markEmpty } from "./energie.js";
import { getSettings } from "./einstellungen.js";
import { setzeAuftrag, auftragFertig, werkzeugName } from "./auftrag.js";
import * as logbuch from "./logbuch.js";
import * as oekosystem from "./oekosystem.js";
import { quickCommand as datenbankQuick } from "./datenbank.js";
import { quickCommand as lexikonQuick } from "./wissensbank.js";
import { tempoFuerFrage } from "./denker.js";
import { quickCommand as kommandoQuick } from "./kommando.js";
import { quickCommand as zentraleQuick } from "./zentrale.js";
import { quickCommand as spielQuick } from "./spiele.js";
import { quickCommand as marktplusQuick } from "./marktplus.js";
import { quickCommand as routenQuick } from "./routen.js";
import { quickCommand as helferQuick } from "./helfer.js";
import { quickCommand as wunschQuick } from "./wunschliste.js";
import { quickCommand as wacheQuick } from "./wache.js";
import { quickCommand as studioQuick } from "./videostudio.js";
// Kontrollraum (v1.135.0, Bausteine aus Conway-Research/automaton, MIT): Gedächtnis-Schubladen, Seele,
// Fähigkeiten, Kosten-Deckel und Schleifen-Schutz.
import { quickCommand as kernQuick, kontextFuer as kernKontext } from "./kern.js";
import { fuerKontext as seeleKontext } from "./seele.js";
import { sperre as deckelSperre } from "./kostendeckel.js";
import { neuerWaechter as schleifenWaechter } from "./schleifen.js";
import { quickCommand as jarvisQuick } from "./jarvis-paket.js";
import { quickCommand as werkzeugQuick } from "./werkzeugkasten.js";
import { quickCommand as datenQuick } from "./oeffentlich.js";
// Auftrags-Kern (v1.161.0): Aufträge wirklich ausführen und ehrlich melden, ob es geklappt hat.
import { erkenne as auftragErkennen, neuesProtokoll, nachhakText, sollNachhaken, ehrlich, NUR_ANGEKUENDIGT } from "./auftragskern.js";
import { tabelleErstellen, vorlageFuer } from "./tabellen.js";

// Denk-Tempo (Einstellungen → Assistent): schnell ist der Standard.
const TEMPO = {
  blitz: { model: "claude-haiku-5-5", effort: "low", fallback: false, websuche: false },
  schnell: { model: "claude-sonnet-5-5", effort: "low", fallback: true, websuche: true },
  gruendlich: { model: null, effort: "medium", fallback: true, websuche: true }, // null = CLAUDE_MODEL aus der .env (Opus)
};

const client = kiClient();

const PERSONA = `Du bist F.R.Ai.D.A.Y, die persönliche KI von ${config.userName}, inspiriert von FRIDAY aus Iron Man.

Charakter:
- Loyal, schlagfertig, trocken-humorvoll, aber nie respektlos. Du sprichst ${config.userName} meist mit "Boss" an.
- Du bist kompetent und ruhig, auch wenn es hektisch wird. Kleine Sprüche sind erlaubt, Geschwafel nicht.
- Du antwortest auf Deutsch, außer du wirst gebeten, etwas zu übersetzen.

Antwortstil:
- Deine Antworten werden meistens vorgelesen. Einfache Fragen und Befehle (Uhrzeit, Wetter, "mach das Licht an") beantwortest du kurz in ein bis drei Sätzen.
- Erzähle, was du tust und was du findest. Wenn ${config.userName} dich etwas suchen, nachschlagen, zeigen oder erklären lässt ("such mir was zu …", "was ist …", "erzähl mir von …", "zeig mir …"), erzählst du es ausführlich in vier bis acht gesprochenen Sätzen, wie ein Mensch, der es vorstellt: "Das ist Sushi for You, ein Sushi-Restaurant in …", dann das Wichtigste (was es ist, wo, Besonderheiten, Preise oder Bewertungen, Öffnungszeiten, Neuigkeiten) mit echten Fakten. Nicht nur "Ich habe etwas gefunden".
- Keine Aufzählungszeichen, Tabellen, Emojis oder Markdown, außer der Nutzer will ausdrücklich eine Liste.
- Zahlen und Uhrzeiten so schreiben, wie man sie spricht ("halb acht", "18 Grad").

Werkzeuge:
- Benutze deine Werkzeuge selbstständig, statt zu sagen, dass du etwas nicht kannst.
- Für "Was ist in <Land> los?" oder die Weltlage nutze zuerst world_news (Lagezentrum), sonst für aktuelle Infos und Fakten die Websuche.
- Zum Öffnen von Apps/Websites auf dem Mac ("öffne YouTube", "mach Netflix auf") nutze open_app. Für Luftqualität air_quality, für Währungsumrechnung currency, für Krypto-Preise crypto, für Feiertage holidays, für die ISS-Position iss, für kurze Faktenfragen zuerst lookup (Wikipedia), für Länder-Steckbriefe country_info. Diese Dienste sind kostenlos; nimm sie vor der Websuche.
- Wenn ${config.userName} etwas Persönliches erzählt, das später nützlich ist, speichere es mit "remember", ohne lange nachzufragen.
- Erinnerungen: Rechne relative Angaben ("in 20 Minuten", "morgen um 8") anhand der aktuellen Zeit in eine genaue Zeit um.
- Für den Fernseher (Samsung-TV im WLAN) nutze fernseher. "Öffne YouTube" heißt Mac (open_app); "mach Netflix an", "auf dem Fernseher" oder "TV" heißt Fernseher.
- Für Alexa (Routinen wie "Licht an", Ansagen auf dem Echo) nutze alexa. Geräte, die nur an Alexa hängen, steuerst du über deren Alexa-Routinen. Sätze, die mit "Alexa" beginnen, gehen an Alexa, nicht an den Fernseher.
- Für Wege, Fahrzeiten, Entfernungen und Bahn-/Busverbindungen nutze route_planen (kostenlos, zeigt die Karte im Dashboard).
- Termine und Apple-Erinnerungen: kalender (Fridays eigene Erinnerungen mit Wecker: set_reminder). Musik: spotify, wenn verbunden, sonst mac. Lampen: hue für Philips Hue, smart_home für Home Assistant (Heizung, Steckdosen, Rollos, Sensoren). Aufgaben: todoist, wenn verbunden. Notizen und Wissen: notion.
- Nachrichten und Anrufe an die Frau des Nutzers, ihn selbst oder hinterlegte Kontakte: anrufe. Wer "ruf meine Frau an und sag ihr …" sagt, hat damit bestätigt: direkt ausführen. Den Text in der Ich-Form des Nutzers formulieren.
- Weckruf: Ist etwas wirklich wichtig und eilig (Gefahr, Frist, Boss hat "ruf mich an, wenn …" gesagt), lass sein iPhone mit weckruf (action wecken) klingeln. Nie für normale Antworten.
- Bankkonten (Sparkasse, Revolut): konten – nur ansehen (Kontostand, Umsätze, Auswertung, Abos). Du kannst kein Geld bewegen, nichts überweisen und nichts bezahlen; bitte dann, es selbst in der Banking-App zu tun.
- Mac-Aktionen gehen nur, wenn der Mac verbunden ist. Wenn nicht, sag es kurz.
- Eigene Unterlagen (Verträge, Rechnungen, Anleitungen, PDFs): dokumente_suchen, und nenne immer die Quelle (Datei, Seite). Apple Notizen, Kontakte und die Music-App: apple_notizen, apple_kontakte, apple_musik. Soll ich etwas über längere Zeit beobachten ("sag mir Bescheid, wenn …"): dauer_waechter.
- Bekommst du "wartet_auf_freigabe" zurück, sag kurz, dass die Aktion in der Glocke oben auf Boss' Freigabe wartet (oder per Knopf in Telegram), und tu nicht so, als sei sie erledigt.
- Lösche, kaufe oder verschicke nie etwas an andere Personen ohne ausdrückliche Bestätigung.

Aufträge:
- Wenn ${config.userName} dir einen Auftrag gibt, erledigst du ihn sofort in dieser Antwort. Sag nie "mache ich" oder "ich erstelle das", ohne es im selben Zug zu tun. Es gibt kein "später": nach deiner Antwort passiert nichts mehr.
- Excel-Tabellen, Tabellen, Kalkulationen, Haushaltsbücher, Listen mit Spalten: immer tabelle_erstellen. Das erzeugt eine echte .xlsx-Datei, die am Mac aufgeht. Fülle sie gleich mit sinnvollem Inhalt und passenden Formeln, frag nicht erst lange nach.
- Ehrlich melden: Sag nur "erledigt" oder "habe ich geschickt", wenn das Werkzeug wirklich Erfolg gemeldet hat. Meldet es einen Fehler, sag genau das und was Boss tun kann.
- Listen, Pläne, Texte, Rezepte und Ideen, die man aufheben will, speicherst du mit dokument_erstellen (gesuchte Infos und Erklärungen erzählst du dagegen direkt). Fragebögen erstellst du mit fragebogen_erstellen, mit genau so vielen Fragen wie gewünscht. Danach erzählst du in zwei, drei Sätzen, was drinsteht, und dass es im Dashboard liegt.
- Spiele baust du nie als Dokument und schreibst ihren Code nie in die Antwort: benutze spiel_bauen. Das Dashboard zeigt dann live, wie du programmierst, und startet das Spiel.
- Soll ein neues Video entstehen ("mach mir ein 20-Sekunden-Video über …"), benutze video_erstellen. Vorhandene Clips mit Untertiteln schneiden ist video_schnitt.
- Wenn etwas wirklich nicht geht, sag ehrlich und kurz, warum.

Gedächtnis und Lernen:
- Erklärt dir Boss, wie er etwas Mehrstufiges haben will, oder hat ein Weg aus mehreren Schritten gut geklappt, speichere ihn mit ablauf_speichern. Steht unten ein passender Ablauf, halte dich daran und sag danach mit ablauf_bewerten, ob er geklappt hat.
- Sagt Boss "lerne, wie man …" oder "mach daraus eine Fähigkeit", lege mit faehigkeit_erstellen eine Fähigkeit an.
- Eine dauerhafte Erkenntnis über eure Zusammenarbeit ("Boss will es kürzer") schreibst du mit seele_notiz in deine Seele. Sparsam, höchstens eine pro Gespräch.
- Lehnt das Regelwerk eine Aktion ab, sag Boss kurz den Grund und versuch es nicht auf einem Umweg.`;

const WEB_SEARCH = { type: "web_search_20260209", name: "web_search", max_uses: 3 };

function contextBlock(extra = {}) {
  const now = new Date().toLocaleString("de-DE", { timeZone: config.timezone, dateStyle: "full", timeStyle: "short" });
  const isoLocal = new Date().toLocaleString("sv-SE", { timeZone: config.timezone }).replace(" ", "T").slice(0, 16);
  let text = `Aktuelle Zeit: ${now} (${isoLocal}, Zeitzone ${config.timezone}). Heimatstadt: ${config.city}.
Mac verbunden: ${isoAgentText()}.
${dienstKurzinfo()}
${profilKurzinfo()}
${duFormFrei() ? 'Nachrichten an andere (anrufe): Schreib den Text so, wie Boss ihn dem Empfänger selbst sagen würde, direkt in der Du-Form. "Sag meiner Frau, dass ich sie liebe" → Text "Ich liebe dich.", nicht "Ich liebe sie."\n' : ""}Kanal: ${extra.channel || "web"}.

${kernKontext(extra.frage || "")}

Dein Agenten-Team (du koordinierst es; nenne den passenden Agenten, wenn es hilft):
${agentsBrief()}
Agenten, die "noch nicht aktiv" sind, brauchen erst eine Einrichtung – sag das kurz, statt so zu tun, als ginge es schon.`;
  if (extra.mode === "translate") {
    text += `\n\nÜBERSETZER-MODUS: Übersetze jede Nachricht des Nutzers. Ist sie Deutsch, übersetze ins ${extra.targetLang || "Englische"}; ist sie in einer anderen Sprache, übersetze ins Deutsche. Antworte nur mit der Übersetzung.`;
  }
  return text;
}

// Fehler 400 "Invalid signature in thinking block": ein Denk-Block passt nicht mehr zum Gespräch.
function istDenkBlockFehler(err) {
  return err?.status === 400 && /thinking/i.test(String(err?.message || "")) && /signature|block/i.test(String(err?.message || ""));
}
function ohneDenkBloecke(messages) {
  for (const m of messages) {
    if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
    m.content = m.content.filter((b) => b.type !== "thinking" && b.type !== "redacted_thinking");
    if (!m.content.length) m.content = [{ type: "text", text: "…" }];
  }
}

function isoAgentText() {
  return isAgentOnline() ? "ja" : "nein";
}

/**
 * Stellt Friday eine Frage.
 * @param {object} opts
 * @param {string} opts.text - Was der Nutzer sagt
 * @param {string} [opts.channel] - web | telegram | siri | briefing
 * @param {{data: string, mediaType: string}} [opts.image] - optionales Foto (base64)
 * @param {string} [opts.mode] - normal | translate
 * @param {string} [opts.targetLang]
 * @param {boolean} [opts.keepHistory] - Verlauf speichern (Standard: ja)
 */
// Jede Frage und Antwort kommt in Fridays Datenbank (Fenster "Wissen"), egal über welchen Weg.
export async function ask(opts) {
  const start = Date.now();
  // Weckruf (v1.161.0): "… und ruf mich an, wenn du fertig bist" – Auftrag ausführen, danach klingeln.
  const fw = opts?.mode !== "translate" && opts?.text ? fertigWunsch(opts.text) : { rufen: false };
  if (fw.rufen) opts = { ...opts, text: fw.text };
  let res;
  try {
    res = await askIntern(opts);
  } catch (err) {
    logbuchBefehl(opts, { answer: `Fehler: ${err.message}`, actions: [], fehler: true }, Date.now() - start);
    throw err;
  }
  logbuchBefehl(opts, res, Date.now() - start);
  const dauer = Date.now() - start;
  const kanal = opts?.channel || "web";
  // Bestellt ("ruf mich an, wenn …") oder ein langer Auftrag (über 3 Min.), während Boss weg ist.
  if ((fw.rufen || (dauer > 180000 && kanal === "web")) && !res?.fehler) {
    const kurz = String(res?.answer || "").replace(/\s+/g, " ").slice(0, 300);
    notifyAll("✅ Friday ist fertig", `${String(opts.text || "").slice(0, 80)}: ${kurz}`, { art: "aufgabe", erzwingen: fw.rufen }).catch(() => {});
  }
  store.archiviere({
    typ: "gespraech",
    kanal: opts?.channel || "web",
    frage: `${opts?.image ? "📷 " : ""}${String(opts?.text || "")}`.trim().slice(0, 2000),
    antwort: String(res?.answer || "").slice(0, 4000),
    ...(res?.actions?.length ? { aktionen: res.actions.filter((a) => typeof a === "string").slice(0, 8) } : {}),
  });
  return res;
}

// Fürs Logbuch: was gesagt wurde, was Friday geantwortet hat, über welchen Weg und wie schnell.
function logbuchBefehl(opts, res, dauer) {
  const kanal = opts?.channel || "web";
  const frage = `${opts?.image ? "📷 " : ""}${String(opts?.text || "").trim()}`.trim() || (opts?.image ? "📷 Foto" : "");
  const aktionen = (res?.actions || []).filter((a) => typeof a === "string" && a !== "zuhoeren");
  const briefing = kanal === "briefing";
  logbuch.eintragen({
    bereich: briefing ? "briefing" : "befehl",
    titel: briefing ? "Morgenbriefing erstellt" : frage || "(leer)",
    details: res?.answer ? `Friday: ${res.answer}` : "",
    kanal,
    quelle: opts?.mode === "translate" ? "übersetzer" : res?.claude ? "claude" : aktionen.includes("offline") ? "offline" : aktionen.length ? "schnellbefehl" : "",
    claude: Boolean(res?.claude),
    ok: !res?.fehler,
    dauer_ms: dauer,
    aktionen,
  });
}

async function askIntern({ text, channel = "web", image, mode = "normal", targetLang, keepHistory = true, standort }) {
  const history = keepHistory ? store.getHistory(channel) : [];

  const userContent = [];
  if (image) userContent.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
  userContent.push({ type: "text", text: text || "Was siehst du auf diesem Bild?" });

  // Im Verlauf stehen nur reine Text-Paare. Innerhalb einer Anfrage bleibt alles vollständig.
  const messages = [...history, { role: "user", content: userContent }];
  const actions = [];
  let claudeGefragt = false; // fürs Logbuch: hat Claude geantwortet?
  // Auftrags-Kern: was wurde verlangt, und was ist wirklich passiert?
  const auftrag = mode !== "translate" && text ? auftragErkennen(text) : null;
  const protokoll = neuesProtokoll(auftrag);
  let kernAktiv = false; // erst ab dem Claude-Teil prüfen (Schnellbefehle melden selbst ehrlich)
  let nichtGeklappt = false; // Claude nicht erreichbar und auch offline keine Antwort

  // Weckruf-Befehle ("teste den Weckruf", "bitte nicht stören für 2 Stunden") – vor den Anrufen,
  // weil "ruf mich zum Test an" sonst als Anruf an einen Kontakt verstanden würde.
  if (mode !== "translate" && !image && text) {
    try {
      const w = await weckrufQuick(text);
      if (w) { actions.push(...w.actions); return finish(w.answer); }
    } catch (err) {
      console.error("Weckruf:", err.message);
    }
  }

  // Meine Konten (v1.163.0): "wie ist mein Kontostand?", "was habe ich diesen Monat ausgegeben?", "welche Abos habe ich?" –
  // ohne Claude, nur lesen. "Überweise 50 Euro …" wird hier freundlich abgelehnt (Friday bewegt kein Geld).
  if (mode !== "translate" && !image && text) {
    try {
      const k = kontenQuick(text);
      if (k) { actions.push(...k.actions); return finish(k.answer); }
    } catch (err) {
      console.error("Konten:", err.message);
    }
  }

  // Anrufe & Nachrichten ("ruf meine Frau an und sag ihr, dass …") – ohne Claude.
  // Ganz vorne, damit die Antwort auf "Was soll ich ihr sagen?" hier landet.
  if (mode !== "translate" && !image && text) {
    try {
      const a = await anrufQuick(text, channel);
      if (a) { actions.push(...a.actions); return finish(a.answer); }
    } catch (err) {
      console.error("Anrufe:", err.message);
    }
  }

  // Live-Sport (v1.150.0; vor der Spiele-Werkstatt, damit "Live-Spiel" hier landet), im Test: in Friday erst nach Freigabe in Eve): "zeig mir das Live-Spiel",
  // "wie steht es bei Bayern?", "Bundesliga live" – Stand, Ereignisse, Analyse, wo es legal läuft.
  if (mode !== "translate" && !image && text) {
    try {
      const sp = await sportQuick(text);
      if (sp) { actions.push(...sp.actions); return finish(sp.answer); }
    } catch (err) {
      console.error("Live-Sport:", err.message);
    }
  }

  // Spiele-Werkstatt ("bau mir ein Spiel", "öffne mein Snake-Spiel") – startet den Bau sofort,
  // das Dashboard zeigt live, wie Friday programmiert. Claude schreibt den Code im Hintergrund.
  if (mode !== "translate" && !image && text) {
    try {
      const sp = spielQuick(text, channel);
      if (sp) { actions.push(...sp.actions); return finish(sp.answer); }
    } catch (err) {
      console.error("Spiele-Werkstatt:", err.message);
    }
  }

  // Markt-Radar Plus (v1.150.0, zuerst nur in Eve): "analysiere den DAX", "Prognose für Gold", "öffne die Markt-Wache".
  if (mode !== "translate" && !image && text) {
    try {
      const mp = await marktplusQuick(text);
      if (mp) { actions.push(...mp.actions); return finish(mp.answer); }
    } catch (err) {
      console.error("Markt-Radar Plus:", err.message);
    }
  }

  // Notfallmodus, Autonomie und Modul-Zentrale ("Friday, Notfall!", "öffne Mission Control") – ohne Claude.
  // Danach eigene Module und Befehle der Zentrale (Formel-Labor, Prioritäten, Missionen …).
  if (mode !== "translate" && !image && text) {
    try {
      const k = kommandoQuick(text);
      if (k) { actions.push(...k.actions); return finish(k.answer); }
      const z = await zentraleQuick(text, channel);
      if (z) { actions.push(...z.actions); return finish(z.answer); }
    } catch (err) {
      console.error("Modul-Zentrale:", err.message);
    }
  }

  // Alexa-Befehle ("Alexa Licht an", "Alexa sag ...") gehen sofort und ohne Claude (klappt auch bei leerem Guthaben).
  // Steht vor dem Fernseher, damit "Alexa, mach Netflix an" bei Alexa landet.
  if (mode !== "translate" && !image && text) {
    try {
      const alexaAnswer = await alexaQuick(text);
      if (alexaAnswer) { actions.push("alexa"); return finish(alexaAnswer); }
    } catch (err) {
      console.error("Alexa-Schnellbefehl:", err.message);
    }
  }

  // Fernseher-Befehle gehen sofort und ohne Claude (klappt auch bei leerem Guthaben).
  if (mode !== "translate" && !image && text) {
    try {
      const tvAnswer = await tvQuick(text);
      if (tvAnswer) { actions.push("fernseher"); return finish(tvAnswer); }
    } catch (err) {
      console.error("Fernseher-Schnellbefehl:", err.message);
    }
  }

  // Kontrollraum (v1.135.0): "öffne den Kontrollraum", "zeig mir deine Seele", "was hast du heute ausgegeben?" – ohne Claude.
  if (mode !== "translate" && !image && text) {
    try {
      const kr = kernQuick(text);
      if (kr) { actions.push(...kr.actions); return finish(kr.answer); }
    } catch (err) {
      console.error("Kontrollraum:", err.message);
    }
  }

  // Video-Studio (v1.132.0): "Friday, erstell mir ein 20-Sekunden-Video über Mallorca mit Musik" – startet sofort.
  // Das Drehbuch schreibt Claude, wenn Guthaben da ist, sonst Wikipedia/Vorlage. Musik komponiert Friday selbst.
  if (mode !== "translate" && !image && text) {
    try {
      const vs = studioQuick(text);
      if (vs) { actions.push(...vs.actions); return finish(vs.answer); }
    } catch (err) {
      console.error("Video-Studio:", err.message);
    }
  }

  // Kamera-Wache (v1.127.0): "Was passiert zu Hause?", "Wache an", "Ist jemand im Wohnzimmer?" – ohne Claude.
  // Vor dem Helfer-Paket und der Länder-Info, damit "was passiert in der Küche" kein Land wird.
  if (mode !== "translate" && !image && text) {
    try {
      const wa = await wacheQuick(text);
      if (wa) { actions.push(...wa.actions); return finish(wa.answer); }
    } catch (err) {
      console.error("Kamera-Wache:", err.message);
    }
  }

  // Kevins Wunschliste (v1.160.0): Unwetter, Pakete, Nachrichten, Mediathek, Ollama, Fritz!Box, Geburtstage,
  // Familien-Pinnwand, Abend-Rückblick, "was weißt du über meine Gewohnheiten" – alles ohne Claude.
  // Vor dem OpenJarvis-Paket, damit "wann hat Mama Geburtstag" Fridays eigene Geburtstagsliste nimmt.
  if (mode !== "translate" && !image && text) {
    try {
      const wl = await wunschQuick(text);
      if (wl) { actions.push(...wl.actions); return finish(wl.answer); }
    } catch (err) {
      console.error("Wunschliste:", err.message);
    }
  }

  // OpenJarvis-Paket (v1.134.0): Freigabe-Glocke ("gib frei"), Dauer-Wächter ("beobachte …"),
  // Dokumenten-Wissen ("was steht in meinen Dokumenten über …"), Apple Notizen/Kontakte/Musik/Health – ohne Claude fürs Suchen.
  if (mode !== "translate" && !image && text) {
    try {
      const oj = await jarvisQuick(text);
      if (oj) { actions.push(...oj.actions); if (oj.claude) claudeGefragt = true; return finish(oj.answer); }
    } catch (err) {
      console.error("OpenJarvis-Paket:", err.message);
    }
  }

  // Helfer-Paket (v1.106.0): Kühlschrank, Kaufberater, Advocatus Diaboli, Stimmungs-Sound, Ideen-Schmiede – ohne Claude.
  if (mode !== "translate" && !image && text) {
    try {
      const hf = await helferQuick(text);
      if (hf) { actions.push(...hf.actions); return finish(hf.answer); }
    } catch (err) {
      console.error("Helfer-Paket:", err.message);
    }
  }

  // Zerlege-Labor (v1.143.0, im Test: in Friday erst nach Freigabe in Eve): "zerleg mir einen V8",
  // "nimm den Motor aus dem Auto raus" – ohne Claude. Vor der Werkstatt, damit "zerleg" nicht als Bauwunsch landet.
  if (mode !== "translate" && !image && text) {
    try {
      const z = zerlegeQuick(text);
      if (z) { actions.push(...z.actions); return finish(z.answer); }
    } catch (err) {
      console.error("Zerlege-Labor:", err.message);
    }
  }

  // Werkstatt: Wohnhäuser ("bau mir ein Mehrfamilienhaus") entwirft Friday selbst – ohne Claude.
  if (mode !== "translate" && !image && text) {
    try {
      const h = hausQuick(text);
      if (h) { actions.push(...h.actions); return finish(h.answer); }
    } catch (err) {
      console.error("Haus-Werkstatt:", err.message);
    }
  }

  // Weltgeschehen als Gespräch ("zeig mir das Weltgeschehen" → "Welches Land?" → Lage + Nachrichten)
  // und Vollbild. Steht vor der Länder-Info, damit die Antwort auf "Welches Land?" hier landet.
  if (mode !== "translate" && !image && text) {
    try {
      const v = vollbildQuick(text);
      if (v) { actions.push(...v.actions); return finish(v.answer); }
      const tq = tourQuick(text, channel);
      if (tq) { actions.push(...tq.actions); return finish(tq.answer); }
      const sq = await satQuick(text).catch((err) => { console.error("Satelliten:", err.message); return null; });
      if (sq) { actions.push(...sq.actions); return finish(sq.answer); }
      const kq = klimaQuick(text);
      if (kq) { actions.push(...kq.actions); return finish(kq.answer); }
      const schq = schiffQuick(text);
      if (schq) { actions.push(...schq.actions); return finish(schq.answer); }
      const fq = await flugQuick(text).catch((err) => { console.error("Flugzeuge:", err.message); return null; });
      if (fq) { actions.push(...fq.actions); return finish(fq.answer); }
      const w = await weltQuick(text, channel);
      if (w) { actions.push(...w.actions); return finish(w.answer); }
    } catch (err) {
      console.error("Weltgeschehen:", err.message);
    }
  }

  // Tool-Ökosystem ("zeig mir alle Werkzeuge") – ohne Claude.
  if (mode !== "translate" && !image && text) {
    try {
      const oe = oekosystem.quickCommand(text);
      if (oe) { actions.push(...oe.actions); return finish(oe.answer); }
    } catch (err) {
      console.error("Ökosystem:", err.message);
    }
  }

  // Fridays Datenbank ("durchsuche die Datenbank nach …", "notiere in die Datenbank: …") – ohne Claude.
  if (mode !== "translate" && !image && text) {
    try {
      const db = datenbankQuick(text);
      if (db) { actions.push(...db.actions); return finish(db.answer); }
    } catch (err) {
      console.error("Datenbank:", err.message);
    }
  }

  // Logbuch ("öffne das Logbuch", "was hast du heute gemacht?") – ohne Claude.
  if (mode !== "translate" && !image && text) {
    try {
      const lb = logbuch.quickCommand(text);
      if (lb) { actions.push(...lb.actions); return finish(lb.answer); }
    } catch (err) {
      console.error("Logbuch:", err.message);
    }
  }

  // Gehirn ("zeig mir dein Gehirn", "öffne den KI-Kern") – ohne Claude, mit echten Zahlen.
  if (mode !== "translate" && !image && text) {
    try {
      const g = gehirnQuick(text, { agentOnline: isAgentOnline() });
      if (g) { actions.push(...g.actions); return finish(g.answer); }
    } catch (err) {
      console.error("Gehirn:", err.message);
    }
  }

  // Archiv ("öffne das Archiv", "zeig mir meine Fotos") – ohne Claude. Vor der Länder-Info.
  if (mode !== "translate" && !image && text) {
    try {
      const a = archivQuick(text);
      if (a) { actions.push(...a.actions); return finish(a.answer); }
      const pq = profilQuick(text);
      if (pq) { actions.push(...pq.actions); return finish(pq.answer); }
    } catch (err) {
      console.error("Archiv:", err.message);
    }
  }

  // App-Zentrale (v1.139.0, im Test: in Friday erst nach Freigabe in Eve): "öffne Ring", "starte Kurzbefehl …",
  // "was gibt's neues auf GitHub?", "bezahl mit PayPal" (nie selbst!) – ohne Claude. Nach dem Fernseher (TV-Befehle gehen vor).
  if (mode !== "translate" && !image && text) {
    try {
      const ap = await appsQuick(text);
      if (ap) { actions.push(...ap.actions); return finish(ap.answer); }
    } catch (err) {
      console.error("App-Zentrale:", err.message);
    }
  }

  // Standort ("wo bin ich?", "Standort aus", "vergiss meinen Standort") – ohne Claude.
  if (mode !== "translate" && !image && text) {
    const sq = standortQuick(text);
    if (sq) { actions.push(...sq.actions); return finish(sq.answer); }
  }

  // Routen & Verbindungen ("wie lange brauche ich nach Hamburg?", "nächster Zug nach Köln") – ohne Claude.
  // Vor der Länder-Info, damit "zeig mir den Weg nach Paris" hier landet.
  if (mode !== "translate" && !image && text) {
    try {
      const r = await routenQuick(text, { standort });
      if (r) { actions.push(...r.actions); return finish(r.answer); }
    } catch (err) {
      console.error("Routen:", err.message);
    }
  }

  // Länder-Info ("zeig mir USA", "erzähl mir was über Japan"): Fenster + Vorlesen – ohne Claude.
  if (mode !== "translate" && !image && text) {
    try {
      const l = await landQuick(text);
      if (l) { actions.push(...l.actions); return finish(l.answer); }
    } catch (err) {
      console.error("Länder-Info:", err.message);
    }
  }

  // Verbindungen (Kalender, Spotify, Hue, Home Assistant, Todoist, Notion, Stimme) – ebenfalls ohne Claude.
  if (mode !== "translate" && !image && text) {
    try {
      const d = await dienstQuick(text);
      if (d) { actions.push(...d.actions); return finish(d.answer); }
    } catch (err) {
      console.error("Verbindungs-Schnellbefehl:", err.message);
    }
  }

  // Öffentliche Daten (v1.166.0): NINA, Pegel, Autobahn, Rückrufe, Strom, Ferien, Jobs, NASA, Wikipedia, Eurostat, EZB … – ohne Claude.
  if (mode !== "translate" && !image && text) {
    try {
      const od = await datenQuick(text);
      if (od) { actions.push(...od.actions); return finish(od.answer); }
    } catch (err) {
      console.error("Öffentliche Daten:", err.message);
    }
  }

  // Werkzeugkasten (v1.161.0): 100 Rechner & Helfer ohne Claude ("19 Prozent von 250", "QR-Code für …", "Brückentage 2027").
  if (mode !== "translate" && !image && text) {
    try {
      const wk = await werkzeugQuick(text);
      if (wk) { actions.push(...wk.actions); return finish(wk.answer); }
    } catch (err) {
      console.error("Werkzeugkasten:", err.message);
    }
  }

  // Offline-Gehirn: Uhrzeit, Wetter, Timer, Listen, Kurse, Nachrichten ... sofort und ohne Claude.
  if (mode !== "translate" && !image && text) {
    try {
      const off = await offlineAnswer(text);
      if (off) { actions.push(...off.actions); return finish(off.answer); }
    } catch (err) {
      console.error("Offline-Gehirn:", err.message);
    }
  }

  // Fridays Lexikon (v1.156.0): rund 1.600 Wissens-Einträge ohne Claude und ohne Internet
  // ("Was ist ein ETF?", "Wer war Marie Curie?", "Hauptstadt von Bayern", "Was passierte 1989?").
  if (mode !== "translate" && !image && text) {
    try {
      const lx = lexikonQuick(text);
      if (lx) { actions.push(...lx.actions); return finish(lx.answer); }
    } catch (err) {
      console.error("Lexikon:", err.message);
    }
  }

  // Kosten-Deckel (v1.135.0): Grenze pro Stunde/Tag erreicht → nur Offline-Befehle, kein Claude.
  const deckel = deckelSperre();
  if (deckel) {
    const v = tabellenVorlage();
    if (v) return finish(`${v} Claude ist gerade wegen des Kosten-Deckels aus, darum ist es eine Vorlage zum Ausfüllen.`);
    actions.push("kosten_deckel");
    return finish(deckel);
  }

  // Sparmodus bei knappem Guthaben: günstiges Modell, wenig Aufwand, keine Websuche.
  // Denk-Tempo "Automatisch" (KI-Modell-Routing): kurze Fragen → Haiku, schwere → Opus, sonst Sonnet.
  const tempoWahl = getSettings().tempo === "auto" ? tempoFuerFrage(text) : getSettings().tempo;
  const tempo = TEMPO[tempoWahl] || TEMPO.schnell;
  const gewuenscht = tempo.model || config.model;
  const model = brainModel(gewuenscht);
  const sparen = model === SPAR_MODELL && gewuenscht !== SPAR_MODELL;
  const ohneFallback = sparen || !tempo.fallback;
  const mitWebsuche = !sparen && tempo.websuche;
  let nachgehakt = 0;
  kernAktiv = true;
  setzeAuftrag(channel, "verstehen", 8, "Friday liest den Auftrag …");
  // Der System-Text bleibt für die ganze Anfrage gleich. Würde er sich zwischen zwei Runden ändern
  // (neue Minute, neue Notiz im Gedächtnis), lehnt Claude die Denk-Blöcke der vorigen Runde ab (Fehler 400).
  const system = [
    { type: "text", text: PERSONA, cache_control: { type: "ephemeral" } },
    { type: "text", text: seeleKontext() },
    { type: "text", text: contextBlock({ channel, mode, targetLang, frage: text }) },
  ];
  let denkBloeckeEntfernt = false;
  const schleife = schleifenWaechter(channel); // Schleifen-Schutz (v1.135.0)
  const auftragId = `${channel}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  for (let round = 0; round < 8; round++) {
    const params = {
      model,
      max_tokens: sparen ? 4000 : 16000,
      ...(ohneFallback ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }),
      output_config: { effort: sparen ? "low" : tempo.effort },
      system,
      messages: mitCachePunkt(messages),
    };
    if (mode !== "translate") params.tools = mitWebsuche ? [...toolDefinitions, WEB_SEARCH] : [...toolDefinitions];
    let response;
    try {
      response = ohneFallback ? await client.messages.create(params) : await client.beta.messages.create(params);
    } catch (err) {
      // Sicherheitsnetz: passt ein Denk-Block nicht mehr zum Gespräch, ohne Denk-Blöcke noch einmal fragen.
      if (!denkBloeckeEntfernt && istDenkBlockFehler(err)) {
        denkBloeckeEntfernt = true;
        ohneDenkBloecke(messages);
        round--;
        continue;
      }
      // Claude nicht erreichbar (Guthaben leer, falscher Schlüssel, kein Netz): Offline-Gehirn springt ein.
      const leer = isCreditError(err);
      if (leer) markEmpty();
      else console.error("Claude nicht erreichbar:", err.message);
      return notfall(leer);
    }
    recordUsage(response.model || model, response.usage, "chat");
    claudeGefragt = true;

    if (response.stop_reason === "refusal") {
      return finish("Dabei kann ich dir leider nicht helfen, Boss.");
    }

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "pause_turn") { setzeAuftrag(channel, "arbeiten", 40, "Friday sucht im Netz …"); continue; }

    const toolUses = response.content.filter((b) => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const answer = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      // Auftrags-Kern: Nur angekündigt oder ein Fehler? Bis zu zweimal nachhaken, damit Friday es wirklich erledigt.
      if (mode !== "translate" && nachgehakt < (auftrag ? 2 : 1) && round < 6 && sollNachhaken(answer, auftrag, protokoll)) {
        nachgehakt++;
        setzeAuftrag(channel, "arbeiten", 35 + nachgehakt * 10, "Friday erledigt den Auftrag …");
        messages.push({ role: "user", content: [{ type: "text", text: nachhakText(auftrag, protokoll) }] });
        continue;
      }
      // Immer noch keine Tabelle? Dann baut Friday selbst eine passende Vorlage – statt nichts.
      const v = protokoll.status() === "nicht_erledigt" ? tabellenVorlage() : "";
      if (v) return finish(v);
      return finish(answer || (protokoll.status() === "ok" ? "Erledigt, Boss." : ""));
    }
    setzeAuftrag(channel, "arbeiten", Math.min(80, 30 + round * 15), `Friday ${werkzeugName(toolUses[0].name)} …`, toolUses.map((t) => t.name));

    // Alle Werkzeuge ausführen und die Ergebnisse gemeinsam zurückgeben.
    const results = await Promise.all(
      toolUses.map(async (tool) => {
        actions.push(tool.name === "mac" ? `mac:${tool.input?.action}` : tool.name);
        try {
          const result = await runTool(tool.name, tool.input, { quelle: "claude", kanal: channel, auftrag: auftragId });
          protokoll.eintragen(tool.name, result);
          if (result && Array.isArray(result.content)) return { type: "tool_result", tool_use_id: tool.id, content: result.content };
          const isError = Boolean(result && result.error);
          return { type: "tool_result", tool_use_id: tool.id, content: JSON.stringify(result ?? {}), is_error: isError };
        } catch (err) {
          protokoll.eintragen(tool.name, { error: err.message });
          return { type: "tool_result", tool_use_id: tool.id, content: `Fehler: ${err.message}`, is_error: true };
        }
      }),
    );
    // Schleifen-Schutz: dreimal genau dasselbe → Hinweis, viermal → Abbruch.
    const sw = schleife.runde(toolUses);
    if (sw.art === "abbruch") { actions.push("schleife"); return finish(sw.text); }
    if (sw.art === "hinweis") results.push({ type: "text", text: sw.text });
    messages.push({ role: "user", content: results });
    setzeAuftrag(channel, "erstellen", Math.min(90, 55 + round * 12), "Friday fasst das Ergebnis zusammen …");
  }

  return finish("Das hat zu viele Schritte gebraucht, Boss. Versuch es bitte etwas einfacher.");

  // Excel-Tabelle ohne Claude: passende Vorlage als echte Datei. Gibt den Antwort-Satz zurück (oder "").
  function tabellenVorlage() {
    if (auftrag?.art !== "tabelle" || protokoll.erfuellt() || protokoll.wartet()) return "";
    const r = tabelleErstellen({ ...vorlageFuer(text), quelle: "vorlage" });
    protokoll.eintragen("tabelle_erstellen", r);
    if (r.error) return "";
    actions.push("tabelle_erstellen");
    return `Fertig, ${config.userName}. Die Excel-Tabelle „${r.titel}“ liegt im Archiv unter Tabellen${r.geoeffnet ? " und ist am Mac offen" : ""}. Spalten und Formeln sind schon drin, du musst nur noch ausfüllen.`;
  }

  async function notfall(leer) {
    const v = tabellenVorlage();
    if (v) return finish(v);
    if (mode !== "translate" && !image && text) {
      try {
        const off = await offlineAnswer(text, { notfall: true });
        if (off && off.answer !== notfallText()) { actions.push(...off.actions); return finish(off.answer); }
      } catch (err) {
        console.error("Offline-Gehirn (Notfall):", err.message);
      }
      // Claude nicht erreichbar: im Lexikon auch ungefähre Treffer suchen.
      try {
        const lx = lexikonQuick(text, { locker: true });
        if (lx) { actions.push(...lx.actions); return finish(lx.answer); }
      } catch (err) {
        console.error("Lexikon (Notfall):", err.message);
      }
    }
    nichtGeklappt = true;
    if (leer) return finish(`Mir geht die Energie aus, ${config.userName}. Mein Guthaben ist leer. Lade es auf console.anthropic.com auf und sag mir dann im Energie-Fenster, wie viel. Bis dahin laufen meine Offline-Befehle – sag einfach: Was kannst du?`);
    return finish(notfallText());
  }

  function finish(answer) {
    // Ehrlich bleiben: "erledigt" nur, wenn wirklich etwas geklappt hat.
    if (kernAktiv && mode !== "translate") answer = ehrlich(answer, auftrag, protokoll, config.userName);
    const st = kernAktiv ? protokoll.status() : "";
    auftragFertig(channel, !nichtGeklappt && st !== "fehler" && st !== "nicht_erledigt");
    if (keepHistory) {
      const userText = image ? `[Foto] ${text || ""}`.trim() : text;
      store.saveHistory(channel, [...history, { role: "user", content: userText }, { role: "assistant", content: answer }]);
    }
    return {
      answer, actions,
      ...(claudeGefragt ? { claude: true } : {}),
      ...(nichtGeklappt ? { fehler: true } : {}),
      ...(kernAktiv && (auftrag || protokoll.schritte.length) ? { erledigt: { status: st, auftrag: auftrag?.art || null, schritte: protokoll.schritte.slice(0, 12) } } : {}),
    };
  }
}

// Zwischenspeicher (Prompt-Cache) auch für das Gespräch: Bei Aufträgen mit mehreren Werkzeug-Runden muss Claude
// den bisherigen Verlauf nicht jedes Mal neu lesen – schneller und billiger. Ein wandernder Merker am letzten Block.
function mitCachePunkt(messages) {
  const out = messages.map((m) => (Array.isArray(m.content) ? { ...m, content: m.content.map(({ cache_control, ...b }) => b) } : m));
  const letzte = out[out.length - 1];
  if (letzte && Array.isArray(letzte.content) && letzte.content.length) {
    const i = letzte.content.length - 1;
    const b = letzte.content[i];
    if (b && ["text", "tool_result", "image"].includes(b.type)) letzte.content[i] = { ...b, cache_control: { type: "ephemeral" } };
  }
  return out;
}
