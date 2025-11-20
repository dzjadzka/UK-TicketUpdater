const test = require('node:test');
const assert = require('node:assert');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');

const execFileAsync = promisify(execFile);

const cliPath = path.resolve(__dirname, '..', 'src', 'index.js');
const dataDir = path.resolve(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'app.db');

const { after, afterEach } = test;

afterEach(async () => {
  await fs.promises.rm(dbPath, { force: true });
});

after(async () => {
  await fs.promises.rm(dataDir, { recursive: true, force: true });
});

test('CLI exits cleanly when no users are present', async () => {
  await fs.promises.mkdir(dataDir, { recursive: true });
  const { stdout, stderr } = await execFileAsync('node', [cliPath, '--db', dbPath]);
  assert.match(stdout, /No users found\./);
  assert.strictEqual(stderr, '');
});
