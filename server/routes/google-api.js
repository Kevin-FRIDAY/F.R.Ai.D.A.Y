const express = require('express');
const { google } = require('googleapis');
const { getAuthedClient } = require('../google-client');
const db = require('../db');

const router = express.Router();

function handleAuthError(res, err) {
  if (/nicht verbunden/.test(err.message)) return res.status(401).json({ error: err.message });
  res.status(502).json({ error: 'Google-API-Anfrage fehlgeschlagen.', detail: err.message });
}

function headerValue(headers, name) {
  const h = (headers || []).find(x => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

function encodeMimeMessage({ to, subject, body }) {
  const lines = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body,
  ];
  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ===================== GMAIL =====================

router.get('/mail', async (req, res) => {
  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: 'v1', auth });
    const max = Math.min(Number(req.query.max) || 15, 50);
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;

    const list = await gmail.users.messages.list({ userId: 'me', maxResults: max, q });
    const ids = list.data.messages || [];

    const messages = await Promise.all(
      ids.map(async ({ id }) => {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        const headers = msg.data.payload?.headers || [];
        return {
          id: msg.data.id,
          threadId: msg.data.threadId,
          from: headerValue(headers, 'From'),
          subject: headerValue(headers, 'Subject') || '(kein Betreff)',
          date: headerValue(headers, 'Date'),
          snippet: msg.data.snippet,
          unread: (msg.data.labelIds || []).includes('UNREAD'),
          labels: msg.data.labelIds || [],
        };
      })
    );

    res.json(messages);
  } catch (err) {
    handleAuthError(res, err);
  }
});

router.get('/mail/labels', async (req, res) => {
  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: 'v1', auth });
    const { data } = await gmail.users.labels.list({ userId: 'me' });
    res.json((data.labels || []).map(l => ({ id: l.id, name: l.name, type: l.type })));
  } catch (err) {
    handleAuthError(res, err);
  }
});

router.post('/mail/send', async (req, res) => {
  const { to, subject, body } = req.body || {};
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'to, subject und body sind erforderlich.' });
  }
  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: 'v1', auth });
    const raw = encodeMimeMessage({ to, subject, body });
    const { data } = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    res.status(201).json({ id: data.id });
  } catch (err) {
    handleAuthError(res, err);
  }
});

// "Mail sortieren": Labels hinzufügen/entfernen (z.B. archivieren, als gelesen markieren, einsortieren)
router.post('/mail/:id/labels', async (req, res) => {
  const { add, remove } = req.body || {};
  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: 'v1', auth });
    await gmail.users.messages.modify({
      userId: 'me',
      id: req.params.id,
      requestBody: { addLabelIds: add || [], removeLabelIds: remove || [] },
    });
    res.json({ ok: true });
  } catch (err) {
    handleAuthError(res, err);
  }
});

// ===================== KALENDER =====================

router.get('/calendar/events', async (req, res) => {
  try {
    const auth = await getAuthedClient();
    const calendar = google.calendar({ version: 'v3', auth });
    const max = Math.min(Number(req.query.max) || 15, 50);
    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: max,
      singleEvents: true,
      orderBy: 'startTime',
    });
    res.json(
      (data.items || []).map(e => ({
        id: e.id,
        summary: e.summary || '(ohne Titel)',
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        location: e.location || '',
        description: e.description || '',
      }))
    );
  } catch (err) {
    handleAuthError(res, err);
  }
});

router.post('/calendar/events', async (req, res) => {
  const { summary, start, end, description, location } = req.body || {};
  if (!summary || !start || !end) {
    return res.status(400).json({ error: 'summary, start und end sind erforderlich (ISO-Zeitstempel).' });
  }
  try {
    const auth = await getAuthedClient();
    const calendar = google.calendar({ version: 'v3', auth });
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        location,
        start: { dateTime: start },
        end: { dateTime: end },
      },
    });
    res.status(201).json({ id: data.id });
  } catch (err) {
    handleAuthError(res, err);
  }
});

// "Änderungen stellen": bestehenden Termin aktualisieren/verschieben
router.patch('/calendar/events/:id', async (req, res) => {
  const { summary, start, end, description, location } = req.body || {};
  try {
    const auth = await getAuthedClient();
    const calendar = google.calendar({ version: 'v3', auth });
    const requestBody = {};
    if (summary) requestBody.summary = summary;
    if (description !== undefined) requestBody.description = description;
    if (location !== undefined) requestBody.location = location;
    if (start) requestBody.start = { dateTime: start };
    if (end) requestBody.end = { dateTime: end };

    const { data } = await calendar.events.patch({
      calendarId: 'primary',
      eventId: req.params.id,
      requestBody,
    });
    res.json({ id: data.id });
  } catch (err) {
    handleAuthError(res, err);
  }
});

router.delete('/calendar/events/:id', async (req, res) => {
  try {
    const auth = await getAuthedClient();
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: 'primary', eventId: req.params.id });
    res.status(204).end();
  } catch (err) {
    handleAuthError(res, err);
  }
});

// ===================== KONTAKTE =====================

router.get('/contacts', async (req, res) => {
  const forceSync = req.query.sync === 'true';
  try {
    const cachedCount = db.prepare('SELECT COUNT(*) AS n FROM contacts_cache').get().n;
    if (!forceSync && cachedCount > 0) {
      const rows = db.prepare('SELECT id, name, email, phone FROM contacts_cache ORDER BY name').all();
      return res.json({ contacts: rows, source: 'cache' });
    }

    const auth = await getAuthedClient();
    const people = google.people({ version: 'v1', auth });
    const { data } = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 200,
      personFields: 'names,emailAddresses,phoneNumbers',
    });

    const contacts = (data.connections || [])
      .map(p => ({
        id: p.resourceName,
        name: p.names?.[0]?.displayName || '(ohne Namen)',
        email: p.emailAddresses?.[0]?.value || null,
        phone: p.phoneNumbers?.[0]?.value || null,
      }))
      .filter(c => c.email || c.phone);

    const now = new Date().toISOString();
    db.exec('DELETE FROM contacts_cache');
    const insert = db.prepare(
      'INSERT INTO contacts_cache (id, name, email, phone, synced_at) VALUES (?, ?, ?, ?, ?)'
    );
    for (const c of contacts) insert.run(c.id, c.name, c.email, c.phone, now);

    res.json({ contacts, source: 'google', syncedAt: now });
  } catch (err) {
    handleAuthError(res, err);
  }
});

module.exports = router;
