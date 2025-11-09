const morgan = require('morgan');
const logger = require('../utils/logger');

// Custom token for response time
morgan.token('response-time-ms', (req, res) => {
  if (!req._startAt || !res._startAt) {
    return;
  }
  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
    (res._startAt[1] - req._startAt[1]) * 1e-6;
  return ms.toFixed(3);
});

// Custom format string
const format = ':method :url :status :response-time-ms ms - :res[content-length]';

// Create request logger middleware
const requestLogger = morgan(format, {
  stream: logger.stream,
  skip: (req, res) => {
    // Skip health check logs to reduce noise
    return req.url === '/health';
  }
});

module.exports = requestLogger;
