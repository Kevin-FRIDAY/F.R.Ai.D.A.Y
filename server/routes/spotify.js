const express = require('express');
const { spotifyFetch } = require('../spotify-client');

const router = express.Router();

function handleError(res, err) {
  if (/nicht verbunden|abgelaufen/.test(err.message)) return res.status(401).json({ error: err.message });
  res.status(502).json({ error: 'Spotify-Anfrage fehlgeschlagen.', detail: err.message });
}

router.get('/player', async (req, res) => {
  try {
    const r = await spotifyFetch('/me/player');
    if (r.status === 204) return res.json({ playing: false });
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const data = await r.json();
    res.json({
      playing: data.is_playing,
      track: data.item?.name,
      artist: (data.item?.artists || []).map(a => a.name).join(', '),
      album: data.item?.album?.name,
      image: data.item?.album?.images?.[0]?.url || null,
      progressMs: data.progress_ms,
      durationMs: data.item?.duration_ms,
      deviceName: data.device?.name || null,
    });
  } catch (err) {
    handleError(res, err);
  }
});

router.put('/player/play', async (req, res) => {
  try {
    const { uri } = req.body || {};
    const r = await spotifyFetch('/me/player/play', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: uri ? JSON.stringify({ uris: [uri] }) : undefined,
    });
    if (!r.ok && r.status !== 204) throw new Error(`Status ${r.status}`);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

router.put('/player/pause', async (req, res) => {
  try {
    const r = await spotifyFetch('/me/player/pause', { method: 'PUT' });
    if (!r.ok && r.status !== 204) throw new Error(`Status ${r.status}`);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/player/next', async (req, res) => {
  try {
    const r = await spotifyFetch('/me/player/next', { method: 'POST' });
    if (!r.ok && r.status !== 204) throw new Error(`Status ${r.status}`);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/player/previous', async (req, res) => {
  try {
    const r = await spotifyFetch('/me/player/previous', { method: 'POST' });
    if (!r.ok && r.status !== 204) throw new Error(`Status ${r.status}`);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'Parameter "q" ist erforderlich.' });
  try {
    const r = await spotifyFetch(`/search?type=track&limit=10&q=${encodeURIComponent(q)}`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const data = await r.json();
    res.json(
      (data.tracks?.items || []).map(t => ({
        uri: t.uri,
        name: t.name,
        artist: (t.artists || []).map(a => a.name).join(', '),
        image: t.album?.images?.[0]?.url || null,
      }))
    );
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/playlists', async (req, res) => {
  try {
    const r = await spotifyFetch('/me/playlists?limit=20');
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const data = await r.json();
    res.json(
      (data.items || []).map(p => ({
        uri: p.uri,
        name: p.name,
        tracks: p.tracks?.total,
        image: p.images?.[0]?.url || null,
      }))
    );
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
