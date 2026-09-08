const express = require('express');
const background = require('../background');

const router = express.Router();

router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const rows = background.getRecentActivity(limit);
  res.json(rows.map(r => ({ id: r.id, message: r.message, createdAt: r.created_at })));
});

module.exports = router;
