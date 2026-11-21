// F.R.Ai.D.A.Y Apple-Apps (v1.134.0, Idee aus OpenJarvis "Apple Notes, Contacts, Music, Health")
// Notizen, Kontakte und Musik laufen über den Mac-Agenten (AppleScript, alles bleibt auf dem Mac).
// Gesundheit: Verlauf aus dem iPhone-Kurzbefehl oder aus dem Health-Export (Health-App → Profil → Alle Gesundheitsdaten exportieren).
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  let tab = "notizen";
  let gesundheit = null;

  const w = H.fenster({
    id: "apple", titel: "🍏 Apple-Apps", klasse: "ap-box",
    html: `
      <div class="hf-tabs" role="tablist">
        <button class="hf-tab an" data-tab="notizen">📝 Notizen</button>
        <button class="hf-tab" data-tab="kontakte">👤 Kontakte</button>
        <button class="hf-tab" data-tab="musik">🎵 Musik</button>
        <button class="hf-tab" data-tab="gesundheit">❤️ Gesundheit</button>
      </div>
      <div id="ap-status" class="hf-status"></div>
      <section data-seite="notizen">
        <form id="ap-n-such" class="hf-reihe" autocomplete="off"><input id="ap-n-q" class="hf-input grow" type="search" placeholder="In Notizen suchen …" enterkeyhint="search" aria-label="Notizen durchsuchen"><button class="hf-btn" type="submit">🔎 Suchen</button></form>
        <div class="hf-zwei" style="margin-top:10px">
          <div id="ap-n-liste" class="hf-liste ap-scroll"></div>
          <div class="hf-karte"><h3 id="ap-n-titel">Neue Notiz</h3><div id="ap-n-text" class="ap-notiz hidden"></div>
            <form id="ap-n-neu" class="hf-feld"><input id="ap-n-neu-t" class="hf-input" placeholder="Titel"><textarea id="ap-n-neu-x" placeholder="Text"></textarea><button class="hf-btn haupt" type="submit">＋ In Notizen speichern</button></form></div>
        </div>
      </section>
      <section data-seite="kontakte" class="hidden">
        <form id="ap-k-such" class="hf-reihe" autocomplete="off"><input id="ap-k-q" class="hf-input grow" type="search" placeholder="Name suchen …" enterkeyhint="search" aria-label="Kontakt suchen"><button class="hf-btn" type="submit">🔎 Suchen</button></form>
        <div id="ap-k-liste" class="hf-liste" style="margin-top:10px"></div>
        <div class="hf-karte" style="margin-top:12px"><h3>🎂 Geburtstage in den nächsten 60 Tagen</h3><div id="ap-k-gb" class="hf-liste"></div></div>
      </section>
      <section data-seite="musik" class="hidden">
        <div class="hf-karte ap-player"><div id="ap-m-jetzt" class="ap-jetzt">–</div>
          <div class="hf-reihe"><button class="hf-btn" data-m="music_previous" aria-label="Zurück">⏮</button><button class="hf-btn haupt" data-m="music_play_pause" aria-label="Abspielen/Pause">⏯</button><button class="hf-btn" data-m="music_next" aria-label="Weiter">⏭</button><button class="hf-btn leise" data-m="zufall">🔀 Zufall</button></div></div>
        <form id="ap-m-such" class="hf-reihe" autocomplete="off" style="margin-top:10px"><input id="ap-m-q" class="hf-input grow" type="search" placeholder="Titel, Künstler oder Album aus deiner Mediathek …" aria-label="Musik suchen"><button class="hf-btn" type="submit">▶ Spielen</button></form>
        <div class="hf-karte" style="margin-top:12px"><h3>Playlists</h3><div id="ap-m-pl" class="ap-chips"></div></div>
      </section>
      <section data-seite="gesundheit" class="hidden">
        <div id="ap-g-kacheln" class="ap-kacheln"></div>
        <div class="hf-karte" style="margin-top:12px"><h3>Verlauf</h3>
          <div class="hf-tabs" id="ap-g-wahl" style="margin-bottom:8px"></div>
          <div id="ap-g-chart" class="ap-chart"></div></div>
        <div class="hf-karte" style="margin-top:12px"><h3>Daten vom iPhone holen</h3>
          <p class="hf-hinweis">Am einfachsten: In der Health-App aufs Profilbild → „Alle Gesundheitsdaten exportieren“ → die Datei <b>Export.zip</b> hier hochladen. Friday liest Schritte, Schlaf, Ruhepuls, Kalorien, Training, Stehstunden und Gewicht pro Tag. Alles bleibt auf deinem Mac.</p>
          <div class="hf-reihe"><label class="hf-btn haupt">⬆ Export.zip hochladen<input id="ap-g-datei" type="file" accept=".zip,.xml,application/zip,text/xml" hidden></label><span id="ap-g-imp" class="hf-hinweis"></span></div>
          <div class="hf-balken hidden" id="ap-g-balken" style="margin-top:8px"><i style="width:0%"></i></div>
          <p class="hf-hinweis">Für jeden Tag automatisch: Der Kurzbefehl „Friday Gesundheit“ (Anleitung 43) schickt jeden Abend die Werte. Neue Felder: weight, exerciseMinutes, standHours.</p></div>
      </section>`,
    onOpen: (opts) => zeigeTab(opts?.tab || tab, opts?.q),
  });
  const $ = (s) => w.$(s);
  const status = (t, f = false) => { const s = $("#ap-status"); s.textContent = t || ""; s.classList.toggle("fehler", f); };
  const datum = (iso) => (iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "");
  const zahl = (n, st = 0) => (n == null ? "–" : Number(n).toLocaleString("de-DE", { maximumFractionDigits: st }));

  function zeigeTab(t, q) {
    tab = t;
    w.$$(".hf-tab[data-tab]").forEach((b) => b.classList.toggle("an", b.dataset.tab === t));
    w.$$("[data-seite]").forEach((s) => s.classList.toggle("hidden", s.dataset.seite !== t));
    status("");
    if (t === "notizen") { if (q) $("#ap-n-q").value = q; notizen(q || $("#ap-n-q").value.trim()); }
    if (t === "kontakte") { if (q) { $("#ap-k-q").value = q; kontakte(q); } geburtstage(); }
    if (t === "musik") musik();
    if (t === "gesundheit") ladeGesundheit();
  }
  w.sheet.querySelector(".hf-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) zeigeTab(b.dataset.tab); });

  // ---------- Notizen ----------
  async function notizen(q = "") {
    $("#ap-n-liste").innerHTML = '<div class="hf-leer">Frage den Mac …</div>';
    try {
      const r = await json(`/api/apple/notizen${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      $("#ap-n-liste").innerHTML = r.notizen.length ? r.notizen.map((n) => `<button class="hf-zeile ap-z" data-notiz="${esc(n.id)}"><span class="name"><b>${esc(n.name)}</b><br><span class="klein">${datum(n.geaendert)}${n.text ? ` · ${esc(n.text.slice(0, 90))}` : ""}</span></span></button>`).join("") : `<div class="hf-leer">${q ? `Nichts zu „${esc(q)}“ gefunden.` : "Keine Notizen."}</div>`;
      if (!q && r.gesamt) status(`${r.gesamt} Notizen in deiner Notizen-App.`);
    } catch (err) { $("#ap-n-liste").innerHTML = ""; status(err.message, true); }
  }
  $("#ap-n-such").addEventListener("submit", (e) => { e.preventDefault(); notizen($("#ap-n-q").value.trim()); });
  $("#ap-n-liste").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-notiz]");
    if (!b) return;
    try {
      const r = await json(`/api/apple/notiz?id=${encodeURIComponent(b.dataset.notiz)}`);
      $("#ap-n-titel").textContent = r.name;
      $("#ap-n-text").textContent = r.text;
      $("#ap-n-text").classList.remove("hidden");
    } catch (err) { status(err.message, true); }
  });
  $("#ap-n-neu").addEventListener("submit", async (e) => {
    e.preventDefault();
    const titel = $("#ap-n-neu-t").value.trim(), text = $("#ap-n-neu-x").value.trim();
    if (!titel && !text) return;
    try { const r = await json("/api/apple/notiz", { body: { titel, text } }); status(`Gespeichert im Ordner ${r.ordner}.`); $("#ap-n-neu-t").value = ""; $("#ap-n-neu-x").value = ""; notizen(); } catch (err) { status(err.message, true); }
  });

  // ---------- Kontakte ----------
  async function kontakte(q) {
    if (!q) return;
    $("#ap-k-liste").innerHTML = '<div class="hf-leer">Suche …</div>';
    try {
      const r = await json(`/api/apple/kontakte?q=${encodeURIComponent(q)}`);
      $("#ap-k-liste").innerHTML = r.kontakte.length ? r.kontakte.map((k) => `<div class="hf-zeile"><span class="icon">👤</span><span class="name"><b>${esc(k.name)}</b>${k.firma ? ` <span class="klein">· ${esc(k.firma)}</span>` : ""}<br>
        ${k.telefon.map((t) => `<a class="ap-link" href="tel:${esc(t.replace(/[^\d+]/g, ""))}">📞 ${esc(t)}</a>`).join(" ")} ${k.email.map((m) => `<a class="ap-link" href="mailto:${esc(m)}">✉ ${esc(m)}</a>`).join(" ")}${k.geburtstag ? ` <span class="klein">🎂 ${esc(k.geburtstag.replace(/^1604-/, ""))}</span>` : ""}</span></div>`).join("") : `<div class="hf-leer">„${esc(q)}“ ist nicht in deinen Kontakten.</div>`;
    } catch (err) { $("#ap-k-liste").innerHTML = ""; status(err.message, true); }
  }
  async function geburtstage() {
    try {
      const r = await json("/api/apple/geburtstage?tage=60");
      $("#ap-k-gb").innerHTML = r.geburtstage.length ? r.geburtstage.map((g) => `<div class="hf-zeile"><span class="icon">🎂</span><span class="name"><b>${esc(g.name)}</b>${g.wird ? ` wird ${g.wird}` : ""}</span><span class="hf-badge ${g.in_tagen <= 3 ? "hf-warn" : "hf-info"}">${g.in_tagen === 0 ? "heute" : g.in_tagen === 1 ? "morgen" : `in ${g.in_tagen} Tagen`}</span></div>`).join("") : '<div class="hf-leer">Niemand hat bald Geburtstag.</div>';
    } catch (err) { $("#ap-k-gb").innerHTML = `<div class="hf-leer">${esc(err.message)}</div>`; }
  }
  $("#ap-k-such").addEventListener("submit", (e) => { e.preventDefault(); kontakte($("#ap-k-q").value.trim()); });

  // ---------- Musik ----------
  let zufall = false;
  async function musik() {
    try {
      const r = await json("/api/apple/musik");
      const s = r.status;
      zufall = Boolean(s?.zufall);
      $("#ap-m-jetzt").innerHTML = s && s.zustand !== "stopped" && s.titel ? `<b>${esc(s.titel)}</b><br><span class="klein">${esc(s.kuenstler || "")}${s.album ? ` · ${esc(s.album)}` : ""} · ${s.zustand === "paused" ? "pausiert" : "läuft"}</span>` : "Gerade läuft nichts in der Musik-App.";
      w.$("[data-m=zufall]").classList.toggle("an", zufall);
      $("#ap-m-pl").innerHTML = r.playlists.length ? r.playlists.map((p) => `<button class="hf-mini" data-pl="${esc(p)}">▶ ${esc(p)}</button>`).join("") : '<span class="hf-hinweis">Keine Playlists gefunden.</span>';
      if (r.fehler) status(r.fehler, true);
    } catch (err) { status(err.message, true); }
  }
  const musikBefehl = async (body, ok) => { try { const r = await json("/api/apple/musik", { body }); status(ok(r)); setTimeout(musik, 900); } catch (err) { status(err.message, true); } };
  w.sheet.querySelector("[data-seite=musik]").addEventListener("click", (e) => {
    const m = e.target.closest("[data-m]")?.dataset.m;
    const pl = e.target.closest("[data-pl]")?.dataset.pl;
    if (m === "zufall") musikBefehl({ aktion: "zufall", an: !zufall }, (r) => `Zufall ${r.zufall ? "an" : "aus"}.`);
    else if (m) musikBefehl({ aktion: m }, () => "");
    else if (pl) musikBefehl({ aktion: "playlist", name: pl }, (r) => `Playlist ${r.playlist} läuft.`);
  });
  $("#ap-m-such").addEventListener("submit", (e) => { e.preventDefault(); const text = $("#ap-m-q").value.trim(); if (text) musikBefehl({ aktion: "suchen", text }, (r) => `Läuft: ${r.titel?.[0]?.name || text}.`); });

  // ---------- Gesundheit ----------
  let wahl = "schritte";
  async function ladeGesundheit() {
    try { gesundheit = await json("/api/apple/gesundheit"); zeichneGesundheit(); } catch (err) { status(err.message, true); }
  }
  function zeichneGesundheit() {
    const g = gesundheit;
    if (!g) return;
    if (!g.letzter_tag) status("Noch keine Gesundheitsdaten. Lade unten den Health-Export hoch oder richte den Kurzbefehl ein.");
    else status(`Letzte Werte vom ${datum(g.letzter_tag)}.`);
    $("#ap-g-kacheln").innerHTML = Object.entries(g.werte).map(([k, d]) => {
      const t = g.trends[k] || {};
      const st = k === "schlaf_stunden" || k === "gewicht" ? 1 : 0;
      const pfeil = t.woche != null && t.vorwoche != null && t.vorwoche !== 0 ? (t.woche > t.vorwoche * 1.03 ? "▲" : t.woche < t.vorwoche * 0.97 ? "▼" : "▶") : "";
      return `<button class="ap-kachel ${wahl === k ? "an" : ""}" data-wert="${esc(k)}"><span class="klein">${esc(d.name)}</span><b>${zahl(t.letzter, st)}<small> ${esc(d.einheit || "")}</small></b><span class="klein">Woche Ø ${zahl(t.woche, st)} ${pfeil}</span></button>`;
    }).join("");
    $("#ap-g-wahl").innerHTML = "";
    zeichneChart();
    zeigeImport(g.import);
  }
  function zeichneChart() {
    const g = gesundheit;
    const d = g.werte[wahl];
    const punkte = g.verlauf.filter((x) => Number.isFinite(x[wahl])).slice(-45);
    if (punkte.length < 2) { $("#ap-g-chart").innerHTML = `<div class="hf-leer">Für ${esc(d.name)} gibt es noch zu wenige Tage.</div>`; return; }
    const W = 640, Hh = 180, P = 26;
    const werte = punkte.map((x) => x[wahl]);
    let min = Math.min(...werte), max = Math.max(...werte);
    if (d.ziel) { min = Math.min(min, d.ziel); max = Math.max(max, d.ziel); }
    if (max === min) { max += 1; min -= 1; }
    const sx = (i) => P + (i * (W - 2 * P)) / (punkte.length - 1);
    const sy = (v) => Hh - P - ((v - min) / (max - min)) * (Hh - 2 * P);
    const linie = punkte.map((x, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(x[wahl]).toFixed(1)}`).join(" ");
    const flaeche = `${linie} L${sx(punkte.length - 1).toFixed(1)},${Hh - P} L${P},${Hh - P} Z`;
    const st = wahl === "schlaf_stunden" || wahl === "gewicht" ? 1 : 0;
    $("#ap-g-chart").innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(d.name)} der letzten ${punkte.length} Tage">
      <defs><linearGradient id="ap-gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--cyan)" stop-opacity=".35"/><stop offset="1" stop-color="var(--cyan)" stop-opacity="0"/></linearGradient></defs>
      ${d.ziel ? `<line x1="${P}" x2="${W - P}" y1="${sy(d.ziel)}" y2="${sy(d.ziel)}" class="ap-ziel"/><text x="${W - P}" y="${sy(d.ziel) - 5}" text-anchor="end" class="ap-ach">Ziel ${zahl(d.ziel)}</text>` : ""}
      <path d="${flaeche}" fill="url(#ap-gr)"/><path d="${linie}" class="ap-linie"/>
      ${punkte.map((x, i) => `<circle cx="${sx(i).toFixed(1)}" cy="${sy(x[wahl]).toFixed(1)}" r="2.6" class="ap-pkt"><title>${datum(x.tag)}: ${zahl(x[wahl], st)} ${esc(d.einheit || "")}</title></circle>`).join("")}
      <text x="${P}" y="${Hh - 6}" class="ap-ach">${datum(punkte[0].tag)}</text><text x="${W - P}" y="${Hh - 6}" text-anchor="end" class="ap-ach">${datum(punkte.at(-1).tag)}</text>
      <text x="4" y="${sy(max) + 4}" class="ap-ach">${zahl(max, st)}</text><text x="4" y="${sy(min) + 4}" class="ap-ach">${zahl(min, st)}</text></svg>`;
  }
  $("#ap-g-kacheln").addEventListener("click", (e) => { const b = e.target.closest("[data-wert]"); if (!b) return; wahl = b.dataset.wert; w.$$(".ap-kachel").forEach((x) => x.classList.toggle("an", x === b)); zeichneChart(); });

  let impTimer = null;
  function zeigeImport(s) {
    const bal = $("#ap-g-balken");
    if (!s || (!s.laeuft && !s.fertig && !s.fehler)) { $("#ap-g-imp").textContent = ""; bal.classList.add("hidden"); return; }
    if (s.laeuft) {
      $("#ap-g-imp").textContent = `Friday liest den Export … ${s.zeilen ? `${zahl(s.zeilen)} Einträge` : ""}`;
      bal.classList.remove("hidden");
      bal.firstElementChild.style.width = `${Math.min(95, 5 + Math.log10((s.zeilen || 0) + 1) * 12)}%`;
      clearTimeout(impTimer);
      impTimer = setTimeout(async () => { try { const n = await json("/api/apple/gesundheit/import"); if (n.laeuft) zeigeImport(n); else ladeGesundheit(); } catch { /* später */ } }, 2500);
    } else {
      bal.classList.add("hidden");
      $("#ap-g-imp").textContent = s.fehler ? `Import fehlgeschlagen: ${s.fehler}` : s.tage ? `Zuletzt eingelesen: ${zahl(s.tage)} Tage${s.fertig ? ` (${datum(s.fertig)})` : ""}.` : "";
    }
  }
  $("#ap-g-datei").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    $("#ap-g-imp").textContent = `Lade ${f.name} hoch (${zahl(f.size / 1048576, 1)} MB) …`;
    $("#ap-g-balken").classList.remove("hidden");
    try {
      const r = await window.Friday.api(`/api/apple/gesundheit/import?name=${encodeURIComponent(f.name)}`, { method: "POST", body: f, headers: { "Content-Type": "application/octet-stream" } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Fehler ${r.status}`);
      zeigeImport({ ...d, laeuft: true });
    } catch (err) { $("#ap-g-balken").classList.add("hidden"); $("#ap-g-imp").textContent = err.message; }
  });

  const style = document.createElement("style");
  style.textContent = `
.ap-box { width: min(980px, 100%); }
.ap-scroll { max-height: 52vh; overflow-y: auto; }
button.hf-zeile.ap-z { text-align: left; color: inherit; font: inherit; cursor: pointer; width: 100%; }
button.hf-zeile.ap-z:hover { border-color: var(--cyan); }
.ap-notiz { white-space: pre-wrap; font-size: 14px; line-height: 1.5; max-height: 40vh; overflow-y: auto; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--u-rand-soft, var(--line)); }
.ap-link { color: var(--cyan); text-decoration: none; font-size: 13px; margin-right: 8px; white-space: nowrap; }
.ap-player { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ap-jetzt { font-size: 15px; min-width: 200px; }
.ap-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.hf-btn.an { border-color: var(--cyan); box-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 40%, transparent); }
.ap-kacheln { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
.ap-kachel { display: flex; flex-direction: column; gap: 3px; text-align: left; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.3); color: var(--text); border-radius: 12px; padding: 10px 12px; font: inherit; cursor: pointer; }
.ap-kachel b { font-size: 22px; } .ap-kachel small { font-size: 12px; color: var(--muted); font-weight: 400; }
.ap-kachel .klein { font-size: 11.5px; color: var(--muted); }
.ap-kachel.an { border-color: var(--cyan); box-shadow: 0 0 14px color-mix(in srgb, var(--cyan) 35%, transparent); }
.ap-chart svg { width: 100%; height: auto; display: block; }
.ap-linie { fill: none; stroke: var(--cyan); stroke-width: 2; filter: drop-shadow(0 0 4px var(--cyan)); }
.ap-pkt { fill: var(--cyan); }
.ap-ziel { stroke: #45e38b; stroke-dasharray: 4 4; stroke-width: 1; opacity: .7; }
.ap-ach { fill: var(--muted); font-size: 9px; }
@media (max-width: 900px) { .ap-kacheln { grid-template-columns: repeat(2, 1fr); } .ap-scroll { max-height: none; } }`;
  document.head.appendChild(style);

  window.FridayApple = { open: (opts) => w.auf(opts), offen: w.offen };
})();
