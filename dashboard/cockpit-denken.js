// Gehirn-Cockpit, Reiter "🧠 Denken" (v1.184.0, Mark XIII):
// Lage jetzt (Kontext-Erkennung), Befehls-Vorhersage, Selbstlernen (Qualität, Lücken, Fehlergedächtnis, Antwortwege),
// Entscheidungs-Matrix, Zukunftssimulator, Agenten-Diskussion.
(() => {
  "use strict";
  const C = window.FridayCockpit;
  const H = window.FridayHelfer;
  if (!C || !H) return;
  const { esc, json } = H;
  const zeit = (iso) => { try { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  const LS = "friday_denken_matrix";
  const lies = () => { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch { return null; } };
  const merke = (m) => { try { localStorage.setItem(LS, JSON.stringify(m)); } catch { /* egal */ } };
  let matrix = lies() || { frage: "", optionen: ["", ""], kriterien: [{ name: "Kosten", gewicht: 3 }, { name: "Nutzen", gewicht: 4 }], werte: {} };
  let simErgebnis = null, matrixErgebnis = null, diskErgebnis = null, diskFrage = "";

  async function denken(el, meldung = "") {
    const [k, s, e] = await Promise.all([json("/api/kontext"), json("/api/selbstlernen"), json("/api/entscheiden")]);
    const l = k.lage;
    const q = s.qualitaet;
    el.innerHTML = `${meldung ? `<p class="hf-hinweis">${esc(meldung)}</p>` : ""}
      <div class="ck-gd-kacheln ck-w-kacheln">
        <div class="ck-kachel"><b>${esc(l.modus)}</b><span>Lage jetzt</span><small>${esc(l.wochentag)}, ${esc(l.tageszeit)}</small></div>
        <div class="ck-kachel"><b>${k.treffer.quote != null ? `${k.treffer.quote} %` : "–"}</b><span>Vorhersage-Treffer</span><small>${k.treffer.geprueft ? `an ${k.treffer.geprueft} echten Fragen` : `ab 25 Fragen (${k.fragen})`}</small></div>
        <div class="ck-kachel"><b class="${q.quote == null ? "" : q.quote >= 85 ? "hf-gut" : q.quote >= 60 ? "hf-warn" : "hf-schlecht"}">${q.quote != null ? `${q.quote} %` : "–"}</b><span>Antworten ohne Mangel</span><small>${q.gesamt} geprüft</small></div>
        <div class="ck-kachel"><b>${s.offen}</b><span>Offene Wissenslücken</span><small>nachts kostenlos recherchiert</small></div>
      </div>
      <div class="hf-karte"><h3>🧭 Lage jetzt</h3>
        <ul class="hf-liste">
          <li class="hf-zeile"><span class="name">Modus <b>${esc(l.modus)}</b>${l.schlaeft ? " · 😴 du schläfst" : ""}${l.gaeste ? " · 👥 Gästemodus" : ""}${l.notfall ? " · 🚨 Notfall" : ""}</span><span class="klein">${l.werktag ? "Werktag" : "Wochenende"}</span></li>
          <li class="hf-zeile"><span class="name">📅 ${l.termin ? `Gerade im Termin <b>${esc(l.termin.titel)}</b>` : l.naechster ? `Nächster Termin: ${esc(l.naechster.titel)} in ${l.naechster.inMin} Min.` : l.kalender ? "Heute kein Termin mehr" : "Kalender nicht verbunden (braucht den Mac)"}</span></li>
          ${l.mission ? `<li class="hf-zeile"><span class="name">🎯 Mission läuft: ${esc(l.mission.titel)}</span></li>` : ""}
          ${l.geraet ? `<li class="hf-zeile"><span class="name">📱 Zuletzt benutzt: ${esc(l.geraet)}</span></li>` : ""}
        </ul>
        <p class="hf-hinweis">Friday bekommt diese Lage als eine Zeile mit und antwortet passender (im Termin kurz, nachts knapp). Im Gästemodus sieht sie keine Termine.</p>
      </div>
      <div class="hf-karte"><h3>🔮 Was du wohl gleich fragst</h3>
        ${k.vorhersage.length ? `<ul class="hf-liste">${k.vorhersage.map((v) => `<li class="hf-zeile"><span class="name">„${esc(v.beispiel)}“</span><span class="klein">${v.sicherheit} %</span><button class="hf-btn leise" data-ck-frag="${esc(v.beispiel)}">Fragen</button></li>`).join("")}</ul>` : `<p class="klein">Dafür kenne ich dich noch zu wenig (ab 10 Fragen, jetzt ${k.fragen}).</p>`}
        <p class="hf-hinweis">Aus deinen eigenen früheren Fragen: Uhrzeit, Werktag und was oft direkt danach kam. Die Trefferquote ist an echten Fragen nachgerechnet.</p>
      </div>
      <div class="hf-karte"><h3>🧬 Selbstlernen</h3>
        ${s.wege.length ? `<div class="ck-a-tab ck-dk-wege">${s.wege.map((w) => `<div><span>${esc(w.name)}</span><span>${w.gesamt}×</span><span class="klein">👍 ${w.gut} · 👎 ${w.schlecht}${w.quote != null ? ` · ${w.quote} %` : ""}</span></div>`).join("")}</div>` : '<p class="klein">Noch keine Antworten gezählt.</p>'}
        ${q.maengel.length ? `<p class="klein">Häufigste Mängel: ${q.maengel.slice(0, 4).map((m) => `${esc(m.name)} (${m.anzahl})`).join(" · ")}</p>` : ""}
        <div class="hf-reihe"><button class="hf-btn" id="ck-dk-gut">👍 Letzte Antwort war gut</button><button class="hf-btn" id="ck-dk-schlecht">👎 Letzte Antwort war schlecht</button></div>
        <p class="hf-hinweis">Per Stimme: „Friday, das war gut“ oder „das stimmt nicht“. Wer gleich nochmal dasselbe fragt, zählt auch als 👎.</p>
        <h3>🕳️ Wissenslücken</h3>
        ${s.luecken.length ? `<ul class="hf-liste">${s.luecken.slice(0, 12).map((x) => `<li class="hf-zeile"><span class="name">${x.status === "recherchiert" ? "✅" : x.status === "offen" ? "🕳️" : "➖"} <b>${esc(x.thema)}</b> <span class="klein">„${esc(x.frage)}“</span>${x.ergebnis ? `<br><span class="klein">${esc(x.ergebnis.slice(0, 220))}${x.ergebnis.length > 220 ? " …" : ""}</span>` : ""}</span>${x.status === "offen" ? `<button class="hf-btn leise" data-ck-lr="${esc(x.id)}">Jetzt recherchieren</button>` : ""}<button class="hf-btn leise" data-ck-lw="${esc(x.id)}" title="Entfernen">✕</button></li>`).join("")}</ul>` : '<p class="klein">Keine Lücken. Wenn Friday etwas nicht weiß, landet es hier.</p>'}
        <h3>🧯 Fehlergedächtnis</h3>
        ${s.fehler.length ? `<ul class="hf-liste">${s.fehler.slice(0, 8).map((x) => `<li class="hf-zeile"><span class="name">„${esc(x.frage)}“<br><span class="klein">Antwort war: ${esc(x.antwort.slice(0, 160))}</span></span><span class="klein">${zeit(x.at)}</span><button class="hf-btn leise" data-ck-fw="${esc(x.id)}" title="Vergessen">✕</button></li>`).join("")}</ul><p class="hf-hinweis">Kommt eine ähnliche Frage, bekommt Friday einen Warnhinweis und prüft genauer.</p>` : '<p class="klein">Noch nichts. Sag „das stimmt nicht“, wenn eine Antwort falsch war.</p>'}
      </div>
      <div class="hf-karte"><h3>⚖️ Entscheidungs-Matrix</h3>${matrixHtml()}</div>
      <div class="hf-karte"><h3>📈 Entscheidungslernen</h3>
        ${e.lernen.erkenntnisse.length ? `<ul class="hf-liste">${e.lernen.erkenntnisse.map((x) => `<li class="hf-zeile"><span class="name">💡 ${esc(x)}</span></li>`).join("")}</ul>` : `<p class="klein">${e.lernen.bilanz.gesamt ? `${e.lernen.bilanz.gesamt} Entscheidungen festgehalten, ${e.lernen.bilanz.bewertet} rückblickend bewertet. Ab ein paar Bewertungen zeige ich, was gut lief.` : "Noch keine Entscheidungen festgehalten."}</p>`}
        <p class="hf-hinweis">Bewerten kannst du Entscheidungen im Fenster Persönlich → Entscheidungen (1 bis 5 Sterne).</p>
      </div>
      <div class="hf-karte"><h3>🔭 Zukunftssimulator</h3>
        <div class="hf-reihe"><select class="hf-input" id="ck-dk-art"><option value="sparen">💶 Sparen / Anlegen</option><option value="ziel">🎯 Schaffe ich mein Ziel?</option><option value="gewohnheit">🔥 Halte ich meine Gewohnheit?</option></select></div>
        <div class="hf-reihe" id="ck-dk-sparen"><label class="klein">Monatlich € <input class="hf-input ck-dk-z" id="ck-dk-m" type="number" value="100" min="0"></label><label class="klein">Jahre <input class="hf-input ck-dk-z" id="ck-dk-j" type="number" value="10" min="1" max="50"></label><label class="klein">Rendite % <input class="hf-input ck-dk-z" id="ck-dk-r" type="number" value="5" step="0.5"></label><label class="klein">Schwankung % <input class="hf-input ck-dk-z" id="ck-dk-s" type="number" value="15" min="0"></label></div>
        <button class="hf-btn haupt" id="ck-dk-sim">2000-mal durchrechnen</button>
        ${simErgebnis ? `<p class="hf-ergebnis">${simErgebnis.error ? `⚠️ ${esc(simErgebnis.error)}` : esc(simErgebnis.satz)}</p>${simErgebnis.p10 != null ? balken(simErgebnis) : ""}` : ""}
        <p class="hf-hinweis">Rechnet lokal auf deinem Mac mit echten Zahlen aus deinen Zielen und Gewohnheiten. Beim Sparen ist es eine Rechnung, keine Anlageberatung.</p>
      </div>
      <div class="hf-karte"><h3>🗣️ Agenten-Diskussion</h3>
        <div class="hf-reihe"><input class="hf-input grow" id="ck-dk-df" value="${esc(diskFrage)}" placeholder="Worüber? z. B. Soll ich mir ein E-Auto kaufen?" maxlength="600"><label class="klein"><input type="checkbox" id="ck-dk-ki"> mit bezahlter KI</label><button class="hf-btn haupt" id="ck-dk-dlos">Diskutieren lassen</button></div>
        ${diskErgebnis ? diskHtml(diskErgebnis) : e.diskussionen.length ? `<p class="klein">Zuletzt: ${e.diskussionen.slice(0, 3).map((d) => `„${esc(d.frage)}“`).join(", ")}</p>` : ""}
        <p class="hf-hinweis">Chancen-Agentin, Risiko-Agent und Praxis-Agent reden in 2 Runden, dann fasst Friday zusammen. Kostenlos mit Ollama. Bezahlte KI nur, wenn du das Häkchen setzt (Kosten-Deckel gilt).</p>
      </div>`;
    binde(el);
  }

  function matrixHtml() {
    const m = matrix;
    const opt = m.optionen;
    const kopf = `<div class="ck-dk-m-zeile kopf"><span>Kriterium · Gewicht</span>${opt.map((o, i) => `<span><input class="hf-input" data-mo="${i}" value="${esc(o)}" placeholder="Möglichkeit ${i + 1}" maxlength="60"></span>`).join("")}</div>`;
    const zeilen = m.kriterien.map((k, ki) => `<div class="ck-dk-m-zeile"><span><input class="hf-input" data-mk="${ki}" value="${esc(k.name)}" maxlength="60"><select class="hf-input" data-mg="${ki}">${[1, 2, 3, 4, 5].map((g) => `<option ${g === Number(k.gewicht) ? "selected" : ""}>${g}</option>`).join("")}</select></span>${opt.map((o, oi) => `<span><input class="hf-input" type="number" min="1" max="10" data-mw="${oi}:${ki}" value="${esc(m.werte?.[oi]?.[ki] ?? 5)}"></span>`).join("")}</div>`).join("");
    const r = matrixErgebnis;
    return `<input class="hf-input grow" id="ck-dk-mf" value="${esc(m.frage)}" placeholder="Worum geht es? z. B. Welche Wohnung nehme ich?" maxlength="300">
      <div class="ck-dk-m" style="--sp:${opt.length}">${kopf}${zeilen}</div>
      <div class="hf-reihe"><button class="hf-btn leise" id="ck-dk-mo">＋ Möglichkeit</button><button class="hf-btn leise" id="ck-dk-mk">＋ Kriterium</button><button class="hf-btn haupt" id="ck-dk-mr">Auswerten</button>${r && !r.error ? '<button class="hf-btn" id="ck-dk-ms">Als Entscheidung festhalten</button>' : ""}</div>
      ${r ? r.error ? `<p class="hf-ergebnis">⚠️ ${esc(r.error)}</p>` : `<div class="ck-dk-rang">${r.rangliste.map((x, i) => `<div><span>${i === 0 ? "🏆 " : ""}${esc(x.option)}</span><span class="ck-dk-bar"><i style="width:${x.punkte}%"></i></span><b>${x.punkte}</b></div>`).join("")}</div><p class="hf-ergebnis">${r.robust ? "✅" : "⚠️"} ${esc(r.satz)}</p>` : ""}
      <p class="hf-hinweis">Gewicht 1 = unwichtig, 5 = sehr wichtig. Noten 1 bis 10. Rechnet lokal, ohne KI.</p>`;
  }

  function balken(r) {
    const max = r.p90 || 1;
    const z = (n, w) => `<div><span>${n}</span><span class="ck-dk-bar"><i style="width:${Math.max(2, Math.round((w / max) * 100))}%"></i></span><b>${Math.round(w).toLocaleString("de-DE")} €</b></div>`;
    return `<div class="ck-dk-rang">${z("Eingezahlt", r.eingezahlt)}${z("Schlechter Fall", r.p10)}${z("Mitte", r.p50)}${z("Guter Fall", r.p90)}</div>`;
  }
  function diskHtml(d) {
    if (d.error) return `<p class="hf-ergebnis">⚠️ ${esc(d.error)}</p>`;
    return `<div class="ck-dk-disk">${d.verlauf.map((b) => `<div><b>${esc(b.emoji)} ${esc(b.name)}</b> <span class="klein">Runde ${b.runde}</span><p>${esc(b.text)}</p></div>`).join("")}</div>
      <p class="hf-ergebnis">🧠 ${esc(d.ergebnis)}</p><p class="klein">${esc(d.ki)} · ${Math.round(d.dauer_ms / 1000)} s</p>`;
  }

  function leseMatrix(el) {
    const m = matrix;
    m.frage = el.querySelector("#ck-dk-mf")?.value || "";
    el.querySelectorAll("[data-mo]").forEach((x) => { m.optionen[Number(x.dataset.mo)] = x.value; });
    el.querySelectorAll("[data-mk]").forEach((x) => { m.kriterien[Number(x.dataset.mk)].name = x.value; });
    el.querySelectorAll("[data-mg]").forEach((x) => { m.kriterien[Number(x.dataset.mg)].gewicht = Number(x.value); });
    el.querySelectorAll("[data-mw]").forEach((x) => { const [o, k] = x.dataset.mw.split(":").map(Number); (m.werte[o] ||= {})[k] = Number(x.value); });
    merke(m);
    // Für den Server: Werte nach Namen
    const werte = {};
    m.optionen.forEach((o, oi) => { werte[o] = {}; m.kriterien.forEach((k, ki) => { werte[o][k.name] = m.werte?.[oi]?.[ki] ?? 5; }); });
    return { frage: m.frage, optionen: m.optionen, kriterien: m.kriterien, werte };
  }

  function binde(el) {
    const knopf = (sel, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener("click", async () => {
      x.disabled = true;
      let text = "";
      try { const r = await fn(x); text = r?.text || (r?.error ? r.error : ""); } catch (err) { text = err.message; }
      denken(el, text);
    }));
    knopf("#ck-dk-gut", async () => { const r = await json("/api/selbstlernen/rueckmeldung", { body: { gut: true } }); return { text: r.error || "Danke, gemerkt." }; });
    knopf("#ck-dk-schlecht", async () => { const r = await json("/api/selbstlernen/rueckmeldung", { body: { gut: false } }); return { text: r.error || `Gemerkt: „${r.frage}“ kommt ins Fehlergedächtnis.` }; });
    knopf("[data-ck-lr]", async (x) => { const r = await json(`/api/selbstlernen/luecke/${encodeURIComponent(x.dataset.ckLr)}/recherche`, { body: {} }); return { text: r.error || (r.ok ? "Recherchiert und gemerkt." : "Dazu habe ich nichts gefunden.") }; });
    knopf("[data-ck-lw]", (x) => json(`/api/selbstlernen/luecke/${encodeURIComponent(x.dataset.ckLw)}`, { method: "DELETE" }));
    knopf("[data-ck-fw]", (x) => json(`/api/selbstlernen/fehler/${encodeURIComponent(x.dataset.ckFw)}`, { method: "DELETE" }));
    el.querySelectorAll("[data-ck-frag]").forEach((x) => x.addEventListener("click", () => { window.Friday?.send?.(x.dataset.ckFrag); }));
    knopf("#ck-dk-mo", async () => { leseMatrix(el); if (matrix.optionen.length < 6) matrix.optionen.push(""); merke(matrix); return {}; });
    knopf("#ck-dk-mk", async () => { leseMatrix(el); if (matrix.kriterien.length < 10) matrix.kriterien.push({ name: "", gewicht: 3 }); merke(matrix); return {}; });
    knopf("#ck-dk-mr", async () => { matrixErgebnis = await json("/api/entscheiden/matrix", { body: leseMatrix(el) }); return {}; });
    knopf("#ck-dk-ms", async () => { const r = await json("/api/entscheiden/matrix", { body: { ...leseMatrix(el), speichern: true } }); return { text: r.error || `Festgehalten: ${r.entscheidung.entscheidung}. Bewerte sie später, dann lerne ich mit.` }; });
    knopf("#ck-dk-sim", async () => {
      const art = el.querySelector("#ck-dk-art").value;
      const n = (id) => Number(el.querySelector(id)?.value);
      simErgebnis = await json("/api/entscheiden/simulation", { body: art === "sparen" ? { art, monatlich: n("#ck-dk-m"), jahre: n("#ck-dk-j"), rendite: n("#ck-dk-r"), schwankung: n("#ck-dk-s") } : { art } });
      return {};
    });
    knopf("#ck-dk-dlos", async (x) => {
      x.textContent = "Die Agenten diskutieren … (bis zu 2 Min.)";
      const frage = el.querySelector("#ck-dk-df").value;
      diskFrage = frage;
      diskErgebnis = await json("/api/entscheiden/diskussion", { body: { frage, mitKi: el.querySelector("#ck-dk-ki").checked } });
      return {};
    });
    const art = el.querySelector("#ck-dk-art");
    const sp = el.querySelector("#ck-dk-sparen");
    if (art && sp) { if (simErgebnis?.art) art.value = simErgebnis.art; const f = () => { sp.style.display = art.value === "sparen" ? "" : "none"; }; art.addEventListener("change", f); f(); }
  }

  const css = document.createElement("style");
  css.textContent = `
.ck-dk-m { display: grid; gap: 4px; margin: 8px 0; overflow-x: auto; }
.ck-dk-m-zeile { display: grid; grid-template-columns: minmax(170px, 1.4fr) repeat(var(--sp), minmax(78px, 1fr)); gap: 6px; align-items: center; }
.ck-dk-m-zeile > span:first-child { display: flex; gap: 4px; }
.ck-dk-m-zeile.kopf > span:first-child { font-size: 12px; opacity: .8; }
.ck-dk-m-zeile .hf-input { width: 100%; min-width: 0; padding: 6px 8px; }
.ck-dk-m-zeile select.hf-input { width: 52px; flex: none; }
.ck-dk-rang { display: grid; gap: 4px; margin: 8px 0; font-size: 13px; }
.ck-dk-rang > div { display: grid; grid-template-columns: minmax(90px, 1fr) 2fr 90px; gap: 8px; align-items: center; }
.ck-dk-rang b { text-align: right; }
.ck-dk-bar { height: 8px; border-radius: 4px; background: rgba(255,255,255,.08); overflow: hidden; }
.ck-dk-bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--cyan), #ffd08a); }
.ck-dk-z { width: 90px; }
.ck-dk-disk { display: grid; gap: 8px; margin: 8px 0; }
.ck-dk-disk > div { border-left: 2px solid var(--cyan); padding: 2px 0 2px 10px; }
.ck-dk-disk p { margin: 3px 0 0; font-size: 13px; }
.ck-dk-wege > div { grid-template-columns: 1fr 60px 170px; }
@media (max-width: 900px) { .ck-dk-m-zeile { grid-template-columns: minmax(118px, 1.3fr) repeat(var(--sp), minmax(58px, 1fr)); gap: 4px; } .ck-dk-m-zeile select.hf-input { width: 44px; padding: 6px 2px; } .ck-dk-rang > div { grid-template-columns: 80px 1fr 70px; } .ck-dk-wege > div span:last-child { display: inline; } .ck-dk-wege > div { grid-template-columns: 1fr 50px; } }`;
  document.head.appendChild(css);

  C.reiter("denken", "🧠 Denken", (el) => denken(el));
})();
