// Verbindung zum Mac-Agenten über WebSocket.
// Der Mac meldet sich mit AGENT_TOKEN an; der Server schickt Befehle, der Mac antwortet.
import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { safeEqual } from "./auth.js";

let agentSocket = null;
let agentInfo = null;
const pending = new Map();

export function isAgentOnline() {
  return Boolean(agentSocket && agentSocket.readyState === 1);
}

export function getAgentInfo() {
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
