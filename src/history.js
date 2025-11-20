/**
 * History tracking module for ticket download operations
 * Supports both file-based (JSON) and database storage
 * @module history
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_HISTORY_PATH = path.resolve(__dirname, '../data/history.json');

/**
 * Ensures a directory exists, creating it recursively if needed
 * @private
 * @param {string} dirPath - The directory path to ensure exists
 */
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Reads history from a JSON file
 * @param {string} [historyPath] - Path to history file, defaults to DEFAULT_HISTORY_PATH
 * @returns {Array<Object>} Array of history entries, or empty array if file doesn't exist or is invalid
 */
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

/**
 * Appends a history entry to file or database
 * Automatically adds timestamp if not present
 * @param {Object} entry - History entry object
 * @param {string} entry.userId - User ID (required)
 * @param {string} [entry.deviceProfile] - Device profile used
 * @param {string} [entry.status] - Status of the operation
 * @param {string} [entry.filePath] - Path to downloaded file
 * @param {string} [entry.message] - Status message
 * @param {string} [historyPath] - Path to history file (ignored if db is provided)
 * @param {Object} [db] - Database instance with recordRun method
 */
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
