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

export async function startTelegram() {
  if (!config.telegramToken) return;
  console.log("Telegram-Bot aktiv");
  let offset = 0;
  while (true) {
    try {
      const res = await fetch(api(`getUpdates?timeout=50&offset=${offset}`)).then((r) => r.json());
      for (const update of res.result || []) {
        offset = update.update_id + 1;
        if (update.message) handle(update.message);
      }
    } catch (err) {
      console.error("Telegram-Verbindung:", err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
