// F.R.Ai.D.A.Y Alexa: Voice-Monkey-Schlüssel eintragen, Routinen antippen, Ansagen schicken.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = window.Friday || {};
  const api = F.api, esc = F.escapeHtml || ((s) => String(s));

  const msg = (t, bad = false) => { const m = $("alexa-msg"); if (m) { m.textContent = t || ""; m.classList.toggle("bad", bad); } };
  const post = (url, body) => api(url, { method: "POST", body: JSON.stringify(body || {}) });
  const json = async (p) => { const r = await p; const d = await r.json().catch(() => ({})); return { ok: r.ok, ...d }; };

  function open() { $("alexa")?.classList.remove("hidden"); refresh(); }
  function close() { $("alexa")?.classList.add("hidden"); }
  $("alexa-open")?.addEventListener("click", open);
  $("alexa-x")?.addEventListener("click", close);
  $("alexa")?.addEventListener("click", (e) => { if (e.target.id === "alexa") close(); });
  window.openAlexa = open;

  function show(which) {
    $("alexa-setup")?.classList.toggle("hidden", which !== "setup");
    $("alexa-main")?.classList.toggle("hidden", which !== "main");
  }

  function render(s) {
    if (!s.eingerichtet) { show("setup"); return; }
    show("main");
    const box = $("alexa-routines");
    box.innerHTML = s.routinen?.length
      ? s.routinen.map((r) => `<button class="alexa-btn" data-name="${esc(r.name)}">${esc(r.name)}</button>`).join("")
      : '<p class="muted">Noch keine Routine-Auslöser. Leg in Voice Monkey unter „Routine Triggers“ welche an und tipp dann auf Aktualisieren.</p>';
    const sel = $("alexa-speaker");
    const ls = s.lautsprecher || [];
    sel.innerHTML = ls.length
      ? ls.map((l) => `<option value="${esc(l.id)}"${l.id === s.standard ? " selected" : ""}>${esc(l.name)}</option>`).join("") + (ls.length > 1 ? '<option value="*">Alle Echos</option>' : "")
      : '<option value="">Kein Lautsprecher angelegt</option>';
    sel.disabled = !ls.length;
    $("alexa-say").disabled = !ls.length;
    // Steht der Schlüssel in der .env, kann man ihn hier nicht entfernen.
    $("alexa-forget")?.classList.toggle("hidden", s.schluesselQuelle !== "dashboard");
  }

  async function refresh() {
    if (!api) return;
    try { render(await (await api("/api/alexa")).json()); } catch { show("setup"); }
  }

  $("alexa-save")?.addEventListener("click", async () => {
    const inp = $("alexa-token"), btn = $("alexa-save");
    const token = inp.value.trim();
    if (!token) return;
    btn.disabled = true; btn.textContent = "Prüfe …";
    const r = await json(post("/api/alexa/schluessel", { token }));
    btn.disabled = false; btn.textContent = "Verbinden";
    if (!r.ok) { alert(r.error || "Das hat nicht geklappt."); return; }
    inp.value = "";
    render(r);
    msg(`Verbunden: ${r.routinen.length} Routinen, ${r.lautsprecher.length} Lautsprecher.`);
    F.say?.("Alexa ist verbunden.");
  });

  $("alexa-routines")?.addEventListener("click", async (e) => {
    const b = e.target.closest(".alexa-btn");
    if (!b) return;
    b.classList.add("busy");
    const r = await json(post("/api/alexa/befehl", { action: "routine", value: b.dataset.name }));
    b.classList.remove("busy");
    if (r.ok) { b.classList.add("done"); setTimeout(() => b.classList.remove("done"), 1500); msg(r.text); }
    else msg(r.error || "Hat nicht geklappt.", true);
  });

  $("alexa-say")?.addEventListener("click", async () => {
    const speech = $("alexa-speech").value.trim();
    if (!speech) { msg("Erst einen Satz eintippen.", true); return; }
    const sel = $("alexa-speaker");
    const lautsprecher = sel.value === "*" ? "überall" : sel.options[sel.selectedIndex]?.text;
    if (sel.value && sel.value !== "*") post("/api/alexa/standard", { id: sel.value }).catch(() => {});
    msg("Sende …");
    const r = await json(post("/api/alexa/befehl", { action: "ansage", value: speech, lautsprecher }));
    if (r.ok) { msg(r.text); $("alexa-speech").value = ""; } else msg(r.error || "Hat nicht geklappt.", true);
  });
  $("alexa-speech")?.addEventListener("keydown", (e) => { if (e.key === "Enter") $("alexa-say")?.click(); });

  $("alexa-refresh")?.addEventListener("click", async () => {
    msg("Frage Voice Monkey …");
    const r = await json(post("/api/alexa/aktualisieren"));
    if (r.ok) { render(r); msg(`${r.routinen.length} Routinen, ${r.lautsprecher.length} Lautsprecher.`); } else msg(r.error, true);
  });
  $("alexa-forget")?.addEventListener("click", async () => {
    if (!confirm("Voice-Monkey-Schlüssel aus Friday entfernen?")) return;
    await post("/api/alexa/vergessen");
    refresh();
  });
})();
