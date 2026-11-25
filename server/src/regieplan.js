// Regie-Anweisung verstehen (ohne Claude): Was Kevin ins Schnitt-Team schreibt, ist eine ANWEISUNG,
// kein Bildschirmtext. Hier wird der freie Text in echte Schnitt-Vorgaben übersetzt:
//   Thema (kurz), Tempo, Übergänge, Look/Farbe, Textmenge, Musik, Sprecher, Länge, Format,
//   Szenen-Reihenfolge („zeig zuerst … dann …“), Texte in Anführungszeichen, Aufruf am Ende,
//   und für „Clips schneiden“: Höchstlänge, beste Stellen, Fokus-Wörter, Untertitel, Ähms.
// Ergebnis enthält `verstanden` – eine Liste in einfachen Worten, was Friday daraus macht.
import { stimmungAus, STIMMUNGEN } from "./musik.js";

const kurz = (s, n = 160) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const gross = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const LOOK_NAMEN = {
  "natürlich": "natürlich", warm: "warm", "kühl": "kühl", kino: "Kino", schwarzweiss: "Schwarz-Weiß", retro: "Retro", neon: "Neon",
};

const FARBWORT = {
  rot: "#ff3b3b", orange: "#ff8a1e", gelb: "#ffd23f", gold: "#ffc44d", "grün": "#3ddc84", gruen: "#3ddc84",
  "türkis": "#2ee6d0", tuerkis: "#2ee6d0", blau: "#4f8dff", lila: "#a978ff", violett: "#a978ff", pink: "#ff3fa8", rosa: "#ff7ac8", "weiß": "#ffffff", weiss: "#ffffff",
};

// JavaScripts \b kennt keine Umlaute („über“, „weiß“) – darum eigene Wortgrenze mit Unicode.
const GRENZE = "(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))";
const R = (re, flags) => new RegExp((re.source || re).replace(/\\b/g, GRENZE), [...new Set(((flags ?? re.flags) || "") + "u")].join(""));

const ZAHLWORT = { zehn: 10, "fünfzehn": 15, fuenfzehn: 15, zwanzig: 20, "dreißig": 30, dreissig: 30, vierzig: 40, "fünfzig": 50, fuenfzig: 50, sechzig: 60, neunzig: 90 };

// Muster für Anweisungen. Was davon im Text steht, wird umgesetzt und aus dem Thema entfernt.
const M = {
  schnell: /\b(schnell(e[nrs]?)?\s+(schnitt\w*|tempo|geschnitten|cuts?|szenen(wechsel)?)|zügig\w*|zuegig\w*|rasant\w*|hektisch\w*|temporeich\w*|fast cuts?|viele (kurze )?szenen|kurze szenen|action(reich)?|mit (viel )?tempo|tiktok-?(tempo|stil|style)|dynamisch\w*)\b/i,
  ruhig: /\b(ruhig(e[nrs]?)?|langsam(e[nrs]?)?|gemütlich\w*|gemuetlich\w*|entspannt\w*|gelassen\w*|lange szenen|wenige szenen|cinematic|in ruhe)\b/i,
  hart: /\b(harte?n? (schnitte?|übergänge|uebergaenge)|ohne (übergänge|uebergaenge|blenden)|keine (übergänge|uebergaenge|blenden)|direkte?n? schnitte?|jump ?cuts?)\b/i,
  weich: /\b(weiche?n? (übergänge|uebergaenge|blenden)|überblend\w*|ueberblend\w*|sanfte?n? (übergänge|uebergaenge)|fließend\w*|fliessend\w*)\b/i,
  textOhne: /\b(ohne (text|texte|schrift|titel|einblendung\w*|überschrift\w*)|kein(e[nr]?)? (text|texte|schrift|titel|einblendung\w*)|nur (bilder|fotos|clips))\b/i,
  textWenig: /\b(wenig(er)? text|kurze texte?|minimalistisch|minimal|schlicht|clean)\b/i,
  sprecherJa: /\b((mit|und) (sprecher\w*|stimme|erzähler\w*|erzaehler\w*|voice-?over|kommentar)|sprich|vorlesen|vorgelesen|erzähl\w* (dazu|was)|vertonen|vertont)\b/i,
  sprecherNein: /\b(ohne (sprecher\w*|stimme|erzähler\w*|kommentar)|kein(en)? sprecher)\b/i,
  musikAus: /\b(ohne (musik|ton|sound)|keine musik|ganz still)\b/i,
  musikEigene: /\b((meine|eigene)[nr]? (musik|song|lied))\b/i,
  musikTeil: /\b(mit |und )?([\wäöüß-]+ )?(musik|sound|beat|song|soundtrack)\b/i,
  formatQuer: /\b(querformat|youtube|16[: ]9|breitbild|quer)\b/i,
  formatQuadrat: /\b(quadrat\w*|1[: ]1|instagram[- ]post)\b/i,
  formatHoch: /\b(hochformat|9[: ]16|reels?|tiktok|shorts?|story)\b/i,
  bilderEigene: /\b((meine[nr]?|eigene[nr]?) (clips|videos|fotos|bilder|aufnahmen)|aus dem eingang)\b/i,
  bilderGrafik: /\b(nur (grafik|neon)|ohne (fotos|bilder))\b/i,
  laenge: /\b(\d{1,3})\s*(?:-\s*)?(sekunden|sek\.?|sec|s|minuten|minute|min)\b/i,
  laengeWort: new RegExp(`\\b(${Object.keys(ZAHLWORT).join("|")}|eine?)\\s*(?:-\\s*)?(sekunden|minuten?)\\b`, "i"),
  cta: /\b(link in (der )?bio|folg\w* (uns|mir)( für mehr)?|abonnier\w*|ruf\w* (uns |mich )?an|besuch\w* (uns|mich)( vorbei)?|jetzt (buchen|kaufen|bestellen|anrufen|vorbeikommen|testen|anfragen)|schreib\w* (uns|mir)( eine nachricht)?|komm\w* vorbei)\b/i,
  // nur für „Clips schneiden“
  maxLaenge: /\b(?:auf|maximal|max\.?|höchstens|hoechstens|nicht länger als|nicht laenger als|unter|kürzen auf|kuerzen auf)\s*(\d{1,3})\s*(sekunden|sek\.?|sec|s|minuten|minute|min)\b/i,
  beste: /\b(beste[nr]?|besten|wichtigste[nr]?|stärkste[nr]?|staerkste[nr]?) (stellen|momente|szenen|teile|sätze|saetze)|highlights?|best[- ]of|das wichtigste|zusammenfassung|zusammenfassen\b/i,
  untertitelAus: /\b(ohne untertitel|keine untertitel|untertitel (weg|aus|raus))\b/i,
  aehmsDrin: /\b((ähms?|aehms?|füllwörter|fuellwoerter|pausen) (drin )?(lassen|behalten|nicht (raus|schneiden))|nicht schneiden|alles (drin )?lassen)\b/i,
  pausenHart: /\b(alle pausen raus|jede pause raus|ohne pausen|knackig|tight)\b/i,
};

for (const k of Object.keys(M)) M[k] = R(M[k]);

const LOOKS = [
  ["schwarzweiss", /\b(schwarz-?wei(ß|ss)|s\/w|graustufen|monochrom)\b/i],
  ["retro", /\b(retro|vintage|80er|90er|alte[rn]? film|nostalgisch\w*)\b/i],
  ["kino", /\b(kino(-?look)?|cinematic|filmisch\w*|wie (ein|im) (film|kino)|hollywood)\b/i],
  ["warm", /\b(warm(e[nr]?)?( farben| look| töne| toene| licht)?|golden(e[nr]?)?|sonnig\w*|sommerlich\w*)\b/i],
  ["kühl", /\b(kühl(e[nr]?)?|kuehl(e[nr]?)?|kalte?n? (farben|look|töne)|blaue?r? look)\b/i],
  ["neon", /\b(neon|cyber\w*|futuristisch\w*|hightech|high-tech|sci-?fi)\b/i],
  ["natürlich", /\b(natürlich(e[nr]?)? (farben|look)|realistisch\w*|echte farben)\b/i],
].map(([id, re]) => [id, R(re)]);

const ZIELE = [
  ["vorstellung", /\b(stell\w* (uns|mich|unser\w*|mein\w*|die firma|das team)\b.*\bvor|vorstell\w*|präsentier\w*|praesentier\w*|wer (wir|ich) (sind|bin)|über uns|ueber uns|unser team|unsere firma|imagefilm)\b/i],
  ["werbung", /\b(werbung|werbe\w*|werb\w*|verkauf\w*|angebot\w*|rabatt\w*|aktion\b|kunden gewinnen|produkt\w*)\b/i],
  ["erklaerung", /\b(erklär\w*|erklaer\w*|tutorial|anleitung|wie funktioniert|schritt für schritt|tipps?)\b/i],
  ["story", /\b(geschichte|story|erzähl\w*|erlebnis|reise|urlaub|vlog)\b/i],
].map(([id, re]) => [id, R(re)]);
const STOPP = R(/^(mein\w*|dein\w*|unser\w*|euer\w*|sein\w*|ihr\w*|der|die|das|den|dem|des|ein\w*|und|oder|ich|wir|es|wo|über|ueber|von|mit|zum|zur)$/i);
// Stimmungs-Wörter („lustig“, „edel“) steuern Musik/Look und gehören nicht ins Thema.
const STIMMUNGSWORT = R(/\b(lustig\w*|bunt\w*|fröhlich\w*|froehlich\w*|episch\w*|spannend\w*|dramatisch\w*|emotional\w*|cool\w*|modern\w*|edel\w*|elegant\w*|hochwertig\w*|professionell\w*|witzig\w*|chillig\w*|locker\w*|luxuriös\w*|premium|stylisch\w*|lebendig\w*|motivierend\w*|inspirierend\w*)\b/gi);

const FARB_RE = () => R(`\\b(?:in|farbe:?|farben:?|akzent\\w*:?)\\s+(${Object.keys(FARBWORT).join("|")})\\b|\\b(${Object.keys(FARBWORT).join("|")})e?[nrs]?\\s+(?:schrift|farbe|akzente?|text|titel|töne|toene|neon|look)\\b`, "gi");
/** Deutsche Farbe aus Wörtern wie „in Rot“, „orange Schrift“, „Farbe: Blau“. */
function farbeAus(t) {
  const w = Object.keys(FARBWORT).join("|");
  const m = R(`\\b(?:in|farbe:?|farben:?|akzent\\w*:?)\\s+(${w})\\b|\\b(${w})e?[nrs]?\\s+(?:schrift|farbe|akzente?|text|titel|töne|toene|neon|look)\\b`, "i").exec(t);
  const k = m && (m[1] || m[2]).toLowerCase();
  return k ? { wort: k, hex: FARBWORT[k] } : null;
}

function sekundenAus(t) {
  if (R(/\b(einminüt\w*|einminuet\w*|eine minute)\b/i).test(t)) return 60;
  const m = M.laenge.exec(t) || M.laengeWort.exec(t);
  if (!m) return null;
  const wert = /^\d+$/.test(m[1]) ? Number(m[1]) : ZAHLWORT[m[1].toLowerCase()] || 1;
  return /^min/i.test(m[2]) ? wert * 60 : wert;
}

/** Texte in Anführungszeichen oder nach „Text:“/„Titel:“ – die sollen wirklich so im Video stehen. */
function texteAus(roh) {
  const texte = [];
  let rest = roh;
  const q = /[„"“»‚']([^"“”«‘'\n]{2,80})["“”«‘']/g;
  rest = rest.replace(q, (_, inhalt) => { texte.push(kurz(inhalt, 80)); return " "; });
  rest = rest.replace(R(/\b(?:text|titel|überschrift|ueberschrift|schrift|einblendung|hook)\s*:\s*([^.,;!\n]{2,80})/gi), (_, inhalt) => { texte.push(kurz(inhalt, 80)); return " "; });
  return { texte: texte.filter((x) => x.length >= 2), rest };
}

/** „zeig zuerst unser Team, dann die Werkstatt und am Ende das Logo“ → ["unser Team", "die Werkstatt", "das Logo"] */
function szenenAus(t) {
  const m = R(/\b(?:szenen?\s*:|ablauf\s*:|zeig\w*\s+(?:zuerst|erst(mal)?|am anfang|zu beginn)?|zuerst|erst(?:mal)?|zu beginn|beginn\w* mit|start\w* mit|fang\w* mit)\s+(.+)$/i).exec(t);
  if (!m) return [];
  const teil = m[2] ?? m[1];
  const roh = String(m[m.length - 1] || teil || "");
  const stuecke = roh.split(R(/\s*(?:[,;.!]|\bund dann\b|\bdann\b|\bdanach\b|\banschließend\b|\banschliessend\b|\bzum schluss\b|\bam ende\b|\bzuletzt\b|\bund\b)\s*/i))
    .map((s) => s.replace(/^(zuerst|erst|noch|auch|mal|bitte)\s+/i, "").replace(/\s+(an|vor|bitte|zeigen|kommen|sehen)$/i, "").replace(/[.!?:]+$/, "").trim())
    .filter((s) => s.length >= 3 && s.split(" ").length <= 7 && !Object.values(M).some((re) => re.test(s)) && !LOOKS.some(([, re]) => re.test(s)));
  return stuecke.length >= 2 ? stuecke.slice(0, 12).map((s) => kurz(s, 50)) : [];
}

/** Kurzes Thema: Anweisungen raus, „Erstell ein Video über …“ raus, höchstens ~60 Zeichen. */
const VERB_START = R(/^(?:(?:hey|hallo) )?(?:friday[,:]?\s*)?(?:bitte\s+)?(?:mach|erstell|bau|produzier|generier|dreh|schneid|zauber|kreier|gestalt)\w*\s+(?:mir|uns)?\s*(?:bitte\s+|mal\s+)*(?:ein(?:en|e)?|n|nen)?\s*(?:[\w-]*\s*)?(?:kurz)?(?:video|clip|reel|film|short|tiktok|imagefilm)s?\b\s*/i);
function kernAus(rest, szenen) {
  const teile = rest.split(/[.;!?\n]+|,\s*/).map((s) => s.trim()).filter(Boolean);
  const behalten = [];
  for (const s of teile) {
    let x = s;
    for (const re of Object.values(M)) x = x.replace(R(re, "gi"), " ");
    for (const [, re] of LOOKS) x = x.replace(R(re, "gi"), " ");
    x = x.replace(/\s+/g, " ").trim().replace(VERB_START, "").replace(R(/^(?:über|ueber|zum thema|von|zu)\s+/i), "");
    // „es soll um X gehen“ / „es geht um X“ / „worum es geht: X“
    x = x.replace(R(/^(?:und\s+)?(?:es\s+)?(?:soll(?:te)?|geht|muss)\s+(?:es\s+)?(?:um|über|ueber)\s+(.+?)(?:\s+gehen)?$/i), "$1");
    x = x.replace(R(/^(?:worum es geht|es geht um|thema)\s*:?\s*/i), "");
    // „stell uns/unsere Firma vor“ → „unsere Firma“ / „uns“
    x = x.replace(R(/^stell\w*\s+(.+?)\s+vor$/i), "$1").replace(R(/^präsentier\w*\s+/i), "");
    x = x.replace(R(/^(werbung|werbevideo|werbeclip|imagefilm|tutorial|anleitung|vlog|story)$/i), "");
    x = x.replace(R(/^meine[nm]?\b/i), "Mein").replace(R(/^unsere[nm]?\b/i), (z) => (/^unsere$/i.test(z) ? "Unsere" : "Unser"));
    x = x.replace(STIMMUNGSWORT, " ").replace(FARB_RE(), " ");
    if (szenen.length) x = x.replace(R(/\b(zeig\w*|zuerst|erst|dann|danach|am ende|zum schluss)\b.*$/i), " ");
    x = x.replace(R(/\b(bitte|mal|danke|gerne?)\b/gi), " ")
      .replace(R(/^\s*(?:ein(?:en|e)?\s+)?(?:video|clip|reel|film)s?\b/i), " ")
      .replace(R(/^\s*(?:über|ueber|zum thema|von|zu)\s+/i), "")
      .replace(/\s+/g, " ").trim()
      .replace(R(/^(mit|ohne|und|oder|im|in|als|aber|sehr|richtig|wirklich|so|viel|ganz)\b\s*/i), "")
      .replace(R(/\s*\b(mit|ohne|und|oder|im|in|als|aber|sehr|richtig|wirklich|so|viel|ganz|einem?|einer|der|die|das|den|dem)$/i), "")
      .trim();
    if (x && R(/[\p{L}\p{N}]{2,}/).test(x) && !R(/^(und|oder|mit|ohne|in|im|der|die|das|uns)$/i).test(x)) behalten.push(x);
    else if (R(/^uns$/i).test(x)) behalten.push("Wir");
  }
  let kern = behalten.join(", ").replace(/\s+,/g, ",").trim();
  if (kern.length > 60) kern = behalten[0] || kern;
  kern = kurz(kern, 60).replace(/[,:\-–\s]+$/, "");
  return gross(kern);
}

/**
 * Freien Auftragstext in einen Regie-Plan übersetzen.
 * @param {string} text  was Kevin geschrieben oder gesagt hat
 * @param {{art?: "studio"|"schnitt"}} opt
 */
export function leseAnweisung(text = "", { art = "studio" } = {}) {
  const roh = kurz(text, 900);
  const { texte, rest } = texteAus(roh);
  const t = rest.toLowerCase();
  const plan = {
    roh, kern: "", ziel: null, tempo: null, uebergang: null, look: null, farbe: null, textmenge: null,
    sprecher: null, musik: null, sekunden: null, format: null, bilder: null, szenen: [], texte, cta: null,
    // Clips schneiden
    maxSekunden: null, auswahl: null, fokus: [], untertitel: null, aehms: null, pausen: null,
    verstanden: [],
  };
  const v = (s) => plan.verstanden.push(s);

  for (const [id, re] of ZIELE) if (re.test(t)) { plan.ziel = id; break; }
  if (M.schnell.test(t)) plan.tempo = "schnell";
  else if (M.ruhig.test(t) && !R(/\bruhig\w* (musik|sound|beat)\b/i).test(t)) plan.tempo = "ruhig";
  if (M.hart.test(t)) plan.uebergang = "hart";
  else if (M.weich.test(t)) plan.uebergang = "weich";
  for (const [id, re] of LOOKS) if (re.test(t)) { plan.look = id; break; }
  if (!plan.look && R(/\b(edel|elegant|hochwertig|luxus|luxuriös|premium|high-?end)\w*\b/i).test(t)) plan.look = "kino";
  plan.farbe = farbeAus(t);
  if (M.textOhne.test(t)) plan.textmenge = "ohne";
  else if (M.textWenig.test(t)) plan.textmenge = "wenig";
  if (M.sprecherNein.test(t)) plan.sprecher = false;
  else if (M.sprecherJa.test(t)) plan.sprecher = true;
  if (M.musikAus.test(t)) plan.musik = "aus";
  else if (M.musikEigene.test(t)) plan.musik = "eigene";
  else {
    const teil = M.musikTeil.exec(t)?.[0] || "";
    const st = teil ? stimmungAus(teil) : null;
    if (st) plan.musik = st;
  }
  if (M.formatQuer.test(t)) plan.format = "quer";
  else if (M.formatQuadrat.test(t)) plan.format = "quadrat";
  else if (M.formatHoch.test(t)) plan.format = "hoch";
  if (M.bilderEigene.test(t)) plan.bilder = "eigene";
  else if (M.bilderGrafik.test(t)) plan.bilder = "grafik";
  const ende = R(/\b(?:am ende|zum schluss|zuletzt|abspann|schluss)\s*:\s*([^.;!\n]{2,60})/i).exec(roh);
  const cta = M.cta.exec(rest);
  if (ende) plan.cta = gross(kurz(ende[1].replace(/^[„"“»]|["“”«]$/g, ""), 50));
  else if (cta) plan.cta = gross(kurz(cta[0], 40));

  if (art === "schnitt") {
    const mx = M.maxLaenge.exec(t);
    if (mx) plan.maxSekunden = /^min/i.test(mx[2]) ? Number(mx[1]) * 60 : Number(mx[1]);
    if (M.beste.test(t)) plan.auswahl = "beste";
    const fk = R(/\b(?:nur )?(?:die )?(?:stellen|teile|szenen|sätze|saetze|momente)[,]? (?:wo|in denen|über|ueber|mit|zu|zum thema|bei denen)\s+(?:ich |wir |es )?(?:über |ueber |von )?([^.;,\n]{2,60})/i).exec(rest);
    if (fk) plan.fokus = fk[1].split(/\s+(?:und|oder)\s+|\s*,\s*/).map((w) => w.replace(R(/\b(rede|reden|spreche|sprechen|geht|gehts|redet|erzähle|erzählen)\b/gi), "").replace(/\s+/g, " ").trim()).flatMap((w) => w.split(" ")).filter((w) => w.length > 2 && !STOPP.test(w)).slice(0, 6);
    if (M.untertitelAus.test(t)) plan.untertitel = false;
    else if (R(/\b(mit untertitel|untertitel (an|rein|dazu))\b/i).test(t)) plan.untertitel = true;
    if (M.aehmsDrin.test(t)) plan.aehms = "drin";
    if (M.pausenHart.test(t) || plan.tempo === "schnell") plan.pausen = "hart";
    else if (plan.tempo === "ruhig") plan.pausen = "sanft";
  } else {
    plan.sekunden = sekundenAus(t);
  }

  plan.szenen = szenenAus(rest);
  plan.kern = kernAus(rest, plan.szenen) || (plan.szenen.length ? gross(plan.szenen[0]) : "") || (texte[0] || "");

  // Was Friday daraus macht – in einfachen Worten
  if (plan.kern && art !== "schnitt") v(`Thema: ${plan.kern}`);
  if (plan.ziel) v({ vorstellung: "Ziel: euch vorstellen (wer ihr seid, was ihr macht, warum man euch wählen sollte)", werbung: "Ziel: Werbung, mit klarem Nutzen und Aufruf am Ende", erklaerung: "Ziel: erklären, Schritt für Schritt", story: "Ziel: als kleine Geschichte erzählen" }[plan.ziel]);
  if (plan.szenen.length) v(`Szenen in deiner Reihenfolge: ${plan.szenen.join(" → ")}`);
  if (plan.tempo === "schnell") v(art === "schnitt" ? "Schnelles Tempo: Pausen knallhart raus, enger Schnitt" : "Schnelles Tempo: viele kurze Szenen, kurze Übergänge, stärkerer Zoom");
  if (plan.tempo === "ruhig") v(art === "schnitt" ? "Ruhiges Tempo: kurze Atempausen bleiben drin" : "Ruhiges Tempo: wenige lange Szenen, weiche Blenden, sanfter Zoom");
  if (plan.uebergang === "hart") v("Harte Schnitte statt Blenden");
  if (plan.uebergang === "weich") v("Weiche Überblendungen");
  if (plan.look) v(`Farb-Look: ${LOOK_NAMEN[plan.look]}`);
  if (plan.farbe) v(`Akzentfarbe: ${plan.farbe.wort}`);
  if (plan.textmenge === "ohne") v("Kein Text im Bild" + (texte.length || plan.cta ? " (außer deinen Texten in Anführungszeichen/dem Aufruf)" : ""));
  if (plan.textmenge === "wenig") v("Wenig Text: nur kurze Hauptzeilen");
  if (texte.length) v(`Diese Texte kommen genau so ins Video: ${texte.map((x) => `„${x}“`).join(", ")}`);
  if (plan.cta) v(`Aufruf am Ende: ${plan.cta}`);
  if (plan.musik) v(plan.musik === "aus" ? "Ohne Musik" : plan.musik === "eigene" ? "Deine Musik aus dem Ordner Musik" : `Musik: ${STIMMUNGEN[plan.musik]?.name || plan.musik}`);
  if (plan.sprecher === true) v("Mit Sprecher");
  if (plan.sprecher === false) v("Ohne Sprecher");
  if (plan.sekunden) v(`Länge: ${plan.sekunden} Sekunden`);
  if (plan.format) v(`Format: ${{ hoch: "9:16 Hochformat", quer: "16:9 Querformat", quadrat: "1:1 Quadrat" }[plan.format]}`);
  if (plan.bilder === "eigene") v("Mit deinen eigenen Clips und Fotos");
  if (plan.bilder === "grafik") v("Nur Neon-Grafik, keine Fotos");
  if (plan.maxSekunden) v(`Höchstens ${plan.maxSekunden} Sekunden lang`);
  if (plan.auswahl === "beste") v("Nur die stärksten Stellen behalten");
  if (plan.fokus.length) v(`Nur Stellen über: ${plan.fokus.join(", ")}`);
  if (plan.untertitel === false) v("Ohne Untertitel");
  if (plan.aehms === "drin") v("Ähms und Pausen bleiben drin");
  return plan;
}

/** Regie-Werte fürs Studio: Szenenzahl, Übergang, Zoom, ffmpeg-Look. */
export const LOOK_FILTER = {
  "natürlich": "eq=contrast=1.05:saturation=1.08",
  warm: "eq=contrast=1.06:saturation=1.12,colorbalance=rs=0.05:bs=-0.05:rm=0.03:bm=-0.03",
  "kühl": "colorbalance=rs=-0.04:bs=0.05,eq=contrast=1.05:saturation=1.02",
  kino: "eq=contrast=1.12:saturation=0.92,colorbalance=bs=0.06:rs=-0.02:rh=0.05:bh=-0.04,vignette=PI/5",
  schwarzweiss: "hue=s=0,eq=contrast=1.12:brightness=0.01",
  retro: "curves=preset=vintage,eq=saturation=0.9,vignette=PI/4",
  neon: "eq=contrast=1.1:saturation=1.3,colorbalance=rs=0.04:bs=0.06:gm=-0.02",
};
