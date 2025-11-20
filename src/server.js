import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const users = [
  { id: 'u-001', email: 'anna.schmidt@example.com', role: 'member', status: 'active' },
  { id: 'u-002', email: 'bjoern.keller@example.com', role: 'admin', status: 'active' },
  { id: 'u-003', email: 'carla.mueller@example.com', role: 'member', status: 'invited' }
];

const downloads = [
  { id: 'd-100', filename: 'Semesterticket-01-2025.pdf', size: '1.2 MB', downloadedAt: '2025-01-02T09:21:00Z' },
  { id: 'd-101', filename: 'Semesterticket-02-2025.pdf', size: '1.3 MB', downloadedAt: '2025-02-01T07:10:00Z' },
  { id: 'd-102', filename: 'Semesterticket-03-2025.pdf', size: '1.2 MB', downloadedAt: '2025-03-01T06:45:00Z' }
];

const invitations = [];

app.get('/api/users', (_req, res) => {
  res.json({ users });
});

app.get('/api/downloads', (_req, res) => {
  res.json({ downloads });
});

app.post('/api/invitations', (req, res) => {
  const { email, role = 'member' } = req.body;

  if (!email) {
    res.status(400).json({ message: 'Email is required' });
    return;
  }

  const invitation = {
    id: `inv-${Date.now()}`,
    email,
    role,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  invitations.push(invitation);
  res.status(201).json({ invitation });
});

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
