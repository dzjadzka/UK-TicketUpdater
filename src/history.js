const fs = require('fs');
const path = require('path');

const DEFAULT_HISTORY_PATH = path.resolve(__dirname, '../data/history.json');

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readHistory(historyPath = DEFAULT_HISTORY_PATH) {
  if (!fs.existsSync(historyPath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(historyPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('Could not parse history file, starting fresh.', error);
    return [];
  }
}

function appendHistory(entry, historyPath = DEFAULT_HISTORY_PATH, db) {
  if (!entry || !entry.userId) {
    console.error('Cannot append history: entry must contain userId');
    return;
  }

  if (db && typeof db.recordRun === 'function') {
    try {
      db.recordRun({ ...entry, timestamp: entry.timestamp || new Date().toISOString() });
    } catch (error) {
      console.error('Failed to record run in database:', error);
    }
    return;
  }

  try {
    const historyDir = path.dirname(historyPath);
    ensureDirExists(historyDir);

    const history = readHistory(historyPath);
    history.push({ ...entry, timestamp: new Date().toISOString() });
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Failed to append history to file:', error);
  }
}

module.exports = { appendHistory, readHistory, DEFAULT_HISTORY_PATH };
