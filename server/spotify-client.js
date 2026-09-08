const config = require('./config');
const tokenStore = require('./token-store');

async function getAccessToken() {
  const saved = tokenStore.getTokens('spotify');
  if (!saved) throw new Error('Spotify ist nicht verbunden. Bitte zuerst unter /auth/spotify autorisieren.');

  const stillValid = saved.expiresAt && Date.now() < saved.expiresAt - 60000;
  if (stillValid) return saved.accessToken;

  if (!saved.refreshToken) throw new Error('Spotify-Sitzung abgelaufen, bitte erneut unter /auth/spotify verbinden.');

  const basicAuth = Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64');
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: saved.refreshToken });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Spotify-Token-Refresh fehlgeschlagen (Status ${res.status}).`);
  const tokens = await res.json();
  tokenStore.saveTokens('spotify', {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || saved.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope,
  });
  return tokens.access_token;
}

async function spotifyFetch(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  return res;
}

module.exports = { getAccessToken, spotifyFetch };
