// F.R.Ai.D.A.Y – Carlas Lernecke (v1.108.0)
// Lernkarten oder Blätter (gedruckt oder handgeschrieben) mit der Kamera scannen → Karten speichern →
// Friday fragt ab: Sie liest die Überschrift vor, hört Carlas Antwort, vergleicht mit der Karte und sagt,
// was gefehlt hat oder ob die Reihenfolge falsch war. Falsche Karten kommen wieder (Lernkartei).
// Kostenlos: Texterkennung am Mac (Apple Vision) bzw. im Browser (Tesseract), Vergleich auf dem Server.
// Nur Knöpfe mit „braucht Guthaben“ fragen Claude.
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  const F = () => window.Friday || {};
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const NAME = "Carla";
  const tag = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* egal */ } };

  let info = { stapel: [], faellig: 0, karten: 0, heute: [], profil: {} };
  let tab = "start";
  let scan = { bild: null, modus: "seite", vorne: "", hinten: "", vorschau: [] };
  let detail = null;     // geöffneter Stapel in "Meine Karten"
  let quiz = null;       // laufende Abfrage
  let hilfe = { stapel: null, karten: [], i: 0, offen: false };

  const w = H.fenster({
    id: "lernen", titel: "🎓 Carlas Lernecke", klasse: "ln-box",
    html: `
      <div class="hf-tabs" role="tablist">
        <button class="hf-tab an" data-tab="start">🏠 Start</button>
        <button class="hf-tab" data-tab="scannen">📷 Scannen</button>
        <button class="hf-tab" data-tab="karten">🗂 Meine Karten</button>
        <button class="hf-tab" data-tab="abfragen">🎯 Abfragen</button>
        <button class="hf-tab" data-tab="hilfe">💡 Lernhilfe</button>
        <button class="hf-tab" data-tab="plan">📅 Lernplan</button>
      </div>
      <div id="ln-status" class="hf-status"></div>

      <section data-seite="start">
        <div class="ln-gruss hf-karte">
          <div class="ln-gruss-text" id="ln-gruss">Hi ${NAME} …</div>
          <div class="ln-gross">
            <button class="ln-kachel" data-go="abfragen"><b>🎯</b><span>Abfragen</span><small>Ich lese vor, du antwortest</small></button>
            <button class="ln-kachel" data-go="hilfe"><b>💡</b><span>Hilf mir beim Lernen</span><small>Karten ansehen, Eselsbrücken, erklären</small></button>
            <button class="ln-kachel" data-go="scannen"><b>📷</b><span>Neue Karten scannen</span><small>Karteikarte, Zettel oder Buchseite</small></button>
          </div>
          <div class="hf-reihe" style="margin-top:10px">
            <button id="ln-mikro-start" class="hf-btn" type="button">🎤 Per Stimme sagen, was wir machen</button>
            <span id="ln-live-start" class="hf-hinweis"></span>
          </div>
        </div>
        <div id="ln-heute" class="hf-karte" style="display:none"><h3>Heute dran</h3><div id="ln-heute-liste"></div></div>
        <div id="ln-stand" class="hf-hinweis"></div>
        <label class="hf-hinweis ln-check"><input type="checkbox" id="ln-immer"> Auf diesem Gerät immer direkt mit der Lernecke starten</label>
      </section>

      <section data-seite="scannen" class="hidden">
        <div class="hf-tabs ln-modus">
          <button class="hf-tab an" data-scan="seite">📄 Blatt / Zettel / Buchseite</button>
          <button class="hf-tab" data-scan="karte">🃏 Karteikarte (vorne + hinten)</button>
        </div>
        <div class="hf-zwei">
          <div class="hf-karte">
            <h3 id="ln-scan-titel">1 · Fotografieren</h3>
            <div class="hf-reihe">
              <label class="hf-btn haupt">📷 Foto aufnehmen<input id="ln-kamera" type="file" accept="image/*" capture="environment" hidden></label>
              <label class="hf-btn">🖼 Aus Fotos<input id="ln-datei" type="file" accept="image/*" hidden></label>
            </div>
            <img id="ln-vor" alt="" class="ln-vor" style="display:none">
            <div class="hf-balken" style="margin-top:10px"><i id="ln-ocr" style="width:0%"></i></div>
            <div class="hf-reihe" style="margin-top:10px"><button id="ln-ki-lesen" class="hf-btn ki" type="button" disabled>🤖 KI liest die Schrift</button></div>
            <p class="hf-hinweis">Tipp: gerade von oben, gutes Licht, ganze Karte im Bild. Die Texterkennung ist kostenlos (am Mac mit Apple-Schrifterkennung, die auch Handschrift liest). Klappt es bei krakeliger Schrift schlecht, nimm „KI liest die Schrift“.</p>
          </div>
          <div class="hf-karte">
            <h3 id="ln-text-titel">2 · Erkannter Text</h3>
            <div id="ln-seite-feld">
              <label class="hf-feld"><textarea id="ln-text" placeholder="Hier erscheint der Text. Du kannst ihn korrigieren oder selbst etwas eintippen.&#10;&#10;Überschrift&#10;1. Punkt&#10;2. Punkt&#10;&#10;Begriff: Erklärung"></textarea></label>
              <button id="ln-erkennen" class="hf-btn" type="button" style="margin-top:8px">🔎 Karten daraus machen</button>
            </div>
            <div id="ln-karte-feld" class="hidden">
              <label class="hf-feld">Vorderseite (Überschrift / Frage)<input id="ln-vorne" class="hf-input" type="text"></label>
              <label class="hf-feld" style="margin-top:8px">Rückseite (Antwort)<textarea id="ln-hinten"></textarea></label>
              <div class="hf-reihe" style="margin-top:8px">
                <span id="ln-seite-hinweis" class="hf-hinweis">Jetzt die <b>Vorderseite</b> fotografieren.</span>
                <button id="ln-karte-dazu" class="hf-btn" type="button">＋ Karte übernehmen</button>
              </div>
            </div>
          </div>
        </div>
        <div class="hf-karte" id="ln-vorschau-k" style="display:none">
          <h3>3 · Prüfen &amp; speichern</h3>
          <div id="ln-vorschau" class="hf-liste"></div>
          <div class="hf-reihe" style="margin-top:10px">
            <select id="ln-ziel" class="hf-input grow" aria-label="In welchen Stapel?"></select>
            <input id="ln-neu-titel" class="hf-input grow" type="text" placeholder="Name des neuen Stapels, z. B. Biologie Zelle">
            <button id="ln-speichern" class="hf-btn haupt" type="button">✓ Speichern</button>
          </div>
        </div>
      </section>

      <section data-seite="karten" class="hidden">
        <div id="ln-stapel" class="hf-raster"></div>
        <div id="ln-detail" class="hf-karte" style="display:none"></div>
      </section>

      <section data-seite="abfragen" class="hidden">
        <div id="ln-q-setup" class="hf-karte">
          <h3>Abfrage einstellen</h3>
          <div class="hf-reihe">
            <select id="ln-q-stapel" class="hf-input grow" aria-label="Stapel"></select>
            <select id="ln-q-wahl" class="hf-input grow" aria-label="Welche Karten">
              <option value="faellig">Fällige Karten (empfohlen)</option>
              <option value="alle">Alle Karten</option>
              <option value="falsch">Nur die, die ich falsch hatte</option>
              <option value="heute">Heute laut Lernplan</option>
            </select>
          </div>
          <div class="hf-reihe" style="margin-top:8px">
            <label class="ln-check"><input type="checkbox" id="ln-q-mischen" checked> Durcheinander</label>
            <label class="ln-check"><input type="checkbox" id="ln-q-stimme" checked> Mit Stimme antworten</label>
            <label class="ln-check"><input type="checkbox" id="ln-q-auto" checked> Automatisch weiter</label>
            <select id="ln-q-reihe" class="hf-input" style="width:auto" aria-label="Reihenfolge prüfen">
              <option value="auto">Reihenfolge prüfen bei nummerierten Punkten</option>
              <option value="immer">Reihenfolge immer prüfen</option>
              <option value="nie">Reihenfolge egal</option>
            </select>
          </div>
          <button id="ln-q-los" class="hf-btn haupt" type="button" style="margin-top:10px">▶ Los geht's</button>
        </div>
        <div id="ln-q" class="ln-quiz" style="display:none">
          <div class="ln-q-kopf"><span id="ln-q-nr"></span><span id="ln-q-score"></span></div>
          <div class="hf-balken"><i id="ln-q-balken" style="width:0%"></i></div>
          <div class="ln-frage" id="ln-q-frage"></div>
          <div class="ln-mikro" id="ln-q-mikro"><i></i><span id="ln-q-live">…</span></div>
          <form id="ln-q-form" class="hf-reihe" autocomplete="off">
            <input id="ln-q-eingabe" class="hf-input grow" type="text" placeholder="Oder hier tippen …" enterkeyhint="send" aria-label="Antwort tippen">
            <button class="hf-btn" type="submit">➤</button>
          </form>
          <div class="hf-reihe ln-q-knoepfe">
            <button class="hf-btn" data-q="hoeren" type="button">🎤 Antworten</button>
            <button class="hf-btn leise" data-q="tipp" type="button">💡 Tipp</button>
            <button class="hf-btn leise" data-q="weissnicht" type="button">👁 Weiß ich nicht</button>
            <button class="hf-btn leise" data-q="wiederholen" type="button">🔁 Nochmal vorlesen</button>
            <button class="hf-btn leise" data-q="skip" type="button">⏭ Später</button>
            <button class="hf-btn leise" data-q="ende" type="button">⏹ Beenden</button>
          </div>
          <div id="ln-q-ergebnis" class="hf-karte" style="display:none"></div>
        </div>
        <div id="ln-q-ende" class="hf-karte" style="display:none"></div>
        <p class="hf-hinweis">Sprich einfach drauflos. Du kannst auch sagen: „weiß ich nicht“, „nochmal“, „Tipp“, „später“ oder „Stopp“. Bei langen Antworten sag am Ende „fertig“.</p>
      </section>

      <section data-seite="hilfe" class="hidden">
        <div class="hf-reihe"><select id="ln-h-stapel" class="hf-input grow" aria-label="Stapel"></select></div>
        <div id="ln-h" class="ln-hilfe"></div>
      </section>

      <section data-seite="plan" class="hidden">
        <div class="hf-karte">
          <h3>Lernplan erstellen</h3>
          <div class="hf-reihe">
            <select id="ln-p-stapel" class="hf-input grow" aria-label="Stapel"></select>
            <label class="hf-feld" style="flex-direction:row;align-items:center">Prüfung am <input id="ln-p-datum" class="hf-input" type="date" style="width:auto"></label>
            <label class="hf-feld" style="flex-direction:row;align-items:center">Minuten am Tag <input id="ln-p-min" class="hf-input" type="number" min="5" max="240" value="20" style="width:80px"></label>
            <button id="ln-p-los" class="hf-btn haupt" type="button">📅 Plan erstellen</button>
          </div>
          <p class="hf-hinweis">Friday verteilt die Karten auf die Tage bis zur Prüfung, wiederholt sie nach 1, 3 und 7 Tagen und lässt die letzten Tage nur zum Wiederholen frei. Ohne Datum plant sie eine Woche.</p>
        </div>
        <div id="ln-p" class="hf-liste"></div>
      </section>`,
    onOpen: (o) => oeffnen(o || {}),
  });
  const $ = (s) => w.$(s);
  const status = (t, f = false) => { const s = $("#ln-status"); s.textContent = t || ""; s.classList.toggle("fehler", f); };
  const kiFehler = (err) => (err.status === 402 ? "Fridays Guthaben ist leer. Alles ohne „braucht Guthaben“ klappt trotzdem." : err.message);

  function zeigeTab(t) {
    tab = t;
    w.$$("[data-tab]").forEach((b) => b.classList.toggle("an", b.dataset.tab === t));
    w.$$("[data-seite]").forEach((s) => s.classList.toggle("hidden", s.dataset.seite !== t));
    if (t !== "abfragen" && quiz?.laeuft) quizEnde(true);
    if (t === "karten") zeichneStapel();
    if (t === "hilfe") hilfeLaden();
    status("");
  }
  w.sheet.querySelector(".hf-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) zeigeTab(b.dataset.tab); });
  w.sheet.addEventListener("click", (e) => { const g = e.target.closest("[data-go]"); if (g) { zeigeTab(g.dataset.go); if (g.dataset.go === "abfragen" && info.karten) quizStart(); } });

  // ---------- Sprechen & Zuhören ----------
  const sag = async (t) => { try { await F().say?.(t); } catch { /* egal */ } };
  const still = () => { try { F().stopSpeaking?.(); } catch { /* egal */ } };
  let rec = null;
  function mikroBelegen(an) {
    window.Friday = window.Friday || {};
    window.Friday.mikroBelegt = an;
    if (an) F().wakePause?.(); else F().wakeWeiter?.();
  }
  function hoerAuf() { if (rec) { try { rec.abort(); } catch { /* egal */ } rec = null; } }
  /**
   * Hört einmal zu, bis Carla eine kurze Pause macht (oder „fertig“ sagt).
   * @returns {Promise<string>} erkannter Text ("" = nichts gehört)
   */
  function hoere({ live, start = 8000, stille = 2300, max = 90000 } = {}) {
    return new Promise((ok, nein) => {
      if (!Rec) return nein(new Error("Dieser Browser kann keine Sprache erkennen. Nimm Safari oder Chrome, oder tipp die Antwort."));
      hoerAuf();
      mikroBelegen(true);
      const r = new Rec();
      rec = r;
      r.lang = "de-DE"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1; r.lernecke = true;
      let text = "", fertig = false, timer = null;
      const ende = () => { if (fertig) return; fertig = true; clearTimeout(timer); clearTimeout(gesamt); try { r.stop(); } catch { /* egal */ } if (rec === r) rec = null; ok(text.trim()); };
      const warte = (ms) => { clearTimeout(timer); timer = setTimeout(ende, ms); };
      const gesamt = setTimeout(ende, max);
      r.onresult = (e) => {
        text = Array.from(e.results).map((x) => x[0].transcript).join(" ").replace(/\s+/g, " ");
        live?.(text);
        if (/\b(fertig|das war'?s|das wars|ende der antwort)[.!]?$/i.test(text.trim())) { text = text.replace(/\b(fertig|das war'?s|das wars|ende der antwort)[.!]?$/i, ""); ende(); return; }
        warte(stille);
      };
      r.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") { fertig = true; clearTimeout(timer); clearTimeout(gesamt); if (rec === r) rec = null; nein(new Error("Das Mikrofon ist nicht freigegeben. Tipp auf 🎤 Antworten oder erlaube das Mikrofon.")); }
      };
      r.onend = () => ende();
      try { r.start(); warte(start); } catch (err) { fertig = true; nein(err); }
    });
  }

  // ---------- Öffnen & Begrüßung ----------
  async function laden() {
    info = await json("/api/lernen");
    fuelleAuswahl();
    zeichneStart();
    return info;
  }
  async function oeffnen(o) {
    mikroBelegen(false);
    zeigeTab(o.modus === "abfragen" ? "abfragen" : o.modus === "scannen" ? "scannen" : o.modus === "plan" ? "plan" : "start");
    try {
      if (!o.begruesst) {
        const g = await json("/api/lernen/start", { body: {} });
        info = g;
        fuelleAuswahl();
        zeichneStart(g.text);
        if (o.modus === "start" || !o.modus) { if (!g.wiederholt) { await sag(g.text); waehleMitStimme(); } }
      } else {
        await laden();
      }
      if (o.modus === "abfragen") quizStart();
      else if (o.begruesst && (o.modus === "begruesst" || o.modus === "start") && o.stimme) waehleMitStimme();
    } catch (err) { status(err.message, true); }
  }
  function zeichneStart(gruss) {
    const erstes = !info.profil?.besuche || info.profil.besuche <= 1;
    $("#ln-gruss").textContent = gruss || (erstes
      ? `Hi ${NAME}, ich bin Friday, die künstliche Assistentin von Kevin. Er hat mich gebeten, dir beim Lernen zu helfen. Was wollen wir machen: Soll ich dich abfragen, oder soll ich dir generell beim Lernen helfen?`
      : `Hi ${NAME}, freut mich, dass du da bist. Wie kann ich dir beim Lernen helfen?`);
    const h = info.heute || [];
    $("#ln-heute").style.display = h.length ? "" : "none";
    $("#ln-heute-liste").innerHTML = h.map((x) => `<div class="hf-zeile"><span class="icon">📅</span><span class="name">${esc(x.titel)}<br><span class="klein">${esc(x.text)}</span></span><button class="hf-mini" data-heute="${esc(x.stapel)}">▶ Jetzt lernen</button></div>`).join("");
    $("#ln-stand").textContent = info.karten
      ? `${info.stapel.length} Stapel · ${info.karten} Karten · ${info.faellig} heute fällig${info.letzte?.[0] ? ` · zuletzt: ${info.letzte[0].richtig} von ${info.letzte[0].richtig + info.letzte[0].teilweise + info.letzte[0].falsch} richtig` : ""}`
      : "Noch keine Karten. Fang mit „Neue Karten scannen“ an.";
    $("#ln-immer").checked = lsGet("lernecke_start") === "1";
  }
  $("#ln-immer").addEventListener("change", (e) => lsSet("lernecke_start", e.target.checked ? "1" : "0"));
  $("#ln-heute-liste").addEventListener("click", (e) => {
    const b = e.target.closest("[data-heute]");
    if (!b) return;
    zeigeTab("abfragen");
    $("#ln-q-stapel").value = b.dataset.heute; $("#ln-q-wahl").value = "heute";
    quizStart();
  });
  const WAHL = [
    ["abfragen", /\b(abfrag|frag|prüf|pruef|test|quiz|abhören|abhoeren)/i],
    ["hilfe", /\b(hilf|helfen|lernen|erklär|erklaer|üben|ueben|lernhilfe|generell|beibringen|zeig)/i],
    ["scannen", /\b(scan|foto|fotografier|kamera|neue karte|einlesen)/i],
    ["plan", /\b(plan|lernplan|prüfung am|pruefung am)/i],
  ];
  async function waehleMitStimme() {
    if (!Rec || !w.offen()) return;
    const live = $("#ln-live-start");
    try {
      live.textContent = "🎤 Ich höre zu …";
      const t = await hoere({ live: (x) => { live.textContent = `🎤 ${x}`; }, start: 7000, stille: 1600, max: 15000 });
      mikroBelegen(false);
      live.textContent = t ? `„${t}“` : "";
      if (!t || !w.offen()) return;
      const treffer = WAHL.find(([, re]) => re.test(t));
      if (!treffer) { await sag("Sag einfach abfragen, lernen oder scannen. Oder tipp auf einen der Knöpfe."); return; }
      zeigeTab(treffer[0]);
      if (treffer[0] === "abfragen") quizStart();
      else if (treffer[0] === "hilfe") sag("Gern. Such dir einen Stapel aus. Ich zeige dir die Karten, lese vor, mache Eselsbrücken oder erkläre dir etwas.");
      else if (treffer[0] === "scannen") sag("Okay. Tipp auf Foto aufnehmen und halte die Karte gerade vor die Kamera.");
    } catch (err) { live.textContent = err.message; mikroBelegen(false); }
  }
  $("#ln-mikro-start").addEventListener("click", () => { still(); waehleMitStimme(); });

  function fuelleAuswahl() {
    const st = info.stapel || [];
    const opts = st.map((s) => `<option value="${esc(s.id)}">${esc(s.titel)} (${s.anzahl}${s.faellig ? `, ${s.faellig} fällig` : ""})</option>`).join("");
    for (const id of ["#ln-q-stapel", "#ln-h-stapel", "#ln-p-stapel"]) {
      const el = $(id); const alt = el.value;
      el.innerHTML = (id === "#ln-q-stapel" && st.length > 1 ? `<option value="alle">Alle Stapel</option>` : "") + (opts || `<option value="">Noch keine Karten</option>`);
      if (alt && [...el.options].some((o) => o.value === alt)) el.value = alt;
    }
    const z = $("#ln-ziel"); const altZ = z.value;
    z.innerHTML = `<option value="">＋ Neuer Stapel</option>${st.map((s) => `<option value="${esc(s.id)}">In „${esc(s.titel)}“</option>`).join("")}`;
    if (altZ && [...z.options].some((o) => o.value === altZ)) z.value = altZ;
    $("#ln-neu-titel").style.display = z.value ? "none" : "";
  }
  $("#ln-ziel").addEventListener("change", () => { $("#ln-neu-titel").style.display = $("#ln-ziel").value ? "none" : ""; });

  // ---------- Scannen ----------
  w.sheet.querySelector(".ln-modus").addEventListener("click", (e) => {
    const b = e.target.closest("[data-scan]");
    if (!b) return;
    scan.modus = b.dataset.scan;
    w.$$("[data-scan]").forEach((x) => x.classList.toggle("an", x === b));
    $("#ln-seite-feld").classList.toggle("hidden", scan.modus !== "seite");
    $("#ln-karte-feld").classList.toggle("hidden", scan.modus !== "karte");
    $("#ln-text-titel").textContent = scan.modus === "karte" ? "2 · Vorder- und Rückseite" : "2 · Erkannter Text";
    seiteHinweis();
  });
  function seiteHinweis() {
    const vorne = $("#ln-vorne").value.trim();
    $("#ln-seite-hinweis").innerHTML = !vorne ? "Jetzt die <b>Vorderseite</b> fotografieren." : !$("#ln-hinten").value.trim() ? "Jetzt die Karte umdrehen und die <b>Rückseite</b> fotografieren." : "Passt alles? Dann „Karte übernehmen“.";
  }
  $("#ln-vorne").addEventListener("input", seiteHinweis);
  $("#ln-hinten").addEventListener("input", seiteHinweis);

  function verkleinern(datei, max = 2200) {
    return new Promise((ok, nein) => {
      const img = new Image();
      img.onload = () => {
        const f = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        ok(c);
      };
      img.onerror = () => nein(new Error("Das Bild ließ sich nicht öffnen."));
      img.src = URL.createObjectURL(datei);
    });
  }
  let tesseract = null;
  function ladeTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseract) return tesseract;
    tesseract = new Promise((ok, nein) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
      s.onload = () => ok(window.Tesseract);
      s.onerror = () => { tesseract = null; nein(new Error("Die Texterkennung konnte nicht geladen werden (Internet?). Tipp den Text ein oder nimm „KI liest die Schrift“.")); };
      document.head.appendChild(s);
    });
    return tesseract;
  }
  async function browserOcr(c, bar) {
    const T = await ladeTesseract();
    const g = document.createElement("canvas"); g.width = c.width; g.height = c.height;
    const x = g.getContext("2d"); x.filter = "grayscale(1) contrast(1.4)"; x.drawImage(c, 0, 0);
    const worker = await T.createWorker("deu", 1, { logger: (m) => { if (m.status === "recognizing text") bar.style.width = `${Math.round(20 + m.progress * 80)}%`; } });
    const { data } = await worker.recognize(g);
    await worker.terminate();
    return data.text || "";
  }
  async function fotoDa(e) {
    const datei = e.target.files?.[0];
    e.target.value = "";
    if (!datei) return;
    const bar = $("#ln-ocr");
    bar.classList.add("laeuft");
    try {
      const c = await verkleinern(datei);
      const daten = c.toDataURL("image/jpeg", 0.86);
      $("#ln-vor").src = daten; $("#ln-vor").style.display = "block";
      status("Lese die Schrift …");
      bar.style.width = "15%";
      const r = await json("/api/lernen/scan", { body: { image: { mediaType: "image/jpeg", data: daten.split(",")[1] } } });
      scan.bild = r.bild;
      $("#ln-ki-lesen").disabled = false;
      let text = r.text;
      if (text == null) { status("Lese im Browser (beim ersten Mal lädt die Texterkennung kurz) …"); text = await browserOcr(c, bar); }
      bar.style.width = "100%";
      text = String(text || "").trim();
      if (!text) { status("Ich konnte keinen Text erkennen. Versuch's mit mehr Licht, oder nimm „KI liest die Schrift“.", true); return; }
      if (scan.modus === "karte") {
        const fl = text.replace(/\n{2,}/g, "\n").trim();
        if (!$("#ln-vorne").value.trim()) { $("#ln-vorne").value = fl.replace(/\n/g, " "); status("Vorderseite gelesen. Jetzt umdrehen und die Rückseite fotografieren."); sag("Vorderseite gelesen. Jetzt die Rückseite."); }
        else { $("#ln-hinten").value = fl; status("Rückseite gelesen. Prüf kurz und tipp auf „Karte übernehmen“."); }
        seiteHinweis();
      } else {
        $("#ln-text").value = text;
        status(r.quelle === "mac" ? "Text erkannt (Mac-Schrifterkennung)." : "Text erkannt.");
        await erkennen(r.karten ? r : null);
      }
    } catch (err) { status(err.message, true); }
    finally { bar.classList.remove("laeuft"); setTimeout(() => { bar.style.width = "0%"; }, 1500); }
  }
  $("#ln-kamera").addEventListener("change", fotoDa);
  $("#ln-datei").addEventListener("change", fotoDa);
  $("#ln-ki-lesen").addEventListener("click", async () => {
    const b = $("#ln-ki-lesen"); b.disabled = true;
    status("Claude liest die Schrift …");
    try {
      const r = await json("/api/lernen/ki/karten", { body: { bild: scan.bild } });
      if (scan.modus === "karte" && r.karten[0]) {
        const k = r.karten[0];
        if (!$("#ln-vorne").value.trim()) $("#ln-vorne").value = k.frage + (k.antwort ? "" : "");
        else $("#ln-hinten").value = [k.frage, k.antwort].filter(Boolean).join("\n");
        seiteHinweis();
      } else {
        $("#ln-text").value = r.karten.map((k) => `${k.frage}\n${k.antwort}`).join("\n\n");
        zeigeVorschau(r);
      }
      status(`Die KI hat ${r.karten.length} Karte${r.karten.length === 1 ? "" : "n"} gelesen.`);
    } catch (err) { status(kiFehler(err), true); }
    finally { b.disabled = false; }
  });
  $("#ln-erkennen").addEventListener("click", () => erkennen());
  async function erkennen(fertig) {
    const text = $("#ln-text").value.trim();
    if (!text) { status("Kein Text da.", true); return; }
    try { zeigeVorschau(fertig || await json("/api/lernen/text", { body: { text } })); } catch (err) { status(err.message, true); }
  }
  $("#ln-karte-dazu").addEventListener("click", () => {
    const frage = $("#ln-vorne").value.trim();
    if (!frage) { status("Die Vorderseite fehlt noch.", true); return; }
    const antwort = $("#ln-hinten").value.trim();
    scan.vorschau.push({ frage, antwort, reihenfolge: antwort.split("\n").filter((z) => /^\s*\d+[.)]/.test(z)).length >= 2, bild: scan.bild });
    $("#ln-vorne").value = ""; $("#ln-hinten").value = "";
    seiteHinweis();
    zeigeVorschau({ karten: scan.vorschau, anhaengen: true });
    status(`${scan.vorschau.length} Karte${scan.vorschau.length === 1 ? "" : "n"} bereit. Nächste Karte fotografieren oder unten speichern.`);
  });
  function zeigeVorschau(d) {
    scan.vorschau = (d.karten || []).map((k) => ({ ...k, bild: k.bild || scan.bild }));
    if (d.titel && !$("#ln-ziel").value && !$("#ln-neu-titel").value) $("#ln-neu-titel").value = d.titel;
    $("#ln-vorschau-k").style.display = "block";
    $("#ln-vorschau").innerHTML = scan.vorschau.length ? scan.vorschau.map((k, i) => `
      <div class="hf-zeile ln-vz" data-i="${i}">
        <input type="checkbox" checked data-an aria-label="Karte übernehmen">
        <div class="name">
          <input class="hf-input" data-f value="${esc(k.frage)}" aria-label="Frage / Überschrift">
          <textarea class="hf-input" data-a rows="${Math.min(6, Math.max(2, (k.antwort || "").split("\n").length))}" aria-label="Antwort">${esc(k.antwort)}</textarea>
          <label class="klein ln-check"><input type="checkbox" data-r ${k.reihenfolge ? "checked" : ""}> Reihenfolge ist wichtig</label>
        </div>
      </div>`).join("") : `<div class="hf-leer">Keine Karten erkannt. Schreib pro Karte eine Überschrift und darunter die Antwort, Karten mit einer Leerzeile trennen.</div>`;
    status(scan.vorschau.length ? `${scan.vorschau.length} Karte${scan.vorschau.length === 1 ? "" : "n"} erkannt. Kurz prüfen, dann speichern.` : "Nichts erkannt.");
  }
  $("#ln-speichern").addEventListener("click", async () => {
    const karten = w.$$(".ln-vz").filter((z) => z.querySelector("[data-an]").checked).map((z) => ({
      frage: z.querySelector("[data-f]").value, antwort: z.querySelector("[data-a]").value, reihenfolge: z.querySelector("[data-r]").checked, bild: scan.vorschau[+z.dataset.i]?.bild,
    })).filter((k) => k.frage.trim());
    if (!karten.length) { status("Keine Karte ausgewählt.", true); return; }
    try {
      const r = await json("/api/lernen/karten", { body: { stapel: $("#ln-ziel").value || null, titel: $("#ln-neu-titel").value, karten, quelle: "scan", bild: scan.bild } });
      status(`✓ ${r.neu} Karte${r.neu === 1 ? "" : "n"} in „${r.stapel.titel}“ gespeichert.`);
      sag(`Gespeichert. ${r.neu} neue Karte${r.neu === 1 ? "" : "n"} im Stapel ${r.stapel.titel}.`);
      scan = { ...scan, bild: null, vorschau: [] };
      $("#ln-vorschau-k").style.display = "none"; $("#ln-text").value = ""; $("#ln-vor").style.display = "none"; $("#ln-ki-lesen").disabled = true;
      await laden();
      $("#ln-ziel").value = r.stapel.id; $("#ln-neu-titel").style.display = "none";
    } catch (err) { status(err.message, true); }
  });

  // ---------- Meine Karten ----------
  function zeichneStapel() {
    const st = info.stapel || [];
    $("#ln-stapel").innerHTML = st.length ? st.map((s) => `
      <button class="hf-karte ln-stapel" data-stapel="${esc(s.id)}">
        <h3>🗂 ${esc(s.titel)}</h3>
        <div class="hf-hinweis">${s.anzahl} Karten · ${s.faellig} fällig · ${s.gelernt} sitzen</div>
        <div class="ln-faecher">${s.faechern.map((n, i) => `<i title="Fach ${i + 1}: ${n}" style="--h:${s.anzahl ? Math.max(6, (n / s.anzahl) * 100) : 6}%"><b>${n}</b></i>`).join("")}</div>
      </button>`).join("") : `<div class="hf-leer">Noch keine Stapel. Scann zuerst ein paar Karten.</div>`;
    $("#ln-detail").style.display = "none";
  }
  $("#ln-stapel").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-stapel]");
    if (b) zeigeDetail(b.dataset.stapel);
  });
  async function zeigeDetail(id) {
    try { detail = await json(`/api/lernen/stapel/${encodeURIComponent(id)}`); } catch (err) { status(err.message, true); return; }
    const d = $("#ln-detail");
    d.style.display = "";
    d.innerHTML = `
      <div class="hf-reihe">
        <input id="ln-d-titel" class="hf-input grow" value="${esc(detail.titel)}" aria-label="Name des Stapels">
        <button class="hf-btn" data-d="abfragen" type="button">🎯 Abfragen</button>
        <button class="hf-btn" data-d="hilfe" type="button">💡 Lernen</button>
        <button class="hf-btn" data-d="plan" type="button">📅 Plan</button>
        <button class="hf-btn leise" data-d="neu" type="button">＋ Karte</button>
        <button class="hf-btn leise" data-d="loeschen" type="button">🗑 Stapel löschen</button>
      </div>
      <div class="hf-liste" style="margin-top:10px">${detail.karten.map((k) => `
        <div class="hf-zeile ln-vz" data-k="${esc(k.id)}">
          <span class="icon" title="Fach ${k.fach || 1} von 5">${["①", "②", "③", "④", "⑤"][Math.min(4, (k.fach || 1) - 1)]}</span>
          <div class="name">
            <input class="hf-input" data-f value="${esc(k.frage)}" aria-label="Frage">
            <textarea class="hf-input" data-a rows="${Math.min(6, Math.max(2, (k.antwort || "").split("\n").length))}" aria-label="Antwort">${esc(k.antwort)}</textarea>
            <span class="klein">${k.richtig || 0}× richtig · ${k.falsch || 0}× falsch · fällig ${esc(k.faellig || "heute")}${k.bild ? " · 📷 Foto" : ""}</span>
          </div>
          <button class="hf-mini" data-x="${esc(k.id)}" title="Karte löschen">🗑</button>
        </div>`).join("") || `<div class="hf-leer">Leer.</div>`}</div>`;
    d.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("#ln-detail").addEventListener("change", async (e) => {
    try {
      if (e.target.id === "ln-d-titel") { await json(`/api/lernen/stapel/${detail.id}`, { method: "PATCH", body: { titel: e.target.value } }); await laden(); zeichneStapel(); zeigeDetail(detail.id); return; }
      const z = e.target.closest("[data-k]");
      if (!z) return;
      await json(`/api/lernen/stapel/${detail.id}/karte/${z.dataset.k}`, { method: "PATCH", body: { frage: z.querySelector("[data-f]").value, antwort: z.querySelector("[data-a]").value } });
      status("✓ Gespeichert");
    } catch (err) { status(err.message, true); }
  });
  $("#ln-detail").addEventListener("click", async (e) => {
    const x = e.target.closest("[data-x]");
    const a = e.target.closest("[data-d]");
    try {
      if (x) { await json(`/api/lernen/stapel/${detail.id}/karte/${x.dataset.x}`, { method: "DELETE" }); x.closest("[data-k]").remove(); await laden(); return; }
      if (!a) return;
      const was = a.dataset.d;
      if (was === "loeschen") {
        if (!a.dataset.sicher) { a.dataset.sicher = "1"; a.textContent = "Wirklich löschen? Nochmal tippen"; setTimeout(() => { if (a.isConnected) { delete a.dataset.sicher; a.textContent = "🗑 Stapel löschen"; } }, 4000); return; }
        await json(`/api/lernen/stapel/${detail.id}`, { method: "DELETE" });
        detail = null; await laden(); zeichneStapel(); status("Stapel gelöscht."); return;
      }
      if (was === "neu") { await json("/api/lernen/karten", { body: { stapel: detail.id, karten: [{ frage: "Neue Karte", antwort: "" }] } }); await laden(); zeigeDetail(detail.id); return; }
      const id = detail.id;
      zeigeTab(was);
      if (was === "abfragen") { $("#ln-q-stapel").value = id; quizStart(); }
      if (was === "hilfe") { $("#ln-h-stapel").value = id; hilfeLaden(); }
      if (was === "plan") $("#ln-p-stapel").value = id;
    } catch (err) { status(err.message, true); }
  });

  // ---------- Abfragen ----------
  const mische = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  async function kartenFuer(sid) {
    const ids = sid === "alle" ? info.stapel.map((s) => s.id) : [sid];
    const out = [];
    for (const id of ids) { const s = await json(`/api/lernen/stapel/${encodeURIComponent(id)}`); out.push(...s.karten.map((k) => ({ ...k, sid: s.id, stitel: s.titel, plan: s.plan }))); }
    return out;
  }
  async function quizStart() {
    if (!info.karten) { zeigeTab("scannen"); status("Es gibt noch keine Karten. Scann zuerst welche."); sag("Du hast noch keine Lernkarten. Lass uns zuerst welche scannen."); return; }
    const sid = $("#ln-q-stapel").value || info.stapel[0]?.id;
    const wahl = $("#ln-q-wahl").value;
    let karten;
    try { karten = await kartenFuer(sid); } catch (err) { status(err.message, true); return; }
    const h = tag();
    let auswahl = karten;
    let hinweis = "";
    if (wahl === "faellig") auswahl = karten.filter((k) => !k.faellig || k.faellig <= h);
    if (wahl === "falsch") auswahl = karten.filter((k) => (k.falsch || 0) > 0 || k.letztes === "falsch" || k.letztes === "teilweise");
    if (wahl === "heute") { const ids = new Set(karten.flatMap((k) => k.plan?.tage?.find((t) => t.datum === h) ? [...k.plan.tage.find((t) => t.datum === h).neu, ...k.plan.tage.find((t) => t.datum === h).wiederholen] : [])); auswahl = karten.filter((k) => ids.has(k.id)); }
    if (!auswahl.length) { auswahl = karten; hinweis = wahl === "faellig" ? "Heute ist nichts fällig, ich frag einfach alle ab. " : wahl === "heute" ? "Für heute gibt es keinen Plan, ich frag alle ab. " : "Da gibt es keine, ich frag alle ab. "; }
    // Fällige und schwierige zuerst, sonst durcheinander.
    if ($("#ln-q-mischen").checked) mische(auswahl); else auswahl.sort((a, b) => (a.fach || 1) - (b.fach || 1));
    quiz = { sid, liste: auswahl.map((k) => ({ k, nochmal: 0 })), i: 0, richtig: 0, teilweise: 0, falsch: 0, start: Date.now(), laeuft: true, nr: (quiz?.nr || 0) + 1, offen: null, ergebnis: null };
    $("#ln-q-setup").style.display = "none"; $("#ln-q-ende").style.display = "none"; $("#ln-q").style.display = "";
    mikroBelegen(true);
    const n = auswahl.length;
    await sag(`${hinweis}${n} Karte${n === 1 ? "" : "n"}. Los geht's.`);
    if (quiz?.laeuft) frage();
  }
  let eingabe = null;
  const warteEingabe = () => new Promise((ok) => { eingabe = ok; });
  const gib = (x) => { const f = eingabe; eingabe = null; hoerAuf(); f?.(x); };
  const BEFEHL = [
    ["ende", /^(stopp?|beenden|aufhören|aufhoeren|schluss|abbrechen|ende|genug|pause|fertig für heute|fertig fuer heute|ich will aufhören)$/i],
    ["weissnicht", /^(ich )?(weiß|weiss) (es |ich )?(nicht|leider nicht)|^keine ahnung|^aufdecken|^(sag|zeig) (mir )?(die )?(lösung|loesung|antwort)|^lösung$|^loesung$|^passe?$/i],
    ["wiederholen", /^(noch ?mal|nochmal|wiederholen|wiederhol das|wie bitte|was|bitte nochmal|frage wiederholen|kannst du das wiederholen)$/i],
    ["tipp", /^(tipp|ein tipp|hinweis|hilfe|gib mir einen tipp|hilf mir)$/i],
    ["skip", /^(später|spaeter|überspringen|ueberspringen|weiter|nächste|naechste|nächste karte|skip)$/i],
  ];
  const befehlVon = (t) => { const x = String(t || "").toLowerCase().replace(/^(hey |ok )?(friday|freitag)[,.!]?\s*/, "").replace(/[.!?,]/g, "").trim(); return BEFEHL.find(([, re]) => re.test(x))?.[0] || null; };

  async function frage() {
    if (!quiz?.laeuft) return;
    if (quiz.i >= quiz.liste.length) return quizEnde();
    const nr = quiz.nr;
    const { k } = quiz.liste[quiz.i];
    $("#ln-q-nr").textContent = `Karte ${quiz.i + 1} von ${quiz.liste.length}${info.stapel.length > 1 ? ` · ${k.stitel}` : ""}`;
    $("#ln-q-score").textContent = `✓ ${quiz.richtig}  ~ ${quiz.teilweise}  ✗ ${quiz.falsch}`;
    $("#ln-q-balken").style.width = `${Math.round((quiz.i / quiz.liste.length) * 100)}%`;
    $("#ln-q-frage").textContent = k.frage;
    $("#ln-q-ergebnis").style.display = "none";
    $("#ln-q-eingabe").value = "";
    $("#ln-q-live").textContent = "…";
    $("#ln-q-mikro").classList.remove("an");
    await sag(k.frage);
    if (nr !== quiz?.nr || !quiz.laeuft) return;
    let x;
    let auto = $("#ln-q-stimme").checked;
    for (;;) {
      const p = warteEingabe();
      if (auto) zuhoeren(nr);
      x = await p;
      if (nr !== quiz?.nr || !quiz.laeuft) return;
      auto = $("#ln-q-stimme").checked;
      if (x.typ === "wiederholen") { await sag(k.frage); continue; }
      if (x.typ === "tipp") { await sag(tippVon(k)); continue; }
      if (x.typ === "leer") { $("#ln-q-live").textContent = "Nichts gehört. Tipp auf 🎤 Antworten oder schreib die Antwort."; auto = false; continue; }
      break;
    }
    if (x.typ === "ende") return quizEnde();
    if (x.typ === "skip") { quiz.liste.push(quiz.liste.splice(quiz.i, 1)[0]); if (quiz.liste.length > 1) return frage(); }
    let r;
    if (x.typ === "weissnicht") r = { ergebnis: "falsch", punkte: (k.antwort || "").split("\n").filter(Boolean).map((t) => ({ text: t, getroffen: false })), fehlt: [], sprechText: `Kein Problem. Die Antwort ist: ${(k.antwort || "").replace(/\n/g, ", ")}`, gesagt: "" };
    else {
      try { r = await json("/api/lernen/pruefen", { body: { stapel: k.sid, karte: k.id, antwort: x.text, reihenfolge: $("#ln-q-reihe").value } }); }
      catch (err) { status(err.message, true); r = { ergebnis: "teilweise", punkte: [], fehlt: [], sprechText: "Das konnte ich gerade nicht prüfen." }; }
      r.gesagt = x.text;
    }
    zeigeErgebnis(k, r);
    await sag(r.sprechText);
    if (nr !== quiz?.nr || !quiz.laeuft) return;
    if ($("#ln-q-auto").checked && !quiz.halt) { await new Promise((ok) => setTimeout(ok, 700)); if (nr === quiz?.nr && quiz.laeuft && !quiz.halt && !quiz.weiterGedrueckt) weiter(); }
  }
  let hoerNr = 0;
  async function zuhoeren(nr) {
    const meins = ++hoerNr;
    const m = $("#ln-q-mikro");
    m.classList.add("an");
    $("#ln-q-live").textContent = "🎤 Ich höre zu …";
    try {
      const t = await hoere({ live: (x) => { $("#ln-q-live").textContent = x; } });
      if (meins !== hoerNr) return; // ein neueres Zuhören hat übernommen
      m.classList.remove("an");
      if (nr !== quiz?.nr || !eingabe) return;
      if (!t) return gib({ typ: "leer" });
      const b = befehlVon(t);
      gib(b ? { typ: b } : { typ: "antwort", text: t });
    } catch (err) {
      if (meins !== hoerNr) return;
      m.classList.remove("an");
      $("#ln-q-live").textContent = err.message;
    }
  }
  function tippVon(k) {
    const z = String(k.antwort || "").split("\n").map((s) => s.replace(/^\s*(?:[-–•*]|\d+[.)])\s*/, "").trim()).filter(Boolean);
    if (!z.length) return "Dazu habe ich leider keinen Tipp.";
    const wort = (z[0].match(/[A-Za-zÄÖÜäöüß0-9]{3,}/) || [z[0]])[0];
    return `${z.length > 1 ? `Es sind ${z.length} Punkte. ` : ""}Der Anfang: ${wort.slice(0, Math.max(3, Math.ceil(wort.length / 2)))} …`;
  }
  const FARBE = { richtig: "hf-gut", teilweise: "hf-warn", falsch: "hf-schlecht" };
  const WORT = { richtig: "✓ Richtig", teilweise: "~ Fast", falsch: "✗ Noch nicht" };
  function zeigeErgebnis(k, r) {
    quiz.ergebnis = r.ergebnis; quiz.offen = k; quiz.weiterGedrueckt = false; quiz.halt = false;
    const e = $("#ln-q-ergebnis");
    e.style.display = "";
    e.innerHTML = `
      <div class="hf-reihe"><span class="hf-badge ${FARBE[r.ergebnis]}" style="font-size:14px">${WORT[r.ergebnis]}</span>${r.reihenfolgeFalsch ? `<span class="hf-badge hf-warn">Reihenfolge falsch</span>` : ""}${r.ki ? `<span class="hf-badge hf-info">KI geprüft</span>` : ""}</div>
      ${r.gesagt ? `<p class="hf-zitat">Du: „${esc(r.gesagt)}“</p>` : ""}
      <p style="margin:8px 0">${esc(r.sprechText)}</p>
      <ol class="ln-punkte">${(r.punkte?.length ? r.punkte : [{ text: k.antwort, getroffen: r.ergebnis === "richtig" }]).map((p) => `<li class="${p.getroffen ? "hf-gut" : "hf-schlecht"}">${p.getroffen ? "✓" : "✗"} ${esc(p.text)}</li>`).join("")}</ol>
      <div class="hf-reihe" style="margin-top:8px">
        <button class="hf-btn haupt" data-e="weiter" type="button">Weiter ▶</button>
        ${r.ergebnis !== "richtig" ? `<button class="hf-btn" data-e="doch" type="button">Doch richtig ✓</button>` : ""}
        ${r.gesagt && r.ergebnis !== "richtig" ? `<button class="hf-btn ki" data-e="ki" type="button">🤖 KI prüft nochmal</button>` : ""}
        <button class="hf-btn leise" data-e="halt" type="button">⏸ Kurz anhalten</button>
        ${k.bild ? `<button class="hf-btn leise" data-e="foto" type="button">📷 Original</button>` : ""}
      </div>
      <img class="ln-vor" id="ln-q-foto" alt="" style="display:none">`;
    e.dataset.gesagt = r.gesagt || "";
  }
  $("#ln-q-ergebnis").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-e]");
    if (!b || !quiz) return;
    const k = quiz.offen;
    if (b.dataset.e === "weiter") { quiz.weiterGedrueckt = true; still(); weiter(); }
    if (b.dataset.e === "doch") { quiz.ergebnis = "richtig"; quiz.weiterGedrueckt = true; still(); weiter(); }
    if (b.dataset.e === "halt") { quiz.halt = true; still(); b.textContent = "Angehalten. Weiter mit „Weiter ▶“"; }
    if (b.dataset.e === "foto") {
      try { const res = await F().api(`/api/lernen/bild/${encodeURIComponent(k.bild)}`); const img = $("#ln-q-foto"); img.src = URL.createObjectURL(await res.blob()); img.style.display = "block"; quiz.halt = true; } catch (err) { status(err.message, true); }
    }
    if (b.dataset.e === "ki") {
      b.disabled = true; quiz.halt = true;
      try {
        const r = await json("/api/lernen/ki/pruefen", { body: { stapel: k.sid, karte: k.id, antwort: $("#ln-q-ergebnis").dataset.gesagt } });
        r.gesagt = $("#ln-q-ergebnis").dataset.gesagt;
        zeigeErgebnis(k, { ...r, punkte: (k.antwort || "").split("\n").filter(Boolean).map((t) => ({ text: t, getroffen: !r.fehlt?.some((f) => t.toLowerCase().includes(String(f).toLowerCase())) && r.ergebnis !== "falsch" })) });
        quiz.halt = true;
        await sag(r.sprechText);
      } catch (err) { status(kiFehler(err), true); b.disabled = false; }
    }
  });
  async function weiter() {
    if (!quiz?.laeuft || !quiz.offen) return;
    const k = quiz.offen, erg = quiz.ergebnis, eintrag = quiz.liste[quiz.i];
    quiz.offen = null;
    quiz[erg]++;
    try { await json("/api/lernen/bewerten", { body: { stapel: k.sid, karte: k.id, ergebnis: erg } }); } catch (err) { status(err.message, true); }
    // Falsch oder nur halb: kommt in dieser Runde nach ein paar Karten nochmal (höchstens zweimal).
    if (erg !== "richtig" && eintrag.nochmal < 2) quiz.liste.splice(Math.min(quiz.liste.length, quiz.i + 4), 0, { k, nochmal: eintrag.nochmal + 1 });
    quiz.i++;
    frage();
  }
  w.sheet.querySelector(".ln-q-knoepfe").addEventListener("click", (e) => {
    const b = e.target.closest("[data-q]");
    if (!b || !quiz?.laeuft) return;
    still();
    if (b.dataset.q === "hoeren") { if (eingabe) zuhoeren(quiz.nr); return; }
    if (b.dataset.q === "ende") { if (eingabe) gib({ typ: "ende" }); else quizEnde(); return; }
    if (eingabe) gib({ typ: b.dataset.q });
  });
  $("#ln-q-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = $("#ln-q-eingabe").value.trim();
    if (!t || !eingabe) return;
    still();
    gib({ typ: "antwort", text: t });
  });
  async function quizEnde(stumm = false) {
    if (!quiz) return;
    const q = quiz;
    q.laeuft = false;
    q.nr++;
    hoerAuf();
    if (eingabe) { const f = eingabe; eingabe = null; f({ typ: "ende" }); }
    if (q.offen) { q[q.ergebnis]++; json("/api/lernen/bewerten", { body: { stapel: q.offen.sid, karte: q.offen.id, ergebnis: q.ergebnis } }).catch(() => {}); q.offen = null; }
    mikroBelegen(false);
    const sum = q.richtig + q.teilweise + q.falsch;
    $("#ln-q").style.display = "none"; $("#ln-q-setup").style.display = "";
    if (sum) json("/api/lernen/sitzung", { body: { stapel: q.sid === "alle" ? "" : q.sid, richtig: q.richtig, teilweise: q.teilweise, falsch: q.falsch, dauer: (Date.now() - q.start) / 1000 } }).catch(() => {});
    const text = !sum ? "Okay, wir hören auf." : q.falsch + q.teilweise === 0 ? `Super, ${NAME}! Alle ${sum} richtig.` : `Fertig! ${q.richtig} von ${sum} richtig${q.teilweise ? `, ${q.teilweise} fast` : ""}. Die anderen frage ich dich morgen nochmal ab.`;
    const e = $("#ln-q-ende");
    e.style.display = "";
    e.innerHTML = `<h3>Ergebnis</h3><p style="font-size:17px;margin:4px 0 10px">${esc(text)}</p>
      <div class="hf-reihe"><button class="hf-btn haupt" data-n="nochmal" type="button">🔁 Nochmal abfragen</button><button class="hf-btn" data-n="falsch" type="button">✗ Nur die falschen</button><button class="hf-btn leise" data-n="hilfe" type="button">💡 Zur Lernhilfe</button></div>`;
    laden().catch(() => {});
    if (!stumm) sag(text);
  }
  $("#ln-q-ende").addEventListener("click", (e) => {
    const b = e.target.closest("[data-n]");
    if (!b) return;
    if (b.dataset.n === "hilfe") return zeigeTab("hilfe");
    $("#ln-q-wahl").value = b.dataset.n === "falsch" ? "falsch" : "alle";
    quizStart();
  });
  $("#ln-q-los").addEventListener("click", () => { still(); quizStart(); });

  // ---------- Lernhilfe ----------
  async function hilfeLaden() {
    const sid = $("#ln-h-stapel").value;
    if (!sid) { $("#ln-h").innerHTML = `<div class="hf-leer">Noch keine Karten. Scann zuerst welche.</div>`; return; }
    if (hilfe.stapel !== sid) {
      try { const s = await json(`/api/lernen/stapel/${encodeURIComponent(sid)}`); hilfe = { stapel: sid, karten: s.karten.map((k) => ({ ...k, sid })), i: 0, offen: false }; } catch (err) { status(err.message, true); return; }
    }
    zeichneHilfe();
  }
  $("#ln-h-stapel").addEventListener("change", hilfeLaden);
  const punkte = (a) => String(a || "").split("\n").map((s) => s.replace(/^\s*(?:[-–•*]|\d+[.)])\s*/, "").trim()).filter(Boolean);
  function eselsbruecke(k) {
    const p = punkte(k.antwort);
    if (p.length >= 2) {
      const b = p.map((x) => (x.match(/[A-Za-zÄÖÜäöüß0-9]/) || ["?"])[0].toUpperCase());
      return `Merk dir die Anfangsbuchstaben: ${b.join(" – ")}. Bau dir daraus einen lustigen Satz, zum Beispiel mit Wörtern, die so anfangen.`;
    }
    const lang = (p[0] || "").split(/\s+/).filter((x) => x.length > 5).slice(0, 3);
    return lang.length ? `Die wichtigsten Wörter sind: ${lang.join(", ")}. Wenn du die drei sagst, hast du die Antwort fast.` : "Die Antwort ist kurz. Sag sie dir dreimal laut vor.";
  }
  function lueckentext(text) {
    return esc(text).replace(/[A-Za-zÄÖÜäöüß]{6,}/g, (m, i) => (i % 2 === 0 || m.length > 8 ? `<button class="ln-luecke" data-wort="${m}">${"_".repeat(Math.min(10, m.length))}</button>` : m));
  }
  function zeichneHilfe(extra = "") {
    const k = hilfe.karten[hilfe.i];
    if (!k) { $("#ln-h").innerHTML = `<div class="hf-leer">Der Stapel ist leer.</div>`; return; }
    $("#ln-h").innerHTML = `
      <div class="ln-karteikarte ${hilfe.offen ? "offen" : ""}" id="ln-h-karte" role="button" tabindex="0" aria-label="Karte umdrehen">
        <div class="klein hf-hinweis">Karte ${hilfe.i + 1} von ${hilfe.karten.length} · ${hilfe.offen ? "Rückseite" : "Vorderseite, tippen zum Umdrehen"}</div>
        <div class="ln-frage">${esc(hilfe.offen ? "" : k.frage)}</div>
        ${hilfe.offen ? `<div class="ln-antwort">${esc(k.frage)}</div><ol class="ln-punkte">${punkte(k.antwort).map((p) => `<li>${esc(p)}</li>`).join("")}</ol>` : ""}
      </div>
      <div class="hf-reihe">
        <button class="hf-btn" data-h="zurueck" type="button">◀</button>
        <button class="hf-btn" data-h="dreh" type="button">🔄 Umdrehen</button>
        <button class="hf-btn" data-h="vor" type="button">▶</button>
        <button class="hf-btn" data-h="zufall" type="button">🎲</button>
        <button class="hf-btn" data-h="lesen" type="button">🔊 Vorlesen</button>
        <button class="hf-btn" data-h="esel" type="button">🧠 Eselsbrücke</button>
        <button class="hf-btn" data-h="luecke" type="button">✏ Lückentext</button>
        <button class="hf-btn" data-h="einzeln" type="button">🎯 Nur diese abfragen</button>
      </div>
      <div class="hf-karte"><h3>Frag Friday dazu</h3>
        <form class="hf-reihe" id="ln-h-form" autocomplete="off"><input id="ln-h-frage" class="hf-input grow" type="text" placeholder="z. B. Was ist der Unterschied zwischen Mitose und Meiose?"><button class="hf-btn ki" type="submit">🤖 Erklär's mir</button></form>
      </div>
      <div id="ln-h-extra" class="hf-karte" style="${extra ? "" : "display:none"}">${extra}</div>`;
  }
  $("#ln-h").addEventListener("click", async (e) => {
    const k = hilfe.karten[hilfe.i];
    if (e.target.closest("#ln-h-karte") && !e.target.closest("button")) { hilfe.offen = !hilfe.offen; return zeichneHilfe(); }
    const l = e.target.closest(".ln-luecke");
    if (l) { l.replaceWith(document.createTextNode(l.dataset.wort)); return; }
    const b = e.target.closest("[data-h]");
    if (!b || !k) return;
    const n = hilfe.karten.length;
    switch (b.dataset.h) {
      case "zurueck": hilfe.i = (hilfe.i - 1 + n) % n; hilfe.offen = false; return zeichneHilfe();
      case "vor": hilfe.i = (hilfe.i + 1) % n; hilfe.offen = false; return zeichneHilfe();
      case "zufall": hilfe.i = Math.floor(Math.random() * n); hilfe.offen = false; return zeichneHilfe();
      case "dreh": hilfe.offen = !hilfe.offen; return zeichneHilfe();
      case "lesen": still(); return sag(`${k.frage}. ${punkte(k.antwort).join(". ")}`);
      case "esel": { const t = eselsbruecke(k); zeichneHilfe(`<h3>🧠 Eselsbrücke</h3><p>${esc(t)}</p>`); return sag(t); }
      case "luecke": return zeichneHilfe(`<h3>✏ Lückentext – tipp auf eine Lücke zum Aufdecken</h3><div class="ln-frage" style="font-size:16px">${esc(k.frage)}</div><p style="line-height:1.9">${lueckentext(punkte(k.antwort).join(" · "))}</p>`);
      case "einzeln": {
        zeigeTab("abfragen");
        quiz = { sid: hilfe.stapel, liste: [{ k, nochmal: 0 }], i: 0, richtig: 0, teilweise: 0, falsch: 0, start: Date.now(), laeuft: true, nr: (quiz?.nr || 0) + 1 };
        $("#ln-q-setup").style.display = "none"; $("#ln-q-ende").style.display = "none"; $("#ln-q").style.display = "";
        mikroBelegen(true);
        return frage();
      }
      default:
    }
  });
  $("#ln-h").addEventListener("submit", async (e) => {
    if (e.target.id !== "ln-h-form") return;
    e.preventDefault();
    const k = hilfe.karten[hilfe.i];
    const frageText = $("#ln-h-frage").value.trim();
    const b = e.target.querySelector("button"); b.disabled = true;
    status("Friday denkt nach …");
    try {
      const r = await json("/api/lernen/ki/erklaeren", { body: { stapel: k.sid, karte: k.id, frage: frageText } });
      zeichneHilfe(`<h3>🤖 Erklärung${frageText ? `: ${esc(frageText)}` : ""}</h3><p style="white-space:pre-wrap">${esc(r.text)}</p>`);
      status("");
      sag(r.text);
    } catch (err) { status(kiFehler(err), true); b.disabled = false; }
  });

  // ---------- Lernplan ----------
  async function zeigePlan(plan) {
    const h = tag();
    const st = info.stapel.find((s) => s.id === $("#ln-p-stapel").value);
    if (!plan) plan = st?.plan;
    $("#ln-p").innerHTML = plan ? plan.tage.map((t) => `
      <div class="hf-zeile ${t.datum === h ? "ln-heute" : ""}">
        <span class="icon">${t.datum === h ? "👉" : "📅"}</span>
        <span class="name"><b>${esc(t.wt)} ${esc(t.datum.slice(8, 10))}.${esc(t.datum.slice(5, 7))}.</b> ${t.datum === h ? "(heute)" : ""}<br><span class="klein">${esc(t.text)} · ca. ${t.minuten} Min.${t.zuViel ? " · viel, ggf. auf zwei Runden aufteilen" : ""}</span></span>
        ${t.datum === h ? `<button class="hf-mini" data-p-heute="1">▶ Jetzt lernen</button>` : ""}
      </div>`).join("") + (plan.pruefung ? `<div class="hf-hinweis">🎓 Prüfung am ${esc(plan.pruefung.split("-").reverse().join("."))}. Viel Erfolg!</div>` : "") : `<div class="hf-leer">Noch kein Plan für diesen Stapel.</div>`;
    if (plan?.pruefung) $("#ln-p-datum").value = plan.pruefung;
  }
  $("#ln-p-stapel").addEventListener("change", () => zeigePlan());
  $("#ln-p-los").addEventListener("click", async () => {
    const sid = $("#ln-p-stapel").value;
    if (!sid) return status("Erst Karten scannen.", true);
    try {
      const plan = await json(`/api/lernen/plan/${encodeURIComponent(sid)}`, { body: { pruefung: $("#ln-p-datum").value || null, minuten: +$("#ln-p-min").value || 20 } });
      await laden();
      $("#ln-p-stapel").value = sid;
      zeigePlan(plan);
      const heute = plan.tage[0];
      sag(`Dein Plan steht: ${plan.tage.length} Tage. Heute: ${heute.text}`);
    } catch (err) { status(err.message, true); }
  });
  $("#ln-p").addEventListener("click", (e) => {
    if (!e.target.closest("[data-p-heute]")) return;
    const sid = $("#ln-p-stapel").value;
    zeigeTab("abfragen");
    $("#ln-q-stapel").value = sid; $("#ln-q-wahl").value = "heute";
    quizStart();
  });
  w.sheet.querySelector('[data-tab="plan"]').addEventListener("click", () => zeigePlan());

  // Fenster zu → Mikrofon wieder freigeben, Abfrage beenden.
  new MutationObserver(() => {
    if (!w.offen()) { if (quiz?.laeuft) quizEnde(true); hoerAuf(); mikroBelegen(false); }
  }).observe(w.sheet, { attributes: true, attributeFilter: ["class"] });

  // Direkt-Link /?lernen und „immer mit der Lernecke starten“.
  // (Die Einstellungs-Synchronisierung lädt die Seite beim ersten Start evtl. einmal neu, darum merkt sich
  // die Lernecke den Wunsch kurz in der Sitzung und entfernt ?lernen erst, wenn sie offen ist.)
  const perLink = new URLSearchParams(location.search).has("lernen");
  try { if (perLink) sessionStorage.setItem("lernecke_direkt", "1"); } catch { /* egal */ }
  let gemerkt = false;
  try { gemerkt = sessionStorage.getItem("lernecke_direkt") === "1"; } catch { /* egal */ }
  if (perLink || gemerkt || lsGet("lernecke_start") === "1") {
    let n = 0;
    const t = setInterval(() => {
      // erst wenn angemeldet (Anmelde-Fenster zu, Schlüssel da) – Carla meldet sich ggf. erst an
      const bereit = ++n > 3 && window.Friday?.api && lsGet("friday_token") && document.getElementById("login")?.classList.contains("hidden");
      if (bereit || n > 2400) {
        clearInterval(t);
        if (!bereit) return;
        try { sessionStorage.removeItem("lernecke_direkt"); } catch { /* egal */ }
        if (new URLSearchParams(location.search).has("lernen")) { try { history.replaceState(null, "", location.pathname); } catch { /* egal */ } }
        w.auf({});
      }
    }, 500);
  }

  const style = document.createElement("style");
  style.textContent = `
.ln-box { width: min(1080px, 100%); }
.ln-gruss-text { font-size: 19px; line-height: 1.45; color: var(--text); margin-bottom: 14px; }
.ln-gross { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.ln-kachel { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left; padding: 16px; border-radius: 16px; border: 1px solid var(--u-rand, var(--cyan)); background: linear-gradient(160deg, color-mix(in srgb, var(--cyan) 18%, transparent), rgba(0,0,0,.25)); color: var(--text); font: inherit; cursor: pointer; }
.ln-kachel:hover { box-shadow: 0 0 22px color-mix(in srgb, var(--cyan) 40%, transparent); }
.ln-kachel b { font-size: 30px; } .ln-kachel span { font-size: 17px; font-weight: 700; } .ln-kachel small { font-size: 12.5px; color: var(--muted); }
.ln-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--muted); cursor: pointer; }
.ln-vor { max-width: 100%; max-height: 260px; margin-top: 10px; border-radius: 10px; border: 1px solid var(--u-rand-soft, var(--line)); }
.ln-vz { align-items: flex-start; }
.ln-vz .name { display: flex; flex-direction: column; gap: 6px; }
.ln-vz textarea { resize: vertical; min-height: 44px; line-height: 1.4; }
.ln-vz input[data-f] { font-weight: 700; }
.hf-balken i.laeuft { animation: ln-lauf 1.2s ease-in-out infinite alternate; }
@keyframes ln-lauf { from { opacity: .45; } to { opacity: 1; } }
.ln-stapel { text-align: left; cursor: pointer; color: var(--text); font: inherit; }
.ln-faecher { display: flex; gap: 4px; align-items: flex-end; height: 44px; margin-top: 8px; }
.ln-faecher i { flex: 1; height: var(--h); min-height: 6px; border-radius: 4px 4px 2px 2px; background: linear-gradient(180deg, var(--cyan), color-mix(in srgb, var(--cyan) 40%, transparent)); position: relative; }
.ln-faecher i b { position: absolute; top: -15px; left: 0; right: 0; text-align: center; font-size: 10px; color: var(--muted); font-weight: 400; }
.ln-quiz { display: flex; flex-direction: column; gap: 12px; }
.ln-q-kopf { display: flex; justify-content: space-between; font-size: 13px; color: var(--muted); letter-spacing: .04em; }
.ln-frage { font-size: 26px; font-weight: 700; line-height: 1.3; color: var(--text); text-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 35%, transparent); padding: 10px 2px; }
.ln-antwort { font-size: 15px; color: var(--muted); margin-bottom: 6px; }
.ln-mikro { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 8px 12px; border-radius: 12px; border: 1px dashed var(--u-rand-soft, var(--line)); color: var(--muted); font-size: 15px; }
.ln-mikro i { width: 14px; height: 14px; border-radius: 50%; background: var(--muted); flex: none; opacity: .5; }
.ln-mikro.an { border-style: solid; border-color: var(--cyan); color: var(--text); }
.ln-mikro.an i { background: #ff5a4a; opacity: 1; box-shadow: 0 0 0 0 rgba(255,90,74,.6); animation: ln-puls 1.2s infinite; }
@keyframes ln-puls { 0% { box-shadow: 0 0 0 0 rgba(255,90,74,.6); } 100% { box-shadow: 0 0 0 14px rgba(255,90,74,0); } }
.ln-punkte { margin: 6px 0 0; padding-left: 22px; display: flex; flex-direction: column; gap: 4px; font-size: 15px; }
.ln-karteikarte { min-height: 190px; border-radius: 18px; padding: 18px 20px; border: 1px solid var(--u-rand, var(--cyan)); background: radial-gradient(120% 120% at 0% 0%, color-mix(in srgb, var(--cyan) 16%, transparent), rgba(0,0,0,.35)); cursor: pointer; box-shadow: inset 0 0 30px color-mix(in srgb, var(--cyan) 10%, transparent); }
.ln-karteikarte.offen { background: radial-gradient(120% 120% at 100% 0%, color-mix(in srgb, var(--cyan) 22%, transparent), rgba(0,0,0,.4)); }
.ln-hilfe { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
.ln-luecke { border: 0; border-bottom: 2px solid var(--cyan); background: color-mix(in srgb, var(--cyan) 10%, transparent); color: var(--cyan); font: inherit; letter-spacing: 2px; cursor: pointer; padding: 0 4px; border-radius: 4px; }
.ln-heute { border-color: var(--cyan) !important; box-shadow: 0 0 14px color-mix(in srgb, var(--cyan) 30%, transparent); }
@media (max-width: 900px) {
  .ln-gross { grid-template-columns: 1fr; }
  .ln-kachel { flex-direction: row; flex-wrap: wrap; align-items: center; padding: 12px 14px; }
  .ln-kachel b { font-size: 24px; } .ln-kachel small { flex-basis: 100%; }
  .ln-frage { font-size: 21px; }
  .ln-gruss-text { font-size: 17px; }
  .ln-q-knoepfe .hf-btn { flex: 1 1 calc(50% - 8px); padding: 10px 8px; }
  .ln-q-knoepfe .hf-btn[data-q="hoeren"] { flex-basis: 100%; }
  .ln-vz .name { flex: 1 1 calc(100% - 36px) !important; }
  #ln-q-form { flex-wrap: nowrap; }
  #ln-q-form .grow { min-width: 0; }
}`;
  document.head.appendChild(style);

  window.FridayLernen = { open: (o) => w.auf(o || {}), offen: w.offen };
})();
