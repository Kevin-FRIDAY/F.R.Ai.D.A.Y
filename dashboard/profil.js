// F.R.Ai.D.A.Y – Mein Profil (v1.147.0, im Test: in Friday erst nach Freigabe in Eve)
// Unten links aufs Profil tippen → Fenster mit Foto, Name, Geburtstag (Alter rechnet Friday aus),
// Adresse, Kontakt, Familie, Vorlieben, Gesundheit und Notizen. Gespeichert nur auf dem Mac (/api/profil).
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  const FUNKTION = "mein-profil";
  const darf = () => { try { return !window.FridayEve?.frei || window.FridayEve.frei(FUNKTION); } catch { return true; } };

  const style = document.createElement("style");
  style.textContent = `
.pf-box { width: min(920px, 100%); }
.pf-kopf { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.pf-bild { position: relative; width: 112px; height: 112px; border-radius: 50%; flex: none; cursor: pointer;
  background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--cyan) 25%, transparent), rgba(0,0,0,.5));
  border: 2px solid var(--cyan); box-shadow: 0 0 22px color-mix(in srgb, var(--cyan) 45%, transparent); overflow: hidden; display: grid; place-items: center; }
.pf-bild img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pf-bild .pf-leer { font-size: 44px; opacity: .8; }
.pf-bild .pf-cam { position: absolute; inset: auto 0 0 0; padding: 4px 0 6px; font-size: 11px; text-align: center; background: rgba(0,0,0,.6); color: #fff; opacity: 0; transition: opacity .2s; }
.pf-bild:hover .pf-cam, .pf-bild:focus-visible .pf-cam { opacity: 1; }
.pf-wer { flex: 1; min-width: 200px; }
.pf-wer h3 { margin: 0 0 4px; font-size: 22px; color: var(--text); }
.pf-wer .pf-zeile { color: var(--muted); font-size: 14px; }
.pf-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.pf-chip { font-size: 12px; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.3); }
.pf-gruppe { margin-top: 14px; }
.pf-gruppe > h4 { margin: 0 0 8px; font-size: 12px; letter-spacing: .14em; color: var(--cyan); text-transform: uppercase; }
.pf-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.pf-raster .pf-breit { grid-column: 1 / -1; }
.pf-raster textarea { min-height: 64px !important; }
.pf-fuss { position: sticky; bottom: -1px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 16px; padding: 10px 0 4px;
  background: linear-gradient(transparent, var(--bg, #05070a) 35%); }
.pf-ok { display: none; align-items: center; gap: 6px; color: #c9ffe3; font-size: 13px; }
.pf-ok.an { display: inline-flex; }
.pf-ok i { width: 20px; height: 20px; border-radius: 50%; background: #38e08c; color: #04210f; font-style: normal; font-weight: 800; display: grid; place-items: center; box-shadow: 0 0 10px rgba(56,224,140,.7); }
.pf-schalter { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
.side-user.pf-klickbar { cursor: pointer; }
.side-user .side-ava img.pf-ava { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; display: block; border: 1.5px solid var(--cyan); box-shadow: 0 0 10px color-mix(in srgb, var(--cyan) 50%, transparent); }
`;
  document.head.appendChild(style);

  const GRUPPEN = [
    ["Person", [["name", "text", "Vor- und Nachname"], ["rufname", "text", "z. B. Kevin oder Boss"], ["geburtstag", "date"], ["groesse", "text", "z. B. 1,82 m"], ["blutgruppe", "text", "z. B. A+"]]],
    ["Adresse", [["strasse", "text", "Musterstraße 1"], ["plz", "text", "12345", "numeric"], ["ort", "text", "Stadt"], ["land", "text", "Deutschland"]]],
    ["Kontakt", [["telefon", "tel", "0170 …"], ["email", "email", "name@beispiel.de"]]],
    ["Leben", [["beruf", "text", "Was du machst"], ["partner", "text", "Name deiner Frau / deines Mannes"], ["kinder", "text", "Namen und Alter"], ["haustiere", "text", ""], ["auto", "text", "Marke, Modell"]]],
    ["Vorlieben", [["hobbys", "area", "Was du gern machst"], ["lieblingsessen", "text", ""], ["musik", "text", ""]]],
    ["Gesundheit", [["allergien", "area", "Allergien, Medikamente, Unverträglichkeiten"]]],
    ["Sonst noch", [["notizen", "area", "Alles, was Friday über dich wissen soll"]]],
  ];
  let felder = {};
  let stand = {};
  let fotoNeu = null; // null = unverändert, "" = entfernt, data:… = neu

  const w = H.fenster({
    id: "profil", titel: "👤 Mein Profil", klasse: "pf-box",
    html: `
      <div class="pf-kopf">
        <div class="pf-bild" id="pf-bild" role="button" tabindex="0" aria-label="Foto auswählen"><span class="pf-leer">👤</span><span class="pf-cam">📷 Foto ändern</span></div>
        <input id="pf-foto" type="file" accept="image/*" hidden>
        <div class="pf-wer">
          <h3 id="pf-titel">Dein Profil</h3>
          <div class="pf-zeile" id="pf-unter">Alles bleibt nur auf deinem Mac.</div>
          <div class="pf-chips" id="pf-chips"></div>
        </div>
      </div>
      <form id="pf-form" autocomplete="off">
        <div id="pf-gruppen"></div>
        <div class="pf-fuss">
          <button class="hf-btn haupt" type="submit" id="pf-speichern">✓ Speichern</button>
          <button class="hf-btn leise" type="button" id="pf-foto-weg">Foto entfernen</button>
          <label class="pf-schalter"><input type="checkbox" id="pf-darf" checked> Friday darf meine Grunddaten kennen (Name, Alter, Wohnort, Beruf, Familie, Hobbys)</label>
          <span class="pf-ok" id="pf-ok" role="status"><i>✓</i> Gespeichert</span>
          <span class="hf-status" id="pf-status"></span>
        </div>
        <p class="hf-hinweis">Adresse, Telefon, E-Mail und Gesundheit gibt Friday nie an Claude weiter. Sprich zum Beispiel: „Friday, wie alt bin ich?“ oder „Wann habe ich Geburtstag?“</p>
      </form>`,
    onOpen: () => laden(),
  });

  const $ = (s) => w.$(s);
  function feldHtml([k, typ, ph = "", modus = ""]) {
    const label = esc(felder[k]?.[0] || k);
    const max = felder[k]?.[1] || 200;
    const wert = esc(stand[k] || "");
    if (typ === "area") return `<label class="hf-feld pf-breit">${label}<textarea name="${k}" maxlength="${max}" placeholder="${esc(ph)}">${wert}</textarea></label>`;
    return `<label class="hf-feld">${label}<input name="${k}" type="${typ}" maxlength="${max}" placeholder="${esc(ph)}" value="${wert}"${modus ? ` inputmode="${modus}"` : ""}${typ === "date" ? ` max="${new Date().toISOString().slice(0, 10)}"` : ""}></label>`;
  }
  function malen() {
    $("#pf-gruppen").innerHTML = GRUPPEN.map(([titel, fs]) => `<div class="pf-gruppe"><h4>${esc(titel)}</h4><div class="pf-raster">${fs.map(feldHtml).join("")}</div></div>`).join("");
    kopf();
  }
  function kopf() {
    const foto = fotoNeu !== null ? fotoNeu : stand.foto;
    $("#pf-bild").innerHTML = (foto ? `<img src="${esc(foto)}" alt="Dein Foto">` : '<span class="pf-leer">👤</span>') + '<span class="pf-cam">📷 Foto ändern</span>';
    $("#pf-foto-weg").hidden = !foto;
    $("#pf-titel").textContent = stand.name || "Dein Profil";
    const ort = [stand.plz, stand.ort].filter(Boolean).join(" ");
    $("#pf-unter").textContent = ort ? `📍 ${ort}` : "Alles bleibt nur auf deinem Mac.";
    const chips = [];
    if (stand.alter !== null && stand.alter !== undefined) chips.push(`🎂 ${stand.alter} Jahre`);
    if (stand.bis_geburtstag === 0) chips.push("🎉 Heute Geburtstag!");
    else if (stand.bis_geburtstag !== null && stand.bis_geburtstag !== undefined && stand.bis_geburtstag <= 30) chips.push(`⏳ Geburtstag in ${stand.bis_geburtstag} Tagen`);
    if (stand.beruf) chips.push(`💼 ${stand.beruf}`);
    if (stand.blutgruppe) chips.push(`🩸 ${stand.blutgruppe}`);
    $("#pf-chips").innerHTML = chips.map((c) => `<span class="pf-chip">${esc(c)}</span>`).join("");
    $("#pf-darf").checked = stand.friday_darf !== false;
  }
  async function laden() {
    try {
      const d = await json("/api/profil");
      felder = d.felder || {};
      stand = d;
      fotoNeu = null;
      malen();
      seitenleiste();
    } catch (e) { $("#pf-status").textContent = `Profil nicht erreichbar: ${e.message}`; }
  }

  // Foto: auf 320 px verkleinern, damit es klein bleibt
  function verkleinern(datei) {
    return new Promise((ok, nein) => {
      const r = new FileReader();
      r.onerror = () => nein(new Error("Bild konnte nicht gelesen werden."));
      r.onload = () => {
        const img = new Image();
        img.onerror = () => nein(new Error("Das ist kein Bild, das ich lesen kann."));
        img.onload = () => {
          const s = 320, c = document.createElement("canvas");
          c.width = s; c.height = s;
          const g = c.getContext("2d");
          const m = Math.min(img.width, img.height); // quadratisch aus der Mitte
          g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
          ok(c.toDataURL("image/jpeg", 0.85));
        };
        img.src = r.result;
      };
      r.readAsDataURL(datei);
    });
  }
  $("#pf-bild").addEventListener("click", () => $("#pf-foto").click());
  $("#pf-bild").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#pf-foto").click(); } });
  $("#pf-foto").addEventListener("change", async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { fotoNeu = await verkleinern(f); kopf(); $("#pf-status").textContent = "Foto ausgewählt. Tipp auf Speichern."; }
    catch (err) { $("#pf-status").textContent = err.message; }
  });
  $("#pf-foto-weg").addEventListener("click", () => { fotoNeu = ""; kopf(); $("#pf-status").textContent = "Foto wird beim Speichern entfernt."; });
  w.$("#pf-form").addEventListener("input", () => $("#pf-ok").classList.remove("an"));

  w.$("#pf-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {};
    for (const el of w.$$("#pf-gruppen [name]")) body[el.name] = el.value;
    body.friday_darf = $("#pf-darf").checked;
    if (fotoNeu !== null) body.foto = fotoNeu;
    const knopf = $("#pf-speichern");
    knopf.disabled = true; $("#pf-status").textContent = "Speichere …"; $("#pf-status").classList.remove("fehler");
    try {
      const r = await json("/api/profil", { body });
      stand = r.profil; fotoNeu = null;
      kopf(); seitenleiste();
      $("#pf-status").textContent = r.geaendert?.length ? `Geändert: ${r.geaendert.join(", ")}` : "";
      $("#pf-ok").classList.add("an");
    } catch (err) { $("#pf-status").textContent = err.message; $("#pf-status").classList.add("fehler"); }
    finally { knopf.disabled = false; }
  });

  // ---------- Seitenleiste unten links: Foto + Name, antippen öffnet das Profil ----------
  const user = document.querySelector(".side-user");
  const avaOrig = user?.querySelector(".side-ava")?.innerHTML || "";
  const nameOrig = user?.querySelector(".side-uname")?.textContent || "";
  function seitenleiste() {
    if (!user) return;
    const ava = user.querySelector(".side-ava"), name = user.querySelector(".side-uname");
    if (!darf()) { if (ava) ava.innerHTML = avaOrig; if (name) name.textContent = nameOrig; return; }
    if (ava) ava.innerHTML = stand.foto ? `<img class="pf-ava" src="${esc(stand.foto)}" alt="">` : avaOrig;
    if (name) name.textContent = stand.rufname || (stand.name || "").split(" ")[0] || nameOrig;
  }
  if (user) {
    user.classList.add("pf-klickbar");
    user.setAttribute("role", "button");
    user.tabIndex = 0;
    user.title = "Mein Profil öffnen";
    // Gesperrt in Friday: das Eve-Schloss (Klick-Abfang auf .side-user-panel) greift vorher.
    user.addEventListener("click", () => w.auf());
    user.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); w.auf(); } });
  }
  // Einstellungen → Profil: Knopf zum ganzen Profil
  const save = document.getElementById("profil-save");
  if (save && !document.getElementById("profil-ganz")) {
    const b = document.createElement("button");
    b.id = "profil-ganz"; b.type = "button"; b.className = "chip"; b.textContent = "👤 Ganzes Profil";
    b.addEventListener("click", () => w.auf());
    save.insertAdjacentElement("beforebegin", b);
  }
  // Beim Start Foto/Name in die Seitenleiste holen (nur wenn frei)
  setTimeout(async () => {
    if (!darf()) return;
    try { const d = await json("/api/profil"); felder = d.felder || {}; stand = d; seitenleiste(); } catch { /* egal */ }
  }, 1500);
  window.addEventListener("eve-stand", seitenleiste);

  window.FridayProfil = { open: () => w.auf(), offen: w.offen };
})();
