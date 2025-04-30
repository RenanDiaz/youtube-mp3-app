const express = require("express");
const YtDlpWrap = require("yt-dlp-wrap").default;
const sanitize = require("sanitize-filename");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const cors = require("cors");

const app = express();
const port = 5001;
const defaultFormat = "mp3";

app.use(cors()); // Allow frontend requests
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

app.post("/download", async (req, res) => {
  const { url, customName, format: formatExt = defaultFormat } = req.body;

  if (!url) {
    return res.status(400).json({ error: "YouTube URL is required" });
  }

  try {
    const ytDlp = new YtDlpWrap("yt-dlp");
    const metadata = await ytDlp.getVideoInfo(url);
    const videoTitle = metadata.title || "downloaded";

    const outputName = customName ? sanitize(customName) : sanitize(videoTitle);
    const outputFile = path.resolve(__dirname, "downloads", `${outputName}.${formatExt}`);

    await ytDlp.execPromise([url, "-x", "--audio-format", formatExt, "-o", outputFile]);

    res.json({ message: "Download complete", file: `${outputName}.${formatExt}` });
  } catch (err) {
    res.status(500).json({ error: `Failed to download: ${err.message}` });
  }
});

app.post("/download/playlist", async (req, res) => {
  const { url, format: formatExt = defaultFormat } = req.body;
  if (!url) {
    return res.status(400).json({ error: "YouTube playlist URL is required" });
  }
  try {
    const ytDlp = new YtDlpWrap("yt-dlp");
    const metadata = await ytDlp.getVideoInfo(url);
    const playlistTitle = metadata.title || "playlist";
    const outputDir = path.resolve(__dirname, "downloads", sanitize(playlistTitle));
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputFile = path.resolve(outputDir, "%(title)s.%(ext)s");

    const args = [
      url,
      "-o",
      outputFile,
      "-x",
      "--audio-format",
      formatExt,
      "--restrict-filenames",
      "--no-overwrites",
      "--continue",
    ];
    await ytDlp.execPromise(args);

    // Zip the downloaded files
    const zipFilePath = path.resolve(__dirname, "downloads", `${playlistTitle}.zip`);
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
    fs.rmdir(outputDir, { recursive: true }, (err) => {
      if (err) throw err;
    });
    res.json({ message: "Playlist download complete", file: `${playlistTitle}.zip` });
  } catch (err) {
    res.status(500).json({ error: `Failed to download playlist: ${err.message}` });
  }
});

app.post("/download/list", async (req, res) => {
  const { urls, format: formatExt = defaultFormat } = req.body;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "YouTube URLs are required" });
  }
  try {
    const ytDlp = new YtDlpWrap("yt-dlp");
    const outputDir = path.resolve(__dirname, "downloads", "multiple-downloads");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputFile = path.resolve(outputDir, "%(title)s.%(ext)s");

    const args = [
      ...urls,
      "-o",
      outputFile,
      "-x",
      "--audio-format",
      formatExt,
      "--restrict-filenames",
      "--no-overwrites",
      "--continue",
    ];
    await ytDlp.execPromise(args);
    // Zip the downloaded files
    const zipFilePath = path.resolve(__dirname, "downloads", `multiple-downloads.zip`);
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
    fs.rmdir(outputDir, { recursive: true }, (err) => {
      if (err) throw err;
    });
    res.json({ message: "Multiple downloads complete", file: `multiple-downloads` });
  } catch (err) {
    res.status(500).json({ error: `Failed to download list: ${err.message}` });
  }
});

// Serve downloaded files
app.use("/downloads", express.static(path.join(__dirname, "downloads")));

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
  // Create downloads folder if it doesn't exist
  if (!fs.existsSync("downloads")) {
    fs.mkdirSync("downloads");
  } else {
    // Clear the downloads folder
    fs.readdir("downloads", (err, files) => {
      if (err) throw err;
      for (const file of files) {
        const filePath = path.join("downloads", file);
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
