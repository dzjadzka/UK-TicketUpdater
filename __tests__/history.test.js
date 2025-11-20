const fs = require('fs');
const path = require('path');
const { appendHistory, readHistory, DEFAULT_HISTORY_PATH } = require('../src/history');

describe('history', () => {
  const testHistoryPath = path.join(__dirname, '../data/test-history.json');

  beforeEach(() => {
    // Clean up test history file
    if (fs.existsSync(testHistoryPath)) {
      fs.unlinkSync(testHistoryPath);
    }
  });

  afterAll(() => {
    // Clean up after all tests
    if (fs.existsSync(testHistoryPath)) {
      fs.unlinkSync(testHistoryPath);
    }
  });

  describe('readHistory', () => {
    it('should return empty array when history file does not exist', () => {
      const history = readHistory(testHistoryPath);
      expect(history).toEqual([]);
    });

    it('should read and parse existing history file', () => {
      const mockHistory = [{ userId: 'user-1', status: 'success', timestamp: '2024-01-01T00:00:00.000Z' }];
      fs.writeFileSync(testHistoryPath, JSON.stringify(mockHistory));

      const history = readHistory(testHistoryPath);
      expect(history).toEqual(mockHistory);
    });

    it('should return empty array for corrupted JSON file', () => {
      fs.writeFileSync(testHistoryPath, 'invalid json {');
      const history = readHistory(testHistoryPath);
      expect(history).toEqual([]);
    });
  });

  describe('appendHistory', () => {
    it('should create new history file and append entry', () => {
      const entry = {
        userId: 'user-1',
        deviceProfile: 'desktop_chrome',
        status: 'success',
        filePath: '/path/to/ticket.html',
        message: 'Ticket downloaded'
      };

      appendHistory(entry, testHistoryPath);

      expect(fs.existsSync(testHistoryPath)).toBe(true);
      const history = JSON.parse(fs.readFileSync(testHistoryPath, 'utf-8'));
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject(entry);
      expect(history[0]).toHaveProperty('timestamp');
    });

    it('should append to existing history file', () => {
      const firstEntry = { userId: 'user-1', status: 'success' };
      appendHistory(firstEntry, testHistoryPath);

      const secondEntry = { userId: 'user-2', status: 'error' };
      appendHistory(secondEntry, testHistoryPath);

      const history = JSON.parse(fs.readFileSync(testHistoryPath, 'utf-8'));
      expect(history).toHaveLength(2);
      expect(history[0].userId).toBe('user-1');
      expect(history[1].userId).toBe('user-2');
    });

    it('should add timestamp if not provided', () => {
      const entry = { userId: 'user-1', status: 'success' };
      appendHistory(entry, testHistoryPath);

      const history = JSON.parse(fs.readFileSync(testHistoryPath, 'utf-8'));
      expect(history[0]).toHaveProperty('timestamp');
      expect(new Date(history[0].timestamp)).toBeInstanceOf(Date);
    });

    it('should not append entry without userId', () => {
      const entry = { status: 'success' }; // Missing userId
      appendHistory(entry, testHistoryPath);

      // File should not be created
      expect(fs.existsSync(testHistoryPath)).toBe(false);
    });

    it('should use database if provided', () => {
      const mockDb = {
        recordRun: jest.fn()
      };

      const entry = {
        userId: 'user-1',
        deviceProfile: 'desktop_chrome',
        status: 'success',
        filePath: '/path/to/ticket.html',
        message: 'Test'
      };

      appendHistory(entry, testHistoryPath, mockDb);

      expect(mockDb.recordRun).toHaveBeenCalledWith(expect.objectContaining(entry));
      expect(fs.existsSync(testHistoryPath)).toBe(false); // Should not write to file
    });

    it('should handle database errors gracefully', () => {
      const mockDb = {
        recordRun: jest.fn(() => {
          throw new Error('Database error');
        })
      };

      const entry = { userId: 'user-1', status: 'success' };

      // Should not throw
      expect(() => appendHistory(entry, testHistoryPath, mockDb)).not.toThrow();
      expect(mockDb.recordRun).toHaveBeenCalled();
    });
  });

  describe('DEFAULT_HISTORY_PATH', () => {
    it('should be defined and point to data directory', () => {
      expect(DEFAULT_HISTORY_PATH).toBeDefined();
      expect(DEFAULT_HISTORY_PATH).toContain('data');
      expect(DEFAULT_HISTORY_PATH).toContain('history.json');
    });
  });
});
