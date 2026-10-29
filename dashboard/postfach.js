// F.R.Ai.D.A.Y Postfach: iCloud-Mails anzeigen + Newsletter sortieren.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api, esc = F.escapeHtml || ((s) => s);

  function open() { $("mail")?.classList.remove("hidden"); load(); }
  function close() { $("mail")?.classList.add("hidden"); }
  $("mail-btn")?.addEventListener("click", open);
  $("mail-x")?.addEventListener("click", close);
  $("mail-sort")?.addEventListener("click", async () => {
    const btn = $("mail-sort");
    if (!api) return;
    btn.disabled = true; btn.textContent = "Sortiere...";
    try {
      const r = await (await api("/api/mail/sort", { method: "POST" })).json();
      btn.textContent = r.ok ? (r.verschoben ? `${r.verschoben} sortiert` : "Nichts zu sortieren") : "Fehler";
    } catch { btn.textContent = "Fehler"; }
    setTimeout(() => { btn.disabled = false; btn.textContent = "Newsletter sortieren"; load(true); }, 1500);
  });

  async function load(force) {
    const body = $("mail-body");
    if (!body || !api) return;
    body.innerHTML = '<p class="muted">Lade Postfach...</p>';
    let o;
    try { o = await (await api("/api/mail" + (force ? "?force=1" : ""))).json(); } catch { o = { ok: false }; }
    if (!o || !o.ok) {
      if (o && o.grund === "nicht_verbunden") {
        body.innerHTML = `<div class="mail-setup">
          <p><b>iCloud ist noch nicht verbunden.</b></p>
          <p class="muted">So verbindest du dein iCloud-Postfach (einmalig):</p>
          <ol class="mail-steps">
            <li>Öffne <b>appleid.apple.com</b> und melde dich an.</li>
            <li>Unter „Anmeldung &amp; Sicherheit" → <b>App-spezifische Passwörter</b> → neues erstellen (Name z. B. „Friday").</li>
            <li>Schick mir das Passwort hier im Chat – ich trage es sicher auf deinem Mac ein.</li>
          </ol>
          <p class="muted">Dein normales iCloud-Passwort brauche ich nicht.</p></div>`;
      } else {
        body.innerHTML = `<p class="muted">Postfach nicht erreichbar.${o && o.fehler ? " " + esc(o.fehler) : ""}</p>`;
      }
      return;
    }
    const rows = (o.nachrichten || []).map((n) => {
      const d = n.datum ? new Date(n.datum).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
      return `<div class="mail-row ${n.gelesen ? "" : "unread"}">
        <span class="mail-dot"></span>
        <span class="mail-von">${esc(n.von || n.vonMail || "")}</span>
        <span class="mail-betreff">${esc(n.betreff || "")}</span>
        <small class="mail-datum">${d}</small></div>`;
    }).join("");
    body.innerHTML = `
      <div class="mail-head"><b>${o.ungelesen}</b> ungelesen · ${o.gesamt} gesamt <small class="muted">· ${esc(o.email || "")}</small></div>
      <div class="mail-list">${rows || '<p class="muted">Keine Nachrichten.</p>'}</div>`;
  }
})();
