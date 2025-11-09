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
