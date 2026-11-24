// F.R.Ai.D.A.Y Dokumente und Fragebögen: zeigt, was Friday erstellt hat, im Stil des Update-Balkens.
// Fragebögen füllt Boss Frage für Frage aus; am Ende landen die Antworten in Fridays Gedächtnis.
(() => {
  "use strict";
  const F = window.Friday || {};
  const api = F.api;
  if (!api) return;
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const vorlesenAn = () => { try { return localStorage.getItem("friday_fb_vorlesen") !== "0"; } catch { return true; } };

  const huelle = document.createElement("div");
  huelle.id = "dok";
  huelle.className = "dok-huelle hidden";
  huelle.innerHTML = `<div class="upd-bar dok-karte" role="dialog" aria-modal="true" aria-labelledby="dok-titel">
      <div class="ub-kopf">
        <span class="ub-ring" id="dok-ring"></span>
        <div class="ub-titel"><b id="dok-titel">DOKUMENT</b><small id="dok-sub"></small></div>
        <span class="ub-prozent" id="dok-prozent"></span>
        <button class="ub-x" id="dok-x" title="Schließen (Antworten bleiben gespeichert)" aria-label="Schließen">×</button>
      </div>
      <div class="ub-spur" id="dok-spur"><div class="ub-fuell" id="dok-fuell"></div><div class="ub-glanz"></div></div>
      <div id="dok-inhalt" class="dok-inhalt"></div>
    </div>`;
  document.body.appendChild(huelle);
  const $ = (id) => document.getElementById(id);

  let doc = null, idx = 0, antworten = [], speicherTimer = null;

  function zu() { huelle.classList.add("hidden"); if (doc?.art === "fragebogen") speichern(false); try { F.stopSpeaking?.(); window.Friday?.stopSpeaking?.(); } catch { /* egal */ } }
  $("dok-x").addEventListener("click", zu);
  huelle.addEventListener("click", (e) => { if (e.target === huelle) zu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !huelle.classList.contains("hidden")) zu(); });

  function auf() { huelle.classList.remove("hidden"); huelle.querySelector(".dok-karte").classList.remove("ub-gruen"); }

  // ---------- Dokument ----------
  function zeigeDokument(d) {
    $("dok-titel").textContent = d.titel.toUpperCase();
    $("dok-sub").textContent = `Erstellt ${new Date(d.erstellt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
    $("dok-prozent").textContent = "";
    $("dok-spur").classList.add("hidden");
    $("dok-ring").classList.add("still");
    $("dok-inhalt").innerHTML = `<div class="dok-text">${esc(d.inhalt)}</div>
      <div class="dok-knoepfe">
        <button type="button" class="chip" data-a="vorlesen">🔊 Vorlesen</button>
        <button type="button" class="chip" data-a="kopieren">📋 Kopieren</button>
      </div>`;
  }

  // ---------- Excel-Tabelle (v1.161.0) ----------
  let blatt = 0;
  function zeigeTabelle(d) {
    $("dok-titel").textContent = d.titel.toUpperCase();
    const bl = d.blaetter || [];
    const b = bl[blatt] || bl[0] || { spalten: [], zeilen: [] };
    $("dok-sub").textContent = `Excel-Tabelle · ${bl.length > 1 ? `${bl.length} Blätter · ` : ""}${b.anzahl ?? b.zeilen.length} Zeilen · ${new Date(d.erstellt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
    $("dok-prozent").textContent = "";
    $("dok-spur").classList.add("hidden");
    $("dok-ring").classList.add("still");
    const zelle = (v) => { const s = String(v ?? ""); return s.startsWith("=") ? `<td class="tab-formel" title="${esc(s)}">ƒ ${esc(s.slice(1))}</td>` : `<td>${esc(s)}</td>`; };
    $("dok-inhalt").innerHTML = `${bl.length > 1 ? `<div class="dok-knoepfe tab-blaetter">${bl.map((x, i) => `<button type="button" class="chip${i === blatt ? " haupt" : ""}" data-a="blatt" data-i="${i}">${esc(x.name)}</button>`).join("")}</div>` : ""}
      <div class="tab-wrap"><table class="tab-vorschau">${b.spalten.length ? `<thead><tr>${b.spalten.map((s) => `<th>${esc(s)}</th>`).join("")}</tr></thead>` : ""}<tbody>${b.zeilen.map((z) => `<tr>${z.map(zelle).join("")}</tr>`).join("")}</tbody></table></div>
      ${(b.anzahl || 0) > b.zeilen.length ? `<small class="tab-mehr">Vorschau: erste ${b.zeilen.length} von ${b.anzahl} Zeilen. In der Datei ist alles drin.</small>` : ""}
      <div class="dok-knoepfe">
        <button type="button" class="chip haupt" data-a="xlsx">⬇ Excel herunterladen</button>
        <button type="button" class="chip" data-a="mac">💻 Am Mac öffnen</button>
      </div>`;
  }
  async function herunterladen(knopf) {
    try {
      const r = await api(`/api/tabellen/${encodeURIComponent(doc.id)}/datei`, { headers: { "Content-Type": "" } });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Fehler");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url; a.download = `${doc.titel.replace(/[\\/:*?"<>|]/g, " ").trim() || "Tabelle"}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      knopf.textContent = "✓ Heruntergeladen";
    } catch (err) { knopf.textContent = `✗ ${err.message}`; }
  }
  async function amMac(knopf) {
    try {
      const r = await api(`/api/tabellen/${encodeURIComponent(doc.id)}/oeffnen`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      knopf.textContent = r.ok ? "✓ Am Mac geöffnet" : `✗ ${d.error || "Ging nicht"}`;
    } catch { knopf.textContent = "✗ Mac nicht erreichbar"; }
  }

  // ---------- Fragebogen ----------
  function fortschritt() {
    const n = doc.fragen.length;
    const beantwortet = antworten.filter((a) => a.trim()).length;
    const p = doc.fertig ? 100 : Math.round((beantwortet / n) * 100);
    $("dok-fuell").style.width = `${p}%`;
    $("dok-prozent").textContent = `${p} %`;
    $("dok-sub").textContent = doc.fertig ? `Fertig · ${beantwortet} von ${n} beantwortet` : `Frage ${idx + 1} von ${n} · ${beantwortet} beantwortet`;
  }
  function zeigeFrage(still = false) {
    const n = doc.fragen.length;
    $("dok-spur").classList.remove("hidden");
    $("dok-ring").classList.remove("still");
    $("dok-inhalt").innerHTML = `
      <div class="fb-nr">FRAGE ${idx + 1} / ${n}</div>
      <div class="fb-frage">${esc(doc.fragen[idx].frage)}</div>
      <textarea id="fb-antwort" class="fb-antwort" rows="3" placeholder="Deine Antwort … (Enter = weiter)">${esc(antworten[idx] || "")}</textarea>
      <div class="dok-knoepfe">
        <button type="button" class="chip" data-a="zurueck" ${idx === 0 ? "disabled" : ""}>‹ Zurück</button>
        <button type="button" class="chip" data-a="mikro" title="Antwort sprechen">🎤 Sprechen</button>
        <button type="button" class="chip" data-a="ueberspringen">Überspringen</button>
        <button type="button" class="chip haupt" data-a="weiter">${idx === n - 1 ? "✓ Fertig" : "Weiter ›"}</button>
      </div>
      <label class="fb-vorlesen"><input type="checkbox" id="fb-vorlesen" ${vorlesenAn() ? "checked" : ""}> Fragen vorlesen</label>`;
    fortschritt();
    const ta = $("fb-antwort");
    ta.addEventListener("input", () => { antworten[idx] = ta.value; fortschritt(); clearTimeout(speicherTimer); speicherTimer = setTimeout(() => speichern(false), 1500); });
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); weiter(); } });
    $("fb-vorlesen").addEventListener("change", (e) => { try { localStorage.setItem("friday_fb_vorlesen", e.target.checked ? "1" : "0"); } catch { /* egal */ } });
    setTimeout(() => ta.focus({ preventScroll: true }), 60);
    if (vorlesenAn() && !still) { try { window.Friday?.stopSpeaking?.(); } catch { /* egal */ } F.say?.(doc.fragen[idx].frage); }
  }
  function weiter() {
    antworten[idx] = $("fb-antwort")?.value ?? antworten[idx] ?? "";
    if (idx < doc.fragen.length - 1) { idx++; speichern(false); zeigeFrage(); return; }
    abschliessen();
  }
  async function speichern(fertig) {
    if (!doc || doc.art !== "fragebogen") return null;
    try { return await (await api(`/api/dokumente/${encodeURIComponent(doc.id)}/antworten`, { method: "POST", body: JSON.stringify({ antworten, fertig }) })).json(); } catch { return null; }
  }
  async function abschliessen() {
    const r = await speichern(true);
    doc.fertig = true;
    huelle.querySelector(".dok-karte").classList.add("ub-gruen");
    $("dok-ring").classList.add("still");
    fortschritt();
    const n = r?.gemerkt ?? antworten.filter((a) => a.trim()).length;
    $("dok-inhalt").innerHTML = `<div class="fb-fertig"><b>Danke, Boss.</b><span>${n} Antworten sind jetzt in meinem Gedächtnis. Du findest den Fragebogen jederzeit unter Wissen.</span></div>
      <div class="dok-knoepfe"><button type="button" class="chip" data-a="ansehen">Antworten ansehen</button><button type="button" class="chip haupt" data-a="schliessen">Schließen</button></div>`;
    F.say?.(`Danke, Boss. Ich habe mir ${n} Antworten gemerkt.`);
  }
  function zeigeAntworten() {
    $("dok-inhalt").innerHTML = `<div class="dok-text">${doc.fragen.map((f, i) => `<b>${i + 1}. ${esc(f.frage)}</b>\n${esc(antworten[i] || "–")}`).join("\n\n")}</div>
      <div class="dok-knoepfe"><button type="button" class="chip" data-a="bearbeiten">✎ Bearbeiten</button><button type="button" class="chip haupt" data-a="schliessen">Schließen</button></div>`;
  }

  $("dok-inhalt").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-a]");
    if (!b || !doc) return;
    const a = b.dataset.a;
    if (a === "vorlesen") F.say?.(`${doc.titel}. ${doc.inhalt}`);
    else if (a === "kopieren") navigator.clipboard?.writeText(`${doc.titel}\n\n${doc.inhalt}`).then(() => { b.textContent = "✓ Kopiert"; }).catch(() => {});
    else if (a === "xlsx") herunterladen(b);
    else if (a === "mac") amMac(b);
    else if (a === "blatt") { blatt = Number(b.dataset.i) || 0; zeigeTabelle(doc); }
    else if (a === "weiter") weiter();
    else if (a === "ueberspringen") { if ($("fb-antwort")) $("fb-antwort").value = antworten[idx] || ""; weiter(); }
    else if (a === "zurueck" && idx > 0) { antworten[idx] = $("fb-antwort").value; idx--; zeigeFrage(); }
    else if (a === "mikro") diktieren(b);
    else if (a === "ansehen") zeigeAntworten();
    else if (a === "bearbeiten") { doc.fertig = false; huelle.querySelector(".dok-karte").classList.remove("ub-gruen"); idx = 0; zeigeFrage(); }
    else if (a === "schliessen") zu();
  });

  function diktieren(knopf) {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { knopf.textContent = "Kein Mikro"; return; }
    try { window.Friday?.stopSpeaking?.(); } catch { /* egal */ }
    const rec = new R();
    rec.lang = "de-DE"; rec.interimResults = false;
    knopf.textContent = "● Ich höre …";
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      const ta = $("fb-antwort");
      if (ta) { ta.value = (ta.value ? ta.value + " " : "") + t; antworten[idx] = ta.value; fortschritt(); }
    };
    rec.onend = () => { knopf.textContent = "🎤 Sprechen"; };
    try { rec.start(); } catch { knopf.textContent = "🎤 Sprechen"; }
  }

  async function oeffne(id, { still = false } = {}) {
    let d;
    try { d = await (await api(`/api/dokumente/${encodeURIComponent(id)}`)).json(); } catch { return; }
    if (!d || d.error) return;
    doc = d;
    auf();
    if (d.art === "fragebogen") {
      antworten = d.fragen.map((f) => f.antwort || "");
      $("dok-titel").textContent = d.titel.toUpperCase();
      if (d.fertig) { fortschritt(); zeigeAntworten(); huelle.querySelector(".dok-karte").classList.add("ub-gruen"); $("dok-ring").classList.add("still"); return; }
      const offen = antworten.findIndex((a) => !a.trim());
      idx = offen >= 0 ? offen : 0;
      zeigeFrage(still);
    } else if (d.art === "tabelle") {
      blatt = 0;
      zeigeTabelle(d);
    } else {
      zeigeDokument(d);
    }
  }
  async function neuestes() {
    try {
      const liste = await (await api("/api/dokumente")).json();
      if (liste[0]) setTimeout(() => oeffne(liste[0].id, { still: true }), 400); // Friday spricht gerade selbst
    } catch { /* egal */ }
  }

  window.FridayDokumente = { oeffne, neuestes, offen: () => !huelle.classList.contains("hidden") };
})();
