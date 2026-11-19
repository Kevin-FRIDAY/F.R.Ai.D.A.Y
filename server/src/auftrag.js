// Wie weit Friday mit einem Auftrag ist (für den Arbeits-Balken im Dashboard).
const stand = new Map(); // Kanal -> { schritt, prozent, text, seit, aktualisiert }

const NAMEN = {
  web_search: "sucht im Netz", world_news: "liest die Weltnachrichten", lookup: "schlägt nach", get_weather: "holt das Wetter",
  remember: "merkt sich etwas", set_reminder: "stellt eine Erinnerung", add_task: "schreibt eine Aufgabe auf", mac: "arbeitet am Mac",
  open_app: "öffnet eine App", dokument_erstellen: "schreibt das Dokument", fragebogen_erstellen: "erstellt den Fragebogen",
  werkstatt: "baut in der Werkstatt", webseite_bauen: "baut die Webseite", spiel_bauen: "programmiert das Spiel", crypto: "holt Kurse", currency: "rechnet Währungen um",
};
export const werkzeugName = (n) => NAMEN[n] || `benutzt ${String(n).replace(/_/g, " ")}`;

export function setzeAuftrag(kanal, schritt, prozent, text) {
  const alt = stand.get(kanal);
  const jetzt = Date.now();
  stand.set(kanal, { schritt, prozent: Math.max(alt && schritt !== "verstehen" ? alt.prozent : 0, prozent), text, seit: alt && schritt !== "verstehen" ? alt.seit : jetzt, aktualisiert: jetzt });
}
export function auftragFertig(kanal, ok = true) {
  const alt = stand.get(kanal);
  if (alt) stand.set(kanal, { ...alt, schritt: ok ? "fertig" : "fehler", prozent: 100, aktualisiert: Date.now() });
}
export function auftragStand(kanal) {
  return stand.get(kanal) || null;
}
