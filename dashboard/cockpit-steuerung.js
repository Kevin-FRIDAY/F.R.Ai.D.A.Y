// Gehirn-Cockpit, Reiter "🎛 Steuerung" (v1.189.0, Mark XVII):
// Universal Control nach Räumen (Home Assistant, Hue, Fernseher, Alexa), eigene Szenen + Vorschläge,
// Raum-Profile mit Wunschtemperatur, Stromverbrauch mit Grundlast, Gerätefehler. Schlösser werden nur angezeigt.
(() => {
  "use strict";
  const C = window.FridayCockpit;
  const H = window.FridayHelfer;
  if (!C || !H) return;
  const { esc, json } = H;
  const komma = (x) => String(x).replace(".", ",");
  const ICON = { light: "💡", switch: "🔌", fan: "🌀", cover: "🪟", climate: "🌡", scene: "🎬", script: "📜", lock: "🔒", media_player: "📺", vacuum: "🧹", input_boolean: "🔘" };
  let preisOffen = false;

  function geraet(g) {
    const icon = ICON[g.domain] || "•";
    if (g.fehlt) return `<li class="ck-st-g fehlt"><span>${icon} <b>${esc(g.name)}</b> <span class="klein hf-warn">nicht erreichbar</span></span></li>`;
    if (g.nurAnzeige) return `<li class="ck-st-g"><span>${icon} <b>${esc(g.name)}</b> <span class="klein">${g.status === "locked" ? "abgeschlossen" : g.status === "unlocked" ? "offen" : esc(g.status)} · nur Anzeige</span></span></li>`;
    if (g.domain === "climate") return `<li class="ck-st-g"><span>${icon} <b>${esc(g.name)}</b> <span class="klein">${g.ist != null ? `${komma(g.ist)} °C` : ""}${g.ziel != null ? ` → ${komma(g.ziel)} °C` : ""}</span></span>
      <span class="hf-reihe"><button class="hf-btn leise" data-temp="${esc(g.id)}" data-grad="${(g.ziel ?? 20) - 0.5}" aria-label="Kälter">−</button><button class="hf-btn leise" data-temp="${esc(g.id)}" data-grad="${(g.ziel ?? 20) + 0.5}" aria-label="Wärmer">＋</button></span></li>`;
    if (g.domain === "scene" || g.domain === "script") return `<li class="ck-st-g"><span>${icon} <b>${esc(g.name)}</b></span><button class="hf-btn leise" data-an="${esc(g.id)}">Start</button></li>`;
    return `<li class="ck-st-g ${g.an ? "an" : ""}"><span>${icon} <b>${esc(g.name)}</b></span><button class="ck-st-schalter ${g.an ? "an" : ""}" data-umschalten="${esc(g.id)}" data-ziel="${g.an ? "aus" : "an"}" role="switch" aria-checked="${g.an}" aria-label="${esc(g.name)} ${g.an ? "ausschalten" : "einschalten"}"><span></span></button></li>`;
  }

  function verlauf(v) {
    const w = (v || []).map((x) => x.w).filter((x) => Number.isFinite(x));
    if (w.length < 2) return "";
    const max = Math.max(...w), min = Math.min(...w), sp = Math.max(1, max - min);
    return `<svg class="ck-zw-linie" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${w.map((x, i) => `${(i / (w.length - 1)) * 100},${28 - ((x - min) / sp) * 26}`).join(" ")}" /></svg>`;
  }

  async function steuerung(el, meldung = "") {
    const d = await json("/api/zuhause");
    const u = d.universal, e = d.energie, r = d.raeume, f = d.fehler;
    const haFehlt = !u.ha.ok;
    el.innerHTML = `${meldung ? `<p class="hf-hinweis">${esc(meldung)}</p>` : ""}
      ${haFehlt ? `<div class="hf-karte"><h3>🎛 Universal Control</h3><p class="klein">${esc(u.ha.error || "Home Assistant ist nicht erreichbar.")}</p><p class="hf-hinweis">Räume, Strom und Gerätefehler brauchen Home Assistant. Fernseher, Alexa und Hue gehen auch ohne.</p></div>` : ""}
      ${f.ok && (f.offline.length || f.batterien.length) ? `<div class="hf-karte ck-st-alarm"><h3>⚠️ Gerätefehler</h3><ul class="hf-liste">${f.offline.map((o) => `<li>🔴 <b>${esc(o.name)}</b> <span class="klein">${esc(o.raum)} · nicht erreichbar${o.minuten >= 60 ? ` seit ${Math.round(o.minuten / 60)} h` : o.minuten ? ` seit ${o.minuten} Min.` : ""}</span></li>`).join("")}${f.batterien.map((b) => `<li>${b.icon} ${esc(b.text)}</li>`).join("")}</ul><p class="klein">Nach einer Stunde ohne Verbindung kommt eine Mitteilung als Text.</p></div>` : ""}
      ${u.raeume.length ? `<div class="ck-st-raster">${u.raeume.map((raum) => `<div class="hf-karte"><h3>${esc(raum.name)}</h3><ul class="hf-liste">${raum.geraete.map(geraet).join("")}</ul>
        ${raum.name !== "Sonstige" && raum.geraete.some((g) => !g.fehlt && !g.nurAnzeige && g.domain !== "climate") ? `<div class="hf-reihe"><button class="hf-btn leise" data-raumszene="${esc(raum.name)}">Als Szene speichern …</button></div>` : ""}</div>`).join("")}</div>` : ""}
      <div class="hf-karte"><h3>🎬 Meine Szenen</h3>
        ${u.szenen.length ? `<ul class="hf-liste">${u.szenen.map((s) => `<li class="ck-st-g"><span><b>${esc(s.name)}</b> <span class="klein">${s.raum ? `${esc(s.raum)} · ` : ""}${s.zustaende.filter((z) => z.an).length} an, ${s.zustaende.filter((z) => !z.an).length} aus</span></span><span class="hf-reihe"><button class="hf-btn" data-szene="${esc(s.id)}">Start</button><button class="hf-btn leise" data-szeneweg="${esc(s.id)}" aria-label="Szene löschen">✕</button></span></li>`).join("")}</ul>` : '<p class="klein">Noch keine eigene Szene. Stell Licht und Geräte so ein, wie du es magst, und speichere es.</p>'}
        ${haFehlt ? "" : `<div class="hf-reihe"><input class="hf-input" id="ck-st-name" placeholder="Name, z. B. Filmabend" maxlength="40"><button class="hf-btn haupt" id="ck-st-speichern">Jetzigen Zustand speichern</button></div>`}
        ${d.vorschlaege.length ? `<p><b>Vorschläge</b></p><ul class="hf-liste">${d.vorschlaege.map((v, i) => `<li class="ck-st-g"><span class="klein">${esc(v.text)}</span><button class="hf-btn leise" data-vorschlag="${i}">Als Szene</button></li>`).join("")}</ul>` : ""}
        <p class="hf-hinweis">Sag: „Friday, speicher das als Szene Filmabend“ und später „Friday, Szene Filmabend“.</p>
      </div>
      <div class="ck-st-raster">
        <div class="hf-karte"><h3>⚡ Strom</h3>
          ${!e.ok ? `<p class="klein">${esc(e.error)}</p>` : !e.sensoren.leistung && !e.sensoren.zaehler ? '<p class="klein">In Home Assistant gibt es noch keine Strom-Sensoren. Eine Mess-Steckdose (z. B. Shelly, ab ca. 15 €) oder ein Lesekopf am Zähler liefert die Werte.</p>' : `
            <p><b>${e.jetztWatt} Watt</b> gerade${e.hausZaehler ? " <span class=\"klein\">(Hauszähler)</span>" : ""}</p>${verlauf(e.verlauf)}
            ${e.heuteKwh != null ? `<p class="klein">Heute: ${komma(e.heuteKwh)} kWh · etwa ${komma(e.heuteEuro)} €</p>` : '<p class="klein">Tageswerte gibt es ab morgen.</p>'}
            ${e.grundlastWatt != null ? `<p class="klein">Grundlast (Standby): ${e.grundlastWatt} Watt · im Jahr etwa ${e.standbyEuroJahr} €</p>` : '<p class="klein">Grundlast nach ein paar Stunden Messung.</p>'}
            ${e.verbraucher.length ? `<p class="klein">Größte Verbraucher</p><ul class="ck-zw-mini">${e.verbraucher.slice(0, 8).map((v) => `<li>${esc(v.name)} <b>${v.watt} W</b></li>`).join("")}</ul>` : ""}
            ${e.tipps.length ? `<ul class="hf-liste">${e.tipps.map((t) => `<li class="klein">💡 ${esc(t)}</li>`).join("")}</ul>` : ""}`}
          ${e.ok ? `<p class="klein">Strompreis: ${komma(e.preisCent)} Cent/kWh ${preisOffen ? `<input class="hf-input" id="ck-st-preis" type="number" min="5" max="150" step="0.5" value="${e.preisCent}" style="width:80px"><button class="hf-btn leise" id="ck-st-preis-ok">OK</button>` : '<button class="hf-btn leise" id="ck-st-preis-aendern">ändern</button>'}</p>` : ""}
        </div>
        <div class="hf-karte"><h3>🛋 Raum-Profile</h3>
          ${!r.ok ? `<p class="klein">${esc(r.error)}</p>` : r.raeume.length ? `<ul class="hf-liste">${r.raeume.map((x) => `<li class="ck-st-raum ${x.stufe}"><div class="hf-zeile"><span class="name"><b>${esc(x.name)}</b> <span class="klein">${[x.temperatur != null ? `${komma(x.temperatur)} °C` : "", x.feuchte != null ? `${x.feuchte} %` : "", x.co2 != null ? `${x.co2} ppm CO₂` : "", x.lichter ? `${x.lichterAn}/${x.lichter} Lichter an` : ""].filter(Boolean).join(" · ")}</span></span>
            <span class="hf-reihe klein">Wunsch <input class="hf-input" type="number" min="10" max="28" step="0.5" value="${x.wunsch}" data-wunsch="${esc(x.name)}" style="width:68px" aria-label="Wunschtemperatur ${esc(x.name)}"> °C</span></div>
            ${x.tipps.map((t) => `<p class="klein">${t.icon} ${esc(t.text)}${t.heizen ? ` <button class="hf-btn leise" data-temp="${esc(t.heizen.id)}" data-grad="${t.heizen.grad}">Auf ${komma(t.heizen.grad)} °C</button>` : ""}</p>`).join("")}</li>`).join("")}</ul>` : '<p class="klein">Keine Raum-Sensoren gefunden.</p>'}
          <p class="hf-hinweis">Räume erkennt Friday am Gerätenamen (z. B. „Schlafzimmer Licht“).</p>
        </div>
      </div>
      ${u.tv.bereit || u.alexa.bereit || u.hue.bereit ? `<div class="hf-karte"><h3>📡 Weitere Systeme</h3>
        ${u.tv.bereit ? `<p><b>📺 ${esc(u.tv.name)}</b> <span class="klein">${u.tv.erreichbar ? "erreichbar" : "nicht erreichbar"}</span></p><div class="hf-reihe">${[["an", "⏻ An"], ["aus", "⏼ Aus"], ["lauter", "🔊 Lauter"], ["leiser", "🔉 Leiser"], ["stumm", "🔇 Stumm"]].map(([a, t]) => `<button class="hf-btn leise" data-tv="${a}">${t}</button>`).join("")}</div>` : ""}
        ${u.hue.bereit && u.hue.raeume?.length ? `<p><b>💡 Hue</b></p><div class="hf-reihe">${u.hue.raeume.map((x) => `<span class="hf-badge">${esc(x)} <button class="hf-btn leise" data-hue="${esc(x)}" data-ziel="an">an</button><button class="hf-btn leise" data-hue="${esc(x)}" data-ziel="aus">aus</button></span>`).join("")}</div>` : ""}
        ${u.alexa.bereit && u.alexa.routinen.length ? `<p><b>🗣 Alexa-Routinen</b></p><div class="hf-reihe">${u.alexa.routinen.map((x) => `<button class="hf-btn leise" data-alexa="${esc(x)}">${esc(x)}</button>`).join("")}</div>` : ""}
      </div>` : ""}
      <p class="hf-hinweis">🔒 Schlösser zeigt Friday nur an und schaltet sie nie. ${u.mac ? "💻 Mac verbunden." : "💻 Mac-Agent nicht verbunden."}</p>`;

    const knopf = (sel, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener("click", async () => {
      x.disabled = true;
      let text = "";
      try { const res = await fn(x); text = res?.text || res?.error || ""; } catch (err) { text = err.message; }
      steuerung(el, text);
    }));
    const st = (body) => json("/api/zuhause/steuern", { body });
    knopf("[data-umschalten]", (x) => st({ system: "ha", id: x.dataset.umschalten, aktion: x.dataset.ziel }));
    knopf("[data-an]", (x) => st({ system: "ha", id: x.dataset.an, aktion: "an" }));
    knopf("[data-temp]", (x) => st({ system: "ha", id: x.dataset.temp, aktion: "temperatur", wert: Number(x.dataset.grad) }));
    knopf("[data-tv]", (x) => st({ system: "tv", aktion: x.dataset.tv }));
    knopf("[data-hue]", (x) => st({ system: "hue", id: x.dataset.hue, aktion: x.dataset.ziel }));
    knopf("[data-alexa]", (x) => st({ system: "alexa", id: x.dataset.alexa }));
    knopf("[data-szene]", (x) => json(`/api/zuhause/szene/${encodeURIComponent(x.dataset.szene)}/start`, { body: {} }));
    knopf("[data-szeneweg]", (x) => json(`/api/zuhause/szene/${encodeURIComponent(x.dataset.szeneweg)}`, { method: "DELETE" }));
    knopf("[data-vorschlag]", (x) => { const v = d.vorschlaege[Number(x.dataset.vorschlag)]; return json("/api/zuhause/szene", { body: { ids: v.ids, name: "" } }); });
    el.querySelectorAll("[data-raumszene]").forEach((x) => x.addEventListener("click", () => {
      const feld = el.querySelector("#ck-st-name");
      if (!feld) return;
      feld.value = `${x.dataset.raumszene} `;
      feld.dataset.raum = x.dataset.raumszene;
      feld.focus();
    }));
    const feld = el.querySelector("#ck-st-name");
    if (feld) {
      const sp = el.querySelector("#ck-st-speichern");
      const neu = sp.cloneNode(true); sp.replaceWith(neu);
      neu.addEventListener("click", async () => {
        neu.disabled = true;
        let text = "";
        try { const res = await json("/api/zuhause/szene", { body: { name: feld.value.trim(), raum: feld.dataset.raum || "" } }); text = res.text || res.error || ""; } catch (err) { text = err.message; }
        steuerung(el, text);
      });
    }
    el.querySelector("#ck-st-preis-aendern")?.addEventListener("click", () => { preisOffen = true; steuerung(el); });
    knopf("#ck-st-preis-ok", () => { preisOffen = false; return json("/api/zuhause/preis", { body: { cent: Number(el.querySelector("#ck-st-preis").value) } }); });
    el.querySelectorAll("[data-wunsch]").forEach((x) => x.addEventListener("change", async () => {
      let text = "";
      try { const res = await json("/api/zuhause/wunsch", { body: { raum: x.dataset.wunsch, grad: Number(x.value) } }); text = res.text || res.error || ""; } catch (err) { text = err.message; }
      steuerung(el, text);
    }));
  }

  const css = document.createElement("style");
  css.textContent = `
.ck-st-raster { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
.ck-st-g { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,.06); overflow-wrap: anywhere; }
.ck-st-g.fehlt { opacity: .75; }
.ck-st-schalter { flex: 0 0 auto; width: 46px; height: 26px; border-radius: 13px; border: 1px solid rgba(255,255,255,.25); background: rgba(255,255,255,.08); position: relative; cursor: pointer; padding: 0; }
.ck-st-schalter span { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #bbb; transition: left .18s, background .18s; }
.ck-st-schalter.an { background: color-mix(in srgb, var(--cyan) 35%, transparent); border-color: var(--cyan); box-shadow: 0 0 10px color-mix(in srgb, var(--cyan) 45%, transparent); }
.ck-st-schalter.an span { left: 23px; background: var(--cyan); }
.ck-st-alarm { border-left: 3px solid #ff4d4d; }
.ck-st-raum { list-style: none; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
.ck-st-raum.hinweis { border-left: 2px solid #ffb020; padding-left: 8px; }
@media (max-width: 900px) { .ck-st-raster { grid-template-columns: 1fr; } }`;
  document.head.appendChild(css);

  C.reiter("steuerung", "🎛 Steuerung", (el) => steuerung(el));
})();
