// Sicherheit & Privatsphäre. Passwörter werden nie gespeichert, nie ins Logbuch geschrieben und nie vorgelesen.
import crypto from "node:crypto";
import { nr, text, de } from "./hilfe.js";

const G = "Sicherheit";

const WOERTER = ("Abend Adler Ahorn Akku Anker Apfel Atlas Auge Bach Bagger Ball Banane Bank Bart Basis Baum Becher Beere Berg Besen Biber Biene Birne Blatt Blitz Blume Boden Bogen Boot Brille Brot Brunnen Buch Burg Butter "
  + "Dach Dampf Daumen Decke Delfin Drache Dschungel Dose Dorf Dusche Echo Efeu Eiche Eimer Eis Elch Engel Ente Erbse Erde Esel Eule Fabel Faden Falke Farbe Feder Feld Fenster Ferse Fest Feuer Fisch Flagge Flasche Flocke Floh Flur Flut Fohlen Form Fuchs Funke "
  + "Gabel Garten Gast Gecko Geige Geist Gipfel Glas Glocke Gold Gras Gurke Hafen Hahn Hammer Hand Harfe Hase Haus Hecht Heft Held Helm Hemd Herbst Herz Himmel Hirsch Hof Honig Horn Hose Hut Igel Insel Jacke Jaguar Joker Kabel Kaffee Kakao Kamel Kamm Kanu Karte Kater Kegel Kerze Kessel Kette Kiefer Kirsche Kiste Klee Knopf Koch Koffer Komet Korb Krake Kran Kranich Krone Kugel Kuh Kupfer Kurve "
  + "Lachs Lager Lampe Land Laterne Laub Leiter Lerche Licht Linde Locke Loewe Luchs Luft Lupe Magnet Mais Mantel Marder Markt Maske Maus Meer Melone Messer Milch Minze Mond Moos Motor Mowe Muschel Nabel Nadel Nebel Nest Netz Nuss Oase Ofen Ohr Onkel Orbit Orgel Otter Paddel Palme Panda Papier Pfeffer Pfeil Pferd Pilz Pinsel Pirat Planet Pol Pony Posaune Puma Puppe "
  + "Quelle Rabe Rad Rakete Rasen Raupe Regen Reh Reise Riese Ring Rock Rose Ruder Saft Salz Sand Sattel Schaf Schal Schiff Schild Schloss Schnee Schuh Schwan See Segel Seil Sessel Sichel Silber Sofa Sonne Spiegel Spinne Stahl Stern Stiefel Strand Strauss Strom Stuhl Sturm Tafel Tal Tanne Tasche Taube Tee Teich Teller Tiger Tinte Tisch Topf Turm "
  + "Uhr Ufer Ulme Vase Vogel Vulkan Waage Wagen Wal Wald Wand Wasser Watte Weide Welle Welt Wiese Wind Winter Wolf Wolke Wurm Wurzel Zahn Zange Zebra Zelt Ziege Zimmer Zitrone Zucker Zug Zwerg").split(" ");

const zufall = (n) => crypto.randomInt(n);
function staerke(pw) {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26; if (/[A-Z]/.test(pw)) pool += 26; if (/\d/.test(pw)) pool += 10; if (/[^a-zA-Z0-9]/.test(pw)) pool += 33; if (/[äöüÄÖÜß]/.test(pw)) pool += 7;
  let bits = pw.length * Math.log2(Math.max(pool, 1));
  const schwach = [];
  if (/(.)\1{2,}/.test(pw)) { bits *= 0.8; schwach.push("Zeichen wiederholen sich"); }
  if (/(?:0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf|yxcv|qwertz)/i.test(pw)) { bits *= 0.7; schwach.push("enthält eine Tastatur- oder Zahlenfolge"); }
  if (/^(passwort|password|hallo|geheim|admin|123456|qwertz|letmein|iloveyou|sommer|winter|schatz)/i.test(pw)) { bits = Math.min(bits, 10); schwach.push("ist ein sehr häufiges Passwort"); }
  if (/(19|20)\d{2}$/.test(pw)) schwach.push("endet auf eine Jahreszahl");
  if (pw.length < 12) schwach.push("ist kürzer als 12 Zeichen");
  return { bits, schwach };
}
function knackzeit(bits) {
  const sek = 2 ** bits / 1e10 / 2; // 10 Milliarden Versuche pro Sekunde, im Schnitt die Hälfte
  if (sek < 1) return "sofort";
  const E = [[31557600 * 1e6, "Millionen Jahre"], [31557600 * 1000, "Tausend Jahre"], [31557600, "Jahre"], [86400, "Tage"], [3600, "Stunden"], [60, "Minuten"], [1, "Sekunden"]];
  for (const [s, n] of E) if (sek >= s) { const w = sek / s; return w > 1e6 ? "praktisch nie" : `etwa ${de(w, 0)} ${n}`; }
  return "sofort";
}

export default [
  {
    id: "passwort", titel: "Passwort-Generator", icon: "🔐", gruppe: G, geheim: true,
    info: "Starke Zufalls-Passwörter (echter Zufall, wird nirgends gespeichert).",
    felder: [{ k: "laenge", label: "Länge", typ: "zahl", standard: "20" }, { k: "zeichen", label: "Zeichen", typ: "wahl", optionen: ["alles", "ohne Sonderzeichen", "nur Zahlen"], standard: "alles" }, { k: "anzahl", label: "Wie viele?", typ: "zahl", standard: "3" }],
    sprache: [[/^(?:generier|generiere|erstell|erstelle|mach|mache|gib|gibt|erzeuge?)(?: mir)? (?:ein |einen |neues? |sicheres? |starkes? )*(?:passwort|kennwort)(?: mit (\d{1,3}) (?:zeichen|stellen))?$/, (m) => (m[1] ? { laenge: m[1] } : {})]],
    run(e) {
      const L = Math.round(Math.min(128, Math.max(6, nr(e.laenge) || 20))), anz = Math.round(Math.min(10, Math.max(1, nr(e.anzahl) || 3)));
      const sets = e.zeichen === "nur Zahlen" ? ["0123456789"] : e.zeichen === "ohne Sonderzeichen" ? ["abcdefghijkmnopqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789"] : ["abcdefghijkmnopqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!#$%&*+-=?@_"];
      const alle = sets.join("");
      const eins = () => {
        const z = sets.map((s) => s[zufall(s.length)]);
        while (z.length < L) z.push(alle[zufall(alle.length)]);
        for (let i = z.length - 1; i > 0; i--) { const j = zufall(i + 1); [z[i], z[j]] = [z[j], z[i]]; }
        return z.slice(0, L).join("");
      };
      const pw = Array.from({ length: anz }, eins);
      return { text: `Ich habe dir ${anz} ${anz === 1 ? "Passwort" : "Passwörter"} mit ${L} Zeichen erzeugt. Sie stehen nur hier im Fenster und werden nicht gespeichert.`, ergebnis: pw.join("\n"), geheimesErgebnis: true };
    },
  },
  {
    id: "passphrase", titel: "Merk-Passwort (Passphrase)", icon: "🧠", gruppe: G, geheim: true,
    info: "Gut merkbare Passwörter aus Zufallswörtern, z. B. Wolke-Tiger-Kerze-Ofen-47.",
    felder: [{ k: "woerter", label: "Anzahl Wörter", typ: "zahl", standard: "5" }, { k: "trenner", label: "Trennzeichen", typ: "wahl", optionen: ["-", ".", "_", "Leerzeichen"], standard: "-" }],
    sprache: [[/^(?:generier|generiere|erstell|erstelle|mach|mache|gib)(?: mir)? (?:eine )?(?:passphrase|merkbares passwort|passwort zum merken)$/, () => ({})]],
    run(e) {
      const n = Math.round(Math.min(10, Math.max(3, nr(e.woerter) || 5))), t = e.trenner === "Leerzeichen" ? " " : e.trenner || "-";
      const p = [...Array.from({ length: n }, () => WOERTER[zufall(WOERTER.length)]), String(zufall(90) + 10)].join(t);
      return { text: `Dein Merk-Passwort aus ${n} Zufallswörtern steht im Fenster.`, ergebnis: p, geheimesErgebnis: true, hinweis: `Etwa ${Math.round(n * Math.log2(WOERTER.length) + Math.log2(90))} Bit Zufall.` };
    },
  },
  {
    id: "passwort_staerke", titel: "Passwort-Stärke", icon: "🛡️", gruppe: G, geheim: true,
    info: "Wie lange ein Angreifer bräuchte, um dein Passwort zu knacken. Bleibt auf dem Mac.",
    felder: [{ k: "passwort", label: "Passwort", typ: "passwort" }],
    run(e) {
      const pw = String(e.passwort || "");
      if (!pw) throw new Error("Bitte gib ein Passwort ein.");
      const { bits, schwach } = staerke(pw);
      const note = bits < 40 ? "schwach" : bits < 60 ? "mittel" : bits < 80 ? "gut" : "sehr stark";
      return { text: `Das Passwort ist ${note}. Knacken würde ${knackzeit(bits)} dauern.${schwach.length ? ` Schwachstellen: ${schwach.join(", ")}.` : ""}` };
    },
  },
  {
    id: "passwort_geleakt", titel: "Passwort geleakt?", icon: "🚨", gruppe: G, geheim: true,
    info: "Prüft bei „Have I Been Pwned“, ob ein Passwort in Datenlecks auftaucht – sicher: nur 5 Zeichen eines Prüfwerts verlassen den Mac.",
    felder: [{ k: "passwort", label: "Passwort", typ: "passwort" }],
    async run(e) {
      const pw = String(e.passwort || "");
      if (!pw) throw new Error("Bitte gib ein Passwort ein.");
      const sha = crypto.createHash("sha1").update(pw).digest("hex").toUpperCase(), vorne = sha.slice(0, 5), hinten = sha.slice(5);
      const r = await fetch(`https://api.pwnedpasswords.com/range/${vorne}`, { signal: AbortSignal.timeout(9000), headers: { "Add-Padding": "true", "User-Agent": "Friday-Werkzeugkasten" } });
      if (!r.ok) throw new Error(`Der Prüfdienst antwortet mit Fehler ${r.status}.`);
      const zeile = (await r.text()).split("\n").find((z) => z.split(":")[0].trim() === hinten);
      const n = zeile ? Number(zeile.split(":")[1]) : 0;
      return { text: n > 0 ? `Achtung: Dieses Passwort taucht ${de(n, 0)}-mal in bekannten Datenlecks auf. Bitte nicht mehr benutzen und überall ändern, wo du es verwendest.` : "Gute Nachricht: Dieses Passwort ist in keinem bekannten Datenleck aufgetaucht." };
    },
  },
  {
    id: "pin", titel: "PIN-Generator", icon: "🔢", gruppe: G, geheim: true,
    info: "Zufällige PINs ohne leicht zu ratende Muster (1234, 0000, Geburtsjahre).",
    felder: [{ k: "stellen", label: "Stellen", typ: "zahl", standard: "6" }, { k: "anzahl", label: "Wie viele?", typ: "zahl", standard: "3" }],
    sprache: [[/^(?:generier|generiere|erstell|erstelle|mach|mache|gib)(?: mir)? (?:eine )?(?:neue |sichere |zufällige )?(?:pin|pin-nummer|pin nummer|geheimzahl)$/, () => ({})], [/^(?:eine )?neue (?:pin|geheimzahl)$/, () => ({})]],
    run(e) {
      const s = Math.round(Math.min(12, Math.max(4, nr(e.stellen) || 6))), anz = Math.round(Math.min(10, Math.max(1, nr(e.anzahl) || 3)));
      const schlecht = (p) => /^(\d)\1+$/.test(p) || "0123456789".includes(p) || "9876543210".includes(p) || /^(19|20)\d{2}$/.test(p) || /^(\d\d)\1+$/.test(p);
      const eins = () => { let p; do { p = Array.from({ length: s }, () => zufall(10)).join(""); } while (schlecht(p)); return p; };
      return { text: `${anz} zufällige PINs mit ${s} Stellen stehen im Fenster.`, ergebnis: Array.from({ length: anz }, eins).join("\n"), geheimesErgebnis: true };
    },
  },
  {
    id: "hash", titel: "Prüfsumme (Hash)", icon: "#️⃣", gruppe: G,
    info: "SHA-256, SHA-1 und MD5 eines Textes, z. B. um Downloads zu prüfen.",
    felder: [{ k: "text", label: "Text", typ: "textarea" }],
    run(e) {
      const t = text(e, "text", "einen Text", { max: 1000000 });
      const h = (a) => crypto.createHash(a).update(t, "utf8").digest("hex");
      return { text: "Die Prüfsummen sind berechnet.", tabelle: { kopf: ["Verfahren", "Prüfsumme"], zeilen: [["SHA-256", h("sha256")], ["SHA-1", h("sha1")], ["MD5", h("md5")]] } };
    },
  },
  {
    id: "base64", titel: "Base64 kodieren", icon: "🔤", gruppe: G,
    info: "Text in Base64 umwandeln und zurück.",
    felder: [{ k: "text", label: "Text", typ: "textarea" }, { k: "richtung", label: "Richtung", typ: "wahl", optionen: ["kodieren", "dekodieren"], standard: "kodieren" }],
    run(e) {
      const t = text(e, "text", "einen Text", { max: 1000000 });
      if (e.richtung === "dekodieren") {
        const s = t.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error("Das ist kein gültiges Base64.");
        return { text: "Dekodiert.", ergebnis: Buffer.from(s, "base64").toString("utf8") };
      }
      return { text: "Kodiert.", ergebnis: Buffer.from(t, "utf8").toString("base64") };
    },
  },
];
