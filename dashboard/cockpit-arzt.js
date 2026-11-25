// Gehirn-Cockpit, Reiter "🩺 Arzt" und "🔐 Sicherheit" (v1.183.0, Mark XII Punkte 4, 5, 17, 19, 21, 26, 29):
// System-Arzt mit Befund und Behandlungen, Performance-Labor, Selbstoptimierung, Vorausdenken,
// Cybersecurity-Zentrale (Punktzahl, Zugriffs-Protokoll, überall abmelden, Datenleck-Wächter, Plugins, Freigaben).
(() => {
  "use strict";
  const C = window.FridayCockpit;
  const H = window.FridayHelfer;
  if (!C || !H) return;
  const { esc, json } = H;
  const zeit = (iso) => { try { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  const STUFE = { gut: ["✅", "hf-gut"], hinweis: ["⚠️", "hf-warn"], problem: ["❌", "hf-schlecht"] };

  function kurve(werte, farbe = "var(--cyan)") {
    const w = werte.filter((x) => x != null);
    if (w.length < 2) return '<p class="klein">Verlauf erscheint nach ein paar Stunden.</p>';
    const max = Math.max(...w, 1), b = 300, h = 46;
    const pkt = werte.map((v, i) => `${Math.round((i / (werte.length - 1)) * b)},${Math.round(h - ((v ?? 0) / max) * (h - 4)) - 2}`).join(" ");
    return `<svg viewBox="0 0 ${b} ${h}" class="ck-a-kurve" preserveAspectRatio="none"><polyline points="${pkt}" fill="none" stroke="${farbe}" stroke-width="2"/></svg>`;
  }

  async function arzt(el, meldung = "") {
    const [a, v] = await Promise.all([json("/api/systemarzt"), json("/api/vorausschau")]);
    const b = a.befund, l = a.leistung;
    el.innerHTML = `${meldung ? `<p class="hf-hinweis">${esc(meldung)}</p>` : ""}
      <div class="ck-gd-kacheln ck-w-kacheln">
        <div class="ck-kachel"><b class="${!b ? "" : b.note >= 85 ? "hf-gut" : b.note >= 60 ? "hf-warn" : "hf-schlecht"}">${b ? b.note : "–"}</b><span>Gesundheit</span><small>${b ? esc(b.zustand) : "noch nicht untersucht"}</small></div>
        <div class="ck-kachel"><b>${l.schleife ? `${l.schleife.p95} ms` : "–"}</b><span>Reaktion (p95)</span><small>Event-Loop-Verzögerung</small></div>
        <div class="ck-kachel"><b>${l.ramMB} MB</b><span>Fridays Speicher</span><small>Heap ${l.heapMB} MB</small></div>
        <div class="ck-kachel"><b>${l.anfragen}</b><span>Anfragen gemessen</span><small>seit ${Math.round(l.seit / 60)} Min.</small></div>
      </div>
      <div class="hf-karte"><h3>🩺 System-Arzt</h3>
        ${b ? `<p class="klein">Letzte Untersuchung: ${zeit(b.zeit)}</p><ul class="hf-liste">${b.befunde.map((x) => `<li class="hf-zeile"><span class="name">${STUFE[x.stufe][0]} <b>${esc(x.bereich)}</b>: ${esc(x.text)}</span>${x.behandlung ? `<button class="hf-btn leise" data-ck-beh="${esc(x.behandlung.id)}">${esc(x.behandlung.name)}</button>` : ""}</li>`).join("")}</ul>` : '<p class="klein">Noch kein Befund.</p>'}
        <button class="hf-btn haupt" id="ck-a-los">🩺 Jetzt untersuchen</button>
      </div>
      <div class="hf-karte"><h3>🔮 Vorausdenken</h3>
        ${v.punkte.length ? `<ul class="hf-liste">${v.punkte.map((p) => `<li class="hf-zeile"><span class="name">${p.icon} ${p.wichtig ? "<b>" : ""}${esc(p.text)}${p.wichtig ? "</b>" : ""}</span><span class="klein">${esc(p.wann)}</span></li>`).join("")}</ul>` : '<p class="klein">Für morgen steht nichts Besonderes an.</p>'}
        <p class="hf-hinweis">Abends um 19 Uhr schickt Friday eine Mitteilung, wenn etwas Wichtiges ansteht (nur Text, kein Vorlesen). Ausschalten: Reiter System → Hintergrund-Aufgaben → Vorausdenken.</p>
      </div>
      <div class="hf-karte"><h3>🔧 Selbstoptimierung</h3>
        ${a.vorschlaege.length ? `<ul class="hf-liste">${a.vorschlaege.map((x) => `<li class="hf-zeile"><span class="name">💡 ${esc(x.text)}</span>${x.knopf ? `<button class="hf-btn haupt" data-ck-opt="${esc(x.id)}">${esc(x.knopf)}</button>` : ""}</li>`).join("")}</ul>` : '<p class="klein">Gerade gibt es nichts zu verbessern.</p>'}
        ${a.angewendet.length ? `<h3>Umgesetzt</h3><ul class="hf-liste">${a.angewendet.map((x, i) => `<li class="hf-zeile"><span class="name">${x.zurueck ? "↩" : "✓"} ${esc(x.text)}</span><span class="klein">${zeit(x.zeit)}</span>${x.zurueck ? "" : `<button class="hf-btn leise" data-ck-zur="${i}">Rückgängig</button>`}</li>`).join("")}</ul>` : ""}
        <p class="hf-hinweis">Friday ändert nichts von selbst. Jeder Vorschlag braucht deinen Klick und lässt sich rückgängig machen.</p>
      </div>
      <div class="hf-karte"><h3>⚡ Performance-Labor</h3>
        <div class="ck-a-zwei"><div><p class="klein">Reaktion (p95, ms) – letzte ${a.verlauf.length} Stunden</p>${kurve(a.verlauf.map((x) => x.loopP95))}</div><div><p class="klein">Arbeitsspeicher (MB)</p>${kurve(a.verlauf.map((x) => x.ramMB), "#9fe0ff")}</div></div>
        ${l.langsamste.length ? `<h3>Langsamste Anfragen</h3><div class="ck-a-tab">${l.langsamste.map((r) => `<div><span>${esc(r.route)}</span><span class="${r.schnitt > 3000 ? "hf-warn" : ""}">${r.schnitt} ms</span><span class="klein">max ${r.max} ms · ${r.anfragen}×</span></div>`).join("")}</div>` : ""}
        <p class="hf-hinweis">Gemessen wird echt, bei jeder Anfrage an Friday. Nichts davon verlässt deinen Mac.</p>
      </div>`;
    const knopf = (sel, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener("click", async () => {
      x.disabled = true;
      let text = "";
      try { const r = await fn(x); text = r.text || (r.note != null ? `Befund: ${r.zustand} (${r.note}/100)` : "Erledigt."); } catch (err) { text = err.message; }
      arzt(el, text);
    }));
    knopf("#ck-a-los", () => json("/api/systemarzt/untersuchen", { body: {} }));
    knopf("[data-ck-beh]", (x) => json("/api/systemarzt/behandeln", { body: { id: x.dataset.ckBeh } }));
    knopf("[data-ck-opt]", (x) => json("/api/systemarzt/optimieren", { body: { id: x.dataset.ckOpt } }));
    knopf("[data-ck-zur]", (x) => json("/api/systemarzt/optimieren", { body: { rueckgaengig: Number(x.dataset.ckZur) } }));
  }

  async function sicherheit(el, meldung = "") {
    const s = await json("/api/sicherheit");
    const ART = { ok: "✅ angemeldet", falsch: "❌ falsches Passwort", gesperrt: "⛔ gesperrt (zu viele Versuche)", abgemeldet: "🚪 überall abgemeldet" };
    el.innerHTML = `${meldung ? `<p class="hf-hinweis">${esc(meldung)}</p>` : ""}
      <div class="ck-gd-kacheln ck-w-kacheln">
        <div class="ck-kachel"><b class="${s.punkte >= 85 ? "hf-gut" : s.punkte >= 60 ? "hf-warn" : "hf-schlecht"}">${s.punkte}</b><span>Sicherheit</span><small>von 100 Punkten</small></div>
        <div class="ck-kachel"><b>${s.anmeldungen24}</b><span>Anmeldungen (24 h)</span><small>${esc(s.geraete.join(", ") || "–")}</small></div>
        <div class="ck-kachel"><b class="${s.fehl24 >= 10 ? "hf-schlecht" : s.fehl24 ? "hf-warn" : ""}">${s.fehl24}</b><span>Falsche Passwörter</span><small>letzte 24 h</small></div>
        <div class="ck-kachel"><b>${s.freigaben ? s.freigaben.offen : "–"}</b><span>Freigaben offen</span><small>${s.freigaben ? `Stufe: ${esc(s.freigaben.stufe || "")}` : ""}</small></div>
      </div>
      <div class="hf-karte"><h3>🔐 Sicherheits-Check</h3>
        <ul class="hf-liste">${s.pruefungen.map((p) => `<li class="hf-zeile"><span class="name">${p.ok === null ? "➖" : p.ok ? "✅" : "⚠️"} <b>${esc(p.name)}</b>${p.wert ? ` <span class="klein">(${esc(p.wert)})</span>` : ""}${p.ok === false ? `<br><span class="klein">${esc(p.rat)}</span>` : ""}</span></li>`).join("")}</ul>
        ${s.letzterRollback ? `<p class="hf-hinweis">Letzter automatischer Rollback: Version ${esc(s.letzterRollback.ziel)} startete nicht, zurück auf ${esc(s.letzterRollback.von)} (${zeit(s.letzterRollback.zeit)}).</p>` : ""}
      </div>
      <div class="hf-karte"><h3>🛡 Datenleck-Wächter</h3>
        ${s.scan ? `<p class="klein">Zuletzt geprüft: ${zeit(s.scan.zeit)}</p>${s.scan.funde.length ? `<ul class="hf-liste">${s.scan.funde.map((f) => `<li class="hf-zeile"><span class="name">${f.stufe === "hoch" ? "❌" : "⚠️"} ${esc(f.was)}${f.tipp ? `<br><span class="klein">${esc(f.tipp)}</span>` : ""}</span>${f.reparieren ? `<button class="hf-btn haupt" data-ck-rep="${esc(f.reparieren)}">Reparieren</button>` : ""}</li>`).join("")}</ul>` : '<p class="hf-gut">Keine Funde. Schlüssel und Daten liegen sicher.</p>'}${s.scan.hinweise.length ? `<p class="klein">${s.scan.hinweise.map(esc).join(" · ")}</p>` : ""}` : '<p class="klein">Noch nicht geprüft.</p>'}
        <button class="hf-btn leise" id="ck-s-scan">🔎 Jetzt prüfen</button>
      </div>
      <div class="hf-karte"><h3>📜 Zugriffs-Protokoll</h3>
        ${s.protokoll.length ? `<ul class="hf-liste ck-s-prot">${s.protokoll.slice(0, 20).map((e) => `<li class="hf-zeile"><span class="name">${ART[e.art] || esc(e.art)} <span class="klein">${esc(e.geraet)} · ${esc(e.ip)}</span></span><span class="klein">${zeit(e.zeit)}</span></li>`).join("")}</ul>` : '<p class="klein">Seit diesem Update noch keine Anmeldung.</p>'}
        <div class="hf-reihe"><button class="hf-btn" id="ck-s-ab">🚪 Überall abmelden</button><span class="klein">Alle anderen Geräte müssen sich neu anmelden (z. B. wenn ein Handy verloren ging). Dieses Gerät bleibt angemeldet.</span></div>
      </div>
      <div class="hf-karte"><h3>🧩 Plugins und Rechte</h3>
        ${s.plugins.length ? `<ul class="hf-liste">${s.plugins.map((p) => `<li class="hf-zeile"><span class="name">${p.an ? "🟢" : "⚫"} <b>${esc(p.name)}</b><br><span class="klein">${esc(p.rechte.join(" · ") || "keine besonderen Rechte")}</span></span></li>`).join("")}</ul>` : '<p class="klein">Keine Plugins installiert.</p>'}
        <p class="hf-hinweis">Plugins sind kleine Bausteine ohne eigenes Programm und können nur das, was hier steht. Verwalten im Werkzeug-Menü unter Modul-Zentrale. Freigaben und Autonomie-Stufe stellst du im Reiter 🔐 Freigaben ein.</p>
      </div>`;
    const knopf = (sel, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener("click", async () => {
      x.disabled = true;
      let text = "";
      try { const r = await fn(x); text = r.text || r.info || (r.stufe ? `Datenleck-Wächter: ${r.funde.length ? `${r.funde.length} Hinweise` : "alles in Ordnung"}` : "Erledigt."); } catch (err) { text = err.message; }
      sicherheit(el, text);
    }));
    knopf("#ck-s-scan", () => json("/api/sicherheit/datenleck", { body: {} }));
    knopf("[data-ck-rep]", (x) => json("/api/sicherheit/reparieren", { body: { was: x.dataset.ckRep } }));
    knopf("#ck-s-ab", async () => {
      const r = await json("/api/sicherheit/ueberall-abmelden", { body: {} });
      // Dieses Gerät bekommt sofort die neue Anmeldung, damit es angemeldet bleibt.
      if (r.token) window.Friday?.neueAnmeldung?.(r.token);
      return r;
    });
  }

  const css = document.createElement("style");
  css.textContent = `
.ck-a-kurve { width: 100%; height: 46px; display: block; }
.ck-a-zwei { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ck-a-tab { display: grid; gap: 3px; font-size: 12px; }
.ck-a-tab > div { display: grid; grid-template-columns: 1fr 70px 120px; gap: 8px; }
.ck-a-tab > div span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 900px) { .ck-a-zwei { grid-template-columns: 1fr; } .ck-a-tab > div { grid-template-columns: 1fr 60px; } .ck-a-tab > div span:last-child { display: none; } }`;
  document.head.appendChild(css);

  C.reiter("arzt", "🩺 Arzt", (el) => arzt(el));
  C.reiter("sicherheit", "🔐 Sicherheit", (el) => sicherheit(el));
})();
