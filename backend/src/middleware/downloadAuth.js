const { validateDownloadToken } = require('../utils/tokenGenerator');
const path = require('path');

function authenticateDownload(req, res, next) {
  const token = req.query.token;

  // req.path keeps percent-encoding (e.g. "%20" for spaces), but tokens are
  // generated/stored with the decoded filename. Decode before validating so
  // names with spaces or other special characters match correctly.
  let filename;
  try {
    filename = decodeURIComponent(path.basename(req.path));
  } catch (err) {
    return res.status(400).json({ error: 'Invalid filename encoding' });
  }

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
