// F.R.Ai.D.A.Y Ideen-Schmiede (v1.106.0, v1.130.0: Reiter „Friday ausbauen“ im Stil des Tool-Ökosystems,
// v1.164.0: Eingebautes verschwindet aus dem Bauplan, frische Ideen rücken nach)
// Würfeln (Alltag, Kreativität, Nischen-Business, Technik), eigene Idee ehrlich prüfen, im Ideen-Tresor
// aufheben und Schritt für Schritt vorantreiben. Ohne Claude; „Mit KI ausarbeiten“ braucht Guthaben.
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  let wurf = null, check = null, tresor = [], bereich = "", reiter = "ideen";
  const STATUS = { idee: "💭 Idee", test: "🧪 Test", umsetzung: "🚀 Umsetzung", erledigt: "✅ Erledigt", verworfen: "🗄 Verworfen" };

  const w = H.fenster({
    id: "ideen", titel: "💡 Ideen-Schmiede", klasse: "id-box",
    html: `
      <div class="hf-tabs id-reiter" id="id-reiter" role="tablist">
        <button class="hf-tab an" data-r="ideen" type="button">🎲 Ideen &amp; Tresor</button>
        <button class="hf-tab" data-r="ausbau" type="button">🤖 Friday ausbauen</button>
      </div>
      <div id="id-p-ausbau" class="ia hidden"></div>
      <div id="id-p-ideen" class="id-p">
      <div class="hf-zwei">
        <div class="hf-karte">
          <h3>🎲 Ideen würfeln</h3>
          <div class="hf-tabs" id="id-bereich">
            <button class="hf-tab an" data-b="">Alles</button><button class="hf-tab" data-b="alltag">🏡 Alltag</button><button class="hf-tab" data-b="kreativ">🎨 Kreativität</button><button class="hf-tab" data-b="nische">💼 Nischen-Business</button><button class="hf-tab" data-b="technik">🛠 Technik</button><button class="hf-tab" data-b="friday">🤖 Für Friday</button>
          </div>
          <div id="id-wurf" style="margin-top:10px"><div class="hf-leer">Tipp auf Würfeln.</div></div>
          <div class="hf-reihe" style="margin-top:8px"><button id="id-wuerfeln" class="hf-btn haupt" type="button">🎲 Würfeln</button><button id="id-wurf-merken" class="hf-btn" type="button" disabled>⭐ In den Tresor</button></div>
        </div>
        <div class="hf-karte">
          <h3>🔍 Meine Idee prüfen</h3>
          <label class="hf-feld"><textarea id="id-text" placeholder="Beschreib deine Idee: Was ist das Problem, für wen, und wie verdienst du Geld?"></textarea></label>
          <div class="hf-reihe" style="margin-top:8px"><button id="id-pruefen" class="hf-btn haupt" type="button">Schnell-Check</button><button id="id-ki" class="hf-btn ki" type="button">🤖 Mit KI ausarbeiten</button><button id="id-merken" class="hf-btn" type="button">⭐ Speichern</button></div>
          <div id="id-check"></div>
        </div>
      </div>
      <div id="id-status" class="hf-status">Sag auch: „Friday, gib mir eine Start-up-Idee“ oder „Merk dir die Idee: …“</div>
      <div class="hf-karte"><h3>🔐 Ideen-Tresor</h3><div id="id-tresor" class="hf-liste"></div></div>
      </div>`,
    onOpen: (opts) => { laden(); if (opts?.wurf) { wurf = opts.wurf; zeigeWurf(); } zeigeReiter(opts?.reiter || (opts?.wurf ? "ideen" : reiter)); },
  });
  const $ = (s) => w.$(s);
  const status = (t, f = false) => { const s = $("#id-status"); s.textContent = t; s.classList.toggle("fehler", f); };

  async function laden() {
    try {
      tresor = (await json("/api/ideen")).tresor || [];
      $("#id-tresor").innerHTML = tresor.length ? tresor.map((i) => `
        <div class="hf-zeile" data-id="${esc(i.id)}" style="align-items:flex-start"><span class="name">${i.bereich === "friday" ? '<span class="hf-badge" title="Für Friday">🤖</span> ' : ""}<b>${esc(i.titel)}</b>${i.check ? ` <span class="hf-badge ${i.check.punkte >= 4 ? "hf-gut" : i.check.punkte >= 2 ? "hf-warn" : "hf-schlecht"}">${i.check.punkte}/${i.check.max}</span>` : ""}<br><span class="klein">${esc(i.text.slice(0, 220))}</span></span>
        <select class="hf-mini" data-status aria-label="Stand">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${i.status === k ? " selected" : ""}>${v}</option>`).join("")}</select>
        <button class="hf-mini" data-del title="Löschen">✕</button></div>`).join("") : `<div class="hf-leer">Noch leer. Würfel eine Idee oder speichere deine eigene.</div>`;
    } catch (err) { status(err.message, true); }
  }
  $("#id-bereich").addEventListener("click", (e) => {
    const b = e.target.closest("[data-b]"); if (!b) return;
    bereich = b.dataset.b;
    w.$$("#id-bereich .hf-tab").forEach((x) => x.classList.toggle("an", x === b));
  });
  function zeigeWurf() {
    $("#id-wurf").innerHTML = `<b style="font-size:17px">${esc(wurf.titel)}</b><p class="hf-hinweis" style="margin:6px 0">${esc(wurf.pitch)}</p>
      <p class="hf-hinweis" style="margin:0">👣 ${wurf.bereich === "friday" ? "So nutzt du es" : "Erster Schritt"}: ${esc(wurf.schritt)}<br>💶 ${wurf.bereich === "friday" ? "Kosten" : "Startkosten"}: ${esc(wurf.kosten)}</p>
      ${wurf.ausbau ? `<button class="hf-btn" type="button" data-zum-bauplan="${esc(wurf.ausbau)}" style="margin-top:6px">🤖 Im Bauplan ansehen</button>` : ""}`;
    $("#id-wurf-merken").disabled = false;
  }
  $("#id-wuerfeln").addEventListener("click", async () => {
    try { wurf = await json(`/api/ideen/wuerfeln?bereich=${encodeURIComponent(bereich)}`); zeigeWurf(); } catch (err) { status(err.message, true); }
  });
  $("#id-wurf-merken").addEventListener("click", async () => {
    if (!wurf) return;
    try { await json("/api/ideen", { body: { titel: wurf.titel, text: `${wurf.pitch}\nErster Schritt: ${wurf.schritt}`, bereich: wurf.bereich } }); status("Im Tresor."); laden(); } catch (err) { status(err.message, true); }
  });
  $("#id-pruefen").addEventListener("click", async () => {
    try {
      check = await json("/api/ideen/pruefen", { body: { text: $("#id-text").value } });
      $("#id-check").innerHTML = `<p style="margin:10px 0 6px"><b>${check.punkte} von ${check.max}</b> – ${esc(check.urteil)}</p>
        <ul class="hf-liste">${check.ergebnis.map((c) => `<li class="hf-zeile"><span class="icon ${c.ok ? "hf-gut" : "hf-schlecht"}">${c.ok ? "✓" : "✗"}</span><span class="name">${esc(c.titel)}${c.ok ? "" : `<br><span class="klein">${esc(c.tipp)}</span>`}</span></li>`).join("")}</ul>
        ${check.risiken.length ? `<p class="hf-hinweis" style="margin-top:8px"><b>⚠ Achtung:</b> ${check.risiken.map(esc).join(" ")}</p>` : ""}
        <p class="hf-hinweis"><b>👣 Nächste Schritte:</b> ${check.schritte.map((s, i) => `${i + 1}. ${esc(s)}`).join(" ")}</p>`;
      status("");
    } catch (err) { status(err.message, true); }
  });
  $("#id-merken").addEventListener("click", async () => {
    const text = $("#id-text").value.trim();
    if (text.length < 6) { status("Erst die Idee beschreiben.", true); return; }
    try { await json("/api/ideen", { body: { titel: text.split(/[.!?\n]/)[0].slice(0, 80), text, check } }); status("Im Tresor gespeichert."); laden(); } catch (err) { status(err.message, true); }
  });
  $("#id-ki").addEventListener("click", async () => {
    const text = $("#id-text").value.trim();
    if (text.length < 6) { status("Erst die Idee beschreiben.", true); return; }
    const b = $("#id-ki"); b.disabled = true; status("Claude arbeitet die Idee aus …");
    try {
      const k = await json("/api/ideen/ausarbeiten", { body: { titel: text.split(/[.!?\n]/)[0], text } });
      const zeile = (t, v) => (v ? `<li><b>${t}:</b> ${esc(Array.isArray(v) ? v.join(" · ") : v)}</li>` : "");
      $("#id-check").innerHTML = k.frei ? `<p class="hf-hinweis" style="white-space:pre-wrap">${esc(k.frei)}</p>` : `<ul class="hf-hinweis" style="padding-left:18px;margin:10px 0">${zeile("Problem", k.problem)}${zeile("Zielgruppe", k.zielgruppe)}${zeile("Lösung", k.loesung)}${zeile("Preis", k.preis)}${zeile("Erste Kunden", k.erste_kunden)}${zeile("Test in 7 Tagen", k.test_in_7_tagen)}${zeile("Kosten", k.kosten)}${zeile("Risiken", k.risiken)}${zeile("Namensideen", k.namen)}${zeile("Ehrliche Meinung", k.ehrliche_meinung)}</ul>`;
      status("");
    } catch (err) { status(err.status === 402 ? "Fridays Guthaben ist leer – Ausarbeiten braucht Claude. Der Schnell-Check läuft ohne." : err.message, true); }
    finally { b.disabled = false; }
  });
  $("#id-tresor").addEventListener("click", async (e) => {
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    try { await json(`/api/ideen/${encodeURIComponent(id)}`, { method: "DELETE" }); laden(); } catch (err) { status(err.message, true); }
  });
  $("#id-tresor").addEventListener("change", async (e) => {
    if (!e.target.matches("[data-status]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    const i = tresor.find((x) => x.id === id);
    try { await json("/api/ideen", { body: { ...i, status: e.target.value } }); } catch (err) { status(err.message, true); }
  });

  $("#id-wurf").addEventListener("click", (e) => { const b = e.target.closest("[data-zum-bauplan]"); if (b) { zeigeReiter("ausbau", b.dataset.zumBauplan); } });

  // ================= Friday ausbauen (Bauplan im Stil des Tool-Ökosystems) =================
  const ia = $("#id-p-ausbau");
  let bau = null, wahl = null, kiListe = [];
  const AUFWAND = { 1: "ein Nachmittag", 2: "ein Abend-Projekt", 3: "größeres Projekt" };
  ia.innerHTML = `
    <div class="ia-kopf">
      <div class="ia-zahlen" id="ia-zahlen">Lade …</div>
      <button id="ia-ki" class="hf-btn ki" type="button">🤖 Neue Vorschläge mit KI</button>
    </div>
    <div class="ia-stage" id="ia-stage">
      <svg class="ia-kabel" id="ia-kabel" aria-hidden="true"></svg>
      <section class="ia-seite" aria-label="Einbinden"><div class="ia-pille">◆ EINBINDEN <small>Dienste &amp; Geräte</small></div><div id="ia-links" class="ia-gruppen"></div></section>
      <section class="ia-mitte" aria-label="Bauplan-Kern">
        <div class="ia-sockel" aria-hidden="true"></div>
        <div class="ia-kern">
          <div class="ia-kern-leiste"><i></i><i></i><i></i><span>friday://bauplan</span><b id="ia-kern-zahl"></b></div>
          <div class="ia-kern-inhalt" id="ia-kern"></div>
        </div>
        <div class="ia-sockel unten" aria-hidden="true"></div>
      </section>
      <section class="ia-seite" aria-label="Bauen"><div class="ia-pille">◆ BAUEN <small>neue Funktionen</small></div><div id="ia-rechts" class="ia-gruppen"></div></section>
    </div>
    <div class="ia-alltag">
      <div class="ia-pille">◆ AUS DEINEM ALLTAG <small id="ia-alltag-info"></small></div>
      <div class="ia-alltag-in">
        <div><h4>🎯 Passt zu dir</h4><div id="ia-passend" class="ia-mini"></div></div>
        <div><h4>🕳 Das konnte Friday noch nicht</h4><div id="ia-luecken" class="ia-mini"></div></div>
      </div>
    </div>`;
  const ist = (sel) => ia.querySelector(sel);
  const aufWunsch = (v) => tresor.some((i) => i.bereich === "friday" && i.titel === v.titel);
  const punkte = (n) => `<span class="ia-aufwand" title="Aufwand: ${AUFWAND[n] || ""}">${[1, 2, 3].map((i) => `<i class="${i <= n ? "an" : ""}"></i>`).join("")}</span>`;

  function kachel(v) {
    const g = bau.gruppen[v.gruppe] || { farbe: "#ff8a2a" };
    return `<button type="button" class="ia-k${v.schonDa ? " da" : ""}${wahl?.id === v.id ? " wahl" : ""}" style="--c:${g.farbe}" data-v="${esc(v.id)}">
      <span class="ia-k-t">${esc(v.titel)}</span>
      <span class="ia-k-u">${punkte(v.aufwand)}${v.schonDa ? '<em class="ok">✓ schon da</em>' : v.passt ? `<em>passt ×${v.passt}</em>` : ""}${aufWunsch(v) ? "<em>⭐</em>" : ""}${v.ki ? "<em>KI</em>" : ""}</span></button>`;
  }
  function gruppenHtml(art) {
    const alle = [...bau.vorschlaege, ...kiListe];
    const gr = Object.entries(bau.gruppen).filter(([, g]) => g.art === art);
    let html = gr.map(([id, g]) => {
      const l = alle.filter((v) => v.gruppe === id && !v.ki && !v.schonDa);
      return l.length ? `<div class="ia-g" data-g="${id}" style="--c:${g.farbe}"><h4>${esc(g.name)}</h4><div class="ia-ks">${l.map(kachel).join("")}</div><span class="ia-port"></span></div>` : "";
    }).join("");
    const ki = kiListe.filter((v) => v.art === art);
    if (ki.length) html += `<div class="ia-g" data-g="ki-${art}" style="--c:#ffd23c"><h4>Von Claude vorgeschlagen</h4><div class="ia-ks">${ki.map(kachel).join("")}</div><span class="ia-port"></span></div>`;
    return html;
  }
  function kernHtml() {
    if (!wahl) {
      return `<div class="ia-intro"><b>Was soll Friday als Nächstes können?</b>
        <p>Links Dienste zum <b>Einbinden</b>, rechts Funktionen zum <b>Bauen</b>. Tipp eine Kachel an: Du siehst Nutzen, Aufwand und Kosten, kannst sie auf die Wunschliste setzen oder einen fertigen Bau-Auftrag kopieren.</p>
        <ul><li><b>${bau.zahlen.offen}</b> Vorschläge offen</li><li><b>${bau.zahlen.schonDa}</b> schon eingebaut</li><li><b>${bau.zahlen.wunschliste}</b> auf deiner Wunschliste</li><li><b>${bau.luecken.length}</b> Lücken aus deinen Gesprächen</li></ul>
        ${(bau.gebaut || []).length ? `<details class="ia-gebaut"><summary>✓ Schon eingebaut und darum ausgeblendet (${bau.gebaut.length})</summary><p>${bau.gebaut.map((v) => esc(v.titel)).join(" · ")}</p></details>` : ""}
        ${bau.abgehakt ? `<p class="ia-ok">✓ ${bau.abgehakt} ${bau.abgehakt === 1 ? "Wunsch ist" : "Wünsche sind"} jetzt eingebaut und im Tresor abgehakt.</p>` : ""}
        <p class="ia-tipp">Sag auch: „Friday, was kann man bei dir noch einbauen?“</p></div>`;
    }
    const g = bau.gruppen[wahl.gruppe] || {};
    return `<div class="ia-detail" style="--c:${g.farbe || "#ff8a2a"}">
      <div class="ia-d-kopf"><span class="ia-art">${wahl.art === "einbinden" ? "EINBINDEN" : "BAUEN"} · ${esc(g.name || "KI")}</span><button class="ia-zu" type="button" data-zu aria-label="Zurück">✕</button></div>
      <h3>${esc(wahl.titel)}</h3>
      <p>${esc(wahl.pitch)}</p>
      <dl>
        <dt>Nutzen</dt><dd>${esc(wahl.nutzen || "–")}</dd>
        <dt>Aufwand</dt><dd>${punkte(wahl.aufwand)} ${esc(AUFWAND[wahl.aufwand] || "")}</dd>
        <dt>Kosten</dt><dd>${esc(wahl.kosten || "–")}</dd>
        <dt>Braucht</dt><dd>${esc(wahl.braucht || "–")}</dd>
        ${wahl.sprache && wahl.sprache !== "–" ? `<dt>Sprechen</dt><dd>„${esc(wahl.sprache)}“</dd>` : ""}
        ${wahl.passt ? `<dt>Passt</dt><dd>Du hast in ${bau.zahlen.tage} Tagen ${wahl.passt}-mal danach gefragt.</dd>` : ""}
      </dl>
      ${wahl.schonDa ? '<p class="ia-ok">✓ Ist schon in Friday eingebaut.</p>' : `<div class="hf-reihe">
        <button class="hf-btn haupt" type="button" data-wunsch ${aufWunsch(wahl) ? "disabled" : ""}>${aufWunsch(wahl) ? "⭐ Auf der Wunschliste" : "⭐ Auf die Wunschliste"}</button>
        <button class="hf-btn" type="button" data-auftrag>📋 Bau-Auftrag kopieren</button></div>`}
      <div class="ia-auftrag hidden"><textarea readonly rows="6"></textarea><p class="hf-hinweis">Kopiert. Einfach in den Chat mit Claude einfügen – dann wird es gebaut.</p></div>
    </div>`;
  }
  function kabel() {
    const st = ist("#ia-stage"), svg = ist("#ia-kabel");
    if (!st || !svg || st.offsetParent === null) return;
    const kern = ist(".ia-kern");
    if (getComputedStyle(svg).display === "none") return;
    const b = st.getBoundingClientRect(), k = kern.getBoundingClientRect();
    const ky = k.top - b.top + k.height / 2;
    let p = "";
    ia.querySelectorAll(".ia-g").forEach((g, i) => {
      const r = g.getBoundingClientRect();
      const links = r.right <= k.left + 2;
      const x1 = links ? r.right - b.left : r.left - b.left, y1 = r.top - b.top + r.height / 2;
      const x2 = links ? k.left - b.left : k.right - b.left, y2 = ky - 40 + (i % 5) * 20;
      const mx = (x1 + x2) / 2;
      const c = getComputedStyle(g).getPropertyValue("--c").trim() || "#ff8a2a";
      const an = wahl && g.querySelector(`[data-v="${CSS.escape(wahl.id)}"]`);
      p += `<path d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" stroke="${c}" class="${an ? "an" : ""}"/><path d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" stroke="${c}" class="fluss${an ? " an" : ""}" style="animation-delay:-${(i * 0.3).toFixed(1)}s"/>`;
    });
    svg.setAttribute("viewBox", `0 0 ${st.scrollWidth} ${st.scrollHeight}`);
    svg.style.width = `${st.scrollWidth}px`; svg.style.height = `${st.scrollHeight}px`;
    svg.innerHTML = p;
  }
  function zeichne() {
    if (!bau) return;
    ist("#ia-links").innerHTML = gruppenHtml("einbinden");
    ist("#ia-rechts").innerHTML = gruppenHtml("bauen");
    ist("#ia-kern").innerHTML = kernHtml();
    ist("#ia-kern-zahl").textContent = `${bau.zahlen.offen + kiListe.length} Ideen`;
    ist("#ia-zahlen").innerHTML = `<b>${bau.zahlen.offen + kiListe.length}</b> Ideen offen · <b>${bau.zahlen.schonDa}</b> schon eingebaut (ausgeblendet) · <b>${bau.zahlen.wunschliste}</b> auf der Wunschliste`;
    ist("#ia-alltag-info").textContent = `aus ${bau.zahlen.gespraeche} Gesprächen der letzten ${bau.zahlen.tage} Tage`;
    const passend = bau.passend.map((id) => bau.vorschlaege.find((v) => v.id === id)).filter(Boolean);
    ist("#ia-passend").innerHTML = passend.length ? passend.map(kachel).join("") : '<p class="hf-leer">Noch zu wenig Gespräche. Je mehr du mit Friday sprichst, desto besser passen die Vorschläge.</p>';
    ist("#ia-luecken").innerHTML = bau.luecken.length ? bau.luecken.map((l) => `<div class="ia-luecke"><b>„${esc(l.frage)}“</b><span>${esc(l.antwort.slice(0, 120))}</span><button class="hf-mini" type="button" data-luecke="${esc(l.frage)}" title="Als Wunsch merken">⭐</button></div>`).join("") : '<p class="hf-leer">Keine Lücken gefunden – Friday konnte bisher alles beantworten.</p>';
    requestAnimationFrame(kabel);
  }
  async function bauLaden(fokus) {
    try {
      [bau] = await Promise.all([json("/api/ideen/ausbau"), tresor.length ? null : laden()]);
      if (fokus) wahl = bau.vorschlaege.find((v) => v.id === fokus) || null;
      zeichne();
    } catch (err) { ist("#ia-zahlen").textContent = err.message; }
  }
  function zeigeReiter(r, fokus) {
    reiter = r === "ausbau" ? "ausbau" : "ideen";
    w.$$("#id-reiter .hf-tab").forEach((x) => x.classList.toggle("an", x.dataset.r === reiter));
    $("#id-p-ideen").classList.toggle("hidden", reiter !== "ideen");
    ia.classList.toggle("hidden", reiter !== "ausbau");
    w.sheet.querySelector(".hf-box").classList.toggle("id-breit", reiter === "ausbau");
    if (reiter === "ausbau") bauLaden(fokus);
  }
  $("#id-reiter").addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (b) zeigeReiter(b.dataset.r); });
  ia.addEventListener("click", async (e) => {
    const k = e.target.closest("[data-v]");
    if (k) {
      wahl = [...bau.vorschlaege, ...kiListe].find((v) => v.id === k.dataset.v) || null;
      zeichne();
      if (matchMedia("(max-width: 900px)").matches) ist(".ia-kern")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (e.target.closest("[data-zu]")) { wahl = null; zeichne(); return; }
    if (e.target.closest("[data-wunsch]") && wahl) {
      try {
        await json("/api/ideen", { body: { titel: wahl.titel, text: `${wahl.pitch}\nNutzen: ${wahl.nutzen}\nBraucht: ${wahl.braucht} · Kosten: ${wahl.kosten}`, bereich: "friday", ausbau: wahl.ki ? undefined : wahl.id } });
        await laden(); bau.zahlen.wunschliste++; zeichne();
      } catch (err) { ist("#ia-zahlen").textContent = err.message; }
      return;
    }
    if (e.target.closest("[data-auftrag]") && wahl) {
      try {
        const { text } = await json("/api/ideen/ausbau/auftrag", { body: wahl });
        const box = ist(".ia-auftrag"); box.classList.remove("hidden");
        const ta = box.querySelector("textarea"); ta.value = text;
        try { await navigator.clipboard.writeText(text); } catch { ta.select(); try { document.execCommand("copy"); } catch { /* egal */ } }
      } catch (err) { ist("#ia-zahlen").textContent = err.message; }
      return;
    }
    const l = e.target.closest("[data-luecke]");
    if (l) {
      try { await json("/api/ideen", { body: { titel: `Friday soll können: ${l.dataset.luecke}`.slice(0, 120), text: `Friday konnte das noch nicht beantworten: „${l.dataset.luecke}“`, bereich: "friday" } }); l.textContent = "✓"; l.disabled = true; await laden(); bau.zahlen.wunschliste++; ist("#ia-zahlen").innerHTML = `<b>${bau.zahlen.offen + kiListe.length}</b> Ideen offen · <b>${bau.zahlen.schonDa}</b> schon eingebaut (ausgeblendet) · <b>${bau.zahlen.wunschliste}</b> auf der Wunschliste`; } catch (err) { ist("#ia-zahlen").textContent = err.message; }
    }
  });
  ist("#ia-ki").addEventListener("click", async () => {
    const b = ist("#ia-ki"); b.disabled = true; const alt = b.textContent; b.textContent = "Claude denkt nach …";
    try { kiListe = (await json("/api/ideen/ausbau/ki", { body: {} })).vorschlaege || []; zeichne(); }
    catch (err) { ist("#ia-zahlen").textContent = err.status === 402 ? "Fridays Guthaben ist leer – KI-Vorschläge brauchen Claude. Der Bauplan läuft ohne." : err.message; }
    finally { b.disabled = false; b.textContent = alt; }
  });
  addEventListener("resize", () => { if (reiter === "ausbau" && w.offen()) kabel(); });

  const st2 = document.createElement("style");
  st2.textContent = `
.hf-box.id-breit { width: min(1320px, 100%); }
.ia { display: flex; flex-direction: column; gap: 12px; }
.ia.hidden, .id-p.hidden, .ia-auftrag.hidden { display: none; }
.ia-kopf { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ia-gebaut { margin: 8px 0; font-size: 12.5px; color: var(--muted); }
.ia-gebaut summary { cursor: pointer; color: #38e08c; }
.ia-gebaut p { margin: 6px 0 0; line-height: 1.5; }
.ia-zahlen { flex: 1; font: 500 12.5px ui-monospace, Menlo, monospace; color: var(--muted); }
.ia-zahlen b { color: var(--cyan); }
.ia-stage { position: relative; display: grid; grid-template-columns: minmax(260px, 1fr) minmax(300px, 1.05fr) minmax(260px, 1fr); gap: clamp(26px, 3.4vw, 56px); align-items: start; padding: 6px 4px 10px; border-radius: 14px; background: radial-gradient(ellipse at 50% 45%, rgba(255,138,42,.08), transparent 60%); }
.ia-kabel { position: absolute; left: 0; top: 0; pointer-events: none; overflow: visible; z-index: 0; }
.ia-kabel path { fill: none; stroke-width: 1.5; stroke-linecap: round; opacity: .45; }
.ia-kabel path.fluss { stroke-width: 2.1; stroke-dasharray: 4 22; opacity: .9; animation: ia-fluss 1.7s linear infinite; }
.ia-kabel path.an { opacity: 1; stroke-width: 2.4; }
.ia-kabel path.fluss.an { animation-duration: .6s; }
@keyframes ia-fluss { to { stroke-dashoffset: -26; } }
.ia-seite, .ia-mitte { position: relative; z-index: 1; min-width: 0; }
.ia-seite { background: linear-gradient(170deg, rgba(40,30,60,.32), rgba(8,8,14,.55)); border: 1px solid rgba(169,120,255,.2); border-radius: 16px; padding: 10px 12px 12px; box-shadow: inset 0 0 30px rgba(120,90,255,.05); }
.ia-pille { display: inline-flex; gap: 8px; align-items: baseline; font: 600 10.5px/1 var(--font-head, var(--font)); letter-spacing: .2em; color: #fff; padding: 6px 11px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,.1); border-radius: 999px; background: rgba(255,255,255,.03); text-shadow: 0 0 8px color-mix(in srgb, var(--cyan) 60%, transparent); }
.ia-pille small { font: 500 10.5px var(--font-ui, var(--font)); letter-spacing: .02em; color: var(--muted); text-shadow: none; }
.ia-gruppen { display: flex; flex-direction: column; gap: 10px; }
.ia-g { position: relative; }
.ia-g h4 { margin: 0 0 5px; font: 600 10px/1 var(--font-head, var(--font)); letter-spacing: .2em; text-transform: uppercase; color: var(--c); }
.ia-port { position: absolute; top: 50%; width: 10px; height: 10px; margin-top: -5px; border-radius: 50%; background: var(--c); box-shadow: 0 0 10px var(--c); }
#ia-links .ia-port { right: -17px; } #ia-rechts .ia-port { left: -17px; }
.ia-ks { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 6px; }
.ia-k { --c: #ff8a2a; display: flex; flex-direction: column; justify-content: space-between; gap: 5px; min-height: 58px; padding: 7px 8px; border-radius: 11px; cursor: pointer; color: inherit; font: inherit; text-align: left;
  background: linear-gradient(165deg, color-mix(in srgb, var(--c) 26%, rgba(20,16,30,.6)), color-mix(in srgb, var(--c) 6%, rgba(8,8,12,.85)));
  border: 1px solid color-mix(in srgb, var(--c) 45%, transparent); box-shadow: inset 0 1px 0 rgba(255,255,255,.1), inset 0 0 16px color-mix(in srgb, var(--c) 16%, transparent); transition: transform .15s, box-shadow .15s, border-color .15s; }
.ia-k:hover, .ia-k:focus-visible, .ia-k.wahl { transform: translateY(-2px); border-color: var(--c); box-shadow: 0 0 16px color-mix(in srgb, var(--c) 45%, transparent), inset 0 0 22px color-mix(in srgb, var(--c) 28%, transparent); outline: none; }
.ia-k.da { opacity: .5; }
.ia-k-t { font-size: 11.5px; line-height: 1.2; font-weight: 600; color: #f3eee8; overflow-wrap: anywhere; hyphens: auto; }
.ia-k-u { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.ia-k-u em { font-style: normal; font-size: 9.5px; padding: 1px 6px; border-radius: 999px; background: color-mix(in srgb, var(--c) 30%, transparent); color: #fff; }
.ia-k-u em.ok { background: rgba(56,224,140,.25); }
.ia-aufwand { display: inline-flex; gap: 2px; }
.ia-aufwand i { width: 9px; height: 4px; border-radius: 2px; background: rgba(255,255,255,.15); }
.ia-aufwand i.an { background: var(--c, var(--cyan)); box-shadow: 0 0 5px var(--c, var(--cyan)); }
.ia-mitte { position: sticky; top: 0; }
.ia-sockel { height: 36px; margin: 0 18%; position: relative; background: linear-gradient(90deg, transparent 49.6%, rgba(255,138,42,.35) 50%, transparent 50.4%); }
.ia-sockel::before { content: ""; position: absolute; left: 50%; bottom: 0; width: 56%; aspect-ratio: 2 / 1; transform: translateX(-50%); border: 1px solid rgba(255,138,42,.3); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); background: linear-gradient(180deg, rgba(255,138,42,.1), rgba(255,138,42,.02)); }
.ia-sockel.unten::before { bottom: auto; top: 0; }
.ia-kern { border-radius: 14px; border: 1px solid rgba(255,138,42,.5); background: linear-gradient(180deg, rgba(22,16,10,.94), rgba(10,8,6,.96)); box-shadow: 0 0 40px rgba(255,138,42,.18), inset 0 0 40px rgba(255,138,42,.05); overflow: hidden; }
.ia-kern-leiste { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-bottom: 1px solid rgba(255,138,42,.18); font: 600 11px/1 ui-monospace, Menlo, monospace; color: var(--muted); }
.ia-kern-leiste i { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,138,42,.5); }
.ia-kern-leiste i:nth-child(2) { opacity: .6; } .ia-kern-leiste i:nth-child(3) { opacity: .35; }
.ia-kern-leiste span { flex: 1; margin-left: 6px; } .ia-kern-leiste b { color: var(--cyan); font-weight: 600; }
.ia-kern-inhalt { padding: 12px 14px 14px; min-height: 250px; font-size: 13px; line-height: 1.45; }
.ia-intro b { color: #fff; }
.ia-intro p { margin: 6px 0; color: var(--text); opacity: .85; }
.ia-intro ul { list-style: none; padding: 0; margin: 10px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.ia-intro li { padding: 7px 9px; border-radius: 10px; border: 1px solid var(--u-rand-soft, rgba(255,138,30,.3)); background: rgba(255,138,30,.06); font-size: 11.5px; color: var(--muted); }
.ia-intro li b { display: block; font: 700 18px var(--font-ui, var(--font)); color: var(--cyan); text-shadow: 0 0 10px color-mix(in srgb, var(--cyan) 60%, transparent); }
.ia-tipp { font-size: 11.5px; color: var(--muted) !important; }
.ia-detail h3 { margin: 4px 0 6px; font-size: 18px; color: #fff; text-shadow: 0 0 12px var(--c); }
.ia-detail p { margin: 0 0 8px; }
.ia-d-kopf { display: flex; align-items: center; justify-content: space-between; }
.ia-art { font: 600 10px/1 var(--font-head, var(--font)); letter-spacing: .18em; color: var(--c); }
.ia-zu { border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 14px; }
.ia-detail dl { display: grid; grid-template-columns: 78px 1fr; gap: 4px 10px; margin: 0 0 10px; font-size: 12.5px; }
.ia-detail dt { color: var(--muted); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; padding-top: 2px; }
.ia-detail dd { margin: 0; }
.ia-ok { color: #38e08c; }
.ia-auftrag textarea { width: 100%; margin-top: 8px; font: 12px ui-monospace, Menlo, monospace; background: rgba(0,0,0,.4); color: inherit; border: 1px solid var(--u-rand-soft, rgba(255,138,30,.3)); border-radius: 8px; padding: 8px; }
.ia-alltag { border: 1px solid var(--u-rand-soft, rgba(255,138,30,.3)); border-radius: 16px; padding: 10px 12px 12px; background: linear-gradient(180deg, rgba(28,16,6,.6), rgba(10,7,4,.7)); }
.ia-alltag-in { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ia-alltag h4 { margin: 0 0 6px; font-size: 12.5px; }
.ia-mini { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; }
#ia-luecken { display: flex; flex-direction: column; gap: 5px; }
.ia-luecke { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 6px 8px; border-radius: 9px; background: rgba(255,138,30,.06); font-size: 12px; }
.ia-luecke span { grid-column: 1; color: var(--muted); font-size: 11px; }
.ia-luecke button { grid-row: 1 / 3; grid-column: 2; align-self: center; }
@media (max-width: 900px) {
  .ia-stage { grid-template-columns: 1fr; gap: 12px; }
  .ia-kabel, .ia-port, .ia-sockel { display: none; }
  .ia-mitte { position: static; order: -1; }
  .ia-alltag-in { grid-template-columns: 1fr; }
  .ia-ks { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
}`;
  document.head.appendChild(st2);

  window.FridayIdeen = { open: (opts) => w.auf(opts), offen: w.offen };
})();
