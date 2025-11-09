import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function convertFavicon() {
  const svgPath = path.join(__dirname, 'public', 'favicon.svg');
  const outputPath = path.join(__dirname, 'public', 'favicon.ico');

  console.log('Converting favicon.svg to favicon.ico...');

  try {
    // Read SVG
    const svgBuffer = fs.readFileSync(svgPath);

    // Convert to PNG at 32x32 (standard favicon size)
    // Modern browsers accept PNG in .ico format
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(outputPath);

    console.log('✓ favicon.ico created successfully!');
    console.log('✓ Please hard refresh your browser (Cmd+Shift+R or Ctrl+Shift+R) to see the new icon');
  } catch (error) {
    console.error('Error converting favicon:', error);
    process.exit(1);
  }
}

convertFavicon();
