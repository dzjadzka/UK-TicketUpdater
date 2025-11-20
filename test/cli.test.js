import path from 'path';
import { describe, expect, it } from 'vitest';
import { parseArgs, getDeviceProfile } from '../src/cli.js';

describe('parseArgs', () => {
  it('returns defaults when no args are provided', () => {
    const parsed = parseArgs([]);

    expect(parsed.device).toBe('desktop');
    expect(parsed.headless).toBe(true);
    expect(parsed.historyFile).toBe(path.resolve(process.cwd(), 'download-history.json'));
    expect(parsed.outputPath).toBe(path.join(process.cwd(), 'Filename.html'));
  });

  it('allows overriding options', () => {
    const parsed = parseArgs([
      '--device',
      'mobile',
      '--history',
      './tmp/history.json',
      '--output',
      './tmp',
      '--filename',
      'ticket.html',
      '--no-headless',
      '--product',
      'chrome'
    ]);

    expect(parsed.device).toBe('mobile');
    expect(parsed.headless).toBe(false);
    expect(parsed.historyFile).toBe(path.resolve('tmp/history.json'));
    expect(parsed.outputPath).toBe(path.join(path.resolve('tmp'), 'ticket.html'));
    expect(parsed.product).toBe('chrome');
  });
});

describe('getDeviceProfile', () => {
  it('provides a known viewport', () => {
    const profile = getDeviceProfile('tablet');

    expect(profile.viewport.width).toBe(1024);
    expect(profile.viewport.height).toBe(768);
    expect(profile.userAgent).toContain('iPad');
  });

  it('falls back to desktop when unknown', () => {
    const profile = getDeviceProfile('unknown-device');

    expect(profile.viewport.width).toBe(1280);
    expect(profile.viewport.height).toBe(720);
  });
});
