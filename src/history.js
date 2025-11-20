const fs = require('fs');
const path = require('path');
const config = require('./config');

function ensureHistoryFile() {
  const dir = path.dirname(config.historyFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(config.historyFile)) {
    fs.writeFileSync(config.historyFile, '[]', 'utf-8');
  }
}

function readHistory() {
  ensureHistoryFile();
  try {
    const raw = fs.readFileSync(config.historyFile, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to read history file:', error);
    return [];
  }
}

function appendHistory(entry) {
  const history = readHistory();
  history.push(entry);
  fs.writeFileSync(config.historyFile, JSON.stringify(history, null, 2), 'utf-8');
  return entry;
}

function findLatestTicket(userId) {
  const history = readHistory();
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const item = history[i];
    if (item.userId === userId && item.status === 'success' && item.filePath) {
      return item;
    }
  }
  return null;
}

module.exports = {
  appendHistory,
  findLatestTicket,
  readHistory
};
