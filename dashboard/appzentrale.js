// F.R.Ai.D.A.Y App-Zentrale (v1.139.0, zuerst nur in Eve):
// 21 Apps und Dienste an einem Ort – Apple, Cloud, Filme & Musik, Zuhause, Einkaufen.
// Jede Kachel sagt ehrlich, was geht: "Echte Daten", "Öffnen & Starten" oder "Nur öffnen".
// Friday bezahlt, kauft und überweist nie selbst. In Eve werden Mac/TV/Kurzbefehle nur simuliert.
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  const istIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let stand = null;
  let gruppe = "alle";
  let auswahl = null;
  let ladeNr = 0;

  const w = H.fenster({
    id: "apps", titel: "🧩 App-Zentrale", klasse: "az-box",
    html: `
      <div class="az-kopf">
        <div class="hf-tabs" id="az-tabs" role="tablist"></div>
        <span class="az-legende"><i class="az-l echt"></i>Echte Daten <i class="az-l mac"></i>Öffnen &amp; Starten <i class="az-l link"></i>Nur öffnen</span>
      </div>
      <div id="az-eve" class="az-eve hidden">🧪 Eve-Test: Am Mac öffnen, am Fernseher starten und Kurzbefehle werden nur simuliert (steht im Logbuch). Lesen und „Öffnen“ hier auf dem Gerät sind echt.</div>
      <div id="az-status" class="hf-status"></div>
      <div id="az-raster" class="az-raster"></div>
      <div id="az-detail" class="hf-karte az-detail hidden" aria-live="polite"></div>`,
    onOpen: (opts) => oeffne(opts || {}),
  });
  const $ = (s) => w.$(s);
  const status = (t, f = false) => { const s = $("#az-status"); s.textContent = t || ""; s.classList.toggle("fehler", f); };
  const zeit = (iso) => { if (!iso) return ""; const d = new Date(iso); return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
  const uhr = (iso) => (iso ? new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "");
  const groesse = (b) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
  const app = (id) => stand?.apps.find((a) => a.id === id);

  async function oeffne({ id, hervor } = {}) {
    await laden();
    if (id && app(id)) { gruppe = "alle"; tabs(); kacheln(); zeige(id, { hervor }); }
    else if (stand) { tabs(); kacheln(); }
  }

  async function laden() {
    status("Lade Apps …");
    try {
      stand = await json("/api/apps");
      status(stand.mac ? "" : "Der Mac ist gerade nicht verbunden. Apple-Apps, Drive und OneDrive brauchen den Mac.");
      $("#az-eve").classList.toggle("hidden", !stand.eve);
      tabs(); kacheln();
    } catch (err) {
      status(err.status === 423 ? `🔒 ${err.message}` : err.message, true);
      $("#az-raster").innerHTML = "";
    }
  }

  function tabs() {
    if (!stand) return;
    const t = [{ id: "alle", name: `Alle (${stand.apps.length})` }, ...stand.gruppen];
    $("#az-tabs").innerHTML = t.map((g) => `<button class="hf-tab${g.id === gruppe ? " an" : ""}" data-gruppe="${esc(g.id)}">${esc(g.name)}</button>`).join("");
  }
  const symbol = (a, gross = false) => `<span class="az-ico${gross ? " gross" : ""}" style="--az-farbe:${esc(a.farbe)}">${esc(a.zeichen)}</span>`;
  function kacheln() {
    if (!stand) return;
    const liste = stand.apps.filter((a) => gruppe === "alle" || a.gruppe === gruppe);
    $("#az-raster").innerHTML = liste.map((a) => `
      <button class="az-kachel${auswahl === a.id ? " an" : ""}" data-app="${esc(a.id)}" aria-pressed="${auswahl === a.id}">
        ${symbol(a)}
        <span class="az-name"><b>${esc(a.name)}</b><small><i class="az-punkt${a.an ? " gut" : ""}"></i>${esc(a.text)}</small></span>
        <span class="az-art ${esc(a.art)}">${esc(a.artText)}</span>
      </button>`).join("");
  }

  function knoepfe(a) {
    const b = [];
    if (istIos && a.ios) b.push(`<a class="hf-btn haupt" href="${esc(a.ios)}">📱 App öffnen</a>`);
    b.push(`<a class="hf-btn ${istIos && a.ios ? "" : "haupt"} az-oeffnen" href="${esc(a.web)}" target="_blank" rel="noopener noreferrer">↗ ${istIos && a.ios ? "Website" : "Öffnen"}</a>`);
    if (a.amMac) b.push(`<button class="hf-btn" data-tu="mac_oeffnen">💻 Am Mac öffnen</button>`);
    if (a.amTv) b.push(`<button class="hf-btn" data-tu="tv_starten">📺 Am Fernseher</button>`);
    for (const x of a.extra || []) b.push(`<a class="hf-btn leise" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.text)}</a>`);
    return `<div class="hf-reihe az-knoepfe">${b.join("")}</div>`;
  }

  async function zeige(id, { hervor = false } = {}) {
    const a = app(id);
    if (!a) return;
    auswahl = id;
    kacheln();
    const box = $("#az-detail");
    box.classList.remove("hidden");
    box.innerHTML = `
      <div class="az-dkopf">${symbol(a, true)}<div><h3>${esc(a.name)}</h3><span class="az-art ${esc(a.art)}">${esc(a.artText)}</span></div><button class="hf-mini az-zu" aria-label="Zuklappen">✕</button></div>
      <p class="az-kann">${esc(a.kann)}</p>
      ${a.geld ? `<p class="az-geld">🛡 Friday bezahlt, kauft, bietet und überweist nie selbst. Hier nur öffnen und selbst entscheiden.</p>` : ""}
      ${knoepfe(a)}
      <p class="hf-status" id="az-msg"></p>
      <div id="az-inhalt"><p class="hf-hinweis">${a.art === "link" ? "" : "Lade …"}</p></div>`;
    if (hervor) box.querySelector(".az-oeffnen")?.classList.add("az-puls");
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const nr = ++ladeNr;
    try {
      const d = await json(`/api/apps/${encodeURIComponent(id)}`);
      if (nr !== ladeNr) return;
      $("#az-inhalt").innerHTML = inhalt(id, d);
    } catch (err) {
      if (nr === ladeNr) $("#az-inhalt").innerHTML = `<p class="hf-status fehler">${esc(err.message)}</p>`;
    }
  }

  const zeilen = (arr, fn, leer) => (arr?.length ? `<ul class="hf-liste">${arr.map(fn).join("")}</ul>` : `<p class="hf-leer">${esc(leer)}</p>`);
  const zeile = (icon, name, klein = "", rechts = "") => `<li class="hf-zeile"><span class="icon">${icon}</span><span class="name">${name}${klein ? `<br><span class="klein">${klein}</span>` : ""}</span>${rechts}</li>`;
  const chips = (arr) => `<div class="az-chips">${arr.map((x) => `<span class="az-chip">${esc(x)}</span>`).join("")}</div>`;
  const link = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;

  function inhalt(id, d) {
    const h = d.hinweis ? `<p class="hf-hinweis">${esc(d.hinweis)}</p>` : "";
    switch (id) {
      case "kalender":
        if (!d.heute) return h;
        return `<div class="hf-zwei"><div><h3>Heute</h3>${zeilen(d.heute, (t) => zeile("📅", esc(t.titel), `${t.ganz ? "ganztägig" : uhr(t.start)} · ${esc(t.kalender || "")}`), "Heute keine Termine.")}</div>
          <div><h3>Morgen</h3>${zeilen(d.morgen, (t) => zeile("📅", esc(t.titel), `${t.ganz ? "ganztägig" : uhr(t.start)} · ${esc(t.kalender || "")}`), "Morgen keine Termine.")}</div></div>`;
      case "erinnerungen":
        if (!d.erinnerungen) return h;
        return zeilen(d.erinnerungen, (e) => zeile("☑", esc(e.titel), [e.liste, e.faellig ? `fällig ${zeit(e.faellig)}` : ""].filter(Boolean).map(esc).join(" · ")), "Keine offenen Erinnerungen. 🎉");
      case "fotos":
        if (d.anzahl == null) return h;
        return `<div class="az-zahl"><b>${Number(d.anzahl).toLocaleString("de-DE")}</b> Fotos &amp; Videos in deiner Mediathek</div>
          ${d.alben?.length ? `<h3>Alben</h3>${chips(d.alben)}` : ""}
          <div class="hf-reihe" style="margin-top:10px"><button class="hf-btn leise" data-fenster="archiv">🗂 Fridays eigenes Archiv</button></div>`;
      case "musik":
        return `${d.jetzt?.titel ? `<div class="az-zahl">🎵 <b>${esc(d.jetzt.titel)}</b>${d.jetzt.kuenstler ? ` · ${esc(d.jetzt.kuenstler)}` : ""}</div>` : h || `<p class="hf-hinweis">Gerade läuft nichts.</p>`}
          ${d.playlists?.length ? `<h3>Deine Playlists</h3>${chips(d.playlists.map((p) => p.name || p))}` : ""}
          <div class="hf-reihe" style="margin-top:10px"><button class="hf-btn" data-fenster="apple-musik">🎛 Abspielen im Fenster Apple-Apps</button></div>`;
      case "kurzbefehle":
        if (!d.kurzbefehle) return h;
        return `<input class="hf-input" id="az-kb-q" type="search" placeholder="Kurzbefehl suchen …" aria-label="Kurzbefehl suchen" style="margin-bottom:8px">
          <div id="az-kb">${zeilen(d.kurzbefehle, (n) => `<li class="hf-zeile" data-kbname="${esc(n.toLowerCase())}"><span class="icon">⌘</span><span class="name">${esc(n)}</span><button class="hf-mini" data-kb="${esc(n)}">▶ Starten</button></li>`, "Auf dem Mac sind noch keine Kurzbefehle.")}</div>
          <p class="hf-hinweis">Per Sprache: „Friday, starte Kurzbefehl ${esc(d.kurzbefehle[0] || "Guten Morgen")}“.</p>`;
      case "gdrive": case "onedrive":
        if (!d.dateien) return h;
        return `<h3>Zuletzt geändert · ${esc((d.ordner || []).join(", "))}</h3>
          ${zeilen(d.dateien, (f) => zeile("📄", esc(f.name), [f.ordner, groesse(f.groesse), zeit(f.geaendert)].filter(Boolean).map(esc).join(" · ")), "Der Ordner ist leer.")}
          <div class="hf-reihe" style="margin-top:10px"><button class="hf-btn" data-tu="ordner">📁 Ordner im Finder öffnen</button></div>`;
      case "github":
        if (d.error) return `<p class="hf-status fehler">${esc(d.error)}</p>`;
        return `<div class="az-zahl">${link(d.url, d.repo)} ${d.privat ? "· 🔒 privat" : "· öffentlich"}</div>
          <div class="hf-zwei">
            <div><h3>Neueste Änderungen</h3>${zeilen(d.commits, (c) => zeile("●", link(c.url, c.text), zeit(c.zeit)), "Keine Änderungen.")}</div>
            <div><h3>Offene Aufträge (${d.auftraege.length})</h3>${zeilen(d.auftraege, (i) => zeile(i.eve ? "🧪" : "○", link(i.url, `#${i.nr} ${i.titel}`), i.eve ? "Eve-Wunsch" : ""), "Keine offenen Aufträge.")}
              ${d.pullRequests.length ? `<h3 style="margin-top:12px">Warten auf dein OK (${d.pullRequests.length})</h3>${zeilen(d.pullRequests, (p) => zeile("⇄", link(p.url, `#${p.nr} ${p.titel}`)), "")}` : ""}</div>
          </div>`;
      case "youtube":
        return `<form id="az-yt" class="hf-reihe" autocomplete="off"><input class="hf-input grow" id="az-yt-q" type="search" placeholder="Auf YouTube suchen …" enterkeyhint="search" aria-label="YouTube durchsuchen"><button class="hf-btn" type="submit">🔎 Suchen</button></form>
          <div id="az-yt-liste" class="az-videos"></div>`;
      case "spotify":
        return d.jetzt?.titel ? `<div class="az-zahl">🎧 <b>${esc(d.jetzt.titel)}</b>${d.jetzt.kuenstler ? ` · ${esc(d.jetzt.kuenstler)}` : ""}</div><div class="hf-reihe"><button class="hf-btn leise" data-fenster="dienste">⚙ Spotify in Verbindungen</button></div>`
          : `${h || `<p class="hf-hinweis">Gerade läuft nichts.</p>`}<div class="hf-reihe"><button class="hf-btn leise" data-fenster="dienste">⚙ Verbindungen öffnen</button></div>`;
      case "alexa":
        return `${h}${d.routinen?.length ? `<h3>Routinen</h3>${chips(d.routinen)}` : ""}${d.lautsprecher?.length ? `<h3 style="margin-top:10px">Lautsprecher</h3>${chips(d.lautsprecher)}` : ""}
          <div class="hf-reihe" style="margin-top:10px"><button class="hf-btn" data-fenster="alexa">🔵 Alexa-Fenster öffnen</button></div>`;
      case "ring": case "arlo":
        return `${h}<div class="hf-reihe"><button class="hf-btn leise" data-fenster="wache">🛡 Kamera-Wache öffnen</button></div>`;
      default:
        return h;
    }
  }

  // ---------- Klicks ----------
  w.sheet.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-gruppe]");
    if (t) { gruppe = t.dataset.gruppe; tabs(); kacheln(); return; }
    const k = e.target.closest("[data-app]");
    if (k) { if (auswahl === k.dataset.app) { auswahl = null; $("#az-detail").classList.add("hidden"); kacheln(); } else zeige(k.dataset.app); return; }
    if (e.target.closest(".az-zu")) { auswahl = null; $("#az-detail").classList.add("hidden"); kacheln(); return; }
    const f = e.target.closest("[data-fenster]");
    if (f) {
      const z = f.dataset.fenster;
      w.zu();
      if (z === "archiv") window.FridayArchiv?.open();
      else if (z === "apple-musik") window.FridayApple?.open({ tab: "musik" });
      else if (z === "dienste") window.openDienste?.();
      else if (z === "wache") window.FridayWache?.open();
      else document.getElementById(`${z}-open`)?.click();
      return;
    }
    const tu = e.target.closest("[data-tu], [data-kb]");
    if (!tu || !auswahl) return;
    const body = tu.dataset.kb ? { aktion: "kurzbefehl", name: tu.dataset.kb } : { aktion: tu.dataset.tu };
    const msg = $("#az-msg");
    tu.disabled = true;
    msg.classList.remove("fehler");
    msg.textContent = "Moment …";
    try {
      const r = await json(`/api/apps/${encodeURIComponent(auswahl)}`, { body });
      msg.textContent = r.eve_simuliert ? `🧪 ${r.text}` : `✓ ${r.text || "Erledigt."}`;
    } catch (err) {
      msg.textContent = err.message; msg.classList.add("fehler");
    } finally { tu.disabled = false; }
  });
  w.sheet.addEventListener("input", (e) => {
    if (e.target.id !== "az-kb-q") return;
    const q = e.target.value.trim().toLowerCase();
    w.$$("#az-kb [data-kbname]").forEach((li) => { li.hidden = q && !li.dataset.kbname.includes(q); });
  });
  w.sheet.addEventListener("submit", async (e) => {
    if (e.target.id !== "az-yt") return;
    e.preventDefault();
    const q = $("#az-yt-q").value.trim();
    const box = $("#az-yt-liste");
    if (!q) return;
    box.innerHTML = `<p class="hf-hinweis">Suche …</p>`;
    try {
      const d = await json(`/api/apps/youtube/suche?q=${encodeURIComponent(q)}`);
      box.innerHTML = d.videos?.length ? d.videos.map((v) => `
        <a class="az-video" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener noreferrer">
          <img src="${esc(v.bild)}" alt="" loading="lazy"><span>${esc(v.titel)}${v.kanal ? `<small>${esc(v.kanal)}</small>` : ""}</span></a>`).join("")
        : `<p class="hf-leer">${esc(d.error || "Nichts gefunden.")}</p>`;
    } catch (err) { box.innerHTML = `<p class="hf-status fehler">${esc(err.message)}</p>`; }
  });

  const st = document.createElement("style");
  st.textContent = `
.az-box { width: min(1120px, 100%); }
.az-kopf { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.az-legende { font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.az-l { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-left: 6px; }
.az-l.echt, .az-art.echt { --az-art: #45e38b; } .az-l.mac, .az-art.mac { --az-art: var(--cyan); } .az-l.link, .az-art.link { --az-art: #9aa4b2; }
.az-l { background: var(--az-art); box-shadow: 0 0 8px var(--az-art); }
.az-eve { font-size: 13px; padding: 8px 12px; border-radius: 10px; border: 1px dashed #38e1ff; color: #bff4ff; background: rgba(56,225,255,.08); }
.az-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.az-kachel { display: grid; grid-template-columns: 44px 1fr; grid-template-rows: auto auto; gap: 4px 12px; align-items: center; text-align: left; padding: 12px; border-radius: 14px; cursor: pointer; font: inherit; color: var(--text);
  border: 1px solid var(--u-rand-soft, var(--line)); background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(0,0,0,.25)); transition: transform .15s, border-color .15s, box-shadow .15s; }
.az-kachel:hover { transform: translateY(-2px); border-color: var(--cyan); box-shadow: 0 0 16px color-mix(in srgb, var(--cyan) 30%, transparent); }
.az-kachel.an { border-color: var(--cyan); box-shadow: 0 0 20px color-mix(in srgb, var(--cyan) 40%, transparent), inset 0 0 18px color-mix(in srgb, var(--cyan) 10%, transparent); }
.az-kachel .az-ico { grid-row: 1 / span 2; }
.az-ico { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; font-weight: 800; font-size: 17px; color: #fff; letter-spacing: -.02em;
  background: radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--az-farbe) 70%, #fff), var(--az-farbe) 60%, color-mix(in srgb, var(--az-farbe) 60%, #000));
  box-shadow: 0 0 14px color-mix(in srgb, var(--az-farbe) 55%, transparent), inset 0 1px 0 rgba(255,255,255,.35); text-shadow: 0 1px 2px rgba(0,0,0,.4); }
.az-ico.gross { width: 56px; height: 56px; font-size: 21px; border-radius: 15px; }
.az-name { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.az-name b { font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.az-name small { font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 5px; }
.az-punkt { width: 7px; height: 7px; border-radius: 50%; background: #6b7280; flex: none; }
.az-punkt.gut { background: #45e38b; box-shadow: 0 0 6px #45e38b; }
.az-art { justify-self: start; font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; color: var(--az-art); border: 1px solid color-mix(in srgb, var(--az-art) 60%, transparent); background: color-mix(in srgb, var(--az-art) 10%, transparent); }
.az-detail { display: flex; flex-direction: column; gap: 10px; }
.az-dkopf { display: flex; align-items: center; gap: 14px; }
.az-dkopf > div { flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.az-dkopf h3 { margin: 0 !important; font-size: 17px !important; letter-spacing: .02em !important; text-transform: none !important; color: var(--text) !important; }
.az-kann { margin: 0; font-size: 14px; line-height: 1.5; }
.az-geld { margin: 0; font-size: 13px; color: #45e38b; border: 1px solid rgba(69,227,139,.4); border-radius: 10px; padding: 7px 10px; background: rgba(69,227,139,.07); }
.az-knoepfe a.hf-btn { text-decoration: none; display: inline-block; }
.az-puls { animation: az-puls 1.2s ease-in-out 4; }
@keyframes az-puls { 50% { box-shadow: 0 0 24px var(--cyan); transform: scale(1.05); } }
.az-zahl { font-size: 15px; margin-bottom: 8px; } .az-zahl b { font-size: 20px; color: var(--cyan); } .az-zahl a { color: var(--cyan); }
.az-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.az-chip { font-size: 12.5px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.25); }
.az-detail .hf-zeile a { color: var(--text); text-decoration: none; } .az-detail .hf-zeile a:hover { color: var(--cyan); }
.az-videos { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-top: 10px; }
.az-video { display: flex; flex-direction: column; gap: 6px; text-decoration: none; color: var(--text); font-size: 13px; border-radius: 12px; overflow: hidden; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.3); }
.az-video img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; }
.az-video span { padding: 0 8px 8px; line-height: 1.35; } .az-video small { display: block; color: var(--muted); font-size: 11.5px; margin-top: 2px; }
.az-video:hover { border-color: var(--cyan); }
@media (max-width: 900px) {
  .az-raster { grid-template-columns: 1fr 1fr; gap: 8px; }
  .az-kachel { grid-template-columns: 1fr; justify-items: start; padding: 10px; }
  .az-kachel .az-ico { grid-row: auto; width: 38px; height: 38px; font-size: 15px; }
  .az-name b { font-size: 13.5px; white-space: normal; }
  .az-legende { display: none; }
  .az-videos { grid-template-columns: 1fr 1fr; }
}
@media (prefers-reduced-motion: reduce) { .az-kachel, .az-puls { transition: none; animation: none; } }`;
  document.head.appendChild(st);

  document.querySelector(".nav-apps")?.addEventListener("click", () => w.auf());
  window.FridayApps = { open: (o) => w.auf(o), refresh: laden };
})();
