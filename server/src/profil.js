// Mein Profil (v1.147.0, im Test: in Friday erst nach Freigabe in Eve).
// Boss tippt unten links auf sein Profil und trägt dort alles Persönliche ein:
// Foto, Name, Geburtstag (daraus das Alter), Adresse, Telefon, Beruf, Familie, Hobbys …
// Gespeichert nur lokal auf dem Mac in data/profil.json (in Eve: in den Eve-Daten).
// Friday kennt davon nur die Grunddaten (Name, Alter, Wohnort, Beruf, Hobbys, Essen),
// und das nur, wenn Boss es erlaubt. Adresse, Telefon, Mail und Gesundheit bleiben im Profil.
import { IST_EVE } from "./config.js";
import { istFrei } from "./eve.js";
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";

export const FUNKTION_ID = "mein-profil";
export const frei = () => IST_EVE || istFrei(FUNKTION_ID);

const MAX_FOTO = 600 * 1024; // als data:-URL, das Dashboard verkleinert das Bild vorher

// Feld → [Bezeichnung, maximale Länge]
export const FELDER = {
  name: ["Name", 80],
  rufname: ["So nennt Friday dich", 40],
  geburtstag: ["Geburtstag", 10],
  strasse: ["Straße und Hausnummer", 120],
  plz: ["PLZ", 10],
  ort: ["Ort", 80],
  land: ["Land", 60],
  telefon: ["Telefon", 40],
  email: ["E-Mail", 120],
  beruf: ["Beruf", 120],
  groesse: ["Größe", 20],
  blutgruppe: ["Blutgruppe", 10],
  allergien: ["Allergien und Gesundheit", 400],
  partner: ["Partnerin / Partner", 120],
  kinder: ["Kinder", 300],
  haustiere: ["Haustiere", 200],
  hobbys: ["Hobbys", 400],
  lieblingsessen: ["Lieblingsessen", 200],
  musik: ["Lieblingsmusik", 200],
  auto: ["Auto", 120],
  notizen: ["Sonst noch wichtig", 2000],
};

const kurz = (s, n) => String(s ?? "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, n);

/** Alter in Jahren aus "JJJJ-MM-TT" (oder null). */
export function alterAus(geb, heute = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(geb || ""));
  if (!m) return null;
  const j = Number(m[1]), mo = Number(m[2]), t = Number(m[3]);
  if (j < 1900 || mo < 1 || mo > 12 || t < 1 || t > 31) return null;
  let a = heute.getFullYear() - j;
  if (heute.getMonth() + 1 < mo || (heute.getMonth() + 1 === mo && heute.getDate() < t)) a--;
  return a >= 0 && a < 130 ? a : null;
}

/** Tage bis zum nächsten Geburtstag (0 = heute) oder null. */
export function tageBisGeburtstag(geb, heute = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(geb || ""));
  if (!m) return null;
  const h = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate());
  let n = new Date(h.getFullYear(), Number(m[2]) - 1, Number(m[3]));
  if (n < h) n = new Date(h.getFullYear() + 1, Number(m[2]) - 1, Number(m[3]));
  return Math.round((n - h) / 86400000);
}

export function laden() {
  const p = store.load("profil", {});
  return p && typeof p === "object" ? p : {};
}

export function profil() {
  const p = laden();
  return { ...p, alter: alterAus(p.geburtstag), bis_geburtstag: tageBisGeburtstag(p.geburtstag), friday_darf: p.friday_darf !== false, felder: FELDER, frei: frei() };
}

export function speichern(roh = {}) {
  if (!frei()) return { ok: false, error: "Das Profil ist noch im Test. Probier es in Eve aus und gib es dort frei." };
  const alt = laden();
  const neu = { ...alt };
  for (const [k, [, max]] of Object.entries(FELDER)) if (k in roh) neu[k] = kurz(roh[k], max);
  if (neu.geburtstag && !/^\d{4}-\d{2}-\d{2}$/.test(neu.geburtstag)) return { ok: false, error: "Den Geburtstag bitte als Datum auswählen." };
  if (neu.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(neu.email)) return { ok: false, error: "Die E-Mail-Adresse sieht nicht richtig aus." };
  if ("foto" in roh) {
    const f = String(roh.foto || "");
    if (!f) neu.foto = "";
    else if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(f)) return { ok: false, error: "Das Foto muss ein JPG-, PNG- oder WebP-Bild sein." };
    else if (f.length > MAX_FOTO) return { ok: false, error: "Das Foto ist zu groß. Nimm bitte ein kleineres Bild." };
    else neu.foto = f;
  }
  if ("friday_darf" in roh) neu.friday_darf = roh.friday_darf !== false && roh.friday_darf !== "0";
  for (const k of Object.keys(neu)) if (neu[k] === "") delete neu[k];
  neu.geaendert = new Date().toISOString();
  store.save("profil", neu);
  const geaendert = Object.keys(FELDER).filter((k) => (alt[k] || "") !== (neu[k] || "")).map((k) => FELDER[k][0]);
  if ((alt.foto || "") !== (neu.foto || "")) geaendert.unshift("Foto");
  // Ins Logbuch nur, WAS sich geändert hat, nie die Werte selbst (Adresse, Telefon …).
  if (geaendert.length) eintragen({ bereich: "gedaechtnis", quelle: "dashboard", titel: "Profil aktualisiert", details: geaendert.join(", ") });
  return { ok: true, profil: profil(), geaendert };
}

/** Grunddaten für Fridays Gehirn (eine Zeile, leer wenn nichts da oder nicht erlaubt). */
export function kurzinfo() {
  if (!frei()) return "";
  const p = laden();
  if (p.friday_darf === false) return "";
  const a = alterAus(p.geburtstag);
  const bis = tageBisGeburtstag(p.geburtstag);
  const teile = [
    p.name && `heißt ${p.name}`,
    a !== null && `ist ${a} Jahre alt`,
    bis === 0 ? "hat HEUTE Geburtstag" : bis !== null && bis <= 14 ? `hat in ${bis} Tagen Geburtstag` : "",
    p.ort && `wohnt in ${p.ort}`,
    p.beruf && `arbeitet als ${p.beruf}`,
    p.partner && `Partnerin/Partner: ${p.partner}`,
    p.kinder && `Kinder: ${p.kinder}`,
    p.hobbys && `Hobbys: ${p.hobbys}`,
    p.lieblingsessen && `isst gern ${p.lieblingsessen}`,
    p.musik && `hört gern ${p.musik}`,
  ].filter(Boolean);
  return teile.length ? `Profil von Boss (selbst eingetragen): ${teile.join("; ")}.` : "";
}

// ---------- Sprachbefehle ohne Claude ----------
export function quickCommand(text) {
  if (!frei()) return null;
  const t = String(text || "").toLowerCase().replace(/[„“”"'!?.,:;]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^(?:hey |hallo |hi |ok |okay )?(?:friday|freitag)(?: |$)/, "").trim()
    .replace(/^(?:bitte |kannst du (?:mir )?(?:bitte )?)/, "").trim();
  if (/^(?:öffne|oeffne|zeig|zeige|mach)(?: mir)?(?: mal)? (?:mein |das |dein )?(?:profil|benutzerprofil|nutzerprofil)(?: auf| bitte)?$/.test(t)
    || /^(?:mein )?profil(?: öffnen| oeffnen| zeigen)?$/.test(t)) {
    const p = laden();
    return { answer: p.name ? `Hier ist dein Profil, ${p.rufname || "Boss"}.` : "Hier ist dein Profil, Boss. Trag ein, was ich über dich wissen soll.", actions: ["profil"] };
  }
  if (/^wie alt bin ich(?: eigentlich)?$/.test(t)) {
    const a = alterAus(laden().geburtstag);
    return a === null
      ? { answer: "Das weiß ich noch nicht, Boss. Trag deinen Geburtstag in deinem Profil ein.", actions: ["profil"] }
      : { answer: `Du bist ${a} Jahre alt, Boss.`, actions: [] };
  }
  if (/^wann (?:habe|hab) ich geburtstag$/.test(t)) {
    const p = laden();
    const bis = tageBisGeburtstag(p.geburtstag);
    if (bis === null) return { answer: "Deinen Geburtstag kenne ich noch nicht. Trag ihn in deinem Profil ein.", actions: ["profil"] };
    const [, mo, tg] = p.geburtstag.split("-");
    const datum = new Date(2000, Number(mo) - 1, Number(tg)).toLocaleDateString("de-DE", { day: "numeric", month: "long" });
    return { answer: bis === 0 ? "Heute, Boss! Alles Gute zum Geburtstag." : `Am ${datum}, Boss. Das ist in ${bis === 1 ? "einem Tag" : `${bis} Tagen`}.`, actions: [] };
  }
  if (/^(?:wo wohne ich|wie ist meine adresse|was ist meine adresse)$/.test(t)) {
    const p = laden();
    const adr = [p.strasse, [p.plz, p.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    return adr ? { answer: `Du wohnst in ${adr}.`, actions: [] } : { answer: "Deine Adresse steht noch nicht in deinem Profil, Boss.", actions: ["profil"] };
  }
  return null;
}

export function profilRouten(app) {
  app.get("/api/profil", (_req, res) => res.json(profil()));
  app.post("/api/profil", (req, res) => {
    const r = speichern(req.body || {});
    res.status(r.ok ? 200 : 400).json(r);
  });
}
