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
const ALLOW_INSECURE = process.env.ALLOW_INSECURE === 'true';

function authMiddleware(req, res, next) {
  // If no API_TOKEN is set and ALLOW_INSECURE is not explicitly enabled, reject
  if (!API_TOKEN && !ALLOW_INSECURE) {
    return res.status(401).json({ error: 'API token not configured. Set API_TOKEN or ALLOW_INSECURE=true to bypass.' });
  }

  // If no API_TOKEN but ALLOW_INSECURE is enabled, allow access
  if (!API_TOKEN && ALLOW_INSECURE) {
    return next();
  }

  // Check for authorization header
  const authHeader = req.get('authorization');
  const bearerPrefix = 'bearer ';

  if (!authHeader || !authHeader.toLowerCase().startsWith(bearerPrefix)) {
    return res.status(401).json({ error: 'Missing API token.' });
  }

  const providedToken = authHeader.slice(bearerPrefix.length);

  if (providedToken !== API_TOKEN) {
    return res.status(401).json({ error: 'Invalid API token.' });
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
      
      // Validate userIds if provided
      if (userIds !== undefined && !Array.isArray(userIds)) {
        return res.status(400).json({ error: 'userIds must be an array' });
      }
      
      // Validate deviceProfile if provided
      if (deviceProfile && typeof deviceProfile !== 'string') {
        return res.status(400).json({ error: 'deviceProfile must be a string' });
      }
      
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
    try {
      const limit = Number.parseInt(req.query.limit, 10) || 50;
      if (limit < 1 || limit > 1000) {
        return res.status(400).json({ error: 'limit must be between 1 and 1000' });
      }
      res.json({ history: db.listHistory(limit) });
    } catch (error) {
      console.error('Failed to retrieve history', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/tickets/:userId', (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'userId must be a non-empty string' });
      }
      res.json({ tickets: db.listTicketsByUser(userId) });
    } catch (error) {
      console.error('Failed to retrieve tickets', error);
      res.status(500).json({ error: error.message });
    }
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

module.exports = { createApp, start, authMiddleware };
