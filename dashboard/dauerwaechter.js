// F.R.Ai.D.A.Y Dauer-Wächter (v1.134.0, Idee aus OpenJarvis "Monitor operative")
// Friday beobachtet Preise, Wechselkurse, Länder/Themen in den Nachrichten, Webseiten und das Wetter von morgen
// und meldet sich per Telegram (und ntfy), sobald etwas passiert. Läuft ohne Claude, kostet nichts.
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  let daten = null;
  let art = "krypto";

  const w = H.fenster({
    id: "dwaechter", titel: "🔭 Dauer-Wächter", klasse: "dw-box",
    html: `
      <div id="dw-status" class="hf-status">Sag zum Beispiel: „Friday, beobachte Bitcoin unter 80.000 Euro“ oder „sag mir, wenn es morgen regnet“.</div>
      <form id="dw-frei" class="hf-reihe" autocomplete="off">
        <input id="dw-text" class="hf-input grow" type="text" placeholder="Beobachte … (z. B. Taiwan in den Nachrichten)" enterkeyhint="go" aria-label="Was soll Friday beobachten?">
        <button class="hf-btn haupt" type="submit">🔭 Beobachten</button>
      </form>
      <div class="hf-karte">
        <h3>Meine Wächter</h3>
        <div id="dw-liste" class="hf-liste"></div>
        <div id="dw-kanal" class="hf-hinweis" style="margin-top:8px"></div>
      </div>
      <details class="hf-karte" id="dw-neu-k">
        <summary class="dw-sum">＋ Wächter von Hand anlegen</summary>
        <div class="hf-tabs" id="dw-arten" style="margin:10px 0"></div>
        <form id="dw-form" class="hf-raster" autocomplete="off"></form>
        <div class="hf-reihe" style="margin-top:10px"><button id="dw-anlegen" class="hf-btn haupt" type="button">✓ Anlegen</button></div>
      </details>
      <div class="hf-karte"><h3>Zuletzt gemeldet</h3><div id="dw-ereignisse" class="hf-liste"></div></div>`,
    onOpen: () => laden(),
  });
  const $ = (s) => w.$(s);
  const status = (t, f = false) => { const s = $("#dw-status"); s.textContent = t; s.classList.toggle("fehler", f); };
  const zeit = (iso) => { if (!iso) return "noch nie"; const d = new Date(iso); const min = Math.round((Date.now() - d) / 60000); if (min < 1) return "gerade eben"; if (min < 60) return `vor ${min} Min.`; if (min < 1440) return `vor ${Math.round(min / 60)} Std.`; return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }); };
  const takt = (m) => (m >= 60 ? `alle ${(m / 60).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Std.` : `alle ${m} Min.`);

  const FELDER = {
    krypto: () => `
      <label class="hf-feld">Münze<select name="coin">${["Bitcoin", "Ethereum", "Solana", "XRP", "Dogecoin", "Cardano", "Litecoin"].map((c) => `<option>${c}</option>`).join("")}</select></label>
      <label class="hf-feld">Wann melden?<select name="bedingung"><option value="unter">fällt unter</option><option value="ueber">steigt über</option><option value="bewegung">bewegt sich um … %</option></select></label>
      <label class="hf-feld">Wert<input name="wert" inputmode="decimal" placeholder="z. B. 80.000"></label>
      <label class="hf-feld">Währung<select name="waehrung"><option value="eur">Euro</option><option value="usd">Dollar</option></select></label>`,
    waehrung: () => `
      <label class="hf-feld">Von<input name="von" value="EUR" maxlength="3"></label>
      <label class="hf-feld">Nach<input name="nach" value="USD" maxlength="3"></label>
      <label class="hf-feld">Wann melden?<select name="bedingung"><option value="ueber">steigt über</option><option value="unter">fällt unter</option></select></label>
      <label class="hf-feld">Kurs<input name="wert" inputmode="decimal" placeholder="z. B. 1,15"></label>`,
    nachrichten: () => `
      <label class="hf-feld">Land oder Thema<input name="suche" placeholder="z. B. Taiwan, Ostsee, Bahnstreik"></label>
      <label class="hf-feld">Nur wenn darin vorkommt (optional)<input name="filter" placeholder="z. B. Militär, Manöver"></label>`,
    webseite: () => `
      <label class="hf-feld">Adresse<input name="url" type="url" inputmode="url" placeholder="https://…"></label>
      <label class="hf-feld">Melden, wenn dieses Wort auftaucht (leer = bei jeder Änderung)<input name="suchwort" placeholder="z. B. Lieferbar"></label>`,
    wetter: () => `
      <label class="hf-feld">Was?<select name="bedingung">${Object.entries(daten?.wetter || { regen: "Regen" }).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join("")}</select></label>
      <label class="hf-feld">Ort<input name="ort" placeholder="leer = deine Stadt"></label>`,
  };
  function zeigeArt(a) {
    art = a;
    w.$$("#dw-arten .hf-tab").forEach((b) => b.classList.toggle("an", b.dataset.art === a));
    $("#dw-form").innerHTML = FELDER[a]();
  }

  function zeichne() {
    const d = daten;
    if (!d) return;
    if (!$("#dw-arten").children.length) {
      $("#dw-arten").innerHTML = Object.entries(d.arten).map(([k, v]) => `<button type="button" class="hf-tab" data-art="${esc(k)}">${esc(v.icon)} ${esc(v.name)}</button>`).join("");
      zeigeArt(art);
    }
    $("#dw-liste").innerHTML = d.liste.length ? d.liste.map((x) => `
      <div class="hf-zeile dw-zeile ${x.an ? "" : "dw-aus"}" data-id="${esc(x.id)}">
        <span class="icon">${esc(d.arten[x.art]?.icon || "🔭")}</span>
        <span class="name"><b>${esc(x.name)}</b><br><span class="klein">${esc(x.wert || (x.fehler ? "noch kein Wert" : x.status) || "")} · ${takt(x.intervall_min)} · geprüft ${zeit(x.zuletzt)}${x.meldungen ? ` · ${x.meldungen}× gemeldet` : ""}</span>${x.fehler ? `<br><span class="klein hf-warn">${esc(x.status || "Fehler beim Prüfen")}</span>` : ""}</span>
        <label class="dw-schalter" title="An/Aus"><input type="checkbox" data-an ${x.an ? "checked" : ""}><i></i></label>
        <button class="hf-mini" data-pruefen title="Jetzt prüfen">⟳</button>
        <button class="hf-mini" data-weg title="Löschen">🗑</button>
      </div>`).join("") : '<div class="hf-leer">Noch kein Wächter. Schreib oben, was Friday beobachten soll.</div>';
    const kanaele = [d.telegram && "Telegram", d.ntfy && "ntfy"].filter(Boolean);
    $("#dw-kanal").innerHTML = `${d.notfall ? '<b class="hf-schlecht">Notfall-Modus: Die Wächter pausieren.</b> ' : ""}${kanaele.length ? `Meldungen gehen an: ${kanaele.join(" und ")}.` : "Telegram ist nicht verbunden, darum siehst du Meldungen nur hier und im Logbuch. Einrichten: Einstellungen → Telegram."}`;
    $("#dw-ereignisse").innerHTML = d.ereignisse.length ? d.ereignisse.slice(0, 15).map((e) => `
      <div class="hf-zeile"><span class="icon">${esc(d.arten[e.art]?.icon || "🔔")}</span><span class="name"><b>${esc(e.titel)}</b><br><span class="klein">${esc(e.text || "").slice(0, 220)} · ${zeit(e.at)}</span></span></div>`).join("") : '<div class="hf-leer">Noch keine Meldung.</div>';
  }

  async function laden() {
    try { daten = await json("/api/dauerwaechter"); zeichne(); } catch (err) { status(err.message, true); }
  }

  $("#dw-frei").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = $("#dw-text").value.trim();
    if (!text) return;
    status("Friday richtet den Wächter ein …");
    try {
      const r = await json("/api/dauerwaechter/verstehen", { body: { text } });
      daten = r; zeichne();
      $("#dw-text").value = "";
      status(r.text || "Läuft.");
    } catch (err) { status(err.message, true); }
  });
  $("#dw-arten").addEventListener("click", (e) => { const b = e.target.closest("[data-art]"); if (b) zeigeArt(b.dataset.art); });
  $("#dw-anlegen").addEventListener("click", async () => {
    const f = Object.fromEntries(new FormData($("#dw-form")).entries());
    try {
      const r = await json("/api/dauerwaechter", { body: { art, ...f } });
      daten = r; zeichne();
      $("#dw-neu-k").open = false;
      status("Erledigt. Der Wächter läuft und prüft gleich zum ersten Mal.");
    } catch (err) { status(err.message, true); }
  });
  $("#dw-liste").addEventListener("click", async (e) => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    if (e.target.closest("[data-pruefen]")) {
      status("Prüfe …");
      try { const r = await json(`/api/dauerwaechter/${encodeURIComponent(id)}/pruefen`, { body: {} }); daten = r; zeichne(); status(r.meldung ? `Gemeldet: ${r.meldung.titel}` : "Geprüft, nichts Neues."); } catch (err) { status(err.message, true); }
    } else if (e.target.closest("[data-weg]")) {
      const b = e.target.closest("[data-weg]");
      if (!b.dataset.sicher) { b.dataset.sicher = "1"; b.textContent = "Wirklich?"; setTimeout(() => { if (b.isConnected) { delete b.dataset.sicher; b.textContent = "🗑"; } }, 3000); return; }
      try { daten = await json(`/api/dauerwaechter/${encodeURIComponent(id)}`, { method: "DELETE" }); zeichne(); status("Gelöscht."); } catch (err) { status(err.message, true); }
    }
  });
  $("#dw-liste").addEventListener("change", async (e) => {
    if (!e.target.matches("[data-an]")) return;
    const id = e.target.closest("[data-id]")?.dataset.id;
    try { daten = await json(`/api/dauerwaechter/${encodeURIComponent(id)}`, { body: { an: e.target.checked } }); zeichne(); } catch (err) { status(err.message, true); }
  });

  const style = document.createElement("style");
  style.textContent = `
.dw-box { width: min(820px, 100%); }
.dw-sum { cursor: pointer; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--u-titel, var(--cyan)); }
.dw-zeile.dw-aus { opacity: .55; }
.dw-schalter { position: relative; width: 38px; height: 22px; flex: none; cursor: pointer; }
.dw-schalter input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.dw-schalter i { position: absolute; inset: 0; border-radius: 99px; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.4); transition: background .2s; pointer-events: none; }
.dw-schalter i::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--muted); transition: transform .2s, background .2s; }
.dw-schalter input:checked + i { background: color-mix(in srgb, var(--cyan) 30%, transparent); border-color: var(--cyan); }
.dw-schalter input:checked + i::after { transform: translateX(16px); background: var(--cyan); box-shadow: 0 0 8px var(--cyan); }`;
  document.head.appendChild(style);

  window.FridayWaechter = { open: () => w.auf(), offen: w.offen, refresh: () => w.offen() && laden() };
})();
