// Helfer-Paket (v1.106.0): Kühlschrank- & Reste-Regisseur, Anti-Fehlkauf-Berater, Advocatus Diaboli,
// Stimmungs-Sound und Ideen-Schmiede. Hier hängen die Server-Routen, die Sprachbefehle (ohne Claude)
// und die tägliche Prüfung (Ablaufdaten, Garantie) zusammen, damit index.js und brain.js schlank bleiben.
import * as kuehl from "./kuehlschrank.js";
import * as kauf from "./kaufberater.js";
import * as gegen from "./gegenrede.js";
import * as ideen from "./ideenschmiede.js";
import * as ausbau from "./friday-ausbau.js";
import * as lernen from "./lernen.js";
import { denke } from "./denker.js";
import { notifyAll } from "./notify.js";
import { U } from "./datum.js";

// ---------- Stimmungs-Sound (der Klang selbst entsteht im Browser, hier nur die Sprachbefehle) ----------
const KLANG = [
  ["regen", /\b(regen|regengeräusche|regengeraeusche|regenrauschen)\b/],
  ["meer", /\b(meer|meeresrauschen|wellen|ozean|strand)\b/],
  ["wald", /\b(wald|vögel|voegel|vogelgezwitscher|natur|naturgeräusche|naturgeraeusche)\b/],
  ["kamin", /\b(kamin|kaminfeuer|lagerfeuer|feuer knistern)\b/],
  ["fokus", /\b(fokus|konzentration|konzentrier|brown noise|braunes rauschen|lernmusik|arbeitsmusik|fokus-sound|fokussound|deep work)\b/],
  ["nacht", /\b(nacht|grillen|einschlafen|schlafen|schlafgeräusche|schlafgeraeusche)\b/],
  ["weltraum", /\b(weltraum|space|all|sci-fi|scifi|raumschiff)\b/],
  ["puls", /\b(puls|energie|power|motivation|training|sport|party|workout)\b/],
];
function klangQuick(text) {
  const t = String(text || "").toLowerCase().replace(/^(hey |hallo |ok )?(friday|freitag)[ ,.]*/, "").replace(/[!?.]/g, "").trim();
  if (U(/^(öffne|oeffne|zeig)( mir)?( den| die)? (stimmungs-?sound|klangraum|klang-raum|sound-?mixer|geräusche|geraeusche)$/).test(t)) return { answer: "Der Stimmungs-Sound ist offen.", actions: ["klang"] };
  if (U(/\b(stimmungs-?sound|hintergrund-?sound|hintergrundgeräusche|hintergrundgeraeusche|klangraum|naturgeräusche|naturgeraeusche|fokus-?sound|sound|geräusche|geraeusche|klang)\b.*\b(aus|stopp|stop|beenden|leiser machen)\b|^(mach|stell) (den |die )?(sound|geräusche|geraeusche|klang|stimmungs-?sound)( wieder)? aus$/).test(t)) return { answer: "Stimmungs-Sound ist aus.", actions: ["klang:aus"] };
  if (U(/\b(stimmungs-?sound|klang|sound)\b.*\b(automatisch|auto|passend|selbst aussuchen)\b|^(pass|passe) (den )?(sound|klang|die musik) (an|automatisch an)|^stimmungs-?sound( an)?$/).test(t)) return { answer: "Automatik an: Ich passe die Geräusche an das an, was du gerade in Friday machst.", actions: ["klang:auto"] };
  const klangWort = U(/\b(geräusch|geraeusch|sound|klang|rauschen|atmosphäre|atmosphaere|hintergrundmusik|musik|lernmusik|arbeitsmusik)\w*/).test(t);
  if (/\b(spotify|playlist|lied|song|album|radio|licht|lampe|fernseher|tv|alexa)\b/.test(t)) return null;
  for (const [id, re] of KLANG) {
    if (!U(re).test(t)) continue;
    const kurzBefehl = U(/^(spiel|spiele|starte|mach|ich brauche|gib mir)( mir)?( mal| etwas| ein bisschen)? \S+( \S+)?( an| ab| bitte)*$/).test(t);
    if (klangWort || (kurzBefehl && id !== "puls" && id !== "nacht")) {
      return { answer: { regen: "Regen läuft. Gemütlich.", meer: "Meeresrauschen läuft.", wald: "Wald und Vögel laufen.", kamin: "Das Kaminfeuer knistert.", fokus: "Fokus-Rauschen läuft. Viel Erfolg, Boss.", nacht: "Nachtgeräusche laufen. Schlaf gut.", weltraum: "Weltraum-Klang läuft.", puls: "Energie-Puls läuft." }[id], actions: [`klang:${id}`] };
    }
  }
  return null;
}

/** Ein Schnellbefehl für brain.js (alles ohne Claude). */
export async function quickCommand(text) {
  return lernen.quickCommand(text)
    || klangQuick(text)
    || kuehl.quickCommand(text)
    || gegen.quickCommand(text)
    || ideen.quickCommand(text)
    || (await kauf.quickCommand(text));
}

/** Tägliche Prüfungen (Ablaufdaten, Gewährleistung). */
export function helferStart() {
  const lauf = () => {
    kuehl.taeglichPruefen(notifyAll).catch?.(() => {});
    kauf.garantiePruefen(notifyAll).catch?.(() => {});
  };
  lernen.lernenStart();
  setTimeout(lauf, 60 * 1000);
  setInterval(lauf, 30 * 60 * 1000);
}

const fehler = (res, err, code = 400) => res.status(code).json({ error: err.message || String(err) });

export function helferRouten(app, asyncRoute) {
  // --- Carlas Lernecke (v1.108.0) ---
  lernen.lernenRouten(app, asyncRoute);

  // --- Kühlschrank ---
  app.get("/api/kuehlschrank", (req, res) => res.json({ vorrat: kuehl.vorrat(), rezepte: kuehl.rezepte({ limit: 8 }), statistik: kuehl.statistik(), lebensmittel: kuehl.LEBENSMITTEL.map(({ key, name, icon, tage }) => ({ key, name, icon, tage })) }));
  app.post("/api/kuehlschrank/bon", (req, res) => res.json(kuehl.bonLesen(String(req.body?.text || "").slice(0, 20000))));
  app.post("/api/kuehlschrank/bon-ki", asyncRoute(async (req, res) => {
    const img = req.body?.image;
    if (!img?.data) return res.status(400).json({ error: "Kein Foto." });
    const r = await denke({ stufe: "leicht", quelle: "kuehlschrank", maxTokens: 1500, image: img, system: "Du liest Kassenbons. Gib NUR die gekauften Artikel zurück, eine Zeile pro Artikel, ohne Preise, so wie sie auf dem Bon stehen. Keine Summen, kein Pfand, keine Zahlungsarten.", text: "Welche Artikel stehen auf diesem Kassenbon?" });
    if (!r.ok) return res.status(r.leer ? 402 : 502).json({ error: r.error });
    res.json({ text: r.text, ...kuehl.bonLesen(r.text) });
  }));
  app.post("/api/kuehlschrank/vorrat", (req, res) => res.json({ neu: kuehl.hinzufuegen(req.body?.posten || [], req.body?.quelle || "hand") }));
  app.patch("/api/kuehlschrank/vorrat/:id", (req, res) => res.json(kuehl.aendern(req.params.id, req.body || {}) || {}));
  app.delete("/api/kuehlschrank/vorrat/:id", (req, res) => res.json({ ok: kuehl.entfernen(req.params.id, req.query.grund === "weg" ? "weg" : "verbraucht") }));
  app.post("/api/kuehlschrank/einkaufen", (req, res) => res.json({ neu: kuehl.aufEinkaufsliste(req.body?.namen || []) }));

  // --- Kaufberater ---
  app.get("/api/kaufberater", (req, res) => res.json({ geraete: kauf.geraete(), verlauf: kauf.verlauf().slice(0, 15) }));
  app.get("/api/kaufberater/ergebnis/:id", (req, res) => {
    const e = req.params.id === "neuestes" ? kauf.letzte() : kauf.verlauf().find((x) => x.id === req.params.id);
    return e ? res.json(e) : res.status(404).json({ error: "Nicht gefunden." });
  });
  app.post("/api/kaufberater/pruefen", asyncRoute(async (req, res) => {
    try { res.json(await kauf.pruefen(req.body || {})); } catch (err) { fehler(res, err); }
  }));
  app.post("/api/kaufberater/geraete", (req, res) => { try { res.json(kauf.geraetSpeichern(req.body || {})); } catch (err) { fehler(res, err); } });
  app.delete("/api/kaufberater/geraete/:id", (req, res) => res.json({ ok: kauf.geraetLoeschen(req.params.id) }));
  app.post("/api/kaufberater/recherche", asyncRoute(async (req, res) => {
    const produkt = String(req.body?.produkt || "").slice(0, 200);
    if (!produkt) return res.status(400).json({ error: "Welches Produkt?" });
    const r = await denke({ stufe: "mittel", websuche: true, quelle: "kaufberater", maxTokens: 3000, system: "Du bist ein ehrlicher Kaufberater. Recherchiere mit der Websuche öffentliche Quellen (Tests, Foren, Langzeit-Erfahrungen) zu Langzeit-Mängeln und häufigen Rückgabegründen. Antworte auf Deutsch in kurzen Absätzen: Langzeit-Mängel, Rückgabegründe, Reparierbarkeit, Fazit. Nenne zu jedem Punkt die Quelle (Name + Link). Wenn du nichts Belastbares findest, sag das ehrlich. Erfinde nichts.", text: `Produkt: ${produkt}` });
    if (!r.ok) return res.status(r.leer ? 402 : 502).json({ error: r.error });
    res.json({ text: r.text, model: r.model });
  }));

  // --- Advocatus Diaboli ---
  app.get("/api/gegenrede", (req, res) => res.json({ verlauf: gegen.verlauf().slice(0, 15) }));
  app.get("/api/gegenrede/:id", (req, res) => {
    const e = req.params.id === "neuestes" ? gegen.verlauf()[0] && gegen.holen(gegen.verlauf()[0].id) : gegen.holen(req.params.id);
    return e ? res.json(e) : res.status(404).json({ error: "Nicht gefunden." });
  });
  app.post("/api/gegenrede", (req, res) => { try { res.json(gegen.analysiere(req.body?.text, { titel: req.body?.titel })); } catch (err) { fehler(res, err); } });
  app.post("/api/gegenrede/:id/ki", asyncRoute(async (req, res) => {
    try { res.json(await gegen.mitKi(req.params.id)); } catch (err) { fehler(res, err, /Guthaben/.test(err.message) ? 402 : 502); }
  }));

  // --- Ideen-Schmiede ---
  app.get("/api/ideen", (req, res) => res.json({ tresor: ideen.tresor(), bereiche: ideen.BEREICHE }));
  // v1.130.0: Friday ausbauen (Bauplan-Katalog, Lücken aus der Datenbank, KI-Vorschläge)
  app.get("/api/ideen/ausbau", (req, res) => res.json(ausbau.ausbau({ tage: Math.min(365, Math.max(7, Number(req.query.tage) || 60)) })));
  app.post("/api/ideen/ausbau/auftrag", (req, res) => res.json({ text: ausbau.bauAuftrag(req.body || {}) }));
  app.post("/api/ideen/ausbau/ki", asyncRoute(async (req, res) => {
    try { res.json({ vorschlaege: await ausbau.kiVorschlaege() }); } catch (err) { fehler(res, err, /Guthaben/.test(err.message) ? 402 : 502); }
  }));
  app.get("/api/ideen/wuerfeln", (req, res) => res.json(ideen.wuerfeln(String(req.query.bereich || ""))));
  app.post("/api/ideen/pruefen", (req, res) => { try { res.json(ideen.pruefen(req.body?.text)); } catch (err) { fehler(res, err); } });
  app.post("/api/ideen", (req, res) => res.json(ideen.speichern(req.body || {})));
  app.delete("/api/ideen/:id", (req, res) => res.json({ ok: ideen.loeschen(req.params.id) }));
  app.post("/api/ideen/ausarbeiten", asyncRoute(async (req, res) => {
    try { res.json(await ideen.ausarbeiten(req.body || {})); } catch (err) { fehler(res, err, /Guthaben/.test(err.message) ? 402 : 502); }
  }));
}
