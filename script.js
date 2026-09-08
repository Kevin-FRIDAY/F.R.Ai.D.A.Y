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

window.addEventListener('DOMContentLoaded', runBoot);
