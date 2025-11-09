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

// Single file download endpoint with full security and error handling (1.1, 1.3, 1.5, 2.1)
app.post("/download", speedLimiter, downloadLimiter, validateDownloadRequest, asyncHandler(async (req, res) => {
  const { validatedUrl, validatedFormat, validatedCustomName } = req.body;

  const ytDlp = new YtDlpWrap("yt-dlp");

  // Normalize URL to avoid youtube music issue
  const normalizedUrl = validatedUrl.replace("music.youtube.com", "www.youtube.com");

  const metadata = await ytDlp.getVideoInfo(normalizedUrl);
  const videoTitle = metadata.title || "downloaded";

  const outputName = validatedCustomName || sanitize(videoTitle);
  const outputFile = path.resolve(__dirname, config.download.directory, `${outputName}.${validatedFormat}`);

  logger.info(`Starting download: ${videoTitle} as ${validatedFormat}`);

  try {
    await ytDlp.execPromise([normalizedUrl, "-x", "--audio-format", validatedFormat, "-o", outputFile]);
    logger.info(`Download complete: ${outputFile}`);
  } catch (err) {
    logger.error(`Download failed: ${err.message}`);
    throw new DownloadError(`Failed to download: ${err.message}`);
  }

  // Generate download token for secure access (1.3)
  const filename = `${outputName}.${validatedFormat}`;
  const token = generateDownloadToken(filename);

  res.json({
    message: "Download complete",
    file: filename,
    downloadUrl: `/downloads/${filename}?token=${token}`
  });
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
