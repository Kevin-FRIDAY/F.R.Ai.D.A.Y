// Fridays Ereignis-Bus (v1.178.0, Mark XII Punkt 27): eine gemeinsame Ereignissteuerung für alle Module.
//
// Jedes Modul kann melden, dass etwas passiert ist (sende), und jedes Modul kann zuhören (hoere).
// Beispiele: "logbuch" (jeder Logbuch-Eintrag), "ki" (eine KI fängt an / ist fertig / fällt aus),
// "test" (Funktionsprüfung), "warnung", "freigabe", "agent", "mission", "gedaechtnis".
//
// Bewusst klein und ohne Abhängigkeiten (keine Importe), damit jedes Modul es benutzen kann,
// ohne dass Import-Kreise entstehen. Die letzten 400 Ereignisse bleiben im Speicher, damit das
// Gehirn-Cockpit sie live anzeigen kann (GET /api/ereignisse und der Live-Strom /api/ereignisse/strom).
// Ein Zuhörer, der abstürzt, hält nie den Rest auf.

const PUFFER = 400;
const puffer = [];
const zuhoerer = new Map(); // typ ("*" = alle) -> Set(fn)
let zaehler = 0;
const statistik = { gesendet: 0, fehler_bei_zuhoerern: 0, seit: new Date().toISOString(), je_typ: {} };

/**
 * Ein Ereignis melden.
 * @param {string} typ z. B. "logbuch", "ki", "warnung"
 * @param {object} daten beliebige kleine Daten (werden nicht kopiert, bitte klein halten)
 * @param {{quelle?:string, wichtig?:boolean}} [opt]
 */
export function sende(typ, daten = {}, { quelle = "", wichtig = false } = {}) {
  try {
    const t = String(typ || "sonstiges").slice(0, 40);
    zaehler = (zaehler + 1) % 1e9;
    const e = { id: zaehler, typ: t, at: new Date().toISOString(), ...(quelle ? { quelle: String(quelle).slice(0, 40) } : {}), ...(wichtig ? { wichtig: true } : {}), daten };
    puffer.push(e);
    if (puffer.length > PUFFER) puffer.splice(0, puffer.length - PUFFER);
    statistik.gesendet++;
    statistik.je_typ[t] = (statistik.je_typ[t] || 0) + 1;
    for (const key of [t, "*"]) {
      for (const fn of zuhoerer.get(key) || []) {
        try {
          const r = fn(e);
          if (r && typeof r.catch === "function") r.catch(() => { statistik.fehler_bei_zuhoerern++; });
        } catch {
          statistik.fehler_bei_zuhoerern++;
        }
      }
    }
    return e;
  } catch {
    return null;
  }
}

/** Zuhören. typ "*" = alle Ereignisse. Gibt eine Funktion zum Abmelden zurück. */
export function hoere(typ, fn) {
  const key = String(typ || "*");
  if (!zuhoerer.has(key)) zuhoerer.set(key, new Set());
  zuhoerer.get(key).add(fn);
  return () => zuhoerer.get(key)?.delete(fn);
}

/** Die letzten Ereignisse (neueste zuletzt), optional nur ab einer id oder nur bestimmte Typen. */
export function letzte({ ab = 0, typen = null, limit = 200 } = {}) {
  let liste = puffer;
  if (ab) liste = liste.filter((e) => e.id > Number(ab));
  if (typen?.length) liste = liste.filter((e) => typen.includes(e.typ));
  return liste.slice(-Math.max(1, Math.min(PUFFER, Number(limit) || 200)));
}

export function stand() {
  const hoererZahl = [...zuhoerer.values()].reduce((s, set) => s + set.size, 0);
  return { ...statistik, zuhoerer: hoererZahl, im_puffer: puffer.length, letzte_id: zaehler };
}

/** Express-Routen: Liste + Live-Strom (Server-Sent Events über fetch, mit Anmeldung wie alle /api-Wege). */
export function ereignisRouten(app) {
  app.get("/api/ereignisse", (req, res) => {
    const typen = String(req.query.typen || "").split(",").map((s) => s.trim()).filter(Boolean);
    res.json({ stand: stand(), ereignisse: letzte({ ab: Number(req.query.ab) || 0, typen, limit: Number(req.query.limit) || 200 }) });
  });
  app.get("/api/ereignisse/strom", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    const schreibe = (e) => { try { res.write(`id: ${e.id}\ndata: ${JSON.stringify(e)}\n\n`); } catch { /* Verbindung weg */ } };
    for (const e of letzte({ ab: Number(req.query.ab) || 0, limit: 50 })) schreibe(e);
    const ab = hoere("*", schreibe);
    const puls = setInterval(() => { try { res.write(": puls\n\n"); } catch { /* egal */ } }, 20000);
    req.on("close", () => { ab(); clearInterval(puls); });
  });
}
