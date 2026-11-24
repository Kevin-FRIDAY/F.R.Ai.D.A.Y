// F.R.Ai.D.A.Y Meine Konten (v1.162.0): Berliner Sparkasse, Revolut und weitere Banken – NUR ANSEHEN.
// Kontostand, Umsätze, Monats-Auswertung nach Kategorien, Abos. Friday bewegt kein Geld.
// Live über Enable Banking (kostenlos für eigene Konten) oder per CSV-Datei aus dem Online-Banking.
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  let tab = "uebersicht";
  let stand = null;
  let monat = "";
  let kats = [];

  const w = H.fenster({
    id: "konten", titel: "🏦 Meine Konten", klasse: "kt-box",
    html: `
      <div class="kt-schild">🔒 <b>Nur ansehen.</b> Friday kann kein Geld bewegen, nichts überweisen und nichts bezahlen.</div>
      <div class="hf-tabs" role="tablist">
        <button class="hf-tab an" data-tab="uebersicht">💳 Übersicht</button>
        <button class="hf-tab" data-tab="umsaetze">📜 Umsätze</button>
        <button class="hf-tab" data-tab="auswertung">📊 Auswertung</button>
        <button class="hf-tab" data-tab="einrichten">⚙️ Einrichten</button>
      </div>
      <div id="kt-status" class="hf-status"></div>
      <section data-seite="uebersicht">
        <div class="kt-summe"><small>Alle Konten zusammen</small><b id="kt-summe">–</b></div>
        <div id="kt-konten" class="hf-raster" style="margin-top:12px"></div>
        <div id="kt-verb" class="hf-liste" style="margin-top:12px"></div>
        <div class="hf-reihe" style="margin-top:12px"><button id="kt-neu" class="hf-btn haupt" type="button">↻ Jetzt aktualisieren</button><span class="hf-hinweis">Friday holt die Kontostände selbst alle 6 Stunden. Die Bank erlaubt etwa 4 Abrufe am Tag.</span></div>
      </section>
      <section data-seite="umsaetze" class="hidden">
        <form id="kt-u-such" class="hf-reihe" autocomplete="off">
          <input id="kt-u-q" class="hf-input grow" type="search" placeholder="Suchen: Rewe, Netflix, Miete, 49,99 …" enterkeyhint="search" aria-label="Umsätze durchsuchen">
          <select id="kt-u-konto" class="hf-input kt-sel" aria-label="Konto"></select>
          <select id="kt-u-kat" class="hf-input kt-sel" aria-label="Kategorie"></select>
          <button class="hf-btn" type="submit">🔎</button>
        </form>
        <div id="kt-u-info" class="hf-hinweis" style="margin-top:8px"></div>
        <div id="kt-u-liste" class="hf-liste" style="margin-top:8px"></div>
      </section>
      <section data-seite="auswertung" class="hidden">
        <div class="hf-reihe"><select id="kt-a-monat" class="hf-input kt-sel" aria-label="Monat"></select></div>
        <div class="kt-kacheln" id="kt-a-kacheln" style="margin-top:10px"></div>
        <div class="hf-zwei" style="margin-top:12px">
          <div class="hf-karte"><h3>Wofür das Geld ging</h3><div id="kt-a-kat" class="hf-liste"></div></div>
          <div class="hf-karte"><h3>Letzte 6 Monate</h3><div id="kt-a-verlauf" class="kt-verlauf"></div><p class="hf-hinweis"><span class="kt-pkt ein"></span> Einnahmen <span class="kt-pkt aus"></span> Ausgaben · Umbuchungen zwischen deinen Konten zählen nicht.</p></div>
        </div>
        <div class="hf-zwei" style="margin-top:12px">
          <div class="hf-karte"><h3>Größte Ausgaben</h3><div id="kt-a-gross" class="hf-liste"></div></div>
          <div class="hf-karte"><h3>Abos &amp; feste Zahlungen</h3><div id="kt-a-abos" class="hf-liste"></div></div>
        </div>
      </section>
      <section data-seite="einrichten" class="hidden">
        <div class="hf-karte">
          <h3>Weg 1 · Live-Verbindung (empfohlen, kostenlos)</h3>
          <p class="hf-hinweis">Über <b>Enable Banking</b> – ein zugelassener Kontoinformations-Dienst nach EU-Recht (PSD2). Für deine eigenen Konten kostenlos. Die Anmeldung bei der Bank (pushTAN, Revolut-App) machst du direkt bei der Bank – Friday sieht weder PIN noch Passwort. Der Zugang erlaubt nur Lesen und läuft nach spätestens 180 Tagen ab. Anleitung: „57-meine-konten.md“.</p>
          <ol class="kt-schritte">
            <li>Auf <a href="https://enablebanking.com/sign-in/" target="_blank" rel="noopener">enablebanking.com</a> kostenlos registrieren → Control Panel → <b>API applications</b> → <b>Add a new application</b>, Umgebung <b>Production</b>.</li>
            <li>„Generate in the browser“ lassen – die <b>.pem-Datei</b> (privater Schlüssel) wird geladen. Gut aufheben.</li>
            <li>Bei <b>Allowed redirect URLs</b> genau diese Adresse eintragen: <code id="kt-rueck-anzeige"></code> <button type="button" class="hf-mini" id="kt-kopier">Kopieren</button></li>
            <li>App anlegen, dann <b>„Activate by linking accounts“</b>: Berliner Sparkasse und Revolut einmal verknüpfen.</li>
            <li>Hier App-ID und .pem-Datei eintragen → Speichern. Danach unten „Bank verbinden“.</li>
          </ol>
          <form id="kt-zugang" class="hf-feld" autocomplete="off">
            <label>App-ID (Application ID)<input id="kt-app" class="hf-input" placeholder="z. B. 1a2b3c4d-…" spellcheck="false"></label>
            <label>Privater Schlüssel (.pem)
              <div class="hf-reihe"><label class="hf-btn">📄 .pem-Datei wählen<input id="kt-pem-datei" type="file" accept=".pem,.key,.txt,application/x-pem-file" hidden></label><span id="kt-pem-info" class="hf-hinweis">Bleibt nur auf deinem Mac.</span></div>
              <textarea id="kt-pem" class="kt-pem" placeholder="-----BEGIN PRIVATE KEY----- … (oder Datei wählen)" spellcheck="false"></textarea></label>
            <label>Rückkehr-Adresse<input id="kt-rueck" class="hf-input" spellcheck="false"></label>
            <div class="hf-reihe"><button class="hf-btn haupt" type="submit">💾 Speichern &amp; testen</button><button id="kt-zugang-weg" class="hf-btn leise hidden" type="button">Zugang löschen</button><span id="kt-zugang-info" class="hf-hinweis"></span></div>
          </form>
        </div>
        <div class="hf-karte" id="kt-bank-karte">
          <h3>Bank verbinden</h3>
          <div class="hf-reihe"><button type="button" class="hf-btn" data-schnell="Berliner Sparkasse">🔴 Berliner Sparkasse</button><button type="button" class="hf-btn" data-schnell="Revolut">⚫ Revolut</button></div>
          <form id="kt-b-such" class="hf-reihe" style="margin-top:8px" autocomplete="off">
            <select id="kt-b-land" class="hf-input kt-sel" aria-label="Land"><option value="DE">Deutschland</option><option value="LT">Litauen</option><option value="AT">Österreich</option><option value="NL">Niederlande</option><option value="FR">Frankreich</option><option value="ES">Spanien</option><option value="IT">Italien</option></select>
            <input id="kt-b-q" class="hf-input grow" type="search" placeholder="Bank suchen …" aria-label="Bank suchen"><button class="hf-btn" type="submit">🔎</button>
          </form>
          <div id="kt-b-liste" class="hf-liste" style="margin-top:8px"></div>
        </div>
        <div class="hf-karte">
          <h3>Weg 2 · CSV-Datei (sofort, ohne Anmeldung)</h3>
          <p class="hf-hinweis"><b>Sparkasse:</b> Online-Banking → Umsätze → Zeitraum wählen → Export „CSV-CAMT“. <b>Revolut:</b> App → Konto → ⋯ → Kontoauszug → Format „Excel/CSV“. Datei hier hochladen – doppelte Umsätze erkennt Friday selbst.</p>
          <div class="hf-reihe">
            <select id="kt-c-bank" class="hf-input kt-sel" aria-label="Bank"><option>Berliner Sparkasse</option><option>Revolut</option><option value="">Andere Bank …</option></select>
            <input id="kt-c-name" class="hf-input hidden" placeholder="Name der Bank">
            <input id="kt-c-saldo" class="hf-input kt-sel" inputmode="decimal" placeholder="Kontostand heute (optional)">
            <label class="hf-btn haupt">⬆ CSV hochladen<input id="kt-c-datei" type="file" accept=".csv,text/csv,.txt" hidden></label>
          </div>
          <div id="kt-c-info" class="hf-hinweis" style="margin-top:6px"></div>
        </div>
        <div class="hf-karte"><h3>Verbunden</h3><div id="kt-e-liste" class="hf-liste"></div></div>
      </section>`,
    onOpen: (o) => zeigeTab(o?.tab || tab, o),
  });
  const $ = (s) => w.$(s);
  const status = (t, f = false) => { const s = $("#kt-status"); s.textContent = t || ""; s.classList.toggle("fehler", f); };
  const geld = (n, wae = "EUR") => (n == null || !Number.isFinite(Number(n)) ? "–" : Number(n).toLocaleString("de-DE", { style: "currency", currency: /^[A-Z]{3}$/.test(wae) ? wae : "EUR" }));
  const tag = (iso) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "");
  const zeit = (iso) => (iso ? new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
  const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const monatName = (m) => `${MONATE[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
  const rueckAdresse = () => `${location.origin}/api/konten/rueckruf`;

  function zeigeTab(t, o = {}) {
    tab = t;
    w.$$(".hf-tab[data-tab]").forEach((b) => b.classList.toggle("an", b.dataset.tab === t));
    w.$$("[data-seite]").forEach((s) => s.classList.toggle("hidden", s.dataset.seite !== t));
    status("");
    laden().then(() => {
      if (t === "uebersicht") zeigeUebersicht();
      if (t === "umsaetze") { if (o.q != null) $("#kt-u-q").value = o.q; zeigeUmsaetze(); }
      if (t === "auswertung") zeigeAuswertung();
      if (t === "einrichten") zeigeEinrichten();
    });
  }
  w.sheet.querySelector(".hf-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) zeigeTab(b.dataset.tab); });

  async function laden() {
    try { stand = await json("/api/konten"); kats = stand.kategorien || []; }
    catch (err) { status(err.message, true); stand = stand || { konten: [], verbindungen: [], summe: {} }; }
    return stand;
  }

  // ---------- Übersicht ----------
  function zeigeUebersicht() {
    const s = stand;
    const sum = Object.entries(s.summe || {});
    $("#kt-summe").textContent = sum.length ? sum.map(([wae, n]) => geld(n, wae)).join(" · ") : "–";
    $("#kt-summe").classList.toggle("minus", sum.some(([, n]) => n < 0));
    if (!s.konten.length) {
      $("#kt-konten").innerHTML = `<div class="hf-leer" style="grid-column:1/-1">Noch keine Konten. Unter <b>⚙️ Einrichten</b> verbindest du die Berliner Sparkasse und Revolut – oder lädst einfach eine CSV-Datei hoch.<br><br><button type="button" class="hf-btn haupt" data-geh="einrichten">Jetzt einrichten</button></div>`;
    } else {
      $("#kt-konten").innerHTML = s.konten.map((k) => `
        <div class="hf-karte kt-konto">
          <div class="kt-bank">${esc(k.bank)} <span class="hf-badge ${k.quelle === "bank" ? "hf-gut" : "hf-info"}">${k.quelle === "bank" ? "LIVE" : "CSV"}</span></div>
          <div class="kt-name">${esc(k.name)}${k.iban ? ` · <span class="klein">${esc(k.iban)}</span>` : ""}</div>
          <b class="kt-saldo${k.saldo < 0 ? " minus" : ""}">${geld(k.saldo, k.waehrung)}</b>
          ${k.verfuegbar != null && k.verfuegbar !== k.saldo ? `<div class="klein">Verfügbar ${geld(k.verfuegbar, k.waehrung)}</div>` : ""}
          <div class="klein">${k.saldoDatum ? `Stand ${zeit(k.saldoDatum)}` : "Kontostand nicht in der Datei"} · ${k.umsaetze} Umsätze</div>
          <div class="hf-reihe" style="margin-top:6px"><button type="button" class="hf-mini" data-umsatz="${esc(k.id)}">Umsätze</button>${k.quelle === "csv" ? `<button type="button" class="hf-mini" data-saldo="${esc(k.id)}">Kontostand eintragen</button>` : ""}</div>
        </div>`).join("");
    }
    $("#kt-verb").innerHTML = s.verbindungen.map((v) => {
      const cls = v.abgelaufen ? "hf-schlecht" : v.fehler ? "hf-warn" : v.tageRest != null && v.tageRest < 14 ? "hf-warn" : "hf-gut";
      const text = v.abgelaufen ? "Freigabe abgelaufen – bitte neu verbinden" : v.fehler ? v.fehler : `Freigabe noch ${v.tageRest} Tage · zuletzt ${zeit(v.letzterAbruf) || "–"} · heute ${v.abrufeHeute}/${v.maxAbrufe} Abrufe`;
      return `<div class="hf-zeile"><span class="icon">🔗</span><span class="name"><b>${esc(v.bank)}</b><br><span class="klein ${cls}">${esc(text)}</span></span>${v.abgelaufen || (v.tageRest != null && v.tageRest < 14) ? `<button type="button" class="hf-mini" data-neuverb="${esc(v.bank)}" data-land="${esc(v.land)}">Neu verbinden</button>` : ""}</div>`;
    }).join("");
    $("#kt-neu").classList.toggle("hidden", !s.verbindungen.length);
  }
  w.sheet.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.geh) zeigeTab(b.dataset.geh);
    if (b.dataset.umsatz) { $("#kt-u-konto").dataset.wahl = b.dataset.umsatz; zeigeTab("umsaetze"); }
    if (b.dataset.saldo) {
      const wert = prompt("Aktueller Kontostand in Euro (z. B. 1234,56):"); // eslint-disable-line no-alert
      if (wert == null) return;
      try { await json("/api/konten/konto/saldo", { body: { id: b.dataset.saldo, saldo: wert } }); await laden(); zeigeUebersicht(); } catch (err) { status(err.message, true); }
    }
    if (b.dataset.neuverb) verbinde(b.dataset.neuverb, b.dataset.land || "DE", b);
    if (b.dataset.verbinde) verbinde(b.dataset.verbinde, b.dataset.land || "DE", b);
    if (b.dataset.schnell) { $("#kt-b-q").value = b.dataset.schnell; $("#kt-b-land").value = "DE"; suchBank(); }
    if (b.dataset.trennen) {
      if (!confirm(`Verbindung zu ${b.dataset.name} trennen? Die gespeicherten Umsätze werden auf dem Mac gelöscht.`)) return; // eslint-disable-line no-alert
      await json("/api/konten/trennen", { body: { id: b.dataset.trennen } }).catch((err) => status(err.message, true));
      await laden(); zeigeEinrichten();
    }
    if (b.dataset.loeschen) {
      if (!confirm(`„${b.dataset.name}“ mit allen importierten Umsätzen löschen?`)) return; // eslint-disable-line no-alert
      await json("/api/konten/konto/loeschen", { body: { id: b.dataset.loeschen } }).catch((err) => status(err.message, true));
      await laden(); zeigeEinrichten();
    }
  });
  $("#kt-neu").addEventListener("click", async (e) => {
    const b = e.currentTarget; b.disabled = true; status("Frage die Banken …");
    try {
      const r = await json("/api/konten/aktualisieren", { body: {} });
      stand = r;
      const f = (r.ergebnisse || []).filter((x) => !x.ok);
      status(f.length ? f.map((x) => `${x.bank}: ${x.error}`).join(" · ") : "Alles frisch ✓", f.length > 0);
      zeigeUebersicht();
    } catch (err) { status(err.message, true); }
    b.disabled = false;
  });

  // ---------- Umsätze ----------
  function fuelleFilter() {
    const ks = $("#kt-u-konto");
    const wahl = ks.dataset.wahl ?? ks.value;
    ks.innerHTML = `<option value="">Alle Konten</option>${stand.konten.map((k) => `<option value="${esc(k.id)}">${esc(`${k.bank} · ${k.name}`)}</option>`).join("")}`;
    ks.value = stand.konten.some((k) => k.id === wahl) ? wahl : "";
    delete ks.dataset.wahl;
    const kk = $("#kt-u-kat");
    const kw = kk.value;
    kk.innerHTML = `<option value="">Alle Kategorien</option>${kats.map((k) => `<option value="${esc(k.name)}">${k.symbol} ${esc(k.name)}</option>`).join("")}`;
    kk.value = kw;
  }
  async function zeigeUmsaetze() {
    fuelleFilter();
    const p = new URLSearchParams({ q: $("#kt-u-q").value.trim(), konto: $("#kt-u-konto").value, kategorie: $("#kt-u-kat").value, limit: "300" });
    $("#kt-u-liste").innerHTML = '<div class="hf-leer">Lade …</div>';
    try {
      const r = await json(`/api/konten/umsaetze?${p}`);
      const summe = r.umsaetze.reduce((s, u) => s + u.betrag, 0);
      $("#kt-u-info").textContent = r.gesamt ? `${r.gesamt} Umsätze${r.gesamt > r.umsaetze.length ? ` (die neuesten ${r.umsaetze.length} gezeigt)` : ""} · Summe ${geld(summe)}` : "";
      const opts = (sel) => kats.map((k) => `<option value="${esc(k.name)}"${k.name === sel ? " selected" : ""}>${k.symbol} ${esc(k.name)}</option>`).join("");
      $("#kt-u-liste").innerHTML = r.umsaetze.length ? r.umsaetze.map((u) => `
        <div class="hf-zeile kt-u${u.vorgemerkt ? " vorgemerkt" : ""}">
          <span class="icon">${u.symbol}</span>
          <span class="name"><b>${esc(u.gegenueber || u.zweck.slice(0, 60) || "–")}</b><br><span class="klein">${tag(u.datum)}${u.vorgemerkt ? " · vorgemerkt" : ""} · ${esc(u.kontoName)}${u.zweck && u.gegenueber ? ` · ${esc(u.zweck.slice(0, 90))}` : ""}</span></span>
          <select class="kt-kat" data-gegen="${esc(u.gegenueber || u.zweck)}" aria-label="Kategorie ändern">${opts(u.kategorie)}</select>
          <b class="kt-betrag${u.betrag < 0 ? " minus" : " plus"}">${geld(u.betrag, u.waehrung)}</b>
        </div>`).join("") : `<div class="hf-leer">${stand.konten.length ? "Keine passenden Umsätze." : "Noch keine Konten verbunden."}</div>`;
    } catch (err) { $("#kt-u-liste").innerHTML = ""; status(err.message, true); }
  }
  $("#kt-u-such").addEventListener("submit", (e) => { e.preventDefault(); zeigeUmsaetze(); });
  $("#kt-u-konto").addEventListener("change", zeigeUmsaetze);
  $("#kt-u-kat").addEventListener("change", zeigeUmsaetze);
  $("#kt-u-liste").addEventListener("change", async (e) => {
    const s = e.target.closest(".kt-kat");
    if (!s) return;
    try { await json("/api/konten/kategorie", { body: { gegenueber: s.dataset.gegen, kategorie: s.value } }); status(`Gemerkt: „${s.dataset.gegen.slice(0, 40)}“ ist ab jetzt ${s.value}.`); zeigeUmsaetze(); }
    catch (err) { status(err.message, true); }
  });

  // ---------- Auswertung ----------
  async function zeigeAuswertung() {
    try {
      const a = await json(`/api/konten/auswertung${monat ? `?monat=${monat}` : ""}`);
      monat = a.monat;
      const sel = $("#kt-a-monat");
      const ms = a.monate.length ? a.monate : [a.monat];
      sel.innerHTML = ms.map((m) => `<option value="${m}"${m === a.monat ? " selected" : ""}>${monatName(m)}</option>`).join("");
      const diff = a.vormonat.ausgaben ? Math.round(((a.ausgaben - a.vormonat.ausgaben) / a.vormonat.ausgaben) * 100) : null;
      $("#kt-a-kacheln").innerHTML = `
        <div class="kt-kachel"><small>Einnahmen</small><b class="plus">${geld(a.einnahmen)}</b></div>
        <div class="kt-kachel"><small>Ausgaben</small><b class="minus">${geld(-a.ausgaben)}</b>${diff != null ? `<span class="klein">${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)} % zum Vormonat</span>` : ""}</div>
        <div class="kt-kachel"><small>Übrig</small><b class="${a.ergebnis < 0 ? "minus" : "plus"}">${geld(a.ergebnis)}</b></div>
        <div class="kt-kachel"><small>Abos im Monat</small><b>${geld(-a.abos.reduce((s, x) => s + x.betrag, 0))}</b><span class="klein">${a.abos.length} feste Zahlungen</span></div>`;
      const max = Math.max(1, ...a.kategorien.map((k) => k.betrag));
      $("#kt-a-kat").innerHTML = a.kategorien.length ? a.kategorien.map((k) => `
        <button type="button" class="kt-katz" data-katsuche="${esc(k.name)}"><span>${k.symbol} ${esc(k.name)}</span><b>${geld(k.betrag)}</b>
          <span class="hf-balken"><i style="width:${Math.round((k.betrag / max) * 100)}%"></i></span>
          <span class="klein">${k.anteil} %${k.vormonat ? ` · Vormonat ${geld(k.vormonat)}` : ""}</span></button>`).join("") : '<div class="hf-leer">Keine Ausgaben in diesem Monat.</div>';
      const vmax = Math.max(1, ...a.verlauf.flatMap((v) => [v.ein, v.aus]));
      $("#kt-a-verlauf").innerHTML = a.verlauf.map((v) => `<div class="kt-spalte" title="${monatName(v.monat)}: +${geld(v.ein)} / −${geld(v.aus)}"><div class="kt-saeulen"><i class="ein" style="height:${Math.round((v.ein / vmax) * 100)}%"></i><i class="aus" style="height:${Math.round((v.aus / vmax) * 100)}%"></i></div><span>${MONATE[Number(v.monat.slice(5)) - 1].slice(0, 3)}</span></div>`).join("") || '<div class="hf-leer">Noch zu wenig Daten.</div>';
      $("#kt-a-gross").innerHTML = a.groesste.length ? a.groesste.map((u) => `<div class="hf-zeile"><span class="icon">${u.symbol}</span><span class="name"><b>${esc(u.gegenueber)}</b><br><span class="klein">${tag(u.datum)} · ${esc(u.kategorie)}</span></span><b class="kt-betrag minus">${geld(u.betrag)}</b></div>`).join("") : '<div class="hf-leer">–</div>';
      $("#kt-a-abos").innerHTML = a.abos.length ? a.abos.map((x) => `<div class="hf-zeile"><span class="icon">${x.symbol}</span><span class="name"><b>${esc(x.name)}</b><br><span class="klein">zuletzt ${tag(x.zuletzt)} · in ${x.monate} Monaten</span></span><b class="kt-betrag minus">${geld(-x.betrag)}</b></div>`).join("") : '<div class="hf-leer">Noch keine erkannt (braucht Umsätze aus mindestens 2 Monaten).</div>';
    } catch (err) { status(err.message, true); }
  }
  $("#kt-a-monat").addEventListener("change", (e) => { monat = e.target.value; zeigeAuswertung(); });
  $("#kt-a-kat").addEventListener("click", (e) => {
    const b = e.target.closest("[data-katsuche]");
    if (!b) return;
    $("#kt-u-kat").dataset.wahl = b.dataset.katsuche;
    zeigeTab("umsaetze");
    setTimeout(() => { $("#kt-u-kat").value = b.dataset.katsuche; zeigeUmsaetze(); }, 0);
  });

  // ---------- Einrichten ----------
  function zeigeEinrichten() {
    $("#kt-rueck-anzeige").textContent = stand.redirectUrl || rueckAdresse();
    if (!$("#kt-rueck").value) $("#kt-rueck").value = stand.redirectUrl || rueckAdresse();
    $("#kt-app").placeholder = stand.appId ? `gespeichert (${stand.appId}) – nur zum Ändern neu eintragen` : "z. B. 1a2b3c4d-…";
    $("#kt-pem").placeholder = stand.eingerichtet ? "Schlüssel ist gespeichert – nur zum Ändern neu einfügen" : "-----BEGIN PRIVATE KEY----- … (oder Datei wählen)";
    $("#kt-zugang-weg").classList.toggle("hidden", !stand.eingerichtet);
    $("#kt-zugang-info").textContent = stand.eingerichtet ? "✓ Zugang gespeichert" : "";
    $("#kt-bank-karte").classList.toggle("aus", !stand.eingerichtet);
    if (!stand.eingerichtet) $("#kt-b-liste").innerHTML = '<div class="hf-hinweis">Erst oben App-ID und Schlüssel speichern.</div>';
    if (!location.origin.startsWith("https://")) $("#kt-zugang-info").textContent = "Tipp: Öffne Friday über deine Tailscale-Adresse (https://…), die Bank verlangt eine https-Rückkehr-Adresse.";
    const rows = [
      ...stand.verbindungen.map((v) => `<div class="hf-zeile"><span class="icon">🔗</span><span class="name"><b>${esc(v.bank)}</b> <span class="hf-badge hf-gut">LIVE</span><br><span class="klein">${v.abgelaufen ? "abgelaufen" : `noch ${v.tageRest} Tage freigegeben`}</span></span><button type="button" class="hf-mini" data-trennen="${esc(v.id)}" data-name="${esc(v.bank)}">Trennen</button></div>`),
      ...stand.konten.filter((k) => k.quelle === "csv").map((k) => `<div class="hf-zeile"><span class="icon">📄</span><span class="name"><b>${esc(k.bank)} · ${esc(k.name)}</b> <span class="hf-badge hf-info">CSV</span><br><span class="klein">${k.umsaetze} Umsätze · importiert ${zeit(k.aktualisiert)}</span></span><button type="button" class="hf-mini" data-loeschen="${esc(k.id)}" data-name="${esc(`${k.bank} · ${k.name}`)}">Löschen</button></div>`),
    ];
    $("#kt-e-liste").innerHTML = rows.join("") || '<div class="hf-leer">Noch nichts verbunden.</div>';
  }
  $("#kt-kopier").addEventListener("click", () => { navigator.clipboard?.writeText($("#kt-rueck-anzeige").textContent).then(() => { $("#kt-kopier").textContent = "Kopiert ✓"; }, () => {}); });
  $("#kt-pem-datei").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    $("#kt-pem").value = (await f.text()).trim();
    $("#kt-pem-info").textContent = `✓ ${f.name} geladen`;
    e.target.value = "";
  });
  $("#kt-zugang").addEventListener("submit", async (e) => {
    e.preventDefault();
    const info = $("#kt-zugang-info");
    const appId = $("#kt-app").value.trim() || (stand.eingerichtet ? "" : "");
    if (!appId) { info.textContent = "Bitte die App-ID eintragen."; return; }
    info.textContent = "Speichere und teste …";
    try {
      const r = await json("/api/konten/zugang", { body: { appId, schluessel: $("#kt-pem").value.trim(), redirectUrl: $("#kt-rueck").value.trim() } });
      $("#kt-pem").value = ""; $("#kt-app").value = "";
      info.textContent = `✓ Verbunden mit Enable Banking – ${r.banken} Banken in Deutschland verfügbar.`;
      await laden(); zeigeEinrichten();
    } catch (err) { info.textContent = `⚠️ ${err.message}`; await laden(); zeigeEinrichten(); info.textContent = `⚠️ ${err.message}`; }
  });
  $("#kt-zugang-weg").addEventListener("click", async () => {
    if (!confirm("Enable-Banking-Zugang (App-ID + Schlüssel) vom Mac löschen?")) return; // eslint-disable-line no-alert
    await json("/api/konten/zugang", { method: "DELETE" }).catch(() => {});
    await laden(); zeigeEinrichten();
  });
  async function suchBank() {
    if (!stand?.eingerichtet) return;
    const l = $("#kt-b-liste");
    l.innerHTML = '<div class="hf-leer">Suche …</div>';
    try {
      const r = await json(`/api/konten/banken?land=${$("#kt-b-land").value}&q=${encodeURIComponent($("#kt-b-q").value.trim())}`);
      l.innerHTML = r.banken.length ? r.banken.map((b) => `<div class="hf-zeile">${b.logo ? `<img class="kt-logo" src="${esc(b.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="icon">🏦</span>'}<span class="name"><b>${esc(b.name)}</b>${b.beta ? ' <span class="hf-badge hf-warn">BETA</span>' : ""}<br><span class="klein">${esc(b.land)} · Freigabe bis ${b.maxTage} Tage</span></span><button type="button" class="hf-btn" data-verbinde="${esc(b.name)}" data-land="${esc(b.land)}">Verbinden</button></div>`).join("")
        : `<div class="hf-leer">Nichts gefunden.${$("#kt-b-q").value.toLowerCase().includes("revolut") && $("#kt-b-land").value === "DE" ? " Revolut steht oft unter Litauen (LT) – Land oben umstellen." : ""}</div>`;
    } catch (err) { l.innerHTML = ""; status(err.message, true); }
  }
  $("#kt-b-such").addEventListener("submit", (e) => { e.preventDefault(); suchBank(); });
  async function verbinde(bank, land, knopf) {
    if (knopf) knopf.disabled = true;
    status(`Öffne die Anmeldung bei ${bank} …`);
    try {
      const r = await json("/api/konten/verbinden", { body: { bank, land } });
      location.href = r.url; // die Bank-Anmeldung darf nicht in einem Rahmen laufen
    } catch (err) {
      if (err.status === 400 && /kenne ich/.test(err.message)) { $("#kt-b-q").value = bank; zeigeTab("einrichten"); suchBank(); }
      status(err.message, true);
      if (knopf) knopf.disabled = false;
    }
  }

  // ---------- CSV ----------
  $("#kt-c-bank").addEventListener("change", (e) => $("#kt-c-name").classList.toggle("hidden", e.target.value !== ""));
  $("#kt-c-datei").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const info = $("#kt-c-info");
    if (f.size > 8 * 1024 * 1024) { info.textContent = "Die Datei ist zu groß (max. 8 MB)."; return; }
    const roh = await f.arrayBuffer();
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(roh); } catch { text = new TextDecoder("windows-1252").decode(roh); } // Sparkasse speichert oft in Windows-Zeichensatz
    const bank = $("#kt-c-bank").value || $("#kt-c-name").value.trim() || "Bank";
    info.textContent = `Lese ${f.name} …`;
    try {
      const r = await json("/api/konten/import", { body: { text, bank, saldo: $("#kt-c-saldo").value.trim() } });
      info.textContent = `✓ ${r.neu} neue Umsätze aus ${r.konten.length} Konto${r.konten.length === 1 ? "" : "en"} übernommen${r.uebersprungen ? ` (${r.uebersprungen} Zeilen übersprungen)` : ""}.`;
      $("#kt-c-saldo").value = "";
      await laden(); zeigeEinrichten();
    } catch (err) { info.textContent = `⚠️ ${err.message}`; }
  });

  // Rückkehr von der Bank (/?konten=1) → Fenster öffnen
  try {
    const p = new URLSearchParams(location.search);
    if (p.has("konten")) {
      history.replaceState(null, "", location.pathname);
      let n = 0;
      const t = setInterval(() => { if (window.Friday?.api || ++n > 40) { clearInterval(t); if (window.Friday?.api) w.auf({ tab: "uebersicht" }); } }, 250);
    }
  } catch { /* egal */ }

  const style = document.createElement("style");
  style.textContent = `
.kt-box { width: min(1040px, 100%); }
.kt-schild { font-size: 12.5px; color: #45e38b; border: 1px solid color-mix(in srgb, #45e38b 45%, transparent); background: color-mix(in srgb, #45e38b 8%, transparent); border-radius: 10px; padding: 7px 11px; }
.kt-summe { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border-radius: 16px; border: 1px solid var(--u-rand, var(--cyan)); background: radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--cyan) 18%, transparent), transparent 60%), rgba(0,0,0,.3); box-shadow: 0 0 24px color-mix(in srgb, var(--cyan) 18%, transparent); }
.kt-summe small { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.kt-summe b { font-size: clamp(26px, 5vw, 38px); text-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 50%, transparent); font-variant-numeric: tabular-nums; }
.kt-konto { display: flex; flex-direction: column; gap: 3px; }
.kt-bank { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--u-titel, var(--cyan)); display: flex; justify-content: space-between; gap: 6px; }
.kt-name { font-size: 13.5px; } .kt-konto .klein, .kt-name .klein { font-size: 11.5px; color: var(--muted); }
.kt-saldo { font-size: 24px; font-variant-numeric: tabular-nums; margin: 4px 0 2px; }
.minus { color: #ff6b5a; } .plus { color: #45e38b; }
.kt-sel { width: auto !important; min-width: 140px; }
.kt-u .kt-kat { background: transparent; color: var(--muted); border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 8px; padding: 4px 6px; font: inherit; font-size: 12px; max-width: 170px; }
.kt-u.vorgemerkt { opacity: .7; border-style: dashed; }
.kt-betrag { font-variant-numeric: tabular-nums; white-space: nowrap; min-width: 92px; text-align: right; }
.kt-kacheln { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.kt-kachel { display: flex; flex-direction: column; gap: 3px; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.3); border-radius: 12px; padding: 10px 12px; }
.kt-kachel small { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.kt-kachel b { font-size: 20px; font-variant-numeric: tabular-nums; } .kt-kachel .klein { font-size: 11.5px; color: var(--muted); }
.kt-katz { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; text-align: left; background: transparent; border: 0; border-bottom: 1px solid var(--u-rand-soft, var(--line)); color: inherit; font: inherit; font-size: 13.5px; padding: 6px 2px 8px; cursor: pointer; }
.kt-katz .hf-balken { grid-column: 1 / -1; height: 6px; } .kt-katz .klein { grid-column: 1 / -1; font-size: 11.5px; color: var(--muted); }
.kt-katz:hover span:first-child { color: var(--cyan); }
.kt-verlauf { display: flex; align-items: flex-end; gap: 10px; height: 150px; padding-top: 6px; }
.kt-spalte { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; font-size: 11px; color: var(--muted); }
.kt-saeulen { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 3px; }
.kt-saeulen i { width: 40%; max-width: 18px; border-radius: 4px 4px 0 0; min-height: 2px; }
.kt-saeulen .ein, .kt-pkt.ein { background: #45e38b; box-shadow: 0 0 8px #45e38b88; }
.kt-saeulen .aus, .kt-pkt.aus { background: var(--cyan); box-shadow: 0 0 8px var(--cyan); }
.kt-pkt { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin: 0 3px 0 8px; vertical-align: middle; }
.kt-schritte { margin: 6px 0 12px; padding-left: 20px; font-size: 13px; line-height: 1.6; color: var(--muted); }
.kt-schritte a { color: var(--cyan); } .kt-schritte code { color: var(--text); background: rgba(0,0,0,.4); padding: 1px 6px; border-radius: 6px; word-break: break-all; }
.kt-pem { min-height: 80px !important; font-family: ui-monospace, Menlo, monospace !important; font-size: 11.5px !important; }
#kt-bank-karte.aus { opacity: .55; }
.kt-logo { width: 26px; height: 26px; object-fit: contain; border-radius: 6px; background: #fff; flex: none; }
@media (max-width: 900px) {
  .kt-kacheln { grid-template-columns: repeat(2, 1fr); }
  .kt-sel { flex: 1 1 45%; min-width: 0; }
  .kt-u .kt-kat { max-width: none; flex: 1; }
}`;
  document.head.appendChild(style);

  window.FridayKonten = { open: (o) => w.auf(o), offen: w.offen };
})();
