const fs = require('fs');
const path = require('path');
const { createDatabase } = require('../src/db');

describe('database', () => {
  const testDbPath = path.join(__dirname, '../data/test-db.db');

  beforeEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterAll(() => {
    // Clean up after all tests
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('createDatabase', () => {
    it('should create database file if it does not exist', () => {
      const db = createDatabase(testDbPath);
      expect(fs.existsSync(testDbPath)).toBe(true);
      db.close();
    });

    it('should create all required tables', () => {
      const db = createDatabase(testDbPath);
      const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain('users');
      expect(tableNames).toContain('runs');
      expect(tableNames).toContain('tickets');
      db.close();
    });
  });

  describe('upsertUsers', () => {
    it('should insert new users', () => {
      const db = createDatabase(testDbPath);
      const users = [
        { id: 'user-1', username: 'user1', password: 'pass1' },
        { id: 'user-2', username: 'user2', password: 'pass2' }
      ];

      db.upsertUsers(users);
      const result = db.getUsers();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('user-1');
      expect(result[1].id).toBe('user-2');
      db.close();
    });

    it('should update existing users', () => {
      const db = createDatabase(testDbPath);

      db.upsertUsers([{ id: 'user-1', username: 'oldname', password: 'oldpass' }]);
      db.upsertUsers([{ id: 'user-1', username: 'newname', password: 'newpass' }]);

      const result = db.getUsers();
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('newname');
      expect(result[0].password).toBe('newpass');
      db.close();
    });

    it('should handle device_profile and output_dir', () => {
      const db = createDatabase(testDbPath);
      const users = [
        {
          id: 'user-1',
          username: 'user1',
          password: 'pass1',
          deviceProfile: 'mobile_android',
          outputDir: '/custom/path'
        }
      ];

      db.upsertUsers(users);
      const result = db.getUsers();

      expect(result[0].device_profile).toBe('mobile_android');
      expect(result[0].output_dir).toBe('/custom/path');
      db.close();
    });

    it('should throw error for invalid input', () => {
      const db = createDatabase(testDbPath);

      expect(() => db.upsertUsers('not an array')).toThrow('users must be an array');
      expect(() => db.upsertUsers([{ id: 'user-1' }])).toThrow('must have id, username, and password');
      db.close();
    });
  });

  describe('getUsers', () => {
    it('should return empty array when no users exist', () => {
      const db = createDatabase(testDbPath);
      const users = db.getUsers();
      expect(users).toEqual([]);
      db.close();
    });

    it('should return all users', () => {
      const db = createDatabase(testDbPath);
      db.upsertUsers([
        { id: 'user-1', username: 'user1', password: 'pass1' },
        { id: 'user-2', username: 'user2', password: 'pass2' }
      ]);

      const users = db.getUsers();
      expect(users).toHaveLength(2);
      db.close();
    });
  });

  describe('getUsersByIds', () => {
    it('should return users matching the provided IDs', () => {
      const db = createDatabase(testDbPath);
      db.upsertUsers([
        { id: 'user-1', username: 'user1', password: 'pass1' },
        { id: 'user-2', username: 'user2', password: 'pass2' },
        { id: 'user-3', username: 'user3', password: 'pass3' }
      ]);

      const users = db.getUsersByIds(['user-1', 'user-3']);
      expect(users).toHaveLength(2);
      expect(users.map((u) => u.id)).toEqual(['user-1', 'user-3']);
      db.close();
    });

    it('should return empty array for non-existent IDs', () => {
      const db = createDatabase(testDbPath);
      const users = db.getUsersByIds(['nonexistent']);
      expect(users).toEqual([]);
      db.close();
    });

    it('should throw error if ids is not an array', () => {
      const db = createDatabase(testDbPath);
      expect(() => db.getUsersByIds('not-array')).toThrow('ids must be an array');
      db.close();
    });
  });

  describe('recordRun', () => {
    it('should record a run entry', () => {
      const db = createDatabase(testDbPath);
      db.recordRun({
        userId: 'user-1',
        status: 'success',
        deviceProfile: 'desktop_chrome',
        filePath: '/path/to/ticket.html',
        message: 'Downloaded successfully'
      });

      const history = db.listHistory(10);
      expect(history).toHaveLength(1);
      expect(history[0].user_id).toBe('user-1');
      expect(history[0].status).toBe('success');
      db.close();
    });
  });

  describe('recordTicket', () => {
    it('should record a ticket entry', () => {
      const db = createDatabase(testDbPath);
      db.recordTicket({
        userId: 'user-1',
        filePath: '/path/to/ticket.html',
        status: 'success'
      });

      const tickets = db.listTicketsByUser('user-1');
      expect(tickets).toHaveLength(1);
      expect(tickets[0].file_path).toBe('/path/to/ticket.html');
      db.close();
    });
  });

  describe('listHistory', () => {
    it('should return runs in descending order', () => {
      const db = createDatabase(testDbPath);
      db.recordRun({ userId: 'user-1', status: 'success', deviceProfile: 'desktop', filePath: null, message: 'Run 1' });
      db.recordRun({ userId: 'user-2', status: 'error', deviceProfile: 'mobile', filePath: null, message: 'Run 2' });

      const history = db.listHistory(10);
      expect(history).toHaveLength(2);
      expect(history[0].message).toBe('Run 2'); // Most recent first
      db.close();
    });

    it('should respect limit parameter', () => {
      const db = createDatabase(testDbPath);
      for (let i = 0; i < 5; i++) {
        db.recordRun({
          userId: `user-${i}`,
          status: 'success',
          deviceProfile: 'desktop',
          filePath: null,
          message: `Run ${i}`
        });
      }

      const history = db.listHistory(3);
      expect(history).toHaveLength(3);
      db.close();
    });
  });

  describe('listTicketsByUser', () => {
    it('should return tickets for specific user only', () => {
      const db = createDatabase(testDbPath);
      db.recordTicket({ userId: 'user-1', filePath: '/ticket1.html', status: 'success' });
      db.recordTicket({ userId: 'user-2', filePath: '/ticket2.html', status: 'success' });
      db.recordTicket({ userId: 'user-1', filePath: '/ticket3.html', status: 'success' });

      const tickets = db.listTicketsByUser('user-1');
      expect(tickets).toHaveLength(2);
      expect(tickets.every((t) => t.user_id === 'user-1')).toBe(true);
      db.close();
    });

    it('should throw error if userId is missing', () => {
      const db = createDatabase(testDbPath);
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => db.listTicketsByUser()).toThrow('userId is required');

      console.error = originalError;
      db.close();
    });
  });

  describe('close', () => {
    it('should close the database connection', () => {
      const db = createDatabase(testDbPath);
      expect(() => db.close()).not.toThrow();
    });
  });
});
