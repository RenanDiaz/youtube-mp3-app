const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/environment');

// In-memory token store (use Redis in production)
const downloadTokens = new Map();

// Token expiry time (from config)
const TOKEN_EXPIRY_MS = config.security.tokenExpiry;

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
