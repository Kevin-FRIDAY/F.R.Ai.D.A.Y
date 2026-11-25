// Gehirn-Cockpit, Reiter "🤖 Agenten" und "🎯 Missionen" erweitert (v1.180.0, Mark XII Punkte 6–10, 24, 33, 34):
// Unternehmensleitung (Kennzahlen, Auto-Pause), Kontroll-Agent (Prüfergebnis je Einsatz), Agenten-Ausbildung
// (eigene Agenten mit Probelauf), 24/7-Daueraufträge und lokale Aufgabenplanung.
(() => {
  "use strict";
  const C = window.FridayCockpit;
  const H = window.FridayHelfer;
  if (!C || !H) return;
  const { esc, json } = H;
  const zeit = (iso) => { if (!iso) return "–"; try { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  const sek = (ms) => (ms == null ? "–" : `${(ms / 1000).toFixed(1).replace(".", ",")} s`);
  const quoteKlasse = (q) => (q == null ? "" : q >= 80 ? "hf-gut" : q >= 50 ? "hf-warn" : "hf-schlecht");
  let daten = null;

  // ---------- 🤖 Agenten: Unternehmensleitung + Ausbildung (über dem bisherigen Agenten-Raster) ----------
  C.agentenExtra = async () => {
    daten = await json("/api/agentenleitung");
    const d = daten;
    const zeilen = d.agenten.map((z) => `<tr><td>${z.pause_bis ? "⏸" : z.serie ? "⚠" : "✓"} <b>${esc(z.name)}</b>${z.eigen ? ' <span class="hf-badge">eigen</span>' : ""}</td><td>${z.einsaetze}</td><td class="${quoteKlasse(z.quote)}">${z.quote == null ? "–" : `${z.quote} %`}</td><td>${sek(z.tempo_ms)}</td><td class="klein">${z.letzte[0] ? `${z.letzte[0].status === "bestanden" ? "✓" : "✗"} ${esc(z.letzte[0].grund || z.letzte[0].titel)}` : ""}</td><td>${z.pause_bis ? `<button class="hf-btn leise" data-ck-pause="${esc(z.id)}">Pause aufheben (bis ${zeit(z.pause_bis)})</button>` : ""}</td></tr>`).join("");
    return `
      <div class="hf-karte"><h3>🏢 Unternehmensleitung</h3>
        <div class="hf-reihe"><span class="hf-badge ${quoteKlasse(d.gesamt.quote)}">${d.gesamt.quote == null ? "noch keine Einsätze" : `${d.gesamt.quote} % bestanden`}</span><span class="hf-badge">${d.gesamt.einsaetze} Einsätze</span>${d.bester ? `<span class="hf-badge hf-gut">Bester: ${esc(d.bester)}</span>` : ""}${d.sorgenkind ? `<span class="hf-badge hf-warn">Sorgenkind: ${esc(d.sorgenkind)}</span>` : ""}${d.pausiert.length ? `<span class="hf-badge hf-schlecht">Pausiert: ${esc(d.pausiert.join(", "))}</span>` : ""}</div>
        ${d.laufend.length ? `<p><span class="ck-puls"></span> Unterwegs: ${d.laufend.map((x) => `${esc(x.id)} (${esc(x.text)})`).join(", ")}</p>` : ""}
        ${zeilen ? `<div class="ck-tab-wrap"><table class="ck-tab ck-ag-tab"><thead><tr><th>Agent</th><th>Einsätze</th><th>Prüfquote</th><th>Ø Tempo</th><th>Letzte Prüfung</th><th></th></tr></thead><tbody>${zeilen}</tbody></table></div>` : '<p class="hf-hinweis">Noch keine Einsätze. Jeder Einsatz wird vom 🛡 Kontroll-Agenten geprüft und hier gezählt.</p>'}
        ${d.empfehlungen.length ? `<ul class="hf-liste">${d.empfehlungen.map((e) => `<li class="hf-zeile"><span class="name">💡 ${esc(e)}</span></li>`).join("")}</ul>` : ""}
        <p class="hf-hinweis">🛡 Kontroll-Agent: Ein Einsatz zählt nur, wenn der Bericht echte Inhalte hat (z. B. Wetter mit °C, Krypto mit Euro-Kurs). 3 Fehler hintereinander → automatische Pause, bei Wiederholung länger.</p>
      </div>
      <div class="hf-karte"><h3>🎓 Agenten-Ausbildung</h3>
        <p class="klein">Bau dir eigene Agenten aus einem Grund-Agenten, einer festen Eingabe und eigenen Prüfregeln. Nach dem ersten bestandenen Probelauf sind sie einsatzbereit.</p>
        <div class="ck-ag-form">
          <input class="hf-input" id="ck-ag-name" placeholder="Name, z. B. Rhein-Wächter" maxlength="40">
          <select class="hf-input" id="ck-ag-basis">${d.grundagenten.map((g) => `<option value="${esc(g.id)}">${esc(g.emoji)} ${esc(g.name)}</option>`).join("")}</select>
          <input class="hf-input" id="ck-ag-eingabe" placeholder="Eingabe (optional), z. B. Köln" maxlength="300">
          <input class="hf-input" id="ck-ag-muss" placeholder="Muss enthalten (Komma), z. B. Rhein" maxlength="120">
          <button class="hf-btn haupt" id="ck-ag-neu">＋ Ausbilden</button>
        </div>
        <ul class="hf-liste">${d.eigene.length ? d.eigene.map((a) => `<li class="hf-zeile"><span class="name">${esc(a.emoji)} <b>${esc(a.name)}</b> <span class="hf-badge ${a.status === "einsatzbereit" ? "hf-gut" : "hf-warn"}">${a.status === "einsatzbereit" ? "einsatzbereit" : "in Ausbildung"}</span><br><span class="klein">${esc(d.grundagenten.find((g) => g.id === a.basis)?.name || a.basis)}${a.eingabe ? ` · „${esc(a.eingabe)}“` : ""}${a.muss.length ? ` · muss: ${esc(a.muss.join(", "))}` : ""}</span><span class="klein" data-ck-erg="${esc(a.id)}"></span></span><button class="hf-btn" data-ck-los="${esc(a.id)}">${a.status === "einsatzbereit" ? "▶ Los" : "🧪 Probelauf"}</button><button class="hf-btn leise" data-ck-weg="${esc(a.id)}" title="Entlassen">✕</button></li>`).join("") : '<li class="hf-hinweis">Noch keine eigenen Agenten.</li>'}</ul>
        <div id="ck-ag-meldung" class="klein"></div>
      </div>`;
  };

  C.agentenNachher = (el, neu) => {
    const meldung = (t, gut = true) => { const m = el.querySelector("#ck-ag-meldung"); if (m) { m.textContent = t; m.className = `klein ${gut ? "hf-gut" : "hf-schlecht"}`; } };
    el.querySelector("#ck-ag-neu")?.addEventListener("click", async () => {
      try {
        await json("/api/agentenleitung/eigene", { body: { name: el.querySelector("#ck-ag-name").value, basis: el.querySelector("#ck-ag-basis").value, eingabe: el.querySelector("#ck-ag-eingabe").value, muss: el.querySelector("#ck-ag-muss").value } });
        el.querySelectorAll(".ck-ag-form input").forEach((i) => { i.value = ""; });
        neu();
      } catch (err) { meldung(err.message, false); }
    });
    el.querySelectorAll("[data-ck-los]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true; b.textContent = "… arbeitet";
      const r = await json(`/api/agentenleitung/eigene/${encodeURIComponent(b.dataset.ckLos)}/los`, { body: {} }).catch((e) => ({ ok: false, text: e.message }));
      const p = r.pruefung;
      const ziel = el.querySelector(`[data-ck-erg="${b.dataset.ckLos}"]`);
      if (ziel) { ziel.innerHTML = `<br>${p?.status === "bestanden" ? "✅ Kontroll-Agent: bestanden" : `❌ ${esc((p?.gruende || [r.text]).join("; "))}`} · ${esc(String(r.text || "").slice(0, 160))}`; }
      setTimeout(neu, 2500);
    }));
    el.querySelectorAll("[data-ck-weg]").forEach((b) => b.addEventListener("click", async () => { await json(`/api/agentenleitung/eigene/${encodeURIComponent(b.dataset.ckWeg)}`, { method: "DELETE" }); neu(); }));
    el.querySelectorAll("[data-ck-pause]").forEach((b) => b.addEventListener("click", async () => { await json(`/api/agentenleitung/pause/${encodeURIComponent(b.dataset.ckPause)}/aufheben`, { body: {} }); neu(); }));
  };

  // ---------- 🎯 Missionen: 24/7-Daueraufträge + lokale Planung ----------
  C.missionenExtra = async () => {
    const d = daten && Date.now() - (daten._t || 0) < 5000 ? daten : Object.assign(await json("/api/agentenleitung"), { _t: Date.now() });
    daten = d;
    const optionen = [...d.grundagenten.map((g) => `<option value="${esc(g.id)}">${esc(g.emoji)} ${esc(g.name)}</option>`), ...d.eigene.filter((a) => a.status === "einsatzbereit").map((a) => `<option value="${esc(a.id)}">${esc(a.emoji)} ${esc(a.name)} (eigen)</option>`), '<option value="team">👥 Team-Lagebericht</option>'].join("");
    return `
      <div class="hf-karte"><h3>🔁 24/7-Missionszentrale</h3>
        <ul class="hf-liste">${d.dauerauftraege.length ? d.dauerauftraege.map((r) => `<li class="hf-zeile"><span class="name"><b>${esc(r.name)}</b><br><span class="klein">${r.ausloeser.art === "taeglich" ? `täglich ${esc(r.ausloeser.zeit)}` : `alle ${r.ausloeser.minuten} Min.`} · melden: ${esc(r.aktion.melden || "fehler")} · zuletzt ${zeit(r.zuletzt)}${r.zuletzt ? ` ${r.ok ? "✓" : "✗"}` : ""}</span>${r.ergebnis ? `<br><span class="klein">${esc(r.ergebnis.slice(0, 140))}</span>` : ""}</span><button class="hf-btn leise" data-ck-dan="${esc(r.id)}" data-an="${r.an ? "0" : "1"}">${r.an ? "⏸ Aus" : "▶ An"}</button><button class="hf-btn leise" data-ck-dweg="${esc(r.id)}">✕</button></li>`).join("") : '<li class="hf-hinweis">Noch keine Daueraufträge. Sag z. B. „Friday, schick den Wetter-Agenten jeden Tag um 7 Uhr los“.</li>'}</ul>
        <div class="ck-ag-form">
          <select class="hf-input" id="ck-d-agent">${optionen}</select>
          <select class="hf-input" id="ck-d-art"><option value="taeglich">täglich um</option><option value="intervall">alle … Minuten</option></select>
          <input class="hf-input" id="ck-d-wert" value="07:00" maxlength="5">
          <select class="hf-input" id="ck-d-melden"><option value="fehler">melden bei Fehler</option><option value="immer">immer melden</option><option value="nie">nie melden</option></select>
          <button class="hf-btn haupt" id="ck-d-neu">＋ Dauerauftrag</button>
        </div>
      </div>
      <div class="hf-karte"><h3>🗺 Lokale Aufgabenplanung (ohne Claude)</h3>
        <div class="hf-reihe"><input class="hf-input grow" id="ck-p-ziel" placeholder="z. B. Radtour am Wochenende an den Rhein in Köln"><button class="hf-btn" id="ck-p-plan">Planen</button></div>
        <div id="ck-p-erg"></div>
      </div>`;
  };

  C.missionenNachher = (el, neu) => {
    const art = el.querySelector("#ck-d-art"), wert = el.querySelector("#ck-d-wert");
    art?.addEventListener("change", () => { wert.value = art.value === "taeglich" ? "07:00" : "60"; });
    el.querySelector("#ck-d-neu")?.addEventListener("click", async () => {
      const sel = el.querySelector("#ck-d-agent");
      const a = art.value;
      try {
        await json("/api/zentrale/automationen", { body: { name: `${sel.selectedOptions[0].textContent.replace(/^\S+\s/, "")} 24/7`, ausloeser: a === "taeglich" ? { art: a, zeit: wert.value } : { art: a, minuten: Number(wert.value) }, aktion: { art: "agent", text: sel.value, melden: el.querySelector("#ck-d-melden").value } } });
        wert.value = ""; neu();
      } catch (err) { alertLeise(el, err.message); }
    });
    el.querySelectorAll("[data-ck-dan]").forEach((b) => b.addEventListener("click", async () => { await json(`/api/zentrale/automationen/${encodeURIComponent(b.dataset.ckDan)}/an`, { body: { an: b.dataset.an === "1" } }).catch((e) => alertLeise(el, e.message)); daten = null; neu(); }));
    el.querySelectorAll("[data-ck-dweg]").forEach((b) => b.addEventListener("click", async () => { await json(`/api/zentrale/automationen/${encodeURIComponent(b.dataset.ckDweg)}`, { method: "DELETE" }).catch((e) => alertLeise(el, e.message)); daten = null; neu(); }));
    el.querySelector("#ck-p-plan")?.addEventListener("click", async () => {
      const ziel = el.querySelector("#ck-p-ziel").value.trim(); if (!ziel) return;
      const p = await json("/api/agentenleitung/plan", { body: { ziel } });
      const erg = el.querySelector("#ck-p-erg");
      if (!p.lokal) { erg.innerHTML = '<p class="hf-hinweis">Dafür finde ich keinen passenden Agenten – das müsste Claude planen (Mission starten).</p>'; return; }
      erg.innerHTML = `<ol class="ck-p-liste">${p.schritte.map((s) => `<li>${esc(s.text)}${s.eingabe ? ` <span class="klein">(${esc(s.eingabe)})</span>` : ""}</li>`).join("")}</ol><button class="hf-btn haupt" id="ck-p-start">▶ Als Mission starten</button>`;
      erg.querySelector("#ck-p-start").addEventListener("click", async () => {
        await json("/api/zentrale/missionen", { body: { ziel, titel: ziel.slice(0, 80), schritte: p.schritte } }).catch((e) => alertLeise(el, e.message));
        el.querySelector("#ck-p-ziel").value = ""; neu();
      });
    });
  };
  function alertLeise(el, t) { const e = el.querySelector("#ck-p-erg"); if (e) e.innerHTML = `<p class="hf-schlecht">${esc(t)}</p>`; }

  const css = document.createElement("style");
  css.textContent = `
.ck-ag-form { display: grid; grid-template-columns: 1.2fr 1.2fr 1fr 1fr auto; gap: 8px; margin: 8px 0; }
.ck-ag-tab td:nth-child(5) { max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
.ck-tab-wrap { overflow-x: auto; }
.ck-p-liste { margin: 8px 0 10px 18px; padding: 0; line-height: 1.6; }
@media (max-width: 900px) { .ck-ag-form { grid-template-columns: 1fr 1fr; } .ck-ag-form .hf-btn { grid-column: span 2; } .ck-ag-tab td:nth-child(4), .ck-ag-tab th:nth-child(4), .ck-ag-tab td:nth-child(5), .ck-ag-tab th:nth-child(5) { display: none; } }`;
  document.head.appendChild(css);
})();
