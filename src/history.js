import fs from 'fs';
import path from 'path';

export function readHistory(historyFile) {
  if (!historyFile) {
    return [];
  }

  if (!fs.existsSync(historyFile)) {
    return [];
  }

  const raw = fs.readFileSync(historyFile, 'utf-8');

  if (!raw.trim()) {
    return [];
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return [];
  }
}

export function appendHistoryEntry(historyFile, entry) {
  if (!historyFile) {
    return entry;
  }

  const history = readHistory(historyFile);
  const nextEntry = { ...entry, timestamp: entry.timestamp || new Date().toISOString() };

  const directory = path.dirname(historyFile);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(historyFile, JSON.stringify([...history, nextEntry], null, 2));

  return nextEntry;
}
