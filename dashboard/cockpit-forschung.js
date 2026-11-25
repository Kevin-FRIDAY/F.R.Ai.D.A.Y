// Gehirn-Cockpit, Reiter "📡 Forschung" und "📚 Studien" (v1.187.0, Mark XVI):
// Krisen-Frühwarnung, Technik-/Forschungs-/Wirtschafts-Radar mit Trends über Wochen,
// Studien-Suche (arXiv + Crossref), Forschungsdatenbank, Technologie-Vergleich.
(() => {
  "use strict";
  const C = window.FridayCockpit;
  const H = window.FridayHelfer;
  if (!C || !H) return;
  const { esc, json } = H;
  const zeit = (iso) => { try { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  const link = (url, text) => (/^https:\/\//.test(url || "") ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>` : esc(text));
  const TREND = { steigt: "hf-schlecht", faellt: "hf-gut", gleich: "", sammelt: "klein" };
  const PFEIL = { steigt: "↗", faellt: "↘", gleich: "→", sammelt: "…" };
  let suche = null, sucheBegriff = "", vergleich = null, vergleichText = "", dbQ = "";

  function linie(werte) {
    const w = werte.map((v) => (v == null ? null : Number(v)));
    const max = Math.max(1, ...w.filter((v) => v != null));
    if (w.filter((v) => v != null).length < 2) return "";
    const pkt = w.map((v, i) => (v == null ? null : `${(i / Math.max(1, w.length - 1)) * 100},${28 - (v / max) * 26}`)).filter(Boolean).join(" ");
    return `<svg class="ck-fo-linie" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pkt}" /></svg>`;
  }

  async function forschung(el, meldung = "") {
    const d = await json("/api/forschung");
    const r = d.radar, w = d.warnung;
    const gruppen = Object.entries(r.arten).map(([art, name]) => [name, r.themen.filter((t) => t.art === art)]).filter(([, l]) => l.length);
    el.innerHTML = `${meldung ? `<p class="hf-hinweis">${esc(meldung)}</p>` : ""}
      <div class="hf-karte"><h3>🚨 Krisen-Frühwarnung</h3>
        ${w ? `<div class="ck-fo-stufe ck-fo-${esc(w.stufe)}"><span>${esc(w.icon)}</span><div><b>${esc(w.stufeName)}</b> · ${w.punkte} von 100<br><span class="klein">Stand ${zeit(w.at)}</span></div></div>
          ${w.gruende.length ? `<ul class="hf-liste">${w.gruende.map((g) => `<li>${esc(g.icon)} ${esc(g.text)} <span class="klein">(${esc(g.quelle)}, +${g.punkte})</span></li>`).join("")}</ul>` : ""}
          <p class="klein">${w.quellen.map((q) => `${q.ok ? "✓" : "✗"} ${esc(q.name)}`).join(" · ")}</p>
          ${w.quellen.some((q) => !q.ok) ? '<p class="hf-warn klein">Nicht alle Quellen waren erreichbar. Das Bild ist unvollständig.</p>' : ""}` : '<p class="klein">Noch nicht geprüft.</p>'}
        <div class="hf-reihe"><button class="hf-btn" id="ck-fo-warn">Jetzt prüfen</button></div>
        <p class="hf-hinweis">Bündelt Unwetter an deinem Wohnort (DWD), Welt-Alarm (GDACS), starke Erdbeben (USGS), auffällige Länder und Wirtschafts-Ausschläge. Stündlich. Eine Mitteilung (nur Text) gibt es nur, wenn es ernster wird.</p>
      </div>
      <div class="hf-karte"><h3>📡 Radar: Technik, Forschung, Wirtschaft</h3>
        <p class="klein">${r.stand ? `Letzter Lauf ${zeit(r.stand.at)}${r.stand.fehler.length ? ` · ${r.stand.fehler.length} Quellen nicht erreichbar` : ""}` : "Noch kein Lauf."} · ${r.tage} Tage gesammelt. Trends ab 8 Tagen.</p>
        ${gruppen.map(([name, l]) => `<h4 class="ck-fo-gruppe">${esc(name)}</h4><div class="ck-fo-raster">${l.map((t) => `
          <div class="ck-fo-thema"><div class="ck-fo-kopf"><b>${esc(t.name)}</b><button class="hf-btn leise ck-fo-x" data-weg="${esc(t.id)}" title="Aus dem Radar nehmen">✕</button></div>
            ${linie(t.verlauf)}
            <p class="klein">📰 ${t.newsHeute ?? "–"} Meldungen/Woche <span class="${TREND[t.trendNews.richtung]}">${PFEIL[t.trendNews.richtung]} ${esc(t.trendNews.text)}</span></p>
            ${t.en ? `<p class="klein">🔬 ${t.studienWoche ?? "–"} neue Studien/Woche${t.trendStudien ? ` <span class="${TREND[t.trendStudien.richtung]}">${PFEIL[t.trendStudien.richtung]} ${esc(t.trendStudien.text)}</span>` : ""}</p>` : ""}
            ${(t.neu.studien || []).length || (t.neu.news || []).length ? `<details><summary class="klein">Neueste</summary><ul class="ck-fo-neu">${(t.neu.studien || []).slice(0, 3).map((s) => `<li>🔬 ${link(s.link, s.titel)}</li>`).join("")}${(t.neu.news || []).slice(0, 3).map((n) => `<li>📰 ${link(n.link, n.titel)} <span class="klein">${esc(n.quelle)}</span></li>`).join("")}</ul></details>` : ""}
          </div>`).join("")}</div>`).join("")}
        <div class="hf-reihe"><input class="hf-input grow" id="ck-fo-name" placeholder="Neues Thema, z. B. Wasserstoff" maxlength="40"><input class="hf-input grow" id="ck-fo-en" placeholder="englisch für Studien (optional)" maxlength="80"><select class="hf-input" id="ck-fo-art">${Object.entries(r.arten).map(([a, n]) => `<option value="${esc(a)}">${esc(n)}</option>`).join("")}</select><button class="hf-btn" id="ck-fo-dazu">Dazu</button><button class="hf-btn haupt" id="ck-fo-lauf">Radar jetzt</button></div>
        <p class="hf-hinweis">Jede Nacht um 5:30 Uhr, kostenlos: Nachrichten (Google News) und neue Studien (arXiv) pro Thema. Das misst Aufmerksamkeit, nicht Wahrheit.</p>
      </div>
      <div class="hf-karte"><h3>📈 Trends im Weltgeschehen</h3>
        ${r.weltTrends.length ? `<ul class="hf-liste">${r.weltTrends.map((x) => `<li class="hf-zeile"><span class="name"><b>${esc(x.wort)}</b> ${x.neu ? '<span class="hf-warn">neu</span>' : ""}</span><span class="klein">${x.jetzt} Nennungen diese Woche, ${x.vorher} davor</span></li>`).join("")}</ul>` : `<p class="klein">${r.weltTage < 8 ? `Sammelt noch: ${r.weltTage} von 8 Tagen.` : "Kein Thema wächst gerade stark."}</p>`}
        <p class="hf-hinweis">Aus den Schlagzeilen aller Länder: Wörter, die diese Woche mindestens doppelt so oft vorkommen wie in der Woche davor.</p>
      </div>`;
    const knopf = (sel, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener("click", async () => {
      x.disabled = true;
      let text = "";
      try { const res = await fn(x); text = res?.text || res?.error || ""; } catch (err) { text = err.message; }
      forschung(el, text);
    }));
    knopf("#ck-fo-warn", (x) => { x.textContent = "Prüfe …"; return json("/api/forschung/fruehwarnung", { body: {} }).then(() => ({})); });
    knopf("#ck-fo-lauf", async (x) => { x.textContent = "Radar läuft …"; const res = await json("/api/forschung/radar", { body: {} }); return { text: res.fehler.length ? `Fertig. ${res.fehler.length} Quellen waren nicht erreichbar.` : "Radar aktualisiert." }; });
    knopf("#ck-fo-dazu", () => json("/api/forschung/thema", { body: { name: el.querySelector("#ck-fo-name").value, de: el.querySelector("#ck-fo-name").value, en: el.querySelector("#ck-fo-en").value, art: el.querySelector("#ck-fo-art").value } }));
    knopf("[data-weg]", (x) => json(`/api/forschung/thema/${encodeURIComponent(x.dataset.weg)}`, { method: "DELETE" }));
  }

  function trefferHtml(t, i) {
    return `<li class="ck-fo-studie"><div class="hf-zeile"><span class="name">${link(t.link, t.titel)}<br><span class="klein">${esc(t.quelle)} · ${esc(t.art)}${t.zeitschrift ? ` · ${esc(t.zeitschrift)}` : ""} · ${esc(String(t.datum || "").slice(0, 10))}${t.autoren?.length ? ` · ${esc(t.autoren.join(", "))}${t.mehrAutoren ? " u. a." : ""}` : ""}</span></span><button class="hf-btn leise" data-merk="${i}">Merken</button></div>
      ${t.zusammenfassung ? `<p class="klein">${esc(t.zusammenfassung)}</p>` : ""}</li>`;
  }

  async function studien(el, meldung = "") {
    const db = await json(`/api/forschung/datenbank?q=${encodeURIComponent(dbQ)}`);
    el.innerHTML = `${meldung ? `<p class="hf-hinweis">${esc(meldung)}</p>` : ""}
      <div class="hf-karte"><h3>🔬 Studien-Suche</h3>
        <div class="hf-reihe"><input class="hf-input grow" id="ck-fo-q" value="${esc(sucheBegriff)}" placeholder="z. B. nuclear fusion, intermittent fasting" maxlength="120"><button class="hf-btn haupt" id="ck-fo-suchen">Suchen</button></div>
        ${suche ? `<p class="klein">${suche.quellen.map((q) => `${q.ok ? "✓" : "✗"} ${esc(q.name)}${q.ok ? ` (${q.anzahl})` : ""}`).join(" · ")}</p>${suche.hinweis ? `<p class="hf-warn klein">${esc(suche.hinweis)}</p>` : ""}
          ${suche.treffer.length ? `<ul class="hf-liste">${suche.treffer.map(trefferHtml).join("")}</ul>` : '<p class="klein">Keine Treffer.</p>'}` : ""}
        <p class="hf-hinweis">arXiv = Vorabdrucke, noch nicht von anderen Forschern geprüft. Crossref = Artikel aus Fachzeitschriften (begutachtet). Kostenlos, ohne Schlüssel.</p>
      </div>
      <div class="hf-karte"><h3>🗂 Forschungsdatenbank (${db.gesamt})</h3>
        <div class="hf-reihe"><input class="hf-input grow" id="ck-fo-dbq" value="${esc(dbQ)}" placeholder="In gemerkten Studien und Dossiers suchen …" maxlength="80"><button class="hf-btn" id="ck-fo-dbsuche">Suchen</button></div>
        ${db.studien.length ? `<ul class="hf-liste">${db.studien.slice(0, 40).map((s) => `<li class="ck-fo-studie"><div class="hf-zeile"><span class="name">${link(s.link, s.titel)}<br><span class="klein">${esc(s.quelle)} · ${esc(s.datum)}${s.thema ? ` · 🏷 ${esc(s.thema)}` : ""}</span></span><button class="hf-btn leise" data-loesch="${esc(s.id)}">Entfernen</button></div>
          <div class="hf-reihe"><input class="hf-input grow" data-notiz="${esc(s.id)}" value="${esc(s.notiz)}" placeholder="Notiz …" maxlength="500"><input class="hf-input" data-thema="${esc(s.id)}" value="${esc(s.thema)}" placeholder="Thema" maxlength="60"><button class="hf-btn leise" data-sichern="${esc(s.id)}">Speichern</button></div></li>`).join("")}</ul>` : `<p class="klein">${dbQ ? "Keine gemerkte Studie passt." : "Noch keine Studien gemerkt. Bei der Suche oben auf „Merken“ drücken."}</p>`}
        ${db.dossiers.length ? `<h4 class="ck-fo-gruppe">Dossiers der Tiefen-Recherche</h4><ul class="hf-liste">${db.dossiers.slice(0, 15).map((x) => `<li class="hf-zeile"><span class="name">📄 ${esc(x.thema)}</span><span class="klein">${x.meldungen} Meldungen · ${zeit(x.at)}</span></li>`).join("")}</ul>` : ""}
      </div>
      <div class="hf-karte"><h3>⚖️ Technologie-Vergleich</h3>
        <div class="hf-reihe"><input class="hf-input grow" id="ck-fo-vgl" value="${esc(vergleichText)}" placeholder="2 bis 4 Begriffe mit Komma, z. B. solid-state battery, sodium-ion battery" maxlength="250"><button class="hf-btn haupt" id="ck-fo-vglos">Vergleichen</button></div>
        ${vergleich ? (vergleich.error ? `<p class="hf-warn">${esc(vergleich.error)}</p>` : `<div class="ck-fo-tabelle"><table><thead><tr><th>Begriff</th><th>Studien (12 Mon.)</th><th>Vorjahr</th><th>Wachstum</th><th>Nachrichten (30 T.)</th></tr></thead><tbody>${vergleich.zeilen.map((z) => `<tr><td><b>${esc(z.begriff)}</b>${z.wiki ? `<br><span class="klein">${esc(z.wiki.satz)}</span>` : ""}${z.fehler.length ? `<br><span class="klein hf-warn">${esc(z.fehler.join(" · "))}</span>` : ""}</td><td>${z.studienJahr ?? "–"}</td><td>${z.studienVorjahr ?? "–"}</td><td>${z.wachstum == null ? "–" : `${z.wachstum > 0 ? "+" : ""}${z.wachstum} %`}</td><td>${z.news ?? "–"}</td></tr>`).join("")}</tbody></table></div>
          <ul class="hf-liste">${vergleich.fazit.map((f) => `<li>💡 ${esc(f)}</li>`).join("")}</ul><p class="klein">${esc(vergleich.hinweis)}</p>`) : ""}
        <p class="hf-hinweis">Dauert etwa 10 Sekunden pro Begriff, weil arXiv nur langsame Abfragen erlaubt.</p>
      </div>`;
    const knopf = (sel, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener("click", async () => {
      x.disabled = true;
      let text = "";
      try { const res = await fn(x); text = res?.text || res?.error || ""; } catch (err) { text = err.message; }
      studien(el, text);
    }));
    knopf("#ck-fo-suchen", async (x) => { x.textContent = "Suche …"; sucheBegriff = el.querySelector("#ck-fo-q").value; suche = await json("/api/forschung/suche", { body: { begriff: sucheBegriff } }); if (suche.error) { const e = suche.error; suche = null; return { text: e }; } return {}; });
    knopf("[data-merk]", (x) => json("/api/forschung/merken", { body: { studie: suche.treffer[Number(x.dataset.merk)], thema: sucheBegriff } }));
    knopf("#ck-fo-dbsuche", async () => { dbQ = el.querySelector("#ck-fo-dbq").value; return {}; });
    knopf("[data-loesch]", (x) => json(`/api/forschung/studie/${encodeURIComponent(x.dataset.loesch)}`, { method: "DELETE" }));
    knopf("[data-sichern]", async (x) => { const id = x.dataset.sichern; await json(`/api/forschung/studie/${encodeURIComponent(id)}`, { body: { notiz: el.querySelector(`[data-notiz="${CSS.escape(id)}"]`).value, thema: el.querySelector(`[data-thema="${CSS.escape(id)}"]`).value } }); return { text: "Gespeichert." }; });
    knopf("#ck-fo-vglos", async (x) => { x.textContent = "Vergleiche …"; vergleichText = el.querySelector("#ck-fo-vgl").value; vergleich = await json("/api/forschung/vergleich", { body: { begriffe: vergleichText } }); return {}; });
    el.querySelectorAll("#ck-fo-q, #ck-fo-dbq, #ck-fo-vgl").forEach((i) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") el.querySelector({ "ck-fo-q": "#ck-fo-suchen", "ck-fo-dbq": "#ck-fo-dbsuche", "ck-fo-vgl": "#ck-fo-vglos" }[i.id]).click(); }));
  }

  const css = document.createElement("style");
  css.textContent = `
.ck-fo-stufe { display: flex; gap: 12px; align-items: center; padding: 8px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,.12); margin-bottom: 6px; }
.ck-fo-stufe > span { font-size: 30px; }
.ck-fo-angespannt { border-color: rgba(255,150,40,.7); } .ck-fo-kritisch { border-color: rgba(255,60,60,.8); box-shadow: 0 0 12px rgba(255,60,60,.3); }
.ck-fo-gruppe { margin: 10px 0 4px; font-size: 13px; opacity: .85; }
.ck-fo-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
.ck-fo-thema { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 6px 10px; min-width: 0; }
.ck-fo-thema p { margin: 3px 0; }
.ck-fo-kopf { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.ck-fo-x { padding: 0 6px; min-width: 0; font-size: 11px; }
.ck-fo-linie { width: 100%; height: 26px; display: block; }
.ck-fo-linie polyline { fill: none; stroke: var(--cyan); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.ck-fo-neu { margin: 4px 0 0; padding-left: 16px; font-size: 12px; display: grid; gap: 3px; overflow-wrap: anywhere; }
.ck-fo-studie { list-style: none; border-left: 2px solid var(--cyan); padding-left: 8px; margin: 6px 0; overflow-wrap: anywhere; }
.ck-fo-studie a, .ck-fo-neu a { color: inherit; }
.ck-fo-tabelle { overflow-x: auto; }
.ck-fo-tabelle table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ck-fo-tabelle th, .ck-fo-tabelle td { text-align: left; padding: 5px 8px; border-bottom: 1px solid rgba(255,255,255,.08); vertical-align: top; }
@media (max-width: 900px) { .ck-fo-raster { grid-template-columns: 1fr; } .ck-fo-tabelle table { font-size: 12px; } }`;
  document.head.appendChild(css);

  C.reiter("forschung", "📡 Forschung", (el) => forschung(el));
  C.reiter("studien", "📚 Studien", (el) => studien(el));
})();
