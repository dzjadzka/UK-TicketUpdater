/**
 * History tracking module for ticket download operations
 * Prefers database persistence; JSON file fallback remains for isolated dev/test usage.
 * @module history
 */

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

function getUserHistory(userId, { limit = 50, historyPath = DEFAULT_HISTORY_PATH, db } = {}) {
  if (!userId) {
    throw new Error('userId is required to read history');
  }

  if (db && typeof db.getTicketHistory === 'function') {
    return db.getTicketHistory(userId, limit);
  }

  const history = readHistory(historyPath);
  return history.filter((entry) => entry.userId === userId).slice(-limit).reverse();
}

function summarizeHistory(userId, { historyPath = DEFAULT_HISTORY_PATH, db } = {}) {
  if (!userId) {
    throw new Error('userId is required to summarize history');
  }

  if (db && typeof db.getTicketStats === 'function') {
    return db.getTicketStats(userId);
  }

  const history = readHistory(historyPath).filter((entry) => entry.userId === userId);
  return history.reduce(
    (acc, entry) => {
      const key = entry.status || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { success: 0, error: 0 }
  );
}

function shouldDownloadTicket({ userId, ticketVersion, contentHash, db }) {
  if (!db || typeof db.isTicketVersionNew !== 'function') {
    return true; // No database, assume download is needed
  }

  return db.isTicketVersionNew({ userId, ticketVersion, contentHash });
}

module.exports = {
  appendHistory,
  readHistory,
  DEFAULT_HISTORY_PATH,
  getUserHistory,
  summarizeHistory,
  shouldDownloadTicket
};
