const express = require("express");
const sanitize = require("sanitize-filename");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const helmet = require("helmet");

// Import configuration and security modules
const config = require("./src/config/environment");
const corsMiddleware = require("./src/config/cors");
const { generateDownloadToken } = require("./src/utils/tokenGenerator");
const authenticateDownload = require("./src/middleware/downloadAuth");
const {
  validateDownloadRequest,
  validatePlaylistRequest,
  validateMultiDownloadRequest
} = require("./src/middleware/validation");
const { apiLimiter, downloadLimiter, speedLimiter } = require("./src/middleware/rateLimiter");

// Phase 2: Import logging and error handling (2.1, 2.2)
const logger = require("./src/utils/logger");
const requestLogger = require("./src/middleware/requestLogger");
const {
  asyncHandler,
  notFoundHandler,
  errorHandler,
  setupUncaughtExceptionHandler,
  setupUnhandledRejectionHandler
} = require("./src/middleware/errorHandler");
const { DownloadError, ErrorCodes } = require("./src/utils/errors");
const gracefulShutdown = require("./src/utils/shutdown");

// yt-dlp helpers (403 mitigations, error classification, version check)
const {
  createYtDlp,
  buildCommonArgs,
  buildAudioDownloadArgs,
  classifyYtDlpError,
  summarizeFailures,
  getYtDlpVersion,
  logYtDlpVersion
} = require("./src/utils/ytdlp");
const { normalizeYouTubeUrl } = require("./src/utils/youtubeUrl");

// Phase 1 UI/UX: Import progress tracker
const progressTracker = require("./src/utils/progressTracker");

// Set up error handlers for uncaught exceptions and rejections (2.1)
setupUncaughtExceptionHandler();
setupUnhandledRejectionHandler();

const app = express();

// Security middleware - Apply Helmet first (1.6)
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

// CORS configuration (1.2)
app.use(corsMiddleware);

// Body parsing
app.use(express.json());

// Request logging (2.2)
app.use(requestLogger);

// Apply general rate limiting (1.5)
app.use(apiLimiter);

// Health check (no authentication required)
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// Diagnostics - first thing to check when downloads start failing with HTTP 403
app.get("/diagnostics", asyncHandler(async (req, res) => {
  let ytDlpInfo = { available: false, version: null, ageDays: null, stale: null };

  try {
    const { version, ageDays, stale } = await getYtDlpVersion();
    ytDlpInfo = { available: true, version, ageDays, stale };
  } catch (err) {
    ytDlpInfo.error = classifyYtDlpError(err).message;
  }

  res.json({
    ytDlp: ytDlpInfo,
    settings: {
      playerClients: config.ytdlp.playerClients || "(yt-dlp default)",
      cookiesConfigured: Boolean(config.ytdlp.cookiesFromBrowser || config.ytdlp.cookiesFile),
      sleepRequests: config.ytdlp.sleepRequests,
      delayBetweenDownloads: config.ytdlp.delayBetweenDownloads,
      retries: config.ytdlp.retries
    }
  });
}));

// Helper: fetch video metadata without -f best (avoids SSAP/signature issues)
async function getVideoMetadata(ytDlp, url, opts = {}) {
  const args = [url, '--dump-json', '--no-warnings', ...buildCommonArgs()];
  if (opts.flatPlaylist) {
    args.push('--flat-playlist');
  }
  const stdout = await ytDlp.execPromise(args);
  // For playlists, --dump-json outputs one JSON per line; parse the first one
  const firstLine = stdout.split('\n').find(line => line.trim());
  return JSON.parse(firstLine);
}

// URL validation endpoint - validates YouTube URL and returns metadata (Phase 1.3)
app.post("/validate", speedLimiter, asyncHandler(async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'URL is required',
        code: 'INVALID_REQUEST'
      }
    });
  }

  const ytDlp = createYtDlp();

  // Normalize URL (music.youtube.com -> www.youtube.com, drop tracking params)
  const normalizedUrl = normalizeYouTubeUrl(url);

  try {
    // Get video metadata without downloading
    const metadata = await getVideoMetadata(ytDlp, normalizedUrl);

    // Extract relevant information
    const videoInfo = {
      valid: true,
      title: metadata.title || 'Unknown Title',
      duration: metadata.duration || 0,
      thumbnail: metadata.thumbnail || metadata.thumbnails?.[0]?.url || null,
      uploader: metadata.uploader || metadata.channel || 'Unknown',
      uploadDate: metadata.upload_date || null,
      viewCount: metadata.view_count || 0,
      description: metadata.description?.substring(0, 200) || '',
      isPlaylist: metadata.playlist_count > 0 || false,
      playlistCount: metadata.playlist_count || 0
    };

    logger.info(`Validated URL: ${videoInfo.title}`);

    res.json({
      success: true,
      data: videoInfo
    });

  } catch (err) {
    logger.error(`URL validation failed:`, err);

    // Map the raw yt-dlp output to a stable code + actionable message
    const { code, message } = classifyYtDlpError(err);

    res.status(400).json({
      success: false,
      error: {
        message,
        code,
        statusCode: 400
      }
    });
  }
}));

// Server-Sent Events endpoint for download progress (Phase 1 UI/UX)
app.get("/download/progress/:downloadId", (req, res) => {
  const { downloadId } = req.params;

  // Check if download exists
  if (!progressTracker.hasDownload(downloadId)) {
    return res.status(404).json({ error: "Download not found" });
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // Add client to progress tracker
  const added = progressTracker.addClient(downloadId, res);

  if (!added) {
    return res.status(404).json({ error: "Download not found" });
  }

  logger.info(`SSE client connected to download: ${downloadId}`);

  // Handle client disconnect
  req.on("close", () => {
    progressTracker.removeClient(downloadId, res);
    logger.info(`SSE client disconnected from download: ${downloadId}`);
  });
});

// Helper function for safe cleanup (2.3 - fixes race conditions)
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

// Helper function for safe zip creation (2.3)
async function createZipFile(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    try {
      const zip = new AdmZip();
      zip.addLocalFolder(sourceDir);
      zip.writeZip(zipPath);
      logger.info(`Created zip file: ${zipPath}`);
      resolve();
    } catch (err) {
      logger.error(`Failed to create zip: ${err.message}`);
      reject(new DownloadError('Failed to create zip file'));
    }
  });
}

// Helper function to parse yt-dlp progress output (Phase 1 UI/UX)
function parseYtDlpProgress(output) {
  // Example: [download]  50.0% of 10.5MiB at 1.2MiB/s ETA 00:05
  const percentMatch = output.match(/(\d+\.?\d*)%/);
  const speedMatch = output.match(/at\s+([\d.]+\w+\/s)/);
  const etaMatch = output.match(/ETA\s+(\d+:\d+)/);

  return {
    progress: percentMatch ? parseFloat(percentMatch[1]) : null,
    speed: speedMatch ? speedMatch[1] : null,
    eta: etaMatch ? etaMatch[1] : null
  };
}

// Helper function to execute download with progress tracking (Phase 1 UI/UX)
async function executeDownloadWithProgress(downloadId, ytDlp, args) {
  return new Promise((resolve, reject) => {
    progressTracker.updateStatus(downloadId, 'downloading');

    ytDlp.exec(args)
      .on('progress', (progress) => {
        // progress is the raw yt-dlp stdout
        const parsed = parseYtDlpProgress(progress.toString());

        if (parsed.progress !== null) {
          progressTracker.updateProgress(downloadId, {
            progress: parsed.progress,
            speed: parsed.speed || 'calculating...',
            eta: parsed.eta || 'calculating...',
            status: 'downloading'
          });
        }
      })
      .on('ytDlpEvent', (eventType, eventData) => {
        logger.info(`yt-dlp event: ${eventType}`, eventData);
      })
      .on('error', (error) => {
        logger.error(`Download error for ${downloadId}:`, error);
        reject(error);
      })
      .on('close', () => {
        logger.info(`Download completed for ${downloadId}`);
        resolve();
      });
  });
}

// Single file download endpoint with progress tracking (Phase 1 UI/UX)
app.post("/download", speedLimiter, downloadLimiter, validateDownloadRequest, asyncHandler(async (req, res) => {
  const { validatedUrl, validatedFormat, validatedCustomName } = req.body;

  // Create download ID and return immediately
  const downloadId = progressTracker.createDownload();

  // Return download ID so frontend can connect to SSE
  res.json({ downloadId });

  // Continue download in background
  (async () => {
    try {
      const ytDlp = createYtDlp();

      // Already normalized by the validator, but keep it explicit for URLs that
      // reach this handler from elsewhere.
      const normalizedUrl = normalizeYouTubeUrl(validatedUrl);

      progressTracker.updateStatus(downloadId, 'fetching_metadata', 'Fetching video information...');
      const metadata = await getVideoMetadata(ytDlp, normalizedUrl);
      const videoTitle = metadata.title || "downloaded";

      const outputName = validatedCustomName || sanitize(videoTitle);
      const outputFile = path.resolve(__dirname, config.download.directory, `${outputName}.${validatedFormat}`);

      logger.info(`Starting download ${downloadId}: ${videoTitle} as ${validatedFormat}`);

      // Execute download with progress tracking. The output path is exact, so
      // yt-dlp must not rewrite the filename (the download token depends on it).
      const args = buildAudioDownloadArgs(normalizedUrl, outputFile, validatedFormat, {
        restrictFilenames: false,
        noOverwrites: false
      });

      await executeDownloadWithProgress(downloadId, ytDlp, args);

      logger.info(`Download complete ${downloadId}: ${outputFile}`);

      // Generate download token for secure access
      const filename = `${outputName}.${validatedFormat}`;
      const token = generateDownloadToken(filename);

      // Mark download as complete with result
      progressTracker.completeDownload(downloadId, {
        file: filename,
        downloadUrl: `/downloads/${filename}?token=${token}`,
        message: "Download complete"
      });

    } catch (err) {
      const { code, message, raw } = classifyYtDlpError(err);
      logger.error(`Download failed ${downloadId}: ${message}`, { code, raw });
      progressTracker.failDownload(downloadId, new DownloadError(message, code));
    }
  })();
}));

// Sleep helper used to pace consecutive downloads (avoids YouTube rate limiting)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Counts the files produced by a download so we never zip an empty folder
async function countFiles(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    return files.length;
  } catch (err) {
    return 0;
  }
}

// Playlist download endpoint with full security and error handling (2.3 - race conditions fixed)
app.post("/download/playlist", speedLimiter, downloadLimiter, validatePlaylistRequest, asyncHandler(async (req, res) => {
  const { validatedUrl, validatedFormat } = req.body;

  const ytDlp = createYtDlp();

  let metadata;
  try {
    metadata = await getVideoMetadata(ytDlp, validatedUrl, { flatPlaylist: true });
  } catch (err) {
    const { code, message, raw } = classifyYtDlpError(err);
    logger.error(`Failed to read playlist metadata: ${message}`, { code, raw });
    throw new DownloadError(`Failed to read playlist: ${message}`, code);
  }

  const playlistTitle = metadata.playlist_title || metadata.title || "playlist";
  const sanitizedTitle = sanitize(playlistTitle);

  // Use timestamp to avoid collisions (2.3)
  const timestamp = Date.now();
  const uniqueDir = `${sanitizedTitle}-${timestamp}`;
  const outputDir = path.resolve(__dirname, config.download.directory, uniqueDir);

  // Create directory
  await fs.mkdir(outputDir, { recursive: true });

  const outputFile = path.resolve(outputDir, "%(title)s.%(ext)s");

  // "--yes-playlist" because the URL is a playlist on purpose here, and
  // "--ignore-errors" so a single blocked track does not abort the whole playlist.
  const args = [
    validatedUrl,
    "-o",
    outputFile,
    "-x",
    "--audio-format",
    validatedFormat,
    "--yes-playlist",
    "--ignore-errors",
    "--restrict-filenames",
    "--no-overwrites",
    "--continue",
    ...buildCommonArgs()
  ];

  logger.info(`Starting playlist download: ${playlistTitle}`);

  let downloadError = null;
  try {
    await ytDlp.execPromise(args);
    logger.info(`Playlist download complete: ${playlistTitle}`);
  } catch (err) {
    // With --ignore-errors yt-dlp still exits non-zero when some tracks failed,
    // so check what actually landed on disk before giving up.
    downloadError = classifyYtDlpError(err);
    logger.error(`Playlist download reported errors: ${downloadError.message}`, {
      code: downloadError.code,
      raw: downloadError.raw
    });
  }

  const downloadedCount = await countFiles(outputDir);

  if (downloadedCount === 0) {
    await cleanupDirectory(outputDir);
    const { code, message } = downloadError || {
      code: ErrorCodes.DOWNLOAD_FAILED,
      message: "yt-dlp did not download any track"
    };
    throw new DownloadError(`Failed to download playlist: ${message}`, code);
  }

  if (downloadError) {
    logger.warn(`Playlist ${playlistTitle}: ${downloadedCount} track(s) downloaded, some failed`);
  }

  // Create zip file
  const zipFilePath = path.resolve(__dirname, config.download.directory, `${uniqueDir}.zip`);
  await createZipFile(outputDir, zipFilePath);

  // Clean up directory AFTER zip is complete (2.3 - fixes race condition)
  await cleanupDirectory(outputDir);

  // Generate download token
  const filename = `${uniqueDir}.zip`;
  const token = generateDownloadToken(filename);

  res.json({
    message: downloadError
      ? `Playlist partially downloaded (${downloadedCount} track(s), some failed: ${downloadError.message})`
      : `Playlist download complete (${downloadedCount} track(s))`,
    file: filename,
    downloadUrl: `/downloads/${filename}?token=${token}`,
    downloaded: downloadedCount,
    partial: Boolean(downloadError)
  });
}));

// Multiple URLs download endpoint with full security and error handling (2.3 - race conditions fixed)
app.post("/download/list", speedLimiter, downloadLimiter, validateMultiDownloadRequest, asyncHandler(async (req, res) => {
  const { validatedUrls, validatedFormat } = req.body;

  const ytDlp = createYtDlp();

  // Use timestamp to avoid collisions (2.3)
  const timestamp = Date.now();
  const uniqueDir = `multiple-${timestamp}`;
  const outputDir = path.resolve(__dirname, config.download.directory, uniqueDir);

  // Create directory
  await fs.mkdir(outputDir, { recursive: true });

  const outputFile = path.resolve(outputDir, "%(title)s.%(ext)s");

  logger.info(`Starting multi-download: ${validatedUrls.length} URLs`);

  // One yt-dlp process per URL: a single blocked track (403, private video, ...)
  // used to kill the whole batch and leave the user with nothing.
  const succeeded = [];
  const failed = [];

  for (const [index, url] of validatedUrls.entries()) {
    const args = buildAudioDownloadArgs(url, outputFile, validatedFormat);

    try {
      // Per-track timeout so one stuck download cannot hang the whole request
      await ytDlp.execPromise(args, { timeout: config.ytdlp.timeout });
      succeeded.push(url);
      logger.info(`Downloaded ${index + 1}/${validatedUrls.length}: ${url}`);
    } catch (err) {
      const { code, message, raw } = classifyYtDlpError(err);
      failed.push({ url, code, message });
      logger.error(`Failed ${index + 1}/${validatedUrls.length} (${url}): ${message}`, { code, raw });
    }

    // Pace the batch so YouTube does not treat it as scraping
    if (index < validatedUrls.length - 1 && config.ytdlp.delayBetweenDownloads > 0) {
      await delay(config.ytdlp.delayBetweenDownloads);
    }
  }

  const downloadedCount = await countFiles(outputDir);

  if (downloadedCount === 0) {
    await cleanupDirectory(outputDir);
    const { code, message } = summarizeFailures(failed);
    logger.error(`Multi-download failed: 0/${validatedUrls.length} downloaded (${code})`);
    throw new DownloadError(
      `None of the ${validatedUrls.length} URLs could be downloaded. ${message}`,
      code
    );
  }

  logger.info(`Multi-download finished: ${succeeded.length}/${validatedUrls.length} URLs`);

  // Create zip file
  const zipFilePath = path.resolve(__dirname, config.download.directory, `${uniqueDir}.zip`);
  await createZipFile(outputDir, zipFilePath);

  // Clean up directory AFTER zip is complete (2.3 - fixes race condition)
  await cleanupDirectory(outputDir);

  // Generate download token
  const filename = `${uniqueDir}.zip`;
  const token = generateDownloadToken(filename);

  res.json({
    message: failed.length
      ? `Downloaded ${succeeded.length} of ${validatedUrls.length} tracks (${failed.length} failed)`
      : `Downloaded ${succeeded.length} of ${validatedUrls.length} tracks`,
    file: filename,
    downloadUrl: `/downloads/${filename}?token=${token}`,
    total: validatedUrls.length,
    succeeded: succeeded.length,
    partial: failed.length > 0,
    failed
  });
}));

// Serve downloaded files with authentication (1.3)
// Force "Content-Disposition: attachment" so browsers download the file instead
// of playing/opening it inline. This is required because the frontend and backend
// run on different origins (different ports), and the HTML5 `download` attribute on
// <a> tags is ignored for cross-origin URLs.
app.use("/downloads", authenticateDownload, express.static(path.join(__dirname, config.download.directory), {
  setHeaders: (res, filePath) => {
    const filename = path.basename(filePath);
    // RFC 5987 encoding for non-ASCII filenames, with an ASCII fallback.
    const asciiFallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
  }
}));

// Error handlers (must be last) (2.1)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(config.port, config.host, async () => {
  logger.info(`Backend running on http://${config.host}:${config.port}`);
  logger.info(`Environment: ${config.env}`);

  // Surface an outdated/missing yt-dlp at boot instead of at the first HTTP 403
  await logYtDlpVersion();

  // Create downloads folder if it doesn't exist
  const downloadsDir = path.resolve(__dirname, config.download.directory);
  try {
    if (!fsSync.existsSync(downloadsDir)) {
      await fs.mkdir(downloadsDir, { recursive: true });
      logger.info(`Created downloads directory: ${downloadsDir}`);
    } else {
      // Clear the downloads folder on startup (2.3 - using promises)
      const files = await fs.readdir(downloadsDir);
      for (const file of files) {
        const filePath = path.join(downloadsDir, file);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          await fs.rm(filePath, { recursive: true }).catch(err => {
            logger.error(`Failed to remove directory ${filePath}:`, err);
          });
        } else {
          await fs.unlink(filePath).catch(err => {
            logger.error(`Failed to remove file ${filePath}:`, err);
          });
        }
      }
      logger.info('Cleaned downloads directory on startup');
    }
  } catch (err) {
    logger.error('Error during startup cleanup:', err);
  }
});

// Graceful shutdown handlers (2.4)
process.on('SIGTERM', gracefulShutdown(server, 'SIGTERM'));
process.on('SIGINT', gracefulShutdown(server, 'SIGINT'));
