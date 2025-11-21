const SENSITIVE_KEYS = ['password', 'token', 'secret', 'authorization', 'cookie'];

function isSensitiveKey(key = '') {
  return SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive));
}

function sanitizeValue(value, key) {
  if (value === undefined) {
    return undefined;
  }
  if (isSensitiveKey(key)) {
    return '[REDACTED]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key));
  }
  if (value && typeof value === 'object') {
    return sanitizeObject(value);
  }
  return value;
}

function sanitizeObject(obj) {
  const sanitized = {};
  Object.entries(obj || {}).forEach(([key, value]) => {
    sanitized[key] = sanitizeValue(value, key);
  });
  return sanitized;
}

class Logger {
  constructor(context = {}) {
    this.context = sanitizeObject(context);
  }

  child(extraContext = {}) {
    return new Logger({ ...this.context, ...sanitizeObject(extraContext) });
  }

  log(severity, message, meta = {}) {
    const cleanedMeta = sanitizeObject(meta);
    const payload = {
      timestamp: new Date().toISOString(),
      severity: severity.toUpperCase(),
      message,
      context: { ...this.context, ...cleanedMeta }
    };

    if (meta instanceof Error) {
      payload.error = { message: meta.message, stack: meta.stack };
    } else if (meta.error instanceof Error) {
      payload.error = { message: meta.error.message, stack: meta.error.stack };
    }

    const serialized = JSON.stringify(payload);
    // Use stdout for all severities to keep logs centralized
    process.stdout.write(`${serialized}\n`);
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  error(message, meta) {
    this.log('error', message, meta);
  }
}

const logger = new Logger();

module.exports = { logger, Logger };
