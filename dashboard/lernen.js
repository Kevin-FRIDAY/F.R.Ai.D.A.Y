// F.R.Ai.D.A.Y – Carlas Lernecke (v1.108.0, Archiv + Ringe ab v1.109.0, neue Optik ab v1.110.0)
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
        <button class="hf-tab" data-tab="archiv">📚 Archiv</button>
        <button class="hf-tab" data-tab="abfragen">🎯 Abfragen</button>
        <button class="hf-tab" data-tab="hilfe">💡 Lernhilfe</button>
        <button class="hf-tab" data-tab="plan">📅 Lernplan</button>
      </div>
      <div id="ln-status" class="hf-status"></div>
      <div id="ln-testband" class="ln-test" style="display:none"><span>🧪 <b>Kevin-Testmodus:</b> Carla wird nicht begrüßt, Abfrage-Ergebnisse zählen nicht für ihren Fortschritt. Gescannte Karten werden aber gespeichert.</span>
        <button class="hf-mini" data-wer-wahl="carla" type="button">Als Carla starten</button></div>

      <section data-seite="start">
        <div id="ln-wer-k" class="hf-karte" style="display:none">
          <h3>Wer ist da?</h3>
          <div class="ln-wer">
            <button class="ln-kachel" data-wer-wahl="carla" type="button"><b>👩</b><span>Ich bin Carla</span><small>Friday begrüßt dich und merkt sich deinen Fortschritt</small></button>
            <button class="ln-kachel" data-wer-wahl="kevin" type="button"><b>🧑</b><span>Ich bin Kevin</span><small>Nur testen oder verbessern, ohne Begrüßung</small></button>
          </div>
          <label class="hf-hinweis ln-check" style="margin-top:8px"><input type="checkbox" id="ln-wer-merken" checked> Auf diesem Gerät merken</label>
        </div>
        <div class="ln-gruss hf-karte" id="ln-gruss-k">
          <div class="ln-hero">
            <div class="ln-orb" aria-hidden="true"><i></i><b>F</b></div>
            <div class="ln-hero-text">
              <div class="ln-gruss-text" id="ln-gruss">Hi ${NAME} …</div>
              <div id="ln-stand" class="ln-chips"></div>
            </div>
          </div>
          <div class="ln-gross">
            <button class="ln-kachel" data-go="abfragen"><b>🎯</b><span>Abfragen</span><small>Ich lese vor, du antwortest</small></button>
            <button class="ln-kachel" data-go="hilfe"><b>💡</b><span>Hilf mir beim Lernen</span><small>Karten ansehen, Eselsbrücken, erklären</small></button>
            <button class="ln-kachel" data-go="scannen"><b>📷</b><span>Neue Karten scannen</span><small>Karteikarte, Zettel oder Buchseite</small></button>
            <button class="ln-kachel" data-go="archiv"><b>📚</b><span>Mein Archiv</span><small id="ln-archiv-zahl">Alle deine Lernunterlagen</small></button>
          </div>
          <div class="hf-reihe ln-stimme-reihe">
            <button id="ln-mikro-start" class="hf-btn" type="button">🎤 Per Stimme sagen, was wir machen</button>
            <span id="ln-live-start" class="hf-hinweis"></span>
          </div>
        </div>
        <div id="ln-heute" class="hf-karte" style="display:none"><h3>Heute dran</h3><div id="ln-heute-liste"></div></div>
        <div id="ln-fortschritt" class="hf-karte" style="display:none"><h3>Dein Fortschritt</h3><div id="ln-fortschritt-liste" class="ln-themen"></div>
          <p class="hf-hinweis ln-legende"><span><b>Geübt</b> schon mal beantwortet</span><span><b>Gemerkt</b> so oft richtig</span><span><b>Auswendig</b> sitzt sicher</span></p></div>
        <details class="ln-geraet hf-karte">
          <summary>⚙ Einstellungen für dieses Gerät</summary>
          <div class="hf-reihe" style="margin-top:10px">
            <label class="ln-check">Dieses Gerät gehört: <select id="ln-geraet" class="hf-input" style="width:auto"><option value="">jedes Mal fragen</option><option value="carla">Carla</option><option value="kevin">Kevin (Testmodus)</option></select></label>
            <label class="ln-check"><input type="checkbox" id="ln-immer"> Immer direkt mit der Lernecke starten</label>
          </div>
        </details>
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
              <button id="ln-cam-an" class="hf-btn" type="button">🎥 Live-Kamera (Mac)</button>
            </div>
            <div id="ln-cam-box" class="ln-cam-box" style="display:none">
              <video id="ln-cam" autoplay playsinline muted></video>
              <div class="hf-hinweis" id="ln-cam-hinweis"></div>
              <div class="hf-reihe"><button id="ln-cam-foto" class="hf-btn haupt" type="button">📸 Aufnehmen</button><button id="ln-cam-wechsel" class="hf-btn leise" type="button">🔄 Andere Kamera</button><button id="ln-cam-zu" class="hf-btn leise" type="button">✕ Kamera aus</button></div>
            </div>
            <img id="ln-vor" alt="" class="ln-vor" style="display:none">
            <div class="hf-balken" style="margin-top:10px"><i id="ln-ocr" style="width:0%"></i></div>
            <div class="hf-reihe" style="margin-top:10px"><button id="ln-spiegeln" class="hf-btn leise" type="button" disabled title="Falls die Schrift spiegelverkehrt war">⇋ Spiegelverkehrt? Andersrum lesen</button><button id="ln-ki-lesen" class="hf-btn ki" type="button" disabled>🤖 KI liest die Schrift</button></div>
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

      <section data-seite="archiv" class="hidden">
        <div class="hf-karte">
          <div class="hf-reihe">
            <input id="ln-a-suche" class="hf-input grow" type="search" placeholder="🔎 Suchen, auch im Text der Unterlagen …" aria-label="Im Archiv suchen">
            <select id="ln-a-fach" class="hf-input" style="width:auto" aria-label="Fach"></select>
          </div>
          <div class="hf-reihe" style="margin-top:8px">
            <label class="hf-btn haupt">📷 Foto ablegen<input id="ln-a-foto" type="file" accept="image/*" capture="environment" hidden></label>
            <label class="hf-btn">📎 Datei ablegen<input id="ln-a-datei" type="file" multiple hidden></label>
            <button id="ln-a-notiz" class="hf-btn" type="button">📝 Notiz</button>
            <button id="ln-a-korb" class="hf-btn leise" type="button">🗑 Papierkorb</button>
          </div>
          <div class="hf-reihe" style="margin-top:8px">
            <input id="ln-a-neu-fach" class="hf-input grow" list="ln-a-faecher" type="text" placeholder="Fach für neue Unterlagen, z. B. Biologie (freiwillig)">
            <datalist id="ln-a-faecher"></datalist>
          </div>
          <div class="hf-balken" style="margin-top:8px"><i id="ln-a-balken" style="width:0%"></i></div>
          <p class="hf-hinweis">Hier liegt alles, was du je gescannt oder abgelegt hast: Fotos mit erkanntem Text, PDFs, Word-Dateien, Präsentationen, Sprachaufnahmen und Notizen. Es bleibt gespeichert, auch wenn du einen Kartenstapel löschst, und ist in jeder Friday-Sicherung enthalten.</p>
        </div>
        <div id="ln-a-ordner" class="ln-ordner"></div>
        <div id="ln-a-detail" class="hf-karte" style="display:none"></div>
        <div id="ln-a-liste" class="ln-a-raster"></div>
        <div class="hf-karte" style="margin-top:12px"><h3>🗂 Meine Karteikarten zum Mitnehmen</h3><div id="ln-a-stapel" class="hf-liste"></div>
          <p class="hf-hinweis">Jeder Stapel als Textdatei, zum Ausdrucken oder Weitergeben.</p></div>
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
    // Am iPhone den gewählten Reiter in der Leiste sichtbar machen (nur waagerecht).
    const reiter = w.sheet.querySelector(`.hf-tabs [data-tab="${t}"]`), leiste = reiter?.parentElement;
    if (reiter && leiste && leiste.scrollWidth > leiste.clientWidth) leiste.scrollTo({ left: reiter.offsetLeft - (leiste.clientWidth - reiter.offsetWidth) / 2, behavior: "smooth" });
    w.$$("[data-seite]").forEach((s) => s.classList.toggle("hidden", s.dataset.seite !== t));
    if (t !== "abfragen" && quiz?.laeuft) quizEnde(true);
    if (t !== "scannen") kameraAus();
    if (t === "karten") zeichneStapel();
    if (t === "archiv") archivLaden();
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
  // Wer ist am Gerät? Friday kann Stimmen im Browser nicht zuverlässig unterscheiden, darum merkt sich
  // jedes Gerät, wem es gehört (oder fragt kurz). Kevin landet im Testmodus: keine Begrüßung, nichts zählt.
  let test = false;
  let letzteOpts = {};
  const geraetWer = () => lsGet("lernecke_wer") || "";
  function zeigeTestband() {
    $("#ln-testband").style.display = test ? "" : "none";
    $("#ln-geraet").value = geraetWer();
  }
  async function oeffnen(o) {
    letzteOpts = o;
    mikroBelegen(false);
    const wer = o.wer || (o.modus === "test" ? "kevin" : geraetWer());
    test = wer === "kevin";
    zeigeTab(["abfragen", "scannen", "plan", "archiv"].includes(o.modus) ? o.modus : "start");
    zeigeTestband();
    $("#ln-wer-k").style.display = "none";
    $("#ln-gruss-k").style.display = "";
    try {
      if (!wer) {
        // Unbekanntes Gerät: erst fragen, dann (bei Carla) begrüßen.
        await laden();
        zeigeTab("start");
        $("#ln-wer-k").style.display = ""; $("#ln-gruss-k").style.display = "none";
        return;
      }
      if (test) {
        await laden();
        zeichneStart("Hi Kevin, du bist im Testmodus. Carla wird nicht begrüßt und ihr Fortschritt bleibt, wie er ist.");
        if (o.modus === "abfragen") quizStart();
        return;
      }
      const g = await json("/api/lernen/start", { body: {} });
      info = g;
      fuelleAuswahl();
      zeichneStart(g.text);
      const startseite = !o.modus || o.modus === "start" || o.modus === "carla";
      if (startseite && !g.wiederholt) { await sag(g.text); waehleMitStimme(); }
      else if (startseite && o.stimme) waehleMitStimme();
      if (o.modus === "abfragen") quizStart();
    } catch (err) { status(err.message, true); }
  }
  w.sheet.addEventListener("click", (e) => {
    const b = e.target.closest("[data-wer-wahl]");
    if (!b) return;
    const wer = b.dataset.werWahl;
    if (b.closest("#ln-wer-k") && $("#ln-wer-merken").checked) lsSet("lernecke_wer", wer);
    const modus = letzteOpts.modus && !["test", "start", "carla"].includes(letzteOpts.modus) ? letzteOpts.modus : "start";
    oeffnen({ ...letzteOpts, wer, modus });
  });
  $("#ln-geraet").addEventListener("change", (e) => { lsSet("lernecke_wer", e.target.value); status(e.target.value ? `Gemerkt: Dieses Gerät gehört ${e.target.value === "kevin" ? "Kevin (Testmodus)" : "Carla"}.` : "Friday fragt auf diesem Gerät jedes Mal."); });
  function zeichneStart(gruss) {
    const erstes = !info.profil?.besuche || info.profil.besuche <= 1;
    $("#ln-gruss").textContent = gruss || (erstes
      ? `Hi ${NAME}, ich bin Friday, die künstliche Assistentin von Kevin. Er hat mich gebeten, dir beim Lernen zu helfen. Was wollen wir machen: Soll ich dich abfragen, oder soll ich dir generell beim Lernen helfen?`
      : `Hi ${NAME}, freut mich, dass du da bist. Wie kann ich dir beim Lernen helfen?`);
    const h = info.heute || [];
    $("#ln-heute").style.display = h.length ? "" : "none";
    $("#ln-heute-liste").innerHTML = h.map((x) => `<div class="hf-zeile"><span class="icon">📅</span><span class="name">${esc(x.titel)}<br><span class="klein">${esc(x.text)}</span></span><button class="hf-mini" data-heute="${esc(x.stapel)}">▶ Jetzt lernen</button></div>`).join("");
    const chip = (zahl, wort, extra = "") => `<span class="ln-chip${extra}"><b>${zahl}</b> ${esc(wort)}</span>`;
    const l = info.letzte?.[0];
    $("#ln-stand").innerHTML = info.karten
      ? chip(info.stapel.length, info.stapel.length === 1 ? "Thema" : "Themen") + chip(info.karten, "Karten") + chip(info.faellig, "heute fällig", info.faellig ? " heiss" : "")
        + (l ? chip(`${l.richtig}/${l.richtig + l.teilweise + l.falsch}`, "zuletzt richtig") : "")
      : `<span class="ln-chip">Noch keine Karten. Fang mit „Neue Karten scannen“ an.</span>`;
    $("#ln-immer").checked = lsGet("lernecke_start") === "1";
    $("#ln-archiv-zahl").textContent = info.unterlagen ? `${info.unterlagen} Unterlage${info.unterlagen === 1 ? "" : "n"} gespeichert` : "Alle deine Lernunterlagen";
    const mitKarten = (info.stapel || []).filter((x) => x.anzahl);
    $("#ln-fortschritt").style.display = mitKarten.length ? "" : "none";
    $("#ln-fortschritt-liste").innerHTML = mitKarten.map((x) => themaHtml(x)).join("");
  }
  // ---------- Fortschritts-Ringe ----------
  // Grüner Ring mit Prozent in der Mitte. Pro Thema (Stapel) drei Stück.
  function ring(pct, name, klein = false) {
    const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
    const r = 42, u = 2 * Math.PI * r;
    return `<div class="ln-ring${klein ? " klein" : ""}" role="img" aria-label="${esc(name)}: ${p} Prozent">
      <svg viewBox="0 0 100 100"><circle class="bahn" cx="50" cy="50" r="${r}"/><circle class="wert" cx="50" cy="50" r="${r}" stroke-dasharray="${u.toFixed(1)}" stroke-dashoffset="${(u * (1 - p / 100)).toFixed(1)}" style="--u:${u.toFixed(1)}"/></svg>
      <b>${p}<small>%</small></b><span>${esc(name)}</span></div>`;
  }
  const ringeHtml = (r = {}, klein = false) => `<div class="ln-ringe">${ring(r.geuebt, "Geübt", klein)}${ring(r.gemerkt, "Gemerkt", klein)}${ring(r.auswendig, "Auswendig", klein)}</div>`;
  const themaHtml = (x) => `<button class="ln-thema" type="button" data-thema="${esc(x.id)}"><div class="ln-thema-kopf"><b>${esc(x.titel)}</b><span class="klein">${x.anzahl} Karten${x.faellig ? ` · ${x.faellig} fällig` : ""}</span></div>${ringeHtml(x.ringe, true)}</button>`;
  $("#ln-fortschritt-liste").addEventListener("click", (e) => {
    const b = e.target.closest("[data-thema]");
    if (!b) return;
    zeigeTab("abfragen");
    $("#ln-q-stapel").value = b.dataset.thema;
  });
  $("#ln-immer").addEventListener("change", (e) => {
    lsSet("lernecke_start", e.target.checked ? "1" : "0");
    // Wer die Lernecke immer direkt startet, ist Carla (auf ihrem Gerät).
    if (e.target.checked && !geraetWer()) { lsSet("lernecke_wer", "carla"); $("#ln-geraet").value = "carla"; }
  });
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
    try { await bildLesen(await verkleinern(datei)); } catch (err) { status(err.message, true); }
  }
  const spiegelCanvas = (c) => { const g = document.createElement("canvas"); g.width = c.width; g.height = c.height; const x = g.getContext("2d"); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return g; };
  // Grobe Prüfung wie auf dem Server: sieht der Text nach echten Wörtern aus?
  const guete = (t) => { const w = String(t || "").split(/\s+/).filter((x) => /[A-Za-zÄÖÜäöüß]/.test(x)); if (!w.length) return 0; const gut = w.filter((x) => { const b = x.replace(/[^A-Za-zÄÖÜäöüß]/g, ""); return b.length >= 2 && /[aeiouäöüy]/i.test(b) && b.length / x.length > 0.7; }).length; return (gut / w.length) * Math.min(1, String(t).replace(/[^A-Za-zÄÖÜäöüß]/g, "").length / 12); };
  /** Bild (Canvas) lesen. nochmal = dasselbe Bild gespiegelt erneut lesen und das letzte Ergebnis ersetzen. */
  async function bildLesen(c, { nochmal = false } = {}) {
    const bar = $("#ln-ocr");
    bar.classList.add("laeuft");
    try {
      scan.canvas = c;
      const daten = c.toDataURL("image/jpeg", 0.86);
      $("#ln-vor").src = daten; $("#ln-vor").style.display = "block";
      status("Lese die Schrift …");
      bar.style.width = "15%";
      const r = await json("/api/lernen/scan", { body: { image: { mediaType: "image/jpeg", data: daten.split(",")[1] }, vorschau: miniBild(c) } });
      scan.bild = r.bild;
      $("#ln-ki-lesen").disabled = false;
      $("#ln-spiegeln").disabled = false;
      let text = r.text;
      if (text == null) {
        status("Lese im Browser (beim ersten Mal lädt die Texterkennung kurz) …");
        text = await browserOcr(c, bar);
        if (guete(text) < 0.6) { const t2 = await browserOcr(spiegelCanvas(c), bar).catch(() => ""); if (guete(t2) > guete(text) + 0.1) { text = t2; r.gespiegelt = true; } }
        r.karten = null;
        // Im Browser erkannten Text auch im Archiv nachtragen (damit die Suche ihn findet).
        if (r.unterlage?.id && String(text || "").trim()) json(`/api/lernen/archiv/${r.unterlage.id}`, { method: "PATCH", body: { text: String(text).trim() } }).catch(() => {});
      }
      bar.style.width = "100%";
      text = String(text || "").trim();
      if (!text) { status("Ich konnte keinen Text erkennen. Versuch's mit mehr Licht, oder nimm „KI liest die Schrift“.", true); return; }
      const spiegelHinweis = r.gespiegelt ? " Die Schrift war spiegelverkehrt, ich habe sie umgedreht." : "";
      if (scan.modus === "karte") {
        const fl = text.replace(/\n{2,}/g, "\n").trim();
        const seite = nochmal ? scan.letzteSeite : !$("#ln-vorne").value.trim() ? "vorne" : "hinten";
        scan.letzteSeite = seite;
        if (seite === "vorne") { $("#ln-vorne").value = fl.replace(/\n/g, " "); status(`Vorderseite gelesen.${spiegelHinweis} Jetzt umdrehen und die Rückseite fotografieren.`); if (!nochmal) sag("Vorderseite gelesen. Jetzt die Rückseite."); }
        else { $("#ln-hinten").value = fl; status(`Rückseite gelesen.${spiegelHinweis} Prüf kurz und tipp auf „Karte übernehmen“.`); }
        seiteHinweis();
      } else {
        $("#ln-text").value = text;
        status(`${r.quelle === "mac" ? "Text erkannt (Mac-Schrifterkennung)." : "Text erkannt."}${spiegelHinweis}`);
        await erkennen(r.karten ? r : null);
      }
    } finally { bar.classList.remove("laeuft"); setTimeout(() => { bar.style.width = "0%"; }, 1500); }
  }
  $("#ln-spiegeln").addEventListener("click", async () => {
    if (!scan.canvas) return;
    try { await bildLesen(spiegelCanvas(scan.canvas), { nochmal: true }); } catch (err) { status(err.message, true); }
  });

  // ---------- Live-Kamera (für den Mac mit Frontkamera, geht auch am iPhone) ----------
  let camStream = null, camRichtung = "user";
  async function kameraAn() {
    if (!navigator.mediaDevices?.getUserMedia) { status("Dieser Browser kann die Kamera nicht direkt nutzen. Nimm „Foto aufnehmen“.", true); return; }
    kameraAus();
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camRichtung, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      const v = $("#ln-cam");
      v.srcObject = camStream;
      await v.play().catch(() => {});
      // Vorschau wie ein Spiegel (natürlicher beim Hinhalten); das Foto selbst ist ungespiegelt.
      const vorn = (camStream.getVideoTracks()[0]?.getSettings?.().facingMode || camRichtung) !== "environment";
      v.classList.toggle("ln-spiegel", vorn);
      $("#ln-cam-box").style.display = "";
      $("#ln-cam-hinweis").textContent = vorn ? "Halt die Karte vor die Kamera. In der Vorschau ist die Schrift spiegelverkehrt, das ist normal. Friday liest sie richtig herum." : "Karte ins Bild, dann „Aufnehmen“.";
    } catch (err) { status(err.name === "NotAllowedError" ? "Kamera nicht erlaubt. Bitte im Browser die Kamera freigeben." : `Kamera geht nicht: ${err.message}`, true); }
  }
  function kameraAus() {
    if (camStream) camStream.getTracks().forEach((t) => t.stop());
    camStream = null;
    const box = $("#ln-cam-box"); if (box) box.style.display = "none";
  }
  $("#ln-cam-an").addEventListener("click", kameraAn);
  $("#ln-cam-zu").addEventListener("click", kameraAus);
  $("#ln-cam-wechsel").addEventListener("click", () => { camRichtung = camRichtung === "user" ? "environment" : "user"; kameraAn(); });
  $("#ln-cam-foto").addEventListener("click", async () => {
    const v = $("#ln-cam");
    if (!v.videoWidth) return;
    const f = Math.min(1, 2200 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * f); c.height = Math.round(v.videoHeight * f);
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    try { await bildLesen(c); } catch (err) { status(err.message, true); }
  });
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
      // Getippter oder eingefügter Text ohne Foto kommt als Notiz ins Archiv.
      const eigenText = $("#ln-text").value.trim();
      if (!scan.bild && eigenText) json("/api/lernen/archiv", { body: { titel: r.stapel.titel, text: eigenText } }).catch(() => {});
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
        ${ringeHtml(s.ringe, true)}
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
    $("#ln-q-score").innerHTML = `<span class="ln-s gut">✓ ${quiz.richtig}</span><span class="ln-s fast">~ ${quiz.teilweise}</span><span class="ln-s falsch">✗ ${quiz.falsch}</span>`;
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
    if (!test) { try { await json("/api/lernen/bewerten", { body: { stapel: k.sid, karte: k.id, ergebnis: erg } }); } catch (err) { status(err.message, true); } }
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
    if (q.offen) { q[q.ergebnis]++; if (!test) json("/api/lernen/bewerten", { body: { stapel: q.offen.sid, karte: q.offen.id, ergebnis: q.ergebnis } }).catch(() => {}); q.offen = null; }
    mikroBelegen(false);
    const sum = q.richtig + q.teilweise + q.falsch;
    $("#ln-q").style.display = "none"; $("#ln-q-setup").style.display = "";
    if (sum && !test) json("/api/lernen/sitzung", { body: { stapel: q.sid === "alle" ? "" : q.sid, richtig: q.richtig, teilweise: q.teilweise, falsch: q.falsch, dauer: (Date.now() - q.start) / 1000 } }).catch(() => {});
    const text = test && sum ? `Test fertig: ${q.richtig} von ${sum} richtig. Im Testmodus wird nichts gespeichert.` : !sum ? "Okay, wir hören auf." : q.falsch + q.teilweise === 0 ? `Super, ${NAME}! Alle ${sum} richtig.` : `Fertig! ${q.richtig} von ${sum} richtig${q.teilweise ? `, ${q.teilweise} fast` : ""}. Die anderen frage ich dich morgen nochmal ab.`;
    const e = $("#ln-q-ende");
    e.style.display = "";
    e.innerHTML = `<h3>Ergebnis</h3><p style="font-size:17px;margin:4px 0 10px">${esc(text)}</p>
      <div class="hf-reihe"><button class="hf-btn haupt" data-n="nochmal" type="button">🔁 Nochmal abfragen</button><button class="hf-btn" data-n="falsch" type="button">✗ Nur die falschen</button><button class="hf-btn leise" data-n="hilfe" type="button">💡 Zur Lernhilfe</button></div>`;
    const gesagt = stumm ? Promise.resolve() : sag(text);
    // Kurz warten, bis die letzte Bewertung gespeichert ist, dann die Ringe des Themas zeigen.
    setTimeout(() => laden().then(async () => {
      if (test || !sum) return;
      const st = info.stapel.find((x) => x.id === q.sid);
      const r = st ? st.ringe : info.ringe;
      if (r && e.isConnected) e.querySelector(".hf-reihe")?.insertAdjacentHTML("beforebegin", `<div class="hf-hinweis">${st ? `Dein Stand bei „${esc(st.titel)}“:` : "Dein Stand insgesamt:"}</div>${ringeHtml(r)}`);
      // Ist ein Ring gerade voll geworden? Dann lobt Friday (einmal pro Ring und Thema, nie im Testmodus).
      const l = await json("/api/lernen/lob", { body: { stapel: q.sid } }).catch(() => null);
      if (!l?.lob?.length) return;
      await gesagt;
      for (const x of l.lob) e.querySelectorAll(".ln-ring").forEach((el) => { if (el.querySelector("span")?.textContent === x.name) el.classList.add("voll"); });
      feiern(l);
    }).catch(() => {}), 600);
  }

  // ---------- Lob mit kleiner Feier ----------
  let feierTimer = null;
  function feiern(l) {
    w.sheet.querySelector(".ln-feier")?.remove();
    const top = l.lob[0];
    const farben = ["#3ddc84", "#ff8a1e", "#ffd59a", "#7cf2b4", "#ffb066"];
    const konfetti = Array.from({ length: 36 }, (_, i) => `<i style="--x:${(Math.random() * 2 - 1).toFixed(2)};--y:${(Math.random() * -1 - 0.2).toFixed(2)};--r:${Math.round(Math.random() * 720 - 360)}deg;--d:${(Math.random() * 0.4).toFixed(2)}s;background:${farben[i % farben.length]}"></i>`).join("");
    const box = document.createElement("div");
    box.className = "ln-feier";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Lob");
    box.innerHTML = `<div class="ln-feier-karte">
        <div class="ln-konfetti" aria-hidden="true">${konfetti}</div>
        ${ring(100, top.name)}
        <div class="ln-feier-titel">Hast du gut gemacht, ${NAME}!</div>
        <div class="ln-feier-text">${esc(l.text)}</div>
        ${l.lob.length > 1 ? `<div class="hf-hinweis">Auch voll: ${l.lob.slice(1).map((x) => `${esc(x.name)} bei „${esc(x.titel)}“`).join(", ")}</div>` : ""}
        <button class="hf-btn haupt" type="button">💚 Danke, Friday</button>
      </div>`;
    const zu = () => { clearTimeout(feierTimer); box.classList.add("weg"); setTimeout(() => box.remove(), 400); };
    box.addEventListener("click", (ev) => { if (ev.target === box || ev.target.closest("button")) zu(); });
    w.sheet.appendChild(box);
    clearTimeout(feierTimer);
    feierTimer = setTimeout(zu, 15000);
    sag(l.text);
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
    if (!w.offen()) { if (quiz?.laeuft) quizEnde(true); hoerAuf(); mikroBelegen(false); kameraAus(); }
  }).observe(w.sheet, { attributes: true, attributeFilter: ["class"] });

  // ---------- Archiv: alle Lernunterlagen dauerhaft ----------
  /** Kleines Vorschaubild (für die Archiv-Kacheln), max. 240 px. */
  function miniBild(quelle) {
    try {
      const b = quelle.videoWidth || quelle.naturalWidth || quelle.width, h = quelle.videoHeight || quelle.naturalHeight || quelle.height;
      if (!b || !h) return null;
      const f = Math.min(1, 240 / Math.max(b, h));
      const c = document.createElement("canvas"); c.width = Math.round(b * f); c.height = Math.round(h * f);
      c.getContext("2d").drawImage(quelle, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.7);
    } catch { return null; }
  }
  const groesse = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const datum = (iso) => { try { return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; } };
  let arch = { q: "", fach: "", korb: false, daten: null, offen: null, url: null };
  let suchTimer = null;
  async function archivLaden() {
    try {
      const p = new URLSearchParams({ q: arch.q, fach: arch.fach, ...(arch.korb ? { papierkorb: "1" } : {}) });
      arch.daten = await json(`/api/lernen/archiv?${p}`);
    } catch (err) { status(err.message, true); return; }
    zeichneArchiv();
  }
  function zeichneArchiv() {
    const d = arch.daten;
    if (!d) return;
    const fs = d.faecher || [];
    const sel = $("#ln-a-fach");
    sel.innerHTML = `<option value="">Alle Fächer (${d.anzahl})</option>${fs.map((f) => `<option value="${esc(f.name || "-")}">${esc(f.name || "Ohne Fach")} (${f.n})</option>`).join("")}`;
    sel.value = arch.fach;
    $("#ln-a-faecher").innerHTML = fs.filter((f) => f.name).map((f) => `<option value="${esc(f.name)}">`).join("");
    $("#ln-a-korb").textContent = arch.korb ? "← Zurück zum Archiv" : `🗑 Papierkorb${d.papierkorb ? ` (${d.papierkorb})` : ""}`;
    $("#ln-a-ordner").innerHTML = arch.korb ? `<div class="hf-hinweis">🗑 Papierkorb: Hier kannst du Unterlagen zurückholen oder endgültig löschen.</div>`
      : fs.length > 1 ? fs.map((f) => `<button class="ln-ordner-k${arch.fach === (f.name || "-") ? " an" : ""}" data-ordner="${esc(f.name || "-")}" type="button">📁 ${esc(f.name || "Ohne Fach")} <small>${f.n}</small></button>`).join("") : "";
    const liste = d.unterlagen || [];
    $("#ln-a-liste").innerHTML = liste.length ? liste.map((u) => `
      <button class="ln-a-k${arch.offen === u.id ? " an" : ""}" data-u="${esc(u.id)}" type="button">
        <div class="ln-a-bild">${u.vorschau ? `<img src="${esc(u.vorschau)}" alt="">` : `<span>${u.icon}</span>`}${u.favorit ? `<i class="ln-a-stern">★</i>` : ""}</div>
        <b>${esc(u.titel)}</b>
        <small>${u.icon} ${esc(u.fach || (u.typ === "scan" ? "Scan" : u.typ === "notiz" ? "Notiz" : "Datei"))} · ${esc(datum(u.erstellt))}${u.datei ? ` · ${groesse(u.datei.groesse)}` : ""}</small>
        ${arch.q && u.auszug ? `<small class="ln-a-auszug">${esc(u.auszug)}</small>` : ""}
      </button>`).join("")
      : `<div class="hf-leer">${arch.korb ? "Der Papierkorb ist leer." : arch.q ? "Nichts gefunden." : "Noch nichts im Archiv. Alles, was du scannst, landet automatisch hier. Du kannst auch Dateien und Notizen ablegen."}</div>`;
    const st = info.stapel || [];
    $("#ln-a-stapel").innerHTML = st.length ? st.map((x) => `<div class="hf-zeile"><span class="icon">🗂</span><span class="name">${esc(x.titel)}<br><span class="klein">${x.anzahl} Karten</span></span><button class="hf-mini" data-export="${esc(x.id)}" type="button">⬇ Als Text</button></div>`).join("") : `<div class="hf-leer">Noch keine Karteikarten.</div>`;
  }
  $("#ln-a-suche").addEventListener("input", (e) => { clearTimeout(suchTimer); suchTimer = setTimeout(() => { arch.q = e.target.value.trim(); archivLaden(); }, 250); });
  $("#ln-a-fach").addEventListener("change", (e) => { arch.fach = e.target.value; archivLaden(); });
  $("#ln-a-ordner").addEventListener("click", (e) => { const b = e.target.closest("[data-ordner]"); if (!b) return; arch.fach = arch.fach === b.dataset.ordner ? "" : b.dataset.ordner; archivLaden(); });
  $("#ln-a-korb").addEventListener("click", () => { arch.korb = !arch.korb; arch.offen = null; $("#ln-a-detail").style.display = "none"; archivLaden(); });
  $("#ln-a-liste").addEventListener("click", (e) => { const b = e.target.closest("[data-u]"); if (b) archivOeffnen(b.dataset.u); });

  async function blobVon(id) {
    const r = await F().api(`/api/lernen/archiv/${encodeURIComponent(id)}/datei`);
    if (!r.ok) throw new Error("Die Datei ist nicht mehr da.");
    return r.blob();
  }
  function urlFrei() { if (arch.url) { URL.revokeObjectURL(arch.url); arch.url = null; } }
  async function archivOeffnen(id) {
    let u;
    try { u = await json(`/api/lernen/archiv/${encodeURIComponent(id)}`); } catch (err) { status(err.message, true); return; }
    arch.offen = id;
    urlFrei();
    const d = $("#ln-a-detail");
    d.style.display = "";
    const stapel = (u.stapel || []).map((sid) => info.stapel.find((x) => x.id === sid)).filter(Boolean);
    d.innerHTML = `
      <div class="hf-reihe">
        <input id="ln-a-titel" class="hf-input grow" value="${esc(u.titel)}" aria-label="Titel">
        <input id="ln-a-dfach" class="hf-input" list="ln-a-faecher" value="${esc(u.fach)}" placeholder="Fach" aria-label="Fach" style="width:180px">
        <button class="hf-mini" data-a="zu" type="button" title="Schließen">✕</button>
      </div>
      <div class="hf-hinweis" style="margin:6px 0">${u.icon} ${u.typ === "scan" ? "Gescanntes Foto" : u.typ === "notiz" ? "Notiz" : esc(u.datei?.name || "Datei")} · ${esc(datum(u.erstellt))}${u.datei ? ` · ${groesse(u.datei.groesse)}` : ""}${stapel.length ? ` · Karten in ${stapel.map((x) => `„${esc(x.titel)}“`).join(", ")}` : ""}</div>
      <div id="ln-a-ansicht" class="ln-a-ansicht">${u.zeigen && u.typ !== "notiz" && u.zeigen !== "text" ? `<div class="hf-hinweis">Lade …</div>` : ""}</div>
      ${u.typ === "notiz" || u.hatText || u.zeigen === "text" || u.typ === "scan" ? `<label class="hf-feld" style="margin-top:8px">${u.typ === "notiz" ? "Text" : "Erkannter Text (zum Suchen, du kannst ihn verbessern)"}<textarea id="ln-a-text" rows="${u.typ === "notiz" ? 10 : 6}">${esc(u.text)}</textarea></label>` : ""}
      <div class="hf-reihe" style="margin-top:10px">
        ${u.geloescht ? `<button class="hf-btn haupt" data-a="zurueck" type="button">↩ Zurückholen</button><button class="hf-btn leise" data-a="weg" type="button">🗑 Endgültig löschen</button>` : `
        ${u.typ !== "notiz" ? `<button class="hf-btn" data-a="laden" type="button">⬇ Herunterladen</button>` : ""}
        ${u.zeigen === "pdf" ? `<button class="hf-btn" data-a="neu" type="button">↗ Groß öffnen</button>` : ""}
        ${u.typ === "notiz" || u.hatText ? `<button class="hf-btn" data-a="karten" type="button">🃏 Karten daraus machen</button><button class="hf-btn leise" data-a="vorlesen" type="button">🔊 Vorlesen</button>` : ""}
        ${stapel[0] ? `<button class="hf-btn leise" data-a="stapel" data-sid="${esc(stapel[0].id)}" type="button">🗂 Zu den Karten</button>` : ""}
        <button class="hf-btn leise" data-a="stern" type="button">${u.favorit ? "★ Favorit" : "☆ Favorit"}</button>
        <button class="hf-btn leise" data-a="korb" type="button">🗑 Papierkorb</button>`}
      </div>`;
    zeichneArchiv();
    d.scrollIntoView({ behavior: "smooth", block: "start" });
    arch.u = u;
    if (!u.zeigen || u.zeigen === "text" || u.typ === "notiz") return;
    try {
      const blob = await blobVon(id);
      if (arch.offen !== id) return;
      // Nur harmlose Arten anzeigen (Bild, PDF, Ton); alles andere nur herunterladen.
      const typ = { bild: blob.type.startsWith("image/") ? blob.type : "image/jpeg", pdf: "application/pdf", audio: blob.type.startsWith("audio/") ? blob.type : "audio/mpeg" }[u.zeigen];
      arch.url = URL.createObjectURL(new Blob([blob], { type: typ }));
      const a = $("#ln-a-ansicht");
      if (u.zeigen === "bild") {
        a.innerHTML = `<img id="ln-a-img" src="${arch.url}" alt="${esc(u.titel)}">`;
        if (!u.vorschau) $("#ln-a-img").addEventListener("load", (e) => { const v = miniBild(e.target); if (v) json(`/api/lernen/archiv/${id}`, { method: "PATCH", body: { vorschau: v } }).then(() => archivLaden()).catch(() => {}); }, { once: true });
      } else if (u.zeigen === "pdf") a.innerHTML = `<iframe src="${arch.url}" title="${esc(u.titel)}"></iframe>`;
      else if (u.zeigen === "audio") a.innerHTML = `<audio controls src="${arch.url}"></audio>`;
    } catch (err) { $("#ln-a-ansicht").innerHTML = `<div class="hf-leer">${esc(err.message)}</div>`; }
  }
  $("#ln-a-detail").addEventListener("change", async (e) => {
    const id = arch.offen;
    if (!id) return;
    const feld = { "ln-a-titel": "titel", "ln-a-dfach": "fach", "ln-a-text": "text" }[e.target.id];
    if (!feld) return;
    try { await json(`/api/lernen/archiv/${id}`, { method: "PATCH", body: { [feld]: e.target.value } }); status("✓ Gespeichert"); archivLaden(); } catch (err) { status(err.message, true); }
  });
  $("#ln-a-detail").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-a]");
    const u = arch.u;
    if (!b || !u) return;
    const was = b.dataset.a;
    try {
      if (was === "zu") { arch.offen = null; urlFrei(); $("#ln-a-detail").style.display = "none"; zeichneArchiv(); return; }
      if (was === "laden") {
        const blob = await blobVon(u.id);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([blob], { type: "application/octet-stream" }));
        a.download = u.datei?.name || `${u.titel}.jpg`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        return;
      }
      if (was === "neu") { if (arch.url) window.open(arch.url, "_blank", "noopener"); return; }
      if (was === "vorlesen") { const t = $("#ln-a-text")?.value || u.text; if (t) sag(t.slice(0, 3000)); return; }
      if (was === "karten") {
        zeigeTab("scannen");
        $("#ln-text").value = $("#ln-a-text")?.value || u.text || "";
        scan.bild = u.typ === "scan" ? u.bild : null;
        $("#ln-ziel").value = ""; $("#ln-neu-titel").style.display = ""; $("#ln-neu-titel").value = u.titel;
        await erkennen();
        return;
      }
      if (was === "stapel") { zeigeTab("karten"); zeigeDetail(b.dataset.sid); return; }
      if (was === "stern") { await json(`/api/lernen/archiv/${u.id}`, { method: "PATCH", body: { favorit: !u.favorit } }); await archivLaden(); archivOeffnen(u.id); return; }
      if (was === "zurueck") { await json(`/api/lernen/archiv/${u.id}`, { method: "PATCH", body: { zurueck: true } }); status("↩ Zurückgeholt."); }
      if (was === "korb") { await json(`/api/lernen/archiv/${u.id}`, { method: "DELETE" }); status("In den Papierkorb gelegt. Du kannst es dort zurückholen."); }
      if (was === "weg") {
        if (!b.dataset.sicher) { b.dataset.sicher = "1"; b.textContent = "Wirklich für immer löschen? Nochmal tippen"; setTimeout(() => { if (b.isConnected) { delete b.dataset.sicher; b.textContent = "🗑 Endgültig löschen"; } }, 4000); return; }
        await json(`/api/lernen/archiv/${u.id}`, { method: "DELETE" }); status("Endgültig gelöscht.");
      }
      arch.offen = null; urlFrei(); $("#ln-a-detail").style.display = "none";
      await archivLaden(); laden().catch(() => {});
    } catch (err) { status(err.message, true); }
  });
  $("#ln-a-notiz").addEventListener("click", async () => {
    try {
      const u = await json("/api/lernen/archiv", { body: { titel: "Neue Notiz", text: " ", fach: $("#ln-a-neu-fach").value } });
      arch.korb = false; await archivLaden(); await archivOeffnen(u.id);
      const t = $("#ln-a-titel"); t?.focus(); t?.select();
    } catch (err) { status(err.message, true); }
  });
  const alsBase64 = (datei) => new Promise((ok, nein) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => nein(new Error("Datei ließ sich nicht lesen.")); r.readAsDataURL(datei); });
  $("#ln-a-datei").addEventListener("change", async (e) => {
    const dateien = [...(e.target.files || [])];
    e.target.value = "";
    const bar = $("#ln-a-balken");
    let n = 0;
    for (const datei of dateien) {
      try {
        if (datei.size > 8.5 * 1024 * 1024) { status(`„${datei.name}“ ist zu groß (höchstens 8 MB).`, true); continue; }
        status(`Lege „${datei.name}“ ab …`);
        bar.style.width = `${Math.round(((n + 0.5) / dateien.length) * 100)}%`;
        let vorschau = null;
        if (/^image\/(jpeg|png|webp|gif)$/.test(datei.type)) { try { const bm = await createImageBitmap(datei); vorschau = miniBild(bm); } catch { /* egal */ } }
        await json("/api/lernen/archiv", { body: { fach: $("#ln-a-neu-fach").value, vorschau, datei: { name: datei.name, data: await alsBase64(datei) } } });
        n++;
      } catch (err) { status(err.message, true); }
    }
    bar.style.width = "100%"; setTimeout(() => { bar.style.width = "0%"; }, 1200);
    if (n) { status(`✓ ${n} Datei${n === 1 ? "" : "en"} im Archiv abgelegt.`); arch.korb = false; await archivLaden(); laden().catch(() => {}); }
  });
  $("#ln-a-foto").addEventListener("change", async (e) => {
    const datei = e.target.files?.[0];
    e.target.value = "";
    if (!datei) return;
    const bar = $("#ln-a-balken");
    try {
      bar.classList.add("laeuft"); bar.style.width = "40%";
      status("Lege das Foto ab und lese die Schrift …");
      const c = await verkleinern(datei);
      const r = await json("/api/lernen/scan", { body: { image: { mediaType: "image/jpeg", data: c.toDataURL("image/jpeg", 0.86).split(",")[1] }, vorschau: miniBild(c), fach: $("#ln-a-neu-fach").value } });
      if (r.text == null && r.unterlage?.id) {
        status("Lese die Schrift im Browser …");
        const t = String(await browserOcr(c, bar).catch(() => "")).trim();
        if (t) await json(`/api/lernen/archiv/${r.unterlage.id}`, { method: "PATCH", body: { text: t } });
      }
      bar.style.width = "100%";
      status("✓ Foto im Archiv abgelegt.");
      arch.korb = false; await archivLaden(); laden().catch(() => {});
      if (r.unterlage?.id) archivOeffnen(r.unterlage.id);
    } catch (err) { status(err.message, true); }
    finally { bar.classList.remove("laeuft"); setTimeout(() => { bar.style.width = "0%"; }, 1200); }
  });
  $("#ln-a-stapel").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-export]");
    if (!b) return;
    try {
      const st = await json(`/api/lernen/stapel/${encodeURIComponent(b.dataset.export)}`);
      const text = `${st.titel}\n${"=".repeat(Math.min(60, st.titel.length))}\n\n${st.karten.map((k, i) => `${i + 1}. ${k.frage}\n${String(k.antwort || "").split("\n").map((z) => `   ${z}`).join("\n")}`).join("\n\n")}\n`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      a.download = `${st.titel.replace(/[\\/:*?"<>|]+/g, "_")}.txt`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) { status(err.message, true); }
  });

  // Direkt-Link /?lernen und „immer mit der Lernecke starten“.
  // (Die Einstellungs-Synchronisierung lädt die Seite beim ersten Start evtl. einmal neu, darum merkt sich
  // die Lernecke den Wunsch kurz in der Sitzung und entfernt ?lernen erst, wenn sie offen ist.)
  const perLink = new URLSearchParams(location.search).has("lernen");
  // /?lernen=archiv öffnet direkt das Archiv (z. B. als Lesezeichen auf Carlas iPhone).
  let linkModus = (new URLSearchParams(location.search).get("lernen") || "").toLowerCase();
  try { if (perLink) sessionStorage.setItem("lernecke_direkt", linkModus || "1"); } catch { /* egal */ }
  let gemerkt = false;
  try { const g = sessionStorage.getItem("lernecke_direkt"); gemerkt = Boolean(g); if (g && g !== "1" && !linkModus) linkModus = g; } catch { /* egal */ }
  if (!["archiv", "abfragen", "scannen", "plan"].includes(linkModus)) linkModus = "";
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
        w.auf(linkModus ? { modus: linkModus } : {});
      }
    }, 500);
  }

  const style = document.createElement("style");
  style.textContent = `
.ln-box { width: min(1080px, 100%); }
.ln-gruss-text { font-size: 19px; line-height: 1.45; color: var(--text); margin-bottom: 14px; }
.ln-gross { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
.ln-kachel { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left; padding: 16px; border-radius: 16px; border: 1px solid var(--u-rand, var(--cyan)); background: linear-gradient(160deg, color-mix(in srgb, var(--cyan) 18%, transparent), rgba(0,0,0,.25)); color: var(--text); font: inherit; cursor: pointer; }
.ln-kachel:hover { box-shadow: 0 0 22px color-mix(in srgb, var(--cyan) 40%, transparent); }
.ln-kachel b { font-size: 30px; } .ln-kachel span { font-size: 17px; font-weight: 700; } .ln-kachel small { font-size: 12.5px; color: var(--muted); }
.ln-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--muted); cursor: pointer; }
.ln-cam-box { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.ln-cam-box video { width: 100%; max-height: 320px; object-fit: contain; background: #000; border-radius: 12px; border: 1px solid var(--u-rand, var(--cyan)); }
.ln-cam-box video.ln-spiegel { transform: scaleX(-1); }
.ln-test { border: 1px dashed #ffc44d; color: #ffc44d; border-radius: 12px; padding: 8px 12px; font-size: 13.5px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ln-wer { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px; }
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
.ln-ringe { display: flex; gap: 14px; justify-content: space-around; margin-top: 10px; flex-wrap: wrap; }
.ln-ring { position: relative; width: 104px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.ln-ring svg { width: 104px; height: 104px; transform: rotate(-90deg); overflow: visible; }
.ln-ring circle { fill: none; stroke-width: 9; }
.ln-ring .bahn { stroke: rgba(61,220,132,.14); }
.ln-ring .wert { stroke: #3ddc84; stroke-linecap: round; filter: drop-shadow(0 0 5px rgba(61,220,132,.75)); animation: ln-ring-auf 1.1s cubic-bezier(.2,.8,.2,1) both; }
@keyframes ln-ring-auf { from { stroke-dashoffset: var(--u); } }
.ln-ring b { position: absolute; top: 0; left: 0; width: 104px; height: 104px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #eafff2; text-shadow: 0 0 12px rgba(61,220,132,.6); font-variant-numeric: tabular-nums; }
.ln-ring b small { font-size: 13px; margin-left: 1px; }
.ln-ring span { font-size: 12.5px; color: var(--muted); letter-spacing: .05em; text-transform: uppercase; }
.ln-stapel .ln-ringe, .ln-thema .ln-ringe { flex-wrap: nowrap; gap: 4px; justify-content: space-between; }
.ln-ring.klein, .ln-ring.klein svg, .ln-ring.klein b { width: 74px; } .ln-ring.klein svg, .ln-ring.klein b { height: 74px; }
.ln-ring.klein b { font-size: 17px; } .ln-ring.klein b small { font-size: 10px; } .ln-ring.klein span { font-size: 10.5px; }
.ln-themen { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
.ln-thema { text-align: left; font: inherit; color: var(--text); padding: 12px 14px; border-radius: 16px; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.25); cursor: pointer; }
.ln-thema:hover { border-color: #3ddc84; box-shadow: 0 0 16px rgba(61,220,132,.25); }
.ln-thema-kopf { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.ln-thema-kopf .klein { font-size: 12px; color: var(--muted); white-space: nowrap; }
.ln-ordner { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
.ln-ordner-k { font: inherit; font-size: 13.5px; color: var(--text); padding: 7px 12px; border-radius: 999px; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.25); cursor: pointer; }
.ln-ordner-k small { color: var(--muted); margin-left: 4px; }
.ln-ordner-k.an { border-color: var(--cyan); background: color-mix(in srgb, var(--cyan) 18%, transparent); }
.ln-a-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; margin-top: 10px; }
.ln-a-k { display: flex; flex-direction: column; gap: 4px; text-align: left; font: inherit; color: var(--text); padding: 8px; border-radius: 14px; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.25); cursor: pointer; min-width: 0; }
.ln-a-k:hover, .ln-a-k.an { border-color: var(--cyan); box-shadow: 0 0 14px color-mix(in srgb, var(--cyan) 30%, transparent); }
.ln-a-k b { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ln-a-k small { font-size: 11.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ln-a-k .ln-a-auszug { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.ln-a-bild { position: relative; height: 110px; border-radius: 10px; overflow: hidden; display: grid; place-items: center; background: color-mix(in srgb, var(--cyan) 8%, rgba(0,0,0,.35)); }
.ln-a-bild img { width: 100%; height: 100%; object-fit: cover; }
.ln-a-bild span { font-size: 42px; }
.ln-a-stern { position: absolute; top: 6px; right: 8px; color: #ffc44d; font-style: normal; text-shadow: 0 0 6px rgba(0,0,0,.8); }
.ln-a-ansicht img { max-width: 100%; max-height: 70vh; border-radius: 10px; display: block; margin: 0 auto; }
.ln-a-ansicht iframe { width: 100%; height: 70vh; border: 0; border-radius: 10px; background: #fff; }
.ln-a-ansicht audio { width: 100%; }
#ln-a-text { width: 100%; resize: vertical; line-height: 1.45; }
@media (max-width: 900px) {
  .ln-gross { grid-template-columns: 1fr; }
  .ln-a-raster { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ln-a-bild { height: 96px; }
  .ln-themen { grid-template-columns: 1fr; }
  .ln-ringe { gap: 6px; }
  #ln-a-dfach { width: 100% !important; }
  .ln-kachel { flex-direction: row; flex-wrap: wrap; align-items: center; padding: 12px 14px; }
  .ln-kachel b { font-size: 24px; } .ln-kachel small { flex-basis: 100%; }
  .ln-frage { font-size: 21px; }
  .ln-gruss-text { font-size: 17px; }
  .ln-q-knoepfe .hf-btn { flex: 1 1 calc(50% - 8px); padding: 10px 8px; }
  .ln-q-knoepfe .hf-btn[data-q="hoeren"] { flex-basis: 100%; }
  .ln-vz .name { flex: 1 1 calc(100% - 36px) !important; }
  #ln-q-form { flex-wrap: nowrap; }
  #ln-q-form .grow { min-width: 0; }
}
/* ---------- Optik v1.110.0: klare Schrift, ruhiger Aufbau ---------- */
.ln-box {
  --ln-schrift: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "Helvetica Neue", "Saira", system-ui, sans-serif;
  --ln-gross: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", "Helvetica Neue", "Saira", system-ui, sans-serif;
  --ln-hud: var(--font-head, "Orbitron"), sans-serif;
  --ln-gruen: #3ddc84;
  width: min(1120px, 100%);
}
.ln-box .hf-inhalt { font-family: var(--ln-schrift); font-size: 15px; line-height: 1.5; letter-spacing: 0; gap: 16px; -webkit-font-smoothing: antialiased; }
.ln-box .hf-inhalt :is(button, input, select, textarea, label, summary) { font-family: var(--ln-schrift); letter-spacing: 0; }
.ln-box .hf-inhalt section { display: flex; flex-direction: column; gap: 16px; flex: none; }
.ln-box .hf-inhalt > * { flex-shrink: 0; }
.ln-box .hf-inhalt section.hidden { display: none; }
.ln-box #ln-status:empty { display: none; }
.ln-box #ln-status { font-size: 14px; padding: 8px 12px; border-radius: 10px; background: color-mix(in srgb, var(--cyan) 8%, transparent); border: 1px solid var(--u-rand-soft, var(--line)); color: var(--text); }
.ln-box #ln-status.fehler { color: #ffb3a8; border-color: rgba(255,90,74,.5); background: rgba(255,90,74,.08); }

/* Reiter: eine Zeile, wie eine Leiste */
.ln-box .hf-inhalt > .hf-tabs { flex: none; position: sticky; top: 0; z-index: 5; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; gap: 4px; padding: 5px; margin: 0 -2px; border-radius: 16px;
  background: linear-gradient(180deg, rgba(20,11,4,.96), rgba(12,7,2,.96)); border: 1px solid var(--u-rand-soft, var(--line)); box-shadow: 0 8px 22px rgba(0,0,0,.45); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.ln-box .hf-inhalt > .hf-tabs::-webkit-scrollbar { display: none; }
.ln-box .hf-inhalt > .hf-tabs .hf-tab { flex: 1 0 auto; border: 1px solid transparent !important; background: transparent; box-shadow: none; border-radius: 11px; padding: 9px 14px; font-size: 14px; font-weight: 600; color: var(--muted); white-space: nowrap; transition: background .2s, color .2s; }
.ln-box .hf-inhalt > .hf-tabs .hf-tab:hover { color: var(--text); background: color-mix(in srgb, var(--cyan) 8%, transparent); }
.ln-box .hf-inhalt > .hf-tabs .hf-tab.an { color: #1a0c00; background: linear-gradient(135deg, var(--cyan), color-mix(in srgb, var(--cyan) 55%, #ffd59a)); box-shadow: 0 0 16px color-mix(in srgb, var(--cyan) 45%, transparent); }
.ln-box .ln-modus { align-self: flex-start; }

/* Karten & Überschriften */
.ln-box .hf-karte { border-radius: 18px; padding: 18px 20px; background: linear-gradient(160deg, color-mix(in srgb, var(--cyan) 9%, rgba(18,10,4,.7)), rgba(10,6,2,.55)); box-shadow: inset 0 1px 0 rgba(255,220,180,.07); }
.ln-box .hf-karte h3 { font-family: var(--ln-hud); font-size: 11.5px; font-weight: 700; letter-spacing: .2em; margin: 0 0 12px !important; display: flex; align-items: center; gap: 8px; }
.ln-box .hf-karte h3::before { content: ""; width: 6px; height: 6px; border-radius: 2px; transform: rotate(45deg); background: var(--cyan); box-shadow: 0 0 8px var(--cyan); }
.ln-box .hf-hinweis { font-size: 13px; line-height: 1.5; }
.ln-box .hf-btn { border-radius: 12px; padding: 10px 16px; font-size: 14.5px; font-weight: 600; }
.ln-box .hf-btn.haupt { font-weight: 700; }
.ln-box .hf-input, .ln-box .hf-feld :is(input, textarea, select) { border-radius: 12px; padding: 10px 12px; font-size: 15px; }
.ln-box .hf-feld { font-size: 13px; font-weight: 600; }
.ln-box .hf-zeile { border-radius: 14px; padding: 10px 12px; font-size: 15px; }
.ln-box .hf-leer { font-size: 15px; padding: 26px; }

/* Startseite: Begrüßung */
.ln-box .ln-gruss { padding: 22px 24px; background: radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--cyan) 20%, transparent), transparent 55%), linear-gradient(160deg, rgba(22,12,4,.85), rgba(8,5,2,.7)); }
.ln-hero { display: flex; gap: 18px; align-items: center; margin-bottom: 18px; }
.ln-hero-text { min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.ln-orb { position: relative; flex: none; width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 35% 30%, #ffd9a8, var(--cyan) 45%, #6a2c00 100%); box-shadow: 0 0 26px color-mix(in srgb, var(--cyan) 60%, transparent), inset 0 0 14px rgba(0,0,0,.35); }
.ln-orb i { position: absolute; inset: -7px; border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--cyan) 60%, transparent); border-top-color: transparent; border-left-color: transparent; animation: ln-dreh 6s linear infinite; }
.ln-orb b { font-family: var(--ln-hud); font-size: 24px; color: #2a1200; }
@keyframes ln-dreh { to { transform: rotate(360deg); } }
.ln-box .ln-gruss-text { font-family: var(--ln-gross); font-size: 24px; font-weight: 600; line-height: 1.3; letter-spacing: -.01em; margin: 0; color: #fff3e6; text-shadow: 0 0 22px color-mix(in srgb, var(--cyan) 30%, transparent); }
.ln-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ln-chip { font-size: 12.5px; color: var(--muted); padding: 4px 10px; border-radius: 999px; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.25); }
.ln-chip b { color: var(--text); font-weight: 700; }
.ln-chip.heiss { border-color: var(--cyan); color: var(--text); }
.ln-chip.heiss b { color: var(--cyan); }

/* Kacheln */
.ln-box .ln-gross { grid-template-columns: repeat(4, 1fr); gap: 12px; }
.ln-box .ln-kachel { position: relative; overflow: hidden; gap: 6px; padding: 18px 16px 16px; border-radius: 18px; border: 1px solid var(--u-rand-soft, var(--line)); background: linear-gradient(165deg, color-mix(in srgb, var(--cyan) 14%, rgba(20,11,4,.8)), rgba(8,5,2,.7)); transition: transform .18s, border-color .18s, box-shadow .18s; }
.ln-box .ln-kachel:hover { transform: translateY(-2px); border-color: var(--cyan); box-shadow: 0 10px 26px rgba(0,0,0,.4), 0 0 22px color-mix(in srgb, var(--cyan) 30%, transparent); }
.ln-box .ln-kachel b { font-size: 22px; width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; margin-bottom: 6px; background: color-mix(in srgb, var(--cyan) 16%, rgba(0,0,0,.3)); border: 1px solid color-mix(in srgb, var(--cyan) 40%, transparent); box-shadow: 0 0 14px color-mix(in srgb, var(--cyan) 25%, transparent); }
.ln-box .ln-kachel span { font-family: var(--ln-gross); font-size: 16.5px; font-weight: 700; letter-spacing: -.005em; }
.ln-box .ln-kachel small { font-size: 13px; line-height: 1.35; }
.ln-stimme-reihe { margin-top: 14px; }
.ln-box #ln-mikro-start { border-radius: 999px; }

/* Fortschritt */
.ln-box .ln-themen { gap: 12px; }
.ln-box .ln-thema { border-radius: 16px; padding: 14px 16px 12px; background: rgba(0,0,0,.28); transition: border-color .18s, box-shadow .18s; }
.ln-box .ln-thema-kopf b { font-family: var(--ln-gross); font-size: 15.5px; font-weight: 700; }
.ln-box .ln-ring b { font-family: var(--ln-gross); font-weight: 700; }
.ln-box .ln-ring span { font-family: var(--ln-schrift); font-size: 11px; font-weight: 600; letter-spacing: .08em; }
.ln-legende { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 12px 0 0; }
.ln-legende span { display: inline-flex; gap: 6px; align-items: center; }
.ln-legende span::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--ln-gruen); box-shadow: 0 0 6px var(--ln-gruen); }
.ln-legende b { color: var(--text); }
.ln-geraet summary { cursor: pointer; font-size: 13.5px; font-weight: 600; color: var(--muted); list-style: none; }
.ln-geraet summary::-webkit-details-marker { display: none; }
.ln-geraet[open] summary { color: var(--text); }
.ln-box .ln-geraet { padding: 12px 18px; background: transparent; }

/* Stapel-Kacheln */
.ln-box .ln-stapel h3 { font-family: var(--ln-gross); font-size: 16px; letter-spacing: 0; text-transform: none; color: var(--text); }
.ln-box .ln-stapel h3::before { display: none; }
.ln-box .ln-stapel { transition: border-color .18s, box-shadow .18s; }
.ln-box .ln-stapel:hover { border-color: var(--cyan); box-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 25%, transparent); }

/* Abfrage */
.ln-box .ln-quiz { gap: 14px; }
.ln-box .ln-q-kopf { font-size: 13.5px; align-items: center; }
.ln-box #ln-q-score { display: flex; gap: 6px; flex: none; }
.ln-s { white-space: nowrap; font-weight: 700; font-size: 12.5px; padding: 3px 9px; border-radius: 999px; border: 1px solid currentColor; }
.ln-s.gut { color: var(--ln-gruen); } .ln-s.fast { color: #ffc44d; } .ln-s.falsch { color: #ff6b5a; }
.ln-box .ln-quiz .hf-balken { height: 6px; }
.ln-box .ln-quiz .hf-balken > i { background: linear-gradient(90deg, var(--cyan), var(--ln-gruen)); }
.ln-box .ln-frage { font-family: var(--ln-gross); font-size: 30px; font-weight: 700; line-height: 1.25; letter-spacing: -.015em; text-align: center; padding: 36px 26px; border-radius: 22px; color: #fff3e6;
  border: 1px solid var(--u-rand, var(--cyan)); background: radial-gradient(130% 120% at 50% 0%, color-mix(in srgb, var(--cyan) 18%, transparent), rgba(0,0,0,.35)); box-shadow: inset 0 0 40px color-mix(in srgb, var(--cyan) 10%, transparent), 0 0 30px color-mix(in srgb, var(--cyan) 12%, transparent); }
.ln-box .ln-mikro { border-radius: 999px; padding: 10px 16px; font-size: 15px; justify-content: center; }
.ln-box #ln-q-form .hf-input { border-radius: 999px; padding-left: 18px; }
.ln-box #ln-q-form .hf-btn { border-radius: 999px; width: 46px; padding: 10px 0; }
.ln-box .ln-q-knoepfe { justify-content: center; }
.ln-box .ln-q-knoepfe .hf-btn { border-radius: 999px; padding: 9px 15px; }
.ln-box .ln-q-knoepfe .hf-btn[data-q="hoeren"] { background: linear-gradient(135deg, var(--cyan), color-mix(in srgb, var(--cyan) 55%, #ffd59a)); color: #1a0c00; border-color: transparent; font-weight: 700; padding: 11px 22px; box-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 40%, transparent); }
.ln-box #ln-q-ergebnis { font-size: 16px; }
.ln-box .ln-antwort { font-size: 15px; }
.ln-box .ln-punkte { font-size: 16px; }

/* Lernhilfe */
.ln-box .ln-karteikarte { border-radius: 22px; padding: 26px 26px; font-size: 17px; line-height: 1.5; }

/* Archiv */
.ln-box .ln-a-k { border-radius: 16px; padding: 10px; gap: 5px; transition: border-color .18s, box-shadow .18s, transform .18s; }
.ln-box .ln-a-k:hover { transform: translateY(-2px); }
.ln-box .ln-a-k b { font-family: var(--ln-gross); font-size: 14.5px; }
.ln-box .ln-a-bild { border-radius: 12px; height: 118px; }

@media (max-width: 900px) {
  .ln-box .hf-inhalt { font-size: 15.5px; gap: 14px; }
  .ln-box .hf-inhalt section { gap: 14px; }
  .ln-box .hf-inhalt > .hf-tabs { position: relative; top: auto; margin: 0; padding: 4px; }
  .ln-box .ln-q-kopf { gap: 10px; }
  .ln-box .hf-inhalt > .hf-tabs .hf-tab { flex: 0 0 auto; padding: 9px 13px; font-size: 14.5px; }
  .ln-box .hf-karte { padding: 16px; border-radius: 18px; }
  .ln-box .ln-gruss { padding: 18px 16px; }
  .ln-hero { gap: 14px; align-items: flex-start; margin-bottom: 16px; }
  .ln-orb { width: 48px; height: 48px; } .ln-orb b { font-size: 18px; } .ln-orb i { inset: -5px; }
  .ln-box .ln-gruss-text { font-size: 20px; }
  .ln-box .ln-gross { grid-template-columns: 1fr 1fr; gap: 10px; }
  .ln-box .ln-kachel { flex-direction: column; flex-wrap: nowrap; align-items: flex-start; padding: 14px 13px; gap: 4px; }
  .ln-box .ln-kachel b { width: 40px; height: 40px; font-size: 20px; margin-bottom: 4px; }
  .ln-box .ln-kachel span { font-size: 15.5px; line-height: 1.25; }
  .ln-box .ln-kachel small { flex-basis: auto; font-size: 12.5px; }
  .ln-box #ln-mikro-start { width: 100%; }
  .ln-box .ln-frage { font-size: 23px; padding: 26px 16px; }
  .ln-box .ln-q-knoepfe .hf-btn { flex: 1 1 calc(50% - 8px); white-space: nowrap; font-size: 14px; padding: 10px 8px; }
  .ln-box .ln-q-knoepfe .hf-btn[data-q="hoeren"] { flex-basis: 100%; padding: 13px; font-size: 16px; }
  .ln-legende { gap: 4px 12px; }
}

/* Lob-Feier (v1.112.0) */
.ln-feier { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "Helvetica Neue", system-ui, sans-serif; position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center; padding: 16px; background: rgba(3,6,3,.86); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); animation: ln-feier-ein .35s ease both; }
.ln-feier.weg { animation: ln-feier-aus .35s ease both; }
@keyframes ln-feier-ein { from { opacity: 0; } } @keyframes ln-feier-aus { to { opacity: 0; } }
.ln-feier-karte { position: relative; width: min(440px, 100%); display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 30px 24px 22px; border-radius: 26px;
  border: 1px solid rgba(61,220,132,.7); background: radial-gradient(120% 90% at 50% 0%, rgba(61,220,132,.22), rgba(10,14,8,.92) 70%); box-shadow: 0 0 60px rgba(61,220,132,.35), inset 0 0 40px rgba(61,220,132,.12); animation: ln-hupf .6s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes ln-hupf { from { transform: scale(.7); opacity: 0; } }
.ln-feier-karte .ln-ring, .ln-feier-karte .ln-ring svg, .ln-feier-karte .ln-ring b { width: 140px; } .ln-feier-karte .ln-ring svg, .ln-feier-karte .ln-ring b { height: 140px; }
.ln-feier-karte .ln-ring b { font-size: 34px; } .ln-feier-karte .ln-ring span { font-size: 13px; color: #b8f5d2; }
.ln-feier-karte .ln-ring .wert { animation: ln-ring-auf 1.4s cubic-bezier(.2,.8,.2,1) both, ln-leuchten 1.6s ease-in-out 1.4s infinite alternate; }
@keyframes ln-leuchten { to { filter: drop-shadow(0 0 14px rgba(61,220,132,1)); } }
.ln-feier-titel { font-family: var(--ln-gross, sans-serif); font-size: 26px; font-weight: 800; color: #eafff2; text-shadow: 0 0 20px rgba(61,220,132,.7); }
.ln-feier-text { font-size: 16px; line-height: 1.45; color: var(--text); }
.ln-konfetti { position: absolute; left: 50%; top: 38%; width: 0; height: 0; pointer-events: none; }
.ln-konfetti i { position: absolute; width: 8px; height: 13px; border-radius: 2px; opacity: 0; animation: ln-konfetti 1.8s cubic-bezier(.15,.7,.3,1) var(--d) both; }
@keyframes ln-konfetti { 0% { opacity: 1; transform: translate(0,0) rotate(0); } 70% { opacity: 1; } 100% { opacity: 0; transform: translate(calc(var(--x) * 230px), calc(var(--y) * 230px + 160px)) rotate(var(--r)); } }
.ln-ring.voll .wert { animation: ln-ring-auf 1.1s cubic-bezier(.2,.8,.2,1) both, ln-leuchten 1.2s ease-in-out infinite alternate; }
@media (prefers-reduced-motion: reduce) { .ln-konfetti { display: none; } .ln-feier-karte, .ln-feier, .ln-feier-karte .ln-ring .wert { animation: none; } }
`;
  document.head.appendChild(style);

  window.FridayLernen = { open: (o) => w.auf(o || {}), offen: w.offen };
})();
