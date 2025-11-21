const fs = require('fs');
const path = require('path');
const { createDatabase } = require('../src/db');

describe('database', () => {
  const testDbPath = path.join(__dirname, '../data/test-db.db');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('createDatabase', () => {
    it('creates schema with ticket lifecycle tables', () => {
      const db = createDatabase(testDbPath);
      const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toEqual(
        expect.arrayContaining(['users', 'tickets', 'download_history', 'user_credentials', 'base_ticket_state'])
      );
      db.close();
    });
  });

  describe('upsertUsers and retrieval', () => {
    it('inserts and updates users while keeping login', () => {
      const db = createDatabase(testDbPath);
      db.upsertUsers([{ id: 'user-1', username: 'first-user', deviceProfile: 'desktop_chrome' }]);
      db.upsertUsers([{ id: 'user-1', login: 'updated-login', flags: { optIn: true } }]);

      const users = db.getUsers();
      expect(users).toHaveLength(1);
      expect(users[0].login).toBe('updated-login');
      expect(users[0].device_profile).toBe('desktop_chrome');
      expect(users[0].flags).toBe(JSON.stringify({ optIn: true }));
      db.close();
    });

    it('filters by id list', () => {
      const db = createDatabase(testDbPath);
      db.upsertUsers([
        { id: 'user-1', username: 'user1' },
        { id: 'user-2', username: 'user2' },
        { id: 'user-3', username: 'user3' }
      ]);

      const users = db.getUsersByIds(['user-1', 'user-3']);
      expect(users.map((u) => u.id)).toEqual(['user-1', 'user-3']);
      db.close();
    });
  });

  describe('user credentials', () => {
    it('stores credentials and updates login result metadata', () => {
      const db = createDatabase(testDbPath);
      db.upsertUsers([{ id: 'user-cred', username: 'cred-user' }]);

      db.createUserCredential({
        id: 'cred-1',
        userId: 'user-cred',
        ukNumber: '123456',
        passwordEncrypted: 'secret'
      });

      db.updateUserCredentialLoginResult({ id: 'cred-1', status: 'success', loggedAt: '2024-01-01T00:00:00Z' });

      const creds = db.getUserCredentials('user-cred');
      expect(creds).toHaveLength(1);
      expect(creds[0].uk_number).toBe('123456');
      expect(creds[0].last_login_status).toBe('success');
      expect(creds[0].last_login_at).toBe('2024-01-01T00:00:00Z');
      db.close();
    });
  });

  describe('tickets and history', () => {
    it('records ticket versions and prevents duplicates via version or hash', () => {
      const db = createDatabase(testDbPath);
      db.upsertUsers([{ id: 'user-1', username: 'ticket-user' }]);

      db.recordTicket({
        userId: 'user-1',
        ticketVersion: '2024S',
        contentHash: 'abc',
        filePath: '/ticket/a.html'
      });

      expect(
        db.isTicketVersionNew({ userId: 'user-1', ticketVersion: '2024S', contentHash: 'something-else' })
      ).toBe(false);
      expect(db.isTicketVersionNew({ userId: 'user-1', contentHash: 'abc' })).toBe(false);

      db.recordTicket({
        userId: 'user-1',
        ticketVersion: '2024S',
        contentHash: 'def',
        filePath: '/ticket/updated.html',
        status: 'success'
      });

      const tickets = db.listTicketsByUser('user-1');
      expect(tickets).toHaveLength(1);
      expect(tickets[0].content_hash).toBe('def');
      expect(tickets[0].file_path).toBe('/ticket/updated.html');
      db.close();
    });

    it('logs download attempts and aggregates stats', () => {
      const db = createDatabase(testDbPath);
      db.upsertUsers([{ id: 'user-logs', username: 'logger' }]);

      db.recordRun({ userId: 'user-logs', status: 'success', ticketVersion: '2024S', message: 'ok' });
      db.recordRun({ userId: 'user-logs', status: 'error', ticketVersion: '2024S', errorMessage: 'fail' });

      const history = db.getTicketHistory('user-logs', 10);
      expect(history).toHaveLength(2);
      expect(history[0].status).toBe('error');
      expect(history[1].message).toBe('ok');

      const stats = db.getTicketStats('user-logs');
      expect(stats.success).toBe(1);
      expect(stats.error).toBe(1);
      db.close();
    });

    it('provides latest ticket snapshot', () => {
      const db = createDatabase(testDbPath);
      db.upsertUsers([{ id: 'user-latest', username: 'latest' }]);
      db.recordTicket({ userId: 'user-latest', ticketVersion: 'v1', downloadedAt: '2024-01-01T00:00:00Z' });
      db.recordTicket({ userId: 'user-latest', ticketVersion: 'v2', downloadedAt: '2024-02-01T00:00:00Z' });

      const latest = db.getLatestTicketVersion('user-latest');
      expect(latest.ticket_version).toBe('v2');
      db.close();
    });
  });

  describe('base ticket state', () => {
    it('stores and retrieves base ticket metadata', () => {
      const db = createDatabase(testDbPath);
      db.setBaseTicketState({ baseTicketHash: 'hash-1', effectiveFrom: '2024-04-01', lastCheckedAt: '2024-04-02' });

      const state = db.getBaseTicketState();
      expect(state.base_ticket_hash).toBe('hash-1');
      expect(state.effective_from).toBe('2024-04-01');
      expect(state.last_checked_at).toBe('2024-04-02');
      db.close();
    });
  });
});
