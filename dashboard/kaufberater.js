// F.R.Ai.D.A.Y Anti-Fehlkauf-Berater (v1.106.0)
// Produkt eintippen (oder per Lesezeichen aus dem Shop schicken) + Bewertungen einfügen →
// Ampel, passt es zu deinen Geräten, echte Langzeit-Mängel, Retouren-Gründe, Reparierbarkeit, Links.
// Ohne Claude. Nur die „Tiefen-Recherche“ (Websuche) braucht Guthaben.
(() => {
  "use strict";
  const H = window.FridayHelfer;
  if (!H) return;
  const { esc, json } = H;
  let aktuell = null;
  let geraete = [];

  const w = H.fenster({
    id: "kauf", titel: "🛍 Anti-Fehlkauf-Berater",
    html: `
      <form id="kb-form" class="hf-karte" autocomplete="off">
        <div class="hf-reihe"><input id="kb-produkt" class="hf-input grow" type="text" placeholder="Welches Produkt? z. B. Ring Video Doorbell 4" aria-label="Produkt" enterkeyhint="go"><button class="hf-btn haupt" type="submit">Prüfen</button></div>
        <div class="hf-zwei" style="margin-top:10px">
          <label class="hf-feld">Produktbeschreibung / Technische Daten (optional, für „Passt es?“)<textarea id="kb-beschr" placeholder="Aus dem Shop kopieren: Anschlüsse, kompatibel mit …"></textarea></label>
          <label class="hf-feld">Bewertungen (für Langzeit-Mängel und Rückgabegründe)<textarea id="kb-text" placeholder="Im Shop die Bewertungen markieren, kopieren und hier einfügen – am besten die kritischen und die Nachträge."></textarea></label>
        </div>
      </form>
      <div id="kb-status" class="hf-status">Sag auch: „Friday, soll ich mir die AirPods Pro kaufen?“</div>
      <div id="kb-ergebnis"></div>
      <details class="hf-karte" id="kb-geraete-k">
        <summary style="cursor:pointer"><b>📦 Meine Geräte &amp; Garantie-Wächter</b> <span id="kb-anzahl" class="hf-hinweis"></span></summary>
        <form id="kb-g-form" class="hf-reihe" style="margin-top:10px" autocomplete="off">
          <input id="kb-g-name" class="hf-input grow" type="text" placeholder="z. B. iPhone 15 Pro, MacBook Air, Samsung TV, Echo Dot" aria-label="Gerät">
          <input id="kb-g-datum" class="hf-input" type="date" style="width:auto" aria-label="Kaufdatum (für die Garantie)" title="Kaufdatum (für die 2-Jahres-Gewährleistung)">
          <button class="hf-btn" type="submit">＋ Speichern</button>
        </form>
        <div id="kb-geraete" class="hf-liste" style="margin-top:10px"></div>
        <p class="hf-hinweis">Mit Kaufdatum erinnert dich Friday 30 Tage bevor die 2-jährige Gewährleistung endet (per Telegram/Mitteilung).</p>
      </details>
      <div class="hf-lz">🔖 <b>Browser-Plugin (Lesezeichen):</b> Zieh den Knopf in deine Lesezeichen-Leiste (iPhone: Lesezeichen anlegen, Adresse durch diesen Link ersetzen). Im Shop Bewertungen markieren, Lesezeichen tippen – Friday prüft sofort.<br><a id="kb-lz" href="#">🛍 Kauf-Check mit Friday</a></div>
      <p class="hf-hinweis">Friday liest keine Shop-Seiten heimlich aus und vergleicht keine Preise selbst. Sie wertet nur aus, was du ihr gibst, und sagt ehrlich, wenn Daten fehlen.</p>`,
    onOpen: (opts) => { ladeGeraete(); if (opts?.id) zeigeId(opts.id); setTimeout(() => !aktuell && $("#kb-produkt").focus({ preventScroll: true }), 80); },
  });
  const $ = (s) => w.$(s);
  const status = (t, f = false) => { const s = $("#kb-status"); s.textContent = t; s.classList.toggle("fehler", f); };
  $("#kb-lz").href = H.lesezeichen("kauf");
  $("#kb-lz").addEventListener("click", (e) => { e.preventDefault(); status("Zieh den Knopf in die Lesezeichen-Leiste (nicht anklicken)."); });

  async function ladeGeraete() {
    try {
      const d = await json("/api/kaufberater");
      geraete = d.geraete || [];
      $("#kb-anzahl").textContent = geraete.length ? `(${geraete.length})` : "(noch keine – bitte eintragen)";
      $("#kb-geraete").innerHTML = geraete.length ? geraete.map((g) => `
        <div class="hf-zeile" data-id="${esc(g.id)}"><span class="icon">📦</span><span class="name">${esc(g.name)}<br><span class="klein">${esc((g.profil || []).join(" · ") || "keine Merkmale erkannt")}</span></span>
        ${g.garantie ? `<span class="hf-badge ${g.garantie.tage < 0 ? "hf-info" : g.garantie.tage <= 30 ? "hf-warn" : "hf-gut"}">${g.garantie.tage < 0 ? "Gewährleistung vorbei" : `Gewährleistung noch ${g.garantie.tage} T.`}</span>` : ""}
        <button class="hf-mini" data-del title="Entfernen">✕</button></div>`).join("") : `<div class="hf-leer">Trag ein, was du schon hast. Dann prüft Friday, ob Neues dazu passt.</div>`;
      if (!geraete.length) $("#kb-geraete-k").open = true;
    } catch (err) { status(err.message, true); }
  }
  $("#kb-g-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#kb-g-name").value.trim();
    if (!name) return;
    try { await json("/api/kaufberater/geraete", { body: { name, kaufdatum: $("#kb-g-datum").value } }); $("#kb-g-name").value = ""; $("#kb-g-datum").value = ""; ladeGeraete(); } catch (err) { status(err.message, true); }
  });
  $("#kb-geraete").addEventListener("click", async (e) => {
    if (!e.target.closest("[data-del]")) return;
    const id = e.target.closest("[data-id]").dataset.id;
    try { await json(`/api/kaufberater/geraete/${encodeURIComponent(id)}`, { method: "DELETE" }); ladeGeraete(); } catch (err) { status(err.message, true); }
  });

  async function pruefen(werte) {
    status("Friday prüft …");
    $("#kb-ergebnis").innerHTML = "";
    try {
      aktuell = await json("/api/kaufberater/pruefen", { body: werte });
      zeige();
      status("");
    } catch (err) { status(err.message, true); }
  }
  async function zeigeId(id) {
    try { aktuell = await json(`/api/kaufberater/ergebnis/${encodeURIComponent(id)}`); $("#kb-produkt").value = aktuell.produkt; zeige(); } catch (err) { status(err.message, true); }
  }
  $("#kb-form").addEventListener("submit", (e) => {
    e.preventDefault();
    pruefen({ produkt: $("#kb-produkt").value, beschreibung: $("#kb-beschr").value, text: $("#kb-text").value });
  });

  const AMPEL = { rot: ["#ff4a3a", "Vorsicht – eher nicht kaufen"], gelb: ["#ffc44d", "Kaufbar, aber mit Haken"], gruen: ["#45e38b", "Sieht gut aus"], grau: ["#8a8a8a", "Zu wenig Daten"] };
  const STUFE = { ok: ["hf-gut", "✓"], warn: ["hf-warn", "!"], bad: ["hf-schlecht", "✗"], info: ["hf-info", "i"] };
  function zeige() {
    const e = aktuell;
    if (!e) return;
    const [farbe, wort] = AMPEL[e.ampel] || AMPEL.grau;
    const maxM = Math.max(1, ...e.maengel.map((m) => m.anzahl));
    $("#kb-ergebnis").innerHTML = `
      <div class="hf-karte"><div class="hf-ampel" style="color:${farbe}"><span class="licht"></span><div><b style="color:var(--text)">${esc(e.produkt)}</b><br><span>${wort}</span>${e.sterne ? ` <span class="hf-hinweis">· ⭐ ${String(e.sterne.schnitt).replace(".", ",")} (aus ${e.sterne.anzahl} Angaben)</span>` : ""}</div></div>
        <p class="hf-hinweis" style="margin:10px 0 0">${esc(e.sprech)}</p>
        <div class="hf-reihe" style="margin-top:10px"><button class="hf-mini" id="kb-sprich">🔊 Vorlesen</button><button class="hf-btn ki" id="kb-tief" type="button">🔎 Tiefen-Recherche im Netz</button></div>
        <div id="kb-tief-erg" class="hf-hinweis" style="white-space:pre-wrap;margin-top:8px"></div>
      </div>
      <div class="hf-zwei">
        <div class="hf-karte"><h3>🔌 Passt es zu meinen Geräten?</h3><ul class="hf-liste">${e.kompat.map((k) => `<li class="hf-zeile"><span class="icon ${STUFE[k.stufe]?.[0]}">${STUFE[k.stufe]?.[1]}</span><span class="name">${esc(k.text)}</span></li>`).join("")}</ul></div>
        <div class="hf-karte"><h3>↩ Warum Leute es zurückschicken</h3>${e.retouren.length ? `<ul class="hf-liste">${e.retouren.map((r) => `<li class="hf-zeile"><span class="name">${esc(r.name)}<p class="hf-zitat">„${esc(r.zitate[0] || "")}“</p></span><span class="hf-badge hf-warn">${r.anzahl}×</span></li>`).join("")}</ul>` : `<div class="hf-leer">Keine Rückgabegründe gefunden${e.saetze < 5 ? " – füg Bewertungen ein" : ""}.</div>`}</div>
      </div>
      <div class="hf-karte"><h3>🕰 Mängel – Langzeit zuerst</h3>${e.maengel.length ? `<ul class="hf-liste">${e.maengel.map((m) => `
        <li class="hf-zeile" style="align-items:flex-start"><span class="icon">${esc(m.icon)}</span><span class="name"><b>${esc(m.name)}</b> ${m.langzeit ? `<span class="hf-badge hf-schlecht">${m.langzeit}× erst nach Wochen/Monaten</span>` : ""}
        <div class="hf-balken" style="margin:6px 0"><i style="width:${Math.round((m.anzahl / maxM) * 100)}%"></i></div>
        ${m.zitate.slice(0, 2).map((z) => `<p class="hf-zitat">„${esc(z)}“</p>`).join("")}</span><span class="hf-badge hf-warn">${m.anzahl}×</span></li>`).join("")}</ul>` : `<div class="hf-leer">${e.saetze < 5 ? "Keine Bewertungen eingefügt – dann kann ich keine Mängel finden." : "Keine typischen Mängel in den Bewertungen gefunden."}</div>`}</div>
      <div class="hf-zwei">
        <div class="hf-karte"><h3>🔧 Reparierbarkeit (iFixit)</h3>${e.reparatur?.treffer?.length ? `<ul class="hf-liste">${e.reparatur.treffer.map((t) => `<li class="hf-zeile"><span class="name"><a href="${esc(t.url)}" target="_blank" rel="noopener" style="color:var(--text)">${esc(t.titel)}</a></span><span class="hf-badge hf-info">${esc(t.art)}</span></li>`).join("")}</ul>` : `<div class="hf-leer">Keine Reparatur-Anleitungen gefunden.</div>`}</div>
        <div class="hf-karte"><h3>🔗 Selbst nachsehen &amp; Preise vergleichen</h3><div class="hf-reihe">${e.links.map((l) => `<a class="hf-mini" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.icon)} ${esc(l.name)}</a>`).join("")}</div></div>
      </div>
      <div class="hf-karte"><h3>🤝 Ehrlich gesagt</h3><ul class="hf-hinweis" style="margin:0;padding-left:18px">${e.ehrlich.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
    $("#kb-sprich").onclick = () => window.Friday?.say?.(e.sprech);
    $("#kb-tief").onclick = async () => {
      const b = $("#kb-tief"); b.disabled = true; $("#kb-tief-erg").textContent = "Friday recherchiert im Netz …";
      try { const d = await json("/api/kaufberater/recherche", { body: { produkt: e.produkt } }); $("#kb-tief-erg").textContent = d.text; }
      catch (err) { $("#kb-tief-erg").textContent = err.status === 402 ? "Fridays Guthaben ist leer – die Tiefen-Recherche braucht Claude. Alles oben läuft ohne." : err.message; }
      finally { b.disabled = false; }
    };
  }

  // Vom Lesezeichen geschickt
  H.vonLesezeichen("kauf", (v) => {
    w.auf();
    $("#kb-produkt").value = v.titel.replace(/\s*[|:–-]\s*(amazon|otto|mediamarkt|saturn|ebay|idealo).*$/i, "").slice(0, 120);
    $("#kb-text").value = v.text;
    pruefen({ produkt: $("#kb-produkt").value, text: v.text, url: v.url });
  });

  window.FridayKauf = { open: (opts) => w.auf(opts), offen: w.offen };
})();
