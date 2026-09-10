# App icons & social image

All icons are generated from a single script so the design stays consistent:

```bash
cd frontend
npm run icons:generate   # writes everything into public/
npm run icons:preview    # opens /icon-preview.html in the dev server
```

## Design

A rounded **play triangle** emitting two **sound waves** on a YouTube-red gradient:
video in, audio out. Palette mirrors `src/styles/variables.css` (`#ff1f1f → #b80000`,
accent `#f59e0b`). The 16 px favicon uses a simplified variant (one thicker wave) so it
stays legible in a browser tab.

## Generated files (`public/`)

| File | Purpose |
| --- | --- |
| `favicon.svg` | Vector favicon for modern browsers |
| `favicon.ico` | 16/32/48 multi-size fallback (PNG-in-ICO) |
| `favicon-16x16.png`, `favicon-32x32.png` | Legacy PNG favicons |
| `apple-touch-icon.png` | 180×180 opaque icon for iOS home screen |
| `icon-192.png`, `icon-512.png` | PWA icons, rounded corners (`purpose: any`) |
| `icon-192-maskable.png`, `icon-512-maskable.png` | PWA icons, full-bleed, glyph inside the 80 % safe zone (`purpose: maskable`) |
| `og-image.png` | 1200×630 Open Graph / Twitter card |

`index.html` and `public/manifest.json` reference these files. Change the design in
`generate-icons.js` (`glyph()` / `background()`) and re-run the script; do not edit the
generated files by hand.

## SEO notes

- Meta description, Open Graph, Twitter card and JSON-LD (`WebApplication`) live in `index.html`.
- Tags that need an absolute URL (`<link rel="canonical">`, `og:url`, absolute `og:image`)
  are injected at build time only when `VITE_SITE_URL` is set, e.g. in `.env.production`:

  ```bash
  VITE_SITE_URL=https://ytaudio.example.com
  ```

## PWA screenshots

`public/screenshots/desktop.png` (1280×800, `form_factor: wide`) and
`public/screenshots/mobile.png` (860×1864, `form_factor: narrow`) power the richer
install dialog in Chrome/Edge/Android. They are real captures of the production build
(`npm run build && npx vite preview`) taken with Playwright at 1280×800 @1x and 430×932 @2x.
Re-capture them whenever the UI changes noticeably.
