// filepath: /Users/zozo/WebstormProjects/UK-TicketUpdater/__tests__/cli.test.js
const { parseArgs } = require('../src/cli');

describe('CLI argument parsing', () => {
  let warnSpy;
  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('--users only sets users and no warning', () => {
    const opts = parseArgs(['--users', './path/users.json']);
    expect(opts.users).toBe('./path/users.json');
    expect(opts.source).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('--source only maps to users and warns', () => {
    const opts = parseArgs(['--source', './alt/users.json']);
    expect(opts.users).toBe('./alt/users.json');
    // Source isn't persisted separately, only used for normalization
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/DEPRECATED/);
  });

  test('both --users and --source prefer explicit --users without extra warning', () => {
    const opts = parseArgs(['--users', './primary/users.json', '--source', './ignored.json']);
    expect(opts.users).toBe('./primary/users.json');
    // Normalization should not fire because users already set prior to source
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('--concurrency valid integer parses correctly', () => {
    const opts = parseArgs(['--concurrency', '5']);
    expect(opts.concurrency).toBe(5);
  });

  test('--concurrency invalid value throws CommanderError', () => {
    // Commander will throw when parsing invalid integer ("abc")
    expect(() => parseArgs(['--concurrency', 'abc'])).toThrow();
  });
});

