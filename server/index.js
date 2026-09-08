const express = require('express');
const path = require('node:path');

const entriesRouter = require('./routes/entries');
const functionsRouter = require('./routes/functions');
const newsRouter = require('./routes/news');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

app.use('/api/memory', entriesRouter);
app.use('/api/functions', functionsRouter);
app.use('/api/news', newsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ONLINE', time: new Date().toISOString() });
});

// Only the specific frontend files are exposed — never the whole repo root,
// which would otherwise leak server code, the SQLite file, and node_modules.
const rootDir = path.join(__dirname, '..');
app.get('/', (req, res) => res.sendFile(path.join(rootDir, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(rootDir, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(rootDir, 'script.js')));
app.use('/assets', express.static(path.join(rootDir, 'assets')));

app.listen(PORT, () => {
  console.log(`F.R.Ai.D.A.Y Gehirn läuft auf http://localhost:${PORT}`);
});
