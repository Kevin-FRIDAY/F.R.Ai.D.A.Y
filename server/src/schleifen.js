// Schleifen-Schutz (v1.135.0, Idee aus Conway-Research/automaton, MIT – in Node nachgebaut).
// Friday merkt, wenn sie innerhalb eines Auftrags dreimal hintereinander genau dasselbe tut,
// und bekommt einen Hinweis, etwas anderes zu versuchen. Beim vierten Mal bricht sie ab.
// Leerlauf: Viele Runden nur Nachschauen ohne Ergebnis → Friday hört auf und antwortet mit dem, was sie hat.
import * as store from "./store.js";
import { eintragen } from "./logbuch.js";
import { NUR_LESEN } from "./kommando.js";

const NAME = "schleifen";
export const HINWEIS_AB = 3; // gleiche Schritte hintereinander → Hinweis
export const ABBRUCH_AB = 4; // → Abbruch
export const LEERLAUF_AB = 5; // Runden nur mit Nachschauen

function signatur(toolUses) {
  return toolUses.map((t) => `${t.name}:${JSON.stringify(t.input || {})}`).sort().join("|");
}

/** Ein Wächter pro Auftrag (pro Frage an Friday). */
export function neuerWaechter(kanal = "web") {
  let letzte = "";
  let gleich = 0;
  let leer = 0;
  return {
    /**
     * Nach jeder Runde mit Werkzeugen aufrufen.
     * @returns {{art:"ok"} | {art:"hinweis", text:string} | {art:"abbruch", text:string}}
     */
    runde(toolUses) {
      const sig = signatur(toolUses);
      gleich = sig === letzte ? gleich + 1 : 1;
      letzte = sig;
      const nurLesen = toolUses.every((t) => NUR_LESEN.has(t.name) || t.name === "web_search");
      leer = nurLesen ? leer + 1 : 0;
      const namen = [...new Set(toolUses.map((t) => t.name))].join(", ");
      if (gleich >= ABBRUCH_AB) {
        merke({ art: "abbruch", kanal, werkzeuge: namen, anzahl: gleich });
        return { art: "abbruch", text: "Ich drehe mich gerade im Kreis, Boss. Ich habe denselben Schritt mehrmals versucht und höre lieber auf. Sag mir bitte genauer, was du brauchst." };
      }
      if (gleich >= HINWEIS_AB) {
        merke({ art: "hinweis", kanal, werkzeuge: namen, anzahl: gleich });
        return { art: "hinweis", text: `[Hinweis vom Schleifen-Schutz, nicht von Boss] Du hast ${gleich}-mal hintereinander genau dasselbe gemacht (${namen}). Das bringt nichts Neues. Versuch einen anderen Weg oder antworte mit dem, was du schon weißt.` };
      }
      if (leer >= LEERLAUF_AB) {
        merke({ art: "leerlauf", kanal, werkzeuge: namen, anzahl: leer });
        leer = 0;
        return { art: "hinweis", text: "[Hinweis vom Schleifen-Schutz, nicht von Boss] Du hast jetzt viele Runden nur nachgeschaut. Antworte jetzt mit dem, was du gefunden hast, statt weiter zu suchen." };
      }
      return { art: "ok" };
    },
  };
}

function merke(e) {
  try {
    const d = store.load(NAME, { faelle: [], zaehler: { hinweis: 0, abbruch: 0, leerlauf: 0 } });
    d.faelle.push({ zeit: new Date().toISOString(), ...e });
    d.faelle = d.faelle.slice(-100);
    d.zaehler[e.art] = (d.zaehler[e.art] || 0) + 1;
    store.save(NAME, d);
    eintragen({ bereich: "system", titel: e.art === "abbruch" ? "Schleifen-Schutz: Auftrag abgebrochen" : e.art === "leerlauf" ? "Schleifen-Schutz: zu viel Nachschauen" : "Schleifen-Schutz: Friday wiederholt sich", details: `${e.werkzeuge} (${e.anzahl}×)`, kanal: e.kanal, ok: e.art !== "abbruch" });
  } catch { /* nie Friday aufhalten */ }
}

export function uebersicht() {
  const d = store.load(NAME, { faelle: [], zaehler: { hinweis: 0, abbruch: 0, leerlauf: 0 } });
  return { grenzen: { hinweis: HINWEIS_AB, abbruch: ABBRUCH_AB, leerlauf: LEERLAUF_AB }, zaehler: d.zaehler, faelle: d.faelle.slice(-30).reverse() };
}
