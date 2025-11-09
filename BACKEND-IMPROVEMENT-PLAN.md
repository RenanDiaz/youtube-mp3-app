# YouTube MP3 Converter - Backend Improvement Plan

## Executive Summary

This plan addresses **critical security vulnerabilities** and transforms the current proof-of-concept backend into a **production-ready, secure, scalable system**. The current implementation has several CRITICAL issues that must be resolved before any production deployment.

**Current State:** 178-line monolithic Express app with critical security flaws
**Target State:** Enterprise-grade backend with proper security, error handling, testing, and scalability

**Timeline:** 5 weeks across 5 phases
**Estimated Effort:** 4-6 weeks full-time development

---

## Risk Assessment

| Category | Current Risk | Target Risk | Priority |
|----------|-------------|-------------|----------|
| Security | CRITICAL | LOW | URGENT |
| Stability | HIGH | LOW | HIGH |
| Scalability | HIGH | LOW | MEDIUM |
| Performance | MEDIUM | LOW | MEDIUM |
| Maintainability | MEDIUM | LOW | LOW |

---

## PHASE 1: CRITICAL SECURITY FIXES (Week 1) ✅ COMPLETED

**Goal:** Prevent server compromise, RCE, and data breaches
**Status:** ✅ **COMPLETED** - See PR #2

**Completion Date:** November 9, 2025
**Pull Request:** [#2 Phase 1 - Critical Backend Security Fixes](https://github.com/RenanDiaz/youtube-mp3-app/pull/2)

All critical security vulnerabilities have been fixed. Backend is now production-ready from a security standpoint.

### 1.1 Input Validation & Sanitization (HIGH PRIORITY)

**Complexity:** MEDIUM | **Effort:** 1 day

**Issues:**
- Command injection via `format` parameter (RCE vulnerability)
- SSRF vulnerability via unvalidated URLs
- Path traversal via `customName`

**Files:**
- New: `backend/src/middleware/validation.js`
- New: `backend/src/utils/validators.js`
- Update: `backend/index.js`

**Dependencies:**
```bash
npm install express-validator
npm install validator
```

**Implementation:**

```javascript
// backend/src/utils/validators.js
const validator = require('validator');

// Whitelist approach - only allow known-safe formats
const ALLOWED_FORMATS = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'opus'];

// YouTube domain whitelist
const YOUTUBE_DOMAINS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be'
];

function validateAudioFormat(format) {
  if (!format || typeof format !== 'string') {
    return { valid: false, error: 'Format is required' };
  }

  const normalized = format.toLowerCase().trim();

  if (!ALLOWED_FORMATS.includes(normalized)) {
    return {
      valid: false,
      error: `Format must be one of: ${ALLOWED_FORMATS.join(', ')}`
    };
  }

  return { valid: true, format: normalized };
}

function validateYouTubeUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  // Basic URL validation
  if (!validator.isURL(url, { protocols: ['http', 'https'], require_protocol: false })) {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Parse URL safely
  let parsedUrl;
  try {
    // Add protocol if missing
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    parsedUrl = new URL(urlWithProtocol);
  } catch (err) {
    return { valid: false, error: 'Invalid URL' };
  }

  // Check domain whitelist (SSRF protection)
  const hostname = parsedUrl.hostname.toLowerCase();
  const isYouTube = YOUTUBE_DOMAINS.some(domain =>
    hostname === domain || hostname.endsWith(`.${domain}`)
  );

  if (!isYouTube) {
    return { valid: false, error: 'URL must be from YouTube' };
  }

  return { valid: true, url: parsedUrl.href };
}

function validateCustomFilename(filename) {
  if (!filename) {
    return { valid: true, filename: null };
  }

  if (typeof filename !== 'string') {
    return { valid: false, error: 'Filename must be a string' };
  }

  // Length check
  if (filename.length > 200) {
    return { valid: false, error: 'Filename too long (max 200 characters)' };
  }

  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: 'Invalid filename characters' };
  }

  // Additional safety check
  const sanitized = filename.replace(/[^a-zA-Z0-9-_\s]/g, '_');

  return { valid: true, filename: sanitized };
}

function validateUrlArray(urls) {
  if (!Array.isArray(urls)) {
    return { valid: false, error: 'URLs must be an array' };
  }

  if (urls.length === 0) {
    return { valid: false, error: 'At least one URL is required' };
  }

  if (urls.length > 50) {
    return { valid: false, error: 'Maximum 50 URLs allowed' };
  }

  // Validate each URL
  const validatedUrls = [];
  for (let i = 0; i < urls.length; i++) {
    const result = validateYouTubeUrl(urls[i]);
    if (!result.valid) {
      return { valid: false, error: `URL ${i + 1}: ${result.error}` };
    }
    validatedUrls.push(result.url);
  }

  return { valid: true, urls: validatedUrls };
}

module.exports = {
  validateAudioFormat,
  validateYouTubeUrl,
  validateCustomFilename,
  validateUrlArray,
  ALLOWED_FORMATS,
  YOUTUBE_DOMAINS
};
```

```javascript
// backend/src/middleware/validation.js
const {
  validateAudioFormat,
  validateYouTubeUrl,
  validateCustomFilename,
  validateUrlArray
} = require('../utils/validators');

function validateDownloadRequest(req, res, next) {
  const { url, format, customName } = req.body;

  // Validate URL
  const urlResult = validateYouTubeUrl(url);
  if (!urlResult.valid) {
    return res.status(400).json({
      error: 'Invalid URL',
      message: urlResult.error
    });
  }
  req.body.validatedUrl = urlResult.url;

  // Validate format (use default if not provided)
  const formatResult = validateAudioFormat(format || 'mp3');
  if (!formatResult.valid) {
    return res.status(400).json({
      error: 'Invalid format',
      message: formatResult.error
    });
  }
  req.body.validatedFormat = formatResult.format;

  // Validate custom name if provided
  if (customName) {
    const nameResult = validateCustomFilename(customName);
    if (!nameResult.valid) {
      return res.status(400).json({
        error: 'Invalid filename',
        message: nameResult.error
      });
    }
    req.body.validatedCustomName = nameResult.filename;
  }

  next();
}

function validatePlaylistRequest(req, res, next) {
  const { url, format } = req.body;

  // Validate URL
  const urlResult = validateYouTubeUrl(url);
  if (!urlResult.valid) {
    return res.status(400).json({
      error: 'Invalid URL',
      message: urlResult.error
    });
  }

  // Check if it looks like a playlist URL
  if (!url.includes('list=') && !url.includes('playlist')) {
    return res.status(400).json({
      error: 'Invalid playlist URL',
      message: 'URL must be a YouTube playlist'
    });
  }

  req.body.validatedUrl = urlResult.url;

  // Validate format
  const formatResult = validateAudioFormat(format || 'mp3');
  if (!formatResult.valid) {
    return res.status(400).json({
      error: 'Invalid format',
      message: formatResult.error
    });
  }
  req.body.validatedFormat = formatResult.format;

  next();
}

function validateMultiDownloadRequest(req, res, next) {
  const { urls, format } = req.body;

  // Validate URLs array
  const urlsResult = validateUrlArray(urls);
  if (!urlsResult.valid) {
    return res.status(400).json({
      error: 'Invalid URLs',
      message: urlsResult.error
    });
  }
  req.body.validatedUrls = urlsResult.urls;

  // Validate format
  const formatResult = validateAudioFormat(format || 'mp3');
  if (!formatResult.valid) {
    return res.status(400).json({
      error: 'Invalid format',
      message: formatResult.error
    });
  }
  req.body.validatedFormat = formatResult.format;

  next();
}

module.exports = {
  validateDownloadRequest,
  validatePlaylistRequest,
  validateMultiDownloadRequest
};
```

**Usage in routes:**
```javascript
// backend/index.js (updated)
const {
  validateDownloadRequest,
  validatePlaylistRequest,
  validateMultiDownloadRequest
} = require('./src/middleware/validation');

app.post("/download", validateDownloadRequest, async (req, res) => {
  const { validatedUrl, validatedFormat, validatedCustomName } = req.body;

  try {
    const ytDlp = new YtDlpWrap("yt-dlp");
    const metadata = await ytDlp.getVideoInfo(validatedUrl);
    const videoTitle = metadata.title || "downloaded";

    const outputName = validatedCustomName || sanitize(videoTitle);
    const outputFile = path.resolve(__dirname, "downloads", `${outputName}.${validatedFormat}`);

    // Use validated format - no injection possible
    await ytDlp.execPromise([
      validatedUrl,
      "-x",
      "--audio-format",
      validatedFormat,  // Safe - whitelisted
      "-o",
      outputFile
    ]);

    res.json({
      message: "Download complete",
      file: `${outputName}.${validatedFormat}`
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to download: ${err.message}` });
  }
});
```

**Can Run in Parallel:** No - foundation for other tasks

---

### 1.2 Secure CORS Configuration (HIGH PRIORITY)

**Complexity:** SIMPLE | **Effort:** 1 hour

**Issue:** `app.use(cors())` allows ANY origin to access the API

**Files:**
- New: `backend/src/config/cors.js`
- Update: `backend/index.js`

**Dependencies:** (already installed)

**Implementation:**

```javascript
// backend/src/config/cors.js
const cors = require('cors');

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

// Add production origins from environment
if (process.env.ALLOWED_ORIGINS) {
  const envOrigins = process.env.ALLOWED_ORIGINS.split(',');
  allowedOrigins.push(...envOrigins);
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

module.exports = cors(corsOptions);
```

```javascript
// backend/index.js (updated)
const corsMiddleware = require('./src/config/cors');
app.use(corsMiddleware);
```

**Can Run in Parallel:** Yes, with 1.1

---

### 1.3 Access Control for Downloads (CRITICAL)

**Complexity:** MEDIUM | **Effort:** 4 hours

**Issue:** Anyone can access `/downloads/anyfile.mp3` without authentication

**Files:**
- New: `backend/src/middleware/downloadAuth.js`
- New: `backend/src/utils/tokenGenerator.js`
- Update: `backend/index.js`

**Dependencies:**
```bash
npm install uuid
npm install crypto
```

**Implementation:**

```javascript
// backend/src/utils/tokenGenerator.js
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// In-memory token store (use Redis in production)
const downloadTokens = new Map();

// Token expiry time (5 minutes)
const TOKEN_EXPIRY_MS = 5 * 60 * 1000;

function generateDownloadToken(filename) {
  const token = uuidv4();
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  downloadTokens.set(hash, {
    filename,
    expiresAt: Date.now() + TOKEN_EXPIRY_MS,
    used: false
  });

  return token;
}

function validateDownloadToken(token, filename) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const tokenData = downloadTokens.get(hash);

  if (!tokenData) {
    return { valid: false, error: 'Invalid token' };
  }

  if (tokenData.used) {
    return { valid: false, error: 'Token already used' };
  }

  if (Date.now() > tokenData.expiresAt) {
    downloadTokens.delete(hash);
    return { valid: false, error: 'Token expired' };
  }

  if (tokenData.filename !== filename) {
    return { valid: false, error: 'Token does not match file' };
  }

  // Mark as used (one-time use)
  tokenData.used = true;

  // Schedule cleanup
  setTimeout(() => downloadTokens.delete(hash), 60000);

  return { valid: true };
}

// Cleanup expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [hash, data] of downloadTokens.entries()) {
    if (now > data.expiresAt) {
      downloadTokens.delete(hash);
    }
  }
}, 5 * 60 * 1000);

module.exports = {
  generateDownloadToken,
  validateDownloadToken
};
```

```javascript
// backend/src/middleware/downloadAuth.js
const { validateDownloadToken } = require('../utils/tokenGenerator');
const path = require('path');

function authenticateDownload(req, res, next) {
  const token = req.query.token;
  const filename = path.basename(req.path);

  if (!token) {
    return res.status(401).json({ error: 'Download token required' });
  }

  const result = validateDownloadToken(token, filename);

  if (!result.valid) {
    return res.status(403).json({ error: result.error });
  }

  next();
}

module.exports = authenticateDownload;
```

```javascript
// backend/index.js (updated)
const { generateDownloadToken } = require('./src/utils/tokenGenerator');
const authenticateDownload = require('./src/middleware/downloadAuth');

// Protect download route
app.use("/downloads", authenticateDownload, express.static(path.join(__dirname, "downloads")));

// Update download response to include token
app.post("/download", validateDownloadRequest, async (req, res) => {
  // ... download logic ...

  const filename = `${outputName}.${validatedFormat}`;
  const token = generateDownloadToken(filename);

  res.json({
    message: "Download complete",
    file: filename,
    downloadUrl: `/downloads/${filename}?token=${token}`
  });
});
```

**Can Run in Parallel:** No - depends on 1.1

---

### 1.4 Environment Configuration (HIGH PRIORITY)

**Complexity:** SIMPLE | **Effort:** 2 hours

**Issue:** Hardcoded values, no configuration management

**Files:**
- New: `backend/.env.example`
- New: `backend/src/config/environment.js`
- Update: `backend/index.js`
- Update: `backend/.gitignore`

**Dependencies:**
```bash
npm install dotenv
npm install joi  # For config validation
```

**Implementation:**

```javascript
// backend/.env.example
# Server Configuration
NODE_ENV=development
PORT=5001
HOST=localhost

# Frontend Configuration
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Download Configuration
MAX_CONCURRENT_DOWNLOADS=3
DOWNLOAD_TIMEOUT_MS=600000
MAX_FILE_SIZE_MB=500
CLEANUP_INTERVAL_HOURS=24
DOWNLOADS_DIR=./downloads

# Audio Format Configuration
DEFAULT_AUDIO_FORMAT=mp3
ALLOWED_FORMATS=mp3,wav,flac,m4a,aac,opus

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Security
DOWNLOAD_TOKEN_EXPIRY_MS=300000
```

```javascript
// backend/src/config/environment.js
require('dotenv').config();
const Joi = require('joi');

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(5001),
  HOST: Joi.string().default('localhost'),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
  MAX_CONCURRENT_DOWNLOADS: Joi.number().default(3),
  DOWNLOAD_TIMEOUT_MS: Joi.number().default(600000),
  MAX_FILE_SIZE_MB: Joi.number().default(500),
  CLEANUP_INTERVAL_HOURS: Joi.number().default(24),
  DOWNLOADS_DIR: Joi.string().default('./downloads'),
  DEFAULT_AUDIO_FORMAT: Joi.string().default('mp3'),
  ALLOWED_FORMATS: Joi.string().default('mp3,wav,flac,m4a,aac,opus'),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(10),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FILE: Joi.string().default('./logs/app.log'),
  DOWNLOAD_TOKEN_EXPIRY_MS: Joi.number().default(300000)
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  host: envVars.HOST,
  frontend: {
    url: envVars.FRONTEND_URL,
    allowedOrigins: envVars.ALLOWED_ORIGINS.split(',')
  },
  download: {
    maxConcurrent: envVars.MAX_CONCURRENT_DOWNLOADS,
    timeout: envVars.DOWNLOAD_TIMEOUT_MS,
    maxFileSize: envVars.MAX_FILE_SIZE_MB * 1024 * 1024,
    cleanupInterval: envVars.CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000,
    directory: envVars.DOWNLOADS_DIR
  },
  audio: {
    defaultFormat: envVars.DEFAULT_AUDIO_FORMAT,
    allowedFormats: envVars.ALLOWED_FORMATS.split(',')
  },
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    max: envVars.RATE_LIMIT_MAX_REQUESTS
  },
  logging: {
    level: envVars.LOG_LEVEL,
    file: envVars.LOG_FILE
  },
  security: {
    tokenExpiry: envVars.DOWNLOAD_TOKEN_EXPIRY_MS
  }
};

module.exports = config;
```

```javascript
// backend/index.js (updated)
const config = require('./src/config/environment');

const app = express();
const port = config.port;

// Use config throughout
app.listen(port, config.host, () => {
  console.log(`Backend running on http://${config.host}:${port}`);
  console.log(`Environment: ${config.env}`);
});
```

**Can Run in Parallel:** Yes, with 1.1, 1.2

---

### 1.5 Rate Limiting & DoS Protection (HIGH PRIORITY)

**Complexity:** SIMPLE | **Effort:** 1 hour

**Issue:** No rate limiting - vulnerable to DDoS attacks

**Files:**
- New: `backend/src/middleware/rateLimiter.js`
- Update: `backend/index.js`

**Dependencies:**
```bash
npm install express-rate-limit
npm install express-slow-down
```

**Implementation:**

```javascript
// backend/src/middleware/rateLimiter.js
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
```

```javascript
// backend/index.js (updated)
const { apiLimiter, downloadLimiter, speedLimiter } = require('./src/middleware/rateLimiter');

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/download', speedLimiter, downloadLimiter);
```

**Can Run in Parallel:** Yes, with 1.1, 1.2, 1.4

---

### 1.6 Security Headers (MEDIUM PRIORITY)

**Complexity:** SIMPLE | **Effort:** 30 minutes

**Issue:** Missing security headers (HSTS, CSP, X-Frame-Options, etc.)

**Dependencies:**
```bash
npm install helmet
```

**Implementation:**

```javascript
// backend/index.js (updated)
const helmet = require('helmet');

// Apply security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

**Can Run in Parallel:** Yes, with all Phase 1 tasks

---

## PHASE 2: STABILITY & ERROR HANDLING (Week 2)

**Goal:** Prevent server crashes and improve reliability

### 2.1 Centralized Error Handling (HIGH PRIORITY)

**Complexity:** MEDIUM | **Effort:** 1 day

**Issue:** No global error handler, errors crash server

**Files:**
- New: `backend/src/middleware/errorHandler.js`
- New: `backend/src/utils/errors.js`
- Update: `backend/index.js`

**Implementation:**

```javascript
// backend/src/utils/errors.js
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
  constructor(message) {
    super(message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

class DownloadError extends AppError {
  constructor(message) {
    super(message, 500);
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  DownloadError
};
```

```javascript
// backend/src/middleware/errorHandler.js
const config = require('../config/environment');

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // Log error (will be replaced with proper logger in 2.2)
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    statusCode,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Don't expose internal errors in production
  if (config.env === 'production' && statusCode === 500) {
    message = 'An unexpected error occurred';
  }

  res.status(statusCode).json({
    error: message,
    ...(config.env === 'development' && { stack: err.stack })
  });
}

function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'Not found',
    message: `Cannot ${req.method} ${req.url}`
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
```

```javascript
// backend/index.js (updated)
const { errorHandler, notFoundHandler, asyncHandler } = require('./src/middleware/errorHandler');
const { DownloadError } = require('./src/utils/errors');

// Wrap async routes
app.post("/download", validateDownloadRequest, asyncHandler(async (req, res) => {
  const { validatedUrl, validatedFormat, validatedCustomName } = req.body;

  try {
    const ytDlp = new YtDlpWrap("yt-dlp");
    const metadata = await ytDlp.getVideoInfo(validatedUrl);
    const videoTitle = metadata.title || "downloaded";

    const outputName = validatedCustomName || sanitize(videoTitle);
    const outputFile = path.resolve(__dirname, "downloads", `${outputName}.${validatedFormat}`);

    await ytDlp.execPromise([
      validatedUrl,
      "-x",
      "--audio-format",
      validatedFormat,
      "-o",
      outputFile
    ]);

    const filename = `${outputName}.${validatedFormat}`;
    const token = generateDownloadToken(filename);

    res.json({
      message: "Download complete",
      file: filename,
      downloadUrl: `/downloads/${filename}?token=${token}`
    });
  } catch (err) {
    throw new DownloadError(`Failed to download: ${err.message}`);
  }
}));

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! Shutting down...');
  console.error(err);
  process.exit(1);
});
```

**Can Run in Parallel:** No - foundation for other Phase 2 tasks

---

### 2.2 Structured Logging (HIGH PRIORITY)

**Complexity:** MEDIUM | **Effort:** 4 hours

**Issue:** No logging, impossible to debug production issues

**Files:**
- New: `backend/src/utils/logger.js`
- New: `backend/src/middleware/requestLogger.js`
- Update: All files to use logger

**Dependencies:**
```bash
npm install winston
npm install winston-daily-rotate-file
npm install morgan
```

**Implementation:**

```javascript
// backend/src/utils/logger.js
const winston = require('winston');
const path = require('path');
const config = require('../config/environment');
const DailyRotateFile = require('winston-daily-rotate-file');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const transports = [
  // Console logging
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
      )
    )
  }),

  // File logging with rotation
  new DailyRotateFile({
    filename: path.join('logs', 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat
  }),

  // Error-only log file
  new DailyRotateFile({
    filename: path.join('logs', 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat
  })
];

const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  exitOnError: false
});

// Create a stream for Morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;
```

```javascript
// backend/src/middleware/requestLogger.js
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

// Custom format
const format = ':method :url :status :response-time-ms ms - :res[content-length]';

const requestLogger = morgan(format, {
  stream: logger.stream,
  skip: (req, res) => {
    // Skip health check logs
    return req.url === '/health';
  }
});

module.exports = requestLogger;
```

**Usage:**
```javascript
// backend/index.js (updated)
const logger = require('./src/utils/logger');
const requestLogger = require('./src/middleware/requestLogger');

// Add request logging
app.use(requestLogger);

// Replace all console.log/error with logger
logger.info(`Backend running on http://${config.host}:${config.port}`);
logger.error('Download failed:', error);
```

**Can Run in Parallel:** Yes, with 2.1

---

### 2.3 Fix Race Conditions (CRITICAL)

**Complexity:** MEDIUM | **Effort:** 4 hours

**Issue:** Multiple race conditions in file cleanup logic

**Files:**
- Update: `backend/index.js` (cleanup logic)

**Implementation:**

```javascript
// backend/index.js (updated)
const { promisify } = require('util');
const fs = require('fs').promises; // Use promise-based fs

// Helper function for safe cleanup
async function cleanupDirectory(dirPath) {
  try {
    const files = await fs.readdir(dirPath);

    // Delete all files first
    await Promise.all(
      files.map(file =>
        fs.unlink(path.join(dirPath, file)).catch(err => {
          logger.error(`Failed to delete file ${file}:`, err);
        })
      )
    );

    // Then delete directory
    await fs.rmdir(dirPath);
    logger.info(`Cleaned up directory: ${dirPath}`);
  } catch (err) {
    logger.error(`Failed to cleanup directory ${dirPath}:`, err);
    // Don't throw - log and continue
  }
}

// Helper function for safe zip creation
async function createZipFile(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    try {
      const zip = new AdmZip();
      zip.addLocalFolder(sourceDir);
      zip.writeZip(zipPath);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

app.post("/download/playlist", validatePlaylistRequest, asyncHandler(async (req, res) => {
  const { validatedUrl, validatedFormat } = req.body;

  const ytDlp = new YtDlpWrap("yt-dlp");
  const metadata = await ytDlp.getVideoInfo(validatedUrl);
  const playlistTitle = metadata.title || "playlist";

  // Use timestamp to avoid collisions
  const timestamp = Date.now();
  const uniqueDir = `${sanitize(playlistTitle)}-${timestamp}`;
  const outputDir = path.resolve(__dirname, "downloads", uniqueDir);

  // Create directory
  await fs.mkdir(outputDir, { recursive: true });

  const outputFile = path.resolve(outputDir, "%(title)s.%(ext)s");

  const args = [
    validatedUrl,
    "-o",
    outputFile,
    "-x",
    "--audio-format",
    validatedFormat,
    "--restrict-filenames",
    "--no-overwrites",
    "--continue",
  ];

  await ytDlp.execPromise(args);

  // Create zip file
  const zipFilePath = path.resolve(__dirname, "downloads", `${uniqueDir}.zip`);
  await createZipFile(outputDir, zipFilePath);

  // Clean up directory AFTER zip is complete
  await cleanupDirectory(outputDir);

  const token = generateDownloadToken(`${uniqueDir}.zip`);

  res.json({
    message: "Playlist download complete",
    file: `${uniqueDir}.zip`,
    downloadUrl: `/downloads/${uniqueDir}.zip?token=${token}`
  });
}));

// Similar fix for /download/list endpoint
```

**Can Run in Parallel:** No - depends on 2.1

---

### 2.4 Graceful Shutdown (MEDIUM PRIORITY)

**Complexity:** MEDIUM | **Effort:** 2 hours

**Issue:** Server doesn't handle shutdown gracefully

**Files:**
- New: `backend/src/utils/shutdown.js`
- Update: `backend/index.js`

**Implementation:**

```javascript
// backend/src/utils/shutdown.js
const logger = require('./logger');

let isShuttingDown = false;

function gracefulShutdown(server, signal) {
  return async () => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Wait for existing connections to close (max 30 seconds)
    const shutdownTimeout = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);

    try {
      // Close any open resources here
      // e.g., database connections, job queues, etc.

      clearTimeout(shutdownTimeout);
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  };
}

module.exports = gracefulShutdown;
```

```javascript
// backend/index.js (updated)
const gracefulShutdown = require('./src/utils/shutdown');

const server = app.listen(port, config.host, () => {
  logger.info(`Backend running on http://${config.host}:${config.port}`);
});

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown(server, 'SIGTERM'));
process.on('SIGINT', gracefulShutdown(server, 'SIGINT'));
```

**Can Run in Parallel:** Yes, with 2.2, 2.3

---

## PHASE 3: CODE RESTRUCTURING (Week 3)

**Goal:** Clean architecture, maintainability, separation of concerns

### 3.1 Service Layer Architecture (HIGH PRIORITY)

**Complexity:** COMPLEX | **Effort:** 2 days

**Issue:** Business logic mixed with route handlers

**New Directory Structure:**
```
backend/
  src/
    config/
      cors.js
      environment.js
    controllers/
      downloadController.js
      healthController.js
    services/
      downloadService.js
      youtubeService.js
      fileService.js
    middleware/
      validation.js
      errorHandler.js
      downloadAuth.js
      rateLimiter.js
      requestLogger.js
    utils/
      validators.js
      tokenGenerator.js
      logger.js
      errors.js
      shutdown.js
    routes/
      index.js
      download.js
      health.js
    app.js
  index.js
  package.json
```

**Implementation:** (showing key files)

```javascript
// backend/src/services/youtubeService.js
const YtDlpWrap = require('yt-dlp-wrap').default;
const { DownloadError } = require('../utils/errors');
const logger = require('../utils/logger');

class YouTubeService {
  constructor() {
    this.ytDlp = new YtDlpWrap('yt-dlp');
  }

  async getVideoMetadata(url) {
    try {
      const metadata = await this.ytDlp.getVideoInfo(url);
      return {
        title: metadata.title,
        duration: metadata.duration,
        uploader: metadata.uploader,
        thumbnail: metadata.thumbnail
      };
    } catch (err) {
      logger.error('Failed to get video metadata:', err);
      throw new DownloadError(`Failed to fetch video info: ${err.message}`);
    }
  }

  async downloadAudio(url, outputPath, format) {
    try {
      await this.ytDlp.execPromise([
        url,
        '-x',
        '--audio-format', format,
        '-o', outputPath,
        '--restrict-filenames',
        '--no-overwrites'
      ]);
      logger.info(`Downloaded audio: ${outputPath}`);
    } catch (err) {
      logger.error('Failed to download audio:', err);
      throw new DownloadError(`Download failed: ${err.message}`);
    }
  }

  async downloadPlaylist(url, outputDir, format) {
    const outputTemplate = `${outputDir}/%(title)s.%(ext)s`;

    try {
      await this.ytDlp.execPromise([
        url,
        '-o', outputTemplate,
        '-x',
        '--audio-format', format,
        '--restrict-filenames',
        '--no-overwrites',
        '--continue'
      ]);
      logger.info(`Downloaded playlist to: ${outputDir}`);
    } catch (err) {
      logger.error('Failed to download playlist:', err);
      throw new DownloadError(`Playlist download failed: ${err.message}`);
    }
  }
}

module.exports = new YouTubeService();
```

```javascript
// backend/src/services/fileService.js
const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const sanitize = require('sanitize-filename');
const { DownloadError } = require('../utils/errors');
const logger = require('../utils/logger');
const config = require('../config/environment');

class FileService {
  constructor() {
    this.downloadsDir = path.resolve(__dirname, '../../', config.download.directory);
    this.ensureDownloadsDir();
  }

  async ensureDownloadsDir() {
    try {
      await fs.mkdir(this.downloadsDir, { recursive: true });
    } catch (err) {
      logger.error('Failed to create downloads directory:', err);
    }
  }

  generateUniqueFilename(baseName, extension) {
    const timestamp = Date.now();
    const sanitized = sanitize(baseName);
    return `${sanitized}-${timestamp}.${extension}`;
  }

  getDownloadPath(filename) {
    return path.join(this.downloadsDir, filename);
  }

  async createZip(sourceDir, zipFilename) {
    try {
      const zip = new AdmZip();
      zip.addLocalFolder(sourceDir);

      const zipPath = this.getDownloadPath(zipFilename);
      zip.writeZip(zipPath);

      logger.info(`Created zip file: ${zipPath}`);
      return zipPath;
    } catch (err) {
      logger.error('Failed to create zip:', err);
      throw new DownloadError('Failed to create zip file');
    }
  }

  async cleanupDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);

      await Promise.all(
        files.map(file =>
          fs.unlink(path.join(dirPath, file)).catch(err => {
            logger.error(`Failed to delete file ${file}:`, err);
          })
        )
      );

      await fs.rmdir(dirPath);
      logger.info(`Cleaned up directory: ${dirPath}`);
    } catch (err) {
      logger.error(`Failed to cleanup directory ${dirPath}:`, err);
    }
  }

  async deleteFile(filename) {
    try {
      const filePath = this.getDownloadPath(filename);
      await fs.unlink(filePath);
      logger.info(`Deleted file: ${filename}`);
    } catch (err) {
      logger.error(`Failed to delete file ${filename}:`, err);
    }
  }

  async cleanupOldFiles(maxAgeHours = 24) {
    try {
      const files = await fs.readdir(this.downloadsDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.downloadsDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath).catch(err => {
            logger.error(`Failed to delete old file ${file}:`, err);
          });
          logger.info(`Deleted old file: ${file}`);
        }
      }
    } catch (err) {
      logger.error('Failed to cleanup old files:', err);
    }
  }
}

module.exports = new FileService();
```

```javascript
// backend/src/services/downloadService.js
const youtubeService = require('./youtubeService');
const fileService = require('./fileService');
const { generateDownloadToken } = require('../utils/tokenGenerator');
const logger = require('../utils/logger');

class DownloadService {
  async downloadSingleVideo(url, format, customName = null) {
    // Get video metadata
    const metadata = await youtubeService.getVideoMetadata(url);

    // Generate filename
    const baseName = customName || metadata.title;
    const filename = fileService.generateUniqueFilename(baseName, format);
    const outputPath = fileService.getDownloadPath(filename);

    // Download
    await youtubeService.downloadAudio(url, outputPath, format);

    // Generate download token
    const token = generateDownloadToken(filename);

    return {
      filename,
      downloadUrl: `/downloads/${filename}?token=${token}`,
      metadata
    };
  }

  async downloadPlaylist(url, format) {
    // Get playlist metadata
    const metadata = await youtubeService.getVideoMetadata(url);

    // Create unique directory
    const dirName = fileService.generateUniqueFilename(metadata.title, '');
    const outputDir = fileService.getDownloadPath(dirName);

    await fileService.ensureDownloadsDir();
    await require('fs').promises.mkdir(outputDir, { recursive: true });

    // Download playlist
    await youtubeService.downloadPlaylist(url, outputDir, format);

    // Create zip
    const zipFilename = `${dirName}.zip`;
    await fileService.createZip(outputDir, zipFilename);

    // Cleanup directory
    await fileService.cleanupDirectory(outputDir);

    // Generate token
    const token = generateDownloadToken(zipFilename);

    return {
      filename: zipFilename,
      downloadUrl: `/downloads/${zipFilename}?token=${token}`,
      metadata
    };
  }

  async downloadMultipleVideos(urls, format) {
    // Create unique directory
    const timestamp = Date.now();
    const dirName = `multiple-${timestamp}`;
    const outputDir = fileService.getDownloadPath(dirName);

    await require('fs').promises.mkdir(outputDir, { recursive: true });

    // Download all URLs
    const results = [];
    for (const url of urls) {
      try {
        const metadata = await youtubeService.getVideoMetadata(url);
        const outputPath = `${outputDir}/%(title)s.%(ext)s`;
        await youtubeService.downloadAudio(url, outputPath, format);
        results.push({ url, success: true, title: metadata.title });
      } catch (err) {
        logger.error(`Failed to download ${url}:`, err);
        results.push({ url, success: false, error: err.message });
      }
    }

    // Create zip
    const zipFilename = `${dirName}.zip`;
    await fileService.createZip(outputDir, zipFilename);

    // Cleanup
    await fileService.cleanupDirectory(outputDir);

    // Generate token
    const token = generateDownloadToken(zipFilename);

    return {
      filename: zipFilename,
      downloadUrl: `/downloads/${zipFilename}?token=${token}`,
      results
    };
  }
}

module.exports = new DownloadService();
```

```javascript
// backend/src/controllers/downloadController.js
const downloadService = require('../services/downloadService');
const { asyncHandler } = require('../middleware/errorHandler');

exports.downloadSingle = asyncHandler(async (req, res) => {
  const { validatedUrl, validatedFormat, validatedCustomName } = req.body;

  const result = await downloadService.downloadSingleVideo(
    validatedUrl,
    validatedFormat,
    validatedCustomName
  );

  res.json({
    success: true,
    message: 'Download complete',
    data: result
  });
});

exports.downloadPlaylist = asyncHandler(async (req, res) => {
  const { validatedUrl, validatedFormat } = req.body;

  const result = await downloadService.downloadPlaylist(
    validatedUrl,
    validatedFormat
  );

  res.json({
    success: true,
    message: 'Playlist download complete',
    data: result
  });
});

exports.downloadMultiple = asyncHandler(async (req, res) => {
  const { validatedUrls, validatedFormat } = req.body;

  const result = await downloadService.downloadMultipleVideos(
    validatedUrls,
    validatedFormat
  );

  res.json({
    success: true,
    message: 'Multiple downloads complete',
    data: result
  });
});

module.exports = exports;
```

```javascript
// backend/src/routes/download.js
const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/downloadController');
const {
  validateDownloadRequest,
  validatePlaylistRequest,
  validateMultiDownloadRequest
} = require('../middleware/validation');
const { downloadLimiter, speedLimiter } = require('../middleware/rateLimiter');

router.post(
  '/single',
  speedLimiter,
  downloadLimiter,
  validateDownloadRequest,
  downloadController.downloadSingle
);

router.post(
  '/playlist',
  speedLimiter,
  downloadLimiter,
  validatePlaylistRequest,
  downloadController.downloadPlaylist
);

router.post(
  '/multiple',
  speedLimiter,
  downloadLimiter,
  validateMultiDownloadRequest,
  downloadController.downloadMultiple
);

module.exports = router;
```

```javascript
// backend/src/app.js
const express = require('express');
const corsMiddleware = require('./config/cors');
const helmet = require('helmet');
const requestLogger = require('./middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const authenticateDownload = require('./middleware/downloadAuth');
const path = require('path');

// Routes
const downloadRoutes = require('./routes/download');
const healthRoutes = require('./routes/health');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(corsMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(requestLogger);

// Rate limiting
app.use('/api/', apiLimiter);

// Routes
app.use('/health', healthRoutes);
app.use('/api/download', downloadRoutes);

// Serve downloads with authentication
app.use('/downloads', authenticateDownload, express.static(path.join(__dirname, '../downloads')));

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
```

```javascript
// backend/index.js (simplified)
const app = require('./src/app');
const config = require('./src/config/environment');
const logger = require('./src/utils/logger');
const gracefulShutdown = require('./src/utils/shutdown');
const fileService = require('./src/services/fileService');

const server = app.listen(config.port, config.host, () => {
  logger.info(`Backend running on http://${config.host}:${config.port}`);
  logger.info(`Environment: ${config.env}`);

  // Schedule cleanup
  setInterval(() => {
    fileService.cleanupOldFiles(config.download.cleanupInterval / (60 * 60 * 1000));
  }, config.download.cleanupInterval);
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown(server, 'SIGTERM'));
process.on('SIGINT', gracefulShutdown(server, 'SIGINT'));
```

**Breaking Changes:**
- API endpoints changed from `/download` to `/api/download/single`
- Response format standardized to `{ success, message, data }`
- Frontend must be updated

**Can Run in Parallel:** No - major refactor

---

## PHASE 4: PERFORMANCE OPTIMIZATION (Week 4)

**Goal:** Handle scale, improve response times, reduce memory usage

### 4.1 Job Queue with Bull/Redis (HIGH PRIORITY)

**Complexity:** COMPLEX | **Effort:** 2 days

**Issue:** Long downloads block request threads

**Dependencies:**
```bash
npm install bull
npm install redis
npm install ioredis
```

**Files:**
- New: `backend/src/queue/downloadQueue.js`
- New: `backend/src/queue/processor.js`
- Update: `backend/src/services/downloadService.js`
- Update: `backend/src/controllers/downloadController.js`

**Implementation:** (Key concepts - full code would be lengthy)

```javascript
// backend/src/queue/downloadQueue.js
const Queue = require('bull');
const config = require('../config/environment');

const downloadQueue = new Queue('download', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

// Process jobs
downloadQueue.process(config.download.maxConcurrent, async (job) => {
  const { type, url, format, customName } = job.data;

  // Update progress
  job.progress(0);

  // Process based on type
  // ... download logic with progress updates

  job.progress(100);
  return result;
});

module.exports = downloadQueue;
```

**Benefits:**
- Background processing
- Progress tracking
- Retry logic
- Concurrency control
- Job persistence

**Can Run in Parallel:** No - requires Redis setup

---

### 4.2 WebSocket Progress Tracking (MEDIUM PRIORITY)

**Complexity:** MEDIUM | **Effort:** 1 day

**Dependencies:**
```bash
npm install socket.io
```

**Implementation:** Real-time progress updates to frontend

**Can Run in Parallel:** No - depends on 4.1

---

### 4.3 Caching Layer (MEDIUM PRIORITY)

**Complexity:** MEDIUM | **Effort:** 1 day

**Features:**
- Cache video metadata
- Deduplicate downloads
- Use Redis for distributed caching

**Can Run in Parallel:** Yes, with 4.1

---

## PHASE 5: PRODUCTION READINESS (Week 5)

**Goal:** Tests, documentation, deployment

### 5.1 Comprehensive Test Suite (HIGH PRIORITY)

**Complexity:** COMPLEX | **Effort:** 2-3 days

**Dependencies:**
```bash
npm install --save-dev jest supertest
npm install --save-dev @types/jest @types/supertest
```

**Test Coverage:**
- Unit tests for services, utils, middleware
- Integration tests for API endpoints
- E2E tests for full download flow
- Target: 80%+ coverage

**Can Run in Parallel:** Yes, with 5.2, 5.3

---

### 5.2 API Documentation (MEDIUM PRIORITY)

**Complexity:** MEDIUM | **Effort:** 1 day

**Dependencies:**
```bash
npm install swagger-jsdoc swagger-ui-express
```

**Features:**
- OpenAPI 3.0 specification
- Interactive API docs at `/api-docs`
- Request/response examples

**Can Run in Parallel:** Yes, with 5.1

---

### 5.3 Monitoring & Metrics (MEDIUM PRIORITY)

**Complexity:** MEDIUM | **Effort:** 1 day

**Dependencies:**
```bash
npm install prom-client
```

**Metrics:**
- Request rate, latency
- Download success/failure rates
- Queue length
- Disk usage

**Can Run in Parallel:** Yes, with 5.1, 5.2

---

### 5.4 Docker & Deployment (HIGH PRIORITY)

**Complexity:** MEDIUM | **Effort:** 1 day

**Files:**
- New: `backend/Dockerfile`
- New: `docker-compose.yml`
- New: `.dockerignore`

**Implementation:**

```dockerfile
# backend/Dockerfile
FROM node:18-alpine

# Install yt-dlp and ffmpeg
RUN apk add --no-cache python3 py3-pip ffmpeg && \
    pip3 install yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5001

CMD ["node", "index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "5001:5001"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
    volumes:
      - ./backend/downloads:/app/downloads
      - ./backend/logs:/app/logs
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  redis_data:
```

**Can Run in Parallel:** No - deployment is final step

---

## TIMELINE & EXECUTION

### Week 1 - Critical Security
- Day 1: 1.1 Input Validation
- Day 2: 1.3 Access Control, 1.4 Environment Config
- Day 3: 1.2 CORS, 1.5 Rate Limiting, 1.6 Security Headers
- Day 4-5: Testing and validation

### Week 2 - Stability
- Day 1-2: 2.1 Error Handling, 2.2 Logging
- Day 3: 2.3 Fix Race Conditions
- Day 4: 2.4 Graceful Shutdown
- Day 5: Testing

### Week 3 - Restructuring
- Day 1-3: 3.1 Service Layer (major refactor)
- Day 4: Frontend updates for new API
- Day 5: Integration testing

### Week 4 - Performance
- Day 1-2: 4.1 Job Queue
- Day 3: 4.2 WebSocket Progress
- Day 4: 4.3 Caching
- Day 5: Performance testing

### Week 5 - Production
- Day 1-2: 5.1 Tests
- Day 3: 5.2 Documentation, 5.3 Monitoring
- Day 4: 5.4 Docker & Deployment
- Day 5: Final validation

---

## DEPENDENCY INSTALLATION SUMMARY

```bash
# Phase 1
npm install express-validator validator uuid crypto

# Phase 2
npm install winston winston-daily-rotate-file morgan

# Phase 4
npm install bull redis ioredis socket.io

# Phase 5
npm install --save-dev jest supertest @types/jest @types/supertest
npm install swagger-jsdoc swagger-ui-express prom-client
```

---

## SUCCESS CRITERIA

**Phase 1 Complete:** ✅ **ALL TASKS COMPLETED**
- [x] All inputs validated with whitelist approach
- [x] No command injection vulnerabilities
- [x] Download tokens implemented and tested
- [x] CORS restricted to known origins
- [x] Rate limiting active
- [x] Security headers applied

**Completion:** November 9, 2025 | **PR:** [#2](https://github.com/RenanDiaz/youtube-mp3-app/pull/2)

**Phase 2 Complete:**
- [ ] No unhandled promise rejections
- [ ] All errors logged with context
- [ ] No race conditions in file operations
- [ ] Graceful shutdown working
- [ ] Server stable under load

**Phase 3 Complete:**
- [ ] Clean separation of concerns
- [ ] Service layer implemented
- [ ] Controllers thin and focused
- [ ] Code duplication eliminated
- [ ] Easy to add new features

**Phase 4 Complete:**
- [ ] Downloads processed in background
- [ ] Real-time progress updates
- [ ] Handles 10+ concurrent downloads
- [ ] Memory usage optimized
- [ ] Response times < 200ms

**Phase 5 Complete:**
- [ ] 80%+ test coverage
- [ ] API documentation complete
- [ ] Monitoring dashboards setup
- [ ] Docker deployment working
- [ ] Production-ready

---

## RISK MITIGATION

1. **Breaking Changes in Phase 3:**
   - Maintain backward compatibility with feature flags
   - Version API (v1 old, v2 new)
   - Deploy both versions temporarily

2. **Redis Dependency in Phase 4:**
   - Make job queue optional
   - Fallback to in-memory processing
   - Document Redis setup clearly

3. **Large Refactor Risk:**
   - Use feature branches
   - Incremental rollout
   - Comprehensive testing before merge

4. **Time Overruns:**
   - Phases 1-2 are non-negotiable
   - Phase 3 can be incremental
   - Phases 4-5 can be deferred

---

## MAINTENANCE PLAN

**Daily:**
- Monitor error logs
- Check disk space
- Review download success rates

**Weekly:**
- Update yt-dlp to latest version
- Review and rotate logs
- Security scan with npm audit

**Monthly:**
- Update dependencies
- Review and optimize performance
- Backup and test restore procedures

---

## CONCLUSION

This plan transforms a proof-of-concept into a **production-grade backend** with:

- ✅ **Security:** No RCE, SSRF, or injection vulnerabilities
- ✅ **Stability:** No crashes, proper error handling
- ✅ **Scalability:** Job queues, caching, horizontal scaling
- ✅ **Maintainability:** Clean architecture, well-tested
- ✅ **Observability:** Logging, monitoring, metrics
- ✅ **Documentation:** API docs, deployment guides

**Estimated Final State:**
- **Lines of Code:** ~5,000 (from 178)
- **Files:** ~30 (from 1)
- **Test Coverage:** 80%+
- **Dependencies:** ~25 packages
- **Deployment:** Docker-based, production-ready

**Recommendation:** Execute phases 1-2 immediately (security + stability), then evaluate phases 3-5 based on traffic and business needs.