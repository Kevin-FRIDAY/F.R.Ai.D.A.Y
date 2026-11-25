// Gehirn-Cockpit, Reiter "🌍 Welt" (v1.181.0, Mark XII Punkte 11, 12, 13, 25):
// Global Intelligence (gebündelte, bewertete Weltlage), Prognose-Zentrale (mit ehrlicher Trefferquote)
// und Deep Research 2.0 (Tiefen-Recherche aus mehreren Quellen).
(() => {
  "use strict";
  const C = window.FridayCockpit;
  const H = window.FridayHelfer;
  if (!C || !H) return;
  const { esc, json } = H;
  const zeit = (iso) => { if (!iso) return ""; try { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  const ARTNAME = { agentur: "Agentur", oer: "Öffentl.-rechtl.", qualitaet: "Qualitätspresse", fach: "Fachmedium", regional: "Regional/Online", unbekannt: "Unbekannt", boulevard: "Boulevard", staatlich: "Staatlich gelenkt" };
  const badge = (art, stufe) => `<span class="ck-w-q s${Number(stufe) || 3}">${esc(ARTNAME[art] || art || "")}</span>`;
  const RICHTUNG = { steigt: "↗ steigt", faellt: "↘ fällt", gleich: "→ bleibt gleich" };

  async function welt(el, dossier = null) {
    const [w, p, r] = await Promise.all([json("/api/welt/lage"), json("/api/welt/prognosen"), json("/api/welt/recherchen")]);
    el.innerHTML = `
      <div class="ck-gd-kacheln ck-w-kacheln">
        <div class="ck-kachel"><b>${w.meldungen}</b><span>Meldungen weltweit</span><small>aus ${w.laender} Ländern</small></div>
        <div class="ck-kachel"><b>${w.dubletten}</b><span>Doppelte gebündelt</span><small>${w.schlagzeilen} Schlagzeilen gelesen</small></div>
        <div class="ck-kachel"><b>${w.bestaetigt}</b><span>Mehrfach bestätigt</span><small>≥ 2 unabhängige Quellen</small></div>
        <div class="ck-kachel"><b class="${p.quote == null ? "" : p.quote >= p.naiv ? "hf-gut" : "hf-warn"}">${p.quote == null ? "–" : `${p.quote} %`}</b><span>Prognosen richtig</span><small>${p.geprueft ? `bleibt-gleich: ${p.naiv} %` : `${p.tage_daten}/3 Tage Daten`}</small></div>
      </div>
      <div class="hf-karte"><h3>🌍 Global Intelligence</h3>
        ${w.schlagzeilen ? `<ol class="ck-w-liste">${w.geschichten.slice(0, 10).map((g) => `<li><a ${g.link ? `href="${esc(g.link)}" target="_blank" rel="noopener noreferrer"` : ""}><b>${esc(g.titel)}</b></a><br><span class="klein">${esc(g.quelle)} ${badge(g.art, g.stufe)}${g.quellen.length > 1 ? ` <span class="hf-badge hf-gut">✓ ${g.quellen.length} Quellen</span>` : ' <span class="hf-badge">1 Quelle</span>'}${g.laender?.length ? ` · ${esc(g.laender.join(", "))}` : ""}</span></li>`).join("")}</ol>` : '<p class="hf-hinweis">Das Lagezentrum sammelt gerade noch Meldungen (braucht Internet).</p>'}
        ${w.auffaellig.length ? `<h3>Auffällig viel los</h3><div class="hf-reihe">${w.auffaellig.map((a) => `<span class="hf-badge hf-warn">${esc(a.land)}: ${a.heute} statt ~${a.ueblich}</span>`).join("")}</div>` : `<p class="klein">Auffälligkeiten erkennt Friday, sobald es ein paar Tage Vergleichswerte gibt (jetzt: ${w.tage_gemerkt} Tag${w.tage_gemerkt === 1 ? "" : "e"}).</p>`}
        ${w.themen.length ? `<h3>Themen des Tages</h3><div class="hf-reihe">${w.themen.map((t) => `<span class="hf-badge">${esc(t.wort)} · ${t.anzahl}</span>`).join("")}</div>` : ""}
        ${w.quellenMix.length ? `<h3>Quellen-Mix</h3><div class="ck-w-mix">${w.quellenMix.map((q) => `<div><span>${esc(q.name)}</span><span class="ck-balken"><i style="width:${q.anteil}%" class="s${q.stufe}"></i></span><span class="klein">${q.anteil} %</span></div>`).join("")}</div>` : ""}
        <p class="hf-hinweis">Quellen-Art beschreibt das Medium (Agentur, öffentlich-rechtlich, Presse, Boulevard, staatlich gelenkt), keine Meinung. Gleiche Meldungen von mehreren Quellen werden zu einer gebündelt.</p>
      </div>
      <div class="hf-karte"><h3>📈 Prognose-Zentrale</h3>
        <p class="klein">Friday sagt für die Länder mit den meisten Meldungen voraus, ob die Nachrichtenlage morgen steigt, fällt oder gleich bleibt, und prüft das am nächsten Tag selbst nach. Zum Vergleich steht die einfache Annahme „bleibt gleich“ daneben.</p>
        ${p.offen.length ? `<h3>Für morgen</h3><ul class="hf-liste">${p.offen.map((x) => `<li class="hf-zeile"><span class="name"><b>${esc(x.land)}</b> ${RICHTUNG[x.aussage]} <span class="klein">(heute ${x.basis}, erwartet ${x.erwartet} · ${esc(x.methode)})</span></span><span class="klein">für ${esc(x.fuer)}</span></li>`).join("")}</ul>` : `<p class="hf-hinweis">Noch keine Prognosen. Friday braucht mindestens 3 Tage Nachrichten-Daten (jetzt ${p.tage_daten}).</p>`}
        ${p.geprueft_liste.length ? `<h3>Nachgeprüft</h3><ul class="hf-liste">${p.geprueft_liste.map((x) => `<li class="hf-zeile"><span class="name">${x.getroffen ? "✅" : "❌"} <b>${esc(x.land)}</b> ${RICHTUNG[x.aussage]} → war: ${RICHTUNG[x.ergebnis]} <span class="klein">(${x.basis} → ${x.ist})</span></span><span class="klein">${esc(x.fuer)}</span></li>`).join("")}</ul>` : ""}
        <button class="hf-btn leise" id="ck-w-runde">↻ Jetzt nachprüfen & neu vorhersagen</button>
      </div>
      <div class="hf-karte"><h3>🔎 Deep Research 2.0</h3>
        <div class="hf-reihe"><input class="hf-input grow" id="ck-w-thema" placeholder="Thema, z. B. Kernfusion" maxlength="100"><label class="klein"><input type="checkbox" id="ck-w-ki"> mit bezahlter KI-Zusammenfassung</label><button class="hf-btn haupt" id="ck-w-los">Recherchieren</button></div>
        <div id="ck-w-erg"></div>
        ${r.recherchen.length ? `<h3>Frühere Recherchen</h3><ul class="hf-liste">${r.recherchen.map((x) => `<li class="hf-zeile"><span class="name"><b>${esc(x.thema)}</b><br><span class="klein">${esc(x.qualitaet.stufe)} · ${x.qualitaet.quellen} Quellen (${x.qualitaet.hochwertig} hochwertig) · ${x.meldungen} Meldungen${x.ki ? " · mit KI-Zusammenfassung" : ""}</span></span><span class="klein">${zeit(x.erstellt)}</span><button class="hf-btn leise" data-ck-r="${esc(x.id)}">Ansehen</button></li>`).join("")}</ul>` : ""}
        <p class="hf-hinweis">Quellen: Wikipedia, Nachrichten der letzten 7 Tage und deine eigenen Feeds. Jede Quelle wird bewertet, doppelte Meldungen gebündelt, das Dossier landet unter Dokumente. KI-Zusammenfassung: mit lokaler KI (Ollama) kostenlos und automatisch, mit bezahlter KI nur, wenn du das Häkchen setzt.</p>
      </div>`;
    const erg = el.querySelector("#ck-w-erg");
    const zeige = (x) => {
      erg.innerHTML = `<div class="ck-w-dossier"><h3>${esc(x.thema)} <small class="klein">${esc(x.qualitaet.stufe)}</small></h3>
        ${x.ueberblick ? `<p>${esc(x.ueberblick.text.slice(0, 700))} <a href="${esc(x.ueberblick.link)}" target="_blank" rel="noopener noreferrer">Wikipedia</a></p>` : '<p class="klein">Kein Wikipedia-Artikel.</p>'}
        ${x.ki ? `<p class="ck-w-ki"><b>KI-Zusammenfassung (ungeprüft):</b> ${esc(x.ki)}</p>` : ""}
        ${x.meldungen?.length ? `<ol class="ck-w-liste">${x.meldungen.slice(0, 10).map((m) => `<li>${esc(m.titel)}<br><span class="klein">${esc(m.quelle)} ${badge(m.art, m.stufe)}${m.quellen.length > 1 ? ` <span class="hf-badge hf-gut">✓ ${m.quellen.length} Quellen</span>` : ""}${m.datum ? ` · ${zeit(m.datum)}` : ""}</span></li>`).join("")}</ol>` : ""}
        <p class="klein">Abgefragt: ${x.quellenStatus.map((q) => `${esc(q.name)} ${q.ok ? `✓ (${q.anzahl})` : `✗ ${esc(q.fehler || "")}`}`).join(" · ")}</p></div>`;
    };
    el.querySelector("#ck-w-los").addEventListener("click", async (e) => {
      const thema = el.querySelector("#ck-w-thema").value.trim(); if (!thema) return;
      e.target.disabled = true; e.target.textContent = "Recherchiere …";
      try { const x = await json("/api/welt/recherche", { body: { thema, mitKi: el.querySelector("#ck-w-ki").checked } }); await welt(el, x); return; }
      catch (err) { erg.innerHTML = `<p class="hf-schlecht">${esc(err.message)}</p>`; }
      finally { e.target.disabled = false; e.target.textContent = "Recherchieren"; }
    });
    if (dossier) { zeige(dossier); erg.scrollIntoView({ block: "nearest" }); }
    el.querySelectorAll("[data-ck-r]").forEach((b) => b.addEventListener("click", async () => zeige(await json(`/api/welt/recherchen/${encodeURIComponent(b.dataset.ckR)}`))));
    el.querySelector("#ck-w-runde").addEventListener("click", async () => { await json("/api/welt/prognosen/runde", { body: {} }); welt(el); });
  }

  const css = document.createElement("style");
  css.textContent = `
.ck-w-q { font-size: 10px; padding: 1px 6px; border-radius: 8px; border: 1px solid currentColor; white-space: nowrap; }
.ck-w-q.s5 { color: #6fe39a; } .ck-w-q.s4 { color: #9fe0ff; } .ck-w-q.s3 { color: #bbb; } .ck-w-q.s2 { color: #ffc46b; } .ck-w-q.s1 { color: #ff7b6b; }
.ck-w-mix i.s5 { background: #6fe39a !important; } .ck-w-mix i.s4 { background: #9fe0ff !important; } .ck-w-mix i.s3 { background: #bbb !important; } .ck-w-mix i.s2 { background: #ffc46b !important; } .ck-w-mix i.s1 { background: #ff7b6b !important; }
.ck-w-liste { margin: 6px 0 8px 18px; padding: 0; display: grid; gap: 7px; }
.ck-w-liste a { color: inherit; text-decoration: none; }
.ck-w-mix { display: grid; gap: 4px; }
.ck-w-mix > div { display: grid; grid-template-columns: 140px 1fr 44px; gap: 8px; align-items: center; font-size: 12px; }
.ck-w-dossier { border-top: 1px solid var(--u-rand-soft, var(--line)); margin-top: 10px; padding-top: 8px; }
.ck-w-ki { border-left: 2px solid var(--cyan); padding-left: 8px; }
@media (max-width: 900px) { .ck-w-mix > div { grid-template-columns: 110px 1fr 40px; } }`;
  document.head.appendChild(css);

  C.reiter("welt", "🌍 Welt", (el) => welt(el));
})();
