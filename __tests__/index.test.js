const fs = require('fs');
const path = require('path');
const { parseArgs, loadUsers } = require('../src/index');

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
});
