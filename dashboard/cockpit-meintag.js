// Gehirn-Cockpit, Reiter "🗓 Mein Tag" (v1.190.0, Mark XVII):
// Tagesplanung (Termine fest, Aufgaben nach Priorität in die Lücken, Pausen), Zeitfresser (nur eigener Mac),
// Ziele auf Kurs mit Etappen pro Quartal, Wissen aufräumen (fast gleiche Einträge nur mit Freigabe).
(() => {
  "use strict";
  const C = window.FridayCockpit;
  const H = window.FridayHelfer;
  if (!C || !H) return;
  const { esc, json } = H;
  const dauer = (m) => (m >= 60 ? `${Math.floor(m / 60)} Std.${m % 60 ? ` ${m % 60} Min.` : ""}` : `${m} Min.`);
  const datum = (k) => { try { return new Date(`${k}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" }); } catch { return k; } };
  const STATUS = { kurs: ["🟢", "auf Kurs"], hinterher: ["🟠", "hinterher"], ueberfaellig: ["🔴", "Frist vorbei"], ohne: ["⚪", "ohne Frist"], fertig: ["✅", "geschafft"] };
  let zeitOffen = false;

  async function meintag(el, meldung = "") {
    const d = await json("/api/meintag");
    const p = d.plan, z = d.zeit, zi = d.ziele, w = d.wissen;
    const maxMin = Math.max(1, ...z.woche.map((x) => x.min));
    el.innerHTML = `${meldung ? `<p class="hf-hinweis">${esc(meldung)}</p>` : ""}
      <div class="hf-karte"><h3>🗓 Plan für ${p.morgen ? "morgen, " : "heute, "}${esc(datum(p.datum))}</h3>
        ${p.ganztags.length ? `<p class="klein">Ganztägig: ${p.ganztags.map(esc).join(", ")}</p>` : ""}
        ${p.bloecke.length ? `<ol class="ck-mt-plan">${p.bloecke.map((b) => `<li class="${b.art}${b.prio === 1 ? " wichtig" : ""}"><span class="zeit">${b.vonText}–${b.bisText}</span><span class="was">${b.art === "termin" ? "📅 " : b.art === "pause" ? "☕ " : b.prio === 1 ? "❗ " : ""}${esc(b.text)}${b.quelle ? ` <span class="klein">${esc(b.quelle)}</span>` : ""}</span></li>`).join("")}</ol>` : '<p class="klein">Nichts zu planen. Ein freier Tag.</p>'}
        ${p.uebrig.length ? `<p class="klein">Passt nicht mehr rein: ${p.uebrig.slice(0, 5).map((x) => esc(x.text)).join(" · ")}</p>` : ""}
        ${!p.kalender.ok ? `<p class="klein hf-warn">📅 ${esc(p.kalender.hinweis)} Termine fehlen darum im Plan.</p>` : ""}
        <div class="hf-reihe klein">Planen von <input class="hf-input" id="ck-mt-von" type="number" min="5" max="12" value="${p.von}" style="width:62px"> bis <input class="hf-input" id="ck-mt-bis" type="number" min="13" max="23" value="${p.bis}" style="width:62px"> Uhr <button class="hf-btn leise" id="ck-mt-zeit">Speichern</button></div>
        <p class="hf-hinweis">Termine bleiben fest. In die Lücken kommen deine wichtigsten Aufgaben, Ziel-Schritte und Erinnerungen, nach 90 Minuten eine Pause. Nach Feierabend plant Friday den nächsten Tag. Sag: „Friday, plane meinen Tag“.</p>
      </div>
      <div class="hf-karte"><h3>⏳ Zeitfresser</h3>
        ${!z.mac && !z.wocheMin ? '<p class="klein">Läuft nur auf deinem Mac. Dort schaut Friday alle 5 Minuten, welches Programm vorne ist.</p>' : !z.wocheMin ? '<p class="klein">Noch keine Werte. Nach ein paar Stunden am Mac weiß Friday mehr.</p>' : `
          <p><b>Heute ${dauer(z.heuteMin)}</b> am Mac, davon <b class="${z.heuteAblenkung >= 120 ? "hf-warn" : ""}">${dauer(z.heuteAblenkung)} Ablenkung</b> · Woche (${z.tage} Tage): ${dauer(z.wocheMin)}, Ablenkung ${dauer(z.wocheAblenkung)}</p>
          <ul class="ck-mt-apps">${z.woche.map((a) => `<li><span class="name">${a.ablenkung ? "🍿" : "💼"} ${esc(a.app)}</span><span class="ck-mt-bar"><span class="${a.ablenkung ? "abl" : ""}" style="width:${Math.round((a.min / maxMin) * 100)}%"></span></span><span class="klein">${dauer(a.min)}</span>${zeitOffen ? `<button class="hf-btn leise" data-app="${esc(a.app)}" data-abl="${a.ablenkung ? "0" : "1"}">${a.ablenkung ? "Kein Zeitfresser" : "Ist Zeitfresser"}</button>` : ""}</li>`).join("")}</ul>
          ${z.tipps.map((t) => `<p class="klein">💡 ${esc(t)}</p>`).join("")}
          <div class="hf-reihe"><button class="hf-btn leise" id="ck-mt-einordnen">${zeitOffen ? "Fertig" : "Programme einordnen …"}</button></div>`}
        ${z.liegen.length ? `<p class="klein"><b>Liegt lange:</b> ${z.liegen.map((x) => `${esc(x.text)} (${x.tage} Tage)`).join(" · ")}</p>` : ""}
        <div class="hf-reihe"><button class="hf-btn leise" id="ck-mt-messen">${z.an ? "Messung ausschalten" : "Messung einschalten"}</button>${z.wocheMin ? '<button class="hf-btn leise" id="ck-mt-loeschen">Werte löschen</button>' : ""}</div>
        <p class="hf-hinweis">Nur dein eigener Mac und nur der Programmname. Keine Fenstertitel, keine Webseiten, nichts verlässt den Mac. Ruht der Mac, zählt nichts.</p>
      </div>
      <div class="hf-karte"><h3>🎯 Ziele auf Kurs</h3>
        ${zi.ok && zi.ziele.length ? `<ul class="hf-liste">${zi.ziele.map((g) => `<li class="ck-mt-ziel"><div class="hf-zeile"><span class="name">${STATUS[g.status][0]} <b>${esc(g.titel)}</b> <span class="klein">${STATUS[g.status][1]}${g.frist ? ` · Frist ${esc(g.frist)}` : ""}</span></span><b>${g.ist} %</b></div>
          <div class="ck-mt-kurs" aria-label="${g.ist} % geschafft${g.soll != null ? `, ${g.soll} % der Zeit vorbei` : ""}"><span style="width:${g.ist}%" class="${g.status}"></span>${g.soll != null && g.status !== "fertig" ? `<i style="left:${g.soll}%" title="${g.soll} % der Zeit vorbei"></i>` : ""}</div>
          <p class="klein">${esc(g.text)}${g.naechster ? ` Nächster Schritt: ${esc(g.naechster)}` : ""}</p>
          ${g.etappen.length > 1 || (g.etappen[0] && g.etappen[0].schritte.length > 1) ? `<p class="klein">${g.etappen.map((e) => `<b>${esc(e.quartal)}:</b> ${e.schritte.map(esc).join(", ")}`).join(" · ")}</p>` : ""}</li>`).join("")}</ul>` : `<p class="klein">${esc(zi.error || "Noch keine Ziele. Leg eins im Reiter 🧠 Denken an, Friday plant die Schritte.")}</p>`}
        <p class="hf-hinweis">Der Strich zeigt, wie viel Zeit bis zur Frist schon vorbei ist. Offene Schritte verteilt Friday gleichmäßig auf die Quartale bis zur Frist. Fristen wie „Ende 2026“, „Q3 2027“ oder „30.06.2027“ gehen.</p>
      </div>
      <div class="hf-karte"><h3>🧹 Wissen aufräumen</h3>
        ${w.ok ? `<p class="klein">${w.anzahl} Einträge im Gedächtnis: ${w.schubladen.map((s) => `${esc(s.name)} ${s.n}`).join(" · ")}</p>
          ${w.exaktDoppelt ? `<p class="klein">${w.exaktDoppelt} genau gleiche Einträge.</p>` : ""}
          ${w.paare.length ? `<p><b>Fast gleich</b></p><ul class="hf-liste">${w.paare.map((x) => `<li class="ck-mt-paar"><span class="klein">${x.prozent} % gleich</span><br>✅ ${esc(x.behalten.text)}<br>✖️ <s>${esc(x.weg.text)}</s><div class="hf-reihe"><button class="hf-btn leise" data-behalten="${esc(x.behalten.id)}" data-weg="${esc(x.weg.id)}">Zusammenführen</button></div></li>`).join("")}</ul>` : '<p class="klein">🟢 Keine fast gleichen Einträge gefunden.</p>'}
          <div class="hf-reihe"><button class="hf-btn" id="ck-mt-pflege">Genau gleiche entfernen und einsortieren</button></div>` : `<p class="klein">${esc(w.error)}</p>`}
        <p class="hf-hinweis">Fast gleiche Einträge führt Friday nur zusammen, wenn du tippst. Der längere bleibt.</p>
      </div>`;

    const knopf = (sel, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener("click", async () => {
      x.disabled = true;
      let text = "";
      try { const r = await fn(x); text = r?.text || r?.error || ""; } catch (err) { text = err.message; }
      meintag(el, text);
    }));
    knopf("#ck-mt-zeit", () => json("/api/meintag/arbeitszeit", { body: { von: Number(el.querySelector("#ck-mt-von").value), bis: Number(el.querySelector("#ck-mt-bis").value) } }));
    knopf("[data-app]", (x) => json("/api/meintag/app", { body: { app: x.dataset.app, ablenkung: x.dataset.abl === "1" } }));
    knopf("#ck-mt-messen", () => json("/api/meintag/zeit", { body: { an: !z.an } }));
    knopf("#ck-mt-loeschen", () => json("/api/meintag/zeit", { body: { loeschen: true } }));
    knopf("[data-behalten]", (x) => json("/api/meintag/wissen", { body: { behalten: x.dataset.behalten, weg: x.dataset.weg } }));
    knopf("#ck-mt-pflege", async () => { const r = await json("/api/meintag/wissen", { body: {} }); return { text: `${r.exakt?.doppelt || 0} doppelte entfernt, ${r.exakt?.einsortiert || 0} einsortiert.` }; });
    el.querySelector("#ck-mt-einordnen")?.addEventListener("click", () => { zeitOffen = !zeitOffen; meintag(el); });
  }

  const css = document.createElement("style");
  css.textContent = `
.ck-mt-plan { list-style: none; padding: 0; margin: 6px 0; display: grid; gap: 4px; }
.ck-mt-plan li { display: grid; grid-template-columns: 96px 1fr; gap: 8px; padding: 6px 8px; border-radius: 8px; background: rgba(255,255,255,.04); border-left: 3px solid var(--cyan); overflow-wrap: anywhere; }
.ck-mt-plan li.termin { border-left-color: #6aa8ff; background: rgba(106,168,255,.08); }
.ck-mt-plan li.pause { border-left-color: rgba(255,255,255,.2); opacity: .7; }
.ck-mt-plan li.wichtig { border-left-color: #ff4d4d; }
.ck-mt-plan .zeit { font-variant-numeric: tabular-nums; opacity: .85; }
.ck-mt-apps { list-style: none; padding: 0; margin: 6px 0; display: grid; gap: 4px; }
.ck-mt-apps li { display: grid; grid-template-columns: minmax(90px, 160px) 1fr auto auto; align-items: center; gap: 8px; font-size: 13px; }
.ck-mt-apps .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ck-mt-bar { height: 8px; border-radius: 4px; background: rgba(255,255,255,.08); overflow: hidden; }
.ck-mt-bar span { display: block; height: 100%; background: var(--cyan); }
.ck-mt-bar span.abl { background: #ff7a45; }
.ck-mt-ziel { list-style: none; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
.ck-mt-kurs { position: relative; height: 8px; border-radius: 4px; background: rgba(255,255,255,.08); margin: 4px 0; }
.ck-mt-kurs span { display: block; height: 100%; border-radius: 4px; background: #3ecf6e; }
.ck-mt-kurs span.hinterher, .ck-mt-kurs span.ueberfaellig { background: #ffb020; }
.ck-mt-kurs span.fertig { background: #3ecf6e; }
.ck-mt-kurs i { position: absolute; top: -3px; width: 2px; height: 14px; background: #fff; box-shadow: 0 0 6px #fff; }
.ck-mt-paar { list-style: none; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,.06); overflow-wrap: anywhere; }
@media (max-width: 900px) { .ck-mt-plan li { grid-template-columns: 78px 1fr; } .ck-mt-apps li { grid-template-columns: 90px 1fr auto; } .ck-mt-apps li .hf-btn { grid-column: 1 / -1; justify-self: start; } }`;
  document.head.appendChild(css);

  C.reiter("meintag", "🗓 Mein Tag", (el) => meintag(el));
})();
