// F.R.Ai.D.A.Y Gehirn-Cockpit (v1.178.0, Mark XII Punkte 31–38): zentrale Steuerung des ganzen KI-Systems.
// Reiter: Übersicht · KI-Modelle (live, Schwarm, Labor, Kosten) · Agenten · Missionen · Gedächtnis ·
// Warnungen · System · Freigaben · Tests. Weitere Module hängen eigene Reiter an (FridayCockpit.reiter).
// Live: Ereignis-Strom vom Server (/api/ereignisse/strom), solange das Cockpit offen ist.
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;

  const REITER = [
    ["uebersicht", "◎ Übersicht"], ["ki", "🧠 KI-Modelle"], ["agenten", "🤖 Agenten"], ["missionen", "🎯 Missionen"],
    ["gedaechtnis", "💾 Gedächtnis"], ["warnungen", "⚠ Warnungen"], ["system", "📊 System"], ["freigaben", "🔐 Freigaben"], ["tests", "✅ Tests"],
  ];
  const extra = {}; // id -> fn(el) von anderen Modulen
  let tab = "uebersicht";
  let poll = null;
  const zeit = (iso) => { if (!iso) return "–"; try { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  const uhr = (iso) => { try { return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { return ""; } };
  const usd = (v) => `${(Number(v) || 0).toFixed(Number(v) < 0.1 && Number(v) > 0 ? 4 : 2).replace(".", ",")} $`;
  const ms = (v) => (v == null ? "–" : v >= 1000 ? `${(v / 1000).toFixed(1).replace(".", ",")} s` : `${v} ms`);
  const balken = (p, farbe = "") => `<span class="ck-balken"><i style="width:${Math.max(0, Math.min(100, Number(p) || 0))}%" class="${farbe}"></i></span>`;
  const STUFE = { fehler: ["hf-schlecht", "Fehler"], warnung: ["hf-warn", "Warnung"], hinweis: ["hf-info", "Hinweis"] };

  const w = H.fenster({
    id: "cockpit", titel: "◎ Gehirn-Cockpit", klasse: "ck-box",
    html: `
      <div id="ck-kopf" class="ck-kopf"></div>
      <div class="hf-tabs" role="tablist" id="ck-tabs"></div>
      <div id="ck-status" class="hf-status"></div>
      <div id="ck-seite"></div>
      <div class="ck-live"><b>LIVE</b><ul id="ck-strom"></ul></div>`,
    onOpen: (opt) => { if (opt?.tab) tab = opt.tab; tabsZeichnen(); laden(); stromAn(); },
  });
  const $ = w.$;
  const status = (t, fehler = false) => { const s = $("#ck-status"); s.textContent = t || ""; s.classList.toggle("fehler", fehler); };

  function tabsZeichnen() {
    const alle = [...REITER, ...Object.entries(extra).map(([id, e]) => [id, e.name])];
    $("#ck-tabs").innerHTML = alle.map(([id, n]) => `<button class="hf-tab${id === tab ? " an" : ""}" data-tab="${id}" role="tab">${n}</button>`).join("");
    w.$$("#ck-tabs .hf-tab").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; tabsZeichnen(); laden(); }));
  }

  // ---------- Kopf: die wichtigsten Zahlen immer sichtbar ----------
  async function kopf() {
    try {
      const u = await json("/api/cockpit");
      const wz = u.warnungen;
      $("#ck-kopf").innerHTML = `
        <div class="ck-kachel"><b>${u.ki.bereit.length}</b><span>KIs bereit</span><small class="${u.ki.live.length ? "hf-gut" : "hf-info"}">${u.ki.live.length ? `${u.ki.live.length} denkt gerade` : "ruht"}</small></div>
        <div class="ck-kachel"><b>${u.agenten ? `${u.agenten.arbeiten}/${u.agenten.aktiv}` : "–"}</b><span>Agenten arbeiten</span><small>${esc(u.agenten?.chefin || "")}</small></div>
        <div class="ck-kachel"><b>${u.missionen ? u.missionen.laufend + u.missionen.wartend : "–"}</b><span>Missionen offen</span><small>${u.missionen ? `${u.missionen.fertig} fertig` : ""}</small></div>
        <div class="ck-kachel"><b class="${wz.fehler ? "hf-schlecht" : wz.warnung ? "hf-warn" : "hf-gut"}">${wz.fehler + wz.warnung}</b><span>Fehler & Warnungen</span><small>${wz.hinweis} Hinweise</small></div>
        <div class="ck-kachel"><b>${u.tests?.quote != null ? `${u.tests.quote} %` : "–"}</b><span>Funktionen ok</span><small>${u.tests ? `${u.tests.bestanden} ✓ · ${u.tests.fehler} ✗ · ${u.tests.uebersprungen} –` : "noch nicht geprüft"}</small></div>
        <div class="ck-kachel"><b>${u.system.cpu.prozent ?? 0} %</b><span>Prozessor</span><small>RAM ${u.system.ram.prozent} %</small></div>
        <div class="ck-kachel"><b class="${u.freigaben.offen ? "hf-warn" : ""}">${u.freigaben.offen}</b><span>Freigaben offen</span><small class="${u.freigaben.notfall ? "hf-schlecht" : ""}">${u.freigaben.notfall ? "NOTFALL-STOPP" : esc(u.freigaben.autonomie || "")}</small></div>`;
      return u;
    } catch (err) { status(err.message, true); return null; }
  }

  async function laden() {
    clearTimeout(poll);
    if (!w.offen()) return;
    status("");
    const u = await kopf();
    const seite = $("#ck-seite");
    try {
      if (extra[tab]) await extra[tab].fn(seite, { json, esc, zeit, status });
      else if (tab === "uebersicht") uebersicht(seite, u);
      else if (tab === "ki") await ki(seite);
      else if (tab === "agenten") await agenten(seite);
      else if (tab === "missionen") await missionen(seite);
      else if (tab === "gedaechtnis") await gedaechtnis(seite);
      else if (tab === "warnungen") await warnungen(seite);
      else if (tab === "system") await system(seite);
      else if (tab === "freigaben") await freigaben(seite);
      else if (tab === "tests") await tests(seite);
    } catch (err) { status(err.message, true); }
    // sanft auffrischen (Formulare nicht zerstören: KI- und Test-Reiter nur auf Knopfdruck)
    if (["uebersicht", "agenten", "missionen", "system", "warnungen", "freigaben"].includes(tab)) poll = setTimeout(laden, tab === "system" ? 3000 : 8000);
  }

  // ---------- ◎ Übersicht (31) ----------
  function uebersicht(el, u) {
    if (!u) { el.innerHTML = ""; return; }
    const namen = { claude: "Claude", openai: "ChatGPT", gemini: "Gemini", deepseek: "DeepSeek", grok: "Grok", openrouter: "OpenRouter", ollama: "Ollama" };
    el.innerHTML = `
      <div class="hf-zwei">
        <div class="hf-karte"><h3>Denken</h3>
          <p class="klein">Reihenfolge bei Ausfall: ${u.ki.kette.map((id) => `<span class="hf-badge ${u.ki.bereit.includes(id) ? "hf-gut" : "hf-info"}">${esc(namen[id] || id)}</span>`).join(" → ")}</p>
          ${u.ki.live.length ? `<ul class="hf-liste">${u.ki.live.map((l) => `<li class="hf-zeile"><span class="ck-puls"></span><span class="name">${esc(namen[l.anbieter] || l.anbieter)} denkt · ${esc(l.modell || "")}</span><span class="klein">${ms(l.laeuft_ms)}</span></li>`).join("")}</ul>` : `<p class="hf-hinweis">Gerade denkt keine KI.</p>`}
          <p class="klein">Kosten-Deckel: <b>${usd(u.ki.kosten.deckel.heute)}</b> von ${usd(u.ki.kosten.deckel.grenze_tag)} heute · Stufe ${esc(u.ki.kosten.deckel.stufe)}</p>
          <p class="hf-hinweis">${esc(u.ki.kosten.regel)}</p>
        </div>
        <div class="hf-karte"><h3>Was gerade wichtig ist</h3>
          ${u.top_warnungen.length ? `<ul class="hf-liste">${u.top_warnungen.map((x) => `<li class="hf-zeile"><span class="hf-badge ${STUFE[x.stufe][0]}">${STUFE[x.stufe][1]}</span><span class="name">${esc(x.titel)}<br><span class="klein">${esc(x.quelle)}</span></span></li>`).join("")}</ul>` : `<p class="hf-gut">Keine Fehler und keine Warnungen.</p>`}
          <h3 style="margin-top:12px !important">Neu im Gedächtnis</h3>
          ${u.gedaechtnis?.neueste?.length ? `<ul class="hf-liste">${u.gedaechtnis.neueste.map((f) => `<li class="hf-zeile"><span class="name klein">${esc(f.text)}</span><span class="klein">${zeit(f.zeit)}</span></li>`).join("")}</ul>` : `<p class="hf-hinweis">Noch nichts gemerkt.</p>`}
        </div>
      </div>
      <p class="hf-hinweis">Ereignis-Bus: ${u.bus.gesendet} Ereignisse seit dem Start · ${u.bus.zuhoerer} Zuhörer · Version ${esc(u.version)}</p>`;
  }

  // ---------- 🧠 KI-Modelle (2, 21, 22, 28, 32) ----------
  async function ki(el) {
    const k = await json("/api/cockpit/ki");
    const reihe = k.reihenfolge;
    const karte = (g) => {
      const schwarm = Boolean(g.seite);
      const punkt = g.bereit ? "an" : g.eingerichtet ? "pause" : "aus";
      return `<div class="hf-karte ck-ki" data-id="${g.id}">
        <div class="hf-reihe"><span class="ck-punkt ${punkt}"></span><b>${esc(g.emoji || "")} ${esc(g.name)}</b><span class="grow"></span><span class="hf-badge ${g.bereit ? "hf-gut" : "hf-info"}">${g.bereit ? "bereit" : esc(g.grund || "aus")}</span></div>
        <p class="klein">${esc(g.art || "")} · Modell <b>${esc(g.modell || "–")}</b><br>${esc(g.kosten || "")}</p>
        <p class="klein">${g.anfragen || 0} Anfragen · ${g.fehler || 0} Fehler · Schnitt ${ms(g.schnitt_ms)}${g.letzte ? ` · zuletzt ${zeit(g.letzte)}` : ""}${schwarm ? ` · heute ${usd(g.heute_usd)} von ${usd(g.limit_tag)}` : ""}</p>
        ${g.letzter_fehler ? `<p class="klein hf-schlecht">Letzter Fehler (${zeit(g.fehler_am)}): ${esc(g.letzter_fehler)}</p>` : ""}
        ${schwarm ? `
          ${g.eingerichtet ? `
            <div class="hf-reihe">
              <label class="klein"><input type="checkbox" data-a="an" ${g.an ? "checked" : ""}> an</label>
              <label class="klein"><input type="checkbox" data-a="ersatz" ${g.ersatz ? "checked" : ""}> springt bei Ausfall ein</label>
              <label class="klein">Tageslimit <input class="hf-input ck-klein" data-a="limit" type="number" min="0" max="100" step="0.1" value="${g.limit_tag}"> $</label>
              <button class="hf-btn leise" data-a="hoch" title="In der Ersatz-Reihenfolge nach vorne">▲</button><button class="hf-btn leise" data-a="runter" title="Nach hinten">▼</button>
              <button class="hf-btn leise" data-a="vergessen">Schlüssel löschen</button>
            </div>` : `
            <div class="hf-reihe"><input class="hf-input grow" data-a="key" type="password" autocomplete="off" placeholder="API-Schlüssel einfügen (nie im Chat posten)"><button class="hf-btn haupt" data-a="einrichten">Prüfen & speichern</button></div>
            <p class="hf-hinweis">Schlüssel bekommst du hier: <a href="${esc(g.seite)}" target="_blank" rel="noopener">${esc(g.seite)}</a>. Er wird verschlüsselt auf dem Mac gespeichert. Kostet bei ${esc(g.name.split(" (")[0])} echtes Geld – Friday hält sich an das Tageslimit.</p>`}` : ""}
      </div>`;
    };
    const bereit = k.gehirne.filter((g) => g.bereit).map((g) => g.id);
    el.innerHTML = `
      <div class="hf-karte"><h3>Live</h3>
        ${k.live.length ? `<ul class="hf-liste">${k.live.map((l) => `<li class="hf-zeile"><span class="ck-puls"></span><span class="name">${esc(l.anbieter)} · ${esc(l.modell || "")} · ${esc(l.quelle || "")}</span><span class="klein">${ms(l.laeuft_ms)}</span></li>`).join("")}</ul>` : `<p class="hf-hinweis">Gerade denkt keine KI.</p>`}
        <p class="klein">Automatischer Wechsel bei Ausfall oder Nutzungslimit: ${k.kette.map((id) => `<b>${esc(id)}</b>`).join(" → ")}. Ein Dienst mit Limit-Meldung macht von selbst Pause.</p>
      </div>
      <div class="hf-raster">${k.gehirne.map(karte).join("")}</div>
      <div class="hf-zwei">
        <div class="hf-karte"><h3>🐝 Schwarm-Frage</h3>
          <p class="hf-hinweis">Dieselbe Frage an bis zu 3 KIs (lokal zuerst, dann die günstigsten). Friday vergleicht die Antworten und führt sie zusammen. Sprache: „Friday, frag den Schwarm: …“</p>
          <div class="hf-reihe"><input id="ck-sw-frage" class="hf-input grow" placeholder="Frage an den Schwarm"><button id="ck-sw-los" class="hf-btn haupt" ${bereit.length ? "" : "disabled"}>Fragen</button></div>
          <div id="ck-sw-erg"></div>
        </div>
        <div class="hf-karte"><h3>🧪 Performance-Labor</h3>
          <p class="hf-hinweis">5 Prüffragen mit nachprüfbarer Antwort (Rechnen, Wissen, Zählen, JSON, Anweisung). Gemessen werden Treffer, Tempo und Kosten – echte Anfragen an jede bereite KI (wenige Zehntel Cent).</p>
          <div class="hf-reihe">${bereit.map((id) => `<label class="klein"><input type="checkbox" class="ck-lab" value="${id}" checked> ${esc(id)}</label>`).join("") || `<span class="hf-hinweis">Keine KI bereit.</span>`}<span class="grow"></span><button id="ck-lab-los" class="hf-btn" ${bereit.length ? "" : "disabled"}>Vergleichen</button></div>
          <div id="ck-lab-erg">${laborTabelle(k.labor[0])}</div>
        </div>
      </div>
      <div class="hf-karte"><h3>💰 Kosten aller KI-Dienste</h3>
        <p class="klein">Claude-Guthaben: ${esc(k.kosten.claude.zustand)}${k.kosten.claude.rest != null ? ` · Rest ${usd(k.kosten.claude.rest)}` : ""} · Kosten-Deckel heute ${usd(k.kosten.deckel.heute)} von ${usd(k.kosten.deckel.grenze_tag)} (Stunde ${usd(k.kosten.deckel.grenze_stunde)}), Stufe <b>${esc(k.kosten.deckel.stufe)}</b></p>
        ${k.kosten.schwarm_tage.length ? `<ul class="hf-liste">${k.kosten.schwarm_tage.slice().reverse().map((t) => `<li class="hf-zeile"><span class="name klein">${esc(t.tag)}</span><span class="klein">${Object.entries(t).filter(([x]) => x !== "tag").map(([x, v]) => `${esc(x)} ${usd(v)}`).join(" · ")}</span></li>`).join("")}</ul>` : `<p class="hf-hinweis">Noch keine Kosten bei ChatGPT, Gemini, DeepSeek oder Grok.</p>`}
        <p class="hf-hinweis">${esc(k.kosten.regel)}</p>
      </div>`;
    // Ereignisse
    w.$$(".ck-ki").forEach((c) => {
      const id = c.dataset.id;
      const q = (a) => c.querySelector(`[data-a="${a}"]`);
      q("einrichten")?.addEventListener("click", async (e) => {
        e.target.disabled = true; status("Friday prüft den Schlüssel beim Dienst …");
        try { const r = await json(`/api/cockpit/ki/${id}/einrichten`, { body: { key: q("key").value } }); status(`Eingerichtet. Modell: ${r.modell}`); ki(el); } catch (err) { status(err.message, true); e.target.disabled = false; }
      });
      const setze = async (body) => { try { await json(`/api/cockpit/ki/${id}/einstellen`, { body }); status("Gespeichert."); ki(el); } catch (err) { status(err.message, true); } };
      q("an")?.addEventListener("change", (e) => setze({ an: e.target.checked }));
      q("ersatz")?.addEventListener("change", (e) => setze({ ersatz: e.target.checked }));
      q("limit")?.addEventListener("change", (e) => setze({ limit_tag: Number(e.target.value) }));
      q("vergessen")?.addEventListener("click", async () => { await json(`/api/cockpit/ki/${id}/vergessen`, { body: {} }); ki(el); });
      const schiebe = async (d) => {
        const r = reihe.slice(); const i = r.indexOf(id); const j = i + d;
        if (i < 0 || j < 0 || j >= r.length) return;
        [r[i], r[j]] = [r[j], r[i]];
        await json("/api/cockpit/ki/reihenfolge", { body: { reihenfolge: r } }); ki(el);
      };
      q("hoch")?.addEventListener("click", () => schiebe(-1));
      q("runter")?.addEventListener("click", () => schiebe(1));
    });
    $("#ck-sw-los")?.addEventListener("click", async (e) => {
      const frage = $("#ck-sw-frage").value.trim();
      if (!frage) return;
      e.target.disabled = true; $("#ck-sw-erg").innerHTML = `<p class="hf-hinweis">Der Schwarm denkt …</p>`;
      try {
        const r = await json("/api/cockpit/schwarm", { body: { frage } });
        $("#ck-sw-erg").innerHTML = `<p><b>${esc(r.antwort || "Keine Antwort.")}</b></p><p class="klein">${esc(r.von || "")}${r.einigkeit != null ? ` · Einigkeit ${r.einigkeit} %` : ""}</p>
          <ul class="hf-liste">${r.antworten.map((a) => `<li class="hf-zeile"><span class="hf-badge ${a.ok ? "hf-gut" : "hf-schlecht"}">${esc(a.id)}</span><span class="name klein">${esc(a.ok ? a.text : a.fehler)}</span><span class="klein">${ms(a.ms)}${a.uebereinstimmung != null ? ` · ${a.uebereinstimmung} %` : ""}</span></li>`).join("")}</ul>`;
      } catch (err) { $("#ck-sw-erg").innerHTML = `<p class="hf-schlecht">${esc(err.message)}</p>`; }
      e.target.disabled = false;
    });
    $("#ck-lab-los")?.addEventListener("click", async (e) => {
      const dienste = w.$$(".ck-lab").filter((x) => x.checked).map((x) => x.value);
      e.target.disabled = true; $("#ck-lab-erg").innerHTML = `<p class="hf-hinweis">Prüffragen laufen …</p>`;
      try { $("#ck-lab-erg").innerHTML = laborTabelle(await json("/api/cockpit/labor", { body: { dienste } })); } catch (err) { $("#ck-lab-erg").innerHTML = `<p class="hf-schlecht">${esc(err.message)}</p>`; }
      e.target.disabled = false;
    });
  }
  function laborTabelle(lauf) {
    if (!lauf) return `<p class="hf-hinweis">Noch kein Vergleich gelaufen.</p>`;
    return `<p class="klein">Lauf vom ${zeit(lauf.zeit)}</p><table class="ck-tab"><tr><th>#</th><th>KI</th><th>Treffer</th><th>Tempo</th><th>Kosten</th></tr>
      ${lauf.ergebnisse.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.id)}</td><td>${e.richtig}/${e.von} ${balken(e.qualitaet, e.qualitaet >= 80 ? "gut" : e.qualitaet >= 50 ? "warn" : "schlecht")}</td><td>${ms(e.schnitt_ms)}</td><td>${usd(e.usd)}</td></tr>`).join("")}</table>`;
  }

  // ---------- 🤖 Agenten-Live-Monitor (33) ----------
  async function agenten(el) {
    const a = await json("/api/agents");
    const extraInfo = window.FridayCockpit?.agentenExtra ? await window.FridayCockpit.agentenExtra().catch(() => "") : "";
    el.innerHTML = `${extraInfo}
      <div class="hf-karte"><h3>Friday (Leitung)</h3><p>${a.chefin?.arbeitet ? `<span class="ck-puls"></span> ` : ""}${esc(a.chefin?.jetzt || "")}${a.chefin?.prozent ? ` · ${a.chefin.prozent} %` : ""}</p></div>
      <div class="hf-raster">${a.agents.map((x) => `<div class="hf-karte"><div class="hf-reihe"><span class="ck-punkt ${x.arbeitet ? "an" : x.status === "aktiv" ? "bereit" : "aus"}"></span><b>${esc(x.emoji || "")} ${esc(x.name)}</b></div>
        <p class="klein">${x.arbeitet ? `<b>arbeitet:</b> ${esc(x.jetzt || x.taetigkeit || "…")}${x.prozent ? ` ${balken(x.prozent)}` : ""}` : esc(x.statusText || x.status || "")}</p>
        ${x.letzterEinsatz || x.einsatz?.zeit ? `<p class="klein">Letzter Einsatz: ${zeit(x.letzterEinsatz?.zeit || x.einsatz?.zeit)}</p>` : ""}</div>`).join("")}</div>
      <p class="hf-hinweis">${a.aktiv} von ${a.gesamt} Agenten aktiv, ${a.arbeiten} arbeiten gerade. Losschicken im Agenten-Team (3D-Büro) oder per Sprache.</p>`;
  }

  // ---------- 🎯 Missionsübersicht (34) ----------
  async function missionen(el) {
    const m = await json("/api/zentrale/missionen");
    const liste = m.missionen || [];
    const gruppe = (titel, l) => `<div class="hf-karte"><h3>${titel} (${l.length})</h3>${l.length ? `<ul class="hf-liste">${l.slice(0, 15).map((x) => {
      const fertig = (x.schritte || []).filter((s) => s.status === "fertig").length, alle = (x.schritte || []).length;
      return `<li class="hf-zeile"><span class="name"><b>${esc(x.titel)}</b><br><span class="klein">${esc(x.status)} · ${fertig}/${alle} Schritte · ${zeit(x.erstellt)}${x.wiederholen ? ` · 🔁 ${esc(x.wiederholen)}` : ""}</span></span>${alle ? balken(Math.round((fertig / alle) * 100)) : ""}</li>`;
    }).join("")}</ul>` : `<p class="hf-hinweis">Keine.</p>`}</div>`;
    el.innerHTML = `<div class="hf-zwei">${gruppe("Laufend & wartend", liste.filter((x) => ["laeuft", "wartet", "pausiert", "freigabe"].includes(x.status)))}${gruppe("Abgeschlossen", liste.filter((x) => !["laeuft", "wartet", "pausiert", "freigabe"].includes(x.status)))}</div>
      <p class="hf-hinweis">Neue Mission: „Friday, starte eine Mission: …“ oder in der Modul-Zentrale → Missionen.</p>`;
  }

  // ---------- 💾 Gedächtnis-Monitor (35) ----------
  async function gedaechtnis(el) {
    if (window.FridayCockpit?.gedaechtnisSeite) return window.FridayCockpit.gedaechtnisSeite(el, { json, esc, zeit });
    const g = await json("/api/kern/gedaechtnis").catch(() => null);
    const fakten = g?.fakten || [];
    el.innerHTML = `<div class="hf-karte"><h3>Zuletzt gemerkt</h3>${fakten.length ? `<ul class="hf-liste">${fakten.slice(0, 30).map((f) => `<li class="hf-zeile"><span class="name">${esc(f.text)}</span><span class="klein">${zeit(f.created)}</span></li>`).join("")}</ul>` : `<p class="hf-hinweis">Noch nichts gemerkt.</p>`}</div>`;
  }

  // ---------- ⚠ Fehler- und Warnungszentrale (36) ----------
  async function warnungen(el) {
    const d = await json("/api/cockpit/warnungen");
    el.innerHTML = `<div class="hf-reihe"><span class="hf-badge hf-schlecht">${d.zaehl.fehler} Fehler</span><span class="hf-badge hf-warn">${d.zaehl.warnung} Warnungen</span><span class="hf-badge hf-info">${d.zaehl.hinweis} Hinweise</span><span class="grow"></span>${d.warnungen.length ? `<button class="hf-btn leise" id="ck-w-alle">Alle als gesehen markieren</button>` : ""}</div>
      ${d.warnungen.length ? `<ul class="hf-liste">${d.warnungen.map((x) => `<li class="hf-zeile"><span class="hf-badge ${STUFE[x.stufe][0]}">${STUFE[x.stufe][1]}</span><span class="name"><b>${esc(x.titel)}</b>${x.anzahl > 1 ? ` <span class="klein">(${x.anzahl}×)</span>` : ""}<br><span class="klein">${esc(x.quelle)}${x.zeit ? ` · ${zeit(x.zeit)}` : ""}${x.text ? ` · ${esc(x.text)}` : ""}</span></span><button class="hf-btn leise" data-q="${esc(x.id)}" title="Als gesehen markieren">✓</button></li>`).join("")}</ul>` : `<div class="hf-karte"><p class="hf-gut">Alles ruhig – keine Fehler, keine Warnungen.</p></div>`}
      <p class="hf-hinweis">Quellen: Logbuch-Fehler der letzten 2 Tage, Funktionsprüfung, KI-Pausen, Kosten-Deckel, Guthaben, Notfall-Stopp, offene Freigaben, Festplatte und Arbeitsspeicher.</p>`;
    w.$$("[data-q]").forEach((b) => b.addEventListener("click", async () => { await json("/api/cockpit/warnungen/quittieren", { body: { id: b.dataset.q } }); warnungen(el); }));
    $("#ck-w-alle")?.addEventListener("click", async () => { await json("/api/cockpit/warnungen/quittieren", { body: { id: "*" } }); warnungen(el); });
  }

  // ---------- 📊 Systemmonitor (37) ----------
  async function system(el) {
    const s = await json("/api/cockpit/system");
    const kurve = (werte, key) => {
      const v = werte.map((x) => x[key] || 0);
      if (v.length < 2) return "";
      const pts = v.map((y, i) => `${(i / (v.length - 1)) * 200},${40 - (y / 100) * 38}`).join(" ");
      return `<svg viewBox="0 0 200 40" class="ck-kurve"><polyline points="${pts}"/></svg>`;
    };
    const n = s.netz || {};
    el.innerHTML = `<div class="hf-raster">
      <div class="hf-karte"><h3>Prozessor</h3><p><b>${s.cpu.prozent ?? 0} %</b> ${balken(s.cpu.prozent, s.cpu.prozent > 85 ? "schlecht" : "")}</p><p class="klein">${s.cpu.kerne} Kerne · Last ${s.cpu.last.join(" / ")}<br>${esc(s.cpu.modell)}</p>${kurve(s.verlauf, "cpu")}</div>
      <div class="hf-karte"><h3>Arbeitsspeicher</h3><p><b>${s.ram.prozent} %</b> ${balken(s.ram.prozent, s.ram.prozent > 90 ? "schlecht" : "")}</p><p class="klein">${s.ram.belegtGB} von ${s.ram.gesamtGB} GB · Friday selbst ${s.friday.ramMB} MB</p>${kurve(s.verlauf, "ram")}</div>
      <div class="hf-karte"><h3>Speicher</h3>${s.platte ? `<p><b>${s.platte.prozent} %</b> ${balken(s.platte.prozent, s.platte.prozent > 90 ? "schlecht" : "")}</p><p class="klein">${s.platte.freiGB} GB frei von ${s.platte.gesamtGB} GB · Fridays Daten ${s.friday.datenMB} MB</p>` : `<p class="hf-hinweis">nicht lesbar</p>`}</div>
      <div class="hf-karte"><h3>Netzwerk</h3><p><b>${n.rate ? `↓ ${n.rate.runter_kbs} kB/s · ↑ ${n.rate.hoch_kbs} kB/s` : "misst …"}</b></p><p class="klein">${(n.adressen || []).map((a) => `${esc(a.name)} ${esc(a.ip)}${a.tailscale ? " (Tailscale)" : ""}`).join("<br>") || "keine Adresse"}<br>Tailscale: ${n.tailscale ? "verbunden" : "nicht gefunden"} · Mac-Agent: ${n.macAgent ? "verbunden" : "aus"}</p></div>
      <div class="hf-karte"><h3>Rechner</h3><p class="klein">${esc(s.rechner.plattform)} ${esc(s.rechner.version)} (${esc(s.rechner.arch)})<br>läuft seit ${Math.round(s.rechner.laufzeit / 3600)} Std. · Friday seit ${Math.round(s.friday.laufzeit / 60)} Min. · Node ${esc(s.friday.node)}</p></div>
    </div>`;
  }

  // ---------- 🔐 Freigabe-Zentrale (29, 38) ----------
  async function freigaben(el) {
    const f = await json("/api/cockpit/freigaben");
    el.innerHTML = `
      ${f.notfall ? `<div class="hf-karte"><p class="hf-schlecht"><b>NOTFALL-STOPP ist an.</b> Friday führt keine Aktionen aus. Aufheben per Sprache: „Friday, Notfall aus“.</p></div>` : ""}
      <div class="hf-karte"><h3>Wartet auf dich (${f.offen.length})</h3>${f.offen.length ? `<ul class="hf-liste">${f.offen.map((g) => `<li class="hf-zeile"><span class="name"><b>${esc(g.titel || g.werkzeug)}</b><br><span class="klein">${esc(g.text || g.grund || "")} · ${zeit(g.zeit || g.erstellt)}</span></span><button class="hf-btn haupt" data-fg="${esc(g.id)}" data-ja="1">Freigeben</button><button class="hf-btn leise" data-fg="${esc(g.id)}" data-ja="0">Ablehnen</button></li>`).join("")}</ul>` : `<p class="hf-hinweis">Keine wichtige Aktion wartet.</p>`}</div>
      <div class="hf-zwei">
        <div class="hf-karte"><h3>Wie selbstständig darf Friday sein?</h3><ul class="hf-liste">${f.stufen.map((s) => `<li class="hf-zeile"><label class="name"><input type="radio" name="ck-auto" value="${s.stufe}" ${s.stufe === f.autonomie ? "checked" : ""}> <b>${esc(s.name)}</b><br><span class="klein">${esc(s.text)}</span></label></li>`).join("")}</ul></div>
        <div class="hf-karte"><h3>Immer nachfragen bei …</h3><ul class="hf-liste">${Object.entries(f.fragbar).map(([id, n]) => `<li class="hf-zeile"><label class="name"><input type="checkbox" data-if="${id}" ${f.immerFragen.includes(id) ? "checked" : ""}> ${esc(n)}</label></li>`).join("")}</ul>
          <p class="hf-hinweis">Feste Grenzen, die keine Einstellung aufhebt: kein echtes Geld bewegen, keine Überwachung anderer Menschen, nichts heimlich an andere schicken.</p></div>
      </div>
      <div class="hf-karte"><h3>Zuletzt entschieden</h3>${f.erledigt.length ? `<ul class="hf-liste">${f.erledigt.map((g) => `<li class="hf-zeile"><span class="hf-badge ${g.status === "abgelehnt" ? "hf-schlecht" : "hf-gut"}">${esc(g.status)}</span><span class="name klein">${esc(g.titel || g.werkzeug)}</span><span class="klein">${zeit(g.entschieden || g.zeit)}</span></li>`).join("")}</ul>` : `<p class="hf-hinweis">Noch nichts.</p>`}</div>`;
    w.$$("[data-fg]").forEach((b) => b.addEventListener("click", async () => { try { await json(`/api/cockpit/freigaben/${b.dataset.fg}`, { body: { ja: b.dataset.ja === "1" } }); freigaben(el); window.FridayGlocke?.refresh?.(); } catch (err) { status(err.message, true); } }));
    w.$$('input[name="ck-auto"]').forEach((r) => r.addEventListener("change", async () => { await json("/api/cockpit/autonomie", { body: { stufe: Number(r.value) } }); status("Autonomie gespeichert."); }));
    w.$$("[data-if]").forEach((c) => c.addEventListener("change", async () => { await json("/api/cockpit/immer-fragen", { body: { werkzeug: c.dataset.if, an: c.checked } }); status("Gespeichert."); }));
  }

  // ---------- ✅ Funktionsprüfung (30) ----------
  async function tests(el) {
    const t = await json("/api/cockpit/tests");
    const l = t.letzte;
    const zeichen = { bestanden: ["✓", "hf-gut"], fehler: ["✗", "hf-schlecht"], uebersprungen: ["–", "hf-info"] };
    el.innerHTML = `<div class="hf-reihe"><button class="hf-btn haupt" id="ck-t-los" ${t.laeuft ? "disabled" : ""}>Jetzt prüfen</button><label class="klein"><input type="checkbox" id="ck-t-ki"> Auch bezahlte KI-Dienste prüfen (wenige Zehntel Cent)</label><span class="grow"></span>${l ? `<span class="klein">Zuletzt: ${zeit(l.zeit)} (${esc(l.wie)}) · ${ms(l.dauer_ms)}</span>` : ""}</div>
      ${l ? `<div class="hf-reihe"><span class="hf-badge hf-gut">${l.bestanden} bestanden</span><span class="hf-badge hf-schlecht">${l.fehler} Fehler</span><span class="hf-badge hf-info">${l.uebersprungen} nicht prüfbar</span>${l.quote != null ? `<span class="klein">Erfolgsquote der echt geprüften: <b>${l.quote} %</b></span>` : ""}</div>
      <table class="ck-tab"><tr><th></th><th>Funktion</th><th>Bereich</th><th>Ergebnis</th><th>Art</th><th>Dauer</th></tr>${l.ergebnisse.map((e) => `<tr><td class="${zeichen[e.status][1]}">${zeichen[e.status][0]}</td><td>${esc(e.name)}</td><td class="klein">${esc(e.bereich)}</td><td class="klein">${esc(e.text)}</td><td class="klein">${esc(e.art)}</td><td class="klein">${ms(e.ms)}</td></tr>`).join("")}</table>` : `<p class="hf-hinweis">Noch keine Prüfung gelaufen.</p>`}
      <p class="hf-hinweis">Jede Prüfung ruft die echte Funktion auf. „Nicht prüfbar“ (kein Schlüssel, kein Mac, kostet Geld) zählt nie als bestanden. Nachts um 03:45 prüft Friday automatisch (ohne bezahlte KI).</p>
      ${t.verlauf.length > 1 ? `<div class="hf-karte"><h3>Verlauf</h3><ul class="hf-liste">${t.verlauf.slice(0, 10).map((v) => `<li class="hf-zeile"><span class="name klein">${zeit(v.zeit)} · ${esc(v.wie)}</span><span class="klein">${v.bestanden} ✓ · ${v.fehler} ✗ · ${v.uebersprungen} –</span></li>`).join("")}</ul></div>` : ""}`;
    $("#ck-t-los").addEventListener("click", async (e) => {
      e.target.disabled = true; status("Friday prüft alle Funktionen echt …");
      try { await json("/api/cockpit/tests", { body: { mitKi: $("#ck-t-ki").checked } }); status("Fertig."); } catch (err) { status(err.message, true); }
      tests(el); kopf();
    });
  }

  // ---------- Live-Strom (Ereignis-Bus) ----------
  let strom = null;
  const SYMBOL = { logbuch: "•", fehler: "✗", ki: "🧠", test: "✅", warnung: "⚠", agent: "🤖", mission: "🎯", gedaechtnis: "💾", freigabe: "🔐" };
  function stromText(e) {
    const d = e.daten || {};
    if (e.typ === "ki") return `${d.anbieter} ${d.art === "start" ? "denkt …" : d.art === "fertig" ? `fertig (${ms(d.ms)})` : `Fehler: ${d.fehler || ""}`}`;
    if (e.typ === "logbuch" || e.typ === "fehler") return d.titel || "";
    if (e.typ === "test") return `Funktionsprüfung: ${d.bestanden} ✓ ${d.fehler} ✗`;
    return d.titel || d.text || e.typ;
  }
  async function stromAn() {
    if (strom || !window.Friday?.api) return;
    const ctl = new AbortController();
    strom = ctl;
    try {
      const r = await window.Friday.api("/api/ereignisse/strom", { signal: ctl.signal, headers: { Accept: "text/event-stream" } });
      const leser = r.body.getReader();
      const dek = new TextDecoder();
      let puffer = "";
      for (;;) {
        const { value, done } = await leser.read();
        if (done) break;
        puffer += dek.decode(value, { stream: true });
        let i;
        while ((i = puffer.indexOf("\n\n")) >= 0) {
          const block = puffer.slice(0, i); puffer = puffer.slice(i + 2);
          const zeile = block.split("\n").find((z) => z.startsWith("data: "));
          if (!zeile) continue;
          try { zeigeEreignis(JSON.parse(zeile.slice(6))); } catch { /* kaputte Zeile */ }
        }
        if (!w.offen()) break;
      }
    } catch { /* Verbindung zu oder abgebrochen */ }
    try { ctl.abort(); } catch { /* egal */ }
    strom = null;
    if (w.offen()) setTimeout(stromAn, 4000);
  }
  function zeigeEreignis(e) {
    const ul = $("#ck-strom");
    if (!ul) return;
    const li = document.createElement("li");
    li.className = e.wichtig ? "wichtig" : "";
    li.innerHTML = `<span>${uhr(e.at)}</span> ${SYMBOL[e.typ] || "•"} ${esc(stromText(e)).slice(0, 160)}`;
    ul.prepend(li);
    while (ul.children.length > 30) ul.lastChild.remove();
    if (e.typ === "ki" && tab === "uebersicht") kopf();
  }
  new MutationObserver(() => { if (!w.offen() && strom) { try { strom.abort(); } catch { /* egal */ } } }).observe(w.sheet, { attributes: true, attributeFilter: ["class"] });

  // ---------- Stil ----------
  const css = document.createElement("style");
  css.textContent = `
.ck-box { width: min(1180px, 100%); }
.ck-kopf { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 8px; }
.ck-kachel { border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 12px; padding: 9px 11px; background: linear-gradient(180deg, rgba(255,140,30,.09), rgba(255,140,30,.02)); display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ck-kachel b { font-size: 22px; color: var(--text); text-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 45%, transparent); }
.ck-kachel span { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.ck-kachel small { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ck-balken { display: inline-block; width: 90px; height: 6px; border-radius: 4px; background: rgba(255,255,255,.08); vertical-align: middle; overflow: hidden; }
.ck-balken i { display: block; height: 100%; background: var(--cyan); box-shadow: 0 0 8px var(--cyan); }
.ck-balken i.gut { background: #45e38b; box-shadow: 0 0 8px #45e38b; } .ck-balken i.warn { background: #ffc44d; } .ck-balken i.schlecht { background: #ff5a4a; box-shadow: 0 0 8px #ff5a4a; }
.ck-punkt { width: 10px; height: 10px; border-radius: 50%; flex: none; background: #555; }
.ck-punkt.an { background: #45e38b; box-shadow: 0 0 10px #45e38b; } .ck-punkt.bereit { background: var(--cyan); } .ck-punkt.pause { background: #ffc44d; }
.ck-puls { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #45e38b; box-shadow: 0 0 10px #45e38b; animation: ck-puls 1s ease-in-out infinite; flex: none; }
@keyframes ck-puls { 50% { opacity: .3; transform: scale(.7); } }
.ck-tab { width: 100%; border-collapse: collapse; font-size: 13px; }
.ck-tab th { text-align: left; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); padding: 4px 6px; border-bottom: 1px solid var(--u-rand-soft, var(--line)); }
.ck-tab td { padding: 6px; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: top; }
.ck-klein { width: 70px !important; padding: 4px 6px !important; font-size: 13px !important; }
.ck-kurve { width: 100%; height: 40px; } .ck-kurve polyline { fill: none; stroke: var(--cyan); stroke-width: 1.5; filter: drop-shadow(0 0 3px var(--cyan)); }
.ck-live { border-top: 1px solid var(--u-rand-soft, var(--line)); padding-top: 8px; font-size: 12px; }
.ck-live b { font-size: 10px; letter-spacing: .14em; color: #45e38b; }
.ck-live ul { list-style: none; margin: 4px 0 0; padding: 0; max-height: 120px; overflow-y: auto; font-family: ui-monospace, Menlo, monospace; color: var(--muted); }
.ck-live li.wichtig { color: #ff8a7a; } .ck-live li span { opacity: .6; }
.klein { font-size: 12px; color: var(--muted); }
.ck-ki { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ck-ki p { margin: 0; overflow-wrap: anywhere; }
.ck-ki .hf-reihe { gap: 6px 10px; }
.ck-ki .hf-btn { padding: 6px 10px; font-size: 13px; }
.ck-ki .hf-input { font-size: 14px; padding: 7px 9px; }
.ck-ki .hf-btn.haupt { width: 100%; }
@media (max-width: 900px) { .ck-kopf { grid-template-columns: repeat(2, 1fr); } .ck-tab { font-size: 12px; } .ck-tab td:nth-child(5), .ck-tab th:nth-child(5) { display: none; } }`;
  document.head.appendChild(css);

  window.FridayCockpit = Object.assign(window.FridayCockpit || {}, {
    open: (opt = {}) => w.auf(opt),
    /** Andere Module: eigenen Reiter anhängen. fn(el, helfer) zeichnet ihn. */
    reiter(id, name, fn) { extra[id] = { name, fn }; if (w.offen()) tabsZeichnen(); },
  });
})();
