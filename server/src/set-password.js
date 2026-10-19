// Setzt dein Friday-Passwort. Aufruf: npm run passwort
// Das Passwort wird nur als Hash in der .env gespeichert, nie im Klartext.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { ROOT } from "./config.js";
import { hashPassword } from "./auth.js";

// Im Terminal: unsichtbare Eingabe. Sonst (z. B. Skript): Zeile für Zeile lesen.
const lines = process.stdin.isTTY ? null : readline.createInterface({ input: process.stdin })[Symbol.asyncIterator]();

function askHidden(question) {
  process.stdout.write(question);
  if (lines) return lines.next().then((r) => r.value ?? "");
  return new Promise((resolve) => {
    let input = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(input);
      } else if (ch === "\u0003") {
        process.exit(1);
      } else if (ch === "\u007f" || ch === "\b") {
        input = input.slice(0, -1);
      } else {
        input += ch;
      }
    };
    process.stdin.on("data", onData);
  });
}

const pw1 = await askHidden("Neues Friday-Passwort (mind. 10 Zeichen, du siehst beim Tippen nichts): ");
const pw2 = await askHidden("Nochmal zur Bestätigung: ");

if (pw1 !== pw2) {
  console.error("Die Passwörter stimmen nicht überein.");
  process.exit(1);
}
if (pw1.length < 10) {
  console.error("Bitte mindestens 10 Zeichen.");
  process.exit(1);
}

const envPath = path.join(ROOT, ".env");
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
const line = `PASSWORD_HASH=${hashPassword(pw1)}`;
env = /^PASSWORD_HASH=.*$/m.test(env) ? env.replace(/^PASSWORD_HASH=.*$/m, line) : `${env}\n${line}\n`;
fs.writeFileSync(envPath, env, { mode: 0o600 });
console.log("Passwort gespeichert. Starte Friday neu, damit es gilt.");
process.exit(0);
