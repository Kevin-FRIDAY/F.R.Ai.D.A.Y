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

// Schickt eine Nachricht über alle eingerichteten Wege.
export async function notifyAll(title, message) {
  const results = await Promise.all([sendPush(title, message), sendTelegram(`${title}\n${message}`)]);
  return results.some(Boolean);
}
