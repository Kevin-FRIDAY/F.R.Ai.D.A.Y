// Fridays Gehirn: redet mit Claude und benutzt die Werkzeuge.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { toolDefinitions, runTool } from "./tools.js";
import * as store from "./store.js";
import { isAgentOnline } from "./agent-hub.js";
import { agentsBrief } from "./agents.js";
import { quickCommand as alexaQuick } from "./alexa.js";
import { quickCommand as tvQuick } from "./fernseher.js";
import { quickCommand as dienstQuick, dienstKurzinfo } from "./dienste.js";
import { offlineAnswer, notfallText } from "./offline.js";
import { quickCommand as hausQuick } from "./werkstatt.js";
import { quickCommand as landQuick } from "./laenderinfo.js";
import { quickCommand as weltQuick, vollbildQuick } from "./weltgespraech.js";
import { brainModel, SPAR_MODELL, recordUsage, isCreditError, markEmpty } from "./energie.js";

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
- Mac-Aktionen gehen nur, wenn der Mac verbunden ist. Wenn nicht, sag es kurz.
- Lösche, kaufe oder verschicke nie etwas an andere Personen ohne ausdrückliche Bestätigung.`;

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
  const res = await askIntern(opts);
  store.archiviere({
    typ: "gespraech",
    kanal: opts?.channel || "web",
    frage: `${opts?.image ? "📷 " : ""}${String(opts?.text || "")}`.trim().slice(0, 2000),
    antwort: String(res?.answer || "").slice(0, 4000),
    ...(res?.actions?.length ? { aktionen: res.actions.filter((a) => typeof a === "string").slice(0, 8) } : {}),
  });
  return res;
}

async function askIntern({ text, channel = "web", image, mode = "normal", targetLang, keepHistory = true }) {
  const history = keepHistory ? store.getHistory(channel) : [];

  const userContent = [];
  if (image) userContent.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
  userContent.push({ type: "text", text: text || "Was siehst du auf diesem Bild?" });

  // Im Verlauf stehen nur reine Text-Paare. Innerhalb einer Anfrage bleibt alles vollständig.
  const messages = [...history, { role: "user", content: userContent }];
  const actions = [];

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
  const model = brainModel(config.model);
  const sparen = model === SPAR_MODELL;
  for (let round = 0; round < 8; round++) {
    const params = {
      model,
      max_tokens: sparen ? 4000 : 16000,
      ...(sparen ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }),
      output_config: { effort: sparen ? "low" : config.effort },
      system: [
        { type: "text", text: PERSONA, cache_control: { type: "ephemeral" } },
        { type: "text", text: contextBlock({ channel, mode, targetLang }) },
      ],
      messages,
    };
    if (mode !== "translate") params.tools = sparen ? [...toolDefinitions] : [...toolDefinitions, WEB_SEARCH];
    let response;
    try {
      response = sparen ? await client.messages.create(params) : await client.beta.messages.create(params);
    } catch (err) {
      // Claude nicht erreichbar (Guthaben leer, falscher Schlüssel, kein Netz): Offline-Gehirn springt ein.
      const leer = isCreditError(err);
      if (leer) markEmpty();
      else console.error("Claude nicht erreichbar:", err.message);
      return notfall(leer);
    }
    recordUsage(response.model || model, response.usage, "chat");

    if (response.stop_reason === "refusal") {
      return finish("Dabei kann ich dir leider nicht helfen, Boss.");
    }

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "pause_turn") continue;

    const toolUses = response.content.filter((b) => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const answer = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      return finish(answer || "Erledigt, Boss.");
    }

    // Alle Werkzeuge ausführen und die Ergebnisse gemeinsam zurückgeben.
    const results = await Promise.all(
      toolUses.map(async (tool) => {
        actions.push(tool.name === "mac" ? `mac:${tool.input?.action}` : tool.name);
        try {
          const result = await runTool(tool.name, tool.input);
          if (result && Array.isArray(result.content)) return { type: "tool_result", tool_use_id: tool.id, content: result.content };
          const isError = Boolean(result && result.error);
          return { type: "tool_result", tool_use_id: tool.id, content: JSON.stringify(result ?? {}), is_error: isError };
        } catch (err) {
          return { type: "tool_result", tool_use_id: tool.id, content: `Fehler: ${err.message}`, is_error: true };
        }
      }),
    );
    messages.push({ role: "user", content: results });
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
    if (leer) return finish(`Mir geht die Energie aus, ${config.userName}. Mein Guthaben ist leer. Lade es auf console.anthropic.com auf und sag mir dann im Energie-Fenster, wie viel. Bis dahin laufen meine Offline-Befehle – sag einfach: Was kannst du?`);
    return finish(notfallText());
  }

  function finish(answer) {
    if (keepHistory) {
      const userText = image ? `[Foto] ${text || ""}`.trim() : text;
      store.saveHistory(channel, [...history, { role: "user", content: userText }, { role: "assistant", content: answer }]);
    }
    return { answer, actions };
  }
}
