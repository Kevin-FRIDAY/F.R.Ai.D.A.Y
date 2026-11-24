// Zeit & Kalender.
import { nr, zahl, text, de, heute, jetztUhr, tagNr, ausTagNr, wochentag, isoTag, datumText, datum, pflichtDatum, uhrzeit, uhrText, dauerText, WOCHENTAGE } from "./hilfe.js";
import { feiertageOffline } from "../offline-plus.js";

const G = "Zeit & Kalender";
const D = "(\\d{1,2}\\.\\s?\\d{1,2}\\.?(?:\\d{2,4})?|\\d{1,2}\\.? [a-zäöü]+(?: \\d{4})?|heute|morgen)";
const U = "(\\d{1,2}(?:[:.]\\d{2})?)";

function feiertagMap(von, bis) {
  const m = new Map();
  for (let y = von; y <= bis; y++) for (const f of feiertageOffline(y)) m.set(f.datum, f.name);
  return m;
}
function plusMonate(t, n) {
  const gesamt = t.y * 12 + (t.m - 1) + n, y = Math.floor(gesamt / 12), m = (gesamt % 12) + 1;
  const letzter = ausTagNr(tagNr({ y: m === 12 ? y + 1 : y, m: m === 12 ? 1 : m + 1, d: 1 }) - 1).d;
  return { y, m, d: Math.min(t.d, letzter) };
}
function differenz(a, b) {
  // Jahre, Monate, Tage zwischen a <= b
  let j = b.y - a.y, mo = b.m - a.m, d = b.d - a.d;
  if (d < 0) { mo--; d += ausTagNr(tagNr({ y: b.y, m: b.m, d: 1 }) - 1).d; }
  if (mo < 0) { j--; mo += 12; }
  return { j, mo, d };
}
const teil = (n, eins, viele) => (n ? `${n} ${n === 1 ? eins : viele}` : "");
const und = (a) => { const x = a.filter(Boolean); return x.length > 1 ? `${x.slice(0, -1).join(", ")} und ${x.at(-1)}` : x[0] || "0 Tage"; };

export default [
  {
    id: "datum_rechnen", titel: "Datum rechnen", icon: "📆", gruppe: G,
    info: "Welches Datum ist in 90 Tagen, 6 Wochen oder 3 Monaten?",
    felder: [{ k: "start", label: "Start-Datum", typ: "datum", standard: "heute" }, { k: "richtung", label: "Richtung", typ: "wahl", optionen: ["plus", "minus"], standard: "plus" }, { k: "anzahl", label: "Anzahl", typ: "zahl" }, { k: "einheit", label: "Einheit", typ: "wahl", optionen: ["Tage", "Werktage", "Wochen", "Monate", "Jahre"], standard: "Tage" }],
    sprache: [
      [/^(?:welches datum (?:ist|haben wir)|was ist|welcher tag ist|wann ist|welches datum ist)(?: heute)? in (\d+) (tag|tage|tagen|woche|wochen|monat|monate|monaten|jahr|jahre|jahren|werktag|werktage|werktagen)$/, (m) => ({ anzahl: m[1], einheit: einheitAus(m[2]) })],
      [/^(?:welches datum ist|was ist|welcher tag ist|wann ist|welches datum hat) (\d+) (tag|tage|tagen|woche|wochen|monat|monate|monaten|jahr|jahre|jahren|werktag|werktage|werktagen) (nach|vor) (?:dem |der |den )?(.{3,30})$/, (m) => ({ anzahl: m[1], einheit: einheitAus(m[2]), richtung: m[3] === "vor" ? "minus" : "plus", start: m[4] })],
      [/^(?:welches datum war|was war|welcher tag war) vor (\d+) (tag|tage|tagen|woche|wochen|monat|monate|monaten|jahr|jahre|jahren)$/, (m) => ({ anzahl: m[1], einheit: einheitAus(m[2]), richtung: "minus" })],
    ],
    run(e) {
      const s = datum(e.start || "heute") || heute(), n = Math.round(zahl(e, "anzahl", "die Anzahl", { min: 0, max: 100000 })) * (e.richtung === "minus" ? -1 : 1);
      const ein = e.einheit || "Tage";
      let z;
      if (ein === "Wochen") z = ausTagNr(tagNr(s) + 7 * n);
      else if (ein === "Monate") z = plusMonate(s, n);
      else if (ein === "Jahre") z = plusMonate(s, 12 * n);
      else if (ein === "Werktage") {
        const ft = feiertagMap(s.y - 1, s.y + Math.ceil(Math.abs(n) / 200) + 1); let k = tagNr(s), rest = Math.abs(n), dir = Math.sign(n) || 1;
        while (rest > 0) { k += dir; const t = ausTagNr(k), w = wochentag(t); if (w && w !== 6 && !ft.has(isoTag(t))) rest--; }
        z = ausTagNr(k);
      } else z = ausTagNr(tagNr(s) + n);
      return { text: `${Math.abs(n)} ${ein} ${n < 0 ? "vor" : "nach"} dem ${datumText(s, { mitTag: false })} ist ${datumText(z)}.` };
    },
  },
  {
    id: "zeitspanne", titel: "Tage zwischen zwei Daten", icon: "↔️", gruppe: G,
    info: "Wie viele Tage, Wochen und Monate zwischen zwei Daten liegen.",
    felder: [{ k: "von", label: "Von", typ: "datum", standard: "heute" }, { k: "bis", label: "Bis", typ: "datum" }],
    sprache: [[new RegExp(`^wie ?viele tage (?:liegen |sind )?zwischen (?:dem )?${D} und (?:dem )?${D}$`), (m) => ({ von: m[1], bis: m[2] })]],
    run(e) {
      let a = pflichtDatum(e, "von", "das Start-Datum"), b = pflichtDatum(e, "bis", "das End-Datum");
      if (tagNr(b) < tagNr(a)) [a, b] = [b, a];
      const tage = tagNr(b) - tagNr(a), d = differenz(a, b);
      return { text: `Zwischen ${datumText(a, { mitTag: false })} und ${datumText(b, { mitTag: false })} liegen ${de(tage, 0)} Tage, das sind ${de(tage / 7, 1)} Wochen oder ${und([teil(d.j, "Jahr", "Jahre"), teil(d.mo, "Monat", "Monate"), teil(d.d, "Tag", "Tage")])}.` };
    },
  },
  {
    id: "alter", titel: "Alters-Rechner", icon: "🎂", gruppe: G,
    info: "Alter in Jahren und Tagen, Wochentag der Geburt, Tage bis zum Geburtstag.",
    felder: [{ k: "geburt", label: "Geburtsdatum", typ: "datum" }],
    sprache: [[new RegExp(`^wie alt (?:bin ich|ist man|ist jemand|wäre ich),? (?:wenn|der|die) (?:ich |man |er |sie )?(?:am )?${D} geboren (?:bin|ist|wurde)$`), (m) => ({ geburt: m[1] })]],
    run(e) {
      const g = pflichtDatum(e, "geburt", "das Geburtsdatum"), h = heute();
      if (tagNr(g) > tagNr(h)) throw new Error("Das Datum liegt in der Zukunft.");
      const d = differenz(g, h), tage = tagNr(h) - tagNr(g);
      let n = { y: h.y, m: g.m, d: g.m === 2 && g.d === 29 ? 28 : g.d };
      if (tagNr(n) < tagNr(h)) n = { ...n, y: h.y + 1 };
      const bis = tagNr(n) - tagNr(h);
      return { text: `Du bist ${d.j} Jahre, ${d.mo} Monate und ${d.d} Tage alt, das sind ${de(tage, 0)} Tage. Geboren an einem ${WOCHENTAGE[wochentag(g)]}. ${bis === 0 ? "Heute ist dein Geburtstag – alles Gute!" : `Noch ${bis} Tage bis zum ${d.j + 1}. Geburtstag.`}` };
    },
  },
  {
    id: "arbeitstage", titel: "Arbeitstage zählen", icon: "💼", gruppe: G,
    info: "Werktage zwischen zwei Daten (ohne Wochenende und bundesweite Feiertage).",
    felder: [{ k: "von", label: "Von", typ: "datum", standard: "heute" }, { k: "bis", label: "Bis (einschließlich)", typ: "datum" }],
    sprache: [[new RegExp(`^wie ?viele (?:arbeitstage|werktage) (?:sind es |habe ich |hab ich )?(?:noch )?bis (?:zum )?${D}$`), (m) => ({ von: "heute", bis: m[1] })]],
    run(e) {
      let a = pflichtDatum(e, "von", "das Start-Datum"), b = pflichtDatum(e, "bis", "das End-Datum");
      if (tagNr(b) < tagNr(a)) [a, b] = [b, a];
      if (tagNr(b) - tagNr(a) > 3660) throw new Error("Höchstens 10 Jahre auf einmal.");
      const ft = feiertagMap(a.y, b.y); let n = 0; const frei = [];
      for (let k = tagNr(a); k <= tagNr(b); k++) { const t = ausTagNr(k), w = wochentag(t); if (!w || w === 6) continue; if (ft.has(isoTag(t))) { frei.push(ft.get(isoTag(t))); continue; } n++; }
      return { text: `Vom ${datumText(a, { mitTag: false })} bis ${datumText(b, { mitTag: false })} sind es ${n} Arbeitstage${frei.length ? `, ${frei.length === 1 ? "ein Feiertag fällt" : `${frei.length} Feiertage fallen`} weg (${[...new Set(frei)].join(", ")})` : ""}.`, hinweis: "Nur bundesweite Feiertage. Feiertage deines Bundeslandes können dazukommen." };
    },
  },
  {
    id: "brueckentage", titel: "Brückentage", icon: "🌉", gruppe: G,
    info: "Mit wenig Urlaub viele freie Tage: die besten Brückentage im Jahr.",
    felder: [{ k: "jahr", label: "Jahr", typ: "zahl", standard: String(new Date().getFullYear() + (new Date().getMonth() >= 10 ? 1 : 0)) }],
    sprache: [[/^(?:wann sind |welche |zeig mir (?:die )?)?brückentage(?: (?:im jahr |für |in )?(\d{4}))?$|^(?:wie|wann) (?:kann ich|lohnt sich) (?:am besten )?urlaub (?:nehmen|machen)(?: (?:im jahr |in )?(\d{4}))?$/, (m) => ({ jahr: m[1] || m[2] || String(heute().m >= 11 ? heute().y + 1 : heute().y) })]],
    run(e) {
      const y = Math.round(zahl(e, "jahr", "das Jahr", { min: 1900, max: 2200 }));
      const zeilen = [];
      for (const f of feiertageOffline(y)) {
        const [yy, mm, dd] = f.datum.split("-").map(Number), t = { y: yy, m: mm, d: dd }, w = wochentag(t);
        if (w === 2) zeilen.push([f.name, datumText(t), `Montag ${datumText(ausTagNr(tagNr(t) - 1), { mitTag: false })}`, "1 Tag Urlaub → 4 Tage frei"]);
        if (w === 4) zeilen.push([f.name, datumText(t), `Freitag ${datumText(ausTagNr(tagNr(t) + 1), { mitTag: false })}`, "1 Tag Urlaub → 4 Tage frei"]);
        if (w === 3) zeilen.push([f.name, datumText(t), "Mo+Di oder Do+Fr", "2 Tage Urlaub → 5 Tage frei"]);
      }
      // Weihnachten bis Neujahr: wie viele Urlaubstage für die ganze Zeit?
      const ft = feiertagMap(y, y + 1), frei = (t) => { const w = wochentag(t); return !w || w === 6 || ft.has(isoTag(t)); };
      let s = tagNr({ y, m: 12, d: 24 }), en = tagNr({ y: y + 1, m: 1, d: 1 });
      while (frei(ausTagNr(s - 1))) s--;
      while (frei(ausTagNr(en + 1))) en++;
      let urlaub = 0; for (let k = s; k <= en; k++) if (!frei(ausTagNr(k))) urlaub++;
      zeilen.push(["Weihnachten & Silvester", `${datumText(ausTagNr(s), { mitTag: false })} – ${datumText(ausTagNr(en), { mitTag: false })}`, `${urlaub} Urlaubstage (24. und 31.12. oft nur halbe Tage)`, `${urlaub} Tage Urlaub → ${en - s + 1} Tage frei`]);
      return { text: zeilen.length > 1 ? `${y} gibt es ${zeilen.length === 2 ? "einen guten Brückentag" : `${zeilen.length - 1} gute Brückentage`}, zum Beispiel ${zeilen[0][0]}: ${zeilen[0][3]}. Und mit ${urlaub} Urlaubstagen hast du von Weihnachten bis Neujahr ${en - s + 1} Tage frei.` : `${y} fallen die bundesweiten Feiertage leider ungünstig. Mit ${urlaub} Urlaubstagen hast du aber von Weihnachten bis Neujahr ${en - s + 1} Tage frei.`, tabelle: { kopf: ["Feiertag", "Datum", "Urlaub nehmen", "Ergebnis"], zeilen }, hinweis: "Nur bundesweite Feiertage.", zeigen: true };
    },
  },
  {
    id: "uhrzeit_rechnen", titel: "Uhrzeit rechnen", icon: "🕐", gruppe: G,
    info: "Uhrzeit plus oder minus Stunden und Minuten.",
    felder: [{ k: "zeit", label: "Uhrzeit (leer = jetzt)", typ: "text", platzhalter: "14:30" }, { k: "richtung", label: "Richtung", typ: "wahl", optionen: ["plus", "minus"], standard: "plus" }, { k: "stunden", label: "Stunden", typ: "zahl", standard: "0" }, { k: "minuten", label: "Minuten", typ: "zahl", standard: "0" }],
    sprache: [
      [new RegExp(`^(?:wie spät ist es|wie viel uhr ist es|welche uhrzeit ist es) in (\\d+(?:,\\d+)?) stunden?(?: und (\\d+) minuten?)?$`), (m) => ({ stunden: m[1], minuten: m[2] || 0 })],
      [new RegExp(`^(?:was ist |wann ist )?${U}(?: uhr)? (plus|minus) (\\d+(?:,\\d+)?) stunden?(?: und (\\d+) minuten?)?$`), (m) => ({ zeit: m[1], richtung: m[2], stunden: m[3], minuten: m[4] || 0 })],
    ],
    run(e) {
      const j = jetztUhr(), s = e.zeit ? uhrzeit(e.zeit) : j.h * 60 + j.mi;
      if (s == null) throw new Error("Die Uhrzeit verstehe ich nicht. Schreib z. B. 14:30.");
      const d = (nr(e.stunden) || 0) * 60 + (nr(e.minuten) || 0), z = s + (e.richtung === "minus" ? -d : d);
      const tage = Math.floor(z / 1440);
      return { text: `${uhrText(s)} ${e.richtung === "minus" ? "minus" : "plus"} ${dauerText(d)} ist ${uhrText(z)}${tage > 0 ? ", am nächsten Tag" : tage < 0 ? ", am Vortag" : ""}.` };
    },
  },
  {
    id: "feierabend", titel: "Feierabend-Rechner", icon: "🏁", gruppe: G,
    info: "Wann du Feierabend hast – mit gesetzlicher Pause.",
    felder: [{ k: "start", label: "Arbeitsbeginn", typ: "text", platzhalter: "7:30" }, { k: "stunden", label: "Arbeitszeit (Stunden)", typ: "zahl", standard: "8" }, { k: "pause", label: "Pause in Minuten (leer = gesetzlich)", typ: "zahl" }],
    sprache: [[new RegExp(`^wann (?:habe|hab) ich feierabend,? (?:wenn|da|weil) ich (?:um )?${U}(?: uhr)? (?:angefangen|begonnen|gekommen|gestartet) (?:habe|hab|bin)(?: und (\\d+(?:,\\d+)?) stunden arbeite)?$|^feierabend bei (?:start|beginn) (?:um )?${U}(?: uhr)?$`), (m) => ({ start: m[1] || m[3], stunden: m[2] || 8 })]],
    run(e) {
      const s = uhrzeit(e.start);
      if (s == null) throw new Error("Bitte gib den Arbeitsbeginn an, z. B. 7:30.");
      const h = nr(e.stunden) || 8, gesetz = h > 9 ? 45 : h > 6 ? 30 : 0, p = nr(e.pause) ?? gesetz;
      const ende = s + h * 60 + p;
      return { text: `Start ${uhrText(s)}, ${dauerText(h * 60)} Arbeit plus ${p} Minuten Pause: Feierabend um ${uhrText(ende)}.${p < gesetz ? ` Achtung: gesetzlich sind mindestens ${gesetz} Minuten Pause vorgeschrieben.` : ""}${h > 10 ? " Mehr als 10 Stunden am Tag erlaubt das Arbeitszeitgesetz nicht." : ""}` };
    },
  },
  {
    id: "stunden_summe", titel: "Stundenzettel", icon: "🗒️", gruppe: G,
    info: "Arbeitszeiten zusammenrechnen, mit Pausen und Überstunden.",
    felder: [{ k: "zeiten", label: "Pro Zeile: Beginn-Ende Pause(min)", typ: "textarea", platzhalter: "Mo 8:00-16:30 30\nDi 7:45-17:00 45\nMi 8:00-12:00" }, { k: "soll", label: "Soll-Stunden pro Tag", typ: "zahl", standard: "8" }],
    run(e) {
      const zeilen = [], soll = nr(e.soll) ?? 8; let summe = 0;
      for (const z of text(e, "zeiten", "die Arbeitszeiten").split("\n").map((x) => x.trim()).filter(Boolean)) {
        const m = z.match(/(\d{1,2}[:.]\d{2}|\d{1,2})\s*(?:-|–|bis)\s*(\d{1,2}[:.]\d{2}|\d{1,2})(?:\s+(\d+))?/);
        if (!m) { zeilen.push([z, "nicht verstanden", ""]); continue; }
        let a = uhrzeit(m[1]), b = uhrzeit(m[2]);
        if (a == null || b == null) { zeilen.push([z, "nicht verstanden", ""]); continue; }
        if (b < a) b += 1440;
        const netto = b - a - (+m[3] || 0); summe += netto;
        zeilen.push([z, dauerText(netto), `${netto - soll * 60 >= 0 ? "+" : "−"}${dauerText(Math.abs(netto - soll * 60))}`]);
      }
      const tage = zeilen.filter((z) => z[1] !== "nicht verstanden").length, diff = summe - tage * soll * 60;
      if (!tage) throw new Error("Ich habe keine Zeiten gefunden. Schreib z. B. „8:00-16:30 30“.");
      return { text: `An ${tage} Tagen hast du ${dauerText(summe)} gearbeitet. ${diff >= 0 ? `Das sind ${dauerText(diff)} Überstunden.` : `Es fehlen ${dauerText(-diff)}.`}`, tabelle: { kopf: ["Eintrag", "Arbeitszeit", "Saldo"], zeilen } };
    },
  },
  {
    id: "ics_termin", titel: "Kalender-Datei (.ics)", icon: "📅", gruppe: G,
    info: "Erstellt eine Termin-Datei für Apple-, Google- oder Outlook-Kalender.",
    felder: [{ k: "titel", label: "Titel", typ: "text" }, { k: "datum", label: "Datum", typ: "datum" }, { k: "zeit", label: "Uhrzeit (leer = ganztägig)", typ: "text", platzhalter: "18:00" }, { k: "dauer", label: "Dauer in Minuten", typ: "zahl", standard: "60" }, { k: "ort", label: "Ort (optional)", typ: "text" }, { k: "erinnerung", label: "Erinnerung … Minuten vorher", typ: "zahl", standard: "30" }],
    run(e) {
      const ti = text(e, "titel", "einen Titel", { max: 200 }), d = pflichtDatum(e, "datum", "das Datum"), zt = e.zeit ? uhrzeit(e.zeit) : null;
      const esc = (s) => String(s).replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
      const p2 = (n) => String(n).padStart(2, "0"), tag = `${d.y}${p2(d.m)}${p2(d.d)}`;
      let start, ende;
      if (zt == null) { const n = ausTagNr(tagNr(d) + 1); start = `DTSTART;VALUE=DATE:${tag}`; ende = `DTEND;VALUE=DATE:${n.y}${p2(n.m)}${p2(n.d)}`; }
      else {
        const dauer = nr(e.dauer) || 60, emin = zt + dauer, ed = ausTagNr(tagNr(d) + Math.floor(emin / 1440)), em = emin % 1440;
        start = `DTSTART:${tag}T${p2(Math.floor(zt / 60))}${p2(zt % 60)}00`; ende = `DTEND:${ed.y}${p2(ed.m)}${p2(ed.d)}T${p2(Math.floor(em / 60))}${p2(em % 60)}00`;
      }
      const jetzt = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z", er = nr(e.erinnerung);
      const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Friday//Werkzeugkasten//DE", "BEGIN:VEVENT", `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@friday`, `DTSTAMP:${jetzt}`, start, ende, `SUMMARY:${esc(ti)}`,
        ...(e.ort ? [`LOCATION:${esc(e.ort)}`] : []), ...(er > 0 ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(ti)}`, `TRIGGER:-PT${Math.round(er)}M`, "END:VALARM"] : []), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
      return { text: `Die Kalender-Datei für „${ti}“ am ${datumText(d)}${zt != null ? ` um ${uhrText(zt)}` : ""} ist fertig. Antippen öffnet sie im Kalender.`, datei: { name: `${ti.replace(/[^\wäöüÄÖÜß -]/g, "").slice(0, 40) || "termin"}.ics`, typ: "text/calendar", inhalt: ics }, zeigen: true };
    },
  },
  {
    id: "schlafrechner", titel: "Schlaf-Rechner", icon: "😴", gruppe: G,
    info: "Beste Zeit zum Einschlafen oder Aufstehen nach 90-Minuten-Schlafzyklen.",
    felder: [{ k: "modus", label: "Ich will …", typ: "wahl", optionen: ["um X aufstehen", "um X ins Bett"], standard: "um X aufstehen" }, { k: "zeit", label: "Uhrzeit (leer = jetzt)", typ: "text", platzhalter: "6:30" }],
    sprache: [
      [new RegExp(`^wann (?:soll|muss|sollte) ich ins bett(?: gehen)?,? (?:wenn|damit|weil) ich (?:um )?${U}(?: uhr)? (?:aufstehe|aufstehen muss|aufstehen will|aufwachen will|raus muss)$`), (m) => ({ modus: "um X aufstehen", zeit: m[1] })],
      [/^wann (?:soll ich|sollte ich|muss ich) (?:aufstehen|aufwachen|den wecker stellen),? (?:wenn ich )?(?:jetzt )?(?:ins bett gehe|schlafen gehe)$/, () => ({ modus: "um X ins Bett", zeit: "" })],
    ],
    run(e) {
      const j = jetztUhr(), z = e.zeit ? uhrzeit(e.zeit) : j.h * 60 + j.mi;
      if (z == null) throw new Error("Die Uhrzeit verstehe ich nicht.");
      if (String(e.modus).includes("Bett")) {
        const auf = [6, 5, 4].map((c) => uhrText(z + 15 + c * 90));
        return { text: `Wenn du um ${uhrText(z)} ins Bett gehst, wach am besten um ${auf[0]} auf (9 Stunden), ${auf[1]} (7,5 Stunden) oder ${auf[2]} (6 Stunden).` };
      }
      const bett = [6, 5, 4].map((c) => uhrText(z - 15 - c * 90));
      return { text: `Um ${uhrText(z)} fit aufzuwachen: Geh um ${bett[0]} ins Bett (6 Zyklen) oder um ${bett[1]} (5 Zyklen). Spätestens ${bett[2]}.` };
    },
  },
];

function einheitAus(w) {
  if (/^werk/.test(w)) return "Werktage";
  if (/^woche/.test(w)) return "Wochen";
  if (/^monat/.test(w)) return "Monate";
  if (/^jahr/.test(w)) return "Jahre";
  return "Tage";
}
