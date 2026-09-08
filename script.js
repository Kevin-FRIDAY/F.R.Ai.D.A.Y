// F.R.Ai.D.A.Y — HUD Dashboard Logic

// ---------- Boot sequence ----------
const bootLines = [
  "F.R.Ai.D.A.Y CORE  v4.7.1",
  "INITIALISIERE NEURALE NETZWERKE ...",
  "LADE PANZERUNGSPROTOKOLLE ...       [OK]",
  "KALIBRIERE ARC-REAKTOR ...          [OK]",
  "VERBINDE SENSOR-ARRAY ...           [OK]",
  "STARTE SPRACHERKENNUNG ...          [OK]",
  "SICHERHEITSDIAGNOSE ...             [OK]",
  "ALLE SYSTEME BEREIT.",
];

function runBoot(){
  const log = document.getElementById('bootLog');
  let delay = 0;
  bootLines.forEach((text, i) => {
    const el = document.createElement('div');
    el.className = 'line' + (text.includes('[OK]') || text.includes('BEREIT') ? ' ok' : '');
    el.textContent = text;
    el.style.animationDelay = delay + 'ms';
    log.appendChild(el);
    delay += 260;
  });

  setTimeout(() => {
    document.getElementById('bootScreen').classList.add('hidden');
    document.getElementById('hud').classList.add('show');
    startDashboard();
  }, delay + 500);
}

// ---------- Clock ----------
function tickClock(){
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString('de-DE', { hour12:false });
  document.getElementById('dateline').textContent =
    now.toLocaleDateString('de-DE', { weekday:'long', year:'numeric', month:'long', day:'numeric' }).toUpperCase();
}

// ---------- Uptime ----------
const bootTime = Date.now();
function tickUptime(){
  const diff = Date.now() - bootTime;
  const h = String(Math.floor(diff / 3600000)).padStart(2,'0');
  const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2,'0');
  const s = String(Math.floor((diff % 60000) / 1000)).padStart(2,'0');
  document.getElementById('uptime').textContent = `LAUFZEIT ${h}:${m}:${s}`;
}

// ---------- Meters ----------
function setMeter(id, valId, pct){
  const clamped = Math.max(2, Math.min(100, pct));
  document.getElementById(id).style.width = clamped + '%';
  document.getElementById(valId).textContent = Math.round(clamped) + '%';
}

function randomWalk(prev, min, max, step){
  let next = prev + (Math.random() - 0.5) * step;
  return Math.max(min, Math.min(max, next));
}

let stats = { cpu: 34, mem: 58, net: 71, therm: 22 };
function updateMeters(){
  stats.cpu   = randomWalk(stats.cpu, 15, 85, 14);
  stats.mem   = randomWalk(stats.mem, 30, 90, 10);
  stats.net   = randomWalk(stats.net, 40, 99, 16);
  stats.therm = randomWalk(stats.therm, 10, 60, 8);
  setMeter('m-cpu','v-cpu', stats.cpu);
  setMeter('m-mem','v-mem', stats.mem);
  setMeter('m-net','v-net', stats.net);
  setMeter('m-therm','v-therm', stats.therm);
}

// ---------- Power ring ----------
const RING_CIRC = 2 * Math.PI * 52; // ≈ 327
function setPower(pct){
  const ring = document.getElementById('powerRing');
  const offset = RING_CIRC - (RING_CIRC * pct / 100);
  ring.style.strokeDasharray = RING_CIRC;
  ring.style.strokeDashoffset = offset;
  document.getElementById('powerPct').textContent = Math.round(pct) + '%';
}

// ---------- Sensor log ----------
const logMessages = [
  "Perimeter-Scan abgeschlossen — keine Bedrohungen",
  "Repulsor-Kalibrierung nominal",
  "Wetterdaten synchronisiert",
  "Kommunikationssatellit verbunden",
  "Biometrie: Vitalwerte stabil",
  "Flugbahn-Berechnung aktualisiert",
  "Sicherheitsprotokoll bestätigt",
  "Energieverteilung optimiert",
  "Sensor-Array neu ausgerichtet",
  "Diagnosezyklus abgeschlossen",
];
function pushLog(){
  const list = document.getElementById('logList');
  const li = document.createElement('li');
  const now = new Date();
  const t = now.toLocaleTimeString('de-DE', { hour12:false });
  const msg = logMessages[Math.floor(Math.random() * logMessages.length)];
  li.innerHTML = `<span class="t">[${t}]</span><span>${msg}</span>`;
  list.prepend(li);
  while (list.children.length > 6) list.removeChild(list.lastChild);
  document.getElementById('logTag').textContent = t;
}

// ---------- Command typewriter ----------
const commands = [
  "F.R.Ai.D.A.Y, Statusbericht anzeigen",
  "Panzerung diagnostizieren",
  "Flugroute nach Malibu berechnen",
  "Energieverteilung optimieren",
  "Sicherheitsprotokoll Alpha aktivieren",
];
let cmdIndex = 0;
function typewriter(){
  const el = document.getElementById('typedCommand');
  const text = commands[cmdIndex % commands.length];
  let i = 0;
  el.textContent = '';
  const type = setInterval(() => {
    el.textContent = text.slice(0, i++);
    if (i > text.length){
      clearInterval(type);
      setTimeout(erase, 2200);
    }
  }, 45);
  function erase(){
    const erase_ = setInterval(() => {
      el.textContent = text.slice(0, i--);
      if (i < 0){
        clearInterval(erase_);
        cmdIndex++;
        setTimeout(typewriter, 500);
      }
    }, 25);
  }
}

// ---------- Environment data ----------
function initEnvironment(){
  document.getElementById('envTz').textContent =
    Intl.DateTimeFormat().resolvedOptions().timeZone || '--';
  document.getElementById('envRes').textContent =
    `${window.screen.width}×${window.screen.height}`;

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  document.getElementById('envConn').textContent =
    conn ? `${(conn.effectiveType || 'ONLINE').toUpperCase()}` : (navigator.onLine ? 'ONLINE' : 'OFFLINE');

  const ua = navigator.userAgent;
  let agent = 'UNBEKANNT';
  if (/Chrome/.test(ua) && !/Edg/.test(ua)) agent = 'CHROME';
  else if (/Firefox/.test(ua)) agent = 'FIREFOX';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) agent = 'SAFARI';
  else if (/Edg/.test(ua)) agent = 'EDGE';
  document.getElementById('envAgent').textContent = agent;

  if (navigator.getBattery){
    navigator.getBattery().then(batt => {
      const setBatt = () => {
        document.getElementById('envBatt').textContent =
          `${Math.round(batt.level * 100)}% ${batt.charging ? '⚡' : ''}`;
      };
      setBatt();
      batt.addEventListener('levelchange', setBatt);
      batt.addEventListener('chargingchange', setBatt);
    }).catch(() => {
      document.getElementById('envBatt').textContent = 'N/V';
    });
  } else {
    document.getElementById('envBatt').textContent = 'N/V';
  }

  document.getElementById('geoTag').textContent = 'ANFRAGE...';
  if (navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude.toFixed(3);
        const lon = pos.coords.longitude.toFixed(3);
        document.getElementById('envCoord').textContent = `${lat}, ${lon}`;
        document.getElementById('geoTag').textContent = 'GEORTET';
      },
      () => {
        document.getElementById('envCoord').textContent = 'ZUGRIFF VERWEIGERT';
        document.getElementById('geoTag').textContent = 'GESPERRT';
      },
      { timeout: 6000 }
    );
  } else {
    document.getElementById('envCoord').textContent = 'N/V';
    document.getElementById('geoTag').textContent = 'N/V';
  }
}

// ---------- Suit stats flicker ----------
function updateSuit(){
  const integ = Math.round(randomWalk(98, 92, 100, 4));
  document.getElementById('suitInteg').textContent = integ + '%';
  const repStates = ['BEREIT','GELADEN','STANDBY'];
  const flightStates = ['STANDBY','BEREIT','GESPERRT'];
  document.getElementById('suitRep').textContent = repStates[Math.floor(Math.random()*repStates.length)];
  document.getElementById('suitFlight').textContent = flightStates[Math.floor(Math.random()*flightStates.length)];
}

// ---------- Start ----------
function startDashboard(){
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(tickUptime, 1000);

  updateMeters();
  setInterval(updateMeters, 2200);

  setPower(96 + Math.random()*4);
  setInterval(() => setPower(94 + Math.random()*6), 4000);

  pushLog();
  setInterval(pushLog, 3400);

  initEnvironment();
  updateSuit();
  setInterval(updateSuit, 5000);

  typewriter();
}

// ================== NEURONALES GEHIRN (Memory Core) ==================
const brain = {
  entries: [],
  functions: [],
  view: 'data',
};

async function brainApi(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch (_) { /* no JSON body */ }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

function setBrainTag(text, ok){
  const tag = document.getElementById('brainTag');
  tag.textContent = text;
  tag.style.color = ok === false ? 'var(--red)' : '';
  tag.style.borderColor = ok === false ? 'rgba(255,59,59,.5)' : '';
}

function fmtTime(iso){
  try {
    return new Date(iso).toLocaleString('de-DE', { hour12:false });
  } catch (_) {
    return iso;
  }
}

function el(tag, className, text){
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderEntries(){
  const list = document.getElementById('dataList');
  const empty = document.getElementById('dataEmpty');
  list.innerHTML = '';
  empty.hidden = brain.entries.length > 0;

  brain.entries.forEach(entry => {
    const card = el('li', 'brain-card');
    const head = el('div', 'brain-card-head');
    head.appendChild(el('span', 'brain-card-title', entry.title));
    if (entry.tag) head.appendChild(el('span', 'brain-card-tag', entry.tag));
    card.appendChild(head);
    card.appendChild(el('div', 'brain-card-body', entry.content));
    card.appendChild(el('div', 'brain-card-meta', `AKTUALISIERT ${fmtTime(entry.updatedAt)}`));

    const actions = el('div', 'brain-card-actions');
    const delBtn = el('button', 'delete-btn', 'LÖSCHEN');
    delBtn.type = 'button';
    delBtn.addEventListener('click', () => deleteEntry(entry.id));
    actions.appendChild(delBtn);
    card.appendChild(actions);

    list.appendChild(card);
  });
}

function renderFunctions(){
  const list = document.getElementById('funcList');
  const empty = document.getElementById('funcEmpty');
  list.innerHTML = '';
  empty.hidden = brain.functions.length > 0;

  brain.functions.forEach(fn => {
    const card = el('li', 'brain-card');
    const head = el('div', 'brain-card-head');
    head.appendChild(el('span', 'brain-card-title', fn.name));
    if (fn.trigger) head.appendChild(el('span', 'brain-card-tag', fn.trigger));
    card.appendChild(head);
    if (fn.description) card.appendChild(el('div', 'brain-card-body', fn.description));
    card.appendChild(el('pre', 'brain-card-code', fn.code));
    card.appendChild(el('div', 'brain-card-meta', `AKTUALISIERT ${fmtTime(fn.updatedAt)}`));

    const actions = el('div', 'brain-card-actions');
    const runBtn = el('button', 'run-btn', 'AUSFÜHREN');
    runBtn.type = 'button';
    const delBtn = el('button', 'delete-btn', 'LÖSCHEN');
    delBtn.type = 'button';
    delBtn.addEventListener('click', () => deleteFunction(fn.id));
    actions.appendChild(runBtn);
    actions.appendChild(delBtn);
    card.appendChild(actions);

    let resultBox = null;
    runBtn.addEventListener('click', () => {
      if (resultBox) resultBox.remove();
      resultBox = el('div', 'brain-card-result');
      try {
        const runner = new Function(fn.code);
        const value = runner();
        resultBox.textContent = `→ ${value === undefined ? '(kein Rückgabewert)' : JSON.stringify(value)}`;
      } catch (err) {
        resultBox.classList.add('is-error');
        resultBox.textContent = `FEHLER: ${err.message}`;
      }
      card.appendChild(resultBox);
    });

    list.appendChild(card);
  });
}

async function loadEntries(query){
  try {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    brain.entries = await brainApi(`/api/memory${q}`);
    renderEntries();
  } catch (err) {
    setBrainTag('OFFLINE', false);
  }
}

async function loadFunctions(){
  try {
    brain.functions = await brainApi('/api/functions');
    renderFunctions();
  } catch (err) {
    setBrainTag('OFFLINE', false);
  }
}

async function deleteEntry(id){
  try {
    await brainApi(`/api/memory/${id}`, { method: 'DELETE' });
    await loadEntries(document.getElementById('dataSearch').value.trim());
  } catch (err) {
    alert(`Löschen fehlgeschlagen: ${err.message}`);
  }
}

async function deleteFunction(id){
  try {
    await brainApi(`/api/functions/${id}`, { method: 'DELETE' });
    await loadFunctions();
  } catch (err) {
    alert(`Löschen fehlgeschlagen: ${err.message}`);
  }
}

function initBrainTabs(){
  const tabs = document.querySelectorAll('.brain-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      brain.view = tab.dataset.view;
      document.getElementById('view-data').hidden = brain.view !== 'data';
      document.getElementById('view-functions').hidden = brain.view !== 'functions';
    });
  });
}

function initBrainForms(){
  document.getElementById('dataForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('dataTitle').value.trim();
    const tag = document.getElementById('dataTag').value.trim();
    const content = document.getElementById('dataContent').value.trim();
    try {
      await brainApi('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, tag, content }),
      });
      e.target.reset();
      await loadEntries();
    } catch (err) {
      alert(`Speichern fehlgeschlagen: ${err.message}`);
    }
  });

  document.getElementById('funcForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('funcName').value.trim();
    const trigger = document.getElementById('funcTrigger').value.trim();
    const description = document.getElementById('funcDesc').value.trim();
    const code = document.getElementById('funcCode').value.trim();
    try {
      await brainApi('/api/functions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, trigger, description, code }),
      });
      e.target.reset();
      await loadFunctions();
    } catch (err) {
      alert(`Speichern fehlgeschlagen: ${err.message}`);
    }
  });

  let searchTimer = null;
  document.getElementById('dataSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const value = e.target.value.trim();
    searchTimer = setTimeout(() => loadEntries(value), 250);
  });
}

async function initBrain(){
  initBrainTabs();
  initBrainForms();
  try {
    await brainApi('/api/health');
    setBrainTag('ONLINE', true);
  } catch (err) {
    setBrainTag('OFFLINE', false);
    return;
  }
  loadEntries();
  loadFunctions();
}

window.addEventListener('DOMContentLoaded', runBoot);
window.addEventListener('DOMContentLoaded', initBrain);
