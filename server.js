const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

const sessions = new Map(); // token -> userEmail
const users = new Map(); // email -> { email, password, name }
const invites = new Map(); // token -> { email, name }

// seed demo invite
const seedInvite = uuidv4();
invites.set(seedInvite, { email: 'invited@example.com', name: 'Invited User' });

function setAuthCookie(res, token) {
  res.cookie('auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 24
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies.auth_token;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  req.userEmail = sessions.get(token);
  next();
}

app.get('/api/invite/:token', (req, res) => {
  const data = invites.get(req.params.token);
  if (!data) {
    return res.status(404).json({ message: 'Invite not found' });
  }
  res.json({ invite: { token: req.params.token, email: data.email, name: data.name } });
});

app.post('/api/auth/accept-invite', (req, res) => {
  const { token, password, name } = req.body;
  if (!token || !password) {
    return res.status(400).json({ message: 'Token and password are required' });
  }
  const invite = invites.get(token);
  if (!invite) {
    return res.status(400).json({ message: 'Invalid invite token' });
  }
  const email = invite.email;
  if (users.has(email)) {
    return res.status(409).json({ message: 'User already exists for this invite' });
  }
  const user = { email, password, name: name || invite.name };
  users.set(email, user);
  invites.delete(token);
  const sessionToken = uuidv4();
  sessions.set(sessionToken, email);
  setAuthCookie(res, sessionToken);
  res.json({ user: { email, name: user.name } });
});

app.post('/api/auth/signup', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ message: 'Email, password, and name are required' });
  }
  if (users.has(email)) {
    return res.status(409).json({ message: 'User already exists' });
  }
  users.set(email, { email, password, name });
  const sessionToken = uuidv4();
  sessions.set(sessionToken, email);
  setAuthCookie(res, sessionToken);
  res.json({ user: { email, name } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email);
  if (!user || user.password !== password) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const sessionToken = uuidv4();
  sessions.set(sessionToken, email);
  setAuthCookie(res, sessionToken);
  res.json({ user: { email: user.email, name: user.name } });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.auth_token;
  if (token) {
    sessions.delete(token);
  }
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = users.get(req.userEmail);
  res.json({ user: { email: user.email, name: user.name } });
});

app.get('/api/invites', (req, res) => {
  const list = Array.from(invites.entries()).map(([token, info]) => ({ token, ...info }));
  res.json({ invites: list });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Demo invite token: ${seedInvite}`);
});
