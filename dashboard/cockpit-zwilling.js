// Gehirn-Cockpit, Reiter "💻 Zwilling" und "🔏 Datenschutz" (v1.188.0, Mark XVI):
// Mac-Zwilling (System, Speicher-Trend, Programme, Apps, Kompatibilität), Mac-Sicherheit, Software-Prüfung,
// eigenes Netzwerk (nur eigenes WLAN), Anmelde-Auffälligkeiten, Datenschutz-Kontrolle mit Papierkorb.
(() => {
  "use strict";
  const C = window.FridayCockpit;
  const H = window.FridayHelfer;
  if (!C || !H) return;
  const { esc, json } = H;
  const zeit = (iso) => { try { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  const tag = (iso) => { try { return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return ""; } };
  const ok = (x) => (x === true ? "🟢" : x === false ? "🔴" : "⚪");
  let audit = null, bestaetigen = null;

  function balken(prozent) {
    const p = Math.max(0, Math.min(100, Number(prozent) || 0));
    return `<div class="ck-zw-balken"><span style="width:${p}%" class="${p >= 90 ? "voll" : p >= 75 ? "knapp" : ""}"></span></div>`;
  }
  function linie(verlauf) {
    const w = verlauf.map((v) => v.freiGB).filter((v) => Number.isFinite(v));
    if (w.length < 2) return "";
    const max = Math.max(...w), min = Math.min(...w), sp = Math.max(1, max - min);
    return `<svg class="ck-zw-linie" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${w.map((v, i) => `${(i / (w.length - 1)) * 100},${28 - ((v - min) / sp) * 26}`).join(" ")}" /></svg>`;
  }

  async function zwilling(el, meldung = "") {
    const d = await json("/api/zwilling");
    const z = d.zustand, s = d.sicherheit, n = d.netz;
    audit = audit || d.audit;
    el.innerHTML = `${meldung ? `<p class="hf-hinweis">${esc(meldung)}</p>` : ""}
      <div class="ck-zw-raster">
        <div class="hf-karte"><h3>💻 ${esc(z.system.name)}</h3>
          <p>${esc(z.system.os)}<br><span class="klein">${esc(z.system.cpu)} · ${z.system.kerne} Kerne · Last ${z.system.last} · läuft seit ${z.system.laufzeitStd} h</span></p>
          <p class="klein">Arbeitsspeicher: ${(z.system.ramGB - z.system.ramFreiGB).toFixed(1)} von ${z.system.ramGB} GB belegt</p>${balken(((z.system.ramGB - z.system.ramFreiGB) / z.system.ramGB) * 100)}
          ${z.akku ? `<p class="klein">🔋 Akku ${z.akku.prozent} % · ${esc(z.akku.zustand)}${z.akku.netzteil ? " · am Netzteil" : ""}</p>${balken(z.akku.prozent)}` : ""}
          ${z.apps != null ? `<p class="klein">📦 ${z.apps} Apps installiert</p>` : ""}
        </div>
        <div class="hf-karte"><h3>💾 Speicher</h3>
          ${z.speicher ? `<p><b>${z.speicher.freiGB} GB frei</b> von ${z.speicher.gesamtGB} GB</p>${balken(z.speicher.prozent)}${linie(z.verlauf)}<p class="klein">${esc(z.trend.text)}</p>` : '<p class="klein">Nicht lesbar.</p>'}
          ${z.ordner.length ? `<ul class="ck-zw-mini">${z.ordner.map((o) => `<li>${esc(o.name)} <b>${o.gb ?? "–"} GB</b></li>`).join("")}</ul>` : ""}
        </div>
      </div>
      <div class="hf-karte"><h3>⚙️ Programme</h3>
        <div class="ck-zw-raster"><div><p class="klein">Am meisten Rechenleistung</p><ul class="ck-zw-mini">${z.cpuFresser.map((p) => `<li>${esc(p.name)}${p.anzahl > 1 ? ` <span class="klein">×${p.anzahl}</span>` : ""} <b>${p.cpu} %</b></li>`).join("")}</ul></div>
          <div><p class="klein">Am meisten Arbeitsspeicher</p><ul class="ck-zw-mini">${z.ramFresser.map((p) => `<li>${esc(p.name)}${p.anzahl > 1 ? ` <span class="klein">×${p.anzahl}</span>` : ""} <b>${Math.round(p.ramMB)} MB</b></li>`).join("")}</ul></div></div>
        <p class="klein">${z.prozesse} Programme laufen. Stand ${zeit(z.at)}.</p>
        ${z.appAenderungen.length ? `<p class="klein">Zuletzt bei den Apps: ${z.appAenderungen.slice(0, 8).map((a) => `${a.art === "neu" ? "＋" : "－"} ${esc(a.app)} (${esc(a.datum.slice(5).split("-").reverse().join("."))})`).join(" · ")}</p>` : ""}
        <div class="hf-reihe"><button class="hf-btn" id="ck-zw-snap">Schnappschuss jetzt</button></div>
      </div>
      <div class="hf-karte"><h3>🧩 Passt alles für Friday?</h3>
        <ul class="hf-liste">${z.kompatibilitaet.map((k) => `<li>${ok(k.ok)} <b>${esc(k.was)}</b> <span class="klein">${esc(k.wert)}</span>${k.ok === false && k.rat ? `<br><span class="klein hf-warn">${esc(k.rat)}</span>` : ""}</li>`).join("")}</ul>
      </div>
      <div class="hf-karte"><h3>🛡 Mac-Sicherheit</h3>
        ${s.mac ? `<ul class="hf-liste">${s.pruefungen.map((p) => `<li>${ok(p.ok)} <b>${esc(p.name)}</b> <span class="klein">${esc(p.wert)}</span>${p.ok === false ? `<br><span class="klein hf-warn">${esc(p.rat)}</span>` : ""}</li>`).join("")}</ul>` : `<p class="klein">${esc(s.hinweis)}</p>`}
        <p class="klein"><b>Fridays Bausteine:</b> ${audit ? `${audit.node.ok ? "🟢" : "🔴"} Node ${esc(audit.node.version)} · ${audit.audit ? `${audit.audit.kritisch + audit.audit.hoch ? "🔴" : audit.audit.mittel ? "🟡" : "🟢"} ${audit.audit.kritisch} kritische, ${audit.audit.hoch} hohe, ${audit.audit.mittel} mittlere Lücken${audit.audit.pakete.length ? ` (${esc(audit.audit.pakete.join(", "))})` : ""}` : `⚪ ${esc(audit.fehler)}`} · ${zeit(audit.at)}` : "noch nicht geprüft"}</p>
        <div class="hf-reihe"><button class="hf-btn" id="ck-zw-audit">Bausteine prüfen</button></div>
        <p class="hf-hinweis">Friday liest diese Einstellungen nur. Ändern tust du sie selbst in den Systemeinstellungen. Lücken in Bausteinen behebt das nächste getestete Update.</p>
      </div>
      <div class="hf-karte"><h3>📶 Dein Netzwerk</h3>
        ${n.ok ? `<ul class="hf-liste">${n.geraete.slice(0, 40).map((g) => `<li class="ck-zw-geraet ${g.bekannt ? "" : "fremd"}"><span>${g.jetztDa ? "🟢" : "⚪"} <b>${esc(g.name || g.ip)}</b> <span class="klein">${g.name ? `${esc(g.ip)} · ` : ""}${esc(g.mac)}${g.zufall ? " · private Adresse (Handy/Tablet)" : ""} · seit ${tag(g.erstGesehen)}</span>${g.bekannt ? "" : ' <b class="hf-warn">unbekannt</b>'}</span>
          <span class="hf-reihe"><input class="hf-input" data-name="${esc(g.mac)}" value="${esc(g.name)}" placeholder="Name" maxlength="40"><button class="hf-btn leise" data-merk="${esc(g.mac)}">${g.bekannt ? "Speichern" : "Ist meins"}</button></span></li>`).join("")}</ul>` : `<p class="klein">${esc(n.error)}</p>`}
        ${d.anmeldung.length ? `<p><b>Bei Friday angemeldet</b></p><ul class="hf-liste">${d.anmeldung.map((a) => `<li class="hf-warn">⚠️ ${esc(a.text)} <span class="klein">${zeit(a.zeit)}</span></li>`).join("")}</ul>` : '<p class="klein">🟢 Keine ungewöhnlichen Anmeldungen bei Friday in den letzten 7 Tagen.</p>'}
        <p class="hf-hinweis">Nur dein eigenes WLAN: Friday liest die Geräteliste, die dein Mac sowieso kennt. Kein Scannen, keine fremden Netze. Beim ersten Mal gelten alle Geräte als bekannt. Handys mit „privater Adresse“ tauchen manchmal neu auf.</p>
      </div>`;
    const knopf = (sel, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener("click", async () => {
      x.disabled = true;
      let text = "";
      try { const r = await fn(x); text = r?.text || r?.error || ""; } catch (err) { text = err.message; }
      zwilling(el, text);
    }));
    knopf("#ck-zw-snap", async () => { const r = await json("/api/zwilling/schnappschuss", { body: {} }); return { text: r.meldungen.length ? r.meldungen.join(" · ") : "Schnappschuss gespeichert. Keine Änderungen." }; });
    knopf("#ck-zw-audit", async (x) => { x.textContent = "Prüfe …"; audit = await json("/api/zwilling/software", { body: {} }); return {}; });
    knopf("[data-merk]", (x) => json("/api/zwilling/geraet", { body: { mac: x.dataset.merk, bekannt: true, name: el.querySelector(`[data-name="${CSS.escape(x.dataset.merk)}"]`).value } }).then((r) => (r.error ? r : { text: "Gespeichert." })));
  }

  async function datenschutz(el, meldung = "") {
    const d = await json("/api/datenschutz");
    el.innerHTML = `${meldung ? `<p class="hf-hinweis">${esc(meldung)}</p>` : ""}
      <div class="hf-karte"><h3>🔏 Was Friday speichert</h3>
        <ul class="hf-liste">${d.kategorien.map((k) => `<li class="ck-zw-kat"><div class="hf-zeile"><span class="name"><b>${esc(k.name)}</b><br><span class="klein">${k.mb} MB · ${k.dateien} Dateien${k.seit ? ` · seit ${tag(k.seit)}` : ""}${k.wo ? ` · ${esc(k.wo)}` : ""}</span></span>
          ${k.loeschbar ? (bestaetigen === k.id ? `<span class="hf-reihe"><select class="hf-input" id="ck-ds-tage"><option value="365">älter als 1 Jahr</option><option value="180">älter als 6 Monate</option><option value="90">älter als 3 Monate</option><option value="30">älter als 1 Monat</option></select><button class="hf-btn haupt" data-weg="${esc(k.id)}">In den Papierkorb</button><button class="hf-btn leise" id="ck-ds-nein">Abbrechen</button></span>` : `<button class="hf-btn leise" data-frag="${esc(k.id)}">Alte aufräumen …</button>`) : ""}</div></li>`).join("")}</ul>
        <p class="hf-hinweis">${esc(d.hinweis)} Aufgeräumtes landet erst im Papierkorb (${esc(d.papierkorb)}), nicht endgültig gelöscht.</p>
      </div>
      <div class="hf-karte"><h3>🌐 Wohin Daten gehen können</h3>
        <ul class="hf-liste">${d.nach.map((x) => `<li>${x.aktiv ? "🟢" : "⚪"} <b>${esc(x.dienst)}</b>${x.aktiv ? "" : ' <span class="klein">nicht eingerichtet</span>'}<br><span class="klein">${esc(x.was)}</span></li>`).join("")}</ul>
        <p class="hf-hinweis">Nur wenn du die Funktion benutzt. Schlüssel liegen verschlüsselt auf dem Mac. Im Gästemodus speichert Friday nichts.</p>
      </div>`;
    el.querySelectorAll("[data-frag]").forEach((x) => x.addEventListener("click", () => { bestaetigen = x.dataset.frag; datenschutz(el); }));
    el.querySelector("#ck-ds-nein")?.addEventListener("click", () => { bestaetigen = null; datenschutz(el); });
    el.querySelectorAll("[data-weg]").forEach((x) => x.addEventListener("click", async () => {
      x.disabled = true;
      let text = "";
      try { const r = await json("/api/datenschutz/aufraeumen", { body: { id: x.dataset.weg, aelterAlsTage: Number(el.querySelector("#ck-ds-tage").value) } }); text = r.text || r.error || ""; } catch (err) { text = err.message; }
      bestaetigen = null;
      datenschutz(el, text);
    }));
  }

  const css = document.createElement("style");
  css.textContent = `
.ck-zw-raster { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; }
.ck-zw-balken { height: 6px; border-radius: 4px; background: rgba(255,255,255,.1); overflow: hidden; margin: 4px 0 8px; }
.ck-zw-balken span { display: block; height: 100%; background: var(--cyan); }
.ck-zw-balken span.knapp { background: #ffb020; } .ck-zw-balken span.voll { background: #ff4d4d; }
.ck-zw-linie { width: 100%; height: 30px; display: block; }
.ck-zw-linie polyline { fill: none; stroke: var(--cyan); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.ck-zw-mini { list-style: none; padding: 0; margin: 4px 0; display: grid; gap: 2px; font-size: 13px; }
.ck-zw-mini li { display: flex; justify-content: space-between; gap: 8px; overflow-wrap: anywhere; }
.ck-zw-geraet { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
.ck-zw-geraet.fremd { border-left: 2px solid #ffb020; padding-left: 8px; }
.ck-zw-geraet .hf-input { width: 130px; }
.ck-zw-kat { list-style: none; }
@media (max-width: 900px) { .ck-zw-geraet .hf-input { width: 110px; } }`;
  document.head.appendChild(css);

  C.reiter("zwilling", "💻 Zwilling", (el) => zwilling(el));
  C.reiter("datenschutz", "🔏 Datenschutz", (el) => datenschutz(el));
})();
