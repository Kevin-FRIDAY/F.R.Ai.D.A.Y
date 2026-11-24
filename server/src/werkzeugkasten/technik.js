// Technik & Computer.
import tls from "node:tls";
import { nr, zahl, text, de, dauerText } from "./hilfe.js";

const G = "Technik & Computer";

// ---------- Farben ----------
function farbe(s) {
  const t = String(s || "").trim().toLowerCase();
  let m = t.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) { let h = m[1]; if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
  m = t.match(/^rgb\(?\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?$/) || t.match(/^(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})$/);
  if (m) return m.slice(1, 4).map((x) => Math.min(255, +x));
  m = t.match(/^hsl\(?\s*(\d{1,3}(?:\.\d+)?)[\s,]+(\d{1,3}(?:\.\d+)?)%?[\s,]+(\d{1,3}(?:\.\d+)?)%?\s*\)?$/);
  if (m) return hslZuRgb(+m[1], +m[2], +m[3]);
  return null;
}
function rgbZuHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2; let h = 0, s = 0;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
function hslZuRgb(h, s, l) {
  s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))));
}
const hex = (rgb) => "#" + rgb.map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
function pflichtFarbe(e, k, label) { const f = farbe(e?.[k]); if (!f) throw new Error(`Bitte gib ${label} als Farbe an, z. B. #FF8A00.`); return f; }

// ---------- CSV ----------
function csvLesen(s) {
  const erste = s.split("\n")[0], trenner = [";", ",", "\t"].sort((a, b) => erste.split(b).length - erste.split(a).length)[0];
  const zeilen = []; let feld = "", zeile = [], q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { feld += '"'; i++; } else if (c === '"') q = false; else feld += c; }
    else if (c === '"') q = true; else if (c === trenner) { zeile.push(feld); feld = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ""; } else feld += c;
  }
  if (feld || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  return { zeilen: zeilen.filter((z) => z.some((f) => f.trim())), trenner };
}

// ---------- Cron ----------
const WT = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const MO = ["", "Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
function cronFeld(f, name, namen) {
  if (f === "*") return null;
  const teile = f.split(",").map((t) => {
    let m = t.match(/^\*\/(\d+)$/); if (m) return `jede ${m[1]}. ${name}`;
    m = t.match(/^(\d+)-(\d+)(?:\/(\d+))?$/); if (m) return `${namen ? namen[+m[1]] : m[1]} bis ${namen ? namen[+m[2]] : m[2]}${m[3] ? ` (alle ${m[3]})` : ""}`;
    if (/^\d+$/.test(t)) return namen ? namen[+t] : t;
    throw new Error(`„${t}“ verstehe ich im Cron-Ausdruck nicht.`);
  });
  return teile.join(", ");
}

export default [
  {
    id: "json_formatieren", titel: "JSON prüfen & formatieren", icon: "🧩", gruppe: G,
    info: "JSON schön einrücken, verkleinern oder Fehler finden.",
    felder: [{ k: "json", label: "JSON", typ: "textarea" }, { k: "art", label: "Ausgabe", typ: "wahl", optionen: ["schön eingerückt", "verkleinert", "Schlüssel sortiert"], standard: "schön eingerückt" }],
    run(e) {
      const s = text(e, "json", "JSON", { max: 2000000 });
      let d;
      try { d = JSON.parse(s); } catch (err) {
        const pos = Number(String(err.message).match(/position (\d+)/)?.[1]);
        const zeile = Number.isFinite(pos) ? s.slice(0, pos).split("\n").length : null;
        throw new Error(`Das ist kein gültiges JSON${zeile ? ` (Fehler in Zeile ${zeile})` : ""}: ${err.message}`);
      }
      const sortiert = (x) => (Array.isArray(x) ? x.map(sortiert) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sortiert(x[k])])) : x);
      const r = e.art === "verkleinert" ? JSON.stringify(d) : JSON.stringify(e.art === "Schlüssel sortiert" ? sortiert(d) : d, null, 2);
      return { text: `Gültiges JSON${Array.isArray(d) ? ` mit ${d.length} Einträgen` : d && typeof d === "object" ? ` mit ${Object.keys(d).length} Schlüsseln` : ""}.`, ergebnis: r };
    },
  },
  {
    id: "csv_json", titel: "CSV ↔ JSON", icon: "🔄", gruppe: G,
    info: "Wandelt CSV-Tabellen in JSON um und zurück (erkennt ; , und Tab).",
    felder: [{ k: "daten", label: "CSV oder JSON", typ: "textarea" }],
    run(e) {
      const s = text(e, "daten", "die Daten", { max: 2000000 });
      if (/^\s*[[{]/.test(s)) {
        let d; try { d = JSON.parse(s); } catch (err) { throw new Error(`Kein gültiges JSON: ${err.message}`); }
        if (!Array.isArray(d)) d = [d];
        const kopf = [...new Set(d.flatMap((o) => Object.keys(o || {})))];
        const zelle = (v) => { const t = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
        const csv = [kopf.join(";"), ...d.map((o) => kopf.map((k) => zelle(o?.[k])).join(";"))].join("\n");
        return { text: `${d.length} Zeilen als CSV (mit Semikolon, passt für deutsches Excel und Numbers).`, ergebnis: csv, datei: { name: "daten.csv", typ: "text/csv", inhalt: "﻿" + csv } };
      }
      const { zeilen, trenner } = csvLesen(s);
      if (zeilen.length < 2) throw new Error("Die CSV braucht eine Kopfzeile und mindestens eine Datenzeile.");
      const [kopf, ...rest] = zeilen;
      const json = rest.map((z) => Object.fromEntries(kopf.map((k, i) => { const v = (z[i] ?? "").trim(); const n = nr(v); return [k.trim() || `spalte${i + 1}`, v === "" ? null : n != null && /^-?[\d.,]+$/.test(v) ? n : v]; })));
      return { text: `${json.length} Zeilen mit ${kopf.length} Spalten in JSON umgewandelt (Trennzeichen „${trenner === "\t" ? "Tab" : trenner}“).`, ergebnis: JSON.stringify(json, null, 2) };
    },
  },
  {
    id: "zahlensystem", titel: "Zahlensysteme", icon: "💻", gruppe: G,
    info: "Dezimal, Binär, Hexadezimal und Oktal umrechnen.",
    felder: [{ k: "wert", label: "Zahl", typ: "text", platzhalter: "255, 0xFF, 0b1010" }, { k: "basis", label: "Eingabe ist …", typ: "wahl", optionen: ["automatisch", "dezimal", "binär", "hexadezimal", "oktal"], standard: "automatisch" }],
    sprache: [[/^(\d+) (?:in|als|zu) (binär|hex|hexadezimal|oktal)(?:zahl)?$/, (m) => ({ wert: m[1], basis: "dezimal" })]],
    run(e) {
      let s = text(e, "wert", "eine Zahl", { max: 200 }).toLowerCase().replace(/[\s_]/g, ""), b = { dezimal: 10, binär: 2, hexadezimal: 16, oktal: 8 }[e.basis] || 0;
      if (!b) { if (s.startsWith("0x")) { b = 16; s = s.slice(2); } else if (s.startsWith("0b")) { b = 2; s = s.slice(2); } else if (s.startsWith("0o")) { b = 8; s = s.slice(2); } else b = /[a-f]/.test(s) ? 16 : 10; }
      else s = s.replace(/^0[xbo]/, "");
      const gueltig = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[0-9a-f]+$/ }[b];
      if (!gueltig.test(s)) throw new Error("Diese Zahl passt nicht zum gewählten Zahlensystem.");
      const n = BigInt(b === 10 ? s : `0${{ 2: "b", 8: "o", 16: "x" }[b]}${s}`);
      return { text: `Dezimal ${n.toString(10)}, binär ${n.toString(2)}, hexadezimal ${n.toString(16).toUpperCase()}.`, tabelle: { kopf: ["System", "Wert"], zeilen: [["Dezimal", n.toString(10)], ["Binär", n.toString(2)], ["Hexadezimal", n.toString(16).toUpperCase()], ["Oktal", n.toString(8)]] } };
    },
  },
  {
    id: "farbe_umrechnen", titel: "Farbcodes umrechnen", icon: "🎨", gruppe: G,
    info: "HEX, RGB und HSL ineinander umrechnen.",
    felder: [{ k: "farbe", label: "Farbe (#FF8A00, rgb(255,138,0), hsl(32,100,50))", typ: "text" }],
    run(e) {
      const rgb = pflichtFarbe(e, "farbe", "eine Farbe"), [h, s, l] = rgbZuHsl(rgb);
      return { text: `HEX ${hex(rgb)}, RGB ${rgb.join(", ")}, HSL ${h}°, ${s} %, ${l} %.`, farben: [hex(rgb)], tabelle: { kopf: ["Format", "Wert"], zeilen: [["HEX", hex(rgb)], ["RGB", `rgb(${rgb.join(", ")})`], ["HSL", `hsl(${h}, ${s}%, ${l}%)`]] } };
    },
  },
  {
    id: "farbpalette", titel: "Farbpalette", icon: "🌈", gruppe: G,
    info: "Passende Farben zu einer Grundfarbe: Komplementär, Analog, Triade, Abstufungen.",
    felder: [{ k: "farbe", label: "Grundfarbe", typ: "text", standard: "#FF8A00" }, { k: "art", label: "Art", typ: "wahl", optionen: ["Abstufungen", "Komplementär", "Analog", "Triade", "Tetrade"], standard: "Abstufungen" }],
    run(e) {
      const rgb = pflichtFarbe(e, "farbe", "eine Grundfarbe"), [h, s, l] = rgbZuHsl(rgb), art = e.art || "Abstufungen";
      const dreh = { Komplementär: [0, 180], Analog: [-30, 0, 30], Triade: [0, 120, 240], Tetrade: [0, 90, 180, 270] }[art];
      const farben = dreh ? dreh.map((d) => hex(hslZuRgb((h + d + 360) % 360, s, l))) : [15, 30, 45, 60, 75, 90].map((x) => hex(hslZuRgb(h, s, x)));
      return { text: `Palette „${art}“: ${farben.join(", ")}.`, farben, zeigen: true };
    },
  },
  {
    id: "kontrast", titel: "Kontrast prüfen", icon: "◐", gruppe: G,
    info: "Ist Schrift auf diesem Hintergrund gut lesbar? (WCAG-Regeln)",
    felder: [{ k: "vorne", label: "Schriftfarbe", typ: "text", standard: "#FFFFFF" }, { k: "hinten", label: "Hintergrund", typ: "text", standard: "#FF8A00" }],
    run(e) {
      const a = pflichtFarbe(e, "vorne", "die Schriftfarbe"), b = pflichtFarbe(e, "hinten", "die Hintergrundfarbe");
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x), k = (hi + 0.05) / (lo + 0.05);
      const urteil = k >= 7 ? "sehr gut lesbar (AAA)" : k >= 4.5 ? "gut lesbar (AA)" : k >= 3 ? "nur für große Schrift ok" : "schlecht lesbar";
      return { text: `Kontrast ${de(k, 2)} zu 1: ${urteil}.`, farben: [hex(a), hex(b)] };
    },
  },
  {
    id: "subnetz", titel: "Subnetz-Rechner", icon: "🌐", gruppe: G,
    info: "IPv4-Netz aus CIDR: Netzadresse, Broadcast, Host-Bereich, Anzahl Geräte.",
    felder: [{ k: "netz", label: "IP/Präfix", typ: "text", platzhalter: "192.168.178.0/24" }],
    run(e) {
      const m = text(e, "netz", "ein Netz").match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
      if (!m || m.slice(1, 5).some((x) => +x > 255) || +m[5] > 32) throw new Error("Bitte im Format 192.168.178.0/24 eingeben.");
      const ip = m.slice(1, 5).reduce((a, x) => a * 256 + +x, 0), p = +m[5], maske = p ? (0xffffffff << (32 - p)) >>> 0 : 0;
      const netz = (ip & maske) >>> 0, bc = (netz | (~maske >>> 0)) >>> 0, ipS = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
      const hosts = p >= 31 ? 2 ** (32 - p) : 2 ** (32 - p) - 2;
      return { text: `Netz ${ipS(netz)}/${p} mit Platz für ${de(hosts, 0)} Geräte, von ${ipS(p >= 31 ? netz : netz + 1)} bis ${ipS(p >= 31 ? bc : bc - 1)}.`, tabelle: { kopf: ["", "Wert"], zeilen: [["Netzadresse", ipS(netz)], ["Subnetzmaske", ipS(maske)], ["Broadcast", ipS(bc)], ["Erste IP", ipS(p >= 31 ? netz : netz + 1)], ["Letzte IP", ipS(p >= 31 ? bc : bc - 1)], ["Geräte", de(hosts, 0)]] } };
    },
  },
  {
    id: "cron_erklaeren", titel: "Cron-Zeitplan erklären", icon: "⏰", gruppe: G,
    info: "Übersetzt einen Cron-Ausdruck (z. B. „30 7 * * 1-5“) in normales Deutsch.",
    felder: [{ k: "cron", label: "Cron-Ausdruck", typ: "text", platzhalter: "30 7 * * 1-5" }],
    run(e) {
      const f = text(e, "cron", "einen Cron-Ausdruck", { max: 200 }).split(/\s+/);
      if (f.length !== 5) throw new Error("Ein Cron-Ausdruck hat genau 5 Teile: Minute Stunde Tag Monat Wochentag.");
      const [mi, h, tag, mo, wt] = f;
      let zeit;
      if (/^\d+$/.test(mi) && /^\d+$/.test(h)) zeit = `um ${h}:${mi.padStart(2, "0")} Uhr`;
      else zeit = [mi === "*" ? "jede Minute" : `Minute ${cronFeld(mi, "Minute")}`, h === "*" ? "" : `in Stunde ${cronFeld(h, "Stunde")}`].filter(Boolean).join(" ");
      const teile = [zeit];
      if (tag !== "*") teile.push(`am ${cronFeld(tag, "Tag")}. Tag des Monats`);
      if (mo !== "*") teile.push(`im ${cronFeld(mo, "Monat", MO)}`);
      if (wt !== "*") teile.push(`nur ${cronFeld(wt, "Wochentag", WT)}`);
      if (tag === "*" && wt === "*") teile.push("jeden Tag");
      const s = teile.join(", ");
      return { text: s[0].toUpperCase() + s.slice(1) + "." };
    },
  },
  {
    id: "download_dauer", titel: "Download-Dauer", icon: "⬇️", gruppe: G,
    info: "Wie lange ein Download oder Upload bei deiner Leitung dauert.",
    felder: [{ k: "groesse", label: "Größe", typ: "zahl" }, { k: "einheit", label: "Einheit", typ: "wahl", optionen: ["MB", "GB", "TB"], standard: "GB" }, { k: "mbit", label: "Leitung Mbit/s", typ: "zahl", standard: "100" }],
    sprache: [[/^wie lange dauert (?:ein |der )?(?:download|upload|herunterladen)(?: von)? (\d+(?:,\d+)?) ?(mb|gb|tb|megabyte|gigabyte|terabyte)(?: (?:bei|mit) (\d+(?:,\d+)?) ?(?:mbit|mbits|mbit\/s|megabit))?$/, (m) => ({ groesse: m[1], einheit: m[2][0].toUpperCase() + "B", mbit: m[3] || 100 })]],
    run(e) {
      const g = zahl(e, "groesse", "die Größe", { min: 0 }), f = { MB: 1, GB: 1000, TB: 1e6 }[e.einheit || "GB"] || 1000, v = zahl(e, "mbit", "die Geschwindigkeit", { min: 0.01 });
      const sek = (g * f * 8) / v / 0.9;
      return { text: `${de(g)} ${e.einheit || "GB"} bei ${de(v)} Mbit/s dauern etwa ${sek < 60 ? `${Math.ceil(sek)} Sekunden` : dauerText(sek / 60)}.` };
    },
  },
  {
    id: "qr_code", grossKlein: true, titel: "QR-Code", icon: "🔳", gruppe: G,
    info: "QR-Code für Links, Text oder dein WLAN (zum Scannen mit dem Handy). Wird auf dem Gerät erzeugt, nichts geht ins Internet.",
    felder: [{ k: "art", label: "Art", typ: "wahl", optionen: ["Link oder Text", "WLAN"], standard: "Link oder Text" }, { k: "inhalt", label: "Link/Text (oder WLAN-Name)", typ: "textarea" }, { k: "wlan_passwort", label: "WLAN-Passwort (nur bei WLAN)", typ: "passwort" }],
    sprache: [[/^(?:mach|mache|erstell|erstelle|generier|generiere|gib)(?: mir)? (?:einen |ein )?qr[- ]?code (?:für|von|mit|zu) (.{2,300})$/, (m) => (/^(das |den |mein |unser |unseres? )?(gäste-?|gast-?)?(wlan|wifi)/i.test(m[1]) ? null : { inhalt: m[1] })]],
    run(e) {
      const inhalt = text(e, "inhalt", e.art === "WLAN" ? "den WLAN-Namen" : "einen Link oder Text", { max: 1500 });
      if (e.art === "WLAN") {
        const esc = (s) => String(s).replace(/([\\;,:"])/g, "\\$1"), pw = String(e.wlan_passwort || "");
        return { text: `Der WLAN-QR-Code für „${inhalt}“ ist fertig. Gäste scannen ihn mit der Kamera und sind sofort drin.`, qr: `WIFI:T:${pw ? "WPA" : "nopass"};S:${esc(inhalt)};${pw ? `P:${esc(pw)};` : ""};`, zeigen: true, geheimesErgebnis: true };
      }
      return { text: "Der QR-Code ist fertig. Du kannst ihn scannen oder als Bild speichern.", qr: inhalt, zeigen: true };
    },
  },
  {
    id: "webseite_pruefen", titel: "Webseite erreichbar?", icon: "🩺", gruppe: G,
    info: "Ist eine Seite online? Statuscode, Ladezeit und wie lange das SSL-Zertifikat noch gilt.",
    felder: [{ k: "url", label: "Adresse", typ: "text", platzhalter: "https://example.com" }],
    sprache: [[/^(?:ist|läuft|funktioniert) (?:die (?:seite|webseite|website) )?([a-z0-9][a-z0-9.-]+\.[a-z]{2,})(?:\/\S*)? (?:erreichbar|online|down|gerade down|noch online|gerade erreichbar)$/, (m) => ({ url: m[1] })]],
    async run(e) {
      let u = text(e, "url", "eine Adresse", { max: 500 });
      if (!/^https?:\/\//i.test(u)) u = "https://" + u;
      let url; try { url = new URL(u); } catch { throw new Error("Das ist keine gültige Adresse."); }
      if (!/^https?:$/.test(url.protocol)) throw new Error("Nur http- und https-Adressen.");
      const t0 = Date.now(); let r;
      try { r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(12000), headers: { "User-Agent": "Mozilla/5.0 Friday-Werkzeugkasten" } }); }
      catch (err) { return { text: `${url.hostname} ist gerade nicht erreichbar (${err.name === "TimeoutError" ? "keine Antwort nach 12 Sekunden" : err.cause?.code || err.message}).` }; }
      const ms = Date.now() - t0;
      let cert = "";
      if (url.protocol === "https:") {
        cert = await new Promise((ok) => {
          const s = tls.connect({ host: url.hostname, port: Number(url.port) || 443, servername: url.hostname, timeout: 8000 }, () => {
            const c = s.getPeerCertificate(); s.end();
            const tage = c?.valid_to ? Math.floor((new Date(c.valid_to) - Date.now()) / 86400000) : null;
            ok(tage == null ? "" : ` Das SSL-Zertifikat gilt noch ${tage} Tage${tage < 14 ? " – bald erneuern!" : ""}.`);
          });
          s.on("error", () => ok("")); s.on("timeout", () => { s.destroy(); ok(""); });
        });
      }
      return { text: `${url.hostname} ist ${r.ok ? "online" : "erreichbar, meldet aber einen Fehler"}: Status ${r.status}, Antwort nach ${ms < 1000 ? `${ms} Millisekunden` : `${de(ms / 1000, 1)} Sekunden`}.${r.redirected ? ` Weitergeleitet nach ${new URL(r.url).hostname}.` : ""}${cert}` };
    },
  },
];
