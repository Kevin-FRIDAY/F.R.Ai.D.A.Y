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

// ---------- Sensor log: echte Hintergrund-Aktivität ----------
// Zeigt, was der permanent laufende Hintergrunddienst (server/background.js)
// tatsächlich tut — keine erfundenen Meldungen.
async function pollActivityLog(){
  try {
    const res = await fetch('/api/activity?limit=6');
    if (!res.ok) return;
    const rows = await res.json();
    if (!rows.length) return;

    const list = document.getElementById('logList');
    list.innerHTML = '';
    rows.forEach(row => {
      const li = el('li');
      const t = new Date(row.createdAt).toLocaleTimeString('de-DE', { hour12:false });
      li.appendChild(el('span', 't', `[${t}]`));
      li.appendChild(el('span', undefined, row.message));
      list.appendChild(li);
    });
    document.getElementById('logTag').textContent =
      new Date(rows[0].createdAt).toLocaleTimeString('de-DE', { hour12:false });
  } catch (err) {
    // Server (noch) nicht erreichbar — Log bleibt wie zuletzt angezeigt.
  }
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

// ---------- Start ----------
function startDashboard(){
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(tickUptime, 1000);

  updateMeters();
  setInterval(updateMeters, 2200);

  pollActivityLog();
  setInterval(pollActivityLog, 15000);

  initEnvironment();

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

// Schreibt automatisch Weltlage-/Sprachbefehle sowie Spotify-/YouTube-
// Suchen und -Wiedergaben ins Gedächtnis (server/routes/memory-log.js).
// Bewusst "fire and forget": ein Logging-Fehler darf die eigentliche
// Aktion (Suche, Wiedergabe, …) nie blockieren oder sichtbar stören.
function logMemory(type, content, meta) {
  if (!content) return;
  fetch('/api/memory-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, content, meta: meta || null }),
  }).catch(() => { /* Gedächtnis-Log ist nicht kritisch */ });
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

  updateBrainIconWidget();
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

  updateBrainIconWidget();
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
  const tabs = document.querySelectorAll('.brain-panel .brain-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      brain.view = tab.dataset.view;
      document.getElementById('view-data').hidden = brain.view !== 'data';
      document.getElementById('view-functions').hidden = brain.view !== 'functions';
      document.getElementById('view-memory').hidden = brain.view !== 'memory';
      if (brain.view === 'memory') { loadMemoryLog(); loadMemoryStats(); }
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

// ---------- Gehirn-Icon-Widget (HUD-Kachel) ----------
let brainNetworkExpanded = false;

function updateBrainIconWidget(){
  const stats = document.getElementById('brainIconStats');
  const tag = document.getElementById('brainIconTag');
  if (!stats || !tag) return;
  const total = brain.entries.length + brain.functions.length;
  stats.textContent = `${brain.entries.length} EINTRÄGE · ${brain.functions.length} FUNKTIONEN`;
  tag.textContent = total > 0 ? 'AKTIV' : 'LEER';
  if (brainNetworkExpanded) renderBrainNetwork();
}

function renderBrainNetwork(){
  const svg = document.getElementById('brainNetworkSvg');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  svg.innerHTML = '';

  const items = [
    ...brain.entries.map(e => ({ type: 'data', label: e.title })),
    ...brain.functions.map(f => ({ type: 'func', label: f.name })),
  ];

  const cx = 150, cy = 130, radius = 95;

  const core = document.createElementNS(NS, 'circle');
  core.setAttribute('cx', cx); core.setAttribute('cy', cy); core.setAttribute('r', 20);
  core.setAttribute('class', 'brain-net-core');
  svg.appendChild(core);

  const coreLabel = document.createElementNS(NS, 'text');
  coreLabel.setAttribute('x', cx); coreLabel.setAttribute('y', cy + 4);
  coreLabel.setAttribute('class', 'brain-net-core-label');
  coreLabel.textContent = items.length;
  svg.appendChild(coreLabel);

  if (items.length === 0) {
    const msg = document.createElementNS(NS, 'text');
    msg.setAttribute('x', cx); msg.setAttribute('y', cy + 55);
    msg.setAttribute('class', 'brain-net-label');
    msg.setAttribute('text-anchor', 'middle');
    msg.textContent = 'Noch keine gespeicherten Daten';
    svg.appendChild(msg);
    return;
  }

  const shown = items.slice(0, 12);
  const extra = items.length - shown.length;

  shown.forEach((item, i) => {
    const angle = (-90 + (360 / shown.length) * i) * (Math.PI / 180);
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', cx); line.setAttribute('y1', cy);
    line.setAttribute('x2', x); line.setAttribute('y2', y);
    line.setAttribute('class', 'brain-net-line');
    svg.appendChild(line);

    const node = document.createElementNS(NS, 'circle');
    node.setAttribute('cx', x); node.setAttribute('cy', y); node.setAttribute('r', 5);
    node.setAttribute('class', 'brain-net-node' + (item.type === 'func' ? ' is-func' : ''));
    const title = document.createElementNS(NS, 'title');
    title.textContent = item.label;
    node.appendChild(title);
    svg.appendChild(node);

    const label = document.createElementNS(NS, 'text');
    const ly = y + (Math.sin(angle) >= 0 ? 14 : -10);
    label.setAttribute('x', x); label.setAttribute('y', ly);
    label.setAttribute('class', 'brain-net-label');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = item.label.length > 14 ? item.label.slice(0, 13) + '…' : item.label;
    svg.appendChild(label);
  });

  if (extra > 0) {
    const moreLabel = document.createElementNS(NS, 'text');
    moreLabel.setAttribute('x', cx); moreLabel.setAttribute('y', cy + radius + 24);
    moreLabel.setAttribute('class', 'brain-net-label');
    moreLabel.setAttribute('text-anchor', 'middle');
    moreLabel.textContent = `+${extra} weitere im Gehirn-Panel`;
    svg.appendChild(moreLabel);
  }
}

function toggleBrainNetwork(){
  brainNetworkExpanded = !brainNetworkExpanded;
  const toggle = document.getElementById('brainIconToggle');
  const network = document.getElementById('brainNetwork');
  toggle.setAttribute('aria-expanded', String(brainNetworkExpanded));
  network.hidden = !brainNetworkExpanded;
  if (brainNetworkExpanded) renderBrainNetwork();
}

function initBrainIcon(){
  document.getElementById('brainIconToggle').addEventListener('click', toggleBrainNetwork);
}

// ---------- Gedächtnis (automatisches Aktivitätsprotokoll) ----------
const MEMORY_TYPE_LABELS = {
  weltlage_suche: 'WELTLAGE',
  sprachbefehl: 'SPRACHBEFEHL',
  youtube_suche: 'YOUTUBE-SUCHE',
  youtube_wiedergabe: 'YOUTUBE-WIEDERGABE',
  spotify_suche: 'SPOTIFY-SUCHE',
  spotify_wiedergabe: 'SPOTIFY-WIEDERGABE',
};

function memoryTypeLabel(type){
  return MEMORY_TYPE_LABELS[type] || type.toUpperCase();
}

function renderMemoryList(events){
  const list = document.getElementById('memoryList');
  const empty = document.getElementById('memoryEmpty');
  list.innerHTML = '';
  empty.hidden = events.length > 0;

  events.forEach(ev => {
    const card = el('li', 'brain-card memory-card');
    const head = el('div', 'brain-card-head');
    head.appendChild(el('span', 'brain-card-title', ev.content));
    head.appendChild(el('span', 'brain-card-tag', memoryTypeLabel(ev.type)));
    card.appendChild(head);
    card.appendChild(el('div', 'brain-card-meta', fmtTime(ev.createdAt)));

    const actions = el('div', 'brain-card-actions');
    const delBtn = el('button', 'delete-btn', 'LÖSCHEN');
    delBtn.type = 'button';
    delBtn.addEventListener('click', async () => {
      try {
        await brainApi(`/api/memory-log/${ev.id}`, { method: 'DELETE' });
        await loadMemoryLog();
        await loadMemoryStats();
      } catch (err) {
        alert(`Löschen fehlgeschlagen: ${err.message}`);
      }
    });
    actions.appendChild(delBtn);
    card.appendChild(actions);

    list.appendChild(card);
  });
}

async function loadMemoryLog(){
  const q = document.getElementById('memorySearch').value.trim();
  const type = document.getElementById('memoryTypeFilter').value;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (type) params.set('type', type);
  try {
    const events = await brainApi(`/api/memory-log?${params.toString()}`);
    renderMemoryList(events);
  } catch (err) {
    /* Gedächtnis-Tab bleibt leer, Hauptfunktionen sind davon unabhängig */
  }
}

function renderMemoryStats(stats){
  const box = document.getElementById('memoryStats');
  box.innerHTML = '';

  const total = el('div', 'memory-stat-total', `${stats.totalCount} EREIGNISSE INSGESAMT GESPEICHERT`);
  box.appendChild(total);

  const groups = Object.entries(stats.preferences || {}).filter(([, items]) => items.length > 0);
  if (groups.length === 0) return;

  const grid = el('div', 'memory-pref-grid');
  groups.forEach(([type, items]) => {
    const col = el('div', 'memory-pref-col');
    col.appendChild(el('div', 'memory-pref-head', memoryTypeLabel(type)));
    const ul = el('ul', 'memory-pref-list');
    items.slice(0, 5).forEach(item => {
      const li = el('li', '');
      li.appendChild(el('span', 'memory-pref-name', item.content));
      li.appendChild(el('span', 'memory-pref-count', `×${item.count}`));
      ul.appendChild(li);
    });
    col.appendChild(ul);
    grid.appendChild(col);
  });
  box.appendChild(grid);
}

async function loadMemoryStats(){
  try {
    const stats = await brainApi('/api/memory-log/stats');
    renderMemoryStats(stats);
  } catch (err) {
    /* nicht kritisch */
  }
}

function initMemoryTab(){
  let searchTimer = null;
  document.getElementById('memorySearch').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadMemoryLog, 250);
  });
  document.getElementById('memoryTypeFilter').addEventListener('change', loadMemoryLog);
  document.getElementById('memoryClearBtn').addEventListener('click', async () => {
    if (!confirm('Wirklich das gesamte Gedächtnis löschen? Das kann nicht rückgängig gemacht werden.')) return;
    try {
      await brainApi('/api/memory-log', { method: 'DELETE' });
      await loadMemoryLog();
      await loadMemoryStats();
    } catch (err) {
      alert(`Löschen fehlgeschlagen: ${err.message}`);
    }
  });
}

async function initBrain(){
  initBrainTabs();
  initBrainForms();
  initBrainIcon();
  initMemoryTab();
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

// ================== WELTLAGE-GLOBUS (Kommandozentrale) ==================
const GLOBE_RADIUS = 1;
const globeState = {
  group: null,
  markers: new Map(),
  rotationY: 0.4,
  focusing: false,
  focusFrom: 0,
  focusTo: 0,
  focusStart: 0,
  focusDuration: 1200,
  activeCode: null,
};

function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function thetaFromLon(lon) {
  return (lon + 180) * (Math.PI / 180);
}

function buildGraticule(group) {
  const lineMat = new THREE.LineBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.32 });

  for (let lat = -60; lat <= 60; lat += 30) {
    const points = [];
    for (let i = 0; i <= 64; i++) {
      points.push(latLonToVector3(lat, (i / 64) * 360 - 180, GLOBE_RADIUS));
    }
    group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), lineMat));
  }

  for (let lon = -180; lon < 180; lon += 30) {
    const points = [];
    for (let i = 0; i <= 64; i++) {
      points.push(latLonToVector3((i / 64) * 180 - 90, lon, GLOBE_RADIUS));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMat));
  }

  const coreGeom = new THREE.SphereGeometry(GLOBE_RADIUS * 0.985, 32, 32);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x1a0d05, transparent: true, opacity: 0.55 });
  group.add(new THREE.Mesh(coreGeom, coreMat));
}

async function initGlobe() {
  if (typeof THREE === 'undefined') {
    setGlobeStatus('3D-Bibliothek konnte nicht geladen werden.', true);
    return;
  }
  const canvas = document.getElementById('globeCanvas');
  const stage = canvas.parentElement;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
  camera.position.set(0, 0, 2.6);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const group = new THREE.Group();
  scene.add(group);
  buildGraticule(group);
  globeState.group = group;

  let countries = [];
  try {
    countries = await brainApi('/api/news/countries');
  } catch (err) {
    countries = [];
  }

  countries.forEach(c => {
    const pos = latLonToVector3(c.lat, c.lon, GLOBE_RADIUS * 1.02);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.45 })
    );
    marker.position.copy(pos);
    group.add(marker);
    globeState.markers.set(c.code, marker);
  });

  function resize() {
    const size = stage.clientWidth;
    if (!size) return;
    renderer.setSize(size, size, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function animate(time) {
    requestAnimationFrame(animate);

    if (globeState.focusing) {
      const t = Math.min(1, (time - globeState.focusStart) / globeState.focusDuration);
      const eased = 1 - Math.pow(1 - t, 3);
      globeState.rotationY = globeState.focusFrom + (globeState.focusTo - globeState.focusFrom) * eased;
      if (t >= 1) globeState.focusing = false;
    } else {
      globeState.rotationY += 0.0015;
    }
    group.rotation.y = globeState.rotationY;

    globeState.markers.forEach((marker, code) => {
      const isActive = code === globeState.activeCode;
      marker.scale.setScalar(isActive ? 1 + Math.sin(time / 200) * 0.25 : 1);
      marker.material.opacity = isActive ? 1 : 0.45;
      marker.material.color.set(isActive ? 0xffb347 : 0xff7a1a);
    });

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

function focusGlobeOnCountry(code, lon) {
  const marker = globeState.markers.get(code);
  if (!marker) return;
  globeState.activeCode = code;

  const theta = thetaFromLon(lon);
  let target = Math.PI / 2 - theta;
  const current = globeState.rotationY;
  while (target - current > Math.PI) target -= 2 * Math.PI;
  while (target - current < -Math.PI) target += 2 * Math.PI;

  globeState.focusFrom = current;
  globeState.focusTo = target;
  globeState.focusStart = performance.now();
  globeState.focusing = true;
}

function setGlobeStatus(text, isError) {
  const el = document.getElementById('globeStatus');
  el.textContent = text;
  el.classList.toggle('is-error', Boolean(isError));
}

function renderNewsMedia(container, item) {
  container.innerHTML = '';
  if (item.image) {
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.title || '';
    img.loading = 'lazy';
    img.addEventListener('error', () => img.remove());
    container.appendChild(img);
  }
  if (item.video) {
    const url = item.video;
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
    if (ytMatch) {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${ytMatch[1]}`;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      container.appendChild(iframe);
    } else if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
      const video = document.createElement('video');
      video.src = url;
      video.controls = true;
      container.appendChild(video);
    }
  }
}

// ---------- Automatische Stimmauswahl ----------
// Sucht unter den vom Browser/Betriebssystem angebotenen (lizenzfreien)
// Stimmen automatisch die beste deutsche aus — bevorzugt Cloud-/Premium-
// Stimmen (Google, Neural, Enhanced, …) vor einfachen Kompakt-/eSpeak-Stimmen.
let voicesPromise = null;
function getVoicesAsync(){
  if (voicesPromise) return voicesPromise;
  voicesPromise = new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve([]);
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) return resolve(existing);
    const onChange = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChange);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', onChange);
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChange);
      resolve(window.speechSynthesis.getVoices());
    }, 1200);
  });
  return voicesPromise;
}

function scoreGermanVoice(voice){
  const lang = voice.lang.toLowerCase();
  if (!lang.startsWith('de')) return -1;
  let score = lang === 'de-de' ? 5 : 2;
  if (voice.localService === false) score += 4; // meist Cloud-/Premiumstimmen
  const name = voice.name.toLowerCase();
  if (/google|neural|enhanced|premium|natural|online|wavenet/.test(name)) score += 5;
  if (/compact|espeak/.test(name)) score -= 6;
  if (voice.default) score += 1;
  return score;
}

let cachedBestVoice; // undefined = noch nicht gesucht, null = keine deutsche Stimme gefunden
async function getBestGermanVoice(){
  if (cachedBestVoice !== undefined) return cachedBestVoice;
  const voices = await getVoicesAsync();
  const ranked = voices
    .map(v => ({ v, s: scoreGermanVoice(v) }))
    .filter(x => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  cachedBestVoice = ranked.length ? ranked[0].v : null;

  const speakBtn = document.getElementById('newsSpeakBtn');
  if (speakBtn) {
    speakBtn.title = cachedBestVoice
      ? `Stimme: ${cachedBestVoice.name}`
      : 'Keine deutsche Stimme gefunden — Systemstandard';
  }
  return cachedBestVoice;
}

async function speakText(text, lang) {
  if (!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  if (lang) utter.lang = lang;
  const bestVoice = await getBestGermanVoice();
  if (bestVoice) utter.voice = bestVoice;
  const speakBtn = document.getElementById('newsSpeakBtn');
  utter.addEventListener('start', () => speakBtn.classList.add('is-speaking'));
  utter.addEventListener('end', () => speakBtn.classList.remove('is-speaking'));
  utter.addEventListener('error', () => speakBtn.classList.remove('is-speaking'));
  window.speechSynthesis.speak(utter);
}

async function runGlobeCommand(rawText, viaVoice) {
  const text = (rawText || '').trim();
  if (!text) return;
  logMemory('weltlage_suche', text, { viaVoice: Boolean(viaVoice) });

  const card = document.getElementById('newsCard');
  const tag = document.getElementById('globeTag');
  setGlobeStatus(`Suche Weltlage für "${text}" …`);
  tag.textContent = 'SUCHE…';

  try {
    const data = await brainApi(`/api/news?country=${encodeURIComponent(text)}`);
    const titleDe = data.titleDe || data.title;
    const isTranslated = titleDe !== data.title;

    document.getElementById('newsCountry').textContent = data.country;
    document.getElementById('newsSource').textContent = data.source || '';
    document.getElementById('newsTitle').textContent = titleDe;
    const origEl = document.getElementById('newsTitleOrig');
    if (isTranslated) {
      origEl.textContent = `Original: „${data.title}“`;
      origEl.hidden = false;
    } else {
      origEl.hidden = true;
    }
    const link = document.getElementById('newsLink');
    link.href = data.link || '#';
    renderNewsMedia(document.getElementById('newsMedia'), data);
    card.hidden = false;

    setGlobeStatus(
      data.stale
        ? `${data.country}: Quelle gerade nicht erreichbar — letzter bekannter Stand.`
        : `${data.country}: Top-Meldung von ${data.source}.`
    );
    tag.textContent = 'ONLINE';

    focusGlobeOnCountry(data.code, data.lon);
    speakText(titleDe, 'de-DE');
  } catch (err) {
    setGlobeStatus(err.message || 'Land nicht erkannt.', true);
    tag.textContent = 'FEHLER';
  }
}

function initGlobeCommand() {
  const form = document.getElementById('globeCommandForm');
  const input = document.getElementById('globeCommandInput');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    runGlobeCommand(input.value);
  });

  document.getElementById('newsSpeakBtn').addEventListener('click', () => {
    speakText(document.getElementById('newsTitle').textContent, 'de-DE');
  });

  initWakeWordListening(input);
}

// "Friday" hört permanent mit, reagiert aber nur auf Sätze, die das
// Weckwort "Friday" (bzw. die Aussprache "Fraiday") enthalten — alles
// danach wird als Befehl behandelt (z.B. "Friday, zeig mir Japan").
const WAKE_WORD_RE = /\b(?:fr[ai]?day|f\.?r\.?a\.?i\.?d\.?a\.?y)\b[,:]?\s*(.*)$/i;

function setWakeStatus(text, isActive) {
  const el = document.getElementById('wakeStatus');
  const textEl = document.getElementById('wakeStatusText');
  if (!el || !textEl) return;
  textEl.textContent = text;
  el.classList.toggle('is-active', Boolean(isActive));
}

function initWakeWordListening(input) {
  const micBtn = document.getElementById('micButton');
  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionImpl) {
    micBtn.disabled = true;
    micBtn.title = 'Spracheingabe wird von diesem Browser nicht unterstützt';
    setWakeStatus('Dauerzuhören wird von diesem Browser nicht unterstützt.', false);
    return;
  }

  const recognition = new SpeechRecognitionImpl();
  recognition.lang = 'de-DE';
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let wantListening = false; // true = Nutzer hat Dauerzuhören aktiviert

  recognition.addEventListener('start', () => {
    micBtn.classList.add('is-listening');
    setWakeStatus('Dauerzuhören aktiv — sag „Friday“, gefolgt von deinem Befehl.', true);
  });

  recognition.addEventListener('end', () => {
    micBtn.classList.remove('is-listening');
    if (wantListening) {
      // Browser beendet Erkennung nach einer Weile automatisch — neu starten,
      // solange der Nutzer Dauerzuhören nicht selbst ausgeschaltet hat.
      try { recognition.start(); } catch (err) { /* läuft bereits */ }
    } else {
      setWakeStatus('Dauerzuhören aus — Mikrofon aktivieren, dann reagiert F.R.Ai.D.A.Y nur auf „Friday …“.', false);
    }
  });

  recognition.addEventListener('error', (event) => {
    micBtn.classList.remove('is-listening');
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      wantListening = false;
      setWakeStatus('Mikrofonzugriff verweigert.', false);
    }
    // andere Fehler (z.B. "no-speech") werden vom "end"-Handler abgefangen,
    // der bei aktivem Dauerzuhören automatisch neu startet.
  });

  recognition.addEventListener('result', (event) => {
    const last = event.results[event.results.length - 1];
    const transcript = last[0].transcript.trim();
    const match = transcript.match(WAKE_WORD_RE);
    if (!match) return; // kein "Friday" gehört -> ignorieren

    logMemory('sprachbefehl', transcript);

    const command = match[1].trim();
    if (!command) {
      setWakeStatus('Ja, Sir? Sag z.B. „Friday, zeig mir Deutschland“.', true);
      return;
    }
    input.value = command;
    runGlobeCommand(command, true);
  });

  micBtn.addEventListener('click', () => {
    wantListening = !wantListening;
    if (wantListening) {
      try { recognition.start(); } catch (err) { /* läuft bereits */ }
    } else {
      recognition.stop();
    }
  });
}

// ================== INTEGRATIONEN (Google / Spotify / YouTube) ==================

async function apiJson(path, options) {
  const res = await fetch(path, options);
  let body = null;
  try { body = await res.json(); } catch (_) { /* kein JSON */ }
  if (!res.ok) throw new Error((body && body.error) || `HTTP ${res.status}`);
  return body;
}

function fmtDateTime(iso){
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('de-DE', { hour12:false }); }
  catch (_) { return iso; }
}

function toDatetimeLocalValue(date){
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function refreshIntegrationStatus(){
  try {
    const status = await apiJson('/auth/status');

    const googleStatus = document.getElementById('googleStatus');
    const googleConnectBtn = document.getElementById('googleConnectBtn');
    const googleDisconnectBtn = document.getElementById('googleDisconnectBtn');
    if (status.google.connected) {
      googleStatus.textContent = 'VERBUNDEN';
      googleStatus.classList.add('is-connected');
      googleConnectBtn.hidden = true;
      googleDisconnectBtn.hidden = false;
    } else {
      googleStatus.textContent = status.google.configured ? 'GETRENNT' : 'NICHT KONFIGURIERT';
      googleStatus.classList.remove('is-connected');
      googleConnectBtn.hidden = !status.google.configured;
      googleDisconnectBtn.hidden = true;
    }

    const spotifyStatus = document.getElementById('spotifyStatus');
    const spotifyConnectBtn = document.getElementById('spotifyConnectBtn');
    const spotifyDisconnectBtn = document.getElementById('spotifyDisconnectBtn');
    if (status.spotify.connected) {
      spotifyStatus.textContent = 'VERBUNDEN';
      spotifyStatus.classList.add('is-connected');
      spotifyConnectBtn.hidden = true;
      spotifyDisconnectBtn.hidden = false;
    } else {
      spotifyStatus.textContent = status.spotify.configured ? 'GETRENNT' : 'NICHT KONFIGURIERT';
      spotifyStatus.classList.remove('is-connected');
      spotifyConnectBtn.hidden = !status.spotify.configured;
      spotifyDisconnectBtn.hidden = true;
    }
  } catch (err) {
    // Statusabfrage fehlgeschlagen — Anzeige bleibt auf "PRÜFE…", kein harter Fehler nötig.
  }
}

function initIntegrationsTabs(){
  const tabs = document.querySelectorAll('.int-tab');
  const views = ['mail', 'calendar', 'contacts', 'spotify', 'youtube', 'whatsapp'];
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const active = tab.dataset.intView;
      views.forEach(v => { document.getElementById(`int-view-${v}`).hidden = v !== active; });
    });
  });
}

function initIntegrationConnectButtons(){
  document.getElementById('googleDisconnectBtn').addEventListener('click', async () => {
    await apiJson('/auth/google/disconnect', { method: 'POST' });
    refreshIntegrationStatus();
  });
  document.getElementById('spotifyDisconnectBtn').addEventListener('click', async () => {
    await apiJson('/auth/spotify/disconnect', { method: 'POST' });
    refreshIntegrationStatus();
  });
}

// ---------- Mail ----------
function renderMailList(messages){
  const list = document.getElementById('mailList');
  const empty = document.getElementById('mailEmpty');
  list.innerHTML = '';
  empty.hidden = messages.length > 0;

  messages.forEach(msg => {
    const card = el('li', 'brain-card mail-card' + (msg.unread ? ' is-unread' : ''));
    const head = el('div', 'brain-card-head');
    head.appendChild(el('span', 'brain-card-title', msg.subject));
    head.appendChild(el('span', 'brain-card-tag', msg.from.split('<')[0].trim()));
    card.appendChild(head);
    card.appendChild(el('div', 'brain-card-body', msg.snippet || ''));
    card.appendChild(el('div', 'brain-card-meta', fmtDateTime(msg.date)));

    const actions = el('div', 'brain-card-actions');
    if (msg.unread) {
      const readBtn = el('button', '', 'ALS GELESEN');
      readBtn.type = 'button';
      readBtn.addEventListener('click', async () => {
        await apiJson(`/api/google/mail/${msg.id}/labels`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ remove: ['UNREAD'] }),
        });
        loadMail();
      });
      actions.appendChild(readBtn);
    }
    const archiveBtn = el('button', '', 'ARCHIVIEREN');
    archiveBtn.type = 'button';
    archiveBtn.addEventListener('click', async () => {
      await apiJson(`/api/google/mail/${msg.id}/labels`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remove: ['INBOX'] }),
      });
      loadMail();
    });
    actions.appendChild(archiveBtn);
    card.appendChild(actions);

    list.appendChild(card);
  });
}

async function loadMail(){
  try {
    const messages = await apiJson('/api/google/mail?max=15');
    renderMailList(messages);
  } catch (err) {
    document.getElementById('mailEmpty').hidden = false;
    document.getElementById('mailEmpty').textContent = err.message;
    document.getElementById('mailList').innerHTML = '';
  }
}

function initMail(){
  document.getElementById('mailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const to = document.getElementById('mailTo').value.trim();
    const subject = document.getElementById('mailSubject').value.trim();
    const body = document.getElementById('mailBody').value.trim();
    try {
      await apiJson('/api/google/mail/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body }),
      });
      e.target.reset();
      loadMail();
    } catch (err) {
      alert(`Senden fehlgeschlagen: ${err.message}`);
    }
  });
  document.getElementById('mailRefreshBtn').addEventListener('click', loadMail);
}

// ---------- Kalender ----------
function renderCalendarList(events){
  const list = document.getElementById('calList');
  const empty = document.getElementById('calEmpty');
  list.innerHTML = '';
  empty.hidden = events.length > 0;

  events.forEach(ev => {
    const card = el('li', 'brain-card cal-card');
    const head = el('div', 'brain-card-head');
    head.appendChild(el('span', 'brain-card-title', ev.summary));
    if (ev.location) head.appendChild(el('span', 'brain-card-tag', ev.location));
    card.appendChild(head);
    card.appendChild(el('div', 'brain-card-meta', `${fmtDateTime(ev.start)} – ${fmtDateTime(ev.end)}`));

    const actions = el('div', 'brain-card-actions');
    const moveBtn = el('button', '', 'VERSCHIEBEN');
    moveBtn.type = 'button';
    moveBtn.addEventListener('click', async () => {
      const newStart = prompt('Neuer Start (JJJJ-MM-TTTHH:MM), z.B. 2026-09-10T14:00', ev.start?.slice(0,16) || '');
      if (!newStart) return;
      const newEnd = prompt('Neues Ende (JJJJ-MM-TTTHH:MM)', ev.end?.slice(0,16) || '');
      if (!newEnd) return;
      try {
        await apiJson(`/api/google/calendar/events/${ev.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start: newStart, end: newEnd }),
        });
        loadCalendar();
      } catch (err) {
        alert(`Verschieben fehlgeschlagen: ${err.message}`);
      }
    });
    actions.appendChild(moveBtn);

    const delBtn = el('button', 'delete-btn', 'LÖSCHEN');
    delBtn.type = 'button';
    delBtn.addEventListener('click', async () => {
      try {
        await apiJson(`/api/google/calendar/events/${ev.id}`, { method: 'DELETE' });
        loadCalendar();
      } catch (err) {
        alert(`Löschen fehlgeschlagen: ${err.message}`);
      }
    });
    actions.appendChild(delBtn);
    card.appendChild(actions);

    list.appendChild(card);
  });
}

async function loadCalendar(){
  try {
    const events = await apiJson('/api/google/calendar/events?max=15');
    renderCalendarList(events);
  } catch (err) {
    document.getElementById('calEmpty').hidden = false;
    document.getElementById('calEmpty').textContent = err.message;
    document.getElementById('calList').innerHTML = '';
  }
}

function initCalendar(){
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  document.getElementById('calStart').value = toDatetimeLocalValue(now);
  document.getElementById('calEnd').value = toDatetimeLocalValue(later);

  document.getElementById('calendarForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const summary = document.getElementById('calSummary').value.trim();
    const start = document.getElementById('calStart').value;
    const end = document.getElementById('calEnd').value;
    const location = document.getElementById('calLocation').value.trim();
    try {
      await apiJson('/api/google/calendar/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, start, end, location }),
      });
      e.target.reset();
      document.getElementById('calStart').value = toDatetimeLocalValue(now);
      document.getElementById('calEnd').value = toDatetimeLocalValue(later);
      loadCalendar();
    } catch (err) {
      alert(`Anlegen fehlgeschlagen: ${err.message}`);
    }
  });
  document.getElementById('calRefreshBtn').addEventListener('click', loadCalendar);
}

// ---------- Kontakte ----------
let allContacts = [];

function renderContactsList(contacts){
  const list = document.getElementById('contactsList');
  const empty = document.getElementById('contactsEmpty');
  list.innerHTML = '';
  empty.hidden = contacts.length > 0;

  contacts.forEach(c => {
    const card = el('li', 'brain-card contact-card');
    const head = el('div', 'brain-card-head');
    head.appendChild(el('span', 'brain-card-title', c.name));
    if (c.phone) head.appendChild(el('span', 'brain-card-tag', c.phone));
    card.appendChild(head);
    if (c.email) card.appendChild(el('div', 'brain-card-body', c.email));

    card.addEventListener('click', () => {
      if (!c.email) return;
      document.getElementById('mailTo').value = c.email;
      document.querySelector('.int-tab[data-int-view="mail"]').click();
      document.getElementById('mailSubject').focus();
    });

    list.appendChild(card);
  });
}

async function loadContacts(forceSync){
  try {
    const data = await apiJson(`/api/google/contacts${forceSync ? '?sync=true' : ''}`);
    allContacts = data.contacts || [];
    renderContactsList(allContacts);
  } catch (err) {
    document.getElementById('contactsEmpty').hidden = false;
    document.getElementById('contactsEmpty').textContent = err.message;
    document.getElementById('contactsList').innerHTML = '';
  }
}

function initContacts(){
  document.getElementById('contactsSyncBtn').addEventListener('click', () => loadContacts(true));
  document.getElementById('contactsSearch').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = !q ? allContacts : allContacts.filter(c =>
      (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
    );
    renderContactsList(filtered);
  });
}

// ---------- Spotify ----------
async function loadSpotifyNow(){
  try {
    const data = await apiJson('/api/spotify/player');
    const now = document.getElementById('spotifyNow');
    const empty = document.getElementById('spotifyEmpty');
    if (!data.playing) {
      now.hidden = true;
      empty.hidden = false;
      empty.textContent = 'Keine Wiedergabe — Spotify verbinden und ein Gerät öffnen.';
      return;
    }
    now.hidden = false;
    empty.hidden = true;
    document.getElementById('spotifyNowImg').src = data.image || '';
    document.getElementById('spotifyNowTrack').textContent = data.track || '';
    document.getElementById('spotifyNowArtist').textContent = data.artist || '';
  } catch (err) {
    document.getElementById('spotifyNow').hidden = true;
    document.getElementById('spotifyEmpty').hidden = false;
    document.getElementById('spotifyEmpty').textContent = err.message;
  }
}

function renderSpotifyResults(tracks){
  const list = document.getElementById('spotifyResults');
  list.innerHTML = '';
  tracks.forEach(t => {
    const card = el('li', 'brain-card');
    const head = el('div', 'brain-card-head');
    head.appendChild(el('span', 'brain-card-title', t.name));
    head.appendChild(el('span', 'brain-card-tag', t.artist));
    card.appendChild(head);
    const actions = el('div', 'brain-card-actions');
    const playBtn = el('button', '', '▶ ABSPIELEN');
    playBtn.type = 'button';
    playBtn.addEventListener('click', async () => {
      try {
        await apiJson('/api/spotify/player/play', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uri: t.uri }),
        });
        logMemory('spotify_wiedergabe', `${t.name} — ${t.artist}`, { uri: t.uri });
        setTimeout(loadSpotifyNow, 800);
      } catch (err) {
        alert(`Abspielen fehlgeschlagen: ${err.message}`);
      }
    });
    actions.appendChild(playBtn);
    card.appendChild(actions);
    list.appendChild(card);
  });
}

function initSpotify(){
  document.getElementById('spotifySearchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = document.getElementById('spotifySearchInput').value.trim();
    if (!q) return;
    logMemory('spotify_suche', q);
    try {
      const tracks = await apiJson(`/api/spotify/search?q=${encodeURIComponent(q)}`);
      renderSpotifyResults(tracks);
    } catch (err) {
      alert(`Suche fehlgeschlagen: ${err.message}`);
    }
  });

  document.getElementById('spotifyPlayBtn').addEventListener('click', async () => {
    await apiJson('/api/spotify/player/play', { method: 'PUT' });
    setTimeout(loadSpotifyNow, 500);
  });
  document.getElementById('spotifyPauseBtn').addEventListener('click', async () => {
    await apiJson('/api/spotify/player/pause', { method: 'PUT' });
    setTimeout(loadSpotifyNow, 500);
  });
  document.getElementById('spotifyNextBtn').addEventListener('click', async () => {
    await apiJson('/api/spotify/player/next', { method: 'POST' });
    setTimeout(loadSpotifyNow, 500);
  });
  document.getElementById('spotifyPrevBtn').addEventListener('click', async () => {
    await apiJson('/api/spotify/player/previous', { method: 'POST' });
    setTimeout(loadSpotifyNow, 500);
  });
}

// ---------- YouTube ----------
function initYoutube(){
  document.getElementById('youtubeSearchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = document.getElementById('youtubeSearchInput').value.trim();
    if (!q) return;
    logMemory('youtube_suche', q);
    try {
      const results = await apiJson(`/api/youtube/search?q=${encodeURIComponent(q)}`);
      const list = document.getElementById('youtubeResults');
      list.innerHTML = '';
      results.forEach(r => {
        const card = el('li', 'brain-card yt-card');
        if (r.thumbnail) {
          const img = document.createElement('img');
          img.src = r.thumbnail;
          img.alt = '';
          card.appendChild(img);
        }
        const info = el('div', 'yt-card-info');
        info.appendChild(el('div', 'yt-card-title', r.title));
        info.appendChild(el('div', 'yt-card-channel', r.channel));
        card.appendChild(info);
        card.addEventListener('click', () => {
          document.getElementById('youtubePlayer').hidden = false;
          document.getElementById('youtubeIframe').src = `https://www.youtube.com/embed/${r.videoId}?autoplay=1`;
          logMemory('youtube_wiedergabe', r.title, { channel: r.channel });
        });
        list.appendChild(card);
      });
    } catch (err) {
      alert(`YouTube-Suche fehlgeschlagen: ${err.message}`);
    }
  });
}

// ---------- WhatsApp (inoffiziell) ----------
let waPollTimer = null;

function showOnly(id, ids){
  ids.forEach(i => { document.getElementById(i).hidden = i !== id; });
}

function renderWaState(state){
  const boxes = ['waDisconnected', 'waInitializing', 'waQr', 'waError'];
  const readyEl = document.getElementById('waReady');

  if (state.status === 'ready') {
    boxes.forEach(id => { document.getElementById(id).hidden = true; });
    readyEl.hidden = false;
    return;
  }
  readyEl.hidden = true;

  if (state.status === 'qr' && state.qrDataUrl) {
    showOnly('waQr', boxes);
    document.getElementById('waQrImg').src = state.qrDataUrl;
  } else if (state.status === 'initializing' || state.status === 'authenticated') {
    showOnly('waInitializing', boxes);
  } else if (state.status === 'auth_failure') {
    showOnly('waError', boxes);
    document.getElementById('waErrorText').textContent = state.error || 'Verbindung fehlgeschlagen.';
  } else {
    showOnly('waDisconnected', boxes);
  }
}

async function pollWaStatus(){
  try {
    const state = await apiJson('/api/whatsapp/status');
    renderWaState(state);
    if (state.status === 'ready' || state.status === 'disconnected') {
      clearInterval(waPollTimer);
      waPollTimer = null;
    }
  } catch (err) {
    // Statusabfrage fehlgeschlagen — beim nächsten Poll erneut versuchen.
  }
}

function startWaPolling(){
  if (waPollTimer) return;
  pollWaStatus();
  waPollTimer = setInterval(pollWaStatus, 2500);
}

function renderWaContacts(contacts){
  const list = document.getElementById('waContactResults');
  list.innerHTML = '';
  contacts.forEach(c => {
    const card = el('li', 'brain-card contact-card');
    const head = el('div', 'brain-card-head');
    head.appendChild(el('span', 'brain-card-title', c.name));
    if (c.number) head.appendChild(el('span', 'brain-card-tag', c.number));
    card.appendChild(head);
    card.addEventListener('click', () => {
      document.getElementById('waTo').value = c.id;
      list.innerHTML = '';
      document.getElementById('waSearchInput').value = c.name;
    });
    list.appendChild(card);
  });
}

function initWhatsapp(){
  document.getElementById('waConnectBtn').addEventListener('click', async () => {
    await apiJson('/api/whatsapp/connect', { method: 'POST' });
    startWaPolling();
  });
  document.getElementById('waRetryBtn').addEventListener('click', async () => {
    await apiJson('/api/whatsapp/connect', { method: 'POST' });
    startWaPolling();
  });
  document.getElementById('waLogoutBtn').addEventListener('click', async () => {
    await apiJson('/api/whatsapp/logout', { method: 'POST' });
    renderWaState({ status: 'disconnected' });
  });

  let searchTimer = null;
  document.getElementById('waSearchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (!q) { document.getElementById('waContactResults').innerHTML = ''; return; }
    searchTimer = setTimeout(async () => {
      try {
        const contacts = await apiJson(`/api/whatsapp/contacts?q=${encodeURIComponent(q)}`);
        renderWaContacts(contacts);
      } catch (err) { /* z.B. noch nicht verbunden — ignorieren */ }
    }, 300);
  });

  document.getElementById('waSendForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const to = document.getElementById('waTo').value.trim();
    const message = document.getElementById('waMessage').value.trim();
    try {
      await apiJson('/api/whatsapp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message }),
      });
      document.getElementById('waMessage').value = '';
    } catch (err) {
      alert(`Senden fehlgeschlagen: ${err.message}`);
    }
  });

  startWaPolling();
}

function initIntegrations(){
  initIntegrationsTabs();
  initIntegrationConnectButtons();
  initMail();
  initCalendar();
  initContacts();
  initSpotify();
  initYoutube();
  initWhatsapp();
  refreshIntegrationStatus();
  loadMail();
  loadCalendar();
  loadContacts(false);
  loadSpotifyNow();
}

window.addEventListener('DOMContentLoaded', runBoot);
window.addEventListener('DOMContentLoaded', initBrain);
window.addEventListener('DOMContentLoaded', initIntegrations);
window.addEventListener('DOMContentLoaded', () => {
  initGlobe();
  initGlobeCommand();
});
