// F.R.Ai.D.A.Y – Meine Wunschliste (v1.160.0)
// Die 11 Ideen, die Kevin in der Ideen-Schmiede mit ⭐ auf die Wunschliste gesetzt hat, an einem Ort:
// Kacheln oben, darunter der jeweilige Bereich. Alles im Helfer-Stil (Schwarz + Neon-Orange-Glas).
// Öffnen: Werkzeug-Menü → Friday → Meine Wunschliste, oder Aktion "wunsch" / "wunsch:<reiter>[:suche]".
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  let reiter = "unwetter";
  let wuensche = [];

  const w = H.fenster({
    id: "wunsch", titel: "⭐ Meine Wunschliste", klasse: "wl-box",
    html: `
      <p class="hf-hinweis" style="margin:0">Diese Ideen hast du in der Ideen-Schmiede mit ⭐ markiert. Alle sind jetzt eingebaut und laufen ohne Claude-Guthaben.</p>
      <div id="wl-kacheln" class="wl-kacheln" role="tablist"></div>
      <div id="wl-inhalt" class="wl-inhalt"></div>
      <div id="wl-status" class="hf-status"></div>`,
    onOpen: (opts = {}) => { if (opts.reiter) reiter = opts.reiter; start(opts); },
  });
  const $ = (s) => w.$(s);
  const status = (t = "", f = false) => { const s = $("#wl-status"); s.textContent = t; s.classList.toggle("fehler", f); };
  const fehlerText = (err) => (err?.message || String(err));
  const zeit = (iso) => { try { return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  const datum = (iso) => { try { return new Date(iso).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }); } catch { return ""; } };
  const sicherUrl = (u) => (/^https?:\/\//i.test(String(u || "")) ? u : "#");
  const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

  async function start(opts = {}) {
    try { wuensche = (await json("/api/wunsch")).wuensche || []; } catch (err) { status(fehlerText(err), true); }
    $("#wl-kacheln").innerHTML = wuensche.map((x) => `<button type="button" class="wl-kachel${x.reiter === reiter ? " an" : ""}" data-r="${esc(x.reiter)}" role="tab"><span class="wl-icon">${x.icon}</span><span class="wl-name">${esc(x.titel)}</span><span class="wl-ok">${x.neu ? "★ neu" : "✓ eingebaut"}</span></button>`).join("");
    zeige(opts);
    setTimeout(() => { try { w.$(".wl-kachel.an")?.scrollIntoView({ block: "nearest", inline: "center" }); } catch { /* egal */ } }, 50);
  }
  $("#wl-kacheln").addEventListener("click", (e) => {
    const b = e.target.closest("[data-r]"); if (!b) return;
    reiter = b.dataset.r;
    w.$$(".wl-kachel").forEach((x) => x.classList.toggle("an", x === b));
    zeige();
  });

  const karte = (titel, inhalt) => `<div class="hf-karte"><h3>${titel}</h3>${inhalt}</div>`;
  const sprache = () => { const x = wuensche.find((v) => v.reiter === reiter); return x && x.sprache !== "–" ? `<p class="hf-hinweis wl-sag">🗣 Sag: „${esc(x.sprache)}“</p>` : ""; };
  function zeige(opts = {}) {
    status("");
    const el = $("#wl-inhalt");
    el.innerHTML = '<div class="hf-leer">Lädt …</div>';
    const fn = ANSICHTEN[reiter] || ANSICHTEN.unwetter;
    Promise.resolve(fn(el, opts)).catch((err) => { el.innerHTML = `<div class="hf-leer">${esc(fehlerText(err))}</div>`; });
  }

  // ---------- Ansichten ----------
  const ANSICHTEN = {
    async unwetter(el) {
      let d;
      try { d = await json("/api/wunsch/unwetter?frisch=1"); } catch (err) { d = { fehler: fehlerText(err), einstellungen: {} }; }
      const e = d.einstellungen || {};
      el.innerHTML = sprache() + karte(`⛈ Amtliche Warnungen${d.ort ? ` · ${esc(d.ort)}` : ""}`, d.fehler ? `<div class="hf-leer">${esc(d.fehler)}</div>` : d.warnungen.length ? d.warnungen.map((x) => `
        <div class="wl-warn" style="--wf:${x.farbe}"><b>${esc(x.stufeName)}: ${esc(x.ereignis || x.titel)}</b><span class="klein">${x.ab ? `${datum(x.ab)} ${zeit(x.ab)}` : ""}${x.bis ? ` bis ${datum(x.bis)} ${zeit(x.bis)}` : ""}</span><p>${esc(x.text)}</p>${x.tipp ? `<p class="hf-hinweis">💡 ${esc(x.tipp)}</p>` : ""}</div>`).join("") : '<div class="wl-gruen">✓ Gerade keine Warnung vom Deutschen Wetterdienst.</div>')
        + karte("⚙ Einstellungen", `
        <div class="hf-reihe"><label class="hf-feld grow">Ort (leer = dein Friday-Ort)<input id="wl-uw-ort" value="${esc(e.ort || "")}" placeholder="z. B. Hamburg oder 52.52,13.40"></label>
        <label class="hf-feld">Melden ab<select id="wl-uw-stufe"><option value="minor">jeder Warnung</option><option value="moderate">markant</option><option value="severe">Unwetter</option><option value="extreme">extrem</option></select></label></div>
        <div class="hf-reihe" style="margin-top:8px"><label class="wl-schalter"><input type="checkbox" id="wl-uw-an" ${e.an !== false ? "checked" : ""}> Per Telegram/Push melden</label><button class="hf-btn haupt" id="wl-uw-speichern" type="button">Speichern</button></div>
        <p class="hf-hinweis">Quelle: Deutscher Wetterdienst über Bright Sky (kostenlos). Friday prüft alle 15 Minuten.</p>`);
      $("#wl-uw-stufe").value = e.abStufe || "minor";
      $("#wl-uw-speichern").onclick = async () => {
        try { await json("/api/wunsch/unwetter", { body: { ort: $("#wl-uw-ort").value, abStufe: $("#wl-uw-stufe").value, an: $("#wl-uw-an").checked } }); status("Gespeichert."); zeige(); } catch (err) { status(fehlerText(err), true); }
      };
    },

    async feeds(el) {
      const d = await json("/api/wunsch/feeds");
      const namen = new Set(d.feeds.map((f) => f.url));
      el.innerHTML = sprache() + `<div class="wl-feeds">${d.feeds.map((f) => karte(`📰 ${esc(f.name)}${f.thema ? ` · ${esc(f.thema)}` : ""} <button class="hf-mini wl-rechts" data-feed-weg="${esc(f.id)}" title="Entfernen">✕</button>`,
        f.fehler ? `<div class="hf-leer">${esc(f.fehler)}</div>` : f.artikel.length ? `<ul class="wl-artikel">${f.artikel.slice(0, 6).map((a) => `<li><a href="${esc(sicherUrl(a.link))}" target="_blank" rel="noopener">${esc(a.titel)}</a>${a.at ? `<span class="klein"> · ${datum(a.at)} ${zeit(a.at)}</span>` : ""}</li>`).join("")}</ul>` : '<div class="hf-leer">Keine Artikel.</div>')).join("")}</div>`
        + karte("➕ Quelle dazu", `
        <div class="hf-reihe"><input class="hf-input grow" id="wl-fd-name" placeholder="Name, z. B. Kicker"><input class="hf-input grow" id="wl-fd-url" placeholder="Feed-Adresse (https://…)"><button class="hf-btn haupt" id="wl-fd-dazu" type="button">Dazu</button></div>
        <div class="hf-reihe" style="margin-top:8px">${d.vorschlaege.filter((v) => !namen.has(v.url)).map((v) => `<button class="hf-mini" type="button" data-vorschlag="${esc(JSON.stringify(v))}">+ ${esc(v.name)}</button>`).join("")}</div>`);
      el.onclick = async (e) => {
        const weg = e.target.closest("[data-feed-weg]"), vor = e.target.closest("[data-vorschlag]");
        try {
          if (weg) { await json(`/api/wunsch/feeds/${encodeURIComponent(weg.dataset.feedWeg)}`, { method: "DELETE" }); zeige(); }
          else if (vor) { await json("/api/wunsch/feeds", { body: JSON.parse(vor.dataset.vorschlag) }); zeige(); }
          else if (e.target.id === "wl-fd-dazu") { await json("/api/wunsch/feeds", { body: { name: $("#wl-fd-name").value, url: $("#wl-fd-url").value } }); zeige(); }
        } catch (err) { status(fehlerText(err), true); }
      };
    },

    async pakete(el) {
      const d = await json("/api/wunsch/pakete");
      el.innerHTML = sprache() + karte("📦 Meine Pakete", `
        <div class="hf-reihe"><input class="hf-input grow" id="wl-pk-nr" placeholder="Sendungsnummer"><input class="hf-input grow" id="wl-pk-name" placeholder="Name (z. B. Neue Kopfhörer)"><button class="hf-btn haupt" id="wl-pk-dazu" type="button">Verfolgen</button></div>
        <div class="hf-liste" style="margin-top:10px">${d.pakete.length ? d.pakete.map((p) => `
          <div class="hf-zeile"><span class="icon">${p.status?.code === "delivered" ? "✅" : "📦"}</span><span class="name"><b>${esc(p.name)}</b> <span class="hf-badge hf-info">${esc(p.dienst)}</span><br><span class="klein">${esc(p.status ? `${p.status.text}${p.status.ort ? ` · ${p.status.ort}` : ""}${p.status.ankunft ? ` · erwartet ${datum(p.status.ankunft)}` : ""}` : p.nummer)}</span></span>
          <a class="hf-mini" href="${esc(p.link)}" target="_blank" rel="noopener">Link</a><button class="hf-mini" data-pk-pruefen="${esc(p.id)}" type="button">↻</button><button class="hf-mini" data-pk-weg="${esc(p.id)}" type="button">✕</button></div>`).join("") : '<div class="hf-leer">Noch kein Paket. Trag eine Sendungsnummer ein oder sag: „Friday, verfolge Paket …“</div>'}</div>`)
        + karte(`🔑 DHL-Schlüssel ${d.eingerichtet ? '<span class="hf-badge hf-gut">verbunden</span>' : '<span class="hf-badge hf-warn">fehlt</span>'}`, `
        <p class="hf-hinweis">Für den Live-Status von DHL-Paketen: kostenlos auf <b>developer.dhl.com</b> registrieren → App anlegen → API „Shipment Tracking – Unified“ → API Key kopieren. Ohne Schlüssel merkt sich Friday die Nummer und zeigt den Link. Friday prüft alle 2 Stunden und meldet Änderungen.</p>
        <div class="hf-reihe"><input class="hf-input grow" id="wl-pk-key" type="password" autocomplete="off" placeholder="${d.eingerichtet ? "neuer Schlüssel (leer lassen = behalten)" : "DHL API Key"}"><button class="hf-btn" id="wl-pk-key-ok" type="button">Speichern</button></div>`);
      el.onclick = async (e) => {
        const pr = e.target.closest("[data-pk-pruefen]"), weg = e.target.closest("[data-pk-weg]");
        try {
          if (pr) { status("Frage DHL …"); await json(`/api/wunsch/pakete/${encodeURIComponent(pr.dataset.pkPruefen)}/pruefen`, { body: {} }); zeige(); }
          else if (weg) { await json(`/api/wunsch/pakete/${encodeURIComponent(weg.dataset.pkWeg)}`, { method: "DELETE" }); zeige(); }
          else if (e.target.id === "wl-pk-dazu") { status("Frage nach …"); const r = await json("/api/wunsch/pakete", { body: { nummer: $("#wl-pk-nr").value, name: $("#wl-pk-name").value } }); zeige(); if (r.hinweis) setTimeout(() => status(r.hinweis), 300); }
          else if (e.target.id === "wl-pk-key-ok") { const k = $("#wl-pk-key").value.trim(); if (!k) return; await json("/api/wunsch/pakete-schluessel", { body: { key: k } }); zeige(); }
        } catch (err) { status(fehlerText(err), true); }
      };
    },

    async mediathek(el, opts) {
      const q = opts?.q || "";
      const d = await json(`/api/wunsch/mediathek${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      const einrichten = karte(`🔌 Verbindung ${d.eingerichtet ? `<span class="hf-badge hf-gut">${d.art === "plex" ? "Plex" : "Jellyfin"} verbunden</span>` : '<span class="hf-badge hf-warn">fehlt</span>'}`, `
        <p class="hf-hinweis">Jellyfin (kostenlos, jellyfin.org) oder Plex auf dem Mac installieren und deine Filme hinzufügen. Jellyfin: Dashboard → API-Schlüssel → +. Plex: X-Plex-Token. Läuft die Jellyfin-App auf dem Fernseher, startet Friday Filme direkt dort.</p>
        <div class="hf-reihe"><select class="hf-input" id="wl-md-art" style="max-width:140px"><option value="jellyfin">Jellyfin</option><option value="plex">Plex</option></select><input class="hf-input grow" id="wl-md-url" placeholder="http://127.0.0.1:8096" value="${esc(d.url || "")}"><input class="hf-input grow" id="wl-md-key" type="password" autocomplete="off" placeholder="${d.eingerichtet ? "Schlüssel (leer = behalten)" : "API-Schlüssel / Token"}"><button class="hf-btn haupt" id="wl-md-ok" type="button">Verbinden</button></div>`);
      const suche = d.eingerichtet ? karte("🎞 In meiner Sammlung suchen", `
        <div class="hf-reihe"><input class="hf-input grow" id="wl-md-q" placeholder="z. B. Iron Man" value="${esc(q)}"><button class="hf-btn haupt" id="wl-md-suchen" type="button">Suchen</button></div>
        ${d.geraete?.length ? `<p class="hf-hinweis">Abspieler: ${d.geraete.map((g) => esc(g.name)).join(", ")}</p>` : '<p class="hf-hinweis">Kein Abspieler offen – Filme öffnen im Browser.</p>'}
        <div class="wl-filme">${(d.treffer || []).map((t) => `<div class="wl-film">${t.bild ? `<img alt="" data-bild="${esc(t.bild)}">` : '<div class="wl-film-leer">🎞</div>'}<b>${esc(t.titel)}</b><span class="klein">${esc(t.art)}${t.jahr ? ` · ${t.jahr}` : ""}</span><div class="hf-reihe">${d.geraete?.length && d.art === "jellyfin" ? `<button class="hf-mini" data-md-play="${esc(t.id)}" type="button">▶ Auf ${esc(d.geraete.find((g) => g.tv)?.name || d.geraete[0].name)}</button>` : ""}<a class="hf-mini" href="${esc(t.link)}" target="_blank" rel="noopener">Öffnen</a></div></div>`).join("") || (q ? '<div class="hf-leer">Nichts gefunden.</div>' : "")}</div>`) : "";
      el.innerHTML = sprache() + suche + einrichten;
      if (d.art) $("#wl-md-art").value = d.art;
      // Vorschaubilder mit Anmeldung laden
      w.$$("img[data-bild]").forEach(async (img) => { try { const r = await window.Friday.api(img.dataset.bild); if (r.ok) img.src = URL.createObjectURL(await r.blob()); } catch { /* egal */ } });
      el.onclick = async (e) => {
        const play = e.target.closest("[data-md-play]");
        try {
          if (play) { const r = await json("/api/wunsch/mediathek/abspielen", { body: { id: play.dataset.mdPlay } }); status(r.ok ? `Läuft auf ${r.geraet}.` : r.hinweis, !r.ok); }
          else if (e.target.id === "wl-md-suchen") zeige({ q: $("#wl-md-q").value });
          else if (e.target.id === "wl-md-ok") { status("Verbinde …"); const r = await json("/api/wunsch/mediathek", { body: { art: $("#wl-md-art").value, url: $("#wl-md-url").value, key: $("#wl-md-key").value } }); status(`Verbunden mit ${r.name}.`); zeige(); }
        } catch (err) { status(fehlerText(err), true); }
      };
      const qf = $("#wl-md-q"); if (qf) qf.onkeydown = (e) => { if (e.key === "Enter") zeige({ q: qf.value }); };
    },

    async ollama(el) {
      const d = await json("/api/wunsch/ollama");
      const cloud = d.art === "cloud";
      const badge = d.laeuft ? `<span class="hf-badge hf-gut">${cloud ? "Cloud verbunden" : "Ollama läuft"}</span>` : `<span class="hf-badge hf-warn">${esc(d.hinweis || "aus")}</span>`;
      const modi = [["aus", "Aus", "Friday nimmt Ollama nie."], ["notfall", "Notfall", "Nur wenn Claude und OpenRouter nicht können."], ["sparen", "Sparen", "Ollama zuerst, Claude nur wenn's nicht klappt. Spart Guthaben."], ["immer", "Immer", "Nur Ollama, nie Claude."]];
      const liste = [...new Set([d.modell, ...d.modelle.map((m) => m.name), ...d.empfohlen.map((m) => m.name)])];
      el.innerHTML = sprache() + karte(`🧠 Ollama als Gehirn ${badge}`, `
        <p class="hf-hinweis">Ollama ist ein zweites Gehirn für Friday. <b>Auf dem Mac</b>: kostenlos und ohne Internet, aber langsamer. <b>Cloud</b>: große Modelle auf ollama.com mit deinem eigenen Schlüssel, schnell und gut mit Werkzeugen.</p>
        <div class="hf-reihe"><label class="wl-schalter"><input type="radio" name="wl-ol-art" value="lokal" ${cloud ? "" : "checked"}> 💻 Auf dem Mac</label><label class="wl-schalter"><input type="radio" name="wl-ol-art" value="cloud" ${cloud ? "checked" : ""}> ☁️ Ollama Cloud</label></div>
        <div class="hf-reihe" style="margin-top:8px">${modi.map(([id, name, text]) => `<label class="wl-schalter" title="${esc(text)}"><input type="radio" name="wl-ol-modus" value="${id}" ${d.modus === id ? "checked" : ""}> ${name}</label>`).join("")}</div>
        <p class="hf-hinweis" id="wl-ol-modus-text">${esc(modi.find((m) => m[0] === d.modus)?.[2] || "")}</p>
        <div class="hf-reihe" style="margin-top:8px"><label class="hf-feld grow">Modell<select id="wl-ol-modell">${liste.map((m) => `<option${m === d.modell ? " selected" : ""}>${esc(m)}</option>`).join("")}</select></label>
        ${cloud ? `<label class="hf-feld grow">API-Schlüssel ${d.schluesselDa ? '<span class="hf-badge hf-gut">gespeichert</span>' : ""}<input id="wl-ol-key" type="password" autocomplete="off" placeholder="${d.schluesselDa ? "leer lassen = behalten" : "von ollama.com → Settings → Keys"}"></label>` : `<label class="hf-feld grow">Adresse<input id="wl-ol-url" value="${esc(d.lokalUrl)}"></label>`}</div>
        <div class="hf-reihe" style="margin-top:8px"><button class="hf-btn haupt" id="wl-ol-ok" type="button">Speichern</button><button class="hf-btn" id="wl-ol-test" type="button">Probe-Frage</button>${cloud && d.schluesselDa ? '<button class="hf-btn" id="wl-ol-weg" type="button">Schlüssel löschen</button>' : ""}</div>
        ${d.stats?.anzahl ? `<p class="hf-hinweis">Schon ${d.stats.anzahl}-mal mit Ollama gedacht, zuletzt ${datum(d.stats.zuletzt)} ${zeit(d.stats.zuletzt)}.${d.stats.letzter_fehler ? ` Letzter Fehler: ${esc(d.stats.letzter_fehler)}` : ""}</p>` : ""}`)
        + karte(cloud ? "📥 Ollama Cloud einrichten (einmalig)" : "📥 Auf dem Mac einrichten (einmalig)", (cloud
          ? `<ol class="wl-schritte"><li>Auf <b>ollama.com</b> anmelden.</li><li>Settings → <b>Keys</b> → neuen Schlüssel erstellen und kopieren.</li><li>Hier oben einfügen, Modus wählen, Speichern, Probe-Frage. Den Schlüssel nie in einen Chat schreiben.</li></ol>`
          : `<ol class="wl-schritte"><li>Auf <b>ollama.com</b> die Mac-App laden und öffnen.</li><li>Im Terminal: <code>ollama pull ${esc(d.modell)}</code></li><li>Modus wählen, Speichern, Probe-Frage.</li></ol>`)
          + `<ul class="wl-artikel">${d.empfohlen.map((m) => `<li><b>${esc(m.name)}</b> · ${esc(m.groesse)} – ${esc(m.text)}${d.modelle.some((x) => x.name === m.name || x.name === `${m.name}:latest`) ? ' <span class="hf-badge hf-gut">da</span>' : ""}</li>`).join("")}</ul>`);
      const wert = (n) => (el.querySelector(`input[name="${n}"]:checked`) || {}).value;
      el.querySelectorAll('input[name="wl-ol-modus"]').forEach((r) => { r.onchange = () => { $("#wl-ol-modus-text").textContent = modi.find((m) => m[0] === wert("wl-ol-modus"))?.[2] || ""; }; });
      el.querySelectorAll('input[name="wl-ol-art"]').forEach((r) => { r.onchange = async () => { try { await json("/api/wunsch/ollama", { body: { art: wert("wl-ol-art"), modus: d.modus === "aus" || wert("wl-ol-art") === "lokal" || d.schluesselDa ? d.modus : "aus" } }); zeige(); } catch (err) { status(fehlerText(err), true); } }; });
      $("#wl-ol-ok").onclick = async () => {
        const body = { art: wert("wl-ol-art"), modus: wert("wl-ol-modus"), modell: $("#wl-ol-modell").value };
        if ($("#wl-ol-url")) body.url = $("#wl-ol-url").value;
        if ($("#wl-ol-key") && $("#wl-ol-key").value.trim()) body.key = $("#wl-ol-key").value.trim();
        try { await json("/api/wunsch/ollama", { body }); status("Gespeichert."); zeige(); } catch (err) { status(fehlerText(err), true); }
      };
      $("#wl-ol-test").onclick = async () => { status("Ollama denkt …"); try { const r = await json("/api/wunsch/ollama/test", { body: {} }); status(`${r.modell} (${r.sekunden} s): ${r.text}`); } catch (err) { status(fehlerText(err), true); } };
      if ($("#wl-ol-weg")) $("#wl-ol-weg").onclick = async () => { try { await json("/api/wunsch/ollama", { body: { key: "-", modus: "aus" } }); status("Schlüssel gelöscht."); zeige(); } catch (err) { status(fehlerText(err), true); } };
    },

    async fritzbox(el) {
      let d, fehler = "";
      try { d = await json("/api/wunsch/fritzbox"); } catch (err) { fehler = fehlerText(err); }
      const balken = (jetzt, max) => (max ? `<div class="hf-balken"><i style="width:${Math.min(100, Math.round((jetzt / max) * 100))}%"></i></div>` : "");
      el.innerHTML = sprache() + karte(`📶 Internet ${d ? (d.verbunden ? '<span class="hf-badge hf-gut">online</span>' : '<span class="hf-badge hf-schlecht">getrennt</span>') : ""}`, fehler ? `<div class="hf-leer">${esc(fehler)}<br><span class="klein">Fritz!Box → Heimnetz → Netzwerk → Netzwerkeinstellungen: „Statusinformationen über UPnP übertragen“ und „Zugriff für Anwendungen zulassen“ einschalten.</span></div>` : `
        <div class="wl-werte"><div><span class="klein">Leitung (${esc(d.leitung || "?")})</span><b>${d.downMax} ↓ / ${d.upMax} ↑ Mbit/s</b></div>
        <div><span class="klein">Gerade runter</span><b>${d.downJetzt ?? "–"} Mbit/s</b>${balken(d.downJetzt || 0, d.downMax)}</div>
        <div><span class="klein">Gerade hoch</span><b>${d.upJetzt ?? "–"} Mbit/s</b>${balken(d.upJetzt || 0, d.upMax)}</div>
        <div><span class="klein">Online seit</span><b>${d.onlineSeit ? `${Math.floor(d.onlineSeit / 86400)} T ${Math.floor((d.onlineSeit % 86400) / 3600)} Std` : "–"}</b></div>
        ${d.box ? `<div><span class="klein">Box</span><b>${esc(d.box.modell)} · ${esc(d.box.version)}</b></div>` : ""}</div>`)
        + (d?.mitZugang ? karte("🛜 Gäste-WLAN", '<div id="wl-gast"><div class="hf-leer">Lädt …</div></div>') : "")
        + karte(`🔑 Zugang ${d?.mitZugang ? '<span class="hf-badge hf-gut">eingetragen</span>' : '<span class="hf-badge hf-info">optional</span>'}`, `
        <p class="hf-hinweis">Leitungswerte gehen ohne Passwort. Für Gäste-WLAN und Box-Infos: Fritz!Box → System → FRITZ!Box-Benutzer → Benutzer mit „FRITZ!Box Einstellungen“ anlegen.</p>
        <div class="hf-reihe"><input class="hf-input grow" id="wl-fb-url" placeholder="http://fritz.box:49000"><input class="hf-input grow" id="wl-fb-user" placeholder="Benutzername" autocomplete="off"><input class="hf-input grow" id="wl-fb-pw" type="password" placeholder="Passwort" autocomplete="off"><button class="hf-btn haupt" id="wl-fb-ok" type="button">Speichern</button></div>`);
      $("#wl-fb-ok").onclick = async () => { try { await json("/api/wunsch/fritzbox", { body: { url: $("#wl-fb-url").value, benutzer: $("#wl-fb-user").value, passwort: $("#wl-fb-pw").value } }); status("Gespeichert."); zeige(); } catch (err) { status(fehlerText(err), true); } };
      if (d?.mitZugang) {
        const gastZeigen = (g) => {
          $("#wl-gast").innerHTML = `<div class="wl-werte"><div><span class="klein">Name</span><b>${esc(g.ssid)}</b></div><div><span class="klein">Passwort</span><b class="wl-pw">${esc(g.passwort)}</b></div><div><span class="klein">Status</span><b>${g.an ? "an" : "aus"}</b></div></div>
            <div class="hf-reihe" style="margin-top:8px"><button class="hf-btn" id="wl-gast-kopie" type="button">Passwort kopieren</button><button class="hf-btn ${g.an ? "leise" : "haupt"}" id="wl-gast-schalt" type="button">${g.an ? "Ausschalten" : "Einschalten"}</button></div>`;
          $("#wl-gast-kopie").onclick = () => { navigator.clipboard?.writeText(g.passwort).then(() => status("Passwort kopiert.")).catch(() => status("Kopieren ging nicht.", true)); };
          $("#wl-gast-schalt").onclick = async () => { try { gastZeigen(await json("/api/wunsch/fritzbox/gast", { body: { an: !g.an } })); } catch (err) { status(fehlerText(err), true); } };
        };
        json("/api/wunsch/fritzbox/gast").then(gastZeigen).catch((err) => { $("#wl-gast").innerHTML = `<div class="hf-leer">${esc(fehlerText(err))}</div>`; });
      }
    },

    async geburtstage(el) {
      const d = await json("/api/wunsch/geburtstage");
      el.innerHTML = sprache() + karte("➕ Geburtstag eintragen", `
        <div class="hf-reihe"><input class="hf-input grow" id="wl-gb-name" placeholder="Name (z. B. Mama)"><input class="hf-input" id="wl-gb-datum" placeholder="3.3.1960" style="max-width:150px"><input class="hf-input grow" id="wl-gb-bez" placeholder="Beziehung (Mutter, Freund …)"><input class="hf-input grow" id="wl-gb-hobby" placeholder="Hobbys (für Geschenk-Ideen)"><button class="hf-btn haupt" id="wl-gb-ok" type="button">Merken</button></div>
        <p class="hf-hinweis">Friday erinnert eine Woche vorher (mit Geschenk-Ideen) und am Tag selbst per Telegram.</p>`)
        + karte("🎂 Kommende Geburtstage", `<div class="hf-liste">${d.liste.length ? d.liste.map((e) => `
          <div class="hf-zeile" style="align-items:flex-start"><span class="icon">${e.tage === 0 ? "🎉" : e.tage <= 7 ? "🎁" : "🎂"}</span><span class="name"><b>${esc(e.name)}</b>${e.beziehung ? ` <span class="hf-badge hf-info">${esc(e.beziehung)}</span>` : ""}<br><span class="klein">${e.dd}. ${MONATE[e.mm - 1]} · ${e.tage === 0 ? "heute!" : e.tage === 1 ? "morgen" : `in ${e.tage} Tagen`}${e.alter ? ` · wird ${e.alter}` : ""}</span><br><span class="klein" data-ideen="${esc(e.id)}">💡 ${e.ideen.slice(0, 3).map(esc).join(" · ")}</span></span>
          <button class="hf-mini" data-gb-ki="${esc(e.id)}" type="button" title="Persönlichere Ideen mit KI (braucht Guthaben)">🤖 Ideen</button><button class="hf-mini" data-gb-weg="${esc(e.id)}" type="button">✕</button></div>`).join("") : '<div class="hf-leer">Noch keine Geburtstage. Sag zum Beispiel: „Friday, Mama hat am 3. März Geburtstag.“</div>'}</div>`);
      el.onclick = async (e) => {
        const ki = e.target.closest("[data-gb-ki]"), weg = e.target.closest("[data-gb-weg]");
        try {
          if (ki) { status("Claude überlegt …"); const r = await json(`/api/wunsch/geburtstage/${encodeURIComponent(ki.dataset.gbKi)}/ki`, { body: {} }); w.$(`[data-ideen="${CSS.escape(ki.dataset.gbKi)}"]`).textContent = `💡 ${r.ideen.join(" · ")}`; status(""); }
          else if (weg) { await json(`/api/wunsch/geburtstage/${encodeURIComponent(weg.dataset.gbWeg)}`, { method: "DELETE" }); zeige(); }
          else if (e.target.id === "wl-gb-ok") { await json("/api/wunsch/geburtstage", { body: { name: $("#wl-gb-name").value, datum: $("#wl-gb-datum").value, beziehung: $("#wl-gb-bez").value, hobbys: $("#wl-gb-hobby").value } }); zeige(); }
        } catch (err) { status(fehlerText(err), true); }
      };
    },

    async widget(el) {
      const d = await json(`/api/wunsch/widget?adresse=${encodeURIComponent(location.origin)}`);
      const v = d.daten;
      el.innerHTML = karte("📱 So sieht dein Widget aus", `
        <div class="wl-widget"><div class="wl-widget-kopf"><b>F.R.Ai.D.A.Y</b><span>${v.wetter ? `${v.wetter.grad}° ${esc(v.wetter.text)}` : ""}</span></div>
        ${v.warnung ? `<div style="color:#ff5a4a">⛈ ${esc(v.warnung.text)}</div>` : ""}
        <div>📅 ${v.termin ? `${v.termin.heute ? "" : "Morgen "}${esc(v.termin.zeit)} ${esc(v.termin.titel)}` : "Keine Termine"}</div>
        <div>🛒 ${v.einkauf.anzahl ? `${v.einkauf.anzahl} auf der Liste: ${v.einkauf.erste.map(esc).join(", ")}` : "Einkaufsliste leer"}</div>
        ${v.aufgaben.anzahl ? `<div>✅ ${v.aufgaben.anzahl} offen: ${v.aufgaben.erste.map(esc).join(", ")}</div>` : ""}
        ${v.paket ? `<div>📦 ${esc(v.paket.name)}: ${esc(v.paket.text)}</div>` : ""}
        ${v.geburtstag ? `<div>🎂 ${esc(v.geburtstag.name)} ${v.geburtstag.tage === 0 ? "heute!" : `in ${v.geburtstag.tage} Tagen`}</div>` : ""}</div>`)
        + karte("🛠 Einrichten (5 Minuten)", `<ol class="wl-schritte">
          <li>Auf dem iPhone die kostenlose App <b>Scriptable</b> aus dem App Store laden.</li>
          <li>Hier auf „Skript kopieren“ tippen (am besten direkt am iPhone in Friday).</li>
          <li>In Scriptable oben rechts <b>+</b> → einfügen → oben den Namen „Friday“ geben → Fertig.</li>
          <li>Home-Bildschirm lange drücken → <b>+</b> → Scriptable → mittlere Größe → Widget antippen → Script: „Friday“.</li></ol>
          <p class="hf-hinweis">Das Skript enthält Fridays Adresse (${esc(location.origin)}) und deinen Kurzbefehl-Schlüssel. Nur auf deine eigenen Geräte kopieren. Das Widget aktualisiert sich etwa alle 15 Minuten und braucht Tailscale wie die App.</p>
          <div class="hf-reihe"><button class="hf-btn haupt" id="wl-wg-kopie" type="button">📋 Skript kopieren</button><button class="hf-btn" id="wl-wg-zeigen" type="button">Skript zeigen</button></div>
          <textarea id="wl-wg-text" class="hf-input hidden" readonly style="min-height:180px;font-family:monospace;font-size:11px;margin-top:8px"></textarea>`);
      $("#wl-wg-text").value = d.skript;
      $("#wl-wg-kopie").onclick = () => navigator.clipboard?.writeText(d.skript).then(() => status("Skript kopiert. Jetzt in Scriptable einfügen.")).catch(() => { $("#wl-wg-text").classList.remove("hidden"); $("#wl-wg-text").select(); status("Bitte das markierte Skript selbst kopieren."); });
      $("#wl-wg-zeigen").onclick = () => $("#wl-wg-text").classList.toggle("hidden");
    },

    async familie(el) {
      const d = await json("/api/wunsch/familie");
      const prof = (id) => d.profile.find((p) => p.id === id) || d.profile[0];
      el.innerHTML = sprache() + karte("📌 Pinnwand", `
        <div class="hf-reihe"><select class="hf-input" id="wl-fm-von" style="max-width:150px">${d.profile.map((p) => `<option value="${esc(p.id)}">${esc(p.emoji)} ${esc(p.name)}</option>`).join("")}</select><input class="hf-input grow" id="wl-fm-text" placeholder="Was soll an die Pinnwand?"><button class="hf-btn haupt" id="wl-fm-pin" type="button">Anheften</button></div>
        <div class="wl-pins">${d.pinnwand.length ? d.pinnwand.map((x) => { const p = prof(x.von); return `<div class="wl-pin${x.erledigt ? " erledigt" : ""}" style="--pf:${p.farbe}"><span>${esc(x.text)}</span><span class="klein">${esc(p.emoji)} ${esc(p.name)} · ${datum(x.at)}</span><div class="hf-reihe"><button class="hf-mini" data-pin-ok="${esc(x.id)}" data-wert="${x.erledigt ? "0" : "1"}" type="button">${x.erledigt ? "↺" : "✓"}</button><button class="hf-mini" data-pin-weg="${esc(x.id)}" type="button">✕</button></div></div>`; }).join("") : '<div class="hf-leer">Die Pinnwand ist leer.</div>'}</div>`)
        + `<div class="hf-raster">${d.profile.map((p) => karte(`<span style="color:${p.farbe}">${esc(p.emoji)} ${esc(p.name)}</span>${d.profile.length > 1 ? ` <button class="hf-mini wl-rechts" data-prof-weg="${esc(p.id)}" type="button" title="Profil löschen">✕</button>` : ""}`, `
          <div class="hf-reihe"><input class="hf-input grow" data-liste-neu="${esc(p.id)}" placeholder="Auf ${esc(p.name)}s Liste …"></div>
          <div class="hf-liste" style="margin-top:6px">${(d.listen[p.id] || []).slice().reverse().map((x) => `<div class="hf-zeile${x.erledigt ? " wl-durch" : ""}"><input type="checkbox" data-li-ok="${esc(p.id)}|${esc(x.id)}" ${x.erledigt ? "checked" : ""}><span class="name">${esc(x.text)}</span><button class="hf-mini" data-li-weg="${esc(p.id)}|${esc(x.id)}" type="button">✕</button></div>`).join("") || '<span class="klein">Leer</span>'}</div>`)).join("")}
          ${karte("➕ Profil", '<div class="hf-reihe"><input class="hf-input" id="wl-pf-emoji" placeholder="🙂" style="max-width:60px"><input class="hf-input grow" id="wl-pf-name" placeholder="Name, z. B. Carla"><button class="hf-btn" id="wl-pf-ok" type="button">Anlegen</button></div><p class="hf-hinweis">Sag auch: „Setz Windeln auf Carlas Liste“ oder „Erinner Carla morgen um 8 an den Arzt“.</p>')}</div>`;
      const neu = () => zeige();
      el.onclick = async (e) => {
        const t = e.target;
        try {
          if (t.id === "wl-fm-pin") { await json("/api/wunsch/familie/pinnwand", { body: { text: $("#wl-fm-text").value, von: d.profile.find((p) => p.id === $("#wl-fm-von").value)?.name } }); neu(); }
          else if (t.dataset.pinOk) { await json(`/api/wunsch/familie/pinnwand/${encodeURIComponent(t.dataset.pinOk)}`, { method: "PATCH", body: { erledigt: t.dataset.wert === "1" } }); neu(); }
          else if (t.dataset.pinWeg) { await json(`/api/wunsch/familie/pinnwand/${encodeURIComponent(t.dataset.pinWeg)}`, { method: "PATCH", body: { weg: true } }); neu(); }
          else if (t.dataset.liOk) { const [p, id] = t.dataset.liOk.split("|"); await json(`/api/wunsch/familie/liste/${encodeURIComponent(p)}/${encodeURIComponent(id)}`, { method: "PATCH", body: { erledigt: t.checked } }); neu(); }
          else if (t.dataset.liWeg) { const [p, id] = t.dataset.liWeg.split("|"); await json(`/api/wunsch/familie/liste/${encodeURIComponent(p)}/${encodeURIComponent(id)}`, { method: "PATCH", body: { weg: true } }); neu(); }
          else if (t.dataset.profWeg) { await json(`/api/wunsch/familie/profil/${encodeURIComponent(t.dataset.profWeg)}`, { method: "DELETE" }); neu(); }
          else if (t.id === "wl-pf-ok") { await json("/api/wunsch/familie/profil", { body: { name: $("#wl-pf-name").value, emoji: $("#wl-pf-emoji").value || "🙂" } }); neu(); }
        } catch (err) { status(fehlerText(err), true); }
      };
      el.onkeydown = async (e) => {
        if (e.key !== "Enter") return;
        const p = e.target.dataset?.listeNeu;
        try {
          if (p && e.target.value.trim()) { await json("/api/wunsch/familie/liste", { body: { profil: p, text: e.target.value } }); neu(); }
          else if (e.target.id === "wl-fm-text") $("#wl-fm-pin").click();
        } catch (err) { status(fehlerText(err), true); }
      };
    },

    async rueckblick(el) {
      const d = await json("/api/wunsch/rueckblick?jetzt=1");
      const e = d.einstellungen;
      el.innerHTML = sprache() + karte("🌙 Dein Tag bis jetzt", `<p class="wl-text">${esc(d.jetzt.text)}</p><div class="hf-reihe"><button class="hf-btn" id="wl-rb-vorlesen" type="button">🔊 Vorlesen</button></div>`)
        + karte("⚙ Einstellungen", `<div class="hf-reihe"><label class="wl-schalter"><input type="checkbox" id="wl-rb-an" ${e.an ? "checked" : ""}> Jeden Abend per Telegram</label><label class="hf-feld">Uhrzeit<select id="wl-rb-h">${[18, 19, 20, 21, 22, 23].map((h) => `<option value="${h}"${h === e.stunde ? " selected" : ""}>${h}:00</option>`).join("")}</select></label><button class="hf-btn haupt" id="wl-rb-ok" type="button">Speichern</button></div>`)
        + (d.verlauf.length ? karte("📚 Frühere Rückblicke", `<div class="hf-liste">${d.verlauf.map((r) => `<div class="hf-zeile" style="align-items:flex-start"><span class="icon">🌙</span><span class="name"><b>${datum(r.at)}</b><br><span class="klein">${esc(r.text)}</span></span></div>`).join("")}</div>`) : "");
      $("#wl-rb-ok").onclick = async () => { try { await json("/api/wunsch/rueckblick", { body: { an: $("#wl-rb-an").checked, stunde: Number($("#wl-rb-h").value) } }); status("Gespeichert."); } catch (err) { status(fehlerText(err), true); } };
      $("#wl-rb-vorlesen").onclick = () => { try { (window.Friday?.say || ((t) => speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(t), { lang: "de-DE" }))))(d.jetzt.text); } catch { /* egal */ } };
    },

    async vorlieben(el, opts) {
      const p = await json(`/api/wunsch/vorlieben${opts?.neu ? "?neu=1" : ""}`);
      const max = Math.max(1, ...p.stunden);
      const tagMax = Math.max(1, ...p.wochentage);
      const TAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
      el.innerHTML = sprache() + karte(`🧬 Was Friday über dich gelernt hat <span class="klein">· ${p.gespraeche} Gespräche, letzte ${p.tage} Tage</span>`, p.gespraeche ? `
        <div class="hf-zwei"><div><b class="klein">Lieblingsthemen</b>${p.themen.map((t) => `<div class="wl-thema"><span>${esc(t.name)}</span><div class="hf-balken"><i style="width:${Math.round((t.n / p.themen[0].n) * 100)}%"></i></div><span class="klein">${t.n}</span></div>`).join("") || '<p class="klein">noch keine</p>'}</div>
        <div><b class="klein">Wann wir reden (Uhrzeit)</b><div class="wl-saeulen">${p.stunden.map((n, h) => `<i title="${h} Uhr: ${n}" style="height:${Math.round((n / max) * 100)}%"></i>`).join("")}</div><div class="wl-achse"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>
        <b class="klein">Wochentage</b><div class="wl-saeulen kurz">${p.wochentage.map((n, i) => `<i title="${TAGE[i]}: ${n}" style="height:${Math.round((n / tagMax) * 100)}%"></i>`).join("")}</div><div class="wl-achse">${TAGE.map((t) => `<span>${t}</span>`).join("")}</div></div></div>
        ${p.funktionen.length ? `<p class="klein" style="margin-top:10px">Am meisten genutzt: ${p.funktionen.slice(0, 5).map((f) => `${f.icon} ${esc(f.name)} (${f.n})`).join(" · ")}</p>` : ""}
        ${p.haeufig.length ? `<p class="klein">Öfter gefragt: ${p.haeufig.slice(0, 5).map((f) => `„${esc(f.text)}“ ×${f.n}`).join(" · ")}</p>` : ""}
        ${p.tipps.map((t) => `<p class="hf-hinweis">💡 ${esc(t)}</p>`).join("")}` : '<div class="hf-leer">Noch zu wenig Gespräche. Je mehr wir reden, desto mehr lerne ich.</div>')
        + karte("🤖 In Worten (mit KI)", `${p.ki ? `<p class="wl-text">${esc(p.ki.text)}</p><p class="klein">Stand ${datum(p.ki.at)}</p>` : '<p class="hf-hinweis">Claude kann dir in ein paar Sätzen sagen, was es aus deinen Gewohnheiten liest, und Vorschläge machen.</p>'}
        <div class="hf-reihe"><button class="hf-btn ki" id="wl-vl-ki" type="button">Einschätzung holen</button><button class="hf-btn leise" id="wl-vl-neu" type="button">↻ Neu auswerten</button></div>
        <p class="hf-hinweis">Alles bleibt auf deinem Mac. Friday wertet nur eure eigenen Gespräche aus, einmal pro Woche.</p>`);
      $("#wl-vl-ki").onclick = async () => { status("Claude liest deine Gewohnheiten …"); try { await json("/api/wunsch/vorlieben/ki", { body: {} }); status(""); zeige(); } catch (err) { status(fehlerText(err), true); } };
      $("#wl-vl-neu").onclick = () => zeige({ neu: true });
    },
  };

  const style = document.createElement("style");
  style.textContent = `
.wl-box { width: min(1100px, 100%); }
.wl-kacheln { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.wl-kachel { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left; border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 12px; padding: 9px 11px; background: rgba(0,0,0,.3); color: var(--text); font: inherit; cursor: pointer; transition: border-color .2s, box-shadow .2s; }
.wl-kachel:hover { border-color: var(--cyan); }
.wl-kachel.an { border-color: var(--cyan); background: color-mix(in srgb, var(--cyan) 14%, transparent); box-shadow: 0 0 16px color-mix(in srgb, var(--cyan) 35%, transparent); }
.wl-icon { font-size: 22px; line-height: 1; }
.wl-name { font-size: 13px; font-weight: 600; line-height: 1.25; }
.wl-ok { font-size: 10.5px; color: #45e38b; letter-spacing: .03em; }
.wl-inhalt { display: flex; flex-direction: column; gap: 12px; }
.wl-sag { margin: 0; color: var(--cyan); }
.wl-rechts { float: right; margin-top: -3px; }
.wl-warn { border-left: 4px solid var(--wf); padding: 8px 10px; margin-bottom: 8px; background: color-mix(in srgb, var(--wf) 9%, transparent); border-radius: 8px; display: flex; flex-direction: column; gap: 3px; }
.wl-warn b { color: var(--wf); } .wl-warn p { margin: 4px 0 0; font-size: 13.5px; line-height: 1.45; }
.wl-gruen { color: #45e38b; font-weight: 600; padding: 8px 2px; }
.wl-schalter { display: inline-flex; gap: 8px; align-items: center; font-size: 14px; }
.wl-feeds { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.wl-artikel { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; }
.wl-artikel a { color: var(--text); text-decoration: none; } .wl-artikel a:hover { color: var(--cyan); }
.wl-filme { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 10px; }
.wl-film { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.wl-film img, .wl-film-leer { width: 100%; aspect-ratio: 2/3; object-fit: cover; border-radius: 10px; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.4); display: grid; place-items: center; font-size: 34px; }
.wl-werte { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
.wl-werte > div { display: flex; flex-direction: column; gap: 4px; border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 10px; padding: 8px 10px; background: rgba(0,0,0,.25); }
.wl-werte b { font-size: 15px; } .wl-pw { font-family: ui-monospace, monospace; letter-spacing: .04em; word-break: break-all; }
.wl-schritte { margin: 0 0 8px; padding-left: 20px; display: flex; flex-direction: column; gap: 5px; font-size: 14px; line-height: 1.45; }
.wl-schritte code { background: rgba(255,255,255,.08); padding: 1px 6px; border-radius: 6px; }
.wl-widget { max-width: 340px; border-radius: 22px; padding: 14px 16px; background: linear-gradient(160deg, #0b0603, #1d0f05); border: 1px solid rgba(255,138,42,.35); box-shadow: 0 0 24px rgba(255,138,42,.18); display: flex; flex-direction: column; gap: 5px; font-size: 13px; }
.wl-widget-kopf { display: flex; justify-content: space-between; margin-bottom: 4px; } .wl-widget-kopf b { color: #ff8a2a; letter-spacing: .08em; }
.wl-pins { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-top: 10px; }
.wl-pin { border-top: 3px solid var(--pf); border-radius: 10px; padding: 10px; background: color-mix(in srgb, var(--pf) 8%, rgba(0,0,0,.35)); display: flex; flex-direction: column; gap: 6px; transform: rotate(-.4deg); font-size: 14px; }
.wl-pin:nth-child(even) { transform: rotate(.5deg); }
.wl-pin.erledigt { opacity: .5; } .wl-pin.erledigt > span:first-child { text-decoration: line-through; }
.wl-durch .name { text-decoration: line-through; opacity: .55; }
.wl-text { font-size: 15px; line-height: 1.55; margin: 0 0 8px; }
.wl-thema { display: grid; grid-template-columns: 1fr 1.3fr 28px; align-items: center; gap: 8px; font-size: 13px; margin-top: 6px; }
.wl-saeulen { display: flex; align-items: flex-end; gap: 2px; height: 70px; margin-top: 6px; } .wl-saeulen.kurz { height: 46px; gap: 6px; }
.wl-saeulen i { flex: 1; min-height: 2px; border-radius: 3px 3px 0 0; background: linear-gradient(180deg, #ffcf7a, var(--cyan)); box-shadow: 0 0 8px color-mix(in srgb, var(--cyan) 40%, transparent); }
.wl-achse { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--muted); margin-bottom: 8px; }
@media (max-width: 900px) {
  .wl-kacheln { display: flex; overflow-x: auto; gap: 6px; padding-bottom: 4px; scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch; }
  .wl-kachel { flex: 0 0 auto; width: 118px; padding: 7px 9px; scroll-snap-align: start; }
  .wl-icon { font-size: 19px; } .wl-name { font-size: 12px; } .wl-ok { display: none; }
  .wl-feeds, .wl-pins { grid-template-columns: 1fr; }
  .wl-filme { grid-template-columns: repeat(2, 1fr); }
  .wl-widget { max-width: none; }
}`;
  document.head.appendChild(style);

  // v1.166.0: weitere Ansichten (neue Stern-Ideen) hängen sich hier an, siehe dashboard/sternideen.js.
  window.FridayWunsch = { open: (o) => { w.auf(o || {}); }, ansichten: ANSICHTEN, hilfen: { karte, sprache, status: (t, f) => status(t, f), zeige: () => zeige(), $, w, datum, zeit, sicherUrl } };
})();
