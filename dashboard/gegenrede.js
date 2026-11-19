// F.R.Ai.D.A.Y Perspektiv-Wechsler – Advocatus Diaboli (v1.106.0)
// Text, Artikel oder eigenen Entwurf einfügen (oder per Lesezeichen schicken) → die stärksten Einwände
// aus Sicht von Kritiker, Jurist und Skeptiker. Grundprüfung ohne Claude, „Mit KI vertiefen“ braucht Guthaben.
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  let aktuell = null;

  const w = H.fenster({
    id: "gegen", titel: "⚖ Advocatus Diaboli",
    html: `
      <div class="hf-karte">
        <label class="hf-feld">Text, Artikel, Behauptung oder dein Entwurf<textarea id="gr-text" style="min-height:140px" placeholder="Füg hier ein, was du gelesen oder geschrieben hast. Friday zerlegt es aus drei Blickwinkeln."></textarea></label>
        <div class="hf-reihe" style="margin-top:8px"><button id="gr-los" class="hf-btn haupt" type="button">😈 Gegenargumente finden</button><button id="gr-ki" class="hf-btn ki" type="button" disabled>🤖 Mit KI vertiefen</button><button id="gr-sprich" class="hf-mini" type="button" disabled>🔊 Vorlesen</button></div>
      </div>
      <div id="gr-status" class="hf-status">Sag auch: „Friday, widersprich mir: Homeoffice macht faul.“</div>
      <div id="gr-erg"></div>
      <div class="hf-lz">🔖 <b>Browser-Plugin (Lesezeichen):</b> In die Lesezeichen-Leiste ziehen. Auf einer Nachrichtenseite Text markieren, Lesezeichen tippen – Friday liefert die Gegenseite.<br><a id="gr-lz" href="#">⚖ Gegenrede mit Friday</a></div>
      <p class="hf-hinweis">Friday liest nichts heimlich mit, nur den Text, den du hier einfügst oder per Lesezeichen schickst. Die Hinweise des „Juristen“ sind keine Rechtsberatung.</p>`,
    onOpen: (opts) => { if (opts?.id) laden(opts.id); else setTimeout(() => !aktuell && $("#gr-text").focus({ preventScroll: true }), 80); },
  });
  const $ = (s) => w.$(s);
  const status = (t, f = false) => { const s = $("#gr-status"); s.textContent = t; s.classList.toggle("fehler", f); };
  $("#gr-lz").href = H.lesezeichen("gegen");
  $("#gr-lz").addEventListener("click", (e) => { e.preventDefault(); status("Zieh den Knopf in die Lesezeichen-Leiste (nicht anklicken)."); });

  async function laden(id) {
    try { aktuell = await json(`/api/gegenrede/${encodeURIComponent(id)}`); $("#gr-text").value = aktuell.text; zeige(); } catch (err) { status(err.message, true); }
  }
  async function pruefen(titel = "") {
    const text = $("#gr-text").value.trim();
    if (!text) { status("Erst einen Text einfügen.", true); return; }
    try { aktuell = await json("/api/gegenrede", { body: { text, titel } }); zeige(); status(""); } catch (err) { status(err.message, true); }
  }
  $("#gr-los").addEventListener("click", () => pruefen());
  $("#gr-sprich").addEventListener("click", () => aktuell && window.Friday?.say?.(aktuell.sprech));
  $("#gr-ki").addEventListener("click", async () => {
    if (!aktuell) return;
    const b = $("#gr-ki"); b.disabled = true; status("Claude sucht die stärksten Gegenargumente …");
    try { aktuell = await json(`/api/gegenrede/${encodeURIComponent(aktuell.id)}/ki`, { body: {} }); zeige(); status(""); }
    catch (err) { status(err.status === 402 ? "Fridays Guthaben ist leer – die KI-Vertiefung braucht Claude. Die Grundprüfung oben läuft ohne." : err.message, true); }
    finally { b.disabled = false; }
  });

  function zeige() {
    const e = aktuell;
    $("#gr-ki").disabled = false; $("#gr-sprich").disabled = false;
    const rollen = ["kritiker", "skeptiker", "jurist"].map((k) => ({ k, ...e.rollen[k] }));
    const ki = e.ki || {};
    $("#gr-erg").innerHTML = `
      <div class="hf-karte"><h3>Angreifbarkeit</h3><div class="hf-reihe"><b style="font-size:26px;color:var(--cyan)">${e.angreifbar} %</b><div class="hf-balken grow"><i style="width:${e.angreifbar}%"></i></div></div>
        ${e.these ? `<p class="hf-zitat">Kernthese: „${esc(e.these)}“</p>` : ""}
        <p class="hf-hinweis">${e.hatQuelle ? "✓ Quellen genannt" : "✗ Keine Quellen"} · ${e.gegenseite ? "✓ Gegenseite erwähnt" : "✗ Nur eine Seite"} · ${e.saetze} Sätze</p>
        ${ki.staerkste ? `<p style="margin:8px 0 0"><b>😈 Stärkstes Gegenargument:</b> ${esc(ki.staerkste)}</p>` : ""}</div>
      <div class="hf-raster" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${rollen.map((r) => `
        <div class="hf-karte"><h3>${esc(r.icon)} ${esc(r.name)} <span class="hf-hinweis" style="text-transform:none;letter-spacing:0">– ${esc(r.leitfrage)}</span></h3>
          ${(ki[r.k] || []).length ? `<ul class="hf-liste" style="margin-bottom:8px">${ki[r.k].map((x) => `<li class="hf-zeile"><span class="icon">🤖</span><span class="name">${esc(x)}</span></li>`).join("")}</ul>` : ""}
          ${r.funde.length ? `<ul class="hf-liste">${r.funde.map((f) => `<li class="hf-zeile" style="align-items:flex-start"><span class="name"><b>${esc(f.titel)}</b>${f.anzahl > 1 ? ` <span class="klein">(${f.anzahl}×)</span>` : ""}<br><span class="klein">${esc(f.frage)}</span>${f.zitat ? `<p class="hf-zitat">„${esc(f.zitat)}“</p>` : ""}</span></li>`).join("")}</ul>` : `<div class="hf-leer">Nichts Auffälliges.</div>`}
          ${r.gegen ? `<p class="hf-hinweis" style="margin:8px 0 0">💬 ${esc(r.gegen)}</p>` : ""}
        </div>`).join("")}</div>
      ${(ki.verbessern || []).length ? `<div class="hf-karte"><h3>✍ So wird dein Text stärker</h3><ul class="hf-hinweis" style="margin:0;padding-left:18px">${ki.verbessern.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${ki.frei ? `<div class="hf-karte hf-hinweis" style="white-space:pre-wrap">${esc(ki.frei)}</div>` : ""}`;
  }

  H.vonLesezeichen("gegen", (v) => { w.auf(); $("#gr-text").value = v.text || v.titel; pruefen(v.titel); });
  window.FridayGegen = { open: (opts) => w.auf(opts), offen: w.offen };
})();
