require('dotenv').config();

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

module.exports = {
  BASE_URL,

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${BASE_URL}/auth/google/callback`,
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/contacts.readonly',
    ],
    isConfigured() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || `${BASE_URL}/auth/spotify/callback`,
    scopes: [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'playlist-read-private',
      'streaming',
    ].join(' '),
    isConfigured() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },

  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
    isConfigured() {
      return Boolean(this.apiKey);
    },
  },
};
