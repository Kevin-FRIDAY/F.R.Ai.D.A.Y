const express = require('express');
const config = require('../config');

const router = express.Router();

router.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'Parameter "q" ist erforderlich.' });
  if (!config.youtube.isConfigured()) {
    return res.status(400).json({ error: 'YouTube ist nicht konfiguriert. YOUTUBE_API_KEY in .env setzen.' });
  }

  try {
    const params = new URLSearchParams({
      key: config.youtube.apiKey,
      part: 'snippet',
      type: 'video',
      maxResults: '10',
      q,
    });
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const data = await r.json();
    res.json(
      (data.items || []).map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || null,
      }))
    );
  } catch (err) {
    res.status(502).json({ error: 'YouTube-Suche fehlgeschlagen.', detail: err.message });
  }
});

module.exports = router;
