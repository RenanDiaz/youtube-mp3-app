const express = require("express");
const YtDlpWrap = require("yt-dlp-wrap").default;
const sanitize = require("sanitize-filename");
const fs = require("fs");
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

// Apply general rate limiting (1.5)
app.use(apiLimiter);

// Health check (no authentication required)
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// Single file download endpoint with full security (1.1, 1.3, 1.5)
app.post("/download", speedLimiter, downloadLimiter, validateDownloadRequest, async (req, res) => {
  const { validatedUrl, validatedFormat, validatedCustomName } = req.body;

  try {
    const ytDlp = new YtDlpWrap("yt-dlp");

    // Normalize URL to avoid youtube music issue
    const normalizedUrl = validatedUrl.replace("music.youtube.com", "www.youtube.com");

    const metadata = await ytDlp.getVideoInfo(normalizedUrl);
    const videoTitle = metadata.title || "downloaded";

    const outputName = validatedCustomName || sanitize(videoTitle);
    const outputFile = path.resolve(__dirname, config.download.directory, `${outputName}.${validatedFormat}`);

    await ytDlp.execPromise([normalizedUrl, "-x", "--audio-format", validatedFormat, "-o", outputFile]);

    // Generate download token for secure access (1.3)
    const filename = `${outputName}.${validatedFormat}`;
    const token = generateDownloadToken(filename);

    res.json({
      message: "Download complete",
      file: filename,
      downloadUrl: `/downloads/${filename}?token=${token}`
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to download: ${err.message}` });
  }
});

// Playlist download endpoint with full security
app.post("/download/playlist", speedLimiter, downloadLimiter, validatePlaylistRequest, async (req, res) => {
  const { validatedUrl, validatedFormat } = req.body;

  try {
    const ytDlp = new YtDlpWrap("yt-dlp");
    const metadata = await ytDlp.getVideoInfo(validatedUrl);
    const playlistTitle = metadata.title || "playlist";
    const sanitizedTitle = sanitize(playlistTitle);
    const outputDir = path.resolve(__dirname, config.download.directory, sanitizedTitle);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

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

    // Zip the downloaded files
    const zipFilePath = path.resolve(__dirname, config.download.directory, `${sanitizedTitle}.zip`);
    const zip = new AdmZip();
    zip.addLocalFolder(outputDir);
    zip.writeZip(zipFilePath);

    // Remove the individual files after zipping
    fs.readdir(outputDir, (err, files) => {
      if (err) throw err;
      for (const file of files) {
        fs.unlink(path.join(outputDir, file), (err) => {
          if (err) throw err;
        });
      }
    });

    // Remove the output directory after zipping
    fs.rm(outputDir, { recursive: true }, (err) => {
      if (err) throw err;
    });

    // Generate download token
    const filename = `${sanitizedTitle}.zip`;
    const token = generateDownloadToken(filename);

    res.json({
      message: "Playlist download complete",
      file: filename,
      downloadUrl: `/downloads/${filename}?token=${token}`
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to download playlist: ${err.message}` });
  }
});

// Multiple URLs download endpoint with full security
app.post("/download/list", speedLimiter, downloadLimiter, validateMultiDownloadRequest, async (req, res) => {
  const { validatedUrls, validatedFormat } = req.body;

  try {
    const ytDlp = new YtDlpWrap("yt-dlp");
    const outputDir = path.resolve(__dirname, config.download.directory, "multiple-downloads");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

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

    await ytDlp.execPromise(args);

    // Zip the downloaded files
    const zipFilePath = path.resolve(__dirname, config.download.directory, "multiple-downloads.zip");
    const zip = new AdmZip();
    zip.addLocalFolder(outputDir);
    zip.writeZip(zipFilePath);

    // Remove the individual files after zipping
    fs.readdir(outputDir, (err, files) => {
      if (err) throw err;
      for (const file of files) {
        fs.unlink(path.join(outputDir, file), (err) => {
          if (err) throw err;
        });
      }
    });

    // Remove the output directory after zipping
    fs.rm(outputDir, { recursive: true }, (err) => {
      if (err) throw err;
    });

    // Generate download token
    const filename = "multiple-downloads.zip";
    const token = generateDownloadToken(filename);

    res.json({
      message: "Multiple downloads complete",
      file: filename,
      downloadUrl: `/downloads/${filename}?token=${token}`
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to download list: ${err.message}` });
  }
});

// Serve downloaded files with authentication (1.3)
app.use("/downloads", authenticateDownload, express.static(path.join(__dirname, config.download.directory)));

// Start server
app.listen(config.port, config.host, () => {
  console.log(`Backend running on http://${config.host}:${config.port}`);
  console.log(`Environment: ${config.env}`);

  // Create downloads folder if it doesn't exist
  const downloadsDir = path.resolve(__dirname, config.download.directory);
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
    console.log(`Created downloads directory: ${downloadsDir}`);
  } else {
    // Clear the downloads folder on startup
    fs.readdir(downloadsDir, (err, files) => {
      if (err) throw err;
      for (const file of files) {
        const filePath = path.join(downloadsDir, file);
        fs.stat(filePath, (statErr, stats) => {
          if (statErr) throw statErr;
          if (stats.isDirectory()) {
            fs.rm(filePath, { recursive: true }, (rmErr) => {
              if (rmErr) throw rmErr;
            });
          } else {
            fs.unlink(filePath, (unlinkErr) => {
              if (unlinkErr) throw unlinkErr;
            });
          }
        });
      }
    });
  }
});
