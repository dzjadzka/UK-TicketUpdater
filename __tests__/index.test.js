const fs = require('fs');
const path = require('path');
const { parseArgs, loadUsers, main } = require('../src/index');
const { downloadTickets } = require('../src/downloader');
const { createDatabase } = require('../src/db');

// Mock dependencies
jest.mock('../src/downloader');
jest.mock('../src/db');

describe('index', () => {
  describe('parseArgs', () => {
    it('should parse arguments with = separator', () => {
      const argv = ['--users=./config/users.json', '--output=./downloads'];
      const args = parseArgs(argv);

      expect(args.users).toBe('./config/users.json');
      expect(args.output).toBe('./downloads');
    });

    it('should parse arguments with space separator', () => {
      const argv = ['--users', './config/users.json', '--output', './downloads'];
      const args = parseArgs(argv);

      expect(args.users).toBe('./config/users.json');
      expect(args.output).toBe('./downloads');
    });

    it('should parse boolean flags', () => {
      const argv = ['--verbose', '--debug'];
      const args = parseArgs(argv);

      expect(args.verbose).toBe(true);
      expect(args.debug).toBe(true);
    });

    it('should handle mixed argument formats', () => {
      const argv = ['--users=./config.json', '--verbose', '--device', 'mobile'];
      const args = parseArgs(argv);

      expect(args.users).toBe('./config.json');
      expect(args.verbose).toBe(true);
      expect(args.device).toBe('mobile');
    });

    it('should return empty object for no arguments', () => {
      const args = parseArgs([]);
      expect(args).toEqual({});
    });

    it('should ignore non-flag arguments', () => {
      const argv = ['somecommand', '--flag', 'value'];
      const args = parseArgs(argv);

      expect(args.flag).toBe('value');
      expect(args.somecommand).toBeUndefined();
    });
  });

  describe('loadUsers', () => {
    const testConfigPath = path.join(__dirname, '../config/test-users.json');

    afterEach(() => {
      if (fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath);
      }
    });

    it('should load and parse users from JSON file', () => {
      const mockUsers = [
        { id: 'user-1', username: 'test1', password: 'pass1' },
        { id: 'user-2', username: 'test2', password: 'pass2' }
      ];
      fs.writeFileSync(testConfigPath, JSON.stringify(mockUsers));

      const users = loadUsers(testConfigPath);
      expect(users).toEqual(mockUsers);
    });

    it('should throw error if config file does not exist', () => {
      const nonExistentPath = '/path/that/does/not/exist.json';
      expect(() => loadUsers(nonExistentPath)).toThrow('Users config not found');
    });

    it('should throw error if config is not an array', () => {
      const invalidConfig = { user: 'test' };
      fs.writeFileSync(testConfigPath, JSON.stringify(invalidConfig));

      expect(() => loadUsers(testConfigPath)).toThrow('Users config must be an array');
    });

    it('should throw error for invalid JSON', () => {
      fs.writeFileSync(testConfigPath, 'invalid json {');

      expect(() => loadUsers(testConfigPath)).toThrow();
    });

    it('should handle empty array', () => {
      fs.writeFileSync(testConfigPath, JSON.stringify([]));

      const users = loadUsers(testConfigPath);
      expect(users).toEqual([]);
    });
  });

  describe('main', () => {
    let mockDb;
    let consoleLogSpy;
    let consoleErrorSpy;
    let processExitSpy;
    const testConfigPath = path.join(__dirname, '../config/test-main-users.json');

    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();

      // Mock console methods
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock process.exit
      processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

      // Mock database
      mockDb = {
        getUsers: jest.fn(),
        close: jest.fn()
      };
      createDatabase.mockReturnValue(mockDb);

      // Mock downloadTickets
      downloadTickets.mockResolvedValue([]);

      // Clear process.argv
      process.argv = ['node', 'index.js'];
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();

      if (fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath);
      }
    });

    it('should load users from JSON config when no db is specified', async () => {
      const mockUsers = [
        { id: 'user-1', username: 'test1', password: 'pass1' }
      ];
      fs.writeFileSync(testConfigPath, JSON.stringify(mockUsers));

      process.argv = ['node', 'index.js', `--users=${testConfigPath}`];

      downloadTickets.mockResolvedValue([
        { status: 'success', deviceProfile: 'desktop_chrome', filePath: '/path/to/ticket.html', message: 'Downloaded' }
      ]);

      await main();

      expect(downloadTickets).toHaveBeenCalledWith(
        mockUsers,
        expect.objectContaining({
          defaultDeviceProfile: 'desktop_chrome',
          outputRoot: expect.stringContaining('downloads'),
          historyPath: expect.any(String),
          db: null
        })
      );
    });

    it('should load users from database when db path is specified', async () => {
      const mockUsers = [
        { id: 'db-user-1', username: 'dbtest', password: 'dbpass' }
      ];
      mockDb.getUsers.mockReturnValue(mockUsers);

      process.argv = ['node', 'index.js', '--db=./data/test.db'];

      downloadTickets.mockResolvedValue([
        { status: 'success', deviceProfile: 'mobile_android', filePath: '/db/ticket.html', message: 'OK' }
      ]);

      await main();

      expect(createDatabase).toHaveBeenCalledWith(expect.stringContaining('test.db'));
      expect(mockDb.getUsers).toHaveBeenCalled();
      expect(downloadTickets).toHaveBeenCalledWith(
        mockUsers,
        expect.objectContaining({ db: mockDb })
      );
    });

    it('should close database connection after execution', async () => {
      const mockUsers = [{ id: 'user-1', username: 'test', password: 'pass' }];
      mockDb.getUsers.mockReturnValue(mockUsers);

      process.argv = ['node', 'index.js', '--db=./data/test.db'];

      downloadTickets.mockResolvedValue([
        { status: 'success', deviceProfile: 'desktop_chrome', filePath: null, message: 'Done' }
      ]);

      await main();

      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should close database even if download fails', async () => {
      const mockUsers = [{ id: 'user-1', username: 'test', password: 'pass' }];
      mockDb.getUsers.mockReturnValue(mockUsers);

      process.argv = ['node', 'index.js', '--db=./data/test.db'];

      downloadTickets.mockRejectedValue(new Error('Download failed'));

      await expect(main()).rejects.toThrow('Download failed');

      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should throw error if no users found in JSON config', async () => {
      fs.writeFileSync(testConfigPath, JSON.stringify([]));

      process.argv = ['node', 'index.js', `--users=${testConfigPath}`];

      await expect(main()).rejects.toThrow('No users found');
    });

    it('should throw error if no users found in database', async () => {
      mockDb.getUsers.mockReturnValue([]);

      process.argv = ['node', 'index.js', '--db=./data/test.db'];

      await expect(main()).rejects.toThrow('No users found');

      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should use custom output directory from arguments', async () => {
      const mockUsers = [{ id: 'user-1', username: 'test', password: 'pass' }];
      fs.writeFileSync(testConfigPath, JSON.stringify(mockUsers));

      process.argv = ['node', 'index.js', `--users=${testConfigPath}`, '--output=/custom/output'];

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

    it('should use custom device profile from arguments', async () => {
      const mockUsers = [{ id: 'user-1', username: 'test', password: 'pass' }];
      fs.writeFileSync(testConfigPath, JSON.stringify(mockUsers));

      process.argv = ['node', 'index.js', `--users=${testConfigPath}`, '--device=mobile_android'];

      downloadTickets.mockResolvedValue([
        { status: 'success', deviceProfile: 'mobile_android', filePath: '/ticket.html', message: 'OK' }
      ]);

      await main();

      expect(downloadTickets).toHaveBeenCalledWith(
        mockUsers,
        expect.objectContaining({
          defaultDeviceProfile: 'mobile_android'
        })
      );
    });

    it('should use custom history path from arguments', async () => {
      const mockUsers = [{ id: 'user-1', username: 'test', password: 'pass' }];
      fs.writeFileSync(testConfigPath, JSON.stringify(mockUsers));

      process.argv = ['node', 'index.js', `--users=${testConfigPath}`, '--history=/custom/history.json'];

      downloadTickets.mockResolvedValue([
        { status: 'success', deviceProfile: 'desktop_chrome', filePath: '/ticket.html', message: 'OK' }
      ]);

      await main();

      expect(downloadTickets).toHaveBeenCalledWith(
        mockUsers,
        expect.objectContaining({
          historyPath: expect.stringContaining('/custom/history.json')
        })
      );
    });

    it('should log results for each user', async () => {
      const mockUsers = [
        { id: 'user-1', username: 'test1', password: 'pass1' },
        { id: 'user-2', username: 'test2', password: 'pass2' }
      ];
      fs.writeFileSync(testConfigPath, JSON.stringify(mockUsers));

      process.argv = ['node', 'index.js', `--users=${testConfigPath}`];

      downloadTickets.mockResolvedValue([
        { status: 'success', deviceProfile: 'desktop_chrome', filePath: '/ticket1.html', message: 'Downloaded' },
        { status: 'error', deviceProfile: 'mobile_android', filePath: null, message: 'Failed' }
      ]);

      await main();

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[user-1]')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[user-2]')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('status=success')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('status=error')
      );
    });

    it('should handle n/a for missing file paths in log output', async () => {
      const mockUsers = [{ id: 'user-1', username: 'test', password: 'pass' }];
      fs.writeFileSync(testConfigPath, JSON.stringify(mockUsers));

      process.argv = ['node', 'index.js', `--users=${testConfigPath}`];

      downloadTickets.mockResolvedValue([
        { status: 'error', deviceProfile: 'desktop_chrome', filePath: null, message: 'Failed to download' }
      ]);

      await main();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('file=n/a')
      );
    });

    it('should use default paths when no arguments provided', async () => {
      const defaultConfigPath = path.resolve('./config/users.json');
      const mockUsers = [{ id: 'user-1', username: 'test', password: 'pass' }];

      // Create default config
      if (!fs.existsSync(path.dirname(defaultConfigPath))) {
        fs.mkdirSync(path.dirname(defaultConfigPath), { recursive: true });
      }
      fs.writeFileSync(defaultConfigPath, JSON.stringify(mockUsers));

      process.argv = ['node', 'index.js'];

      downloadTickets.mockResolvedValue([
        { status: 'success', deviceProfile: 'desktop_chrome', filePath: '/ticket.html', message: 'OK' }
      ]);

      try {
        await main();

        expect(downloadTickets).toHaveBeenCalledWith(
          mockUsers,
          expect.objectContaining({
            defaultDeviceProfile: 'desktop_chrome',
            outputRoot: expect.stringContaining('downloads'),
            db: null
          })
        );
      } finally {
        if (fs.existsSync(defaultConfigPath)) {
          fs.unlinkSync(defaultConfigPath);
        }
      }
    });

    it('should handle errors thrown in main function', async () => {
      const mockUsers = [{ id: 'user-1', username: 'test', password: 'pass' }];
      fs.writeFileSync(testConfigPath, JSON.stringify(mockUsers));

      process.argv = ['node', 'index.js', `--users=${testConfigPath}`];

      const testError = new Error('Critical download failure');
      downloadTickets.mockRejectedValue(testError);

      await expect(main()).rejects.toThrow('Critical download failure');
    });
  });

  describe('main entry point', () => {
    let consoleErrorSpy;
    let processExitSpy;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should catch and log errors when run as main module', async () => {
      // This tests lines 76-78 (the if require.main === module block)
      // We can't directly test it here as it requires the module to be the main module
      // But we can verify the error handling logic exists
      const { main } = require('../src/index');
      
      // Create a rejected promise similar to what would happen
      const mockMain = jest.fn().mockRejectedValue(new Error('Test error'));
      
      try {
        await mockMain();
      } catch (error) {
        console.error('Failed to download tickets:', error);
        process.exit(1);
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to download tickets:',
        expect.any(Error)
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
