// Fridays Gehirn: redet mit Claude und benutzt die Werkzeuge.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { toolDefinitions, runTool } from "./tools.js";
import * as store from "./store.js";
import { isAgentOnline } from "./agent-hub.js";

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
- Mac-Aktionen gehen nur, wenn der Mac verbunden ist. Wenn nicht, sag es kurz.
- Lösche, kaufe oder verschicke nie etwas an andere Personen ohne ausdrückliche Bestätigung.`;

const WEB_SEARCH = { type: "web_search_20260209", name: "web_search", max_uses: 3 };

function contextBlock(extra = {}) {
  const now = new Date().toLocaleString("de-DE", { timeZone: config.timezone, dateStyle: "full", timeStyle: "short" });
  const isoLocal = new Date().toLocaleString("sv-SE", { timeZone: config.timezone }).replace(" ", "T").slice(0, 16);
  const memories = store.getMemories().map((m) => `- ${m.text}`).join("\n") || "(noch nichts)";
  let text = `Aktuelle Zeit: ${now} (${isoLocal}, Zeitzone ${config.timezone}). Heimatstadt: ${config.city}.
Mac verbunden: ${isoAgentText()}.
Kanal: ${extra.channel || "web"}.

Was du über ${config.userName} weißt:
${memories}`;
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
export async function ask({ text, channel = "web", image, mode = "normal", targetLang, keepHistory = true }) {
  const history = keepHistory ? store.getHistory(channel) : [];

  const userContent = [];
  if (image) userContent.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
  userContent.push({ type: "text", text: text || "Was siehst du auf diesem Bild?" });

  // Im Verlauf stehen nur reine Text-Paare. Innerhalb einer Anfrage bleibt alles vollständig.
  const messages = [...history, { role: "user", content: userContent }];
  const actions = [];

  for (let round = 0; round < 8; round++) {
    const params = {
      model: config.model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: config.effort },
      system: [
        { type: "text", text: PERSONA, cache_control: { type: "ephemeral" } },
        { type: "text", text: contextBlock({ channel, mode, targetLang }) },
      ],
      messages,
    };
    if (mode !== "translate") params.tools = [...toolDefinitions, WEB_SEARCH];
    const response = await client.beta.messages.create(params);

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

  function finish(answer) {
    if (keepHistory) {
      const userText = image ? `[Foto] ${text || ""}`.trim() : text;
      store.saveHistory(channel, [...history, { role: "user", content: userText }, { role: "assistant", content: answer }]);
    }
    return { answer, actions };
  }
}
