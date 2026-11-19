// Perspektiv-Wechsler – Advocatus Diaboli (v1.106.0)
// Du gibst Friday einen Artikel, eine Behauptung oder deinen eigenen Entwurf. Friday sucht die schwächsten Stellen
// und antwortet aus drei Blickwinkeln: als Kritiker, als Jurist und als Skeptiker.
// Die Grundprüfung läuft OHNE Claude (Regeln für Pauschalaussagen, fehlende Quellen, Ursache/Wirkung,
// Rechts-Fallen wie Heilversprechen, Werbeaussagen, Datenschutz …). „Stärkste Gegenargumente mit KI“ braucht Guthaben.
// Wichtig: Friday liest nichts heimlich mit. Sie bekommt nur den Text, den du ihr gibst (Einfügen oder Lesezeichen).
import * as store from "./store.js";
import * as logbuch from "./logbuch.js";
import { U } from "./datum.js";
import { denke } from "./denker.js";

const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const norm = (s) => String(s || "").toLowerCase();

function saetze(text) {
  return String(text || "").replace(/\r/g, "").split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 6 && s.length < 800);
}
const kurz = (s, n = 160) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// [Rolle, Titel, Muster, Gegenfrage]
const REGELN = [
  // --- Kritiker: Logik, Einseitigkeit, Sprache ---
  ["kritiker", "Pauschalaussage", /\b(immer|nie|niemals|alle|jeder|jede|jedes|niemand|keiner|ausnahmslos|grundsätzlich|überall|ueberall|garantiert|zweifellos|definitiv|zu 100 ?%)\b/i, "Gilt das wirklich ausnahmslos? Ein einziges Gegenbeispiel reicht, um die Aussage zu kippen."],
  ["kritiker", "Wertende Sprache statt Argument", /\b(skandal|katastrophe|wahnsinn|unglaublich|genial|revolutionär|revolutionaer|bahnbrechend|lächerlich|laecherlich|dumm|absurd|perfekt|einzigartig|unschlagbar|der beste|die beste|das beste)\b/i, "Das starke Wort ersetzt den Beleg. Was bleibt übrig, wenn man es neutral formuliert?"],
  ["kritiker", "Unbestimmte Mehrheit", /\b(viele|die meisten|immer mehr|zahlreiche|man sagt|es heißt|es heisst|bekanntlich|jeder weiß|jeder weiss)\b/i, "Wer genau? Wie viele? Ohne Zahl ist das nur ein Gefühl."],
  ["kritiker", "Berufung auf Autorität", /\b(experten|wissenschaftler|studien|forscher|ärzte|aerzte|fachleute)\b.{0,30}\b(sagen|zeigen|belegen|beweisen|bestätigen|bestaetigen|warnen)\b/i, "Welche Experten, welche Studie? Gibt es Fachleute, die das Gegenteil sagen?"],
  ["kritiker", "Entweder-oder-Falle", /\b(entweder .{3,60} oder|es gibt nur (zwei|eine)|einzige (lösung|loesung|möglichkeit|moeglichkeit)|alternativlos)\b/i, "Gibt es wirklich nur diese Möglichkeiten? Oft gibt es einen dritten Weg."],
  ["kritiker", "Dammbruch-Argument", /\b(führt (unweigerlich|zwangsläufig|zwangslaeufig)|als nächstes|als naechstes|am ende (wird|werden|steht)|dann ist es nur noch eine frage der zeit)\b/i, "Warum sollte die Kette zwingend so weitergehen? Jeder Schritt braucht einen eigenen Beleg."],
  // --- Skeptiker: Belege, Zahlen, Ursache ---
  ["skeptiker", "Zahl ohne Quelle", /\b\d+([.,]\d+)?\s?(%|€|\$|(prozent|millionen|milliarden|mio|mrd|euro|kilo|kg|mal so)\b)/i, "Woher stammt die Zahl, wann wurde sie erhoben und im Vergleich wozu?"],
  ["skeptiker", "Ursache oder nur Zufall?", /\b(weil|deshalb|darum|daher|führt zu|fuehrt zu|verursacht|sorgt für|sorgt fuer|liegt (das )?an|dadurch|infolge|bewirkt)\b/i, "Ist das wirklich die Ursache – oder passiert beides nur gleichzeitig? Welche anderen Gründe gäbe es?"],
  ["skeptiker", "Vorhersage", /\b(wird (bald|sicher|garantiert|in zukunft)|werden (bald|sicher)|in (\d+|wenigen|ein paar) jahren|bis (20\d\d)|steht bevor|zukunft gehört|zukunft gehoert)\b/i, "Vorhersagen sind billig. Wie oft lagen ähnliche Prognosen daneben?"],
  ["skeptiker", "Einzelfall als Beweis", /\b(bei mir|ich kenne|mein (freund|nachbar|kollege)|meine (freundin|nachbarin|kollegin)|selbst erlebt|aus eigener erfahrung|habe ich gesehen)\b/i, "Ein Einzelfall ist kein Muster. Wie sieht es bei hundert anderen aus?"],
  ["skeptiker", "Zu schön, um wahr zu sein", /\b(ohne risiko|risikolos|kostenlos|gratis|sofort|schnell reich|passives einkommen|nebenbei|über nacht|ueber nacht|in nur \d+ (tagen|minuten|wochen)|mühelos|muehelos)\b/i, "Wo ist der Haken? Wer verdient daran, dass du das glaubst?"],
  ["skeptiker", "Fehlende Gegenseite", null, "Der Text nennt keine Einwände. Was würde jemand antworten, der das Gegenteil denkt?"],
  // --- Jurist: Rechts-Fallen ---
  ["jurist", "Heilversprechen", /\b(heilt|heilen|gegen krebs|wirkt garantiert|nebenwirkungsfrei|ersetzt (den )?arzt|entgiftet|detox|immunsystem stärkt|immunsystem staerkt|abnehmen ohne)\b/i, "Heilversprechen sind in Werbung verboten (Heilmittelwerbegesetz). Ohne Zulassung: abmahngefährdet."],
  ["jurist", "Alleinstellungs-Werbung", /\b(nr\.? ?1|nummer eins|marktführer|marktfuehrer|der beste|die beste|das beste|günstigste|guenstigste|billigste|einzige(r|s)? (anbieter|hersteller)|testsieger)\b/i, "„Der Beste“, „Nr. 1“, „Testsieger“ musst du beweisen können (Wettbewerbsrecht), sonst droht eine Abmahnung."],
  ["jurist", "Garantie-Versprechen", /\b(garantie|garantiert|geld[- ]?zurück|geld[- ]?zurueck|lebenslang|gewährleistung|gewaehrleistung)\b/i, "Wer „Garantie“ verspricht, muss Bedingungen, Dauer und Geber klar nennen. Die gesetzliche Gewährleistung lässt sich nicht wegschreiben."],
  ["jurist", "Über Personen: üble Nachrede?", /\b(betrüger|betrueger|betrug|kriminell|lügt|luegt|lügner|luegner|abzocke|abzocker|verbrecher|korrupt|dieb|gestohlen)\b/i, "Harte Vorwürfe gegen erkennbare Personen oder Firmen brauchen Beweise. Sonst: üble Nachrede oder Verleumdung."],
  ["jurist", "Urheberrecht", /\b(bild(er)? (von|aus)|foto(s)? (von|aus)|kopiert|übernommen|uebernommen|zitat|musik|song|logo|screenshot|aus dem internet)\b/i, "Fremde Bilder, Texte, Musik oder Logos nur mit Erlaubnis oder als echtes Zitat mit Quelle nutzen."],
  ["jurist", "Datenschutz", /\b(e-?mail-?adressen|telefonnummern|adressen|kundendaten|personendaten|daten (sammeln|speichern|weitergeben|verkaufen)|tracking|cookies|kamera|aufnahme|fotos von (personen|kunden|mitarbeitern)|gesichtserkennung)\b/i, "Personenbezogene Daten fallen unter die DSGVO: Einwilligung, Zweck, Löschfrist und Datenschutzerklärung nötig."],
  ["jurist", "Werbung kennzeichnen", /\b(affiliate|provision|gesponsert|kooperation|werbelink|rabattcode|influencer|partnerlink)\b/i, "Bezahlte Empfehlungen müssen als „Werbung“/„Anzeige“ gekennzeichnet sein."],
  ["jurist", "Vertrag & Fristen", /\b(kündigen|kuendigen|kündigung|kuendigung|frist|vertrag|abo|agb|widerruf|vertragsstrafe|haftung|haften)\b/i, "Was steht genau im Vertrag? Fristen, Widerrufsrecht (14 Tage bei Online-Käufen) und Haftung prüfen."],
  ["jurist", "Steuer & Gewerbe", /\b(einnahmen|verkaufen|verkauf|umsatz|gewinn|nebenjob|nebengewerbe|selbstständig|selbststaendig|rechnung stellen)\b/i, "Regelmäßige Einnahmen sind meist ein Gewerbe: Anmeldung, Steuer (ggf. Kleinunternehmerregelung) bedenken."],
];
const ROLLEN = {
  kritiker: { name: "Kritiker", icon: "🗡", leitfrage: "Was ist am Argument schwach?" },
  jurist: { name: "Jurist", icon: "⚖", leitfrage: "Wo kann es rechtlich Ärger geben?" },
  skeptiker: { name: "Skeptiker", icon: "🔍", leitfrage: "Was ist nicht belegt?" },
};

// Kernthese: der Satz, der am meisten behauptet
function kernthese(s) {
  const kandidaten = s.filter((x) => /\b(ist|sind|muss|müssen|muessen|sollte|sollten|wird|werden|braucht|brauchen|kann nicht|darf nicht|lohnt|besser|schlechter)\b/i.test(x));
  return (kandidaten[0] || s[0] || "").slice(0, 300);
}

/** Grundprüfung ohne Claude */
export function analysiere(text, { titel = "" } = {}) {
  const t = String(text || "").trim().slice(0, 40000);
  if (t.length < 15) throw new Error("Gib mir einen Text oder eine Behauptung (mindestens einen Satz).");
  const s = saetze(t);
  const funde = { kritiker: [], jurist: [], skeptiker: [] };
  const zaehl = {};
  for (const [rolle, titelR, re, frage] of REGELN) {
    if (!re) continue;
    const treffer = s.filter((x) => re.test(x));
    if (!treffer.length) continue;
    zaehl[titelR] = treffer.length;
    funde[rolle].push({ titel: titelR, frage, zitat: kurz(treffer[0], 200), anzahl: treffer.length });
  }
  // Quelle vorhanden?
  const hatQuelle = /https?:\/\/|\bquelle\b|\blaut\b|\bzufolge\b|\bstudie (von|der|des)\b|\(\d{4}\)|\[\d+\]/i.test(t);
  if (zaehl["Zahl ohne Quelle"] && hatQuelle) funde.skeptiker = funde.skeptiker.filter((f) => f.titel !== "Zahl ohne Quelle");
  if (!hatQuelle && s.length >= 3) funde.skeptiker.push({ titel: "Keine einzige Quelle", frage: "Nichts ist belegt. Wer soll das prüfen können?", zitat: "", anzahl: 1 });
  const gegenseite = /\b(aber|jedoch|allerdings|andererseits|zwar|trotzdem|kritiker|einwand|nachteil|risiko|gegenargument)\b/i.test(t);
  if (!gegenseite && s.length >= 2) funde.kritiker.push({ titel: "Nur eine Seite", frage: REGELN.find((r) => r[1] === "Fehlende Gegenseite")[3], zitat: "", anzahl: 1 });

  // Stärkste Gegenrede pro Rolle (ohne KI aus der Kernthese gebaut)
  const these = kernthese(s);
  const gegen = {
    kritiker: these ? `Angenommen, das Gegenteil von „${kurz(these, 120)}“ stimmt: Welche drei Beispiele würden das zeigen? Wenn sie dir leichtfallen, ist die These zu stark formuliert.` : "",
    skeptiker: these ? `Was müsste passieren, damit du „${kurz(these, 90)}“ nicht mehr glaubst? Gibt es dafür schon Hinweise?` : "",
    jurist: funde.jurist.length ? `Würdest du „${kurz(funde.jurist[0].zitat || these, 90)}“ genauso vor Gericht oder einem Abmahnanwalt sagen?` : "Rechtlich fällt mir nichts Auffälliges auf. Bei Veröffentlichung trotzdem Bilder, Namen und Werbeaussagen prüfen.",
  };
  const gesamt = funde.kritiker.length + funde.skeptiker.length + funde.jurist.length * 1.5;
  const angreifbar = Math.max(5, Math.min(100, Math.round(gesamt * 9 + (hatQuelle ? 0 : 12) + (gegenseite ? 0 : 8))));
  const e = {
    id: neueId(), at: new Date().toISOString(),
    titel: String(titel || "").slice(0, 140) || kurz(s[0] || t, 80),
    text: t.slice(0, 12000), saetze: s.length, these, hatQuelle, gegenseite, angreifbar,
    rollen: Object.fromEntries(Object.entries(ROLLEN).map(([k, r]) => [k, { ...r, funde: funde[k], gegen: gegen[k] }])),
    ki: null,
  };
  e.sprech = sprechText(e);
  const liste = store.load("gegenrede", []);
  liste.push(e);
  store.save("gegenrede", liste.slice(-30));
  logbuch.eintragen({ bereich: "gegenrede", titel: `Advocatus Diaboli: ${e.titel}`, details: `Angreifbarkeit ${angreifbar} %` });
  return e;
}
function sprechText(e) {
  const k = e.rollen.kritiker.funde[0], s = e.rollen.skeptiker.funde[0], j = e.rollen.jurist.funde[0];
  const teile = [`Angreifbarkeit ${e.angreifbar} Prozent.`];
  if (k) teile.push(`Der Kritiker sagt: ${k.titel}. ${k.frage}`);
  if (s) teile.push(`Der Skeptiker fragt: ${s.frage}`);
  if (j) teile.push(`Der Jurist warnt: ${j.titel}.`);
  if (teile.length === 1) teile.push("Ich finde keine offensichtliche Schwachstelle. Für die stärksten Gegenargumente nimm die KI-Prüfung.");
  return teile.join(" ");
}

/** Stärkste Gegenargumente mit Claude (braucht Guthaben). */
export async function mitKi(id) {
  const liste = store.load("gegenrede", []);
  const e = liste.find((x) => x.id === id) || liste.at(-1);
  if (!e) throw new Error("Erst einen Text prüfen.");
  const r = await denke({
    stufe: "mittel",
    quelle: "gegenrede",
    maxTokens: 2500,
    system: "Du bist ein Advocatus Diaboli. Du lieferst die STÄRKSTEN, fairen Gegenargumente zu einem Text – nicht Strohmänner. Antworte auf Deutsch, knapp, ohne Markdown-Tabellen. Gib genau dieses JSON zurück: {\"kritiker\":[\"…\",\"…\",\"…\"],\"jurist\":[\"…\",\"…\"],\"skeptiker\":[\"…\",\"…\",\"…\"],\"staerkste\":\"ein Satz: das gefährlichste Gegenargument\",\"verbessern\":[\"konkreter Tipp\",\"…\"]}. Jurist: deutsches Recht, kein Rechtsrat, nur Hinweise.",
    text: `Text:\n"""${e.text}"""`,
  });
  if (!r.ok) throw new Error(r.error || "Claude ist gerade nicht erreichbar.");
  let ki;
  try { ki = JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1)); } catch { ki = { frei: r.text }; }
  e.ki = { ...ki, model: r.model };
  store.save("gegenrede", liste);
  return e;
}
export const verlauf = () => store.load("gegenrede", []).slice().reverse().map(({ text, ...rest }) => ({ ...rest, text: text.slice(0, 300) }));
export const holen = (id) => store.load("gegenrede", []).find((x) => x.id === id) || null;

// ---------- Sprache ----------
const OEFFNEN = U(/^(öffne|oeffne|zeig|zeige|starte)( mir)?( den| das| die)? (advocatus diaboli|advokat des teufels|perspektiv-wechsler|perspektivwechsler|perspektiv wechsler|gegenrede|gegenargumente)\b/);
const PRUEFE = U(/^(?:advocatus diaboli|advokat des teufels|spiel (?:den )?(?:advocatus diaboli|advokat des teufels)|widersprich mir|was spricht dagegen,? dass|was spricht gegen|gegenargumente zu|gegenargumente für|gib mir gegenargumente( zu| für)?|zerleg|zerlege)[,:]? (.{12,})$/);

export function quickCommand(text) {
  const t = String(text || "").replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/i, "").trim();
  const k = t.toLowerCase();
  if (OEFFNEN.test(k) && k.split(" ").length <= 6) return { answer: "Advocatus Diaboli ist bereit. Füg einen Text ein oder sag: Widersprich mir, und dann deine Behauptung.", actions: ["gegenrede"] };
  const m = k.match(PRUEFE);
  if (m) {
    const start = k.indexOf(m[2]);
    const behauptung = t.slice(start, start + m[2].length);
    const e = analysiere(behauptung);
    return { answer: e.sprech, actions: ["gegenrede", `gegenrede:${e.id}`] };
  }
  return null;
}
