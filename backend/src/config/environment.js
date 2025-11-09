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
