const { defineConfig } = require('@playwright/test');

const reuseServer = false;

module.exports = defineConfig({
  timeout: 60000,
  testDir: 'tests/e2e',
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    video: 'off'
  },
  webServer: [
    {
      command: 'PORT=3000 npm run start:test-api > /tmp/playwright-api.log 2>&1',
      port: 3000,
      reuseExistingServer: reuseServer,
      timeout: 30000
    },
    {
      command: 'cd frontend && VITE_API_BASE_URL=/api npm run dev -- --host --port 4173 --strictPort',
      port: 4173,
      reuseExistingServer: reuseServer,
      timeout: 60000
    }
  ]
});
