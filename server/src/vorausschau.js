// Vorausdenken (v1.183.0, Mark XII Punkt 4): Friday schaut auf morgen und die nächsten Tage und sagt rechtzeitig,
// woran du denken solltest. Nur aus Daten, die Friday ohnehin hat (Kalender, Wetter, Geburtstage, Kühlschrank,
// Gewohnheiten, Automationen, Speicherplatz). Ohne Claude, ohne Kosten.
// Abends um 19:00 kommt eine Mitteilung aufs Handy – nur wenn wirklich etwas Wichtiges ansteht (kein Vorlesen).
const sicher = async (fn) => { try { return await fn(); } catch { return null; } };
const uhr = (d) => { try { return new Date(d).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

export async function vorausschau() {
  const p = [];
  // Termine morgen
  const kal = await sicher(async () => (await import("./kalender.js")).termine(1, 1));
  if (kal?.ok) {
    const l = kal.termine || [];
    const frueh = l.filter((t) => !t.ganz && new Date(t.start).getHours() < 9);
    if (frueh.length) p.push({ wann: "morgen", icon: "⏰", wichtig: true, text: `Früher Termin: ${uhr(frueh[0].start)} ${frueh[0].titel}. Wecker stellen und heute früher schlafen.` });
    if (l.length >= 5) p.push({ wann: "morgen", icon: "📅", wichtig: true, text: `Morgen hast du ${l.length} Termine. Heute Abend schon vorbereiten?` });
    else if (l.length) p.push({ wann: "morgen", icon: "📅", wichtig: false, text: `Morgen: ${l.slice(0, 3).map((t) => `${t.ganz ? "" : `${uhr(t.start)} `}${t.titel}`).join(", ")}.` });
  }
  // Wetter morgen
  const w = await sicher(async () => { const T = await import("./tools.js"); return Promise.race([T.getWeather(), new Promise((r) => setTimeout(() => r(null), 5000))]); });
  const m = w?.tage?.[1];
  if (m) {
    if ((m.regen_prozent ?? 0) >= 60) p.push({ wann: "morgen", icon: "☔", wichtig: true, text: `Morgen ${m.regen_prozent} % Regen-Wahrscheinlichkeit in ${w.ort}. Schirm einpacken.` });
    if (m.min != null && m.min <= 0) p.push({ wann: "morgen", icon: "🧊", wichtig: true, text: `Morgen früh Frost (${m.min} °C). Etwas Zeit zum Scheibenkratzen einplanen.` });
    if (m.max != null && m.max >= 30) p.push({ wann: "morgen", icon: "🥵", wichtig: true, text: `Morgen bis ${m.max} °C. Morgens lüften, tagsüber abdunkeln, viel trinken.` });
  }
  // Geburtstage in den nächsten 3 Tagen
  const gb = await sicher(async () => (await import("./geburtstage.js")).kommende(3));
  for (const g of gb || []) if (g.tage >= 1) p.push({ wann: g.tage === 1 ? "morgen" : `in ${g.tage} Tagen`, icon: "🎂", wichtig: true, text: `${g.name} hat ${g.tage === 1 ? "morgen" : `in ${g.tage} Tagen`} Geburtstag. Geschenk oder Karte schon da?` });
  // Kühlschrank
  const kw = await sicher(async () => (await import("./kuehlschrank.js")).baldWeg(1));
  if (kw?.length) p.push({ wann: "morgen", icon: "🥬", wichtig: false, text: `Läuft bis morgen ab: ${kw.slice(0, 4).map((x) => x.name).join(", ")}.` });
  // Gewohnheiten, die heute noch fehlen (abends sinnvoll)
  const gw = await sicher(async () => (await import("./gewohnheiten.js")).stand());
  const droht = (gw?.liste || []).filter((g) => !g.heute && g.aktuell >= 3);
  if (droht.length && new Date().getHours() >= 16) p.push({ wann: "heute", icon: "🔥", wichtig: true, text: `Serie in Gefahr: ${droht.map((g) => `${g.name} (${g.aktuell} Tage)`).join(", ")}.` });
  // Automationen morgen früh
  const au = await sicher(async () => (await import("./automationen.js")).liste().regeln);
  const morgenWd = (new Date().getDay() + 1) % 7;
  const frueh = (au || []).filter((r) => r.an && r.ausloeser.art === "taeglich" && r.ausloeser.tage?.includes(morgenWd) && r.ausloeser.zeit < "09:00");
  if (frueh.length) p.push({ wann: "morgen", icon: "⚙", wichtig: false, text: `Läuft morgen früh automatisch: ${frueh.slice(0, 3).map((r) => `${r.ausloeser.zeit} ${r.name}`).join(", ")}.` });
  // Speicherplatz
  const sl = await sicher(async () => (await import("./systemlive.js")).systemLive());
  if (sl?.platte?.freiGB != null && sl.platte.freiGB < 10) p.push({ wann: "bald", icon: "💾", wichtig: true, text: `Auf dem Mac sind nur noch ${sl.platte.freiGB} GB frei. Bald aufräumen, sonst klappen Sicherungen nicht mehr.` });
  return { punkte: p.sort((a, b) => b.wichtig - a.wichtig), zeit: new Date().toISOString() };
}

export function satz(v) {
  if (!v.punkte.length) return "Für morgen sehe ich nichts Besonderes. Entspannter Tag.";
  const w = v.punkte.filter((x) => x.wichtig);
  return `Vorausschau: ${(w.length ? w : v.punkte).slice(0, 3).map((x) => x.text).join(" ")}`;
}

export async function quickCommand(text) {
  const t = String(text || "").toLowerCase();
  if (!/vorausschau|was (steht|kommt) morgen (an|auf mich zu)|woran (muss|sollte) ich (morgen )?denken|denk (für mich )?voraus/.test(t)) return null;
  return { answer: satz(await vorausschau()), actions: ["cockpit:arzt"] };
}

export function vorausRouten(app, asyncRoute) {
  app.get("/api/vorausschau", asyncRoute(async (_req, res) => res.json(await vorausschau())));
}

export async function vorausStart() {
  try {
    const hz = await import("./herzschlag.js");
    hz.aufgabeRegistrieren("vorausschau", { name: "Vorausdenken", text: "Schaut abends auf morgen und schickt eine Mitteilung, wenn etwas Wichtiges ansteht (nur Text, kein Vorlesen).", art: "taeglich", zeit: "19:00", standardAn: true, lauf: async () => {
      const v = await vorausschau();
      const w = v.punkte.filter((x) => x.wichtig);
      if (w.length) await import("./notify.js").then((n) => n.notifyAll("🔮 Friday denkt voraus", w.slice(0, 4).map((x) => `${x.icon} ${x.text}`).join("\n"))).catch(() => {});
      return { ok: true, text: w.length ? `${w.length} wichtige Punkte gemeldet` : "Nichts Wichtiges, keine Mitteilung" };
    } });
  } catch { /* egal */ }
}
