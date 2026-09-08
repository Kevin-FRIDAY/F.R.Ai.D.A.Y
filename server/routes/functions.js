const express = require('express');
const db = require('../db');

const router = express.Router();

const LIMITS = { name: 120, trigger: 200, description: 500, code: 20000 };

function toFunction(row) {
  return {
    id: row.id,
    name: row.name,
    trigger: row.trigger_phrase,
    description: row.description,
    code: row.code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validate(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const trigger = typeof body.trigger === 'string' ? body.trigger.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!name) return 'Name ist erforderlich.';
  if (!code) return 'Code ist erforderlich.';
  if (name.length > LIMITS.name) return `Name darf höchstens ${LIMITS.name} Zeichen lang sein.`;
  if (code.length > LIMITS.code) return `Code darf höchstens ${LIMITS.code} Zeichen lang sein.`;
  if (trigger.length > LIMITS.trigger) return `Trigger darf höchstens ${LIMITS.trigger} Zeichen lang sein.`;
  if (description.length > LIMITS.description)
    return `Beschreibung darf höchstens ${LIMITS.description} Zeichen lang sein.`;
  return null;
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM functions ORDER BY updated_at DESC').all();
  res.json(rows.map(toFunction));
});

router.post('/', (req, res) => {
  const error = validate(req.body || {});
  if (error) return res.status(400).json({ error });

  const now = new Date().toISOString();
  const { name, code, trigger, description } = req.body;
  const result = db
    .prepare(
      `INSERT INTO functions (name, trigger_phrase, description, code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(name.trim(), (trigger || '').trim() || null, (description || '').trim() || null, code.trim(), now, now);

  const row = db.prepare('SELECT * FROM functions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(toFunction(row));
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Ungültige ID.' });

  const existing = db.prepare('SELECT * FROM functions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Funktion nicht gefunden.' });

  const merged = {
    name: req.body.name ?? existing.name,
    code: req.body.code ?? existing.code,
    trigger: req.body.trigger ?? existing.trigger_phrase ?? '',
    description: req.body.description ?? existing.description ?? '',
  };
  const error = validate(merged);
  if (error) return res.status(400).json({ error });

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE functions SET name = ?, trigger_phrase = ?, description = ?, code = ?, updated_at = ? WHERE id = ?`
  ).run(merged.name.trim(), (merged.trigger || '').trim() || null, (merged.description || '').trim() || null, merged.code.trim(), now, id);

  const row = db.prepare('SELECT * FROM functions WHERE id = ?').get(id);
  res.json(toFunction(row));
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Ungültige ID.' });

  const result = db.prepare('DELETE FROM functions WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Funktion nicht gefunden.' });
  res.status(204).end();
});

module.exports = router;
