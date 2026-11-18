// Fridays Gehirn: redet mit Claude und benutzt die Werkzeuge.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { toolDefinitions, runTool } from "./tools.js";
import * as store from "./store.js";
import { isAgentOnline } from "./agent-hub.js";
import { agentsBrief } from "./agents.js";
import { quickCommand as alexaQuick } from "./alexa.js";
import { quickCommand as anrufQuick } from "./anrufe.js";
import { quickCommand as tvQuick } from "./fernseher.js";
import { quickCommand as dienstQuick, dienstKurzinfo } from "./dienste.js";
import { offlineAnswer, notfallText } from "./offline.js";
import { quickCommand as hausQuick } from "./werkstatt.js";
import { quickCommand as landQuick } from "./laenderinfo.js";
import { quickCommand as archivQuick } from "./archiv.js";
import { quickCommand as weltQuick, vollbildQuick } from "./weltgespraech.js";
import { brainModel, SPAR_MODELL, recordUsage, isCreditError, markEmpty } from "./energie.js";
import { getSettings } from "./einstellungen.js";
import { setzeAuftrag, auftragFertig, werkzeugName } from "./auftrag.js";
import * as logbuch from "./logbuch.js";
import { tempoFuerFrage } from "./denker.js";
import { quickCommand as kommandoQuick } from "./kommando.js";
import { quickCommand as zentraleQuick } from "./zentrale.js";

// Denk-Tempo (Einstellungen → Assistent): schnell ist der Standard.
const TEMPO = {
  blitz: { model: "claude-haiku-5-5", effort: "low", fallback: false, websuche: false },
  schnell: { model: "claude-sonnet-5-5", effort: "low", fallback: true, websuche: true },
  gruendlich: { model: null, effort: "medium", fallback: true, websuche: true }, // null = CLAUDE_MODEL aus der .env (Opus)
};
// Sätze, mit denen Friday etwas nur ankündigt, statt es zu tun.
const NUR_ANGEKUENDIGT = /\b(mach(e)? ich|ich mach(e)? (das|dir|es|mich)|ich (erstelle|schreibe|bereite|kümmere|kuemmere|stelle|suche|baue|plane|setze)|wird erledigt|bin dran|gleich (fertig|erledigt)|sofort,? boss|kommt sofort|ich fange (jetzt )?an|einen moment)\b/i;

const client = new Anthropic({ apiKey: config.anthropicKey });

const PERSONA = `Du bist F.R.Ai.D.A.Y, die persönliche KI von ${config.userName}, inspiriert von FRIDAY aus Iron Man.

Charakter:
- Loyal, schlagfertig, trocken-humorvoll, aber nie respektlos. Du sprichst ${config.userName} meist mit "Boss" an.
- Du bist kompetent und ruhig, auch wenn es hektisch wird. Kleine Sprüche sind erlaubt, Geschwafel nicht.
- Du antwortest auf Deutsch, außer du wirst gebeten, etwas zu übersetzen.

Antwortstil:
- Deine Antworten werden meistens vorgelesen. Halte sie kurz: ein bis drei Sätze, wenn nichts anderes verlangt ist.
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
- Termine und Apple-Erinnerungen: kalender (Fridays eigene Erinnerungen mit Wecker: set_reminder). Musik: spotify, wenn verbunden, sonst mac. Lampen: hue für Philips Hue, smart_home für Home Assistant (Heizung, Steckdosen, Rollos, Sensoren). Aufgaben: todoist, wenn verbunden. Notizen und Wissen: notion.
- Nachrichten und Anrufe an die Frau des Nutzers, ihn selbst oder hinterlegte Kontakte: anrufe. Wer "ruf meine Frau an und sag ihr …" sagt, hat damit bestätigt: direkt ausführen. Den Text in der Ich-Form des Nutzers formulieren.
- Mac-Aktionen gehen nur, wenn der Mac verbunden ist. Wenn nicht, sag es kurz.
- Lösche, kaufe oder verschicke nie etwas an andere Personen ohne ausdrückliche Bestätigung.

Aufträge:
- Wenn ${config.userName} dir einen Auftrag gibt, erledigst du ihn sofort in dieser Antwort. Sag nie "mache ich" oder "ich erstelle das", ohne es im selben Zug zu tun. Es gibt kein "später": nach deiner Antwort passiert nichts mehr.
- Alles, was länger als drei Sätze ist (Listen, Pläne, Texte, Rezepte, Ideen), speicherst du mit dokument_erstellen. Fragebögen erstellst du mit fragebogen_erstellen, mit genau so vielen Fragen wie gewünscht. Danach sagst du nur kurz, dass es fertig im Dashboard liegt.
- Wenn etwas wirklich nicht geht, sag ehrlich und kurz, warum.`;

const WEB_SEARCH = { type: "web_search_20260209", name: "web_search", max_uses: 3 };

function contextBlock(extra = {}) {
  const now = new Date().toLocaleString("de-DE", { timeZone: config.timezone, dateStyle: "full", timeStyle: "short" });
  const isoLocal = new Date().toLocaleString("sv-SE", { timeZone: config.timezone }).replace(" ", "T").slice(0, 16);
  const memories = store.getMemories().map((m) => `- ${m.text}`).join("\n") || "(noch nichts)";
  let text = `Aktuelle Zeit: ${now} (${isoLocal}, Zeitzone ${config.timezone}). Heimatstadt: ${config.city}.
Mac verbunden: ${isoAgentText()}.
${dienstKurzinfo()}
Kanal: ${extra.channel || "web"}.

Was du über ${config.userName} weißt:
${memories}

Dein Agenten-Team (du koordinierst es; nenne den passenden Agenten, wenn es hilft):
${agentsBrief()}
Agenten, die "noch nicht aktiv" sind, brauchen erst eine Einrichtung – sag das kurz, statt so zu tun, als ginge es schon.`;
  if (extra.mode === "translate") {
    text += `\n\nÜBERSETZER-MODUS: Übersetze jede Nachricht des Nutzers. Ist sie Deutsch, übersetze ins ${extra.targetLang || "Englische"}; ist sie in einer anderen Sprache, übersetze ins Deutsche. Antworte nur mit der Übersetzung.`;
  }
  return text;
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
  let res;
  try {
    res = await askIntern(opts);
  } catch (err) {
    logbuchBefehl(opts, { answer: `Fehler: ${err.message}`, actions: [], fehler: true }, Date.now() - start);
    throw err;
  }
  logbuchBefehl(opts, res, Date.now() - start);
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

async function askIntern({ text, channel = "web", image, mode = "normal", targetLang, keepHistory = true }) {
  const history = keepHistory ? store.getHistory(channel) : [];

  const userContent = [];
  if (image) userContent.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
  userContent.push({ type: "text", text: text || "Was siehst du auf diesem Bild?" });

  // Im Verlauf stehen nur reine Text-Paare. Innerhalb einer Anfrage bleibt alles vollständig.
  const messages = [...history, { role: "user", content: userContent }];
  const actions = [];
  let claudeGefragt = false; // fürs Logbuch: hat Claude geantwortet?
  let nichtGeklappt = false; // Claude nicht erreichbar und auch offline keine Antwort

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
      const w = await weltQuick(text, channel);
      if (w) { actions.push(...w.actions); return finish(w.answer); }
    } catch (err) {
      console.error("Weltgeschehen:", err.message);
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

  // Archiv ("öffne das Archiv", "zeig mir meine Fotos") – ohne Claude. Vor der Länder-Info.
  if (mode !== "translate" && !image && text) {
    try {
      const a = archivQuick(text);
      if (a) { actions.push(...a.actions); return finish(a.answer); }
    } catch (err) {
      console.error("Archiv:", err.message);
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

  // Offline-Gehirn: Uhrzeit, Wetter, Timer, Listen, Kurse, Nachrichten ... sofort und ohne Claude.
  if (mode !== "translate" && !image && text) {
    try {
      const off = await offlineAnswer(text);
      if (off) { actions.push(...off.actions); return finish(off.answer); }
    } catch (err) {
      console.error("Offline-Gehirn:", err.message);
    }
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
  let nachgehakt = false;
  setzeAuftrag(channel, "verstehen", 8, "Friday liest den Auftrag …");
  for (let round = 0; round < 8; round++) {
    const params = {
      model,
      max_tokens: sparen ? 4000 : 16000,
      ...(ohneFallback ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }),
      output_config: { effort: sparen ? "low" : tempo.effort },
      system: [
        { type: "text", text: PERSONA, cache_control: { type: "ephemeral" } },
        { type: "text", text: contextBlock({ channel, mode, targetLang }) },
      ],
      messages,
    };
    if (mode !== "translate") params.tools = mitWebsuche ? [...toolDefinitions, WEB_SEARCH] : [...toolDefinitions];
    let response;
    try {
      response = ohneFallback ? await client.messages.create(params) : await client.beta.messages.create(params);
    } catch (err) {
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
      // Nur angekündigt, nichts getan? Einmal nachhaken, damit Friday es wirklich erledigt.
      if (!nachgehakt && actions.length === 0 && mode !== "translate" && NUR_ANGEKUENDIGT.test(answer) && round < 6) {
        nachgehakt = true;
        setzeAuftrag(channel, "arbeiten", 35, "Friday erledigt den Auftrag …");
        messages.push({ role: "user", content: [{ type: "text", text: "[Hinweis vom System, nicht von Boss] Du hast den Auftrag nur angekündigt. Erledige ihn jetzt sofort vollständig mit deinen Werkzeugen (z. B. dokument_erstellen oder fragebogen_erstellen) und antworte danach kurz, dass er fertig ist. Kündige nichts mehr an." }] });
        continue;
      }
      return finish(answer || "Erledigt, Boss.");
    }
    setzeAuftrag(channel, "arbeiten", Math.min(80, 30 + round * 15), `Friday ${werkzeugName(toolUses[0].name)} …`);

    // Alle Werkzeuge ausführen und die Ergebnisse gemeinsam zurückgeben.
    const results = await Promise.all(
      toolUses.map(async (tool) => {
        actions.push(tool.name === "mac" ? `mac:${tool.input?.action}` : tool.name);
        try {
          const result = await runTool(tool.name, tool.input, { quelle: "claude", kanal: channel });
          if (result && Array.isArray(result.content)) return { type: "tool_result", tool_use_id: tool.id, content: result.content };
          const isError = Boolean(result && result.error);
          return { type: "tool_result", tool_use_id: tool.id, content: JSON.stringify(result ?? {}), is_error: isError };
        } catch (err) {
          return { type: "tool_result", tool_use_id: tool.id, content: `Fehler: ${err.message}`, is_error: true };
        }
      }),
    );
    messages.push({ role: "user", content: results });
    setzeAuftrag(channel, "erstellen", Math.min(90, 55 + round * 12), "Friday fasst das Ergebnis zusammen …");
  }

  return finish("Das hat zu viele Schritte gebraucht, Boss. Versuch es bitte etwas einfacher.");

  async function notfall(leer) {
    if (mode !== "translate" && !image && text) {
      try {
        const off = await offlineAnswer(text, { notfall: true });
        if (off && off.answer !== notfallText()) { actions.push(...off.actions); return finish(off.answer); }
      } catch (err) {
        console.error("Offline-Gehirn (Notfall):", err.message);
      }
    }
    nichtGeklappt = true;
    if (leer) return finish(`Mir geht die Energie aus, ${config.userName}. Mein Guthaben ist leer. Lade es auf console.anthropic.com auf und sag mir dann im Energie-Fenster, wie viel. Bis dahin laufen meine Offline-Befehle – sag einfach: Was kannst du?`);
    return finish(notfallText());
  }

  function finish(answer) {
    auftragFertig(channel, true);
    if (keepHistory) {
      const userText = image ? `[Foto] ${text || ""}`.trim() : text;
      store.saveHistory(channel, [...history, { role: "user", content: userText }, { role: "assistant", content: answer }]);
    }
    return { answer, actions, ...(claudeGefragt ? { claude: true } : {}), ...(nichtGeklappt ? { fehler: true } : {}) };
  }
}
