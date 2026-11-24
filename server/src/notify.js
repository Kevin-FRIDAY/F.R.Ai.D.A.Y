// Nachrichten nach außen: Push aufs iPhone (ntfy) und Telegram.
import { config } from "./config.js";

export async function sendPush(title, message, { dringend = false } = {}) {
  if (!config.ntfyTopic) return false;
  try {
    const res = await fetch(`${config.ntfyServer}/${encodeURIComponent(config.ntfyTopic)}`, {
      method: "POST",
      headers: { Title: encodeURIComponent(title), Tags: dringend ? "rotating_light" : "robot", ...(dringend ? { Priority: "5" } : {}), "Content-Type": "text/plain; charset=utf-8" },
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
// art (v1.161.0 Weckruf): alarm, termin, aufgabe, mission, erinnerung, unwetter, friday, system, markt.
// Ist die Meldung nach Kevins Regeln wichtig genug, klingelt zusätzlich das iPhone (Pushover/ntfy dringend)
// oder Friday ruft echt an (Twilio). Ohne art bleibt alles wie bisher.
export async function notifyAll(title, message, { ohneTelegram = false, art, wichtig, erzwingen } = {}) {
  let w = null, laut = null;
  if (art) {
    try {
      w = await import("./weckruf.js");
      laut = w.entscheide(art, { titel: title, text: message, wichtig, erzwingen });
    } catch (err) { console.error("Weckruf:", err.message); }
  }
  // Ohne Pushover macht ntfy selbst den lauten Teil (Priorität 5).
  const ntfyLaut = Boolean(laut && !w.pushoverBereit());
  const results = await Promise.all([sendPush(title, message, { dringend: ntfyLaut }), ohneTelegram ? false : sendTelegram(`${title}\n${message}`)]);
  let geweckt = false;
  if (laut) {
    try { geweckt = (await w.wecken(laut, title, message, { ntfySchonLaut: ntfyLaut && results[0] })).ok; } catch (err) { console.error("Weckruf:", err.message); }
  }
  return results.some(Boolean) || geweckt;
}
