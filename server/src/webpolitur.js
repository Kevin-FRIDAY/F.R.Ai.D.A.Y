// v1.158.0 Feinschliff und Qualitäts-Check für jede Seite aus der Webseiten-Werkstatt.
// politur() ergänzt, was oft fehlt (Sprache, Handy-Ansicht, Beschreibung, ruhige Bewegung, Lazy-Loading).
// pruefeQualitaet() gibt eine Note von 0 bis 100 mit verständlichen Punkten zurück.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ESC[c]);

const RUHIG = `<style data-friday-ruhig>@media (prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}</style>`;

export function politur(html, { titel = "", beschreibung = "" } = {}) {
  let h = String(html || "");
  if (!/^\s*<!doctype html>/i.test(h)) h = `<!doctype html>\n${h}`;
  if (/<html(?![^>]*\blang=)/i.test(h)) h = h.replace(/<html/i, '<html lang="de"');
  const kopf = () => (/<head[^>]*>/i.test(h) ? null : (h = h.replace(/<html[^>]*>/i, (m) => `${m}\n<head></head>`)));
  kopf();
  const neu = [];
  if (!/<meta[^>]+charset/i.test(h)) neu.push('<meta charset="utf-8">');
  if (!/<meta[^>]+name=["']viewport/i.test(h)) neu.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
  if (!/<title>[^<]+<\/title>/i.test(h) && titel) neu.push(`<title>${esc(titel)}</title>`);
  if (!/<meta[^>]+name=["']description/i.test(h) && (beschreibung || titel)) neu.push(`<meta name="description" content="${esc(String(beschreibung || titel).slice(0, 160))}">`);
  if (neu.length) h = h.replace(/<head[^>]*>/i, (m) => `${m}\n${neu.join("\n")}`);
  if (!/prefers-reduced-motion/i.test(h)) h = h.replace(/<\/head>/i, () => `${RUHIG}</head>`);
  // Bilder ab dem zweiten erst laden, wenn man hinscrollt.
  let n = 0;
  h = h.replace(/<img\b(?![^>]*\bloading=)/gi, (m) => (n++ ? `${m} loading="lazy"` : m));
  // Bilder ohne Alt-Text bekommen einen leeren (Deko), damit Screenreader sie überspringen.
  h = h.replace(/<img\b(?![^>]*\balt=)/gi, '<img alt=""');
  // Links, die in neuem Tab öffnen, sicher machen.
  h = h.replace(/<a\b([^>]*target=["']_blank["'])(?![^>]*\brel=)/gi, '<a$1 rel="noopener"');
  return h;
}

export function pruefeQualitaet(html) {
  const h = String(html || "");
  const anzahl = (re) => (h.match(re) || []).length;
  const abschnitte = anzahl(/<section\b/gi);
  const bilder = anzahl(/<img\b[^>]*src="data:image|<img\b[^>]*src="https?:/gi);
  const checks = [
    ["Handy-tauglich", /name=["']viewport/i.test(h) && /@media[^{]*(max|min)-width/i.test(h), "Ansicht fürs Handy fehlt (viewport und @media)."],
    ["Viele Abschnitte", abschnitte >= 6, `Nur ${abschnitte} Abschnitte – gut sind 6 oder mehr.`],
    ["Klare Überschrift", anzahl(/<h1\b/gi) === 1, "Es sollte genau eine Hauptüberschrift (h1) geben."],
    ["Menü", /<nav\b/i.test(h), "Ein Menü (nav) fehlt."],
    ["Animationen", /@keyframes|IntersectionObserver|transition\s*:/i.test(h), "Keine Animationen gefunden."],
    ["Ruhige Bewegung", /prefers-reduced-motion/i.test(h), "Bewegung für empfindliche Menschen nicht abschaltbar."],
    ["Fotos", bilder >= 2, bilder ? "Nur ein Foto." : "Keine echten Fotos (nur Grafiken)."],
    ["Bild-Beschreibungen", !/<img\b(?![^>]*\balt=)/i.test(h), "Manche Bilder haben keinen Alt-Text."],
    ["Kontakt", /<form\b|mailto:|tel:/i.test(h), "Kein Kontaktweg (Formular, Mail oder Telefon)."],
    ["Google-Beschreibung", /<title>[^<]{5,}<\/title>/i.test(h) && /name=["']description/i.test(h), "Titel oder Beschreibung für Google fehlt."],
    ["Sprache Deutsch", /<html[^>]+lang=["']de/i.test(h), "Sprache der Seite ist nicht angegeben."],
    ["Impressum & Datenschutz", /impressum/i.test(h) && /datenschutz/i.test(h), "Impressum oder Datenschutz fehlt im Fußbereich."],
    ["Moderne Schrift", /fonts\.googleapis|@font-face|font-family/i.test(h), "Keine eigene Schrift gesetzt."],
  ].map(([name, ok, tipp]) => ({ name, ok: Boolean(ok), tipp: ok ? "" : tipp }));
  const punkte = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  const kb = Math.round(Buffer.byteLength(h) / 1024);
  return { punkte, checks, abschnitte, fotos: bilder, groesse_kb: kb };
}
