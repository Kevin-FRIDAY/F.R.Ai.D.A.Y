// Fridays Tresor (v1.178.0, Mark XII Punkt 19 "Verschlüsselung"): verschlüsselt geheime Werte
// (z. B. API-Schlüssel für ChatGPT, Gemini, DeepSeek, Grok), bevor sie auf die Festplatte geschrieben werden.
//
// Verfahren: AES-256-GCM (Standard, mit Manipulationsschutz). Der Schlüssel wird mit scrypt aus dem
// SESSION_SECRET der .env abgeleitet – er liegt also nie neben den Daten. Wer nur den data-Ordner
// (oder eine Sicherung davon) in die Hände bekommt, kann die Schlüssel darin nicht lesen.
// Wichtig: Wird SESSION_SECRET geändert, lassen sich alte Tresor-Werte nicht mehr öffnen (dann neu eintragen).
import crypto from "node:crypto";
import { config } from "./config.js";

const PREFIX = "enc:v1:";
let schluessel = null;
let schluesselVon = "";

function key() {
  const geheim = String(config.sessionSecret || process.env.SESSION_SECRET || "");
  if (!geheim) throw new Error("Kein SESSION_SECRET – der Tresor kann nicht verschlüsseln.");
  if (!schluessel || schluesselVon !== geheim) {
    schluessel = crypto.scryptSync(geheim, "friday-tresor-v1", 32);
    schluesselVon = geheim;
  }
  return schluessel;
}

export const istVerschluesselt = (wert) => typeof wert === "string" && wert.startsWith(PREFIX);

/** Klartext → "enc:v1:…" (leere Werte bleiben leer). */
export function verschluessele(klartext) {
  const t = String(klartext ?? "");
  if (!t) return "";
  if (istVerschluesselt(t)) return t;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const daten = Buffer.concat([c.update(t, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${daten.toString("base64url")}`;
}

/** "enc:v1:…" → Klartext. Unverschlüsselte (alte) Werte kommen unverändert zurück. Bei Manipulation: "". */
export function entschluessele(wert) {
  const t = String(wert ?? "");
  if (!istVerschluesselt(t)) return t;
  try {
    const [iv, tag, daten] = t.slice(PREFIX.length).split(":");
    const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(daten, "base64url")), d.final()]).toString("utf8");
  } catch {
    return "";
  }
}

/** Selbsttest für die Funktionsprüfung: echt verschlüsseln, entschlüsseln und Manipulation erkennen. */
export function selbstTest() {
  const probe = `friday-${crypto.randomBytes(6).toString("hex")}`;
  const v = verschluessele(probe);
  if (v.includes(probe)) return { ok: false, text: "Klartext steht im verschlüsselten Wert." };
  if (entschluessele(v) !== probe) return { ok: false, text: "Entschlüsseln liefert nicht den Originalwert." };
  const kaputt = v.slice(0, -2) + (v.endsWith("A") ? "B" : "A") + v.slice(-1);
  if (entschluessele(kaputt) === probe) return { ok: false, text: "Manipulation wurde nicht erkannt." };
  return { ok: true, text: "AES-256-GCM: verschlüsselt, entschlüsselt, Manipulation erkannt." };
}
