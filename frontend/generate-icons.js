#!/usr/bin/env node

/**
 * Icon Generation Script
 * Converts SVG icons to PNG format in various sizes
 *
 * Note: This script requires sharp package. Install with:
 * npm install --save-dev sharp
 *
 * Or use an online SVG to PNG converter for:
 * - apple-touch-icon.png.svg -> apple-touch-icon.png (180x180)
 * - logo192.png.svg -> logo192.png (192x192)
 * - logo512.png.svg -> logo512.png (512x512)
 *
 * For favicon.ico, you can use:
 * https://www.favicon-generator.org/
 * Or https://realfavicongenerator.net/
 */

const fs = require('fs');
const path = require('path');

console.log('Icon Generation Guide');
console.log('====================\n');

console.log('SVG icon files have been created in /public directory:');
console.log('- icon.svg (master 512x512 design)');
console.log('- favicon.svg (optimized for small sizes)');
console.log('- apple-touch-icon.png.svg (180x180 template)');
console.log('- logo192.png.svg (192x192 template)');
console.log('- logo512.png.svg (512x512 template)\n');

console.log('To generate PNG files, you have two options:\n');

console.log('Option 1: Install sharp and use automated conversion');
console.log('  npm install --save-dev sharp');
console.log('  Then run this script again\n');

console.log('Option 2: Use online converters (quick & easy)');
console.log('  1. Visit: https://www.favicon-generator.org/');
console.log('  2. Upload: public/favicon.svg');
console.log('  3. Download the generated favicon.ico');
console.log('  4. Place it in: public/favicon.ico\n');

console.log('  For PNG icons:');
console.log('  1. Visit: https://cloudconvert.com/svg-to-png');
console.log('  2. Upload each .svg file');
console.log('  3. Download and rename:');
console.log('     - apple-touch-icon.png.svg -> apple-touch-icon.png');
console.log('     - logo192.png.svg -> logo192.png');
console.log('     - logo512.png.svg -> logo512.png\n');

// Try to use sharp if available
try {
  const sharp = require('sharp');

  console.log('\nSharp is installed! Generating PNG files...\n');

  const conversions = [
    { input: 'apple-touch-icon.png.svg', output: 'apple-touch-icon.png', size: 180 },
    { input: 'logo192.png.svg', output: 'logo192.png', size: 192 },
    { input: 'logo512.png.svg', output: 'logo512.png', size: 512 }
  ];

  const publicDir = path.join(__dirname, 'public');

  Promise.all(conversions.map(async ({ input, output, size }) => {
    const inputPath = path.join(publicDir, input);
    const outputPath = path.join(publicDir, output);

    try {
      await sharp(inputPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated: ${output} (${size}x${size})`);
    } catch (err) {
      console.error(`✗ Failed to generate ${output}:`, err.message);
    }
  })).then(() => {
    console.log('\n✓ PNG generation complete!');
    console.log('\nNote: You still need to generate favicon.ico manually.');
    console.log('Visit: https://www.favicon-generator.org/');
    console.log('Upload: public/favicon.svg\n');
  });

} catch (err) {
  console.log('Sharp is not installed. Using manual conversion method.');
  console.log('Follow the instructions above to generate PNG files.\n');
}
