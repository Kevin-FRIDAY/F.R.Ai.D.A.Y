// Inoffizielle WhatsApp-Anbindung über whatsapp-web.js (steuert eine echte
// WhatsApp-Web-Sitzung im Hintergrund). Das verstößt gegen die WhatsApp-
// Nutzungsbedingungen und kann im schlimmsten Fall zur Kontosperrung führen —
// der Nutzer hat dieses Risiko bewusst akzeptiert. Deshalb startet die
// Sitzung nur, wenn explizit über /api/whatsapp/connect angefordert (kein
// automatischer Start beim Server-Boot).

const path = require('node:path');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const SESSION_DIR = path.join(__dirname, 'data', 'whatsapp-session');

const state = {
  status: 'disconnected', // disconnected | initializing | qr | authenticated | ready | auth_failure
  qrDataUrl: null,
  error: null,
};

let client = null;
let initializing = false;

function buildClient() {
  const puppeteerOptions = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const c = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
    puppeteer: puppeteerOptions,
  });

  c.on('qr', async (qr) => {
    state.status = 'qr';
    state.error = null;
    try {
      state.qrDataUrl = await QRCode.toDataURL(qr);
    } catch (err) {
      state.qrDataUrl = null;
    }
  });

  c.on('authenticated', () => {
    state.status = 'authenticated';
    state.qrDataUrl = null;
  });

  c.on('ready', () => {
    state.status = 'ready';
    state.qrDataUrl = null;
    state.error = null;
  });

  c.on('auth_failure', (msg) => {
    state.status = 'auth_failure';
    state.error = msg;
  });

  c.on('disconnected', () => {
    state.status = 'disconnected';
    state.qrDataUrl = null;
    client = null;
    initializing = false;
  });

  return c;
}

function connect() {
  if (client || initializing) return;
  initializing = true;
  state.status = 'initializing';
  state.error = null;
  client = buildClient();
  client.initialize().catch((err) => {
    state.status = 'auth_failure';
    state.error = err.message;
    initializing = false;
    client = null;
  });
}

async function logout() {
  if (client) {
    try { await client.logout(); } catch (err) { /* Sitzung evtl. schon weg */ }
    try { await client.destroy(); } catch (err) { /* ignorieren */ }
  }
  client = null;
  initializing = false;
  state.status = 'disconnected';
  state.qrDataUrl = null;
  state.error = null;
}

function getState() {
  return { ...state };
}

function normalizeChatId(to) {
  if (to.includes('@')) return to; // bereits eine vollständige WhatsApp-ID
  const digits = to.replace(/[^\d]/g, '');
  return `${digits}@c.us`;
}

async function sendMessage(to, message) {
  if (!client || state.status !== 'ready') {
    throw new Error('WhatsApp ist nicht verbunden. Bitte zuerst QR-Code scannen.');
  }
  const chatId = normalizeChatId(to);
  return client.sendMessage(chatId, message);
}

async function searchContacts(query) {
  if (!client || state.status !== 'ready') {
    throw new Error('WhatsApp ist nicht verbunden. Bitte zuerst QR-Code scannen.');
  }
  const contacts = await client.getContacts();
  const q = (query || '').toLowerCase();
  return contacts
    .filter(c => c.isMyContact && (c.name || c.pushname))
    .filter(c => !q || (c.name || c.pushname || '').toLowerCase().includes(q))
    .slice(0, 30)
    .map(c => ({
      id: c.id._serialized,
      name: c.name || c.pushname,
      number: c.number,
    }));
}

module.exports = { connect, logout, getState, sendMessage, searchContacts };
