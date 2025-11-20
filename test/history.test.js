import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { appendHistoryEntry, readHistory } from '../src/history.js';

describe('history utilities', () => {
  it('creates the history file and appends entries', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'history-'));
    const historyPath = path.join(dir, 'history.json');

    const first = appendHistoryEntry(historyPath, { event: 'start' });
    expect(first.event).toBe('start');

    const second = appendHistoryEntry(historyPath, { event: 'finish', status: 'ok' });
    expect(second.status).toBe('ok');

    const history = readHistory(historyPath);
    expect(history).toHaveLength(2);
    expect(history[1].event).toBe('finish');
  });

  it('returns an empty array for missing or invalid files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'history-'));
    const missingPath = path.join(dir, 'missing.json');

    expect(readHistory(missingPath)).toEqual([]);

    const invalidPath = path.join(dir, 'invalid.json');
    fs.writeFileSync(invalidPath, 'not json');
    expect(readHistory(invalidPath)).toEqual([]);
  });
});
