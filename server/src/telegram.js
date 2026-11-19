// Telegram-Bot: Friday per Nachricht erreichen (auch Fotos).
// Antwortet nur dir (TELEGRAM_CHAT_ID), alle anderen werden ignoriert.
import { config } from "./config.js";
import { ask } from "./brain.js";
import { sendTelegram } from "./notify.js";
import * as store from "./store.js";

const api = (method) => `https://api.telegram.org/bot${config.telegramToken}/${method}`;

async function downloadPhoto(fileId) {
  const info = await fetch(api(`getFile?file_id=${encodeURIComponent(fileId)}`)).then((r) => r.json());
  if (!info.ok) return null;
  const res = await fetch(`https://api.telegram.org/file/bot${config.telegramToken}/${info.result.file_path}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mediaType: "image/jpeg" };
}

async function handle(message) {
  const chatId = String(message.chat.id);
  const text = message.text || message.caption || "";

  if (text.trim() === "/id") return sendTelegram(`Deine Chat-ID ist ${chatId}. Trag sie als TELEGRAM_CHAT_ID ein.`, chatId);
  if (chatId !== String(config.telegramChatId)) return; // Fremde ignorieren
  if (text.trim() === "/neu") {
    store.clearHistory("telegram");
    return sendTelegram("Neues Gespräch, Boss.", chatId);
  }

  let image;
  if (message.photo?.length) image = await downloadPhoto(message.photo.at(-1).file_id);
  if (!text && !image) return;

  try {
    const { answer } = await ask({ text, channel: "telegram", image });
    await sendTelegram(answer, chatId);
  } catch (err) {
    console.error("Telegram-Antwort fehlgeschlagen:", err.message);
    await sendTelegram("Da ist gerade etwas schiefgelaufen, Boss.", chatId);
  }
}

// Zustand für den System-Check: läuft der Bot, oder warum nicht?
export const telegramZustand = { aktiv: false, problem: "" };

// Ein echter Bot-Schlüssel sieht so aus: 123456789:AAH... (Zahl, Doppelpunkt, Buchstaben).
export function tokenSiehtGutAus(token = config.telegramToken) {
  return /^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(String(token || "").trim());
}

export async function startTelegram() {
  if (!config.telegramToken) return;
  if (!tokenSiehtGutAus()) {
    telegramZustand.problem = "Der Bot-Schlüssel in der .env ist ungültig (er braucht die Form 123456:ABC…). Starte „Telegram einrichten.command“.";
    console.error("Telegram aus: " + telegramZustand.problem);
    return;
  }
  console.log("Telegram-Bot aktiv");
  let offset = 0;
  let fehlerInFolge = 0;
  while (true) {
    try {
      const r = await fetch(api(`getUpdates?timeout=50&offset=${offset}`), { signal: AbortSignal.timeout(65000) });
      // 401/404 = Schlüssel falsch oder Bot gelöscht: nicht endlos weiter versuchen.
      if (r.status === 401 || r.status === 404) {
        telegramZustand.aktiv = false;
        telegramZustand.problem = "Telegram lehnt den Bot-Schlüssel ab (gelöscht oder falsch). Starte „Telegram einrichten.command“.";
        console.error("Telegram aus: " + telegramZustand.problem);
        return;
      }
      const res = await r.json();
      if (fehlerInFolge) console.log("Telegram wieder verbunden.");
      fehlerInFolge = 0;
      telegramZustand.aktiv = true;
      telegramZustand.problem = "";
      for (const update of res.result || []) {
        offset = update.update_id + 1;
        if (update.message) handle(update.message);
      }
      if (res.ok === false) await new Promise((ok) => setTimeout(ok, 5000));
    } catch (err) {
      fehlerInFolge++;
      telegramZustand.aktiv = false;
      telegramZustand.problem = "Keine Verbindung zu Telegram (Internet?).";
      // Nur den ersten Fehler und dann jeden 20. ins Protokoll schreiben, statt alle 5 Sekunden.
      if (fehlerInFolge === 1 || fehlerInFolge % 20 === 0) console.error(`Telegram-Verbindung: ${err.message}${fehlerInFolge > 1 ? ` (${fehlerInFolge}× in Folge)` : ""}`);
      // Langsam länger warten: 5 s, 10 s, 20 s … höchstens 2 Minuten.
      await new Promise((ok) => setTimeout(ok, Math.min(120000, 5000 * 2 ** Math.min(fehlerInFolge - 1, 5))));
    }
  }
}
