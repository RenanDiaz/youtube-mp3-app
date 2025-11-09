const express = require("express");
const YtDlpWrap = require("yt-dlp-wrap").default;
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
const { DownloadError } = require("./src/utils/errors");
const gracefulShutdown = require("./src/utils/shutdown");

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

  const ytDlp = new YtDlpWrap("yt-dlp");

  // Normalize URL
  const normalizedUrl = url.replace("music.youtube.com", "www.youtube.com");

  try {
    // Get video metadata without downloading
    const metadata = await ytDlp.getVideoInfo(normalizedUrl);

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

    // Determine error type
    const errorMessage = err.message || '';
    let code = 'DOWNLOAD_FAILED';
    let message = 'Failed to validate URL';

    if (errorMessage.includes('not available') || errorMessage.includes('private')) {
      code = 'VIDEO_UNAVAILABLE';
      message = 'This video is unavailable, private, or restricted';
    } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      code = 'NETWORK_ERROR';
      message = 'Network error occurred while validating URL';
    } else if (errorMessage.includes('format')) {
      code = 'INVALID_URL';
      message = 'Invalid YouTube URL format';
    }

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
      const ytDlp = new YtDlpWrap("yt-dlp");

      // Normalize URL to avoid youtube music issue
      const normalizedUrl = validatedUrl.replace("music.youtube.com", "www.youtube.com");

      progressTracker.updateStatus(downloadId, 'fetching_metadata', 'Fetching video information...');
      const metadata = await ytDlp.getVideoInfo(normalizedUrl);
      const videoTitle = metadata.title || "downloaded";

      const outputName = validatedCustomName || sanitize(videoTitle);
      const outputFile = path.resolve(__dirname, config.download.directory, `${outputName}.${validatedFormat}`);

      logger.info(`Starting download ${downloadId}: ${videoTitle} as ${validatedFormat}`);

      // Execute download with progress tracking
      const args = [
        normalizedUrl,
        "-x",
        "--audio-format", validatedFormat,
        "-o", outputFile,
        "--newline" // Force progress on new lines for easier parsing
      ];

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
      logger.error(`Download failed ${downloadId}:`, err);
      progressTracker.failDownload(downloadId, err);
    }
  })();
}));

// Playlist download endpoint with full security and error handling (2.3 - race conditions fixed)
app.post("/download/playlist", speedLimiter, downloadLimiter, validatePlaylistRequest, asyncHandler(async (req, res) => {
  const { validatedUrl, validatedFormat } = req.body;

  const ytDlp = new YtDlpWrap("yt-dlp");
  const metadata = await ytDlp.getVideoInfo(validatedUrl);
  const playlistTitle = metadata.title || "playlist";
  const sanitizedTitle = sanitize(playlistTitle);

  // Use timestamp to avoid collisions (2.3)
  const timestamp = Date.now();
  const uniqueDir = `${sanitizedTitle}-${timestamp}`;
  const outputDir = path.resolve(__dirname, config.download.directory, uniqueDir);

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

  logger.info(`Starting playlist download: ${playlistTitle}`);

  try {
    await ytDlp.execPromise(args);
    logger.info(`Playlist download complete: ${playlistTitle}`);
  } catch (err) {
    logger.error(`Playlist download failed: ${err.message}`);
    throw new DownloadError(`Failed to download playlist: ${err.message}`);
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
    message: "Playlist download complete",
    file: filename,
    downloadUrl: `/downloads/${filename}?token=${token}`
  });
}));

// Multiple URLs download endpoint with full security and error handling (2.3 - race conditions fixed)
app.post("/download/list", speedLimiter, downloadLimiter, validateMultiDownloadRequest, asyncHandler(async (req, res) => {
  const { validatedUrls, validatedFormat } = req.body;

  const ytDlp = new YtDlpWrap("yt-dlp");

  // Use timestamp to avoid collisions (2.3)
  const timestamp = Date.now();
  const uniqueDir = `multiple-${timestamp}`;
  const outputDir = path.resolve(__dirname, config.download.directory, uniqueDir);

  // Create directory
  await fs.mkdir(outputDir, { recursive: true });

  const outputFile = path.resolve(outputDir, "%(title)s.%(ext)s");

  const args = [
    ...validatedUrls,
    "-o",
    outputFile,
    "-x",
    "--audio-format",
    validatedFormat,
    "--restrict-filenames",
    "--no-overwrites",
    "--continue",
  ];

  logger.info(`Starting multi-download: ${validatedUrls.length} URLs`);

  try {
    await ytDlp.execPromise(args);
    logger.info(`Multi-download complete: ${validatedUrls.length} URLs`);
  } catch (err) {
    logger.error(`Multi-download failed: ${err.message}`);
    throw new DownloadError(`Failed to download list: ${err.message}`);
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
    message: "Multiple downloads complete",
    file: filename,
    downloadUrl: `/downloads/${filename}?token=${token}`
  });
}));

// Serve downloaded files with authentication (1.3)
app.use("/downloads", authenticateDownload, express.static(path.join(__dirname, config.download.directory)));

// Error handlers (must be last) (2.1)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(config.port, config.host, async () => {
  logger.info(`Backend running on http://${config.host}:${config.port}`);
  logger.info(`Environment: ${config.env}`);

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
