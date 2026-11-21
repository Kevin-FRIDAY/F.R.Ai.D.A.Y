// Eve – die Testversion von Friday (v1.137.0)
// • Umschalter oben (Chip „Friday ⇄ Eve“), gilt nur für dieses Gerät.
// • In Eve: Schnellzugriff wird zum Chatfenster „Draht zu Claude“ (Wünsche sammeln, mit einem Tipp schicken).
// • In Eve: unter jedem offenen Bereich (z. B. Weltgeschehen) ein Feld „✎ Ändern“, das den Wunsch mitsammelt.
// • Neue Funktionen (server/eve-funktionen.json) sind in Eve offen und tragen „TEST“, in Friday liegen sie hinter einem Schloss,
//   bis Boss sie im Fenster „Eve-Tests“ freigibt.
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  const SCHLUESSEL = "eve_modus"; // bewusst ohne friday_-Vorsilbe: bleibt pro Gerät
  const lies = () => { try { return localStorage.getItem(SCHLUESSEL) === "1"; } catch { return false; } };
  let eve = lies();
  let stand = null;
  const html = document.documentElement;

  // Bereichsnamen so, wie Kevin sie kennt
  const NAMEN = { Lagezentrum: "Weltgeschehen", brain: "System-Zentrale" };
  const UEBERLAGEN = "section.sheet, section.lage, section.werkstatt, section.markt, section.webseiten, section.vision, section.sat, section.schnitt, section.camera, section.call";

  // ---------- Hinweis-Schild ----------
  function schild(text) {
    let s = document.getElementById("eve-schild");
    if (!s) { s = document.createElement("div"); s.id = "eve-schild"; s.setAttribute("role", "status"); document.body.appendChild(s); }
    s.textContent = text;
    s.classList.add("an");
    clearTimeout(schild.t);
    schild.t = setTimeout(() => s.classList.remove("an"), 3600);
  }

  // ---------- Kopieren (mit Rückfall für ältere Browser) ----------
  async function kopiere(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* Rückfall */ }
    const t = document.createElement("textarea");
    t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* nein */ }
    t.remove();
    return ok;
  }

  // ---------- Umschalter ----------
  function chip() {
    const bar = document.querySelector(".hud-bar");
    if (!bar) return;
    let c = document.getElementById("hb-eve");
    if (!c) {
      c = document.createElement("button");
      c.type = "button"; c.id = "hb-eve"; c.className = "hb-chip hb-btn";
      c.addEventListener("click", () => setze(!eve));
      bar.insertBefore(c, bar.firstChild);
    }
    c.title = eve ? "Zurück zu Friday (fertige Version)" : "Zu Eve wechseln (Testversion)";
    c.innerHTML = `<span class="eve-seite ${eve ? "" : "an"}">Friday</span><span class="eve-pfeil">⇄</span><span class="eve-seite ${eve ? "an" : ""}">Eve</span>`;
  }

  function setze(an) {
    eve = Boolean(an);
    try { localStorage.setItem(SCHLUESSEL, eve ? "1" : "0"); } catch { /* egal */ }
    html.classList.add("eve-wechsel");
    setTimeout(() => html.classList.remove("eve-wechsel"), 700);
    anwenden();
    schild(eve ? "Eve ist an: Testversion. Neue Funktionen sind hier schon offen." : "Friday ist an: die fertige Version.");
  }

  function anwenden() {
    html.classList.toggle("eve-modus", eve);
    document.title = eve ? "Eve · Testversion" : "F.R.Ai.D.A.Y";
    const logo = document.querySelector(".side-logo-tx");
    if (logo) logo.textContent = eve ? "EVE" : "FRIDAY";
    chip();
    abzeichen();
    chatBauen();
    schloesser();
    pruefeBereich();
  }

  function abzeichen() {
    let b = document.getElementById("eve-abzeichen");
    const ziel = document.querySelector(".hero-text");
    if (!ziel) return;
    if (!b) { b = document.createElement("div"); b.id = "eve-abzeichen"; ziel.insertBefore(b, ziel.firstChild); }
    b.innerHTML = eve ? '<span class="eve-punkt"></span>EVE · TESTVERSION' : "";
    b.hidden = !eve;
  }

  // ---------- Chatfenster im Schnellzugriff ----------
  let chat = null;
  function chatBauen() {
    const quick = document.querySelector(".quick");
    if (!quick) return;
    if (!chat) {
      chat = document.createElement("div");
      chat.id = "eve-chat";
      chat.innerHTML = `
        <div class="ec-kopf">
          <div><b>💬 Draht zu Claude</b><small>Schreib, was Eve anders machen soll. Ich sammle alles, du schickst es mit einem Tipp.</small></div>
          <button type="button" class="ec-tests" id="ec-tests" title="Funktionen im Test – hier gibst du sie für Friday frei">🔒 Tests</button>
        </div>
        <div class="ec-verlauf" id="ec-verlauf" aria-live="polite"></div>
        <form class="ec-eingabe" id="ec-form">
          <textarea id="ec-text" rows="1" placeholder="z. B. Weltgeschehen: Länder größer beschriften" autocomplete="off"></textarea>
          <button type="submit" class="ec-plus" title="Sammeln">➤</button>
        </form>
        <div class="ec-fuss">
          <button type="button" class="ec-senden" id="ec-senden">🚀 An Claude schicken</button>
          <button type="button" class="ec-kopie" id="ec-kopie" title="Text kopieren und bei Claude einfügen">📋 Kopieren</button>
        </div>
        <div class="ec-status" id="ec-status"></div>`;
      quick.appendChild(chat);
      const txt = chat.querySelector("#ec-text");
      txt.addEventListener("input", () => { txt.style.height = "auto"; txt.style.height = `${Math.min(140, txt.scrollHeight)}px`; });
      txt.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chat.querySelector("#ec-form").requestSubmit(); } });
      chat.querySelector("#ec-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const t = txt.value.trim();
        if (!t) return;
        await sammle(t, "Startseite / Allgemein");
        txt.value = ""; txt.style.height = "auto";
      });
      chat.querySelector("#ec-senden").addEventListener("click", () => schicke());
      chat.querySelector("#ec-kopie").addEventListener("click", () => kopiereAlles());
      chat.querySelector("#ec-tests").addEventListener("click", () => tests.auf());
      chat.addEventListener("click", async (e) => {
        const x = e.target.closest("[data-weg]");
        if (!x) return;
        try { stand = await json(`/api/eve/wunsch/${encodeURIComponent(x.dataset.weg)}`, { method: "DELETE" }); zeichneChat(); } catch (err) { chatStatus(err.message, true); }
      });
    }
    zeichneChat();
  }

  const zeit = (iso) => { const d = new Date(iso); const heute = new Date().toDateString() === d.toDateString(); return d.toLocaleString("de-DE", heute ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
  function chatStatus(t, fehler = false) {
    const s = chat?.querySelector("#ec-status");
    if (!s) return;
    s.innerHTML = t; s.classList.toggle("fehler", fehler);
  }

  function zeichneChat() {
    if (!chat) return;
    const v = chat.querySelector("#ec-verlauf");
    const ws = (stand?.wuensche || []).slice(-30);
    const intro = `<div class="ec-msg eve"><b>Eve</b>Hi Boss. Alles, was du hier oder unter einem Bereich (✎ Ändern) schreibst, sammle ich. Mit „An Claude schicken“ geht alles als Auftrag raus.</div>`;
    v.innerHTML = intro + ws.map((w) => `<div class="ec-msg du ${w.status === "offen" ? "" : "weg"}"><span class="ec-bereich">${esc(w.bereich)}</span><span class="ec-txt">${esc(w.text)}</span><span class="ec-meta">${zeit(w.zeit)} · ${w.status === "offen" ? "gesammelt" : w.issue ? `geschickt (Auftrag #${esc(w.issue)})` : "kopiert"}${w.status === "offen" ? `<button type="button" class="ec-weg" data-weg="${esc(w.id)}" title="Wieder löschen">✕</button>` : ""}</span></div>`).join("");
    v.scrollTop = v.scrollHeight;
    const n = stand?.offen || 0;
    const s = chat.querySelector("#ec-senden");
    s.textContent = n ? `🚀 An Claude schicken (${n})` : "🚀 An Claude schicken";
    s.disabled = !n;
    chat.querySelector("#ec-kopie").disabled = !n;
    const t = (stand?.funktionen || []).length;
    chat.querySelector("#ec-tests").textContent = t ? `🔒 Tests (${t})` : "🔒 Tests";
    bereichZaehler();
  }

  async function laden() {
    try { stand = await json("/api/eve"); zeichneChat(); schloesser(); zeichneTests(); } catch { /* noch nicht angemeldet */ }
  }

  async function sammle(text, bereich) {
    try {
      stand = await json("/api/eve/wunsch", { body: { text, bereich } });
      zeichneChat();
      chatStatus(`Notiert ✓ <b>${stand.offen}</b> ${stand.offen === 1 ? "Wunsch wartet" : "Wünsche warten"} aufs Schicken.`);
      return true;
    } catch (err) { chatStatus(err.message, true); schild(err.message); return false; }
  }

  async function schicke() {
    chatStatus("Schicke an Claude …");
    try {
      const r = await json("/api/eve/senden", { body: {} });
      if (r.ok) {
        stand = r; zeichneChat();
        chatStatus(`Geschickt ✓ Auftrag <a href="${esc(r.url || "#")}" target="_blank" rel="noopener">#${esc(r.issue)}</a> liegt bei Claude. Sag im Claude-Projekt: „Hol meine Eve-Wünsche“.`);
        schild("An Claude geschickt ✓");
        return;
      }
      chatStatus(`${esc(r.error)}`, true);
    } catch (err) { chatStatus(err.message, true); }
  }

  async function kopiereAlles() {
    try {
      const r = await json("/api/eve/text");
      if (!r.text) { chatStatus("Nichts zu kopieren."); return; }
      if (!(await kopiere(r.text))) { chatStatus("Kopieren hat nicht geklappt. Halte im Feld gedrückt und kopiere von Hand.", true); return; }
      stand = await json("/api/eve/senden", { body: { kopiert: true } });
      zeichneChat();
      chatStatus('Kopiert ✓ Öffne jetzt Claude, füge den Text im Projekt „FRIDAY AI AKTUELL“ ein und schick ihn ab. <a href="https://claude.ai" target="_blank" rel="noopener">Claude öffnen ›</a>');
    } catch (err) { chatStatus(err.message, true); }
  }

  // ---------- Fenster „Eve-Tests“ (Schloss) ----------
  const tests = H.fenster({
    id: "eve-tests", titel: "🔒 Eve-Tests: Freigabe für Friday", klasse: "eve-tests-box",
    html: `
      <div class="hf-status" id="et-status">Neue Funktionen kommen zuerst nur in Eve. In Friday liegen sie hinter einem Schloss, bis du sie hier freigibst.</div>
      <div class="hf-karte"><h3>Gerade im Test</h3><div id="et-liste" class="hf-liste"></div></div>
      <div class="hf-karte"><h3>So läuft es</h3>
        <ol class="et-schritte">
          <li>Du schreibst in Eve, was neu oder anders werden soll, und tippst „An Claude schicken“.</li>
          <li>Claude baut es. Mit dem nächsten Update ist es da: in Eve offen (Abzeichen TEST), in Friday mit 🔒.</li>
          <li>Du testest in Eve. Gefällt es dir, tippst du hier „In Friday freigeben“. Ab dann ist es auch in Friday offen.</li>
        </ol></div>`,
    onOpen: () => laden(),
  });
  function zeichneTests() {
    const l = tests.$("#et-liste");
    if (!l) return;
    const fs = stand?.funktionen || [];
    l.innerHTML = fs.length ? fs.map((f) => `
      <div class="hf-zeile">
        <span class="icon">${f.frei ? "🔓" : "🔒"}</span>
        <span class="name"><b>${esc(f.name || f.id)}</b>${f.version ? ` <span class="klein">v${esc(f.version)}</span>` : ""}<br><span class="klein">${esc(f.beschreibung || "")}${f.frei ? ` · in Friday frei seit ${zeit(f.freiAm)}` : " · nur in Eve"}</span></span>
        <button class="hf-btn ${f.frei ? "leise" : "haupt"}" data-frei="${esc(f.id)}" data-an="${f.frei ? "0" : "1"}">${f.frei ? "🔒 Wieder sperren" : "✓ In Friday freigeben"}</button>
      </div>`).join("") : '<div class="hf-leer">Gerade ist nichts im Test. Sobald Claude etwas Neues für dich baut, steht es hier.</div>';
  }
  tests.sheet.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-frei]");
    if (!b) return;
    try {
      stand = await json("/api/eve/freigabe", { body: { id: b.dataset.frei, frei: b.dataset.an === "1" } });
      zeichneTests(); zeichneChat(); schloesser();
      tests.$("#et-status").textContent = b.dataset.an === "1" ? "Freigegeben ✓ Die Funktion ist jetzt auch in Friday offen." : "Wieder gesperrt. In Friday liegt sie hinter dem Schloss.";
    } catch (err) { tests.$("#et-status").textContent = err.message; }
  });

  // ---------- Schloss auf Funktionen im Test ----------
  function schloesser() {
    document.querySelectorAll(".eve-marke").forEach((m) => m.remove());
    document.querySelectorAll(".eve-schloss, .eve-test").forEach((el) => {
      el.classList.remove("eve-schloss", "eve-test");
      el.removeAttribute("data-eve-name");
    });
    for (const f of stand?.funktionen || []) {
      for (const sel of f.ziele || []) {
        let els = [];
        try { els = document.querySelectorAll(sel); } catch { continue; }
        els.forEach((el) => {
          el.dataset.eveName = f.name || f.id;
          const marke = (text) => { const m = document.createElement("span"); m.className = "eve-marke"; m.setAttribute("aria-hidden", "true"); m.textContent = text; el.appendChild(m); };
          if (eve) { el.classList.add("eve-test"); marke("TEST"); }
          else if (!f.frei) { el.classList.add("eve-schloss"); marke("🔒"); }
        });
      }
    }
  }
  // Klicks auf gesperrte Knöpfe abfangen, bevor die Funktion startet.
  document.addEventListener("click", (e) => {
    const el = e.target.closest?.(".eve-schloss");
    if (!el || eve) return;
    e.preventDefault(); e.stopImmediatePropagation();
    schild(`🔒 „${el.dataset.eveName}“ ist noch im Test. Probier es in Eve aus und gib es dort frei.`);
  }, true);

  // ---------- „✎ Ändern“ unter jedem offenen Bereich ----------
  const feld = document.createElement("div");
  feld.id = "eve-aendern";
  feld.hidden = true;
  feld.innerHTML = `
    <button type="button" class="ea-pille" id="ea-pille">✎ Ändern: <b id="ea-name">–</b><span id="ea-zahl"></span></button>
    <form class="ea-box" id="ea-box" hidden>
      <div class="ea-kopf"><span>Was soll sich bei <b id="ea-name2">–</b> ändern?</span><button type="button" id="ea-zu" class="ea-zu" aria-label="Zuklappen">▾</button></div>
      <textarea id="ea-text" rows="3" placeholder="z. B. Die Länder-Namen größer und die Schiffe in Grün"></textarea>
      <div class="ea-reihe">
        <button type="submit" class="ea-sammeln">＋ Sammeln</button>
        <button type="button" class="ea-schicken" id="ea-schicken">🚀 Alles an Claude</button>
      </div>
      <div class="ea-info" id="ea-info"></div>
    </form>`;
  document.body.appendChild(feld);
  let bereich = null;
  const fq = (s) => feld.querySelector(s);
  fq("#ea-pille").addEventListener("click", () => { fq("#ea-box").hidden = false; fq("#ea-pille").hidden = true; fq("#ea-text").focus(); });
  fq("#ea-zu").addEventListener("click", () => { fq("#ea-box").hidden = true; fq("#ea-pille").hidden = false; });
  fq("#ea-box").addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = fq("#ea-text").value.trim();
    if (!t) return;
    if (await sammle(t, bereich || "Allgemein")) {
      fq("#ea-text").value = "";
      fq("#ea-info").textContent = `Notiert ✓ für ${bereich}. Du kannst weiter sammeln.`;
    }
  });
  fq("#ea-schicken").addEventListener("click", async () => {
    const t = fq("#ea-text").value.trim();
    if (t) { await sammle(t, bereich || "Allgemein"); fq("#ea-text").value = ""; }
    fq("#ea-info").textContent = "Schicke …";
    await schicke();
    const s = chat?.querySelector("#ec-status");
    fq("#ea-info").innerHTML = s ? s.innerHTML : "";
  });
  // Tastendrücke im Feld nicht an Friday weitergeben (z. B. Taste F = Vollbild, Esc schließt Fenster)
  feld.addEventListener("keydown", (e) => e.stopPropagation());

  function bereichZaehler() {
    const n = (stand?.wuensche || []).filter((w) => w.status === "offen" && w.bereich === bereich).length;
    fq("#ea-zahl").textContent = n ? ` · ${n} gesammelt` : "";
  }

  function offenerBereich() {
    let oben = null;
    document.querySelectorAll(UEBERLAGEN).forEach((s) => {
      if (s.id === "eve-tests" || s.classList.contains("hidden")) return;
      if (!s.getClientRects().length) return;
      oben = s;
    });
    return oben;
  }
  function pruefeBereich() {
    const s = eve ? offenerBereich() : null;
    if (!s) {
      if (!feld.hidden) { feld.hidden = true; fq("#ea-box").hidden = true; fq("#ea-pille").hidden = false; }
      bereich = null;
      return;
    }
    const roh = s.getAttribute("aria-label") || s.id;
    const name = NAMEN[roh] || NAMEN[s.id] || roh;
    if (name !== bereich) {
      bereich = name;
      fq("#ea-name").textContent = name; fq("#ea-name2").textContent = name;
      fq("#ea-info").textContent = "";
      bereichZaehler();
    }
    feld.hidden = false;
  }
  setInterval(pruefeBereich, 600);

  // ---------- Stil ----------
  const st = document.createElement("style");
  st.textContent = `
html.eve-modus { --cyan: #38e1ff !important; --cyan-soft: rgba(56,225,255,.12) !important; --line: rgba(56,225,255,.24) !important; --gold: #38e1ff !important; }
html.eve-wechsel body { animation: eve-blitz .7s ease; }
@keyframes eve-blitz { 0% { filter: brightness(1); } 30% { filter: brightness(1.8) saturate(.4); } 100% { filter: none; } }
#hb-eve { gap: 6px; font-weight: 700; letter-spacing: .08em; }
#hb-eve .eve-seite { opacity: .45; text-transform: uppercase; }
#hb-eve .eve-seite.an { opacity: 1; color: var(--cyan); text-shadow: 0 0 10px var(--cyan); }
#hb-eve .eve-pfeil { opacity: .7; }
#eve-abzeichen { display: inline-flex; align-items: center; gap: 8px; margin: 0 auto 8px; padding: 4px 14px; border-radius: 999px; font: 700 12px/1.4 var(--font-head, monospace); letter-spacing: .22em; color: var(--cyan); border: 1px solid color-mix(in srgb, var(--cyan) 55%, transparent); background: color-mix(in srgb, var(--cyan) 10%, transparent); box-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 30%, transparent); }
#eve-abzeichen[hidden] { display: none; }
#eve-abzeichen .eve-punkt { width: 8px; height: 8px; border-radius: 50%; background: var(--cyan); box-shadow: 0 0 8px var(--cyan); animation: eve-puls 1.6s ease-in-out infinite; }
@keyframes eve-puls { 50% { opacity: .3; } }
.hero-text:has(#eve-abzeichen:not([hidden])) { text-align: center; }
#eve-chat { display: none; }
html.eve-modus .quick .quick-grid { display: none; }
html.eve-modus .quick .quick-h { font-size: 0; }
html.eve-modus .quick .quick-h::before { content: "Eve-Werkbank"; font-size: 1rem; }
html.eve-modus #eve-chat { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 18px; border: 1px solid var(--u-rand, rgba(56,225,255,.4)); background: var(--u-glas, rgba(5,12,16,.9)); box-shadow: var(--u-glow, none), var(--u-schein, none); }
.ec-kopf { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.ec-kopf b { display: block; font-size: 17px; color: var(--u-titel, #fff); }
.ec-kopf small { display: block; opacity: .7; font-size: 13px; margin-top: 2px; }
.ec-tests { flex: none; border-radius: 999px; padding: 6px 12px; border: 1px solid var(--u-rand, #38e1ff); background: transparent; color: var(--cyan); font: inherit; font-size: 13px; cursor: pointer; }
.ec-verlauf { display: flex; flex-direction: column; gap: 8px; max-height: 300px; min-height: 120px; overflow-y: auto; padding: 4px 2px; overscroll-behavior: contain; }
.ec-msg { max-width: 88%; padding: 8px 12px; border-radius: 14px; font-size: 14.5px; line-height: 1.4; word-break: break-word; }
.ec-msg .ec-txt { white-space: pre-wrap; }
.ec-msg.eve { align-self: flex-start; background: color-mix(in srgb, var(--cyan) 10%, rgba(255,255,255,.03)); border: 1px solid color-mix(in srgb, var(--cyan) 30%, transparent); border-bottom-left-radius: 4px; }
.ec-msg.eve b { display: block; color: var(--cyan); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 2px; }
.ec-msg.du { align-self: flex-end; background: color-mix(in srgb, var(--cyan) 24%, rgba(0,0,0,.4)); border: 1px solid color-mix(in srgb, var(--cyan) 45%, transparent); border-bottom-right-radius: 4px; }
.ec-msg.du.weg { opacity: .55; }
.ec-bereich { display: inline-block; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; padding: 1px 7px; margin-right: 6px; border-radius: 6px; background: rgba(0,0,0,.35); color: var(--cyan); }
.ec-meta { display: flex; align-items: center; gap: 6px; justify-content: flex-end; font-size: 11px; opacity: .65; margin-top: 3px; }
.ec-weg { border: 0; background: none; color: inherit; cursor: pointer; font-size: 13px; padding: 0 2px; }
.ec-eingabe { display: flex; gap: 8px; align-items: flex-end; }
.ec-eingabe textarea { flex: 1; resize: none; min-height: 44px; max-height: 140px; padding: 11px 14px; border-radius: 14px; border: 1px solid var(--u-rand, #38e1ff); background: rgba(0,0,0,.45); color: inherit; font: inherit; font-size: 16px; line-height: 1.35; }
.ec-eingabe textarea:focus { outline: none; box-shadow: 0 0 0 2px color-mix(in srgb, var(--cyan) 40%, transparent); }
.ec-plus { flex: none; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--cyan); background: color-mix(in srgb, var(--cyan) 22%, transparent); color: var(--cyan); font-size: 18px; cursor: pointer; }
.ec-fuss { display: flex; gap: 8px; }
.ec-senden, .ec-kopie, .ea-sammeln, .ea-schicken { border-radius: 12px; padding: 10px 14px; font: inherit; font-weight: 700; cursor: pointer; border: 1px solid var(--cyan); }
.ec-senden, .ea-schicken { flex: 1; color: #001318; background: linear-gradient(135deg, var(--cyan), color-mix(in srgb, var(--cyan) 60%, #fff)); box-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 40%, transparent); }
.ec-kopie, .ea-sammeln { background: transparent; color: var(--cyan); }
.ec-senden:disabled, .ec-kopie:disabled { opacity: .4; cursor: default; box-shadow: none; }
.ec-status, .ea-info { font-size: 13px; opacity: .85; min-height: 1em; }
.ec-status.fehler { color: #ff8080; opacity: 1; }
.ec-status a, .ea-info a { color: var(--cyan); }
#eve-aendern { position: fixed; z-index: 2147483000; left: 50%; transform: translateX(-50%); bottom: calc(18px + env(safe-area-inset-bottom)); width: min(560px, calc(100vw - 24px)); display: flex; flex-direction: column; align-items: center; pointer-events: none; }
#eve-aendern[hidden] { display: none; }
#eve-aendern > * { pointer-events: auto; }
.ea-pille { border-radius: 999px; padding: 9px 18px; font: inherit; font-size: 14px; color: #e9fbff; border: 1px solid #38e1ff; background: rgba(3,16,22,.92); box-shadow: 0 0 22px rgba(56,225,255,.45); cursor: pointer; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.ea-pille b { color: #38e1ff; }
.ea-pille[hidden], .ea-box[hidden] { display: none; }
.ea-box { width: 100%; display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 16px; border: 1px solid #38e1ff; background: rgba(3,14,19,.96); box-shadow: 0 0 30px rgba(56,225,255,.35); color: #e9fbff; }
.ea-kopf { display: flex; align-items: center; justify-content: space-between; font-size: 14px; }
.ea-kopf b { color: #38e1ff; }
.ea-zu { border: 0; background: none; color: #38e1ff; font-size: 18px; cursor: pointer; }
.ea-box textarea { resize: none; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(56,225,255,.5); background: rgba(0,0,0,.5); color: inherit; font: inherit; font-size: 16px; }
.ea-reihe { display: flex; gap: 8px; }
.ea-reihe .ea-sammeln { color: #38e1ff; border-color: #38e1ff; }
.ea-reihe .ea-schicken { --cyan: #38e1ff; }
.eve-test, .eve-schloss { position: relative; }
.eve-marke { position: absolute; z-index: 3; pointer-events: none; }
.eve-test > .eve-marke { top: 6px; right: 8px; font: 700 9px/1 var(--font-head, monospace); letter-spacing: .12em; padding: 3px 5px; border-radius: 5px; color: #001318; background: #38e1ff; }
.eve-schloss > :not(.eve-marke) { opacity: .4; filter: grayscale(.9); }
.eve-schloss > .eve-marke { top: 8px; right: 10px; font-size: 16px; }
#eve-schild { position: fixed; z-index: 2147483001; left: 50%; top: calc(14px + env(safe-area-inset-top)); transform: translate(-50%, -140%); max-width: calc(100vw - 32px); padding: 10px 16px; border-radius: 14px; font-size: 14px; color: #e9fbff; background: rgba(3,16,22,.95); border: 1px solid #38e1ff; box-shadow: 0 0 22px rgba(56,225,255,.4); transition: transform .3s ease; }
#eve-schild.an { transform: translate(-50%, 0); }
.et-schritte { margin: 0; padding-left: 20px; line-height: 1.55; }
.eve-tests-box { width: min(720px, 100%); }
@media (max-width: 900px) {
  #eve-aendern { bottom: calc(96px + env(safe-area-inset-bottom)); }
  html.eve-modus #eve-chat { padding: 12px; }
  .ec-verlauf { max-height: 260px; }
}
@media (prefers-reduced-motion: reduce) { html.eve-wechsel body, #eve-abzeichen .eve-punkt { animation: none; } }`;
  document.head.appendChild(st);

  // ---------- Start ----------
  html.classList.toggle("eve-modus", eve);
  const bereit = () => { anwenden(); laden(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bereit); else bereit();
  let n = 0;
  const warte = setInterval(() => { if (window.Friday?.api || ++n > 120) { clearInterval(warte); laden(); } }, 500);
  setInterval(() => { if (!document.hidden && eve) laden(); }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) laden(); });

  window.FridayEve = {
    istEve: () => eve,
    setze,
    /** Für neue Funktionen: darf sie hier gerade laufen? (In Eve immer, in Friday erst nach Freigabe.) */
    frei: (id) => eve || !(stand?.funktionen || []).some((f) => f.id === id && !f.frei),
    sammle,
    refresh: laden,
  };
})();
