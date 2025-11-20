const express = require('express');

const app = express();
app.use(express.json());

function authMiddleware(req, res, next) {
  const apiToken = process.env.API_TOKEN;
  const allowInsecure = process.env.ALLOW_INSECURE === 'true';

  if (!apiToken && !allowInsecure) {
    return res.status(401).json({ error: 'API token not configured. Set API_TOKEN or ALLOW_INSECURE=true to bypass.' });
  }

  if (!apiToken && allowInsecure) {
    return next();
  }

  const authHeader = req.get('authorization');
  const bearerPrefix = 'bearer ';

  if (!authHeader || !authHeader.toLowerCase().startsWith(bearerPrefix)) {
    return res.status(401).json({ error: 'Missing API token.' });
  }

  const providedToken = authHeader.slice(bearerPrefix.length);

  if (providedToken !== apiToken) {
    return res.status(401).json({ error: 'Invalid API token.' });
  }

  return next();
}

app.use(authMiddleware);

app.get('/downloads', (req, res) => {
  res.json({ downloads: [] });
});

app.get('/history', (req, res) => {
  res.json({ history: [] });
});

app.get('/tickets/:userId', (req, res) => {
  const { userId } = req.params;
  res.json({ userId, tickets: [] });
});

const port = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${port}`);
  });
}

module.exports = { app, authMiddleware };
