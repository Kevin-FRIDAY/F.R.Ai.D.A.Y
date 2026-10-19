// Passwortschutz: Ohne gültiges Passwort kommt niemand an Friday (und an deine API-Kosten).
import crypto from "node:crypto";
import { config } from "./config.js";

const SESSION_DAYS = 30;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(String(password), salt, 64);
  const real = Buffer.from(hash, "hex");
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

function sign(payload) {
  return crypto.createHmac("sha256", config.sessionSecret).update(payload).digest("base64url");
}

export function createToken() {
  const expires = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  const payload = `v1.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
  return Number(parts[1]) > Date.now();
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function tokenFromRequest(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)friday_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function requireAuth(req, res, next) {
  if (verifyToken(tokenFromRequest(req))) return next();
  res.status(401).json({ error: "Nicht angemeldet" });
}

// Für Kurzbefehle: Anmelde-Token ODER der feste Kurzbefehl-Schlüssel.
export function requireShortcutOrAuth(req, res, next) {
  const token = tokenFromRequest(req);
  if (verifyToken(token) || safeEqual(token, config.shortcutToken)) return next();
  res.status(401).type("text/plain").send("Falscher Schlüssel");
}

// Bremse gegen Passwort-Raten: max. 5 Fehlversuche pro 15 Minuten und IP.
const attempts = new Map();

export function loginAllowed(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.first > 15 * 60 * 1000) return true;
  return entry.count < 5;
}

export function recordFailure(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.first > 15 * 60 * 1000) attempts.set(ip, { first: now, count: 1 });
  else entry.count += 1;
}

export function clearFailures(ip) {
  attempts.delete(ip);
}
