# YouTube to Audio Downloader - Frontend

A modern React application for downloading audio from YouTube videos, playlists, and multiple URLs. Built with React 19, TypeScript, and Vite for blazing-fast development.

## 🚀 Tech Stack

- **React 19.1.0** - Latest React with concurrent features
- **TypeScript 5.9.3** - Type safety and better DX
- **Vite 6.4** - Lightning-fast build tool and dev server
- **Bootstrap 5.3.5** - Responsive UI framework
- **Reactstrap 9.2.3** - React components for Bootstrap
- **Axios 1.8.4** - HTTP client for API requests
- **Vitest 2.1.9** - Fast unit testing framework

## 📋 Prerequisites

- Node.js 18+ (recommended: 20+)
- npm 9+ or yarn 1.22+
- Backend server running on http://localhost:5001

## 🏃 Quick Start

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start dev server (opens browser automatically)
npm run dev

# Dev server will be available at http://localhost:3000
```

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing

```bash
# Run tests once
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run coverage
```

## 📜 Available Scripts

### `npm run dev`

Starts the Vite development server with Hot Module Replacement (HMR).

- **Opens automatically** at http://localhost:3000
- **Instant HMR** - Changes reflect in 50-200ms
- **Fast startup** - 1-3 seconds (vs 10-20s with CRA)

### `npm run build`

Builds the app for production to the `build/` folder.

- **TypeScript type checking** runs first
- **Optimized bundles** with code splitting:
  - `react-vendor.js` - React & ReactDOM
  - `bootstrap-vendor.js` - Bootstrap & Reactstrap
  - `index.js` - Application code
- **Build time** - Typically <1 second
- **Bundle size** - ~20-30% smaller than CRA

### `npm run preview`

Previews the production build locally at http://localhost:4173.

Use this to test the production bundle before deployment.

### `npm test`

Runs the test suite with Vitest in watch mode.

- **Fast execution** - Vitest is 5-10x faster than Jest
- **TypeScript support** - No additional config needed
- **Jest-compatible** - Uses familiar Jest/Testing Library APIs

### `npm run test:ui`

Opens the Vitest UI for interactive testing.

Great for:
- Visualizing test results
- Debugging failing tests
- TDD workflow

### `npm run coverage`

Generates test coverage report in `coverage/` directory.

## 📁 Project Structure

```
frontend/
├── public/               # Static assets (served at root)
│   ├── favicon.ico
│   ├── logo192.png
│   ├── logo512.png
│   ├── manifest.json
│   └── robots.txt
├── src/
│   ├── components/       # React components
│   │   ├── SingleFileForm.tsx
│   │   ├── PlaylistForm.tsx
│   │   └── MultiFileform.tsx
│   ├── App.tsx           # Main app component
│   ├── App.css           # App styles
│   ├── App.test.tsx      # App tests
│   ├── main.tsx          # Entry point
│   ├── config.ts         # Environment configuration
│   ├── setupTests.ts     # Test setup
│   └── vite-env.d.ts     # Vite environment types
├── index.html            # HTML template (at root for Vite)
├── vite.config.ts        # Vite configuration
├── vitest.config.ts      # Vitest configuration
├── tsconfig.json         # TypeScript config
├── tsconfig.node.json    # TypeScript config for Vite
├── .env                  # Environment variables (committed)
├── .env.development      # Development environment
├── .env.production       # Production environment
└── package.json
```

## 🔧 Environment Variables

Environment variables must be prefixed with `VITE_` to be exposed to the client.

### Configuration Files

- **`.env`** - Default values (committed to git)
- **`.env.development`** - Development overrides
- **`.env.production`** - Production overrides
- **`.env.local`** - Local overrides (not committed)

### Available Variables

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:5001
VITE_API_TIMEOUT=30000

# App Configuration
VITE_APP_TITLE=YouTube to Audio Downloader
```

### Usage in Code

```typescript
import { API_BASE_URL } from './config';

// Or directly:
const apiUrl = import.meta.env.VITE_API_BASE_URL;
```

## 🎨 Features

### Single File Download
- Download individual YouTube videos as audio
- Custom filename support
- Multiple format support (MP3, WAV, M4A, FLAC)

### Playlist Download
- Download entire YouTube playlists
- Downloads as ZIP archive
- Format selection

### Multi-File Download
- Download multiple URLs at once
- Textarea input with one URL per line
- Downloads as ZIP archive
- Format selection

### Format Support
- **MP3** - Universal compatibility, good quality
- **WAV** - Lossless quality, larger file size
- **M4A** - Apple devices, good compression
- **FLAC** - Lossless, audiophile quality

## 🧪 Testing

### Test Framework

This project uses **Vitest** - a blazing-fast unit test framework powered by Vite.

### Running Tests

```bash
# Run once
npm test -- --run

# Watch mode
npm test

# With UI
npm run test:ui

# Coverage
npm run coverage
```

### Writing Tests

Tests use the familiar Jest API with Testing Library:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders heading', () => {
    render(<App />)
    expect(screen.getByText(/YouTube to Audio Downloader/i)).toBeInTheDocument()
  })
})
```

## 🏗️ Building for Production

### Build Process

```bash
npm run build
```

This creates an optimized production build in the `build/` folder:

1. **TypeScript Type Checking** - Ensures no type errors
2. **Vite Build** - Creates optimized bundles
3. **Code Splitting** - Separates vendor and app code
4. **Minification** - Reduces file sizes
5. **Source Maps** - Generated for debugging

### Build Output

```
build/
├── index.html
├── assets/
│   ├── react-vendor-[hash].js      # React + ReactDOM
│   ├── bootstrap-vendor-[hash].js  # Bootstrap + Reactstrap
│   ├── index-[hash].js             # Your app code
│   └── index-[hash].css            # Styles
├── favicon.ico
├── logo192.png
├── logo512.png
├── manifest.json
└── robots.txt
```

### Performance

- **Bundle Size**: ~270KB total (gzipped: ~86KB)
- **Build Time**: <1 second
- **First Load**: Optimized with code splitting

## 🐛 Debugging

### VS Code Integration

This project includes VS Code launch configurations.

**To debug:**
1. Open VS Code
2. Go to Run and Debug (Cmd+Shift+D)
3. Select "Frontend: Vite Dev Server"
4. Press F5

### Browser DevTools

For React debugging:
- Install React DevTools extension
- Use browser console for logs
- Network tab for API debugging

## 🚢 Deployment

### Prerequisites

1. Build the frontend: `npm run build`
2. Ensure backend is accessible at `VITE_API_BASE_URL`

### Static Hosting (Recommended)

The `build/` folder can be deployed to:

- **Vercel** - `vercel --prod`
- **Netlify** - Drag & drop `build/` folder
- **GitHub Pages** - Configure in repo settings
- **AWS S3 + CloudFront** - Static website hosting
- **Firebase Hosting** - `firebase deploy`

### Environment Variables for Production

Update `.env.production` before building:

```bash
VITE_API_BASE_URL=https://your-production-api.com
```

Then build:

```bash
npm run build
```

### SPA Routing Configuration

If using client-side routing in the future, configure your host to redirect all requests to `index.html`.

**Example for Netlify** (`netlify.toml`):
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Example for Vercel** (`vercel.json`):
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

## 📚 Learn More

### Vite

- [Vite Documentation](https://vitejs.dev/)
- [Vite Features](https://vitejs.dev/guide/features.html)
- [Vite Plugin Ecosystem](https://vitejs.dev/plugins/)

### React

- [React Documentation](https://react.dev/)
- [React 19 Release Notes](https://react.dev/blog/2024/12/05/react-19)
- [TypeScript with React](https://react-typescript-cheatsheet.netlify.app/)

### Testing

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

### Bootstrap & Reactstrap

- [Bootstrap Documentation](https://getbootstrap.com/docs/5.3/)
- [Reactstrap Documentation](https://reactstrap.github.io/)

## 🔄 Migration from CRA

This project was migrated from Create React App to Vite for:
- **5-10x faster** dev server startup
- **Instant HMR** updates
- **40-75x faster** production builds
- **Modern tooling** aligned with current ecosystem

### Key Changes

- Entry point: `src/index.tsx` → `src/main.tsx`
- HTML location: `public/index.html` → `index.html` (root)
- Scripts: `npm start` → `npm run dev`
- Testing: Jest → Vitest
- Environment variables: `REACT_APP_*` → `VITE_*`

## 🤝 Contributing

### Development Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and test: `npm run dev` and `npm test`
3. Type check: `npx tsc --noEmit`
4. Build: `npm run build`
5. Commit changes: `git commit -m "feat: add my feature"`
6. Push and create PR

### Code Style

- **Format on save** - Prettier (if configured)
- **2 spaces** for indentation
- **TypeScript strict mode** enabled
- **React 19 conventions** - No `React` import needed for JSX

## 📝 License

This project is part of the YouTube MP3 Converter application.

## 🆘 Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Dependencies Issues

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

```bash
# Check all type errors
npx tsc --noEmit

# Reload VS Code
Cmd+Shift+P > "Developer: Reload Window"
```

### Build Failures

```bash
# Clean build directory
rm -rf build/

# Try building again
npm run build
```

### API Connection Issues

1. Check backend is running: http://localhost:5001/health
2. Verify `VITE_API_BASE_URL` in `.env`
3. Check CORS settings in backend
4. Check browser console for errors

## 📞 Support

For issues or questions:
1. Check this README
2. Review `.vscode/README.md` for VS Code help
3. Check the migration plan: `../CRA-TO-VITE-MIGRATION-PLAN.md`
4. Review Vite documentation: https://vitejs.dev/

---

Built with ❤️ using React, TypeScript, and Vite
