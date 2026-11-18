// F.R.Ai.D.A.Y Logbuch: alles, was Friday getan hat – nach Tag, mit Uhrzeit, filterbar.
// Öffnen: Werkzeug-Menü → Logbuch, oder per Sprache „Friday, öffne das Logbuch“.
(() => {
  "use strict";
  const F = window.Friday || {};
  const api = F.api;
  if (!api) return;
  const esc = F.escapeHtml || ((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));

  const sheet = document.createElement("section");
  sheet.id = "logbuch";
  sheet.className = "sheet hidden";
  sheet.setAttribute("aria-label", "Fridays Logbuch");
  sheet.innerHTML = `<div class="panel sheet-box lb-box">
      <header class="sheet-top"><h2>📜 Fridays Logbuch</h2><span id="lb-zahl" class="lb-zahl"></span><button id="lb-x" class="ghost small" aria-label="Schließen">✕</button></header>
      <div class="lb-tagwahl">
        <button id="lb-vor" class="chip" type="button" aria-label="Tag davor">‹</button>
        <label class="lb-datum"><span id="lb-tagname">Heute</span><input id="lb-tag" type="date"></label>
        <button id="lb-nach" class="chip" type="button" aria-label="Tag danach">›</button>
        <button id="lb-heute" class="chip" type="button">Heute</button>
        <span class="lb-live" id="lb-live" title="Neue Einträge erscheinen von selbst"><i></i>Live</span>
      </div>
      <div id="lb-tage" class="lb-tage" aria-label="Letzte Tage"></div>
      <div id="lb-stats" class="lb-stats"></div>
      <div class="lb-leiste">
        <div id="lb-filter" class="wissen-filter lb-filter" role="tablist"></div>
        <div class="lb-suche"><input id="lb-q" type="search" placeholder="Im Logbuch suchen …" autocomplete="off"><button id="lb-csv" class="chip" type="button" title="Diesen Tag als Tabelle (CSV) speichern">⬇ CSV</button></div>
      </div>
      <ol id="lb-liste" class="lb-liste"><li class="muted">Lade …</li></ol>
      <p class="muted lb-fuss">Friday schreibt hier alles mit: was du gesagt hast, Anrufe und Nachrichten, Häuser, Aufgaben, Fernseher, Alexa, Updates, Sicherungen und mehr. Es bleibt auf deinem Mac (server/data/logbuch) und wird bei Updates nie gelöscht.</p>
    </div>`;
  document.getElementById("app")?.appendChild(sheet) || document.body.appendChild(sheet);
  // Unsichtbarer Knopf, damit das Werkzeug-Menü (data-target) das Logbuch öffnen kann.
  const trigger = document.createElement("button");
  trigger.id = "logbuch-open"; trigger.className = "hidden"; trigger.setAttribute("aria-hidden", "true"); trigger.tabIndex = -1;
  document.body.appendChild(trigger);

  const $ = (id) => document.getElementById(id);
  let daten = null, tag = "", heute = "", bereich = "", fehlerNur = false, q = "", timer = null, offenId = null;

  const tagPlus = (t, n) => { const d = new Date(`${t}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("sv-SE"); };
  const tagName = (t) => {
    if (!t) return "";
    if (t === heute) return "Heute";
    if (heute && t === tagPlus(heute, -1)) return "Gestern";
    return new Date(`${t}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };
  const uhr = (iso) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const KANAL = { web: "Dashboard", telegram: "Telegram", siri: "Siri", briefing: "Briefing", core: "Kern", dashboard: "Dashboard", automatisch: "Automatisch", system: "System" };
  const QUELLE = { claude: "mit Claude", offline: "ohne Claude", schnellbefehl: "ohne Claude", "übersetzer": "Übersetzer" };
  const dauer = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0).replace(".", ",")} s` : `${ms} ms`);

  async function laden({ still = false } = {}) {
    const p = new URLSearchParams({ tag, limit: "2000" });
    if (bereich) p.set("bereich", bereich);
    if (fehlerNur) p.set("fehler", "1");
    if (q) p.set("q", q);
    try {
      daten = await (await api(`/api/logbuch?${p}`)).json();
    } catch {
      if (!still) $("lb-liste").innerHTML = `<li class="error">Logbuch konnte nicht geladen werden.</li>`;
      return;
    }
    heute = daten.heute; tag = daten.tag;
    $("lb-tag").value = tag;
    $("lb-tag").max = heute;
    $("lb-tagname").textContent = tagName(tag);
    $("lb-nach").disabled = tag >= heute;
    $("lb-heute").classList.toggle("weg", tag === heute);
    $("lb-live").classList.toggle("an", tag === heute);
    $("lb-zahl").textContent = `${daten.gesamt} ${daten.gesamt === 1 ? "Eintrag" : "Einträge"}`;
    stats(); filter(); liste();
  }

  async function tageLaden() {
    let tage = [];
    try { tage = await (await api("/api/logbuch/tage?anzahl=21")).json(); } catch { /* egal */ }
    const max = Math.max(1, ...tage.map((t) => t.anzahl));
    $("lb-tage").innerHTML = tage.length > 1 ? tage.slice().reverse().map((t) => `<button type="button" data-tag="${esc(t.tag)}" class="${t.tag === tag ? "on" : ""}" title="${esc(tagName(t.tag))}: ${t.anzahl} Einträge${t.fehler ? `, ${t.fehler} Fehler` : ""}">
        <i style="height:${Math.max(8, Math.round((t.anzahl / max) * 100))}%"${t.fehler ? ' class="mit-fehler"' : ""}></i><small>${esc(t.tag.slice(8, 10))}.${esc(t.tag.slice(5, 7))}</small></button>`).join("") : "";
  }

  function stats() {
    const d = daten;
    const aktionen = d.gesamt - d.befehle;
    $("lb-stats").innerHTML = [
      ["Einträge", d.gesamt, ""],
      ["🗣 Befehle", d.befehle, "befehl"],
      ["⚙ Aktionen", aktionen, ""],
      ["✦ mit Claude", d.claude, ""],
      ["⚠ Fehler", d.fehler, "fehler"],
    ].map(([n, z, f]) => `<button type="button" class="lb-stat${f === "fehler" && fehlerNur ? " on" : f === "befehl" && bereich === "befehl" ? " on" : ""}${f === "fehler" && z ? " rot" : ""}" ${f ? `data-stat="${f}"` : "disabled"}><b>${z}</b><small>${n}</small></button>`).join("");
  }

  function filter() {
    const B = daten.bereiche || {};
    const vorhanden = Object.entries(daten.zahlen || {}).sort((a, b) => b[1] - a[1]);
    $("lb-filter").innerHTML = `<button type="button" data-b="" class="${!bereich ? "active" : ""}">Alles</button>` +
      vorhanden.map(([b, n]) => `<button type="button" data-b="${esc(b)}" class="${bereich === b ? "active" : ""}">${esc(B[b]?.[0] || "•")} ${esc(B[b]?.[1] || b)} <span class="lb-n">${n}</span></button>`).join("");
  }

  function liste() {
    const B = daten.bereiche || {};
    const e = daten.eintraege || [];
    if (!e.length) {
      $("lb-liste").innerHTML = `<li class="lb-leer"><div>📜</div><p>${daten.gesamt ? "Nichts gefunden für diesen Filter." : tag === heute ? "Heute steht noch nichts im Logbuch." : "An diesem Tag steht nichts im Logbuch."}</p>
        <p class="muted">Sag zum Beispiel „Friday, wie spät ist es?“ – dann erscheint es hier sofort.</p></li>`;
      return;
    }
    let letzteStunde = "";
    $("lb-liste").innerHTML = e.map((x) => {
      const stunde = uhr(x.at).slice(0, 2);
      const trenner = stunde !== letzteStunde ? `<li class="lb-stunde" aria-hidden="true"><span>${stunde}:00</span></li>` : "";
      letzteStunde = stunde;
      const [ic, name] = B[x.bereich] || ["•", x.bereich];
      const marken = [
        x.kanal && KANAL[x.kanal] ? KANAL[x.kanal] : x.kanal,
        x.quelle && !x.kanal ? KANAL[x.quelle] || "" : "",
        QUELLE[x.quelle] || "",
        Number.isFinite(x.dauer_ms) && x.dauer_ms > 0 ? dauer(x.dauer_ms) : "",
      ].filter((m, i, alle) => m && m !== name && alle.indexOf(m) === i);
      const offen = offenId === x.id;
      return `${trenner}<li class="lb-e${x.ok === false ? " fehler" : ""}${offen ? " offen" : ""}" data-id="${esc(x.id)}" data-b="${esc(x.bereich)}">
        <time>${esc(uhr(x.at))}</time>
        <span class="lb-ic" title="${esc(name)}">${esc(ic)}</span>
        <div class="lb-text">
          <div class="lb-titel">${esc(x.titel)}${x.ok === false ? ' <em class="lb-x">✕ nicht geklappt</em>' : ""}</div>
          ${x.details ? `<div class="lb-details">${esc(x.details)}</div>` : ""}
          <div class="lb-marken"><span>${esc(name)}</span>${marken.map((m) => `<span>${esc(m)}</span>`).join("")}${x.aktionen?.length && offen ? `<span class="lb-akt">${esc(x.aktionen.join(" · "))}</span>` : ""}</div>
        </div>
      </li>`;
    }).join("");
  }

  function geheZu(t) { tag = t; offenId = null; laden(); tageLaden(); }

  $("lb-x").addEventListener("click", schliessen);
  $("lb-vor").addEventListener("click", () => geheZu(tagPlus(tag || heute, -1)));
  $("lb-nach").addEventListener("click", () => { if (tag < heute) geheZu(tagPlus(tag, 1)); });
  $("lb-heute").addEventListener("click", () => geheZu(heute));
  $("lb-tag").addEventListener("change", (e) => { if (e.target.value) geheZu(e.target.value); });
  $("lb-tage").addEventListener("click", (e) => { const b = e.target.closest("button[data-tag]"); if (b) geheZu(b.dataset.tag); });
  $("lb-filter").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-b]"); if (!b) return;
    bereich = b.dataset.b; fehlerNur = false; laden();
  });
  $("lb-stats").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-stat]"); if (!b) return;
    if (b.dataset.stat === "fehler") { fehlerNur = !fehlerNur; bereich = ""; }
    else { bereich = bereich === "befehl" ? "" : "befehl"; fehlerNur = false; }
    laden();
  });
  let qTimer = null;
  $("lb-q").addEventListener("input", (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { q = e.target.value.trim(); laden(); }, 250); });
  $("lb-liste").addEventListener("click", (e) => {
    const li = e.target.closest(".lb-e"); if (!li) return;
    offenId = offenId === li.dataset.id ? null : li.dataset.id;
    liste();
  });
  $("lb-csv").addEventListener("click", async () => {
    try {
      const r = await api(`/api/logbuch/export?tag=${encodeURIComponent(tag)}`);
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `friday-logbuch-${tag}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch { /* egal */ }
  });
  trigger.addEventListener("click", () => oeffnen());
  sheet.addEventListener("click", (e) => { if (e.target === sheet) schliessen(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && offen()) schliessen(); });

  function offen() { return !sheet.classList.contains("hidden"); }
  function oeffnen(t) {
    if (typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t)) tag = t;
    sheet.classList.remove("hidden");
    document.querySelector("#menu-pop")?.classList.add("hidden");
    laden(); tageLaden();
    clearInterval(timer);
    // Live: solange das Fenster offen ist und "heute" gezeigt wird, alle 8 Sekunden nachsehen.
    timer = setInterval(() => { if (offen() && !document.hidden && tag === heute) laden({ still: true }); }, 8000);
  }
  function schliessen() { sheet.classList.add("hidden"); clearInterval(timer); timer = null; }

  window.FridayLogbuch = { open: oeffnen, close: schliessen, offen, refresh: () => offen() && laden({ still: true }) };
})();
