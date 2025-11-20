const request = require('supertest');
const fs = require('fs');
const path = require('path');

describe('authMiddleware', () => {
  const originalEnv = { ...process.env };
  const testDbPath = path.join(__dirname, '../data/test-app.db');
  const withToken = (token) => ({
    Authorization: `Bearer ${token}`,
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterAll(() => {
    process.env = originalEnv;
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  const routes = [
    { method: 'post', path: '/downloads' },
    { method: 'get', path: '/history' },
    { method: 'get', path: '/tickets/example-user' },
  ];

  describe('when API_TOKEN is configured', () => {
    beforeEach(() => {
      process.env.API_TOKEN = 'secret-token';
      delete process.env.ALLOW_INSECURE;
    });

    it('rejects requests without an Authorization header', async () => {
      const { createApp } = require('../src/server');
      const { app } = createApp({ dbPath: testDbPath });
      
      for (const route of routes) {
        // eslint-disable-next-line no-await-in-loop
        const response = await request(app)[route.method](route.path);
        expect(response.status).toBe(401);
        expect(response.body.error).toMatch(/missing api token/i);
      }
    });

    it('rejects requests with an invalid token', async () => {
      const { createApp } = require('../src/server');
      const { app } = createApp({ dbPath: testDbPath });
      
      for (const route of routes) {
        // eslint-disable-next-line no-await-in-loop
        const response = await request(app)[route.method](route.path).set(withToken('invalid'));
        expect(response.status).toBe(401);
        expect(response.body.error).toMatch(/invalid api token/i);
      }
    });

    it('allows requests with the correct token', async () => {
      const { createApp } = require('../src/server');
      const { app } = createApp({ dbPath: testDbPath });
      
      for (const route of routes) {
        // eslint-disable-next-line no-await-in-loop
        const response = await request(app)[route.method](route.path).set(withToken('secret-token'));
        // Auth passed if we don't get 401 or 403
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(403);
      }
    });
  });

  describe('when API_TOKEN is missing', () => {
    beforeEach(() => {
      delete process.env.API_TOKEN;
    });

    it('rejects requests if ALLOW_INSECURE is not set', async () => {
      delete process.env.ALLOW_INSECURE;
      const { createApp } = require('../src/server');
      const { app } = createApp({ dbPath: testDbPath });
      
      for (const route of routes) {
        // eslint-disable-next-line no-await-in-loop
        const response = await request(app)[route.method](route.path);
        expect(response.status).toBe(401);
        expect(response.body.error).toMatch(/not configured/i);
      }
    });

    it('allows requests when ALLOW_INSECURE is true', async () => {
      process.env.ALLOW_INSECURE = 'true';
      const { createApp } = require('../src/server');
      const { app } = createApp({ dbPath: testDbPath });
      
      for (const route of routes) {
        // eslint-disable-next-line no-await-in-loop
        const response = await request(app)[route.method](route.path);
        // Auth passed if we don't get 401 or 403
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(403);
      }
    });
  });
});
