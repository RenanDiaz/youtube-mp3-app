#!/usr/bin/env node
/**
 * Icon & social image generator
 * ------------------------------
 * Single source of truth for every icon the app ships. Run with:
 *
 *   npm run icons:generate
 *
 * Outputs (all in ./public):
 *   favicon.svg                 vector favicon (modern browsers)
 *   favicon.ico                 16/32/48 multi-size fallback
 *   favicon-16x16.png           legacy PNG favicon
 *   favicon-32x32.png           legacy PNG favicon
 *   apple-touch-icon.png        180x180, opaque (iOS applies its own mask)
 *   icon-192.png / icon-512.png PWA icons, rounded corners (purpose: any)
 *   icon-192-maskable.png /
 *   icon-512-maskable.png       PWA icons, full-bleed + safe zone (purpose: maskable)
 *   og-image.png                1200x630 Open Graph / Twitter card image
 *
 * Edit the design in `glyph()` / `background()` below and re-run.
 */

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');

// Brand palette (mirrors src/styles/variables.css)
const RED = '#ff1f1f';
const RED_DARK = '#b80000';
const ORANGE = '#f59e0b';
const BG_DARK = '#0f0f0f';
const BG_DARK_2 = '#1e1e1e';

const SIZE = 512; // design grid

/** Rounded gradient background. `rounded=false` gives a full-bleed square. */
function background(rounded) {
  const rx = rounded ? 116 : 0;
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${RED}"/>
        <stop offset="1" stop-color="${RED_DARK}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.3" cy="0.2" r="0.9">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
        <stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" rx="${rx}" fill="url(#bg)"/>
    <rect width="${SIZE}" height="${SIZE}" rx="${rx}" fill="url(#glow)"/>`;
}

/**
 * The mark: a rounded play triangle emitting two sound waves.
 * Video (play) -> Audio (waves). Reads clearly down to 16px.
 * Drawn centred on the 512 grid; `scale` shrinks it around the centre.
 */
function glyph(scale = 1, { simple = false } = {}) {
  const c = SIZE / 2;
  // The waves carry less visual weight than the triangle, so the mark sits a
  // touch left of the geometric centre to look optically centred.
  const shiftX = simple ? -12 : -26;
  const waves = simple
    ? `<path d="M356 176 A116 116 0 0 1 356 336" stroke-width="52"/>`
    : `<path d="M352 190 A94 94 0 0 1 352 322" stroke-width="40"/>
      <path d="M400 142 A162 162 0 0 1 400 370" stroke-width="40" stroke-opacity="0.85"/>`;
  return `
    <g transform="translate(${c + shiftX} ${c}) scale(${scale}) translate(${-c} ${-c})"
       fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">
      <!-- play triangle (stroke gives the rounded corners) -->
      <path d="M170 176 L170 336 L312 256 Z" fill="#ffffff" stroke-width="${simple ? 52 : 44}"/>
      <!-- sound waves -->
      ${waves}
    </g>`;
}

function iconSvg({ rounded = true, glyphScale = 1, simple = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  ${background(rounded)}
  ${glyph(glyphScale, { simple })}
</svg>
`;
}

/** 1200x630 social preview card. */
function ogSvg() {
  const W = 1200;
  const H = 630;
  const iconSize = 300;
  const iconX = 96;
  const iconY = (H - iconSize) / 2;
  const textX = iconX + iconSize + 72;
  const font = `'Liberation Sans', 'DejaVu Sans', Arial, Helvetica, sans-serif`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="page" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BG_DARK_2}"/>
      <stop offset="1" stop-color="${BG_DARK}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${RED}"/>
      <stop offset="1" stop-color="${ORANGE}"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.2" cy="0.5" r="0.6">
      <stop offset="0" stop-color="${RED}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${RED}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#page)"/>
  <rect width="${W}" height="${H}" fill="url(#halo)"/>
  <rect x="0" y="${H - 10}" width="${W}" height="10" fill="url(#accent)"/>

  <g transform="translate(${iconX} ${iconY}) scale(${iconSize / SIZE})">
    ${background(true)}
    ${glyph(1)}
  </g>

  <g font-family="${font}" fill="#ffffff">
    <text x="${textX}" y="262" font-size="74" font-weight="700" letter-spacing="-1">YouTube Audio</text>
    <text x="${textX}" y="346" font-size="74" font-weight="700" letter-spacing="-1" fill="url(#accent)">Downloader</text>
    <text x="${textX}" y="418" font-size="30" fill="#c8c8c8">Convert videos &amp; playlists to MP3, WAV, M4A or FLAC</text>
  </g>
</svg>
`;
}

/** Pack PNG buffers into a .ico container (PNG-in-ICO is supported by every modern browser). */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dirSize = 16 * entries.length;
  let offset = 6 + dirSize;
  const dirs = [];
  for (const { size, png } of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size >= 256 ? 0 : size, 0); // width
    dir.writeUInt8(size >= 256 ? 0 : size, 1); // height
    dir.writeUInt8(0, 2); // palette
    dir.writeUInt8(0, 3); // reserved
    dir.writeUInt16LE(1, 4); // colour planes
    dir.writeUInt16LE(32, 6); // bits per pixel
    dir.writeUInt32LE(png.length, 8);
    dir.writeUInt32LE(offset, 12);
    offset += png.length;
    dirs.push(dir);
  }
  return Buffer.concat([header, ...dirs, ...entries.map((e) => e.png)]);
}

async function renderPng(svg, size, { flatten = false } = {}) {
  let img = sharp(Buffer.from(svg), { density: 300 }).resize(size, size);
  if (flatten) img = img.flatten({ background: RED_DARK });
  return img.png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  const write = async (name, data) => {
    await fs.writeFile(path.join(PUBLIC_DIR, name), data);
    console.log(`✓ ${name}`);
  };

  const rounded = iconSvg({ rounded: true });
  // 16px favicon: one thicker wave so the mark stays legible in a browser tab.
  const tiny = iconSvg({ rounded: true, simple: true });
  // Maskable: full-bleed background, glyph kept inside the 80% safe zone.
  const maskable = iconSvg({ rounded: false, glyphScale: 0.78 });
  // Apple touch icons must be opaque; iOS rounds the corners itself.
  const apple = iconSvg({ rounded: false, glyphScale: 0.92 });

  await write('favicon.svg', rounded);

  await write('favicon-16x16.png', await renderPng(tiny, 16));
  await write('favicon-32x32.png', await renderPng(rounded, 32));
  await write(
    'favicon.ico',
    buildIco(
      await Promise.all(
        [16, 32, 48].map(async (size) => ({
          size,
          png: await renderPng(size <= 16 ? tiny : rounded, size),
        }))
      )
    )
  );

  await write('apple-touch-icon.png', await renderPng(apple, 180, { flatten: true }));

  await write('icon-192.png', await renderPng(rounded, 192));
  await write('icon-512.png', await renderPng(rounded, 512));
  await write('icon-192-maskable.png', await renderPng(maskable, 192, { flatten: true }));
  await write('icon-512-maskable.png', await renderPng(maskable, 512, { flatten: true }));

  await write(
    'og-image.png',
    await sharp(Buffer.from(ogSvg()), { density: 144 })
      .resize(1200, 630)
      .png({ compressionLevel: 9 })
      .toBuffer()
  );

  console.log('\nDone. Hard-refresh the browser (Ctrl/Cmd+Shift+R) to see the new icons.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
