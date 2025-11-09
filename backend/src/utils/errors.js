/**
 * Error codes for structured error handling (Phase 1.2)
 */
const ErrorCodes = {
  // Validation errors (400)
  INVALID_URL: 'INVALID_URL',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_FILENAME: 'INVALID_FILENAME',
  INVALID_REQUEST: 'INVALID_REQUEST',

  // Download errors (500)
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  VIDEO_UNAVAILABLE: 'VIDEO_UNAVAILABLE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONVERSION_FAILED: 'CONVERSION_FAILED',

  // Resource errors (404)
  NOT_FOUND: 'NOT_FOUND',

  // Auth errors (401, 403)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

class AppError extends Error {
  constructor(message, statusCode, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, code = ErrorCodes.INVALID_REQUEST) {
    super(message, 400, code);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, ErrorCodes.NOT_FOUND);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = ErrorCodes.UNAUTHORIZED) {
    super(message, 401, code);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, ErrorCodes.FORBIDDEN);
  }
}

class DownloadError extends AppError {
  constructor(message, code = ErrorCodes.DOWNLOAD_FAILED) {
    super(message, 500, code);
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, ErrorCodes.RATE_LIMIT_EXCEEDED);
  }
}

// Specific download error types (Phase 1.2)
class VideoUnavailableError extends DownloadError {
  constructor(message = 'Video is unavailable or private') {
    super(message, ErrorCodes.VIDEO_UNAVAILABLE);
  }
}

class NetworkError extends DownloadError {
  constructor(message = 'Network error occurred during download') {
    super(message, ErrorCodes.NETWORK_ERROR);
  }
}

class ConversionError extends DownloadError {
  constructor(message = 'Failed to convert audio format') {
    super(message, ErrorCodes.CONVERSION_FAILED);
  }
}

module.exports = {
  ErrorCodes,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  DownloadError,
  RateLimitError,
  VideoUnavailableError,
  NetworkError,
  ConversionError
};
