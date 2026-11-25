// Lebensmanager (v1.182.0, Mark XII Punkt 15) – EIN Überblick über alles, was Friday ohnehin schon weiß.
// Kein neues Datenlager: liest Kalender, Aufgaben, Gewohnheiten, Schlaf, Geburtstage, Kühlschrank, Ziele
// und (nur lesend) die Konten. Daraus: Lebens-Balance (0–100), was heute wichtig ist, und konkrete Tipps.
// Ohne Claude, ohne Kosten. Finanzen werden nur angezeigt – Friday bewegt nie Geld.
import * as store from "./store.js";

const sicher = async (fn) => { try { return await fn(); } catch { return null; } };
const euro = (v) => `${Number(v).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
const uhr = (d) => { try { return new Date(d).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

export async function ueberblick() {
  const bereiche = [];
  const tipps = [];
  const heute = [];

  // 📅 Termine (Apple Kalender über den Mac)
  const kal = await sicher(async () => (await import("./kalender.js")).termine(0, 1));
  if (kal?.ok) {
    const l = kal.termine || [];
    bereiche.push({ id: "termine", icon: "📅", name: "Termine heute", wert: l.length > 6 ? 40 : l.length > 4 ? 70 : 100, text: l.length ? `${l.length} Termin${l.length === 1 ? "" : "e"}` : "Keine Termine", details: l.slice(0, 6).map((t) => `${t.ganz ? "ganztägig" : uhr(t.start)} ${t.titel}`) });
    for (const t of l.slice(0, 4)) heute.push({ icon: "📅", text: `${t.ganz ? "" : `${uhr(t.start)} `}${t.titel}` });
    if (l.length > 6) tipps.push("Heute ist viel los. Plane bewusst eine Pause ein.");
  } else bereiche.push({ id: "termine", icon: "📅", name: "Termine heute", wert: null, text: "Kalender nicht erreichbar", details: [kal?.error || "Der Mac-Agent ist nicht verbunden."] });

  // ✅ Aufgaben (Friday-Organizer + Todoist, wenn eingerichtet)
  const eigene = (store.getTasks() || []).filter((t) => !t.done);
  const todo = await sicher(async () => { const T = await import("./todoist.js"); const r = await T.aufgaben("today | overdue"); return r?.ok ? r.aufgaben || r.liste || [] : null; });
  const offen = eigene.length + (todo?.length || 0);
  const alt = eigene.filter((t) => t.at && Date.now() - t.at > 14 * 864e5).length;
  bereiche.push({ id: "aufgaben", icon: "✅", name: "Aufgaben", wert: offen === 0 ? 100 : Math.max(20, 100 - offen * 6 - alt * 8), text: offen ? `${offen} offen${alt ? `, ${alt} älter als 2 Wochen` : ""}` : "Alles erledigt", details: [...eigene.slice(0, 5).map((t) => t.text), ...(todo || []).slice(0, 3).map((t) => `${t.content || t.titel || t.text || ""} (Todoist)`)] });
  if (alt) tipps.push(`${alt} Aufgabe${alt === 1 ? " liegt" : "n liegen"} seit über 2 Wochen. Erledigen oder streichen?`);
  if (eigene[0]) heute.push({ icon: "✅", text: eigene[0].text });

  // 🔥 Gewohnheiten
  const gw = await sicher(async () => (await import("./gewohnheiten.js")).stand());
  if (gw?.liste?.length) {
    const erledigt = gw.liste.filter((g) => g.heute).length;
    const wochenQuote = Math.round((gw.liste.reduce((s, g) => s + g.woche.filter(Boolean).length, 0) / (gw.liste.length * 7)) * 100);
    bereiche.push({ id: "gewohnheiten", icon: "🔥", name: "Gewohnheiten", wert: wochenQuote, text: `${erledigt}/${gw.liste.length} heute · Woche ${wochenQuote} %`, details: gw.liste.map((g) => `${g.icon} ${g.name}: ${g.aktuell} Tag${g.aktuell === 1 ? "" : "e"} am Stück${g.heute ? " ✓" : ""}`) });
    const droht = gw.liste.filter((g) => !g.heute && g.aktuell >= 3);
    if (droht.length) tipps.push(`Serie in Gefahr: ${droht.map((g) => `${g.name} (${g.aktuell} Tage)`).join(", ")}. Heute noch abhaken!`);
  } else bereiche.push({ id: "gewohnheiten", icon: "🔥", name: "Gewohnheiten", wert: null, text: "Noch keine angelegt", details: ["„Friday, neue Gewohnheit Wasser trinken“"] });

  // 😴 Schlaf
  const sl = await sicher(async () => (await import("./schlaf.js")).stand());
  if (sl?.schnitt) {
    const zielMin = (sl.ziel || 8) * 60;
    const wert = Math.max(0, Math.min(100, Math.round(100 - (Math.max(0, zielMin - sl.schnitt) / 60) * 25)));
    bereiche.push({ id: "schlaf", icon: "😴", name: "Schlaf", wert, text: `Schnitt ${sl.schnittText} (Ziel ${sl.ziel} h)`, details: sl.woche.filter((n) => n.minuten).map((n) => `${n.tag.slice(5)}: ${Math.floor(n.minuten / 60)} h ${n.minuten % 60} min`) });
    if (sl.schnitt < zielMin - 45) tipps.push(`Du schläfst im Schnitt ${Math.round((zielMin - sl.schnitt) / 6) / 10} Stunden zu wenig. Heute früher ins Bett?`);
  } else bereiche.push({ id: "schlaf", icon: "😴", name: "Schlaf", wert: null, text: "Keine Daten", details: ["„Friday, gute Nacht“ und „Friday, guten Morgen“ sagen"] });

  // 🎯 Ziele
  const zl = await sicher(async () => { const P = await import("./persoenlich.js"); return P.ziele().map((z) => ({ titel: z.titel, p: P.fortschritt(z) })).filter((z) => z.p < 100); });
  if (zl?.length) {
    const schnitt = Math.round(zl.reduce((s, z) => s + z.p, 0) / zl.length);
    bereiche.push({ id: "ziele", icon: "🎯", name: "Ziele", wert: Math.max(30, schnitt), text: `${zl.length} aktiv · ${schnitt} % geschafft`, details: zl.slice(0, 5).map((z) => `${z.titel}: ${z.p} %`) });
    const steht = zl.filter((z) => z.p === 0);
    if (steht.length) tipps.push(`Ziel „${steht[0].titel}“ hat noch keinen erledigten Schritt. Ein kleiner Schritt heute?`);
  }

  // 🎂 Geburtstage
  const gb = await sicher(async () => (await import("./geburtstage.js")).kommende(14));
  if (gb?.length) {
    bereiche.push({ id: "geburtstage", icon: "🎂", name: "Geburtstage (14 Tage)", wert: null, text: `${gb.length} demnächst`, details: gb.slice(0, 5).map((g) => `${g.name}: ${g.tage === 0 ? "heute!" : `in ${g.tage} Tag${g.tage === 1 ? "" : "en"}`}`) });
    for (const g of gb.filter((x) => x.tage <= 7)) { if (g.tage === 0) heute.push({ icon: "🎂", text: `${g.name} hat Geburtstag` }); else tipps.push(`${g.name} hat in ${g.tage} Tag${g.tage === 1 ? "" : "en"} Geburtstag. Geschenk schon da?`); }
  }

  // 🥬 Kühlschrank
  const kw = await sicher(async () => (await import("./kuehlschrank.js")).baldWeg(2));
  if (kw?.length) { bereiche.push({ id: "kuehlschrank", icon: "🥬", name: "Kühlschrank", wert: null, text: `${kw.length} läuft bald ab`, details: kw.slice(0, 6).map((x) => `${x.name}: ${x.tage <= 0 ? "heute" : `${x.tage} Tag${x.tage === 1 ? "" : "e"}`}`) }); tipps.push(`Zuerst essen: ${kw.slice(0, 3).map((x) => x.name).join(", ")}.`); }

  // 💶 Finanzen (nur lesen)
  const kt = await sicher(async () => { const K = await import("./konten.js"); const u = K.uebersicht(); return u.konten?.length ? { u, abos: K.abos() } : null; });
  if (kt) {
    const eur = kt.u.summe?.EUR ?? Object.values(kt.u.summe || {})[0];
    const aboSumme = Math.abs(kt.abos.reduce((s, a) => s + Number(a.betrag || 0), 0));
    bereiche.push({ id: "finanzen", icon: "💶", name: "Finanzen (nur ansehen)", wert: null, text: `${eur != null ? `Kontostand ${euro(eur)}` : `${kt.u.konten.length} Konten`}${kt.abos.length ? ` · ${kt.abos.length} Abos ≈ ${euro(aboSumme)}/Monat` : ""}`, details: kt.abos.slice(0, 5).map((a) => `${a.symbol} ${a.name}: ${euro(Math.abs(a.betrag))}`) });
    if (kt.abos.length >= 5) tipps.push(`Du hast ${kt.abos.length} wiederkehrende Abbuchungen. Brauchst du noch alle?`);
  }

  const mitWert = bereiche.filter((b) => b.wert != null);
  // Erst ab 2 Bereichen mit Daten ist eine "Balance" ehrlich.
  const balance = mitWert.length >= 2 ? Math.round(mitWert.reduce((s, b) => s + b.wert, 0) / mitWert.length) : null;
  return { balance, bereiche, heute: heute.slice(0, 8), tipps: tipps.slice(0, 6), quellen: mitWert.length, zeit: new Date().toISOString() };
}

export function satz(u) {
  const t = [];
  if (u.balance != null) t.push(`Deine Lebens-Balance liegt heute bei ${u.balance} von 100.`);
  const k = u.bereiche.filter((b) => ["termine", "aufgaben", "gewohnheiten", "schlaf"].includes(b.id) && b.wert != null);
  if (k.length) t.push(k.map((b) => `${b.name}: ${b.text}`).join(". ") + ".");
  if (u.tipps.length) t.push(`Mein Tipp: ${u.tipps[0]}`);
  return t.join(" ") || "Ich habe noch zu wenige Daten. Leg Gewohnheiten an, sag „gute Nacht“ und trag Aufgaben ein, dann sehe ich mehr.";
}

export async function quickCommand(text) {
  const t = String(text || "").toLowerCase();
  if (!/lebensmanager|lebens.?balance|wie läuft('?s| es)? (in )?mein(em)? leben|mein leben im (überblick|griff)|wie geht'?s meinem leben/.test(t)) return null;
  return { answer: satz(await ueberblick()), actions: ["cockpit:leben"] };
}

export function lebenRouten(app, asyncRoute) {
  app.get("/api/lebensmanager", asyncRoute(async (_req, res) => res.json(await ueberblick())));
}

export async function lebenStart() {
  try {
    const ft = await import("./funktionstest.js");
    ft.pruefungAnmelden({ id: "lebensmanager", bereich: "Alltag", name: "Lebensmanager liest echte Daten", lauf: async () => {
      const u = await ueberblick();
      if (!u.bereiche.length) return { status: "fehler", text: "Lebensmanager liefert keine Bereiche." };
      return u.quellen ? { status: "bestanden", text: `${u.quellen} Bereiche mit echten Daten, Balance ${u.balance}.` } : { status: "uebersprungen", text: "Noch keine Daten (Gewohnheiten, Schlaf, Aufgaben …) zum Auswerten." };
    } });
  } catch { /* egal */ }
}
