// Nachrichten nach außen: Push aufs iPhone (ntfy) und Telegram.
import { config } from "./config.js";

export async function sendPush(title, message) {
  if (!config.ntfyTopic) return false;
  try {
    const res = await fetch(`${config.ntfyServer}/${encodeURIComponent(config.ntfyTopic)}`, {
      method: "POST",
      headers: { Title: encodeURIComponent(title), Tags: "robot", "Content-Type": "text/plain; charset=utf-8" },
      body: message,
    });
    return res.ok;
  } catch (err) {
    console.error("Push fehlgeschlagen:", err.message);
    return false;
  }
}

export async function sendTelegram(text, chatId = config.telegramChatId) {
  if (!config.telegramToken || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
    });
    return res.ok;
  } catch (err) {
    console.error("Telegram fehlgeschlagen:", err.message);
    return false;
  }
}

// Foto mit Text an Telegram (Kamera-Wache). Gibt false zurück, wenn Telegram fehlt oder es nicht klappt.
export async function sendTelegramPhoto(jpeg, caption = "", chatId = config.telegramChatId) {
  if (!config.telegramToken || !chatId || !jpeg?.length) return false;
  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", String(caption).slice(0, 1000));
    form.append("photo", new Blob([jpeg], { type: "image/jpeg" }), "friday-wache.jpg");
    const res = await fetch(`https://api.telegram.org/bot${config.telegramToken}/sendPhoto`, { method: "POST", body: form, signal: AbortSignal.timeout(20000) });
    return res.ok;
  } catch (err) {
    console.error("Telegram-Foto fehlgeschlagen:", err.message);
    return false;
  }
}

// Schickt eine Nachricht über alle eingerichteten Wege.
export async function notifyAll(title, message, { ohneTelegram = false } = {}) {
  const results = await Promise.all([sendPush(title, message), ohneTelegram ? false : sendTelegram(`${title}\n${message}`)]);
  return results.some(Boolean);
}
