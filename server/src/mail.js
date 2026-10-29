// F.R.Ai.D.A.Y iCloud-Mail: lesen + sortieren über IMAP (imapflow).
// Zugang per App-spezifischem Passwort (appleid.apple.com), in .env.
import { ImapFlow } from "imapflow";
import { config } from "./config.js";
import * as store from "./store.js";

const HOST = "imap.mail.me.com";
const PORT = 993;

export function mailConfigured() {
  return Boolean(config.icloudMail && config.icloudPass);
}

function newClient() {
  return new ImapFlow({
    host: HOST, port: PORT, secure: true,
    auth: { user: config.icloudMail, pass: config.icloudPass },
    logger: false,
    emitLogs: false,
  });
}

let overviewCache = null;

// Übersicht: ungelesen/gesamt + die letzten Nachrichten (Absender, Betreff, Datum).
export async function getMailOverview(force = false) {
  if (!mailConfigured()) return { ok: false, grund: "nicht_verbunden" };
  if (!force && overviewCache && Date.now() - overviewCache.at < 60 * 1000) return overviewCache.data;
  const client = newClient();
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", { messages: true, unseen: true });
      const total = status.messages || 0;
      const nachrichten = [];
      if (total > 0) {
        const from = Math.max(1, total - 24);
        for await (const msg of client.fetch(`${from}:*`, { envelope: true, flags: true })) {
          const f = msg.envelope?.from?.[0];
          nachrichten.push({
            von: f ? (f.name || f.address || "") : "",
            vonMail: f ? f.address || "" : "",
            betreff: msg.envelope?.subject || "(kein Betreff)",
            datum: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : "",
            gelesen: msg.flags ? msg.flags.has("\\Seen") : true,
          });
        }
        nachrichten.reverse();
      }
      const data = { ok: true, email: config.icloudMail, ungelesen: status.unseen || 0, gesamt: total, nachrichten: nachrichten.slice(0, 25) };
      overviewCache = { at: Date.now(), data };
      return data;
    } finally { lock.release(); }
  } catch (err) {
    return { ok: false, grund: "fehler", fehler: friendlyMailError(err) };
  } finally {
    try { await client.logout(); } catch { /* egal */ }
  }
}

// Sortieren: Newsletter/Werbung (Header List-Unsubscribe) aus dem Posteingang
// in den Ordner "Newsletter" verschieben. Nichts wird gelöscht.
export async function sortMail() {
  if (!mailConfigured()) return { ok: false, grund: "nicht_verbunden" };
  const client = newClient();
  try {
    await client.connect();
    try { await client.mailboxCreate("Newsletter"); } catch { /* existiert schon */ }
    const lock = await client.getMailboxLock("INBOX");
    let verschoben = 0;
    try {
      const status = await client.status("INBOX", { messages: true });
      const total = status.messages || 0;
      if (total > 0) {
        const from = Math.max(1, total - 199); // letzte ~200 Mails prüfen
        const toMove = [];
        for await (const msg of client.fetch(`${from}:*`, { uid: true, headers: ["list-unsubscribe"] })) {
          const hdr = msg.headers ? msg.headers.toString() : "";
          if (/list-unsubscribe/i.test(hdr)) toMove.push(msg.uid);
        }
        if (toMove.length) {
          await client.messageMove(toMove, "Newsletter", { uid: true });
          verschoben = toMove.length;
        }
      }
    } finally { lock.release(); }
    overviewCache = null;
    if (verschoben) store.logActivity("mail", `${verschoben} Newsletter sortiert`);
    return { ok: true, verschoben };
  } catch (err) {
    return { ok: false, grund: "fehler", fehler: friendlyMailError(err) };
  } finally {
    try { await client.logout(); } catch { /* egal */ }
  }
}

function friendlyMailError(err) {
  const m = String(err?.message || err || "");
  if (/auth/i.test(m) || /login/i.test(m) || /credentials/i.test(m)) return "Anmeldung fehlgeschlagen – App-Passwort prüfen.";
  if (/timeout|ETIMEDOUT|ECONN/i.test(m)) return "Keine Verbindung zu iCloud.";
  return "Mail-Fehler.";
}
