# YouTube to Audio Downloader

A full-stack web application for downloading audio from YouTube videos, playlists, and multiple URLs. Features a modern React frontend with Vite and an Express backend powered by yt-dlp.

![Tech Stack](https://img.shields.io/badge/React-19.1.0-61dafb?logo=react)
![Tech Stack](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)
![Tech Stack](https://img.shields.io/badge/Vite-6.4-646cff?logo=vite)
![Tech Stack](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)
![Tech Stack](https://img.shields.io/badge/Express-5.1-000000?logo=express)

## ✨ Features

### 🎵 Single File Download
- Download individual YouTube videos as audio files
- Custom filename support
- Real-time progress indication
- Multiple audio format support

### 📋 Playlist Download
- Download entire YouTube playlists at once
- Automatically packaged as ZIP archive
- Preserves individual track names

### 📚 Multi-URL Download
- Batch download multiple videos
- Enter URLs one per line
- Downloads as ZIP archive
- Format selection for all files

### 🎼 Audio Formats
- **MP3** - Universal compatibility (320kbps)
- **WAV** - Lossless quality
- **M4A** - Optimized for Apple devices
- **FLAC** - Audiophile lossless quality

### 🎨 Modern UI
- Dark theme interface
- Bootstrap 5 responsive design
- Tab-based navigation
- Loading indicators and error handling

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Frontend (React 19 + TypeScript + Vite)                  │
│  Port: 3000                                                │
│                                                             │
│  • SingleFileForm      • PlaylistForm      • MultiFileForm │
│  • Bootstrap UI        • Axios HTTP Client                 │
│                                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP/REST API
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                                                             │
│  Backend (Express + Node.js)                               │
│  Port: 5001                                                │
│                                                             │
│  • /download           • /download/playlist                │
│  • /download/list      • /downloads (static)               │
│                                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ CLI Commands
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                                                             │
│  yt-dlp + ffmpeg (System Dependencies)                     │
│                                                             │
│  • YouTube video extraction                                │
│  • Audio format conversion                                 │
│  • Metadata extraction                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

### System Requirements
- **Node.js 18+** (recommended: 20+)
- **npm 9+** or yarn 1.22+
- **yt-dlp** - YouTube download CLI
- **ffmpeg** - Audio/video processing

### Quick Installation (macOS)

```bash
# Install yt-dlp
brew install yt-dlp

# Install ffmpeg
brew install ffmpeg

# Verify installations
yt-dlp --version
ffmpeg -version
```

### Other Platforms

See detailed installation instructions in:
- [Backend README](./backend/README.md#prerequisites)

## 🚀 Quick Start

### Option 1: VS Code (Easiest) ⭐

1. **Open in VS Code:**
   ```bash
   code .
   ```

2. **Press `F5`** or go to **Run and Debug**

3. **Select:** "Full Stack: Frontend + Backend"

4. **Done!** Both servers start automatically, browser opens at http://localhost:3000

### Option 2: Manual Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/youtube-mp3-app.git
cd youtube-mp3-app
```

#### 2. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

#### 3. Start Backend

```bash
# From backend directory
cd backend
node index.js

# Backend runs on http://localhost:5001
```

#### 4. Start Frontend

```bash
# From frontend directory (in a new terminal)
cd frontend
npm run dev

# Frontend runs on http://localhost:3000
# Opens browser automatically
```

#### 5. Access the Application

Open your browser to: **http://localhost:3000**

## 📁 Project Structure

```
youtube-mp3-app/
├── frontend/                      # React + Vite frontend
│   ├── src/
│   │   ├── components/            # React components
│   │   │   ├── SingleFileForm.tsx
│   │   │   ├── PlaylistForm.tsx
│   │   │   └── MultiFileform.tsx
│   │   ├── App.tsx                # Main app
│   │   ├── main.tsx               # Entry point
│   │   └── config.ts              # Environment config
│   ├── index.html                 # HTML template
│   ├── vite.config.ts             # Vite configuration
│   ├── vitest.config.ts           # Test configuration
│   ├── package.json
│   └── README.md                  # Frontend documentation
│
├── backend/                       # Express backend
│   ├── index.js                   # Main server file
│   ├── downloads/                 # Downloaded files (auto-created)
│   ├── package.json
│   └── README.md                  # Backend documentation
│
├── .vscode/                       # VS Code configuration
│   ├── launch.json                # Debug configurations
│   ├── tasks.json                 # Build tasks
│   ├── settings.json              # Workspace settings
│   ├── extensions.json            # Recommended extensions
│   └── README.md                  # VS Code documentation
│
├── BACKEND-IMPROVEMENT-PLAN.md    # Backend security & improvement plan
├── UI-UX-IMPROVEMENT-PLAN.md      # Frontend enhancement roadmap
├── CRA-TO-VITE-MIGRATION-PLAN.md  # Vite migration documentation
└── README.md                      # This file
```

## 📖 Documentation

- **[Frontend Documentation](./frontend/README.md)** - React, Vite, TypeScript, testing
- **[Backend Documentation](./backend/README.md)** - API docs, security, deployment
- **[VS Code Guide](./.vscode/README.md)** - Debugging, launch configs, tasks
- **[Backend Improvement Plan](./BACKEND-IMPROVEMENT-PLAN.md)** - Security fixes (CRITICAL)
- **[UI/UX Improvement Plan](./UI-UX-IMPROVEMENT-PLAN.md)** - Frontend enhancements
- **[Vite Migration Guide](./CRA-TO-VITE-MIGRATION-PLAN.md)** - CRA → Vite migration notes

## 🎮 Usage

### Single Video Download

1. Select **"Single File"** tab
2. Paste YouTube video URL
3. (Optional) Enter custom filename
4. Select audio format (MP3, WAV, M4A, FLAC)
5. Click **"Download"**
6. File downloads automatically

### Playlist Download

1. Select **"Playlist"** tab
2. Paste YouTube playlist URL
3. Select audio format
4. Click **"Download"**
5. ZIP file downloads with all tracks

### Multiple Videos

1. Select **"Multi File"** tab
2. Enter YouTube URLs (one per line)
3. Select audio format
4. Click **"Download"**
5. ZIP file downloads with all videos

## 🔧 Development

### Frontend Development

```bash
cd frontend

# Start dev server (with HMR)
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npx tsc --noEmit
```

**Details:** See [frontend/README.md](./frontend/README.md)

### Backend Development

```bash
cd backend

# Start server
node index.js

# Start with auto-restart (requires nodemon)
nodemon index.js

# Test endpoints
curl http://localhost:5001/health
```

**Details:** See [backend/README.md](./backend/README.md)

### Full Stack Development (VS Code)

1. **Press F5** → Select "Full Stack: Frontend + Backend"
2. Both servers start with debugging enabled
3. Set breakpoints in VS Code
4. Hot reload on changes

**Details:** See [.vscode/README.md](./.vscode/README.md)

## 🧪 Testing

### Frontend Tests

```bash
cd frontend
npm test                # Run Vitest tests
npm run test:ui         # Interactive test UI
npm run coverage        # Coverage report
```

**Current Status:** 2 passing tests

### Backend Tests

**Current Status:** No tests yet

**Recommended:** Add tests with Jest/Mocha (see [Backend README](./backend/README.md#testing))

## 🚢 Deployment

### Frontend Deployment

The frontend is a static React app that can be deployed to:
- **Vercel** (recommended)
- **Netlify**
- **GitHub Pages**
- **AWS S3 + CloudFront**
- **Firebase Hosting**

```bash
cd frontend
npm run build
# Deploy the build/ folder
```

**See:** [frontend/README.md - Deployment](./frontend/README.md#deployment)

### Backend Deployment

The backend requires:
- Node.js 18+ runtime
- yt-dlp installed
- ffmpeg installed

**⚠️ SECURITY WARNING:** Do not deploy as-is. See [BACKEND-IMPROVEMENT-PLAN.md](./BACKEND-IMPROVEMENT-PLAN.md) for critical security fixes required before production.

**Deployment options:**
- **Heroku** (with buildpacks)
- **AWS EC2** / **DigitalOcean**
- **Railway**
- **Render**
- **Docker** (containerize dependencies)

**See:** [backend/README.md - Deployment](./backend/README.md#deployment)

## 🔐 Security

### ✅ Security Status - Phase 1 Complete!

**Phase 1 (Critical Security Fixes) is now COMPLETE!** 🎉

All critical security vulnerabilities have been fixed:

1. ✅ **No RCE vulnerability** - Whitelist-based format validation
2. ✅ **Access control** - Download tokens (one-time use, 5-min expiry)
3. ✅ **No SSRF vulnerability** - YouTube domain whitelist only
4. ✅ **Rate limiting** - 5 downloads per 15 minutes per IP
5. ✅ **Security headers** - Complete suite via Helmet
6. ✅ **Secure CORS** - Restricted to configured origins

**Status:** Backend is now **production-ready from a security standpoint**

**Implemented features:**
- ✅ Input validation (whitelist formats: mp3, wav, flac, m4a, aac, opus)
- ✅ URL validation (YouTube domains only)
- ✅ Access control (download tokens with expiry)
- ✅ Rate limiting (API-wide and download-specific)
- ✅ Environment configuration with validation
- ✅ Security headers (CSP, HSTS, X-Frame-Options, etc.)

**Details:** See [PR #2 - Phase 1 Critical Backend Security Fixes](https://github.com/RenanDiaz/youtube-mp3-app/pull/2)

### 🔜 Remaining Improvements

While Phase 1 critical security is complete, the following enhancements are recommended:

**Phase 2: Stability & Error Handling**
- Centralized error handling
- Structured logging (Winston)
- Fix race conditions in file cleanup
- Graceful shutdown

See [BACKEND-IMPROVEMENT-PLAN.md](./BACKEND-IMPROVEMENT-PLAN.md) for the full roadmap

## 🛠️ Tech Stack

### Frontend
- **React 19.1.0** - UI library
- **TypeScript 5.9.3** - Type safety
- **Vite 6.4** - Build tool (5-10x faster than CRA)
- **Bootstrap 5.3.5** - UI framework
- **Reactstrap 9.2.3** - React Bootstrap components
- **Axios 1.8.4** - HTTP client
- **Vitest 2.1.9** - Testing framework

### Backend
- **Node.js 18+** - Runtime
- **Express 5.1.0** - Web framework
- **yt-dlp-wrap 2.3.14** - YouTube download wrapper
- **AdmZip 0.5.16** - ZIP creation
- **CORS 2.8.5** - Cross-origin support

### System Dependencies
- **yt-dlp** - YouTube downloader CLI
- **ffmpeg** - Audio/video processing

## 📊 Performance

### Frontend (Vite vs CRA)
- **Dev server startup:** 1-3s (vs 10-20s)
- **Build time:** <1s (vs 30-60s)
- **Hot Module Replacement:** 50-200ms (instant)
- **Bundle size:** 20-30% smaller

### Backend
- **Single download:** ~5-30s (depends on video length)
- **Playlist:** Varies by playlist size
- **Concurrent downloads:** Limited by system resources

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**

2. **Create a feature branch:**
   ```bash
   git checkout -b feature/my-feature
   ```

3. **Make changes and test:**
   ```bash
   # Frontend
   cd frontend && npm run dev && npm test

   # Backend
   cd backend && node index.js
   ```

4. **Run type checking:**
   ```bash
   cd frontend && npx tsc --noEmit
   ```

5. **Commit changes:**
   ```bash
   git commit -m "feat: add my feature"
   ```

6. **Push and create PR:**
   ```bash
   git push origin feature/my-feature
   ```

### Code Style

- **Frontend:** TypeScript, React 19 conventions, Prettier formatting
- **Backend:** JavaScript, async/await, 2-space indentation
- **Commits:** Conventional commits (feat:, fix:, docs:, etc.)

### Priorities

1. **Security fixes** (Phase 1 of Backend Improvement Plan)
2. **Tests** (both frontend and backend)
3. **UI/UX improvements** (from UI/UX Improvement Plan)
4. **Performance optimizations**
5. **New features**

## 🐛 Troubleshooting

### yt-dlp not found
```bash
# Install yt-dlp
brew install yt-dlp  # macOS
# See backend/README.md for other platforms
```

### ffmpeg not found
```bash
# Install ffmpeg
brew install ffmpeg  # macOS
# See backend/README.md for other platforms
```

### Port already in use
```bash
# Kill process on port 3000 or 5001
lsof -i :3000
kill -9 <PID>
```

### CORS errors
- Ensure backend is running on port 5001
- Check CORS configuration in `backend/index.js`
- Verify `VITE_API_BASE_URL` in `frontend/.env`

### Frontend won't start
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Backend crashes
- Check yt-dlp is installed: `yt-dlp --version`
- Check ffmpeg is installed: `ffmpeg -version`
- Check Node.js version: `node --version` (should be 18+)
- Review logs for specific error messages

**See detailed troubleshooting:**
- [Frontend Troubleshooting](./frontend/README.md#troubleshooting)
- [Backend Troubleshooting](./backend/README.md#troubleshooting)

## 📝 License

This project is available for personal and educational use.

## 🙏 Acknowledgments

- **yt-dlp** - The backbone of this application
- **ffmpeg** - Audio/video processing
- **React** - Frontend framework
- **Vite** - Lightning-fast build tool
- **Express** - Backend framework

## 📞 Support

For issues or questions:
1. Check the [Frontend README](./frontend/README.md)
2. Check the [Backend README](./backend/README.md)
3. Review the [VS Code README](./.vscode/README.md)
4. Check troubleshooting sections above
5. Review improvement plans for known issues

## 🗺️ Roadmap

### Phase 1: Security (CRITICAL) ✅ COMPLETED
- [x] Input validation
- [x] Access control with download tokens
- [x] Rate limiting
- [x] Security headers (Helmet)
- [x] Environment configuration
- [x] Secure CORS

**Status:** ✅ **Completed** - All critical security vulnerabilities fixed
**PR:** [#2 Phase 1 - Critical Backend Security Fixes](https://github.com/RenanDiaz/youtube-mp3-app/pull/2)
**See:** [BACKEND-IMPROVEMENT-PLAN.md](./BACKEND-IMPROVEMENT-PLAN.md)

### Phase 2: UI/UX
- [ ] Real-time progress bars
- [ ] URL validation with preview
- [ ] Better error messages
- [ ] Visual design overhaul
- [ ] Mobile optimization

**See:** [UI-UX-IMPROVEMENT-PLAN.md](./UI-UX-IMPROVEMENT-PLAN.md)

### Phase 3: Features
- [ ] Download history
- [ ] Queue management
- [ ] User preferences
- [ ] Download resume
- [ ] Batch operations

### Phase 4: Testing & Quality
- [ ] Backend unit tests
- [ ] Frontend integration tests
- [ ] E2E tests
- [ ] Performance testing
- [ ] Security audits

---

Built with ❤️ using React, TypeScript, Vite, Express, and yt-dlp

**✅ Security Status:** Phase 1 critical security fixes implemented! Backend is now production-ready from a security standpoint. See PR #2 for details.
