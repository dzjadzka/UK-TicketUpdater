const fs = require('fs');
const path = require('path');

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function readJsonSafe(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadConfig() {
  const configPath = path.resolve(__dirname, '..', 'db', 'config.json');
  const config = readJsonSafe(configPath, {});
  const outputDir = config.output?.directory || './downloads';
  const normalizedConfig = {
    credentials: config.credentials || { username: '', password: '' },
    output: {
      directory: outputDir,
      fileName: config.output?.fileName || 'ticket.html'
    },
    browser: {
      product: config.browser?.product || 'firefox',
      headless: config.browser?.headless !== false,
      deviceProfile: config.browser?.deviceProfile || 'Desktop Chrome',
      geolocation: config.browser?.geolocation || null
    },
    network: {
      proxy: config.network?.proxy || null
    }
  };

  return normalizedConfig;
}

function appendHistory(entry) {
  const historyPath = path.resolve(__dirname, '..', 'data', 'history.json');
  const history = readJsonSafe(historyPath, []);
  history.push(entry);
  writeJson(historyPath, history);
}

module.exports = {
  ensureDir,
  loadConfig,
  appendHistory,
  writeJson
};
