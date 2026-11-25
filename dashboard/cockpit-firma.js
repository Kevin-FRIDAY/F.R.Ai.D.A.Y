// Gehirn-Cockpit, Reiter "🏢 Firma" und "📁 Projekte" (v1.185.0, Mark XIV):
// 12 Abteilungen mit Leitungs-Agent und Bericht, Pinnwand, CEO-Verteilung mit Angeboten, Schattenmodus,
// Projektmanager (Meilensteine, Aufgaben, Autopilot, Berichte), Prioritäten mit Punktzahl, Automations-Designer.
(() => {
  "use strict";
  const C = window.FridayCockpit;
  const H = window.FridayHelfer;
  if (!C || !H) return;
  const { esc, json } = H;
  const zeit = (iso) => { try { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  const datum = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : "");
  const FARBE = { gut: "hf-gut", hinweis: "hf-warn", problem: "hf-schlecht" };
  const ICON = { gut: "🟢", hinweis: "🟡", problem: "🔴" };
  let verteilung = null, verteilAuftrag = "", entwurf = null, entwurfSatz = "", offenesProjekt = null;

  async function firma(el, meldung = "") {
    const d = await json("/api/firma");
    const s = d.schattenmodus;
    el.innerHTML = `${meldung ? `<p class="hf-hinweis">${esc(meldung)}</p>` : ""}
      <div class="hf-karte ck-fi-ceo"><h3>👑 CEO-Agentin</h3>
        <p class="${FARBE[d.abteilungen[0].bericht.stufe]}">${ICON[d.abteilungen[0].bericht.stufe]} ${esc(d.abteilungen[0].bericht.text)}</p>
        <div class="hf-reihe"><input class="hf-input grow" id="ck-fi-auftrag" value="${esc(verteilAuftrag)}" placeholder="Auftrag ans Team, z. B. Wetter und Pollen fürs Grillen am Samstag" maxlength="400"><button class="hf-btn leise" id="ck-fi-ang">Angebote ansehen</button><button class="hf-btn haupt" id="ck-fi-los">Verteilen</button></div>
        ${verteilung ? verteilHtml(verteilung) : ""}
        <p class="hf-hinweis">Die CEO-Agentin zerlegt den Auftrag ohne KI. Für jeden Schritt bieten die passenden Agenten: Passung, Erfolgsquote laut Kontroll-Agent, Tempo. Pausierte Agenten bieten nicht mit.</p>
      </div>
      <div class="ck-fi-raster">${d.abteilungen.slice(1).map((a) => `
        <div class="hf-karte ck-fi-abt"><div class="ck-fi-kopf"><b>${esc(a.emoji)} ${esc(a.name)}</b><span class="ck-fi-zahl ${FARBE[a.bericht.stufe] || ""}">${esc(String(a.bericht.zahl ?? ""))}<small>${esc(a.bericht.zahlText || "")}</small></span></div>
          <p class="klein">${esc(a.leitung)} · ${esc(a.auftrag)}</p>
          <p>${ICON[a.bericht.stufe] || ""} ${esc(a.bericht.text)}</p>
          ${a.team.length ? `<p class="klein ck-fi-team">${a.team.map((t) => `<span title="${t.einsaetze} Einsätze">${esc(t.emoji)} ${esc(t.name.replace(/-Agent$/, ""))}${t.quote != null ? ` ${t.quote} %` : ""}</span>`).join("")}</p>` : ""}
          ${a.pins.length ? `<p class="klein">📌 ${esc(a.pins[0].text)}</p>` : ""}
        </div>`).join("")}
      </div>
      <div class="hf-karte"><h3>📌 Pinnwand der Agenten</h3>
        <div class="hf-reihe"><input class="hf-input grow" id="ck-fi-pin" placeholder="Zettel fürs Team …" maxlength="300"><button class="hf-btn" id="ck-fi-pinlos">Anheften</button></div>
        ${d.pinnwand.length ? `<ul class="hf-liste">${d.pinnwand.slice(0, 15).map((p) => `<li class="hf-zeile"><span class="name">${p.wichtig ? "❗" : "📌"} <b>${esc(p.von || "")}</b> ${esc(p.text)}</span><span class="klein">${zeit(p.at)}</span></li>`).join("")}</ul>` : '<p class="klein">Noch keine Zettel. Ergebnisse und Warnungen der Agenten landen hier automatisch.</p>'}
      </div>
      <div class="hf-karte"><h3>👁 Schattenmodus</h3>
        <p>${s.an ? `<b class="hf-warn">An</b> seit ${zeit(s.seit)}. Geplante Automationen, die CEO-Verteilung und der Projekt-Autopilot werden nur aufgeschrieben.` : "Aus. Friday führt Automationen normal aus."}</p>
        <div class="hf-reihe"><button class="hf-btn ${s.an ? "" : "haupt"}" id="ck-fi-schatten">${s.an ? "Schattenmodus beenden" : "Schattenmodus starten"}</button>${s.notizen.length ? '<button class="hf-btn leise" id="ck-fi-sleer">Notizen leeren</button>' : ""}</div>
        ${s.notizen.length ? `<ul class="hf-liste">${s.notizen.slice(0, 12).map((n) => `<li class="hf-zeile"><span class="name">👁 <b>${esc(n.wer)}</b> würde ${esc(n.was)}</span><span class="klein">${zeit(n.at)}</span></li>`).join("")}</ul>` : ""}
        <p class="hf-hinweis">Gut zum Ausprobieren: Ein paar Tage zuschauen lassen, dann entscheiden, was Friday selbst machen darf. Was du direkt verlangst, läuft immer.</p>
      </div>`;
    const knopf = (sel, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener("click", async () => {
      x.disabled = true;
      let text = "";
      try { const r = await fn(x); text = r?.text || r?.error || ""; } catch (err) { text = err.message; }
      firma(el, text);
    }));
    knopf("#ck-fi-ang", async () => { verteilAuftrag = el.querySelector("#ck-fi-auftrag").value; const r = await json("/api/firma/angebote", { body: { auftrag: verteilAuftrag } }); verteilung = { nurAngebote: true, zuteilung: r.schritte.map((x) => ({ schritt: x.schritt, angebote: x.angebote, gewinner: x.angebote.find((a) => !a.pausiert) })) }; return r.schritte.length ? {} : { text: "Dafür habe ich keinen passenden Agenten." }; });
    knopf("#ck-fi-los", async (x) => { x.textContent = "Das Team arbeitet …"; verteilAuftrag = el.querySelector("#ck-fi-auftrag").value; verteilung = await json("/api/firma/verteilen", { body: { auftrag: verteilAuftrag } }); return verteilung.error ? { text: verteilung.error } : {}; });
    knopf("#ck-fi-pinlos", () => json("/api/firma/pinnwand", { body: { text: el.querySelector("#ck-fi-pin").value } }));
    knopf("#ck-fi-schatten", () => json("/api/firma/schatten", { body: { an: !s.an } }));
    knopf("#ck-fi-sleer", () => json("/api/firma/schatten", { body: { leeren: true } }));
  }

  function verteilHtml(v) {
    if (v.error) return `<p class="hf-ergebnis">⚠️ ${esc(v.error)}</p>`;
    return `<div class="ck-fi-vert">${v.zuteilung.map((z, i) => {
      const e = v.ergebnisse?.[i];
      return `<div class="ck-fi-schritt"><b>${esc(z.schritt)}</b>
        <div class="ck-fi-ang">${z.angebote.map((a) => `<span class="${z.gewinner && a.id === z.gewinner.id ? "sieger" : ""} ${a.pausiert ? "aus" : ""}">${z.gewinner && a.id === z.gewinner.id ? "🏆 " : ""}${esc(a.name)} <i>${a.punkte}</i><small>${esc(a.grund)}</small></span>`).join("")}</div>
        ${e ? `<p class="klein ${e.ok ? "" : "hf-warn"}">${e.schatten ? "👁 " : e.ok ? "✅ " : "⚠️ "}${esc(e.text).replace(/\n/g, "<br>")}</p>` : ""}</div>`;
    }).join("")}</div>`;
  }

  async function projekte(el, meldung = "") {
    const [d, p] = await Promise.all([json("/api/firma/projekte"), json("/api/firma/prioritaeten")]);
    if (offenesProjekt && !d.projekte.some((x) => x.id === offenesProjekt)) offenesProjekt = null;
    el.innerHTML = `${meldung ? `<p class="hf-hinweis">${esc(meldung)}</p>` : ""}
      <div class="hf-karte"><h3>📁 Projektmanager</h3>
        <div class="hf-reihe"><input class="hf-input grow" id="ck-pj-neu" placeholder="Neues Projekt, z. B. Gartenhaus bauen" maxlength="60"><button class="hf-btn haupt" id="ck-pj-anlegen">Anlegen</button><button class="hf-btn leise" id="ck-pj-bericht">Berichte schreiben</button></div>
        ${d.projekte.length ? d.projekte.map((x) => projektHtml(x)).join("") : '<p class="klein">Noch keine Projekte. Projekte aus dem Projektgedächtnis erscheinen hier auch.</p>'}
        <p class="hf-hinweis">Autopilot: Alle 2 Stunden bereiten Agenten offene Aufgaben vor, die sie ohne KI erledigen können (Wetter, Verkehr, Recherche …). Das Ergebnis hängt an der Aufgabe, abhaken tust du. Täglich 18 Uhr ein Bericht, sonntags eine Mitteilung (nur Text).</p>
      </div>
      <div class="hf-karte"><h3>🎯 Was zuerst? Prioritäten mit Punktzahl</h3>
        ${p.liste.length ? `<ul class="hf-liste">${p.liste.slice(0, 10).map((x) => `<li class="hf-zeile"><span class="ck-fi-punkte ${x.punkte >= 70 ? "hf-schlecht" : x.punkte >= 45 ? "hf-warn" : ""}">${x.punkte}</span><span class="name">${esc(x.text)}<br><span class="klein">${esc(x.quelle)} · ${esc(x.gruende.join(" · "))}</span></span></li>`).join("")}</ul>` : '<p class="klein">Nichts offen. Freie Bahn.</p>'}
        <p class="hf-hinweis">Punkte: Wichtigkeit bis 50, Frist bis 35, kleiner Aufwand bis 9, lange liegend 5. Gilt für Aufgaben, Ziel-Schritte, Erinnerungen und Projekt-Aufgaben.</p>
      </div>
      <div class="hf-karte"><h3>🛠 Automations-Designer</h3>
        <div class="hf-reihe"><input class="hf-input grow" id="ck-pj-satz" value="${esc(entwurfSatz)}" placeholder="z. B. Werktags um 7 schick mir die Verkehrslage auf der A3" maxlength="300"><button class="hf-btn haupt" id="ck-pj-entwurf">Vorschlag machen</button></div>
        ${entwurf ? entwurf.error ? `<p class="hf-ergebnis">⚠️ ${esc(entwurf.error)}</p>` : `<p class="hf-ergebnis">⚙️ <b>${esc(entwurf.beschreibung)}</b><br><span class="klein">Name: ${esc(entwurf.regel.name)}</span></p>${entwurf.hinweise.map((h) => `<p class="klein">ℹ️ ${esc(h)}</p>`).join("")}<div class="hf-reihe"><button class="hf-btn haupt" id="ck-pj-ok">✓ So übernehmen</button><button class="hf-btn leise" id="ck-pj-nein">Verwerfen</button></div>` : ""}
        <p class="hf-hinweis">Friday versteht Zeiten (jeden Morgen um 7, werktags, sonntags, alle 2 Stunden, beim Start) und Aktionen (Agent, Erinnerung, Aufgabe, Mission, sonst Friday selbst). Gespeichert wird erst nach deinem OK.</p>
      </div>`;
    const knopf = (sel, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener("click", async () => {
      x.disabled = true;
      let text = "";
      try { const r = await fn(x); text = r?.text || r?.error || ""; } catch (err) { text = err.message; }
      projekte(el, text);
    }));
    const aendern = (id, body) => json(`/api/firma/projekte/${encodeURIComponent(id)}`, { body });
    knopf("#ck-pj-anlegen", async () => { const r = await aendern("neu", { neu: el.querySelector("#ck-pj-neu").value }); if (r.projekt) offenesProjekt = r.projekt.id; return r; });
    knopf("#ck-pj-bericht", async () => { const r = await json("/api/firma/projekte-bericht", { body: {} }); return { text: r.berichte.length ? "Berichte geschrieben." : "Keine Projekte mit Aufgaben." }; });
    knopf("[data-pj-auf]", async (x) => { offenesProjekt = offenesProjekt === x.dataset.pjAuf ? null : x.dataset.pjAuf; return {}; });
    knopf("[data-pj-ms]", (x) => aendern(x.dataset.pjMs, { meilenstein: el.querySelector(`#ck-pj-ms-${x.dataset.pjMs}`).value, frist: el.querySelector(`#ck-pj-msf-${x.dataset.pjMs}`).value }));
    knopf("[data-pj-neu]", (x) => { const id = x.dataset.pjNeu, q = (s) => el.querySelector(`#ck-pj-${s}-${id}`)?.value; return aendern(id, { aufgabe: q("a"), frist: q("af"), wichtig: q("aw"), aufwand: q("aa"), zuMeilenstein: q("am") }); });
    knopf("[data-pj-hak]", (x) => aendern(x.dataset.pjP, { abhaken: x.dataset.pjHak }));
    knopf("[data-pj-weg]", (x) => aendern(x.dataset.pjP, { aufgabeWeg: x.dataset.pjWeg }));
    knopf("[data-pj-auto]", (x) => aendern(x.dataset.pjAuto, { autopilot: x.dataset.an !== "1" }));
    knopf("[data-pj-fertig]", (x) => aendern(x.dataset.pjFertig, { status: "fertig" }));
    knopf("[data-pj-jetzt]", async () => { const r = await json("/api/firma/autopilot", { body: {} }); return { text: r.erledigt.length ? r.erledigt.join(" · ") : "Nichts, was ein Agent vorbereiten kann. Aufgaben wie „Wetter fürs Wochenende prüfen“ oder „über Holzarten recherchieren“ gehen." }; });
    knopf("#ck-pj-entwurf", async () => { entwurfSatz = el.querySelector("#ck-pj-satz").value; entwurf = await json("/api/firma/automation-entwurf", { body: { satz: entwurfSatz } }); return {}; });
    knopf("#ck-pj-ok", async () => { const r = await json("/api/firma/automation", { body: { regel: entwurf.regel } }); if (r.ok) { entwurf = null; entwurfSatz = ""; } return { text: r.error || `Automation „${r.regel.name}“ ist aktiv. Du findest sie unter Automationen.` }; });
    knopf("#ck-pj-nein", async () => { entwurf = null; return {}; });
  }

  function projektHtml(x) {
    const offen = offenesProjekt === x.id;
    const ms = new Map(x.meilensteine.map((m) => [m.id, m]));
    return `<div class="ck-pj ${x.status === "fertig" ? "fertig" : ""}">
      <div class="ck-pj-kopf" data-pj-auf="${esc(x.id)}" role="button"><b>${x.status === "fertig" ? "✅" : x.aktiv ? "▶" : "📁"} ${esc(x.name)}</b><span class="ck-dk-bar"><i style="width:${x.fortschritt}%"></i></span><span>${x.fortschritt} %</span>${x.ueberfaellig ? `<span class="hf-schlecht klein">${x.ueberfaellig} überfällig</span>` : ""}${x.autopilot ? '<span class="klein">🤖</span>' : ""}</div>
      ${offen ? `<div class="ck-pj-inhalt">
        ${x.bericht ? `<p class="klein">📝 ${esc(x.bericht.text)}</p>` : ""}
        ${x.meilensteine.length ? `<div class="ck-pj-ms">${x.meilensteine.map((m) => `<span>🏁 ${esc(m.titel)}${m.frist ? ` · ${datum(m.frist)}` : ""} · ${m.prozent} %</span>`).join("")}</div>` : ""}
        <ul class="hf-liste">${x.aufgaben.map((a) => `<li class="hf-zeile"><span class="name"><button class="hf-btn leise ck-pj-hak" data-pj-p="${esc(x.id)}" data-pj-hak="${esc(a.id)}">${a.erledigt ? "☑" : "☐"}</button> ${a.erledigt ? `<s>${esc(a.text)}</s>` : esc(a.text)} <span class="klein">${a.wichtig === 3 ? "❗" : ""}${a.frist ? ` bis ${datum(a.frist)}` : ""}${a.meilenstein && ms.get(a.meilenstein) ? ` · ${esc(ms.get(a.meilenstein).titel)}` : ""}</span>${a.ergebnis ? `<br><span class="klein">🤖 ${esc(a.ergebnis.slice(0, 260))}</span>` : ""}</span><button class="hf-btn leise" data-pj-p="${esc(x.id)}" data-pj-weg="${esc(a.id)}" title="Löschen">✕</button></li>`).join("")}</ul>
        <div class="hf-reihe"><input class="hf-input grow" id="ck-pj-a-${esc(x.id)}" placeholder="Neue Aufgabe" maxlength="200"><input class="hf-input" type="date" id="ck-pj-af-${esc(x.id)}"><select class="hf-input" id="ck-pj-aw-${esc(x.id)}"><option value="1">unwichtig</option><option value="2" selected>normal</option><option value="3">sehr wichtig</option></select><select class="hf-input" id="ck-pj-aa-${esc(x.id)}"><option value="1">schnell</option><option value="2" selected>mittel</option><option value="3">groß</option></select>${x.meilensteine.length ? `<select class="hf-input" id="ck-pj-am-${esc(x.id)}"><option value="">ohne Meilenstein</option>${x.meilensteine.map((m) => `<option value="${esc(m.id)}">${esc(m.titel)}</option>`).join("")}</select>` : ""}<button class="hf-btn" data-pj-neu="${esc(x.id)}">＋ Aufgabe</button></div>
        <div class="hf-reihe"><input class="hf-input grow" id="ck-pj-ms-${esc(x.id)}" placeholder="Neuer Meilenstein" maxlength="120"><input class="hf-input" type="date" id="ck-pj-msf-${esc(x.id)}"><button class="hf-btn" data-pj-ms="${esc(x.id)}">＋ Meilenstein</button></div>
        <div class="hf-reihe"><button class="hf-btn ${x.autopilot ? "haupt" : ""}" data-pj-auto="${esc(x.id)}" data-an="${x.autopilot ? 1 : 0}">🤖 Autopilot ${x.autopilot ? "an" : "aus"}</button>${x.autopilot ? '<button class="hf-btn leise" data-pj-jetzt="1">Jetzt vorbereiten</button>' : ""}${x.status !== "fertig" ? `<button class="hf-btn leise" data-pj-fertig="${esc(x.id)}">Projekt abschließen</button>` : ""}</div>
      </div>` : ""}
    </div>`;
  }

  const css = document.createElement("style");
  css.textContent = `
.ck-fi-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; margin-bottom: 12px; }
.ck-fi-abt { margin: 0; }
.ck-fi-abt p { margin: 4px 0; font-size: 13px; }
.ck-fi-kopf { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.ck-fi-zahl { font-size: 18px; font-weight: 700; text-align: right; }
.ck-fi-zahl small { display: block; font-size: 10px; font-weight: 400; opacity: .7; }
.ck-fi-team { display: flex; flex-wrap: wrap; gap: 4px 10px; opacity: .85; }
.ck-fi-vert { display: grid; gap: 8px; margin: 8px 0; }
.ck-fi-schritt { border-left: 2px solid var(--cyan); padding-left: 10px; }
.ck-fi-ang { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; }
.ck-fi-ang span { border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 3px 8px; font-size: 12px; }
.ck-fi-ang span.sieger { border-color: var(--cyan); box-shadow: 0 0 8px rgba(255,150,40,.35); }
.ck-fi-ang span.aus { opacity: .45; text-decoration: line-through; }
.ck-fi-ang i { font-style: normal; font-weight: 700; margin-left: 4px; }
.ck-fi-ang small { display: block; opacity: .65; font-size: 10px; }
.ck-fi-punkte { min-width: 34px; font-weight: 700; font-size: 16px; text-align: center; }
.ck-pj { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 8px 10px; margin: 8px 0; }
.ck-pj.fertig { opacity: .6; }
.ck-pj-kopf { display: grid; grid-template-columns: minmax(120px, 1.2fr) 2fr 50px auto auto; gap: 10px; align-items: center; cursor: pointer; }
.ck-pj-inhalt { margin-top: 8px; }
.ck-pj-ms { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; margin: 6px 0; }
.ck-pj-hak { padding: 0 6px; min-width: 0; }
@media (max-width: 900px) { .ck-pj-kopf { grid-template-columns: 1fr 70px 44px; } .ck-pj-kopf > span:nth-child(n+4) { display: none; } }`;
  document.head.appendChild(css);

  C.reiter("firma", "🏢 Firma", (el) => firma(el));
  C.reiter("projekte", "📁 Projekte", (el) => projekte(el));
})();
