const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const config = require('../config/environment');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: 'Too many requests',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict limiter for download endpoints
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 downloads per 15 minutes per IP
  message: {
    error: 'Download limit exceeded',
    message: 'Maximum 5 downloads per 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// Speed limiter (slow down repeat requests)
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 3,
  delayMs: 500
});

module.exports = {
  apiLimiter,
  downloadLimiter,
  speedLimiter
};
