const { parseArgs } = require('../src/cli');
const { main } = require('../src/index');
const { downloadTickets } = require('../src/downloader');
const { createDatabase } = require('../src/db');

// Mock dependencies
jest.mock('../src/downloader');
jest.mock('../src/db');

describe('index (DB-only)', () => {
  describe('parseArgs', () => {
    it('parses primary flags with defaults', () => {
      const args = parseArgs(['--output', './downloads']);
      expect(args.output).toBe('./downloads');
      expect(args.device).toBe('desktop_chrome');
      expect(args.queueBackend).toBe('memory');
      expect(args.db).toBe('./data/app.db');
    });

    it('supports overrides for device and queue backend', () => {
      const args = parseArgs(['--device', 'iphone_15_pro', '--queue-backend', 'persistent']);
      expect(args.device).toBe('iphone_15_pro');
      expect(args.queueBackend).toBe('persistent');
    });

    it('validates integer options', () => {
      expect(() => parseArgs(['--concurrency', 'not-a-number'])).toThrow();
      const parsed = parseArgs(['--concurrency', '5']);
      expect(parsed.concurrency).toBe(5);
    });
  });

  describe('main', () => {
    let mockDb;
    let consoleLogSpy;
    let consoleErrorSpy;

    beforeEach(() => {
      jest.clearAllMocks();
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockDb = {
        listActiveUsers: jest.fn(),
        close: jest.fn()
      };
      createDatabase.mockReturnValue(mockDb);
      downloadTickets.mockResolvedValue([]);

      process.argv = ['node', 'index.js'];
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('loads users from database when db path is specified', async () => {
      const mockUsers = [{ id: 'db-user-1', username: 'dbtest', password: 'dbpass' }];
      mockDb.listActiveUsers.mockReturnValue(mockUsers);

      process.argv = ['node', 'index.js', '--db=./data/test.db'];

      downloadTickets.mockResolvedValue([
        { status: 'success', deviceProfile: 'mobile_android', filePath: '/db/ticket.html', message: 'OK' }
      ]);

      await main();

      expect(createDatabase).toHaveBeenCalledWith(expect.stringContaining('test.db'));
      expect(mockDb.listActiveUsers).toHaveBeenCalled();
      expect(downloadTickets).toHaveBeenCalledWith(mockUsers, expect.objectContaining({ db: mockDb }));
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('closes database even if download fails', async () => {
      const mockUsers = [{ id: 'user-1', username: 'test', password: 'pass' }];
      mockDb.listActiveUsers.mockReturnValue(mockUsers);
      process.argv = ['node', 'index.js', '--db=./data/test.db'];

      downloadTickets.mockRejectedValue(new Error('Download failed'));

      await expect(main()).rejects.toThrow('Download failed');
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('throws error if no users found in database', async () => {
      mockDb.listActiveUsers.mockReturnValue([]);
      process.argv = ['node', 'index.js', '--db=./data/test.db'];

      await expect(main()).rejects.toThrow('No users found');
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('uses custom output directory from arguments', async () => {
      const mockUsers = [{ id: 'user-1', username: 'test', password: 'pass' }];
      mockDb.listActiveUsers.mockReturnValue(mockUsers);

      process.argv = ['node', 'index.js', '--db=./data/test.db', '--output=/custom/output'];

      downloadTickets.mockResolvedValue([
        { status: 'success', deviceProfile: 'desktop_chrome', filePath: '/custom/output/ticket.html', message: 'OK' }
      ]);

      await main();

      expect(downloadTickets).toHaveBeenCalledWith(
        mockUsers,
        expect.objectContaining({
          outputRoot: expect.stringContaining('/custom/output')
        })
      );
    });

    it('uses custom device profile from arguments', async () => {
      const mockUsers = [{ id: 'user-1', username: 'test', password: 'pass' }];
      mockDb.listActiveUsers.mockReturnValue(mockUsers);

      process.argv = ['node', 'index.js', '--db=./data/test.db', '--device=mobile_android'];

      downloadTickets.mockResolvedValue([
        { status: 'success', deviceProfile: 'mobile_android', filePath: '/ticket.html', message: 'OK' }
      ]);

      await main();

      expect(downloadTickets).toHaveBeenCalledWith(
        mockUsers,
        expect.objectContaining({ defaultDeviceProfile: 'mobile_android' })
      );
    });

    it('logs results for each user and handles missing file paths', async () => {
      const mockUsers = [
        { id: 'user-1', username: 'test1', password: 'pass1' },
        { id: 'user-2', username: 'test2', password: 'pass2' }
      ];
      mockDb.listActiveUsers.mockReturnValue(mockUsers);

      process.argv = ['node', 'index.js', '--db=./data/test.db'];

      downloadTickets.mockResolvedValue([
        { status: 'success', deviceProfile: 'desktop_chrome', filePath: '/ticket1.html', message: 'Downloaded' },
        { status: 'error', deviceProfile: 'mobile_android', filePath: null, message: 'Failed' }
      ]);

      await main();

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[user-1]'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[user-2]'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('status=success'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('status=error'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('file=n/a'));
    });

    it('uses default db path when no arguments provided', async () => {
      const mockUsers = [{ id: 'user-1', username: 'test', password: 'pass' }];
      mockDb.listActiveUsers.mockReturnValue(mockUsers);
      process.argv = ['node', 'index.js'];

      downloadTickets.mockResolvedValue([
        { status: 'success', deviceProfile: 'desktop_chrome', filePath: '/ticket.html', message: 'OK' }
      ]);

      await main();

      // Default DB path is ./data/app.db
      expect(createDatabase).toHaveBeenCalledWith(expect.stringContaining('data/app.db'));
      expect(downloadTickets).toHaveBeenCalledWith(
        mockUsers,
        expect.objectContaining({
          defaultDeviceProfile: 'desktop_chrome',
          outputRoot: expect.stringContaining('downloads')
        })
      );
    });

    it('propagates errors thrown in main function', async () => {
      const mockUsers = [{ id: 'user-1', username: 'test', password: 'pass' }];
      mockDb.listActiveUsers.mockReturnValue(mockUsers);
      process.argv = ['node', 'index.js', '--db=./data/test.db'];

      const testError = new Error('Critical download failure');
      downloadTickets.mockRejectedValue(testError);

      await expect(main()).rejects.toThrow('Critical download failure');
    });
  });
});
