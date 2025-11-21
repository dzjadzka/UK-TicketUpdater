const { logger } = require('../src/logger');

describe('logger', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('redacts sensitive fields in structured output', () => {
    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});

    logger.info('test_message', {
      password: 'super-secret',
      nested: { ukPassword: 'another-secret' },
      token: 'token-value'
    });

    expect(writeSpy).toHaveBeenCalled();
    const raw = writeSpy.mock.calls[0][0];
    const parsed = JSON.parse(raw);

    expect(parsed.context.password).toBe('[REDACTED]');
    expect(parsed.context.nested.ukPassword).toBe('[REDACTED]');
    expect(parsed.context.token).toBe('[REDACTED]');
    expect(raw).not.toContain('super-secret');
    expect(raw).not.toContain('another-secret');
    expect(parsed.severity).toBe('INFO');
  });
});
