const request = require('supertest');
const { app } = require('../src/server');

describe('authMiddleware', () => {
  const originalEnv = { ...process.env };
  const withToken = (token) => ({
    Authorization: `Bearer ${token}`,
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const routes = [
    { method: 'get', path: '/downloads' },
    { method: 'get', path: '/history' },
    { method: 'get', path: '/tickets/example-user' },
  ];

  describe('when API_TOKEN is configured', () => {
    beforeEach(() => {
      process.env.API_TOKEN = 'secret-token';
      delete process.env.ALLOW_INSECURE;
    });

    it('rejects requests without an Authorization header', async () => {
      for (const route of routes) {
        // eslint-disable-next-line no-await-in-loop
        const response = await request(app)[route.method](route.path);
        expect(response.status).toBe(401);
        expect(response.body.error).toMatch(/missing api token/i);
      }
    });

    it('rejects requests with an invalid token', async () => {
      for (const route of routes) {
        // eslint-disable-next-line no-await-in-loop
        const response = await request(app)[route.method](route.path).set(withToken('invalid'));
        expect(response.status).toBe(401);
        expect(response.body.error).toMatch(/invalid api token/i);
      }
    });

    it('allows requests with the correct token', async () => {
      for (const route of routes) {
        // eslint-disable-next-line no-await-in-loop
        const response = await request(app)[route.method](route.path).set(withToken('secret-token'));
        expect(response.status).toBe(200);
      }
    });
  });

  describe('when API_TOKEN is missing', () => {
    beforeEach(() => {
      delete process.env.API_TOKEN;
    });

    it('rejects requests if ALLOW_INSECURE is not set', async () => {
      delete process.env.ALLOW_INSECURE;
      for (const route of routes) {
        // eslint-disable-next-line no-await-in-loop
        const response = await request(app)[route.method](route.path);
        expect(response.status).toBe(401);
        expect(response.body.error).toMatch(/not configured/i);
      }
    });

    it('allows requests when ALLOW_INSECURE is true', async () => {
      process.env.ALLOW_INSECURE = 'true';
      for (const route of routes) {
        // eslint-disable-next-line no-await-in-loop
        const response = await request(app)[route.method](route.path);
        expect(response.status).toBe(200);
      }
    });
  });
});
