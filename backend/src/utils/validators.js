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
