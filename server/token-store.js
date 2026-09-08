const db = require('./db');

function saveTokens(provider, { accessToken, refreshToken, expiresAt, scope }) {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT refresh_token FROM oauth_tokens WHERE provider = ?').get(provider);
  // Manche Provider senden bei einem Refresh keinen neuen refresh_token mehr
  // (Google z.B. nur beim allerersten Consent) — den alten dann behalten.
  const finalRefreshToken = refreshToken || existing?.refresh_token || null;

  db.prepare(
    `INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, scope, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at,
       scope = excluded.scope,
       updated_at = excluded.updated_at`
  ).run(provider, accessToken || null, finalRefreshToken, expiresAt || null, scope || null, now);
}

function getTokens(provider) {
  const row = db.prepare('SELECT * FROM oauth_tokens WHERE provider = ?').get(provider);
  if (!row) return null;
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.expires_at,
    scope: row.scope,
  };
}

function clearTokens(provider) {
  db.prepare('DELETE FROM oauth_tokens WHERE provider = ?').run(provider);
}

function isConnected(provider) {
  const row = db.prepare('SELECT provider FROM oauth_tokens WHERE provider = ?').get(provider);
  return Boolean(row);
}

module.exports = { saveTokens, getTokens, clearTokens, isConnected };
