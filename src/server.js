const express = require('express');
const path = require('path');
const { randomUUID } = require('crypto');
const { readJson, writeJson } = require('./storage');
const { devicePresets } = require('./deviceProfiles');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const CREDENTIALS_FILE = 'credentials.json';
const CUSTOM_PROFILES_FILE = 'customDeviceProfiles.json';

function validateCredential(payload) {
  const errors = {};
  if (!payload.name || payload.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters long.';
  }
  if (!payload.username || payload.username.trim().length < 3) {
    errors.username = 'Username must be at least 3 characters long.';
  }
  if (!payload.password || payload.password.trim().length < 6) {
    errors.password = 'Password must be at least 6 characters long.';
  }
  return errors;
}

function validateDeviceProfile(payload) {
  const errors = {};
  if (!payload.label || payload.label.trim().length < 3) {
    errors.label = 'Label must be at least 3 characters long.';
  }
  if (!payload.userAgent || payload.userAgent.trim().length < 10) {
    errors.userAgent = 'User agent must be at least 10 characters long.';
  }
  const width = Number(payload.viewport?.width);
  const height = Number(payload.viewport?.height);
  if (!Number.isInteger(width) || width < 320) {
    errors.viewportWidth = 'Viewport width must be an integer of at least 320.';
  }
  if (!Number.isInteger(height) || height < 480) {
    errors.viewportHeight = 'Viewport height must be an integer of at least 480.';
  }
  if (payload.proxy && !/^https?:\/\//.test(payload.proxy)) {
    errors.proxy = 'Proxy must be empty or a valid URL starting with http/https.';
  }
  return errors;
}

app.get('/api/credentials', (_req, res) => {
  const credentials = readJson(CREDENTIALS_FILE);
  res.json(credentials);
});

app.post('/api/credentials', (req, res) => {
  const errors = validateCredential(req.body);
  if (Object.keys(errors).length) {
    res.status(400).json({ errors });
    return;
  }

  const credentials = readJson(CREDENTIALS_FILE);
  const newCredential = {
    id: randomUUID(),
    name: req.body.name.trim(),
    username: req.body.username.trim(),
    password: req.body.password.trim(),
    notes: req.body.notes?.trim() || '',
    createdAt: new Date().toISOString()
  };

  credentials.push(newCredential);
  writeJson(CREDENTIALS_FILE, credentials);
  res.status(201).json(newCredential);
});

app.put('/api/credentials/:id', (req, res) => {
  const credentialId = req.params.id;
  const errors = validateCredential(req.body);
  if (Object.keys(errors).length) {
    res.status(400).json({ errors });
    return;
  }

  const credentials = readJson(CREDENTIALS_FILE);
  const index = credentials.findIndex((cred) => cred.id === credentialId);
  if (index === -1) {
    res.status(404).json({ message: 'Credential not found' });
    return;
  }

  const updated = {
    ...credentials[index],
    name: req.body.name.trim(),
    username: req.body.username.trim(),
    password: req.body.password.trim(),
    notes: req.body.notes?.trim() || credentials[index].notes
  };

  credentials[index] = updated;
  writeJson(CREDENTIALS_FILE, credentials);
  res.json(updated);
});

app.delete('/api/credentials/:id', (req, res) => {
  const credentialId = req.params.id;
  const credentials = readJson(CREDENTIALS_FILE);
  const index = credentials.findIndex((cred) => cred.id === credentialId);
  if (index === -1) {
    res.status(404).json({ message: 'Credential not found' });
    return;
  }

  const [removed] = credentials.splice(index, 1);
  writeJson(CREDENTIALS_FILE, credentials);
  res.json(removed);
});

app.get('/api/device-profiles', (_req, res) => {
  const customProfiles = readJson(CUSTOM_PROFILES_FILE);
  res.json({ presets: devicePresets, custom: customProfiles });
});

app.post('/api/device-profiles', (req, res) => {
  const errors = validateDeviceProfile(req.body);
  if (Object.keys(errors).length) {
    res.status(400).json({ errors });
    return;
  }

  const customProfiles = readJson(CUSTOM_PROFILES_FILE);
  const newProfile = {
    id: randomUUID(),
    label: req.body.label.trim(),
    userAgent: req.body.userAgent.trim(),
    viewport: {
      width: Number(req.body.viewport?.width),
      height: Number(req.body.viewport?.height)
    },
    proxy: req.body.proxy?.trim() || ''
  };

  customProfiles.push(newProfile);
  writeJson(CUSTOM_PROFILES_FILE, customProfiles);
  res.status(201).json(newProfile);
});

app.put('/api/device-profiles/:id', (req, res) => {
  const profileId = req.params.id;
  const errors = validateDeviceProfile(req.body);
  if (Object.keys(errors).length) {
    res.status(400).json({ errors });
    return;
  }

  const customProfiles = readJson(CUSTOM_PROFILES_FILE);
  const index = customProfiles.findIndex((profile) => profile.id === profileId);
  if (index === -1) {
    res.status(404).json({ message: 'Custom profile not found' });
    return;
  }

  const updated = {
    ...customProfiles[index],
    label: req.body.label.trim(),
    userAgent: req.body.userAgent.trim(),
    viewport: {
      width: Number(req.body.viewport?.width),
      height: Number(req.body.viewport?.height)
    },
    proxy: req.body.proxy?.trim() || ''
  };

  customProfiles[index] = updated;
  writeJson(CUSTOM_PROFILES_FILE, customProfiles);
  res.json(updated);
});

app.delete('/api/device-profiles/:id', (req, res) => {
  const profileId = req.params.id;
  if (devicePresets.some((preset) => preset.id === profileId)) {
    res.status(400).json({ message: 'Preset profiles cannot be removed' });
    return;
  }

  const customProfiles = readJson(CUSTOM_PROFILES_FILE);
  const index = customProfiles.findIndex((profile) => profile.id === profileId);
  if (index === -1) {
    res.status(404).json({ message: 'Custom profile not found' });
    return;
  }

  const [removed] = customProfiles.splice(index, 1);
  writeJson(CUSTOM_PROFILES_FILE, customProfiles);
  res.json(removed);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
