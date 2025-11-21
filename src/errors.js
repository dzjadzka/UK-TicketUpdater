const { logger } = require('./logger');

class ApiError extends Error {
  constructor(status, code, message, options = {}) {
    super(message);
    this.status = status || 500;
    this.code = code || 'internal_error';
    this.expose = options.expose ?? this.status < 500;
    this.details = options.details;
  }

  static badRequest(code, message, details) {
    return new ApiError(400, code || 'bad_request', message, { expose: true, details });
  }

  static unauthorized(code, message) {
    return new ApiError(401, code || 'unauthorized', message, { expose: true });
  }

  static forbidden(code, message) {
    return new ApiError(403, code || 'forbidden', message, { expose: true });
  }

  static notFound(code, message) {
    return new ApiError(404, code || 'not_found', message, { expose: true });
  }

  static internal(code, message, error) {
    const apiError = new ApiError(500, code || 'internal_error', message || 'Unexpected server error');
    apiError.originalError = error;
    apiError.expose = false;
    return apiError;
  }
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const code = err.code || (status >= 500 ? 'internal_error' : 'error');
  const message = err.expose ? err.message : 'Unexpected server error';
  const response = { error: { code, message } };
  if (req?.requestId) {
    response.error.request_id = req.requestId;
  }

  logger.error('request_failed', {
    request_id: req?.requestId,
    route: req?.originalUrl,
    method: req?.method,
    user_id: req?.user?.id,
    error: err
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(status).json(response);
}

module.exports = {
  ApiError,
  asyncHandler,
  errorHandler
};
