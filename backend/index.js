const express = require("express");
const YtDlpWrap = require("yt-dlp-wrap").default;
const sanitize = require("sanitize-filename");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const port = 5000;

app.use(cors()); // Allow frontend requests
app.use(express.json());

app.post("/download", async (req, res) => {
  const { url, customName } = req.body;

  if (!url) {
    return res.status(400).json({ error: "YouTube URL is required" });
  }

  try {
    const ytDlp = new YtDlpWrap("yt-dlp");
    const metadata = await ytDlp.getVideoInfo(url);
    const videoTitle = metadata.title || "downloaded";

    const outputName = customName ? sanitize(customName) : sanitize(videoTitle);
    const outputFile = path.resolve(__dirname, "downloads", `${outputName}.mp3`);

    await ytDlp.execPromise([url, "-x", "--audio-format", "mp3", "-o", outputFile]);

    res.json({ message: "Download complete", file: `${outputName}.mp3` });
  } catch (err) {
    res.status(500).json({ error: `Failed to download: ${err.message}` });
  }
});

// Serve downloaded files
app.use("/downloads", express.static(path.join(__dirname, "downloads")));

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
  // Create downloads folder if it doesn't exist
  if (!fs.existsSync("downloads")) {
    fs.mkdirSync("downloads");
  }
});
