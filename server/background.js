// Echter Hintergrunddienst: läuft permanent neben dem Server, hält bereits
// abgefragte Weltlage-Länder aktuell und protokolliert seine eigene
// Tätigkeit — sichtbar im Sensor-Log und im Gehirn-Icon des Dashboards.
// Kein simuliertes "Lernen" — nur echte, nachvollziehbare Aktionen.

const db = require('./db');
const news = require('./routes/news');
const weather = require('./routes/weather');

const CYCLE_MS = 4 * 60 * 1000; // alle 4 Minuten
const MAX_LOG_ROWS = 200;

function log(message) {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO activity_log (message, created_at) VALUES (?, ?)').run(message, now);
  db.prepare(
    `DELETE FROM activity_log WHERE id NOT IN (
       SELECT id FROM activity_log ORDER BY id DESC LIMIT ?
     )`
  ).run(MAX_LOG_ROWS);
}

async function runCycle() {
  const codes = news.getCachedCodes();

  if (codes.length === 0) {
    log('Selbstdiagnose abgeschlossen — noch keine Weltlage-Abfragen zum Aktualisieren.');
    return;
  }

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const code of codes) {
    try {
      const { data, changed } = await news.refreshCountryByCode(code);
      if (changed) {
        updated++;
        log(`Weltlage „${data.country}“ aktualisiert: ${data.titleDe || data.title}`);
      } else {
        unchanged++;
      }
    } catch (err) {
      failed++;
    }
  }

  if (unchanged > 0 || failed > 0) {
    const parts = [];
    if (unchanged > 0) parts.push(`${unchanged} unverändert`);
    if (failed > 0) parts.push(`${failed} nicht erreichbar`);
    log(`Hintergrundzyklus abgeschlossen — ${updated} aktualisiert, ${parts.join(', ')}.`);
  }

  for (const code of weather.getCachedCodes()) {
    try {
      const { data, changed } = await weather.refreshCountryByCode(code);
      if (changed) {
        log(`Wetter „${data.country}“ aktualisiert: ${Math.round(data.temperature)}°C, ${data.conditionDe}.`);
      }
    } catch (err) {
      // Wetterdienst kurzzeitig nicht erreichbar — beim nächsten Zyklus erneut versuchen.
    }
  }
}

function start() {
  log('F.R.Ai.D.A.Y-Hintergrunddienst gestartet — hält Weltlage-Daten aktuell.');
  runCycle().catch(() => {});
  setInterval(() => {
    runCycle().catch(() => {});
  }, CYCLE_MS);
}

function getRecentActivity(limit = 20) {
  return db
    .prepare('SELECT id, message, created_at FROM activity_log ORDER BY id DESC LIMIT ?')
    .all(Math.min(limit, MAX_LOG_ROWS));
}

module.exports = { start, getRecentActivity };
