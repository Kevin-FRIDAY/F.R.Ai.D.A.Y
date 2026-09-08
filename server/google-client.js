const { google } = require('googleapis');
const config = require('./config');
const tokenStore = require('./token-store');

function createOAuthClient() {
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );

  const saved = tokenStore.getTokens('google');
  if (saved) {
    client.setCredentials({
      access_token: saved.accessToken,
      refresh_token: saved.refreshToken,
      expiry_date: saved.expiresAt,
    });
  }

  client.on('tokens', (tokens) => {
    tokenStore.saveTokens('google', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date,
      scope: tokens.scope,
    });
  });

  return client;
}

// Liefert einen einsatzbereiten OAuth2-Client; wirft, wenn nicht verbunden.
async function getAuthedClient() {
  if (!tokenStore.isConnected('google')) {
    throw new Error('Google ist nicht verbunden. Bitte zuerst unter /auth/google autorisieren.');
  }
  const client = createOAuthClient();
  // Stellt sicher, dass der Access-Token gültig ist (refresht bei Bedarf automatisch).
  await client.getAccessToken();
  return client;
}

module.exports = { createOAuthClient, getAuthedClient };
