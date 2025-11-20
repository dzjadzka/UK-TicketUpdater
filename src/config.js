const path = require('path');

const DEFAULT_TOKENS = [
  { token: 'admin-token', role: 'admin' },
  { token: 'user-token', role: 'user', userId: 'default-user' }
];

function parseTokens() {
  const raw = process.env.API_TOKENS;
  if (!raw) return DEFAULT_TOKENS;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TOKENS;
    return parsed.filter((entry) => entry.token && entry.role);
  } catch (error) {
    console.warn('Could not parse API_TOKENS, falling back to defaults:', error.message);
    return DEFAULT_TOKENS;
  }
}

const config = {
  port: process.env.PORT || 3000,
  downloadDirectory: process.env.DOWNLOAD_DIRECTORY || path.join(process.cwd(), 'downloads'),
  historyFile: process.env.HISTORY_FILE || path.join(process.cwd(), 'data', 'history.json'),
  browserProduct: process.env.BROWSER_PRODUCT || 'firefox',
  apiTokens: parseTokens()
};

module.exports = config;
