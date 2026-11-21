// F.R.Ai.D.A.Y Kontrollraum (v1.135.0) – acht Bausteine aus Conway-Research/automaton (MIT), für Friday nachgebaut:
// 🛡 Regelwerk + 🔁 Schleifen-Schutz · 🧠 Gedächtnis-Schubladen · 💓 Herzschlag · 💰 Kosten-Deckel
// ✨ Seele · 🧩 Fähigkeiten · 🕘 Änderungs-Protokoll
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;

  const TABS = [
    ["regeln", "🛡 Regeln"], ["gedaechtnis", "🧠 Gedächtnis"], ["herzschlag", "💓 Herzschlag"], ["kosten", "💰 Kosten-Deckel"],
    ["seele", "✨ Seele"], ["faehigkeiten", "🧩 Fähigkeiten"], ["aenderungen", "🕘 Änderungen"],
  ];
  let tab = "regeln";
  const zeit = (iso) => { try { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  const usd = (v) => `${(Number(v) || 0).toFixed(2).replace(".", ",")} $`;

  const w = H.fenster({
    id: "kern", titel: "🧭 Kontrollraum", klasse: "kr-box",
    html: `
      <div id="kr-kopf" class="kr-kopf"></div>
      <div class="hf-tabs" role="tablist">${TABS.map(([id, n]) => `<button class="hf-tab${id === tab ? " an" : ""}" data-tab="${id}" role="tab">${n}</button>`).join("")}</div>
      <div id="kr-status" class="hf-status"></div>
      <div id="kr-seite"></div>
      <p class="hf-hinweis">Ideen aus dem Open-Source-Projekt Automaton (Conway Research, MIT-Lizenz), für Friday nachgebaut. Bewusst weggelassen: Krypto-Wallet, Geld verdienen, sich selbst kopieren und den eigenen Code umschreiben.</p>`,
    onOpen: () => laden(),
  });
  const $ = w.$;
  const status = (t, fehler = false) => { const s = $("#kr-status"); s.textContent = t || ""; s.classList.toggle("fehler", fehler); };
  w.$$(".hf-tab").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; laden(); }));

  async function kopf() {
    try {
      const k = await json("/api/kern");
      const stufe = { normal: ["hf-gut", "Normal"], sparsam: ["hf-warn", "Sparsam"], gesperrt: ["hf-schlecht", "Gesperrt"] }[k.kosten.stufe] || ["hf-info", k.kosten.stufe];
      $("#kr-kopf").innerHTML = `
        <div class="kr-kachel"><b>${k.regeln.heute.geprueft}</b><span>heute geprüft</span><small class="${k.regeln.heute.gestoppt ? "hf-schlecht" : "hf-gut"}">${k.regeln.heute.gestoppt} gestoppt</small></div>
        <div class="kr-kachel"><b>${k.gedaechtnis.fakten}</b><span>Fakten</span><small>${k.gedaechtnis.ablaeufe} Abläufe</small></div>
        <div class="kr-kachel"><b><i class="kr-puls">♥</i> ${k.herzschlag.verlauf.length ? zeit(k.herzschlag.verlauf[0].zeit).slice(-5) : "–"}</b><span>Herzschlag</span><small>${k.herzschlag.aufgaben.filter((a) => a.an).length} Aufgaben aktiv</small></div>
        <div class="kr-kachel"><b>${usd(k.kosten.heute)}</b><span>heute</span><small class="${stufe[0]}">${stufe[1]}</small></div>
        <div class="kr-kachel"><b>${k.faehigkeiten}</b><span>Fähigkeiten</span><small>${k.schleifen.zaehler.abbruch || 0} Schleifen gestoppt</small></div>`;
    } catch { /* Kopf ist nicht wichtig */ }
  }

  async function laden() {
    w.$$(".hf-tab").forEach((b) => b.classList.toggle("an", b.dataset.tab === tab));
    status("");
    kopf();
    const seite = $("#kr-seite");
    try {
      if (tab === "regeln") await regeln(seite);
      else if (tab === "gedaechtnis") await gedaechtnis(seite);
      else if (tab === "herzschlag") await herzschlag(seite);
      else if (tab === "kosten") await kosten(seite);
      else if (tab === "seele") await seele(seite);
      else if (tab === "faehigkeiten") await faehigkeiten(seite);
      else if (tab === "aenderungen") await aenderungen(seite);
    } catch (err) {
      seite.innerHTML = "";
      status(err.message, true);
    }
  }

  // ---------- 🛡 Regeln + 🔁 Schleifen ----------
  async function regeln(el) {
    const [r, s] = await Promise.all([json("/api/kern/regeln"), json("/api/kern/schleifen")]);
    el.innerHTML = `
      <div class="hf-zwei">
        <div class="hf-karte"><h3>Regeln vor jedem Werkzeug</h3>
          <ul class="hf-liste">${r.regeln.map((x) => `<li class="hf-zeile"><span class="icon">${x.fest ? "🔒" : "🛡"}</span><span class="name"><b>${esc(x.name)}</b><br><span class="klein">${esc(x.text)}</span></span>
            ${x.fest ? `<span class="hf-badge hf-gut">immer an</span>` : `<label class="kr-schalter"><input type="checkbox" data-regel="${x.id}" ${x.an ? "checked" : ""}><i></i></label>`}</li>`).join("")}</ul>
          <p class="hf-hinweis">Fragen, bevor etwas passiert, macht die Freigabe-Glocke (Modul-Zentrale → Kontrolle). Das Regelwerk entscheidet nur: erlaubt oder verboten.</p>
        </div>
        <div class="hf-karte"><h3>Risiko-Stufen</h3>
          <ul class="hf-liste">${Object.values(r.stufen).map((x) => `<li class="hf-zeile"><span class="hf-badge hf-${x.farbe}">${esc(x.text)}</span><span class="name klein">${esc(x.info)}</span></li>`).join("")}</ul>
          <h3 style="margin-top:14px !important">🔁 Schleifen-Schutz</h3>
          <p class="hf-hinweis">${s.grenzen.hinweis}× genau dasselbe hintereinander → Friday bekommt einen Hinweis. ${s.grenzen.abbruch}× → Friday hört auf. ${s.grenzen.leerlauf} Runden nur Nachschauen → Friday antwortet mit dem, was sie hat.</p>
          <div class="hf-reihe"><span class="hf-badge hf-warn">${s.zaehler.hinweis || 0} Hinweise</span><span class="hf-badge hf-schlecht">${s.zaehler.abbruch || 0} Abbrüche</span><span class="hf-badge hf-info">${s.zaehler.leerlauf || 0} Leerlauf</span></div>
          ${s.faelle.length ? `<ul class="hf-liste" style="margin-top:8px">${s.faelle.slice(0, 5).map((f) => `<li class="hf-zeile"><span class="name klein">${zeit(f.zeit)} · ${esc(f.werkzeuge)} (${f.anzahl}×)</span><span class="hf-badge ${f.art === "abbruch" ? "hf-schlecht" : "hf-warn"}">${esc(f.art)}</span></li>`).join("")}</ul>` : ""}
        </div>
      </div>
      <div class="hf-karte"><h3>Letzte Entscheidungen</h3>
        ${r.entscheidungen.length ? `<ul class="hf-liste">${r.entscheidungen.slice(0, 40).map((e) => `<li class="hf-zeile"><span class="icon">${e.erlaubt ? "✅" : "⛔"}</span><span class="name"><b>${esc(e.werkzeug)}</b> <span class="hf-badge hf-${r.stufen[e.stufe]?.farbe || "info"}">${esc(r.stufen[e.stufe]?.text || e.stufe)}</span><br><span class="klein">${zeit(e.zeit)}${e.kanal ? ` · ${esc(e.kanal)}` : ""}${e.grund ? ` · ${esc(e.grund)}` : e.eingabe ? ` · ${esc(e.eingabe.slice(0, 90))}` : ""}</span></span></li>`).join("")}</ul>` : `<div class="hf-leer">Noch keine Entscheidungen. Sobald Friday Werkzeuge benutzt, steht hier, was erlaubt oder gestoppt wurde.</div>`}
      </div>`;
    el.querySelectorAll("[data-regel]").forEach((c) => c.addEventListener("change", async () => {
      try { await json(`/api/kern/regeln/${c.dataset.regel}`, { body: { an: c.checked } }); status(c.checked ? "Regel ist an." : "Regel ist aus."); kopf(); }
      catch (err) { c.checked = !c.checked; status(err.message, true); }
    }));
  }

  // ---------- 🧠 Gedächtnis ----------
  let schublade = "";
  async function gedaechtnis(el) {
    const g = await json("/api/kern/gedaechtnis");
    const fakten = schublade ? g.fakten.filter((f) => f.schublade === schublade) : g.fakten;
    const optionen = (sel) => Object.entries(g.schubladen).map(([k, [i, n]]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${i} ${esc(n)}</option>`).join("");
    el.innerHTML = `
      <div class="hf-karte"><h3>📌 Fakten in Schubladen</h3>
        <div class="hf-reihe kr-schub"><button class="hf-tab ${schublade ? "" : "an"}" data-schub="">Alle (${g.fakten.length})</button>${Object.entries(g.schubladen).map(([k, [i, n]]) => `<button class="hf-tab ${schublade === k ? "an" : ""}" data-schub="${k}">${i} ${esc(n)} (${g.zaehl[k] || 0})</button>`).join("")}</div>
        <div class="hf-reihe" style="margin:10px 0"><input id="kr-fakt" class="hf-input grow" maxlength="500" placeholder="Neuer Fakt, z. B. Meine Frau heißt …" aria-label="Neuer Fakt"><select id="kr-fakt-s" class="hf-input" style="width:auto" aria-label="Schublade"><option value="">automatisch</option>${optionen("")}</select><button id="kr-fakt-ok" class="hf-btn haupt">Merken</button></div>
        ${fakten.length ? `<ul class="hf-liste">${fakten.slice(0, 150).map((f) => `<li class="hf-zeile"><span class="icon">${g.schubladen[f.schublade]?.[0] || "📌"}</span><span class="name">${esc(f.text)}<br><span class="klein">${f.created ? zeit(f.created) : ""}</span></span>
          <select class="hf-input kr-mini-sel" data-fakt="${esc(f.id)}" aria-label="Schublade ändern">${optionen(f.schublade)}</select><button class="hf-mini" data-weg="${esc(f.id)}" title="Vergessen">✕</button></li>`).join("")}</ul>` : `<div class="hf-leer">In dieser Schublade liegt noch nichts.</div>`}
        <p class="hf-hinweis">Vor jeder Antwort holt sich Friday nur die Fakten, die zur Frage passen (bei sehr vielen Einträgen). Das spart Guthaben.</p>
      </div>
      <div class="hf-zwei">
        <div class="hf-karte"><h3>🧭 Abläufe</h3>
          ${g.ablaeufe.length ? `<ul class="hf-liste">${g.ablaeufe.map((a) => `<li class="hf-zeile" style="align-items:flex-start"><span class="icon">🧭</span><span class="name"><b>${esc(a.name)}</b> <span class="hf-badge hf-gut">${a.erfolg}× geklappt</span>${a.fehlschlag ? ` <span class="hf-badge hf-schlecht">${a.fehlschlag}× nicht</span>` : ""}<ol class="kr-schritte">${a.schritte.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></span><button class="hf-mini" data-ablauf-weg="${esc(a.id)}">✕</button></li>`).join("")}</ul>` : `<div class="hf-leer">Noch keine Abläufe. Sag zum Beispiel: „Friday, merk dir: Wenn ich Filmabend sage, mach das Licht gedimmt, den Fernseher an und Netflix auf.“</div>`}
          <details class="kr-neu"><summary>+ Ablauf selbst anlegen</summary>
            <div class="hf-feld"><input id="kr-ab-name" maxlength="80" placeholder="Name, z. B. Filmabend"><textarea id="kr-ab-schritte" placeholder="Ein Schritt pro Zeile"></textarea></div>
            <button id="kr-ab-ok" class="hf-btn" style="margin-top:8px">Speichern</button></details>
        </div>
        <div class="hf-karte"><h3>🕘 Ereignisse (zuletzt)</h3>
          ${g.ereignisse.length ? `<ul class="hf-liste">${g.ereignisse.slice(0, 30).map((e) => `<li class="hf-zeile"><span class="icon">${e.ok ? "•" : "⚠"}</span><span class="name klein">${zeit(e.zeit)} · ${esc(e.kurz || e.werkzeug)}</span></li>`).join("")}</ul>` : `<div class="hf-leer">Noch keine Ereignisse.</div>`}
        </div>
      </div>`;
    el.querySelectorAll("[data-schub]").forEach((b) => b.addEventListener("click", () => { schublade = b.dataset.schub; gedaechtnis(el); }));
    el.querySelector("#kr-fakt-ok").addEventListener("click", async () => {
      const t = el.querySelector("#kr-fakt").value.trim();
      if (!t) return;
      try { await json("/api/kern/gedaechtnis/fakt", { body: { text: t, schublade: el.querySelector("#kr-fakt-s").value || undefined } }); status("Gemerkt."); gedaechtnis(el); kopf(); } catch (err) { status(err.message, true); }
    });
    el.querySelectorAll("[data-fakt]").forEach((s) => s.addEventListener("change", async () => {
      try { await json(`/api/kern/gedaechtnis/fakt/${encodeURIComponent(s.dataset.fakt)}`, { body: { schublade: s.value } }); status("Umgeräumt."); gedaechtnis(el); } catch (err) { status(err.message, true); }
    }));
    el.querySelectorAll("[data-weg]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Diesen Fakt vergessen? (Er bleibt im Änderungs-Protokoll und lässt sich zurückholen.)")) return;
      try { await json(`/api/kern/gedaechtnis/fakt/${encodeURIComponent(b.dataset.weg)}`, { method: "DELETE" }); gedaechtnis(el); kopf(); } catch (err) { status(err.message, true); }
    }));
    el.querySelectorAll("[data-ablauf-weg]").forEach((b) => b.addEventListener("click", async () => {
      try { await json(`/api/kern/gedaechtnis/ablauf/${encodeURIComponent(b.dataset.ablaufWeg)}`, { method: "DELETE" }); gedaechtnis(el); } catch (err) { status(err.message, true); }
    }));
    el.querySelector("#kr-ab-ok").addEventListener("click", async () => {
      try { await json("/api/kern/gedaechtnis/ablauf", { body: { name: el.querySelector("#kr-ab-name").value, schritte: el.querySelector("#kr-ab-schritte").value } }); status("Ablauf gespeichert."); gedaechtnis(el); kopf(); } catch (err) { status(err.message, true); }
    });
  }

  // ---------- 💓 Herzschlag ----------
  async function herzschlag(el) {
    const h = await json("/api/kern/herzschlag");
    el.innerHTML = `
      <div class="hf-karte"><h3><span class="kr-puls">♥</span> Hintergrund-Aufgaben (Takt: jede Minute)</h3>
        <ul class="hf-liste">${h.aufgaben.map((a) => `<li class="hf-zeile"><label class="kr-schalter"><input type="checkbox" data-hs-an="${a.id}" ${a.an ? "checked" : ""}><i></i></label>
          <span class="name"><b>${esc(a.name)}</b><br><span class="klein">${esc(a.text)}</span><br><span class="klein">${a.letzte ? `Zuletzt ${zeit(a.letzte.zeit)}: ${a.letzte.ok ? "" : "⚠ "}${esc(a.letzte.text)}` : "Noch nicht gelaufen"}</span></span>
          ${a.art === "intervall" ? `<label class="klein">alle <input class="hf-input kr-zahl" type="number" min="1" max="1440" value="${a.minuten}" data-hs-min="${a.id}" aria-label="Minuten"> Min.</label>` : `<label class="klein">um <input class="hf-input kr-zeit" type="time" value="${a.zeit}" data-hs-zeit="${a.id}" aria-label="Uhrzeit"></label>`}
          <button class="hf-mini" data-hs-jetzt="${a.id}" ${a.laeuft ? "disabled" : ""}>▶ jetzt</button></li>`).join("")}</ul>
        <p class="hf-hinweis">Alles hier ist kostenlos (ohne Claude). Eine Aufgabe läuft nie doppelt. Eigene „Wenn … dann …“-Regeln (z. B. jeden Morgen um 7 ein Briefing) baust du in der Modul-Zentrale unter Automationen.</p>
      </div>
      <div class="hf-karte"><h3>Verlauf</h3>
        ${h.verlauf.length ? `<ul class="hf-liste">${h.verlauf.map((v) => `<li class="hf-zeile"><span class="icon">${v.ok ? "♥" : "⚠"}</span><span class="name klein">${zeit(v.zeit)} · <b>${esc(h.aufgaben.find((a) => a.id === v.id)?.name || v.id)}</b> · ${esc(v.text)}${v.wie !== "takt" ? ` (${esc(v.wie)})` : ""}</span><span class="klein">${v.dauer_ms} ms</span></li>`).join("")}</ul>` : `<div class="hf-leer">Der erste Herzschlag kommt etwa 20 Sekunden nach dem Start.</div>`}
      </div>`;
    const setze = async (id, body) => { try { await json(`/api/kern/herzschlag/${id}`, { body }); status("Gespeichert."); kopf(); } catch (err) { status(err.message, true); } };
    el.querySelectorAll("[data-hs-an]").forEach((c) => c.addEventListener("change", () => setze(c.dataset.hsAn, { an: c.checked })));
    el.querySelectorAll("[data-hs-min]").forEach((c) => c.addEventListener("change", () => setze(c.dataset.hsMin, { minuten: Number(c.value) })));
    el.querySelectorAll("[data-hs-zeit]").forEach((c) => c.addEventListener("change", () => setze(c.dataset.hsZeit, { zeit: c.value })));
    el.querySelectorAll("[data-hs-jetzt]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      try { await json(`/api/kern/herzschlag/${b.dataset.hsJetzt}/jetzt`, { body: {} }); status("Erledigt."); herzschlag(el); } catch (err) { status(err.message, true); b.disabled = false; }
    }));
  }

  // ---------- 💰 Kosten-Deckel ----------
  async function kosten(el) {
    const k = await json("/api/kern/kosten");
    const farbe = { normal: "hf-gut", sparsam: "hf-warn", gesperrt: "hf-schlecht" }[k.stufe];
    const text = { normal: "Normal – Friday denkt nach deinem Denk-Tempo.", sparsam: "Sparsam – günstiges Modell, keine Websuche.", gesperrt: "Gesperrt – nur Offline-Befehle bis zur nächsten Stunde/zum nächsten Tag." }[k.stufe];
    const max = Math.max(k.grenze.tag || 0, ...k.verlauf.map((v) => v.usd), 0.01);
    el.innerHTML = `
      <div class="hf-zwei">
        <div class="hf-karte"><h3>Jetzt</h3>
          <div class="hf-ampel ${farbe}"><span class="licht"></span><span><b>${esc(text)}</b><br><span class="klein">${esc(k.grund || "")}</span></span></div>
          <p class="klein" style="margin:12px 0 4px">Heute: <b>${usd(k.heute)}</b>${k.grenze.tag ? ` von ${usd(k.grenze.tag)}` : ""}</p>
          <div class="hf-balken"><i style="width:${Math.min(100, k.prozent.tag)}%"></i></div>
          <p class="klein" style="margin:10px 0 4px">Diese Stunde: <b>${usd(k.diese_stunde)}</b>${k.grenze.stunde ? ` von ${usd(k.grenze.stunde)}` : ""}</p>
          <div class="hf-balken"><i style="width:${Math.min(100, k.prozent.stunde)}%"></i></div>
        </div>
        <div class="hf-karte"><h3>Grenzen</h3>
          <label class="hf-reihe"><label class="kr-schalter"><input id="kr-k-an" type="checkbox" ${k.an ? "checked" : ""}><i></i></label> Kosten-Deckel an</label>
          <div class="hf-feld" style="margin-top:8px">Höchstens pro Stunde (Dollar, 0 = keine Grenze)<input id="kr-k-st" type="number" min="0" step="0.1" value="${k.grenze.stunde}"></div>
          <div class="hf-feld">Höchstens pro Tag (Dollar, 0 = keine Grenze)<input id="kr-k-tag" type="number" min="0" step="0.5" value="${k.grenze.tag}"></div>
          <div class="hf-feld">Sparen ab (% der Grenze)<input id="kr-k-spar" type="number" min="10" max="100" step="5" value="${k.grenze.spar_ab}"></div>
          <button id="kr-k-ok" class="hf-btn haupt" style="margin-top:8px">Speichern</button>
          <p class="hf-hinweis">Gezählt werden alle Claude-Kosten (Chat, Spiele, Werkstatt, Video). Es ist eine Schätzung wie im ⚡ Energie-Fenster. Friday bewegt dabei kein Geld, es ist nur eine Bremse.</p>
        </div>
      </div>
      <div class="hf-karte"><h3>Letzte 14 Tage</h3>
        ${k.verlauf.length ? `<div class="kr-saeulen">${k.verlauf.map((v) => `<div class="kr-saeule" title="${esc(v.tag)}: ${usd(v.usd)}"><i style="height:${Math.max(2, Math.round((v.usd / max) * 100))}%" class="${k.grenze.tag && v.usd >= k.grenze.tag ? "voll" : ""}"></i><span>${esc(v.tag.slice(8, 10))}.</span></div>`).join("")}</div>` : `<div class="hf-leer">Noch keine Kosten gebucht.</div>`}
      </div>`;
    el.querySelector("#kr-k-ok").addEventListener("click", async () => {
      try {
        await json("/api/kern/kosten", { body: { an: el.querySelector("#kr-k-an").checked, stunde: el.querySelector("#kr-k-st").value, tag: el.querySelector("#kr-k-tag").value, spar_ab: el.querySelector("#kr-k-spar").value } });
        status("Gespeichert."); kosten(el); kopf();
      } catch (err) { status(err.message, true); }
    });
  }

  // ---------- ✨ Seele ----------
  async function seele(el) {
    const s = await json("/api/kern/seele");
    el.innerHTML = `
      <div class="hf-zwei kr-seele">
        <div class="hf-karte"><h3>Fridays Seele</h3>
          <div class="hf-feld"><textarea id="kr-seele" maxlength="${s.max}" spellcheck="true" aria-label="Fridays Seele">${esc(s.text)}</textarea></div>
          <div class="hf-reihe" style="margin-top:8px"><button id="kr-seele-ok" class="hf-btn haupt">Speichern</button><span class="klein" id="kr-seele-z"></span></div>
          <p class="hf-hinweis">Friday liest das vor jeder Antwort. Sie selbst ergänzt nur „Was ich gelernt habe“, und der Herzschlag füllt „Was ich oft tue“. Alles andere bestimmst du.</p>
        </div>
        <div class="hf-karte"><h3>🔒 Feste Grenzen</h3>
          <ul class="hf-liste">${s.feste_grenzen.map((g) => `<li class="hf-zeile"><span class="icon">🔒</span><span class="name klein">${esc(g)}</span></li>`).join("")}</ul>
          <p class="hf-hinweis">Diese Grenzen stehen im Programm, nicht in der Datei. Sie gelten immer, auch wenn oben etwas anderes stünde.</p>
          <h3 style="margin-top:14px !important">Frühere Fassungen</h3>
          ${s.verlauf.length ? `<ul class="hf-liste">${s.verlauf.slice(0, 12).map((v) => `<li class="hf-zeile"><span class="name klein">${zeit(v.zeit)} · ${esc(v.wer)} · ${esc(v.grund)}</span><button class="hf-mini" data-seele-zurueck="${v.nr}">↺ zurück</button></li>`).join("")}</ul>` : `<div class="hf-leer">Noch keine früheren Fassungen.</div>`}
        </div>
      </div>`;
    const ta = el.querySelector("#kr-seele");
    const zaehl = () => { el.querySelector("#kr-seele-z").textContent = `${ta.value.length} / ${s.max} Zeichen`; };
    ta.addEventListener("input", zaehl); zaehl();
    el.querySelector("#kr-seele-ok").addEventListener("click", async () => {
      try { await json("/api/kern/seele", { body: { text: ta.value } }); status("Seele gespeichert."); seele(el); } catch (err) { status(err.message, true); }
    });
    el.querySelectorAll("[data-seele-zurueck]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Diese frühere Fassung zurückholen? Die jetzige wird vorher aufgehoben.")) return;
      try { await json(`/api/kern/seele/zurueck/${b.dataset.seeleZurueck}`, { body: {} }); status("Zurückgeholt."); seele(el); } catch (err) { status(err.message, true); }
    }));
  }

  // ---------- 🧩 Fähigkeiten ----------
  let bearbeite = null;
  async function faehigkeiten(el) {
    const { faehigkeiten: l } = await json("/api/kern/faehigkeiten");
    const f = bearbeite ? l.find((x) => x.id === bearbeite) || {} : {};
    el.innerHTML = `
      <div class="hf-zwei">
        <div class="hf-karte"><h3>Deine Fähigkeiten</h3>
          ${l.length ? `<ul class="hf-liste">${l.map((x) => `<li class="hf-zeile"><label class="kr-schalter"><input type="checkbox" data-fa-an="${esc(x.id)}" ${x.aktiv ? "checked" : ""}><i></i></label>
            <span class="name"><b>${esc(x.name)}</b> ${x.von === "friday" ? `<span class="hf-badge hf-info">von Friday</span>` : x.von === "vorlage" ? `<span class="hf-badge hf-info">Beispiel</span>` : ""}<br><span class="klein">${esc(x.beschreibung || "")}</span><br><span class="klein">Auslöser: ${x.ausloeser.map(esc).join(", ")}</span></span>
            <button class="hf-mini" data-fa-edit="${esc(x.id)}">✎</button><button class="hf-mini" data-fa-weg="${esc(x.id)}">✕</button></li>`).join("")}</ul>` : `<div class="hf-leer">Noch keine Fähigkeiten.</div>`}
          <div class="hf-reihe" style="margin-top:10px"><input id="kr-fa-test" class="hf-input grow" placeholder="Testen: Was würdest du Friday fragen?" aria-label="Fähigkeit testen"><button id="kr-fa-test-ok" class="hf-btn leise">Welche greift?</button></div>
          <p class="hf-hinweis">Liegt als Textdatei in server/data/faehigkeiten/. Kommt ein Auslöser-Wort in deiner Frage vor, liest Friday die Anleitung mit (höchstens drei auf einmal). Du kannst Friday auch sagen: „Lerne, wie man …“.</p>
        </div>
        <div class="hf-karte"><h3>${f.id ? `Bearbeiten: ${esc(f.name)}` : "Neue Fähigkeit"}</h3>
          <div class="hf-feld">Name<input id="kr-fa-name" maxlength="60" value="${esc(f.name || "")}" placeholder="z. B. Filmabend"></div>
          <div class="hf-feld">Kurze Beschreibung<input id="kr-fa-besch" maxlength="160" value="${esc(f.beschreibung || "")}"></div>
          <div class="hf-feld">Auslöser-Wörter (mit Komma)<input id="kr-fa-aus" value="${esc((f.ausloeser || []).join(", "))}" placeholder="filmabend, film, kino"></div>
          <div class="hf-feld">Anleitung für Friday<textarea id="kr-fa-text" maxlength="4000" placeholder="1. Licht dimmen&#10;2. Fernseher an&#10;3. Netflix öffnen">${esc(f.text || "")}</textarea></div>
          <div class="hf-reihe" style="margin-top:8px"><button id="kr-fa-ok" class="hf-btn haupt">${f.id ? "Speichern" : "Anlegen"}</button>${f.id ? `<button id="kr-fa-neu" class="hf-btn leise">Neue statt Bearbeiten</button>` : ""}</div>
        </div>
      </div>`;
    el.querySelectorAll("[data-fa-an]").forEach((c) => c.addEventListener("change", async () => {
      try { await json(`/api/kern/faehigkeiten/${c.dataset.faAn}/schalten`, { body: { an: c.checked } }); status(c.checked ? "Fähigkeit an." : "Fähigkeit aus."); } catch (err) { status(err.message, true); }
    }));
    el.querySelectorAll("[data-fa-edit]").forEach((b) => b.addEventListener("click", () => { bearbeite = b.dataset.faEdit; faehigkeiten(el); }));
    el.querySelectorAll("[data-fa-weg]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Diese Fähigkeit in den Papierkorb legen?")) return;
      try { await json(`/api/kern/faehigkeiten/${b.dataset.faWeg}`, { method: "DELETE" }); if (bearbeite === b.dataset.faWeg) bearbeite = null; faehigkeiten(el); kopf(); } catch (err) { status(err.message, true); }
    }));
    el.querySelector("#kr-fa-neu")?.addEventListener("click", () => { bearbeite = null; faehigkeiten(el); });
    el.querySelector("#kr-fa-test-ok").addEventListener("click", async () => {
      try {
        const r = await json("/api/kern/faehigkeiten/test", { body: { frage: el.querySelector("#kr-fa-test").value } });
        status(r.passend.length ? `Greift: ${r.passend.join(", ")}` : "Keine Fähigkeit greift bei dieser Frage.");
      } catch (err) { status(err.message, true); }
    });
    el.querySelector("#kr-fa-ok").addEventListener("click", async () => {
      try {
        await json("/api/kern/faehigkeiten", { body: { id: f.id, name: el.querySelector("#kr-fa-name").value, beschreibung: el.querySelector("#kr-fa-besch").value, ausloeser: el.querySelector("#kr-fa-aus").value, text: el.querySelector("#kr-fa-text").value, aktiv: f.id ? f.aktiv : true } });
        status("Gespeichert."); bearbeite = null; faehigkeiten(el); kopf();
      } catch (err) { status(err.message, true); }
    });
  }

  // ---------- 🕘 Änderungen ----------
  let datei = "";
  async function aenderungen(el) {
    const a = await json(`/api/kern/aenderungen?datei=${encodeURIComponent(datei)}`);
    const artText = { geaendert: "geändert", neu: "neu", geloescht: "gelöscht" };
    el.innerHTML = `
      <div class="hf-karte"><h3>Was sich geändert hat</h3>
        <div class="hf-reihe" style="margin-bottom:10px"><select id="kr-ae-datei" class="hf-input" style="width:auto" aria-label="Datei"><option value="">Alles</option>${a.dateien.map((d) => `<option value="${esc(d.datei)}" ${d.datei === datei ? "selected" : ""}>${esc(d.anzeige)}</option>`).join("")}</select><button id="kr-ae-jetzt" class="hf-btn leise">Jetzt sichern</button></div>
        ${a.versionen.length ? `<ul class="hf-liste">${a.versionen.map((v) => `<li class="hf-zeile" style="align-items:flex-start"><span class="icon">${v.art === "geloescht" ? "🗑" : v.art === "neu" ? "✚" : "✎"}</span>
          <span class="name"><b>${esc(v.anzeige)}</b> <span class="hf-badge hf-info">${esc(artText[v.art] || v.art)}</span>${v.plus || v.minus ? ` <span class="klein"><span class="hf-gut">+${v.plus}</span> <span class="hf-schlecht">−${v.minus}</span> Zeilen</span>` : ""}<br><span class="klein">${zeit(v.zeit)} · ${esc(v.grund)}</span>
          ${v.vorschau?.length ? `<div class="kr-diff">${v.vorschau.map((z) => `<div>+ ${esc(z)}</div>`).join("")}</div>` : ""}
          <div class="kr-voll hidden" data-voll="${esc(v.id)}"></div></span>
          <span class="kr-knoepfe">${v.art !== "geloescht" ? `<button class="hf-mini" data-ae-zeig="${esc(v.id)}">👁</button><button class="hf-mini" data-ae-zurueck="${esc(v.id)}">↺ zurück</button>` : ""}</span></li>`).join("")}</ul>` : `<div class="hf-leer">Noch keine Änderungen seit dem Start. Friday prüft alle fünf Minuten.</div>`}
        <p class="hf-hinweis">Gespeichert werden Einstellungen, Oberfläche, Seele, Fähigkeiten, Automationen, Herzschlag-Plan, Gedächtnis und eigene Protokolle. Schlüssel und Passwörter nie. Zurückholen hebt den jetzigen Stand vorher auf.</p>
      </div>`;
    el.querySelector("#kr-ae-datei").addEventListener("change", (e) => { datei = e.target.value; aenderungen(el); });
    el.querySelector("#kr-ae-jetzt").addEventListener("click", async () => {
      try { const r = await json("/api/kern/aenderungen/jetzt", { body: {} }); status(r.neu ? `${r.neu} neue Fassung(en) aufgehoben.` : "Nichts geändert."); aenderungen(el); } catch (err) { status(err.message, true); }
    });
    el.querySelectorAll("[data-ae-zeig]").forEach((b) => b.addEventListener("click", async () => {
      const box = el.querySelector(`[data-voll="${CSS.escape(b.dataset.aeZeig)}"]`);
      if (!box.classList.contains("hidden")) { box.classList.add("hidden"); return; }
      try { const r = await json(`/api/kern/aenderungen/${encodeURIComponent(b.dataset.aeZeig)}`); box.innerHTML = `<pre>${esc(r.text)}</pre>`; box.classList.remove("hidden"); } catch (err) { status(err.message, true); }
    }));
    el.querySelectorAll("[data-ae-zurueck]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Diese Fassung zurückholen? Der jetzige Stand wird vorher aufgehoben.")) return;
      try { const r = await json(`/api/kern/aenderungen/${encodeURIComponent(b.dataset.aeZurueck)}/zurueck`, { body: {} }); status(`Zurückgeholt. ${r.hinweis || ""}`); aenderungen(el); kopf(); } catch (err) { status(err.message, true); }
    }));
  }

  const style = document.createElement("style");
  style.textContent = `
.kr-kopf { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
.kr-kachel { border: 1px solid var(--u-rand-soft, var(--line)); border-radius: 14px; padding: 10px 12px; background: linear-gradient(180deg, rgba(255,140,30,.08), rgba(255,140,30,.02)); display: flex; flex-direction: column; gap: 2px; }
.kr-kachel b { font-size: 22px; color: var(--u-titel, var(--cyan)); text-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 45%, transparent); }
.kr-kachel span { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
.kr-kachel small { font-size: 12px; }
.kr-puls { display: inline-block; font-style: normal; color: #ff5a4a !important; animation: kr-puls 1.2s ease-in-out infinite; }
@keyframes kr-puls { 0%, 100% { transform: scale(1); } 15% { transform: scale(1.25); } 30% { transform: scale(1); } 45% { transform: scale(1.15); } }
.kr-schalter { position: relative; display: inline-block; width: 40px; height: 22px; flex: none; cursor: pointer; }
.kr-schalter input { opacity: 0; width: 0; height: 0; position: absolute; }
.kr-schalter i { position: absolute; inset: 0; border-radius: 99px; background: rgba(255,255,255,.12); border: 1px solid var(--u-rand-soft, var(--line)); transition: .2s; }
.kr-schalter i::after { content: ""; position: absolute; width: 16px; height: 16px; left: 2px; top: 2px; border-radius: 50%; background: var(--muted); transition: .2s; }
.kr-schalter input:checked + i { background: color-mix(in srgb, var(--cyan) 35%, transparent); border-color: var(--cyan); box-shadow: 0 0 10px color-mix(in srgb, var(--cyan) 40%, transparent); }
.kr-schalter input:checked + i::after { left: 20px; background: var(--cyan); }
.kr-schalter input:focus-visible + i { outline: 2px solid var(--cyan); outline-offset: 2px; }
.kr-schub .hf-tab { padding: 5px 10px; font-size: 12px; }
.kr-mini-sel { width: auto !important; padding: 4px 6px !important; font-size: 12px !important; flex: none; }
.kr-zahl { width: 64px !important; padding: 4px 6px !important; font-size: 13px !important; display: inline-block; }
.kr-zeit { width: 96px !important; padding: 4px 6px !important; font-size: 13px !important; display: inline-block; }
.kr-schritte { margin: 6px 0 0; padding-left: 18px; font-size: 13px; color: var(--muted); }
.kr-neu summary { cursor: pointer; color: var(--cyan); font-size: 13px; margin-top: 10px; }
.kr-neu .hf-feld { margin-top: 8px; }
.kr-seele textarea { min-height: 380px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
.kr-saeulen { display: flex; align-items: flex-end; gap: 6px; height: 120px; }
.kr-saeule { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; }
.kr-saeule i { width: 100%; max-width: 34px; border-radius: 6px 6px 2px 2px; background: linear-gradient(180deg, var(--cyan), color-mix(in srgb, var(--cyan) 40%, transparent)); box-shadow: 0 0 10px color-mix(in srgb, var(--cyan) 40%, transparent); }
.kr-saeule i.voll { background: linear-gradient(180deg, #ff5a4a, rgba(255,90,74,.35)); }
.kr-saeule span { font-size: 11px; color: var(--muted); }
.kr-diff { margin-top: 6px; font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; color: #45e38b; background: rgba(0,0,0,.3); border-radius: 8px; padding: 6px 8px; overflow-x: auto; }
.kr-voll pre { margin: 6px 0 0; max-height: 260px; overflow: auto; font-size: 11.5px; background: rgba(0,0,0,.4); border-radius: 8px; padding: 8px; white-space: pre-wrap; word-break: break-word; }
.kr-knoepfe { display: flex; gap: 6px; flex: none; }
@media (max-width: 900px) {
  .kr-kopf { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 8px; padding-bottom: 2px; }
  .kr-kachel { flex: 0 0 124px; padding: 8px 10px; scroll-snap-align: start; }
  .kr-kachel b { font-size: 18px; }
  .kr-kachel span { font-size: 10.5px; }
  .kr-box .hf-tabs { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; }
  .kr-box .hf-tab { flex: none; }
  .kr-seele textarea { min-height: 260px; }
  .kr-zahl, .kr-zeit, .kr-mini-sel { font-size: 16px !important; }
}`;
  document.head.appendChild(style);

  window.FridayKern = {
    open(opt = {}) { if (opt.tab && TABS.some(([id]) => id === opt.tab)) tab = opt.tab; w.auf(); },
    refresh() { if (w.offen()) laden(); },
  };
})();
