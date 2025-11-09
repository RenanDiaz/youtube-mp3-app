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
