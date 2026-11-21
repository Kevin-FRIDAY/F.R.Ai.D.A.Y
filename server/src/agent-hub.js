// Verbindung zum Mac-Agenten über WebSocket.
// Der Mac meldet sich mit AGENT_TOKEN an; der Server schickt Befehle, der Mac antwortet.
import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import { config, IST_EVE } from "./config.js";
import { safeEqual } from "./auth.js";

let agentSocket = null;
let agentInfo = null;
const pending = new Map();

// Eve (v1.139.0): Eve hat keinen eigenen Mac-Agenten. Zum LESEN (Kalender, Fotos, Kurzbefehle-Liste …) fragt sie
// über die Prozess-Leitung bei Friday nach. Alles, was am Mac etwas tut, bleibt in Eve gesperrt.
export const EVE_LESEN = new Set([
  "system_info", "battery", "kalender_termine", "kalender_namen", "erinnerungen_liste", "notizen_liste", "notizen_suchen", "notiz_lesen",
  "kontakte_suchen", "kontakte_geburtstage", "musik_status", "musik_playlists", "fotos_info", "kurzbefehle_liste", "cloud_ordner",
]);
let eltern = { online: false, info: null };
const evePending = new Map();
if (IST_EVE && process.send) {
  process.on("message", (m) => {
    if (m?.typ === "agent_status") eltern = { online: Boolean(m.online), info: m.info || null };
    else if (m?.typ === "agent_antwort" && evePending.has(m.id)) {
      const p = evePending.get(m.id);
      evePending.delete(m.id);
      clearTimeout(p.timer);
      p.resolve(m.antwort || { ok: false, error: "Keine Antwort vom Mac." });
    }
  });
}
function eveFragtFriday(action, params, timeoutMs) {
  if (!EVE_LESEN.has(action)) return Promise.resolve({ ok: false, eve_gesperrt: true, error: "Eve-Test: Am Mac wird in Eve nichts ausgelöst. In Friday klappt es echt." });
  if (!eltern.online || !process.send) return Promise.resolve({ ok: false, error: "Der Mac ist gerade nicht verbunden." });
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => { evePending.delete(id); resolve({ ok: false, error: "Der Mac hat nicht rechtzeitig geantwortet." }); }, timeoutMs + 2000);
    evePending.set(id, { resolve, timer });
    try { process.send({ typ: "agent_lesen", id, action, params, timeoutMs }); } catch { clearTimeout(timer); evePending.delete(id); resolve({ ok: false, error: "Der Mac ist gerade nicht verbunden." }); }
  });
}

export function isAgentOnline() {
  if (IST_EVE) return eltern.online;
  return Boolean(agentSocket && agentSocket.readyState === 1);
}

export function getAgentInfo() {
  if (IST_EVE) return eltern.online ? eltern.info : null;
  return isAgentOnline() ? agentInfo : null;
}

export function attachAgentHub(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 15 * 1024 * 1024 });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/agent") return socket.destroy();
    const token = req.headers["x-agent-token"];
    if (!safeEqual(token, config.agentToken)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });

  wss.on("connection", (ws) => {
    if (agentSocket) agentSocket.close(4000, "Neuer Agent verbunden");
    agentSocket = ws;
    agentInfo = { connected: new Date().toISOString() };
    console.log("Mac-Agent verbunden");

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === "hello") agentInfo = { ...agentInfo, name: String(msg.name || "Mac").slice(0, 60) };
      if (msg.type === "result" && pending.has(msg.id)) {
        const { resolve, timer } = pending.get(msg.id);
        clearTimeout(timer);
        pending.delete(msg.id);
        const { type, id, ...result } = msg;
        resolve(result);
      }
    });

    ws.on("close", () => {
      if (agentSocket === ws) {
        agentSocket = null;
        console.log("Mac-Agent getrennt");
      }
    });

    // Verbindung am Leben halten
    const ping = setInterval(() => (ws.readyState === 1 ? ws.ping() : clearInterval(ping)), 30000);
  });
}

// Schickt einen Befehl an den Mac und wartet auf die Antwort.
export function sendToAgent(action, params = {}, timeoutMs = 20000) {
  if (IST_EVE) return eveFragtFriday(action, params, timeoutMs);
  if (!isAgentOnline()) return Promise.resolve({ ok: false, error: "Der Mac ist gerade nicht verbunden." });
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ ok: false, error: "Der Mac hat nicht rechtzeitig geantwortet." });
    }, timeoutMs);
    pending.set(id, { resolve, timer });
    agentSocket.send(JSON.stringify({ type: "command", id, action, params }));
  });
}
