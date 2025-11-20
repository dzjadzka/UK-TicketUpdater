const express = require('express');
const path = require('path');
const { downloadTickets } = require('./downloader');
const config = require('./config');
const { appendHistory, findLatestTicket, readHistory } = require('./history');

const app = express();
app.use(express.json());

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const apiKey = req.headers['x-api-key'];
  const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : apiKey;
  const match = config.apiTokens.find((entry) => entry.token === token);

  if (!match) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  req.auth = match;
  return next();
}

function authorizeDownload(requests, auth) {
  if (auth.role === 'admin') return true;
  return requests.every((req) => req.userId === auth.userId);
}

app.post('/downloads', authenticate, async (req, res) => {
  const incoming = Array.isArray(req.body?.requests) ? req.body.requests : [req.body];
  const validRequests = incoming.filter(Boolean);

  if (!validRequests.length) {
    return res.status(400).json({ message: 'No download requests provided' });
  }

  if (!authorizeDownload(validRequests, req.auth)) {
    return res.status(403).json({ message: 'Not allowed to start downloads for these users' });
  }

  const results = [];
  for (const request of validRequests) {
    const startedAt = new Date().toISOString();
    try {
      const outcome = await downloadTickets(request);
      const record = appendHistory({
        ...outcome,
        startedAt,
        finishedAt: new Date().toISOString()
      });
      results.push(record);
    } catch (error) {
      const record = appendHistory({
        status: 'error',
        userId: request.userId,
        error: error.message,
        startedAt,
        finishedAt: new Date().toISOString()
      });
      results.push(record);
    }
  }

  return res.status(200).json({ results });
});

app.get('/history', authenticate, (req, res) => {
  if (req.auth.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only' });
  }

  const history = readHistory();
  return res.json({ history });
});

app.get('/tickets/:userId', authenticate, (req, res) => {
  const { userId } = req.params;
  if (req.auth.role !== 'admin' && req.auth.userId !== userId) {
    return res.status(403).json({ message: 'Not allowed to access this ticket' });
  }

  const latest = findLatestTicket(userId);
  if (!latest || !latest.filePath) {
    return res.status(404).json({ message: 'No ticket found for this user' });
  }

  return res.sendFile(path.resolve(latest.filePath));
});

app.listen(config.port, () => {
  console.log(`API server listening on port ${config.port}`);
});

module.exports = app;
