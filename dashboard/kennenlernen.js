// F.R.Ai.D.A.Y – Friday kennt dich (v1.171.0)
// Fenster mit dem "Kennen-Grad" (Ring in Prozent), Bereichen (Essen, Musik, Arbeit, Familie …),
// allen Kennenlern-Fragen zum direkten Eintippen, dem, was Friday nebenbei gelernt hat, und dem Schalter
// "Nebenbei mitlernen". Per Stimme: "Friday, lern mich kennen". Alles bleibt auf dem Mac (/api/kennenlernen).
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;

  const style = document.createElement("style");
  style.textContent = `
.kl-box { width: min(980px, 100%); }
.kl-kopf { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
.kl-ring { position: relative; width: 132px; height: 132px; flex: none; }
.kl-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.kl-ring .bg { stroke: rgba(255,255,255,.08); }
.kl-ring .fg { stroke: var(--cyan); filter: drop-shadow(0 0 6px var(--cyan)); transition: stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1); }
.kl-ring .mitte { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; }
.kl-ring .mitte b { font-size: 34px; line-height: 1; color: var(--text); text-shadow: 0 0 14px color-mix(in srgb, var(--cyan) 70%, transparent); }
.kl-ring .mitte small { display: block; font-size: 10px; letter-spacing: .16em; color: var(--muted); margin-top: 4px; text-transform: uppercase; }
.kl-wer { flex: 1; min-width: 220px; }
.kl-wer h3 { margin: 0 0 6px; font-size: 20px; color: var(--text); }
.kl-wer p { margin: 0 0 10px; color: var(--muted); font-size: 14px; line-height: 1.45; }
.kl-kats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.kl-kat { text-align: left; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.28); color: var(--text); border-radius: 12px; padding: 9px 10px; font: inherit; cursor: pointer; display: flex; flex-direction: column; gap: 6px; }
.kl-kat.an { border-color: var(--cyan); box-shadow: 0 0 14px color-mix(in srgb, var(--cyan) 30%, transparent); }
.kl-kat .t { font-size: 13px; display: flex; justify-content: space-between; gap: 6px; }
.kl-kat .t span:last-child { color: var(--muted); font-size: 12px; }
.kl-fragen { display: flex; flex-direction: column; gap: 8px; }
.kl-frage { display: grid; grid-template-columns: 1fr minmax(180px, 42%) auto; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.22); }
.kl-frage.hat { border-color: color-mix(in srgb, var(--cyan) 45%, var(--line)); }
.kl-frage.nie { opacity: .5; }
.kl-frage .q { font-size: 14px; color: var(--text); }
.kl-frage .q small { display: block; font-size: 11px; color: var(--muted); margin-top: 2px; }
.kl-frage input { font-size: 15px !important; }
.kl-frage .ok { color: #45e38b; font-weight: 800; min-width: 18px; text-align: center; opacity: 0; transition: opacity .25s; }
.kl-frage .ok.an { opacity: 1; }
.kl-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.kl-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 6px 5px 11px; border-radius: 999px; border: 1px solid var(--u-rand-soft, var(--line)); background: rgba(0,0,0,.3); font-size: 13px; }
.kl-chip button { border: 0; background: transparent; color: var(--muted); cursor: pointer; font-size: 13px; padding: 0 4px; }
.kl-chip button:hover { color: #ff6b5a; }
.kl-schalter { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); cursor: pointer; }
.kl-schalter input { width: 18px; height: 18px; accent-color: var(--cyan); }
.kl-toast { position: fixed; left: 50%; bottom: 92px; transform: translate(-50%, 20px); opacity: 0; pointer-events: none; z-index: 9999;
  padding: 9px 16px; border-radius: 999px; font-size: 13px; color: var(--text); background: rgba(10,8,6,.88); border: 1px solid var(--cyan);
  box-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 40%, transparent); transition: opacity .3s, transform .3s; }
.kl-toast.an { opacity: 1; transform: translate(-50%, 0); }
@media (max-width: 640px) {
  .kl-ring { width: 108px; height: 108px; }
  .kl-frage { grid-template-columns: 1fr auto; }
  .kl-frage .q { grid-column: 1 / -1; }
}
`;
  document.head.appendChild(style);

  let daten = null;
  let filter = "";

  const w = H.fenster({
    id: "kennen", titel: "🧬 Friday kennt dich", klasse: "kl-box",
    html: `
      <div class="hf-karte kl-kopf">
        <div class="kl-ring" aria-hidden="true">
          <svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52" fill="none" stroke-width="10"/><circle class="fg" id="kl-fg" cx="60" cy="60" r="52" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="326.7" stroke-dashoffset="326.7"/></svg>
          <div class="mitte"><div><b id="kl-grad">0%</b><small>kennt dich</small></div></div>
        </div>
        <div class="kl-wer">
          <h3 id="kl-titel">Ich lerne dich kennen</h3>
          <p id="kl-text">Je mehr ich über dich weiß, desto persönlicher werden meine Antworten, Tipps und das Briefing. Alles bleibt auf deinem Mac.</p>
          <div class="hf-reihe">
            <button class="hf-btn haupt" id="kl-sprich" type="button">🎙 Frag mich (per Stimme)</button>
            <button class="hf-btn" id="kl-profil" type="button">👤 Mein Profil</button>
            <label class="kl-schalter"><input type="checkbox" id="kl-mit"> Nebenbei mitlernen</label>
          </div>
        </div>
      </div>
      <div class="kl-kats" id="kl-kats"></div>
      <div class="hf-karte"><h3 id="kl-fragen-titel">Fragen an dich</h3><div class="kl-fragen" id="kl-fragen"></div>
        <p class="hf-hinweis">Antwort eintippen und Enter drücken, oder einfach sagen: „Friday, lern mich kennen“. Feld leeren = vergessen. 🚫 = diese Frage nie stellen.</p></div>
      <div class="hf-karte"><h3>Nebenbei gelernt</h3><div class="kl-chips" id="kl-gelernt"></div>
        <p class="hf-hinweis">Wenn du sagst „ich mag Sushi“, „meine Frau heißt …“ oder „antworte mir kürzer“, merke ich mir das von selbst. ✕ = vergessen.</p></div>
      <div class="hf-karte" id="kl-gew-karte"><h3>Deine Gewohnheiten</h3><p class="hf-hinweis" id="kl-gew"></p></div>
      <div class="hf-status" id="kl-status"></div>`,
    onOpen: () => laden(),
  });
  const $ = w.$;
  const status = (t, fehler) => { const s = $("#kl-status"); s.textContent = t || ""; s.classList.toggle("fehler", Boolean(fehler)); };

  async function laden() {
    try { daten = await json("/api/kennenlernen"); zeichnen(); status(""); } catch (err) { status(err.message, true); }
  }

  function zeichnen() {
    const d = daten;
    if (!d) return;
    $("#kl-grad").textContent = `${d.grad}%`;
    $("#kl-fg").style.strokeDashoffset = String(326.7 * (1 - d.grad / 100));
    const beantwortet = d.fragen.filter((f) => f.antwort).length;
    $("#kl-titel").textContent = d.grad >= 80 ? "Ich kenne dich richtig gut" : d.grad >= 40 ? "Wir kennen uns schon ganz gut" : "Ich lerne dich gerade kennen";
    $("#kl-text").textContent = `${beantwortet} von ${d.fragen.length} Fragen beantwortet · ${d.gelernt.length} Dinge nebenbei gelernt · ${d.gedaechtnis} Einträge im Gedächtnis.`;
    $("#kl-mit").checked = d.mitlernen;
    $("#kl-kats").innerHTML = d.kategorien.map((k) => `<button type="button" class="kl-kat${filter === k.id ? " an" : ""}" data-kat="${k.id}">
      <span class="t"><span>${k.icon} ${esc(k.name)}</span><span>${k.beantwortet}/${k.gesamt}</span></span>
      <span class="hf-balken"><i style="width:${Math.round((k.beantwortet / Math.max(1, k.gesamt)) * 100)}%"></i></span></button>`).join("");
    const kat = d.kategorien.find((k) => k.id === filter);
    $("#kl-fragen-titel").textContent = kat ? `${kat.icon} ${kat.name}` : "Fragen an dich";
    const liste = d.fragen.filter((f) => !filter || f.kat === filter)
      .sort((a, b) => (filter ? 0 : Number(Boolean(a.antwort)) - Number(Boolean(b.antwort)) || Number(a.nie) - Number(b.nie)));
    $("#kl-fragen").innerHTML = liste.map((f) => `<div class="kl-frage${f.antwort ? " hat" : ""}${f.nie ? " nie" : ""}" data-id="${f.id}">
      <div class="q">${esc(f.frage)}<small>${esc(f.label)}${f.quelle === "mitgelernt" ? " · nebenbei gelernt" : f.quelle === "runde" ? " · per Stimme" : ""}</small></div>
      <input class="hf-input" type="text" maxlength="200" value="${esc(f.antwort)}" placeholder="${f.nie ? "wird nicht gefragt" : "deine Antwort …"}" aria-label="${esc(f.frage)}" enterkeyhint="done">
      <span class="hf-reihe"><span class="ok" aria-hidden="true">✓</span><button type="button" class="hf-mini" data-nie title="${f.nie ? "Wieder fragen" : "Nie fragen"}">${f.nie ? "↺" : "🚫"}</button></span></div>`).join("");
    $("#kl-gelernt").innerHTML = d.gelernt.length
      ? d.gelernt.map((g) => `<span class="kl-chip" title="${esc(new Date(g.at).toLocaleString("de-DE"))}">${esc(g.du)}<button type="button" data-weg="${esc(g.schluessel)}" aria-label="Vergessen">✕</button></span>`).join("")
      : `<span class="hf-hinweis">Noch nichts. Erzähl mir einfach etwas über dich.</span>`;
    $("#kl-gew").textContent = d.gewohnheiten || "Noch keine Auswertung. Die kommt, sobald wir ein paar Tage miteinander geredet haben.";
  }

  async function speichern(zeile) {
    const id = zeile.dataset.id;
    const input = zeile.querySelector("input");
    const text = input.value.trim();
    const alt = daten.fragen.find((f) => f.id === id);
    if (!alt || (alt.antwort || "") === text) return;
    try {
      const r = await json("/api/kennenlernen/antwort", { body: { id, text } });
      daten = r.stand;
      const ok = zeile.querySelector(".ok");
      ok?.classList.add("an");
      setTimeout(() => ok?.classList.remove("an"), 1600);
      alt.antwort = text;
      zeile.classList.toggle("hat", Boolean(text));
      $("#kl-grad").textContent = `${daten.grad}%`;
      $("#kl-fg").style.strokeDashoffset = String(326.7 * (1 - daten.grad / 100));
    } catch (err) { status(err.message, true); }
  }

  w.sheet.addEventListener("click", async (e) => {
    const kat = e.target.closest("[data-kat]");
    if (kat) { filter = filter === kat.dataset.kat ? "" : kat.dataset.kat; zeichnen(); return; }
    const nie = e.target.closest("[data-nie]");
    if (nie) {
      const id = nie.closest(".kl-frage").dataset.id;
      const f = daten.fragen.find((x) => x.id === id);
      try { daten = await json("/api/kennenlernen/einstellungen", { body: { nie: { id, an: !f.nie } } }); zeichnen(); } catch (err) { status(err.message, true); }
      return;
    }
    const weg = e.target.closest("[data-weg]");
    if (weg) { try { daten = await json("/api/kennenlernen/vergessen", { body: { schluessel: weg.dataset.weg } }); zeichnen(); } catch (err) { status(err.message, true); } }
  });
  w.sheet.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches(".kl-frage input")) { e.preventDefault(); speichern(e.target.closest(".kl-frage")); e.target.blur(); } });
  w.sheet.addEventListener("focusout", (e) => { if (e.target.matches(".kl-frage input")) speichern(e.target.closest(".kl-frage")); });
  $("#kl-mit").addEventListener("change", async (e) => { try { daten = await json("/api/kennenlernen/einstellungen", { body: { mitlernen: e.target.checked } }); zeichnen(); } catch (err) { status(err.message, true); } });
  $("#kl-profil").addEventListener("click", () => { if (window.FridayProfil?.open) { w.zu(); window.FridayProfil.open(); } else document.getElementById("profil-open")?.click(); });
  $("#kl-sprich").addEventListener("click", () => { window.Friday?.send?.("Friday, lern mich kennen"); });

  // Kleines Schild, wenn Friday nebenbei etwas gelernt hat.
  const toast = document.createElement("div");
  toast.className = "kl-toast"; toast.setAttribute("role", "status");
  document.body.appendChild(toast);
  let toastT = 0;
  function zeigeToast(t) { toast.textContent = t; toast.classList.add("an"); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove("an"), 3200); }

  window.addEventListener("friday-aktionen", (e) => {
    const a = e.detail?.actions || [];
    if (a.includes("kennenlernen")) { if (!w.offen()) w.auf(); else laden(); }
    if (a.includes("kennenlernen_gemerkt")) { zeigeToast("🧬 Friday hat sich etwas über dich gemerkt"); if (w.offen()) laden(); }
  });

  window.FridayKennen = { open: () => w.auf(), laden };
})();
