// F.R.Ai.D.A.Y Archiv: Fotos, Videos, Webseiten und Dokumente nach Jahr → Monat.
// Fotos liegen auf dem Mac in ~/Friday-Archiv/Fotos/<Jahr>/<MM-Monat>/.
(() => {
  "use strict";
  const F = window.Friday || {};
  const api = F.api;
  if (!api) return;
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const tok = () => { try { return localStorage.getItem("friday_token") || ""; } catch { return ""; } };
  const url = (datei) => `/api/archiv/datei/${datei}?t=${encodeURIComponent(tok())}`;
  const TYP = { foto: ["📸", "Fotos"], video: ["🎬", "Videos"], webseite: ["🌐", "Webseiten"], spiel: ["🎮", "Spiele"], dokument: ["📄", "Dokumente"] };

  const sheet = document.createElement("section");
  sheet.id = "archiv";
  sheet.className = "sheet hidden";
  sheet.setAttribute("aria-label", "Fridays Archiv");
  sheet.innerHTML = `<div class="panel sheet-box arc-box">
      <header class="sheet-top"><h2>🗂 Fridays Archiv</h2><span id="arc-zahl" class="arc-zahl"></span><button id="arc-x" class="ghost small" aria-label="Schließen">✕</button></header>
      <div id="arc-stats" class="arc-stats"></div>
      <div class="arc-leiste">
        <div id="arc-filter" class="wissen-filter arc-filter" role="tablist">
          <button type="button" data-typ="" class="active">Alles</button>
          <button type="button" data-typ="foto">📸 Fotos</button>
          <button type="button" data-typ="video">🎬 Videos</button>
          <button type="button" data-typ="webseite">🌐 Webseiten</button>
          <button type="button" data-typ="spiel">🎮 Spiele</button>
          <button type="button" data-typ="dokument">📄 Dokumente</button>
        </div>
        <div class="arc-knoepfe">
          <label class="chip arc-plus" title="Fotos von diesem Gerät ins Archiv legen">＋ Fotos<input id="arc-datei" type="file" accept="image/*" multiple hidden></label>
          <button id="arc-sortieren" class="chip" type="button" title="Alte Vision-Fotos aus dem Download-Ordner am Mac einsortieren">⇣ Downloads</button>
          <button id="arc-ordner" class="chip" type="button" title="Ordner am Mac im Finder öffnen">📂 Ordner</button>
        </div>
      </div>
      <p id="arc-msg" class="arc-msg hidden"></p>
      <div class="arc-haupt">
        <nav id="arc-baum" class="arc-baum" aria-label="Jahre und Monate"></nav>
        <div id="arc-inhalt" class="arc-inhalt"><span class="muted">Lade …</span></div>
      </div>
      <p class="muted arc-fuss" id="arc-fuss"></p>
    </div>
    <div id="arc-gross" class="arc-gross hidden" role="dialog" aria-label="Foto">
      <button class="arc-g-x" id="arc-g-x" aria-label="Schließen">✕</button>
      <button class="arc-g-pf l" id="arc-g-l" aria-label="Vorheriges">‹</button>
      <figure><img id="arc-g-img" alt=""><video id="arc-g-vid" controls playsinline class="hidden"></video><figcaption id="arc-g-txt"></figcaption></figure>
      <button class="arc-g-pf r" id="arc-g-r" aria-label="Nächstes">›</button>
      <div class="arc-g-knoepfe"><a id="arc-g-dl" class="chip" download>⬇ Speichern</a><button id="arc-g-weg" class="chip" type="button">🗑 In den Papierkorb</button></div>
    </div>`;
  document.getElementById("app")?.appendChild(sheet) || document.body.appendChild(sheet);
  const $ = (id) => document.getElementById(id);

  let daten = null, filter = "", wahl = null; // wahl = { jahr, monat }
  let ansicht = [], grossIdx = -1;

  const meldung = (t, fehler) => { const m = $("arc-msg"); m.textContent = t || ""; m.classList.toggle("hidden", !t); m.classList.toggle("error", Boolean(fehler)); };
  const zahl = (a) => (filter ? a[filter] || 0 : a.gesamt || 0);
  const datum = (z) => new Date(z).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const groesse = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

  async function laden() {
    try { daten = await (await api("/api/archiv")).json(); } catch { $("arc-inhalt").innerHTML = `<p class="error">Archiv konnte nicht geladen werden.</p>`; return; }
    const g = daten.gesamt || {};
    $("arc-zahl").textContent = `${g.gesamt || 0} Einträge`;
    $("arc-stats").innerHTML = Object.entries(TYP).map(([k, [ic, name]]) => `<div class="arc-stat"><b>${g[k] || 0}</b><small>${ic} ${name}</small></div>`).join("");
    $("arc-fuss").textContent = daten.ordner ? `Fotos liegen am Mac in ${daten.ordner.replace(/^\/Users\/[^/]+/, "~")}/Fotos/Jahr/Monat` : "";
    // Auswahl behalten, sonst neuester Monat mit Inhalt
    const hat = (j, m) => daten.jahre.some((y) => y.jahr === j && y.monate.some((x) => x.monat === m && zahl(x.anzahl)));
    if (!wahl || !hat(wahl.jahr, wahl.monat)) {
      const y = daten.jahre.find((y) => zahl(y.anzahl));
      const m = y?.monate.find((x) => zahl(x.anzahl));
      wahl = y && m ? { jahr: y.jahr, monat: m.monat } : null;
    }
    baum(); inhalt();
  }

  function baum() {
    const jahre = daten.jahre.filter((y) => zahl(y.anzahl));
    if (!jahre.length) { $("arc-baum").innerHTML = ""; return; }
    $("arc-baum").innerHTML = jahre.map((y) => {
      const offen = wahl?.jahr === y.jahr;
      const monate = y.monate.filter((m) => zahl(m.anzahl));
      return `<div class="arc-jahr${offen ? " offen" : ""}">
        <button type="button" class="arc-j" data-jahr="${y.jahr}"><span>${y.jahr}</span><i>${zahl(y.anzahl)}</i></button>
        <div class="arc-monate">${monate.map((m) => `<button type="button" class="arc-m${offen && wahl.monat === m.monat ? " on" : ""}" data-jahr="${y.jahr}" data-monat="${m.monat}"><span>${esc(m.name)}</span><i>${zahl(m.anzahl)}</i></button>`).join("")}</div>
      </div>`;
    }).join("");
  }

  function karte(e, i) {
    const zeit = `<small>${datum(e.zeit)}</small>`;
    if (e.typ === "foto") return `<button type="button" class="arc-k arc-foto" data-i="${i}" title="${esc(e.name)}"><img loading="lazy" src="${url(e.datei)}" alt="Foto vom ${datum(e.zeit)}"><span class="arc-k-txt"><b>${esc(e.titel)}</b>${zeit}</span></button>`;
    if (e.typ === "video") return `<button type="button" class="arc-k arc-video" data-i="${i}"><video preload="metadata" muted playsinline src="${url(e.datei)}#t=0.5"></video><span class="arc-play">▶</span><span class="arc-k-txt"><b>${esc(e.titel)}</b>${zeit}</span></button>`;
    const [ic] = TYP[e.typ];
    const extra = e.typ === "webseite" ? (e.status === "verkauft" ? "✓ verkauft" : "Entwurf") : e.typ === "spiel" ? (e.quelle === "vorlage" ? "Spiel · Vorlage" : "Spiel") : e.art === "fragebogen" ? "Fragebogen" : "Dokument";
    return `<button type="button" class="arc-k arc-symbol" data-i="${i}"><span class="arc-ic">${ic}</span><span class="arc-k-txt"><b>${esc(e.titel)}</b><small>${extra} · ${datum(e.zeit)}</small></span></button>`;
  }

  function inhalt() {
    const ziel = $("arc-inhalt");
    if (!wahl) {
      ziel.innerHTML = `<div class="arc-leer"><div class="arc-leer-ic">🗂</div><b>Noch nichts im Archiv${filter ? " in dieser Sparte" : ""}.</b><p>Mach in Friday Vision ein 📸 Foto, oder leg mit „＋ Fotos“ Bilder hinein. Sie landen automatisch im richtigen Jahr und Monat.</p></div>`;
      ansicht = []; return;
    }
    const y = daten.jahre.find((x) => x.jahr === wahl.jahr);
    const m = y?.monate.find((x) => x.monat === wahl.monat);
    ansicht = (m?.eintraege || []).filter((e) => !filter || e.typ === filter);
    // nach Tag gruppieren
    let html = `<div class="arc-titel">${esc(m.name)} ${wahl.jahr}<small>${ansicht.length} ${ansicht.length === 1 ? "Eintrag" : "Einträge"}</small></div>`;
    let tag = "";
    ansicht.forEach((e, i) => {
      const t = new Date(e.zeit).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
      if (t !== tag) { html += `${tag ? "</div>" : ""}<div class="arc-tag">${esc(t)}</div><div class="arc-raster">`; tag = t; }
      html += karte(e, i);
    });
    ziel.innerHTML = html + (tag ? "</div>" : "");
    ziel.scrollTop = 0;
  }

  // ---------- Großansicht ----------
  const medien = () => ansicht.map((e, i) => ({ e, i })).filter((x) => x.e.typ === "foto" || x.e.typ === "video");
  function gross(i) {
    const e = ansicht[i]; if (!e) return;
    grossIdx = i;
    const img = $("arc-g-img"), vid = $("arc-g-vid");
    if (e.typ === "video") { img.classList.add("hidden"); img.removeAttribute("src"); vid.classList.remove("hidden"); vid.src = url(e.datei); vid.play?.().catch(() => {}); }
    else { vid.pause(); vid.classList.add("hidden"); vid.removeAttribute("src"); img.classList.remove("hidden"); img.src = url(e.datei); }
    $("arc-g-txt").textContent = `${e.titel} · ${new Date(e.zeit).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })}${e.groesse ? ` · ${groesse(e.groesse)}` : ""}`;
    $("arc-g-dl").href = url(e.datei); $("arc-g-dl").download = e.name || "friday";
    $("arc-g-weg").classList.toggle("hidden", e.typ !== "foto");
    $("arc-g-weg").textContent = "🗑 In den Papierkorb";
    const m = medien(); const pos = m.findIndex((x) => x.i === i);
    $("arc-g-l").classList.toggle("hidden", pos <= 0);
    $("arc-g-r").classList.toggle("hidden", pos < 0 || pos >= m.length - 1);
    $("arc-gross").classList.remove("hidden");
  }
  function blaettern(d) { const m = medien(); const pos = m.findIndex((x) => x.i === grossIdx); const n = m[pos + d]; if (n) gross(n.i); }
  function grossZu() { const v = $("arc-g-vid"); v.pause(); v.removeAttribute("src"); $("arc-gross").classList.add("hidden"); grossIdx = -1; }

  function oeffneEintrag(i) {
    const e = ansicht[i]; if (!e) return;
    if (e.typ === "foto" || e.typ === "video") return gross(i);
    if (e.typ === "webseite") { try { window.open(url(e.datei), "_blank", "noopener"); } catch { /* egal */ } return; }
    if (e.typ === "dokument") window.FridayDokumente?.oeffne(e.dokId);
    if (e.typ === "spiel") window.FridaySpiele?.spiel(e.spielId);
  }

  // ---------- Fotos hinzufügen ----------
  function leseDatei(f) {
    return new Promise((ok, nein) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => nein(new Error("Datei nicht lesbar"));
      r.readAsDataURL(f);
    });
  }
  async function verkleinern(dataUrl) {
    const img = new Image();
    await new Promise((ok, nein) => { img.onload = ok; img.onerror = nein; img.src = dataUrl; });
    const s = Math.min(1, 3200 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  }
  async function hinzufuegen(dateien) {
    const liste = [...dateien].filter((f) => f.type.startsWith("image/"));
    if (!liste.length) return;
    let gut = 0, fehler = 0;
    for (const [n, f] of liste.entries()) {
      meldung(`Lege Foto ${n + 1} von ${liste.length} ins Archiv …`);
      try {
        let bild = await leseDatei(f);
        if (f.size > 7 * 1024 * 1024 || !/^data:image\/(jpeg|png|webp)/.test(bild)) bild = await verkleinern(bild);
        const r = await (await api("/api/archiv/foto", { method: "POST", body: JSON.stringify({ bild, quelle: "import", zeit: f.lastModified ? new Date(f.lastModified).toISOString() : undefined }) })).json();
        if (r.ok) { gut++; wahl = { jahr: r.jahr, monat: r.monat }; } else fehler++;
      } catch { fehler++; }
    }
    meldung(fehler ? `${gut} Fotos abgelegt, ${fehler} gingen nicht.` : `✓ ${gut} ${gut === 1 ? "Foto" : "Fotos"} im Archiv abgelegt.`, fehler > 0);
    await laden();
  }

  // ---------- Ereignisse ----------
  $("arc-x").addEventListener("click", zu);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) zu(); });
  $("arc-filter").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-typ]"); if (!b) return;
    filter = b.dataset.typ;
    $("arc-filter").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    wahl = null; laden();
  });
  $("arc-baum").addEventListener("click", (e) => {
    const m = e.target.closest(".arc-m");
    if (m) { wahl = { jahr: +m.dataset.jahr, monat: +m.dataset.monat }; baum(); inhalt(); return; }
    const j = e.target.closest(".arc-j");
    if (j) {
      const y = daten.jahre.find((x) => x.jahr === +j.dataset.jahr);
      const erster = y?.monate.find((x) => zahl(x.anzahl));
      if (erster) { wahl = { jahr: y.jahr, monat: erster.monat }; baum(); inhalt(); }
    }
  });
  $("arc-inhalt").addEventListener("click", (e) => { const k = e.target.closest(".arc-k"); if (k) oeffneEintrag(+k.dataset.i); });
  $("arc-datei").addEventListener("change", (e) => { hinzufuegen(e.target.files); e.target.value = ""; });
  $("arc-sortieren").addEventListener("click", async () => {
    meldung("Suche Vision-Fotos im Download-Ordner …");
    try {
      const r = await (await api("/api/archiv/einsortieren", { method: "POST" })).json();
      if (r.error && !r.verschoben) meldung(r.error, true);
      else meldung(r.verschoben ? `✓ ${r.verschoben} ${r.verschoben === 1 ? "Foto" : "Fotos"} aus Downloads einsortiert.` : "Keine alten Vision-Fotos in Downloads gefunden.");
      wahl = null; await laden();
    } catch { meldung("Einsortieren hat nicht geklappt.", true); }
  });
  $("arc-ordner").addEventListener("click", async () => {
    try { const r = await (await api("/api/archiv/ordner", { method: "POST", body: JSON.stringify(wahl || {}) })).json(); meldung(r.hinweis || "Ordner am Mac geöffnet."); } catch { meldung("Ordner ließ sich nicht öffnen.", true); }
  });
  $("arc-g-x").addEventListener("click", grossZu);
  $("arc-g-l").addEventListener("click", () => blaettern(-1));
  $("arc-g-r").addEventListener("click", () => blaettern(1));
  $("arc-gross").addEventListener("click", (e) => { if (e.target.id === "arc-gross") grossZu(); });
  $("arc-g-weg").addEventListener("click", async (e) => {
    const b = e.currentTarget, eintrag = ansicht[grossIdx];
    if (!eintrag || eintrag.typ !== "foto") return;
    if (!b.dataset.sicher) { b.dataset.sicher = "1"; b.textContent = "Wirklich? Nochmal tippen"; setTimeout(() => { delete b.dataset.sicher; b.textContent = "🗑 In den Papierkorb"; }, 3000); return; }
    delete b.dataset.sicher;
    const rel = decodeURIComponent(eintrag.datei.replace(/^foto\//, ""));
    try {
      const r = await (await api("/api/archiv/wegwerfen", { method: "POST", body: JSON.stringify({ datei: rel }) })).json();
      if (!r.ok) throw new Error(r.error);
      grossZu(); meldung("Foto liegt jetzt im Archiv-Papierkorb."); await laden();
    } catch { meldung("Foto konnte nicht entfernt werden.", true); }
  });
  document.addEventListener("keydown", (e) => {
    if (sheet.classList.contains("hidden")) return;
    const g = !$("arc-gross").classList.contains("hidden");
    if (e.key === "Escape") { if (g) grossZu(); else zu(); }
    else if (g && e.key === "ArrowLeft") blaettern(-1);
    else if (g && e.key === "ArrowRight") blaettern(1);
  });

  function auf() { sheet.classList.remove("hidden"); meldung(""); laden(); }
  function zu() { grossZu(); sheet.classList.add("hidden"); }
  document.getElementById("archiv-open")?.addEventListener("click", auf);

  window.FridayArchiv = { open: auf, refresh: () => { if (!sheet.classList.contains("hidden")) laden(); } };
})();
