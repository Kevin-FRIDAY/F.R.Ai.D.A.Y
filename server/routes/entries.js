const express = require('express');
const db = require('../db');

const router = express.Router();

const LIMITS = { title: 200, content: 20000, tag: 60 };

function toEntry(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tag: row.tag,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validate(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const tag = typeof body.tag === 'string' ? body.tag.trim() : '';

  if (!title) return 'Titel ist erforderlich.';
  if (!content) return 'Inhalt ist erforderlich.';
  if (title.length > LIMITS.title) return `Titel darf höchstens ${LIMITS.title} Zeichen lang sein.`;
  if (content.length > LIMITS.content) return `Inhalt darf höchstens ${LIMITS.content} Zeichen lang sein.`;
  if (tag.length > LIMITS.tag) return `Tag darf höchstens ${LIMITS.tag} Zeichen lang sein.`;
  return null;
}

router.get('/', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db
      .prepare(
        `SELECT * FROM entries
         WHERE title LIKE ? OR content LIKE ? OR tag LIKE ?
         ORDER BY updated_at DESC`
      )
      .all(like, like, like);
  } else {
    rows = db.prepare('SELECT * FROM entries ORDER BY updated_at DESC').all();
  }
  res.json(rows.map(toEntry));
});

router.post('/', (req, res) => {
  const error = validate(req.body || {});
  if (error) return res.status(400).json({ error });

  const now = new Date().toISOString();
  const { title, content, tag } = req.body;
  const result = db
    .prepare('INSERT INTO entries (title, content, tag, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(title.trim(), content.trim(), (tag || '').trim() || null, now, now);

  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(toEntry(row));
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Ungültige ID.' });

  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Eintrag nicht gefunden.' });

  const merged = {
    title: req.body.title ?? existing.title,
    content: req.body.content ?? existing.content,
    tag: req.body.tag ?? existing.tag ?? '',
  };
  const error = validate(merged);
  if (error) return res.status(400).json({ error });

  const now = new Date().toISOString();
  db.prepare('UPDATE entries SET title = ?, content = ?, tag = ?, updated_at = ? WHERE id = ?').run(
    merged.title.trim(),
    merged.content.trim(),
    (merged.tag || '').trim() || null,
    now,
    id
  );

  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
  res.json(toEntry(row));
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Ungültige ID.' });

  const result = db.prepare('DELETE FROM entries WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Eintrag nicht gefunden.' });
  res.status(204).end();
});

module.exports = router;
