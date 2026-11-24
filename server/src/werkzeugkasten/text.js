// Text & Schreiben.
import { nr, text, de, heute, datumText } from "./hilfe.js";

const G = "Text & Schreiben";

// ---------- Zahl in Worten ----------
const EINER = ["", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
const ZEHNER = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];
function unter1000(n, ende = true) {
  const h = Math.floor(n / 100), r = n % 100;
  let s = h ? `${h === 1 ? "ein" : EINER[h]}hundert` : "";
  if (r < 20) s += r === 1 ? (ende ? "eins" : "ein") : EINER[r];
  else { const e = r % 10; s += (e ? `${e === 1 ? "ein" : EINER[e]}und` : "") + ZEHNER[Math.floor(r / 10)]; }
  return s;
}
export function zahlInWorten(n) {
  if (!Number.isInteger(n) || Math.abs(n) > 999999999999) throw new Error("Bitte eine ganze Zahl bis 999 Milliarden.");
  if (n === 0) return "null";
  if (n < 0) return "minus " + zahlInWorten(-n);
  const teile = [];
  const mrd = Math.floor(n / 1e9), mio = Math.floor((n % 1e9) / 1e6), tsd = Math.floor((n % 1e6) / 1000), rest = n % 1000;
  if (mrd) teile.push(mrd === 1 ? "eine Milliarde" : `${unter1000(mrd)} Milliarden`);
  if (mio) teile.push(mio === 1 ? "eine Million" : `${unter1000(mio)} Millionen`);
  let klein = "";
  if (tsd) klein += `${tsd === 1 ? "ein" : unter1000(tsd, false)}tausend`;
  if (rest) klein += unter1000(rest, true);
  if (klein) teile.push(klein);
  return teile.join(" ");
}

// ---------- Römische Zahlen ----------
const ROEM = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
const zuRoem = (n) => ROEM.reduce((s, [w, z]) => { while (n >= w) { s += z; n -= w; } return s; }, "");
function ausRoem(s) {
  const W = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; let n = 0;
  for (let i = 0; i < s.length; i++) { const a = W[s[i]], b = W[s[i + 1]] || 0; n += a < b ? -a : a; }
  if (zuRoem(n) !== s) throw new Error(`„${s}“ ist keine gültige römische Zahl.`);
  return n;
}

// ---------- Morse ----------
const MORSE = { a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..", ä: ".-.-", ö: "---.", ü: "..--", ß: "...--..", 0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.", ".": ".-.-.-", ",": "--..--", "?": "..--..", "!": "-.-.--", "/": "-..-.", "@": ".--.-.", "-": "-....-" };
const MORSE_ZURUECK = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

// ---------- Briefvorlagen ----------
const VORLAGEN = {
  "Kündigung (Vertrag/Abo)": (e) => `Kündigung meines Vertrags${e.nummer ? ` (Kunden-/Vertragsnummer ${e.nummer})` : ""}\n\nSehr geehrte Damen und Herren,\n\nhiermit kündige ich meinen Vertrag${e.nummer ? ` mit der Nummer ${e.nummer}` : ""} fristgerecht zum nächstmöglichen Zeitpunkt${e.termin ? `, spätestens zum ${e.termin}` : ""}.\n\nBitte bestätigen Sie mir die Kündigung und das Vertragsende schriftlich. Einer Verlängerung, telefonischen Rückgewinnungsversuchen oder Werbung widerspreche ich. Eine erteilte Einzugsermächtigung widerrufe ich zum Vertragsende.\n${e.details ? `\n${e.details}\n` : ""}\nMit freundlichen Grüßen\n\n${e.name}`,
  "Widerruf (Online-Kauf)": (e) => `Widerruf${e.nummer ? ` – Bestellnummer ${e.nummer}` : ""}\n\nSehr geehrte Damen und Herren,\n\nhiermit widerrufe ich den von mir abgeschlossenen Vertrag über den Kauf der folgenden Ware${e.details ? `: ${e.details}` : ""}.\n\nBestellt am: ${e.termin || "…"}\n${e.nummer ? `Bestellnummer: ${e.nummer}\n` : ""}\nBitte erstatten Sie mir den Kaufpreis innerhalb von 14 Tagen auf dem ursprünglichen Zahlungsweg zurück.\n\nMit freundlichen Grüßen\n\n${e.name}`,
  "Krankmeldung (Arbeit)": (e) => `Krankmeldung\n\nHallo${e.empfaenger ? ` ${e.empfaenger.split("\n")[0]}` : ""},\n\nich bin leider erkrankt und kann heute nicht zur Arbeit kommen. Voraussichtlich falle ich ${e.termin ? `bis einschließlich ${e.termin}` : "einige Tage"} aus. Die Arbeitsunfähigkeitsbescheinigung wird wie üblich elektronisch über meine Krankenkasse bereitgestellt.\n${e.details ? `\n${e.details}\n` : ""}\nViele Grüße\n${e.name}`,
  Urlaubsantrag: (e) => `Urlaubsantrag\n\nHallo${e.empfaenger ? ` ${e.empfaenger.split("\n")[0]}` : ""},\n\nhiermit beantrage ich Erholungsurlaub ${e.termin ? `vom ${e.termin}` : "im Zeitraum …"}.\n${e.details ? `\n${e.details}\n` : ""}\nÜber eine kurze Bestätigung freue ich mich.\n\nViele Grüße\n${e.name}`,
  "Mängelanzeige (Vermieter)": (e) => `Mängelanzeige für die Wohnung${e.nummer ? ` ${e.nummer}` : ""}\n\nSehr geehrte Damen und Herren,\n\nin meiner Wohnung besteht folgender Mangel: ${e.details || "…"}\n\nDer Mangel besteht seit ${e.termin || "…"}. Ich bitte Sie, ihn bis spätestens 14 Tage nach Zugang dieses Schreibens zu beheben. Bis zur Beseitigung behalte ich mir eine Mietminderung vor.\n\nMit freundlichen Grüßen\n\n${e.name}`,
};

function lcsDiff(a, b) {
  const n = a.length, m = b.length;
  if (n * m > 4e6) throw new Error("Die Texte sind zu lang für den Vergleich.");
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const aus = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { aus.push(["=", a[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) aus.push(["−", a[i++]]); else aus.push(["+", b[j++]]); }
  while (i < n) aus.push(["−", a[i++]]);
  while (j < m) aus.push(["+", b[j++]]);
  return aus;
}

export default [
  {
    id: "text_statistik", titel: "Text-Statistik", icon: "🔢", gruppe: G,
    info: "Wörter, Zeichen, Sätze, Lese- und Sprechzeit.",
    felder: [{ k: "text", label: "Text", typ: "textarea" }],
    run(e) {
      const t = text(e, "text", "einen Text", { max: 200000 });
      const woerter = t.match(/[\p{L}\p{N}'-]+/gu) || [], saetze = (t.match(/[.!?]+(\s|$)/g) || []).length || 1, absaetze = t.split(/\n\s*\n/).filter((x) => x.trim()).length;
      const haeufig = Object.entries(woerter.map((w) => w.toLowerCase()).filter((w) => w.length > 3).reduce((o, w) => ((o[w] = (o[w] || 0) + 1), o), {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const lese = woerter.length / 200, sprech = woerter.length / 130;
      return {
        text: `${de(woerter.length, 0)} Wörter, ${de(t.length, 0)} Zeichen, ${saetze} Sätze. Lesezeit etwa ${lese < 1 ? "unter einer Minute" : `${Math.round(lese)} Minuten`}, vorgelesen etwa ${sprech < 1 ? "unter einer Minute" : `${Math.round(sprech)} Minuten`}.`,
        tabelle: { kopf: ["", "Wert"], zeilen: [["Wörter", de(woerter.length, 0)], ["Zeichen", de(t.length, 0)], ["Zeichen ohne Leerzeichen", de(t.replace(/\s/g, "").length, 0)], ["Sätze", saetze], ["Absätze", absaetze], ["Ø Wörter pro Satz", de(woerter.length / saetze, 1)], ["Häufigste Wörter", haeufig.map(([w, n]) => `${w} (${n})`).join(", ") || "–"]] },
      };
    },
  },
  {
    id: "schreibweise", titel: "Schreibweise ändern", icon: "🔠", gruppe: G,
    info: "GROSS, klein, Titel-Schreibweise, Satzanfänge, Leerzeichen aufräumen.",
    felder: [{ k: "text", label: "Text", typ: "textarea" }, { k: "art", label: "Umwandeln in", typ: "wahl", optionen: ["GROSSBUCHSTABEN", "kleinbuchstaben", "Jedes Wort Groß", "Satzanfänge groß", "Leerzeichen aufräumen", "Rückwärts"], standard: "GROSSBUCHSTABEN" }],
    run(e) {
      const t = text(e, "text", "einen Text", { max: 100000 }), a = e.art || "GROSSBUCHSTABEN";
      const r = a === "kleinbuchstaben" ? t.toLowerCase() : a === "Jedes Wort Groß" ? t.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, p, c) => p + c.toUpperCase())
        : a === "Satzanfänge groß" ? t.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, p, c) => p + c.toUpperCase()) : a === "Leerzeichen aufräumen" ? t.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim()
        : a === "Rückwärts" ? [...t].reverse().join("") : t.toUpperCase();
      return { text: "Fertig umgewandelt. Du kannst den Text kopieren.", ergebnis: r };
    },
  },
  {
    id: "zeilen_sortieren", titel: "Listen sortieren & aufräumen", icon: "🔀", gruppe: G,
    info: "Zeilen sortieren, mischen, doppelte entfernen und nummerieren.",
    felder: [{ k: "text", label: "Liste (eine Zeile pro Eintrag)", typ: "textarea" }, { k: "art", label: "Sortierung", typ: "wahl", optionen: ["A → Z", "Z → A", "nach Länge", "zufällig mischen", "so lassen"], standard: "A → Z" }, { k: "doppelte", label: "Doppelte entfernen?", typ: "wahl", optionen: ["ja", "nein"], standard: "ja" }, { k: "nummern", label: "Nummerieren?", typ: "wahl", optionen: ["nein", "ja"], standard: "nein" }],
    run(e) {
      let z = text(e, "text", "eine Liste", { max: 200000 }).split("\n").map((x) => x.trim()).filter(Boolean);
      const vorher = z.length;
      if (e.doppelte !== "nein") { const s = new Set(); z = z.filter((x) => { const k = x.toLowerCase(); if (s.has(k)) return false; s.add(k); return true; }); }
      const art = e.art || "A → Z";
      if (art === "A → Z") z.sort((a, b) => a.localeCompare(b, "de", { numeric: true }));
      else if (art === "Z → A") z.sort((a, b) => b.localeCompare(a, "de", { numeric: true }));
      else if (art === "nach Länge") z.sort((a, b) => a.length - b.length);
      else if (art === "zufällig mischen") for (let i = z.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [z[i], z[j]] = [z[j], z[i]]; }
      if (e.nummern === "ja") z = z.map((x, i) => `${i + 1}. ${x}`);
      return { text: `${z.length} Einträge${vorher > z.length ? `, ${vorher - z.length} doppelte entfernt` : ""}.`, ergebnis: z.join("\n") };
    },
  },
  {
    id: "text_vergleichen", titel: "Texte vergleichen", icon: "🔍", gruppe: G,
    info: "Zeigt Zeile für Zeile, was sich zwischen zwei Texten geändert hat.",
    felder: [{ k: "a", label: "Text alt", typ: "textarea" }, { k: "b", label: "Text neu", typ: "textarea" }],
    run(e) {
      const a = text(e, "a", "den alten Text", { max: 100000 }).split("\n"), b = text(e, "b", "den neuen Text", { max: 100000 }).split("\n");
      const d = lcsDiff(a, b), weg = d.filter((x) => x[0] === "−").length, neu = d.filter((x) => x[0] === "+").length;
      return { text: weg + neu ? `${neu} ${neu === 1 ? "Zeile" : "Zeilen"} neu oder geändert, ${weg} ${weg === 1 ? "Zeile" : "Zeilen"} entfernt.` : "Die beiden Texte sind gleich.", diff: d.slice(0, 2000) };
    },
  },
  {
    id: "morse", titel: "Morse-Code", icon: "📡", gruppe: G,
    info: "Text in Morsezeichen und zurück.",
    felder: [{ k: "text", label: "Text oder Morse (. und -, Wörter mit / trennen)", typ: "textarea" }],
    sprache: [[/^(?:übersetze |schreib |was ist )?(.{1,60}?) (?:in|als) morse(?:code|zeichen)?$/, (m) => ({ text: m[1] })], [/^morse(?:code)? (.{1,60})$/, (m) => ({ text: m[1] })]],
    run(e) {
      const t = text(e, "text", "einen Text", { max: 5000 });
      if (/^[.\-\s/|]+$/.test(t)) {
        const r = t.trim().split(/\s*[/|]\s*|\s{3,}/).map((w) => w.split(/\s+/).map((c) => MORSE_ZURUECK[c] ?? "?").join("")).join(" ");
        return { text: `Das heißt: ${r}`, ergebnis: r };
      }
      const r = t.toLowerCase().split(/\s+/).map((w) => [...w].map((c) => MORSE[c]).filter(Boolean).join(" ")).join(" / ");
      return { text: `In Morse: ${r.length > 120 ? r.slice(0, 120) + " …" : r}`, ergebnis: r, morse: r };
    },
  },
  {
    id: "roemische_zahlen", titel: "Römische Zahlen", icon: "🏛️", gruppe: G,
    info: "Zahlen in römische Ziffern und zurück (1 bis 3999).",
    felder: [{ k: "wert", label: "Zahl oder römische Zahl", typ: "text", platzhalter: "2026 oder MMXXVI" }],
    sprache: [[/^(?:was ist |wie schreibt man |schreib )?(\d{1,4}|[mdclxvi]+) (?:in |als )?(?:römische[rn]? zahl(?:en)?|römisch|in zahlen|als zahl)$/, (m) => ({ wert: m[1] })]],
    run(e) {
      const w = text(e, "wert", "eine Zahl").toUpperCase().replace(/\s/g, "");
      if (/^\d+$/.test(w)) { const n = +w; if (n < 1 || n > 3999) throw new Error("Römische Zahlen gehen von 1 bis 3999."); return { text: `${n} ist römisch ${zuRoem(n)}.`, ergebnis: zuRoem(n) }; }
      if (/^[MDCLXVI]+$/.test(w)) { const n = ausRoem(w); return { text: `${w} ist ${n}.`, ergebnis: String(n) }; }
      throw new Error("Bitte gib eine Zahl oder eine römische Zahl ein.");
    },
  },
  {
    id: "zahl_in_worten", titel: "Zahl in Worten", icon: "✍️", gruppe: G,
    info: "Schreibt Zahlen und Euro-Beträge in Worten aus (z. B. für Verträge).",
    felder: [{ k: "zahl", label: "Zahl oder Betrag", typ: "zahl" }, { k: "euro", label: "Als Euro-Betrag?", typ: "wahl", optionen: ["nein", "ja"], standard: "nein" }],
    sprache: [[/^(?:schreib |schreibe |wie schreibt man )?(\d[\d.]*(?:,\d{1,2})?)( euro)? (?:in worten|als wort|ausgeschrieben)$/, (m) => ({ zahl: m[1], euro: m[2] ? "ja" : "nein" })]],
    run(e) {
      const n = nr(e.zahl);
      if (n == null) throw new Error("Bitte gib eine Zahl ein.");
      if (e.euro === "ja" || !Number.isInteger(n)) {
        const ganz = Math.floor(Math.abs(n)), cent = Math.round((Math.abs(n) - ganz) * 100);
        const r = `${n < 0 ? "minus " : ""}${zahlInWorten(ganz)} Euro${cent ? ` und ${zahlInWorten(cent)} Cent` : ""}`;
        return { text: r, ergebnis: r };
      }
      const r = zahlInWorten(n);
      return { text: r, ergebnis: r };
    },
  },
  {
    id: "brief_vorlage", titel: "Brief-Vorlagen", icon: "✉️", gruppe: G,
    info: "Kündigung, Widerruf, Krankmeldung, Urlaubsantrag, Mängelanzeige – fertig zum Abschicken.",
    felder: [
      { k: "vorlage", label: "Vorlage", typ: "wahl", optionen: Object.keys(VORLAGEN), standard: "Kündigung (Vertrag/Abo)" },
      { k: "name", label: "Dein Name", typ: "text" }, { k: "adresse", label: "Deine Adresse", typ: "textarea" }, { k: "empfaenger", label: "Empfänger (Firma/Name + Adresse)", typ: "textarea" },
      { k: "nummer", label: "Kunden-/Vertrags-/Bestellnummer", typ: "text" }, { k: "termin", label: "Datum/Zeitraum (z. B. Bestelldatum, „bis 28.11.“)", typ: "text" }, { k: "details", label: "Details (optional)", typ: "textarea" },
    ],
    run(e) {
      const v = VORLAGEN[e.vorlage] || VORLAGEN["Kündigung (Vertrag/Abo)"];
      const name = text(e, "name", "deinen Namen", { max: 200 });
      const kopf = [name, String(e.adresse || "").trim(), "", String(e.empfaenger || "").trim(), "", `${datumText(heute(), { mitTag: false })}`, ""].join("\n").replace(/\n{3,}/g, "\n\n");
      const brief = `${kopf}\n${v({ ...e, name, nummer: String(e.nummer || "").trim(), termin: String(e.termin || "").trim(), details: String(e.details || "").trim(), empfaenger: String(e.empfaenger || "") })}`;
      return { text: `Dein Brief „${e.vorlage || "Kündigung"}“ ist fertig. Lies ihn kurz durch, dann kannst du ihn kopieren oder herunterladen.`, ergebnis: brief, datei: { name: `${(e.vorlage || "brief").replace(/[^\wäöüÄÖÜß]+/g, "-")}.txt`, typ: "text/plain", inhalt: brief }, hinweis: "Vorlage ohne Rechtsberatung. Bei wichtigen Verträgen per Einschreiben schicken.", zeigen: true };
    },
  },
];
