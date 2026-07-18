import fs from 'node:fs';
import path from 'node:path';

// Local paths of default assets
export const DEFAULT_PATHS = {
  menuBanner: path.join(process.cwd(), 'media', 'images', 'menu', 'menu_default.jpg'),
  welcome: path.join(process.cwd(), 'media', 'images', 'greetings', 'welcome_default.jpg'),
  goodbye: path.join(process.cwd(), 'media', 'images', 'greetings', 'goodbye_default.jpg'),
  thumbnail: path.join(process.cwd(), 'media', 'thumbnails', 'default.jpg'),
  docThumbnail: path.join(process.cwd(), 'media', 'thumbnails', 'document_default.jpg')
};

// URL endpoints for high quality online assets
const ONLINE_FALLBACKS = {
  menuBanner: 'https://cdn.nekos.life/wallpaper/y5m1F3KUre0.jpg',
  welcome: 'https://cdn.nekos.life/wallpaper/fK2T-RHyCIY.jpg',
  goodbye: 'https://cdn.nekos.life/wallpaper/jXOWFycvizA.jpg',
  thumbnail: 'https://cdn.nekos.life/wallpaper/9ru2luBo360.png',
  docThumbnail: 'https://cdn.nekos.life/wallpaper/UoQSY8YrkI4.jpg'
};

/**
 * Creates a valid 24-bit solid color BMP buffer in pure Node.js as an offline fallback
 */
function createSolidBMP(width, height, red, green, blue) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;

  const buffer = Buffer.alloc(fileSize);

  // BMP Header
  buffer.write('BM', 0);
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(0, 6);
  buffer.writeUInt32LE(54, 10);

  // DIB Header
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelDataSize, 34);
  buffer.writeInt32LE(2835, 38);
  buffer.writeInt32LE(2835, 42);
  buffer.writeUInt32LE(0, 46);
  buffer.writeUInt32LE(0, 50);

  // Pixel data (BGR, bottom-up)
  let offset = 54;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      buffer.writeUInt8(blue, offset);
      buffer.writeUInt8(green, offset + 1);
      buffer.writeUInt8(red, offset + 2);
      offset += 3;
    }
    const padding = rowSize - (width * 3);
    for (let p = 0; p < padding; p++) {
      buffer.writeUInt8(0, offset);
      offset++;
    }
  }

  return buffer;
}

/**
 * Downloads an online image as fallback
 */
async function downloadImage(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Main function to ensure required directories and assets are ready
 */
export async function ensureDefaultAssets() {
  const dirs = [
    path.join(process.cwd(), 'media', 'images', 'menu'),
    path.join(process.cwd(), 'media', 'images', 'greetings'),
    path.join(process.cwd(), 'media', 'thumbnails')
  ];

  // 1. Ensure folders exist
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // 2. Process menu banner
  if (!fs.existsSync(DEFAULT_PATHS.menuBanner)) {
    console.log('[DEFAULT ASSETS] Menu banner missing. Generating...');
    try {
      const buffer = await downloadImage(ONLINE_FALLBACKS.menuBanner);
      fs.writeFileSync(DEFAULT_PATHS.menuBanner, buffer);
      console.log('[DEFAULT ASSETS] Menu banner fetched from online fallback successfully.');
    } catch (err) {
      console.warn('[DEFAULT ASSETS] Online fallback failed for menu banner. Generating solid BMP...', err.message);
      const bmp = createSolidBMP(800, 400, 30, 41, 59); // Slate Gray
      fs.writeFileSync(DEFAULT_PATHS.menuBanner, bmp);
    }
  }

  // 3. Process welcome image
  if (!fs.existsSync(DEFAULT_PATHS.welcome)) {
    console.log('[DEFAULT ASSETS] Welcome image missing. Generating...');
    try {
      const buffer = await downloadImage(ONLINE_FALLBACKS.welcome);
      fs.writeFileSync(DEFAULT_PATHS.welcome, buffer);
      console.log('[DEFAULT ASSETS] Welcome image fetched from online fallback successfully.');
    } catch (err) {
      console.warn('[DEFAULT ASSETS] Online fallback failed for welcome. Generating solid BMP...', err.message);
      const bmp = createSolidBMP(800, 400, 16, 185, 129); // Greenish
      fs.writeFileSync(DEFAULT_PATHS.welcome, bmp);
    }
  }

  // 4. Process goodbye image
  if (!fs.existsSync(DEFAULT_PATHS.goodbye)) {
    console.log('[DEFAULT ASSETS] Goodbye image missing. Generating...');
    try {
      const buffer = await downloadImage(ONLINE_FALLBACKS.goodbye);
      fs.writeFileSync(DEFAULT_PATHS.goodbye, buffer);
      console.log('[DEFAULT ASSETS] Goodbye image fetched from online fallback successfully.');
    } catch (err) {
      console.warn('[DEFAULT ASSETS] Online fallback failed for goodbye. Generating solid BMP...', err.message);
      const bmp = createSolidBMP(800, 400, 239, 68, 68); // Reddish
      fs.writeFileSync(DEFAULT_PATHS.goodbye, bmp);
    }
  }

  // 5. Process default thumbnail
  if (!fs.existsSync(DEFAULT_PATHS.thumbnail)) {
    console.log('[DEFAULT ASSETS] Default thumbnail missing. Generating...');
    try {
      const buffer = await downloadImage(ONLINE_FALLBACKS.thumbnail);
      fs.writeFileSync(DEFAULT_PATHS.thumbnail, buffer);
      console.log('[DEFAULT ASSETS] Thumbnail fetched from online fallback successfully.');
    } catch (err) {
      console.warn('[DEFAULT ASSETS] Online fallback failed for thumbnail. Generating solid BMP...', err.message);
      const bmp = createSolidBMP(200, 200, 23, 29, 36); // Charcoal
      fs.writeFileSync(DEFAULT_PATHS.thumbnail, bmp);
    }
  }

  // 6. Process document thumbnail
  if (!fs.existsSync(DEFAULT_PATHS.docThumbnail)) {
    console.log('[DEFAULT ASSETS] Document thumbnail missing. Generating...');
    try {
      const buffer = await downloadImage(ONLINE_FALLBACKS.docThumbnail);
      fs.writeFileSync(DEFAULT_PATHS.docThumbnail, buffer);
      console.log('[DEFAULT ASSETS] Document thumbnail fetched from online fallback successfully.');
    } catch (err) {
      console.warn('[DEFAULT ASSETS] Online fallback failed for docThumbnail. Generating solid BMP...', err.message);
      const bmp = createSolidBMP(200, 200, 29, 78, 216); // Deep blue
      fs.writeFileSync(DEFAULT_PATHS.docThumbnail, bmp);
    }
  }
}

export default {
  DEFAULT_PATHS,
  ensureDefaultAssets
};
