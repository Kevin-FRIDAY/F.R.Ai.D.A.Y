// Klimazonen im Weltgeschehen per Sprache (v1.121.0) – ohne Claude.
// "Zeig mir die Klimazonen", "Klimazonen an/aus", "Klimakarte".
// Die Karte selbst (Köppen-Geiger, Uni Wien) liegt im Dashboard (vendor/klimazonen.json).
export function quickCommand(text) {
  const t = String(text || "").toLowerCase().replace(/[?!.]+$/, "").trim();
  if (!/klima ?(zone|zonen|karte)|klimazonen/.test(t)) return null;
  if (/\b(aus|ausblenden|weg|verstecken)\b/.test(t)) {
    return { answer: "Klimazonen sind aus.", actions: ["weltgeschehen", "klimazonen_aus"] };
  }
  return {
    answer: "Hier sind die Klimazonen der Erde: blau tropisch, rot und orange trocken, grün und gelb gemäßigt, türkis und lila kontinental, grau und weiß polar. Tipp auf eine Stelle für die genaue Zone.",
    actions: ["weltgeschehen", "klimazonen"],
  };
}
