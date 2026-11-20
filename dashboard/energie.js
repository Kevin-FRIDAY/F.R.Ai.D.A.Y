// F.R.Ai.D.A.Y Energie: Lebensbalken aus dem Claude-Guthaben, Sparmodus, Notstrom und Einnahmen.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const { api, escapeHtml } = window.Friday;
  const say = (t) => (window.Friday.sagVonSelbst || window.Friday.say)(t, { quelle: "energie-ansage", stufe: "warn" });
  const box = $("energie");
  if (!box) return;

  const usd = (v) => `${Number(v || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
  const ZUSTAND = { voll: ["VOLLE ENERGIE", "ok"], spar: ["SPARMODUS", "warn"], tot: ["NOTSTROM", "bad"] };
  let last = null, timer = null;
  const loggedIn = () => { try { return Boolean(localStorage.getItem("friday_token")); } catch { return false; } };

  function chip(e) {
    const c = $("hb-energie");
    if (!c) return;
    const [, cls] = ZUSTAND[e.zustand];
    c.querySelector(".hb-dot").className = `hb-dot ${cls}`;
    c.querySelector("b").textContent = e.zustand === "tot" ? "leer" : e.prozent == null ? "?" : `${e.prozent} %`;
  }

  function render(e) {
    const [label, cls] = ZUSTAND[e.zustand];
    $("en-zustand").textContent = label;
    $("en-zustand").className = `en-zustand ${cls}`;
    const pct = e.zustand === "tot" ? 0 : e.prozent ?? 0;
    $("en-bar").style.width = `${pct}%`;
    $("en-bar").className = `en-bar ${cls}`;
    $("en-zahlen").innerHTML = e.guthaben == null
      ? `<p class="muted">Sag mir einmal, wie viel Guthaben du aufgeladen hast, dann rechne ich ab da mit.</p>`
      : `<div><small>ÜBRIG (GESCHÄTZT)</small><b>${usd(e.rest)}</b></div><div><small>VERBRAUCHT</small><b>${usd(e.verbrauch)}</b></div><div><small>AUFGELADEN</small><b>${usd(e.guthaben)}</b></div>`;
    const traegt = e.bilanz >= 0;
    $("en-bilanz").innerHTML = `<small>ÜBERLEBENS-BILANZ</small><b class="${traegt ? "pos" : "neg"}">${traegt ? "+" : ""}${usd(e.bilanz)}</b>
      <span>${e.einnahmen > 0 ? (traegt ? "Friday trägt sich selbst." : `Friday hat ${usd(e.einnahmen)} eingebracht und ${usd(e.verbrauch_gesamt)} gekostet.`) : `Bisher ${usd(e.verbrauch_gesamt)} gekostet, noch nichts eingebracht.`}</span>`;
    $("en-kosten").innerHTML = e.letzte.map((k) => `<li><span>${new Date(k.zeit).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · ${escapeHtml(k.quelle)}${String(k.modell || "").includes("haiku") ? " (spar)" : ""}</span><b>${k.usd.toLocaleString("de-DE", { maximumFractionDigits: 4 })} $</b></li>`).join("") || "<li class='muted'>Noch keine Anfragen gezählt.</li>";
    $("en-einnahmen").innerHTML = e.einnahmen_liste.map((x) => `<li><span>${new Date(x.zeit).toLocaleDateString("de-DE")} · ${escapeHtml(x.wofuer || "Einnahme")}</span><b>+${usd(x.betrag)}</b></li>`).join("") || "<li class='muted'>Noch keine Einnahmen eingetragen.</li>";
  }

  // Sterbe- und Aufwach-Szene, wenn sich der Zustand ändert.
  function scene(e) {
    document.body.classList.toggle("friday-tot", e.zustand === "tot");
    document.body.classList.toggle("friday-spar", e.zustand === "spar");
    if (last && last.zustand !== e.zustand) {
      if (e.zustand === "tot") say("Energie kritisch. Mein Guthaben ist leer, ich fahre herunter. Nur meine kostenlosen Funktionen laufen weiter.");
      else if (last.zustand === "tot") say("Systeme wieder online. Danke fürs Füttern, Chef.");
      else if (e.zustand === "spar") say("Chef, meine Energie wird knapp. Ich schalte in den Sparmodus.");
    }
    last = e;
  }

  async function refresh() {
    clearTimeout(timer);
    if (!loggedIn()) { timer = setTimeout(refresh, 15000); return; }
    try {
      const e = await (await api("/api/energie")).json();
      chip(e); scene(e);
      if (!box.classList.contains("hidden")) render(e);
    } catch { /* später wieder */ }
    timer = setTimeout(refresh, 60000);
  }

  async function post(path, body) {
    const res = await api(path, { method: "POST", body: JSON.stringify(body) });
    const r = await res.json();
    $("en-msg").textContent = r.ok ? "Gespeichert." : r.error || "Hat nicht geklappt.";
    if (r.ok) { chip(r.energie); scene(r.energie); render(r.energie); }
  }

  $("hb-energie")?.addEventListener("click", () => { box.classList.remove("hidden"); refresh(); if (last) render(last); });
  $("energie-x")?.addEventListener("click", () => box.classList.add("hidden"));
  $("en-auf-form")?.addEventListener("submit", (ev) => { ev.preventDefault(); post("/api/energie/aufgeladen", { betrag: String($("en-auf").value).replace(",", ".") }); $("en-auf").value = ""; });
  $("en-ein-form")?.addEventListener("submit", (ev) => { ev.preventDefault(); post("/api/energie/einnahme", { betrag: String($("en-ein").value).replace(",", "."), wofuer: $("en-ein-wofuer").value }); $("en-ein").value = ""; $("en-ein-wofuer").value = ""; });
  box.addEventListener("click", (ev) => { const b = ev.target.closest("[data-go]"); if (b) { box.classList.add("hidden"); $(b.dataset.go)?.click(); } });

  // Nach jeder Chat-Antwort neu messen.
  window.FridayEnergie = { refresh };
  setTimeout(refresh, 2000);
})();
