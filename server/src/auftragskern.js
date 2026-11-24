// Auftrags-Kern (v1.161.0): Friday sagt nicht mehr "mache ich" und tut dann nichts.
//
// Das Problem: Claude (oder das Ersatz-Gehirn) antwortet manchmal nur mit Text ("Mache ich, Boss."),
// ohne ein Werkzeug zu benutzen. Nach der Antwort passiert nichts mehr – der Auftrag war verloren.
// Oder ein Werkzeug meldet einen Fehler, und die Antwort klingt trotzdem nach "erledigt".
//
// Der Kern macht drei Dinge:
//  1. erkennen: Ist das ein Auftrag (Tabelle, Nachricht, Dokument, Erinnerung …) und welches Werkzeug gehört dazu?
//  2. prüfen:   Hat ein passendes Werkzeug WIRKLICH geklappt (kein Fehler, nicht nur "wartet auf Freigabe")?
//  3. ehrlich:  Wenn nicht, hakt Friday nach, nimmt den eingebauten Weg (z. B. Tabellen-Vorlage) oder sagt
//               klar, was nicht geklappt hat. Eine Antwort, die "erledigt" behauptet, ohne dass etwas passiert ist,
//               kommt nie mehr beim Nutzer an.

// Werkzeuge, die nur lesen oder suchen – zählen nicht als "Auftrag ausgeführt".
const NUR_LESEN = new Set([
  "world_news", "list_tasks", "system_check", "check_mail", "air_quality", "currency", "crypto", "holidays", "iss", "lookup",
  "country_info", "get_weather", "list_reminders", "list_protocols", "get_health", "welt_alarm", "markt_radar", "web_search",
  "dokumente_suchen", "apple_kontakte",
]);

const FRAGE = /^(was|wie|warum|wieso|weshalb|wer|wo|wann|welche[rsmn]?|wieviel|wie viel|ist|sind|gibt es|hast du|hat|kann man|könnte man|weißt du|weisst du|erklär|erkläre)\b/i;
const HOEFLICH = /^(hey |hallo |ok |okay )?(friday|freitag)?[ ,.!]*(bitte |mal |doch |jetzt |kannst du( mir)?( bitte)?( mal)? |könntest du( mir)?( bitte)?( mal)? |würdest du( mir)?( bitte)? |ich (brauche|bräuchte|hätte gern|hätte gerne|möchte|will)( bitte)? )*/i;

const ARTEN = {
  tabelle: { werkzeuge: ["tabelle_erstellen"], name: "die Excel-Tabelle" },
  nachricht: { werkzeuge: ["anrufe"], name: "die Nachricht" },
  dokument: { werkzeuge: ["dokument_erstellen", "fragebogen_erstellen", "tabelle_erstellen", "apple_notizen", "notion"], name: "das Dokument" },
  erinnerung: { werkzeuge: ["set_reminder", "kalender", "todoist"], name: "die Erinnerung" },
  aufgabe: { werkzeuge: ["add_task", "add_shopping", "todoist", "remember", "kalender", "apple_notizen"], name: "den Eintrag" },
};

/** Was für ein Auftrag ist das? → {art, werkzeuge, name} oder null (Frage, Gespräch). */
export function erkenne(text = "") {
  const roh = String(text || "").trim();
  if (!roh || roh.length > 3000) return null;
  const t = roh.toLowerCase().replace(HOEFLICH, "").trim();
  const istFrage = FRAGE.test(t) && !/^(kannst|könntest|würdest)/.test(roh.toLowerCase().replace(/^(hey |ok )?(friday|freitag)[ ,.!]*/, ""));
  if (istFrage) return null;
  const tun = /\b(bau|baue|erstell|erstelle|erstellen|mach|mache|machen|leg|lege|anlegen|schreib|schreibe|schreiben|generier|generiere|entwirf|entwerfe|plane|plan|vorbereiten|bereite|brauche|bräuchte|hätte gern|hätte gerne|möchte|will)\b/;
  if (/\b(excel|xlsx|tabelle|spreadsheet|kalkulation)\b/.test(t) && tun.test(` ${t} `)) return { art: "tabelle", ...ARTEN.tabelle };
  if (/^(schreib|schreibe|schick|schicke|sende|send|texte)\b/.test(t) && /\b(frau|mann|schatz|mama|papa|mutter|vater|bruder|schwester|oma|opa|ihr|ihm|an [a-zäöü]+|nachricht|sms|imessage)\b/.test(t) && !/\b(brief|text über|artikel|aufsatz|gedicht|mail an mich)\b/.test(t)) return { art: "nachricht", ...ARTEN.nachricht };
  if (/^(ruf|rufe)\b.*\ban\b/.test(t) || /\banrufen\b/.test(t)) return { art: "nachricht", ...ARTEN.nachricht };
  if (/^(erinner|erinnere)\b/.test(t)) return { art: "erinnerung", ...ARTEN.erinnerung };
  if (/^(setz|setze|schreib|schreibe|trag|trage|pack|packe|notier|notiere)\b.*\b(liste|einkaufsliste|aufgaben|todo|to-do|kalender|auf)\b/.test(t) && !/\bnachricht\b/.test(t)) return { art: "aufgabe", ...ARTEN.aufgabe };
  if (/^(erstell|erstelle|schreib|schreibe|mach|mache|entwirf|bau|baue|plan|plane)\b/.test(t) && /\b(brief|text|plan|liste|rezept|zusammenfassung|bewerbung|anschreiben|vertrag|kündigung|fragebogen|checkliste|konzept|angebot|rechnung|protokoll|dokument|notiz|ideen)\b/.test(t)) return { art: "dokument", ...ARTEN.dokument };
  return null;
}

/** Hat ein Werkzeug wirklich geklappt? → "ok" | "fehler" | "wartet" */
export function ergebnisStatus(result) {
  if (result === null || result === undefined) return "ok";
  if (Array.isArray(result?.content)) return "ok";
  if (typeof result !== "object") return "ok";
  if (result.wartet_auf_freigabe) return "wartet";
  if (result.error || result.fehler || result.ok === false) return "fehler";
  return "ok";
}
export function fehlerText(result) {
  return String(result?.error || result?.fehler || result?.info || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

/** Merkt sich, was in dieser Anfrage wirklich passiert ist. */
export function neuesProtokoll(auftrag) {
  const schritte = [];
  return {
    auftrag,
    schritte,
    eintragen(name, result) { schritte.push({ werkzeug: name, status: ergebnisStatus(result), text: ergebnisStatus(result) === "ok" ? "" : fehlerText(result) }); },
    /** Hat ein Werkzeug geklappt, das zum Auftrag passt (bzw. irgendeine echte Aktion)? */
    erfuellt() {
      const passt = (s) => (auftrag ? auftrag.werkzeuge.includes(s.werkzeug) : !NUR_LESEN.has(s.werkzeug));
      return schritte.some((s) => s.status === "ok" && passt(s));
    },
    wartet() { return schritte.some((s) => s.status === "wartet"); },
    fehler() { return schritte.filter((s) => s.status === "fehler"); },
    aktionGeklappt() { return schritte.some((s) => s.status === "ok" && !NUR_LESEN.has(s.werkzeug)); },
    status() {
      if (this.erfuellt() || (!auftrag && this.aktionGeklappt())) return "ok";
      if (this.wartet()) return "wartet";
      if (this.fehler().length) return "fehler";
      return auftrag ? "nicht_erledigt" : "antwort";
    },
  };
}

// "Mache ich", "Ich erstelle dir …", "Einen Moment" – nur angekündigt.
export const NUR_ANGEKUENDIGT = /\b(mach(e)? ich|ich mach(e)? (das|dir|es|mich|gleich|sofort)|ich (erstelle|schreibe|bereite|kümmere|kuemmere|stelle|suche|baue|plane|setze|schicke|sende|lege|trage)|wird erledigt|bin dran|gleich (fertig|erledigt)|sofort,? boss|kommt sofort|ich fange (jetzt )?an|einen (moment|augenblick)|bin schon dabei|wird gemacht|läuft,? (boss|chef))\b/i;
// "Erledigt", "Ich habe … geschickt/erstellt" – behauptet, es sei passiert.
export const BEHAUPTET_ERLEDIGT = /\b(erledigt|ist raus|ist verschickt|ist gesendet|ist gespeichert|ist fertig|liegt (jetzt )?(bereit|im|in)|habe (ich )?(dir |ihr |ihm |es |sie |das |die |den )*(\S+ ){0,6}(erstellt|geschrieben|geschickt|gesendet|verschickt|gespeichert|angelegt|eingetragen|gebaut|abgelegt|notiert|gestellt)|hab (ich )?(\S+ ){0,6}(erstellt|geschrieben|geschickt|gesendet|gespeichert|angelegt))\b/i;

/** Hinweis an Claude, wenn der Auftrag noch nicht ausgeführt ist. */
export function nachhakText(auftrag, protokoll) {
  const f = protokoll.fehler();
  if (f.length) {
    return `[Hinweis vom System, nicht von Boss] Das Werkzeug ${f[0].werkzeug} hat einen Fehler gemeldet: „${f[0].text}“. Der Auftrag ist NICHT erledigt. Wenn du es mit anderen Angaben richtig machen kannst, tu es jetzt. Sonst sag Boss ehrlich in ein, zwei Sätzen, was nicht geklappt hat und was er tun kann. Behaupte nicht, es sei erledigt.`;
  }
  const wz = auftrag ? auftrag.werkzeuge.slice(0, 2).join(" oder ") : "deinen Werkzeugen";
  return `[Hinweis vom System, nicht von Boss] Du hast den Auftrag nur beantwortet oder angekündigt, aber nichts ausgeführt. Nach deiner Antwort passiert nichts mehr. Führe ihn JETZT aus und benutze dafür ${wz}${auftrag?.art === "tabelle" ? " mit vollständigen Spalten und sinnvollen Zeilen" : ""}. Antworte danach in einem Satz, was du gemacht hast. Kündige nichts an.`;
}

/** Ehrliche Antwort, wenn nichts geklappt hat. */
export function ehrlicheAntwort(auftrag, protokoll, boss = "Boss") {
  const f = protokoll.fehler();
  const was = auftrag?.name || "den Auftrag";
  if (protokoll.wartet()) return `${was.charAt(0).toUpperCase() + was.slice(1)} wartet noch auf deine Freigabe, ${boss}. Tipp oben auf die Glocke oder sag „gib frei“.`;
  if (f.length && /\?$/.test(f[0].text)) return f[0].text; // Rückfrage wie "Was soll ich ihr schreiben?"
  if (f.length) return `Das hat leider nicht geklappt${f[0].text.includes(boss) ? "" : `, ${boss}`}: ${f[0].text || "unbekannter Fehler"}`;
  return `Ich habe ${was} noch nicht erledigt, ${boss}. Sag es mir bitte noch einmal etwas genauer, dann mache ich es sofort.`;
}

/**
 * Letzte Prüfung vor der Antwort: Stimmt, was Friday sagt, mit dem überein, was passiert ist?
 * @returns {string} die Antwort, wenn nötig ehrlich korrigiert
 */
export function ehrlich(answer, auftrag, protokoll, boss = "Boss") {
  const a = String(answer || "").trim();
  const st = protokoll.status();
  if (st === "ok" || st === "antwort") {
    // Nur Gespräch, aber "erledigt" behauptet, obwohl gar kein Werkzeug lief → nicht durchlassen.
    if (st === "antwort" && !protokoll.schritte.length && NUR_ANGEKUENDIGT.test(a) && a.length < 120) return ehrlicheAntwort(null, protokoll, boss);
    return a;
  }
  // Auftrag nicht erledigt / Fehler / wartet: Ankündigungen und Erfolgs-Behauptungen ersetzen.
  if (!a || NUR_ANGEKUENDIGT.test(a) || BEHAUPTET_ERLEDIGT.test(a)) return ehrlicheAntwort(auftrag, protokoll, boss);
  // Claude hat den Fehler schon selbst erklärt → so lassen.
  return a;
}

/** Soll Friday nachhaken? Nicht bei einer echten Rückfrage ("Was soll ich ihr schreiben?") – außer bei Tabellen/Dokumenten, die baut Friday mit sinnvollen Annahmen. */
export function sollNachhaken(answer, auftrag, protokoll) {
  const st = protokoll.status();
  if (st === "ok" || st === "wartet") return false;
  const a = String(answer || "").trim();
  if (!auftrag) return protokoll.schritte.length === 0 && NUR_ANGEKUENDIGT.test(a);
  const rueckfrage = /\?\s*$/.test(a) && a.length < 300;
  if (rueckfrage && !["tabelle", "dokument"].includes(auftrag.art)) return false;
  return true;
}
