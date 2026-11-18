// Sprachbefehl fürs Tool-Ökosystem (Übersicht aller Werkzeuge), ohne Claude.
// "Friday, zeig mir alle Werkzeuge", "öffne das Tool-Ökosystem", "Werkzeug-Übersicht".
export function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/[„“”"'!?.,:;]/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^(?:hey |hallo |hi |ok |okay )?(?:friday|freitag|fraiday)(?: |$)/, "").trim()
    .replace(/^(?:bitte |kannst du (?:mir )?(?:bitte )?|könntest du (?:mir )?(?:bitte )?)/, "").trim();
  if (!t || t.length > 80) return null;
  const NAME = "(?:tool ?ö?k?osystem|tool ?oekosystem|werkzeug ?ö?k?osystem|werkzeug ?oekosystem|ökosystem|oekosystem|werkzeug ?übersicht|werkzeug ?uebersicht|tool ?übersicht|tool ?uebersicht)";
  const treffer = new RegExp(`^(?:bitte )?(?:öffne|oeffne|zeig|zeige|mach)(?: mir)?(?: mal)? (?:das |dein |mein |fridays |die )?${NAME}(?: auf| bitte)?$`).test(t)
    || new RegExp(`^(?:das |dein |fridays |die )?${NAME}(?: zeigen| öffnen| oeffnen| auf ?machen)?$`).test(t)
    || /^(?:zeig|zeige)(?: mir)?(?: mal)? (?:alle |deine |all deine |meine )(?:werkzeuge|tools)(?: auf einen blick)?$/.test(t)
    || /^(?:welche|was für) (?:werkzeuge|tools) hast du(?: alles)?$/.test(t);
  if (!treffer) return null;
  return { answer: "Hier ist mein Tool-Ökosystem, Boss. Alle Werkzeuge, mein Kern und das Agenten-Team auf einen Blick.", actions: ["oekosystem"] };
}
