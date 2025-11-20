const express = require('express');
const path = require('path');
const { downloadTickets } = require('./downloader');
const { createDatabase } = require('./db');
const { DEFAULT_HISTORY_PATH } = require('./history');

const PORT = process.env.PORT || 3000;
const DEFAULT_DB_PATH = process.env.DB_PATH || './data/app.db';
const DEFAULT_OUTPUT = process.env.OUTPUT_ROOT || './downloads';
const DEFAULT_DEVICE = process.env.DEFAULT_DEVICE || 'desktop_chrome';
const API_TOKEN = process.env.API_TOKEN;

function authMiddleware(req, res, next) {
  if (!API_TOKEN) return next();
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const token = header.replace('Bearer ', '');
  if (token !== API_TOKEN) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  return next();
}

function createApp({ dbPath = DEFAULT_DB_PATH, outputRoot = DEFAULT_OUTPUT } = {}) {
  const app = express();
  const db = createDatabase(path.resolve(dbPath));

  app.use(express.json({ limit: '1mb' }));
  app.use(authMiddleware);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/downloads', async (req, res) => {
    try {
      const { userIds, deviceProfile, outputDir } = req.body || {};
      const users = Array.isArray(userIds) && userIds.length ? db.getUsersByIds(userIds) : db.getUsers();
      if (!users.length) return res.status(400).json({ error: 'No users available' });

      const results = await downloadTickets(users, {
        defaultDeviceProfile: deviceProfile || DEFAULT_DEVICE,
        outputRoot: path.resolve(outputDir || outputRoot),
        historyPath: DEFAULT_HISTORY_PATH,
        db
      });
      res.json({ results });
    } catch (error) {
      console.error('Failed to run download via API', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/history', (req, res) => {
    const limit = Number.parseInt(req.query.limit, 10) || 50;
    res.json({ history: db.listHistory(limit) });
  });

  app.get('/tickets/:userId', (req, res) => {
    const { userId } = req.params;
    res.json({ tickets: db.listTicketsByUser(userId) });
  });

  app.use((err, req, res, next) => {
    console.error('Unhandled error', err);
    res.status(500).json({ error: 'Unexpected server error' });
    next();
  });

  return { app, db };
}

function start() {
  const { app, db } = createApp();
  const server = app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  start();
}

module.exports = { createApp, start };
