const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  appendHistoryEntry,
  downloadTicketForUser,
  loadUsers,
  parseArgs,
  readDb,
  writeDb
} = require('../src/ticketService');

describe('parseArgs', () => {
  test('returns defaults when no args provided', () => {
    const args = parseArgs(['node', 'script.js']);
    expect(args.headless).toBe(true);
    expect(args.product).toBe('firefox');
    expect(args.fileName).toBe('ticket.html');
  });

  test('overrides values from cli flags', () => {
    const args = parseArgs([
      'node',
      'script.js',
      '--headful',
      '--product=chrome',
      '--users=/tmp/users.json',
      '--output=./out',
      '--file=my.html',
      '--db=./db.json'
    ]);

    expect(args.headless).toBe(false);
    expect(args.product).toBe('chrome');
    expect(args.usersPath.endsWith('users.json')).toBe(true);
    expect(path.isAbsolute(args.outputDir)).toBe(true);
    expect(args.fileName).toBe('my.html');
    expect(args.dbPath.endsWith('db.json')).toBe(true);
  });
});

describe('loadUsers', () => {
  test('throws when file is missing', () => {
    expect(() => loadUsers('/tmp/missing-users.json')).toThrow(
      'Users file not found'
    );
  });

  test('throws when JSON is invalid', () => {
    const tmp = path.join(os.tmpdir(), 'bad-users.json');
    fs.writeFileSync(tmp, 'not-json');
    expect(() => loadUsers(tmp)).toThrow('invalid JSON');
    fs.unlinkSync(tmp);
  });

  test('throws when no users are provided', () => {
    const tmp = path.join(os.tmpdir(), 'empty-users.json');
    fs.writeFileSync(tmp, '[]');
    expect(() => loadUsers(tmp)).toThrow('at least one user');
    fs.unlinkSync(tmp);
  });
});

describe('database helpers', () => {
  let tmpDir;
  let dbPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-'));
    dbPath = path.join(tmpDir, 'history.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('readDb returns default structure when file missing', () => {
    const db = readDb(dbPath);
    expect(db).toEqual({ history: [] });
  });

  test('writeDb persists data', () => {
    writeDb(dbPath, { history: [{ userId: 'a' }] });
    const db = readDb(dbPath);
    expect(db.history).toHaveLength(1);
    expect(db.history[0].userId).toBe('a');
  });

  test('appendHistoryEntry appends and persists entry', () => {
    const entry = appendHistoryEntry(dbPath, {
      userId: 'b',
      status: 'success'
    });
    expect(entry.timestamp).toBeDefined();
    const db = readDb(dbPath);
    expect(db.history[0]).toMatchObject({ userId: 'b', status: 'success' });
  });
});

describe('downloadTicketForUser', () => {
  const user = { username: 'test', password: 'secret' };

  const createBrowserMock = (pageOverrides = {}) => {
    const page = {
      goto: jest.fn().mockResolvedValue(),
      type: jest.fn().mockResolvedValue(),
      waitForSelector: jest.fn().mockResolvedValue(),
      click: jest.fn().mockResolvedValue(),
      waitForNavigation: jest.fn().mockResolvedValue(),
      content: jest.fn().mockResolvedValue('<html></html>'),
      close: jest.fn().mockResolvedValue(),
      ...pageOverrides
    };

    return {
      newPage: jest.fn().mockResolvedValue(page)
    };
  };

  test('saves html on success', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-'));
    const browser = createBrowserMock();
    const result = await downloadTicketForUser(browser, user, {
      outputDir: tmpDir,
      fileName: 'file.html'
    });
    expect(result.status).toBe('success');
    expect(fs.readFileSync(path.join(tmpDir, 'file.html'), 'utf8')).toContain(
      '<html>'
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns error status when puppeteer fails', async () => {
    const browser = createBrowserMock({
      goto: jest.fn().mockRejectedValue(new Error('network'))
    });
    const result = await downloadTicketForUser(browser, user, {
      outputDir: os.tmpdir(),
      fileName: 'file.html'
    });
    expect(result.status).toBe('error');
    expect(result.error).toBeInstanceOf(Error);
  });
});
