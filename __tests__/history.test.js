const fs = require('fs');
const path = require('path');
const {
  appendHistory,
  readHistory,
  DEFAULT_HISTORY_PATH,
  getUserHistory,
  summarizeHistory,
  shouldDownloadTicket
} = require('../src/history');

const { createDatabase } = require('../src/db');

describe('history', () => {
  const testHistoryPath = path.join(__dirname, '../data/test-history.json');
  const testDbPath = path.join(__dirname, '../data/test-history.db');

  beforeEach(() => {
    if (fs.existsSync(testHistoryPath)) {
      fs.unlinkSync(testHistoryPath);
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterAll(() => {
    if (fs.existsSync(testHistoryPath)) {
      fs.unlinkSync(testHistoryPath);
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('readHistory', () => {
    it('returns empty array when history file does not exist', () => {
      const history = readHistory(testHistoryPath);
      expect(history).toEqual([]);
    });

    it('parses existing history file', () => {
      const mockHistory = [{ userId: 'user-1', status: 'success', timestamp: '2024-01-01T00:00:00.000Z' }];
      fs.writeFileSync(testHistoryPath, JSON.stringify(mockHistory));

      const history = readHistory(testHistoryPath);
      expect(history).toEqual(mockHistory);
    });
  });

  describe('appendHistory', () => {
    it('appends to file when db is not provided', () => {
      const entry = { userId: 'user-1', status: 'success', message: 'Ticket downloaded' };
      appendHistory(entry, testHistoryPath);

      const history = JSON.parse(fs.readFileSync(testHistoryPath, 'utf-8'));
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject(entry);
      expect(history[0]).toHaveProperty('timestamp');
    });

    it('uses database when provided', () => {
      const db = createDatabase(testDbPath);
      db.upsertUsers([{ id: 'user-db', username: 'db-user' }]);
      const entry = { userId: 'user-db', status: 'success', ticketVersion: '2024S', message: 'db' };

      appendHistory(entry, testHistoryPath, db);

      const history = db.getTicketHistory('user-db');
      expect(history).toHaveLength(1);
      expect(history[0].ticket_version).toBe('2024S');
      expect(fs.existsSync(testHistoryPath)).toBe(false);
      db.close();
    });
  });

  describe('getUserHistory and summarizeHistory', () => {
    it('reads and summarizes file history when db is absent', () => {
      appendHistory({ userId: 'user-1', status: 'success' }, testHistoryPath);
      appendHistory({ userId: 'user-1', status: 'error' }, testHistoryPath);

      const history = getUserHistory('user-1', { historyPath: testHistoryPath, limit: 10 });
      expect(history).toHaveLength(2);
      const summary = summarizeHistory('user-1', { historyPath: testHistoryPath });
      expect(summary.success).toBe(1);
      expect(summary.error).toBe(1);
    });

    it('reads and summarizes from database when available', () => {
      const db = createDatabase(testDbPath);
      db.upsertUsers([{ id: 'user-db', username: 'db-user' }]);
      db.recordRun({ userId: 'user-db', status: 'success' });
      db.recordRun({ userId: 'user-db', status: 'error' });

      const history = getUserHistory('user-db', { db, limit: 5 });
      expect(history).toHaveLength(2);
      const summary = summarizeHistory('user-db', { db });
      expect(summary.success).toBe(1);
      expect(summary.error).toBe(1);
      db.close();
    });
  });

  describe('shouldDownloadTicket', () => {
    it('defers to db version detection when available', () => {
      const db = createDatabase(testDbPath);
      db.upsertUsers([{ id: 'user-1', username: 'ticket-user' }]);
      db.recordTicket({ userId: 'user-1', ticketVersion: '2024S', contentHash: 'abc' });

      expect(shouldDownloadTicket({ userId: 'user-1', ticketVersion: '2024S', db })).toBe(false);
      expect(shouldDownloadTicket({ userId: 'user-1', contentHash: 'abc', db })).toBe(false);
      expect(shouldDownloadTicket({ userId: 'user-1', ticketVersion: '2024F', db })).toBe(true);
      db.close();
    });

    it('defaults to download when db is missing', () => {
      expect(shouldDownloadTicket({ userId: 'user-1', ticketVersion: 'any' })).toBe(true);
    });
  });

  describe('DEFAULT_HISTORY_PATH', () => {
    it('points to the data directory', () => {
      expect(DEFAULT_HISTORY_PATH).toContain('data');
      expect(DEFAULT_HISTORY_PATH).toContain('history.json');
    });
  });
});
