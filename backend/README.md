# YouTube to Audio Downloader - Backend

Express.js backend API for downloading audio from YouTube videos, playlists, and multiple URLs using yt-dlp.

## 🚀 Tech Stack

- **Node.js** - JavaScript runtime
- **Express 5.1.0** - Web framework
- **yt-dlp-wrap 2.3.14** - YouTube download library (wrapper for yt-dlp)
- **AdmZip 0.5.16** - ZIP file creation
- **sanitize-filename 1.6.3** - Filename sanitization
- **CORS 2.8.5** - Cross-origin resource sharing

## 📋 Prerequisites

### Required Software

1. **Node.js 18+** (recommended: 20+)
   ```bash
   node --version  # Should be v18.0.0 or higher
   ```

2. **yt-dlp** - Command-line tool for downloading videos

   **macOS (Homebrew):**
   ```bash
   brew install yt-dlp
   ```

   **macOS (Direct):**
   ```bash
   # Download binary
   sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
   sudo chmod a+rx /usr/local/bin/yt-dlp
   ```

   **Linux:**
   ```bash
   sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
   sudo chmod a+rx /usr/local/bin/yt-dlp
   ```

   **Windows:**
   ```powershell
   # Using winget
   winget install yt-dlp

   # Or download from: https://github.com/yt-dlp/yt-dlp/releases
   ```

   **Verify installation:**
   ```bash
   yt-dlp --version
   ```

3. **ffmpeg** - Audio/video processing (required for format conversion)

   **macOS:**
   ```bash
   brew install ffmpeg
   ```

   **Linux (Ubuntu/Debian):**
   ```bash
   sudo apt update
   sudo apt install ffmpeg
   ```

   **Windows:**
   ```powershell
   # Using winget
   winget install ffmpeg

   # Or download from: https://ffmpeg.org/download.html
   ```

   **Verify installation:**
   ```bash
   ffmpeg -version
   ```

## 🏃 Quick Start

### Installation

```bash
# Install dependencies
npm install
```

### Running

```bash
# Start server
node index.js

# Server will be available at http://localhost:5001
```

### Development with Auto-Restart

```bash
# Install nodemon globally (optional)
npm install -g nodemon

# Run with auto-restart
nodemon index.js
```

## 📡 API Documentation

Base URL: `http://localhost:5001`

### Health Check

**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "OK"
}
```

**Example:**
```bash
curl http://localhost:5001/health
```

---

### Single Video Download

**POST** `/download`

Download a single YouTube video as audio.

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "customName": "my-audio-file",  // Optional
  "format": "mp3"                  // Optional: mp3, wav, m4a, flac (default: mp3)
}
```

**Response:**
```json
{
  "message": "Download complete",
  "file": "my-audio-file.mp3"
}
```

**Example:**
```bash
curl -X POST http://localhost:5001/download \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "customName": "never-gonna-give-you-up",
    "format": "mp3"
  }'
```

**Download the file:**
```
http://localhost:5001/downloads/never-gonna-give-you-up.mp3
```

---

### Playlist Download

**POST** `/download/playlist`

Download an entire YouTube playlist as audio files in a ZIP archive.

**Request Body:**
```json
{
  "url": "https://www.youtube.com/playlist?list=PLAYLIST_ID",
  "format": "mp3"  // Optional: mp3, wav, m4a, flac (default: mp3)
}
```

**Response:**
```json
{
  "message": "Playlist download complete",
  "file": "playlist-name.zip"
}
```

**Example:**
```bash
curl -X POST http://localhost:5001/download/playlist \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
    "format": "mp3"
  }'
```

**Download the ZIP:**
```
http://localhost:5001/downloads/playlist-name.zip
```

---

### Multiple URLs Download

**POST** `/download/list`

Download multiple YouTube videos as audio files in a ZIP archive.

**Request Body:**
```json
{
  "urls": [
    "https://www.youtube.com/watch?v=VIDEO_ID_1",
    "https://www.youtube.com/watch?v=VIDEO_ID_2",
    "https://www.youtube.com/watch?v=VIDEO_ID_3"
  ],
  "format": "mp3"  // Optional: mp3, wav, m4a, flac (default: mp3)
}
```

Each URL is downloaded by its own `yt-dlp` process, so one blocked or private
track no longer aborts the whole batch. The ZIP contains everything that could be
downloaded and the response lists what failed. The request only fails (500) when
*no* track could be downloaded.

**Response:**
```json
{
  "message": "Downloaded 18 of 20 tracks (2 failed)",
  "file": "multiple-1786753104087.zip",
  "downloadUrl": "/downloads/multiple-1786753104087.zip?token=...",
  "total": 20,
  "succeeded": 18,
  "partial": true,
  "failed": [
    {
      "url": "https://www.youtube.com/watch?v=VIDEO_ID",
      "code": "YOUTUBE_FORBIDDEN",
      "message": "YouTube rejected the request (HTTP 403). ..."
    }
  ]
}
```

**Example:**
```bash
curl -X POST http://localhost:5001/download/list \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=9bZkp7q19f0"
    ],
    "format": "mp3"
  }'
```

**Download the ZIP:**
```
http://localhost:5001/downloads/multiple-downloads.zip
```

---

### Static File Serving

**GET** `/downloads/:filename`

Serve downloaded audio files.

**Example:**
```bash
# Download file
curl -O http://localhost:5001/downloads/my-audio-file.mp3
```

**Note:** Files are cleared when the server restarts.

---

### Diagnostics

**GET** `/diagnostics`

Reports the yt-dlp version, how old it is, and which anti-403 settings are active.
This is the first thing to check when downloads start failing.

```bash
curl http://localhost:5001/diagnostics
```

```json
{
  "ytDlp": { "available": true, "version": "2026.07.04", "ageDays": 42, "stale": false },
  "settings": {
    "playerClients": "(yt-dlp default)",
    "cookiesConfigured": false,
    "sleepRequests": 1,
    "delayBetweenDownloads": 1500,
    "retries": 5
  }
}
```

---

## ⛔ Troubleshooting `HTTP Error 403: Forbidden`

`ERROR: unable to download video data: HTTP Error 403: Forbidden` comes from
YouTube, not from this app: YouTube refused to serve the media to yt-dlp. What the
backend does about it:

- **URLs are canonicalized** before reaching yt-dlp. `music.youtube.com` links are
  rewritten to `www.youtube.com`, `youtu.be/<id>` becomes a watch URL, and tracking
  params (`?si=`, `?pp=`, `?feature=`) are stripped. YouTube Music URLs use a
  different InnerTube client that gets blocked much more often.
- **Downloads are isolated and paced**: one process per track, `--sleep-requests`
  between HTTP requests and a delay between tracks.
- **Failures are per track**: a 403 on one video no longer discards the other 19.

When 403s still happen, in order of effectiveness:

1. **Update yt-dlp** — by far the most common cause. YouTube changes break older
   binaries; the server logs a warning at startup when the binary is more than 45
   days old.
   ```bash
   yt-dlp -U            # or: brew upgrade yt-dlp / pip install -U yt-dlp
   ```
2. **Add cookies** from a logged-in browser (fixes 403 and "Sign in to confirm
   you're not a bot"):
   ```bash
   YTDLP_COOKIES_FROM_BROWSER=chrome   # or firefox, safari, brave, edge...
   # or export a cookies.txt and use:
   YTDLP_COOKIES_FILE=./cookies.txt
   ```
   Close the browser first — Chrome locks its cookie database while running.
3. **Change the impersonated client** if the default ones are being rejected:
   ```bash
   YTDLP_PLAYER_CLIENTS=tv,web_safari
   ```
4. **Slow down** if the errors look like rate limiting (HTTP 429, or 403 only on
   large batches):
   ```bash
   YTDLP_SLEEP_REQUESTS=2
   YTDLP_DELAY_BETWEEN_DOWNLOADS_MS=4000
   ```
5. **Check for a VPN/proxy** — datacenter IPs are blocked aggressively by YouTube.

Error codes returned by the API for these cases: `YOUTUBE_FORBIDDEN`,
`YOUTUBE_RATE_LIMITED`, `BOT_CHECK_REQUIRED`, `YTDLP_NOT_FOUND`.

---

## 🎨 Supported Audio Formats

| Format | Extension | Quality | Use Case |
|--------|-----------|---------|----------|
| **MP3** | `.mp3` | Good (320kbps) | Universal compatibility, streaming |
| **WAV** | `.wav` | Lossless | Professional audio, editing |
| **M4A** | `.m4a` | Good | Apple devices, good compression |
| **FLAC** | `.flac` | Lossless | Audiophile quality, archiving |

## ⚙️ Configuration

### Environment Variables

Currently, the server uses hardcoded values. **Recommended:** Move to environment variables.

**Current defaults:**
```javascript
const port = 5001;
const defaultFormat = "mp3";
```

**Recommended `.env` file:**
```env
PORT=5001
DEFAULT_FORMAT=mp3
CORS_ORIGIN=http://localhost:3000
```

### CORS Configuration

Currently allows all origins:
```javascript
app.use(cors()); // Allows all origins - NOT RECOMMENDED for production
```

**For production, restrict CORS:**
```javascript
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true
}));
```

## 📁 Project Structure

```
backend/
├── index.js              # Main application file
├── downloads/            # Downloaded files (auto-created, cleared on restart)
├── package.json          # Dependencies and scripts
├── package-lock.json     # Dependency lock file
└── README.md             # This file
```

### Code Structure in `index.js`

```javascript
// Dependencies
const express = require("express");
const YtDlpWrap = require("yt-dlp-wrap").default;
const sanitize = require("sanitize-filename");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const cors = require("cors");

// Server setup
const app = express();
const port = 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/health", ...);          // Health check
app.post("/download", ...);       // Single download
app.post("/download/playlist", ...); // Playlist download
app.post("/download/list", ...);  // Multi-URL download
app.use("/downloads", ...);       // Static file serving

// Server startup
app.listen(port, ...);
```

## ✅ Security Status

### ✅ Phase 1 Critical Security Fixes - COMPLETED!

**All critical security vulnerabilities have been fixed!** The backend is now **production-ready from a security standpoint**.

**Security Features Implemented (Phase 1):**

1. ✅ **No RCE vulnerability** - Whitelist-based format validation
   - Only allows: mp3, wav, flac, m4a, aac, opus
   - Format parameter cannot be used for command injection

2. ✅ **Access Control** - Download tokens implemented
   - One-time use tokens with 5-minute expiry
   - SHA-256 hashing for security
   - Downloads require valid token in query parameter

3. ✅ **No SSRF vulnerability** - YouTube domain whitelist
   - Only YouTube domains allowed
   - URL validation with domain checking
   - Prevents access to internal services

4. ✅ **Rate Limiting** - Multiple layers of protection
   - General API: 10 requests per 15 minutes
   - Downloads: 5 downloads per 15 minutes per IP
   - Progressive speed limiting

5. ✅ **Security Headers** - Complete Helmet protection
   - Content Security Policy
   - HSTS with preload
   - X-Frame-Options, X-Content-Type-Options
   - And more...

6. ✅ **Secure CORS** - Restricted to configured origins
   - Only allowed origins can access API
   - Configurable via ALLOWED_ORIGINS env variable

**Phase 1 Details:** See [PR #2](https://github.com/RenanDiaz/youtube-mp3-app/pull/2)

### 🔜 Remaining Improvements (Non-Critical)

**Phase 2: Stability & Error Handling** (Recommended)
- Centralized error handling
- Structured logging with Winston
- Fix race conditions in file cleanup
- Graceful shutdown

See `../BACKEND-IMPROVEMENT-PLAN.md` for the full roadmap.

---

## 🐛 Debugging

### VS Code Integration

This project includes VS Code launch configurations.

**To debug:**
1. Open VS Code
2. Go to Run and Debug (Cmd+Shift+D)
3. Select "Backend: Node Server (Debug Mode)"
4. Press F5
5. Set breakpoints in `index.js`

### Logging

Currently uses `console.log()`. For production, use a proper logging library:

```bash
# Install Winston
npm install winston

# Or Pino (faster)
npm install pino
```

## 🧪 Testing

**Currently:** No tests implemented.

**Recommended:** Add tests with Jest or Mocha.

```bash
# Install Jest
npm install --save-dev jest supertest

# Create test file
touch index.test.js
```

**Example test:**
```javascript
const request = require('supertest');
const app = require('./index'); // Export app from index.js

describe('GET /health', () => {
  it('should return OK status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
  });
});
```

## 📦 Dependencies

### Production Dependencies

```json
{
  "express": "^5.1.0",           // Web framework
  "yt-dlp-wrap": "^2.3.14",      // yt-dlp Node.js wrapper
  "adm-zip": "^0.5.16",          // ZIP file creation
  "sanitize-filename": "^1.6.3", // Filename sanitization
  "cors": "^2.8.5"               // CORS middleware
}
```

### Installing Dependencies

```bash
# Production dependencies only
npm install --production

# All dependencies (including dev)
npm install
```

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update all packages
npm update

# Update specific package
npm update express
```

## 🚢 Deployment

### Prerequisites

1. Server with Node.js 18+
2. yt-dlp installed
3. ffmpeg installed
4. Sufficient disk space for downloads

### Production Considerations

**DO NOT deploy as-is.** Address security issues first.

**Minimum requirements:**
1. Input validation (Phase 1 of improvement plan)
2. Access control for downloads
3. Rate limiting
4. Proper error handling
5. Logging

### Process Management

Use PM2 for production:

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start index.js --name youtube-backend

# Auto-restart on reboot
pm2 startup
pm2 save

# Monitor
pm2 status
pm2 logs youtube-backend

# Restart
pm2 restart youtube-backend
```

### Reverse Proxy (Nginx)

**Example Nginx configuration:**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Large file uploads
    client_max_body_size 100M;
}
```

### Environment Variables

```bash
# Set production environment
export NODE_ENV=production
export PORT=5001

# Run
node index.js
```

## 🆘 Troubleshooting

### yt-dlp Not Found

**Error:** `spawn yt-dlp ENOENT`

**Solution:**
```bash
# Check if yt-dlp is installed
which yt-dlp

# If not found, install it (see Prerequisites section)
brew install yt-dlp  # macOS

# Verify installation
yt-dlp --version
```

### ffmpeg Not Found

**Error:** `WARNING: ffmpeg not found`

**Solution:**
```bash
# Install ffmpeg (see Prerequisites section)
brew install ffmpeg  # macOS

# Verify installation
ffmpeg -version
```

### Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::5001`

**Solution:**
```bash
# Find process using port 5001
lsof -i :5001

# Kill the process
kill -9 <PID>
```

### CORS Errors

**Error:** `Access to fetch at 'http://localhost:5001/download' from origin 'http://localhost:3000' has been blocked by CORS policy`

**Solution:**
Make sure CORS middleware is enabled:
```javascript
app.use(cors());

// Or restrict to specific origin:
app.use(cors({
  origin: 'http://localhost:3000'
}));
```

### Download Fails

**Error:** `Failed to download: [error message]`

**Common causes:**
1. Invalid YouTube URL
2. Age-restricted video
3. Private/unavailable video
4. Network issues
5. yt-dlp outdated

**Solutions:**
```bash
# Update yt-dlp
brew upgrade yt-dlp  # macOS
pip install --upgrade yt-dlp  # If installed via pip

# Test URL manually
yt-dlp -x --audio-format mp3 "https://www.youtube.com/watch?v=VIDEO_ID"
```

### YouTube Music URLs

**Issue:** `music.youtube.com` URLs sometimes fail

**Solution:**
The code automatically normalizes `music.youtube.com` to `www.youtube.com`:
```javascript
const normalizedUrl = url.replace("music.youtube.com", "www.youtube.com");
```

### Disk Space Issues

**Error:** `ENOSPC: no space left on device`

**Solution:**
```bash
# Check disk space
df -h

# Clean up downloads folder
rm -rf downloads/*

# Set up automatic cleanup (recommended)
# See BACKEND-IMPROVEMENT-PLAN.md Phase 2
```

### Memory Issues

**Error:** `JavaScript heap out of memory`

**Solution:**
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 index.js

# Or set in PM2
pm2 start index.js --node-args="--max-old-space-size=4096"
```

## 🔄 Development

### Adding New Features

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes to `index.js`**

3. **Test manually:**
   ```bash
   node index.js
   # Test with curl or frontend
   ```

4. **Add tests** (when test framework is set up)

5. **Commit and push:**
   ```bash
   git add .
   git commit -m "feat: add my feature"
   git push origin feature/my-feature
   ```

### Code Style

- **2 spaces** for indentation
- **Use async/await** for asynchronous operations
- **Error handling** with try-catch
- **Descriptive variable names**

### Recommended Improvements

See `../BACKEND-IMPROVEMENT-PLAN.md` for a comprehensive 5-week improvement plan including:

1. **Phase 1:** Critical security fixes
2. **Phase 2:** Stability & error handling
3. **Phase 3:** Code restructuring
4. **Phase 4:** Performance optimization
5. **Phase 5:** Production readiness

## 📚 Learn More

### yt-dlp

- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp)
- [Supported Sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)
- [yt-dlp-wrap npm](https://www.npmjs.com/package/yt-dlp-wrap)

### Express

- [Express Documentation](https://expressjs.com/)
- [Express API Reference](https://expressjs.com/en/5x/api.html)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

### Node.js

- [Node.js Documentation](https://nodejs.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## 📝 License

This project is part of the YouTube MP3 Converter application.

## 🤝 Contributing

1. Review `../BACKEND-IMPROVEMENT-PLAN.md` for planned improvements
2. Address security issues first (Phase 1)
3. Add tests for new features
4. Follow the code style guide
5. Update this README with new features

---

✅ **SECURITY STATUS:** Phase 1 critical security fixes are complete! Backend is now production-ready from a security standpoint. See [PR #2](https://github.com/RenanDiaz/youtube-mp3-app/pull/2) for details.
