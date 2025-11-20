const fs = require('fs');
const os = require('os');
const path = require('path');
const { run } = require('../src/ticketService');

jest.mock('puppeteer');

describe('run integration', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-users-'));
  const usersPath = path.join(tmpDir, 'users.json');
  const outputDir = path.join(tmpDir, 'output');
  const dbPath = path.join(tmpDir, 'history.json');

  beforeAll(() => {
    fs.mkdirSync(outputDir);
    fs.writeFileSync(
      usersPath,
      JSON.stringify([{ username: 'cliuser', password: 'pw' }], null, 2)
    );
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('processes users with injected browser launcher', async () => {
    const page = {
      goto: jest.fn().mockResolvedValue(),
      type: jest.fn().mockResolvedValue(),
      waitForSelector: jest.fn().mockResolvedValue(),
      click: jest.fn().mockResolvedValue(),
      waitForNavigation: jest.fn().mockResolvedValue(),
      content: jest.fn().mockResolvedValue('<html></html>'),
      close: jest.fn().mockResolvedValue()
    };

    const browser = {
      newPage: jest.fn().mockResolvedValue(page),
      close: jest.fn().mockResolvedValue()
    };

    const launch = jest.fn().mockResolvedValue(browser);

    await run(
      [
        'node',
        'ticket-downloader.js',
        `--users=${usersPath}`,
        `--output=${outputDir}`,
        `--file=ticket.html`,
        `--db=${dbPath}`
      ],
      { launch }
    );

    const history = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    expect(history.history[0].status).toBe('success');
    expect(fs.existsSync(path.join(outputDir, 'cliuser-ticket.html'))).toBe(
      true
    );
    expect(launch).toHaveBeenCalled();
    expect(browser.close).toHaveBeenCalled();
  });
});
