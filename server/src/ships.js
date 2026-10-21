// Live-Schiffsverfolgung über aisstream.io (WebSocket). Braucht einen kostenlosen Schlüssel.
import WebSocket from "ws";
import { config } from "./config.js";
import { REGIONS } from "./lagezentrum.js";

const vessels = new Map(); // MMSI -> { mmsi, name, lat, lon, sog, cog, type, dest, laenge, at }
let ws = null;
let connected = false;
let retry = 0;

// Schiffstyp-Code (AIS) grob auf Deutsch.
function shipType(t) {
  if (t == null) return "";
  if (t >= 70 && t <= 79) return "Frachter";
  if (t >= 80 && t <= 89) return "Tanker";
  if (t >= 60 && t <= 69) return "Passagierschiff";
  if (t >= 40 && t <= 49) return "Schnellboot";
  if (t >= 50 && t <= 59) return "Spezialschiff";
  if (t >= 30 && t <= 39) return "Fischerei/Schlepper";
  return "Schiff";
}

// Bounding-Boxen (aisstream erwartet [[latNW, lonNW],[latSE, lonSE]]) rund um die Brennpunkte.
function boxes() {
  const out = [];
  for (const r of REGIONS) {
    if (r.id === "welt") continue;
    const d = 7;
    out.push([[r.lat + d, r.lon - d], [r.lat - d, r.lon + d]]);
  }
  return out;
}

export function startShips() {
  if (!config.aisKey) return; // kein Schlüssel, keine Schiffe
  connect();
  setInterval(prune, 60 * 1000);
}

function connect() {
  try {
    ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
  } catch (err) {
    return scheduleReconnect();
  }
  ws.on("open", () => {
    connected = true; retry = 0;
    ws.send(JSON.stringify({
      APIKey: config.aisKey,
      BoundingBoxes: boxes(),
      FilterMessageTypes: ["PositionReport", "ShipStaticData"],
    }));
    console.log("AIS (Schiffe) verbunden.");
  });
  ws.on("message", (buf) => {
    let msg; try { msg = JSON.parse(buf.toString()); } catch { return; }
    const meta = msg.MetaData || {};
    const mmsi = meta.MMSI || meta.MMSI_String;
    if (!mmsi) return;
    const cur = vessels.get(mmsi) || { mmsi };
    if (msg.MessageType === "PositionReport") {
      const p = msg.Message?.PositionReport || {};
      cur.lat = p.Latitude; cur.lon = p.Longitude;
      cur.sog = p.Sog; cur.cog = p.Cog;
      cur.name = (meta.ShipName || cur.name || "").trim();
      cur.at = Date.now();
    } else if (msg.MessageType === "ShipStaticData") {
      const d = msg.Message?.ShipStaticData || {};
      cur.name = (d.Name || meta.ShipName || cur.name || "").trim();
      cur.type = shipType(d.Type);
      cur.dest = (d.Destination || "").trim();
      const dim = d.Dimension || {};
      if (dim.A || dim.B) cur.laenge = (dim.A || 0) + (dim.B || 0);
    }
    if (cur.lat != null) vessels.set(mmsi, cur);
  });
  ws.on("close", () => { connected = false; scheduleReconnect(); });
  ws.on("error", () => { try { ws.close(); } catch { /* egal */ } });
}

function scheduleReconnect() {
  retry = Math.min(retry + 1, 6);
  setTimeout(connect, 2000 * retry);
}

function prune() {
  const grenze = Date.now() - 60 * 60 * 1000; // 1 Stunde
  for (const [k, v] of vessels) if (v.at < grenze) vessels.delete(k);
}

// Schiffe in einem Bereich (lonMin,latMin,lonMax,latMax), neueste zuerst.
export function getShips(lonMin, latMin, lonMax, latMax, limit = 80) {
  const out = [];
  for (const v of vessels.values()) {
    if (v.lat == null || v.lat < latMin || v.lat > latMax || v.lon < lonMin || v.lon > lonMax) continue;
    out.push({
      mmsi: v.mmsi, name: v.name || "Unbekannt", lat: v.lat, lon: v.lon,
      tempo_kn: v.sog != null ? Math.round(v.sog * 10) / 10 : null,
      kurs: v.cog != null ? Math.round(v.cog) : null,
      typ: v.type || "Schiff", ziel: v.dest || "", laenge_m: v.laenge || null,
    });
  }
  out.sort((a, b) => (b.laenge_m || 0) - (a.laenge_m || 0));
  return out.slice(0, limit);
}

export function shipsStatus() {
  return { aktiv: Boolean(config.aisKey), verbunden: connected, schiffe: vessels.size };
}
