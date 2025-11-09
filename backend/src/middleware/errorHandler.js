const logger = require('../utils/logger');

// Async handler wrapper to catch errors in async route handlers
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 Not Found handler
function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'Not found',
    message: `Cannot ${req.method} ${req.url}`
  });
}

// Main error handler with structured responses (Phase 1.2)
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';

  // Log the error
  logger.logError(err, req);

  // Don't expose internal errors in production
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production' && statusCode === 500) {
    message = 'An unexpected error occurred';
  }

  // Send structured error response (Phase 1.2)
  const response = {
    success: false,
    error: {
      message,
      code,
      statusCode,
      timestamp: err.timestamp || new Date().toISOString()
    }
  };

  // Include stack trace in development
  if (env === 'development' && err.stack) {
    response.error.stack = err.stack;
  }

  // Include additional error details if available
  if (err.details) {
    response.error.details = err.details;
  }

  res.status(statusCode).json(response);
}

// Handle uncaught exceptions
function setupUncaughtExceptionHandler() {
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! Shutting down...', {
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
  });
}

// Handle unhandled promise rejections
function setupUnhandledRejectionHandler() {
  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! Shutting down...', {
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
  });
}

module.exports = {
  asyncHandler,
  notFoundHandler,
  errorHandler,
  setupUncaughtExceptionHandler,
  setupUnhandledRejectionHandler
};
