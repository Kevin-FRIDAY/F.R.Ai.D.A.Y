// Gehirn-Cockpit, Reiter "🧪 Entwicklung" und "♻️ Recovery" (v1.186.0, Mark XV):
// Skill Factory mit Sandbox-Tests, Code-Analyse, Fehler-Werkstatt, Entwicklungsprotokoll und Versionsgeschichte,
// Recovery Brain (Datenprüfung, letzte gute Fassung, Sicherung, Rollback-Stand).
(() => {
  "use strict";
  const C = window.FridayCockpit;
  const H = window.FridayHelfer;
  if (!C || !H) return;
  const { esc, json } = H;
  const zeit = (iso) => { try { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  const FARBE = { problem: "hf-schlecht", hinweis: "hf-warn" };
  const FELDNAME = { saetze: "Sätze (mit Komma getrennt)", antwort: "Antwort (bei Zufall mit | trennen)", friday: "Auftrag an Friday", ausloeser: "Auslöser-Wörter (Komma)", anleitung: "Anleitung", beispiele: "Beispiele zum Testen (Komma)" };
  let vorlage = "antwort", felder = null, nachgestellt = {};

  async function labor(el, meldung = "") {
    const d = await json("/api/labor");
    const v = d.vorlagen.find((x) => x.id === vorlage) || d.vorlagen[0];
    if (!felder || felder._v !== v.id) felder = { _v: v.id, name: "", ...v.felder };
    const a = d.analyse;
    el.innerHTML = `${meldung ? `<p class="hf-hinweis">${esc(meldung)}</p>` : ""}
      <div class="hf-karte"><h3>🏭 Skill Factory</h3>
        <p class="klein">Friday baut neue Befehle und Fähigkeiten aus Vorlagen. Jeder Entwurf läuft erst in der Sandbox durch echte Tests. Aktiv wird er nur, wenn alles grün ist und du auf „Aktivieren“ drückst.</p>
        <div class="ck-lb-vorlagen">${d.vorlagen.map((x) => `<button class="hf-btn ${x.id === v.id ? "haupt" : "leise"}" data-vorlage="${esc(x.id)}" title="${esc(x.text)}">${esc(x.name)}</button>`).join("")}</div>
        <p class="klein">${esc(v.text)}</p>
        <div class="ck-lb-felder">
          <label>Name<input class="hf-input" data-feld="name" value="${esc(felder.name)}" placeholder="${esc(v.name)}" maxlength="60"></label>
          ${Object.keys(v.felder).map((k) => `<label>${esc(FELDNAME[k] || k)}${k === "antwort" || k === "anleitung" || k === "friday" ? `<textarea class="hf-input" data-feld="${k}" rows="2" maxlength="4000">${esc(felder[k])}</textarea>` : `<input class="hf-input" data-feld="${k}" value="${esc(felder[k])}" maxlength="400">`}</label>`).join("")}
        </div>
        <div class="hf-reihe"><button class="hf-btn haupt" id="ck-lb-test">In der Sandbox testen</button></div>
        ${d.entwuerfe.length ? `<ul class="hf-liste">${d.entwuerfe.slice(0, 10).map((e) => `<li class="ck-lb-entwurf">
          <div class="hf-zeile"><span class="name">${e.status === "aktiv" ? "✅" : e.test.ok ? "🟢" : "🔴"} <b>${esc(e.name)}</b> <span class="klein">${e.art === "modul" ? "Modul" : "Fähigkeit"} · ${e.test.tests.filter((t) => t.ok).length}/${e.test.tests.length} Tests · ${e.status === "aktiv" ? `aktiv seit ${zeit(e.aktiviert)}` : zeit(e.at)}</span></span>
            <span>${e.status !== "aktiv" && e.test.ok ? `<button class="hf-btn haupt" data-aktiv="${esc(e.id)}">Aktivieren</button>` : ""}${e.status !== "aktiv" ? `<button class="hf-btn leise" data-weg="${esc(e.id)}">Verwerfen</button>` : ""}</span></div>
          <ul class="ck-lb-tests">${e.test.tests.map((t) => `<li class="${t.ok ? "" : "hf-schlecht"}">${t.ok ? "✓" : "✗"} <b>${esc(t.name)}</b> ${esc(t.text)}</li>`).join("")}</ul></li>`).join("")}</ul>` : ""}
      </div>
      <div class="hf-karte"><h3>🔬 Code-Analyse</h3>
        ${a ? `<div class="ck-lb-note"><span class="${a.note >= 80 ? "hf-gut" : a.note >= 60 ? "hf-warn" : "hf-schlecht"}">${a.note}</span><p>${a.dateien} Dateien · ${Number(a.zeilen).toLocaleString("de-DE")} Zeilen · ${a.kb} KB<br>${a.syntax ? (a.syntax.ok ? `✓ Syntax und Importe fehlerfrei (${a.syntax.geprueft} Server-Dateien)` : `<b class="hf-schlecht">✗ ${a.syntax.fehler.length} Syntax-Fehler</b>`) : ""}<br><span class="klein">Stand ${zeit(a.at)} · ${Math.round(a.dauer_ms / 100) / 10} s</span></p></div>
          ${a.vorschlaege.length ? `<ul class="hf-liste">${a.vorschlaege.map((x) => `<li class="${FARBE[x.stufe] || ""}">💡 ${esc(x.text)}</li>`).join("")}</ul>` : '<p class="hf-gut">Keine Verbesserungsvorschläge.</p>'}
          ${a.syntax && a.syntax.fehler.length ? `<ul class="ck-lb-tests">${a.syntax.fehler.map((f) => `<li class="hf-schlecht">${esc(f)}</li>`).join("")}</ul>` : ""}
          <details><summary class="klein">Größte Dateien</summary><ul class="ck-lb-tests">${a.groesste.map((g) => `<li>${esc(g.datei)} · ${g.zeilen.toLocaleString("de-DE")} Zeilen</li>`).join("")}</ul></details>` : '<p class="klein">Noch keine Analyse. Läuft auch jede Nacht um 4:15 Uhr.</p>'}
        <div class="hf-reihe"><button class="hf-btn" id="ck-lb-analyse">Jetzt prüfen</button></div>
        <p class="hf-hinweis">Friday liest ihren eigenen Code nur und ändert nichts daran. Verbesserungen kommen als getestetes Update.</p>
      </div>
      <div class="hf-karte"><h3>🐞 Fehler-Werkstatt</h3>
        ${d.fehler.length ? `<ul class="hf-liste">${d.fehler.slice(0, 12).map((f) => `<li class="ck-lb-fehler"><div class="hf-zeile"><span class="name"><b>${f.anzahl}×</b> ${esc(f.titel)}<br><span class="klein">${esc(f.details || "").slice(0, 160)} · zuletzt ${zeit(f.zuletzt)}</span></span>${f.nachstellbar ? `<button class="hf-btn leise" data-nach="${esc(f.schluessel)}">Nachstellen</button>` : ""}</div>
          ${f.vorschlag ? `<p class="klein">🔧 ${esc(f.vorschlag.text)}</p>` : ""}
          ${nachgestellt[f.schluessel] ? `<p class="klein ${nachgestellt[f.schluessel].wieder ? "hf-warn" : "hf-gut"}">${esc(nachgestellt[f.schluessel].text)}${nachgestellt[f.schluessel].ki ? `<br>🤖 ${esc(nachgestellt[f.schluessel].ki)}` : ""}</p>` : ""}</li>`).join("")}</ul>` : '<p class="hf-gut">Keine Fehler in den letzten 7 Tagen.</p>'}
        <p class="hf-hinweis">Fehler kommen aus dem Logbuch und werden gruppiert. Nachstellen läuft nur auf ungefährlichen Wegen (lesender Agent oder Funktionstest). Mit Ollama gibt es zusätzlich einen kostenlosen Reparatur-Tipp.</p>
      </div>
      <div class="hf-karte"><h3>📜 Entwicklungsprotokoll</h3>
        ${d.protokoll.length ? `<ul class="hf-liste">${d.protokoll.slice(0, 15).map((p) => `<li class="hf-zeile"><span class="name">${esc(p.text)}</span><span class="klein">${zeit(p.at)}</span></li>`).join("")}</ul>` : '<p class="klein">Noch leer.</p>'}
        <details><summary class="klein">Versionsgeschichte (${d.versionen.length})</summary><ul class="ck-lb-tests">${d.versionen.map((x) => `<li><b>v${esc(x.version)}</b> ${esc(x.titel)}</li>`).join("")}</ul></details>
      </div>`;
    el.querySelectorAll("[data-feld]").forEach((x) => x.addEventListener("input", () => { felder[x.dataset.feld] = x.value; }));
    el.querySelectorAll("[data-vorlage]").forEach((x) => x.addEventListener("click", () => { vorlage = x.dataset.vorlage; labor(el); }));
    const knopf = (sel, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener("click", async () => {
      x.disabled = true;
      let text = "";
      try { const r = await fn(x); text = r?.text || r?.error || ""; } catch (err) { text = err.message; }
      labor(el, text);
    }));
    knopf("#ck-lb-test", async (x) => {
      x.textContent = "Teste …";
      const { _v, ...f } = felder;
      const r = await json("/api/labor/entwurf", { body: { vorlage: _v, felder: f } });
      if (r.error) return r;
      return { text: r.entwurf.test.ok ? `„${r.entwurf.name}“ hat alle Tests bestanden. Jetzt kannst du es aktivieren.` : `„${r.entwurf.name}“ ist durchgefallen. Unten steht, was nicht passt.` };
    });
    knopf("[data-aktiv]", async (x) => { const r = await json(`/api/labor/entwurf/${encodeURIComponent(x.dataset.aktiv)}/aktivieren`, { body: {} }); return r.error ? r : { text: `„${r.entwurf.name}“ ist jetzt aktiv.` }; });
    knopf("[data-weg]", (x) => json(`/api/labor/entwurf/${encodeURIComponent(x.dataset.weg)}`, { method: "DELETE" }));
    knopf("#ck-lb-analyse", async (x) => { x.textContent = "Prüfe Code …"; const r = await json("/api/labor/analyse", { body: {} }); return { text: `Code-Note ${r.note} von 100.` }; });
    knopf("[data-nach]", async (x) => { x.textContent = "Stelle nach …"; const r = await json("/api/labor/nachstellen", { body: { schluessel: x.dataset.nach } }); if (!r.error) nachgestellt[x.dataset.nach] = r; return r.error ? r : {}; });
  }

  async function recovery(el, meldung = "") {
    const r = await json("/api/labor/recovery", { body: {} });
    el.innerHTML = `${meldung ? `<p class="hf-hinweis">${esc(meldung)}</p>` : ""}
      <div class="hf-karte"><h3>♻️ Recovery Brain</h3>
        <p class="${r.kaputt.length ? "hf-schlecht" : "hf-gut"}">${r.kaputt.length ? `🔴 ${r.kaputt.length} von ${r.geprueft} Daten-Dateien sind beschädigt.` : `🟢 Alle ${r.geprueft} Daten-Dateien sind lesbar.`}</p>
        ${r.kaputt.length ? `<ul class="hf-liste">${r.kaputt.map((k) => `<li class="hf-zeile"><span class="name"><b>${esc(k.datei)}</b><br><span class="klein">${esc(k.fehler)}${k.letzte ? ` · letzte gute Fassung ${zeit(k.letzteZeit)}` : " · keine aufgehobene Fassung"}</span></span>${k.letzte ? `<button class="hf-btn haupt" data-hol="${esc(k.datei)}">Zurückholen</button>` : ""}</li>`).join("")}</ul>` : ""}
        <p class="klein">Geprüft ${zeit(r.at)}. Jede Nacht um 4:15 Uhr automatisch.</p>
        <div class="hf-reihe"><button class="hf-btn" id="ck-rc-neu">Nochmal prüfen</button></div>
      </div>
      <div class="hf-karte"><h3>🛟 Sicherheitsnetz</h3>
        <ul class="hf-liste">
          <li>${r.sicherung ? `🟢 Letzte Sicherung: <b>${esc(r.sicherung.name)}</b>${r.sicherung.version ? ` (v${esc(r.sicherung.version)})` : ""}` : "🟡 Noch keine Sicherung gefunden."}</li>
          <li>${r.rollback ? `🟡 Update ${esc(r.rollback.ziel || "")} wurde am ${zeit(r.rollback.zeit)} zurückgerollt auf ${esc(r.rollback.von || "")}: ${esc(r.rollback.grund || "")}` : "🟢 Kein Update-Rollback nötig gewesen."}</li>
          <li>🟢 Notfall-Gehirn bereit: Ohne Claude und ohne Internet beantwortet Friday weiter die Offline-Befehle.</li>
        </ul>
        <p class="hf-hinweis">Beim Zurückholen bleibt die beschädigte Datei als Kopie liegen. Schlüssel-Dateien holt Friday nie selbst zurück. Eine ganze Sicherung zurückholen: Cockpit → System → Sicherung.</p>
      </div>`;
    const knopf = (sel, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener("click", async () => {
      x.disabled = true;
      let text = "";
      try { const res = await fn(x); text = res?.text || res?.error || ""; } catch (err) { text = err.message; }
      recovery(el, text);
    }));
    knopf("#ck-rc-neu", async () => ({}));
    knopf("[data-hol]", (x) => json("/api/labor/wiederherstellen", { body: { datei: x.dataset.hol } }));
  }

  const css = document.createElement("style");
  css.textContent = `
.ck-lb-vorlagen { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
.ck-lb-felder { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin: 8px 0; }
.ck-lb-felder label { display: grid; gap: 3px; font-size: 12px; opacity: .9; }
.ck-lb-felder textarea { resize: vertical; min-height: 40px; }
.ck-lb-entwurf { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 6px 10px; margin: 6px 0; list-style: none; }
.ck-lb-tests { margin: 4px 0 0; padding-left: 16px; font-size: 12px; display: grid; gap: 2px; }
.ck-lb-note { display: flex; gap: 14px; align-items: center; }
.ck-lb-note > span { font-size: 38px; font-weight: 700; min-width: 64px; text-align: center; }
.ck-lb-fehler { list-style: none; border-left: 2px solid var(--cyan); padding-left: 8px; margin: 6px 0; }
@media (max-width: 900px) { .ck-lb-felder { grid-template-columns: 1fr; } .ck-lb-note > span { font-size: 30px; } }`;
  document.head.appendChild(css);

  C.reiter("labor", "🧪 Entwicklung", (el) => labor(el));
  C.reiter("recovery", "♻️ Recovery", (el) => recovery(el));
})();
