// F.R.Ai.D.A.Y – Neue Stern-Ideen (v1.166.0)
// Weitere Kacheln im Fenster „⭐ Meine Wunschliste“: Himmel, Spritpreise, Drucken, Radio, Podcasts, Gewohnheiten,
// Schlaf, Sprach-Trainer, Auto-Logbuch, Gäste-Modus, Briefing zum Mitnehmen. Dazu ein kleiner Player unten
// (Radio/Podcasts, Aktionen "radio_spiel:", "podcast_spiel:", "radio_stopp") und ein Hinweis-Chip im Gäste-Modus.
(() => {
  "use strict";
  const W = window.FridayWunsch, H = window.FridayHelfer;
  if (!W?.ansichten || !H) return;
  const { esc, json } = H;
  const { karte, sprache, status, zeige, $, w, datum, zeit, sicherUrl } = W.hilfen;
  const fehlerText = (err) => err?.message || String(err);
  const komma = (n, s = 1) => (n == null ? "–" : Number(n).toFixed(s).replace(".", ","));
  const leer = (t) => `<div class="hf-leer">${t}</div>`;
  const tagKurz = (t) => { try { return new Date(`${t}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short" }); } catch { return ""; } };
  const klick = (el, fn) => { el.onclick = async (e) => { try { await fn(e); } catch (err) { status(fehlerText(err), true); } }; };

  // ---------- Player (Radio + Podcasts) ----------
  const audio = new Audio();
  audio.preload = "none";
  const bar = document.createElement("div");
  bar.id = "stern-player";
  bar.className = "sp-bar hidden";
  bar.innerHTML = '<img class="sp-bild" alt=""><div class="sp-text"><small id="sp-art">Radio</small><b id="sp-name"></b></div><button type="button" id="sp-pause" class="hf-mini" title="Pause">⏸</button><input type="range" id="sp-laut" min="0" max="100" value="80" aria-label="Lautstärke"><button type="button" id="sp-zu" class="hf-mini" title="Aus">✕</button>';
  document.body.appendChild(bar);
  bar.querySelector(".sp-bild").onerror = (e) => { e.target.style.display = "none"; };
  let jetzt = null;
  function spiele(s, art = "Radio") {
    if (!s?.url || !/^(https?|blob):/i.test(s.url)) return;
    jetzt = { ...s, art };
    audio.src = s.url;
    audio.volume = Number(bar.querySelector("#sp-laut").value) / 100;
    bar.querySelector("#sp-name").textContent = s.name || "";
    bar.querySelector("#sp-art").textContent = art;
    const img = bar.querySelector(".sp-bild");
    img.style.display = s.bild ? "" : "none";
    if (s.bild) img.src = s.bild;
    bar.classList.remove("hidden");
    // erst nach Fridays Ansage starten
    setTimeout(() => audio.play().then(() => (bar.querySelector("#sp-pause").textContent = "⏸")).catch(() => { bar.querySelector("#sp-pause").textContent = "▶"; }), window.speechSynthesis?.speaking ? 1800 : 200);
    if (art === "Radio") json("/api/wunsch/radio/gehoert", { body: { id: s.id, name: s.name, url: s.url, bild: s.bild || "" } }).catch(() => {});
  }
  function stopp() { audio.pause(); audio.removeAttribute("src"); audio.load(); bar.classList.add("hidden"); jetzt = null; }
  bar.querySelector("#sp-pause").onclick = () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); };
  audio.addEventListener("play", () => (bar.querySelector("#sp-pause").textContent = "⏸"));
  audio.addEventListener("pause", () => (bar.querySelector("#sp-pause").textContent = "▶"));
  audio.addEventListener("error", () => { if (jetzt) status?.(`${jetzt.name} lässt sich gerade nicht abspielen.`, true); });
  bar.querySelector("#sp-laut").oninput = (e) => { audio.volume = Number(e.target.value) / 100; };
  bar.querySelector("#sp-zu").onclick = stopp;
  window.addEventListener("friday-stopp", () => { if (!audio.paused) audio.pause(); });

  // ---------- Gäste-Chip ----------
  const chip = document.createElement("button");
  chip.type = "button";
  chip.id = "gast-chip";
  chip.className = "gast-chip hidden";
  chip.textContent = "🛋 Gäste-Modus";
  chip.title = "Gäste-Modus ist an – Privates bleibt privat. Tippen zum Verwalten.";
  chip.onclick = () => W.open({ reiter: "gaeste" });
  document.body.appendChild(chip);
  async function gastPruefen() { try { const d = await json("/api/wunsch/gaeste"); chip.classList.toggle("hidden", !d.an); document.body.classList.toggle("gast-modus", Boolean(d.an)); } catch { /* nicht angemeldet */ } }
  setTimeout(gastPruefen, 4000);
  setInterval(gastPruefen, 60000);

  window.addEventListener("friday-aktionen", (e) => {
    const a = e.detail?.actions || [];
    const lies = (p) => { const x = a.find((v) => typeof v === "string" && v.startsWith(p)); if (!x) return null; try { return JSON.parse(decodeURIComponent(x.slice(p.length))); } catch { return null; } };
    const r = lies("radio_spiel:"), p = lies("podcast_spiel:");
    if (r) spiele(r, "Radio"); else if (p) spiele(p, "Podcast");
    if (a.includes("radio_stopp")) stopp();
    if (a.includes("gaeste_status")) setTimeout(gastPruefen, 300);
  });

  const A = W.ansichten;

  // ---------- Himmel ----------
  A.himmel = async (el) => {
    const d = await json("/api/wunsch/himmel");
    const sicht = d.planeten.filter((p) => p.sichtbar);
    el.innerHTML = sprache() + `<div class="st-raster">
      ${karte(`${d.mond.zeichen} Mond · ${esc(d.ort)}`, `<div class="st-gross">${esc(d.mond.name)}</div><div class="st-balken"><i style="width:${d.mond.beleuchtet}%"></i></div><p class="hf-hinweis">${d.mond.beleuchtet} % beleuchtet · Vollmond ${datum(d.mond.vollmond)} · Neumond ${datum(d.mond.neumond)}</p>`)}
      ${karte("☀ Sonne", `<div class="wl-werte"><div><span class="klein">Aufgang</span><b>${zeit(d.sonne.aufgang)}</b></div><div><span class="klein">Untergang</span><b>${zeit(d.sonne.untergang)}</b></div><div><span class="klein">Richtig dunkel ab</span><b>${zeit(d.sonne.dunkel)}</b></div></div>`)}
    </div>`
      + karte("🪐 Planeten", `<div class="st-planeten">${d.planeten.map((p) => `<div class="st-planet${p.sichtbar ? " an" : ""}"><span class="st-sym">${p.zeichen}</span><b>${esc(p.name)}</b><span class="klein">${p.sichtbar ? `${p.wann}, ${p.hoehe}° hoch im ${esc(p.richtung)}` : "heute nicht gut zu sehen"}</span></div>`).join("")}</div>${sicht.length ? "" : '<p class="hf-hinweis">Heute steht kein Planet günstig.</p>'}`)
      + karte("🛰 ISS-Überflüge (sichtbar)", d.iss.length ? `<div class="hf-liste">${d.iss.map((p) => `<div class="hf-zeile"><span class="icon">✦</span><span class="name"><b>${datum(p.start)}, ${zeit(p.start)} Uhr</b><br><span class="klein">${p.minuten} Min. · von ${esc(p.von)} nach ${esc(p.nach)} · bis ${p.maxHoehe}° hoch</span></span></div>`).join("")}</div>` : leer(esc(d.issFehler || "In den nächsten drei Tagen fliegt die ISS nicht sichtbar über dich.")))
      + karte("🌠 Sternschnuppen", d.sternschnuppen.length ? `<div class="hf-liste">${d.sternschnuppen.map((s) => `<div class="hf-zeile"><span class="icon">🌠</span><span class="name"><b>${esc(s.name)}</b> · ${datum(s.datum)}${s.inTagen > 0 ? ` (in ${s.inTagen} Tagen)` : " (jetzt)"}<br><span class="klein">bis ${s.proStunde}/Stunde · ${esc(s.tipp)}${s.mondStoert ? " · heller Mond stört" : ""}</span></span></div>`).join("")}</div>` : leer("In den nächsten Wochen kein großer Strom."))
      + '<p class="hf-hinweis">Alles direkt auf dem Mac berechnet. Nur die ISS-Bahndaten kommen von CelesTrak.</p>';
  };

  // ---------- Sprit ----------
  A.sprit = async (el) => {
    const d = await json("/api/wunsch/sprit");
    const e = d.einstellungen;
    const einrichten = karte(`🔑 Tankerkönig ${e.eingerichtet ? '<span class="hf-badge hf-gut">verbunden</span>' : '<span class="hf-badge hf-warn">Schlüssel fehlt</span>'}`, `
      <p class="hf-hinweis">Kostenlos: auf <b>onboarding.tankerkoenig.de</b> Name und E-Mail eintragen, der Schlüssel kommt per Mail (36 Zeichen). Hier einfügen, fertig.</p>
      <div class="hf-reihe"><input class="hf-input grow" id="st-sp-key" type="password" autocomplete="off" placeholder="${e.eingerichtet ? "neuer Schlüssel (leer = behalten)" : "00000000-0000-0000-0000-000000000000"}">
      <select class="hf-input" id="st-sp-sorte" style="max-width:130px">${Object.entries(e.sorten).map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select>
      <select class="hf-input" id="st-sp-rad" style="max-width:110px">${[2, 5, 10, 15, 25].map((r) => `<option value="${r}">${r} km</option>`).join("")}</select>
      <input class="hf-input" id="st-sp-ort" style="max-width:170px" placeholder="Ort (leer = Friday-Ort)" value="${esc(e.ort || "")}"><button class="hf-btn haupt" id="st-sp-ok" type="button">Speichern</button></div>`);
    const liste = !e.eingerichtet ? "" : d.fehler ? karte("⛽ Preise", leer(esc(d.fehler))) : karte(`⛽ ${esc(d.sorteName)} · ${esc(d.ort)} · ${d.radius} km`, d.tankstellen.length ? `<div class="hf-liste">${d.tankstellen.map((t, i) => `<div class="hf-zeile${t.offen ? "" : " wl-durch"}"><span class="icon">${i === 0 && t.offen ? "🏆" : "⛽"}</span><span class="name"><b>${esc(t.marke || t.name)}</b> ${t.offen ? "" : '<span class="hf-badge hf-schlecht">zu</span>'}<br><span class="klein">${esc(t.strasse)}, ${esc(t.ort)} · ${komma(t.km)} km</span></span><b class="st-preis">${komma(t.preis, 3).replace(/(\d)$/, "<sup>$1</sup>")} €</b><a class="hf-mini" href="https://maps.apple.com/?daddr=${t.lat},${t.lon}" target="_blank" rel="noopener">Route</a></div>`).join("")}</div><p class="hf-hinweis">${esc(d.quelle)} · Stand ${zeit(d.stand)}</p>` : leer("Keine Tankstelle im Umkreis."));
    el.innerHTML = sprache() + liste + einrichten;
    $("#st-sp-sorte").value = d.sorte || e.sorte;
    $("#st-sp-rad").value = String(d.radius || e.radius);
    klick($("#st-sp-ok"), async () => { await json("/api/wunsch/sprit", { body: { key: $("#st-sp-key").value, sorte: $("#st-sp-sorte").value, radius: Number($("#st-sp-rad").value), ort: $("#st-sp-ort").value } }); status("Gespeichert."); zeige(); });
  };

  // ---------- Drucken ----------
  A.drucken = async (el) => {
    const d = await json("/api/wunsch/drucken");
    el.innerHTML = sprache() + karte("🖨 Drucker am Mac", d.fehler ? leer(esc(d.fehler)) : d.liste.length ? `<div class="hf-reihe"><select class="hf-input grow" id="st-dr-wahl"><option value="">Standard-Drucker${d.standard ? ` (${esc(d.standard)})` : ""}</option>${d.liste.map((p) => `<option value="${esc(p.name)}">${esc(p.name)}${p.bereit ? "" : " – nicht bereit"}</option>`).join("")}</select><button class="hf-btn" id="st-dr-merk" type="button">Merken</button></div>` : leer("Am Mac ist noch kein Drucker eingerichtet: Systemeinstellungen → Drucker & Scanner → Drucker hinzufügen."))
      + karte("📄 Was soll ich drucken?", `<div class="hf-reihe">
        <button class="hf-btn haupt" data-druck="einkauf" type="button">🛒 Einkaufsliste (${d.einkauf})</button>
        <button class="hf-btn" data-druck="aufgaben" type="button">✅ Aufgaben</button></div>
        ${d.dokumente.length ? `<div class="hf-reihe" style="margin-top:8px"><select class="hf-input grow" id="st-dr-doc">${d.dokumente.map((x) => `<option value="${esc(x.id)}">${esc(x.titel)}</option>`).join("")}</select><button class="hf-btn" data-druck="dokument" type="button">Dokument drucken</button></div>` : ""}
        <label class="hf-feld" style="margin-top:10px">Packliste oder eigene Liste (eine Zeile pro Punkt)<textarea id="st-dr-text" rows="4" placeholder="Zahnbürste&#10;Ladekabel&#10;Reisepass"></textarea></label>
        <div class="hf-reihe" style="margin-top:6px"><input class="hf-input grow" id="st-dr-titel" placeholder="Überschrift, z. B. Packliste Mallorca"><button class="hf-btn" data-druck="liste" type="button">Als Liste drucken</button><button class="hf-btn" data-druck="text" type="button">Als Text drucken</button></div>`);
    if (d.gewaehlt) { const s = $("#st-dr-wahl"); if (s) s.value = d.gewaehlt; }
    klick(el, async (e) => {
      if (e.target.id === "st-dr-merk") { await json("/api/wunsch/drucken/einstellungen", { body: { drucker: $("#st-dr-wahl").value } }); status("Drucker gemerkt."); return; }
      const b = e.target.closest("[data-druck]"); if (!b) return;
      const was = b.dataset.druck;
      status("Schicke an den Drucker …");
      const r = await json("/api/wunsch/drucken", { body: { was, id: $("#st-dr-doc")?.value, text: $("#st-dr-text").value, titel: $("#st-dr-titel").value, drucker: $("#st-dr-wahl")?.value || "" } });
      status(`Gedruckt: ${r.titel} auf ${r.drucker}.`);
    });
  };

  // ---------- Radio ----------
  A.radio = async (el, opts = {}) => {
    const q = opts.q || "";
    const d = await json(`/api/wunsch/radio${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    const favUrls = new Set(d.favoriten.map((f) => f.url));
    const kachel = (s, fav) => `<div class="st-sender"><button type="button" class="st-play" data-spiel="${esc(JSON.stringify({ id: s.id, name: s.name, url: s.url, bild: s.bild }))}">${s.bild ? `<img src="${esc(sicherUrl(s.bild))}" alt="" loading="lazy" onerror="this.remove()">` : ""}<span>▶</span></button><b>${esc(s.name)}</b><span class="klein">${esc([s.land, ...(s.tags || []).slice(0, 2)].filter(Boolean).join(" · "))}</span>${fav ? `<button class="hf-mini" data-fav-weg="${esc(s.id)}" type="button">✕</button>` : favUrls.has(s.url) ? '<span class="hf-badge hf-gut">★</span>' : `<button class="hf-mini" data-fav="${esc(JSON.stringify(s))}" type="button">★ merken</button>`}</div>`;
    el.innerHTML = sprache() + karte("★ Lieblingssender", d.favoriten.length ? `<div class="st-sender-raster">${d.favoriten.map((s) => kachel(s, true)).join("")}</div><p class="hf-hinweis">Lieblingssender startest du auch ohne das Wort Radio: „Friday, spiel ${esc(d.favoriten[0].name)}“.</p>` : leer("Noch keine. Such einen Sender und tippe „★ merken“."))
      + karte(q ? `🔎 Treffer für „${esc(q)}“` : "📻 Beliebt in Deutschland", `<div class="hf-reihe"><input class="hf-input grow" id="st-ra-q" placeholder="Sender suchen, z. B. Radio Eins, 1Live, Jazz" value="${esc(q)}"><button class="hf-btn haupt" id="st-ra-suchen" type="button">Suchen</button>${jetzt ? '<button class="hf-btn" id="st-ra-stopp" type="button">⏹ Aus</button>' : ""}</div><div class="st-sender-raster" style="margin-top:10px">${d.sender.map((s) => kachel(s, false)).join("") || leer("Nichts gefunden.")}</div><p class="hf-hinweis">Über 30.000 Sender aus radio-browser.info, kostenlos.</p>`);
    $("#st-ra-q").onkeydown = (e) => { if (e.key === "Enter") A.radio(el, { q: e.target.value }); };
    klick(el, async (e) => {
      const sp = e.target.closest("[data-spiel]"), fav = e.target.closest("[data-fav]"), weg = e.target.closest("[data-fav-weg]");
      if (sp) spiele(JSON.parse(sp.dataset.spiel));
      else if (fav) { await json("/api/wunsch/radio/favorit", { body: JSON.parse(fav.dataset.fav) }); A.radio(el, { q }); }
      else if (weg) { await json(`/api/wunsch/radio/favorit/${encodeURIComponent(weg.dataset.favWeg)}`, { method: "DELETE" }); A.radio(el, { q }); }
      else if (e.target.id === "st-ra-suchen") A.radio(el, { q: $("#st-ra-q").value });
      else if (e.target.id === "st-ra-stopp") { stopp(); A.radio(el, { q }); }
    });
  };

  // ---------- Podcasts ----------
  A.podcasts = async (el, opts = {}) => {
    const q = opts.q || "";
    const d = await json(`/api/wunsch/podcasts${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    const folge = (f) => `<div class="hf-zeile"><button type="button" class="hf-mini" data-pod-spiel="${esc(JSON.stringify({ name: `${f.podcast || ""}: ${f.titel}`, url: f.audio, bild: f.bild || "" }))}">▶</button><span class="name"><b>${esc(f.titel)}</b><br><span class="klein">${esc(f.podcast || "")}${f.at ? ` · ${datum(f.at)}` : ""}${f.dauer ? ` · ${f.dauer} Min.` : ""}</span></span></div>`;
    el.innerHTML = sprache()
      + karte("🎙 Meine Abos", d.abos.length ? `<div class="st-abos">${d.abos.map((a) => `<div class="st-abo">${a.bild ? `<img src="${esc(sicherUrl(a.bild))}" alt="" loading="lazy">` : '<div class="st-abo-leer">🎙</div>'}<b>${esc(a.titel)}</b><span class="klein">${esc(a.von)}</span><div class="hf-reihe"><button class="hf-mini" data-pod-folgen="${esc(a.feed)}" data-pod-name="${esc(a.titel)}" data-pod-bild="${esc(a.bild || "")}" type="button">Folgen</button><button class="hf-mini" data-pod-weg="${esc(a.id)}" type="button">✕</button></div></div>`).join("")}</div>` : leer("Noch kein Podcast abonniert."))
      + (d.neueste?.length ? karte("🆕 Neueste Folgen", `<div class="hf-liste">${d.neueste.slice(0, 8).map(folge).join("")}</div>`) : "")
      + '<div id="st-pod-folgen"></div>'
      + karte("🔎 Podcast suchen", `<div class="hf-reihe"><input class="hf-input grow" id="st-pod-q" placeholder="z. B. Lage der Nation, Gemischtes Hack" value="${esc(q)}"><button class="hf-btn haupt" id="st-pod-suchen" type="button">Suchen</button></div>
        ${d.treffer ? `<div class="st-abos" style="margin-top:10px">${d.treffer.map((t) => `<div class="st-abo">${t.bild ? `<img src="${esc(sicherUrl(t.bild))}" alt="" loading="lazy">` : '<div class="st-abo-leer">🎙</div>'}<b>${esc(t.titel)}</b><span class="klein">${esc(t.von)}${t.genre ? ` · ${esc(t.genre)}` : ""}</span><button class="hf-mini" data-pod-abo="${esc(JSON.stringify(t))}" type="button">+ Abonnieren</button></div>`).join("") || leer("Nichts gefunden.")}</div>` : ""}
        <p class="hf-hinweis">Suche über das freie Podcast-Verzeichnis von Apple. Friday schaut alle 3 Stunden nach neuen Folgen und sagt Bescheid.</p>`);
    $("#st-pod-q").onkeydown = (e) => { if (e.key === "Enter") A.podcasts(el, { q: e.target.value }); };
    klick(el, async (e) => {
      const sp = e.target.closest("[data-pod-spiel]"), fo = e.target.closest("[data-pod-folgen]"), abo = e.target.closest("[data-pod-abo]"), weg = e.target.closest("[data-pod-weg]");
      if (sp) spiele(JSON.parse(sp.dataset.podSpiel), "Podcast");
      else if (fo) {
        const box = $("#st-pod-folgen");
        box.innerHTML = karte(`📜 ${esc(fo.dataset.podName)}`, leer("Lädt …"));
        const f = await json(`/api/wunsch/podcasts/folgen?feed=${encodeURIComponent(fo.dataset.podFolgen)}`);
        box.innerHTML = karte(`📜 ${esc(fo.dataset.podName)}`, `<div class="hf-liste">${f.folgen.slice(0, 15).map((x) => folge({ ...x, podcast: fo.dataset.podName, bild: fo.dataset.podBild })).join("") || leer("Keine Folgen.")}</div>`);
        box.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (abo) { status("Abonniere …"); await json("/api/wunsch/podcasts", { body: JSON.parse(abo.dataset.podAbo) }); status("Abonniert."); A.podcasts(el); }
      else if (weg) { await json(`/api/wunsch/podcasts/${encodeURIComponent(weg.dataset.podWeg)}`, { method: "DELETE" }); A.podcasts(el); }
      else if (e.target.id === "st-pod-suchen") A.podcasts(el, { q: $("#st-pod-q").value });
    });
  };

  // ---------- Gewohnheiten ----------
  A.gewohnheiten = async (el) => {
    const d = await json("/api/wunsch/gewohnheiten");
    el.innerHTML = sprache() + (d.liste.length ? `<div class="st-gew-raster">${d.liste.map((g) => `<div class="st-gew${g.heute ? " an" : ""}">
        <div class="st-gew-kopf"><span class="st-gew-icon">${esc(g.icon)}</span><b>${esc(g.name)}</b><button class="hf-mini wl-rechts" data-gew-weg="${esc(g.id)}" type="button" title="Löschen">✕</button></div>
        <div class="st-flamme">🔥 <b>${g.aktuell}</b> <span class="klein">${g.aktuell === 1 ? "Tag" : "Tage"} am Stück · Rekord ${g.rekord}</span></div>
        <div class="st-woche">${g.woche.map((x, i) => `<i class="${x ? "an" : ""}" title="${i === 6 ? "heute" : ""}"></i>`).join("")}</div>
        <button class="hf-btn ${g.heute ? "" : "haupt"}" data-gew="${esc(g.id)}" data-an="${g.heute ? "0" : "1"}" type="button">${g.heute ? "↶ Heute rückgängig" : "✓ Heute erledigt"}</button></div>`).join("")}</div>` : karte("🔥 Gewohnheiten", leer("Noch keine. Wähle unten eine aus oder leg eine eigene an.")))
      + karte("➕ Neue Gewohnheit", `<div class="hf-reihe">${d.vorschlaege.map((v) => `<button class="hf-mini" data-gew-neu="${esc(v.name)}" data-icon="${esc(v.icon)}" type="button">${esc(v.icon)} ${esc(v.name)}</button>`).join("")}</div>
        <div class="hf-reihe" style="margin-top:8px"><input class="hf-input grow" id="st-gew-name" placeholder="Eigene, z. B. Gitarre üben"><button class="hf-btn haupt" id="st-gew-dazu" type="button">Anlegen</button></div>
        <div class="hf-reihe" style="margin-top:8px"><label class="hf-feld">Abends erinnern, wenn eine Serie reißt<input type="time" id="st-gew-zeit" value="${esc(d.erinnerung || "")}"></label><button class="hf-btn" id="st-gew-zeit-ok" type="button">Speichern</button></div>`);
    klick(el, async (e) => {
      const ab = e.target.closest("[data-gew]"), neu = e.target.closest("[data-gew-neu]"), weg = e.target.closest("[data-gew-weg]");
      if (ab) { const r = await json(`/api/wunsch/gewohnheiten/${encodeURIComponent(ab.dataset.gew)}/abhaken`, { body: { an: ab.dataset.an === "1" } }); A.gewohnheiten(el); if (r.rekord) status(`🎉 Neuer Rekord: ${r.serie.aktuell} Tage am Stück!`); }
      else if (neu) { await json("/api/wunsch/gewohnheiten", { body: { name: neu.dataset.gewNeu, icon: neu.dataset.icon } }); A.gewohnheiten(el); }
      else if (weg) { await json(`/api/wunsch/gewohnheiten/${encodeURIComponent(weg.dataset.gewWeg)}`, { method: "DELETE" }); A.gewohnheiten(el); }
      else if (e.target.id === "st-gew-dazu") { await json("/api/wunsch/gewohnheiten", { body: { name: $("#st-gew-name").value } }); A.gewohnheiten(el); }
      else if (e.target.id === "st-gew-zeit-ok") { await json("/api/wunsch/gewohnheiten/einstellungen", { body: { erinnerung: $("#st-gew-zeit").value } }); status("Gespeichert."); }
    });
  };

  // ---------- Schlaf ----------
  A.schlaf = async (el) => {
    const d = await json("/api/wunsch/schlaf");
    const max = Math.max(d.ziel * 60 + 60, ...d.woche.map((x) => x.minuten));
    el.innerHTML = sprache() + karte(`😴 Diese Woche${d.schnitt ? ` · Schnitt ${esc(d.schnittText)}` : ""}`, `
      <div class="st-schlaf-zahlen">${d.woche.map((x) => `<span class="klein">${x.minuten ? komma(x.minuten / 60) : ""}</span>`).join("")}</div>
      <div class="st-schlaf">${d.woche.map((x) => `<i style="height:${Math.max(2, Math.round((x.minuten / max) * 100))}%" class="${x.minuten && x.minuten < d.ziel * 60 - 30 ? "knapp" : ""}"></i>`).join("")}<div class="st-ziel" style="bottom:${Math.round(((d.ziel * 60) / max) * 100)}%"><span>Ziel ${komma(d.ziel)} h</span></div></div>
      <div class="st-schlaf-zahlen">${d.woche.map((x) => `<span class="klein">${tagKurz(x.tag)}</span>`).join("")}</div>
      <div class="hf-reihe" style="margin-top:10px">${d.offen ? `<span class="hf-badge hf-info">🌙 seit ${zeit(d.offen)} Uhr im Bett</span><button class="hf-btn haupt" data-schlaf="morgen" type="button">☀ Guten Morgen</button>` : '<button class="hf-btn haupt" data-schlaf="nacht" type="button">🌙 Gute Nacht</button>'}
      <label class="hf-feld">Ziel (Stunden)<select id="st-sl-ziel">${[6, 6.5, 7, 7.5, 8, 8.5, 9].map((z) => `<option value="${z}">${komma(z)}</option>`).join("")}</select></label></div>
      <p class="hf-hinweis">Abends „Friday, gute Nacht“, morgens „Friday, guten Morgen“ sagen. Friday notiert die Zeiten und liest dir morgens die Schlafdauer und das Kurz-Briefing vor.</p>`)
      + (d.liste.length ? karte("📋 Letzte Nächte", `<div class="hf-liste">${d.liste.slice(0, 10).map((n) => `<div class="hf-zeile"><span class="icon">🛏</span><span class="name"><b>${datum(`${n.tag}T12:00:00`)}</b> · ${komma(n.minuten / 60)} h<br><span class="klein">${zeit(n.von)} bis ${zeit(n.bis)} Uhr</span></span><button class="hf-mini" data-schlaf-weg="${esc(n.tag)}" type="button">✕</button></div>`).join("")}</div>`) : "");
    $("#st-sl-ziel").value = String(d.ziel);
    $("#st-sl-ziel").onchange = async (e) => { try { await json("/api/wunsch/schlaf", { body: { ziel: Number(e.target.value) } }); A.schlaf(el); } catch (err) { status(fehlerText(err), true); } };
    klick(el, async (e) => {
      const b = e.target.closest("[data-schlaf]"), weg = e.target.closest("[data-schlaf-weg]");
      if (b) { await json("/api/wunsch/schlaf", { body: { aktion: b.dataset.schlaf } }); A.schlaf(el); }
      else if (weg) { await json(`/api/wunsch/schlaf/${encodeURIComponent(weg.dataset.schlafWeg)}`, { method: "DELETE" }); A.schlaf(el); }
    });
  };

  // ---------- Sprach-Trainer ----------
  A.sprachtrainer = async (el) => {
    const d = await json("/api/wunsch/sprachtrainer");
    el.innerHTML = sprache() + karte(`🗣 ${esc(d.spracheName)} · ${d.gelernt} von ${d.gesamt} Wörtern`, `
      <div class="hf-reihe"><select class="hf-input" id="st-tr-sprache" style="max-width:170px">${Object.entries(d.sprachen).map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select>
      <button class="hf-btn haupt" id="st-tr-start" type="button">🎤 Jetzt abfragen</button></div>
      <div class="st-faecher">${d.faecher.map((n, i) => `<div><b>${n}</b><span class="klein">Fach ${i + 1}</span></div>`).join("")}</div>
      <p class="hf-hinweis">Heute dran: ${d.faelligAlt} zum Wiederholen${d.neuHeute.length ? ` + ${d.neuHeute.length} neue Wörter` : ""}. Richtig → ein Fach weiter (seltener gefragt), falsch → zurück in Fach 1.</p>`)
      + (d.neuHeute.length ? karte("✨ Neue Wörter für heute", `<div class="wl-werte">${d.neuHeute.map((x) => `<div><span class="klein">${esc(x.de)}</span><b>${esc(x.fremd)}</b></div>`).join("")}</div>`) : "")
      + (d.verlauf.length ? karte("📈 Letzte Runden", `<div class="wl-saeulen kurz">${d.verlauf.map((v) => `<i style="height:${Math.round((v.richtig / Math.max(1, v.gesamt)) * 100)}%" title="${esc(v.tag)}: ${v.richtig}/${v.gesamt}"></i>`).join("")}</div>`) : "")
      + '<div class="hf-reihe"><button class="hf-mini" id="st-tr-reset" type="button">Fortschritt dieser Sprache löschen</button></div>';
    $("#st-tr-sprache").value = d.sprache;
    $("#st-tr-sprache").onchange = async (e) => { try { await json("/api/wunsch/sprachtrainer", { body: { sprache: e.target.value } }); A.sprachtrainer(el); } catch (err) { status(fehlerText(err), true); } };
    klick(el, async (e) => {
      if (e.target.id === "st-tr-start") { w.zu?.(); if (window.Friday?.send) window.Friday.send("Frag mich Vokabeln ab", { stimme: true }); else status("Sag: „Friday, frag mich Vokabeln ab“."); }
      else if (e.target.id === "st-tr-reset") { await json("/api/wunsch/sprachtrainer", { body: { zuruecksetzen: true } }); A.sprachtrainer(el); }
    });
  };

  // ---------- Auto-Logbuch ----------
  A.fahrzeug = async (el) => {
    const d = await json("/api/wunsch/fahrzeug");
    const a = d.autos[0];
    const termin = (k) => { const t = a.termine[k]; const farbe = !t ? "" : t.tage < 0 ? "hf-schlecht" : t.tage <= 30 ? "hf-warn" : "hf-gut"; return `<label class="hf-feld"><span>${d.arten[k].icon} ${esc(d.arten[k].name)} ${t ? `<span class="hf-badge ${farbe}">${t.tage < 0 ? `${-t.tage} Tage drüber` : t.tage === 0 ? "heute" : `in ${t.tage} Tagen`}</span>` : ""}</span><input type="date" data-termin="${k}" value="${esc(t?.datum || "")}"></label>`; };
    el.innerHTML = sprache() + karte(`🚗 ${esc(a.name)}${a.kennzeichen ? ` · ${esc(a.kennzeichen)}` : ""}`, `
      <div class="hf-reihe"><input class="hf-input grow" id="st-fz-name" value="${esc(a.name)}" placeholder="Name"><input class="hf-input" id="st-fz-kz" style="max-width:150px" value="${esc(a.kennzeichen)}" placeholder="Kennzeichen"></div>
      <div class="st-termine">${Object.keys(d.arten).map(termin).join("")}</div>
      <div class="hf-reihe" style="margin-top:8px"><button class="hf-btn haupt" id="st-fz-ok" type="button">Speichern</button></div>
      ${a.reifenTipp ? `<p class="hf-hinweis">🛞 ${esc(a.reifenTipp)}</p>` : ""}
      <p class="hf-hinweis">Friday erinnert 30 Tage, eine Woche und einen Tag vorher per Telegram/Push.</p>`)
      + karte(`⛽ Tankbuch${a.verbrauch ? ` · Ø ${komma(a.verbrauch.l100)} l/100 km${a.verbrauch.euro100 ? ` · ${komma(a.verbrauch.euro100, 2)} €/100 km` : ""}` : ""}`, `
      <div class="hf-reihe"><input class="hf-input" id="st-fz-l" inputmode="decimal" placeholder="Liter" style="max-width:100px"><input class="hf-input" id="st-fz-e" inputmode="decimal" placeholder="Euro" style="max-width:100px"><input class="hf-input" id="st-fz-km" inputmode="numeric" placeholder="km-Stand" style="max-width:130px"><label class="wl-schalter"><input type="checkbox" id="st-fz-voll" checked> vollgetankt</label><button class="hf-btn haupt" id="st-fz-tank" type="button">Eintragen</button></div>
      <div class="hf-liste" style="margin-top:10px">${a.tank.length ? a.tank.slice(0, 12).map((t) => `<div class="hf-zeile"><span class="icon">⛽</span><span class="name"><b>${komma(t.liter, 2)} l</b>${t.euro ? ` · ${komma(t.euro, 2)} €` : ""}${t.euro ? ` <span class="klein">(${komma(t.euro / t.liter, 3)} €/l)</span>` : ""}<br><span class="klein">${datum(`${t.datum}T12:00:00`)}${t.km ? ` · ${Number(t.km).toLocaleString("de-DE")} km` : ""}${t.voll ? "" : " · nicht voll"}</span></span><button class="hf-mini" data-tank-weg="${esc(t.id)}" type="button">✕</button></div>`).join("") : leer("Noch nichts getankt. Sag: „Ich habe 42 Liter für 70 Euro getankt, Kilometerstand 85.000.“")}</div>`);
    klick(el, async (e) => {
      const weg = e.target.closest("[data-tank-weg]");
      if (weg) { await json(`/api/wunsch/fahrzeug/tanken/${encodeURIComponent(weg.dataset.tankWeg)}`, { method: "DELETE" }); A.fahrzeug(el); }
      else if (e.target.id === "st-fz-ok") { const termine = {}; w.$$("[data-termin]").forEach((i) => { termine[i.dataset.termin] = i.value || null; }); await json("/api/wunsch/fahrzeug", { body: { id: a.id, name: $("#st-fz-name").value, kennzeichen: $("#st-fz-kz").value, termine } }); status("Gespeichert."); A.fahrzeug(el); }
      else if (e.target.id === "st-fz-tank") { await json("/api/wunsch/fahrzeug/tanken", { body: { auto: a.id, liter: $("#st-fz-l").value, euro: $("#st-fz-e").value, km: $("#st-fz-km").value, voll: $("#st-fz-voll").checked } }); A.fahrzeug(el); }
    });
  };

  // ---------- Gäste-Modus ----------
  A.gaeste = async (el) => {
    const d = await json("/api/wunsch/gaeste");
    el.innerHTML = sprache() + karte(`🛋 Gäste-Modus ${d.an ? '<span class="hf-badge hf-warn">AN</span>' : '<span class="hf-badge hf-info">aus</span>'}`, `
      <div class="st-gast ${d.an ? "an" : ""}"><button class="hf-btn haupt st-gast-knopf" id="st-ga-schalt" type="button">${d.an ? "Gäste-Modus ausschalten" : "Gäste-Modus einschalten"}</button>${d.an && d.seit ? `<span class="klein">an seit ${zeit(d.seit)} Uhr</span>` : ""}</div>
      <div class="wl-werte" style="margin-top:10px"><div><span class="klein">Erlaubt</span><b>💡 Licht · 🎵 Musik · 📻 Radio · 📺 Fernseher · ⛅ Wetter · 🎲 Spiele · Wissen</b></div><div><span class="klein">Bleibt privat</span><b>📅 Termine · ✉ Mails · 💬 Nachrichten · 💶 Konten · 🧠 Gedächtnis · 📁 Archiv · 👪 Familie</b></div></div>
      <p class="hf-hinweis">Auch Claude bekommt im Gäste-Modus weder deinen Gesprächsverlauf noch dein Gedächtnis noch private Werkzeuge. Gespräche werden nicht gespeichert.</p>`)
      + karte("⚙ Schutz", `<div class="hf-reihe"><label class="hf-feld">PIN zum Ausschalten per Sprache (4–8 Ziffern, leer = ohne)<input id="st-ga-pin" type="password" inputmode="numeric" autocomplete="off" placeholder="${d.mitPin ? "•••• gesetzt (neu eingeben zum Ändern)" : "z. B. 2580"}"></label>
        <label class="hf-feld">Automatisch aus nach<select id="st-ga-auto"><option value="0">nie</option>${[2, 4, 6, 8, 12, 24].map((h) => `<option value="${h}">${h} Stunden</option>`).join("")}</select></label><button class="hf-btn" id="st-ga-ok" type="button">Speichern</button></div>
        <p class="hf-hinweis">Mit PIN sagt man zum Ausschalten: „Friday, Gästemodus aus 2580“. Hier im Fenster geht es immer per Knopf.</p>`);
    $("#st-ga-auto").value = String(d.automatischAus || 0);
    klick(el, async (e) => {
      if (e.target.id === "st-ga-schalt") { await json("/api/wunsch/gaeste", { body: { an: !d.an } }); gastPruefen(); A.gaeste(el); }
      else if (e.target.id === "st-ga-ok") { const pin = $("#st-ga-pin").value; await json("/api/wunsch/gaeste", { body: { automatischAus: Number($("#st-ga-auto").value), ...(pin ? { pin } : {}) } }); status("Gespeichert."); A.gaeste(el); }
    });
  };

  // ---------- Briefing zum Mitnehmen ----------
  A.briefingaudio = async (el) => {
    const d = await json("/api/wunsch/briefingaudio");
    const e = d.einstellungen;
    el.innerHTML = sprache() + karte("🎧 Briefing als Audio-Datei", `
      ${d.mac ? "" : '<p class="hf-hinweis hf-warn">Einsprechen klappt nur, wenn Friday auf dem Mac läuft.</p>'}
      <div class="hf-reihe"><label class="wl-schalter"><input type="checkbox" id="st-ba-an" ${e.an ? "checked" : ""}> Jeden Morgen automatisch</label>
      <label class="hf-feld">um<input type="time" id="st-ba-zeit" value="${esc(e.uhrzeit)}"></label>
      <label class="hf-feld">Stimme<select id="st-ba-stimme">${(d.stimmen.length ? d.stimmen : [e.stimme]).map((s) => `<option>${esc(s)}</option>`).join("")}</select></label>
      <button class="hf-btn" id="st-ba-ok" type="button">Speichern</button><button class="hf-btn haupt" id="st-ba-jetzt" type="button">🎙 Jetzt einsprechen</button></div>
      <p class="hf-hinweis">${d.icloud ? "Die Datei landet in <b>iCloud Drive → Friday → Briefings</b>. Auf dem iPhone: App <b>Dateien</b> → iCloud Drive → Friday → Briefings, antippen und im Auto hören." : "iCloud Drive ist am Mac nicht eingeschaltet, darum liegt die Datei nur im Friday-Archiv (Briefings). Tipp: Systemeinstellungen → Apple-ID → iCloud → iCloud Drive an."} Text: das heutige Morgenbriefing oder, ohne Guthaben, das kostenlose Kurz-Briefing.</p>`)
      + karte("📂 Letzte Briefings", d.dateien.length ? `<div class="hf-liste">${d.dateien.map((f) => `<div class="hf-zeile"><span class="icon">🎧</span><span class="name"><b>${datum(`${f.tag}T12:00:00`)}</b><br><span class="klein">${f.kb} KB</span></span><button class="hf-mini" data-ba-hoer="${esc(f.datei)}" type="button">▶ Hören</button><button class="hf-mini" data-ba-laden="${esc(f.datei)}" type="button">⬇</button></div>`).join("")}</div>` : leer("Noch kein Audio-Briefing."))
      + (d.zuletzt?.text ? karte("📝 Text vom letzten Mal", `<p class="wl-text">${esc(d.zuletzt.text)}</p>`) : "");
    if (e.stimme) $("#st-ba-stimme").value = e.stimme;
    const blob = async (datei, laden) => { const r = await window.Friday.api(`/api/wunsch/briefingaudio/datei/${encodeURIComponent(datei)}${laden ? "?laden=1" : ""}`); if (!r.ok) throw new Error("Datei nicht gefunden."); return URL.createObjectURL(await r.blob()); };
    klick(el, async (ev) => {
      const h = ev.target.closest("[data-ba-hoer]"), l = ev.target.closest("[data-ba-laden]");
      if (h) spiele({ name: `Briefing ${h.dataset.baHoer.slice(9, 19)}`, url: await blob(h.dataset.baHoer) }, "Briefing");
      else if (l) { const u = await blob(l.dataset.baLaden, true); const a = document.createElement("a"); a.href = u; a.download = l.dataset.baLaden; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
      else if (ev.target.id === "st-ba-ok") { await json("/api/wunsch/briefingaudio", { body: { an: $("#st-ba-an").checked, uhrzeit: $("#st-ba-zeit").value, stimme: $("#st-ba-stimme").value } }); status("Gespeichert."); }
      else if (ev.target.id === "st-ba-jetzt") { status("Friday spricht das Briefing ein …"); const z = await json("/api/wunsch/briefingaudio/jetzt", { body: {} }); status(z.icloud ? "Fertig, liegt in iCloud Drive → Friday → Briefings." : "Fertig, liegt im Friday-Archiv."); A.briefingaudio(el); }
    });
  };

  const style = document.createElement("style");
  style.textContent = `
.st-raster { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.st-gross { font-size: 20px; font-weight: 700; color: var(--u-titel, var(--cyan)); margin-bottom: 6px; text-transform: capitalize; }
.st-balken { height: 8px; border-radius: 99px; background: rgba(255,255,255,.08); overflow: hidden; } .st-balken i { display: block; height: 100%; background: linear-gradient(90deg, #ffcf7a, var(--cyan)); box-shadow: 0 0 10px var(--cyan); }
.st-planeten { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
.st-planet { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--u-rand-soft, var(--line)); opacity: .5; } .st-planet.an { opacity: 1; border-color: var(--cyan); box-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 25%, transparent); }
.st-sym { font-size: 22px; color: var(--cyan); }
.st-preis { font: 700 17px ui-monospace, Menlo, monospace; color: var(--cyan); white-space: nowrap; } .st-preis sup { font-size: 10px; }
.st-sender-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.st-sender { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; font-size: 13px; } .st-sender b { line-height: 1.25; }
.st-play { position: relative; width: 100%; aspect-ratio: 1; border-radius: 12px; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.35); cursor: pointer; overflow: hidden; display: grid; place-items: center; padding: 0; }
.st-play img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; padding: 12%; box-sizing: border-box; }
.st-play span { position: relative; font-size: 22px; color: #fff; background: color-mix(in srgb, var(--cyan) 70%, transparent); width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; box-shadow: 0 0 16px var(--cyan); opacity: .9; }
.st-abos { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.st-abo { display: flex; flex-direction: column; gap: 4px; font-size: 13px; } .st-abo img, .st-abo-leer { width: 100%; aspect-ratio: 1; border-radius: 12px; object-fit: cover; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.35); display: grid; place-items: center; font-size: 32px; }
.st-gew-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.st-gew { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 14px; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.25); } .st-gew.an { border-color: #45e38b; box-shadow: 0 0 14px rgba(69,227,139,.2); }
.st-gew-kopf { display: flex; align-items: center; gap: 8px; } .st-gew-icon { font-size: 22px; } .st-gew-kopf .wl-rechts { margin-left: auto; }
.st-flamme b { font-size: 26px; color: var(--cyan); text-shadow: 0 0 12px var(--cyan); }
.st-woche { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; } .st-woche i { height: 10px; border-radius: 4px; background: rgba(255,255,255,.08); } .st-woche i.an { background: linear-gradient(90deg, #ffcf7a, var(--cyan)); }
.st-schlaf { position: relative; display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; height: 120px; align-items: end; border-bottom: 1px solid var(--u-rand-soft, var(--line)); }
.st-schlaf i { justify-self: center; width: 70%; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, #9db8ff, #4f6dff); box-shadow: 0 0 10px rgba(79,109,255,.4); } .st-schlaf i.knapp { background: linear-gradient(180deg, #ffcf7a, #ff8a2a); }
.st-schlaf-zahlen { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; text-align: center; margin: 3px 0; }
.st-ziel { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--muted); pointer-events: none; } .st-ziel span { position: absolute; right: 0; top: -15px; font-size: 10px; color: var(--muted); }
.st-faecher { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 10px; } .st-faecher div { display: flex; flex-direction: column; align-items: center; padding: 6px; border-radius: 10px; border: 1px solid var(--u-rand-soft, var(--line)); } .st-faecher b { font-size: 18px; color: var(--cyan); }
.st-termine { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin-top: 10px; }
.st-gast { display: flex; align-items: center; gap: 12px; } .st-gast.an .st-gast-knopf { background: linear-gradient(90deg, #ff8a2a, #ffb347); color: #1a0d03; }
.sp-bar { position: fixed; left: 16px; bottom: 16px; z-index: 9000; display: flex; align-items: center; gap: 10px; padding: 8px 12px; max-width: min(420px, calc(100vw - 32px)); border-radius: 16px; background: rgba(10,6,3,.82); border: 1px solid color-mix(in srgb, var(--cyan) 50%, transparent); box-shadow: 0 0 22px color-mix(in srgb, var(--cyan) 25%, transparent); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.sp-bar.hidden, .gast-chip.hidden { display: none; }
.sp-bild { width: 38px; height: 38px; border-radius: 8px; object-fit: contain; background: #000; }
.sp-text { display: flex; flex-direction: column; min-width: 0; flex: 1; } .sp-text small { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--cyan); } .sp-text b { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#sp-laut { width: 70px; accent-color: var(--cyan); }
.gast-chip { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 9001; border: 1px solid #ffb347; background: rgba(40,20,4,.85); color: #ffcf7a; border-radius: 999px; padding: 6px 14px; font: 600 13px inherit; cursor: pointer; box-shadow: 0 0 18px rgba(255,160,40,.35); }
@media (max-width: 900px) {
  .st-raster { grid-template-columns: 1fr; }
  .sp-bar { left: 12px; right: 12px; bottom: calc(76px + env(safe-area-inset-bottom)); max-width: none; }
  .gast-chip { top: calc(8px + env(safe-area-inset-top)); }
  .st-sender-raster, .st-abos { grid-template-columns: repeat(2, 1fr); }
}`;
  document.head.appendChild(style);
})();
