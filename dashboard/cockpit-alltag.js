// Gehirn-Cockpit, Reiter "🏠 Zuhause" und "🧭 Leben" (v1.182.0, Mark XII Punkte 14, 15, 16):
// Smart Home Intelligence (Gewohnheiten → Vorschläge), Umgebungserkennung (Raumklima, Geräusch-Pegel vom eigenen Gerät)
// und der Lebensmanager (Balance, heute wichtig, Tipps).
(() => {
  "use strict";
  const C = window.FridayCockpit;
  const H = window.FridayHelfer;
  if (!C || !H) return;
  const { esc, json } = H;
  const zahl = (v, e = "") => (v == null ? "–" : `${String(v).replace(".", ",")}${e}`);

  // ---------- Geräusch-Pegel: nur Lautstärke, 3 Sekunden, nichts wird aufgenommen ----------
  async function pegelMessen() {
    const strom = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      const quelle = ctx.createMediaStreamSource(strom);
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      quelle.connect(an);
      const puffer = new Float32Array(an.fftSize);
      const werte = [];
      const ende = Date.now() + 3000;
      while (Date.now() < ende) {
        await new Promise((r) => setTimeout(r, 100));
        an.getFloatTimeDomainData(puffer);
        let s = 0; for (const x of puffer) s += x * x;
        werte.push(Math.sqrt(s / puffer.length));
      }
      const rms = werte.reduce((a, b) => a + b, 0) / Math.max(1, werte.length);
      // Grobe Umrechnung auf Schalldruck: Handy-/Mac-Mikros sind nicht geeicht → nur ungefähr.
      return Math.max(20, Math.min(110, Math.round(20 * Math.log10(Math.max(rms, 1e-6)) + 94)));
    } finally {
      strom.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    }
  }

  async function zuhause(el, meldung = "") {
    const [h, u] = await Promise.all([json("/api/haus-intelligenz"), json("/api/umgebung")]);
    const r = u.raum;
    // Raumluft-Hinweise stehen schon oben unter Umgebung, hier nur der Rest (Batterie, Fenster + Heizung).
    const haHinweise = (h.hinweise || []).filter((x) => !u.empfehlungen.length || !["💧", "🌬", "🥶", "🥵", "🌵"].includes(x.icon));
    el.innerHTML = `${meldung ? `<p class="hf-hinweis">✓ ${esc(meldung)}</p>` : ""}
      <div class="ck-gd-kacheln ck-w-kacheln">
        <div class="ck-kachel"><b>${zahl(r.temperatur, " °C")}</b><span>Raumtemperatur</span><small>${u.draussen ? `draußen ${zahl(u.draussen.temperatur, " °C")}` : r.sensoren ? `${r.sensoren} Sensoren` : "kein Sensor"}</small></div>
        <div class="ck-kachel"><b>${zahl(r.feuchte, " %")}</b><span>Luftfeuchte</span><small>${r.co2 != null ? `CO₂ ${Math.round(r.co2)} ppm` : "&nbsp;"}</small></div>
        <div class="ck-kachel"><b>${u.laerm ? `${u.laerm.icon} ${u.laerm.db} dB` : "–"}</b><span>Geräusch</span><small>${u.laerm ? esc(u.laerm.stufe) : "noch nicht gemessen"}</small></div>
        <div class="ck-kachel"><b>${h.geraete ? `${h.geraete.an.length}/${h.geraete.schaltbar}` : "–"}</b><span>Geräte an</span><small>${u.wache ? (u.wache.scharf ? "🛡 Wache scharf" : "Wache aus") : "&nbsp;"}</small></div>
      </div>
      <div class="hf-karte"><h3>🌡 Umgebung</h3>
        ${u.empfehlungen.length ? `<ul class="hf-liste">${u.empfehlungen.map((e) => `<li class="hf-zeile"><span class="name">💡 ${esc(e)}</span></li>`).join("")}</ul>` : '<p class="klein">Alles im grünen Bereich.</p>'}
        ${u.haText ? `<p class="hf-hinweis">${esc(u.haText)}. Raumwerte kommen von Home-Assistant-Sensoren.</p>` : ""}
        <div class="hf-reihe"><button class="hf-btn haupt" id="ck-u-mess">🎙 Geräusch messen (3 s)</button><span class="klein" id="ck-u-erg"></span></div>
        ${u.messungen.length ? `<p class="klein">Letzte Messungen: ${u.messungen.slice(0, 6).map((m) => `${m.db} dB (${new Date(m.zeit).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })})`).join(" · ")}</p>` : ""}
        <p class="hf-hinweis">Beim Messen hört nur dieses Gerät 3 Sekunden lang auf die Lautstärke. Es wird nichts aufgenommen, nur eine Zahl gespeichert. Der Wert ist ungefähr, weil Mikrofone nicht geeicht sind.</p>
      </div>
      <div class="hf-karte"><h3>🏠 Smart Home Intelligence</h3>
        ${!h.bereit ? `<p class="hf-hinweis">${esc(h.text)}</p>` : h.fehler ? `<p class="hf-schlecht">${esc(h.fehler)}</p>` : ""}
        ${haHinweise.length ? `<h3>Hinweise</h3><ul class="hf-liste">${haHinweise.map((x) => `<li class="hf-zeile"><span class="name">${x.icon} ${esc(x.text)}</span></li>`).join("")}</ul>` : ""}
        <h3>Erkannte Gewohnheiten</h3>
        ${h.vorschlaege.length ? `<ul class="hf-liste">${h.vorschlaege.map((v) => `<li class="hf-zeile"><span class="name">${esc(v.text)}</span><button class="hf-btn haupt" data-ck-hv="${esc(v.key)}" data-ja="1">Ja, automatisch</button><button class="hf-btn leise" data-ck-hv="${esc(v.key)}">Nein</button></li>`).join("")}</ul>`
          : `<p class="klein">Noch keine. Friday schaut alle 5 Minuten, was an oder aus ist, und schlägt etwas vor, wenn sich etwas an mindestens 4 Tagen wiederholt (bisher ${h.tage} Tag${h.tage === 1 ? "" : "e"}, ${h.ereignisse} Schaltvorgänge).</p>`}
        ${h.letzte?.length ? `<h3>Zuletzt geschaltet</h3><p class="klein">${h.letzte.map((e) => `${e.an ? "🟢" : "⚫"} ${esc(e.name)} ${esc(e.zeit)}`).join(" · ")}</p>` : ""}
        ${h.sensoren?.length ? `<h3>Sensoren</h3><div class="hf-reihe">${h.sensoren.map((s) => `<span class="hf-badge">${esc(s.name)}: ${esc(s.wert)} ${esc(s.einheit)}</span>`).join("")}</div>` : ""}
        <p class="hf-hinweis">Nichts wird ohne dein „Ja“ automatisch geschaltet. Angenommene Gewohnheiten findest du unter Automationen und kannst sie dort jederzeit ausschalten. Schlösser schaltet Friday nie automatisch.</p>
      </div>`;
    el.querySelector("#ck-u-mess").addEventListener("click", async (e) => {
      const out = el.querySelector("#ck-u-erg");
      e.target.disabled = true; out.textContent = "Höre 3 Sekunden …";
      try { const db = await pegelMessen(); const r2 = await json("/api/umgebung/messung", { body: { db, geraet: /iPhone|Android/.test(navigator.userAgent) ? "Handy" : "Computer" } }); out.textContent = `${r2.messung.icon} etwa ${db} dB – ${r2.messung.stufe}`; setTimeout(() => zuhause(el), 1500); }
      catch (err) { out.textContent = err.name === "NotAllowedError" ? "Mikrofon nicht erlaubt." : err.message; }
      finally { e.target.disabled = false; }
    });
    el.querySelectorAll("[data-ck-hv]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      let text = "";
      try { const r2 = await json("/api/haus-intelligenz/vorschlag", { body: { key: b.dataset.ckHv, annehmen: b.dataset.ja === "1" } }); text = r2.text || "Vorschlag ausgeblendet."; } catch (err) { text = err.message; }
      zuhause(el, text);
    }));
  }

  async function leben(el) {
    const u = await json("/api/lebensmanager");
    const farbe = (w) => (w == null ? "" : w >= 75 ? "hf-gut" : w >= 50 ? "" : "hf-warn");
    el.innerHTML = `
      <div class="ck-l-kopf"><div class="ck-l-ring ${farbe(u.balance)}" style="--p:${u.balance ?? 0}"><b>${u.balance ?? "–"}</b><small>Balance</small></div>
        <div><h3>🧭 Lebensmanager</h3><p class="klein">Ein Überblick aus allem, was Friday schon über deinen Alltag weiß: Termine, Aufgaben, Gewohnheiten, Schlaf, Ziele, Geburtstage, Kühlschrank und (nur zum Ansehen) Finanzen.</p></div></div>
      ${u.heute.length ? `<div class="hf-karte"><h3>Heute wichtig</h3><ul class="hf-liste">${u.heute.map((x) => `<li class="hf-zeile"><span class="name">${x.icon} ${esc(x.text)}</span></li>`).join("")}</ul></div>` : ""}
      ${u.tipps.length ? `<div class="hf-karte"><h3>💡 Tipps</h3><ul class="hf-liste">${u.tipps.map((t) => `<li class="hf-zeile"><span class="name">${esc(t)}</span></li>`).join("")}</ul></div>` : ""}
      <div class="ck-l-raster">${u.bereiche.map((b) => `<div class="hf-karte ck-l-bereich"><h3>${b.icon} ${esc(b.name)}</h3>
        <p><b class="${farbe(b.wert)}">${esc(b.text)}</b>${b.wert != null ? ` <span class="klein">(${b.wert}/100)</span>` : ""}</p>
        ${b.details?.length ? `<ul class="ck-l-det">${b.details.slice(0, 6).map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}</div>`).join("")}</div>
      <p class="hf-hinweis">Per Sprache: „Friday, wie läuft mein Leben?“ Die Balance ist der Durchschnitt der Bereiche mit Daten (${u.quellen}). Friday bewegt nie Geld.</p>`;
  }

  const css = document.createElement("style");
  css.textContent = `
.ck-l-kopf { display: flex; gap: 16px; align-items: center; margin-bottom: 10px; }
.ck-l-ring { --p: 0; width: 92px; height: 92px; flex: 0 0 92px; border-radius: 50%; display: grid; place-content: center; text-align: center;
  background: radial-gradient(closest-side, var(--u-bg, #120b05) 78%, transparent 80% 100%), conic-gradient(var(--cyan) calc(var(--p) * 1%), rgba(255,255,255,.08) 0); }
.ck-l-ring.hf-gut { --cyan: #6fe39a; } .ck-l-ring.hf-warn { --cyan: #ffc46b; }
.ck-l-ring b { font-size: 26px; line-height: 1; } .ck-l-ring small { font-size: 10px; opacity: .7; text-transform: uppercase; letter-spacing: .08em; }
.ck-l-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.ck-l-bereich p { margin: 4px 0; }
.ck-l-det { margin: 4px 0 0 16px; padding: 0; font-size: 12px; opacity: .85; display: grid; gap: 2px; }
@media (max-width: 900px) { .ck-l-raster { grid-template-columns: 1fr; } .ck-l-kopf { align-items: flex-start; } }`;
  document.head.appendChild(css);

  C.reiter("zuhause", "🏠 Zuhause", (el) => zuhause(el));
  C.reiter("leben", "🧭 Leben", (el) => leben(el));
})();
