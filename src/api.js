const express = require('express');
const { addFile, listFiles, deleteExpired, deleteFileById } = require('./db');

const app = express();
const port = process.env.PORT || 3000;
const DEFAULT_TTL_HOURS = Number(process.env.DEFAULT_TTL_HOURS || 720);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/files', async (req, res) => {
  try {
    const files = await listFiles({ userId: req.query.userId });
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/files', async (req, res) => {
  const { userId, path: filePath, status } = req.body;
  if (!userId || !filePath) {
    return res.status(400).json({ error: 'userId and path are required' });
  }
  try {
    const idRow = await addFile({ userId, filePath, status: status || 'active' });
    res.status(201).json({ id: idRow.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/files/expired', async (req, res) => {
  const ttlHours = Number(req.query.ttlHours || DEFAULT_TTL_HOURS);
  try {
    if (!Number.isFinite(ttlHours) || ttlHours <= 0) {
      return res.status(400).json({ error: 'ttlHours must be a positive number' });
    }
    const deleted = await deleteExpired(ttlHours);
    res.json({ deleted, ttlHours });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/files/:id', async (req, res) => {
  try {
    const deleted = await deleteFileById(Number(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: 'File entry not found' });
    }
    res.json({ deleted: deleted.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`File API listening on port ${port}`);
  console.log(`Default TTL: ${DEFAULT_TTL_HOURS}h`);
});
