// Wie weit Friday mit einem Auftrag ist (für den Arbeits-Balken im Dashboard).
const stand = new Map(); // Kanal -> { schritt, prozent, text, seit, aktualisiert }

const NAMEN = {
  web_search: "sucht im Netz", world_news: "liest die Weltnachrichten", lookup: "schlägt nach", get_weather: "holt das Wetter",
  remember: "merkt sich etwas", set_reminder: "stellt eine Erinnerung", add_task: "schreibt eine Aufgabe auf", mac: "arbeitet am Mac",
  open_app: "öffnet eine App", dokument_erstellen: "schreibt das Dokument", fragebogen_erstellen: "erstellt den Fragebogen", tabelle_erstellen: "baut die Excel-Tabelle", anrufe: "schickt die Nachricht",
  werkstatt: "baut in der Werkstatt", webseite_bauen: "baut die Webseite", spiel_bauen: "programmiert das Spiel", crypto: "holt Kurse", route_planen: "plant die Route", currency: "rechnet Währungen um", werkzeugkasten: "nimmt ein Werkzeug aus dem Werkzeugkasten",
};
export const werkzeugName = (n) => NAMEN[n] || `benutzt ${String(n).replace(/_/g, " ")}`;

export function setzeAuftrag(kanal, schritt, prozent, text, werkzeuge) {
  const alt = stand.get(kanal);
  const jetzt = Date.now();
  const weiter = alt && schritt !== "verstehen";
  const wz = Array.isArray(werkzeuge) ? werkzeuge.map(String).slice(0, 8) : weiter ? alt.werkzeuge || [] : [];
  stand.set(kanal, { schritt, prozent: Math.max(weiter ? alt.prozent : 0, prozent), text, seit: weiter ? alt.seit : jetzt, aktualisiert: jetzt, werkzeuge: wz });
}
// Alle Aufträge, die gerade laufen (für das 3D-Büro: welcher Agent arbeitet gerade?).
export function laufendeAuftraege(maxAlterMs = 120000) {
  const jetzt = Date.now();
  const out = [];
  for (const [kanal, a] of stand) {
    if (a.schritt === "fertig" || a.schritt === "fehler") continue;
    if (jetzt - a.aktualisiert > maxAlterMs) continue;
    out.push({ kanal, ...a });
  }
  return out;
}
export function auftragFertig(kanal, ok = true) {
  const alt = stand.get(kanal);
  if (alt) stand.set(kanal, { ...alt, schritt: ok ? "fertig" : "fehler", prozent: 100, aktualisiert: Date.now() });
}
export function auftragStand(kanal) {
  return stand.get(kanal) || null;
}
