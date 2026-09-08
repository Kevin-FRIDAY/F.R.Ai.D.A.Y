// Gedächtnis: protokolliert automatisch, was im Dashboard passiert — jeder
// Weltlage-Befehl, jeder Sprachbefehl, jede Spotify-/YouTube-Suche und
// -Wiedergabe — als Grundlage für Vorlieben/Häufigkeiten. Getrennt von
// /api/memory (den frei angelegten Notizen im DATEN-Tab), da hier alles
// automatisch mitgeschrieben wird statt manuell angelegt zu werden.

const express = require('express');
const db = require('../db');

const router = express.Router();

const MAX_ROWS = 20000;
const LIMITS = { type: 60, content: 2000 };

// Typen, für die im GEDÄCHTNIS-Tab eine "Vorlieben"-Auswertung (häufigste
// Inhalte) angezeigt wird.
const PREFERENCE_TYPES = [
  'weltlage_suche',
  'sprachbefehl',
  'youtube_suche',
  'youtube_wiedergabe',
  'spotify_suche',
  'spotify_wiedergabe',
  'gmail_suche',
  'kalender_termin',
];

function toEvent(row) {
  let meta = null;
  if (row.meta) {
    try { meta = JSON.parse(row.meta); } catch (_) { meta = null; }
  }
  return { id: row.id, type: row.type, content: row.content, meta, createdAt: row.created_at };
}

router.post('/', (req, res) => {
  const type = typeof req.body.type === 'string' ? req.body.type.trim() : '';
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  const meta = req.body.meta && typeof req.body.meta === 'object' ? req.body.meta : null;

  if (!type) return res.status(400).json({ error: 'Typ ist erforderlich.' });
  if (!content) return res.status(400).json({ error: 'Inhalt ist erforderlich.' });
  if (type.length > LIMITS.type) return res.status(400).json({ error: `Typ darf höchstens ${LIMITS.type} Zeichen lang sein.` });
  if (content.length > LIMITS.content) return res.status(400).json({ error: `Inhalt darf höchstens ${LIMITS.content} Zeichen lang sein.` });

  const metaStr = meta ? JSON.stringify(meta).slice(0, 2000) : null;
  const now = new Date().toISOString();

  const result = db
    .prepare('INSERT INTO memory_events (type, content, meta, created_at) VALUES (?, ?, ?, ?)')
    .run(type, content, metaStr, now);

  db.prepare(
    `DELETE FROM memory_events WHERE id NOT IN (
       SELECT id FROM memory_events ORDER BY id DESC LIMIT ?
     )`
  ).run(MAX_ROWS);

  const row = db.prepare('SELECT * FROM memory_events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(toEvent(row));
});

router.get('/stats', (req, res) => {
  const totals = db
    .prepare('SELECT type, COUNT(*) as count FROM memory_events GROUP BY type ORDER BY count DESC')
    .all();

  const preferences = {};
  for (const type of PREFERENCE_TYPES) {
    preferences[type] = db
      .prepare(
        `SELECT MAX(content) as content, COUNT(*) as count, MAX(created_at) as lastAt
         FROM memory_events WHERE type = ?
         GROUP BY lower(content)
         ORDER BY count DESC, lastAt DESC
         LIMIT 8`
      )
      .all(type);
  }

  const totalCount = db.prepare('SELECT COUNT(*) as c FROM memory_events').get().c;

  res.json({ totalCount, totals, preferences });
});

router.get('/', (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  let rows;
  if (type && q) {
    rows = db
      .prepare('SELECT * FROM memory_events WHERE type = ? AND content LIKE ? ORDER BY id DESC LIMIT ?')
      .all(type, `%${q}%`, limit);
  } else if (type) {
    rows = db.prepare('SELECT * FROM memory_events WHERE type = ? ORDER BY id DESC LIMIT ?').all(type, limit);
  } else if (q) {
    rows = db.prepare('SELECT * FROM memory_events WHERE content LIKE ? ORDER BY id DESC LIMIT ?').all(`%${q}%`, limit);
  } else {
    rows = db.prepare('SELECT * FROM memory_events ORDER BY id DESC LIMIT ?').all(limit);
  }
  res.json(rows.map(toEvent));
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Ungültige ID.' });
  const result = db.prepare('DELETE FROM memory_events WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Eintrag nicht gefunden.' });
  res.status(204).end();
});

router.delete('/', (req, res) => {
  db.prepare('DELETE FROM memory_events').run();
  res.status(204).end();
});

module.exports = router;
