const express = require('express');
const crypto = require('node:crypto');
const config = require('../config');
const tokenStore = require('../token-store');
const { createOAuthClient } = require('../google-client');

const router = express.Router();

// Einfacher CSRF-Schutz für den OAuth-"state"-Parameter (In-Memory reicht,
// die Anmeldung passiert lokal durch den Server-Betreiber selbst).
const pendingStates = new Set();

router.get('/status', (req, res) => {
  res.json({
    google: { connected: tokenStore.isConnected('google'), configured: config.google.isConfigured() },
    spotify: { connected: tokenStore.isConnected('spotify'), configured: config.spotify.isConfigured() },
    youtube: { configured: config.youtube.isConfigured() },
  });
});

// ---------- Google ----------
router.get('/google', (req, res) => {
  if (!config.google.isConfigured()) {
    return res.status(400).send('Google ist nicht konfiguriert. GOOGLE_CLIENT_ID/SECRET in .env setzen.');
  }
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.add(state);
  const client = createOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: config.google.scopes,
    state,
  });
  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`Google-Autorisierung abgelehnt: ${error}`);
  if (!state || !pendingStates.has(state)) return res.status(400).send('Ungültiger oder abgelaufener state-Parameter.');
  pendingStates.delete(state);

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    tokenStore.saveTokens('google', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date,
      scope: tokens.scope,
    });
    res.redirect('/#integrations');
  } catch (err) {
    res.status(500).send(`Google-Token-Austausch fehlgeschlagen: ${err.message}`);
  }
});

router.post('/google/disconnect', (req, res) => {
  tokenStore.clearTokens('google');
  res.json({ ok: true });
});

// ---------- Spotify ----------
router.get('/spotify', (req, res) => {
  if (!config.spotify.isConfigured()) {
    return res.status(400).send('Spotify ist nicht konfiguriert. SPOTIFY_CLIENT_ID/SECRET in .env setzen.');
  }
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.add(state);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.spotify.clientId,
    scope: config.spotify.scopes,
    redirect_uri: config.spotify.redirectUri,
    state,
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

router.get('/spotify/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`Spotify-Autorisierung abgelehnt: ${error}`);
  if (!state || !pendingStates.has(state)) return res.status(400).send('Ungültiger oder abgelaufener state-Parameter.');
  pendingStates.delete(state);

  try {
    const basicAuth = Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.spotify.redirectUri,
    });
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!tokenRes.ok) throw new Error(`Spotify-Token-Status ${tokenRes.status}`);
    const tokens = await tokenRes.json();
    tokenStore.saveTokens('spotify', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
    });
    res.redirect('/#integrations');
  } catch (err) {
    res.status(500).send(`Spotify-Token-Austausch fehlgeschlagen: ${err.message}`);
  }
});

router.post('/spotify/disconnect', (req, res) => {
  tokenStore.clearTokens('spotify');
  res.json({ ok: true });
});

module.exports = router;
