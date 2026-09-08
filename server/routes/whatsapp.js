const express = require('express');
const wa = require('../whatsapp-client');

const router = express.Router();

router.get('/status', (req, res) => {
  res.json(wa.getState());
});

router.post('/connect', (req, res) => {
  wa.connect();
  res.json({ ok: true });
});

router.post('/logout', async (req, res) => {
  await wa.logout();
  res.json({ ok: true });
});

router.get('/contacts', async (req, res) => {
  try {
    const contacts = await wa.searchContacts(req.query.q);
    res.json(contacts);
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

router.post('/send', async (req, res) => {
  const { to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ error: 'to und message sind erforderlich.' });
  try {
    await wa.sendMessage(to, message);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

module.exports = router;
