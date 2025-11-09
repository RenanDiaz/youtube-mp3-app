# YouTube MP3 Converter Backend - Implementation Plan

## Executive Summary

This document provides a phased, actionable implementation plan to transform the current prototype backend into a production-ready, secure, and scalable system. The current implementation has critical security vulnerabilities, stability issues, and architectural problems that must be addressed before any production deployment.

**Current State:** Single-file prototype with critical security flaws, no error handling, race conditions, and architectural debt.

**Target State:** Secure, scalable, well-tested backend with proper separation of concerns, comprehensive error handling, and production-ready infrastructure.

---

## Critical Issues Summary

### CRITICAL SECURITY (Must fix before production)
1. **Command Injection:** Format parameter directly passed to yt-dlp without validation
2. **Path Traversal:** No validation of user-provided names, potential directory traversal
3. **SSRF Vulnerability:** No URL validation, can download from arbitrary URLs
4. **Wide-Open CORS:** Allows requests from any origin
5. **No Access Control:** Public downloads folder, no authentication/authorization
6. **Exposed Internal Paths:** Error messages expose server filesystem structure

### CRITICAL STABILITY
1. **Race Conditions:** Async file operations can fail or cause data loss
2. **Unhandled Errors:** `throw err` in callbacks crashes the server
3. **Data Loss:** Downloads folder cleared on every restart
4. **No Graceful Shutdown:** In-progress downloads lost on restart
5. **Memory Issues:** Large files loaded into memory, no streaming

### PERFORMANCE
1. **Blocking Operations:** Synchronous operations block event loop
2. **No Streaming:** Files fully downloaded before responding
3. **No Caching:** Repeated downloads waste resources
4. **No Rate Limiting:** Vulnerable to DoS attacks

### ARCHITECTURE
1. **Monolithic:** All code in single 178-line file
2. **No Separation of Concerns:** Routes, business logic, file handling mixed
3. **Code Duplication:** Similar patterns repeated across endpoints
4. **Hard-coded Configuration:** Port, paths, format hard-coded

### MISSING FEATURES
1. **No Input Validation:** Beyond basic null checks
2. **No Logging:** Console.log only, no structured logging
3. **No Monitoring:** No metrics, health checks insufficient
4. **No Tests:** Zero test coverage
5. **No Documentation:** No API docs, inline comments, or developer guide
6. **No Environment Config:** No .env support

---

## Phase 1: CRITICAL SECURITY FIXES (Week 1)
**Priority:** MUST DO BEFORE PRODUCTION
**Estimated Time:** 3-5 days
**Complexity:** Medium

### Tasks

#### 1.1 Input Validation & Sanitization [CRITICAL]
**Complexity:** Medium | **Can run in parallel:** Yes
**Files:** `src/middleware/validation.js`, `src/utils/validators.js`

**New Dependencies:**
```bash
npm install joi validator express-validator
```

**Implementation:**

```javascript
// src/utils/validators.js
const validator = require('validator');

const ALLOWED_FORMATS = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'opus'];
const YOUTUBE_DOMAINS = [
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'm.youtube.com',
  'music.youtube.com'
];

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

/**
 * Validate YouTube URL - prevent SSRF attacks
 */
function validateYouTubeUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new ValidationError('URL is required and must be a string', 'url');
  }

  // Must be valid URL
  if (!validator.isURL(url, { protocols: ['http', 'https'], require_protocol: true })) {
    throw new ValidationError('Invalid URL format', 'url');
  }

  // Parse URL safely
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    throw new ValidationError('Malformed URL', 'url');
  }

  // CRITICAL: Only allow YouTube domains (prevent SSRF)
  const hostname = parsedUrl.hostname.toLowerCase();
  const isYouTubeDomain = YOUTUBE_DOMAINS.some(domain => 
    hostname === domain || hostname.endsWith(`.${domain}`)
  );

  if (!isYouTubeDomain) {
    throw new ValidationError(
      'URL must be from YouTube (youtube.com, youtu.be, or music.youtube.com)',
      'url'
    );
  }

  // CRITICAL: Block private/internal IPs in redirects
  const ip = parsedUrl.hostname;
  if (validator.isIP(ip)) {
    if (validator.isIP(ip, 4) && isPrivateIPv4(ip)) {
      throw new ValidationError('Private IP addresses are not allowed', 'url');
    }
    if (validator.isIP(ip, 6) && isPrivateIPv6(ip)) {
      throw new ValidationError('Private IP addresses are not allowed', 'url');
    }
  }

  return parsedUrl.toString();
}

/**
 * Validate audio format - prevent command injection
 */
function validateFormat(format) {
  if (!format) {
    return 'mp3'; // default
  }

  if (typeof format !== 'string') {
    throw new ValidationError('Format must be a string', 'format');
  }

  // CRITICAL: Whitelist only - prevent command injection
  const normalizedFormat = format.toLowerCase().trim();
  if (!ALLOWED_FORMATS.includes(normalizedFormat)) {
    throw new ValidationError(
      `Format must be one of: ${ALLOWED_FORMATS.join(', ')}`,
      'format'
    );
  }

  return normalizedFormat;
}

/**
 * Validate custom filename - prevent path traversal
 */
function validateCustomName(customName) {
  if (!customName) {
    return null; // optional field
  }

  if (typeof customName !== 'string') {
    throw new ValidationError('Custom name must be a string', 'customName');
  }

  // Length limits
  if (customName.length > 200) {
    throw new ValidationError('Custom name too long (max 200 characters)', 'customName');
  }

  if (customName.trim().length === 0) {
    throw new ValidationError('Custom name cannot be empty', 'customName');
  }

  // CRITICAL: Prevent path traversal attacks
  if (customName.includes('..') || customName.includes('/') || customName.includes('\\')) {
    throw new ValidationError(
      'Custom name cannot contain path separators or .. sequences',
      'customName'
    );
  }

  // Block hidden files
  if (customName.startsWith('.')) {
    throw new ValidationError('Custom name cannot start with a dot', 'customName');
  }

  // Block shell special characters
  const dangerousChars = /[;&|`$(){}[\]<>]/;
  if (dangerousChars.test(customName)) {
    throw new ValidationError(
      'Custom name contains invalid characters',
      'customName'
    );
  }

  return customName.trim();
}

/**
 * Validate URL array for batch downloads
 */
function validateUrlArray(urls) {
  if (!Array.isArray(urls)) {
    throw new ValidationError('URLs must be an array', 'urls');
  }

  // Rate limiting: max URLs per request
  if (urls.length === 0) {
    throw new ValidationError('At least one URL is required', 'urls');
  }

  if (urls.length > 50) {
    throw new ValidationError('Maximum 50 URLs per request', 'urls');
  }

  // Validate each URL
  return urls.map((url, index) => {
    try {
      return validateYouTubeUrl(url);
    } catch (error) {
      throw new ValidationError(
        `Invalid URL at index ${index}: ${error.message}`,
        `urls[${index}]`
      );
    }
  });
}

// Helper: Check for private IPv4 ranges
function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  return (
    parts[0] === 10 || // 10.0.0.0/8
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
    (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16
    parts[0] === 127 || // 127.0.0.0/8 (localhost)
    parts[0] === 0 || // 0.0.0.0/8
    parts[0] === 169 && parts[1] === 254 // 169.254.0.0/16 (link-local)
  );
}

// Helper: Check for private IPv6 ranges
function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  return (
    lower.startsWith('::1') || // localhost
    lower.startsWith('fc') || // Unique Local Addresses
    lower.startsWith('fd') || // Unique Local Addresses
    lower.startsWith('fe80:') // Link-local
  );
}

module.exports = {
  validateYouTubeUrl,
  validateFormat,
  validateCustomName,
  validateUrlArray,
  ValidationError,
  ALLOWED_FORMATS
};
```

```javascript
// src/middleware/validation.js
const { 
  validateYouTubeUrl, 
  validateFormat, 
  validateCustomName,
  validateUrlArray,
  ValidationError 
} = require('../utils/validators');

/**
 * Middleware: Validate single download request
 */
function validateDownloadRequest(req, res, next) {
  try {
    // Validate and sanitize inputs
    req.body.url = validateYouTubeUrl(req.body.url);
    req.body.format = validateFormat(req.body.format);
    req.body.customName = validateCustomName(req.body.customName);
    
    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        field: error.field
      });
    }
    next(error);
  }
}

/**
 * Middleware: Validate playlist download request
 */
function validatePlaylistRequest(req, res, next) {
  try {
    req.body.url = validateYouTubeUrl(req.body.url);
    req.body.format = validateFormat(req.body.format);
    
    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        field: error.field
      });
    }
    next(error);
  }
}

/**
 * Middleware: Validate batch download request
 */
function validateBatchRequest(req, res, next) {
  try {
    req.body.urls = validateUrlArray(req.body.urls);
    req.body.format = validateFormat(req.body.format);
    
    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        field: error.field
      });
    }
    next(error);
  }
}

module.exports = {
  validateDownloadRequest,
  validatePlaylistRequest,
  validateBatchRequest
};
```

**Breaking Changes:** None (only adds validation)

---

#### 1.2 Secure CORS Configuration [CRITICAL]
**Complexity:** Simple | **Can run in parallel:** Yes
**Files:** `src/middleware/cors.js`, `.env`

**Implementation:**

```javascript
// src/middleware/cors.js
const cors = require('cors');

function configureCORS() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000']; // Default for development

  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
    credentials: true, // Allow cookies (for future auth)
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 204
  };

  return cors(corsOptions);
}

module.exports = configureCORS;
```

```bash
# .env (create this file)
# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# For production, set specific domain:
# ALLOWED_ORIGINS=https://yourdomain.com
```

**Breaking Changes:** Frontend must be served from allowed origin

---

#### 1.3 Secure Download Access Control [CRITICAL]
**Complexity:** Medium | **Can run in parallel:** Yes
**Files:** `src/routes/files.js`, `src/middleware/fileAccess.js`

**Implementation:**

```javascript
// src/middleware/fileAccess.js
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// In-memory store for download tokens (use Redis in production)
const downloadTokens = new Map();

// Token expires after 15 minutes
const TOKEN_EXPIRY = 15 * 60 * 1000;

/**
 * Generate a secure token for file download
 */
function generateDownloadToken(filename) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = Date.now() + TOKEN_EXPIRY;
  
  downloadTokens.set(token, {
    filename: path.basename(filename), // Ensure no path traversal
    expiry
  });

  // Auto-cleanup expired tokens
  setTimeout(() => {
    downloadTokens.delete(token);
  }, TOKEN_EXPIRY);

  return token;
}

/**
 * Middleware: Verify download token
 */
async function verifyDownloadToken(req, res, next) {
  const { token } = req.query;
  const requestedFile = req.params.filename;

  if (!token) {
    return res.status(401).json({ error: 'Download token required' });
  }

  const tokenData = downloadTokens.get(token);

  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid or expired download token' });
  }

  if (Date.now() > tokenData.expiry) {
    downloadTokens.delete(token);
    return res.status(401).json({ error: 'Download token expired' });
  }

  // CRITICAL: Verify filename matches token
  if (tokenData.filename !== path.basename(requestedFile)) {
    return res.status(403).json({ error: 'Token does not match requested file' });
  }

  // CRITICAL: Prevent path traversal
  const safeFilename = path.basename(requestedFile);
  const downloadsDir = path.resolve(__dirname, '../../downloads');
  const fullPath = path.resolve(downloadsDir, safeFilename);

  // Ensure path is within downloads directory
  if (!fullPath.startsWith(downloadsDir)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Check file exists
  try {
    await fs.access(fullPath);
    req.safePath = fullPath;
    next();
  } catch (error) {
    return res.status(404).json({ error: 'File not found' });
  }
}

module.exports = {
  generateDownloadToken,
  verifyDownloadToken
};
```

```javascript
// src/routes/files.js
const express = require('express');
const router = express.Router();
const { verifyDownloadToken } = require('../middleware/fileAccess');

/**
 * Secure file download endpoint
 * Requires token generated at download time
 */
router.get('/:filename', verifyDownloadToken, (req, res) => {
  const { safePath } = req;
  
  res.download(safePath, (err) => {
    if (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed' });
      }
    }
  });
});

module.exports = router;
```

**Breaking Changes:** Download URLs now require token parameter

---

#### 1.4 Environment Configuration [CRITICAL]
**Complexity:** Simple | **Can run in parallel:** Yes
**Files:** `src/config/index.js`, `.env`, `.env.example`

**New Dependencies:**
```bash
npm install dotenv
```

**Implementation:**

```javascript
// src/config/index.js
require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Security
  allowedOrigins: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000'],
  
  // File Management
  downloadsDir: process.env.DOWNLOADS_DIR || './downloads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 500 * 1024 * 1024, // 500MB default
  tempDownloadExpiry: parseInt(process.env.TEMP_DOWNLOAD_EXPIRY, 10) || 3600000, // 1 hour
  
  // Rate Limiting
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 900000, // 15 min
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  
  // Download Limits
  maxUrlsPerRequest: parseInt(process.env.MAX_URLS_PER_REQUEST, 10) || 50,
  maxConcurrentDownloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS, 10) || 3,
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Feature Flags
  clearDownloadsOnStartup: process.env.CLEAR_DOWNLOADS_ON_STARTUP === 'true',
  
  // Validation
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test'
};

// Validation
if (config.isProduction) {
  if (config.allowedOrigins.includes('*')) {
    throw new Error('ALLOWED_ORIGINS cannot be * in production');
  }
  if (config.allowedOrigins.some(o => o.includes('localhost'))) {
    console.warn('WARNING: localhost in ALLOWED_ORIGINS in production');
  }
}

module.exports = config;
```

```bash
# .env.example (template for developers)
# Copy to .env and configure

# Server
PORT=5001
NODE_ENV=development

# Security
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# File Management
DOWNLOADS_DIR=./downloads
MAX_FILE_SIZE=524288000
TEMP_DOWNLOAD_EXPIRY=3600000

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Download Limits
MAX_URLS_PER_REQUEST=50
MAX_CONCURRENT_DOWNLOADS=3

# Logging
LOG_LEVEL=info

# Feature Flags
CLEAR_DOWNLOADS_ON_STARTUP=false
```

**Breaking Changes:** Requires .env file in production

---

#### 1.5 Rate Limiting & DoS Protection [CRITICAL]
**Complexity:** Simple | **Can run in parallel:** Yes
**Files:** `src/middleware/rateLimit.js`

**New Dependencies:**
```bash
npm install express-rate-limit
```

**Implementation:**

```javascript
// src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitMax,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in test environment
    return config.isTest;
  }
});

/**
 * Strict rate limiter for download endpoints
 */
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 download requests per 15 min per IP
  message: { 
    error: 'Download rate limit exceeded. Maximum 10 downloads per 15 minutes.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => config.isTest
});

/**
 * Very strict rate limiter for batch/playlist downloads
 */
const batchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Max 3 batch requests per hour per IP
  message: { 
    error: 'Batch download rate limit exceeded. Maximum 3 batch downloads per hour.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => config.isTest
});

module.exports = {
  apiLimiter,
  downloadLimiter,
  batchLimiter
};
```

**Breaking Changes:** None (only adds limits)

---

#### 1.6 Security Headers & Best Practices [CRITICAL]
**Complexity:** Simple | **Can run in parallel:** Yes
**Files:** `src/middleware/security.js`

**New Dependencies:**
```bash
npm install helmet
```

**Implementation:**

```javascript
// src/middleware/security.js
const helmet = require('helmet');

function configureSecurityHeaders() {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    // Hide X-Powered-By header
    hidePoweredBy: true,
    // Strict Transport Security (HTTPS only)
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    // Prevent MIME type sniffing
    noSniff: true,
    // XSS Protection
    xssFilter: true,
    // Clickjacking protection
    frameguard: {
      action: 'deny'
    }
  });
}

module.exports = configureSecurityHeaders;
```

**Breaking Changes:** None

---

### Phase 1 Integration

**Update main index.js:**

```javascript
// index.js (updated)
require('dotenv').config();
const express = require('express');
const config = require('./src/config');
const configureCORS = require('./src/middleware/cors');
const configureSecurityHeaders = require('./src/middleware/security');
const { apiLimiter } = require('./src/middleware/rateLimit');

const app = express();

// Security middleware (MUST be first)
app.use(configureSecurityHeaders());
app.use(configureCORS());
app.use(apiLimiter);

// Body parsing
app.use(express.json({ limit: '1mb' })); // Prevent large payload attacks

// Routes (will add in Phase 3)
// app.use('/api/download', require('./src/routes/download'));
// app.use('/api/files', require('./src/routes/files'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
});
```

---

### Phase 1 Testing Checklist

- [ ] Test SSRF protection: Try downloading from localhost, 127.0.0.1, private IPs
- [ ] Test command injection: Try formats like `mp3; rm -rf /`, `mp3 && cat /etc/passwd`
- [ ] Test path traversal: Try custom names like `../../../etc/passwd`, `../../file`
- [ ] Test CORS: Request from unauthorized origin should be blocked
- [ ] Test rate limiting: Exceed limits and verify 429 responses
- [ ] Test download tokens: Expired/invalid tokens should be rejected
- [ ] Test format validation: Only whitelisted formats accepted
- [ ] Test URL validation: Non-YouTube URLs rejected

---

## Phase 2: STABILITY & ERROR HANDLING (Week 2)
**Priority:** HIGH - Critical for reliability
**Estimated Time:** 5-7 days
**Complexity:** Medium-High

### Tasks

#### 2.1 Centralized Error Handling [HIGH]
**Complexity:** Medium | **Can run in parallel:** Yes
**Files:** `src/middleware/errorHandler.js`, `src/utils/errors.js`

**Implementation:**

```javascript
// src/utils/errors.js
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, field) {
    super(message, 400);
    this.field = field;
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404);
  }
}

class DownloadError extends AppError {
  constructor(message, originalError) {
    super(message, 500);
    this.originalError = originalError;
  }
}

class RateLimitError extends AppError {
  constructor(message) {
    super(message, 429);
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  DownloadError,
  RateLimitError
};
```

```javascript
// src/middleware/errorHandler.js
const config = require('../config');
const logger = require('../utils/logger'); // Will create in 2.2

/**
 * Global error handler
 * MUST be last middleware
 */
function errorHandler(err, req, res, next) {
  // Log error
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    statusCode: err.statusCode || 500
  });

  // Don't leak error details in production
  const isDevelopment = config.isDevelopment;
  
  // Operational errors (known, safe to send to client)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
      field: err.field,
      timestamp: err.timestamp,
      ...(isDevelopment && { stack: err.stack })
    });
  }

  // Programming errors (unknown, don't expose details)
  // Log the error but send generic message
  logger.error('Programming error detected', {
    error: err.message,
    stack: err.stack
  });

  return res.status(500).json({
    error: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { 
      message: err.message,
      stack: err.stack 
    })
  });
}

/**
 * Handle 404 - Route not found
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle uncaught errors that would crash the server
 */
function setupGlobalErrorHandlers() {
  process.on('uncaughtException', (error) => {
    logger.error('UNCAUGHT EXCEPTION! Shutting down...', {
      error: error.message,
      stack: error.stack
    });
    
    // Exit with failure code
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('UNHANDLED REJECTION! Shutting down...', {
      reason,
      promise
    });
    
    // Exit with failure code
    process.exit(1);
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
  setupGlobalErrorHandlers
};
```

**Breaking Changes:** Error response format changes

---

#### 2.2 Structured Logging [HIGH]
**Complexity:** Medium | **Can run in parallel:** Yes
**Files:** `src/utils/logger.js`

**New Dependencies:**
```bash
npm install winston winston-daily-rotate-file
```

**Implementation:**

```javascript
// src/utils/logger.js
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const config = require('../config');

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format (human-readable for development)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += `\n${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  })
);

// Transports
const transports = [];

// Console (always on)
transports.push(
  new winston.transports.Console({
    format: config.isDevelopment ? consoleFormat : logFormat
  })
);

// File rotation (production)
if (config.isProduction) {
  // Error logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      maxSize: '20m',
      format: logFormat
    })
  );

  // Combined logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '20m',
      format: logFormat
    })
  );
}

// Create logger
const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  transports,
  exitOnError: false
});

// Add request logging helper
logger.logRequest = (req, additionalData = {}) => {
  logger.info('Request received', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    ...additionalData
  });
};

// Add response logging helper
logger.logResponse = (req, res, duration) => {
  logger.info('Request completed', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip
  });
};

module.exports = logger;
```

**Request logging middleware:**

```javascript
// src/middleware/requestLogger.js
const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Log request
  logger.logRequest(req);

  // Capture response
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logResponse(req, res, duration);
  });

  next();
}

module.exports = requestLogger;
```

**Breaking Changes:** None (only adds logging)

---

#### 2.3 Fix Race Conditions in File Operations [CRITICAL]
**Complexity:** High | **Can run in parallel:** No (depends on 2.2)
**Files:** `src/services/fileService.js`

**New Dependencies:**
```bash
npm install fs-extra proper-lockfile
```

**Implementation:**

```javascript
// src/services/fileService.js
const fs = require('fs-extra');
const path = require('path');
const lockfile = require('proper-lockfile');
const logger = require('../utils/logger');
const config = require('../config');
const { AppError } = require('../utils/errors');

class FileService {
  constructor() {
    this.downloadsDir = path.resolve(config.downloadsDir);
    this.locks = new Map(); // Track active locks
  }

  /**
   * Initialize downloads directory
   */
  async initialize() {
    try {
      // Ensure directory exists
      await fs.ensureDir(this.downloadsDir);
      logger.info('Downloads directory initialized', { path: this.downloadsDir });

      // Clear old files if configured (but safely)
      if (config.clearDownloadsOnStartup) {
        await this.clearDirectory();
      }
    } catch (error) {
      logger.error('Failed to initialize downloads directory', { error: error.message });
      throw new AppError('Failed to initialize file service', 500, false);
    }
  }

  /**
   * Safely clear directory (with locks to prevent race conditions)
   */
  async clearDirectory() {
    try {
      const files = await fs.readdir(this.downloadsDir);
      
      // Delete files in parallel with concurrency limit
      const deletePromises = files.map(file => 
        this.deleteFile(file).catch(err => {
          logger.warn('Failed to delete file during cleanup', { 
            file, 
            error: err.message 
          });
        })
      );

      await Promise.all(deletePromises);
      logger.info('Downloads directory cleared', { filesDeleted: files.length });
    } catch (error) {
      logger.error('Failed to clear downloads directory', { error: error.message });
    }
  }

  /**
   * Safely delete a file (with lock to prevent race conditions)
   */
  async deleteFile(filename) {
    const filePath = path.join(this.downloadsDir, path.basename(filename));
    
    // Acquire lock
    let release;
    try {
      release = await lockfile.lock(filePath, {
        retries: {
          retries: 3,
          minTimeout: 100,
          maxTimeout: 500
        }
      });
    } catch (error) {
      // File doesn't exist or couldn't lock (might already be deleted)
      logger.debug('Could not lock file for deletion', { 
        filename, 
        error: error.message 
      });
      return;
    }

    try {
      // Check if file/directory exists
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        await fs.remove(filePath);
      } else {
        await fs.unlink(filePath);
      }
      
      logger.info('File deleted', { filename });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to delete file', { 
          filename, 
          error: error.message 
        });
        throw error;
      }
      // File already deleted, ignore
    } finally {
      // Release lock
      if (release) {
        await release();
      }
    }
  }

  /**
   * Safely delete directory
   */
  async deleteDirectory(dirPath) {
    const fullPath = path.join(this.downloadsDir, path.basename(dirPath));
    
    try {
      await fs.remove(fullPath);
      logger.info('Directory deleted', { path: fullPath });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to delete directory', { 
          path: fullPath, 
          error: error.message 
        });
        throw error;
      }
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filename) {
    const filePath = path.join(this.downloadsDir, path.basename(filename));
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file size
   */
  async getFileSize(filename) {
    const filePath = path.join(this.downloadsDir, path.basename(filename));
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      throw new AppError(`File not found: ${filename}`, 404);
    }
  }

  /**
   * Get safe file path (prevents path traversal)
   */
  getSafePath(filename) {
    const basename = path.basename(filename);
    const fullPath = path.resolve(this.downloadsDir, basename);
    
    // Ensure path is within downloads directory
    if (!fullPath.startsWith(this.downloadsDir)) {
      throw new AppError('Invalid file path', 403);
    }
    
    return fullPath;
  }

  /**
   * Schedule file deletion after expiry time
   */
  scheduleFileDeletion(filename, expiryMs = config.tempDownloadExpiry) {
    setTimeout(async () => {
      try {
        await this.deleteFile(filename);
        logger.info('Expired file deleted', { filename });
      } catch (error) {
        logger.error('Failed to delete expired file', { 
          filename, 
          error: error.message 
        });
      }
    }, expiryMs);
  }

  /**
   * Ensure directory exists
   */
  async ensureDirectory(dirName) {
    const dirPath = path.join(this.downloadsDir, path.basename(dirName));
    await fs.ensureDir(dirPath);
    return dirPath;
  }
}

// Singleton instance
module.exports = new FileService();
```

**Breaking Changes:** None (internal implementation only)

---

#### 2.4 Graceful Shutdown [HIGH]
**Complexity:** Medium | **Can run in parallel:** Yes
**Files:** `src/utils/gracefulShutdown.js`

**Implementation:**

```javascript
// src/utils/gracefulShutdown.js
const logger = require('./logger');

class GracefulShutdown {
  constructor() {
    this.isShuttingDown = false;
    this.activeConnections = new Set();
    this.shutdownCallbacks = [];
  }

  /**
   * Register cleanup callback
   */
  onShutdown(callback) {
    this.shutdownCallbacks.push(callback);
  }

  /**
   * Track active connection
   */
  trackConnection(connection) {
    this.activeConnections.add(connection);
    connection.on('close', () => {
      this.activeConnections.delete(connection);
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  setup(server) {
    // Track connections
    server.on('connection', (connection) => {
      this.trackConnection(connection);
    });

    // Handle shutdown signals
    const shutdownHandler = async (signal) => {
      if (this.isShuttingDown) {
        logger.warn('Already shutting down, forcing exit');
        process.exit(1);
      }

      this.isShuttingDown = true;
      logger.info(`${signal} received, starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('Server closed, no longer accepting connections');

        try {
          // Run cleanup callbacks
          logger.info('Running cleanup tasks...');
          await Promise.all(
            this.shutdownCallbacks.map(callback => 
              Promise.resolve(callback()).catch(err => {
                logger.error('Cleanup callback failed', { error: err.message });
              })
            )
          );

          logger.info('Cleanup complete, exiting');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error: error.message });
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Graceful shutdown timeout, forcing exit');
        process.exit(1);
      }, 30000); // 30 seconds

      // Close active connections
      this.activeConnections.forEach(connection => {
        connection.end();
        setTimeout(() => connection.destroy(), 5000); // Force close after 5s
      });
    };

    // Listen for shutdown signals
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));

    logger.info('Graceful shutdown handlers registered');
  }

  /**
   * Check if shutting down
   */
  isShuttingDown() {
    return this.isShuttingDown;
  }
}

// Singleton instance
module.exports = new GracefulShutdown();
```

**Usage in index.js:**

```javascript
const gracefulShutdown = require('./src/utils/gracefulShutdown');
const fileService = require('./src/services/fileService');

// ... app setup ...

const server = app.listen(config.port, async () => {
  logger.info(`Server running on port ${config.port}`);
  
  // Initialize file service
  await fileService.initialize();
});

// Setup graceful shutdown
gracefulShutdown.setup(server);

// Register cleanup tasks
gracefulShutdown.onShutdown(async () => {
  logger.info('Cleaning up active downloads...');
  // Add cleanup logic for in-progress downloads
});
```

**Breaking Changes:** None

---

#### 2.5 Async/Await Error Handling Wrapper [HIGH]
**Complexity:** Simple | **Can run in parallel:** Yes
**Files:** `src/utils/asyncHandler.js`

**Implementation:**

```javascript
// src/utils/asyncHandler.js

/**
 * Wrapper for async route handlers
 * Catches errors and passes to error middleware
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
```

**Usage example:**

```javascript
const asyncHandler = require('../utils/asyncHandler');

router.post('/download', asyncHandler(async (req, res) => {
  // Any errors thrown here are automatically caught and passed to error middleware
  const result = await downloadService.download(req.body.url);
  res.json(result);
  // No try/catch needed!
}));
```

**Breaking Changes:** None (simplifies code)

---

### Phase 2 Testing Checklist

- [ ] Test file deletion race conditions: Delete same file concurrently
- [ ] Test graceful shutdown: Send SIGTERM during active download
- [ ] Test error logging: Verify all errors logged with proper context
- [ ] Test error responses: No stack traces in production mode
- [ ] Test uncaught exceptions: Server doesn't crash
- [ ] Test async errors: All promise rejections caught
- [ ] Test file cleanup: Old files deleted without errors
- [ ] Test concurrent operations: No file corruption

---

## Phase 3: CODE RESTRUCTURING (Week 3)
**Priority:** MEDIUM - Important for maintainability
**Estimated Time:** 5-7 days
**Complexity:** Medium

### Tasks

#### 3.1 Service Layer for Business Logic [MEDIUM]
**Complexity:** Medium | **Can run in parallel:** Partial
**Files:** `src/services/downloadService.js`, `src/services/ytdlpService.js`

**Implementation:**

```javascript
// src/services/ytdlpService.js
const YtDlpWrap = require('yt-dlp-wrap').default;
const logger = require('../utils/logger');
const { DownloadError } = require('../utils/errors');

class YtdlpService {
  constructor() {
    this.ytDlp = new YtDlpWrap('yt-dlp');
  }

  /**
   * Get video metadata
   */
  async getVideoInfo(url) {
    try {
      logger.info('Fetching video metadata', { url });
      const metadata = await this.ytDlp.getVideoInfo(url);
      logger.info('Metadata fetched', { 
        title: metadata.title,
        duration: metadata.duration 
      });
      return metadata;
    } catch (error) {
      logger.error('Failed to fetch metadata', { 
        url, 
        error: error.message 
      });
      throw new DownloadError('Failed to fetch video information', error);
    }
  }

  /**
   * Download single audio file
   */
  async downloadAudio(url, outputPath, format) {
    try {
      logger.info('Starting download', { url, outputPath, format });
      
      const args = [
        url,
        '-x',
        '--audio-format', format,
        '-o', outputPath,
        '--no-playlist', // Explicitly disable playlist
        '--restrict-filenames', // Safe filenames
        '--no-overwrites', // Don't overwrite existing
        '--continue', // Resume interrupted downloads
      ];

      await this.ytDlp.execPromise(args);
      
      logger.info('Download complete', { outputPath });
    } catch (error) {
      logger.error('Download failed', { 
        url, 
        outputPath, 
        error: error.message 
      });
      throw new DownloadError('Audio download failed', error);
    }
  }

  /**
   * Download playlist
   */
  async downloadPlaylist(url, outputDir, format) {
    try {
      logger.info('Starting playlist download', { url, outputDir, format });
      
      const outputTemplate = `${outputDir}/%(title)s.%(ext)s`;
      
      const args = [
        url,
        '-x',
        '--audio-format', format,
        '-o', outputTemplate,
        '--yes-playlist', // Explicitly enable playlist
        '--restrict-filenames',
        '--no-overwrites',
        '--continue',
      ];

      await this.ytDlp.execPromise(args);
      
      logger.info('Playlist download complete', { outputDir });
    } catch (error) {
      logger.error('Playlist download failed', { 
        url, 
        outputDir, 
        error: error.message 
      });
      throw new DownloadError('Playlist download failed', error);
    }
  }

  /**
   * Download multiple URLs
   */
  async downloadMultiple(urls, outputDir, format) {
    try {
      logger.info('Starting batch download', { 
        count: urls.length, 
        outputDir, 
        format 
      });
      
      const outputTemplate = `${outputDir}/%(title)s.%(ext)s`;
      
      const args = [
        ...urls,
        '-x',
        '--audio-format', format,
        '-o', outputTemplate,
        '--no-playlist',
        '--restrict-filenames',
        '--no-overwrites',
        '--continue',
      ];

      await this.ytDlp.execPromise(args);
      
      logger.info('Batch download complete', { outputDir });
    } catch (error) {
      logger.error('Batch download failed', { 
        count: urls.length, 
        outputDir, 
        error: error.message 
      });
      throw new DownloadError('Batch download failed', error);
    }
  }
}

// Singleton instance
module.exports = new YtdlpService();
```

```javascript
// src/services/downloadService.js
const path = require('path');
const sanitize = require('sanitize-filename');
const AdmZip = require('adm-zip');
const ytdlpService = require('./ytdlpService');
const fileService = require('./fileService');
const logger = require('../utils/logger');
const { generateDownloadToken } = require('../middleware/fileAccess');
const { DownloadError } = require('../utils/errors');

class DownloadService {
  /**
   * Download single audio file
   */
  async downloadSingle(url, format, customName = null) {
    logger.info('Processing single download', { url, format, customName });

    try {
      // Normalize URL
      const normalizedUrl = this.normalizeUrl(url);

      // Get metadata
      const metadata = await ytdlpService.getVideoInfo(normalizedUrl);
      const videoTitle = metadata.title || 'downloaded';

      // Determine output filename
      const outputName = customName || videoTitle;
      const sanitizedName = sanitize(outputName);
      const filename = `${sanitizedName}.${format}`;
      const outputPath = fileService.getSafePath(filename);

      // Download
      await ytdlpService.downloadAudio(normalizedUrl, outputPath, format);

      // Generate download token
      const token = generateDownloadToken(filename);

      // Schedule cleanup
      fileService.scheduleFileDeletion(filename);

      logger.info('Single download successful', { filename });

      return {
        success: true,
        message: 'Download complete',
        filename,
        token,
        title: videoTitle
      };
    } catch (error) {
      logger.error('Single download failed', { 
        url, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Download playlist and zip
   */
  async downloadPlaylist(url, format) {
    logger.info('Processing playlist download', { url, format });

    try {
      // Get playlist metadata
      const metadata = await ytdlpService.getVideoInfo(url);
      const playlistTitle = sanitize(metadata.title || 'playlist');
      
      // Create temp directory for downloads
      const outputDir = await fileService.ensureDirectory(playlistTitle);

      // Download playlist
      await ytdlpService.downloadPlaylist(url, outputDir, format);

      // Zip the downloads
      const zipFilename = `${playlistTitle}.zip`;
      const zipPath = fileService.getSafePath(zipFilename);
      
      logger.info('Creating zip archive', { zipPath });
      const zip = new AdmZip();
      zip.addLocalFolder(outputDir);
      zip.writeZip(zipPath);

      // Clean up individual files
      await fileService.deleteDirectory(outputDir);

      // Generate download token
      const token = generateDownloadToken(zipFilename);

      // Schedule cleanup
      fileService.scheduleFileDeletion(zipFilename);

      logger.info('Playlist download successful', { zipFilename });

      return {
        success: true,
        message: 'Playlist download complete',
        filename: zipFilename,
        token,
        title: playlistTitle
      };
    } catch (error) {
      logger.error('Playlist download failed', { 
        url, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Download multiple URLs and zip
   */
  async downloadBatch(urls, format) {
    logger.info('Processing batch download', { count: urls.length, format });

    try {
      const dirName = `batch-${Date.now()}`;
      const outputDir = await fileService.ensureDirectory(dirName);

      // Download all URLs
      await ytdlpService.downloadMultiple(urls, outputDir, format);

      // Zip the downloads
      const zipFilename = `${dirName}.zip`;
      const zipPath = fileService.getSafePath(zipFilename);
      
      logger.info('Creating zip archive', { zipPath });
      const zip = new AdmZip();
      zip.addLocalFolder(outputDir);
      zip.writeZip(zipPath);

      // Clean up individual files
      await fileService.deleteDirectory(outputDir);

      // Generate download token
      const token = generateDownloadToken(zipFilename);

      // Schedule cleanup
      fileService.scheduleFileDeletion(zipFilename);

      logger.info('Batch download successful', { zipFilename, count: urls.length });

      return {
        success: true,
        message: 'Batch download complete',
        filename: zipFilename,
        token,
        count: urls.length
      };
    } catch (error) {
      logger.error('Batch download failed', { 
        count: urls.length, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Normalize YouTube URL
   */
  normalizeUrl(url) {
    // Convert music.youtube.com to www.youtube.com
    return url.replace('music.youtube.com', 'www.youtube.com');
  }
}

// Singleton instance
module.exports = new DownloadService();
```

**Breaking Changes:** None (internal refactor)

---

#### 3.2 Route Handlers [MEDIUM]
**Complexity:** Simple | **Can run in parallel:** No (depends on 3.1)
**Files:** `src/routes/download.js`, `src/routes/health.js`

**Implementation:**

```javascript
// src/routes/download.js
const express = require('express');
const router = express.Router();
const downloadService = require('../services/downloadService');
const asyncHandler = require('../utils/asyncHandler');
const { 
  validateDownloadRequest,
  validatePlaylistRequest,
  validateBatchRequest 
} = require('../middleware/validation');
const { 
  downloadLimiter, 
  batchLimiter 
} = require('../middleware/rateLimit');

/**
 * POST /api/download
 * Download single audio file
 */
router.post(
  '/',
  downloadLimiter,
  validateDownloadRequest,
  asyncHandler(async (req, res) => {
    const { url, format, customName } = req.body;
    
    const result = await downloadService.downloadSingle(url, format, customName);
    
    res.json(result);
  })
);

/**
 * POST /api/download/playlist
 * Download playlist as zip
 */
router.post(
  '/playlist',
  batchLimiter,
  validatePlaylistRequest,
  asyncHandler(async (req, res) => {
    const { url, format } = req.body;
    
    const result = await downloadService.downloadPlaylist(url, format);
    
    res.json(result);
  })
);

/**
 * POST /api/download/batch
 * Download multiple URLs as zip
 */
router.post(
  '/batch',
  batchLimiter,
  validateBatchRequest,
  asyncHandler(async (req, res) => {
    const { urls, format } = req.body;
    
    const result = await downloadService.downloadBatch(urls, format);
    
    res.json(result);
  })
);

module.exports = router;
```

```javascript
// src/routes/health.js
const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const config = require('../config');

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: process.env.npm_package_version || '1.0.0'
  };

  // Check downloads directory is writable
  try {
    await fs.access(config.downloadsDir, fs.constants.W_OK);
    health.downloadsDir = 'OK';
  } catch {
    health.downloadsDir = 'ERROR';
    health.status = 'DEGRADED';
  }

  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
```

**Breaking Changes:** API paths change from `/download` to `/api/download`

---

#### 3.3 Update Main Entry Point [MEDIUM]
**Complexity:** Simple | **Can run in parallel:** No (depends on 3.1, 3.2)
**Files:** `index.js` (rewrite)

**Implementation:**

```javascript
// index.js (complete rewrite)
require('dotenv').config();
const express = require('express');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const fileService = require('./src/services/fileService');
const gracefulShutdown = require('./src/utils/gracefulShutdown');

// Middleware
const configureCORS = require('./src/middleware/cors');
const configureSecurityHeaders = require('./src/middleware/security');
const requestLogger = require('./src/middleware/requestLogger');
const { apiLimiter } = require('./src/middleware/rateLimit');
const { 
  errorHandler, 
  notFoundHandler,
  setupGlobalErrorHandlers 
} = require('./src/middleware/errorHandler');

// Routes
const downloadRoutes = require('./src/routes/download');
const fileRoutes = require('./src/routes/files');
const healthRoutes = require('./src/routes/health');

// Setup global error handlers
setupGlobalErrorHandlers();

// Initialize Express app
const app = express();

// Security middleware (MUST be first)
app.use(configureSecurityHeaders());
app.use(configureCORS());
app.use(apiLimiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use(requestLogger);

// API Routes
app.use('/health', healthRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/files', fileRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (MUST be last)
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Initialize file service
    await fileService.initialize();

    // Start listening
    const server = app.listen(config.port, () => {
      logger.info(`Server started`, {
        port: config.port,
        environment: config.nodeEnv,
        pid: process.pid
      });
    });

    // Setup graceful shutdown
    gracefulShutdown.setup(server);

    // Register cleanup tasks
    gracefulShutdown.onShutdown(async () => {
      logger.info('Performing final cleanup...');
      // Add any cleanup logic here
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Start the server
start();

module.exports = app; // For testing
```

**Breaking Changes:** Multiple (see notes)

---

#### 3.4 Package.json Updates [MEDIUM]
**Complexity:** Simple | **Can run in parallel:** Yes
**Files:** `backend/package.json`

**Implementation:**

```json
{
  "name": "youtube-mp3-backend",
  "version": "2.0.0",
  "description": "Secure YouTube to MP3 converter backend",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "NODE_ENV=development nodemon index.js",
    "test": "NODE_ENV=test jest --coverage",
    "test:watch": "NODE_ENV=test jest --watch",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write \"**/*.js\"",
    "validate": "npm run lint && npm test"
  },
  "keywords": ["youtube", "mp3", "converter", "audio"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "adm-zip": "^0.5.16",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express": "^5.1.0",
    "express-rate-limit": "^7.1.5",
    "fs-extra": "^11.2.0",
    "helmet": "^7.1.0",
    "joi": "^17.11.0",
    "proper-lockfile": "^4.1.2",
    "sanitize-filename": "^1.6.3",
    "validator": "^13.11.0",
    "winston": "^3.11.0",
    "winston-daily-rotate-file": "^4.7.1",
    "yt-dlp-wrap": "^2.3.12"
  },
  "devDependencies": {
    "eslint": "^8.56.0",
    "eslint-config-airbnb-base": "^15.0.0",
    "eslint-plugin-import": "^2.29.1",
    "jest": "^29.7.0",
    "nodemon": "^3.0.3",
    "prettier": "^3.2.4",
    "supertest": "^6.3.4"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Install new dependencies:**
```bash
cd backend
npm install
npm install --save-dev eslint eslint-config-airbnb-base eslint-plugin-import jest nodemon prettier supertest
```

**Breaking Changes:** Requires Node.js 18+

---

### Phase 3 Breaking Changes Summary

1. **API Routes:** `/download` → `/api/download`
2. **Download Response:** Now includes `token` field (required for download)
3. **Download URLs:** Must include `?token=xxx` parameter
4. **Environment:** Requires `.env` file
5. **Node Version:** Requires Node.js 18+

**Migration guide for frontend:**

```javascript
// OLD
const response = await fetch('http://localhost:5001/download', {
  method: 'POST',
  body: JSON.stringify({ url, format })
});
const { file } = await response.json();
const downloadUrl = `http://localhost:5001/downloads/${file}`;

// NEW
const response = await fetch('http://localhost:5001/api/download', {
  method: 'POST',
  body: JSON.stringify({ url, format })
});
const { filename, token } = await response.json();
const downloadUrl = `http://localhost:5001/api/files/${filename}?token=${token}`;
```

---

## Phase 4: PERFORMANCE OPTIMIZATION (Week 4)
**Priority:** MEDIUM - Important for user experience
**Estimated Time:** 5-7 days
**Complexity:** High

### Tasks

#### 4.1 Job Queue for Background Processing [MEDIUM]
**Complexity:** High | **Can run in parallel:** Yes
**Files:** `src/services/queueService.js`, `src/workers/downloadWorker.js`

**New Dependencies:**
```bash
npm install bull ioredis
```

**Why:** Currently downloads block the request. Move to background queue so API responds immediately.

**Implementation:**

```javascript
// src/services/queueService.js
const Queue = require('bull');
const config = require('../config');
const logger = require('../utils/logger');

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3
};

// Create download queue
const downloadQueue = new Queue('downloads', {
  redis: REDIS_CONFIG,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100, // Keep last 100
    removeOnFail: 500 // Keep last 500 failures
  }
});

// Queue event handlers
downloadQueue.on('error', (error) => {
  logger.error('Queue error', { error: error.message });
});

downloadQueue.on('failed', (job, error) => {
  logger.error('Job failed', {
    jobId: job.id,
    data: job.data,
    error: error.message,
    attempts: job.attemptsMade
  });
});

downloadQueue.on('completed', (job, result) => {
  logger.info('Job completed', {
    jobId: job.id,
    duration: Date.now() - job.timestamp,
    result
  });
});

module.exports = {
  downloadQueue
};
```

```javascript
// src/workers/downloadWorker.js
const { downloadQueue } = require('../services/queueService');
const downloadService = require('../services/downloadService');
const logger = require('../utils/logger');

// Process download jobs
downloadQueue.process(3, async (job) => {
  const { type, data } = job.data;
  
  logger.info('Processing download job', {
    jobId: job.id,
    type,
    data
  });

  try {
    let result;

    switch (type) {
      case 'single':
        result = await downloadService.downloadSingle(
          data.url,
          data.format,
          data.customName
        );
        break;
      
      case 'playlist':
        result = await downloadService.downloadPlaylist(
          data.url,
          data.format
        );
        break;
      
      case 'batch':
        result = await downloadService.downloadBatch(
          data.urls,
          data.format
        );
        break;
      
      default:
        throw new Error(`Unknown job type: ${type}`);
    }

    return result;
  } catch (error) {
    logger.error('Download job failed', {
      jobId: job.id,
      error: error.message
    });
    throw error;
  }
});

logger.info('Download worker started');

module.exports = downloadQueue;
```

**Update download routes to use queue:**

```javascript
// src/routes/download.js (updated)
const { downloadQueue } = require('../services/queueService');

router.post('/', downloadLimiter, validateDownloadRequest, asyncHandler(async (req, res) => {
  const { url, format, customName } = req.body;
  
  // Add to queue
  const job = await downloadQueue.add({
    type: 'single',
    data: { url, format, customName }
  });

  res.json({
    jobId: job.id,
    status: 'queued',
    message: 'Download queued successfully'
  });
}));

// Add status endpoint
router.get('/status/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const job = await downloadQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const state = await job.getState();
  const progress = job.progress();
  const result = job.returnvalue;

  res.json({
    jobId,
    state,
    progress,
    result,
    failedReason: job.failedReason
  });
}));
```

**Breaking Changes:** API now returns `jobId` instead of immediate result

**Complexity:** High (requires Redis)
**Can parallel:** Yes

---

#### 4.2 Progress Tracking with WebSockets [MEDIUM]
**Complexity:** High | **Can run in parallel:** No (depends on 4.1)
**Files:** `src/services/websocketService.js`

**New Dependencies:**
```bash
npm install socket.io
```

**Implementation:**

```javascript
// src/services/websocketService.js
const socketIO = require('socket.io');
const { downloadQueue } = require('./queueService');
const logger = require('../utils/logger');
const config = require('../config');

class WebSocketService {
  constructor() {
    this.io = null;
    this.connections = new Map();
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.io = socketIO(server, {
      cors: {
        origin: config.allowedOrigins,
        methods: ['GET', 'POST']
      }
    });

    this.io.on('connection', (socket) => {
      logger.info('WebSocket client connected', { socketId: socket.id });

      // Track connection
      this.connections.set(socket.id, socket);

      // Subscribe to job updates
      socket.on('subscribe', (jobId) => {
        this.subscribeToJob(socket, jobId);
      });

      // Disconnect
      socket.on('disconnect', () => {
        logger.info('WebSocket client disconnected', { socketId: socket.id });
        this.connections.delete(socket.id);
      });
    });

    // Setup queue event listeners
    this.setupQueueListeners();

    logger.info('WebSocket service initialized');
  }

  /**
   * Subscribe socket to job updates
   */
  subscribeToJob(socket, jobId) {
    socket.join(`job:${jobId}`);
    logger.debug('Socket subscribed to job', { socketId: socket.id, jobId });
  }

  /**
   * Setup queue event listeners
   */
  setupQueueListeners() {
    // Job progress
    downloadQueue.on('progress', (job, progress) => {
      this.io.to(`job:${job.id}`).emit('progress', {
        jobId: job.id,
        progress
      });
    });

    // Job completed
    downloadQueue.on('completed', (job, result) => {
      this.io.to(`job:${job.id}`).emit('completed', {
        jobId: job.id,
        result
      });
    });

    // Job failed
    downloadQueue.on('failed', (job, error) => {
      this.io.to(`job:${job.id}`).emit('failed', {
        jobId: job.id,
        error: error.message
      });
    });

    // Job active
    downloadQueue.on('active', (job) => {
      this.io.to(`job:${job.id}`).emit('active', {
        jobId: job.id
      });
    });
  }

  /**
   * Emit event to specific job subscribers
   */
  emitToJob(jobId, event, data) {
    this.io.to(`job:${jobId}`).emit(event, data);
  }
}

module.exports = new WebSocketService();
```

**Update index.js:**

```javascript
// index.js (add WebSocket)
const websocketService = require('./src/services/websocketService');

async function start() {
  // ... existing code ...
  
  const server = app.listen(config.port, () => {
    logger.info(`Server started on port ${config.port}`);
  });

  // Initialize WebSocket
  websocketService.initialize(server);

  // ... rest of code ...
}
```

**Breaking Changes:** Frontend needs to connect via WebSocket

**Complexity:** High
**Can parallel:** No (depends on queue)

---

#### 4.3 Caching Layer [MEDIUM]
**Complexity:** Medium | **Can run in parallel:** Yes
**Files:** `src/services/cacheService.js`, `src/middleware/cache.js`

**New Dependencies:**
```bash
npm install ioredis
```

**Implementation:**

```javascript
// src/services/cacheService.js
const Redis = require('ioredis');
const logger = require('../utils/logger');
const config = require('../config');

class CacheService {
  constructor() {
    if (process.env.REDIS_HOST) {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false
      });

      this.redis.on('error', (error) => {
        logger.error('Redis error', { error: error.message });
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected');
      });
    } else {
      logger.warn('Redis not configured, caching disabled');
      this.redis = null;
    }
  }

  /**
   * Get cached value
   */
  async get(key) {
    if (!this.redis) return null;

    try {
      const value = await this.redis.get(key);
      if (value) {
        logger.debug('Cache hit', { key });
        return JSON.parse(value);
      }
      logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set cached value with expiry (in seconds)
   */
  async set(key, value, expirySeconds = 3600) {
    if (!this.redis) return false;

    try {
      await this.redis.setex(key, expirySeconds, JSON.stringify(value));
      logger.debug('Cache set', { key, expirySeconds });
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete cached value
   */
  async del(key) {
    if (!this.redis) return false;

    try {
      await this.redis.del(key);
      logger.debug('Cache deleted', { key });
      return true;
    } catch (error) {
      logger.error('Cache delete error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    if (!this.redis) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Generate cache key for video metadata
   */
  getMetadataKey(url) {
    return `metadata:${Buffer.from(url).toString('base64')}`;
  }

  /**
   * Cache video metadata (prevents redundant API calls)
   */
  async cacheMetadata(url, metadata) {
    const key = this.getMetadataKey(url);
    await this.set(key, metadata, 86400); // 24 hours
  }

  /**
   * Get cached metadata
   */
  async getMetadata(url) {
    const key = this.getMetadataKey(url);
    return await this.get(key);
  }
}

module.exports = new CacheService();
```

**Update ytdlpService to use cache:**

```javascript
// src/services/ytdlpService.js (add caching)
const cacheService = require('./cacheService');

async getVideoInfo(url) {
  // Check cache first
  const cached = await cacheService.getMetadata(url);
  if (cached) {
    logger.info('Using cached metadata', { url });
    return cached;
  }

  // Fetch from YouTube
  try {
    logger.info('Fetching video metadata', { url });
    const metadata = await this.ytDlp.getVideoInfo(url);
    
    // Cache for future requests
    await cacheService.cacheMetadata(url, metadata);
    
    logger.info('Metadata fetched', { 
      title: metadata.title,
      duration: metadata.duration 
    });
    return metadata;
  } catch (error) {
    logger.error('Failed to fetch metadata', { 
      url, 
      error: error.message 
    });
    throw new DownloadError('Failed to fetch video information', error);
  }
}
```

**Breaking Changes:** None (optional feature)

**Complexity:** Medium
**Can parallel:** Yes

---

#### 4.4 Streaming Downloads [HIGH]
**Complexity:** High | **Can run in parallel:** Yes
**Files:** `src/routes/files.js` (update)

**Implementation:**

```javascript
// src/routes/files.js (streaming version)
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { verifyDownloadToken } = require('../middleware/fileAccess');
const logger = require('../utils/logger');

/**
 * Streaming file download
 * Reduces memory usage for large files
 */
router.get('/:filename', verifyDownloadToken, (req, res) => {
  const { safePath } = req;
  const filename = path.basename(safePath);

  try {
    // Get file stats
    const stats = fs.statSync(safePath);
    const fileSize = stats.size;

    // Set headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileSize);

    // Support range requests (for resumable downloads)
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      res.status(206); // Partial Content
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Accept-Ranges', 'bytes');

      // Stream the requested range
      const stream = fs.createReadStream(safePath, { start, end });
      stream.pipe(res);

      logger.info('Streaming file (partial)', { 
        filename, 
        start, 
        end, 
        chunkSize 
      });
    } else {
      // Stream entire file
      const stream = fs.createReadStream(safePath);
      stream.pipe(res);

      logger.info('Streaming file (full)', { filename, fileSize });
    }

    // Handle stream errors
    res.on('error', (error) => {
      logger.error('Stream error', { filename, error: error.message });
    });

  } catch (error) {
    logger.error('File streaming failed', { 
      filename, 
      error: error.message 
    });
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream file' });
    }
  }
});

module.exports = router;
```

**Breaking Changes:** None (improves existing endpoint)

**Complexity:** Medium
**Can parallel:** Yes

---

#### 4.5 Concurrency Control [MEDIUM]
**Complexity:** Medium | **Can run in parallel:** Yes
**Files:** `src/middleware/concurrency.js`

**New Dependencies:**
```bash
npm install p-limit
```

**Implementation:**

```javascript
// src/middleware/concurrency.js
const pLimit = require('p-limit');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

// Limit concurrent downloads per IP
const limiterMap = new Map();

/**
 * Middleware: Limit concurrent operations per IP
 */
function concurrencyLimit(maxConcurrent = config.maxConcurrentDownloads) {
  return async (req, res, next) => {
    const ip = req.ip;

    // Get or create limiter for this IP
    if (!limiterMap.has(ip)) {
      limiterMap.set(ip, {
        limit: pLimit(maxConcurrent),
        count: 0
      });
    }

    const limiter = limiterMap.get(ip);

    // Check if at limit
    if (limiter.count >= maxConcurrent) {
      logger.warn('Concurrent download limit reached', { 
        ip, 
        maxConcurrent 
      });
      return next(new AppError(
        `Maximum ${maxConcurrent} concurrent downloads per user`,
        429
      ));
    }

    // Increment counter
    limiter.count++;

    // Wrap response to decrement on completion
    const originalEnd = res.end;
    res.end = function(...args) {
      limiter.count--;
      
      // Clean up if no active requests
      if (limiter.count === 0) {
        setTimeout(() => {
          if (limiter.count === 0) {
            limiterMap.delete(ip);
          }
        }, 60000); // Clean up after 1 minute
      }

      originalEnd.apply(this, args);
    };

    next();
  };
}

module.exports = concurrencyLimit;
```

**Usage:**

```javascript
// src/routes/download.js
const concurrencyLimit = require('../middleware/concurrency');

router.post(
  '/',
  downloadLimiter,
  concurrencyLimit(3), // Max 3 concurrent downloads per IP
  validateDownloadRequest,
  asyncHandler(async (req, res) => {
    // ... download logic ...
  })
);
```

**Breaking Changes:** None

**Complexity:** Medium
**Can parallel:** Yes

---

### Phase 4 Summary

**New Dependencies:**
- bull (job queue)
- ioredis (Redis client)
- socket.io (WebSockets)
- p-limit (concurrency)

**Infrastructure Required:**
- Redis server (for queue and cache)

**Breaking Changes:**
- Download API returns `jobId` instead of immediate result
- Frontend must poll `/api/download/status/:jobId` or use WebSockets
- Requires Redis for queue functionality

**Optional Features:**
- Caching (improves performance but not required)
- WebSockets (better UX but polling works)

---

## Phase 5: PRODUCTION READINESS (Week 5)
**Priority:** HIGH - Required for production
**Estimated Time:** 5-7 days
**Complexity:** Medium-High

### Tasks

#### 5.1 Comprehensive Testing [HIGH]
**Complexity:** High | **Can run in parallel:** Yes
**Files:** `tests/` directory structure

**Implementation:**

```javascript
// tests/setup.js
const { MongoMemoryServer } = require('mongodb-memory-server');

// Setup test environment
process.env.NODE_ENV = 'test';
process.env.DOWNLOADS_DIR = './test-downloads';
process.env.LOG_LEVEL = 'error';

// Global teardown
afterAll(async () => {
  // Cleanup test files
});
```

```javascript
// tests/unit/validators.test.js
const {
  validateYouTubeUrl,
  validateFormat,
  validateCustomName,
  ValidationError
} = require('../../src/utils/validators');

describe('Validators', () => {
  describe('validateYouTubeUrl', () => {
    it('should accept valid YouTube URLs', () => {
      const validUrls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://music.youtube.com/watch?v=dQw4w9WgXcQ'
      ];

      validUrls.forEach(url => {
        expect(() => validateYouTubeUrl(url)).not.toThrow();
      });
    });

    it('should reject non-YouTube URLs', () => {
      const invalidUrls = [
        'https://evil.com',
        'https://localhost:8080',
        'http://192.168.1.1',
        'file:///etc/passwd'
      ];

      invalidUrls.forEach(url => {
        expect(() => validateYouTubeUrl(url)).toThrow(ValidationError);
      });
    });

    it('should reject private IP addresses', () => {
      const privateIPs = [
        'http://127.0.0.1',
        'http://192.168.1.1',
        'http://10.0.0.1'
      ];

      privateIPs.forEach(url => {
        expect(() => validateYouTubeUrl(url)).toThrow(ValidationError);
      });
    });
  });

  describe('validateFormat', () => {
    it('should accept whitelisted formats', () => {
      expect(validateFormat('mp3')).toBe('mp3');
      expect(validateFormat('wav')).toBe('wav');
      expect(validateFormat('MP3')).toBe('mp3'); // Case insensitive
    });

    it('should reject non-whitelisted formats', () => {
      expect(() => validateFormat('exe')).toThrow(ValidationError);
      expect(() => validateFormat('sh')).toThrow(ValidationError);
      expect(() => validateFormat('mp3; rm -rf /')).toThrow(ValidationError);
    });

    it('should return default for empty format', () => {
      expect(validateFormat()).toBe('mp3');
      expect(validateFormat(null)).toBe('mp3');
    });
  });

  describe('validateCustomName', () => {
    it('should accept safe filenames', () => {
      expect(validateCustomName('my-song')).toBe('my-song');
      expect(validateCustomName('Song 123')).toBe('Song 123');
    });

    it('should reject path traversal attempts', () => {
      expect(() => validateCustomName('../../../etc/passwd')).toThrow(ValidationError);
      expect(() => validateCustomName('../../file')).toThrow(ValidationError);
      expect(() => validateCustomName('path/to/file')).toThrow(ValidationError);
    });

    it('should reject shell special characters', () => {
      expect(() => validateCustomName('file; rm -rf /')).toThrow(ValidationError);
      expect(() => validateCustomName('file && cat /etc/passwd')).toThrow(ValidationError);
      expect(() => validateCustomName('file`whoami`')).toThrow(ValidationError);
    });

    it('should reject names starting with dot', () => {
      expect(() => validateCustomName('.hidden')).toThrow(ValidationError);
    });
  });
});
```

```javascript
// tests/integration/download.test.js
const request = require('supertest');
const app = require('../../index');
const fileService = require('../../src/services/fileService');

describe('Download API', () => {
  beforeAll(async () => {
    await fileService.initialize();
  });

  afterAll(async () => {
    await fileService.clearDirectory();
  });

  describe('POST /api/download', () => {
    it('should reject requests without URL', async () => {
      const res = await request(app)
        .post('/api/download')
        .send({ format: 'mp3' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject non-YouTube URLs', async () => {
      const res = await request(app)
        .post('/api/download')
        .send({ url: 'https://evil.com', format: 'mp3' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('YouTube');
    });

    it('should reject invalid formats', async () => {
      const res = await request(app)
        .post('/api/download')
        .send({ 
          url: 'https://www.youtube.com/watch?v=test',
          format: 'exe'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('format');
    });

    // Integration test (requires actual YouTube URL)
    it.skip('should download valid YouTube video', async () => {
      const res = await request(app)
        .post('/api/download')
        .send({ 
          url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', // "Me at the zoo"
          format: 'mp3'
        });

      expect(res.status).toBe(200);
      expect(res.body.jobId).toBeDefined();
    }, 30000); // 30 second timeout
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const promises = [];
      for (let i = 0; i < 12; i++) {
        promises.push(
          request(app)
            .post('/api/download')
            .send({ 
              url: 'https://www.youtube.com/watch?v=test',
              format: 'mp3'
            })
        );
      }

      const results = await Promise.all(promises);
      const rateLimited = results.filter(r => r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
```

**Test commands:**

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/unit/validators.test.js

# Watch mode
npm run test:watch
```

**Breaking Changes:** None

**Complexity:** High
**Can parallel:** Yes

---

#### 5.2 API Documentation [HIGH]
**Complexity:** Medium | **Can run in parallel:** Yes
**Files:** `docs/API.md`, OpenAPI spec

**New Dependencies:**
```bash
npm install swagger-jsdoc swagger-ui-express
```

**Implementation:**

```javascript
// src/config/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');
const config = require('./index');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'YouTube MP3 Converter API',
      version: '2.0.0',
      description: 'Secure API for converting YouTube videos to audio files',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server'
      },
      {
        url: 'https://api.yourdomain.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        DownloadToken: {
          type: 'apiKey',
          in: 'query',
          name: 'token',
          description: 'Download token received from download endpoint'
        }
      }
    }
  },
  apis: ['./src/routes/*.js'] // Files containing annotations
};

module.exports = swaggerJsdoc(options);
```

**Add Swagger annotations to routes:**

```javascript
// src/routes/download.js (add JSDoc comments)

/**
 * @swagger
 * /api/download:
 *   post:
 *     summary: Download single YouTube video as audio
 *     tags: [Downloads]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: YouTube video URL
 *                 example: https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *               format:
 *                 type: string
 *                 enum: [mp3, wav, flac, m4a, aac, opus]
 *                 default: mp3
 *                 description: Output audio format
 *               customName:
 *                 type: string
 *                 maxLength: 200
 *                 description: Custom filename (optional)
 *     responses:
 *       200:
 *         description: Download job created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   description: Job ID for tracking download progress
 *                 status:
 *                   type: string
 *                   enum: [queued]
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 field:
 *                   type: string
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/', /* ... */);
```

**Mount Swagger UI:**

```javascript
// index.js (add Swagger)
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/config/swagger');

// Serve API docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

logger.info('API documentation available at /api-docs');
```

**Breaking Changes:** None

**Complexity:** Medium
**Can parallel:** Yes

---

#### 5.3 Monitoring & Metrics [HIGH]
**Complexity:** Medium | **Can run in parallel:** Yes
**Files:** `src/middleware/metrics.js`, `src/routes/metrics.js`

**New Dependencies:**
```bash
npm install prom-client
```

**Implementation:**

```javascript
// src/services/metricsService.js
const promClient = require('prom-client');
const logger = require('../utils/logger');

class MetricsService {
  constructor() {
    // Create registry
    this.register = new promClient.Registry();

    // Add default metrics (CPU, memory, etc.)
    promClient.collectDefaultMetrics({ register: this.register });

    // Custom metrics
    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register]
    });

    this.httpRequestTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register]
    });

    this.downloadJobsTotal = new promClient.Counter({
      name: 'download_jobs_total',
      help: 'Total number of download jobs',
      labelNames: ['type', 'status'],
      registers: [this.register]
    });

    this.downloadJobDuration = new promClient.Histogram({
      name: 'download_job_duration_seconds',
      help: 'Download job duration in seconds',
      labelNames: ['type'],
      registers: [this.register]
    });

    this.activeDownloads = new promClient.Gauge({
      name: 'active_downloads',
      help: 'Number of currently active downloads',
      registers: [this.register]
    });

    this.fileSize = new promClient.Histogram({
      name: 'download_file_size_bytes',
      help: 'Downloaded file size in bytes',
      labelNames: ['type', 'format'],
      registers: [this.register]
    });

    logger.info('Metrics service initialized');
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics() {
    return this.register.metrics();
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(method, route, statusCode, duration) {
    this.httpRequestTotal.inc({ method, route, status_code: statusCode });
    this.httpRequestDuration.observe(
      { method, route, status_code: statusCode },
      duration / 1000 // Convert to seconds
    );
  }

  /**
   * Record download job
   */
  recordDownloadJob(type, status, duration) {
    this.downloadJobsTotal.inc({ type, status });
    if (duration) {
      this.downloadJobDuration.observe({ type }, duration / 1000);
    }
  }

  /**
   * Increment active downloads
   */
  incrementActiveDownloads() {
    this.activeDownloads.inc();
  }

  /**
   * Decrement active downloads
   */
  decrementActiveDownloads() {
    this.activeDownloads.dec();
  }

  /**
   * Record file size
   */
  recordFileSize(type, format, size) {
    this.fileSize.observe({ type, format }, size);
  }
}

module.exports = new MetricsService();
```

```javascript
// src/middleware/metrics.js
const metricsService = require('../services/metricsService');
const onFinished = require('on-finished');

/**
 * Middleware: Record HTTP metrics
 */
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  onFinished(res, () => {
    const duration = Date.now() - start;
    const route = req.route ? req.route.path : req.path;
    
    metricsService.recordHttpRequest(
      req.method,
      route,
      res.statusCode,
      duration
    );
  });

  next();
}

module.exports = metricsMiddleware;
```

```javascript
// src/routes/metrics.js
const express = require('express');
const router = express.Router();
const metricsService = require('../services/metricsService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /metrics
 * Prometheus metrics endpoint
 */
router.get('/', asyncHandler(async (req, res) => {
  res.set('Content-Type', metricsService.register.contentType);
  const metrics = await metricsService.getMetrics();
  res.send(metrics);
}));

module.exports = router;
```

**Update index.js:**

```javascript
// index.js (add metrics)
const metricsMiddleware = require('./src/middleware/metrics');
const metricsRoutes = require('./src/routes/metrics');

// Add metrics middleware (after security, before routes)
app.use(metricsMiddleware);

// Add metrics endpoint
app.use('/metrics', metricsRoutes);
```

**Update workers to record metrics:**

```javascript
// src/workers/downloadWorker.js (add metrics)
const metricsService = require('../services/metricsService');

downloadQueue.process(3, async (job) => {
  const startTime = Date.now();
  metricsService.incrementActiveDownloads();

  try {
    // ... download logic ...
    
    const duration = Date.now() - startTime;
    metricsService.recordDownloadJob(type, 'success', duration);
    metricsService.decrementActiveDownloads();
    
    return result;
  } catch (error) {
    metricsService.recordDownloadJob(type, 'failed');
    metricsService.decrementActiveDownloads();
    throw error;
  }
});
```

**Breaking Changes:** None

**Complexity:** Medium
**Can parallel:** Yes

---

#### 5.4 Health Checks & Readiness [HIGH]
**Complexity:** Simple | **Can run in parallel:** Yes
**Files:** `src/routes/health.js` (enhanced)

**Implementation:**

```javascript
// src/routes/health.js (enhanced)
const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const config = require('../config');
const { downloadQueue } = require('../services/queueService');
const cacheService = require('../services/cacheService');

/**
 * GET /health
 * Basic health check (for load balancer)
 */
router.get('/', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/live
 * Liveness probe (is the service alive?)
 */
router.get('/live', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  });
});

/**
 * GET /health/ready
 * Readiness probe (is the service ready to handle requests?)
 */
router.get('/ready', async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'OK',
    checks: {}
  };

  // Check downloads directory
  try {
    await fs.access(config.downloadsDir, fs.constants.W_OK);
    checks.checks.downloadsDir = { status: 'OK' };
  } catch (error) {
    checks.status = 'DEGRADED';
    checks.checks.downloadsDir = {
      status: 'ERROR',
      error: error.message
    };
  }

  // Check Redis (if configured)
  if (process.env.REDIS_HOST) {
    try {
      await cacheService.redis.ping();
      checks.checks.redis = { status: 'OK' };
    } catch (error) {
      checks.status = 'DEGRADED';
      checks.checks.redis = {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  // Check queue
  try {
    const queueHealth = await downloadQueue.checkHealth();
    checks.checks.queue = { 
      status: 'OK',
      waiting: await downloadQueue.getWaitingCount(),
      active: await downloadQueue.getActiveCount(),
      failed: await downloadQueue.getFailedCount()
    };
  } catch (error) {
    checks.status = 'DEGRADED';
    checks.checks.queue = {
      status: 'ERROR',
      error: error.message
    };
  }

  const statusCode = checks.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(checks);
});

/**
 * GET /health/stats
 * Detailed statistics (for monitoring dashboard)
 */
router.get('/stats', async (req, res) => {
  const stats = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    queue: {
      waiting: await downloadQueue.getWaitingCount(),
      active: await downloadQueue.getActiveCount(),
      completed: await downloadQueue.getCompletedCount(),
      failed: await downloadQueue.getFailedCount()
    }
  };

  res.json(stats);
});

module.exports = router;
```

**Breaking Changes:** None (adds new endpoints)

**Complexity:** Simple
**Can parallel:** Yes

---

#### 5.5 Production Deployment Configuration [HIGH]
**Complexity:** Medium | **Can run in parallel:** Yes
**Files:** `Dockerfile`, `docker-compose.yml`, `ecosystem.config.js` (PM2)

**Implementation:**

```dockerfile
# Dockerfile
FROM node:18-alpine

# Install yt-dlp and ffmpeg
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg

RUN pip3 install --no-cache-dir yt-dlp

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Create downloads directory
RUN mkdir -p downloads && chown -R node:node downloads

# Switch to non-root user
USER node

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/health/live', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Backend API
  api:
    build: .
    ports:
      - "5001:5001"
    environment:
      - NODE_ENV=production
      - PORT=5001
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - ALLOWED_ORIGINS=https://yourdomain.com
      - DOWNLOADS_DIR=/app/downloads
      - LOG_LEVEL=info
    volumes:
      - downloads:/app/downloads
      - logs:/app/logs
    depends_on:
      - redis
    restart: unless-stopped
    networks:
      - app-network

  # Redis for queue and cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - app-network
    command: redis-server --appendonly yes

  # Download worker (scale separately)
  worker:
    build: .
    command: node src/workers/downloadWorker.js
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - DOWNLOADS_DIR=/app/downloads
      - LOG_LEVEL=info
    volumes:
      - downloads:/app/downloads
      - logs:/app/logs
    depends_on:
      - redis
    restart: unless-stopped
    networks:
      - app-network
    # Scale workers: docker-compose up --scale worker=3

volumes:
  downloads:
  redis-data:
  logs:

networks:
  app-network:
    driver: bridge
```

```javascript
// ecosystem.config.js (PM2 configuration)
module.exports = {
  apps: [
    {
      name: 'youtube-mp3-api',
      script: './index.js',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M',
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000
    },
    {
      name: 'youtube-mp3-worker',
      script: './src/workers/downloadWorker.js',
      instances: 3, // 3 workers
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
```

```bash
# .dockerignore
node_modules
npm-debug.log
downloads
logs
.git
.env
*.md
tests
.vscode
```

**Deployment commands:**

```bash
# Docker
docker build -t youtube-mp3-backend .
docker-compose up -d
docker-compose logs -f

# PM2
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

**Breaking Changes:** None

**Complexity:** Medium
**Can parallel:** Yes

---

#### 5.6 Production .env Template [HIGH]
**Complexity:** Simple | **Can run in parallel:** Yes
**Files:** `.env.production.example`

**Implementation:**

```bash
# .env.production.example
# Copy to .env and configure for production

# ===== SERVER =====
NODE_ENV=production
PORT=5001

# ===== SECURITY =====
# IMPORTANT: Set to your actual frontend domain(s)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# ===== REDIS =====
# Required for queue and caching
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ===== FILE MANAGEMENT =====
DOWNLOADS_DIR=./downloads
MAX_FILE_SIZE=524288000
TEMP_DOWNLOAD_EXPIRY=3600000

# ===== RATE LIMITING =====
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# ===== DOWNLOAD LIMITS =====
MAX_URLS_PER_REQUEST=50
MAX_CONCURRENT_DOWNLOADS=3

# ===== LOGGING =====
LOG_LEVEL=info

# ===== FEATURE FLAGS =====
# WARNING: Set to false in production to preserve downloads
CLEAR_DOWNLOADS_ON_STARTUP=false

# ===== MONITORING (Optional) =====
# Sentry DSN for error tracking
SENTRY_DSN=

# ===== OPTIONAL SERVICES =====
# AWS S3 for file storage (future feature)
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=us-east-1
# AWS_S3_BUCKET=youtube-mp3-downloads
```

**Breaking Changes:** None

**Complexity:** Simple
**Can parallel:** Yes

---

### Phase 5 Testing Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] API documentation accurate and complete
- [ ] Metrics endpoint returns valid Prometheus format
- [ ] Health checks return correct status
- [ ] Docker image builds successfully
- [ ] docker-compose stack starts without errors
- [ ] PM2 cluster mode works correctly
- [ ] Load testing (Apache Bench, Artillery)
- [ ] Security audit (npm audit, Snyk)
- [ ] Penetration testing (OWASP ZAP, Burp Suite)

---

## Implementation Timeline

### Week 1: Critical Security (Phase 1)
**Day 1-2:** Input validation & sanitization, CORS configuration
**Day 3-4:** Access control, environment configuration
**Day 5:** Rate limiting, security headers, integration

### Week 2: Stability (Phase 2)
**Day 1-2:** Error handling, logging
**Day 3-4:** Fix race conditions, graceful shutdown
**Day 5:** Testing and integration

### Week 3: Refactoring (Phase 3)
**Day 1-2:** Service layer extraction
**Day 3-4:** Route handlers, main entry point
**Day 5:** Testing and documentation

### Week 4: Performance (Phase 4)
**Day 1-2:** Job queue implementation
**Day 3-4:** WebSockets, caching
**Day 5:** Streaming, concurrency control

### Week 5: Production (Phase 5)
**Day 1-2:** Comprehensive testing
**Day 3:** API documentation, monitoring
**Day 4:** Deployment configuration
**Day 5:** Final testing, deployment

**Total Estimated Time:** 5 weeks (25 working days)

---

## Parallel Execution Strategy

**Can start immediately (no dependencies):**
- Phase 1.1: Input validation
- Phase 1.2: CORS
- Phase 1.4: Environment config
- Phase 1.5: Rate limiting
- Phase 1.6: Security headers
- Phase 2.2: Logging

**Start after Phase 1 complete:**
- Phase 2.1: Error handling
- Phase 2.3: File operations
- Phase 2.4: Graceful shutdown

**Start after Phase 2 complete:**
- Phase 3: All tasks (sequential within phase)

**Start after Phase 3 complete:**
- Phase 4.1: Queue (requires Redis setup)
- Phase 4.3: Caching
- Phase 4.4: Streaming

**Start after Phase 4 complete:**
- Phase 5: All tasks (can run in parallel)

---

## Risk Mitigation

### High Risk Items

1. **Queue Implementation (Phase 4.1)**
   - **Risk:** Complex, requires Redis, breaking API changes
   - **Mitigation:** Start with simpler in-memory queue, migrate to Redis later
   - **Fallback:** Keep synchronous downloads as option

2. **Production Deployment (Phase 5.5)**
   - **Risk:** Environment-specific issues
   - **Mitigation:** Test in staging environment first
   - **Fallback:** Have rollback plan ready

3. **Breaking Changes (Phase 3)**
   - **Risk:** Frontend incompatibility
   - **Mitigation:** Version API, support both old/new temporarily
   - **Fallback:** Feature flags to enable/disable new features

### Medium Risk Items

1. **File Race Conditions (Phase 2.3)**
   - **Risk:** Edge cases hard to reproduce
   - **Mitigation:** Extensive testing, file locking
   - **Fallback:** Single-threaded file operations

2. **WebSockets (Phase 4.2)**
   - **Risk:** Complex debugging, connection management
   - **Mitigation:** Keep polling fallback
   - **Fallback:** Disable WebSockets if issues arise

---

## Success Criteria

### Phase 1 (Security)
- [ ] All OWASP Top 10 vulnerabilities addressed
- [ ] Security audit passes
- [ ] Rate limiting prevents DoS
- [ ] No secrets in code/logs
- [ ] CORS properly configured

### Phase 2 (Stability)
- [ ] Zero unhandled errors crash server
- [ ] No race conditions in file operations
- [ ] Graceful shutdown works correctly
- [ ] All errors logged with context
- [ ] 24-hour stress test passes

### Phase 3 (Architecture)
- [ ] Code coverage > 80%
- [ ] All business logic in service layer
- [ ] Routes are thin controllers
- [ ] No code duplication
- [ ] Configuration externalized

### Phase 4 (Performance)
- [ ] API response time < 100ms
- [ ] Supports 100+ concurrent users
- [ ] Memory usage stable under load
- [ ] Download throughput optimized
- [ ] Redis integration working

### Phase 5 (Production)
- [ ] 99.9% uptime in staging
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Monitoring operational
- [ ] Deployment automated

---

## Post-Implementation

### Monitoring Setup
1. **Prometheus + Grafana** for metrics visualization
2. **Sentry** for error tracking
3. **LogDNA/Datadog** for log aggregation
4. **Uptime Robot** for availability monitoring

### Ongoing Maintenance
1. **Weekly:** Review logs for errors
2. **Monthly:** Security updates (npm audit fix)
3. **Quarterly:** Performance optimization review
4. **Annually:** Architecture review

### Future Enhancements
1. **Authentication/Authorization** (OAuth, JWT)
2. **User accounts** (save download history)
3. **S3 storage** (offload file storage)
4. **CDN integration** (faster downloads)
5. **Video format support** (not just audio)
6. **Subtitle extraction**
7. **Batch processing improvements**
8. **Admin dashboard**

---

## Dependencies Installation Summary

```bash
# Phase 1
npm install joi validator express-validator dotenv helmet express-rate-limit

# Phase 2
npm install winston winston-daily-rotate-file fs-extra proper-lockfile

# Phase 3
# (No new dependencies, refactoring only)

# Phase 4
npm install bull ioredis socket.io p-limit

# Phase 5
npm install prom-client swagger-jsdoc swagger-ui-express

# Dev Dependencies
npm install --save-dev \
  eslint eslint-config-airbnb-base eslint-plugin-import \
  jest supertest \
  nodemon \
  prettier
```

**Total New Dependencies:** 20 production + 7 development

---

## Final Notes

This implementation plan transforms the current 178-line prototype into a production-ready, enterprise-grade backend with:

- **Security:** OWASP-compliant, penetration-tested
- **Reliability:** 99.9%+ uptime, graceful error handling
- **Performance:** Sub-100ms response times, optimized throughput
- **Scalability:** Horizontal scaling via Docker, queue-based architecture
- **Maintainability:** Clean architecture, comprehensive tests, full documentation
- **Observability:** Metrics, logging, health checks, monitoring

**Estimated Total Time:** 5 weeks
**Estimated LOC:** ~5,000 lines (from 178)
**Breaking Changes:** Managed through versioning and feature flags
**Production Ready:** End of Week 5

The phased approach ensures critical security fixes are implemented first, followed by stability improvements, then architectural refactoring, performance optimization, and finally production readiness features.
